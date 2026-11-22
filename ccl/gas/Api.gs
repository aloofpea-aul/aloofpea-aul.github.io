/**
 * Api.gs — ทางเชื่อมให้หน้าเว็บ CCL บน GitHub (ศูนย์รวมงาน) ใช้ข้อมูลชุดเดียวกับระบบเดิม
 * เวอร์ชัน 2 — รองรับหลายหน่วยงาน (โค้ดชุดเดียว / ชีตแยกต่อหน่วยงาน)
 *
 * - รายชื่อหน่วยงานเก็บใน Script Properties (CCL_BRANCHES) — อ่าวลึกคือหน่วยงานหลัก ใช้ชีตเดิมของไฟล์นี้
 * - ผู้ใช้ของแต่ละหน่วยงานอยู่ในชีต Users ของหน่วยงานนั้น (อ่าวลึกใช้ชีต Users เดิม ไม่ต้องย้าย)
 * - Admin ของอ่าวลึก = ผู้ดูแลสูงสุด (เพิ่ม/ปิดหน่วยงาน, เข้าดูทุกหน่วยงาน)
 * - Admin ของหน่วยงานอื่น = จัดการได้เฉพาะหน่วยงานตัวเอง
 * - Code.gs เรียก cclSS_() แทน SpreadsheetApp.getActiveSpreadsheet() เพื่อให้เปิดชีตตามหน่วยงานที่ล็อกอิน
 *   ถ้าไม่ได้มาจากหน้าเว็บนี้ (ลิงก์เดิม / ตัวตั้งเวลา) จะเปิดชีตอ่าวลึกเหมือนเดิมทุกอย่าง
 */

// ฟังก์ชันเดิมที่หน้าเว็บเรียกได้ (ต้องล็อกอินก่อน)
var CCL_API_FNS = [
  'getOptionsData','getOptions','getDefaultRecorderName','getApproverName',
  'getNextRunningNo','saveConstructionData','editConstructionData','getConstructionData',
  'updateWorkStatus','updateInspectionStatus','updateStandardInspection','closeJobWithRemarks',
  'addExpense','updateExpense','deleteExpense','getDashboardStats','exportToExcel','sendFollowUpLine',
  'getPendingApprovals','approveByAssignee','approveByManager',
  'uploadAttachment','deleteAttachment','saveDeliveryDate','saveStdFormData','getStdFormData',
  'addPEAReply','getMaterialData','updateOldJobStatus','getAllOldJobs',
  'saveInspectPlan','getInspectPlans','deleteInspectPlan'
];
// ต้องเป็น Admin ของหน่วยงาน (หรือผู้ดูแลสูงสุด) — ตรวจที่หลังบ้าน ไม่ได้แค่ซ่อนปุ่มบนหน้าจอ
var CCL_API_ADMIN = [
  'getPendingUsers','approveUser','rejectUser',
  'addOption','deleteOption','updateOption','updateDefaultRecorderName','updateApproverName',
  'getLineToken','updateLineToken','updateLineTargets','testLineMessaging',
  'createContractorUser','getContractorUsers','toggleContractorUserStatus','updateContractorUser',
  'deleteContractorUser','updateContractorPassword',
  'createAppointment','getAllAppointments','deleteAppointment'
];
var CCL_API_BRANCH_ADMIN = ['cclListUsers','cclSetUserRole','cclSetUserStatus','cclResetUserPassword'];
// เฉพาะผู้ดูแลสูงสุด
var CCL_API_SUPER = ['cclAdminBranches','cclCreateBranch','cclUpdateBranch','cclSwitchBranch'];

var CCL_TOKEN_TTL = 21600; // 6 ชั่วโมง (สูงสุดที่ CacheService เก็บได้)
var CCL_MAX_FAIL = 5;    // ใส่รหัสผิดได้กี่ครั้ง
var CCL_LOCK_SEC = 900;  // ล็อก 15 นาที
var CCL_HOME_BRANCH = 'aoluek';
var CCL_HOME_NAME = 'กฟส.อ่าวลึก';
var __CCL_CTX = null; // หน่วยงานของคำขอนี้ {branch, ss}

// ===== ตัวเลือกชีต/โฟลเดอร์ตามหน่วยงาน (Code.gs เรียกใช้) =====
function cclSS_() {
  return (__CCL_CTX && __CCL_CTX.ss) ? __CCL_CTX.ss : SpreadsheetApp.getActiveSpreadsheet();
}
function cclFolderId_() {
  return (__CCL_CTX && __CCL_CTX.branch && __CCL_CTX.branch.folderId) ? __CCL_CTX.branch.folderId : CCL_FOLDER_ID;
}

// ===== ทะเบียนหน่วยงาน =====
function cclBranches_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty('CCL_BRANCHES');
  var list = [];
  if (raw) { try { list = JSON.parse(raw) || []; } catch (e) { list = []; } }
  if (!list.some(function (b) { return b.id === CCL_HOME_BRANCH; })) {
    list.unshift({ id: CCL_HOME_BRANCH, name: CCL_HOME_NAME, sheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
                   folderId: CCL_FOLDER_ID, active: true, home: true, created: new Date().toISOString() });
    props.setProperty('CCL_BRANCHES', JSON.stringify(list));
  }
  return list;
}
function cclSaveBranches_(list) {
  PropertiesService.getScriptProperties().setProperty('CCL_BRANCHES', JSON.stringify(list));
}
function cclBranch_(id) {
  id = String(id || CCL_HOME_BRANCH);
  var list = cclBranches_();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function cclOpenBranchSS_(b) {
  return b.home ? SpreadsheetApp.getActiveSpreadsheet() : SpreadsheetApp.openById(b.sheetId);
}
function cclUseBranch_(id, allowInactive) {
  var b = cclBranch_(id);
  if (!b) throw new Error('ไม่พบหน่วยงานนี้ในระบบ');
  if (!b.active && !allowInactive) throw new Error('หน่วยงานนี้ถูกปิดใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ');
  __CCL_CTX = { branch: b, ss: cclOpenBranchSS_(b) };
  return b;
}

// ===== รับคำขอจากหน้าเว็บ =====
function doPost(e) {
  var b;
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return cclJson_({ ok: false, error: 'คำขอไม่ถูกต้อง' }); }
  if (Array.isArray(b.events) && !b.fn) { try { cclLineWebhook_(b.events); } catch (err) {} return ContentService.createTextOutput('OK'); } // LINE webhook

  try {
    var fn = String(b.fn || '');
    var args = Array.isArray(b.args) ? b.args : [];

    // ไม่ต้องล็อกอิน
    if (fn === 'ping') return cclJson_({ ok: true, data: 'pong' });
    if (fn === 'listBranches') return cclJson_({ ok: true, data: cclListBranchesPublic_() });
    if (fn === 'loginUser') return cclJson_({ ok: true, data: cclApiLogin_(args[0], args[1], args[2]) });
    if (fn === 'loginContractor') return cclJson_({ ok: true, data: cclCtLogin_(args[0], args[1], args[2]) });
    if (fn === 'registerUser') {
      cclUseBranch_(args[4] || CCL_HOME_BRANCH);
      return cclJson_({ ok: true, data: registerUser(args[0], args[1], args[2], args[3]) });
    }

    var sess = cclSession_(b.token);
    if (!sess) return cclJson_({ ok: false, error: 'AUTH_REQUIRED' });
    if (sess.type === 'contractor') return cclJson_(cclCtDispatch_(sess, b.token, fn, args));
    sess = cclRefreshSess_(sess, b.token);
    if (!sess) return cclJson_({ ok: false, error: 'AUTH_REQUIRED' });
    cclUseBranch_(sess.branchId || CCL_HOME_BRANCH, !!sess.superAdmin);

    var isAdmin = sess.role === 'Admin' || !!sess.superAdmin;
    var known = CCL_API_FNS.indexOf(fn) >= 0 || CCL_API_ADMIN.indexOf(fn) >= 0 ||
                CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0 || CCL_API_SUPER.indexOf(fn) >= 0 || fn === 'cclWhoAmI' || fn === 'cclCtPreview' || fn === 'cclExpStage' || fn === 'cclSetJobCodes' || fn === 'cclFixJobs' || fn === 'cclSapAutoGet' || fn === 'cclSapAutoSet' || fn === 'cclSapAutoRun' || fn === 'cclSapClose' || fn === 'cclSapReport' || fn === 'cclSapReportRebuild' || fn === 'cclLineTargets' || fn === 'cclLineSend' || fn === 'cclLineSave' || fn === 'cclLineHook';
    if (!known) return cclJson_({ ok: false, error: 'ไม่รองรับคำสั่ง ' + fn });
    if ((CCL_API_ADMIN.indexOf(fn) >= 0 || CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0) && !isAdmin)
      return cclJson_({ ok: false, error: 'เฉพาะ Admin ของหน่วยงานเท่านั้น' });
    if (CCL_API_SUPER.indexOf(fn) >= 0 && !sess.superAdmin)
      return cclJson_({ ok: false, error: 'เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' });

    var out;
    if (fn === 'cclWhoAmI') { out = {}; for (var k in sess) if (k !== 'pv') out[k] = sess[k]; }
    else if (fn === 'cclSwitchBranch') out = cclSwitchBranch_(sess, b.token, args[0]);
    else if (fn === 'cclCtPreview') out = cclCtPreview_(sess, args[0]);
    else if (fn === 'cclExpStage') out = cclExpStage_(sess, args[0], args[1], args[2]);
    else if (fn === 'cclSapAutoGet') out = cclSapAutoGet_(sess, isAdmin);
    else if (fn === 'cclSapAutoSet') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclSapAutoSet_(sess, args[0]); }
    else if (fn === 'cclSapAutoRun') { if (!isAdmin && !args[0]) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclSapAutoRun_(String(sess.name || '-'), !!args[0]); }
    else if (fn === 'cclSapReport') out = cclSapReportGet_();
    else if (fn === 'cclLineTargets') out = cclLineList_(isAdmin && !!args[0], !!args[1]);
    else if (fn === 'cclLineSend') out = cclLineSend_(sess, args[0], args[1]);
    else if (fn === 'cclLineHook') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclLineHook_(args[0]); }
    else if (fn === 'cclLineSave') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclLineSave_(args[0]); }
    else if (fn === 'cclSapReportRebuild') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclSapReportRebuild_(); }
    else if (fn === 'cclSapClose') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclSapCloseIds_(String(sess.name || '-'), args[0]); }
    else if (fn === 'cclFixJobs') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclFixJobs_(sess, args[0], args[1]); }
    else if (fn === 'cclSetJobCodes') { if (!isAdmin) throw new Error('เฉพาะ Admin เท่านั้น'); out = cclSetJobCodes_(sess, args[0], args[1]); }
    else if (CCL_API_SUPER.indexOf(fn) >= 0 || CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0) out = globalThis[fn + '_'].apply(null, [sess].concat(args));
    else {
      var f = globalThis[fn];
      if (typeof f !== 'function') return cclJson_({ ok: false, error: 'ไม่พบฟังก์ชัน ' + fn + ' ในระบบหลังบ้าน' });
      cclJobCodeGate_(fn, args);
      out = f.apply(null, args);
      if (fn === 'getConstructionData' && Array.isArray(out)) out = out.filter(function (j) { return j && (String(j.receiveNo || '').trim() || String(j.jobName || '').trim()); }); // ซ่อนแถวว่าง
    }
    return cclJson_({ ok: true, data: out === undefined ? null : out });
  } catch (err) {
    return cclJson_({ ok: false, error: String((err && err.message) || err) });
  }
}

