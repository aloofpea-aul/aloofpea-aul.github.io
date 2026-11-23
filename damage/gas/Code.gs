/** ▶ Run ฟังก์ชันนี้ครั้งแรก (สร้างชีต + โฟลเดอร์รูป + ขอสิทธิ์) */
function setup() { setupAll_(); }

/**
 * ประเมินค่าเสียหายระบบจำหน่าย (รถชนทรัพย์สิน กฟภ.) กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บ: https://aloofpea-aul.github.io/damage/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * ติดตั้ง (ครั้งแรก)
 *   1) สร้างโปรเจกต์ Apps Script ใหม่ → วางไฟล์นี้ทั้งหมด → บันทึก
 *   2) เลือกฟังก์ชัน setup → Run (กดอนุญาตสิทธิ์) → ได้ชีต + โฟลเดอร์รูปใน Drive
 *   3) Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone → Deploy
 *   4) คัดลอกลิงก์ Web app (…/exec) ไปใส่ใน damage/index.html (DMG_API)
 * อัปเดตโค้ด: วางทับ → Deploy › Manage deployments › ✏️ › Version: New version › Deploy (ลิงก์เดิม)
 *
 * เข้าสู่ระบบ: ชื่อ + รหัสผ่านศูนย์รวมงาน (ตรวจกับศูนย์รวมงานด้วย whoAmI)
 * ข้อมูล 1 งาน = 1 แถวในชีต "งาน" · รูปแนบเก็บในโฟลเดอร์ Drive (ไม่เปิดสาธารณะ ส่งผ่านระบบนี้เท่านั้น)
 * ราคามาตรฐานพัสดุ แก้ในชีต "ราคามาตรฐาน" ได้โดยตรง
 * ไม่มีค่าใช้จ่าย: Google Sheets + Drive + Apps Script ฟรีทั้งหมด
 */

const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '1.0';

const JOBS = { name: 'งาน',
  cols:   ['id', 'incDate', 'plate', 'driver', 'place', 'total', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'rev', 'deleted', 'data'],
  labels: ['รหัสงาน', 'วันเกิดเหตุ', 'ทะเบียนรถ', 'ผู้ขับขี่', 'สถานที่เกิดเหตุ', 'ค่าเสียหายรวม (บาท)', 'สร้างโดย', 'สร้างเมื่อ', 'แก้ไขล่าสุดโดย', 'แก้ไขล่าสุดเมื่อ', 'ครั้งที่แก้', 'ลบแล้ว', 'ข้อมูลเต็ม (JSON — ห้ามแก้มือ)'] };
const CAT  = { name: 'ราคามาตรฐาน', cols: ['d', 'u', 'p'], labels: ['รายละเอียด / ชื่อพัสดุ', 'หน่วย', 'ราคา/หน่วย (บาท)'] };
const SETS = { name: 'ตั้งค่า', cols: ['k', 'v'], labels: ['รายการ', 'ค่า (JSON)'] };
const LOG  = { name: 'ประวัติ', cols: ['t', 'u', 'a', 'id', 'd'], labels: ['วันเวลา', 'ผู้ใช้', 'การกระทำ', 'รหัสงาน', 'รายละเอียด'] };

