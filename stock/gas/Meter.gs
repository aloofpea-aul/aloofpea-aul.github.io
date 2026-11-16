/**
 * ระบบคลังพัสดุ กฟส.อ่าวลึก — โมดูลมิเตอร์ (ไฟล์ที่ 2 ในโปรเจ็กต์ Apps Script เดียวกับ Code.gs)
 * หน้าเว็บ: https://aloofpea-aul.github.io/stock/meter.html
 *
 * อ้างอิง: ระเบียบ กฟภ. ว่าด้วยวิธีปฏิบัติเกี่ยวกับมิเตอร์ พ.ศ. 2562
 *   ข้อ 52, 65–68 ถอนคืน/สับเปลี่ยน/สูญหาย/สาเหตุชำรุด · ข้อ 74 การเก็บรักษา · ข้อ 75 คณะกรรมการ
 *   ข้อ 76 การตรวจนับ (ZDMR101 + MB52) · ข้อ 79 รับ/เบิก Batch R · ข้อ 80–82 มิเตอร์ชำรุด/AMR/โมเด็ม · ข้อ 84 การบรรจุ
 * แอปเป็นเครื่องมือช่วยงาน: การบันทึกจริงยังทำในระบบ SAP (MM/DM) ตามระเบียบ
 *
 * ติดตั้ง: ในโปรเจ็กต์ Apps Script จริง ไฟล์นี้วางต่อท้าย Code.gs (รหัส.gs) ในไฟล์เดียวกัน
 *   › Run setupMeter (ครั้งเดียว ขอสิทธิ์ Drive สำหรับรูป) › Deploy › Manage deployments › New version (v2.1 = เวอร์ชัน 4)
 */

const METER_VERSION = '1.2';

const MT_FIELDS = [
  ['pea', 'PEA No.'], ['status', 'สถานะ'], ['sloc', 'คลังย่อย'], ['job', 'ประเภทงาน'], ['wo', 'ใบสั่งงาน'], ['ca', 'หมายเลขผู้ใช้ไฟ'],
  ['causeGroup', 'กลุ่มสาเหตุ'], ['cause', 'สาเหตุ'], ['symptom', 'อาการ'], ['lastUnit', 'หน่วยสุดท้าย'],
  ['brand', 'ยี่ห้อ'], ['kind', 'ชนิด'], ['phase', 'เฟส'], ['size', 'ขนาด'], ['mat', 'รหัสพัสดุ'], ['batch', 'แบทช์'],
  ['warranty', 'ประกันถึง'], ['removedAt', 'ถอดเมื่อ'], ['removedBy', 'ถอดโดย'],
  ['result', 'ผลคัดแยก'], ['sortedAt', 'คัดแยกเมื่อ'], ['sortedBy', 'คัดแยกโดย'],
  ['sap', 'ขั้นตอน SAP (JSON)'], ['ship', 'ชุดนำส่ง'], ['box', 'ลังที่'], ['police', 'ใบแจ้งความ'], ['photos', 'รูป (JSON)'],
  ['note', 'หมายเหตุ'], ['createdAt', 'บันทึกเมื่อ'], ['updatedAt', 'อัปเดตเมื่อ'], ['updatedBy', 'อัปเดตโดย'], ['cycle', 'รอบที่'],
  // v2.2 ข้อมูลสำหรับแบบฟอร์มภาคผนวก ข (มต.15, มต.ตม.4, มต.ทม.7, มต.ตต.2/3)
  ['custName', 'ชื่อผู้ใช้ไฟ'], ['custAddr', 'ที่อยู่ติดตั้ง'], ['serial', 'หมายเลขเครื่อง'], ['newPea', 'PEA เครื่องใหม่'], ['newUnit', 'หน่วยเครื่องใหม่'],
  // v2.3 ข้อ 68.1.3 ฝาครอบแก้วแตก (ไม่เกี่ยวคุณภาพ): มี/ไม่มี ผู้รับผิดชอบชดใช้
  ['payer', 'ผู้ชดใช้ (68.1.3)']
];
const MT = { name: 'มิเตอร์', labels: MT_FIELDS.map(function (f) { return f[1]; }) };
const MLOG = { name: 'ประวัติมิเตอร์', labels: ['วันเวลา', 'PEA No.', 'เหตุการณ์', 'รายละเอียด', 'ผู้ทำ'] };
const MSHIP = { name: 'ชุดนำส่งมิเตอร์', labels: ['เลขที่', 'ประเภท', 'ปลายทาง', 'สถานะ', 'เลขที่บันทึกนำส่ง', 'อนุมัติเมื่อ', 'เลขที่อนุมัติจำหน่าย', 'จำนวนลัง', 'รายการ (JSON)', 'หมายเหตุ', 'สร้างโดย', 'สร้างเมื่อ', 'อัปเดตโดย', 'อัปเดตเมื่อ', 'ส่ง/ขายเมื่อ'] };
const MROUND = { name: 'รอบนับมิเตอร์', labels: ['รหัสรอบ', 'ชนิด', 'ชื่อรอบ', 'สถานะ', 'กรรมการ (JSON)', 'เริ่มโดย', 'เริ่มเมื่อ', 'ปิดโดย', 'ปิดเมื่อ', 'สาเหตุผลต่าง (JSON)', 'สรุปเมื่อปิด (JSON)'] };
const MSCAN = { name: 'ผลนับมิเตอร์', labels: ['รหัสรอบ', 'PEA No.', 'คลังย่อย', 'ผล', 'หมายเหตุ', 'ผู้สแกน', 'สแกนเมื่อ'] };
const ZDMR = { name: 'ZDMR101', labels: ['PEA No.', 'รหัสพัสดุ', 'คำอธิบาย', 'คลังย่อย', 'แบทช์', 'สถานะ', 'นำเข้าเมื่อ', 'นำเข้าโดย'] };

