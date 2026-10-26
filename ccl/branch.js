/* CCL — รองรับหลายหน่วยงาน (ฝั่งหน้าเว็บ)
   - หน้าเข้าสู่ระบบ/สมัครสมาชิก: เลือกหน่วยงาน (จำไว้ในเครื่อง)
   - หัวจอแสดงชื่อหน่วยงาน
   - เมนู "หน่วยงาน" สำหรับผู้ดูแลสูงสุด: ดู/เพิ่ม/เปิด-ปิด/แก้ชื่อ/เข้าดูหน่วยงาน
   - หน้า Admin: การ์ด "ผู้ใช้ของหน่วยงาน" ตั้ง Admin / ปิดบัญชี / ตั้งรหัสผ่านใหม่
   ไม่แก้ฟังก์ชันเดิม — แค่ต่อเติมรอบๆ */
(function () {
  'use strict';
  var BR_KEY = 'ccl_branch_v1';
  var branches = [];
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) { return window.cclLs ? cclLs(k, v) : null; }
  function user() { try { return JSON.parse(ls('ccl_user_v1') || 'null') || {}; } catch (e) { return {}; } }
  function api(fn, args) { return window.cclApiCall(fn, args || []); }
  function toast(icon, title) { try { Swal.fire({ icon: icon, title: title, timer: 1600, showConfirmButton: false }); } catch (e) {} }
  function fail(err) { try { Swal.fire({ icon: 'error', title: 'ทำรายการไม่สำเร็จ', text: (err && err.message) || String(err) }); } catch (e) { alert(err); } }

  // ───── สไตล์ ─────
  var css = '' +
    '.cb-field{margin-bottom:16px}.cb-label{display:block;font-size:12px;font-weight:600;color:#bfdbfe;margin-bottom:6px}' +
    '.cb-select{width:100%;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:12px;padding:10px 14px;font-size:14px;appearance:none;-webkit-appearance:none;background-image:linear-gradient(45deg,transparent 50%,#bfdbfe 50%),linear-gradient(135deg,#bfdbfe 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px;background-repeat:no-repeat}' +
    '.cb-select option{color:#0f172a}' +
    '.cb-chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,193,7,.16);color:#FFC107;border:1px solid rgba(255,193,7,.35);border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700;white-space:nowrap;max-width:46vw;overflow:hidden;text-overflow:ellipsis;font-family:Sarabun,sans-serif}' +
    '#cbViewBanner{background:#FFF7ED;border-bottom:1px solid #FED7AA;color:#9A3412;font-size:13px;padding:8px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-family:Sarabun,sans-serif}' +
    '#cbViewBanner button{background:#9A3412;color:#fff;border:0;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}' +
    '.cb-wrap{max-width:1100px;margin:0 auto}.cb-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px}' +
    '.cb-head h2{font-size:22px;font-weight:800;color:#0D1B4B;display:flex;align-items:center;gap:8px}.cb-head p{font-size:13px;color:#64748B}' +
    '.cb-btn{border:0;border-radius:10px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:Sarabun,sans-serif}' +
    '.cb-primary{background:#0D1B4B;color:#fff}.cb-primary:hover{background:#F57C00}.cb-ghost{background:#fff;color:#0D1B4B;border:1px solid #CBD5E1}.cb-warn{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA}.cb-ok{background:#ECFDF5;color:#047857;border:1px solid #A7F3D0}' +
    '.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}' +
    '.cb-card{background:#fff;border:1px solid #E2E8F0;border-radius:14px;padding:14px 16px;box-shadow:0 2px 12px rgba(13,27,75,.05)}' +
    '.cb-card.off{opacity:.65;background:#F8FAFC}.cb-card h3{font-size:16px;font-weight:800;color:#0D1B4B;display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.cb-pill{font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px}.cb-on{background:#DCFCE7;color:#166534}.cb-off{background:#E2E8F0;color:#475569}.cb-home{background:#FEF3C7;color:#92400E}.cb-cur{background:#DBEAFE;color:#1E40AF}' +
    '.cb-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.cb-stat{background:#F8FAFC;border-radius:10px;padding:8px;text-align:center}.cb-stat b{display:block;font-size:20px;color:#0D1B4B}.cb-stat span{font-size:11px;color:#64748B}' +
    '.cb-meta{font-size:12px;color:#64748B;line-height:1.6}.cb-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.cb-actions .cb-btn{padding:7px 11px;font-size:12px}' +
    '.cb-users{width:100%;border-collapse:collapse;font-size:13px}.cb-users th{text-align:left;font-size:12px;color:#64748B;padding:8px;border-bottom:1px solid #E2E8F0}.cb-users td{padding:8px;border-bottom:1px solid #F1F5F9;vertical-align:middle}' +
    '.cb-users select{border:1px solid #CBD5E1;border-radius:8px;padding:5px 8px;font-size:13px;background:#fff}' +
    '.cb-swal label{display:block;text-align:left;font-size:13px;font-weight:700;color:#334155;margin:10px 0 4px}.cb-swal input{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:10px;padding:9px 12px;font-size:15px}.cb-swal small{display:block;text-align:left;color:#64748B;font-size:12px;margin-top:3px}.cb-swal .cb-sec{margin-top:14px;padding-top:10px;border-top:1px dashed #E2E8F0;text-align:left;font-weight:800;color:#0D1B4B;font-size:13px}' +
    'body.cb-ext a[href="/index.html"]{display:none!important}' +
    '@media (max-width:767px){.cb-grid{grid-template-columns:1fr}.cb-head h2{font-size:19px}.cb-users thead{display:none}.cb-users tr{display:block;border:1px solid #E2E8F0;border-radius:12px;margin-bottom:8px;padding:8px 10px}.cb-users td{display:flex;justify-content:space-between;align-items:center;gap:8px;border:0;padding:4px 0}.cb-users td::before{content:attr(data-l);font-size:12px;font-weight:700;color:#64748B}#cclNavBrand .cb-chip{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ───── ส่งรหัสหน่วยงานไปกับการล็อกอิน/สมัคร ─────
  function selectedBranch() {
    var s = $('cbLoginBranch');
    return (s && s.value) || ls(BR_KEY) || 'aoluek';
  }
  if (typeof window.cclApiCall === 'function' && !window.cclApiCall.__cb) {
    var origCall = window.cclApiCall;
    var wrapped = function (fn, args) {
      args = (args || []).slice();
      if (fn === 'loginUser') { args[2] = selectedBranch(); ls(BR_KEY, args[2]); }
      if (fn === 'registerUser') { var r = $('cbRegBranch'); args[4] = (r && r.value) || selectedBranch(); }
      return origCall(fn, args);
    };
    wrapped.__cb = true;
    window.cclApiCall = wrapped;
  }

  // ───── ช่องเลือกหน่วยงานบนหน้าเข้าสู่ระบบ ─────
  function branchOptions(sel) {
    if (!branches.length) return '<option value="aoluek">กฟส.อ่าวลึก</option>';
    return branches.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === sel ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('');
  }
  function addGateFields() {
    var saved = ls(BR_KEY) || 'aoluek';
    var lf = document.querySelector('#loginFormSection form');
    if (lf && !$('cbLoginBranch')) {
      var d = document.createElement('div'); d.className = 'cb-field';
      d.innerHTML = '<label class="cb-label" for="cbLoginBranch"><i class="fa-solid fa-building mr-1"></i> หน่วยงาน</label><select id="cbLoginBranch" class="cb-select">' + branchOptions(saved) + '</select>';
      lf.insertBefore(d, lf.firstChild);
    }
    var rf = document.querySelector('#registerFormSection form');
    if (rf && !$('cbRegBranch')) {
      var d2 = document.createElement('div'); d2.className = 'cb-field';
      d2.innerHTML = '<label class="cb-label" for="cbRegBranch"><i class="fa-solid fa-building mr-1"></i> สมัครเข้าหน่วยงาน</label><select id="cbRegBranch" class="cb-select">' + branchOptions(saved) + '</select>';
      rf.insertBefore(d2, rf.firstChild);
    }
    var dept = $('gateRegDept'); if (dept) dept.placeholder = 'เช่น แผนกก่อสร้าง';
  }
  function loadBranches() {
    api('listBranches').then(function (list) {
      branches = Array.isArray(list) ? list : [];
      var saved = ls(BR_KEY) || 'aoluek';
      if (!branches.some(function (b) { return b.id === saved; }) && branches.length) saved = branches[0].id;
      ['cbLoginBranch', 'cbRegBranch'].forEach(function (id) { var s = $(id); if (s) s.innerHTML = branchOptions(saved); });
    }, function () {});
  }

  // ───── หัวจอ / แบนเนอร์ / เมนู ─────
  function decorate() {
    var u = user();
    if (!u || !u.name) return;
    var bname = u.branchName || 'กฟส.อ่าวลึก';
    // ผู้ใช้หน่วยงานอื่น: ซ่อนปุ่มไปศูนย์รวมงาน (ศูนย์รวมงานเป็นของ กฟส.อ่าวลึก)
    var ext = (u.homeBranchId || u.branchId || 'aoluek') !== 'aoluek' && !u.superAdmin;
    document.body.classList.toggle('cb-ext', ext);
    var sub = document.querySelector('#cclNavBrand .ccl-brand-sub');
    if (sub) sub.textContent = bname + ' · v3.1.1';
    var title = document.querySelector('#cclNavBrand .ccl-brand-title');
    if (title && !$('cbBrandChip')) { var c = document.createElement('span'); c.id = 'cbBrandChip'; c.className = 'cb-chip'; title.parentNode.appendChild(c); }
    var chip = $('cbBrandChip'); if (chip) { chip.textContent = bname; chip.style.display = 'none'; }
    document.title = 'CCL · ' + bname;
    var role = $('navUserRole');
    if (role) role.innerText = (u.superAdmin && u.branchId === u.homeBranchId ? 'ผู้ดูแลสูงสุด' : u.role) + ' · ' + bname;

    // แบนเนอร์เมื่อผู้ดูแลสูงสุดเข้าดูหน่วยงานอื่น
    var ban = $('cbViewBanner');
    var viewingOther = u.superAdmin && u.homeBranchId && u.branchId !== u.homeBranchId;
    if (viewingOther && !ban) {
      ban = document.createElement('div'); ban.id = 'cbViewBanner';
      var nav = $('cclNav'); nav.parentNode.insertBefore(ban, nav.nextSibling);
    }
    if (ban) {
      if (viewingOther) {
        ban.style.display = 'flex';
        ban.innerHTML = '<i class="fa-solid fa-eye"></i><span>กำลังดูข้อมูล <b>' + esc(bname) + '</b> ในฐานะผู้ดูแลสูงสุด</span><button type="button" id="cbBackHome">กลับ ' + esc(u.homeBranchName || 'หน่วยงานของฉัน') + '</button>';
        $('cbBackHome').onclick = function () { switchTo(u.homeBranchId); };
      } else ban.style.display = 'none';
    }

    // เมนู "หน่วยงาน" สำหรับผู้ดูแลสูงสุด
    var tabs = $('cclNavTabs');
    var btn = $('nav-branches');
    if (u.superAdmin && tabs && !btn) {
      btn = document.createElement('button');
      btn.id = 'nav-branches'; btn.className = 'ccl-nav-btn';
      btn.setAttribute('onclick', "showPage('branches')");
      btn.innerHTML = '<i class="fa-solid fa-sitemap"></i>หน่วยงาน';
      tabs.appendChild(btn);
    }
    if (btn) btn.classList.toggle('hidden', !u.superAdmin);
    ensurePage();
    ensureUsersCard();
    ensureContractorLink();
  }

  // ลิงก์ Contractor Portal สำหรับส่งให้ผู้รับจ้าง (อยู่เหนือรายชื่อบัญชีผู้รับจ้างในหน้า Admin)
  function ensureContractorLink() {
    var list = $('contractorUserList'); if (!list || $('cbCtLink')) return;
    var url = location.origin + location.pathname.replace(/[^\/]*$/, '') + 'contractor.html';
    var d = document.createElement('div'); d.id = 'cbCtLink';
    d.setAttribute('style', 'background:#E0F2F1;border:1px solid #B2DFDB;border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:13px;color:#004D40');
    d.innerHTML = '<b><i class="fa-solid fa-link"></i> ลิงก์สำหรับผู้รับจ้าง</b> — ส่งลิงก์นี้พร้อมชื่อผู้ใช้/รหัสผ่าน ผู้รับจ้างเลือกหน่วยงาน "' + esc(user().branchName || 'กฟส.อ่าวลึก') + '" ตอนเข้าสู่ระบบ' +
      '<div style="display:flex;gap:6px;margin-top:6px;align-items:center"><code style="flex:1;background:#fff;border-radius:8px;padding:6px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(url) + '</code>' +
      '<button type="button" class="cb-btn cb-ghost" style="padding:6px 10px;font-size:12px" id="cbCtCopy"><i class="fa-solid fa-copy"></i> คัดลอก</button></div>';
    list.parentNode.insertBefore(d, list);
    $('cbCtCopy').onclick = function () {
      var done = function () { toast('success', 'คัดลอกลิงก์แล้ว'); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('คัดลอกลิงก์นี้', url); });
      else prompt('คัดลอกลิงก์นี้', url);
    };
  }

  function ensurePage() {
    if ($('page-branches')) return;
    var host = document.querySelector('#mainApp > .container') || $('mainApp');
    var p = document.createElement('div');
    p.id = 'page-branches'; p.className = 'page-section hidden fade-in';
    p.innerHTML = '<div class="cb-wrap"><div class="cb-head"><div><h2><i class="fa-solid fa-sitemap" style="color:#F57C00"></i> จัดการหน่วยงาน</h2>' +
      '<p>โปรแกรมชุดเดียวกัน ข้อมูลแยกชีตตามหน่วยงาน — เพิ่มหน่วยงานใหม่แล้วส่งชื่อผู้ใช้ให้ Admin ของหน่วยงานนั้นได้เลย</p></div>' +
      '<div style="display:flex;gap:8px"><button type="button" class="cb-btn cb-ghost" id="cbReload"><i class="fa-solid fa-rotate-right"></i> รีเฟรช</button>' +
      '<button type="button" class="cb-btn cb-primary" id="cbAdd"><i class="fa-solid fa-plus"></i> เพิ่มหน่วยงาน</button></div></div>' +
      '<div id="cbList" class="cb-grid"><div class="cb-card">กำลังโหลด…</div></div></div>';
    host.appendChild(p);
    $('cbReload').onclick = loadAdminBranches;
    $('cbAdd').onclick = addBranchDialog;
  }

  function loadAdminBranches() {
    var box = $('cbList'); if (!box) return;
    box.innerHTML = '<div class="cb-card"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อมูลหน่วยงาน…</div>';
    api('cclAdminBranches').then(function (list) {
      var u = user();
      box.innerHTML = (list || []).map(function (b) {
        var cur = b.id === u.branchId;
        return '<div class="cb-card' + (b.active ? '' : ' off') + '"><h3>' + esc(b.name) +
          (b.home ? ' <span class="cb-pill cb-home">หน่วยงานหลัก</span>' : '') +
          ' <span class="cb-pill ' + (b.active ? 'cb-on">เปิดใช้งาน' : 'cb-off">ปิดอยู่') + '</span>' +
          (cur ? ' <span class="cb-pill cb-cur">กำลังดู</span>' : '') + '</h3>' +
          '<div class="cb-meta">รหัส: ' + esc(b.id) + (b.created ? ' · สร้าง ' + esc(String(b.created).slice(0, 10)) : '') + '</div>' +
          (b.error ? '<div class="cb-meta" style="color:#B91C1C">' + esc(b.error) + '</div>' : '') +
          '<div class="cb-stats"><div class="cb-stat"><b>' + (b.jobs || 0) + '</b><span>งาน</span></div><div class="cb-stat"><b>' + (b.users || 0) + '</b><span>ผู้ใช้</span></div><div class="cb-stat"><b style="color:' + (b.pending ? '#DC2626' : '#0D1B4B') + '">' + (b.pending || 0) + '</b><span>รออนุมัติ</span></div></div>' +
          '<div class="cb-meta">Admin: ' + (b.admins && b.admins.length ? esc(b.admins.join(', ')) : '-') + '</div>' +
          '<div class="cb-actions">' +
          (cur ? '' : '<button type="button" class="cb-btn cb-primary" data-act="view" data-id="' + esc(b.id) + '"><i class="fa-solid fa-right-to-bracket"></i> เข้าดู</button>') +
          '<button type="button" class="cb-btn cb-ghost" data-act="rename" data-id="' + esc(b.id) + '" data-name="' + esc(b.name) + '"><i class="fa-solid fa-pen"></i> แก้ชื่อ</button>' +
          (b.sheetUrl ? '<a class="cb-btn cb-ghost" href="' + esc(b.sheetUrl) + '" target="_blank" rel="noopener"><i class="fa-solid fa-table"></i> ชีต</a>' : '') +
          (b.home ? '' : (b.active ? '<button type="button" class="cb-btn cb-warn" data-act="off" data-id="' + esc(b.id) + '" data-name="' + esc(b.name) + '"><i class="fa-solid fa-ban"></i> ปิดใช้งาน</button>'
                                   : '<button type="button" class="cb-btn cb-ok" data-act="on" data-id="' + esc(b.id) + '"><i class="fa-solid fa-check"></i> เปิดใช้งาน</button>')) +
          '</div></div>';
      }).join('') || '<div class="cb-card">ยังไม่มีหน่วยงาน</div>';
      Array.prototype.forEach.call(box.querySelectorAll('[data-act]'), function (el) {
        el.onclick = function () {
          var id = el.dataset.id, act = el.dataset.act;
          if (act === 'view') switchTo(id);
          if (act === 'rename') renameDialog(id, el.dataset.name);
          if (act === 'on') setActive(id, true);
          if (act === 'off') {
            Swal.fire({ icon: 'warning', title: 'ปิดใช้งาน ' + el.dataset.name + '?', text: 'ผู้ใช้ของหน่วยงานนี้จะเข้าระบบไม่ได้จนกว่าจะเปิดอีกครั้ง ข้อมูลยังอยู่ครบ', showCancelButton: true, confirmButtonText: 'ปิดใช้งาน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' })
              .then(function (r) { if (r.isConfirmed) setActive(id, false); });
          }
        };
      });
    }, function (err) { box.innerHTML = '<div class="cb-card" style="color:#B91C1C">' + esc(err.message) + '</div>'; });
  }

  function setActive(id, on) {
    api('cclUpdateBranch', [id, { active: on }]).then(function () { toast('success', on ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว'); loadAdminBranches(); }, fail);
  }
  function renameDialog(id, name) {
    Swal.fire({ title: 'แก้ชื่อหน่วยงาน', input: 'text', inputValue: name, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
      inputValidator: function (v) { return !String(v || '').trim() ? 'กรุณาใส่ชื่อหน่วยงาน' : null; } })
      .then(function (r) { if (!r.isConfirmed) return; api('cclUpdateBranch', [id, { name: r.value }]).then(function () { toast('success', 'บันทึกแล้ว'); loadAdminBranches(); }, fail); });
  }

  function addBranchDialog() {
    Swal.fire({
      title: 'เพิ่มหน่วยงานใหม่',
      html: '<div class="cb-swal">' +
        '<label>ชื่อหน่วยงาน</label><input id="cbNName" placeholder="กฟส.คลองท่อม">' +
        '<label>รหัสหน่วยงาน (ภาษาอังกฤษ)</label><input id="cbNId" placeholder="klongthom" autocapitalize="off"><small>a-z, 0-9, - หรือ _ ใช้ในระบบเท่านั้น เปลี่ยนภายหลังไม่ได้</small>' +
        '<div class="cb-sec">Admin คนแรกของหน่วยงาน</div>' +
        '<label>ชื่อผู้ใช้</label><input id="cbNUser" placeholder="admin_kt" autocapitalize="off">' +
        '<label>ชื่อ-นามสกุล</label><input id="cbNAName" placeholder="ชื่อ Admin ของหน่วยงาน">' +
        '<label>รหัสผ่านเริ่มต้น</label><input id="cbNPass" type="text" placeholder="อย่างน้อย 4 ตัว" autocomplete="off"><small>ส่งให้ Admin ของหน่วยงาน แล้วให้เปลี่ยนเองภายหลังได้ที่หน้า Admin</small>' +
        '</div>',
      showCancelButton: true, confirmButtonText: 'สร้างหน่วยงาน', cancelButtonText: 'ยกเลิก', focusConfirm: false,
      preConfirm: function () {
        var v = { name: $('cbNName').value.trim(), id: $('cbNId').value.trim().toLowerCase(), adminUser: $('cbNUser').value.trim(), adminName: $('cbNAName').value.trim(), adminPass: $('cbNPass').value };
        if (!v.name) return Swal.showValidationMessage('กรุณาใส่ชื่อหน่วยงาน');
        if (!/^[a-z0-9_-]{2,20}$/.test(v.id)) return Swal.showValidationMessage('รหัสหน่วยงานใช้ a-z, 0-9, - หรือ _ ยาว 2–20 ตัว');
        if (!v.adminUser || !v.adminName) return Swal.showValidationMessage('กรุณาใส่ชื่อผู้ใช้และชื่อ-นามสกุลของ Admin');
        if (v.adminPass.length < 4) return Swal.showValidationMessage('รหัสผ่านอย่างน้อย 4 ตัว');
        return v;
      }
    }).then(function (r) {
      if (!r.isConfirmed) return;
      Swal.fire({ title: 'กำลังสร้างหน่วยงาน…', text: 'สร้างชีตและโฟลเดอร์ไฟล์แนบ ใช้เวลาประมาณ 10–30 วินาที', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
      api('cclCreateBranch', [r.value]).then(function (res) {
        Swal.fire({ icon: 'success', title: 'สร้าง ' + esc(r.value.name) + ' แล้ว',
          html: '<div style="text-align:left;font-size:14px;line-height:1.8">ส่งข้อมูลนี้ให้ Admin ของหน่วยงาน:<br>' +
            '• ลิงก์: <b>' + esc(location.origin + location.pathname) + '</b><br>• หน่วยงาน: <b>' + esc(r.value.name) + '</b><br>• ชื่อผู้ใช้: <b>' + esc(r.value.adminUser) + '</b><br>• รหัสผ่าน: ตามที่ตั้งไว้' +
            (res && res.sheetUrl ? '<br><a href="' + esc(res.sheetUrl) + '" target="_blank" rel="noopener">เปิดชีตของหน่วยงาน</a>' : '') + '</div>' });
        loadAdminBranches(); loadBranches();
      }, fail);
    });
  }

  function switchTo(id) {
    Swal.fire({ title: 'กำลังสลับหน่วยงาน…', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
    api('cclSwitchBranch', [id]).then(function (res) {
      if (!res || !res.token) throw new Error('สลับหน่วยงานไม่สำเร็จ');
      ls('ccl_token_v1', res.token); ls('ccl_user_v1', JSON.stringify(res.user));
      location.reload();
    }).catch(fail);
  }

  // ───── การ์ดผู้ใช้ของหน่วยงาน (หน้า Admin) ─────
  function ensureUsersCard() {
    var page = $('page-admin'); if (!page || $('cbUsersCard')) return;
    var card = page.querySelector('.card') || page;
    var box = document.createElement('div');
    box.id = 'cbUsersCard';
    box.setAttribute('style', 'background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px;margin:0 0 16px');
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">' +
      '<h3 style="font-weight:800;color:#0D1B4B;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-users-gear" style="color:#F57C00"></i> ผู้ใช้ของหน่วยงาน <span id="cbUsersBranch" class="cb-pill cb-cur"></span></h3>' +
      '<button type="button" class="cb-btn cb-ghost" id="cbUsersReload" style="padding:6px 10px;font-size:12px"><i class="fa-solid fa-rotate-right"></i> รีเฟรช</button></div>' +
      '<p style="font-size:12px;color:#64748B;margin-bottom:8px">ตั้ง/ถอน Admin ปิดบัญชี หรือตั้งรหัสผ่านใหม่ให้สมาชิก — มีผลทันที (ต้องมี Admin อย่างน้อย 1 คน)</p>' +
      '<div id="cbUsersBox" style="overflow-x:auto">กดรีเฟรชเพื่อโหลดรายชื่อ</div>';
    var h2 = card.querySelector('h2');
    if (h2 && h2.nextSibling) card.insertBefore(box, h2.nextSibling); else card.appendChild(box);
    $('cbUsersReload').onclick = loadUsers;
  }

  function loadUsers() {
    var box = $('cbUsersBox'); if (!box) return;
    var u = user();
    var lbl = $('cbUsersBranch'); if (lbl) lbl.textContent = u.branchName || 'กฟส.อ่าวลึก';
    box.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลด…';
    api('cclListUsers').then(function (list) {
      list = (list || []).filter(function (x) { return x.status !== 'Pending'; });
      if (!list.length) { box.innerHTML = '<div style="color:#64748B;font-size:13px">ยังไม่มีผู้ใช้</div>'; return; }
      box.innerHTML = '<table class="cb-users"><thead><tr><th>ชื่อ</th><th>ชื่อผู้ใช้</th><th>แผนก</th><th>สิทธิ์</th><th>สถานะ</th><th></th></tr></thead><tbody>' +
        list.map(function (x) {
          var on = x.status !== 'Rejected';
          return '<tr data-row="' + x.row + '" data-user="' + esc(x.username) + '">' +
            '<td data-l="ชื่อ"><b>' + esc(x.name) + '</b>' + (x.username === u.username ? ' <span class="cb-pill cb-cur">คุณ</span>' : '') + '</td>' +
            '<td data-l="ชื่อผู้ใช้">' + esc(x.username) + '</td><td data-l="แผนก">' + esc(x.department) + '</td>' +
            '<td data-l="สิทธิ์"><select data-act="role"><option value="User"' + (x.role !== 'Admin' ? ' selected' : '') + '>ผู้ใช้ทั่วไป</option><option value="Admin"' + (x.role === 'Admin' ? ' selected' : '') + '>Admin</option></select></td>' +
            '<td data-l="สถานะ"><span class="cb-pill ' + (on ? 'cb-on">ใช้งาน' : 'cb-off">ปิดบัญชี') + '</span></td>' +
            '<td data-l="จัดการ" style="white-space:nowrap"><button type="button" class="cb-btn cb-ghost" data-act="pw" style="padding:5px 9px;font-size:12px"><i class="fa-solid fa-key"></i> รหัสใหม่</button> ' +
            (on ? '<button type="button" class="cb-btn cb-warn" data-act="off" style="padding:5px 9px;font-size:12px"><i class="fa-solid fa-user-slash"></i> ปิด</button>'
                : '<button type="button" class="cb-btn cb-ok" data-act="on" style="padding:5px 9px;font-size:12px"><i class="fa-solid fa-user-check"></i> เปิด</button>') + '</td></tr>';
        }).join('') + '</tbody></table>';
      Array.prototype.forEach.call(box.querySelectorAll('tr[data-row]'), function (tr) {
        var row = Number(tr.dataset.row), un = tr.dataset.user;
        var sel = tr.querySelector('select[data-act=role]');
        sel.onchange = function () {
          api('cclSetUserRole', [row, un, sel.value]).then(function () { toast('success', 'เปลี่ยนสิทธิ์แล้ว'); }, function (e) { fail(e); loadUsers(); });
        };
        Array.prototype.forEach.call(tr.querySelectorAll('button[data-act]'), function (b) {
          b.onclick = function () {
            var act = b.dataset.act;
            if (act === 'on' || act === 'off') {
              api('cclSetUserStatus', [row, un, act === 'on' ? 'Active' : 'Rejected']).then(function () { toast('success', act === 'on' ? 'เปิดบัญชีแล้ว' : 'ปิดบัญชีแล้ว'); loadUsers(); }, fail);
            } else if (act === 'pw') {
              Swal.fire({ title: 'ตั้งรหัสผ่านใหม่ให้ ' + un, input: 'text', inputPlaceholder: 'อย่างน้อย 4 ตัว', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
                inputAttributes: { autocomplete: 'off', autocapitalize: 'off' },
                inputValidator: function (v) { return String(v || '').length < 4 ? 'รหัสผ่านอย่างน้อย 4 ตัว' : null; } })
                .then(function (r) { if (r.isConfirmed) api('cclResetUserPassword', [row, un, r.value]).then(function () { toast('success', 'ตั้งรหัสผ่านใหม่แล้ว'); }, fail); });
            }
          };
        });
      });
    }, function (err) { box.innerHTML = '<span style="color:#B91C1C">' + esc(err.message) + '</span>'; });
  }

  // ───── เชื่อมกับ showPage / enterApp เดิม ─────
  function hook() {
    var sp = window.showPage;
    if (typeof sp === 'function' && !sp.__cb) {
      var w = function (id) {
        var r = sp.apply(this, arguments);
        Array.prototype.forEach.call(document.querySelectorAll('#cclNavTabs .ccl-nav-btn'), function (b) { b.classList.toggle('active', b.id === 'nav-' + id); });
        if (id === 'branches') { if (user().superAdmin) loadAdminBranches(); else sp('dashboard'); }
        if (id === 'admin') setTimeout(loadUsers, 50);
        return r;
      };
      w.__cb = true; Object.keys(sp).forEach(function (k) { w[k] = sp[k]; });
      window.showPage = w;
    }
    var ea = window.enterApp;
    if (typeof ea === 'function' && !ea.__cb) {
      var w2 = function () { var r = ea.apply(this, arguments); setTimeout(decorate, 0); return r; };
      w2.__cb = true; window.enterApp = w2;
    }
  }

  function init() {
    addGateFields();
    loadBranches();
    hook();
    var app = $('mainApp');
    if (app && !app.classList.contains('hidden')) decorate();
  }
  hook();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