const DEFAULT_CAT = [
  ['POLE,CONCRETE, 12 M.LONG เสาคอนกรีต 12 เมตร', 'ต้น', 14893],
  ['คอน คอร.120x120x3.000 มม.', 'ท่อน', 1833],
  ['เหล็กฉาก 65x65x6', 'อัน', 1420],
  ['เหล็กประกับ 40x6x1,000', 'อัน', 282],
  ['รถขุดเจาะพร้อมชุดทีมงาน', 'ทีม', 13000]
];

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=https://aloofpea-aul.github.io/damage/">ประเมินค่าเสียหายระบบจำหน่าย กฟส.อ่าวลึก')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  try {
    if (!b.user || !b.pass) return json_({ ok: false, error: 'unauthorized', message: 'กรุณาเข้าสู่ระบบศูนย์รวมงาน' });
    let me;
    try { me = who_(b.user, b.pass); }
    catch (err) { return json_({ ok: false, error: 'hub', message: 'ตรวจสอบกับศูนย์รวมงานไม่ได้ ลองใหม่อีกครั้ง (' + String(err.message || err).slice(0, 100) + ')' }); }
    if (!me) return json_({ ok: false, error: 'unauthorized', message: 'ชื่อหรือรหัสผ่านศูนย์รวมงานไม่ถูกต้อง' });

    const ro = READ[b.action];
    if (ro) { const out = ro(b, me) || {}; out.ok = true; return json_(out); }
    const fn = ACTIONS[b.action];
    if (!fn) return json_({ ok: false, error: 'unknown action' });
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      const out = fn(b, me) || {};
      SpreadsheetApp.flush();
      out.ok = true;
      return json_(out);
    } finally { lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: err.code || 'error', message: String(err.message || err), latest: err.latest || undefined });
  }
}

/* ---------------- อ่านอย่างเดียว ---------------- */
const READ = {
  /** เริ่มต้น: รายการงาน (สรุป) + ราคามาตรฐาน + ชื่อผู้ลงนามเริ่มต้น */
  bootstrap: function (b, me) {
    return { me: me, list: list_(), cat: catList_(), sign: getSetting_('sign') || null, version: VERSION };
  },
  list: function () { return { list: list_() }; },
  get: function (b) {
    const t = table_(JOBS), r = findRow_(t, 'id', b.id);
    if (r == null || String(getCell_(t, r, 'deleted')) === 'Y') return { job: null };
    return { job: parse_(getCell_(t, r, 'data')) };
  },
  /** รูปแนบ (ส่งเป็น dataURL — ไฟล์ใน Drive ไม่เปิดสาธารณะ) */
  photo: function (b) {
    const f = DriveApp.getFileById(String(b.fileId));
    if (!isInFolder_(f)) throw new Error('ไม่ใช่รูปของระบบนี้');
    const blob = f.getBlob();
    return { fileId: f.getId(), src: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
  }
};

/* ---------------- เขียน (ล็อก) ---------------- */
const ACTIONS = {
  /** บันทึกทั้งงาน · baseRev กันเขียนทับงานที่คนอื่นเพิ่งแก้ */
  save: function (b, me) {
    const job = b.job;
    if (!job || typeof job !== 'object' || !job.id) throw new Error('ไม่มีข้อมูลงาน');
    (job.photos || []).forEach(function (p) { delete p.src; });
    const t = table_(JOBS), now = nowIso_();
    const r = findRow_(t, 'id', job.id);
    if (r == null) {
      job.createdBy = me.name; job.createdAt = now; job.rev = 1;
      t.sheet.appendRow(rowOf_(job, me, now));
      log_(me, 'สร้างงาน', job.id, title_(job));
    } else {
      if (String(getCell_(t, r, 'deleted')) === 'Y') throw new Error('งานนี้ถูกลบแล้ว');
      const old = parse_(getCell_(t, r, 'data')) || {};
      if (b.baseRev != null && Number(old.rev || 0) !== Number(b.baseRev) && !b.force) {
        const e = new Error('มีผู้อื่นแก้ไขงานนี้หลังจากที่คุณเปิด (' + getCell_(t, r, 'updatedBy') + ')');
        e.code = 'conflict'; e.latest = old; throw e;
      }
      job.rev = Number(old.rev || 0) + 1;
      job.createdBy = old.createdBy || getCell_(t, r, 'createdBy'); job.createdAt = old.createdAt || getCell_(t, r, 'createdAt');
      t.sheet.getRange(r + 2, 1, 1, JOBS.cols.length).setValues([rowOf_(job, me, now)]);
      // รูปที่เอาออกจากงาน → ย้ายลงถังขยะ Drive (กู้คืนได้ 30 วัน)
      const keep = {}; (job.photos || []).forEach(function (p) { if (p.fileId) keep[p.fileId] = 1; });
      (old.photos || []).forEach(function (p) { if (p.fileId && !keep[p.fileId]) { try { DriveApp.getFileById(p.fileId).setTrashed(true); } catch (e) {} } });
      log_(me, 'แก้ไขงาน', job.id, title_(job));
    }
    return { rev: job.rev, updatedAt: now, updatedBy: me.name };
  },
  remove: function (b, me) {
    const t = table_(JOBS), r = findRow_(t, 'id', b.id);
    if (r == null) return {};
    t.sheet.getRange(r + 2, JOBS.cols.indexOf('deleted') + 1).setValue('Y');
    log_(me, 'ลบงาน', b.id, '');
    return {};
  },
  /** อัปโหลดรูป (dataURL) → โฟลเดอร์ Drive */
  photoUp: function (b, me) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(String(b.src || ''));
    if (!m) throw new Error('รูปไม่ถูกต้อง');
    const name = (b.jobId || 'job') + '_' + Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '_' + Math.floor(Math.random() * 1000) + '.jpg';
    const f = folder_().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
    f.setDescription('ประเมินค่าเสียหาย · งาน ' + (b.jobId || '') + ' · อัปโหลดโดย ' + me.name);
    return { fileId: f.getId() };
  },
  catSave: function (b, me) {
    const list = (b.cat || []).filter(function (x) { return x && String(x.d || '').trim(); });
    const sh = sheet_(CAT), n = sh.getLastRow() - 1;
    if (n > 0) sh.getRange(2, 1, n, 3).clearContent();
    if (list.length) sh.getRange(2, 1, list.length, 3).setValues(list.map(function (x) { return [String(x.d).trim(), String(x.u || ''), Number(x.p) || 0]; }));
    log_(me, 'แก้ราคามาตรฐาน', '', list.length + ' รายการ');
    return { cat: catList_() };
  },
  signSave: function (b, me) { setSetting_('sign', b.sign || {}); log_(me, 'แก้ชื่อผู้ลงนามเริ่มต้น', '', ''); return {}; }
};

