/* =========================================================================
   assist.js — ตัวช่วยให้สำรวจเร็วขึ้น (v2.0)
   1) แก้เสาจากแผนที่: ขนาด/หัวเสา/ชุดที่ใส่/เพิ่มด่วน (quickPoleHtml)
   2) เช็คแบบ: หาสิ่งที่ขาด + ปุ่มแก้ (openCheck)
   3) วาดแนวสาย: แตะตามแนว → ปักเสาตามระยะ + พาดสาย + ใส่หัวเสาตามมุม (line tool)
   ใช้ฟังก์ชันจาก app.js: DB, S, cur, mapState, poleById, poleAngle, poleH, saveJob,
   drawMap, renderSheet, newPole, newSpan, pushHist, hav, otherSys, openPicker, toast, modal
   ========================================================================= */

/* ---------- ขนาดเสา / หัวเสา ---------- */
const POLE_SIZES = [['1000010001', '8'], ['1000010002', '9'], ['1000010004', '12'], ['1000010012', '12.2'], ['1000010006', '14'], ['1000010013', '14.3'], ['1000010011', '22']];
const HEAD_CHIPS = ['SP', 'SP 5-30', 'DP', 'DE', 'DDE', 'BA'];
const isHeadSet = c => /^(X-ARM|A-ARM|RACK 4 INST)/.test(DB.sets[c]?.n || '');
const isGuySet = c => /^GUY/.test(DB.sets[c]?.n || '');

/* หัวเสาตามมุมเลี้ยว (ใช้เกณฑ์เดียวกับชุดแนะนำ): ปลายสาย = DE · 0–5° = SP · 5–30° = SP 5-30 · มากกว่า 30° = DDE */
function headByAngle(job, p) {
  const a = poleAngle(job, p);
  if (a.n <= 1) return 'DE';
  if (a.n > 2) return 'DDE';
  if (a.dev < 5) return 'SP';
  if (a.dev <= 30) return 'SP 5-30';
  return 'DDE';
}
const needsGuy = head => head === 'DE' || head === 'DDE';
function spanKinds(job, p) {
  const sp = job.spans.filter(s => s.a === p.id || s.b === p.id);
  const hv = sp.some(s => s.k === 'HV'), lv = sp.some(s => s.k === 'LV');
  return { hv: hv || (!lv && mapState.kind !== 'LV'), lv };
}
function findSet(job, re) {
  const hit = Object.entries(DB.sets).filter(([c, s]) => s.i.length && re.test(s.n) && !otherSys(s.n, job.volt)).sort((a, b) => a[0].localeCompare(b[0]));
  return hit.length ? hit[0][0] : null;
}
const esc2 = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* แปลงหัวเสา → รหัสชุด (คอนสายแรงสูง + แร็คแรงต่ำ) ตามขนาดเสาและเฟส */
function headSets(job, p, head) {
  const h = poleH(p) || 12.2, ph = job.phase === 1 ? '1-P' : '3-P', { hv, lv } = spanKinds(job, p), out = [];
  if (hv && h >= 12) {
    const X = `X-ARM-C, ${ph}, `, big = h >= 14, tall = h >= 22;
    const pats = {
      'SP': tall ? [X + 'SP FOR A,PIC \\(22'] : [X + 'SP 0-5'],
      'SP 5-30': tall ? [X + 'DP FOR A,PIC \\(22'] : (ph === '3-P' ? [X + 'SP 5-30'] : [X + 'DP 5-30']),
      'DP': tall ? [X + 'DP FOR A,PIC \\(22'] : [X + 'DP 5-30'],
      'DE': tall ? [X + 'DE FOR A,PIC'] : [X + (big ? 'DE \\(14 M' : 'DE \\(12 M')],
      'DDE': [X + (big ? 'DDE \\(14 M' : 'DDE \\(STL'), X + 'DDE'],
      'BA': tall ? [X + 'BA FOR A,PIC \\(22'] : [X + 'BA$', X + 'BA']
    }[head] || [];
    for (const pt of pats) { const c = findSet(job, new RegExp('^' + pt.replace(/, /g, ',\\s?').replace(/^X-ARM-C/, 'X-ARM-C'), 'i')); if (c) { out.push(c); break; } }
  }
  if (lv) {
    const base = h < 12 ? 'RACK 4 INST. ON LT. POLE' : `RACK 4 INST. UNDER HT. (${h >= 14.3 ? '14.30' : h >= 14 ? '14' : h >= 12.2 ? '12.20' : '12'} M.)`;
    const tail = { 'SP': '0-5 DEGREE', 'SP 5-30': '5-60 DEGREE', 'DP': '5-60 DEGREE', 'BA': '5-60 DEGREE', 'DE': 'DE 50-70', 'DDE': 'DDE 50-70' }[head];
    const c = tail && findSet(job, new RegExp('^' + esc2(base) + ',\\s*' + esc2(tail)));
    if (c) out.push(c);
  }
  return out;
}
function guyCode(job, p) {
  const h = poleH(p) || 12.2;
  return (h >= 22 && DB.sets['33005'] && '33005') || (h >= 12.2 && DB.sets['33002'] && '33002') || (h >= 12 && DB.sets['33001'] && '33001') || (DB.sets['33007'] && '33007') || findSet(job, /^GUY, GY-/);
}
/* ใส่หัวเสา: ลบชุดหัวเสาเดิม แล้วใส่ชุดใหม่ (ถ้าระบุ withGuy จะใส่ยึดโยงให้ด้วยเมื่อเป็น DE/DDE) */
function applyHead(job, p, head, withGuy) {
  p.head = head;
  if (p.ex) return [];
  p.sets = (p.sets || []).filter(x => !isHeadSet(x.c));
  const add = headSets(job, p, head);
  add.forEach(c => p.sets.push({ c, q: 1 }));
  if (withGuy && needsGuy(head) && !p.sets.some(x => isGuySet(x.c))) { const g = guyCode(job, p); if (g) { p.sets.push({ c: g, q: 1 }); add.push(g); } }
  return add;
}
function setShort(c) { const n = DB.sets[c]?.n || c; return n.replace(/\s*\(ASSEMBLY NO\.\d+\)/, '').replace(/STL-BAY[CO]NET/, 'STL'); }

