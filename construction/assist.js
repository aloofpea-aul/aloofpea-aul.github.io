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

/* ---------- 2) เช็คแบบตามมาตรฐาน (สมุดกฎ) ----------
   ค่าเกณฑ์อยู่ใน RULES (ค่าตั้งต้น) + S.cfg.rules (ค่าที่ผู้ใช้แก้/ยืนยันในหน้าตั้งค่า)
   ok = ยืนยันกับเอกสาร กฟภ. แล้ว · ข้อที่ยังไม่ยืนยัน แจ้งเป็นคำเตือนเท่านั้น ไม่บังคับแก้ */
const RULE_CATS = { 1: 'คุณสมบัติการขยายเขต', 2: 'ทางเทคนิค', 3: 'แบบมาตรฐานประกอบ', 4: 'เอกสารหน้างาน' };
const RULES = [
  { id: 'restrict', cat: 1, n: 'พื้นที่หวงห้าม (ป่าสงวน เขตชลประทาน พื้นที่ทหาร ฯลฯ)', v: 'ต้องมีหนังสือยินยอม', ref: 'หลักเกณฑ์โครงการขยายเขตระบบไฟฟ้า กฟภ. ข้อ 3.5', ok: true, text: true },
  { id: 'land', cat: 1, n: 'ปักเสา/พาดสายผ่านที่ดินเอกชน', v: 'ต้องมีหนังสือยินยอมเจ้าของที่ดิน', ref: '', ok: false, text: true },
  { id: 'v33', cat: 2, n: 'แรงดัน 33 kV ภาวะปกติ', v: '31.3–34.7', u: 'kV', ref: 'มาตรฐานคุณภาพบริการ กฟภ. ข้อ 1.1.3', ok: true, text: true, info: true },
  { id: 'spanHV', cat: 2, n: 'ระยะช่วงเสาสูงสุด สายแรงสูง', v: null, u: 'ม.', ref: '', ok: false },
  { id: 'spanLV', cat: 2, n: 'ระยะช่วงเสาสูงสุด สายแรงต่ำ', v: null, u: 'ม.', ref: '', ok: false },
  { id: 'lvLen', cat: 2, n: 'ระยะสายแรงต่ำจากหม้อแปลงถึงปลายสาย', v: null, u: 'ม.', ref: '', ok: false },
  { id: 'clear', cat: 2, n: 'ระยะห่างสายจากอาคาร/สิ่งปลูกสร้าง', v: 'ตรวจหน้างานแล้ว', ref: '', ok: false, text: true },
  { id: 'head', cat: 3, n: 'หัวเสาตามมุมเลี้ยว', v: 'ปลายสาย DE · 0–5° SP · 5–30° SP 5-30 · >30° DDE', ref: 'เกณฑ์ตั้งต้นของแอป', ok: false, text: true },
  { id: 'guy', cat: 3, n: 'ยึดโยงที่ปลายสายและมุมเลี้ยวเกิน 30°', v: 'ต้องมี', ref: 'เกณฑ์ตั้งต้นของแอป', ok: false, text: true },
  { id: 'photo', cat: 4, n: 'รูปจุดปักเสาใหม่ทุกต้น', v: 'อย่างน้อย 1 รูป/ต้น', ref: '', ok: false, text: true },
  { id: 'trees', cat: 4, n: 'ต้นไม้ที่ต้องตัดตามแนวสาย', v: 'ระบุให้ครบ', ref: '', ok: false, text: true },
  { id: 'req', cat: 4, n: 'ข้อมูลคำร้อง (เลขคำร้อง ชื่อ/โทรผู้ขอใช้ไฟ)', v: 'ครบ', ref: '', ok: false, text: true },
  { id: 'price', cat: 4, n: 'ราคาวัสดุครบทุกรายการ', v: 'ครบ', ref: 'ราคามาตรฐานพัสดุ กฟภ.', ok: true, text: true }
];
function rule(id) { const r = RULES.find(x => x.id === id); const o = (S.cfg.rules || {})[id] || {}; return Object.assign({}, r, o.v !== undefined ? { v: o.v } : {}, o.ref !== undefined ? { ref: o.ref } : {}, o.ok !== undefined ? { ok: o.ok } : {}); }
const sev = r => r.ok ? 'err' : 'warn';
/* คำถามหน้างาน: เก็บใน job.svy ตอบในหน้าต่างเช็คแบบ */
const SVY = {
  restrict: { q: 'แนวสายอยู่ในพื้นที่หวงห้ามไหม', opts: [['no', 'ไม่อยู่'], ['doc', 'อยู่ · มีหนังสือยินยอม'], ['nodoc', 'อยู่ · ยังไม่มี']] },
  land: { q: 'ผ่านที่ดินเอกชนไหม', opts: [['no', 'ไม่ผ่าน'], ['doc', 'ผ่าน · ยินยอมแล้ว'], ['nodoc', 'ผ่าน · ยังไม่ยินยอม']] },
  clear: { q: 'ตรวจระยะห่างจากอาคารแล้วหรือยัง', opts: [['ok', 'ตรวจแล้ว ผ่าน'], ['fix', 'ตรวจแล้ว ต้องแก้แนว'], ['na', 'ไม่มีอาคารใกล้']] },
  trees: { q: 'ต้องตัดต้นไม้ไหม', opts: [['no', 'ไม่ต้อง'], ['yes', 'ต้องตัด (ระบุในหมายเหตุ)']] }
};
function svyChips(job, k) { const v = (job.svy || {})[k]; return `<div class="qrow" style="flex-wrap:wrap">${SVY[k].opts.map(([o, l]) => `<button class="qc ${v === o ? 'on' : ''}" onclick="setSvy('${k}','${o}')">${l}</button>`).join('')}</div>`; }
window.setSvy = (k, v) => { const job = qJob(); job.svy = job.svy || {}; job.svy[k] = v; saveJob(job); refreshCheck(); };
function checkJob(job) {
  const out = [], svy = job.svy || {}, add = (cat, lv, msg, r, x = {}) => out.push(Object.assign({ cat, lv, msg, ref: r && (r.ref || (r.ok ? '' : 'ยังไม่ยืนยันกับเอกสาร')) }, x));
  const live = job.kind !== 'quick';
  /* หมวด 1 · คุณสมบัติการขยายเขต */
  if (live) {
    let r = rule('restrict');
    if (!svy.restrict) add(1, 'warn', SVY.restrict.q + ' — ยังไม่ได้ตอบ', r, { svy: 'restrict' });
    else if (svy.restrict === 'nodoc') add(1, sev(r), 'อยู่ในพื้นที่หวงห้าม แต่ยังไม่มีหนังสือยินยอม', r, { svy: 'restrict' });
    r = rule('land');
    if (!svy.land) add(1, 'warn', SVY.land.q + ' — ยังไม่ได้ตอบ', r, { svy: 'land' });
    else if (svy.land === 'nodoc') add(1, sev(r), 'ผ่านที่ดินเอกชน แต่เจ้าของยังไม่ยินยอม', r, { svy: 'land' });
  }
  /* หมวด 2 · ทางเทคนิค */
  job.spans.forEach(s => {
    const r = rule(s.k === 'LV' ? 'spanLV' : 'spanHV'), lim = +r.v || 120, L = spanLen(job, s);
    if (L > lim) add(2, r.v ? sev(r) : 'warn', `ช่วง ${poleById(job, s.a)?.label}–${poleById(job, s.b)?.label} (${s.k === 'LV' ? 'แรงต่ำ' : 'แรงสูง'}) ยาว ${L} ม. เกิน ${lim} ม.${r.v ? '' : ' (ค่าชั่วคราว)'}`, r, { fix: 'ดู', act: `qSpan('${s.id}')` });
  });
  { const r = rule('lvLen'); if (r.v) { const trPoles = job.poles.filter(p => [...(p.sets || [])].some(x => /TR\.INST/.test(DB.sets[x.c]?.n || ''))); const far = lvFarthest(job, trPoles); if (far && far.d > +r.v) add(2, sev(r), `สายแรงต่ำไกลสุดจากหม้อแปลง ${far.d} ม. ถึง ${far.p.label} เกิน ${r.v} ม.`, r, { fix: 'เลือก', act: `qSel('${far.p.id}')` }); } }
  if (live && job.spans.length) { const r = rule('clear'); if (!svy.clear) add(2, 'warn', SVY.clear.q, r, { svy: 'clear' }); else if (svy.clear === 'fix') add(2, sev(r), 'ระยะห่างจากอาคารไม่ผ่าน ต้องแก้แนวสาย', r, { svy: 'clear' }); }
  /* หมวด 3 · แบบมาตรฐานประกอบ */
  const rh = rule('head'), rg = rule('guy'), noPhoto = [];
  job.poles.forEach(p => {
    if (p.lat == null && job.kind === 'quick') return;
    const sp = job.spans.filter(s => s.a === p.id || s.b === p.id);
    if (p.ex) { if (sp.length && !poleHead(p)) add(3, 'warn', `${p.label} เสาเดิม ยังไม่ระบุหัวเสา`, null, { fix: 'เลือก', act: `qSel('${p.id}')` }); return; }
    if (p.lat != null && !(p.photos || []).length) noPhoto.push(p);
    if (!sp.length && !p.sets.length && !p.items.length) { add(3, 'warn', `${p.label} ยังไม่ต่อสายและไม่มีอุปกรณ์`, null, { fix: 'เลือก', act: `qSel('${p.id}')` }); return; }
    const want = headByAngle(job, p), hasHead = p.sets.some(x => isHeadSet(x.c)), hd = poleHead(p);
    if (!hasHead && sp.length) add(3, 'err', `${p.label} ยังไม่มีชุดหัวเสา (ควรเป็น ${want})`, rh, { fix: `ใส่ ${want}`, act: `ckHead('${p.id}')`, auto: true });
    else if (hasHead && sp.length && needsGuy(want) && !/^(DE|DDE|2DE)/.test(hd)) add(3, sev(rh), `${p.label} ${want === 'DE' ? 'ปลายสาย' : 'มุมเลี้ยวมาก'} แต่หัวเสาเป็น ${hd || 'อื่น'}`, rh, { fix: `เปลี่ยน ${want}`, act: `ckHead('${p.id}')`, auto: true });
    if (sp.length && needsGuy(hasHead && /^(DE|DDE)/.test(hd) ? hd.split(' ')[0] : want) && !p.sets.some(x => isGuySet(x.c)))
      add(3, rg.ok ? 'err' : 'err', `${p.label} ${want === 'DE' ? 'ปลายสาย' : 'มุมเลี้ยว'} ยังไม่มียึดโยง`, rg, { fix: '+ ยึดโยง', act: `ckGuy('${p.id}')`, auto: true });
  });
  /* หมวด 4 · เอกสารหน้างาน */
  if (live && noPhoto.length) add(4, 'warn', `ยังไม่มีรูปจุดปักเสา: ${noPhoto.slice(0, 8).map(p => p.label).join(', ')}${noPhoto.length > 8 ? ` และอีก ${noPhoto.length - 8} ต้น` : ''}`, rule('photo'), { fix: 'ถ่ายรูป', act: `closeModal();go('#pole/${job.id}/${noPhoto[0].id}')` });
  if (live && job.spans.length) { const r = rule('trees'); if (!svy.trees) add(4, 'warn', SVY.trees.q + ' — ยังไม่ได้ตอบ', r, { svy: 'trees' }); else if (svy.trees === 'yes' && !/ต้นไม้|ตัด/.test(job.note || '')) add(4, 'warn', 'ต้องตัดต้นไม้ แต่ยังไม่ได้ระบุในหมายเหตุงาน', r, { fix: 'ระบุ', act: `closeModal();go('#info/${job.id}')` }); }
  if (live) { const miss = [!job.reqNo && 'เลขคำร้อง', !(job.cust && job.cust.n) && 'ชื่อผู้ขอใช้ไฟ', !(job.cust && job.cust.t) && 'เบอร์โทร'].filter(Boolean); if (miss.length) add(4, 'warn', 'ยังไม่มี ' + miss.join(' / '), rule('req'), { fix: 'กรอก', act: `closeModal();go('#info/${job.id}')` }); }
  { const B = computeBOM(job); if (B.noPrice) add(4, 'warn', `พัสดุ ${B.noPrice} รายการยังไม่มีราคา`, rule('price'), { fix: 'ไปถอดแบบ', act: `closeModal();go('#bom/${job.id}')` }); }
  return out;
}
/* ระยะสายแรงต่ำไกลสุดจากเสาหม้อแปลง (เดินตามช่วงสาย LV) */
function lvFarthest(job, trPoles) {
  if (!trPoles.length) return null; const adj = {}; job.spans.filter(s => s.k === 'LV').forEach(s => { const L = spanLen(job, s); (adj[s.a] = adj[s.a] || []).push([s.b, L]); (adj[s.b] = adj[s.b] || []).push([s.a, L]); });
  const dist = {}; const q = trPoles.map(p => (dist[p.id] = 0, p.id));
  while (q.length) { const u = q.shift(); (adj[u] || []).forEach(([v, L]) => { const d = dist[u] + L; if (dist[v] === undefined || d < dist[v]) { dist[v] = d; q.push(v); } }); }
  let best = null; Object.entries(dist).forEach(([id, d]) => { if (!best || d > best.d) best = { d: Math.round(d), p: poleById(job, id) }; });
  return best && best.d > 0 ? best : null;
}
window.ckHead = id => { const job = qJob(), p = poleById(job, id); if (!p) return; pushHist(job); applyHead(job, p, headByAngle(job, p), true); saveJob(job); refreshCheck(); };
window.ckGuy = id => { const job = qJob(), p = poleById(job, id); const g = p && guyCode(job, p); if (!g) return toast('ไม่พบชุดยึดโยง'); pushHist(job); p.sets.push({ c: g, q: 1 }); saveJob(job); refreshCheck(); };
window.ckAll = () => {
  const job = qJob(); pushHist(job); let n = 0;
  checkJob(job).filter(i => i.auto).forEach(i => { const m = /'([^']+)'/.exec(i.act), p = m && poleById(job, m[1]); if (!p) return;
    if (/^ckGuy/.test(i.act)) { if (!p.sets.some(x => isGuySet(x.c))) { const g = guyCode(job, p); if (g) { p.sets.push({ c: g, q: 1 }); n++; } } }
    else { applyHead(job, p, headByAngle(job, p), true); n++; } });
  saveJob(job); toast(`แก้แล้ว ${n} รายการ`); refreshCheck();
};
window.qSel = id => { closeModal(); mapState.sel = id; if (!location.hash.startsWith('#map/')) return go(`#map/${cur.job.id}`); const p = poleById(cur.job, id); if (p?.lat != null) cur.map.setView([p.lat, p.lng], Math.max(cur.map.getZoom(), 19)); drawMap(cur.job); renderSheet(cur.job); };
window.qSpan = id => { closeModal(); const s = cur.job.spans.find(x => x.id === id); if (s && location.hash.startsWith('#map/')) openSpan(cur.job, s); };
function checkHtml(job) {
  const L = checkJob(job), col = { err: '#B42318', warn: '#B54708' }, nAuto = L.filter(i => i.auto).length;
  let h = '';
  for (const c of [1, 2, 3, 4]) {
    const its = L.filter(i => i.cat === c), ne = its.filter(i => i.lv === 'err').length;
    h += `<div class="ckcat"><span style="color:${ne ? col.err : its.length ? col.warn : '#0B6E4F'}">●</span><b class="grow">${c}. ${RULE_CATS[c]}</b><span class="ckbd ${its.length ? 'w' : 'g'}">${its.length ? its.length + ' ข้อ' : 'ผ่าน'}</span></div>`;
    h += its.map(i => `<div class="ck"><span style="color:${col[i.lv]}">●</span><div class="grow"><div class="s14">${esc(i.msg)}</div>${i.ref ? `<div class="s12 muted">${esc(i.ref)}</div>` : ''}${i.svy ? svyChips(job, i.svy) : ''}</div>${i.fix ? `<button class="btn sm g" onclick="${i.act}">${esc(i.fix)}</button>` : ''}</div>`).join('');
    if (c === 1 && job.svy && !its.length && job.kind !== 'quick') h += `<div class="ck"><div class="grow s12 muted">${['restrict', 'land'].map(k => SVY[k].q + ': ' + (SVY[k].opts.find(o => o[0] === job.svy[k])?.[1] || '-')).join(' · ')} <a href="javascript:void(0)" onclick="ckReask(['restrict','land'])">แก้คำตอบ</a></div></div>`;
  }
  return `<div class="s13 muted">พบ ${L.length} ข้อ · <span style="color:${col.err}">●</span> ต้องแก้ · <span style="color:${col.warn}">●</span> ควรตรวจ (เกณฑ์ที่ยังไม่ยืนยันกับเอกสารจะเป็นคำเตือน)</div>${h}
  ${nAuto ? `<button class="btn p" onclick="ckAll()">แก้หัวเสา/ยึดโยงทั้งหมดตามที่แนะนำ (${nAuto})</button>` : ''}
  <a class="s13" href="#settings" onclick="closeModal()">ดู/แก้สมุดกฎมาตรฐาน →</a>`;
}
window.ckReask = ks => { const job = qJob(); job.svy = job.svy || {}; ks.forEach(k => delete job.svy[k]); saveJob(job); refreshCheck(); };
window.openCheck = () => { const job = qJob(); if (!job) return; modal('เช็คแบบตามมาตรฐาน · ' + job.name, `<div id="ckbody" class="stack">${checkHtml(job)}</div>`); };
function refreshCheck() { const b = $('#ckbody'); if (b) b.innerHTML = checkHtml(qJob()); if (cur.map) { drawMap(qJob()); renderSheet(qJob()); } }
const checkCount = job => checkJob(job).filter(i => i.lv === 'err').length;