function cclListBranchesPublic_() {
  return cclBranches_().filter(function (b) { return b.active; })
    .map(function (b) { return { id: b.id, name: b.name }; });
}

// ล็อกอินด้วยชีต Users ของหน่วยงานที่เลือก
function cclApiLogin_(u, p, branchId) {
  var br;
  try { br = cclUseBranch_(branchId || CCL_HOME_BRANCH); }
  catch (e) { return { success: false, error: e.message }; }
  var sheet = cclSS_().getSheetByName(SHEET_USERS_NAME);
  if (!sheet) return { success: false, error: 'ไม่พบชีต Users ของหน่วยงานนี้' };
  // ใส่รหัสผิดเกิน CCL_MAX_FAIL ครั้ง → ล็อกชื่อผู้ใช้นี้ CCL_LOCK_SEC วินาที
  var cache = CacheService.getScriptCache();
  var failKey = 'ccl_fail_' + br.id + ':' + String(u || '').toLowerCase();
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= CCL_MAX_FAIL) return { success: false, error: 'ใส่รหัสผ่านผิดหลายครั้ง บัญชีนี้ถูกล็อกชั่วคราว ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที ลองใหม่ภายหลัง หรือให้ Admin ตั้งรหัสใหม่' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(u) && String(data[i][1]) === String(p) && String(u) !== '') {
      cache.remove(failKey);
      var status = data[i][6] || 'Active';
      if (status === 'Pending')  return { success: false, error: 'บัญชีของคุณรอการอนุมัติจาก Admin กรุณารอการยืนยัน' };
      if (status === 'Rejected') return { success: false, error: 'บัญชีของคุณถูกปิดหรือถูกปฏิเสธ กรุณาติดต่อ Admin ของหน่วยงาน' };
      var role = String(data[i][3]);
      var user = {
        username: String(data[i][0]), name: String(data[i][2]), role: role, department: String(data[i][5] || '-'),
        branchId: br.id, branchName: br.name, homeBranchId: br.id, homeBranchName: br.name,
        superAdmin: !!(br.home && role === 'Admin')
      };
      return { success: true, user: user, token: cclNewToken_(user, cclPwv_(data[i][1])) };
    }
  }
  fails++;
  cache.put(failKey, String(fails), CCL_LOCK_SEC);
  var left = CCL_MAX_FAIL - fails;
  return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (left > 0 && left <= 2 ? ' (เหลืออีก ' + left + ' ครั้งก่อนถูกล็อก ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที)' : (left <= 0 ? ' — ถูกล็อก ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที' : '')) };
}

// ===== การเข้าระบบค้างไว้ =====
// token มีลายเซ็น (HMAC) + วันหมดอายุในตัว จึงไม่หายเมื่อแคชหมด 6 ชม. — เข้าระบบครั้งเดียวใช้ได้ CCL_TOKEN_DAYS วัน
// ยังตรวจสถานะบัญชีล่าสุดจากชีตทุกครั้งเหมือนเดิม (ถูกปิดบัญชี/ลดสิทธิ์ มีผลทันที)
var CCL_TOKEN_DAYS = 90;
function cclTokSecret_() {
  var p = PropertiesService.getScriptProperties(), k = p.getProperty('CCL_TOKEN_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('CCL_TOKEN_SECRET', k); }
  return k;
}
// คีย์แคชยาวได้ไม่เกิน 250 ตัวอักษร แต่ token แบบใหม่ (มีชื่อภาษาไทยในตัว) ยาวกว่านั้น → ใช้ค่าแฮชของ token เป็นคีย์
function cclTokKey_(token) {
  var t = String(token || '');
  if (t.length <= 200) return 'ccl_tok_' + t;
  return 'ccl_tokh_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8));
}
function cclSign_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, cclTokSecret_())).replace(/=+$/, ''); }

// ลายนิ้วมือของรหัสผ่าน — Admin ตั้งรหัสใหม่/ผู้ใช้เปลี่ยนรหัส = token เก่าใช้ไม่ได้ทันที
function cclPwv_(pw) { return cclSign_('pw:' + String(pw == null ? '' : pw).trim()).slice(0, 12); }

function cclNewToken_(user, pv, days) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify({ u: user, p: pv || '', x: Date.now() + (days || CCL_TOKEN_DAYS) * 86400000, n: Utilities.getUuid().slice(0, 8) }), Utilities.Charset.UTF_8).replace(/=+$/, '');
  var token = 'v2.' + body + '.' + cclSign_(body);
  var cached = {}; for (var k in user) cached[k] = user[k]; cached.pv = pv || '';
  CacheService.getScriptCache().put(cclTokKey_(token), JSON.stringify(cached), CCL_TOKEN_TTL);
  return token;
}

function cclSession_(token) {
  if (!token) return null;
  var cache = CacheService.getScriptCache();
  var key = cclTokKey_(token);
  var raw = cache.get(key);
  if (!raw) {
    // แคชหมดอายุ (ไม่ได้ใช้เกิน 6 ชม.) → ตรวจลายเซ็นของ token แทน
    var m = /^v2\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token));
    if (!m || cclSign_(m[1]) !== m[2]) return null;
    try {
      var pad = m[1] + '===='.slice((m[1].length % 4) || 4);
      var o = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString('UTF-8'));
      if (!o || !o.u || !(o.x > Date.now())) return null;
      o.u.pv = o.p || ''; raw = JSON.stringify(o.u);
    } catch (e) { return null; }
  }
  try { cache.put(key, raw, CCL_TOKEN_TTL); } catch (e) {} // ต่ออายุแคชทุกครั้งที่ใช้งาน
  try { return JSON.parse(raw); } catch (e) { return null; }
}

// ตรวจสิทธิ์/สถานะล่าสุดจากชีต Users ทุกครั้ง (ถูกปิดบัญชีหรือถูกลดสิทธิ์ จะมีผลทันที)
function cclRefreshSess_(sess, token) {
  var homeId = sess.homeBranchId || sess.branchId || CCL_HOME_BRANCH;
  var hb = cclBranch_(homeId);
  if (!hb) return null;
  var sh = cclOpenBranchSS_(hb).getSheetByName(SHEET_USERS_NAME);
  if (!sh) return null;
  var rows = sh.getDataRange().getValues(), found = null;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(sess.username)) { found = rows[i]; break; }
  if (!found || (found[6] || 'Active') !== 'Active' || (sess.pv && cclPwv_(found[1]) !== sess.pv)) { try { CacheService.getScriptCache().remove(cclTokKey_(token)); } catch (e) {} return null; }
  var role = String(found[3]);
  var sup = !!(hb.home && role === 'Admin');
  if (sess.superAdmin && !sup) {            // ถูกลดสิทธิ์ผู้ดูแลสูงสุด → กลับไปหน่วยงานตัวเอง
    sess.branchId = homeId; sess.branchName = hb.name; sess.superAdmin = false; sess.role = role;
  } else if (!sess.superAdmin || sess.branchId === homeId) {
    sess.role = role; sess.superAdmin = sup;
  }
  return sess;
}

// ผู้ดูแลสูงสุดเข้าดูหน่วยงานอื่น (ได้ token ใหม่ของหน่วยงานนั้น ในฐานะ Admin)
function cclSwitchBranch_(sess, oldToken, branchId) {
  var b = cclUseBranch_(branchId, true);
  var user = {
    username: sess.username, name: sess.name, department: sess.department,
    role: 'Admin', branchId: b.id, branchName: b.name,
    homeBranchId: sess.homeBranchId || CCL_HOME_BRANCH, homeBranchName: sess.homeBranchName || CCL_HOME_NAME,
    superAdmin: true
  };
  var token = cclNewToken_(user, sess.pv);
  try { CacheService.getScriptCache().remove(cclTokKey_(oldToken)); } catch (e) {}
  return { success: true, user: user, token: token };
}

// ===== ผู้ดูแลสูงสุด: จัดการหน่วยงาน =====
function cclAdminBranches_(sess) {
  return cclBranches_().map(function (b) {
    var o = { id: b.id, name: b.name, active: !!b.active, home: !!b.home, created: b.created || '', jobs: 0, users: 0, pending: 0, admins: [], sheetUrl: '' };
    try {
      var ss = cclOpenBranchSS_(b);
      o.sheetUrl = ss.getUrl();
      var d = ss.getSheetByName(SHEET_DATA_NAME); if (d) o.jobs = Math.max(0, d.getLastRow() - 1);
      var us = ss.getSheetByName(SHEET_USERS_NAME);
      if (us && us.getLastRow() > 1) {
        us.getRange(2, 1, us.getLastRow() - 1, 7).getValues().forEach(function (r) {
          if (!r[0]) return;
          var st = r[6] || 'Active';
          if (st === 'Pending') o.pending++;
          else if (st !== 'Rejected') { o.users++; if (r[3] === 'Admin') o.admins.push(String(r[2] || r[0])); }
        });
      }
    } catch (e) { o.error = 'เปิดชีตไม่ได้: ' + e.message; }
    return o;
  });
}

