/**
 * ระบบตารางเวรแก้ไฟ กฟส.อ่าวลึก — Backend (Google Apps Script)
 * ส่วนที่ 1: ฐานข้อมูล + ตัวสร้างเวร + API สำหรับหน้าเว็บ (GitHub Pages)
 *
 * ไฟล์ในโปรเจกต์: Code.gs (ไฟล์นี้) · Requests.gs (เปลี่ยน/ลาเวร) · Line.gs (LINE)
 * ติดตั้ง: วางทั้ง 3 ไฟล์ใน Apps Script ที่ผูกกับ Google Sheet ใหม่ → รัน setup() ครั้งเดียว
 *        → Deploy เป็น Web app (Execute as: Me, Who has access: Anyone)
 */

const TZ = 'Asia/Bangkok';
const SH = { PEOPLE: 'People', HOL: 'Holidays', MONTHS: 'Months', CONFIG: 'Config', REQ: 'Requests', LOG: 'Log', APPR: 'Approvers' };
const TH_MONTH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_WD = ['อา','จ','อ','พ','พฤ','ศ','ส'];

/* ======================================================================
 *  ตัวสร้างเวร (ไม่แตะ Sheet — ทดสอบแยกได้)
 * ====================================================================== */

/** จำนวนวันในเดือน (m = 1..12) */
function daysInMonth_(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
/** วันในสัปดาห์ 0=อา ... 6=ส */
function weekday_(y, m, d) { return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function ymd_(y, m, d) { return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }

/**
 * สร้างตารางเวร 1 เดือน
 * @param {Object} p
 *   y, m              : ปี ค.ศ., เดือน 1..12
 *   holidays          : ['2026-11-xx', ...] วันหยุด กฟภ. (เฉพาะที่หยุดจริง)
 *   state             : สถานะต่อรอบจากเดือนก่อน
 *                       { aIdx, xIdx, prevX, wPhase:{ชื่อ:phase} }
 *   rot               : { A:[ชื่อ ช่วง1 หมุน 5], X:[ชื่อ กลุ่ม ก หมุน 4], W:[ชื่อคนงาน] }
 *   pairOffset        : 0..3 เลื่อนจุดเริ่มกลุ่ม ก (0 = ต่อรอบเดิม)
 *   quotas            : { ชื่อ: จำนวนครั้งสูงสุด } (ไม่ระบุ = หมุนตามสเต็ป)
 * @return {Object} { days:[{d,wd,off,hol}], emp:{ชื่อ:[codes...]}, wk:{ชื่อ:[code...]},
 *                    pairs:[[x,y]...], stateAfter, notes:[] }
 *   code พนักงานต่อวัน: '' | '1' | '3' | '2,3' | 'S' (เตรียมพร้อม) — ช่วง 1 กับ S ไม่ซ้อนกัน
 */
function generateMonth_(p) {
  const y = p.y, m = p.m, N = daysInMonth_(y, m);
  const A = p.rot.A, X = p.rot.X, W = p.rot.W;
  const holSet = {}; (p.holidays || []).forEach(function (s) { holSet[s] = true; });
  const quotas = p.quotas || {};
  const notes = [];

  const days = [];
  for (let d = 1; d <= N; d++) {
    const wd = weekday_(y, m, d), hol = !!holSet[ymd_(y, m, d)];
    days.push({ d: d, wd: wd, hol: hol, off: hol || wd === 0 || wd === 6 });
  }

  const emp = {}, used = {};
  A.concat(X).forEach(function (n) { emp[n] = new Array(N).fill(''); used[n] = 0; });
  const wk = {}; W.forEach(function (n) { wk[n] = new Array(N).fill(''); });

  let a = p.state.aIdx, xi = (p.state.xIdx + (p.pairOffset || 0)) % X.length, prevX = p.state.prevX;
  const pairs = [];
  const over = function (n, add) { return quotas[n] != null && quotas[n] !== '' && used[n] + add > Number(quotas[n]); };
  /** หาคนในลำดับ arr เริ่มที่ idx ที่ยังไม่เกินโควต้าและไม่อยู่ใน busy → {n, k} (k = ข้ามไปกี่คน) */
  const pick = function (arr, idx, add, busy, label, d) {
    for (let k = 0; k < arr.length; k++) {
      const n = arr[(idx + k) % arr.length];
      if (busy.indexOf(n) >= 0 || over(n, add)) continue;
      if (k > 0) notes.push('วันที่ ' + d + ' ' + label + ': ' + arr[idx % arr.length] + ' ครบโควต้า → ' + n);
      return { n: n, k: k };
    }
    notes.push('วันที่ ' + d + ' ' + label + ': ทุกคนครบโควต้า ใช้ ' + arr[idx % arr.length] + ' ตามรอบ');
    return { n: arr[idx % arr.length], k: 0 };
  };

  days.forEach(function (day, i) {
    const d = day.d, add3 = day.off ? 2 : 1;
    const p1 = pick(A, a, 1, [], 'ช่วง 1', d), s1 = p1.n;
    const yy = pick(A, a + p1.k + 1, add3, [s1], 'ช่วง 3 (กลุ่ม ข)', d).n;
    const px = pick(X, xi, add3, [], 'ช่วง 3 (กลุ่ม ก)', d), x = px.n;
    emp[s1][i] = '1'; used[s1] += 1;
    [x, yy].forEach(function (n) { emp[n][i] = day.off ? '2,3' : '3'; used[n] += add3; });
    if (prevX && emp[prevX] && emp[prevX][i] === '') emp[prevX][i] = 'S';
    pairs.push([x, yy]);
    // ข้ามคนครบโควต้า = คิวเลื่อนไปต่อจากคนที่มาแทน (แพทเทิร์นเดิม ไม่สุ่ม)
    prevX = x; a = (a + p1.k + 1) % A.length; xi = (xi + px.k + 1) % X.length;
  });

  const wPhase = {};
  W.forEach(function (n) {
    let ph = p.state.wPhase[n] || 0;
    days.forEach(function (day, i) { wk[n][i] = ['1,3', '3', '2', day.off ? '2' : '0'][ph]; ph = (ph + 1) % 4; });
    wPhase[n] = ph;
  });

  return {
    y: y, m: m, days: days, emp: emp, wk: wk, pairs: pairs, notes: notes,
    pairOffset: p.pairOffset || 0,
    stateAfter: { aIdx: a, xIdx: xi, prevX: prevX, wPhase: wPhase }
  };
}

/** นับคู่ช่วง 3 */
function countPairs_(pairs) {
  const c = {}; (pairs || []).forEach(function (pr) { const k = pr[0] + '|' + pr[1]; c[k] = (c[k] || 0) + 1; }); return c;
}

/**
 * ให้คะแนนแพทเทิร์นจับคู่ 4 แบบ เทียบกับคู่ของเดือนก่อน
 * คะแนน = จำนวนครั้งที่คู่ซ้ำ (sum min) + 100 × จำนวนวันที่เจอคู่ต้องห้าม
 */
function scorePairings_(base, prevPairs, avoid) {
  const pc = countPairs_(prevPairs);
  const av = {}; (avoid || []).forEach(function (pr) { av[pr[0] + '|' + pr[1]] = 1; av[pr[1] + '|' + pr[0]] = 1; });
  const out = [];
  for (let s = 0; s < 4; s++) {
    const g = generateMonth_(Object.assign({}, base, { pairOffset: s }));
    const c = countPairs_(g.pairs);
    let ov = 0, bad = 0;
    Object.keys(c).forEach(function (k) { ov += Math.min(c[k], pc[k] || 0); if (av[k]) bad += c[k]; });
    out.push({ offset: s, overlap: ov, avoidHits: bad, score: ov + 100 * bad, firstX: g.pairs[0][0] });
  }
  return out;
}

/* ======================================================================
 *  Google Sheets
 * ====================================================================== */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) { return ss_().getSheetByName(name); }

function toYmd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v || '').trim();
}