/* ---------------- ข้อมูล ---------------- */
function rowOf_(job, me, now) {
  const tot = [].concat(job.rows1 || [], job.rows2 || []).reduce(function (a, r) {
    return a + (parseFloat(String(r.q || 1).replace(/[^0-9.\-]/g, '')) || 0) * (parseFloat(String(r.p || 0).replace(/[^0-9.\-]/g, '')) || 0); }, 0);
  job.updatedBy = me.name; job.updatedAt = now;
  const o = { id: job.id, incDate: job.incDate || '', plate: clean_(job.plate), driver: clean_(job.driver), place: clean_(job.place), total: Math.round(tot * 100) / 100,
    createdBy: job.createdBy, createdAt: job.createdAt, updatedBy: me.name, updatedAt: now, rev: job.rev, deleted: '', data: JSON.stringify(job) };
  return JOBS.cols.map(function (c) { return o[c]; });
}
function list_() {
  const t = table_(JOBS), out = [];
  t.rows.forEach(function (row) {
    const o = {}; JOBS.cols.forEach(function (c, i) { if (c !== 'data') o[c] = row[i]; });
    if (String(o.deleted) === 'Y' || !o.id) return;
    if (o.incDate instanceof Date) o.incDate = Utilities.formatDate(o.incDate, TZ, 'yyyy-MM-dd');
    ['createdAt', 'updatedAt'].forEach(function (k) { if (o[k] instanceof Date) o[k] = Utilities.formatDate(o[k], TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); });
    delete o.deleted; out.push(o);
  });
  return out;
}
function catList_() {
  const t = table_(CAT);
  return t.rows.filter(function (r) { return String(r[0]).trim(); }).map(function (r) { return { d: String(r[0]).trim(), u: String(r[1]), p: Number(r[2]) || 0 }; });
}
function title_(j) { return [j.plate, j.driver, j.place].filter(String).join(' · ').slice(0, 200); }

