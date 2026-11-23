/* Contractor Portal — อัปเดตจบในหน้าเดียว (ส่วนที่ 3)
   - บอก "ครั้งก่อน X% · วันที่" · ถ่าย/เลือกรูปได้ทีละหลายรูป (วางไว้ก่อนช่องข้อความ)
   - ข้อความสำเร็จรูปให้แตะ · แจ้งว่าแนบพิกัดอัตโนมัติ · ปุ่มส่งบอก % และจำนวนรูป
   - ไม่กรอกข้อความก็ส่งได้ (ระบบเติมให้จาก % / วันที่ส่งมอบ / ประเภทปัญหา)
   - อัปเดตถึง 100% → ถามต่อว่า "แจ้งส่งมอบเลยไหม?"
   ใช้ฟอร์มและการส่งข้อมูลเดิมทั้งหมด (submitUpdate / sendUpdate) */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TYPE = null, ASK100 = false;
  var PHR = {
    progress: ['เริ่มงาน', 'ขุดหลุม/ปักเสาแล้ว', 'พาดสายแล้ว', 'ติดตั้งหม้อแปลงแล้ว', 'ติดตั้งมิเตอร์แล้ว', 'รอวัสดุ', 'ฝนตก หยุดงาน'],
    delivery: ['งานเสร็จเรียบร้อย พร้อมให้ตรวจรับ', 'เก็บความเรียบร้อยหน้างานแล้ว', 'แนบรูปถ่ายหลังเสร็จงานแล้ว'],
    problem: ['วัสดุยังไม่ได้รับ', 'ฝนตกต่อเนื่อง ทำงานไม่ได้', 'เจ้าของที่ดินยังไม่อนุญาต', 'ขอขยายเวลา 7 วัน', 'ขอขยายเวลา 15 วัน'],
    note: ['ส่งรูปเพิ่มเติมตามที่ขอ', 'รับทราบครับ', 'แก้ไขตามที่แจ้งแล้ว', 'นัดตรวจหน้างานได้']
  };
  var css =
    '.ux-sub{font-size:12.5px;color:#64748B;margin:-14px 0 12px}' +
    '.ux-cam{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px}.ux-cam button{width:76px;height:76px;border-radius:14px;border:2px dashed #5EEAD4;background:#F0FDFA;color:#0F766E;font:800 12px inherit;font-family:inherit;cursor:pointer;line-height:1.25}' +
    '.ux-cam button i{display:block;font-style:normal;font-size:22px}' +
    '.ux-lbl{font-size:13px;font-weight:700;color:#475569;margin:0 0 6px}' +
    '.ux-qp{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.ux-qp button{border:1.5px solid #E2E8F0;background:#fff;border-radius:99px;padding:4px 11px;font:600 12.5px inherit;font-family:inherit;color:#475569;cursor:pointer}' +
    '.ux-qp button.on{background:#0F172A;border-color:#0F172A;color:#fff}' +
    '.ux-gps{font-size:12.5px;color:#059669;font-weight:700;margin:-4px 0 12px}' +
    '.ux-hint{font-size:12.5px;background:#FEF9C3;color:#854D0E;border-radius:10px;padding:7px 10px;margin-bottom:10px;font-weight:600;display:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function lastProg() {
    var j = window._curJob; if (!j) return null;
    var u = Array.isArray(j.updates) ? j.updates : [], best = null;
    u.forEach(function (x) { if (x && x.progress && (!best || new Date(x.timestamp) >= new Date(best.timestamp))) best = x; });
    return best;
  }
  function photosCount() { var n = 0; Array.prototype.forEach.call(document.querySelectorAll('#attachList input[type=file]'), function (i) { if (i.files && i.files.length) n++; }); return n; }
  function sendBtn() { return document.querySelector('#sheetBody button[onclick^="submitUpdate"]'); }
  function label() {
    var b = sendBtn(); if (!b) return;
    var p = $('su_progress') ? $('su_progress').value : '', n = photosCount();
    var t = TYPE === 'progress' ? 'ส่งอัปเดต' + (p ? ' ' + p + '%' : '') : TYPE === 'delivery' ? 'แจ้งส่งมอบงาน' : TYPE === 'problem' ? 'ส่งแจ้งปัญหา' : 'ส่งข้อความ';
    b.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i>' + t + (n ? ' · ' + n + ' รูป' : '');
    var h = $('uxHint'); if (h) h.style.display = (TYPE === 'progress' && p === '100') ? 'block' : 'none';
  }

  function enhance(type) {
    TYPE = type; ASK100 = false;
    var body = $('sheetBody'), title = $('sheetTitle'); if (!body || !title) return;
    // ครั้งก่อน
    var old = $('uxSub'); if (old) old.remove();
    var lp = lastProg(), j = window._curJob;
    var sub = document.createElement('div'); sub.id = 'uxSub'; sub.className = 'ux-sub';
    sub.textContent = (j ? (j.receiveNo || '') + ' · ' : '') + (lp ? 'ครั้งก่อน ' + lp.progress + '% · ' + new Date(lp.timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'ยังไม่เคยอัปเดตความคืบหน้า');
    title.parentNode.insertAdjacentElement('afterend', sub);

    var list = $('attachList'), note = $('su_note');
    // ส่วนรูป: ย้ายขึ้นก่อนช่องข้อความ + ปุ่มใหญ่ ถ่าย/เลือกรูปได้หลายรูป
    if (list) {
      var aBox = list.parentNode;
      var addBtn = aBox.querySelector('button[onclick^="addAttachRow"]'); if (addBtn) addBtn.style.display = 'none';
      var lb = aBox.querySelector('label'); if (lb) lb.style.display = 'none';
      var cam = document.createElement('div'); cam.innerHTML = '<p class="ux-lbl">📷 รูปหน้างาน / ไฟล์ <span style="font-weight:500;color:#94A3B8">(ได้หลายรูป)</span></p><div class="ux-cam"><button type="button" id="uxCam"><i>📷</i>ถ่าย/เลือก<br>รูป</button><button type="button" id="uxFile" style="border-color:#CBD5E1;background:#F8FAFC;color:#475569"><i>📄</i>แนบ<br>ไฟล์ PDF</button></div>' +
        '<input type="file" id="uxPick" accept="image/*" multiple style="display:none"><input type="file" id="uxPickF" accept="image/*,application/pdf" multiple style="display:none">';
      aBox.insertBefore(cam, list);
      var nb = note && note.closest('#sheetBody > *'); if (nb && nb !== aBox) body.insertBefore(aBox, nb); // รูปมาก่อนช่องข้อความ
      function pick(inp) {
        Array.prototype.forEach.call(inp.files, function (f) {
          try {
            addAttachRow();
            var row = list.lastElementChild, fi = row && row.querySelector('input[type=file]'); if (!fi) return;
            var dt = new DataTransfer(); dt.items.add(f); fi.files = dt.files;
            previewAttach(row.id, fi);
          } catch (e) { console.error('[ct-update]', e); }
        });
        inp.value = ''; setTimeout(label, 50);
      }
      $('uxCam').onclick = function () { $('uxPick').click(); };
      $('uxFile').onclick = function () { $('uxPickF').click(); };
      $('uxPick').onchange = function () { pick(this); };
      $('uxPickF').onchange = function () { pick(this); };
      list.addEventListener('click', function () { setTimeout(label, 50); });
      list.addEventListener('change', function () { setTimeout(label, 50); });
    }
    // ข้อความสำเร็จรูป
    if (note && PHR[type]) {
      note.placeholder = type === 'progress' ? 'รายละเอียด (ไม่ใส่ก็ได้)' : type === 'delivery' ? 'หมายเหตุการส่งมอบ (ไม่ใส่ก็ได้)' : note.placeholder;
      var qp = document.createElement('div'); qp.className = 'ux-qp';
      qp.innerHTML = PHR[type].map(function (x) { return '<button type="button">' + esc(x) + '</button>'; }).join('');
      note.parentNode.insertBefore(qp, note);
      qp.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var v = note.value.trim(), t = b.textContent;
        if (v.indexOf(t) >= 0) { note.value = v.replace(t, '').replace(/\s{2,}/g, ' ').replace(/^ | $/g, ''); b.classList.remove('on'); }
        else { note.value = v ? v + ' ' + t : t; b.classList.add('on'); }
      });
    }
    // พิกัด + คำแนะนำ 100%
    var sb = sendBtn();
    if (sb) {
      var g = document.createElement('div'); g.className = 'ux-gps'; g.textContent = '📍 แนบพิกัดตอนส่งให้อัตโนมัติ (ถ้าเครื่องอนุญาต)';
      var h = document.createElement('div'); h.className = 'ux-hint'; h.id = 'uxHint'; h.textContent = '💡 ถึง 100% แล้ว — ส่งเสร็จระบบจะถามต่อว่า "แจ้งส่งมอบเลยไหม?"';
      sb.parentNode.insertBefore(g, sb); sb.parentNode.insertBefore(h, sb);
    }
    var pr = $('su_progress');
    if (pr) { pr.addEventListener('change', label); body.addEventListener('click', function (e) { if (e.target.closest('.ct-prog')) setTimeout(label, 30); }); }
    label();
  }

  // ไม่กรอกข้อความก็ส่งได้ + จำไว้ว่าถึง 100% เพื่อถามแจ้งส่งมอบ
  var oSubmit = window.submitUpdate;
  if (typeof oSubmit === 'function') window.submitUpdate = function (type) {
    var note = $('su_note'), p = $('su_progress') ? $('su_progress').value : '';
    if (type === 'progress' && !p) { showToast('กรุณาเลือก % ความคืบหน้า', 'error'); return; }
    if (note && !note.value.trim()) {
      var dd = $('su_deliveryDate') ? $('su_deliveryDate').value : '', pt = $('su_problemType') ? $('su_problemType').value : '';
      if (type === 'progress') note.value = 'อัปเดตความคืบหน้า ' + p + '%';
      else if (type === 'delivery') note.value = 'แจ้งส่งมอบงาน' + (dd ? ' วันที่ ' + dd : '');
      else if (type === 'problem' && pt) note.value = pt;
      else if (photosCount()) note.value = 'ส่งรูปเพิ่มเติม';
    }
    ASK100 = type === 'progress' && p === '100';
    return oSubmit.apply(this, arguments);
  };
  var oOpen = window.openUpdateSheet;
  if (typeof oOpen === 'function') window.openUpdateSheet = function (type) { var r = oOpen.apply(this, arguments); try { enhance(type); } catch (e) { console.error('[ct-update]', e); } return r; };
  // ส่งสำเร็จ (renderDetail ถูกเรียกหลังบันทึก) → ถามแจ้งส่งมอบ
  var oRender = window.renderDetail;
  if (typeof oRender === 'function') window.renderDetail = function () {
    var r = oRender.apply(this, arguments);
    if (ASK100) {
      ASK100 = false;
      var j = window._curJob, H = window.ctHome;
      if (j && (!H || H.ready(j)) && window.Swal) setTimeout(function () {
        Swal.fire({ icon: 'success', title: 'งานถึง 100% แล้ว 🎉', text: 'แจ้งส่งมอบงานเพื่อให้ PEA ตรวจรับเลยไหม?', showCancelButton: true, confirmButtonText: '🚚 แจ้งส่งมอบเลย', cancelButtonText: 'ไว้ทีหลัง', confirmButtonColor: '#0D9488', reverseButtons: true })
          .then(function (x) { if (x.isConfirmed) openUpdateSheet('delivery'); });
      }, 900);
    }
    return r;
  };
})();