function readTable_(name) {
  const sh = sheet_(name); const v = sh.getDataRange().getValues();
  const head = v.shift();
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o;
  });
}

function setConfigKey_(k, val) {
  const sh = sheet_(SH.CONFIG); const v = sh.getDataRange().getValues();
  const r = v.findIndex(function (row) { return row[0] === k; });
  if (r < 0) sh.appendRow([k, val]); else sh.getRange(r + 1, 2).setValue(val);
}

/** ปรับข้อมูลครั้งเดียว (รันอัตโนมัติ): เบอร์คนงาน + เบอร์ห้องเวร */
function migrate_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIG_2610B')) return;
  const c = peopleCols_(), sh = c.sh, h = c.h, v = sh.getDataRange().getValues();
  const si = h.indexOf('short'), pi = h.indexOf('phone');
  const ph = { 'พยงค์': '0908621908', 'อาทิตย์': '0618593147', 'บุญล่อง': '0810027950', 'ย่าร้อหมาด': '0936192802' };
  sh.getRange(2, pi + 1, Math.max(v.length - 1, 1), 1).setNumberFormat('@');
  for (let i = 1; i < v.length; i++) if (ph[v[i][si]] && !String(v[i][pi] || '').trim()) sh.getRange(i + 1, pi + 1).setValue(ph[v[i][si]]);
  const cfg = getConfig_();
  if (!cfg.roomPhone) { setConfigKey_('roomPhone', "'075666918"); }
  props.setProperty('MIG_2610B', '1');
}
/** ผู้ตรวจเวร 4 คน + ตารางตรวจเดือน ต.ค. 2569 ตามคำสั่งที่ออกแล้ว + เลขที่อนุมัติตาราง ต.ค. */
function migrateInsp_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIG_INSP1')) return;
  const c = peopleCols_(), sh = c.sh, h = c.h, v = sh.getDataRange().getValues();
  const si = h.indexOf('short'), oi = h.indexOf('inspOrder'), pi = h.indexOf('inspPos');
  const want = [['มานศักดิ์', 'นายมานศักดิ์ พิลาฤทธิ์', 'หผ.ปร.กฟส.อ่าวลึก'], ['นงคราญ', 'นางสาวนงคราญ ยศศิริ', 'หผ.บง.กฟส.อ่าวลึก'],
    ['พัชรียา', 'นางสาวพัชรียา เรียงสันเทียะ', 'ชผ.บง.กฟส.อ่าวลึก'], ['นทีธร', 'นายนทีธร เชียรแก้ว', 'ชผ.บค.กฟส.อ่าวลึก']];
  want.forEach(function (w, k) {
    let r = -1; for (let i = 1; i < v.length; i++) if (v[i][si] === w[0]) { r = i; break; }
    if (r < 0) {
      const base = { group: 'INSP', rotOrder: 0, reportOrder: 50, short: w[0], full: w[1], active: true };
      const row = h.map(function (col) { return base[col] != null ? base[col] : ''; }); sh.appendRow(row); r = sh.getLastRow() - 1; v.push(row);
    }
    if (!v[r][oi]) sh.getRange(r + 1, oi + 1).setValue(k + 1);
    if (!v[r][pi]) sh.getRange(r + 1, pi + 1).setValue(w[2]);
  });
  const oct = getMonth_('2026-10');
  if (oct) {
    if (!oct.data.insp || !oct.data.insp.length) {
      const map = { 'มานศักดิ์': [1, 2, 3, 4, 5, 21, 22, 29], 'นงคราญ': [6, 7, 8, 9, 10, 23, 24, 30], 'พัชรียา': [11, 12, 13, 14, 15, 25, 26, 31], 'นทีธร': [16, 17, 18, 19, 20, 27, 28] };
      const arr = []; Object.keys(map).forEach(function (n) { map[n].forEach(function (d) { arr[d - 1] = n; }); });
      oct.data.insp = arr; oct.data.inspAfter = null;
    }
    if (!oct.data.approval || !oct.data.approval.no) oct.data.approval = { no: 'ต.2กฟส.อล.(กป.)17/2569', date: '2026-09-30' };
    if (!oct.data.inspOrderDoc) oct.data.inspOrderDoc = { no: '', date: '2026-09-30' };
    saveMonth_('2026-10', oct.status, oct.data, oct.stateAfter, oct.note);
  }
  props.setProperty('MIG_INSP1', '1');
}
/** รหัสพนักงาน + ตำแหน่ง ครบ 9 คน (ข้อมูลจาก หผ.ปร. 19 ต.ค. 69) */
function migrateEmp_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIG_EMP1')) return;
  const c = peopleCols_(), sh = c.sh, h = c.h, v = sh.getDataRange().getValues();
  const si = h.indexOf('short'), ei = h.indexOf('empId'), pi = h.indexOf('position'), ii = h.indexOf('inspPos');
  const d = { 'ธวัชชัย': ['501389', 'พชง.6 กฟส.ปลายพระยา รักษาการแทน ชผ.ปร.กฟส.อ่าวลึก'],
    'นทีธร': ['499491', 'ชผ.บค.กฟส.อ่าวลึก'], 'พุทธภงค์': ['511753', 'พชง.4 ผปร.กฟส.อ่าวลึก'],
    'กัมปนาทท์': ['513793', 'พชง.3 ผบค.กฟส.อ่าวลึก'], 'พงศธร': ['514400', 'พชง.3 ผปร.กฟส.อ่าวลึก'],
    'อติวิทย์': ['514601', 'พชง.3 ผปร.กฟส.อ่าวลึก'], 'สุรเชษฐ์': ['9008385', 'ชชค.กฟส.อ่าวลึก'] };
  sh.getRange(2, ei + 1, Math.max(v.length - 1, 1), 1).setNumberFormat('@');
  for (let i = 1; i < v.length; i++) {
    const x = d[v[i][si]]; if (!x) continue;
    sh.getRange(i + 1, ei + 1).setValue(x[0]); sh.getRange(i + 1, pi + 1).setValue(x[1]);
    if (ii >= 0 && v[i][ii] === 'ชผ.ผค.กฟส.อ่าวลึก') sh.getRange(i + 1, ii + 1).setValue('ชผ.บค.กฟส.อ่าวลึก');
  }
  props.setProperty('MIG_EMP1', '1');
}

