/* ระบบสำรวจออกแบบงานก่อสร้าง กฟส.อ่าวลึก — v1.0.0
   GitHub Pages + (ไม่บังคับ) Google Apps Script สำหรับเก็บงานลง Google Sheet */
'use strict';
const VERSION = '1.4.0';
const LONGDO_KEY = 'f61a87ff70c39e610385809783d5a1b3';   // คีย์ Longdo Map เดียวกับงานพาโทรล (ผูกกับโดเมน aloofpea-aul.github.io)
const DEFAULT_GAS = 'https://script.google.com/macros/s/AKfycbx2wmhdFi462Xx3fbLnOuW9M0g_Ouy3WQmDRGax0-q6u93yzwLh49tyviaas4BN7MrmPg/exec';   // ชีต "ฐานข้อมูลสำรวจงานก่อสร้าง กฟส.อ่าวลึก"
const HUB_USER = () => { try { return localStorage.getItem('pea_aoluek_username') || ''; } catch (e) { return ''; } };
const NET_BASE = '/sld-ala/';
const BOOK_API = 'https://script.google.com/macros/s/AKfycbxNSVvzUdqQC-_8ZKLJM1GFliAM4zWyJI8z8VzU0vhhSSBqq0JcxrUr_UyBkWol7ko1Rw/exec';   // ระบบออกเลขหนังสือ V4 (ตัวเดียวกับระบบงานจัดซื้อ)

/* ---------- utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fm = (n, d = 2) => (Math.round(num(n) * 100) / 100).toLocaleString('th-TH', { minimumFractionDigits: d, maximumFractionDigits: d });
const fq = n => { n = Math.round(num(n) * 1000) / 1000; return n.toLocaleString('th-TH', { maximumFractionDigits: 3 }); };
function toast(msg, ms = 2200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
function hav(a, b) { const R = 6371000, r = x => x * Math.PI / 180; const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng); const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); }
function bearing(a, b) { const r = x => x * Math.PI / 180; const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat)); const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng)); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
const thDate = d => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
const I = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h6"/></svg>',
  calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  gps: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F1A24" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  layers: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F1A24" stroke-width="2" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  fit: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F1A24" stroke-width="2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  undo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1F1A24" stroke-width="2" stroke-linecap="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg>'
};

/* ---------- data ---------- */
const DB = { items: {}, sets: {}, types: [], rates: {}, dwg: {} };
const T = { OTHER: 0, LVSERV: 2, LVPOLE: 3, HVCITY: 4, HVRURAL: 5, GUY: 6, TR: 9 };
const LINE_TYPES = [2, 3, 4, 5, 7, 8];
async function loadData() {
  const [items, sets, lab] = await Promise.all(['items', 'sets', 'labour'].map(n => fetch(`data/${n}.json?v=${VERSION}`).then(r => { if (!r.ok) throw new Error(n); return r.json(); })));
  DB.items = items; DB.sets = sets; DB.types = lab.types; DB.rates = lab.rates;
  try { DB.dwg = await (await fetch(`data/drawings.json?v=${VERSION}`)).json(); } catch (e) {}
}
const iname = c => DB.items[c]?.[0] ?? DB.sets[c]?.n ?? c;
const iunit = c => DB.items[c]?.[1] ?? '';

/* ---------- store ---------- */
const LS = { jobs: 'ccs_jobs', prices: 'ccs_prices', cfg: 'ccs_cfg' };
const S = {
  jobs: JSON.parse(localStorage.getItem(LS.jobs) || '{}'),
  prices: JSON.parse(localStorage.getItem(LS.prices) || '{}'),
  cfg: Object.assign({ gasUrl: DEFAULT_GAS, lineDiv: 1000, branch: 'กฟส.อ่าวลึก', addr: '', tel: '', manager: '', hvWire: '1020060101', lvWire: '1020070003', ohPct: 0, valid: 30 }, JSON.parse(localStorage.getItem(LS.cfg) || '{}'))
};
if (!S.cfg.gasUrl) S.cfg.gasUrl = DEFAULT_GAS;
const saveLocal = k => localStorage.setItem(LS[k], JSON.stringify(S[k]));
let pushTimer = {};
function saveJob(job) {
  job.updated = Date.now(); S.jobs[job.id] = job; saveLocal('jobs');
  if (S.cfg.gasUrl) { markDirty(job.id, true); clearTimeout(pushTimer[job.id]); pushTimer[job.id] = setTimeout(() => pushJob(job.id), 1500); }
}
/* งานที่ยังไม่ได้ส่งขึ้น Sheet (เช่น ตอนไม่มีสัญญาณ) — ส่งให้เองเมื่อกลับมามีสัญญาณ */
function dirtySet() { try { return new Set(JSON.parse(localStorage.getItem('ccs_dirty') || '[]')); } catch (e) { return new Set(); } }
function markDirty(id, on) { const d = dirtySet(); on ? d.add(id) : d.delete(id); localStorage.setItem('ccs_dirty', JSON.stringify([...d])); }
async function pushJob(id) { const j = S.jobs[id]; if (!j || !S.cfg.gasUrl || !navigator.onLine) return; try { await gas('saveJob', { job: j }); markDirty(id, false); } catch (e) {} }
async function pushDirty() { for (const id of dirtySet()) await pushJob(id); }
function savePrice(code, price) {
  if (price === '' || price == null) delete S.prices[code]; else S.prices[code] = num(price);
  saveLocal('prices');
  if (S.cfg.gasUrl) { clearTimeout(pushTimer.p); pushTimer.p = setTimeout(() => gas('savePrices', { prices: S.prices }).catch(() => {}), 1500); }
}
async function gas(action, body) {
  const r = await fetch(S.cfg.gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, ...body }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'GAS error'); return j;
}
async function syncPull(silent) {
  if (!S.cfg.gasUrl) return;
  try {
    const j = await (await fetch(S.cfg.gasUrl + '?action=list')).json();
    if (!j.ok) throw new Error(j.error);
    let n = 0;
    (j.jobs || []).forEach(rj => { const l = S.jobs[rj.id]; if (!l || (rj.updated || 0) > (l.updated || 0)) { S.jobs[rj.id] = rj; n++; } });
    (j.deleted || []).forEach(id => delete S.jobs[id]);
    if (j.prices) Object.assign(S.prices, j.prices);
    saveLocal('jobs'); saveLocal('prices');
    if (!silent) toast(`ซิงค์แล้ว · อัปเดต ${n} งาน`);
  } catch (e) { if (!silent) toast('ซิงค์ไม่สำเร็จ: ' + e.message); }
}

/* ---------- job model ---------- */
const STATUS = ['กำลังสำรวจ', 'รอถอดแบบ', 'ส่งใบเสนอราคาแล้ว', 'ชำระเงินแล้ว'];
function newJob(kind = 'map') {
  return { id: uid(), kind, name: kind === 'quick' ? 'ประมาณราคาด่วน' : 'งานสำรวจใหม่', status: 0, cust: { n: '', a: '', t: '' }, place: '', reqNo: '', qNo: '',
    phase: 3, volt: '33', case: 0, hvT: T.HVRURAL, lvT: T.LVPOLE, ohPct: S.cfg.ohPct, vat: 7, valid: S.cfg.valid, poles: [], spans: [], created: Date.now(), updated: Date.now(), center: null, note: '', surveyor: HUB_USER() };
}
function newPole(job, lat, lng, ex = false) {
  const n = job.poles.filter(p => !!p.ex === ex).length + 1;
  return { id: uid(), label: (ex ? 'E' : (job.kind === 'quick' ? 'รายการ ' : 'P')) + n, lat, lng, ex, pole: ex ? '' : '1000010012', sets: [], items: [], note: '' };
}
function newSpan(job, a, b, k = 'HV') {
  return { id: uid(), a, b, k, w: k === 'HV' ? S.cfg.hvWire : S.cfg.lvWire, n: k === 'HV' ? job.phase : (job.phase === 3 ? 4 : 2), len: null, lt: null };
}
const poleById = (job, id) => job.poles.find(p => p.id === id);
function spanLen(job, s) {
  if (s.len != null && s.len !== '') return num(s.len);
  const a = poleById(job, s.a), b = poleById(job, s.b);
  return a && b && a.lat != null && b.lat != null ? Math.round(hav(a, b)) : 0;
}
function poleAngle(job, p) {
  const nb = job.spans.filter(s => s.a === p.id || s.b === p.id).map(s => poleById(job, s.a === p.id ? s.b : s.a)).filter(q => q && q.lat != null);
  if (p.lat == null) return { n: nb.length, dev: null };
  if (nb.length !== 2) return { n: nb.length, dev: null };
  let d = Math.abs(bearing(p, nb[0]) - bearing(p, nb[1])); if (d > 180) d = 360 - d;
  return { n: 2, dev: Math.round(180 - d) };
}
function suggestTerms(job, p) {
  const a = poleAngle(job, p), ph = job.phase === 1 ? '1-P' : '3-P';
  const hasHV = job.spans.some(s => (s.a === p.id || s.b === p.id) && s.k === 'HV');
  const hasLV = job.spans.some(s => (s.a === p.id || s.b === p.id) && s.k === 'LV');
  let out = [];
  if (hasHV || !hasLV) {
    const pre = `X-ARM-C, ${ph}, `;
    if (a.n <= 1) out.push(pre + 'DE');
    else if (a.dev < 5) out.push(pre + 'SP 0-5');
    else if (a.dev <= 30) out.push(pre + 'SP 5-30');
    else if (a.dev <= 60) out.push(pre + 'DDE', pre + 'BA');
    else out.push(pre + 'DDE');
  }
  if (hasLV) {
    if (a.n <= 1) out.push('RACK 4 INST. UNDER HT.', 'DE');
    else if (a.dev < 5) out.push('RACK 4 INST. UNDER HT.', '0-5 DEGREE');
    else out.push('RACK 4 INST. UNDER HT.', '5-60 DEGREE');
  }
  if (a.n <= 1 || a.dev > 30) out.push('GUY, GY-');
  return { angle: a, terms: out };
}
function suggestSets(job, p) {
  const { terms } = suggestTerms(job, p); const res = [];
  const hv = job.spans.some(s => (s.a === p.id || s.b === p.id) && s.k === 'HV') || !job.spans.some(s => s.a === p.id || s.b === p.id);
  for (const t of terms) {
    if (t.startsWith('RACK') || t.endsWith('DEGREE') || t === 'DE') continue;
    const cat = hv && job.volt === '33' ? 'HV33' : (t.startsWith('GUY') ? 'LV' : null);
    const m = Object.entries(DB.sets).filter(([c, s]) => s.n.toUpperCase().includes(t.toUpperCase()) && (!cat || s.c === cat) && s.i.length).slice(0, t.startsWith('GUY') ? 2 : 3);
    m.forEach(([c]) => { if (!res.includes(c)) res.push(c); });
  }
  if (terms.some(t => t.startsWith('RACK'))) {
    const deg = terms.find(t => t.endsWith('DEGREE') || t === 'DE');
    Object.entries(DB.sets).filter(([c, s]) => s.c === 'LV' && s.n.startsWith('RACK 4 INST. UNDER HT. (12.20 M.)') && s.n.includes(deg === 'DE' ? ', DE ' : deg)).slice(0, 2).forEach(([c]) => res.push(c));
  }
  return res.filter(c => !p.sets.some(x => x.c === c)).slice(0, 6);
}

/* ---------- engine: labour + BOM ---------- */
function labourRate(code, c, pref) {
  const r = DB.rates[code]; if (!r) return { rate: 0, t: null, perKm: false };
  let t = pref != null && r[pref] ? pref : (r[0] ? 0 : (r[T.TR] ? T.TR : +Object.keys(r)[0]));
  const rate = r[t][c] || 0;
  let perKm = LINE_TYPES.includes(+t) && iunit(code) === 'ม.';
  if (+t === 0 && iunit(code) === 'ม.') { const ln = r[T.HVRURAL] || r[T.HVCITY]; if (ln && Math.abs(ln[c] - rate) < 0.01 && rate > 100) perKm = true; }
  return { rate, t: +t, perKm };
}
function labourOf(code, qty, c, pref) {
  const { rate, t, perKm } = labourRate(code, c, pref);
  return { lab: perKm ? qty / S.cfg.lineDiv * rate : qty * rate, rate, t, perKm };
}
function groupOfSet(code) {
  const n = (DB.sets[code]?.n || '').toUpperCase();
  if (/TR\.?\s?INST|CSP-TR/.test(n)) return 'tr';
  if (/GUY|ANCHOR|STUB/.test(n)) return 'guy';
  if (/METER/.test(n)) return 'meter';
  if (/CAPACITOR|KVAR/.test(n)) return 'cap';
  if (/LUM\.|LIGHT|TIME SWITCH/.test(n) && !/ARRESTER/.test(n)) return 'light';
  return 'head';
}
function groupOfItem(code) {
  const n = iname(code).toUpperCase();
  if (n.startsWith('POLE')) return 'pole';
  if (n.startsWith('TRANSFORMER')) return 'tr';
  if (/METER/.test(n)) return 'meter';
  return 'other';
}
const GROUPS = { pole: 'งานปักเสา', head: 'งานประกอบหัวเสาและอุปกรณ์', wire: 'งานพาดสาย', guy: 'งานยึดโยงเสา', tr: 'งานติดตั้งหม้อแปลง', meter: 'งานติดตั้งมิเตอร์', cap: 'งานติดตั้งคาปาซิเตอร์', light: 'งานไฟฟ้าแสงสว่าง', other: 'งานอื่นๆ' };
function computeBOM(job) {
  const c = job.case || 0, contrib = [];
  const add = (code, qty, reuse, g, src, pref) => { if (!qty) return; const L = labourOf(code, qty, c, pref); contrib.push({ code, qty, reuse, g, src, lab: L.lab, rate: L.rate, t: L.t, perKm: L.perKm }); };
  job.poles.forEach(p => {
    if (p.pole && !p.ex) add(p.pole, 1, 0, 'pole', p.label);
    p.sets.forEach(s => { const set = DB.sets[s.c]; if (!set) return; const g = groupOfSet(s.c); set.i.forEach(([code, q, rq]) => add(code, q * s.q, rq * s.q, g, `${p.label} · ${s.c}`)); });
    p.items.forEach(it => add(it.c, num(it.q), 0, groupOfItem(it.c), p.label));
  });
  job.spans.forEach(s => {
    const L = spanLen(job, s), a = poleById(job, s.a), b = poleById(job, s.b);
    const lt = s.lt ?? (s.k === 'HV' ? job.hvT : job.lvT);
    add(s.w, L * num(s.n), 0, 'wire', `${a && b ? a.label + '–' + b.label : 'สาย ' + s.k} ${L} ม. × ${s.n}`, lt);
  });
  const map = new Map();
  contrib.forEach(x => {
    let m = map.get(x.code);
    if (!m) { m = { code: x.code, name: iname(x.code), unit: iunit(x.code), qty: 0, reuse: 0, lab: 0, g: x.g, srcs: [], price: S.prices[x.code], hasPrice: S.prices[x.code] != null }; map.set(x.code, m); }
    m.qty += x.qty; m.reuse += x.reuse; m.lab += x.lab; m.srcs.push(x.src);
  });
  const mats = [...map.values()].map(m => ({ ...m, mat: m.qty * num(m.price) }));
  const groups = {};
  contrib.forEach(x => { const g = groups[x.g] || (groups[x.g] = { mat: 0, lab: 0, qty: 0 }); g.mat += x.qty * num(S.prices[x.code]); g.lab += x.lab; });
  const mat = mats.reduce((a, m) => a + m.mat, 0), lab = contrib.reduce((a, x) => a + x.lab, 0);
  const sub = mat + lab, oh = sub * num(job.ohPct) / 100, pre = sub + oh, vat = pre * num(job.vat) / 100;
  return { contrib, mats, groups, mat, lab, sub, oh, pre, vat, grand: pre + vat, noPrice: mats.filter(m => !m.hasPrice).length };
}
function jobCounts(job) {
  const np = job.poles.filter(p => !p.ex && p.pole).length;
  const hv = job.spans.filter(s => s.k === 'HV').reduce((a, s) => a + spanLen(job, s), 0);
  const lv = job.spans.filter(s => s.k === 'LV').reduce((a, s) => a + spanLen(job, s), 0);
  const tr = job.poles.reduce((a, p) => a + p.sets.filter(s => groupOfSet(s.c) === 'tr').reduce((b, s) => b + s.q, 0), 0);
  const guy = job.poles.reduce((a, p) => a + p.sets.filter(s => groupOfSet(s.c) === 'guy').reduce((b, s) => b + s.q, 0), 0);
  return { np, hv, lv, tr, guy };
}

