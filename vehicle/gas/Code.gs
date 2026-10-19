/**
 * ระบบยานพาหนะ กฟส.อ่าวลึก — หลังบ้าน (JSON API)
 * หน้าเว็บ: https://aloofpea-aul.github.io/vehicle/  (GitHub Pages ในศูนย์รวมงาน)
 *
 * ติดตั้ง: วางไฟล์นี้แทน Code.gs เดิม → Run ฟังก์ชัน setup 1 ครั้ง (อนุญาตสิทธิ์)
 *   → Deploy › Manage deployments › ✏️ › Version: New version › Deploy  (Execute as: Me · Who has access: Anyone)
 *
 * ข้อมูล: ใช้ชีตเดิมทั้งหมด อ่าน/เขียน "ตามตำแหน่งคอลัมน์" แบบเดียวกับระบบเดิม (หัวคอลัมน์ในชีตเดิมไม่ตรงกับข้อมูล)
 * เข้าสู่ระบบได้ 2 แบบ
 *   1) รหัสพนักงาน + รหัสผ่านเดิมของระบบยานพาหนะ (ชีต "ระบบสมาชิก")
 *   2) ชื่อ + รหัสผ่านศูนย์รวมงาน กฟส.อ่าวลึก
 * ผู้ดูแล = บทบาท admin ในชีต "ระบบสมาชิก" · admin ของศูนย์รวมงาน · ชื่อใน Script Properties › VEHICLE_ADMINS (คั่นด้วย ,)
 */

const SPREADSHEET_ID = '1arrcSr5twdOkuIHr_XLfwL9ezGPtSGbZ52v1Vo12gu4';
const IMAGE_FOLDER_ID = '1jEK9tp1WO7dzeSRJT8NY6zUDxSSl537N';
const WEB_URL = 'https://aloofpea-aul.github.io/vehicle/';
const HUB_API = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const TZ = 'Asia/Bangkok';
const VERSION = '16.3';

// ตำแหน่งคอลัมน์ตามข้อมูลจริงในชีต (A, B, C, …) + ป้ายหัวคอลัมน์ภาษาไทย
const SH = {
  CARS:  { name: 'รายการใช้รถ', cols: ['ID', 'Plate', 'Model', 'Status', 'Mile', 'Image', 'User', 'UserId', 'CreatedDate'],
           labels: ['ID', 'ทะเบียน', 'รุ่น', 'สถานะ', 'เลขไมล์', 'รูป', 'ผู้ใช้', 'รหัสผู้ใช้', 'วันที่เพิ่ม'] },
  LOGS:  { name: 'Logใช้งานรถ', cols: ['Date', 'User', 'Action', 'Detail', 'StartMile', 'EndMile', 'Status', 'CarId', 'ReturnDate', 'ReturnBy'],
           labels: ['วันเวลา', 'ผู้ใช้', 'รถ', 'ภารกิจ', 'เลขไมล์ก่อนออก', 'เลขไมล์กลับ', 'สถานะ', 'รหัสรถ', 'วันเวลาคืน', 'ผู้คืน'] },
  BOOK:  { name: 'การจอง', cols: ['ID', 'StartDate', 'EndDate', 'Mission', 'Status', 'User', 'CarPlate', 'CreatedDate'],
           labels: ['ID', 'เริ่ม', 'สิ้นสุด', 'ภารกิจ', 'สถานะ', 'ผู้จอง', 'ทะเบียน', 'วันที่จอง'] },
  MAINT: { name: 'การซ่อมบำรุง', cols: ['ID', 'Date', 'CarPlate', 'Type', 'Cost', 'Note', 'By', 'Mile'],
           labels: ['ID', 'วันที่', 'ทะเบียน', 'รายการ', 'ค่าใช้จ่าย', 'หมายเหตุ', 'ผู้บันทึก', 'เลขไมล์'] }
};
const MEMBERS = 'ระบบสมาชิก';   // A รหัสพนักงาน · B รหัสผ่าน · C ชื่อ · D ตำแหน่ง · E แผนก · F บทบาท · G วันเวลา

