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
/** รหัสเวรพนักงานอาจรวมหลายช่วงได้เมื่อผู้อนุมัติยอมให้อยู่ต่อเนื่อง: '1,3' · '1,2,3'
 *  และอาจมีเตรียมพร้อมรวมอยู่ด้วย: '3,S' · '2,3,S' (เตรียมพร้อม 00.30–08.30 + เวรของตัวเองช่วงบ่าย/เย็น) */
function cHas_(c, p) { return String(c || '').split(',').indexOf(p) >= 0; }
function noSb_(c) { return String(c || '').split(',').filter(function (x) { return x && x !== 'S'; }).join(','); }
function mergeCode_(t, c) {
  const a = String(t || '').split(',').filter(String), b = String(c || '').split(',').filter(String);
  if (a.some(function (x) { return b.indexOf(x) >= 0; })) throw new Error('ช่วงเวรซ้อนกัน');
  return a.concat(b).sort().join(',');
}

function codeLabel_(g, c) {
  if (g === 'emp') {
    const L = { '1': 'ช่วง 1', '3': 'ช่วง 3', '2,3': 'ช่วง 2+3', '1,3': 'ช่วง 1 + ช่วง 3', '1,2,3': 'ช่วง 1+2+3 (ต่อเนื่อง)', '2': 'ช่วง 2', '1,2': 'ช่วง 1+2 (ต่อเนื่อง)', 'S': 'เตรียมพร้อม', '': 'ว่าง' };
    if (L[c] != null) return L[c];
    const d = noSb_(c); if (cHas_(c, 'S') && d) return (L[d] || d) + ' + เตรียมพร้อม';
    return c;
  }
  return c === '0' ? 'พักกะ' : 'กะ ' + c;
}

function thShort_(key, d) {
  const ms = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d + ' ' + ms[Number(key.slice(5, 7)) - 1];
}
function nextKey_(key) { const y = +key.slice(0, 4), m = +key.slice(5, 7); return m === 12 ? (y + 1) + '-01' : y + '-' + ('0' + (m + 1)).slice(-2); }

/** แปลงคำขอเป็นคำสั่งย้ายช่อง */
function buildOps_(type, p) {
  if (type === 'swap') {
    if (Number(p.da) === Number(p.db)) return [{ op: 'xchg', g: p.g, a: p.a, b: p.b, day: Number(p.da) }];
    return [{ op: 'move', g: p.g, from: p.a, to: p.b, day: Number(p.da) },
            { op: 'move', g: p.g, from: p.b, to: p.a, day: Number(p.db) }];
  }
  if (type === 'leave') return [{ op: 'move', g: p.g, from: p.a, to: p.r, day: Number(p.d), merge: p.g === 'emp' && !!p.cont, part: p.g === 'emp' && (p.part === '2' || p.part === '3') ? p.part : '' }];
  throw new Error('ประเภทคำขอไม่ถูกต้อง');
}

/** เวรเตรียมพร้อมวันถัดไปเป็นคู่กับช่วง 3 — ช่วง 3 ย้ายไปใคร เตรียมพร้อมวันรุ่งขึ้นย้ายตามไปด้วย
 *  nextData = ข้อมูลเดือนถัดไป (กรณีช่วง 3 วันสุดท้ายของเดือน) ไม่มีก็ข้าม */
function sbPair_(data, nextData, g, from, to, day, out) {
  const map = data[g], nd = map[from].length, cross = day >= nd;
  const m2 = cross ? (nextData && nextData[g]) : map; if (!m2 || !m2[from] || !m2[to]) return;
  const i2 = cross ? 0 : day, a2 = m2[from][i2], b2 = m2[to][i2];
  if (!cHas_(a2, 'S') || cHas_(b2, 'S')) return;
  const d2 = cross ? 1 : day + 1;
  if (cHas_(b2, '1')) throw new Error(to + ' มีช่วง 1 วันที่ ' + d2 + (cross ? ' (เดือนถัดไป)' : '') + ' ซึ่งตรงกับเวรเตรียมพร้อมที่ต้องย้ายตามช่วง 3 — เลือกคนอื่น');
  const na = noSb_(a2) || FREE_[g], nb = mergeCode_(b2, 'S');
  m2[from][i2] = na; m2[to][i2] = nb;
  out.push({ day: d2, g: g, from: from, to: to, code: 'S', pair: true, nm: cross || undefined, prevFrom: a2, fromAfter: na, prevTo: b2, toAfter: nb, merged: true });
}

/** ปรับย้อนหลังตามกฎ "เตรียมพร้อมคู่กับช่วง 3" (ใช้ครั้งเดียวกับเดือนที่อนุมัติไปแล้ว)
 *  1) คนเตรียมพร้อมที่ถูกใช้ไปเข้าช่วง 3 แทน → คืนเตรียมพร้อมให้ (ถือทั้งสองอย่าง)
 *  2) ช่วง 3 ที่ย้ายไปแล้ว แต่เตรียมพร้อมวันรุ่งขึ้นยังอยู่กับคนเดิม → ย้ายตาม ผูกกับคำขอเดิม (ออกใบคู่ได้)
 *  คืน { done:[ข้อความ], skip:[ข้อความ] } — แก้ data / nextData โดยตรง */