/** คืนตาราง ต.ค. 69 ของพุทธภงค์/นทีธร (คำขอถูกลบแบบไม่คืนตาราง 22 ต.ค.) — ทำเฉพาะเมื่อช่องยังเป็นแบบที่เปลี่ยนค้างไว้ */
function fixPN2610_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FIX_PN2610')) return;
  const mo = getMonth_('2026-10'); if (!mo) return;
  const P = mo.data.emp['พุทธภงค์'], N = mo.data.emp['นทีธร'];
  if (P && N && N[2] === '2,3' && P[2] === '' && P[3] === '2,3' && N[3] === '' && N[22] === '2,3' && P[22] === '') {
    P[2] = '2,3'; N[2] = ''; N[3] = '2,3'; P[3] = ''; P[22] = '2,3'; N[22] = '';
    saveMonth_('2026-10', mo.status, mo.data, mo.stateAfter, mo.note);
    log_('system', 'คืนตารางเวร', '2026-10', 'พุทธภงค์ 3,23 ต.ค. / นทีธร 4 ต.ค. กลับเป็นแบบเดิม (คำขอถูกลบโดยไม่คืนตาราง)');
  }
  props.setProperty('FIX_PN2610', '1');
}
/** ชั่วโมงที่เหลือจนจบเวรพนักงานปัจจุบัน (08:30 / 16:30 / 00:30) */
function shiftHoursLeft_() {
  const now = new Date(), hm = Utilities.formatDate(now, TZ, 'HH:mm'), ymd = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const ends = ['00:30', '08:30', '16:30'].map(function (t) { return new Date(ymd + 'T' + t + ':00+07:00'); });
  ends.push(new Date(new Date(ymd + 'T00:30:00+07:00').getTime() + 86400000));
  const nx = ends.filter(function (d) { return d > now; })[0];
  return Math.max(0.5, (nx - now) / 3600000);
}

function getConfig_() {
  const o = {}; readTable_(SH.CONFIG).forEach(function (r) { o[r.key] = r.value; }); return o;
}

/** รายชื่อ + ลำดับหมุน */
function getPeople_() {
  const rows = readTable_(SH.PEOPLE).filter(function (r) { return r.active === true || r.active === 'TRUE' || r.active === ''; });
  const by = function (g) {
    return rows.filter(function (r) { return r.group === g; }).sort(function (a, b) { return a.rotOrder - b.rotOrder; });
  };
  const A = by('EMP_A'), X = by('EMP_X'), W = by('WK');
  const emp = A.concat(X).sort(function (a, b) { return a.reportOrder - b.reportOrder; });
  return {
    rot: { A: A.map(function (r) { return r.short; }), X: X.map(function (r) { return r.short; }), W: W.map(function (r) { return r.short; }) },
    emp: emp.map(pub_), wk: W.sort(function (a, b) { return a.reportOrder - b.reportOrder; }).map(pub_),
    quotas: rows.reduce(function (o, r) { if (r.quota !== '' && r.quota != null) o[r.short] = Number(r.quota); return o; }, {})
  };
}
function pub_(r) { return { short: r.short, full: r.full, code: r.code, group: r.group, quota: r.quota === '' ? null : r.quota, line: !!r.lineUserId }; }

