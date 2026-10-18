/**
 * ระบบยานพาหนะ กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บอยู่ที่ https://aloofpea-aul.github.io/vehicle/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * วิธีติดตั้ง: วางไฟล์นี้แทน Code.gs เดิมในโปรเจกต์ Apps Script ระบบยานพาหนะ
 *   → Deploy › Manage deployments › ✏️ แก้ไข › Version: New version › Deploy
 *   (ตั้งค่า Execute as: Me · Who has access: Anyone)
 * ใช้ชีตเดิมทั้งหมด ไม่ย้าย ไม่ลบข้อมูล — ถ้าชีตไหนไม่มีคอลัมน์ ID จะเติมคอลัมน์ใหม่ต่อท้ายให้เอง
 * ล็อกอิน = บัญชีศูนย์รวมงาน (ตรวจกับหลังบ้านศูนย์รวมงาน จำผล 6 ชม.)
 * ผู้ดูแลระบบยานพาหนะ = admin ของศูนย์รวมงาน + ชื่อที่ใส่ใน Script Properties › VEHICLE_ADMINS (คั่นด้วย ,)
 */

const SPREADSHEET_ID = '1arrcSr5twdOkuIHr_XLfwL9ezGPtSGbZ52v1Vo12gu4';
const IMAGE_FOLDER_ID = '1jEK9tp1WO7dzeSRJT8NY6zUDxSSl537N';
const WEB_URL = 'https://aloofpea-aul.github.io/vehicle/';
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '15.1';