function sbPairRetro_(key, data, nextData) {
  const by = 'ระบบ: ปรับตามกฎเตรียมพร้อมคู่ช่วง 3', at = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), done = [], skip = [];
  const ch = data.changes || [], map = data.emp;
  ch.forEach(function (c, k) {                                       // 1) คืนเตรียมพร้อม
    if (c.g !== 'emp' || !c.replacedStandby || cHas_(c.code, '1')) return;
    const i = c.day - 1, later = ch.slice(k + 1).some(function (x) { return x.g === 'emp' && x.day === c.day && (x.from === c.to || x.to === c.to); });
    if (later || map[c.to][i] !== c.code) { skip.push(thShort_(key, c.day) + ' ' + c.to + ' (ตารางถูกเปลี่ยนต่อแล้ว)'); return; }
    const nc = mergeCode_('S', c.code); map[c.to][i] = nc;
    delete c.replacedStandby; c.prevTo = 'S'; c.toAfter = nc; c.merged = true; c.keepSb = true;
    done.push(thShort_(key, c.day) + ' ' + c.to + ' ถือเตรียมพร้อม + ' + codeLabel_('emp', c.code));
  });
  const outCh = [];                                                  // 2) ย้ายเตรียมพร้อมตามช่วง 3 — แทรกต่อจากรายการต้นทาง
  ch.forEach(function (c) {
    outCh.push(c);
    if (c.g !== 'emp' || c.pair || c.xpart || !cHas_(c.code, '3')) return;
    const add = [];
    try { sbPair_(data, nextData, 'emp', c.from, c.to, c.day, add); }
    catch (e) { skip.push(thShort_(key, c.day) + ' ' + c.from + ' → ' + c.to + ': ' + e.message); return; }
    add.forEach(function (x) {
      const rec = Object.assign({ req: c.req, by: by, at: at, retro: true }, x);
      if (x.nm) { rec.srcMonth = key; nextData.changes = (nextData.changes || []).concat([rec]); } else outCh.push(rec);
      done.push(thShort_(x.nm ? nextKey_(key) : key, x.day) + ' เตรียมพร้อม ' + x.from + ' → ' + x.to + ' (คู่กับช่วง 3 ' + thShort_(key, c.day) + ')');
    });
  });
  data.changes = outCh;
  return { done: done, skip: skip };
}

/** ใช้คำสั่งกับข้อมูลเดือน (แก้ data โดยตรง) — ผิดเงื่อนไขจะ throw */
function applyOps_(data, ops, nextData) {
  const out = [];
  ops.forEach(function (o) {
    const map = data[o.g]; const i = o.day - 1;
    if (!map) throw new Error('กลุ่มไม่ถูกต้อง');
    if (o.op === 'move') {
      if (!map[o.from] || !map[o.to]) throw new Error('ไม่พบรายชื่อ');
      const full = map[o.from][i], t = map[o.to][i];
      if (isFree_(o.g, full)) throw new Error(o.from + ' ไม่มีเวรวันที่ ' + o.day);
      const duty = o.g === 'emp' ? noSb_(full) : full;       // เตรียมพร้อมของวันนั้นยังเป็นของคนเดิม (คู่กับช่วง 3 ของเมื่อวาน)
      let c = duty;
      if (o.part && duty !== o.part) {                        // ลาบางช่วง (เช่น เฉพาะช่วง 2 ของ 2+3) → ที่เหลือยังเป็นของคนเดิม
        if (!cHas_(duty, o.part)) throw new Error(o.from + ' ไม่มีช่วง ' + o.part + ' ในวันที่ ' + o.day);
        c = o.part;
      }
      const rest = c !== full ? String(full).split(',').filter(function (x) { return x && c.split(',').indexOf(x) < 0; }).join(',') || FREE_[o.g] : FREE_[o.g];
      const restore = rest !== FREE_[o.g] ? { prevFrom: full, fromAfter: rest } : {};
      if (o.g === 'emp' && t === 'S' && !cHas_(c, '1')) {     // คนเตรียมพร้อมมาเข้าแทน → ยังถือเตรียมพร้อมไว้ด้วย
        const nc = mergeCode_('S', c);
        map[o.to][i] = nc; map[o.from][i] = rest;
        out.push(Object.assign({ day: o.day, g: o.g, from: o.from, to: o.to, code: c, prevTo: t, toAfter: nc, merged: true, keepSb: true }, restore));
      } else if (!isFree_(o.g, t)) {
        if (!o.merge) throw new Error(o.to + ' มีเวร (' + codeLabel_(o.g, t) + ') วันที่ ' + o.day + ' แล้ว');
        const nc = mergeCode_(t, c);                        // อยู่ต่อเนื่อง (ผู้อนุมัติยอม) — รวมช่วงเวร
        map[o.to][i] = nc; map[o.from][i] = rest;
        out.push(Object.assign({ day: o.day, g: o.g, from: o.from, to: o.to, code: c, prevTo: t, toAfter: nc, merged: true }, restore));
      } else {
        map[o.to][i] = c; map[o.from][i] = rest;
        out.push(Object.assign({ day: o.day, g: o.g, from: o.from, to: o.to, code: c, replacedStandby: t === 'S' }, restore));
      }
      if (o.g === 'emp' && cHas_(c, '3')) sbPair_(data, nextData, o.g, o.from, o.to, o.day, out);
    } else if (o.op === 'xchg') {
      const ca = map[o.a][i], cb = map[o.b][i];
      if (isFree_(o.g, ca) || isFree_(o.g, cb)) throw new Error('วันเดียวกันต้องมีเวรทั้งสองคนจึงจะสลับได้');
      if (o.g !== 'emp') {
        map[o.a][i] = cb; map[o.b][i] = ca;
        out.push({ day: o.day, g: o.g, from: o.a, to: o.b, code: ca }, { day: o.day, g: o.g, from: o.b, to: o.a, code: cb });
        return;
      }
      const da = noSb_(ca), db = noSb_(cb);                  // สลับเฉพาะช่วงเวร เตรียมพร้อมอยู่กับเจ้าของเดิม
      const na = cHas_(ca, 'S') ? mergeCode_(db, 'S') : db, nb = cHas_(cb, 'S') ? mergeCode_(da, 'S') : da;
      map[o.a][i] = na; map[o.b][i] = nb;
      out.push({ day: o.day, g: o.g, from: o.a, to: o.b, code: da, xchg: true, prevA: ca, prevB: cb, afterA: na, afterB: nb },
               { day: o.day, g: o.g, from: o.b, to: o.a, code: db, xpart: true });
      if (cHas_(da, '3') && !cHas_(db, '3')) sbPair_(data, nextData, o.g, o.a, o.b, o.day, out);
      if (cHas_(db, '3') && !cHas_(da, '3')) sbPair_(data, nextData, o.g, o.b, o.a, o.day, out);
    }
  });
  return out;
}