/* ====================================================================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'ping') return json_({ ok: true, version: VERSION });
  // ลิงก์เดิม (script.google.com/.../exec) → เปิดหน้าใหม่ให้อัตโนมัติ
  // พยายามพาทั้งหน้าไปลิงก์ใหม่ ถ้าเบราว์เซอร์ไม่ยอม ก็แสดงระบบใหม่เต็มจอในหน้านี้
  const html = '<!doctype html><html><head><base target="_top"><style>' +
    'html,body{margin:0;height:100%;overflow:hidden;background:#F5F3F7}' +
    'iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style></head><body>' +
    '<iframe src="' + WEB_URL + '?from=old" allow="camera; clipboard-write"></iframe>' +
    '<script>try{window.top.location.replace("' + WEB_URL + '")}catch(e){}</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('ระบบยานพาหนะ กฟส.อ่าวลึก')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  try {
    migrate_();
    if (b.action === 'register') return json_(register_(b));
    if (!b.user || !b.pass) return json_({ ok: false, error: 'unauthorized', message: 'กรุณาเข้าสู่ระบบ' });
    let me;
    try { me = who_(b.user, b.pass); }
    catch (err) {
      return json_({ ok: false, error: 'hub', message: 'ตรวจสอบกับศูนย์รวมงานไม่ได้ — ลองเข้าด้วยรหัสพนักงานแทน หรือให้ผู้ดูแลกด Run setup (' + String(err.message || err).slice(0, 100) + ')' });
    }
    if (!me) return json_({ ok: false, error: 'unauthorized', message: 'รหัสพนักงาน/ชื่อ หรือรหัสผ่านไม่ถูกต้อง' });
    if (b.action === 'bootstrap') return json_(bootstrap_(me));

    const fn = ACTIONS[b.action];
    if (!fn) return json_({ ok: false, error: 'unknown action' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const msg = fn(b, me);
      SpreadsheetApp.flush();
      const out = bootstrap_(me);
      out.message = msg || 'บันทึกแล้ว';
      return json_(out);
    } finally { lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: 'error', message: String(err.message || err) });
  }
}

const ACTIONS = {
  /* ---------- เบิก / คืนรถ ---------- */
  checkout: function (b, me) {
    const mission = clean_(b.mission);
    if (mission.length < 2) throw new Error('กรุณากรอกภารกิจ/จุดหมาย');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.carId);
    if (r == null) throw new Error('ไม่พบรถคันนี้');
    if (String(get_(t, r, 'Status')) === 'in-use') {
      const holder = String(get_(t, r, 'User') || '');
      if (nm_(holder) === nm_(me.name)) return 'เบิกรถ ' + get_(t, r, 'Plate') + ' ไว้แล้ว (บันทึกสำเร็จตั้งแต่ครั้งแรก)';   // กดซ้ำ/เน็ตช้า
      throw new Error('รถคันนี้ ' + (holder ? holder + ' ' : '') + 'เบิกใช้อยู่ — กดรีเฟรชเพื่อดูสถานะล่าสุด');
    }
    const plate = String(get_(t, r, 'Plate')), mile = Number(get_(t, r, 'Mile')) || 0;
    set_(t, r, { Status: 'in-use', User: me.name, UserId: me.empId || '' });
    append_(table_(SH.LOGS), { Date: new Date(), User: me.name, Action: plate, Detail: mission,
      StartMile: mile, EndMile: '', Status: 'in-use', CarId: get_(t, r, 'ID') });
    // การจองของตัวเองช่วงนี้ (รถคันนี้หรือไม่ระบุรถ) → "รับรถแล้ว"
    const B = table_(SH.BOOK), now = new Date(), soon = new Date(now.getTime() + 3 * 3600000);
    for (let i = 0; i < B.rows.length; i++) {
      const row = B.rows[i], st = String(row[B.h.Status]);
      if (nm_(row[B.h.User]) !== nm_(me.name) || (st !== 'approved' && st !== 'pending')) continue;
      const bp = String(row[B.h.CarPlate] || '-'), s2 = parseDate_(row[B.h.StartDate]), e2 = parseDate_(row[B.h.EndDate]);
      if ((np_(bp) === np_(plate) || bp === '-' || bp === '') && s2 && e2 && s2 <= soon && e2 >= now) { set_(B, i, { Status: 'used', CarPlate: plate }); break; }
    }
    return 'เบิกรถ ' + plate + ' แล้ว';
  },

  returnCar: function (b, me) {
    const endMile = Number(b.endMile);
    if (!isFinite(endMile) || endMile <= 0) throw new Error('กรุณากรอกเลขไมล์');
    const t = table_(SH.CARS), r = findRow_(t, 'ID', b.carId);
    if (r == null) throw new Error('ไม่พบรถคันนี้');
    if (String(get_(t, r, 'Status')) !== 'in-use') {
      if (Number(get_(t, r, 'Mile')) === endMile) return 'คืนรถ ' + get_(t, r, 'Plate') + ' แล้ว (บันทึกสำเร็จตั้งแต่ครั้งแรก)';  // กดซ้ำ/เน็ตช้า
      throw new Error('รถคันนี้คืนแล้ว — กดรีเฟรชเพื่อดูสถานะล่าสุด');
    }
    const holder = String(get_(t, r, 'User') || '');
    if (!me.admin && holder && nm_(holder) !== nm_(me.name)) throw new Error('คืนได้เฉพาะผู้เบิก (' + holder + ') หรือผู้ดูแลระบบ');
    const start = Number(get_(t, r, 'Mile')) || 0;
    if (endMile < start) throw new Error('เลขไมล์ต้องไม่น้อยกว่าเลขไมล์ตอนออก (' + start.toLocaleString() + ' กม.)');
    const plate = String(get_(t, r, 'Plate')), carId = String(get_(t, r, 'ID'));
    set_(t, r, { Status: 'available', Mile: endMile, User: '', UserId: '' });
    const L = table_(SH.LOGS);
    for (let i = L.rows.length - 1; i >= 0; i--) {
      const lr = L.rows[i];
      const same = lr[L.h.CarId] !== '' ? String(lr[L.h.CarId]) === carId : np_(lr[L.h.Action]) === np_(plate);
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
    if (b.status === 'approved') {                      // อนุมัติพร้อมจัดรถให้ได้
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
    if (!me.admin && nm_(t.rows[r][t.h.User]) !== nm_(me.name)) throw new Error('ยกเลิกได้เฉพาะการจองของตัวเอง');
    t.sh.deleteRow(r + 2);
    return 'ยกเลิกการจองแล้ว';
  },

  /* ---------- ซ่อมบำรุง ---------- */
  maintSave: function (b, me) {
    const plate = clean_(b.plate), type = clean_(b.type), cost = Number(b.cost || 0);
    if (!plate) throw new Error('กรุณาเลือกรถ');
    if (type.length < 2) throw new Error('กรุณากรอกรายการซ่อม');
    if (!isFinite(cost) || cost < 0) throw new Error('ค่าใช้จ่ายไม่ถูกต้อง');
    const t = table_(SH.MAINT), m = Number(b.mile);
    append_(t, { ID: nextId_(t), Date: parseDate_(b.date) || new Date(), CarPlate: plate, Type: type,
      Cost: cost, Note: clean_(b.note), By: me.name, Mile: m > 0 ? m : '' });
    if (m > 0) {                                          // เลขไมล์ตอนซ่อมมากกว่าเดิม → อัปเดตเลขไมล์รถ
      const c = table_(SH.CARS), r = c.rows.findIndex(function (x) { return np_(x[c.h.Plate]) === np_(plate); });
      if (r >= 0 && String(get_(c, r, 'Status')) !== 'in-use' && m > (Number(get_(c, r, 'Mile')) || 0)) set_(c, r, { Mile: m });
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
    const plate = clean_(b.plate), model = clean_(b.model), mile = Number(b.mile || 0);
    if (plate.length < 2) throw new Error('กรุณากรอกทะเบียนรถ');
    if (!isFinite(mile) || mile < 0) throw new Error('เลขไมล์ไม่ถูกต้อง');
    const t = table_(SH.CARS);
    const dup = t.rows.findIndex(function (row) { return row[t.h.ID] !== '' && np_(row[t.h.Plate]) === np_(plate) && String(row[t.h.ID]) !== String(b.id || ''); });
    if (dup >= 0) throw new Error('ทะเบียน ' + plate + ' มีในระบบแล้ว');
    let img = '';
    if (b.image && String(b.image).indexOf('data:image') === 0) img = saveImage_(b.image, 'car_' + np_(plate) + '_' + Date.now() + '.jpg');
    if (b.id) {
      const r = findRow_(t, 'ID', b.id);
      if (r == null) throw new Error('ไม่พบรถ');
      const v = { Plate: plate, Model: model };
      if (String(get_(t, r, 'Status')) !== 'in-use') v.Mile = mile;   // ระหว่างใช้งาน เลขไมล์ = ไมล์ตอนออก ห้ามแก้
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
    set_(t, r, { Image: saveImage_(b.image, 'car_' + np_(get_(t, r, 'Plate')) + '_' + Date.now() + '.jpg') });
    return 'บันทึกรูปรถแล้ว';
  },

  driveTest: function (b, me) {                       // ผู้ดูแล: ตรวจสิทธิ์บันทึกรูปลงไดรฟ์
    if (!me.admin) throw new Error('เฉพาะผู้ดูแลระบบ');
    const out = {};
    try { out.auth = String(ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL).getAuthorizationStatus()); } catch (e) { out.auth = 'ERR ' + e.message; }
    try { out.folder = DriveApp.getFolderById(IMAGE_FOLDER_ID).getName(); } catch (e) { out.folder = 'ERR ' + e.message; }
    try { const f = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile('test_web.txt', 'ok'); f.setTrashed(true); out.create = 'ok'; } catch (e) { out.create = 'ERR ' + e.message; }
    return 'DRIVETEST ' + JSON.stringify(out);
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
  const filled = function (r) { return r.some(function (v) { return v !== '' && v != null; }); };
  const since = {};                                     // เบิกล่าสุดของรถที่กำลังใช้งาน
  L.rows.forEach(function (r) {
    if (String(r[L.h.Status]) !== 'in-use') return;
    const v = { at: iso_(r[L.h.Date]), mission: String(r[L.h.Detail] || '') };
    if (r[L.h.CarId] !== '') since['id:' + r[L.h.CarId]] = v;
    since['p:' + np_(r[L.h.Action])] = v;
  });
  const vehicles = C.rows.filter(function (r) { return r[C.h.ID] !== '' && r[C.h.Plate] !== ''; }).map(function (r) {
    const inUse = String(r[C.h.Status]) === 'in-use';
    const sc = inUse ? (since['id:' + r[C.h.ID]] || since['p:' + np_(r[C.h.Plate])] || {}) : {};
    return { id: String(r[C.h.ID]), plate: String(r[C.h.Plate]), model: String(r[C.h.Model] || ''),
      status: inUse ? 'in-use' : 'available', mile: Number(r[C.h.Mile]) || 0, image: imgUrl_(r[C.h.Image]),
      user: inUse ? String(r[C.h.User] || '') : '', since: sc.at || '', mission: sc.mission || '' };
  });
  const logs = L.rows.filter(filled).slice(-200).reverse().map(function (r) {
    return { date: iso_(r[L.h.Date]), user: String(r[L.h.User] || ''), plate: String(r[L.h.Action] || ''),
      mission: String(r[L.h.Detail] || ''), startMile: num_(r[L.h.StartMile]), endMile: num_(r[L.h.EndMile]),
      status: String(r[L.h.Status] || ''), returnDate: iso_(r[L.h.ReturnDate]), returnBy: String(r[L.h.ReturnBy] || '') };
  });
  const bookings = B.rows.filter(filled).slice(-300).reverse().map(function (r) {
    return { id: String(r[B.h.ID]), start: iso_(r[B.h.StartDate]), end: iso_(r[B.h.EndDate]),
      mission: String(r[B.h.Mission] || ''), status: String(r[B.h.Status] || 'pending'),
      user: String(r[B.h.User] || ''), plate: String(r[B.h.CarPlate] || '-') || '-' };
  }).filter(function (x) { return x.start; });
  const maint = M.rows.filter(filled).slice(-200).reverse().map(function (r) {
    return { id: String(r[M.h.ID]), date: iso_(r[M.h.Date]), plate: String(r[M.h.CarPlate] || ''),
      type: String(r[M.h.Type] || ''), cost: num_(String(r[M.h.Cost]).replace(/[,฿\s]/g, '')), note: String(r[M.h.Note] || ''),
      by: String(r[M.h.By] || ''), mile: num_(r[M.h.Mile]) };
  });
  return { ok: true, version: VERSION, me: me, vehicles: vehicles, logs: logs, bookings: bookings, maint: maint, at: iso_(new Date()) };
}

/** รถคันเดียวกันห้ามจองซ้อนเวลา (ไม่นับที่ไม่อนุมัติ/รับรถแล้ว และแถวที่กำลังแก้) */
function conflict_(t, plate, s, e, skipRow) {
  if (!plate || plate === '-' || !s || !e) return;
  t.rows.forEach(function (row, i) {
    if (i === skipRow || np_(row[t.h.CarPlate]) !== np_(plate)) return;
    const st = String(row[t.h.Status]); if (st === 'rejected' || st === 'used') return;
    const s2 = parseDate_(row[t.h.StartDate]), e2 = parseDate_(row[t.h.EndDate]);
    if (s2 && e2 && s < e2 && s2 < e) throw new Error('รถ ' + plate + ' ถูกจองช่วงนี้แล้ว โดย ' + row[t.h.User] + ' (' + fmt_(s2) + ' – ' + fmt_(e2) + ')');
  });
}

/* ====================================================================== *
 *  เข้าสู่ระบบ: รหัสพนักงานเดิม หรือ บัญชีศูนย์รวมงาน
 * ====================================================================== */
function who_(user, pass) {
  user = String(user || '').trim(); pass = String(pass || '');
  if (!user || !pass) return null;
  const m = localMember_(user, pass);
  if (m) return m;
  const hub = hubRole_(user, pass);                     // อาจ throw ถ้าเชื่อมศูนย์รวมงานไม่ได้
  if (!hub) return null;
  const local = memberByName_(user);                    // ชื่อตรงกับสมาชิกเดิม → ใช้บทบาทเดิมด้วย
  return { name: local ? local.name : user, empId: local ? local.empId : '', role: hub,
    admin: hub === 'admin' || (local && local.role === 'admin') || extraAdmins_().indexOf(nm_(user)) >= 0, via: 'hub' };
}

function members_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(MEMBERS);
  if (!sh || sh.getLastRow() < 2) return { sh: sh, rows: [] };
  return { sh: sh, rows: sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() };
}
function hashPass_(p) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, p + 'PEA_SALT_2024')); }

