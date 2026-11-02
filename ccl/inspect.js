/* CCL — ตรวจรับงาน / วันส่งมอบ ให้บันทึกได้จริง
   แก้จากของเดิม:
   - หน้าต่างตรวจรับ: ช่อง "วันที่ส่งมอบงาน" เดิมไม่ถูกบันทึก → บันทึกแล้ว
   - ไม่ผ่านการตรวจรับ: "หมายเหตุ (บังคับ)" เดิมหายไป → บันทึกลงประวัติงาน + แจ้งผู้รับจ้างใน Portal
   - แผนที่ตรวจรับ: ปุ่ม "ตรวจรับงาน" และ "วันส่งมอบ" เดิมขึ้นว่าสำเร็จแต่ไม่ได้บันทึก → บันทึกจริงทีละหลายงาน
   ใช้คำสั่งหลังบ้านที่มีอยู่แล้ว (updateInspectionStatus, saveDeliveryDate, addPEAReply) */
(function () {
  'use strict';

  function jobs() { return (typeof allData !== 'undefined' && allData) ? allData : []; }
  function me() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : {}; }
  function find(id) { return jobs().find(function (j) { return String(j.id) === String(id); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function ymd(v) {
    if (!v) return '';
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      if (s.length > 10 && s.indexOf('T') === 10) { var d = new Date(s); if (!isNaN(d)) return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
      return s.slice(0, 10);
    }
    var x = new Date(s); return isNaN(x) ? '' : x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2);
  }
  function call(fn) {
    var args = Array.prototype.slice.call(arguments, 1);
    return new Promise(function (ok, bad) {
      var r = google.script.run.withSuccessHandler(function (x) { if (x && x.success === false) bad(new Error(x.error || 'ไม่สำเร็จ')); else ok(x); })
        .withFailureHandler(function (e) { bad(e instanceof Error ? e : new Error(String(e && e.message || e))); });
      r[fn].apply(r, args);
    });
  }
  function committee() {
    var m = (typeof _committeeCache !== 'undefined' && _committeeCache) ? _committeeCache : [];
    return m.map(function (x) { if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = { name: x }; } } return (x && x.name) || ''; }).filter(Boolean);
  }
  function busy(t) { Swal.fire({ title: t, allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } }); }

  var CSS = '<style>.ix-l{font-size:12px;color:#64748b;font-weight:700;margin:10px 0 4px;text-align:left}.ix-in{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;font-size:14px;box-sizing:border-box;background:#fff}' +
    '.ix-r{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ix-b{min-height:48px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;font-weight:700;font-size:14px;cursor:pointer;color:#475569}' +
    '.ix-b.ok{background:#16a34a;border-color:#16a34a;color:#fff}.ix-b.ng{background:#dc2626;border-color:#dc2626;color:#fff}' +
    '.ix-j{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;text-align:left}.ix-j div{flex:1;min-width:0;font-size:13px}.ix-j small{display:block;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ix-j input{width:150px;flex-shrink:0}' +
    '.ix-c{background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:8px 10px;text-align:left;font-size:13px;color:#115e59}.ix-list{max-height:40vh;overflow-y:auto}</style>';

  // ───── ตรวจรับ (1 งาน หรือหลายงาน) ─────
  function inspectMany(ids) {
    var list = ids.map(find).filter(Boolean);
    if (!list.length) return;
    var com = committee(), chair = com[0] || '-';
    var one = list.length === 1;
    var html = CSS +
      (one ? '<div style="text-align:left;font-size:14px"><b>' + esc(list[0].jobName || '-') + '</b><div style="color:#64748b;font-size:12px">' + esc(list[0].receiveNo || '-') + ' · <span style="font-family:monospace">' + esc(list[0].jobIds || '-') + '</span></div></div>'
        : '<div style="text-align:left;font-size:13px;color:#475569">ตรวจรับพร้อมกัน ' + list.length + ' งาน — ผลเดียวกันทุกงาน</div>') +
      '<div class="ix-l">วันที่ส่งมอบงาน' + (one ? '' : ' (แก้รายงานได้)') + '</div>' +
      '<div class="ix-list">' + list.map(function (j) {
        return one ? '<input type="date" class="ix-in" data-id="' + j.id + '" value="' + (ymd(j.payDate) || today()) + '">'
          : '<div class="ix-j"><div><b>' + esc(j.receiveNo || '-') + '</b><small>' + esc(j.jobName || '') + '</small></div><input type="date" class="ix-in" data-id="' + j.id + '" value="' + (ymd(j.payDate) || today()) + '"></div>';
      }).join('') + '</div>' +
      '<div class="ix-l">คณะกรรมการตรวจรับ</div><div class="ix-c">' + (com.length ? com.map(function (n, i) { return (i === 0 ? '<b>ประธาน: ' : 'กรรมการ: ') + esc(n) + (i === 0 ? '</b>' : ''); }).join('<br>') : 'ยังไม่มีกรรมการในระบบ (ตั้งได้ที่หน้า Admin)') + '</div>' +
      '<div class="ix-l">ผลการตรวจรับ</div><div class="ix-r"><button type="button" class="ix-b" data-v="ผ่านการตรวจรับ">✓ ผ่าน</button><button type="button" class="ix-b" data-v="ไม่ผ่านการตรวจรับ">✗ ไม่ผ่าน</button></div>' +
      '<div id="ixRem" style="display:none"><div class="ix-l" style="color:#b91c1c">สิ่งที่ต้องแก้ไข (บังคับ — ผู้รับจ้างจะเห็นใน Portal)</div><textarea class="ix-in" id="ixRemTxt" rows="3" placeholder="เช่น ยังไม่ติดตั้งสายล่อฟ้า ช่วงเสา 5-6"></textarea></div>';
    var result = '';
    Swal.fire({
      title: one ? 'ตรวจรับงาน' : 'ตรวจรับ ' + list.length + ' งาน', width: 560, html: html,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#0f766e',
      didOpen: function (pop) {
        pop.querySelectorAll('.ix-b').forEach(function (b) {
          b.addEventListener('click', function () {
            result = b.dataset.v;
            pop.querySelectorAll('.ix-b').forEach(function (x) { x.classList.remove('ok', 'ng'); });
            b.classList.add(result === 'ผ่านการตรวจรับ' ? 'ok' : 'ng');
            pop.querySelector('#ixRem').style.display = result === 'ไม่ผ่านการตรวจรับ' ? '' : 'none';
            if (result === 'ไม่ผ่านการตรวจรับ') pop.querySelector('#ixRemTxt').focus();
          });
        });
      },
      preConfirm: function () {
        var pop = Swal.getPopup();
        var dates = {}; var miss = false;
        pop.querySelectorAll('input[data-id]').forEach(function (i) { dates[i.dataset.id] = i.value; if (!i.value) miss = true; });
        var rem = (pop.querySelector('#ixRemTxt').value || '').trim();
        if (!result) { Swal.showValidationMessage('กรุณาเลือกผลการตรวจรับ'); return false; }
        if (miss) { Swal.showValidationMessage('กรุณาระบุวันที่ส่งมอบงาน'); return false; }
        if (result === 'ไม่ผ่านการตรวจรับ' && !rem) { Swal.showValidationMessage('กรุณาระบุสิ่งที่ต้องแก้ไข'); return false; }
        return { dates: dates, rem: rem };
      }
    }).then(function (r) {
      if (!r.isConfirmed) return;
      var v = r.value, done = 0, errs = [];
      busy('กำลังบันทึก… 0/' + list.length);
      list.reduce(function (p, j) {
        return p.then(function () {
          var d = v.dates[j.id], steps = Promise.resolve();
          if (d && d !== ymd(j.payDate)) steps = steps.then(function () { return call('saveDeliveryDate', j.id, d, me()); });
          steps = steps.then(function () { return call('updateInspectionStatus', j.id, result, me()); });
          if (result === 'ไม่ผ่านการตรวจรับ') steps = steps.then(function () {
            return call('addPEAReply', j.id, { message: 'ไม่ผ่านการตรวจรับ' + (com.length ? ' (ประธาน: ' + chair + ')' : '') + ' — ต้องแก้ไข: ' + v.rem, peaName: me().name || '', replyTo: j.responsibleEntity || '' });
          });
          return steps.then(function () { done++; }, function (e) { errs.push((j.receiveNo || j.id) + ': ' + e.message); })
            .then(function () { var t = Swal.getTitle(); if (t) t.textContent = 'กำลังบันทึก… ' + (done + errs.length) + '/' + list.length; });
        });
      }, Promise.resolve()).then(function () {
        var pass = result === 'ผ่านการตรวจรับ';
        Swal.fire({
          icon: errs.length ? 'error' : pass ? 'success' : 'warning',
          title: errs.length ? 'บันทึกได้ ' + done + '/' + list.length + ' งาน' : (pass ? 'ผ่านการตรวจรับ' : 'ไม่ผ่านการตรวจรับ') + (one ? '' : ' ' + done + ' งาน'),
          html: (errs.length ? '<div style="text-align:left;color:#b91c1c;font-size:13px">' + errs.map(esc).join('<br>') + '</div>' : '') +
            (com.length ? '<p style="font-size:13px;color:#0f766e">ประธาน: ' + esc(chair) + '</p>' : '') +
            (pass ? '<p style="font-size:13px;color:#64748b">ขั้นต่อไป: กด <b>ตรวจมาตรฐาน</b></p>' : '<p style="font-size:13px;color:#64748b">บันทึกสิ่งที่ต้องแก้ไขไว้ในประวัติงาน และแจ้งผู้รับจ้างใน Portal แล้ว</p>'),
          confirmButtonText: 'ตกลง'
        }).then(function () { if (typeof loadData === 'function') loadData(); });
      });
    });
  }

  // ───── วันส่งมอบ (หลายงาน) ─────
  function deliveryMany(ids) {
    var list = ids.map(find).filter(Boolean);
    if (!list.length) return;
    var html = CSS + '<div class="ix-l">ใช้วันเดียวกันทุกงาน</div><div style="display:flex;gap:8px"><input type="date" class="ix-in" id="ixAll" value="' + today() + '"><button type="button" class="ix-b" id="ixApply" style="min-height:40px;padding:0 14px;white-space:nowrap">ใช้กับทุกงาน</button></div>' +
      '<div class="ix-l">วันที่ส่งมอบรายงาน</div><div class="ix-list">' + list.map(function (j) {
        return '<div class="ix-j"><div><b>' + esc(j.receiveNo || '-') + '</b><small>' + esc(j.jobName || '') + '</small></div><input type="date" class="ix-in" data-id="' + j.id + '" value="' + (ymd(j.payDate) || '') + '"></div>';
      }).join('') + '</div>';
    Swal.fire({
      title: 'บันทึกวันส่งมอบ ' + list.length + ' งาน', width: 560, html: html,
      showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#d97706',
      didOpen: function (pop) {
        pop.querySelector('#ixApply').addEventListener('click', function () {
          var v = pop.querySelector('#ixAll').value; pop.querySelectorAll('input[data-id]').forEach(function (i) { i.value = v; });
        });
      },
      preConfirm: function () {
        var ch = [];
        Swal.getPopup().querySelectorAll('input[data-id]').forEach(function (i) { var j = find(i.dataset.id); if (i.value && j && i.value !== ymd(j.payDate)) ch.push({ j: j, d: i.value }); });
        if (!ch.length) { Swal.showValidationMessage('ยังไม่มีวันที่เปลี่ยน'); return false; }
        return ch;
      }
    }).then(function (r) {
      if (!r.isConfirmed) return;
      var errs = [], done = 0;
      busy('กำลังบันทึก…');
      r.value.reduce(function (p, x) {
        return p.then(function () { return call('saveDeliveryDate', x.j.id, x.d, me()).then(function () { done++; }, function (e) { errs.push((x.j.receiveNo || '') + ': ' + e.message); }); });
      }, Promise.resolve()).then(function () {
        Swal.fire({ icon: errs.length ? 'error' : 'success', title: 'บันทึกวันส่งมอบ ' + done + ' งาน', html: errs.map(esc).join('<br>'), confirmButtonText: 'ตกลง' })
          .then(function () { if (typeof loadData === 'function') loadData(); });
      });
    });
  }

  window.inspectJob = function (jobId) { inspectMany([jobId]); };
  window.cclInspect = { inspectMany: inspectMany, deliveryMany: deliveryMany };

  function hookMap() {
    var o = window.imapDoAction; if (typeof o !== 'function' || o.__ix) return;
    var w = function (type) {
      if (type !== 'inspect' && type !== 'delivery') return o.apply(this, arguments);
      var arr = (typeof _imapGetOrdered === 'function') ? _imapGetOrdered() : [];
      if (!arr.length) return;
      var ids = arr.map(function (j) { return j.id; });
      if (type === 'delivery') return deliveryMany(ids);
      // ตรวจรับได้เฉพาะงานที่อยู่ในขั้น "ตรวจรับงาน" (เหมือนหน้าตรวจรับงาน)
      var ok = ids.filter(function (id) { var j = find(id); return j && j.status === 'ตรวจรับงาน'; });
      if (!ok.length) { Swal.fire({ icon: 'info', title: 'ยังตรวจรับไม่ได้', text: 'งานที่เลือกยังไม่อยู่ในขั้น "ตรวจรับงาน"' }); return; }
      if (ok.length < ids.length) {
        return Swal.fire({ icon: 'info', title: 'ตรวจรับได้ ' + ok.length + ' จาก ' + ids.length + ' งาน', text: 'งานที่เหลือยังไม่อยู่ในขั้น "ตรวจรับงาน" จะข้ามไป', showCancelButton: true, confirmButtonText: 'ทำต่อ', cancelButtonText: 'ยกเลิก' })
          .then(function (r) { if (r.isConfirmed) inspectMany(ok); });
      }
      return inspectMany(ok);
    };
    w.__ix = true; window.imapDoAction = w;
  }
  hookMap(); document.addEventListener('DOMContentLoaded', function () { setTimeout(hookMap, 0); });
})();