/* ---------------- ผู้ใช้ ---------------- */
function who_(user, pass) {
  const role = hubRole_(user, pass);
  return role ? { name: String(user).trim(), role: role } : null;
}
function hubRole_(user, pass) {
  const key = 'hub_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, user + '\u0001' + pass));
  const cache = CacheService.getScriptCache();
  let role = cache.get(key);
  if (role == null) {
    const res = UrlFetchApp.fetch(HUB_API, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ action: 'whoAmI', changedBy: user, changedByPassword: pass }) });
    let r;
    try { r = JSON.parse(res.getContentText()); } catch (e) { throw new Error('ศูนย์รวมงานตอบกลับไม่ถูกต้อง (HTTP ' + res.getResponseCode() + ')'); }
    role = (r && r.role) ? String(r.role) : '';
    cache.put(key, role, role ? 21600 : 30);
  }
  return role || null;
}

/* ---------------- ชีต / โฟลเดอร์ ---------------- */
function ss_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty('DMG_SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('ฐานข้อมูล ประเมินค่าเสียหายระบบจำหน่าย กฟส.อ่าวลึก');
  pr.setProperty('DMG_SHEET_ID', ss.getId());
  return ss;
}
function folder_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty('DMG_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('ประเมินค่าเสียหาย กฟส.อ่าวลึก - รูปแนบ');
  pr.setProperty('DMG_FOLDER_ID', f.getId());
  return f;
}
function isInFolder_(file) {
  const fid = folder_().getId(), it = file.getParents();
  while (it.hasNext()) if (it.next().getId() === fid) return true;
  return false;
}
function sheet_(def) {
  let sh = ss_().getSheetByName(def.name);
  if (!sh) {
    sh = ss_().insertSheet(def.name);
    sh.getRange(1, 1, 1, def.labels.length).setValues([def.labels]).setFontWeight('bold').setBackground('#fbe3d6');
    sh.setFrozenRows(1);
  }
  return sh;
}
function table_(def) {
  const sh = sheet_(def), n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, def.cols.length).getValues() : [];
  return { sheet: sh, rows: rows, def: def };
}
function findRow_(t, col, val) {
  const i = t.def.cols.indexOf(col), v = String(val || '');
  if (!v) return null;
  for (let r = 0; r < t.rows.length; r++) if (String(t.rows[r][i]) === v) return r;
  return null;
}
function getCell_(t, r, col) { return t.rows[r][t.def.cols.indexOf(col)]; }
function getSetting_(k) { const t = table_(SETS), r = findRow_(t, 'k', k); return r == null ? null : parse_(t.rows[r][1]); }
function setSetting_(k, v) {
  const t = table_(SETS), r = findRow_(t, 'k', k);
  if (r == null) t.sheet.appendRow([k, JSON.stringify(v)]); else t.sheet.getRange(r + 2, 2).setValue(JSON.stringify(v));
}
function log_(me, act, id, detail) { sheet_(LOG).appendRow([new Date(), me.name, act, id, String(detail || '').slice(0, 300)]); }

/* ---------------- เครื่องมือ ---------------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); }
function parse_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"); }

/** Run ครั้งแรก: สร้างชีต + โฟลเดอร์รูป + ขอสิทธิ์ + ทดสอบติดต่อศูนย์รวมงาน */
function setupAll_() {
  [JOBS, CAT, SETS, LOG].forEach(sheet_);
  const jobs = sheet_(JOBS);
  jobs.hideColumns(JOBS.cols.indexOf('data') + 1);
  jobs.setColumnWidth(JOBS.cols.indexOf('place') + 1, 320);
  const cat = sheet_(CAT);
  if (cat.getLastRow() < 2) cat.getRange(2, 1, DEFAULT_CAT.length, 3).setValues(DEFAULT_CAT);
  cat.setColumnWidth(1, 380); cat.getRange('C:C').setNumberFormat('#,##0.00');
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  const f = folder_();
  const res = UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน v' + VERSION + '\nชีต: ' + ss_().getUrl() + '\nโฟลเดอร์รูป: ' + f.getUrl() + '\nติดต่อศูนย์รวมงาน HTTP ' + res.getResponseCode());
}
