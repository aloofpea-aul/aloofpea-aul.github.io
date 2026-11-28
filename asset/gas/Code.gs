/**
 * ระบบทรัพย์สิน ผปร. กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บ: https://aloofpea-aul.github.io/asset/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * ติดตั้ง (ครั้งแรก)
 *   1) script.google.com › New project › วางไฟล์นี้ทั้งหมด → บันทึก
 *   2) เลือกฟังก์ชัน setup → Run (กดอนุญาตสิทธิ์) → สร้างชีตเก็บข้อมูล + โฟลเดอร์รูปใน Drive ให้เอง
 *   3) Deploy › New deployment › Web app · Execute as: Me · Who has access: Anyone → Deploy
 *   4) คัดลอกลิงก์ Web app (…/exec) ไปใส่ใน API_DEFAULT ของ asset/index.html
 * อัปเดตโค้ดครั้งต่อไป: วางทับ → Deploy › Manage deployments › ✏️ › Version: New version › Deploy (ลิงก์เดิม)
 *
 * เข้าสู่ระบบ: ชื่อ + รหัสผ่านศูนย์รวมงาน (ตรวจกับศูนย์รวมงานด้วย whoAmI)
 * ดู/ตรวจสภาพ = ผู้ใช้ศูนย์รวมงานทุกคน · นำเข้าทะเบียน/สร้างชุดจำหน่าย/ตั้งค่า = admin ศูนย์รวมงาน
 *   หรือชื่อใน Script Properties › ASSET_ADMINS (คั่นด้วย ,)
 * ไม่มีค่าใช้จ่าย: Google Sheets + Apps Script + Drive ฟรีทั้งหมด
 */

const SPREADSHEET_ID = '';   // ว่าง = ใช้ชีตที่ setup สร้าง (Script Properties › ASSET_SHEET_ID)
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '2.2';
const DONE = 11;   // ขั้นที่ 11 = ปิดชุด (ครบ 10 ขั้นตามแบบฟอร์มจำหน่าย)

const AST = { name: 'ทรัพย์สิน', labels: ['รหัสสินทรัพย์', 'ประเภท', 'WBS/PEA.No', 'รายละเอียด', 'ทะเบียนรถ', 'ยี่ห้อ', 'หมายเลขผู้ผลิต', 'วันที่ได้มา', 'ราคาทุน', 'ผู้ดูแล', 'สถานะ SAP', 'อยู่ในไฟล์ล่าสุด', 'จำหน่ายแล้ว (ชุด)', 'นำเข้าเมื่อ', 'มูลค่าตามบัญชี', 'ค่าเสื่อมสะสม', 'หมวด (SAP)', 'รหัสพนักงาน'] };
const INS = { name: 'ผลตรวจสภาพ', labels: ['รหัสสินทรัพย์', 'สภาพ', 'หมายเหตุ', 'รหัสรูป', 'ผู้ตรวจ', 'ตรวจเมื่อ', 'ที่ตั้ง', 'พิกัด GPS'] };
const BAT = { name: 'ชุดจำหน่าย', labels: ['รหัสชุด', 'ชื่อชุด', 'ขั้น', 'รายการ (JSON)', 'กรรมการ (JSON)', 'เลขที่หนังสือ', 'ซื้อทดแทน (JSON)', 'บันทึกขั้น (JSON)', 'หมายเหตุ', 'สร้างโดย', 'สร้างเมื่อ', 'อัปเดตโดย', 'อัปเดตเมื่อ', 'ข้อมูลเอกสาร (JSON)'] };
const IMP = { name: 'ประวัตินำเข้า', labels: ['วันเวลา', 'ผู้นำเข้า', 'ไฟล์', 'จำนวนรายการ', 'ใหม่', 'หายจากไฟล์'] };
const SETS = { name: 'ตั้งค่า', labels: ['รายการ', 'ค่า (JSON)'] };