/* ---------- bahttext ---------- */
function bahtText(n) {
  n = Math.round(num(n) * 100) / 100; if (n === 0) return 'ศูนย์บาทถ้วน';
  const D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
  const rd = s => { let o = ''; const L = s.length; for (let i = 0; i < L; i++) { const d = +s[i], p = L - i - 1; if (!d) continue; if (p === 1 && d === 1) o += 'สิบ'; else if (p === 1 && d === 2) o += 'ยี่สิบ'; else if (p === 0 && d === 1 && L > 1) o += 'เอ็ด'; else o += D[d] + P[p]; } return o; };
  const big = s => { let o = ''; while (s.length > 6) { o += rd(s.slice(0, s.length - 6)) + 'ล้าน'; s = s.slice(s.length - 6); } return o + rd(s); };
  const [b, st] = n.toFixed(2).split('.');
  let out = +b ? big(String(+b)) + 'บาท' : '';
  out += +st ? rd(String(+st)) + 'สตางค์' : 'ถ้วน';
  return out;
}

/* ---------- router ---------- */
let cur = { job: null, map: null };
const app = $('#app');
window.addEventListener('hashchange', route);
function go(h) { location.hash = h; }
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [v, id, sub] = h.split('/');
  if (cur.map && v !== 'map') { cur.map.remove(); cur.map = null; }
  if (v === 'home') return vHome();
  if (v === 'settings') return vSettings();
  if (v === 'quick') return vQuick();
  const job = S.jobs[id]; if (!job) return go('home');
  cur.job = job;
  if (v === 'map') return vMap(job);
  if (v === 'list') return vList(job);
  if (v === 'pole') return vPole(job, sub);
  if (v === 'bom') return vBom(job);
  if (v === 'quote') return vQuote(job);
  if (v === 'info') return vInfo(job);
  go('home');
}
function topbar(title, sub, back, right = '') {
  return `<div class="top">${back ? `<a class="ib" href="${back}" aria-label="กลับ">${I.back}</a>` : ''}<div class="t"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>${right}</div>`;
}
function navbar(job, on) {
  if (!job) return `<nav class="nav"><a href="#home" class="${on === 'home' ? 'on' : ''}">${I.home}หน้าหลัก</a><a href="#quick" class="${on === 'quick' ? 'on' : ''}">${I.calc}ราคาด่วน</a><a href="#home" onclick="newMapJob();return false">${I.map}สำรวจใหม่</a><a href="#settings" class="${on === 'settings' ? 'on' : ''}">${I.gear}ตั้งค่า</a></nav>`;
  const first = job.kind === 'quick' ? `<a href="#list/${job.id}" class="${on === 'list' ? 'on' : ''}">${I.list}รายการ</a>` : `<a href="#map/${job.id}" class="${on === 'map' ? 'on' : ''}">${I.map}แผนที่</a>`;
  const second = job.kind === 'quick' ? `<a href="#info/${job.id}" class="${on === 'info' ? 'on' : ''}">${I.gear}ข้อมูลงาน</a>` : `<a href="#list/${job.id}" class="${on === 'list' ? 'on' : ''}">${I.list}รายการ</a>`;
  return `<nav class="nav">${first}${second}<a href="#bom/${job.id}" class="${on === 'bom' ? 'on' : ''}">${I.calc}ถอดแบบ</a><a href="#quote/${job.id}" class="${on === 'quote' ? 'on' : ''}">${I.doc}ใบเสนอราคา</a></nav>`;
}

/* ---------- home ---------- */
function vHome() {
  const jobs = Object.values(S.jobs).sort((a, b) => b.updated - a.updated);
  const cnt = i => jobs.filter(j => j.status === i).length;
  app.innerHTML = `
  <div class="top"><a href="/index.html" aria-label="กลับศูนย์รวมงาน" style="display:flex"><img src="icon.svg?v=1" alt="" class="hlogo" width="28" height="28"></a><div class="t"><b>สำรวจงานก่อสร้าง</b><small>${HUB_USER() ? 'สวัสดี คุณ' + esc(HUB_USER().split(/\s+/)[0]) : esc(S.cfg.branch)}</small></div>${S.cfg.gasUrl ? `<button class="pill" onclick="this.disabled=true;syncPull().then(route)"><span class="dt"></span>ซิงค์</button>` : ''}</div>
  <div class="hero" style="padding:0 12px 12px"><div class="grid3"><div class="stat"><b>${cnt(0)}</b><span class="s12">กำลังสำรวจ</span></div><div class="stat"><b>${cnt(1)}</b><span class="s12">รอถอดแบบ</span></div><div class="stat"><b>${cnt(2)}</b><span class="s12">ส่งใบเสนอราคาแล้ว</span></div></div></div>
  <div class="main"><div class="wrap stack">
    <div class="grid2">
      <button class="tile" onclick="newMapJob()">${I.map}<b>สำรวจงานใหม่</b><span class="s12 muted">วาดผังบนแผนที่ ปักเสา พาดสาย</span></button>
      <a class="tile" href="#quick">${I.calc}<b>ประมาณราคาด่วน</b><span class="s12 muted">ปักเสา 1 ต้น / หม้อแปลง 1 เครื่อง</span></a>
    </div>
    <div class="row"><b style="flex:1;font-size:16px">งานทั้งหมด (${jobs.length})</b><label class="sr" for="q">ค้นหางาน</label><input id="q" class="in" style="max-width:200px;height:38px" placeholder="ค้นหางาน" oninput="filterJobs(this.value)"></div>
    <div class="stack" id="jl">${jobs.length ? jobs.map(jobCard).join('') : '<div class="empty">ยังไม่มีงาน · กด "สำรวจงานใหม่" หรือ "ประมาณราคาด่วน"</div>'}</div>
  </div></div>${navbar(null, 'home')}`;
}
function jobCard(j) {
  const c = jobCounts(j);
  return `<a class="card" data-s="${esc((j.name + ' ' + j.place + ' ' + j.cust.n).toLowerCase())}" href="#${j.kind === 'quick' ? 'list' : 'map'}/${j.id}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:4px">
   <div class="row" style="justify-content:space-between"><b>${esc(j.name)}</b><span class="chip st${j.status}">${STATUS[j.status]}</span></div>
   <span class="s13 muted">${esc(j.place || '—')}${j.cust.n ? ' · ' + esc(j.cust.n) : ''}</span>
   <span class="s12 muted">${j.kind === 'quick' ? 'ราคาด่วน · ' : ''}เสา ${c.np} ต้น${c.hv ? ` · HV ${c.hv} ม.` : ''}${c.lv ? ` · LV ${c.lv} ม.` : ''}${c.tr ? ` · หม้อแปลง ${c.tr}` : ''} · แก้ไข ${new Date(j.updated).toLocaleDateString('th-TH')}</span></a>`;
}
window.filterJobs = q => { q = q.toLowerCase(); $$('#jl > a').forEach(a => a.style.display = a.dataset.s.includes(q) ? '' : 'none'); };
window.newMapJob = () => { const j = newJob('map'); saveJob(j); go('info/' + j.id); };

