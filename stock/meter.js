/* ระบบคลังพัสดุ กฟส.อ่าวลึก · โมดูลมิเตอร์
 * อ้างอิงระเบียบ กฟภ. ว่าด้วยวิธีปฏิบัติเกี่ยวกับมิเตอร์ พ.ศ. 2562 (หมวด 5, 6, 8)
 * สแกนเนอร์ (Deli แบบคีย์บอร์ด/บลูทูธ/2.4G) · เครื่องพิมพ์ฉลาก NIIMBOT B1/B1 Pro (Web Bluetooth)
 * แอปเป็นเครื่องมือช่วยงาน — การบันทึกจริงยังทำในระบบ SAP (MM/DM) ตามระเบียบ */
'use strict';

/* ================= ตั้งค่า / เครื่องมือ ================= */
const API_DEFAULT = 'https://script.google.com/macros/s/AKfycby536q10bjzfwQPQLrxbv-BXY33WNggpQi06VdRLniht_zUZjArNZ5V9fQIBKCY0dAHzw/exec';
const lsr = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
const API_URL = () => lsr('stock_api') || API_DEFAULT;
const cred = () => ({ user: lsr('pea_aoluek_username') || '', pass: lsr('pea_aoluek_password') || '' });
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, kind, ms) => { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (kind ? ' ' + kind : ''); t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', ms || 2800); };
const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const toD = s => { if (!s) return null; const d = new Date(String(s).length === 10 ? s + 'T00:00:00' : s); return isNaN(d) ? null : d; };
const thDate = s => { const d = toD(s); return d ? d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2) : '–'; };
const thDateTime = s => { const d = toD(s); return d ? thDate(s) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : '–'; };
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const daysTo = s => { const d = toD(s); if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 86400000); };
const addDays = (s, n) => { const d = toD(s); if (!d) return ''; d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const pad4 = v => { const t = String(v == null ? '' : v).trim(); return /^\d{1,4}$/.test(t) ? t.padStart(4, '0') : t; };

/* ================= กติกาตามระเบียบ ================= */
const ST = { FIELD: 'ถอดคืนแล้ว', WAIT: 'รอคัดแยก', GOOD: 'สภาพดี', WARR: 'ในประกัน', REP: 'ซ่อมได้', UNREP: 'ซ่อมไม่ได้', EVID: 'หลักฐานคดี', LOST: 'สูญหาย', USED: 'เบิกใช้แล้ว', SENT: 'ส่งออกแล้ว', SOLD: 'จำหน่ายแล้ว' };
const TERMINAL = [ST.USED, ST.SENT, ST.SOLD];
const IN_STORE = [ST.WAIT, ST.GOOD, ST.WARR, ST.REP, ST.UNREP, ST.EVID];
const TAGCLS = { [ST.FIELD]: 't-field', [ST.WAIT]: 't-wait', [ST.GOOD]: 't-good', [ST.WARR]: 't-warr', [ST.REP]: 't-rep', [ST.UNREP]: 't-unrep', [ST.EVID]: 't-evid', [ST.LOST]: 't-lost', [ST.USED]: 't-done', [ST.SENT]: 't-done', [ST.SOLD]: 't-done' };
const tag = s => `<span class="tag ${TAGCLS[s] || 't-field'}">${esc(s)}</span>`;
const JOBS = ['สับเปลี่ยนชำรุด', 'สับเปลี่ยนตามวาระ', 'ถอนคืน (เลิกใช้ไฟ)', 'ถอนคืน (งดจ่าย/ค้างชำระ)', 'ถอนคืน (ไม่มีการใช้ไฟ)', 'สูญหาย'];
const CAUSE_ACT = ['ใช้ไฟเกินพิกัด', 'ละเมิดการใช้ไฟฟ้า', 'ฝาครอบแก้วแตก (ไม่เกี่ยวคุณภาพ)', 'เพลิงไหม้ (วางเพลิง/การกระทำ)'];
const CAUSE_NON = ['คุณภาพมิเตอร์', 'ภัยธรรมชาติ', 'ฟ้าผ่า/แรงดันเกิน', 'ฝาครอบแก้วแตก (เกี่ยวคุณภาพ)', 'เสื่อมสภาพ/สนิม/หมดอายุ'];
const EVID_CAUSES = ['ละเมิดการใช้ไฟฟ้า', 'เพลิงไหม้ (วางเพลิง/การกระทำ)'];
const CAUSE_REF = {
  'ใช้ไฟเกินพิกัด': 'ข้อ 68.1.1 · คิดค่าใช้จ่าย (ข้อ 65) · หากต้องตัดตราตะกั่วเปิดฝาตรวจ ใช้กรรมการ 3 คน ลงหมายเหตุในแบบ มต.15 ป.62',
  'ละเมิดการใช้ไฟฟ้า': 'ข้อ 68.1.2 · เก็บเป็นหลักฐานจนคดีถึงที่สุด/ได้รับชดใช้ครบ จึงจำหน่ายได้',
  'ฝาครอบแก้วแตก (ไม่เกี่ยวคุณภาพ)': 'ข้อ 68.1.3 · รายงานผู้บังคับบัญชา หาผู้ชดใช้ (ไม่มีผู้ชดใช้ → แจ้งความ + หนังสือรับรอง)',
  'เพลิงไหม้ (วางเพลิง/การกระทำ)': 'ข้อ 68.1.4 · แจ้งความร้องทุกข์ · ตั้งกรรมการสอบหาข้อเท็จจริง',
  'คุณภาพมิเตอร์': 'ข้อ 68.2.1 · ไม่คิดค่าใช้จ่าย (ข้อ 66) · ตรวจประกันก่อนส่งเคลม',
  'ภัยธรรมชาติ': 'ข้อ 68.2.2 · ต้องมีภาพถ่ายมิเตอร์และสถานที่เกิดเหตุ · ตั้งกรรมการสอบหาข้อเท็จจริง',
  'ฟ้าผ่า/แรงดันเกิน': 'ข้อ 68.2.3 · ไม่คิดค่าใช้จ่าย (ข้อ 66) · หาก potential coil ขาด ให้ กฟฟ. วัดค่ากราวด์ (ข้อ 15)',
  'ฝาครอบแก้วแตก (เกี่ยวคุณภาพ)': 'ข้อ 68.2.4 · ไม่คิดค่าใช้จ่าย (ข้อ 66)',
  'เสื่อมสภาพ/สนิม/หมดอายุ': 'ข้อ 68.2.5 · ไม่คิดค่าใช้จ่าย (ข้อ 66)'
};
// อาการ: q = ลักษณะชำรุดเนื่องจากคุณภาพ (80.2.1), u = ลักษณะชำรุดซ่อมไม่ได้ (80.3.1)
const SYMPTOMS = [
  ['หมุนติดขัด หรือไม่หมุน', 'q'], ['หมุนขณะไม่มีโหลด', 'q'], ['มดหรือแมลงเข้าในตัวมิเตอร์', 'q'], ['ค่าความคลาดเคลื่อนเกินพิกัด/วัดไม่ถูกต้อง', 'q'],
  ['โปรแกรม/Firmware ทำงานผิดปกติ', 'q'], ['ดีมานด์ชำรุด', 'q'], ['สกรูภายในหรือ Nameplate หลุด หลวม', 'q'], ['ฝาครอบแก้วร้าว', 'q'],
  ['หน้าจอชำรุดหรือไม่แสดงค่า', 'q'], ['Battery ชำรุด', 'q'], ['Port สื่อสารชำรุด', 'q'], ['ฝาครอบเป็นฝ้า ขุ่น มัว', 'q'], ['เวลาในมิเตอร์คลาดเคลื่อน (AMR)', 'q'],
  ['Current coil ไหม้', 'u'], ['Potential coil ขาด', 'u'], ['ฝาครอบแก้วแตก', 'u'], ['มิเตอร์เพลิงไหม้', 'u'], ['คราบเขม่า/รอยอาร์คภายใน', 'u'],
  ['ที่ต่อสายชำรุด (ไหม้ แตกร้าว)', 'u'], ['น้ำเข้าตัวมิเตอร์', 'u'], ['เป็นสนิม', 'u'], ['ฝาครอบแก้วรุ่นฝาทึบ', 'u'], ['ไม่พบชำรุด (ถอนคืนปกติ)', '']
];
const SYM_TAG = Object.fromEntries(SYMPTOMS);
const KINDS = ['จานหมุน', 'อิเล็กทรอนิกส์', 'Smart meter', 'AMR'];
const PHASES = ['1 เฟส', '3 เฟส'];
const SIZES = ['5(15) A', '15(45) A', '30(100) A', '5(100) A', '5(45) A', '5(6) A (ประกอบ CT)', '3(6) A', '10(20) A', '10(30) A', '20(40) A'];
const OBSOLETE_SIZES = ['3(6) A', '10(20) A', '10(30) A', '20(40) A'];
const SAP = {
  '262': 'MIGO 262 รับคืนเข้าคลังย่อย Batch R (ข้อ 79.1)', '344': 'MIGO 344 ระงับใช้ Block Stock (ข้อ 80.1.1)', '343': 'MIGO 343 ปลด Block ก่อนส่งเคลม (ข้อ 80.2.3)',
  '349': 'MIGO 349 เปลี่ยนเป็น QI เสียซ่อมได้ (ข้อ 80.4.3)', 'ZARR020': 'จัดทำรายงาน ZARR020 แนบขออนุมัติจำหน่าย (ข้อ 80.3.3/80.4.3)',
  'ZMME024': 'ZMME024 ตัดจำหน่ายในระบบ MM (ข้อ 80.3.7/80.4.9)', '261': 'MIGO 261 เบิกใช้ Batch R อ้างอิงใบสั่งงาน (ข้อ 79.2)', '301': 'MIGO 301 โอนระหว่างที่จัดเก็บ'
};
function sapNeed(m) {
  const s = m.status, r = m.result;
  if (s === ST.FIELD) return [];
  if (s === ST.LOST) return ['262', '344'];
  if (s === ST.USED) return ['262', '261'];
  if (r === ST.GOOD) return ['262'];
  if (r === ST.WARR) return ['262', '344', '343'];
  if (r === ST.REP) return s === ST.SENT ? ['262', '344', '349', 'ZARR020', 'ZMME024'] : ['262', '344', '349', 'ZARR020'];
  if (r === ST.UNREP) return s === ST.SOLD ? ['262', '344', 'ZARR020', 'ZMME024'] : ['262', '344', 'ZARR020'];
  return ['262', '344'];
}
const SHIPK = {
  warranty: { label: 'เคลมประกัน (ส่ง กมต.)', box: 'ชำรุดเนื่องจากคุณภาพ', result: ST.WARR, dest: 'กมต. (กองมิเตอร์)', ref: 'ข้อ 80.2 · 84.1', due: null },
  repair: { label: 'ส่งแปรสภาพ (ซ่อมได้)', box: 'ชำรุดซ่อมได้', result: ST.REP, dest: 'ศูนย์ซ่อมและทดสอบมิเตอร์ภาคใต้', ref: 'ข้อ 80.4 · 84.2', due: 15 },
  sale: { label: 'จำหน่ายโดยวิธีขาย (ซ่อมไม่ได้)', box: 'ชำรุดซ่อมไม่ได้ หรือ เศษวัสดุรอขาย', result: ST.UNREP, dest: 'ผู้ซื้อตามอนุมัติจำหน่าย', ref: 'ข้อ 80.3 · 84.3', due: 60 }
};
const SHIP_STATUS = ['กำลังบรรจุ', 'รออนุมัติ', 'อนุมัติแล้ว', 'ส่งแล้ว', 'ยกเลิก'];

/** ระบบแนะนำผลคัดแยก (กรรมการเป็นผู้ตัดสิน) */
function suggest(m) {
  const why = [];
  const brand = String(m.brand || '').toLowerCase(), ph = String(m.phase || ''), kind = String(m.kind || '');
  if (m.job === 'สูญหาย' || EVID_CAUSES.includes(m.cause)) return { r: ST.EVID, why: ['สาเหตุ "' + (m.cause || m.job) + '" ต้องเก็บไว้เป็นหลักฐาน (ข้อ 68.1.2, 67)'] };
  const symTag = SYM_TAG[m.symptom];
  if (/^ถอนคืน/.test(m.job) && (!m.symptom || m.symptom === 'ไม่พบชำรุด (ถอนคืนปกติ)') && !m.cause) return { r: ST.GOOD, why: ['ถอนคืนโดยไม่มีอาการชำรุด → ตรวจสภาพแล้วนำกลับมาใช้ Batch R (ข้อ 79.2)'] };
  const wd = daysTo(m.warranty);
  if (wd != null && wd >= 0 && m.causeGroup !== 'กระทำ' && !['ภัยธรรมชาติ', 'ฟ้าผ่า/แรงดันเกิน'].includes(m.cause) && symTag === 'q')
    return { r: ST.WARR, why: ['ยังอยู่ในประกัน (เหลือ ' + wd + ' วัน) และอาการเข้าลักษณะชำรุดเนื่องจากคุณภาพ (ข้อ 80.2.1)', 'ต้องแจ้งผู้ผลิตก่อนวันสิ้นสุดประกัน'] };
  if (wd != null && wd >= 0) why.push('ยังอยู่ในประกัน แต่สาเหตุ/อาการไม่เข้าเงื่อนไขรับประกัน');
  if (m.job === 'สับเปลี่ยนตามวาระ') why.push('รื้อถอนจากการสับเปลี่ยนตามวาระ (80.3.1 (1.3))');
  if (ph === '1 เฟส' && brand && !/mahajak|มหาจักร|holley/.test(brand)) why.push('1 เฟส ยี่ห้อนี้ไม่ใช่ Mahajak/Holley (80.3.1 (1.1))');
  if (ph === '3 เฟส' && brand && !/mitsubishi|มิตซู/.test(brand)) why.push('3 เฟส ยี่ห้อนี้ไม่ใช่ Mitsubishi (80.3.1 (1.2))');
  if (/อิเล็ก|Smart|AMR/i.test(kind)) why.push('มิเตอร์อิเล็กทรอนิกส์/AMR (80.3.1)');
  if (symTag === 'u') why.push('อาการ "' + m.symptom + '" อยู่ในลักษณะซ่อมไม่ได้ (80.3.1 (1.4))');
  if (OBSOLETE_SIZES.includes(m.size)) why.push('ขนาดที่กำหนดให้เลิกใช้งาน (80.3.1)');
  if (why.length && why.some(w => /80\.3\.1/.test(w))) return { r: ST.UNREP, why };
  if (!brand || !ph) return { r: '', why: ['กรอกยี่ห้อและเฟสก่อน ระบบจึงแนะนำได้ (ข้อ 80.3.1 แยกตามยี่ห้อ)'] };
  return { r: ST.REP, why: why.concat(['ไม่เข้าลักษณะซ่อมไม่ได้ตามข้อ 80.3.1 → ซ่อมได้ (ข้อ 80.4.1)']) };
}

/* ================= สถานะแอป ================= */
let DB = { me: { name: cred().user, admin: false }, slocs: [], settings: {}, meters: [], ships: [], round: null, scans: [], zdmr: [], mb52: [] };
let MAP = {};
const UI = { tab: 'home', intake: 'field', sortSel: null, sortFilter: ST.WAIT, countSloc: lsr('mt_count_sloc') || '1201', shipSel: null, recvSloc: lsr('mt_recv_sloc') || '', recv262: false, recvLog: [], countLog: [] };

async function api(action, payload) {
  const c = cred();
  if (!c.user) { const e = new Error('ยังไม่ได้เข้าสู่ระบบศูนย์รวมงาน'); e.code = 'unauthorized'; throw e; }
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 90000);
  let j;
  try {
    const r = await fetch(API_URL(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, user: c.user, pass: c.pass }, payload || {})), signal: ctrl.signal });
    j = await r.json();
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง' : 'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
  finally { clearTimeout(t); }
  if (!j || !j.ok) { const e = new Error((j && (j.message || j.error)) || 'ไม่ทราบสาเหตุ'); e.code = j && j.error; throw e; }
  return j;
}
const jv = (v, d) => { if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
function setMeter(m) { if (!m) return; m.sap = jv(m.sap, {}); m.photos = jv(m.photos, []); m.sloc = pad4(m.sloc); const i = DB.meters.findIndex(x => x.pea === m.pea); if (i >= 0) DB.meters[i] = m; else DB.meters.push(m); MAP[m.pea] = m; badges(); }
async function load(quiet) {
  if (!quiet) $('#sub').textContent = 'กำลังโหลด…';
  try {
    const j = await api('meterBoot');
    DB = j; DB.slocs = (DB.slocs || []).map(s => ({ code: pad4(s.code), name: s.name }));
    DB.meters.forEach(m => { m.sloc = pad4(m.sloc); m.sap = m.sap || {}; m.photos = m.photos || []; });
    DB.zdmr = (DB.zdmr || []).map(r => { r[3] = pad4(r[3]); return r; });
    DB.mb52 = (DB.mb52 || []).map(r => { r[0] = pad4(r[0]); return r; });
    MAP = {}; DB.meters.forEach(m => MAP[m.pea] = m);
    if (!UI.recvSloc) UI.recvSloc = pad4((DB.settings && DB.settings.defaultSloc) || '1201');
    $('#sub').textContent = (DB.me.name || '') + ' · ในคลัง ' + DB.meters.filter(m => IN_STORE.includes(m.status)).length + ' เครื่อง';
    badges(); render();
  } catch (e) {
    $('#sub').textContent = 'โหลดไม่สำเร็จ';
    $('#view').innerHTML = `<div class="empty"><p>${esc(e.message)}</p><button class="btn p" onclick="load()">ลองใหม่</button></div>`;
  }
}
function badges() {
  const f = DB.meters.filter(m => m.status === ST.FIELD).length, w = DB.meters.filter(m => m.status === ST.WAIT).length;
  const bi = $('#bdIn'), bs = $('#bdSort');
  bi.hidden = !f; bi.textContent = f; bs.hidden = !w; bs.textContent = w;
}
const slocName = c => { const s = (DB.slocs || []).find(x => x.code === pad4(c)); return s ? s.name : c; };
const slocOpts = sel => (DB.slocs || []).map(s => `<option value="${s.code}"${s.code === pad4(sel) ? ' selected' : ''}>${s.code} · ${esc(s.name)}</option>`).join('');
const owner = () => (DB.settings && DB.settings.owner) || 'กฟส.อ่าวลึก';
const zdmrMap = () => { if (!zdmrMap._c || zdmrMap._n !== DB.zdmr) { zdmrMap._c = {}; DB.zdmr.forEach(r => zdmrMap._c[r[0]] = r); zdmrMap._n = DB.zdmr; } return zdmrMap._c; };

/* ================= สแกนเนอร์ (คีย์บอร์ด HID) ================= */
// เครื่องสแกนพิมพ์เร็ว + Enter · ถ้าแป้นพิมพ์เป็นภาษาไทย ตัวอักษรจะกลายเป็นไทย → แปลงกลับเป็นปุ่มภาษาอังกฤษ (เกษมณี)
const TH_KEYS = 'ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฃฟหกดเ้่าสวงผปแอิืทมใฝ+๑๒๓๔ู฿๕๖๗๘๙๐"ฎฑธํ๊ณฯญฐ,ฅฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ';
const EN_KEYS = '1234567890-=qwertyuiop[]\\asdfghjkl;\'zxcvbnm,./!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>?';
const TH2EN = {}; [...TH_KEYS].forEach((c, i) => { if (!(c in TH2EN)) TH2EN[c] = EN_KEYS[i]; });
function fixScan(s) {
  s = String(s || '').trim();
  if (/[฀-๿]/.test(s)) s = [...s].map(c => TH2EN[c] || c).join('');
  return s;
}
const peaOf = s => { const t = fixScan(s).toUpperCase().replace(/[\s\-–]/g, ''); return /^[A-Z0-9]{4,20}$/.test(t) ? t : ''; };
const SCAN = { buf: '', t0: 0, last: 0, gaps: [] };
let SCAN_HANDLER = null;   // ฟังก์ชันของหน้าปัจจุบันที่รับผลสแกน
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const now = performance.now();
  if (e.key === 'Enter') {
    const fast = SCAN.buf.length >= 4 && SCAN.gaps.length && (SCAN.gaps.reduce((a, b) => a + b, 0) / SCAN.gaps.length) < 45;
    const code = SCAN.buf; SCAN.buf = ''; SCAN.gaps = [];
    const el = document.activeElement, isScanInput = el && el.dataset && el.dataset.scan !== undefined;
    if (isScanInput) return;   // ช่องสแกนจัดการเองด้วย onkeydown
    if (fast) {
      e.preventDefault();
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value.endsWith(code)) el.value = el.value.slice(0, -code.length);
      onScan(code);
    }
    return;
  }
  if (e.key.length !== 1) return;
  if (now - SCAN.last > 120) { SCAN.buf = ''; SCAN.gaps = []; } else SCAN.gaps.push(now - SCAN.last);
  SCAN.buf += e.key; SCAN.last = now;
}, true);
function onScan(raw) {
  const code = fixScan(raw);
  if (!code) return;
  if ($('#dim').classList.contains('show') && SHEET_SCAN) { SHEET_SCAN(code); return; }
  if (SCAN_HANDLER) { SCAN_HANDLER(code); return; }
  const pea = peaOf(code);
  if (pea) openMeter(pea);
}
let SHEET_SCAN = null;
/** ช่องสแกน: พิมพ์/สแกนแล้ว Enter · มีปุ่มกล้อง (มือถือ Android/Chrome) */
function scanBox(id, ph) {
  return `<div class="scanbox"><svg class="ic" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M7 8v8M11 8v8M15 8v8"/></svg>
    <input id="${id}" data-scan autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" placeholder="${esc(ph || 'สแกน หรือพิมพ์ PEA No.')}" aria-label="${esc(ph || 'PEA No.')}">
    ${'BarcodeDetector' in window ? `<button class="btn sm" type="button" data-cam="${id}" aria-label="สแกนด้วยกล้อง"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg></button>` : ''}</div><div id="${id}_cam"></div>`;
}
function bindScan(id, fn) {
  const el = document.getElementById(id); if (!el) return;
  el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = el.value; el.value = ''; if (v.trim()) fn(fixScan(v)); } };
  const cb = document.querySelector(`[data-cam="${id}"]`);
  if (cb) cb.onclick = () => camScan(document.getElementById(id + '_cam'), fn);
}
let CAM = null;
async function camScan(holder, fn) {
  if (CAM) { stopCam(); return; }
  try {
    const det = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'data_matrix', 'codabar'] });
    const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    holder.innerHTML = `<div class="cam"><video playsinline muted></video><div class="fr"></div></div><button class="btn blk" style="margin-top:6px" type="button" id="camStop">ปิดกล้อง</button>`;
    const v = holder.querySelector('video'); v.srcObject = st; await v.play();
    CAM = { st, holder, alive: true };
    $('#camStop').onclick = stopCam;
    let lastCode = '', lastAt = 0;
    const tick = async () => {
      if (!CAM || !CAM.alive) return;
      try { const r = await det.detect(v); if (r.length) { const c = r[0].rawValue; if (c !== lastCode || Date.now() - lastAt > 2500) { lastCode = c; lastAt = Date.now(); if (navigator.vibrate) navigator.vibrate(60); fn(fixScan(c)); } } } catch (e) { }
      setTimeout(tick, 250);
    };
    tick();
  } catch (e) { toast('เปิดกล้องไม่ได้: ' + (e.message || e), 'err'); stopCam(); }
}
function stopCam() { if (!CAM) return; CAM.alive = false; CAM.st.getTracks().forEach(t => t.stop()); if (CAM.holder) CAM.holder.innerHTML = ''; CAM = null; }

