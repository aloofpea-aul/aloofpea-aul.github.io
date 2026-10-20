/**
 * Api.gs — ทางเชื่อมให้หน้าเว็บ CCL บน GitHub (ศูนย์รวมงาน) ใช้ข้อมูลชุดเดียวกับระบบเดิม
 * วิธีใช้: สร้างไฟล์ใหม่ชื่อ Api ในโปรเจกต์ Apps Script ของ CCL แล้ววางโค้ดนี้ทั้งไฟล์
 *          จากนั้น Deploy → New deployment (Web app) — ลิงก์ระบบเดิมไม่เปลี่ยน ใช้งานต่อได้ตามปกติ
 * - ไม่แก้ฟังก์ชันเดิมแม้แต่บรรทัดเดียว แค่รับคำขอจากหน้าเว็บแล้วเรียกฟังก์ชันเดิมให้
 * - ล็อกอินด้วยบัญชีชุดเดิม (ชีต Users) ได้ token ใช้ต่อ 6 ชั่วโมงนับจากครั้งล่าสุดที่ใช้งาน
 */

// ฟังก์ชันเดิมที่หน้าเว็บเรียกได้ (ต้องล็อกอินก่อน)
var CCL_API_FNS = [
  'getOptionsData','addOption','deleteOption','updateOption','getOptions',
  'getDefaultRecorderName','updateDefaultRecorderName','getApproverName','updateApproverName',
  'getLineToken','updateLineToken','updateLineTargets','testLineMessaging',
  'getNextRunningNo','saveConstructionData','editConstructionData','getConstructionData',
  'updateWorkStatus','updateInspectionStatus','updateStandardInspection','closeJobWithRemarks',
  'addExpense','updateExpense','deleteExpense','getDashboardStats','exportToExcel','sendFollowUpLine',
  'getPendingApprovals','approveByAssignee','approveByManager',
  'uploadAttachment','deleteAttachment','saveDeliveryDate','saveStdFormData','getStdFormData',
  'createContractorUser','getContractorUsers','toggleContractorUserStatus','updateContractorUser',
  'deleteContractorUser','updateContractorPassword','addPEAReply',
  'createAppointment','getAllAppointments','deleteAppointment',
  'getMaterialData','updateOldJobStatus','getAllOldJobs',
  'saveInspectPlan','getInspectPlans','deleteInspectPlan'
];
// ฟังก์ชันที่ต้องเป็น Admin เท่านั้น
var CCL_API_ADMIN = ['getPendingUsers','approveUser','rejectUser'];

var CCL_TOKEN_TTL = 21600; // 6 ชั่วโมง (สูงสุดที่ CacheService เก็บได้)

function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return cclJson_({ ok: false, error: 'คำขอไม่ถูกต้อง' }); }

  try {
    var fn = String(b.fn || '');
    var args = Array.isArray(b.args) ? b.args : [];

    // ไม่ต้องล็อกอิน
    if (fn === 'loginUser')    return cclJson_({ ok: true, data: cclApiLogin_(args[0], args[1]) });
    if (fn === 'registerUser') return cclJson_({ ok: true, data: registerUser.apply(null, args) });
    if (fn === 'ping')         return cclJson_({ ok: true, data: 'pong' });

    var sess = cclSession_(b.token);
    if (!sess) return cclJson_({ ok: false, error: 'AUTH_REQUIRED' });

    var isAdminFn = CCL_API_ADMIN.indexOf(fn) >= 0;
    if (CCL_API_FNS.indexOf(fn) < 0 && !isAdminFn) return cclJson_({ ok: false, error: 'ไม่รองรับคำสั่ง ' + fn });
    if (isAdminFn && sess.role !== 'Admin') return cclJson_({ ok: false, error: 'เฉพาะ Admin เท่านั้น' });

    var f = globalThis[fn];
    if (typeof f !== 'function') return cclJson_({ ok: false, error: 'ไม่พบฟังก์ชัน ' + fn + ' ในระบบหลังบ้าน' });
    var out = f.apply(null, args);
    return cclJson_({ ok: true, data: out === undefined ? null : out });
  } catch (err) {
    return cclJson_({ ok: false, error: String((err && err.message) || err) });
  }
}

// ล็อกอินด้วยชีต Users ชุดเดิม (เขียนแยกไว้ ไม่พึ่งชื่อ loginUser เผื่อมีฟังก์ชันชื่อซ้ำ)
function cclApiLogin_(u, p) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS_NAME);
  if (!sheet) return { success: false, error: 'ไม่พบชีต Users' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(u) && String(data[i][1]) === String(p)) {
      var status = data[i][6] || 'Active';
      if (status === 'Pending')  return { success: false, error: 'บัญชีของคุณรอการอนุมัติจาก Admin กรุณารอการยืนยัน' };
      if (status === 'Rejected') return { success: false, error: 'บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อ Admin' };
      var user = { username: String(data[i][0]), name: String(data[i][2]), role: String(data[i][3]), department: String(data[i][5] || '-') };
      var token = Utilities.getUuid();
      CacheService.getScriptCache().put('ccl_tok_' + token, JSON.stringify(user), CCL_TOKEN_TTL);
      return { success: true, user: user, token: token };
    }
  }
  return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
}

function cclSession_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var key = 'ccl_tok_' + token;
  var raw = cache.get(key);
  if (!raw) return null;
  cache.put(key, raw, CCL_TOKEN_TTL); // ต่ออายุทุกครั้งที่ใช้งาน
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function cclJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
