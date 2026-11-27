/* CCL — หน้า "ปิดงาน" แบบการ์ด + นำเข้าสถานะจาก SAP (ไฟล์ Excel: Proj.def. / องค์ประกอบ WBS / ระดับ / ชื่อ / สถานะ …)
   - อ่านไฟล์ในเครื่อง จับคู่ "องค์ประกอบ WBS" กับหมายเลขงานใน CCL · Admin นำเข้าไฟล์แบบ WBS = ส่งแถวของ กฟส. ไปสร้าง "รายงาน SAP" ด้วย · เปิดหน้านี้จะดึงรายงาน SAP ล่าสุดมาเทียบถ้าใหม่กว่า
   - CLSD = ปิดแล้ว (ปิดใน CCL ได้) · TECO = ปิดทางเทคนิค ยังไม่ถือว่าปิด · REL/CRTD = ยังเปิด
   - ปิดงานหลายงานพร้อมกันด้วย updateWorkStatus(id,'ปิดงานแล้วเสร็จ') ตัวเดียวกับปุ่มปิดงานเดิม */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  function m(n) { return (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function dth(v) { var d = new Date(v); if (isNaN(d)) return ''; return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2); }
  // แยกข้อมูลในเครื่องตามหน่วยงาน (สลับไปคลองท่อม ฯลฯ จะไม่เห็นของอ่าวลึก)
  function brKey(base) { var b = ''; try { b = (JSON.parse(localStorage.getItem('ccl_user_v1') || '{}') || {}).branchId || ''; } catch (e) {} return (!b || b === 'aoluek') ? base : base + ':' + b; }
  var LS = brKey('ccl_sap_status_v1');
  var C = { st: '', ent: '', sort: false, sel: {}, sap: null, ui: false, shown: 0, rows: [] };
  try { C.sap = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { C.sap = null; }
  // ผลที่ดึงจากรายงานรุ่นแรก (เทียบแบบหยาบระดับงาน) — ทิ้ง แล้วดึงใหม่แบบละเอียด
  if (C.sap && C.sap.by === 'ระบบ' && !C.sap.leaf) { C.sap = null; try { localStorage.removeItem(LS); } catch (e) {} }

  var SAPL = { CLSD: ['ปิดสมบูรณ์', '#059669', '#ecfdf5'], TECO: ['ปิดทางเทคนิค (ยังไม่ปิดงาน)', '#0d9488', '#f0fdfa'], REL: ['ยังเปิดอยู่', '#64748b', '#f1f5f9'], CRTD: ['สร้างแล้ว ยังไม่ปล่อย', '#64748b', '#f1f5f9'], PART: ['ปิดบางหมายเลข', '#d97706', '#fffbeb'], NONE: ['ไม่พบในไฟล์ SAP', '#d97706', '#fffbeb'] };

  function normId(s) { return String(s || '').toUpperCase().replace(/\s+/g, '').replace(/[,;]+$/, ''); }
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); } // ไม่สนจุด/ขีด/ช่องว่าง (เช่น HB11.29._ = HB.1129)
  function jobIds(j) { return String(j.jobIds || '').split(',').map(normId).filter(function (x) { return x && x.length > 5; }); }

  // สถานะ SAP ของงาน (รวมทุกหมายเลขงาน)
  function sapOf(j) {
    if (!C.sap || !C.sap.map) return null;
    var ids = jobIds(j); if (!ids.length) return { k: 'NONE', ids: [] };
    var found = ids.map(function (i) { var s = C.sap.map[i]; return s ? { id: i, sys: s[0], usr: s[1] } : { id: i, sys: '' }; });
    var got = found.filter(function (f) { return f.sys; });
    if (!got.length) return { k: 'NONE', ids: found };
    var closed = function (f) { return f.sys === 'CLSD' || f.sys === 'TECO'; };
    var k = got.every(function (f) { return f.sys === 'CLSD'; }) ? 'CLSD' : got.every(closed) ? 'TECO' : got.some(closed) ? 'PART' : (got[0].sys === 'CRTD' ? 'CRTD' : 'REL');
    var usr = got.map(function (f) { return String(f.usr || '').trim().toUpperCase(); }).filter(function (u) { return /^[A-Z]\d{1,2}$/.test(u); });
    var rk = window.cclCode ? window.cclCode.rank : function () { return 0; };
    var code = usr.length ? usr.reduce(function (a, b) { return rk(b) < rk(a) ? b : a; }) : '';
    return { k: k, ids: found, usr: usr[0] || '', code: code, miss: found.length - got.length };
  }
  function isClosed(s) { return !!s && s.k === 'CLSD'; } // ปิดงานได้เฉพาะ CLSD

  // ───── อ่านไฟล์ SAP ─────
  function readSap(file) {
    if (!window.XLSX) { alertMsg('warning', 'ยังโหลดตัวอ่าน Excel ไม่เสร็จ', 'ลองใหม่อีกครั้งในอีกสักครู่'); return; }
    var fr = new FileReader();
    busy('กำลังอ่านไฟล์ SAP…');
    fr.onload = function () {
      try {
        var wb = XLSX.read(new Uint8Array(fr.result), { type: 'array' });
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        var hi = -1, cW = -1, cS = -1, cU = -1;
        for (var i = 0; i < Math.min(rows.length, 15) && hi < 0; i++) {
          rows[i].forEach(function (h, c) { h = String(h).trim(); if (/WBS|^หมายเลขงาน$/i.test(h)) cW = c; if (/^สถานะ$|^สถานะระบบ$|^status$|^system.?status$/i.test(h)) cS = c; if (/^สถานะผู้ใช้$|^user.?status$/i.test(h)) cU = c; });
          if (cW >= 0 && cS >= 0) hi = i;
        }
        if (hi < 0) throw new Error('ไม่พบคอลัมน์หมายเลขงาน ("องค์ประกอบ WBS" หรือ "หมายเลขงาน") และ "สถานะ" ในไฟล์');
        var need = {}; (g('allData', []) || []).forEach(function (j) { jobIds(j).forEach(function (x) { (need[key(x)] = need[key(x)] || []).push(x); }); });
        // รวมกับผลนำเข้าครั้งก่อน (ไฟล์ใหม่ทับเฉพาะหมายเลขที่มีในไฟล์) — ใช้ไฟล์รายงานที่กรองมาบางส่วนได้
        var old = C.sap || {}, map = Object.assign({}, old.map || {}), n = 0, pref = Object.assign({}, old.pref || {});
        for (var r = hi + 1; r < rows.length; r++) {
          var w = normId(rows[r][cW]); if (!w) continue; n++; pref[w.split('.')[0]] = 1;
          var hit = need[key(w)]; if (!hit) continue;
          var st = String(rows[r][cS] || ''), sys = (st.trim().split(/\s+/)[0] || '').toUpperCase(), usr = (cU >= 0 ? String(rows[r][cU] || '') : (st.split('//')[1] || '')).trim().toUpperCase();
          hit.forEach(function (x) { if (!map[x] || x === w) map[x] = [sys, usr]; });
        }
        var u = g('currentUser', {}) || {};
        var files = (old.files || (old.file ? [{ file: old.file, at: old.at }] : [])).concat([{ file: file.name, at: Date.now() }]).slice(-5);
        C.sap = { map: map, pref: pref, rows: n, matched: Object.keys(map).length, file: file.name, files: files, at: Date.now(), by: u.name || '' };
        try { localStorage.setItem(LS, JSON.stringify(C.sap)); } catch (e) {}
        C.sel = {}; C.autoSel = true;
        if (window.Swal) Swal.close();
        pushReport(rows, file.name);
        render();
        var ui = $('clCmp'); if (ui) ui.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) { alertMsg('error', 'อ่านไฟล์ SAP ไม่ได้', (e && e.message) || String(e)); }
    };
    fr.onerror = function () { alertMsg('error', 'อ่านไฟล์ไม่ได้', ''); };
    fr.readAsArrayBuffer(file);
  }
  // นำเข้าครั้งเดียว อัปเดตทั้ง 2 หน้า: Admin นำเข้าไฟล์แบบ WBS → สร้าง "รายงาน SAP" บนระบบด้วย (ส่งเฉพาะแถวของ กฟส. ไม่ส่งทั้งไฟล์)
  function pushReport(rows, name) {
    if (!isAdm() || typeof google === 'undefined' || !google.script) return;
    var head = rows.slice(0, 10).map(function (r) { return r.map(function (x) { return String(x == null ? '' : x); }); });
    var code = C.code || '';   // รหัสหน่วยงานใน WBS (ได้จากรายงานของหน่วยงานนี้) — ไม่รู้ = ส่งทุกแถว ให้หลังบ้านกรองเอง
    var body = rows.slice(10).filter(function (r) { return !code || r.join('|').indexOf(code) >= 0; }).map(function (r) { return r.map(function (x) { return String(x == null ? '' : x); }); });
    google.script.run.withSuccessHandler(function (r) {
      if (r && r.saved) { C.repAt = Date.now(); if (window.Swal && !Swal.isVisible()) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'อัปเดตหน้า "รายงาน SAP" แล้ว (' + r.jobs + ' งาน)', showConfirmButton: false, timer: 2600 }); }
    }).withFailureHandler(function () {}).cclSapReportFromRows({ file: name, rows: head.concat(body) });
  }
  // เปิดหน้าปิดงาน: ถ้า "รายงาน SAP" บนระบบใหม่กว่าข้อมูลในเครื่อง → ใช้เทียบเลย (ทุกเครื่องเห็นตรงกัน)
  function pullReport() {
    if (C.pulling || (C.pulledAt && Date.now() - C.pulledAt < 600000) || typeof google === 'undefined' || !google.script) return;
    C.pulling = true;
    google.script.run.withSuccessHandler(function (rep) {
      C.pulling = false; C.pulledAt = Date.now();
      if (rep && rep.code) C.code = rep.code;
      if (!rep || rep.none || !Array.isArray(rep.all) || !rep.all.length) return;     // รายงานรุ่นเก่า (ไม่มีข้อมูลทุกหมายเลขงาน) — ไม่ใช้
      var at = Date.parse(rep.at) || 0; if (C.sap && (C.sap.at || 0) >= at) return;
      var nf = function (f) { return String(f || '').replace(/\s+/g, ' ').trim(); };
      if (C.sap && (C.sap.files || []).some(function (f) { return nf(f.file) === nf(rep.file); })) return;   // ไฟล์เดียวกับที่นำเข้าในเครื่องนี้แล้ว — ไม่ทับ
      var all = g('allData', []) || []; if (!all.length) { C.pulledAt = 0; return; }
      var old = C.sap || {}, map = Object.assign({}, old.map || {}), pref = Object.assign({}, old.pref || {});
      // จับคู่หมายเลขงานแบบตรงตัว (เหมือนนำเข้าไฟล์เอง)
      var need = {}; all.forEach(function (j) { jobIds(j).forEach(function (x) { (need[key(x)] = need[key(x)] || []).push(x); }); });
      rep.all.forEach(function (r) { var w = normId(r[0]); if (!w) return; pref[w.split('.')[0]] = 1; var hit = need[key(w)]; if (hit) hit.forEach(function (x) { if (!map[x] || x === w) map[x] = [String(r[1] || ''), String(r[2] || '')]; }); });
      var fname = (rep.file || 'ไฟล์ SAP') + ' (จากรายงาน SAP)';
      var files = (old.files || (old.file ? [{ file: old.file, at: old.at }] : [])).concat([{ file: fname, at: at }]).slice(-5);
      C.sap = { map: map, pref: pref, rows: rep.rows || rep.all.length, matched: Object.keys(map).length, file: fname, files: files, at: at, by: 'ระบบ', leaf: 1 };
      try { localStorage.setItem(LS, JSON.stringify(C.sap)); } catch (e) {}
      C.autoSel = true; render();
    }).withFailureHandler(function () { C.pulling = false; }).cclSapReport();
  }
  function busy(t) { if (window.Swal) Swal.fire({ title: t, allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } }); }
  function alertMsg(icon, t, x) { if (window.Swal) Swal.fire({ icon: icon, title: t, text: x }); else alert(t + '\n' + x); }

  var css =
    '#clx{padding:16px 18px 6px}#clx .ttl{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700;color:#1e293b}' +
    '#clx .ttl .ic{width:38px;height:38px;border-radius:11px;background:#ede9fe;color:#7c3aed;display:grid;place-items:center;font-size:17px}#clx .ttl .sp{flex:1}' +
    '#clx .tb{height:40px;padding:0 15px;border-radius:11px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#clx .tb.g{background:#059669;border-color:#059669;color:#fff}#clx .tb:disabled{opacity:.5;cursor:not-allowed}' +
    '#clx .st{display:flex;gap:8px;margin:14px 0 12px;overflow-x:auto;padding:2px}#clx .st::-webkit-scrollbar{display:none}' +
    '#clx .s{flex:1;min-width:120px;border-radius:14px;padding:8px 12px;border:2px solid transparent;cursor:pointer;text-align:left;font-family:inherit}' +
    '#clx .s small{display:block;font-size:12.5px;font-weight:600;white-space:nowrap}#clx .s b{font-size:22px;line-height:1.25;display:block}#clx .s.on{border-color:currentColor;box-shadow:0 2px 8px rgba(0,0,0,.1)}' +
    '#clImp{margin-top:12px;border:2px dashed #a7f3d0;background:#f0fdf4;border-radius:14px;padding:10px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;transition:all .15s}#clImp.over{border-color:#059669;background:#dcfce7}' +
    '#clImp .ic{width:44px;height:44px;border-radius:12px;background:#059669;color:#fff;display:grid;place-items:center;font-size:20px;flex-shrink:0}' +
    '#clImp .tx{flex:1;min-width:200px;font-size:13.5px;color:#065f46;line-height:1.5}#clImp .tx b{font-size:15px;display:block}#clImp small{color:#64748b}' +
    '#clRes{margin-top:10px;background:#fff;border:1px solid #d1fae5;border-radius:14px;padding:10px 14px;display:flex;gap:8px 16px;flex-wrap:wrap;align-items:center;font-size:13.5px}' +
    '#clRes .k{display:flex;align-items:center;gap:6px}#clRes .k b{font-size:18px}#clRes .warn{color:#dc2626;cursor:pointer;text-decoration:underline dotted}' +
    '#clWarn{display:none;margin-top:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 12px;font-size:13px;color:#7f1d1d}#clWarn.on{display:block}' +
    '#clWarn a{color:#1d4ed8;cursor:pointer;font-weight:600}' +
    '#clCmp{display:none;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px;margin-top:12px}#clCmp.on{display:grid}' +
    '#clCmp .bx{border:1.5px solid #e2e8f0;border-radius:16px;padding:12px;min-width:0}#clCmp h4{margin:0 0 2px;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;color:#1e293b}#clCmp h4 b{margin-left:auto;font-size:22px}' +
    '#clCmp p{margin:0 0 6px;font-size:12.5px;color:#64748b}' +
    '#clCmp .rw{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:9px 10px;border-radius:12px;margin-top:6px;cursor:pointer;border:2px solid transparent;text-align:left;width:100%;font-family:inherit}' +
    '#clCmp .rw.on{border-color:currentColor}#clCmp .rw .i{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:16px;background:rgba(255,255,255,.85)}' +
    '#clCmp .rw .t b{display:block;font-size:14px;color:#1e293b}#clCmp .rw .t small{font-size:12px;color:#64748b}#clCmp .rw .n{font-size:22px;font-weight:700}' +
    '#clCmp .rw .a{height:32px;padding:0 11px;border-radius:9px;font-size:12.5px;font-weight:700;display:flex;align-items:center;white-space:nowrap;background:#fff}' +
    '#clCmp .sum{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#64748b;border-top:1px dashed #e2e8f0;margin-top:8px;padding-top:8px}' +
    '#clCmp .ok{text-align:center;padding:22px 8px;color:#16a34a;font-size:14px;background:#f0fdf4;border-radius:12px;margin-top:6px}' +
    '#clCmp .ol{max-height:230px;overflow:auto;margin-top:6px;font-size:13px}#clCmp .ol div{padding:5px 2px;border-bottom:1px solid #fef2f2;cursor:pointer}#clCmp .ol b{color:#1d4ed8}#clCmp .ol small{color:#b45309}' +
    '#clFocus{display:none;align-items:center;gap:10px;margin:2px 18px 0;font-size:14px;font-weight:700}#clFocus.on{display:flex}#clFocus button{margin-left:auto;border:0;background:none;color:#64748b;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}' +
    '.clc .todo{grid-column:1/-1;margin-top:8px;border-radius:10px;padding:7px 11px;font-size:13px;line-height:1.5}' +
    '@media(max-width:760px){#clCmp{grid-template-columns:1fr}}' +
    '#clx .f1{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}' +
    '#clx .srch{flex:1;min-width:220px;position:relative}#clx .srch>i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8}' +
    '#clx .srch input{width:100%;height:46px;border:1.5px solid #cbd5e1;border-radius:12px;padding:0 12px 0 40px;font-size:15px;background:#f8fafc}' +
    '#clx .ch{height:38px;padding:0 13px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13.5px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#clx select.ch{max-width:230px}' +
    '#clList{display:grid;gap:10px;padding:8px 18px 20px}' +
    '.clc{background:#fff;border-radius:16px;padding:14px 16px;border:1px solid #eef2f7;box-shadow:0 1px 3px rgba(15,23,42,.06);border-left:5px solid var(--sc);display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:4px 18px;cursor:pointer}' +
    '.clc.sel{background:#f6fefb;border-color:#a7f3d0}' +
    '.clc .l1{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.clc input[type=checkbox]{width:20px;height:20px;accent-color:#059669;cursor:pointer}' +
    '.clc .tg{border-radius:7px;padding:2px 8px;font-weight:600;font-size:12px;white-space:nowrap}.clc .rn{background:#eff6ff;color:#1d4ed8;font-family:"IBM Plex Mono",monospace;font-size:13px}' +
    '.clc .sap{border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;white-space:nowrap}' +
    '.clc .nm{font-size:16px;font-weight:700;line-height:1.4;margin-top:5px;color:#1e293b;word-break:break-word}' +
    '.clc .meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:5px;align-items:center;font-size:13px;color:#64748b}' +
    '.clc .ids{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;display:flex;flex-wrap:wrap;gap:4px 10px}.clc .ids .x{color:#dc2626}.clc .ids .o{color:#059669}' +
    '.clc .r{text-align:right}.clc .r small{display:block;font-size:12px;color:#64748b;font-weight:600}.clc .r b{display:block;font-size:26px;line-height:1.2;white-space:nowrap}.clc .r .d{font-size:12px;color:#64748b}' +
    '.clc .bar{grid-column:1/-1;margin-top:8px}.clc .bt2{height:9px;background:#e2e8f0;border-radius:99px;overflow:hidden}.clc .bt2 i{display:block;height:100%;background:linear-gradient(90deg,#f97316,#fb923c)}.clc .bt2 i.ov{background:#ef4444}' +
    '.clc .bl{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#64748b;margin-top:4px}.clc .bl b{color:#334155}' +
    '.clc .ft{grid-column:1/-1;display:flex;align-items:center;gap:8px 10px;margin-top:8px;padding-top:10px;border-top:1px dashed #e2e8f0;flex-wrap:wrap}' +
    '.clc .who{font-size:13px;color:#64748b;display:flex;gap:4px 14px;flex-wrap:wrap;flex:1;min-width:0}.clc .who i{margin-right:4px;color:#94a3b8}' +
    '.clc .btn{height:38px;padding:0 14px;border-radius:10px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '.clc .btn.p{background:#059669;border-color:#059669;color:#fff;padding:0 18px}' +
    '#clSel{position:sticky;bottom:var(--cl-nav,0px);z-index:20;margin:0 18px 14px;background:#064e3b;color:#fff;border-radius:14px;padding:10px 14px;display:none;align-items:center;gap:12px;font-size:14px;box-shadow:0 6px 20px rgba(15,23,42,.25)}' +
    '#clSel.on{display:flex}#clSel button{border:0;border-radius:10px;padding:9px 16px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}#clSel .p{margin-left:auto;background:#10b981;color:#fff}#clSel .c{background:transparent;color:#a7f3d0}' +
    '.cl-empty{text-align:center;padding:50px 16px;color:#94a3b8}.cl-empty i{font-size:44px;opacity:.35;display:block;margin-bottom:10px}' +
    '#clMore{display:block;margin:0 auto;height:40px;padding:0 18px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;font-weight:600;color:#475569;cursor:pointer}' +
    '@media(max-width:700px){#clx{padding:12px 12px 4px}#clList{padding:6px 10px 16px}#clx .ttl .tb span{display:none}' +
    ' .clc{grid-template-columns:1fr;padding:12px}.clc .r{text-align:left;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;background:var(--sb);border-radius:10px;padding:6px 10px;margin-top:6px}.clc .r b{font-size:20px;display:inline}.clc .r small{display:inline}' +
    ' .clc .ft .btn{flex:1}.clc .who{flex-basis:100%}#clSel{margin:0 10px 12px}}';

  function build() {
    if (C.ui) return true;
    var page = $('page-close'); if (!page) return false;
    var card = page.querySelector('.bg-white.rounded-xl'); if (!card) return false;
    var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    var oldHead = card.firstElementChild, wrap = card.querySelector('.overflow-x-auto');
    var x = document.createElement('div'); x.id = 'clx';
    x.innerHTML = '<div class="ttl"><div class="ic"><i class="fa-solid fa-paper-plane"></i></div>ระบบส่งปิดงาน<span class="sp"></span>' +
      '<button class="tb" onclick="showPage(\'completed\')"><i class="fa-solid fa-circle-check" style="color:#16a34a"></i><span>งานแล้วเสร็จ</span></button></div>' +
      '<div id="clImp"><div class="ic"><i class="fa-solid fa-file-import"></i></div><div class="tx"><b id="clImpT">นำเข้าสถานะจาก SAP</b><span id="clLast"></span></div>' +
      '<input type="file" id="clFile" accept=".xlsx,.xls,.csv" style="display:none"><button class="tb" id="clReset" style="display:none" title="ล้างผลนำเข้าทั้งหมด แล้วเริ่มนำเข้าใหม่"><i class="fa-solid fa-rotate-left"></i> ล้างผล</button><button class="tb" id="clAuto" title="นำเข้าสถานะ SAP อัตโนมัติจากโฟลเดอร์ Google Drive"><i class="fa-solid fa-gear"></i> อัตโนมัติ</button><button class="tb g" id="clPick"><i class="fa-solid fa-folder-open"></i> <span id="clPickT">เลือกไฟล์ SAP</span></button></div>' +
      '<div id="clCmp"></div>' +
      '<div class="f1"><div class="srch"><i class="fa-solid fa-magnifying-glass"></i><input id="clQ" placeholder="ค้นหาเลขที่ / ชื่องาน / หมายเลขงาน / ผู้รับจ้าง"></div>' +
      '<select class="ch" id="clEnt"></select><button class="ch" id="clSort"><i class="fa-solid fa-arrow-down-wide-short"></i><span>เรียงตามเดิม</span></button></div>';
    card.insertBefore(x, oldHead); oldHead.style.display = 'none'; if (wrap) wrap.style.display = 'none';
    var fo = document.createElement('div'); fo.id = 'clFocus'; fo.innerHTML = '<span></span><button type="button">✕ แสดงทั้งหมด</button>'; card.appendChild(fo);
    fo.querySelector('button').onclick = function () { C.st = ''; render(); };
    var list = document.createElement('div'); list.id = 'clList'; card.appendChild(list);
    var sel = document.createElement('div'); sel.id = 'clSel';
    sel.innerHTML = '<i class="fa-solid fa-square-check"></i><span id="clSelT"></span><button class="c" id="clSelC">ล้าง</button><button class="p" id="clSelP"><i class="fa-solid fa-circle-check"></i> ปิดงานที่เลือก</button>';
    card.appendChild(sel);
    $('clPick').onclick = function () { $('clFile').click(); };
    $('clReset').onclick = function () {
      var go = function () { C.sap = null; C.sel = {}; C.st = ''; try { localStorage.removeItem(LS); } catch (e) {} render(); };
      if (window.Swal) Swal.fire({ icon: 'question', title: 'ล้างผลนำเข้า SAP?', text: 'ข้อมูลงานใน CCL ไม่เปลี่ยน — แค่ลบผลเทียบกับ SAP ในเครื่องนี้ แล้วนำเข้าไฟล์ใหม่', showCancelButton: true, confirmButtonText: 'ล้างผล', cancelButtonText: 'ยกเลิก' }).then(function (r) { if (r.isConfirmed) go(); });
      else go();
    };
    $('clAuto').onclick = autoPanel;
    $('clFile').onchange = function () { if (this.files[0]) readSap(this.files[0]); this.value = ''; };
    var imp = $('clImp');
    ['dragenter', 'dragover'].forEach(function (t) { imp.addEventListener(t, function (e) { e.preventDefault(); imp.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { imp.addEventListener(t, function (e) { e.preventDefault(); imp.classList.remove('over'); }); });
    imp.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readSap(f); });
    $('clCmp').addEventListener('click', function (e) {
      var a = e.target.closest('[data-close]'); if (a) { e.stopPropagation(); C.sel = {}; C.rows0.filter(function (j) { return grp(j) === 'clsd'; }).forEach(function (j) { C.sel[j.id] = 1; }); C.st = 'clsd'; render(); bulkClose(); return; }
      var jc = e.target.closest('[data-jc]'); if (jc) { e.stopPropagation(); syncCodes(jc.dataset.jc === 'all'); return; }
      var jt = e.target.closest('[data-jct]'); if (jt) { e.stopPropagation(); C.jcOpen = !C.jcOpen; render(); return; }
      var o = e.target.closest('[data-other]'); if (o) { e.stopPropagation(); bulkClose(C.other, true); return; }
      var j = e.target.closest('[data-job]'); if (j) { openDetailModal(Number(j.dataset.job)); return; }
      var b = e.target.closest('[data-s]'); if (b) { C.st = C.st === b.dataset.s ? '' : b.dataset.s; render(); var l = $('clFocus'); if (l && C.st) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
    $('clQ').oninput = render;
    $('clEnt').onchange = function () { C.ent = this.value; render(); };
    $('clSort').onclick = function () { C.sort = !C.sort; render(); };
    $('clSelC').onclick = function () { C.sel = {}; render(); };
    $('clSelP').onclick = bulkClose;
    list.addEventListener('click', function (e) {
      var cb = e.target.closest('input[type=checkbox]');
      if (cb) { e.stopPropagation(); if (cb.checked) C.sel[cb.value] = 1; else delete C.sel[cb.value]; cb.closest('.clc').classList.toggle('sel', cb.checked); syncSel(); return; }
      if (e.target.closest('.ft, a, .ctl-name')) return;
      var c = e.target.closest('.clc[data-id]'); if (c && typeof openDetailModal === 'function') openDetailModal(Number(c.dataset.id));
    });
    var bn = $('cclBottomNav'); if (bn && bn.offsetHeight) document.documentElement.style.setProperty('--cl-nav', bn.offsetHeight + 'px');
    C.ui = true; return true;
  }

  function money(j) {
    var sum = function (s) { return String(s || '').split(',').reduce(function (a, v) { return a + (parseFloat(v) || 0); }, 0); };
    var bud = sum(j.laborCost) + sum(j.supervisionCost) + sum(j.miscCost);
    var ex = j.expenses || []; if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } }
    var sp = (Array.isArray(ex) ? ex : []).reduce(function (a, e) { return a + (parseFloat(e.amount) || 0); }, 0);
    return { bud: bud, sp: sp };
  }
  function sentAt(j) {
    var tl = Array.isArray(j.jobTimeline) ? j.jobTimeline : [];
    var e = tl.slice().reverse().find(function (h) { return h.status === 'ส่งปิดงาน' || /ส่งปิดงาน/.test(h.details || ''); });
    return e ? new Date(e.timestamp) : null;
  }

  var GR = {
    clsd: ['✅', 'SAP ปิดสมบูรณ์ (CLSD)', 'ปิดงานใน CCL ได้เลย', '#059669', '#ecfdf5'],
    teco: ['🔧', 'SAP ปิดทางเทคนิค (TECO)', 'ยังไม่ถือว่าปิด · รอ SAP เป็น CLSD', '#0d9488', '#f0fdfa'],
    rel: ['⏳', 'SAP ยังเปิดอยู่ (REL)', 'ตามเรื่องให้ปิดใน SAP ก่อน', '#475569', '#f1f5f9'],
    none: ['❓', 'ไม่พบในไฟล์ SAP', 'หมายเลขงานไม่ตรง หรือไฟล์ไม่มีงานกลุ่มนี้', '#d97706', '#fffbeb']
  };
  function grp(j) { var s = j.__s; if (!C.sap || !s) return ''; return s.k === 'CLSD' ? 'clsd' : s.k === 'TECO' ? 'teco' : s.k === 'NONE' ? 'none' : 'rel'; }
  var ID_OK = /^(C-\d{2}-K-[A-Z]{3}[A-Z0-9]{2}\.\d{4}\.\d{2}\.\d|I-\d{2}-K-[A-Z0-9]+\.[A-Z0-9]+\.\d{4}|P-[A-Z0-9.]+-K-[A-Z0-9]+\.[A-Z0-9]+(\.\d+)*)$/;
  function todo(j) {
    var k = grp(j), s = j.__s; if (!k) return '';
    var t;
    if (k === 'clsd') t = '<b>ปิดงานได้เลย</b> — SAP ปิดสมบูรณ์แล้ว';
    else if (k === 'teco') t = '<b>รอ SAP ปิดสมบูรณ์</b> — ตอนนี้เป็น TECO (ปิดทางเทคนิค) ยังไม่ปิดงานใน CCL';
    else if (k === 'rel') t = s.k === 'PART' ? '<b>ปิดใน SAP ยังไม่ครบ</b> — บางหมายเลขงานยังไม่เป็น CLSD' : '<b>ตามเรื่องให้ปิดใน SAP</b> — SAP ยังเปิดอยู่ (' + esc(s.k) + ')';
    else {
      var ids = (s.ids || []).map(function (f) { return f.id; });
      var bad = ids.filter(function (i) { return !ID_OK.test(i); });
      var pre = ids.map(function (i) { return i.split('.')[0]; }).filter(function (p) { return C.sap.pref && !C.sap.pref[p]; });
      if (!ids.length) t = '<b>ยังไม่มีหมายเลขงาน</b> — ใส่หมายเลขงานก่อน จึงจะเทียบกับ SAP ได้';
      else if (bad.length) t = '<b>ตรวจหมายเลขงาน</b> — รูปแบบอาจพิมพ์ผิด: ' + bad.map(esc).join(', ');
      else if (pre.length) t = '<b>ไฟล์ SAP ไม่มีงานกลุ่ม ' + esc(pre[0]) + '</b> — export SAP ให้รวมงานกลุ่มนี้ด้วย';
      else t = '<b>ตรวจหมายเลขงาน</b> — ไม่พบเลขนี้ในไฟล์ SAP';
    }
    var c = GR[k];
    return '<div class="todo" style="background:' + c[4] + ';color:' + c[3] + '">👉 ' + t + '</div>';
  }
  function card(j) {
    var s = j.__s, closed = isClosed(s), L = s ? SAPL[s.k] : null, mo = money(j), sent = j.__sent;
    var days = sent && !isNaN(sent) ? Math.max(0, Math.ceil((Date.now() - sent) / 86400000)) : null;
    var on = !!C.sel[j.id], pct = mo.bud > 0 ? mo.sp / mo.bud * 100 : 0;
    var idsH = s && s.ids && s.ids.length ? s.ids.map(function (f) {
      return '<span class="' + (f.sys === 'CLSD' ? 'o' : !f.sys ? 'x' : '') + '" title="' + esc(f.sys || 'ไม่พบใน SAP') + '">' + esc(f.id) + (f.sys ? ' · ' + esc(f.sys) : ' · ไม่พบ') + '</span>';
    }).join('') : esc(j.jobIds || '-');
    var ent = String(j.responsibleEntity || '').trim(), self = !ent || ent === 'ไฟฟ้าดำเนินการเอง';
    var gk = grp(j), gc = gk ? GR[gk] : null;
    return '<div class="clc' + (on ? ' sel' : '') + '" data-id="' + j.id + '" style="--sc:' + (gc ? gc[3] : '#7c3aed') + ';--sb:' + (gc ? gc[4] : '#f5f3ff') + '">' +
      '<div style="min-width:0"><div class="l1">' + (closed ? '<input type="checkbox" value="' + j.id + '"' + (on ? ' checked' : '') + ' aria-label="เลือกปิดงาน">' : '') +
        '<span class="tg rn">' + esc(j.receiveNo || '-') + '</span>' +
        (L ? '<span class="sap" style="color:' + L[1] + ';background:' + L[2] + '">SAP: ' + (s.k === 'NONE' || s.k === 'PART' ? '' : s.k + ' · ') + L[0] + (s.usr ? ' · ' + esc(s.usr) : '') + '</span>' : '') + '</div>' +
        '<div class="nm">' + esc(j.jobName || '-') + '</div>' +
        '<div class="meta"><div class="ids">' + idsH + '</div></div>' +
        '<div class="meta"><span><i class="fa-solid fa-circle-check" style="color:#16a34a;margin-right:4px"></i>' + esc(j.inspectionStatus || 'รอตรวจสอบ') + '</span>' + (j.budgetType ? '<span>' + esc(j.budgetType) + '</span>' : '') + '</div></div>' +
      '<div class="r"><small>รอปิดงาน</small><b style="color:' + (days > 14 ? '#dc2626' : '#334155') + '">' + (days == null ? '-' : days + ' วัน') + '</b><span class="d">' + (sent ? 'ส่งปิดงาน ' + esc(dth(sent)) : '') + '</span></div>' +
      (mo.bud ? '<div class="bar"><div class="bt2"><i class="' + (pct > 100 ? 'ov' : '') + '" style="width:' + Math.min(pct, 100) + '%"></i></div><div class="bl"><span>ใช้ไป <b>' + m(mo.sp) + '</b> (' + pct.toFixed(1) + '%)</span><span>คงเหลือ <b>' + m(mo.bud - mo.sp) + '</b></span><span>งบ <b>' + m(mo.bud) + '</b></span></div></div>' : '') +
      todo(j) +
      '<div class="ft"><div class="who">' + (self ? '<span><i class="fa-solid fa-bolt" style="color:#eab308"></i>ไฟฟ้าดำเนินการเอง</span>' : '<span><i class="fa-solid fa-helmet-safety" style="color:#f97316"></i><span>' + esc(ent) + '</span></span>') +
        '<span><i class="fa-solid fa-user-tie"></i>' + esc(j.assignee || '-') + '</span></div>' +
        (gk === 'none' ? '<button class="btn" onclick="openEditModal(' + j.id + ')"><i class="fa-solid fa-pen" style="color:#f97316"></i>แก้หมายเลขงาน</button>'
          : '<button class="btn" onclick="returnJobToInspection(' + j.id + ')"><i class="fa-solid fa-rotate-left" style="color:#f97316"></i>ส่งกลับตรวจรับ</button>') +
        '<button class="btn" onclick="openDetailModal(' + j.id + ')"><i class="fa-solid fa-eye" style="color:#3b82f6"></i>รายละเอียด</button>' +
        '<button class="btn p" onclick="completeJob(' + j.id + ')"><i class="fa-solid fa-circle-check"></i>ปิดงาน</button></div></div>';
  }

  function render() {
    try { pullReport(); } catch (e) {}
    if (!build()) return;
    var all = g('allData', []) || [];
    var data = all.filter(function (j) { return j.status === 'ส่งปิดงาน'; });
    data.forEach(function (j) { j.__s = sapOf(j); j.__sent = sentAt(j); });
    // เลือกให้อัตโนมัติหลังนำเข้า: เฉพาะ CLSD
    if (C.autoSel) { C.autoSel = false; data.forEach(function (j) { if (j.__s && j.__s.k === 'CLSD') C.sel[j.id] = 1; }); }
    Object.keys(C.sel).forEach(function (k) { if (!data.some(function (j) { return String(j.id) === k && isClosed(j.__s); })) delete C.sel[k]; });
    // ตัวกรองผู้รับผิดชอบ
    var es = {}; data.forEach(function (j) { var e = String(j.responsibleEntity || '').trim(); if (e) es[e] = (es[e] || 0) + 1; });
    $('clEnt').innerHTML = '<option value="">ผู้รับผิดชอบ: ทั้งหมด</option>' + Object.keys(es).sort(function (a, b) { return es[b] - es[a]; }).map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + ' (' + es[k] + ')</option>'; }).join('');
    $('clEnt').value = es[C.ent] ? C.ent : ''; C.ent = $('clEnt').value;
    var q = ($('clQ').value || '').toLowerCase().trim();
    var base = data.filter(function (j) {
      if (C.ent && String(j.responsibleEntity || '').trim() !== C.ent) return false;
      return !q || [j.jobName, j.receiveNo, j.jobIds, j.responsibleEntity, j.assignee].some(function (v) { return String(v || '').toLowerCase().indexOf(q) >= 0; });
    });
    C.rows0 = data;
    var cmp = $('clCmp');
    if (C.sap) {
      $('clImpT').textContent = 'สถานะ SAP: ' + (C.sap.files && C.sap.files.length > 1 ? C.sap.files.map(function (f) { return f.file; }).join(' + ') : (C.sap.file || '-'));
      $('clLast').textContent = 'นำเข้าเมื่อ ' + new Date(C.sap.at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) + (C.sap.by ? ' โดย ' + C.sap.by : '') + ' · เทียบกับงานใน CCL ด้วยหมายเลขงาน (WBS) · ลากไฟล์ใหม่มาวางได้';
      $('clPickT').textContent = 'นำเข้าไฟล์เพิ่ม'; $('clReset').style.display = '';
      var cnt = { clsd: 0, teco: 0, rel: 0, none: 0 }; base.forEach(function (j) { cnt[grp(j)]++; });
      var other = C.other = all.filter(function (j) { return j.status !== 'ส่งปิดงาน' && j.status !== 'ปิดงานแล้วเสร็จ' && j.status !== 'ยกเลิก' && isClosed(sapOf(j)); });
      var row = function (k) {
        var c = GR[k], act = k === 'clsd' ? (cnt.clsd ? '<span class="a" data-close="1" style="background:#059669;color:#fff">ปิดงาน ' + cnt.clsd + '</span>' : '<span class="a" style="color:#94a3b8">—</span>') : '<span class="a" style="color:' + c[3] + '">' + (k === 'none' ? 'ตรวจ' : 'รอ') + '</span>';
        return '<button type="button" class="rw' + (C.st === k ? ' on' : '') + '" data-s="' + k + '" style="background:' + c[4] + ';color:' + c[3] + '"><div class="i">' + c[0] + '</div><div class="t"><b>' + c[1] + '</b><small>' + c[2] + '</small></div><div class="n">' + cnt[k] + '</div>' + act + '</button>';
      };
      cmp.innerHTML = '<div class="bx" style="border-color:#ddd6fe"><h4>📤 งานรอปิดใน CCL<b style="color:#7c3aed">' + base.length + '</b></h4><p>สถานะใน SAP ของงานที่ส่งปิดงานแล้ว — กดแถวเพื่อดูเฉพาะกลุ่ม</p>' +
          ['clsd', 'teco', 'rel', 'none'].map(row).join('') +
          '<div class="sum"><span>CLSD ' + cnt.clsd + ' + TECO ' + cnt.teco + ' + REL ' + cnt.rel + ' + ไม่พบ ' + cnt.none + '</span><b style="color:#7c3aed">= รอปิด ' + base.length + ' งาน</b></div></div>' +
        '<div class="bx" style="border-color:#fecaca"><h4>⚠️ งานขั้นอื่นที่ SAP ปิดแล้ว<b style="color:' + (other.length ? '#dc2626' : '#16a34a') + '">' + other.length + '</b></h4><p>SAP เป็น CLSD แต่ใน CCL ยังไม่ถึงขั้นส่งปิดงาน</p>' +
          (other.length ? '<button type="button" data-other="1" style="width:100%;border:0;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;padding:9px 14px;cursor:pointer;font-family:inherit;margin-top:4px"><i class="fa-solid fa-circle-check"></i> ปิดงานตาม SAP ทั้งหมด (' + other.length + ')</button>' +
            '<div class="ol">' + other.map(function (j) { return '<div data-job="' + j.id + '"><b>' + esc(j.receiveNo || '-') + '</b> ' + esc(j.jobName || '') + ' <small>· CCL: ' + esc(j.status || '-') + '</small></div>'; }).join('') + '</div>'
            : '<div class="ok">✔ ไม่มีงานค้าง — สถานะ CCL ตรงกับ SAP แล้ว</div>') + '</div>' + codeBox(all);
      cmp.classList.add('on');
    } else {
      C.st = ''; cmp.classList.remove('on'); $('clReset').style.display = 'none'; $('clPickT').textContent = 'เลือกไฟล์ SAP';
      $('clImpT').textContent = 'นำเข้าสถานะจาก SAP';
      $('clLast').textContent = 'ลากไฟล์ Excel ที่ export จาก SAP (มีคอลัมน์ "องค์ประกอบ WBS" และ "สถานะ") มาวาง หรือกดเลือกไฟล์ — ระบบจะบอกว่างานไหนปิดใน CCL ได้';
    }
    var fo = $('clFocus');
    var rows = C.st ? base.filter(function (j) { return grp(j) === C.st; }) : base;
    fo.classList.toggle('on', !!C.st); if (C.st) { fo.style.color = GR[C.st][3]; fo.querySelector('span').textContent = GR[C.st][0] + ' แสดง: ' + GR[C.st][1] + ' · ' + rows.length + ' งาน'; }
    if (C.sort) rows = rows.slice().sort(function (a, b) { return (a.__sent || 0) - (b.__sent || 0); });
    $('clSort').querySelector('span').textContent = C.sort ? 'รอนานสุดก่อน' : 'เรียงตามเดิม';
    var b = $('closeCountBadge'); if (b) b.innerText = data.length + ' รายการ';
    var nb = $('badge-close'); if (nb) { nb.innerText = data.length; nb.style.display = data.length ? 'block' : 'none'; }
    C.rows = rows; C.shown = 0;
    var L = $('clList'); L.innerHTML = '';
    if (!rows.length) L.innerHTML = '<div class="cl-empty"><i class="fa-solid fa-inbox"></i><div style="font-weight:700;color:#64748b">ไม่มีงานในกลุ่มนี้</div></div>';
    else more();
    syncSel();
  }
  function more() {
    var L = $('clList'), n = Math.min(C.rows.length, C.shown + 40), h = '';
    var mb = $('clMore'); if (mb) mb.remove();
    for (var i = C.shown; i < n; i++) h += card(C.rows[i]);
    L.insertAdjacentHTML('beforeend', h); C.shown = n;
    if (C.shown < C.rows.length) { L.insertAdjacentHTML('beforeend', '<button id="clMore">แสดงเพิ่ม (' + (C.rows.length - C.shown) + ')</button>'); $('clMore').onclick = more; }
  }
  function syncSel() {
    var n = Object.keys(C.sel).length;
    $('clSel').classList.toggle('on', n > 0);
    $('clSelT').textContent = 'เลือกปิดงาน ' + n + ' งาน';
    $('clSelP').innerHTML = '<i class="fa-solid fa-circle-check"></i> ปิดงานที่เลือก (' + n + ')';
  }

  // ───── สถานะงาน (Job Code) ไม่ตรง SAP ─────
  function codeDiff(all) {
    return all.filter(function (j) { return j.status !== 'ยกเลิก'; }).map(function (j) {
      var s = sapOf(j); if (!s || !s.code) return null;
      var cur = String(j.jobStatus || '').trim();
      return cur.toUpperCase() === s.code ? null : { j: j, cur: cur, code: s.code };
    }).filter(Boolean);
  }
  function isAdm() { var u = g('currentUser', {}) || {}; return u.role === 'Admin' || !!u.superAdmin; }
  function codeBox(all) {
    var d = C.codeDiff = codeDiff(all), rk = window.cclCode ? window.cclCode.rank : function () { return 0; };
    var down = d.filter(function (x) { return rk(x.code) < rk(x.cur); }).length;
    if (!d.length) return '<div class="bx" style="grid-column:1/-1;border-color:#bbf7d0"><h4>📌 สถานะงาน (Job Code) เทียบ SAP<b style="color:#16a34a">0</b></h4><div class="ok" style="padding:12px">✔ สถานะงานใน CCL ตรงกับ SAP ทุกงานที่พบในไฟล์</div></div>';
    return '<div class="bx" style="grid-column:1/-1;border-color:#fde68a"><h4>📌 สถานะงาน (Job Code) ไม่ตรง SAP<b style="color:#ca8a04">' + d.length + '</b></h4>' +
      '<p>ใช้ "สถานะผู้ใช้" จาก SAP (เช่น C1, D2, F4) · งานที่มีหลายหมายเลขงานใช้รหัสที่ต่ำสุด' + (down ? ' · <b style="color:#dc2626">ลดลง ' + down + ' งาน</b>' : '') + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        (isAdm() ? ((d.length - down) ? '<button type="button" data-jc="up" style="flex:1;min-width:200px;border:0;border-radius:10px;background:#ca8a04;color:#fff;font-weight:700;padding:9px 14px;cursor:pointer;font-family:inherit">⬆️ อัปเดตเฉพาะที่ SAP สูงกว่า (' + (d.length - down) + ' งาน)</button>' : '<div style="flex:1;font-size:12.5px;color:#475569;background:#f8fafc;border-radius:10px;padding:8px 12px">ไม่มีงานที่ SAP สูงกว่า CCL</div>') +
            (down ? '<button type="button" data-jc="all" style="border:1.5px solid #fecaca;background:#fff;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;font-family:inherit;color:#b91c1c" title="รวมงานที่ SAP ต่ำกว่า CCL (สถานะจะลดลง)">รวมที่ลดลงด้วย (' + d.length + ')</button>' : '')
          : '<div style="flex:1;font-size:12.5px;color:#92400e;background:#fffbeb;border-radius:10px;padding:8px 12px">🔒 เฉพาะ Admin กดอัปเดตได้ — แจ้ง Admin ให้นำเข้าไฟล์นี้แล้วกดอัปเดต</div>') +
        '<button type="button" data-jct="1" style="border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;font-family:inherit;color:#475569">' + (C.jcOpen ? 'ซ่อนรายการ' : 'ดูรายการ') + '</button></div>' +
      (C.jcOpen ? '<div class="ol" style="max-height:260px">' + d.map(function (x) {
        var dn = rk(x.code) < rk(x.cur);
        return '<div data-job="' + x.j.id + '"><b>' + esc(x.j.receiveNo || '-') + '</b> ' + esc(x.j.jobName || '') + ' <small>· ' + esc(x.j.status || '-') + '</small> · <span style="font-weight:700">' + esc(x.cur || 'ว่าง') + ' → <span style="color:' + (dn ? '#dc2626' : '#16a34a') + '">' + esc(x.code) + '</span></span></div>';
      }).join('') + '</div>' : '') + '</div>';
  }
  function syncCodes(withDown) {
    var rk = window.cclCode ? window.cclCode.rank : function () { return 0; };
    var d = (C.codeDiff || []).filter(function (x) { return withDown || rk(x.code) >= rk(x.cur); }); if (!d.length || !window.Swal) return;
    var cnt = {}; d.forEach(function (x) { var k = (x.cur || 'ว่าง') + ' → ' + x.code; cnt[k] = (cnt[k] || 0) + 1; });
    var down = d.filter(function (x) { return rk(x.code) < rk(x.cur); });
    Swal.fire({
      icon: 'question', title: 'อัปเดตสถานะงานตาม SAP ' + d.length + ' งาน?', width: 560,
      html: '<div style="text-align:left;font-size:13.5px"><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">' +
        Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).map(function (k) { return '<span style="background:#fef9c3;color:#854d0e;border-radius:8px;padding:3px 9px;font-weight:600">' + esc(k) + ' · ' + cnt[k] + '</span>'; }).join('') + '</div>' +
        (down.length ? '<div style="background:#fef2f2;color:#991b1b;border-radius:10px;padding:8px 12px">⚠️ ลดลง ' + down.length + ' งาน: ' + down.map(function (x) { return esc(x.j.receiveNo) + ' (' + esc(x.cur) + '→' + esc(x.code) + ')'; }).join(', ') + '</div>' : '') +
        '<div style="color:#64748b;font-size:12.5px;margin-top:8px">ทุกงานจะบันทึกในไทม์ไลน์ "สถานะงาน … → … (แก้ตาม SAP)" · งานที่มีคนเพิ่งแก้ระหว่างนี้จะถูกข้าม</div></div>',
      showCancelButton: true, confirmButtonText: 'อัปเดต ' + d.length + ' งาน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#ca8a04'
    }).then(function (r) {
      if (!r.isConfirmed) return;
      busy('กำลังอัปเดตสถานะงาน…');
      var items = d.map(function (x) { return { id: x.j.id, code: x.code, old: x.cur }; });
      google.script.run.withSuccessHandler(function (res) {
        if (!res || res.success === false) { alertMsg('error', 'อัปเดตไม่สำเร็จ', (res && res.error) || ''); return; }
        var skipped = {}; (res.skipped || []).forEach(function (id) { skipped[id] = 1; });
        d.forEach(function (x) { if (!skipped[x.j.id]) x.j.jobStatus = x.code; });
        alertMsg(res.skip ? 'warning' : 'success', 'อัปเดตแล้ว ' + res.done + ' งาน', res.skip ? 'ข้าม ' + res.skip + ' งาน (มีคนแก้ระหว่างนี้) — กดรีเฟรชแล้วลองอีกครั้ง' : '');
        render(); try { if (typeof renderTable === 'function') renderTable(); } catch (e) {}
      }).withFailureHandler(function (e) { alertMsg('error', 'อัปเดตไม่สำเร็จ', (e && e.message) || String(e)); })
        .cclSetJobCodes(items, 'แก้ตาม SAP');
    });
  }

  // ───── ตั้งค่านำเข้า SAP อัตโนมัติ (โฟลเดอร์ Google Drive) ─────
  var AUTO = null;
  function autoCss() {
    if ($('clAutoCss')) return;
    var st = document.createElement('style'); st.id = 'clAutoCss';
    st.textContent = '.sa{text-align:left;font-size:13.5px}.sa .fl{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}' +
      '.sa .fl div{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 8px;font-size:12px;color:#475569;line-height:1.45}.sa .fl b{display:block;color:#1e293b;font-size:12.5px}' +
      '.sa .rw{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px dashed #e2e8f0}.sa .rw .l{flex:1}.sa .rw .l small{display:block;color:#94a3b8;font-size:12px}' +
      '.sa .sw{position:relative;width:42px;height:24px;flex-shrink:0}.sa .sw input{opacity:0;width:0;height:0}.sa .sw span{position:absolute;inset:0;border-radius:999px;background:#cbd5e1;transition:.2s;cursor:pointer}' +
      '.sa .sw span:after{content:"";position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}.sa .sw input:checked+span{background:#16a34a}.sa .sw input:checked+span:after{left:21px}' +
      '.sa .sw input:disabled+span{opacity:.55;cursor:not-allowed}' +
      '.sa .fd{display:flex;align-items:center;gap:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin:4px 0 2px}.sa .fd b{flex:1}' +
      '.sa .bt{border:1.5px solid #e2e8f0;background:#fff;border-radius:9px;padding:7px 12px;font-weight:600;font-size:13px;color:#334155;cursor:pointer;font-family:inherit;text-decoration:none;white-space:nowrap}' +
      '.sa .bt.g{background:#059669;border-color:#059669;color:#fff}.sa .bt.v{background:#4f46e5;border-color:#4f46e5;color:#fff}.sa .bt:disabled{opacity:.5;cursor:not-allowed}' +
      '.sa .acts{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding-top:10px;border-top:1px dashed #e2e8f0}' +
      '.sa .sabd{display:inline-block !important;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}.sa h4{margin:14px 0 4px;font-size:14px}' +
      '.sa .lg{max-height:190px;overflow:auto}.sa .lg div{display:grid;grid-template-columns:86px 1fr;gap:8px;padding:7px 0;border-top:1px solid #f1f5f9;font-size:12.5px}.sa .lg div:first-child{border:0}' +
      '.sa .ch{display:inline-block;border-radius:7px;padding:1px 7px;font-size:11.5px;font-weight:700;margin:2px 3px 0 0}' +
      '.sa .res{margin-top:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font-size:12.5px;max-height:230px;overflow:auto;display:none}.sa .res.on{display:block}' +
      '.sa .res b{display:block;margin-top:6px}.sa .note{font-size:12px;color:#92400e;background:#fffbeb;border-radius:10px;padding:7px 10px;margin-top:10px}' +
      '@media(max-width:640px){.sa .fl{grid-template-columns:1fr 1fr}}';
    document.head.appendChild(st);
  }
  function fmtAt(t) { try { return new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function chips(l) {
    if (l.none) return '<span style="color:#94a3b8">ไม่มีไฟล์ใหม่</span>';
    var C2 = function (n, t, bg, fg) { return n ? '<span class="ch" style="background:' + bg + ';color:' + fg + '">' + t + ' ' + n + '</span>' : ''; };
    return '<b>' + esc((l.files || []).join(', ')) + '</b>' + (l.dry ? ' <small>(ทดลอง)</small>' : '') + '<br>' +
      C2(l.codes, 'สถานะงาน', '#fef9c3', '#854d0e') + C2(l.closed, 'ปิดงาน', '#dcfce7', '#166534') + C2(l.down, 'รอ Admin', '#f1f5f9', '#475569') +
      C2(l.other, 'SAP ปิด/CCL ยังไม่ถึง', '#ede9fe', '#5b21b6') + C2(l.nf, 'ไม่พบ', '#fee2e2', '#991b1b') +
      (!l.codes && !l.closed && !l.down && !l.other && !l.nf ? '<span class="ch" style="background:#f0fdf4;color:#166534">ตรงกันทุกงาน</span>' : '');
  }
  function autoHtml(d) {
    var c = d.cfg, ad = d.admin, dis = ad ? '' : ' disabled';
    var sw = function (k, t, sub) { return '<div class="rw"><div class="l">' + t + '<small>' + sub + '</small></div><label class="sw"><input type="checkbox" data-k="' + k + '"' + (c[k] ? ' checked' : '') + dis + '><span></span></label></div>'; };
    var hrs = ''; for (var h = 5; h <= 20; h++) hrs += '<option value="' + h + '"' + (c.hour === h ? ' selected' : '') + '>ทุกวัน ' + (h < 10 ? '0' : '') + h + ':00 น.</option>';
    return '<div class="sa">' +
      '<div class="fl"><div><b>① วางไฟล์</b>export จาก SAP วางในโฟลเดอร์ Drive</div><div><b>② ตรวจทุกวัน</b>อ่านเฉพาะไฟล์ใหม่ เทียบทุกงาน</div><div><b>③ อัปเดตให้เอง</b>สถานะงาน · ปิดงาน CLSD + เติมขั้นที่ข้าม</div><div><b>④ สรุปเข้า LINE</b>ไฟล์ที่อ่านแล้วย้ายไป "อ่านแล้ว"</div></div>' +
      '<div class="rw" style="border:0"><div class="l"><b>สถานะ</b></div><span class="sabd" style="background:' + (c.on && d.trigger ? '#dcfce7;color:#166534">● เปิดใช้งาน' : '#f1f5f9;color:#64748b">○ ปิดอยู่') + '</span></div>' +
      '<div class="rw"><div class="l">เปิดใช้งานอัตโนมัติ<small>ตรวจโฟลเดอร์ทุกวันตามเวลาที่ตั้ง</small></div><label class="sw"><input type="checkbox" data-k="on"' + (c.on ? ' checked' : '') + dis + '><span></span></label></div>' +
      '<div class="rw"><div class="l">โฟลเดอร์ที่ตรวจ<small>วางไฟล์ .xlsx ที่มีคอลัมน์ "องค์ประกอบ WBS"/"หมายเลขงาน" + "สถานะ" · ชื่อไฟล์อะไรก็ได้</small></div></div>' +
      '<div class="fd">📁 <b>' + (d.folderUrl ? 'CCL-SAP (Google Drive)' + (d.waiting ? ' · <span style="color:#b45309">รออ่าน ' + d.waiting + ' ไฟล์</span>' : '') : '<span style="color:#94a3b8">ยังไม่ได้สร้าง — กดบันทึกเพื่อสร้างโฟลเดอร์</span>') + '</b>' +
        (d.folderUrl ? '<a class="bt" href="' + esc(d.folderUrl) + '" target="_blank" rel="noopener">เปิดโฟลเดอร์</a>' : '') + '</div>' +
      '<div class="rw"><div class="l">เวลาตรวจ</div><select data-k="hour" class="bt"' + dis + '>' + hrs + '</select></div>' +
      sw('updCodes', 'อัปเดตสถานะงาน (Job Code) ตาม SAP', 'ถ้าเป็นการลดลง (เช่น D1 → C1) จะไม่ทำเอง แต่แจ้งให้ Admin ยืนยัน') +
      sw('closeClsd', 'ปิดงานที่ SAP เป็น CLSD', 'เฉพาะ CLSD (TECO ไม่ปิด) · เติมขั้นที่ข้าม + ผลตรวจรับลงไทม์ไลน์') +
      sw('onlySent', 'ปิดเฉพาะงานที่อยู่ "ส่งปิดงาน" แล้ว', 'ถ้าเปิด: งานขั้นอื่นที่ SAP ปิดแล้วจะแค่แจ้งเตือน ไม่ปิดเอง') +
      sw('line', 'ส่งสรุปเข้า LINE', 'ส่งทุกครั้งที่อ่านไฟล์ใหม่ (ใช้กลุ่ม LINE เดียวกับแจ้งเตือนของ CCL)') +
      '<div class="acts">' + (ad ? '<button class="bt" data-a="dry">ทดลองอ่านไฟล์ (ไม่บันทึก)</button><button class="bt v" data-a="run">▶ ตรวจเดี๋ยวนี้</button><button class="bt g" data-a="save">บันทึกการตั้งค่า</button>'
        : '<span style="font-size:12.5px;color:#92400e">🔒 เฉพาะ Admin แก้การตั้งค่าและสั่งตรวจได้</span>') + '</div>' +
      '<div class="res" id="saRes"></div>' +
      '<h4>🕘 ประวัติการนำเข้า</h4><div class="lg">' + (d.log && d.log.length ? d.log.map(function (l) { return '<div><span style="color:#64748b">' + fmtAt(l.at) + '</span><span>' + chips(l) + (l.by ? ' <small style="color:#94a3b8">· ' + esc(l.by) + '</small>' : '') + '</span></div>'; }).join('') : '<div><span></span><span style="color:#94a3b8">ยังไม่มีประวัติ</span></div>') + '</div>' +
      '<div class="note">💡 ต้องมีคน export ไฟล์จาก SAP มาวางในโฟลเดอร์ (ระบบเข้า SAP ตรงไม่ได้) · การนำเข้าด้วยมือด้านบนยังใช้ได้เหมือนเดิม</div></div>';
  }
  function resHtml(r) {
    if (r.none) return '📂 ไม่มีไฟล์ใหม่ในโฟลเดอร์';
    var L = r.list || {}, sec = function (a, t, col) { return a && a.length ? '<b style="color:' + col + '">' + t + ' ' + a.length + ' งาน</b>' + a.slice(0, 40).map(esc).join(' · ') + (a.length > 40 ? ' …' : '') : ''; };
    return (r.dry ? '🧪 <b style="display:inline">ทดลองอ่าน — ยังไม่บันทึกอะไร</b>' : '✅ <b style="display:inline">บันทึกแล้ว</b>') + '<br>ไฟล์: ' + esc((r.files || []).join(', ')) + ' (' + (r.rows || 0) + ' แถว)' +
      sec(L.codes, '🔄 อัปเดตสถานะงาน', '#854d0e') + sec(L.closed, '✅ ปิดงาน', '#166534') + sec(L.down, '⚠️ สถานะลดลง (ไม่ทำเอง)', '#475569') +
      sec(L.other, '📌 SAP ปิดแล้ว แต่ CCL ยังไม่ถึงส่งปิดงาน', '#5b21b6') + sec(L.nf, '❓ ไม่พบหมายเลขงานใน SAP', '#991b1b') +
      (!r.codes && !r.closed && !r.down && !r.other && !r.nf ? '<b style="color:#166534">✔ ข้อมูล CCL ตรงกับ SAP ทุกงาน</b>' : '');
  }
  function autoPanel() {
    if (!window.Swal) return;
    busy('กำลังโหลดการตั้งค่า…');
    google.script.run.withSuccessHandler(function (d) { AUTO = d; autoCss(); showAuto(d); })
      .withFailureHandler(function (e) { alertMsg('error', 'โหลดการตั้งค่าไม่ได้', (e && e.message) || String(e)); }).cclSapAutoGet();
  }
  function showAuto(d) {
    Swal.fire({ title: '⚙️ นำเข้าสถานะ SAP อัตโนมัติ', html: autoHtml(d), width: 720, showConfirmButton: false, showCloseButton: true,
      didOpen: function (el) {
        var box = Swal.getHtmlContainer(), res = box.querySelector('#saRes');
        var read = function () { var o = {}; box.querySelectorAll('[data-k]').forEach(function (i) { o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value; }); return o; };
        box.querySelectorAll('[data-a]').forEach(function (b) {
          b.onclick = function () {
            var a = b.dataset.a; box.querySelectorAll('[data-a]').forEach(function (x) { x.disabled = true; });
            var done = function () { box.querySelectorAll('[data-a]').forEach(function (x) { x.disabled = false; }); };
            var fail = function (e) { res.className = 'res on'; res.innerHTML = '<span style="color:#b91c1c">❌ ' + esc((e && e.message) || String(e)) + '</span>'; done(); };
            res.className = 'res on'; res.innerHTML = a === 'save' ? '⏳ กำลังบันทึก…' : '⏳ กำลังอ่านไฟล์และเทียบกับทุกงาน… (อาจใช้เวลา 10–30 วินาที)';
            if (a === 'save') google.script.run.withSuccessHandler(function (d2) { AUTO = d2; showAuto(d2); setTimeout(function () { var r2 = Swal.getHtmlContainer().querySelector('#saRes'); if (r2) { r2.className = 'res on'; r2.innerHTML = '✅ บันทึกแล้ว' + (d2.cfg.on ? ' · จะตรวจทุกวัน ' + d2.cfg.hour + ':00 น.' : ' · ปิดการตรวจอัตโนมัติ'); } }, 50); }).withFailureHandler(fail).cclSapAutoSet(read());
            else google.script.run.withSuccessHandler(function (r) { res.innerHTML = resHtml(r); done(); if (!r.dry && !r.none) { try { loadData(); } catch (e) {} } }).withFailureHandler(fail).cclSapAutoRun(a === 'dry');
          };
        });
      } });
  }

  function bulkClose(given, other) {
    var all = g('allData', []) || [], ids = Object.keys(C.sel).map(Number);
    var list = Array.isArray(given) ? given.slice() : all.filter(function (j) { return ids.indexOf(j.id) >= 0 && j.status === 'ส่งปิดงาน'; });
    if (!list.length || !window.Swal) return;
    Swal.fire({
      icon: 'question', title: 'ปิดงาน ' + list.length + ' งาน?', width: 600,
      html: '<div style="text-align:left;font-size:13.5px"><div style="background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:8px 12px;margin-bottom:8px">งานจะย้ายไปเมนู <b>"งานแล้วเสร็จ"</b> (เหมือนกดปิดงานทีละงาน)</div>' +
        '<div style="max-height:40vh;overflow:auto">' + list.map(function (j) { return '<div style="padding:5px 2px;border-bottom:1px solid #f1f5f9"><b style="color:#1d4ed8">' + esc(j.receiveNo || '-') + '</b> ' + esc(j.jobName || '') + ' <small style="color:#059669">SAP: ' + esc((sapOf(j) || {}).k || '-') + '</small>' + (other ? ' <small style="color:#b45309">· CCL: ' + esc(j.status || '-') + '</small>' : '') + '</div>'; }).join('') + '</div></div>',
      showCancelButton: true, confirmButtonText: 'ยืนยัน ปิดงาน ' + list.length + ' งาน', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#059669'
    }).then(function (r) {
      if (!r.isConfirmed) return;
      var done = 0, errs = [], user = g('currentUser', null);
      if (isAdm()) {
        busy('กำลังปิดงาน ' + list.length + ' งาน…');
        google.script.run.withSuccessHandler(function (res) {
          list.forEach(function (j) { delete C.sel[j.id]; });
          Swal.fire({ icon: res && res.skip ? 'warning' : 'success', title: 'ปิดงานแล้ว ' + ((res && res.done) || 0) + ' งาน',
            html: 'เติมขั้นตอนที่ข้ามและผลตรวจรับลงไทม์ไลน์ให้แล้ว' + (res && res.skip ? '<br><small style="color:#b45309">ข้าม ' + res.skip + ' งาน (ปิดไปแล้วหรือถูกยกเลิก)</small>' : '') })
            .then(function () { try { loadData(); } catch (e) {} });
        }).withFailureHandler(function (e) { alertMsg('error', 'ปิดงานไม่สำเร็จ', (e && e.message) || String(e)); })
          .cclSapClose(list.map(function (j) { return j.id; }));
        return;
      }
      Swal.fire({ title: 'กำลังปิดงาน… 0/' + list.length, allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });
      list.reduce(function (p, j) {
        return p.then(function () {
          return new Promise(function (ok) {
            google.script.run.withSuccessHandler(function () { done++; delete C.sel[j.id]; ok(); })
              .withFailureHandler(function (e) { errs.push((j.receiveNo || j.id) + ': ' + ((e && e.message) || e)); ok(); })
              .updateWorkStatus(j.id, 'ปิดงานแล้วเสร็จ', user);
          }).then(function () { var t = Swal.getTitle(); if (t) t.textContent = 'กำลังปิดงาน… ' + (done + errs.length) + '/' + list.length; });
        });
      }, Promise.resolve()).then(function () {
        Swal.fire({ icon: errs.length ? 'warning' : 'success', title: 'ปิดงานแล้ว ' + done + ' งาน',
          html: errs.length ? '<div style="text-align:left;font-size:13px;color:#b91c1c">ไม่สำเร็จ ' + errs.length + ' งาน:<br>' + errs.map(esc).join('<br>') + '</div>' : 'งานย้ายไปเมนู "งานแล้วเสร็จ" แล้ว', confirmButtonText: 'ตกลง' })
          .then(function () { try { loadData(); } catch (e) {} });
      });
    });
  }

  window.cclCloseGo = function (st) { C.st = C.sap ? ({ closed: 'clsd' }[st] || st || '') : ''; try { showPage('close'); } catch (e) {} window.renderCloseTable(); window.scrollTo(0, 0); };
  window.cclSapClosedCount = function () { return (g('allData', []) || []).filter(function (j) { return j.status === 'ส่งปิดงาน' && isClosed(sapOf(j)); }).length; };
  window.cclSapInfo = function () { return C.sap ? { file: C.sap.file, at: C.sap.at } : null; };
  window.renderCloseTable = function () { try { render(); } catch (e) { console.error('[close-ui]', e); } };
  function boot() { var d = g('allData', null); if (Array.isArray(d) && d.length) window.renderCloseTable(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