/* ================= ฉลาก (Canvas) ================= */
const LBL = { w: 576, h: 354 };   // ปรับตามเครื่องพิมพ์ที่เชื่อม (B1 = 384×240, B1 Pro = 576×354)
const FONT = "'IBM Plex Sans Thai'";
function lcanvas() { const c = document.createElement('canvas'); c.width = LBL.w; c.height = LBL.h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000'; x.strokeStyle = '#000'; x.textBaseline = 'top'; return [c, x, c.width / 384]; }
function txt(x, s, px, py, size, weight, maxW, align) {
  let f = size; x.font = `${weight || 600} ${f}px ${FONT}`;
  while (maxW && x.measureText(s).width > maxW && f > 8) { f -= 1; x.font = `${weight || 600} ${f}px ${FONT}`; }
  x.textAlign = align || 'left'; x.fillText(s, px, py); x.textAlign = 'left'; return f;
}
function qrDraw(x, text, px, py, size) {
  const q = qrcode(0, 'M'); q.addData(String(text)); q.make();
  const n = q.getModuleCount(), cell = Math.max(1, Math.floor(size / (n + 4))), off = Math.floor((size - cell * n) / 2);   // เผื่อขอบเงียบ 2 โมดูล
  const X = Math.round(px + off), Y = Math.round(py + off);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect(X + c * cell, Y + r * cell, cell, cell);
}
// Code 128-B
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
function c128(x, text, px, py, w, h) {
  const codes = [104]; [...String(text)].forEach(ch => { const v = ch.charCodeAt(0) - 32; if (v >= 0 && v < 95) codes.push(v); });
  let sum = 104; codes.slice(1).forEach((v, i) => sum += v * (i + 1)); codes.push(sum % 103); codes.push(106);
  const pat = codes.map(v => C128[v]).join('');
  const mods = [...pat].reduce((a, d) => a + Number(d), 0) + 20;
  const m = Math.max(1, Math.floor(w / mods)); let cx = Math.round(px + Math.floor((w - m * mods) / 2) + 10 * m); py = Math.round(py); h = Math.round(h);
  [...pat].forEach((d, i) => { const ww = Number(d) * m; if (i % 2 === 0) x.fillRect(cx, py, ww, h); cx += ww; });
}
/** A: ฉลากติดฝาครอบมิเตอร์ (ข้อ 80.2.5 — ระบุการไฟฟ้าเจ้าของทรัพย์สิน + เลขที่บันทึกอนุมัตินำส่ง) */
function labelMeter(m, memo) {
  if (m.status === ST.EVID || m.status === ST.LOST || (m.result === ST.EVID)) return labelEvid(m);
  const [c, x, s] = lcanvas(), W = c.width, H = c.height, pad = 10 * s;
  const qs = Math.min(H - 2 * pad, 146 * s);
  qrDraw(x, m.pea, pad, (H - qs) / 2, qs);
  const lx = pad + qs + 10 * s, mw = W - lx - pad;
  x.fillRect(lx, pad, Math.min(mw, 140 * s), 24 * s); x.fillStyle = '#fff'; txt(x, owner(), lx + 6 * s, pad + 2 * s, 17 * s, 700, Math.min(mw, 140 * s) - 12 * s); x.fillStyle = '#000';
  const st = m.result || m.status;
  txt(x, st === ST.FIELD || st === ST.WAIT ? 'รอคัดแยก' : st, lx + mw, pad + 3 * s, 15 * s, 700, mw - 148 * s, 'right');
  txt(x, m.pea, lx, pad + 30 * s, 30 * s, 700, mw);
  let y = pad + 66 * s; const ln = (t, sz, wt) => { txt(x, t, lx, y, sz * s, wt || 500, mw); y += (sz + 5) * s; };
  ln([m.phase, m.size, m.brand].filter(Boolean).join(' · ') || ' ', 14);
  ln('ใบสั่งงาน ' + (m.wo || '–'), 14);
  ln((m.cause || m.symptom || m.job || '').slice(0, 40), 14, 600);
  ln('ถอด ' + thDate(m.removedAt) + ' · ' + (m.removedBy || ''), 13);
  x.fillRect(lx, H - pad - 26 * s, mw, 1.5 * s);
  txt(x, 'บันทึกนำส่งเลขที่ ' + (memo || '......................'), lx, H - pad - 21 * s, 14 * s, 600, mw);
  return c;
}
/** C: หลักฐานคดี (ข้อ 68.1.2, 67) */
function labelEvid(m) {
  const [c, x, s] = lcanvas(), W = c.width, H = c.height, pad = 10 * s;
  x.fillRect(pad, pad, W - 2 * pad, 46 * s); x.fillStyle = '#fff'; txt(x, 'หลักฐานคดี · ห้ามจำหน่าย', W / 2, pad + 8 * s, 26 * s, 700, W - 4 * pad, 'center'); x.fillStyle = '#000';
  const qs = H - pad * 2 - 56 * s; qrDraw(x, m.pea, pad, pad + 54 * s, qs);
  const lx = pad + qs + 10 * s, mw = W - lx - pad; let y = pad + 58 * s;
  txt(x, m.pea, lx, y, 28 * s, 700, mw); y += 36 * s;
  txt(x, (m.cause || m.job || '').slice(0, 36), lx, y, 15 * s, 600, mw); y += 21 * s;
  txt(x, 'ใบแจ้งความ ' + (m.police || '–'), lx, y, 14 * s, 500, mw); y += 20 * s;
  txt(x, owner() + ' · ถอด ' + thDate(m.removedAt), lx, y, 13 * s, 500, mw); y += 19 * s;
  txt(x, 'จำหน่ายได้เมื่อคดีถึงที่สุด/ชดใช้ครบ', lx, y, 12 * s, 500, mw);
  return c;
}
/** B: ข้างลัง (ข้อ 84 — ชื่อ กฟฟ. หมายเลขลัง n/N และข้อความตามผลคัดแยก) */
function labelBox(sh, i) {
  const K = SHIPK[sh.kind], [c, x, s] = lcanvas(), W = c.width, H = c.height, pad = 10 * s;
  txt(x, owner(), pad, pad, 24 * s, 700, W * 0.55);
  txt(x, 'ลัง ' + i + '/' + sh.boxes, W - pad, pad - 2 * s, 34 * s, 700, W * 0.4, 'right');
  x.lineWidth = 4 * s; x.strokeRect(pad, pad + 44 * s, W - 2 * pad, 72 * s);
  const big = K.box; const two = big.length > 22;
  if (two) { const p = big.split(' หรือ '); txt(x, p[0], W / 2, pad + 51 * s, 22 * s, 700, W - 4 * pad, 'center'); txt(x, 'หรือ ' + (p[1] || ''), W / 2, pad + 81 * s, 20 * s, 700, W - 4 * pad, 'center'); }
  else txt(x, big, W / 2, pad + 60 * s, 30 * s, 700, W - 4 * pad, 'center');
  const n = (sh.items || []).filter(it => Number(it[1]) === i).length;
  let y = pad + 124 * s;
  txt(x, 'บรรจุ ' + n + ' เครื่อง · ' + (sh.dest || K.dest), pad, y, 15 * s, 600, W - 2 * pad - 90 * s); y += 22 * s;
  txt(x, 'บันทึกนำส่ง ' + (sh.memo || '.................') + (sh.approvalNo ? ' · อนุมัติ ' + sh.approvalNo : ''), pad, y, 14 * s, 500, W - 2 * pad - 90 * s); y += 21 * s;
  txt(x, 'ชุด ' + sh.id + ' · ' + thDate(sh.at), pad, y, 12 * s, 500, W - 2 * pad - 90 * s);
  qrDraw(x, sh.id + '#' + i, W - pad - 84 * s, H - pad - 84 * s, 84 * s);
  return c;
}
/** D: ป้ายชั้นวาง/รหัสพัสดุ (ข้อ 74) */
function labelShelf(o) {
  const [c, x, s] = lcanvas(), W = c.width, H = c.height, pad = 10 * s;
  x.fillRect(pad, pad, 110 * s, 24 * s); x.fillStyle = '#fff'; txt(x, 'SLoc ' + o.sloc, pad + 6 * s, pad + 2 * s, 17 * s, 700, 98 * s); x.fillStyle = '#000';
  txt(x, o.shelf ? 'ชั้น ' + o.shelf : '', W - pad, pad + 2 * s, 17 * s, 600, 150 * s, 'right');
  txt(x, o.name || '', pad, pad + 32 * s, 20 * s, 700, W - 2 * pad);
  txt(x, (o.desc || '').slice(0, 60), pad, pad + 58 * s, 13 * s, 500, W - 2 * pad);
  c128(x, o.code, pad, pad + 80 * s, W - 2 * pad, 98 * s);
  txt(x, o.code, W / 2, pad + 184 * s, 18 * s, 600, W - 2 * pad, 'center');
  return c;
}

/* ================= เครื่องพิมพ์ NIIMBOT ================= */
const PMODELS = {
  4096: { model: { label: 'Niimbot B1', id: 4096, dpi: 203, task: 'b1', density: 3, label_type: 1, speed: 1, name_prefixes: ['B1'] }, size: { w_px: 384, h_px: 240, offset_y_px: 4, dpi: 203 } },
  4097: { model: { label: 'Niimbot B1 Pro', id: 4097, dpi: 300, task: 'v4', density: 3, label_type: 1, speed: 1, name_prefixes: ['B1'] }, size: { w_px: 576, h_px: 354, dpi: 300 } }
};
const PRN = { id: Number(lsr('mt_prn_model')) || 0, density: Number(lsr('mt_prn_density')) || 3, busy: false };
function applyPrnSize() { const p = PMODELS[PRN.id]; LBL.w = p ? p.size.w_px : 576; LBL.h = p ? p.size.h_px : 354; }
applyPrnSize();
function prnDot() { const on = !!(window.Niimbot && Niimbot.printer); $('#prnDot').classList.toggle('on', on); }
const canBT = () => !!(window.Niimbot && Niimbot.isSupported && Niimbot.isSupported());
/** พิมพ์ฉลาก: makeFn(): HTMLCanvasElement[] (เรียกหลังรู้ขนาดเครื่องพิมพ์) */
async function printLabels(makeFn, title) {
  if (!canBT()) { showLabelImages(makeFn, title, 'nobt'); return; }
  if (PRN.busy) { toast('กำลังพิมพ์อยู่ รอสักครู่'); return; }
  PRN.busy = true;
  try {
    if (!Niimbot.printer) {
      toast('เลือกเครื่องพิมพ์ B1 ในหน้าต่างบลูทูธ', '', 4000);
      const guess = PMODELS[PRN.id] || PMODELS[4096];
      await Niimbot.identify(guess.model);
    }
    const id = Niimbot.printer && Niimbot.printer.modelId;
    if (!PMODELS[id]) throw new Error('เครื่องพิมพ์รุ่นนี้ (model id ' + id + ') ยังไม่รองรับ — รองรับ B1 และ B1 Pro');
    if (PRN.id !== id) { PRN.id = id; lsr('mt_prn_model', String(id)); applyPrnSize(); }
    prnDot();
    const cv = makeFn();
    const urls = cv.map(c => c.toDataURL('image/png'));
    const P = PMODELS[id];
    toast('กำลังพิมพ์ ' + urls.length + ' ดวง…', '', 6000);
    if (urls.length === 1) await Niimbot.printImage(urls[0], { model: P.model, size: P.size, density: PRN.density });
    else await Niimbot.printBatch(urls, { model: P.model, size: P.size, density: PRN.density });
    toast('พิมพ์เสร็จ ' + urls.length + ' ดวง', 'ok');
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/cancel|chooser|User cancelled|NotFoundError/i.test(msg)) toast('ยกเลิกการเลือกเครื่องพิมพ์');
    else { toast('พิมพ์ไม่สำเร็จ: ' + msg.slice(0, 120), 'err', 6000); showLabelImages(makeFn, title, 'err'); }
  } finally { PRN.busy = false; prnDot(); }
}
/** หลังบันทึก (ไม่มี user gesture): ถ้าเชื่อมเครื่องพิมพ์อยู่แล้วพิมพ์เลย ไม่งั้นเปิดหน้าพรีวิวให้กดพิมพ์ */
function printLater(makeFn, title) {
  if (canBT() && Niimbot.printer) { printLabels(makeFn, title); return; }
  if (!canBT()) { showLabelImages(makeFn, title, 'nobt'); return; }
  const cv = makeFn();
  sheet(`<button class="btn sm x" onclick="closeSheet()">ข้าม</button><h2>${esc(title || 'ฉลาก')}</h2><div class="labs" id="labPrev"></div>
    <button class="btn p blk" style="margin-top:12px" id="labGo">พิมพ์ฉลาก (${cv.length})</button>`);
  cv.forEach(c => $('#labPrev').appendChild(c));
  $('#labGo').onclick = () => { closeSheet(); printLabels(makeFn, title); };
}
/** ทางสำรอง: แสดงรูปฉลากให้บันทึก/แชร์เข้าแอป NIIMBOT (iPhone ไม่มี Web Bluetooth) */
function showLabelImages(makeFn, title, why) {
  const cv = makeFn();
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>${esc(title || 'ฉลาก')}</h2>
    ${why === 'nobt' ? `<div class="note b" style="margin-bottom:12px">เบราว์เซอร์นี้สั่งเครื่องพิมพ์ทางบลูทูธไม่ได้ (iPhone/Safari) เลือกได้ 2 ทาง:<br>1) กด <b>แชร์</b> แล้วเลือกแอป <b>NIIMBOT</b> เพื่อพิมพ์รูปฉลาก (ขนาด 50×30 มม.)<br>2) เปิดหน้านี้ในแอป <b>Bluefy</b> (ฟรี) จะสั่งพิมพ์ตรงได้เหมือน Android</div>` : `<div class="note" style="margin-bottom:12px">สั่งพิมพ์ทางบลูทูธไม่สำเร็จ ใช้รูปด้านล่างพิมพ์ผ่านแอป NIIMBOT แทนได้</div>`}
    <div class="labs" id="labImgs"></div>
    <div class="row" style="margin-top:12px"><button class="btn p grow" id="shareLab">แชร์ / บันทึกรูป (${cv.length})</button></div>`);
  const box = $('#labImgs'); cv.forEach(c => box.appendChild(c));
  $('#shareLab').onclick = async () => {
    const files = await Promise.all(cv.map((c, i) => new Promise(r => c.toBlob(b => r(new File([b], 'label_' + (i + 1) + '.png', { type: 'image/png' })), 'image/png'))));
    try {
      if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, title: title || 'ฉลาก' }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    files.forEach(f => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
  };
}
function printerSheet() {
  const p = window.Niimbot && Niimbot.printer;
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>เครื่องพิมพ์ฉลาก NIIMBOT</h2>
    <div class="kv"><span>สถานะ</span><span>${p ? '<span class="tag t-good">เชื่อมแล้ว</span> ' + esc((PMODELS[p.modelId] || {}).model ? PMODELS[p.modelId].model.label : 'model ' + p.modelId) : '<span class="tag t-field">ยังไม่เชื่อม</span>'}</span></div>
    <div class="kv"><span>ขนาดฉลาก</span><span>50 × 30 มม. (${LBL.w}×${LBL.h} px)</span></div>
    <div class="kv"><span>สั่งพิมพ์ทางบลูทูธ</span><span>${canBT() ? 'ได้ (Chrome/Edge)' : 'ไม่ได้ในเบราว์เซอร์นี้ → ใช้แชร์รูปเข้าแอป NIIMBOT หรือแอป Bluefy'}</span></div>
    <label class="lab" for="den">ความเข้มการพิมพ์ (1–5)</label>
    <div class="chips" id="den">${[1, 2, 3, 4, 5].map(n => `<button class="chip${PRN.density === n ? ' on' : ''}" data-d="${n}">${n}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px">
      ${canBT() ? `<button class="btn p grow" id="pConn">${p ? 'เชื่อมใหม่' : 'เชื่อมเครื่องพิมพ์'}</button>` : ''}
      <button class="btn grow" id="pTest">พิมพ์ทดสอบ</button>
      <button class="btn grow" id="pShelf">พิมพ์ป้ายชั้นวาง</button>
    </div>
    <p class="hint">ใช้ม้วนฉลาก 50×30 มม. · ฉลากความร้อนซีดเมื่อโดนแดด ใช้กับของที่เก็บในคลังทึบ (ข้อ 74) · ติดบนฝาครอบ ไม่ทับ nameplate/PEA No./ตราตะกั่ว</p>`);
  $$('#den .chip').forEach(b => b.onclick = () => { PRN.density = Number(b.dataset.d); lsr('mt_prn_density', String(PRN.density)); $$('#den .chip').forEach(x => x.classList.toggle('on', x === b)); });
  if ($('#pConn')) $('#pConn').onclick = async () => {
    try { if (Niimbot.printer) await Niimbot.disconnect(); await Niimbot.identify((PMODELS[PRN.id] || PMODELS[4096]).model); const id = Niimbot.printer.modelId; if (PMODELS[id]) { PRN.id = id; lsr('mt_prn_model', String(id)); applyPrnSize(); } prnDot(); toast('เชื่อมแล้ว: ' + (PMODELS[id] ? PMODELS[id].model.label : id), 'ok'); printerSheet(); }
    catch (e) { toast('เชื่อมไม่สำเร็จ: ' + (e.message || e), 'err'); }
  };
  $('#pTest').onclick = () => printLabels(() => [labelMeter({ pea: 'TEST12345', status: ST.WAIT, phase: '1 เฟส', size: '5(15) A', brand: 'ทดสอบ', wo: '123456789', cause: 'ทดสอบการพิมพ์', removedAt: todayStr(), removedBy: DB.me.name })], 'ฉลากทดสอบ');
  $('#pShelf').onclick = shelfSheet;
}
function shelfSheet() {
  const mats = {}; DB.mb52.forEach(r => { mats[r[1]] = mats[r[1]] || { code: r[1], desc: r[2], slocs: new Set() }; mats[r[1]].slocs.add(r[0]); });
  const list = Object.values(mats).sort((a, b) => a.code.localeCompare(b.code));
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>พิมพ์ป้ายชั้นวาง</h2>
    <p class="muted" style="margin-top:0">บาร์โค้ด Code 128 = รหัสพัสดุ ใช้สแกนตอนตรวจนับ (ข้อ 74 จัดเก็บเป็นหมวดหมู่)</p>
    <label class="lab" for="shSloc">คลังย่อย</label><select class="inp" id="shSloc">${slocOpts(UI.countSloc)}</select>
    <div class="g2"><div><label class="lab" for="shCode">รหัสพัสดุ</label><input class="inp mono" id="shCode" list="shMats" placeholder="1-06-xxx-xxxx"><datalist id="shMats">${list.map(m => `<option value="${m.code}">${esc(m.desc)}</option>`).join('')}</datalist></div>
    <div><label class="lab" for="shShelf">ตำแหน่ง/ชั้น</label><input class="inp" id="shShelf" placeholder="เช่น A-03"></div></div>
    <label class="lab" for="shName">ชื่อที่แสดง</label><input class="inp" id="shName" placeholder="เช่น มิเตอร์ 1 เฟส 5(15) A">
    <div class="row" style="margin-top:14px"><button class="btn p grow" id="shGo">พิมพ์</button></div>`);
  $('#shCode').oninput = () => { const m = mats[$('#shCode').value.trim()]; if (m && !$('#shName').value) $('#shName').value = m.desc.slice(0, 40); };
  $('#shGo').onclick = () => {
    const code = $('#shCode').value.trim(); if (!code) { toast('กรอกรหัสพัสดุ', 'err'); return; }
    const m = mats[code] || {};
    printLabels(() => [labelShelf({ sloc: $('#shSloc').value, code, name: $('#shName').value.trim() || m.desc || code, desc: m.desc || '', shelf: $('#shShelf').value.trim() })], 'ป้ายชั้นวาง');
  };
}

