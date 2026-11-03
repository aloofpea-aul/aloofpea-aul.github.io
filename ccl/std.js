/* CCL — ตรวจมาตรฐาน (FM.กมฟ.01-59-00) แบบใหม่
   - โหลดผลที่บันทึกไว้กลับมาทุกครั้ง (เดิมเปิดซ้ำแล้วว่าง) และเก็บข้อมูลหัวฟอร์มด้วย
   - ปุ่ม ✓ / ✗ / — ใหญ่ กดง่ายบนมือถือ, เลือกเฉพาะส่วนที่งานนั้นมี, แนบรูปข้อที่ต้องแก้
   - สรุปผ่าน/ไม่ผ่านให้เอง, เลือกผู้ตรวจจากคณะกรรมการตรวจมาตรฐาน
   - ไม่ผ่าน → รอบถัดไปเปิดมาเห็นเฉพาะข้อที่ต้องแก้ (ตรวจซ้ำ) ประวัติแต่ละรอบเก็บไว้
   - พิมพ์ใบ FM.กมฟ.01-59-00 ตามแบบฟอร์ม Excel ต้นฉบับ (แม่แบบ ccl/fm-tpl.js)
   ใช้คอลัมน์ข้อมูลเดิม (saveStdFormData / getStdFormData) — ไม่ต้องแก้หลังบ้าน */
