/**
 * ระบบคลังพัสดุ กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บ: https://aloofpea-aul.github.io/stock/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * ติดตั้ง (ครั้งแรก)
 *   1) สร้าง Google Sheets ใหม่ › ส่วนขยาย › Apps Script (หรือใส่รหัสชีตใน SPREADSHEET_ID)
 *   2) วางไฟล์นี้ทั้งหมด → บันทึก
 *   3) เลือกฟังก์ชัน setup → Run (กดอนุญาตสิทธิ์) → ชีตจะถูกสร้างให้ครบ
 *   4) Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone → Deploy
 *   5) คัดลอกลิงก์ Web app (…/exec) ไปใส่ใน API_DEFAULT ของ stock/index.html
 * อัปเดตโค้ดครั้งต่อไป: วางทับ → Deploy › Manage deployments › ✏️ › Version: New version › Deploy (ลิงก์เดิม)
 *
 * เข้าสู่ระบบ: ชื่อ + รหัสผ่านศูนย์รวมงาน (ตรวจกับศูนย์รวมงานด้วย whoAmI)
 * ดูข้อมูล = ผู้ใช้ศูนย์รวมงานทุกคน · นำเข้าไฟล์ SAP = admin ศูนย์รวมงาน หรือชื่อใน Script Properties › STOCK_ADMINS (คั่นด้วย ,)
 * ไม่มีค่าใช้จ่าย: ใช้ Google Sheets + Apps Script ฟรีทั้งหมด
 */

const SPREADSHEET_ID = '';   // เว้นว่าง = ใช้ชีตที่ผูกกับสคริปต์
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '1.0';

const CUR  = { name: 'ยอดปัจจุบัน', labels: ['คลังย่อย (SLoc)', 'รหัสพัสดุ', 'คำอธิบาย', 'แบทช์', 'ที่ใช้ได้', 'หน่วย', 'ระหว่างโอน', 'นำเข้าเมื่อ'] };
const MOVE = { name: 'ความเคลื่อนไหว', labels: ['วันเวลา', 'คลังย่อย', 'รหัสพัสดุ', 'คำอธิบาย', 'หน่วย', 'ยอดเดิม', 'ยอดใหม่', 'เปลี่ยนแปลง', 'นำเข้าโดย'] };
const IMP  = { name: 'ประวัตินำเข้า', labels: ['วันเวลา', 'ผู้นำเข้า', 'คลังย่อย', 'ไฟล์', 'จำนวนแถว', 'จำนวนรหัส', 'รหัสที่มีของ', 'รหัสที่ยอดเปลี่ยน'] };
const SETS = { name: 'ตั้งค่า', labels: ['รายการ', 'ค่า (JSON)'] };

const DEFAULT_SLOCS = [
  { code: '0023', name: 'สำรองแก้ไฟ' },
  { code: '2201', name: 'ผปร' },
  { code: '1201', name: 'ผมต' },
  { code: '6006', name: 'กองหมอน' },
  { code: '0201', name: 'กฟส.อ่าวลึก' }
];

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=https://aloofpea-aul.github.io/stock/">ระบบคลังพัสดุ กฟส.อ่าวลึก')
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

    if (b.action === 'bootstrap') return json_(bootstrap_(me));
    if (b.action === 'moves') return json_({ ok: true, moves: moves_(String(b.mat || '')) });

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
    return json_({ ok: false, error: err.code || 'error', message: String(err.message || err) });
  }
}

