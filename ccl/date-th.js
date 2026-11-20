/* CCL — แสดงวันที่ในช่องเลือกวันที่เป็น วัน/เดือน/ปี พ.ศ. (เช่น 09/11/2569) ทุกช่องในระบบ
   ช่องวันที่ของเบราว์เซอร์แสดงตามภาษาเครื่อง (คอมตั้งภาษาอังกฤษจะขึ้น เดือน/วัน/ปี ค.ศ.)
   วิธีทำ: ซ่อนตัวหนังสือของช่องเดิม แล้ววางข้อความ วว/ดด/ปปปป ทับไว้ — ปฏิทินและค่าที่บันทึก (YYYY-MM-DD) เหมือนเดิมทุกอย่าง */
(function () {
  'use strict';
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

  function fmt(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    return m ? m[3] + '/' + m[2] + '/' + (parseInt(m[1], 10) + 543) : '';
  }

  function css() {
    if (document.getElementById('dthCss')) return;
    var st = document.createElement('style'); st.id = 'dthCss';
    st.textContent =
      '.dth-w{position:relative}' +
      '.dth-w>input[type=date]{color:transparent !important;-webkit-text-fill-color:transparent !important}' +
      '.dth-w>input[type=date]::-webkit-datetime-edit{color:transparent !important;-webkit-text-fill-color:transparent !important}' +
      '.dth-t{position:absolute;top:0;bottom:0;display:flex;align-items:center;pointer-events:none;white-space:nowrap;overflow:hidden}' +
      '.dth-t.ph{color:#94a3b8}' +
      '.dth-w:has(> input[type=date].hidden),.dth-w:has(> input[type=date][style*="display: none"]),.dth-w:has(> input[type=date][style*="display:none"]){display:none !important}';
    document.head.appendChild(st);
  }

  function decorate(inp) {
    if (inp.__dth || !inp.parentNode) return;
    inp.__dth = true;
    var cs0 = getComputedStyle(inp);
    // จำค่าก่อนซ่อนตัวหนังสือ (หลังห่อแล้วสีจะเป็นโปร่งใส)
    var C = { color: cs0.color, font: cs0.font, pl: (parseFloat(cs0.paddingLeft) || 0) + (parseFloat(cs0.borderLeftWidth) || 0), disp: cs0.display, flex: cs0.flex };
    var par = inp.parentNode, pcs = par.nodeType === 1 ? getComputedStyle(par) : null;
    var pw = par.nodeType === 1 ? par.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0) : 0;
    var full = inp.style.width === '100%' || /\bw-full\b/.test(inp.className) || (pw > 0 && inp.offsetWidth >= pw - 2);
    var isFlex = pcs && /flex/.test(pcs.display);
    var w = document.createElement('span');
    w.className = 'dth-w';
    w.style.display = (C.disp === 'block' || full) && !isFlex ? 'block' : 'inline-block';
    if (isFlex) { w.style.flex = full || parseFloat(cs0.flexGrow) > 0 ? '1 1 0%' : C.flex; w.style.minWidth = '0'; }
    else if (full) w.style.width = '100%';
    else if (inp.style.width) w.style.width = inp.style.width;
    if (inp.style.marginTop) { w.style.marginTop = inp.style.marginTop; inp.style.marginTop = '0'; }
    par.insertBefore(w, inp);
    w.appendChild(inp);
    if (full || isFlex || inp.style.width) inp.style.width = '100%';
    var t = document.createElement('span');
    t.className = 'dth-t';
    t.style.left = (C.pl || 10) + 'px';
    t.style.right = '36px';
    t.style.font = C.font;
    w.appendChild(t);
    function upd() {
      var v = fmt(desc.get.call(inp));
      t.textContent = v || 'วว/ดด/ปปปป';
      t.classList.toggle('ph', !v);
      t.style.color = v ? C.color : '';
    }
    // ตั้งค่าด้วยโค้ด (input.value = ...) ก็อัปเดตตาม
    try {
      Object.defineProperty(inp, 'value', {
        configurable: true,
        get: function () { return desc.get.call(this); },
        set: function (v) { desc.set.call(this, v); upd(); }
      });
    } catch (e) {}
    inp.addEventListener('input', upd);
    inp.addEventListener('change', upd);
    upd();
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type=date]')) decorate(root);
    Array.prototype.forEach.call(root.querySelectorAll('input[type=date]'), decorate);
  }

  function start() {
    css();
    scan(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
