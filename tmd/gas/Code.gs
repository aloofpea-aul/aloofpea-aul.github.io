/****************************************************
 * ประกาศเตือนภัย กรมอุตุฯ — กฟส.อ่าวลึก  (หลังบ้าน / ฐานข้อมูล)
 *  - ดึงประกาศทุกฉบับจาก TMD API WeatherWarningNews (ฟรี) ทุก 1 ชั่วโมง → เก็บลงชีต Warnings
 *  - ติดป้าย กระบี่ / ภาคใต้ / - และระดับ สูง / กลาง / ทั่วไป
 *  - doGet = JSON ให้หน้าค้นหา (tmd/index.html) และบอท LINE งานเวรแก้ไฟ (duty-roster/gas/Tmd.gs)
 *  - ไฟล์นี้ไม่ส่ง LINE เอง — ให้บอทงานเวรแก้ไฟเป็นคนส่ง จะได้นับโควต้า LINE ที่เดียวกัน
 *
 * ติดตั้ง: สร้าง Google Sheet ใหม่ → Extensions → Apps Script → วางไฟล์นี้
 *   1) รัน debugApi  ดูว่า TMD ตอบอะไร
 *   2) รัน setup     สร้างชีต + Trigger ทุก 1 ชม. + ดึงครั้งแรก
 *   3) Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone → คัดลอก URL
 ****************************************************/

const CFG = {
  API_URL: 'https://data.tmd.go.th/api/WeatherWarningNews/v1/?uid=api&ukey=api12345',
  SHEET: 'Warnings',
  FOCUS_WORD: 'กระบี่'
};
const HEADERS = ['key', 'announceTime', 'issueNo', 'title', 'focus', 'severity',
                 'description', 'pdfUrl', 'fetchedAt'];

/* ---------- ทดสอบ: ดูข้อมูลดิบจาก TMD ---------- */
function debugApi() {
  const res = UrlFetchApp.fetch(CFG.API_URL, { muteHttpExceptions: true });
  Logger.log('HTTP ' + res.getResponseCode());
  Logger.log(res.getContentText('UTF-8').substring(0, 3000));
  try {
    const its = parseItems_(res.getContentText('UTF-8'));
    Logger.log('แยกได้ ' + its.length + ' ฉบับ');
    its.slice(-3).forEach(function (it) { Logger.log(JSON.stringify({ fields: it.fields, issue: it.issue, time: it.time, title: it.title, pdf: it.pdf ? 'มี' : 'ไม่มี', desc: it.desc.slice(0, 120) })); });
  } catch (e) { Logger.log('แยก XML ไม่ได้: ' + e); }
}

/* ---------- ติดตั้งครั้งเดียว ---------- */
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'fetchWarnings'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fetchWarnings').timeBased().everyHours(1).create();
  fetchWarnings();
  Logger.log('ติดตั้งแล้ว: ดึงทุก 1 ชั่วโมง');
}

/* ---------- งานหลัก ---------- */
function fetchWarnings() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const res = UrlFetchApp.fetch(CFG.API_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) { Logger.log('TMD ตอบ ' + res.getResponseCode()); return; }
    const items = parseItems_(res.getContentText('UTF-8'));
    const sh = sheet_();
    const last = sh.getLastRow();
    const have = new Set(last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return r[0]; }) : []);
    const rows = [];
    items.forEach(function (it) {
      const key = md5_(it.time + '|' + it.title);
      if (have.has(key)) return;
      have.add(key);
      const text = it.title + ' ' + it.desc;
      rows.push([key, it.time, it.issue ? 'ฉบับที่ ' + it.issue : issueNo_(text), it.title, focusOf_(text), severityOf_(text),
                 it.desc, it.pdf, new Date()]);
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    Logger.log('ประกาศใหม่ ' + rows.length + ' ฉบับ');
  } finally {
    lock.releaseLock();
  }
}