/* ---------- สมุดกฎ (หน้าตั้งค่า) ---------- */
function rulebookHtml() {
  const nOk = RULES.filter(r => rule(r.id).ok).length;
  return `<details class="card stack" id="rulebook"><summary style="cursor:pointer"><b>สมุดกฎมาตรฐาน</b> <span class="s13 muted">· ยืนยันแล้ว ${nOk}/${RULES.length} ข้อ</span></summary><div class="s13 muted" style="margin-top:8px">ค่าเกณฑ์ที่ใช้ในปุ่ม "เช็คแบบ" · กรอกค่า ใส่ชื่อเอกสาร/เลขข้อที่อ้างอิง แล้วติ๊ก "ยืนยันแล้ว" เมื่อตรวจกับเอกสาร กฟภ. แล้ว (ข้อที่ยังไม่ยืนยันจะแจ้งเป็นคำเตือนเท่านั้น)</div>
  ${[1, 2, 3, 4].map(c => `<div class="ckcat"><b>${c}. ${RULE_CATS[c]}</b></div>` + RULES.filter(r => r.cat === c).map(r0 => { const r = rule(r0.id); return `<div class="rb"><div class="s14"><b>${esc(r.n)}</b></div>
    <div class="row" style="gap:6px;flex-wrap:wrap">${r.text ? `<input class="in" data-rb="${r.id}" data-k="v" value="${esc(r.v ?? '')}" style="flex:2;min-width:150px">` : `<input class="in" type="number" inputmode="decimal" data-rb="${r.id}" data-k="v" value="${r.v ?? ''}" placeholder="ยังไม่กำหนด" style="width:110px"><span class="s13">${r.u || ''}</span>`}
    <input class="in" data-rb="${r.id}" data-k="ref" value="${esc(r.ref || '')}" placeholder="เอกสาร / เลขข้อที่อ้างอิง" style="flex:3;min-width:180px">
    <label class="s13 row" style="gap:4px;cursor:pointer"><input type="checkbox" data-rb="${r.id}" data-k="ok" ${r.ok ? 'checked' : ''}> ยืนยันแล้ว</label></div></div>`; }).join('')).join('')}
  <div class="row"><button class="btn p" onclick="saveRules()">บันทึกสมุดกฎ</button><button class="btn g" onclick="resetRules()">คืนค่าตั้งต้น</button></div></details>`;
}
window.saveRules = () => {
  const o = {}; $$('[data-rb]').forEach(el => { const id = el.dataset.rb, k = el.dataset.k, r0 = RULES.find(x => x.id === id); o[id] = o[id] || {};
    let v = el.type === 'checkbox' ? el.checked : el.value.trim(); if (k === 'v' && !r0.text) v = v === '' ? null : +v; o[id][k] = v; });
  S.cfg.rules = o; saveLocal('cfg'); toast('บันทึกสมุดกฎแล้ว');
};
window.resetRules = () => { if (!confirm('คืนค่าสมุดกฎเป็นค่าตั้งต้น?')) return; delete S.cfg.rules; saveLocal('cfg'); route(); };