function localMember_(user, pass) {
  const M = members_(), key = nm_(user);
  for (let i = 0; i < M.rows.length; i++) {
    const r = M.rows[i];
    if (String(r[0]).trim() !== user && nm_(r[2]) !== key) continue;
    const stored = String(r[1]);
    if (stored !== hashPass_(pass) && stored !== pass) continue;
    if (stored === pass) M.sh.getRange(i + 2, 2).setValue(hashPass_(pass));   // รหัสเดิมเป็นข้อความธรรมดา → เข้ารหัสเก็บ
    const role = String(r[5] || 'user').toLowerCase();
    const name = String(r[2]).trim();
    return { name: name, empId: String(r[0]).trim(), role: role,
      admin: role === 'admin' || extraAdmins_().indexOf(nm_(name)) >= 0, via: 'vehicle' };
  }
  return null;
}
function memberByName_(name) {
  const key = nm_(name), r = members_().rows.find(function (x) { return nm_(x[2]) === key; });
  return r ? { name: String(r[2]).trim(), empId: String(r[0]).trim(), role: String(r[5] || 'user').toLowerCase() } : null;
}
function extraAdmins_() {
  return String(PropertiesService.getScriptProperties().getProperty('VEHICLE_ADMINS') || '').split(',').map(nm_).filter(String);
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

/** สมัครใช้งานด้วยรหัสพนักงาน (เหมือนระบบเดิม) */
function register_(b) {
  const empId = clean_(b.empId), name = clean_(b.name), pass = String(b.password || '');
  if (!/^\d{4,}$/.test(empId)) throw new Error('รหัสพนักงานต้องเป็นตัวเลขอย่างน้อย 4 หลัก');
  if (name.length < 4) throw new Error('กรุณากรอกชื่อ-นามสกุล');
  if (pass.length < 6) throw new Error('รหัสผ่านอย่างน้อย 6 ตัว');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const M = members_();
    let sh = M.sh;
    if (!sh) { sh = SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet(MEMBERS); sh.appendRow(['รหัสพนักงาน', 'รหัสผ่าน', 'ชื่อ-นามสกุล', 'ตำแหน่ง', 'แผนก', 'บทบาท', 'วันเวลา']); }
    if (M.rows.some(function (r) { return String(r[0]).trim() === empId; })) throw new Error('รหัสพนักงานนี้มีในระบบแล้ว — เข้าสู่ระบบได้เลย');
    if (M.rows.some(function (r) { return nm_(r[2]) === nm_(name); })) throw new Error('ชื่อนี้มีในระบบแล้ว — เข้าสู่ระบบด้วยรหัสพนักงานเดิม');
    sh.appendRow([empId, hashPass_(pass), name, clean_(b.position), clean_(b.dept), 'user', new Date()]);
  } finally { lock.releaseLock(); }
  return { ok: true, message: 'สมัครสำเร็จ เข้าสู่ระบบได้เลย' };
}

