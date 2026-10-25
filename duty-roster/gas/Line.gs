/**
 * Line.gs — LINE Official Account
 *  - พนักงาน: แจ้งรายคนก่อนเข้าเวร 5 นาที (00:25 ทุกวัน · 16:25 ทุกวัน · 08:25 วันหยุด)
 *  - คนงาน: ส่งสรุปรายสัปดาห์เข้ากลุ่มคนงานทุกวันจันทร์ 07:55 · พิมพ์ "เวรคนงาน" ดูวันนี้ (ฟรี)
 *  - คำสั่งในแชต (ตอบกลับฟรี ไม่นับโควต้า): เวรวันนี้ / เวรพรุ่งนี้ / เวรของฉัน / ขอเปลี่ยน/ลาเวร / ตารางเดือนนี้
 *  - ลงทะเบียน: พิมพ์  ลงทะเบียน ชื่อเล่นในระบบ รหัส   เช่น  ลงทะเบียน พงศธร 5678
 *
 * ตั้งค่า: Script properties → LINE_TOKEN = Channel access token (long-lived)
 *        รัน installTriggers() ครั้งเดียว
 */

const SLOT_DEF = {
  emp1:   { hm: '00:25', title: 'ช่วง 1 · เข้าเวร 00:30 น.', color: '#26307A' },        // ทุกวัน
  wkweek: { hm: '07:55', title: 'คนงานประจำเวร รายสัปดาห์', color: '#B4570B', wd: 1 },  // จันทร์ → กลุ่มคนงาน
  emp2:   { hm: '08:25', title: 'ช่วง 2 · เข้าเวร 08:30 น.', color: '#B4570B', off: true }, // วันหยุด
  emp3:   { hm: '16:25', title: 'ช่วง 3 · เข้าเวร 16:30 น.', color: '#5B1A63' }         // ทุกวัน (วันหยุด = ช่วงต่อจากช่วง 2)
};
const OFFICE_TITLE_ = 'พนักงานประจำเวรแก้กระแสไฟฟ้าขัดข้อง กฟส.อ่าวลึก';

