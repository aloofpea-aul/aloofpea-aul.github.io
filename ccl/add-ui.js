/* CCL — หน้า "บันทึกงาน" แบบใหม่: เมนูขั้นตอน 6 ส่วน + ปุ่มเลือกแทนดรอปดาวน์ + รวมยอดงบอัตโนมัติ
   + ลากไฟล์มาวาง + แถบบันทึกติดล่าง  (ช่องกรอก/ชื่อฟิลด์/submitForm เดิมทั้งหมด — ข้อมูลที่ส่งเหมือนเดิม) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SECS = [
    ['ข้อมูลทั่วไป', '#4338ca', 0], ['งบโครงข่าย', '#059669', 1], ['สถานที่', '#ea580c', 0],
    ['วัสดุ', '#0891b2', 1], ['ผู้รับผิดชอบ', '#7c3aed', 0], ['เอกสารแนบ', '#db2777', 1]
  ];
  var css =
    '#page-add>.card{max-width:1200px !important;display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start;background:transparent !important;border:0 !important;box-shadow:none !important;padding:0 !important}' +
    '#page-add>.card>.ax-oldhead{display:none !important}' +
    '#page-add>.card>*{min-width:0}#constructionForm{min-width:0}#page-add .ax-bt-full{grid-column:1/-1}' +
    '#axNav{position:sticky;top:12px;background:#fff;border-radius:18px;padding:14px;box-shadow:0 1px 3px rgba(15,23,42,.06)}' +
    '#axNav h4{margin:0 0 4px;font-size:15px;font-weight:700;color:#1e293b}#axNav .rec{font-size:12px;color:#64748b;margin-bottom:12px}' +
    '#axNav a{display:flex;align-items:center;gap:10px;padding:9px 8px;border-radius:10px;font-size:14px;font-weight:600;color:#475569;cursor:pointer;text-decoration:none}' +
    '#axNav a:hover{background:#f8fafc}#axNav a i{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:12px;background:#e2e8f0;color:#64748b;flex-shrink:0;font-weight:700}' +
    '#axNav a.ok i{background:#10b981;color:#fff}#axNav a.on{background:#eef2ff;color:#4338ca}#axNav a.on:not(.ok) i{background:#4338ca;color:#fff}' +
    '#axNav .pg{height:8px;background:#e2e8f0;border-radius:9px;margin:12px 4px 4px;overflow:hidden}#axNav .pg b{display:block;height:100%;background:linear-gradient(90deg,#10b981,#34d399);transition:width .3s}' +
    '#axNav small{display:block;font-size:12px;color:#64748b;padding:0 4px}' +
    '#constructionForm>.ax-sec{background:#fff !important;border-radius:18px !important;padding:16px 18px !important;box-shadow:0 1px 3px rgba(15,23,42,.06);margin-bottom:14px !important;border:0 !important;scroll-margin-top:80px}' +
    '.ax-sh{display:flex;align-items:center;gap:10px;margin-bottom:14px}.ax-sh .n{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-weight:700;color:#fff;flex-shrink:0}' +
    '.ax-sh h3{margin:0 !important;font-size:17px !important;font-weight:700 !important;color:#1e293b !important;text-transform:none !important;letter-spacing:0 !important;border:0 !important;padding:0 !important}' +
    '.ax-sh .op{font-size:12px;color:#94a3b8;font-weight:600}.ax-sh .sp{flex:1}' +
    '#page-add .input-field{min-height:46px;border-radius:12px !important;font-size:15px !important;border-width:1.5px !important}' +
    '#page-add select.input-field{height:46px}#page-add .label-text{font-size:13px !important;font-weight:600 !important;color:#475569 !important}' +
    '#page-add .label-text.ax-req:after{content:" *";color:#ef4444}' +
    '#page-add #receiveNo{background:#f1f5f9 !important;color:#4338ca !important;text-align:left !important}' +
    '.ax-chips{display:flex;gap:8px;flex-wrap:wrap}.ax-chip{height:42px;padding:0 15px;border-radius:12px;border:1.5px solid #e2e8f0;font-size:14px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;background:#fff;cursor:pointer;font-family:inherit}' +
    '.ax-chip:hover{border-color:#a5b4fc}.ax-chip.on{border-color:#4338ca;background:#eef2ff;color:#4338ca}.ax-chip.sm{height:38px;padding:0 12px;border-radius:10px;font-size:13.5px}' +
    '.ax-hide{position:absolute !important;opacity:0 !important;pointer-events:none !important;height:1px !important;width:1px !important;overflow:hidden}' +
    '#networkContainer>div{background:#fafbff !important;border:1.5px solid #e0e7ff !important;border-radius:14px !important}' +
    '.ax-tot{font-size:13px;color:#64748b;text-align:right;margin-top:8px}.ax-tot b{font-size:18px;color:#047857}' +
    '#page-add .ax-addbtn{height:38px !important;padding:0 14px !important;border-radius:10px !important;border:1.5px dashed #a5b4fc !important;color:#4338ca !important;background:#f8faff !important;font-weight:600 !important;font-size:13.5px !important;display:inline-flex !important;align-items:center;gap:6px;box-shadow:none !important}' +
    '#page-add .ax-loc button{height:40px;padding:0 13px !important;border-radius:10px !important;font-size:13.5px !important;font-weight:600}' +
    '#axDrop{border:2px dashed #cbd5e1;border-radius:14px;padding:20px;text-align:center;color:#64748b;font-size:14px;background:#f8fafc;cursor:pointer;transition:all .15s}' +
    '#axDrop:hover,#axDrop.over{border-color:#2563eb;background:#eff6ff}#axDrop b{color:#2563eb}#axDrop small{display:block;font-size:12px;margin-top:3px;color:#94a3b8}' +
    '#attachmentContainer{margin-top:10px}' +
    '#axSave{position:sticky;bottom:0;z-index:20;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border-radius:18px 18px 0 0;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 -4px 16px rgba(15,23,42,.08);margin-top:4px}' +
    '#axSave .msg{flex:1;font-size:13.5px;color:#64748b;cursor:pointer}#axSave .msg b{color:#dc2626}#axSave .msg.ok{color:#059669;cursor:default}' +
    '#axSave #btnSubmit{height:48px;padding:0 28px !important;border-radius:13px !important;background:linear-gradient(135deg,#2563eb,#4338ca) !important;font-size:16px;transform:none !important;box-shadow:0 4px 12px rgba(67,56,202,.3) !important}' +
    '#axSave .rs{height:48px;padding:0 16px;border-radius:13px;border:1.5px solid #e2e8f0;color:#475569;font-weight:600;font-size:14px;background:#fff;cursor:pointer;font-family:inherit}' +
    '@media(max-width:760px){#page-add>.card{grid-template-columns:1fr;gap:10px}' +
    ' #axNav{top:0;z-index:15;padding:6px;border-radius:14px;display:flex;overflow-x:auto;gap:2px}#axNav::-webkit-scrollbar{display:none}' +
    ' #axNav h4,#axNav .rec,#axNav .pg,#axNav small{display:none}#axNav a{padding:6px 8px;font-size:12.5px;white-space:nowrap;flex-shrink:0}#axNav a:not(.on) span{display:none}' +
    ' #constructionForm>.ax-sec{padding:14px !important}#axSave{padding:10px 12px;bottom:var(--ax-nav,0px)}#axSave .msg{display:none}#axSave #btnSubmit{flex:1;justify-content:center}}';

  var secs = [], navLinks = [];

  function chipsFor(sel, items, small) {
    var box = document.createElement('div'); box.className = 'ax-chips';
    items.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'ax-chip' + (small ? ' sm' : ''); b.dataset.v = it[0]; b.innerHTML = it[1];
      b.onclick = function () { sel.value = it[0]; sel.dispatchEvent(new Event('change', { bubbles: true })); sync(); };
      box.appendChild(b);
    });
    sel.classList.add('ax-hide'); sel.parentNode.insertBefore(box, sel.nextSibling);
    box.__sel = sel;
    return box;
  }

  function build() {
    var page = $('page-add'), form = $('constructionForm');
    if (!page || !form || $('axNav')) return;
    var st = document.createElement('style'); st.id = 'axCss'; st.textContent = css; document.head.appendChild(st);
    var card = form.parentNode, oldHead = card.firstElementChild;
    oldHead.classList.add('ax-oldhead');

    // ส่วนต่างๆ ของฟอร์ม
    secs = Array.prototype.filter.call(form.children, function (el) { return el.tagName === 'DIV' && el.querySelector('h3'); }).slice(0, 6);
    secs.forEach(function (el, i) {
      var s = SECS[i]; el.classList.add('ax-sec'); el.id = 'axS' + (i + 1);
      var h3 = el.querySelector('h3'), hold = h3.parentNode !== el ? h3.parentNode : null;
      var sh = document.createElement('div'); sh.className = 'ax-sh';
      sh.innerHTML = '<div class="n" style="background:' + s[1] + '">' + (i + 1) + '</div><h3>' + (i === 4 ? 'ผู้รับผิดชอบ' : h3.textContent.replace(/\(ไม่บังคับ\)/, '').trim()) + '</h3>' + (s[2] ? '<span class="op">ไม่บังคับ</span>' : '') + '<span class="sp"></span>';
      if (hold) { // หัวที่มีปุ่ม "เพิ่มโครงข่าย"
        var btn = hold.querySelector('button'); if (btn) { btn.className = 'ax-addbtn'; sh.appendChild(btn); }
        hold.replaceWith(sh);
      } else h3.replaceWith(sh);
    });
    // ช่องบังคับ → ดอกจัน
    Array.prototype.forEach.call(form.querySelectorAll('[required]'), function (inp) {
      var l = labelOf(inp); if (l) l.classList.add('ax-req');
    });

    // งบงาน + สถานะงาน → ปุ่มเลือก
    var bt = $('budgetType');
    if (bt && bt.parentNode && bt.parentNode.parentNode && /grid/.test(bt.parentNode.parentNode.className)) bt.parentNode.classList.add('ax-bt-full');
    if (bt) chipsFor(bt, Array.prototype.map.call(bt.options, function (o) {
      var ic = /C$/.test(o.value) ? '⚡' : /P$/.test(o.value) ? '📁' : /I$/.test(o.value) ? '🏗' : '•';
      return [o.value, ic + ' ' + o.textContent];
    }));
    var js = form.querySelector('select[name="jobStatus"]');
    if (js) chipsFor(js, Array.prototype.map.call(js.options, function (o) { return [o.value, o.value ? o.textContent : 'ไม่ระบุ']; }), true);

    // ปุ่มเพิ่ม ต่างๆ ให้เป็นแบบเดียวกัน
    Array.prototype.forEach.call(form.querySelectorAll('button[onclick^="addJobIdField"],button[onclick^="addPoleField"],button[onclick^="addCableField"],button[onclick^="addTransformerField"]'), function (b) { b.classList.add('ax-addbtn'); b.style.height = '30px'; });
    var cbox = $('coordinatesInput'); if (cbox) cbox.closest('.md\\:col-span-1') && cbox.closest('.md\\:col-span-1').classList.add('ax-loc');

    // ผู้รับผิดชอบ: ไฟฟ้าทำเอง / ผู้รับจ้าง
    var ent = $('responsibleEntitySelect');
    if (ent) {
      var eb = document.createElement('div'); eb.className = 'ax-chips'; eb.style.marginBottom = '8px';
      eb.innerHTML = '<button type="button" class="ax-chip sm" data-k="self">⚡ ไฟฟ้าดำเนินการเอง</button><button type="button" class="ax-chip sm" data-k="ct">👷 ผู้รับจ้าง</button>';
      ent.parentNode.insertBefore(eb, ent);
      eb.addEventListener('click', function (e) {
        var b = e.target.closest('[data-k]'); if (!b) return;
        if (b.dataset.k === 'self') { var o = Array.prototype.find.call(ent.options, function (x) { return /ไฟฟ้าดำเนินการเอง/.test(x.value); }); if (o) ent.value = o.value; ent.__ct = false; }
        else { if (/ไฟฟ้าดำเนินการเอง/.test(ent.value)) ent.value = ''; ent.__ct = true; ent.focus(); try { ent.showPicker && ent.showPicker(); } catch (x) {} }
        ent.dispatchEvent(new Event('change', { bubbles: true })); sync();
      });
      ent.__eb = eb;
    }

    // เอกสารแนบ: ลากวาง / เลือกหลายไฟล์
    var ac = $('attachmentContainer');
    if (ac) {
      var drop = document.createElement('div'); drop.id = 'axDrop';
      drop.innerHTML = '📎 ลากไฟล์มาวาง หรือ <b>กดเลือกไฟล์ / ถ่ายรูป</b><small>JPG, PNG, PDF · เลือกได้หลายไฟล์ · ชื่อไฟล์แก้ได้ภายหลัง</small>';
      var fi = document.createElement('input'); fi.type = 'file'; fi.multiple = true; fi.accept = 'image/jpeg,image/png,image/jpg,application/pdf'; fi.style.display = 'none';
      ac.parentNode.insertBefore(drop, ac); ac.parentNode.insertBefore(fi, ac);
      drop.onclick = function () { fi.click(); };
      fi.onchange = function () { addFiles(fi.files); fi.value = ''; };
      ['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
      drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });
      var oldAdd = ac.parentNode.querySelector('button[onclick^="addAttachmentField"]'); if (oldAdd) { oldAdd.className = 'ax-addbtn'; oldAdd.innerHTML = '＋ เพิ่มทีละไฟล์'; oldAdd.style.marginTop = '10px'; }
      var oldP = oldAdd && oldAdd.nextElementSibling; if (oldP && oldP.tagName === 'P') oldP.style.display = 'none';
    }

    // แถบบันทึกติดล่าง
    var sb = $('btnSubmit'), sbWrap = sb && sb.parentNode;
    if (sbWrap) {
      sbWrap.id = 'axSave'; sbWrap.className = '';
      var msg = document.createElement('div'); msg.className = 'msg'; msg.id = 'axMsg'; sbWrap.insertBefore(msg, sb);
      var rs = document.createElement('button'); rs.type = 'button'; rs.className = 'rs'; rs.textContent = 'ล้างฟอร์ม';
      rs.onclick = function () {
        var go = function () { form.reset(); try { setDefaultDates(); } catch (e) {} try { fetchNextNo(); } catch (e) {} if ($('attachmentContainer')) $('attachmentContainer').innerHTML = ''; setTimeout(sync, 50); };
        if (window.Swal) Swal.fire({ icon: 'question', title: 'ล้างข้อมูลที่กรอกไว้?', showCancelButton: true, confirmButtonText: 'ล้างฟอร์ม', cancelButtonText: 'ยกเลิก' }).then(function (r) { if (r.isConfirmed) go(); });
        else go();
      };
      sbWrap.insertBefore(rs, sb);
      msg.onclick = function () { var m = form.querySelector('.ax-miss'); if (m) { m.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { try { m.focus(); } catch (e) {} }, 300); } };
    }

    // เมนูขั้นตอน
    var nav = document.createElement('div'); nav.id = 'axNav';
    var rec = $('recorderDisplay');
    nav.innerHTML = '<h4>บันทึกงานก่อสร้างใหม่</h4><div class="rec">👤 ผู้บันทึก: <span id="axRec">' + (rec ? rec.textContent : '') + '</span></div>' +
      SECS.map(function (s, i) { return '<a data-i="' + i + '"><i>' + (i + 1) + '</i><span>' + s[0] + '</span></a>'; }).join('') +
      '<div class="pg"><b id="axPg" style="width:0"></b></div><small id="axPgT"></small>';
    card.insertBefore(nav, form);
    navLinks = nav.querySelectorAll('a');
    nav.addEventListener('click', function (e) { var a = e.target.closest('a[data-i]'); if (a && secs[a.dataset.i]) secs[a.dataset.i].scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    if (rec) new MutationObserver(function () { $('axRec').textContent = rec.textContent; }).observe(rec, { childList: true, characterData: true, subtree: true });

    // อัปเดตสถานะเมื่อกรอก
    form.addEventListener('input', sync); form.addEventListener('change', sync);
    form.addEventListener('reset', function () { setTimeout(sync, 30); });
    new MutationObserver(function () { setTimeout(sync, 0); }).observe(form, { childList: true, subtree: true });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function () {
        var best = -1, top = 1e9;
        secs.forEach(function (s, i) { var r = s.getBoundingClientRect(); if (r.bottom > 120 && r.top < top) { top = r.top; best = i; } });
        Array.prototype.forEach.call(navLinks, function (a, i) { a.classList.toggle('on', i === best); });
      }, { threshold: [0, .25, .5, .75, 1] });
      secs.forEach(function (s) { io.observe(s); });
    }
    // มือถือ: แถบบันทึกต้องอยู่เหนือเมนูล่าง
    var bn = document.querySelector('.ccl-bottom-nav, #cclBottomNav, .mobile-bottom-nav');
    if (bn) document.documentElement.style.setProperty('--ax-nav', bn.offsetHeight + 'px');
    sync();
  }

  function addFiles(list) {
    Array.prototype.forEach.call(list || [], function (f) {
      if (!/^(image\/(jpeg|png|jpg)|application\/pdf)$/.test(f.type)) return;
      addAttachmentField();
      var row = $('attachmentContainer').lastElementChild;
      var nm = row.querySelector('[data-att-name]'), fl = row.querySelector('[data-att-file]');
      try { var dt = new DataTransfer(); dt.items.add(f); fl.files = dt.files; } catch (e) { return; }
      nm.value = f.name.replace(/\.[^.]+$/, '');
    });
    sync();
  }

  function filled(el) { return el && String(el.value || '').trim() !== ''; }
  function any(sel) { return Array.prototype.some.call(document.querySelectorAll('#constructionForm ' + sel), filled); }

  function labelOf(e) { var p = e.parentNode; for (var k = 0; k < 4 && p; k++, p = p.parentNode) { var l = p.querySelector && p.querySelector('.label-text'); if (l) return l; } return null; }
  function sync() {
    var form = $('constructionForm'); if (!form || !$('axNav')) return;
    var F = function (n) { return form.elements[n]; };
    // ปุ่มเลือก ↔ ค่าใน select
    Array.prototype.forEach.call(form.querySelectorAll('.ax-chips'), function (box) {
      if (box.__sel) Array.prototype.forEach.call(box.children, function (b) { b.classList.toggle('on', b.dataset.v === box.__sel.value); });
    });
    var ent = $('responsibleEntitySelect');
    if (ent && ent.__eb) {
      var self = /ไฟฟ้าดำเนินการเอง/.test(ent.value), ct = !self && (!!ent.value || !!ent.__ct);
      ent.__eb.children[0].classList.toggle('on', self); ent.__eb.children[1].classList.toggle('on', ct);
    }
    // รวมยอดงบต่อโครงข่าย
    Array.prototype.forEach.call(($('networkContainer') || { children: [] }).children, function (blk) {
      var n = function (nm) { var e = blk.querySelector('[name="' + nm + '"]'); return e ? parseFloat(String(e.value).replace(/,/g, '')) || 0 : 0; };
      var t = n('laborCost') + n('supervisionCost') + n('miscCost'), el = blk.querySelector('.ax-tot');
      if (!el) { el = document.createElement('div'); el.className = 'ax-tot'; blk.appendChild(el); }
      el.innerHTML = t ? 'รวม <b>' + t.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</b> บาท' : '';
    });
    // ส่วนที่กรอกแล้ว
    var done = [
      filled(F('receiveDate')) && filled(F('jobName')),
      any('[name="networkId"]'),
      filled(F('location')),
      any('[name="poleSize"]') || any('[name="cableSize"]') || any('[name="transformerSize"]'),
      filled(F('assignee')) || filled(F('responsibleEntity')),
      Array.prototype.some.call(form.querySelectorAll('[data-att-file]'), function (f) { return f.files && f.files.length; })
    ];
    Array.prototype.forEach.call(navLinks, function (a, i) { a.classList.toggle('ok', !!done[i]); a.querySelector('i').textContent = done[i] ? '✓' : String(i + 1); });
    // ช่องบังคับ
    var req = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (e) { return !e.disabled && e.type !== 'hidden'; });
    var miss = req.filter(function (e) { return !filled(e); });
    req.forEach(function (e) { e.classList.toggle('ax-miss', !filled(e)); });
    var nOk = req.length - miss.length;
    $('axPg').style.width = (req.length ? nOk / req.length * 100 : 100) + '%';
    $('axPgT').textContent = 'กรอกแล้ว ' + nOk + ' จาก ' + req.length + ' ช่องที่ต้องกรอก';
    var msg = $('axMsg');
    if (msg) {
      if (!miss.length) { msg.className = 'msg ok'; msg.textContent = '✓ กรอกช่องที่จำเป็นครบแล้ว'; }
      else {
        var lb = miss.map(function (e) { var l = labelOf(e); return l ? l.textContent.replace(/\*/g, '').trim() : e.name; });
        msg.className = 'msg'; msg.innerHTML = 'ยังขาด: <b>' + lb.join(', ') + '</b> · กดเพื่อไปที่ช่องนั้น';
      }
    }
  }

  function start() { try { build(); } catch (e) { console.error('[add-ui]', e); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
