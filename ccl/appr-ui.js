/* CCL — หน้า "อนุมัติรายจ่าย" แบบพื้นที่ทำงาน
   ขั้นตอนของแต่ละรายการตัดงบ: ① รอพิมพ์ใบอนุมัติ → ② พิมพ์แล้ว รอเซ็น → ③ อนุมัติแล้ว  (↩ ตีกลับให้แก้ไข)
   - เก็บขั้นตอนไว้ในรายการตัดงบเดิม (apSt/apBy/apAt/apNote/apFile) ผ่าน cclExpStage ที่หลังบ้าน
   - รายการที่บันทึกก่อนเริ่มใช้ขั้นตอนนี้ (ก่อน 21 พ.ย. 69) ถือเป็น "รายการเก่า" ไม่นับรวมในงานค้าง
   - ใช้ openPrintPreview / directPrint / buildExpenseHTML / printableArea เดิม — แบบฟอร์มใบอนุมัติเหมือนเดิม */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  function m(n) { return (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function m0(n) { return m(n).replace(/\.00$/, ''); }
  var TL = { labor: 'ค่าแรง', supervision: 'ค่าคุมงาน', misc: 'ค่าเบ็ดเตล็ด' };
  var TC = { labor: ['#1d4ed8', '#eff6ff', '#bfdbfe', 'fa-hammer'], supervision: ['#7e22ce', '#faf5ff', '#e9d5ff', 'fa-helmet-safety'], misc: ['#b45309', '#fffbeb', '#fde68a', 'fa-box-open'] };
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var GO_LIVE = '2026-11-20T17:00:00Z'; // 21 พ.ย. 2569 00:00 น. เวลาไทย
  var STG = {
    print: { n: '①', t: 'ตัดงบแล้ว · รอพิมพ์ใบอนุมัติ', s: 'รอพิมพ์', c: '#f59e0b' },
    sign: { n: '②', t: 'พิมพ์แล้ว · รอเซ็นอนุมัติ', s: 'รอเซ็น', c: '#4f46e5' },
    ok: { n: '③', t: 'อนุมัติแล้ว', s: 'อนุมัติแล้ว', c: '#16a34a' },
    back: { n: '↩', t: 'ตีกลับให้แก้ไข', s: 'ตีกลับ', c: '#dc2626' }
  };
  var S = { per: 'all', stg: null, sel: {}, cur: null, rows: [], allRows: [], shown: 0, ui: false, old: false };

  function pad(c) { try { return padCode(c); } catch (e) { c = String(c || ''); while (c.length < 4) c = '0' + c; return c; } }
  function ymd(v) {
    var s = String(v || ''); var mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (mm) return mm[1] + '-' + mm[2] + '-' + mm[3];
    var d = new Date(s); if (isNaN(d)) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function dth(v) {
    var k = ymd(v); if (!k) return '-'; var p = k.split('-');
    return (+p[2]) + ' ' + TH_M[+p[1] - 1] + ' ' + String(+p[0] + 543).slice(-2);
  }
  function stageOf(exp) {
    if (exp.apSt && STG[exp.apSt]) return exp.apSt;
    var ts = exp.timestamp ? new Date(exp.timestamp) : null;
    if (!ts || isNaN(ts) || ts < new Date(GO_LIVE)) return 'old';
    return 'print';
  }

  var css =
    '#apx{padding:14px 16px 4px}#apx .ttl{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:#1e293b;flex-wrap:wrap}' +
    '#apx .ttl .ic{width:34px;height:34px;border-radius:10px;background:#fef3c7;color:#d97706;display:grid;place-items:center;font-size:16px}#apx .ttl .sp{flex:1}' +
    '#apx .tb{height:36px;padding:0 13px;border-radius:10px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:0;background:#059669;color:#fff;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#apx .f1{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:10px}' +
    '#apx .srch{flex:1;min-width:200px;position:relative}#apx .srch>i{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#94a3b8}' +
    '#apx .srch input{width:100% !important;height:40px;border:1.5px solid #e2e8f0 !important;border-radius:11px !important;padding:0 12px 0 38px !important;font-size:14px !important;background:#f8fafc}' +
    '#apx .ch{height:36px;padding:0 12px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#apx .ch.on{background:#4338ca !important;border-color:#4338ca !important;color:#fff !important}' +
    '#apx .dr{display:none;gap:6px;align-items:center;font-size:13px;color:#64748b}#apx .dr.on{display:flex}#apx .dr input{height:36px;border:1.5px solid #e2e8f0;border-radius:10px;padding:0 8px;font-size:13px}' +
    '#apFlow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0 2px}' +
    '.apf{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:8px 12px;position:relative;border-left:5px solid var(--c);cursor:pointer;text-align:left;font-family:inherit;min-width:0}' +
    '.apf small{display:block;font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.apf b{font-size:21px;color:var(--c)}.apf span{font-size:12px;color:#475569;margin-left:6px}' +
    '.apf.on{box-shadow:0 0 0 2px var(--c);background:#fcfcff}.apf:not(:last-child):after{content:"›";position:absolute;right:-8px;top:50%;transform:translateY(-50%);font-size:18px;color:#94a3b8;z-index:2}' +
    '#apOld{font-size:12px;color:#64748b;margin:6px 2px 0;line-height:1.6}#apOld button{border:0;background:none;color:#2563eb;font-weight:600;cursor:pointer;font-family:inherit;padding:0;text-decoration:underline}' +
    '#apWs{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:10px;padding:8px 16px 14px;align-items:start}' +
    '.apb{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}' +
    '.apb-h{display:flex;align-items:center;gap:8px;padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:13.5px}.apb-h label{margin-left:auto;white-space:nowrap;font-size:12.5px;color:#64748b;display:flex;gap:6px;align-items:center;cursor:pointer}' +
    '.apj{padding:7px 12px;background:#f8fafc;border-top:1px solid #eef2f7;display:flex;align-items:center;gap:7px;font-size:13px;flex-wrap:wrap}' +
    '.apj .rn{font-family:"IBM Plex Mono",monospace;background:#eff6ff;color:#1d4ed8;border-radius:6px;padding:1px 7px;font-weight:700;font-size:12.5px}' +
    '.apj .nm{font-weight:700;color:#1e293b;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}' +
    '.apj .cd{background:#fef9c3;color:#854d0e;border-radius:6px;padding:1px 7px;font-size:12px;font-weight:700}' +
    '.apj .lf{margin-left:auto;font-size:12px;color:#64748b;white-space:nowrap}.apj .lf b{color:#16a34a}' +
    '.apr{display:grid;grid-template-columns:22px 92px minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 12px;border-top:1px solid #f1f5f9;font-size:13px;cursor:pointer}' +
    '.apr:hover{background:#f8fafc}.apr.cur{background:#eef2ff}' +
    '.apr input{width:18px;height:18px;accent-color:#4f46e5;cursor:pointer;margin:0}' +
    '.apr .ty{border-radius:7px;padding:2px 6px;font-size:12px;font-weight:600;text-align:center;white-space:nowrap}' +
    '.apr .d{min-width:0}.apr .d>div{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.apr .d small{display:block;color:#94a3b8;font-size:11.5px}' +
    '.apr .d .nt{color:#b91c1c;font-size:11.5px;white-space:normal}' +
    '.apr .amt{text-align:right;font-weight:700;white-space:nowrap}.apr .amt small{display:block;font-weight:500;font-size:11px;color:#64748b}' +
    '.apr .fl{color:#16a34a;font-size:11px}' +
    '#apPv{position:sticky;top:8px;padding:12px}' +
    '#apPv .ph{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:14px;font-weight:700}' +
    '#apPv .nav{display:flex;gap:4px;align-items:center;font-size:12px;color:#64748b;font-weight:600}#apPv .nav button{border:1px solid #e2e8f0;background:#fff;border-radius:7px;width:26px;height:26px;cursor:pointer}' +
    '#apPaper{border:1px solid #e2e8f0;border-radius:8px;background:#fff;box-shadow:0 4px 14px rgba(0,0,0,.06);height:320px;overflow:hidden;position:relative}' +
    '#apPaper>div{transform:scale(.5);transform-origin:top left;width:200%;pointer-events:none}' +
    '.aps{display:flex;gap:5px;margin:10px 0;font-size:12px}.aps span{flex:1;text-align:center;border-radius:8px;padding:5px 2px;background:#f1f5f9;color:#94a3b8;font-weight:600}' +
    '.aps .ok{background:#dcfce7;color:#166534}.aps .now{background:#fef3c7;color:#92400e}.aps .bad{background:#fee2e2;color:#b91c1c}' +
    '.apa{display:grid;grid-template-columns:1fr 1fr;gap:7px}' +
    '.apbtn{border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px;font-weight:600;font-size:13px;color:#334155;text-align:center;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:center;justify-content:center}' +
    '.apbtn:hover{background:#f8fafc}.apbtn.i{background:#4f46e5;color:#fff;border-color:#4f46e5}.apbtn.g{background:#16a34a;color:#fff;border-color:#16a34a}.apbtn.r{color:#dc2626}.apbtn.w{grid-column:1/-1}' +
    '.apnote{font-size:12.5px;border-radius:9px;padding:7px 10px;margin-bottom:8px;background:#fef2f2;color:#991b1b}.apnote.i{background:#f1f5f9;color:#475569}' +
    '.ap-empty{text-align:center;padding:40px 16px;color:#94a3b8}.ap-empty i{font-size:40px;opacity:.35;display:block;margin-bottom:10px}' +
    '#apMore{display:block;margin:8px auto;height:36px;padding:0 16px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;font-weight:600;color:#475569;cursor:pointer;font-family:inherit}' +
    '#apSel{position:sticky;bottom:var(--ap-nav,0px);z-index:20;margin:0 16px 14px;background:#1e293b;color:#fff;border-radius:14px;padding:9px 12px;display:none;align-items:center;gap:8px;font-size:14px;box-shadow:0 6px 20px rgba(15,23,42,.25);flex-wrap:wrap}' +
    '#apSel.on{display:flex}#apSel b{font-size:16px}#apSel .sp{flex:1}#apSel button{border:0;border-radius:10px;padding:8px 13px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;color:#fff;background:#334155}' +
    '#apSel .i{background:#4f46e5}#apSel .g{background:#16a34a}' +
    '@media(max-width:900px){#apWs{grid-template-columns:1fr}#apPv{display:none}}' +
    '@media(max-width:700px){#apx{padding:10px 10px 4px}#apFlow{grid-template-columns:1fr 1fr}.apf:after{display:none !important}#apx .ttl .tb span{display:none}' +
    '#apWs{padding:6px 8px 10px}.apr{grid-template-columns:22px minmax(0,1fr) auto}.apr .ty{display:none}.apj .nm{max-width:100%;order:3;flex-basis:100%}#apSel{margin:0 8px 10px}}';

  function build() {
    if (S.ui) return true;
    var page = $('page-approval'); if (!page) return false;
    var card = page.querySelector('.bg-white.rounded-xl'); if (!card) return false;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var oldHead = card.firstElementChild, wrap = card.querySelector('.overflow-x-auto');
    var x = document.createElement('div'); x.id = 'apx';
    x.innerHTML = '<div class="ttl"><div class="ic"><i class="fa-solid fa-receipt"></i></div>อนุมัติรายจ่าย<span class="sp"></span><button class="tb" id="apExp"><i class="fa-solid fa-file-csv"></i><span>Export Excel</span></button></div>' +
      '<div class="f1"><div class="srch" id="apSrch"><i class="fa-solid fa-magnifying-glass"></i></div>' +
      '<select class="ch" id="apPer"><option value="all">📅 ทุกช่วงเวลา</option><option value="m0">📅 เดือนนี้</option><option value="m1">📅 เดือนก่อน</option><option value="d30">📅 30 วันล่าสุด</option><option value="cus">📅 กำหนดเอง…</option></select>' +
      '<span class="dr" id="apDr"><input type="date" id="apFrom"> ถึง <input type="date" id="apTo"></span>' +
      '<span class="ch" data-t="">ทุกประเภท</span>' +
      Object.keys(TL).map(function (k) { return '<span class="ch" data-t="' + k + '" style="color:' + TC[k][0] + ';border-color:' + TC[k][2] + ';background:' + TC[k][1] + '"><i class="fa-solid ' + TC[k][3] + '"></i>' + TL[k].replace('ค่าเบ็ด', 'เบ็ด') + '</span>'; }).join('') + '</div>' +
      '<div id="apFlow"></div><div id="apOld"></div>';
    card.insertBefore(x, oldHead); oldHead.style.display = 'none'; if (wrap) wrap.style.display = 'none';
    var si = $('approvalSearchInput'); si.className = ''; si.placeholder = 'ค้นหางาน / รายละเอียด / Net / ผู้บันทึก'; $('apSrch').appendChild(si);
    var ws = document.createElement('div'); ws.id = 'apWs';
    ws.innerHTML = '<div class="apb"><div class="apb-h"><b id="apLt"></b><label><input type="checkbox" id="apAll">เลือกทั้งหมด</label></div><div id="apList"></div></div><div class="apb" id="apPv"></div>';
    card.appendChild(ws);
    var sel = document.createElement('div'); sel.id = 'apSel'; card.appendChild(sel);
    $('apPer').onchange = function () { S.per = this.value; $('apDr').classList.toggle('on', S.per === 'cus'); render(); };
    $('apFrom').onchange = $('apTo').onchange = render;
    x.querySelectorAll('[data-t]').forEach(function (c) { c.onclick = function () { $('approvalTypeFilter').value = c.dataset.t; render(); }; });
    $('apExp').onclick = exportCsv;
    $('apFlow').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; S.stg = b.dataset.s; S.old = false; S.sel = {}; S.cur = null; render(); });
    $('apOld').addEventListener('click', function (e) { if (e.target.closest('button')) { S.old = !S.old; S.sel = {}; S.cur = null; render(); } });
    $('apAll').onchange = function () { var on = this.checked; S.rows.forEach(function (r) { if (on) S.sel[r.key] = 1; else delete S.sel[r.key]; }); paintList(); syncSel(); };
    $('apList').addEventListener('click', function (e) {
      var row = e.target.closest('.apr'); if (!row) return;
      var k = row.dataset.k;
      if (e.target.matches('input')) { if (e.target.checked) S.sel[k] = 1; else delete S.sel[k]; syncSel(); return; }
      if (e.target.closest('[data-pv]')) { var r = find(k); if (r) openPrintPreview(enc(r)); return; }
      S.cur = k; $('apList').querySelectorAll('.apr.cur').forEach(function (n) { n.classList.remove('cur'); }); row.classList.add('cur'); paintPv();
      if (window.innerWidth <= 900) { var c = row.querySelector('input'); c.checked = !c.checked; if (c.checked) S.sel[k] = 1; else delete S.sel[k]; syncSel(); }
    });
    $('apPv').addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return; var r = find(S.cur); if (!r) return;
      act(b.dataset.a, [r]);
    });
    sel.addEventListener('click', function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'clear') { S.sel = {}; paintList(); syncSel(); return; }
      act(b.dataset.a, selected());
    });
    var bn = document.getElementById('cclBottomNav'); if (bn && bn.offsetHeight) document.documentElement.style.setProperty('--ap-nav', bn.offsetHeight + 'px');
    S.ui = true; return true;
  }

  function collect() {
    var q = ($('approvalSearchInput').value || '').toLowerCase().trim(), tq = $('approvalTypeFilter').value || '';
    var rows = [], idx = 0;
    (g('allData', []) || []).filter(function (j) { return j.status !== 'ยกเลิก'; }).forEach(function (job) {
      var ex = job.expenses || [];
      if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } }
      if (!Array.isArray(ex) || !ex.length) return;
      var nets = String(job.networkId || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      ex.forEach(function (exp, ei) {
        var type = exp.type || '', ni = Number(exp.netIdx), netId = nets[ni] || exp.netIdx || '-';
        var codeSrc = type === 'labor' ? job.laborCode : type === 'supervision' ? job.supervisionCode : type === 'misc' ? job.miscCode : '';
        var code = type ? pad(String(codeSrc || '').split(',').map(function (s) { return s.trim(); })[ni] || ({ labor: '30', supervision: '40', misc: '60' })[type]) : '0000';
        var date = exp.date || (exp.timestamp ? String(exp.timestamp).split('T')[0] : '-');
        rows.push({ key: job.id + '_' + ei, idx: ei, job: job, netId: netId, type: type, code: code, desc: exp.desc || '-', amount: parseFloat(exp.amount) || 0,
          date: date, by: exp.updatedBy || exp.by || '-', exp: exp, day: ymd(exp.date || exp.timestamp), st: stageOf(exp), _i: idx++,
          t: new Date(exp.timestamp || exp.date || 0).getTime() || 0 });
      });
    });
    var now = new Date(), from = '', to = '';
    var f2 = function (d) { return ymd(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()); };
    if (S.per === 'm0') { from = f2(new Date(now.getFullYear(), now.getMonth(), 1)); }
    else if (S.per === 'm1') { from = f2(new Date(now.getFullYear(), now.getMonth() - 1, 1)); to = f2(new Date(now.getFullYear(), now.getMonth(), 0)); }
    else if (S.per === 'd30') { from = f2(new Date(now.getTime() - 29 * 86400000)); }
    else if (S.per === 'cus') { from = $('apFrom').value || ''; to = $('apTo').value || ''; }
    var inPer = rows.filter(function (r) { return (!from || (r.day && r.day >= from)) && (!to || (r.day && r.day <= to)); });
    var sq = q ? inPer.filter(function (r) { return (r.job.jobName + ' ' + r.job.receiveNo + ' ' + r.desc + ' ' + r.netId + ' ' + r.by).toLowerCase().indexOf(q) >= 0; }) : inPer;
    return tq ? sq.filter(function (r) { return r.type === tq; }) : sq;
  }

  function detailOf(r) {
    return {
      receiveNo: r.job.receiveNo || '-', receiveDate: r.job.receiveDate || '-', jobName: r.job.jobName || '-', budgetType: r.job.budgetType || '-',
      jobIds: r.job.jobIds || '-', responsibleEntity: r.job.responsibleEntity || '-', assignee: r.job.assignee || '-', recorder: r.by,
      approver: window._approverName || '-', netId: r.netId, type: r.type, typeCode: r.code, typeLabel: TL[r.type] || r.type || '-',
      desc: r.desc, amount: r.amount, date: r.date, by: r.by
    };
  }
  function enc(r) { return encodeURIComponent(JSON.stringify(detailOf(r))); }
  function find(k) { for (var i = 0; i < S.allRows.length; i++) if (S.allRows[i].key === k) return S.allRows[i]; return null; }
  function selected() { return S.rows.filter(function (r) { return S.sel[r.key]; }); }
  function left(job) {
    var split = function (s) { return String(s || '').split(',').map(function (v) { return parseFloat(String(v).replace(/,/g, '')) || 0; }); };
    var tot = [job.laborCost, job.supervisionCost, job.miscCost].reduce(function (s, v) { return s + split(v).reduce(function (a, b) { return a + b; }, 0); }, 0);
    var ex = job.expenses || []; if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } }
    var sp = (Array.isArray(ex) ? ex : []).reduce(function (s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
    return tot > 0 ? tot - sp : null;
  }

  function rowHtml(r) {
    var c = TC[r.type] || ['#64748b', '#f1f5f9', '#e2e8f0', 'fa-circle'], on = !!S.sel[r.key], e = r.exp;
    return '<div class="apr' + (S.cur === r.key ? ' cur' : '') + '" data-k="' + r.key + '"><input type="checkbox"' + (on ? ' checked' : '') + ' aria-label="เลือก">' +
      '<span class="ty" style="color:' + c[0] + ';background:' + c[1] + '">' + esc((TL[r.type] || r.type || '-').replace('ค่าเบ็ด', 'เบ็ด')) + '</span>' +
      '<div class="d"><div>' + esc(r.desc) + ' · Net ' + esc(r.netId) + '</div><small>' + esc(dth(r.day)) + ' · ' + esc(r.by) +
        (e.apAt && r.st !== 'print' ? ' · ' + STG[r.st].s + ' ' + esc(dth(e.apAt)) + (e.apBy ? ' โดย ' + esc(e.apBy) : '') : '') + '</small>' +
        (r.st === 'back' && e.apNote ? '<div class="nt">↩ ' + esc(e.apNote) + '</div>' : '') +
        (e.apFile ? '<span class="fl">📎 มีสแกนใบที่เซ็นแล้ว</span>' : '') + '</div>' +
      '<div class="amt">' + m0(r.amount) + '<small>บาท <span data-pv title="พรีวิวใบอนุมัติ" style="cursor:pointer">👁</span></small></div></div>';
  }

  function paintList() {
    var L = $('apList'), n = Math.min(S.rows.length, Math.max(S.shown, 80)), h = '', lastJob = null;
    if (!S.rows.length) {
      L.innerHTML = '<div class="ap-empty"><i class="fa-solid fa-circle-check"></i><div style="font-weight:700;color:#64748b">ไม่มีรายการในขั้นนี้</div><div style="font-size:13px">ลองเลือกขั้นอื่น หรือเปลี่ยนช่วงเวลา/คำค้น</div></div>';
      S.shown = 0; return;
    }
    for (var i = 0; i < n; i++) {
      var r = S.rows[i];
      if (r.job.id !== lastJob) {
        var lf = left(r.job), code = String(r.job.jobStatus || '').trim();
        var cnt = S.rows.filter(function (x) { return x.job.id === r.job.id; }), sum = cnt.reduce(function (s, x) { return s + x.amount; }, 0);
        h += '<div class="apj"><span class="rn">' + esc(r.job.receiveNo || '-') + '</span><span class="nm">' + esc(r.job.jobName || '-') + '</span>' + (code ? '<span class="cd">' + esc(code) + '</span>' : '') +
          '<span class="lf">' + cnt.length + ' รายการ · ' + m0(sum) + ' บ.' + (lf != null ? ' · คงเหลือ <b>' + m0(lf) + '</b>' : '') + '</span></div>';
        lastJob = r.job.id;
      }
      h += rowHtml(r);
    }
    if (n < S.rows.length) h += '<button id="apMore">แสดงเพิ่ม (' + (S.rows.length - n) + ' รายการ)</button>';
    L.innerHTML = h; S.shown = n;
    var mb = $('apMore'); if (mb) mb.onclick = function () { S.shown = n + 80; paintList(); };
  }

  function steps(st) {
    var order = ['print', 'sign', 'ok'], i = order.indexOf(st);
    if (st === 'back') return '<div class="aps"><span class="ok">✓ ตัดงบ</span><span class="bad">↩ ตีกลับ</span><span>พิมพ์</span><span>อนุมัติ</span></div>';
    if (st === 'old') return '<div class="aps"><span class="ok">✓ ตัดงบ</span><span>รายการเก่า (ก่อนใช้ขั้นตอนนี้)</span></div>';
    return '<div class="aps"><span class="ok">✓ ตัดงบ</span>' + ['พิมพ์', 'เซ็น', 'อนุมัติ'].map(function (t, k) {
      var cls = k < i ? 'ok' : k === i ? 'now' : ''; if (st === 'ok') cls = 'ok';
      return '<span class="' + cls + '">' + (cls === 'ok' ? '✓ ' : cls === 'now' ? '● ' : '') + t + '</span>';
    }).join('') + '</div>';
  }

  function btns(st, many) {
    var B = function (a, t, cls) { return '<button class="apbtn ' + (cls || '') + '" data-a="' + a + '">' + t + '</button>'; };
    var out = [];
    if (st === 'print' || st === 'old') out.push(B('print', '🖨 พิมพ์' + (many ? 'รวม' : 'ใบนี้'), 'i'), B('sign', '→ ย้ายไป "รอเซ็น"'));
    if (st === 'sign') out.push(B('ok', '✅ บันทึกว่าอนุมัติแล้ว', 'g'), B('print', '🖨 พิมพ์ซ้ำ'));
    if (st === 'ok') out.push(B('print', '🖨 พิมพ์ซ้ำ'));
    if (st === 'back') out.push(B('reprint', '→ แก้แล้ว ส่งกลับไปรอพิมพ์', 'i'));
    if (st === 'print' || st === 'sign' || st === 'old') out.push(B('back', '↩ ตีกลับ', 'r'));
    if (!many) out.push(B('job', '👁 ดูงาน' + (st === 'back' ? ' / แก้รายการ' : '')));
    if (!many && (st === 'sign' || st === 'ok')) out.push(B('scan', '📎 แนบสแกนใบที่เซ็นแล้ว', 'w'));
    return out.join('');
  }

  function paintPv() {
    var P = $('apPv'), r = find(S.cur);
    if (!r || S.rows.indexOf(r) < 0) { r = S.rows[0] || null; S.cur = r ? r.key : null; }
    if (!r) { P.innerHTML = '<div class="ap-empty" style="padding:30px 10px"><i class="fa-solid fa-file-invoice"></i>เลือกรายการทางซ้ายเพื่อดูใบอนุมัติ</div>'; return; }
    var i = S.rows.indexOf(r), e = r.exp;
    var paper = typeof buildExpenseHTML === 'function' ? buildExpenseHTML(detailOf(r), false) : '';
    P.innerHTML = '<div class="ph"><span>ใบอนุมัติ · ' + m0(r.amount) + ' บาท</span><span class="nav"><button data-nv="-1">‹</button>' + (i + 1) + ' / ' + S.rows.length + '<button data-nv="1">›</button></span></div>' +
      (r.st === 'back' && e.apNote ? '<div class="apnote">↩ ตีกลับโดย ' + esc(e.apBy || '-') + ': ' + esc(e.apNote) + '</div>' : '') +
      (e.apFile ? '<div class="apnote i">📎 <a href="' + esc(e.apFile) + '" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">เปิดสแกนใบที่เซ็นแล้ว</a></div>' : '') +
      '<div id="apPaper"><div>' + paper + '</div></div>' + steps(r.st) + '<div class="apa">' + btns(r.st, false) + '</div>';
    P.querySelectorAll('[data-nv]').forEach(function (b) { b.onclick = function () { var j = i + Number(b.dataset.nv); if (S.rows[j]) { S.cur = S.rows[j].key; paintList(); paintPv(); } }; });
    var cr = $('apList').querySelector('.apr.cur'); if (!cr) { var el = $('apList').querySelector('.apr[data-k="' + S.cur + '"]'); if (el) el.classList.add('cur'); }
  }

  function syncSel() {
    var list = selected(), sum = list.reduce(function (s, r) { return s + r.amount; }, 0), bar = $('apSel');
    bar.classList.toggle('on', list.length > 0);
    $('apAll').checked = list.length > 0 && list.length === S.rows.length;
    if (!list.length) return;
    var st = S.old ? 'old' : S.stg, B = function (a, t, cls) { return '<button class="' + (cls || '') + '" data-a="' + a + '">' + t + '</button>'; };
    var acts = (st === 'print' || st === 'old') ? B('print', '🖨 พิมพ์รวม ' + list.length + ' ใบ', 'i') + B('sign', '→ ย้ายไป "รอเซ็น"', 'g')
      : st === 'sign' ? B('print', '🖨 พิมพ์รวม') + B('ok', '✅ อนุมัติที่เลือก', 'g')
      : st === 'back' ? B('reprint', '→ ส่งกลับไปรอพิมพ์', 'i') : B('print', '🖨 พิมพ์รวม', 'i');
    bar.innerHTML = '<span>เลือก <b>' + list.length + '</b> รายการ · <b>' + m0(sum) + '</b> บาท</span><span class="sp"></span>' + B('clear', 'ล้าง') + acts;
  }

  // ===== การทำงาน =====
  function printList(list) {
    var pa = $('printableArea'); if (!pa || typeof buildExpenseHTML !== 'function' || !list.length) return;
    pa.innerHTML = list.map(function (r) { return '<div class="print-page" style="page-break-after:always;break-after:page">' + buildExpenseHTML(detailOf(r), true) + '</div>'; }).join('');
    pa.classList.remove('hidden'); window.print(); pa.classList.add('hidden');
  }
  function api(list, stage, note, file) {
    var items = list.map(function (r) { return { jobId: r.job.id, idx: r.idx, ts: r.exp.timestamp || '', file: file || '' }; });
    return new Promise(function (res, rej) {
      google.script.run.withSuccessHandler(res).withFailureHandler(rej).cclExpStage(items, stage, note || '');
    });
  }
  function apply(list, stage, note, file) {
    var me = (g('currentUser', {}) || {}).name || '';
    list.forEach(function (r) {
      var e = r.exp;
      if (stage !== 'file') { e.apSt = stage; e.apBy = me; e.apAt = new Date().toISOString(); if (note) e.apNote = note; }
      if (file) e.apFile = file;
    });
  }
  function run(list, stage, note, file, okMsg) {
    if (!list.length) return Promise.resolve();
    Swal.fire({ title: 'กำลังบันทึก…', allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });
    return api(list, stage, note, file).then(function (res) {
      if (res && res.success === false) throw new Error(res.error || 'บันทึกไม่สำเร็จ');
      apply(list, stage, note, file);
      var miss = res && res.miss ? res.miss : 0;
      Swal.fire({ icon: miss ? 'warning' : 'success', title: okMsg, text: miss ? 'มี ' + miss + ' รายการที่หาไม่พบ (อาจถูกแก้/ลบไปแล้ว) — กดรีเฟรชข้อมูลแล้วลองอีกครั้ง' : '', timer: miss ? undefined : 1400, showConfirmButton: !!miss });
      S.sel = {}; render();
    }).catch(function (err) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: String(err && err.message || err) }); });
  }
  function act(a, list) {
    if (!list.length) return;
    var n = list.length, sum = m0(list.reduce(function (s, r) { return s + r.amount; }, 0));
    if (a === 'clear') return;
    if (a === 'job') { if (typeof openDetailModal === 'function') openDetailModal(list[0].job.id); return; }
    if (a === 'print') {
      printList(list);
      var need = list.filter(function (r) { return r.st === 'print' || r.st === 'old'; });
      if (need.length) setTimeout(function () {
        Swal.fire({ icon: 'question', title: 'พิมพ์เรียบร้อยแล้ว?', html: 'ย้าย <b>' + need.length + '</b> รายการไปขั้น <b>"รอเซ็นอนุมัติ"</b> เลยไหม', showCancelButton: true, confirmButtonText: 'ย้ายไปรอเซ็น', cancelButtonText: 'ยังก่อน', confirmButtonColor: '#4f46e5' })
          .then(function (x) { if (x.isConfirmed) run(need, 'sign', '', '', 'ย้ายไป "รอเซ็น" แล้ว'); });
      }, 400);
      return;
    }
    if (a === 'sign') return run(list, 'sign', '', '', 'ย้ายไป "รอเซ็น" แล้ว ' + n + ' รายการ');
    if (a === 'reprint') return run(list, 'print', '', '', 'ส่งกลับไป "รอพิมพ์" แล้ว');
    if (a === 'ok') {
      return Swal.fire({ icon: 'question', title: 'บันทึกว่าอนุมัติแล้ว?', html: n + ' รายการ · รวม <b>' + sum + '</b> บาท<br><small style="color:#64748b">ใช้เมื่อผู้มีอำนาจเซ็นใบอนุมัติแล้ว</small>', showCancelButton: true, confirmButtonText: '✅ อนุมัติแล้ว', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#16a34a' })
        .then(function (x) { if (x.isConfirmed) run(list, 'ok', '', '', 'บันทึกว่าอนุมัติแล้ว ' + n + ' รายการ'); });
    }
    if (a === 'back') {
      return Swal.fire({ icon: 'warning', title: 'ตีกลับให้แก้ไข', html: n + ' รายการ · รวม ' + sum + ' บาท', input: 'text', inputPlaceholder: 'เหตุผล / สิ่งที่ต้องแก้ (จำเป็น)', showCancelButton: true, confirmButtonText: '↩ ตีกลับ', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#dc2626',
        inputValidator: function (v) { if (!String(v || '').trim()) return 'กรุณาระบุเหตุผล'; } })
        .then(function (x) { if (x.isConfirmed) run(list, 'back', String(x.value).trim(), '', 'ตีกลับแล้ว'); });
    }
    if (a === 'scan') {
      var r = list[0], inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        if (f.size > 15 * 1024 * 1024) { Swal.fire({ icon: 'error', title: 'ไฟล์ใหญ่เกิน 15 MB' }); return; }
        Swal.fire({ title: 'กำลังอัปโหลด…', allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });
        readFileAsBase64(f).then(function (b64) {
          var name = 'ใบอนุมัติ ' + (TL[r.type] || '') + ' ' + m0(r.amount) + ' บ. ' + dth(r.day) + (f.name.match(/\.[a-z0-9]+$/i) || [''])[0];
          google.script.run.withSuccessHandler(function (res) {
            if (!res || !res.fileUrl) { Swal.fire({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: (res && res.error) || '' }); return; }
            run([r], 'file', '', res.fileUrl, 'แนบสแกนแล้ว');
          }).withFailureHandler(function (err) { Swal.fire({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: String(err && err.message || err) }); })
            .uploadAttachment(r.job.id, r.job.receiveNo || '', r.job.jobName || '', name, b64, f.type);
        });
      };
      inp.click();
    }
  }

  function exportCsv() {
    var head = ['วันที่ตัดงบ', 'เลขที่', 'ชื่องาน', 'Network', 'ประเภท', 'รหัส', 'รายละเอียด', 'จำนวนเงิน', 'บันทึกโดย', 'ขั้นตอน', 'ผู้ดำเนินการ', 'วันที่ดำเนินการ', 'หมายเหตุ'];
    var csv = head.join(',') + '\n' + S.rows.map(function (r) {
      var e = r.exp;
      return [r.date, r.job.receiveNo, r.job.jobName, r.netId, TL[r.type] || r.type, r.code, r.desc, r.amount, r.by, r.st === 'old' ? 'รายการเก่า' : STG[r.st].s, e.apBy || '', e.apAt ? ymd(e.apAt) : '', e.apNote || '']
        .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'อนุมัติรายจ่าย_' + ymd(new Date().toISOString()) + '.csv'; a.click();
  }

  function render() {
    if (!build()) return;
    var all = collect(); S.allRows = all;
    var tq = $('approvalTypeFilter').value || '';
    $('apx').querySelectorAll('[data-t]').forEach(function (b) { b.classList.toggle('on', b.dataset.t === tq); });
    var by = {}; Object.keys(STG).concat(['old']).forEach(function (k) { by[k] = all.filter(function (r) { return r.st === k; }); });
    var sum = function (a) { return a.reduce(function (s, r) { return s + r.amount; }, 0); };
    if (!S.stg) S.stg = by.print.length ? 'print' : by.sign.length ? 'sign' : by.back.length ? 'back' : 'print';
    $('apFlow').innerHTML = Object.keys(STG).map(function (k) {
      var s = STG[k];
      return '<button class="apf' + (!S.old && S.stg === k ? ' on' : '') + '" data-s="' + k + '" style="--c:' + s.c + '"><small>' + s.n + ' ' + s.t + '</small><b>' + by[k].length + '</b><span>' + m0(sum(by[k])) + ' บ.</span></button>';
    }).join('');
    $('apOld').innerHTML = by.old.length ? (S.old ? '📂 กำลังแสดงรายการเก่า ' + by.old.length + ' รายการ (บันทึกก่อนเริ่มใช้ขั้นตอนอนุมัติ) · <button>กลับไปงานค้าง</button>'
      : 'รายการเก่าที่บันทึกก่อนเริ่มใช้ขั้นตอนนี้ ' + by.old.length + ' รายการ (' + m0(sum(by.old)) + ' บ.) ไม่นับรวมในงานค้าง · <button>ดูรายการเก่า</button>') : '';
    var rows = S.old ? by.old : by[S.stg];
    rows.sort(function (a, b) {
      return String(a.job.receiveNo || '').localeCompare(String(b.job.receiveNo || '')) || (a.job.id - b.job.id) || (b.t - a.t) || (b._i - a._i);
    });
    // จัดกลุ่มงานให้งานที่มีรายการล่าสุดขึ้นก่อน
    var latest = {}; rows.forEach(function (r) { latest[r.job.id] = Math.max(latest[r.job.id] || 0, r.t); });
    rows.sort(function (a, b) { return (latest[b.job.id] - latest[a.job.id]) || (a.job.id - b.job.id) || (b.t - a.t) || (b._i - a._i); });
    S.rows = rows;
    Object.keys(S.sel).forEach(function (k) { if (!rows.some(function (r) { return r.key === k; })) delete S.sel[k]; });
    $('apLt').textContent = (S.old ? 'รายการเก่า' : STG[S.stg].t) + ' · ' + rows.length + ' รายการ · ' + m0(sum(rows)) + ' บาท';
    var b = $('approvalBudgetCountBadge'); if (b) b.innerText = rows.length + ' รายการ';
    var badge = document.getElementById('approvalBadge');
    if (badge) { var pend = by.print.length + by.sign.length + by.back.length; badge.textContent = pend; badge.classList.toggle('hidden', !pend); }
    S.shown = 0; paintList(); paintPv(); syncSel();
  }

  window.renderApprovalFromBudget = function () { try { render(); } catch (e) { console.error('[appr-ui]', e); } };
  function boot() { var d = g('allData', null); if (Array.isArray(d) && d.length) window.renderApprovalFromBudget(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