const CONDS = ['ใช้ได้', 'ชำรุด', 'เสื่อมสภาพ', 'เลิกใช้', 'ไม่พบ'];
const DEFAULT_SETTINGS = {
  life: { Z51: 5, Z53: 5, Z55: 5, Z57: 5, Z58: 5, Z60: 5, Z63: 5 },
  aliases: {
    'คอนคัตเตอร์คัฟเวอร์': 'Conductor Cover', 'คอนดักเตอร์คัฟเวอร์': 'Conductor Cover',
    'คอนดัคเตอร์คัฟเวอร์': 'Conductor Cover', 'Conductor cover(Class 4)': 'Conductor Cover'
  },
  memo: {
    org: 'กฟส.อ่าวลึก แผนกปฏิบัติการระบบไฟฟ้า', prefix: 'ต.2กฟส.อล.(ปร.)', to: 'ผจก.กฟส.อ่าวลึก',
    proposer: '', proposerTitle: 'หผปร.กฟส.อ่าวลึก'
  }
};

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  return HtmlService.createHtmlOutput('<meta http-equiv="refresh" content="0;url=https://aloofpea-aul.github.io/asset/">ระบบทรัพย์สิน ผปร. กฟส.อ่าวลึก')
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
    if (b.action === 'history') return json_({ ok: true, history: history_(String(b.code || '')) });

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
  /** นำเข้าทะเบียนจาก SAP — rows = [[รหัส, ประเภท, WBS, รายละเอียด, ทะเบียนรถ, ยี่ห้อ, หมายเลข, วันที่ได้มา yyyy-mm-dd, ราคาทุน, ผู้ดูแล, สถานะ SAP, มูลค่าตามบัญชี, ค่าเสื่อมสะสม, หมวด, รหัสพนักงาน]]
   *  รายการเดิมอัปเดตตามไฟล์ · รายการใหม่เพิ่ม · รายการที่ไม่อยู่ในไฟล์ไม่ลบ แต่ทำเครื่องหมาย "ไม่อยู่ในไฟล์ล่าสุด" · ผลตรวจเดิมอยู่ครบ */
  importRegister: function (b, me) {
    admin_(me);
    const rows = (b.rows || []).filter(function (r) { return r && /^\d{6,}-\d{4}$/.test(String(r[0]).trim()); });
    if (!rows.length) throw err_('bad', 'ไม่พบรายการทรัพย์สินในไฟล์');
    if (rows.length > 10000) throw err_('bad', 'ไฟล์ใหญ่เกินไป');
    const sh = sheet_(AST), n = sh.getLastRow(), W = AST.labels.length;
    sh.getRange(1, 1, 1, W).setValues([AST.labels]).setFontWeight('bold').setBackground('#efe8f3');
    const all = n > 1 ? sh.getRange(2, 1, n - 1, W).getValues() : [];
    const idx = {};
    all.forEach(function (r, i) { idx[String(r[0])] = i; r[11] = 'ไม่อยู่'; });
    const now = new Date(); let added = 0;
    rows.forEach(function (r) {
      const code = String(r[0]).trim();
      const num = v => (v === '' || v == null || isNaN(Number(v))) ? '' : Number(v);
      const rec = [code, clean_(r[1]), clean_(r[2]), clean_(r[3]), clean_(r[4]), clean_(r[5]), clean_(r[6]), date_(r[7]), Number(r[8]) || 0, clean_(r[9]), clean_(r[10]), 'อยู่', '', now,
        num(r[11]), num(r[12]), clean_(r[13]), clean_(r[14])];
      if (code in idx) { rec[12] = all[idx[code]][12]; all[idx[code]] = rec; }
      else { idx[code] = all.length; all.push(rec); added++; }
    });
    const gone = all.filter(function (r) { return r[11] !== 'อยู่' && !r[12]; }).length;
    if (n > 1) sh.getRange(2, 1, n - 1, W).clearContent();
    all.forEach(function (r) { while (r.length < W) r.push(''); r.length = W; });
    sh.getRange(2, 1, all.length, 8).setNumberFormat('@');
    sh.getRange(2, 18, all.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, all.length, W).setValues(all);
    sheet_(IMP).appendRow([now, me.name, clean_(b.file), rows.length, n > 1 ? added : 'ครั้งแรก', gone]);
    return { rows: rows.length, added: added, gone: gone };
  },

  /** บันทึกผลตรวจสภาพ 1 รายการ (ผู้ใช้ศูนย์รวมงานทุกคน) · photo = dataURL jpeg (ถ้ามี) */
  inspect: function (b, me) {
    const code = String(b.code || '').trim();
    if (!assetExists_(code)) throw err_('bad', 'ไม่พบรหัสสินทรัพย์นี้ในทะเบียน');
    if (CONDS.indexOf(b.cond) < 0) throw err_('bad', 'เลือกสภาพก่อน');
    let photo = String(b.keepPhoto || '');
    if (b.photo) photo = savePhoto_(code, b.photo);
    if (Array.isArray(b.photos)) photo = b.photos.slice(0, 3).map(function (x) {
      x = String(x || ''); if (!x) return '';
      return /^data:/.test(x) ? savePhoto_(code, x) : x.replace(/[^\w-]/g, '').slice(0, 80);
    }).join(',').replace(/^,+$/, '');
    const gps = /^-?\d{1,2}\.\d+,-?\d{1,3}\.\d+$/.test(String(b.gps || '')) ? String(b.gps) : '';
    const rec = [code, b.cond, clean_(b.note), photo, me.name, new Date(), clean_(b.place).slice(0, 120), gps];
    const sh = sheet_(INS), row = sh.getLastRow() + 1;
    if (sh.getLastColumn() < INS.labels.length) sh.getRange(1, 1, 1, INS.labels.length).setValues([INS.labels]).setFontWeight('bold').setBackground('#efe8f3');
    sh.getRange(row, 1).setNumberFormat('@');
    sh.getRange(row, 1, 1, rec.length).setValues([rec]);
    return { inspection: insOut_(rec) };
  },

  /** สร้างชุดจำหน่ายจากรายการที่เลือก */
  createBatch: function (b, me) {
    admin_(me);
    const codes = uniq_((b.codes || []).map(String)).filter(assetExists_);
    if (!codes.length) throw err_('bad', 'ยังไม่ได้เลือกรายการ');
    oneCat_(codes);
    const busy = inOpenBatch_();
    const dup = codes.filter(function (c) { return busy[c]; });
    if (dup.length) throw err_('bad', 'มี ' + dup.length + ' รายการอยู่ในชุดจำหน่ายอื่นที่ยังไม่ปิด');
    const year = Number(Utilities.formatDate(new Date(), TZ, 'yyyy')) + 543;
    const seq = batches_().filter(function (x) { return x.name.indexOf('/' + year) > 0; }).length + 1;
    const id = 'D' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss');
    const now = new Date();
    const log = { '1': iso_(now) };
    sheet_(BAT).appendRow([id, clean_(b.name) || ('ชุดที่ ' + seq + '/' + year), 1, JSON.stringify(codes), JSON.stringify(['', '', '']), '',
      JSON.stringify({}), JSON.stringify(log), '', me.name, now, me.name, now, JSON.stringify({})]);
    return { batch: batch_(id) };
  },

  /** แก้ไขชุด: ชื่อ กรรมการ เลขหนังสือ ซื้อทดแทน หมายเหตุ รายการ · step = ไปขั้นถัดไป/ย้อน */
  updateBatch: function (b, me) {
    admin_(me);
    const sh = sheet_(BAT), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.id)) {
      const r = v[i];
      if (Number(r[2]) >= DONE && !b.reopen) throw err_('bad', 'ชุดนี้ปิดแล้ว');
      while (r.length < BAT.labels.length) r.push('');
      if (b.name != null) r[1] = clean_(b.name);
      if (b.codes) {
        const busy = inOpenBatch_(String(b.id));
        const codes = uniq_(b.codes.map(String)).filter(function (c) { return assetExists_(c) && !busy[c]; });
        if (!codes.length) throw err_('bad', 'ชุดต้องมีอย่างน้อย 1 รายการ');
        oneCat_(codes);
        r[3] = JSON.stringify(codes);
      }
      if (b.committee) r[4] = JSON.stringify(b.committee.slice(0, 5).map(clean_));
      if (b.docNo != null) r[5] = clean_(b.docNo);
      if (b.replace) r[6] = JSON.stringify(b.replace);
      if (b.note != null) r[8] = clean_(b.note);
      if (b.data && typeof b.data === 'object') {
        const cur = parse_(r[13]) || {};
        Object.keys(b.data).forEach(function (k) { if (/^[A-Za-z0-9]{1,20}$/.test(k)) cur[k] = b.data[k]; });
        const js = JSON.stringify(cur);
        if (js.length > 45000) throw err_('bad', 'ข้อมูลเอกสารยาวเกินไป');
        r[13] = js;
      }
      const log = parse_(r[7]) || {};
      if (b.step) {
        const s = Math.max(1, Math.min(DONE, Number(b.step)));
        if (s > Number(r[2])) log[String(s)] = iso_(new Date());
        else Object.keys(log).forEach(function (k) { if (Number(k) > s) delete log[k]; });
        r[2] = s;
        r[7] = JSON.stringify(log);
        markDisposed_(JSON.parse(r[3]), s >= DONE ? String(r[0]) : '', String(r[0]));
      }
      r[11] = me.name; r[12] = new Date();
      sh.getRange(i + 1, 1, 1, BAT.labels.length).setValues([r]);
      return { batch: batch_(String(b.id)) };
    }
    throw err_('bad', 'ไม่พบชุดจำหน่าย');
  },

  deleteBatch: function (b, me) {
    admin_(me);
    const sh = sheet_(BAT), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.id)) {
      if (Number(v[i][2]) >= DONE) throw err_('bad', 'ชุดที่ปิดแล้วลบไม่ได้');
      sh.deleteRow(i + 1);
      return { deleted: true };
    }
    throw err_('bad', 'ไม่พบชุดจำหน่าย');
  },

  saveSettings: function (b, me) {
    admin_(me);
    const s = settings_();
    if (b.life) Object.keys(b.life).forEach(function (k) { const y = Number(b.life[k]); if (/^Z\d\d$/.test(k) && y > 0 && y < 100) s.life[k] = y; });
    if (b.aliases) { const a = {}; Object.keys(b.aliases).forEach(function (k) { const t = clean_(b.aliases[k]); if (clean_(k) && t && clean_(k) !== t) a[clean_(k)] = t; }); s.aliases = a; }
    if (b.memo) Object.keys(DEFAULT_SETTINGS.memo).forEach(function (k) { if (b.memo[k] != null) s.memo[k] = clean_(b.memo[k]); });
    if (b.office && typeof b.office === 'object') { const o = {}; Object.keys(b.office).slice(0, 60).forEach(function (k) { if (/^[A-Za-z0-9]{1,20}$/.test(k)) o[k] = String(b.office[k] == null ? '' : b.office[k]).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 600); }); s.office = o; }
    setSetting_('settings', s);
    return { settings: s };
  }
};

