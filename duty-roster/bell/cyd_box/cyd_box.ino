/*
 * กล่องกระดิ่งเวรแก้ไฟ กฟส.อ่าวลึก — รุ่นจอทัช 2.8" (บอร์ด ESP32-2432S028 / HW-458)
 * เฟส 1 (ทดลอง): ใช้บอร์ดอย่างเดียว ไม่ต่ออะไรเพิ่ม — จอกะพริบ + ไฟ RGB + แตะรับทราบ · LINE ไล่แจ้งตามขั้นเดิม
 *
 * ใช้ของบนบอร์ด: จอทัช · ไฟ RGB (IO4/16/17) · เซนเซอร์แสง (IO34) · ปุ่ม BOOT (IO0) · Wi-Fi
 * ถามระบบงานเวรแก้ไฟ ?action=box&k=KEY ทุก 10 วินาที (ดู gas/Requests.gs → boxPoll_)
 *
 * ปุ่ม BOOT: กด = รับทราบ (ตอนปลุก) · กดค้าง 3 วิ ที่หน้าหลัก = จำลองเรื่องเข้า
 * ครั้งแรก: ตรวจสีจอ → ตั้งการแตะ → เลือก Wi-Fi → ใส่กุญแจกล่อง (ดูในแอป → ตั้งค่า → กระดิ่งหน้าห้องเวร)
 *
 * คอมไพล์: Arduino core esp32 2.0.17 · LVGL 8.3.11 · LovyanGFX 1.1.16 · ArduinoJson 7
 *   บอร์ด "ESP32 Dev Module" · Partition Scheme "Huge APP (3MB No OTA)"
 *   ต้องให้ LVGL เห็น lv_conf.h ในโฟลเดอร์นี้ (ดู README.md)
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <time.h>
#include <lvgl.h>
#include "lgfx_cyd.h"
#include "thai.h"

#define FW_VER "1.9"
static const char* DEF_URL = "https://script.google.com/macros/s/AKfycbzIFoqXzNyJ56EOd2p-L6bdbO6ZNLQmYS5xoW4sTFJUuZKkxnnU2TEKJRMdusi1gwzr5g/exec";

const int PIN_BOOT = 0, PIN_LDR = 34, PIN_R = 4, PIN_G = 16, PIN_B = 17;
const uint32_t POLL_MS = 10000, OFFLINE_MS = 60000, IDLE_HOME_MS = 180000;

// สี
#define C_BG 0x12101A
#define C_CARD 0x221D2D
#define C_CARD2 0x2E2640
#define C_TEXT 0xF3EFF6
#define C_MUTED 0xC9BFD3
#define C_PURPLE 0x6B1E5C
#define C_RED 0xB91C1C
#define C_RED2 0x7F1010
#define C_GREEN 0x16A34A
#define C_GREEN2 0x15803D
#define C_AMBER 0xFBBF24
#define C_OK 0x22C55E
#define C_ORG 0xC2410C
#define C_ORG2 0x7C2D12
#define C_ORGT 0xFED7AA

LGFX lcd;
Preferences prefs;

// ---------- ค่าที่จำไว้ในเครื่อง ----------
struct Cfg {
  String ssid, pass, key, url;
  int pidx = -1; bool pok = false;
  uint16_t cal[8]; bool cok = false;
  int lb = 60, ld = 600;          // ค่าเซนเซอร์แสงตอนห้องสว่าง / มืด
  String wS[5], wP[5]; int wN = 0; // Wi-Fi ที่จำไว้ (ล่าสุดอยู่บนสุด)
} cfg;

void loadCfg() {
  prefs.begin("bell", true);
  cfg.ssid = prefs.getString("ssid", ""); cfg.pass = prefs.getString("pass", "");
  cfg.key = prefs.getString("key", ""); cfg.url = prefs.getString("url", DEF_URL);
  cfg.pidx = prefs.getInt("inv", -1); cfg.pok = prefs.getBool("pok2", false);
  cfg.cok = prefs.getBytes("cal2", cfg.cal, sizeof(cfg.cal)) == sizeof(cfg.cal) && prefs.getBool("cok2", false);
  cfg.lb = prefs.getInt("lb", 60); cfg.ld = prefs.getInt("ld", 600);
  String wl = prefs.getString("wl", "");
  prefs.end();
  cfg.wN = 0;
  int i = 0;
  while (i < (int)wl.length() && cfg.wN < 5) {
    int t = wl.indexOf("\t", i), n = wl.indexOf("\n", i); if (t < 0 || n < 0) break;
    cfg.wS[cfg.wN] = wl.substring(i, t); cfg.wP[cfg.wN] = wl.substring(t + 1, n); cfg.wN++; i = n + 1;
  }
  if (!cfg.wN && cfg.ssid.length()) { cfg.wS[0] = cfg.ssid; cfg.wP[0] = cfg.pass; cfg.wN = 1; }   // ย้ายจากรุ่นเก่า
}
void saveCfg() {
  prefs.begin("bell", false);
  prefs.putString("ssid", cfg.ssid); prefs.putString("pass", cfg.pass); prefs.putString("key", cfg.key); prefs.putString("url", cfg.url);
  prefs.putInt("inv", cfg.pidx); prefs.putBool("pok2", cfg.pok);
  prefs.putBytes("cal2", cfg.cal, sizeof(cfg.cal)); prefs.putBool("cok2", cfg.cok);
  prefs.putInt("lb", cfg.lb); prefs.putInt("ld", cfg.ld);
  String wl; for (int i = 0; i < cfg.wN; i++) wl += cfg.wS[i] + "\t" + cfg.wP[i] + "\n";
  prefs.putString("wl", wl);
  prefs.end();
}

void addWifi(const String& ss, const String& pw) {   // เพิ่ม/แก้ แล้วย้ายขึ้นบนสุด · เก็บได้ 5 วง
  String S[5], P[5]; int n = 0; S[n] = ss; P[n] = pw; n++;
  for (int i = 0; i < cfg.wN && n < 5; i++) if (cfg.wS[i] != ss) { S[n] = cfg.wS[i]; P[n] = cfg.wP[i]; n++; }
  for (int i = 0; i < n; i++) { cfg.wS[i] = S[i]; cfg.wP[i] = P[i]; } cfg.wN = n;
  cfg.ssid = ss; cfg.pass = pw; saveCfg();
}
void delWifi(int k) {
  if (k < 0 || k >= cfg.wN) return;
  for (int i = k; i < cfg.wN - 1; i++) { cfg.wS[i] = cfg.wS[i + 1]; cfg.wP[i] = cfg.wP[i + 1]; }
  cfg.wN--; if (cfg.wN) { cfg.ssid = cfg.wS[0]; cfg.pass = cfg.wP[0]; } else { cfg.ssid = ""; cfg.pass = ""; }
  saveCfg();
}

// ---------- ข้อมูลจากระบบ (งานเน็ตบน core 0 เขียน · หน้าจอบน core 1 อ่าน) ----------
struct Job { String id, t, type, place, st, by, ph; double lat = 0, lon = 0; };
struct Net {
  bool ok = false; String err; uint32_t lastOk = 0; uint32_t ver = 0;
  int ring = 0, n = 0, min = 0; String id, text; bool test = false;
  String duty[6]; int nDuty = 0; String crew[6]; int nCrew = 0; int open = 0, today = 0; Job jobs[6]; int nJobs = 0; String app;
  bool wxOk = false; int wxLv = 0, wxT = 0, wxRh = 0, wxGust = 0; String wxLabel, wxCond, wxAt; String wxH[6]; int wxP[6]; int wxN = 0;
  String mkAt; String mkN[4], mkP[4], mkO[4], mkD[4]; float mkC[4]; int mkU[4]; int mkCount = 0;
  int outN = 0; String outK[3], outA[3], outB[3], outC[3], outS[3], outBack;   // ไฟดับอยู่ตอนนี้ (แสดงอย่างเดียว ไม่ปลุก)
  int ocN = -1, ocNs = 0, ocMin = -1, ocRm = 30; String ocAt, ocS, ocX, ocUrl;   // ข้อความ OpenChat รอตรวจ (-1 = ระบบไม่ได้เปิดใช้)
  int rot[3] = {20, 10, 5};   // วินาที: หน้าเวร / อากาศ / ตลาด (ระบบตั้งได้ · 0 = ไม่แสดงหน้านั้น)
} net;
SemaphoreHandle_t mtx;
volatile bool reqAck = false, reqLight = false, reqPoll = false;
String reqAckBy;
volatile bool wifiChanged = false, wifiPause = false;

String urlenc(const String& s) {
  String o; const char* h = "0123456789ABCDEF";
  for (size_t i = 0; i < s.length(); i++) {
    uint8_t c = s[i];
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') o += char(c);
    else { o += '%'; o += h[c >> 4]; o += h[c & 15]; }
  }
  return o;
}

String httpGet(const String& url, int& code) {
  WiFiClientSecure c; c.setInsecure();
  HTTPClient h; h.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); h.setTimeout(15000);
  code = 0;
  if (!h.begin(c, url)) return "";
  code = h.GET();
  String body = code == 200 ? h.getString() : "";
  h.end();
  return body;
}

void doPoll(bool ack, const String& by, bool light) {
  String u = cfg.url + "?action=box&k=" + urlenc(cfg.key) + "&rssi=" + String(WiFi.RSSI());
  if (ack) u += "&ack=1&by=" + urlenc(by);
  if (light) u += "&ev=light";
  int code; String body = httpGet(u, code);
  JsonDocument doc;
  bool parsed = body.length() && !deserializeJson(doc, body);
  xSemaphoreTake(mtx, portMAX_DELAY);
  if (!parsed) {
    net.err = code == 200 ? "ระบบตอบกลับไม่ถูกต้อง" : (code ? "ติดต่อระบบไม่ได้ (" + String(code) + ")" : "ติดต่อระบบไม่ได้");
  } else if (!(doc["ok"] | false)) {
    net.err = String((const char*)(doc["error"] | "ระบบแจ้งข้อผิดพลาด"));
  } else {
    net.ok = true; net.err = ""; net.lastOk = millis();
    int r = doc["ring"] | 0;
    if (r == 3) { net.test = true; r = 0; }
    net.ring = r; net.n = doc["n"] | 0; net.min = doc["min"] | 0;
    net.id = String((const char*)(doc["id"] | "")); net.text = String((const char*)(doc["text"] | ""));
    net.nDuty = 0;
    for (JsonVariant v : doc["duty"].as<JsonArray>()) if (net.nDuty < 6) net.duty[net.nDuty++] = String((const char*)(v | ""));
    net.nCrew = 0;
    for (JsonVariant v : doc["crew"].as<JsonArray>()) if (net.nCrew < 6) net.crew[net.nCrew++] = String((const char*)(v | ""));
    net.open = doc["open"] | 0; net.today = doc["today"] | 0;
    net.app = String((const char*)(doc["app"] | ""));
    JsonObject w = doc["wx"];
    net.wxOk = !w.isNull() && !w["t"].isNull();
    if (net.wxOk) {
      net.wxLv = w["lv"] | 0; net.wxT = w["t"] | 0; net.wxRh = w["rh"] | 0; net.wxGust = w["gust"] | 0;
      net.wxLabel = String((const char*)(w["label"] | "")); net.wxCond = String((const char*)(w["cond"] | "")); net.wxAt = String((const char*)(w["at"] | ""));
      net.wxN = 0;
      for (JsonObject h : w["hrs"].as<JsonArray>()) { if (net.wxN >= 6) break; net.wxH[net.wxN] = String((const char*)(h["h"] | "")); net.wxP[net.wxN] = h["p"] | -1; net.wxN++; }
    }
    { JsonArray ra = doc["rot"]; if (ra.size() == 3) for (int i = 0; i < 3; i++) net.rot[i] = ra[i] | net.rot[i]; }
    { JsonObject o = doc["oc"];
      if (o.isNull()) net.ocN = -1;
      else { net.ocN = o["n"] | 0; net.ocNs = o["ns"] | 0; net.ocMin = o["min"] | -1; net.ocRm = o["rm"] | 30;
        net.ocAt = String((const char*)(o["at"] | "")); net.ocS = String((const char*)(o["s"] | "")); net.ocX = String((const char*)(o["x"] | ""));
        net.ocUrl = String((const char*)(o["url"] | "")); } }
    { JsonObject o = doc["out"]; net.outN = 0; net.outBack = "";
      if (!o.isNull()) { net.outN = o["n"] | 0; net.outBack = String((const char*)(o["back"] | "")); int i = 0;
        for (JsonObject it : o["list"].as<JsonArray>()) { if (i >= 3) break;
          net.outK[i] = String((const char*)(it["k"] | "o")); net.outA[i] = String((const char*)(it["a"] | "")); net.outB[i] = String((const char*)(it["b"] | ""));
          net.outC[i] = String((const char*)(it["c"] | "")); net.outS[i] = String((const char*)(it["s"] | "")); i++; }
        for (; i < 3; i++) { net.outK[i] = ""; net.outA[i] = ""; } } }
    JsonObject mk = doc["mk"];
    net.mkCount = 0; net.mkAt = String((const char*)(mk["at"] | ""));
    for (JsonObject it : mk["items"].as<JsonArray>()) {
      if (net.mkCount >= 4) break;
      net.mkN[net.mkCount] = String((const char*)(it["n"] | "")); net.mkP[net.mkCount] = String((const char*)(it["p"] | "")); net.mkC[net.mkCount] = it["c"] | 0.0f;
      net.mkO[net.mkCount] = String((const char*)(it["o"] | "")); net.mkD[net.mkCount] = String((const char*)(it["dt"] | "")); net.mkU[net.mkCount] = it["u"] | 0; net.mkCount++;
    }
    net.nJobs = 0;
    for (JsonObject j : doc["jobs"].as<JsonArray>()) {
      if (net.nJobs >= 6) break;
      Job& x = net.jobs[net.nJobs++];
      x.id = String((const char*)(j["id"] | "")); x.t = String((const char*)(j["t"] | ""));
      x.type = String((const char*)(j["type"] | "")); x.place = String((const char*)(j["place"] | ""));
      x.st = String((const char*)(j["st"] | "")); x.by = String((const char*)(j["by"] | ""));
      x.ph = String((const char*)(j["ph"] | "")); x.lat = j["lat"] | 0.0; x.lon = j["lon"] | 0.0;
    }
  }
  net.ver++;
  xSemaphoreGive(mtx);
}

uint32_t ackRetryAt = 0;
void netTask(void*) {
  uint32_t lastPoll = 0, lastBegin = 0; bool ntp = false;
  for (;;) {
    if (wifiChanged) { wifiChanged = false; WiFi.disconnect(); lastBegin = 0; }
    if (wifiPause || cfg.wN == 0) { vTaskDelay(500); continue; }
    if (WiFi.status() != WL_CONNECTED) {
      if (!lastBegin || millis() - lastBegin > 20000) {
        lastBegin = millis();
        int best = -1, bestR = -999, n = WiFi.scanNetworks();            // ต่อวงที่จำไว้และแรงที่สุด
        for (int i = 0; i < n; i++) for (int k = 0; k < cfg.wN; k++) if (WiFi.SSID(i) == cfg.wS[k] && WiFi.RSSI(i) > bestR) { best = k; bestR = WiFi.RSSI(i); }
        WiFi.scanDelete();
        if (best < 0) best = 0;
        WiFi.begin(cfg.wS[best].c_str(), cfg.wP[best].c_str());
      }
      vTaskDelay(300); continue;
    }
    if (!ntp) { configTzTime("ICT-7", "pool.ntp.org", "time.google.com", "time.cloudflare.com"); ntp = true; }
    if (cfg.key.length() == 0) { vTaskDelay(500); continue; }
    if (reqAck && millis() >= ackRetryAt) {
      String by = reqAckBy; reqAck = false; bool l = reqLight; reqLight = false; doPoll(true, by, l); lastPoll = millis();
      xSemaphoreTake(mtx, portMAX_DELAY); bool fail = net.err.length() > 0; xSemaphoreGive(mtx);
      if (fail) { reqAckBy = by; ackRetryAt = millis() + 5000; reqAck = true; }   // ส่งรับทราบไม่สำเร็จ → ลองใหม่
      continue;
    }
    if (reqLight || reqPoll || !lastPoll || millis() - lastPoll >= POLL_MS) {
      bool l = reqLight; reqLight = false; reqPoll = false; lastPoll = millis(); doPoll(false, "", l);
    }
    vTaskDelay(100);
  }
}

// ---------- ไฟ RGB / แสง / ปุ่ม BOOT ----------
void rgb(uint8_t r, uint8_t g, uint8_t b) { analogWrite(PIN_R, 255 - r); analogWrite(PIN_G, 255 - g); analogWrite(PIN_B, 255 - b); }
float ldrAvg = -1; bool roomBright = true;
void ldrTick() {
  int v = analogRead(PIN_LDR);
  ldrAvg = ldrAvg < 0 ? v : ldrAvg * 0.85f + v * 0.15f;
  float mid = (cfg.lb + cfg.ld) / 2.0f, hy = fabs(cfg.ld - cfg.lb) * 0.1f;
  bool up = cfg.ld > cfg.lb;          // มืด = ค่ามากขึ้น (ปกติของบอร์ดนี้)
  if (roomBright) { if (up ? ldrAvg > mid + hy : ldrAvg < mid - hy) roomBright = false; }
  else { if (up ? ldrAvg < mid - hy : ldrAvg > mid + hy) roomBright = true; }
}
uint32_t bootDown = 0; bool bootLongFired = false;
int bootEvent() {                      // 1 = กดสั้น · 2 = กดค้าง 3 วิ
  bool down = digitalRead(PIN_BOOT) == LOW;
  if (down) {
    if (!bootDown) { bootDown = millis(); bootLongFired = false; }
    else if (!bootLongFired && millis() - bootDown > 3000) { bootLongFired = true; return 2; }
    return 0;
  }
  int ev = 0;
  if (bootDown && !bootLongFired && millis() - bootDown > 40) ev = 1;
  bootDown = 0; return ev;
}

// ---------- LVGL ----------
static lv_disp_draw_buf_t drawBuf;
static lv_color_t *buf1, *buf2;
void flushCb(lv_disp_drv_t* d, const lv_area_t* a, lv_color_t* c) {
  uint32_t w = a->x2 - a->x1 + 1, h = a->y2 - a->y1 + 1;
  lcd.startWrite(); lcd.setAddrWindow(a->x1, a->y1, w, h); lcd.writePixels((lgfx::rgb565_t*)&c->full, w * h); lcd.endWrite();
  lv_disp_flush_ready(d);
}
void touchCb(lv_indev_drv_t*, lv_indev_data_t* data) {
  uint16_t x, y;
  if (lcd.getTouch(&x, &y)) { data->state = LV_INDEV_STATE_PR; data->point.x = x; data->point.y = y; }
  else data->state = LV_INDEV_STATE_REL;
}

// ตัวช่วยสร้างหน้าจอ
lv_obj_t* mkScr(uint32_t bg = C_BG) {
  lv_obj_t* s = lv_obj_create(NULL);
  lv_obj_set_style_bg_color(s, lv_color_hex(bg), 0);
  lv_obj_clear_flag(s, LV_OBJ_FLAG_SCROLLABLE);
  return s;
}
lv_obj_t* box(lv_obj_t* p, int x, int y, int w, int h, uint32_t bg, int r = 10) {
  lv_obj_t* o = lv_obj_create(p);
  lv_obj_set_pos(o, x, y); lv_obj_set_size(o, w, h);
  lv_obj_set_style_bg_color(o, lv_color_hex(bg), 0); lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
  lv_obj_set_style_border_width(o, 0, 0); lv_obj_set_style_radius(o, r, 0);
  lv_obj_set_style_pad_all(o, 0, 0); lv_obj_set_style_shadow_width(o, 0, 0);
  lv_obj_clear_flag(o, LV_OBJ_FLAG_SCROLLABLE);
  return o;
}
void setT(lv_obj_t* l, const String& s) { lv_label_set_text(l, thai::shape(s).c_str()); }
lv_obj_t* lbl(lv_obj_t* p, const String& s, const lv_font_t* f, uint32_t col, int x, int y, int w = 0) {
  lv_obj_t* l = lv_label_create(p);
  lv_obj_set_style_text_font(l, f, 0); lv_obj_set_style_text_color(l, lv_color_hex(col), 0);
  lv_obj_set_pos(l, x, y); setT(l, s);
  // ทุกข้อความเป็นบรรทัดเดียว ไม่ล้นกรอบ: ยาวเกินที่ว่าง → ตัดท้ายด้วย … (ไม่ขึ้นบรรทัดใหม่ไปทับข้อความอื่น)
  if (w <= 0) {
    lv_obj_update_layout(p);
    int avail = lv_obj_get_content_width(p) - (x > 0 ? x : 0) - 2;
    lv_point_t sz; lv_txt_get_size(&sz, lv_label_get_text(l), f, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    if (avail > 20 && sz.x > avail) w = avail;
  }
  if (w > 0) { lv_obj_set_width(l, w); lv_label_set_long_mode(l, LV_LABEL_LONG_DOT); lv_obj_set_height(l, lv_font_get_line_height(f)); }
  return l;
}
lv_obj_t* btn(lv_obj_t* p, const String& s, const lv_font_t* f, uint32_t bg, int x, int y, int w, int h, lv_event_cb_t cb, void* ud = nullptr) {
  lv_obj_t* b = lv_btn_create(p);
  lv_obj_set_pos(b, x, y); lv_obj_set_size(b, w, h);
  lv_obj_set_style_bg_color(b, lv_color_hex(bg), 0); lv_obj_set_style_radius(b, 10, 0); lv_obj_set_style_shadow_width(b, 0, 0);
  lv_obj_t* l = lv_label_create(b); lv_obj_set_style_text_font(l, f, 0); lv_obj_set_style_text_color(l, lv_color_hex(C_TEXT), 0);
  setT(l, s); lv_obj_center(l);
  if (cb) lv_obj_add_event_cb(b, cb, LV_EVENT_CLICKED, ud);
  return b;
}
void loadScr(lv_obj_t* s) { lv_scr_load_anim(s, LV_SCR_LOAD_ANIM_NONE, 0, 0, true); }

// ---------- สถานะหน้าจอ ----------
enum Scr { S_NONE, S_COLOR, S_CALI, S_WIFI, S_PASS, S_KEY, S_HOME, S_ALARM, S_WHO, S_DETAIL, S_JOBS, S_SET, S_WX, S_MK, S_WLIST, S_OC, S_OUT };
Scr scr = S_NONE;
Net snap;                                   // สำเนาข้อมูลล่าสุดสำหรับวาดจอ
uint32_t snapVer = 0;

// การปลุก
bool alarmSim = false; String alarmId, alarmText, lightAt, lastAckedId; uint32_t alarmStart = 0, lastAckMs = 0; int alarmMin0 = 0;
bool alarmBaseBright = true; String ackBy, ackAt;
uint32_t testUntil = 0;

String hhmm() { struct tm t; if (!getLocalTime(&t, 10) || t.tm_year < 124) return "--:--"; char b[8]; strftime(b, 8, "%H:%M", &t); return b; }
String thDate() {
  static const char* D[] = {"อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."};
  static const char* M[] = {"ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."};
  struct tm t; if (!getLocalTime(&t, 10) || t.tm_year < 124) return "รอเวลาจากเน็ต";
  return String(D[t.tm_wday]) + " " + t.tm_mday + " " + M[t.tm_mon] + " " + ((t.tm_year + 1900 + 543) % 100);
}
bool online() { return WiFi.status() == WL_CONNECTED && snap.lastOk && millis() - snap.lastOk < OFFLINE_MS; }
const Job* findJob(const String& id) { for (int i = 0; i < snap.nJobs; i++) if (snap.jobs[i].id == id) return &snap.jobs[i]; return nullptr; }

void showWifiList(); void showWx(); void showMk(); void paintOc(); void showOut(); void backHome(lv_event_t*); uint32_t pageAt = 0;
void showHome(); void showAlarm(); void showWho(); void showDetail(const String& id, const String& head, uint32_t headCol); void showJobs(); void showSettings();
void showWifi(); void showPass(const String& ssid); void showKey(); void showColor(); void showCali();
void nextSetup(); void showOc(bool remind);
uint32_t ocSnoozeUntil = 0;   // แตะ "ดูแล้ว" → ไม่เด้งเตือนซ้ำ 15 นาที

// ---------- หน้าหลัก ----------
lv_obj_t *hClock, *hDate, *hNet, *hDuty, *hCrew, *hOpen, *hToday, *hBars[4], *hErr, *hOc, *hOcT, *hT3, *hT3a, *hT3b, *hT3c, *hT3d, *hOut, *hOutT;
uint32_t simPress = 0; bool simFired = false;

void wifiBars(lv_obj_t* p, int x, int y, lv_obj_t** bars) {
  for (int i = 0; i < 4; i++) { bars[i] = box(p, x + i * 6, y + 12 - (i + 1) * 3, 4, (i + 1) * 3, 0x3F3A4A, 1); }
}
void paintBars(lv_obj_t** bars, bool on) {
  int r = WiFi.RSSI(), n = !on ? 0 : r > -55 ? 4 : r > -65 ? 3 : r > -75 ? 2 : 1;
  for (int i = 0; i < 4; i++) lv_obj_set_style_bg_color(bars[i], lv_color_hex(i < n ? C_OK : 0x3F3A4A), 0);
}
void simCb(lv_event_t* e) {
  lv_event_code_t c = lv_event_get_code(e);
  if (c == LV_EVENT_PRESSED) { simPress = millis(); simFired = false; }
  if (c == LV_EVENT_PRESSING && !simFired && millis() - simPress > 3000) {
    simFired = true; alarmSim = true; alarmId = "ทดลอง"; alarmText = "จำลอง: ไฟดับทั้งซอย (ไม่ใช่งานจริง)"; alarmMin0 = 0; showAlarm();
  }
}
void showHome() {
  scr = S_HOME;
  lv_obj_t* s = mkScr();
  lbl(s, "เวรแก้ไฟ กฟส.อ่าวลึก", &font_th16, C_MUTED, 8, 4);
  lv_obj_t* tag = box(s, 186, 4, 58, 22, 0x3A2E12, 5);
  lv_obj_t* tl = lbl(tag, "ทดลอง", &font_th16, C_AMBER, 0, 0); lv_obj_center(tl);
  wifiBars(s, 252, 6, hBars);
  lv_obj_t* g = btn(s, LV_SYMBOL_SETTINGS, &font_th20, C_CARD2, 282, 2, 34, 28, [](lv_event_t*) { showSettings(); });
  (void)g;
  hClock = lbl(s, "--:--", &font_clock56, C_TEXT, 8, 26);
  hDate = lbl(s, "", &font_th20, C_MUTED, 172, 24, 144);
  hNet = lbl(s, "", &font_th16, C_MUTED, 172, 48, 144);
  lv_obj_t* card = box(s, 8, 74, 304, 82, C_CARD);
  lbl(card, "พนักงานเวร", &font_th16, C_MUTED, 10, 0);
  hDuty = lbl(card, "—", &font_th26, C_TEXT, 10, 16, 284);
  hCrew = lbl(card, "", &font_th16, C_TEXT, 10, 54, 284);
  lv_obj_t* t1 = btn(s, "", &font_th16, C_CARD, 8, 160, 96, 54, [](lv_event_t*) { showJobs(); });
  lv_obj_set_style_pad_all(t1, 4, 0);
  lbl(t1, "งานค้าง", &font_th16, C_MUTED, 4, 0);
  hOpen = lbl(t1, "0", &font_th26, C_AMBER, 4, 8);
  lv_obj_t* t2 = btn(s, "", &font_th16, C_CARD, 112, 160, 96, 54, [](lv_event_t*) { showJobs(); });
  lv_obj_set_style_pad_all(t2, 4, 0);
  lbl(t2, "วันนี้", &font_th16, C_MUTED, 4, 0);
  hToday = lbl(t2, "0", &font_th26, C_TEXT, 4, 8);
  lv_obj_t* t3 = btn(s, "", &font_th16, C_CARD2, 216, 160, 96, 54, nullptr); hT3 = t3;
  lv_obj_set_style_pad_all(t3, 4, 0);
  hT3a = lbl(t3, "ค้าง 3 วิ", &font_th16, C_MUTED, 4, 0);
  hT3b = lbl(t3, "จำลองเรื่อง", &font_th16, C_TEXT, 4, 22);
  hT3c = lbl(t3, "ไฟดับอยู่", &font_th16, 0xFECACA, 4, 0);
  hT3d = lbl(t3, "", &font_th26, C_TEXT, 4, 8);
  lv_obj_add_event_cb(t3, simCb, LV_EVENT_ALL, nullptr);
  lv_obj_add_event_cb(t3, [](lv_event_t*) { if (snap.outN > 0 && !simFired) showOut(); }, LV_EVENT_CLICKED, nullptr);
  hErr = lbl(s, "", &font_th16, C_MUTED, 8, 215, 304);
  hOc = btn(s, "", &font_th16, C_ORG, 0, 214, 320, 26, [](lv_event_t*) { showOc(false); });
  lv_obj_set_style_radius(hOc, 0, 0); lv_obj_set_style_pad_all(hOc, 0, 0);
  hOcT = lv_obj_get_child(hOc, 0); lv_obj_set_width(hOcT, 304); lv_label_set_long_mode(hOcT, LV_LABEL_LONG_DOT); lv_obj_set_height(hOcT, lv_font_get_line_height(&font_th16));
  lv_obj_add_flag(hOc, LV_OBJ_FLAG_HIDDEN);
  hOut = btn(s, "", &font_th16, 0xB91C1C, 0, 214, 320, 26, [](lv_event_t*) { showOut(); });
  lv_obj_set_style_radius(hOut, 0, 0); lv_obj_set_style_pad_all(hOut, 0, 0);
  hOutT = lv_obj_get_child(hOut, 0); lv_obj_set_width(hOutT, 304); lv_label_set_long_mode(hOutT, LV_LABEL_LONG_DOT); lv_obj_set_height(hOutT, lv_font_get_line_height(&font_th16));
  lv_obj_add_flag(hOut, LV_OBJ_FLAG_HIDDEN);
  loadScr(s);
  pageAt = millis();
  snapVer = 0;
}
void paintHome() {
  setT(hClock, hhmm()); setT(hDate, thDate());
  bool on = online(); paintBars(hBars, WiFi.status() == WL_CONNECTED);
  String st;
  if (WiFi.status() != WL_CONNECTED) st = "ต่อ Wi-Fi ไม่ได้";
  else if (!on) st = snap.err.length() ? snap.err : "กำลังติดต่อระบบ…";
  else st = "ออนไลน์";
  setT(hNet, st); lv_obj_set_style_text_color(hNet, lv_color_hex(on ? C_OK : C_AMBER), 0);
  String d; for (int i = 0; i < snap.nDuty; i++) d += (i ? " · " : "") + snap.duty[i];
  String ds = d.length() ? d : String(on ? "ไม่มีพนักงานอยู่เวรตอนนี้" : "—");
  { lv_point_t sz; String sh = thai::shape(ds); lv_txt_get_size(&sz, sh.c_str(), &font_th26, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    lv_obj_set_style_text_font(hDuty, sz.x > 284 ? &font_th20 : &font_th26, 0); }   // หลายชื่อ → ตัวเล็กลง ไม่ตัดชื่อ
  setT(hDuty, ds);
  String c; for (int i = 0; i < snap.nCrew; i++) c += (i ? " · " : "") + snap.crew[i];
  setT(hCrew, "คนงาน: " + (c.length() ? c : String("—")));
  setT(hOpen, String(snap.open)); setT(hToday, String(snap.today));
  bool wxWarn = snap.wxOk && snap.wxLv >= 5;
  setT(hErr, (snap.err.length() && on) ? snap.err : wxWarn ? String(LV_SYMBOL_WARNING " อากาศระดับ " + String(snap.wxLv) + " · " + snap.wxLabel) : String("ห้องมืด → จอหรี่ · กด BOOT ค้าง = จำลอง"));
  lv_obj_set_style_text_color(hErr, lv_color_hex(wxWarn ? 0xFDBA74 : C_MUTED), 0);
  if (snap.ocN > 0 && on) {
    lv_obj_clear_flag(hOc, LV_OBJ_FLAG_HIDDEN);
    String t = String("\xE2\x97\x8F OpenChat รอตรวจ ") + snap.ocN;
    if (snap.ocNs > 0 && snap.ocMin >= 0) t += " · ค้าง " + String(snap.ocMin) + " นาที · แตะดู";
    else t += " · ล่าสุด " + snap.ocAt + " · แตะดู";
    setT(hOcT, t);
    bool hot = snap.ocNs > 0 && (millis() / 1000) % 2;
    lv_obj_set_style_bg_color(hOc, lv_color_hex(snap.ocNs > 0 ? (hot ? C_ORG2 : C_ORG) : 0x9A3412), 0);
  } else lv_obj_add_flag(hOc, LV_OBJ_FLAG_HIDDEN);
  // ไฟดับอยู่ตอนนี้: ช่องที่ 3 เป็นสีแดง + แถบล่างวนชื่อจุด (ถ้าไม่มีแถบ OpenChat บังอยู่)
  bool out = on && snap.outN > 0;
  if (out) { lv_obj_add_flag(hT3a, LV_OBJ_FLAG_HIDDEN); lv_obj_add_flag(hT3b, LV_OBJ_FLAG_HIDDEN); lv_obj_clear_flag(hT3c, LV_OBJ_FLAG_HIDDEN); lv_obj_clear_flag(hT3d, LV_OBJ_FLAG_HIDDEN);
    setT(hT3d, String(snap.outN) + " จุด"); lv_obj_set_style_bg_color(hT3, lv_color_hex(0x7F1D1D), 0); }
  else { lv_obj_clear_flag(hT3a, LV_OBJ_FLAG_HIDDEN); lv_obj_clear_flag(hT3b, LV_OBJ_FLAG_HIDDEN); lv_obj_add_flag(hT3c, LV_OBJ_FLAG_HIDDEN); lv_obj_add_flag(hT3d, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_bg_color(hT3, lv_color_hex(C_CARD2), 0); }
  if (out && lv_obj_has_flag(hOc, LV_OBJ_FLAG_HIDDEN)) {
    int nl = 0; for (int i = 0; i < 3; i++) if (snap.outS[i].length()) nl++;
    int i = nl ? (millis() / 4000) % nl : 0;
    lv_obj_clear_flag(hOut, LV_OBJ_FLAG_HIDDEN);
    setT(hOutT, String(LV_SYMBOL_WARNING " ") + (nl ? snap.outS[i] : String("ไฟดับอยู่ ") + snap.outN + " จุด"));
  } else lv_obj_add_flag(hOut, LV_OBJ_FLAG_HIDDEN);
}

// ---------- ไฟดับอยู่ตอนนี้ (แสดงอย่างเดียว · ไม่ปลุก) ----------
void showOut() {
  scr = S_OUT; pageAt = millis();
  lv_obj_t* s = mkScr();
  lv_obj_add_flag(s, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s, backHome, LV_EVENT_CLICKED, nullptr);
  lv_obj_t* hb = box(s, 0, 0, 320, 34, 0x7F1D1D, 0);
  lbl(hb, String(LV_SYMBOL_WARNING " ไฟดับอยู่ตอนนี้ · ") + snap.outN + " จุด", &font_th20, 0xFFFFFF, 10, 4, 300);
  int y = 40, shown = 0;
  for (int i = 0; i < 3 && snap.outA[i].length(); i++) {
    uint32_t bar = snap.outK[i] == "e" ? 0xEF4444 : snap.outK[i] == "p" ? 0xA855F7 : 0xF59E0B;
    lv_obj_t* c = box(s, 8, y, 304, 54, C_CARD, 8);
    box(c, 0, 0, 4, 54, bar, 0);
    lv_obj_t* a = lbl(c, snap.outA[i], &font_th16, C_TEXT, 10, 0, 288); lv_label_set_long_mode(a, LV_LABEL_LONG_DOT); lv_obj_set_height(a, lv_font_get_line_height(&font_th16));
    lv_obj_t* b = lbl(c, snap.outB[i], &font_th16, C_MUTED, 10, 17, 288); lv_label_set_long_mode(b, LV_LABEL_LONG_DOT); lv_obj_set_height(b, lv_font_get_line_height(&font_th16));
    lv_obj_t* d = lbl(c, snap.outC[i], &font_th16, snap.outK[i] == "e" ? 0xFCA5A5 : snap.outK[i] == "p" ? 0xD8B4FE : 0xFCD34D, 10, 34, 288); lv_label_set_long_mode(d, LV_LABEL_LONG_DOT); lv_obj_set_height(d, lv_font_get_line_height(&font_th16));
    y += 58; shown++;
  }
  if (snap.outN > shown) { lbl(s, "+ อีก " + String(snap.outN - shown) + " จุด · ดูในแอป", &font_th16, C_MUTED, 10, y, 300); y += 20; }
  lbl(s, snap.outBack.length() ? "ไฟมาแล้ววันนี้: " + snap.outBack : String("แตะจอ = กลับหน้าเวร"), &font_th16, 0xA79DB3, 8, 214, 304);
  loadScr(s);
}

// ---------- ข้อความ OpenChat รอตรวจ (แสดงบนจอ · ไม่มีเสียง) ----------
lv_obj_t *oScr, *oHead, *oSub, *oWho, *oTxt, *oCap; lv_obj_t* oQr; bool oRemind = false; uint32_t oShownAt = 0; String oQrUrl;
void ocSeen() { ocSnoozeUntil = millis() + 15UL * 60000; showHome(); }
void showOc(bool remind) {
  scr = S_OC; oRemind = remind; oShownAt = millis();
  lv_obj_t* s = mkScr(remind ? C_ORG : C_BG); oScr = s;
  lv_obj_t* hb = box(s, 0, 0, 320, 34, remind ? C_ORG2 : C_ORG, 0);
  oHead = lbl(hb, "", &font_th20, 0xFFFFFF, 10, 4, 300);
  oSub = lbl(s, "", &font_th16, C_ORGT, 8, 38, 196);
  lv_obj_t* cb = box(s, 8, 60, 196, 132, remind ? C_ORG2 : C_CARD, 8);
  oWho = lbl(cb, "", &font_th16, C_ORGT, 8, 4, 180);
  oTxt = lv_label_create(cb); lv_obj_set_style_text_font(oTxt, &font_th20, 0); lv_obj_set_style_text_color(oTxt, lv_color_hex(0xFFFFFF), 0);
  lv_obj_set_pos(oTxt, 8, 24); lv_obj_set_width(oTxt, 180); lv_label_set_long_mode(oTxt, LV_LABEL_LONG_DOT);
  lv_obj_set_height(oTxt, 4 * lv_font_get_line_height(&font_th20));
  oQr = lv_qrcode_create(s, 92, lv_color_hex(0x000000), lv_color_hex(0xFFFFFF));
  lv_obj_set_pos(oQr, 212, 40); lv_obj_set_style_border_color(oQr, lv_color_hex(0xFFFFFF), 0); lv_obj_set_style_border_width(oQr, 4, 0);
  oQrUrl = "";
  oCap = lbl(s, "สแกน = ตรวจ", &font_th16, C_ORGT, 208, 142, 110);
  lbl(s, "แล้วกดในแอป", &font_th16, C_ORGT, 208, 162, 110);
  btn(s, "หน้าหลัก", &font_th20, C_CARD, 8, 198, 112, 38, [](lv_event_t*) { showHome(); });
  btn(s, LV_SYMBOL_OK " ดูแล้ว · เตือนอีก 15 น.", &font_th16, C_GREEN2, 128, 198, 184, 38, [](lv_event_t*) { ocSeen(); });
  loadScr(s);
  paintOc();
}
void paintOc() {
  if (snap.ocN <= 0) { showHome(); return; }
  setT(oHead, String(oRemind ? LV_SYMBOL_WARNING " ข้อความแจ้งเหตุรอตรวจ" : "OpenChat รอตรวจ") + " · " + snap.ocN + " ราย");
  setT(oSub, snap.ocNs > 0 && snap.ocMin >= 0 ? String("แจ้งเหตุ ") + snap.ocNs + " ราย · ค้างนานสุด " + snap.ocMin + " นาที" : String("ไม่แน่ใจ ") + snap.ocN + " ราย · ยังไม่มีแบบตรงรูปแบบ");
  setT(oWho, "ล่าสุด " + snap.ocAt + (snap.ocS.length() ? " · " + snap.ocS : String("")));
  setT(oTxt, snap.ocX.length() ? snap.ocX : String("-"));
  if (snap.ocUrl != oQrUrl) { oQrUrl = snap.ocUrl;
    if (oQrUrl.length()) { lv_obj_clear_flag(oQr, LV_OBJ_FLAG_HIDDEN); lv_qrcode_update(oQr, oQrUrl.c_str(), oQrUrl.length()); }
    else { lv_obj_add_flag(oQr, LV_OBJ_FLAG_HIDDEN); setT(oCap, "ไม่มีลิงก์แอป"); } }
  if (oRemind) { bool f = (millis() / 700) % 2; lv_obj_set_style_bg_color(oScr, lv_color_hex(f ? C_ORG2 : C_ORG), 0); }
}

// ---------- หน้าปลุก ----------
lv_obj_t *aScr, *aTimer; lv_timer_t* aFlash = nullptr; bool aFlip = false;
void doAck() { if (scr == S_ALARM) showWho(); }
void showAlarm() {
  scr = S_ALARM; alarmStart = millis(); lightAt = ""; alarmBaseBright = roomBright;
  lv_obj_t* s = mkScr(C_RED); aScr = s;
  lbl(s, LV_SYMBOL_BELL " มีเรื่องแจ้งไฟดับ", &font_th26, 0xFFFFFF, 10, 6);
  lv_obj_t* tb = box(s, 246, 8, 66, 30, 0x5A0E0E, 8);
  aTimer = lbl(tb, "0:00", &font_th20, 0xFFFFFF, 0, 0); lv_obj_center(aTimer);
  lv_obj_t* jb = box(s, 8, 44, 304, 90, 0x6E1111, 10);
  const Job* j = findJob(alarmId);
  String place = alarmSim ? String("งานจำลอง") : (j && j->place.length() ? j->place : alarmText);
  String type = alarmSim ? String("ไฟดับทั้งซอย · ไม่ใช่งานจริง") : (j ? j->type : String(""));
  lbl(jb, place, &font_th26, 0xFFFFFF, 10, 2, 284);
  lbl(jb, type.length() ? type : String(" "), &font_th20, 0xFDE2E2, 10, 37, 284);
  lbl(jb, alarmSim ? String("โหมดจำลอง · ไม่ส่งเข้าระบบ") : String("งาน " + alarmId + (j ? String(" · แจ้ง " + j->t) : String(""))), &font_th16, 0xFDE2E2, 10, 63, 284);
  lv_obj_t* b = btn(s, LV_SYMBOL_OK " แตะเพื่อรับทราบ", &font_th26, C_GREEN, 8, 140, 304, 70, [](lv_event_t*) { doAck(); });
  lv_obj_set_style_border_width(b, 3, 0); lv_obj_set_style_border_color(b, lv_color_hex(0xFFFFFF), 0);
  lbl(s, "แตะตรงไหนก็ได้ หรือกดปุ่ม BOOT", &font_th16, 0xFDE2E2, 10, 213);
  lv_obj_add_flag(s, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(s, [](lv_event_t*) { doAck(); }, LV_EVENT_CLICKED, nullptr);
  loadScr(s);
  if (aFlash) lv_timer_del(aFlash);
  aFlash = lv_timer_create([](lv_timer_t*) {
    if (scr != S_ALARM) { lv_timer_del(aFlash); aFlash = nullptr; return; }
    aFlip = !aFlip; lv_obj_set_style_bg_color(aScr, lv_color_hex(aFlip ? C_RED2 : C_RED), 0);
  }, 500, nullptr);
}
void paintAlarm() {
  uint32_t sec = (millis() - alarmStart) / 1000 + alarmMin0 * 60;
  char b[12]; snprintf(b, sizeof b, "%u:%02u", unsigned(sec / 60), unsigned(sec % 60)); setT(aTimer, b);
}

// ---------- เลือกว่าใครรับ ----------
lv_obj_t* wCount; uint32_t whoStart = 0; String whoNames[4]; int whoN = 0;
void chooseWho(const String& name) {
  ackBy = name.length() ? name : String("ไม่ระบุชื่อ"); ackAt = hhmm();
  lastAckedId = alarmId; lastAckMs = millis();
  if (!alarmSim) { reqAckBy = name; reqAck = true; }
  String head = ackBy + " รับทราบ " + ackAt;
  showDetail(alarmId, head, C_GREEN2);
}
void showWho() {
  scr = S_WHO; whoStart = millis();
  whoN = 0; for (int i = 0; i < snap.nDuty && whoN < 4; i++) whoNames[whoN++] = snap.duty[i];
  if (alarmSim && !whoN) { whoNames[0] = "ทดสอบ"; whoN = 1; }
  lv_obj_t* s = mkScr();
  lbl(s, "ใครรับเรื่องนี้?", &font_th26, C_TEXT, 10, 4);
  wCount = lbl(s, "", &font_th16, C_MUTED, 10, 36, 300);
  int cols = whoN > 2 ? 2 : (whoN ? whoN : 1), rows = whoN > 2 ? 2 : 1;
  int bw = (304 - (cols - 1) * 8) / cols, bh = rows == 2 ? 64 : 120;
  for (int i = 0; i < whoN; i++) {
    lv_obj_t* b = btn(s, whoNames[i], &font_th34, C_PURPLE, 8 + (i % cols) * (bw + 8), 62 + (i / cols) * (bh + 8), bw, bh,
                      [](lv_event_t* e) { chooseWho(whoNames[(int)(intptr_t)lv_event_get_user_data(e)]); }, (void*)(intptr_t)i);
    (void)b;
  }
  btn(s, "ไม่ระบุชื่อ", &font_th20, C_CARD, 8, 196, 304, 38, [](lv_event_t*) { chooseWho(""); });
  loadScr(s);
}
void paintWho() {
  int left = 15 - int((millis() - whoStart) / 1000);
  if (left <= 0) { chooseWho(whoN ? whoNames[0] : String("")); return; }
  setT(wCount, String("งาน ") + alarmId + " · ไม่เลือกใน " + left + " วิ = " + (whoN ? whoNames[0] : String("ไม่ระบุชื่อ")));
}

// ---------- รายละเอียดงาน + QR ----------
lv_obj_t *qr, *qrCap; String qrApp, qrTel; bool qrShowTel = false;
void paintQr() {
  String v = qrShowTel ? qrTel : qrApp;
  if (!v.length()) v = qrShowTel ? qrApp : qrTel;
  if (!v.length()) { lv_obj_add_flag(qr, LV_OBJ_FLAG_HIDDEN); setT(qrCap, "ไม่มีลิงก์งาน"); return; }
  lv_qrcode_update(qr, v.c_str(), v.length());
  bool tel = v.startsWith("tel:");
  if (!qrTel.length() || !qrApp.length()) { setT(qrCap, tel ? String("สแกน = โทรออก") : String("สแกน = เปิดงาน")); return; }
  setT(qrCap, tel ? String("สแกน = โทรออก\nแตะ = ลิงก์แอป") : String("สแกน = เปิดงาน\nแตะ = เบอร์โทร"));
}
void showDetail(const String& id, const String& head, uint32_t headCol) {
  scr = S_DETAIL;
  lv_obj_t* s = mkScr();
  lv_obj_t* hb = box(s, 0, 0, 320, 34, headCol, 0);
  lbl(hb, head, &font_th20, 0xFFFFFF, 10, 4, 300);
  const Job* j = findJob(id);
  String place = j && j->place.length() ? j->place : (id == alarmId ? alarmText : String(""));
  bool sim = alarmSim && id == alarmId;
  lbl(s, sim ? String("งานจำลอง") : String(id + " " + place), &font_th20, C_TEXT, 8, 38, 196);
  lbl(s, sim ? String("ไฟดับทั้งซอย · ไม่ใช่งานจริง") : (j ? j->type : String("")), &font_th16, C_MUTED, 8, 62, 196);
  lv_obj_t* tl = box(s, 8, 84, 196, 108, C_CARD, 8);
  int y = 4;
  auto line = [&](const String& t, const String& txt, uint32_t col) { lbl(tl, t, &font_th16, C_MUTED, 8, y, 50); lbl(tl, txt, &font_th16, col, 62, y, 128); y += 20; };
  if (j) line(j->t, "รับแจ้ง", C_TEXT);
  if (id == alarmId && lightAt.length()) line(lightAt, "ไฟห้องเปิด", C_AMBER);
  if (id == alarmId && ackAt.length()) line(ackAt, "รับทราบ (กล่อง)", 0x86EFAC);
  if (j && j->by.length()) line(String(j->st == "done" ? "เสร็จ" : "รับ"), j->by, C_TEXT);
  if (j) line("สถานะ", j->st == "new" ? String("ยังไม่กดรับงาน") : j->st == "acc" ? String("รับงานแล้ว") : j->st == "done" ? String("แก้เสร็จ") : j->st, C_TEXT);
  qrApp = snap.app; qrTel = j && j->ph.length() ? "tel:" + j->ph : String(""); qrShowTel = false;
  qr = lv_qrcode_create(s, 92, lv_color_hex(0x000000), lv_color_hex(0xFFFFFF));
  lv_obj_set_pos(qr, 212, 40);
  lv_obj_set_style_border_color(qr, lv_color_hex(0xFFFFFF), 0); lv_obj_set_style_border_width(qr, 4, 0);
  lv_obj_add_flag(qr, LV_OBJ_FLAG_CLICKABLE);
  lv_obj_add_event_cb(qr, [](lv_event_t*) { qrShowTel = !qrShowTel; paintQr(); }, LV_EVENT_CLICKED, nullptr);
  qrCap = lv_label_create(s); lv_obj_set_style_text_font(qrCap, &font_th16, 0); lv_obj_set_style_text_color(qrCap, lv_color_hex(C_MUTED), 0);
  lv_obj_set_pos(qrCap, 206, 142); lv_obj_set_width(qrCap, 112); lv_label_set_long_mode(qrCap, LV_LABEL_LONG_CLIP); lv_obj_set_height(qrCap, 2 * lv_font_get_line_height(&font_th16));
  paintQr();
  btn(s, "หน้าหลัก", &font_th20, C_CARD, 8, 198, 148, 38, [](lv_event_t*) { showHome(); });
  btn(s, "งานทั้งหมด", &font_th20, C_CARD2, 164, 198, 148, 38, [](lv_event_t*) { showJobs(); });
  loadScr(s);
}

// ---------- รายการงาน ----------
void showJobs() {
  scr = S_JOBS;
  lv_obj_t* s = mkScr();
  lbl(s, "งานล่าสุด (12 ชม.)", &font_th26, C_TEXT, 8, 2);
  lbl(s, "ค้าง " + String(snap.open), &font_th20, C_AMBER, 236, 8);
  lv_obj_t* lst = lv_obj_create(s);
  lv_obj_set_pos(lst, 0, 36); lv_obj_set_size(lst, 320, 158);
  lv_obj_set_style_bg_opa(lst, LV_OPA_TRANSP, 0); lv_obj_set_style_border_width(lst, 0, 0); lv_obj_set_style_pad_all(lst, 6, 0);
  lv_obj_set_flex_flow(lst, LV_FLEX_FLOW_COLUMN); lv_obj_set_style_pad_row(lst, 6, 0);
  if (!snap.nJobs) lbl(lst, online() ? "ไม่มีงานในช่วงนี้" : "ยังไม่ได้ข้อมูลจากระบบ", &font_th20, C_MUTED, 0, 0);
  for (int i = 0; i < snap.nJobs; i++) {
    const Job& j = snap.jobs[i];
    bool live = j.st == "new" || j.st == "acc";
    lv_obj_t* r = lv_btn_create(lst);
    lv_obj_set_size(r, 306, 54);
    lv_obj_set_style_bg_color(r, lv_color_hex(live ? C_CARD : 0x1A1622), 0); lv_obj_set_style_radius(r, 8, 0); lv_obj_set_style_shadow_width(r, 0, 0);
    lv_obj_set_style_pad_all(r, 0, 0);
    box(r, 8, 18, 10, 10, j.st == "new" ? C_RED : j.st == "acc" ? C_AMBER : C_OK, 5);
    lbl(r, j.id + " " + (j.place.length() ? j.place : j.type), &font_th20, C_TEXT, 26, 2, 274);
    lbl(r, j.t + " · " + (j.st == "new" ? String("ยังไม่มีคนรับ") : j.st == "acc" ? String("รับแล้ว " + j.by) : j.st == "done" ? String("เสร็จ " + j.by) : j.st), &font_th16, C_MUTED, 26, 26, 274);
    lv_obj_add_event_cb(r, [](lv_event_t* e) {
      int k = (int)(intptr_t)lv_event_get_user_data(e);
      if (k < snap.nJobs) showDetail(snap.jobs[k].id, "งาน " + snap.jobs[k].id, C_PURPLE);
    }, LV_EVENT_CLICKED, (void*)(intptr_t)i);
  }
  btn(s, "กลับหน้าหลัก", &font_th20, C_CARD, 8, 198, 304, 38, [](lv_event_t*) { showHome(); });
  loadScr(s);
}

// ---------- ตั้งค่า ----------
lv_obj_t* sLdr;
void showSettings() {
  scr = S_SET;
  lv_obj_t* s = mkScr();
  lbl(s, "ตั้งค่า", &font_th26, C_TEXT, 8, 2);
  btn(s, LV_SYMBOL_LEFT " กลับ", &font_th20, C_CARD2, 220, 4, 92, 32, [](lv_event_t*) { showHome(); });
  lv_obj_t* c = lv_obj_create(s);
  lv_obj_set_pos(c, 0, 40); lv_obj_set_size(c, 320, 200);
  lv_obj_set_style_bg_opa(c, LV_OPA_TRANSP, 0); lv_obj_set_style_border_width(c, 0, 0); lv_obj_set_style_pad_all(c, 6, 0);
  lv_obj_set_flex_flow(c, LV_FLEX_FLOW_COLUMN); lv_obj_set_style_pad_row(c, 6, 0);
  auto row = [&](const String& t) { lv_obj_t* l = lv_label_create(c); lv_obj_set_width(l, 306); lv_obj_set_style_text_font(l, &font_th16, 0); lv_obj_set_style_text_color(l, lv_color_hex(C_MUTED), 0); setT(l, t); return l; };
  auto rb = [&](const String& t, lv_event_cb_t cb) { lv_obj_t* b = btn(c, t, &font_th20, C_CARD, 0, 0, 306, 38, cb); return b; };
  row("Wi-Fi: " + (WiFi.status() == WL_CONNECTED ? String(WiFi.SSID() + " · สัญญาณ " + String(WiFi.RSSI())) : String("ยังไม่เชื่อมต่อ")) + " · จำไว้ " + String(cfg.wN) + " วง");
  rb("Wi-Fi ที่จำไว้", [](lv_event_t*) { showWifiList(); });
  row(String("กุญแจกล่อง: ") + (cfg.key.length() > 4 ? String("••••" + cfg.key.substring(cfg.key.length() - 4)) : String("ยังไม่ได้ใส่")));
  rb("ใส่กุญแจกล่องใหม่", [](lv_event_t*) { showKey(); });
  sLdr = row("");
  rb("ตอนนี้ห้องสว่าง (จำค่า)", [](lv_event_t*) { cfg.lb = int(ldrAvg); saveCfg(); });
  rb("ตอนนี้ห้องมืด (จำค่า)", [](lv_event_t*) { cfg.ld = int(ldrAvg); saveCfg(); });
  rb("จำลองเรื่องเข้า", [](lv_event_t*) { alarmSim = true; alarmId = "ทดลอง"; alarmText = "จำลอง: ไฟดับทั้งซอย (ไม่ใช่งานจริง)"; alarmMin0 = 0; showAlarm(); });
  rb("ตั้งการแตะจอใหม่", [](lv_event_t*) { cfg.cok = false; saveCfg(); showCali(); });
  rb("ตั้งสีจอใหม่ (เครื่องจะเริ่มใหม่)", [](lv_event_t*) { cfg.pok = false; saveCfg(); delay(200); ESP.restart(); });
  row(String("เวอร์ชัน ") + FW_VER + " · ESP32-2432S028");
  loadScr(s);
}
void paintSettings() {
  setT(sLdr, "เซนเซอร์แสง: ค่า " + String(int(ldrAvg)) + " → " + (roomBright ? "สว่าง" : "มืด") + " (จำไว้: สว่าง " + cfg.lb + " / มืด " + cfg.ld + ")\nวนหน้า: อากาศ " + (snap.wxOk ? "มี" : "ไม่มี") + " · ตลาด " + String(snap.mkCount) + " ตัว · เวลา " + String(snap.rot[0]) + "/" + String(snap.rot[1]) + "/" + String(snap.rot[2]) + " วิ");
}

// ---------- หน้าสลับ: สภาพอากาศ / ตลาด ----------
// สีตามระดับสภาพอากาศ 1–6 (พื้น, ตัวหนังสือ)
const uint32_t WX_BG[7] = {0x221D2D, 0x14321F, 0x12304A, 0x3A2E12, 0x4A2A0E, 0x5A1E10, 0xB91C1C};
const uint32_t WX_FG[7] = {0xC9BFD3, 0x86EFAC, 0x93C5FD, 0xFCD34D, 0xFDBA74, 0xFCA5A5, 0xFFFFFF};
void pageDots(lv_obj_t* s, int k) {
  for (int i = 0; i < 3; i++) box(s, 278 + i * 12, 10, 8, 8, i == k ? C_TEXT : 0x4A4458, 4);
}
void backHome(lv_event_t*) { showHome(); }
void showWx() {
  scr = S_WX; pageAt = millis();
  lv_obj_t* s = mkScr();
  lv_obj_add_flag(s, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s, backHome, LV_EVENT_CLICKED, nullptr);
  lbl(s, "อากาศ อ่าวลึก · " + snap.wxAt, &font_th16, C_MUTED, 8, 2, 260);
  pageDots(s, 1);
  lv_obj_t* t = lbl(s, String(snap.wxT), &font_clock56, C_TEXT, 8, 30);
  lv_obj_update_layout(t);
  lbl(s, "°C", &font_th26, C_TEXT, 10 + lv_obj_get_width(t), 26);
  lbl(s, snap.wxCond, &font_th20, C_TEXT, 132, 28, 182);
  lbl(s, "ชื้น " + String(snap.wxRh) + "% · ลม " + String(snap.wxGust) + " กม./ชม.", &font_th16, C_MUTED, 132, 56, 182);
  int lv = snap.wxLv < 0 ? 0 : snap.wxLv > 6 ? 6 : snap.wxLv;
  lv_obj_t* b = box(s, 8, 84, 304, 36, WX_BG[lv], 8);
  lbl(b, "ระดับ " + String(lv) + " · " + snap.wxLabel, &font_th20, WX_FG[lv], 10, 2, 284);
  int n = snap.wxN, cw = n ? (304 - (n - 1) * 4) / n : 0;
  for (int i = 0; i < n; i++) {
    lv_obj_t* c = box(s, 8 + i * (cw + 4), 126, cw, 78, C_CARD, 8);
    lv_obj_t* h = lbl(c, snap.wxH[i] + " น.", &font_th16, C_MUTED, 0, 6); lv_obj_set_width(h, cw); lv_obj_set_style_text_align(h, LV_TEXT_ALIGN_CENTER, 0);
    int pp = snap.wxP[i];
    lv_obj_t* v = lbl(c, pp < 0 ? String("–") : String(pp) + "%", &font_th20, pp >= 70 ? 0x60A5FA : pp >= 40 ? 0x93C5FD : C_MUTED, 0, 36);
    lv_obj_set_width(v, cw); lv_obj_set_style_text_align(v, LV_TEXT_ALIGN_CENTER, 0);
  }
  lbl(s, "โอกาสฝนรายชั่วโมง · แตะจอ = กลับหน้าเวร", &font_th16, 0xA79DB3, 8, 210, 304);
  loadScr(s);
}
void showMk() {
  scr = S_MK; pageAt = millis();
  lv_obj_t* s = mkScr();
  lv_obj_add_flag(s, LV_OBJ_FLAG_CLICKABLE); lv_obj_add_event_cb(s, backHome, LV_EVENT_CLICKED, nullptr);
  lbl(s, "ตลาด · เทียบราคาเปิดวันนี้ · " + snap.mkAt, &font_th16, C_MUTED, 8, 2, 262);
  pageDots(s, 2);
  for (int i = 0; i < snap.mkCount; i++) {
    lv_obj_t* r = box(s, 6, 30 + i * 52, 308, 49, C_CARD, 8);
    lv_obj_clear_flag(r, LV_OBJ_FLAG_CLICKABLE);
    lbl(r, snap.mkN[i], &font_th20, C_TEXT, 10, -3, 140);
    lbl(r, snap.mkO[i].length() ? "เปิด " + snap.mkO[i] : String("ยังไม่มีราคาเปิด"), &font_th16, 0xA79DB3, 10, 23, 140);
    lv_obj_t* pl = lbl(r, snap.mkP[i], &font_th20, C_TEXT, 150, -3, 148); lv_obj_set_style_text_align(pl, LV_TEXT_ALIGN_RIGHT, 0);
    int u = snap.mkU[i];
    String dt = snap.mkD[i].length() ? String(u > 0 ? "▲ " : u < 0 ? "▼ " : "● ") + snap.mkD[i] : String("");
    lv_obj_t* dl = lbl(r, dt, &font_th16, u > 0 ? 0x4ADE80 : u < 0 ? 0xF87171 : C_MUTED, 150, 23, 148); lv_obj_set_style_text_align(dl, LV_TEXT_ALIGN_RIGHT, 0);
  }
  loadScr(s);
}
// วนหน้า: หน้าเวร 20 วิ → อากาศ 10 วิ → ตลาด 5 วิ (เวลาตั้งได้จากระบบ: Config boxRot · ข้ามหน้าที่ไม่มีข้อมูล)
void rotateTick() {
  if (scr != S_HOME && scr != S_WX && scr != S_MK && scr != S_OUT) return;
  struct tm tt; bool nightHr = getLocalTime(&tt, 5) && tt.tm_year >= 124 && (tt.tm_hour >= 19 || tt.tm_hour < 6);
  if (!roomBright && nightHr) { if (scr != S_HOME) showHome(); return; }        // กลางคืนและห้องมืด → ค้างหน้าเวร (กลางวันวนเสมอ แม้เซนเซอร์แสงอ่านว่ามืด)
  if (lv_disp_get_inactive_time(NULL) < 60000 && scr == S_HOME) { pageAt = millis(); return; }   // เพิ่งแตะ → หยุดวน 1 นาที
  if (snap.ocNs > 0) { if (scr != S_HOME) showHome(); return; }                  // มีข้อความแจ้งเหตุรอตรวจ → ค้างหน้าเวร (เห็นแถบส้ม)
  uint32_t dur = 1000UL * (scr == S_HOME ? max(5, snap.rot[0]) : scr == S_OUT ? 12 : scr == S_WX ? snap.rot[1] : snap.rot[2]);
  if (millis() - pageAt < dur) return;
  if (scr == S_HOME && snap.outN > 0) showOut();                                  // วน: เวร → ไฟดับอยู่ (ถ้ามี) → อากาศ → ตลาด
  else if ((scr == S_HOME || scr == S_OUT) && snap.wxOk && snap.rot[1] > 0) showWx();
  else if ((scr == S_HOME || scr == S_OUT || scr == S_WX) && snap.mkCount && snap.rot[2] > 0) showMk();
  else showHome();
}

// ---------- Wi-Fi ที่จำไว้ ----------
int wDel = -1;
void showWifiList() {
  scr = S_WLIST;
  lv_obj_t* s = mkScr();
  lbl(s, "Wi-Fi ที่จำไว้", &font_th26, C_TEXT, 8, 2);
  btn(s, "+ เพิ่ม", &font_th20, C_CARD2, 196, 4, 60, 32, [](lv_event_t*) { showWifi(); });
  btn(s, LV_SYMBOL_LEFT, &font_th20, C_CARD2, 262, 4, 50, 32, [](lv_event_t*) { showSettings(); });
  String cur = WiFi.status() == WL_CONNECTED ? WiFi.SSID() : String("");
  for (int i = 0; i < cfg.wN; i++) {
    bool on = cfg.wS[i] == cur;
    lv_obj_t* r = btn(s, "", &font_th16, on ? 0x14321F : C_CARD, 8, 42 + i * 38, 304, 34,
                      [](lv_event_t* e) { wDel = (int)(intptr_t)lv_event_get_user_data(e); showWifiList(); }, (void*)(intptr_t)i);
    lv_obj_set_style_pad_all(r, 0, 0);
    lbl(r, cfg.wS[i], &font_th20, C_TEXT, 10, 2, 190);
    lbl(r, on ? String("เชื่อมอยู่") : String("จำไว้"), &font_th16, on ? 0x86EFAC : C_MUTED, 210, 6, 86);
  }
  if (wDel >= 0 && wDel < cfg.wN) {
    lv_obj_t* m = box(s, 20, 70, 280, 110, 0x2E2640, 12);
    lbl(m, "ลบ " + cfg.wS[wDel] + " ?", &font_th20, C_TEXT, 12, 8, 256);
    btn(m, "ลบ", &font_th20, C_RED, 12, 56, 120, 40, [](lv_event_t*) { delWifi(wDel); wDel = -1; wifiChanged = true; showWifiList(); });
    btn(m, "ยกเลิก", &font_th20, C_CARD, 148, 56, 120, 40, [](lv_event_t*) { wDel = -1; showWifiList(); });
  } else {
    lbl(s, "จำได้ 5 วง · ต่อวงที่แรงสุดเอง · แตะชื่อ = ลบ", &font_th16, 0xA79DB3, 8, 214, 304);
  }
  loadScr(s);
}

// ---------- ตั้งค่าครั้งแรก ----------
lv_obj_t* kbTa;
lv_obj_t* kbScreen(const String& title, const String& hint, const String& init, lv_event_cb_t onOk) {
  lv_obj_t* s = mkScr();
  lbl(s, title, &font_th16, C_TEXT, 6, 0, 308);
  (void)hint;
  kbTa = lv_textarea_create(s);
  lv_obj_set_pos(kbTa, 4, 26); lv_obj_set_size(kbTa, 312, 36); lv_textarea_set_placeholder_text(kbTa, thai::shape(hint).c_str());
  lv_textarea_set_one_line(kbTa, true); lv_obj_set_style_text_font(kbTa, &font_th20, 0);
  lv_textarea_set_text(kbTa, init.c_str());
  lv_obj_t* kb = lv_keyboard_create(s);
  lv_obj_set_size(kb, 320, 176); lv_obj_set_style_pad_all(kb, 2, 0); lv_obj_set_style_pad_gap(kb, 3, 0); lv_obj_align(kb, LV_ALIGN_BOTTOM_MID, 0, 0);
  lv_obj_set_style_text_font(kb, &font_th20, 0);
  lv_keyboard_set_textarea(kb, kbTa);
  lv_obj_add_event_cb(kb, onOk, LV_EVENT_READY, nullptr);
  lv_obj_add_event_cb(kb, [](lv_event_t*) { nextSetup(); }, LV_EVENT_CANCEL, nullptr);
  return s;
}
String pickSsid;
void showPass(const String& ssid) {
  scr = S_PASS; pickSsid = ssid;
  loadScr(kbScreen("รหัส Wi-Fi: " + ssid, "พิมพ์รหัส แล้วกด ✓ มุมขวาล่าง", "", [](lv_event_t*) {
    addWifi(pickSsid, lv_textarea_get_text(kbTa)); wifiChanged = true; nextSetup();
  }));
}
void showKey() {
  scr = S_KEY;
  loadScr(kbScreen("กุญแจกล่อง (16 ตัว)", "ดูในแอป → ตั้งค่า → กระดิ่งหน้าห้องเวร", cfg.key, [](lv_event_t*) {
    String k = lv_textarea_get_text(kbTa); k.trim(); cfg.key = k; saveCfg(); reqPoll = true; nextSetup();
  }));
}
lv_obj_t* wList; String wNames[12]; int wN = 0;
void wifiScanFill(lv_timer_t* t) {
  if (t) lv_timer_del(t);
  if (scr != S_WIFI) return;
  int n = WiFi.scanNetworks(); wN = 0;
  lv_obj_clean(wList);
  for (int i = 0; i < n && wN < 12; i++) {
    String id = WiFi.SSID(i); if (!id.length()) continue;
    bool dup = false; for (int k = 0; k < wN; k++) if (wNames[k] == id) dup = true;
    if (dup) continue;
    wNames[wN] = id;
    lv_obj_t* b = btn(wList, id + "  (" + WiFi.RSSI(i) + ")", &font_th20, C_CARD, 0, 0, 300, 38,
                      [](lv_event_t* e) { showPass(wNames[(int)(intptr_t)lv_event_get_user_data(e)]); }, (void*)(intptr_t)wN);
    (void)b; wN++;
  }
  if (!wN) lbl(wList, "ไม่พบ Wi-Fi — กดค้นหาใหม่", &font_th20, C_MUTED, 0, 0);
  WiFi.scanDelete();
}
void showWifi() {
  scr = S_WIFI;
  lv_obj_t* s = mkScr();
  lbl(s, "เลือก Wi-Fi", &font_th26, C_TEXT, 8, 2);
  btn(s, "ค้นหาใหม่", &font_th16, C_CARD2, 222, 6, 90, 30, [](lv_event_t*) { lv_obj_clean(wList); lbl(wList, "กำลังค้นหา…", &font_th20, C_MUTED, 0, 0); lv_timer_create(wifiScanFill, 150, nullptr); });
  wList = lv_obj_create(s);
  lv_obj_set_pos(wList, 0, 40); lv_obj_set_size(wList, 320, 200);
  lv_obj_set_style_bg_opa(wList, LV_OPA_TRANSP, 0); lv_obj_set_style_border_width(wList, 0, 0); lv_obj_set_style_pad_all(wList, 6, 0);
  lv_obj_set_flex_flow(wList, LV_FLEX_FLOW_COLUMN); lv_obj_set_style_pad_row(wList, 6, 0);
  lbl(wList, "กำลังค้นหา…", &font_th20, C_MUTED, 0, 0);
  loadScr(s);
  WiFi.disconnect(); WiFi.mode(WIFI_STA);
  lv_timer_create(wifiScanFill, 150, nullptr);
}
uint32_t colorShownAt = 0;
void showColor() {
  scr = S_COLOR; colorShownAt = millis();
  lv_obj_t* s = mkScr(0x000000);
  lbl(s, "ตรวจสีจอ", &font_th26, 0xFFFFFF, 10, 4);
  lbl(s, String(cfg.pidx == 1 ? "กลับสี: เปิด" : "กลับสี: ปิด"), &font_th16, 0xFFFFFF, 214, 10);
  const uint32_t cs[3] = {0xFF0000, 0x00FF00, 0x0000FF}; const char* nm[3] = {"แดง", "เขียว", "น้ำเงิน"};
  for (int i = 0; i < 3; i++) { lv_obj_t* b = box(s, 10 + i * 102, 44, 96, 80, cs[i], 8); lv_obj_t* l = lbl(b, nm[i], &font_th26, 0xFFFFFF, 0, 0); lv_obj_center(l); }
  lbl(s, "สีตรงกับชื่อหรือไม่?", &font_th20, 0xFFFFFF, 10, 134);
  lbl(s, "ตรง → แตะจอ หรือ BOOT ค้าง 2 วิ", &font_th20, 0x00FF00, 10, 166);
  lbl(s, "ไม่ตรง → กด BOOT สั้น ๆ (กลับสี)", &font_th20, 0xFFFF00, 10, 200);
  loadScr(s);
}
bool caliArmed = false; uint32_t caliShownAt = 0;
void showCali() {
  scr = S_CALI; caliArmed = false; caliShownAt = millis();
  lv_obj_t* s = mkScr();
  lbl(s, "ตั้งการแตะจอ", &font_th26, C_TEXT, 10, 6);
  lbl(s, "จะมีลูกศรขึ้นที่มุมจอทีละมุม", &font_th20, C_TEXT, 10, 46);
  lbl(s, "ใช้ปลายเล็บแตะที่ปลายลูกศร", &font_th20, C_TEXT, 10, 76);
  lbl(s, "ครบ 4 มุมแล้วจะไปหน้าถัดไปเอง", &font_th20, C_TEXT, 10, 106);
  lbl(s, "แตะจอเพื่อเริ่ม", &font_th26, C_AMBER, 10, 150);
  lbl(s, "(หรือกดปุ่ม BOOT)", &font_th20, C_MUTED, 10, 192);
  loadScr(s);
}
void runCalibration() {
  lv_refr_now(NULL);
  lcd.fillScreen(TFT_BLACK);
  lcd.calibrateTouch(cfg.cal, TFT_WHITE, TFT_BLACK, 24);
  lcd.setTouchCalibrate(cfg.cal);
  cfg.cok = true; saveCfg();
  lv_obj_invalidate(lv_scr_act());
  nextSetup();
}
void nextSetup() {
  if (!cfg.pok) return showColor();
  if (!cfg.cok) return showCali();
  if (!cfg.wN) return showWifi();
  if (!cfg.key.length()) return showKey();
  showHome();
}

// ---------- เริ่มเครื่อง ----------
void initDisplay() {
  lcd.init();                                // LovyanGFX ตรวจรุ่นจอเอง (ST7789 / ILI9341)
  lcd.setRotation(1);
  if (cfg.pidx < 0) { cfg.pidx = 0; saveCfg(); }
  if (cfg.pidx == 1) lcd.invertDisplay(true);
  lcd.setBrightness(200);
  if (cfg.cok) lcd.setTouchCalibrate(cfg.cal);
  lcd.fillScreen(TFT_BLACK);
  Serial.printf("board %d  %dx%d\n", (int)lcd.getBoard(), lcd.width(), lcd.height());
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BOOT, INPUT_PULLUP);
  pinMode(PIN_R, OUTPUT); pinMode(PIN_G, OUTPUT); pinMode(PIN_B, OUTPUT); rgb(0, 0, 0);
  analogSetPinAttenuation(PIN_LDR, ADC_0db);
  loadCfg();
  initDisplay();

  lv_init();
  buf1 = (lv_color_t*)heap_caps_malloc(320 * 20 * sizeof(lv_color_t), MALLOC_CAP_DMA);
  buf2 = (lv_color_t*)heap_caps_malloc(320 * 20 * sizeof(lv_color_t), MALLOC_CAP_DMA);
  lv_disp_draw_buf_init(&drawBuf, buf1, buf2, 320 * 20);
  static lv_disp_drv_t dd; lv_disp_drv_init(&dd);
  dd.hor_res = 320; dd.ver_res = 240; dd.flush_cb = flushCb; dd.draw_buf = &drawBuf;
  lv_disp_drv_register(&dd);
  static lv_indev_drv_t id; lv_indev_drv_init(&id);
  id.type = LV_INDEV_TYPE_POINTER; id.read_cb = touchCb;
  lv_indev_drv_register(&id);

  mtx = xSemaphoreCreateMutex();
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true);
  xTaskCreatePinnedToCore(netTask, "net", 16384, nullptr, 1, nullptr, 0);
  nextSetup();
}

uint32_t lastPaint = 0, lastLdr = 0, lastLed = 0; int curBl = -1; uint32_t netSeenVer = 0;
void loop() {
  lv_timer_handler();
  uint32_t now = millis();
  int be = bootEvent();
  wifiPause = scr == S_WIFI || scr == S_PASS;

  // ตรวจสีจอ: BOOT = เปลี่ยนแบบ · แตะ = ยืนยัน
  if (scr == S_COLOR) {
    if (be == 1) { cfg.pidx = cfg.pidx == 1 ? 0 : 1; saveCfg(); lcd.invertDisplay(cfg.pidx == 1); showColor(); }
    uint16_t x, y;
    static uint32_t tDown = 0;
    bool t = lcd.getTouch(&x, &y);
    if (t && !tDown) tDown = now;
    bool tapped = !t && tDown && now - tDown > 60 && now - tDown < 1500; if (!t) tDown = 0;
    if (now - colorShownAt > 800 && (tapped || be == 2)) { cfg.pok = true; saveCfg(); nextSetup(); }
    delay(5); return;
  }
  if (scr == S_CALI) {
    uint16_t x, y; bool t = lcd.getTouch(&x, &y);
    if (be == 1) runCalibration();
    if (now - caliShownAt > 800) { if (t) caliArmed = true; else if (caliArmed) runCalibration(); }
    delay(5); return;
  }

  if (now - lastLdr > 200) { lastLdr = now; ldrTick(); }

  // รับข้อมูลใหม่จากงานเน็ต
  xSemaphoreTake(mtx, portMAX_DELAY);
  bool fresh = net.ver != netSeenVer;
  if (fresh) { netSeenVer = net.ver; snap = net; if (net.test) { net.test = false; testUntil = now + 3000; } }
  xSemaphoreGive(mtx);

  bool setupDone = cfg.pok && cfg.wN && cfg.key.length();
  bool inSetup = scr == S_WIFI || scr == S_PASS || scr == S_KEY;
  if (setupDone && !inSetup) {
    // เริ่มปลุกเมื่อระบบส่ง ring > 0 (ยกเว้นงานที่เพิ่งกดรับทราบไป)
    if (scr != S_ALARM && scr != S_WHO && snap.ring > 0 && online() &&
        !(snap.id == lastAckedId && now - lastAckMs < 180000)) {
      alarmSim = false; alarmId = snap.id; alarmText = snap.text; alarmMin0 = snap.min; ackAt = ""; showAlarm();
    }
    // ข้อความแจ้งเหตุจาก OpenChat ค้างเกินกำหนด → เด้งหน้าเตือนสีส้ม (ไม่มีเสียง)
    if ((scr == S_HOME || scr == S_WX || scr == S_MK || scr == S_OUT) && online() && snap.ocNs > 0 && snap.ocMin >= snap.ocRm && now >= ocSnoozeUntil) showOc(true);
    if (scr == S_OC && !oRemind && lv_disp_get_inactive_time(NULL) > 120000) showHome();
    // มีคนรับจาก LINE / แอป ระหว่างปลุก
    if (scr == S_ALARM && !alarmSim && fresh && snap.ring == 0 && snap.lastOk && now - alarmStart > 3000) {
      const Job* j = findJob(alarmId);
      lastAckedId = alarmId; lastAckMs = now;
      showDetail(alarmId, j && j->by.length() ? String("รับเรื่องแล้ว · " + j->by) : String("หยุดปลุกแล้ว (รับจาก LINE/แอป)"), C_GREEN2);
    }
  }
  // ไฟห้องเปิดระหว่างปลุก = มีคนตื่น
  if ((scr == S_ALARM || scr == S_WHO) && !alarmBaseBright && roomBright && !lightAt.length()) {
    lightAt = hhmm(); if (!alarmSim) reqLight = true;
  }

  // ปุ่ม BOOT
  if (be == 1 && scr == S_ALARM) doAck();
  else if (be == 1 && scr == S_WHO) chooseWho(whoN ? whoNames[0] : String(""));
  else if (be == 2 && (scr == S_WIFI || scr == S_PASS || scr == S_KEY)) showCali();   // แตะไม่ตรง → กด BOOT ค้าง = ตั้งการแตะใหม่
  else if (be == 2 && (scr == S_HOME || scr == S_JOBS || scr == S_DETAIL || scr == S_WX || scr == S_MK || scr == S_OUT)) {
    alarmSim = true; alarmId = "ทดลอง"; alarmText = "จำลอง: ไฟดับทั้งซอย (ไม่ใช่งานจริง)"; alarmMin0 = 0; showAlarm();
  }

  // กลับหน้าหลักเองเมื่อไม่มีใครแตะ 3 นาที
  if ((scr == S_DETAIL || scr == S_JOBS || scr == S_SET || scr == S_WLIST) && lv_disp_get_inactive_time(NULL) > IDLE_HOME_MS) showHome();
  if (be == 1 && scr == S_OC) ocSeen();
  if (setupDone) rotateTick();

  if (now - lastPaint > 250) {
    lastPaint = now;
    if (scr == S_HOME) paintHome();
    else if (scr == S_ALARM) paintAlarm();
    else if (scr == S_WHO) paintWho();
    else if (scr == S_SET) paintSettings();
    else if (scr == S_OC) paintOc();
    else if (scr == S_OUT && snap.outN == 0) showHome();
  }

  // ความสว่างจอ + ไฟ RGB
  bool alarm = scr == S_ALARM || scr == S_WHO || now < testUntil;
  int bl = alarm || (scr == S_OC && oRemind) ? 255 : (roomBright ? 190 : 22);
  if (lv_disp_get_inactive_time(NULL) < 15000 && !roomBright && !alarm) bl = 120;   // แตะจอตอนมืด = สว่างขึ้นชั่วคราว
  if (bl != curBl) { curBl = bl; lcd.setBrightness(bl); }
  if (now - lastLed > 100) {
    lastLed = now;
    if (alarm) { bool on = (now / 250) % 2; rgb(on ? 255 : 0, 0, 0); }
    else if (!setupDone) rgb(0, 0, (now / 1000) % 2 ? 40 : 0);
    else if (!online()) rgb(roomBright ? 120 : 20, roomBright ? 40 : 6, 0);
    else if (snap.ocNs > 0) { bool on = (now / 700) % 2; rgb(on ? 255 : 0, on ? 70 : 0, 0); }   // ส้มกะพริบ = มีข้อความแจ้งเหตุรอตรวจ
    else rgb(0, roomBright ? 40 : 4, 0);
  }
  delay(5);
}