const M_ST = { FIELD: 'ถอดคืนแล้ว', WAIT: 'รอคัดแยก', GOOD: 'สภาพดี', WARR: 'ในประกัน', REP: 'ซ่อมได้', UNREP: 'ซ่อมไม่ได้', EVID: 'หลักฐานคดี',
  LOST: 'สูญหาย', USED: 'เบิกใช้แล้ว', SENT: 'ส่งออกแล้ว', SOLD: 'จำหน่ายแล้ว' };
const M_TERMINAL = [M_ST.USED, M_ST.SENT, M_ST.SOLD];
const M_RESULTS = [M_ST.GOOD, M_ST.WARR, M_ST.REP, M_ST.UNREP, M_ST.EVID];
const M_EVID_CAUSES = ['ละเมิดการใช้ไฟฟ้า', 'เพลิงไหม้ (วางเพลิง/การกระทำ)'];
const M_SAP_KEYS = ['262', '344', '343', '349', '261', '301', 'ZARR020', 'ZMME024'];
const SHIP_KINDS = {
  warranty: { label: 'เคลมประกัน', box: 'ชำรุดเนื่องจากคุณภาพ', result: M_ST.WARR, done: M_ST.SENT, dest: 'กมต. (กองมิเตอร์)' },
  repair: { label: 'ส่งแปรสภาพ (ซ่อมได้)', box: 'ชำรุดซ่อมได้', result: M_ST.REP, done: M_ST.SENT, dest: 'ศูนย์ซ่อมและทดสอบมิเตอร์ภาคใต้' },
  sale: { label: 'จำหน่ายโดยวิธีขาย (ซ่อมไม่ได้)', box: 'ชำรุดซ่อมไม่ได้ หรือ เศษวัสดุรอขาย', result: M_ST.UNREP, done: M_ST.SOLD, dest: 'ผู้ซื้อตามอนุมัติจำหน่าย' }
};
const SHIP_STATUS = ['กำลังบรรจุ', 'รออนุมัติ', 'อนุมัติแล้ว', 'ส่งแล้ว', 'ยกเลิก'];