/* ---------- 3) วาดแนวสาย ---------- */
const LINE = { pts: [], gap: +localStorage.getItem('ccs_linegap') || 40, size: localStorage.getItem('ccs_linesize') || '1000010012' };
function lineStartPole(job) { const a = LINE.pts[0]; return a && a.pid ? poleById(job, a.pid) : null; }
/* แบ่งแนว: มุมทุกจุดเป็นเสา ระหว่างมุมแบ่งเท่าๆ กันไม่เกินระยะที่เลือก */
/* ระยะช่วงที่ใช้จริง: ไม่เกินเกณฑ์ในสมุดกฎ (ถ้ากำหนดไว้) */
function lineGapEff() { const r = rule(mapState.kind === 'LV' ? 'spanLV' : 'spanHV'); return r.v ? Math.min(LINE.gap, +r.v) : LINE.gap; }
function linePlan() {
  const P = LINE.pts, out = []; if (P.length < 2) return { pts: P.slice(), len: 0, n: 0 };
  const gap = lineGapEff(); let len = 0; out.push(P[0]);
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], d = hav(a, b); len += d; const k = Math.max(1, Math.ceil(d / gap - 0.05));
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
  <div class="s13 muted">${LINE.pts.length < 2 ? `แตะจุดเริ่ม (แตะเสาเดิม/เสาในงานเพื่อต่อจากต้นนั้น) แล้วแตะตามแนวถนนทีละจุด · กากบาท + "เพิ่มจุด" ก็ได้` : `แนวยาว <b>${pl.len.toLocaleString('th-TH')}</b> ม.${lineGapEff() < LINE.gap ? ` · ใช้ช่วงไม่เกิน ${lineGapEff()} ม. ตามสมุดกฎ` : ''} · ปักเสาใหม่ <b>${pl.n}</b> ต้น · สาย ${mapState.kind === 'HV' ? 'แรงสูง' : 'แรงต่ำ'} · ใส่หัวเสาตามมุมให้เอง`}</div>
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
