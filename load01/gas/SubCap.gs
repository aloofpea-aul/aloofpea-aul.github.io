
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

/* เติม MVA จาก GIS (Export_Output_43) — เฉพาะสถานีที่จับคู่รหัสได้ชัวร์ · เติมเฉพาะช่องว่าง ไม่ทับค่าเดิม */
function fillMvaFromGis() {
  var GIS = { KMA:[50,50], KMB:[50,50], KCD:[50,50], CAY:[50,50], WSA:[50,50], PPB:[50,50], NTB:[50,50], PPN:[50,50], TYI:[50,50],
    PAT:[50,50,50], KRN:[50,50], GTU:[50,50], TMG:[50,50], KBB:[50,50], KBA:[50,50], KTM:[50,50], AOA:[50,50], TRA:[50,50], YTK:[50,50], KNA:[50] };
  var NOTE = 'จาก GIS (Export_Output_43)';
  var sh = getSS_().getSheetByName(SUBCAP_SHEET); if (!sh) throw new Error('ไม่มีชีต ' + SUBCAP_SHEET);
  var n = sh.getLastRow() - 1, vals = n > 0 ? sh.getRange(2, 1, n, 6).getValues() : [];
  var idx = {}, prov = {}; vals.forEach(function (r, i) { var k = String(r[0]).trim(); idx[k + '|' + String(r[2]).trim()] = i; if (r[1]) prov[k] = r[1]; });
  var filled = 0, kept = 0, add = [];
  Object.keys(GIS).forEach(function (k) {
    GIS[k].forEach(function (m, j) {
      var tp = 'TP' + (j + 1), i = idx[k + '|' + tp];
      if (i == null) { add.push([k, prov[k] || '', tp, m, '', NOTE]); return; }
      if (String(vals[i][3]).trim() !== '') { kept++; return; }
      vals[i][3] = m; if (!String(vals[i][5]).trim()) vals[i][5] = NOTE; filled++;
    });
  });
  if (n > 0) sh.getRange(2, 1, n, 6).setValues(vals);
  if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 6).setValues(add);
  var msg = 'GIS: เติม ' + filled + ' ช่อง · เพิ่ม ' + add.length + ' แถว · ข้ามเพราะมีค่าอยู่แล้ว ' + kept;
  log_('INFO', msg); Logger.log(msg); return msg;
}
