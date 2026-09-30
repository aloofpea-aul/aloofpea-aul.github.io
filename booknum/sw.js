// Service Worker — ระบบออกเลขหนังสือ กฟส.อ่าวลึก
// ไฟล์หน้าเว็บ: ใช้ของใหม่จากเน็ตก่อน (ได้เวอร์ชันล่าสุดเสมอ) ถ้าไม่มีเน็ตค่อยใช้ที่เก็บไว้
// ข้อมูลเลขหนังสือ (POST ไป Apps Script) ไม่เก็บแคชเด็ดขาด
const CACHE_NAME = 'booknum-v4.0.1';
const CORE = ['./', './index.html', './app.css', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ns => Promise.all(ns.filter(n => n.startsWith('booknum-') && n !== CACHE_NAME).map(n => caches.delete(n)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.includes('/booknum/')) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
