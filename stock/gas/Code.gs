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

const SPREADSHEET_ID = '';   // ชีตเก็บข้อมูล: setup สร้างให้แล้ว (Script Properties › STOCK_SHEET_ID = 1IKvWOiuLhYFrxoSfR18kZ3sic5o5Y52Ei9-i8ZCLsdQ)
// Web app: https://script.google.com/macros/s/AKfycby536q10bjzfwQPQLrxbv-BXY33WNggpQi06VdRLniht_zUZjArNZ5V9fQIBKCY0dAHzw/exec
// โปรเจ็กต์ Apps Script: https://script.google.com/home/projects/1u-jmdU92q1pSOCRJLxBGrlW9vIQroS1WXuvOViijqUMQ5dZtaV-6WWbm/edit
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '2.0';   // ตรวจนับ + จัดหาให้ครบ

const CUR  = { name: 'ยอดปัจจุบัน', labels: ['คลังย่อย (SLoc)', 'รหัสพัสดุ', 'คำอธิบาย', 'แบทช์', 'ที่ใช้ได้', 'หน่วย', 'ระหว่างโอน', 'นำเข้าเมื่อ'] };
const MOVE = { name: 'ความเคลื่อนไหว', labels: ['วันเวลา', 'คลังย่อย', 'รหัสพัสดุ', 'คำอธิบาย', 'หน่วย', 'ยอดเดิม', 'ยอดใหม่', 'เปลี่ยนแปลง', 'นำเข้าโดย'] };
const IMP  = { name: 'ประวัตินำเข้า', labels: ['วันเวลา', 'ผู้นำเข้า', 'คลังย่อย', 'ไฟล์', 'จำนวนแถว', 'จำนวนรหัส', 'รหัสที่มีของ', 'รหัสที่ยอดเปลี่ยน'] };
const SETS = { name: 'ตั้งค่า', labels: ['รายการ', 'ค่า (JSON)'] };
const ROUND = { name: 'รอบตรวจนับ', labels: ['รหัสรอบ', 'ชื่อรอบ', 'สถานะ', 'เริ่มโดย', 'เริ่มเมื่อ', 'ปิดเมื่อ', 'ปิดโดย'] };
const CNT  = { name: 'ผลตรวจนับ', labels: ['รหัสรอบ', 'คลังย่อย', 'รหัสพัสดุ', 'คำอธิบาย', 'หน่วย', 'ยอด SAP', 'นับได้', 'ผลต่าง', 'หมายเหตุ', 'ผู้นับ', 'นับเมื่อ'] };
const TGT  = { name: 'ระดับที่ต้องมี', labels: ['คลังย่อย', 'รหัสพัสดุ', 'ต้องมี', 'แก้ไขโดย', 'แก้ไขเมื่อ'] };
const REQ  = { name: 'ใบโอนและใบขอเบิก', labels: ['เลขที่', 'ประเภท', 'จากคลัง', 'ถึงคลัง', 'รายการ (JSON)', 'จำนวนรายการ', 'สถานะ', 'หมายเหตุ', 'สร้างโดย', 'สร้างเมื่อ', 'อัปเดตโดย', 'อัปเดตเมื่อ'] };
const REQ_STATUS = ['ขอแล้ว', 'อนุมัติ', 'รับของแล้ว', 'ยกเลิก'];

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
      if (sl_(r[0]) === sloc) { const m = String(r[1]); before[m] = (before[m] || 0) + (Number(r[4]) || 0); info[m] = [r[2], r[5]]; }
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
    if (out.length) { sh.getRange(2, 1, out.length, 4).setNumberFormat('@'); sh.getRange(2, 1, out.length, CUR.labels.length).setValues(out.map(function (r) { r[0] = sl_(r[0]); return r; })); }
    if (mv.length) { const ms = sheet_(MOVE); ms.getRange(ms.getLastRow() + 1, 2, mv.length, 1).setNumberFormat('@'); ms.getRange(ms.getLastRow() + 1, 1, mv.length, MOVE.labels.length).setValues(mv); }
    const mats = Object.keys(after);
    const ih = sheet_(IMP); ih.getRange(ih.getLastRow() + 1, 3).setNumberFormat('@');
    ih.appendRow([now, me.name, sloc, clean_(b.file), fresh.length, mats.length,
      mats.filter(function (m) { return after[m] > 0; }).length, first ? 'ครั้งแรก' : mv.length]);
    return { sloc: sloc, rows: fresh.length, mats: mats.length, changed: first ? null : mv.length };
  },

  /* ---------- ตรวจนับ ---------- */
  startRound: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'เริ่มรอบตรวจนับได้เฉพาะผู้ดูแลระบบคลัง');
    if (openRound_()) throw err_('bad', 'มีรอบตรวจนับที่ยังเปิดอยู่ ปิดรอบเดิมก่อน');
    const id = 'R' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmm');
    sheet_(ROUND).appendRow([id, clean_(b.name) || ('ตรวจนับ ' + Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy')), 'เปิด', me.name, new Date(), '', '']);
    return { round: openRound_() };
  },
  closeRound: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'ปิดรอบได้เฉพาะผู้ดูแลระบบคลัง');
    const sh = sheet_(ROUND), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.round) && v[i][2] === 'เปิด') {
      sh.getRange(i + 1, 3, 1, 5).setValues([['ปิด', v[i][3], v[i][4], new Date(), me.name]]);
      return { closed: true };
    }
    throw err_('bad', 'ไม่พบรอบที่เปิดอยู่');
  },
  /** บันทึกผลนับ 1 รายการ (ผู้ใช้ศูนย์รวมงานทุกคนนับได้) · qty = null → ลบผลนับ */
  saveCount: function (b, me) {
    const r = openRound_();
    if (!r || r.id !== String(b.round)) throw err_('bad', 'รอบตรวจนับปิดแล้ว หรือไม่ตรงกับรอบปัจจุบัน — กดโหลดใหม่');
    const sloc = sl_(b.sloc), mat = String(b.mat || '');
    if (!/^\d{4}$/.test(sloc) || !/^\d-\d\d-\d{3}-\d{4}$/.test(mat)) throw err_('bad', 'ข้อมูลไม่ครบ');
    const sh = sheet_(CNT), n = sh.getLastRow();
    const v = n > 1 ? sh.getRange(2, 1, n - 1, 3).getValues() : [];
    let row = -1;
    for (let i = 0; i < v.length; i++) if (String(v[i][0]) === r.id && sl_(v[i][1]) === sloc && String(v[i][2]) === mat) { row = i + 2; break; }
    if (b.qty === null || b.qty === '') { if (row > 0) sh.deleteRow(row); return { removed: true }; }
    const q = Number(b.qty), sap = Number(b.sap) || 0;
    if (!isFinite(q) || q < 0) throw err_('bad', 'จำนวนไม่ถูกต้อง');
    const rec = [r.id, sloc, mat, clean_(b.desc), clean_(b.unit), sap, q, round_(q - sap), clean_(b.note), me.name, new Date()];
    if (row < 0) row = sh.getLastRow() + 1;
    sh.getRange(row, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, rec.length).setValues([rec]);
    return { count: cntOut_(rec) };
  },

  /* ---------- จัดหาให้ครบ ---------- */
  /** ตั้งระดับที่ต้องมี: items = [[รหัส, จำนวน]] · จำนวนว่าง = ลบ */
  saveTargets: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'ตั้งระดับที่ต้องมีได้เฉพาะผู้ดูแลระบบคลัง');
    const sloc = sl_(b.sloc);
    if (!/^\d{4}$/.test(sloc)) throw err_('bad', 'รหัสคลังย่อยไม่ถูกต้อง');
    const sh = sheet_(TGT), n = sh.getLastRow();
    const all = n > 1 ? sh.getRange(2, 1, n - 1, TGT.labels.length).getValues() : [];
    const idx = {};
    all.forEach(function (r, i) { if (sl_(r[0]) === sloc) idx[String(r[1])] = i; });
    const now = new Date(), del = {};
    (b.items || []).forEach(function (it) {
      const m = String(it[0] || ''); if (!/^\d-\d\d-\d{3}-\d{4}$/.test(m)) return;
      const empty = it[1] === null || it[1] === '' || it[1] === undefined, t = Number(it[1]);
      if (empty || !isFinite(t) || t < 0) { if (m in idx) del[idx[m]] = 1; return; }
      if (m in idx) all[idx[m]] = [sloc, m, t, me.name, now];
      else { idx[m] = all.length; all.push([sloc, m, t, me.name, now]); }
    });
    const out = all.filter(function (r, i) { return !del[i]; }).map(function (r) { r[0] = sl_(r[0]); return r; });
    if (n > 1) sh.getRange(2, 1, n - 1, TGT.labels.length).clearContent();
    if (out.length) { sh.getRange(2, 1, out.length, 1).setNumberFormat('@'); sh.getRange(2, 1, out.length, TGT.labels.length).setValues(out); }
    return { targets: targets_() };
  },
  /** สร้างใบโอน (transfer) / ใบขอเบิก (requisition): items = [[รหัส, คำอธิบาย, หน่วย, จำนวน]] */
  createRequest: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'สร้างใบโอน/ใบขอเบิกได้เฉพาะผู้ดูแลระบบคลัง');
    const kind = b.kind === 'transfer' ? 'transfer' : 'requisition';
    const items = (b.items || []).filter(function (it) { return it && /^\d-\d\d-\d{3}-\d{4}$/.test(String(it[0])) && Number(it[3]) > 0; })
      .map(function (it) { return [String(it[0]), clean_(it[1]), clean_(it[2]), Number(it[3])]; });
    if (!items.length) throw err_('bad', 'ไม่มีรายการที่จำนวนมากกว่า 0');
    const id = (kind === 'transfer' ? 'TR' : 'RQ') + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
    const sh = sheet_(REQ), row = sh.getLastRow() + 1, now = new Date();
    sh.getRange(row, 3, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, REQ.labels.length).setValues([[id, kind === 'transfer' ? 'ใบโอน' : 'ใบขอเบิก', b.from ? sl_(b.from) : 'K040 คลังกระบี่', sl_(b.to),
      JSON.stringify(items), items.length, 'ขอแล้ว', clean_(b.note), me.name, now, me.name, now]]);
    return { request: requests_().filter(function (r) { return r.id === id; })[0] };
  },
  setRequestStatus: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'เปลี่ยนสถานะได้เฉพาะผู้ดูแลระบบคลัง');
    if (REQ_STATUS.indexOf(b.status) < 0) throw err_('bad', 'สถานะไม่ถูกต้อง');
    const sh = sheet_(REQ), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.id)) {
      sh.getRange(i + 1, 7).setValue(b.status);
      sh.getRange(i + 1, 11, 1, 2).setValues([[me.name, new Date()]]);
      return { ok: true };
    }
    throw err_('bad', 'ไม่พบเอกสาร');
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
    .map(function (r) { return [sl_(r[0]), String(r[1]), String(r[2]), String(r[3]), Number(r[4]) || 0, String(r[5]), Number(r[6]) || 0]; });
  const imp = sheet_(IMP), iv = imp.getLastRow() > 1 ? imp.getRange(2, 1, imp.getLastRow() - 1, IMP.labels.length).getValues() : [];
  const last = {};
  iv.forEach(function (r) { last[sl_(r[2])] = { at: iso_(r[0]), by: String(r[1]), file: String(r[3]) }; });
  const round = openRound_() || lastRound_();
  return { ok: true, version: VERSION, me: { name: me.name, admin: me.admin }, slocs: getSetting_('slocs') || DEFAULT_SLOCS, rows: rows, imports: last,
    round: round, counts: round ? counts_(round.id) : [], targets: targets_(), requests: requests_() };
}

