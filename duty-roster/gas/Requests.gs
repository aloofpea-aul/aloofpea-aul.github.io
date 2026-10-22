/**
 * Requests.gs — ขอแลกเวร / ลาเวร (หาคนแทน) / แก้ตรงโดยผู้อนุมัติ
 *
 * payload
 *   swap  : { g:'emp'|'wk', a, da, b, db }   a เอาเวรวันที่ da ไปให้ b และรับเวรวันที่ db ของ b มา
 *                                            (da = db → สลับช่วงกันในวันเดียวกัน)
 *   leave : { g, a, d, r }                   a ลาเวรวันที่ d ให้ r มาเข้าแทน
 * ผู้อนุมัติ: ตามชีต Approvers (หผ.ปร. / ชผ. รักษาการแทน)
 */

const FREE_ = { emp: '', wk: '0' };

function isFree_(g, c) { return g === 'emp' ? (c === '' || c === 'S') : c === '0'; }

function codeLabel_(g, c) {
  if (g === 'emp') return ({ '1': 'ช่วง 1', '3': 'ช่วง 3', '2,3': 'ช่วง 2+3', 'S': 'เตรียมพร้อม', '': 'ว่าง' })[c] || c;
  return c === '0' ? 'พักกะ' : 'กะ ' + c;
}

function thShort_(key, d) {
  const ms = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d + ' ' + ms[Number(key.slice(5, 7)) - 1];
}

/** แปลงคำขอเป็นคำสั่งย้ายช่อง */
function buildOps_(type, p) {
  if (type === 'swap') {
    if (Number(p.da) === Number(p.db)) return [{ op: 'xchg', g: p.g, a: p.a, b: p.b, day: Number(p.da) }];
    return [{ op: 'move', g: p.g, from: p.a, to: p.b, day: Number(p.da) },
            { op: 'move', g: p.g, from: p.b, to: p.a, day: Number(p.db) }];
  }
  if (type === 'leave') return [{ op: 'move', g: p.g, from: p.a, to: p.r, day: Number(p.d) }];
  throw new Error('ประเภทคำขอไม่ถูกต้อง');
}

/** ใช้คำสั่งกับข้อมูลเดือน (แก้ data โดยตรง) — ผิดเงื่อนไขจะ throw */
function applyOps_(data, ops) {
  const out = [];
  ops.forEach(function (o) {
    const map = data[o.g]; const i = o.day - 1;
    if (!map) throw new Error('กลุ่มไม่ถูกต้อง');
    if (o.op === 'move') {
      if (!map[o.from] || !map[o.to]) throw new Error('ไม่พบรายชื่อ');
      const c = map[o.from][i], t = map[o.to][i];
      if (isFree_(o.g, c)) throw new Error(o.from + ' ไม่มีเวรวันที่ ' + o.day);
      if (!isFree_(o.g, t)) throw new Error(o.to + ' มีเวร (' + codeLabel_(o.g, t) + ') วันที่ ' + o.day + ' แล้ว');
      map[o.to][i] = c; map[o.from][i] = FREE_[o.g];
      out.push({ day: o.day, g: o.g, from: o.from, to: o.to, code: c, replacedStandby: t === 'S' });
    } else if (o.op === 'xchg') {
      const ca = map[o.a][i], cb = map[o.b][i];
      if (isFree_(o.g, ca) || isFree_(o.g, cb)) throw new Error('วันเดียวกันต้องมีเวรทั้งสองคนจึงจะสลับได้');
      map[o.a][i] = cb; map[o.b][i] = ca;
      out.push({ day: o.day, g: o.g, from: o.a, to: o.b, code: ca }, { day: o.day, g: o.g, from: o.b, to: o.a, code: cb });
    }
  });
  return out;
}

function describe_(month, type, p, data) {
  const lab = function (n, d) { return n + ' (' + thShort_(month, d) + ' ' + codeLabel_(p.g, data[p.g][n][d - 1]) + ')'; };
  if (type === 'swap') return 'แลกเวร: ' + lab(p.a, Number(p.da)) + ' ⇄ ' + lab(p.b, Number(p.db));
  return 'ลาเวร: ' + lab(p.a, Number(p.d)) + ' → ' + p.r + ' เข้าแทน';
}

function reqRows_() {
  const sh = sheet_(SH.REQ); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), createdAt: r[1], month: mkey_(r[2]), type: r[3], payload: JSON.parse(r[4] || '{}'),
      requester: r[5], reason: r[6], status: r[7], decidedBy: r[8], decidedAt: r[9], note: r[10], text: r[11] };
  });
}
function fmtTime_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'd/M/yyyy HH:mm') : String(v || ''); }
function pubReq_(r) {
  return { id: r.id, createdAt: fmtTime_(r.createdAt), month: r.month, type: r.type, payload: r.payload, requester: r.requester,
    reason: r.reason, status: r.status, decidedBy: r.decidedBy, decidedAt: fmtTime_(r.decidedAt), note: r.note, text: r.text };
}
function listRequests_() {
  const all = reqRows_();
  return {
    pending: all.filter(function (r) { return r.status === 'รออนุมัติ'; }).map(pubReq_),
    done: all.filter(function (r) { return r.status !== 'รออนุมัติ' && r.status !== 'ลบแล้ว'; }).slice(-30).reverse().map(pubReq_),
    deleted: all.filter(function (r) { return r.status === 'ลบแล้ว'; }).slice(-20).reverse().map(pubReq_)
  };
}

