/*
 * กระดิ่งปลุกเวรแก้ไฟ กฟส.อ่าวลึก — กล่อง ESP32 หน้าห้องเวร
 * ถามระบบตารางเวรทุก 10 วินาที ผ่าน Wi-Fi → สั่งรีเลย์ (กระดิ่งไฟฟ้า) + ไฟ LED
 *   ring 0 = เงียบ · 1 = ดังเป็นจังหวะ (3 วิ ดัง / 2 วิ หยุด) · 2 = ดังยาว · 3 = ทดสอบ (ดัง 3 วิ ครั้งเดียว)
 * ปุ่มใหญ่ "รับทราบ" → แจ้งระบบ หยุดกระดิ่งทันที · ปุ่มเล็ก "ทดสอบ" → ดัง 1 วิ (ทดสอบในเครื่อง ไม่ต้องใช้เน็ต)
 *
 * บอร์ด: ESP32 DevKit (Arduino IDE → Board: "ESP32 Dev Module")
 * ต่อสาย:
 *   GPIO26 → IN ของโมดูลรีเลย์ 1 ช่อง (รีเลย์ต่อกระดิ่ง 220V — ให้ช่างไฟต่อฝั่ง 220V)
 *   GPIO27 → ปุ่มรับทราบ (อีกขา → GND)       GPIO14 → ปุ่มทดสอบ (อีกขา → GND)
 *   GPIO2  → LED บนบอร์ด (ไฟสถานะ)            GPIO25 → LED แดง/ไฟกระพริบ (ผ่านตัวต้านทาน 220Ω → GND) ถ้ามี
 * ใส่ค่า 4 บรรทัดด้านล่าง (BELL_URL / BELL_KEY ดูได้ที่แอป → ตั้งค่า → กระดิ่งหน้าห้องเวร → ⚙ ติดตั้งกล่อง)
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "ชื่อ Wi-Fi";
const char* WIFI_PASS = "รหัส Wi-Fi";
const char* BELL_URL  = "https://script.google.com/macros/s/....../exec";
const char* BELL_KEY  = "xxxxxxxxxxxxxxxx";

const int PIN_RELAY = 26, PIN_ACK = 27, PIN_TEST = 14, PIN_LED = 2, PIN_RED = 25;
const bool RELAY_ACTIVE_HIGH = true;        // โมดูลรีเลย์บางรุ่นทำงานเมื่อ LOW → เปลี่ยนเป็น false
const unsigned long POLL_MS = 10000, ON_MS = 3000, OFF_MS = 2000;

int mode = 0;                                // ค่าจากระบบ
unsigned long lastPoll = 0, patT = 0, testUntil = 0;
bool patOn = false;

void relay(bool on) { digitalWrite(PIN_RELAY, (on == RELAY_ACTIVE_HIGH) ? HIGH : LOW); digitalWrite(PIN_RED, on ? HIGH : LOW); }

String get(const String& q) {
  WiFiClientSecure c; c.setInsecure();
  HTTPClient h; h.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); h.setTimeout(15000);
  String url = String(BELL_URL) + "?action=bell&k=" + BELL_KEY + q;
  if (!h.begin(c, url)) return "";
  int code = h.GET(); String body = code == 200 ? h.getString() : "";
  h.end(); return body;
}
int ringOf(const String& b) { int i = b.indexOf("\"ring\":"); return i < 0 ? -1 : b.substring(i + 7, i + 8).toInt(); }

void poll() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); return; }
  String b = get(""); int r = ringOf(b);
  if (r < 0) return;                         // ติดต่อไม่ได้ → คงสถานะเดิมไว้
  if (r == 3) { testUntil = millis() + 3000; r = 0; }
  if (r != mode) { mode = r; patT = millis(); patOn = true; }
}
void ack() {
  relay(false); mode = 0; testUntil = 0;
  for (int i = 0; i < 3; i++) { digitalWrite(PIN_LED, HIGH); delay(80); digitalWrite(PIN_LED, LOW); delay(80); }
  if (WiFi.status() == WL_CONNECTED) get("&ack=1");
  lastPoll = millis();
}

void setup() {
  pinMode(PIN_RELAY, OUTPUT); pinMode(PIN_RED, OUTPUT); pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_ACK, INPUT_PULLUP); pinMode(PIN_TEST, INPUT_PULLUP);
  relay(false);
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID, WIFI_PASS);
}

void loop() {
  unsigned long now = millis();
  // ไฟสถานะ: ติด = ออนไลน์ · กระพริบ = ยังไม่ต่อ Wi-Fi
  digitalWrite(PIN_LED, WiFi.status() == WL_CONNECTED ? HIGH : ((now / 300) % 2));
  if (digitalRead(PIN_ACK) == LOW) { delay(40); if (digitalRead(PIN_ACK) == LOW) { ack(); while (digitalRead(PIN_ACK) == LOW) delay(10); } }
  if (digitalRead(PIN_TEST) == LOW) { relay(true); delay(1000); relay(false); while (digitalRead(PIN_TEST) == LOW) delay(10); }
  if (now - lastPoll >= POLL_MS || lastPoll == 0) { lastPoll = now; poll(); }
  // สั่งกระดิ่ง
  if (testUntil && now < testUntil) relay(true);
  else if (mode == 2) relay(true);
  else if (mode == 1) {
    if (now - patT >= (patOn ? ON_MS : OFF_MS)) { patOn = !patOn; patT = now; }
    relay(patOn);
  } else { relay(false); testUntil = 0; }
  delay(20);
}