/* ---------- ชุดที่ใช้ล่าสุด ---------- */
function recentSets() { try { return JSON.parse(localStorage.getItem('ccs_recent') || '[]').filter(c => DB.sets[c]); } catch (e) { return []; } }
function pushRecent(c) { const r = recentSets().filter(x => x !== c); r.unshift(c); try { localStorage.setItem('ccs_recent', JSON.stringify(r.slice(0, 8))); } catch (e) {} }

/* ---------- 1) แผงแก้เสาบนแผนที่ ---------- */
function quickPoleHtml(job, p) {
  const h = poleH(p), head = poleHead(p), ang = poleAngle(job, p), auto = headByAngle(job, p);
  const pos = ang.n <= 1 ? 'ปลายสาย' : ang.n > 2 ? `แยก ${ang.n} ทาง` : ang.dev < 5 ? 'ทางตรง' : `มุมเลี้ยว ${ang.dev}°`;
  const chip = (on, label, act, extra = '') => `<button class="qc ${on ? 'on' : ''}" onclick="${act}" ${extra}>${label}</button>`;
  const rec = recentSets().filter(c => !p.sets.some(x => x.c === c)).slice(0, 3);
  let x = `<div class="qrow"><span class="qk">ขนาด</span>${POLE_SIZES.filter(([c, s]) => !p.ex || true).map(([c, s]) => chip(+h === +s, s, `qSize('${p.id}','${c}',${s})`)).join('')}</div>
  <div class="qrow"><span class="qk">หัวเสา</span>${HEAD_CHIPS.map(hd => chip(head === hd || (hd === 'SP' && /^SP( 0-5)?$/.test(head)), hd, `qHead('${p.id}','${hd}')`)).join('')}${p.ex ? '' : chip(false, 'ตามมุม', `qHead('${p.id}','auto')`, `title="ตามมุม = ${auto}"`)}</div>`;
  if (!p.ex) {
    x += `<div class="qbox">${p.sets.length ? p.sets.map(s => `<div class="qset"><span class="grow">${esc(setShort(s.c))}${s.q > 1 ? ` <b>× ${s.q}</b>` : ''}</span><button class="qx" aria-label="ลบ ${s.c}" onclick="qDelSet('${p.id}','${s.c}')">×</button></div>`).join('') : `<div class="s12 muted">ยังไม่มีชุดอุปกรณ์ · แตะหัวเสาด้านบน หรือ "ตามมุม" (${pos} → ${auto})</div>`}</div>
    <div class="qrow"><span class="qk">เพิ่ม</span>${chip(false, '+ ยึดโยง', `qGuy('${p.id}')`)}${chip(false, '+ หม้อแปลง', `qPick('${p.id}','tr')`)}${chip(false, '+ มิเตอร์', `qPick('${p.id}','meter')`)}${chip(false, '+ อื่นๆ', `qPick('${p.id}','set')`)}${rec.map(c => chip(false, '+ ' + c, `qAdd('${p.id}','${c}')`, `title="${esc(DB.sets[c].n)}"`)).join('')}</div>`;
  }
  return x;
}
const qJob = () => cur.job;
const qRefresh = job => { saveJob(job); drawMap(job); renderSheet(job); };
window.qSize = (id, code, s) => {
  const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job);
  if (p.ex) p.h = +s; else { p.pole = code; delete p.h; }
  const hd = poleHead(p); if (!p.ex && p.sets.some(x => isHeadSet(x.c)) && hd) applyHead(job, p, HEAD_CHIPS.includes(hd) ? hd : headByAngle(job, p));
  qRefresh(job);
};
window.qHead = (id, hd) => {
  const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job);
  if (hd === 'auto') hd = headByAngle(job, p);
  const add = applyHead(job, p, hd, false);
  if (!p.ex && !add.length) toast(`ไม่พบชุดหัวเสา ${hd} สำหรับเสา ${poleH(p) || ''} ม. — ใช้ "+ อื่นๆ" เลือกเอง`);
  qRefresh(job);
};
window.qDelSet = (id, c) => { const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job); const s = p.sets.find(x => x.c === c); if (s && s.q > 1) s.q--; else p.sets = p.sets.filter(x => x.c !== c); if (isHeadSet(c) && !p.sets.some(x => isHeadSet(x.c))) delete p.head; qRefresh(job); };
window.qAdd = (id, c) => { const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job); const s = p.sets.find(x => x.c === c); s ? s.q++ : p.sets.push({ c, q: 1 }); pushRecent(c); toast(`เพิ่ม ${c} ที่ ${p.label}`); qRefresh(job); };
window.qGuy = id => { const job = qJob(), p = poleById(job, id); const g = p && guyCode(job, p); if (!g) return toast('ไม่พบชุดยึดโยง'); qAdd(id, g); };
window.qPick = (id, preset) => { const job = qJob(), p = poleById(job, id); if (!p) return; openPicker({ job, pole: p, preset, after: () => qRefresh(job) }); };

