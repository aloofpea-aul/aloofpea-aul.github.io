/* CCL — ชื่อผู้รับจ้าง (หน่วยงานผู้รับผิดชอบ) กดได้ทุกที่ในระบบ
   กดแล้วขึ้นการ์ดสรุป: งานกำลังทำ / รอตรวจรับ / เสร็จแล้ว + อัปเดตล่าสุด
   - "เปิดโปรแกรมผู้รับจ้าง" → เปิด Contractor Portal แท็บใหม่ ในโหมดเจ้าหน้าที่ (ดูและทำแทนได้ บันทึกชื่อผู้ทำแทน)
     เปิดได้เฉพาะ Admin / ผู้ควบคุมงานของผู้รับจ้างรายนั้น / คณะกรรมการตรวจรับ (หลังบ้านตรวจซ้ำ)
   - "ดูงานทั้งหมดของผู้รับจ้างนี้ใน CCL" → กรองรายการงานในหน้ารายการงาน */
(function () {
  'use strict';
  var DONE = ['อนุมัติ/เสร็จสิ้น', 'ปิดงานแล้วเสร็จ'];
  var SKIP = /^(-|ไม่ระบุ|ไฟฟ้า.*|กฟภ.*|กฟส.*|PEA.*)$/i;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jobs() { try { return Array.isArray(allData) ? allData : []; } catch (e) { return []; } }
  function user() { try { return currentUser || {}; } catch (e) { return {}; } }
  function nameKey(n) { return String(n || '').replace(/^\s*(นางสาว|นาย|นาง|น\.ส\.|ว่าที่\s*ร\.?ต\.?)\s*/, '').replace(/\s+/g, '').toLowerCase(); }

  var companies = {}, compSig = '';
  function refreshCompanies() {
    var d = jobs(), sig = d.length + ':' + (d[0] && d[0].id);
    if (sig === compSig) return;
    compSig = sig; companies = {};
    d.forEach(function (j) { var c = String(j.responsibleEntity || '').trim(); if (c && !SKIP.test(c)) companies[c] = 1; });
  }

  // ───── ใครเปิดโปรแกรมผู้รับจ้างได้ (หน้าจอ — หลังบ้านตรวจซ้ำอีกชั้น) ─────
  function committeeNames() {
    var m; try { m = _committeeCache || []; } catch (e) { m = []; }
    return m.map(function (x) { if (typeof x === 'string') { try { x = JSON.parse(x); } catch (e) { x = { name: x }; } } return nameKey(x && x.name); });
  }
  function canOpen(company) {
    var u = user();
    if (u.role === 'Admin' || u.superAdmin) return true;
    var me = nameKey(u.name); if (!me) return false;
    if (jobs().some(function (j) { return String(j.responsibleEntity || '').trim() === company && nameKey(j.assignee) === me; })) return true;
    return committeeNames().indexOf(me) >= 0;
  }

  // ───── CSS ─────
  var st = document.createElement('style');
  st.textContent =
    '.ctl-name{color:#1d4ed8 !important;text-decoration:underline dashed #93c5fd;text-underline-offset:3px;cursor:pointer;border-radius:4px}' +
    '.ctl-name:hover{background:#eff6ff;text-decoration-style:solid}' +
    '#ctlPop{position:fixed;z-index:100000;width:320px;max-width:calc(100vw - 24px);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 12px 32px rgba(15,23,42,.18);font-size:13px;color:#334155;overflow:hidden}' +
    '#ctlPop .h{display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid #f1f5f9}' +
    '#ctlPop .av{width:38px;height:38px;border-radius:10px;background:#ede9fe;color:#6d28d9;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0}' +
    '#ctlPop .t{font-weight:800;font-size:15px;color:#0f172a;line-height:1.3}#ctlPop .s{font-size:11.5px;color:#64748b}' +
    '#ctlPop .x{margin-left:auto;border:0;background:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:2px 6px;align-self:flex-start}' +
    '#ctlPop .st{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:10px 14px}' +
    '#ctlPop .st div{border-radius:10px;padding:7px 4px;text-align:center}#ctlPop .st b{display:block;font-size:19px;line-height:1.2}#ctlPop .st span{font-size:11px;font-weight:700}' +
    '#ctlPop .lu{margin:0 14px 10px;padding:8px 10px;background:#f8fafc;border-radius:10px;font-size:12px;line-height:1.45}#ctlPop .lu small{display:block;color:#94a3b8;font-size:11px}' +
    '#ctlPop .bt{display:flex;flex-direction:column;gap:6px;padding:0 14px 14px}' +
    '#ctlPop .bt button{border:0;border-radius:10px;padding:10px;font-size:13.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px}' +
    '#ctlPop .b1{background:#0D2B5E;color:#fff}#ctlPop .b1:disabled{opacity:.6;cursor:wait}#ctlPop .b2{background:#f1f5f9;color:#334155}' +
    '#ctlPop .no{font-size:11.5px;color:#94a3b8;text-align:center;padding:2px 4px}';
  document.head.appendChild(st);

  // ───── ทำให้ชื่อผู้รับจ้างกดได้ ─────
  var BAD = 'select,option,input,textarea,button,a,#ctlPop,.swal2-input,label';
  function decorate(root) {
    refreshCompanies();
    if (!Object.keys(companies).length) return;
    var els = (root || document.body).querySelectorAll('span,div,td,b,strong,p');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__ctl || el.childElementCount) continue;
      var t = (el.textContent || '').trim();
      if (!companies[t]) continue;
      el.__ctl = 1;
      if (el.closest(BAD)) continue;
      el.classList.add('ctl-name');
      el.setAttribute('role', 'button');
      el.title = 'ดูข้อมูลผู้รับจ้าง ' + t;
    }
  }
  var pend = false;
  function soon() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; decorate(); }); }

  // ───── การ์ดสรุปผู้รับจ้าง ─────
  var openedAt = 0;
  function closePop() { var p = document.getElementById('ctlPop'); if (p) p.remove(); }
  function jobIdNear(el) {
    var n = el;
    while (n && n !== document.body) {
      var oc = n.getAttribute && n.getAttribute('onclick');
      var m = oc && /\(\s*['"]?(\d+)/.exec(oc);
      if (m) return m[1];
      var di = n.dataset && (n.dataset.jobId || n.dataset.id);
      if (di && /^\d+$/.test(di) && Number(di) >= 2) return di;
      n = n.parentNode;
    }
    var dm = document.getElementById('detailModal');
    if (dm && dm.contains(el)) { try { if (currentDetailJobId) return String(currentDetailJobId); } catch (e) {} }
    return '';
  }
  function fmtTs(ts) {
    var d = new Date(ts); if (isNaN(d)) return '';
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  }
  var TYPE = { progress: '📊 ความคืบหน้า', delivery: '🚚 แจ้งส่งมอบ', problem: '⚠️ แจ้งปัญหา', note: '📝 บันทึก' };

  function showPop(el, company) {
    closePop();
    var list = jobs().filter(function (j) { return String(j.responsibleEntity || '').trim() === company; });
    var doing = 0, wait = 0, done = 0, last = null;
    list.forEach(function (j) {
      if (j.status === 'ยกเลิก') {} else if (DONE.indexOf(j.status) >= 0 || j.inspectionStatus === 'ผ่านการตรวจรับ') done++; else if (j.status === 'ตรวจรับงาน') wait++; else doing++;
      (Array.isArray(j.contractorUpdates) ? j.contractorUpdates : []).forEach(function (u) {
        if (!u || u.updateType === 'pea_reply' || !u.timestamp) return;
        var t = new Date(u.timestamp).getTime();
        if (!last || t > last.t) last = { t: t, u: u, job: j };
      });
    });
    var jobId = jobIdNear(el), ok = canOpen(company);
    var p = document.createElement('div'); p.id = 'ctlPop'; p.setAttribute('role', 'dialog');
    p.innerHTML =
      '<div class="h"><div class="av"><i class="fa-solid fa-helmet-safety"></i></div><div><div class="t">' + esc(company) + '</div><div class="s">ผู้รับจ้าง · งานในระบบ ' + list.length + ' งาน</div></div><button class="x" aria-label="ปิด">×</button></div>' +
      '<div class="st"><div style="background:#eff6ff;color:#1d4ed8"><b>' + doing + '</b><span>กำลังทำ</span></div>' +
      '<div style="background:#faf5ff;color:#7e22ce"><b>' + wait + '</b><span>รอตรวจรับ</span></div>' +
      '<div style="background:#f0fdf4;color:#15803d"><b>' + done + '</b><span>เสร็จแล้ว</span></div></div>' +
      (last ? '<div class="lu"><small>อัปเดตล่าสุดจากผู้รับจ้าง · ' + esc(fmtTs(last.u.timestamp)) + '</small>' + esc(TYPE[last.u.updateType] || TYPE.note) +
        (last.u.progress ? ' ' + esc(last.u.progress) + '%' : '') + ' — ' + esc(String(last.job.jobName || '').slice(0, 60)) + '</div>' : '') +
      '<div class="bt">' +
      (ok ? '<button class="b1"><i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดโปรแกรมผู้รับจ้าง (ทำแทน ' + esc(company) + ')</button>'
          : '<div class="no">เปิดโปรแกรมผู้รับจ้างได้เฉพาะ Admin, ผู้ควบคุมงาน และคณะกรรมการตรวจรับ</div>') +
      '<button class="b2"><i class="fa-solid fa-filter"></i> ดูงานทั้งหมดของผู้รับจ้างนี้ใน CCL</button></div>';
    document.body.appendChild(p); openedAt = Date.now();
    // วางการ์ดใต้ชื่อที่กด (ล้นจอ → ขึ้นด้านบน)
    var r = el.getBoundingClientRect(), pw = p.offsetWidth, ph = p.offsetHeight;
    var left = Math.min(Math.max(12, r.left), window.innerWidth - pw - 12);
    var top = r.bottom + 6; if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 6);
    p.style.left = left + 'px'; p.style.top = top + 'px';
    p.querySelector('.x').onclick = closePop;
    var b1 = p.querySelector('.b1'); if (b1) b1.onclick = function () { openPortal(company, jobId, b1); };
    p.querySelector('.b2').onclick = function () { closePop(); filterCompany(company); };
  }

  function openPortal(company, jobId, btn) {
    // เปิดแท็บไว้ก่อน (กันเบราว์เซอร์บล็อกป๊อปอัป) แล้วค่อยใส่ที่อยู่เมื่อได้สิทธิ์
    var w = window.open('', '_blank');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเปิด...';
    google.script.run.withSuccessHandler(function (res) {
      if (!res || !res.token) { fail(new Error('เปิดไม่สำเร็จ')); return; }
      try { localStorage.setItem('ct_preview_v1', JSON.stringify({ token: res.token, user: res.user, at: Date.now() })); } catch (e) {}
      var url = 'contractor.html?preview=1' + (jobId ? '&job=' + encodeURIComponent(jobId) : '');
      if (w && !w.closed) w.location.href = url; else window.open(url, '_blank');
      closePop();
    }).withFailureHandler(fail).cclCtPreview(company);
    function fail(e) {
      try { if (w) w.close(); } catch (x) {}
      btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i> ลองอีกครั้ง';
      if (window.Swal) Swal.fire({ icon: 'warning', title: 'เปิดโปรแกรมผู้รับจ้างไม่ได้', text: (e && e.message) || String(e) });
    }
  }

  function filterCompany(company) {
    var inp = document.getElementById('searchInput');
    if (!inp) return;
    try { if (!inp.offsetParent && typeof showPage === 'function') showPage('list'); } catch (e) {}
    try { var s = document.getElementById('searchStatus'); if (s) s.value = ''; } catch (e) {}
    inp.value = company;
    try { if (typeof filterTable === 'function') filterTable(); } catch (e) {}
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(function () { if (inp.offsetParent) { inp.scrollIntoView({ block: 'center', behavior: 'smooth' }); inp.focus({ preventScroll: true }); } }, 120);
  }

  // กดชื่อ → เปิดการ์ด (ไม่ให้ไปเปิดรายละเอียดงานของแถวนั้นแทน)
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('.ctl-name');
    if (el) { e.preventDefault(); e.stopPropagation(); showPop(el, el.textContent.trim()); return; }
    var p = document.getElementById('ctlPop');
    if (p && !p.contains(e.target)) closePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });
  window.addEventListener('scroll', function (e) { var p = document.getElementById('ctlPop'); if (p && !p.contains(e.target) && Date.now() - openedAt > 600) closePop(); }, true);

  function start() {
    decorate();
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
