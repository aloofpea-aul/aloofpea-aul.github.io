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
    returned: all.filter(function (r) { return r.status === 'ตีกลับ'; }).map(pubReq_),
    done: all.filter(function (r) { return r.status !== 'รออนุมัติ' && r.status !== 'ตีกลับ' && r.status !== 'ลบแล้ว' && r.status !== 'ล้างแล้ว'; }).slice(-30).reverse().map(pubReq_),
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
  const lk = lockOf_(b.month, b.type, b.payload); if (lk) throw new Error(lk);
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

/* ======================================================================
 *  ตีกลับให้แก้ไข: รออนุมัติ → ตีกลับ → (ผู้ขอแก้ในรายการเดิม) → รออนุมัติ
 *  ระหว่างตีกลับตารางไม่เปลี่ยน · ไม่นับในล็อกวันละครั้ง · ค้างเกิน RET_DAYS_ วัน → ยกเลิกอัตโนมัติ
 * ====================================================================== */
const RET_ITEMS_ = { r: 'เปลี่ยนคนแทน', d: 'วัน/ช่วงไม่ถูก', why: 'เหตุผลไม่ชัด', doc: 'วันที่เสนอ/ผู้ลงนาม', o: 'อื่น ๆ' };
const RET_DAYS_ = 3;
function nowTxt_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function returnRequest_(id, who, items, note) {
  const r = reqRows_().filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('ไม่พบคำขอ ' + id);
  if (r.status !== 'รออนุมัติ') throw new Error('คำขอนี้' + r.status + 'ไปแล้ว');
  items = (items || []).filter(function (k) { return RET_ITEMS_[k]; });
  note = String(note || '').trim().slice(0, 300);
  if (!note) throw new Error('พิมพ์สิ่งที่ต้องแก้ไขก่อน');
  const what = items.map(function (k) { return RET_ITEMS_[k]; }).join(' · ');
  const p = r.payload; p.hist = (p.hist || []).concat([{ at: nowTxt_(), act: 'ret', by: who.name, items: items, note: note }]);
  reqDirty_(); const sh = sheet_(SH.REQ);
  sh.getRange(r.row, 5).setValue(JSON.stringify(p));
  sh.getRange(r.row, 8, 1, 4).setValues([['ตีกลับ', who.name + ' (' + who.role + ')', new Date(), 'ต้องแก้: ' + (what ? what + ' — ' : '') + note]]);
  log_(who.name, 'ตีกลับ', r.month, r.text + ' | ' + note);
  try {
    const u = webUrl_('viewReq', { ret: id }), btn = u ? [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'uri', label: 'แก้ไขแล้วส่งใหม่', uri: u } }] : null;
    notifyPeople_([r.payload.a], 'คำขอถูกตีกลับให้แก้ไข', r.text + '\n\nต้องแก้: ' + (what ? what + '\n' : '') + note + '\nโดย ' + who.name +
      '\n(แก้แล้วส่งใหม่ภายใน ' + RET_DAYS_ + ' วัน ไม่เช่นนั้นคำขอจะถูกยกเลิก)', '#C26A00', 'ตีกลับให้แก้ไข', btn);
  } catch (e) { log_('system', 'LINE error', r.month, String(e)); }
  return pubReq_(reqRows_().filter(function (x) { return x.id === id; })[0]);
}
/** ผู้ขอแก้คำขอที่ถูกตีกลับแล้วส่งกลับ (รายการเดิม) — ตรวจเหมือนยื่นใหม่ */
function resubmitRequest_(b) {
  const r = reqRows_().filter(function (x) { return x.id === String(b.id); })[0];
  if (!r) throw new Error('ไม่พบคำขอ');
  if (r.status !== 'ตีกลับ') throw new Error('คำขอนี้' + r.status + 'แล้ว — แก้ไขไม่ได้');
  if (b.month !== r.month) throw new Error('เปลี่ยนเดือนไม่ได้ — ยกเลิกคำขอนี้แล้วยื่นใหม่');
  const mo = getMonth_(b.month);
  const dup = dupOf_(b.month, b.type, b.payload);
  if (dup) throw new Error('มีรายการนี้อยู่แล้ว: ' + dup.text);
  const lk = lockOf_(b.month, b.type, b.payload, r.id); if (lk) throw new Error(lk);
  const nx = b.payload.g === 'emp' ? getMonth_(nextKey_(b.month)) : null;
  const tch = applyOps_(JSON.parse(JSON.stringify(mo.data)), buildOps_(b.type, b.payload), nx && JSON.parse(JSON.stringify(nx.data)));
  const text = describe_(b.month, b.type, b.payload, mo.data) + sbNote_(b.month, tch);
  const o = r.payload, p = b.payload, ch = [];
  const lab = { a: 'ผู้ขอ', r: 'คนแทน', b: 'คู่แลก', d: 'วัน', da: 'วัน', db: 'วันของคู่', part: 'ช่วง' };
  Object.keys(lab).forEach(function (k) { if (String(o[k] == null ? '' : o[k]) !== String(p[k] == null ? '' : p[k])) ch.push(lab[k] + ' ' + (o[k] || '-') + ' → ' + (p[k] || '-')); });
  if (r.type !== b.type) ch.unshift('ประเภท ' + (r.type === 'swap' ? 'แลกเวร' : 'ลาเวร') + ' → ' + (b.type === 'swap' ? 'แลกเวร' : 'ลาเวร'));
  if (String(r.reason) !== String(b.reason || '')) ch.push('เหตุผล');
  if (String(o.docDate || '') !== String(p.docDate || '')) ch.push('วันที่เสนอ');
  if (o.signer && o.signer.name && String(o.signer.name) !== String((p.signer || {}).name || '')) ch.push('ผู้ลงนาม');
  p.hist = (o.hist || []).concat([{ at: nowTxt_(), act: 're', by: b.requester || p.a, ch: ch }]);
  p.rs = (o.rs || 0) + 1;
  reqDirty_(); sheet_(SH.REQ).getRange(r.row, 4, 1, 9).setValues([[b.type, JSON.stringify(p), b.requester || p.a, b.reason || '', 'รออนุมัติ', '', '', '', text]]);
  log_(b.requester || p.a, 'แก้ไขแล้วส่งใหม่', r.month, text + (ch.length ? ' | ' + ch.join(', ') : ''));
  try { notifyApprovers_('คำขอแก้ไขแล้วส่งใหม่ (ครั้งที่ ' + p.rs + ')', text + (ch.length ? '\nเปลี่ยน: ' + ch.join(' · ') : '\n(ไม่ได้เปลี่ยนรายการเวร)') + (b.reason ? '\nเหตุผล: ' + b.reason : '')); } catch (e) { log_('system', 'LINE error', r.month, String(e)); }
  return pubReq_(reqRows_().filter(function (x) { return x.id === r.id; })[0]);
}
function cancelReturned_(id, by) {
  const r = reqRows_().filter(function (x) { return x.id === String(id); })[0];
  if (!r) throw new Error('ไม่พบคำขอ');
  if (r.status !== 'ตีกลับ') throw new Error('คำขอนี้' + r.status + 'แล้ว');
  reqDirty_(); sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([['ยกเลิก', String(by || r.requester), new Date(), 'ผู้ขอยกเลิกหลังถูกตีกลับ']]);
  log_(String(by || r.requester), 'ยกเลิกคำขอ (ตีกลับ)', r.month, r.text);
  return true;
}
/** เรียกจาก tkCheck: ตีกลับค้างเกินกำหนด → ยกเลิก */
function retExpire_() {
  const lim = Date.now() - RET_DAYS_ * 864e5;
  reqRows_().filter(function (r) { return r.status === 'ตีกลับ' && r.decidedAt instanceof Date && r.decidedAt.getTime() < lim; }).forEach(function (r) {
    sheet_(SH.REQ).getRange(r.row, 8, 1, 4).setValues([['ยกเลิก', 'ระบบ', new Date(), 'ค้างตีกลับเกิน ' + RET_DAYS_ + ' วัน — ยกเลิกอัตโนมัติ']]);
    log_('system', 'ยกเลิกคำขอตีกลับค้าง', r.month, r.text);
  });
  reqDirty_();
}