const SH = {
  CARS:  { name: 'รายการใช้รถ',  cols: ['ID', 'Plate', 'Model', 'Status', 'Mile', 'Image', 'User', 'UserId', 'CreatedDate'] },
  LOGS:  { name: 'Logใช้งานรถ',  cols: ['Date', 'User', 'Action', 'Detail', 'StartMile', 'EndMile', 'Status', 'CarId', 'ReturnDate', 'ReturnBy'] },
  BOOK:  { name: 'การจอง',       cols: ['ID', 'StartDate', 'EndDate', 'Mission', 'Status', 'User', 'CarPlate', 'CreatedDate'] },
  MAINT: { name: 'การซ่อมบำรุง', cols: ['ID', 'Date', 'CarPlate', 'Type', 'Cost', 'Note', 'By', 'Mile'] }
};
// ชื่อหัวคอลัมน์รุ่นเก่าที่หมายถึงคอลัมน์เดียวกัน
const ALIAS = { StartMile: ['Ref1'], EndMile: ['Ref2'], CarPlate: ['Plate'] };

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  // ลิงก์เดิม (script.google.com/.../exec) → เปิดหน้าใหม่บน GitHub ให้อัตโนมัติ
  // 1) พยายามพาทั้งหน้าไปที่ลิงก์ใหม่  2) ถ้าเบราว์เซอร์ไม่ยอม ก็แสดงระบบใหม่เต็มจอในหน้านี้เลย
  const html = '<!doctype html><html><head><base target="_top"><style>' +
    'html,body{margin:0;height:100%;overflow:hidden;background:#F5F3F7}' +
    'iframe{position:fixed;inset:0;width:100%;height:100%;border:0}' +
    '</style></head><body>' +
    '<iframe src="' + WEB_URL + '?from=old" allow="camera; geolocation; clipboard-write"></iframe>' +
    '<script>try{window.top.location.replace("' + WEB_URL + '")}catch(e){}</script>' +
    '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('ระบบยานพาหนะ กฟส.อ่าวลึก')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  try {
    const me = who_(b.user, b.pass);
    if (!me) return json_({ ok: false, error: 'unauthorized', message: 'ชื่อหรือรหัสผ่านศูนย์รวมงานไม่ถูกต้อง' });
    if (b.action === 'bootstrap') return json_(bootstrap_(me));

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const fn = ACTIONS[b.action];
      if (!fn) return json_({ ok: false, error: 'unknown action' });
      const msg = fn(b, me);
      SpreadsheetApp.flush();
      const out = bootstrap_(me);
      out.message = msg || 'บันทึกแล้ว';
      return json_(out);
    } finally { lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

const ACTIONS = {
  /* ---------- เบิก / คืนรถ ---------- */
  checkout: function (b, me) {
    const mission = clean_(b.mission);
    if (mission.length < 2) throw new Error('กรุณากรอกภารกิจ/จุดหมาย');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.carId);
    if (r == null) throw new Error('ไม่พบรถคันนี้');
    if (String(get_(t, r, 'Status')) === 'in-use') throw new Error('รถคันนี้มีคนเบิกใช้อยู่แล้ว — กดรีเฟรชเพื่อดูสถานะล่าสุด');
    set_(t, r, { Status: 'in-use', User: me.name, UserId: me.name });
    const plate = get_(t, r, 'Plate'), mile = Number(get_(t, r, 'Mile')) || 0;
    append_(table_(SH.LOGS), { Date: new Date(), User: me.name, Action: plate, Detail: mission,
      StartMile: mile, EndMile: '', Status: 'in-use', CarId: get_(t, r, 'ID') });
    // ถ้ามีการจองของตัวเองสำหรับช่วงนี้ (รถคันนี้ หรือไม่ระบุรถ) → ปิดการจองเป็น "รับรถแล้ว"
    const B = table_(SH.BOOK), now = new Date(), soon = new Date(now.getTime() + 3 * 3600000);
    for (let i = 0; i < B.rows.length; i++) {
      const row = B.rows[i], st = String(row[B.h.Status]);
      if (String(row[B.h.User]) !== me.name || (st !== 'approved' && st !== 'pending')) continue;
      const bp = String(row[B.h.CarPlate] || '-'), s2 = parseDate_(row[B.h.StartDate]), e2 = parseDate_(row[B.h.EndDate]);
      if ((bp === plate || bp === '-') && s2 && e2 && s2 <= soon && e2 >= now) { set_(B, i, { Status: 'used', CarPlate: plate }); break; }
    }
    return 'เบิกรถ ' + plate + ' แล้ว';
  },

  returnCar: function (b, me) {
    const endMile = Number(b.endMile);
    if (!isFinite(endMile) || endMile <= 0) throw new Error('กรุณากรอกเลขไมล์');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.carId);
    if (r == null) throw new Error('ไม่พบรถคันนี้');
    if (String(get_(t, r, 'Status')) !== 'in-use') throw new Error('รถคันนี้คืนแล้ว — กดรีเฟรชเพื่อดูสถานะล่าสุด');
    const holder = String(get_(t, r, 'User') || '');
    if (!me.admin && holder && holder !== me.name) throw new Error('คืนได้เฉพาะผู้เบิก (' + holder + ') หรือผู้ดูแลระบบ');
    const start = Number(get_(t, r, 'Mile')) || 0;
    if (endMile < start) throw new Error('เลขไมล์ต้องไม่น้อยกว่าเลขไมล์เดิม (' + start.toLocaleString() + ' กม.)');
    const plate = String(get_(t, r, 'Plate')), carId = String(get_(t, r, 'ID'));
    set_(t, r, { Status: 'available', Mile: endMile, User: '', UserId: '' });
    const L = table_(SH.LOGS);
    for (let i = L.rows.length - 1; i >= 0; i--) {
      const lr = L.rows[i], same = String(lr[L.h.CarId]) === carId || (!lr[L.h.CarId] && String(lr[L.h.Action]) === plate);
      if (same && String(lr[L.h.Status]) === 'in-use') {
        set_(L, i, { EndMile: endMile, Status: 'completed', ReturnDate: new Date(), ReturnBy: me.name });
        break;
      }
    }
    return 'คืนรถ ' + plate + ' แล้ว (ใช้ไป ' + (endMile - start).toLocaleString() + ' กม.)';
  },

  /* ---------- จองรถ ---------- */
  booking: function (b, me) {
    const s = parseDate_(b.start), e = parseDate_(b.end), mission = clean_(b.mission);
    if (!s || !e) throw new Error('กรุณาเลือกวันเวลาเริ่มและสิ้นสุด');
    if (e <= s) throw new Error('เวลาสิ้นสุดต้องหลังเวลาเริ่ม');
    if (mission.length < 2) throw new Error('กรุณากรอกภารกิจ');
    const plate = clean_(b.plate) || '-';
    const t = table_(SH.BOOK);
    conflict_(t, plate, s, e, null);
    append_(t, { ID: nextId_(t), StartDate: s, EndDate: e, Mission: mission, Status: me.admin ? 'approved' : 'pending',
      User: me.name, CarPlate: plate, CreatedDate: new Date() });
    return me.admin ? 'จองแล้ว (อนุมัติอัตโนมัติ)' : 'ส่งคำขอจองแล้ว รอผู้ดูแลอนุมัติ';
  },

  bookingStatus: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    if (['approved', 'rejected', 'pending'].indexOf(b.status) < 0) throw new Error('สถานะไม่ถูกต้อง');
    const t = table_(SH.BOOK), r = findRow_(t, 'ID', b.id);
    if (r == null) throw new Error('ไม่พบรายการจอง');
    const v = { Status: b.status };
    if (b.status === 'approved') {                      // อนุมัติพร้อมจัดรถให้ได้ (จองแบบไม่ระบุรถ)
      const plate = clean_(b.plate) || String(get_(t, r, 'CarPlate') || '-');
      conflict_(t, plate, parseDate_(get_(t, r, 'StartDate')), parseDate_(get_(t, r, 'EndDate')), r);
      v.CarPlate = plate;
    }
    set_(t, r, v);
    return b.status === 'approved' ? 'อนุมัติแล้ว' : b.status === 'rejected' ? 'ไม่อนุมัติ' : 'บันทึกแล้ว';
  },

  bookingDelete: function (b, me) {
    const t = table_(SH.BOOK), r = findRow_(t, 'ID', b.id);
    if (r == null) throw new Error('ไม่พบรายการจอง');
    if (!me.admin && String(t.rows[r][t.h.User]) !== me.name) throw new Error('ยกเลิกได้เฉพาะการจองของตัวเอง');
    t.sh.deleteRow(r + 2);
    return 'ยกเลิกการจองแล้ว';
  },

  /* ---------- ซ่อมบำรุง ---------- */
  maintSave: function (b, me) {
    const plate = clean_(b.plate), type = clean_(b.type), cost = Number(b.cost || 0);
    if (!plate) throw new Error('กรุณาเลือกรถ');
    if (type.length < 2) throw new Error('กรุณากรอกรายการซ่อม');
    if (!isFinite(cost) || cost < 0) throw new Error('ค่าใช้จ่ายไม่ถูกต้อง');
    const t = table_(SH.MAINT);
    append_(t, { ID: nextId_(t), Date: parseDate_(b.date) || new Date(), CarPlate: plate, Type: type,
      Cost: cost, Note: clean_(b.note), By: me.name, Mile: Number(b.mile) > 0 ? Number(b.mile) : '' });
    if (b.mile) {                                         // ถ้ากรอกเลขไมล์ตอนซ่อม อัปเดตเลขไมล์รถด้วย
      const c = table_(SH.CARS), r = findRow_(c, 'Plate', plate), m = Number(b.mile);
      if (r != null && m > (Number(get_(c, r, 'Mile')) || 0)) set_(c, r, { Mile: m });
    }
    return 'บันทึกการซ่อมแล้ว';
  },

  maintDelete: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    const t = table_(SH.MAINT), r = findRow_(t, 'ID', b.id);
    if (r == null) throw new Error('ไม่พบรายการ');
    t.sh.deleteRow(r + 2);
    return 'ลบรายการแล้ว';
  },

  /* ---------- จัดการรถ (ผู้ดูแล) ---------- */
  vehicleSave: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    const plate = clean_(b.plate).toUpperCase(), model = clean_(b.model), mile = Number(b.mile || 0);
    if (plate.length < 2) throw new Error('กรุณากรอกทะเบียนรถ');
    if (!isFinite(mile) || mile < 0) throw new Error('เลขไมล์ไม่ถูกต้อง');
    const t = table_(SH.CARS);
    const dup = t.rows.findIndex(function (row) { return String(row[t.h.Plate]).toUpperCase() === plate && String(row[t.h.ID]) !== String(b.id || ''); });
    if (dup >= 0) throw new Error('ทะเบียน ' + plate + ' มีในระบบแล้ว');
    let img = '';
    if (b.image && String(b.image).indexOf('data:image') === 0) img = saveImage_(b.image, 'car_' + plate + '_' + Date.now() + '.jpg');
    if (b.id) {
      const r = findRow_(t, 'ID', b.id);
      if (r == null) throw new Error('ไม่พบรถ');
      const v = { Plate: plate, Model: model, Mile: mile };
      if (img) v.Image = img;
      set_(t, r, v);
      return 'แก้ไขข้อมูลรถแล้ว';
    }
    append_(t, { ID: nextId_(t), Plate: plate, Model: model, Status: 'available', Mile: mile, Image: img, User: '', UserId: '', CreatedDate: new Date() });
    return 'เพิ่มรถ ' + plate + ' แล้ว';
  },

  vehiclePhoto: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    if (!b.image || String(b.image).indexOf('data:image') !== 0) throw new Error('กรุณาเลือกรูป');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.id);
    if (r == null) throw new Error('ไม่พบรถ');
    set_(t, r, { Image: saveImage_(b.image, 'car_' + get_(t, r, 'Plate') + '_' + Date.now() + '.jpg') });
    return 'บันทึกรูปรถแล้ว';
  },

  vehicleDelete: function (b, me) {
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.id);
    if (r == null) throw new Error('ไม่พบรถ');
    if (String(get_(t, r, 'Status')) === 'in-use') throw new Error('รถกำลังถูกใช้งาน ลบไม่ได้');
    t.sh.deleteRow(r + 2);
    return 'ลบรถแล้ว';
  }
};