function cclCreateBranch_(sess, info) {
  info = info || {};
  var id = String(info.id || '').trim().toLowerCase();
  var name = String(info.name || '').trim();
  var au = String(info.adminUser || '').trim(), an = String(info.adminName || '').trim(), ap = String(info.adminPass || '');
  if (!/^[a-z0-9_-]{2,20}$/.test(id)) throw new Error('รหัสหน่วยงานใช้ a-z, 0-9, - หรือ _ ยาว 2–20 ตัว เช่น klongthom');
  if (!name) throw new Error('กรุณาใส่ชื่อหน่วยงาน');
  if (!au || !an || ap.length < 4) throw new Error('กรุณาใส่ชื่อผู้ใช้ ชื่อ-สกุล และรหัสผ่าน (อย่างน้อย 4 ตัว) ของ Admin คนแรก');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var list = cclBranches_();
    if (list.some(function (b) { return b.id === id; })) throw new Error('รหัสหน่วยงานนี้มีแล้ว');
    if (list.some(function (b) { return b.name === name; })) throw new Error('ชื่อหน่วยงานนี้มีแล้ว');

    var home = SpreadsheetApp.getActiveSpreadsheet();
    var ss = SpreadsheetApp.create('สมุดคุม แฟ้มงานก่อสร้าง - ' + name);
    var folderId = '';
    try {
      var parents = DriveApp.getFileById(home.getId()).getParents();
      var root = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
      var bf = root.createFolder('CCL - ' + name);
      DriveApp.getFileById(ss.getId()).moveTo(bf);
      folderId = bf.createFolder('ไฟล์แนบ').getId();
    } catch (e) { folderId = ''; }

    cclBuildBranchSheets_(home, ss, { name: name, adminUser: au, adminName: an, adminPass: ap });

    var b = { id: id, name: name, sheetId: ss.getId(), folderId: folderId || CCL_FOLDER_ID, active: true, home: false,
              created: new Date().toISOString(), createdBy: sess.name || sess.username };
    list.push(b);
    cclSaveBranches_(list);
    return { success: true, branch: { id: id, name: name }, sheetUrl: ss.getUrl() };
  } finally { lock.releaseLock(); }
}

// สร้างแท็บในชีตใหม่โดยคัดลอกเฉพาะหัวตารางจากชีตอ่าวลึก (ไม่คัดลอกข้อมูล)
function cclBuildBranchSheets_(home, ss, info) {
  var plan = [
    { n: SHEET_DATA_NAME, cols: 45 }, { n: SHEET_USERS_NAME, cols: 8 }, { n: SHEET_OPTIONS_NAME, cols: 4 },
    { n: SHEET_HISTORY_NAME, cols: 6 }, { n: 'BudgetApprovals', cols: 16 }, { n: 'ContractorUsers', cols: 10 },
    { n: 'Appointments', cols: 12 }
  ];
  var first = ss.getSheets()[0];
  plan.forEach(function (p, idx) {
    var src = home.getSheetByName(p.n);
    var headers = src && src.getLastColumn() > 0 ? src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0] : null;
    if (!headers && p.n !== SHEET_USERS_NAME && p.n !== SHEET_OPTIONS_NAME && p.n !== SHEET_DATA_NAME && p.n !== SHEET_HISTORY_NAME) return;
    var sh = idx === 0 ? first.setName(p.n) : ss.insertSheet(p.n);
    var need = Math.max(p.cols, headers ? headers.length : 0);
    if (sh.getMaxColumns() < need) sh.insertColumnsAfter(sh.getMaxColumns(), need - sh.getMaxColumns());
    if (headers) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    else if (p.n === SHEET_USERS_NAME) sh.getRange(1, 1, 1, 7).setValues([['Username', 'Password', 'Name', 'Role', 'RegisteredDate', 'Department', 'Status']]);
    else if (p.n === SHEET_OPTIONS_NAME) sh.getRange(1, 1, 1, 2).setValues([['Category', 'Value']]);
    else if (p.n === SHEET_HISTORY_NAME) sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'JobId', 'Status', 'ActionBy', 'Details']]);
    else if (p.n === SHEET_DATA_NAME) sh.getRange(1, 1, 1, 1).setValue('Timestamp');
    sh.setFrozenRows(1);
    if (src && src.isSheetHidden()) sh.hideSheet();
  });
  ss.getSheetByName(SHEET_USERS_NAME).appendRow([info.adminUser, info.adminPass, info.adminName, 'Admin', new Date(), info.name, 'Active']);
  var op = ss.getSheetByName(SHEET_OPTIONS_NAME);
  op.appendRow(['Contractor', 'ไฟฟ้าดำเนินการเอง']);
  op.appendRow(['Config', 'ผู้บันทึกทั่วไป']);
  op.appendRow(['Approver', '']);
}

function cclUpdateBranch_(sess, id, patch) {
  patch = patch || {};
  var list = cclBranches_();
  var b = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) b = list[i];
  if (!b) throw new Error('ไม่พบหน่วยงาน');
  if (patch.name !== undefined) {
    var nm = String(patch.name).trim();
    if (!nm) throw new Error('กรุณาใส่ชื่อหน่วยงาน');
    b.name = nm;
  }
  if (patch.active !== undefined) {
    if (b.home && !patch.active) throw new Error('ปิดหน่วยงานหลักไม่ได้');
    b.active = !!patch.active;
  }
  cclSaveBranches_(list);
  return { success: true };
}