/* ================= แผ่นล่าง (sheet) ================= */
function sheet(h, onScanFn) { $('#sheet').innerHTML = h; $('#dim').classList.add('show'); $('#sheet').scrollTop = 0; SHEET_SCAN = onScanFn || null; }
function closeSheet() { $('#dim').classList.remove('show'); SHEET_SCAN = null; stopCam(); }
$('#dim').onclick = e => { if (e.target.id === 'dim') closeSheet(); };
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ================= รายละเอียดมิเตอร์ ================= */
async function openMeter(pea) {
  pea = peaOf(pea); if (!pea) return;
  const local = MAP[pea];
  sheet(`<div class="empty"><span class="spin d"></span><br>กำลังโหลด ${esc(pea)}…</div>`);
  try {
    const j = await api('meterGet', { pea });
    if (!j.meter) { meterMissing(pea, j.zdmr); return; }
    setMeter(j.meter); meterSheet(j.meter, j.log || [], j.zdmr);
  } catch (e) { if (local) meterSheet(local, [], null); else sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><p>${esc(e.message)}</p>`); }
}
function meterMissing(pea, z) {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2 class="mono">${esc(pea)}</h2>
    <div class="note" style="margin-bottom:12px">ยังไม่มีในระบบมิเตอร์${z ? '' : ' และไม่พบในรายงาน ZDMR101 ที่นำเข้า'}</div>
    ${z ? `<div class="kv"><span>ZDMR101</span><span>${esc(z.desc || z.mat)} · คลัง ${esc(z.sloc)} · ${esc(z.batch)} ${esc(z.status)}</span></div>` : ''}
    <button class="btn p blk" style="margin-top:12px" id="goIntake">บันทึกถอดคืนมิเตอร์นี้</button>`);
  $('#goIntake').onclick = () => { closeSheet(); UI.intake = 'field'; UI.prefill = pea; go('intake'); };
}
function meterSheet(m, log, z) {
  const need = sapNeed(m), sug = IN_STORE.includes(m.status) && m.status !== ST.EVID ? suggest(m) : null;
  const ship = m.ship ? DB.ships.find(s => s.id === m.ship) : null;
  const wd = daysTo(m.warranty);
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button>
    <h2><span class="mono">${esc(m.pea)}</span> ${tag(m.status)}</h2>
    ${m.status === ST.EVID ? `<div class="note k" style="margin-bottom:10px">หลักฐานคดี — เก็บไว้จนคดีถึงที่สุด/ได้รับชดใช้ครบ ห้ามคัดแยกไปจำหน่าย (ข้อ 68.1.2)</div>` : ''}
    ${wd != null && wd >= 0 && wd <= ((DB.settings && DB.settings.warnDays) || 30) && !TERMINAL.includes(m.status) ? `<div class="note" style="margin-bottom:10px">ประกันเหลือ ${wd} วัน — ต้องแจ้งผู้ผลิตก่อนวันสิ้นสุดประกัน (ข้อ 80.2.2)</div>` : ''}
    <div class="kv"><span>คลังย่อย</span><span>${esc(m.sloc)} · ${esc(slocName(m.sloc))}</span></div>
    <div class="kv"><span>ประเภทงาน</span><span>${esc(m.job)}</span></div>
    <div class="kv"><span>ใบสั่งงาน</span><span class="mono">${esc(m.wo || '–')}</span></div>
    ${m.ca ? `<div class="kv"><span>หมายเลขผู้ใช้ไฟ</span><span class="mono">${esc(m.ca)}</span></div>` : ''}
    <div class="kv"><span>สาเหตุ</span><span>${esc(m.cause || '–')}${m.causeGroup ? ` <span class="muted">(${m.causeGroup === 'กระทำ' ? 'เกิดจากการกระทำ' : 'ไม่เกิดจากการกระทำ'})</span>` : ''}</span></div>
    <div class="kv"><span>อาการ</span><span>${esc(m.symptom || '–')}</span></div>
    <div class="kv"><span>มิเตอร์</span><span>${esc([m.brand, m.kind, m.phase, m.size].filter(Boolean).join(' · ') || '–')}</span></div>
    ${m.mat ? `<div class="kv"><span>รหัสพัสดุ</span><span class="mono">${esc(m.mat)}</span></div>` : ''}
    <div class="kv"><span>หน่วยสุดท้าย</span><span>${esc(m.lastUnit || '–')}</span></div>
    <div class="kv"><span>ประกันถึง</span><span>${m.warranty ? thDate(m.warranty) + (wd != null ? (wd >= 0 ? ' (เหลือ ' + wd + ' วัน)' : ' (หมดแล้ว)') : '') : '–'}</span></div>
    <div class="kv"><span>ถอดเมื่อ/โดย</span><span>${thDate(m.removedAt)} · ${esc(m.removedBy)}</span></div>
    ${m.result ? `<div class="kv"><span>ผลคัดแยก</span><span>${tag(m.result)} ${thDate(m.sortedAt)} · ${esc(m.sortedBy)}</span></div>` : ''}
    ${m.police ? `<div class="kv"><span>ใบแจ้งความ</span><span>${esc(m.police)}</span></div>` : ''}
    ${ship ? `<div class="kv"><span>ชุดนำส่ง</span><span><a href="#" id="toShip">${esc(ship.id)}</a> ลัง ${esc(m.box)}/${ship.boxes} · ${esc(ship.status)}</span></div>` : ''}
    ${z ? `<div class="kv"><span>ZDMR101</span><span>${esc(z.desc || z.mat)} · ${esc(z.sloc)} · ${esc(z.batch)} ${esc(z.status)}</span></div>` : ''}
    ${m.note ? `<div class="kv"><span>หมายเหตุ</span><span>${esc(m.note)}</span></div>` : ''}
    ${m.photos.length ? `<h3 style="margin-top:14px">รูปถ่าย</h3><div class="photos">${m.photos.map(id => `<a href="https://drive.google.com/file/d/${encodeURIComponent(id)}/view" target="_blank" rel="noopener"><img alt="รูปมิเตอร์" loading="lazy" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w300"></a>`).join('')}</div>` : ''}
    ${sug && sug.r && !m.result ? `<div class="note b" style="margin-top:12px">ระบบแนะนำ: <b>${esc(sug.r)}</b><br>${sug.why.map(esc).join('<br>')}</div>` : ''}
    <h3 style="margin-top:16px">ขั้นตอนในระบบ SAP</h3>
    <div class="sap">${Object.keys(SAP).filter(k => need.includes(k) || m.sap[k]).map(k => `<label class="${need.includes(k) && !m.sap[k] ? 'need' : ''}"><input type="checkbox" data-sap="${k}"${m.sap[k] ? ' checked' : ''}><span class="grow">${esc(SAP[k])}</span>${m.sap[k] ? `<span class="muted">${thDate(m.sap[k])}</span>` : ''}</label>`).join('') || '<p class="muted">ยังไม่มีขั้นตอน SAP สำหรับสถานะนี้</p>'}</div>
    <div class="row" style="margin-top:14px">
      <button class="btn p grow" id="mPrint">พิมพ์ฉลาก</button>
      ${IN_STORE.includes(m.status) || m.status === ST.FIELD ? `<button class="btn grow" id="mSort">คัดแยก</button>` : ''}
      ${m.status === ST.GOOD ? `<button class="btn grow" id="mIssue">เบิกใช้ (Batch R)</button>` : ''}
      <button class="btn grow" id="mEdit">แก้ไข/เพิ่มรูป</button>
      <button class="btn grow" id="mForms">แบบฟอร์ม</button>
    </div>
    ${log.length ? `<details class="more" style="margin-top:10px"><summary>ประวัติ (${log.length})</summary><div class="log">${log.map(l => `<div><b>${esc(l.ev)}</b> ${l.detail ? '· ' + esc(l.detail) : ''}<br><span class="muted">${thDateTime(l.at)} · ${esc(l.by)}</span></div>`).join('')}</div></details>` : ''}`);
  $$('[data-sap]').forEach(cb => cb.onchange = async () => {
    cb.disabled = true;
    try { const j = await api('meterSap', { pea: m.pea, key: cb.dataset.sap, done: cb.checked }); setMeter(j.meter); toast('บันทึกแล้ว', 'ok'); }
    catch (e) { cb.checked = !cb.checked; toast(e.message, 'err'); }
    cb.disabled = false;
  });
  $('#mPrint').onclick = () => printLabels(() => [labelMeter(MAP[m.pea] || m, ship && ship.memo)], 'ฉลาก ' + m.pea);
  if ($('#mSort')) $('#mSort').onclick = () => { closeSheet(); UI.sortSel = m.pea; go('sort'); };
  if ($('#mIssue')) $('#mIssue').onclick = () => issueSheet(m);
  $('#mEdit').onclick = () => editSheet(m);
  $('#mForms').onclick = () => formsMenu(MAP[m.pea] || m);
  if ($('#toShip')) $('#toShip').onclick = e => { e.preventDefault(); closeSheet(); UI.shipSel = ship.id; go('ship'); };
}
function issueSheet(m) {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>เบิกใช้มิเตอร์สภาพดี <span class="mono">${esc(m.pea)}</span></h2>
    <p class="muted" style="margin-top:0">ข้อ 79.2: บันทึกเบิกจ่าย MIGO MVT 261 Batch R อ้างอิงใบสั่งติดตั้ง/สับเปลี่ยน ตรวจ PEA No. ให้ตรงตัวเครื่องจริง</p>
    <label class="lab r" for="isWo">เลขใบสั่งงานติดตั้ง/สับเปลี่ยน *</label><input class="inp mono" id="isWo" inputmode="numeric">
    <label class="chk" style="display:flex;gap:10px;align-items:center;min-height:46px;margin-top:8px"><input type="checkbox" id="is261" style="width:22px;height:22px;accent-color:var(--pea)"> ทำ MIGO 261 ในระบบ SAP แล้ว</label>
    <button class="btn p blk" style="margin-top:10px" id="isGo">บันทึกเบิกใช้</button>`);
  $('#isGo').onclick = async () => {
    const b = $('#isGo'); b.disabled = true;
    try { const j = await api('meterIssue', { pea: m.pea, wo: $('#isWo').value.trim(), sap261: $('#is261').checked }); setMeter(j.meter); toast('เบิกใช้แล้ว', 'ok'); closeSheet(); render(); }
    catch (e) { toast(e.message, 'err'); b.disabled = false; }
  };
}
function editSheet(m) {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>แก้ไข <span class="mono">${esc(m.pea)}</span></h2>
    ${meterSpecFields(m)}
    <div class="g2"><div><label class="lab" for="eWo">ใบสั่งงาน</label><input class="inp mono" id="eWo" value="${esc(m.wo)}"></div>
    <div><label class="lab" for="eCa">หมายเลขผู้ใช้ไฟ</label><input class="inp mono" id="eCa" value="${esc(m.ca)}"></div></div>
    <div class="g2"><div><label class="lab" for="eUnit">หน่วยสุดท้าย</label><input class="inp" id="eUnit" inputmode="decimal" value="${esc(m.lastUnit)}"></div>
    <div><label class="lab" for="eSloc">คลังย่อย</label><select class="inp" id="eSloc">${slocOpts(m.sloc)}</select></div></div>
    <label class="lab" for="eSym">อาการ</label><select class="inp" id="eSym"><option value="">–</option>${SYMPTOMS.map(s => `<option${s[0] === m.symptom ? ' selected' : ''}>${esc(s[0])}</option>`).join('')}</select>
    <label class="lab" for="ePol">เลขที่ใบแจ้งความ</label><input class="inp" id="ePol" value="${esc(m.police)}">
    <details class="more"${m.custName || m.newPea ? ' open' : ''}><summary>ข้อมูลสำหรับแบบฟอร์ม</summary>${formFields(m)}</details>
    <label class="lab" for="eNote">หมายเหตุ</label><textarea class="inp" id="eNote">${esc(m.note)}</textarea>
    <label class="lab">เพิ่มรูปถ่าย</label><input type="file" accept="image/*" capture="environment" multiple id="ePh">
    <button class="btn p blk" style="margin-top:14px" id="eGo">บันทึก</button>`);
  bindSpec.cb = null; bindSpec();
  $('#eGo').onclick = async () => {
    const b = $('#eGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังบันทึก';
    try {
      const add = await uploadPhotos($('#ePh').files, m.pea);
      const f = Object.assign(readSpec(), readFormFields(), { wo: $('#eWo').value, ca: $('#eCa').value, lastUnit: $('#eUnit').value, sloc: $('#eSloc').value, symptom: $('#eSym').value, police: $('#ePol').value, note: $('#eNote').value });
      if (add.length) f.addPhotos = add;
      const j = await api('meterUpdate', { pea: m.pea, fields: f }); setMeter(j.meter); toast('บันทึกแล้ว', 'ok'); openMeter(m.pea); render();
    } catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'บันทึก'; }
  };
}
/** ช่องข้อมูลตัวมิเตอร์ (ยี่ห้อ ชนิด เฟส ขนาด ประกัน รหัสพัสดุ) */
function meterSpecFields(m) {
  const brands = ((DB.settings && DB.settings.brands) || []).concat(['Mahajak', 'Holley', 'Mitsubishi']).filter((v, i, a) => a.indexOf(v) === i);
  return `<div class="g2"><div><label class="lab" for="spBrand">ยี่ห้อ (ผลิตภัณฑ์)</label><input class="inp" id="spBrand" list="brandList" value="${esc(m.brand || '')}"><datalist id="brandList">${brands.map(b => `<option value="${esc(b)}">`).join('')}</datalist></div>
    <div><label class="lab" for="spWar">ประกันถึง</label><input class="inp" type="date" id="spWar" value="${esc(m.warranty || '')}"></div></div>
    <label class="lab">ชนิด</label><div class="chips" id="spKind">${KINDS.map(k => `<button type="button" class="chip sm${m.kind === k ? ' on' : ''}" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <label class="lab">เฟส</label><div class="chips" id="spPhase">${PHASES.map(k => `<button type="button" class="chip sm${m.phase === k ? ' on' : ''}" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="g2"><div><label class="lab" for="spSize">ขนาด</label><select class="inp" id="spSize"><option value="">–</option>${SIZES.map(s => `<option${s === m.size ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    <div><label class="lab" for="spMat">รหัสพัสดุ</label><input class="inp mono" id="spMat" value="${esc(m.mat || '')}" placeholder="1-06-…"></div></div>`;
}
function bindSpec() { ['#spKind', '#spPhase'].forEach(id => $$(id + ' .chip').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); $$(id + ' .chip').forEach(x => x.classList.remove('on')); if (on) b.classList.add('on'); if (bindSpec.cb) bindSpec.cb(); })); }
function readSpec() {
  const ch = id => { const b = $(id + ' .chip.on'); return b ? b.dataset.v : ''; };
  return { brand: $('#spBrand').value.trim(), warranty: $('#spWar').value, kind: ch('#spKind'), phase: ch('#spPhase'), size: $('#spSize').value, mat: $('#spMat').value.trim() };
}
async function shrink(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}
async function uploadPhotos(files, pea) {
  const ids = [];
  for (const f of Array.from(files || []).slice(0, 6)) { const data = await shrink(f); const j = await api('meterPhoto', { pea, data }); ids.push(j.id); }
  return ids;
}

/* ================= หน้า: หน้าแรก ================= */
function alerts() {
  const out = [], warn = (DB.settings && DB.settings.warnDays) || 30;
  const war = DB.meters.filter(m => [ST.WAIT, ST.WARR].includes(m.status) && m.warranty && (d => d != null && d >= 0 && d <= warn)(daysTo(m.warranty)));
  if (war.length) out.push(['', 'ใกล้หมดประกัน ' + war.length + ' เครื่อง', 'ต้องแจ้งผู้ผลิตก่อนวันสิ้นสุดประกัน (ไปรษณีย์ลงทะเบียนตอบรับ) — ข้อ 80.2.2', () => listSheet('ใกล้หมดประกัน', war)]);
  const fld = DB.meters.filter(m => m.status === ST.FIELD && daysTo(m.removedAt) <= -3);
  if (fld.length) out.push(['', 'ถอดมาแล้วยังไม่รับเข้าคลัง ' + fld.length + ' เครื่อง', 'เกิน 3 วัน — สแกนรับเข้าคลังย่อยและทำ MIGO 262 (ข้อ 79.1)', () => { UI.intake = 'recv'; go('intake'); }]);
  const nsap = DB.meters.filter(m => !TERMINAL.includes(m.status) && sapNeed(m).some(k => !m.sap[k]));
  if (nsap.length) out.push(['b', 'ยังไม่ติ๊กขั้นตอน SAP ' + nsap.length + ' เครื่อง', 'เช่น MIGO 262 / 344 / 349 ตามสถานะ', () => listSheet('ยังไม่ติ๊กขั้นตอน SAP', nsap)]);
  DB.ships.filter(s => !['ส่งแล้ว', 'ยกเลิก'].includes(s.status) && s.approvedAt && SHIPK[s.kind] && SHIPK[s.kind].due).forEach(s => {
    const due = addDays(s.approvedAt, SHIPK[s.kind].due), d = daysTo(due);
    out.push([d < 0 ? '' : 'b', (s.kind === 'repair' ? 'ส่งแปรสภาพ ' : 'ขายมิเตอร์ซ่อมไม่ได้ ') + s.id + (d < 0 ? ' เลยกำหนด ' + (-d) + ' วัน' : ' เหลือ ' + d + ' วัน'),
      'ครบกำหนด ' + thDate(due) + ' (' + (s.kind === 'repair' ? 'ภายใน 15 วันหลังอนุมัติ ข้อ 80.4.5' : 'ภายใน 60 วันหลังอนุมัติ ข้อ 80.3.5') + ')', () => { UI.shipSel = s.id; go('ship'); }]);
  });
  const w = DB.meters.filter(m => m.status === ST.WAIT).length;
  if (w) out.push(['g', 'รอคัดแยก ' + w + ' เครื่อง', 'คณะกรรมการสอบหาข้อเท็จจริงคัดแยก (ข้อ 80.1.2)', () => go('sort')]);
  const lastM = DB.round;
  if (DB.round && DB.round.open) out.push(['g', 'รอบตรวจนับเปิดอยู่: ' + DB.round.name, 'สแกนนับต่อได้ที่เมนูตรวจนับ', () => go('count')]);
  else if (!lastM || daysTo(lastM.closedAt || lastM.at) < -31) out.push(['b', 'ถึงรอบตรวจนับประจำเดือน', 'ตรวจนับคงคลังเทียบ ZDMR101 และ MB52 อย่างน้อยเดือนละครั้ง (ข้อ 8.2.8, 76)', () => go('count')]);
  return out;
}
function viewHome() {
  SCAN_HANDLER = null;
  const cnt = s => DB.meters.filter(m => m.status === s).length;
  const al = alerts(); window._al = al;
  const recent = DB.meters.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 12);
  $('#view').innerHTML = `${scanBox('homeScan', 'สแกน PEA No. เพื่อดูประวัติ')}
    <p class="hint">สแกนด้วยเครื่อง Deli ได้ทุกหน้าโดยไม่ต้องแตะช่อง · ระบบแปลงตัวอักษรให้เองถ้าแป้นพิมพ์เป็นภาษาไทย</p>
    <div class="kpis" style="margin-top:12px">
      ${[[ST.FIELD, 'ถอดคืน รอรับเข้า'], [ST.WAIT, 'รอคัดแยก'], [ST.GOOD, 'สภาพดี (Batch R)'], [ST.WARR, 'ในประกัน'], [ST.REP, 'ซ่อมได้'], [ST.UNREP, 'ซ่อมไม่ได้'], [ST.EVID, 'หลักฐานคดี'], [ST.LOST, 'สูญหาย']].map(([s, l]) => `<button class="kpi" data-st="${esc(s)}"><span>${esc(l)}</span><b>${cnt(s)}</b></button>`).join('')}
    </div>
    ${al.length ? `<div class="head"><h2>งานที่ต้องทำ</h2></div><div class="alerts">${al.map((a, i) => `<button class="al ${a[0]}" data-al="${i}"><div><b>${esc(a[1])}</b><span>${esc(a[2])}</span></div></button>`).join('')}</div>` : `<div class="note g" style="margin-top:14px">ไม่มีงานค้าง</div>`}
    <div class="head"><h2>อัปเดตล่าสุด</h2><div class="row"><button class="btn sm" id="hReport">รายงาน</button>${DB.me.admin ? '<button class="btn sm" id="hSet">ตั้งค่า / ZDMR101</button>' : ''}</div></div>
    <div class="list">${recent.map(miRow).join('') || '<div class="empty">ยังไม่มีข้อมูลมิเตอร์ — เริ่มที่เมนู "รับมิเตอร์"</div>'}</div>`;
  bindScan('homeScan', c => openMeter(c));
  $$('[data-st]').forEach(b => b.onclick = () => listSheet(b.dataset.st, DB.meters.filter(m => m.status === b.dataset.st)));
  $$('[data-al]').forEach(b => b.onclick = () => al[Number(b.dataset.al)][3]());
  bindRows();
  $('#hReport').onclick = reportMenu;
  if ($('#hSet')) $('#hSet').onclick = settingsSheet;
}
function miRow(m, extra) {
  return `<button class="mi" data-pea="${esc(m.pea)}"><div class="t"><b>${esc(m.pea)}</b><span>${esc([m.phase, m.size, m.brand].filter(Boolean).join(' · ') || m.job)} · ${esc(m.cause || m.symptom || m.job || '')}</span></div><div class="r">${tag(m.status)}<span class="muted">${extra || thDate(m.updatedAt || m.removedAt)}</span></div></button>`;
}
function bindRows(root) { (root || document).querySelectorAll('[data-pea]').forEach(b => { if (b.tagName === 'BUTTON' && !b.dataset.bound) { b.dataset.bound = 1; b.onclick = () => openMeter(b.dataset.pea); } }); }
function listSheet(title, list) {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>${esc(title)} (${list.length})</h2><div class="list">${list.map(m => miRow(m, m.warranty && daysTo(m.warranty) >= 0 ? 'ประกัน ' + daysTo(m.warranty) + ' วัน' : '')).join('') || '<div class="empty">ไม่มีรายการ</div>'}</div>`);
  bindRows($('#sheet'));
}

/* ================= หน้า: รับมิเตอร์ ================= */
function viewIntake() {
  $('#view').innerHTML = `<div class="seg" style="width:100%"><button data-i="field" class="${UI.intake === 'field' ? 'on' : ''}">ถอดคืนหน้างาน</button><button data-i="recv" class="${UI.intake === 'recv' ? 'on' : ''}">รับเข้าคลังย่อย</button></div><div id="inBody"></div>`;
  $$('[data-i]').forEach(b => b.onclick = () => { UI.intake = b.dataset.i; viewIntake(); });
  if (UI.intake === 'recv') viewRecv(); else viewField();
}
let FORM = {};
function viewField() {
  const pre = UI.prefill || ''; UI.prefill = '';
  FORM = { job: 'สับเปลี่ยนชำรุด', causeGroup: '', cause: '' };
  $('#inBody').innerHTML = `
    <p class="muted" style="margin:12px 0 6px">บันทึกตอนถอด/สับเปลี่ยน/ถอนคืน (ข้อ 52, 65–68) แล้วพิมพ์ฉลากติดฝาครอบ</p>
    <label class="lab r">PEA No. *</label>${scanBox('fPea', 'สแกน PEA No. บนมิเตอร์')}
    <div id="fPeaInfo" class="hint"></div>
    <div class="g2"><div><label class="lab r" for="fWo">เลขใบสั่งงาน *</label><input class="inp mono" id="fWo" inputmode="numeric" placeholder="ใบสั่งงานรื้อถอน/สับเปลี่ยน"></div>
      <div><label class="lab" for="fCa">หมายเลขผู้ใช้ไฟ (CA)</label><input class="inp mono" id="fCa" inputmode="numeric"></div></div>
    <label class="lab">ประเภทงาน</label><div class="chips" id="fJob">${JOBS.map(j => `<button type="button" class="chip sm${j === FORM.job ? ' on' : ''}" data-v="${esc(j)}">${esc(j)}</button>`).join('')}</div>
    <div id="fCauseWrap">
      <label class="lab">สาเหตุชำรุด (ข้อ 68)</label>
      <div class="muted" style="font-weight:700;color:var(--red)">เกิดจากการกระทำ · คิดค่าใช้จ่าย (ข้อ 65)</div>
      <div class="chips" style="margin:6px 0 10px">${CAUSE_ACT.map(c => `<button type="button" class="chip sm" data-c="${esc(c)}" data-g="กระทำ">${esc(c)}</button>`).join('')}</div>
      <div class="muted" style="font-weight:700;color:var(--green)">ไม่เกิดจากการกระทำ · ไม่คิดค่าใช้จ่าย (ข้อ 66)</div>
      <div class="chips" style="margin-top:6px">${CAUSE_NON.map(c => `<button type="button" class="chip sm" data-c="${esc(c)}" data-g="ไม่กระทำ">${esc(c)}</button>`).join('')}</div>
    </div>
    <div id="fInfo" style="margin-top:10px"></div>
    <label class="lab" for="fSym">อาการ (ตามข้อ 80.2.1 / 80.3.1)</label>
    <select class="inp" id="fSym"><option value="">– เลือกอาการ –</option><optgroup label="ลักษณะชำรุดเนื่องจากคุณภาพ (เคลมได้ถ้าอยู่ในประกัน)">${SYMPTOMS.filter(s => s[1] === 'q').map(s => `<option>${esc(s[0])}</option>`).join('')}</optgroup><optgroup label="ลักษณะชำรุดซ่อมไม่ได้">${SYMPTOMS.filter(s => s[1] === 'u').map(s => `<option>${esc(s[0])}</option>`).join('')}</optgroup><option>ไม่พบชำรุด (ถอนคืนปกติ)</option></select>
    <div class="g2"><div><label class="lab" for="fUnit">หน่วยสุดท้าย (kWh)</label><input class="inp" id="fUnit" inputmode="decimal"></div>
      <div><label class="lab" for="fDate">วันที่ถอด</label><input class="inp" type="date" id="fDate" value="${todayStr()}"></div></div>
    <details class="more" open><summary>ข้อมูลตัวมิเตอร์ (ใช้แนะนำผลคัดแยก)</summary>${meterSpecFields({})}</details>
    <details class="more"><summary>ข้อมูลสำหรับแบบฟอร์ม มต.15 / มต.ตม.4 / มต.ทม.7 (ถ้ามี)</summary>${formFields({})}</details>
    <div id="fPolWrap" hidden><label class="lab r" for="fPol">เลขที่ใบแจ้งความ *</label><input class="inp" id="fPol" placeholder="เลขที่/วันที่ สถานีตำรวจ"></div>
    <label class="lab" id="fPhLab">รูปถ่าย (มิเตอร์ + จุดติดตั้ง)</label><input type="file" accept="image/*" capture="environment" multiple id="fPh"><div class="photos" id="fPhPrev" style="margin-top:6px"></div>
    <label class="lab" for="fNote">หมายเหตุ</label><textarea class="inp" id="fNote" placeholder="รายละเอียดเพิ่มเติม"></textarea>
    <div class="stick"><button class="btn grow" id="fSave">บันทึก</button><button class="btn p grow" id="fSavePrint" style="flex:1.6">บันทึก + พิมพ์ฉลาก</button></div>`;
  bindScan('fPea', c => { $('#fPea').value = peaOf(c) || c; checkPea(); });
  $('#fPea').onblur = checkPea; $('#fPea').oninput = () => { clearTimeout(viewField._t); viewField._t = setTimeout(checkPea, 600); };
  SCAN_HANDLER = c => { const p = peaOf(c); if (!$('#fPea').value && p) { $('#fPea').value = p; checkPea(); } else if (/^\d{6,12}$/.test(c) && !$('#fWo').value) $('#fWo').value = c; else if (p) { $('#fPea').value = p; checkPea(); } };
  $$('#fJob .chip').forEach(b => b.onclick = () => { $$('#fJob .chip').forEach(x => x.classList.remove('on')); b.classList.add('on'); FORM.job = b.dataset.v; fInfo(); });
  $$('[data-c]').forEach(b => b.onclick = () => { const on = !b.classList.contains('on'); $$('[data-c]').forEach(x => x.classList.remove('on')); if (on) { b.classList.add('on'); FORM.cause = b.dataset.c; FORM.causeGroup = b.dataset.g; } else { FORM.cause = ''; FORM.causeGroup = ''; } fInfo(); });
  $('#fSym').onchange = fInfo; bindSpec.cb = fInfo; bindSpec();
  $('#fPh').onchange = () => { const box = $('#fPhPrev'); box.innerHTML = ''; Array.from($('#fPh').files).slice(0, 6).forEach(f => { const i = document.createElement('img'); i.src = URL.createObjectURL(f); i.alt = 'รูปที่เลือก'; box.appendChild(i); }); };
  $('#fSave').onclick = () => saveField(false);
  $('#fSavePrint').onclick = () => saveField(true);
  if (pre) { $('#fPea').value = pre; checkPea(); }
  fInfo();
}
function checkPea() {
  const p = peaOf($('#fPea') && $('#fPea').value), el = $('#fPeaInfo'); if (!el) return;
  if (!p) { el.innerHTML = ''; return; }
  const m = MAP[p], z = zdmrMap()[p];
  let h = '';
  if (m && !TERMINAL.includes(m.status) && m.status !== ST.LOST) h += `<span style="color:var(--red)">มีในระบบแล้ว (${esc(m.status)})</span> · <a href="#" id="seeM">เปิดดู</a>`;
  else if (m) h += `เคยมีในระบบ (${esc(m.status)}) — บันทึกเป็นรอบใหม่`;
  if (z) { h += (h ? ' · ' : '') + `<span style="color:var(--green)">✓ พบใน ZDMR101</span> ${esc(z[2] || z[1])} · คลัง ${esc(z[3])}`; if (z[1] && !$('#spMat').value) $('#spMat').value = z[1]; }
  else if (DB.zdmr.length) h += (h ? ' · ' : '') + 'ไม่พบใน ZDMR101 ที่นำเข้า — ตรวจเลขให้ตรงตัวเครื่องจริง (ข้อ 79.1)';
  el.innerHTML = h; const a = $('#seeM'); if (a) a.onclick = e => { e.preventDefault(); openMeter(p); };
}
function fInfo() {
  const job = FORM.job, lost = job === 'สูญหาย', withdraw = /^ถอนคืน/.test(job);
  const evid = EVID_CAUSES.includes(FORM.cause) || lost, police = lost || FORM.cause === 'เพลิงไหม้ (วางเพลิง/การกระทำ)';
  const needPhoto = lost || FORM.cause === 'ภัยธรรมชาติ' || FORM.cause === 'เพลิงไหม้ (วางเพลิง/การกระทำ)';
  $('#fPolWrap').hidden = !police;
  $('#fPhLab').className = 'lab' + (needPhoto ? ' r' : ''); $('#fPhLab').textContent = needPhoto ? 'รูปถ่ายมิเตอร์ + สถานที่เกิดเหตุ * (ข้อ ' + (lost ? '67' : '68.2.2') + ')' : 'รูปถ่าย (มิเตอร์ + จุดติดตั้ง)';
  let h = '';
  if (lost) h += `<div class="note r">ข้อ 67 มิเตอร์สูญหาย: รายงานผู้บังคับบัญชา · แจ้งความร้องทุกข์ · ใน SAP รับคืน MVT 262 "รับคืนจากการสูญหาย" แล้ว Block 344 ที่ Location 3002 (รอสอบสวน) · ติดตั้งทดแทนระบุ "ต.ทดแทนสูญหาย"</div>`;
  else if (FORM.cause) h += `<div class="note ${FORM.causeGroup === 'กระทำ' ? 'r' : 'g'}">${esc(CAUSE_REF[FORM.cause] || '')}${FORM.causeGroup === 'กระทำ' ? '<br>ค่าแรงสับเปลี่ยน: 1 เฟส 100 · 3 เฟส 150 · ประกอบ CT แรงต่ำ 500 · ประกอบ CT VT แรงสูง 2,000 บาท + ค่ามิเตอร์ (ราคามาตรฐาน +15%)' : ''}</div>`;
  else if (withdraw) h += `<div class="note b">ถอนคืน: ถ้ามิเตอร์ไม่ชำรุด ไม่ต้องเลือกสาเหตุ ระบบจะเสนอผลคัดแยกเป็น "สภาพดี" (นำกลับมาใช้ Batch R ข้อ 79.2)</div>`;
  if (evid && !lost) h += `<div class="note k" style="margin-top:8px">เข้าข่ายหลักฐานคดี: เก็บมิเตอร์ไว้จนคดีถึงที่สุด (ข้อ 68.1.2) ระบบจะพิมพ์ฉลาก "หลักฐานคดี"</div>`;
  if (FORM.cause === 'ใช้ไฟเกินพิกัด') h += `<div class="note" style="margin-top:8px">ถ้ามองไม่เห็นความเสียหายจากภายนอก การตัดตราตะกั่วเปิดฝาครอบต้องมีกรรมการ 3 คนที่ ผจก. แต่งตั้ง และลงหมายเหตุในแบบ มต.15 ป.58 (ข้อ 68.1.1 (5))</div>`;
  $('#fInfo').innerHTML = h;
}
async function saveField(andPrint) {
  const pea = peaOf($('#fPea').value);
  if (!pea) { toast('สแกนหรือกรอก PEA No. ให้ถูกต้อง', 'err'); $('#fPea').focus(); return; }
  const lost = FORM.job === 'สูญหาย';
  if (!$('#fWo').value.trim() && !lost) { toast('กรอกเลขใบสั่งงาน (ข้อ 52, 65, 66)', 'err'); $('#fWo').focus(); return; }
  const needPhoto = lost || FORM.cause === 'ภัยธรรมชาติ' || FORM.cause === 'เพลิงไหม้ (วางเพลิง/การกระทำ)';
  if (needPhoto && !$('#fPh').files.length) { toast('กรณีนี้ต้องแนบรูปถ่าย', 'err'); return; }
  if (!$('#fPolWrap').hidden && !$('#fPol').value.trim()) { toast('กรอกเลขที่ใบแจ้งความ', 'err'); $('#fPol').focus(); return; }
  const btns = [$('#fSave'), $('#fSavePrint')]; btns.forEach(b => b.disabled = true);
  const orig = $('#fSavePrint').textContent; $('#fSavePrint').innerHTML = '<span class="spin"></span> กำลังบันทึก';
  try {
    const photos = await uploadPhotos($('#fPh').files, pea);
    const rec = Object.assign({ pea, wo: $('#fWo').value.trim(), ca: $('#fCa').value.trim(), job: FORM.job, causeGroup: FORM.causeGroup, cause: FORM.cause, symptom: $('#fSym').value,
      lastUnit: $('#fUnit').value.trim(), removedAt: $('#fDate').value, police: $('#fPol').value.trim(), note: $('#fNote').value.trim(), photos, sloc: UI.recvSloc }, readSpec(), readFormFields());
    const j = await api('meterIntake', { rec });
    setMeter(j.meter);
    toast('บันทึก ' + pea + ' แล้ว', 'ok');
    if (andPrint) printLater(() => [labelMeter(MAP[pea])], 'ฉลาก ' + pea);
    viewField(); badges();
  } catch (e) { toast(e.message, 'err', 5000); btns.forEach(b => b.disabled = false); $('#fSavePrint').textContent = orig; }
}
function viewRecv() {
  const wait = DB.meters.filter(m => m.status === ST.FIELD);
  $('#inBody').innerHTML = `
    <p class="muted" style="margin:12px 0 6px">สแกนมิเตอร์ที่นำเข้าคลังย่อยต่อเนื่องได้ทีละเครื่อง ระบบตรวจ PEA No. ให้ตรงกับที่บันทึกถอดคืน (ข้อ 79.1)</p>
    <div class="g2"><div><label class="lab" for="rSloc">เข้าคลังย่อย</label><select class="inp" id="rSloc">${slocOpts(UI.recvSloc)}</select></div>
      <div><label class="lab">&nbsp;</label><label style="display:flex;gap:10px;align-items:center;min-height:46px;font-size:14px"><input type="checkbox" id="r262" style="width:22px;height:22px;accent-color:var(--pea)"${UI.recv262 ? ' checked' : ''}> ทำ MIGO 262 Batch R แล้ว</label></div></div>
    <div style="margin-top:10px">${scanBox('rScan', 'สแกนมิเตอร์ที่รับเข้าคลัง')}</div>
    <div class="scanlog" id="rLog">${UI.recvLog.map(recvRow).join('')}</div>
    <div class="head"><h2>รอรับเข้าคลัง (${wait.length})</h2><button class="btn sm" id="rLab">พิมพ์ฉลากทั้งหมด</button></div>
    <div class="list">${wait.map(m => miRow(m, 'ถอด ' + thDate(m.removedAt))).join('') || '<div class="empty">ไม่มีมิเตอร์ค้างรับเข้า</div>'}</div>`;
  $('#rSloc').onchange = () => { UI.recvSloc = $('#rSloc').value; lsr('mt_recv_sloc', UI.recvSloc); };
  $('#r262').onchange = () => UI.recv262 = $('#r262').checked;
  const fn = c => recvScan(c);
  bindScan('rScan', fn); SCAN_HANDLER = fn;
  $('#rLab').onclick = () => { if (!wait.length) { toast('ไม่มีรายการ'); return; } printLabels(() => wait.map(m => labelMeter(m)), 'ฉลากรอรับเข้าคลัง'); };
  bindRows();
}
function recvRow(r) { return `<div class="sl ${r.k}"><b>${esc(r.pea)}</b><span class="grow">${esc(r.msg)}</span><span class="muted">${r.t}</span></div>`; }
async function recvScan(c) {
  const pea = peaOf(c); if (!pea) { toast('รหัสไม่ใช่ PEA No.: ' + c, 'err'); return; }
  const t = new Date().toTimeString().slice(0, 5);
  const add = (k, msg) => { UI.recvLog.unshift({ pea, k, msg, t }); UI.recvLog = UI.recvLog.slice(0, 30); const el = $('#rLog'); if (el) el.innerHTML = UI.recvLog.map(recvRow).join(''); };
  const m = MAP[pea];
  if (!m) { add('bad', 'ยังไม่ได้บันทึกถอดคืน — แตะเพื่อบันทึก'); if (navigator.vibrate) navigator.vibrate([80, 60, 80]); setTimeout(() => { const first = $('#rLog .sl'); if (first) first.onclick = () => { UI.intake = 'field'; UI.prefill = pea; viewIntake(); }; }, 0); return; }
  if (m.status !== ST.FIELD) { add('w', 'สถานะ ' + m.status + ' แล้ว'); return; }
  add('ok', 'กำลังบันทึก…');
  try { const j = await api('meterReceive', { pea, sloc: UI.recvSloc, sap262: UI.recv262 }); setMeter(j.meter); UI.recvLog[0].msg = 'รับเข้า ' + UI.recvSloc + ' แล้ว' + (UI.recv262 ? ' · 262 ✓' : ''); }
  catch (e) { UI.recvLog[0].k = 'bad'; UI.recvLog[0].msg = e.message; }
  if (UI.tab === 'intake' && UI.intake === 'recv') viewRecv();
}

/* ================= หน้า: คัดแยก ================= */
function viewSort() {
  const filters = [ST.WAIT, ST.FIELD, ST.GOOD, ST.WARR, ST.REP, ST.UNREP, ST.EVID];
  const list = DB.meters.filter(m => m.status === UI.sortFilter && !m.ship);
  const sel = UI.sortSel && MAP[UI.sortSel];
  $('#view').innerHTML = `<h2>คัดแยกมิเตอร์ชำรุด</h2>
    <p class="muted" style="margin-top:-4px">คณะกรรมการสอบหาข้อเท็จจริงตรวจสอบและคัดแยก (ข้อ 75.1.2, 80.1.2) · สแกนมิเตอร์เพื่อเลือก</p>
    ${scanBox('sScan', 'สแกนมิเตอร์ที่จะคัดแยก')}
    <div id="sCard"></div>
    <div class="chips" style="margin-top:16px">${filters.map(f => `<button class="chip sm${f === UI.sortFilter ? ' on' : ''}" data-f="${esc(f)}">${esc(f)} (${DB.meters.filter(m => m.status === f && !m.ship).length})</button>`).join('')}</div>
    <div class="list" style="margin-top:10px">${list.map(m => miRow(m)).join('') || '<div class="empty">ไม่มีรายการ</div>'}</div>
    <div class="row" style="margin-top:14px"><button class="btn grow" id="sRep">รายงานผลการคัดแยก (เสนอ ผจก.)</button></div>`;
  const pick = c => { const p = peaOf(c); if (!p) return; if (!MAP[p]) { openMeter(p); return; } UI.sortSel = p; sortCard(); window.scrollTo(0, 0); $('#main').scrollTop = 0; };
  bindScan('sScan', pick); SCAN_HANDLER = pick;
  $$('[data-f]').forEach(b => b.onclick = () => { UI.sortFilter = b.dataset.f; viewSort(); });
  $$('.list [data-pea]').forEach(b => b.onclick = () => pick(b.dataset.pea));
  $('#sRep').onclick = () => reportSort();
  if (sel) sortCard();
}
function sortCard() {
  const m = MAP[UI.sortSel], el = $('#sCard'); if (!m || !el) return;
  if (TERMINAL.includes(m.status)) { el.innerHTML = `<div class="note" style="margin-top:12px">${esc(m.pea)} ปิดงานแล้ว (${esc(m.status)})</div>`; return; }
  const sug = suggest(m), wd = daysTo(m.warranty);
  const com = ((DB.settings && DB.settings.sortCommittee) || []).join(', ');
  const evidLocked = m.status === ST.EVID && !DB.me.admin;
  let pickR = m.result || '';
  el.innerHTML = `<div class="card" style="margin-top:12px;border:2px solid var(--pea)">
    <div class="row"><b class="mono grow" style="font-size:20px">${esc(m.pea)}</b>${tag(m.status)}${m.warranty ? `<span class="tag ${wd >= 0 ? 't-warr' : 't-done'}">${wd >= 0 ? 'ประกันเหลือ ' + wd + ' วัน' : 'หมดประกัน'}</span>` : ''}</div>
    <div class="muted" style="margin-top:4px">${esc(m.job)} · ${esc(m.cause || 'ไม่ระบุสาเหตุ')} · ${esc(m.symptom || '')} · ถอด ${thDate(m.removedAt)}${m.photos.length ? ' · รูป ' + m.photos.length : ''}</div>
    <div class="row" style="margin-top:6px;font-size:13px">${['262', '344'].map(k => `<span class="tag ${m.sap[k] ? 't-good' : 't-wait'}">${m.sap[k] ? '✓' : '○'} MVT ${k}</span>`).join(' ')}</div>
    <details class="more"><summary>ข้อมูลตัวมิเตอร์ (ยี่ห้อ เฟส ขนาด ประกัน)</summary>${meterSpecFields(m)}
      <label class="lab" for="sSym">อาการ</label><select class="inp" id="sSym"><option value="">–</option>${SYMPTOMS.map(s => `<option${s[0] === m.symptom ? ' selected' : ''}>${esc(s[0])}</option>`).join('')}</select></details>
    <div id="sSug"></div>
    <div class="lab">ผลคัดแยกของกรรมการ</div>
    <div class="res">
      ${[[ST.GOOD, '#13633a', 'นำกลับมาใช้ Batch R (79.2)'], [ST.WARR, '#1a4fa0', 'เคลมผู้ผลิต ส่ง กมต. (80.2)'], [ST.REP, '#b45309', 'QI 349 · ส่งแปรสภาพ (80.4)'], [ST.UNREP, '#9b1c1c', 'จำหน่ายโดยวิธีขาย (80.3)']]
        .map(([r, c, d]) => `<button class="rb${pickR === r ? ' on' : ''}" style="border-left-color:${c}" data-r="${esc(r)}"${evidLocked ? ' disabled' : ''}><b>${esc(r)}</b><span>${esc(d)}</span></button>`).join('')}
      <button class="rb${pickR === ST.EVID ? ' on' : ''}" style="border-left-color:#1c1a22;grid-column:1/-1" data-r="${esc(ST.EVID)}"><b>หลักฐานคดี</b><span>ละเมิด/สูญหาย/วางเพลิง — เก็บจนคดีถึงที่สุด (68.1.2)</span></button>
    </div>
    ${m.status === ST.EVID ? `<div class="note k" style="margin-top:8px">${DB.me.admin ? 'ปลดหลักฐานคดีได้เมื่อคดีถึงที่สุด/ได้รับชดใช้ครบ — ต้องระบุเหตุผลในหมายเหตุ' : 'มิเตอร์หลักฐานคดี ปลดได้เฉพาะผู้ดูแลระบบ'}</div>` : ''}
    <label class="lab" for="sCom">คณะกรรมการ (ชื่อ คั่นด้วย ,)</label><input class="inp" id="sCom" value="${esc(lsr('mt_sort_com') || com)}">
    <label class="lab" for="sNote">หมายเหตุ</label><input class="inp" id="sNote" placeholder="เช่น ตรวจสอบแล้ว Current coil ไหม้">
    <div class="row" style="margin-top:12px"><button class="btn grow" id="sCancel">ยกเลิก</button><button class="btn p grow" id="sSave" style="flex:1.6">บันทึกผล + พิมพ์ฉลาก</button></div>
  </div>`;
  bindSpec.cb = () => showSug(); bindSpec();
  const showSug = () => {
    const tmp = Object.assign({}, m, readSpec(), { symptom: $('#sSym').value || m.symptom });
    const s = suggest(tmp);
    $('#sSug').innerHTML = s.r || s.why.length ? `<div class="note b" style="margin-top:10px">ระบบแนะนำ: <b>${esc(s.r || '–')}</b><br>${s.why.map(esc).join('<br>')}<br><span style="font-size:12px">ข้อเสนอเท่านั้น กรรมการเป็นผู้ตัดสิน</span></div>` : '';
  };
  $('#sSym').onchange = showSug; ['#spBrand', '#spWar', '#spSize'].forEach(id => $(id).addEventListener('change', showSug)); showSug();
  $$('.rb').forEach(b => b.onclick = () => { pickR = b.dataset.r; $$('.rb').forEach(x => x.classList.toggle('on', x === b)); });
  $('#sCancel').onclick = () => { UI.sortSel = null; viewSort(); };
  $('#sSave').onclick = async () => {
    if (!pickR) { toast('เลือกผลคัดแยก', 'err'); return; }
    const b = $('#sSave'); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังบันทึก';
    const sp = readSpec();
    lsr('mt_sort_com', $('#sCom').value.trim());
    try {
      const j = await api('meterSort', { pea: m.pea, result: pickR, committee: $('#sCom').value.trim(), note: $('#sNote').value.trim(), warranty: sp.warranty, brand: sp.brand, kind: sp.kind, phase: sp.phase, size: sp.size, symptom: $('#sSym').value });
      setMeter(j.meter); toast(m.pea + ' → ' + pickR, 'ok');
      UI.sortSel = null; viewSort();
      printLater(() => [labelMeter(MAP[m.pea])], 'ฉลาก ' + m.pea);
    } catch (e) { toast(e.message, 'err', 5000); b.disabled = false; b.textContent = 'บันทึกผล + พิมพ์ฉลาก'; }
  };
}

/* ================= หน้า: ตรวจนับ ================= */
function countData(sloc) {
  const R = DB.round, scans = (DB.scans || []).filter(s => s[1] === sloc), scanSet = new Set(scans.map(s => s[0]));
  const allScan = new Set((DB.scans || []).map(s => s[0]));
  const dm = DB.zdmr.filter(r => r[3] === sloc).map(r => r[0]), dmSet = new Set(dm);
  const app = DB.meters.filter(m => m.sloc === sloc && IN_STORE.includes(m.status)).map(m => m.pea), appSet = new Set(app);
  const mm = DB.mb52.filter(r => r[0] === sloc), mmQty = mm.reduce((a, r) => a + r[4], 0);
  const missDM = dm.filter(p => !allScan.has(p)), missApp = app.filter(p => !allScan.has(p) && !dmSet.has(p));
  const extra = [...scanSet].filter(p => !dmSet.has(p) && !appSet.has(p));
  return { R, scans, dm, app, mm, mmQty, missDM, missApp, extra, found: [...scanSet].filter(p => dmSet.has(p) || appSet.has(p)) };
}
function viewCount() {
  const R = DB.round, open = R && R.open, sl = UI.countSloc;
  const d = countData(sl);
  $('#view').innerHTML = `<h2>ตรวจนับมิเตอร์คงคลัง</h2>
    <p class="muted" style="margin-top:-4px">เทียบของจริงกับ ZDMR101 (DM) และ MB52 (MM) อย่างน้อยเดือนละครั้ง โดยคณะกรรมการตรวจสอบและคัดแยก (ข้อ 8.2.8, 76) · ประจำปี: กรรมการ ≥3 คน</p>
    ${R ? `<div class="card"><div class="row"><b class="grow">${esc(R.name)}</b>${open ? '<span class="tag t-good">เปิดอยู่</span>' : '<span class="tag t-done">ปิดแล้ว</span>'}</div>
      <div class="muted">${esc(R.kind)} · เริ่ม ${thDateTime(R.at)} โดย ${esc(R.by)}${R.closedAt ? ' · ปิด ' + thDateTime(R.closedAt) : ''}${R.committee && R.committee.length ? '<br>กรรมการ: ' + esc(R.committee.join(', ')) : ''}</div></div>` : ''}
    ${!open ? `<div class="row" style="margin-top:10px">${DB.me.admin ? '<button class="btn p grow" id="cStart">เริ่มรอบตรวจนับใหม่</button>' : '<div class="note grow">ยังไม่มีรอบที่เปิด — ผู้ดูแลระบบคลังเป็นผู้เริ่มรอบ</div>'}${R ? '<button class="btn grow" id="cRep">รายงานรอบล่าสุด</button>' : ''}</div>` : ''}
    <div class="chips" style="margin-top:14px">${DB.slocs.map(s => `<button class="chip sm${s.code === sl ? ' on' : ''}" data-s="${s.code}">${s.code} ${esc(s.name)}</button>`).join('')}</div>
    <div class="kpis" style="margin-top:10px">
      <div class="kpi"><span>ZDMR101 (DM)</span><b>${d.dm.length}</b></div>
      <div class="kpi"><span>MB52 (MM)</span><b>${fmtN(d.mmQty)}</b></div>
      <div class="kpi"><span>ทะเบียนแอป</span><b>${d.app.length}</b></div>
      <div class="kpi"><span>สแกนพบ</span><b style="color:var(--pea)">${d.scans.length}</b></div>
    </div>
    ${!DB.zdmr.length ? `<div class="note" style="margin-top:10px">ยังไม่ได้นำเข้า ZDMR101 — ระบบใช้ทะเบียนในแอปแทน ${DB.me.admin ? '<a href="#" id="cZd">นำเข้า ZDMR101</a>' : ''}</div>` : `<p class="hint">ZDMR101 นำเข้าเมื่อ ${thDateTime(DB.zdmrAt)}</p>`}
    ${open ? `<div style="margin-top:12px">${scanBox('cScan', 'สแกน PEA No. ที่อยู่ในคลัง ' + sl)}</div><div class="scanlog" id="cLog">${UI.countLog.map(recvRow).join('')}</div>` : ''}
    ${diffBlock('ไม่พบของจริง (มีใน ZDMR101)', d.missDM, R, 'miss')}
    ${diffBlock('ไม่พบของจริง (มีในทะเบียนแอป)', d.missApp, R, 'miss')}
    ${diffBlock('พบเกิน (ไม่อยู่ในทะเบียนคลังนี้)', d.extra, R, 'extra')}
    ${d.mm.length ? `<details class="more" style="margin-top:10px"><summary>ยอด MB52 ของคลัง ${esc(sl)} (${d.mm.length} รายการ)</summary><div class="tbl"><table><thead><tr><th>รหัสพัสดุ</th><th>คำอธิบาย</th><th>แบทช์</th><th class="r">ยอด</th></tr></thead><tbody>${d.mm.map(r => `<tr><td class="mono">${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td class="r">${fmtN(r[4])} ${esc(r[5])}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    ${open ? `<div class="row" style="margin-top:14px"><button class="btn grow" id="cRep">รายงาน (ร่าง)</button>${DB.me.admin ? '<button class="btn p grow" id="cClose">ปิดรอบ + บันทึกสรุป</button>' : ''}</div>` : ''}`;
  $$('[data-s]').forEach(b => b.onclick = () => { UI.countSloc = b.dataset.s; lsr('mt_count_sloc', UI.countSloc); viewCount(); });
  if ($('#cStart')) $('#cStart').onclick = startRoundSheet;
  if ($('#cRep')) $('#cRep').onclick = () => reportCount();
  if ($('#cClose')) $('#cClose').onclick = closeRound;
  if ($('#cZd')) $('#cZd').onclick = e => { e.preventDefault(); zdmrSheet(); };
  $$('[data-cause]').forEach(inp => inp.onchange = async () => { try { const j = await api('mRoundNote', { round: R.id, key: inp.dataset.cause, text: inp.value }); R.causes = j.causes; toast('บันทึกสาเหตุแล้ว', 'ok'); } catch (e) { toast(e.message, 'err'); } });
  bindRows();
  if (open) { const fn = c => countScan(c); bindScan('cScan', fn); SCAN_HANDLER = fn; } else SCAN_HANDLER = null;
}
const fmtN = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
function diffBlock(title, list, R, kind) {
  if (!list.length) return '';
  return `<div class="head"><h2 style="font-size:16px">${esc(title)} (${list.length})</h2></div><div class="list">${list.map(p => { const m = MAP[p], z = zdmrMap()[p];
    return `<div class="card" style="padding:8px 10px"><div class="row"><button class="btn sm mono" data-pea="${esc(p)}">${esc(p)}</button><span class="muted grow">${esc(m ? m.status + ' · ' + (m.cause || m.job) : (z ? (z[2] || z[1]) + ' · ' + z[4] + ' ' + z[5] : 'ไม่มีข้อมูล'))}</span></div>
    ${R ? `<input class="inp" style="margin-top:6px;min-height:40px" data-cause="${esc(p)}" placeholder="สาเหตุผลต่าง (ข้อ 76.2 (2.1))" value="${esc((R.causes || {})[p] || '')}"${R.open || DB.me.admin ? '' : ' disabled'}>` : ''}</div>`; }).join('')}</div>`;
}
async function countScan(c) {
  const pea = peaOf(c); if (!pea) { toast('รหัสไม่ใช่ PEA No.: ' + c, 'err'); return; }
  const t = new Date().toTimeString().slice(0, 5), sl = UI.countSloc;
  const add = (k, msg) => { UI.countLog.unshift({ pea, k, msg, t }); UI.countLog = UI.countLog.slice(0, 20); };
  if ((DB.scans || []).some(s => s[0] === pea)) { add('w', 'สแกนแล้ว'); viewCount(); return; }
  const z = zdmrMap()[pea], m = MAP[pea];
  let msg = 'พบ', k = 'ok';
  if (z && z[3] !== sl) { msg = 'อยู่ทะเบียนคลัง ' + z[3]; k = 'w'; }
  else if (!z && !(m && m.sloc === sl && IN_STORE.includes(m.status))) { msg = 'ไม่อยู่ในทะเบียนคลังนี้'; k = 'w'; }
  try { const j = await api('mScan', { round: DB.round.id, pea, sloc: sl }); if (!j.dup) DB.scans.push([pea, sl, '', DB.me.name, new Date().toISOString()]); add(k, msg); if (navigator.vibrate) navigator.vibrate(k === 'ok' ? 40 : [80, 60, 80]); }
  catch (e) { add('bad', e.message); }
  viewCount();
}
function startRoundSheet() {
  const com = ((DB.settings && DB.settings.countCommittee) || []).join(', ');
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>เริ่มรอบตรวจนับมิเตอร์</h2>
    <div class="seg" style="width:100%" id="rk"><button data-k="month" class="on">ประจำเดือน</button><button data-k="year">ประจำปี</button></div>
    <p class="hint" id="rkH">ข้อ 76.1, 8.2.8: ตรวจนับอย่างน้อยเดือนละครั้ง เทียบ ZDMR101 และ MB52</p>
    <label class="lab" for="rName">ชื่อรอบ</label><input class="inp" id="rName" placeholder="เว้นว่าง = ตั้งให้อัตโนมัติ">
    <label class="lab" for="rCom">คณะกรรมการตรวจสอบและคัดแยก (คั่นด้วย ,)</label><input class="inp" id="rCom" value="${esc(com)}">
    <div class="note b" style="margin-top:10px">ก่อนเริ่ม: export ZDMR101 และ MB52 ณ วันนับ แล้วนำเข้า (ZDMR101 ที่เมนูตั้งค่า · MB52 ที่ระบบคลังพัสดุ) เพื่อให้ยอดเทียบเป็นปัจจุบัน</div>
    <button class="btn p blk" style="margin-top:12px" id="rGo">เริ่มรอบ</button>`);
  let kind = 'month';
  $$('#rk button').forEach(b => b.onclick = () => { kind = b.dataset.k; $$('#rk button').forEach(x => x.classList.toggle('on', x === b)); $('#rkH').textContent = kind === 'year' ? 'ระเบียบ กค. ข้อ 213: เริ่มวันทำการแรกของปีงบประมาณ รายงานภายใน 30 วันทำการ · หลักเกณฑ์ทรัพย์สิน 2568 ข้อ 16: กรรมการ ≥3 คน เสร็จภายในธันวาคม' : 'ข้อ 76.1, 8.2.8: ตรวจนับอย่างน้อยเดือนละครั้ง เทียบ ZDMR101 และ MB52'; });
  $('#rGo').onclick = async () => {
    const b = $('#rGo'); b.disabled = true;
    try { await api('mRoundStart', { kind, name: $('#rName').value.trim(), committee: $('#rCom').value.split(',').map(s => s.trim()).filter(Boolean) }); closeSheet(); UI.countLog = []; await load(true); go('count'); toast('เริ่มรอบแล้ว สแกนได้เลย', 'ok'); }
    catch (e) { toast(e.message, 'err', 5000); b.disabled = false; }
  };
}
function countSummary() {
  const out = {};
  DB.slocs.forEach(s => { const d = countData(s.code); if (d.dm.length || d.app.length || d.scans.length || d.mmQty) out[s.code] = { dm: d.dm.length, mm: d.mmQty, app: d.app.length, scan: d.scans.length, missDM: d.missDM, missApp: d.missApp, extra: d.extra }; });
  return out;
}
async function closeRound() {
  const sum = countSummary(), diff = Object.values(sum).reduce((a, s) => a + s.missDM.length + s.missApp.length + s.extra.length, 0);
  const noCause = Object.values(sum).flatMap(s => s.missDM.concat(s.missApp, s.extra)).filter(p => !(DB.round.causes || {})[p]).length;
  if (!confirm('ปิดรอบตรวจนับ?\nผลต่างทั้งหมด ' + diff + ' รายการ' + (noCause ? ' (ยังไม่ระบุสาเหตุ ' + noCause + ')' : ''))) return;
  try { await api('mRoundClose', { round: DB.round.id, summary: sum }); toast('ปิดรอบแล้ว', 'ok'); await load(true); go('count'); reportCount(); }
  catch (e) { toast(e.message, 'err'); }
}

/* ================= หน้า: นำส่ง/จำหน่าย ================= */
function viewShip() {
  SCAN_HANDLER = null;
  const sel = UI.shipSel && DB.ships.find(s => s.id === UI.shipSel);
  if (sel || UI.shipSel === 'new') { shipEdit(sel); return; }
  const ready = k => DB.meters.filter(m => m.result === SHIPK[k].result && !m.ship && !TERMINAL.includes(m.status)).length;
  $('#view').innerHTML = `<h2>นำส่ง / จำหน่าย</h2>
    <p class="muted" style="margin-top:-4px">รวมมิเตอร์ที่คัดแยกแล้วเป็นชุด พิมพ์ฉลากลัง (ข้อ 84) ฉลากฝาครอบพร้อมเลขที่บันทึกนำส่ง (ข้อ 80.2.5) และใบรายการแนบบันทึก</p>
    <div class="g3">${Object.keys(SHIPK).map(k => `<button class="kpi" data-new="${k}"><span>${esc(SHIPK[k].label)}</span><b>${ready(k)}</b><span>เครื่องพร้อมบรรจุ · สร้างชุด</span></button>`).join('')}</div>
    <div class="note" style="margin-top:12px">ห้ามส่งมิเตอร์เคลม/แปรสภาพทางไปรษณีย์หรือบริษัทขนส่งเอกชนโดยเด็ดขาด ให้ใช้รถ กฟภ. (รถไม่มีหลังคาต้องคลุมผ้าใบ) — ข้อ 80.2.5, 84.1</div>
    <div class="head"><h2>ชุดนำส่ง</h2></div>
    <div class="list">${DB.ships.map(s => { const K = SHIPK[s.kind] || {}; const due = s.approvedAt && K.due ? addDays(s.approvedAt, K.due) : '';
      return `<button class="mi" data-ship="${esc(s.id)}"><div class="t"><b>${esc(s.id)}</b><span>${esc(K.label || s.kind)} · ${s.items.length} เครื่อง · ${s.boxes} ลัง${s.memo ? ' · บันทึก ' + esc(s.memo) : ''}</span></div><div class="r"><span class="tag ${s.status === 'ส่งแล้ว' ? 't-done' : s.status === 'ยกเลิก' ? 't-done' : 't-wait'}">${esc(s.status)}</span><span class="muted">${due && !['ส่งแล้ว', 'ยกเลิก'].includes(s.status) ? 'กำหนด ' + thDate(due) : thDate(s.at)}</span></div></button>`; }).join('') || '<div class="empty">ยังไม่มีชุดนำส่ง</div>'}</div>`;
  $$('[data-new]').forEach(b => b.onclick = () => { UI.shipSel = 'new'; UI.shipKind = b.dataset.new; viewShip(); });
  $$('[data-ship]').forEach(b => b.onclick = () => { UI.shipSel = b.dataset.ship; viewShip(); });
}
function shipEdit(s) {
  const isNew = !s;
  const kind = s ? s.kind : UI.shipKind, K = SHIPK[kind];
  const D = s ? JSON.parse(JSON.stringify(s)) : { kind, dest: K.dest, status: 'กำลังบรรจุ', memo: '', approvedAt: '', approvalNo: '', boxes: 1, items: [], note: '' };
  const closed = ['ส่งแล้ว', 'ยกเลิก'].includes(D.status) && !DB.me.admin;
  const pool = () => DB.meters.filter(m => m.result === K.result && (!m.ship || m.ship === D.id) && (!TERMINAL.includes(m.status) || m.ship === D.id));
  const inSet = () => new Set(D.items.map(i => i[0]));
  const draw = () => {
    const ins = inSet(), P = pool();
    const due = D.approvedAt && K.due ? addDays(D.approvedAt, K.due) : '';
    const earliestWar = kind === 'warranty' ? D.items.map(i => MAP[i[0]] && MAP[i[0]].warranty).filter(Boolean).sort()[0] : '';
    $('#view').innerHTML = `<button class="btn sm" id="shBack">‹ ชุดนำส่งทั้งหมด</button>
      <h2 style="margin-top:12px">${isNew ? 'สร้างชุด' : esc(D.id)} · ${esc(K.label)}</h2>
      <p class="muted" style="margin-top:-4px">${esc(K.ref)} · ข้างลังระบุ "${esc(K.box)}"</p>
      ${kind === 'warranty' ? `<div class="note b">ก่อนส่ง: ทำหนังสือแจ้งผู้ผลิตก่อนวันสิ้นสุดประกัน (ไปรษณีย์ลงทะเบียนตอบรับ) ระบุวันเริ่ม/สิ้นสุดประกัน ผู้ผลิต PEA No. ขนาด เฟส ลักษณะชำรุด · MIGO 343 ปลด Block · บันทึกอนุมัติ ผจก. + ZDMR101 แนบ (ข้อ 80.2.2–80.2.4)${earliestWar ? `<br><b>ประกันเครื่องแรกหมด ${thDate(earliestWar)} (อีก ${daysTo(earliestWar)} วัน)</b>` : ''}</div>` : ''}
      ${kind === 'repair' ? `<div class="note b">ขั้นตอน: QI (MVT 349) + ZARR020 → กบล. ขออนุมัติจำหน่ายโดยแปรสภาพ → บันทึกขออนุมัติ ผจก. นำส่งคลังพัสดุ/ศูนย์ซ่อม ภายใน 15 วันหลังอนุมัติ · ผู้ส่ง-ผู้รับลงนามร่วมกัน (ข้อ 80.4)${due ? `<br><b>ครบกำหนดส่ง ${thDate(due)} (${daysTo(due) >= 0 ? 'อีก ' + daysTo(due) + ' วัน' : 'เลย ' + (-daysTo(due)) + ' วัน'})</b>` : ''}</div>` : ''}
      ${kind === 'sale' ? `<div class="note b">ขั้นตอน: Block 344 + ZARR020 → กบล. ขออนุมัติจำหน่ายโดยวิธีขาย → ขายภายใน 60 วันหลังอนุมัติ → ผู้ซื้อแสดงใบเสร็จรับของ → ZMME024 ตัดจ่าย (ข้อ 80.3) · ทุบทำลายฝาครอบ/nameplate ก่อนขายได้${due ? `<br><b>ครบกำหนดขาย ${thDate(due)} (${daysTo(due) >= 0 ? 'อีก ' + daysTo(due) + ' วัน' : 'เลย ' + (-daysTo(due)) + ' วัน'})</b>` : ''}</div>` : ''}
      <div class="g2"><div><label class="lab" for="dDest">ปลายทาง</label><input class="inp" id="dDest" value="${esc(D.dest)}"${closed ? ' disabled' : ''}></div>
        <div><label class="lab" for="dStatus">สถานะ</label><select class="inp" id="dStatus"${closed ? ' disabled' : ''}>${SHIP_STATUS.map(x => `<option${x === D.status ? ' selected' : ''}>${x}</option>`).join('')}</select></div></div>
      <div class="g3"><div><label class="lab" for="dMemo">เลขที่บันทึกนำส่ง</label><input class="inp" id="dMemo" value="${esc(D.memo)}"${closed ? ' disabled' : ''}></div>
        <div><label class="lab" for="dApp">อนุมัติเมื่อ</label><input class="inp" type="date" id="dApp" value="${esc(D.approvedAt)}"${closed ? ' disabled' : ''}></div>
        <div><label class="lab" for="dAppNo">เลขที่อนุมัติจำหน่าย</label><input class="inp" id="dAppNo" value="${esc(D.approvalNo)}"${closed ? ' disabled' : ''}></div></div>
      <div class="g2"><div><label class="lab" for="dBoxes">จำนวนลัง</label><input class="inp" type="number" min="1" max="99" id="dBoxes" value="${D.boxes}"${closed ? ' disabled' : ''}></div>
        <div><label class="lab">&nbsp;</label><button class="btn blk" id="dAuto"${closed ? ' disabled' : ''}>แบ่งลังอัตโนมัติ</button></div></div>
      <label class="lab" for="dNote">หมายเหตุ</label><input class="inp" id="dNote" value="${esc(D.note)}"${closed ? ' disabled' : ''}>
      ${closed ? '' : `<div style="margin-top:12px">${scanBox('dScan', 'สแกนมิเตอร์ใส่ลัง')}</div>`}
      <div class="head"><h2 style="font-size:16px">ในชุดนี้ ${D.items.length} เครื่อง · พร้อมบรรจุ ${P.filter(m => !ins.has(m.pea)).length}</h2><button class="btn sm" id="dAll"${closed ? ' disabled' : ''}>เลือกทั้งหมด</button></div>
      <div class="list">${P.map(m => { const it = D.items.find(i => i[0] === m.pea);
        return `<div class="mi"><input type="checkbox" data-in="${esc(m.pea)}"${it ? ' checked' : ''}${closed ? ' disabled' : ''} aria-label="ใส่ ${esc(m.pea)} ในชุด"><button class="t" style="border:0;background:none;text-align:left;padding:0" data-pea="${esc(m.pea)}"><b>${esc(m.pea)}</b><span>${esc([m.phase, m.size, m.brand].filter(Boolean).join(' · '))} · ${esc(m.symptom || m.cause || '')}${m.warranty ? ' · ประกัน ' + thDate(m.warranty) : ''}</span></button>
          ${it ? `<select class="inp" style="width:84px;min-height:38px" data-box="${esc(m.pea)}"${closed ? ' disabled' : ''}>${Array.from({ length: D.boxes }, (_, i) => `<option value="${i + 1}"${it[1] === i + 1 ? ' selected' : ''}>ลัง ${i + 1}</option>`).join('')}</select>` : ''}</div>`; }).join('') || '<div class="empty">ไม่มีมิเตอร์ผลคัดแยก "' + esc(K.result) + '" ที่พร้อมบรรจุ</div>'}</div>
      <div class="row" style="margin-top:14px">
        <button class="btn grow" id="dLabBox">ฉลากลัง (${D.boxes})</button>
        <button class="btn grow" id="dLabM">ฉลากฝาครอบ (${D.items.length})</button>
        <button class="btn grow" id="dRep">ใบรายการนำส่ง</button>
        ${kind === 'warranty' ? '<button class="btn grow" id="dF23">บันทึกนำส่ง (แบบที่ 23)</button>' : ''}
        ${kind === 'repair' ? '<button class="btn grow" id="dF24">บันทึกขออนุมัติ (แบบที่ 24)</button><button class="btn grow" id="dFSort">ผลคัดแยก (แนบแบบที่ 24)</button>' : ''}
      </div>
      <div class="stick"><button class="btn grow" id="dCancel">ยกเลิก</button><button class="btn p grow" id="dSave" style="flex:1.6"${closed ? ' disabled' : ''}>บันทึกชุด</button></div>`;
    const sync = () => { D.dest = $('#dDest').value; D.status = $('#dStatus').value; D.memo = $('#dMemo').value.trim(); D.approvedAt = $('#dApp').value; D.approvalNo = $('#dAppNo').value.trim(); D.note = $('#dNote').value; D.boxes = Math.max(1, Math.min(99, Number($('#dBoxes').value) || 1)); D.items.forEach(i => { if (i[1] > D.boxes) i[1] = D.boxes; }); };
    ['#dDest', '#dStatus', '#dMemo', '#dApp', '#dAppNo', '#dNote'].forEach(id => $(id).onchange = sync);
    $('#dBoxes').onchange = () => { sync(); draw(); };
    $('#shBack').onclick = () => { UI.shipSel = null; viewShip(); };
    $('#dCancel').onclick = () => { UI.shipSel = null; viewShip(); };
    $$('[data-in]').forEach(cb => cb.onchange = () => { sync(); if (cb.checked) D.items.push([cb.dataset.in, D.boxes]); else D.items = D.items.filter(i => i[0] !== cb.dataset.in); draw(); });
    $$('[data-box]').forEach(se => se.onchange = () => { const it = D.items.find(i => i[0] === se.dataset.box); if (it) it[1] = Number(se.value); });
    $('#dAll').onclick = () => { sync(); P.forEach(m => { if (!inSet().has(m.pea)) D.items.push([m.pea, D.boxes]); }); draw(); };
    $('#dAuto').onclick = () => { sync(); const per = Math.ceil(D.items.length / D.boxes) || 1; D.items.forEach((it, i) => it[1] = Math.min(D.boxes, Math.floor(i / per) + 1)); draw(); toast('แบ่ง ' + D.items.length + ' เครื่อง เป็น ' + D.boxes + ' ลัง'); };
    $$('.list [data-pea]').forEach(b => b.onclick = () => openMeter(b.dataset.pea));
    if (!closed) { const fn = c => { const p = peaOf(c), m = MAP[p]; if (!m) { toast('ไม่พบ ' + c + ' ในระบบ', 'err'); return; } if (m.result !== K.result) { toast(p + ' ผลคัดแยกเป็น "' + (m.result || 'ยังไม่คัดแยก') + '"', 'err', 4000); return; } if (m.ship && m.ship !== D.id) { toast(p + ' อยู่ในชุด ' + m.ship + ' แล้ว', 'err'); return; } sync(); if (!inSet().has(p)) { D.items.push([p, D.boxes]); toast('ใส่ ' + p + ' ลัง ' + D.boxes, 'ok'); } else toast(p + ' อยู่ในชุดนี้แล้ว'); draw(); }; bindScan('dScan', fn); SCAN_HANDLER = fn; }
    $('#dLabBox').onclick = () => { sync(); printLabels(() => Array.from({ length: D.boxes }, (_, i) => labelBox(Object.assign({ id: D.id || '(ยังไม่บันทึก)', at: D.at || new Date().toISOString() }, D), i + 1)), 'ฉลากลัง'); };
    $('#dLabM').onclick = () => { sync(); if (!D.items.length) { toast('ยังไม่มีมิเตอร์ในชุด'); return; } printLabels(() => D.items.map(i => labelMeter(MAP[i[0]], D.memo)), 'ฉลากฝาครอบ'); };
    $('#dRep').onclick = () => { sync(); reportShip(D); };
    const shipMs = () => D.items.map(i => MAP[i[0]]).filter(Boolean);
    if ($('#dF23')) $('#dF23').onclick = () => { sync(); if (!D.items.length) { toast('ยังไม่มีมิเตอร์ในชุด'); return; } openForm('f23', { ship: D, ms: shipMs() }); };
    if ($('#dF24')) $('#dF24').onclick = () => { sync(); if (!D.items.length) { toast('ยังไม่มีมิเตอร์ในชุด'); return; } openForm('f24', { ship: D, ms: shipMs() }); };
    if ($('#dFSort')) $('#dFSort').onclick = () => { sync(); if (!D.items.length) { toast('ยังไม่มีมิเตอร์ในชุด'); return; } openForm('sort', { ms: shipMs(), range: 'ชุดนำส่ง ' + (D.id || '(ยังไม่บันทึก)') }); };
    $('#dSave').onclick = async () => {
      sync();
      if (D.status === 'ส่งแล้ว' && !confirm('ยืนยันว่า' + (kind === 'sale' ? 'ขาย/ส่งมอบผู้ซื้อ' : 'ส่ง') + 'แล้ว?\nมิเตอร์ ' + D.items.length + ' เครื่องจะเปลี่ยนเป็น "' + (kind === 'sale' ? ST.SOLD : ST.SENT) + '"')) return;
      const b = $('#dSave'); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังบันทึก';
      try { const j = await api('shipSave', { ship: D }); toast('บันทึกชุด ' + j.ship.id + ' แล้ว', 'ok'); await load(true); UI.shipSel = j.ship.id; go('ship'); }
      catch (e) { toast(e.message, 'err', 5000); b.disabled = false; b.textContent = 'บันทึกชุด'; }
    };
  };
  draw();
}

/* ================= รายงาน (A4 พิมพ์ได้) ================= */
function openReport(title, body) {
  const w = window.open('', '_blank');
  if (!w) { toast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปก่อน', 'err'); return; }
  w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap">
  <style>@page{size:A4;margin:14mm 12mm}body{font-family:'Sarabun',sans-serif;font-size:14px;color:#000;margin:0;padding:16px}h1{font-size:19px;text-align:center;margin:0 0 4px}h2{font-size:16px;margin:16px 0 6px}.c{text-align:center}.m{color:#333;font-size:13px}
  table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #000;padding:4px 6px;font-size:12.5px;vertical-align:top}th{background:#eee}td.r,th.r{text-align:right}
  .sig{display:flex;flex-wrap:wrap;gap:24px 40px;justify-content:space-around;margin-top:34px}.sig div{text-align:center;min-width:200px}.bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px;border-bottom:1px solid #ccc}
  .bar button{font:inherit;padding:8px 18px;border-radius:8px;border:1px solid #6a1b74;background:#6a1b74;color:#fff}@media print{.bar{display:none}body{padding:0}}</style></head>
  <body><div class="bar"><button onclick="print()">พิมพ์ / บันทึก PDF</button></div>${body}</body></html>`);
  w.document.close();
}
const sigs = names => `<div class="sig">${(names.length ? names : ['', '', '']).map((n, i) => `<div>ลงชื่อ ..................................................<br>(${esc(n || '..................................................')})<br>${i === 0 ? 'ประธานกรรมการ' : 'กรรมการ'}</div>`).join('')}</div>`;
function reportMenu() {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>รายงาน</h2>
    <div class="list">
      <button class="mi" id="r1"><div class="t"><b style="font-family:inherit">รายงานผลการคัดแยก</b><span>เสนอ ผจก. · คณะกรรมการสอบหาข้อเท็จจริง (ข้อ 80.1.2)</span></div></button>
      <button class="mi" id="r2"><div class="t"><b style="font-family:inherit">ทะเบียนมิเตอร์คงคลัง</b><span>แยกตามคลังย่อยและสถานะ</span></div></button>
      <button class="mi" id="r3"><div class="t"><b style="font-family:inherit">รายงานตรวจนับรอบล่าสุด</b><span>ผลต่าง + สาเหตุ + ลงนามกรรมการ (ข้อ 76)</span></div></button>
      <button class="mi" id="r4"><div class="t"><b style="font-family:inherit">มิเตอร์ชำรุดตามสาเหตุ (ข้อ 68)</b><span>สรุปคิดค่าใช้จ่าย/ไม่คิด แยกตามสาเหตุ</span></div></button>
      <button class="mi" id="r5"><div class="t"><b style="font-family:inherit">ส่งออก CSV ทั้งหมด</b><span>เปิดด้วย Excel</span></div></button>
    </div>
    <h3 style="margin-top:16px">แบบฟอร์มตามระเบียบ (ภาคผนวก ข)</h3>
    <div class="list">
      <button class="mi" id="rf1"><div class="t"><b style="font-family:inherit">มต.4/1 สมุดควบคุมมิเตอร์คงคลัง</b><span>รายเดือน · รับ–จ่าย–คงเหลือ แยกขนาด</span></div></button>
      <button class="mi" id="rf2"><div class="t"><b style="font-family:inherit">รายงานผลการคัดแยกมิเตอร์ (แนบแบบที่ 24)</b><span>คณะกรรมการสอบหาข้อเท็จจริง · เลือกช่วงวันที่</span></div></button>
    </div>
    <p class="muted">แบบรายเครื่อง (มต.15, มต.ตม.4, มต.ทม.7, ผคต.กพร.-01, มต.ตต.2/3) อยู่ที่ปุ่ม "แบบฟอร์ม" ในหน้ารายละเอียดมิเตอร์ · แบบที่ 23/24 อยู่ในหน้าชุดนำส่ง</p>`);
  $('#r1').onclick = () => reportSort(); $('#r2').onclick = reportStock; $('#r3').onclick = () => reportCount(); $('#r4').onclick = reportCause; $('#r5').onclick = exportCsv;
  $('#rf1').onclick = ledgerSheet; $('#rf2').onclick = sortFormSheet;
}
function reportSort(from) {
  if (!from) {
    sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>รายงานผลการคัดแยก</h2>
      <div class="g2"><div><label class="lab" for="rsFrom">ตั้งแต่วันที่ (คัดแยก)</label><input class="inp" type="date" id="rsFrom" value="${addDays(todayStr(), -30)}"></div>
      <div><label class="lab">&nbsp;</label><button class="btn p blk" id="rsGo">เปิดรายงาน</button></div></div>`);
    $('#rsGo').onclick = () => reportSort($('#rsFrom').value || '2000-01-01');
    return;
  }
  const list = DB.meters.filter(m => m.result && m.sortedAt && String(m.sortedAt).slice(0, 10) >= from).sort((a, b) => String(a.sortedAt).localeCompare(String(b.sortedAt)));
  const coms = [...new Set(list.map(m => m.sortedBy).join(',').split(',').map(s => s.trim()).filter(Boolean))].slice(0, 5);
  const by = r => list.filter(m => m.result === r).length;
  openReport('รายงานผลการคัดแยกมิเตอร์ชำรุด', `<h1>รายงานผลการตรวจสอบและคัดแยกมิเตอร์ชำรุด</h1><p class="c m">${esc(owner())} · ตั้งแต่ ${thDate(from)} ถึง ${thDate(todayStr())} · ตามระเบียบ กฟภ. ว่าด้วยวิธีปฏิบัติเกี่ยวกับมิเตอร์ พ.ศ. 2562 ข้อ 75.1.2 และ 80.1.2</p>
    <p>สรุป: สภาพดี ${by(ST.GOOD)} · ชำรุดอยู่ในประกัน ${by(ST.WARR)} · ชำรุดซ่อมได้ ${by(ST.REP)} · ชำรุดซ่อมไม่ได้ ${by(ST.UNREP)} · หลักฐานคดี ${by(ST.EVID)} · รวม ${list.length} เครื่อง</p>
    <table><thead><tr><th>#</th><th>PEA No.</th><th>ยี่ห้อ / ชนิด / เฟส / ขนาด</th><th>ประเภทงาน · ใบสั่งงาน</th><th>สาเหตุ / อาการ</th><th>ประกันถึง</th><th>ผลคัดแยก</th><th>วันที่</th></tr></thead><tbody>
    ${list.map((m, i) => `<tr><td class="r">${i + 1}</td><td>${esc(m.pea)}</td><td>${esc([m.brand, m.kind, m.phase, m.size].filter(Boolean).join(' / '))}</td><td>${esc(m.job)}<br>${esc(m.wo)}</td><td>${esc(m.cause)}${m.symptom ? '<br>' + esc(m.symptom) : ''}</td><td>${m.warranty ? thDate(m.warranty) : '–'}</td><td>${esc(m.result)}</td><td>${thDate(m.sortedAt)}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:14px">คณะกรรมการได้ตรวจสอบหาสาเหตุการชำรุดและคัดแยกแล้ว จึงเรียนมาเพื่อโปรดพิจารณาสั่งการให้ดำเนินการตามข้อ 80.2 (ในประกัน) 80.3 (ซ่อมไม่ได้) และ 80.4 (ซ่อมได้) ต่อไป</p>${sigs(coms)}`);
}
function reportStock() {
  const list = DB.meters.filter(m => IN_STORE.includes(m.status) || m.status === ST.FIELD);
  openReport('ทะเบียนมิเตอร์คงคลัง', `<h1>ทะเบียนมิเตอร์ผ่านการใช้งานคงคลัง</h1><p class="c m">${esc(owner())} · ณ ${thDateTime(new Date().toISOString())}</p>
    ${DB.slocs.map(s => { const L = list.filter(m => m.sloc === s.code); if (!L.length) return ''; return `<h2>คลังย่อย ${s.code} ${esc(s.name)} (${L.length})</h2><table><thead><tr><th>#</th><th>PEA No.</th><th>สถานะ</th><th>ยี่ห้อ / เฟส / ขนาด</th><th>สาเหตุ</th><th>ถอดเมื่อ</th><th>ประกันถึง</th><th>SAP</th></tr></thead><tbody>${L.map((m, i) => `<tr><td class="r">${i + 1}</td><td>${esc(m.pea)}</td><td>${esc(m.status)}</td><td>${esc([m.brand, m.phase, m.size].filter(Boolean).join(' / '))}</td><td>${esc(m.cause || m.job)}</td><td>${thDate(m.removedAt)}</td><td>${m.warranty ? thDate(m.warranty) : '–'}</td><td>${Object.keys(m.sap).join(', ')}</td></tr>`).join('')}</tbody></table>`; }).join('')}`);
}
function reportCount() {
  const R = DB.round; if (!R) { toast('ยังไม่มีรอบตรวจนับ'); return; }
  const sum = R.open ? countSummary() : (R.summary || countSummary());
  const causes = R.causes || {};
  const rows = (arr, lab) => arr.map(p => `<tr><td>${esc(p)}</td><td>${lab}</td><td>${esc(causes[p] || '')}</td></tr>`).join('');
  openReport('รายงานผลการตรวจนับมิเตอร์', `<h1>รายงานผลการตรวจนับมิเตอร์คงคลัง${R.open ? ' (ร่าง)' : ''}</h1><p class="c m">${esc(owner())} · ${esc(R.name)} (${esc(R.kind)}) · เริ่ม ${thDateTime(R.at)}${R.closedAt ? ' · ปิด ' + thDateTime(R.closedAt) : ''}<br>ตามระเบียบ กฟภ. ว่าด้วยวิธีปฏิบัติเกี่ยวกับมิเตอร์ พ.ศ. 2562 ข้อ 76 (เทียบ ZDMR101 และ MB52)</p>
    <table><thead><tr><th>คลังย่อย</th><th class="r">ZDMR101 (DM)</th><th class="r">MB52 (MM) หมวด 1-06</th><th class="r">ทะเบียนแอป</th><th class="r">นับได้จริง</th><th class="r">ไม่พบ</th><th class="r">พบเกิน</th></tr></thead><tbody>
    ${Object.keys(sum).map(k => { const s = sum[k]; return `<tr><td>${k} ${esc(slocName(k))}</td><td class="r">${s.dm}</td><td class="r">${fmtN(s.mm)}</td><td class="r">${s.app}</td><td class="r">${s.scan}</td><td class="r">${s.missDM.length + s.missApp.length}</td><td class="r">${s.extra.length}</td></tr>`; }).join('')}</tbody></table>
    <h2>รายการผลต่างและสาเหตุ</h2><table><thead><tr><th>PEA No.</th><th>ผลต่าง</th><th>สาเหตุ</th></tr></thead><tbody>
    ${Object.keys(sum).map(k => rows(sum[k].missDM, 'ไม่พบของจริง (มีใน ZDMR101) คลัง ' + k) + rows(sum[k].missApp, 'ไม่พบของจริง (ทะเบียนแอป) คลัง ' + k) + rows(sum[k].extra, 'พบเกิน คลัง ' + k)).join('') || '<tr><td colspan="3" class="c">ไม่มีผลต่าง</td></tr>'}</tbody></table>
    <p style="margin-top:12px">กรณีผลต่างให้หาสาเหตุและเสนอขออนุมัติปรับปรุงบัญชี (ข้อ 76.2 (2.1)) · กรณีสูญหายเสนอให้คณะกรรมการสอบหาข้อเท็จจริงดำเนินการ (ข้อ 76.2 (2.2))</p>${sigs(R.committee || [])}`);
}
function reportCause() {
  const list = DB.meters.filter(m => m.cause);
  const all = CAUSE_ACT.concat(CAUSE_NON);
  openReport('มิเตอร์ชำรุดตามสาเหตุ', `<h1>สรุปมิเตอร์ชำรุดตามสาเหตุ (ข้อ 68)</h1><p class="c m">${esc(owner())} · ณ ${thDate(todayStr())}</p>
    <table><thead><tr><th>สาเหตุ</th><th>กลุ่ม</th><th class="r">จำนวน</th><th>การดำเนินการ</th></tr></thead><tbody>${all.map(c => `<tr><td>${esc(c)}</td><td>${CAUSE_ACT.includes(c) ? 'เกิดจากการกระทำ (คิดค่าใช้จ่าย ข้อ 65)' : 'ไม่เกิดจากการกระทำ (ข้อ 66)'}</td><td class="r">${list.filter(m => m.cause === c).length}</td><td>${esc(CAUSE_REF[c] || '')}</td></tr>`).join('')}</tbody></table>`);
}
function reportShip(D) {
  const K = SHIPK[D.kind], items = D.items.slice().sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  openReport('ใบรายการนำส่ง ' + (D.id || ''), `<h1>บัญชีรายการมิเตอร์${D.kind === 'sale' ? 'ชำรุดซ่อมไม่ได้ (จำหน่ายโดยวิธีขาย)' : D.kind === 'repair' ? 'ชำรุดซ่อมได้ นำส่งแปรสภาพ' : 'ชำรุดอยู่ในเงื่อนไขรับประกันคุณภาพ'}</h1>
    <p class="c m">${esc(owner())} · ชุด ${esc(D.id || '(ยังไม่บันทึก)')} · ปลายทาง ${esc(D.dest)} · ${D.boxes} ลัง ${items.length} เครื่อง${D.memo ? ' · บันทึกนำส่งเลขที่ ' + esc(D.memo) : ''}${D.approvalNo ? ' · อนุมัติจำหน่ายเลขที่ ' + esc(D.approvalNo) : ''}${D.approvedAt ? ' ลว. ' + thDate(D.approvedAt) : ''}<br>${esc(K.ref)}</p>
    <table><thead><tr><th>#</th><th>ลัง</th><th>PEA No.</th><th>ผลิตภัณฑ์</th><th>ชนิด / เฟส / ขนาด</th><th>ลักษณะที่ชำรุด</th>${D.kind === 'warranty' ? '<th>สิ้นสุดประกัน</th>' : ''}<th>ใบสั่งงาน</th></tr></thead><tbody>
    ${items.map((it, i) => { const m = MAP[it[0]] || { pea: it[0] }; return `<tr><td class="r">${i + 1}</td><td>${it[1]}/${D.boxes}</td><td>${esc(m.pea)}</td><td>${esc(m.brand || '')}</td><td>${esc([m.kind, m.phase, m.size].filter(Boolean).join(' / '))}</td><td>${esc(m.symptom || m.cause || '')}</td>${D.kind === 'warranty' ? `<td>${m.warranty ? thDate(m.warranty) : ''}</td>` : ''}<td>${esc(m.wo || '')}</td></tr>`; }).join('')}</tbody></table>
    <p style="margin-top:12px">${D.kind === 'sale' ? 'ขายให้แล้วเสร็จภายใน 60 วันหลังได้รับอนุมัติจำหน่าย (ข้อ 80.3.5) · ผู้ซื้อแสดงใบเสร็จรับเงินเพื่อขอรับมิเตอร์ (ข้อ 80.3.6)' : 'จัดส่งด้วยรถของ กฟภ. ห้ามส่งทางไปรษณีย์หรือบริษัทขนส่งเอกชน (ข้อ 80.2.5) · ผู้จัดส่งและผู้รับตรวจสอบความถูกต้องและลงนามร่วมกัน (ข้อ 80.4.6)'}</p>
    <div class="sig"><div>ลงชื่อ ......................................... ผู้จัดส่ง<br>(..................................................)<br>วันที่ ............/............/............</div><div>ลงชื่อ ......................................... ผู้รับ<br>(..................................................)<br>วันที่ ............/............/............</div></div>`);
}
function exportCsv() {
  const cols = ['pea', 'status', 'sloc', 'job', 'wo', 'ca', 'causeGroup', 'cause', 'symptom', 'lastUnit', 'brand', 'kind', 'phase', 'size', 'mat', 'warranty', 'removedAt', 'removedBy', 'result', 'sortedAt', 'sortedBy', 'ship', 'box', 'police', 'note'];
  const head = ['PEA No.', 'สถานะ', 'คลังย่อย', 'ประเภทงาน', 'ใบสั่งงาน', 'หมายเลขผู้ใช้ไฟ', 'กลุ่มสาเหตุ', 'สาเหตุ', 'อาการ', 'หน่วยสุดท้าย', 'ยี่ห้อ', 'ชนิด', 'เฟส', 'ขนาด', 'รหัสพัสดุ', 'ประกันถึง', 'ถอดเมื่อ', 'ถอดโดย', 'ผลคัดแยก', 'คัดแยกเมื่อ', 'คัดแยกโดย', 'ชุดนำส่ง', 'ลัง', 'ใบแจ้งความ', 'หมายเหตุ', 'SAP'];
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const csv = '﻿' + head.map(q).join(',') + '\n' + DB.meters.map(m => cols.map(c => q(m[c])).concat([q(Object.keys(m.sap).join(' '))]).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'meters_' + todayStr() + '.csv'; a.click();
}

/* ================= ตั้งค่า + นำเข้า ZDMR101 ================= */
/* ================= แบบฟอร์มภาคผนวก ข (meter-form.html) =================
 * ระบบส่งข้อมูลไปหน้าแบบฟอร์มผ่าน localStorage แล้วเปิดแท็บใหม่ (ต้องเรียกจากการกดปุ่มโดยตรง) */
const FORM_LIST = {
  mt15: ['มต.15 ป.58', 'แบบฟอร์มแสดงหน่วยค้างภายในมิเตอร์'],
  tm4: ['มต.ตม.4 ป.58', 'ขออนุมัติสับเปลี่ยนมิเตอร์ชำรุด'],
  tm7: ['มต.ทม.7 ป.58', 'รายงานการสับเปลี่ยนมิเตอร์'],
  amr: ['ผคต.กพร.-01 ป.62', 'แจ้งมิเตอร์ระบบ AMR และ/หรืออุปกรณ์ประกอบชำรุด'],
  tt2: ['มต.ตต.2 ป.59', 'บันทึกการตรวจสอบมิเตอร์ (หลักฐานคดี)'],
  tt3: ['มต.ตต.3 ป.59', 'บันทึกรับรองการบรรจุหีบห่อของกลาง']
};
function formOrg() {
  const s = DB.settings || {}, f = s.forms || {};
  return Object.assign({ amp: 'อ่าวลึก', prov: 'กระบี่' }, Object.fromEntries(Object.entries(f).filter(e => e[1])), { branch: f.branch || owner(), committee: s.sortCommittee || [] });
}
function openForm(id, extra) {
  const payload = Object.assign({ f: id, org: formOrg(), today: todayStr() }, extra || {});
  try { localStorage.setItem('mt_form', JSON.stringify(payload)); } catch (e) { toast('บันทึกข้อมูลแบบฟอร์มไม่ได้ (พื้นที่เบราว์เซอร์เต็ม)', 'err'); return; }
  const w = window.open('meter-form.html?f=' + id, '_blank');
  if (!w) location.href = 'meter-form.html?f=' + id;
}
function formsMenu(m) {
  const evid = EVID_CAUSES.includes(m.cause) || m.status === ST.EVID, amr = /AMR|Smart/i.test(m.kind || '');
  const main = ['mt15', 'tm4', 'tm7'].concat(amr ? ['amr'] : [], evid ? ['tt2', 'tt3'] : []);
  const rest = Object.keys(FORM_LIST).filter(k => !main.includes(k));
  const btn = k => `<button class="mi" data-form="${k}"><div class="t"><b style="font-family:inherit">${esc(FORM_LIST[k][0])}</b><span>${esc(FORM_LIST[k][1])}</span></div></button>`;
  const miss = [!m.custName && 'ชื่อผู้ใช้ไฟ', !m.custAddr && 'ที่อยู่', !m.serial && 'หมายเลขเครื่อง', !m.newPea && m.job !== 'สูญหาย' && !/^ถอนคืน/.test(m.job) && 'PEA เครื่องใหม่'].filter(Boolean);
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>แบบฟอร์ม <span class="mono">${esc(m.pea)}</span></h2>
    <p class="muted" style="margin-top:-4px">ระบบเติมข้อมูลจากมิเตอร์นี้ให้ ช่องที่เหลือพิมพ์เพิ่มในหน้าแบบฟอร์มก่อนสั่งพิมพ์ได้</p>
    ${miss.length ? `<div class="note" style="margin-bottom:10px">ยังไม่มี: ${esc(miss.join(', '))} — <a href="#" id="fmEdit">กรอกเก็บไว้ในระบบ</a> หรือพิมพ์ในแบบฟอร์มตอนพิมพ์ก็ได้</div>` : ''}
    <div class="list">${main.map(btn).join('')}</div>
    ${rest.length ? `<details class="more" style="margin-top:10px"><summary>แบบอื่น</summary><div class="list">${rest.map(btn).join('')}</div></details>` : ''}`);
  $$('[data-form]').forEach(b => b.onclick = () => openForm(b.dataset.form, { m }));
  if ($('#fmEdit')) $('#fmEdit').onclick = e => { e.preventDefault(); editSheet(m); };
}
function formFields(m) {
  return `<div class="g2"><div><label class="lab" for="ffName">ชื่อผู้ใช้ไฟ</label><input class="inp" id="ffName" value="${esc(m.custName || '')}"></div>
    <div><label class="lab" for="ffSerial">หมายเลขเครื่อง (Serial)</label><input class="inp mono" id="ffSerial" value="${esc(m.serial || '')}"></div></div>
    <label class="lab" for="ffAddr">ที่อยู่ที่ติดตั้ง</label><input class="inp" id="ffAddr" value="${esc(m.custAddr || '')}" placeholder="บ้านเลขที่ หมู่ ถนน ตำบล">
    <div class="g2"><div><label class="lab" for="ffNewPea">PEA No. เครื่องที่ติดตั้งแทน</label><input class="inp mono" id="ffNewPea" value="${esc(m.newPea || '')}"></div>
    <div><label class="lab" for="ffNewUnit">หน่วยเริ่มต้นเครื่องใหม่</label><input class="inp" id="ffNewUnit" inputmode="decimal" value="${esc(m.newUnit || '')}"></div></div>`;
}
function readFormFields() {
  const v = id => ($(id) ? $(id).value.trim() : undefined);
  const o = { custName: v('#ffName'), custAddr: v('#ffAddr'), serial: v('#ffSerial'), newPea: v('#ffNewPea'), newUnit: v('#ffNewUnit') };
  Object.keys(o).forEach(k => o[k] === undefined && delete o[k]);
  return o;
}
/** มต.4/1 — สร้างรายการรับ–จ่าย–คงเหลือรายเดือนจากทะเบียนมิเตอร์ */
function ledgerRows(ym) {
  const start = ym + '-01', end = addDays(addDays(start, 32).slice(0, 8) + '01', 0);
  const cat = m => { const k = (String(m.phase || '').startsWith('3') ? '3' : '1') + '-' + String(m.size || '').replace(/\s*A.*$/i, ''); return { '1-5(15)': 0, '1-15(45)': 1, '3-15(45)': 2 }[k] ?? 3; };
  const ev = [];
  DB.meters.forEach(m => {
    if (m.status === ST.LOST || m.status === ST.FIELD) return;
    const inD = String(m.removedAt || '').slice(0, 10); if (!inD) return;
    let outD = '', outT = '', ref = '';
    if (m.status === ST.SENT || m.status === ST.SOLD) { const sh = DB.ships.find(x => x.id === m.ship); outD = String((sh && (sh.doneAt || sh.upAt)) || m.updatedAt || '').slice(0, 10); outT = (m.status === ST.SOLD ? 'จ่ายจำหน่ายโดยวิธีขาย' : 'จ่ายนำส่ง ' + (sh && sh.kind === 'warranty' ? 'กมต. (เคลมประกัน)' : 'แปรสภาพ (ซ่อมได้)')) + (sh ? ' ชุด ' + sh.id : ''); ref = sh ? (sh.memo || sh.approvalNo || '') : ''; }
    else if (m.status === ST.USED) { outD = String(m.updatedAt || '').slice(0, 10); outT = 'เบิกใช้ใหม่ (Batch R)'; }
    ev.push({ d: inD, k: 'in', g: 'รับคืนมิเตอร์ (' + (m.job || 'ถอดคืน') + ')', ref: m.wo, c: cat(m) });
    if (outD) ev.push({ d: outD, k: 'out', g: outT, ref, c: cat(m) });
  });
  const bal = [0, 0, 0, 0];
  ev.filter(e => e.d < start).forEach(e => bal[e.c] += e.k === 'in' ? 1 : -1);
  const tot = () => bal.reduce((a, b) => a + b, 0);
  const rows = [{ d: start, t: 'ยอดยกมา', ref: '', bal: tot(), s: bal.slice() }];
  const grp = {};
  ev.filter(e => e.d >= start && e.d < end).forEach(e => { const key = e.d + '|' + e.k + '|' + e.g; (grp[key] = grp[key] || { d: e.d, k: e.k, t: e.g, refs: [], n: 0, c: [0, 0, 0, 0] }); grp[key].n++; grp[key].c[e.c]++; if (e.ref && !grp[key].refs.includes(e.ref)) grp[key].refs.push(e.ref); });
  Object.values(grp).sort((a, b) => a.d.localeCompare(b.d) || (a.k === 'in' ? -1 : 1)).forEach(g => {
    g.c.forEach((n, i) => bal[i] += g.k === 'in' ? n : -n);
    rows.push({ d: g.d, t: g.t, ref: (g.k === 'in' ? 'WO ' : '') + g.refs.slice(0, 2).join(', ') + (g.refs.length > 2 ? ' +' + (g.refs.length - 2) : ''), in: g.k === 'in' ? g.n : '', out: g.k === 'out' ? g.n : '', bal: tot(), s: bal.slice() });
  });
  return rows;
}
function ledgerSheet() {
  const ym = todayStr().slice(0, 7);
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>มต.4/1 สมุดควบคุมมิเตอร์คงคลัง</h2>
    <p class="muted" style="margin-top:0">ระบบสรุปรับคืน (ตามวันที่ถอด) และจ่าย (นำส่ง/ขาย/เบิกใช้) ของเดือนที่เลือก พร้อมยอดคงเหลือแยกขนาด · ผู้ตรวจสอบลงนามในช่องท้ายแถว</p>
    <div class="g2"><div><label class="lab" for="lgM">เดือน</label><input class="inp" type="month" id="lgM" value="${ym}"></div>
    <div><label class="lab">&nbsp;</label><button class="btn p blk" id="lgGo">เปิดแบบฟอร์ม</button></div></div>`);
  $('#lgGo').onclick = () => { const v = $('#lgM').value || ym, d = toD(v + '-01'); openForm('mt41', { rows: ledgerRows(v), monthName: d ? ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][d.getMonth()] + ' ' + (d.getFullYear() + 543) : '' }); };
}
function sortFormSheet() {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>รายงานผลการคัดแยกมิเตอร์</h2>
    <p class="muted" style="margin-top:0">แบบของคณะกรรมการสอบหาข้อเท็จจริง (แนบแบบที่ 24) · นับมิเตอร์ที่คัดแยกในช่วงวันที่ พร้อมเอกสารแนบรายการ PEA No.</p>
    <div class="g2"><div><label class="lab" for="sfFrom">ตั้งแต่</label><input class="inp" type="date" id="sfFrom" value="${addDays(todayStr(), -30)}"></div>
    <div><label class="lab" for="sfTo">ถึง</label><input class="inp" type="date" id="sfTo" value="${todayStr()}"></div></div>
    <button class="btn p blk" style="margin-top:12px" id="sfGo">เปิดแบบฟอร์ม</button>`);
  $('#sfGo').onclick = () => {
    const a = $('#sfFrom').value || '2000-01-01', b = $('#sfTo').value || todayStr();
    const ms = DB.meters.filter(m => m.result && m.sortedAt && String(m.sortedAt).slice(0, 10) >= a && String(m.sortedAt).slice(0, 10) <= b).sort((x, y) => String(x.sortedAt).localeCompare(String(y.sortedAt)));
    if (!ms.length) { toast('ไม่มีมิเตอร์ที่คัดแยกในช่วงนี้'); return; }
    openForm('sort', { ms, range: thDate(a) + ' – ' + thDate(b) });
  };
}
function settingsSheet() {
  const s = DB.settings || {}, sf = s.forms || {};
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>ตั้งค่าโมดูลมิเตอร์</h2>
    <label class="lab" for="sOwner">การไฟฟ้าเจ้าของทรัพย์สิน (พิมพ์บนฉลาก)</label><input class="inp" id="sOwner" value="${esc(s.owner || 'กฟส.อ่าวลึก')}">
    <label class="lab" for="sSortC">คณะกรรมการสอบหาข้อเท็จจริง/คัดแยก (คั่นด้วย ,)</label><input class="inp" id="sSortC" value="${esc((s.sortCommittee || []).join(', '))}">
    <label class="lab" for="sCntC">คณะกรรมการตรวจสอบและคัดแยก (ตรวจนับ)</label><input class="inp" id="sCntC" value="${esc((s.countCommittee || []).join(', '))}">
    <div class="g2"><div><label class="lab" for="sWarn">เตือนก่อนหมดประกัน (วัน)</label><input class="inp" type="number" id="sWarn" value="${esc(s.warnDays || 30)}"></div>
      <div><label class="lab" for="sDef">คลังย่อยมิเตอร์ (ค่าเริ่มต้น)</label><select class="inp" id="sDef">${slocOpts(s.defaultSloc || '1201')}</select></div></div>
    <label class="lab" for="sBrands">ยี่ห้อมิเตอร์ที่ใช้บ่อย (คั่นด้วย ,)</label><input class="inp" id="sBrands" value="${esc((s.brands || []).join(', '))}" placeholder="Mahajak, Holley, Mitsubishi, …">
    <details class="more"><summary>ข้อมูลหัวแบบฟอร์ม (ภาคผนวก ข)</summary>
      <div class="g2"><div><label class="lab" for="sfBranch">ชื่อหน่วยงานในแบบฟอร์ม</label><input class="inp" id="sfBranch" value="${esc(sf.branch || s.owner || 'กฟส.อ่าวลึก')}"></div>
        <div><label class="lab" for="sfDoc">เลขที่หนังสือ (คำนำหน้า)</label><input class="inp" id="sfDoc" value="${esc(sf.docPrefix || '')}" placeholder="เช่น กฟส.อล.(ปร.)"></div></div>
      <div class="g2"><div><label class="lab" for="sfAmp">อำเภอ</label><input class="inp" id="sfAmp" value="${esc(sf.amp || 'อ่าวลึก')}"></div>
        <div><label class="lab" for="sfProv">จังหวัด</label><input class="inp" id="sfProv" value="${esc(sf.prov || 'กระบี่')}"></div></div>
      <div class="g2"><div><label class="lab" for="sfMgr">ชื่อ ผจก.</label><input class="inp" id="sfMgr" value="${esc(sf.mgr || '')}"></div>
        <div><label class="lab" for="sfHead">ชื่อ หผ. ที่ดูแลมิเตอร์</label><input class="inp" id="sfHead" value="${esc(sf.head || '')}"></div></div>
      <label class="lab" for="sfAddr">ที่อยู่สำนักงาน (มต.ตต.3)</label><input class="inp" id="sfAddr" value="${esc(sf.addr || '')}">
      <div class="g2"><div><label class="lab" for="sfTel">โทรศัพท์</label><input class="inp" id="sfTel" value="${esc(sf.tel || '')}"></div>
        <div><label class="lab" for="sfPol">สถานีตำรวจ (สภ.)</label><input class="inp" id="sfPol" value="${esc(sf.police || '')}" placeholder="อ่าวลึก"></div></div>
      <label class="lab" for="sfMaker">ผู้จัดทำ/ผู้ประสานงาน</label><input class="inp" id="sfMaker" value="${esc(sf.maker || '')}">
    </details>
    <button class="btn p blk" style="margin-top:12px" id="sSave">บันทึกตั้งค่า</button>
    <h3 style="margin-top:20px">รายงาน ZDMR101 (ระบบ DM)</h3>
    <p class="muted" style="margin-top:0">${DB.zdmr.length ? 'มี ' + DB.zdmr.length + ' รายการ · นำเข้า ' + thDateTime(DB.zdmrAt) : 'ยังไม่ได้นำเข้า'}</p>
    <button class="btn blk" id="sZd">นำเข้า ZDMR101</button>`);
  $('#sSave').onclick = async () => {
    const list = id => $(id).value.split(',').map(x => x.trim()).filter(Boolean);
    try { const j = await api('meterSettings', { settings: { owner: $('#sOwner').value.trim(), sortCommittee: list('#sSortC'), countCommittee: list('#sCntC'), warnDays: Number($('#sWarn').value), defaultSloc: $('#sDef').value, brands: list('#sBrands'),
      forms: { branch: $('#sfBranch').value, docPrefix: $('#sfDoc').value, amp: $('#sfAmp').value, prov: $('#sfProv').value, mgr: $('#sfMgr').value, head: $('#sfHead').value, addr: $('#sfAddr').value, tel: $('#sfTel').value, police: $('#sfPol').value, maker: $('#sfMaker').value } } }); DB.settings = j.settings; toast('บันทึกแล้ว', 'ok'); closeSheet(); render(); }
    catch (e) { toast(e.message, 'err'); }
  };
  $('#sZd').onclick = zdmrSheet;
}
function decodeBuf(buf) {
  const u = new Uint8Array(buf);
  if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u);
  if (u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder('utf-16be').decode(u);
  if (u.length > 3 && u[1] === 0 && u[3] === 0) return new TextDecoder('utf-16le').decode(u);
  const t = new TextDecoder('utf-8').decode(u);
  return t.includes('�') ? new TextDecoder('windows-874').decode(u) : t;
}
const ZD = { rows: [], map: JSON.parse(lsr('mt_zd_map') || 'null') };
function zdmrSheet() {
  sheet(`<button class="btn sm x" onclick="closeSheet()">ปิด</button><h2>นำเข้า ZDMR101</h2>
    <p class="muted" style="margin-top:0">Export รายงาน ZDMR101 จาก SAP เป็นไฟล์ข้อความ (.xls/.txt แบบเดียวกับ MB52) หรือ .csv แล้วเลือกไฟล์ ระบบจะเดาคอลัมน์ให้ ตรวจอีกครั้งก่อนบันทึก · ข้อมูลของคลังย่อยที่อยู่ในไฟล์จะแทนที่ของเดิม</p>
    <input type="file" id="zFile" accept=".xls,.txt,.tsv,.csv" class="inp" style="padding-top:10px">
    <details class="more"><summary>หรือวางข้อความ</summary><textarea class="inp" id="zText" placeholder="วางตารางที่คัดลอกจาก SAP/Excel"></textarea><button class="btn sm" id="zParse">อ่านข้อความ</button></details>
    <div id="zPrev"></div>`);
  $('#zFile').onchange = async () => { const f = $('#zFile').files[0]; if (f) zdmrParse(decodeBuf(await f.arrayBuffer())); };
  $('#zParse').onclick = () => zdmrParse($('#zText').value);
}
function zdmrParse(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const sep = lines.slice(0, 20).some(l => l.includes('\t')) ? '\t' : ',';
  const rows = lines.map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
  let hi = rows.findIndex(r => r.some(c => /PEA|ผลิตภัณฑ์|Serial|อุปกรณ์|Equipment/i.test(c)));
  const header = hi >= 0 ? rows[hi] : rows[0].map((_, i) => 'คอลัมน์ ' + (i + 1));
  const data = rows.slice(hi >= 0 ? hi + 1 : 0).filter(r => r.some(c => c));
  const guess = re => header.findIndex(h => re.test(h));
  const M = ZD.map && ZD.map.n === header.length ? ZD.map : {
    n: header.length, pea: guess(/PEA|เลขที่ผลิตภัณฑ์|ผลิตภัณฑ์|Serial/i), mat: guess(/Material|วัสดุ|รหัสพัสดุ/i), desc: guess(/Descr|คำอธิบาย|ข้อความ/i),
    sloc: guess(/Stor|SLoc|ที่จัดเก็บ|Loc/i), batch: guess(/Batch|แบทช์/i), status: guess(/Status|สถานะ/i)
  };
  ZD.header = header; ZD.data = data; ZD.map = M;
  const opt = (k, lab) => `<div><label class="lab" for="zm_${k}">${lab}</label><select class="inp" id="zm_${k}" data-k="${k}"><option value="-1">– ไม่มี –</option>${header.map((h, i) => `<option value="${i}"${M[k] === i ? ' selected' : ''}>${i + 1}. ${esc(h).slice(0, 30)}</option>`).join('')}</select></div>`;
  $('#zPrev').innerHTML = `<p class="muted">พบ ${data.length} แถว · ${header.length} คอลัมน์</p>
    <div class="g2">${opt('pea', 'PEA No. *')}${opt('sloc', 'คลังย่อย')}${opt('mat', 'รหัสพัสดุ')}${opt('desc', 'คำอธิบาย')}${opt('batch', 'แบทช์')}${opt('status', 'สถานะ')}</div>
    <label class="lab" for="zFixS">ถ้าไม่มีคอลัมน์คลังย่อย ให้ทุกแถวเป็นคลัง</label><select class="inp" id="zFixS">${slocOpts(DB.settings.defaultSloc || '1201')}</select>
    <div class="tbl" style="margin-top:10px"><table><thead><tr>${header.slice(0, 8).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.slice(0, 5).map(r => `<tr>${r.slice(0, 8).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <div id="zCnt" class="hint"></div>
    <button class="btn p blk" style="margin-top:12px" id="zGo">บันทึก ZDMR101</button>`;
  const recount = () => { $$('#zPrev select[data-k]').forEach(s => M[s.dataset.k] = Number(s.value)); const r = zdmrRows(); $('#zCnt').textContent = 'อ่าน PEA No. ได้ ' + r.length + ' รายการ · คลัง ' + [...new Set(r.map(x => x[3]))].join(', '); };
  $$('#zPrev select').forEach(s => s.onchange = recount); recount();
  $('#zGo').onclick = async () => {
    const r = zdmrRows(); if (!r.length) { toast('ไม่พบ PEA No. — เลือกคอลัมน์ให้ถูก', 'err'); return; }
    lsr('mt_zd_map', JSON.stringify(M));
    const b = $('#zGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span> กำลังบันทึก';
    try { const j = await api('zdmrImport', { rows: r }); toast('นำเข้า ' + j.rows + ' รายการ (คลัง ' + j.slocs.join(', ') + ')', 'ok', 4000); closeSheet(); await load(true); }
    catch (e) { toast(e.message, 'err'); b.disabled = false; b.textContent = 'บันทึก ZDMR101'; }
  };
}
function zdmrRows() {
  const M = ZD.map, g = (r, k) => M[k] >= 0 ? (r[M[k]] || '') : '';
  const fix = $('#zFixS') ? $('#zFixS').value : '1201';
  return ZD.data.map(r => [peaOf(g(r, 'pea')), g(r, 'mat'), g(r, 'desc'), pad4(g(r, 'sloc')) || fix, g(r, 'batch'), g(r, 'status')]).filter(r => r[0]).map(r => { if (!/^\d{4}$/.test(r[3])) r[3] = fix; return r; });
}

/* ================= นำทาง ================= */
function render() {
  stopCam();
  ({ intake: viewIntake, sort: viewSort, count: viewCount, ship: viewShip }[UI.tab] || viewHome)();
}
function go(t) { UI.tab = t; $$('.bnav button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); window.scrollTo(0, 0); SCAN_HANDLER = null; render(); }
$$('.bnav button').forEach(b => b.onclick = () => { if (b.dataset.t === 'ship') UI.shipSel = null; go(b.dataset.t); });
$('#reload').onclick = () => load();
$('#prnBtn').onclick = printerSheet;
window.load = load; window.closeSheet = closeSheet;
if (document.fonts && document.fonts.load) { document.fonts.load('700 20px "IBM Plex Sans Thai"'); document.fonts.load('500 20px "IBM Plex Sans Thai"'); }
const q = new URLSearchParams(location.search);
if (q.get('tab')) UI.tab = q.get('tab');
$$('.bnav button').forEach(b => b.classList.toggle('on', b.dataset.t === UI.tab));
load().then(() => { if (q.get('pea')) openMeter(q.get('pea')); });
