/* Contractor Portal — จอกว้าง (คอม/แท็บเล็ตแนวนอน ≥1024px): รายการงานซ้าย · รายละเอียดขวา (ส่วนที่ 4)
   - กดงานทางซ้าย → รายละเอียดขึ้นทางขวาทันที ไม่ต้องสลับหน้า/กดย้อนกลับ
   - เปิดมาเลือกงานแรกในรายการให้เลย · การ์ดที่เปิดอยู่มีกรอบเขียว
   - หน้าอัปเดต/วัสดุ เปิดเป็นหน้าต่างทางขวา (รายการซ้ายยังเห็นอยู่)
   จอแคบ (มือถือ) ทำงานเหมือนเดิมทุกอย่าง */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var W = 440, mq = window.matchMedia('(min-width:1024px)');
  var css = '@media(min-width:1024px){' +
    'body.ctsp #appScreen{width:' + W + 'px;border-right:1px solid #E2E8F0;min-height:100vh;box-sizing:border-box}' +
    'body.ctsp #jobList{display:block!important}' +
    'body.ctsp #ctBottomNav{width:' + W + 'px;right:auto}' +
    'body.ctsp #detailPanel{left:' + W + 'px;transform:none!important;transition:none;z-index:120}' +
    'body.ctsp #detailPanel .app-header > button:first-child{visibility:hidden}' +
    'body.ctsp #detailContent{max-width:860px;margin:0 auto}' +
    'body.ctsp #updateSheet,body.ctsp #matPanel{left:' + W + 'px!important;max-width:none}' +
    'body.ctsp #updateSheet{max-height:92vh;overflow-y:auto}' +
    'body.ctsp #sheetOverlay,body.ctsp #matOverlay{left:' + W + 'px!important}' +
    'body.ctsp .jx .qa{display:none}' + // ปุ่มลัดซ้ำกับปุ่มใหญ่ทางขวา → ซ่อนบนจอกว้าง
    'body.ctsp .jx.sel{border-color:#0D9488!important;background:#F0FDFA;box-shadow:0 0 0 2px #99F6E4}' +
    '.sp-emp{text-align:center;color:#94A3B8;padding:90px 20px;font-size:15px}.sp-emp i{display:block;font-style:normal;font-size:44px;margin-bottom:10px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function on() { return mq.matches && document.body.classList.contains('ctsp'); }
  function apply() { document.body.classList.toggle('ctsp', mq.matches); if (mq.matches && !window._curJob) empty(); }
  function empty() {
    var c = $('detailContent'), t = $('detailTitle'); if (!c) return;
    if (t) t.textContent = 'รายละเอียดงาน';
    c.innerHTML = '<div class="sp-emp"><i>👈</i>เลือกงานจากรายการทางซ้าย เพื่อดูรายละเอียดและอัปเดตงาน</div>';
  }
  function mark() {
    var id = window._curJob && window._curJob.id;
    Array.prototype.forEach.call(document.querySelectorAll('#jobList .jx'), function (c) {
      var m = /openDetail\((\d+)\)/.exec(c.getAttribute('onclick') || ''); c.classList.toggle('sel', !!m && Number(m[1]) === id);
    });
  }
  function autoPick() {
    if (!on() || window._curJob || /[?&]job=\d+/.test(location.search)) return;
    var c = document.querySelector('#jobList .jx'), m = c && /openDetail\((\d+)\)/.exec(c.getAttribute('onclick') || '');
    if (m) openDetail(Number(m[1]));
  }

  var oRJ = window.renderJobs;
  if (typeof oRJ === 'function') window.renderJobs = function () { var r = oRJ.apply(this, arguments); setTimeout(function () { autoPick(); mark(); }, 0); return r; };
  var oOD = window.openDetail;
  if (typeof oOD === 'function') window.openDetail = function () { var r = oOD.apply(this, arguments); mark(); if (on()) { var d = $('detailPanel'); if (d) d.scrollTop = 0; } return r; };
  var oCD = window.closeDetail;
  if (typeof oCD === 'function') window.closeDetail = function () { var r = oCD.apply(this, arguments); if (on()) empty(); mark(); return r; };

  if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();
