/* CCL — หน้า "งบประมาณ" แบบใหม่: กล่องสรุป + ตัวกรองแบบปุ่ม + รายการเป็นการ์ด
   ใช้ช่องกรอง/ฟังก์ชันเดิมทั้งหมด (ย้ายมาวางใหม่) — ตัดงบ/ดูรายการ/ภาพรวม ทำงานเหมือนเดิม */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var TL = { labor: 'ค่าแรง', supervision: 'ค่าคุมงาน', misc: 'ค่าเบ็ดเตล็ด' };
  var TI = { labor: 'fa-hammer', supervision: 'fa-helmet-safety', misc: 'fa-box-open' };
  var PAGE = 40;
  var rowsAll = [], shown = 0, curPct = 80, io = null, focusUrg = false;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function m(n) { return (Number(n) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function g(name, def) { try { return eval(name); } catch (e) { return def; } } // อ่านตัวแปร let ของหน้าเดิม

  var css =
    '#bgx{padding:16px 18px 6px}' +
    '#bgx .ttl{display:flex;align-items:center;gap:10px;font-size:19px;font-weight:700;color:#1e293b}' +
    '#bgx .ttl .ic{width:38px;height:38px;border-radius:11px;background:#fef3c7;color:#d97706;display:grid;place-items:center;font-size:17px}' +
    '#bgx .kpi{display:grid;grid-template-columns:1.4fr 1.2fr 1fr 1fr;gap:10px;margin:14px 0}' +
    '#bgx .k{border-radius:14px;padding:10px 14px;min-width:0}#bgx .k small{display:block;font-size:12.5px;font-weight:600;opacity:.85}' +
    '#bgx .k b{font-size:22px;display:block;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#bgx .k span{font-size:12px;opacity:.8}' +
    '#bgx .k1{background:linear-gradient(135deg,#059669,#10b981);color:#fff}#bgx .k2{background:#ecfdf5;color:#047857}#bgx .k3{background:#eef2ff;color:#4338ca}#bgx .k4{background:#fff7ed;color:#c2410c}' +
    '#bgx .f1{display:flex;gap:10px;flex-wrap:wrap}' +
    '#bgx .srch{flex:1;min-width:220px;position:relative}#bgx .srch i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8}' +
    '#bgx #budgetJobSearch{width:100%;height:46px;border:1.5px solid #cbd5e1;border-radius:12px;padding:0 12px 0 40px;font-size:15px;background:#f8fafc;max-width:none}' +
    '#bgx #budgetJobSearch:focus{outline:none;border-color:#6366f1;background:#fff;box-shadow:0 0 0 3px #e0e7ff}' +
    '#bgx .seg{display:flex;background:#f1f5f9;border-radius:12px;padding:4px;gap:2px}' +
    '#bgx .seg button{padding:0 14px;height:38px;display:flex;align-items:center;gap:6px;border-radius:9px;font-size:14px;font-weight:600;color:#475569;white-space:nowrap;border:0;background:none;cursor:pointer}' +
    '#bgx .seg button.on{background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
    '#bgx .f2{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center}' +
    '#bgx .ch{height:36px;padding:0 13px;border-radius:999px;border:1.5px solid #e2e8f0;background:#fff;font-size:13.5px;font-weight:600;color:#475569;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer;position:relative}' +
    '#bgx .ch.on{background:#4338ca !important;border-color:#4338ca !important;color:#fff !important}' +
    '#bgx .ch.t-labor{color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff}#bgx .ch.t-supervision{color:#7e22ce;border-color:#e9d5ff;background:#faf5ff}#bgx .ch.t-misc{color:#b45309;border-color:#fde68a;background:#fffbeb}' +
    '#bgx .ch.act{border-color:#f59e0b;color:#b45309;background:#fffbeb}' +
    '#bgx .sp{flex:1}' +
    '#bgx .net{position:relative;width:190px}#bgx #budgetNetworkInput{height:36px;border-radius:999px;border:1.5px solid #e2e8f0;padding:0 30px 0 14px;font-size:13.5px;width:100%}' +
    '#bgx .net>i{position:absolute;right:12px;top:11px;color:#94a3b8;font-size:12px;pointer-events:none}#bgx #networkDropdown{font-size:13px;border-radius:12px}' +
    '#bgx .pct{display:inline-flex;align-items:center;border:1.5px solid #c7d2fe;border-radius:999px;height:36px;padding:0 4px 0 12px;font-size:13.5px;font-weight:600;color:#4338ca;gap:6px;white-space:nowrap}' +
    '#bgx #budgetFilterPercent{width:52px;height:28px;border:0;border-radius:999px;background:#eef2ff;text-align:center;font-weight:700;color:#4338ca;font-size:14px}' +
    '#bgx #budgetSortBtn{height:36px;border-radius:999px;font-size:13.5px;padding:0 13px;border-width:1.5px}' +
    '#bgAmtPop{position:absolute;z-index:40;top:42px;left:0;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 30px rgba(15,23,42,.16);padding:12px;cursor:default;color:#334155}' +
    '#bgAmtPop label{font-size:12px !important}#bgAmtPop input{height:36px;font-size:14px !important;width:110px !important}#bgAmtPop button{height:36px;font-size:13px !important}' +
    '#bgFocus{display:none;margin-top:10px;align-items:center;gap:10px;background:#1e293b;color:#fff;border-radius:12px;padding:9px 12px;font-size:14px;font-weight:600}#bgFocus.on{display:flex}#bgFocus b{color:#fde68a}#bgFocus button{margin-left:auto;border:0;border-radius:9px;background:#fff;color:#1e293b;font-weight:700;padding:6px 12px;cursor:pointer;font-family:inherit}' +
    '#bgList{display:grid;gap:10px;padding:8px 18px 20px}' +
    '.bgc{background:#fff;border-radius:16px;padding:14px 16px;border:1px solid #eef2f7;box-shadow:0 1px 3px rgba(15,23,42,.06);border-left:5px solid #10b981;display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:4px 18px}' +
    '.bgc.u{border-left-color:#ef4444;background:#fffbfb}.bgc.w{border-left-color:#f59e0b}' +
    '.bgc .a{display:flex;gap:10px;min-width:0}.bgc .rk{flex-shrink:0;width:28px;height:28px;border-radius:9px;background:#eef2ff;color:#4338ca;font-weight:700;font-size:13px;display:grid;place-items:center;margin-top:2px}' +
    '.bgc .nm{font-size:16px;font-weight:700;line-height:1.4;color:#1e293b;word-break:break-word}' +
    '.bgc .meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;align-items:center;font-size:12.5px;color:#64748b}' +
    '.bgc .tg{border-radius:7px;padding:2px 8px;font-weight:600;font-size:12px;white-space:nowrap}.bgc .rn{background:#eff6ff;color:#1d4ed8}.bgc .bt{background:#f1f5f9;color:#475569}' +
    '.bgc .nt{font-weight:700;color:#334155;font-size:13.5px;white-space:nowrap}' +
    '.bgc .ty{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600;border:1.5px solid;white-space:nowrap}' +
    '.bgc .ty.t-labor{color:#1d4ed8;border-color:#bfdbfe;background:#eff6ff}.bgc .ty.t-supervision{color:#7e22ce;border-color:#e9d5ff;background:#faf5ff}.bgc .ty.t-misc{color:#b45309;border-color:#fde68a;background:#fffbeb}' +
    '.bgc .ids{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;color:#64748b}' +
    '.bgc .more{cursor:pointer;font-family:inherit}' +
    '.bgc .r{text-align:right}.bgc .r small{font-size:12px;color:#64748b;font-weight:600;display:block}' +
    '.bgc .r b{display:block;font-size:24px;color:#047857;line-height:1.25;white-space:nowrap}.bgc.u .r b{color:#dc2626}.bgc.w .r b{color:#d97706}' +
    '.bgc .bd{display:inline-block;font-size:11px;border-radius:999px;padding:1px 8px;font-weight:700;color:#fff;margin-left:4px;vertical-align:middle}' +
    '.bgc .bar{grid-column:1/-1;margin-top:8px}.bgc .bt2{position:relative;height:10px;background:#e2e8f0;border-radius:99px}' +
    '.bgc .bt2 i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#f97316,#fb923c)}.bgc .bt2 i.ov{background:#ef4444}' +
    '.bgc .bt2 .mk{position:absolute;top:-4px;bottom:-4px;width:3px;margin-left:-1px;background:#4338ca;border-radius:2px}' +
    '.bgc .bl{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#64748b;margin-top:5px;flex-wrap:wrap}.bgc .bl b{color:#334155}' +
    '.bgc .ft{grid-column:1/-1;display:flex;align-items:center;gap:8px 10px;margin-top:8px;padding-top:10px;border-top:1px dashed #e2e8f0;flex-wrap:wrap}' +
    '.bgc .who{font-size:13px;color:#64748b;display:flex;gap:4px 14px;flex-wrap:wrap;flex:1;min-width:0}.bgc .who i{margin-right:4px;color:#94a3b8}' +
    '.bgc .btn{height:38px;padding:0 14px;border-radius:10px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer}' +
    '.bgc .btn:hover{background:#f8fafc}.bgc .btn.p{background:#2563eb;border-color:#2563eb;color:#fff;padding:0 18px}.bgc .btn.p:hover{background:#1d4ed8}' +
    '.bgc .btn .n{background:#4338ca;color:#fff;border-radius:99px;font-size:11px;padding:0 6px;line-height:17px}' +
    '#bgEmpty{text-align:center;padding:50px 16px;color:#94a3b8}#bgEmpty i{font-size:44px;color:#86efac;display:block;margin-bottom:10px}' +
    '#bgMore{height:1px}#bgCnt{text-align:center;font-size:12.5px;color:#94a3b8;padding:4px 0 14px}' +
    '@media(max-width:860px){#bgx .kpi{grid-template-columns:1fr 1fr}}' +
    '@media(max-width:700px){#bgx{padding:12px 12px 4px}#bgList{padding:6px 10px 16px}#bgx .k b{font-size:18px}' +
    ' .bgc{grid-template-columns:1fr;padding:12px}.bgc .r{text-align:left;display:flex;align-items:baseline;gap:6px 10px;flex-wrap:wrap;background:#f0fdf4;border-radius:10px;padding:6px 10px;margin-top:6px}' +
    ' .bgc.w .r{background:#fffbeb}.bgc.u .r{background:#fef2f2}.bgc .r small{display:inline}.bgc .r b{font-size:21px;display:inline}' +
    ' #bgx .seg{width:100%}#bgx .seg button{flex:1;justify-content:center;padding:0 6px;font-size:13px}' +
    ' #bgx .f2{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}#bgx .f2::-webkit-scrollbar{display:none}#bgx .sp{display:none}' +
    ' #bgx .net{width:160px;flex-shrink:0}#bgAmtPop{position:fixed;left:12px !important;right:12px;top:auto;bottom:90px}' +
    ' .bgc .ft .btn{flex:1}.bgc .who{flex-basis:100%}.bgc .nm{font-size:15.5px}}';

  // ───── วางหัวหน้าใหม่ (ย้ายช่องกรองเดิมมาใส่) ─────
  function build() {
    var page = $('page-budget'), wrap = $('budgetTableWrap'), card = wrap && wrap.parentNode;
    if (!page || !card || $('bgx')) return !!$('bgx');
    var st = document.createElement('style'); st.id = 'bgxCss'; st.textContent = css; document.head.appendChild(st);
    var oldHead = card.firstElementChild; // แถบหัวเดิม
    var x = document.createElement('div'); x.id = 'bgx';
    x.innerHTML =
      '<div class="ttl"><div class="ic"><i class="fa-solid fa-coins"></i></div>ระบบการจัดงบตามหมายเลขงาน</div>' +
      '<div class="kpi" id="bgKpi"></div>' +
      '<div class="f1"><div class="srch" id="bgSrch"><i class="fa-solid fa-magnifying-glass"></i></div>' +
      '<div class="seg" id="bgSeg"><button data-v="">ทั้งหมด</button><button data-v="self"><i class="fa-solid fa-bolt" style="color:#eab308"></i>ไฟฟ้าทำเอง</button><button data-v="contractor"><i class="fa-solid fa-helmet-safety" style="color:#f97316"></i>ผู้รับจ้าง</button></div></div>' +
      '<div class="f2" id="bgF2">' +
      '<span class="ch" data-t="">ทุกประเภท</span>' +
      '<span class="ch t-labor" data-t="labor"><i class="fa-solid fa-hammer"></i>ค่าแรง</span>' +
      '<span class="ch t-supervision" data-t="supervision"><i class="fa-solid fa-helmet-safety"></i>ค่าคุมงาน</span>' +
      '<span class="ch t-misc" data-t="misc"><i class="fa-solid fa-box-open"></i>เบ็ดเตล็ด</span>' +
      '<div class="net" id="bgNet"></div>' +
      '<span class="ch" id="bgAmtBtn"><i class="fa-solid fa-baht-sign"></i><span id="bgAmtLbl">ช่วงเงินที่ตัดได้</span> <i class="fa-solid fa-chevron-down" style="font-size:11px"></i></span>' +
      '<span class="sp"></span>' +
      '<span class="pct" id="bgPct">เป้าเบิกจ่าย </span>' +
      '<span id="bgSort"></span>' +
      '<span class="ch" id="bgClr"><i class="fa-solid fa-xmark"></i>ล้าง</span></div>';
    x.insertAdjacentHTML('beforeend', '<div id="bgFocus"><i class="fa-solid fa-filter"></i><span></span><button type="button">✕ แสดงทั้งหมด</button></div>');
    card.insertBefore(x, oldHead);
    $('bgFocus').querySelector('button').onclick = function () { focusUrg = false; render(window.allData || g('allData', [])); };

    // ย้ายช่องเดิม (ไอดี/ฟังก์ชันเดิมทำงานต่อ)
    var js = $('budgetJobSearch'); js.placeholder = 'ค้นหาชื่องาน / เลขที่รับ / หมายเลขงาน / Net'; js.className = ''; $('bgSrch').appendChild(js);
    var ni = $('budgetNetworkInput'), netBox = ni.closest('.relative.flex-shrink-0');
    ni.className = ''; ni.placeholder = 'โครงข่าย: ทั้งหมด';
    $('bgNet').appendChild(ni); $('bgNet').insertAdjacentHTML('beforeend', '<i class="fa-solid fa-chevron-down"></i>');
    $('bgNet').appendChild($('networkDropdown')); $('bgNet').appendChild($('budgetNetworkFilter'));
    var pc = $('budgetFilterPercent'); pc.className = ''; $('bgPct').appendChild(pc); $('bgPct').insertAdjacentHTML('beforeend', '<span style="padding-right:8px">%</span>');
    var sb = $('budgetSortBtn'); sb.className = 'ch'; $('bgSort').appendChild(sb);
    // ช่วงเงิน → หน้าต่างเล็ก
    var amtBox = $('budgetAmtMin').closest('.flex-col');
    var pop = document.createElement('div'); pop.id = 'bgAmtPop'; pop.style.display = 'none';
    pop.appendChild(amtBox); $('bgAmtBtn').appendChild(pop);
    $('bgAmtBtn').addEventListener('click', function (e) { if (pop.contains(e.target)) return; pop.style.display = pop.style.display === 'none' ? 'block' : 'none'; if (pop.style.display === 'block') $('budgetAmtMin').focus(); });
    document.addEventListener('click', function (e) { if (!$('bgAmtBtn').contains(e.target)) pop.style.display = 'none'; });
    // ซ่อนหัวเดิม + แถบเหลือง + ตาราง
    oldHead.style.display = 'none';
    if ($('budgetFilterInfo')) $('budgetFilterInfo').style.setProperty('display', 'none', 'important');
    wrap.style.display = 'none';
    var list = document.createElement('div'); list.id = 'bgList'; card.appendChild(list);
    var cnt = document.createElement('div'); cnt.id = 'bgCnt'; card.appendChild(cnt);

    $('bgSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setEntityFilter(b.dataset.v); });
    x.querySelectorAll('[data-t]').forEach(function (c) {
      c.addEventListener('click', function () { $('budgetTypeFilter').value = c.dataset.t; applyBudgetFilters(); });
    });
    $('bgClr').addEventListener('click', function () { clearBudgetFilter(); pop.style.display = 'none'; });
    void netBox;
    return true;
  }

  function syncHead() {
    var ent = g('_budgetEntityFilter', '');
    $('bgSeg').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === ent); });
    var t = $('budgetTypeFilter').value;
    $('bgx').querySelectorAll('[data-t]').forEach(function (c) { c.classList.toggle('on', c.dataset.t === t); });
    var a = g('_budgetAmtMin', null), b = g('_budgetAmtMax', null), on = a !== null || b !== null;
    $('bgAmtBtn').classList.toggle('act', on);
    $('bgAmtLbl').textContent = on ? (a !== null ? a.toLocaleString() : '0') + ' – ' + (b !== null ? b.toLocaleString() : '∞') : 'ช่วงเงินที่ตัดได้';
  }

  // ───── คำนวณรายการ (ตรรกะเดียวกับของเดิม) ─────
  function compute(data) {
    var filterNetwork = ($('budgetNetworkFilter') && $('budgetNetworkFilter').value || '').trim();
    var filterType = ($('budgetTypeFilter') && $('budgetTypeFilter').value || '').trim();
    var targetPct = parseFloat($('budgetFilterPercent') && $('budgetFilterPercent').value) || 80;
    var entF = g('_budgetEntityFilter', '');
    var rows = [], jobsBase = 0;
    (data || []).forEach(function (row) {
      if (!row.networkId) return;
      if (row.status === 'ส่งปิดงาน' || row.status === 'ปิดงานแล้วเสร็จ') return;
      var isSelf = (row.responsibleEntity || '').trim() === 'ไฟฟ้าดำเนินการเอง';
      if (entF === 'self' && !isSelf) return;
      if (entF === 'contractor' && isSelf) return;
      jobsBase++;
      var split = function (s, num) { return String(s || '').split(',').map(function (v) { return num ? (parseFloat(v) || 0) : v.trim(); }); };
      var nets = String(row.networkId).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var lc = split(row.laborCost, 1), lk = split(row.laborCode), sc = split(row.supervisionCost, 1), sk = split(row.supervisionCode), mc = split(row.miscCost, 1), mk = split(row.miscCode);
      var ex = row.expenses || [];
      if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } }
      if (!Array.isArray(ex)) ex = [];
      nets.forEach(function (netId, idx) {
        if (filterNetwork && netId !== filterNetwork) return;
        [['labor', lc[idx] || 0, lk[idx] || '0030'], ['supervision', sc[idx] || 0, sk[idx] || '0040'], ['misc', mc[idx] || 0, mk[idx] || '0060']].forEach(function (d) {
          var type = d[0], budget = d[1], code = d[2];
          if (budget <= 0) return;
          if (filterType && type !== filterType) return;
          var mine = ex.filter(function (e) { return Number(e.netIdx) === Number(idx) && e.type === type; });
          var spent = mine.reduce(function (s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
          var target = budget * (targetPct / 100), cuttable = target - spent;
          if (cuttable <= 0) return;
          rows.push({ jobId: row.id, receiveNo: row.receiveNo, jobName: row.jobName, jobIds: row.jobIds || '', budgetType: row.budgetType,
            assignee: row.assignee, responsibleEntity: row.responsibleEntity, netId: netId, netIdx: idx, type: type, code: code,
            budget: budget, spent: spent, target: target, cuttable: cuttable, usedPct: budget > 0 ? spent / budget * 100 : 0,
            targetUsedPct: target > 0 ? spent / target * 100 : 0, expCount: mine.length });
        });
      });
    });
    var q = ($('budgetJobSearch') && $('budgetJobSearch').value || '').toLowerCase().trim();
    if (q) rows = rows.filter(function (r) { return [r.jobName, r.receiveNo, r.jobIds, r.netId].some(function (v) { return String(v || '').toLowerCase().indexOf(q) >= 0; }); });
    var a = g('_budgetAmtMin', null), b = g('_budgetAmtMax', null);
    if (a !== null || b !== null) rows = rows.filter(function (r) { return !(a !== null && r.cuttable < a) && !(b !== null && r.cuttable > b); });
    var desc = g('_budgetSortDesc', true);
    rows.sort(function (x, y) { return desc ? y.cuttable - x.cuttable : x.cuttable - y.cuttable; });
    return { rows: rows, pct: targetPct, q: q, amt: a !== null || b !== null };
  }

  function card(r, i) {
    var urg = r.cuttable / r.target, cls = urg < 0.15 ? 'u' : urg < 0.35 ? 'w' : '';
    var ids = String(r.jobIds || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var ent = String(r.responsibleEntity || '').trim(), self = ent === 'ไฟฟ้าดำเนินการเอง';
    var markPos = Math.min(100, curPct > 0 ? 100 * curPct / Math.max(100, curPct) : 0);
    var used = Math.min(r.usedPct, 100);
    return '<div class="bgc ' + cls + '">' +
      '<div class="a"><div class="rk">' + (i + 1) + '</div><div style="min-width:0">' +
        '<div class="nm">' + esc(r.jobName || '-') + '</div>' +
        '<div class="meta"><span class="tg rn">' + esc(r.receiveNo || '-') + '</span>' + (r.budgetType ? '<span class="tg bt">' + esc(r.budgetType) + '</span>' : '') +
        '<span class="nt">Net ' + esc(r.netId) + '</span><span class="ty t-' + r.type + '"><i class="fa-solid ' + TI[r.type] + '"></i> ' + TL[r.type] + ' · ' + esc(r.code) + '</span></div>' +
        (ids.length ? '<div class="meta ids">' + esc(ids[0]) + (ids.length > 1 ? ' <span class="tg bt more" title="' + esc(ids.join('\n')) + '" onclick="this.parentNode.innerHTML=this.title.split(\'\\n\').map(function(s){return \'<div>\'+s+\'</div>\'}).join(\'\')">+' + (ids.length - 1) + ' หมายเลข</span>' : '') + '</div>' : '') +
      '</div></div>' +
      '<div class="r"><small>ตัดได้อีก</small><b>' + m(r.cuttable) + (cls === 'u' ? '<span class="bd" style="background:#ef4444">ด่วน</span>' : cls === 'w' ? '<span class="bd" style="background:#f59e0b">ใกล้เต็ม</span>' : '') + '</b>' +
        '<small>' + Math.max(0, 100 - r.targetUsedPct).toFixed(1) + '% ก่อนถึงเป้า</small></div>' +
      '<div class="bar"><div class="bt2"><i class="' + (r.usedPct >= 100 ? 'ov' : '') + '" style="width:' + used + '%"></i><div class="mk" style="left:' + markPos + '%"></div></div>' +
        '<div class="bl"><span>ใช้ไป <b>' + m(r.spent) + '</b> (' + r.usedPct.toFixed(1) + '%)</span><span>เป้า ' + curPct + '% <b>' + m(r.target) + '</b></span><span>งบ <b>' + m(r.budget) + '</b></span></div></div>' +
      '<div class="ft"><div class="who">' +
        (ent ? '<span>' + (self ? '<i class="fa-solid fa-bolt" style="color:#eab308"></i>' : '<i class="fa-solid fa-helmet-safety" style="color:#f97316"></i>') + '<span>' + esc(ent) + '</span></span>' : '') +
        '<span><i class="fa-solid fa-user-tie"></i>' + esc(r.assignee || '-') + '</span></div>' +
        '<button class="btn" onclick="openExpensesList(' + r.jobId + ',' + r.netIdx + ',\'' + r.type + '\',\'' + TL[r.type] + '\',' + r.budget + ')"><i class="fa-solid fa-list-ol"></i>รายการ' + (r.expCount ? ' <span class="n">' + r.expCount + '</span>' : '') + '</button>' +
        '<button class="btn" onclick="openBudgetModal(' + r.jobId + ')"><i class="fa-solid fa-coins" style="color:#eab308"></i>ภาพรวม</button>' +
        '<button class="btn p" onclick="openCutBudgetFromTable(' + r.jobId + ',' + r.netId + ',' + r.netIdx + ',\'' + r.type + '\',\'' + TL[r.type] + '\',' + r.cuttable + ')"><i class="fa-solid fa-scissors"></i>ตัดงบ</button>' +
      '</div></div>';
  }

  function more() {
    var L = $('bgList'), n = Math.min(rowsAll.length, shown + PAGE), h = '';
    for (var i = shown; i < n; i++) h += card(rowsAll[i], i);
    var s = $('bgMore'); if (s) s.remove();
    L.insertAdjacentHTML('beforeend', h); shown = n;
    $('bgCnt').textContent = rowsAll.length ? 'แสดง ' + shown.toLocaleString() + ' จาก ' + rowsAll.length.toLocaleString() + ' รายการ' : '';
    if (shown < rowsAll.length) {
      L.insertAdjacentHTML('beforeend', '<div id="bgMore"></div>');
      if (!io) io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) more(); }, { rootMargin: '600px' });
      io.observe($('bgMore'));
    }
  }

  function render(data) {
    if (!build()) return;
    syncHead();
    var c = compute(data); rowsAll = c.rows; curPct = c.pct; shown = 0;
    if (focusUrg) rowsAll = rowsAll.filter(function (r) { return r.cuttable / r.target < 0.15; });
    $('bgFocus').classList.toggle('on', focusUrg); if (focusUrg) $('bgFocus').querySelector('span').innerHTML = 'แสดงเฉพาะ: <b>งบใกล้ถึงเป้า (ด่วน)</b> · ' + rowsAll.length + ' รายการ';
    var tot = 0, noSup = 0, bud = 0, urg = 0, warn = 0, jobs = {};
    rowsAll.forEach(function (r) {
      tot += r.cuttable; bud += r.budget; if (r.type !== 'supervision') noSup += r.cuttable; jobs[r.jobId] = 1;
      var u = r.cuttable / r.target; if (u < 0.15) urg++; else if (u < 0.35) warn++;
    });
    var pc = function (v) { return bud > 0 ? (v / bud * 100).toFixed(1) : '0.0'; };
    $('bgKpi').innerHTML =
      '<div class="k k1"><small>ตัดงบได้อีกรวม</small><b>' + m(tot) + '</b><span>บาท · ' + pc(tot) + '% ของงบ</span></div>' +
      '<div class="k k2"><small>ไม่รวมค่าคุมงาน</small><b>' + m(noSup) + '</b><span>บาท · ' + pc(noSup) + '%</span></div>' +
      '<div class="k k3"><small>รายการที่ตัดได้</small><b>' + rowsAll.length.toLocaleString() + '</b><span>รายการ จาก ' + Object.keys(jobs).length.toLocaleString() + ' งาน</span></div>' +
      '<div class="k k4"><small>ใกล้ถึงเป้า</small><b>' + urg + ' <span style="font-size:14px">ด่วน</span> · ' + warn + '</b><span>ใกล้เต็ม</span></div>';
    var L = $('bgList'); L.innerHTML = '';
    if (!rowsAll.length) {
      L.innerHTML = '<div id="bgEmpty"><i class="fa-solid fa-circle-check"></i><div style="font-weight:700;font-size:16px;color:#64748b">ไม่พบรายการ</div><div style="font-size:13px;margin-top:4px">' +
        (c.amt ? 'ไม่มีรายการในช่วงเงินที่เลือก' : c.q ? 'ไม่พบงานที่ตรงกับ "' + esc(c.q) + '"' : 'ทุกรายการเบิกจ่ายครบตามเป้า ' + c.pct + '% แล้ว หรือลองเพิ่ม % เป้า') + '</div></div>';
      $('bgCnt').textContent = '';
      return;
    }
    more();
  }

  window.cclBudgetGo = function (urgent) { focusUrg = !!urgent; try { showPage('budget'); } catch (e) {} window.renderBudgetTable(g('allData', [])); window.scrollTo(0, 0); };
  window.renderBudgetTable = function (data) {
    try { render(data); } catch (e) { console.error('[budget-ui]', e); }
  };
  // หน้าถูกวาดไปแล้วก่อนไฟล์นี้โหลด → วาดใหม่
  function boot() { try { if (Array.isArray(g('allData', null)) && g('allData', []).length) window.renderBudgetTable(g('allData', [])); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