const ACTIONS = {
  /** นำเข้าไฟล์ SAP MB52 ของคลังย่อย 1 คลัง (หน้าเว็บแยกไฟล์ให้แล้ว) — แทนที่ยอดของคลังนั้นทั้งหมด */
  importSap: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'นำเข้าไฟล์ได้เฉพาะผู้ดูแลระบบคลัง');
    const sloc = String(b.sloc || '').trim();
    if (!/^\d{4}$/.test(sloc)) throw err_('bad', 'รหัสคลังย่อยไม่ถูกต้อง');
    const rows = (b.rows || []).filter(function (r) { return r && /^\d-\d\d-\d{3}-\d{4}$/.test(String(r[0])); });
    if (!rows.length) throw err_('bad', 'ไม่พบรายการพัสดุในไฟล์');
    if (rows.length > 5000) throw err_('bad', 'ไฟล์ใหญ่เกินไป');

    const sh = sheet_(CUR), now = new Date();
    const all = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, CUR.labels.length).getValues() : [];
    const keep = [], before = {}, info = {};
    all.forEach(function (r) {
      if (String(r[0]) === sloc) { const m = String(r[1]); before[m] = (before[m] || 0) + (Number(r[4]) || 0); info[m] = [r[2], r[5]]; }
      else keep.push(r);
    });
    const after = {};
    const fresh = rows.map(function (r) {
      const m = String(r[0]), q = Number(r[3]) || 0;
      after[m] = (after[m] || 0) + q; info[m] = [clean_(r[1]), clean_(r[4])];
      return [sloc, m, clean_(r[1]), clean_(r[2]), q, clean_(r[4]), Number(r[5]) || 0, now];
    });
    const first = !Object.keys(before).length;
    const mv = [];
    if (!first) {
      const keys = {};
      Object.keys(before).concat(Object.keys(after)).forEach(function (k) { keys[k] = 1; });
      Object.keys(keys).forEach(function (m) {
        const a = round_(before[m] || 0), z = round_(after[m] || 0);
        if (a !== z) mv.push([now, sloc, m, info[m][0], info[m][1], a, z, round_(z - a), me.name]);
      });
    }
    const out = keep.concat(fresh);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, CUR.labels.length).clearContent();
    if (out.length) sh.getRange(2, 1, out.length, CUR.labels.length).setValues(out);
    if (mv.length) { const ms = sheet_(MOVE); ms.getRange(ms.getLastRow() + 1, 1, mv.length, MOVE.labels.length).setValues(mv); }
    const mats = Object.keys(after);
    sheet_(IMP).appendRow([now, me.name, sloc, clean_(b.file), fresh.length, mats.length,
      mats.filter(function (m) { return after[m] > 0; }).length, first ? 'ครั้งแรก' : mv.length]);
    return { sloc: sloc, rows: fresh.length, mats: mats.length, changed: first ? null : mv.length };
  },

  saveSlocs: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'เฉพาะผู้ดูแลระบบคลัง');
    const list = (b.slocs || []).filter(function (s) { return s && /^\d{4}$/.test(String(s.code)); })
      .map(function (s) { return { code: String(s.code), name: clean_(s.name).slice(0, 40) }; });
    setSetting_('slocs', list);
    return { slocs: list };
  }
};

function bootstrap_(me) {
  const sh = sheet_(CUR);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, CUR.labels.length).getValues() : [];
  // [sloc, mat, desc, batch, qty, unit, transit]
  const rows = v.filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return [String(r[0]), String(r[1]), String(r[2]), String(r[3]), Number(r[4]) || 0, String(r[5]), Number(r[6]) || 0]; });
  const imp = sheet_(IMP), iv = imp.getLastRow() > 1 ? imp.getRange(2, 1, imp.getLastRow() - 1, IMP.labels.length).getValues() : [];
  const last = {};
  iv.forEach(function (r) { last[String(r[2])] = { at: iso_(r[0]), by: String(r[1]), file: String(r[3]) }; });
  return { ok: true, version: VERSION, me: { name: me.name, admin: me.admin }, slocs: getSetting_('slocs') || DEFAULT_SLOCS, rows: rows, imports: last };
}

function moves_(mat) {
  const sh = sheet_(MOVE);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, MOVE.labels.length).getValues()
    .filter(function (r) { return String(r[2]) === mat; })
    .slice(-50).reverse()
    .map(function (r) { return { at: iso_(r[0]), sloc: String(r[1]), before: r[5], after: r[6], diff: r[7], by: String(r[8]) }; });
}

/* ---------------- ผู้ใช้ ---------------- */
function who_(user, pass) {
  const role = hubRole_(user, pass);
  if (!role) return null;
  const extra = String(PropertiesService.getScriptProperties().getProperty('STOCK_ADMINS') || '').split(',').map(nm_).filter(String);
  return { name: String(user).trim(), role: role, admin: role === 'admin' || extra.indexOf(nm_(user)) >= 0 };
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

/* ---------------- ชีต ---------------- */
function ss_() { return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(def) {
  let sh = ss_().getSheetByName(def.name);
  if (!sh) {
    sh = ss_().insertSheet(def.name);
    sh.getRange(1, 1, 1, def.labels.length).setValues([def.labels]).setFontWeight('bold').setBackground('#efe8f3');
    sh.setFrozenRows(1);
  }
  return sh;
}
function getSetting_(key) {
  const v = sheet_(SETS).getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === key) return parse_(v[i][1]);
  return null;
}
function setSetting_(key, val) {
  const sh = sheet_(SETS), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === key) { sh.getRange(i + 1, 2).setValue(JSON.stringify(val)); return; }
  sh.appendRow([key, JSON.stringify(val)]);
}

/* ---------------- อื่นๆ ---------------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function err_(code, msg) { const e = new Error(msg); e.code = code; return e; }
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200); }
function nm_(s) { return String(s == null ? '' : s).replace(/[\s​-‍﻿]/g, '').toLowerCase(); }
function parse_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function round_(n) { return Math.round(Number(n) * 1000) / 1000; }
function iso_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(d || ''); }

/** Run ครั้งแรก: สร้างชีต + ขอสิทธิ์ + ทดสอบติดต่อศูนย์รวมงาน */
function setup() {
  [CUR, MOVE, IMP, SETS].forEach(sheet_);
  if (!getSetting_('slocs')) setSetting_('slocs', DEFAULT_SLOCS);
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน — Deploy เป็น Web app แล้วนำลิงก์ …/exec ไปใส่ในหน้าเว็บ');
}
