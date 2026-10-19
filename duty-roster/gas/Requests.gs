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
    done: all.filter(function (r) { return r.status !== 'รออนุมัติ' && r.status !== 'ลบแล้ว'; }).slice(-30).reverse().map(pubReq_)
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
function deleteRequest_(id, revert, who) {
  const r = reqRows_().filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('ไม่พบรายการ ' + id);
  if (r.status === 'ลบแล้ว') throw new Error('รายการนี้ถูกลบไปแล้ว');
  let reverted = 0, skipped = 0;
  const mo = getMonth_(r.month);
  if (mo && r.status === 'อนุมัติ') {
    const mine = (mo.data.changes || []).filter(function (c) { return c.req === id; });
    if (revert && mine.length) {
      const sameDaySwap = r.type === 'swap' && Number(r.payload.da) === Number(r.payload.db);
      if (sameDaySwap) {
        const c = mine[0], map = mo.data[c.g], i = c.day - 1;
        if (map[c.from][i] === mine[1].code && map[c.to][i] === c.code) { map[c.from][i] = c.code; map[c.to][i] = mine[1].code; reverted = 2; } else skipped = 2;
      } else {
        mine.slice().reverse().forEach(function (c) {
          const map = mo.data[c.g], i = c.day - 1;
          if (map[c.to] && map[c.to][i] === c.code && isFree_(c.g, map[c.from][i])) {
            map[c.from][i] = c.code; map[c.to][i] = c.replacedStandby ? 'S' : FREE_[c.g]; reverted++;
          } else skipped++;
        });
      }
      if (reverted) mo.data.rev = (mo.data.rev || 0) + 1;
    }
    mo.data.changes = (mo.data.changes || []).filter(function (c) { return c.req !== id; });
    saveMonth_(r.month, mo.status, mo.data, mo.stateAfter, mo.note);
  }
  const note = 'ลบโดย ' + who.name + (revert ? (reverted ? ' · คืนตารางแล้ว' : '') + (skipped ? ' · คืนไม่ได้ ' + skipped + ' ช่อง (ตารางถูกแก้ทับ)' : '') : ' · ไม่คืนตาราง');
  sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([['ลบแล้ว', who.name + ' (' + who.role + ')', new Date(), note]]);
  log_(who.name, 'ลบคำขอ', r.month, r.text + ' | ' + note);
  return { id: id, reverted: reverted, skipped: skipped, note: note };
}
