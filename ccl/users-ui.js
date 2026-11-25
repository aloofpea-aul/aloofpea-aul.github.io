/* CCL — หน้า Admin แบบแท็บ + "👥 ผู้ใช้" (จัดการผู้ใช้แบบง่าย)
   แท็บ: 👥 ผู้ใช้ · 🏗️ ผู้รับจ้าง · 🔔 LINE · ⚙️ ตั้งค่า (ส่วนเดิมย้ายเข้าแท็บ ไม่ได้ลบ)
   ผู้ใช้: รออนุมัติบนสุด (เลือกบทบาท → อนุมัติ) · ตาราง/การ์ด · สวิตช์เปิด-ปิดใช้งาน · แก้ไข (บทบาท/หน้าที่/รหัสผ่าน) · เพิ่มผู้ใช้ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TAB = 'users', U = [], F = { f: 'all', q: '' }, built = false, ME = '';
  var ROLE = { Admin: ['👑 Admin', '#FEF3C7', '#92400E', 'ทำได้ทุกอย่าง รวมจัดการผู้ใช้ ตั้งค่า นำเข้า SAP'], User: ['ผู้ใช้', '#DBEAFE', '#1E40AF', 'บันทึก/แก้ไขงาน ตัดงบ ตรวจรับ ส่งปิดงาน'], Viewer: ['👁️ ดูอย่างเดียว', '#F1F5F9', '#475569', 'ดูข้อมูลและรายงาน แก้ไขไม่ได้ (เช่น บัญชี ผู้บริหาร)'] };
  var COL = ['#0D9488', '#2563EB', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B', '#EF4444', '#14B8A6'];
  function ini(n) { return (String(n || '?').replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').trim().charAt(0) || '?'); }
  function col(s) { var h = 0; String(s).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) | 0; }); return COL[Math.abs(h) % COL.length]; }
  function ago(v) { var d = new Date(v); if (isNaN(d)) return ''; var n = Math.floor((Date.now() - d) / 864e5); return n <= 0 ? 'วันนี้' : n === 1 ? 'เมื่อวาน' : n + ' วันก่อน'; }

  var css = '#cbUsersCard{display:none!important}' + /* การ์ดเดิมจาก branch.js — แทนที่ด้วยแท็บผู้ใช้ */
    '#adTabs{display:flex;gap:6px;flex-wrap:wrap;margin:-4px 0 16px}#adTabs button{border:0;border-radius:11px;padding:8px 14px;font:700 14px inherit;font-family:inherit;background:#E2E8F0;color:#475569;cursor:pointer}#adTabs button.on{background:#0F172A;color:#fff}' +
    '#adTabs button em{font-style:normal;background:#EF4444;color:#fff;border-radius:99px;padding:0 6px;font-size:11px;margin-left:4px}' +
    '#uxu .hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}#uxu .hd h3{margin:0;font-size:18px;font-weight:800;color:#1E293B}#uxu .sp{flex:1}' +
    '#uxu .q{border:1.5px solid #E2E8F0;border-radius:11px;padding:8px 12px;font:14px inherit;font-family:inherit;width:min(280px,100%)}' +
    '#uxu .bt{border:0;border-radius:11px;padding:9px 14px;font:800 13.5px inherit;font-family:inherit;background:#0D9488;color:#fff;cursor:pointer}' +
    '#uxu .chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}#uxu .chips button{background:#fff;border:2px solid #E2E8F0;border-radius:12px;padding:5px 13px;font:700 12.5px inherit;font-family:inherit;color:#64748B;cursor:pointer;text-align:left}' +
    '#uxu .chips button b{display:block;font-size:19px;color:#1E293B;line-height:1.2}#uxu .chips button.on{border-color:#0D9488;background:#F0FDFA}#uxu .chips button.r b{color:#DC2626}' +
    '#uxu .pend{background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:14px;padding:10px 12px;margin-bottom:12px}#uxu .pend h4{margin:0 0 8px;font-size:14px;color:#9A3412;font-weight:800}' +
    '#uxu .pr{display:flex;align-items:center;gap:10px;background:#fff;border-radius:11px;padding:8px 10px;flex-wrap:wrap}#uxu .pr+.pr{margin-top:6px}' +
    '#uxu .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;flex-shrink:0}' +
    '#uxu .pr b,#uxu .u b{font-size:14px;display:block;color:#1E293B}#uxu .pr small,#uxu .u small{font-size:12px;color:#64748B}' +
    '#uxu .seg{display:inline-flex;background:#F1F5F9;border-radius:9px;padding:3px;margin-left:auto}#uxu .seg button{border:0;background:none;font:700 12px inherit;font-family:inherit;padding:4px 10px;border-radius:7px;color:#64748B;cursor:pointer}#uxu .seg button.on{background:#fff;color:#0F172A;box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    '#uxu .ok{border:0;background:#16A34A;color:#fff;border-radius:9px;padding:7px 12px;font:800 12.5px inherit;font-family:inherit;cursor:pointer}#uxu .no{border:1.5px solid #FECACA;background:#fff;color:#DC2626;border-radius:9px;padding:6px 10px;font:800 12.5px inherit;font-family:inherit;cursor:pointer}' +
    '#uxu .tb{background:#fff;border-radius:14px;overflow:hidden;border:1px solid #EEF2F7}' +
    '#uxu .tr{display:grid;grid-template-columns:minmax(0,2.2fr) minmax(0,1fr) minmax(0,1.8fr) 70px 80px;align-items:center;padding:9px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;gap:8px;cursor:pointer}#uxu .tr:hover{background:#F8FAFC}' +
    '#uxu .tr.h{font-size:12px;color:#64748B;font-weight:700;background:#F8FAFC;cursor:default}#uxu .tr.off{opacity:.55}' +
    '#uxu .u{display:flex;gap:10px;align-items:center;min-width:0}#uxu .u>div{min-width:0}' +
    '#uxu .rl{display:inline-block;border-radius:7px;padding:2px 9px;font-size:12px;font-weight:800;white-space:nowrap}#uxu .tg{display:inline-block;border-radius:7px;padding:1px 7px;font-size:11.5px;font-weight:700;margin:1px 3px 1px 0;white-space:nowrap}' +
    '.uxsw{width:40px;height:23px;border-radius:99px;background:#CBD5E1;position:relative;display:inline-block;vertical-align:middle;border:0;cursor:pointer;flex-shrink:0;padding:0}.uxsw:after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:left .15s}.uxsw.on{background:#16A34A}.uxsw.on:after{left:20px}.uxsw:disabled{opacity:.5;cursor:not-allowed}' +
    '#uxu .ac{color:#2563EB;font-weight:700;font-size:12.5px;text-align:right}' +
    '#uxu .emp{text-align:center;color:#94A3B8;padding:24px;font-size:13.5px}' +
    '@media(max-width:760px){#uxu .tr.h{display:none}#uxu .tr{grid-template-columns:1fr auto;grid-template-areas:"u s" "r a" "d d";row-gap:6px}#uxu .tr>:nth-child(1){grid-area:u}#uxu .tr>:nth-child(2){grid-area:r}#uxu .tr>:nth-child(3){grid-area:d}#uxu .tr>:nth-child(4){grid-area:s;text-align:right}#uxu .tr>:nth-child(5){grid-area:a}#uxu .tr{border-bottom:6px solid #F1F5F9}}' +
    // หน้าต่างแก้ไข
    '#uxd{position:fixed;inset:0;z-index:10040;display:none}#uxd .dm{position:absolute;inset:0;background:rgba(15,23,42,.35)}' +
    '#uxd .dr{position:absolute;right:0;top:0;bottom:0;width:min(420px,100%);background:#fff;box-shadow:-10px 0 30px rgba(0,0,0,.18);padding:16px;overflow-y:auto;font-family:inherit}' +
    '#uxd h3{margin:0;font-size:17px;font-weight:800;display:flex;gap:8px;align-items:center}#uxd h3 button{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#F1F5F9;color:#64748B;cursor:pointer}' +
    '#uxd .s{font-size:12.5px;color:#64748B;margin:2px 0 10px}#uxd .lb{font-size:12.5px;font-weight:800;color:#475569;margin:12px 0 5px}' +
    '#uxd input{width:100%;border:1.5px solid #E2E8F0;border-radius:10px;padding:8px 10px;font:14px inherit;font-family:inherit;box-sizing:border-box}#uxd input:focus{outline:0;border-color:#0D9488}' +
    '#uxd .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '#uxd .role{display:block;width:100%;text-align:left;border:2px solid #E2E8F0;background:#fff;border-radius:12px;padding:8px 10px;margin-bottom:6px;font:13px inherit;font-family:inherit;cursor:pointer}#uxd .role b{font-size:14px}#uxd .role small{display:block;color:#64748B;font-size:12px}#uxd .role.on{border-color:#0D9488;background:#F0FDFA}' +
    '#uxd .dt{display:flex;align-items:center;gap:8px;border:1.5px solid #E2E8F0;border-radius:12px;padding:8px 10px;margin-bottom:6px;font-size:13.5px;font-weight:700}#uxd .dt small{display:block;font-weight:600;color:#64748B;font-size:11.5px}#uxd .dt>div{flex:1}' +
    '#uxd .act{display:flex;gap:6px;margin-top:14px}#uxd .act button{flex:1;border-radius:11px;padding:10px;font:800 13.5px inherit;font-family:inherit;cursor:pointer}#uxd .k{border:1.5px solid #FED7AA;background:#FFF7ED;color:#C2410C}#uxd .sv{border:0;background:#0D9488;color:#fff}' +
    '#uxd .note{font-size:12px;color:#64748B;margin-top:10px;line-height:1.5}#uxd .warn{font-size:12px;color:#B45309;background:#FFFBEB;border-radius:9px;padding:6px 9px;margin-top:6px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ───── จัดหน้า Admin เป็นแท็บ ─────
  function build() {
    if (built) return true;
    var page = $('page-admin'), card = page && page.querySelector('.card'); if (!card) return false;
    var pend = $('pendingUsersContainer'), pendBox = pend && pend.closest('.bg-orange-50');
    var line = $('lineTokenInput'), lineBox = line && line.closest('.bg-indigo-50');
    var ctl = $('contractorUserList'), ctBox = ctl && ctl.parentNode;
    var grid = card.querySelector(':scope > .grid');
    var h2 = card.querySelector(':scope > h2'); if (h2) h2.style.display = 'none';
    var tabs = document.createElement('div'); tabs.id = 'adTabs';
    tabs.innerHTML = '<button type="button" data-t="users">👥 ผู้ใช้<em id="adPendN" style="display:none"></em></button><button type="button" data-t="ct">🏗️ ผู้รับจ้าง</button><button type="button" data-t="line">🔔 LINE</button><button type="button" data-t="set">⚙️ ตั้งค่า</button>';
    card.insertBefore(tabs, card.firstChild);
    var pu = document.createElement('div'); pu.dataset.tab = 'users'; pu.id = 'uxu'; pu.innerHTML = '<div class="emp">กำลังโหลด…</div>';
    tabs.insertAdjacentElement('afterend', pu);
    if (pendBox) { pendBox.dataset.tab = 'hide'; }
    var pl = document.createElement('div'); pl.dataset.tab = 'line'; if (lineBox) { pl.appendChild(lineBox); lineBox.classList.remove('md:col-span-2'); }
    pu.insertAdjacentElement('afterend', pl);
    if (grid) grid.dataset.tab = 'set';
    if (ctBox) { ctBox.dataset.tab = 'ct'; ctBox.classList.remove('mt-4'); }
    // ปุ่มนัดหมาย/รายงานประจำเดือน (เดิมอยู่ในกล่องรออนุมัติ) → ย้ายไปแท็บตั้งค่า
    if (pendBox && grid) {
      var bx = document.createElement('div'); bx.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px'; bx.dataset.tab = 'set';
      Array.prototype.forEach.call(pendBox.querySelectorAll('button'), function (b) { if (/openAppointmentManager|printMonthlyReport/.test(b.getAttribute('onclick') || '')) bx.appendChild(b); });
      grid.parentNode.insertBefore(bx, grid);
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (b) { TAB = b.dataset.t; show(); } });
    pu.addEventListener('click', onClick); pu.addEventListener('input', function (e) { if (e.target.id === 'uxQ') { F.q = e.target.value; rows(); } });
    built = true; show(); return true;
  }
  function show() {
    var card = $('page-admin').querySelector('.card');
    Array.prototype.forEach.call(card.querySelectorAll('[data-tab]'), function (el) { el.style.display = el.dataset.tab === TAB ? '' : 'none'; });
    Array.prototype.forEach.call(document.querySelectorAll('#adTabs [data-t]'), function (b) { b.classList.toggle('on', b.dataset.t === TAB); });
    if (TAB === 'users') load();
    if (TAB === 'ct' && typeof loadContractorUsers === 'function') try { loadContractorUsers(); } catch (e) {}
  }

  // ───── ข้อมูล ─────
  function load() {
    google.script.run.withSuccessHandler(function (r) { U = (r && r.users) || []; var me = U.filter(function (u) { return u.me; })[0]; ME = me ? me.username : ''; render(); })
      .withFailureHandler(function (e) { $('uxu').innerHTML = '<div class="emp">โหลดรายชื่อไม่ได้: ' + esc((e && e.message) || e) + '</div>'; }).cclUsersList();
  }
  function cnt(f) { return U.filter(f).length; }
  var FL = {
    all: ['ทั้งหมด', function (u) { return u.status !== 'Rejected'; }], pend: ['รออนุมัติ', function (u) { return u.status === 'Pending'; }],
    act: ['ใช้งานอยู่', function (u) { return u.status === 'Active'; }], off: ['ปิดใช้งาน', function (u) { return u.status === 'Disabled' || u.status === 'Rejected'; }],
    adm: ['Admin', function (u) { return u.role === 'Admin' && u.status === 'Active'; }], com: ['กรรมการตรวจรับ', function (u) { return u.com; }], sup: ['ผู้ควบคุมงาน', function (u) { return u.sup; }]
  };
  function render() {
    var P = $('uxu'), pend = U.filter(FL.pend[1]);
    var n = $('adPendN'); if (n) { n.textContent = pend.length; n.style.display = pend.length ? '' : 'none'; }
    P.innerHTML = '<div class="hd"><h3>👥 ผู้ใช้งาน CCL</h3><span class="sp"></span><input class="q" id="uxQ" placeholder="🔍 ค้นหาชื่อ / ชื่อผู้ใช้ / แผนก" value="' + esc(F.q) + '"><button type="button" class="bt" data-a="new">＋ เพิ่มผู้ใช้</button></div>' +
      '<div class="chips">' + Object.keys(FL).map(function (k) { var c = cnt(FL[k][1]); if (k !== 'all' && k !== 'act' && !c) return ''; return '<button type="button" data-f="' + k + '" class="' + (F.f === k ? 'on' : '') + (k === 'pend' ? ' r' : '') + '"><b>' + c + '</b>' + FL[k][0] + '</button>'; }).join('') + '</div>' +
      (pend.length ? '<div class="pend"><h4>⏳ รออนุมัติ ' + pend.length + ' คน — เลือกบทบาทแล้วกดอนุมัติ</h4>' + pend.map(function (u) {
        return '<div class="pr" data-row="' + u.row + '"><div class="av" style="background:' + col(u.username) + '">' + esc(ini(u.name)) + '</div><div><b>' + esc(u.name) + '</b><small>' + esc(u.username) + (u.department ? ' · ' + esc(u.department) : '') + (u.registered ? ' · สมัคร' + esc(ago(u.registered)) : '') + '</small></div>' +
          '<span class="seg">' + ['User', 'Viewer', 'Admin'].map(function (r, i) { return '<button type="button" data-pr="' + r + '" class="' + (i === 0 ? 'on' : '') + '">' + (r === 'User' ? 'ผู้ใช้' : r === 'Viewer' ? 'ดูอย่างเดียว' : 'Admin') + '</button>'; }).join('') + '</span>' +
          '<button type="button" class="ok" data-a="approve">✓ อนุมัติ</button><button type="button" class="no" data-a="reject" title="ปฏิเสธ">✕</button></div>';
      }).join('') + '</div>' : '') +
      '<div class="tb" id="uxT"></div>';
    rows();
  }
  function rows() {
    var T = $('uxT'); if (!T) return;
    var q = F.q.trim().toLowerCase();
    var a = U.filter(function (u) { return u.status !== 'Pending' || F.f === 'pend'; }).filter(FL[F.f][1]).filter(function (u) { return !q || [u.name, u.username, u.department].join(' ').toLowerCase().indexOf(q) >= 0; });
    a.sort(function (x, y) { var o = { Active: 0, Pending: 1, Disabled: 2, Rejected: 3 }; return (o[x.status] - o[y.status]) || ({ Admin: 0, User: 1, Viewer: 2 }[x.role] || 3) - ({ Admin: 0, User: 1, Viewer: 2 }[y.role] || 3) || x.name.localeCompare(y.name, 'th'); });
    T.innerHTML = '<div class="tr h"><span>ผู้ใช้</span><span>บทบาท</span><span>หน้าที่</span><span>ใช้งาน</span><span></span></div>' + (a.length ? a.map(function (u) {
      var R = ROLE[u.role] || [u.role, '#F1F5F9', '#475569'], on = u.status === 'Active';
      return '<div class="tr' + (on ? '' : ' off') + '" data-row="' + u.row + '"><div class="u"><div class="av" style="background:' + (on ? col(u.username) : '#94A3B8') + '">' + esc(ini(u.name)) + '</div><div><b>' + esc(u.name) + (u.me ? ' <span style="color:#0D9488;font-size:11.5px">(คุณ)</span>' : '') + '</b><small>' + esc(u.username) + (u.department ? ' · ' + esc(u.department) : '') + (u.status === 'Rejected' ? ' · ปฏิเสธแล้ว' : '') + '</small></div></div>' +
        '<span><span class="rl" style="background:' + R[1] + ';color:' + R[2] + '">' + R[0] + '</span></span>' +
        '<span>' + (u.sup ? '<span class="tg" style="background:#FEF3C7;color:#92400E">👷 ผู้ควบคุมงาน</span>' : '') + (u.com ? '<span class="tg" style="background:#CCFBF1;color:#0F766E">🔍 กรรมการ' + (u.chair ? ' (ประธาน)' : '') + '</span>' : '') + (!u.sup && !u.com ? '<span style="color:#CBD5E1">—</span>' : '') + '</span>' +
        '<span><button type="button" class="uxsw' + (on ? ' on' : '') + '" data-a="tg" title="' + (on ? 'ใช้งานอยู่ — กดเพื่อปิด' : 'ปิดอยู่ — กดเพื่อเปิด') + '"' + (u.me ? ' disabled' : '') + '></button></span><span class="ac">✏️ แก้ไข</span></div>';
    }).join('') : '<div class="emp">ไม่พบผู้ใช้</div>');
  }
  function byRow(r) { return U.filter(function (u) { return String(u.row) === String(r); })[0]; }
  function save(u, after) {
    google.script.run.withSuccessHandler(function (r) { load(); if (after) after(r); })
      .withFailureHandler(function (e) { Swal.fire({ icon: 'error', title: 'บันทึกไม่ได้', text: (e && e.message) || String(e) }); load(); }).cclUserSave(u);
  }
  function onClick(e) {
    var b = e.target.closest('button,[data-row]'); if (!b) return;
    if (b.dataset.f) { F.f = b.dataset.f; render(); return; }
    if (b.dataset.pr) { Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); return; }
    var a = b.dataset.a, rowEl = b.closest('[data-row]'), u = rowEl && byRow(rowEl.dataset.row);
    if (a === 'new') return edit(null);
    if (a === 'approve' && u) { var role = (rowEl.querySelector('.seg .on') || {}).dataset ? rowEl.querySelector('.seg .on').dataset.pr : 'User'; b.disabled = true; b.textContent = '…'; save({ row: u.row, username: u.username, name: u.name, department: u.department, role: role, status: 'Active' }, function () { toast('อนุมัติ ' + u.name + ' แล้ว'); }); return; }
    if (a === 'reject' && u) { Swal.fire({ icon: 'warning', title: 'ปฏิเสธ ' + u.name + '?', text: 'บัญชีนี้จะเข้าระบบไม่ได้ (เปิดใช้ทีหลังได้)', showCancelButton: true, confirmButtonText: 'ปฏิเสธ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#DC2626' }).then(function (x) { if (x.isConfirmed) save({ row: u.row, username: u.username, name: u.name, department: u.department, role: u.role, status: 'Rejected' }); }); return; }
    if (a === 'tg' && u) { e.stopPropagation(); var on = u.status === 'Active'; b.classList.toggle('on', !on); save({ row: u.row, username: u.username, name: u.name, department: u.department, role: u.role, status: on ? 'Disabled' : 'Active' }, function () { toast(on ? 'ปิดใช้งาน ' + u.name + ' แล้ว — เข้าระบบไม่ได้ทันที' : 'เปิดใช้งาน ' + u.name + ' แล้ว'); }); return; }
    if (rowEl && rowEl.classList.contains('tr') && !rowEl.classList.contains('h') && u) edit(u);
  }
  function toast(t) { if (window.Swal) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: t, showConfirmButton: false, timer: 2200 }); }

  // ───── หน้าต่างแก้ไข / เพิ่ม ─────
  var E = null;
  function edit(u) {
    var isNew = !u; E = u ? JSON.parse(JSON.stringify(u)) : { isNew: true, username: '', name: '', department: '', role: 'User', status: 'Active', sup: false, com: false, position: '' };
    var d = $('uxd'); if (!d) { d = document.createElement('div'); d.id = 'uxd'; document.body.appendChild(d); d.addEventListener('click', dClick); d.addEventListener('input', dInput); }
    var me = !isNew && E.me;
    d.innerHTML = '<div class="dm" data-x="1"></div><div class="dr"><h3>' + (isNew ? '＋ เพิ่มผู้ใช้' : '✏️ ' + esc(E.name)) + '<button type="button" data-x="1">✕</button></h3>' +
      '<div class="s">' + (isNew ? 'ระบบสร้างรหัสผ่านชั่วคราวให้ — ส่งให้เจ้าตัวไปเปลี่ยนเอง' : esc(E.username) + (E.registered ? ' · สมัคร ' + esc(new Date(E.registered).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })) : '')) + '</div>' +
      (isNew ? '<p class="lb">ชื่อผู้ใช้ (ใช้ล็อกอิน)</p><input data-k="username" placeholder="เช่น somchai" autocapitalize="off" autocomplete="off">' : '') +
      '<p class="lb">ชื่อ-นามสกุล</p><input data-k="name" value="' + esc(E.name) + '" placeholder="เช่น นายสมชาย ใจดี">' +
      '<div class="two"><div><p class="lb">แผนก / สังกัด</p><input data-k="department" value="' + esc(E.department) + '" placeholder="เช่น ผปร."></div><div><p class="lb">ตำแหน่ง</p><input data-k="position" value="' + esc(E.position) + '" placeholder="เช่น พชง.5"></div></div>' +
      '<p class="lb">บทบาท — ทำอะไรได้บ้าง</p>' + ['Admin', 'User', 'Viewer'].map(function (r) { return '<button type="button" class="role' + (E.role === r ? ' on' : '') + '" data-role="' + r + '"' + (me && r !== 'Admin' ? ' disabled style="opacity:.5"' : '') + '><b>' + (E.role === r ? '✓ ' : '') + ROLE[r][0] + '</b><small>' + ROLE[r][3] + '</small></button>'; }).join('') +
      '<p class="lb">หน้าที่ในงาน</p>' +
      '<div class="dt"><div>👷 ผู้ควบคุมงาน<small>ขึ้นในรายชื่อเลือกผู้ควบคุมงาน</small></div><button type="button" class="uxsw' + (E.sup ? ' on' : '') + '" data-sw="sup"></button></div>' +
      '<div class="dt"><div>🔍 คณะกรรมการตรวจรับ' + (E.chair ? ' (ประธาน)' : '') + '<small>ตรวจรับงาน + ทำแทนผู้รับจ้างได้</small></div><button type="button" class="uxsw' + (E.com ? ' on' : '') + '" data-sw="com"></button></div>' +
      (isNew ? '' : '<p class="lb">การเข้าใช้</p><div class="dt"><div>✅ เปิดใช้งาน<small>ปิด = เข้าระบบไม่ได้ทันที (ข้อมูลไม่หาย)</small></div><button type="button" class="uxsw' + (E.status === 'Active' ? ' on' : '') + '" data-sw="status"' + (me ? ' disabled' : '') + '></button></div>') +
      (me ? '<div class="warn">นี่คือบัญชีของคุณ — ลดสิทธิ์หรือปิดบัญชีตัวเองไม่ได้</div>' : '') +
      '<div class="act">' + (isNew ? '' : '<button type="button" class="k" data-a="pw">🔑 ตั้งรหัสผ่านใหม่</button>') + '<button type="button" class="sv" data-a="save">💾 ' + (isNew ? 'เพิ่มผู้ใช้' : 'บันทึก') + '</button></div>' +
      '<div class="note">' + (isNew ? '' : '🔑 ตั้งรหัสผ่านใหม่: ระบบสร้างรหัสชั่วคราวให้ คัดลอกหรือส่ง LINE ให้เจ้าตัวได้ · เครื่องที่ล็อกอินค้างไว้จะถูกออกจากระบบทันที<br>') + 'หน้าที่ผู้ควบคุมงาน/กรรมการ ยังแก้ลำดับหรือรายละเอียดได้ที่แท็บ ⚙️ ตั้งค่า เหมือนเดิม</div></div>';
    d.style.display = 'block';
    setTimeout(function () { var f = d.querySelector(isNew ? '[data-k=username]' : '[data-k=name]'); if (f) f.focus(); }, 80);
  }
  function dInput(e) { var k = e.target.dataset.k; if (k) E[k] = e.target.value; }
  function dClick(e) {
    var d = $('uxd'), t = e.target.closest('[data-x],[data-role],[data-sw],[data-a]'); if (!t) return;
    if (t.dataset.x) { d.style.display = 'none'; return; }
    if (t.dataset.role) { if (t.disabled) return; E.role = t.dataset.role; Array.prototype.forEach.call(d.querySelectorAll('[data-role]'), function (b) { var on = b.dataset.role === E.role; b.classList.toggle('on', on); b.querySelector('b').textContent = (on ? '✓ ' : '') + ROLE[b.dataset.role][0]; }); return; }
    if (t.dataset.sw) { if (t.disabled) return; var k = t.dataset.sw; if (k === 'status') E.status = E.status === 'Active' ? 'Disabled' : 'Active'; else E[k] = !E[k]; t.classList.toggle('on', k === 'status' ? E.status === 'Active' : !!E[k]); return; }
    var a = t.dataset.a;
    if (a === 'save') {
      if (!String(E.name || '').trim()) { Swal.showValidationMessage ? null : null; return alert('กรุณาใส่ชื่อ-นามสกุล'); }
      t.disabled = true; t.textContent = 'กำลังบันทึก…';
      save(E, function (r) { d.style.display = 'none'; if (E.isNew && r && r.tempPw) pwShow(E, r.tempPw, true); else toast('บันทึกแล้ว'); });
      setTimeout(function () { t.disabled = false; t.textContent = '💾 บันทึก'; }, 4000);
    }
    if (a === 'pw') {
      Swal.fire({ icon: 'question', title: 'ตั้งรหัสผ่านใหม่ให้ ' + E.name + '?', text: 'ระบบสร้างรหัสชั่วคราวให้ และเครื่องที่ล็อกอินค้างอยู่จะถูกออกจากระบบ', showCancelButton: true, confirmButtonText: 'ตั้งรหัสใหม่', cancelButtonText: 'ยกเลิก' }).then(function (x) {
        if (!x.isConfirmed) return;
        google.script.run.withSuccessHandler(function (r) { d.style.display = 'none'; pwShow(E, r.tempPw, false); }).withFailureHandler(function (e2) { Swal.fire({ icon: 'error', title: 'ตั้งรหัสไม่ได้', text: (e2 && e2.message) || String(e2) }); }).cclUserResetPw({ row: E.row, username: E.username });
      });
    }
  }
  function pwShow(u, pw, isNew) {
    var msg = 'CCL · ' + (isNew ? 'บัญชีใหม่' : 'รหัสผ่านใหม่') + '\nชื่อผู้ใช้: ' + u.username + '\nรหัสผ่านชั่วคราว: ' + pw + '\nเข้าใช้ที่ ' + location.origin + '/ccl/\n(แนะนำให้เปลี่ยนรหัสหลังเข้าใช้ครั้งแรก)';
    Swal.fire({ icon: 'success', title: isNew ? 'เพิ่มผู้ใช้แล้ว' : 'ตั้งรหัสผ่านใหม่แล้ว', html: '<div style="font-size:14px">ชื่อผู้ใช้ <b>' + esc(u.username) + '</b><br>รหัสผ่านชั่วคราว</div><div style="font:800 26px monospace;letter-spacing:2px;margin:8px 0;color:#0F766E">' + esc(pw) + '</div><div style="font-size:12px;color:#B45309">แสดงครั้งเดียว — คัดลอกหรือส่งให้เจ้าตัวตอนนี้</div>',
      showDenyButton: !!window.cclLineShare, confirmButtonText: '📋 คัดลอก', denyButtonText: '💬 ส่ง LINE', denyButtonColor: '#06C755', showCloseButton: true })
      .then(function (x) { if (x.isConfirmed) { try { navigator.clipboard.writeText(msg); toast('คัดลอกแล้ว'); } catch (e) {} } else if (x.isDenied) cclLineShare({ sub: 'ส่งรหัสผ่านให้ ' + u.name, text: msg }); });
  }

  function hook() {
    var os = window.showPage;
    if (typeof os === 'function' && !os.__ux) { var w = function (id) { var r = os.apply(this, arguments); if (id === 'admin') setTimeout(function () { if (build()) show(); }, 150); return r; }; w.__ux = 1; for (var k in os) w[k] = os[k]; window.showPage = w; }
  }
  hook(); setTimeout(hook, 1500);
})();
