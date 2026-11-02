// Service Worker ของ CCL และ Contractor Portal (ขอบเขต /ccl/)
// - หน้าเว็บ: ขอจากเน็ตก่อน ถ้าเกิน 3 วินาทีหรือเน็ตหลุด ใช้ของที่เก็บไว้
// - ไฟล์ประกอบ (css/js/ไอคอน/ไลบรารีจาก CDN/ฟอนต์): ใช้ของที่เก็บไว้ทันที แล้วอัปเดตเบื้องหลัง → เปิดซ้ำเร็วมาก
// - ข้อมูลจากหลังบ้าน (Apps Script) ไม่เก็บเลย ขอใหม่ทุกครั้ง
const CACHE = 'ccl-static-v1';
const CORE = ['./index.html', './contractor.html', './tw.css?v=1', './mobile.css?v=2', './mobile.js?v=3', './perf.js?v=1',
  './branch.js?v=3', './contractor-shim.js?v=1', './contractor-extra.js?v=3', './pwa.js?v=1', './icon-192.png', './ct-icon-192.png'];
const CDN = /^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ccl-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function staleWhileRevalidate(req) {
  return caches.open(CACHE).then(c => c.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
}
function networkFirst(req) {
  return caches.open(CACHE).then(c => {
    const net = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; });
    const slow = new Promise(r => setTimeout(r, 3000)).then(() => c.match(req, { ignoreSearch: true }));
    return Promise.race([net.catch(() => null), slow]).then(r => r || net).catch(() => c.match(req, { ignoreSearch: true }));
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;          // ข้อมูลจริง ไม่ยุ่ง
  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith('/ccl/')) return;
    if (req.mode === 'navigate' || /\.html$/.test(url.pathname)) { e.respondWith(networkFirst(req)); return; }
    if (/\.(css|js|png|webmanifest)$/.test(url.pathname)) { e.respondWith(staleWhileRevalidate(req)); return; }
    return;
  }
  if (CDN.test(req.url)) e.respondWith(staleWhileRevalidate(req));
});
