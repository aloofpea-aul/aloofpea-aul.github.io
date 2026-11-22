/* sapr-ui.js — เมนู "📊 รายงาน SAP": สรุปสถานะงานทุกงบ ทุกโครงการ จากไฟล์ SAP ล่าสุดที่นำเข้า
   ข้อมูล: cclSapReport (ไฟล์ ccl-sap-report.json ในโฟลเดอร์ CCL-SAP — สร้างใหม่ทุกครั้งที่นำเข้าไฟล์ SAP อัตโนมัติ) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  var KEY = 'ccl_sapr_v1', R = null, F = { yr: '', sel: null }, built = false;
  var SYS = { CRTD: ['CRTD', '#94a3b8', 'สร้าง/รออนุมัติ'], REL: ['REL', '#2563eb', 'ดำเนินการ'], TECO: ['TECO', '#7c3aed', 'แล้วเสร็จทางเทคนิค'], CLSD: ['CLSD', '#16a34a', 'ปิดงาน'] };
  var BUD = { C: ['งบผู้ใช้ไฟ', '#0ea5e9'], I: ['งบลงทุน', '#f59e0b'], P: ['งบโครงการ', '#8b5cf6'] };
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function dth(v) { var d = new Date(v); return isNaN(d) ? '' : d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function sysOf(s) { return s === 'PREL' ? 'REL' : SYS[s] ? s : 'CRTD'; }
  function yearOf(p) { var m = /^[A-Z]-(\d\d)/.exec(p); return m ? m[1] : ''; }
  function pjName(p) {
    var hs = (R && R.heads && R.heads[p]) || [], y = yearOf(p);
    if (/^C-/.test(p)) return 'งบผู้ใช้ไฟ ปี ' + y;
    if (/^P-NHE0?3\.(\d)/.test(p)) return 'คฟม. ระยะ 3.' + /^P-NHE0?3\.(\d)/.exec(p)[1];
    var h = hs.map(function (x) { return x.replace(/\s*-?\s*กฟส\.?\s*(อ\.)?\s*(อ่าวลึก|อล\.?)\S*/g, '').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    return (h.length ? h.slice(0, 2).join(' / ') : 'งบลงทุน') + (y && !/\d\d/.test(h.join('')) ? ' ปี ' + y : '');
  }
  function grpOf(u) { return !u ? '?' : /^[AB]/.test(u) ? u[0] : /^C[3-6]$/.test(u) ? 'STOP' : u[0] === 'C' ? 'C' : u === 'E2' ? 'X' : /^(D2|D3|D9|E1|F1|F9)$/.test(u) ? 'T' : u === 'D1' || u === 'F3' ? 'D1' : 'F'; }

  var css = '#sapx{padding:14px 16px}#sapx .hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap}#sapx .hd h2{margin:0;font-size:18px;font-weight:700;color:#1e293b}' +
    '#sapx .src{font-size:12.5px;color:#64748b}#sapx .sp{flex:1}#sapx .bt{border:1.5px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 12px;font-weight:600;font-size:13px;color:#334155;cursor:pointer;font-family:inherit}' +
    '#sapx .bt.g{background:#059669;border-color:#059669;color:#fff}' +
    '#sapx .kp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}' +
    '#sapx .k{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:11px 13px;cursor:pointer;text-align:left;font-family:inherit}#sapx .k:hover{border-color:#93c5fd}' +
    '#sapx .k small{color:#64748b;font-size:12px;display:block}#sapx .k b{display:block;font-size:24px;line-height:1.3}#sapx .k span{font-size:12px;color:#64748b}' +
    '#sapx .bts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}' +
    '#sapx .bc{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;cursor:pointer;text-align:left;font-family:inherit}#sapx .bc:hover{border-color:#93c5fd}' +
    '#sapx .bc h3{margin:0;font-size:15px;display:flex;gap:7px;align-items:center;font-weight:700}#sapx .bc h3 em{font-style:normal;font-size:11px;border-radius:6px;padding:1px 7px;color:#fff}' +
    '#sapx .bc .n{font-size:13px;color:#64748b;margin:4px 0 8px}#sapx .bc .n b{font-size:20px;color:#1e293b}' +
    '#sapx .sb{display:flex;height:12px;border-radius:7px;overflow:hidden;background:#e2e8f0}#sapx .sb i{display:block;height:100%}' +
    '#sapx .lg{display:flex;flex-wrap:wrap;gap:8px;font-size:11.5px;color:#475569;margin-top:6px}#sapx .lg span:before{content:"";display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:4px;background:var(--c);vertical-align:-1px}' +
    '#sapx .al{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}' +
    '#sapx .a{background:#fff;border:1px solid #e2e8f0;border-left:5px solid var(--c);border-radius:14px;padding:10px 12px;font-size:12.5px;cursor:pointer;text-align:left;font-family:inherit}#sapx .a:hover{box-shadow:0 2px 10px rgba(0,0,0,.06)}' +
    '#sapx .a b{display:block;font-size:22px;color:var(--c)}#sapx .a span{display:block;font-weight:700;font-size:13px;margin-bottom:2px;color:#1e293b}#sapx .a small{color:#64748b}' +
    '#sapx .gr{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:12px;margin-top:12px;align-items:start}' +
    '#sapx .cd{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}#sapx .cd+.cd{margin-top:12px}' +
    '#sapx .cd h4{margin:0 0 8px;font-size:14.5px;display:flex;gap:6px;align-items:center;font-weight:700}#sapx .cd h4 small{margin-left:auto;font-weight:500;color:#94a3b8;font-size:12px}' +
    '#sapx table{width:100%;border-collapse:collapse;font-size:12.5px}#sapx th{text-align:right;color:#64748b;font-weight:600;padding:5px 6px;border-bottom:1px solid #e2e8f0;white-space:nowrap}#sapx th:first-child,#sapx td:first-child{text-align:left}' +
    '#sapx td{padding:6px;border-bottom:1px solid #f1f5f9;text-align:right}#sapx tr.ck{cursor:pointer}#sapx tr.ck:hover td{background:#f8fafc}#sapx tr.on td{background:#eff6ff}' +
    '#sapx .pj{font-weight:700}#sapx .pj small{display:block;color:#94a3b8;font-weight:500;font-size:11px}' +
    '#sapx .mini{display:flex;height:8px;border-radius:5px;overflow:hidden;background:#e2e8f0;min-width:80px}#sapx .mini i{display:block}' +
    '#sapx .wr{color:#b91c1c;font-weight:700}' +
    '#sapx .fr{display:grid;grid-template-columns:58px 1fr 128px;gap:8px;align-items:center;font-size:12.5px;padding:2px 0;cursor:pointer}#sapx .fr:hover{background:#f8fafc;border-radius:6px}' +
    '#sapx .fr b{color:#fff;border-radius:6px;text-align:center;font-size:12px;padding:1px 0}#sapx .fr .bw{background:#f1f5f9;border-radius:5px}' +
    '#sapx .fr .bar{height:17px;border-radius:5px;display:flex;align-items:center;padding-left:7px;color:#fff;font-size:11px;font-weight:700;min-width:22px}' +
    '#sapx .ppl td:nth-child(n+2){text-align:center}' +
    '#sapx .ls{margin-top:12px}#sapx .ls .chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}' +
    '#sapx .ls .ch{border:1.5px solid #e2e8f0;border-radius:999px;padding:3px 11px;font-size:12.5px;font-weight:600;background:#fff;cursor:pointer;font-family:inherit;color:#475569}#sapx .ls .ch.on{background:#1e293b;border-color:#1e293b;color:#fff}' +
    '#sapx .ls td{vertical-align:top}#sapx .ls .w{font-family:"IBM Plex Mono",monospace;color:#1d4ed8;font-size:12px;white-space:nowrap}' +
    '#sapx .ls .in{border-radius:7px;padding:1px 7px;font-size:11.5px;font-weight:700;white-space:nowrap}' +
    '#sapx .note{font-size:12px;color:#64748b;margin-top:10px}#sapx .emp{text-align:center;padding:40px 10px;color:#94a3b8}' +
    '@media(max-width:860px){#sapx .gr{grid-template-columns:1fr}}' +
    '@media(max-width:700px){#sapx{padding:10px 8px}#sapx .kp,#sapx .al{grid-template-columns:1fr 1fr}#sapx .bts{grid-template-columns:1fr}#sapx .fr{grid-template-columns:54px 1fr 96px}' +
    '#sapx .hm{display:none}#sapx .pj{white-space:nowrap}#sapx .pj small{white-space:normal}#sapx td{padding:5px 4px}}';

  function build() {
    if (built) return true;
    var ap = $('page-approval'); if (!ap) return false;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var pg = document.createElement('div'); pg.id = 'page-sapreport'; pg.className = 'page-section hidden fade-in';
    pg.innerHTML = '<div class="bg-white rounded-xl shadow-sm" style="background:#f8fafc"><div id="sapx"><div class="emp">กำลังโหลดรายงาน…</div></div></div>';
    ap.parentNode.insertBefore(pg, ap);
    var nav = $('nav-approval');
    if (nav && !$('nav-sapreport')) {
      var b = document.createElement('button'); b.id = 'nav-sapreport'; b.className = 'ccl-nav-btn'; b.setAttribute('onclick', "showPage('sapreport')");
      b.innerHTML = '<i class="fa-solid fa-chart-pie"></i>รายงาน SAP';
      nav.parentNode.insertBefore(b, nav);
    }
    var os = window.showPage;
    if (typeof os === 'function' && !os.__sapr) {
      var w = function (id) { var r = os.apply(this, arguments); if (id === 'sapreport') load(); return r; };
      w.__sapr = 1; window.showPage = w;
    }
    $('sapx').addEventListener('click', onClick);
    built = true; return true;
  }

  function load(force) {
    if (!R) { try { var c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (c && c.jobs) R = c; } catch (e) {} }
    if (R) render();
    if (R && !force && R.__t && Date.now() - R.__t < 10 * 60000) return;
    google.script.run.withSuccessHandler(function (d) {
      if (d && d.jobs) { d.__t = Date.now(); R = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
      else if (!R) R = { none: true };
      render();
    }).withFailureHandler(function (e) { if (!R) $('sapx').innerHTML = '<div class="emp">โหลดรายงานไม่ได้: ' + esc((e && e.message) || e) + '</div>'; }).cclSapReport();
  }

  // ───── คำนวณ ─────
  var JOBS = [];
  function prep() {
    var ccl = [];
    (g('allData', []) || []).forEach(function (j) { String(j.jobIds || '').split(',').forEach(function (x) { var k = key(x); if (k.length > 6) ccl.push({ k: k, j: j }); }); });
    JOBS = (R.jobs || []).map(function (a) {
      var o = { p: a[0], w: a[1], n: a[2], s: sysOf(a[3]), u: a[4], who: a[5] || '', b: a[0][0], y: yearOf(a[0]) }, kw = key(o.w);
      var hit = null; for (var i = 0; i < ccl.length; i++) { if (ccl[i].k === kw || ccl[i].k.indexOf(kw) === 0) { hit = ccl[i].j; break; } }
      o.ccl = hit; o.g = grpOf(o.u); o.open = o.s !== 'CLSD'; return o;
    });
  }
  function maxYear() { var m = ''; JOBS.forEach(function (j) { if (j.b === 'C' && j.y > m) m = j.y; }); return m; }
  function cnt(a, f) { var n = 0; a.forEach(function (x) { if (f(x)) n++; }); return n; }
  function sysBar(a, cls) {
    var t = a.length || 1;
    return '<div class="' + cls + '">' + ['CRTD', 'REL', 'TECO', 'CLSD'].map(function (s) { var n = cnt(a, function (x) { return x.s === s; }); return n ? '<i style="width:' + (n / t * 100).toFixed(1) + '%;background:' + SYS[s][1] + '" title="' + s + ' ' + n + '"></i>' : ''; }).join('') + '</div>';
  }
  var FILT = {
    all: ['งานทั้งหมด', function () { return true; }],
    open: ['ยังเปิดอยู่', function (j) { return j.open; }],
    clsd: ['ปิดแล้ว (CLSD)', function (j) { return !j.open; }],
    noccl: ['เปิดอยู่แต่ยังไม่มีใน CCL', function (j) { return j.open && !j.ccl && j.g !== 'X'; }],
    old: ['งานปีเก่ายังค้าง', function (j) { return j.open && j.b === 'C' && j.y < maxYear(); }],
    stop: ['หยุดงาน (C3–C6)', function (j) { return j.open && j.g === 'STOP'; }],
    teco: ['TECO รอปิดบัญชี', function (j) { return j.s === 'TECO'; }]
  };
  function view() { return F.yr ? JOBS.filter(function (j) { return j.y === F.yr; }) : JOBS; }

  function render() {
    if (!build()) return;
    var X = $('sapx');
    if (!R || R.none) {
      X.innerHTML = '<div class="hd"><h2>📊 รายงานสถานะงานจาก SAP</h2></div><div class="emp">ยังไม่มีรายงาน — วางไฟล์ SAP (แบบ WBS) ในโฟลเดอร์ CCL-SAP แล้วกด ⚙️ อัตโนมัติ → ▶ ตรวจเดี๋ยวนี้ ที่หน้าปิดงาน' +
        (isAdm() ? '<br><br><button class="bt g" data-a="rebuild">สร้างรายงานจากไฟล์ล่าสุด</button>' : '') + '</div>';
      return;
    }
    prep();
    var A = view(), op = A.filter(function (j) { return j.open; }), yrs = {};
    JOBS.forEach(function (j) { if (j.y) yrs[j.y] = 1; });
    var nProj = Object.keys(A.reduce(function (o, j) { o[j.p] = 1; return o; }, {})).length;
    var h = '<div class="hd"><h2>📊 รายงานสถานะงานจาก SAP · กฟส.อ่าวลึก</h2><span class="src">ไฟล์: ' + esc(R.file || '-') + ' · สร้างรายงาน ' + esc(dth(R.at)) + '</span><span class="sp"></span>' +
      '<select class="bt" id="saprYr"><option value="">ทุกปีงบ</option>' + Object.keys(yrs).sort().reverse().map(function (y) { return '<option value="' + y + '"' + (F.yr === y ? ' selected' : '') + '>ปี ' + y + '</option>'; }).join('') + '</select>' +
      '<button class="bt" data-a="csv">⬇ Excel</button>' + (isAdm() ? '<button class="bt" data-a="rebuild" title="อ่านไฟล์ SAP ล่าสุดในโฟลเดอร์อีกครั้ง">↻ สร้างใหม่</button>' : '') + '</div>';
    var tot = A.length, cl = tot - op.length, noc = cnt(A, FILT.noccl[1]);
    h += '<div class="kp">' +
      '<button class="k" data-f="all"><small>งานทั้งหมดใน SAP</small><b>' + tot + '</b><span>' + Object.keys(BUD).filter(function (b) { return cnt(A, function (j) { return j.b === b; }); }).length + ' งบ · ' + nProj + ' โครงการ</span></button>' +
      '<button class="k" data-f="open"><small>ยังเปิดอยู่</small><b style="color:#2563eb">' + op.length + '</b><span>CRTD ' + cnt(op, function (j) { return j.s === 'CRTD'; }) + ' · REL ' + cnt(op, function (j) { return j.s === 'REL'; }) + ' · TECO ' + cnt(op, function (j) { return j.s === 'TECO'; }) + '</span></button>' +
      '<button class="k" data-f="clsd"><small>ปิดแล้ว (CLSD)</small><b style="color:#16a34a">' + cl + '</b><span>' + (tot ? Math.round(cl / tot * 100) : 0) + '% ของทั้งหมด</span></button>' +
      '<button class="k" data-f="noccl"><small>เปิดอยู่แต่ยังไม่มีใน CCL</small><b style="color:#dc2626">' + noc + '</b><span>ควรบันทึกเข้า CCL</span></button></div>';
    h += '<div class="bts">' + Object.keys(BUD).map(function (b) {
      var a = A.filter(function (j) { return j.b === b; }); if (!a.length) return '';
      return '<button class="bc" data-b="' + b + '"><h3><em style="background:' + BUD[b][1] + '">' + b + '</em>' + BUD[b][0] + (b === 'P' ? ' (คฟม.)' : '') + '</h3><div class="n"><b>' + a.length + '</b> งาน · เปิดอยู่ ' + cnt(a, function (j) { return j.open; }) + '</div>' + sysBar(a, 'sb') +
        '<div class="lg">' + ['CRTD', 'REL', 'TECO', 'CLSD'].map(function (s) { return '<span style="--c:' + SYS[s][1] + '">' + s + ' ' + cnt(a, function (j) { return j.s === s; }) + '</span>'; }).join('') + '</div></button>';
    }).join('') + '</div>';
    var oldN = cnt(A, FILT.old[1]), oldA = cnt(A, function (j) { return FILT.old[1](j) && /^A/.test(j.u); });
    h += '<div class="al">' +
      '<button class="a" data-f="old" style="--c:#dc2626"><span>⏳ งานปีเก่ายังค้าง</span><b>' + oldN + '</b><small>งบผู้ใช้ไฟก่อนปี ' + esc(maxYear()) + ' ยังเปิดอยู่' + (oldA ? ' · ' + oldA + ' งานยังอยู่ขั้น A' : '') + '</small></button>' +
      '<button class="a" data-f="stop" style="--c:#ea580c"><span>⏸ หยุดงาน</span><b>' + cnt(A, FILT.stop[1]) + '</b><small>C3 รอพัสดุ · C4–C6 หยุดชั่วคราว</small></button>' +
      '<button class="a" data-f="teco" style="--c:#7c3aed"><span>📁 TECO รอปิดบัญชี</span><b>' + cnt(A, FILT.teco[1]) + '</b><small>D2–F1 · ส่งแฟ้มให้บัญชี</small></button>' +
      '<button class="a" data-f="noccl" style="--c:#0f766e"><span>🆕 อยู่ใน SAP ยังไม่มีใน CCL</span><b>' + noc + '</b><small>กดดูรายการ → บันทึกเข้า CCL</small></button></div>';
    // โครงการ
    var pj = {}; A.forEach(function (j) { (pj[j.p] = pj[j.p] || []).push(j); });
    var pjs = Object.keys(pj).sort(function (a, b) { return (b.slice(2, 4) + a[0]).localeCompare(a.slice(2, 4) + b[0]) || a.localeCompare(b); });
    pjs.sort(function (a, b) { var o = { C: 0, I: 1, P: 2 }; return (o[a[0]] - o[b[0]]) || (yearOf(b) || '').localeCompare(yearOf(a) || '') || a.localeCompare(b); });
    var mY = maxYear();
    h += '<div class="gr"><div class="cd"><h4>📂 แยกตามโครงการ <small>กดแถวเพื่อดูรายการงาน</small></h4><table><tr><th>โครงการ</th><th>ทั้งหมด</th><th>เปิดอยู่</th><th>ปิดแล้ว</th><th class="hm" style="text-align:left">สัดส่วน</th></tr>' +
      pjs.map(function (p) {
        var a = pj[p], o = cnt(a, function (j) { return j.open; }), old = p[0] === 'C' && yearOf(p) < mY && o;
        return '<tr class="ck' + (F.sel && F.sel.t === 'p' && F.sel.v === p ? ' on' : '') + '" data-p="' + esc(p) + '"><td class="pj">' + esc(p) + '<small>' + esc(pjName(p)) + '</small></td><td>' + a.length + '</td><td class="' + (old ? 'wr' : '') + '"><b>' + o + '</b></td><td>' + (a.length - o) + '</td><td class="hm">' + sysBar(a, 'mini') + '</td></tr>';
      }).join('') + '</table></div><div>';
    // ขั้นงาน (เปิดอยู่)
    var FN = [['A', 'A0–A5', '#94a3b8', 'สร้าง/สำรวจ/อนุมัติ'], ['B', 'B1–B2', '#64748b', 'รับงบแล้ว'], ['C', 'C1–C2', '#2563eb', 'ก่อสร้าง/จัดซื้อ'], ['STOP', 'C3–C6', '#ea580c', 'หยุดงาน'], ['D1', 'D1·F3', '#0891b2', 'แล้วเสร็จ ตรวจพัสดุ'], ['T', 'D2–F1', '#7c3aed', 'TECO รอปิดบัญชี'], ['F', 'F2·F4', '#16a34a', 'ปิดบัญชี'], ['X', 'E2', '#dc2626', 'ยกเลิกหมายเลขงาน']];
    var mx = 1; FN.forEach(function (f) { mx = Math.max(mx, cnt(op, function (j) { return j.g === f[0]; })); });
    h += '<div class="cd"><h4>🚦 งานที่เปิดอยู่ อยู่ขั้นไหน <small>' + op.length + ' งาน</small></h4>' + FN.map(function (f) {
      var n = cnt(op, function (j) { return j.g === f[0]; }); if (!n) return '';
      return '<div class="fr" data-gx="' + f[0] + '"><b style="background:' + f[2] + '">' + f[1] + '</b><div class="bw"><div class="bar" style="width:' + Math.max(8, n / mx * 100).toFixed(0) + '%;background:' + f[2] + '">' + n + '</div></div><span>' + f[3] + '</span></div>';
    }).join('') + '</div>';
    // ผู้ควบคุมงาน
    var pp = {}; op.forEach(function (j) { var k = j.who || '(ยังไม่ระบุใน SAP)'; (pp[k] = pp[k] || []).push(j); });
    h += '<div class="cd"><h4>👷 งานเปิดอยู่ ตามผู้ควบคุมงาน (SAP)</h4><table class="ppl"><tr><th>ผู้ควบคุมงาน</th><th>A/B</th><th>C</th><th>D–F</th><th>รวม</th></tr>' +
      Object.keys(pp).sort(function (a, b) { return pp[b].length - pp[a].length; }).map(function (k) {
        var a = pp[k];
        return '<tr class="ck' + (F.sel && F.sel.t === 'w' && F.sel.v === k ? ' on' : '') + '" data-w="' + esc(k) + '"><td' + (/ยังไม่ระบุ/.test(k) ? ' style="color:#dc2626"' : '') + '>' + esc(k) + '</td><td>' + cnt(a, function (j) { return /^[AB]$/.test(j.g); }) + '</td><td>' + cnt(a, function (j) { return j.g === 'C' || j.g === 'STOP'; }) + '</td><td>' + cnt(a, function (j) { return /^(D1|T|F)$/.test(j.g); }) + '</td><td><b>' + a.length + '</b></td></tr>';
      }).join('') + '</table></div></div></div>';
    h += '<div class="cd ls" id="saprList"></div>';
    h += '<div class="note">นับ "งาน" = WBS ระดับงาน (ไม่นับหัวโครงการ Z0) · PREL นับเป็น REL · รายงานสร้างใหม่ทุกครั้งที่ระบบนำเข้าไฟล์ SAP (แบบ WBS) จากโฟลเดอร์ CCL-SAP · เทียบกับ CCL ตามหมายเลขงาน</div>';
    X.innerHTML = h;
    var ys = $('saprYr'); if (ys) ys.onchange = function () { F.yr = this.value; render(); };
    list();
  }

  function selJobs() {
    var A = view(), s = F.sel || { t: 'f', v: 'open' };
    if (s.t === 'f') return [FILT[s.v][0], A.filter(FILT[s.v][1])];
    if (s.t === 'b') return [BUD[s.v][0], A.filter(function (j) { return j.b === s.v; })];
    if (s.t === 'p') return [s.v + ' · ' + pjName(s.v), A.filter(function (j) { return j.p === s.v; })];
    if (s.t === 'g') return ['งานเปิดอยู่ ขั้น ' + s.l, A.filter(function (j) { return j.open && j.g === s.v; })];
    if (s.t === 'w') return ['งานเปิดอยู่ของ ' + s.v, A.filter(function (j) { return j.open && (j.who || '(ยังไม่ระบุใน SAP)') === s.v; })];
    return ['', A];
  }
  var LF = 'open', LIM = 40;
  function list() {
    var L = $('saprList'); if (!L) return;
    if (!F.sel) { L.innerHTML = '<h4>📋 รายการงาน</h4><div class="emp" style="padding:18px">กดการ์ด ตัวเลข แถวโครงการ ขั้นงาน หรือชื่อผู้ควบคุมงาน ด้านบน เพื่อดูรายการงาน</div>'; return; }
    var r = selJobs(), a = r[1];
    var sub = { all: a, open: a.filter(function (j) { return j.open; }), noccl: a.filter(FILT.noccl[1]), clsd: a.filter(function (j) { return !j.open; }) };
    if (!sub[LF].length && LF !== 'all') LF = sub.open.length ? 'open' : 'all';
    var rows = sub[LF].slice().sort(function (x, y) { return (x.p.localeCompare(y.p)) || x.w.localeCompare(y.w); });
    L.innerHTML = '<h4>📋 ' + esc(r[0]) + ' <small>' + rows.length + ' งาน</small></h4><div class="chips">' +
      [['open', 'เปิดอยู่'], ['noccl', 'ยังไม่มีใน CCL'], ['clsd', 'ปิดแล้ว'], ['all', 'ทั้งหมด']].map(function (c) { return '<button class="ch' + (LF === c[0] ? ' on' : '') + '" data-lf="' + c[0] + '">' + c[1] + ' ' + sub[c[0]].length + '</button>'; }).join('') + '</div>' +
      (rows.length ? '<div style="overflow-x:auto"><table><tr><th>หมายเลขงาน</th><th style="text-align:left">ชื่องาน</th><th style="text-align:left">สถานะงาน</th><th class="hm" style="text-align:left">ผู้ควบคุม (SAP)</th><th style="text-align:center">CCL</th></tr>' +
        rows.slice(0, LIM).map(function (j) {
          return '<tr><td class="w">' + esc(j.w) + '</td><td style="text-align:left">' + esc(j.n) + '</td><td style="text-align:left">' + (window.cclCode ? cclCode.pill(j.u) : esc(j.u)) + '</td><td class="hm" style="text-align:left;color:#64748b">' + esc(j.who || '-') + '</td>' +
            '<td style="text-align:center">' + (j.ccl ? '<button class="in" data-job="' + j.ccl.id + '" style="border:0;cursor:pointer;background:#eff6ff;color:#1d4ed8">' + esc(j.ccl.receiveNo || 'เปิด') + '</button>' : '<span class="in" style="background:#fef2f2;color:#b91c1c">ไม่มี</span>') + '</td></tr>';
        }).join('') + '</table></div>' + (rows.length > LIM ? '<div style="text-align:center;margin-top:8px"><button class="bt" data-a="more">แสดงเพิ่ม (เหลืออีก ' + (rows.length - LIM) + ')</button></div>' : '') : '<div class="emp">ไม่มีงานในกลุ่มนี้</div>');
  }

  function onClick(e) {
    var t = e.target.closest('[data-f],[data-b],[data-p],[data-gx],[data-w],[data-lf],[data-job],[data-a]'); if (!t) return;
    var d = t.dataset;
    if (d.job) { if (typeof openDetailModal === 'function') openDetailModal(Number(d.job)); return; }
    if (d.lf) { LF = d.lf; LIM = 40; list(); return; }
    if (d.a === 'more') { LIM += 100; list(); return; }
    if (d.a === 'csv') return csv();
    if (d.a === 'rebuild') return rebuild();
    if (d.f) F.sel = { t: 'f', v: d.f }; else if (d.b) F.sel = { t: 'b', v: d.b }; else if (d.p) F.sel = { t: 'p', v: d.p };
    else if (d.gx) F.sel = { t: 'g', v: d.gx, l: (t.querySelector('b') || {}).textContent || '' }; else if (d.w) F.sel = { t: 'w', v: d.w };
    LF = d.f === 'noccl' ? 'noccl' : d.f === 'clsd' ? 'clsd' : d.f === 'all' ? 'all' : 'open';
    LIM = 40; render();
    var L = $('saprList'); if (L) L.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function isAdm() { var u = g('currentUser', {}) || {}; return u.role === 'Admin' || !!u.superAdmin; }
  function rebuild() {
    if (window.Swal) Swal.fire({ title: 'กำลังสร้างรายงานจากไฟล์ SAP ล่าสุด…', allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });
    google.script.run.withSuccessHandler(function (r) {
      if (window.Swal) Swal.fire({ icon: 'success', title: 'สร้างรายงานแล้ว', text: (r.file || '') + ' · ' + (r.jobs || 0) + ' งาน', timer: 1600, showConfirmButton: false });
      R = null; try { localStorage.removeItem(KEY); } catch (e) {} load(true);
    }).withFailureHandler(function (e) { if (window.Swal) Swal.fire({ icon: 'error', title: 'สร้างรายงานไม่ได้', text: (e && e.message) || String(e) }); }).cclSapReportRebuild();
  }
  function csv() {
    var r = selJobs(), a = r[1];
    var head = ['โครงการ', 'ชื่อโครงการ', 'งบ', 'หมายเลขงาน', 'ชื่องาน', 'สถานะระบบ', 'สถานะงาน', 'ความหมาย', 'ผู้ควบคุม (SAP)', 'เลขที่ CCL'];
    var out = head.join(',') + '\n' + a.map(function (j) {
      return [j.p, pjName(j.p), BUD[j.b] ? BUD[j.b][0] : j.b, j.w, j.n, j.s, j.u, window.cclCode ? cclCode.info(j.u).t : '', j.who, j.ccl ? j.ccl.receiveNo : '']
        .map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var el = document.createElement('a');
    el.href = URL.createObjectURL(new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), out], { type: 'text/csv;charset=utf-8' }));
    el.download = 'รายงาน_SAP_' + (r[0] || 'ทั้งหมด').replace(/[\\/:*?"<>|\s]+/g, '_') + '.csv'; el.click();
  }

  function boot() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1500);
})();