/* ------------------------- เวลา/วันที่ ------------------------- */
function bkkYmd_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd'); }
function addDays_(ymd, n) {
  const d = new Date(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}
function thDateLong_(ymd) {
  const wd = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'][weekday_(+ymd.slice(0, 4), +ymd.slice(5, 7), +ymd.slice(8, 10))];
  return wd + ' ' + (+ymd.slice(8, 10)) + ' ' + ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'][+ymd.slice(5, 7) - 1] + ' ' + (+ymd.slice(0, 4) + 543);
}

/** ข้อมูลเวรของวัน ymd: { day, emp:{ชื่อ:code}, wk:{ชื่อ:code} } หรือ null */
function dayData_(ymd) {
  const mo = getMonth_(ymd.slice(0, 7)); if (!mo) return null;
  const i = +ymd.slice(8, 10) - 1, d = mo.data, e = {}, w = {};
  Object.keys(d.emp).forEach(function (n) { e[n] = d.emp[n][i]; });
  Object.keys(d.wk).forEach(function (n) { w[n] = d.wk[n][i]; });
  return { day: d.days[i], emp: e, wk: w, status: mo.status };
}
/** รายชื่อที่ตรงเงื่อนไข เรียงตำแหน่งสูงก่อน (ตาม reportOrder ในชีต People) */
function who_(map, test) {
  const rank = rankMap_();
  return Object.keys(map).filter(function (n) { return test(map[n]); })
    .sort(function (a, b) { return (rank[a] == null ? 999 : rank[a]) - (rank[b] == null ? 999 : rank[b]); });
}
let RANK_CACHE_ = null;
function rankMap_() {
  if (RANK_CACHE_) return RANK_CACHE_;
  const o = {}; readTable_(SH.PEOPLE).forEach(function (r) { o[r.short] = (r.group === 'WK' ? 100 : 0) + Number(r.reportOrder || 0); });
  return (RANK_CACHE_ = o);
}

/** ผู้รับของแต่ละ slot (พนักงานรายคน) */
function slotRecipients_(kind, dd, cfg) {
  const e = dd.emp;
  if (kind === 'emp1') {
    const r = who_(e, function (c) { return cHas_(c, '1'); });
    return String(cfg.notifyStandby) === 'true' ? r.concat(who_(e, function (c) { return c === 'S'; })) : r;
  }
  if (kind === 'emp2') return dd.day.off ? who_(e, function (c) { return cHas_(c, '2') && !cHas_(c, '1'); }) : [];   // 1+2+3 อยู่ต่อจากช่วง 1 ไม่ต้องแจ้งซ้ำ
  if (kind === 'emp3') return who_(e, function (c) { return cHas_(c, '3') && !(cHas_(c, '1') && cHas_(c, '2')); });
  return [];
}

/* ------------------------- ข้อความ ------------------------- */
const TH_MONTH_FULL_ = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const TH_MS_ = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function thFull_(ymd) { return (+ymd.slice(8, 10)) + ' ' + TH_MONTH_FULL_[+ymd.slice(5, 7) - 1] + ' ' + (+ymd.slice(0, 4) + 543); }
function thShortD_(ymd) { return (+ymd.slice(8, 10)) + ' ' + TH_MS_[+ymd.slice(5, 7) - 1]; }

function summaryLines_(dd) {
  const e = dd.emp, w = dd.wk, j = function (a) { return a.length ? a.join(', ') : '—'; };
  const L = [];
  L.push('พนักงาน');
  L.push('ช่วง 1: ' + j(who_(e, function (c) { return cHas_(c, '1'); })));
  if (dd.day.off) L.push('ช่วง 2: ' + j(who_(e, function (c) { return cHas_(c, '2'); })));
  L.push('ช่วง 3: ' + j(who_(e, function (c) { return cHas_(c, '3'); })));
  L.push('เตรียมพร้อม: ' + j(who_(e, function (c) { return c === 'S'; })));
  L.push('คนงาน');
  L.push('กะ 1: ' + j(who_(w, function (c) { return c.split(',').indexOf('1') >= 0; })));
  L.push('กะ 2: ' + j(who_(w, function (c) { return c === '2'; })));
  L.push('กะ 3: ' + j(who_(w, function (c) { return c.split(',').indexOf('3') >= 0; })));
  L.push('พักกะ: ' + j(who_(w, function (c) { return c === '0'; })));
  return L;
}

function bubble_(head, color, title, lines, buttons) {
  const body = lines.map(function (t, i) {
    return { type: 'text', text: String(t), wrap: true, size: i === 0 ? 'md' : 'sm', weight: i === 0 ? 'bold' : 'regular', color: i === 0 ? '#1E1A22' : '#4A4450' };
  });
  const b = {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: color, paddingAll: '12px', contents: [
      { type: 'text', text: head, size: 'xs', color: '#FFFFFFCC' },
      { type: 'text', text: title, size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true }] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: body }
  };
  if (buttons && buttons.length) b.footer = { type: 'box', layout: 'horizontal', spacing: 'sm', contents: buttons };
  return b;
}
function flex_(alt, bubble) { return { type: 'flex', altText: alt, contents: bubble }; }
function webUrl_(view, extra) {
  const u = String(getConfig_().webUrl || '');
  if (!/^https:\/\//.test(u)) return null;
  const q = [];
  if (view) q.push('view=' + view);
  Object.keys(extra || {}).forEach(function (k) { q.push(k + '=' + encodeURIComponent(extra[k])); });
  return u + (q.length ? (u.indexOf('?') < 0 ? '?' : '&') + q.join('&') : '');
}

/* ---- เบอร์โทร ---- */
function digits_(p) { let d = String(p || '').replace(/[^0-9]/g, ''); if (/^[1-9]\d{8}$/.test(d) && d.charAt(0) !== '7') d = '0' + d; if (/^7\d{7}$/.test(d)) d = '0' + d; return d; }
function fmtPhone_(p) {
  const d = digits_(p);
  if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
  if (d.length === 9) return d.slice(0, 3) + '-' + d.slice(3);
  return d;
}
function telBtn_(label, phone, primary) {
  const d = digits_(phone); if (!d) return null;
  return { type: 'button', style: primary ? 'primary' : 'secondary', color: primary ? '#1F7A3A' : undefined, height: 'sm',
    action: { type: 'uri', label: label.slice(0, 40), uri: 'tel:' + d } };
}
function personOf_(short) {
  const r = peopleRows_().filter(function (p) { return p.short === short; })[0] || {};
  return { short: short, full: String(r.full || short).replace(/\s+/g, ' ').trim(), phone: r.phone || '', lineUserId: r.lineUserId || '' };
}

/* ---- ช่วงเข้า–ออกเวรต่อเนื่องของพนักงาน (ช่วง 3 ต่อช่วง 1 วันรุ่งขึ้น = ออก 08:30) ---- */
function empCode_(ymd, n) { const dd = dayData_(ymd); return dd && dd.emp[n] != null ? dd.emp[n] : ''; }
function empBlock_(ymd, n, kind) {
  // ช่วงของวัน (นาทีนับจาก 00:00 ของวันนั้น): 1 = 00:30–08:30 · 2 = 08:30–16:30 · 3 = 16:30–24:30 → ต่อกันเป็นช่วงเวรยาว
  const SEG = { '1': [30, 510], '2': [510, 990], '3': [990, 1470] }, iv = [];
  [-1, 0, 1].forEach(function (off) {
    const d = addDays_(ymd, off), c = empCode_(d, n);
    ['1', '2', '3'].forEach(function (p) { if (cHas_(c, p)) iv.push([off * 1440 + SEG[p][0], off * 1440 + SEG[p][1]]); });
  });
  if (!iv.length) return null;
  iv.sort(function (a, b) { return a[0] - b[0]; });
  const blocks = []; iv.forEach(function (x) { const l = blocks[blocks.length - 1]; if (l && x[0] <= l[1]) l[1] = Math.max(l[1], x[1]); else blocks.push(x.slice()); });
  const c = empCode_(ymd, n), want = kind === 'emp1' ? '1' : kind === 'emp2' ? '2' : kind === 'emp3' ? '3' : (['1', '2', '3'].filter(function (p) { return cHas_(c, p); })[0]);
  if (!want || !cHas_(c, want)) return null;
  const t0 = SEG[want][0], b = blocks.filter(function (x) { return x[0] <= t0 && t0 < x[1]; })[0]; if (!b) return null;
  const at = function (m) { const off = Math.floor(m / 1440), mm = m - off * 1440; return { d: addDays_(ymd, off), t: ('0' + Math.floor(mm / 60)).slice(-2) + ':' + ('0' + mm % 60).slice(-2) }; };
  const a = at(b[0]), z = at(b[1]);
  return { inD: a.d, inT: a.t, outD: z.d, outT: z.t };
}
/** ทีมที่อยู่ในการแจ้งรอบนั้น */
function teamOf_(kind, dd) {
  const e = dd.emp;
  if (kind === 'emp1') return who_(e, function (c) { return cHas_(c, '1'); });
  if (kind === 'emp2') return who_(e, function (c) { return cHas_(c, '2'); });
  return who_(e, function (c) { return cHas_(c, '3'); });
}

/* ---- สภาพอากาศ (Open-Meteo ฟรี ไม่ต้องใช้คีย์) + ระดับ 1–6 ---- */
const WX_TH_ = { 0: 'ท้องฟ้าแจ่มใส', 1: 'มีเมฆบางส่วน', 2: 'มีเมฆบางส่วน', 3: 'มีเมฆมาก', 45: 'มีหมอก', 48: 'มีหมอก',
  51: 'ฝนปรอย', 53: 'ฝนปรอย', 55: 'ฝนปรอย', 56: 'ฝนปรอย', 57: 'ฝนปรอย', 61: 'ฝนตกเล็กน้อย', 63: 'ฝนตกปานกลาง', 65: 'ฝนตกหนัก',
  66: 'ฝนตก', 67: 'ฝนตกหนัก', 80: 'ฝนตกเป็นช่วง ๆ', 81: 'ฝนตกเป็นช่วง ๆ', 82: 'ฝนตกหนักเป็นช่วง ๆ',
  95: 'พายุฝนฟ้าคะนอง', 96: 'พายุฝนฟ้าคะนอง ลูกเห็บ', 99: 'พายุฝนฟ้าคะนองรุนแรง' };
const WX_LV_ = { 1: 'สภาพปกติ', 2: 'ชื้น', 3: 'ฝนตก', 4: 'ลมแรง', 5: 'ฝนตก ลมแรง', 6: 'ฝนตก ฟ้าคะนอง' };
/** ข้อมูลดิบ (จำไว้ 30 นาที) */
function weatherData_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('wx2');
  if (hit) return JSON.parse(hit);
  try {
    const cfg = getConfig_(), lat = Number(cfg.wxLat || 8.3756), lon = Number(cfg.wxLon || 98.7271);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,relative_humidity_2m,weather_code,wind_gusts_10m' +
      '&hourly=precipitation_probability,weather_code,wind_gusts_10m&forecast_hours=8&timezone=Asia%2FBangkok';
    const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    const c = j.current || {}, h = j.hourly || {}, num = function (a) { return (a || []).filter(function (x) { return x != null; }); };
    const d = { code: c.weather_code, t: c.temperature_2m, rh: c.relative_humidity_2m, gust: c.wind_gusts_10m,
      codes: num(h.weather_code), probs: num(h.precipitation_probability), gusts: num(h.wind_gusts_10m) };
    if (d.code == null) return null;
    cache.put('wx2', JSON.stringify(d), 1800);
    return d;
  } catch (e) { return null; }
}
/** วิเคราะห์ระดับ 1–6 จากข้อมูล (ดูตอนนี้ + 8 ชม.ข้างหน้า) */
function wxLevelOf_(d, cfg) {
  if (!d) return null;
  const G = Number(cfg.wxGust || 40), P = Number(cfg.wxRainProb || 60), H = Number(cfg.wxHumid || 85);
  const codes = [d.code].concat(d.codes), max = function (a) { return a.length ? Math.max.apply(null, a) : 0; };
  const isRain = function (c) { return (c >= 61 && c <= 67) || (c >= 80 && c <= 82); };
  const thunder = codes.some(function (c) { return c >= 95; });
  const rain = codes.some(isRain) || max(d.probs) >= P;
  const windy = max([d.gust || 0].concat(d.gusts)) >= G;
  if (thunder) return 6;
  if (rain && windy) return 5;
  if (windy) return 4;
  if (rain) return 3;
  if ((d.rh || 0) >= H || [45, 48, 51, 53, 55, 56, 57].indexOf(d.code) >= 0) return 2;
  return 1;
}
function wxDetail_(d) {
  if (!d) return '';
  const max = function (a) { return a.length ? Math.max.apply(null, a) : null; };
  const g = max([d.gust || 0].concat(d.gusts)), p = max(d.probs);
  return [WX_TH_[d.code] || 'ไม่ทราบ', d.t != null ? Math.round(d.t) + '°C' : '', d.rh != null ? 'ความชื้น ' + Math.round(d.rh) + '%' : '',
    g != null ? 'ลมกระโชก ' + Math.round(g) + ' กม./ชม.' : '', p != null ? 'โอกาสฝน 8 ชม.ข้างหน้า ' + p + '%' : ''].filter(String).join(' · ');
}
function wxOverride_() {
  const o = JSON.parse(PropertiesService.getScriptProperties().getProperty('WX_OVERRIDE') || 'null');
  if (!o) return null;
  if (o.until && Date.now() > o.until) { PropertiesService.getScriptProperties().deleteProperty('WX_OVERRIDE'); return null; }
  return o;
}
/** สถานะสภาพอากาศตอนนี้: { lv, auto, manual:{lv,by,at,until,note}|null, detail } */
function wxNow_() {
  const cfg = getConfig_(), d = weatherData_(), auto = wxLevelOf_(d, cfg), o = wxOverride_();
  return { lv: o ? o.lv : auto, auto: auto, manual: o, detail: wxDetail_(d), label: WX_LV_[o ? o.lv : auto] || '' };
}
/** 2 บรรทัดท้ายข้อความ */
function wxLines_() {
  const w = wxNow_(); if (w.lv == null) return [];
  const by = w.manual ? ' · หน้างานแจ้งโดย ' + w.manual.by + ' ' + Utilities.formatDate(new Date(w.manual.at), TZ, 'HH:mm') + (w.manual.note ? ' (' + w.manual.note + ')' : '') : '';
  return ['สภาพอากาศ : ' + w.lv + by, w.detail ? '(' + w.detail + ')' : ''].filter(String);
}
function weatherText_() { return wxLines_().join(' '); }        // ใช้กับข้อความเดิม