/* ====================================================================== *
 *  ตาราง: อ่าน/เขียนตามตำแหน่งคอลัมน์
 * ====================================================================== */
function table_(def) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(def.name);
  if (!sh) { sh = ss.insertSheet(def.name); sh.getRange(1, 1, 1, def.labels.length).setValues([def.labels]).setFontWeight('bold'); }
  const h = {}; def.cols.forEach(function (c, i) { h[c] = i; });
  const w = def.cols.length, n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, w).getValues() : [];
  const t = { sh: sh, h: h, rows: rows, width: w };
  if (def !== SH.LOGS) fillIds_(t);
  return t;
}
function fillIds_(t) {
  const miss = [];
  t.rows.forEach(function (r, i) { if (r[t.h.ID] === '' && r.some(function (v) { return v !== ''; })) miss.push(i); });
  if (!miss.length) return;
  let id = nextId_(t);
  miss.forEach(function (i) { t.rows[i][t.h.ID] = id; t.sh.getRange(i + 2, t.h.ID + 1).setValue(id); id++; });
}
function nextId_(t) {
  let max = 0;
  t.rows.forEach(function (r) { const v = parseInt(r[t.h.ID], 10); if (!isNaN(v) && v > max) max = v; });
  return max + 1;
}
function findRow_(t, col, val) {
  if (val === '' || val == null) return null;
  const i = t.rows.findIndex(function (r) { return String(r[t.h[col]]) === String(val); });
  return i < 0 ? null : i;
}
function get_(t, r, col) { return t.rows[r][t.h[col]]; }
function set_(t, r, obj) {
  Object.keys(obj).forEach(function (k) {
    const cell = t.sh.getRange(r + 2, t.h[k] + 1); cell.setValue(obj[k]); t.rows[r][t.h[k]] = obj[k];
    if (obj[k] instanceof Date) cell.setNumberFormat('d/M/yyyy, H:mm:ss');
  });
}
function append_(t, obj) {
  const row = new Array(t.width).fill('');
  Object.keys(obj).forEach(function (k) { if (t.h[k] != null) row[t.h[k]] = obj[k]; });
  // เขียนต่อจากแถวที่มีข้อมูลจริงแถวสุดท้าย (ชีตเดิมอาจมีคอลัมน์อื่นยาวกว่า)
  const last = t.rows.length; t.sh.getRange(last + 2, 1, 1, t.width).setValues([row]);
  row.forEach(function (v, i) { if (v instanceof Date) t.sh.getRange(last + 2, i + 1).setNumberFormat('d/M/yyyy, H:mm:ss'); });
  t.rows.push(row);
}

