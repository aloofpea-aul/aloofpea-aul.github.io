/* CCL — หน้า "อนุมัติรายจ่าย" แบบการ์ด: กล่องสรุปยอด + ช่วงเวลา + จัดกลุ่มตามวัน + เลือกหลายรายการพิมพ์ทีเดียว
   ใช้ openPrintPreview / buildExpenseHTML / printableArea เดิม — แบบฟอร์มใบอนุมัติเหมือนเดิมทุกอย่าง */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  function m(n) { return (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  var TL = { labor: 'ค่าแรง', supervision: 'ค่าคุมงาน', misc: 'ค่าเบ็ดเตล็ด' };
  var TC = { labor: ['#1d4ed8', '#eff6ff', '#bfdbfe', 'fa-hammer'], supervision: ['#7e22ce', '#faf5ff', '#e9d5ff', 'fa-helmet-safety'], misc: ['#b45309', '#fffbeb', '#fde68a', 'fa-box-open'] };
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var S = { per: 'all', sel: {}, rows: [], shown: 0, ui: false };

  function pad(c) { try { return padCode(c); } catch (e) { c = String(c || ''); while (c.length < 4) c = '0' + c; return c; } }
  function ymd(v) {
    var s = String(v || ''); var mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (mm) return mm[1] + '-' + mm[2] + '-' + mm[3];
    var d = new Date(s); if (isNaN(d)) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dayLabel(k) {
    if (!k) return 'ไม่ระบุวันที่';
    var p = k.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), t = new Date(); t.setHours(0, 0, 0, 0);
    var diff = Math.round((t - d) / 86400000), base = d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2);
    return (diff === 0 ? 'วันนี้ · ' : diff === 1 ? 'เมื่อวาน · ' : '') + base;
  }

  var css =
    '#apx{padding:16px 18px 6px}#apx .ttl{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700;color:#1e293b}' +
    '#apx .ttl .ic{width:38px;height:38px;border-radius:11px;background:#ffedd5;color:#ea580c;display:grid;place-items:center;font-size:17px}#apx .ttl .sp{flex:1}' +
    '#apx .tb{height:40px;padding:0 15px;border-radius:11px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:0;background:#059669;color:#fff;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#apx .kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0 12px}' +
    '#apx .k{border-radius:14px;padding:8px 12px;min-width:0}#apx .k small{display:block;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#apx .k b{font-size:21px;line-height:1.3;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#apx .f1{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
    '#apx .srch{flex:1;min-width:220px;position:relative}#apx .srch>i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8}' +
    '#apx .srch input{width:100% !important;height:46px;border:1.5px solid #cbd5e1 !important;border-radius:12px !important;padding:0 12px 0 40px !important;font-size:15px !important;background:#f8fafc}' +
    '#apx .ch{height:38px;padding:0 13px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13.5px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#apx .ch.on{background:#4338ca !important;border-color:#4338ca !important;color:#fff !important}' +
    '#apx .dr{display:none;gap:6px;align-items:center;font-size:13px;color:#64748b}#apx .dr.on{display:flex}#apx .dr input{height:38px;border:1.5px solid #e2e8f0;border-radius:10px;padding:0 8px;font-size:13.5px}' +
    '#apList{padding:4px 18px 20px}' +
    '.ap-day{font-size:13px;font-weight:700;color:#64748b;margin:14px 4px 6px;display:flex;justify-content:space-between;align-items:center;gap:8px}.ap-day b{color:#ea580c}' +
    '.ap-day label{display:flex;align-items:center;gap:7px;cursor:pointer}' +
    '.ap{background:#fff;border-radius:14px;padding:11px 14px;border:1px solid #eef2f7;box-shadow:0 1px 3px rgba(15,23,42,.06);display:grid;grid-template-columns:auto minmax(0,1fr) 150px auto;gap:12px;align-items:center;margin-bottom:8px;border-left:5px solid var(--sc)}' +
    '.ap.sel{background:#f8faff;border-color:#c7d2fe}' +
    '.ap input[type=checkbox],.ap-day input[type=checkbox]{width:20px;height:20px;accent-color:#2563eb;cursor:pointer}' +
    '.ap .l1{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.ap .tg{border-radius:7px;padding:2px 8px;font-weight:600;font-size:12px;white-space:nowrap}' +
    '.ap .rn{background:#eff6ff;color:#1d4ed8;font-family:"IBM Plex Mono",monospace;font-size:12.5px}.ap .nt{font-weight:700;font-size:13px;color:#334155;white-space:nowrap}' +
    '.ap .nm{font-size:15px;font-weight:700;margin-top:4px;color:#1e293b;line-height:1.4;word-break:break-word}' +
    '.ap .meta{font-size:13px;color:#64748b;margin-top:3px;display:flex;gap:4px 12px;flex-wrap:wrap}.ap .meta i{margin-right:4px;color:#94a3b8}' +
    '.ap .amt{text-align:right}.ap .amt b{font-size:20px;color:#ea580c;display:block;white-space:nowrap}.ap .amt small{font-size:12px;color:#64748b}' +
    '.ap .bx{display:flex;gap:6px}.ap .btn{height:38px;padding:0 13px;border-radius:10px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '.ap .btn.p{background:#2563eb;border-color:#2563eb;color:#fff}' +
    '#apSel{position:sticky;bottom:var(--ap-nav,0px);z-index:20;margin:6px 18px 14px;background:#1e293b;color:#fff;border-radius:14px;padding:10px 14px;display:none;align-items:center;gap:12px;font-size:14px;box-shadow:0 6px 20px rgba(15,23,42,.25)}' +
    '#apSel.on{display:flex}#apSel button{border:0;border-radius:10px;padding:9px 16px;font-weight:700;font-size:14px;cursor:pointer;font-family:inherit}' +
    '#apSel .p{margin-left:auto;background:#2563eb;color:#fff}#apSel .c{background:transparent;color:#cbd5e1}' +
    '#apMore{display:block;margin:6px auto 0;height:40px;padding:0 18px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;font-weight:600;color:#475569;cursor:pointer;font-family:inherit}' +
    '.ap-empty{text-align:center;padding:50px 16px;color:#94a3b8}.ap-empty i{font-size:44px;opacity:.35;display:block;margin-bottom:10px}' +
    '@media(max-width:900px){#apx .kpi{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
    '@media(max-width:700px){#apx{padding:12px 12px 4px}#apList{padding:4px 10px 16px}#apx .kpi{grid-template-columns:1fr 1fr}#apx .k b{font-size:18px}#apx .ttl .tb span{display:none}' +
    ' .ap{grid-template-columns:auto minmax(0,1fr)}.ap .amt{grid-column:2;text-align:left;display:flex;gap:6px;align-items:baseline}.ap .bx{grid-column:1/-1}.ap .bx .btn{flex:1}#apSel{margin:6px 10px 12px}}';

  function build() {
    if (S.ui) return true;
    var page = $('page-approval'); if (!page) return false;
    var card = page.querySelector('.bg-white.rounded-xl'); if (!card) return false;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var oldHead = card.firstElementChild, wrap = card.querySelector('.overflow-x-auto');
    var x = document.createElement('div'); x.id = 'apx';
    x.innerHTML = '<div class="ttl"><div class="ic"><i class="fa-solid fa-receipt"></i></div>อนุมัติรายจ่าย<span class="sp"></span><button class="tb" id="apExp"><i class="fa-solid fa-file-csv"></i><span>Export Excel</span></button></div>' +
      '<div class="kpi" id="apKpi"></div>' +
      '<div class="f1"><div class="srch" id="apSrch"><i class="fa-solid fa-magnifying-glass"></i></div>' +
      '<select class="ch" id="apPer"><option value="all">📅 ทุกช่วงเวลา</option><option value="m0">📅 เดือนนี้</option><option value="m1">📅 เดือนก่อน</option><option value="d30">📅 30 วันล่าสุด</option><option value="cus">📅 กำหนดเอง…</option></select>' +
      '<span class="dr" id="apDr"><input type="date" id="apFrom"> ถึง <input type="date" id="apTo"></span>' +
      '<span class="ch" data-t="">ทุกประเภท</span>' +
      Object.keys(TL).map(function (k) { return '<span class="ch" data-t="' + k + '" style="color:' + TC[k][0] + ';border-color:' + TC[k][2] + ';background:' + TC[k][1] + '"><i class="fa-solid ' + TC[k][3] + '"></i>' + TL[k].replace('ค่าเบ็ด', 'เบ็ด') + '</span>'; }).join('') + '</div>';
    card.insertBefore(x, oldHead); oldHead.style.display = 'none'; if (wrap) wrap.style.display = 'none';
    var si = $('approvalSearchInput'); si.className = ''; si.placeholder = 'ค้นหางาน / รายละเอียด / Net / ผู้บันทึก'; $('apSrch').appendChild(si);
    var list = document.createElement('div'); list.id = 'apList'; card.appendChild(list);
    var sel = document.createElement('div'); sel.id = 'apSel';
    sel.innerHTML = '<i class="fa-solid fa-square-check"></i><span id="apSelT"></span><button class="c" id="apSelC">ล้าง</button><button class="p" id="apSelP"><i class="fa-solid fa-print"></i> พิมพ์ใบอนุมัติที่เลือก</button>';
    card.appendChild(sel);
    $('apPer').onchange = function () { S.per = this.value; $('apDr').classList.toggle('on', S.per === 'cus'); render(); };
    $('apFrom').onchange = $('apTo').onchange = render;
    x.querySelectorAll('[data-t]').forEach(function (c) { c.onclick = function () { $('approvalTypeFilter').value = c.dataset.t; render(); }; });
    $('apExp').onclick = exportCsv;
    $('apSelC').onclick = function () { S.sel = {}; render(); };
    $('apSelP').onclick = printSel;
    list.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches('.ap input[type=checkbox]')) { if (t.checked) S.sel[t.value] = 1; else delete S.sel[t.value]; t.closest('.ap').classList.toggle('sel', t.checked); syncSel(); }
      else if (t.matches('.ap-day input[type=checkbox]')) {
        S.rows.filter(function (r) { return r.day === t.dataset.day; }).forEach(function (r) { if (t.checked) S.sel[r.key] = 1; else delete S.sel[r.key]; });
        list.querySelectorAll('.ap[data-day="' + t.dataset.day + '"] input').forEach(function (c) { c.checked = t.checked; c.closest('.ap').classList.toggle('sel', t.checked); });
        syncSel();
      }
    });
    var bn = document.getElementById('cclBottomNav'); if (bn && bn.offsetHeight) document.documentElement.style.setProperty('--ap-nav', bn.offsetHeight + 'px');
    S.ui = true; return true;
  }

  function collect() {
    var q = ($('approvalSearchInput').value || '').toLowerCase().trim(), tq = $('approvalTypeFilter').value || '';
    var rows = [], idx = 0;
    (g('allData', []) || []).filter(function (j) { return j.status !== 'ส่งปิดงาน' && j.status !== 'ปิดงานแล้วเสร็จ'; }).forEach(function (job) {
      var ex = job.expenses || [];
      if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } }
      if (!Array.isArray(ex) || !ex.length) return;
      var nets = String(job.networkId || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      ex.forEach(function (exp, ei) {
        var type = exp.type || '', ni = Number(exp.netIdx), netId = nets[ni] || exp.netIdx || '-';
        var codeSrc = type === 'labor' ? job.laborCode : type === 'supervision' ? job.supervisionCode : type === 'misc' ? job.miscCode : '';
        var code = type ? pad(String(codeSrc || '').split(',').map(function (s) { return s.trim(); })[ni] || ({ labor: '30', supervision: '40', misc: '60' })[type]) : '0000';
        var date = exp.date || (exp.timestamp ? String(exp.timestamp).split('T')[0] : '-');
        var by = exp.updatedBy || exp.by || '-', desc = exp.desc || '-';
        var r = { key: job.id + '_' + ei, job: job, netId: netId, type: type, code: code, desc: desc, amount: parseFloat(exp.amount) || 0, date: date, by: by, exp: exp, day: ymd(exp.date || exp.timestamp), _i: idx++,
          t: new Date(exp.timestamp || exp.date || 0).getTime() || 0 };
        r.all = r; rows.push(r);
      });
    });
    // ช่วงเวลา
    var now = new Date(), from = '', to = '';
    var f2 = function (d) { return ymd(d.toISOString ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString() : d); };
    if (S.per === 'm0') { from = f2(new Date(now.getFullYear(), now.getMonth(), 1)); }
    else if (S.per === 'm1') { from = f2(new Date(now.getFullYear(), now.getMonth() - 1, 1)); to = f2(new Date(now.getFullYear(), now.getMonth(), 0)); }
    else if (S.per === 'd30') { from = f2(new Date(now.getTime() - 29 * 86400000)); }
    else if (S.per === 'cus') { from = $('apFrom').value || ''; to = $('apTo').value || ''; }
    var inPer = rows.filter(function (r) { return (!from || (r.day && r.day >= from)) && (!to || (r.day && r.day <= to)); });
    var sq = q ? inPer.filter(function (r) { return (r.job.jobName + ' ' + r.job.receiveNo + ' ' + r.desc + ' ' + r.netId + ' ' + r.by).toLowerCase().indexOf(q) >= 0; }) : inPer;
    var shown = tq ? sq.filter(function (r) { return r.type === tq; }) : sq;
    shown.sort(function (a, b) { return (b.day || '').localeCompare(a.day || '') || (b.t - a.t) || (b._i - a._i); });
    return { all: sq, rows: shown };
  }

  function detailOf(r) {
    return {
      receiveNo: r.job.receiveNo || '-', receiveDate: r.job.receiveDate || '-', jobName: r.job.jobName || '-', budgetType: r.job.budgetType || '-',
      jobIds: r.job.jobIds || '-', responsibleEntity: r.job.responsibleEntity || '-', assignee: r.job.assignee || '-', recorder: r.by,
      approver: window._approverName || '-', netId: r.netId, type: r.type, typeCode: r.code, typeLabel: TL[r.type] || r.type || '-',
      desc: r.desc, amount: r.amount, date: r.date, by: r.by
    };
  }

  function card(r) {
    var c = TC[r.type] || ['#64748b', '#f1f5f9', '#e2e8f0', 'fa-circle'], on = !!S.sel[r.key];
    var enc = encodeURIComponent(JSON.stringify(detailOf(r)));
    return '<div class="ap' + (on ? ' sel' : '') + '" data-day="' + esc(r.day) + '" style="--sc:' + c[0] + '"><input type="checkbox" value="' + r.key + '"' + (on ? ' checked' : '') + ' aria-label="เลือก">' +
      '<div style="min-width:0"><div class="l1"><span class="tg rn">' + esc(r.job.receiveNo || '-') + '</span><span class="tg" style="color:' + c[0] + ';background:' + c[1] + '">' + esc(TL[r.type] || r.type || '-') + ' · ' + esc(r.code) + '</span><span class="nt">Net ' + esc(r.netId) + '</span></div>' +
      '<div class="nm">' + esc(r.job.jobName || '-') + '</div>' +
      '<div class="meta"><span><i class="fa-solid fa-pen-to-square"></i>' + esc(r.desc) + '</span><span><i class="fa-solid fa-user"></i>' + esc(r.by) + '</span></div></div>' +
      '<div class="amt"><b>' + m(r.amount) + '</b><small>บาท</small></div>' +
      '<div class="bx"><button class="btn" onclick="openPrintPreview(\'' + enc + '\')"><i class="fa-solid fa-eye" style="color:#3b82f6"></i>พรีวิว</button>' +
      '<button class="btn p" onclick="directPrint(\'' + enc + '\')"><i class="fa-solid fa-print"></i>พิมพ์</button></div></div>';
  }

  function paint() {
    var L = $('apList'), n = Math.min(S.rows.length, S.shown + 60), h = '', last = null;
    var mb = $('apMore'); if (mb) mb.remove();
    for (var i = S.shown; i < n; i++) {
      var r = S.rows[i];
      if (r.day !== last && !L.querySelector('.ap-day[data-day="' + r.day + '"]')) {
        var dayRows = S.rows.filter(function (x) { return x.day === r.day; }), sum = dayRows.reduce(function (s, x) { return s + x.amount; }, 0);
        var allOn = dayRows.every(function (x) { return S.sel[x.key]; });
        h += '<div class="ap-day" data-day="' + esc(r.day) + '"><label><input type="checkbox" data-day="' + esc(r.day) + '"' + (allOn ? ' checked' : '') + '>' + esc(dayLabel(r.day)) + ' · ' + dayRows.length + ' รายการ</label><span>รวม <b>' + m(sum) + '</b> บาท</span></div>';
      }
      last = r.day; h += card(r);
    }
    L.insertAdjacentHTML('beforeend', h); S.shown = n;
    if (S.shown < S.rows.length) {
      L.insertAdjacentHTML('beforeend', '<button id="apMore">แสดงเพิ่ม (' + (S.rows.length - S.shown) + ' รายการ)</button>');
      $('apMore').onclick = paint;
    }
  }

  function syncSel() {
    var keys = Object.keys(S.sel), map = {}; S.allRows.forEach(function (r) { map[r.key] = r; });
    keys = keys.filter(function (k) { return map[k]; });
    var sum = keys.reduce(function (s, k) { return s + map[k].amount; }, 0);
    $('apSel').classList.toggle('on', keys.length > 0);
    $('apSelT').textContent = 'เลือก ' + keys.length + ' รายการ · รวม ' + m(sum) + ' บาท';
    $('apSelP').innerHTML = '<i class="fa-solid fa-print"></i> พิมพ์ใบอนุมัติที่เลือก (' + keys.length + ')';
  }

  function printSel() {
    var map = {}; S.allRows.forEach(function (r) { map[r.key] = r; });
    var list = S.rows.filter(function (r) { return S.sel[r.key] && map[r.key]; });
    if (!list.length) return;
    var pa = $('printableArea'); if (!pa || typeof buildExpenseHTML !== 'function') return;
    pa.innerHTML = list.map(function (r) { return '<div class="print-page" style="page-break-after:always;break-after:page">' + buildExpenseHTML(detailOf(r), true) + '</div>'; }).join('');
    pa.classList.remove('hidden'); window.print(); pa.classList.add('hidden');
  }

  function exportCsv() {
    var head = ['วันที่ตัดงบ', 'เลขที่', 'ชื่องาน', 'Network', 'ประเภท', 'รหัส', 'รายละเอียด', 'จำนวนเงิน', 'บันทึกโดย'];
    var csv = head.join(',') + '\n' + S.rows.map(function (r) {
      return [r.date, r.job.receiveNo, r.job.jobName, r.netId, TL[r.type] || r.type, r.code, r.desc, r.amount, r.by].map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'อนุมัติรายจ่าย_' + ymd(new Date().toISOString()) + '.csv'; a.click();
  }

  function render() {
    if (!build()) return;
    var c = collect(); S.rows = c.rows; S.allRows = c.all; S.shown = 0;
    var tq = $('approvalTypeFilter').value || '';
    $('apx').querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tq); });
    var sum = function (arr) { return arr.reduce(function (s, r) { return s + r.amount; }, 0); };
    var by = function (t) { return sum(c.all.filter(function (r) { return r.type === t; })); };
    var pl = { all: 'ทั้งหมด', m0: 'เดือนนี้', m1: 'เดือนก่อน', d30: '30 วัน', cus: 'ช่วงที่เลือก' }[S.per];
    var k = function (lab, val, col, bg) { return '<div class="k" style="color:' + col + ';background:' + bg + '"><small>' + lab + '</small><b>' + val + '</b></div>'; };
    $('apKpi').innerHTML = k('รายการ' + pl, c.rows.length.toLocaleString(), '#ea580c', '#fff7ed') + k('ยอด' + pl + ' (บาท)', m(sum(c.rows)).replace(/\.00$/, ''), '#ea580c', '#fff7ed') +
      k('ค่าแรง', m(by('labor')).replace(/\.00$/, ''), '#1d4ed8', '#eff6ff') + k('ค่าคุมงาน', m(by('supervision')).replace(/\.00$/, ''), '#7e22ce', '#faf5ff') + k('เบ็ดเตล็ด', m(by('misc')).replace(/\.00$/, ''), '#b45309', '#fffbeb');
    var b = $('approvalBudgetCountBadge'); if (b) b.innerText = c.rows.length + ' รายการ';
    var L = $('apList'); L.innerHTML = '';
    if (!c.rows.length) L.innerHTML = '<div class="ap-empty"><i class="fa-solid fa-receipt"></i><div style="font-weight:700;color:#64748b">ไม่พบรายการตัดงบ</div><div style="font-size:13px">ลองเปลี่ยนช่วงเวลาหรือคำค้น</div></div>';
    else paint();
    syncSel();
  }

  window.renderApprovalFromBudget = function () { try { render(); } catch (e) { console.error('[appr-ui]', e); } };
  function boot() { var d = g('allData', null); if (Array.isArray(d) && d.length) window.renderApprovalFromBudget(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