/** ตั้งระดับเอง — lv=null คือกลับเป็นอัตโนมัติ · hours=0 คือจนกว่าจะยกเลิก */
function setWxOverride_(lv, by, hours, note) {
  const props = PropertiesService.getScriptProperties();
  if (lv == null) { props.deleteProperty('WX_OVERRIDE'); log_(by, 'สภาพอากาศ: อัตโนมัติ', '', ''); return null; }
  const o = { lv: Number(lv), by: by, at: Date.now(), until: hours ? Date.now() + hours * 3600000 : 0, note: String(note || '').slice(0, 80) };
  props.setProperty('WX_OVERRIDE', JSON.stringify(o));
  log_(by, 'สภาพอากาศ: ตั้งระดับ ' + o.lv, '', (o.note || '') + (o.until ? ' ถึง ' + Utilities.formatDate(new Date(o.until), TZ, 'd/M HH:mm') : ' จนกว่าจะยกเลิก'));
  if (o.lv >= 5) notifyWx_(o.lv, 'หน้างานแจ้งโดย ' + by + (o.note ? ' — ' + o.note : ''), true);
  return o;
}
/** แจ้ง หผ.ปร. / ชผ. เมื่อระดับ 5–6 (ไม่ซ้ำภายใน 6 ชม. ยกเว้นตั้งเองจากหน้างาน) */
function notifyWx_(lv, source, force) {
  const props = PropertiesService.getScriptProperties();
  const last = JSON.parse(props.getProperty('WX_ALERT') || '{}');
  if (!force && last.lv >= lv && Date.now() - (last.at || 0) < 6 * 3600000) return;
  props.setProperty('WX_ALERT', JSON.stringify({ lv: lv, at: Date.now() }));
  const w = wxNow_(), lines = [source, w.detail ? '(' + w.detail + ')' : ''].filter(String);
  const u = webUrl_('viewDaily'), btn = u ? [{ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูเวรวันนี้', uri: u } }] : null;
  approverList_().forEach(function (a) {
    const id = lineIdOf_(a.short);
    if (id) push_(id, [flex_('สภาพอากาศ : ' + lv + ' ' + WX_LV_[lv], bubble_('แจ้งเตือนสภาพอากาศ', lv === 6 ? '#8A2B2B' : '#B4570B', 'สภาพอากาศ : ' + lv + ' · ' + WX_LV_[lv], lines, btn))], 'change');
  });
}
/** คนที่อยู่เวรตอนนี้ (พนักงาน + คนงาน) */
function onDutyNow_() {
  const now = new Date(), ymd = bkkYmd_(now), hm = Utilities.formatDate(now, TZ, 'HH:mm'), out = {};
  const dd = dayData_(ymd), py = dayData_(addDays_(ymd, -1));
  if (dd) Object.keys(dd.emp).forEach(function (n) {
    const c = dd.emp[n];
    if (cHas_(c, '1') && hm >= '00:00' && hm < '09:00') out[n] = 1;
    if (cHas_(c, '2') && hm >= '08:00' && (cHas_(c, '3') || hm < '17:00')) out[n] = 1;
    if (cHas_(c, '3') && hm >= '16:00') out[n] = 1;
  });
  if (py) Object.keys(py.emp).forEach(function (n) { const c = py.emp[n]; if (cHas_(c, '3') && hm < '01:00') out[n] = 1; });
  if (dd) Object.keys(dd.wk).forEach(function (n) {
    const k = String(dd.wk[n]).split(',');
    if ((k.indexOf('1') >= 0 && hm < '08:30') || (k.indexOf('2') >= 0 && hm >= '07:30' && hm < '16:30') || (k.indexOf('3') >= 0 && hm >= '15:30')) out[n] = 1;
  });
  return out;
}

/** การ์ดแจ้งก่อนเข้าเวร (พนักงาน) — แบบประกาศ กฟส.อ่าวลึก + ปุ่มโทร */
/* ===================== ประกาศเตือนภัยกรมอุตุฯ (จากระบบ tmd ในศูนย์รวมงาน) =====================
 * k = ประกาศที่ระบุผลรายวันในกระบี่ (krabiDetail) · s = ประกาศภาคใต้ที่ไม่ได้ระบุกระบี่ (อ่านช่วงวันที่จากเนื้อความ) · แคช 30 นาที */
const TMD_API_DEFAULT = 'https://script.google.com/macros/s/AKfycbyF7Am81Ut4aUbzTbACUFpJhIQ2q3iKiiTxoLM8IoGvANQ8NQpaM5BvokCeyOWiAqrwNA/exec';
const TMD_OPEN_ = 'https://aloofpea-aul.github.io/tmd/open.html';
function tmdItems_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('tmd_k2');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  let list = [];
  try {
    const url = String(getConfig_().tmdApi || TMD_API_DEFAULT) + '?action=list&limit=80&focus=' + encodeURIComponent('ภาคใต้');
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const j = JSON.parse(res.getContentText());
    list = (j && j.data || []).filter(function (d) { return d && (d.krabiDetail || d.focus === 'ภาคใต้' || d.focus === 'กระบี่'); }).map(function (d) {
      return { s: String(d.sortKey || ''), t: d.title || '', no: d.issueNo || '', sev: d.severity || '', kd: d.krabiDetail || '',
        ds: String(d.description || '').slice(0, 600), pdf: d.pdfUrl || '', drv: d.pdfDrive || '' };
    });
  } catch (e) { return []; }                               // ดึงไม่ได้ = ไม่แสดง (ไม่จำผล)
  try { cache.put('tmd_k2', JSON.stringify(list), 1800); } catch (e) {}
  return list;
}
function tmdMon_(w) { let i = TH_MS_.indexOf(w); if (i < 0) i = TH_MONTH_FULL_.indexOf(w); return i + 1; }
/** ช่วงวันที่ของประกาศภาคใต้ → ['YYYY-MM-DD', ...] (อ่านจากเนื้อความ · ไม่พบใช้วันที่ออกประกาศ) */
function tmdSpan_(it) {
  const ay = +it.s.slice(0, 4), am = +it.s.slice(5, 7), ad = +it.s.slice(8, 10); if (!ay) return [];
  const M = '([ก-๙]+\\.[ก-๙]+\\.|' + TH_MONTH_FULL_.join('|') + ')';
  const yOf = function (mi) { return mi < am - 6 ? ay + 1 : mi > am + 6 ? ay - 1 : ay; };
  const iso = function (y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); };
  const txt = it.ds + ' ' + it.t;
  let a = null, b = null, m;
  if ((m = txt.match(new RegExp('วันที่\\s*(\\d{1,2})\\s*' + M + '?\\s*[-–]\\s*(\\d{1,2})\\s*' + M)))) {
    const m2 = tmdMon_(m[4]), m1 = m[2] ? tmdMon_(m[2]) : m2; a = [yOf(m1), m1, +m[1]]; b = [yOf(m2), m2, +m[3]];
  } else if ((m = txt.match(new RegExp('ในวันที่\\s*(\\d{1,2})\\s*' + M)))) {
    const m1 = tmdMon_(m[2]); a = b = [yOf(m1), m1, +m[1]];
  } else if ((m = txt.match(new RegExp('จนถึงวันที่\\s*(\\d{1,2})\\s*' + M)))) {
    const m2 = tmdMon_(m[2]); a = [ay, am, ad]; b = [yOf(m2), m2, +m[1]];
  } else a = b = [ay, am, ad];
  const out = [], d = new Date(Date.UTC(a[0], a[1] - 1, a[2])), e = new Date(Date.UTC(b[0], b[1] - 1, b[2]));
  for (let i = 0; d <= e && i < 15; i++, d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  return out;
}
function tmdLink_(it) { return it.pdf ? TMD_OPEN_ + '?t=' + encodeURIComponent(it.pdf) + (it.drv ? '&d=' + encodeURIComponent(it.drv) : '') : 'https://aloofpea-aul.github.io/tmd/'; }
function tmdShortTitle_(t) { return String(t || '').replace(/\s*\(มีผลกระทบ.*$/, '').replace(/\s*ฉบับที่.*$/, '').slice(0, 60) || 'มีประกาศเตือนภัย'; }
/** วันในเดือน key ('YYYY-MM') → { d: { k: {...}|null, s: {...}|null } } (ฉบับใหม่กว่าทับฉบับเก่า) */
function tmdDays_(key) {
  const y0 = +key.slice(0, 4), m0 = +key.slice(5, 7), out = {};
  if (!y0 || !m0) return out;
  const put = function (d, kind, v) { (out[d] = out[d] || { k: null, s: null })[kind] = v; };
  tmdItems_().slice().sort(function (a, b) { return a.s < b.s ? -1 : a.s > b.s ? 1 : 0; }).forEach(function (it) {
    const ay = +it.s.slice(0, 4) || y0, am = +it.s.slice(5, 7) || m0;
    const info = function (w) { return { w: w, sev: it.sev, no: it.no, url: tmdLink_(it) }; };
    const kDays = {};
    if (it.kd) {
      String(it.kd).split(/\n+/).forEach(function (ln) {
        const m = String(ln).trim().match(/^(\d{1,2})\s*([ก-๙]+\.[ก-๙]+\.)\s*(.*)$/); if (!m) return;
        const mi = TH_MS_.indexOf(m[2]) + 1; if (!mi) return;
        let yy = ay; if (mi < am - 6) yy++; else if (mi > am + 6) yy--;
        if (yy === y0 && mi === m0) { kDays[+m[1]] = 1; put(+m[1], 'k', info(m[3] || tmdShortTitle_(it.t))); }
      });
    }
    // ช่วงที่ประกาศครอบคลุมภาคใต้ (วันที่ไม่มีรายละเอียดกระบี่ = เฉพาะภาคใต้)
    tmdSpan_(it).forEach(function (ymd) { if (+ymd.slice(0, 4) === y0 && +ymd.slice(5, 7) === m0 && !kDays[+ymd.slice(8, 10)]) put(+ymd.slice(8, 10), 's', info(tmdShortTitle_(it.t))); });
  });
  return out;
}
function tmdOn_(ymd) { try { return tmdDays_(ymd.slice(0, 7))[+ymd.slice(8, 10)] || null; } catch (e) { return null; } }

function shiftMessage_(kind, ymd, name, dd) {
  const def = SLOT_DEF[kind], cfg = getConfig_();
  let title = def.title;
  if (kind === 'emp3' && dd.emp[name] === '2,3') title = 'ช่วง 3 · 16:30 น. (ต่อจากช่วง 2)';
  if (kind === 'emp1' && cHas_(dd.emp[name], '1') && cHas_(dd.emp[name], '2')) title = cHas_(dd.emp[name], '3') ? 'ช่วง 1+2+3 · 00:30 น. (อยู่ต่อเนื่องถึง 00:30 วันรุ่งขึ้น)' : 'ช่วง 1+2 · 00:30 น. (อยู่ต่อเนื่องถึง 16:30)';
  if (kind === 'emp2' && dd.emp[name] === '2') title = 'ช่วง 2 · 08:30–16:30 น.';
  if (kind === 'emp1' && dd.emp[name] === 'S') title = 'เตรียมพร้อม ช่วง 1 · 00:30 น.';
  const body = [
    { type: 'text', text: OFFICE_TITLE_, weight: 'bold', size: 'sm', wrap: true, color: '#1E1A22' },
    { type: 'text', text: 'ติดต่อได้ 24 ชม. · ' + thDateLong_(ymd) + (dd.day.off ? ' · วันหยุด' : ''), size: 'xs', color: '#6B6372', wrap: true }];
  teamOf_(kind, dd).forEach(function (n, i) {
    const p = personOf_(n), bl = empBlock_(ymd, n, kind);
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: (i + 1) + '. ' + p.full + (n === name ? '  (คุณ)' : ''), weight: 'bold', size: 'sm', margin: 'md', wrap: true });
    if (bl) body.push({ type: 'text', text: 'เข้า ' + thShortD_(bl.inD) + ' ' + bl.inT + ' → ออก ' + thShortD_(bl.outD) + ' ' + bl.outT + ' น.', size: 'xs', color: '#4A4450', wrap: true });
    const tb = telBtn_('โทร ' + fmtPhone_(p.phone), p.phone, false); if (tb) body.push(tb);
  });
  if (name && dd.emp[name] !== 'S') {
    const rl = repLink_(ymd + '|' + (kind === 'emp1' ? 'p1' : 'p3'), name, 'duty');
    if (rl) body.push({ type: 'button', style: 'secondary', height: 'sm', margin: 'md', action: { type: 'uri', label: 'ลงรายงานการอยู่เวร', uri: rl } });
    if (rl) body.push({ type: 'button', style: 'primary', color: '#A23434', height: 'sm', margin: 'md', action: { type: 'uri', label: '⚡ บันทึกไฟดับ', uri: rl + '&out=1' } });
  }
  const ins = inspOf_(ymd); if (ins) body.push({ type: 'text', text: 'ผู้ตรวจเวรวันนี้: ' + personOf_(ins).full, size: 'xs', color: '#6B6372', margin: 'md', wrap: true });
  const sb = who_(dd.emp, function (c) { return c === 'S'; });
  if (kind === 'emp1' && sb.length) body.push({ type: 'text', text: 'เตรียมพร้อม: ' + sb.join(', '), size: 'xs', color: '#6B6372', margin: 'md', wrap: true });
  body.push({ type: 'separator', margin: 'md' });
  const room = telBtn_('ห้องเวรแก้ไฟ ' + fmtPhone_(cfg.roomPhone), cfg.roomPhone, true); if (room) body.push(room);
  body.push(telBtn_('PEA Call Center 1129', '1129', false));
  const wl = wxLines_();
  if (wl.length) { body.push({ type: 'separator', margin: 'md' }); body.push({ type: 'text', text: wl[0], size: 'sm', weight: 'bold', color: '#1E1A22', wrap: true, margin: 'md' });
    if (wl[1]) body.push({ type: 'text', text: wl[1], size: 'xs', color: '#4A4450', wrap: true }); }
  const twd = tmdOn_(ymd), tw = twd && (twd.k || twd.s);
  if (tw) { body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: '⚠️ กรมอุตุฯ เตือน (' + (twd.k ? 'ภาคใต้ + กระบี่' : 'ภาคใต้') + '): ' + tw.w, size: 'sm', weight: 'bold', color: tw.sev === 'สูง' ? '#C92A2A' : twd.k ? '#C2410C' : '#8A6A00', wrap: true, margin: 'md' });
    if (tw.no) body.push({ type: 'text', text: tw.no + (twd.k ? '' : ' · ไม่ได้ระบุกระบี่'), size: 'xs', color: '#6B6372', wrap: true });
    body.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูประกาศกรมอุตุฯ', uri: tw.url } }); }
  body.forEach(function (x) { if (x.type === 'button') x.margin = 'sm'; });
  const foot = [
    { type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'postback', label: 'รับทราบ', data: 'ack|' + kind + '|' + ymd + '|' + name, displayText: 'รับทราบ / เข้าเวรแล้ว' } },
    { type: 'button', style: 'secondary', height: 'sm', action: { type: 'postback', label: 'ข้อความประกาศ', data: 'ann|' + kind + '|' + ymd, displayText: 'ขอข้อความประกาศ' } }];
  return flex_('อีก 5 นาทีเข้าเวร ' + title, {
    type: 'bubble', size: 'mega',
    header: { type: 'box', layout: 'vertical', backgroundColor: def.color, paddingAll: '12px', contents: [
      { type: 'text', text: 'อีก 5 นาทีเข้าเวร', size: 'xs', color: '#FFFFFFCC' },
      { type: 'text', text: title, size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true }] },
    body: { type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '12px', contents: body },
    footer: { type: 'box', layout: 'horizontal', spacing: 'sm', contents: foot }
  });
}

