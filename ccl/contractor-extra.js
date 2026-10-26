/* Contractor Portal — ส่วนเสริมบน GitHub (ไม่แก้ฟังก์ชันเดิม แค่ต่อเติม)
   - เลือกหน่วยงานตอนเข้าสู่ระบบ + จำการเข้าระบบไว้ในเครื่อง
   - เมนูล่างจอ: ภาพรวม / งาน / งานเก่า / บัญชี
   - ป้ายกำหนดส่ง (เกินกำหนด / ใกล้ครบ) และป้าย "PEA ตอบกลับ" บนการ์ดงาน
   - เลือก % ความคืบหน้าแบบปุ่มกด
   - หน้าบัญชี: เปลี่ยนรหัสผ่าน ออกจากระบบ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function me() { try { return JSON.parse(ctLs(CT_USER_KEY) || 'null'); } catch (e) { return null; } }
  var DONE = ['อนุมัติ/เสร็จสิ้น', 'ปิดงานแล้วเสร็จ', 'ยกเลิก'];

  var css = '' +
    '.ct-field{margin-bottom:16px}.ct-select{width:100%;border:2px solid #E2E8F0;border-radius:12px;padding:12px 14px 12px 44px;font-size:15px;background:#FAFBFC;color:#1A202C;-webkit-appearance:none;appearance:none}' +
    '#ctBottomNav{position:fixed;left:0;right:0;bottom:0;z-index:150;display:flex;background:#fff;border-top:1px solid #E2E8F0;padding-bottom:env(safe-area-inset-bottom,0px);box-shadow:0 -4px 16px rgba(13,43,94,.06)}' +
    '#ctBottomNav button{flex:1;height:60px;border:0;background:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:#94A3B8;font-size:12px;font-weight:700;position:relative}' +
    '#ctBottomNav button i{font-size:19px}#ctBottomNav button.on{color:#0D2B5E}#ctBottomNav button.on i{color:#00897B}' +
    '#ctBottomNav button.on::before{content:"";position:absolute;top:0;left:30%;right:30%;height:3px;border-radius:0 0 3px 3px;background:#00897B}' +
    '#ctBottomNav .ct-dot{position:absolute;top:7px;left:50%;margin-left:7px;min-width:16px;height:16px;padding:0 4px;border-radius:99px;background:#E53935;color:#fff;font-size:10px;line-height:16px;display:none}' +
    '#ctBottomNav .ct-dot.show{display:block}' +
    '#appScreen{padding-bottom:70px}#tabDashboard,#tabOld{display:none!important}' +
    '.ct-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 2px}.ct-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:700;border-radius:99px;padding:3px 10px}' +
    '.ct-late{background:#FEE2E2;color:#991B1B}.ct-soon{background:#FFEDD5;color:#9A3412}.ct-ok{background:#E0F2F1;color:#00695C}.ct-reply{background:#DBEAFE;color:#1E40AF}' +
    '.ct-prog{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:6px}.ct-prog button{border:2px solid #E2E8F0;background:#fff;border-radius:10px;padding:10px 0;font-size:14px;font-weight:700;color:#334155}' +
    '.ct-prog button.on{background:#00897B;border-color:#00897B;color:#fff}' +
    '#ctAcct .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:14px}#ctAcct .row span:first-child{color:#64748B}' +
    '.ct-btn{width:100%;border:0;border-radius:12px;padding:13px;font-size:15px;font-weight:700;margin-top:10px;cursor:pointer}' +
    '.ct-swal input{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:10px;padding:10px 12px;font-size:16px;margin:6px 0}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ───── หน่วยงานบนหน้าเข้าสู่ระบบ ─────
  function addBranchField() {
    var u = $('loginUser'); if (!u || $('ctBranch')) return;
    var wrap = u.closest('.relative');
    var d = document.createElement('div'); d.className = 'relative';
    d.innerHTML = '<i class="fa-solid fa-building absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>' +
      '<select id="ctBranch" class="ct-select" aria-label="หน่วยงาน"><option value="aoluek">กฟส.อ่าวลึก</option></select>' +
      '<i class="fa-solid fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>';
    wrap.parentNode.insertBefore(d, wrap);
    ctApiCall('listBranches').then(function (list) {
      var saved = ctLs(CT_BRANCH_KEY) || 'aoluek';
      if (Array.isArray(list) && list.length) {
        $('ctBranch').innerHTML = list.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === saved ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('');
      }
    }, function () {});
  }

  // ───── เมนูล่างจอ ─────
  var NAV = [['dashboard', 'fa-chart-pie', 'ภาพรวม'], ['all', 'fa-list-check', 'งาน'], ['old', 'fa-box-archive', 'งานเก่า'], ['acct', 'fa-user', 'บัญชี']];
  function buildNav() {
    if ($('ctBottomNav')) return;
    var n = document.createElement('nav'); n.id = 'ctBottomNav'; n.setAttribute('aria-label', 'เมนู');
    n.innerHTML = NAV.map(function (x) { return '<button type="button" data-t="' + x[0] + '"><i class="fa-solid ' + x[1] + '"></i><span>' + x[2] + '</span><span class="ct-dot"></span></button>'; }).join('');
    $('appScreen').appendChild(n);
    Array.prototype.forEach.call(n.querySelectorAll('button'), function (b) {
      b.onclick = function () { if (b.dataset.t === 'acct') openAccount(); else { switchMainTab(b.dataset.t); window.scrollTo(0, 0); } };
    });
  }
  function syncNav(tab) {
    var n = $('ctBottomNav'); if (!n) return;
    var t = (tab === 'active' || tab === 'inspect' || tab === 'done') ? 'all' : tab;
    Array.prototype.forEach.call(n.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.t === t); });
    var late = (window._jobs || []).filter(function (j) { var d = dueInfo(j); return d && d.days < 0; }).length;
    var dot = n.querySelector('[data-t="all"] .ct-dot'); if (dot) { dot.textContent = late || ''; dot.classList.toggle('show', late > 0); }
    var sb = document.querySelector('#appScreen > .bg-white.sticky'); // แถบค้นหา/ตัวกรอง ใช้เฉพาะหน้า "งาน"
    if (sb) sb.style.display = (t === 'all') ? '' : 'none';
  }

  // ───── ป้ายกำหนดส่ง / PEA ตอบกลับ ─────
  function dueInfo(j) {
    if (!j || !j.payDate || DONE.indexOf(j.status) >= 0 || j.status === 'ตรวจรับงาน') return null;
    var d = new Date(j.payDate); if (isNaN(d.getTime())) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
    return { days: Math.round((d - t) / 86400000), date: d };
  }
  function decorateCards() {
    Array.prototype.forEach.call(document.querySelectorAll('#jobList .job-card'), function (card) {
      if (card.querySelector('.ct-chips')) return;
      var m = /openDetail\((\d+)\)/.exec(card.getAttribute('onclick') || ''); if (!m) return;
      var j = (window._jobs || []).filter(function (x) { return String(x.id) === m[1]; })[0]; if (!j) return;
      var chips = [];
      var di = dueInfo(j);
      if (di) {
        var ds = di.date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        if (di.days < 0) chips.push('<span class="ct-chip ct-late"><i class="fa-solid fa-triangle-exclamation"></i>เกินกำหนด ' + (-di.days) + ' วัน</span>');
        else if (di.days <= 7) chips.push('<span class="ct-chip ct-soon"><i class="fa-solid fa-clock"></i>' + (di.days === 0 ? 'ครบกำหนดวันนี้' : 'อีก ' + di.days + ' วัน (' + ds + ')') + '</span>');
        else chips.push('<span class="ct-chip ct-ok"><i class="fa-solid fa-calendar"></i>กำหนด ' + ds + '</span>');
      }
      var ups = Array.isArray(j.updates) ? j.updates : [];
      var last = ups.length ? ups[ups.length - 1] : null;
      if (last && last.updateType === 'pea_reply') chips.push('<span class="ct-chip ct-reply"><i class="fa-solid fa-comment-dots"></i>PEA ตอบกลับ — รอท่านอัปเดต</span>');
      if (!chips.length) return;
      var box = document.createElement('div'); box.className = 'ct-chips'; box.innerHTML = chips.join('');
      var head = card.firstElementChild; head.parentNode.insertBefore(box, head.nextSibling);
    });
  }

  // ───── ปุ่มเลือก % ความคืบหน้า ─────
  function progressChips() {
    var sel = $('su_progress'); if (!sel || sel.dataset.ct) return;
    sel.dataset.ct = '1';
    var vals = Array.prototype.map.call(sel.options, function (o) { return o.value; }).filter(Boolean);
    var pick = vals.length > 6 ? ['20', '40', '60', '80', '100'] : vals;
    var box = document.createElement('div'); box.className = 'ct-prog';
    box.style.gridTemplateColumns = 'repeat(' + Math.min(5, pick.length) + ',1fr)';
    box.innerHTML = pick.map(function (v) { return '<button type="button" data-v="' + v + '">' + v + '%</button>'; }).join('');
    sel.parentNode.insertBefore(box, sel);
    sel.style.display = vals.length > 6 ? '' : 'none';
    if (vals.length > 6) { sel.options[0].text = '— หรือเลือกค่าอื่น —'; sel.style.marginTop = '4px'; }
    function mark() { Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.v === sel.value); }); }
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) { b.onclick = function () { sel.value = b.dataset.v; mark(); }; });
    sel.addEventListener('change', mark); mark();
  }

  // ───── บัญชี ─────
  function openAccount() {
    var u = me() || {};
    syncNav('acct');
    Array.prototype.forEach.call(document.querySelectorAll('#ctBottomNav button'), function (b) { b.classList.toggle('on', b.dataset.t === 'acct'); });
    Swal.fire({
      title: 'บัญชีของฉัน', showConfirmButton: false, showCloseButton: true, returnFocus: false,
      html: '<div id="ctAcct" style="text-align:left">' +
        '<div class="row"><span>ชื่อ</span><b>' + esc(u.name) + '</b></div>' +
        '<div class="row"><span>บริษัท / หน่วยงาน</span><b>' + esc(u.company) + '</b></div>' +
        '<div class="row"><span>สังกัด</span><b>' + esc(u.branchName || 'กฟส.อ่าวลึก') + '</b></div>' +
        '<div class="row"><span>ชื่อผู้ใช้</span><b>' + esc(u.username) + '</b></div>' +
        '<button type="button" class="ct-btn" id="ctPw" style="background:#E0F2F1;color:#00695C"><i class="fa-solid fa-key"></i> เปลี่ยนรหัสผ่าน</button>' +
        '<button type="button" class="ct-btn" id="ctReload" style="background:#F1F5F9;color:#334155"><i class="fa-solid fa-rotate-right"></i> โหลดข้อมูลใหม่</button>' +
        '<button type="button" class="ct-btn" id="ctOut" style="background:#FEE2E2;color:#B91C1C"><i class="fa-solid fa-right-from-bracket"></i> ออกจากระบบ</button></div>',
      didOpen: function () {
        $('ctPw').onclick = changePassword;
        $('ctReload').onclick = function () { Swal.close(); loadJobs(); };
        $('ctOut').onclick = function () { Swal.close(); setTimeout(doLogout, 150); };
      },
      willClose: function () { syncNav(window._curTab || 'all'); }
    });
  }
  function changePassword() {
    Swal.fire({
      title: 'เปลี่ยนรหัสผ่าน', showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#00897B', focusConfirm: false, returnFocus: false,
      html: '<div class="ct-swal"><input id="ctOld" type="password" placeholder="รหัสผ่านเดิม" autocomplete="current-password"><input id="ctNew" type="password" placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)" autocomplete="new-password"><input id="ctNew2" type="password" placeholder="ยืนยันรหัสผ่านใหม่" autocomplete="new-password"></div>',
      preConfirm: function () {
        var o = $('ctOld').value, n = $('ctNew').value, n2 = $('ctNew2').value;
        if (!o) return Swal.showValidationMessage('กรุณาใส่รหัสผ่านเดิม');
        if (n.length < 4) return Swal.showValidationMessage('รหัสผ่านใหม่อย่างน้อย 4 ตัว');
        if (n !== n2) return Swal.showValidationMessage('รหัสผ่านใหม่ไม่ตรงกัน');
        return ctApiCall('ctChangePassword', [o, n]).catch(function (e) { Swal.showValidationMessage(e.message); });
      }
    }).then(function (r) { if (r.isConfirmed && r.value) showToast('เปลี่ยนรหัสผ่านแล้ว', 'success'); });
  }

  // ───── เชื่อมกับฟังก์ชันเดิม ─────
  function setHeader() {
    var u = me(); var h = $('headerCompany');
    if (u && h) h.textContent = (u.company || '') + ' · ' + (u.branchName || 'กฟส.อ่าวลึก');
  }
  function wrap(name, after) {
    var f = window[name]; if (typeof f !== 'function' || f.__ct) return;
    var w = function () { var r = f.apply(this, arguments); try { after.apply(this, arguments); } catch (e) {} return r; };
    w.__ct = true; window[name] = w;
  }
  wrap('renderJobs', function () { decorateCards(); syncNav(window._curTab || 'all'); });
  wrap('switchMainTab', function (t) { syncNav(t); });
  wrap('openUpdateSheet', function () { progressChips(); });
  wrap('updateBadges', function () { if (window._curTab === 'dashboard' && typeof renderDashboard === 'function') renderDashboard(); syncNav(window._curTab || 'all'); });
  var firstLoad = true;
  wrap('loadJobs', function () { setHeader(); buildNav(); if (firstLoad) { firstLoad = false; switchMainTab('dashboard'); } });

  // ออกจากระบบ = ล้าง token ในเครื่องด้วย
  var origLogout = window.doLogout;
  window.doLogout = function () {
    Swal.fire({ title: 'ออกจากระบบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ออก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#0D2B5E', returnFocus: false })
      .then(function (r) {
        if (!r.isConfirmed) return;
        ctClearSession(); _user = null; _jobs = [];
        try { stopNotificationPolling(); } catch (e) {}
        $('appScreen').style.display = 'none'; $('loginScreen').style.display = 'flex';
        $('loginUser').value = ''; $('loginPass').value = '';
      });
  };
  void origLogout;

  function init() {
    addBranchField();
    // เคยเข้าระบบในเครื่องนี้แล้ว → เข้าได้เลย (token หมดอายุ/บัญชีถูกระงับ ระบบจะเด้งกลับหน้าเข้าสู่ระบบเอง)
    var u = me(), t = ctLs(CT_TOKEN_KEY);
    if (u && t && u.company) {
      _user = u;
      $('loginScreen').style.display = 'none';
      $('appScreen').style.display = 'block';
      loadJobs();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
