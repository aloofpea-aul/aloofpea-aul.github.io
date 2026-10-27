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
  var GATED = ['drawings', 'dutyroster'];
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
    if (!isAdmin()) { adminBtn.classList.remove('show'); return Promise.resolve(); }
    adminBtn.classList.add('show');
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
      return n;
    });
  }

  function openAdmin() {
    var body = modal('จัดการผู้ใช้', [
      { id: 'req', label: 'คำขอใหม่' }, { id: 'books', label: 'ขอดาวน์โหลดหนังสือ' }, { id: 'users', label: 'ผู้ใช้ทั้งหมด' }, { id: 'stats', label: 'สถิติการเข้าใช้' }
    ], function (t) { ({ req: tabReq, books: tabBooks, users: tabUsers, stats: tabStats })[t](body); });
    tabReq(body);
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
      setTabLabel('req', 'คำขอใหม่ (' + (ADM.pending.length + ADM.requests.length) + ')');
      var h = '';
      if (!ADM.pending.length && !ADM.requests.length) { body.innerHTML = '<div class="hm-empty">ไม่มีคำขอค้าง</div>'; return; }
      if (ADM.pending.length) h += '<div class="hm-sec">สมัครเป็นผู้ใช้ใหม่</div>';
      ADM.pending.forEach(function (p, i) {
        h += '<div class="hm-card" data-i="' + i + '"><div class="hm-row"><div class="hm-name">' + esc(p.name) + '</div><div class="hm-muted">สมัคร ' + esc(p.timestamp) + '</div></div>' +
          '<div class="hm-muted">ให้ใช้โปรแกรม (ติ๊กไว้ทั้งหมด เอาออกได้)</div><div class="hm-apps">' +
          APP_LIST.map(function (a) { return '<label><input type="checkbox" value="' + esc(a.code) + '" checked>' + esc(a.name) + '</label>'; }).join('') +
          '</div><div class="hm-row"><label class="hm-row" style="flex:1;font-size:.85rem"><input type="checkbox" class="isAdm" style="width:18px;height:18px">เป็นผู้ดูแลระบบ</label>' +
          '<button class="hm-btn no" type="button" data-act="rej">ปฏิเสธ</button><button class="hm-btn ok" type="button" data-act="ok">อนุมัติ</button></div><div class="hm-msg"></div></div>';
      });
      if (ADM.requests.length) h += '<div class="hm-sec">ขอสิทธิ์ใช้โปรแกรมเพิ่ม</div>';
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

  function tabUsers(body) {
    loading(body);
    loadUsers().then(function (users) {
      body.innerHTML = '<input class="hm-search" placeholder="ค้นหาชื่อ" id="hmQ">' +
        '<div class="hm-muted">แตะชื่อโปรแกรมเพื่อเปิด/ปิดสิทธิ์ทันที (สีม่วง = ใช้ได้) · ผู้ดูแลระบบใช้ได้ทุกโปรแกรมเสมอ</div><div id="hmUsers"></div>';
      var list = $('hmUsers');
      function draw() {
        var q = $('hmQ').value.trim().toLowerCase();
        list.innerHTML = users.filter(function (u) { return !q || u.name.toLowerCase().indexOf(q) >= 0; }).map(function (u) {
          var adm = u.role === 'admin';
          var meta = adm ? 'ผู้ดูแลระบบ' : (u.appsRaw === '-' ? 'ระงับ (ไม่มีโปรแกรมที่ใช้ได้)' : (u.appsRaw ? 'สมาชิก' : 'สมาชิก · ยังไม่เคยกำหนด = ใช้ได้ทุกโปรแกรม'));
          return '<div class="hm-card" style="margin-bottom:8px" data-u="' + esc(u.name) + '"><div class="hm-row"><div class="hm-name">' + esc(u.name) + '</div><div class="hm-muted">' + esc(meta) + '</div></div>' +
            '<div class="hm-chips">' + APP_LIST.map(function (a) {
              var on = u.apps.indexOf(a.code) >= 0;
              return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-app="' + esc(a.code) + '"' + (adm ? ' disabled' : '') + ' aria-pressed="' + on + '">' + esc(a.name) + '</button>';
            }).join('') + '</div>' + (u.appsUpdated ? '<div class="hm-muted">แก้สิทธิ์ล่าสุด ' + esc(u.appsUpdated) + '</div>' : '') + '<div class="hm-msg"></div></div>';
        }).join('') || '<div class="hm-empty">ไม่พบชื่อ</div>';
        list.querySelectorAll('.chip:not([disabled])').forEach(function (c) {
          c.onclick = function () {
            var card = c.closest('.hm-card'), name = card.dataset.u, msg = card.querySelector('.hm-msg');
            var u = users.find(function (x) { return x.name === name; });
            var on = !c.classList.contains('on');
            var next = u.apps.filter(function (x) { return x !== c.dataset.app; });
            if (on) next.push(c.dataset.app);
            c.disabled = true; msg.className = 'hm-msg'; msg.textContent = 'กำลังบันทึก…';
            callApi({ action: 'patrolSetApps', targetName: name, apps: next, reason: 'แก้จากศูนย์รวมงาน' }).then(function (r) {
              c.disabled = false;
              if (r && r.ok) { u.apps = r.apps || next; u.appsRaw = u.apps.length ? u.apps.join(',') : '-'; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); msg.className = 'hm-msg ok'; msg.textContent = (on ? 'เปิด ' : 'ปิด ') + appName(c.dataset.app) + ' แล้ว'; }
              else { msg.className = 'hm-msg err'; msg.textContent = (r && (r.error || r.message)) || 'ไม่สำเร็จ'; }
            }).catch(function () { c.disabled = false; msg.className = 'hm-msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
          };
        });
      }
      $('hmQ').oninput = draw;
      draw();
    }).catch(function () { failed(body, function () { tabUsers(body); }); });
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
    if (!loggedIn()) { decorateTiles(); adminBtn.classList.remove('show'); return; }
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