/* ====================================================================== */

function bootstrap_(me) {
  const C = table_(SH.CARS), L = table_(SH.LOGS), B = table_(SH.BOOK), M = table_(SH.MAINT);
  const since = {};                                     // เวลาเบิกของรถที่กำลังใช้งาน
  L.rows.forEach(function (r) {
    if (String(r[L.h.Status]) !== 'in-use') return;
    const k = String(r[L.h.CarId] || '') || 'p:' + r[L.h.Action];
    since[k] = { at: iso_(r[L.h.Date]), mission: String(r[L.h.Detail] || '') };
  });
  const vehicles = C.rows.filter(function (r) { return r[C.h.ID] !== '' && r[C.h.Plate] !== ''; }).map(function (r) {
    const inUse = String(r[C.h.Status] || 'available') === 'in-use';
    const sc = inUse ? (since[String(r[C.h.ID])] || since['p:' + r[C.h.Plate]] || {}) : {};
    return { id: String(r[C.h.ID]), plate: String(r[C.h.Plate]), model: String(r[C.h.Model] || ''),
      status: inUse ? 'in-use' : 'available', mile: Number(r[C.h.Mile]) || 0, image: imgUrl_(r[C.h.Image]),
      user: inUse ? String(r[C.h.User] || '') : '', since: sc.at || '', mission: sc.mission || '' };
  });
  const logs = L.rows.slice(-150).reverse().map(function (r) {
    return { date: iso_(r[L.h.Date]), user: String(r[L.h.User] || ''), plate: String(r[L.h.Action] || ''),
      mission: String(r[L.h.Detail] || ''), startMile: num_(r[L.h.StartMile]), endMile: num_(r[L.h.EndMile]),
      status: String(r[L.h.Status] || ''), returnDate: iso_(r[L.h.ReturnDate]), returnBy: String(r[L.h.ReturnBy] || '') };
  });
  const bookings = B.rows.slice(-300).reverse().map(function (r) {
    return { id: String(r[B.h.ID]), start: iso_(r[B.h.StartDate]), end: iso_(r[B.h.EndDate]),
      mission: String(r[B.h.Mission] || ''), status: String(r[B.h.Status] || 'pending'),
      user: String(r[B.h.User] || ''), plate: String(r[B.h.CarPlate] || '-') };
  }).filter(function (x) { return x.start; });
  const maint = M.rows.slice(-200).reverse().map(function (r) {
    return { id: String(r[M.h.ID]), date: iso_(r[M.h.Date]), plate: String(r[M.h.CarPlate] || ''),
      type: String(r[M.h.Type] || ''), cost: num_(String(r[M.h.Cost]).replace(/[,฿\s]/g, '')), note: String(r[M.h.Note] || ''),
      by: String(r[M.h.By] || ''), mile: num_(r[M.h.Mile]) };
  });
  return { ok: true, version: VERSION, me: me, vehicles: vehicles, logs: logs, bookings: bookings, maint: maint, at: iso_(new Date()) };
}