function getHolidays_() {
  return readTable_(SH.HOL).map(function (r) {
    return { date: toYmd_(r.date), name: r.name, pea: r.pea === true || r.pea === 'TRUE', note: r.note || '' };
  }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}
function peaHolidaysOf_(y, m) {
  const pre = y + '-' + String(m).padStart(2, '0') + '-';
  return getHolidays_().filter(function (h) { return h.pea && h.date.indexOf(pre) === 0; }).map(function (h) { return h.date; });
}

/** คีย์เดือนจากเซลล์ (Sheets อาจแปลง "2026-10" เป็นวันที่ให้เอง) */
function mkey_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM') : String(v || '').replace(/^'/, '').trim(); }

/** Months: month | status | data(JSON) | stateAfter(JSON) | updatedAt | note */
function findMonthRow_(key) {
  const sh = sheet_(SH.MONTHS); const v = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < v.length; i++) if (mkey_(v[i][0]) === key) return i + 1;
  return 0;
}
function getMonth_(key) {
  const r = findMonthRow_(key); if (!r) return null;
  const v = sheet_(SH.MONTHS).getRange(r, 1, 1, 6).getValues()[0];
  return { month: key, status: v[1], data: JSON.parse(v[2]), stateAfter: JSON.parse(v[3]), updatedAt: v[4], note: v[5] };
}
function saveMonth_(key, status, data, stateAfter, note) {
  const sh = sheet_(SH.MONTHS);
  const row = ["'" + key, status, JSON.stringify(data), JSON.stringify(stateAfter), new Date(), note || ''];
  const r = findMonthRow_(key);
  if (r) sh.getRange(r, 1, 1, 6).setValues([row]); else sh.appendRow(row);
}
function monthKey_(y, m) { return y + '-' + String(m).padStart(2, '0'); }
function prevKey_(y, m) { return m === 1 ? monthKey_(y - 1, 12) : monthKey_(y, m - 1); }

/** เตรียมข้อมูลเพื่อสร้างเดือน key (ต้องมีเดือนก่อนหน้าในระบบ) */
function buildBase_(key) {
  const y = Number(key.slice(0, 4)), m = Number(key.slice(5, 7));
  const prev = getMonth_(prevKey_(y, m));
  if (!prev) throw new Error('ยังไม่มีตารางเดือนก่อนหน้า (' + prevKey_(y, m) + ') — ต้องสร้างตามลำดับเดือน');
  const people = getPeople_();
  const cfg = getConfig_();
  const avoid = String(cfg.avoidPairs || '').split(',').map(function (s) { return s.trim(); }).filter(String)
    .map(function (s) { return s.split('/').map(function (t) { return t.trim(); }); });
  return {
    base: { y: y, m: m, holidays: peaHolidaysOf_(y, m), state: prev.stateAfter, rot: people.rot, quotas: people.quotas },
    prevPairs: prev.data.pairs, avoid: avoid, people: people
  };
}

/** สร้าง (ยังไม่บันทึก) — pair: 'continue' | 'auto' | '0'..'3' */
function previewMonth_(key, pair) {
  const b = buildBase_(key);
  const scores = scorePairings_(b.base, b.prevPairs, b.avoid);
  let off = 0;
  if (pair === 'auto') {
    off = scores.slice().sort(function (p, q) { return p.score - q.score || p.offset - q.offset; })[0].offset;
  } else if (/^[0-3]$/.test(String(pair))) off = Number(pair);
  const g = generateMonth_(Object.assign({}, b.base, { pairOffset: off }));
  try { const y = +key.slice(0, 4), m = +key.slice(5, 7), pv = getMonth_(prevKey_(y, m)); const ig = inspGenerate_(y, m, pv && pv.data); g.insp = ig.insp; g.inspAfter = ig.inspAfter; } catch (e) {}
  return { month: key, gen: g, scores: scores, people: b.people };
}

/* ======================================================================
 *  สิทธิ์ผู้อนุมัติ (PIN รายคน ในชีต Approvers)
 * ====================================================================== */

function approverByPin_(pin) {
  if (pin == null || String(pin) === '') return null;
  const rows = readTable_(SH.APPR);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i].pin) === String(pin) && rows[i].active !== false && rows[i].active !== 'FALSE')
      return { name: rows[i].name, role: rows[i].role, short: rows[i].short };
  }
  const admin = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (admin && String(pin) === String(admin)) return { name: 'ผู้ดูแลระบบ', role: 'admin', short: '' };
  return null;
}
function approverList_() {
  return readTable_(SH.APPR).filter(function (r) { return r.active !== false && r.active !== 'FALSE'; })
    .map(function (r) { return { name: r.name, role: r.role, short: r.short }; });
}

function log_(actor, action, month, detail) {
  sheet_(SH.LOG).appendRow([new Date(), actor, action, month ? "'" + month : '', typeof detail === 'string' ? detail : JSON.stringify(detail)]);
}

/* ======================================================================
 *  API
 * ====================================================================== */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function monthList_() {
  const sh = sheet_(SH.MONTHS);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(function (r) { return r[0]; }).map(function (r) { return { month: mkey_(r[0]), status: r[1] }; });
}