/** ข้อความประกาศแบบเดิมของ กฟส.อ่าวลึก (ข้อความธรรมดา กดค้างส่งต่อได้) */
function announceText_(kind, ymd) {
  const dd = dayData_(ymd); if (!dd) return 'ไม่พบตารางเวรของ ' + thFull_(ymd);
  const cfg = getConfig_(), L = [];
  L.push('👷⚡ พนักงานประจำเวรแก้กระแสไฟฟ้าขัดข้อง การไฟฟ้าส่วนภูมิภาคสาขาอำเภออ่าวลึก ติดต่อได้ 24 ช.ม.⚡👷', '', '🛠️ พนักงานช่างประจำเวร แก้กระแสไฟฟ้าขัดข้อง 🛠️');
  teamOf_(kind, dd).forEach(function (n, i) {
    const p = personOf_(n), bl = empBlock_(ymd, n, kind);
    L.push('', (i + 1) + '.' + p.full);
    if (p.phone) L.push('', '📞 เบอร์โทร ' + fmtPhone_(p.phone));
    if (bl) L.push('', '📅 ประจำวันที่ ' + thFull_(bl.inD), '⏰ เข้าเวรเวลา: ' + bl.inT + ' น.', '📅 ประจำวันที่ ' + thFull_(bl.outD), '⏰ ออกเวรเวลา: ' + bl.outT + ' น.');
  });
  L.push('', '🏢 และเบอร์โทรศัพท์ติดต่อประจำห้องเวรแก้กระแสไฟฟ้าขัดข้อง การไฟฟ้าสาขาอำเภออ่าวลึก ติดต่อได้24ชม.' + (cfg.roomPhone ? ' ' + fmtPhone_(cfg.roomPhone) : ''));
  L.push('', '☎️PEA Call Center 1129');
  const wl = wxLines_(); if (wl.length) L.push('', wl.join('\n'));
  return L.join('\n');
}