/** รถคันเดียวกันห้ามจองซ้อนเวลา (ไม่นับรายการที่ไม่อนุมัติ/ใช้แล้ว และรายการที่กำลังแก้) */
function conflict_(t, plate, s, e, skipRow) {
  if (!plate || plate === '-' || !s || !e) return;
  t.rows.forEach(function (row, i) {
    if (i === skipRow || String(row[t.h.CarPlate]) !== plate) return;
    const st = String(row[t.h.Status]); if (st === 'rejected' || st === 'used') return;
    const s2 = parseDate_(row[t.h.StartDate]), e2 = parseDate_(row[t.h.EndDate]);
    if (s2 && e2 && s < e2 && s2 < e) throw new Error('รถ ' + plate + ' ถูกจองช่วงนี้แล้ว โดย ' + row[t.h.User] + ' (' + fmt_(s2) + ' – ' + fmt_(e2) + ')');
  });
}

/* ---------- ล็อกอินศูนย์รวมงาน ---------- */
function who_(user, pass) {
  user = String(user || '').trim(); pass = String(pass || '');
  if (!user || !pass) return null;
  const key = 'hub_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, user + '\u0001' + pass));
  const cache = CacheService.getScriptCache();
  let role = cache.get(key);
  if (role == null) {
    try {
      const res = UrlFetchApp.fetch(HUB_API, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
        payload: JSON.stringify({ action: 'whoAmI', changedBy: user, changedByPassword: pass }) });
      const r = JSON.parse(res.getContentText());
      role = (r && r.role) ? String(r.role) : '';
    } catch (e) { return null; }                     // ตรวจไม่ได้ = ไม่ให้ (ไม่จำผล)
    cache.put(key, role, role ? 21600 : 120);
  }
  if (!role) return null;
  const extra = String(PropertiesService.getScriptProperties().getProperty('VEHICLE_ADMINS') || '')
    .split(',').map(function (s) { return s.trim(); }).filter(String);
  return { name: user, role: role, admin: role === 'admin' || extra.indexOf(user) >= 0 || oldAdmins_().indexOf(user) >= 0 };
}

