/* CCL — หน้า Dashboard แบบใหม่: เส้นทางงาน + ต้องติดตาม + งบ + ผู้รับจ้าง + ความเคลื่อนไหวล่าสุด
   ดึงจาก allData ในหน้า (ไม่เรียกหลังบ้านเพิ่ม) · ปุ่ม LINE ใช้ sendFollowUpLine เดิม */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  function n0(v) { return Math.round(Number(v) || 0).toLocaleString('th-TH'); }
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var TH_D = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  function days(v) { var d = new Date(v); return isNaN(d) ? null : Math.max(0, Math.ceil((Date.now() - d) / 86400000)); }
  function tl(j) { return Array.isArray(j.jobTimeline) ? j.jobTimeline : []; }
  function lastTl(j, f) { var a = tl(j); for (var i = a.length - 1; i >= 0; i--) if (f(a[i])) return a[i]; return null; }
  function ago(ts) {
    var d = new Date(ts); if (isNaN(d)) return '';
    var m = Math.round((Date.now() - d) / 60000);
    if (m < 60) return m <= 1 ? 'เมื่อสักครู่' : m + ' นาทีที่แล้ว';
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    if (d >= t) return 'วันนี้ ' + hm;
    if (d >= t - 86400000) return 'เมื่อวาน ' + hm;
    return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + hm;
  }

  var css =
    '#dbx{display:grid;gap:14px}#dbx .card{background:#fff;border-radius:18px;padding:16px;border:1px solid #eef2f7;box-shadow:0 1px 3px rgba(15,23,42,.06);min-width:0}' +
    '#dbx h3{margin:0 0 12px;font-size:16px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px}#dbx h3 small{margin-left:auto;font-size:12.5px;color:#64748b;font-weight:600}' +
    '#dbx .hi{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#dbx .hi h2{margin:0;font-size:21px;font-weight:700;color:#1e293b}#dbx .hi p{margin:2px 0 0;color:#64748b;font-size:13.5px}#dbx .hi .sp{flex:1}' +
    '#dbx .tb{height:40px;padding:0 15px;border-radius:11px;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:7px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;white-space:nowrap;cursor:pointer;font-family:inherit}' +
    '#dbx .tb.g{background:#06c755;border-color:#06c755;color:#fff}' +
    '#dbx .flow{display:flex;align-items:stretch;margin-top:14px;overflow-x:auto;padding-bottom:2px}#dbx .flow::-webkit-scrollbar{display:none}' +
    '#dbx .fs{flex:1;min-width:118px;border-radius:14px;padding:10px 12px;cursor:pointer;border:2px solid transparent;transition:transform .12s;text-align:left;font-family:inherit}#dbx .fs:hover{transform:translateY(-2px);border-color:currentColor}' +
    '#dbx .fs small{font-size:12.5px;font-weight:700;display:block;white-space:nowrap}#dbx .fs b{font-size:26px;line-height:1.2;display:block}#dbx .fs span{font-size:11.5px;opacity:.9;display:block}' +
    '#dbx .ar{width:20px;display:grid;place-items:center;color:#cbd5e1;font-size:18px;flex-shrink:0}' +
    '#dbx .sub{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}#dbx .sub i{font-style:normal;font-size:11px;background:rgba(255,255,255,.75);border-radius:6px;padding:1px 6px;font-weight:600}' +
    '#dbAvg .avs{margin-left:auto;display:flex;background:#f1f5f9;border-radius:10px;padding:3px}#dbAvg .avs button{border:0;background:none;padding:5px 11px;border-radius:8px;font:700 12.5px inherit;font-family:inherit;color:#64748b;cursor:pointer}#dbAvg .avs .on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.1)}' +
    '#dbAvg .asub{font-size:12px;color:#64748b;margin:-6px 0 10px}#dbAvg .ag2{display:grid;grid-template-columns:150px repeat(4,minmax(0,1fr));gap:8px}#dbAvg .ak.at{border:2px solid currentColor}#dbAvg .ak.at.in{color:#1d4ed8}#dbAvg .ak.at.ps{color:#047857}#dbAvg .ak.at.cl{color:#6d28d9}#dbAvg .aq .sum td{border-top:2px solid #e2e8f0;font-weight:800;background:#f8fafc}#dbAvg .ah{font-size:12px;color:#94a3b8;font-weight:700;text-align:center}' +
    '#dbAvg .al{display:flex;flex-direction:column;justify-content:center;font-weight:700;font-size:14px;color:#1e293b}#dbAvg .al small{font-weight:600;color:#64748b;font-size:11.5px}' +
    '#dbAvg .ak{border-radius:14px;padding:9px 12px}#dbAvg .ak b{font-size:24px;display:block;line-height:1.2}#dbAvg .ak small{font-size:11.5px;color:#475569;font-weight:600}' +
    '#dbAvg .ak.in{background:#eff6ff}#dbAvg .ak.in b{color:#1d4ed8}#dbAvg .ak.ps{background:#ecfdf5}#dbAvg .ak.ps b{color:#047857}#dbAvg .ak.cl{background:#f5f3ff}#dbAvg .ak.cl b{color:#6d28d9}' +
    '#dbAvg .abal{margin:12px 0;background:#fffbeb;border-radius:12px;padding:9px 12px;font-size:13px;color:#92400e}#dbAvg .aq{width:100%;border-collapse:collapse;font-size:13px}#dbAvg .aq th{color:#94a3b8;font-size:12px;font-weight:700;text-align:left;padding:5px 8px}#dbAvg .aq td{padding:7px 8px;border-top:1px solid #f1f5f9}#dbAvg .aq .n{text-align:right}#dbAvg .aq .now td{background:#f0fdfa;font-weight:700}' +
    '#dbAvg .anote{font-size:11.5px;color:#94a3b8;margin-top:8px}' +
    '@media(max-width:640px){#dbAvg h3{flex-wrap:wrap}#dbAvg .avs{margin-left:0;width:100%}#dbAvg .avs button{flex:1}#dbAvg .ag2{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}#dbAvg .ak{padding:8px}#dbAvg .ag2>div:first-child{display:none}#dbAvg .al{grid-column:1/-1;flex-direction:row;gap:8px;align-items:baseline;margin-top:4px}#dbAvg .ak b{font-size:20px}}' +
    '#dbx .g2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px}' +
    '#dbx .td{display:flex;align-items:center;gap:12px;border:1.5px solid #f1f5f9;border-radius:14px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:background .12s}#dbx .td:hover{background:#f8fafc}' +
    '#dbx .td.zero{opacity:.55}#dbx .td .ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:17px;flex-shrink:0}' +
    '#dbx .td .tx{flex:1;min-width:0}#dbx .td .tx b{display:block;font-size:14.5px;color:#1e293b}#dbx .td .tx small{color:#64748b;font-size:12.5px}' +
    '#dbx .td .n{font-size:24px;font-weight:700}#dbx .td .go{height:34px;padding:0 12px;border-radius:9px;background:#f1f5f9;color:#334155;font-weight:600;font-size:13px;display:flex;align-items:center;white-space:nowrap}' +
    '#dbx .big{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}#dbx .big b{font-size:28px;color:#1e293b}' +
    '#dbx .bar{height:14px;border-radius:99px;background:#e2e8f0;position:relative;margin:10px 0 6px}#dbx .bar i{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:linear-gradient(90deg,#f97316,#fb923c)}' +
    '#dbx .bar .mk{position:absolute;top:-5px;bottom:-5px;width:3px;background:#4338ca;border-radius:2px}' +
    '#dbx .row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#64748b}#dbx .row b{color:#334155}' +
    '#dbx .bt3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}#dbx .bt3 div{border-radius:12px;padding:8px 10px;cursor:pointer}#dbx .bt3 small{display:block;font-size:12px;font-weight:600}#dbx .bt3 b{font-size:16px}' +
    '#dbx .ch2{display:flex;align-items:flex-end;gap:10px;height:140px;padding:0 4px;border-bottom:1px solid #e2e8f0}#dbx .ch2 .m{flex:1;display:flex;gap:3px;align-items:flex-end;height:100%}' +
    '#dbx .ch2 .m i{flex:1;border-radius:5px 5px 0 0;display:block;position:relative;min-height:2px}#dbx .ch2 .m i em{position:absolute;top:-17px;left:0;right:0;text-align:center;font-style:normal;font-size:10.5px;color:#64748b;font-weight:600}' +
    '#dbx .xl{display:flex;gap:10px;padding:4px}#dbx .xl span{flex:1;text-align:center;font-size:11.5px;color:#64748b}' +
    '#dbx .lg{display:flex;gap:14px;font-size:12.5px;color:#64748b;margin-top:6px}#dbx .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}' +
    '#dbx table{width:100%;border-collapse:collapse;font-size:13.5px}#dbx th{text-align:left;font-size:12px;color:#64748b;font-weight:600;padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap}' +
    '#dbx td{padding:8px;border-bottom:1px solid #f1f5f9}#dbx td.n,#dbx th.n{text-align:right}#dbx td.n{font-weight:700}' +
    '#dbx .ag{display:grid;gap:7px}#dbx .ag div{display:flex;align-items:center;gap:8px;font-size:13px}#dbx .ag span{width:120px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}' +
    '#dbx .ag i{height:14px;border-radius:5px;display:block;background:#818cf8;min-width:4px}#dbx .ag b{font-size:13px}' +
    '#dbx .fd{display:flex;gap:10px;font-size:13px;padding:6px 0;border-bottom:1px solid #f8fafc;cursor:pointer}#dbx .fd .dot{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;font-size:13px}' +
    '#dbx .fd small{display:block;color:#94a3b8;font-size:11.5px}#dbx .fd div{min-width:0}' +
    '@media(max-width:860px){#dbx .g2{grid-template-columns:1fr}}' +
    '@media(max-width:600px){#dbx .fs{min-width:100px}#dbx .fs b{font-size:21px}#dbx .hi .tb span{display:none}#dbx .card{padding:13px}#dbx .ag span{width:90px}}';

  function money(j) {
    var sp = function (s) { return String(s || '').split(',').map(function (v) { return parseFloat(v) || 0; }); };
    var lc = sp(j.laborCost), sc = sp(j.supervisionCost), mc = sp(j.miscCost);
    var ex = j.expenses || []; if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } } if (!Array.isArray(ex)) ex = [];
    var nets = String(j.networkId || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var out = { bud: 0, sp: 0, lines: [] };
    nets.forEach(function (n, i) {
      [['labor', lc[i] || 0], ['supervision', sc[i] || 0], ['misc', mc[i] || 0]].forEach(function (d) {
        if (d[1] <= 0) return;
        var s = ex.filter(function (e) { return Number(e.netIdx) === i && e.type === d[0]; }).reduce(function (a, e) { return a + (parseFloat(e.amount) || 0); }, 0);
        out.bud += d[1]; out.sp += s; out.lines.push({ type: d[0], bud: d[1], sp: s });
      });
    });
    return out;
  }
  function sapClosed(j) {
    var sap = null; try { sap = JSON.parse(localStorage.getItem('ccl_sap_status_v1') || 'null'); } catch (e) {}
    if (!sap || !sap.map) return false;
    var ids = String(j.jobIds || '').split(',').map(function (x) { return x.toUpperCase().replace(/\s+/g, ''); }).filter(function (x) { return x.length > 5; });
    var got = ids.map(function (i) { return sap.map[i] && sap.map[i][0]; }).filter(Boolean);
    return got.length > 0 && got.every(function (x) { return x === 'CLSD'; });
  }
  function inspStage(j) {
    var ins = j.inspectionStatus || '', pass = ins === 'ผ่านการตรวจรับ';
    if (/ไม่ผ่าน/.test(ins)) return 'fail'; if (!pass) return 'wait';
    var std = lastTl(j, function (h) { return h.status === 'ตรวจมาตรฐาน'; });
    var ok = std && /ผ่านการตรวจมาตรฐาน/.test(std.details || '') && !/ไม่ผ่านการตรวจมาตรฐาน/.test(std.details || '');
    return ok ? 'ready' : 'std';
  }
  function openProblems(data) {
    var out = [];
    data.forEach(function (j) {
      if (j.status === 'ปิดงานแล้วเสร็จ' || j.status === 'ยกเลิก') return;
      var u = Array.isArray(j.contractorUpdates) ? j.contractorUpdates : [], lp = -1, lr = -1;
      u.forEach(function (x, i) { if (x && x.updateType === 'problem') lp = i; if (x && x.updateType === 'pea_reply') lr = i; });
      if (lp >= 0 && lr < lp) out.push({ j: j, u: u[lp] });
    });
    return out;
  }

  var FOC = {};
  function idset(arr) { var o = {}; arr.forEach(function (j) { o[j.id] = 1; }); return o; }
  function build() {
    var page = $('page-dashboard'); if (!page) return false;
    if ($('dbx')) return true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    Array.prototype.forEach.call(page.children, function (c) { c.style.display = 'none'; });
    var x = document.createElement('div'); x.id = 'dbx'; page.insertBefore(x, page.firstChild);
    x.addEventListener('click', function (e) {
      var a = e.target.closest('[data-go]'); if (!a || e.target.closest('.ctl-name')) return;
      var p = a.dataset.go.split(':');
      try {
        if (p[0] === 'track' && window.cclPagesGo) cclPagesGo.track(p[1] || '', p[2] === '1');
        else if (p[0] === 'insp' && window.cclPagesGo) cclPagesGo.insp(p[1] || '', p[2] === '1');
        else if (p[0] === 'close' && window.cclCloseGo) cclCloseGo(p[1] || '');
        else if (p[0] === 'job') openDetailModal(Number(p[1]));
        else if (p[0] === 'f' && FOC[p[1]] && window.cclPagesGo) { var f = FOC[p[1]]; cclPagesGo[f.page]('', true, idset(f.list), f.label); }
        else if (p[0] === 'bud' && window.cclBudgetGo) cclBudgetGo(true);
        else if (p[0] === 'prob') showProblems();
        else showPage(p[0]);
      } catch (er) { console.error(er); }
    });
    return true;
  }

  function showProblems() {
    var list = openProblems(g('allData', []) || []);
    if (!window.Swal) return;
    Swal.fire({ title: 'ผู้รับจ้างแจ้งปัญหา (ยังไม่ตอบ)', width: 620, showConfirmButton: false, showCloseButton: true,
      html: list.length ? '<div style="text-align:left;font-size:13.5px">' + list.map(function (p) {
        return '<div style="padding:8px 4px;border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="Swal.close();openDetailModal(' + p.j.id + ')"><b style="color:#1d4ed8">' + esc(p.j.receiveNo || '-') + '</b> ' + esc(p.j.jobName || '') +
          '<div style="color:#b91c1c;margin-top:2px">⚠️ ' + esc(p.u.note || p.u.detail || p.u.message || 'แจ้งปัญหา') + '</div><small style="color:#94a3b8">' + esc(p.j.responsibleEntity || '') + ' · ' + esc(ago(p.u.timestamp)) + '</small></div>';
      }).join('') + '</div>' : 'ไม่มีรายการ' });
  }

  // ───── 📈 ค่าเฉลี่ยงาน: งานเข้า / ก่อสร้างเสร็จ / ปิดงาน — ต่อวัน ต่อเดือน ต่อไตรมาส ─────
  var AVG = 'year', CLOSE_FROM = new Date(2026, 10, 21);
  function avgCard(all, passAt, closedAt, now) {
    var DAY = 86400000, t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), start, lbl;
    var qs = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    if (AVG === 'q') { start = qs; lbl = 'ไตรมาสนี้'; }
    else if (AVG === '12m') { start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1); lbl = '12 เดือนล่าสุด'; }
    else { start = new Date(now.getFullYear(), 0, 1); lbl = 'ปี ' + (now.getFullYear() + 543); }
    var dn = Math.max(1, Math.round((t0 - start) / DAY));
    var inR = function (d, s0) { return d && !isNaN(d) && d >= (s0 || start) && d < t0; };
    var nIn = all.filter(function (j) { return inR(new Date(j.receiveDate)); }).length;
    var nPs = all.filter(function (j) { return inR(passAt(j)); }).length;
    var cs = start > CLOSE_FROM ? start : CLOSE_FROM, cdn = Math.max(1, Math.round((t0 - cs) / DAY));
    var nCl = all.filter(function (j) { return j.status === 'ปิดงานแล้วเสร็จ' && inR(closedAt(j), cs); }).length;
    var f1 = function (v) { return v >= 10 ? v.toFixed(1) : v >= 1 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, ''); };
    var tot = function (n, cls) { return '<div class="ak at ' + cls + '"><b>' + n + '</b><small>งาน</small></div>'; };
    var cells = function (n, d, cls) { return tot(n, cls) + ['วัน', 'เดือน', 'ไตรมาส'].map(function (u, i) { var v = n / d * [1, 30.4375, 91.3125][i]; return '<div class="ak ' + cls + '"><b>' + f1(v) + '</b><small>งาน/' + u + '</small></div>'; }).join(''); };
    var dt = function (d) { return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2); };
    var clShort = cdn < 14;
    var diffM = (nIn - nPs) / dn * 30.4375;
    var bal = Math.abs(diffM) < 0.5 ? '⚖️ งานเข้ากับงานเสร็จพอๆ กัน — งานค้างคงที่' :
      diffM > 0 ? '⚖️ งานเข้ามากกว่างานเสร็จเฉลี่ย <b>' + f1(diffM) + ' งาน/เดือน</b> → งานค้างเพิ่มขึ้น' : '⚖️ งานเสร็จมากกว่างานเข้าเฉลี่ย <b>' + f1(-diffM) + ' งาน/เดือน</b> → งานค้างลดลง 👍';
    // รายไตรมาสของปีนี้
    var rows = '', sI = 0, sP = 0, sD = 0;
    for (var q = 0; q <= Math.floor(now.getMonth() / 3); q++) {
      var a0 = new Date(now.getFullYear(), q * 3, 1), a1 = new Date(now.getFullYear(), q * 3 + 3, 1), cur = a1 > now, e1 = cur ? t0 : a1, qd = Math.max(1, Math.round((e1 - a0) / DAY));
      var w = function (d) { return d && !isNaN(d) && d >= a0 && d < e1; };
      var qi = all.filter(function (j) { return w(new Date(j.receiveDate)); }).length, qp = all.filter(function (j) { return w(passAt(j)); }).length, df = qi - qp;
      sI += qi; sP += qp; sD += qd;
      rows += '<tr' + (cur ? ' class="now"' : '') + '><td>Q' + (q + 1) + ' (' + TH_M[q * 3] + '–' + TH_M[q * 3 + 2] + ')' + (cur ? ' ถึงวันนี้' : '') + '</td><td class="n">' + qi + '</td><td class="n">' + f1(qi / qd) + '</td><td class="n">' + qp + '</td><td class="n">' + f1(qp / qd) + '</td><td class="n" style="color:' + (df > 0 ? '#dc2626' : '#059669') + '">' + (df > 0 ? '+' : df < 0 ? '−' : '') + Math.abs(df) + '</td></tr>';
    }
    return '<div class="card" id="dbAvg"><h3>📈 ค่าเฉลี่ยงาน<span class="avs">' + [['year', 'ปี ' + (now.getFullYear() + 543)], ['12m', '12 เดือนล่าสุด'], ['q', 'ไตรมาสนี้']].map(function (o) { return '<button data-avg="' + o[0] + '" class="' + (AVG === o[0] ? 'on' : '') + '">' + o[1] + '</button>'; }).join('') + '</span></h3>' +
      '<div class="asub">' + dt(start) + ' – ' + dt(now) + ' (' + dn + ' วัน)</div>' +
      '<div class="ag2"><div></div><div class="ah">รวม</div><div class="ah">ต่อวัน</div><div class="ah">ต่อเดือน</div><div class="ah">ต่อไตรมาส</div>' +
      '<div class="al">📥 งานเข้า<small>' + nIn + ' งาน (วันที่รับเรื่อง)</small></div>' + cells(nIn, dn, 'in') +
      '<div class="al">🏗️ ก่อสร้างเสร็จ<small>' + nPs + ' งาน (ตรวจรับผ่าน)</small></div>' + cells(nPs, dn, 'ps') +
      '<div class="al">✅ ปิดงาน<small>' + (clShort ? 'เริ่มนับ ' + dt(CLOSE_FROM) + ' · ปิดแล้ว ' + nCl + ' งาน' : nCl + ' งาน (นับตั้งแต่ ' + dt(cs) + ')') + '</small></div>' +
      (clShort ? tot(nCl, 'cl') + '<div class="ak cl" style="grid-column:span 3"><b>–</b><small>รอข้อมูลสะสมอย่างน้อย 2 สัปดาห์ (อีก ' + (14 - cdn) + ' วัน)</small></div>' : cells(nCl, cdn, 'cl')) + '</div>' +
      '<div class="abal">' + bal + '</div>' +
      '<div style="overflow-x:auto"><table class="aq"><tr><th>รายไตรมาส ' + (now.getFullYear() + 543) + '</th><th class="n">งานเข้า</th><th class="n">เฉลี่ย/วัน</th><th class="n">ก่อสร้างเสร็จ</th><th class="n">เฉลี่ย/วัน</th><th class="n">ส่วนต่าง</th></tr>' + rows +
        '<tr class="sum"><td>รวมทั้งปี (ถึงวันนี้)</td><td class="n">' + sI + '</td><td class="n">' + f1(sI / Math.max(1, sD)) + '</td><td class="n">' + sP + '</td><td class="n">' + f1(sP / Math.max(1, sD)) + '</td><td class="n" style="color:' + (sI - sP > 0 ? '#dc2626' : '#059669') + '">' + (sI - sP > 0 ? '+' : sI - sP < 0 ? '−' : '') + Math.abs(sI - sP) + '</td></tr></table></div>' +
      '<div class="anote">วันที่ปิดงานก่อน ' + dt(CLOSE_FROM) + ' เป็นการบันทึกย้อนหลังพร้อมกัน จึงไม่นำมาคำนวณ · เฉลี่ยต่อวันคิดตามวันปฏิทิน</div></div>';
  }
  function render() {
    if (!build()) return;
    var all = g('allData', []) || [], u = g('currentUser', {}) || {}, now = new Date();
    var act = all.filter(function (j) { return j.status !== 'ปิดงานแล้วเสร็จ' && j.status !== 'ยกเลิก'; });
    var by = function (s) { return all.filter(function (j) { return j.status === s; }); };
    var recv = by('รับเรื่อง'), surv = by('สำรวจงาน'), work = by('ดำเนินงาน'), insp = by('ตรวจรับงาน'), sent = by('ส่งปิดงาน'), done = by('ปิดงานแล้วเสร็จ');
    var age = function (j) { return days(j.payDate || j.receiveDate) || 0; };
    var m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    var newM = all.filter(function (j) { var d = new Date(j.receiveDate); return !isNaN(d) && d >= m0; }).length;
    var closedAt = function (j) { var e = lastTl(j, function (h) { return h.status === 'ปิดงานแล้วเสร็จ' || /ปิดงานแล้วเสร็จ/.test(h.details || ''); }); return e ? new Date(e.timestamp) : null; };
    var y0 = new Date(now.getFullYear(), 0, 1);
    var doneY = done.filter(function (j) { var d = closedAt(j); return d && d >= y0; }).length, doneM = done.filter(function (j) { var d = closedAt(j); return d && d >= m0; }).length;
    var ist = { wait: 0, fail: 0, std: 0, ready: 0 }; insp.forEach(function (j) { ist[inspStage(j)]++; });
    var sapN = sent.filter(sapClosed).length;
    var updRecent = work.filter(function (j) { return (j.contractorUpdates || []).some(function (x) { return x && x.updateType !== 'pea_reply' && days(x.timestamp) <= 7; }); }).length;
    // ต้องติดตาม
    var pre = act.filter(function (j) { return ['รับเรื่อง', 'สำรวจงาน', 'ดำเนินงาน'].indexOf(j.status) >= 0 && age(j) > 30; });
    var preBy = function (s) { return pre.filter(function (j) { return j.status === s; }).length; };
    var waitLong = insp.filter(function (j) { return inspStage(j) === 'wait' && j.payDate && days(j.payDate) > 14; }).sort(function (a, b) { return days(b.payDate) - days(a.payDate); });
    var probs = openProblems(all);
    FOC = { pre: { page: 'track', list: pre, label: 'งานค้างเกิน 30 วัน' }, wait: { page: 'insp', list: waitLong, label: 'รอตรวจรับเกิน 14 วัน' },
      prob: { page: 'track', list: probs.map(function (p) { return p.j; }), label: 'ผู้รับจ้างแจ้งปัญหา (ยังไม่ตอบ)' } };
    // งบ (งานที่ยังไม่ส่งปิด) — สูตรเดียวกับหน้างบประมาณ
    var pct = parseFloat(($('budgetFilterPercent') || {}).value) || 80;
    var bud = 0, sp = 0, cut = 0, urg = 0, byT = { labor: [0, 0], supervision: [0, 0], misc: [0, 0] };
    all.filter(function (j) { return j.status !== 'ส่งปิดงาน' && j.status !== 'ปิดงานแล้วเสร็จ'; }).forEach(function (j) {
      var mo = money(j); bud += mo.bud; sp += mo.sp;
      mo.lines.forEach(function (l) { var t = l.bud * pct / 100, c = t - l.sp; byT[l.type][0] += l.bud; byT[l.type][1] += l.sp; if (c > 0) { cut += c; if (c / t < 0.15) urg++; } });
    });
    var used = bud > 0 ? sp / bud * 100 : 0;
    // แนวโน้ม 6 เดือน
    var months = [];
    for (var i = 5; i >= 0; i--) { var d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ y: d.getFullYear(), m: d.getMonth(), a: 0, c: 0 }); }
    var mi = function (d) { if (!d || isNaN(d)) return -1; for (var k = 0; k < months.length; k++) if (months[k].y === d.getFullYear() && months[k].m === d.getMonth()) return k; return -1; };
    // "ก่อสร้างเสร็จ" = ตรวจรับผ่านครั้งล่าสุด (วันที่ปิดงานก่อน 21 พ.ย. 69 เป็นการบันทึกย้อนหลังพร้อมกัน ใช้นับไม่ได้)
    var passAt = function (j) { var e = lastTl(j, function (h) { return h.status === 'ตรวจรับงาน' && /ผ่าน/.test(h.details || '') && !/ไม่ผ่าน/.test(h.details || ''); }); return e ? new Date(e.timestamp) : null; };
    all.forEach(function (j) { var a = mi(new Date(j.receiveDate)); if (a >= 0) months[a].a++; var c = mi(passAt(j)); if (c >= 0) months[c].c++; });
    var avgH = avgCard(all, passAt, closedAt, now);
    var mx = Math.max.apply(null, months.map(function (x) { return Math.max(x.a, x.c); }).concat([1]));
    // ผู้รับจ้าง
    var ct = {};
    act.forEach(function (j) {
      var e = String(j.responsibleEntity || '').trim() || 'ไม่ระบุ';
      var o = ct[e] = ct[e] || { n: e, doing: 0, insp: 0, over: 0, d: [], self: e === 'ไฟฟ้าดำเนินการเอง' };
      if (j.status === 'ตรวจรับงาน') o.insp++; else if (j.status !== 'ส่งปิดงาน') o.doing++;
      if (j.status !== 'ส่งปิดงาน' && j.status !== 'ตรวจรับงาน' && age(j) > 30) o.over++;
    });
    all.forEach(function (j) {
      var e = String(j.responsibleEntity || '').trim(); if (!ct[e] || !j.payDate) return;
      var pe = lastTl(j, function (h) { return h.status === 'ตรวจรับงาน' && /ผ่าน/.test(h.details || '') && !/ไม่ผ่าน/.test(h.details || ''); });
      if (pe) { var dd = Math.ceil((new Date(pe.timestamp) - new Date(j.payDate)) / 86400000); if (dd >= 0 && dd < 400) ct[e].d.push(dd); }
    });
    var cts = Object.keys(ct).map(function (k) { return ct[k]; }).sort(function (a, b) { return (b.doing + b.insp) - (a.doing + a.insp); }).slice(0, 8);
    // ผู้ควบคุมงาน
    var asg = {}; act.forEach(function (j) { var a = String(j.assignee || '').trim(); if (a) asg[a] = (asg[a] || 0) + 1; });
    var asl = Object.keys(asg).sort(function (a, b) { return asg[b] - asg[a]; }).slice(0, 8), amx = asl.length ? asg[asl[0]] : 1;
    // ความเคลื่อนไหว
    var feed = [];
    all.forEach(function (j) {
      tl(j).forEach(function (h) { if (h && h.timestamp) feed.push({ t: new Date(h.timestamp), j: j, k: 'tl', h: h }); });
      (j.contractorUpdates || []).forEach(function (x) { if (x && x.timestamp && x.updateType !== 'pea_reply') feed.push({ t: new Date(x.timestamp), j: j, k: 'ct', x: x }); });
    });
    feed = feed.filter(function (f) { return !isNaN(f.t); }).sort(function (a, b) { return b.t - a.t; }).slice(0, 8);
    var FI = function (f) {
      if (f.k === 'ct') { var ty = f.x.updateType; return ty === 'problem' ? ['⚠️', '#fef2f2', 'แจ้งปัญหา'] : ty === 'delivery' ? ['🚚', '#ecfeff', 'แจ้งส่งมอบงาน'] : ['📊', '#eff6ff', 'อัปเดตความคืบหน้า' + (f.x.progress ? ' ' + f.x.progress + '%' : '')]; }
      var s = f.h.status || '', dt = f.h.details || '';
      if (/ปิดงานแล้วเสร็จ/.test(s + dt)) return ['✅', '#ecfdf5', 'ปิดงาน'];
      if (/ส่งปิดงาน/.test(s)) return ['📤', '#f5f3ff', 'ส่งปิดงาน'];
      if (/ไม่ผ่าน/.test(dt)) return ['❌', '#fef2f2', s + ' ไม่ผ่าน'];
      if (/ผ่าน/.test(dt) && /ตรวจ/.test(s)) return ['✔️', '#ecfdf5', s + ' ผ่าน'];
      if (/ตัดงบ/.test(s + dt)) return ['✂️', '#fff7ed', 'ตัดงบ'];
      if (/รับเรื่อง/.test(s)) return ['📥', '#f5f3ff', 'รับเรื่อง'];
      return ['🔄', '#f1f5f9', s || 'อัปเดต'];
    };

    var hello = (u.name || '').replace(/^(นาย|นางสาว|นาง)\s*/, '').split(/\s+/)[0];
    var fsx = function (go, lab, n, sub, c, bg, extra) { return '<button class="fs" data-go="' + go + '" style="color:' + c + ';background:' + bg + '"><small>' + lab + '</small><b>' + n + '</b>' + (sub ? '<span>' + sub + '</span>' : '') + (extra || '') + '</button>'; };
    var ar = '<div class="ar">›</div>';
    var tdx = function (go, ic, c, bg, t, s, n, btn) { return '<div class="td' + (n ? '' : ' zero') + '" data-go="' + go + '"><div class="ic" style="background:' + bg + ';color:' + c + '">' + ic + '</div><div class="tx"><b>' + t + '</b><small>' + s + '</small></div><div class="n" style="color:' + c + '">' + n + '</div><span class="go">' + (btn || 'ดู') + ' ›</span></div>'; };
    var sapInfo = window.cclSapInfo && cclSapInfo();

    $('dbx').innerHTML =
      '<div class="card"><div class="hi"><div><h2>สวัสดีครับ' + (hello ? ' คุณ' + esc(hello) : '') + ' 👋</h2><p>' + TH_D[now.getDay()] + ' ' + now.getDate() + ' ' + TH_M[now.getMonth()] + ' ' + (now.getFullYear() + 543) + (u.branchName ? ' · ' + esc(u.branchName) : '') + ' · อัปเดต ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2) + ' น.</p></div><span class="sp"></span>' +
        '<button class="tb" id="dbRef"><i class="fa-solid fa-rotate-right"></i><span>รีเฟรช</span></button>' +
        '<button class="tb g" id="dbLine"' + (pre.length ? '' : ' disabled') + '><i class="fa-brands fa-line"></i><span>ส่งงานค้างเข้า LINE (' + pre.length + ')</span></button></div>' +
        '<div class="flow">' +
          fsx('track:รับเรื่อง', 'รับเรื่อง', recv.length, 'ใหม่เดือนนี้ ' + newM, '#7c3aed', '#f5f3ff') + ar +
          fsx('track:สำรวจงาน', 'สำรวจงาน', surv.length, 'ค้าง >30 วัน ' + preBy('สำรวจงาน'), '#ca8a04', '#fefce8') + ar +
          fsx('track:ดำเนินงาน', 'ดำเนินงาน', work.length, 'ผู้รับจ้างอัปเดต 7 วัน ' + updRecent, '#ea580c', '#fff7ed') + ar +
          fsx('insp', 'ตรวจรับงาน', insp.length, '', '#2563eb', '#eff6ff', '<div class="sub"><i>รอ ' + ist.wait + '</i><i>ไม่ผ่าน ' + ist.fail + '</i><i>มาตรฐาน ' + ist.std + '</i><i>พร้อมส่ง ' + ist.ready + '</i></div>') + ar +
          fsx('close', 'รอปิดงาน', sent.length, sapInfo ? 'SAP ปิดแล้ว ' + sapN : 'ยังไม่นำเข้า SAP', '#059669', '#ecfdf5') + ar +
          fsx('completed', 'เสร็จปีนี้', doneY, 'เดือนนี้ ' + doneM, '#334155', '#f1f5f9') +
        '</div></div>' +
      '<div class="g2"><div class="card"><h3>⚡ ต้องติดตาม <small>กดเพื่อไปที่รายการ</small></h3>' +
        tdx('f:pre', '⏰', '#dc2626', '#fef2f2', 'งานค้างเกิน 30 วัน', 'รับเรื่อง ' + preBy('รับเรื่อง') + ' · สำรวจ ' + preBy('สำรวจงาน') + ' · ดำเนินงาน ' + preBy('ดำเนินงาน'), pre.length) +
        tdx('f:wait', '📋', '#d97706', '#fffbeb', 'รอตรวจรับเกิน 14 วัน', waitLong.length ? 'นานสุด ' + days(waitLong[0].payDate) + ' วัน · ' + esc(waitLong[0].receiveNo || '') : 'นับจากวันส่งมอบ', waitLong.length) +
        tdx('insp:fail', '❌', '#dc2626', '#fef2f2', 'ตรวจรับไม่ผ่าน · รอแก้ไข', 'รอผู้รับจ้างแก้ไขแล้วตรวจซ้ำ', ist.fail) +
        tdx('insp:ready', '📤', '#7c3aed', '#f5f3ff', 'พร้อมส่งปิดงาน', 'ผ่านตรวจรับ + ตรวจมาตรฐานแล้ว', ist.ready, 'ส่งปิด') +
        tdx('close:closed', '✅', '#059669', '#ecfdf5', 'SAP ปิดแล้ว รอปิดใน CCL', sapInfo ? 'จากไฟล์ ' + esc(sapInfo.file || '') : 'นำเข้าไฟล์ SAP ที่หน้าปิดงาน', sapN, 'ปิดงาน') +
        tdx('bud', '🪙', '#ea580c', '#fff7ed', 'งบใกล้ถึงเป้า (ด่วน)', 'ตัดได้อีกไม่ถึง 15% ของเป้า ' + pct + '%', urg) +
        tdx('f:prob', '⚠️', '#dc2626', '#fef2f2', 'ผู้รับจ้างแจ้งปัญหา', 'ยังไม่ได้ตอบกลับ', probs.length) +
      '</div><div class="card"><h3>🪙 งบประมาณ <small>งานที่ยังไม่ส่งปิด</small></h3>' +
        '<div class="big"><b>' + n0(bud) + '</b><span style="color:#64748b">บาท งบรวม</span></div>' +
        '<div class="bar"><i style="width:' + Math.min(used, 100) + '%"></i><div class="mk" style="left:' + Math.min(pct, 100) + '%"></div></div>' +
        '<div class="row"><span>ใช้ไป <b>' + n0(sp) + '</b> (' + used.toFixed(1) + '%)</span><span>เป้า ' + pct + '% <b>' + n0(bud * pct / 100) + '</b></span></div>' +
        '<div class="bt3"><div data-go="budget" style="background:#ecfdf5;color:#047857"><small>ตัดได้อีกถึงเป้า</small><b>' + n0(cut) + '</b></div>' +
          ['labor', 'supervision'].map(function (t) { var v = byT[t]; return '<div data-go="budget" style="background:' + (t === 'labor' ? '#eff6ff;color:#1d4ed8' : '#faf5ff;color:#7e22ce') + '"><small>' + (t === 'labor' ? 'ค่าแรง' : 'ค่าคุมงาน') + ' ใช้ไป</small><b>' + (v[0] ? (v[1] / v[0] * 100).toFixed(0) : 0) + '%</b></div>'; }).join('') + '</div>' +
        '<h3 style="margin-top:16px">📈 งานเข้า–เสร็จ 6 เดือน</h3>' +
        '<div class="ch2" style="margin-top:22px">' + months.map(function (x) { return '<div class="m"><i style="height:' + (x.a / mx * 100) + '%;background:#a5b4fc"><em>' + (x.a || '') + '</em></i><i style="height:' + (x.c / mx * 100) + '%;background:#34d399"><em>' + (x.c || '') + '</em></i></div>'; }).join('') + '</div>' +
        '<div class="xl">' + months.map(function (x) { return '<span>' + TH_M[x.m] + '</span>'; }).join('') + '</div>' +
        '<div class="lg"><span><i style="background:#a5b4fc"></i>รับงานใหม่</span><span><i style="background:#34d399"></i>ก่อสร้างเสร็จ (ตรวจรับผ่าน)</span></div>' +
      '</div></div>' + avgH +
      '<div class="g2"><div class="card"><h3>👷 ผู้รับผิดชอบงาน <small>กดชื่อผู้รับจ้างเพื่อเปิดการ์ด</small></h3><div style="overflow-x:auto"><table><tr><th>หน่วยงาน</th><th class="n">กำลังทำ</th><th class="n">ตรวจรับ</th><th class="n">ค้าง&gt;30</th><th class="n">เฉลี่ยตรวจรับ</th></tr>' +
        cts.map(function (o) {
          var av = o.d.length ? Math.round(o.d.reduce(function (a, b) { return a + b; }, 0) / o.d.length) + ' วัน' : '-';
          return '<tr><td>' + (o.self ? '⚡ ' + esc(o.n) : '<span>' + esc(o.n) + '</span>') + '</td><td class="n">' + o.doing + '</td><td class="n">' + o.insp + '</td><td class="n" style="color:' + (o.over ? '#dc2626' : '#94a3b8') + '">' + o.over + '</td><td class="n">' + av + '</td></tr>';
        }).join('') + '</table></div>' +
        '<h3 style="margin-top:16px">👤 ภาระงานผู้ควบคุมงาน <small>งานที่ยังไม่ปิด</small></h3><div class="ag">' +
        asl.map(function (a) { return '<div><span title="' + esc(a) + '">' + esc(a.replace(/^(นาย|นางสาว|นาง)\s*/, '')) + '</span><i style="width:' + (asg[a] / amx * 60) + '%"></i><b>' + asg[a] + '</b></div>'; }).join('') + '</div>' +
      '</div><div class="card"><h3>🕒 ความเคลื่อนไหวล่าสุด</h3>' +
        (feed.length ? feed.map(function (f) {
          var ic = FI(f), who = f.k === 'ct' ? (f.j.responsibleEntity || 'ผู้รับจ้าง') : (f.h.by || f.h.user || f.h.updatedBy || '');
          return '<div class="fd" data-go="job:' + f.j.id + '"><div class="dot" style="background:' + ic[1] + '">' + ic[0] + '</div><div><b>' + esc(ic[2]) + '</b> · ' + esc(f.j.receiveNo || '') + ' ' + esc(String(f.j.jobName || '').slice(0, 50)) +
            '<small>' + (who ? esc(who) + ' · ' : '') + esc(ago(f.t)) + '</small></div></div>';
        }).join('') : '<div style="color:#94a3b8;font-size:13px">ยังไม่มีความเคลื่อนไหว</div>') +
      '</div></div>';

    Array.prototype.forEach.call(document.querySelectorAll('#dbAvg [data-avg]'), function (b) { b.onclick = function () { AVG = b.dataset.avg; render(); }; });
    $('dbRef').onclick = function () { try { loadData(); } catch (e) { render(); } };
    $('dbLine').onclick = function () {
      try { window.currentDetailIds = pre.map(function (j) { return j.id; }); currentDetailIds = window.currentDetailIds; } catch (e) {}
      try { sendDetailToLine(); } catch (e) { console.error(e); }
    };
  }

  // เปิด Dashboard ไม่ต้องรอหลังบ้าน — ใช้ข้อมูลที่โหลดไว้แล้วในหน้า (ข้อมูลอัปเดตเองเมื่อระบบโหลดข้อมูลใหม่)
  var origLoad = window.loadDashboard;
  window.loadDashboard = function () {
    var d = g('allData', null);
    if (Array.isArray(d) && d.length) { try { render(); } catch (e) { console.error('[dash-ui]', e); } return; }
    if (origLoad) return origLoad.apply(this, arguments);
  };
  var orig = window.renderDashboard;
  window.renderDashboard = function () {
    try { if (orig) orig.apply(this, arguments); } catch (e) {}
    try { render(); } catch (e) { console.error('[dash-ui]', e); }
  };
  // ข้อมูลโหลดใหม่ (loadData → renderTable) → วาด Dashboard ใหม่ด้วย
  var rt = window.renderTable;
  if (typeof rt === 'function') window.renderTable = function () { var r = rt.apply(this, arguments); try { render(); } catch (e) {} return r; };
  function boot() { var d = g('allData', null); if (Array.isArray(d) && d.length) window.renderDashboard(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