/* ---- คนงาน ---- */
function wkOf_(dd, k) {
  return who_(dd.wk, function (c) { c = String(c); return k === '2' ? c === '2' : c.split(',').indexOf(k) >= 0; });
}
/** เวรคนงานวันนี้ (ตอบกลับฟรี) — มีปุ่มโทรรายคน */
function workersToday_(ymd) {
  const dd = dayData_(ymd), nx = dayData_(addDays_(ymd, 1));
  if (!dd) return text_('ยังไม่มีตารางเวรของ ' + thDateLong_(ymd));
  const rows = [['กะ 1 · 00.00–08.00', wkOf_(dd, '1')], ['กะ 2 · 08.00–16.00', wkOf_(dd, '2')], ['กะ 3 · 16.00–24.00', wkOf_(dd, '3')]];
  if (nx) rows.push(['กะ 1 คืนนี้ · 24.00–08.00', wkOf_(nx, '1')]);
  const body = [];
  rows.forEach(function (r, i) {
    if (i) body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: r[0], weight: 'bold', size: 'sm', margin: 'md' });
    if (!r[1].length) body.push({ type: 'text', text: '—', size: 'sm', color: '#6B6372' });
    r[1].forEach(function (n) {
      const p = personOf_(n), b = telBtn_('โทร ' + n + (p.phone ? ' ' + fmtPhone_(p.phone) : ''), p.phone, false);
      body.push(b ? Object.assign(b, { margin: 'sm' }) : { type: 'text', text: n, size: 'sm' });
    });
  });
  return flex_('คนงานประจำเวร ' + thDateLong_(ymd), {
    type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: '#B4570B', paddingAll: '12px', contents: [
      { type: 'text', text: 'คนงานประจำเวร · วันนี้', size: 'xs', color: '#FFFFFFCC' },
      { type: 'text', text: thDateLong_(ymd) + (dd.day.off ? ' · วันหยุด' : ''), size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true }] },
    body: { type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '12px', contents: body }
  });
}
/** สรุปเวรคนงาน 7 วัน (ส่งเข้ากลุ่มทุกวันจันทร์) */
function workersWeek_(ymd) {
  const head = { type: 'box', layout: 'horizontal', contents: ['วัน', 'กะ 1 (24–08)', 'กะ 2 (08–16)', 'กะ 3 (16–24)'].map(function (t, i) {
    return { type: 'text', text: t, size: 'xxs', color: '#6B6372', flex: i ? 3 : 2, wrap: true }; }) };
  const rows = [head, { type: 'separator' }];
  let last = ymd;
  for (let k = 0; k < 7; k++) {
    const d = addDays_(ymd, k), dd = dayData_(d); if (!dd) break; last = d;
    const lab = thDateLong_(d).split(' ').slice(0, 2).join(' ');
    rows.push({ type: 'box', layout: 'horizontal', margin: 'sm', contents: [
      { type: 'text', text: lab, size: 'xs', flex: 2, color: dd.day.off ? '#993C1D' : '#1E1A22', weight: dd.day.off ? 'bold' : 'regular' },
      { type: 'text', text: wkOf_(dd, '1').join(', ') || '—', size: 'xs', flex: 3, wrap: true },
      { type: 'text', text: wkOf_(dd, '2').join(', ') || '—', size: 'xs', flex: 3, wrap: true },
      { type: 'text', text: wkOf_(dd, '3').join(', ') || '—', size: 'xs', flex: 3, wrap: true }] });
  }
  rows.push({ type: 'text', text: 'กะ 1 = เริ่ม 24.00 ของคืนก่อนวันนั้น · ดูเวรวันนี้พร้อมปุ่มโทร พิมพ์ "เวรคนงาน"', size: 'xxs', color: '#6B6372', wrap: true, margin: 'md' });
  const foot = [];
  const u1 = webUrl_('viewDaily', { g: 'wk' }); if (u1) foot.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'โทรคนงาน', uri: u1 } });
  const u2 = webUrl_(''); if (u2) foot.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ตารางเวร', uri: u2 } });
  const range = thShortD_(ymd) + ' – ' + thShortD_(last) + ' ' + (+last.slice(0, 4) + 543);
  const b = { type: 'bubble', size: 'mega',
    header: { type: 'box', layout: 'vertical', backgroundColor: '#B4570B', paddingAll: '12px', contents: [
      { type: 'text', text: 'คนงานประจำเวรแก้ไฟ กฟส.อ่าวลึก', size: 'xs', color: '#FFFFFFCC' },
      { type: 'text', text: 'สัปดาห์ ' + range, size: 'lg', weight: 'bold', color: '#FFFFFF', wrap: true }] },
    body: { type: 'box', layout: 'vertical', paddingAll: '12px', contents: rows } };
  if (foot.length) b.footer = { type: 'box', layout: 'horizontal', spacing: 'sm', contents: foot };
  return flex_('คนงานประจำเวร สัปดาห์ ' + range, b);
}
function groupCount_(gid) {
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/group/' + gid + '/members/count', { headers: { Authorization: 'Bearer ' + lineToken_() }, muteHttpExceptions: true });
    return Number(JSON.parse(res.getContentText()).count) || 15;
  } catch (e) { return 15; }
}