/* ---------- job info ---------- */
function vInfo(job) {
  app.innerHTML = topbar('ข้อมูลงาน', job.name, job.kind === 'quick' ? `#list/${job.id}` : `#map/${job.id}`) + `
  <div class="main"><div class="wrap stack" style="max-width:720px">
    <div class="card stack">
      <div class="fld"><label for="f_name">ชื่องาน</label><input id="f_name" class="in" value="${esc(job.name)}"></div>
      <div class="fld"><label for="f_place">สถานที่</label><input id="f_place" class="in" value="${esc(job.place)}" placeholder="เช่น ม.4 ต.อ่าวลึกใต้"></div>
      <div class="grid2"><div class="fld"><label for="f_req">เลขที่คำร้อง</label><input id="f_req" class="in" value="${esc(job.reqNo)}"></div>
      <div class="fld"><label for="f_st">สถานะ</label><select id="f_st" class="in">${STATUS.map((s, i) => `<option value="${i}" ${job.status === i ? 'selected' : ''}>${s}</option>`).join('')}</select></div></div>
    </div>
    <div class="card stack"><b>ผู้ขอใช้ไฟ / ลูกค้า</b>
      <div class="fld"><label for="f_cn">ชื่อ</label><input id="f_cn" class="in" value="${esc(job.cust.n)}"></div>
      <div class="fld"><label for="f_ca">ที่อยู่</label><input id="f_ca" class="in" value="${esc(job.cust.a)}"></div>
      <div class="fld"><label for="f_ct">โทร</label><input id="f_ct" class="in" inputmode="tel" value="${esc(job.cust.t)}"></div>
    </div>
    <div class="card stack"><b>ระบบไฟฟ้า</b>
      <div class="fld"><label>แรงดัน</label><div class="seg" id="f_volt">${['33', '22'].map(v => `<button type="button" data-v="${v}" class="${job.volt === v ? 'on' : ''}">${v} kV</button>`).join('')}</div></div>
      <div class="fld"><label>เฟส</label><div class="seg" id="f_ph">${[3, 1].map(v => `<button type="button" data-v="${v}" class="${job.phase === v ? 'on' : ''}">${v} เฟส</button>`).join('')}</div></div>
      <div class="fld"><label>สภาพพื้นที่ (อัตราค่าแรง)</label><div class="seg" id="f_case">${[0, 1, 2].map(v => `<button type="button" data-v="${v}" class="${job.case === v ? 'on' : ''}">กรณีที่ ${v + 1}${v === 0 ? ' (ปกติ)' : ''}</button>`).join('')}</div></div>
      <div class="fld"><label for="f_hvt">ค่าแรงพาดสายแรงสูง</label><select id="f_hvt" class="in">${[T.HVRURAL, T.HVCITY].map(t => `<option value="${t}" ${job.hvT === t ? 'selected' : ''}>${DB.types[t]}</option>`).join('')}</select></div>
      <div class="fld"><label for="f_lvt">ค่าแรงพาดสายแรงต่ำ</label><select id="f_lvt" class="in">${[T.LVPOLE, T.LVSERV].map(t => `<option value="${t}" ${job.lvT === t ? 'selected' : ''}>${DB.types[t]}</option>`).join('')}</select></div>
    </div>
    <div class="card stack"><div class="fld"><label for="f_note">หมายเหตุ</label><textarea id="f_note" class="in" rows="3">${esc(job.note)}</textarea></div></div>
    <div class="row"><button class="btn d" onclick="delJob()">ลบงาน</button><span style="flex:1"></span><button class="btn p" onclick="saveInfo()">บันทึก</button></div>
  </div></div>${navbar(job, 'info')}`;
  $$('.seg').forEach(sg => sg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', sg).forEach(x => x.classList.toggle('on', x === b)); }));
}
window.saveInfo = () => {
  const j = cur.job, segv = id => $(`#${id} .on`)?.dataset.v;
  j.name = $('#f_name').value.trim() || 'งานไม่มีชื่อ'; j.place = $('#f_place').value.trim(); j.reqNo = $('#f_req').value.trim(); j.status = +$('#f_st').value;
  j.cust = { n: $('#f_cn').value.trim(), a: $('#f_ca').value.trim(), t: $('#f_ct').value.trim() };
  j.volt = segv('f_volt'); j.phase = +segv('f_ph'); j.case = +segv('f_case'); j.hvT = +$('#f_hvt').value; j.lvT = +$('#f_lvt').value; j.note = $('#f_note').value;
  saveJob(j); toast('บันทึกแล้ว'); go((j.kind === 'quick' ? 'list/' : 'map/') + j.id);
};
window.delJob = () => {
  if (!confirm('ลบงานนี้ถาวร?')) return; const id = cur.job.id; delete S.jobs[id]; saveLocal('jobs');
  if (S.cfg.gasUrl) gas('deleteJob', { id }).catch(() => {}); go('home');
};

/* ---------- สัญลักษณ์เสา: สีตามขนาด + หัวเสา ---------- */
const PCOL = { lv: '#1E9E4A', mv: '#D62828', hv: '#7B2CBF', na: '#8E8794' };
const PCLS_TXT = { lv: 'แรงต่ำ 8–9 ม.', mv: '12 ม. ขึ้นไป', hv: '22 ม. ระบบ 115 kV', na: 'ไม่ทราบขนาด' };
function poleCls(h, volt) { h = +h || 0; if (volt === 'HV' || h >= 22) return 'hv'; if (h >= 12) return 'mv'; if (h > 0) return 'lv'; if (volt === 'LV') return 'lv'; if (/^MV/.test(volt || '')) return 'mv'; return 'na'; }
function poleH(p) { if (+p.h) return +p.h; const m = iname(p.pole || '').match(/(\d+(?:\.\d+)?)\s*M/i); return m ? +m[1] : 0; }
const HEAD_RE = /\b(2DE|DDP|DDE|CCB|CTB|CSC|SP|DP|DE|BA)\b(\s?\d+-\d+)?/;
function poleHead(p) { if (p.head) return p.head; for (const x of p.sets || []) { const m = (DB.sets[x.c]?.n || '').match(HEAD_RE); if (m) return m[1] + (m[2] ? ' ' + m[2].trim() : ''); } return ''; }
const HEAD_OPTS = ['SP', 'SP 0-5', 'SP 5-30', 'DP', 'DDP', 'DE', 'DDE', '2DE', 'BA', 'CCB', 'CCB 5-60', 'CTB', 'CSC', 'SP (TR)'];
const fH = h => +h ? (String(+h) + ' ม.') : '';

/* ---------- แผนที่พื้นหลัง ---------- */
const BASES = {
  longdo: { name: 'Longdo Map', desc: 'แผนที่ไทย ชื่อถนน ซอย สถานที่ภาษาไทย (เหมือนงานพาโทรล)', url: 'https://ms.longdo.com/mmmap/tile.php?key=' + LONGDO_KEY + '&proj=epsg3857&zoom={z}&x={x}&y={y}&HD=1', max: 20, attr: '© Longdo Map' },
  sat: { name: 'ภาพดาวเทียม', desc: 'ภาพถ่ายดาวเทียม Esri — ดูแนวต้นไม้ หลังคาบ้าน', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', max: 19, attr: 'Esri' },
  osm: { name: 'OpenStreetMap', desc: 'แผนที่สากล (สำรอง)', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', max: 19, attr: '© OpenStreetMap' }
};

/* ---------- map ---------- */
const mapState = { tool: 'sel', kind: 'HV', sel: null, spanA: null, auto: true, layer: localStorage.getItem('ccs_layer') || 'longdo', history: [], net: true };
function vMap(job) {
  const c = jobCounts(job);
  app.innerHTML = topbar(job.name, `${job.volt} kV ${job.phase} เฟส · กรณีที่ ${job.case + 1}`, '#home', `<a class="ib" href="#info/${job.id}" aria-label="ข้อมูลงาน">${I.gear}</a>`) + `
  <div class="mapwrap"><div id="map"></div>
    <div class="mtl"><button aria-label="ตำแหน่งปัจจุบัน" onclick="locate()">${I.gps}</button><button aria-label="สลับภาพถ่ายดาวเทียม" onclick="toggleLayer()">${I.layers}</button><button aria-label="ดูทั้งงาน" onclick="fitJob()">${I.fit}</button><button aria-label="บันทึกแผนที่บริเวณนี้ไว้ใช้ออฟไลน์" onclick="saveArea()" style="font-size:10px;font-weight:700;line-height:1.1">เก็บ<br>แผนที่</button><button aria-label="ย้อนกลับ" onclick="undo()">${I.undo}</button><button aria-label="แสดงระบบไฟฟ้าเดิม" id="netBtn" onclick="toggleNet()" style="font-size:11px;font-weight:700;${mapState.net ? 'background:#5B1A63;color:#fff' : ''}">เดิม</button></div>
    <div class="tools" id="tools"></div>
    <div id="xhair"></div><div id="dist"></div>
    <div class="legend"><span><i class="b" style="background:#1E9E4A"></i>แรงต่ำ 8–9 ม.</span><span><i class="b" style="background:#D62828"></i>12 ม. ขึ้นไป</span><span><i class="b" style="background:#7B2CBF"></i>22 ม. 115 kV</span><span><i class="tri n" style="display:inline-block"></i>หม้อแปลง</span></div>
    <div class="hint" id="hint"></div>
  </div>
  <div class="sheet" id="sheet"></div>${navbar(job, 'map')}`;
  const m = cur.map = L.map('map', { zoomControl: false, attributionControl: true }).setView(job.center || [8.3755, 98.7280], job.center ? 17 : 14);
  cur.bases = {};
  for (const [k, b] of Object.entries(BASES)) cur.bases[k] = L.tileLayer(b.url, { maxZoom: 21, maxNativeZoom: b.max, attribution: b.attr });
  (cur.bases[mapState.layer] || cur.bases.longdo).addTo(m);
  cur.cv = L.canvas({ padding: 0.3 });
  cur.netLines = L.layerGroup(); cur.netPts = L.layerGroup();
  if (mapState.net) { cur.netLines.addTo(m); cur.netPts.addTo(m); }
  cur.lyr = L.layerGroup().addTo(m);
  m.on('moveend', () => drawNetPts(job));
  cur.rubber = L.polyline([], { color: '#E07B00', weight: 3, dashArray: '6 6', interactive: false }).addTo(m);
  cur.hover = null;
  m.on('move', () => updateAim(job));
  m.on('mousemove', e => { if (matchMedia('(hover:hover)').matches) { cur.hover = e.latlng; updateAim(job); } });
  m.on('mouseout', () => { cur.hover = null; updateAim(job); });
  loadNet().then(() => { drawNetLines(); drawNetPts(job); });
  m.on('click', e => onMapClick(job, e.latlng));
  m.on('moveend', () => { job.center = [m.getCenter().lat, m.getCenter().lng]; S.jobs[job.id] = job; saveLocal('jobs'); });
  mapState.sel = null; mapState.spanA = null;
  drawMap(job); renderTools(); renderSheet(job);
  if (job.poles.length) fitJob(); else if (!job.center) locate(true);
}
const TOOLS = [['sel', '☝', 'เลือก'], ['pole', '●', 'ปักเสา'], ['expole', '◌', 'เสาเดิม'], ['span', '⟋', 'พาดสาย'], ['tr', 'TR', 'หม้อแปลง'], ['guy', '↘', 'ยึดโยง'], ['meter', 'M', 'มิเตอร์']];
const HINTS = { sel: 'แตะเสาเพื่อเลือก · ลากหมุดเพื่อย้ายตำแหน่ง', pole: 'แตะแผนที่เพื่อปักเสาใหม่ (ต่อสายจากเสาที่เลือกอัตโนมัติ)', expole: 'แตะตำแหน่งเสาเดิมของระบบ (จุดเชื่อม)', span: 'แตะเสาต้นแรก แล้วแตะเสาต้นถัดไป', tr: 'แตะเสาที่จะติดตั้งหม้อแปลง', guy: 'แตะเสาที่จะยึดโยง', meter: 'แตะเสาที่จะติดตั้งมิเตอร์' };
function renderTools() {
  $('#tools').innerHTML = TOOLS.map(([k, ic, l]) => `<button class="${mapState.tool === k ? 'on' : ''}" onclick="setTool('${k}')" aria-label="${l}"><b>${ic}</b>${l}</button>`).join('');
  const hn = $('#hint'); hn.textContent = (mapState.tool === 'span' && mapState.spanA ? 'แตะเสาปลายทาง · ' : '') + HINTS[mapState.tool] + (['pole', 'span'].includes(mapState.tool) ? ` · สาย ${mapState.kind}` : '');
  hn.classList.remove('off'); clearTimeout(cur.hintT); cur.hintT = setTimeout(() => hn.classList.add('off'), 4000);
}
window.setTool = t => { mapState.tool = t; mapState.spanA = null; renderTools(); drawMap(cur.job); renderSheet(cur.job); updateAim(cur.job); };
function aimFrom(job) { const id = mapState.tool === 'span' ? mapState.spanA : mapState.sel; const p = id && poleById(job, id); return p && p.lat != null ? p : null; }
function updateAim(job) {
  if (!cur.map) return;
  const aim = ['pole', 'expole', 'span'].includes(mapState.tool);
  const w = $('.mapwrap'); w && w.classList.toggle('aim', aim && !cur.hover && mapState.tool !== 'span');
  const d = $('#dist'), from = aim ? aimFrom(job) : null;
  if (!aim || !from) { cur.rubber.setLatLngs([]); if (d) d.style.display = 'none'; return; }
  const to = cur.hover || cur.map.getCenter();
  cur.rubber.setLatLngs([[from.lat, from.lng], [to.lat, to.lng]]);
  const m = Math.round(hav(from, to));
  if (d) {
    d.textContent = `ห่าง ${m.toLocaleString('th-TH')} ม. จาก ${from.label}`; d.style.display = 'block';
    if (cur.hover) { const pt = cur.map.latLngToContainerPoint(cur.hover); d.style.left = pt.x + 'px'; d.style.top = pt.y + 'px'; }
    else { d.style.left = '50%'; d.style.top = '50%'; }
  }
}
window.placeAtAim = () => { const j = cur.job; onMapClick(j, cur.map.getCenter()); };
function pushHist(job) { mapState.history.push(JSON.stringify({ poles: job.poles, spans: job.spans })); if (mapState.history.length > 30) mapState.history.shift(); }
window.undo = () => { const h = mapState.history.pop(); if (!h) return toast('ไม่มีอะไรให้ย้อน'); const j = cur.job, o = JSON.parse(h); j.poles = o.poles; j.spans = o.spans; saveJob(j); drawMap(j); renderSheet(j); };
function onMapClick(job, ll) {
  const t = mapState.tool;
  if (t !== 'pole' && t !== 'expole') { if (t === 'sel') { mapState.sel = null; drawMap(job); renderSheet(job); } return; }
  pushHist(job);
  const p = newPole(job, +ll.lat.toFixed(7), +ll.lng.toFixed(7), t === 'expole');
  job.poles.push(p);
  if (mapState.auto && mapState.sel && poleById(job, mapState.sel)) job.spans.push(newSpan(job, mapState.sel, p.id, mapState.kind));
  mapState.sel = p.id; saveJob(job); drawMap(job); renderSheet(job); updateAim(job);
}
function onPoleClick(job, p) {
  const t = mapState.tool;
  if (t === 'span') {
    if (!mapState.spanA) { mapState.spanA = p.id; mapState.sel = p.id; }
    else if (mapState.spanA !== p.id) {
      if (job.spans.some(s => (s.a === mapState.spanA && s.b === p.id) || (s.b === mapState.spanA && s.a === p.id) && s.k === mapState.kind)) toast('มีช่วงสายนี้แล้ว');
      else { pushHist(job); job.spans.push(newSpan(job, mapState.spanA, p.id, mapState.kind)); saveJob(job); }
      mapState.spanA = p.id; mapState.sel = p.id;
    }
    renderTools(); drawMap(job); renderSheet(job); return;
  }
  if (t === 'tr' || t === 'guy' || t === 'meter') { mapState.sel = p.id; drawMap(job); renderSheet(job); return openPicker({ job, pole: p, preset: t }); }
  mapState.sel = p.id; drawMap(job); renderSheet(job);
}
function drawMap(job) {
  if (!cur.map) return; cur.lyr.clearLayers();
  job.spans.forEach(s => {
    const a = poleById(job, s.a), b = poleById(job, s.b); if (!a || !b || a.lat == null || b.lat == null) return;
    const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: s.k === 'HV' ? '#5B1A63' : '#0F7C8C', weight: s.k === 'HV' ? 5 : 4, dashArray: s.k === 'LV' ? '8 6' : null }).addTo(cur.lyr);
    line.on('click', e => { L.DomEvent.stopPropagation(e); openSpan(job, s); });
    const mid = [(a.lat + b.lat) / 2, (a.lng + b.lng) / 2];
    L.marker(mid, { interactive: false, icon: L.divIcon({ className: '', html: `<span class="slabel">${spanLen(job, s)} ม.</span>`, iconSize: [50, 16], iconAnchor: [-6, 8] }) }).addTo(cur.lyr);
  });
  job.poles.forEach(p => {
    if (p.lat == null) return;
    const tr = p.sets.some(s => groupOfSet(s.c) === 'tr') || p.items.some(i => groupOfItem(i.c) === 'tr'), sel = mapState.sel === p.id || mapState.spanA === p.id;
    const h = poleH(p), hd = poleHead(p), col = PCOL[poleCls(h, p.volt)], info = [fH(h), hd].filter(Boolean).join(' · ');
    const html = `<div class="pm"><i class="sq ${p.ex ? 'ex' : ''} ${sel ? 'sel' : ''}" style="background:${col}"></i>${tr ? '<i class="tri"></i>' : ''}<span class="pl">${esc(p.label)}${info ? `<small>${esc(info)}</small>` : ''}${p.photos?.length ? `<small>รูป ${p.photos.length}</small>` : ''}</span></div>`;
    const mk = L.marker([p.lat, p.lng], { draggable: mapState.tool === 'sel', icon: L.divIcon({ className: '', html, iconSize: [130, 30], iconAnchor: [9, 9] }) }).addTo(cur.lyr);
    mk.on('click', e => { L.DomEvent.stopPropagation(e); onPoleClick(job, p); });
    mk.on('dragstart', () => pushHist(job));
    mk.on('drag', e => { const ll = e.target.getLatLng(), d = $('#dist'); const near = job.spans.filter(x => x.a === p.id || x.b === p.id).map(x => poleById(job, x.a === p.id ? x.b : x.a)).filter(q => q && q.lat != null);
      if (d && near.length) { const pt = cur.map.latLngToContainerPoint(ll); d.style.display = 'block'; d.style.left = pt.x + 'px'; d.style.top = pt.y + 'px'; d.textContent = near.map(q => `${q.label} ${Math.round(hav(q, ll))} ม.`).join(' · '); } });
    mk.on('dragend', e => { const ll = e.target.getLatLng(); p.lat = +ll.lat.toFixed(7); p.lng = +ll.lng.toFixed(7); saveJob(job); drawMap(job); renderSheet(job); updateAim(job); });
  });
  updateAim(job);
}
function renderSheet(job) {
  const c = jobCounts(job), p = mapState.sel && poleById(job, mapState.sel);
  let html = `<div class="grab"></div>`;
  if (p) {
    const ang = poleAngle(job, p);
    html += `<div class="row"><i class="sq" style="background:${PCOL[poleCls(poleH(p), p.volt)]}"></i><div class="grow" style="flex:1;min-width:0"><b>${esc(p.label)}</b> <span class="s13 muted">${p.ex ? 'เสาเดิม' : 'เสาใหม่'}${poleH(p) ? ' ' + fH(poleH(p)) : ''}${poleHead(p) ? ' · ' + esc(poleHead(p)) : ''}${ang.dev != null ? ` · มุม ${ang.dev}°` : ''}${p.photos?.length ? ` · รูป ${p.photos.length}` : ''}</span><div class="s12 muted">${p.sets.length ? p.sets.map(s => s.c + (s.q > 1 ? '×' + s.q : '')).join(', ') : 'ยังไม่มีชุด Set'}</div></div>
      <button class="btn sm g" onclick="delPole('${p.id}')">ลบ</button><a class="btn sm p" href="#pole/${job.id}/${p.id}">แก้ไขเสา</a></div>`;
  }
  if (['pole', 'expole'].includes(mapState.tool)) html += `<button class="btn p" onclick="placeAtAim()">${mapState.tool === 'pole' ? 'ปักเสาใหม่' : 'วางเสาเดิม'}ที่จุดเล็ง (กากบาทกลางจอ)</button>`;
  html += `<div class="sum4"><div><b>${c.np}</b><span class="s12 muted">เสาใหม่</span></div><div><b>${c.hv}</b><span class="s12 muted">ม. HV</span></div><div><b>${c.lv}</b><span class="s12 muted">ม. LV</span></div><div><b>${c.tr}</b><span class="s12 muted">หม้อแปลง</span></div></div>
  <div class="row"><div class="seg" style="flex:1">${['HV', 'LV'].map(k => `<button class="${mapState.kind === k ? 'on' : ''}" onclick="mapState.kind='${k}';renderSheet(cur.job);renderTools()">สาย ${k === 'HV' ? 'แรงสูง' : 'แรงต่ำ'}</button>`).join('')}</div>
  <a class="btn p" href="#bom/${job.id}">ถอดแบบ →</a></div>`;
  $('#sheet').innerHTML = html;
}
window.delPole = id => { const j = cur.job; if (!confirm('ลบเสานี้และช่วงสายที่ต่อ?')) return; pushHist(j); j.poles = j.poles.filter(p => p.id !== id); j.spans = j.spans.filter(s => s.a !== id && s.b !== id); mapState.sel = null; saveJob(j); drawMap(j); renderSheet(j); };
window.locate = silent => {
  if (!navigator.geolocation) return toast('อุปกรณ์ไม่รองรับ GPS');
  navigator.geolocation.getCurrentPosition(pos => {
    const ll = [pos.coords.latitude, pos.coords.longitude]; cur.map?.setView(ll, 18);
    if (cur.gpsMk) cur.gpsMk.remove();
    cur.gpsMk = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }).addTo(cur.map).bindTooltip(`GPS ±${Math.round(pos.coords.accuracy)} ม.`);
    if (!silent) toast(`GPS ±${Math.round(pos.coords.accuracy)} ม.`);
  }, e => { if (!silent) toast('อ่านตำแหน่งไม่ได้: ' + e.message); }, { enableHighAccuracy: true, timeout: 12000 });
};
window.toggleLayer = () => {
  modal('แผนที่พื้นหลัง', `<div class="list">${Object.entries(BASES).map(([k, b]) => `<button class="li" style="width:100%;border:0;background:none;text-align:left;cursor:pointer" data-k="${k}"><span class="chip ${mapState.layer === k ? 'st1' : 'st2'}">${mapState.layer === k ? 'ใช้อยู่' : 'เลือก'}</span><div class="grow"><b>${b.name}</b><div class="s12 muted">${b.desc}</div></div></button>`).join('')}</div>`, '', box => {
    $('.bd', box).onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; const m = cur.map, k = b.dataset.k;
      Object.values(cur.bases).forEach(l => m.hasLayer(l) && m.removeLayer(l)); cur.bases[k].addTo(m); cur.bases[k].bringToBack(); mapState.layer = k; localStorage.setItem('ccs_layer', k); closeModal(); };
  });
};
/* บันทึกภาพแผนที่บริเวณที่เห็นไว้ใช้ตอนไม่มีสัญญาณ */
function tileUrls(base, bounds, z0, z1) {
  const out = [], t = (lat, lng, z) => [Math.floor((lng + 180) / 360 * 2 ** z), Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z)];
  for (let z = z0; z <= z1; z++) {
    const [x0, y0] = t(bounds.getNorth(), bounds.getWest(), z), [x1, y1] = t(bounds.getSouth(), bounds.getEast(), z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push(base.url.replace('{s}', 'a').replace('{z}', z).replace('{x}', x).replace('{y}', y));
  }
  return out;
}
window.saveArea = async () => {
  if (!navigator.onLine) return toast('ต้องมีสัญญาณก่อนจึงบันทึกแผนที่ได้');
  const sw = navigator.serviceWorker && (navigator.serviceWorker.controller || (await navigator.serviceWorker.ready).active);
  if (!sw) return toast('ยังเตรียมโหมดออฟไลน์ไม่เสร็จ ลองใหม่อีกครั้ง');
  const m = cur.map, z = Math.round(m.getZoom()), b = m.getBounds().pad(0.15), base = BASES[mapState.layer] || BASES.longdo;
  if (z < 14) return toast('ซูมเข้าให้เห็นพื้นที่หน้างานก่อน (ไม่เกินประมาณ 3 กม.)');
  const z1 = Math.min(base.max, Math.max(z + 2, 18)), urls = tileUrls(base, b, Math.max(13, z - 2), z1);
  if (urls.length > 1500) return toast(`พื้นที่กว้างเกินไป (${urls.length} แผ่น) ซูมเข้าอีกนิด`);
  if (!confirm(`บันทึกแผนที่ "${base.name}" บริเวณที่เห็นบนจอไว้ใช้ตอนไม่มีสัญญาณ\nประมาณ ${urls.length} แผ่น (~${Math.round(urls.length * 25 / 1024)} MB)`)) return;
  const ch = new MessageChannel(); const t = document.createElement('div'); t.className = 'toast'; t.textContent = 'กำลังบันทึกแผนที่…'; document.body.appendChild(t);
  ch.port1.onmessage = ev => { const d = ev.data; t.textContent = `บันทึกแผนที่ ${d.done}/${d.total}${d.fail ? ` (พลาด ${d.fail})` : ''}`; if (d.end) { setTimeout(() => t.remove(), 2500); localStorage.setItem('ccs_saved_area', JSON.stringify({ t: Date.now(), n: d.done, name: base.name })); } };
  sw.postMessage({ type: 'saveTiles', urls }, [ch.port2]);
};
window.fitJob = () => { const pts = cur.job.poles.filter(p => p.lat != null).map(p => [p.lat, p.lng]); if (pts.length) cur.map.fitBounds(pts, { padding: [60, 60], maxZoom: 18 }); };