function doGet(e) {
  try {
    const q = e.parameter || {}, a = q.action || 'bootstrap';
    if (a === 'bootstrap') {
      try { migrateInsp_(); migrateEmp_(); migrateOut_(); fixPN2610_(); } catch (e) {}
      const cfg = getConfig_();
      delete cfg.lineRegCode;
      return json_({ ok: true, config: cfg, people: getPeople_(), holidays: getHolidays_(), months: monthList_(),
        approvers: approverList_(), pendingCount: listRequests_().pending.length, inspectors: (function () { try { return inspectors_(); } catch (e) { return []; } })() });
    }
    if (a === 'month') { try { ensureInsp_(q.m); } catch (e) {} return json_({ ok: true, month: getMonth_(q.m) }); }
    if (a === 'reports') return json_({ ok: true, reports: reportsOf_(q.m) });
    if (a === 'inspectors') return json_({ ok: true, inspectors: inspectors_() });
    if (a === 'preview') return json_({ ok: true, preview: previewMonth_(q.m, q.pair || 'continue') });
    if (a === 'requests') return json_({ ok: true, requests: listRequests_() });
    if (a === 'monthReqs') return json_({ ok: true, requests: monthRequests_(q.m) });
    if (a === 'wx') return json_({ ok: true, wx: wxNow_() });
    if (a === 'outages') return json_({ ok: true, outages: outagesOf_(q.m) });
    if (a === 'sldPing') { const x = sldSS_(), f = x.getSheetByName('PatrolFinding'); return json_({ ok: true, sheet: x.getName(), patrol: !!f }); }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  let b;
  try { b = JSON.parse((e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (b.events) return lineWebhook_(b);            // มาจาก LINE
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    try { migrate_(); migrateInsp_(); migrateEmp_(); migrateOut_(); } catch (e) { log_('system', 'migrate error', '', String(e)); }
    // ---- เบอร์ติดต่อ: ต้องเป็นผู้ใช้ศูนย์รวมงานที่มีสิทธิ์ (ไม่ใช้ PIN) ----
    if (b.action === 'contacts') return json_(contactsFor_(b.user, b.pass));
    // ---- รายงานเวร: ลิงก์มีลายเซ็นจาก LINE หรือ PIN ผู้อนุมัติ ----
    if (b.action === 'saveReport') return json_({ ok: true, report: saveReport_(b) });
    if (b.action === 'saveOutage') return json_({ ok: true, outage: saveOutage_(b) });
    if (b.action === 'deleteOutage') return json_({ ok: true, result: deleteOutage_(b) });
    if (b.action === 'saveOutMats') return json_({ ok: true, mats: saveOutMats_(b) });
    // ---- ไม่ต้องใช้ PIN: ยื่นคำขอ ----
    if (b.action === 'request' && !b.approveNow) {
      return json_({ ok: true, request: createRequest_(b, null) });
    }
    // ---- ต้องเป็นผู้อนุมัติ ----
    const who = approverByPin_(b.pin);
    if (!who) return json_({ ok: false, error: 'PIN ไม่ถูกต้อง' });

    if (b.action === 'request') return json_({ ok: true, request: createRequest_(b, who) });
    if (b.action === 'decide') return json_({ ok: true, request: decideRequest_(b.id, !!b.approve, who, b.note || '') });
    if (b.action === 'checkPin') return json_({ ok: true, who: who });
    if (b.action === 'deleteRequest') return json_({ ok: true, result: deleteRequest_(b.id, !!b.revert, who) });
    if (b.action === 'editRequest') return json_({ ok: true, request: editRequest_(b, who) });

    if (b.action === 'generate') {
      const cur = getMonth_(b.m);
      if (cur && cur.status === 'อนุมัติแล้ว' && !b.force) return json_({ ok: false, error: 'เดือนนี้อนุมัติแล้ว — ถ้าจะสร้างใหม่ต้องยืนยันอีกครั้ง' });
      const pv = previewMonth_(b.m, b.pair || 'continue');
      pv.gen.rev = 0; pv.gen.changes = [];
      saveMonth_(b.m, 'ร่าง', pv.gen, pv.gen.stateAfter, 'pair=' + pv.gen.pairOffset);
      log_(who.name, 'สร้างตาราง', b.m, 'pair=' + pv.gen.pairOffset + (pv.gen.notes.length ? ' | ' + pv.gen.notes.join('; ') : ''));
      return json_({ ok: true, month: getMonth_(b.m) });
    }
    if (b.action === 'setStatus') {
      const cur = getMonth_(b.m); if (!cur) return json_({ ok: false, error: 'ไม่พบเดือน' });
      saveMonth_(b.m, b.status, cur.data, cur.stateAfter, cur.note);
      log_(who.name, 'สถานะ ' + b.status, b.m, '');
      return json_({ ok: true });
    }
    if (b.action === 'setInsp') {                     // เปลี่ยนผู้ตรวจเวรรายวัน
      const mo = ensureInsp_(b.m); if (!mo) return json_({ ok: false, error: 'ไม่พบเดือน' });
      mo.data.insp[Number(b.day) - 1] = String(b.short || '');
      saveMonth_(b.m, mo.status, mo.data, mo.stateAfter, mo.note);
      log_(who.name, 'เปลี่ยนผู้ตรวจเวร', b.m, b.day + ' → ' + b.short);
      return json_({ ok: true, month: getMonth_(b.m) });
    }
    if (b.action === 'saveInspectors') {              // [{short?, full, pos}] ตามลำดับ — คนที่ไม่อยู่ในรายการ = เลิกเป็นผู้ตรวจ
      const c = peopleCols_(), sh = c.sh, h = c.h, v = sh.getDataRange().getValues();
      const si = h.indexOf('short'), fi = h.indexOf('full'), oi = h.indexOf('inspOrder'), pi = h.indexOf('inspPos'), gi = h.indexOf('group'), ai = h.indexOf('active');
      const list = b.inspectors || [];
      for (let i = 1; i < v.length; i++) { sh.getRange(i + 1, oi + 1).setValue(''); }
      list.forEach(function (x, k) {
        const full = String(x.full || '').replace(/\s+/g, ' ').trim(); if (!full) return;
        let r = -1;
        for (let i = 1; i < v.length; i++) if ((x.short && v[i][si] === x.short) || String(v[i][fi]).replace(/\s+/g, ' ').trim() === full) { r = i; break; }
        if (r < 0) {
          const short = x.short || full.replace(/^(นาย|นางสาว|นาง)/, '').split(' ')[0];
          const row = h.map(function (col) { return ({ group: 'INSP', rotOrder: 0, reportOrder: 50, short: short, full: full, active: true })[col] != null ? ({ group: 'INSP', rotOrder: 0, reportOrder: 50, short: short, full: full, active: true })[col] : ''; });
          sh.appendRow(row); r = sh.getLastRow() - 1; v.push(row);
        }
        sh.getRange(r + 1, oi + 1).setValue(k + 1); sh.getRange(r + 1, pi + 1).setValue(String(x.pos || ''));
      });
      log_(who.name, 'แก้รายชื่อผู้ตรวจเวร', '', list.map(function (x) { return x.full; }).join(', '));
      return json_({ ok: true, inspectors: inspectors_() });
    }
    if (b.action === 'setInspOrder') {                // เลขที่/วันที่คำสั่งแต่งตั้งผู้ตรวจเวร
      const mo = ensureInsp_(b.m); if (!mo) return json_({ ok: false, error: 'ไม่พบเดือน' });
      mo.data.inspOrderDoc = { no: String(b.no || '').trim(), date: String(b.date || '').trim() };
      saveMonth_(b.m, mo.status, mo.data, mo.stateAfter, mo.note);
      return json_({ ok: true, month: getMonth_(b.m) });
    }
    if (b.action === 'setWx') {                       // ตั้งระดับสภาพอากาศเอง (null = อัตโนมัติ)
      let hrs = b.dur === 'forever' ? 0 : b.dur === 'shift' ? shiftHoursLeft_() : Number(getConfig_().wxManualHours || 6);
      setWxOverride_(b.lv == null ? null : Number(b.lv), who.short || who.name, hrs, b.note || '');
      return json_({ ok: true, wx: wxNow_() });
    }
    if (b.action === 'setApproval') {                 // เลขที่/วันที่หนังสืออนุมัติตารางประจำเดือน (ใช้ในบันทึกลาเวร)
      const cur = getMonth_(b.m); if (!cur) return json_({ ok: false, error: 'ไม่พบเดือน' });
      cur.data.approval = { no: String(b.no || '').trim(), date: String(b.date || '').trim() };
      saveMonth_(b.m, cur.status, cur.data, cur.stateAfter, cur.note);
      log_(who.name, 'เลขที่อนุมัติตาราง', b.m, cur.data.approval);
      return json_({ ok: true, month: getMonth_(b.m) });
    }
    if (b.action === 'saveHolidays') {
      const sh = sheet_(SH.HOL); if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
      const rows = (b.holidays || []).map(function (h) { return [h.date, h.name, !!h.pea, h.note || '']; });
      if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
      log_(who.name, 'แก้วันหยุด', '', rows.length + ' วัน');
      return json_({ ok: true, holidays: getHolidays_() });
    }
    if (b.action === 'saveQuotas') {
      const sh = sheet_(SH.PEOPLE); const v = sh.getDataRange().getValues(); const h = v[0];
      const ci = h.indexOf('short'), qi = h.indexOf('quota');
      for (let i = 1; i < v.length; i++) {
        const n = v[i][ci]; if (n in (b.quotas || {})) sh.getRange(i + 1, qi + 1).setValue(b.quotas[n] === null ? '' : b.quotas[n]);
      }
      log_(who.name, 'แก้โควต้า', '', b.quotas);
      return json_({ ok: true, people: getPeople_() });
    }
    if (b.action === 'saveContacts') {
      saveContacts_(b.contacts || {});
      log_(who.name, 'แก้เบอร์ติดต่อ', '', Object.keys(b.contacts || {}).length + ' คน');
      return json_({ ok: true });
    }
    if (b.action === 'saveConfig') {
      const sh = sheet_(SH.CONFIG); const v = sh.getDataRange().getValues();
      Object.keys(b.config || {}).forEach(function (k) {
        if (['avoidPairs', 'notifyStandby'].indexOf(k) < 0) return;   // แก้จากหน้าเว็บได้เฉพาะคีย์เหล่านี้
        const r = v.findIndex(function (row) { return row[0] === k; });
        if (r < 0) sh.appendRow([k, b.config[k]]); else sh.getRange(r + 1, 2).setValue(b.config[k]);
      });
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) });
  } finally { lock.releaseLock(); }
}

/* ======================================================================
 *  setup() — รันครั้งเดียว (รันซ้ำได้: ไม่ลบข้อมูลที่มีอยู่ เติมเฉพาะชีตที่ยังไม่มี)
 * ====================================================================== */

function setup() {
  const ss = ss_();
  const rnd = function () { return String(1000 + Math.floor(Math.random() * 9000)); };   // PIN/รหัสสุ่ม — ดูได้ในชีต Approvers / Config
  const mk = function (name, head, rows) {
    let sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 0) return sh;                 // มีอยู่แล้ว — ไม่แตะ
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1);
    if (rows && rows.length) sh.getRange(2, 1, rows.length, head.length).setValues(rows);
    return sh;
  };

  mk(SH.PEOPLE, ['group', 'rotOrder', 'reportOrder', 'short', 'full', 'code', 'quota', 'lineUserId', 'phone', 'active'], [
    ['EMP_X', 4, 1, 'นทีธร', 'นายนทีธร เชียรแก้ว', '', '', '', '', true],
    ['EMP_X', 1, 2, 'ธวัชชัย', 'นายธวัชชัย ไหมสุข', '', '', '', '', true],
    ['EMP_X', 2, 3, 'กลวัชร', 'นายกลวัชร บุญช่วย', '', '', '', '', true],
    ['EMP_X', 3, 4, 'พุทธภงค์', 'นายพุทธภงค์ เมืองด้วง', '', '', '', '', true],
    ['EMP_A', 1, 5, 'กัมปนาทท์', 'นายกัมปนาทท์ เกลาจีน', '', '', '', '', true],
    ['EMP_A', 2, 6, 'พงศธร', 'นายพงศธร เกตุมณี', '', '', '', '', true],
    ['EMP_A', 3, 7, 'อติวิทย์', 'นายอติวิทย์ ทองลา', '', '', '', '', true],
    ['EMP_A', 4, 8, 'สุรเชษฐ์', 'นายสุรเชษฐ์ นาคะเกษม', '', '', '', '', true],
    ['EMP_A', 5, 9, 'ราชภัฎ', 'นายราชภัฎ จันทร์ชู', '', '', '', '', true],
    ['WK', 1, 1, 'พยงค์', 'นายพยงค์  บุญแก้ว', '2', '', '', '', true],
    ['WK', 2, 2, 'อาทิตย์', 'นายอาทิตย์  หมันการ', '3', '', '', '', true],
    ['WK', 3, 3, 'ย่าร้อหมาด', 'นายย่าร้อหมาด  ดำเชื้อ', '2', '', '', '', true],
    ['WK', 4, 4, 'บุญล่อง', 'นายบุญล่อง  คงชนะ', '3', '', '', '', true],
    ['BOSS', 0, 0, 'มานศักดิ์', 'นายมานศักดิ์ พิลาฤทธิ์', '', '', '', '', true]
  ]);

  const hol = mk(SH.HOL, ['date', 'name', 'pea', 'note'], [
    ['2026-01-01', 'วันขึ้นปีใหม่', true, ''], ['2026-01-02', 'วันหยุดพิเศษ', true, ''],
    ['2026-03-03', 'วันมาฆบูชา', true, ''], ['2026-04-06', 'วันจักรี', true, ''],
    ['2026-04-13', 'วันสงกรานต์', true, ''], ['2026-04-14', 'วันสงกรานต์', true, ''], ['2026-04-15', 'วันสงกรานต์', true, ''],
    ['2026-05-01', 'วันแรงงานแห่งชาติ', true, ''], ['2026-05-04', 'วันฉัตรมงคล', true, ''],
    ['2026-05-13', 'วันพืชมงคล', false, 'เฉพาะหน่วยราชการ — ตรวจสอบ'],
    ['2026-06-01', 'ชดเชยวันวิสาขบูชา', true, ''], ['2026-06-03', 'วันเฉลิมพระชนมพรรษา พระราชินี', true, ''],
    ['2026-07-28', 'วันเฉลิมพระชนมพรรษา ร.10', true, ''], ['2026-07-29', 'วันอาสาฬหบูชา', true, ''],
    ['2026-07-30', 'วันเข้าพรรษา', false, 'เฉพาะหน่วยราชการ — ตรวจสอบ'],
    ['2026-08-12', 'วันแม่แห่งชาติ', true, ''], ['2026-10-13', 'วันนวมินทรมหาราช', true, ''],
    ['2026-10-16', 'วันหยุดพิเศษ (ครม.)', false, 'เฉพาะหน่วยราชการ — กฟภ. ไม่หยุด'],
    ['2026-10-23', 'วันปิยมหาราช', true, ''], ['2026-12-05', 'วันพ่อแห่งชาติ', true, 'ตรงวันเสาร์'],
    ['2026-12-07', 'ชดเชยวันพ่อแห่งชาติ', true, ''], ['2026-12-10', 'วันรัฐธรรมนูญ', true, ''],
    ['2026-12-31', 'วันสิ้นปี', true, '']
  ]);
  hol.getRange('A:A').setNumberFormat('@');

  mk(SH.CONFIG, ['key', 'value'], [
    ['office', 'กฟส.อ่าวลึก'], ['headTitle', 'หผ.ปร.กฟส.อ่าวลึก'], ['headName', 'นายมานศักดิ์ พิลาฤทธิ์'],
    ['mgrTitle', 'ผจก.กฟส.อ่าวลึก'], ['mgrName', 'นายชญานิน งานสัมพันธฤทธิ์'],
    ['docNo', 'ต.2 กฟส.อล.(ปร.)'], ['ccTo', 'เรียน ผจก.กฟจ.กระบี่,หผ.ทุกแผนก'],
    ['avoidPairs', ''],
    ['webUrl', 'https://YOUR-GITHUB-NAME.github.io/duty-roster/'],
    ['lineRegCode', rnd()], ['lineMonthlyLimit', 300], ['notifyStandby', false]
  ]);

  mk(SH.APPR, ['name', 'role', 'short', 'pin', 'active'], [
    ['นายมานศักดิ์ พิลาฤทธิ์', 'หผ.ปร.', 'มานศักดิ์', rnd(), true],
    ['นายธวัชชัย ไหมสุข', 'ชผ. (รักษาการแทน หผ.ปร.)', 'ธวัชชัย', rnd(), true]
  ]);
  sheet_(SH.APPR).getRange('D:D').setNumberFormat('@');

  mk(SH.REQ, ['id', 'createdAt', 'month', 'type', 'payload', 'requester', 'reason', 'status', 'decidedBy', 'decidedAt', 'note', 'text']);
  mk(SH.LOG, ['time', 'actor', 'action', 'month', 'detail']);

  const months = mk(SH.MONTHS, ['month', 'status', 'data', 'stateAfter', 'updatedAt', 'note']);
  if (months.getLastRow() < 2) {
    // ตาราง ต.ค. 2569 สร้างจากสถานะสิ้นเดือน ก.ย. 2569 (ตรวจกับไฟล์จริงแล้ว)
    const people = getPeople_();
    const oct = generateMonth_({
      y: 2026, m: 10, holidays: ['2026-10-13', '2026-10-23'], rot: people.rot, quotas: {}, pairOffset: 0,
      state: { aIdx: 4, xIdx: 0, prevX: 'นทีธร', wPhase: { 'พยงค์': 1, 'อาทิตย์': 0, 'ย่าร้อหมาด': 3, 'บุญล่อง': 2 } }
    });
    oct.rev = 0; oct.changes = [];
    saveMonth_('2026-10', 'อนุมัติแล้ว', oct, oct.stateAfter, 'นำเข้าจากไฟล์เดิม');
  }
  Logger.log('setup เสร็จ — PIN ผู้อนุมัติอยู่ในชีต Approvers · รหัสลงทะเบียน LINE (lineRegCode) อยู่ในชีต Config');
}

