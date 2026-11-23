/* ช่องค้นหาทุกช่อง (CCL + โปรแกรมผู้รับจ้าง)
   - แตะ/คลิกช่องค้นหา → เลือกข้อความเดิมทั้งหมด พิมพ์ใหม่ทับได้เลย ไม่ต้องลบก่อน
   - มีปุ่ม ✕ ล้างข้อความ และกด Esc เพื่อล้าง */
(function () {
  'use strict';
  function isSearch(el) {
    if (!el || el.tagName !== 'INPUT' || el.readOnly || el.disabled) return false;
    var t = (el.type || 'text').toLowerCase();
    if (t !== 'text' && t !== 'search') return false;
    return t === 'search' || /search|srch|filter|find|kw|\bq\b/i.test((el.id || '') + ' ' + (el.className || '') + ' ' + (el.name || '')) || /ค้นหา|🔍/.test(el.placeholder || '');
  }
  function fire(el) { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('keyup', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }

  var st = document.createElement('style');
  st.textContent = '.sux-x{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:50%;background:#E2E8F0;color:#475569;font-size:13px;line-height:24px;text-align:center;cursor:pointer;display:none;padding:0;z-index:2}' +
    '.sux-x:hover{background:#CBD5E1}.sux-x.on{display:block}input.sux-pad{padding-right:36px!important}' +
    'input[type=search]::-webkit-search-cancel-button{display:none}';
  document.head.appendChild(st);

  function addX(el) {
    if (el.__suxX) return el.__suxX;
    var p = el.parentNode; if (!p || p.nodeType !== 1) return null;
    var pr = p.getBoundingClientRect(), er = el.getBoundingClientRect();
    if (getComputedStyle(p).position === 'static' || !er.width || pr.width - er.width > 40 || Math.abs(pr.right - er.right) > 20) { el.__suxX = false; return null; } // ช่องไม่เต็มกรอบ → ไม่ใส่ ✕ (ยังเลือกข้อความทั้งหมดได้)
    var b = document.createElement('button'); b.type = 'button'; b.className = 'sux-x'; b.setAttribute('aria-label', 'ล้างคำค้นหา'); b.textContent = '✕';
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); el.value = ''; fire(el); el.focus(); sync(el); });
    el.insertAdjacentElement('afterend', b); el.classList.add('sux-pad');
    el.__suxX = b; return b;
  }
  function sync(el) { var b = el.__suxX; if (b) b.classList.toggle('on', !!el.value); }

  var justFocused = null;
  document.addEventListener('focusin', function (e) {
    var el = e.target; if (!isSearch(el)) return;
    addX(el); sync(el);
    if (el.value) { justFocused = el; setTimeout(function () { try { el.select(); } catch (x) {} }, 0); }
  });
  // กันคลิกแรกยกเลิกการเลือกข้อความ (Safari/Chrome)
  document.addEventListener('mouseup', function (e) { if (justFocused && e.target === justFocused) { e.preventDefault(); } justFocused = null; }, true);
  document.addEventListener('input', function (e) { if (isSearch(e.target)) { addX(e.target); sync(e.target); } }, true);
  document.addEventListener('keydown', function (e) {
    var el = e.target; if (e.key !== 'Escape' || !isSearch(el) || !el.value) return;
    el.value = ''; fire(el); sync(el);
  });
  // แสดง ✕ ให้ช่องที่มีคำค้นอยู่แล้ว (เช่น ค่าที่ระบบใส่ไว้)
  setInterval(function () {
    Array.prototype.forEach.call(document.querySelectorAll('input'), function (el) { if (el.value && isSearch(el) && el.offsetParent) { addX(el); sync(el); } else if (el.__suxX) sync(el); });
  }, 1500);
})();
