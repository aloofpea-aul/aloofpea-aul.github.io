/* pea-hub.js — ไฟล์กลางของศูนย์รวมงาน กฟส.อ่าวลึก
 * ใส่ในหน้าโปรแกรมใดก็ได้ในเว็บนี้ 1 บรรทัด (วางใน <head> ให้อยู่บนสุด):
 *   <script src="/pea-hub.js" data-app="drawings"></script>
 * ทำ 2 อย่าง
 *   1) ตรวจสิทธิ์ — ยังไม่ล็อกอินจะขึ้นกล่องเข้าสู่ระบบ/สมัคร · ไม่มีสิทธิ์จะขึ้นปุ่มขอสิทธิ์
 *      (ไม่ต้องการล็อกให้ใส่ data-gate="off" — จะนับอย่างเดียว · data-perm="login" = แค่ล็อกอินก็เข้าได้)
 *   2) นับการเข้าใช้ 1 ครั้งต่อการเปิดจริง แยกว่ามาจาก ศูนย์รวมงาน / ลิงก์ตรง / ไอคอนบนหน้าจอ
 *      เปิดจากศูนย์รวมงาน = นับทุกครั้ง · รีโหลดหรือเปลี่ยนหน้าในโปรแกรมเดิมภายใน 30 นาที = ไม่นับซ้ำ
 * ใช้ชื่อ/รหัสชุดเดียวกับศูนย์รวมงาน (จำไว้ในเครื่อง) — เข้าที่ไหนก่อนก็ได้ ที่อื่นเข้าได้เลย
 * หมายเหตุ: เว็บนี้อยู่บน GitHub Pages ที่เปิดสาธารณะ ระบบนี้กันการเปิดใช้ตามปกติ ไม่ใช่การเข้ารหัสไฟล์
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var APP = (me && me.dataset.app) || '';
  var GATE = !(me && me.dataset.gate === 'off');
  var LOGIN_ONLY = !!(me && me.dataset.perm === 'login');   // data-perm="login" = ล็อกอินศูนย์รวมงานก็ใช้ได้ ไม่ต้องขอสิทธิ์รายโปรแกรม
  var DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
  var K_USER = 'pea_aoluek_username', K_PASS = 'pea_aoluek_password', K_AUTH = 'pea_hub_auth';
  var IDLE_MS = 30 * 60 * 1000, CACHE_MS = 7 * 86400000;
  var HUB = '/index.html';

  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
  }
  function gasUrl() { return ls('sld_gas_url') || DEFAULT_GAS_URL; }
  function creds() { return { name: ls(K_USER) || '', pass: ls(K_PASS) || '' }; }
  function api(payload, keepalive) {
    var c = creds();
    var body = Object.assign({ changedBy: c.name, changedByPassword: c.pass }, payload);
    return fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), keepalive: !!keepalive })
      .then(function (r) { return r.json(); });
  }
  function readCache() { try { return JSON.parse(ls(K_AUTH) || 'null'); } catch (e) { return null; } }
  function canUse(auth) { return LOGIN_ONLY || !APP || !auth || !Array.isArray(auth.apps) || auth.apps.indexOf(APP) >= 0; }

  /* ---------- ที่มาของการเปิด ---------- */
  var params = new URLSearchParams(location.search);
  var fromHub = params.get('from') === 'hub';
  if (fromHub) {
    params.delete('from');
    var q = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var SRC = fromHub ? 'portal' : (standalone ? 'app' : 'direct');

  /* ชื่อผู้ใช้สำหรับการนับ — ถ้ายังไม่ได้ล็อกอินศูนย์รวมงาน ใช้ชื่อที่โปรแกรมนั้นจำไว้เอง
     (data-user-key = คีย์ใน localStorage, data-user-field = ชื่อฟิลด์ถ้าเก็บเป็น JSON) */
  function userHint() {
    var key = me && me.dataset.userKey, field = me && me.dataset.userField, v = key ? ls(key) : '';
    if (v && field) { try { v = (JSON.parse(v) || {})[field] || ''; } catch (e) { v = ''; } }
    return String(v || creds().name || '').replace(/\s+/g, ' ').trim().slice(0, 60);   // ชื่อจากชีตบางคนมีเว้นวรรคซ้ำ — รวมให้เป็นคนเดียวกัน
  }

  var counted = false;
  function countVisit() {
    if (counted || !APP) return;
    counted = true;
    var key = 'pea_hub_seen_' + APP, now = Date.now(), last = 0;
    try { last = parseInt(sessionStorage.getItem(key), 10) || 0; sessionStorage.setItem(key, String(now)); } catch (e) {}
    if (!fromHub && last && now - last < IDLE_MS) return;      // ยังอยู่ในการเปิดครั้งเดิม
    // ยังไม่รู้ชื่อเลย (เครื่องใหม่ ยังไม่ได้เข้าระบบ) แต่โปรแกรมจำชื่อเองได้ → รอให้เข้าระบบก่อนค่อยนับ จะได้มีชื่อ
    // รอได้ไม่เกิน 5 นาที หรือจนปิด/ออกจากหน้า (ส่งแบบ keepalive) — นับ 1 ครั้งเท่าเดิม
    if (!creds().name && !userHint() && me && me.dataset.userKey) {
      var sent = false, t0 = Date.now();
      var send = function (ka) {
        if (sent) return; sent = true; clearInterval(iv);
        api({ action: 'appOpen', app: APP, src: SRC, page: location.pathname, userHint: userHint() }, ka).catch(function () {});
      };
      var iv = setInterval(function () { if (userHint() || creds().name || Date.now() - t0 > 5 * 60000) send(false); }, 2000);
      window.addEventListener('pagehide', function () { send(true); });
      return;
    }
    // มีบัญชีศูนย์รวมงาน = นับพร้อมชื่อที่ยืนยันแล้ว · ไม่มี = หลังบ้านนับแบบ "ไม่ได้ยืนยันตัวตน" ด้วยชื่อจาก userHint
    api({ action: 'appOpen', app: APP, src: SRC, page: location.pathname, userHint: userHint() }).catch(function () {});
  }

  /* ---------- หน้าจอกั้น ---------- */
  var root = document.documentElement;
  var css = '' +
    'html.pea-lock body>*:not(#peaGate){visibility:hidden!important}' +
    '#peaGate{position:fixed;inset:0;z-index:2147483000;background:rgba(36,26,64,.92);display:flex;align-items:center;justify-content:center;padding:16px;' +
    'font-family:"Noto Sans Thai","Sarabun","Segoe UI",sans-serif;color:#222;-webkit-text-size-adjust:100%}' +
    '#peaGate .pg{background:#fff;border-radius:16px;width:100%;max-width:380px;padding:22px 20px;box-shadow:0 12px 40px rgba(0,0,0,.4);box-sizing:border-box}' +
    '#peaGate h2{margin:0 0 6px;font-size:18px;color:#4b2e83}' +
    '#peaGate p{margin:0 0 14px;font-size:13.5px;color:#555;line-height:1.6}' +
    '#peaGate .tabs{display:flex;gap:6px;margin-bottom:14px}' +
    '#peaGate .tabs button{flex:1;height:40px;border-radius:10px;border:1px solid #d8d0bf;background:#fff;color:#4b2e83;font:inherit;font-weight:700;cursor:pointer}' +
    '#peaGate .tabs button.on{background:#4b2e83;color:#fff;border-color:#4b2e83}' +
    '#peaGate label{display:block;font-size:13px;color:#555;margin:0 0 10px}' +
    '#peaGate input{display:block;width:100%;box-sizing:border-box;height:44px;margin-top:4px;border:1px solid #d8d0bf;border-radius:8px;padding:0 12px;font:inherit;font-size:16px}' +
    '#peaGate .go{width:100%;height:48px;border:0;border-radius:10px;background:#4b2e83;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer;margin-top:4px}' +
    '#peaGate .go:disabled{opacity:.6}' +
    '#peaGate .alt{width:100%;height:44px;border:1px solid #c9c1b0;border-radius:10px;background:#fff;color:#4b2e83;font:inherit;cursor:pointer;margin-top:8px}' +
    '#peaGate .msg{min-height:20px;font-size:13px;margin-top:10px;line-height:1.5}' +
    '#peaGate .msg.err{color:#c0392b}#peaGate .msg.ok{color:#2e7d32}' +
    '#peaGate .spin{width:34px;height:34px;border:4px solid #e3ddd0;border-top-color:#4b2e83;border-radius:50%;margin:8px auto;animation:peaSpin 1s linear infinite}' +
    '@keyframes peaSpin{to{transform:rotate(360deg)}}';
  function addStyle() {
    if (document.getElementById('peaGateCss')) return;
    var st = document.createElement('style'); st.id = 'peaGateCss'; st.textContent = css;
    (document.head || root).appendChild(st);
  }
  function lock() { addStyle(); root.classList.add('pea-lock'); }
  function unlock() {
    pending = null;
    root.classList.remove('pea-lock');
    var g = document.getElementById('peaGate'); if (g) g.remove();
  }
  function whenBody(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function appName() { return (me && me.dataset.name) || 'โปรแกรมนี้'; }
  /* แสดงหน้าจอกั้นล่าสุดเสมอ — ถ้าเรียกหลายครั้งก่อนหน้าเว็บโหลดเสร็จ จะวาดเฉพาะอันสุดท้าย */
  var pending = null, waiting = false;
  function gate(html, bind) {
    lock();
    pending = { html: html, bind: bind };
    if (waiting) return;
    waiting = true;
    whenBody(function () {
      waiting = false;
      var cur = pending; pending = null;
      if (!cur || !root.classList.contains('pea-lock')) return;
      var g = document.getElementById('peaGate');
      if (!g) { g = document.createElement('div'); g.id = 'peaGate'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); document.body.appendChild(g); }
      g.innerHTML = '<div class="pg">' + cur.html + '</div>';
      if (cur.bind) cur.bind(g);
    });
  }

  function showChecking() { gate('<div class="spin"></div><p style="text-align:center;margin:8px 0 0">กำลังตรวจสอบสิทธิ์…</p>'); }

  function showLogin(mode, note) {
    var c = creds();
    var reg = mode === 'register';
    gate('<h2>' + (reg ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ') + '</h2>' +
      '<p>' + (note ? esc(note) : (reg
        ? 'กรอกชื่อ-นามสกุลและตั้งรหัสผ่าน แล้วรอผู้ดูแลระบบอนุมัติ'
        : 'ใช้ชื่อและรหัสเดียวกับศูนย์รวมงาน เข้าครั้งเดียว ระบบจำไว้ในเครื่องนี้')) + '</p>' +
      '<div class="tabs"><button type="button" data-m="login" class="' + (reg ? '' : 'on') + '">เข้าสู่ระบบ</button>' +
      '<button type="button" data-m="register" class="' + (reg ? 'on' : '') + '">สมัครใหม่</button></div>' +
      '<form autocomplete="on">' +
      '<label>ชื่อ<input name="u" autocomplete="username" value="' + esc(reg ? '' : c.name) + '" required></label>' +
      '<label>รหัสผ่าน<input name="p" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" required></label>' +
      '<button class="go" type="submit">' + (reg ? 'ส่งคำขอสมัคร' : 'เข้าสู่ระบบ') + '</button>' +
      '<div class="msg"></div></form>' +
      '<button class="alt" type="button" data-hub>ไปหน้าศูนย์รวมงาน</button>', function (g) {
      g.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { showLogin(b.dataset.m); }; });
      g.querySelector('[data-hub]').onclick = function () { location.href = HUB; };
      var f = g.querySelector('form'), msg = g.querySelector('.msg'), btn = g.querySelector('.go');
      setTimeout(function () { (f.u.value ? f.p : f.u).focus(); }, 50);
      f.onsubmit = function (e) {
        e.preventDefault();
        var name = f.u.value.trim(), pass = f.p.value;
        if (!name || !pass) return;
        btn.disabled = true; msg.className = 'msg'; msg.textContent = 'กำลังตรวจสอบ…';
        var call = reg
          ? fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'register', newName: name, newPassword: pass }) }).then(function (r) { return r.json(); })
          : fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({ action: 'whoAmI', changedBy: name, changedByPassword: pass }) }).then(function (r) { return r.json(); });
        call.then(function (r) {
          btn.disabled = false;
          if (reg) {
            if (r && r.ok) {
              ls(K_USER, name); ls(K_PASS, pass);
              msg.className = 'msg ok';
              msg.textContent = 'ส่งคำขอแล้ว เมื่อผู้ดูแลระบบอนุมัติ เปิดหน้านี้อีกครั้งจะเข้าใช้ได้เลยโดยไม่ต้องกรอกใหม่';
            } else { msg.className = 'msg err'; msg.textContent = (r && r.error) || 'สมัครไม่สำเร็จ'; }
            return;
          }
          if (!r || !r.role) { msg.className = 'msg err'; msg.textContent = 'ชื่อหรือรหัสผ่านไม่ถูกต้อง หรือยังรอการอนุมัติ'; return; }
          ls(K_USER, name); ls(K_PASS, pass);
          decide(r);
        }).catch(function () {
          btn.disabled = false; msg.className = 'msg err'; msg.textContent = 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง';
        });
      };
    });
  }

  function showNoPerm(name) {
    gate('<h2>ยังไม่ได้รับสิทธิ์</h2>' +
      '<p>บัญชี <b>' + esc(name) + '</b> ยังไม่ได้รับสิทธิ์ใช้ ' + esc(appName()) + ' กดขอสิทธิ์ แล้วรอผู้ดูแลระบบเปิดให้</p>' +
      '<button class="go" type="button" data-req>ขอสิทธิ์</button>' +
      '<button class="alt" type="button" data-hub>กลับศูนย์รวมงาน</button>' +
      '<button class="alt" type="button" data-out>เปลี่ยนบัญชี</button>' +
      '<div class="msg"></div>', function (g) {
      var msg = g.querySelector('.msg'), b = g.querySelector('[data-req]');
      g.querySelector('[data-hub]').onclick = function () { location.href = HUB; };
      g.querySelector('[data-out]').onclick = function () { logout(true); };
      b.onclick = function () {
        b.disabled = true;
        api({ action: 'appRequest', app: APP }).then(function (r) {
          if (r && r.ok) { msg.className = 'msg ok'; msg.textContent = r.already ? 'ได้รับสิทธิ์แล้ว กำลังเปิด…' : 'ส่งคำขอแล้ว ผู้ดูแลระบบจะเห็นในหน้าจัดการผู้ใช้'; if (r.already) setTimeout(function () { location.reload(); }, 800); }
          else { b.disabled = false; msg.className = 'msg err'; msg.textContent = (r && (r.error || r.message)) || 'ส่งคำขอไม่สำเร็จ'; }
        }).catch(function () { b.disabled = false; msg.className = 'msg err'; msg.textContent = 'เชื่อมต่อไม่ได้'; });
      };
    });
  }

  /* r = ผลจาก whoAmI */
  function decide(r) {
    var auth = { name: creds().name, role: r.role, apps: Array.isArray(r.apps) ? r.apps : null, ts: Date.now() };
    ls(K_AUTH, JSON.stringify(auth));
    if (!GATE) { countVisit(); return; }
    if (!canUse(auth)) { showNoPerm(auth.name); return; }
    unlock(); countVisit();
  }

  function logout(showForm) {
    ls(K_PASS, null); ls(K_AUTH, null);
    if (showForm) showLogin('login'); else location.href = HUB;
  }

  /* ---------- เริ่มทำงาน ---------- */
  function start() {
    var c = creds();
    if (!GATE) {
      countVisit();
      if (c.name) api({ action: 'whoAmI' }).then(function (r) { if (r && r.role) decide(r); }).catch(function () {});
      return;
    }
    if (!c.name || !c.pass) { lock(); showLogin('login'); return; }
    var cache = readCache();
    var fresh = cache && cache.name === c.name && cache.role && Date.now() - (cache.ts || 0) < CACHE_MS;
    if (fresh && canUse(cache)) {
      countVisit();                              // เคยผ่านแล้ว เปิดได้ทันที แล้วตรวจซ้ำเบื้องหลัง
      api({ action: 'whoAmI' }).then(function (r) {
        if (!r || !r.ok) return;
        if (!r.role) { ls(K_AUTH, null); lock(); showLogin('login', 'รหัสผ่านถูกเปลี่ยนหรือบัญชีถูกระงับ กรุณาเข้าสู่ระบบใหม่'); return; }
        decide(r);
      }).catch(function () {});
      return;
    }
    lock(); showChecking();
    api({ action: 'whoAmI' }).then(function (r) {
      if (r && r.role) decide(r);
      else showLogin('login', 'ชื่อหรือรหัสผ่านที่จำไว้ใช้ไม่ได้แล้ว หรือยังรอการอนุมัติ');
    }).catch(function () {
      // ออฟไลน์/เครือข่ายมีปัญหา — ถ้าเคยผ่านแล้วให้ใช้ต่อได้ (ไม่ให้งานหน้างานสะดุด)
      if (cache && cache.name === c.name && cache.role && canUse(cache)) unlock();
      else showLogin('login', 'เชื่อมต่อเพื่อตรวจสอบสิทธิ์ไม่ได้ ลองใหม่เมื่อมีสัญญาณ');
    });
  }


  /* ---------- แถบกลับศูนย์รวมงาน (มือถือ/แท็บเล็ต) ----------
     แถบเล็กติดขอบซ้าย แตะแล้วมีแผง: กลับหน้าศูนย์รวม + สลับไปแอปที่ใช้บ่อย (รายการจากหน้าศูนย์รวม)
     ลากขึ้นลงได้ จำตำแหน่งแยกแต่ละแอป · ไม่แสดงบนคอม (คอมเปิดแอปเป็นแท็บใหม่อยู่แล้ว) */
  function homeDock() {
    try {
      if (window.top !== window.self) return;
      if (me && me.dataset.dock === 'off') return;
      if (location.pathname === '/' || location.pathname === HUB) return;
      var mq = window.matchMedia && matchMedia('(max-width:1099px), (pointer:coarse)');
      if (!mq || !mq.matches) return;
      if (document.getElementById('peaDock')) return;
      var css = document.createElement('style');
      css.textContent =
        '#peaDock{position:fixed;left:0;z-index:2147483000;width:28px;height:56px;border-radius:0 16px 16px 0;background:#3F1F7A;color:#FFC24B;' +
        'display:flex;align-items:center;justify-content:center;font:700 17px/1 sans-serif;box-shadow:0 6px 16px rgba(30,10,70,.35);opacity:.9;touch-action:none;' +
        'cursor:pointer;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:width .15s}' +
        '#peaDock:after{content:"";position:absolute;right:5px;top:50%;width:3px;height:20px;margin-top:-10px;border-radius:2px;background:rgba(255,255,255,.35)}' +
        '#peaDock.drag{width:34px;opacity:1}' +
        '#peaDim{position:fixed;inset:0;z-index:2147483001;background:rgba(20,10,40,.45);opacity:0;pointer-events:none;transition:opacity .2s}' +
        '#peaDim.on{opacity:1;pointer-events:auto}' +
        '#peaDrawer{position:fixed;left:0;top:0;bottom:0;z-index:2147483002;width:min(82vw,300px);background:#fff;border-radius:0 24px 24px 0;' +
        'box-shadow:10px 0 30px rgba(0,0,0,.2);transform:translateX(-105%);transition:transform .25s cubic-bezier(.2,.8,.2,1);overflow:auto;' +
        'font-family:"IBM Plex Sans Thai","Noto Sans Thai","Segoe UI",sans-serif;color:#2A2347;padding-bottom:env(safe-area-inset-bottom)}' +
        '#peaDrawer.on{transform:none}' +
        '#peaDrawer .pd-h{background:#3F1F7A;color:#fff;padding:calc(22px + env(safe-area-inset-top)) 18px 18px;position:relative;overflow:hidden}' +
        '#peaDrawer .pd-h:before{content:"";position:absolute;right:-50px;top:-60px;width:150px;height:150px;border-radius:50%;background:#5B33A6}' +
        '#peaDrawer .pd-h b{position:relative;display:block;font-size:16px}#peaDrawer .pd-h small{position:relative;font-size:12px;opacity:.85}' +
        '#peaDrawer .pd-home{display:flex;align-items:center;gap:10px;margin:14px 12px 6px;background:#FFC24B;color:#3F1F7A;border-radius:14px;padding:13px 14px;font-weight:700;font-size:15px;text-decoration:none}' +
        '#peaDrawer .pd-sh{font-size:12px;color:#8A84A3;font-weight:600;padding:12px 18px 6px}' +
        '#peaDrawer .pd-ap{display:flex;align-items:center;gap:11px;padding:8px 10px;margin:0 8px;border-radius:12px;font-size:14px;color:#2A2347;text-decoration:none}' +
        '#peaDrawer .pd-ap i{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:19px;flex:none}' +
        '#peaDrawer .pd-ap.cur{background:#F1EAFE}#peaDrawer .pd-ap em{margin-left:auto;font-style:normal;font-size:11px;color:#6D3FC0;font-weight:600}' +
        '#peaDrawer .pd-note{font-size:12px;color:#8A84A3;padding:6px 18px 16px;line-height:1.5}';
      document.head.appendChild(css);
      var key = 'pea_dock_y_' + (APP || location.pathname), y = parseFloat(ls(key));
      if (!(y >= 8 && y <= 92)) y = 47;
      var dock = document.createElement('div'); dock.id = 'peaDock'; dock.setAttribute('role', 'button'); dock.setAttribute('aria-label', 'กลับศูนย์รวมงาน / สลับแอป'); dock.textContent = '⌂';
      dock.style.top = 'calc(' + y + '% - 28px)';
      var dim = document.createElement('div'); dim.id = 'peaDim';
      var dr = document.createElement('nav'); dr.id = 'peaDrawer'; dr.setAttribute('aria-label', 'ศูนย์รวมงาน');
      document.body.appendChild(dock); document.body.appendChild(dim); document.body.appendChild(dr);
      function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
      function render() {
        var favs = []; try { favs = JSON.parse(ls('pea_hub_favs') || '[]') || []; } catch (e) {}
        var here = location.pathname.replace(/index\.html$/, '');
        var nm = creds().name || '';
        dr.innerHTML = '<div class="pd-h"><b>ศูนย์รวมงาน กฟส.อ่าวลึก</b><small>' + esc(nm || 'ยังไม่ได้เข้าสู่ระบบ') + '</small></div>' +
          '<a class="pd-home" href="' + HUB + '">🏠 กลับหน้าศูนย์รวมงาน</a>' +
          (favs.length ? '<div class="pd-sh">สลับไปแอปที่ใช้บ่อย</div>' + favs.map(function (f) {
            var cur = String(f.href || '').replace(/index\.html$/, '') === here;
            return '<a class="pd-ap' + (cur ? ' cur' : '') + '" href="' + esc(f.href) + '?from=hub"><i style="background:' + esc(f.tint || '#F1EAFE') + '">' + esc(f.icon) + '</i>' + esc(f.name) + (cur ? '<em>อยู่ที่นี่</em>' : '') + '</a>';
          }).join('') : '<div class="pd-note">เปิดหน้าศูนย์รวมงานสักครั้ง รายการแอปที่ใช้บ่อยจะมาแสดงที่นี่</div>') +
          '<div class="pd-note">แถบ ⌂ บังปุ่มของแอป? กดค้างแล้วลากขึ้นลงได้</div>';
      }
      function open() { render(); dim.classList.add('on'); dr.classList.add('on'); }
      function close() { dim.classList.remove('on'); dr.classList.remove('on'); }
      dim.addEventListener('click', close);
      dr.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a.cur'); if (a) { e.preventDefault(); close(); } });
      // แตะ = เปิดแผง · ลาก = ย้ายตำแหน่ง
      var sy = 0, moved = false, down = false;
      dock.addEventListener('pointerdown', function (e) { down = true; moved = false; sy = e.clientY; try { dock.setPointerCapture(e.pointerId); } catch (x) {} });
      dock.addEventListener('pointermove', function (e) {
        if (!down) return;
        if (!moved && Math.abs(e.clientY - sy) < 8) return;
        moved = true; dock.classList.add('drag');
        y = Math.max(8, Math.min(92, e.clientY / window.innerHeight * 100));
        dock.style.top = 'calc(' + y + '% - 28px)';
      });
      var lastDrag = 0;
      function up() { if (!down) return; down = false; dock.classList.remove('drag'); if (moved) { ls(key, String(Math.round(y))); lastDrag = Date.now(); } }
      dock.addEventListener('pointerup', up);
      dock.addEventListener('click', function (e) { e.preventDefault(); if (Date.now() - lastDrag < 400) return; open(); });
      dock.addEventListener('pointercancel', function () { down = false; dock.classList.remove('drag'); });
      window.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', homeDock); else homeDock();

  window.PEAHub = { app: APP, source: SRC, logout: logout, user: function () { return creds().name; } };
  start();
})();
