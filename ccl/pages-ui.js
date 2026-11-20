/* CCL — หน้า "ติดตามงาน" และ "ตรวจรับงาน" แบบการ์ด (ชุดเดียวกับหน้างบประมาณ)
   ใช้ฟังก์ชันเดิมทั้งหมด: openDetailModal / openEditModal / changeStatus / inspectJob / openStdFormModal / sendToCloseFromInspection */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(name, def) { try { return eval(name); } catch (e) { return def; } }
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function dth(v) {
    if (!v) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v)), d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
    if (isNaN(d)) return String(v);
    return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2);
  }
  function days(from, to) { var a = new Date(from); if (isNaN(a)) return null; return Math.max(0, Math.ceil(((to || new Date()) - a) / 86400000)); }
  function ids(s) { return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); }
  function idsHtml(s) {
    var a = ids(s); if (!a.length) return '';
    return '<span class="pc-ids">' + esc(a[0]) + (a.length > 1 ? ' <span class="pc-tg pc-bt pc-more" data-all="' + esc(a.join('|')) + '">+' + (a.length - 1) + '</span>' : '') + '</span>';
  }
  function who(row) {
    var ent = String(row.responsibleEntity || '').trim(), self = !ent || ent === 'ไฟฟ้าดำเนินการเอง';
    return '<div class="pc-who">' + (self ? '<span><i class="fa-solid fa-bolt" style="color:#eab308"></i>ไฟฟ้าดำเนินการเอง</span>'
      : '<span><i class="fa-solid fa-helmet-safety" style="color:#f97316"></i><span>' + esc(ent) + '</span></span>') +
      '<span><i class="fa-solid fa-user-tie"></i>' + esc(row.assignee || '-') + '</span>';
  }
  function pipe(steps, cur, bad) {
    return '<div class="pc-pipe">' + steps.map(function (s, i) {
      var c = i < cur ? 'ok' : i === cur ? (bad ? 'bad' : 'now') : '';
      return (i ? '<div class="ln ' + (i <= cur ? 'ok' : '') + '"></div>' : '') + '<div class="p ' + c + '"><i>' + (i < cur ? '✓' : bad && i === cur ? '✕' : i + 1) + '</i><span>' + s + '</span></div>';
    }).join('') + '</div>';
  }

  var css =
    '.pcx{padding:16px 18px 6px}.pcx .ttl{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700;color:#1e293b}' +
    '.pcx .ttl .ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:17px}.pcx .ttl .sp{flex:1}' +
    '.pcx .tb{height:40px;padding:0 15px;border-radius:11px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:0;background:#059669;color:#fff;white-space:nowrap;cursor:pointer}.pcx .tb:hover{background:#047857}' +
    '.pcx .st{display:flex;gap:8px;margin:14px 0 12px;overflow-x:auto;padding:2px}.pcx .st::-webkit-scrollbar{display:none}' +
    '.pcx .s{flex:1;min-width:108px;border-radius:14px;padding:8px 12px;border:2px solid transparent;cursor:pointer;text-align:left;font-family:inherit}' +
    '.pcx .s small{display:block;font-size:12.5px;font-weight:600;white-space:nowrap}.pcx .s b{font-size:22px;line-height:1.25;display:block}' +
    '.pcx .s.on{border-color:currentColor;box-shadow:0 2px 8px rgba(0,0,0,.1)}' +
    '.pcx .f1{display:flex;gap:10px;flex-wrap:wrap;align-items:center}' +
    '.pcx .srch{flex:1;min-width:220px;position:relative}.pcx .srch>i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8}' +
    '.pcx .srch input{width:100% !important;max-width:none !important;height:46px;border:1.5px solid #cbd5e1 !important;border-radius:12px !important;padding:0 12px 0 40px !important;font-size:15px !important;background:#f8fafc}' +
    '.pcx .srch input:focus{outline:none;border-color:#6366f1 !important;background:#fff;box-shadow:0 0 0 3px #e0e7ff}' +
    '.pcx .ch{height:38px;padding:0 13px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13.5px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '.pcx .ch.r{color:#dc2626;border-color:#fecaca;background:#fef2f2}.pcx .ch.r.on{background:#dc2626;color:#fff;border-color:#dc2626}' +
    '.pcx select.ch{padding-right:30px;max-width:230px;appearance:auto}.pcx select.ch.act{border-color:#f97316;color:#c2410c;background:#fff7ed}' +
    '.pc-list{display:grid;gap:10px;padding:8px 18px 20px}' +
    '.pc{background:#fff;border-radius:16px;padding:14px 16px;border:1px solid #eef2f7;box-shadow:0 1px 3px rgba(15,23,42,.06);border-left:5px solid var(--sc);display:grid;grid-template-columns:minmax(0,1fr) 170px;gap:4px 18px;cursor:pointer;transition:box-shadow .15s}' +
    '.pc:hover{box-shadow:0 4px 14px rgba(15,23,42,.1)}' +
    '.pc .l1{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
    '.pc-tg{border-radius:7px;padding:2px 8px;font-weight:600;font-size:12px;white-space:nowrap}.pc-rn{background:#eff6ff;color:#1d4ed8;font-size:13px;font-family:"IBM Plex Mono",monospace}.pc-bt{background:#f1f5f9;color:#475569}' +
    '.pc-more{cursor:pointer;font-family:inherit}.pc .dt{font-size:12.5px;color:#94a3b8}' +
    '.pc .sb{border-radius:999px;padding:3px 11px;font-size:12.5px;font-weight:700;background:var(--sb);color:var(--sc);white-space:nowrap}' +
    '.pc .nm{font-size:16px;font-weight:700;line-height:1.4;margin-top:5px;color:#1e293b;word-break:break-word}' +
    '.pc .meta{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:5px;align-items:center;font-size:13px;color:#64748b}' +
    '.pc-ids{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:#64748b}' +
    '.pc .mp{color:#fff;background:#3b82f6;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap}.pc .mp:hover{background:#2563eb}' +
    '.pc .att{display:inline-flex;gap:5px;align-items:center;font-size:12.5px;color:#1d4ed8;background:#eff6ff;border-radius:8px;padding:2px 9px;font-weight:600;cursor:pointer}' +
    '.pc .atl{grid-column:1/-1;display:none;flex-wrap:wrap;gap:6px;margin-top:6px}.pc .atl.on{display:flex}.pc .atl a{font-size:12.5px;color:#1d4ed8;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:3px 9px;text-decoration:none;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.pc .r{text-align:right}.pc .r small{display:block;font-size:12px;color:#64748b;font-weight:600}.pc .r b{display:block;font-size:26px;line-height:1.2;white-space:nowrap}.pc .r .d{font-size:12px;color:#64748b}' +
    '.pc-pipe{grid-column:1/-1;display:flex;align-items:center;margin-top:10px}' +
    '.pc-pipe .p{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#94a3b8;white-space:nowrap}' +
    '.pc-pipe .p i{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:11px;background:#e2e8f0;color:#94a3b8;font-weight:700;flex-shrink:0}' +
    '.pc-pipe .p.ok{color:#059669}.pc-pipe .p.ok i{background:#10b981;color:#fff}.pc-pipe .p.now{color:var(--sc)}.pc-pipe .p.now i{background:var(--sc);color:#fff;box-shadow:0 0 0 4px var(--sb)}' +
    '.pc-pipe .p.bad{color:#dc2626}.pc-pipe .p.bad i{background:#ef4444;color:#fff}' +
    '.pc-pipe .ln{flex:1;height:3px;background:#e2e8f0;margin:0 8px;border-radius:2px;min-width:14px}.pc-pipe .ln.ok{background:#10b981}' +
    '.pc .note{grid-column:1/-1;margin-top:8px;background:#f8fafc;border-radius:10px;padding:7px 11px;font-size:13px;color:#475569;line-height:1.5}.pc .note b{color:#334155}' +
    '.pc .note.bad{background:#fef2f2;color:#991b1b}.pc .note.bad b{color:#991b1b}' +
    '.pc .ft{grid-column:1/-1;display:flex;align-items:center;gap:8px 10px;margin-top:8px;padding-top:10px;border-top:1px dashed #e2e8f0;flex-wrap:wrap}' +
    '.pc-who{font-size:13px;color:#64748b;display:flex;gap:4px 14px;flex-wrap:wrap;flex:1;min-width:0}.pc-who i{margin-right:4px;color:#94a3b8}' +
    '.pc .btn{height:38px;padding:0 14px;border-radius:10px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '.pc .btn:hover{background:#f8fafc}.pc .btn.p{color:#fff;border-color:transparent;padding:0 18px;background:var(--bc)}.pc .btn.p:hover{filter:brightness(.92)}' +
    '.pc-empty{text-align:center;padding:50px 16px;color:#94a3b8}.pc-empty i{font-size:44px;opacity:.35;display:block;margin-bottom:10px}' +
    '.pc-cnt{text-align:center;font-size:12.5px;color:#94a3b8;padding:4px 0 14px}' +
    '@media(max-width:700px){.pcx{padding:12px 12px 4px}.pc-list{padding:6px 10px 16px}.pcx .ttl .tb span{display:none}.pcx .ttl .tb{padding:0 12px}' +
    ' .pc{grid-template-columns:1fr;padding:12px}.pc .r{text-align:left;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;background:var(--sb);border-radius:10px;padding:6px 10px;margin-top:6px}' +
    ' .pc .r b{font-size:20px;display:inline}.pc .r small{display:inline}' +
    ' .pc-pipe .p span{display:none}.pc-pipe .p.now span,.pc-pipe .p.bad span{display:inline}' +
    ' .pc .ft .btn{flex:1}.pc-who{flex-basis:100%}.pc .nm{font-size:15.5px}' +
    ' .pcx .f1>.ch,.pcx .f1>select{flex-shrink:0}.pcx .s{min-width:96px;padding:7px 10px}.pcx .s b{font-size:19px}}';

  function addCss() { if ($('pcxCss')) return; var s = document.createElement('style'); s.id = 'pcxCss'; s.textContent = css; document.head.appendChild(s); }

  // เปิด/ย่อ หมายเลขงาน, รายการไฟล์ — ไม่ให้ไปเปิดรายละเอียดงาน
  document.addEventListener('click', function (e) {
    var m = e.target.closest && e.target.closest('.pc-more');
    if (m) { e.stopPropagation(); m.parentNode.innerHTML = m.dataset.all.split('|').map(function (s) { return '<div>' + esc(s) + '</div>'; }).join(''); return; }
    var a = e.target.closest && e.target.closest('.pc .att');
    if (a) { e.stopPropagation(); var l = a.closest('.pc').querySelector('.atl'); if (l) l.classList.toggle('on'); return; }
    if (e.target.closest && e.target.closest('.pc .ft, .pc a, .pc .atl, .ctl-name')) return;
    var c = e.target.closest && e.target.closest('.pc[data-id]');
    if (c && typeof openDetailModal === 'function') openDetailModal(Number(c.dataset.id));
  });

  // ทยอยแสดงทีละ 40 การ์ด
  function Pager(listEl, cntEl, html) {
    var rows = [], shown = 0, io = null, PAGE = 40;
    function more() {
      var n = Math.min(rows.length, shown + PAGE), h = '';
      for (var i = shown; i < n; i++) h += html(rows[i], i);
      var s = listEl.querySelector('.pc-sent'); if (s) s.remove();
      listEl.insertAdjacentHTML('beforeend', h); shown = n;
      cntEl.textContent = rows.length ? 'แสดง ' + shown.toLocaleString() + ' จาก ' + rows.length.toLocaleString() + ' รายการ' : '';
      if (shown < rows.length) {
        listEl.insertAdjacentHTML('beforeend', '<div class="pc-sent" style="height:1px"></div>');
        if (!io) io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) more(); }, { rootMargin: '600px' });
        io.observe(listEl.querySelector('.pc-sent'));
      }
    }
    return { set: function (r, empty) { rows = r; shown = 0; listEl.innerHTML = ''; if (!r.length) { listEl.innerHTML = empty; cntEl.textContent = ''; return; } more(); } };
  }

  function setupShell(pageId, oldHeadSel, tableWrapSel, headHtml) {
    var page = $(pageId); if (!page) return null;
    var card = page.querySelector('.bg-white.rounded-xl'); if (!card) return null;
    var oldHead = card.firstElementChild, wrap = card.querySelector(tableWrapSel);
    var x = document.createElement('div'); x.className = 'pcx'; x.innerHTML = headHtml;
    card.insertBefore(x, oldHead);
    oldHead.style.display = 'none'; if (wrap) wrap.style.display = 'none';
    var list = document.createElement('div'); list.className = 'pc-list'; card.appendChild(list);
    var cnt = document.createElement('div'); cnt.className = 'pc-cnt'; card.appendChild(cnt);
    void oldHeadSel;
    return { x: x, list: list, cnt: cnt };
  }

  function fillEntities(sel, data) {
    var cur = sel.value, set = {};
    data.forEach(function (r) { var e = String(r.responsibleEntity || '').trim(); if (e) set[e] = (set[e] || 0) + 1; });
    var keys = Object.keys(set).sort(function (a, b) { return set[b] - set[a]; });
    sel.innerHTML = '<option value="">ผู้รับผิดชอบ: ทั้งหมด</option>' + keys.map(function (k) { return '<option value="' + esc(k) + '">' + esc(k) + ' (' + set[k] + ')</option>'; }).join('');
    sel.value = keys.indexOf(cur) >= 0 ? cur : '';
    sel.classList.toggle('act', !!sel.value);
  }

  // ═════════════ ติดตามงาน ═════════════
  var TS = {
    'รับเรื่อง': ['#7c3aed', '#f5f3ff'], 'สำรวจงาน': ['#ca8a04', '#fefce8'], 'ดำเนินงาน': ['#ea580c', '#fff7ed'],
    'ตรวจรับงาน': ['#2563eb', '#eff6ff'], 'อนุมัติ/เสร็จสิ้น': ['#059669', '#ecfdf5'], 'ยกเลิก': ['#dc2626', '#fef2f2']
  };
  var TORD = ['รับเรื่อง', 'สำรวจงาน', 'ดำเนินงาน', 'ตรวจรับงาน', 'อนุมัติ/เสร็จสิ้น'];
  var T = { st: '', over: false, ent: '', sort: false, ui: null, pager: null };
  function tKey(s) { s = s || ''; for (var k in TS) if (s.indexOf(k) >= 0) return k; if (s.indexOf('เสร็จสิ้น') >= 0) return 'อนุมัติ/เสร็จสิ้น'; return 'รับเรื่อง'; }
  function tAge(r) { return days(r.payDate || r.receiveDate) || 0; }

  function trackBuild() {
    if (T.ui) return true;
    var ui = setupShell('page-list', null, '.overflow-x-auto',
      '<div class="ttl"><div class="ic" style="background:#dbeafe;color:#2563eb"><i class="fa-solid fa-table-list"></i></div>ติดตามงานทั้งหมด<span class="sp"></span>' +
      '<button class="tb" onclick="exportTrackingToExcel()"><i class="fa-solid fa-file-csv"></i><span>Export Excel</span></button></div>' +
      '<div class="st" id="tkSt"></div>' +
      '<div class="f1"><div class="srch" id="tkSrch"><i class="fa-solid fa-magnifying-glass"></i></div>' +
      '<button class="ch r" id="tkOver"><i class="fa-solid fa-clock"></i>ค้างเกิน 30 วัน <span id="tkOverN"></span></button>' +
      '<select class="ch" id="tkEnt"></select>' +
      '<button class="ch" id="tkSort"><i class="fa-solid fa-arrow-down-wide-short"></i><span>เรียงตามเดิม</span></button></div>');
    if (!ui) return false;
    addCss(); T.ui = ui;
    var si = $('searchInput'); si.placeholder = 'ค้นหาเลขที่ / ชื่องาน / หมายเลขงาน / ที่อยู่ / ผู้รับจ้าง'; $('tkSrch').appendChild(si);
    T.pager = Pager(ui.list, ui.cnt, trackCard);
    $('tkSt').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; T.st = b.dataset.s; var ss = $('searchStatus'); if (ss) ss.value = T.st; trackRender(); });
    $('tkOver').addEventListener('click', function () { T.over = !T.over; trackRender(); });
    $('tkEnt').addEventListener('change', function () { T.ent = this.value; trackRender(); });
    $('tkSort').addEventListener('click', function () { T.sort = !T.sort; trackRender(); });
    return true;
  }

  function trackCard(r) {
    var k = tKey(r.status), c = TS[k], age = tAge(r), cancel = k === 'ยกเลิก';
    var lab = esc(r.status || 'รับเรื่อง') + (r.status === 'ตรวจรับงาน' ? (r.inspectionStatus === 'ผ่านการตรวจรับ' ? ' · ผ่าน' : /ไม่ผ่าน/.test(r.inspectionStatus || '') ? ' · ไม่ผ่าน' : ' · รอ') : '');
    var co = String(r.coordinates || '').trim();
    return '<div class="pc" data-id="' + r.id + '" style="--sc:' + c[0] + ';--sb:' + c[1] + ';--bc:#2563eb">' +
      '<div style="min-width:0"><div class="l1"><span class="pc-tg pc-rn">' + esc(r.receiveNo || '-') + '</span>' + (r.receiveDate ? '<span class="dt">' + esc(dth(r.receiveDate)) + '</span>' : '') + '<span class="sb">' + lab + '</span></div>' +
        '<div class="nm">' + esc(r.jobName || '-') + '</div>' +
        '<div class="meta">' + (r.budgetType ? '<span class="pc-tg pc-bt">' + esc(r.budgetType) + '</span>' : '') + idsHtml(r.jobIds) +
          (r.location ? '<span><i class="fa-solid fa-location-dot" style="color:#ef4444;margin-right:4px"></i>' + esc(r.location) + '</span>' : '') +
          (co ? '<a class="mp" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(co) + '"><i class="fa-solid fa-map-location-dot"></i> แผนที่</a>' : '') + '</div></div>' +
      '<div class="r"><small>อายุงาน</small><b style="color:' + (age > 30 && !cancel ? '#dc2626' : '#334155') + '">' + age + ' วัน</b><span class="d">' + (r.payDate ? 'ส่งมอบ ' + esc(dth(r.payDate)) : age > 30 ? 'เกิน 30 วัน' : 'นับจากวันรับเรื่อง') + '</span></div>' +
      (cancel ? '' : pipe(['รับเรื่อง', 'สำรวจ', 'ดำเนินงาน', 'ตรวจรับ', 'เสร็จสิ้น'], TORD.indexOf(k) === 4 ? 5 : TORD.indexOf(k), r.status === 'ตรวจรับงาน' && /ไม่ผ่าน/.test(r.inspectionStatus || ''))) +
      (r.jobStatus ? '<div class="note"><b>สถานะงาน:</b> ' + esc(r.jobStatus) + '</div>' : '') +
      '<div class="ft">' + who(r) + '</div>' +
        '<button class="btn" onclick="openEditModal(' + r.id + ')"><i class="fa-solid fa-pen" style="color:#f97316"></i>แก้ไข</button>' +
        '<button class="btn" onclick="changeStatus(' + r.id + ',\'' + esc(r.status || '') + '\')"><i class="fa-solid fa-rotate" style="color:#16a34a"></i>เปลี่ยนสถานะ</button>' +
        '<button class="btn p" onclick="openDetailModal(' + r.id + ')"><i class="fa-solid fa-eye"></i>ดูรายละเอียด</button></div></div>';
  }

  function trackRender() {
    if (!trackBuild()) return;
    var data = (g('allData', []) || []).filter(function (r) { return r.status !== 'ปิดงานแล้วเสร็จ'; });
    var q = ($('searchInput').value || '').toLowerCase().trim();
    var base = !q ? data : data.filter(function (r) { return [r.jobName, r.receiveNo, r.jobIds, r.location, r.responsibleEntity, r.assignee, r.jobStatus].some(function (v) { return String(v || '').toLowerCase().indexOf(q) >= 0; }); });
    fillEntities($('tkEnt'), data); T.ent = $('tkEnt').value;
    if (T.ent) base = base.filter(function (r) { return String(r.responsibleEntity || '').trim() === T.ent; });
    // นับต่อสถานะ (ตามคำค้น/ผู้รับจ้าง)
    var cnt = { '': base.length }; Object.keys(TS).forEach(function (k) { cnt[k] = 0; });
    base.forEach(function (r) { cnt[tKey(r.status)]++; });
    $('tkSt').innerHTML = [['', 'ทั้งหมด', '#334155', '#f1f5f9']].concat(Object.keys(TS).map(function (k) { return [k, k, TS[k][0], TS[k][1]]; })).map(function (x) {
      return '<button class="s' + (T.st === x[0] ? ' on' : '') + '" data-s="' + x[0] + '" style="color:' + x[2] + ';background:' + x[3] + '"><small>' + x[1] + '</small><b>' + cnt[x[0]] + '</b></button>';
    }).join('');
    var rows = T.st ? base.filter(function (r) { return tKey(r.status) === T.st; }) : base;
    var overN = rows.filter(function (r) { return tKey(r.status) !== 'ยกเลิก' && tAge(r) > 30; }).length;
    $('tkOverN').textContent = '· ' + overN; $('tkOver').classList.toggle('on', T.over);
    if (T.over) rows = rows.filter(function (r) { return tKey(r.status) !== 'ยกเลิก' && tAge(r) > 30; });
    if (T.sort) rows = rows.slice().sort(function (a, b) { return tAge(b) - tAge(a); });
    $('tkSort').querySelector('span').textContent = T.sort ? 'ค้างนานสุดก่อน' : 'เรียงตามเดิม';
    var b = $('trackCountBadge'); if (b) b.innerText = data.length + ' รายการ';
    T.pager.set(rows, '<div class="pc-empty"><i class="fa-solid fa-inbox"></i><div style="font-weight:700;color:#64748b">ไม่พบงาน</div></div>');
  }

  // ═════════════ ตรวจรับงาน ═════════════
  var I = { st: '', over: false, ent: '', sort: false, ui: null, pager: null };
  var IS = {
    wait: ['รอตรวจรับ', '#ca8a04', '#fefce8'], fail: ['ไม่ผ่าน · รอแก้ไข', '#dc2626', '#fef2f2'],
    std: ['รอตรวจมาตรฐาน', '#0d9488', '#f0fdfa'], ready: ['พร้อมส่งปิดงาน', '#7c3aed', '#f5f3ff']
  };
  function iInfo(r) {
    var tl = Array.isArray(r.jobTimeline) ? r.jobTimeline : [];
    var ins = r.inspectionStatus || 'รอตรวจสอบ', pass = ins === 'ผ่านการตรวจรับ', fail = /ไม่ผ่าน/.test(ins);
    var std = tl.slice().reverse().find(function (h) { return h.status === 'ตรวจมาตรฐาน'; });
    var stdPass = !!(std && std.details && std.details.indexOf('ผ่านการตรวจมาตรฐาน') >= 0 && std.details.indexOf('ไม่ผ่านการตรวจมาตรฐาน') < 0);
    var stdFail = !!(std && std.details && std.details.indexOf('ไม่ผ่านการตรวจมาตรฐาน') >= 0);
    var stage = fail ? 'fail' : !pass ? 'wait' : !stdPass ? 'std' : 'ready';
    var dlv = r.payDate ? new Date(r.payDate) : null; if (dlv && isNaN(dlv)) dlv = null;
    var d = null, d2 = null, failNote = '';
    if (dlv) {
      if (pass) { var pe = tl.slice().reverse().find(function (h) { return h.status === 'ตรวจรับงาน' && h.details && h.details.indexOf('ผ่าน') >= 0 && h.details.indexOf('ไม่ผ่าน') < 0; }); d = days(dlv, pe ? new Date(pe.timestamp) : new Date()); }
      else d = days(dlv);
    }
    if (fail) {
      var fe = tl.slice().reverse().find(function (h) { return h.status === 'ตรวจรับงาน' && h.details && h.details.indexOf('ไม่ผ่าน') >= 0; });
      if (fe) { d2 = days(fe.timestamp); failNote = String(fe.details || '').replace(/^.*?ไม่ผ่านการตรวจรับ\s*[:：\-–]?\s*/, '').trim(); }
    }
    return { stage: stage, pass: pass, stdPass: stdPass, stdFail: stdFail, ins: ins, dlv: dlv, d: d, d2: d2, failNote: failNote };
  }

  function inspBuild() {
    if (I.ui) return true;
    var ui = setupShell('page-inspection', null, '.overflow-x-auto',
      '<div class="ttl"><div class="ic" style="background:#dcfce7;color:#16a34a"><i class="fa-solid fa-clipboard-check"></i></div>ระบบตรวจรับงาน<span class="sp"></span>' +
      '<button class="tb" onclick="openInspectionMap()"><i class="fa-solid fa-map-location-dot"></i><span>แผนที่ตรวจงาน</span></button></div>' +
      '<div class="st" id="isSt"></div>' +
      '<div class="f1"><div class="srch" id="isSrch"><i class="fa-solid fa-magnifying-glass"></i></div>' +
      '<button class="ch r" id="isOver"><i class="fa-solid fa-clock"></i>รอเกิน 14 วัน <span id="isOverN"></span></button>' +
      '<select class="ch" id="isEnt"></select>' +
      '<button class="ch" id="isSort"><i class="fa-solid fa-arrow-down-wide-short"></i><span>เรียงตามเดิม</span></button></div>');
    if (!ui) return false;
    addCss(); I.ui = ui;
    var si = $('inspectionSearchInput'); si.placeholder = 'ค้นหาเลขที่ / ชื่องาน / หมายเลขงาน / ผู้รับจ้าง'; $('isSrch').appendChild(si);
    I.pager = Pager(ui.list, ui.cnt, inspCard);
    $('isSt').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; I.st = b.dataset.s; inspRender(); });
    $('isOver').addEventListener('click', function () { I.over = !I.over; inspRender(); });
    $('isEnt').addEventListener('change', function () { I.ent = this.value; inspRender(); });
    $('isSort').addEventListener('click', function () { I.sort = !I.sort; inspRender(); });
    return true;
  }

  function inspCard(r) {
    var f = r.__i, s = IS[f.stage];
    var atts = []; try { atts = JSON.parse(r.attachments || '[]'); } catch (e) { atts = []; } if (!Array.isArray(atts)) atts = [];
    var age = days(r.payDate || r.receiveDate) || 0;
    var dc = f.d == null ? '#94a3b8' : f.stage === 'fail' ? '#dc2626' : f.stage === 'ready' || (f.pass && f.stage === 'std') ? '#059669' : f.d > 14 ? '#dc2626' : f.d > 7 ? '#d97706' : '#059669';
    var big = f.d == null ? '-' : f.stage === 'fail' && f.d2 != null ? f.d + ' / ' + f.d2 + ' วัน' : f.d + ' วัน';
    var cap = f.stage === 'fail' ? 'ตรวจรับ / แก้ไข' : f.pass ? 'ใช้เวลาตรวจรับ' : 'รอตรวจรับมาแล้ว';
    var cur = f.stage === 'wait' || f.stage === 'fail' ? 0 : f.stage === 'std' ? 1 : 2;
    var next = f.stage === 'wait' ? ['inspectJob(' + r.id + ',\'' + esc(f.ins) + '\')', 'fa-clipboard-check', 'ตรวจรับ', '#16a34a']
      : f.stage === 'fail' ? ['inspectJob(' + r.id + ',\'' + esc(f.ins) + '\')', 'fa-clipboard-check', 'ตรวจรับซ้ำ', '#16a34a']
      : f.stage === 'std' ? ['openStdFormModal(' + r.id + ')', 'fa-star-half-stroke', f.stdFail ? 'ตรวจมาตรฐานซ้ำ' : 'ตรวจมาตรฐาน', '#0d9488']
      : ['sendToCloseFromInspection(' + r.id + ')', 'fa-paper-plane', 'ส่งปิดงาน', '#7c3aed'];
    return '<div class="pc" data-id="' + r.id + '" style="--sc:' + s[1] + ';--sb:' + s[2] + ';--bc:' + next[3] + '">' +
      '<div style="min-width:0"><div class="l1"><span class="pc-tg pc-rn">' + esc(r.receiveNo || '-') + '</span><span class="sb">' + s[0] + (f.stage === 'std' && f.stdFail ? ' (ไม่ผ่านครั้งก่อน)' : '') + '</span></div>' +
        '<div class="nm">' + esc(r.jobName || '-') + '</div>' +
        '<div class="meta">' + (r.budgetType ? '<span class="pc-tg pc-bt">' + esc(r.budgetType) + '</span>' : '') + idsHtml(r.jobIds) +
          (atts.length ? '<span class="att"><i class="fa-solid fa-paperclip"></i>เอกสาร ' + atts.length + ' ไฟล์</span>' : '') + '</div></div>' +
      '<div class="r"><small>' + cap + '</small><b style="color:' + dc + '">' + big + '</b><span class="d">' + (f.dlv ? 'ส่งมอบ ' + esc(dth(r.payDate)) : 'ยังไม่ระบุวันส่งมอบ') + '</span></div>' +
      (atts.length ? '<div class="atl">' + atts.map(function (a) {
        return '<a href="' + esc(a.fileUrl) + '" target="_blank" rel="noopener"><i class="fa-solid ' + (a.mimeType === 'application/pdf' ? 'fa-file-pdf" style="color:#ef4444' : 'fa-file-image" style="color:#3b82f6') + '"></i> ' + esc(a.fileName) + '</a>';
      }).join('') + '</div>' : '') +
      pipe(['ตรวจรับ', 'ตรวจมาตรฐาน', 'ส่งปิดงาน'], cur, f.stage === 'fail') +
      (f.stage === 'fail' ? '<div class="note bad"><b>ต้องแก้ไข:</b> ' + esc(f.failNote || 'ดูรายละเอียดในประวัติงาน') + '</div>' : '') +
      '<div class="ft">' + who(r) + '<span><i class="fa-regular fa-clock"></i>อายุงาน ' + age + ' วัน</span></div>' +
        '<button class="btn" onclick="openDetailModal(' + r.id + ')"><i class="fa-solid fa-eye" style="color:#3b82f6"></i>รายละเอียด</button>' +
        (f.pass ? '<button class="btn" onclick="inspectJob(' + r.id + ',\'' + esc(f.ins) + '\')" title="แก้ผลตรวจรับ"><i class="fa-solid fa-clipboard-check" style="color:#16a34a"></i>ตรวจรับ ✓</button>' : '') +
        (f.stage === 'ready' ? '<button class="btn" onclick="openStdFormModal(' + r.id + ')"><i class="fa-solid fa-star-half-stroke" style="color:#0d9488"></i>มาตรฐาน ✓</button>' : '') +
        '<button class="btn p" onclick="' + next[0] + '"><i class="fa-solid ' + next[1] + '"></i>' + next[2] + '</button></div></div>';
  }

  function inspRender() {
    if (!inspBuild()) return;
    var data = (g('allData', []) || []).filter(function (r) { return r.status === 'ตรวจรับงาน'; });
    data.forEach(function (r) { r.__i = iInfo(r); });
    var q = ($('inspectionSearchInput').value || '').toLowerCase().trim();
    var base = !q ? data : data.filter(function (r) { return [r.jobName, r.receiveNo, r.jobIds, r.assignee, r.responsibleEntity].some(function (v) { return String(v || '').toLowerCase().indexOf(q) >= 0; }); });
    fillEntities($('isEnt'), data); I.ent = $('isEnt').value;
    if (I.ent) base = base.filter(function (r) { return String(r.responsibleEntity || '').trim() === I.ent; });
    var cnt = { '': base.length, wait: 0, fail: 0, std: 0, ready: 0 };
    base.forEach(function (r) { cnt[r.__i.stage]++; });
    $('isSt').innerHTML = [['', 'ทั้งหมด', '#334155', '#f1f5f9']].concat(Object.keys(IS).map(function (k) { return [k, IS[k][0], IS[k][1], IS[k][2]]; })).map(function (x) {
      return '<button class="s' + (I.st === x[0] ? ' on' : '') + '" data-s="' + x[0] + '" style="color:' + x[2] + ';background:' + x[3] + '"><small>' + x[1] + '</small><b>' + cnt[x[0]] + '</b></button>';
    }).join('');
    var rows = I.st ? base.filter(function (r) { return r.__i.stage === I.st; }) : base;
    var waitLong = function (r) { return !r.__i.pass && r.__i.d != null && r.__i.d > 14; };
    $('isOverN').textContent = '· ' + rows.filter(waitLong).length; $('isOver').classList.toggle('on', I.over);
    if (I.over) rows = rows.filter(waitLong);
    if (I.sort) rows = rows.slice().sort(function (a, b) { return (b.__i.pass ? -1 : b.__i.d || 0) - (a.__i.pass ? -1 : a.__i.d || 0); });
    $('isSort').querySelector('span').textContent = I.sort ? 'รอนานสุดก่อน' : 'เรียงตามเดิม';
    var b = $('inspectionCountBadge'); if (b) b.innerText = data.length + ' รายการ';
    I.pager.set(rows, '<div class="pc-empty"><i class="fa-solid fa-clipboard-check"></i><div style="font-weight:700;color:#64748b">ไม่มีงานในกลุ่มนี้</div></div>');
  }

  // แทนที่ฟังก์ชันวาดตารางเดิม (ข้อมูลที่ส่งเข้ามาถูกกรองใหม่จาก allData ตามตัวกรองบนหน้า)
  window.renderTable = function () { try { trackRender(); } catch (e) { console.error('[pages-ui track]', e); } };
  window.filterTable = window.renderTable;
  window.renderInspectionTable = function () { try { inspRender(); } catch (e) { console.error('[pages-ui insp]', e); } };
  window.filterInspectionTable = window.renderInspectionTable;
  function boot() { var d = g('allData', null); if (Array.isArray(d) && d.length) { window.renderTable(); window.renderInspectionTable(); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