/* ---------- ระบบไฟฟ้าเดิม (ข้อมูลร่วมจาก SLD/GIS) ---------- */
const NET = { p: null, lines: null, poles: null, trs: null, err: '' };
function parseCsv(t) { const rows = t.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(l => l.split(',')); const h = rows.shift(); return rows.map(r => Object.fromEntries(h.map((k, i) => [k.trim(), r[i]]))); }
function loadNet() {
  if (NET.p) return NET.p;
  const get = (f, txt) => fetch(NET_BASE + f, { cache: 'force-cache' }).then(r => { if (!r.ok) throw new Error(f); return txt ? r.text() : r.json(); });
  NET.p = Promise.allSettled([get('mv-lines.json'), get('poles.json'), get('gis_transformers.csv', true)]).then(([a, b, c]) => {
    if (a.status === 'fulfilled') NET.lines = a.value; if (b.status === 'fulfilled') NET.poles = b.value;
    if (c.status === 'fulfilled') NET.trs = parseCsv(c.value).filter(x => +x.Lat && +x.Lon);
    if (!NET.lines && !NET.poles) NET.err = 'โหลดข้อมูลระบบเดิมไม่ได้';
  });
  return NET.p;
}
function drawNetLines() {
  if (!cur.map || !NET.lines) return; cur.netLines.clearLayers();
  for (const [fd, arr] of Object.entries(NET.lines.lines || {})) {
    const col = (NET.lines.colors || {})[fd] || '#777';
    arr.forEach(l => L.polyline(l.v, { color: col, weight: 2.5, opacity: 0.6, renderer: cur.cv, interactive: false }).addTo(cur.netLines));
  }
}
function poleNo(p) { const pre = NET.poles.prefix[p[3]] || ''; return p[4] ? pre + String(p[4]).padStart(9, '0') : ''; }
function drawNetPts(job) {
  if (!cur.map || !mapState.net) return; cur.netPts.clearLayers();
  const z = cur.map.getZoom(), b = cur.map.getBounds().pad(0.1);
  if (z >= 16 && NET.poles) {
    let n = 0;
    for (const p of NET.poles.poles) {
      if (!b.contains([p[0], p[1]])) continue; if (++n > 1500) break;
      const volt = NET.poles.volt[p[2]], col = PCOL[poleCls(p[6], volt)], asm = NET.poles.assembly[p[5]] || '';
      const lab = z >= 19 ? `<span class="pl" style="font-weight:600"><small>${[fH(p[6]), asm].filter(Boolean).join(' · ')}</small></span>` : '';
      const mk = L.marker([p[0], p[1]], { icon: L.divIcon({ className: '', html: `<div class="pm"><i class="sq ${z >= 19 ? '' : 'n'}" style="background:${col};opacity:.9"></i>${lab}</div>`, iconSize: [110, 20], iconAnchor: z >= 19 ? [9, 9] : [6, 6] }) }).addTo(cur.netPts);
      mk.on('click', e => { L.DomEvent.stopPropagation(e); onNetPole(job, p); });
    }
  }
  if (z >= 15 && NET.trs) {
    NET.trs.forEach(t => { const ll = [+t.Lat, +t.Lon]; if (!b.contains(ll)) return;
      L.marker(ll, { icon: L.divIcon({ className: '', html: '<i class="tri"></i>', iconSize: [18, 16], iconAnchor: [9, 12] }) }).addTo(cur.netPts)
        .bindTooltip(`หม้อแปลงเดิม ${esc(t.TransformerID)} · ${esc(t.RatedKVA)} kVA · ${esc(t.Feeder)}<br>${esc(t.Location || '')}`); });
  }
}
function onNetPole(job, p) {
  const no = poleNo(p), asm = NET.poles.assembly[p[5]] || '', volt = NET.poles.volt[p[2]];
  const info = `เสาเดิม ${no || '(ไม่มีเลข)'} · ${volt}${p[6] ? ' · ' + p[6] + ' ม.' : ''}${asm ? ' · ' + asm : ''}`;
  if (mapState.tool === 'sel' || mapState.tool === 'tr' || mapState.tool === 'guy' || mapState.tool === 'meter') {
    L.popup().setLatLng([p[0], p[1]]).setContent(`<b>${esc(info)}</b><br><button class="btn sm p" style="margin-top:6px" onclick="useNetPole(${p[0]},${p[1]})">ใช้เป็นจุดเชื่อม</button>`).openOn(cur.map); return;
  }
  const ex = useNetPole(p[0], p[1], true, no, info);
  if (mapState.tool === 'pole' || mapState.tool === 'expole') { mapState.sel = ex.id; drawMap(job); renderSheet(job); toast('เลือกเสาเดิมเป็นจุดเชื่อม · แตะแผนที่เพื่อปักเสาใหม่ต่อจากต้นนี้'); }
  else if (mapState.tool === 'span') onPoleClick(job, ex);
}
window.useNetPole = (lat, lng, quiet, no, info) => {
  const job = cur.job; let ex = job.poles.find(q => q.lat === lat && q.lng === lng);
  if (!ex) {
    if (no === undefined) { const p = NET.poles?.poles.find(q => q[0] === lat && q[1] === lng); no = p ? poleNo(p) : ''; info = p ? `${NET.poles.volt[p[2]]}${p[6] ? ' ' + p[6] + ' ม.' : ''} ${NET.poles.assembly[p[5]] || ''}`.trim() : ''; }
    pushHist(job); ex = newPole(job, lat, lng, true); ex.note = (no ? 'เลขเสา ' + no + ' · ' : '') + (info || '').replace(/^เสาเดิม\s*\S*\s*·?\s*/, ''); ex.no = no || '';
    const np = NET.poles?.poles.find(q => q[0] === lat && q[1] === lng); if (np) { ex.h = np[6] || 0; ex.volt = NET.poles.volt[np[2]]; ex.head = NET.poles.assembly[np[5]] || ''; }
    job.poles.push(ex); saveJob(job);
  }
  if (!quiet) { cur.map.closePopup(); mapState.sel = ex.id; drawMap(job); renderSheet(job); }
  return ex;
};
window.toggleNet = () => { mapState.net = !mapState.net; const m = cur.map; if (mapState.net) { cur.netLines.addTo(m); cur.netPts.addTo(m); drawNetPts(cur.job); } else { m.removeLayer(cur.netLines); m.removeLayer(cur.netPts); } const b = $('#netBtn'); b.style.background = mapState.net ? '#5B1A63' : '#fff'; b.style.color = mapState.net ? '#fff' : ''; };

/* ---------- span editor ---------- */
function wireOptions(sel, k) {
  const list = Object.keys(DB.rates).filter(c => LINE_TYPES.some(t => DB.rates[c][t]) && DB.items[c]?.[2] !== 0 && /CABLE|COND|WIRE,AL|CONDUCTOR/.test(iname(c)) && !/STEEL/.test(iname(c)));
  const pri = c => (k === 'HV' ? /33 KV|22 KV|PARTIALLY|ACSR|AL.BARE|AL-ALLOY|SPACER|TAC|TWISTED/i : /750 V|LV|AL.BARE|ABC|COMPACT/i).test(iname(c)) ? 0 : 1;
  return list.sort((a, b) => pri(a) - pri(b) || iname(a).localeCompare(iname(b))).map(c => `<option value="${c}" ${c === sel ? 'selected' : ''}>${c} · ${esc(iname(c))}</option>`).join('');
}
function openSpan(job, s, after) {
  const a = poleById(job, s.a), b = poleById(job, s.b), auto = (a?.lat != null && b?.lat != null) ? Math.round(hav(a, b)) : null;
  modal(`ช่วงสาย ${a?.label || ''}${a ? '–' : ''}${b?.label || ''}`, `
    <div class="stack">
      <div class="fld"><label>ชนิด</label><div class="seg" id="sp_k">${['HV', 'LV'].map(k => `<button type="button" data-v="${k}" class="${s.k === k ? 'on' : ''}">${k === 'HV' ? 'แรงสูง' : 'แรงต่ำ'}</button>`).join('')}</div></div>
      <div class="fld"><label for="sp_w">สายไฟ (รหัสพัสดุ)</label><select id="sp_w" class="in">${wireOptions(s.w, s.k)}</select></div>
      <div class="grid2"><div class="fld"><label for="sp_n">จำนวนเส้น</label><input id="sp_n" class="in" type="number" min="1" step="1" value="${s.n}"></div>
      <div class="fld"><label for="sp_len">ความยาว (ม.)${auto != null ? ` · แผนที่ ${auto}` : ''}</label><input id="sp_len" class="in" type="number" min="0" step="1" value="${s.len ?? ''}" placeholder="${auto ?? 'ระบุความยาว'}"></div></div>
      <div class="fld"><label for="sp_lt">อัตราค่าแรงพาดสาย</label><select id="sp_lt" class="in"><option value="">ตามค่าตั้งของงาน</option>${LINE_TYPES.filter(t => DB.rates[s.w]?.[t]).map(t => `<option value="${t}" ${s.lt === t ? 'selected' : ''}>${DB.types[t]}</option>`).join('')}</select></div>
      <p class="s12 muted" style="margin:0">ค่าแรงพาดสาย = ความยาว × จำนวนเส้น ÷ ${S.cfg.lineDiv} × อัตราในไฟล์ค่าแรง (เปลี่ยนตัวหารได้ที่หน้าตั้งค่า)</p>
    </div>`, `<button class="btn d" id="sp_del">ลบช่วงนี้</button><span style="flex:1"></span><button class="btn p" id="sp_ok">บันทึก</button>`, box => {
    $('#sp_k', box).onclick = e => { const bt = e.target.closest('button'); if (!bt) return; $$('#sp_k button', box).forEach(x => x.classList.toggle('on', x === bt)); };
    $('#sp_ok', box).onclick = () => { s.k = $('#sp_k .on', box).dataset.v; s.w = $('#sp_w', box).value; s.n = Math.max(1, num($('#sp_n', box).value)); const lv = $('#sp_len', box).value; s.len = lv === '' ? null : num(lv); const lt = $('#sp_lt', box).value; s.lt = lt === '' ? null : +lt; saveJob(job); closeModal(); after ? after() : (drawMap(job), renderSheet(job)); };
    $('#sp_del', box).onclick = () => { if (!confirm('ลบช่วงสายนี้?')) return; pushHist(job); job.spans = job.spans.filter(x => x.id !== s.id); saveJob(job); closeModal(); after ? after() : (drawMap(job), renderSheet(job)); };
  });
}

/* ---------- modal ---------- */
function modal(title, body, foot, onOpen) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="box" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hd"><b>${esc(title)}</b><button class="x" aria-label="ปิด" onclick="closeModal()">×</button></div><div class="bd">${body}</div>${foot ? `<div class="ft">${foot}</div>` : ''}</div>`;
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  document.body.appendChild(m); onOpen && onOpen(m);
}
window.closeModal = () => $('#modal')?.remove();