/* ---------- 2) เช็คแบบ ---------- */
function checkJob(job) {
  const out = [];
  job.poles.forEach(p => {
    if (p.lat == null && job.kind === 'quick') return;
    const sp = job.spans.filter(s => s.a === p.id || s.b === p.id);
    if (p.ex) { if (sp.length && !poleHead(p)) out.push({ lv: 'warn', p, msg: `${p.label} เสาเดิม ยังไม่ระบุหัวเสา`, fix: 'เลือก', act: `qSel('${p.id}')` }); return; }
    if (!sp.length && !p.sets.length && !p.items.length) { out.push({ lv: 'warn', p, msg: `${p.label} ยังไม่ต่อสายและไม่มีอุปกรณ์`, fix: 'เลือก', act: `qSel('${p.id}')` }); return; }
    const want = headByAngle(job, p), hasHead = p.sets.some(x => isHeadSet(x.c)), hd = poleHead(p);
    if (!hasHead && sp.length) out.push({ lv: 'err', p, msg: `${p.label} ยังไม่มีชุดหัวเสา (ควรเป็น ${want})`, fix: `ใส่ ${want}`, act: `ckHead('${p.id}')`, auto: true });
    else if (hasHead && sp.length) {
      const endish = want === 'DE' || want === 'DDE', isEnd = /^(DE|DDE|2DE)/.test(hd);
      if (endish && !isEnd) out.push({ lv: 'warn', p, msg: `${p.label} ${want === 'DE' ? 'ปลายสาย' : 'มุมเลี้ยวมาก'} แต่หัวเสาเป็น ${hd || 'อื่น'}`, fix: `เปลี่ยน ${want}`, act: `ckHead('${p.id}')`, auto: true });
    }
    if (sp.length && needsGuy(hasHead ? (/^(DE|DDE)/.test(hd) ? hd.split(' ')[0] : want) : want) && !p.sets.some(x => isGuySet(x.c)))
      out.push({ lv: 'err', p, msg: `${p.label} ${want === 'DE' ? 'ปลายสาย' : 'มุมเลี้ยว'} ยังไม่มียึดโยง`, fix: '+ ยึดโยง', act: `ckGuy('${p.id}')`, auto: true });
  });
  job.spans.forEach(s => { const L = spanLen(job, s); if (L > 120) out.push({ lv: 'warn', msg: `ช่วงสาย ${poleById(job, s.a)?.label}–${poleById(job, s.b)?.label} ยาว ${L} ม. (เกิน 120 ม.)`, fix: 'ดู', act: `qSpan('${s.id}')` }); });
  const B = computeBOM(job);
  if (B.noPrice) out.push({ lv: 'warn', msg: `พัสดุ ${B.noPrice} รายการยังไม่มีราคา`, fix: 'ไปถอดแบบ', act: `closeModal();go('#bom/${job.id}')` });
  return out;
}
window.ckHead = id => { const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job); applyHead(job, p, headByAngle(job, p), true); saveJob(job); refreshCheck(); };
window.ckGuy = id => { const job = qJob(), p = poleById(job, id); const g = p && guyCode(job, p); if (!g) return toast('ไม่พบชุดยึดโยง'); pushHist(job); p.sets.push({ c: g, q: 1 }); saveJob(job); refreshCheck(); };
window.ckAll = () => {
  const job = qJob(); pushHist(job); let n = 0;
  checkJob(job).filter(i => i.auto).forEach(i => { const p = i.p; if (!p) return;
    if (/ยึดโยง/.test(i.fix)) { if (!p.sets.some(x => isGuySet(x.c))) { const g = guyCode(job, p); if (g) { p.sets.push({ c: g, q: 1 }); n++; } } }
    else { applyHead(job, p, headByAngle(job, p), true); n++; } });
  saveJob(job); toast(`แก้แล้ว ${n} รายการ`); refreshCheck();
};
window.qSel = id => { closeModal(); if (!location.hash.startsWith('#map/')) { mapState.sel = id; return go(`#map/${cur.job.id}`); } mapState.sel = id; const p = poleById(cur.job, id); if (p?.lat != null) cur.map.setView([p.lat, p.lng], Math.max(cur.map.getZoom(), 19)); drawMap(cur.job); renderSheet(cur.job); };
window.qSpan = id => { closeModal(); const s = cur.job.spans.find(x => x.id === id); if (s && location.hash.startsWith('#map/')) openSpan(cur.job, s); };
function checkHtml(job) {
  const L = checkJob(job), col = { err: '#B42318', warn: '#B54708' };
  if (!L.length) return `<div class="ckok">✓ ไม่พบสิ่งที่ขาด · เสา ${job.poles.length} ต้น · ช่วงสาย ${job.spans.length} ช่วง</div>`;
  const nAuto = L.filter(i => i.auto).length;
  return `<div class="s13 muted">พบ ${L.length} รายการ · แตะปุ่มเพื่อแก้ทีละข้อ${nAuto ? ' หรือแก้ทั้งหมดตามที่แนะนำ' : ''}</div>
  <div class="list">${L.map(i => `<div class="ck"><span style="color:${col[i.lv]}">●</span><div class="grow s14">${esc(i.msg)}</div><button class="btn sm g" onclick="${i.act}">${esc(i.fix)}</button></div>`).join('')}</div>
  ${nAuto ? `<button class="btn p" onclick="ckAll()">แก้ทั้งหมดตามที่แนะนำ (${nAuto})</button>` : ''}
  <div class="s12 muted">เกณฑ์หัวเสา: ปลายสาย = DE + ยึดโยง · ทางตรง 0–5° = SP · 5–30° = SP 5-30 · เกิน 30° = DDE + ยึดโยง</div>`;
}
window.openCheck = () => { const job = qJob(); if (!job) return; modal('เช็คแบบ · ' + job.name, `<div id="ckbody" class="stack">${checkHtml(job)}</div>`); };
function refreshCheck() { const b = $('#ckbody'); if (b) b.innerHTML = checkHtml(qJob()); if (cur.map) { drawMap(qJob()); renderSheet(qJob()); } }
const checkCount = job => checkJob(job).filter(i => i.lv === 'err').length;

