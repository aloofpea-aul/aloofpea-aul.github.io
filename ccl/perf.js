/* CCL — ลดการโหลดข้อมูลซ้ำ (ไม่เปลี่ยนหน้าตา/การทำงาน)
   เดิม: ทุกครั้งที่กดเมนู ติดตามงาน / งบประมาณ / ตรวจรับ / แผนที่ ระบบดึง "งานทั้งหมด" ใหม่จากหลังบ้าน (ช้าที่สุดของระบบ)
   ใหม่: ถ้าเพิ่งดึงมาไม่เกิน 60 วินาที และไม่มีการบันทึก/แก้ไขอะไรตั้งแต่นั้น ใช้ข้อมูลเดิมไปเลย
         — บันทึก/แก้ไขอะไรก็ตาม จะดึงใหม่ทันทีเหมือนเดิม
         — กลับมาเปิดแอปหลังพักไว้นานกว่า 60 วินาที ดึงใหม่ให้เองเบื้องหลัง */
(function () {
  'use strict';
  var FRESH_MS = 60000;
  var lastLoad = 0, dirty = true, inNav = false;
  var READ = /^(get|list|ping|ccl(List|Admin|WhoAmI))/;

  // ทุกคำสั่งที่ไม่ใช่การอ่าน = มีการเปลี่ยนข้อมูล → ครั้งหน้าดึงใหม่
  if (typeof window.cclApiCall === 'function') {
    var call = window.cclApiCall;
    window.cclApiCall = function (fn, args) {
      if (!READ.test(String(fn))) dirty = true;
      return call.apply(this, arguments);
    };
  }

  function wrapLoad() {
    var ld = window.loadData;
    if (typeof ld !== 'function' || ld.__perf) return;
    var w = function () {
      var fresh = Date.now() - lastLoad < FRESH_MS;
      var has = typeof allData !== 'undefined' && allData && allData.length;
      if (inNav && fresh && !dirty && has) return;   // เพิ่งโหลดมา ใช้ของเดิม
      lastLoad = Date.now(); dirty = false;
      return ld.apply(this, arguments);
    };
    w.__perf = true; window.loadData = w;
  }
  function wrapNav() {
    var sp = window.showPage;
    if (typeof sp !== 'function' || sp.__perf) return;
    var w = function () {
      inNav = true;
      try { return sp.apply(this, arguments); } finally { inNav = false; }
    };
    w.__perf = true; Object.keys(sp).forEach(function (k) { w[k] = sp[k]; }); window.showPage = w;
  }
  // ผู้ใช้ทั่วไปไม่มีสิทธิ์อ่าน LINE Token อยู่แล้ว — ไม่ต้องยิงคำขอที่รู้ว่าไม่ผ่าน
  function wrapLineToken() {
    var f = window.loadLineToken;
    if (typeof f !== 'function' || f.__perf) return;
    var w = function () {
      var u = {}; try { u = JSON.parse(localStorage.getItem('ccl_user_v1') || '{}'); } catch (e) {}
      if (u.role !== 'Admin' && !u.superAdmin) return;
      return f.apply(this, arguments);
    };
    w.__perf = true; window.loadLineToken = w;
  }

  wrapLoad(); wrapNav(); wrapLineToken();
  document.addEventListener('DOMContentLoaded', function () { wrapLoad(); wrapNav(); wrapLineToken(); });

  // กลับมาที่แอปหลังพักไว้ → ดึงข้อมูลล่าสุดเบื้องหลัง
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var app = document.getElementById('mainApp');
    if (!app || app.classList.contains('hidden')) return;
    if (Date.now() - lastLoad > FRESH_MS && typeof window.loadData === 'function') { inNav = false; window.loadData(); }
  });
})();
