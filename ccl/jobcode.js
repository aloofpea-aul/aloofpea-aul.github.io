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

  function rank(c) {
    var m = /^([A-Z])\s*(\d+)/.exec(String(c || '').trim().toUpperCase());
    return m ? (m[1].charCodeAt(0) - 64) * 100 + parseInt(m[2], 10) : -1;
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
        'ลำดับ: B2 → C1 → C3 → C4 → C5 → <b>D1</b> (ตรวจรับได้) → <b>D2</b> (ส่งปิดงานได้) → F4<br>ตัดงบ/ค่าใช้จ่ายได้ตั้งแต่ <b>C1</b></div></div>',
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
  function boot() {
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
  window.cclCode = { rank: rank, ok: ok, need: NEED, exp: EXP, warn: warn, codeOf: codeOf };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1500);
})();
