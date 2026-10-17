/**
 * Line.gs — LINE Official Account
 *  - แจ้งเตือนก่อนเข้ากะ 5 นาที (ส่งเฉพาะคนที่มีเวร)
 *  - คำสั่งในแชต (ตอบกลับฟรี ไม่นับโควต้า): เวรวันนี้ / เวรพรุ่งนี้ / เวรของฉัน / ขอเปลี่ยน/ลาเวร / ตารางเดือนนี้
 *  - ลงทะเบียน: พิมพ์  ลงทะเบียน ชื่อเล่นในระบบ รหัส   เช่น  ลงทะเบียน พงศธร 5678
 *
 * ตั้งค่า: Script properties → LINE_TOKEN = Channel access token (long-lived)
 *        รัน installTriggers() ครั้งเดียว
 */

const SLOT_DEF = {
  wk1:  { hm: '23:55', dayShift: -1, title: 'กะ 1 · 24.00 – 08.00 น.', color: '#26307A' },
  emp1: { hm: '00:25', dayShift: 0,  title: 'ช่วง 1 · 00.30 – 08.30 น.', color: '#26307A' },
  wk2:  { hm: '07:55', dayShift: 0,  title: 'กะ 2 · 08.00 – 16.00 น.', color: '#B4570B' },
  emp2: { hm: '08:25', dayShift: 0,  title: 'ช่วง 2+3 · 08.30 – 00.30 น.', color: '#B4570B' },
  wk3:  { hm: '15:55', dayShift: 0,  title: 'กะ 3 · 16.00 – 24.00 น.', color: '#5B1A63' },
  emp3: { hm: '16:25', dayShift: 0,  title: 'ช่วง 3 · 16.30 – 00.30 น.', color: '#5B1A63' }
};

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

/** ผู้รับของแต่ละ slot */
function slotRecipients_(kind, dd, cfg) {
  const e = dd.emp, w = dd.wk;
  if (kind === 'emp1') {
    const r = who_(e, function (c) { return c === '1'; });
    return String(cfg.notifyStandby) === 'true' ? r.concat(who_(e, function (c) { return c === 'S'; })) : r;
  }
  if (kind === 'emp2') return who_(e, function (c) { return c === '2,3'; });
  if (kind === 'emp3') return who_(e, function (c) { return c === '3'; });
  if (kind === 'wk1') return who_(w, function (c) { return c.split(',').indexOf('1') >= 0; });
  if (kind === 'wk2') return who_(w, function (c) { return c === '2'; });
  if (kind === 'wk3') return who_(w, function (c) { return c.split(',').indexOf('3') >= 0; });
  return [];
}

/* ------------------------- ข้อความ ------------------------- */
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
function webUrl_(view) {
  const u = String(getConfig_().webUrl || '');
  return /^https:\/\//.test(u) ? u + (view ? (u.indexOf('?') < 0 ? '?' : '&') + 'view=' + view : '') : null;
}

function shiftMessage_(kind, ymd, name, dd, full) {
  const def = SLOT_DEF[kind], e = dd.emp, w = dd.wk, lines = ['คุณ' + full.replace(/^นาย/, ''), thDateLong_(ymd) + (dd.day.off ? ' · วันหยุด (ได้ค่าตอบแทน)' : '')];
  if (kind === 'emp2' || kind === 'emp3') {
    const mate = who_(e, function (c) { return (c === '3' || c === '2,3') && true; }).filter(function (n) { return n !== name; });
    lines.push('เวรคู่: ' + (mate.join(', ') || '—'));
  }
  if (kind === 'emp1') {
    if (e[name] === 'S') lines.push('สถานะ: เตรียมพร้อม (เข้าเมื่อได้รับคำสั่ง)');
    lines.push('เตรียมพร้อม: ' + (who_(e, function (c) { return c === 'S'; }).join(', ') || '—'));
  }
  if (kind.indexOf('wk') === 0) {
    const k = kind.slice(2);
    lines.push('คนงานกะ ' + k + ': ' + who_(w, function (c) { return k === '2' ? c === '2' : c.split(',').indexOf(k) >= 0; }).join(', '));
  }
  const btn = [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm',
    action: { type: 'postback', label: 'รับทราบ', data: 'ack|' + kind + '|' + ymd + '|' + name, displayText: 'รับทราบ / เข้าเวรแล้ว' } }];
  const u = webUrl_(''); if (u) btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ตารางเวร', uri: u } });
  return flex_('อีก 5 นาทีเข้าเวร ' + def.title, bubble_('อีก 5 นาทีเข้าเวร', def.color, def.title, lines, btn));
}

