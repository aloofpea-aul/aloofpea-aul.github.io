/* Contractor Portal — หน้า "งานของฉัน" แบบใหม่ (ส่วนที่ 1)
   - เปิดมาเจอรายการงาน "ต้องทำ" ทันที (ไม่ใช่ภาพรวม)
   - ตัวเลขสรุปเป็นปุ่มกรอง: ต้องทำ / รอตรวจรับ / เสร็จ / ทั้งหมด
   - กล่อง "📌 ต้องทำก่อน": PEA ตอบกลับ · ไม่อัปเดตเกิน 7 วัน · ถึง 100% แต่ยังไม่แจ้งส่งมอบ (กดเพื่อกรอง)
   - การ์ดงานใหม่: วงแหวน % · แถบขั้นงาน · ปุ่มลัด อัปเดต / ส่งรูป / ส่งมอบ · เรียงงานที่ควรทำก่อนขึ้นบน
   โหลดก่อน contractor-extra.js (ส่วนเสริมเดิมยังครอบ renderJobs ต่อได้เหมือนเดิม) */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var DONE = ['อนุมัติ/เสร็จสิ้น', 'ปิดงานแล้วเสร็จ'], CANCEL = 'ยกเลิก', INSP = 'ตรวจรับงาน', STALE = 7;
  var TODO = null, first = true;

  var css =
    '#appScreen > .bg-white.sticky .flex.gap-1.overflow-x-auto{display:none!important}' +
    '.chx{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:2px}.chx button{border:2px solid #E2E8F0;background:#fff;border-radius:12px;padding:5px 2px 6px;font:700 11.5px inherit;font-family:inherit;color:#64748B;cursor:pointer;line-height:1.15}' +
    '.chx button b{display:block;font-size:18px;color:#334155}.chx button.on{border-color:#0D9488;background:#F0FDFA;color:#0F766E}.chx button.on b{color:#0F766E}' +
    '.tdx{background:#fff;border-radius:14px;border-left:5px solid #F59E0B;padding:9px 12px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,.05)}' +
    '.tdx h4{margin:0 0 4px;font-size:13.5px;font-weight:800;color:#1E293B}.tdx button{display:flex;width:100%;gap:7px;align-items:center;border:0;background:none;padding:5px 2px;font:13px inherit;font-family:inherit;color:#334155;cursor:pointer;text-align:left;border-radius:8px}' +
    '.tdx button:hover{background:#FFFBEB}.tdx button b{margin-left:auto;color:#B45309;white-space:nowrap}.tdx button.on{background:#FEF3C7}' +
    '.tdf{display:flex;align-items:center;gap:8px;background:#FEF3C7;color:#92400E;border-radius:10px;padding:7px 12px;font-size:13px;font-weight:700;margin-bottom:10px}.tdf button{margin-left:auto;border:0;background:#fff;color:#92400E;border-radius:8px;padding:3px 10px;font-weight:700;cursor:pointer;font-family:inherit}' +
    '.jlb{font-size:12px;font-weight:700;color:#64748B;margin:2px 2px 8px}' +
    '.jx{background:#fff;border-radius:16px;padding:12px 13px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer;border:1.5px solid transparent;transition:border-color .15s}.jx:hover{border-color:#99F6E4}' +
    '.jx .h{display:flex;gap:11px;align-items:flex-start}.jx .rg{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;flex-shrink:0}.jx .rg span{width:36px;height:36px;border-radius:50%;background:#fff;display:grid;place-items:center;font-size:11.5px;font-weight:800;color:#0F766E}' +
    '.jx .n{font-weight:800;font-size:14.5px;line-height:1.3;color:#1E293B}.jx .s{font-size:12px;color:#64748B;margin-top:1px}.jx .s i{color:#94A3B8}' +
    '.jx .st{display:inline-block;font-size:11px;font-weight:700;border-radius:6px;padding:0 7px;margin-left:4px;vertical-align:1px}' +
    '.jx .pp{display:flex;gap:3px;margin:10px 0 3px}.jx .pp i{flex:1;height:5px;border-radius:3px;background:#E2E8F0}.jx .pp i.d{background:#0D9488}.jx .pp i.c{background:#F59E0B}' +
    '.jx .pl{display:flex;justify-content:space-between;font-size:10.5px;color:#94A3B8;font-weight:600}.jx .pl .c{color:#B45309}' +
    '.jx .wn{font-size:12px;border-radius:8px;padding:4px 9px;margin-top:8px;font-weight:700}' +
    '.jx .qa{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.jx .qa button{border:0;border-radius:10px;padding:8px 2px;font:700 12.5px inherit;font-family:inherit;background:#F1F5F9;color:#334155;cursor:pointer}' +
    '.jx .qa button.p{background:#0D9488;color:#fff}.jx .qa button:active{transform:scale(.97)}' +
    '.jx .ft{display:flex;justify-content:space-between;font-size:11.5px;color:#94A3B8;margin-top:8px}' +
    '@media(min-width:900px){#jobList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;align-items:start}#jobList>.tdx,#jobList>.tdf,#jobList>.jlb,#jobList>.empty-state{grid-column:1/-1}}' +
    '.jx.ins{border-color:#E9D5FF}.jx.dn{opacity:.85}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function ups(j) { return Array.isArray(j.updates) ? j.updates : []; }
  function lastOwn(j) { var u = ups(j); for (var i = u.length - 1; i >= 0; i--) if (u[i] && u[i].updateType !== 'pea_reply') return u[i]; return null; }
  function prog(j) { var u = ups(j), p = 0; u.forEach(function (x) { var v = parseInt(x && x.progress, 10); if (v > p) p = v; }); return p; }
  function isDone(j) { return DONE.indexOf(j.status) >= 0; }
  function isActive(j) { return !isDone(j) && j.status !== INSP && j.status !== CANCEL; }
  function daysSince(ts) { var t = new Date(ts).getTime(); return isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); }
  function stale(j) { if (!isActive(j)) return null; var l = lastOwn(j), d = daysSince(l ? l.timestamp : j.receiveDate); return d != null && d > STALE ? d : null; }
  function reply(j) { var u = ups(j), l = u[u.length - 1]; return !!(l && l.updateType === 'pea_reply') && !isDone(j); }
  function delivered(j) { return ups(j).some(function (x) { return x && x.updateType === 'delivery'; }); }
  function ready(j) { return isActive(j) && prog(j) >= 100 && !delivered(j); }
  function stage(j) { // 0 รับงาน 1 ก่อสร้าง 2 ส่งมอบ 3 ตรวจรับ 4 เสร็จ
    if (isDone(j)) return 4; if (j.status === INSP) return 3; if (delivered(j) || prog(j) >= 100) return 2; if (prog(j) > 0 || lastOwn(j)) return 1; return 0;
  }
  function ago(ts) { var d = daysSince(ts); if (d == null) return ''; return d <= 0 ? 'วันนี้' : d === 1 ? 'เมื่อวาน' : d + ' วันก่อน'; }
  var TODOS = { reply: ['💬', 'PEA ตอบกลับ — รอท่านอัปเดต', reply], stale: ['⏰', 'ไม่ได้อัปเดตเกิน ' + STALE + ' วัน', function (j) { return stale(j) != null; }], ready: ['✅', 'ถึง 100% แต่ยังไม่แจ้งส่งมอบ', ready] };
  function score(j) { return (reply(j) ? 300 : 0) + (ready(j) ? 200 : 0) + (stale(j) != null ? 100 + Math.min(stale(j), 99) : 0); }

  function chips() {
    var bar = document.querySelector('#appScreen > .bg-white.sticky'); if (!bar) return;
    var box = $('chx');
    if (!box) { box = document.createElement('div'); box.id = 'chx'; box.className = 'chx'; bar.appendChild(box);
      box.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; TODO = null; switchMainTab(b.dataset.t); window.scrollTo(0, 0); }); }
    var J = window._jobs || [], c = { active: 0, inspect: 0, done: 0, all: J.length };
    J.forEach(function (j) { if (isActive(j)) c.active++; else if (j.status === INSP) c.inspect++; else if (isDone(j)) c.done++; });
    var t = window._curTab;
    box.innerHTML = [['active', 'ต้องทำ'], ['inspect', 'รอตรวจรับ'], ['done', 'เสร็จ'], ['all', 'ทั้งหมด']].map(function (x) {
      return '<button type="button" data-t="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '"><b>' + c[x[0]] + '</b>' + x[1] + '</button>';
    }).join('');
  }

  function card(j) {
    var p = prog(j), sg = stage(j), l = lastOwn(j), sd = stale(j), ins = j.status === INSP, dn = isDone(j);
    var ring = 'background:conic-gradient(' + (dn ? '#16A34A' : '#0D9488') + ' 0 ' + (dn ? 100 : p) + '%,#E2E8F0 0)';
    var STG = ['รับงาน', 'ก่อสร้าง', 'ส่งมอบ', 'ตรวจรับ', 'เสร็จ'];
    var stc = dn ? ['#DCFCE7', '#166534'] : ins ? ['#F3E8FF', '#6B21A8'] : j.status === CANCEL ? ['#F1F5F9', '#64748B'] : ['#E0F2FE', '#075985'];
    var warn = '';
    if (reply(j)) warn = ''; // ป้าย "PEA ตอบกลับ" มาจาก contractor-extra อยู่แล้ว
    else if (ready(j)) warn = '<div class="wn" style="background:#F0FDF4;color:#166534">✅ ถึง 100% แล้ว — กด "ส่งมอบ" เพื่อขอตรวจรับ</div>';
    else if (sd != null) warn = '<div class="wn" style="background:#FFFBEB;color:#B45309">⏰ ไม่ได้อัปเดต ' + sd + ' วัน</div>';
    else if (ins) warn = '<div class="wn" style="background:#FAF5FF;color:#7E22CE">🔍 อยู่ระหว่าง PEA ตรวจรับงาน</div>';
    var act = isActive(j);
    return '<div class="job-card jx' + (ins ? ' ins' : '') + (dn ? ' dn' : '') + '" onclick="openDetail(' + j.id + ')">' +
      '<div class="h"><div class="rg" style="' + ring + '"><span>' + (dn ? '✓' : p + '%') + '</span></div><div style="flex:1;min-width:0">' +
      '<div class="n">' + esc(j.jobName || '-') + '</div>' +
      '<div class="s">' + esc(j.receiveNo || '-') + '<span class="st" style="background:' + stc[0] + ';color:' + stc[1] + '">' + esc(j.status || '-') + '</span></div>' +
      '<div class="s"><i class="fa-solid fa-location-dot"></i> ' + esc(j.location || '-') + '</div></div></div>' +
      (j.status === CANCEL ? '' : '<div class="pp">' + STG.map(function (x, i) { return '<i class="' + (i < sg || dn ? 'd' : i === sg ? 'c' : '') + '"></i>'; }).join('') + '</div>' +
        '<div class="pl">' + STG.map(function (x, i) { return '<span class="' + (i === sg && !dn ? 'c' : '') + '">' + x + '</span>'; }).join('') + '</div>') +
      warn +
      (act ? '<div class="qa"><button type="button" data-q="progress" data-id="' + j.id + '" class="' + (ready(j) ? '' : 'p') + '">📊 อัปเดต</button><button type="button" data-q="photo" data-id="' + j.id + '">📷 ส่งรูป</button><button type="button" data-q="delivery" data-id="' + j.id + '" class="' + (ready(j) ? 'p' : '') + '">🚚 ส่งมอบ</button></div>' : '') +
      '<div class="ft"><span><i class="fa-solid fa-clock-rotate-left"></i> ' + (l ? 'อัปเดตล่าสุด ' + ago(l.timestamp) : 'ยังไม่มีการอัปเดต') + '</span><span style="color:#2563EB;font-weight:700">' + ups(j).length + ' รายการ ›</span></div></div>';
  }

  function renderJobs() {
    var list = $('jobList'); if (!list) return;
    if (first && (window._jobs || []).length) {
      first = false;
      if (window._curTab === 'all' || window._curTab === 'dashboard') {
        var hasAct = window._jobs.some(isActive);
        if (/[?&]job=\d+/.test(location.search)) window._curTab = 'all';
        else { window._curTab = hasAct ? 'active' : 'all'; setTimeout(function () { switchMainTab(window._curTab); }, 0); }
      }
    }
    chips();
    var kw = ($('searchInput') ? $('searchInput').value : '').trim().toLowerCase(), t = window._curTab, J = window._jobs || [];
    var a = J.filter(function (j) {
      if (TODO) return TODOS[TODO][2](j);
      return t === 'active' ? isActive(j) : t === 'inspect' ? j.status === INSP : t === 'done' ? isDone(j) : true;
    });
    if (kw) a = a.filter(function (j) { return [j.jobName, j.receiveNo, j.jobIds, j.location].join(' ').toLowerCase().indexOf(kw) >= 0; });
    a = a.slice().sort(function (x, y) { return (score(y) - score(x)) || (isActive(y) - isActive(x)) || String(y.receiveNo || '').localeCompare(String(x.receiveNo || '')); });
    var h = '';
    if (TODO) h += '<div class="tdf">' + TODOS[TODO][0] + ' ' + TODOS[TODO][1] + ' · ' + a.length + ' งาน<button type="button" data-todo="">✕ แสดงทั้งหมด</button></div>';
    else if (!kw && (t === 'active' || t === 'all')) {
      var rows = Object.keys(TODOS).map(function (k) { var n = J.filter(TODOS[k][2]).length; return n ? '<button type="button" data-todo="' + k + '">' + TODOS[k][0] + ' ' + TODOS[k][1] + '<b>' + n + ' งาน ›</b></button>' : ''; }).join('');
      if (rows) h += '<div class="tdx"><h4>📌 ต้องทำก่อน</h4>' + rows + '</div>';
    }
    if (!a.length) h += '<div class="empty-state"><i class="fa-solid fa-clipboard-list"></i><p style="font-weight:600">' + (kw ? 'ไม่พบรายการที่ค้นหา' : 'ไม่มีงานในกลุ่มนี้') + '</p></div>';
    else {
      if (!TODO && !kw) h += '<div class="jlb">' + ({ active: 'กำลังดำเนินการ · เรียงงานที่ควรทำก่อนขึ้นบน', inspect: 'ส่งมอบแล้ว · รอ PEA ตรวจรับ', done: 'เสร็จสิ้นแล้ว', all: 'งานทั้งหมด' }[t] || '') + ' · ' + a.length + ' งาน</div>';
      h += a.map(card).join('');
    }
    list.innerHTML = h;
  }

  // ปุ่มลัดบนการ์ด / กล่องต้องทำก่อน
  document.addEventListener('click', function (e) {
    var td = e.target.closest && e.target.closest('#jobList [data-todo]');
    if (td) { e.stopPropagation(); TODO = td.dataset.todo || null; window.renderJobs(); window.scrollTo(0, 0); return; }
    var q = e.target.closest && e.target.closest('#jobList [data-q]'); if (!q) return;
    e.stopPropagation(); e.preventDefault();
    var id = Number(q.dataset.id); openDetail(id);
    if (q.dataset.q === 'photo') {
      openUpdateSheet('note');
      setTimeout(function () { try { addAttachRow(); var f = document.querySelector('#attachList input[type=file]'); if (f) f.click(); } catch (x) {} }, 120);
    } else openUpdateSheet(q.dataset.q);
  }, true);

  var os = window.switchMainTab;
  if (typeof os === 'function') window.switchMainTab = function (t) { if (t !== window._curTab) TODO = null; var r = os.apply(this, arguments); chips(); return r; };
  window.renderJobs = renderJobs;
})();