/* ------------------------- ส่ง (push) + โควต้า ------------------------- */
function lineToken_() { return PropertiesService.getScriptProperties().getProperty('LINE_TOKEN'); }
function quotaKey_() { return 'PUSH_' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM'); }
function pushCount_() { return Number(PropertiesService.getScriptProperties().getProperty(quotaKey_()) || 0); }

/** priority: 'shift' หยุดส่งเมื่อเหลือโควต้า ≤ 10 เพื่อเก็บไว้แจ้งการเปลี่ยนเวร */
function push_(userId, messages, priority, cost) {
  const tok = lineToken_(); if (!tok || !userId) return false;
  cost = cost || 1;
  const limit = Number(getConfig_().lineMonthlyLimit || 300), used = pushCount_();
  if (used + cost > limit || (priority === 'shift' && used + cost > limit - 10)) { log_('system', 'LINE โควต้าเต็ม', '', 'ข้ามการส่ง ' + used + '/' + limit + ' (ต้องใช้ ' + cost + ')'); return false; }
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok },
    payload: JSON.stringify({ to: userId, messages: messages }), muteHttpExceptions: true });
  if (res.getResponseCode() === 200) {
    PropertiesService.getScriptProperties().setProperty(quotaKey_(), String(used + cost));
    return true;
  }
  log_('system', 'LINE push error', '', res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
  return false;
}
function reply_(token, messages) {
  const tok = lineToken_(); if (!tok) return;
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok },
    payload: JSON.stringify({ replyToken: token, messages: messages }), muteHttpExceptions: true });
}
function text_(t) { return { type: 'text', text: t }; }

function peopleRows_() { return readTable_(SH.PEOPLE); }
function lineIdOf_(short) {
  const r = peopleRows_().filter(function (p) { return p.short === short; })[0]; return r ? r.lineUserId : '';
}

function notifyPeople_(shorts, head, body, color, title, buttons) {
  const rows = peopleRows_();
  shorts.forEach(function (n) {
    const p = rows.filter(function (r) { return r.short === n; })[0];
    if (p && p.lineUserId) push_(p.lineUserId, [flex_(head + ' ' + (title || ''), bubble_(head, color || '#5B1A63', title || 'งานเวรแก้ไฟ', body.split('\n'), buttons || null))], 'change');
  });
}
function notifyApprovers_(head, body) {
  const u = webUrl_('viewReq');
  const btn = u ? [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'uri', label: 'เปิดหน้าอนุมัติ', uri: u } }] : null;
  approverList_().forEach(function (a) {
    const id = lineIdOf_(a.short);
    if (id) push_(id, [flex_(head, bubble_(head, '#B4570B', 'คำขอเปลี่ยนเวร', body.split('\n'), btn))], 'change');
  });
}

/* ------------------------- ตั้งเวลาแจ้งเตือน ------------------------- */

/** รันครั้งเดียวหลังติดตั้ง: สร้าง trigger วางแผนรายวัน 21:00 */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['planDay', 'sendSlot'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('planDay').timeBased().atHour(21).everyDays(1).inTimezone(TZ).create();
  planDay();
}

/** slot ทั้งหมดที่ต้องส่งในช่วง [from, to) */
function slotsBetween_(from, to) {
  const out = [], start = bkkYmd_(new Date(from.getTime() - 86400000));
  for (let k = 0; k < 4; k++) {
    const d = addDays_(start, k);
    Object.keys(SLOT_DEF).forEach(function (kind) {
      const def = SLOT_DEF[kind];
      if (def.wd != null && weekday_(+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)) !== def.wd) return;
      const at = new Date(d + 'T' + def.hm + ':00+07:00');
      if (at >= from && at < to) out.push({ key: d + '|' + kind, kind: kind, date: d, at: at.getTime() });
    });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}

/** วางแผนส่ง ~26 ชม.ข้างหน้า และสร้าง trigger แบบครั้งเดียวตามเวลาเป๊ะ */
function planDay() {
  try { migrate_(); } catch (e) {}
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendSlot') ScriptApp.deleteTrigger(t); });
  const props = PropertiesService.getScriptProperties();
  const sent = JSON.parse(props.getProperty('SENT') || '[]');
  const now = new Date(), plan = slotsBetween_(new Date(now.getTime() + 60000), new Date(now.getTime() + 26 * 3600000))
    .filter(function (s) { return sent.indexOf(s.key) < 0; });
  props.setProperty('PLAN', JSON.stringify(plan));
  const times = {};
  plan.forEach(function (s) { if (!times[s.at]) { times[s.at] = 1; ScriptApp.newTrigger('sendSlot').timeBased().at(new Date(s.at)).create(); } });
  syncQuota_();
  return plan;
}

/** ถูกเรียกโดย trigger: ส่ง slot ที่ถึงเวลา (ยอมรับช้าได้ถึง 30 นาที) */
function sendSlot() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const plan = JSON.parse(props.getProperty('PLAN') || '[]');
    let sent = JSON.parse(props.getProperty('SENT') || '[]');
    const now = Date.now(), cfg = getConfig_(), people = peopleRows_();
    plan.forEach(function (s) {
      if (sent.indexOf(s.key) >= 0) return;
      if (s.at > now + 90000 || s.at < now - 30 * 60000) return;
      const dd = dayData_(s.date);
      if (dd && s.kind === 'wkweek') {
        const gid = String(cfg.wkGroupId || '');
        if (gid) push_(gid, [workersWeek_(s.date)], 'shift', groupCount_(gid));
      } else if (dd) slotRecipients_(s.kind, dd, cfg).forEach(function (n) {
        const p = people.filter(function (r) { return r.short === n; })[0];
        if (p && p.lineUserId) push_(p.lineUserId, [shiftMessage_(s.kind, s.date, n, dd)], 'shift');
      });
      sent.push(s.key);
    });
    try { const w = wxNow_(); if (w.lv >= 5 && !w.manual) notifyWx_(w.lv, 'ระบบวิเคราะห์จากพยากรณ์อากาศ', false); } catch (e) {}
    props.setProperty('SENT', JSON.stringify(sent.slice(-60)));
  } finally { lock.releaseLock(); }
}

