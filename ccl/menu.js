/* CCL — จัดเมนูให้กระชับ (12 → 10 เมนู) ไม่ลบหน้าใด ๆ
   - "แผนที่ตรวจรับ" เอาออกจากแถบเมนูบน (ซ้ำกับปุ่ม "แผนที่ตรวจงาน" ในหน้าตรวจรับงาน / มือถือยังมีปุ่มแผนที่ที่แถบล่าง)
   - "ส่งปิดงาน" + "งานแล้วเสร็จ" รวมเป็นเมนู "ปิดงาน" มีแท็บย่อย รอปิดงาน / ปิดงานแล้ว */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }

  function setLabel(btn, text) {
    if (!btn) return;
    Array.prototype.forEach.call(btn.childNodes, function (n) { if (n.nodeType === 3 && n.textContent.trim()) n.textContent = text; });
  }

  function tabs(cur) {
    var cnt = function (id) { var b = $(id); var n = b ? (b.textContent || '').trim() : ''; return n && n !== '0' ? ' <span class="cm-n">' + n + '</span>' : ''; };
    return '<div class="cm-seg" role="tablist">' +
      '<button type="button" role="tab" data-p="close" class="' + (cur === 'close' ? 'on' : '') + '"><i class="fa-solid fa-paper-plane"></i> รอปิดงาน' + cnt('badge-close') + '</button>' +
      '<button type="button" role="tab" data-p="completed" class="' + (cur === 'completed' ? 'on' : '') + '"><i class="fa-solid fa-circle-check"></i> ปิดงานแล้ว' + cnt('completedBadge') + '</button></div>';
  }

  function placeTabs() {
    ['close', 'completed'].forEach(function (id) {
      var pg = $('page-' + id); if (!pg) return;
      var bar = pg.querySelector('.cm-seg-wrap');
      if (!bar) { bar = document.createElement('div'); bar.className = 'cm-seg-wrap'; pg.insertBefore(bar, pg.firstChild); }
      bar.innerHTML = tabs(id);
      bar.onclick = function (e) { var b = e.target.closest('[data-p]'); if (b && b.dataset.p !== id && typeof window.showPage === 'function') window.showPage(b.dataset.p); };
    });
  }

  function setup() {
    if (!document.getElementById('cmCss')) {
      var st = document.createElement('style'); st.id = 'cmCss';
      st.textContent = '#nav-inspectMap,#nav-completed{display:none!important}' +
        '.cm-seg-wrap{margin:0 0 10px}.cm-seg{display:inline-flex;background:#e2e8f0;border-radius:12px;padding:4px;gap:4px;max-width:100%}' +
        '.cm-seg button{border:0;background:transparent;border-radius:9px;min-height:38px;padding:0 16px;font-size:14px;font-weight:700;color:#475569;cursor:pointer;white-space:nowrap}' +
        '.cm-seg button.on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
        '.cm-n{display:inline-block;min-width:20px;padding:0 6px;border-radius:999px;background:#ede9fe;color:#6d28d9;font-size:12px;line-height:20px;margin-left:2px}';
      document.head.appendChild(st);
    }
    setLabel($('nav-close'), 'ปิดงาน');
    placeTabs();
    var sp = window.showPage;
    if (typeof sp === 'function' && !sp.__menu) {
      var w = function (id) {
        var r = sp.apply(this, arguments);
        if (id === 'close' || id === 'completed') {
          placeTabs();
          var nb = $('nav-close'); if (nb) nb.classList.add('active');
        }
        return r;
      };
      Object.keys(sp).forEach(function (k) { w[k] = sp[k]; }); w.__menu = true; window.showPage = w;
    }
  }
  // รอให้ตัวห่ออื่น (เมนูมือถือ, ลดการโหลดซ้ำ) ติดตั้งก่อน แล้วค่อยห่อชั้นนอกสุด
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(setup, 0); });
  else setTimeout(setup, 0);
})();
