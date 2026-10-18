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
    done: all.filter(function (r) { return r.status !== 'รออนุมัติ'; }).slice(-30).reverse().map(pubReq_)
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
    notifyPeople_(Object.keys(names), approve ? 'อนุมัติเปลี่ยนเวรแล้ว' : 'คำขอเปลี่ยนเวรไม่ได้รับอนุมัติ',
      r.text + '\n' + st + 'โดย ' + who.name + (note ? '\nหมายเหตุ: ' + note : ''), approve ? '#5B1A63' : '#8A2B2B');
  } catch (e) { log_('system', 'LINE error', r.month, String(e)); }
  return pubReq_(reqRows_().filter(function (x) { return x.id === id; })[0]);
}