// ===== Admin หน่วยงาน: จัดการผู้ใช้ของหน่วยงานตัวเอง =====
function cclUsersSheet_() {
  var sh = cclSS_().getSheetByName(SHEET_USERS_NAME);
  if (!sh) throw new Error('ไม่พบชีต Users');
  return sh;
}
function cclListUsers_(sess) {
  var sh = cclUsersSheet_();
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().map(function (r, i) {
    return { row: i + 2, username: String(r[0]), name: String(r[2]), role: String(r[3] || 'User'),
             department: String(r[5] || '-'), status: String(r[6] || 'Active') };
  }).filter(function (u) { return u.username; });
}
function cclCheckRow_(sh, row, username) {
  row = Number(row);
  if (!(row >= 2) || row > sh.getLastRow()) throw new Error('ไม่พบผู้ใช้');
  if (String(sh.getRange(row, 1).getValue()) !== String(username)) throw new Error('ข้อมูลผู้ใช้เปลี่ยนไปแล้ว กรุณารีเฟรช');
  return row;
}
function cclActiveAdminCount_(sh) {
  return sh.getRange(2, 1, Math.max(1, sh.getLastRow() - 1), 7).getValues()
    .filter(function (r) { return r[0] && r[3] === 'Admin' && (r[6] || 'Active') === 'Active'; }).length;
}
function cclSetUserRole_(sess, row, username, role) {
  if (role !== 'Admin' && role !== 'User') throw new Error('สิทธิ์ไม่ถูกต้อง');
  var sh = cclUsersSheet_(); row = cclCheckRow_(sh, row, username);
  if (role === 'User' && sh.getRange(row, 4).getValue() === 'Admin' && cclActiveAdminCount_(sh) <= 1)
    throw new Error('ต้องมี Admin อย่างน้อย 1 คนในหน่วยงาน');
  sh.getRange(row, 4).setValue(role);
  return { success: true };
}
function cclSetUserStatus_(sess, row, username, status) {
  if (['Active', 'Rejected'].indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  var sh = cclUsersSheet_(); row = cclCheckRow_(sh, row, username);
  if (String(username) === String(sess.username) && status !== 'Active' && sess.branchId === (sess.homeBranchId || sess.branchId))
    throw new Error('ปิดบัญชีของตัวเองไม่ได้');
  if (status !== 'Active' && sh.getRange(row, 4).getValue() === 'Admin' && cclActiveAdminCount_(sh) <= 1)
    throw new Error('ต้องมี Admin อย่างน้อย 1 คนในหน่วยงาน');
  sh.getRange(row, 7).setValue(status);
  return { success: true };
}
function cclResetUserPassword_(sess, row, username, newPass) {
  newPass = String(newPass || '');
  if (newPass.length < 4) throw new Error('รหัสผ่านต้องมีอย่างน้อย 4 ตัว');
  var sh = cclUsersSheet_(); row = cclCheckRow_(sh, row, username);
  sh.getRange(row, 2).setValue(newPass);
  try { CacheService.getScriptCache().remove('ccl_fail_' + (sess.branchId || CCL_HOME_BRANCH) + ':' + String(username).toLowerCase()); } catch (e) {}
  return { success: true };
}

// ===================================================================
//  Contractor Portal (ผู้รับจ้าง) — token แยกประเภท เห็นเฉพาะงานของบริษัทตัวเอง
// ===================================================================
// ฟังก์ชันที่ผู้รับจ้างเรียกได้ — ชื่อเดียวกับที่หน้า Portal เดิมเรียก แต่หลังบ้านบังคับบริษัท/ตรวจว่างานเป็นของบริษัทนั้นเสมอ
var CCL_CT_FNS = {
  getContractorJobs:          function (s, a) { return getContractorJobs(s.company); },
  getOldContractorJobs:       function (s, a) { return getOldContractorJobs(s.company); },
  getAppointments:            function (s, a) { return getAppointments(s.company); },
  getOptions:                 function (s, a) { if (a[0] !== 'กองหมอน') throw new Error('ไม่อนุญาต'); return getOptions('กองหมอน'); },
  addContractorUpdate:        function (s, a) { cclCtOwn_(s, a[0]); var u = cclCtClean_(a[1]); u.contractorName = s.name; u.contractorCo = s.company;
                                                if (u.updateType === 'pea_reply') u.updateType = 'note'; return addContractorUpdate(a[0], u); },
  uploadContractorAttachment: function (s, a) { cclCtOwn_(s, a[0]); if (String(a[2] || '').length > 14000000) throw new Error('ไฟล์ใหญ่เกินไป (เกิน 10 MB)');
                                                return uploadContractorAttachment(a[0], String(a[1] || 'file').slice(0, 120), a[2], a[3]); },
  getMaterialData:            function (s, a) { cclCtOwn_(s, a[0]); return getMaterialData(a[0]); },
  saveMaterialData:           function (s, a) { cclCtOwn_(s, a[0]); var m = cclCtClean_(a[1]); m.contractorName = s.name; return saveMaterialData(a[0], m); },
  deleteContractorMaterial:   function (s, a) { cclCtOwn_(s, a[0]); return deleteContractorMaterial(a[0], Number(a[1])); },
  updateOldJobStatus:         function (s, a) { cclCtOwn_(s, a[0]); return updateOldJobStatus(a[0], String(a[1] || ''), String(a[2] || ''), s.name); },
  ctChangePassword:           function (s, a) { return cclCtChangePassword_(s, a[0], a[1]); },
  ctWhoAmI:                   function (s, a) { var o = {}; for (var k in s) if (k !== 'pv') o[k] = s[k]; return o; }
};

function cclCtLogin_(u, p, branchId) {
  var br;
  try { br = cclUseBranch_(branchId || CCL_HOME_BRANCH); } catch (e) { return { success: false, error: e.message }; }
  var cache = CacheService.getScriptCache();
  var failKey = 'ccl_ctfail_' + br.id + ':' + String(u || '').trim().toLowerCase();
  var fails = Number(cache.get(failKey) || 0);
  if (fails >= CCL_MAX_FAIL) return { success: false, error: 'ใส่รหัสผ่านผิดหลายครั้ง บัญชีนี้ถูกล็อกชั่วคราว ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที ลองใหม่ภายหลัง หรือติดต่อ PEA' };
  var sh = cclSS_().getSheetByName('ContractorUsers');
  if (sh && String(u || '').trim()) {
    var d = sh.getDataRange().getValues();
    for (var i = 1; i < d.length; i++) {
      if (String(d[i][0]).trim() === String(u).trim() && String(d[i][1]).trim() === String(p || '').trim()) {
        if (String(d[i][5]).trim() === 'Inactive') return { success: false, error: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อ PEA' };
        if (!String(d[i][3]).trim()) return { success: false, error: 'บัญชีนี้ยังไม่ได้ผูกกับบริษัท กรุณาติดต่อ PEA' };
        cache.remove(failKey);
        var user = { type: 'contractor', username: String(d[i][0]).trim(), name: String(d[i][2]), company: String(d[i][3]).trim(),
                     phone: String(d[i][4] || ''), branchId: br.id, branchName: br.name };
        return { success: true, user: user, token: cclNewToken_(user, cclPwv_(d[i][1])) };
      }
    }
  }
  fails++;
  cache.put(failKey, String(fails), CCL_LOCK_SEC);
  var left = CCL_MAX_FAIL - fails;
  return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (left > 0 && left <= 2 ? ' (เหลืออีก ' + left + ' ครั้งก่อนถูกล็อก)' : (left <= 0 ? ' — ถูกล็อก ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที' : '')) };
}

function cclCtDispatch_(sess, token, fn, args) {
  try {
    if (sess.preview) return cclCtPreviewDispatch_(sess, token, fn, args);
    cclUseBranch_(sess.branchId || CCL_HOME_BRANCH);
    // ตรวจบัญชีล่าสุดทุกครั้ง: ถูกระงับ / ย้ายบริษัท → ต้องเข้าใหม่
    var sh = cclSS_().getSheetByName('ContractorUsers');
    var d = sh ? sh.getDataRange().getValues() : [], row = null;
    for (var i = 1; i < d.length; i++) if (String(d[i][0]).trim() === sess.username) { row = d[i]; break; }
    if (!row || String(row[5]).trim() === 'Inactive' || String(row[3]).trim() !== sess.company || (sess.pv && cclPwv_(row[1]) !== sess.pv)) {
      try { CacheService.getScriptCache().remove(cclTokKey_(token)); } catch (e) {}
      return { ok: false, error: 'AUTH_REQUIRED' };
    }
    var h = CCL_CT_FNS[fn];
    if (!h) return { ok: false, error: 'ไม่รองรับคำสั่ง ' + fn };
    var out = h(sess, Array.isArray(args) ? args : []);
    return { ok: true, data: out === undefined ? null : out };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

// ===== เจ้าหน้าที่ กฟภ. เปิดดูโปรแกรมผู้รับจ้าง (ดูอย่างเดียว) =====
// ใครเปิดได้: Admin / ผู้ควบคุมงานของงานผู้รับจ้างรายนั้น / คณะกรรมการตรวจรับ
var CCL_CT_PREVIEW_FNS = ['getContractorJobs','getOldContractorJobs','getAppointments','getOptions','getMaterialData','ctWhoAmI'];
function cclNameKey_(n) {
  return String(n || '').replace(/^\s*(นางสาว|นาย|นาง|น\.ส\.|ว่าที่\s*ร\.?ต\.?)\s*/, '').replace(/\s+/g, '').toLowerCase();
}
function cclCtCanPreview_(sess, company) {
  if (sess.role === 'Admin' || sess.superAdmin) return true;
  var me = cclNameKey_(sess.name);
  if (!me) return false;
  var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh ? sh.getLastRow() : 0;
  if (last >= 2) {
    var d = sh.getRange(2, 1, last - 1, 18).getDisplayValues();
    for (var i = 0; i < d.length; i++)
      if (String(d[i][17]).trim() === company && cclNameKey_(d[i][14]) === me) return true;
  }
  var com = [];
  try { com = getOptions('Committee') || []; } catch (e) { com = []; }
  for (var j = 0; j < com.length; j++) {
    var x = com[j], nm = x;
    if (typeof x === 'string') { try { var o = JSON.parse(x); nm = (o && o.name) || x; } catch (e) { nm = x; } }
    else if (x && x.name) nm = x.name;
    if (cclNameKey_(nm) === me) return true;
  }
  return false;
}
function cclCtPreview_(sess, company) {
  company = String(company || '').trim();
  if (!company || company === '-') throw new Error('ไม่ระบุผู้รับจ้าง');
  if (!cclCtCanPreview_(sess, company)) throw new Error('เปิดดูได้เฉพาะ Admin, ผู้ควบคุมงานของผู้รับจ้างรายนี้ และคณะกรรมการตรวจรับ');
  var user = { type: 'contractor', preview: true, viewer: sess.username, viewerHome: sess.homeBranchId || sess.branchId || CCL_HOME_BRANCH,
               viewerSuper: !!sess.superAdmin, username: sess.username, name: sess.name, company: company, phone: '',
               branchId: sess.branchId || CCL_HOME_BRANCH, branchName: sess.branchName || '' };
  return { success: true, user: user, token: cclNewToken_(user, sess.pv, 1) };
}
function cclCtPreviewDispatch_(sess, token, fn, args) {
  // ตรวจว่าเจ้าหน้าที่คนนี้ยังใช้งานได้อยู่ (ถูกปิดบัญชี/เปลี่ยนรหัส → ใช้ไม่ได้ทันที)
  var st = { username: sess.viewer, homeBranchId: sess.viewerHome, branchId: sess.viewerHome, pv: sess.pv };
  if (!sess.viewer || !cclRefreshSess_(st, token)) return { ok: false, error: 'AUTH_REQUIRED' };
  if (CCL_CT_PREVIEW_FNS.indexOf(fn) < 0) return { ok: false, error: 'โหมดเจ้าหน้าที่ กฟภ. ดูได้อย่างเดียว — แก้ไข/ส่งข้อมูลแทนผู้รับจ้างไม่ได้' };
  cclUseBranch_(sess.branchId || CCL_HOME_BRANCH, !!sess.viewerSuper);
  var out = CCL_CT_FNS[fn](sess, Array.isArray(args) ? args : []);
  return { ok: true, data: out === undefined ? null : out };
}

// งานต้องเป็นของบริษัทผู้รับจ้างคนนี้เท่านั้น
function cclCtOwn_(sess, jobId) {
  var id = parseInt(jobId, 10);
  var sh = cclSS_().getSheetByName(SHEET_DATA_NAME);
  if (!sh || !(id >= 2) || id > sh.getLastRow()) throw new Error('ไม่พบงานนี้');
  var ent = String(sh.getRange(id, 18).getValue() || '').trim();
  if (!ent || ent !== sess.company) throw new Error('งานนี้ไม่ใช่งานของบริษัทท่าน');
  return id;
}

function cclCtClean_(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('ข้อมูลไม่ถูกต้อง');
  var s = JSON.stringify(o);
  if (s.length > 200000) throw new Error('ข้อมูลยาวเกินไป');
  return JSON.parse(s);
}

function cclCtChangePassword_(sess, oldP, newP) {
  newP = String(newP || '');
  if (newP.length < 4) throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัว');
  var sh = cclSS_().getSheetByName('ContractorUsers');
  var d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][0]).trim() === sess.username) {
      if (String(d[i][1]).trim() !== String(oldP || '').trim()) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
      sh.getRange(i + 1, 2).setValue(newP);
      return { success: true };
    }
  }
  throw new Error('ไม่พบบัญชี');
}

function cclJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// ===== เงื่อนไขสถานะงาน (Job Code, คอลัมน์ 29 ของชีต Data) =====
// ตรวจรับงาน ต้อง D1 ขึ้นไป / ส่งปิดงาน ต้อง D2 ขึ้นไป / ตัดงบหรือแก้ค่าใช้จ่าย ต้อง C1 ขึ้นไป
var CCL_CODE_NEED = { 'ตรวจรับงาน': 'D1', 'ส่งปิดงาน': 'D2' };
// ลำดับตามตารางสถานะผู้ใช้ของ SAP (E2 = ยกเลิกหมายเลขงาน → ต่ำสุด)
var CCL_CODE_ORD = { A0: 10, A1: 11, A2: 12, A5: 13, B1: 20, B2: 21, C1: 30, C2: 30, C3: 31, C4: 31, C5: 31, C6: 31, C9: 32, D1: 40, F3: 41, D2: 50, D9: 50, D3: 51, E1: 52, F1: 53, F9: 53, F2: 60, F4: 70, E2: -1 };
function cclCodeRank_(c) {
  c = String(c || '').trim().toUpperCase();
  if (CCL_CODE_ORD[c] != null) return CCL_CODE_ORD[c];
  var m = /^([A-Z])\s*(\d+)/.exec(c); if (!m) return -1;
  var b = { A: 10, B: 20, C: 30, D: 40, E: 50, F: 60 }[m[1]];
  return b == null ? -1 : b + Math.min(9, parseInt(m[2], 10));
}
function cclJobCodeGate_(fn, args) {
  var id = null, min = null, what = '';
  if (fn === 'updateWorkStatus') { id = args[0]; min = CCL_CODE_NEED[String(args[1] || '')] || null; what = String(args[1] || ''); }
  else if (fn === 'addExpense') { id = args[0] && args[0].jobId; min = 'C1'; what = 'ตัดงบ'; }
  else if (fn === 'updateExpense') { id = args[0]; min = 'C1'; what = 'แก้ไขค่าใช้จ่าย'; }
  if (!min) return;
  var r = parseInt(id, 10); if (!(r >= 2)) return;
  var sh = cclSS_().getSheetByName(SHEET_DATA_NAME); if (!sh || r > sh.getLastRow()) return;
  if (fn === 'updateWorkStatus' && ['ส่งปิดงาน', 'ปิดงานแล้วเสร็จ', 'อนุมัติ/เสร็จสิ้น'].indexOf(String(sh.getRange(r, 16).getValue() || '')) >= 0 && what === 'ตรวจรับงาน') return; // ส่งคืนย้อนกลับ ไม่ต้องตรวจ
  var code = String(sh.getRange(r, 29).getValue() || '').trim();
  if (cclCodeRank_(code) < cclCodeRank_(min))
    throw new Error('สถานะงาน (Job Code) ' + (code ? 'ยังเป็น ' + code : 'ยังไม่ได้ระบุ') + ' — ต้องเปลี่ยนเป็น ' + min + ' ขึ้นไปก่อน จึงจะ' + what + 'ได้');
}