/* ---------------- ตรวจนับ / จัดหา: อ่าน ---------------- */
function rounds_() {
  const sh = sheet_(ROUND); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, ROUND.labels.length).getValues().filter(function (r) { return r[0]; })
    .map(function (r) { return { id: String(r[0]), name: String(r[1]), open: r[2] === 'เปิด', by: String(r[3]), at: iso_(r[4]), closedAt: iso_(r[5]), closedBy: String(r[6] || '') }; });
}
function openRound_() { return rounds_().filter(function (r) { return r.open; }).pop() || null; }
function lastRound_() { return rounds_().pop() || null; }
function cntOut_(r) { return [sl_(r[1]), String(r[2]), Number(r[5]) || 0, Number(r[6]) || 0, String(r[8] || ''), String(r[9] || ''), iso_(r[10])]; }
function counts_(id) {
  const sh = sheet_(CNT); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CNT.labels.length).getValues().filter(function (r) { return String(r[0]) === id; }).map(cntOut_);
}
function targets_() {
  const sh = sheet_(TGT); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(function (r) { return r[1] !== ''; })
    .map(function (r) { return [sl_(r[0]), String(r[1]), Number(r[2]) || 0]; });
}
function requests_() {
  const sh = sheet_(REQ); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, REQ.labels.length).getValues().filter(function (r) { return r[0]; }).slice(-60).reverse()
    .map(function (r) { return { id: String(r[0]), kind: r[1] === 'ใบโอน' ? 'transfer' : 'requisition', from: String(r[2]).length <= 4 ? sl_(r[2]) : String(r[2]), to: sl_(r[3]),
      items: parse_(r[4]) || [], status: String(r[6]), note: String(r[7] || ''), by: String(r[8]), at: iso_(r[9]), upBy: String(r[10] || ''), upAt: iso_(r[11]) }; });
}