/* ======================================================================
 *  เบอร์ติดต่อ (โทรศัพท์ / LINE ID) — ส่งให้เฉพาะผู้ใช้ศูนย์รวมงานที่มีสิทธิ์ใช้ตารางเวร
 * ====================================================================== */

const HUB_API_DEFAULT = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';

/** ตรวจชื่อ/รหัสกับศูนย์รวมงาน (จำผล 6 ชม.) */
function hubAllowed_(user, pass) {
  if (!user || !pass) return false;
  const key = 'hub_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, user + '\u0001' + pass));
  const cache = CacheService.getScriptCache(), hit = cache.get(key);
  if (hit) return hit === '1';
  let ok = false;
  try {
    const url = String(getConfig_().hubApi || HUB_API_DEFAULT);
    const res = UrlFetchApp.fetch(url, { method: 'post', contentType: 'text/plain;charset=utf-8', muteHttpExceptions: true,
      payload: JSON.stringify({ action: 'whoAmI', changedBy: user, changedByPassword: pass }) });
    const r = JSON.parse(res.getContentText());
    ok = !!(r && r.role && (r.role === 'admin' || !Array.isArray(r.apps) || r.apps.indexOf('dutyroster') >= 0));
  } catch (e) { return false; }                         // ตรวจไม่ได้ = ไม่ให้ (ไม่จำผล)
  cache.put(key, ok ? '1' : '0', ok ? 21600 : 300);
  return ok;
}