/* ---------- 3) วาดแนวสาย ---------- */
const LINE = { pts: [], gap: +localStorage.getItem('ccs_linegap') || 40, size: localStorage.getItem('ccs_linesize') || '1000010012' };
function lineStartPole(job) { const a = LINE.pts[0]; return a && a.pid ? poleById(job, a.pid) : null; }
/* แบ่งแนว: มุมทุกจุดเป็นเสา ระหว่างมุมแบ่งเท่าๆ กันไม่เกินระยะที่เลือก */
function linePlan() {
  const P = LINE.pts, out = []; if (P.length < 2) return { pts: P.slice(), len: 0, n: 0 };
  let len = 0; out.push(P[0]);
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], d = hav(a, b); len += d; const k = Math.max(1, Math.ceil(d / LINE.gap - 0.05));
    for (let j = 1; j <= k; j++) out.push(j === k ? b : { lat: a.lat + (b.lat - a.lat) * j / k, lng: a.lng + (b.lng - a.lng) * j / k });
  }
  return { pts: out, len: Math.round(len), n: out.filter(q => !q.pid).length };
}
function lineAddPoint(job, ll, pid) {
  if (!pid) { const near = job.poles.filter(q => q.lat != null).map(q => [q, hav(q, ll)]).sort((x, y) => x[1] - y[1])[0]; if (near && near[1] < 6) { pid = near[0].id; ll = { lat: near[0].lat, lng: near[0].lng }; } }
  LINE.pts.push({ lat: +(+ll.lat).toFixed(7), lng: +(+ll.lng).toFixed(7), pid: pid || null });
  drawLine(); renderSheet(job); updateAim(job);
}
function drawLine() {
  if (!cur.map) return; if (!cur.lineLyr) cur.lineLyr = L.layerGroup().addTo(cur.map); cur.lineLyr.clearLayers();
  if (mapState.tool !== 'line' || !LINE.pts.length) return;
  const P = LINE.pts.map(q => [q.lat, q.lng]); L.polyline(P, { color: mapState.kind === 'HV' ? '#5B1A63' : '#0F7C8C', weight: 4, dashArray: '2 8', interactive: false }).addTo(cur.lineLyr);
  linePlan().pts.forEach(q => L.circleMarker([q.lat, q.lng], { radius: q.pid ? 7 : 6, color: '#fff', weight: 2, fillColor: q.pid ? '#1E1A22' : '#D03A3A', fillOpacity: 1, interactive: false }).addTo(cur.lineLyr));
}
function lineSheetHtml(job) {
  const pl = linePlan(), chip = (on, l, a) => `<button class="qc ${on ? 'on' : ''}" onclick="${a}">${l}</button>`;
  return `<div class="qrow"><span class="qk">ระยะช่วง</span>${[30, 40, 50, 80].map(v => chip(LINE.gap === v, v, `lineGap(${v})`)).join('')}<input class="in" type="number" inputmode="decimal" aria-label="ระยะช่วง (เมตร)" value="${LINE.gap}" onchange="lineGap(this.value)" style="width:62px;height:34px;text-align:center"></div>
  <div class="qrow"><span class="qk">เสาใหม่</span>${POLE_SIZES.filter(([c]) => c !== '1000010006').map(([c, s]) => chip(LINE.size === c, s + ' ม.', `lineSize('${c}')`)).join('')}</div>
  <div class="s13 muted">${LINE.pts.length < 2 ? `แตะจุดเริ่ม (แตะเสาเดิม/เสาในงานเพื่อต่อจากต้นนั้น) แล้วแตะตามแนวถนนทีละจุด · กากบาท + "เพิ่มจุด" ก็ได้` : `แนวยาว <b>${pl.len.toLocaleString('th-TH')}</b> ม. · ปักเสาใหม่ <b>${pl.n}</b> ต้น · สาย ${mapState.kind === 'HV' ? 'แรงสูง' : 'แรงต่ำ'} · ใส่หัวเสาตามมุมให้เอง`}</div>
  <div class="row"><button class="btn g" onclick="lineUndo()" ${LINE.pts.length ? '' : 'disabled'}>ย้อนจุด</button><button class="btn g" onclick="lineAim()">เพิ่มจุด</button><button class="btn p" style="flex:1" onclick="lineDone()" ${LINE.pts.length < 2 ? 'disabled' : ''}>ปักเสา ${pl.n || ''} ต้น</button></div>`;
}
window.lineGap = v => { v = Math.max(10, Math.min(200, Math.round(+v || 40))); LINE.gap = v; localStorage.setItem('ccs_linegap', v); drawLine(); renderSheet(cur.job); };
window.lineSize = c => { LINE.size = c; localStorage.setItem('ccs_linesize', c); renderSheet(cur.job); };
window.lineUndo = () => { LINE.pts.pop(); drawLine(); renderSheet(cur.job); updateAim(cur.job); };
window.lineAim = () => lineAddPoint(cur.job, cur.map.getCenter());
window.lineDone = () => {
  const job = cur.job, pl = linePlan(); if (pl.pts.length < 2) return;
  pushHist(job); const ids = [];
  pl.pts.forEach(q => { if (q.pid && poleById(job, q.pid)) { ids.push(q.pid); return; } const p = newPole(job, q.lat, q.lng, false); p.pole = LINE.size; job.poles.push(p); ids.push(p.id); });
  for (let i = 1; i < ids.length; i++) if (ids[i] !== ids[i - 1] && !job.spans.some(s => ((s.a === ids[i - 1] && s.b === ids[i]) || (s.a === ids[i] && s.b === ids[i - 1])) && s.k === mapState.kind)) job.spans.push(newSpan(job, ids[i - 1], ids[i], mapState.kind));
  let n = 0; ids.forEach(id => { const p = poleById(job, id); if (p && !p.ex) { applyHead(job, p, headByAngle(job, p), true); n++; } });
  /* เสาต้นแรกที่เป็นเสาในงาน (ไม่ใช่เสาเดิม) อาจเปลี่ยนจากปลายสายเป็นทางผ่าน → คำนวณหัวใหม่ */
  LINE.pts = []; mapState.sel = ids[ids.length - 1]; saveJob(job); drawLine(); drawMap(job); renderSheet(job);
  toast(`ปักเสาใหม่ ${pl.n} ต้น พาดสาย ${ids.length - 1} ช่วง · ใส่หัวเสาตามมุมแล้ว`);
};
function lineReset() { LINE.pts = []; drawLine(); }
