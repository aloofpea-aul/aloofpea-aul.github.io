/****************************************************
 * ประกาศเตือนภัย กรมอุตุฯ — กฟส.อ่าวลึก  (หลังบ้าน / ฐานข้อมูล)  v2
 *
 * แหล่งข้อมูล: หน้าเว็บ tmd.go.th/warning-and-events/warning-storm (เป็นปัจจุบัน)
 *   (API data.tmd.go.th WeatherWarningNews ค้างอยู่ที่ปี 2565 จึงไม่ใช้)
 *  - ดึงรายการประกาศทุก 1 ชั่วโมง → เก็บลงชีต Warnings
 *  - แต่ละฉบับเปิดหน้ารายละเอียดเอาลิงก์ PDF → แปลง PDF เป็นข้อความผ่าน Google Drive (ฟรี)
 *    → หาว่ากระบี่อยู่ในตารางวันไหน ระดับ ฝนตกหนัก / ฝนตกหนักมาก
 *  - doGet = JSON ให้หน้าค้นหา (tmd/index.html) และบอท LINE งานเวรแก้ไฟ (duty-roster/gas/Tmd.gs)
 *  - ไฟล์นี้ไม่ส่ง LINE เอง
 *
 * รันครั้งแรก: setup  (สร้างชีต + Trigger ทุก 1 ชม. + ดึงย้อนหลัง)
 ****************************************************/

const CFG = {
  BASE: 'https://www.tmd.go.th',
  LIST: '/warning-and-events/warning-storm',
  SHEET: 'Warnings',
  FOCUS_WORD: 'กระบี่',
  PDF_PER_RUN: 12,         // แปลง PDF ไม่เกินรอบละกี่ฉบับ (กันเกินเวลา 6 นาที)
  BACKUP_PER_RUN: 25,      // สำรอง PDF ย้อนหลังรอบละกี่ฉบับ
  BACKUP_FOLDER: 'ประกาศเตือนภัย TMD (PDF สำรอง)'
};
const HEADERS = ['key', 'sortKey', 'announceDate', 'issueNo', 'title', 'focus', 'severity', 'krabiDetail',
                 'summary', 'pdfUrl', 'pageUrl', 'fullText', 'pdfDone', 'fetchedAt', 'pdfDrive'];
const C = {}; HEADERS.forEach(function (h, i) { C[h] = i; });
const TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MON_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/* ---------- ติดตั้งครั้งเดียว ---------- */
function setup() {
  sheet_();
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'fetchWarnings'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('fetchWarnings').timeBased().everyHours(1).create();
  fetchWarnings(200);   // ดึงย้อนหลัง ~200 ฉบับ (PDF จะทยอยแปลงรอบละ 12 ฉบับ)
  Logger.log('ติดตั้งแล้ว: ดึงทุก 1 ชั่วโมง');
}

/* ทดสอบ: ดึงหน้ารายการ + แปลง PDF ฉบับล่าสุด 1 ฉบับ (ไม่บันทึก) */
function debugLatest() {
  const items = listItems_(10);
  Logger.log('หน้ารายการ: ' + items.length + ' ฉบับ · ล่าสุด: ' + (items[0] && items[0].title));
  if (!items[0]) return;
  const d = detail_(items[0].pageUrl);
  Logger.log('PDF: ' + d.pdfUrl);
  const txt = d.pdfUrl ? pdfText_(pdfBlob_(d.pdfUrl)) : '';
  Logger.log('ข้อความ PDF ' + txt.length + ' ตัวอักษร');
  Logger.log(txt.slice(0, 2500));
  Logger.log('กระบี่: ' + JSON.stringify(krabi_(txt)));
}