/* ------------------------- ส่ง (push) + โควต้า ------------------------- */
function lineToken_() { return PropertiesService.getScriptProperties().getProperty('LINE_TOKEN'); }
function quotaKey_() { return 'PUSH_' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM'); }
function pushCount_() { return Number(PropertiesService.getScriptProperties().getProperty(quotaKey_()) || 0); }

/** priority: 'shift' หยุดส่งเมื่อเหลือโควต้า ≤ 10 เพื่อเก็บไว้แจ้งการเปลี่ยนเวร */
function push_(userId, messages, priority) {
  const tok = lineToken_(); if (!tok || !userId) return false;
  const limit = Number(getConfig_().lineMonthlyLimit || 300), used = pushCount_();
  if (used >= limit || (priority === 'shift' && used >= limit - 10)) { log_('system', 'LINE โควต้าเต็ม', '', 'ข้ามการส่ง ' + used + '/' + limit); return false; }
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok },
    payload: JSON.stringify({ to: userId, messages: messages }), muteHttpExceptions: true });
  if (res.getResponseCode() === 200) {
    PropertiesService.getScriptProperties().setProperty(quotaKey_(), String(used + 1));
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

function notifyPeople_(shorts, head, body, color) {
  const rows = peopleRows_();
  shorts.forEach(function (n) {
    const p = rows.filter(function (r) { return r.short === n; })[0];
    if (p && p.lineUserId) push_(p.lineUserId, [flex_(head, bubble_(head, color || '#5B1A63', 'ตารางเวรแก้ไฟ', body.split('\n'), null))], 'change');
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
      const def = SLOT_DEF[kind], shiftDate = addDays_(d, -def.dayShift);   // wk1 ส่งวันก่อน สำหรับเวรวันถัดไป
      const at = new Date(d + 'T' + def.hm + ':00+07:00');
      if (at >= from && at < to) out.push({ key: shiftDate + '|' + kind, kind: kind, date: shiftDate, at: at.getTime() });
    });
  }
  return out.sort(function (a, b) { return a.at - b.at; });
}

/** วางแผนส่ง ~26 ชม.ข้างหน้า และสร้าง trigger แบบครั้งเดียวตามเวลาเป๊ะ */
function planDay() {
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
      if (dd) slotRecipients_(s.kind, dd, cfg).forEach(function (n) {
        const p = people.filter(function (r) { return r.short === n; })[0];
        if (p && p.lineUserId) push_(p.lineUserId, [shiftMessage_(s.kind, s.date, n, dd, p.full)], 'shift');
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
  if (ev.type === 'follow') {
    return reply_(ev.replyToken, [text_('สวัสดีครับ ระบบตารางเวรแก้ไฟ กฟส.อ่าวลึก\nลงทะเบียนครั้งแรก พิมพ์:\nลงทะเบียน ชื่อของคุณ รหัส\nเช่น  ลงทะเบียน พงศธร 1234\n(ขอรหัสจาก หผ.ปร.)')]);
  }
  if (ev.type === 'postback') {
    const p = String(ev.postback.data || '').split('|');
    if (p[0] === 'ack') { log_(p[3] || uid, 'รับทราบเวร', (p[2] || '').slice(0, 7), p[1] + ' ' + p[2]); return reply_(ev.replyToken, [text_('บันทึกการรับทราบแล้ว ✓')]); }
    return;
  }
  if (ev.type !== 'message' || ev.message.type !== 'text') return;
  const t = String(ev.message.text || '').trim();
  const me = peopleRows_().filter(function (r) { return r.lineUserId && r.lineUserId === uid; })[0];

  let m = t.match(/^ลงทะเบียน\s+(\S+)\s+(\S+)$/);
  if (m) return reply_(ev.replyToken, [text_(register_(uid, m[1], m[2]))]);

  if (!me) return reply_(ev.replyToken, [text_('ยังไม่ได้ลงทะเบียน\nพิมพ์: ลงทะเบียน ชื่อของคุณ รหัส\nเช่น  ลงทะเบียน พงศธร 1234')]);

  if (/^(เวร|เวรวันนี้)$/.test(t) || /^เวรพรุ่งนี้$/.test(t)) {
    const ymd = /พรุ่งนี้/.test(t) ? addDays_(bkkYmd_(), 1) : bkkYmd_();
    const dd = dayData_(ymd);
    if (!dd) return reply_(ev.replyToken, [text_('ยังไม่มีตารางเวรของ ' + thDateLong_(ymd))]);
    return reply_(ev.replyToken, [flex_('เวรแก้ไฟ ' + thDateLong_(ymd),
      bubble_('เวรแก้ไฟ' + (dd.day.off ? ' · วันหยุด' : ''), '#5B1A63', thDateLong_(ymd), [' '].concat(summaryLines_(dd)), null))]);
  }
  if (/^เวรของฉัน$/.test(t)) return reply_(ev.replyToken, [text_(myDuties_(me))]);
  if (/เปลี่ยน|ลาเวร|แลก/.test(t)) {
    const u = webUrl_('viewReq');
    return reply_(ev.replyToken, [text_(u ? 'ยื่นคำขอแลก/ลาเวรได้ที่\n' + u : 'ติดต่อ หผ.ปร. เพื่อขอเปลี่ยนเวร')]);
  }
  if (/ตาราง/.test(t)) { const u = webUrl_(''); return reply_(ev.replyToken, [text_(u ? 'ตารางเวรทั้งเดือน\n' + u : 'ยังไม่ได้ตั้งค่า webUrl')]); }
  return reply_(ev.replyToken, [text_('คำสั่งที่ใช้ได้\n• เวรวันนี้\n• เวรพรุ่งนี้\n• เวรของฉัน\n• ขอเปลี่ยน/ลาเวร\n• ตารางเดือนนี้')]);
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
  return 'ลงทะเบียนสำเร็จ: ' + v[hit][fi] + '\nระบบจะแจ้งเตือนก่อนเข้ากะ 5 นาที\nพิมพ์ "เวรของฉัน" เพื่อดูเวรที่เหลือของเดือน';
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