function decideRequest_(id, approve, who, note) {
  const r = reqRows_().filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('ไม่พบคำขอ ' + id);
  if (r.status !== 'รออนุมัติ') throw new Error('คำขอนี้' + r.status + 'ไปแล้ว');
  let changes = [];
  if (approve) {
    const lk = lockOf_(r.month, r.type, r.payload, r.id); if (lk) throw new Error(lk);
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
  const who = approverOf_(b);
  let hubP = null;                                          // บัญชีศูนย์รวมงานของคนอยู่เวร / ผู้ตรวจเวรของวันนั้น
  if (!who && b.hubUser && b.hubPass && !b.t && hubAllowed_(String(b.hubUser), String(b.hubPass))) {
    const nn = normN_(b.hubUser), pr = readTable_(SH.PEOPLE).filter(function (p) { return normN_(p.full) === nn || normN_(p.short) === nn; })[0];
    if (pr) {
      const ymd = k.slice(0, 10), c = empCode_(ymd, pr.short), inSet = k.slice(-2) === 'p1' ? cHas_(c, '1') : (cHas_(c, '2') || cHas_(c, '3'));
      if (inSet) hubP = { short: pr.short, f: DUTY_FIELDS_ }; else if (inspOf_(ymd) === pr.short) hubP = { short: pr.short, f: INSP_FIELDS_ };
    }
    if (!hubP) throw new Error('บัญชีนี้ไม่ได้อยู่เวรชุดนี้ — ใช้ลิงก์จาก LINE หรือ PIN ผู้อนุมัติ');
  }
  if (who) { fields = DUTY_FIELDS_.concat(INSP_FIELDS_); by = who.short || who.name; }
  else if (hubP) { fields = hubP.f; by = hubP.short; }
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
  if (fields !== INSP_FIELDS_ && !cur.filledAt && repFilled_(cur)) cur.filledAt = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm");
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
/** วันละครั้ง: วัน/คนเดียวกันที่มีคำขอ (รออนุมัติ/อนุมัติ) อยู่แล้ว ห้ามเปลี่ยนซ้ำ — ต้องให้ผู้อนุมัติลบคำขอเดิมก่อน */
function reqSlots_(type, p) {
  const ppl = type === 'swap' ? [p.a, p.b] : [p.a, p.r];
  const days = type === 'swap' ? [Number(p.da), Number(p.db)] : [Number(p.d)];
  const parts = type === 'leave' && p.part ? [String(p.part)] : ['1', '2', '3'];   // ลาเฉพาะช่วง 2/3 ไม่ทับช่วงอื่นของวันเดียวกัน
  return { g: p.g, ppl: ppl, parts: parts, days: days.filter(function (d, i, a) { return a.indexOf(d) === i; }) };
}
function lockOf_(month, type, p, exceptId) {
  const me = reqSlots_(type, p);
  const hit = reqRows_().filter(function (r) {
    if (r.id === exceptId || r.month !== month || (r.status !== 'อนุมัติ' && r.status !== 'รออนุมัติ')) return false;
    const o = reqSlots_(r.type, r.payload);
    return o.g === me.g && o.days.some(function (d) { return me.days.indexOf(d) >= 0; }) && o.ppl.some(function (n) { return me.ppl.indexOf(n) >= 0; })
      && o.parts.some(function (x) { return me.parts.indexOf(x) >= 0; });
  })[0];
  if (!hit) return null;
  const o = reqSlots_(hit.type, hit.payload), d = o.days.filter(function (x) { return me.days.indexOf(x) >= 0; })[0];
  return 'วันที่ ' + d + ' มีการเปลี่ยนเวรไปแล้ว 1 ครั้ง (' + hit.text + ' — ' + hit.status + ') · วันหนึ่งเปลี่ยนได้ครั้งเดียว ถ้าต้องการแก้ ให้ผู้อนุมัติลบคำขอเดิมก่อน แล้วยื่นใหม่';
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
function outagesOf_(month, withDel) {
  const all = outRows_().filter(function (x) { return x.k.indexOf(month) === 0; });
  const list = all.filter(function (x) { return !x.deleted; }).map(function (x) { return x.d; });
  const del = all.filter(function (x) { return x.deleted; }).map(function (x) { return Object.assign({}, x.d, { deleted: true, k: x.k }); });
  const ids = list.filter(function (o) { return o.patrol && o.patrol.id; }).map(function (o) { return o.patrol.id; });
  if (ids.length) {
    const st = patrolStatus_(ids);
    list.forEach(function (o) { if (o.patrol && st[o.patrol.id]) o.patrol.status = st[o.patrol.id]; });
  }
  list.sort(function (a, b) { return String(a.off).localeCompare(String(b.off)); });
  return withDel ? list.concat(del) : list;
}

/** สิทธิ์บันทึก: ลิงก์ LINE ของคนเวรชุดนั้น หรือ PIN ผู้อนุมัติ */
/** สิทธิ์แก้เหตุการณ์ไฟดับของเวร k
 *  ผู้อนุมัติ (PIN / บัญชีศูนย์รวมงานที่ตรงชีต Approvers) = ทุกเวร แม้ล็อกแล้ว
 *  คนอยู่เวรชุดนั้น (ลิงก์ LINE ของเวรนี้ / บัญชีศูนย์รวมงานที่มีชื่ออยู่ในเวรนี้) = เฉพาะเวรตัวเอง และต้องยังไม่ล็อก
 *  ล็อก = หผ.ปร. กด "รับเอกสารแล้ว" ของเวรนั้น · คืน { by, appr } */
/** ชุด "ในเวลาทำการ" (yyyy-mm-dd|p2) — เฉพาะวันทำการ 08:30–16:30 ที่ไม่มีเวรประจำ */
function isWorkday_(ymd) {
  const dw = new Date(ymd + 'T00:00:00Z').getUTCDay();
  if (dw === 0 || dw === 6) return false;
  return peaHolidaysOf_(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7))).indexOf(ymd) < 0;
}
const OUT_K_RE_ = /^\d{4}-\d{2}-\d{2}\|p[123]$/;
/** เวรที่ตรงกับเวลาไฟดับ: 00:30–08:30 = ช่วง 1 · 08:30–16:30 วันทำการ = ในเวลาทำการ (p2) · นอกนั้น = ช่วง 3 (ก่อน 00:30 = ช่วง 3 ของเมื่อวาน) */
function outKeyOf_(off) {
  const d = String(off).slice(0, 10), hm = String(off).slice(11, 16);
  if (hm < '00:30') return Utilities.formatDate(new Date(Date.parse(d + 'T12:00:00Z') - 864e5), 'UTC', 'yyyy-MM-dd') + '|p3';
  if (hm < '08:30') return d + '|p1';
  if (hm < '16:30' && isWorkday_(d)) return d + '|p2';
  return d + '|p3';
}
/** ลงรายการให้เวรอื่นได้ไม่เกิน 3 วันย้อนหลัง */
function outCrossOk_(k) { const t = Date.parse(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') + 'T00:00:00Z'), d = Date.parse(k.slice(0, 10) + 'T00:00:00Z'); return d >= t - 3 * 864e5 && d <= t + 864e5; }
function outSetLbl_(k) { return (k.slice(-2) === 'p1' ? 'เวรช่วง 1' : k.slice(-2) === 'p2' ? 'ในเวลาทำการ' : 'เวรช่วง 2+3') + ' ' + thShortD_(k.slice(0, 10)); }
function outKeyOk_(k) { return OUT_K_RE_.test(k) && (k.slice(-2) !== 'p2' || isWorkday_(k.slice(0, 10))); }
function outPerm_(b, k, cross) {
  const who = approverOf_(b);
  if (who) return { by: who.short || who.name, appr: true };
  if (k.slice(-2) === 'p2') {   // ในเวลาทำการ: ทุกคนที่มีสิทธิ์ตารางเวรในศูนย์รวมงาน · ไม่มีบัญชีลงนาม จึงไม่มีล็อก
    if (!(b.hubUser && b.hubPass)) throw new Error('ล็อกอินศูนย์รวมงานก่อนบันทึกไฟดับในเวลาทำการ');
    if (!hubAllowed_(String(b.hubUser), String(b.hubPass))) throw new Error('บัญชีศูนย์รวมงานนี้ไม่มีสิทธิ์ใช้ตารางเวร');
    const nn = normN_(b.hubUser), pr = readTable_(SH.PEOPLE).filter(function (p) { return normN_(p.full) === nn || normN_(p.short) === nn; })[0];
    return { by: pr ? pr.short : String(b.hubUser), appr: false };
  }
  let by = null, isX = false;
  if (b.r === 'duty' && b.t) {
    if (Number(b.x) < Date.now() || repToken_(String(b.rk || k), b.u, 'duty', b.x) !== b.t) throw new Error('ลิงก์หมดอายุ — ขอลิงก์ใหม่ทาง LINE (พิมพ์ "รายงานเวร")');
    if (String(b.rk || '') !== k) { if (!(cross && outCrossOk_(k))) throw new Error('ลิงก์นี้ใช้ได้เฉพาะเวรของตัวเอง'); isX = true; }
    by = b.u;
  } else if (b.hubUser && b.hubPass) {
    if (!hubAllowed_(String(b.hubUser), String(b.hubPass))) throw new Error('บัญชีศูนย์รวมงานนี้ไม่มีสิทธิ์ใช้ตารางเวร');
    const nn = normN_(b.hubUser), pr = readTable_(SH.PEOPLE).filter(function (p) { return normN_(p.full) === nn || normN_(p.short) === nn; })[0];
    const c = pr ? empCode_(k.slice(0, 10), pr.short) : '', inSet = pr && (k.slice(-2) === 'p1' ? cHas_(c, '1') : (cHas_(c, '2') || cHas_(c, '3')));
    if (!inSet) { if (!(pr && cross && outCrossOk_(k))) throw new Error(cross ? 'ลงย้อนหลังได้ไม่เกิน 3 วัน — เกินกว่านั้นให้ผู้อนุมัติลง' : 'แก้ได้เฉพาะคนอยู่เวรชุดนี้ หรือผู้อนุมัติ (ใส่ PIN)'); isX = true; }
    by = pr.short;
  } else throw new Error('ไม่มีสิทธิ์ — ล็อกอินศูนย์รวมงาน, ใช้ลิงก์จาก LINE ของเวรชุดนี้ หรือใส่ PIN ผู้อนุมัติ');
  const R = reportsOf_(k.slice(0, 7))[k];
  if (R && R.received) throw new Error('เวรนี้ล็อกแล้ว (หผ.ปร. รับเอกสารแล้ว) — แก้ได้เฉพาะผู้อนุมัติ');
  return { by: by, appr: false, cross: isX };
}
function outAuth_(b, k) { return outPerm_(b, k).by; }
const OUT_KEYS_ = ['lvl', 'off', 'on', 'ws', 'we', 'feeder', 'dev', 'cust', 'lat', 'lon', 'cBtn', 'cType', 'cData', 'known', 'weather', 'fix', 'mats', 'detail', 'wo', 'place', 'crew', 'longWhy'];
/** แก้ข้อมูลเวรที่ล็อกแล้ว (ผู้อนุมัติ) → ยกเลิก "รับแล้ว" ให้พิมพ์บัญชีลงนามใหม่ */
function outUnlock_(k, P) { if (!P.appr) return; const R = reportsOf_(k.slice(0, 7))[k]; if (R && R.received) { repSetMeta_(k, { received: null }); log_(P.by, 'ยกเลิกรับเอกสาร (แก้ไฟดับ)', k.slice(0, 7), k); } }
const OUT_HIST_F_ = { lvl: 'แรงดัน', off: 'เวลาไฟดับ', on: 'เวลาจ่ายไฟ', ws: 'เริ่มปฏิบัติงาน', we: 'เสร็จงาน', feeder: 'ฟีดเดอร์', place: 'สถานที่', cType: 'สาเหตุ', cData: 'สาเหตุย่อย', fix: 'การแก้ไข', cust: 'ผู้ใช้ไฟ', detail: 'รายละเอียด', longWhy: 'เหตุผลไฟดับเกิน 4 ชม.' };
function outHist_(d, by, act, extra) {
  d.hist = (Array.isArray(d.hist) ? d.hist : []).concat([Object.assign({ at: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'), by: by, act: act }, extra || {})]).slice(-30);
}
function saveOutage_(b) {
  const o = b.o || {};
  if (o.lvl !== 'hv' && o.lvl !== 'lv') throw new Error('เลือกระดับแรงดัน');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(o.off || ''))) throw new Error('ใส่เวลาไฟดับ');
  if (Date.parse(o.off + ':00+07:00') > Date.now() + 10 * 60000) throw new Error('เวลาไฟดับอยู่ในอนาคต — ตรวจวันที่/เวลาอีกครั้ง');
  if (o.on && String(o.on) < String(o.off)) throw new Error('เวลาไฟมาต้องหลังเวลาไฟดับ');
  if (o.on && Date.parse(o.on + ':00+07:00') > Date.now() + 10 * 60000) throw new Error('เวลาไฟมายังไม่ถึง — ถ้าไฟยังไม่มา ให้เว้นว่างไว้ แล้วค่อยใส่ทีหลัง');
  // มาตรฐานงานแก้ไฟไม่เกิน 4 ชม. — เกินกว่านั้นต้องยืนยันพร้อมเหตุผล (กันลงเวลาผิด เช่น AM/PM สลับ)
  if (o.on && Date.parse(o.on + ':00+07:00') - Date.parse(o.off + ':00+07:00') > 4 * 3600000 && !String(o.longWhy || '').trim()) throw new Error('ไฟดับเกิน 4 ชม. — ตรวจเวลา หรือยืนยันพร้อมใส่เหตุผล');
  if ('longWhy' in o) o.longWhy = String(o.longWhy || '').trim().slice(0, 200);
  const k = outKeyOf_(o.off);   // เวรตามเวลาไฟดับจริง (ไม่ขึ้นกับว่าเปิดฟอร์มจากเวรไหน)
  if (!outKeyOk_(k)) throw new Error('รหัสเวรไม่ถูกต้อง');
  if (!getMonth_(k.slice(0, 7))) throw new Error('ยังไม่มีตารางเวรเดือน ' + k.slice(0, 7));
  const P = outPerm_(b, k, true), by = P.by;
  const sh = outSheet_(), rows = outRows_();
  let cur = null;
  if (o.id) cur = rows.filter(function (x) { return x.id === String(o.id) && !x.deleted; })[0] || null;
  const from = cur && cur.k !== k ? cur.k : '';
  if (from) outPerm_(b, from, true);   // แก้เวลาจนข้ามเวร = ย้ายเวร (ต้องมีสิทธิ์ทั้งสองฝั่ง)
  const d = cur ? cur.d : { id: 'OUT-' + Utilities.formatDate(new Date(), TZ, 'yyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 900 + 100), k: k, created: new Date().toISOString(), createdBy: by };
  const before = JSON.parse(JSON.stringify(d));
  OUT_KEYS_.forEach(function (f) { if (f in o) d[f] = o[f]; });
  if (!Array.isArray(d.mats)) d.mats = [];
  d.mats = d.mats.filter(function (m) { return m && m.n && Number(m.q) > 0; }).map(function (m) { return { n: String(m.n).slice(0, 80), q: Number(m.q), u: String(m.u || '') }; });
  d.crew = (Array.isArray(d.crew) ? d.crew : []).filter(function (c) { return c && c.n; }).slice(0, 12).map(function (c) { return { n: String(c.n).slice(0, 80), p: String(c.p || '').slice(0, 120) }; });   // ผู้ปฏิบัติงาน
  d.updated = new Date().toISOString(); d.by = by;
  const isNew = !cur;
  d.k = k;
  if (from) outHist_(d, by, 'move', { from: from, to: k });
  if (isNew) outHist_(d, by, 'new', P.cross ? { x: 1 } : null);
  else {
    const ch = [];
    Object.keys(OUT_HIST_F_).forEach(function (f) { const a = before[f] == null ? '' : String(before[f]), z = d[f] == null ? '' : String(d[f]); if (a !== z) ch.push({ f: f, from: a.slice(0, 60), to: z.slice(0, 60) }); });
    const da = (before.dev && before.dev.id) || '', dz = (d.dev && d.dev.id) || ''; if (da !== dz) ch.push({ f: 'dev', from: da, to: dz });
    if (JSON.stringify(before.crew || []) !== JSON.stringify(d.crew)) ch.push({ f: 'crew', from: (before.crew || []).map(function (c) { return c.n; }).join(', ').slice(0, 60), to: d.crew.map(function (c) { return c.n; }).join(', ').slice(0, 60) });
    if (JSON.stringify(before.mats || []) !== JSON.stringify(d.mats)) ch.push({ f: 'mats', from: '', to: d.mats.map(function (m) { return m.n + '×' + m.q; }).join(', ').slice(0, 60) });
    if (ch.length) outHist_(d, by, 'edit', { ch: ch });
  }
  // แก้ชั่วคราว + มีพิกัด → ส่งเข้า Patrol ครั้งเดียว
  if (d.fix === 'temp' && !(d.patrol && d.patrol.id)) {
    try { d.patrol = patrolPush_(d, by); } catch (e) { d.patrol = { err: String(e.message || e) }; }
  }
  const rec = [d.id, "'" + k, JSON.stringify(d), new Date(), by, false];
  if (cur) sh.getRange(cur.row, 1, 1, 6).setValues([rec]); else sh.appendRow(rec);
  outUnlock_(k, P); if (from) outUnlock_(from, P);
  log_(by, isNew ? 'บันทึกไฟดับ' : from ? 'แก้ไขไฟดับ (ย้าย ' + from + ')' : 'แก้ไขไฟดับ', k.slice(0, 7), d.id + ' ' + (d.feeder || '') + ' ' + ((d.dev && d.dev.id) || ''));
  if ((isNew || from) && P.cross) { try { outCrossNotify_(d, k, by); } catch (e) {} }
  if (isNew && d.lvl === 'hv') { try { notifyOutage_(d, by); } catch (e) { log_('system', 'แจ้งไฟดับไม่สำเร็จ', '', String(e)); } }
  return d;
}
/** คนอื่นลงรายการให้เวรนี้ → แจ้งคนอยู่เวรชุดนั้นทาง LINE */
function outCrossNotify_(d, k, by) {
  const ymd = k.slice(0, 10), p = k.slice(-2); if (p === 'p2') return;
  const hm = function (x) { return x ? String(x).slice(11, 16) : '—'; };
  const t = '📝 ' + by + ' ลงรายการไฟดับให้ ' + outSetLbl_(k) + '\n' + (d.lvl === 'hv' ? 'แรงสูง' : 'แรงต่ำ') + ' ' + (d.feeder || '') + ((d.dev && d.dev.id) ? ' ' + d.dev.id : '') + ' · ดับ ' + hm(d.off) + '–' + hm(d.on) + ' น.\nนับในรายงานการอยู่เวรของคุณ — ตรวจ/แก้ได้ในแอป';
  readTable_(SH.PEOPLE).forEach(function (x) {
    const c = empCode_(ymd, x.short); if (!c || x.short === by) return;
    if (!(p === 'p1' ? cHas_(c, '1') : (cHas_(c, '2') || cHas_(c, '3')))) return;
    const id = lineIdOf_(x.short); if (id) push_(id, [text_(t)], 'outage');
  });
}
const OUT_DEL_WHY_ = { dup: 'บันทึกซ้ำ', wrong: 'บันทึกผิดเวร', bad: 'ไม่ใช่เหตุการณ์ไฟดับ / ข้อมูลผิด', other: 'อื่น ๆ' };
function deleteOutage_(b) {
  const id = String(b.id || ''); const x = outRows_().filter(function (r) { return r.id === id && !r.deleted; })[0];
  if (!x) throw new Error('ไม่พบรายการ');
  const P = outPerm_(b, x.k), by = P.by, d = x.d;
  const why = OUT_DEL_WHY_[b.why] ? b.why : ''; if (!why) throw new Error('เลือกเหตุผลที่ลบ');
  const note = String(b.note || '').trim().slice(0, 120); if (why === 'other' && !note) throw new Error('ระบุเหตุผล');
  d.del = { at: new Date().toISOString(), by: by, why: why, note: note };
  // งานรับแจ้งที่ปิดด้วยรายการนี้ → กลับเป็น "กำลังแก้"
  const tks = tkRows_().filter(function (t) { return t.st === 'done' && t.d.outId === id; });
  tks.forEach(function (t) { t.st = t.d.accBy ? 'acc' : 'new'; delete t.d.doneAt; delete t.d.outId; delete t.d.onAt; tkWrite_(t); });
  if (tks.length) d.del.tk = tks.map(function (t) { return t.id; });
  outHist_(d, by, 'del', { why: OUT_DEL_WHY_[why] + (note ? ': ' + note : '') });
  outSheet_().getRange(x.row, 3, 1, 4).setValues([[JSON.stringify(d), new Date(), by, true]]);
  outUnlock_(x.k, P);
  log_(by, 'ลบไฟดับ', x.k.slice(0, 7), id + ' · ' + OUT_DEL_WHY_[why] + (note ? ': ' + note : '') + (tks.length ? ' · เปิดงานรับแจ้ง ' + d.del.tk.join(',') + ' ใหม่' : ''));
  return { id: id, reopened: d.del.tk || [] };
}
/** กู้คืน — คนอยู่เวรภายใน 7 วัน · ผู้อนุมัติได้เสมอ · งานรับแจ้งที่เคยผูกกลับมาปิดอีกครั้ง */
function restoreOutage_(b) {
  const id = String(b.id || ''); const x = outRows_().filter(function (r) { return r.id === id && r.deleted; })[0];
  if (!x) throw new Error('ไม่พบรายการที่ลบ');
  const P = outPerm_(b, x.k), by = P.by, d = x.d;
  if (!P.appr && d.del && Date.now() - new Date(d.del.at).getTime() > 7 * 86400000) throw new Error('ลบเกิน 7 วันแล้ว — ให้ผู้อนุมัติกู้คืน');
  const tk = (d.del && d.del.tk) || [];
  tkRows_().filter(function (t) { return tk.indexOf(t.id) >= 0 && (t.st === 'acc' || t.st === 'new'); }).forEach(function (t) {
    t.st = 'done'; t.d.outId = id; t.d.doneAt = new Date().toISOString(); if (d.on) t.d.onAt = new Date(d.on + ':00+07:00').toISOString(); tkWrite_(t); });
  delete d.del; outHist_(d, by, 'restore');
  outSheet_().getRange(x.row, 3, 1, 4).setValues([[JSON.stringify(d), new Date(), by, false]]);
  outUnlock_(x.k, P);
  log_(by, 'กู้คืนไฟดับ', x.k.slice(0, 7), id);
  return d;
}
/** ย้ายไปเวรที่ถูกต้อง — ต้องมีสิทธิ์ทั้งเวรต้นทางและเวรปลายทาง (คนอยู่เวร: ปลายทางต้องยังไม่ล็อก) */
function moveOutage_(b) {
  const id = String(b.id || ''), to = String(b.to || ''); if (!outKeyOk_(to)) throw new Error('เวรปลายทางไม่ถูกต้อง (ในเวลาทำการใช้ได้เฉพาะวันทำการ)');
  const x = outRows_().filter(function (r) { return r.id === id && !r.deleted; })[0]; if (!x) throw new Error('ไม่พบรายการ');
  if (x.k === to) throw new Error('อยู่เวรนี้อยู่แล้ว');
  const P = outPerm_(b, x.k), by = P.by;
  if (!getMonth_(to.slice(0, 7))) throw new Error('ไม่พบตารางเดือน ' + to.slice(0, 7));
  // จากชุดในเวลาทำการ (ใครก็บันทึกได้) ไปเข้าเวร → ต้องเป็นคนอยู่เวรปลายทางหรือผู้อนุมัติ กันรายการเข้าบัญชีลงนามของคนอื่น
  if (!P.appr && x.k.slice(-2) === 'p2' && to.slice(-2) !== 'p2') outPerm_(b, to);
  if (!P.appr) { const R = to.slice(-2) === 'p2' ? null : reportsOf_(to.slice(0, 7))[to]; if (R && R.received) throw new Error('เวรปลายทางล็อกแล้ว — ให้ผู้อนุมัติย้าย'); }
  const d = x.d, from = x.k; d.k = to; outHist_(d, by, 'move', { from: from, to: to });
  outSheet_().getRange(x.row, 2, 1, 4).setValues([["'" + to, JSON.stringify(d), new Date(), by]]);
  outUnlock_(from, P); outUnlock_(to, P);
  log_(by, 'ย้ายเวรไฟดับ', from.slice(0, 7), id + ' ' + from + ' → ' + to);
  return d;
}
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

/* ===================== กระดิ่งปลุกเวร (กล่อง ESP32 หน้าห้องเวร) =====================
 * กล่องถาม GET ?action=bell&k=KEY ทุก ~10 วิ → { ring: 0 เงียบ | 1 ดังเป็นจังหวะ | 2 ดังยาว | 3 ทดสอบ }
 * ดังเมื่อมีงานรับแจ้งใหม่ที่เข้ามานอกเวลาทำการ (หรือ หผ.ปร. กด "เรียกเวร") และยังไม่มีคนรับทราบ/รับงาน
 * 0–3 นาที จังหวะ · 3–20 นาที ดังยาว (+ LINE ซ้ำถึงเวร) · 8 นาที LINE ถึง หผ.ปร./ชผ. · เกิน 20 นาที หยุด
 * ปุ่มที่กล่อง = รับทราบ (หยุดกระดิ่ง) · กด "✋ รับงาน" ใน LINE/แอป ก็หยุดเช่นกัน */
const BELL_ = { e1: 3, e2: 8, stop: 20 };   // นาที
function bellHours_(d) {   // นอกเวลาทำการ: วันหยุดทั้งวัน · วันทำการ 16:30–08:30
  d = d || new Date(); const ymd = bkkYmd_(d), hm = Utilities.formatDate(d, TZ, 'HH:mm');
  return !isWorkday_(ymd) || hm < '08:30' || hm >= '16:30';
}
function bellFlag_() { CacheService.getScriptCache().put('bellOn', '1', 1500); }
function bellKey_() {
  const props = PropertiesService.getScriptProperties(); let k = props.getProperty('BELL_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, '').slice(0, 16); props.setProperty('BELL_KEY', k); }
  return k;
}
function bellCall_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty('BELL_CALL') || 'null'); }
/** รายการที่กำลังปลุก (เก่าสุดก่อน) */
function bellActive_() {
  const now = Date.now(), out = [];
  const c = bellCall_(); if (c && !c.ackAt && now - c.at < BELL_.stop * 60000) out.push({ kind: 'call', id: c.id, at: c.at, text: c.text || 'หผ.ปร. เรียกเวร' });
  if (CacheService.getScriptCache().get('bellOn')) tkRows_().forEach(function (x) {
    if (x.st !== 'new' || !x.d.bell || x.d.bellAck) return;
    const t = new Date(x.d.at).getTime(); if (now - t >= BELL_.stop * 60000) return;
    out.push({ kind: 'tk', id: x.id, at: t, text: (TK_TYPES_[x.d.type] || 'แจ้งไฟดับ') + (x.d.place ? ' ' + x.d.place : ''), x: x });
  });
  return out.sort(function (a, b) { return a.at - b.at; });
}
function dutyShorts_() {
  const td = dayData_(bkkYmd_()), yd = dayData_(addDays_(bkkYmd_(), -1)), emp = Object.assign({}, yd ? yd.emp : {}, td ? td.emp : {});
  return Object.keys(onDutyNow_()).filter(function (n) { return n in emp; });
}
function bellPushText_(shorts, text) {
  const sent = [];
  shorts.forEach(function (n) { const id = lineIdOf_(n); if (id && push_(id, [{ type: 'text', text: text }], 'ticket')) sent.push(n); });
  return sent;
}
/** ขั้นไล่แจ้ง — เรียกจากการถามของกล่อง (ทุก 10 วิ) และ tkCheck (ทุก 5 นาที เผื่อกล่องดับ) */
function bellEscalate_(L) {
  const now = Date.now();
  L.forEach(function (a) {
    const m = (now - a.at) / 60000;
    if (a.kind !== 'tk') return;
    const d = a.x.d; let ch = false;
    if (m >= BELL_.e1 && !d.bellE1) { d.bellE1 = new Date().toISOString(); ch = true; try { tkNotify_(d, false); } catch (e) {} }
    if (m >= BELL_.e2 && !d.bellE2) { d.bellE2 = d.again = new Date().toISOString(); ch = true; try { tkNotify_(d, true); } catch (e) {}
      log_('system', 'กระดิ่ง: ยังไม่มีคนรับเรื่อง ' + BELL_.e2 + ' นาที', '', d.id); }
    if (ch) tkWrite_(a.x);
  });
}
/** API ของกล่องกระดิ่ง */
function bellPoll_(q) {
  if (String(q.k || '') !== bellKey_()) throw new Error('กุญแจกล่องกระดิ่งไม่ถูกต้อง');
  const cache = CacheService.getScriptCache(), now = Date.now();
  cache.put('bellHB', String(now), 21600);
  if (q.ack) return bellAck_('ปุ่มหน้าห้องเวร');
  if (cache.get('bellTest')) { cache.remove('bellTest'); return { ring: 3, text: 'ทดสอบกระดิ่ง' }; }
  if (!cache.get('bellOn') && !bellCall_()) return { ring: 0 };
  const L = bellActive_();
  if (!L.length) return { ring: 0 };
  bellEscalate_(L);
  const m = (now - L[0].at) / 60000;
  return { ring: m < BELL_.e1 ? 1 : 2, n: L.length, id: L[0].id, text: L[0].text.slice(0, 60), min: Math.floor(m) };
}
/** รับทราบ (หยุดกระดิ่ง) — จากปุ่มที่กล่อง หรือในแอป */
function bellAck_(by) {
  const L = bellActive_(), at = new Date().toISOString(), t = Utilities.formatDate(new Date(), TZ, 'HH:mm');
  L.forEach(function (a) {
    if (a.kind === 'call') { const c = bellCall_(); c.ackAt = Date.now(); c.ackBy = by; PropertiesService.getScriptProperties().setProperty('BELL_CALL', JSON.stringify(c)); }
    else { a.x.d.bellAck = { at: at, by: by }; tkWrite_(a.x); }
  });
  if (L.length) {
    log_(by, 'กระดิ่ง: รับทราบ', '', L.map(function (a) { return a.id; }).join(', '));
    try { bellPushText_(dutyShorts_(), '🔔 รับทราบแล้ว ' + t + ' น. (' + by + ')\n' + L.map(function (a) { return '• ' + a.id + ' ' + a.text; }).join('\n') +
      (L.some(function (a) { return a.kind === 'tk'; }) ? '\nอย่าลืมกด "✋ รับงาน" ในการ์ดรับแจ้ง' : '')); } catch (e) {}
  }
  return { ring: 0, acked: L.length };
}
/** หผ.ปร. กดเรียกเวร (PIN) — กระดิ่งดังแม้ไม่มีงานรับแจ้ง */
function bellCallNow_(who, text) {
  const c = { id: 'C' + Utilities.formatDate(new Date(), TZ, 'HHmm'), at: Date.now(), by: who.name, text: String(text || 'หผ.ปร. เรียกเวร').slice(0, 60) };
  PropertiesService.getScriptProperties().setProperty('BELL_CALL', JSON.stringify(c));
  log_(who.name, 'กระดิ่ง: เรียกเวร', '', c.text);
  try { bellPushText_(dutyShorts_(), '🔔 ' + c.text + ' (' + who.name + ')\nกดรับทราบที่ปุ่มหน้าห้องเวร หรือในแอป'); } catch (e) {}
  return c;
}
function bellStatus_() {
  const hb = Number(CacheService.getScriptCache().get('bellHB') || 0), L = bellActive_();
  return { online: hb && Date.now() - hb < 5 * 60000, lastSeen: hb ? new Date(hb).toISOString() : '', hours: bellHours_(), rssi: Number(CacheService.getScriptCache().get('bellRssi') || 0),
    ringing: L.map(function (a) { return { id: a.id, text: a.text, min: Math.floor((Date.now() - a.at) / 60000) }; }) };
}
/** กล่องจอทัช (ESP32-2432S028) — GET ?action=box&k=KEY ทุก ~10 วิ
 * คืนค่าเหมือน bell (ring/n/id/text/min) + ข้อมูลหน้าจอ (คนอยู่เวร · งานค้าง · รายการงาน 12 ชม.)
 * &ack=1&by=ชื่อ = รับทราบ (ชื่อคนที่แตะ) · &ev=light = ไฟห้องเปิดระหว่างปลุก · &rssi=-60 = ความแรง Wi-Fi */
function boxPoll_(q) {
  if (String(q.k || '') !== bellKey_()) throw new Error('กุญแจกล่องกระดิ่งไม่ถูกต้อง');
  const cache = CacheService.getScriptCache();
  if (q.rssi) cache.put('bellRssi', String(Number(q.rssi) || 0), 21600);
  if (q.ev === 'light') {
    const L = bellActive_();
    if (L.length) log_('กล่องหน้าห้องเวร', 'กระดิ่ง: ไฟห้องเปิด (มีคนตื่น)', '', L.map(function (a) { return a.id; }).join(', '));
  }
  let r;
  if (q.ack) {
    cache.put('bellHB', String(Date.now()), 21600);
    const by = String(q.by || '').trim().slice(0, 40);
    r = bellAck_(by ? by + ' · กล่องหน้าห้องเวร' : 'ปุ่มหน้าห้องเวร');
    cache.remove('boxInfo');
  } else r = bellPoll_({ k: q.k });
  return Object.assign(r, boxInfo_());
}
/** สภาพอากาศอ่าวลึกสำหรับหน้าสลับของกล่อง (ข้อมูลเดียวกับระดับสภาพอากาศในแอป) */
function boxWx_() {
  try {
    const d = weatherData_(); if (!d) return null;
    const w = wxNow_(), hrs = [];
    for (let i = 1; i <= 6 && i < (d.hrs || []).length; i++) hrs.push({ h: d.hrs[i], p: d.probs[i] == null ? -1 : d.probs[i] });
    return { lv: w.lv, label: w.label || '', t: d.t == null ? null : Math.round(d.t), rh: d.rh == null ? null : Math.round(d.rh),
      gust: d.gust == null ? null : Math.round(d.gust), cond: WX_TH_[d.code] || '', at: Utilities.formatDate(new Date(d.at), TZ, 'HH:mm'), hrs: hrs };
  } catch (e) { return null; }
}
/** ตลาด 4 ตัว (Yahoo Finance ฟรี · จำไว้ 10 นาที) */
// pip = ขนาด 1 หน่วยที่นับ · u = คำเรียก · pd = ทศนิยมของจำนวน pip/จุด
const BOX_MK_ = [{ n: 'ทองคำ', s: 'GC=F', d: 1, off: 'boxGoldOffset', pip: 0.1, u: 'pips', pd: 0 }, { n: 'บิตคอยน์', s: 'BTC-USD', d: 0, pip: 1, u: 'จุด', pd: 0 },
  { n: 'USD/THB', s: 'THB=X', d: 2, pip: 0.01, u: 'pips', pd: 0 }, { n: 'SET', s: '^SET.BK', d: 2, pip: 1, u: 'จุด', pd: 2 }];
function boxMk_() {
  const cache = CacheService.getScriptCache(), hit = cache.get('boxMk2');
  if (hit) return JSON.parse(hit);
  let out = [];
  const cfg = getConfig_();
  try {
    const res = UrlFetchApp.fetchAll(BOX_MK_.map(function (m) {
      return { url: 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(m.s) + '?range=1d&interval=5m', muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } };
    }));
    out = BOX_MK_.map(function (m, i) {
      try {
        const r0 = JSON.parse(res[i].getContentText()).chart.result[0], meta = r0.meta, p = Number(meta.regularMarketPrice), pc = Number(meta.chartPreviousClose || meta.previousClose);
        const q = (r0.indicators && r0.indicators.quote && r0.indicators.quote[0]) || {}, op = Number((q.open || []).filter(function (v) { return v != null; })[0]);   // ราคาเปิดของวันนี้ (ตามเวลาเปิดของแต่ละตลาด)
        if (!isFinite(p)) return null;
        const off = m.off ? Number(cfg[m.off]) || 0 : 0;   // ทองฟิวเจอร์ส → หัก offset ให้ใกล้ราคาสปอต (ตั้งใน Config: boxGoldOffset)
        const pct = isFinite(pc) && pc ? (p - pc) / pc * 100 : 0;
        const fmt = function (v, d) { return v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
        const o = { n: m.n, p: fmt(p - off, m.d), c: Math.round(pct * 10) / 10 };
        if (isFinite(op) && op > 0) {
          const k = (p - op) / m.pip, kr = m.pd ? Math.round(k * 100) / 100 : Math.round(k);
          o.o = fmt(op - off, m.d); o.u = kr > 0 ? 1 : kr < 0 ? -1 : 0;
          o.dt = (kr > 0 ? '+' : kr < 0 ? '−' : '') + fmt(Math.abs(kr), m.pd) + ' ' + m.u;
        }
        return o;
      } catch (e) { return null; }
    }).filter(function (x) { return x; });
  } catch (e) { out = []; }
  const r = { at: Utilities.formatDate(new Date(), TZ, 'HH:mm'), items: out };
  if (out.length) cache.put('boxMk2', JSON.stringify(r), 600);
  return r;
}
/** คนงานที่อยู่เวรตอนนี้ (คนที่อยู่เวรแต่ไม่ใช่พนักงาน) */
function crewNow_() {
  const td = dayData_(bkkYmd_()), yd = dayData_(addDays_(bkkYmd_(), -1)), emp = Object.assign({}, yd ? yd.emp : {}, td ? td.emp : {});
  return Object.keys(onDutyNow_()).filter(function (n) { return !(n in emp); });
}
function boxInfo_() {
  const cache = CacheService.getScriptCache(), c = cache.get('boxInfo');
  if (c) return JSON.parse(c);
  const rows = tkRows_(), since = Date.now() - 12 * 3600000, today = bkkYmd_();
  const live = function (x) { return x.st === 'new' || x.st === 'acc'; };
  const jobs = rows.filter(function (x) { return x.st !== 'dup' && x.st !== 'cancel' && (live(x) || new Date(x.d.upd || x.d.at).getTime() > since); })
    .sort(function (a, b) { return new Date(b.d.at) - new Date(a.d.at); }).slice(0, 6)
    .map(function (x) {
      const d = x.d;
      return { id: x.id, t: Utilities.formatDate(new Date(d.at), TZ, 'HH:mm'), type: TK_TYPES_[d.type] || 'แจ้งไฟดับ', place: String(d.place || '').slice(0, 60),
        st: x.st, by: d.accBy || (d.bellAck && d.bellAck.by) || '', ph: d.phone || '', lat: d.lat || 0, lon: d.lon || 0 };
    });
  // เวลาทำการไม่มีพนักงานเวร → แสดงผู้รับผิดชอบแทน (ตั้งใน Config: boxOfficeDuty)
  let duty = dutyShorts_();
  if (!duty.length && !bellHours_()) duty = [String(getConfig_().boxOfficeDuty || 'ผปร. : อติวิทย์')];
  const out = { duty: duty, crew: crewNow_(), open: rows.filter(live).length,
    today: rows.filter(function (x) { return x.st !== 'dup' && bkkYmd_(new Date(x.d.at)) === today; }).length,
    jobs: jobs, app: webUrl_('viewDaily', { tk: 1 }) || '', wx: boxWx_(), mk: boxMk_(),
    rot: String(getConfig_().boxRot || '20,10,5').split(',').map(function (x) { return Math.max(0, Math.min(120, Number(x) || 0)); }) };
  cache.put('boxInfo', JSON.stringify(out), 30);
  return out;
}
/** tkCheck: ไล่แจ้งแทนกล่อง (ถ้ากล่องดับ) + เตือนเมื่อกล่องขาดการติดต่อเกิน 5 นาที (เฉพาะช่วงเวลาปลุก) */
function bellWatch_() {
  const props = PropertiesService.getScriptProperties(); if (!props.getProperty('BELL_KEY')) return;   // ยังไม่ได้ติดตั้งกล่อง
  try { bellEscalate_(bellActive_()); } catch (e) {}
  const hb = Number(CacheService.getScriptCache().get('bellHB') || 0), off = !hb || Date.now() - hb > 5 * 60000, was = props.getProperty('BELL_OFF');
  if (off && !was && bellHours_() && hb) { props.setProperty('BELL_OFF', '1');
    try { notifyApprovers_('🔕 กระดิ่งหน้าห้องเวรขาดการติดต่อ', 'ไม่ได้รับสัญญาณจากกล่องกระดิ่งเกิน 5 นาที (ล่าสุด ' + Utilities.formatDate(new Date(hb), TZ, 'HH:mm') + ' น.) — ตรวจไฟ/Wi-Fi ที่ห้องเวร'); } catch (e) {} }
  if (!off && was) { props.deleteProperty('BELL_OFF'); try { notifyApprovers_('🔔 กระดิ่งหน้าห้องเวรกลับมาออนไลน์', 'กล่องกระดิ่งเชื่อมต่อได้ตามปกติแล้ว'); } catch (e) {} }
}
/** ticketAct 'acc' ก็หยุดกระดิ่ง (st ไม่ใช่ new) — ไม่ต้องทำเพิ่ม */

/* ===================== ข้อความจาก LINE OpenChat (มือถือ Android + MacroDroid อ่านแจ้งเตือนแล้วส่งมา) =====================
 * GET ?action=oc&k=KEY&ti=<หัวแจ้งเตือน>&tx=<ข้อความ>&bt=<ข้อความเต็ม> · ?action=oc&k=KEY&ping=1 (ทุก 10 นาที)
 * ส่งเฉพาะห้องที่ตั้งไว้ (config.ocRoom) — ห้องอื่น/แชทส่วนตัว ไม่บันทึก
 * ocMode: test (ค่าเริ่มต้น) = บันทึก + ข้อความตรงคำ → LINE ถึง config.ocTestTo คนเดียว · ไม่เปิดงาน ไม่สั่งกระดิ่ง */
const OC_SHEET_ = 'OpenChat';
const OC_STAFF_ = 'manasak philarite,Aum,konlawat,Puttapong,กัมปนาทท์,กำลังแก้ไขครับ,ดีน505860,วิชัย,สกายย,อ๋องสมิง,ใจเย็นๆกำลังแก้ไขครับ,😐วอนผู้ใช้ไฟใจเย็นคับ';   // ชื่อแอดมิน/เจ้าหน้าที่ในห้อง — บันทึกแต่ไม่นับเป็นการแจ้ง (แก้ได้ที่ Config ocStaff)
function ocName_(s) { return String(s || '').replace(/[^\p{L}\p{N}\p{M}]/gu, '').toLowerCase(); }
const OC_WORDS_ = 'ไฟดับ,ไฟไม่มา,ไม่มีไฟ,ไฟไม่มี,ไฟติดๆดับๆ,ไฟติดดับ,ไฟตก,ไฟกระพริบ,ไฟกะพริบ,สายขาด,สายพาด,สายหย่อน,ไฟไหม้,ไฟช็อต,ไฟช๊อต,ประกายไฟ,เสาล้ม,เสาหัก,ต้นไม้ล้ม,ต้นไม้ทับ,หม้อแปลง,ระเบิด,ฟิวส์';
/* คัดข้อความ OpenChat — ผู้ใช้ไฟพูดได้หลายแบบ จึงจับเป็น "รูปแบบ" ไม่ใช่คำตายตัว
 * ปรับข้อความก่อนเทียบ: ไฟฟ้า→ไฟ · ใฟ→ไฟ · ตัดเว้นวรรค/วรรณยุกต์/ไม้ไต่คู้/การันต์ · ตัวซ้ำ (ดับบบ→ดับ) · ดัป→ดับ
 * sure  = ตรงรูปแบบแจ้งเหตุ · maybe = คนนอก พิมพ์อย่างอื่นที่ไม่ใช่คำขอบคุณ/ไฟมาแล้ว (ห้องนี้มีไว้แจ้งไฟ จึงให้เจ้าหน้าที่ดูไว้ก่อน) · no = ขอบคุณ/ไฟมาแล้ว */
function ocNormTh_(s) {
  return String(s || '').toLowerCase().replace(/ไฟฟ้า/g, 'ไฟ').replace(/ใฟ/g, 'ไฟ').replace(/[\s​]+/g, '')
    .replace(/[็-์]/g, '').replace(/(.)\1{2,}/g, '$1').replace(/ดัป/g, 'ดับ');
}
const OC_PAT_ = [
  ['ไฟดับ', 'ไฟ.{0,12}ดับ'], ['ไฟดับ', 'ดับ.{0,3}(ทั้ง|ยก|หมด)(ซอย|หมู่|บ้าน|ถนน|ตำบล|แถบ|แถว|หมด)'],
  ['ไม่มีไฟ', '(ไม่มี|ยังไม่มี|ไม่มา|ยังไม่มา)ไฟ'], ['ยังดับอยู่', '(ยังดับ|ดับอยู่|ดับนาน|ดับตั้งแต่|ดับมา)'], ['ไฟไม่มา', 'ไฟ.{0,12}(ไม่มา|ยังไม่มา|ไม่ติด|หายไป|หาย|ไม่มี|มาๆหายๆ|มาหาย|ติดๆดับๆ|ติดดับ|ไม่ครบ|ไม่เต็ม|ขาดเฟส)'],
  ['ไฟตก/ไฟกระพริบ', 'ไฟ.{0,10}(อ่อน|ตก|กระพริบ|กะพริบ|วูบ|กระตุก|สลัว|ไม่แรง|แรงเกิน|เกิน|กระชาก)'], ['แรงดันผิดปกติ', 'แรงดัน.{0,6}(ต่ำ|ตก|เกิน|สูง|ไม่พอ)'],
  ['ไฟช็อต/ไฟรั่ว', 'ไฟ.{0,6}(ชอต|ชอร์ต|ซอต|ช็อต|รั่ว|ดูด|ลุก|ไหม้)'], ['ประกายไฟ/ระเบิด', '(ประกายไฟ|สปาร์ค|สปาร์ก|ระเบิด|ดังปัง|ดังตูม|เสียงดังปัง|ควันขึ้น|ไฟลุก|ไฟไหม้)'],
  ['สายไฟ', 'สาย.{0,10}(ขาด|หย่อน|พาด|ตก|ลงพื้น|ลงมา|ห้อย|ไหม้|หลุด|ชอต|ช็อต|ต่ำ|เกี่ยว|พันกัน|ระเบิด)'],
  ['เสาไฟ', 'เสา.{0,8}(ล้ม|หัก|เอียง|ไหม้|ชน|ร้าว|โค่น|ทรุด|จะล้ม)'], ['ต้นไม้', '(ต้นไม้|กิ่งไม้|กิ่ง|ไม้|ไผ่|มะพร้าว|ยาง|ปาล์ม).{0,12}(ล้ม|ทับ|พาด|หัก|โดน|ติด|แตะ|เกี่ยว|ระ)สาย'],
  ['ต้นไม้', '(ต้นไม้|กิ่งไม้).{0,8}(ล้ม|ทับ|พาด|หัก)'],
  ['อุปกรณ์', '(หม้อแปลง|ฟิวส์|ฟิว|เบรกเกอร์|เบรคเกอร์|คัทเอาท์|คัตเอาต์|ลูกถ้วย|มิเตอร์|มิเตอ|ล่อฟ้า).{0,10}(ไหม้|ระเบิด|ดับ|ขาด|ตัด|ทริป|ตก|ไม่หมุน|เสีย|ควัน|ดัง|แตก|ร้อน)'],
  ['อุปกรณ์', '(หม้อแปลง|ฟิวส์|เบรกเกอร์|เบรคเกอร์).{0,4}(ไฟ|ดับ)'], ['มืดทั้งซอย', 'มืด.{0,8}(ทั้ง|หมด|ซอย|หมู่|บ้าน|ถนน|แถว)'],
  ['แจ้งไฟ', '(แจ้ง|รบกวน|ช่วย|ขอให้|ขอช่าง|ขอเจ้าหน้าที่).{0,10}(ไฟ|ช่าง|เจ้าหน้าที่|การไฟ|กฟภ|กฟส)'], ['เครื่องใช้ไฟ', '(แอร์|ตู้เย็น|ปั๊ม|ปั้ม|ทีวี|พัดลม|หลอด).{0,12}(ไม่ทำงาน|ไม่ติด|ดับ|ไหม้|เสีย).{0,10}ไฟ']
].map(function (x) { return [x[0], new RegExp(ocNormTh_(x[1]))]; });
const OC_IGNORE_ = new RegExp(ocNormTh_('^(ขอบคุณ|ขอบใจ|ขอบพระคุณ|thank|ไฟมาแล้ว|ไฟติดแล้ว|มาแล้ว|ได้แล้ว|ใช้ได้แล้ว|เรียบร้อย|โอเค|ok|รับทราบ|ครับ|ค่ะ|คะ|จ้า|จ้ะ|555)|(ขอบคุณ)'));
const OC_BACK_ = new RegExp(ocNormTh_('(ไฟมาแล้ว|ไฟติดแล้ว|ไฟมาละ|ไฟกลับมาแล้ว|ไฟใช้ได้แล้ว)')), OC_BACK_NOT_ = new RegExp(ocNormTh_('(ดับอีก|หายอีก|ยังไม่|บางบ้าน|บางหลัง)'));
function ocClassify_(body, C) {
  const n = ocNormTh_(body);
  if (OC_BACK_.test(n) && !OC_BACK_NOT_.test(n)) return { lv: 'no', why: '' };   // แจ้งว่าไฟมาแล้ว
  for (let i = 0; i < OC_PAT_.length; i++) if (OC_PAT_[i][1].test(n)) return { lv: 'sure', why: OC_PAT_[i][0] };
  const w = C.words.filter(function (x) { return n.indexOf(ocNormTh_(x)) >= 0; })[0];
  if (w) return { lv: 'sure', why: w };
  if (!n || OC_IGNORE_.test(n) || /^[\p{P}\p{S}\d]*$/u.test(n)) return { lv: 'no', why: '' };
  return { lv: 'maybe', why: '' };
}
function ocCfg_() {
  const c = getConfig_();
  return { room: String(c.ocRoom || 'แจ้งกระแสไฟฟ้าขัดข้องอ่าวลึก'), mode: String(c.ocMode || 'test'), testTo: String(c.ocTestTo || 'มานศักดิ์'),
    staff: String(c.ocStaff || OC_STAFF_).split(/[,\n]/).map(ocName_).filter(String),
    words: String(c.ocWords || OC_WORDS_).split(/[,\n]/).map(function (w) { return w.trim(); }).filter(String) };
}
function ocKey_() { return PropertiesService.getScriptProperties().getProperty('OC_KEY') || ''; }
/** รันครั้งเดียวในหน้าแก้ไขสคริปต์: สร้างกุญแจ แล้วดู Log */
function ocSetup() {
  const props = PropertiesService.getScriptProperties(); let k = props.getProperty('OC_KEY');
  if (!k) { k = Utilities.getUuid().replace(/-/g, '').slice(0, 16); props.setProperty('OC_KEY', k); }
  Logger.log('OC_KEY=' + k + ' · room=' + ocCfg_().room + ' · mode=' + ocCfg_().mode);
}
function ocSheet_() {
  let sh = sheet_(OC_SHEET_);
  if (!sh) { sh = ss_().insertSheet(OC_SHEET_); sh.getRange(1, 1, 1, 6).setValues([['time', 'sender', 'text', 'result', 'room', 'raw']]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}
function ocNorm_(s) { return String(s || '').replace(/[\s​]+/g, ''); }
function ocIn_(q) {
  const key = ocKey_(); if (!key || String(q.k || '') !== key) throw new Error('กุญแจไม่ถูกต้อง');
  const cache = CacheService.getScriptCache(); cache.put('ocHB', String(Date.now()), 21600);
  if (q.ping) return { ping: 1 };
  const C = ocCfg_(), ti = String(q.ti || '').slice(0, 300), tx = String(q.tx || '').slice(0, 2000), bt = String(q.bt || '').slice(0, 2000);
  const room = ocNorm_(C.room);
  if (!room || [ti, tx, bt, String(q.sub || '')].every(function (s) { return ocNorm_(s).indexOf(room) < 0; })) return { skip: 'room' };   // ไม่ใช่ห้องที่ตั้งไว้ → ไม่เก็บ
  let body = (bt.length > tx.length ? bt : tx).trim(), sender = '';
  if (ocNorm_(ti).indexOf(room) >= 0) { const m = body.match(/^([^\n:：]{1,40}?)\s*[:：]\s*([\s\S]+)$/); if (m) { sender = m[1].trim(); body = m[2].trim(); } }
  else { sender = ti.trim(); }
  const raw = JSON.stringify({ ti: ti, tx: tx, bt: bt, sub: String(q.sub || '').slice(0, 200) });
  let result;
  if (!body || /^\d+\s*(ข้อความใหม่|new messages?)/i.test(body)) result = 'สรุปแจ้งเตือน (ไม่มีข้อความ)';
  else {
    let h = 5381; const hs = sender + '|' + body; for (let i = 0; i < hs.length; i++) h = ((h * 33) ^ hs.charCodeAt(i)) >>> 0;
    const dk = 'oc_' + h + '_' + hs.length;
    if (cache.get(dk)) result = 'ซ้ำ – ข้าม';
    else {
      cache.put(dk, '1', 600);
      const k = ocClassify_(body, C);
      if (sender && C.staff.indexOf(ocName_(sender)) >= 0) result = 'เจ้าหน้าที่ (ไม่นับ)';
      else if (k.lv === 'no') result = 'บันทึก';
      else {
        result = (k.lv === 'sure' ? 'ตรง "' + k.why + '"' : 'อาจเป็นการแจ้ง') + (C.mode === 'test' ? ' (ทดสอบ)' : '');
        if (C.mode === 'test') {
          const id = lineIdOf_(C.testTo), t = Utilities.formatDate(new Date(), TZ, 'HH:mm');
          if (id) push_(id, [text_((k.lv === 'sure' ? '🧪 ทดสอบ OpenChat · ตรง "' + k.why + '"' : '🧪❔ ทดสอบ OpenChat · อาจเป็นการแจ้ง (ไม่ตรงรูปแบบ)') + '\nจาก ' + (sender || '-') + ' · ' + t + ' น.\n' + body.slice(0, 500))], 'ticket');
        }
      }
    }
  }
  ocSheet_().appendRow([new Date(), sender, body, result, C.room, raw]);
  return { result: result };
}
/** tkCheck: มือถือเงียบเกิน 15 นาที (ช่วงนอกเวลาทำการ) → เตือนครั้งเดียว · กลับมา → แจ้ง */
function ocWatch_() {
  const props = PropertiesService.getScriptProperties(); if (!props.getProperty('OC_KEY')) return;
  const hb = Number(CacheService.getScriptCache().get('ocHB') || 0); if (!hb) return;
  const off = Date.now() - hb > 15 * 60000, was = props.getProperty('OC_OFF'), C = ocCfg_();
  const tell = function (msg) { if (C.mode === 'test') { const id = lineIdOf_(C.testTo); if (id) push_(id, [text_(msg)], 'ticket'); } else notifyApprovers_(msg.split('\n')[0], msg.split('\n').slice(1).join('\n') || msg); };
  if (off && !was && bellHours_()) { props.setProperty('OC_OFF', '1'); try { tell('📵 มือถือรับข้อความ OpenChat เงียบเกิน 15 นาที\nล่าสุด ' + Utilities.formatDate(new Date(hb), TZ, 'HH:mm') + ' น. — ตรวจแบต/เน็ต/MacroDroid'); } catch (e) {} }
  if (!off && was) { props.deleteProperty('OC_OFF'); try { tell('📲 มือถือรับข้อความ OpenChat กลับมาทำงานแล้ว'); } catch (e) {} }
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
  if (bellHours_(now)) { d.bell = 1; bellFlag_(); }
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
  try { repRemindDaily_(); } catch (e) { log_('system', 'เตือนรายงานเวรไม่สำเร็จ', '', String(e)); }
  try { retExpire_(); } catch (e) {}
  try { wxTick_(); } catch (e) {}
  try { bellWatch_(); } catch (e) {}
  try { ocWatch_(); } catch (e) {}
  const now = Date.now();
  tkRows_().forEach(function (x) {
    if (x.st !== 'new' || x.d.again || x.d.bellAck) return;
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
  if (bellHours_(now)) { d.bell = 1; bellFlag_(); }
  tkSheet_().appendRow([id, now, JSON.stringify(d), 'new', now]);
  log_(by, 'รับแจ้งไฟดับ (ส่งต่อจาก LINE)', bkkYmd_().slice(0, 7), id);
  try { tkNotify_(d, false); } catch (e) {}
  try { tkEnsureTrigger_(); } catch (e) {}
  return d;
}

/* ======================================================================
 *  ติดตามรายงานการอยู่เวร — กำหนดส่ง 3 วันหลังวันเข้าเวร (ถึง 23:59)
 *  ขั้น: กรอก (คนอยู่เวร) → ตรวจ (ผู้ตรวจเวร, อีก 3 วันหลังกรอก) → พิมพ์ → หผ.ปร. รับเอกสาร = ปิด
 *  เริ่มติดตามตั้งแต่ config.repTrackFrom (ค่าเริ่มต้น 2026-11-09) — ก่อนหน้านั้นไม่ทวง
 * ====================================================================== */
const REP_DUE_DAYS_ = 3;
function repTrackFrom_() { const v = getConfig_().repTrackFrom; return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '2026-11-09').slice(0, 10); }
function normN_(s) { return String(s || '').replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').replace(/\s+/g, '').toLowerCase(); }
function repFilled_(r) { return !!r && ['arr', 'dep', 'hv', 'lv', 'temp', 'comm', 'att', 'other'].some(function (f) { return r[f] != null && r[f] !== ''; }); }
function dayDiff_(a, b) { return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000); }
/** รายการติดตามของเดือน (เฉพาะชุดเวรที่ลงเวรแล้ว) */
function repTrack_(month) {
  const mo = getMonth_(month); if (!mo) return [];
  const R = reportsOf_(month), now = Date.now(), today = bkkYmd_(), from = repTrackFrom_(), out = [];
  mo.data.days.forEach(function (dd, i) {
    const ymd = month + '-' + ('0' + (i + 1)).slice(-2); if (ymd < from) return;
    ['p1', 'p3'].forEach(function (p) {
      const names = Object.keys(mo.data.emp).filter(function (n) { const c = mo.data.emp[n][i]; return p === 'p1' ? cHas_(c, '1') : (cHas_(c, '2') || cHas_(c, '3')); });
      if (!names.length) return;
      const any3 = names.some(function (n) { return cHas_(mo.data.emp[n][i], '3'); });
      const end = p === 'p1' ? new Date(ymd + 'T08:30:00+07:00').getTime() : any3 ? new Date(addDays_(ymd, 1) + 'T00:30:00+07:00').getTime() : new Date(ymd + 'T16:30:00+07:00').getTime();
      if (end > now) return;
      const k = ymd + '|' + p, r = R[k], filled = repFilled_(r);
      const insp = (mo.data.insp || [])[i] || '', inspected = !!(r && r.insp && r.insp.complete != null);
      const due = addDays_(ymd, REP_DUE_DAYS_);
      const fd = r && r.filledAt ? String(r.filledAt).slice(0, 10) : (r && r._at ? (function (s) { const m = String(s).match(/^(\d+)\/(\d+)\/(\d+)/); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : today; })(r._at) : today);
      const inspDue = addDays_(fd, REP_DUE_DAYS_);
      let st = !filled ? 'fill' : !inspected ? 'insp' : !(r.received) ? 'recv' : 'done';
      const d0 = st === 'fill' ? due : st === 'insp' ? inspDue : '';
      const left = d0 ? dayDiff_(today, d0) : null;
      out.push({ k: k, d: i + 1, p: p, label: p === 'p1' ? 'ช่วง 1' : (names.some(function (n) { return cHas_(mo.data.emp[n][i], '2'); }) ? 'ช่วง 2+3' : 'ช่วง 3'),
        names: names, insp: insp, st: st, due: d0, left: left, over: left != null && left < 0,
        printed: r && r.printed ? r.printed : null, received: r && r.received ? r.received : null });
    });
  });
  return out;
}
/** เตือนรายวัน (เรียกจาก tkCheck ทุก 5 นาที — ทำวันละครั้งหลัง 08:30) */
function repRemindDaily_() {
  const now = new Date(), today = bkkYmd_(now), hm = Utilities.formatDate(now, TZ, 'HH:mm');
  const props = PropertiesService.getScriptProperties();
  if (hm < '08:30' || props.getProperty('REP_REM') === today) return;
  props.setProperty('REP_REM', today);
  const months = [today.slice(0, 7), addDays_(today.slice(0, 7) + '-01', -1).slice(0, 7)];
  const over = [];
  months.forEach(function (m) {
    repTrack_(m).forEach(function (x) {
      if (x.st === 'fill' && x.left === 0) x.names.forEach(function (n) { repNotify_(x, n, 'fill'); });
      if (x.st === 'insp' && x.left === 0 && x.insp) repNotify_(x, x.insp, 'insp');
      if (x.over) over.push(x);
    });
  });
  if (over.length) {
    over.sort(function (a, b) { return a.k < b.k ? -1 : 1; });
    const L = over.map(function (x) { return '• ' + thShortD_(x.k.slice(0, 10)) + ' ' + x.label + ' — ' + (x.st === 'fill' ? x.names.join(', ') : 'ผู้ตรวจ ' + (x.insp || '-')) + ' (เกิน ' + (-x.left) + ' วัน)'; });
    const u = webUrl_('viewReport', { kind: 'track', m: today.slice(0, 7) }), btn = u ? [{ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ดูทั้งหมดในแอป', uri: u } }] : null;
    const base = String(getConfig_().webUrl || ''), su = /^https:\/\//.test(base) ? base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + 'share-overdue.html' : '';   // เปิดในหน้าต่าง LINE เพื่อเลือกห้องที่จะส่งต่อ
    if (btn && su) btn.push({ type: 'button', style: 'primary', color: '#06C755', height: 'sm', margin: 'sm', action: { type: 'uri', label: 'แชร์ต่อทาง LINE', uri: su } });
    approverList_().forEach(function (a) { const id = lineIdOf_(a.short); if (id) push_(id, [flex_('รายงานเวรเกินกำหนด', bubble_('สรุปรายงานเวรเกินกำหนด', '#C92A2A', 'ค้าง ' + over.length + ' รายการ', L.slice(0, 15), btn))], 'change'); });
  }
  log_('system', 'เตือนรายงานเวร', today.slice(0, 7), 'เกินกำหนด ' + over.length);
}
function repNotify_(x, short, kind) {
  const ymd = x.k.slice(0, 10), link = kind === 'insp' ? repLink_(ymd, short, 'insp') : repLink_(x.k, short, 'duty');
  const body = kind === 'insp'
    ? ['คุณ' + short + ' ยังไม่ได้ตรวจเวร', thShortD_(ymd) + ' ' + x.label + ' (' + x.names.join(', ') + ')', x.over ? 'เกินกำหนดแล้ว ' + (-x.left) + ' วัน' : 'ครบกำหนดวันนี้ 23:59 น. — เกินกำหนดจะแจ้ง หผ.ปร.']
    : ['คุณ' + short + ' ยังไม่ได้ลงรายงานการอยู่เวร', thShortD_(ymd) + ' ' + x.label + (x.names.length > 1 ? ' (กับ ' + x.names.filter(function (n) { return n !== short; }).join(', ') + ')' : ''), x.over ? 'เกินกำหนดแล้ว ' + (-x.left) + ' วัน' : 'ส่งภายในวันนี้ 23:59 น. — เกินกำหนดจะแจ้ง หผ.ปร.'];
  const btn = link ? [{ type: 'button', style: 'primary', color: '#5B1A63', height: 'sm', action: { type: 'uri', label: kind === 'insp' ? 'ตรวจเวร' : 'ลงรายงานการอยู่เวร', uri: link } }] : null;
  notifyPeople_([short], kind === 'insp' ? 'เตือนตรวจเวร' : 'เตือนลงรายงานการอยู่เวร', body.join('\n'), x.over ? '#C92A2A' : '#E8590C', (x.over ? 'เกินกำหนด · ' : 'ครบกำหนดวันนี้ · ') + x.label + ' ' + thShortD_(ymd), btn);
}
/** ผู้อนุมัติจาก PIN หรือบัญชีศูนย์รวมงานที่ชื่อตรงกับชีต Approvers */
function approverOf_(b) {
  const w = approverByPin_(b.pin); if (w) return w;
  if (b.hubUser && b.hubPass && hubAllowed_(String(b.hubUser), String(b.hubPass))) {
    const nn = normN_(b.hubUser);
    return approverList_().filter(function (a) { return normN_(a.name) === nn || normN_(a.short) === nn; })[0] || null;
  }
  return null;
}
function repSetMeta_(k, patch) {
  const sh = repSheet_(), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
  for (let i = 0; i < v.length; i++) if (String(v[i][0]).replace(/^'/, '') === k) {
    let cur = {}; try { cur = JSON.parse(v[i][1] || '{}'); } catch (e) {}
    Object.keys(patch).forEach(function (f) { if (patch[f] === null) delete cur[f]; else cur[f] = patch[f]; });
    sh.getRange(i + 2, 2).setValue(JSON.stringify(cur)); return true;
  }
  return false;
}
/** พิมพ์แล้ว (ใครก็ได้ที่กดพิมพ์จากแอป) / รับเอกสารแล้ว (ผู้อนุมัติ) / เตือนซ้ำ (ผู้อนุมัติ) */
function repMark_(b) {
  const at = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const keys = (Array.isArray(b.keys) ? b.keys : [b.k]).map(String).filter(function (k) { return /^\d{4}-\d{2}-\d{2}\|p[13]$/.test(k); }).slice(0, 70);
  if (b.what === 'printed') { let n = 0; keys.forEach(function (k) { if (repSetMeta_(k, { printed: at })) n++; }); return { n: n }; }
  const who = approverOf_(b); if (!who) throw new Error('เฉพาะผู้อนุมัติ (ใส่ PIN หรือเข้าด้วยบัญชีศูนย์รวมงานของผู้อนุมัติ)');
  if (b.what === 'received' || b.what === 'unreceive') {
    let n = 0; keys.forEach(function (k) { if (repSetMeta_(k, { received: b.what === 'received' ? at + ' ' + (who.short || who.name) : null })) n++; });
    log_(who.short || who.name, b.what === 'received' ? 'รับเอกสารรายงานเวร' : 'ยกเลิกรับเอกสาร', keys[0] ? keys[0].slice(0, 7) : '', keys.join(','));
    return { n: n };
  }
  if (b.what === 'nudge') {
    let n = 0; keys.forEach(function (k) {
      const x = repTrack_(k.slice(0, 7)).filter(function (y) { return y.k === k; })[0]; if (!x) return;
      if (x.st === 'fill') x.names.forEach(function (s) { repNotify_(x, s, 'fill'); n++; });
      else if (x.st === 'insp' && x.insp) { repNotify_(x, x.insp, 'insp'); n++; }
    });
    log_(who.short || who.name, 'เตือนรายงานเวรซ้ำ', keys[0] ? keys[0].slice(0, 7) : '', keys.join(','));
    return { n: n };
  }
  throw new Error('คำสั่งไม่ถูกต้อง');
}