function focusOf_(t) { return t.indexOf(CFG.FOCUS_WORD) >= 0 ? 'กระบี่' : /ภาคใต้|อันดามัน/.test(t) ? 'ภาคใต้' : '-'; }
function severityOf_(t) { return /หนักมาก|พายุ/.test(t) ? 'สูง' : /หนัก|คลื่นลมแรง|คลื่นสูง/.test(t) ? 'กลาง' : 'ทั่วไป'; }
function issueNo_(t) { return (t.match(/ฉบับที่\s*\d+\s*\(\d+\/\d+\)/) || [''])[0]; }

/* แยก XML แบบยืดหยุ่น — หา element ที่มี tag ชื่อ title อยู่ข้างใน */
function parseItems_(xml) {
  const root = XmlService.parse(xml).getRootElement();
  const out = [];
  (function walk(el) {
    const kids = el.getChildren(), map = {};
    kids.forEach(function (k) { if (!k.getChildren().length) map[k.getName()] = k.getText().trim(); });
    const keys = Object.keys(map);
    if (/^header$/i.test(el.getName())) return;   // ส่วนหัวของ feed ไม่ใช่ประกาศ
    const tk = keys.filter(function (k) { return /title/i.test(k) && /th/i.test(k); })[0] || keys.filter(function (k) { return /title/i.test(k); })[0];
    if (tk && map[tk]) {
      const pick = function (re) { const k = keys.filter(function (x) { return re.test(x); })[0]; return k ? map[k] : ''; };
      const vals = keys.map(function (k) { return map[k]; });
      out.push({
        fields: keys,
        issue: pick(/^issue/i),
        title: map[tk],
        desc: pick(/description.*th/i) || pick(/description|detail|content/i),
        time: pick(/announce.*date|datetime|date/i),
        pdf: vals.filter(function (v) { return /^https?:\/\/.+\.pdf/i.test(v); })[0] || vals.filter(function (v) { return /^https?:\/\//i.test(v); })[0] || ''
      });
    }
    kids.forEach(walk);
  })(root);
  return out.reverse();   // เก่า → ใหม่
}

/* ---------- JSON ----------
 *  ?action=list&q=ฝน หนัก&focus=กระบี่|ภาคใต้&sev=สูง&limit=50
 *  ?action=latest&focus=กระบี่
 *  ?action=since&after=<key>   ← ใช้โดยบอท LINE
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const sh = sheet_(), n = sh.getLastRow() - 1;
  let rows = n > 0 ? sh.getRange(2, 1, n, HEADERS.length).getValues() : [];
  let data = rows.map(function (r) {
    return { key: r[0], announceTime: String(r[1]), issueNo: r[2], title: r[3], focus: r[4],
             severity: r[5], description: r[6], pdfUrl: r[7],
             fetchedAt: r[8] instanceof Date ? r[8].toISOString() : String(r[8]) };
  }).reverse();   // ใหม่ก่อน

  if (p.action === 'since') {
    const i = data.map(function (d) { return d.key; }).indexOf(p.after || '');
    data = (i < 0 ? data.slice(0, 5) : data.slice(0, i));
    return json_({ ok: true, data: data, total: n });
  }
  const focus = p.focus || '', sev = p.sev || '', q = String(p.q || '').trim();
  data = data.filter(function (d) {
    if (focus === 'กระบี่' && d.focus !== 'กระบี่') return false;
    if (focus === 'ภาคใต้' && d.focus === '-') return false;
    if (sev && d.severity !== sev) return false;
    if (q) {
      const hay = (d.title + ' ' + d.description + ' ' + d.issueNo + ' ' + d.announceTime);
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }
    return true;
  });
  const total = data.length;
  data = p.action === 'latest' ? data.slice(0, 1) : data.slice(0, Math.min(Number(p.limit) || 50, 300));
  return json_({ ok: true, data: data, total: total, updated: new Date().toISOString() });
}

/* ---------- helpers ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function md5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').substring(0, 16);
}