function sbNote_(month, ch) {
  const ps = (ch || []).filter(function (c) { return c.pair; });
  return ps.length ? ' · เตรียมพร้อมย้ายตามช่วง 3: ' + ps.map(function (c) { return thShort_(c.nm ? nextKey_(month) : month, c.day) + ' ' + c.from + ' → ' + c.to; }).join(', ') : '';
}
function describe_(month, type, p, data) {
  const lab = function (n, d) { return n + ' (' + thShort_(month, d) + ' ' + codeLabel_(p.g, data[p.g][n][d - 1]) + ')'; };
  if (type === 'swap') return 'แลกเวร: ' + lab(p.a, Number(p.da)) + ' ⇄ ' + lab(p.b, Number(p.db));
  const pt = p.part === '2' ? ' เฉพาะช่วง 2 (08.30–16.30)' : p.part === '3' ? ' เฉพาะช่วง 3 (16.30–00.30)' : '';
  return 'ลาเวร: ' + lab(p.a, Number(p.d)) + pt + ' → ' + p.r + ' เข้าแทน' + (p.cont ? ' (อยู่ต่อเนื่อง · ผู้อนุมัติยอม)' : '');
}

/** อ่านชีตคำขอครั้งเดียวต่อการเรียก 1 ครั้ง (เขียนเมื่อไรล้างแคช) — เดิมอ่านซ้ำ 4–6 รอบต่อการอนุมัติ */
var REQ_ROWS_CACHE_ = null;
function reqDirty_() { REQ_ROWS_CACHE_ = null; }
function reqRows_() {
  if (REQ_ROWS_CACHE_) return REQ_ROWS_CACHE_;
  const sh = sheet_(SH.REQ); if (sh.getLastRow() < 2) return (REQ_ROWS_CACHE_ = []);
  return (REQ_ROWS_CACHE_ = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), createdAt: r[1], month: mkey_(r[2]), type: r[3], payload: JSON.parse(r[4] || '{}'),
      requester: r[5], reason: r[6], status: r[7], decidedBy: r[8], decidedAt: r[9], note: r[10], text: r[11] };
  }));
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
    done: all.filter(function (r) { return r.status !== 'รออนุมัติ' && r.status !== 'ลบแล้ว' && r.status !== 'ล้างแล้ว'; }).slice(-30).reverse().map(pubReq_),
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
  const nx = b.payload.g === 'emp' ? getMonth_(nextKey_(b.month)) : null;
  const tch = applyOps_(test, ops, nx && JSON.parse(JSON.stringify(nx.data)));   // ตรวจก่อนบันทึก
  const text = describe_(b.month, b.type, b.payload, mo.data) + sbNote_(b.month, tch);
  const id = 'R' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.random().toString(36).slice(2, 5).toUpperCase();
  reqDirty_(); sheet_(SH.REQ).appendRow([id, new Date(), "'" + b.month, b.type, JSON.stringify(b.payload), b.requester || (who && who.name) || '',
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
    const mo = getMonth_(r.month), nk = nextKey_(r.month), nx = r.payload.g === 'emp' ? getMonth_(nk) : null;
    changes = applyOps_(mo.data, buildOps_(r.type, r.payload), nx && nx.data);   // ตรวจซ้ำกับตารางล่าสุด
    const stamp = function (c) { return Object.assign({ req: id, by: who.name, at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') }, c); };
    mo.data.rev = (mo.data.rev || 0) + 1;
    mo.data.changes = (mo.data.changes || []).concat(changes.filter(function (c) { return !c.nm; }).map(stamp));
    saveMonth_(r.month, mo.status, mo.data, mo.stateAfter, mo.note);
    const cx = changes.filter(function (c) { return c.nm; });   // เตรียมพร้อมวันที่ 1 ของเดือนถัดไป
    if (cx.length && nx) { nx.data.rev = (nx.data.rev || 0) + 1; nx.data.changes = (nx.data.changes || []).concat(cx.map(function (c) { return Object.assign(stamp(c), { srcMonth: r.month }); }));
      saveMonth_(nk, nx.status, nx.data, nx.stateAfter, nx.note); }
  }
  const st = approve ? 'อนุมัติ' : 'ไม่อนุมัติ';
  reqDirty_(); sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([[st, who.name + ' (' + who.role + ')', new Date(), note || '']]);
  log_(who.name, st, r.month, r.text);
  try {
    const names = {};
    if (r.type === 'swap') { names[r.payload.a] = 1; names[r.payload.b] = 1; } else { names[r.payload.a] = 1; names[r.payload.r] = 1; }
    const fullOf = {}; readTable_(SH.PEOPLE).forEach(function (p) { fullOf[p.short] = String(p.full || p.short).replace(/\s+/g, ' '); });
    let lines, title, btn = [];
    if (approve) {
      const vis = changes.filter(function (c) { return !c.xpart || r.type === 'swap'; });
      const mk = function (c) { return c.nm ? nextKey_(r.month) : r.month; };
      title = vis.map(function (c) { return thShort_(mk(c), c.day) + ' ' + codeLabel_(c.g, c.code); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
      lines = [];
      vis.forEach(function (c) { lines.push(thShort_(mk(c), c.day) + ' ' + codeLabel_(c.g, c.code) + (c.pair ? ' (คู่กับช่วง 3)' : '')); lines.push('ผู้มอบเวร: ' + (fullOf[c.from] || c.from)); lines.push('ผู้อยู่เวรแทน: ' + (fullOf[c.to] || c.to)); });
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
    if (cHas_(c, '1')) cand.push({ k: d + '|p1', s: new Date(d + 'T00:30:00+07:00').getTime(), e: new Date(d + 'T08:30:00+07:00').getTime() });
    if (cHas_(c, '2') || cHas_(c, '3')) cand.push({ k: d + '|p3', s: new Date(d + 'T' + (cHas_(c, '2') ? '08:30' : '16:30') + ':00+07:00').getTime(), e: cHas_(c, '3') ? new Date(addDays_(d, 1) + 'T00:30:00+07:00').getTime() : new Date(d + 'T16:30:00+07:00').getTime() });
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
  const sl = type === 'swap' ? [p.a + '@' + Number(p.da), p.b + '@' + Number(p.db)].sort().join('&') : p.a + '@' + Number(p.d) + (p.part ? '#' + p.part : '') + '>' + p.r;
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
    // เดือนของคำขอ + เดือนถัดไป (เตรียมพร้อมวันที่ 1 ที่ย้ายตามช่วง 3 วันสุดท้ายของเดือน)
    const nk = nextKey_(r.month), nx = getMonth_(nk);
    const parts = [{ key: r.month, mo: mo }];
    if (nx && (nx.data.changes || []).some(function (c) { return c.req === id; })) parts.push({ key: nk, mo: nx });
    const blk = {};
    parts.forEach(function (P) {
      const ch = P.mo.data.changes || [], idx = [];
      ch.forEach(function (c, i) { if (c.req === id) idx.push(i); });
      P.mine = idx.map(function (i) { return ch[i]; });
      if (!idx.length) return;
      const last = idx[idx.length - 1], people = {};
      P.mine.forEach(function (c) { people[c.from] = 1; people[c.to] = 1; });
      ch.forEach(function (c, i) { if (i > last && c.req !== id && P.mine.some(function (m) { return m.g === c.g && m.day === c.day && (people[c.from] || people[c.to]); })) blk[c.req] = 1; });
    });
    const total = parts.reduce(function (n, P) { return n + P.mine.length; }, 0);
    if (total) {
      const ids = Object.keys(blk);
      if (ids.length) return { blocked: ids.map(function (x) { const q = all.filter(function (y) { return y.id === x; })[0]; return { id: x, text: q ? q.text : x, at: q ? fmtTime_(q.decidedAt) : '' }; }) };
      // ตรวจทุกช่องก่อน แล้วค่อยคืนพร้อมกัน (ไม่คืนครึ่ง ๆ กลาง ๆ)
      const oldSameDay = r.type === 'swap' && Number(r.payload.da) === Number(r.payload.db) && !parts[0].mine.some(function (c) { return c.xchg; });
      const undoOne = function (data, c) {
        const map = data[c.g], i = c.day - 1;
        if (c.xpart) return true;
        if (c.xchg) {
          if (map[c.from][i] !== c.afterA || map[c.to][i] !== c.afterB) return false;
          map[c.from][i] = c.prevA; map[c.to][i] = c.prevB; return true;
        }
        if (!map[c.to] || map[c.to][i] !== (c.merged ? c.toAfter : c.code)) return false;
        if (c.prevFrom != null ? map[c.from][i] !== c.fromAfter : !isFree_(c.g, map[c.from][i])) return false;
        map[c.from][i] = c.prevFrom != null ? c.prevFrom : c.code; map[c.to][i] = c.merged ? c.prevTo : c.replacedStandby ? 'S' : FREE_[c.g]; return true;
      };
      const undo = function (datas) {                         // datas[k] = data ของแต่ละเดือน — ย้อนจากรายการล่าสุด
        for (let k = parts.length - 1; k >= 0; k--) {
          const data = datas[k], mine = parts[k].mine;
          if (k === 0 && oldSameDay) {
            const c = mine[0], map = data[c.g], i = c.day - 1;
            if (map[c.from][i] !== mine[1].code || map[c.to][i] !== c.code) return false;
            map[c.from][i] = c.code; map[c.to][i] = mine[1].code; continue;
          }
          if (!mine.slice().reverse().every(function (c) { return undoOne(data, c); })) return false;
        }
        return true;
      };
      if (!undo(parts.map(function (P) { return JSON.parse(JSON.stringify(P.mo.data)); }))) return { mismatch: true };
      undo(parts.map(function (P) { return P.mo.data; })); reverted = total;
      parts.forEach(function (P) {
        if (!P.mine.length) return;
        P.mo.data.rev = (P.mo.data.rev || 0) + 1;
        P.mo.data.changes = (P.mo.data.changes || []).filter(function (c) { return c.req !== id; });
        saveMonth_(P.key, P.mo.status, P.mo.data, P.mo.stateAfter, P.mo.note);
      });
    }
    note = 'ลบโดย ' + who.name + (reverted ? ' · คืนตารางแล้ว' : ' · ไม่มีข้อมูลการเปลี่ยนในตาราง');
  } else note = 'ลบโดย ' + who.name + (r.status === 'รออนุมัติ' ? ' · ยังไม่อนุมัติ ตารางไม่เปลี่ยน' : '');
  reqDirty_(); sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([['ลบแล้ว', who.name + ' (' + who.role + ')', new Date(), note]]);
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
  reqDirty_(); sheet_(SH.REQ).getRange(r.row, 5).setValue(JSON.stringify(p));
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
/** เพิ่มรูปที่อัปโหลดขึ้น Drive (ผ่านระบบ SLD) ให้เหตุการณ์ไฟดับ — เก็บเฉพาะลิงก์ */
function addOutPhotos_(b) {
  const id = String(b.id || ''); const x = outRows_().filter(function (r) { return r.id === id && !r.deleted; })[0];
  if (!x) throw new Error('ไม่พบรายการ');
  const by = outAuth_(b, x.k), d = x.d;
  const add = (b.photos || []).filter(function (p) { return p && p.fileId; }).slice(0, 20).map(function (p) {
    return { fileId: String(p.fileId), url: String(p.url || ''), kind: String(p.kind || ''), at: new Date().toISOString(), by: by };
  });
  if (!add.length) return d;
  d.photos = (Array.isArray(d.photos) ? d.photos : []).concat(add);
  outSheet_().getRange(x.row, 3, 1, 3).setValues([[JSON.stringify(d), new Date(), by]]);
  log_(by, 'แนบรูปไฟดับ', x.k.slice(0, 7), id + ' +' + add.length + ' รูป');
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

/* ===================== รับแจ้งไฟดับจากผู้ใช้ไฟ (หน้าเว็บ /fire หรือส่งต่อข้อความให้บอต) =====================
 * Tickets: id | createdAt | data(JSON) | status | updatedAt
 * status: new (ยังไม่มีคนรับ) · acc (รับงานแล้ว) · done (แก้เสร็จ → เชื่อมเหตุการณ์ไฟดับ) · dup (ซ้ำ) · cancel */
const TK_SHEET_ = 'Tickets';
const TK_TYPES_ = { home: 'ไฟดับทั้งบ้าน', area: 'ไฟดับทั้งซอย/หมู่บ้าน', low: 'ไฟตก / กระพริบ', danger: 'สายขาด / เสาล้ม / ไฟไหม้', other: 'อื่น ๆ' };
const TK_ST_ = { new: 'ยังไม่มีคนรับ', acc: 'เจ้าหน้าที่รับงานแล้ว', done: 'แก้ไขเสร็จแล้ว', dup: 'รวมกับรายการอื่น', cancel: 'ยกเลิก' };
function tkSheet_() {
  let sh = sheet_(TK_SHEET_);
  if (!sh) {
    sh = ss_().insertSheet(TK_SHEET_);
    sh.getRange(1, 1, 1, 5).setValues([['id', 'createdAt', 'data', 'status', 'updatedAt']]).setFontWeight('bold');
    sh.setFrozenRows(1); sh.getRange('A:A').setNumberFormat('@');
  }
  return sh;
}
function tkRows_() {
  const sh = tkSheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().map(function (r, i) {
    let d = {}; try { d = JSON.parse(r[2] || '{}'); } catch (e) {}
    return { row: i + 2, id: String(r[0]), d: d, st: String(r[3] || 'new') };
  });
}
function tkWrite_(x) { x.d.st = x.st; x.d.upd = new Date().toISOString(); tkSheet_().getRange(x.row, 3, 1, 3).setValues([[JSON.stringify(x.d), x.st, new Date()]]); }
function tkNextId_() {
  const props = PropertiesService.getScriptProperties(), n = Number(props.getProperty('TK_SEQ') || 0) + 1;
  props.setProperty('TK_SEQ', String(n)); return 'A-' + ('000' + n).slice(-4);
}
/** อุปกรณ์ใกล้สุดจาก SLD (หม้อแปลงก่อน) — ดึงไม่ได้ = ไม่ระบุ */
function tkNear_(lat, lon) {
  try {
    const url = String(getConfig_().sldApi || 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec');
    const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    const c = Math.cos(lat * Math.PI / 180); let best = null;
    (j.feeders || []).forEach(function (f) { (f.devices || []).forEach(function (d) {
      if (!d.lat || !d.lon) return;
      const km = Math.sqrt(Math.pow((d.lat - lat) * 111, 2) + Math.pow((d.lon - lon) * 111 * c, 2)) * (d.type === 'TRANSFORMER' ? 1 : 1.6);
      if (!best || km < best.km) best = { km: km, id: d.id, type: d.type, desc: d.desc || '', feeder: f.id };
    }); });
    if (best && best.km < 5) { best.km = Math.round(best.km * 100) / 100; return best; }
  } catch (e) {}
  return null;
}
function tkPublic_(d) {   // หน้าผู้ใช้ไฟ: ไม่ส่งชื่อ/เบอร์/ที่อยู่/สาเหตุ
  const st = { new: 'รอเจ้าหน้าที่รับงาน', acc: 'เจ้าหน้าที่รับงานแล้ว กำลังดำเนินการ', done: 'แก้ไขเสร็จ จ่ายไฟแล้ว', cancel: 'ปิดรายการแล้ว' };
  return { id: d.id, type: TK_TYPES_[d.type] || d.type, st: d.st, stText: st[d.st] || TK_ST_[d.st] || d.st, at: d.at, accAt: d.accAt || '',
    doneAt: d.st === 'done' ? (d.onAt || d.doneAt || '') : (d.doneAt || '') };
}
/** ผู้ใช้ไฟแจ้ง (ไม่ต้องล็อกอิน) — กันแจ้งรัว: เบอร์เดิมไม่เกิน 3 ครั้ง/ชม. ทั้งระบบไม่เกิน 40 ครั้ง/ชม. */
function createTicket_(b) {
  if (b.hp) throw new Error('ส่งไม่สำเร็จ');                                // ช่องดักบอต
  const phone = digits_(b.phone);
  if (!/^0\d{8,9}$/.test(phone)) throw new Error('ใส่เบอร์โทรกลับให้ถูกต้อง (9–10 หลัก)');
  const type = TK_TYPES_[b.type] ? b.type : 'other';
  const lat = Number(b.lat), lon = Number(b.lon), hasGps = isFinite(lat) && isFinite(lon) && lat > 5 && lat < 21 && lon > 97 && lon < 106;
  const place = String(b.place || '').trim().slice(0, 200);
  if (!hasGps && place.length < 3) throw new Error('กด "ใช้ตำแหน่งตอนนี้" หรือพิมพ์สถานที่/จุดสังเกต');
  const cache = CacheService.getScriptCache(), kp = 'tkp_' + phone, ka = 'tk_all_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMddHH');
  const np = Number(cache.get(kp) || 0), na = Number(cache.get(ka) || 0);
  if (np >= 3) throw new Error('เบอร์นี้แจ้งไปแล้วหลายครั้ง เจ้าหน้าที่กำลังดำเนินการ — เรื่องด่วนโทร 1129');
  if (na >= 40) throw new Error('ขณะนี้มีผู้แจ้งจำนวนมาก โปรดโทร 1129');
  cache.put(kp, String(np + 1), 3600); cache.put(ka, String(na + 1), 3700);
  const id = tkNextId_(), now = new Date();
  const d = { id: id, at: now.toISOString(), type: type, phone: phone, name: String(b.name || '').trim().slice(0, 60), place: place,
    detail: String(b.detail || '').trim().slice(0, 500), lat: hasGps ? Math.round(lat * 1e6) / 1e6 : null, lon: hasGps ? Math.round(lon * 1e6) / 1e6 : null,
    src: b.src === 'line' ? 'line' : 'web', key: Utilities.getUuid().slice(0, 8), st: 'new', notified: [] };
  if (hasGps) d.near = tkNear_(lat, lon);
  tkSheet_().appendRow([id, now, JSON.stringify(d), 'new', now]);
  log_('ผู้ใช้ไฟ', 'รับแจ้งไฟดับ', bkkYmd_().slice(0, 7), id + ' ' + TK_TYPES_[type] + ' ' + (place || ''));
  try { tkNotify_(d, false); } catch (e) { log_('system', 'แจ้งเวรไม่สำเร็จ', '', String(e)); }
  try { tkEnsureTrigger_(); } catch (e) {}
  return { id: id, key: d.key, st: 'new', stText: TK_ST_.new };
}
/** ติดตามสถานะ: ใช้ key จากลิงก์ติดตาม หรือ เบอร์โทรที่ใช้แจ้ง (ผิดเกิน 10 ครั้ง/ชม. ต่อเลขรับแจ้ง = ล็อก) */
function tkStatus_(id, key, phone) {
  id = String(id || '').trim().toUpperCase().replace(/^#/, '').replace(/^A?-?(\d{1,4})$/, function (m, n) { return 'A-' + ('000' + n).slice(-4); });
  const rows = tkRows_(), x = rows.filter(function (r) { return r.id === id; })[0];
  const cache = CacheService.getScriptCache(), kf = 'tkf_' + id, nf = Number(cache.get(kf) || 0);
  if (!key && phone && nf >= 10) throw new Error('ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
  const okKey = x && key && x.d.key === String(key), okPhone = x && !key && phone && digits_(phone) === x.d.phone;
  if (!okKey && !okPhone) { if (phone) cache.put(kf, String(nf + 1), 3600); throw new Error(phone ? 'ไม่พบรายการ — ตรวจเบอร์โทรและเลขรับแจ้งอีกครั้ง' : 'ไม่พบรายการ'); }
  let cur = x, hop = 0;                                  // แจ้งซ้ำจุดเดียวกัน → แสดงสถานะตามรายการหลัก
  while (cur.st === 'dup' && cur.d.ref && hop++ < 5) { const nx = rows.filter(function (r) { return r.id === cur.d.ref; })[0]; if (!nx) break; cur = nx; }
  const out = tkPublic_(Object.assign({}, cur.d, { st: cur.st }));
  out.id = x.id; out.at = x.d.at; out.type = TK_TYPES_[x.d.type] || x.d.type;
  if (cur !== x) { out.ref = cur.id; out.refNote = 'มีผู้แจ้งจุดเดียวกันแล้ว เจ้าหน้าที่ดำเนินการรวมเป็นงานเดียว (#' + cur.id + ')'; }
  else { const n = rows.filter(function (r) { return r.st === 'dup' && r.d.ref === x.id; }).length;
    if (n) out.refNote = 'มีผู้แจ้งจุดเดียวกันอีก ' + n + ' ราย — เจ้าหน้าที่รวมเป็นงานเดียวแล้ว'; }
  if (okPhone) out.k = x.d.key;                          // ให้หน้าเว็บจำไว้ในเครื่อง + ทำลิงก์ติดตาม
  return out;
}
/** การ์ด LINE ถึงคนเข้าเวร (พนักงาน) ตอนนี้ — again=true คือเตือนซ้ำ + แจ้ง หผ.ปร./ชผ. */
function tkCard_(d, again) {
  const t = Utilities.formatDate(new Date(d.at), TZ, 'HH:mm'), danger = d.type === 'danger';
  const lines = [];
  if (d.place) lines.push('📍 ' + d.place);
  if (d.near) lines.push('ใกล้ ' + d.near.id + (d.near.desc ? ' (' + d.near.desc + ')' : '') + ' · ' + d.near.feeder);
  lines.push('☎ ' + fmtPhone_(d.phone) + (d.name ? ' · ' + d.name : ''));
  if (d.detail) lines.push('"' + d.detail.slice(0, 120) + '"');
  const btn = [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'postback', label: '✋ รับงาน', data: 'tk|acc|' + d.id, displayText: 'รับงาน ' + d.id } }];
  if (d.lat) btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: '🗺 นำทาง', uri: 'https://www.google.com/maps/dir/?api=1&destination=' + d.lat + ',' + d.lon } });
  const tb = telBtn_('☎ โทรกลับ ' + fmtPhone_(d.phone), d.phone, false); if (tb) btn.push(tb);
  const u = webUrl_('viewDaily', { tk: 1 }); if (u) btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูรายการในแอป', uri: u } });
  return flex_((again ? 'ยังไม่มีคนรับ! ' : 'รับแจ้งไฟดับ ') + d.id, bubble_((again ? '⏰ ยังไม่มีคนรับงาน · ' : 'รับแจ้งไฟดับ ') + d.id + ' · ' + t + ' น.',
    danger || again ? '#C92A2A' : '#A23434', TK_TYPES_[d.type] || 'แจ้งไฟดับ', lines, btn));
}
function tkNotify_(d, again) {
  const td = dayData_(bkkYmd_()), yd = dayData_(addDays_(bkkYmd_(), -1)), empSet = Object.assign({}, yd ? yd.emp : {}, td ? td.emp : {});
  const duty = Object.keys(onDutyNow_()).filter(function (n) { return n in empSet; });   // เฉพาะพนักงานที่อยู่เวรตอนนี้
  let to = duty.slice();
  if (again) approverList_().forEach(function (a) { if (to.indexOf(a.short) < 0) to.push(a.short); });
  const msg = [tkCard_(d, again)], sent = [];
  to.forEach(function (n) { const id = lineIdOf_(n); if (id && push_(id, msg, 'ticket')) sent.push(n); });
  log_('system', again ? 'เตือนซ้ำรับแจ้ง' : 'ส่งรับแจ้งถึงเวร', '', d.id + ' → ' + (sent.join(', ') || 'ไม่มีผู้รับ'));
  return sent;
}
/** ทุก 5 นาที: รายการที่ยังไม่มีคนรับเกิน 10 นาที → เตือนซ้ำครั้งเดียว */
function tkCheck() {
  const now = Date.now();
  tkRows_().forEach(function (x) {
    if (x.st !== 'new' || x.d.again) return;
    if (now - new Date(x.d.at).getTime() < 10 * 60000) return;
    x.d.again = new Date().toISOString(); tkWrite_(x);
    try { tkNotify_(x.d, true); } catch (e) {}
  });
}
function tkEnsureTrigger_() {
  const props = PropertiesService.getScriptProperties(); if (props.getProperty('TK_TRIG')) return;
  if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'tkCheck'; }))
    ScriptApp.newTrigger('tkCheck').timeBased().everyMinutes(5).create();
  props.setProperty('TK_TRIG', '1');
}
/** สิทธิ์เจ้าหน้าที่: PIN ผู้อนุมัติ · บัญชีศูนย์รวมงาน · ลิงก์เวรจาก LINE ที่ยังไม่หมดอายุ */
function tkAuth_(b) {
  const who = approverByPin_(b.pin); if (who) return who.short || who.name;
  if (b.hubUser && b.hubPass && !b.t) { if (hubAllowed_(String(b.hubUser), String(b.hubPass))) return String(b.hubUser).slice(0, 60); throw new Error('บัญชีนี้ไม่มีสิทธิ์ใช้งานเวรแก้ไฟ'); }
  if (b.r === 'duty' && b.t && Number(b.x) > Date.now() && repToken_(String(b.rk || ''), b.u, 'duty', b.x) === b.t) return b.u;
  throw new Error('ต้องล็อกอินศูนย์รวมงาน ใช้ลิงก์จาก LINE หรือใส่ PIN');
}
function listTickets_(b) {
  tkAuth_(b);
  const since = Date.now() - 36 * 3600000;
  return tkRows_().filter(function (x) { return x.st === 'new' || x.st === 'acc' || new Date(x.d.upd || x.d.at).getTime() > since; })
    .map(function (x) { const d = Object.assign({}, x.d, { st: x.st }); delete d.key; return d; }).reverse().slice(0, 60);
}
function tkAccept_(id, by) {
  const x = tkRows_().filter(function (r) { return r.id === String(id); })[0]; if (!x) throw new Error('ไม่พบรายการ ' + id);
  if (x.st === 'acc' && x.d.accBy !== by) return { already: x.d.accBy, d: x.d };
  if (x.st !== 'new' && x.st !== 'acc') return { closed: TK_ST_[x.st], d: x.d };
  x.st = 'acc'; x.d.accBy = by; x.d.accAt = new Date().toISOString(); tkWrite_(x);
  log_(by, 'รับงานแจ้งไฟดับ', '', id);
  return { d: x.d };
}
/** a: acc (รับงาน) · done (เชื่อมเหตุการณ์ไฟดับ outId) · dup (ซ้ำกับ ref) · cancel · reopen */
function ticketAct_(b) {
  const by = tkAuth_(b), a = String(b.a || '');
  if (a === 'acc') { const r = tkAccept_(b.id, by); if (r.already) throw new Error(r.already + ' รับงานนี้ไปแล้ว'); if (r.closed) throw new Error('รายการนี้' + r.closed); return r.d; }
  const x = tkRows_().filter(function (r) { return r.id === String(b.id); })[0]; if (!x) throw new Error('ไม่พบรายการ');
  if (a === 'done') { x.st = 'done'; x.d.doneAt = new Date().toISOString(); x.d.doneBy = by; x.d.outId = String(b.outId || ''); if (/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(String(b.onAt || ''))) x.d.onAt = new Date(b.onAt + ':00+07:00').toISOString(); if (!x.d.accBy) { x.d.accBy = by; x.d.accAt = x.d.doneAt; } }
  else if (a === 'dup') {
    const ref = String(b.ref || '').trim().toUpperCase().replace(/^#/, '').replace(/^(\d+)$/, function (m) { return 'A-' + ('000' + m).slice(-4); });
    if (ref === x.id || !tkRows_().some(function (r) { return r.id === ref; })) throw new Error('ไม่พบรายการหลัก ' + ref);
    x.st = 'dup'; x.d.ref = ref; x.d.doneBy = by; x.d.doneAt = new Date().toISOString(); }
  else if (a === 'cancel') { x.st = 'cancel'; x.d.note = String(b.note || '').slice(0, 120); x.d.doneBy = by; x.d.doneAt = new Date().toISOString(); }
  else if (a === 'reopen') { x.st = x.d.accBy ? 'acc' : 'new'; delete x.d.doneAt; delete x.d.outId; delete x.d.onAt; }
  else throw new Error('คำสั่งไม่ถูกต้อง');
  tkWrite_(x); log_(by, 'รับแจ้งไฟดับ: ' + a, '', x.id + (x.d.outId ? ' → ' + x.d.outId : ''));
  const d = Object.assign({}, x.d); delete d.key; return d;
}
/** เจ้าหน้าที่ส่งต่อข้อความแจ้งไฟดับ (จาก OpenChat ฯลฯ) ให้บอต → สร้างรายการรับแจ้ง */
function tkFromLine_(text, by) {
  const t = String(text || '').slice(0, 500), ph = (t.replace(/[\s-]/g, '').match(/0\d{8,9}/) || [''])[0];
  const id = tkNextId_(), now = new Date();
  const d = { id: id, at: now.toISOString(), type: /สาย.*ขาด|เสา.*ล้ม|ไฟไหม้|ประกาย|ระเบิด/.test(t) ? 'danger' : /ตก|กระพริบ|หรี่/.test(t) ? 'low' : /ซอย|หมู่บ้าน|ทั้งหมู่|ทั้งตำบล|แถว/.test(t) ? 'area' : 'home',
    phone: ph, name: '', place: '', detail: t, lat: null, lon: null, src: 'line', fwdBy: by, key: Utilities.getUuid().slice(0, 8), st: 'new' };
  tkSheet_().appendRow([id, now, JSON.stringify(d), 'new', now]);
  log_(by, 'รับแจ้งไฟดับ (ส่งต่อจาก LINE)', bkkYmd_().slice(0, 7), id);
  try { tkNotify_(d, false); } catch (e) {}
  try { tkEnsureTrigger_(); } catch (e) {}
  return d;
}