/** คำขอที่อนุมัติแล้วของเดือน (ใช้ทำเอกสารลาเวร) — วันที่เป็น yyyy-MM-dd */
function monthRequests_(key) {
  const d = function (v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').slice(0, 10); };
  return reqRows_().filter(function (r) { return r.month === key && r.status === 'อนุมัติ'; }).map(function (r) {
    return { id: r.id, created: d(r.createdAt), type: r.type, payload: r.payload, requester: r.requester, reason: r.reason,
      decidedBy: r.decidedBy, decided: d(r.decidedAt), text: r.text };
  });
}

/**
 * ยื่นคำขอ — ถ้า who (ผู้อนุมัติ) ส่ง approveNow มา จะอนุมัติทันที (แก้ตรง)
 * b: { month, type, payload, requester, reason, approveNow }
 */
function createRequest_(b, who) {
  const mo = getMonth_(b.month); if (!mo) throw new Error('ไม่พบตารางเดือน ' + b.month);
  const ops = buildOps_(b.type, b.payload);
  const test = JSON.parse(JSON.stringify(mo.data));
  const dup = dupOf_(b.month, b.type, b.payload);
  if (dup) throw new Error('มีรายการนี้อยู่แล้ว: ' + dup.text + ' — ' + (dup.status === 'อนุมัติ' ? 'อนุมัติเมื่อ ' + fmtTime_(dup.decidedAt) : 'รออนุมัติอยู่') + ' · ไม่ต้องยื่นซ้ำ (ถ้าต้องการยกเลิก ให้ลบรายการนั้น)');
  applyOps_(test, ops);                                     // ตรวจก่อนบันทึก
  const text = describe_(b.month, b.type, b.payload, mo.data);
  const id = 'R' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.random().toString(36).slice(2, 5).toUpperCase();
  sheet_(SH.REQ).appendRow([id, new Date(), "'" + b.month, b.type, JSON.stringify(b.payload), b.requester || (who && who.name) || '',
    b.reason || '', 'รออนุมัติ', '', '', '', text]);
  log_(b.requester || (who && who.name) || '-', 'ยื่นคำขอ', b.month, text);
  if (who && b.approveNow) return decideRequest_(id, true, who, 'แก้ไขโดยผู้อนุมัติ');
  try { notifyApprovers_('มีคำขอใหม่รออนุมัติ', text + (b.reason ? '\nเหตุผล: ' + b.reason : '')); } catch (e) { log_('system', 'LINE error', b.month, String(e)); }
  return pubReq_(reqRows_().filter(function (r) { return r.id === id; })[0]);
}

function decideRequest_(id, approve, who, note) {
  const r = reqRows_().filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('ไม่พบคำขอ ' + id);
  if (r.status !== 'รออนุมัติ') throw new Error('คำขอนี้' + r.status + 'ไปแล้ว');
  let changes = [];
  if (approve) {
    const mo = getMonth_(r.month);
    changes = applyOps_(mo.data, buildOps_(r.type, r.payload));   // ตรวจซ้ำกับตารางล่าสุด
    mo.data.rev = (mo.data.rev || 0) + 1;
    mo.data.changes = (mo.data.changes || []).concat(changes.map(function (c) {
      return Object.assign({ req: id, by: who.name, at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') }, c);
    }));
    saveMonth_(r.month, mo.status, mo.data, mo.stateAfter, mo.note);
  }
  const st = approve ? 'อนุมัติ' : 'ไม่อนุมัติ';
  sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([[st, who.name + ' (' + who.role + ')', new Date(), note || '']]);
  log_(who.name, st, r.month, r.text);
  try {
    const names = {};
    if (r.type === 'swap') { names[r.payload.a] = 1; names[r.payload.b] = 1; } else { names[r.payload.a] = 1; names[r.payload.r] = 1; }
    const fullOf = {}; readTable_(SH.PEOPLE).forEach(function (p) { fullOf[p.short] = String(p.full || p.short).replace(/\s+/g, ' '); });
    let lines, title, btn = [];
    if (approve) {
      title = changes.map(function (c) { return thShort_(r.month, c.day) + ' ' + codeLabel_(c.g, c.code); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
      lines = [];
      changes.forEach(function (c) { lines.push(thShort_(r.month, c.day) + ' ' + codeLabel_(c.g, c.code)); lines.push('ผู้มอบเวร: ' + (fullOf[c.from] || c.from)); lines.push('ผู้อยู่เวรแทน: ' + (fullOf[c.to] || c.to)); });
      if (r.reason) lines.push('เหตุผล: ' + r.reason);
      lines.push('อนุมัติโดย ' + who.name + (note ? ' · ' + note : ''));
      const u1 = webUrl_(''); if (u1) btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ตารางเวร', uri: u1 } });
      const u2 = r.payload.g === 'emp' ? webUrl_('viewReport', { kind: 'leave', m: r.month, id: id }) : null;
      if (u2) btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'บันทึกลาเวร (PDF)', uri: u2 } });
    } else {
      title = 'ไม่อนุมัติ'; lines = [r.text, 'โดย ' + who.name + (note ? '\nหมายเหตุ: ' + note : '')];
    }
    notifyPeople_(Object.keys(names), approve ? (r.type === 'swap' ? 'อนุมัติแลกเวรแล้ว' : 'อนุมัติลาเวรแล้ว') : 'คำขอเปลี่ยนเวร',
      lines.join('\n'), approve ? '#5B1A63' : '#8A2B2B', title, btn);
  } catch (e) { log_('system', 'LINE error', r.month, String(e)); }
  return pubReq_(reqRows_().filter(function (x) { return x.id === id; })[0]);
}

/* ======================================================================
 *  ผู้ตรวจเวร (หมุนคนละ 3 วัน) + รายงานการอยู่เวร (กรอกจากแอป/ลิงก์ LINE)
 * ====================================================================== */

/** ผู้ตรวจเวรตามลำดับ (คอลัมน์ inspOrder ในชีต People ว่าง = ไม่ใช่ผู้ตรวจ) */
function inspectors_() {
  peopleCols_();
  return readTable_(SH.PEOPLE).filter(function (r) { return r.inspOrder !== '' && r.inspOrder != null && Number(r.inspOrder) > 0 && r.active !== false && r.active !== 'FALSE'; })
    .sort(function (a, b) { return Number(a.inspOrder) - Number(b.inspOrder); })
    .map(function (r) { return { short: r.short, full: String(r.full).replace(/\s+/g, ' ').trim(), pos: String(r.inspPos || '').trim(), order: Number(r.inspOrder) }; });
}
/** ตารางผู้ตรวจของเดือน: คนละ blockDays วันต่อกัน ต่อจากเดือนก่อน */
function inspGenerate_(y, m, prevData) {
  const list = inspectors_().map(function (x) { return x.short; }); const N = daysInMonth_(y, m), out = [];
  if (!list.length) return { insp: [], inspAfter: null };
  const block = Number(getConfig_().inspBlockDays || 3);
  let st = prevData && prevData.inspAfter;
  if (!st || list.indexOf(st.who) < 0) {
    const last = prevData && prevData.insp && prevData.insp.length ? prevData.insp[prevData.insp.length - 1] : null;
    const i = list.indexOf(last);
    st = { who: list[(i + 1) % list.length], used: 0 };        // เริ่มคนถัดไปจากวันสุดท้ายของเดือนก่อน
  }
  let who = st.who, used = st.used;
  for (let d = 0; d < N; d++) {
    if (used >= block) { who = list[(list.indexOf(who) + 1) % list.length]; used = 0; }
    out.push(who); used++;
  }
  return { insp: out, inspAfter: { who: who, used: used } };
}
/** เติมตารางผู้ตรวจให้เดือนที่ยังไม่มี (ไม่แตะเดือนที่กำหนดเองแล้ว) */
function ensureInsp_(key) {
  const mo = getMonth_(key); if (!mo) return null;
  if (mo.data.insp && mo.data.insp.length) return mo;
  const y = +key.slice(0, 4), m = +key.slice(5, 7), prev = getMonth_(prevKey_(y, m));
  const pd = prev ? ((prev.data.insp && prev.data.insp.length) ? prev.data : (ensureInsp_(prev.month) || prev).data) : null;
  const g = inspGenerate_(y, m, pd);
  mo.data.insp = g.insp; mo.data.inspAfter = g.inspAfter;
  saveMonth_(key, mo.status, mo.data, mo.stateAfter, mo.note);
  return mo;
}
function inspOf_(ymd) {
  const mo = getMonth_(ymd.slice(0, 7)); if (!mo || !mo.data.insp) return '';
  return mo.data.insp[+ymd.slice(8, 10) - 1] || '';
}

/* ---- ลิงก์ลงรายงานแบบมีลายเซ็น (ไม่ต้องล็อกอิน) ---- */
function repSecret_() {
  const p = PropertiesService.getScriptProperties(); let s = p.getProperty('REP_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('REP_SECRET', s); }
  return s;
}
function repToken_(k, short, role, exp) {
  const sig = Utilities.computeHmacSha256Signature(k + '|' + short + '|' + role + '|' + exp, repSecret_());
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 24);
}
function repLink_(k, short, role) {
  const exp = Date.now() + 48 * 3600000;
  return webUrl_('viewDaily', { rep: k, u: short, r: role, x: exp, t: repToken_(k, short, role, exp) });
}
/** ชุดเวรของคนนี้ที่กำลังอยู่ หรือเพิ่งจบไม่เกิน 12 ชม. → 'yyyy-MM-dd|p1' / '|p3' */
function myRecentBlock_(short) {
  const now = Date.now(), today = bkkYmd_(), cand = [];
  [addDays_(today, -1), today].forEach(function (d) {
    const c = empCode_(d, short);
    if (c === '1') cand.push({ k: d + '|p1', s: new Date(d + 'T00:30:00+07:00').getTime(), e: new Date(d + 'T08:30:00+07:00').getTime() });
    if (c === '3' || c === '2,3') cand.push({ k: d + '|p3', s: new Date(d + 'T' + (c === '3' ? '16:30' : '08:30') + ':00+07:00').getTime(), e: new Date(addDays_(d, 1) + 'T00:30:00+07:00').getTime() });
  });
  const ok = cand.filter(function (b) { return now >= b.s - 3600000 && now <= b.e + 12 * 3600000; });
  return ok.length ? ok[ok.length - 1] : null;
}

/* ---- เก็บรายงาน: ชีต Reports  key | data(JSON) | updatedAt | by ---- */
function repSheet_() {
  let sh = sheet_('Reports');
  if (!sh) { sh = ss_().insertSheet('Reports'); sh.getRange(1, 1, 1, 4).setValues([['key', 'data', 'updatedAt', 'by']]).setFontWeight('bold'); sh.setFrozenRows(1); sh.getRange('A:A').setNumberFormat('@'); }
  return sh;
}
function reportsOf_(month) {
  const sh = repSheet_(); if (sh.getLastRow() < 2) return {};
  const out = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
    const k = String(r[0]).replace(/^'/, '');
    if (k.indexOf(month) === 0) { try { out[k] = JSON.parse(r[1] || '{}'); out[k]._by = r[3]; out[k]._at = r[2] instanceof Date ? Utilities.formatDate(r[2], TZ, 'd/M/yyyy HH:mm') : String(r[2]); } catch (e) {} }
  });
  return out;
}
const DUTY_FIELDS_ = ['arr', 'dep', 'hv', 'lv', 'temp', 'comm', 'att', 'other'];
const INSP_FIELDS_ = ['insp'];
/** b: { k, data, pin? | u, r, x, t } */
function saveReport_(b) {
  const k = String(b.k || ''); if (!/^\d{4}-\d{2}-\d{2}\|p[13]$/.test(k)) throw new Error('รหัสรายงานไม่ถูกต้อง');
  let fields, by;
  const who = approverByPin_(b.pin);
  if (who) { fields = DUTY_FIELDS_.concat(INSP_FIELDS_); by = who.short || who.name; }
  else {
    if (!b.t || Number(b.x) < Date.now() || repToken_(b.r === 'insp' ? k.slice(0, 10) : k, b.u, b.r, b.x) !== b.t) throw new Error('ลิงก์หมดอายุหรือไม่ถูกต้อง — ขอลิงก์ใหม่ทาง LINE (พิมพ์ "รายงานเวร" หรือ "ตรวจเวร")');
    if (b.r === 'insp') { if (b.k.slice(0, 10) !== k.slice(0, 10)) throw new Error('ไม่ใช่วันที่ตรวจ'); fields = INSP_FIELDS_; }
    else fields = DUTY_FIELDS_;
    by = b.u;
  }
  const sh = repSheet_(), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
  let row = -1, cur = {};
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).replace(/^'/, '') === k) { row = i + 2; try { cur = JSON.parse(v[i][1] || '{}'); } catch (e) {} break; }
  fields.forEach(function (f) { if (b.data && f in b.data) cur[f] = b.data[f]; });
  if (fields === INSP_FIELDS_ && cur.insp) cur.insp.by = by;
  const rec = ["'" + k, JSON.stringify(cur), new Date(), by];
  if (row > 0) sh.getRange(row, 1, 1, 4).setValues([rec]); else sh.appendRow(rec);
  log_(by, 'รายงานเวร', k.slice(0, 7), k + ' ' + fields.join(','));
  return reportsOf_(k.slice(0, 7))[k];
}

/** ลบคำขอ/เอกสาร (ผู้อนุมัติ/แอดมิน) — revert=true คืนตารางเวรให้เหมือนก่อนอนุมัติ (ถ้ายังไม่ถูกแก้ทับ) */
/** ช่องเวรที่คำขอแตะ (ใช้ตรวจยื่นซ้ำ) */
function slotKey_(type, p) {
  const sl = type === 'swap' ? [p.a + '@' + Number(p.da), p.b + '@' + Number(p.db)].sort().join('&') : p.a + '@' + Number(p.d) + '>' + p.r;
  return type + '|' + p.g + '|' + sl;
}
function dupOf_(month, type, p) {
  const k = slotKey_(type, p);
  return reqRows_().filter(function (r) { return r.month === month && (r.status === 'อนุมัติ' || r.status === 'รออนุมัติ') && r.type === type && slotKey_(r.type, r.payload) === k; })[0] || null;
}

/** ลบคำขอ (ผู้อนุมัติ/แอดมิน) — ที่อนุมัติแล้วคืนตารางให้เหมือนก่อนอนุมัติเสมอ
 *  ถ้าช่องเดียวกันถูกเปลี่ยนต่อโดยรายการที่ใหม่กว่า → ไม่ลบ คืน blocked ให้ลบรายการนั้นก่อน */
function deleteRequest_(id, revertIgnored, who) {
  const all = reqRows_(), r = all.filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('ไม่พบรายการ ' + id);
  if (r.status === 'ลบแล้ว') throw new Error('รายการนี้ถูกลบไปแล้ว');
  let reverted = 0, note;
  const mo = r.status === 'อนุมัติ' ? getMonth_(r.month) : null;
  if (mo) {
    const ch = mo.data.changes || [], idx = [];
    ch.forEach(function (c, i) { if (c.req === id) idx.push(i); });
    if (idx.length) {
      const last = idx[idx.length - 1], mine = idx.map(function (i) { return ch[i]; });
      const people = {}; mine.forEach(function (c) { people[c.from] = 1; people[c.to] = 1; });
      const blk = {};
      ch.forEach(function (c, i) { if (i > last && c.req !== id && mine.some(function (m) { return m.g === c.g && m.day === c.day && (people[c.from] || people[c.to]); })) blk[c.req] = 1; });
      const ids = Object.keys(blk);
      if (ids.length) return { blocked: ids.map(function (x) { const q = all.filter(function (y) { return y.id === x; })[0]; return { id: x, text: q ? q.text : x, at: q ? fmtTime_(q.decidedAt) : '' }; }) };
      // ตรวจทุกช่องก่อน แล้วค่อยคืนพร้อมกัน (ไม่คืนครึ่ง ๆ กลาง ๆ)
      const test = JSON.parse(JSON.stringify(mo.data));
      const sameDaySwap = r.type === 'swap' && Number(r.payload.da) === Number(r.payload.db);
      const undo = function (data) {
        if (sameDaySwap) {
          const c = mine[0], map = data[c.g], i = c.day - 1;
          if (map[c.from][i] !== mine[1].code || map[c.to][i] !== c.code) return false;
          map[c.from][i] = c.code; map[c.to][i] = mine[1].code; return true;
        }
        return mine.slice().reverse().every(function (c) {
          const map = data[c.g], i = c.day - 1;
          if (!map[c.to] || map[c.to][i] !== c.code || !isFree_(c.g, map[c.from][i])) return false;
          map[c.from][i] = c.code; map[c.to][i] = c.replacedStandby ? 'S' : FREE_[c.g]; return true;
        });
      };
      if (!undo(test)) return { mismatch: true };
      undo(mo.data); reverted = mine.length;
      mo.data.rev = (mo.data.rev || 0) + 1;
      mo.data.changes = ch.filter(function (c) { return c.req !== id; });
      saveMonth_(r.month, mo.status, mo.data, mo.stateAfter, mo.note);
    }
    note = 'ลบโดย ' + who.name + (reverted ? ' · คืนตารางแล้ว' : ' · ไม่มีข้อมูลการเปลี่ยนในตาราง');
  } else note = 'ลบโดย ' + who.name + (r.status === 'รออนุมัติ' ? ' · ยังไม่อนุมัติ ตารางไม่เปลี่ยน' : '');
  sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([['ลบแล้ว', who.name + ' (' + who.role + ')', new Date(), note]]);
  log_(who.name, 'ลบคำขอ', r.month, r.text + ' | ' + note);
  return { id: id, reverted: reverted, note: note };
}

/** แก้ข้อมูลเอกสาร (เหตุผล / วันที่ขอเสนอ / คำสั่ง) — ไม่แตะตารางเวร */
function editRequest_(b, who) {
  const r = reqRows_().filter(function (x) { return x.id === String(b.id); })[0];
  if (!r) throw new Error('ไม่พบรายการ');
  if (r.status === 'ลบแล้ว') throw new Error('รายการนี้ถูกลบไปแล้ว');
  const p = r.payload, w = b.why || {};
  const KS = { sick: 'ลาป่วย', errand: 'ลากิจ', vacation: 'ลาพักผ่อน', private: 'ธุระส่วนตัว', official: 'ปฏิบัติงานราชการ' };
  if (w.k && !KS[w.k]) throw new Error('เหตุผลไม่ถูกต้อง');
  p.why = { k: w.k || (p.why && p.why.k) || '' };
  if (p.why.k === 'official') { p.why.order = String(w.order || '').slice(0, 80); p.why.orderDate = String(w.orderDate || '').slice(0, 10); }
  if (b.signer && b.signer.name) p.signer = { k: String(b.signer.k || 'custom').slice(0, 10), name: String(b.signer.name).slice(0, 80), title: String(b.signer.title || '').slice(0, 120) };
  if (b.docDate !== undefined) p.docDate = /^\d{4}-\d{2}-\d{2}$/.test(String(b.docDate)) ? b.docDate : '';
  const reason = KS[p.why.k] ? KS[p.why.k] + (p.why.k === 'official' && p.why.order ? ' คำสั่ง ' + p.why.order : '') : r.reason;
  sheet_(SH.REQ).getRange(r.row, 5).setValue(JSON.stringify(p));
  sheet_(SH.REQ).getRange(r.row, 7).setValue(reason);
  log_(who.name, 'แก้เอกสารคำขอ', r.month, r.text + ' | ' + reason + (p.docDate ? ' | เสนอ ' + p.docDate : ''));
  return pubReq_(reqRows_().filter(function (x) { return x.id === r.id; })[0]);
}

/* ======================================================================
 *  เหตุการณ์ไฟดับ (บันทึกโดยคนอยู่เวร) — ชีต Outages
 *  id | key (yyyy-MM-dd|p1/p3) | data(JSON) | updatedAt | by | deleted
 *  สาเหตุใช้ CauseType / CauseData ชุดเดียวกับข้อมูลไฟฟ้าขัดข้องของ กฟภ. (ระบบวิเคราะห์ข้อมูลไฟฟ้า)
 *  แก้ชั่วคราว → ส่งเป็นจุดที่พบใน Patrol (ชีต SLD อ่าวลึก - ฐานข้อมูล) เพื่อตามแก้ถาวร
 * ====================================================================== */

const OUT_SHEET_ = 'Outages';
const SLD_SHEET_ID_DEFAULT_ = '1m7dL33F1JwdK60G640xLjlWntkPrY5ulb4tpkpf04LU';
const OUT_MATS_DEFAULT_ = [
  ['ฟิวส์ลิงก์ 6K', 'ชิ้น'], ['ฟิวส์ลิงก์ 10K', 'ชิ้น'], ['ฟิวส์ลิงก์ 15K', 'ชิ้น'], ['ฟิวส์ลิงก์ 25K', 'ชิ้น'],
  ['ฟิวส์ลิงก์ 40K', 'ชิ้น'], ['ฟิวส์ลิงก์ 50K', 'ชิ้น'], ['ฟิวส์ลิงก์ 65K', 'ชิ้น'],
  ['ฟิวส์ NH 100A', 'ชิ้น'], ['ฟิวส์ NH 160A', 'ชิ้น'], ['ฟิวส์ NH 200A', 'ชิ้น'], ['ฟิวส์ NH 250A', 'ชิ้น'],
  ['ลูกถ้วยก้านตรง (Pin)', 'ลูก'], ['ลูกถ้วยแขวน (Suspension)', 'ลูก'], ['ลูกถ้วยไลน์โพสต์', 'ลูก'],
  ['ล่อฟ้า (LA)', 'ชุด'], ['ดรอปเอาต์ฟิวส์คัตเอาต์', 'ชุด'], ['คอนเนคเตอร์', 'ตัว'], ['ฮอตไลน์แคลมป์', 'ตัว'],
  ['สายอลูมิเนียม', 'เมตร'], ['เทปพันสาย', 'ม้วน']
].map(function (x) { return { n: x[0], u: x[1] }; });

function outSheet_() {
  let sh = sheet_(OUT_SHEET_);
  if (!sh) {
    sh = ss_().insertSheet(OUT_SHEET_);
    sh.getRange(1, 1, 1, 6).setValues([['id', 'key', 'data', 'updatedAt', 'by', 'deleted']]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.getRange('A:B').setNumberFormat('@');
  }
  return sh;
}
function outRows_() {
  const sh = outSheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().map(function (r, i) {
    let d = {}; try { d = JSON.parse(r[2] || '{}'); } catch (e) {}
    return { row: i + 2, id: String(r[0]), k: String(r[1]).replace(/^'/, ''), d: d, deleted: r[5] === true || r[5] === 'TRUE' };
  });
}
/** รายการไฟดับของเดือน (ไม่รวมที่ลบ) + สถานะใน Patrol */
function outagesOf_(month) {
  const list = outRows_().filter(function (x) { return !x.deleted && x.k.indexOf(month) === 0; }).map(function (x) { return x.d; });
  const ids = list.filter(function (o) { return o.patrol && o.patrol.id; }).map(function (o) { return o.patrol.id; });
  if (ids.length) {
    const st = patrolStatus_(ids);
    list.forEach(function (o) { if (o.patrol && st[o.patrol.id]) o.patrol.status = st[o.patrol.id]; });
  }
  return list.sort(function (a, b) { return String(a.off).localeCompare(String(b.off)); });
}

/** สิทธิ์บันทึก: ลิงก์ LINE ของคนเวรชุดนั้น หรือ PIN ผู้อนุมัติ */
function outAuth_(b, k) {
  const who = approverByPin_(b.pin);
  if (who) return who.short || who.name;
  if (b.hubUser && b.hubPass && !b.t) {                       // ล็อกอินศูนย์รวมงานและมีสิทธิ์ใช้ตารางเวร
    if (hubAllowed_(String(b.hubUser), String(b.hubPass))) return String(b.hubUser).slice(0, 60);
    throw new Error('บัญชีศูนย์รวมงานนี้ไม่มีสิทธิ์ใช้ตารางเวร — ใส่ PIN ผู้อนุมัติ หรือใช้ลิงก์จาก LINE');
  }
  if (b.r !== 'duty' || !b.t || Number(b.x) < Date.now() || repToken_(String(b.rk || k), b.u, 'duty', b.x) !== b.t)
    throw new Error('ไม่มีสิทธิ์บันทึก — ล็อกอินศูนย์รวมงาน, ใช้ลิงก์จาก LINE ของเวรชุดนี้ หรือใส่ PIN ผู้อนุมัติ');
  if (String(b.rk || '') !== k) throw new Error('ลิงก์นี้ใช้บันทึกได้เฉพาะเวรของตัวเอง');
  return b.u;
}

const OUT_KEYS_ = ['lvl', 'off', 'on', 'ws', 'we', 'feeder', 'dev', 'cust', 'lat', 'lon', 'cBtn', 'cType', 'cData', 'known', 'weather', 'fix', 'mats', 'detail', 'wo', 'place'];
function saveOutage_(b) {
  const k = String(b.k || ''); if (!/^\d{4}-\d{2}-\d{2}\|p[13]$/.test(k)) throw new Error('รหัสเวรไม่ถูกต้อง');
  const by = outAuth_(b, k), o = b.o || {};
  if (o.lvl !== 'hv' && o.lvl !== 'lv') throw new Error('เลือกระดับแรงดัน');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(o.off || ''))) throw new Error('ใส่เวลาไฟดับ');
  if (o.on && String(o.on) < String(o.off)) throw new Error('เวลาไฟมาต้องหลังเวลาไฟดับ');
  const sh = outSheet_(), rows = outRows_();
  let cur = null;
  if (o.id) cur = rows.filter(function (x) { return x.id === String(o.id) && !x.deleted; })[0] || null;
  if (cur && cur.k !== k) throw new Error('รายการนี้อยู่คนละเวร');
  const d = cur ? cur.d : { id: 'OUT-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100), k: k, created: new Date().toISOString(), createdBy: by };
  OUT_KEYS_.forEach(function (f) { if (f in o) d[f] = o[f]; });
  if (!Array.isArray(d.mats)) d.mats = [];
  d.mats = d.mats.filter(function (m) { return m && m.n && Number(m.q) > 0; }).map(function (m) { return { n: String(m.n).slice(0, 80), q: Number(m.q), u: String(m.u || '') }; });
  d.updated = new Date().toISOString(); d.by = by;
  const isNew = !cur;
  // แก้ชั่วคราว + มีพิกัด → ส่งเข้า Patrol ครั้งเดียว
  if (d.fix === 'temp' && !(d.patrol && d.patrol.id)) {
    try { d.patrol = patrolPush_(d, by); } catch (e) { d.patrol = { err: String(e.message || e) }; }
  }
  const rec = [d.id, "'" + k, JSON.stringify(d), new Date(), by, false];
  if (cur) sh.getRange(cur.row, 1, 1, 6).setValues([rec]); else sh.appendRow(rec);
  log_(by, isNew ? 'บันทึกไฟดับ' : 'แก้ไขไฟดับ', k.slice(0, 7), d.id + ' ' + (d.feeder || '') + ' ' + ((d.dev && d.dev.id) || ''));
  if (isNew && d.lvl === 'hv') { try { notifyOutage_(d, by); } catch (e) { log_('system', 'แจ้งไฟดับไม่สำเร็จ', '', String(e)); } }
  return d;
}
function deleteOutage_(b) {
  const id = String(b.id || ''); const x = outRows_().filter(function (r) { return r.id === id && !r.deleted; })[0];
  if (!x) throw new Error('ไม่พบรายการ');
  const by = outAuth_(b, x.k);
  outSheet_().getRange(x.row, 4, 1, 3).setValues([[new Date(), by, true]]);
  log_(by, 'ลบไฟดับ', x.k.slice(0, 7), id);
  return { id: id };
}
function saveOutMats_(b) {
  const who = approverByPin_(b.pin); if (!who) throw new Error('PIN ไม่ถูกต้อง');
  const list = (b.mats || []).filter(function (m) { return m && String(m.n || '').trim(); })
    .map(function (m) { return { n: String(m.n).trim().slice(0, 80), u: String(m.u || 'ชิ้น').trim().slice(0, 12) }; });
  setConfigKey_('outMats', JSON.stringify(list));
  log_(who.short || who.name, 'แก้รายการอุปกรณ์แก้ไฟ', '', list.length + ' รายการ');
  return list;
}
function migrateOut_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('MIG_OUT1')) return;
  const cfg = getConfig_();
  if (!cfg.outMats) setConfigKey_('outMats', JSON.stringify(OUT_MATS_DEFAULT_));
  if (!cfg.outAlert) setConfigKey_('outAlert', 'feeder');
  if (!cfg.sldSheetId) setConfigKey_('sldSheetId', SLD_SHEET_ID_DEFAULT_);
  outSheet_();
  props.setProperty('MIG_OUT1', '1');
}

/* ---------------- LINE: ไฟดับแรงสูง → หผ./ชผ. ----------------
 * outAlert = feeder (ค่าเริ่มต้น: เฉพาะเบรกเกอร์/รีโคลสเซอร์/ทั้งฟีดเดอร์ — ประหยัดโควต้าฟรี) | all | off */
function notifyOutage_(d, by) {
  const mode = String(getConfig_().outAlert || 'feeder');
  if (mode === 'off') return;
  const t = String((d.dev && d.dev.type) || '').toUpperCase();
  const feederLevel = !d.dev || !d.dev.id || /^(WR|WB|WS|CB|MR|WC)$/.test(t);
  if (mode === 'feeder' && !feederLevel) return;
  const hm = function (s) { return s ? String(s).slice(11, 16).replace(':', '.') : ''; };
  const where = [d.feeder, d.dev && d.dev.id ? d.dev.id + (d.dev.desc ? ' ' + d.dev.desc : '') : 'ทั้งฟีดเดอร์'].filter(String).join(' · ');
  const lines = [where,
    'ดับ ' + hm(d.off) + ' น.' + (d.on ? ' · มา ' + hm(d.on) + ' น.' : ' · ยังไม่จ่ายไฟ'),
    'สาเหตุ: ' + ([d.cType, d.cData].filter(String).join(' / ') || 'ยังไม่ทราบ') + (d.cust ? ' · ผู้ใช้ไฟ ~' + d.cust + ' ราย' : ''),
    'บันทึกโดย ' + by];
  const u = webUrl_('viewDaily', { m: d.k.slice(0, 7), day: Number(d.k.slice(8, 10)) });
  const btn = u ? [{ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูรายละเอียด', uri: u } }] : null;
  approverList_().forEach(function (a) {
    const id = lineIdOf_(a.short);
    if (id) push_(id, [flex_('ไฟดับแรงสูง ' + where, bubble_('แจ้งไฟดับแรงสูง', '#8A2B2B', 'ไฟดับ ' + (d.feeder || 'แรงสูง'), lines, btn))], 'change');
  });
}

/* ---------------- Patrol (ชีตเดียวกับระบบ SLD) ---------------- */
function sldSS_() { return SpreadsheetApp.openById(String(getConfig_().sldSheetId || SLD_SHEET_ID_DEFAULT_)); }
const OUT_PATROL_TYPE_ = ['OUTAGE', 'แก้ไฟดับชั่วคราว (จากเวร)', 'หน้างาน', 1, 'TRUE'];
function patrolTypeOf_(d) {
  const mats = (d.mats || []).map(function (m) { return m.n; }).join(' ');
  if (d.cType === 'ต้นไม้') return 'TREE';
  if (d.cType === 'สัตว์') return 'ANIMAL';
  if (d.cData === 'โหลดเกินพิกัด') return 'OVERLOAD';
  if (/ลูกถ้วย/.test(mats)) return 'INSUL';
  if (/ดรอปเอาต์/.test(mats)) return 'DROPOUT';
  if (/คอนเนคเตอร์|แคลมป์/.test(mats)) return 'HOTSPOT';
  return OUT_PATROL_TYPE_[0];
}
function patrolPush_(d, by) {
  const lat = Number(d.lat != null && d.lat !== '' ? d.lat : d.dev && d.dev.lat), lon = Number(d.lon != null && d.lon !== '' ? d.lon : d.dev && d.dev.lon);
  if (!isFinite(lat) || !isFinite(lon) || !lat || !lon) return { err: 'ยังไม่มีพิกัด — เลือกอุปกรณ์จาก SLD หรือกด GPS แล้วบันทึกอีกครั้ง' };
  const ss = sldSS_();
  const ts = ss.getSheetByName('PatrolType');
  if (ts) { const codes = ts.getRange(1, 1, ts.getLastRow(), 1).getValues().map(function (r) { return String(r[0]); }); if (codes.indexOf(OUT_PATROL_TYPE_[0]) < 0) ts.appendRow(OUT_PATROL_TYPE_); }
  const sh = ss.getSheetByName('PatrolFinding'); if (!sh) return { err: 'ไม่พบชีต PatrolFinding ในระบบ SLD' };
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const now = new Date(), id = 'F-' + Utilities.formatDate(now, 'GMT+7', 'yyMMdd-HHmmss') + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const hm = function (s) { return s ? String(s).slice(11, 16).replace(':', '.') : ''; };
  const p = personOf_(by);
  const ds = String(d.off), dth = Number(ds.slice(8, 10)) + '/' + Number(ds.slice(5, 7)) + '/' + (Number(ds.slice(0, 4)) + 543);
  const detail = ['แก้ไฟดับชั่วคราวจากเวร ' + dth + ' ' + hm(d.off) + ' น.',
    'สาเหตุ: ' + ([d.cType, d.cData].filter(String).join(' / ') || 'ไม่ทราบ'),
    d.detail ? 'สิ่งที่ทำ: ' + d.detail : '',
    (d.mats || []).length ? 'ใช้ไป: ' + d.mats.map(function (m) { return m.n + ' ×' + m.q; }).join(', ') : '',
    'อ้างอิง ' + d.id].filter(String).join(' · ');
  const val = { FindingID: id, CreatedAt: now, CreatedBy: (p && p.full) || by, CreatorRole: 'เวรแก้ไฟ', CreatorOrg: 'กฟส.อ่าวลึก',
    AnchorType: d.dev && d.dev.id ? 'DEVICE' : 'POINT', AnchorRef: (d.dev && d.dev.id) || '', Lat: lat, Lon: lon, GpsAccuracy: '',
    FeederID: d.feeder || '', ProblemType: patrolTypeOf_(d), Severity: 1, Detail: detail, Source: 'outage', Status: 'ใหม่',
    NearPlace: (d.dev && d.dev.desc) || d.place || '' };
  sh.appendRow(head.map(function (h) { return h in val ? val[h] : ''; }));
  return { id: id, status: 'ใหม่', at: now.toISOString() };
}
/** สถานะจุดที่พบใน Patrol (แคช 10 นาที) */
function patrolStatus_(ids) {
  const cache = CacheService.getScriptCache(); let m = null;
  try { m = JSON.parse(cache.get('patrolSt') || 'null'); } catch (e) {}
  if (!m) {
    m = {};
    try {
      const sh = sldSS_().getSheetByName('PatrolFinding');
      if (sh && sh.getLastRow() > 1) {
        const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), si = head.indexOf('Status'), oi = head.indexOf('Source');
        sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(si, oi) + 1).getValues().forEach(function (r) { if (String(r[oi]) === 'outage') m[String(r[0])] = String(r[si] || ''); });
      }
      cache.put('patrolSt', JSON.stringify(m), 600);
    } catch (e) { return {}; }
  }
  return m;
}