/** ดึงยอดใช้จริงจาก LINE มาเทียบ (กันนับคลาด) */
function syncQuota_() {
  const tok = lineToken_(); if (!tok) return;
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota/consumption',
    { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
  if (res.getResponseCode() === 200) {
    const used = JSON.parse(res.getContentText()).totalUsage;
    if (used != null) PropertiesService.getScriptProperties().setProperty(quotaKey_(), String(used));
  }
}

/* ------------------------- Webhook ------------------------- */
function lineWebhook_(body) {
  (body.events || []).forEach(function (ev) {
    try { handleEvent_(ev); } catch (err) { log_('system', 'LINE webhook error', '', String(err)); }
  });
  return ContentService.createTextOutput('OK');
}

function handleEvent_(ev) {
  const uid = ev.source && ev.source.userId;
  const inGroup = ev.source && (ev.source.type === 'group' || ev.source.type === 'room');
  if (ev.type === 'join') {
    return reply_(ev.replyToken, [text_('สวัสดีครับ บอทงานเวรแก้ไฟ กฟส.อ่าวลึก\nถ้ากลุ่มนี้เป็นกลุ่มคนงาน ให้ หผ.ปร. พิมพ์:\nตั้งกลุ่มคนงาน รหัส\n\nคำสั่งในกลุ่ม: เวรคนงาน · เวรวันนี้ · เวรพรุ่งนี้')]);
  }
  if (ev.type === 'follow') {
    return reply_(ev.replyToken, [text_('สวัสดีครับ ระบบงานเวรแก้ไฟ กฟส.อ่าวลึก\nลงทะเบียนครั้งแรก พิมพ์:\nลงทะเบียน ชื่อของคุณ รหัส\nเช่น  ลงทะเบียน พงศธร 1234\n(ขอรหัสจาก หผ.ปร.)')]);
  }
  if (ev.type === 'postback') {
    const p = String(ev.postback.data || '').split('|');
    if (p[0] === 'ack') {
      const who = peopleRows_().filter(function (r) { return r.lineUserId && r.lineUserId === uid; })[0];
      const by = who ? who.short : uid;
      log_(by, 'รับทราบเวร', (p[2] || '').slice(0, 7), p[1] + ' ' + p[2] + (p[3] && p[3] !== by ? ' (การ์ดของ ' + p[3] + ')' : ''));
      return reply_(ev.replyToken, [text_('บันทึกการรับทราบแล้ว ✓\n' + (who ? who.full : '') + ' · ' + Utilities.formatDate(new Date(), TZ, 'HH:mm') + ' น.')]);
    }
    if (p[0] === 'ann') return reply_(ev.replyToken, [text_(announceText_(p[1], p[2]))]);
    if (p[0] === 'tk') {
      const who = peopleRows_().filter(function (r) { return r.lineUserId && r.lineUserId === uid; })[0];
      if (!who) return reply_(ev.replyToken, [text_('ยังไม่ได้ลงทะเบียน — ใช้ได้เฉพาะเจ้าหน้าที่')]);
      if (p[1] === 'acc') {
        const r = tkAccept_(p[2], who.short);
        if (r.already) return reply_(ev.replyToken, [text_('รายการ ' + p[2] + ' — ' + r.already + ' รับงานไปแล้ว')]);
        if (r.closed) return reply_(ev.replyToken, [text_('รายการ ' + p[2] + ' ' + r.closed)]);
        const u = webUrl_('viewDaily', { tk: 1 });
        return reply_(ev.replyToken, [text_('✋ ' + who.short + ' รับงาน ' + p[2] + ' แล้ว (' + Utilities.formatDate(new Date(), TZ, 'HH:mm') + ' น.)\nแก้เสร็จแล้วกด "แก้เสร็จ → บันทึกไฟดับ" ในแอป' + (u ? '\n' + u : ''))]);
      }
      if (p[1] === 'fwd') {
        const c = CacheService.getScriptCache(), txt = c.get('tkf_' + uid);
        if (!txt) return reply_(ev.replyToken, [text_('ข้อความหมดอายุแล้ว — ส่งต่อข้อความอีกครั้ง')]);
        c.remove('tkf_' + uid);
        const d = tkFromLine_(txt, who.short);
        return reply_(ev.replyToken, [text_('สร้างรายการรับแจ้ง ' + d.id + ' แล้ว ✓ แจ้งคนเข้าเวรแล้ว' + (d.phone ? '' : '\n(ไม่พบเบอร์โทรในข้อความ)'))]);
      }
      return;
    }
    return;
  }
  if (ev.type !== 'message' || ev.message.type !== 'text') return;
  const t = String(ev.message.text || '').trim();
  const me = peopleRows_().filter(function (r) { return r.lineUserId && r.lineUserId === uid; })[0];

  let m = t.match(/^ลงทะเบียน\s+(\S+)\s+(\S+)$/);
  if (m && !inGroup) return reply_(ev.replyToken, [text_(register_(uid, m[1], m[2]))]);

  m = t.match(/^ตั้งกลุ่มคนงาน\s+(\S+)$/);
  if (m && ev.source.type === 'group') {
    if (String(m[1]) !== String(getConfig_().lineRegCode)) return reply_(ev.replyToken, [text_('รหัสไม่ถูกต้อง')]);
    setConfigKey_('wkGroupId', ev.source.groupId); log_(me ? me.short : uid, 'ตั้งกลุ่มคนงาน LINE', '', ev.source.groupId);
    return reply_(ev.replyToken, [text_('ตั้งกลุ่มนี้เป็นกลุ่มคนงานแล้ว ✓\nระบบจะส่งเวรคนงานรายสัปดาห์ทุกวันจันทร์ 07:55\nพิมพ์ "เวรคนงาน" เพื่อดูเวรวันนี้พร้อมปุ่มโทร')]);
  }
  if (typeof tmdHandle_ === 'function' && tmdHandle_(ev, t, me, uid)) return;   // ประกาศเตือนภัยกรมอุตุ (Tmd.gs)
  if (/^เวรคนงาน$/.test(t)) return reply_(ev.replyToken, [workersToday_(bkkYmd_())]);
  if (inGroup && !/^(เวร|เวรวันนี้|เวรพรุ่งนี้)$/.test(t)) return;   // ในกลุ่ม: ตอบเฉพาะคำสั่ง ไม่รบกวนแชต

  if (!me && !inGroup) return reply_(ev.replyToken, [text_('ยังไม่ได้ลงทะเบียน\nพิมพ์: ลงทะเบียน ชื่อของคุณ รหัส\nเช่น  ลงทะเบียน พงศธร 1234')]);

  if (/^(เวร|เวรวันนี้)$/.test(t) || /^เวรพรุ่งนี้$/.test(t)) {
    const ymd = /พรุ่งนี้/.test(t) ? addDays_(bkkYmd_(), 1) : bkkYmd_();
    const dd = dayData_(ymd);
    if (!dd) return reply_(ev.replyToken, [text_('ยังไม่มีตารางเวรของ ' + thDateLong_(ymd))]);
    return reply_(ev.replyToken, [flex_('เวรแก้ไฟ ' + thDateLong_(ymd),
      bubble_('เวรแก้ไฟ' + (dd.day.off ? ' · วันหยุด' : ''), '#5B1A63', thDateLong_(ymd), summaryLines_(dd), null))]);
  }
  if (/^เวรของฉัน$/.test(t)) return reply_(ev.replyToken, [text_(myDuties_(me))]);
  if (!inGroup && /ไฟ\s*(ดับ|ตก|ไม่มา|กระพริบ|ไม่ติด)|ไฟฟ้า\s*ดับ|สาย.*ขาด|เสา.*ล้ม/.test(t) && t.length >= 6) {
    CacheService.getScriptCache().put('tkf_' + uid, t.slice(0, 500), 1800);
    return reply_(ev.replyToken, [{ type: 'text', text: 'เป็นข้อความแจ้งไฟดับจากผู้ใช้ไฟใช่ไหม?\n"' + t.slice(0, 120) + (t.length > 120 ? '…' : '') + '"',
      quickReply: { items: [{ type: 'action', action: { type: 'postback', label: '📥 สร้างรายการรับแจ้ง', data: 'tk|fwd', displayText: 'สร้างรายการรับแจ้ง' } },
        { type: 'action', action: { type: 'message', label: 'ไม่ใช่', text: 'ไม่ใช่' } }] } }]);
  }
  m = t.match(/^อากาศ\s*(อัตโนมัติ|[1-6])\s*(.*)$/);
  if (m) {
    const isAppr = approverList_().some(function (a) { return a.short === me.short; });
    if (!isAppr && !onDutyNow_()[me.short]) return reply_(ev.replyToken, [text_('ตั้งสภาพอากาศได้เฉพาะคนที่อยู่เวรตอนนี้ และ หผ.ปร. / ชผ.')]);
    if (m[1] === 'อัตโนมัติ') { setWxOverride_(null, me.short); const w = wxNow_(); return reply_(ev.replyToken, [text_('กลับเป็นอัตโนมัติแล้ว ✓\nสภาพอากาศ : ' + w.lv + ' (' + w.label + ')')]); }
    const hrs = Number(getConfig_().wxManualHours || 6), o = setWxOverride_(+m[1], me.short, hrs, m[2]);
    return reply_(ev.replyToken, [text_('ตั้งสภาพอากาศ : ' + o.lv + ' (' + WX_LV_[o.lv] + ') แล้ว ✓\nใช้ถึง ' + Utilities.formatDate(new Date(o.until), TZ, 'HH:mm') + ' น. (' + hrs + ' ชม.)' +
      (o.lv >= 5 ? '\nแจ้ง หผ.ปร. / ชผ. แล้ว' : '') + '\nพิมพ์ "อากาศ อัตโนมัติ" เพื่อยกเลิก')]);
  }
  if (/^อากาศ$/.test(t)) { const w = wxNow_(); return reply_(ev.replyToken, [text_(wxLines_().join('\n') + '\n\nตั้งเอง: อากาศ 1–6 (เฉพาะคนอยู่เวร / หผ.ปร. / ชผ.)\n1 ปกติ · 2 ชื้น · 3 ฝนตก · 4 ลมแรง · 5 ฝนตก ลมแรง · 6 ฝนตก ฟ้าคะนอง')]); }
  if (/^ไฟดับ$/.test(t)) {
    const blk = myRecentBlock_(me.short);
    if (!blk) return reply_(ev.replyToken, [text_('ไม่พบเวรของคุณที่กำลังอยู่ หรือเพิ่งจบภายใน 12 ชม.\nผู้อนุมัติบันทึกได้ที่หน้าเวรรายวัน (ใช้ PIN)\n' + (webUrl_('viewDaily') || ''))]);
    const lab = blk.k.slice(11) === 'p1' ? 'ช่วง 1' : 'ช่วง 3';
    return reply_(ev.replyToken, [flex_('บันทึกไฟดับ', bubble_('บันทึกเหตุการณ์ไฟดับ', '#A23434', thDateLong_(blk.k.slice(0, 10)) + ' · ' + lab,
      ['ลิงก์นี้ใช้ได้ 48 ชม. เฉพาะ ' + me.full], [{ type: 'button', style: 'primary', color: '#A23434', height: 'sm', action: { type: 'uri', label: '⚡ บันทึกไฟดับ', uri: repLink_(blk.k, me.short, 'duty') + '&out=1' } }]))]);
  }
  if (/^รายงานเวร$/.test(t)) {
    const blk = myRecentBlock_(me.short);
    const isAppr = approverList_().some(function (a) { return a.short === me.short; });
    if (!blk && !isAppr) return reply_(ev.replyToken, [text_('ไม่พบเวรของคุณที่กำลังอยู่ หรือเพิ่งจบภายใน 12 ชม.')]);
    if (!blk) return reply_(ev.replyToken, [text_('ผู้อนุมัติแก้รายงานได้ที่หน้าเวรรายวัน (ใช้ PIN)\n' + webUrl_('viewDaily'))]);
    const lab = blk.k.slice(11) === 'p1' ? 'ช่วง 1' : 'ช่วง 3';
    return reply_(ev.replyToken, [flex_('ลงรายงานการอยู่เวร', bubble_('รายงานการอยู่เวร', '#5B1A63', thDateLong_(blk.k.slice(0, 10)) + ' · ' + lab,
      ['ลิงก์นี้ใช้ได้ 48 ชม. เฉพาะ ' + me.full], [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'uri', label: 'เปิดแบบรายงาน', uri: repLink_(blk.k, me.short, 'duty') } }]))]);
  }
  if (/^ตรวจเวร$/.test(t)) {
    const today = bkkYmd_(), hm = Utilities.formatDate(new Date(), TZ, 'HH:mm');
    const d = hm < '12:00' && inspOf_(addDays_(today, -1)) === me.short ? addDays_(today, -1) : today;   // ช่วงเช้าตรวจของเมื่อวานได้
    if (inspOf_(d) !== me.short) return reply_(ev.replyToken, [text_('วันนี้คุณไม่ได้เป็นผู้ตรวจเวร' + (inspOf_(today) ? '\nผู้ตรวจเวรวันนี้: ' + personOf_(inspOf_(today)).full : ''))]);
    return reply_(ev.replyToken, [flex_('ตรวจเวร', bubble_('ผู้ตรวจเวร', '#26307A', thDateLong_(d), ['ติ๊กผลตรวจของช่วง 1 และช่วง 3 วันนี้', 'ลิงก์ใช้ได้ 48 ชม.'],
      [{ type: 'button', style: 'primary', color: '#26307A', height: 'sm', action: { type: 'uri', label: 'เปิดแบบตรวจเวร', uri: repLink_(d, me.short, 'insp') } }]))]);
  }
  if (/^ตัวอย่างแจ้งเตือน$/.test(t)) {             // ดูหน้าตาการ์ดจริงโดยไม่เสียโควต้า (ตอบกลับ)
    const ymd = bkkYmd_(), dd = dayData_(ymd); if (!dd) return reply_(ev.replyToken, [text_('ยังไม่มีตารางวันนี้')]);
    const team = teamOf_('emp3', dd), wd = weekday_(+ymd.slice(0, 4), +ymd.slice(5, 7), +ymd.slice(8, 10));
    const mon = addDays_(ymd, -((wd + 6) % 7));
    return reply_(ev.replyToken, [shiftMessage_('emp3', ymd, team[0] || '', dd), workersWeek_(mon)]);
  }
  if (/เปลี่ยน|ลาเวร|แลก/.test(t)) {
    const u = webUrl_('viewReq');
    return reply_(ev.replyToken, [text_(u ? 'ยื่นคำขอแลก/ลาเวรได้ที่\n' + u : 'ติดต่อ หผ.ปร. เพื่อขอเปลี่ยนเวร')]);
  }
  if (/ตาราง/.test(t)) { const u = webUrl_(''); return reply_(ev.replyToken, [text_(u ? 'ตารางเวรทั้งเดือน\n' + u : 'ยังไม่ได้ตั้งค่า webUrl')]); }
  return reply_(ev.replyToken, [text_('คำสั่งที่ใช้ได้\n• เวรวันนี้\n• เวรพรุ่งนี้\n• เวรของฉัน\n• เวรคนงาน\n• รายงานเวร\n• ตรวจเวร\n• อากาศ (ดู/ตั้งระดับ)\n• ขอเปลี่ยน/ลาเวร\n• ตารางเดือนนี้')]);
}