function peopleCols_() {
  const sh = sheet_(SH.PEOPLE); const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  let added = false;
  ['lineId', 'empId', 'position', 'inspOrder', 'inspPos'].forEach(function (k) {
    if (h.indexOf(k) < 0) { sh.getRange(1, h.length + 1).setValue(k).setFontWeight('bold'); h.push(k); added = added || k !== 'lineId'; }
  });
  if (added) {                                              // ค่าตั้งต้นจากเอกสารจริง (แก้ได้ที่หน้าตั้งค่า)
    const seed = { 'ราชภัฎ': ['515597', 'พชง.3 ผบค.กฟส.อ่าวลึก'], 'กลวัชร': ['509913', 'พชง.5 ผบค.กฟส.อ่าวลึก'],
      'ธวัชชัย': ['', 'พชง.6 กฟส.ปพย. รักษาการแทน ชผ.ปร.กฟส.อล.'] };
    const v = sh.getDataRange().getValues(), si = h.indexOf('short'), ei = h.indexOf('empId'), pi = h.indexOf('position');
    sh.getRange(2, ei + 1, Math.max(v.length - 1, 1), 1).setNumberFormat('@');
    for (let i = 1; i < v.length; i++) {
      const x = seed[v[i][si]]; if (!x) continue;
      if (!v[i][ei] && x[0]) sh.getRange(i + 1, ei + 1).setValue(x[0]);
      if (!v[i][pi] && x[1]) sh.getRange(i + 1, pi + 1).setValue(x[1]);
    }
  }
  return { sh: sh, h: h };
}