/**
 * ดูแลหัวคอลัมน์: ลบหัวคอลัมน์ภาษาอังกฤษที่รุ่น 15.x เติมต่อท้ายผิดตำแหน่ง และเขียนป้ายหัวคอลัมน์ให้ตรงข้อมูล
 * ลบเฉพาะคอลัมน์ที่อยู่ "หลัง" คอลัมน์ข้อมูลจริง และไม่มีข้อมูล (ยกเว้น ID ที่รุ่น 15.x เติมเอง) — ไม่แตะข้อมูลเดิม
 * ตรวจทุกครั้ง (อ่านแค่แถวหัวตาราง) จำผล 10 นาที
 */
function migrate_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('layout16') === 'ok') return;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ENG = ['ID', 'Plate', 'Model', 'Status', 'Mile', 'Image', 'User', 'UserId', 'CreatedDate', 'Date', 'Action', 'Detail',
    'StartMile', 'EndMile', 'CarId', 'ReturnDate', 'ReturnBy', 'StartDate', 'EndDate', 'Mission', 'CarPlate', 'Type', 'Cost', 'Note', 'By'];
  [SH.CARS, SH.LOGS, SH.BOOK, SH.MAINT].forEach(function (def) {
    const sh = ss.getSheetByName(def.name); if (!sh) return;
    const w = def.labels.length, lastCol = sh.getLastColumn(), lastRow = Math.max(sh.getLastRow(), 1);
    const head = sh.getRange(1, 1, 1, Math.max(lastCol, w)).getValues()[0].map(function (x) { return String(x).trim(); });
    if (head.slice(0, w).join('|') !== def.labels.join('|')) sh.getRange(1, 1, 1, w).setValues([def.labels]).setFontWeight('bold');
    for (let c = w; c < head.length; c++) {
      if (ENG.indexOf(head[c]) < 0) continue;            // ไม่ใช่หัวคอลัมน์ที่รุ่น 15.x เติม → ไม่ยุ่ง
      const col = sh.getRange(1, c + 1, lastRow, 1);
      const vals = col.getValues().slice(1).map(function (r) { return r[0]; });
      const empty = vals.every(function (v) { return v === '' || v == null; });
      const onlyIds = head[c] === 'ID' && vals.every(function (v) { return v === '' || /^\d+$/.test(String(v)); });
      if (empty || onlyIds) col.clearContent();
    }
  });
  cache.put('layout16', 'ok', 600);
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
/** ลิงก์ uc?export=view ของ Drive ไม่แสดงในเว็บอื่นแล้ว → แปลงเป็นลิงก์รูปย่อที่แสดงได้ */
function imgUrl_(v) {
  const s = String(v || ''), m = s.match(/[?&]id=([\w-]+)/) || s.match(/\/d\/([\w-]+)/);
  return m ? 'https://lh3.googleusercontent.com/d/' + m[1] + '=w800' : s;
}