function register_(uid, name, code) {
  const cfg = getConfig_();
  if (String(code) !== String(cfg.lineRegCode)) return 'รหัสลงทะเบียนไม่ถูกต้อง';
  const sh = sheet_(SH.PEOPLE), v = sh.getDataRange().getValues(), h = v[0];
  const si = h.indexOf('short'), fi = h.indexOf('full'), li = h.indexOf('lineUserId');
  const norm = function (s) { return String(s).replace(/\s+/g, '').replace(/^นาย/, ''); };
  let hit = -1;
  for (let i = 1; i < v.length; i++) {
    if (norm(v[i][si]) === norm(name) || norm(v[i][fi]).indexOf(norm(name)) === 0) { hit = i; break; }
  }
  if (hit < 0) return 'ไม่พบชื่อ "' + name + '" ในระบบ — พิมพ์ชื่อจริงตามตารางเวร เช่น พงศธร';
  for (let i = 1; i < v.length; i++) if (v[i][li] === uid && i !== hit) sh.getRange(i + 1, li + 1).setValue('');
  sh.getRange(hit + 1, li + 1).setValue(uid);
  log_(v[hit][si], 'ลงทะเบียน LINE', '', '');
  return 'ลงทะเบียนสำเร็จ: ' + v[hit][fi] + '\nพนักงาน: ระบบจะแจ้งเตือนก่อนเข้าเวร 5 นาที\nพิมพ์ "เวรของฉัน" เพื่อดูเวรที่เหลือของเดือน';
}

function myDuties_(me) {
  const today = bkkYmd_(), out = [];
  [today.slice(0, 7), addDays_(today.slice(0, 8) + '28', 7).slice(0, 7)].forEach(function (key) {
    const mo = getMonth_(key); if (!mo) return;
    const g = mo.data.emp[me.short] ? 'emp' : mo.data.wk[me.short] ? 'wk' : null; if (!g) return;
    mo.data[g][me.short].forEach(function (c, i) {
      const ymd = key + '-' + String(i + 1).padStart(2, '0');
      if (ymd < today) return;
      if (g === 'emp' && c !== '' ) out.push(thDateLong_(ymd) + '  ' + codeLabel_('emp', c));
      if (g === 'wk' && c !== '0') out.push(thDateLong_(ymd) + '  กะ ' + c);
    });
  });
  return out.length ? 'เวรของ ' + me.full + '\n' + out.slice(0, 25).join('\n') : 'ยังไม่มีเวรที่จะถึงในระบบ';
}
