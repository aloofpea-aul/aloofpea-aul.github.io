/* pw-eye.js — เติมปุ่ม "ตา" แสดง/ซ่อนรหัสผ่าน ให้ทุกช่องรหัสผ่านในหน้าอัตโนมัติ
 * โหลดผ่าน pea-hub.js (ทุกโปรแกรม) และหน้าศูนย์รวมงานโดยตรง
 * ไม่ต้องการให้ช่องไหนมีตา ใส่ data-eye="off" · ช่องที่มีปุ่มแสดงรหัสของตัวเองอยู่แล้วจะข้ามให้ */
(function () {
  'use strict';
  if (window.__pwEye) return; window.__pwEye = 1;
  var OPEN = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var SHUT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.1 6.1A17 17 0 002 12s3.6 7 10 7a10 10 0 005.9-1.9"/><path d="M9.9 9.9a3 3 0 004.2 4.2"/></svg>';
  var css = document.createElement('style');
  css.textContent = '.pw-eye-w{position:relative;display:block}.pw-eye-w>input{padding-right:46px!important;width:100%;box-sizing:border-box}' +
    '.pw-eye{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:44px;height:44px;min-height:0!important;border:none!important;background:none!important;color:#4A5470;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0!important;margin:0!important;border-radius:10px}' +
    '.pw-eye:focus-visible{outline:3px solid #9DB3FF}';
  (document.head || document.documentElement).appendChild(css);
  function hasOwn(inp) {
    if (inp.dataset.eye === 'off') return true;
    var p = inp.parentElement; if (!p) return true;
    var bs = p.querySelectorAll('button,[role=button],span[onclick],i[onclick]');
    for (var i = 0; i < bs.length; i++) {
      var a = (bs[i].getAttribute('onclick') || '') + ' ' + (bs[i].getAttribute('aria-label') || '') + ' ' + (bs[i].className || '');
      if (/toggle|pass|eye|แสดงรหัส/i.test(a)) return true;
    }
    return false;
  }
  function add(inp) {
    if (inp.__eye || inp.type !== 'password' || hasOwn(inp)) return;
    inp.__eye = 1;
    var w = document.createElement('span'); w.className = 'pw-eye-w';
    try { var cs = getComputedStyle(inp); w.style.marginTop = cs.marginTop; w.style.marginBottom = cs.marginBottom; inp.style.marginTop = '0'; inp.style.marginBottom = '0'; } catch (e0) {}
    inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'pw-eye';
    b.setAttribute('aria-label', 'แสดงรหัสผ่าน'); b.innerHTML = OPEN; b.tabIndex = 0;
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });   // ไม่ให้ช่องรหัสหลุดโฟกัส
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      inp.style.webkitTextSecurity = show ? 'none' : '';   // ช่องที่ใช้ -webkit-text-security แทนชนิด password
      b.innerHTML = show ? SHUT : OPEN;
      b.setAttribute('aria-label', show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน');
      try { var n = inp.value.length; inp.focus(); inp.setSelectionRange(n, n); } catch (e2) {}
    });
    w.appendChild(b);
    // ส่งฟอร์มแล้วให้กลับเป็นช่องรหัสเสมอ (เบราว์เซอร์จะได้จำรหัสถูกช่อง)
    if (inp.form) inp.form.addEventListener('submit', function () { inp.type = 'password'; inp.style.webkitTextSecurity = ''; b.innerHTML = OPEN; }, true);
  }
  function scan(root) {
    var list = (root && root.querySelectorAll ? root : document).querySelectorAll('input[type=password]');
    for (var i = 0; i < list.length; i++) add(list[i]);
  }
  function start() {
    scan(document);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'attributes') { var t = m.target; if (t.tagName === 'INPUT' && t.type === 'password') { if (t.__eye) { var eb = t.parentNode && t.parentNode.querySelector('.pw-eye'); t.style.webkitTextSecurity = ''; if (eb) { eb.innerHTML = OPEN; eb.setAttribute('aria-label', 'แสดงรหัสผ่าน'); } } else add(t); } }
        else for (var j = 0; j < m.addedNodes.length; j++) { var n = m.addedNodes[j]; if (n.nodeType === 1) { if (n.tagName === 'INPUT') add(n); else scan(n); } }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['type'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