const METER_ACTIONS = {
  meterBoot: function (b, me) { return meterBoot_(me); },

  meterGet: function (b, me) {
    const m = findMeter_(b.pea);
    if (!m) return { meter: null, zdmr: zdmrOf_(b.pea) };
    return { meter: m.obj, log: mlogOf_(m.obj.pea), zdmr: zdmrOf_(b.pea) };
  },

  /** ถอดคืน/สับเปลี่ยน/สูญหาย — บันทึกจากหน้างาน (ข้อ 52, 65–68) */
  meterIntake: function (b, me) {
    const r = b.rec || {};
    const pea = peaOf_(r.pea);
    if (!pea) throw err_('bad', 'กรุณาสแกนหรือกรอก PEA No.');
    if (!clean_(r.wo) && r.job !== 'สูญหาย') throw err_('bad', 'กรุณากรอกเลขใบสั่งงาน (ข้อ 52, 65, 66)');
    if (!r.job) throw err_('bad', 'กรุณาเลือกประเภทงาน');
    const lost = r.job === 'สูญหาย';
    if ((lost || M_EVID_CAUSES.indexOf(r.cause) >= 0 && r.cause !== 'ละเมิดการใช้ไฟฟ้า') && !clean_(r.police)) throw err_('bad', 'กรณีสูญหาย/วางเพลิง ต้องมีเลขที่ใบแจ้งความ (ข้อ 67, 68.1.4)');
    const ex = findMeter_(pea);
    let cycle = 1;
    if (ex) {
      if (M_TERMINAL.indexOf(ex.obj.status) < 0 && ex.obj.status !== M_ST.LOST) throw err_('dup', 'PEA No. ' + pea + ' อยู่ในระบบแล้ว (สถานะ: ' + ex.obj.status + ') — เปิดดูรายละเอียดแทน');
      cycle = (Number(ex.obj.cycle) || 1) + 1;
    }
    const now = new Date();
    const evid = M_EVID_CAUSES.indexOf(r.cause) >= 0 || lost;
    const o = {
      pea: pea, status: lost ? M_ST.LOST : M_ST.FIELD, sloc: sl_(r.sloc || '1201'), job: clean_(r.job), wo: clean_(r.wo), ca: clean_(r.ca),
      causeGroup: clean_(r.causeGroup), cause: clean_(r.cause), symptom: clean_(r.symptom), lastUnit: clean_(r.lastUnit),
      brand: clean_(r.brand), kind: clean_(r.kind), phase: clean_(r.phase), size: clean_(r.size), mat: clean_(r.mat), batch: 'R',
      warranty: dateStr_(r.warranty), removedAt: dateStr_(r.removedAt) || Utilities.formatDate(now, TZ, 'yyyy-MM-dd'), removedBy: clean_(r.removedBy) || me.name,
      result: lost ? M_ST.EVID : '', sortedAt: '', sortedBy: '', sap: '{}', ship: '', box: '', police: clean_(r.police),
      photos: JSON.stringify((r.photos || []).filter(String).slice(0, 8)), note: clean_(r.note), createdAt: now, updatedAt: now, updatedBy: me.name, cycle: cycle,
      custName: clean_(r.custName), custAddr: clean_(r.custAddr), serial: clean_(r.serial), newPea: peaOf_(r.newPea) || clean_(r.newPea), newUnit: clean_(r.newUnit), payer: clean_(r.payer)
    };
    if (evid && !lost) o.note = (o.note ? o.note + ' · ' : '') + 'สาเหตุเข้าข่ายหลักฐานคดี (ข้อ 68.1.2)';
    writeMeter_(o, ex ? ex.row : 0);
    mlog_(pea, ex ? 'ถอดคืนรอบใหม่' : (lost ? 'แจ้งสูญหาย' : 'ถอดคืน'), [o.job, o.wo, o.cause, o.symptom].filter(String).join(' · '), me);
    return { meter: meterOut_(o) };
  },

  /** รับเข้าคลังย่อย (ข้อ 79.1 — MVT 262 Batch R) */
  meterReceive: function (b, me) {
    const m = findMeter_(b.pea);
    if (!m) throw err_('notfound', 'ไม่พบ PEA No. นี้ในระบบ — บันทึกถอดคืนก่อน');
    const o = m.obj;
    if (o.status !== M_ST.FIELD) throw err_('bad', 'มิเตอร์นี้สถานะ "' + o.status + '" แล้ว');
    o.status = M_ST.WAIT; o.sloc = sl_(b.sloc || o.sloc || '1201');
    const sap = jv_(o.sap, {});
    if (b.sap262) sap['262'] = iso_(new Date());
    o.sap = JSON.stringify(sap); o.updatedAt = new Date(); o.updatedBy = me.name;
    writeMeter_(o, m.row);
    mlog_(o.pea, 'รับเข้าคลังย่อย', 'คลัง ' + o.sloc + (b.sap262 ? ' · ทำ MVT 262 แล้ว' : ''), me);
    return { meter: meterOut_(o) };
  },

  /** ติ๊กขั้นตอน SAP ที่ทำแล้ว */
  meterSap: function (b, me) {
    const m = findMeter_(b.pea); if (!m) throw err_('notfound', 'ไม่พบ PEA No.');
    const k = String(b.key || '');
    if (M_SAP_KEYS.indexOf(k) < 0) throw err_('bad', 'ขั้นตอนไม่ถูกต้อง');
    const sap = jv_(m.obj.sap, {});
    if (b.done) sap[k] = iso_(new Date()); else delete sap[k];
    m.obj.sap = JSON.stringify(sap); m.obj.updatedAt = new Date(); m.obj.updatedBy = me.name;
    writeMeter_(m.obj, m.row);
    mlog_(m.obj.pea, b.done ? 'ทำ SAP ' + k : 'ยกเลิกติ๊ก SAP ' + k, '', me);
    return { meter: meterOut_(m.obj) };
  },

  /** คัดแยกโดยคณะกรรมการสอบหาข้อเท็จจริง (ข้อ 75.1.2, 80.1.2) */
  meterSort: function (b, me) {
    const m = findMeter_(b.pea); if (!m) throw err_('notfound', 'ไม่พบ PEA No.');
    const o = m.obj, res = String(b.result || '');
    if (M_RESULTS.indexOf(res) < 0) throw err_('bad', 'ผลคัดแยกไม่ถูกต้อง');
    if (M_TERMINAL.indexOf(o.status) >= 0) throw err_('bad', 'มิเตอร์นี้ปิดงานแล้ว (' + o.status + ')');
    if (o.ship) throw err_('bad', 'มิเตอร์อยู่ในชุดนำส่ง ' + o.ship + ' — นำออกจากชุดก่อน');
    if (o.status === M_ST.EVID && res !== M_ST.EVID) {
      if (!me.admin) throw err_('forbidden', 'มิเตอร์หลักฐานคดี ปลดได้เฉพาะผู้ดูแลระบบ เมื่อคดีถึงที่สุดแล้ว (ข้อ 68.1.2)');
      if (!clean_(b.note)) throw err_('bad', 'ระบุเหตุผลการปลดหลักฐานคดี (เช่น คดีถึงที่สุด/ได้รับชดใช้ครบ)');
    }
    if (o.status === M_ST.FIELD) { o.status = M_ST.WAIT; }
    o.result = res; o.status = res; o.sortedAt = iso_(new Date()); o.sortedBy = clean_(b.committee) || me.name;
    if (b.warranty !== undefined) o.warranty = dateStr_(b.warranty);
    if (b.brand !== undefined) o.brand = clean_(b.brand);
    if (b.kind !== undefined) o.kind = clean_(b.kind);
    if (b.phase !== undefined) o.phase = clean_(b.phase);
    if (b.size !== undefined) o.size = clean_(b.size);
    if (b.symptom !== undefined && clean_(b.symptom)) o.symptom = clean_(b.symptom);
    if (clean_(b.note)) o.note = (o.note ? o.note + ' · ' : '') + clean_(b.note);
    o.updatedAt = new Date(); o.updatedBy = me.name;
    writeMeter_(o, m.row);
    mlog_(o.pea, 'คัดแยก: ' + res, clean_(b.note) + (b.committee ? ' · กรรมการ: ' + clean_(b.committee) : ''), me);
    return { meter: meterOut_(o) };
  },

  /** แก้ข้อมูลมิเตอร์ (ยี่ห้อ ขนาด ประกัน หมายเหตุ ฯลฯ) */
  meterUpdate: function (b, me) {
    const m = findMeter_(b.pea); if (!m) throw err_('notfound', 'ไม่พบ PEA No.');
    const f = b.fields || {}, o = m.obj, ch = [];
    ['wo', 'ca', 'job', 'causeGroup', 'cause', 'symptom', 'lastUnit', 'brand', 'kind', 'phase', 'size', 'mat', 'police', 'note', 'removedBy', 'custName', 'custAddr', 'serial', 'newPea', 'newUnit', 'payer'].forEach(function (k) {
      if (f[k] !== undefined && clean_(f[k]) !== String(o[k] || '')) { ch.push(k); o[k] = clean_(f[k]); }
    });
    ['warranty', 'removedAt'].forEach(function (k) { if (f[k] !== undefined && dateStr_(f[k]) !== String(o[k] || '')) { ch.push(k); o[k] = dateStr_(f[k]); } });
    if (f.sloc !== undefined && sl_(f.sloc) !== o.sloc) { ch.push('sloc'); o.sloc = sl_(f.sloc); }
    if (f.addPhotos) { const ph = jv_(o.photos, []); o.photos = JSON.stringify(ph.concat(f.addPhotos.filter(String)).slice(0, 12)); ch.push('photos'); }
    if (!ch.length) return { meter: meterOut_(o) };
    o.updatedAt = new Date(); o.updatedBy = me.name;
    writeMeter_(o, m.row);
    mlog_(o.pea, 'แก้ไขข้อมูล', ch.join(', '), me);
    return { meter: meterOut_(o) };
  },

  /** เบิกมิเตอร์สภาพดีไปใช้ใหม่ (ข้อ 79.2 — MVT 261 Batch R) */
  meterIssue: function (b, me) {
    const m = findMeter_(b.pea); if (!m) throw err_('notfound', 'ไม่พบ PEA No.');
    const o = m.obj;
    if (o.status !== M_ST.GOOD) throw err_('bad', 'เบิกใช้ได้เฉพาะมิเตอร์ที่คัดแยกเป็น "สภาพดี"');
    if (!clean_(b.wo)) throw err_('bad', 'กรุณากรอกเลขใบสั่งงานติดตั้ง/สับเปลี่ยน');
    const sap = jv_(o.sap, {}); if (b.sap261) sap['261'] = iso_(new Date());
    o.sap = JSON.stringify(sap); o.status = M_ST.USED; o.updatedAt = new Date(); o.updatedBy = me.name;
    o.note = (o.note ? o.note + ' · ' : '') + 'เบิกใช้ ใบสั่งงาน ' + clean_(b.wo);
    writeMeter_(o, m.row);
    mlog_(o.pea, 'เบิกใช้ (Batch R)', 'ใบสั่งงาน ' + clean_(b.wo), me);
    return { meter: meterOut_(o) };
  },

  /** อัปโหลดรูป (ข้อ 67, 68.2.2 — ภาพถ่ายมิเตอร์/สถานที่) */
  meterPhoto: function (b, me) {
    const m = String(b.data || '').match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    if (!m) throw err_('bad', 'ไฟล์รูปไม่ถูกต้อง');
    const bytes = Utilities.base64Decode(m[3]);
    if (bytes.length > 3500000) throw err_('bad', 'รูปใหญ่เกินไป');
    const name = (peaOf_(b.pea) || 'meter') + '_' + Utilities.formatDate(new Date(), TZ, 'yyMMdd_HHmmss') + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]);
    const f = photoFolder_().createFile(Utilities.newBlob(bytes, m[1], name));
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { }
    return { id: f.getId() };
  },

  /* ---------- ชุดนำส่ง / บรรจุลัง (ข้อ 80.2.5, 80.3, 80.4, 84) ---------- */
  shipSave: function (b, me) {
    const s = b.ship || {};
    const kind = SHIP_KINDS[s.kind] ? s.kind : null;
    if (!kind) throw err_('bad', 'ประเภทชุดนำส่งไม่ถูกต้อง');
    const K = SHIP_KINDS[kind];
    const sh = sheet_(MSHIP), v = sh.getDataRange().getValues();
    let row = -1, old = null;
    if (s.id) for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(s.id)) { row = i + 1; old = v[i]; break; }
    if (s.id && row < 0) throw err_('notfound', 'ไม่พบชุดนำส่ง');
    const status = SHIP_STATUS.indexOf(s.status) >= 0 ? s.status : (old ? String(old[3]) : 'กำลังบรรจุ');
    if (old && (String(old[3]) === 'ส่งแล้ว' || String(old[3]) === 'ยกเลิก') && !me.admin) throw err_('bad', 'ชุดนี้ปิดแล้ว');
    const items = (s.items || []).map(function (it) { return [peaOf_(it[0]), Math.max(1, Number(it[1]) || 1)]; }).filter(function (it) { return it[0]; });
    const boxes = Math.max(1, Number(s.boxes) || items.reduce(function (a, it) { return Math.max(a, it[1]); }, 1));
    const id = s.id || ('SH' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss'));
    const prevItems = old ? (parse_(old[8]) || []) : [];
    const all = readMeters_(), byPea = {};
    all.forEach(function (x) { byPea[x.obj.pea] = x; });
    const inNew = {};
    items.forEach(function (it) {
      const x = byPea[it[0]];
      if (!x) throw err_('bad', 'ไม่พบ PEA No. ' + it[0]);
      if (x.obj.ship && x.obj.ship !== id) throw err_('bad', it[0] + ' อยู่ในชุด ' + x.obj.ship + ' แล้ว');
      if (x.obj.result !== K.result) throw err_('bad', it[0] + ' ผลคัดแยกเป็น "' + (x.obj.result || 'ยังไม่คัดแยก') + '" ใส่ในชุด ' + K.label + ' ไม่ได้');
      if (M_TERMINAL.indexOf(x.obj.status) >= 0 && status !== 'ส่งแล้ว') throw err_('bad', it[0] + ' ปิดงานแล้ว');
      inNew[it[0]] = it[1];
    });
    const now = new Date();
    // นำออกจากชุด
    prevItems.forEach(function (it) {
      const x = byPea[it[0]];
      if (x && !(it[0] in inNew) && x.obj.ship === id) { x.obj.ship = ''; x.obj.box = ''; if (M_TERMINAL.indexOf(x.obj.status) >= 0) x.obj.status = x.obj.result; x.obj.updatedAt = now; x.obj.updatedBy = me.name; writeMeter_(x.obj, x.row); mlog_(x.obj.pea, 'นำออกจากชุดนำส่ง', id, me); }
    });
    const done = status === 'ส่งแล้ว';
    items.forEach(function (it) {
      const x = byPea[it[0]], o = x.obj, was = o.ship;
      o.ship = id; o.box = it[1];
      if (done) o.status = K.done; else if (status === 'ยกเลิก') { o.ship = ''; o.box = ''; o.status = o.result; }
      else o.status = o.result;
      o.updatedAt = now; o.updatedBy = me.name; writeMeter_(o, x.row);
      if (!was) mlog_(o.pea, 'บรรจุลัง', id + ' ลังที่ ' + it[1] + '/' + boxes, me);
      if (done) mlog_(o.pea, K.done, id + (clean_(s.memo) ? ' · บันทึก ' + clean_(s.memo) : ''), me);
    });
    const rec = [id, kind, clean_(s.dest) || K.dest, status, clean_(s.memo), dateStr_(s.approvedAt), clean_(s.approvalNo), boxes, JSON.stringify(items), clean_(s.note),
      old ? old[10] : me.name, old ? old[11] : now, me.name, now, done ? (old && old[14] ? old[14] : now) : ''];
    if (row < 0) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, rec.length).setValues([rec]);
    return { ship: shipOut_(rec) };
  },

  /* ---------- ตรวจนับ (ข้อ 76 · กค. ข้อ 213 · ทส. 2568 ข้อ 16) ---------- */
  mRoundStart: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'เริ่มรอบตรวจนับได้เฉพาะผู้ดูแลระบบคลัง');
    if (openMRound_()) throw err_('bad', 'มีรอบตรวจนับมิเตอร์ที่ยังเปิดอยู่');
    const kind = b.kind === 'year' ? 'ประจำปี' : 'ประจำเดือน';
    const id = 'MR' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmm');
    const name = clean_(b.name) || ('ตรวจนับมิเตอร์' + kind + ' ' + Utilities.formatDate(new Date(), TZ, 'MM/yyyy'));
    const com = (b.committee || []).map(clean_).filter(String).slice(0, 6);
    if (kind === 'ประจำปี' && com.length < 3) throw err_('bad', 'ตรวจนับประจำปีต้องมีกรรมการอย่างน้อย 3 คน');
    sheet_(MROUND).appendRow([id, kind, name, 'เปิด', JSON.stringify(com), me.name, new Date(), '', '', '{}', '']);
    return { round: openMRound_() };
  },
  mScan: function (b, me) {
    const r = openMRound_();
    if (!r || r.id !== String(b.round)) throw err_('bad', 'รอบตรวจนับปิดแล้ว — กดโหลดใหม่');
    const pea = peaOf_(b.pea); if (!pea) throw err_('bad', 'PEA No. ไม่ถูกต้อง');
    const sh = sheet_(MSCAN), n = sh.getLastRow();
    const v = n > 1 ? sh.getRange(2, 1, n - 1, 2).getValues() : [];
    for (let i = 0; i < v.length; i++) if (String(v[i][0]) === r.id && String(v[i][1]) === pea) {
      if (b.remove) { sh.deleteRow(i + 2); return { removed: pea }; }
      return { dup: true, scan: [pea, sl_(sh.getRange(i + 2, 3).getValue())] };
    }
    if (b.remove) return { removed: pea };
    const row = sh.getLastRow() + 1;
    sh.getRange(row, 2, 1, 2).setNumberFormat('@');
    sh.getRange(row, 1, 1, MSCAN.labels.length).setValues([[r.id, pea, sl_(b.sloc), 'พบ', clean_(b.note), me.name, new Date()]]);
    return { scan: [pea, sl_(b.sloc)] };
  },
  mRoundNote: function (b, me) {
    const sh = sheet_(MROUND), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.round)) {
      const c = parse_(v[i][9]) || {};
      const k = clean_(b.key); if (!k) throw err_('bad', 'ไม่มีรายการ');
      if (clean_(b.text)) c[k] = clean_(b.text); else delete c[k];
      sh.getRange(i + 1, 10).setValue(JSON.stringify(c));
      return { causes: c };
    }
    throw err_('notfound', 'ไม่พบรอบ');
  },
  mRoundClose: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'ปิดรอบได้เฉพาะผู้ดูแลระบบคลัง');
    const sh = sheet_(MROUND), v = sh.getDataRange().getValues();
    for (let i = 1; i < v.length; i++) if (String(v[i][0]) === String(b.round) && v[i][3] === 'เปิด') {
      sh.getRange(i + 1, 4).setValue('ปิด');
      sh.getRange(i + 1, 8, 1, 2).setValues([[me.name, new Date()]]);
      sh.getRange(i + 1, 11).setValue(JSON.stringify(b.summary || {}).slice(0, 45000));
      return { closed: true };
    }
    throw err_('bad', 'ไม่พบรอบที่เปิดอยู่');
  },

  /** นำเข้ารายงาน ZDMR101 (DM) — แทนที่ข้อมูลของคลังย่อยที่อยู่ในไฟล์ */
  zdmrImport: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'นำเข้า ZDMR101 ได้เฉพาะผู้ดูแลระบบคลัง');
    const rows = (b.rows || []).map(function (r) { return [peaOf_(r[0]), clean_(r[1]), clean_(r[2]), sl_(r[3]), clean_(r[4]), clean_(r[5])]; })
      .filter(function (r) { return r[0]; });
    if (!rows.length) throw err_('bad', 'ไม่พบรายการ PEA No. ในไฟล์');
    if (rows.length > 20000) throw err_('bad', 'ไฟล์ใหญ่เกินไป');
    const slocs = {}; rows.forEach(function (r) { slocs[r[3]] = 1; });
    const sh = sheet_(ZDMR), n = sh.getLastRow();
    const all = n > 1 ? sh.getRange(2, 1, n - 1, ZDMR.labels.length).getValues() : [];
    const keep = b.replaceAll ? [] : all.filter(function (r) { return !slocs[sl_(r[3])]; });
    const now = new Date();
    const out = keep.concat(rows.map(function (r) { return r.concat([now, me.name]); }));
    if (n > 1) sh.getRange(2, 1, n - 1, ZDMR.labels.length).clearContent();
    if (out.length) { sh.getRange(2, 1, out.length, 6).setNumberFormat('@'); sh.getRange(2, 1, out.length, ZDMR.labels.length).setValues(out); }
    return { rows: rows.length, slocs: Object.keys(slocs) };
  },

  meterSettings: function (b, me) {
    if (!me.admin) throw err_('forbidden', 'เฉพาะผู้ดูแลระบบคลัง');
    const s = b.settings || {};
    const clean = {
      owner: clean_(s.owner) || 'กฟส.อ่าวลึก',
      sortCommittee: (s.sortCommittee || []).map(clean_).filter(String).slice(0, 6),
      countCommittee: (s.countCommittee || []).map(clean_).filter(String).slice(0, 6),
      warnDays: Math.max(1, Math.min(180, Number(s.warnDays) || 30)),
      brands: (s.brands || []).map(clean_).filter(String).slice(0, 40),
      defaultSloc: sl_(s.defaultSloc || '1201'),
      forms: formsSet_(s.forms || {})
    };
    setSetting_('meter', clean);
    return { settings: clean };
  }
};

