/* ติดตั้ง CCL / Contractor Portal เป็นแอปบนมือถือ + เปิดซ้ำเร็วขึ้น (Service Worker) */
(function () {
  'use strict';
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () {}); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; standalone = true; });
  window.cclPwa = {
    available: function () { return !standalone; },
    install: function () {
      if (deferred) { deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; }); return; }
      var how = ios
        ? 'ใน Safari กดปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก <b>"เพิ่มไปยังหน้าจอโฮม"</b>'
        : 'กดเมนู <b>⋮</b> ของเบราว์เซอร์ แล้วเลือก <b>"ติดตั้งแอป"</b> หรือ <b>"เพิ่มลงในหน้าจอหลัก"</b>';
      try { Swal.fire({ icon: 'info', title: 'ติดตั้งเป็นแอป', html: '<div style="font-size:15px;line-height:1.8">' + how + '<br>จากนั้นเปิดจากไอคอนบนหน้าจอได้เลย เปิดเต็มจอและเร็วขึ้น</div>', confirmButtonText: 'เข้าใจแล้ว' }); }
      catch (e) { alert('ติดตั้งเป็นแอป: ใช้เมนูของเบราว์เซอร์ "เพิ่มไปยังหน้าจอโฮม"'); }
    }
  };
})();