/** ผู้ดูแลจากระบบสมาชิกเดิม (ชีต "ระบบสมาชิก" คอลัมน์ Role = admin) — ใช้ชื่อเดียวกับศูนย์รวมงาน */
function oldAdmins_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('oldAdmins');
  if (hit != null) return JSON.parse(hit);
  let list = [];
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('ระบบสมาชิก');
    if (sh && sh.getLastRow() > 1) {
      const v = sh.getDataRange().getValues(), h = v[0].map(String), ni = h.indexOf('Name'), ri = h.indexOf('Role');
      if (ni >= 0 && ri >= 0) list = v.slice(1).filter(function (r) { return String(r[ri]).toLowerCase() === 'admin'; })
        .map(function (r) { return String(r[ni]).trim(); }).filter(String);
    }
  } catch (e) {}
  cache.put('oldAdmins', JSON.stringify(list), 3600);
  return list;
}

/* ---------- ตาราง: อ่าน/เขียนตามชื่อหัวคอลัมน์ (รองรับชีตรุ่นเก่า) ---------- */
function table_(def) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(def.name);
  if (!sh) { sh = ss.insertSheet(def.name); sh.appendRow(def.cols); }
  let head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (x) { return String(x).trim(); });
  const h = {};
  def.cols.forEach(function (c) {
    let i = head.indexOf(c);
    if (i < 0 && ALIAS[c]) ALIAS[c].some(function (a) { i = head.indexOf(a); return i >= 0; });
    if (i < 0) {                                       // ไม่มีคอลัมน์นี้ → เติมต่อท้าย (ไม่ขยับข้อมูลเดิม)
      i = head.length; sh.getRange(1, i + 1).setValue(c).setFontWeight('bold'); head.push(c);
    }
    h[c] = i;
  });
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, head.length).getValues() : [];
  const t = { sh: sh, h: h, rows: rows, width: head.length };
  if (h.ID != null && def !== SH.LOGS) fillIds_(t);
  return t;
}

