
/* ====================== API สำหรับหน้าเว็บบน GitHub (ศูนย์รวมงาน) ======================
 * หน้าเว็บส่ง POST {fn, args} → เรียกได้เฉพาะฟังก์ชันในรายการนี้ */
function doPost(e) {
  var FN = {
    getDashboardData: function () { return getDashboardData(); },
    getActionStatus: function () { return getActionStatus(); },
    setActionStatus: function (k, s) { return setActionStatus(k, s); },
    getSldData: function () { return getSldData(); },
    getLateralActions: function () { return getLateralActions(); },
    setLateralAction: function (id, s, a, t) { return setLateralAction(id, s, a, t); },
    getSubCaps: function () { return getSubCaps(); }
  };
  var out;
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!FN.hasOwnProperty(b.fn)) throw new Error('ไม่อนุญาต: ' + b.fn);
    out = { ok: true, result: FN[b.fn].apply(null, Array.isArray(b.args) ? b.args : []) };
  } catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