/* ---------------- อ่านข้อมูล ---------------- */
function meterBoot_(me) {
  const meters = readMeters_().map(function (x) { return x.obj; });
  const ships = readShips_();
  const r = openMRound_() || lastMRound_();
  const z = sheet_(ZDMR), zn = z.getLastRow();
  const zrows = zn > 1 ? z.getRange(2, 1, zn - 1, 8).getValues().filter(function (x) { return x[0]; }).map(function (x) { return [String(x[0]), String(x[1]), String(x[2]), sl_(x[3]), String(x[4]), String(x[5])]; }) : [];
  const zAt = zn > 1 ? iso_(z.getRange(2, 7).getValue()) : '';
  // ยอด MB52 ของหมวดมิเตอร์/CT/VT (1-06) ต่อคลังย่อย จากระบบคลังเดิม
  const cur = sheet_(CUR), cn = cur.getLastRow();
  const mb = cn > 1 ? cur.getRange(2, 1, cn - 1, 6).getValues().filter(function (x) { return /^1-06-/.test(String(x[1])) && Number(x[4]); })
    .map(function (x) { return [sl_(x[0]), String(x[1]), String(x[2]), String(x[3]), Number(x[4]) || 0, String(x[5])]; }) : [];
  return {
    ok: true, version: METER_VERSION, me: { name: me.name, admin: me.admin },
    slocs: getSetting_('slocs') || DEFAULT_SLOCS, settings: getSetting_('meter') || { owner: 'กฟส.อ่าวลึก', sortCommittee: [], countCommittee: [], warnDays: 30, brands: [], defaultSloc: '1201' },
    meters: meters.map(meterOut_), ships: ships, round: r, scans: r ? mscans_(r.id) : [], zdmr: zrows, zdmrAt: zAt, mb52: mb,
    folder: PropertiesService.getScriptProperties().getProperty('METER_PHOTO_FOLDER') || ''
  };
}
function meterOut_(o) {
  const x = {}; MT_FIELDS.forEach(function (f) { x[f[0]] = o[f[0]] instanceof Date ? iso_(o[f[0]]) : (o[f[0]] == null ? '' : o[f[0]]); });
  x.sap = jv_(o.sap, {}); x.photos = jv_(o.photos, []); return x;
}
function readMeters_() {
  const sh = sheet_(MT), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, MT_FIELDS.length).getValues().map(function (r, i) {
    const o = {}; MT_FIELDS.forEach(function (f, j) { o[f[0]] = r[j]; });
    o.pea = String(o.pea); o.sloc = sl_(o.sloc);
    ['warranty', 'removedAt'].forEach(function (k) { if (o[k] instanceof Date) o[k] = Utilities.formatDate(o[k], TZ, 'yyyy-MM-dd'); });
    return { row: i + 2, obj: o };
  }).filter(function (x) { return x.obj.pea; });
}
function findMeter_(pea) {
  pea = peaOf_(pea); if (!pea) return null;
  const all = readMeters_();
  for (let i = all.length - 1; i >= 0; i--) if (all[i].obj.pea === pea) { return { row: all[i].row, obj: meterOut_(all[i].obj) }; }
  return null;
}
function formsSet_(f) {
  const o = {}; ['branch', 'parent', 'amp', 'prov', 'addr', 'tel', 'docPrefix', 'mgr', 'head', 'police', 'maker'].forEach(function (k) { o[k] = clean_(f[k]).slice(0, 160); });
  return o;
}
/** เติมหัวคอลัมน์ใหม่ (v2.2) ให้ชีตเดิม */
function mtHeader_(sh) {
  if (sh.getLastColumn() < MT_FIELDS.length) sh.getRange(1, 1, 1, MT_FIELDS.length).setValues([MT.labels]).setFontWeight('bold').setBackground('#efe8f3');
}
function writeMeter_(o, row) {
  const sh = sheet_(MT); mtHeader_(sh);
  if (!row) row = sh.getLastRow() + 1;
  const vals = MT_FIELDS.map(function (f) {
    const v = o[f[0]];
    if (f[0] === 'sap' || f[0] === 'photos') return typeof v === 'string' ? v : JSON.stringify(v || (f[0] === 'sap' ? {} : []));
    return v == null ? '' : v;
  });
  sh.getRange(row, 1, 1, 3).setNumberFormat('@');
  sh.getRange(row, 5, 1, 2).setNumberFormat('@');
  sh.getRange(row, 17, 1, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);
}
function mlog_(pea, ev, detail, me) {
  const sh = sheet_(MLOG), row = sh.getLastRow() + 1;
  sh.getRange(row, 2).setNumberFormat('@');
  sh.getRange(row, 1, 1, 5).setValues([[new Date(), pea, ev, clean_(detail), me.name]]);
}
function mlogOf_(pea) {
  const sh = sheet_(MLOG), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 5).getValues().filter(function (r) { return String(r[1]) === pea; }).slice(-80).reverse()
    .map(function (r) { return { at: iso_(r[0]), ev: String(r[2]), detail: String(r[3] || ''), by: String(r[4] || '') }; });
}
function zdmrOf_(pea) {
  pea = peaOf_(pea);
  const sh = sheet_(ZDMR), n = sh.getLastRow(); if (n < 2 || !pea) return null;
  const v = sh.getRange(2, 1, n - 1, 6).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === pea) return { mat: String(v[i][1]), desc: String(v[i][2]), sloc: sl_(v[i][3]), batch: String(v[i][4]), status: String(v[i][5]) };
  return null;
}
function shipOut_(r) {
  return { id: String(r[0]), kind: String(r[1]), dest: String(r[2]), status: String(r[3]), memo: String(r[4] || ''), approvedAt: r[5] instanceof Date ? Utilities.formatDate(r[5], TZ, 'yyyy-MM-dd') : String(r[5] || ''),
    approvalNo: String(r[6] || ''), boxes: Number(r[7]) || 1, items: parse_(r[8]) || [], note: String(r[9] || ''), by: String(r[10] || ''), at: iso_(r[11]), upBy: String(r[12] || ''), upAt: iso_(r[13]), doneAt: iso_(r[14]) };
}
function readShips_() {
  const sh = sheet_(MSHIP), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, MSHIP.labels.length).getValues().filter(function (r) { return r[0]; }).map(shipOut_).reverse();
}
function mrounds_() {
  const sh = sheet_(MROUND), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, MROUND.labels.length).getValues().filter(function (r) { return r[0]; })
    .map(function (r) { return { id: String(r[0]), kind: String(r[1]), name: String(r[2]), open: r[3] === 'เปิด', committee: parse_(r[4]) || [], by: String(r[5]), at: iso_(r[6]), closedBy: String(r[7] || ''), closedAt: iso_(r[8]), causes: parse_(r[9]) || {}, summary: parse_(r[10]) || null }; });
}
function openMRound_() { return mrounds_().filter(function (r) { return r.open; }).pop() || null; }
function lastMRound_() { return mrounds_().pop() || null; }
function mscans_(id) {
  const sh = sheet_(MSCAN), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, MSCAN.labels.length).getValues().filter(function (r) { return String(r[0]) === id; })
    .map(function (r) { return [String(r[1]), sl_(r[2]), String(r[4] || ''), String(r[5] || ''), iso_(r[6])]; });
}