(function () {
  'use strict';

  var SEC = [
    { k: 'ht', t: '1. ระบบจำหน่ายแรงสูง', s: 'แรงสูง' },
    { k: 'lt', t: '2. ระบบจำหน่ายแรงต่ำ', s: 'แรงต่ำ' },
    { k: 'tr', t: '3. การติดตั้งหม้อแปลง', s: 'หม้อแปลง' }
  ];
  var META_F = ['jobType', 'approveNo', 'approveDate', 'jobNo', 'htQty', 'htPole', 'ltQty', 'ltPole', 'station', 'feeder', 'phase', 'trTotal',
    'tr', 'trPhase', 'trType', 'supervisor', 'supPosition', 'supDept', 'inspector', 'inspPosition', 'inspDate', 'supSign', 'supDate',
    'fixSupDate', 'fixInspPos', 'fixHead', 'fixHeadDate'];

  /* รายการตรวจตรงตามแบบฟอร์ม FM.กมฟ.01-59-00 (ไฟล์ Excel ต้นฉบับ) — row = แถวในแบบฟอร์ม
     head = หัวข้อที่ไม่มีช่องผล, sub = ข้อย่อยที่มีช่องผลของตัวเอง, ohm = ช่องค่าความต้านทานดิน, other = ระบุรายการอื่นๆ */
  function I(k, t, row, o) { var x = { k: k, t: t, row: row }; for (var p in (o || {})) x[p] = o[p]; return x; }
  var ITEMS = {
    ht: [I('ht_0', '1.1 การปักเสา, เสาตอม่อ (ความลึก, แนวเสา, หน้าเสา)', 14), I('ht_1', '1.2 การติดตั้งคอน ลูกถ้วย และประกอบบอนด์ไวร์', 15),
      I('ht_2', '1.3 การติดตั้งเหล็กรับสายล่อฟ้า (เหล็กฉาก, เหล็กรูปรางน้ำ)', 16), I('ht_3', '1.4 การฝังสมอบก และประกอบยึดโยงระบบจำหน่าย', 17),
      I('ht_4', '1.5 การฝังสมอบก และประกอบยึดโยงสายล่อฟ้า', 18), I('ht_5', '1.6 การพาดสายไฟ ระยะหย่อนยาน', 19), I('ht_6', '1.7 การพาดสายล่อฟ้า ระยะหย่อนยาน', 20),
      I('ht_7', '1.8 ระยะห่าง ความสูงของสายไฟ', 21, { head: 1 }),
      I('ht_7a', 'ข้ามถนน >6.1 ม., ข้ามทางหลวง 22kV >7.5 ม., ข้ามทางหลวง 33kV >9 ม.', 22, { sub: 1 }), I('ht_7b', 'ข้ามทางรถไฟ >9 ม.', 24, { sub: 1 }),
      I('ht_7c', 'ระยะห่างสายด้านข้างกับสิ่งก่อสร้างต่างๆ', 25, { sub: 1 }), I('ht_7d', 'ระยะห่างระบบจำหน่ายแรงสูง กับสายส่ง', 26, { sub: 1 }),
      I('ht_7e', 'ระยะห่างระบบจำหน่ายแรงสูง กับแรงต่ำ', 27, { sub: 1 }),
      I('ht_8', '1.9 การพันและผูกลูกถ้วย', 28), I('ht_9', '1.10 การต่อสาย พันเทป (สายหุ้มฉนวน)', 29), I('ht_10', '1.11 การเชื่อมสาย, แยกสาย พันเทป (สายหุ้มฉนวน)', 30),
      I('ht_11', '1.12 การเข้าปลายสาย', 31), I('ht_12', '1.13 การตัดต้นไม้', 32), I('ht_13', '1.14 การทาสีเสา', 33), I('ht_14', '1.15 การพ่นสี หมายเลขเสา', 34),
      I('ht_15', '1.16 การยึดโยง (storm guy, line guy, fix guy, etc)', 35), I('ht_16', '1.17 การต่อลงดิน', 39),
      I('ht_16a', 'ค่าความต้านทานดิน', 40, { sub: 1, ohm: 2 }), I('ht_17', '1.18 การติดตั้งกับดักเสิร์จแรงสูง', 41), I('ht_18', '1.19 อื่นๆ', 42, { other: 1 })],
    lt: [I('lt_0', '2.1 การปักเสา, เสาตอม่อ (ความลึก, แนวเสา, หน้าเสา)', 44), I('lt_1', '2.2 การติดตั้งคอน แร็ก', 45), I('lt_2', '2.3 การฝังสมอบก และประกอบยึดโยง', 46),
      I('lt_3', '2.4 การพาดสายไฟ ระยะหย่อนยาน', 47), I('lt_4', '2.5 ระยะห่าง, ความสูงของสายไฟ', 48),
      I('lt_4a', 'ข้ามถนน >5.5 ม., ข้ามทางหลวง >6.0 ม.', 49, { sub: 1 }), I('lt_4b', 'ข้ามทางรถไฟ >7 ม.', 50, { sub: 1 }),
      I('lt_4c', 'ระยะห่างสายด้านข้างกับสิ่งก่อสร้างต่างๆ', 51, { sub: 1 }),
      I('lt_5', '2.6 การผูกสายไฟกับลูกรอกแรงต่ำ', 52), I('lt_6', '2.7 การต่อสาย พันเทป', 53), I('lt_7', '2.8 การเชื่อมสาย แยกสาย พันเทป', 54),
      I('lt_8', '2.9 การเข้าปลายสาย พันเทป', 55), I('lt_9', '2.10 การติดตั้งกับดักเสิร์จแรงต่ำ พันเทป', 56), I('lt_10', '2.11 การทาสีเสา', 57),
      I('lt_11', '2.12 การพ่นสี หมายเลขเสา', 58), I('lt_12', '2.13 การยึดโยง (storm guy, line guy, fix guy, etc)', 59), I('lt_13', '2.14 การต่อลงดิน', 60),
      I('lt_14', '2.15 ค่าความต้านทานดินรวม', 61, { ohm: 1 }), I('lt_15', '2.16 อื่นๆ', 62, { other: 1 })],
    tr: [I('tr_tr', 'หม้อแปลง TR / Ø / kva และแบบการติดตั้ง', 64, { trline: 1 }),
      I('tr_0', '3.1 การติดตั้งหม้อแปลง (ระยะความสูง, ทิศทาง)', 66), I('tr_1', '3.2 การติดตั้งคอน ลูกถ้วย และประกอบบอนด์ไวร์', 67),
      I('tr_2', '3.3 การพาดสายแรงสูงเข้าหม้อแปลง และลำดับเฟส', 68), I('tr_3', '3.4 การผูกสายไฟกับลูกถ้วย', 69), I('tr_4', '3.5 การติดตั้งกับดักเสิร์จแรงสูง หางปลา', 70),
      I('tr_5', '3.6 การติดตั้งดร็อปเอาต์ พินเทอร์มินอลและฟิวส์ลิงก์', 71), I('tr_6', '3.7 การติดตั้งคอนสปัน 3,200 มม. ระยะความสูง', 72),
      I('tr_7', '3.8 การเข้าสายที่บุชชิ่งหม้อแปลง, หางปลา, ฉนวนครอบบุชชิ่ง', 76), I('tr_8', '3.9 การติดตั้งสายแรงต่ำ และลำดับเฟส', 77),
      I('tr_9', '3.10 การติดตั้งกับดักเสิร์จแรงต่ำ พันเทป', 78), I('tr_10', '3.11 การติดตั้งคอนสำหรับ LT, LT สวิตช์และฟิวส์แรงต่ำ', 79),
      I('tr_11', '3.12 การติดตั้งที่จับขอบถัง, เหล็กแขวน ท่อร้อยสายแรงต่ำ', 80), I('tr_12', '3.13 เทคอนกรีตที่คาน, โคนเสา', 81), I('tr_13', '3.14 การต่อลงดิน', 82),
      I('tr_13a', 'ตัวถังหม้อแปลง', 83, { sub: 1 }), I('tr_13b', 'สายกราวด์ด้านแรงสูง', 84, { sub: 1 }), I('tr_13c', 'สายกราวด์ด้านแรงต่ำ', 85, { sub: 1 }),
      I('tr_14', '3.15 ค่าความต้านทานดิน', 86, { ohm: 2 }), I('tr_15', '3.16 อื่นๆ', 87, { other: 1 })]
  };
  // ข้อมูลรุ่นก่อน: ข้อแม่มีผลเดียว → ใช้ผลนั้นกับข้อย่อย
  var LEGACY = [['ht_7', ['ht_7a', 'ht_7b', 'ht_7c', 'ht_7d', 'ht_7e']], ['ht_16', ['ht_16a']], ['lt_4', ['lt_4a', 'lt_4b', 'lt_4c']], ['tr_13', ['tr_13a', 'tr_13b', 'tr_13c']]];
  (function () {   // ป้ายชื่อเต็มสำหรับสรุป/ประวัติ เช่น "1.8 ข้ามทางรถไฟ >9 ม."
    Object.keys(ITEMS).forEach(function (sk) {
      var parent = '';
      ITEMS[sk].forEach(function (x) { if (!x.sub) parent = x.t.split(' ')[0]; x.label = x.sub ? parent + ' ' + x.t : x.t; });
    });
  })();
  function resItems(sk) { return ITEMS[sk].filter(function (x) { return !x.head; }); }
  function itemOf(k) { var f = null; Object.keys(ITEMS).forEach(function (sk) { ITEMS[sk].forEach(function (x) { if (x.k === k) f = x; }); }); return f; }

  var S = null;           // สถานะฟอร์มที่เปิดอยู่
  var QUEUE = [];         // คิวงานจากแผนที่ (ตรวจหลายงานต่อกัน)

  function jobs() { return (typeof allData !== 'undefined' && allData) ? allData : []; }
  function me() { return (typeof currentUser !== 'undefined' && currentUser) ? currentUser : {}; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function thDate(d) { if (!d) return ''; var x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }); }
  function title1(t) { return String(t).split('\n')[0]; }
  function run() { return google.script.run; }
  function committee() {
    var m = (typeof _stdCommitteeCache !== 'undefined' && _stdCommitteeCache) ? _stdCommitteeCache : [];
    return m.map(function (x) {
      if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = { name: x }; } }
      return { name: (x && x.name) || '', position: (x && x.position) || '' };
    }).filter(function (x) { return x.name; });
  }
  function hasTransformer(job) { var t = String(job.transformerRaw || '').trim(); return !!t && t !== '-'; }
  function lastStd(job) {
    var e = (job.jobTimeline || []).slice().reverse().find(function (h) { return h.status === 'ตรวจมาตรฐาน'; });
    if (!e || !e.details) return '';
    return e.details.indexOf('ไม่ผ่าน') >= 0 ? 'fail' : (e.details.indexOf('ผ่านการตรวจมาตรฐาน') >= 0 ? 'pass' : '');
  }

  // ───── สไตล์ ─────
  function css() {
    if ($('sxCss')) return;
    var st = document.createElement('style'); st.id = 'sxCss';
    st.textContent = [
      '#sx{position:fixed;inset:0;z-index:95;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;font-family:inherit}',
      '#sx .sx-box{background:#f8fafc;width:100%;max-width:760px;height:100%;max-height:96vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}',
      '@media(max-width:767px){#sx .sx-box{max-height:none;border-radius:0}}',
      '#sx .sx-hd{background:#0f766e;color:#fff;padding:12px 14px;display:flex;gap:10px;align-items:center;flex-shrink:0}',
      '#sx .sx-hd h3{font-size:16px;font-weight:700;margin:0;line-height:1.3}',
      '#sx .sx-hd small{display:block;font-size:12px;opacity:.85;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '#sx .sx-ic{width:36px;height:36px;border-radius:999px;border:0;background:rgba(255,255,255,.15);color:#fff;font-size:16px;cursor:pointer;flex-shrink:0}',
      '#sx .sx-bd{flex:1;overflow-y:auto;padding:12px 14px 20px;-webkit-overflow-scrolling:touch}',
      '#sx .sx-ft{flex-shrink:0;display:flex;gap:8px;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e2e8f0}',
      '#sx .sx-btn{flex:1;min-height:44px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-weight:700;font-size:14px;cursor:pointer;padding:0 10px}',
      '#sx .sx-btn.pri{background:#0f766e;border-color:#0f766e;color:#fff}',
      '#sx .sx-btn.blue{background:#1e40af;border-color:#1e40af;color:#fff}',
      '#sx .sx-btn:disabled{opacity:.45;cursor:not-allowed}',
      '#sx .sx-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px}',
      '#sx .sx-lb{font-size:12px;color:#64748b;margin:0 0 4px;font-weight:600}',
      '#sx .sx-in{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px;font-size:14px;background:#fff;color:#0f172a;box-sizing:border-box}',
      '#sx textarea.sx-in{min-height:56px;resize:vertical}',
      '#sx .sx-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}',
      '#sx .sx-chips{display:flex;flex-wrap:wrap;gap:6px}',
      '#sx .sx-chip{min-height:38px;padding:0 14px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:13px;font-weight:600;cursor:pointer}',
      '#sx .sx-chip.on{background:#ccfbf1;border-color:#14b8a6;color:#0f766e}',
      '#sx .sx-prog{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;margin:6px 0 2px}',
      '#sx .sx-prog i{display:block;height:100%;background:#14b8a6;border-radius:4px;transition:width .2s}',
      '#sx .sx-sec{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:14px 0 8px}',
      '#sx .sx-sec b{font-size:15px;color:#0f172a}',
      '#sx .sx-all{min-height:34px;padding:0 10px;border-radius:8px;border:1px solid #86efac;background:#f0fdf4;color:#15803d;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}',
      '#sx .sx-it{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}',
      '#sx .sx-it.f{border-color:#fca5a5;background:#fff7f7}',
      '#sx .sx-it.p{border-color:#bbf7d0}',
      '#sx .sx-it .t{font-size:14px;color:#0f172a;line-height:1.45}',
      '#sx .sx-it .sub{font-size:12px;color:#64748b;white-space:pre-line;line-height:1.45;margin-top:2px}',
      '#sx .sx-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px}',
      '#sx .sx-3.two{grid-template-columns:1fr 1fr}',
      '#sx .sx-o{min-height:44px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:14px;font-weight:700;cursor:pointer}',
      '#sx .sx-o.ok{background:#16a34a;border-color:#16a34a;color:#fff}',
      '#sx .sx-o.ng{background:#dc2626;border-color:#dc2626;color:#fff}',
      '#sx .sx-o.na{background:#64748b;border-color:#64748b;color:#fff}',
      '#sx .sx-more{margin-top:8px;display:grid;gap:6px}',
      '#sx .sx-link{background:none;border:0;color:#0f766e;font-size:13px;font-weight:600;cursor:pointer;padding:6px 0;text-align:left}',
      '#sx .sx-ph{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '#sx .sx-ph a img{width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;display:block}',
      '#sx .sx-res{border-radius:12px;padding:12px;margin-bottom:10px;font-weight:700}',
      '#sx .sx-res.ok{background:#dcfce7;color:#166534}',
      '#sx .sx-res.ng{background:#fee2e2;color:#991b1b}',
      '#sx .sx-res.wait{background:#fef3c7;color:#92400e}',
      '#sx .sx-res small{display:block;font-weight:500;font-size:12px;margin-top:2px}',
      '#sx .sx-note{font-size:12px;color:#64748b;line-height:1.5}',
      '#sx .sx-rd{display:flex;gap:16px;flex-wrap:wrap;font-size:14px}',
      '#sx .sx-rd label{display:flex;gap:6px;align-items:center;min-height:36px;cursor:pointer}',
      '#sx details summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '#sx details summary::-webkit-details-marker{display:none}',
      '#sx .sx-hist{font-size:12px;color:#475569;border-left:3px solid #cbd5e1;padding:2px 0 2px 8px;margin:6px 0}',
      '#sx .sx-it.sub{margin-left:18px}#sx .sx-dash{color:#94a3b8}',
      '#sx .sx-grp{font-size:14px;color:#0f172a;font-weight:600;margin:10px 0 6px}',
      '#sx .sx-cm{display:grid;grid-template-columns:28px 1fr 1fr;gap:6px;align-items:center;margin-bottom:6px}#sx .sx-cm b{color:#64748b;font-size:13px;text-align:center}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ───── เปิดฟอร์ม ─────
  function open(jobId, opts) {
    opts = opts || {};
    var job = jobs().find(function (j) { return String(j.id) === String(jobId); });
    if (!job) { if (window.Swal) Swal.fire({ icon: 'error', title: 'ไม่พบงาน' }); return; }
    css();
    shell('<div style="padding:40px 0;text-align:center;color:#64748b"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดผลตรวจที่บันทึกไว้…</div>', job, '');
    run().withSuccessHandler(function (r) {
      var raw = (r && r.data) || '{}', obj = {};
      try { obj = JSON.parse(raw) || {}; } catch (e) { obj = {}; }
      init(job, obj, opts); render();
    }).withFailureHandler(function (e) {
      shell('<div class="sx-res ng">โหลดข้อมูลไม่สำเร็จ<small>' + esc(e && e.message || e) + '</small></div>', job, '');
    }).getStdFormData(job.id);
  }

  function init(job, obj, opts) {
    opts = opts || {};
    var data = {}, meta = obj._meta || {}, rounds = obj._rounds || [];
    SEC.forEach(function (s) {
      resItems(s.k).forEach(function (x) {
        var v = obj[x.k] || {};
        data[x.k] = { result: v.result || '', detail: v.detail || '', remark: v.remark || '', photos: v.photos || [], fixed: v.fixed || '',
          ohm1: v.ohm1 || '', ohm2: v.ohm2 || '', other: v.other || '' };
      });
    });
    LEGACY.forEach(function (L) {
      var pv = obj[L[0]]; if (!pv || !pv.result) return;
      L[1].forEach(function (sk, i) {
        if (obj[sk] !== undefined) return;
        data[sk].result = pv.result; if (pv.fixed) data[sk].fixed = pv.fixed;
        if (i === 0 && pv.detail && pv.result === 'fail') data[sk].detail = pv.detail;
      });
    });
    var anySaved = Object.keys(data).some(function (k) { return data[k].result; });
    var sections = meta.sections;
    if (!sections) {
      sections = {};
      SEC.forEach(function (s) {
        var used = resItems(s.k).some(function (x) { var r = data[x.k].result; return r && r !== 'na'; });
        sections[s.k] = anySaved ? used : (s.k === 'tr' ? hasTransformer(job) : true);
      });
      if (anySaved && !sections.ht && !sections.lt && !sections.tr) { sections = { ht: true, lt: true, tr: hasTransformer(job) }; }
    }
    // งานที่ตรวจไม่ผ่านแล้ว → รอบใหม่เป็นการตรวจซ้ำ
    // ผลล่าสุด: จากข้อมูลฟอร์ม ถ้าไม่มี (ข้อมูลเก่า) ดูจากประวัติงาน
    var last = meta.result || (meta.draft ? '' : lastStd(job));
    var round = meta.round || rounds.length || 1;
    var recheck = !!(meta.draft && meta.recheck);          // ร่างของการตรวจซ้ำ → ทำต่อรอบเดิม
    var fails = recheck ? (meta.recheckKeys || []) : [];
    var newRound = false;
    if (!opts.view && !meta.draft && last === 'fail') {                    // ตรวจไม่ผ่านแล้ว → เริ่มตรวจซ้ำรอบใหม่
      fails = Object.keys(data).filter(function (k) { return data[k].result === 'fail'; });
      if (fails.length) {
        recheck = true; newRound = true; round = (meta.round || rounds.length || 1) + 1;
        fails.forEach(function (k) { data[k].result = ''; data[k].fixed = ''; });   // ให้เลือกใหม่ว่าแก้แล้วหรือยัง
      }
    }
    if (recheck && !fails.length) recheck = false;
    var m = {};
    META_F.forEach(function (f) { m[f] = meta[f] || ''; });
    m.committee = (meta.committee || []).map(function (x) { return { name: x.name || '', position: x.position || '' }; });
    if (!m.committee.length && m.inspector) m.committee = [{ name: m.inspector, position: m.inspPosition || '' }];
    if (newRound) { m.inspDate = ''; m.fixSupDate = ''; m.fixInspPos = ''; m.fixHead = ''; m.fixHeadDate = ''; }
    var self = /ไฟฟ้าดำเนินการเอง|กฟภ/.test(String(job.responsibleEntity || ''));
    if (!m.jobType) m.jobType = (job.responsibleEntity && job.responsibleEntity !== '-') ? (self ? 'self' : 'contractor') : '';
    if (!m.jobNo) m.jobNo = job.jobIds || '';
    if (!m.supervisor) m.supervisor = job.assignee || '';
    if (!m.supSign) m.supSign = m.supervisor;
    // ข้อมูลรุ่นเก่าไม่มีชื่อผู้ตรวจ/วันที่ในฟอร์ม → อ่านจากประวัติงาน ("ผู้ตรวจ: X · วันที่: Y")
    if (!newRound && (!m.inspector || !m.inspDate)) {
      var le = (job.jobTimeline || []).slice().reverse().find(function (h) { return h.status === 'ตรวจมาตรฐาน'; });
      if (le && le.details) {
        var pi = /ผู้ตรวจ:\s*([^·]+)/.exec(le.details), pd = /วันที่:\s*([^·\s]+)/.exec(le.details);
        if (!m.inspector && pi) m.inspector = pi[1].trim();
        if (!m.inspDate && pd) m.inspDate = pd[1].trim();
      }
    }
    if (opts.view) {   // ดูอย่างเดียว: ไม่เติมค่าที่ไม่มีจริง
      S = { job: job, data: data, meta: m, sections: sections, rounds: rounds, round: round, recheck: false, fails: [],
        lastResult: last, view: 'ro', ro: true, showAll: true, saving: false, dirty: false };
      return;
    }
    if (!m.inspDate) m.inspDate = today();
    if (!m.supDate) m.supDate = today();
    // คณะผู้ตรวจสอบ 3 คน ตามแบบฟอร์ม — ตั้งต้นจากรายชื่อคณะกรรมการตรวจมาตรฐานในหน้า Admin
    if (!m.committee.some(function (x) { return x.name; })) m.committee = committee().slice(0, 3);
    if (!m.committee.length) m.committee = [{ name: window._approverName || me().name || '', position: '' }];
    while (m.committee.length < 3) m.committee.push({ name: '', position: '' });
    m.committee = m.committee.slice(0, 3);
    if (recheck) {
      if (!m.supSign) m.supSign = m.supervisor;
      if (!m.fixSupDate) m.fixSupDate = m.inspDate;
      if (!m.fixInspPos) m.fixInspPos = m.committee[0].position;
      if (!m.fixHead) m.fixHead = window._approverName || '';
      if (!m.fixHeadDate) m.fixHeadDate = m.inspDate;
    }
    S = { job: job, data: data, meta: m, sections: sections, rounds: rounds, round: round, recheck: recheck, fails: fails,
      lastResult: last, view: opts.view ? 'ro' : 'items', ro: !!opts.view, showAll: !recheck, saving: false, dirty: false };
  }

  // ───── วาดหน้าจอ ─────
  function shell(body, job, foot) {
    var box = $('sx');
    if (!box) { box = document.createElement('div'); box.id = 'sx'; document.body.appendChild(box); document.documentElement.style.overflow = 'hidden'; }
    var q = QUEUE.length ? ' · คิว ' + (QUEUE.idx + 1) + '/' + QUEUE.length : '';
    var sub = job ? esc((job.receiveNo || '-') + ' · ' + (job.jobName || '')) : '';
    var rd = S && S.job === job ? (S.recheck ? ' · ตรวจซ้ำรอบที่ ' + S.round : (S.round > 1 ? ' · รอบที่ ' + S.round : '')) : '';
    box.innerHTML = '<div class="sx-box" role="dialog" aria-label="ตรวจมาตรฐาน">' +
      '<div class="sx-hd"><i class="fa-solid fa-star-half-stroke" style="font-size:18px"></i><div style="flex:1;min-width:0"><h3>' + (S && S.ro ? 'ใบตรวจมาตรฐาน (ดูอย่างเดียว)' : 'ตรวจมาตรฐาน' + esc(rd) + esc(q)) + '</h3><small>' + sub + '</small></div>' +
      (S && S.job === job && !S.ro && hasAnything() ? '<button class="sx-ic" data-a="print" title="พิมพ์ใบตรวจ" aria-label="พิมพ์"><i class="fa-solid fa-print"></i></button>' : '') +
      '<button class="sx-ic" data-a="close" title="ปิด" aria-label="ปิด"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="sx-bd" id="sxBody">' + body + '</div>' + (foot ? '<div class="sx-ft">' + foot + '</div>' : '') + '</div>';
    box.onclick = onClick; box.oninput = onInput; box.onchange = onChange;
  }

  function hasAnything() { return S && Object.keys(S.data).some(function (k) { return S.data[k].result; }); }

  function counts() {
    var done = 0, total = 0, fail = 0, unset = [];
    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      resItems(s.k).forEach(function (x) {
        var k = x.k, r = S.data[k].result;
        if (S.recheck && S.fails.indexOf(k) < 0) return;
        total++; if (r) done++; else unset.push(k); if (r === 'fail') fail++;
      });
    });
    return { done: done, total: total, fail: fail, unset: unset };
  }

  function render() {
    if (!S) return;
    var bd = $('sxBody'), keepTop = bd ? bd.scrollTop : 0;
    if (S.view === 'ro') renderView(); else if (S.view === 'sum') renderSum(); else renderItems();
    var nb = $('sxBody'); if (nb && S._keep) nb.scrollTop = keepTop; S._keep = false;
  }

  function f(name, label, ph, type) {
    return '<div><div class="sx-lb">' + label + '</div><input class="sx-in" data-m="' + name + '" type="' + (type || 'text') + '" value="' + esc(S.meta[name]) + '" placeholder="' + esc(ph || '') + '"></div>';
  }

  function renderItems() {
    var c = counts(), m = S.meta, h = '';
    if (S.recheck) {
      h += '<div class="sx-res wait">ตรวจซ้ำรอบที่ ' + S.round + ' — ตรวจเฉพาะข้อที่ไม่ผ่านรอบก่อน (' + S.fails.length + ' ข้อ)<small>กด "แก้ไขแล้ว" เมื่อผู้รับจ้างแก้ถูกต้อง ผลรอบก่อนเก็บไว้ในประวัติ</small></div>';
    }
    // ข้อมูลงาน
    var sumLine = [m.jobNo, m.supervisor ? 'ผู้ควบคุม ' + m.supervisor : '', m.jobType === 'self' ? 'กฟภ.ดำเนินการ' : m.jobType === 'contractor' ? 'งานจ้างบริษัท' : ''].filter(Boolean).join(' · ');
    h += '<details class="sx-card"' + (S.openInfo ? ' open' : '') + ' data-d="info"><summary><div style="min-width:0"><div class="sx-lb" style="margin:0">ข้อมูลงาน</div><div style="font-size:13px;color:#334155">' + esc(sumLine || 'แตะเพื่อกรอก') + '</div></div><span class="sx-link">แก้ไข <i class="fa-solid fa-chevron-down"></i></span></summary>' +
      '<div style="margin-top:10px" class="sx-rd"><label><input type="radio" name="sxType" value="self"' + (m.jobType === 'self' ? ' checked' : '') + '> กฟภ.ดำเนินการ</label><label><input type="radio" name="sxType" value="contractor"' + (m.jobType === 'contractor' ? ' checked' : '') + '> งานจ้างฯบริษัท</label></div>' +
      '<div class="sx-g" style="margin-top:6px">' + f('approveNo', 'อนุมัติเลขที่') + f('approveDate', 'ลงวันที่', '', 'date') + f('jobNo', 'หมายเลขงาน') +
      f('htQty', 'แรงสูง (วงจร-กม.)') + f('htPole', 'เสาแรงสูง (ต้น)') + f('ltQty', 'แรงต่ำ (วงจร-กม.)') + f('ltPole', 'เสาแรงต่ำ (ต้น)') +
      f('station', 'รับไฟจากสถานี') + f('feeder', 'ฟีดเดอร์') + f('phase', 'เฟสที่ต่อ') + f('trTotal', 'หม้อแปลงรวม (kVA)') +
      f('supervisor', 'ผู้ควบคุมงาน') + f('supPosition', 'ตำแหน่งผู้ควบคุมงาน') + f('supDept', 'สังกัด') + '</div></details>';
    // ส่วนที่ตรวจ
    if (!S.recheck) {
      h += '<div class="sx-card"><div class="sx-lb">งานนี้มีส่วนไหนบ้าง (ส่วนที่ไม่มีจะพิมพ์เป็น "—")</div><div class="sx-chips">' +
        SEC.map(function (s) { return '<button class="sx-chip' + (S.sections[s.k] ? ' on' : '') + '" data-a="sec" data-k="' + s.k + '">' + (S.sections[s.k] ? '<i class="fa-solid fa-check"></i> ' : '') + s.s + ' ' + resItems(s.k).length + ' ข้อ</button>'; }).join('') + '</div></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-top:4px"><span>ตรวจแล้ว <b>' + c.done + '/' + c.total + '</b></span>' + (c.fail ? '<span style="color:#dc2626;font-weight:700">ต้องแก้ไข ' + c.fail + '</span>' : '') + '</div>' +
      '<div class="sx-prog"><i style="width:' + (c.total ? Math.round(c.done * 100 / c.total) : 0) + '%"></i></div>';
    if (S.recheck) h += '<button class="sx-link" data-a="showall">' + (S.showAll ? 'แสดงเฉพาะข้อที่ต้องตรวจซ้ำ' : 'แสดงทุกข้อ (ดูอย่างเดียว)') + '</button>';

    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      var list = ITEMS[s.k];
      var vis = function (x) { return !S.recheck || S.showAll || S.fails.indexOf(x.k) >= 0; };
      var shown = list.filter(function (x, i) {
        if (!x.head) return vis(x);
        for (var j = i + 1; j < list.length && list[j].sub; j++) if (vis(list[j])) return true;   // หัวข้อแสดงเมื่อมีข้อย่อยแสดง
        return false;
      });
      if (!shown.some(function (x) { return !x.head; })) return;
      h += '<div class="sx-sec"><b>' + s.t + '</b>' + (!S.recheck ? '<button class="sx-all" data-a="rest" data-k="' + s.k + '"><i class="fa-solid fa-check-double"></i> ข้อที่เหลือถูกต้อง</button>' : '') + '</div>';
      shown.forEach(function (x) {
        if (x.head) { h += '<div class="sx-grp">' + esc(x.t) + '</div>'; return; }
        h += itemHtml(x, S.recheck && S.fails.indexOf(x.k) < 0);
      });
    });
    if (!SEC.some(function (s) { return S.sections[s.k]; })) h += '<div class="sx-res wait">เลือกอย่างน้อย 1 ส่วนที่งานนี้มี</div>';
    shell(h, S.job, '<button class="sx-btn" data-a="draft"><i class="fa-regular fa-floppy-disk"></i> บันทึกร่าง</button><button class="sx-btn pri" data-a="next">ถัดไป: สรุปผล <i class="fa-solid fa-arrow-right"></i></button>');
  }

  function itemHtml(x, ro) {
    var k = x.k, d = S.data[k], r = d.result;
    var h = '<div class="sx-it' + (x.sub ? ' sub' : '') + (r === 'fail' ? ' f' : r === 'pass' ? ' p' : '') + '" id="sxi_' + k + '"' + (ro ? ' style="opacity:.6"' : '') + '>' +
      '<div class="t">' + (x.sub ? '<span class="sx-dash">–</span> ' : '') + esc(x.t) + '</div>';
    if (ro) {
      h += '<div class="sub" style="margin-top:4px">' + (r === 'pass' ? '✓ ถูกต้อง' : r === 'na' ? '— ไม่มีการตรวจ' : r === 'fail' ? '✗ ต้องแก้ไข' : '-') + (d.fixed ? ' · แก้ไขแล้ว' : '') + '</div></div>';
      return h;
    }
    if (S.recheck) {
      h += '<div class="sx-3 two"><button class="sx-o' + (r === 'pass' ? ' ok' : '') + '" data-a="set" data-k="' + k + '" data-v="pass">✓ แก้ไขแล้ว</button>' +
        '<button class="sx-o' + (r === 'fail' ? ' ng' : '') + '" data-a="set" data-k="' + k + '" data-v="fail">✗ ยังไม่แก้</button></div>';
      if (d.detail) h += '<div class="sub" style="margin-top:6px">รอบก่อน: ' + esc(d.detail) + '</div>';
    } else {
      h += '<div class="sx-3"><button class="sx-o' + (r === 'pass' ? ' ok' : '') + '" data-a="set" data-k="' + k + '" data-v="pass">✓ ถูกต้อง</button>' +
        '<button class="sx-o' + (r === 'fail' ? ' ng' : '') + '" data-a="set" data-k="' + k + '" data-v="fail">✗ แก้ไข</button>' +
        '<button class="sx-o' + (r === 'na' ? ' na' : '') + '" data-a="set" data-k="' + k + '" data-v="na">— ไม่มี</button></div>';
    }
    h += '<div class="sx-more">';
    var inp = function (fld, ph, mode) { return '<input class="sx-in" data-k="' + k + '" data-f="' + fld + '" value="' + esc(d[fld]) + '" placeholder="' + ph + '"' + (mode ? ' inputmode="' + mode + '"' : '') + '>'; };
    if (x.trline) {
      h += '<div class="sx-g">' + f('tr', 'TR (หมายเลขหม้อแปลง)') + f('trPhase', 'Ø (เฟส)') + '</div>' +
        '<div class="sx-rd"><label><input type="radio" name="sxTrType" value="pole"' + (S.meta.trType === 'pole' ? ' checked' : '') + '> แขวนเสา</label><label><input type="radio" name="sxTrType" value="platform"' + (S.meta.trType === 'platform' ? ' checked' : '') + '> นั่งร้าน</label></div>';
    }
    if (x.ohm === 2) h += '<div class="sx-g">' + inp('ohm1', 'ต่อจุด (โอห์ม)', 'decimal') + inp('ohm2', 'ระบบ (โอห์ม)', 'decimal') + '</div>';
    if (x.ohm === 1) h += inp('ohm1', 'ค่ารวม (โอห์ม)', 'decimal');
    if (x.other) h += inp('other', 'ระบุรายการอื่นๆ (ถ้ามี)');
    if (r === 'fail') {
      h += '<textarea class="sx-in" data-k="' + k + '" data-f="detail" placeholder="รายละเอียดที่ต้องแก้ไข เช่น เสาต้นที่ 12-13 สายหย่อนเกิน">' + esc(d.detail) + '</textarea>';
    }
    var showRem = d.remark || S['rem_' + k];
    if (showRem) h += '<input class="sx-in" data-k="' + k + '" data-f="remark" value="' + esc(d.remark) + '" placeholder="หมายเหตุ">';
    if (r === 'fail' || d.photos.length) {
      h += '<div class="sx-ph">' + d.photos.map(function (p) {
        return '<a href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener"><img alt="รูป" src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.fileId) + '&sz=w160" onerror="this.style.display=\'none\'"></a>';
      }).join('') + '<label class="sx-link" style="cursor:pointer"><i class="fa-solid fa-camera"></i> แนบรูป' + (d.photos.length ? ' (' + d.photos.length + ')' : '') +
        '<input type="file" accept="image/*" capture="environment" data-photo="' + k + '" style="display:none"></label></div>';
    }
    if (!showRem && r !== 'fail') h += '<button class="sx-link" data-a="rem" data-k="' + k + '">+ หมายเหตุ</button>';
    h += '</div></div>';
    return h;
  }

  // ───── ดูอย่างเดียว (งานที่ส่งปิดงาน/ปิดงานแล้ว) ─────
  function renderView() {
    var m = S.meta, h = '', last = S.lastResult;
    var stdLog = (S.job.jobTimeline || []).filter(function (x) { return x.status === 'ตรวจมาตรฐาน'; });
    if (last === 'pass') h += '<div class="sx-res ok"><i class="fa-solid fa-circle-check"></i> ผ่านการตรวจมาตรฐาน' + (S.round > 1 ? ' (ตรวจซ้ำรอบที่ ' + S.round + ')' : '') + '<small>ผู้ตรวจ ' + esc(m.inspector || '-') + ' · ' + esc(thDate(m.inspDate) || '-') + '</small></div>';
    else if (last === 'fail') h += '<div class="sx-res ng"><i class="fa-solid fa-circle-xmark"></i> ไม่ผ่านการตรวจมาตรฐาน<small>ผู้ตรวจ ' + esc(m.inspector || '-') + ' · ' + esc(thDate(m.inspDate) || '-') + '</small></div>';
    else h += '<div class="sx-res wait">ยังไม่มีผลการตรวจมาตรฐาน</div>';
    if (!hasAnything()) {
      h += '<div class="sx-card"><div class="sx-lb">งานนี้บันทึกแบบสั้น (มีเฉพาะผลรวม ไม่มีผลรายข้อ)</div>' +
        (stdLog.length ? stdLog.map(function (x) { return '<div class="sx-hist">' + esc(thDate(x.timestamp)) + ' · ' + esc(x.details || '') + '</div>'; }).join('') : '<div class="sx-note">ไม่พบประวัติ</div>') + '</div>';
      shell(h, S.job, '<button class="sx-btn" data-a="close">ปิด</button>');
      return;
    }
    var info = [['ผู้ตรวจสอบ', (m.committee || []).map(function (c) { return c.name; }).filter(Boolean).join(', ')], ['หมายเลขงาน', m.jobNo], ['อนุมัติเลขที่', m.approveNo], ['ผู้ควบคุมงาน', m.supervisor], ['สถานี/ฟีดเดอร์', [m.station, m.feeder].filter(Boolean).join(' / ')], ['ประเภท', m.jobType === 'self' ? 'กฟภ.ดำเนินการ' : m.jobType === 'contractor' ? 'งานจ้างฯบริษัท' : '']]
      .filter(function (x) { return x[1]; });
    if (info.length) h += '<div class="sx-card">' + info.map(function (x) { return '<div style="display:flex;gap:8px;font-size:13px;padding:2px 0"><span style="color:#64748b;min-width:110px">' + x[0] + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>';
    if (S.rounds.length) h += '<div class="sx-card"><div class="sx-lb">ประวัติการตรวจ</div>' + S.rounds.map(function (r) {
      return '<div class="sx-hist">รอบที่ ' + r.round + ' · ' + esc(thDate(r.date)) + ' · ' + esc(r.inspector || '') + ' · <b style="color:' + (r.result === 'pass' ? '#15803d' : '#b91c1c') + '">' + (r.result === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน') + '</b>' +
        ((r.fails || []).length ? '<div>' + r.fails.map(function (f) { return '• ' + esc(f.label) + (f.detail ? ' — ' + esc(f.detail) : ''); }).join('<br>') + '</div>' : '') + '</div>';
    }).join('') + '</div>';
    var SYM = { pass: '<b style="color:#15803d">✓ ถูกต้อง</b>', fail: '<b style="color:#b91c1c">✗ ต้องแก้ไข</b>', na: '<span style="color:#64748b">— ไม่มี</span>' };
    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      h += '<div class="sx-sec"><b>' + s.t + '</b></div><div class="sx-card" style="padding:4px 12px">';
      ITEMS[s.k].forEach(function (x) {
        if (x.head) { h += '<div style="padding:7px 0 2px;font-size:13px;font-weight:600">' + esc(x.t) + '</div>'; return; }
        var d = S.data[x.k];
        h += '<div style="display:flex;gap:10px;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px' + (x.sub ? ';padding-left:16px' : '') + '"><div style="min-width:0">' + (x.sub ? '– ' : '') + esc(x.t) +
          ([d.ohm1, d.ohm2].filter(Boolean).length ? '<div class="sx-note">' + [d.ohm1 ? d.ohm1 + ' โอห์ม' : '', d.ohm2 ? 'ระบบ ' + d.ohm2 + ' โอห์ม' : ''].filter(Boolean).join(' · ') + '</div>' : '') +
          (d.other ? '<div class="sx-note">' + esc(d.other) + '</div>' : '') +
          (d.detail ? '<div class="sx-note" style="color:#b91c1c">' + esc(d.detail) + '</div>' : '') + (d.remark ? '<div class="sx-note">' + esc(d.remark) + '</div>' : '') +
          (d.photos.length ? '<div class="sx-ph" style="margin-top:4px">' + d.photos.map(function (p) { return '<a href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener"><img alt="รูป" src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.fileId) + '&sz=w160" onerror="this.style.display=\'none\'"></a>'; }).join('') + '</div>' : '') +
          '</div><div style="white-space:nowrap;text-align:right">' + (SYM[d.result] || '<span style="color:#94a3b8">-</span>') + (d.fixed ? '<div class="sx-note" style="color:#15803d">แก้ไขแล้ว ' + esc(thDateShort(d.fixed)) + '</div>' : '') + '</div></div>';
      });
      h += '</div>';
    });
    shell(h, S.job, '<button class="sx-btn" data-a="close">ปิด</button><button class="sx-btn blue" data-a="print"><i class="fa-solid fa-print"></i> พิมพ์ใบตรวจ</button>');
  }

  function renderSum() {
    var c = counts(), m = S.meta, h = '';
    var res = resultNow(c);
    if (res === 'pass') h += '<div class="sx-res ok"><i class="fa-solid fa-circle-check"></i> ผ่านการตรวจมาตรฐาน' + (S.recheck ? ' (แก้ไขครบแล้ว)' : '') + '<small>ระบบสรุปให้จากผลรายข้อ</small></div>';
    else if (res === 'fail') h += '<div class="sx-res ng"><i class="fa-solid fa-circle-xmark"></i> ไม่ผ่าน · ต้องแก้ไข ' + c.fail + ' รายการ<small>ระบบสรุปให้จากผลรายข้อ — แจ้งผู้ควบคุมงาน แล้วตรวจซ้ำเมื่อแก้เสร็จ</small></div>';
    else h += '<div class="sx-res wait"><i class="fa-solid fa-hourglass-half"></i> ยังตรวจไม่ครบ ' + c.unset.length + ' ข้อ<small>บันทึกร่างไว้ก่อนได้ หรือ <button class="sx-link" data-a="gounset" style="padding:0;font-size:12px">ไปข้อที่ยังไม่ได้เลือก</button></small></div>';
    var fl = failList();
    if (fl.length) h += '<div class="sx-card"><div class="sx-lb">รายการที่ต้องแก้ไข</div>' + fl.map(function (x) { return '<div style="font-size:13px;margin:4px 0;color:#991b1b">• ' + esc(x.label) + (x.detail ? ' — <span style="color:#475569">' + esc(x.detail) + '</span>' : '') + '</div>'; }).join('') + '</div>';
    var com = committee();
    h += '<datalist id="sxCom">' + com.map(function (x) { return '<option value="' + esc(x.name) + '">'; }).join('') + '</datalist>' +
      '<div class="sx-card"><div class="sx-lb">ผู้ตรวจสอบฯ (คณะกรรมการตรวจมาตรฐาน 3 ท่าน ตามแบบฟอร์ม)</div>' +
      m.committee.map(function (c, i) {
        return '<div class="sx-cm"><b>' + (i + 1) + '.</b><input class="sx-in" list="sxCom" data-cm="' + i + ':name" value="' + esc(c.name) + '" placeholder="ชื่อ-นามสกุล">' +
          '<input class="sx-in" data-cm="' + i + ':position" value="' + esc(c.position) + '" placeholder="ตำแหน่ง"></div>';
      }).join('') +
      (com.length ? '' : '<div class="sx-note">ตั้งรายชื่อคณะกรรมการตรวจมาตรฐานได้ที่หน้า Admin จะได้ไม่ต้องพิมพ์ทุกครั้ง</div>') +
      '<div class="sx-g" style="margin-top:6px">' + f('inspDate', 'วัน/เดือน/ปี ที่ดำเนินการตรวจ', '', 'date') + '</div></div>';
    if (S.recheck || m.fixHead || m.fixInspPos) {
      h += '<div class="sx-card"><div class="sx-lb">กรณีมีการแก้ไข — ได้แก้ไขให้ถูกต้องตามมาตรฐานทุกรายการแล้ว</div><div class="sx-g">' +
        f('supSign', 'ผู้ควบคุมงาน') + f('fixSupDate', 'ผู้ควบคุมงาน ลว.', '', 'date') + f('fixInspPos', 'ผู้ตรวจสอบฯ ตำแหน่ง') +
        f('fixHead', 'รับรองผลการแก้ไข หผ.') + f('fixHeadDate', 'หผ. ลว.', '', 'date') + '</div></div>';
    }
    if (S.rounds.length) {
      h += '<div class="sx-card"><div class="sx-lb">ประวัติการตรวจ</div>' + S.rounds.map(function (r) {
        return '<div class="sx-hist">รอบที่ ' + r.round + ' · ' + esc(thDate(r.date)) + ' · ' + esc(r.inspector || '') + ' · <b style="color:' + (r.result === 'pass' ? '#15803d' : '#b91c1c') + '">' + (r.result === 'pass' ? 'ผ่าน' : 'ไม่ผ่าน ' + (r.fails || []).length + ' ข้อ') + '</b></div>';
      }).join('') + '</div>';
    }
    var can = res === 'pass' || res === 'fail';
    shell(h, S.job, '<button class="sx-btn" data-a="back"><i class="fa-solid fa-arrow-left"></i> กลับ</button>' +
      '<button class="sx-btn" data-a="draft"' + '><i class="fa-regular fa-floppy-disk"></i> ร่าง</button>' +
      '<button class="sx-btn pri" data-a="save"' + (can ? '' : ' disabled') + '>บันทึกผล</button>' +
      '<button class="sx-btn blue" data-a="saveprint"' + (can ? '' : ' disabled') + '><i class="fa-solid fa-print"></i> บันทึก+พิมพ์</button>');
  }

  function resultNow(c) {
    c = c || counts();
    if (!c.total) return '';
    if (c.fail) return 'fail';
    if (c.unset.length) return '';
    return 'pass';
  }
  function failList() {
    var out = [];
    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      resItems(s.k).forEach(function (x) { var d = S.data[x.k]; if (d.result === 'fail') out.push({ k: x.k, label: x.label + (x.other && d.other ? ' (' + d.other + ')' : ''), detail: d.detail }); });
    });
    return out;
  }

  // ───── เหตุการณ์ ─────
  function onClick(e) {
    var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    if (b.tagName === 'SELECT') return;
    var a = b.dataset.a, k = b.dataset.k;
    if (a === 'close') return close();
    if (a === 'print') { syncInfo(); return printForm(null); }
    if (a === 'sec') { S.sections[k] = !S.sections[k]; S.dirty = true; S._keep = true; return render(); }
    if (a === 'set') {
      var d = S.data[k], v = b.dataset.v;
      d.result = (d.result === v && !S.recheck) ? '' : v;
      if (S.recheck) d.fixed = d.result === 'pass' ? (S.meta.inspDate || today()) : '';
      S.dirty = true; S._keep = true; render();
      if (v === 'fail' && d.result === 'fail') { var ta = document.querySelector('#sxi_' + k + ' textarea'); if (ta && !ta.value) ta.focus(); }
      return;
    }
    if (a === 'rest') {
      resItems(k).forEach(function (x) { var d = S.data[x.k]; if (!d.result) d.result = 'pass'; });
      S.dirty = true; S._keep = true; return render();
    }
    if (a === 'rem') { S['rem_' + k] = true; S._keep = true; render(); var x = document.querySelector('#sxi_' + k + ' input[data-f="remark"]'); if (x) x.focus(); return; }
    if (a === 'showall') { S.showAll = !S.showAll; return render(); }
    if (a === 'next') { syncInfo(); S.view = 'sum'; render(); $('sxBody').scrollTop = 0; return; }
    if (a === 'back') { S.view = 'items'; return render(); }
    if (a === 'gounset') {
      var c = counts(); S.view = 'items'; render();
      var el = c.unset[0] && $('sxi_' + c.unset[0]); if (el) el.scrollIntoView({ block: 'center' });
      return;
    }
    if (a === 'draft') return save('draft');
    if (a === 'save') return save('final');
    if (a === 'saveprint') return save('final', true);
  }
  function onInput(e) {
    var t = e.target;
    if (t.dataset.m) { S.meta[t.dataset.m] = t.value; S.dirty = true; }
    if (t.dataset.k && t.dataset.f) { S.data[t.dataset.k][t.dataset.f] = t.value; S.dirty = true; }
    if (t.dataset.cm) { var p = t.dataset.cm.split(':'); S.meta.committee[+p[0]][p[1]] = t.value; S.dirty = true;
      if (p[1] === 'name') { var c = committee().find(function (x) { return x.name === t.value; }); var pos = t.parentNode.querySelector('[data-cm="' + p[0] + ':position"]');
        if (c && pos && !pos.value) { pos.value = c.position; S.meta.committee[+p[0]].position = c.position; } } }
  }
  function onChange(e) {
    var t = e.target;
    if (t.name === 'sxType') { S.meta.jobType = t.value; S.dirty = true; }
    if (t.name === 'sxTrType') { S.meta.trType = t.value; S.dirty = true; }
    if (t.dataset.a === 'insp') {
      if (t.value === '__other') { S.meta.inspector = ''; S.meta.inspPosition = ''; }
      else { var p = committee().find(function (x) { return x.name === t.value; }); S.meta.inspector = t.value; S.meta.inspPosition = (p && p.position) || ''; }
      S.dirty = true; S._keep = true; render();
    }
    if (t.dataset.photo) addPhoto(t.dataset.photo, t.files && t.files[0]);
  }
  function syncInfo() {
    var d = document.querySelector('#sx details[data-d="info"]'); if (d) S.openInfo = d.open;
  }

  function close() {
    if (S && S.dirty && !S.saving) {
      if (!window.confirm('ยังไม่ได้บันทึกการเปลี่ยนแปลง ต้องการปิดหรือไม่?\n(กด "บันทึกร่าง" เพื่อเก็บไว้ตรวจต่อ)')) return;
    }
    var box = $('sx'); if (box) box.remove();
    document.documentElement.style.overflow = '';
    S = null; QUEUE = []; QUEUE.idx = 0;
  }

  // ───── รูป ─────
  function shrink(file, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.width, h = img.height, r = Math.min(1, max / Math.max(w, h));
        var cv = document.createElement('canvas'); cv.width = Math.round(w * r); cv.height = Math.round(h * r);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.onerror = function () { cb(String(rd.result).split(',')[1]); };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  }
  function addPhoto(k, file) {
    if (!file) return;
    var job = S.job, label = (itemOf(k) || { label: k }).label.split(' ')[0];
    var name = 'ตรวจมาตรฐาน_' + label + '_' + Date.now() + '.jpg';
    if (window.Swal) Swal.fire({ title: 'กำลังอัปโหลดรูป…', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
    shrink(file, function (b64) {
      run().withSuccessHandler(function (r) {
        if (window.Swal) Swal.close();
        if (!r || !r.success) { alertErr('อัปโหลดรูปไม่สำเร็จ', r && r.error); return; }
        if (!S || S.job !== job) return;
        S.data[k].photos.push({ fileId: r.fileId, fileUrl: r.fileUrl });
        S.dirty = true; S._keep = true; render();
      }).withFailureHandler(function (e) { if (window.Swal) Swal.close(); alertErr('อัปโหลดรูปไม่สำเร็จ', e && e.message || e); })
        .uploadAttachment(job.id, job.receiveNo || '', job.jobName || '', name, b64, 'image/jpeg');
    });
  }
  function alertErr(t, m) { if (window.Swal) Swal.fire({ icon: 'error', title: t, text: String(m || '') }); else alert(t); }

  // ───── บันทึก ─────
  function packJson(final, res) {
    var out = {};
    SEC.forEach(function (s) {
      resItems(s.k).forEach(function (x) {
        var k = x.k, d = S.data[k];
        var o = { result: S.sections[s.k] ? d.result : 'na', detail: d.detail || '', remark: d.remark || '' };
        if (d.photos.length) o.photos = d.photos;
        if (d.fixed) o.fixed = d.fixed;
        ['ohm1', 'ohm2', 'other'].forEach(function (p) { if (d[p]) o[p] = d[p]; });
        out[k] = o;
      });
    });
    var cm = (S.meta.committee || []).filter(function (c) { return c.name || c.position; });
    S.meta.inspector = (cm[0] && cm[0].name) || S.meta.inspector || '';
    S.meta.inspPosition = (cm[0] && cm[0].position) || S.meta.inspPosition || '';
    var meta = {}; META_F.forEach(function (f) { meta[f] = S.meta[f] || ''; });
    meta.committee = S.meta.committee || [];
    meta.sections = S.sections; meta.round = S.round; meta.recheck = S.recheck;
    if (S.recheck) meta.recheckKeys = S.fails;
    meta.draft = !final; meta.result = final ? res : (S.lastResult && !S.recheck ? S.lastResult : '');
    if (!final && S.recheck) meta.result = '';
    meta.savedBy = me().name || ''; meta.savedAt = new Date().toISOString();
    var rounds = S.rounds.slice();
    if (final) {
      rounds = rounds.filter(function (r) { return r.round !== S.round; });
      rounds.push({ round: S.round, date: S.meta.inspDate, inspector: S.meta.inspector, result: res, fails: failList().map(function (x) { return { k: x.k, label: x.label, detail: x.detail }; }) });
    }
    out._meta = meta; out._rounds = rounds;
    return out;
  }

  function save(mode, andPrint) {
    if (S.saving) return;
    var final = mode === 'final', res = resultNow();
    if (final && !res) return;
    if (final && !(S.meta.committee || []).some(function (c) { return String(c.name || '').trim(); })) { alertErr('กรุณาระบุชื่อผู้ตรวจสอบฯ อย่างน้อย 1 ท่าน'); return; }
    if (final && !S.meta.inspDate) { alertErr('กรุณาระบุวันที่ตรวจ'); return; }
    if (final && res === 'fail') {
      var miss = failList().filter(function (x) { return !String(x.detail || '').trim(); });
      if (miss.length) { alertErr('กรุณาระบุรายละเอียดที่ต้องแก้ไข', miss.map(function (x) { return x.label; }).join(', ')); return; }
    }
    var win = andPrint ? window.open('', '_blank') : null;
    if (win) win.document.write('<p style="font-family:sans-serif;padding:24px">กำลังบันทึก…</p>');
    var obj = packJson(final, res), job = S.job;
    S.saving = true;
    if (window.Swal) Swal.fire({ title: 'กำลังบันทึก…', allowOutsideClick: false, didOpen: function () { Swal.showLoading(); } });
    var fail = function (e) { S.saving = false; if (win) win.close(); alertErr('บันทึกไม่สำเร็จ', e && e.message || e); };
    run().withSuccessHandler(function (r) {
      if (r && r.success === false) return fail(r.error);
      if (!final) {
        S.saving = false; S.dirty = false;
        if (window.Swal) Swal.fire({ icon: 'success', title: 'บันทึกร่างแล้ว', text: 'เปิดตรวจต่อได้จากปุ่มตรวจมาตรฐานของงานนี้', timer: 1600, showConfirmButton: false });
        return;
      }
      var fl = failList();
      var remarks = res === 'fail'
        ? (S.recheck ? 'ตรวจซ้ำรอบที่ ' + S.round + ' ยังต้องแก้ไข ' : 'รายการที่ต้องแก้ไข ') + '(' + fl.length + ' รายการ):\n' + fl.map(function (x) { return '• ' + x.label + (x.detail ? ' — ' + x.detail : ''); }).join('\n')
        : (S.recheck ? 'ตรวจซ้ำรอบที่ ' + S.round + ': แก้ไขครบทุกรายการ' : 'ผ่านทุกรายการ');
      var text = res === 'pass' ? 'ผ่านการตรวจมาตรฐาน' : 'ไม่ผ่านการตรวจมาตรฐาน';
      run().withSuccessHandler(function (r2) {
        if (r2 && r2.success === false) return fail(r2.error);
        S.saving = false; S.dirty = false;
        S.rounds = obj._rounds; S.meta.round = S.round;
        if (win) printForm(win, obj, res);
        var next = nextInQueue();
        if (window.Swal) Swal.fire({ icon: res === 'pass' ? 'success' : 'warning', title: text,
          html: res === 'pass' ? '<p style="color:#6d28d9">กดปุ่ม <b>ส่งปิดงาน</b> เพื่อดำเนินการต่อ</p>' : '<div style="text-align:left;font-size:13px;color:#b91c1c">' + fl.map(function (x) { return '• ' + esc(x.label); }).join('<br>') + '</div><p style="font-size:12px;color:#64748b;margin-top:8px">เมื่อแก้เสร็จ กดตรวจมาตรฐานอีกครั้งเพื่อตรวจซ้ำเฉพาะข้อนี้</p>',
          confirmButtonText: next ? 'ตรวจงานถัดไป' : 'ตกลง' }).then(function () {
          var box = $('sx'); if (box) box.remove(); document.documentElement.style.overflow = ''; S = null;
          if (typeof loadData === 'function') loadData();
          if (next) setTimeout(function () { open(next); }, 400); else { QUEUE = []; QUEUE.idx = 0; }
        });
      }).withFailureHandler(fail).updateStandardInspection(job.id, text, S.meta.inspector, S.meta.inspDate, remarks, me());
    }).withFailureHandler(fail).saveStdFormData(job.id, JSON.stringify(obj));
  }

  function nextInQueue() {
    if (!QUEUE.length) return null;
    QUEUE.idx = (QUEUE.idx || 0) + 1;
    return QUEUE.idx < QUEUE.length ? QUEUE[QUEUE.idx] : null;
  }

  // ───── พิมพ์ FM.กมฟ.01-59-00 ตามแบบฟอร์ม Excel ต้นฉบับ (ccl/fm-tpl.js) ─────
  function thD(d, long) {
    if (!d) return ''; var x = new Date(d); if (isNaN(x)) return String(d);
    return x.toLocaleDateString('th-TH', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short', year: '2-digit' });
  }
  function fmHtml(obj, res) {
    var T = window.CCL_FM_TPL; if (!T) return '';
    var m = obj._meta || {}, job = S.job, SYM = { pass: '✓', fail: '✗', na: '-' };
    var cm = (m.committee || []).slice(0, 3); while (cm.length < 3) cm.push({ name: '', position: '' });
    var anyFix = Object.keys(obj).some(function (k) { return obj[k] && obj[k].fixed; });
    var hasFix = (m.round > 1) || anyFix;
    var byRow = {}; Object.keys(ITEMS).forEach(function (sk) { ITEMS[sk].forEach(function (x) { byRow[x.row] = x; }); });
    var D = function (k) { return obj[k] || {}; };
    // ค่าที่จะเติมบนเส้นประ (ตามลำดับเส้นประในบรรทัด) และช่องสี่เหลี่ยม
    var FILL = {
      4: { v: [job.jobName], x: [m.jobType === 'self'] },
      5: { v: [m.approveNo, thD(m.approveDate), m.jobNo], x: [m.jobType === 'contractor'] },
      6: { v: [m.htQty, m.htPole] }, 7: { v: [m.station, m.feeder, m.phase, m.trTotal] }, 8: { v: [m.ltQty, m.ltPole] },
      9: { v: [m.supervisor, m.supPosition, m.supDept] }, 10: { v: [thD(m.inspDate, 1)] },
      40: { v: [D('ht_16a').ohm1, D('ht_16a').ohm2] }, 42: { v: [D('ht_18').other] }, 61: { v: [D('lt_14').ohm1] }, 62: { v: [D('lt_15').other] },
      64: { v: [m.tr, m.trPhase] }, 65: { x: [m.trType === 'pole', m.trType === 'platform'] }, 86: { v: [D('tr_14').ohm1, D('tr_14').ohm2] },
      87: { v: [D('tr_15').other] }, 91: { x: [res === 'pass'] }, 92: { x: [res === 'fail'] }
    };
    if (hasFix) { FILL['94F'] = { v: [null, thD(m.fixSupDate)] }; FILL['95F'] = { v: [m.supSign] }; FILL['97F'] = { v: [null, m.fixInspPos] }; FILL['100F'] = { v: [null, thD(m.fixHeadDate)] }; FILL['101F'] = { v: [m.fixHead] }; }
    var DOTS = /([.…]{3,})/;
    var runsHtml = function (runs, fill) {
      var vi = 0, xi = 0, out = '';
      runs.forEach(function (rn) {
        var st = (rn.sz ? 'font-size:calc(' + rn.sz + 'pt*var(--k));' : '') + (rn.b ? 'font-weight:700;' : '') + (rn.u ? 'text-decoration:underline;' : '');
        if (rn.w) {   // Wingdings 2: 0 = ช่องสี่เหลี่ยม, P = ✓, O = ✗
          var g = rn.t === 'P' ? '✓' : rn.t === 'O' ? '✗' : '';
          if (g) out += '<span style="' + st + '">' + g + '</span>';
          else { var on = fill && fill.x ? fill.x[xi++] : false; out += '<span class="bx">' + (on ? '✓' : '') + '</span>'; }
          return;
        }
        var parts = rn.t.split(DOTS), seg = '';
        parts.forEach(function (pt, i) {
          if (i % 2 === 1) {
            var val = fill && fill.v ? fill.v[vi++] : null;
            seg += (val != null && val !== '') ? '<span class="fl"><span class="dt dd">' + pt + '</span><span class="fv">' + esc(val) + '</span></span>' : '<span class="dd">' + pt + '</span>';
          } else seg += esc(pt);
        });
        out += st ? '<span style="' + st + '">' + seg + '</span>' : seg;
      });
      return out;
    };
    var cell = function (row, c) {
      var r = row.r, br = c.br || [0, 0, 0, 0], txt = c.runs ? c.runs : null, inner = '';
      var css = 'font-size:calc(' + (c.sz || 14) + 'pt*var(--k));' + (c.b ? 'font-weight:700;' : '') + (c.u ? 'text-decoration:underline;' : '') +
        'text-align:' + (c.al === 'center' ? 'center' : c.al === 'right' ? 'right' : 'left') + ';vertical-align:' + (c.va === 'center' ? 'middle' : c.va === 'top' ? 'top' : 'bottom') + ';' +
        (br[0] ? 'border-left:.75pt solid #000;' : '') + (br[1] ? 'border-right:.75pt solid #000;' : '') + (br[2] ? 'border-top:.75pt solid #000;' : '') + (br[3] ? 'border-bottom:.75pt solid #000;' : '');
      var it = byRow[r], col = c.c;
      if (txt) {
        var runs = txt.map(function (x) { var y = {}; for (var p in x) y[p] = x[p]; return y; });
        // คณะผู้ตรวจสอบฯ: ตำแหน่งและชื่อจากระบบ (แบบฟอร์มต้นฉบับพิมพ์ชื่อคนของหน่วยงานต้นแบบไว้)
        var ci = { 95: 0, 98: 1, 101: 2 }[r], ni = { 96: 0, 99: 1, 102: 2 }[r];
        if (col === 2 && ci !== undefined) runs[0].t = runs[0].t.replace(/ตำแหน่ง\s*.*$/, 'ตำแหน่ง  ' + (cm[ci].position || '................................'));
        if (col === 1 && ni !== undefined) runs[0].t = runs[0].t.replace(/\(.*\)/, '( ' + (cm[ni].name ? ' ' + cm[ni].name + '  ' : '.................................................') + ' )');
        var fill = col === 6 ? FILL[r + 'F'] : (col === 1 ? FILL[r] : null);
        if (it && col === 5) {   // ช่องผลการตรวจ
          var d = D(it.k), sym = d.fixed ? '✓' : (SYM[d.result] || '');
          fill = { v: [sym] };
        }
        inner = runsHtml(runs, fill);
      } else if (it && !it.head) {
        var d2 = D(it.k);
        var hh = 'height:' + (row.h - 1) + 'pt';
        if (col === 6 && d2.detail) inner = '<div class="tx' + (d2.detail.length > 22 ? ' sm' : '') + '" style="' + hh + '">' + esc(d2.detail) + '</div>';
        if (col === 9) { var rm = (d2.remark || '') + (d2.fixed ? (d2.remark ? ' ' : '') + 'แก้ไขแล้ว ' + thD(d2.fixed) : ''); if (rm) inner = '<div class="tx' + (rm.length > 8 ? ' sm' : '') + '" style="' + hh + '">' + esc(rm) + '</div>'; }
      }
      if (c.cs) css += 'overflow:hidden;';   // ช่องที่รวมเซลล์: ข้อความยาวเกินถูกตัดที่ขอบเหมือนใน Excel
      var fitAttr = ((r >= 4 && r <= 11) || (r >= 89 && r <= 108)) && c.cs ? ' data-fit="1"' : '';   // บรรทัดหัวฟอร์ม/ลงนาม ต้องไม่ถูกตัด
      return '<td' + (c.cs ? ' colspan="' + c.cs + '"' : '') + (c.rs ? ' rowspan="' + c.rs + '"' : '') + fitAttr + ' style="' + css + '">' + inner + '</td>';
    };
    var cols = '<colgroup>' + T.cols.map(function (w) { return '<col style="width:' + w + 'pt">'; }).join('') + '</colgroup>';
    var tw = T.cols.reduce(function (a, b) { return a + b; }, 0);
    var pages = T.pages.map(function (pg, pi) {
      var rows = T.rows.filter(function (r) { return r.r >= pg[0] && r.r <= pg[1]; });
      return '<div class="pg">' + (pi === 0 ? '<img class="lg" src="' + location.origin + '/ccl/fm-logo.png" alt="">' : '') +
        '<table style="width:' + tw + 'pt">' + cols + rows.map(function (row) {
          return '<tr style="height:' + row.h + 'pt">' + row.cells.map(function (c) { return cell(row, c); }).join('') + '</tr>';
        }).join('') + '</table></div>';
    }).join('');
    var L = T.logo, M = T.margin;
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>FM.กมฟ.01-59-00 ' + esc(job.receiveNo || '') + '</title>' +
      '<meta name="viewport" content="width=820"><link href="https://fonts.googleapis.com/css2?family=Sarabun&display=swap" rel="stylesheet"><style>' +
      '@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#e5e7eb;-webkit-text-size-adjust:100%;text-size-adjust:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      ':root{--k:1}body{font-family:"Angsana New",AngsanaUPC,"TH Sarabun New",Sarabun,sans-serif;color:#000}html.fb2 body{font-family:"TH Sarabun New",Sarabun,sans-serif}html.fb3 body{font-family:Sarabun,sans-serif}' +
      '.pg{position:relative;width:210mm;height:297mm;margin:10px auto;background:#fff;padding:' + M.t + 'pt 0 0 ' + M.l + 'pt;overflow:hidden;page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto;break-after:auto}' +
      '.lg{position:absolute;left:' + (M.l + L.x) + 'pt;top:' + (M.t + L.y) + 'pt;width:' + L.w + 'pt;height:' + L.h + 'pt}' +
      'table{border-collapse:collapse;table-layout:fixed}td{padding:0 1.5pt;white-space:pre;overflow:visible;line-height:1.05}' +
      '.dd{letter-spacing:var(--ls,0)}.fl{position:relative;display:inline-block}.dt{visibility:visible}.fv{position:absolute;left:0;right:0;bottom:.32em;text-align:center;white-space:nowrap;overflow:visible;font-weight:400}' +
      '.bx{display:inline-block;width:.62em;height:.62em;border:.75pt solid #000;vertical-align:-.04em;text-align:center;line-height:.55em;font-size:1em}' +
      '.tx{white-space:normal;line-height:1;overflow:hidden;display:flex;align-items:flex-end;word-break:break-word}.tx.sm{font-size:calc(10.5pt*var(--k));line-height:.95}' +
      '@media print{html,body{background:#fff}.pg{margin:0}}</style>' +
      '<script>(function(){var c=document.createElement("canvas").getContext("2d"),t="กขคงจฉชซ abcdef 0123";' +
      'function w(f){c.font="40px "+f;return c.measureText(t).width;}var base=w("monospace");' +
      'function has(n){return w("\\""+n+"\\", monospace")!==base;}var d=document.documentElement;' +
      'if(has("Angsana New")||has("AngsanaUPC")){}else if(has("TH Sarabun New")){d.className="fb2";d.style.setProperty("--k","0.84");}else{d.className="fb3";d.style.setProperty("--k","0.7");}})();' +
      'function fit(){var d=document.documentElement,k=parseFloat(getComputedStyle(d).getPropertyValue("--k"))||1,n=0;' +
      'var wid=function(){Array.prototype.forEach.call(document.querySelectorAll(".fl"),function(f){f.style.minWidth="";var v=f.querySelector(".fv");if(v&&v.scrollWidth+4>f.offsetWidth)f.style.minWidth=(v.scrollWidth+4)+"px";});};' +   /* ค่าที่ยาวกว่าเส้นจุด = ขยายช่องให้พอดี ไม่ทับข้อความถัดไป */
      'var over=function(){wid();return Array.prototype.some.call(document.querySelectorAll("td[data-fit]"),function(t){return t.scrollWidth>t.clientWidth+1;});};' +
      'var ls=0;while(over()&&ls>-0.2){ls=Math.round((ls-0.02)*100)/100;d.style.setProperty("--ls",ls+"em");}' +   /* ย่อเส้นจุดก่อน (ฟอนต์สำรองจุดกว้างกว่า Angsana) แล้วค่อยลดขนาดตัวอักษร */
      'while(over()&&n<20){k=Math.round((k-0.02)*100)/100;d.style.setProperty("--k",k);n++;}' +
      /* ช่องอื่นที่ยังล้น (เช่น ชื่อรายการยาว) ย่อเฉพาะช่องนั้น */
      'Array.prototype.forEach.call(document.querySelectorAll("td[colspan]:not([data-fit])"),function(t){var kk=k,m=0;while(t.scrollWidth>t.clientWidth+1&&m<12){kk=Math.round((kk-0.02)*100)/100;t.style.setProperty("--k",kk);m++;}});}' +
      'window.onload=function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){fit();setTimeout(function(){window.print()},400);});};<\/script></head><body>' + pages + '</body></html>';
  }
  function printForm(win, obj, res) {
    obj = obj || packJson(false, '');
    res = res || (S.lastResult && !S.recheck && !S.dirty ? S.lastResult : resultNow());
    win = win || window.open('', '_blank');
    if (!win) { alertErr('เบราว์เซอร์บล็อกหน้าต่างพิมพ์', 'อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่'); return; }
    var html = fmHtml(obj, res);
    if (!html) { win.close(); alertErr('โหลดแบบฟอร์มไม่สำเร็จ', 'ลองโหลดหน้าเว็บใหม่'); return; }
    win.document.open(); win.document.write(html); win.document.close();
  }
  function thDateShort(d) { var x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  // ───── เชื่อมกับของเดิม ─────
  window.openStdFormModal = open;
  window.standardInspectJob = open;
  window.cclStd = { open: open, close: close, view: function (id) { open(id, { view: true }); },
    printHtml: function () { return S ? fmHtml(packJson(false, ''), S.lastResult && !S.recheck && !S.dirty ? S.lastResult : resultNow()) : ''; } };

  // ปุ่ม "ใบตรวจมาตรฐาน" ในหน้า ปิดงาน (รอปิดงาน / ปิดงานแล้ว) — ดูและพิมพ์ย้อนหลังได้
  function decorate(tb) {
    if (!tb) return;
    Array.prototype.forEach.call(tb.querySelectorAll('tr'), function (tr) {
      if (tr.querySelector('.sx-view')) return;
      var b = tr.querySelector('button[onclick*="completeJob("],button[onclick*="openDetailModal("]'); if (!b) return;
      var mm = /\((\d+)\)/.exec(b.getAttribute('onclick') || ''); if (!mm) return;
      var job = jobs().find(function (j) { return String(j.id) === mm[1]; });
      if (!job || !(job.jobTimeline || []).some(function (x) { return x.status === 'ตรวจมาตรฐาน'; })) return;
      var v = document.createElement('button'); v.type = 'button'; v.className = 'sx-view';
      v.innerHTML = '<i class="fa-solid fa-star-half-stroke"></i> ใบตรวจมาตรฐาน';
      v.style.cssText = 'display:block;width:100%;margin-top:4px;padding:5px 8px;border-radius:6px;border:1px solid #5eead4;background:#f0fdfa;color:#0f766e;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap';
      v.addEventListener('click', function (e) { e.stopPropagation(); open(job.id, { view: true }); });
      b.parentNode.appendChild(v);
    });
  }
  function watch() {
    ['closeTableBody', 'completedTableBody'].forEach(function (id) {
      var tb = $(id); if (!tb || tb.__sx) return; tb.__sx = true;
      new MutationObserver(function () { decorate(tb); }).observe(tb, { childList: true });
      decorate(tb);
    });
  }
  watch(); document.addEventListener('DOMContentLoaded', watch);

  // แผนที่ตรวจรับ: ปุ่ม "ตรวจมาตรฐาน" เดิมแค่ขึ้นว่าสำเร็จแต่ไม่ได้บันทึกอะไร → เปิดฟอร์มตรวจทีละงานตามลำดับที่เลือก
  function hookMap() {
    var o = window.imapDoAction; if (typeof o !== 'function' || o.__std) return;
    var w = function (type) {
      if (type !== 'std') return o.apply(this, arguments);
      var arr = (typeof _imapGetOrdered === 'function') ? _imapGetOrdered() : [];
      if (!arr.length) return;
      var ok = arr.filter(function (j) { var x = jobs().find(function (y) { return String(y.id) === String(j.id); }); return x && x.inspectionStatus === 'ผ่านการตรวจรับ'; });
      if (!ok.length) { if (window.Swal) Swal.fire({ icon: 'info', title: 'ยังตรวจมาตรฐานไม่ได้', text: 'งานที่เลือกต้องผ่านการตรวจรับก่อน' }); return; }
      QUEUE = ok.map(function (j) { return j.id; }); QUEUE.idx = 0;
      open(QUEUE[0]);
    };
    w.__std = true; window.imapDoAction = w;
  }
  hookMap(); document.addEventListener('DOMContentLoaded', hookMap);
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('sx') && !document.querySelector('.swal2-container')) close(); });
})();
