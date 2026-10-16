// Service Worker สำหรับหน้าศูนย์รวมงาน กฟส.อ่าวลึก
const CACHE_NAME = 'pea-aoluek-hub-v2';
const CORE_ASSETS = ['./', './index.html', './hub-admin.js', './pea-hub.js', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {})));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // ดูแลเฉพาะไฟล์ของหน้าศูนย์รวมงานเอง — แอปอื่นใต้โดเมนนี้ (คลังแบบ หนังสือ ฯลฯ) ปล่อยให้เบราว์เซอร์จัดการ ไม่เก็บซ้ำ
  const own = /^\/(index\.html|hub-admin\.js|pea-hub\.js|manifest\.json|icon-\d+\.png)?$/.test(url.pathname);
  if (!own) return;
  // ขอจากเน็ตก่อน ถ้าเกิน 2.5 วินาที ใช้ของที่เก็บไว้แสดงไปก่อน (เน็ตช้า/หลุดก็เปิดได้ทันที)
  const net = fetch(event.request).then((res) => {
    if (res && res.ok) { const c = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, c)); }
    return res;
  });
  const slow = new Promise((resolve) => setTimeout(resolve, 2500)).then(() => caches.match(event.request));
  event.respondWith(
    Promise.race([net.catch(() => null), slow]).then((r) => r || net).catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
  );
});