/* ---------------- อื่นๆ ---------------- */
function jv_(v, def) { return (v && typeof v === 'object') ? v : (parse_(v) || def); }
/** PEA No.: ตัวอักษร/ตัวเลข 4–20 ตัว (เครื่องสแกนอาจส่งช่องว่าง/ขีด) */
function peaOf_(s) { const t = String(s == null ? '' : s).toUpperCase().replace(/[\s\-–]/g, ''); return /^[A-Z0-9]{4,20}$/.test(t) ? t : ''; }
function dateStr_(d) {
  if (!d) return '';
  if (d instanceof Date) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
}
function photoFolder_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('METER_PHOTO_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('รูปมิเตอร์ชำรุด กฟส.อ่าวลึก');
  p.setProperty('METER_PHOTO_FOLDER', f.getId());
  return f;
}

/** Run ครั้งแรกหลังเพิ่มไฟล์นี้: สร้างชีต + โฟลเดอร์รูป + ขอสิทธิ์ Drive */
function setupMeter() {
  [MT, MLOG, MSHIP, MROUND, MSCAN, ZDMR].forEach(sheet_); mtHeader_(sheet_(MT));
  if (!getSetting_('meter')) setSetting_('meter', { owner: 'กฟส.อ่าวลึก', sortCommittee: [], countCommittee: [], warnDays: 30, brands: [], defaultSloc: '1201' });
  photoFolder_();
  Logger.log('โมดูลมิเตอร์พร้อมใช้งาน — ชีต: ' + ss_().getUrl());
}
