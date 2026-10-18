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
    const r = who_(e, function (c) { return c === '1'; });
    return String(cfg.notifyStandby) === 'true' ? r.concat(who_(e, function (c) { return c === 'S'; })) : r;
  }
  if (kind === 'emp2') return dd.day.off ? who_(e, function (c) { return c === '2,3'; }) : [];
  if (kind === 'emp3') return who_(e, function (c) { return c === '3' || c === '2,3'; });
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
  L.push('ช่วง 1: ' + j(who_(e, function (c) { return c === '1'; })));
  if (dd.day.off) L.push('ช่วง 2: ' + j(who_(e, function (c) { return c === '2,3'; })));
  L.push('ช่วง 3: ' + j(who_(e, function (c) { return c === '3' || c === '2,3'; })));
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
function empBlock_(ymd, n) {
  const c = empCode_(ymd, n), prev = addDays_(ymd, -1), next = addDays_(ymd, 1);
  if (c === '1') {
    const pc = empCode_(prev, n);
    if (pc === '3') return { inD: prev, inT: '16:30', outD: ymd, outT: '08:30' };
    if (pc === '2,3') return { inD: prev, inT: '08:30', outD: ymd, outT: '08:30' };
    return { inD: ymd, inT: '00:30', outD: ymd, outT: '08:30' };
  }
  if (c === '3' || c === '2,3') {
    const nc = empCode_(next, n);
    return { inD: ymd, inT: c === '3' ? '16:30' : '08:30', outD: next, outT: nc === '1' ? '08:30' : '00:30' };
  }
  return null;
}
/** ทีมที่อยู่ในการแจ้งรอบนั้น */
function teamOf_(kind, dd) {
  const e = dd.emp;
  if (kind === 'emp1') return who_(e, function (c) { return c === '1'; });
  return who_(e, function (c) { return c === '3' || c === '2,3'; });
}

/* ---- สภาพอากาศ (Open-Meteo ฟรี ไม่ต้องใช้คีย์) ---- */
const WX_TH_ = { 0: 'ท้องฟ้าแจ่มใส', 1: 'มีเมฆบางส่วน', 2: 'มีเมฆบางส่วน', 3: 'มีเมฆมาก', 45: 'มีหมอก', 48: 'มีหมอก',
  51: 'ฝนปรอย', 53: 'ฝนปรอย', 55: 'ฝนปรอย', 56: 'ฝนปรอย', 57: 'ฝนปรอย', 61: 'ฝนตกเล็กน้อย', 63: 'ฝนตกปานกลาง', 65: 'ฝนตกหนัก',
  66: 'ฝนตก', 67: 'ฝนตกหนัก', 80: 'ฝนตกเป็นช่วง ๆ', 81: 'ฝนตกเป็นช่วง ๆ', 82: 'ฝนตกหนักเป็นช่วง ๆ',
  95: 'พายุฝนฟ้าคะนอง', 96: 'พายุฝนฟ้าคะนอง ลูกเห็บ', 99: 'พายุฝนฟ้าคะนองรุนแรง' };
function weatherText_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('wx');
  if (hit) return hit;
  try {
    const cfg = getConfig_(), lat = Number(cfg.wxLat || 8.3756), lon = Number(cfg.wxLon || 98.7271);
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=temperature_2m,weather_code&hourly=precipitation_probability&forecast_hours=8&timezone=Asia%2FBangkok';
    const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    const code = j.current && j.current.weather_code, t = j.current && j.current.temperature_2m;
    const pp = (j.hourly && j.hourly.precipitation_probability || []).filter(function (x) { return x != null; });
    const maxP = pp.length ? Math.max.apply(null, pp) : null;
    let s = (WX_TH_[code] || 'ไม่ทราบ') + (t != null ? ' · ' + Math.round(t) + '°C' : '') + (maxP != null ? ' · โอกาสฝน 8 ชม.ข้างหน้า ' + maxP + '%' : '');
    cache.put('wx', s, 1800);
    return s;
  } catch (e) { return ''; }
}