/* ---------- picker (sets / items) ---------- */
const PRESET = { tr: { tab: 'set', q: 'TR.INST', cat: 'TRM', title: 'เลือกชุดติดตั้งหม้อแปลง' }, guy: { tab: 'set', q: 'GUY', title: 'เลือกชุดยึดโยง' }, meter: { tab: 'set', q: 'METER INS', cat: 'TRM', title: 'เลือกชุดติดตั้งมิเตอร์' }, set: { tab: 'set', q: '', title: 'เพิ่มชุด Set' }, item: { tab: 'item', q: '', title: 'เพิ่มพัสดุเดี่ยว' }, transformer: { tab: 'item', q: 'TRANSFORMER', title: 'เลือกหม้อแปลง' } };
function openPicker({ job, pole, preset = 'set', after }) {
  const P = PRESET[preset]; const st = { tab: P.tab, q: P.q, cat: P.cat || (job.volt === '33' ? '' : '') };
  modal(P.title + ` · ${pole.label}`, `
    <div class="stack">
      <div class="tabs" id="pk_tab"><button data-v="set" class="${st.tab === 'set' ? 'on' : ''}">ชุด Set</button><button data-v="item" class="${st.tab === 'item' ? 'on' : ''}">พัสดุเดี่ยว</button></div>
      <div class="row"><label class="sr" for="pk_q">ค้นหา</label><input id="pk_q" class="in" placeholder="ค้นหารหัสหรือชื่อ เช่น 30213, GUY, TR.INST" value="${esc(st.q)}"><select id="pk_cat" class="in" style="max-width:130px" aria-label="หมวด"><option value="">ทุกหมวด</option><option value="HV33" ${st.cat === 'HV33' ? 'selected' : ''}>ระบบ 33 kV</option><option value="LV" ${st.cat === 'LV' ? 'selected' : ''}>ระบบแรงต่ำ</option><option value="TRM" ${st.cat === 'TRM' ? 'selected' : ''}>หม้อแปลง/มิเตอร์</option></select></div>
      <div id="pk_res" class="list"></div>
    </div>`, '', box => {
    const res = $('#pk_res', box);
    const render = () => {
      const q = $('#pk_q', box).value.trim().toUpperCase(), cat = $('#pk_cat', box).value, words = q.split(/\s+/).filter(Boolean);
      $('#pk_cat', box).style.display = st.tab === 'set' ? '' : 'none';
      let rows = [];
      if (st.tab === 'set') {
        for (const [c, s] of Object.entries(DB.sets)) { if (!s.i.length) continue; if (cat && s.c !== cat) continue; const hay = (c + ' ' + s.n).toUpperCase(); if (words.every(w => hay.includes(w))) rows.push([c, s.n, `${s.i.length} รายการ · ค่าแรง ${fm(setLabour(c, job.case))}`]); if (rows.length >= 80) break; }
      } else {
        for (const [c, it] of Object.entries(DB.items)) { if (it[2] === 0) continue; const hay = (c + ' ' + it[0]).toUpperCase(); if (words.every(w => hay.includes(w))) rows.push([c, it[0], `${it[1]} · ค่าแรง ${fm(labourRate(c, job.case).rate)}${S.prices[c] != null ? ' · ราคา ' + fm(S.prices[c]) : ''}`]); if (rows.length >= 80) break; }
      }
      res.innerHTML = rows.length ? rows.map(([c, n, m]) => `<div class="li"><div class="grow"><div class="code">${c}</div><div class="s14">${esc(n)}</div><div class="s12 muted">${m}</div></div>${st.tab === 'set' ? `<button class="btn sm g" data-view="${c}">ดู</button>` : ''}<button class="btn sm p" data-add="${c}">เพิ่ม</button></div>`).join('') : '<div class="empty">ไม่พบรายการ</div>';
    };
    $('#pk_q', box).oninput = render; $('#pk_cat', box).onchange = render;
    $('#pk_tab', box).onclick = e => { const b = e.target.closest('button'); if (!b) return; st.tab = b.dataset.v; $$('#pk_tab button', box).forEach(x => x.classList.toggle('on', x === b)); render(); };
    res.onclick = e => {
      const v = e.target.closest('[data-view]'), a = e.target.closest('[data-add]');
      if (v) return showSet(v.dataset.view, job);
      if (a) {
        const c = a.dataset.add, arr = st.tab === 'set' ? pole.sets : pole.items, ex = arr.find(x => x.c === c);
        ex ? ex.q++ : arr.push({ c, q: 1 }); saveJob(job); toast(`เพิ่ม ${c} ที่ ${pole.label}`);
        if (preset === 'tr' && st.tab === 'set' && !pole.items.some(i => groupOfItem(i.c) === 'tr')) { closeModal(); return openPicker({ job, pole, preset: 'transformer', after }); }
        if (['tr', 'guy', 'meter', 'transformer'].includes(preset)) { closeModal(); after ? after() : (drawMap(job), renderSheet(job)); }
        else if (after) after();
      }
    };
    render(); setTimeout(() => $('#pk_q', box).focus(), 50);
  });
}
function setLabour(code, c) { const s = DB.sets[code]; return s ? s.i.reduce((a, [ic, q]) => a + labourOf(ic, q, c).lab, 0) : 0; }
function showSet(code, job) {
  const s = DB.sets[code]; const c = job?.case || 0;
  const prev = $('#modal'); prev && (prev.style.display = 'none');
  const m = document.createElement('div'); m.className = 'modal'; m.style.zIndex = 2100;
  m.innerHTML = `<div class="box"><div class="hd"><b>${code}</b><button class="x" aria-label="ปิด">×</button></div><div class="bd"><p class="b" style="margin-top:0">${esc(s.n)}</p>${DB.dwg[code] ? `<p style="margin-top:-6px"><a href="/pea-drawings/d/${DB.dwg[code]}" target="_blank" rel="noopener">ดูแบบประกอบในคลังแบบมาตรฐาน ↗</a></p>` : ''}<div class="scroll"><table class="tbl"><thead><tr><th>รหัส</th><th>รายการ</th><th class="r">จำนวน</th><th>หน่วย</th><th class="r">นำกลับ</th><th class="r">ค่าแรง</th></tr></thead><tbody>${s.i.map(([ic, q, r]) => `<tr><td class="code">${ic}</td><td>${esc(iname(ic))}</td><td class="r">${fq(q)}</td><td>${esc(iunit(ic))}</td><td class="r">${r ? fq(r) : '—'}</td><td class="r">${fm(labourOf(ic, q, c).lab)}</td></tr>`).join('')}</tbody></table></div><p class="kv b"><span>รวมค่าแรงชุดนี้ (กรณีที่ ${c + 1})</span><span>${fm(setLabour(code, c))}</span></p></div></div>`;
  const close = () => { m.remove(); prev && (prev.style.display = ''); };
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('.x')) close(); });
  document.body.appendChild(m);
}
window.showSet = showSet;