// ===== ขั้นตอนอนุมัติรายจ่าย (เก็บในรายการตัดงบ คอลัมน์ 28) =====
// stage: print=รอพิมพ์, sign=พิมพ์แล้วรอเซ็น, ok=อนุมัติแล้ว, back=ตีกลับ, file=แนบสแกนอย่างเดียว
var CCL_EXP_STAGE = { print: 'ส่งกลับไปรอพิมพ์ใบอนุมัติ', sign: 'พิมพ์ใบอนุมัติแล้ว รอเซ็น', ok: 'อนุมัติแล้ว', back: 'ตีกลับให้แก้ไข', file: 'แนบสแกนใบอนุมัติที่เซ็นแล้ว' };
var CCL_EXP_TL = { labor: 'ค่าแรง', supervision: 'ค่าคุมงาน', misc: 'ค่าเบ็ดเตล็ด' };
function cclExpStage_(sess, items, stage, note) {
  if (!CCL_EXP_STAGE[stage]) throw new Error('ขั้นตอนไม่ถูกต้อง');
  if (!Array.isArray(items) || !items.length) return { success: true, done: 0, miss: 0 };
  if (items.length > 300) throw new Error('เลือกได้ครั้งละไม่เกิน 300 รายการ');
  note = String(note || '').slice(0, 300);
  if (stage === 'back' && !note) throw new Error('กรุณาระบุเหตุผลที่ตีกลับ');
  var who = String(sess.name || sess.username || '-'), now = new Date().toISOString();
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var done = 0, miss = 0, logs = [];
  try {
    var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh.getLastRow();
    var byRow = {};
    items.forEach(function (it) { var r = parseInt(it && it.jobId, 10); if (r >= 2 && r <= last) (byRow[r] = byRow[r] || []).push(it); else miss++; });
    Object.keys(byRow).forEach(function (rk) {
      var r = Number(rk), cell = sh.getRange(r, 28), arr;
      try { arr = JSON.parse(cell.getValue() || '[]'); } catch (e) { arr = null; }
      if (!Array.isArray(arr)) { miss += byRow[rk].length; return; }
      var changed = false;
      byRow[rk].forEach(function (it) {
        var ts = String(it.ts || ''), k = -1, i = parseInt(it.idx, 10);
        if (arr[i] && String(arr[i].timestamp || '') === ts) k = i;
        else if (ts) { for (var j = 0; j < arr.length; j++) if (String(arr[j].timestamp || '') === ts) { k = j; break; } }
        if (k < 0) { miss++; return; }
        var e = arr[k];
        if (stage === 'file') { var f = String(it.file || ''); if (!/^https:\/\/(drive|docs)\.google\.com\//.test(f)) { miss++; return; } e.apFile = f; }
        else { e.apSt = stage; e.apBy = who; e.apAt = now; if (stage === 'back') e.apNote = note; else if (stage === 'print') delete e.apNote; }
        var lg = Array.isArray(e.apLog) ? e.apLog : []; lg.push({ st: stage, by: who, at: now, note: note || undefined }); e.apLog = lg.slice(-10);
        changed = true; done++;
        logs.push([r, CCL_EXP_STAGE[stage] + ' · ' + (CCL_EXP_TL[e.type] || e.type || '') + ' ' + (Number(e.amount) || 0).toLocaleString() + ' บาท' + (e.desc ? ' (' + e.desc + ')' : '') + (note ? ' — ' + note : '')]);
      });
      if (changed) cell.setValue(JSON.stringify(arr));
    });
  } finally { lock.releaseLock(); }
  logs.forEach(function (l) { try { logHistory(l[0], 'อนุมัติรายจ่าย', who, l[1]); } catch (e) {} });
  return { success: true, done: done, miss: miss };
}


// ===== แก้สถานะงาน (Job Code, คอลัมน์ 29) ทีละหลายงาน — เช่น ปรับตาม SAP =====
// items: [{id, code, old}] — จะแก้เฉพาะแถวที่ค่าปัจจุบันยังเท่ากับ old (กันทับข้อมูลที่เพิ่งมีคนแก้)
function cclSetJobCodes_(sess, items, reason) {
  if (!Array.isArray(items) || !items.length) return { success: true, done: 0, skip: 0 };
  if (items.length > 400) throw new Error('แก้ได้ครั้งละไม่เกิน 400 งาน');
  reason = String(reason || '').slice(0, 100);
  var who = String(sess.name || sess.username || '-'), done = 0, skip = [], logs = [];
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh.getLastRow();
    var col = sh.getRange(1, 29, last, 1).getValues();
    items.forEach(function (it) {
      var r = parseInt(it && it.id, 10), code = String(it && it.code || '').trim().toUpperCase();
      if (!(r >= 2 && r <= last) || !/^[A-Z]\d{1,2}$/.test(code)) { skip.push(it && it.id); return; }
      var cur = String(col[r - 1][0] || '').trim();
      if (cur !== String(it.old == null ? '' : it.old).trim()) { skip.push(r); return; }
      if (cur.toUpperCase() === code) return;
      sh.getRange(r, 29).setValue(code); done++;
      logs.push([r, 'สถานะงาน ' + (cur || 'ว่าง') + ' → ' + code + (reason ? ' (' + reason + ')' : '')]);
    });
  } finally { lock.releaseLock(); }
  logs.forEach(function (l) { try { logHistory(l[0], 'แก้ไขข้อมูล', who, l[1]); } catch (e) {} });
  return { success: true, done: done, skip: skip.length, skipped: skip.slice(0, 50) };
}


// ===== แก้ข้อมูลงานทีละหลายงาน (ชื่องาน / หมายเลขงาน / ผู้ควบคุมงาน) หรือล้างแถวทดลอง =====
// items: [{id, field, value, old}] — field: jobName(คอลัมน์ 5) | jobIds(8) | assignee(15) | clear(ล้างทั้งแถว)
// แก้เฉพาะเมื่อค่าปัจจุบันยังเท่ากับ old · clear ต้องส่ง old = เลขที่รับ และแถวต้องไม่มีชื่องาน
var CCL_FIX_COL = { jobName: 5, jobIds: 8, assignee: 15 };
var CCL_FIX_TH = { jobName: 'ชื่องาน', jobIds: 'หมายเลขงาน', assignee: 'ผู้ควบคุมงาน' };
function cclFixJobs_(sess, items, reason) {
  if (!Array.isArray(items) || !items.length) return { success: true, done: 0, skip: 0 };
  if (items.length > 400) throw new Error('แก้ได้ครั้งละไม่เกิน 400 รายการ');
  reason = String(reason || '').slice(0, 100);
  var who = String(sess.name || sess.username || '-'), done = 0, skip = [], logs = [];
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh.getLastRow(), lastCol = sh.getLastColumn();
    items.forEach(function (it) {
      var r = parseInt(it && it.id, 10), f = String(it && it.field || '');
      if (!(r >= 2 && r <= last)) { skip.push(it && it.id); return; }
      if (f === 'clear') {
        var no = String(sh.getRange(r, 2).getValue() || '').trim(), nm = String(sh.getRange(r, 5).getValue() || '').trim();
        if (!no || no !== String(it.old || '').trim() || nm) { skip.push(r); return; }
        sh.getRange(r, 1, 1, lastCol).clearContent(); done++; return;
      }
      var c = CCL_FIX_COL[f]; if (!c) { skip.push(r); return; }
      var cur = String(sh.getRange(r, c).getValue() == null ? '' : sh.getRange(r, c).getValue()).trim(), val = String(it.value == null ? '' : it.value).trim().slice(0, 500);
      if (cur !== String(it.old == null ? '' : it.old).trim() || !val) { skip.push(r); return; }
      if (cur === val) return;
      sh.getRange(r, c).setValue(val); done++;
      logs.push([r, CCL_FIX_TH[f] + ': ' + (cur || 'ว่าง') + ' → ' + val + (reason ? ' (' + reason + ')' : '')]);
    });
  } finally { lock.releaseLock(); }
  logs.forEach(function (l) { try { logHistory(l[0], 'แก้ไขข้อมูล', who, l[1]); } catch (e) {} });
  return { success: true, done: done, skip: skip.length, skipped: skip.slice(0, 50) };
}


// ======================================================================
// ===== นำเข้าสถานะ SAP อัตโนมัติจากโฟลเดอร์ Google Drive =====
// วางไฟล์ .xlsx ที่ export จาก SAP ไว้ในโฟลเดอร์ "CCL-SAP" → ตรวจทุกวันตามเวลาที่ตั้ง
// อัปเดตสถานะงาน (Job Code) ตาม SAP · ปิดงานที่ SAP = CLSD พร้อมเติมขั้นที่ข้าม · สรุปเข้า LINE
// ======================================================================
var CCL_SAP_CFG = 'CCL_SAP_AUTO_CFG', CCL_SAP_LOG = 'CCL_SAP_AUTO_LOG';
var CCL_STEPS = ['รับเรื่อง', 'สำรวจงาน', 'ดำเนินงาน', 'ตรวจรับงาน', 'ส่งปิดงาน'];
function cclSapCfg_() {
  var c = {}; try { c = JSON.parse(PropertiesService.getScriptProperties().getProperty(CCL_SAP_CFG) || '{}'); } catch (e) {}
  return { on: !!c.on, folderId: c.folderId || '', doneId: c.doneId || '', hour: c.hour == null ? 7 : Number(c.hour),
    updCodes: c.updCodes !== false, closeClsd: c.closeClsd !== false, onlySent: !!c.onlySent, line: c.line !== false };
}
function cclSapSaveCfg_(c) { PropertiesService.getScriptProperties().setProperty(CCL_SAP_CFG, JSON.stringify(c)); }
function cclSapLog_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(CCL_SAP_LOG) || '[]'); } catch (e) { return []; } }
function cclSapAddLog_(e) { var l = cclSapLog_(); l.unshift(e); PropertiesService.getScriptProperties().setProperty(CCL_SAP_LOG, JSON.stringify(l.slice(0, 20))); }
function cclSapFolders_(c, create) {
  var f = null, d = null;
  try { if (c.folderId) f = DriveApp.getFolderById(c.folderId); } catch (e) { f = null; }
  if (!f && create) { f = DriveApp.createFolder('CCL-SAP (วางไฟล์สถานะ SAP ที่นี่)'); c.folderId = f.getId(); }
  if (!f) return null;
  try { if (c.doneId) d = DriveApp.getFolderById(c.doneId); } catch (e) { d = null; }
  if (!d) { var it = f.getFoldersByName('อ่านแล้ว'); d = it.hasNext() ? it.next() : f.createFolder('อ่านแล้ว'); c.doneId = d.getId(); }
  return { f: f, d: d };
}
function cclSapTriggerOn_() { return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cclSapAutoDaily'; }); }
function cclSapSetTrigger_(c) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cclSapAutoDaily') ScriptApp.deleteTrigger(t); });
  if (c.on) ScriptApp.newTrigger('cclSapAutoDaily').timeBased().atHour(Math.max(0, Math.min(23, c.hour))).everyDays(1).inTimezone('Asia/Bangkok').create();
}
function cclSapAutoGet_(sess, isAdmin) {
  var c = cclSapCfg_(), fs = null; try { fs = cclSapFolders_(c, false); } catch (e) {}
  var waiting = 0; if (fs) { var it = fs.f.getFiles(); while (it.hasNext()) { if (/\.xlsx$/i.test(it.next().getName())) waiting++; } }
  var trig = false; try { trig = cclSapTriggerOn_(); } catch (e) {}
  return { cfg: { on: c.on, hour: c.hour, updCodes: c.updCodes, closeClsd: c.closeClsd, onlySent: c.onlySent, line: c.line },
    folderUrl: fs ? fs.f.getUrl() : '', waiting: waiting, trigger: trig, log: cclSapLog_(), admin: !!isAdmin };
}
function cclSapAutoSet_(sess, patch) {
  var c = cclSapCfg_(); patch = patch || {};
  ['on', 'updCodes', 'closeClsd', 'onlySent', 'line'].forEach(function (k) { if (k in patch) c[k] = !!patch[k]; });
  if ('hour' in patch) c.hour = Math.max(0, Math.min(23, parseInt(patch.hour, 10) || 0));
  cclSapFolders_(c, true); cclSapSaveCfg_(c); cclSapSetTrigger_(c);
  return cclSapAutoGet_(sess, true);
}
// ตัวตั้งเวลาเรียกฟังก์ชันนี้ทุกวัน
function cclSapAutoDaily() {
  try { cclUseBranch_(CCL_HOME_BRANCH); } catch (e) {}
  cclSapAutoRun_('ระบบอัตโนมัติ (SAP)', false);
}

