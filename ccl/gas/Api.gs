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

  try {
    var fn = String(b.fn || '');
    var args = Array.isArray(b.args) ? b.args : [];

    // ไม่ต้องล็อกอิน
    if (fn === 'ping') return cclJson_({ ok: true, data: 'pong' });
    if (fn === 'listBranches') return cclJson_({ ok: true, data: cclListBranchesPublic_() });
    if (fn === 'loginUser') return cclJson_({ ok: true, data: cclApiLogin_(args[0], args[1], args[2]) });
    if (fn === 'registerUser') {
      cclUseBranch_(args[4] || CCL_HOME_BRANCH);
      return cclJson_({ ok: true, data: registerUser(args[0], args[1], args[2], args[3]) });
    }

    var sess = cclSession_(b.token);
    if (!sess) return cclJson_({ ok: false, error: 'AUTH_REQUIRED' });
    sess = cclRefreshSess_(sess, b.token);
    if (!sess) return cclJson_({ ok: false, error: 'AUTH_REQUIRED' });
    cclUseBranch_(sess.branchId || CCL_HOME_BRANCH, !!sess.superAdmin);

    var isAdmin = sess.role === 'Admin' || !!sess.superAdmin;
    var known = CCL_API_FNS.indexOf(fn) >= 0 || CCL_API_ADMIN.indexOf(fn) >= 0 ||
                CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0 || CCL_API_SUPER.indexOf(fn) >= 0 || fn === 'cclWhoAmI';
    if (!known) return cclJson_({ ok: false, error: 'ไม่รองรับคำสั่ง ' + fn });
    if ((CCL_API_ADMIN.indexOf(fn) >= 0 || CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0) && !isAdmin)
      return cclJson_({ ok: false, error: 'เฉพาะ Admin ของหน่วยงานเท่านั้น' });
    if (CCL_API_SUPER.indexOf(fn) >= 0 && !sess.superAdmin)
      return cclJson_({ ok: false, error: 'เฉพาะผู้ดูแลระบบสูงสุดเท่านั้น' });

    var out;
    if (fn === 'cclWhoAmI') out = sess;
    else if (fn === 'cclSwitchBranch') out = cclSwitchBranch_(sess, b.token, args[0]);
    else if (CCL_API_SUPER.indexOf(fn) >= 0 || CCL_API_BRANCH_ADMIN.indexOf(fn) >= 0) out = globalThis[fn + '_'].apply(null, [sess].concat(args));
    else {
      var f = globalThis[fn];
      if (typeof f !== 'function') return cclJson_({ ok: false, error: 'ไม่พบฟังก์ชัน ' + fn + ' ในระบบหลังบ้าน' });
      out = f.apply(null, args);
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
      return { success: true, user: user, token: cclNewToken_(user) };
    }
  }
  fails++;
  cache.put(failKey, String(fails), CCL_LOCK_SEC);
  var left = CCL_MAX_FAIL - fails;
  return { success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' + (left > 0 && left <= 2 ? ' (เหลืออีก ' + left + ' ครั้งก่อนถูกล็อก ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที)' : (left <= 0 ? ' — ถูกล็อก ' + Math.round(CCL_LOCK_SEC / 60) + ' นาที' : '')) };
}

function cclNewToken_(user) {
  var token = Utilities.getUuid();
  CacheService.getScriptCache().put('ccl_tok_' + token, JSON.stringify(user), CCL_TOKEN_TTL);
  return token;
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

// ตรวจสิทธิ์/สถานะล่าสุดจากชีต Users ทุกครั้ง (ถูกปิดบัญชีหรือถูกลดสิทธิ์ จะมีผลทันที)
function cclRefreshSess_(sess, token) {
  var homeId = sess.homeBranchId || sess.branchId || CCL_HOME_BRANCH;
  var hb = cclBranch_(homeId);
  if (!hb) return null;
  var sh = cclOpenBranchSS_(hb).getSheetByName(SHEET_USERS_NAME);
  if (!sh) return null;
  var rows = sh.getDataRange().getValues(), found = null;
  for (var i = 1; i < rows.length; i++) if (String(rows[i][0]) === String(sess.username)) { found = rows[i]; break; }
  if (!found || (found[6] || 'Active') !== 'Active') { try { CacheService.getScriptCache().remove('ccl_tok_' + token); } catch (e) {} return null; }
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
  var token = cclNewToken_(user);
  try { CacheService.getScriptCache().remove('ccl_tok_' + oldToken); } catch (e) {}
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

function cclJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
