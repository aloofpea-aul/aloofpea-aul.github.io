/* hub-admin.js — ส่วนเสริมหน้าศูนย์รวมงาน
 *  - แถบที่มาของการเข้าใช้บนการ์ด (ศูนย์รวมงาน / ลิงก์ตรง / ไอคอนบนจอ)
 *  - การ์ดโปรแกรมที่ล็อกสิทธิ์ (GATED) จะแสดง "ยังไม่ได้รับสิทธิ์" + ปุ่มขอสิทธิ์
 *  - สมัครใหม่ / ออกจากระบบ ในกล่องเข้าสู่ระบบ
 *  - ผู้ดูแลระบบ: จัดการผู้ใช้ (อนุมัติคำขอ, เปิด/ปิดสิทธิ์รายโปรแกรม, สถิติการเข้าใช้)
 * ใช้ CURRENT_USER, callApi, GAS_URL จาก index.html
 */
(function () {
  'use strict';
  // โปรแกรมที่ตรวจสิทธิ์จริงที่หน้าโปรแกรม (ผ่าน pea-hub.js) — ตัวอื่นยังเปิดได้ตามเดิม
  var GATED = ['drawings', 'dutyroster', 'procure', 'tfbuy', 'damage'];
  var APP_LIST = [];
  var MY_APPS = null;
  var STATS = {};

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function appName(code) {
    var a = APP_LIST.find(function (x) { return x.code === code; });
    if (a) return a.name;
    var t = document.querySelector('.app-tile[data-app="' + code + '"] .name');
    return t ? t.textContent : code;
  }
  function loggedIn() { return CURRENT_USER && CURRENT_USER.name && CURRENT_USER.role; }
  function isAdmin() { return loggedIn() && CURRENT_USER.role === 'admin'; }

  /* ---------------- สไตล์ ---------------- */
  var st = document.createElement('style');
  st.textContent = '' +
    '.src-bar{display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:6px;background:#eee}' +
    '.src-bar i{display:block;height:100%}' +
    '.src-txt{font-size:.68rem;color:#666;margin-top:3px}' +
    '.app-tile.no-perm{background:#ebe7df;border-style:dashed}' +
    '.app-tile.no-perm .icon,.app-tile.no-perm .desc{opacity:.55}' +
    '.app-tile .perm-badge{position:absolute;top:12px;right:12px;font-size:.68rem;font-weight:700;padding:3px 9px;border-radius:10px;background:#fff3e0;color:#8a4b00}' +
    '#hubAdminBtn{font:inherit;font-size:.75rem;padding:5px 12px;border-radius:14px;border:0;background:#ffb547;color:#3a2500;font-weight:700;cursor:pointer;display:none}' +
    '#hubAdminBtn.show{display:inline-block}' +
    '.hm-ov{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 12px 16px;overflow:auto}' +
    '.hm-box{background:var(--paper,#f4f1ea);border-radius:14px;width:100%;max-width:760px;box-shadow:0 10px 40px rgba(0,0,0,.35);overflow:hidden}' +
    '.hm-head{background:var(--pea-purple,#4b2e83);color:#fff;padding:14px 16px 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}' +
    '.hm-head h2{margin:0;font-size:1.05rem;flex:1}' +
    '.hm-x{background:rgba(255,255,255,.18);color:#fff;border:0;border-radius:8px;height:36px;padding:0 12px;font:inherit;cursor:pointer}' +
    '.hm-tabs{flex:1 1 100%;display:flex;gap:4px;margin-top:10px;overflow-x:auto}' +
    '.hm-tabs button{border:0;background:transparent;color:#fff;font:inherit;font-size:.9rem;height:40px;padding:0 14px;border-radius:10px 10px 0 0;cursor:pointer;white-space:nowrap}' +
    '.hm-tabs button.on{background:var(--paper,#f4f1ea);color:var(--pea-purple,#4b2e83);font-weight:700}' +
    '.hm-body{padding:14px;display:flex;flex-direction:column;gap:12px;min-height:200px}' +
    '.hm-card{background:#fff;border:1px solid var(--line,#e3ddd0);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}' +
    '.hm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
    '.hm-name{font-weight:700;flex:1;min-width:120px}' +
    '.hm-muted{font-size:.75rem;color:#666}' +
    '.hm-sec{font-size:.8rem;font-weight:700;color:var(--pea-purple,#4b2e83);margin-top:4px}' +
    '.hm-apps{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 10px}' +
    '.hm-apps label{display:flex;align-items:center;gap:7px;font-size:.85rem;min-height:30px}' +
    '.hm-apps input{width:18px;height:18px;accent-color:var(--pea-purple,#4b2e83)}' +
    '.hm-btn{font:inherit;font-size:.85rem;height:38px;padding:0 14px;border-radius:8px;cursor:pointer;border:1px solid var(--pea-purple,#4b2e83);background:#fff;color:var(--pea-purple,#4b2e83);font-weight:700}' +
    '.hm-btn.ok{background:#2e7d32;border-color:#2e7d32;color:#fff}.hm-btn.no{border-color:#c0392b;color:#c0392b}' +
    '.hm-btn.pri{background:var(--pea-purple,#4b2e83);color:#fff}' +
    '.hm-btn:disabled{opacity:.5}' +
    '.chip{font:inherit;font-size:.75rem;height:30px;padding:0 10px;border-radius:15px;border:1px solid #c9c1b0;background:#fff;color:#5c5548;cursor:pointer}' +
    '.chip.on{background:var(--pea-purple,#4b2e83);border-color:var(--pea-purple,#4b2e83);color:#fff}' +
    '.chip:disabled{cursor:default;opacity:.8}' +
    '.hm-chips{display:flex;flex-wrap:wrap;gap:6px}' +
    '.hm-search{height:42px;border:1px solid #d8d0bf;border-radius:10px;padding:0 12px;font:inherit;width:100%;box-sizing:border-box}' +
    '.hm-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
    '.hm-kpi div{background:#fff;border:1px solid var(--line,#e3ddd0);border-radius:12px;padding:10px;display:flex;flex-direction:column}' +
    '.hm-kpi b{font-size:1.35rem}.hm-kpi span{font-size:.72rem;color:#666}' +
    '.hm-tbl{width:100%;border-collapse:collapse;font-size:.85rem}' +
    '.hm-tbl th{font-size:.72rem;color:#666;font-weight:400;text-align:right;padding:4px 6px}' +
    '.hm-tbl th:first-child,.hm-tbl td:first-child{text-align:left}' +
    '.hm-tbl td{border-top:1px solid #efeae0;padding:6px;text-align:right}' +
    '.c-p{color:#4b2e83}.c-d{color:#a8600f}.c-a{color:#1f6f5c}' +
    '.hm-empty{text-align:center;color:#777;font-size:.88rem;padding:24px 8px}' +
    '.hm-msg{font-size:.82rem;min-height:18px}.hm-msg.err{color:#c0392b}.hm-msg.ok{color:#2e7d32}' +
    '.hm-seg{display:flex;gap:6px;flex-wrap:wrap}' +
    '.hm-seg button{font:inherit;font-size:.8rem;height:32px;padding:0 12px;border-radius:16px;border:1px solid #c9c1b0;background:#fff;cursor:pointer}' +
    '.hm-seg button.on{background:var(--pea-purple,#4b2e83);border-color:var(--pea-purple,#4b2e83);color:#fff}' +
    '.hm-field{display:block;font-size:.85rem;color:#555;margin-bottom:10px}' +
    '.hm-field input{display:block;width:100%;box-sizing:border-box;height:44px;margin-top:4px;border:1px solid #d8d0bf;border-radius:8px;padding:0 12px;font:inherit;font-size:16px}' +
    '#userPickExtra{display:flex;gap:8px;justify-content:space-between;margin-top:10px;font-size:.82rem}' +
    '#userPickExtra button{background:none;border:0;color:var(--pea-purple,#4b2e83);font:inherit;text-decoration:underline;cursor:pointer;padding:6px 0}';
  document.head.appendChild(st);

  var st2 = document.createElement('style');
  st2.textContent = '' +
    '#hubAdmCard{display:flex;align-items:center;gap:12px;width:100%;margin:12px 0 4px;background:#fff;border:2px solid var(--pea-purple,#4b2e83);border-radius:16px;padding:11px 14px;font:inherit;text-align:left;cursor:pointer;color:inherit;box-sizing:border-box}' +
    '#hubAdmCard .ic{width:42px;height:42px;border-radius:12px;background:#ede7f6;display:grid;place-items:center;font-size:21px;flex-shrink:0}#hubAdmCard .tx{flex:1;min-width:0}#hubAdmCard b{display:block;font-size:.98rem}#hubAdmCard small{color:#666;font-size:.78rem}' +
    '#hubAdmCard em{font-style:normal;background:#ef4444;color:#fff;border-radius:99px;padding:3px 10px;font-weight:800;font-size:.8rem;white-space:nowrap}' +
    '#hubAdminBtn,#hubAdminBtn.show{display:none!important}' +
    '.hm-box{max-width:940px}' +
    '.hu-top{display:flex;gap:8px;align-items:center;margin-bottom:10px}.hu-top .hm-search{flex:1;margin:0}.hu-top .hm-btn{white-space:nowrap}' +
    '.hu-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.hu-chips button,.hu-pc{background:#fff;border:2px solid #e5e0d6;border-radius:12px;padding:4px 12px;font:inherit;font-size:.76rem;font-weight:700;color:#777;cursor:pointer;text-align:left}.hu-chips b,.hu-pc b{display:block;font-size:1.15rem;color:#222;line-height:1.25}.hu-chips .on{border-color:var(--pea-purple,#4b2e83);background:#f3effa}.hu-pc{cursor:default;border-color:#fed7aa;background:#fff7ed}.hu-pc b{color:#dc2626}' +
    '.hu-pend{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:14px;padding:10px 12px;margin-bottom:12px}.hu-pend h4{margin:0 0 8px;font-size:.85rem;color:#9a3412}' +
    '.hu-pr{background:#fff;border-radius:11px;padding:8px 10px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}.hu-pr+.hu-pr{margin-top:6px}.hu-pr .hm-msg{flex-basis:100%;margin:0}.hu-pr .hm-msg:empty{display:none}' +
    '.hu-av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;flex-shrink:0}' +
    '.hu-nm{min-width:0;flex:1}.hu-nm b{display:block;font-size:.88rem}.hu-nm b em{font-style:normal;color:var(--pea-purple,#4b2e83);font-size:.75rem}.hu-nm small{font-size:.74rem;color:#777}' +
    '.hu-seg{display:inline-flex;background:#f3effa;border-radius:9px;padding:3px}.hu-seg button{border:0;background:none;font:inherit;font-size:.76rem;font-weight:700;padding:5px 10px;border-radius:7px;color:#777;cursor:pointer}.hu-seg .on{background:#fff;color:var(--pea-purple,#4b2e83);box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    '.hu-tbl{background:#fff;border-radius:14px;overflow:hidden}' +
    '.hu-tr{display:grid;grid-template-columns:minmax(0,2fr) 120px minmax(0,1.7fr) 56px 64px;gap:8px;align-items:center;padding:9px 12px;border-bottom:1px solid #f1ede5;font-size:.8rem;cursor:pointer}.hu-tr:hover{background:#faf8f3}.hu-tr.off{opacity:.55}' +
    '.hu-h{background:#faf8f3;color:#888;font-weight:700;font-size:.74rem;cursor:default}' +
    '.hu-u{display:flex;gap:9px;align-items:center;min-width:0}' +
    '.hu-rl{border-radius:7px;padding:2px 9px;font-weight:800;font-size:.74rem;white-space:nowrap}.hu-rl.a{background:#fef3c7;color:#92400e}.hu-rl.m{background:#ede7f6;color:#4b2e83}' +
    '.hu-bar{display:flex;align-items:center;gap:7px}.hu-bar i{flex:1;height:7px;background:#eee;border-radius:9px;overflow:hidden;max-width:110px}.hu-bar i u{display:block;height:100%;background:#7c5cc4}.hu-bar span{font-size:.74rem;color:#666;white-space:nowrap}' +
    '.hu-sw{width:40px;height:23px;border-radius:99px;background:#cbd5e1;position:relative;border:0;padding:0;cursor:pointer;flex-shrink:0}.hu-sw:after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:left .15s}.hu-sw.on{background:#16a34a}.hu-sw.on:after{left:20px}.hu-sw:disabled{opacity:.5;cursor:not-allowed}' +
    '.hu-ed{color:var(--pea-purple,#4b2e83);font-weight:700;text-align:right;font-size:.78rem}' +
    '@media(max-width:640px){.hu-h{display:none}.hu-tr{grid-template-columns:1fr auto;grid-template-areas:"u s" "r e" "b b";row-gap:6px;border-bottom:6px solid #f4f1ea}.hu-tr>:nth-child(1){grid-area:u}.hu-tr>:nth-child(2){grid-area:r}.hu-tr>:nth-child(3){grid-area:b}.hu-tr>:nth-child(4){grid-area:s}.hu-tr>:nth-child(5){grid-area:e}.hu-bar i{max-width:none}}' +
    '.hu-dw{position:fixed;inset:0;z-index:9500}.hu-dm{position:absolute;inset:0;background:rgba(0,0,0,.35)}' +
    '.hu-dr{position:absolute;right:0;top:0;bottom:0;width:min(420px,100%);background:#fff;box-shadow:-10px 0 30px rgba(0,0,0,.2);padding:16px 16px calc(16px + env(safe-area-inset-bottom));padding-top:max(16px,env(safe-area-inset-top));overflow-y:auto;color:#222}' +
    '.hu-dr h3{margin:0;font-size:1.05rem;display:flex;align-items:center;gap:8px}.hu-x{margin-left:auto;width:34px;height:34px;border-radius:50%;border:0;background:#f1f1f1;color:#777;cursor:pointer;font-size:.9rem}' +
    '.hu-s{font-size:.76rem;color:#777;margin:3px 0 8px}.hu-lb{font-size:.8rem;font-weight:800;color:#555;margin:12px 0 5px;display:flex;gap:4px}.hu-lb a{color:var(--pea-purple,#4b2e83);font-weight:700;cursor:pointer}' +
    '.hu-dr input{width:100%;box-sizing:border-box;border:1.5px solid #e5e0d6;border-radius:10px;padding:9px 10px;font:inherit;font-size:.9rem}.hu-dr input:focus{outline:0;border-color:var(--pea-purple,#4b2e83)}' +
    '.hu-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.hu-roles{display:grid;grid-template-columns:1fr 1fr;gap:6px}.hu-roles button{border:2px solid #e5e0d6;background:#fff;border-radius:12px;padding:8px 10px;font:inherit;font-size:.74rem;color:#777;text-align:left;cursor:pointer}.hu-roles b{display:block;font-size:.86rem;color:#222}.hu-roles .on{border-color:var(--pea-purple,#4b2e83);background:#f3effa}.hu-roles button:disabled{opacity:.55;cursor:not-allowed}' +
    '.hu-grp{font-size:.74rem;color:#999;font-weight:700;margin:8px 0 4px}.hu-apps{display:flex;flex-wrap:wrap;gap:5px}.hu-apps button{border:1.5px solid #e5e0d6;background:#fff;border-radius:99px;padding:5px 11px;font:inherit;font-size:.78rem;font-weight:700;color:#999;cursor:pointer}.hu-apps .on{background:var(--pea-purple,#4b2e83);border-color:var(--pea-purple,#4b2e83);color:#fff}' +
    '.hu-apps .soft:not(.on){border-style:dashed}.hu-apps .soft.on{background:#8b76c2;border-color:#8b76c2}.hu-legend{font-size:.72rem;color:#777;background:#faf8f3;border-radius:9px;padding:7px 9px;margin-top:10px;line-height:1.5}' +
    '.hu-adm-note{font-size:.8rem;color:#92400e;background:#fffbeb;border-radius:10px;padding:8px 10px;margin-top:10px}' +
    '.hu-st{display:flex;align-items:center;gap:8px;border:1.5px solid #eee;border-radius:12px;padding:9px 10px;margin-top:12px;font-size:.86rem;font-weight:700}.hu-st>div{flex:1}.hu-st small{display:block;font-weight:600;color:#888;font-size:.74rem}' +
    '.hu-warn{font-size:.76rem;color:#b45309;background:#fffbeb;border-radius:9px;padding:6px 9px;margin-top:8px}' +
    '.hu-act{display:flex;gap:6px;margin-top:14px}.hu-act button{flex:1;border-radius:11px;padding:11px;font:inherit;font-weight:800;font-size:.86rem;cursor:pointer}.hu-k{border:1.5px solid #fed7aa;background:#fff7ed;color:#c2410c}.hu-sv{border:0;background:var(--pea-purple,#4b2e83);color:#fff}.hu-line{border:0;background:#06c755;color:#fff}' +
    '.hu-pw{border-top:1px dashed #ddd;margin-top:14px;padding-top:4px}' +
    '.hu-pop{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(340px,92vw);background:#fff;border-radius:18px;padding:20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.3)}.hu-pop>b{font-size:1.05rem}' +
    '.hu-code{font:800 1.6rem monospace;letter-spacing:2px;color:#0f766e;margin:8px 0;user-select:all}.hu-close{margin-top:10px;border:0;background:none;color:#777;font:inherit;cursor:pointer;padding:8px}';
  document.head.appendChild(st2);

  /* ---------------- ปุ่มในหัว + กล่องเข้าสู่ระบบ ---------------- */
  var adminBtn = document.createElement('button');
  adminBtn.id = 'hubAdminBtn'; adminBtn.type = 'button'; adminBtn.textContent = 'จัดการผู้ใช้';
  var badge = $('userBadge');
  if (badge && badge.parentNode) badge.parentNode.insertBefore(adminBtn, badge);
  adminBtn.onclick = function () { openAdmin(); };

  var panel = $('userPickPanel');
  if (panel) {
    var extra = document.createElement('div');
    extra.id = 'userPickExtra';
    extra.innerHTML = '<button type="button" id="hubRegBtn">ยังไม่มีบัญชี — สมัครใหม่</button>' +
                      '<button type="button" id="hubOutBtn">ออกจากระบบ</button>';
    var act = panel.querySelector('.modal-actions');
    panel.insertBefore(extra, act ? act.nextSibling : null);
    $('hubRegBtn').onclick = function () { $('userPickOverlay').classList.remove('show'); openRegister(); };
    $('hubOutBtn').onclick = function () {
      try { localStorage.removeItem('pea_aoluek_password'); localStorage.removeItem('pea_hub_auth'); } catch (e) {}
      location.reload();
    };
  }
  function syncOutBtn() { var b = $('hubOutBtn'); if (b) b.style.visibility = loggedIn() ? 'visible' : 'hidden'; }

  /* ---------------- modal ทั่วไป ---------------- */
  var ov = null;
  function modal(title, tabs, onTab) {
    closeModal();
    ov = document.createElement('div'); ov.className = 'hm-ov';
    ov.innerHTML = '<div class="hm-box" role="dialog" aria-modal="true"><div class="hm-head"><h2>' + esc(title) + '</h2>' +
      '<button class="hm-x" type="button">ปิด</button>' +
      (tabs ? '<div class="hm-tabs">' + tabs.map(function (t, i) { return '<button type="button" data-t="' + t.id + '"' + (i ? '' : ' class="on"') + '>' + esc(t.label) + '</button>'; }).join('') + '</div>' : '') +
      '</div><div class="hm-body"></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.hm-x').onclick = closeModal;
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    if (tabs) ov.querySelectorAll('.hm-tabs button').forEach(function (b) {
      b.onclick = function () {
        ov.querySelectorAll('.hm-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        onTab(b.dataset.t);
      };
    });
    return ov.querySelector('.hm-body');
  }
  function closeModal() { if (ov) { ov.remove(); ov = null; } }
  function setTabLabel(id, label) { if (!ov) return; var b = ov.querySelector('.hm-tabs [data-t="' + id + '"]'); if (b) b.textContent = label; }
  function loading(body) { body.innerHTML = '<div class="hm-empty">กำลังโหลด…</div>'; }
  /* อ่านข้อมูล: หมดเวลา 25 วิ + ลองใหม่อัตโนมัติ 1 ครั้ง (ใช้กับคำสั่งอ่านเท่านั้น) */
  function api(p, tries) {
    tries = tries == null ? 1 : tries;
    var once = Promise.race([callApi(p), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 25000); })]);
    return once.then(function (r) {
      if (r && r.busy && tries > 0) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return api(p, tries - 1); });
      return r;
    }, function (e) {
      if (tries > 0) return new Promise(function (ok) { setTimeout(ok, 1500); }).then(function () { return api(p, tries - 1); });
      throw e;
    });
  }
  function failed(body, retry) {
    body.innerHTML = '<div class="hm-empty">โหลดไม่สำเร็จ (ระบบ Google ตอบช้า)<br><button class="hm-btn pri" type="button" style="margin-top:10px">ลองใหม่</button></div>';
    body.querySelector('button').onclick = retry;
  }

  /* ---------------- สมัครใหม่ ---------------- */
  function openRegister() {
    var body = modal('สมัครใช้งานศูนย์รวมงาน');
    body.innerHTML = '<div class="hm-card"><p class="hm-muted" style="margin:0">กรอกชื่อ-นามสกุลจริง และตั้งรหัสผ่าน แล้วรอผู้ดูแลระบบอนุมัติ เมื่ออนุมัติแล้วเปิดหน้านี้อีกครั้งจะเข้าใช้ได้เลยโดยไม่ต้องกรอกใหม่</p>' +
      '<form id="hmReg"><label class="hm-field">ชื่อ-นามสกุล<input name="n" autocomplete="name" required></label>' +
      '<label class="hm-field">ตั้งรหัสผ่าน<input name="p" type="password" autocomplete="new-password" required></label>' +
      '<button class="hm-btn pri" style="width:100%;height:46px" type="submit">ส่งคำขอสมัคร</button><div class="hm-msg"></div></form></div>';
    var f = $('hmReg'), msg = f.querySelector('.hm-msg');
    f.onsubmit = function (e) {
      e.preventDefault();
      var n = f.n.value.trim(), p = f.p.value;
      if (!n || !p) return;
      f.querySelector('button').disabled = true; msg.className = 'hm-msg'; msg.textContent = 'กำลังส่ง…';
      fetch(GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'register', newName: n, newPassword: p }) })
        .then(function (r) { return r.json(); }).then(function (r) {
          f.querySelector('button').disabled = false;
          if (r && r.ok) {
            try { localStorage.setItem('pea_aoluek_username', n); localStorage.setItem('pea_aoluek_password', p); } catch (e2) {}
            msg.className = 'hm-msg ok'; msg.textContent = 'ส่งคำขอแล้ว รอผู้ดูแลระบบอนุมัติ';
          } else { msg.className = 'hm-msg err'; msg.textContent = (r && r.error) || 'สมัครไม่สำเร็จ'; }
        }).catch(function () { f.querySelector('button').disabled = false; msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
    };
  }

  /* ---------------- การ์ด: ที่มาของการเข้าใช้ + สิทธิ์ ---------------- */
  function decorateTiles() {
    document.querySelectorAll('.app-tile[data-app]').forEach(function (t) {
      var s = STATS[t.dataset.app];
      var stat = t.querySelector('.tile-stat');
      if (stat && s) {
        var old = stat.querySelector('.src-wrap'); if (old) old.remove();
        var p = s.portal || 0, d = s.direct || 0, a = s.homeApp || 0, sum = p + d + a;
        if (sum > 0) {
          var w = document.createElement('div'); w.className = 'src-wrap';
          var pct = function (x) { return Math.round(x * 100 / sum); };
          w.innerHTML = '<div class="src-bar"><i style="width:' + pct(p) + '%;background:#4b2e83"></i><i style="width:' + pct(d) + '%;background:#e8962e"></i><i style="width:' + pct(a) + '%;background:#2a9d8f"></i></div>' +
            '<div class="src-txt">ศูนย์รวม ' + p + ' · ลิงก์ตรง ' + d + (a ? ' · ไอคอนบนจอ ' + a : '') + '</div>';
          stat.appendChild(w);
        }
      }
      var gated = GATED.indexOf(t.dataset.app) >= 0;
      var denied = gated && loggedIn() && Array.isArray(MY_APPS) && MY_APPS.indexOf(t.dataset.app) < 0;
      t.classList.toggle('no-perm', denied);
      var pb = t.querySelector('.perm-badge');
      if (denied && !pb) {
        pb = document.createElement('span'); pb.className = 'perm-badge'; pb.textContent = 'ยังไม่ได้รับสิทธิ์ · แตะเพื่อขอ';
        t.appendChild(pb);
        var sb = t.querySelector('.status-badge'); if (sb) sb.style.display = 'none';
      } else if (!denied && pb) {
        pb.remove(); var sb2 = t.querySelector('.status-badge'); if (sb2) sb2.style.display = '';
      }
    });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.app-tile.no-perm');
    if (!t) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var app = t.dataset.app;
    var body = modal('ขอสิทธิ์ใช้ ' + appName(app));
    body.innerHTML = '<div class="hm-card"><div>บัญชี <b>' + esc(CURRENT_USER.name) + '</b> ยังไม่ได้รับสิทธิ์ใช้ <b>' + esc(appName(app)) + '</b></div>' +
      '<button class="hm-btn pri" type="button" id="hmReq" style="height:46px">ส่งคำขอสิทธิ์ถึงผู้ดูแลระบบ</button><div class="hm-msg"></div></div>';
    var b = $('hmReq'), msg = body.querySelector('.hm-msg');
    b.onclick = function () {
      b.disabled = true;
      callApi({ action: 'appRequest', app: app }).then(function (r) {
        if (r && r.ok) { msg.className = 'hm-msg ok'; msg.textContent = r.duplicate ? 'ส่งคำขอไว้แล้ว รอผู้ดูแลระบบ' : 'ส่งคำขอแล้ว'; }
        else { b.disabled = false; msg.className = 'hm-msg err'; msg.textContent = (r && (r.error || r.message)) || 'ส่งไม่สำเร็จ'; }
      }).catch(function () { b.disabled = false; msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
    };
  }, true);

  /* ---------------- ผู้ดูแลระบบ ---------------- */
  var ADM = { pending: [], requests: [], users: [], books: [] };
  function refreshAdminCount() {
    if (!isAdmin()) { adminBtn.classList.remove('show'); admCard(-1); return Promise.resolve(); }
    adminBtn.classList.add('show'); admCard(null);
    return Promise.all([
      api({ action: 'getPendingList' }).catch(function () { return null; }),
      api({ action: 'appRequests' }).catch(function () { return null; }),
      api({ action: 'bookDlList' }).catch(function () { return null; })
    ]).then(function (rs) {
      ADM.books = (rs[2] && rs[2].pending) || []; ADM.booksRecent = (rs[2] && rs[2].recent) || [];
      ADM.err = !(rs[0] && rs[0].ok) || !(rs[1] && rs[1].ok);
      ADM.pending = (rs[0] && rs[0].pending) || [];
      ADM.requests = (rs[1] && rs[1].requests) || [];
      if (rs[1] && rs[1].appList) APP_LIST = rs[1].appList;
      var n = ADM.pending.length + ADM.requests.length + ADM.books.length;
      adminBtn.textContent = n ? 'คำขอใหม่ ' + n : 'จัดการผู้ใช้';
      admCard(n);
      return n;
    });
  }

  /* การ์ดม่วงบนสุดของหน้าศูนย์รวมงาน (เฉพาะผู้ดูแลระบบ) — หาง่ายกว่าปุ่มเล็กข้างชื่อ */
  function admCard(n) {
    var c = $('hubAdmCard');
    if (n === -1) { if (c) c.style.display = 'none'; return; }
    if (!c) {
      var wn = $('welcomeNote'); if (!wn || !wn.parentNode) return;
      c = document.createElement('button'); c.type = 'button'; c.id = 'hubAdmCard';
      c.innerHTML = '<span class="ic">👥</span><span class="tx"><b>จัดการผู้ใช้ศูนย์รวมงาน</b><small>อนุมัติ · สิทธิ์รายโปรแกรม · รหัสผ่าน · สถิติ</small></span><em></em>';
      c.onclick = openAdmin; wn.parentNode.insertBefore(c, wn.nextSibling);
    }
    c.style.display = '';
    if (n != null) { var em = c.querySelector('em'); em.textContent = n ? n + ' ใหม่' : ''; em.style.display = n ? '' : 'none'; }
  }
  function openAdmin() {
    var body = modal('👥 จัดการผู้ใช้ศูนย์รวมงาน', [
      { id: 'users', label: '👥 ผู้ใช้' }, { id: 'req', label: 'ขอสิทธิ์โปรแกรม' }, { id: 'books', label: 'ขอดาวน์โหลดหนังสือ' }, { id: 'stats', label: 'สถิติการเข้าใช้' }
    ], function (t) { ({ req: tabReq, books: tabBooks, users: tabUsers, stats: tabStats })[t](body); });
    if (ADM.requests.length) setTabLabel('req', 'ขอสิทธิ์โปรแกรม (' + ADM.requests.length + ')');
    if (ADM.books.length) setTabLabel('books', 'ขอดาวน์โหลดหนังสือ (' + ADM.books.length + ')');
    tabUsers(body);
  }

  function loadUsers() {
    return api({ action: 'patrolListUsers' }).then(function (r) {
      if (r && r.ok) { ADM.users = r.users || []; if (r.appList) APP_LIST = r.appList; }
      return ADM.users;
    });
  }
  function appCodes() { return APP_LIST.map(function (a) { return a.code; }); }

  function tabReq(body) {
    loading(body);
    Promise.all([refreshAdminCount(), loadUsers()]).then(function () {
      if (ADM.err) { failed(body, function () { tabReq(body); }); return; }
      setTabLabel('req', 'ขอสิทธิ์โปรแกรม' + (ADM.requests.length ? ' (' + ADM.requests.length + ')' : ''));
      var h = '';
      if (!ADM.requests.length) { body.innerHTML = '<div class="hm-empty">ไม่มีคำขอสิทธิ์ค้าง' + (ADM.pending.length ? '<br>(คนสมัครใหม่ ' + ADM.pending.length + ' คน อยู่ที่แท็บ 👥 ผู้ใช้)' : '') + '</div>'; return; }
      if (false) ADM.pending.forEach(function (p, i) {
        h += '<div class="hm-card" data-i="' + i + '"><div class="hm-row"><div class="hm-name">' + esc(p.name) + '</div><div class="hm-muted">สมัคร ' + esc(p.timestamp) + '</div></div>' +
          '<div class="hm-muted">ให้ใช้โปรแกรม (ติ๊กไว้ทั้งหมด เอาออกได้)</div><div class="hm-apps">' +
          APP_LIST.map(function (a) { return '<label><input type="checkbox" value="' + esc(a.code) + '" checked>' + esc(a.name) + '</label>'; }).join('') +
          '</div><div class="hm-row"><label class="hm-row" style="flex:1;font-size:.85rem"><input type="checkbox" class="isAdm" style="width:18px;height:18px">เป็นผู้ดูแลระบบ</label>' +
          '<button class="hm-btn no" type="button" data-act="rej">ปฏิเสธ</button><button class="hm-btn ok" type="button" data-act="ok">อนุมัติ</button></div><div class="hm-msg"></div></div>';
      });

      ADM.requests.forEach(function (q, i) {
        h += '<div class="hm-card" data-q="' + i + '"><div class="hm-row"><div class="hm-name">' + esc(q.user) + '</div><div class="hm-muted">' + esc(q.at) + '</div></div>' +
          '<div>ขอใช้ <b>' + esc(appName(q.app)) + '</b></div><div class="hm-row" style="justify-content:flex-end">' +
          '<button class="hm-btn no" type="button" data-act="qno">ไม่ให้</button><button class="hm-btn ok" type="button" data-act="qok">ให้สิทธิ์</button></div><div class="hm-msg"></div></div>';
      });
      body.innerHTML = h;
      body.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var card = b.closest('.hm-card'), msg = card.querySelector('.hm-msg'), act = b.dataset.act, call;
          if (act === 'ok' || act === 'rej') {
            var p = ADM.pending[+card.dataset.i];
            if (act === 'ok') {
              var apps = Array.prototype.map.call(card.querySelectorAll('.hm-apps input:checked'), function (x) { return x.value; });
              if (!apps.length && !card.querySelector('.isAdm').checked && !confirm('ไม่ได้เลือกโปรแกรมเลย — อนุมัติแต่ยังใช้โปรแกรมใดไม่ได้?')) return;
              call = callApi({ action: 'approvePending', targetName: p.name, approvedRole: card.querySelector('.isAdm').checked ? 'admin' : 'member', approvedApps: apps });
            } else {
              if (!confirm('ปฏิเสธคำขอของ ' + p.name + '?')) return;
              call = callApi({ action: 'rejectPending', targetName: p.name });
            }
          } else {
            var q = ADM.requests[+card.dataset.q];
            if (act === 'qok') {
              var u = ADM.users.find(function (x) { return x.name === q.user; });
              var cur = u ? u.apps.slice() : [];
              if (cur.indexOf(q.app) < 0) cur.push(q.app);
              call = callApi({ action: 'patrolSetApps', targetName: q.user, apps: cur, reason: 'อนุมัติคำขอสิทธิ์จากศูนย์รวมงาน' });
            } else {
              call = callApi({ action: 'appRequestDismiss', targetName: q.user, app: q.app });
            }
          }
          card.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
          msg.className = 'hm-msg'; msg.textContent = 'กำลังบันทึก…';
          call.then(function (r) {
            if (r && r.ok) { msg.className = 'hm-msg ok'; msg.textContent = 'เรียบร้อย'; setTimeout(function () { tabReq(body); }, 600); }
            else { card.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = (r && (r.error || r.message)) || 'ไม่สำเร็จ'; }
          }).catch(function () { card.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
        };
      });
    }).catch(function () { failed(body, function () { tabReq(body); }); });
  }

  /* คำขอดาวน์โหลดหนังสือ (จากหน้าอ่านหนังสือ pea-drawings/reader.html) */
  function tabBooks(body) {
    loading(body);
    refreshAdminCount().then(function () {
      setTabLabel('books', 'ขอดาวน์โหลดหนังสือ' + (ADM.books.length ? ' (' + ADM.books.length + ')' : ''));
      var ST = { approved: 'อนุมัติแล้ว', denied: 'ไม่อนุมัติ', revoked: 'ยกเลิกสิทธิ์แล้ว', expired: 'หมดอายุ' };
      var card = function (q, done) {
        return '<div class="hm-card" data-row="' + q.row + '"><div class="hm-row"><div class="hm-name">' + esc(q.user) + '</div><div class="hm-muted">' + esc(q.at) + '</div></div>' +
          '<div>ขอดาวน์โหลด: <b>' + esc(q.title || ('เล่ม ' + q.book)) + '</b> · ' + (q.days ? q.days + ' วัน' : 'ถาวร') + '</div>' +
          '<div class="hm-muted">เหตุผล: ' + esc(q.reason || '-') + '</div>' +
          (done ? '<div class="hm-row"><div class="hm-muted" style="flex:1">' + esc(ST[q.status] || q.status) + (q.by ? ' โดย ' + esc(q.by) : '') + (q.status === 'approved' ? ' · ' + (q.expires ? 'ถึง ' + esc(q.expires) : 'ถาวร') : '') + '</div>' +
              (q.status === 'approved' ? '<button class="hm-btn no" type="button" data-d="revoke">ยกเลิกสิทธิ์</button>' : '') + '</div>'
            : '<div class="hm-row" style="justify-content:flex-end"><button class="hm-btn no" type="button" data-d="deny">ไม่อนุมัติ</button><button class="hm-btn ok" type="button" data-d="approve">อนุมัติ</button></div>') +
          '<div class="hm-msg"></div></div>';
      };
      var h = ADM.books.length ? '<div class="hm-sec">รออนุมัติ</div>' + ADM.books.map(function (q) { return card(q, false); }).join('') : '<div class="hm-empty">ไม่มีคำขอค้าง</div>';
      if ((ADM.booksRecent || []).length) h += '<div class="hm-sec">ล่าสุด</div>' + ADM.booksRecent.map(function (q) { return card(q, true); }).join('');
      body.innerHTML = h;
      body.querySelectorAll('[data-d]').forEach(function (b) {
        b.onclick = function () {
          var c = b.closest('.hm-card'), msg = c.querySelector('.hm-msg'), d = b.dataset.d;
          if (d !== 'approve' && !confirm(d === 'deny' ? 'ไม่อนุมัติคำขอนี้?' : 'ยกเลิกสิทธิ์ดาวน์โหลดนี้?')) return;
          c.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); msg.className = 'hm-msg'; msg.textContent = 'กำลังบันทึก…';
          callApi({ action: 'bookDlDecide', row: +c.dataset.row, decision: d }).then(function (r) {
            if (r && r.ok) { msg.className = 'hm-msg ok'; msg.textContent = 'เรียบร้อย'; setTimeout(function () { tabBooks(body); }, 600); }
            else { c.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = (r && (r.error || r.message)) || 'ไม่สำเร็จ'; }
          }).catch(function () { c.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
        };
      });
    }).catch(function () { failed(body, function () { tabBooks(body); }); });
  }

  /* ---------- 👥 ผู้ใช้ (แบบใหม่ ก.พ. — รออนุมัติบนสุด · แถบสิทธิ์ · สวิตช์ระงับ · หน้าต่างแก้ไข) ---------- */
  var GROUPS = [['⚡ ระบบไฟฟ้า', ['sld', 'tx-survey', 'patrol', 'tree', 'analytics', 'damage']], ['🏗️ ก่อสร้าง / แบบ', ['construction', 'drawings']], ['📁 สำนักงาน', ['procure', 'tfbuy', 'booknum', 'budget', 'dutyroster', 'vehicle']]];
  var UF = { f: 'all', q: '' };
  // โปรแกรมที่ตรวจสิทธิ์รายโปรแกรมจริง (pea-hub.js ไม่มี data-perm="login"/data-gate="off" หรือหลังบ้านบล็อกการบันทึก) — เพิ่มเมื่อเปิดล็อกโปรแกรมใหม่
  var ENFORCED = ['dutyroster', 'drawings', 'patrol', 'procure', 'tfbuy', 'damage'];
  var COLS = ['#4b2e83', '#2a9d8f', '#e8962e', '#2563eb', '#c2410c', '#7c5cc4', '#0f766e', '#be185d'];
  function avc(s) { var h = 0; String(s).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) | 0; }); return COLS[Math.abs(h) % COLS.length]; }
  function ini(n) { return String(n || '?').replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').trim().charAt(0) || '?'; }
  function isMe(u) { return CURRENT_USER && String(u.name).toLowerCase() === String(CURRENT_USER.name).toLowerCase(); }
  function nApps(u) { return u.role === 'admin' ? APP_LIST.length : u.apps.length; }
  var UFL = {
    all: ['ทั้งหมด', function (u) { return true; }], act: ['ใช้งานอยู่', function (u) { return !u.disabled; }],
    off: ['ระงับ', function (u) { return u.disabled; }], adm: ['ผู้ดูแลระบบ', function (u) { return u.role === 'admin'; }]
  };
  function tabUsers(body) {
    loading(body);
    Promise.all([loadUsers(), refreshAdminCount()]).then(function () { drawUsers(body); }).catch(function () { failed(body, function () { tabUsers(body); }); });
  }
  function drawUsers(body) {
    var users = ADM.users, pend = ADM.pending;
    body.innerHTML = '<div class="hu-top"><input class="hm-search" id="hmQ" placeholder="🔍 ค้นหาชื่อ / ตำแหน่ง" value="' + esc(UF.q) + '"><button class="hm-btn pri" type="button" data-a="new">＋ เพิ่มผู้ใช้</button></div>' +
      '<div class="hu-chips">' + Object.keys(UFL).map(function (k) { var c = users.filter(UFL[k][1]).length; return '<button type="button" data-f="' + k + '" class="' + (UF.f === k ? 'on' : '') + '"><b>' + c + '</b>' + UFL[k][0] + '</button>'; }).join('') +
      (pend.length ? '<span class="hu-pc"><b>' + pend.length + '</b>รออนุมัติ</span>' : '') + '</div>' +
      (pend.length ? '<div class="hu-pend"><h4>⏳ สมัครใหม่ ' + pend.length + ' คน — อนุมัติแล้วใช้ได้ทุกโปรแกรม (แก้ทีหลังได้)</h4>' + pend.map(function (p, i) {
        return '<div class="hu-pr" data-i="' + i + '"><div class="hu-av" style="background:' + avc(p.name) + '">' + esc(ini(p.name)) + '</div><div class="hu-nm"><b>' + esc(p.name) + '</b><small>สมัคร ' + esc(p.timestamp) + '</small></div>' +
          '<span class="hu-seg"><button type="button" data-r="member" class="on">สมาชิก</button><button type="button" data-r="admin">ผู้ดูแลระบบ</button></span>' +
          '<button class="hm-btn ok" type="button" data-a="ok">✓ อนุมัติ</button><button class="hm-btn no" type="button" data-a="rej" title="ปฏิเสธ">✕</button><div class="hm-msg"></div></div>';
      }).join('') + '</div>' : '') +
      '<div class="hu-tbl" id="huT"></div>';
    var T = $('huT');
    function rows() {
      var q = UF.q.trim().toLowerCase();
      var a = users.filter(UFL[UF.f][1]).filter(function (u) { return !q || (u.name + ' ' + (u.position || '') + ' ' + (u.org || '')).toLowerCase().indexOf(q) >= 0; })
        .sort(function (x, y) { return (x.disabled - y.disabled) || ((x.role === 'admin' ? 0 : 1) - (y.role === 'admin' ? 0 : 1)) || x.name.localeCompare(y.name, 'th'); });
      T.innerHTML = '<div class="hu-tr hu-h"><span>ผู้ใช้</span><span>บทบาท</span><span>สิทธิ์โปรแกรม</span><span>ใช้งาน</span><span></span></div>' + (a.length ? a.map(function (u) {
        var n = nApps(u), tot = APP_LIST.length, me = isMe(u);
        return '<div class="hu-tr' + (u.disabled ? ' off' : '') + '" data-u="' + esc(u.name) + '"><div class="hu-u"><div class="hu-av" style="background:' + (u.disabled ? '#aaa' : avc(u.name)) + '">' + esc(ini(u.name)) + '</div><div class="hu-nm"><b>' + esc(u.name) + (me ? ' <em>(คุณ)</em>' : '') + '</b><small>' + esc([u.position, u.org].filter(Boolean).join(' · ') || (u.disabled ? 'ระงับไว้' : '')) + '</small></div></div>' +
          '<span><span class="hu-rl ' + (u.role === 'admin' ? 'a">👑 ผู้ดูแลระบบ' : 'm">สมาชิก') + '</span></span>' +
          '<div class="hu-bar"><i><u style="width:' + (u.disabled ? 0 : Math.round(n * 100 / Math.max(1, tot))) + '%"></u></i><span>' + (u.disabled ? 'ระงับ' : u.role === 'admin' || n >= tot ? 'ทุกโปรแกรม' : n ? n + ' จาก ' + tot : 'ยังไม่มี') + '</span></div>' +
          '<span><button type="button" class="hu-sw' + (u.disabled ? '' : ' on') + '" data-a="tg"' + (me ? ' disabled' : '') + ' title="' + (u.disabled ? 'ระงับอยู่ — กดเพื่อเปิด' : 'ใช้งานอยู่ — กดเพื่อระงับ') + '"></button></span><span class="hu-ed">✏️ แก้ไข</span></div>';
      }).join('') : '<div class="hm-empty">ไม่พบผู้ใช้</div>');
    }
    rows();
    $('hmQ').oninput = function () { UF.q = this.value; rows(); };
    body.onclick = function (e) {
      var b = e.target.closest('button,[data-u]'); if (!b || !body.contains(b)) return;
      if (b.dataset.f) { UF.f = b.dataset.f; drawUsers(body); return; }
      if (b.dataset.r) { Array.prototype.forEach.call(b.parentNode.children, function (x) { x.classList.toggle('on', x === b); }); return; }
      var a = b.dataset.a;
      if (a === 'new') return editUser(null, body);
      var pr = b.closest('.hu-pr');
      if (pr && (a === 'ok' || a === 'rej')) {
        var p = pend[+pr.dataset.i], msg = pr.querySelector('.hm-msg');
        if (a === 'rej' && !confirm('ปฏิเสธคำขอของ ' + p.name + '?')) return;
        var role = pr.querySelector('.hu-seg .on').dataset.r;
        pr.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); msg.className = 'hm-msg'; msg.textContent = 'กำลังบันทึก…';
        callApi(a === 'ok' ? { action: 'approvePending', targetName: p.name, approvedRole: role, approvedApps: appCodes() } : { action: 'rejectPending', targetName: p.name }).then(function (r) {
          if (r && r.ok) tabUsers(body); else { pr.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = (r && (r.error || r.message)) || 'ไม่สำเร็จ'; }
        }).catch(function () { pr.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
        return;
      }
      var row = b.closest('[data-u]'); if (!row || row.classList.contains('hu-h')) return;
      var u = users.find(function (x) { return x.name === row.dataset.u; }); if (!u) return;
      if (a === 'tg') {
        e.stopPropagation(); if (b.disabled) return;
        var off = !u.disabled;
        if (off && !confirm('ระงับ ' + u.name + '?\nเข้าระบบไม่ได้ทุกโปรแกรมจนกว่าจะเปิดอีกครั้ง (บัญชีและสิทธิ์เดิมยังอยู่)')) return;
        b.disabled = true; b.classList.toggle('on', !off);
        saveUser({ targetName: u.name, role: u.role, disabled: off }).then(function () { u.disabled = off; rows(); }, function (err) { alert(err); b.disabled = false; b.classList.toggle('on', off); });
        return;
      }
      editUser(u, body);
    };
  }
  function saveUser(p) {
    return callApi(Object.assign({ action: 'hubUserSave' }, p)).then(function (r) { if (!r || !r.ok) throw ((r && (r.error || r.message)) || 'บันทึกไม่สำเร็จ'); return r; }, function () { throw 'เชื่อมต่อไม่ได้'; });
  }
  /* หน้าต่างแก้ไข/เพิ่มผู้ใช้ */
  function editUser(u, body) {
    var isNew = !u, E = u ? { name: u.name, role: u.role, position: u.position || '', org: u.org || '', disabled: !!u.disabled, apps: u.role === 'admin' ? appCodes() : u.apps.slice() } : { name: '', role: 'member', position: '', org: '', disabled: false, apps: appCodes() };
    var me = u && isMe(u);
    var d = document.createElement('div'); d.className = 'hu-dw';
    var grouped = {}; GROUPS.forEach(function (g) { g[1].forEach(function (c) { grouped[c] = 1; }); });
    var groups = GROUPS.map(function (g) { return [g[0], g[1].filter(function (c) { return APP_LIST.some(function (a) { return a.code === c; }); })]; });
    var rest = APP_LIST.filter(function (a) { return !grouped[a.code]; }).map(function (a) { return a.code; });
    if (rest.length) groups.push(['📦 อื่นๆ', rest]);
    d.innerHTML = '<div class="hu-dm"></div><div class="hu-dr"><h3>' + (isNew ? '＋ เพิ่มผู้ใช้' : '✏️ ' + esc(u.name)) + '<button type="button" class="hu-x">✕</button></h3>' +
      '<div class="hu-s">' + (isNew ? 'ระบบสร้างรหัสผ่านให้ — ส่งให้เจ้าตัวใช้เข้าระบบ' : (u.appsUpdated ? 'แก้สิทธิ์ล่าสุด ' + esc(u.appsUpdated) : '')) + '</div>' +
      (isNew ? '<p class="hu-lb">ชื่อ-นามสกุล (ใช้ล็อกอิน)</p><input data-k="name" placeholder="เช่น สมชาย ใจดี" autocomplete="off">' : '') +
      '<div class="hu-two"><div><p class="hu-lb">ตำแหน่ง</p><input data-k="position" value="' + esc(E.position) + '" placeholder="เช่น พชง.6"></div><div><p class="hu-lb">หน่วยงาน / แผนก</p><input data-k="org" value="' + esc(E.org) + '" placeholder="เช่น ผปร."></div></div>' +
      '<p class="hu-lb">บทบาท</p><div class="hu-roles"><button type="button" data-role="admin"' + (me ? ' disabled' : '') + '><b>👑 ผู้ดูแลระบบ</b>ใช้ได้ทุกโปรแกรม + จัดการผู้ใช้</button><button type="button" data-role="member"' + (me ? ' disabled' : '') + '><b>สมาชิก</b>ใช้ได้เฉพาะโปรแกรมที่เลือก</button></div>' +
      '<div class="hu-appsw"><p class="hu-lb"><span>โปรแกรมที่ใช้ได้ (<span class="hu-n"></span>)</span><span style="margin-left:auto"><a data-all="1">เลือกทั้งหมด</a> · <a data-all="0">ล้าง</a></span></p>' +
      groups.map(function (g) { return '<div class="hu-grp">' + g[0] + '</div><div class="hu-apps">' + g[1].map(function (c) { return '<button type="button" data-app="' + esc(c) + '"' + (ENFORCED.indexOf(c) >= 0 ? ' title="โปรแกรมนี้ตรวจสิทธิ์จริง"' : ' class="soft" title="ยังไม่ตรวจสิทธิ์รายโปรแกรม — ล็อกอินแล้วเปิดได้"') + '>' + (ENFORCED.indexOf(c) >= 0 ? '🔒 ' : '') + esc(appName(c)) + '</button>'; }).join('') + '</div>'; }).join('') + '</div>' +
      '<div class="hu-legend">🔒 = ตรวจสิทธิ์จริง (ไม่ติ๊ก = เข้าไม่ได้) · ไม่มี 🔒 = ยังไม่ตรวจรายโปรแกรม ล็อกอินแล้วเปิดได้ · ปิด "เปิดใช้งาน" = เข้าไม่ได้ทุกโปรแกรมที่ใช้ล็อกอินศูนย์รวมงาน</div>' +
      '<div class="hu-adm-note">ผู้ดูแลระบบใช้ได้ทุกโปรแกรมเสมอ</div>' +
      (isNew ? '' : '<div class="hu-st"><div>✅ เปิดใช้งาน<small>ปิด = ระงับ เข้าระบบไม่ได้ทุกโปรแกรม (บัญชีไม่หาย)</small></div><button type="button" class="hu-sw" data-sw="1"' + (me ? ' disabled' : '') + '></button></div>') +
      (me ? '<div class="hu-warn">นี่คือบัญชีของคุณ — ลดสิทธิ์หรือระงับตัวเองไม่ได้</div>' : '') +
      '<div class="hu-act">' + (isNew ? '' : '<button type="button" class="hu-k" data-a="pw">🔑 ตั้งรหัสผ่านใหม่</button>') + '<button type="button" class="hu-sv" data-a="save">💾 ' + (isNew ? 'เพิ่มผู้ใช้' : 'บันทึก') + '</button></div><div class="hm-msg"></div>' +
      '<div class="hu-pw" hidden><p class="hu-lb">รหัสผ่านใหม่ของ ' + (u ? esc(u.name) : '') + '</p><input data-k="pw" autocomplete="off" autocapitalize="off"><div class="hu-act"><button type="button" class="hu-k" data-a="pwno">ยกเลิก</button><button type="button" class="hu-sv" data-a="pwok">ตั้งรหัสนี้</button></div><div class="hu-s">พิมพ์เองได้ (อย่างน้อย 4 ตัว) หรือใช้รหัสที่ระบบสุ่มให้ · เครื่องที่จำรหัสเดิมไว้ต้องล็อกอินใหม่</div></div></div>';
    document.body.appendChild(d);
    function paint() {
      d.querySelectorAll('[data-role]').forEach(function (b) { var on = b.dataset.role === E.role; b.classList.toggle('on', on); b.querySelector('b').textContent = (on ? '✓ ' : '') + (b.dataset.role === 'admin' ? '👑 ผู้ดูแลระบบ' : 'สมาชิก'); });
      d.querySelector('.hu-appsw').style.display = E.role === 'admin' ? 'none' : '';
      d.querySelector('.hu-adm-note').style.display = E.role === 'admin' ? '' : 'none';
      d.querySelector('.hu-legend').style.display = E.role === 'admin' ? 'none' : '';
      d.querySelectorAll('[data-app]').forEach(function (b) { b.classList.toggle('on', E.apps.indexOf(b.dataset.app) >= 0); });
      d.querySelector('.hu-n').textContent = E.apps.length + ' จาก ' + APP_LIST.length;
      var sw = d.querySelector('[data-sw]'); if (sw) sw.classList.toggle('on', !E.disabled);
    }
    paint();
    var msg = d.querySelector('.hm-msg');
    function close() { d.remove(); }
    function gen() { var c = 'abcdefghjkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < 8; i++) s += c.charAt(Math.floor(Math.random() * c.length)); return s; }
    d.addEventListener('input', function (e) { var k = e.target.dataset.k; if (k && k !== 'pw') E[k] = e.target.value; });
    d.addEventListener('click', function (e) {
      var t = e.target.closest('button,a,.hu-dm'); if (!t) return;
      if (t.classList.contains('hu-dm') || t.classList.contains('hu-x')) return close();
      if (t.dataset.role) { E.role = t.dataset.role; return paint(); }
      if (t.dataset.app) { var c = t.dataset.app, i = E.apps.indexOf(c); if (i >= 0) E.apps.splice(i, 1); else E.apps.push(c); return paint(); }
      if (t.dataset.all) { E.apps = t.dataset.all === '1' ? appCodes() : []; return paint(); }
      if (t.dataset.sw) { if (t.disabled) return; E.disabled = !E.disabled; return paint(); }
      var a = t.dataset.a;
      if (a === 'pw') { var box = d.querySelector('.hu-pw'); box.hidden = false; box.querySelector('input').value = gen(); box.querySelector('input').select(); box.scrollIntoView({ block: 'nearest' }); return; }
      if (a === 'pwno') { d.querySelector('.hu-pw').hidden = true; return; }
      if (a === 'pwok') {
        var pw = d.querySelector('[data-k=pw]').value.trim(); if (pw.length < 4) { alert('รหัสผ่านอย่างน้อย 4 ตัว'); return; }
        t.disabled = true;
        callApi({ action: 'hubUserResetPw', targetName: u.name, newPassword: pw }).then(function (r) {
          t.disabled = false;
          if (r && r.ok) { close(); showPw(u.name, r.tempPw, false); } else alert((r && (r.error || r.message)) || 'ไม่สำเร็จ');
        }).catch(function () { t.disabled = false; alert('เชื่อมต่อไม่ได้'); });
        return;
      }
      if (a === 'save') {
        if (isNew && !String(E.name).trim()) { msg.className = 'hm-msg err'; msg.textContent = 'กรุณาใส่ชื่อ-นามสกุล'; return; }
        if (E.role === 'member' && !E.apps.length && !confirm('ยังไม่ได้เลือกโปรแกรมเลย — บันทึกแบบยังใช้โปรแกรมใดไม่ได้?')) return;
        t.disabled = true; msg.className = 'hm-msg'; msg.textContent = 'กำลังบันทึก…';
        var call = isNew ? callApi({ action: 'hubUserAdd', newName: String(E.name).trim(), role: E.role, apps: E.apps, position: E.position, org: E.org }).then(function (r) { if (!r || !r.ok) throw ((r && (r.error || r.message)) || 'ไม่สำเร็จ'); return r; }, function () { throw 'เชื่อมต่อไม่ได้'; })
          : saveUser({ targetName: u.name, role: E.role, apps: E.apps, position: E.position, org: E.org, disabled: E.disabled });
        call.then(function (r) { close(); if (isNew) showPw(String(E.name).trim(), r.tempPw, true); tabUsers(body); }, function (err) { t.disabled = false; msg.className = 'hm-msg err'; msg.textContent = err; });
      }
    });
    setTimeout(function () { var f = d.querySelector(isNew ? '[data-k=name]' : '[data-k=position]'); if (f && isNew) f.focus(); }, 60);
  }
  function showPw(name, pw, isNew) {
    var text = 'ศูนย์รวมงาน กฟส.อ่าวลึก\nชื่อเข้าระบบ: ' + name + '\nรหัสผ่าน: ' + pw + '\nเข้าที่ ' + location.origin + '/';
    var d = document.createElement('div'); d.className = 'hu-dw';
    d.innerHTML = '<div class="hu-dm"></div><div class="hu-pop"><div style="font-size:30px">✅</div><b>' + (isNew ? 'เพิ่มผู้ใช้แล้ว' : 'ตั้งรหัสผ่านใหม่แล้ว') + '</b><div class="hu-s">ชื่อเข้าระบบ <b>' + esc(name) + '</b></div><div class="hu-code">' + esc(pw) + '</div><div class="hu-s" style="color:#b45309">แสดงครั้งเดียว — คัดลอกหรือส่งให้เจ้าตัวตอนนี้</div>' +
      '<div class="hu-act"><button type="button" class="hu-k" data-c="1">📋 คัดลอก</button><button type="button" class="hu-line" data-l="1">💬 ส่ง LINE</button></div><button type="button" class="hu-close">ปิด</button></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (t.dataset.c) { try { navigator.clipboard.writeText(text); t.textContent = '✓ คัดลอกแล้ว'; } catch (er) {} return; }
      if (t.dataset.l) { window.open('https://line.me/R/share?text=' + encodeURIComponent(text), '_blank'); return; }
      if (t.classList.contains('hu-close') || t.classList.contains('hu-dm')) d.remove();
    });
  }

  function tabStats(body) {
    var days = 1;
    function render(visits) {
      var since = days >= 3650 ? 0 : Date.now() - days * 86400000;
      if (days === 1) { var d0 = new Date(); d0.setHours(0, 0, 0, 0); since = d0.getTime(); }
      var vs = visits.filter(function (v) { return v.ts >= since; });
      var per = {}, users = {}, direct = 0;
      vs.forEach(function (v) {
        var p = per[v.app] || (per[v.app] = { portal: 0, direct: 0, app: 0 });
        p[v.src] = (p[v.src] || 0) + 1; users[v.user] = 1; if (v.src !== 'portal') direct++;
      });
      var rows = Object.keys(per).map(function (k) { var p = per[k]; return { k: k, p: p.portal || 0, d: p.direct || 0, a: p.app || 0, t: (p.portal || 0) + (p.direct || 0) + (p.app || 0) }; })
        .sort(function (a, b) { return b.t - a.t; });
      var srcName = { portal: 'ศูนย์รวม', direct: 'ลิงก์ตรง', app: 'ไอคอนบนจอ' };
      var tm = function (ts) { var d = new Date(ts); return (days > 1 ? d.getDate() + '/' + (d.getMonth() + 1) + ' ' : '') + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };
      var totalAll = Object.keys(STATS).map(function (k) { return { k: k, s: STATS[k] }; }).sort(function (a, b) { return b.s.count - a.s.count; });
      body.querySelector('#hmStatOut').innerHTML =
        '<div class="hm-kpi"><div><b>' + vs.length + '</b><span>ครั้งที่เปิด</span></div><div><b>' + Object.keys(users).length + '</b><span>คนที่เข้าใช้</span></div>' +
        '<div><b>' + (vs.length ? Math.round(direct * 100 / vs.length) : 0) + '%</b><span>ไม่ได้มาจากศูนย์รวม</span></div></div>' +
        (rows.length ? '<div class="hm-card"><table class="hm-tbl"><tr><th>โปรแกรม</th><th>ศูนย์รวม</th><th>ลิงก์ตรง</th><th>ไอคอน</th><th>รวม</th></tr>' +
          rows.map(function (r) { return '<tr><td>' + esc(appName(r.k)) + '</td><td class="c-p">' + r.p + '</td><td class="c-d">' + r.d + '</td><td class="c-a">' + r.a + '</td><td><b>' + r.t + '</b></td></tr>'; }).join('') + '</table></div>'
          : '<div class="hm-empty">ยังไม่มีการเข้าใช้ในช่วงนี้</div>') +
        (vs.length ? '<div class="hm-sec">เข้าใช้ล่าสุด</div><div class="hm-card" style="gap:0">' + vs.slice(0, 40).map(function (v) {
          return '<div class="hm-row" style="font-size:.85rem;padding:6px 0;border-bottom:1px solid #efeae0"><span class="hm-muted" style="width:72px">' + tm(v.ts) + '</span><span style="flex:1">' + esc(v.user) + ' · ' + esc(appName(v.app)) + '</span><span class="hm-muted">' + (srcName[v.src] || esc(v.src)) + '</span></div>';
        }).join('') + '</div>' : '') +
        '<div class="hm-sec">ยอดสะสมทั้งหมด (รวมก่อนเริ่มแยกที่มา)</div><div class="hm-card"><table class="hm-tbl"><tr><th>โปรแกรม</th><th>วันนี้</th><th>ทั้งหมด</th><th>ล่าสุด</th></tr>' +
        totalAll.map(function (x) { return '<tr><td>' + esc(appName(x.k)) + '</td><td>' + (x.s.today || 0) + '</td><td><b>' + x.s.count.toLocaleString() + '</b></td><td class="hm-muted">' + esc(x.s.lastUser || '') + '</td></tr>'; }).join('') + '</table></div>' +
        '<div class="hm-muted">แยกที่มาเริ่มนับตั้งแต่ 11 ต.ค. 2569 · โปรแกรมที่ยังไม่ได้ติดตัวนับใหม่ จะนับเฉพาะตอนกดจากศูนย์รวมงาน</div>';
    }
    body.innerHTML = '<div class="hm-seg" id="hmDays"><button type="button" data-d="1" class="on">วันนี้</button><button type="button" data-d="7">7 วัน</button><button type="button" data-d="30">30 วัน</button><button type="button" data-d="365">1 ปี</button></div><div id="hmStatOut"><div class="hm-empty">กำลังโหลด…</div></div>';
    var cache = {};
    function load() {
      var key = days <= 7 ? 7 : days;
      if (cache[key]) { render(cache[key]); return; }
      body.querySelector('#hmStatOut').innerHTML = '<div class="hm-empty">กำลังโหลด…</div>';
      api({ action: 'appVisits', days: key }).then(function (r) {
        cache[key] = (r && r.visits) || []; render(cache[key]);
      }).catch(function () { body.querySelector('#hmStatOut').innerHTML = '<div class="hm-empty">โหลดสถิติไม่ได้</div>'; });
    }
    body.querySelectorAll('#hmDays button').forEach(function (b) {
      b.onclick = function () { body.querySelectorAll('#hmDays button').forEach(function (x) { x.classList.toggle('on', x === b); }); days = +b.dataset.d; load(); };
    });
    load();
  }

  /* ---------------- ต่อกับ index.html ---------------- */
  window.hubAfterStats = function (stats, appList) {
    STATS = stats || {};
    if (appList && appList.length) APP_LIST = appList;
    decorateTiles();
  };
  window.hubOnLogin = function () {
    syncOutBtn();
    MY_APPS = null;
    if (!loggedIn()) { decorateTiles(); adminBtn.classList.remove('show'); admCard(-1); return; }
    try { var ca = JSON.parse(localStorage.getItem('pea_hub_auth') || 'null'); if (ca && ca.name === CURRENT_USER.name && Array.isArray(ca.apps)) { MY_APPS = ca.apps; decorateTiles(); } } catch (e) {}
    var wp = window.HUB_WHO_P ? window.HUB_WHO_P.then(function () { return window.HUB_WHO; }) : callApi({ action: 'whoAmI' });
    wp.then(function (r) {
      if (r && Array.isArray(r.apps)) MY_APPS = r.apps;
      decorateTiles();
    }).catch(function () {});
    refreshAdminCount().catch(function () {});
  };
  syncOutBtn();
})();
