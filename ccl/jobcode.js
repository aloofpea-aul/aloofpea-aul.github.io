/* jobcode.js — เงื่อนไขสถานะงาน (Job Code) ก่อนเปลี่ยนขั้นตอน
   - ตรวจรับงาน  ต้องเป็น D1 ขึ้นไป
   - ส่งปิดงาน   ต้องเป็น D2 ขึ้นไป
   - ตัดงบ/แก้รายการค่าใช้จ่าย ต้องเป็น C1 ขึ้นไป
   หลังบ้าน (Api.gs) ตรวจซ้ำอีกชั้น — ไฟล์นี้ช่วยเตือนก่อนส่ง และพาไปแก้สถานะงาน */
(function () {
  'use strict';
  var NEED = { 'ตรวจรับงาน': 'D1', 'ส่งปิดงาน': 'D2' };
  var EXP = 'C1';
  var pending = {}; // id -> jobStatus ที่เพิ่งบันทึกจากฟอร์มแก้ไข (ก่อนโหลดข้อมูลใหม่)

  // ===== ความหมายรหัสสถานะผู้ใช้ (User Status) ของ SAP — ตามตาราง "สถานะงานในหมายเลขงาน" ของ กฟภ. =====
  // st = ขั้นบนแถบ (0–7) · sys = สถานะระบบ · k: stop=หยุดงาน, rev=ถอยสถานะ, cancel=ยกเลิกงาน
  var CODE = {
    A0: { st: 0, sys: 'CRTD', t: 'สร้างหมายเลขงาน WBS' },
    A1: { st: 0, sys: 'CRTD', t: 'ตรวจสอบข้อมูลทางบัญชี' },
    A2: { st: 0, sys: 'CRTD', t: 'สำรวจ ออกแบบ ประมาณการ' },
    A5: { st: 0, sys: 'CRTD', t: 'อนุมัติประมาณการ / แจ้งค่าใช้จ่ายแล้ว' },
    B1: { st: 1, sys: 'CRTD/REL', t: 'จัดงานเข้าโครงการ / ชำระเงินแล้ว' },
    B2: { st: 1, sys: 'CRTD/REL', t: 'บันทึกโอนงบประมาณเข้า WBS' },
    C1: { st: 2, sys: 'REL', t: 'อยู่ระหว่างการก่อสร้าง' },
    C2: { st: 2, sys: 'REL', t: 'อยู่ระหว่างจัดซื้อ จัดจ้าง' },
    C3: { st: 2, sys: 'REL', t: 'หยุดงาน รอจัดหาพัสดุ', k: 'stop' },
    C4: { st: 2, sys: 'REL', t: 'หยุดงานชั่วคราว – สาเหตุ กฟภ.', k: 'stop' },
    C5: { st: 2, sys: 'REL', t: 'หยุดงานชั่วคราว – สาเหตุผู้ใช้ไฟ', k: 'stop' },
    C6: { st: 2, sys: 'REL', t: 'หยุดงานชั่วคราว – บ้านจัดสรร', k: 'stop' },
    C9: { st: 2, sys: 'REL', t: 'ยกเลิกสถานะ TECO (ปรับปรุงบัญชีพัสดุ)', k: 'rev' },
    D1: { st: 3, sys: 'REL', t: 'แล้วเสร็จ – ตรวจสอบพัสดุ/ค่าใช้จ่าย' },
    F3: { st: 3, sys: 'REL', t: 'ปิดงานทางบัญชีบางส่วน (ระดับ NWT)' },
    D2: { st: 4, sys: 'TECO', t: 'แล้วเสร็จทางเทคนิค (TECO)' },
    D9: { st: 4, sys: 'TECO', t: 'ยกเลิกสถานะ CLSD (ปรับปรุงค่าใช้จ่าย)', k: 'rev' },
    D3: { st: 5, sys: 'TECO', t: 'บัญชีรับเอกสารปิดงานครบแล้ว' },
    E1: { st: 5, sys: 'TECO', t: 'ตรวจค่าใช้จ่ายแล้ว · แจ้งโอนคืนงบ' },
    F1: { st: 5, sys: 'TECO', t: 'โอนคืนงบประมาณเรียบร้อยแล้ว' },
    F9: { st: 5, sys: 'TECO', t: 'ยกเลิกสถานะ CLSD', k: 'rev' },
    F2: { st: 6, sys: 'CLSD', t: 'ปิดงานทางบัญชีระดับ WBS' },
    F4: { st: 7, sys: 'CLSD', t: 'ขึ้นสินทรัพย์ถาวรแล้ว' },
    E2: { st: -1, sys: 'CLSD', t: 'ยกเลิกหมายเลขงาน', k: 'cancel' }
  };
  // ลำดับความคืบหน้า (ใช้ตัดสินเงื่อนไข) — ยกเลิกงาน/รหัสที่ไม่รู้จัก = ต่ำสุด
  var ORD = { A0: 10, A1: 11, A2: 12, A5: 13, B1: 20, B2: 21, C1: 30, C2: 30, C3: 31, C4: 31, C5: 31, C6: 31, C9: 32, D1: 40, F3: 41, D2: 50, D9: 50, D3: 51, E1: 52, F1: 53, F9: 53, F2: 60, F4: 70, E2: -1 };
  var STEPS = [['A', 'สร้าง/สำรวจ'], ['B', 'รับงบ'], ['C', 'ก่อสร้าง'], ['D1', 'แล้วเสร็จ'], ['D2', 'TECO'], ['D3–F1', 'ตรวจบัญชี'], ['F2', 'ปิดบัญชี'], ['F4', 'สินทรัพย์']];
  var STC = ['#64748b', '#64748b', '#2563eb', '#2563eb', '#7c3aed', '#7c3aed', '#16a34a', '#16a34a'];
  function rank(c) {
    c = String(c || '').trim().toUpperCase();
    if (ORD[c] != null) return ORD[c];
    var m = /^([A-Z])\s*(\d+)/.exec(c);
    if (!m) return -1;
    var base = { A: 10, B: 20, C: 30, D: 40, E: 50, F: 60 }[m[1]];
    return base == null ? -1 : base + Math.min(9, parseInt(m[2], 10));
  }
  function info(code) {
    var c = String(code || '').trim().toUpperCase(), d = CODE[c];
    if (!c) return { c: '', t: 'ยังไม่ระบุสถานะงาน', st: -1, col: '#94a3b8', bg: '#f1f5f9', k: 'none' };
    if (!d) return { c: c, t: 'รหัสนี้ไม่อยู่ในตาราง SAP', st: -1, col: '#94a3b8', bg: '#f1f5f9', k: 'unknown' };
    var col = d.k === 'cancel' ? '#dc2626' : d.k === 'stop' ? '#ea580c' : d.k === 'rev' ? '#d97706' : STC[d.st];
    var bg = d.k === 'cancel' ? '#fef2f2' : d.k === 'stop' ? '#fff7ed' : d.k === 'rev' ? '#fffbeb' : ['#f1f5f9', '#f1f5f9', '#eff6ff', '#eff6ff', '#f5f3ff', '#f5f3ff', '#f0fdf4', '#f0fdf4'][d.st];
    return { c: c, t: d.t, st: d.st, sys: d.sys, k: d.k || '', col: col, bg: bg };
  }
  function nextOf(i) {
    if (i.k === 'cancel') return ['⛔ SAP ยกเลิกหมายเลขงานแล้ว', '#b91c1c', '#fef2f2'];
    if (i.k === 'stop') return ['⏸ หยุดงานอยู่', '#c2410c', '#fff7ed'];
    if (i.k === 'rev') return ['↩ กำลังแก้ไขใน SAP', '#b45309', '#fffbeb'];
    if (i.st < 0) return ['🔒 ยังตัดงบไม่ได้', '#b91c1c', '#fef2f2'];
    if (i.st < 2) return ['ถัดไป C1 → ตัดงบได้', '#6d28d9', '#f5f3ff'];
    if (i.st === 2) return ['ถัดไป D1 → ส่งตรวจรับได้', '#6d28d9', '#f5f3ff'];
    if (i.st === 3) return ['ถัดไป D2 → ส่งปิดงานได้', '#6d28d9', '#f5f3ff'];
    if (i.st === 7) return ['✓ ครบทุกขั้น', '#15803d', '#f0fdf4'];
    return ['✓ ส่งปิดงานได้', '#15803d', '#f0fdf4'];
  }
  function e(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function css() {
    if (document.getElementById('jcxCss')) return;
    var st = document.createElement('style'); st.id = 'jcxCss';
    st.textContent = '.jcx{grid-column:1/-1;margin-top:9px;border:1px solid #e2e8f0;border-radius:12px;padding:8px 10px;background:#fbfcfe}' +
      '.jcx .tp{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.jcx .cd{font-weight:800;font-size:16px;border-radius:8px;padding:0 8px;color:#fff;line-height:26px;min-width:34px;text-align:center}' +
      '.jcx .mn{font-weight:700;font-size:13.5px;color:#1e293b;line-height:1.3}.jcx .sb2{display:block;font-size:11.5px;color:#64748b;font-weight:500}' +
      '.jcx .nx{margin-left:auto;font-size:12px;font-weight:700;border-radius:8px;padding:3px 9px;white-space:nowrap}' +
      '.jcx .br{display:flex;gap:3px;margin-top:7px}.jcx .br i{flex:1;height:6px;border-radius:4px;background:#e2e8f0}.jcx .br i.ok{background:var(--c)}.jcx .br i.now{background:var(--c);box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--c)}' +
      '.jcx .tk{display:flex;gap:3px;margin-top:3px}.jcx .tk span{flex:1;text-align:center;font-size:10px;color:#94a3b8;font-weight:600;white-space:nowrap;overflow:hidden}.jcx .tk span.g{color:#7c3aed}.jcx .tk span.on{color:var(--c);font-weight:800}' +
      '.jcm{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:1px 8px 1px 2px;font-size:12px;font-weight:700;white-space:nowrap;max-width:100%;overflow:hidden}' +
      '.jcm b{color:#fff;border-radius:999px;padding:0 6px;font-size:11.5px;line-height:18px}.jcm .t{overflow:hidden;text-overflow:ellipsis}' +
      '.jcm .ds{display:inline-flex;gap:2px;flex-shrink:0}.jcm .ds i{width:6px;height:6px;border-radius:2px;background:#e2e8f0}.jcm .ds i.ok{background:currentColor}' +
      'body:not(.cx) .pc .pc-js{display:none !important}body.cx .jcx{display:none !important}body.cx .jcm{flex-shrink:0 !important;max-width:none !important;order:-1}body.cx .jcm .t{max-width:150px}' +
      '@media(max-width:640px){.jcx .nx{margin-left:0}.jcx .tk span{font-size:9px}}';
    document.head.appendChild(st);
  }
  // กล่องเต็ม (การ์ดปกติ / popup)
  function block(code, opt) {
    css(); var i = info(code), n = nextOf(i);
    var bar = i.k === 'cancel' ? '' : '<div class="br">' + STEPS.map(function (s, k) { return '<i class="' + (k < i.st ? 'ok' : k === i.st ? 'now' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="tk">' + STEPS.map(function (s, k) { return '<span class="' + (k === i.st ? 'on' : (s[0] === 'D1' || s[0] === 'D2') ? 'g' : '') + '" title="' + e(s[1]) + '">' + (opt && opt.long ? e(s[0] + ' ' + s[1]) : e(s[0])) + '</span>'; }).join('') + '</div>';
    return '<div class="jcx" style="--c:' + i.col + '"><div class="tp"><span class="cd" style="background:' + i.col + '">' + e(i.c || '–') + '</span>' +
      '<span><span class="mn">' + e(i.t) + '</span><span class="sb2">สถานะงาน SAP' + (i.sys ? ' · ' + e(i.sys) : '') + (i.st >= 0 && !i.k ? ' · ขั้น ' + (i.st + 1) + ' จาก 8' : '') + '</span></span>' +
      '<span class="nx" style="color:' + n[1] + ';background:' + n[2] + '">' + e(n[0]) + '</span></div>' + bar + '</div>';
  }
  // ป้ายเล็ก 1 บรรทัด (แบบกระชับ)
  function pill(code, cls) {
    css(); var i = info(code);
    return '<span class="jcm ' + (cls || '') + '" style="background:' + i.bg + ';color:' + i.col + '" title="สถานะงาน SAP: ' + e((i.c ? i.c + ' · ' : '') + i.t) + '"><b style="background:' + i.col + '">' + e(i.c || '–') + '</b><span class="t">' + e(i.t) + '</span>' +
      (i.k === 'cancel' ? '' : '<span class="ds">' + STEPS.map(function (s, k) { return '<i class="' + (k <= i.st ? 'ok' : '') + '"></i>'; }).join('') + '</span>') + '</span>';
  }
  function ok(code, min) { return rank(code) >= rank(min); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  function job(id) { return (g('allData', []) || []).find(function (j) { return String(j.id) === String(id); }) || null; }
  function codeOf(id) { if (pending[id] != null) return pending[id]; var j = job(id); return j ? j.jobStatus || '' : ''; }
  function what(min) { return min === EXP ? 'ตัดงบ / แก้ไขค่าใช้จ่าย' : min === 'D2' ? 'ส่งปิดงาน' : 'ตรวจรับงาน'; }
  function msg(id, min) {
    var c = codeOf(id);
    return 'สถานะงาน (Job Code) ' + (c ? 'ยังเป็น ' + c : 'ยังไม่ได้ระบุ') + ' — ต้องเปลี่ยนเป็น ' + min + ' ขึ้นไปก่อน จึงจะ' + what(min) + 'ได้';
  }
  function warn(id, min) {
    var c = codeOf(id), j = job(id) || {};
    var S = window.Swal; if (!S) { alert(msg(id, min)); return; }
    S.fire({
      icon: 'warning', title: 'ยัง' + what(min) + 'ไม่ได้',
      html: '<div style="text-align:left;font-size:14px;line-height:1.7">' +
        '<div style="font-weight:700;margin-bottom:6px">' + String(j.receiveNo || '') + ' ' + String(j.jobName || '').replace(/</g, '&lt;') + '</div>' +
        'สถานะงานตอนนี้: <b style="background:#fef9c3;color:#854d0e;padding:1px 8px;border-radius:6px">' + (c || 'ไม่ระบุ') + '</b><br>' +
        'ต้องเป็น: <b style="background:#dcfce7;color:#166534;padding:1px 8px;border-radius:6px">' + min + ' ขึ้นไป</b>' +
        '<div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border-radius:8px;font-size:12.5px;color:#475569">' +
        'ลำดับ SAP: A (สร้าง/สำรวจ) → B (รับงบ) → <b>C1</b> ก่อสร้าง (ตัดงบได้) → <b>D1</b> แล้วเสร็จ (ตรวจรับได้) → <b>D2</b> TECO (ส่งปิดงานได้) → F2/F4 ปิดงาน' +
        (c ? '<br>ตอนนี้: <b>' + e(c) + '</b> · ' + e(info(c).t) : '') + '</div></div>',
      showCancelButton: typeof window.openEditModal === 'function', confirmButtonText: typeof window.openEditModal === 'function' ? 'เปลี่ยนสถานะงาน' : 'ตกลง',
      cancelButtonText: 'ปิด', confirmButtonColor: '#7c3aed'
    }).then(function (r) { if (r.isConfirmed && typeof window.openEditModal === 'function') window.openEditModal(job(id) ? job(id).id : id); });
  }
  // คืนข้อความถ้าไม่ผ่าน
  function check(fn, a) {
    var id, min;
    if (fn === 'updateWorkStatus') { id = a[0]; min = NEED[String(a[1] || '')]; }
    else if (fn === 'addExpense') { id = a[0] && a[0].jobId; min = EXP; }
    else if (fn === 'updateExpense') { id = a[0]; min = EXP; }
    if (!min || id == null || !job(id)) return null;
    if (fn === 'updateWorkStatus' && a[1] === 'ตรวจรับงาน' && ['ส่งปิดงาน', 'ปิดงานแล้วเสร็จ', 'อนุมัติ/เสร็จสิ้น'].indexOf(job(id).status) >= 0) return null;
    return ok(codeOf(id), min) ? null : { id: id, min: min, text: msg(id, min) };
  }

  // ครอบ google.script.run — ตรวจก่อนส่งไปหลังบ้าน
  var G = window.google && window.google.script && window.google.script.run;
  if (G) {
    var chain = function () {
      var s = null, f = null, u, has = false;
      var px = new Proxy({}, { get: function (_, p) {
        if (p === 'withSuccessHandler') return function (h) { s = h; return px; };
        if (p === 'withFailureHandler') return function (h) { f = h; return px; };
        if (p === 'withUserObject') return function (o) { u = o; has = true; return px; };
        return function () {
          var a = Array.prototype.slice.call(arguments), fn = String(p);
          if (fn === 'editConstructionData' && a[0]) { var o = a[0], k = o.editRowId != null ? parseInt(o.editRowId, 10) : o.rowId != null ? o.rowId : o.id; if (k != null && o.jobStatus != null) pending[k] = o.jobStatus; }
          var bad = check(fn, a);
          if (bad) { var e = new Error(bad.text); if (f) setTimeout(function () { f(e, u); }, 0); else warn(bad.id, bad.min); return; }
          var c = G; if (s) c = c.withSuccessHandler(s); if (f) c = c.withFailureHandler(f); if (has) c = c.withUserObject(u);
          return c[fn].apply(c, a);
        };
      } });
      return px;
    };
    window.google.script.run = new Proxy({}, { get: function (_, p) { return chain()[p]; } });
  }

  // ล้างค่าชั่วคราวเมื่อโหลดข้อมูลใหม่
  var lastData = null;
  setInterval(function () { var d = g('allData', null); if (d && d !== lastData) { lastData = d; pending = {}; } }, 1500);

  function wrap(name, pre) {
    var o = window[name]; if (typeof o !== 'function' || o.__jc) return;
    var w = function () { if (pre.apply(this, arguments) === false) return; return o.apply(this, arguments); };
    w.__jc = 1; window[name] = w;
  }
  // รหัสสถานะงานทั้งหมดที่พบใน SAP — เติมลงช่องเลือกในฟอร์มแก้ไข
  var ALL = Object.keys(CODE);
  function fillSel(sel, extra) {
    if (!sel) return;
    var have = {}; Array.prototype.forEach.call(sel.options, function (o) { have[o.value] = 1; });
    var list = ALL.slice(); if (extra && list.indexOf(extra) < 0) list.push(extra);
    list.sort(function (a, b) { return rank(a) - rank(b); });
    list.forEach(function (c) {
      if (have[c]) return;
      var o = document.createElement('option'); o.value = c; o.textContent = c;
      var nx = Array.prototype.find.call(sel.options, function (x) { return x.value && rank(x.value) > rank(c); });
      sel.insertBefore(o, nx || null); have[c] = 1;
    });
    Array.prototype.forEach.call(sel.options, function (o) { if (o.value && CODE[o.value]) o.textContent = o.value + ' · ' + CODE[o.value].t; });
  }
  function boot() {
    fillSel(document.getElementById('editJobStatus'));
    wrap('openEditModal', function (id) { var j = job(id); fillSel(document.getElementById('editJobStatus'), j && String(j.jobStatus || '').trim().toUpperCase()); });
    wrap('sendToCloseFromInspection', function (id) { if (!ok(codeOf(id), 'D2')) { warn(id, 'D2'); return false; } });
    wrap('openCutBudgetFromTable', function (id) { if (job(id) && !ok(codeOf(id), EXP)) { warn(id, EXP); return false; } });
    wrap('openCutBudget', function () { var id = g('currentBudgetJobId', null); if (id != null && job(id) && !ok(codeOf(id), EXP)) { warn(id, EXP); return false; } });
    wrap('submitEditForm', function (e) {
      var ws = (document.getElementById('editWorkflowStatus') || {}).value || '', js = (document.getElementById('editJobStatus') || {}).value || '';
      var min = NEED[ws]; var id = (document.getElementById('editRowId') || {}).value || null;
      var j = id != null ? job(id) : null;
      if (min && (!j || j.status !== ws) && !ok(js, min)) {
        if (e && e.preventDefault) e.preventDefault();
        var S = window.Swal;
        if (S) S.fire({ icon: 'warning', title: 'ยังเปลี่ยนเป็น "' + ws + '" ไม่ได้', html: 'สถานะงาน (Job Code) ต้องเป็น <b>' + min + '</b> ขึ้นไป<br>ตอนนี้เลือกไว้: <b>' + (js || 'ไม่ระบุ') + '</b><br><small style="color:#64748b">เลือกช่อง "สถานะงาน (Job Code)" ให้ถึง ' + min + ' แล้วบันทึกอีกครั้ง</small>', confirmButtonText: 'ตกลง' });
        var el = document.getElementById('editJobStatus'); if (el) { el.style.outline = '3px solid #f59e0b'; setTimeout(function () { el.style.outline = ''; }, 3000); }
        return false;
      }
    });
  }
  window.cclCode = { rank: rank, ok: ok, need: NEED, exp: EXP, warn: warn, codeOf: codeOf, info: info, block: block, pill: pill, steps: STEPS };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1500);
})();
