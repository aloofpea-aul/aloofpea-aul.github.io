/**
 * ระบบงานจัดซื้อจัดจ้าง กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บ: https://aloofpea-aul.github.io/procure/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * ติดตั้ง (ครั้งแรก)
 *   1) สร้าง Google Sheets ใหม่ ใส่รหัสชีตใน SPREADSHEET_ID (หรือเว้นว่างแล้วสร้างสคริปต์จากเมนู ส่วนขยาย › Apps Script ของชีต)
 *   2) วางไฟล์นี้ทั้งหมดใน Apps Script → บันทึก
 *   3) เลือกฟังก์ชัน setup → Run (กดอนุญาตสิทธิ์) → ชีตจะถูกสร้างให้ครบ
 *   4) Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone → Deploy
 *   5) คัดลอกลิงก์ Web app (…/exec) ส่งให้ผู้พัฒนา/วางในหน้าเว็บ
 * อัปเดตโค้ดครั้งต่อไป: วางทับ → Deploy › Manage deployments › ✏️ › Version: New version › Deploy (ลิงก์เดิม)
 *
 * เข้าสู่ระบบ: ชื่อ + รหัสผ่านศูนย์รวมงาน กฟส.อ่าวลึก (ตรวจกับศูนย์รวมงานด้วย whoAmI)
 * ผู้ดูแล = admin ของศูนย์รวมงาน · หรือชื่อใน Script Properties › PROCURE_ADMINS (คั่นด้วย ,)
 * ข้อมูล 1 งาน = 1 แถวในชีต "งาน" (คอลัมน์สรุปไว้ดู/กรอง + คอลัมน์ข้อมูลเต็มแบบ JSON)
 * ไม่มีค่าใช้จ่าย: ใช้ Google Sheets + Apps Script ฟรีทั้งหมด
 */

const SPREADSHEET_ID = '19fEbARQGPUHNzd-d62SpseikLeANU5oJb7cpe3qQPbU';   // ชีตเก็บข้อมูล (เว้นว่าง = ใช้ชีตที่ผูกกับสคริปต์)
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '1.0';