function fillIds_(t) {
  const missing = [];
  t.rows.forEach(function (r, i) { if (r[t.h.ID] === '' && r.some(function (v) { return v !== ''; })) missing.push(i); });
  if (!missing.length) return;
  let id = nextId_(t);
  missing.forEach(function (i) { t.rows[i][t.h.ID] = id; t.sh.getRange(i + 2, t.h.ID + 1).setValue(id); id++; });
}

function nextId_(t) {
  let max = 0;
  t.rows.forEach(function (r) { const v = parseInt(r[t.h.ID], 10); if (!isNaN(v) && v > max) max = v; });
  return max + 1;
}
function findRow_(t, col, val) {
  const i = t.rows.findIndex(function (r) { return String(r[t.h[col]]) === String(val); });
  return i < 0 ? null : i;
}
function get_(t, r, col) { return t.rows[r][t.h[col]]; }
function set_(t, r, obj) {
  Object.keys(obj).forEach(function (k) { t.sh.getRange(r + 2, t.h[k] + 1).setValue(obj[k]); t.rows[r][t.h[k]] = obj[k]; });
}
function append_(t, obj) {
  const row = new Array(t.width).fill('');
  Object.keys(obj).forEach(function (k) { if (t.h[k] != null) row[t.h[k]] = obj[k]; });
  t.sh.appendRow(row);
  t.rows.push(row);
}

/* ---------- รูป ---------- */
function saveImage_(dataUrl, filename) {
  const parts = String(dataUrl).split(',');
  const type = parts[0].split(':')[1].split(';')[0];
  const blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), type, filename);
  const file = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}
/** ลิงก์ uc?export=view ของ Drive ไม่แสดงในเว็บอื่นแล้ว — แปลงเป็นลิงก์รูปย่อที่แสดงได้ */
function imgUrl_(v) {
  const s = String(v || '');
  const m = s.match(/[?&]id=([\w-]+)/) || s.match(/\/d\/([\w-]+)/);
  return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800' : s;
}

/* ---------- ช่วย ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); }
function num_(v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); }
function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);           // dd/MM/yyyy HH:mm
  if (m) { let y = +m[3]; if (y > 2400) y -= 543; return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)); }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function iso_(v) { const d = parseDate_(v); return d ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm") : ''; }
function fmt_(d) { return Utilities.formatDate(d, TZ, 'dd/MM HH:mm'); }

/** กด Run ฟังก์ชันนี้ครั้งแรกใน Apps Script เพื่ออนุญาตสิทธิ์ (Sheets / Drive / เชื่อมต่อภายนอก) */
function setup() {
  [SH.CARS, SH.LOGS, SH.BOOK, SH.MAINT].forEach(table_);
  UrlFetchApp.fetch(HUB_API + '?ping=1', { muteHttpExceptions: true });
  DriveApp.getFolderById(IMAGE_FOLDER_ID).getName();
  Logger.log('พร้อมใช้งาน v' + VERSION);
}
