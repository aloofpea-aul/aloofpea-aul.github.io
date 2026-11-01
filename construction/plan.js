/* ผังงานก่อสร้าง (แบบแนบใบเสนอราคา / เสนออนุมัติ) — รูปแบบตามผังขยายเขต กฟภ.
 * กระดาษ A4/A3 แนวนอน · ระบบเดิมสีดำ/เทา · งานใหม่สีน้ำเงิน · ตารางสัญลักษณ์+จำนวน · กรอบชื่อแบบ
 * ใช้ตัวแปรกลางจาก app.js (DB, NET, LV, S, cur, poleH, poleHead, groupOfSet, …) */
'use strict';
const PLAN_BLUE = '#1747A6';
const PLAN_SCALES = [250, 500, 750, 1000, 1250, 1500, 1800, 2000, 2500, 3000, 4000, 5000, 7500, 10000, 15000, 20000];
const PAPER = { A4: [297, 210], A3: [420, 297] };

function planOpts() { try { return Object.assign({ paper: 'A4', bg: true, meters: true, poleNo: false }, JSON.parse(localStorage.getItem('ccs_plan') || '{}')); } catch (e) { return { paper: 'A4', bg: true, meters: true, poleNo: false }; } }
function setPlanOpt(k, v) { const o = planOpts(); o[k] = v; localStorage.setItem('ccs_plan', JSON.stringify(o)); vPlan(cur.job); }
window.setPlanOpt = setPlanOpt;

function wireShort(code) {
  const n = iname(code).toUpperCase(), sz = (n.match(/(\d+)(?:\/\d+)?\s*SQ/) || [])[1] || '';
  if (/TAC|TWISTED/.test(n)) return 'TAC ' + sz;
  if (/CABLE,AERIAL/.test(n)) return 'SAC ' + sz;
  if (/PARTIALLY/.test(n)) return 'PIC ' + sz;
  if (/ACSR/.test(n)) return 'ACSR ' + sz;
  if (/AL-ALLOY/.test(n)) return 'AAAC ' + sz;
  if (/AL\.BARE|AL,BARE/.test(n)) return 'AW ' + sz;
  if (/750 V|PVC/.test(n)) return 'THW-A ' + sz;
  return sz ? sz + ' ตร.มม.' : '';
}

async function vPlan(job) {
  await Promise.all([loadNet(), planOpts().meters ? loadLv() : null]);
  const o = planOpts(), [PW, PH] = PAPER[o.paper] || PAPER.A4;
  const pts = job.poles.filter(p => p.lat != null);
  app.innerHTML = topbar('ผังงาน', job.name, `#bom/${job.id}`, `<button class="ib" aria-label="พิมพ์ผัง" onclick="window.print()">⎙</button>`) + `
  <div class="main"><div class="noprint wrap" style="max-width:1123px;margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <div class="seg" style="width:140px">${['A4', 'A3'].map(k => `<button class="${o.paper === k ? 'on' : ''}" onclick="setPlanOpt('paper','${k}')">${k}</button>`).join('')}</div>
    <label class="row s13" style="gap:4px"><input type="checkbox" ${o.bg ? 'checked' : ''} onchange="setPlanOpt('bg',this.checked)">แผนที่พื้นหลัง</label>
    <label class="row s13" style="gap:4px"><input type="checkbox" ${o.meters ? 'checked' : ''} onchange="setPlanOpt('meters',this.checked)">มิเตอร์</label>
    <label class="row s13" style="gap:4px"><input type="checkbox" ${o.poleNo ? 'checked' : ''} onchange="setPlanOpt('poleNo',this.checked)">เลขเสาเดิม</label>
    <span style="flex:1"></span><button class="btn sm g" id="pz" onclick="togglePlanZoom()">${localStorage.getItem('ccs_pzoom') === '1' ? 'ย่อให้เห็นเต็มหน้า' : 'ขยายเท่าขนาดจริง'}</button><button class="btn p" onclick="window.print()">พิมพ์ / บันทึก PDF</button></div>
    ${pts.length ? `<div class="pwrap" id="pwrap"><div id="paper" class="plan-paper" style="width:${PW}mm;height:${PH}mm">${planSvg(job, o, PW, PH)}</div></div>` : '<div class="empty">ยังไม่มีเสาบนแผนที่ — ผังงานต้องมีตำแหน่งเสาอย่างน้อย 1 ต้น</div>'}
  </div>${navbar(job, 'bom')}`;
  setPageSize(`${o.paper} landscape`);
  fitPlan(); setTimeout(fitPlan, 300); document.fonts && document.fonts.ready.then(fitPlan);
}
function setPageSize(sz) { let st = document.getElementById('pagesz'); if (!st) { st = document.createElement('style'); st.id = 'pagesz'; document.head.appendChild(st); } st.textContent = `@media print{@page{size:${sz};margin:0}}`; }
function fitPlan() {
  const w = $('#pwrap'), p = $('#paper'); if (!w || !p) return;
  const par = w.parentElement, cs = getComputedStyle(par), avail = par.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const real = localStorage.getItem('ccs_pzoom') === '1', s = real ? 1 : Math.min(1, (avail - 2) / p.offsetWidth);
  p.style.transform = s < 1 ? `scale(${s})` : ''; p.style.transformOrigin = 'top left';
  w.style.width = Math.ceil(p.offsetWidth * s) + 'px'; w.style.height = Math.ceil(p.offsetHeight * s) + 'px';
}
window.togglePlanZoom = () => { localStorage.setItem('ccs_pzoom', localStorage.getItem('ccs_pzoom') === '1' ? '0' : '1'); $('#pz').textContent = localStorage.getItem('ccs_pzoom') === '1' ? 'ย่อให้เห็นเต็มหน้า' : 'ขยายเท่าขนาดจริง'; fitPlan(); };
addEventListener('resize', () => { if (location.hash.startsWith('#plan/')) fitPlan(); });