// ----- อ่าน .xlsx (แตก zip อ่าน XML เอง ไม่ต้องแปลงไฟล์) -----
function cclXmlTxt_(s) { return String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&'); }
function cclXlsxRows_(blob) {
  var parts = Utilities.unzip(blob.setContentType('application/zip')), ss = '', sh = '', sheets = {};
  parts.forEach(function (p) { var n = p.getName(); if (n === 'xl/sharedStrings.xml') ss = p.getDataAsString('UTF-8'); else if (/^xl\/worksheets\/sheet\d+\.xml$/.test(n)) sheets[n] = p; });
  var first = Object.keys(sheets).sort(function (a, b) { return parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10); })[0];
  if (!first) throw new Error('ไฟล์นี้ไม่ใช่ Excel (.xlsx)');
  sh = sheets[first].getDataAsString('UTF-8');
  var strs = [], m, reSi = /<si>([\s\S]*?)<\/si>/g;
  while ((m = reSi.exec(ss))) { var t = '', mt, reT = /<t[^>]*>([\s\S]*?)<\/t>/g; while ((mt = reT.exec(m[1]))) t += mt[1]; strs.push(cclXmlTxt_(t)); }
  var rows = [], reR = /<row[^>]*>([\s\S]*?)<\/row>/g, mr;
  var col = function (ref) { var n = 0; for (var i = 0; i < ref.length; i++) n = n * 26 + ref.charCodeAt(i) - 64; return n - 1; };
  while ((mr = reR.exec(sh))) {
    var row = [], reC = /<c(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/c>)/g, mc, ci = -1;
    while ((mc = reC.exec(mr[1]))) {
      var at = mc[1] || '', rr = /\br="([A-Z]+)\d+"/.exec(at); ci = rr ? col(rr[1]) : ci + 1;
      var ty = (/\bt="(\w+)"/.exec(at) || [])[1] || '', inner = mc[2] || '', v = '';
      if (ty === 's') { var vv = /<v>([\s\S]*?)<\/v>/.exec(inner); v = vv ? (strs[+vv[1]] || '') : ''; }
      else if (ty === 'inlineStr') { v = cclXmlTxt_((/<t[^>]*>([\s\S]*?)<\/t>/.exec(inner) || [])[1] || ''); }
      else { v = cclXmlTxt_((/<v>([\s\S]*?)<\/v>/.exec(inner) || [])[1] || ''); }
      row[ci] = v;
    }
    rows.push(row);
  }
  return rows;
}
function cclSapKey_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
// คืน map: key → {sys, usr}
function cclSapParse_(rows) {
  var hi = -1, cW = -1, cS = -1, cU = -1;
  for (var i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) {
    (rows[i] || []).forEach(function (h, c) { h = String(h || '').trim(); if (/WBS|^หมายเลขงาน$/i.test(h)) cW = c; if (/^สถานะ$|^สถานะระบบ$|^status$|^system.?status$/i.test(h)) cS = c; if (/^สถานะผู้ใช้$|^user.?status$/i.test(h)) cU = c; });
    if (cW >= 0 && cS >= 0) hi = i; else { cW = cS = cU = -1; }
  }
  if (hi < 0) throw new Error('ไม่พบคอลัมน์ "องค์ประกอบ WBS"/"หมายเลขงาน" และ "สถานะ"');
  var map = {}, n = 0;
  for (var r = hi + 1; r < rows.length; r++) {
    var w = String((rows[r] || [])[cW] || '').trim(); if (!w) continue; n++;
    var st = String(rows[r][cS] || ''), sys = (st.trim().split(/\s+/)[0] || '').toUpperCase();
    var usr = (cU >= 0 ? String(rows[r][cU] || '') : (st.split('//')[1] || '')).trim().toUpperCase();
    map[cclSapKey_(w)] = { sys: sys, usr: /^[A-Z]\d{1,2}$/.test(usr) ? usr : '' };
  }
  return { map: map, rows: n };
}

// ----- ปิดงาน 1 แถว + เติมขั้นที่ข้าม (ไม่ส่ง LINE รายงาน — ส่งสรุปรวมทีเดียว) -----
function cclSapCloseRow_(sh, r, who, note, now) {
  var st = String(sh.getRange(r, 16).getValue() || '').trim();
  if (/ปิดงานแล้วเสร็จ|ยกเลิก|อนุมัติ\/เสร็จสิ้น/.test(st)) return false;
  var cell = sh.getRange(r, 30), tl; try { tl = JSON.parse(cell.getValue() || '[]'); } catch (e) { tl = []; } if (!Array.isArray(tl)) tl = [];
  var idx = CCL_STEPS.indexOf(st), add = [], passed = String(sh.getRange(r, 20).getValue() || '') === 'ผ่านการตรวจรับ';
  var skipped = idx < 0 ? CCL_STEPS.slice(1) : CCL_STEPS.slice(idx + 1);
  skipped.forEach(function (s) {
    add.push({ status: s, actionBy: who, details: 'บันทึกย้อนหลัง: ขั้นตอนนี้ถูกข้ามตอนปิดงานตาม SAP (CLSD)' });
    if (s === 'ตรวจรับงาน' && !passed) add.push({ status: 'ผ่านการตรวจรับ', actionBy: who, details: 'ผลตรวจรับ: ผ่านการตรวจรับ (บันทึกย้อนหลัง — SAP ปิดงานแล้ว CLSD)' });
  });
  if (!passed && !add.some(function (a) { return a.status === 'ผ่านการตรวจรับ'; })) {
    var k = add.findIndex(function (a) { return a.status === 'ส่งปิดงาน'; });
    add.splice(k < 0 ? add.length : k, 0, { status: 'ผ่านการตรวจรับ', actionBy: who, details: 'ผลตรวจรับ: ผ่านการตรวจรับ (บันทึกย้อนหลัง — SAP ปิดงานแล้ว CLSD)' });
  }
  add.push({ status: 'ปิดงานแล้วเสร็จ', actionBy: who, details: 'เปลี่ยนสถานะจาก ' + (st || '-') + ' → ปิดงานแล้วเสร็จ' + (note ? ' (' + note + ')' : '') });
  var t0 = now.getTime();
  add.forEach(function (a, i) { a.timestamp = new Date(t0 - (add.length - 1 - i) * 60000).toISOString(); });
  cell.setValue(JSON.stringify(tl.concat(add)));
  if (!passed) sh.getRange(r, 20).setValue('ผ่านการตรวจรับ');
  sh.getRange(r, 16).setValue('ปิดงานแล้วเสร็จ');
  return { from: st, steps: skipped.length };
}
// ปิดงานตาม id ที่เลือกจากหน้าปิดงาน (Admin)
function cclSapCloseIds_(who, ids) {
  if (!Array.isArray(ids) || !ids.length) return { success: true, done: 0 };
  if (ids.length > 300) throw new Error('ปิดได้ครั้งละไม่เกิน 300 งาน');
  var lock = LockService.getScriptLock(), done = [], skip = 0, now = new Date(); lock.waitLock(20000);
  try {
    var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh.getLastRow();
    ids.forEach(function (id) { var r = parseInt(id, 10); if (!(r >= 2 && r <= last)) { skip++; return; } var x = cclSapCloseRow_(sh, r, who, 'SAP = CLSD', now); if (x) done.push(String(sh.getRange(r, 2).getValue() || r)); else skip++; });
  } finally { lock.releaseLock(); }
  if (done.length) { try { sendLineNotify('✅ ปิดงานตาม SAP (CLSD) ' + done.length + ' งาน โดย ' + who + '\n' + done.slice(0, 30).join(' · ') + (done.length > 30 ? ' …' : '')); } catch (e) {} }
  return { success: true, done: done.length, skip: skip };
}