/* ---------------- อ่าน ---------------- */
function bootstrap_(me) {
  const sh = sheet_(AST);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, AST.labels.length).getValues() : [];
  // [code, cls, wbs, name, plate, brand, serial, acquired, cost, owner, sapStatus, inLatest, disposedBatch, bookValue|null, sapCategory, empId]
  const assets = v.filter(function (r) { return r[0]; }).map(function (r) {
    return [String(r[0]), String(r[1]), String(r[2]), String(r[3]), String(r[4]), String(r[5]), String(r[6]), date_(r[7]), Number(r[8]) || 0, String(r[9]), String(r[10]), r[11] !== 'ไม่อยู่', String(r[12] || ''),
      (r[14] === '' || r[14] == null) ? null : Number(r[14]), String(r[16] || ''), String(r[17] || '')];
  });
  const imp = sheet_(IMP), iv = imp.getLastRow() > 1 ? imp.getRange(imp.getLastRow(), 1, 1, IMP.labels.length).getValues()[0] : null;
  return { ok: true, version: VERSION, me: { name: me.name, admin: me.admin }, assets: assets, inspections: latestIns_(),
    batches: batches_(), settings: settings_(), lastImport: iv ? { at: iso_(iv[0]), by: String(iv[1]), file: String(iv[2]), rows: iv[3] } : null };
}
function insOut_(r) { return [String(r[0]), String(r[1]), String(r[2] || ''), String(r[3] || ''), String(r[4] || ''), iso_(r[5]), String(r[6] || ''), String(r[7] || '')]; }
function latestIns_() {
  const sh = sheet_(INS); if (sh.getLastRow() < 2) return [];
  const last = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, INS.labels.length).getValues().forEach(function (r) { if (r[0]) last[String(r[0])] = r; });
  return Object.keys(last).map(function (k) { return insOut_(last[k]); });
}
function history_(code) {
  const sh = sheet_(INS); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, INS.labels.length).getValues().filter(function (r) { return String(r[0]) === code; }).slice(-30).reverse().map(insOut_);
}
function batches_() {
  const sh = sheet_(BAT); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, BAT.labels.length).getValues().filter(function (r) { return r[0]; }).map(function (r) {
    return { id: String(r[0]), name: String(r[1]), step: Number(r[2]) || 1, codes: parse_(r[3]) || [], committee: parse_(r[4]) || ['', '', ''], docNo: String(r[5] || ''),
      replace: parse_(r[6]) || {}, log: parse_(r[7]) || {}, note: String(r[8] || ''), by: String(r[9]), at: iso_(r[10]), upBy: String(r[11] || ''), upAt: iso_(r[12]), data: parse_(r[13]) || {} };
  });
}
function batch_(id) { return batches_().filter(function (x) { return x.id === id; })[0] || null; }
function inOpenBatch_(except) {
  const m = {};
  batches_().forEach(function (x) { if (x.step < DONE && x.id !== except) x.codes.forEach(function (c) { m[c] = x.id; }); });
  return m;
}
/** จำหน่ายต้องแยกประเภท: 1 ชุด = 1 ประเภททรัพย์สิน (หมวด SAP หรือประเภทหลัก 5 ตัวแรก) */
function oneCat_(codes) {
  const sh = sheet_(AST); if (sh.getLastRow() < 2) return;
  const m = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 17).getValues().forEach(function (r) { m[String(r[0])] = String(r[16] || '') || String(r[1]).slice(0, 5); });
  const cats = uniq_(codes.map(function (c) { return m[c] || ''; }));
  if (cats.length > 1) throw err_('bad', 'จำหน่ายต้องแยกประเภท — ชุดนี้มี ' + cats.length + ' ประเภท: ' + cats.join(', '));
}
let CODES_ = null;
function assetExists_(code) {
  if (!CODES_) {
    CODES_ = {};
    const sh = sheet_(AST);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { CODES_[String(r[0])] = 1; });
  }
  return !!CODES_[String(code)];
}
function markDisposed_(codes, batchId, owner) {
  const sh = sheet_(AST); if (sh.getLastRow() < 2) return;
  const rng = sh.getRange(2, 1, sh.getLastRow() - 1, 13), v = rng.getValues(), set = {};
  codes.forEach(function (c) { set[c] = 1; });
  let changed = false;
  v.forEach(function (r) {
    if (set[String(r[0])]) { r[12] = batchId; changed = true; }
    else if (!batchId && String(r[12]) === owner) { r[12] = ''; changed = true; }
  });
  if (changed) sh.getRange(2, 13, v.length, 1).setValues(v.map(function (r) { return [r[12]]; }));
}
function settings_() {
  const s = getSetting_('settings') || {};
  return {
    life: Object.assign({}, DEFAULT_SETTINGS.life, s.life || {}),
    aliases: s.aliases || DEFAULT_SETTINGS.aliases,
    memo: Object.assign({}, DEFAULT_SETTINGS.memo, s.memo || {}),
    office: s.office || {}
  };
}