function contactsFor_(user, pass) {
  if (!hubAllowed_(user, pass)) return { ok: false, error: 'ต้องล็อกอินศูนย์รวมงานและมีสิทธิ์ใช้ตารางเวร' };
  peopleCols_();
  const out = {};
  readTable_(SH.PEOPLE).forEach(function (r) {
    let ph = String(r.phone || '').replace(/[^0-9+]/g, '');
    if (/^[1-9]\d{8}$/.test(ph)) ph = '0' + ph;               // Sheets ตัด 0 หน้าเบอร์มือถือ
    out[r.short] = { phone: ph, lineId: String(r.lineId || '').trim().replace(/^@/, ''),
      empId: String(r.empId == null ? '' : r.empId).trim(), position: String(r.position || '').trim() };
  });
  return { ok: true, contacts: out };
}

/** contacts: { short: { phone, lineId, empId?, position? } } */
function saveContacts_(contacts) {
  const c = peopleCols_(), sh = c.sh, h = c.h;
  const v = sh.getDataRange().getValues();
  const si = h.indexOf('short'), pi = h.indexOf('phone'), li = h.indexOf('lineId'), ei = h.indexOf('empId'), oi = h.indexOf('position');
  sh.getRange(2, pi + 1, Math.max(v.length - 1, 1), 1).setNumberFormat('@');
  sh.getRange(2, ei + 1, Math.max(v.length - 1, 1), 1).setNumberFormat('@');
  for (let i = 1; i < v.length; i++) {
    const x = contacts[v[i][si]]; if (!x) continue;
    if ('phone' in x) sh.getRange(i + 1, pi + 1).setValue(String(x.phone || '').replace(/[^0-9+]/g, ''));
    if ('lineId' in x) sh.getRange(i + 1, li + 1).setValue(String(x.lineId || '').trim());
    if ('empId' in x) sh.getRange(i + 1, ei + 1).setValue(String(x.empId || '').replace(/[^0-9]/g, ''));
    if ('position' in x) sh.getRange(i + 1, oi + 1).setValue(String(x.position || '').trim());
  }
}