const JOBS = { name: 'งาน',
  cols:   ['id', 'year', 'kind', 'dept', 'title', 'vendor', 'total', 'step', 'nums', 'createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'deleted', 'data'],
  labels: ['รหัสงาน', 'ปี (พ.ศ.)', 'ประเภท', 'แผนก', 'ชื่องาน', 'ผู้ขาย/ผู้รับจ้าง', 'ยอดเงิน (บาท)', 'ความคืบหน้า', 'เลขหนังสือ', 'สร้างโดย', 'สร้างเมื่อ', 'แก้ไขล่าสุดโดย', 'แก้ไขล่าสุดเมื่อ', 'ลบแล้ว', 'ข้อมูลเต็ม (JSON — ห้ามแก้มือ)'] };
const SETS = { name: 'ตั้งค่า', labels: ['รายการ', 'ค่า (JSON)'] };
const LOG  = { name: 'ประวัติ', labels: ['วันเวลา', 'ผู้ใช้', 'การกระทำ', 'รหัสงาน', 'รายละเอียด'] };

const DEFAULT_SETTINGS = {
  office: 'กฟส.อ่าวลึก',
  bookPrefix: 'ต.2 กฟส.อล.',
  authNo: 'พ.(ม)28/2568', authDate: '2025-11-17', authLimit: '1,000,000.-บาท (หนึ่งล้านบาทถ้วน)',
  approver: { name: '', pos: 'ผจก.กฟส.อ่าวลึก' },
  depts: {
    'ผปร.': { code: '(ปร.)', head: 'หผ.ปร.', cc: '', acc: '', accName: '' },
    'ผบง.': { code: '(บง.)', head: 'หผ.บง.', cc: '', acc: '', accName: '' },
    'ผบค.': { code: '(บค.)', head: 'หผ.บค.', cc: '', acc: '', accName: '' }
  }
};

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=https://aloofpea-aul.github.io/procure/">ระบบงานจัดซื้อจัดจ้าง กฟส.อ่าวลึก')
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

    // อ่านอย่างเดียว ไม่ต้องล็อก
    if (b.action === 'bootstrap') return json_(bootstrap_(me));
    if (b.action === 'get') return json_({ ok: true, job: getJob_(String(b.id || '')) });

    const fn = ACTIONS[b.action];
    if (!fn) return json_({ ok: false, error: 'unknown action' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
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

const ACTIONS = {
  /** บันทึกทั้งงาน (สร้างใหม่ถ้าไม่มี id) · baseUpdatedAt กันเขียนทับงานที่คนอื่นเพิ่งแก้ */
  save: function (b, me) {
    const job = b.job;
    if (!job || typeof job !== 'object') throw new Error('ไม่มีข้อมูลงาน');
    const t = table_(JOBS), now = nowIso_();
    let r = job.id ? findRow_(t, 'id', job.id) : null;
    if (r == null) {
      job.id = job.id || newId_();
      job.createdBy = me.name; job.createdAt = now; job.rev = 1;
      const row = rowOf_(job, me, now);
      t.sheet.appendRow(row);
      log_(me, 'สร้างงาน', job.id, job.title || '');
    } else {
      if (String(getCell_(t, r, 'deleted')) === 'Y') throw new Error('งานนี้ถูกลบแล้ว');
      const old = parse_(getCell_(t, r, 'data')) || {};
      if (b.baseRev != null && Number(old.rev || 0) !== Number(b.baseRev) && !b.force) {
        const e = new Error('มีผู้อื่นแก้ไขงานนี้หลังจากที่คุณเปิด (' + getCell_(t, r, 'updatedBy') + ')');
        e.code = 'conflict'; e.latest = old; throw e;
      }
      job.rev = Number(old.rev || 0) + 1;
      job.createdBy = old.createdBy || getCell_(t, r, 'createdBy'); job.createdAt = old.createdAt || getCell_(t, r, 'createdAt');
      // เลขหนังสือที่ออกแล้วห้ามหาย (กันเครื่องที่ข้อมูลเก่าบันทึกทับ)
      keepNums_(job, old);
      t.sheet.getRange(r + 2, 1, 1, JOBS.cols.length).setValues([rowOf_(job, me, now)]);
      log_(me, 'แก้ไขงาน', job.id, job.title || '');
    }
    return { job: job, rev: job.rev, summary: summary_(job) };
  },

  /** บันทึกเลขหนังสือที่ได้จากระบบออกเลขหนังสือ (แก้เฉพาะฉบับนั้น ไม่ทับส่วนอื่น) */
  setDocNo: function (b, me) {
    const t = table_(JOBS), r = findRow_(t, 'id', b.id);
    if (r == null) throw new Error('ไม่พบงานนี้');
    const job = parse_(getCell_(t, r, 'data')) || {};
    const k = String(b.docKey || '');
    if (!/^d[1-7]$/.test(k)) throw new Error('ฉบับเอกสารไม่ถูกต้อง');
    job.docs = job.docs || {}; job.docs[k] = job.docs[k] || {};
    if (job.docs[k].no && !b.replace) throw new Error('ฉบับนี้มีเลขแล้ว (' + job.docs[k].no + ')');
    job.docs[k].no = clean_(b.no); if (b.date) job.docs[k].date = clean_(b.date);
    job.docs[k].bookRef = clean_(b.bookRef || '');
    job.rev = Number(job.rev || 0) + 1;
    const now = nowIso_();
    t.sheet.getRange(r + 2, 1, 1, JOBS.cols.length).setValues([rowOf_(job, me, now)]);
    log_(me, 'ออกเลขหนังสือ', job.id, k + ' = ' + job.docs[k].no);
    return { job: job, rev: job.rev, summary: summary_(job) };
  },

  /** ลบงาน (เก็บไว้ในชีต ทำเครื่องหมายลบ) — ผู้สร้างหรือผู้ดูแล ต้องมีเหตุผล */
  remove: function (b, me) {
    const t = table_(JOBS), r = findRow_(t, 'id', b.id);
    if (r == null) throw new Error('ไม่พบงานนี้');
    const reason = clean_(b.reason);
    if (reason.length < 2) throw new Error('กรุณาระบุเหตุผลที่ลบ');
    if (!me.admin && nm_(getCell_(t, r, 'createdBy')) !== nm_(me.name)) throw new Error('ลบได้เฉพาะผู้สร้างงานหรือผู้ดูแลระบบ');
    t.sheet.getRange(r + 2, JOBS.cols.indexOf('deleted') + 1).setValue('Y');
    log_(me, 'ลบงาน', b.id, reason);
    return { removed: b.id };
  },

  /** ตั้งค่ากลาง (ผู้ดูแลเท่านั้น) */
  saveSettings: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    const s = Object.assign({}, settings_(), b.settings || {});
    setSetting_('settings', s);
    log_(me, 'แก้ตั้งค่า', '', '');
    return { settings: s };
  }
};

/* ---------------- อ่านข้อมูล ---------------- */
function bootstrap_(me) {
  const t = table_(JOBS);
  const jobs = t.rows.filter(function (x) { return String(x[JOBS.cols.indexOf('deleted')]) !== 'Y' && x[0]; })
    .map(function (x) { const o = {}; JOBS.cols.forEach(function (c, i) { if (c !== 'data') o[c] = x[i] instanceof Date ? x[i].toISOString() : x[i]; }); return o; })
    .sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return { ok: true, version: VERSION, me: { name: me.name, admin: me.admin }, settings: settings_(), jobs: jobs };
}
function getJob_(id) {
  const t = table_(JOBS), r = findRow_(t, 'id', id);
  if (r == null) throw new Error('ไม่พบงานนี้');
  const job = parse_(getCell_(t, r, 'data')) || {};
  job._deleted = String(getCell_(t, r, 'deleted')) === 'Y';
  return job;
}

/* ---------------- แปลงงาน → แถว ---------------- */
function rowOf_(job, me, now) {
  delete job._deleted;
  const s = summary_(job);
  const o = { id: job.id, year: s.year, kind: s.kind, dept: job.dept || '', title: job.title || '', vendor: job.vendor || '',
    total: s.total, step: s.step, nums: s.nums, createdBy: job.createdBy || me.name, createdAt: new Date(job.createdAt || now),
    updatedBy: me.name, updatedAt: new Date(), deleted: '', data: JSON.stringify(job) };
  if (o.data.length > 49000) throw new Error('ข้อมูลงานยาวเกินไป (เกิน 49,000 ตัวอักษร) — ลดรายละเอียดคุณสมบัติพัสดุ');
  return JOBS.cols.map(function (c) { return o[c]; });
}
function summary_(job) {
  const items = job.items || [];
  const sum = items.reduce(function (a, i) { return a + (Number(i.qty) || 0) * (Number(i.price) || 0); }, 0);
  const total = job.vatIncl === false ? Math.round(sum * 107) / 100 : Math.round(sum * 100) / 100;
  const docs = job.docs || {}, keys = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'];
  const done = keys.filter(function (k) { const d = docs[k] || {}; return (job.printed || {})[k] || d.no || (k === 'd3' || k === 'd6') && d.date; }).length;
  const d1 = (docs.d1 || {}).date || job.createdAt || nowIso_();
  return { id: job.id, dept: job.dept || '', title: job.title || '', vendor: job.vendor || '', updatedAt: new Date().toISOString(),
    year: Number(String(d1).slice(0, 4)) + 543, kind: job.kind === 'hire' ? 'จัดจ้าง' : 'จัดซื้อ', total: total,
    step: done + ' จาก 7', nums: keys.map(function (k) { return (docs[k] || {}).no; }).filter(Boolean).join(', ') };
}
function keepNums_(job, old) {
  job.docs = job.docs || {};
  Object.keys(old.docs || {}).forEach(function (k) {
    const o = old.docs[k] || {}; if (!o.no) return;
    job.docs[k] = job.docs[k] || {};
    if (!job.docs[k].no) { job.docs[k].no = o.no; if (o.bookRef) job.docs[k].bookRef = o.bookRef; }
  });
}

/* ---------------- ตั้งค่า ---------------- */
function settings_() { return Object.assign({}, DEFAULT_SETTINGS, getSetting_('settings') || {}); }
function getSetting_(key) {
  const sh = sheet_(SETS), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === key) return parse_(v[i][1]);
  return null;
}
function setSetting_(key, val) {
  const sh = sheet_(SETS), v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (v[i][0] === key) { sh.getRange(i + 1, 2).setValue(JSON.stringify(val)); return; }
  sh.appendRow([key, JSON.stringify(val)]);
}

/* ---------------- ผู้ใช้ ---------------- */
function who_(user, pass) {
  const role = hubRole_(user, pass);
  if (!role) return null;
  const extra = String(PropertiesService.getScriptProperties().getProperty('PROCURE_ADMINS') || '').split(',').map(nm_).filter(String);
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
function log_(me, act, id, detail) { sheet_(LOG).appendRow([new Date(), me.name, act, id, String(detail || '').slice(0, 300)]); }

/* ---------------- เครื่องมือ ---------------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); }
function nm_(s) { return String(s == null ? '' : s).replace(/[\s​-‍﻿]/g, '').toLowerCase(); }
function parse_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"); }
function newId_() { return 'PR' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); }

/** Run ครั้งแรก: สร้างชีต + ขอสิทธิ์ + ทดสอบติดต่อศูนย์รวมงาน */
function setup() {
  [JOBS, SETS, LOG].forEach(sheet_);
  const jobs = sheet_(JOBS);
  jobs.hideColumns(JOBS.cols.indexOf('data') + 1);
  jobs.setColumnWidth(JOBS.cols.indexOf('title') + 1, 280);
  if (!getSetting_('settings')) setSetting_('settings', DEFAULT_SETTINGS);
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  const res = UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน v' + VERSION + ' · ติดต่อศูนย์รวมงาน HTTP ' + res.getResponseCode());
}