/* ---------------- รูป ---------------- */
function photoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('ASSET_PHOTO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const f = DriveApp.createFolder('ภาพตรวจสภาพ ทรัพย์สิน ผปร. กฟส.อ่าวลึก');
  props.setProperty('ASSET_PHOTO_FOLDER', f.getId());
  return f;
}
function savePhoto_(code, dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw err_('bad', 'ไฟล์รูปไม่ถูกต้อง');
  if (m[2].length > 4 * 1024 * 1024) throw err_('bad', 'รูปใหญ่เกินไป');
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], code + '_' + Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '.jpg');
  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getId();
}

/* ---------------- ผู้ใช้ ---------------- */
function admin_(me) { if (!me.admin) throw err_('forbidden', 'ทำได้เฉพาะผู้ดูแลระบบทรัพย์สิน'); }
function who_(user, pass) {
  const role = hubRole_(user, pass);
  if (!role) return null;
  const extra = String(PropertiesService.getScriptProperties().getProperty('ASSET_ADMINS') || '').split(',').map(nm_).filter(String);
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
  const id = SPREADSHEET_ID || PropertiesService.getScriptProperties().getProperty('ASSET_SHEET_ID');
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
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); }
function nm_(s) { return String(s == null ? '' : s).replace(/[\s​-‍﻿]/g, '').toLowerCase(); }
function parse_(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function uniq_(a) { const m = {}; return a.filter(function (x) { if (!x || m[x]) return false; m[x] = 1; return true; }); }
function date_(v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); const s = String(v || '').trim(); return /^\d{4}-\d\d-\d\d$/.test(s) ? s : ''; }
function iso_(d) { return d instanceof Date ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(d || ''); }

/** Run ครั้งแรก: สร้างชีต + โฟลเดอร์รูป + ขอสิทธิ์ + ทดสอบติดต่อศูนย์รวมงาน */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!SPREADSHEET_ID && !props.getProperty('ASSET_SHEET_ID') && !SpreadsheetApp.getActiveSpreadsheet()) {
    const ss = SpreadsheetApp.create('ระบบทรัพย์สิน ผปร. กฟส.อ่าวลึก (หลังบ้าน)');
    props.setProperty('ASSET_SHEET_ID', ss.getId());
    SS_ = ss;
  }
  [AST, INS, BAT, IMP, SETS].forEach(sheet_);
  [AST, BAT].forEach(function (d) { sheet_(d).getRange(1, 1, 1, d.labels.length).setValues([d.labels]).setFontWeight('bold').setBackground('#efe8f3'); });
  if (!getSetting_('settings')) setSetting_('settings', DEFAULT_SETTINGS);
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  photoFolder_();
  UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  Logger.log('พร้อมใช้งาน — ชีต: ' + ss_().getUrl() + ' — Deploy เป็น Web app แล้วนำลิงก์ …/exec ไปใส่ในหน้าเว็บ');
}
