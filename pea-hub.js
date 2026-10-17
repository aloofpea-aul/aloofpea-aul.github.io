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
  function api(payload) {
    var c = creds();
    var body = Object.assign({ changedBy: c.name, changedByPassword: c.pass }, payload);
    return fetch(gasUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
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
    return String(v || creds().name || '').slice(0, 60);
  }

  var counted = false;
  function countVisit() {
    if (counted || !APP) return;
    counted = true;
    var key = 'pea_hub_seen_' + APP, now = Date.now(), last = 0;
    try { last = parseInt(sessionStorage.getItem(key), 10) || 0; sessionStorage.setItem(key, String(now)); } catch (e) {}
    if (!fromHub && last && now - last < IDLE_MS) return;      // ยังอยู่ในการเปิดครั้งเดิม
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

  window.PEAHub = { app: APP, source: SRC, logout: logout, user: function () { return creds().name; } };
  start();
})();