function moves_(mat) {
  const sh = sheet_(MOVE);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, MOVE.labels.length).getValues()
    .filter(function (r) { return String(r[2]) === mat; })
    .slice(-50).reverse()
    .map(function (r) { return { at: iso_(r[0]), sloc: sl_(r[1]), before: r[5], after: r[6], diff: r[7], by: String(r[8]) }; });
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
let SS_ = null;
function ss_() {
  if (SS_) return SS_;
  const id = SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('STOCK_SHEET_ID');
  SS_ = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!SS_) throw new Error('ยังไม่ได้ตั้งชีตเก็บข้อมูล — Run ฟังก์ชัน setup ก่อน');
  return SS_;
}
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
function nm_(s) { return String(s == null ? '' : s).replace(/[\s\u200b-\u200d\ufeff]/g, '').toLowerCase(); }
function parse_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
/** รหัสคลังย่อย 4 หลักเสมอ (ชีตอาจแปลง "0023" เป็นตัวเลข 23) */
function sl_(v) { const s = String(v == null ? '' : v).trim(); return /^\d{1,4}$/.test(s) ? ('0000' + s).slice(-4) : s; }
function round_(n) { return Math.round(Number(n) * 1000) / 1000; }
function iso_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(d || ''); }

/** Run ครั้งแรก: สร้างชีต + ขอสิทธิ์ + ทดสอบติดต่อศูนย์รวมงาน */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!SPREADSHEET_ID && !props.getProperty('STOCK_SHEET_ID') && !SpreadsheetApp.getActiveSpreadsheet()) {
    const ss = SpreadsheetApp.create('ระบบคลังพัสดุ กฟส.อ่าวลึก (หลังบ้าน)');
    props.setProperty('STOCK_SHEET_ID', ss.getId());
    SS_ = ss;
  }
  [CUR, MOVE, IMP, SETS, ROUND, CNT, TGT, REQ].forEach(sheet_);
  if (!getSetting_('slocs')) setSetting_('slocs', DEFAULT_SLOCS);
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน — ชีต: ' + ss_().getUrl() + ' — Deploy เป็น Web app แล้วนำลิงก์ …/exec ไปใส่ในหน้าเว็บ');
}