/* ---------- งานหลัก ---------- */
function fetchWarnings(show) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    const sh = sheet_();
    sh.getRange('C:C').setNumberFormat('@');
    repairSortKeys_(sh);
    const items = listItems_(typeof show === 'number' ? show : 20);
    const n0 = sh.getLastRow() - 1;
    const have = new Set(n0 > 0 ? sh.getRange(2, 1, n0, 1).getValues().map(function (r) { return r[0]; }) : []);
    const rows = [];
    items.forEach(function (it) {
      const key = md5_(it.pageUrl);
      if (have.has(key)) return;
      have.add(key);
      const row = new Array(HEADERS.length).fill('');
      row[C.key] = key; row[C.announceDate] = it.date; row[C.issueNo] = issueNo_(it.title);
      row[C.title] = it.title; row[C.summary] = it.summary; row[C.pageUrl] = it.pageUrl;
      row[C.sortKey] = sortKey_(it.dateIso, '', row[C.issueNo]);
      row[C.focus] = focusOf_(it.title + ' ' + it.summary);
      row[C.severity] = sevOf_(it.title + ' ' + it.summary);
      row[C.fetchedAt] = new Date();
      rows.push(row);
    });
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
    Logger.log('รายการใหม่ ' + rows.length + ' ฉบับ');
    processPdfs_(sh);
    backupBacklog_(sh);
  } finally {
    lock.releaseLock();
  }
}

/* sortKey ที่เสียจากวันที่ถูกแปลง → คำนวณใหม่ */
function repairSortKeys_(sh) {
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const rg = sh.getRange(2, 1, n, HEADERS.length), v = rg.getValues();
  let changed = false;
  v.forEach(function (r) {
    if (String(r[C.sortKey]).indexOf('0000-00-00') !== 0 && !(r[C.announceDate] instanceof Date)) return;
    const hour = (String(r[C.pdfUrl]).match(/_(\d{2})_warning/) || [])[1] || '';
    r[C.announceDate] = thaiDate_(r[C.announceDate]);
    r[C.sortKey] = sortKey_(isoOfThai_(r[C.announceDate]), hour, r[C.issueNo]);
    changed = true;
  });
  if (changed) rg.setValues(v);
}

/* แปลง PDF ของแถวที่ยังไม่ได้ทำ — ใหม่ก่อน */
function processPdfs_(sh) {
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const data = sh.getRange(2, 1, n, HEADERS.length).getValues();
  const todo = data.map(function (r, i) { return { r: r, i: i }; })
    .filter(function (x) { return !x.r[C.pdfDone] || /^error[12]$/.test(x.r[C.pdfDone]); })
    .sort(function (a, b) { return String(b.r[C.sortKey]).localeCompare(String(a.r[C.sortKey])); })
    .slice(0, CFG.PDF_PER_RUN);
  const t0 = Date.now();
  todo.forEach(function (x) {
    if (Date.now() - t0 > 240000) return;   // เผื่อเวลา
    const r = x.r;
    try {
      const d = detail_(r[C.pageUrl]);
      const blob = d.pdfUrl ? pdfBlob_(d.pdfUrl) : null;
      if (blob && !r[C.pdfDrive]) { try { r[C.pdfDrive] = backupPdf_(blob, d.pdfUrl, r); } catch (e) { Logger.log('สำรอง PDF ไม่ได้: ' + e); } }
      const txt = blob ? pdfText_(blob) : '';
      const all = [r[C.title], r[C.summary], d.body, txt].join('\n');
      const k = krabi_(txt || d.body);
      r[C.pdfUrl] = d.pdfUrl;
      r[C.fullText] = (txt || d.body).slice(0, 45000);
      r[C.focus] = all.indexOf(CFG.FOCUS_WORD) >= 0 ? 'กระบี่' : focusOf_(all);
      r[C.krabiDetail] = k.text;
      r[C.severity] = k.level === 'หนักมาก' ? 'สูง' : k.level === 'หนัก' ? 'กลาง' : sevOf_(r[C.title] + ' ' + r[C.summary]);
      r[C.sortKey] = sortKey_(isoOfThai_(r[C.announceDate]), d.hour, r[C.issueNo]);
      r[C.pdfDone] = new Date();
    } catch (e) {
      Logger.log('แปลงไม่ได้ ' + r[C.title] + ': ' + e);
      const tries = Number(String(r[C.pdfDone]).replace('error', '')) || 0;
      r[C.pdfDone] = 'error' + (tries + 1);   // ลองใหม่ได้ 3 รอบ แล้วหยุด (ลบช่องนี้ทิ้งถ้าต้องการลองอีก)
    }
    sh.getRange(x.i + 2, 1, 1, HEADERS.length).setValues([r]);
  });
}