/* ---------- รูปถ่ายหัวเสา ---------- */
const IDB = (() => { let dbp; const open = () => dbp || (dbp = new Promise((res, rej) => { const r = indexedDB.open('ccs_photos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = (m, f) => open().then(db => new Promise((res, rej) => { const t = db.transaction('p', m), st = t.objectStore('p'), q = f(st); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }));
  return { get: k => tx('readonly', st => st.get(k)), put: (k, v) => tx('readwrite', st => st.put(v, k)), del: k => tx('readwrite', st => st.delete(k)) }; })();
function shrink(file, max, q) { return new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', q)); }; img.onerror = () => rej(new Error('เปิดรูปไม่ได้')); img.src = u; }); }
async function photoData(ph, full) {
  let v = await IDB.get(ph.id).catch(() => null);
  if (v) return full ? v.full || v.thumb : v.thumb || v.full;
  if (!S.cfg.gasUrl) return '';
  try { const j = await (await fetch(S.cfg.gasUrl + '?action=photo&id=' + encodeURIComponent(ph.id))).json(); if (j.ok && j.data) { const th = j.thumb || j.data; await IDB.put(ph.id, { full: j.data, thumb: th }); return full ? j.data : th; } } catch (e) {}
  return '';
}
const upBusy = new Set();
async function uploadPending(job) {
  if (!S.cfg.gasUrl || upBusy.has(job.id)) return; upBusy.add(job.id); let ch = false;
  try {
  for (const p of job.poles) for (const ph of p.photos || []) {
    if (ph.up) continue; const v = await IDB.get(ph.id).catch(() => null); if (!v) continue;
    try { await gas('savePhoto', { id: ph.id, jobId: job.id, poleId: p.id, data: v.full, thumb: v.thumb }); ph.up = true; ch = true; } catch (e) { break; }
  }
  } finally { upBusy.delete(job.id); }
  if (ch) saveJob(job);
}
window.addPhotos = async files => {
  const j = cur.job, p = cur.pole; if (!files || !files.length) return; p.photos = p.photos || [];
  toast('กำลังบันทึกรูป…');
  for (const f of files) { try { const full = await shrink(f, 1600, 0.72), thumb = await shrink(f, 320, 0.7), id = 'ph_' + uid(); await IDB.put(id, { full, thumb }); p.photos.push({ id, t: Date.now(), up: false }); } catch (e) { toast(e.message); } }
  saveJob(j); upBusy.delete('_'); vPole(j, p.id); setTimeout(() => uploadPending(j).then(() => { if (cur.pole === p && location.hash.startsWith('#pole/')) vPole(j, p.id); }), 300);
};
window.viewPhoto = async i => {
  const p = cur.pole, ph = p.photos[i]; const src = await photoData(ph, true);
  modal(`รูป ${p.label} (${i + 1}/${p.photos.length})`, src ? `<img src="${src}" alt="รูปหัวเสา ${esc(p.label)}" style="width:100%;border-radius:10px"><p class="s12 muted">${new Date(ph.t).toLocaleString('th-TH')}${ph.up ? ' · อยู่บน Google Sheet แล้ว' : ' · ยังไม่ได้อัปโหลด'}</p>` : '<div class="empty">โหลดรูปไม่ได้</div>',
    `<button class="btn d" id="ph_del">ลบรูป</button><span style="flex:1"></span>${src ? `<a class="btn g" href="${src}" download="${esc(p.label)}_${i + 1}.jpg">บันทึกไฟล์</a>` : ''}`, box => {
    $('#ph_del', box).onclick = async () => { if (!confirm('ลบรูปนี้?')) return; p.photos.splice(i, 1); IDB.del(ph.id).catch(() => {}); if (S.cfg.gasUrl && ph.up) gas('deletePhoto', { id: ph.id }).catch(() => {}); saveJob(cur.job); closeModal(); vPole(cur.job, p.id); };
  });
};
async function fillThumbs(p) { for (const [i, ph] of (p.photos || []).entries()) { const el = $(`#th_${i}`); if (!el) return; const d = await photoData(ph, false); if (d && el.isConnected) el.src = d; } }

/* ---------- pole editor ---------- */
function vPole(job, pid) {
  const p = poleById(job, pid); if (!p) return go((job.kind === 'quick' ? 'list/' : 'map/') + job.id);
  const back = job.kind === 'quick' ? `#list/${job.id}` : `#map/${job.id}`;
  const ang = poleAngle(job, p), sug = suggestSets(job, p);
  const poles = Object.entries(DB.items).filter(([c, i]) => /^POLE,\s?(CONCRETE|STEEL)/.test(i[0]) && i[2] !== 0);
  const lab = (() => { const tmp = { ...job, poles: [p], spans: [] }; return computeBOM(tmp); })();
  const qrow = (arr, i, x, kind) => `<div class="li"><div class="grow"><div class="code">${x.c}</div><div class="s14">${esc(iname(x.c))}</div><div class="s12 muted">${kind === 'set' ? `${DB.sets[x.c]?.i.length || 0} รายการ · ค่าแรง ${fm(setLabour(x.c, job.case) * x.q)}` : `${esc(iunit(x.c))} · ค่าแรง ${fm(labourOf(x.c, num(x.q), job.case).lab)}`}</div></div>
    ${kind === 'set' ? `<button class="btn sm g" onclick="showSet('${x.c}',cur.job)">ดู</button>` : ''}
    <div class="qty"><button aria-label="ลด" onclick="pq('${kind}',${i},-1)">−</button><input aria-label="จำนวน" value="${x.q}" inputmode="decimal" onchange="pq('${kind}',${i},0,this.value)"><button class="plus" aria-label="เพิ่ม" onclick="pq('${kind}',${i},1)">+</button></div></div>`;
  app.innerHTML = topbar(`${p.label}${ang.dev != null ? ' · มุมเลี้ยว ' + ang.dev + '°' : ''}`, p.lat != null ? `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}` : job.name, back) + `
  <div class="main"><div class="wrap stack" style="max-width:760px">
    <div class="card stack">
      <div class="grid2"><div class="fld"><label for="p_lab">ชื่อเสา/รายการ</label><input id="p_lab" class="in" value="${esc(p.label)}" onchange="pset('label',this.value)"></div>
      <div class="fld"><label>ประเภท</label><div class="seg"><button class="${!p.ex ? 'on' : ''}" onclick="pset('ex',false)">เสาใหม่</button><button class="${p.ex ? 'on' : ''}" onclick="pset('ex',true)">เสาเดิม</button></div></div></div>
      ${p.ex ? `<span class="s13 muted">เสาเดิม: ไม่คิดค่าเสา คิดเฉพาะชุด Set/พัสดุที่เพิ่ม${p.no ? ' · เลขเสา ' + esc(p.no) : ''}</span>` : `<div class="fld"><label for="p_pole">ชนิดเสา</label><select id="p_pole" class="in" onchange="pset('pole',this.value)"><option value="">— ไม่ปักเสา —</option>${poles.map(([c, i]) => `<option value="${c}" ${p.pole === c ? 'selected' : ''}>${esc(i[0])} (ค่าแรง ${fm(labourRate(c, job.case).rate)})</option>`).join('')}</select></div>`}
      <div class="grid2">
        <div class="fld"><label for="p_h">ขนาดเสา</label><select id="p_h" class="in" onchange="pset('h',num(this.value))"><option value="0">${!p.ex && p.pole ? 'ตามชนิดเสา (' + (fH(poleH({ pole: p.pole })) || '—') + ')' : 'ไม่ทราบ'}</option>${[8, 9, 12, 12.2, 14, 14.3, 16, 22].map(v => `<option value="${v}" ${+p.h === v ? 'selected' : ''}>${v} ม.${v === 22 ? ' (115 kV)' : ''}</option>`).join('')}</select></div>
        <div class="fld"><label for="p_head">หัวเสา</label><select id="p_head" class="in" onchange="pset('head',this.value)"><option value="">${(() => { const t = poleHead({ ...p, head: '' }); return t ? 'ตามชุด Set (' + esc(t) + ')' : 'ไม่ระบุ'; })()}</option>${[...new Set([...HEAD_OPTS, p.head].filter(Boolean))].map(v => `<option ${p.head === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      </div>
      <div class="row s13"><i class="sq" style="background:${PCOL[poleCls(poleH(p), p.volt)]}"></i><span>${PCLS_TXT[poleCls(poleH(p), p.volt)]}${poleHead(p) ? ' · หัวเสา ' + esc(poleHead(p)) : ''}</span></div>
    </div>
    <div class="card stack"><div class="row" style="justify-content:space-between"><b>รูปถ่ายหัวเสา (${(p.photos || []).length})</b>
      <div class="row"><label class="btn sm p" for="p_cam">ถ่ายรูป</label><input id="p_cam" type="file" accept="image/*" capture="environment" class="sr" onchange="addPhotos(this.files)"><label class="btn sm g" for="p_file">เลือกรูป</label><input id="p_file" type="file" accept="image/*" multiple class="sr" onchange="addPhotos(this.files)"></div></div>
      ${(p.photos || []).length ? `<div class="ph">${p.photos.map((ph, i) => `<button onclick="viewPhoto(${i})" aria-label="ดูรูปที่ ${i + 1}"><img id="th_${i}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><span class="pend" ${ph.up ? 'hidden' : ''}>รออัปโหลด</span></button>`).join('')}</div>` : '<span class="s13 muted">ถ่ายหัวเสาเพื่อดูว่าเป็นแบบไหน มีอุปกรณ์อะไรติดอยู่</span>'}
    </div>
    ${sug.length ? `<div class="card stack"><b class="s14">ชุด Set ที่แนะนำ ${ang.n <= 1 ? '(เสาปลายสาย)' : ang.dev != null ? `(มุม ${ang.dev}°)` : ''}</b><div class="tabs">${sug.map(c => `<button onclick="addSet('${c}')" title="${esc(DB.sets[c].n)}">+ ${c} ${esc(DB.sets[c].n.slice(0, 38))}</button>`).join('')}</div></div>` : ''}
    <div class="card"><div class="row" style="justify-content:space-between"><b>ชุด Set (${p.sets.length})</b><div class="row"><a class="btn sm g" href="/pea-drawings/index.html" target="_blank" rel="noopener">คลังแบบ ↗</a><button class="btn sm" onclick="pick('set')">+ ชุด Set</button></div></div>
      <div class="list">${p.sets.map((x, i) => qrow(p.sets, i, x, 'set')).join('') || '<div class="empty s13">ยังไม่มีชุด Set</div>'}</div></div>
    <div class="card"><div class="row" style="justify-content:space-between"><b>พัสดุเดี่ยว (${p.items.length})</b><div class="row"><button class="btn sm g" onclick="pick('transformer')">+ หม้อแปลง</button><button class="btn sm" onclick="pick('item')">+ พัสดุ</button></div></div>
      <div class="list">${p.items.map((x, i) => qrow(p.items, i, x, 'item')).join('') || '<div class="empty s13">เช่น หม้อแปลง มิเตอร์ หรือพัสดุนอกชุด</div>'}</div></div>
    <div class="card stack"><div class="fld"><label for="p_note">หมายเหตุ</label><textarea id="p_note" class="in" rows="2" onchange="pset('note',this.value)">${esc(p.note)}</textarea></div></div>
    <div class="card"><div class="kv"><span class="muted">ค่าแรง${p.ex ? '' : 'รวมปักเสา'} (กรณีที่ ${job.case + 1})</span><b>${fm(lab.lab)} บาท</b></div>
      <div class="kv"><span class="muted">ค่าวัสดุ (${lab.mats.length} รายการ${lab.noPrice ? `, ยังไม่มีราคา ${lab.noPrice}` : ''})</span><b>${fm(lab.mat)} บาท</b></div></div>
    <a class="btn p" href="${back}">เสร็จ</a>
  </div></div>${navbar(job, job.kind === 'quick' ? 'list' : 'map')}`;
  cur.pole = p; fillThumbs(p); uploadPending(job);
}
window.pset = (k, v) => { if ((k === 'h' && !v) || (k === 'head' && !v)) delete cur.pole[k]; else cur.pole[k] = v; saveJob(cur.job); vPole(cur.job, cur.pole.id); };
window.addSet = c => { const p = cur.pole, ex = p.sets.find(x => x.c === c); ex ? ex.q++ : p.sets.push({ c, q: 1 }); saveJob(cur.job); vPole(cur.job, p.id); };
window.pq = (kind, i, d, v) => { const arr = kind === 'set' ? cur.pole.sets : cur.pole.items; const x = arr[i]; x.q = v != null ? num(v) : Math.round((num(x.q) + d) * 1000) / 1000; if (x.q <= 0) arr.splice(i, 1); saveJob(cur.job); vPole(cur.job, cur.pole.id); };
window.pick = preset => openPicker({ job: cur.job, pole: cur.pole, preset, after: () => vPole(cur.job, cur.pole.id) });

/* ---------- list view (all poles + spans) ---------- */
function vList(job) {
  const back = job.kind === 'quick' ? '#quick' : `#map/${job.id}`;
  app.innerHTML = topbar(job.name, job.kind === 'quick' ? 'ประมาณราคาด่วน' : 'รายการเสาและช่วงสาย', back, `<a class="ib" href="#info/${job.id}" aria-label="ข้อมูลงาน">${I.gear}</a>`) + `
  <div class="main"><div class="wrap stack" style="max-width:760px">
    <div class="card"><div class="row" style="justify-content:space-between"><b>เสา / จุดติดตั้ง (${job.poles.length})</b><button class="btn sm" onclick="addListPole()">+ เพิ่ม</button></div>
      <div class="list">${job.poles.map(p => `<a class="li" href="#pole/${job.id}/${p.id}" style="text-decoration:none;color:inherit"><span class="chip st1">${esc(p.label)}</span><div class="grow"><div class="s14 row" style="gap:6px"><i class="sq" style="background:${PCOL[poleCls(poleH(p), p.volt)]};width:12px;height:12px"></i>${p.ex ? 'เสาเดิม' : esc(p.pole ? iname(p.pole) : 'ไม่ปักเสา')}${poleHead(p) ? ' · ' + esc(poleHead(p)) : ''}${p.photos?.length ? ' · รูป ' + p.photos.length : ''}</div><div class="s12 muted">${p.sets.map(s => s.c + (s.q > 1 ? '×' + s.q : '')).join(', ') || '—'}${p.items.length ? ' · พัสดุ ' + p.items.length : ''}</div></div><span class="muted">›</span></a>`).join('') || '<div class="empty s13">ยังไม่มีรายการ</div>'}</div></div>
    <div class="card"><div class="row" style="justify-content:space-between"><b>ช่วงสาย (${job.spans.length})</b><button class="btn sm" onclick="addListSpan()">+ สาย</button></div>
      <div class="list">${job.spans.map((s, i) => { const a = poleById(job, s.a), b = poleById(job, s.b); return `<button class="li" style="width:100%;border:0;background:none;text-align:left;cursor:pointer" onclick="editListSpan(${i})"><span class="chip ${s.k === 'HV' ? 'st1' : 'st2'}">${s.k}</span><div class="grow"><div class="s14">${a ? esc(a.label) + '–' + esc(b?.label || '') + ' · ' : ''}${spanLen(job, s)} ม. × ${s.n} เส้น</div><div class="s12 muted">${s.w} ${esc(iname(s.w))}</div></div><span class="muted">›</span></button>`; }).join('') || '<div class="empty s13">ยังไม่มีช่วงสาย</div>'}</div></div>
    <a class="btn p" href="#bom/${job.id}">ถอดแบบประมาณการ →</a>
  </div></div>${navbar(job, 'list')}`;
}
window.addListPole = () => { const j = cur.job, p = newPole(j, null, null); j.poles.push(p); saveJob(j); go(`pole/${j.id}/${p.id}`); };
window.addListSpan = () => { const j = cur.job, s = newSpan(j, null, null, 'HV'); s.len = 100; j.spans.push(s); saveJob(j); openSpan(j, s, () => vList(j)); };
window.editListSpan = i => openSpan(cur.job, cur.job.spans[i], () => vList(cur.job));

/* ---------- quick quote ---------- */
const QUICK = [
  { k: 'pole', n: 'ปักเสา 1 ต้น', s: 'คอร. 12.20 ม. + คอน 3 เฟส ทางตรง', make: j => { const p = newPole(j, null, null); p.label = 'ปักเสา'; p.sets = [{ c: '30201', q: 1 }]; j.poles.push(p); return p; } },
  { k: 'tr3', n: 'หม้อแปลง 3 เฟส', s: '33 kV เสาเดี่ยว 14 ม. (ชุด 40310)', make: j => { const p = newPole(j, null, null); p.label = 'หม้อแปลง 3 เฟส'; p.pole = '1000010006'; p.sets = [{ c: '40310', q: 1 }]; p.items = [{ c: '1050010102', q: 1 }]; j.poles.push(p); return p; } },
  { k: 'tr1', n: 'หม้อแปลง 1 เฟส', s: 'CSP 19 kV เสาเดี่ยว (ชุด 40304)', make: j => { j.phase = 1; const p = newPole(j, null, null); p.label = 'หม้อแปลง 1 เฟส'; p.sets = [{ c: '40304', q: 1 }]; p.items = [{ c: '1050000202', q: 1 }]; j.poles.push(p); return p; } },
  { k: 'hv', n: 'พาดสายแรงสูง', s: '100 ม. × 3 เส้น', make: j => { const s = newSpan(j, null, null, 'HV'); s.len = 100; j.spans.push(s); } },
  { k: 'lv', n: 'พาดสายแรงต่ำ', s: '100 ม. × 4 เส้น', make: j => { const s = newSpan(j, null, null, 'LV'); s.len = 100; j.spans.push(s); } },
  { k: 'meter', n: 'ติดตั้งมิเตอร์', s: 'เลือกชุดติดตั้งมิเตอร์', make: j => { const p = newPole(j, null, null); p.label = 'มิเตอร์'; p.ex = true; p.pole = ''; j.poles.push(p); return p; }, then: (j, p) => openPicker({ job: j, pole: p, preset: 'meter', after: () => go(`pole/${j.id}/${p.id}`) }) },
  { k: 'blank', n: 'เริ่มจากรายการว่าง', s: 'เพิ่มชุด Set/พัสดุเอง', make: () => null }
];
function vQuick() {
  const quick = Object.values(S.jobs).filter(j => j.kind === 'quick').sort((a, b) => b.updated - a.updated).slice(0, 8);
  app.innerHTML = topbar('ประมาณราคาด่วน', 'เลือกงานสำเร็จรูป → ได้รายการและราคาทันที', '#home') + `
  <div class="main"><div class="wrap stack" style="max-width:760px">
    <div class="grid2">${QUICK.map((q, i) => `<button class="tile" onclick="startQuick(${i})"><b>${q.n}</b><span class="s12 muted">${q.s}</span></button>`).join('')}</div>
    ${quick.length ? `<b>ราคาด่วนล่าสุด</b><div class="stack">${quick.map(jobCard).join('')}</div>` : ''}
  </div></div>${navbar(null, 'quick')}`;
}
window.startQuick = i => {
  const q = QUICK[i], j = newJob('quick'); j.name = q.n; const p = q.make(j); saveJob(j); cur.job = j;
  if (q.then) { go(`list/${j.id}`); setTimeout(() => q.then(j, p), 80); }
  else if (p) go(`pole/${j.id}/${p.id}`); else go(`list/${j.id}`);
};

/* ---------- schematic svg ---------- */
function schematic(job, w = 340, h = 200) {
  const pts = job.poles.filter(p => p.lat != null);
  if (pts.length < 1) return '';
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, kx = Math.cos(lat0 * Math.PI / 180);
  const xs = pts.map(p => p.lng * kx), ys = pts.map(p => -p.lat);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const pad = 26, sc = Math.min((w - pad * 2) / Math.max(maxx - minx, 1e-6), (h - pad * 2) / Math.max(maxy - miny, 1e-6));
  const ox = (w - (maxx - minx) * sc) / 2, oy = (h - (maxy - miny) * sc) / 2;
  const P = p => [ox + (p.lng * kx - minx) * sc, oy + (-p.lat - miny) * sc];
  let s = `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="ผังงานก่อสร้าง ${esc(job.name)}" style="background:#F7F5F8;border-radius:8px;font-family:Sarabun">`;
  job.spans.forEach(sp => { const a = poleById(job, sp.a), b = poleById(job, sp.b); if (!a || !b || a.lat == null || b.lat == null) return; const [x1, y1] = P(a), [x2, y2] = P(b);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${sp.k === 'HV' ? '#5B1A63' : '#0F7C8C'}" stroke-width="${sp.k === 'HV' ? 3 : 2.5}" ${sp.k === 'LV' ? 'stroke-dasharray="6 4"' : ''}/><text x="${(x1 + x2) / 2 + 4}" y="${(y1 + y2) / 2 - 4}" font-size="9" fill="#5E5664">${spanLen(job, sp)} ม.</text>`; });
  pts.forEach(p => { const [x, y] = P(p), tr = p.sets.some(z => groupOfSet(z.c) === 'tr');
    const col = PCOL[poleCls(poleH(p), p.volt)], inf = [fH(poleH(p)), poleHead(p)].filter(Boolean).join(' ');
    s += `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${col}" stroke="${p.ex ? '#1E1A22' : '#fff'}" stroke-width="1.5" ${p.ex ? 'stroke-dasharray="2 2"' : ''}/><text x="${x + 8}" y="${y + 12}" font-size="10" font-weight="700" fill="#1F1A24">${esc(p.label)}${inf ? `<tspan font-size="8" font-weight="400"> ${esc(inf)}</tspan>` : ''}</text>${tr ? `<path d="M${x + 8} ${y - 8} l7 -12 l7 12 z" fill="#D62828"/>` : ''}`; });
  s += `<g font-size="9" fill="#5E5664"><line x1="10" y1="${h - 12}" x2="26" y2="${h - 12}" stroke="#5B1A63" stroke-width="3"/><text x="30" y="${h - 9}">แรงสูง</text><line x1="70" y1="${h - 12}" x2="86" y2="${h - 12}" stroke="#0F7C8C" stroke-width="2.5" stroke-dasharray="6 4"/><text x="90" y="${h - 9}">แรงต่ำ</text><rect x="131" y="${h - 16}" width="8" height="8" fill="#fff" stroke="#1E1A22" stroke-dasharray="2 2"/><text x="142" y="${h - 9}">เสาเดิม</text><path d="M185 ${h - 7} l5 -9 l5 9 z" fill="#D62828"/><text x="198" y="${h - 9}">หม้อแปลง</text></g></svg>`;
  return s;
}

/* ---------- BOM ---------- */
let bomTab = 'mat';
function vBom(job) {
  const B = computeBOM(job), c = jobCounts(job);
  const gl = Object.entries(B.groups).filter(([, g]) => g.mat || g.lab);
  const labRows = B.contrib.filter(x => x.lab > 0);
  app.innerHTML = topbar('ถอดแบบประมาณการ', job.name, job.kind === 'quick' ? `#list/${job.id}` : `#map/${job.id}`) + `
  <div class="main"><div class="wrap">
   <div class="row noprint" style="flex-wrap:wrap;margin-bottom:12px;gap:8px">
     <div class="fld" style="min-width:220px"><label>สภาพพื้นที่</label><div class="seg">${[0, 1, 2].map(v => `<button class="${job.case === v ? 'on' : ''}" onclick="bset('case',${v})">กรณีที่ ${v + 1}</button>`).join('')}</div></div>
     <div class="fld" style="width:120px"><label for="b_oh">ค่าดำเนินการ %</label><input id="b_oh" class="in" type="number" step="0.01" value="${job.ohPct}" onchange="bset('ohPct',num(this.value))"></div>
     <div class="fld" style="width:100px"><label for="b_vat">VAT %</label><input id="b_vat" class="in" type="number" step="0.01" value="${job.vat}" onchange="bset('vat',num(this.value))"></div>
     <span style="flex:1"></span>
     <button class="btn g" onclick="exportXlsx()">ส่งออก Excel</button><button class="btn g" onclick="toProcure()">ส่งไประบบงานจัดซื้อ</button><button class="btn g" onclick="toCCL()">เปิดงานใน CCL</button><a class="btn p" href="#quote/${job.id}">ออกใบเสนอราคา</a>
   </div>
   <div class="cols">
    <aside class="side stack">
      ${schematic(job) ? `<div class="card stack"><b>ผังงาน</b>${schematic(job)}</div>` : ''}
      <div class="card"><b>สรุปประมาณการ</b>
        <div class="kv"><span>ค่าวัสดุ</span><span>${fm(B.mat)}</span></div>
        <div class="kv"><span>ค่าแรง (กรณีที่ ${job.case + 1})</span><span>${fm(B.lab)}</span></div>
        <div class="kv"><span>ค่าดำเนินการ ${job.ohPct}%</span><span>${fm(B.oh)}</span></div>
        <div class="kv"><span>VAT ${job.vat}%</span><span>${fm(B.vat)}</span></div>
        <div class="kv total"><span>รวมทั้งสิ้น</span><span>${fm(B.grand)}</span></div>
        ${B.noPrice ? `<p class="s13" style="color:#8A4B00;margin:8px 0 0">ยังไม่มีราคาวัสดุ ${B.noPrice} รายการ — กรอกในตารางได้เลย ระบบจำไว้ใช้กับทุกงาน</p>` : ''}
      </div>
      <div class="card"><b>แยกตามหมวดงาน</b>${gl.map(([g, v]) => `<div class="kv"><span>${GROUPS[g]}</span><span>${fm(v.mat + v.lab)}</span></div>`).join('') || '<div class="empty s13">ยังไม่มีรายการ</div>'}</div>
      <div class="card s13 muted">เสาใหม่ ${c.np} ต้น · HV ${c.hv} ม. · LV ${c.lv} ม. · หม้อแปลง ${c.tr} · ยึดโยง ${c.guy}</div>
    </aside>
    <section class="mainc stack">
      <div class="tabs noprint">${[['mat', `รวมพัสดุ (${B.mats.length})`], ['lab', `ค่าแรง (${labRows.length})`], ['reuse', `นำกลับมาใช้ใหม่ (${B.mats.filter(m => m.reuse).length})`]].map(([k, l]) => `<button class="${bomTab === k ? 'on' : ''}" onclick="bomTab='${k}';vBom(cur.job)">${l}</button>`).join('')}</div>
      <div class="card scroll" style="padding:0">${bomTab === 'mat' ? `
        <table class="tbl"><thead><tr><th>รหัสพัสดุ</th><th>รายการ</th><th>หน่วย</th><th class="r">จำนวน</th><th class="r">ราคา/หน่วย</th><th class="r">ค่าวัสดุ</th><th class="r">ค่าแรง</th></tr></thead><tbody>
        ${B.mats.map(m => `<tr class="${m.hasPrice ? '' : 'noprice'}"><td class="code">${m.code}</td><td>${esc(m.name)}<div class="s12 muted">${esc([...new Set(m.srcs.map(s => s.split(' · ')[0]))].slice(0, 6).join(', '))}</div></td><td>${esc(m.unit)}</td><td class="r">${fq(m.qty)}</td><td class="r"><label class="sr" for="pr_${m.code}">ราคา ${m.code}</label><input id="pr_${m.code}" inputmode="decimal" value="${m.hasPrice ? m.price : ''}" placeholder="ใส่ราคา" onchange="setPrice('${m.code}',this.value)"></td><td class="r">${m.hasPrice ? fm(m.mat) : '—'}</td><td class="r">${fm(m.lab)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">ยังไม่มีรายการ — เพิ่มเสา ชุด Set หรือสายก่อน</td></tr>'}
        </tbody><tfoot><tr><td colspan="5" class="r b">รวม</td><td class="r b">${fm(B.mat)}</td><td class="r b">${fm(B.lab)}</td></tr></tfoot></table>` : bomTab === 'lab' ? `
        <table class="tbl"><thead><tr><th>ที่มา</th><th>รหัส</th><th>รายการ</th><th class="r">จำนวน</th><th>อัตรา</th><th class="r">ค่าแรง</th></tr></thead><tbody>
        ${labRows.map(x => `<tr><td class="s12">${esc(x.src)}</td><td class="code">${x.code}</td><td>${esc(iname(x.code))}</td><td class="r">${fq(x.qty)} ${esc(iunit(x.code))}</td><td class="s12">${fm(x.rate)}${x.perKm ? ` /${S.cfg.lineDiv === 1000 ? 'กม.' : S.cfg.lineDiv + ' ม.'}` : ''}<div class="muted">${esc(DB.types[x.t] || '')}</div></td><td class="r">${fm(x.lab)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">ไม่มีค่าแรง</td></tr>'}
        </tbody><tfoot><tr><td colspan="5" class="r b">รวมค่าแรง</td><td class="r b">${fm(B.lab)}</td></tr></tfoot></table>` : `
        <table class="tbl"><thead><tr><th>รหัสพัสดุ</th><th>รายการ</th><th>หน่วย</th><th class="r">จำนวนก่อสร้าง</th><th class="r">นำกลับมาใช้ใหม่</th></tr></thead><tbody>
        ${B.mats.filter(m => m.reuse).map(m => `<tr><td class="code">${m.code}</td><td>${esc(m.name)}</td><td>${esc(m.unit)}</td><td class="r">${fq(m.qty)}</td><td class="r">${fq(m.reuse)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">ไม่มี</td></tr>'}
        </tbody></table>`}</div>
    </section>
   </div>
  </div></div>${navbar(job, 'bom')}`;
}
window.num = num;
window.bset = (k, v) => { cur.job[k] = v; saveJob(cur.job); vBom(cur.job); };
window.setPrice = (c, v) => { savePrice(c, v.trim() === '' ? null : num(v.replace(/,/g, ''))); const y = $('.main').scrollTop; vBom(cur.job); $('.main').scrollTop = y; };
window.exportXlsx = () => {
  if (!window.XLSX) return toast('โหลดตัวส่งออก Excel ไม่สำเร็จ');
  const j = cur.job, B = computeBOM(j);
  const a1 = [[`ถอดแบบประมาณการ: ${j.name}`], [`สถานที่: ${j.place}`, '', `ลูกค้า: ${j.cust.n}`], [`ค่าแรงกรณีที่ ${j.case + 1}`, '', `วันที่ ${thDate(Date.now())}`], [],
    ['รหัสพัสดุ', 'รายการ', 'หน่วย', 'จำนวน', 'นำกลับมาใช้ใหม่', 'ราคา/หน่วย', 'ค่าวัสดุ', 'ค่าแรง', 'รวม'],
    ...B.mats.map(m => [m.code, m.name, m.unit, +m.qty.toFixed(3), +m.reuse.toFixed(3), m.hasPrice ? m.price : '', +m.mat.toFixed(2), +m.lab.toFixed(2), +(m.mat + m.lab).toFixed(2)]),
    [], ['', 'รวมค่าวัสดุ', '', '', '', '', +B.mat.toFixed(2)], ['', 'รวมค่าแรง', '', '', '', '', '', +B.lab.toFixed(2)],
    ['', `ค่าดำเนินการ ${j.ohPct}%`, '', '', '', '', '', '', +B.oh.toFixed(2)], ['', `VAT ${j.vat}%`, '', '', '', '', '', '', +B.vat.toFixed(2)], ['', 'รวมทั้งสิ้น', '', '', '', '', '', '', +B.grand.toFixed(2)]];
  const a2 = [['ที่มา', 'รหัส', 'รายการ', 'จำนวน', 'หน่วย', 'ประเภทค่าแรง', 'อัตรา', 'ค่าแรง'], ...B.contrib.map(x => [x.src, x.code, iname(x.code), +x.qty.toFixed(3), iunit(x.code), DB.types[x.t] || '', x.rate, +x.lab.toFixed(2)])];
  const wb = XLSX.utils.book_new(), s1 = XLSX.utils.aoa_to_sheet(a1), s2 = XLSX.utils.aoa_to_sheet(a2);
  s1['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]; s2['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 55 }, { wch: 9 }, { wch: 6 }, { wch: 30 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s1, 'รวมพัสดุ'); XLSX.utils.book_append_sheet(wb, s2, 'ค่าแรงรายละเอียด');
  XLSX.writeFile(wb, `ประมาณการ_${j.name.replace(/[\\/:*?"<>|]/g, '_')}.xlsx`);
};

window.toProcure = () => {
  const j = cur.job, B = computeBOM(j), list = B.mats.filter(m => m.qty > 0);
  if (!list.length) return toast('ยังไม่มีรายการพัสดุ');
  if (!confirm(`ส่งรายการวัสดุ ${list.length} รายการไปสร้างงานใหม่ในระบบงานจัดซื้อจัดจ้าง?`)) return;
  const items = list.map(m => ({ name: `${m.name} (รหัส ${m.code})`, qty: Math.round(m.qty * 1000) / 1000, unit: m.unit, price: m.hasPrice ? m.price : 0, spec: `รหัสพัสดุ กฟภ. ${m.code}` }));
  localStorage.setItem('procure_import', JSON.stringify({ from: 'construction', jobId: j.id, title: `วัสดุก่อสร้างระบบจำหน่าย ${j.name}`, purpose: `ใช้ในงาน${j.name}${j.place ? ' ' + j.place : ''}`, items, ts: Date.now() }));
  location.href = '/procure/index.html?import=1';
};

const POLE_CCL = { '1000010001': '8 เมตร', '1000010002': '9 เมตร', '1000010004': '12 เมตร', '1000010003': '12 เมตร', '1000010012': '12.20 เมตร', '1000010006': '14 เมตร', '1000010005': '14 เมตร', '1000010013': '14.30 เมตร', '1000010011': '22 เมตร' };
function cableCCL(code) {
  const n = iname(code).toUpperCase(), sz = (n.match(/(\d+)(?:\/\d+)?\s*SQ/) || [])[1];
  if (/TAC|TWISTED/.test(n)) return 'TAC';
  if (/CABLE,AERIAL/.test(n) && sz) return 'SAC ' + sz;
  if (/ACSR/.test(n) && sz) return 'ACSR ' + sz;
  if (/AL\.BARE|AL-ALLOY|AL,BARE/.test(n) && sz) return 'AW' + sz;
  return '';
}
window.toCCL = () => {
  const j = cur.job, B = computeBOM(j), c = jobCounts(j);
  if (!B.mats.length) return toast('ยังไม่มีรายการ');
  const poles = {}, cables = {}, trs = {}, other = [];
  j.poles.forEach(p => { if (p.pole && !p.ex) { const k = POLE_CCL[p.pole]; if (k) poles[k] = (poles[k] || 0) + 1; else other.push(iname(p.pole)); }
    p.items.forEach(it => { const n = iname(it.c); if (/^TRANSFORMER/i.test(n)) { const kva = (n.replace(/,/g, '').match(/(\d+)\s*K[VA]{2}/i) || [])[1]; const k = kva ? kva + ' Kva' : n; trs[k] = (trs[k] || 0) + num(it.q); } }); });
  j.spans.forEach(s => { const k = cableCCL(s.w), q = spanLen(j, s) * num(s.n); if (k) cables[k] = (cables[k] || 0) + q; else other.push(`${iname(s.w)} ${q} ม.`); });
  const first = j.poles.find(p => !p.ex && p.lat != null) || j.poles.find(p => p.lat != null);
  const det = [`จากระบบสำรวจงานก่อสร้าง: ${j.name}`, j.cust.n ? `ผู้ขอใช้ไฟ ${j.cust.n}${j.cust.t ? ' โทร ' + j.cust.t : ''}` : '', j.reqNo ? `เลขที่คำร้อง ${j.reqNo}` : '', j.qNo ? `ใบเสนอราคา ${j.qNo}` : '',
    `เสาใหม่ ${c.np} ต้น · แนวสาย HV ${c.hv} ม. · LV ${c.lv} ม. · หม้อแปลง ${c.tr}`, `ประมาณการรวม ${fm(B.grand)} บาท (วัสดุ ${fm(B.mat)} · ค่าแรง ${fm(B.lab)})`, other.length ? 'อื่นๆ: ' + other.join(', ') : ''].filter(Boolean).join('\n');
  const toRows = o => Object.entries(o).map(([size, qty]) => ({ size, qty: Math.round(qty) }));
  if (!confirm('เปิดฟอร์ม "เพิ่มงาน" ใน CCL พร้อมเติมข้อมูลงานนี้ให้ (ตรวจแล้วกดบันทึกที่ CCL)?')) return;
  localStorage.setItem('ccl_import', JSON.stringify({ ts: Date.now(), jobName: j.name, location: j.place, coordinates: first ? `${first.lat}, ${first.lng}` : '', details: det, poles: toRows(poles), cables: toRows(cables), transformers: toRows(trs), laborCost: Math.round(B.lab * 100) / 100 }));
  if (j.status < 3) { j.status = 3; saveJob(j); }
  location.href = '/ccl/index.html?import=1';
};

/* ---------- ระบบออกเลขหนังสือ ---------- */
function askText(title, body, ph, pw) { return new Promise(res => { modal(title, `<p style="margin-top:0">${body}</p><input id="at_in" class="in" type="${pw ? 'password' : 'text'}" placeholder="${esc(ph)}">`, `<span style="flex:1"></span><button class="btn g" id="at_x">ยกเลิก</button><button class="btn p" id="at_ok">ตกลง</button>`, box => {
  const done = v => { closeModal(); res(v); }; $('#at_ok', box).onclick = () => done($('#at_in', box).value.trim()); $('#at_x', box).onclick = () => done(''); $('.x', box).onclick = () => done(''); setTimeout(() => $('#at_in', box).focus(), 50); }); }); }
function choose(title, opts) { return new Promise(res => { modal(title, `<div class="list">${opts.map((o, i) => `<button class="li" style="width:100%;border:0;background:none;text-align:left;cursor:pointer;font-size:15px" data-i="${i}">${esc(o)}</button>`).join('') || '<div class="empty">ไม่มีรายการ</div>'}</div>`, '', box => {
  $('.bd', box).onclick = e => { const b = e.target.closest('[data-i]'); if (b) { closeModal(); res(+b.dataset.i); } }; $('.x', box).onclick = () => { closeModal(); res(-1); }; }); }); }
async function book(fn, args) {
  const t = await (await fetch(BOOK_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn, args }) })).text();
  let j; try { j = JSON.parse(t); } catch (e) { throw new Error('ระบบออกเลขหนังสือตอบกลับไม่ถูกต้อง'); }
  if (!j.ok) throw new Error(j.error || 'ระบบออกเลขหนังสือขัดข้อง'); return j.data;
}
async function bookToken(again) {
  let t = again ? null : localStorage.getItem('booknum_token_v1'); if (t) return t;
  const code = await askText('เชื่อมระบบออกเลขหนังสือ', 'กรอกรหัสสำนักงาน (รหัสเดียวกับที่ใช้เข้าระบบออกเลขหนังสือ) — ทำครั้งเดียวต่อเครื่อง', 'รหัสสำนักงาน', true);
  if (!code) return null;
  const r = await book('login', [code]);
  if (!r || !r.ok) throw new Error('รหัสสำนักงานไม่ถูกต้อง');
  localStorage.setItem('booknum_token_v1', r.token); if (r.settings) localStorage.setItem('booknum_settings_v1', JSON.stringify(r.settings));
  return r.token;
}
async function bookCall(fn, args) {
  let t = await bookToken(false); if (!t) return null;
  try { return await book(fn, [t].concat(args)); }
  catch (e) { if (!/AUTH_REQUIRED|SETUP_REQUIRED/.test(e.message)) throw e; localStorage.removeItem('booknum_token_v1'); t = await bookToken(true); if (!t) return null; return await book(fn, [t].concat(args)); }
}
const nmz = s => String(s || '').replace(/\s/g, '').toLowerCase();
window.issueQuoteNo = async btn => {
  const j = cur.job; if (j.qRef) return toast('ใบเสนอราคานี้มีเลขแล้ว');
  const old = btn.textContent; btn.disabled = true; btn.textContent = 'กำลังเตรียม…';
  try {
    let st = null; try { st = JSON.parse(localStorage.getItem('booknum_settings_v1') || 'null'); } catch (e) {}
    if (!st || !(st.departments || []).length) { st = await bookCall('getSettings', []); if (!st) return; localStorage.setItem('booknum_settings_v1', JSON.stringify(st)); }
    let dept = (st.departments || []).find(d => d === localStorage.getItem('ccs_book_dept'));
    if (!dept) { const i = await choose('เลือกแผนกในระบบออกเลขหนังสือ', st.departments || []); if (i < 0) return; dept = st.departments[i]; localStorage.setItem('ccs_book_dept', dept); }
    const recs = st.recorders || [];
    let rec = [localStorage.getItem('booknum_user_v1'), HUB_USER()].find(x => x && recs.some(r => nmz(r) === nmz(x)));
    if (rec) rec = recs.find(r => nmz(r) === nmz(rec));
    else { const i = await choose('ผู้บันทึก (ชื่อในระบบออกเลขหนังสือ)', recs); if (i < 0) return; rec = recs[i]; localStorage.setItem('booknum_user_v1', rec); }
    const d = new Date(), date = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10), subject = `เสนอราคาค่าก่อสร้าง ${j.name}${j.cust.n ? ' (' + j.cust.n + ')' : ''}`;
    if (!confirm(`ออกเลขหนังสือ\nเรื่อง: ${subject}\nแผนก: ${dept}\nผู้บันทึก: ${rec}\n\nเลขจะถูกบันทึกในระบบออกเลขหนังสือทันที`)) return;
    btn.textContent = 'กำลังขอเลข…';
    let next = ''; try { const n = await bookCall('getNextInfo', ['หนังสือทั่วไป', date]); next = (n && n.nextBookNum) || ''; } catch (e) {}
    const res = await bookCall('saveData', [{ category: 'หนังสือทั่วไป', rowIndex: '', bookNum: next, department: dept, date, recorder: rec, subject, detail: 'ออกจากระบบสำรวจงานก่อสร้าง · ' + j.id, medianPrice: '', paymentDocNum: '', paymentItem: '', paymentAmount: '', payee: '', paymentNote: '', contractor: '', procurement: 'ทั่วไป', startDate: '', endDate: '', orderDate: '', amount: '', retention: '' }]);
    if (!res) return;
    if (res.status !== 'success') throw new Error('ระบบออกเลขหนังสือ: ' + (res.message || 'บันทึกไม่สำเร็จ'));
    j.qNo = String(res.bookNum || ''); j.qRef = j.qNo; j.qDate = date; saveJob(j); vQuote(j); toast('ได้เลขที่ ' + j.qNo);
  } catch (e) { toast(e.message || String(e), 4000); }
  finally { btn.disabled = false; btn.textContent = old; }
};

/* ---------- quotation ---------- */
function vQuote(job) {
  const B = computeBOM(job), cfg = S.cfg;
  const rows = Object.entries(B.groups).filter(([, g]) => g.mat || g.lab);
  const c = jobCounts(job);
  const desc = g => ({ pole: `เสาใหม่ ${c.np} ต้น`, wire: [c.hv ? `แรงสูง ${c.hv} ม.` : '', c.lv ? `แรงต่ำ ${c.lv} ม.` : ''].filter(Boolean).join(' · '), tr: `${c.tr} เครื่อง`, guy: `${c.guy} ชุด` }[g] || '');
  if (job.status === 0 && B.sub > 0) { job.status = 1; saveJob(job); }
  const sch = schematic(job, 300, 170);
  app.innerHTML = topbar('ใบเสนอราคา', job.name, `#bom/${job.id}`, `<button class="ib" aria-label="พิมพ์" onclick="markSent();window.print()">⎙</button>`) + `
  <div class="main"><div class="noprint wrap" style="max-width:794px;margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">${job.qRef ? '' : '<button class="btn g" onclick="issueQuoteNo(this)">ออกเลขจากระบบออกเลขหนังสือ</button>'}<span class="s13 muted" style="flex:1">ข้อความที่มีเส้นประแก้ไขได้ตรงหน้าเลย · ${B.noPrice ? `<b style="color:#8A4B00">ยังไม่มีราคาวัสดุ ${B.noPrice} รายการ</b>` : 'ราคาครบ'}</span><button class="btn p" onclick="markSent();window.print()">พิมพ์ / บันทึก PDF</button></div>
  <div class="paper">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #5B1A63;padding-bottom:12px;gap:16px">
      <div><div style="font-size:20px;font-weight:700" contenteditable data-k="branch">การไฟฟ้าส่วนภูมิภาค${esc(cfg.branch.replace(/^กฟส\./, 'สาขา'))}</div><div class="s14 muted" contenteditable data-k="addr">${esc(cfg.addr || 'ที่อยู่สำนักงาน · โทร')}${cfg.tel ? ' · โทร ' + esc(cfg.tel) : ''}</div></div>
      <div style="text-align:right"><div style="font-size:26px;font-weight:700;color:#5B1A63">ใบเสนอราคา</div><div class="s14">เลขที่ <span ${job.qRef ? '' : 'contenteditable data-j="qNo"'}>${esc(job.qNo || '…………')}</span></div><div class="s14">วันที่ ${thDate(job.qDate || Date.now())}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:15px">
      <div><b>ผู้ขอใช้ไฟ</b><div contenteditable data-c="n">${esc(job.cust.n || '[ชื่อลูกค้า]')}</div><div contenteditable data-c="a">${esc(job.cust.a || '[ที่อยู่]')}</div><div>โทร <span contenteditable data-c="t">${esc(job.cust.t || '-')}</span></div></div>
      <div><b>รายละเอียดงาน</b><div contenteditable data-j="name">${esc(job.name)}</div><div contenteditable data-j="place">${esc(job.place || '[สถานที่]')}</div><div>ระบบ ${job.volt} kV ${job.phase} เฟส${job.reqNo ? ' · คำร้อง ' + esc(job.reqNo) : ''}</div></div>
    </div>
    <table><thead><tr><th style="width:40px;text-align:center">ที่</th><th>รายการ</th><th style="text-align:right;width:130px">ค่าวัสดุ</th><th style="text-align:right;width:120px">ค่าแรง</th><th style="text-align:right;width:130px">จำนวนเงิน</th></tr></thead><tbody>
      ${rows.map(([g, v], i) => `<tr><td style="text-align:center">${i + 1}</td><td><b>${GROUPS[g]}</b><div class="s13 muted">${desc(g)}</div></td><td style="text-align:right">${fm(v.mat)}</td><td style="text-align:right">${fm(v.lab)}</td><td style="text-align:right">${fm(v.mat + v.lab)}</td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#5E5664">ยังไม่มีรายการ</td></tr>'}
    </tbody></table>
    <div style="display:flex;justify-content:flex-end"><div style="width:340px;font-size:15px">
      <div class="kv"><span>รวมค่าวัสดุและค่าแรง</span><span>${fm(B.sub)}</span></div>
      ${B.oh ? `<div class="kv"><span>ค่าดำเนินการ ${job.ohPct}%</span><span>${fm(B.oh)}</span></div>` : ''}
      <div class="kv"><span>ภาษีมูลค่าเพิ่ม ${job.vat}%</span><span>${fm(B.vat)}</span></div>
      <div class="kv total" style="border-top:2px solid #5B1A63"><span>รวมทั้งสิ้น</span><span>${fm(B.grand)}</span></div>
      <div class="s14 muted" style="text-align:right">(${bahtText(B.grand)})</div></div></div>
    <div style="display:flex;gap:16px;align-items:flex-start">${sch ? `<div style="width:300px;flex-shrink:0">${sch}</div>` : ''}
      <div style="flex:1;font-size:14px" contenteditable data-j="terms"><b>เงื่อนไข</b><br>${job.terms ? esc(job.terms).replace(/\n/g, '<br>') : `1. ใบเสนอราคานี้มีอายุ ${job.valid} วัน นับจากวันที่ออก<br>2. ราคาประมาณการจากการสำรวจ อาจปรับตามสภาพหน้างานจริง<br>3. ชำระเงินได้ที่ ${esc(cfg.branch)}`}</div></div>
    <div style="margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:32px;text-align:center;font-size:15px">
      <div><div style="margin-top:48px">ลงชื่อ ........................................</div><div contenteditable data-j="surveyor">(${esc(job.surveyor || HUB_USER() || '........................................')})</div><div>ผู้สำรวจ/ประมาณราคา</div></div>
      <div><div style="margin-top:48px">ลงชื่อ ........................................</div><div contenteditable data-k="manager">(${esc(cfg.manager || '........................................')})</div><div>ผู้จัดการ${esc(cfg.branch)}</div></div>
    </div>
  </div></div>${navbar(job, 'quote')}`;
  $$('.paper [contenteditable]').forEach(el => el.addEventListener('blur', () => {
    const t = el.innerText.trim().replace(/^\(|\)$/g, '');
    if (el.dataset.c) job.cust[el.dataset.c] = t;
    else if (el.dataset.j === 'terms') job.terms = el.innerText.replace(/^เงื่อนไข\s*/, '').trim();
    else if (el.dataset.j) job[el.dataset.j] = t.replace(/^…+$/, '');
    else if (el.dataset.k === 'manager') { S.cfg.manager = t; saveLocal('cfg'); }
    else if (el.dataset.k === 'addr') { S.cfg.addr = t; saveLocal('cfg'); }
    saveJob(job);
  }));
}
window.markSent = () => { const j = cur.job; if (j.status < 2) { j.status = 2; saveJob(j); } };

/* ---------- settings ---------- */
function vSettings() {
  const cfg = S.cfg;
  app.innerHTML = topbar('ตั้งค่า', `เวอร์ชัน ${VERSION} · พัสดุ ${Object.keys(DB.items).length} · ชุด Set ${Object.keys(DB.sets).length}`, '#home') + `
  <div class="main"><div class="wrap stack" style="max-width:720px">
    <div class="card stack"><b>ข้อมูลสำนักงาน (หัวใบเสนอราคา)</b>
      <div class="fld"><label for="c_br">ชื่อสำนักงาน</label><input id="c_br" class="in" value="${esc(cfg.branch)}"></div>
      <div class="fld"><label for="c_ad">ที่อยู่</label><input id="c_ad" class="in" value="${esc(cfg.addr)}"></div>
      <div class="grid2"><div class="fld"><label for="c_tel">โทร</label><input id="c_tel" class="in" value="${esc(cfg.tel)}"></div><div class="fld"><label for="c_mg">ชื่อผู้จัดการ</label><input id="c_mg" class="in" value="${esc(cfg.manager)}"></div></div>
    </div>
    <div class="card stack"><b>ค่าเริ่มต้นการคำนวณ</b>
      <div class="fld"><label for="c_hv">สายแรงสูงเริ่มต้น</label><select id="c_hv" class="in">${wireOptions(cfg.hvWire, 'HV')}</select></div>
      <div class="fld"><label for="c_lv">สายแรงต่ำเริ่มต้น</label><select id="c_lv" class="in">${wireOptions(cfg.lvWire, 'LV')}</select></div>
      <div class="grid2"><div class="fld"><label for="c_div">หน่วยอัตราค่าแรงพาดสาย</label><select id="c_div" class="in"><option value="1000" ${cfg.lineDiv == 1000 ? 'selected' : ''}>บาท ต่อ กม. ต่อเส้น</option><option value="100" ${cfg.lineDiv == 100 ? 'selected' : ''}>บาท ต่อ 100 ม. ต่อเส้น</option><option value="1" ${cfg.lineDiv == 1 ? 'selected' : ''}>บาท ต่อ ม. ต่อเส้น</option></select></div>
      <div class="fld"><label for="c_oh">ค่าดำเนินการเริ่มต้น %</label><input id="c_oh" class="in" type="number" step="0.01" value="${cfg.ohPct}"></div></div>
      <div class="fld"><label for="c_val">อายุใบเสนอราคา (วัน)</label><input id="c_val" class="in" type="number" value="${cfg.valid}"></div>
    </div>
    <div class="card stack"><b>ราคาวัสดุ (${Object.keys(S.prices).length} รายการ)</b>
      <span class="s13 muted">นำเข้าไฟล์ Excel ที่มีคอลัมน์ "รหัสพัสดุ" และ "ราคา" (ชื่อคอลัมน์ที่มีคำว่า ราคา) หรือกรอกทีละรายการในหน้าถอดแบบ</span>
      <div class="row" style="flex-wrap:wrap"><label class="btn g" for="c_imp">นำเข้าราคาจาก Excel</label><input id="c_imp" type="file" accept=".xlsx,.xls,.csv" class="sr" onchange="importPrices(this.files[0])"><button class="btn g" onclick="exportPrices()">ส่งออกราคา</button></div>
    </div>
    <div class="card stack"><b>เก็บข้อมูลบน Google Sheet (ใช้ข้ามเครื่องได้)</b>
      <span class="s13 muted">ว่างไว้ = เก็บในเครื่องนี้อย่างเดียว · ใส่ URL Web App ของ Code.gs เพื่อให้มือถือหน้างานกับคอมสำนักงานเห็นงานเดียวกัน</span>
      <div class="fld"><label for="c_gas">URL Web App (Apps Script)</label><input id="c_gas" class="in" value="${esc(cfg.gasUrl)}" placeholder="https://script.google.com/macros/s/.../exec"></div>
      <div class="row"><button class="btn g" onclick="testGas()">ทดสอบ / ดึงข้อมูล</button><button class="btn g" onclick="pushAll()">ส่งงานทั้งหมดขึ้น Sheet</button></div>
    </div>
    <div class="card stack"><b>สำรองข้อมูล</b><div class="row" style="flex-wrap:wrap"><button class="btn g" onclick="backup()">ดาวน์โหลดไฟล์สำรอง</button><label class="btn g" for="c_rs">กู้คืนจากไฟล์</label><input id="c_rs" type="file" accept=".json" class="sr" onchange="restore(this.files[0])"></div></div>
    <button class="btn p" onclick="saveCfg()">บันทึกการตั้งค่า</button>
  </div></div>${navbar(null, 'settings')}`;
}
window.saveCfg = () => {
  Object.assign(S.cfg, { branch: $('#c_br').value.trim(), addr: $('#c_ad').value.trim(), tel: $('#c_tel').value.trim(), manager: $('#c_mg').value.trim(), hvWire: $('#c_hv').value, lvWire: $('#c_lv').value, lineDiv: +$('#c_div').value, ohPct: num($('#c_oh').value), valid: num($('#c_val').value) || 30, gasUrl: $('#c_gas').value.trim() });
  saveLocal('cfg'); toast('บันทึกแล้ว');
};
window.testGas = async () => { saveCfg(); if (!S.cfg.gasUrl) return toast('ยังไม่ได้ใส่ URL'); await syncPull(); };
window.pushAll = async () => { saveCfg(); if (!S.cfg.gasUrl) return toast('ยังไม่ได้ใส่ URL'); try { for (const j of Object.values(S.jobs)) await gas('saveJob', { job: j }); await gas('savePrices', { prices: S.prices }); toast('ส่งขึ้น Sheet ครบแล้ว'); } catch (e) { toast('ไม่สำเร็จ: ' + e.message); } };
window.importPrices = async f => {
  if (!f) return; try {
    const wb = XLSX.read(await f.arrayBuffer()); let n = 0;
    wb.SheetNames.forEach(sn => { const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true }); let hi = rows.findIndex(r => r.some(x => /รหัส/.test(String(x))) && r.some(x => /ราคา/.test(String(x)))); if (hi < 0) return; const H = rows[hi].map(String); const ci = H.findIndex(x => /รหัส/.test(x)), pi = H.findIndex(x => /ราคา/.test(x) && !/ค่าแรง/.test(x)); if (pi < 0) return;
      rows.slice(hi + 1).forEach(r => { const c = String(r[ci] ?? '').trim(), p = num(String(r[pi] ?? '').replace(/,/g, '')); if (/^\d{6,}$/.test(c) && p > 0) { S.prices[c] = p; n++; } }); });
    saveLocal('prices'); if (S.cfg.gasUrl) gas('savePrices', { prices: S.prices }).catch(() => {}); toast(`นำเข้าราคา ${n} รายการ`); vSettings();
  } catch (e) { toast('อ่านไฟล์ไม่ได้: ' + e.message); }
};
window.exportPrices = () => { const ws = XLSX.utils.aoa_to_sheet([['รหัสพัสดุ', 'ชื่อ', 'หน่วย', 'ราคา'], ...Object.entries(S.prices).map(([c, p]) => [c, iname(c), iunit(c), p])]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'ราคาวัสดุ'); XLSX.writeFile(wb, 'ราคาวัสดุ.xlsx'); };
window.backup = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ v: VERSION, jobs: S.jobs, prices: S.prices, cfg: S.cfg })], { type: 'application/json' })); a.download = `สำรอง_สำรวจออกแบบ_${new Date().toISOString().slice(0, 10)}.json`; a.click(); };
window.restore = async f => { if (!f) return; try { const o = JSON.parse(await f.text()); Object.assign(S.jobs, o.jobs || {}); Object.assign(S.prices, o.prices || {}); saveLocal('jobs'); saveLocal('prices'); toast('กู้คืนแล้ว'); go('home'); } catch (e) { toast('ไฟล์ไม่ถูกต้อง'); } };

/* ---------- ออฟไลน์ ---------- */
function netBadge() { let b = $('#offb'); if (navigator.onLine) { b && b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'offb'; b.textContent = 'ออฟไลน์ · งานและรูปเก็บในเครื่อง ส่งเองเมื่อมีสัญญาณ'; b.style.cssText = 'position:fixed;left:50%;top:calc(54px + env(safe-area-inset-top));transform:translateX(-50%);z-index:2500;background:#8A4B00;color:#fff;font-size:12px;font-weight:600;border-radius:12px;padding:3px 10px;white-space:nowrap;pointer-events:none'; document.body.appendChild(b); } }
addEventListener('online', () => { netBadge(); pushDirty().then(() => syncPull(true)).then(() => Object.values(S.jobs).forEach(j => uploadPending(j))); });
addEventListener('offline', netBadge);
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));

/* ---------- boot ---------- */
(async function boot() {
  app.innerHTML = '<div class="empty" style="margin-top:40vh">กำลังโหลดฐานข้อมูลพัสดุ…</div>';
  try { await loadData(); } catch (e) { app.innerHTML = `<div class="empty" style="margin-top:30vh">โหลดฐานข้อมูลไม่สำเร็จ (${esc(e.message)})<br>ตรวจว่ามีโฟลเดอร์ data/ อยู่ข้าง index.html</div>`; return; }
  netBadge();
  if (S.cfg.gasUrl && navigator.onLine) await syncPull(true);
  route();
  setTimeout(() => { pushDirty(); Object.values(S.jobs).forEach(j => uploadPending(j)); }, 3000);
})();