function planSvg(job, o, PW, PH) {
  const M = 7, FX = M, FY = M, FW = PW - 2 * M, FH = PH - 2 * M;      // กรอบแผนที่ (มม.)
  const pts = job.poles.filter(p => p.lat != null);
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length, lng0 = pts.reduce((a, p) => a + p.lng, 0) / pts.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540;
  const xm = p => (p.lng - lng0) * kx, ym = p => (p.lat - lat0) * ky;
  let x0 = Math.min(...pts.map(xm)), x1 = Math.max(...pts.map(xm)), y0 = Math.min(...pts.map(ym)), y1 = Math.max(...pts.map(ym));
  const span = Math.max(x1 - x0, y1 - y0, 80), pad = span * 0.35 + 30;
  x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  // พื้นที่ว่างสำหรับวางผัง (หลบตารางสัญลักษณ์ด้านขวาบน และกรอบชื่อแบบด้านล่าง)
  const LW = 78, TB = 34, availW = FW - LW, availH = FH - TB;
  const need = Math.max((x1 - x0) * 1000 / availW, (y1 - y0) * 1000 / availH);
  const den = PLAN_SCALES.find(s => s >= need) || Math.ceil(need / 1000) * 1000;
  const mpm = den / 1000;                                               // เมตร ต่อ มม.
  const cxm = (x0 + x1) / 2, cym = (y0 + y1) / 2, ox = FX + availW / 2, oy = FY + availH / 2;
  const X = p => ox + (xm(p) - cxm) / mpm, Y = p => oy - (ym(p) - cym) / mpm;
  const inb = p => { const x = X(p), y = Y(p); return x > FX - 5 && x < FX + FW + 5 && y > FY - 5 && y < FY + FH + 5; };
  const ll = (lat, lng) => ({ lat, lng });
  const f = n => (Math.round(n * 100) / 100);
  let g = '';

  // ---- พื้นหลังแผนที่ (จาง) ----
  if (o.bg && navigator.onLine !== false) {
    const base = BASES.longdo, latC = lat0, mpp = den * 0.00022;            // ~0.22 มม./พิกเซล
    let z = Math.round(Math.log2(156543.03 * Math.cos(latC * Math.PI / 180) / mpp)); z = Math.max(13, Math.min(19, z));
    const n = 2 ** z, tx = lng => (lng + 180) / 360 * n, ty = lat => (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
    const lngAt = x => x / n * 360 - 180, latAt = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
    const west = lng0 + (cxm - (ox - FX) * mpm) / kx, east = lng0 + (cxm + (FX + FW - ox) * mpm) / kx;
    const north = lat0 + (cym + (oy - FY) * mpm) / ky, south = lat0 + (cym - (FY + FH - oy) * mpm) / ky;
    const ta = Math.floor(tx(west)), tb = Math.floor(tx(east)), tc = Math.floor(ty(north)), td = Math.floor(ty(south));
    if ((tb - ta + 1) * (td - tc + 1) <= 120) {
      g += `<g opacity="${0.42}" filter="url(#gray)">`;
      for (let a = ta; a <= tb; a++) for (let c = tc; c <= td; c++) {
        const p1 = ll(latAt(c), lngAt(a)), p2 = ll(latAt(c + 1), lngAt(a + 1));
        g += `<image href="${base.url.replace('{z}', z).replace('{x}', a).replace('{y}', c)}" x="${f(X(p1))}" y="${f(Y(p1))}" width="${f(X(p2) - X(p1)) + 0.05}" height="${f(Y(p2) - Y(p1)) + 0.05}" preserveAspectRatio="none"/>`;
      }
      g += '</g>';
    }
  }

  // ---- ระบบเดิม ----
  if (NET.lines) for (const [fd, arr] of Object.entries(NET.lines.lines || {})) arr.forEach(l => {
    const d = l.v.map(v => ll(v[0], v[1])); if (!d.some(inb)) return;
    g += `<polyline points="${d.map(p => f(X(p)) + ',' + f(Y(p))).join(' ')}" fill="none" stroke="#222" stroke-width="0.35" stroke-dasharray="4 0.8 0.6 0.8"/>`;
  });
  if (NET.poles) for (const p of NET.poles.poles) {
    const q = ll(p[0], p[1]); if (!inb(q)) continue;
    const x = X(q), y = Y(q), s = 1.5;
    g += `<rect x="${f(x - s / 2)}" y="${f(y - s / 2)}" width="${s}" height="${s}" fill="#fff" stroke="#222" stroke-width="0.22"/>`;
    const lab = [p[6] ? (+p[6]) : '', o.poleNo && p[4] ? poleNo(p) : ''].filter(Boolean).join(' ');
    if (lab) g += `<text x="${f(x + 1.1)}" y="${f(y - 0.9)}" font-size="1.5" fill="#444">${esc(lab)}</text>`;
  }
  if (o.meters && LV.d) { let n = 0; for (const m of LV.d.meters) {
    const q = ll(m[0], m[1]); if (!inb(q)) continue; if (++n > 600) break;
    const x = X(q), y = Y(q);
    g += `<circle cx="${f(x)}" cy="${f(y)}" r="0.55" fill="#fff" stroke="#333" stroke-width="0.18"/><text x="${f(x + 0.9)}" y="${f(y + 0.5)}" font-size="1.35" fill="#555">${esc(m[7] || '')}</text>`;
  } }
  (NET.mvm || []).forEach(t => { const q = ll(+t.Lat, +t.Lon); if (!inb(q)) return; const x = X(q), y = Y(q);
    g += `<circle cx="${f(x)}" cy="${f(y)}" r="1" fill="#fff" stroke="#222" stroke-width="0.25"/><text x="${f(x)}" y="${f(y + 0.5)}" font-size="1.3" text-anchor="middle" font-weight="700">M</text><text x="${f(x + 1.4)}" y="${f(y - 1)}" font-size="1.5">${esc(t.Tag)}</text>`; });
  (NET.trs || []).forEach(t => { const q = ll(+t.Lat, +t.Lon); if (!inb(q)) return; const x = X(q), y = Y(q);
    g += `<path d="M${f(x)} ${f(y - 1.6)} L${f(x + 1.5)} ${f(y + 1)} L${f(x - 1.5)} ${f(y + 1)} Z" fill="#fff" stroke="#222" stroke-width="0.28"/><text x="${f(x + 2)}" y="${f(y - 0.2)}" font-size="1.9" font-style="italic" text-decoration="underline">${esc(t.TransformerID)}</text><text x="${f(x + 2)}" y="${f(y + 2)}" font-size="1.9" font-style="italic">${esc(t.RatedKVA)} kVA</text>`; });

  // ---- งานใหม่ (สีน้ำเงิน) ----
  const B = PLAN_BLUE, P = id => poleById(job, id);
  job.spans.forEach(sp => { const a = P(sp.a), b = P(sp.b); if (!a || !b || a.lat == null || b.lat == null) return;
    const xa = X(a), ya = Y(a), xb = X(b), yb = Y(b), len = spanLen(job, sp);
    g += `<line x1="${f(xa)}" y1="${f(ya)}" x2="${f(xb)}" y2="${f(yb)}" stroke="${B}" stroke-width="${sp.k === 'HV' ? 0.7 : 0.55}" ${sp.k === 'LV' ? 'stroke-dasharray="2 1"' : 'stroke-dasharray="5 1 0.8 1"'}/>`;
    let ang = Math.atan2(yb - ya, xb - xa) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
    const mx = (xa + xb) / 2, my = (ya + yb) / 2;
    g += `<text transform="translate(${f(mx)} ${f(my)}) rotate(${f(ang)})" y="-0.9" font-size="1.8" text-anchor="middle" fill="${B}">${sp.n}-${esc(wireShort(sp.w))}${len ? ' · ' + len + ' ม.' : ''}</text>`; });
  pts.forEach(p => {
    const x = X(p), y = Y(p), tr = p.sets.some(z => groupOfSet(z.c) === 'tr') || p.items.some(i => groupOfItem(i.c) === 'tr'), guy = p.sets.some(z => groupOfSet(z.c) === 'guy');
    if (p.ex) g += `<rect x="${f(x - 1.1)}" y="${f(y - 1.1)}" width="2.2" height="2.2" fill="#fff" stroke="${B}" stroke-width="0.4"/>`;
    else g += `<rect x="${f(x - 1.25)}" y="${f(y - 1.25)}" width="2.5" height="2.5" fill="${B}"/>`;
    const h = poleH(p), hd = poleHead(p);
    g += `<text x="${f(x + 1.8)}" y="${f(y - 1.4)}" font-size="2" font-weight="700" fill="${B}">${esc(p.label)}</text>`;
    if (h || hd) g += `<text x="${f(x + 1.8)}" y="${f(y + 1.1)}" font-size="1.6" fill="${B}">${esc([h ? h + ' ม.' : '', hd].filter(Boolean).join(' · '))}</text>`;
    if (guy) { // ทิศยึดโยง: สวนทางกับทิศสายที่ต่อ
      const nb = job.spans.filter(s => s.a === p.id || s.b === p.id).map(s => P(s.a === p.id ? s.b : s.a)).filter(q => q && q.lat != null);
      let dx = 0, dy = 0; nb.forEach(q => { const L = Math.hypot(X(q) - x, Y(q) - y) || 1; dx += (X(q) - x) / L; dy += (Y(q) - y) / L; });
      const L = Math.hypot(dx, dy) || 1; dx = -dx / L * 6; dy = -dy / L * 6; if (!nb.length) dx = 6;
      g += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + dx)}" y2="${f(y + dy)}" stroke="${B}" stroke-width="0.35" marker-end="url(#arr)"/>`;
    }
    if (tr) { const kva = p.items.filter(i => groupOfItem(i.c) === 'tr').map(i => (iname(i.c).replace(/,/g, '').match(/(\d+)\s*K[VA]{2}/i) || [])[1]).filter(Boolean)[0];
      g += `<path d="M${f(x - 3.5)} ${f(y - 2.8)} l1.6 -2.8 l1.6 2.8 z" fill="#fff" stroke="${B}" stroke-width="0.4"/><text x="${f(x - 5.2)}" y="${f(y - 2.6)}" font-size="1.7" text-anchor="end" fill="${B}">${kva ? kva + ' kVA' : 'หม้อแปลงใหม่'}</text>`; }
  });

  // ---- กล่องคำอธิบายงาน + เส้นชี้ ----
  const c = jobCounts(job), G = computeBOM(job).groups, lines = [];
  const pc = {}; job.poles.forEach(p => { if (p.pole && !p.ex) { const h = poleH(p); pc[h] = (pc[h] || 0) + 1; } });
  Object.entries(pc).forEach(([h, n]) => lines.push(`ปักเสา คอร. ${h} ม. จำนวน ${n} ต้น`));
  if (c.hv) lines.push(`พาดสายแรงสูง ${[...new Set(job.spans.filter(s => s.k === 'HV').map(s => s.n + '-' + wireShort(s.w)))].join(', ')} ระยะ ${c.hv} ม.`);
  if (c.lv) lines.push(`พาดสายแรงต่ำ ${[...new Set(job.spans.filter(s => s.k === 'LV').map(s => s.n + '-' + wireShort(s.w)))].join(', ')} ระยะ ${c.lv} ม.`);
  if (c.guy) lines.push(`ติดตั้งยึดโยง (Guy) ${c.guy} ชุด`);
  if (c.tr) lines.push(`ติดตั้งหม้อแปลง ${c.tr} เครื่อง`);
  if (G.meter) lines.push('ติดตั้งมิเตอร์');
  if (lines.length) {
    const bx = FX + 22, by = FY + availH - 10 - lines.length * 4.6, cxp = pts.reduce((a, p) => a + X(p), 0) / pts.length, cyp = pts.reduce((a, p) => a + Y(p), 0) / pts.length;
    g += `<line x1="${f(bx + 30)}" y1="${f(by - 1)}" x2="${f(cxp)}" y2="${f(cyp)}" stroke="${B}" stroke-width="0.35" marker-end="url(#arr)"/>`;
    g += `<rect x="${f(bx - 2)}" y="${f(by - 5)}" width="${Math.max(...lines.map(l => l.length)) * 1.65 + 6}" height="${lines.length * 4.6 + 3}" fill="#fff" fill-opacity="0.92" stroke="${B}" stroke-width="0.25"/>`;
    lines.forEach((l, i) => g += `<text x="${f(bx)}" y="${f(by + i * 4.6)}" font-size="3" font-weight="700" fill="${B}">${esc(l)}</text>`);
  }

  // ---- ทิศเหนือ + มาตราส่วนแท่ง ----
  g += `<g transform="translate(${FX + 10} ${FY + 13})"><path d="M0 -8 L3 3 L0 1 L-3 3 Z" fill="#222"/><text y="-9.5" font-size="3.4" text-anchor="middle" font-weight="700">N</text></g>`;
  const bar = [10, 20, 25, 50, 100, 200, 250, 500].find(m => m / mpm >= 18) || 500, bw = bar / mpm, sx = FX + 6, sy = FY + availH - 3;
  g += `<g font-size="2"><rect x="${sx}" y="${sy}" width="${f(bw / 2)}" height="1.2" fill="#222"/><rect x="${f(sx + bw / 2)}" y="${sy}" width="${f(bw / 2)}" height="1.2" fill="#fff" stroke="#222" stroke-width="0.2"/><text x="${sx}" y="${sy - 0.8}">0</text><text x="${f(sx + bw)}" y="${sy - 0.8}" text-anchor="end">${bar} ม.</text></g>`;

  // ---- ตารางสัญลักษณ์ (มุมขวาบน) ----
  const lx = FX + FW - LW, ly = FY, rh = 5.6;
  const poleTxt = Object.keys(pc).length ? Object.keys(pc).map(Number).sort((a, b) => a - b).join(', ') : '……';
  const hvW = [...new Set(job.spans.filter(s => s.k === 'HV').map(s => wireShort(s.w)))].join(', ') || '……';
  const lvW = [...new Set(job.spans.filter(s => s.k === 'LV').map(s => wireShort(s.w)))].join(', ') || '……';
  const trK = job.poles.flatMap(p => p.items.filter(i => groupOfItem(i.c) === 'tr').map(i => (iname(i.c).replace(/,/g, '').match(/(\d+)\s*K[VA]{2}/i) || [])[1])).filter(Boolean);
  const npole = Object.values(pc).reduce((a, b) => a + b, 0);
  const rows = [
    ['pole', `เสาคอนกรีต ${poleTxt} เมตร`, npole ? npole + ' ต้น' : '— ต้น'],
    ['poleex', 'เสาเดิม (จุดเชื่อม)', job.poles.filter(p => p.ex).length + ' ต้น'],
    ['hv115', 'สายแรงสูง 115 kV', '— ม.'],
    ['mv', `สายแรงกลาง ${job.volt} kV ชนิด ${hvW}`, (c.hv || '—') + ' ม.'],
    ['lv', `สายแรงต่ำ ชนิด ${lvW}`, (c.lv || '—') + ' ม.'],
    ['guy', 'ยึดโยง / สมอบก', (c.guy || '—') + ' ชุด'],
    ['tr', `หม้อแปลง ${trK.join(', ') || '……'} kVA`, (c.tr || '—') + ' เครื่อง'],
    ['m', 'มิเตอร์', G.meter ? 'มี' : '—'],
    ['ex', 'ระบบเดิม (สีดำ) / ก่อสร้างใหม่ (สีน้ำเงิน)', '']
  ];
  const sym = (k, x, y) => ({
    pole: `<rect x="${x - 1.25}" y="${y - 1.25}" width="2.5" height="2.5" fill="${B}"/>`,
    poleex: `<rect x="${x - 1.1}" y="${y - 1.1}" width="2.2" height="2.2" fill="#fff" stroke="${B}" stroke-width="0.4"/>`,
    hv115: `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="#222" stroke-width="0.4" stroke-dasharray="3 1 3 1"/>`,
    mv: `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="${B}" stroke-width="0.7" stroke-dasharray="5 1 0.8 1"/>`,
    lv: `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="${B}" stroke-width="0.55" stroke-dasharray="2 1"/>`,
    guy: `<line x1="${x - 4}" y1="${y}" x2="${x + 3}" y2="${y}" stroke="${B}" stroke-width="0.35" marker-end="url(#arr)"/>`,
    tr: `<path d="M${x} ${y - 1.6} l1.6 2.8 l-3.2 0 z" fill="#fff" stroke="${B}" stroke-width="0.4"/>`,
    m: `<circle cx="${x}" cy="${y}" r="1" fill="#fff" stroke="#222" stroke-width="0.25"/><text x="${x}" y="${y + 0.5}" font-size="1.3" text-anchor="middle" font-weight="700">M</text>`,
    ex: `<line x1="${x - 5}" y1="${y - 0.8}" x2="${x + 5}" y2="${y - 0.8}" stroke="#222" stroke-width="0.35"/><line x1="${x - 5}" y1="${y + 0.8}" x2="${x + 5}" y2="${y + 0.8}" stroke="${B}" stroke-width="0.5"/>`
  }[k]);
  g += `<g font-size="2.3"><rect x="${lx}" y="${ly}" width="${LW}" height="${(rows.length + 1) * rh}" fill="#fff" stroke="#222" stroke-width="0.3"/>
    <line x1="${lx + 14}" y1="${ly}" x2="${lx + 14}" y2="${ly + (rows.length + 1) * rh}" stroke="#222" stroke-width="0.2"/><line x1="${lx + LW - 16}" y1="${ly}" x2="${lx + LW - 16}" y2="${ly + (rows.length + 1) * rh}" stroke="#222" stroke-width="0.2"/>
    <text x="${lx + 7}" y="${ly + 3.8}" text-anchor="middle" font-weight="700">สัญลักษณ์</text><text x="${lx + 14 + (LW - 30) / 2}" y="${ly + 3.8}" text-anchor="middle" font-weight="700">รายการ</text><text x="${lx + LW - 8}" y="${ly + 3.8}" text-anchor="middle" font-weight="700">จำนวน</text>`;
  rows.forEach((r, i) => { const yy = ly + (i + 1) * rh; g += `<line x1="${lx}" y1="${yy}" x2="${lx + LW}" y2="${yy}" stroke="#222" stroke-width="0.15"/>${sym(r[0], lx + 7, yy + rh / 2)}<text x="${lx + 15.5}" y="${yy + 3.8}" font-size="${r[1].length > 34 ? 1.9 : 2.3}">${esc(r[1])}</text><text x="${lx + LW - 2}" y="${yy + 3.8}" text-anchor="end">${esc(r[2])}</text>`; });
  g += '</g>';

  // ---- กรอบชื่อแบบ (ล่างขวา) ----
  const tw = Math.min(FW, 182), tx0 = FX + FW - tw, ty0 = FY + FH - TB, c1 = 54, c3 = 52, c2 = tw - c1 - c3;
  const sv = job.surveyor || HUB_USER() || '……………';
  const kind = job.spans.some(s => s.k === 'HV') ? 'งานขยายเขตระบบจำหน่ายแรงสูง' : 'งานขยายเขตระบบจำหน่ายแรงต่ำ';
  g += `<g font-size="2.2"><rect x="${tx0}" y="${ty0}" width="${tw}" height="${TB}" fill="#fff" stroke="#222" stroke-width="0.35"/>
    <line x1="${tx0 + c1}" y1="${ty0}" x2="${tx0 + c1}" y2="${ty0 + TB}" stroke="#222" stroke-width="0.25"/><line x1="${tx0 + c1 + c2}" y1="${ty0}" x2="${tx0 + c1 + c2}" y2="${ty0 + TB}" stroke="#222" stroke-width="0.25"/>
    ${[['ผู้เขียน', sv], ['ผู้สำรวจ', sv], ['วิศวกร', ''], ['หัวหน้าแผนก', ''], ['ผู้อำนวยการกอง/ผจก.', S.cfg.manager || '']].map((r, i) => `<text x="${tx0 + 1.5}" y="${ty0 + 4.5 + i * 5}">${r[0]} <tspan font-size="2">${esc(r[1] || '…………………')}</tspan></text>`).join('')}
    <text x="${tx0 + c1 + c2 / 2}" y="${ty0 + 6}" text-anchor="middle" font-size="3.6" font-weight="700">การไฟฟ้าส่วนภูมิภาค</text>
    <line x1="${tx0 + c1}" y1="${ty0 + 9}" x2="${tx0 + c1 + c2}" y2="${ty0 + 9}" stroke="#222" stroke-width="0.2"/>
    <text x="${tx0 + c1 + c2 / 2}" y="${ty0 + 14}" text-anchor="middle" font-size="2.6">${esc(S.cfg.branch)} · ${esc(job.volt)} kV ${job.phase} เฟส</text>
    <line x1="${tx0 + c1}" y1="${ty0 + 17}" x2="${tx0 + c1 + c2}" y2="${ty0 + 17}" stroke="#222" stroke-width="0.2"/>
    <text x="${tx0 + c1 + c2 / 2}" y="${ty0 + 22}" text-anchor="middle" font-size="2.6" font-weight="700">${esc(kind)}</text>
    <text x="${tx0 + c1 + c2 / 2}" y="${ty0 + 26.5}" text-anchor="middle" font-size="2.5">${esc(job.name)}${job.place ? ' · ' + esc(job.place) : ''}</text>
    <text x="${tx0 + c1 + c2 / 2}" y="${ty0 + 31.5}" text-anchor="middle" font-size="2.1">ผู้ขอใช้ไฟ ${esc(job.cust.n || '……………')}${job.reqNo ? ' · คำร้อง ' + esc(job.reqNo) : ''}</text>
    ${[['พิมพ์เมื่อวันที่', thDate(Date.now())], ['ใบเสนอราคา', job.qNo || '—'], ['มิติเป็น', 'เมตร'], ['มาตราส่วน', '1:' + den.toLocaleString('en-US')], ['แผ่นที่', '1 ของจำนวน 1']].map((r, i) => `<text x="${tx0 + c1 + c2 + 1.5}" y="${ty0 + 4.5 + i * 6}">${r[0]} <tspan font-weight="700">${esc(r[1])}</tspan></text>`).join('')}
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}mm" height="${PH}mm" font-family="Sarabun, 'IBM Plex Sans Thai', sans-serif" style="display:block;background:#fff">
    <defs><clipPath id="clipf"><rect x="${FX}" y="${FY}" width="${FW}" height="${FH}"/></clipPath>
      <filter id="gray"><feColorMatrix type="saturate" values="0"/></filter>
      <marker id="arr" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${B}"/></marker></defs>
    <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="#fff"/>
    <g clip-path="url(#clipf)">${g}</g>
    <rect x="${FX}" y="${FY}" width="${FW}" height="${FH}" fill="none" stroke="#111" stroke-width="0.6"/>
  </svg>`;
}