// ----- ตัวหลัก: อ่านไฟล์ใหม่ในโฟลเดอร์ → เทียบ → อัปเดต -----
function cclSapAutoRun_(who, dry) {
  var c = cclSapCfg_(), fs = cclSapFolders_(c, false);
  if (!fs) throw new Error('ยังไม่ได้ตั้งค่าโฟลเดอร์ — เปิดตั้งค่าแล้วกดบันทึกก่อน');
  var files = [], it = fs.f.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/\.xlsx$/i.test(f.getName())) files.push(f); }
  files.sort(function (a, b) { return a.getDateCreated() - b.getDateCreated(); });
  if (!files.length) { if (!dry) cclSapAddLog_({ at: new Date().toISOString(), by: who, none: 1 }); return { success: true, none: true, files: 0 }; }
  var map = {}, names = [], rowsN = 0;
  var lastRows = null, lastName = '';
  files.forEach(function (f) { var xr = cclXlsxRows_(f.getBlob()), p = cclSapParse_(xr); Object.keys(p.map).forEach(function (k) { map[k] = p.map[k]; }); names.push(f.getName()); rowsN += p.rows; if (cclSapReportBuild_(xr, f.getName(), true)) { lastRows = xr; lastName = f.getName(); } });
  var R = cclCodeRank_;
  var res = { codes: [], down: [], closed: [], other: [], nf: [] }, now = new Date();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = cclSS_().getSheetByName(SHEET_DATA_NAME), last = sh.getLastRow();
    var data = sh.getRange(2, 1, last - 1, 29).getValues();
    data.forEach(function (row, i) {
      var r = i + 2, no = String(row[1] || '').trim(); if (!no) return;
      var st = String(row[15] || '').trim(); if (st === 'ยกเลิก') return;
      var ids = String(row[7] || '').split(',').map(function (x) { return cclSapKey_(x); }).filter(function (x) { return x.length > 5; });
      var got = ids.map(function (k) { return map[k]; }).filter(Boolean);
      var open = !/ปิดงานแล้วเสร็จ|อนุมัติ\/เสร็จสิ้น/.test(st);
      if (!got.length) { if (open && ids.length) res.nf.push(no); return; }
      var cs = got.map(function (g) { return g.usr; }).filter(Boolean);
      var code = cs.length ? cs.reduce(function (a, b) { return R(b) < R(a) ? b : a; }) : '', cur = String(row[28] || '').trim();
      if (code && c.updCodes && code !== cur.toUpperCase()) {
        if (R(code) < R(cur)) res.down.push(no + ' ' + cur + '→' + code);
        else { res.codes.push(no + ' ' + (cur || 'ว่าง') + '→' + code); if (!dry) { sh.getRange(r, 29).setValue(code); try { logHistory(r, 'แก้ไขข้อมูล', who, 'สถานะงาน ' + (cur || 'ว่าง') + ' → ' + code + ' (แก้ตาม SAP อัตโนมัติ)'); } catch (e) {} } }
      }
      var clsd = got.length === ids.length && got.every(function (g) { return g.sys === 'CLSD'; });
      if (clsd && open && code === 'E2') { res.other.push(no + ' (SAP ยกเลิกหมายเลขงาน E2)'); return; }
      if (clsd && open && c.closeClsd) {
        if (st === 'ส่งปิดงาน' || !c.onlySent) { res.closed.push(no + (st !== 'ส่งปิดงาน' ? ' (จาก ' + st + ')' : '')); if (!dry) cclSapCloseRow_(sh, r, who, 'SAP = CLSD อัตโนมัติ', now); }
        else res.other.push(no + ' (' + st + ')');
      }
    });
    if (!dry) files.forEach(function (f) { f.moveTo(fs.d); });
  } finally { lock.releaseLock(); }
  var sum = { at: now.toISOString(), by: who, files: names, rows: rowsN, codes: res.codes.length, down: res.down.length, closed: res.closed.length, other: res.other.length, nf: res.nf.length, dry: dry };
  if (!dry) {
    if (lastRows) { try { cclSapSaveReport_(cclSapReportBuild_(lastRows, lastName)); } catch (e) {} }
    cclSapAddLog_(sum);
    if (c.line) {
      var L = function (a, n) { return a.slice(0, n).map(function (x) { return ' • ' + x; }).join('\n') + (a.length > n ? '\n …อีก ' + (a.length - n) + ' งาน' : ''); };
      var msg = '📥 นำเข้าสถานะ SAP ' + (who === 'ระบบอัตโนมัติ (SAP)' ? 'อัตโนมัติ' : 'โดย ' + who) + ' · ' + Utilities.formatDate(now, 'Asia/Bangkok', 'd/M/yyyy HH:mm') + '\nไฟล์: ' + names.join(', ');
      if (res.codes.length) msg += '\n\n🔄 อัปเดตสถานะงาน ' + res.codes.length + ' งาน\n' + L(res.codes, 10);
      if (res.closed.length) msg += '\n\n✅ ปิดงาน (SAP = CLSD) ' + res.closed.length + ' งาน\n' + L(res.closed, 15);
      if (res.down.length) msg += '\n\n⚠️ สถานะงานลดลง รอ Admin ยืนยัน ' + res.down.length + ' งาน\n' + L(res.down, 10);
      if (res.other.length) msg += '\n\n📌 SAP ปิดแล้ว แต่ CCL ยังไม่ถึงส่งปิดงาน ' + res.other.length + ' งาน\n' + L(res.other, 10);
      if (res.nf.length) msg += '\n\n❓ ไม่พบหมายเลขงานใน SAP ' + res.nf.length + ' งาน → ตรวจหมายเลขงาน\n' + L(res.nf, 15);
      if (!res.codes.length && !res.closed.length && !res.down.length && !res.other.length && !res.nf.length) msg += '\n\n✔ ข้อมูล CCL ตรงกับ SAP ทุกงาน';
      try { sendLineNotify(msg); } catch (e) {}
    }
  }
  sum.list = res; sum.success = true;
  return sum;
}

// เรียกครั้งแรกจากหน้าแก้ไขโค้ด เพื่อขอสิทธิ์ Drive + ตัวตั้งเวลา และสร้างโฟลเดอร์ (ยังไม่เปิดตรวจอัตโนมัติ)
function cclSapAutoSetup() {
  try { cclUseBranch_(CCL_HOME_BRANCH); } catch (e) {}
  var d = cclSapAutoSet_({ name: 'setup' }, {});
  Logger.log('ZZRES ' + JSON.stringify({ folder: d.folderUrl, on: d.cfg.on, trigger: d.trigger }));
}


// ===== รายงานสถานะงานจาก SAP (ทุกงบ ทุกโครงการ) — เก็บเป็นไฟล์ JSON ในโฟลเดอร์ CCL-SAP =====
var CCL_SAP_BRANCH_CODE = 'AUL';
function cclSapReportBuild_(rows, fileName, checkOnly) {
  var hi = -1, C = {};
  for (var i = 0; i < Math.min(rows.length, 10) && hi < 0; i++) {
    var h = (rows[i] || []).map(function (x) { return String(x || '').trim(); });
    var cp = h.findIndex(function (x) { return /^Proj\.?def/i.test(x); }), cw = h.findIndex(function (x) { return /WBS/i.test(x); }),
        cl = h.indexOf('ระดับ'), cn = h.indexOf('ชื่อ'), cs = h.indexOf('สถานะ'), cu = h.indexOf('ผู้สมัคร');
    if (cp >= 0 && cw >= 0 && cl >= 0 && cs >= 0) { hi = i; C = { p: cp, w: cw, l: cl, n: cn, s: cs, u: cu }; }
  }
  if (hi < 0) return null;            // ไฟล์รูปแบบอื่น (เช่นรายงาน CLSD) — ไม่ทำรายงาน
  if (checkOnly) return true;
  var code = CCL_SAP_BRANCH_CODE, all = [];
  for (var r = hi + 1; r < rows.length; r++) {
    var x = rows[r] || [], w = String(x[C.w] || '').trim();
    if (!w || w.indexOf(code) < 0) continue;
    all.push({ p: String(x[C.p] || '').trim(), w: w, l: String(x[C.l] || '').trim(), n: C.n >= 0 ? String(x[C.n] || '').trim() : '', s: String(x[C.s] || ''), u: C.u >= 0 ? String(x[C.u] || '').trim() : '' });
  }
  var parent = {};
  all.forEach(function (e) { var parts = e.w.split('.'); for (var k = 1; k < parts.length; k++) parent[parts.slice(0, k).join('.')] = 1; });
  var heads = {}, jobs = [];
  all.forEach(function (e) {
    var sys = (e.s.trim().split(/\s+/)[0] || '').toUpperCase(), usr = (e.s.split('//')[1] || '').trim().toUpperCase();
    var head = e.w.indexOf('XX') >= 0 || /-[A-Z]{3}$/.test(e.w) || e.l === '001' || usr === 'Z0';
    if (head) { if (e.n && !/^กฟส\.?/.test(e.n)) (heads[e.p] = heads[e.p] || []).push(e.n); return; }
    if (/^C-/.test(e.p) ? e.l !== '002' : parent[e.w]) return;
    jobs.push([e.p, e.w, e.n, sys, usr, e.u]);
  });
  var hn = {}; Object.keys(heads).forEach(function (p) { hn[p] = heads[p].slice(0, 3); });
  return { at: new Date().toISOString(), file: fileName, code: code, rows: rows.length - hi - 1, heads: hn, jobs: jobs };
}
function cclSapSaveReport_(rep) {
  if (!rep) return;
  var c = cclSapCfg_(), fs = cclSapFolders_(c, true); cclSapSaveCfg_(c);
  var name = 'ccl-sap-report.json', it = fs.f.getFilesByName(name), body = JSON.stringify(rep);
  if (it.hasNext()) it.next().setContent(body); else fs.f.createFile(name, body, 'application/json');
}
function cclSapReportGet_() {
  var c = cclSapCfg_(), fs = cclSapFolders_(c, false); if (!fs) return { none: true };
  var it = fs.f.getFilesByName('ccl-sap-report.json'); if (!it.hasNext()) return { none: true };
  return JSON.parse(it.next().getBlob().getDataAsString('UTF-8'));
}
// สร้างรายงานใหม่จากไฟล์ SAP ล่าสุด (ในโฟลเดอร์หรือ "อ่านแล้ว") โดยไม่แก้ข้อมูลงาน
function cclSapReportRebuild_() {
  var c = cclSapCfg_(), fs = cclSapFolders_(c, false); if (!fs) throw new Error('ยังไม่ได้ตั้งค่าโฟลเดอร์ SAP');
  var files = [];
  [fs.f, fs.d].forEach(function (fd) { var it = fd.getFiles(); while (it.hasNext()) { var f = it.next(); if (/\.xlsx$/i.test(f.getName())) files.push(f); } });
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  for (var i = 0; i < files.length; i++) {
    var rows = cclXlsxRows_(files[i].getBlob()), rep = cclSapReportBuild_(rows, files[i].getName());
    if (rep) { cclSapSaveReport_(rep); return { success: true, file: rep.file, jobs: rep.jobs.length }; }
  }
  throw new Error('ไม่พบไฟล์ SAP รูปแบบ WBS (มีคอลัมน์ Proj.def / องค์ประกอบ WBS / ระดับ / สถานะ)');
}


