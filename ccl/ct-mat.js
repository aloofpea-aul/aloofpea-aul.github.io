/* Contractor Portal — ใส่หมายเลขเสาได้ง่าย
   - เปิดฟอร์มวัสดุ: สร้างช่องเสาให้ครบตามแบบ (เช่น "เสา: 8 เมตร (16 ต้น)" → กลุ่มเสา 8 ม. 16 ช่อง) หักที่บันทึกไปแล้ว
   - แต่ละต้นเหลือบรรทัดเดียว: ต้นที่ n · ช่องหมายเลข · ปุ่ม 📍 พิกัด
   - กด Enter/ถัดไป → ไปต้นถัดไป (ต้นสุดท้ายเพิ่มช่องให้) · ปุ่ม "เรียงเลขต่อกัน" เติมเลขที่ว่างให้จากต้นก่อนหน้า
   - ต้นที่ไม่ได้ใส่หมายเลข ไม่ถูกบันทึก (ถ้าทั้งฟอร์มไม่มีหมายเลขเลยจะเตือนก่อน)
   ใช้ฟอร์ม/การบันทึกเดิม (addPoleRow / addPoleNoRow / submitMatForm) */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var css =
    '.pole-no-row.pmx{display:grid!important;grid-template-columns:54px 1fr auto;gap:6px;align-items:center;padding:5px 6px!important}' +
    '.pole-no-row.pmx>*{margin:0!important}.pole-no-row.pmx .pm-n{font-size:12px;font-weight:700;color:#92400E}' +
    '.pole-no-row.pmx .pole-no{font-size:16px!important;font-weight:700;letter-spacing:.5px;padding:8px 10px!important}' +
    '.pole-no-row.pmx .pm-g{border:0;border-radius:9px;padding:8px 10px;font-size:13px;font-weight:700;background:#DCFCE7;color:#166534;cursor:pointer;white-space:nowrap}.pole-no-row.pmx .pm-g.ok{background:#0D9488;color:#fff}' +
    '.pole-no-row.pmx .pm-x{border:0;background:none;color:#CBD5E1;font-size:15px;cursor:pointer;padding:0 2px}' +
    '.pole-no-row.pmx .pm-hide{display:none!important}' +
    '.pm-tools{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 6px}.pm-tools button{border:1.5px solid #FCD34D;background:#fff;color:#92400E;border-radius:9px;padding:4px 10px;font-size:12.5px;font-weight:700;cursor:pointer}' +
    '.pm-tip{font-size:12.5px;background:#FFFBEB;color:#92400E;border-radius:10px;padding:7px 10px;margin-bottom:8px;font-weight:600}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // แบบงาน: [{size:'8', n:16}]
  function planned(job) {
    var s = String(job && job.materials || ''), out = [], seg = s.split(/,\s*(?=[^,()]*:)/);
    seg.forEach(function (x) {
      if (!/^\s*เสา/.test(x)) return;
      var re = /(\d+(?:\.\d+)?)\s*(?:เมตร|ม\.?)\s*\(\s*(\d+)\s*ต้น\s*\)/g, m;
      while ((m = re.exec(x))) out.push({ size: m[1], n: parseInt(m[2], 10) });
    });
    return out;
  }
  function recorded(job, size) {
    var n = 0;
    (Array.isArray(job.contractorMaterials) ? job.contractorMaterials : []).forEach(function (e) {
      (e && e.poles || []).forEach(function (p) { if (p && p.no && new RegExp('(^|\\D)' + size.replace('.', '\\.') + '\\s*ม').test(p.type || '')) n++; });
    });
    return n;
  }
  function compact(row) {
    if (!row || row.classList.contains('pmx')) return;
    row.classList.add('pmx');
    var list = row.parentNode, idx = Array.prototype.indexOf.call(list.children, row) + 1;
    var no = row.querySelector('.pole-no'), lat = row.querySelector('.pole-lat'), lng = row.querySelector('.pole-lng'), gps = row.querySelector('button[onclick^="getGPS"]');
    Array.prototype.forEach.call(row.children, function (c) { c.classList.add('pm-hide'); });
    var n = document.createElement('span'); n.className = 'pm-n'; n.textContent = 'ต้นที่ ' + idx;
    var g = document.createElement('button'); g.type = 'button'; g.className = 'pm-g' + (lat && lat.value ? ' ok' : ''); g.textContent = lat && lat.value ? '✓ พิกัด' : '📍 พิกัด'; g.title = 'ใช้ตำแหน่งปัจจุบันเป็นพิกัดเสาต้นนี้';
    g.onclick = function () { if (gps) gps.click(); g.textContent = '…'; var t = setInterval(function () { if (lat && lat.value) { clearInterval(t); g.textContent = '✓ พิกัด'; g.classList.add('ok'); } }, 400); setTimeout(function () { clearInterval(t); if (!(lat && lat.value)) g.textContent = '📍 พิกัด'; }, 12000); };
    var x = document.createElement('button'); x.type = 'button'; x.className = 'pm-x'; x.textContent = '✕'; x.title = 'ลบต้นนี้';
    x.onclick = function () { var l = row.parentNode; row.remove(); renumber(l); };
    if (no) {
      no.placeholder = 'หมายเลขเสา'; no.setAttribute('enterkeyhint', 'next'); no.autocomplete = 'off';
      no.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return; e.preventDefault();
        var rows = row.parentNode.querySelectorAll('.pole-no-row'), i = Array.prototype.indexOf.call(rows, row);
        if (i === rows.length - 1) { var b = row.closest('.pole-item').querySelector('button[onclick^="addPoleNoRow"]'); if (b) b.click(); rows = row.parentNode.querySelectorAll('.pole-no-row'); }
        var nx = rows[i + 1] && rows[i + 1].querySelector('.pole-no'); if (nx) nx.focus();
      });
    }
    var wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:4px;align-items:center'; wrap.appendChild(g); wrap.appendChild(x);
    row.appendChild(n); if (no) row.appendChild(no); row.appendChild(wrap);
  }
  function renumber(list) { if (!list) return; Array.prototype.forEach.call(list.querySelectorAll('.pole-no-row'), function (r, i) { var s = r.querySelector('.pm-n'), t = 'ต้นที่ ' + (i + 1); if (s && s.textContent !== t) s.textContent = t; }); }
  function tools(group) {
    if (!group || group.querySelector('.pm-tools')) return;
    var list = group.querySelector('.pole-no-list'); if (!list) return;
    var t = document.createElement('div'); t.className = 'pm-tools';
    t.innerHTML = '<button type="button" data-k="seq">🔢 เรียงเลขต่อกัน</button><button type="button" data-k="add5">＋ เพิ่ม 5 ต้น</button>';
    list.parentNode.insertBefore(t, list);
    t.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.k === 'add5') { var ab = group.querySelector('button[onclick^="addPoleNoRow"]'); for (var i = 0; i < 5; i++) ab.click(); return; }
      var prev = null, filled = 0;
      Array.prototype.forEach.call(list.querySelectorAll('.pole-no'), function (inp) {
        var v = inp.value.trim();
        if (v) { prev = v; return; }
        if (prev == null) return;
        var m = /^(.*?)(\d+)(\D*)$/.exec(prev); if (!m) return;
        var nx = String(parseInt(m[2], 10) + 1); while (nx.length < m[2].length) nx = '0' + nx;
        inp.value = prev = m[1] + nx + m[3]; filled++;
      });
      if (!filled && window.showToast) showToast('ใส่หมายเลขต้นแรกก่อน แล้วกดอีกครั้ง', 'info');
    };
  }
  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('#poleList .pole-item'), function (g) { tools(g); Array.prototype.forEach.call(g.querySelectorAll('.pole-no-row'), compact); renumber(g.querySelector('.pole-no-list')); });
  }
  var busy = false, mo = new MutationObserver(function () { if (busy || !$('poleList')) return; busy = true; try { scan(); } finally { mo.takeRecords(); busy = false; } });
  function watch() { mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);

  // เปิดฟอร์ม → สร้างช่องเสาตามแบบให้ครบ
  var oInner = window._openMaterialFormInner;
  if (typeof oInner === 'function') window._openMaterialFormInner = function () {
    var r = oInner.apply(this, arguments);
    try {
      var job = window._curJob, plan = planned(job), list = $('poleList'); if (!list || !plan.length) return r;
      var need = plan.map(function (p) { return { size: p.size, n: Math.max(0, p.n - recorded(job, p.size)) }; }).filter(function (p) { return p.n > 0; });
      if (!need.length) return r;
      list.innerHTML = '';
      need.forEach(function (p) {
        addPoleRow();
        var g = list.lastElementChild, sel = g.querySelector('.pole-type');
        var opt = Array.prototype.filter.call(sel.options, function (o) { return new RegExp('\\s' + p.size.replace('.', '\\.') + '\\s*ม').test(o.value); })[0];
        sel.value = opt ? opt.value : 'อื่นๆ';
        var ab = g.querySelector('button[onclick^="addPoleNoRow"]');
        for (var i = 1; i < p.n; i++) ab.click();
      });
      var tip = document.createElement('div'); tip.className = 'pm-tip';
      tip.textContent = '📋 ตามแบบ: ' + need.map(function (p) { return 'เสา ' + p.size + ' ม. ' + p.n + ' ต้น'; }).join(' · ') + ' — พิมพ์หมายเลขแล้วกด Enter เพื่อไปต้นถัดไป';
      list.parentNode.insertBefore(tip, list);
      setTimeout(function () { var f = list.querySelector('.pole-no'); if (f) f.focus(); }, 350);
    } catch (e) { console.error('[ct-mat]', e); }
    return r;
  };
  // บันทึก: ไม่เก็บต้นที่ไม่มีหมายเลข
  var oSub = window.submitMatForm;
  if (typeof oSub === 'function') window.submitMatForm = function () {
    var rows = document.querySelectorAll('#poleList .pole-no-row'), filled = 0;
    Array.prototype.forEach.call(rows, function (r) { var v = r.querySelector('.pole-no'); if (v && v.value.trim()) filled++; });
    var tr = $('mat_tr_kva') && $('mat_tr_kva').value.trim(), att = document.querySelectorAll('#matAttachList input[type=file]').length;
    if (!filled && !tr && !att) { if (window.showToast) showToast('ยังไม่ได้ใส่หมายเลขเสา', 'error'); return; }
    Array.prototype.forEach.call(rows, function (r) { var v = r.querySelector('.pole-no'); if (!(v && v.value.trim())) r.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('#poleList .pole-item'), function (g) { if (!g.querySelector('.pole-no-row')) g.remove(); });
    return oSub.apply(this, arguments);
  };
  window.ctMat = { planned: planned, recorded: recorded };
})();