/* ---------- ช่วย ---------- */
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(s) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300); }
function nm_(s) { return String(s == null ? '' : s).replace(/[\s​-‍﻿]/g, '').toLowerCase(); }   // เทียบชื่อ (ตัดช่องว่าง/อักขระล่องหน)
function np_(s) { return String(s == null ? '' : s).replace(/[\s\-​]/g, '').toUpperCase(); }              // เทียบทะเบียน
function num_(v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); }
function parseDate_(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/);           // dd/MM/yyyy, HH:mm
  if (m) { let y = +m[3]; if (y > 2400) y -= 543; return new Date(y, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)); }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function iso_(v) { const d = parseDate_(v); return d ? Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm") : ''; }
function fmt_(d) { return Utilities.formatDate(d, TZ, 'dd/MM HH:mm'); }

/** Run ครั้งแรกใน Apps Script เพื่ออนุญาตสิทธิ์ (Sheets / Drive / เชื่อมต่อภายนอก) และปรับหัวคอลัมน์ */
function setup() {
  migrate_();
  [SH.CARS, SH.LOGS, SH.BOOK, SH.MAINT].forEach(table_);
  UrlFetchApp.fetch(HUB_API + '?action=ping', { muteHttpExceptions: true });
  const f = DriveApp.getFolderById(IMAGE_FOLDER_ID).createFile('test_permission.txt', 'ok');   // ขอสิทธิ์เขียนไฟล์รูป
  f.setTrashed(true);
  Logger.log('พร้อมใช้งาน v' + VERSION + ' (บันทึกรูปลงไดรฟ์ได้)');
}