/** การ์ดแจ้งก่อนเข้าเวร (พนักงาน) — แบบประกาศ กฟส.อ่าวลึก + ปุ่มโทร */
function shiftMessage_(kind, ymd, name, dd) {
  const def = SLOT_DEF[kind], cfg = getConfig_();
  let title = def.title;
  if (kind === 'emp3' && dd.emp[name] === '2,3') title = 'ช่วง 3 · 16:30 น. (ต่อจากช่วง 2)';
  if (kind === 'emp1' && dd.emp[name] === 'S') title = 'เตรียมพร้อม ช่วง 1 · 00:30 น.';
  const body = [
    { type: 'text', text: OFFICE_TITLE_, weight: 'bold', size: 'sm', wrap: true, color: '#1E1A22' },
    { type: 'text', text: 'ติดต่อได้ 24 ชม. · ' + thDateLong_(ymd) + (dd.day.off ? ' · วันหยุด' : ''), size: 'xs', color: '#6B6372', wrap: true }];
  teamOf_(kind, dd).forEach(function (n, i) {
    const p = personOf_(n), bl = empBlock_(ymd, n);
    body.push({ type: 'separator', margin: 'md' });
    body.push({ type: 'text', text: (i + 1) + '. ' + p.full + (n === name ? '  (คุณ)' : ''), weight: 'bold', size: 'sm', margin: 'md', wrap: true });
    if (bl) body.push({ type: 'text', text: 'เข้า ' + thShortD_(bl.inD) + ' ' + bl.inT + ' → ออก ' + thShortD_(bl.outD) + ' ' + bl.outT + ' น.', size: 'xs', color: '#4A4450', wrap: true });
    const tb = telBtn_('โทร ' + fmtPhone_(p.phone), p.phone, false); if (tb) body.push(tb);
  });
  const sb = who_(dd.emp, function (c) { return c === 'S'; });
  if (kind === 'emp1' && sb.length) body.push({ type: 'text', text: 'เตรียมพร้อม: ' + sb.join(', '), size: 'xs', color: '#6B6372', margin: 'md', wrap: true });
  body.push({ type: 'separator', margin: 'md' });
  const room = telBtn_('ห้องเวรแก้ไฟ ' + fmtPhone_(cfg.roomPhone), cfg.roomPhone, true); if (room) body.push(room);
  body.push(telBtn_('PEA Call Center 1129', '1129', false));
  const wx = weatherText_(); if (wx) body.push({ type: 'text', text: 'สภาพอากาศ: ' + wx, size: 'xs', color: '#4A4450', wrap: true, margin: 'md' });
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
    const p = personOf_(n), bl = empBlock_(ymd, n);
    L.push('', (i + 1) + '.' + p.full);
    if (p.phone) L.push('', '📞 เบอร์โทร ' + fmtPhone_(p.phone));
    if (bl) L.push('', '📅 ประจำวันที่ ' + thFull_(bl.inD), '⏰ เข้าเวรเวลา: ' + bl.inT + ' น.', '📅 ประจำวันที่ ' + thFull_(bl.outD), '⏰ ออกเวรเวลา: ' + bl.outT + ' น.');
  });
  L.push('', '🏢 และเบอร์โทรศัพท์ติดต่อประจำห้องเวรแก้กระแสไฟฟ้าขัดข้อง การไฟฟ้าสาขาอำเภออ่าวลึก ติดต่อได้24ชม.' + (cfg.roomPhone ? ' ' + fmtPhone_(cfg.roomPhone) : ''));
  L.push('', '☎️PEA Call Center 1129');
  const wx = weatherText_(); if (wx) L.push('', 'สภาพอากาศ: ' + wx);
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
    if (p && p.lineUserId) push_(p.lineUserId, [flex_(head + ' ' + (title || ''), bubble_(head, color || '#5B1A63', title || 'ตารางเวรแก้ไฟ', body.split('\n'), buttons || null))], 'change');
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
    return reply_(ev.replyToken, [text_('สวัสดีครับ บอทตารางเวรแก้ไฟ กฟส.อ่าวลึก\nถ้ากลุ่มนี้เป็นกลุ่มคนงาน ให้ หผ.ปร. พิมพ์:\nตั้งกลุ่มคนงาน รหัส\n\nคำสั่งในกลุ่ม: เวรคนงาน · เวรวันนี้ · เวรพรุ่งนี้')]);
  }
  if (ev.type === 'follow') {
    return reply_(ev.replyToken, [text_('สวัสดีครับ ระบบตารางเวรแก้ไฟ กฟส.อ่าวลึก\nลงทะเบียนครั้งแรก พิมพ์:\nลงทะเบียน ชื่อของคุณ รหัส\nเช่น  ลงทะเบียน พงศธร 1234\n(ขอรหัสจาก หผ.ปร.)')]);
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
  return reply_(ev.replyToken, [text_('คำสั่งที่ใช้ได้\n• เวรวันนี้\n• เวรพรุ่งนี้\n• เวรของฉัน\n• เวรคนงาน\n• ขอเปลี่ยน/ลาเวร\n• ตารางเดือนนี้')]);
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