// ═════ LINE: เลือกกลุ่ม/รายชื่อปลายทาง ═════
// ปลายทาง "ค่าเริ่มต้น" = แถว LineTargets เดิม (การแจ้งเตือนอัตโนมัติยังส่งไปที่นี่เหมือนเดิม)
// ปลายทาง "เพิ่มเติม" = แถว LineTargetsExtra (ส่งเฉพาะเมื่อมีคนเลือก) · ชื่อเก็บในแถว LineTargetNames (JSON)
function cclOpt_(key, val) {
  var sh = getSheetSafe(cclSS_(), SHEET_OPTIONS_NAME), d = sh.getDataRange().getValues();
  for (var i = 0; i < d.length; i++) if (d[i][0] === key) { if (val === undefined) return String(d[i][1] || ''); sh.getRange(i + 1, 2).setValue(val); return val; }
  if (val === undefined) return '';
  sh.appendRow([key, val]); return val;
}
function cclLineKey_(id) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'ccl-line:' + id).slice(0, 6).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function cclLineIds_() {
  var sp = function (s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); };
  var def = getLineTargets().map(function (x) { return String(x).trim(); }).filter(Boolean), ex = sp(cclOpt_('LineTargetsExtra')).filter(function (x) { return def.indexOf(x) < 0; });
  var names = {}; try { names = JSON.parse(cclOpt_('LineTargetNames') || '{}') || {}; } catch (e) {}
  return { def: def, ex: ex, names: names };
}
// ดึงชื่อกลุ่ม/ชื่อคน + จำนวนสมาชิกจาก LINE (เก็บไว้ 7 วัน)
function cclLineFetchNames_(ids, names, force) {
  var token = getLineMessagingToken(); if (!token) return false;
  var now = Date.now(), need = ids.filter(function (id) { var n = names[id]; return force || !n || !n.f || now - (n.at || 0) > 7 * 864e5; }).slice(0, 30);
  if (!need.length) return false;
  var H = { Authorization: 'Bearer ' + token }, reqs = [], map = [];
  need.forEach(function (id) {
    var t = id.charAt(0), base = 'https://api.line.me/v2/bot/';
    if (t === 'C') { reqs.push({ url: base + 'group/' + id + '/summary', headers: H, muteHttpExceptions: true }); map.push([id, 'n']); reqs.push({ url: base + 'group/' + id + '/members/count', headers: H, muteHttpExceptions: true }); map.push([id, 'c']); }
    else if (t === 'R') { reqs.push({ url: base + 'room/' + id + '/members/count', headers: H, muteHttpExceptions: true }); map.push([id, 'c']); }
    else { reqs.push({ url: base + 'profile/' + id, headers: H, muteHttpExceptions: true }); map.push([id, 'n']); }
  });
  var res = UrlFetchApp.fetchAll(reqs);
  res.forEach(function (r, i) {
    var id = map[i][0], o = names[id] = names[id] || {}; o.at = now;
    if (r.getResponseCode() !== 200) { if (map[i][1] === 'n') o.f = o.f || ''; return; }
    var j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) {}
    if (map[i][1] === 'n') o.f = j.groupName || j.displayName || o.f || ''; else o.c = j.count || 0;
  });
  return true;
}
function cclLineList_(admin, refresh) {
  var L = cclLineIds_(), all = L.def.concat(L.ex);
  try { if (cclLineFetchNames_(all, L.names, refresh)) cclOpt_('LineTargetNames', JSON.stringify(L.names)); } catch (e) {}
  var out = all.map(function (id) {
    var n = L.names[id] || {}, t = id.charAt(0);
    var o = { k: cclLineKey_(id), name: n.n || n.f || (t === 'C' ? 'กลุ่ม' : t === 'R' ? 'ห้องแชท' : 'ผู้ใช้') + ' ' + id.slice(1, 5) + '…', lineName: n.f || '', type: t === 'C' ? 'group' : t === 'R' ? 'room' : 'user', count: n.c || 0, def: L.def.indexOf(id) >= 0 };
    if (admin) o.mask = id.slice(0, 5) + '…' + id.slice(-3);
    return o;
  });
  if (admin) { // ปลายทางที่บอทเพิ่งพบ (ถูกเชิญเข้ากลุ่ม / มีข้อความถึงบอท) แต่ยังไม่ได้เพิ่ม
    var seen = cclLineSeen_().filter(function (x) { return all.indexOf(x.id) < 0 && !x.left; });
    if (seen.length) {
      var nm = {}; seen.forEach(function (x) { nm[x.id] = { f: x.name || '' }; });
      try { cclLineFetchNames_(seen.map(function (x) { return x.id; }), nm, false); } catch (e) {}
      seen.forEach(function (x) { var n = nm[x.id] || {}; out.push({ seen: 1, id: x.id, name: n.f || '', lineName: n.f || '', type: x.id.charAt(0) === 'C' ? 'group' : x.id.charAt(0) === 'R' ? 'room' : 'user', count: n.c || 0, def: false, at: x.at, ev: x.ev, mask: x.id.slice(0, 5) + '…' + x.id.slice(-3) }); });
    }
  }
  return out;
}
// ── LINE webhook: จับ Group ID / User ID อัตโนมัติ (เก็บที่ Options ของสาขาหลัก แถว LineSeen) ──
function cclLineSeen_(list) {
  var prev = typeof __CCL_CTX !== 'undefined' ? __CCL_CTX : null;
  try {
    cclUseBranch_(CCL_HOME_BRANCH, true);
    if (list === undefined) { try { return JSON.parse(cclOpt_('LineSeen') || '[]') || []; } catch (e) { return []; } }
    cclOpt_('LineSeen', JSON.stringify(list.slice(0, 40)));
  } finally { if (prev) __CCL_CTX = prev; }
}
function cclLineWebhook_(events) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(8000)) return;
  try {
    var list = cclLineSeen_(), ch = false, now = new Date().toISOString();
    events.forEach(function (ev) {
      var s = ev && ev.source || {}, id = s.groupId || s.roomId || s.userId; if (!id || !/^[CUR][0-9a-f]{32}$/.test(id)) return;
      var type = ev.type, x = null; for (var i = 0; i < list.length; i++) if (list[i].id === id) { x = list[i]; break; }
      if (type === 'leave' || type === 'unfollow') { if (x) { x.left = 1; x.at = now; ch = true; } return; }
      if (!x) { x = { id: id }; list.unshift(x); }
      else if (!x.left && x.ev === type && Date.now() - new Date(x.at) < 6 * 3600e3) return; // ไม่เขียนซ้ำบ่อย
      x.left = 0; x.at = now; x.ev = type; ch = true;
    });
    if (ch) cclLineSeen_(list);
  } finally { lock.releaseLock(); }
}
var CCL_API_EXEC = 'https://script.google.com/macros/s/AKfycby4f-2rofhzok_cg9-YLftco1XuC-MCrKn72TTakoPhQfz-qGqjX9WTzZkY5Ye_BxejNQ/exec';
function cclLineHook_(act) {
  var token = getLineMessagingToken(); if (!token) throw new Error('ยังไม่ได้ตั้งค่า LINE Token');
  var H = { Authorization: 'Bearer ' + token }, base = 'https://api.line.me/v2/bot/channel/webhook/';
  if (act === 'set') {
    var r = UrlFetchApp.fetch(base + 'endpoint', { method: 'put', contentType: 'application/json', headers: H, payload: JSON.stringify({ endpoint: CCL_API_EXEC }), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('ตั้ง Webhook ไม่สำเร็จ (' + r.getResponseCode() + ') ' + r.getContentText().slice(0, 150));
  }
  var g = UrlFetchApp.fetch(base + 'endpoint', { headers: H, muteHttpExceptions: true }), j = {};
  try { j = JSON.parse(g.getContentText()); } catch (e) {}
  var info = {}; try { info = JSON.parse(UrlFetchApp.fetch('https://api.line.me/v2/bot/info', { headers: H, muteHttpExceptions: true }).getContentText()); } catch (e) {}
  return { endpoint: j.endpoint || '', mine: j.endpoint === CCL_API_EXEC, active: !!j.active, other: !!j.endpoint && j.endpoint !== CCL_API_EXEC, otherHost: j.endpoint && j.endpoint !== CCL_API_EXEC ? String(j.endpoint).replace(/^https?:\/\//, '').split('/')[0] : '', bot: info.displayName || '', basicId: info.basicId || '', seen: cclLineSeen_().filter(function (x) { return !x.left; }).length };
}
function cclLineSend_(sess, keys, text) {
  text = String(text || '').trim(); if (!text) throw new Error('ไม่มีข้อความ');
  if (text.length > 4900) text = text.slice(0, 4890) + '\n…';
  var L = cclLineIds_(), all = L.def.concat(L.ex), byK = {};
  all.forEach(function (id) { byK[cclLineKey_(id)] = id; });
  var ids = (keys || []).map(function (k) { return byK[k]; }).filter(Boolean);
  if (!ids.length) throw new Error('ยังไม่ได้เลือกปลายทาง');
  var token = getLineMessagingToken(); if (!token) throw new Error('ยังไม่ได้ตั้งค่า LINE Token');
  var reqs = ids.map(function (id) { return { url: 'https://api.line.me/v2/bot/message/push', method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token }, payload: JSON.stringify({ to: id, messages: [{ type: 'text', text: text }] }), muteHttpExceptions: true }; });
  var ok = 0, fail = [];
  UrlFetchApp.fetchAll(reqs).forEach(function (r, i) { if (r.getResponseCode() === 200) ok++; else { var n = L.names[ids[i]] || {}; fail.push((n.n || n.f || ids[i].slice(0, 5)) + ' (' + r.getResponseCode() + ')'); } });
  return { success: ok > 0, sent: ok, fail: fail };
}
// items: [{k (เดิม) | id (ใหม่), name, def, del}]
function cclLineSave_(items) {
  var L = cclLineIds_(), all = L.def.concat(L.ex), byK = {}, def = [], ex = [], seen = {};
  all.forEach(function (id) { byK[cclLineKey_(id)] = id; });
  (items || []).forEach(function (it) {
    var id = it.k ? byK[it.k] : String(it.id || '').trim();
    if (!id || seen[id]) return;
    if (!it.k && !/^[CUR][0-9a-f]{32}$/.test(id)) throw new Error('ID ไม่ถูกต้อง: ต้องขึ้นต้นด้วย C (กลุ่ม) หรือ U (ผู้ใช้) ตามด้วยตัวอักษร 32 ตัว');
    seen[id] = 1;
    if (it.del) { delete L.names[id]; return; }
    (it.def ? def : ex).push(id);
    var n = L.names[id] = L.names[id] || {}; n.n = String(it.name || '').trim().slice(0, 60);
  });
  updateLineTargets(def.join(','));
  cclOpt_('LineTargetsExtra', ex.join(','));
  try { cclLineFetchNames_(def.concat(ex), L.names, false); } catch (e) {}
  cclOpt_('LineTargetNames', JSON.stringify(L.names));
  return { success: true, def: def.length, ex: ex.length };
}
