/* Service Worker — ระบบสำรวจงานก่อสร้าง กฟส.อ่าวลึก
 * ให้เปิดแอปและใช้งานได้แม้ไม่มีสัญญาณ
 *  - ไฟล์แอป: ใช้ของใหม่จากเน็ตก่อน ถ้าเกิน 3 วินาทีหรือไม่มีเน็ต ใช้ของที่เก็บไว้
 *  - ข้อมูลพัสดุ/ชุด Set/ค่าแรง และเสาเดิม/แนวสาย/หม้อแปลงเดิม (sld-ala): เก็บถาวร อัปเดตเบื้องหลัง
 *  - ภาพแผนที่ (Longdo / ดาวเทียม / OSM): เก็บทุกแผ่นที่เคยเปิดดู + ที่กด "บันทึกแผนที่บริเวณนี้"
 *  - Google Apps Script: ไม่ยุ่ง (แอปมีคิวรอส่งของตัวเอง)
 */
const V = 'ccs-v1.4.2';
const APP = 'ccs-app-' + V, DATA = 'ccs-data', TILES = 'ccs-tiles';
const SHELL = ['./', './index.html', './app.js?v=1.4.2', './manifest.json', './icon.svg?v=1', './icon-192.png', './apple-touch-icon.png?v=1'];
const DATA_FILES = ['./data/items.json?v=1.4.2', './data/sets.json?v=1.4.2', './data/labour.json?v=1.4.2', './data/drawings.json?v=1.4.2',
  '/sld-ala/mv-lines.json', '/sld-ala/poles.json', '/sld-ala/gis_transformers.csv',
  '/sld-ala/gis_mv_meters.csv', '/sld-ala/gis_mv_meter_accounts.csv'];
const TILE_HOST = /(^|\.)(ms\.longdo\.com|tile\.openstreetmap\.org|server\.arcgisonline\.com)$/;
const LIB_HOST = /(^|\.)(unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|api\.longdo\.com)$/;
const MAX_TILES = 6000;

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil((async () => {
    const a = await caches.open(APP); await Promise.all(SHELL.map(u => a.add(u).catch(() => {})));
    const d = await caches.open(DATA); await Promise.all(DATA_FILES.map(u => d.add(u).catch(() => {})));
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith('ccs-app-') && n !== APP) await caches.delete(n);
    await self.clients.claim();
  })());
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
async function networkFirst(req, cacheName, ms) {
  const c = await caches.open(cacheName);
  try { const res = await timeout(fetch(req), ms); if (res && res.ok) c.put(req, res.clone()); return res; }
  catch (e) { const hit = await c.match(req, { ignoreSearch: req.mode === 'navigate' }); if (hit) return hit; if (req.mode === 'navigate') { const idx = await c.match('./index.html'); if (idx) return idx; } throw e; }
}
async function staleWhileRevalidate(req, cacheName) {
  const c = await caches.open(cacheName), hit = await c.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || new Response('', { status: 504 });
}
let tilePuts = 0;
async function tile(req) {
  const c = await caches.open(TILES), key = req.url, hit = await c.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(new Request(key, { mode: 'cors', credentials: 'omit' }));
    if (res.ok) { c.put(key, res.clone()); if (++tilePuts % 200 === 0) trim(c); }
    return res;
  } catch (e) { return new Response('', { status: 504 }); }
}
async function trim(c) { const keys = await c.keys(); for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]); }

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(u.hostname)) return;
  if (TILE_HOST.test(u.hostname)) return e.respondWith(tile(req));
  if (LIB_HOST.test(u.hostname)) return e.respondWith(staleWhileRevalidate(req, DATA));
  if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/sld-ala/') || u.pathname.includes('/construction/data/')) return e.respondWith(staleWhileRevalidate(req, DATA));
  if (u.pathname === '/pea-hub.js' || u.pathname.startsWith('/construction/')) return e.respondWith(networkFirst(req, APP, 3000));
});

/* แอปส่งรายการภาพแผนที่มาให้เก็บ (ปุ่ม "บันทึกแผนที่บริเวณนี้") */
self.addEventListener('message', e => {
  const d = e.data || {}; if (d.type !== 'saveTiles') return;
  e.waitUntil((async () => {
    const c = await caches.open(TILES); let done = 0, fail = 0;
    const urls = d.urls || [], port = e.ports && e.ports[0];
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async url => {
        try { if (!(await c.match(url))) { const r = await fetch(new Request(url, { mode: 'cors', credentials: 'omit' })); if (!r.ok) throw 0; await c.put(url, r); } done++; } catch (x) { fail++; }
      }));
      port && port.postMessage({ done, fail, total: urls.length });
    }
    port && port.postMessage({ done, fail, total: urls.length, end: true });
  })());
});
