/* CCL — โหมด "กระชับ": หัวหน้าเหลือแถวเดียว · การ์ดงานเหลือ 2 บรรทัด · ปุ่มเป็นไอคอน
   เปิด/ปิดได้ที่ปุ่มมุมขวาล่าง (จำไว้ในเครื่อง) · ?compact=1 / ?compact=0 ในลิงก์ก็ได้
   ไม่แตะข้อมูล — แค่จัดวางการ์ดที่หน้าอื่นวาดไว้ใหม่ */
(function () {
  'use strict';
  var KEY = 'ccl_compact_v2'; // ค่าเริ่มต้น = เปิด (กดปิดได้ที่ปุ่มมุมขวาล่าง)
  function get() { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } }
  function set(v) { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} }
  var q = /[?&]compact=([01])/.exec(location.search); if (q) set(q[1] === '1');

  var css =
    /* ── หัวหน้า: แถวเดียว ── */
    'body.cx .pcx,body.cx #clx,body.cx #bgx,body.cx #apx{padding:10px 12px 2px !important;display:flex;flex-wrap:wrap;align-items:center;gap:8px}' +
    'body.cx .pcx>.ttl,body.cx #clx>.ttl,body.cx #bgx>.ttl,body.cx #apx>.ttl{order:1;flex:0 0 auto;font-size:16.5px !important;gap:8px}' +
    'body.cx .pcx>.ttl .ic,body.cx #clx>.ttl .ic,body.cx #bgx>.ttl .ic,body.cx #apx>.ttl .ic{width:30px !important;height:30px !important;font-size:14px !important;border-radius:9px !important}' +
    'body.cx .pcx>.ttl .sp,body.cx #clx>.ttl .sp,body.cx #apx>.ttl .sp{display:none}' +
    'body.cx .pcx .tb,body.cx #clx .tb,body.cx #apx .tb{height:36px !important;padding:0 11px !important;font-size:13px !important}' +
    'body.cx .pcx>.f1,body.cx #clx>.f1,body.cx #bgx>.f1,body.cx #apx>.f1{order:2;flex:1 1 380px;margin:0 !important;gap:6px !important}' +
    'body.cx .pcx>.st,body.cx #apx>.kpi,body.cx #bgx>.kpi{order:3;flex-basis:100%;margin:0 !important}' +
    'body.cx #bgx>.f2{order:4;flex-basis:100%;margin:0 !important}' +
    'body.cx .pcx>.pc-focus,body.cx #bgFocus{order:5;flex-basis:100%;margin:0 !important}' +
    'body.cx #clImp{order:3;flex-basis:100%;margin:0 !important;padding:6px 10px !important}body.cx #clImp .ic{width:32px !important;height:32px !important;font-size:15px !important}' +
    'body.cx #clImp .tx{font-size:12.5px !important}body.cx #clImp .tx b{font-size:14px !important;display:inline !important;margin-right:6px}' +
    'body.cx #clCmp{order:4;flex-basis:100%;margin:0 !important;gap:8px !important}body.cx #clCmp .bx{padding:8px 10px !important}body.cx #clCmp .rw{padding:5px 8px !important;margin-top:4px !important}' +
    'body.cx #clCmp .rw .i{width:28px !important;height:28px !important}body.cx #clCmp .rw .n{font-size:18px !important}body.cx #clCmp p{display:none}' +
    'body.cx .srch input,body.cx #budgetJobSearch{height:40px !important;font-size:14.5px !important}' +
    'body.cx .pcx .ch,body.cx #clx .ch,body.cx #bgx .ch,body.cx #apx .ch{height:36px !important;font-size:13px !important;padding:0 11px !important}' +
    /* กล่องนับ → ปุ่มเม็ดยา */
    'body.cx .pcx .st{display:flex;gap:6px;overflow-x:auto}body.cx .pcx .s{flex:0 0 auto !important;min-width:0 !important;display:flex !important;align-items:center;gap:6px;height:34px;padding:0 12px !important;border-radius:999px !important}' +
    'body.cx .pcx .s small{font-size:13px !important}body.cx .pcx .s b{font-size:15px !important;line-height:1 !important}' +
    'body.cx #bgx .kpi,body.cx #apx .kpi{gap:6px !important}body.cx #bgx .k,body.cx #apx .k{padding:5px 10px !important;border-radius:10px !important;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}' +
    'body.cx #bgx .k small,body.cx #apx .k small{font-size:12px !important}body.cx #bgx .k b,body.cx #apx .k b{font-size:17px !important}body.cx #bgx .k span{font-size:11.5px !important}' +
    /* ── รายการ ── */
    'body.cx .pc-list,body.cx #clList,body.cx #bgList{gap:6px !important;padding:6px 12px 14px !important}' +
    'body.cx #apList{padding:2px 12px 14px !important}body.cx .ap{padding:6px 10px !important;margin-bottom:5px !important;gap:10px !important;border-radius:11px !important}' +
    'body.cx .ap .nm{font-size:14.5px !important;margin-top:2px !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}body.cx .ap .amt b{font-size:17px !important}body.cx .ap .btn{height:32px !important;padding:0 10px !important;font-size:13px !important}' +
    'body.cx .ap-day{margin:8px 4px 4px !important}' +
    'body.cx .pc-list,body.cx #clList,body.cx #bgList{grid-template-columns:minmax(0,1fr) !important}body.cx .cx-card{min-width:0;max-width:100%;overflow:hidden}' +
    'body.cx .cx-card{display:block !important;padding:7px 12px !important;border-radius:12px !important;border-left-width:4px !important}' +
    'body.cx .cx1,body.cx .cx2{display:flex;align-items:center;gap:6px 10px;min-width:0}' +
    'body.cx .cx2{margin-top:3px;font-size:12.5px;color:#64748b;white-space:nowrap}' +
    'body.cx .cx-l{flex:1;min-width:0;display:flex;align-items:center;gap:6px 10px;overflow:hidden}' +
    'body.cx .cx1 .nm{margin:0 !important;font-size:15px !important;line-height:1.35 !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:60px}' +
    'body.cx .cx-r{flex-shrink:0;display:flex;align-items:center;gap:8px}' +
    'body.cx .cx-big{font-weight:700;font-size:16px;white-space:nowrap;text-align:right}body.cx .cx-big small{font-size:11px;color:#94a3b8;font-weight:600;margin-right:4px}' +
    'body.cx .cx2 .cx-l>*{flex-shrink:0}body.cx .cx2 .cx-l .cx-shrink{flex-shrink:1;min-width:0;overflow:hidden;text-overflow:ellipsis}' +
    'body.cx .cx2 .meta,body.cx .cx2 .pc-who,body.cx .cx2 .who,body.cx .cx2 .pc-ids,body.cx .cx2 .ids{display:contents !important}' +
    'body.cx .cx-dots{display:flex;gap:3px;flex-shrink:0}body.cx .cx-dots i{width:14px;height:5px;border-radius:3px;background:#e2e8f0;display:block}' +
    'body.cx .cx-dots i.ok{background:#10b981}body.cx .cx-dots i.now{background:var(--sc,#2563eb)}body.cx .cx-dots i.bad{background:#ef4444}' +
    'body.cx .cx-dots{align-items:center}body.cx .cx-stg{margin-left:5px;font-size:12px;font-weight:700;color:var(--sc,#2563eb);white-space:nowrap}body.cx .cx-stg.bad{color:#dc2626}body.cx .cx-stg.ok{color:#059669}' +
    'body.cx .cx-note{flex-shrink:0 !important;max-width:45%;background:#f1f5f9;color:#475569;border-radius:6px;padding:0 6px;overflow:hidden;text-overflow:ellipsis}body.cx .cx-note.bad{background:#fef2f2;color:#b91c1c}' +
    'body.cx .cx-btns{display:flex;gap:4px;flex-shrink:0}' +
    'body.cx .cx-btns .btn{height:30px !important;min-width:32px;padding:0 8px !important;border-radius:8px !important;font-size:0 !important;gap:0 !important;border-width:1px !important}' +
    'body.cx .cx-btns .btn i{font-size:14px !important;margin:0 !important}' +
    'body.cx .cx-btns .btn.p{font-size:12.5px !important;gap:5px !important;padding:0 10px !important}body.cx .cx-btns .btn.p i{font-size:12.5px !important}' +
    'body.cx .cx-card .bar,body.cx .cx-card .todo,body.cx .cx-card .atl{margin-top:4px !important}body.cx .cx-card .todo{padding:3px 9px !important;font-size:12.5px !important}' +
    'body.cx .cx-card .bar .bl{margin-top:2px !important;font-size:12px !important}body.cx .cx-card .bt2{height:6px !important}' +
    'body.cx .cx-card .tg,body.cx .cx-card .sb,body.cx .cx-card .sap,body.cx .cx-card .ty{font-size:11.5px !important;padding:1px 7px !important}' +
    'body.cx .cx-card input[type=checkbox]{width:18px !important;height:18px !important}' +
    'body.cx .cx-card .rk{width:24px !important;height:24px !important;font-size:12px !important;margin:0 !important}' +
    '@media(min-width:1300px){body.cx .pc-list,body.cx #clList,body.cx #bgList{grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important}}' +
    '@media(max-width:700px){body.cx .cx2 .cx-hm,body.cx .cx2 .pc-ids,body.cx .cx2 .ids,body.cx .cx2 .pc-tg.pc-bt,body.cx .cx2 .tg.bt{display:none !important}body.cx .pcx>.f1,body.cx #clx>.f1,body.cx #bgx>.f1,body.cx #apx>.f1{flex-basis:100%}body.cx .cx2{flex-wrap:wrap}body.cx .cx2 .cx-l{flex-basis:100%}body.cx .cx2 .cx-r{margin-left:auto}body.cx .cx1 .cx-r .sb,body.cx .cx1 .cx-r .sap{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}body.cx .cx-note{max-width:100%}body.cx .cx2 .pc-js{order:-1;flex-shrink:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}}' +
    /* Dashboard */
    'body.cx #dbx{gap:8px !important}body.cx #dbx .card{padding:10px 12px !important;border-radius:14px !important}body.cx #dbx h3{margin-bottom:6px !important;font-size:15px !important}' +
    'body.cx #dbx .hi h2{font-size:17px !important}body.cx #dbx .hi p{font-size:12.5px !important}body.cx #dbx .flow{margin-top:8px !important}body.cx #dbx .fs{padding:6px 10px !important}body.cx #dbx .fs b{font-size:20px !important}' +
    'body.cx #dbx .td{padding:6px 10px !important;margin-bottom:5px !important}body.cx #dbx .td .ic{width:32px !important;height:32px !important;font-size:15px !important}body.cx #dbx .td .n{font-size:20px !important}body.cx #dbx .td .go{height:30px !important}' +
    'body.cx #dbx .g2{gap:8px !important}body.cx #dbx td{padding:5px 8px !important}body.cx #dbx .fd{padding:4px 0 !important}' +
    /* บันทึกงาน */
    'body.cx #constructionForm>.ax-sec{padding:12px 14px !important;margin-bottom:8px !important}body.cx .ax-sh{margin-bottom:8px !important}body.cx #page-add .input-field{min-height:40px !important}body.cx #page-add select.input-field{height:40px !important}' +
    /* ปุ่มสลับ */
    '#cxTgl{position:fixed;right:12px;bottom:calc(12px + var(--cx-nav,0px));z-index:9000;height:36px;padding:0 12px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#334155;font-weight:700;font-size:12.5px;box-shadow:0 4px 14px rgba(15,23,42,.18);cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px}' +
    '#cxTgl.on{background:#0D2B5E;color:#fff;border-color:#0D2B5E}';

  // ───── จัดการ์ดใหม่ ─────
  function txt(el) { return (el && el.textContent || '').trim(); }
  function dotsFrom(pipe) {
    if (!pipe) return null;
    var d = document.createElement('span'); d.className = 'cx-dots';
    Array.prototype.forEach.call(pipe.querySelectorAll('.p'), function (p) {
      var i = document.createElement('i'); i.className = p.classList.contains('ok') ? 'ok' : p.classList.contains('bad') ? 'bad' : p.classList.contains('now') ? 'now' : '';
      i.title = txt(p.querySelector('span')); d.appendChild(i);
    });
    // ป้ายขั้นตอนปัจจุบัน ต่อท้ายจุด (เช่น "ดำเนินงาน" / "ตรวจรับ ✕")
    var cur = pipe.querySelector('.p.bad, .p.now'), all = pipe.querySelectorAll('.p.ok');
    var lab = cur ? txt(cur.querySelector('span')) + (cur.classList.contains('bad') ? ' ✕' : '') : (all.length ? txt(all[all.length - 1].querySelector('span')) + ' ✓' : '');
    if (lab) { var t = document.createElement('b'); t.className = 'cx-stg' + (cur && cur.classList.contains('bad') ? ' bad' : !cur ? ' ok' : ''); t.textContent = lab; d.appendChild(t); }
    return d;
  }
  function row(cls) { var r = document.createElement('div'); r.className = cls; var l = document.createElement('div'); l.className = 'cx-l'; var rr = document.createElement('div'); rr.className = 'cx-r'; r.appendChild(l); r.appendChild(rr); return { el: r, l: l, r: rr }; }
  function btns(ft) {
    var b = document.createElement('div'); b.className = 'cx-btns';
    Array.prototype.forEach.call(ft.querySelectorAll('button'), function (x) { if (!x.title) x.title = txt(x); b.appendChild(x); });
    return b;
  }

  function doCard(c) {
    if (c.__cx) return; c.__cx = 1;
    var kind = c.classList.contains('bgc') ? 'bg' : c.classList.contains('clc') ? 'cl' : 'pc';
    var left = c.firstElementChild, rBox = c.querySelector(':scope > .r');
    var pipe = c.querySelector(':scope > .pc-pipe'), note = c.querySelector(':scope > .note'), ft = c.querySelector(':scope > .ft');
    if (!left || !ft) return;
    var r1 = row('cx1'), r2 = row('cx2');
    // บรรทัด 1: (ติ๊ก) เลขที่ ชื่องาน ป้าย … ตัวเลขใหญ่
    var nm = left.querySelector('.nm');
    if (kind === 'bg') {
      var rk = left.querySelector('.rk'); if (rk) r1.l.appendChild(rk);
      if (nm) r1.l.appendChild(nm);
      var metas = left.querySelectorAll('.meta');
      if (metas[0]) Array.prototype.slice.call(metas[0].children).forEach(function (x) { if (x.classList.contains('tg')) r1.l.appendChild(x); else r2.l.appendChild(x); });
      if (metas[1]) { metas[1].classList.add('cx-hm'); r2.l.appendChild(metas[1]); }
    } else {
      var l1 = left.querySelector('.l1');
      if (l1) Array.prototype.slice.call(l1.children).forEach(function (x) { if (x.classList.contains('dt')) return; if (x.classList.contains('sb') || x.classList.contains('sap')) { x.dataset.cxPill = 1; return; } r1.l.appendChild(x); });
      if (nm) r1.l.appendChild(nm);
      if (l1) Array.prototype.slice.call(l1.querySelectorAll('[data-cx-pill]')).forEach(function (x) { r1.r.appendChild(x); });
      Array.prototype.slice.call(left.querySelectorAll('.meta')).forEach(function (m, i) { if (i > 0 || kind === 'cl') m.classList.add(i > 0 ? 'cx-hm' : 'x'); r2.l.appendChild(m); });
    }
    if (rBox) {
      var big = document.createElement('div'); big.className = 'cx-big'; var b = rBox.querySelector('b');
      var lab = rBox.querySelector('small');
      if (kind === 'bg' && lab) big.innerHTML = '<small>' + txt(lab) + '</small>';
      if (b) { big.appendChild(b); }
      r1.r.appendChild(big);
    }
    // บรรทัด 2: ขั้นตอนย่อ · ข้อมูล · ผู้รับผิดชอบ · หมายเหตุ … ปุ่มไอคอน
    var d = dotsFrom(pipe); if (d) r2.l.insertBefore(d, r2.l.firstChild);
    var who = ft.querySelector('.pc-who, .who'); if (who) { Array.prototype.slice.call(who.children).forEach(function (x, i) { if (i > 0) x.classList.add('cx-hm'); }); r2.l.appendChild(who); }
    if (note) { var n = document.createElement('span'); n.className = 'cx-note cx-shrink' + (note.classList.contains('bad') ? ' bad' : ''); n.textContent = /^สถานะงาน:/.test(txt(note)) ? '📌 ' + txt(note).replace(/^สถานะงาน:\s*/, 'สถานะงาน ') : (/^🔒/.test(txt(note)) ? '' : '📝 ') + txt(note); n.title = txt(note); r2.l.appendChild(n); }
    var hasAge = c.querySelector('.cx1 .cx-big');
    r2.r.appendChild(btns(ft));
    // ใส่กลับเข้าการ์ด (คงส่วนพิเศษ: แถบงบ / สิ่งที่ต้องทำ / รายการไฟล์)
    var extras = Array.prototype.filter.call(c.children, function (x) { return x !== left && x !== rBox && x !== pipe && x !== note && x !== ft; });
    c.innerHTML = '';
    c.appendChild(r1.el); c.appendChild(r2.el);
    extras.forEach(function (x) { c.appendChild(x); });
    c.classList.add('cx-card');
    void hasAge;
  }

  var pend = false;
  function scan() {
    pend = false;
    if (!document.body.classList.contains('cx')) return;
    Array.prototype.forEach.call(document.querySelectorAll('.pc[data-id], .clc[data-id], .bgc'), function (c) { try { doCard(c); } catch (e) { console.error('[compact]', e); } });
  }
  function soon() { if (!pend) { pend = true; requestAnimationFrame(scan); } }

  function apply(on, rerender) {
    document.body.classList.toggle('cx', on);
    var t = document.getElementById('cxTgl'); if (t) { t.classList.toggle('on', on); t.innerHTML = '<i class="fa-solid ' + (on ? 'fa-table-list' : 'fa-grip-lines') + '"></i>' + (on ? 'กระชับ: เปิด' : 'กระชับ: ปิด'); }
    if (rerender) { try { window.renderTable && window.renderTable(); window.renderInspectionTable && window.renderInspectionTable(); window.renderCloseTable && window.renderCloseTable(); window.renderBudgetTable && window.renderBudgetTable(allData); } catch (e) {} }
    soon();
  }

  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var b = document.createElement('button'); b.id = 'cxTgl'; b.type = 'button'; b.title = 'สลับโหมดแสดงผลแบบกระชับ';
    b.onclick = function () { var v = !document.body.classList.contains('cx'); set(v); apply(v, true); };
    document.body.appendChild(b);
    var bn = document.getElementById('cclBottomNav'); if (bn && bn.offsetHeight) document.documentElement.style.setProperty('--cx-nav', bn.offsetHeight + 'px');
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
    apply(get(), false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