/* ---------- อ่านหน้าเว็บ TMD ---------- */
/* URL ที่ UrlFetchApp รับได้แน่นอน (ถอดแล้วเข้ารหัสใหม่ทั้งเส้น) */
function safeUrl_(u) {
  u = dec_(String(u || '')).trim();
  try { u = decodeURI(u); } catch (e) {}
  return encodeURI(u).replace(/%25([0-9A-F]{2})/gi, '%$1');
}
function get_(url) {
  const res = UrlFetchApp.fetch(safeUrl_(url), { muteHttpExceptions: true, followRedirects: true,
    headers: { 'User-Agent': 'Mozilla/5.0 (PEA Aoluek warning bot)' } });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ' ' + url);
  return res.getContentText('UTF-8');
}
function listItems_(show) {
  const html = get_(CFG.BASE + CFG.LIST + '?page=1&show=' + (show || 20));
  return html.split('class="link-list-content"').slice(1).map(function (chunk) {
    const t = chunk.match(/class="link-list-title"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!t) return null;
    const ds = chunk.match(/class="link-list-description"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const dt = dec_(chunk).match(/วันที่ข้อมูล:\s*<\/div>\s*<div[^>]*>\s*([^<]+)/);
    const date = dt ? dt[1].trim() : '';
    let href = dec_(t[1]);
    if (href.charAt(0) === '/') href = CFG.BASE + href;
    href = safeUrl_(href);
    return { title: clean_(t[2]), summary: ds ? clean_(ds[1]) : '', date: date, dateIso: isoOfThai_(date), pageUrl: href };
  }).filter(Boolean);
}
function detail_(url) {
  const html = get_(url);
  const m = html.match(/\/media\/forecast\/[^"'\s<>]+?\.pdf/i);
  const pdf = m ? safeUrl_(CFG.BASE + m[0]) : '';
  const h = pdf.match(/_(\d{2})_warning/);
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  return { pdfUrl: pdf, hour: h ? h[1] : '', body: clean_(main.replace(/<script[\s\S]*?<\/script>/gi, '')).slice(0, 20000) };
}

/* PDF → ข้อความ: แปลงเป็น Google Docs ชั่วคราว (บริการ Drive API v3) → export text → ย้ายลงถังขยะ */
function pdfBlob_(pdfUrl) {
  const res = UrlFetchApp.fetch(safeUrl_(pdfUrl), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('โหลด PDF ไม่ได้ HTTP ' + res.getResponseCode());
  return res.getBlob().setContentType('application/pdf');
}
function pdfText_(blob) {
  const f = Drive.Files.create({ name: 'tmp_tmd_warning', mimeType: 'application/vnd.google-apps.document' }, blob, { ocrLanguage: 'th' });
  try {
    const ex = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + f.id + '/export?mimeType=text/plain',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (ex.getResponseCode() === 200) return ex.getContentText('UTF-8').replace(/\uFEFF/g, '');
    return DocumentApp.openById(f.id).getBody().getText();
  } finally {
    try { DriveApp.getFileById(f.id).setTrashed(true); } catch (e) {}
  }
}

/* กระบี่อยู่ในตาราง "จังหวัดที่คาดว่าจะได้รับผลกระทบจาก..." วันไหนบ้าง */
function krabi_(txt) {
  const out = [], seen = {};
  let level = '';
  const re = /คาดว่าจะได้รับผลกระทบจาก\s*([^\n]*)([\s\S]*?)(?=คาดว่าจะได้รับผลกระทบจาก|$)/g;
  let m;
  while ((m = re.exec(txt || ''))) {
    const kind = m[1].replace(/\s+/g, '').trim();                 // ฝนตกหนักมาก / ฝนตกหนัก / ...
    const block = m[2];
    const dateRe = new RegExp('(\\d{1,2}(?:\\s*[-–]\\s*\\d{1,2})?)\\s*(' + TH_MONTH.join('|') + ')\\s*(25\\d\\d)', 'g');
    const dates = []; let d;
    while ((d = dateRe.exec(block))) dates.push({ i: d.index, label: d[1].replace(/\s/g, '') + ' ' + TH_MON_S[TH_MONTH.indexOf(d[2])] });
    dates.forEach(function (dd, j) {
      const seg = block.slice(dd.i, j + 1 < dates.length ? dates[j + 1].i : block.length);
      if (seg.indexOf(CFG.FOCUS_WORD) < 0) return;
      const lv = /หนักมาก/.test(kind) ? 'หนักมาก' : /หนัก/.test(kind) ? 'หนัก' : kind.replace(/^ฝน/, 'ฝน');
      const k = dd.label + lv; if (seen[k]) return; seen[k] = 1;
      out.push(dd.label + ' ' + (lv === 'หนักมาก' ? 'ฝนตกหนักมาก' : lv === 'หนัก' ? 'ฝนตกหนัก' : lv));
      if (lv === 'หนักมาก' || (lv === 'หนัก' && level !== 'หนักมาก')) level = lv;
    });
  }
  return { text: out.join('\n'), level: level };
}

/* ---------- JSON ----------
 *  ?action=list&q=คำค้น&focus=กระบี่|ภาคใต้&sev=สูง&limit=50
 *  ?action=latest&focus=กระบี่
 *  ?action=since&after=<sortKey>   ← บอท LINE (เฉพาะฉบับที่แปลง PDF แล้ว)
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const sh = sheet_(), n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEADERS.length).getValues() : [];
  let data = rows.map(function (r) {
    return { key: r[C.key], sortKey: String(r[C.sortKey]), announceTime: thaiDate_(r[C.announceDate]), issueNo: r[C.issueNo],
             title: r[C.title], focus: r[C.focus], severity: r[C.severity], krabiDetail: r[C.krabiDetail],
             description: r[C.summary], pdfUrl: r[C.pdfUrl], pdfDrive: r[C.pdfDrive] || '', pageUrl: r[C.pageUrl], ready: !!r[C.pdfDone], _t: r[C.fullText] };
  }).sort(function (a, b) { return b.sortKey.localeCompare(a.sortKey); });

  if (p.action === 'since') {
    const after = String(p.after || '');
    data = data.filter(function (d) { return d.ready && (!after || d.sortKey > after); }).slice(0, 5);
    return json_({ ok: true, data: strip_(data), latest: (rows.length ? data[0] : null) });
  }
  const focus = p.focus || '', sev = p.sev || '', q = String(p.q || '').trim();
  data = data.filter(function (d) {
    if (focus === 'กระบี่' && d.focus !== 'กระบี่') return false;
    if (focus === 'ภาคใต้' && d.focus === '-') return false;
    if (sev && d.severity !== sev) return false;
    if (q) {
      const hay = [d.title, d.description, d.issueNo, d.announceTime, d.krabiDetail, d._t].join(' ');
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    }
    return true;
  });
  const total = data.length;
  data = p.action === 'latest' ? data.slice(0, 1) : data.slice(0, Math.min(Number(p.limit) || 50, 300));
  return json_({ ok: true, data: strip_(data), total: total, updated: new Date().toISOString() });
}
function strip_(a) { return a.map(function (d) { const o = {}; Object.keys(d).forEach(function (k) { if (k !== '_t') o[k] = d[k]; }); return o; }); }

/* ---------- helpers ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(CFG.SHEET);
  if (!sh) {
    sh = ss.insertSheet(CFG.SHEET);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < HEADERS.length) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');   // เพิ่มคอลัมน์ใหม่ต่อท้าย
  }
  return sh;
}

/* ---------- สำรอง PDF ลง Google Drive ----------
 * โฟลเดอร์: ประกาศเตือนภัย TMD (PDF สำรอง) / 2569 / 10-ตุลาคม / 273-2569 2026-10-23 17น.pdf
 * แชร์แบบ "ทุกคนที่มีลิงก์ดูได้" (เป็นเอกสารสาธารณะของกรมอุตุฯ อยู่แล้ว) เพื่อให้หน้าค้นหาเปิดได้
 */
function folder_(parent, name) {
  const it = parent ? parent.getFoldersByName(name) : DriveApp.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  const f = parent ? parent.createFolder(name) : DriveApp.createFolder(name);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return f;
}
function backupPdf_(blob, pdfUrl, r) {
  const iso = isoOfThai_(r[C.announceDate]) || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const y = +iso.slice(0, 4) + 543, m = +iso.slice(5, 7);
  const root = folder_(null, CFG.BACKUP_FOLDER);
  const dir = folder_(folder_(root, String(y)), ('0' + m).slice(-2) + '-' + TH_MONTH[m - 1]);
  const no = (String(r[C.issueNo]).match(/\((\d+)\s*\/\s*(\d+)\)/) || []);
  const hr = (String(pdfUrl).match(/_(\d{2})_warning/) || [])[1];
  const name = (no[1] ? no[1] + '-' + no[2] + ' ' : '') + iso + (hr ? ' ' + hr + '.00น' : '') + '.pdf';
  const same = dir.getFilesByName(name);
  const f = same.hasNext() ? same.next() : dir.createFile(blob.copyBlob().setName(name));
  f.setDescription(String(r[C.title]) + '\n' + pdfUrl);
  try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return 'https://drive.google.com/file/d/' + f.getId() + '/view';
}
/* สำรองฉบับเก่าที่แปลงแล้วแต่ยังไม่มีไฟล์สำรอง — ทยอยรอบละ BACKUP_PER_RUN */
function backupBacklog_(sh) {
  const n = sh.getLastRow() - 1; if (n < 1) return;
  const data = sh.getRange(2, 1, n, HEADERS.length).getValues();
  const t0 = Date.now(); let done = 0;
  data.forEach(function (r, i) {
    if (done >= CFG.BACKUP_PER_RUN || Date.now() - t0 > 150000) return;
    if (r[C.pdfDrive] || !r[C.pdfUrl] || !(r[C.pdfDone] instanceof Date)) return;
    try {
      r[C.pdfDrive] = backupPdf_(pdfBlob_(r[C.pdfUrl]), r[C.pdfUrl], r);
      sh.getRange(i + 2, C.pdfDrive + 1).setValue(r[C.pdfDrive]);
      done++;
    } catch (e) { Logger.log('สำรองไม่ได้ ' + r[C.issueNo] + ': ' + e); }
  });
  if (done) Logger.log('สำรอง PDF ย้อนหลัง ' + done + ' ฉบับ');
}
/* รันเองได้ เพื่อสำรองย้อนหลังทันที */
function backupNow() { backupBacklog_(sheet_()); }
function dec_(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(+d); })
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function clean_(html) { return dec_(String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim(); }
function issueNo_(t) { const m = String(t).match(/ฉบับที่\s*\d+\s*\(\s*\d+\s*\/\s*\d+\s*\)/); return m ? m[0].replace(/\s+/g, ' ') : ''; }
/* ชีตอาจแปลง "23 ตุลาคม 2569" เป็นค่าวันที่ (ปี ค.ศ. 2569) — แปลงกลับเป็นข้อความไทย */
function thaiDate_(v) {
  if (v instanceof Date) return v.getDate() + ' ' + TH_MONTH[v.getMonth()] + ' ' + v.getFullYear();
  return String(v || '');
}
function isoOfThai_(s) {
  const m = thaiDate_(s).match(/(\d{1,2})\s*(\S+)\s*(25\d\d)/); if (!m) return '';
  const mo = TH_MONTH.indexOf(m[2]); if (mo < 0) return '';
  return (+m[3] - 543) + '-' + ('0' + (mo + 1)).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}
function sortKey_(iso, hour, issue) {
  const s = String(issue || '').match(/\((\d+)\s*\/\s*(\d+)\)/);
  return (iso || '0000-00-00') + 'T' + (hour || '00') + '#' + (s ? s[2] + ('000' + s[1]).slice(-4) : '0000000');
}
function focusOf_(t) { return String(t).indexOf(CFG.FOCUS_WORD) >= 0 ? 'กระบี่' : /ภาคใต้|อันดามัน/.test(t) ? 'ภาคใต้' : '-'; }
function sevOf_(t) { return /หนักมาก|พายุ/.test(t) ? 'สูง' : /หนัก|คลื่นลมแรง|คลื่นสูง/.test(t) ? 'กลาง' : 'ทั่วไป'; }
function md5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').substring(0, 16);
}
