/* CCL — ตรวจมาตรฐาน (FM.กมฟ.01-59-00) แบบใหม่
   - โหลดผลที่บันทึกไว้กลับมาทุกครั้ง (เดิมเปิดซ้ำแล้วว่าง) และเก็บข้อมูลหัวฟอร์มด้วย
   - ปุ่ม ✓ / ✗ / — ใหญ่ กดง่ายบนมือถือ, เลือกเฉพาะส่วนที่งานนั้นมี, แนบรูปข้อที่ต้องแก้
   - สรุปผ่าน/ไม่ผ่านให้เอง, เลือกผู้ตรวจจากคณะกรรมการตรวจมาตรฐาน
   - ไม่ผ่าน → รอบถัดไปเปิดมาเห็นเฉพาะข้อที่ต้องแก้ (ตรวจซ้ำ) ประวัติแต่ละรอบเก็บไว้
   - พิมพ์ใบ FM.กมฟ.01-59-00 จากข้อมูลที่บันทึก
   ใช้คอลัมน์ข้อมูลเดิม (saveStdFormData / getStdFormData) — ไม่ต้องแก้หลังบ้าน */
(function () {
  'use strict';

  var SEC = [
    { k: 'ht', t: '1. ระบบจำหน่ายแรงสูง', s: 'แรงสูง' },
    { k: 'lt', t: '2. ระบบจำหน่ายแรงต่ำ', s: 'แรงต่ำ' },
    { k: 'tr', t: '3. การติดตั้งหม้อแปลง', s: 'หม้อแปลง' }
  ];
  var META_F = ['jobType', 'approveNo', 'approveDate', 'jobNo', 'htQty', 'htPole', 'ltQty', 'ltPole', 'station', 'feeder', 'phase', 'trTotal',
    'tr', 'trPhase', 'trType', 'supervisor', 'supPosition', 'inspector', 'inspPosition', 'inspDate', 'supSign', 'supDate', 'fixSign', 'fixPosition', 'fixDate'];

  var S = null;           // สถานะฟอร์มที่เปิดอยู่
  var QUEUE = [];         // คิวงานจากแผนที่ (ตรวจหลายงานต่อกัน)

  function items() { return (typeof STD_FORM_ITEMS !== 'undefined') ? STD_FORM_ITEMS : window.STD_FORM_ITEMS; }
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
      '#sx .sx-hist{font-size:12px;color:#475569;border-left:3px solid #cbd5e1;padding:2px 0 2px 8px;margin:6px 0}'
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
    var it = items(), data = {}, meta = obj._meta || {}, rounds = obj._rounds || [];
    SEC.forEach(function (s) {
      it[s.k].forEach(function (_, i) {
        var k = s.k + '_' + i, v = obj[k] || {};
        data[k] = { result: v.result || '', detail: v.detail || '', remark: v.remark || '', photos: v.photos || [], fixed: v.fixed || '' };
      });
    });
    var anySaved = Object.keys(data).some(function (k) { return data[k].result; });
    var sections = meta.sections;
    if (!sections) {
      sections = {};
      SEC.forEach(function (s) {
        var used = it[s.k].some(function (_, i) { var r = data[s.k + '_' + i].result; return r && r !== 'na'; });
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
    if (newRound) { m.inspDate = ''; m.fixSign = ''; m.fixPosition = ''; m.fixDate = ''; }
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
    if (!m.inspector) {
      var c = committee(); var mine = c.find(function (x) { return x.name === me().name; });
      var pick = mine || c[0];
      if (pick) { m.inspector = pick.name; m.inspPosition = m.inspPosition || pick.position; }
      else m.inspector = window._approverName || me().name || '';
    }
    if (recheck && !m.fixSign) { m.fixSign = m.inspector; m.fixPosition = m.inspPosition; }
    if (recheck && !m.fixDate) m.fixDate = m.inspDate;
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
    var it = items(), done = 0, total = 0, fail = 0, unset = [];
    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      it[s.k].forEach(function (_, i) {
        var k = s.k + '_' + i, r = S.data[k].result;
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
    var it = items(), c = counts(), m = S.meta, h = '';
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
      f('supervisor', 'ผู้ควบคุมงาน') + f('supPosition', 'ตำแหน่งผู้ควบคุมงาน') + '</div></details>';
    // ส่วนที่ตรวจ
    if (!S.recheck) {
      h += '<div class="sx-card"><div class="sx-lb">งานนี้มีส่วนไหนบ้าง (ส่วนที่ไม่มีจะพิมพ์เป็น "—")</div><div class="sx-chips">' +
        SEC.map(function (s) { return '<button class="sx-chip' + (S.sections[s.k] ? ' on' : '') + '" data-a="sec" data-k="' + s.k + '">' + (S.sections[s.k] ? '<i class="fa-solid fa-check"></i> ' : '') + s.s + ' ' + it[s.k].length + ' ข้อ</button>'; }).join('') + '</div></div>';
    }
    h += '<div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-top:4px"><span>ตรวจแล้ว <b>' + c.done + '/' + c.total + '</b></span>' + (c.fail ? '<span style="color:#dc2626;font-weight:700">ต้องแก้ไข ' + c.fail + '</span>' : '') + '</div>' +
      '<div class="sx-prog"><i style="width:' + (c.total ? Math.round(c.done * 100 / c.total) : 0) + '%"></i></div>';
    if (S.recheck) h += '<button class="sx-link" data-a="showall">' + (S.showAll ? 'แสดงเฉพาะข้อที่ต้องตรวจซ้ำ' : 'แสดงทุกข้อ (ดูอย่างเดียว)') + '</button>';

    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      var list = it[s.k].map(function (t, i) { return { t: t, k: s.k + '_' + i }; });
      var active = list.filter(function (x) { return !S.recheck || S.fails.indexOf(x.k) >= 0; });
      var shown = S.recheck && !S.showAll ? active : list;
      if (!shown.length) return;
      h += '<div class="sx-sec"><b>' + s.t + '</b>' + (!S.recheck ? '<button class="sx-all" data-a="rest" data-k="' + s.k + '"><i class="fa-solid fa-check-double"></i> ข้อที่เหลือถูกต้อง</button>' : '') + '</div>';
      if (s.k === 'tr') {
        h += '<div class="sx-card"><div class="sx-g">' + f('tr', 'TR (หมายเลข/ขนาด)') + f('trPhase', 'จำนวนเฟส (Ø)') + '</div>' +
          '<div class="sx-rd" style="margin-top:6px"><label><input type="radio" name="sxTrType" value="pole"' + (m.trType === 'pole' ? ' checked' : '') + '> แขวนเสา</label><label><input type="radio" name="sxTrType" value="platform"' + (m.trType === 'platform' ? ' checked' : '') + '> นั่งร้าน</label></div></div>';
      }
      shown.forEach(function (x) { h += itemHtml(x.t, x.k, S.recheck && S.fails.indexOf(x.k) < 0); });
    });
    if (!SEC.some(function (s) { return S.sections[s.k]; })) h += '<div class="sx-res wait">เลือกอย่างน้อย 1 ส่วนที่งานนี้มี</div>';
    shell(h, S.job, '<button class="sx-btn" data-a="draft"><i class="fa-regular fa-floppy-disk"></i> บันทึกร่าง</button><button class="sx-btn pri" data-a="next">ถัดไป: สรุปผล <i class="fa-solid fa-arrow-right"></i></button>');
  }

  function itemHtml(text, k, ro) {
    var d = S.data[k], lines = String(text).split('\n'), r = d.result;
    var h = '<div class="sx-it' + (r === 'fail' ? ' f' : r === 'pass' ? ' p' : '') + '" id="sxi_' + k + '"' + (ro ? ' style="opacity:.6"' : '') + '>' +
      '<div class="t">' + esc(lines[0]) + '</div>' + (lines.length > 1 ? '<div class="sub">' + esc(lines.slice(1).join('\n').replace(/^\s+/gm, '')) + '</div>' : '');
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
    var needOhm = /โอห์ม/.test(text);
    var showRem = d.remark || needOhm || S['rem_' + k];
    h += '<div class="sx-more">';
    if (r === 'fail') {
      h += '<textarea class="sx-in" data-k="' + k + '" data-f="detail" placeholder="รายละเอียดที่ต้องแก้ไข เช่น เสาต้นที่ 12-13 สายหย่อนเกิน">' + esc(d.detail) + '</textarea>';
    }
    if (showRem) h += '<input class="sx-in" data-k="' + k + '" data-f="remark" value="' + esc(d.remark) + '" placeholder="' + (needOhm ? 'ค่าความต้านทานดิน (โอห์ม)' : 'หมายเหตุ') + '">';
    if (r === 'fail' || d.photos.length) {
      h += '<div class="sx-ph">' + d.photos.map(function (p, i) {
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
    var it = items(), m = S.meta, h = '', last = S.lastResult;
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
    var info = [['หมายเลขงาน', m.jobNo], ['อนุมัติเลขที่', m.approveNo], ['ผู้ควบคุมงาน', m.supervisor], ['สถานี/ฟีดเดอร์', [m.station, m.feeder].filter(Boolean).join(' / ')], ['ประเภท', m.jobType === 'self' ? 'กฟภ.ดำเนินการ' : m.jobType === 'contractor' ? 'งานจ้างฯบริษัท' : '']]
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
      it[s.k].forEach(function (t, i) {
        var d = S.data[s.k + '_' + i];
        h += '<div style="display:flex;gap:10px;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><div style="min-width:0">' + esc(title1(t)) +
          (d.detail ? '<div class="sx-note" style="color:#b91c1c">' + esc(d.detail) + '</div>' : '') + (d.remark ? '<div class="sx-note">' + esc(d.remark) + '</div>' : '') +
          (d.photos.length ? '<div class="sx-ph" style="margin-top:4px">' + d.photos.map(function (p) { return '<a href="' + esc(p.fileUrl) + '" target="_blank" rel="noopener"><img alt="รูป" src="https://drive.google.com/thumbnail?id=' + encodeURIComponent(p.fileId) + '&sz=w160" onerror="this.style.display=\'none\'"></a>'; }).join('') + '</div>' : '') +
          '</div><div style="white-space:nowrap;text-align:right">' + (SYM[d.result] || '<span style="color:#94a3b8">-</span>') + (d.fixed ? '<div class="sx-note" style="color:#15803d">แก้ไขแล้ว ' + esc(thDateShort(d.fixed)) + '</div>' : '') + '</div></div>';
      });
      h += '</div>';
    });
    shell(h, S.job, '<button class="sx-btn" data-a="close">ปิด</button><button class="sx-btn blue" data-a="print"><i class="fa-solid fa-print"></i> พิมพ์ใบตรวจ</button>');
  }

  function renderSum() {
    var c = counts(), m = S.meta, it = items(), h = '';
    var res = resultNow(c);
    if (res === 'pass') h += '<div class="sx-res ok"><i class="fa-solid fa-circle-check"></i> ผ่านการตรวจมาตรฐาน' + (S.recheck ? ' (แก้ไขครบแล้ว)' : '') + '<small>ระบบสรุปให้จากผลรายข้อ</small></div>';
    else if (res === 'fail') h += '<div class="sx-res ng"><i class="fa-solid fa-circle-xmark"></i> ไม่ผ่าน · ต้องแก้ไข ' + c.fail + ' รายการ<small>ระบบสรุปให้จากผลรายข้อ — แจ้งผู้ควบคุมงาน แล้วตรวจซ้ำเมื่อแก้เสร็จ</small></div>';
    else h += '<div class="sx-res wait"><i class="fa-solid fa-hourglass-half"></i> ยังตรวจไม่ครบ ' + c.unset.length + ' ข้อ<small>บันทึกร่างไว้ก่อนได้ หรือ <button class="sx-link" data-a="gounset" style="padding:0;font-size:12px">ไปข้อที่ยังไม่ได้เลือก</button></small></div>';
    var fl = failList();
    if (fl.length) h += '<div class="sx-card"><div class="sx-lb">รายการที่ต้องแก้ไข</div>' + fl.map(function (x) { return '<div style="font-size:13px;margin:4px 0;color:#991b1b">• ' + esc(x.label) + (x.detail ? ' — <span style="color:#475569">' + esc(x.detail) + '</span>' : '') + '</div>'; }).join('') + '</div>';
    var com = committee();
    var opts = com.map(function (x, i) { return '<option value="' + esc(x.name) + '"' + (x.name === m.inspector ? ' selected' : '') + '>' + esc(x.name) + (i === 0 ? ' (ประธาน)' : '') + '</option>'; }).join('');
    var inList = com.some(function (x) { return x.name === m.inspector; });
    h += '<div class="sx-card"><div class="sx-g">' +
      '<div><div class="sx-lb">ผู้ตรวจสอบ' + (com.length ? ' (คณะกรรมการตรวจมาตรฐาน)' : '') + '</div>' +
      (com.length ? '<select class="sx-in" data-a="insp">' + opts + '<option value="__other"' + (!inList ? ' selected' : '') + '>อื่นๆ (พิมพ์ชื่อ)</option></select>' +
        (!inList ? '<input class="sx-in" style="margin-top:6px" data-m="inspector" value="' + esc(m.inspector) + '" placeholder="ชื่อผู้ตรวจสอบ">' : '')
        : '<input class="sx-in" data-m="inspector" value="' + esc(m.inspector) + '" placeholder="ชื่อผู้ตรวจสอบ"><div class="sx-note" style="margin-top:4px">ตั้งรายชื่อคณะกรรมการได้ที่หน้า Admin</div>') + '</div>' +
      f('inspPosition', 'ตำแหน่งผู้ตรวจสอบ') + f('inspDate', 'วันที่ตรวจ', '', 'date') +
      f('supSign', 'ผู้ควบคุมงาน (ลงนาม)') + f('supDate', 'ผู้ควบคุมงาน ลงวันที่', '', 'date') + '</div></div>';
    if (S.recheck || m.fixSign) {
      h += '<div class="sx-card"><div class="sx-lb">กรณีมีการแก้ไข — รับรองผลการแก้ไข</div><div class="sx-g">' + f('fixSign', 'ผู้รับรองผลการแก้ไข') + f('fixPosition', 'ตำแหน่ง') + f('fixDate', 'วันที่', '', 'date') + '</div></div>';
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
    var it = items(), out = [];
    SEC.forEach(function (s) {
      if (!S.sections[s.k]) return;
      it[s.k].forEach(function (t, i) { var k = s.k + '_' + i, d = S.data[k]; if (d.result === 'fail') out.push({ k: k, label: title1(t), detail: d.detail }); });
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
      items()[k].forEach(function (_, i) { var d = S.data[k + '_' + i]; if (!d.result) d.result = 'pass'; });
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
    var job = S.job, label = title1(items()[k.split('_')[0]][+k.split('_')[1]]).split(' ')[0];
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
    var it = items(), out = {};
    SEC.forEach(function (s) {
      it[s.k].forEach(function (_, i) {
        var k = s.k + '_' + i, d = S.data[k];
        var o = { result: S.sections[s.k] ? d.result : 'na', detail: d.detail || '', remark: d.remark || '' };
        if (d.photos.length) o.photos = d.photos;
        if (d.fixed) o.fixed = d.fixed;
        out[k] = o;
      });
    });
    var meta = {}; META_F.forEach(function (f) { meta[f] = S.meta[f] || ''; });
    meta.sections = S.sections; meta.round = S.round; meta.recheck = S.recheck;
    if (S.recheck) meta.recheckKeys = S.fails;
    meta.draft = !final; meta.result = final ? res : (S.lastResult && !S.recheck ? S.lastResult : '');
    if (!final && S.recheck) meta.result = '';
    meta.savedBy = me().name || ''; meta.savedAt = new Date().toISOString();
    var rounds = S.rounds.slice();
    if (final) {
      rounds = rounds.filter(function (r) { return r.round !== S.round; });
      rounds.push({ round: S.round, date: S.meta.inspDate, inspector: S.meta.inspector, result: res, fails: failList().map(function (x) { return { k: x.k, label: x.label, detail: x.detail }; }) });
      if (res === 'pass' && S.recheck && !S.meta.fixSign) { meta.fixSign = S.meta.inspector; meta.fixPosition = S.meta.inspPosition; meta.fixDate = S.meta.inspDate; S.meta.fixSign = meta.fixSign; S.meta.fixPosition = meta.fixPosition; S.meta.fixDate = meta.fixDate; }
    }
    out._meta = meta; out._rounds = rounds;
    return out;
  }

  function save(mode, andPrint) {
    if (S.saving) return;
    var final = mode === 'final', res = resultNow();
    if (final && !res) return;
    if (final && !String(S.meta.inspector || '').trim()) { alertErr('กรุณาระบุชื่อผู้ตรวจสอบ'); return; }
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

  // ───── พิมพ์ FM.กมฟ.01-59-00 ─────
  function printForm(win, obj, res) {
    obj = obj || packJson(false, '');
    var m = obj._meta, it = items();
    res = res || (S.lastResult && !S.recheck && !S.dirty ? S.lastResult : resultNow());
    win = win || window.open('', '_blank');
    if (!win) { alertErr('เบราว์เซอร์บล็อกหน้าต่างพิมพ์', 'อนุญาตป๊อปอัปสำหรับเว็บนี้แล้วลองใหม่'); return; }
    var box = function (on) { return '<span class="bx">' + (on ? '✓' : '') + '</span>'; };
    var u = function (v, w) { return '<span class="u" style="min-width:' + (w || 70) + 'px">' + esc(v || '') + '</span>'; };
    var SYM = { pass: '✓', fail: '✗', na: '-' };
    var table = function (s) {
      var head = '<div class="st">' + s.t + (s.k === 'tr' ? ' &nbsp; TR ' + u(m.tr, 60) + ' Ø ' + u(m.trPhase, 30) + ' kva &nbsp; ' + box(m.trType === 'pole') + ' แขวนเสา &nbsp; ' + box(m.trType === 'platform') + ' นั่งร้าน' : '') + '</div>';
      var rows = it[s.k].map(function (t, i) {
        var d = obj[s.k + '_' + i] || {}, r = d.result;
        var rem = esc(d.remark || '') + (d.fixed ? (d.remark ? '<br>' : '') + 'แก้ไขแล้ว ' + esc(thDateShort(d.fixed)) : '');
        var shown = d.fixed ? '✓' : (SYM[r] || '');
        var col = d.fixed || r === 'pass' ? '#15803d' : r === 'fail' ? '#b91c1c' : '#475569';
        return '<tr><td class="l">' + esc(t) + '</td><td class="c" style="color:' + col + '">' + shown + '</td><td>' + esc(d.detail || '') + '</td><td>' + rem + '</td></tr>';
      }).join('');
      return head + '<table><thead><tr><th style="width:45%">รายการ</th><th style="width:10%">ผลการตรวจ</th><th style="width:30%">รายละเอียดที่ต้องแก้ไข</th><th style="width:15%">หมายเหตุ</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };
    var logo = location.origin + '/ccl/pea-logo.png';
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>FM.กมฟ.01-59-00 ' + esc(S.job.receiveNo || '') + '</title>' +
      '<meta name="viewport" content="width=820"><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"><style>' +
      '*{box-sizing:border-box}html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{font-family:Sarabun,sans-serif;font-size:11px;color:#0f172a;margin:0 auto;padding:8mm;max-width:820px}' +
      '.u{border-bottom:1px dotted #334155;display:inline-block;padding:0 4px}.bx{border:1px solid #334155;width:11px;height:11px;display:inline-block;text-align:center;line-height:10px;font-size:10px;vertical-align:-1px}' +
      'table{width:100%;border-collapse:collapse}th,td{border:1px solid #64748b;padding:2px 5px;font-size:10px;vertical-align:top}th{background:#f1f5f9}td.l{white-space:pre-line}td.c{text-align:center;font-size:13px;font-weight:700}' +
      '.st{font-weight:700;font-size:11px;background:#e2e8f0;padding:3px 8px;margin-top:8px;border:1px solid #64748b;border-bottom:0}.row{display:flex;flex-wrap:wrap;gap:4px 14px;margin-bottom:3px;font-size:10.5px}' +
      '.sg{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:12px}.sb{border:1px solid #94a3b8;border-radius:4px;padding:8px;text-align:center;font-size:10.5px}.sb .ln{border-bottom:1px dotted #334155;height:26px;margin:6px 20px 4px}' +
      '@media print{@page{size:A4 portrait;margin:8mm}body{padding:0}.st,tr{break-inside:avoid}}</style></head><body>' +
      '<table style="border:0;margin-bottom:6px"><tr><td style="border:0;width:70px"><img src="' + logo + '" style="height:56px" onerror="this.style.display=\'none\'"></td>' +
      '<td style="border:0;text-align:center;vertical-align:middle"><div style="font-size:14px;font-weight:700">แบบฟอร์มตรวจสอบมาตรฐานงานก่อสร้างและปรับปรุงระบบจำหน่าย ของ กฟภ.</div><div style="font-size:10px;color:#475569">FM.กมฟ.01-59-00</div></td><td style="border:0;width:70px"></td></tr></table>' +
      '<div class="row"><span>ชื่องาน ' + u(S.job.jobName, 300) + '</span><span>' + box(m.jobType === 'self') + ' กฟภ.ดำเนินการ</span><span>' + box(m.jobType === 'contractor') + ' งานจ้างฯบริษัท</span></div>' +
      '<div class="row"><span>อนุมัติเลขที่ ' + u(m.approveNo, 90) + '</span><span>ลว. ' + u(thDate(m.approveDate), 90) + '</span><span>หมายเลขงาน ' + u(m.jobNo, 160) + '</span></div>' +
      '<div class="row"><span>*ปริมาณงานแรงสูง ' + u(m.htQty, 40) + ' วงจร-กม. จำนวนเสา ' + u(m.htPole, 30) + ' ต้น</span><span>*ปริมาณงานแรงต่ำ ' + u(m.ltQty, 40) + ' วงจร-กม. จำนวนเสา ' + u(m.ltPole, 30) + ' ต้น</span></div>' +
      '<div class="row"><span>รับไฟจากสถานี ' + u(m.station) + '</span><span>ฟีดเดอร์ ' + u(m.feeder, 50) + '</span><span>เฟสที่ต่อ ' + u(m.phase, 40) + '</span><span>หม้อแปลงรวม ' + u(m.trTotal, 50) + ' KVA</span></div>' +
      '<div class="row"><span>ผู้ควบคุมงาน ' + u(m.supervisor, 140) + '</span><span>ตำแหน่ง ' + u(m.supPosition, 100) + '</span></div>' +
      '<div class="row"><span>วัน/เดือน/ปี ที่ดำเนินการตรวจ ' + u(thDate(m.inspDate), 160) + '</span>' + (m.round > 1 ? '<span>ตรวจซ้ำรอบที่ ' + m.round + '</span>' : '') + '</div>' +
      '<div style="font-size:10px;font-weight:600;margin:4px 0"><u>ช่องผลการตรวจ</u> ✓ หมายถึง ถูกต้อง · ✗ หมายถึง ต้องแก้ไข · - หมายถึง ไม่มีการตรวจ</div>' +
      SEC.map(table).join('') +
      '<div style="border:1px solid #94a3b8;border-radius:4px;padding:6px 8px;margin-top:8px;font-size:10.5px"><b>ผลการตรวจสอบ</b><div style="margin-top:3px">' + box(res === 'pass') + ' ตรวจสอบแล้ว ถูกต้องตามมาตรฐาน กฟภ.</div><div>' + box(res === 'fail') + ' ตรวจสอบแล้ว เห็นสมควรแก้ไขให้ถูกต้องตามรายการข้างต้น</div></div>' +
      '<div class="sg"><div class="sb"><b>ผู้ตรวจสอบ</b><div class="ln"></div>( ' + esc(m.inspector || '……………………………') + ' )<div>ตำแหน่ง ' + esc(m.inspPosition || '……………………') + '</div></div>' +
      '<div class="sb"><b>ผู้ควบคุมงาน</b><div class="ln"></div>( ' + esc(m.supSign || '……………………………') + ' )<div>ลว. ' + esc(thDate(m.supDate) || '……………………') + '</div></div></div>' +
      '<div class="sb" style="margin-top:10px;text-align:left"><b>กรณีมีการแก้ไข</b> ได้แก้ไขให้ถูกต้องตามมาตรฐานทุกรายการแล้ว<div style="display:flex;gap:24px;margin-top:14px;align-items:flex-end"><span>รับรองผลการแก้ไข ' + u(m.fixSign, 160) + '</span><span>ตำแหน่ง ' + u(m.fixPosition, 110) + '</span><span>วันที่ ' + u(thDate(m.fixDate), 110) + '</span></div></div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print()},500)}<\/script></body></html>';
    win.document.open(); win.document.write(html); win.document.close();
  }
  function thDateShort(d) { var x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }

  // ───── เชื่อมกับของเดิม ─────
  window.openStdFormModal = open;
  window.standardInspectJob = open;
  window.cclStd = { open: open, close: close, view: function (id) { open(id, { view: true }); } };

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
