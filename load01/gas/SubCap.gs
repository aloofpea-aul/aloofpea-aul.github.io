
/* ====================== N-1 สถานี: ขนาดหม้อแปลง (ชีต Substations กรอกเอง) ====================== */
var SUBCAP_SHEET = 'Substations';
var SUBCAP_HEAD = ['สถานี', 'จังหวัด', 'หม้อแปลง', 'MVA', 'รับเกินฉุกเฉิน (%)', 'หมายเหตุ'];

/* สร้าง/เติมรายชื่อสถานีและหม้อแปลงจากข้อมูล SCADA (ไม่ลบ ไม่ทับค่าที่กรอกไว้) — รันได้ซ้ำ */
function setupSubstationSheet() {
  var data = JSON.parse(getDashboardData() || '{}');
  if (!data.feeders) throw new Error('ยังไม่มีข้อมูล Dashboard');
  var subs = {};
  data.feeders.forEach(function (f) {
    var s = subs[f[1]] || (subs[f[1]] = { prov: f[0], trs: {} });
    if (f[2] === 'Transformer') s.trs[f[3]] = 1;
  });
  var sh = ensureSheet_(getSS_(), SUBCAP_SHEET, SUBCAP_HEAD);
  var have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) { have[r[0] + '|' + r[2]] = 1; have[r[0]] = 1; });
  var add = [];
  Object.keys(subs).sort().forEach(function (k) {
    var trs = Object.keys(subs[k].trs).sort();
    if (!trs.length) { if (!have[k]) add.push([k, subs[k].prov, 'TP1', '', '', '']); return; }
    trs.forEach(function (t) { if (!have[k + '|' + t]) add.push([k, subs[k].prov, t, '', '', '']); });
  });
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, SUBCAP_HEAD.length).setValues(add);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, SUBCAP_HEAD.length).setFontWeight('bold').setBackground('#f3e8f1');
  sh.getRange(2, 4, Math.max(1, sh.getLastRow() - 1), 2).setBackground('#fffbe6');
  sh.getRange(1, 8).setValue('วิธีกรอก: ใส่ขนาดหม้อแปลง (MVA) ทุกลูกของสถานี · ถ้ามีหลายลูกแต่ไม่มีในรายการ ให้เพิ่มแถวเอง (สถานี + ชื่อหม้อแปลง) · ช่องรับเกินฉุกเฉิน เว้นว่าง = 100%');
  log_('INFO', 'ชีต Substations: เพิ่ม ' + add.length + ' แถว');
  return add.length;
}

function getSubCaps() {
  var sh = getSS_().getSheetByName(SUBCAP_SHEET);
  var o = { url: getSS_().getUrl() + '#gid=' + (sh ? sh.getSheetId() : 0), subs: {} };
  if (!sh || sh.getLastRow() < 2) return o;
  sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var k = String(r[0]).trim(); if (!k) return;
    var mva = parseFloat(r[3]), em = parseFloat(r[4]);
    (o.subs[k] = o.subs[k] || []).push({ tr: String(r[2]), mva: isNaN(mva) ? null : mva, em: isNaN(em) ? null : em, note: String(r[5] || '') });
  });
  return o;
}
