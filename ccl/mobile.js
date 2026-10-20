/* CCL — แถบเมนูล่างสำหรับมือถือ + เปลี่ยนตารางเป็นการ์ด (คู่กับ mobile.css)
   ไม่แก้ฟังก์ชันเดิม: ปุ่มทุกปุ่มเรียก showPage() ตัวเดิม */
(function () {
  'use strict';
  var BAR = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'หน้าหลัก' },
    { id: 'list', icon: 'fa-list-check', label: 'ติดตามงาน', badge: 'badge-list' },
    { id: 'inspection', icon: 'fa-clipboard-check', label: 'ตรวจรับ', badge: 'inspectionBadge' },
    { id: 'inspectMap', icon: 'fa-map-location-dot', label: 'แผนที่' }
  ];
  var current = 'add';

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function badgeOf(srcId) {
    var b = srcId && $(srcId);
    if (!b) return '';
    var n = (b.textContent || '').trim();
    var shown = b.classList.contains('show') || (b.style.display && b.style.display !== 'none' && !b.classList.contains('hidden'));
    if (!shown || !n || n === '0') return '';
    return n;
  }

  // ───── แถบเมนูล่าง ─────
  function buildBar() {
    if ($('cclBottomNav')) return;
    var nav = el('nav'); nav.id = 'cclBottomNav'; nav.setAttribute('aria-label', 'เมนูหลัก');
    BAR.forEach(function (it) {
      var b = el('button', '', '<i class="fa-solid ' + it.icon + '"></i><span>' + it.label + '</span><span class="ccl-bn-badge"></span>');
      b.type = 'button'; b.dataset.page = it.id; if (it.badge) b.dataset.badge = it.badge;
      b.addEventListener('click', function () { closeMore(); go(it.id); });
      nav.appendChild(b);
    });
    var more = el('button', '', '<i class="fa-solid fa-grip"></i><span>อื่นๆ</span><span class="ccl-bn-badge"></span>');
    more.type = 'button'; more.dataset.page = '__more';
    more.addEventListener('click', function () { $('cclMoreSheet').classList.contains('open') ? closeMore() : openMore(); });
    nav.appendChild(more);
    document.body.appendChild(nav);

    var bd = el('div'); bd.id = 'cclMoreBackdrop'; bd.addEventListener('click', closeMore);
    var sh = el('div'); sh.id = 'cclMoreSheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'เมนูทั้งหมด');
    document.body.appendChild(bd); document.body.appendChild(sh);

    var chip = $('cclUserChip');
    if (chip) chip.addEventListener('click', function () { if (window.innerWidth < 768) openMore(); });
  }

  function go(id) {
    if (typeof window.showPage === 'function') window.showPage(id);
    window.scrollTo(0, 0);
  }

  function openMore() {
    var sh = $('cclMoreSheet'); if (!sh) return;
    var name = ($('navUserName') || {}).textContent || '';
    var role = ($('navUserRole') || {}).textContent || '';
    var html = '<div class="ccl-sheet-handle"></div>' +
      '<div class="ccl-sheet-user"><div class="ccl-avatar">' + esc((($('cclAvatarInitial') || {}).textContent) || '?') + '</div><div><b>' + esc(name) + '</b><small>' + esc(role) + '</small></div></div>' +
      '<div class="ccl-sheet-grid">';
    var tabs = document.querySelectorAll('#cclNavTabs .ccl-nav-btn');
    Array.prototype.forEach.call(tabs, function (t) {
      if (t.classList.contains('hidden') || t.style.display === 'none') return;
      var id = (t.id || '').replace(/^nav-/, '');
      var ic = t.querySelector('i'); var icon = ic ? ic.className : 'fa-solid fa-circle';
      var label = Array.prototype.filter.call(t.childNodes, function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join(' ').trim();
      var badgeEl = t.querySelector('.ccl-badge.show, .ccl-badge:not(.hidden)[style*="inline"]');
      var bn = '';
      Array.prototype.forEach.call(t.querySelectorAll('.ccl-badge'), function (x) { if (!bn) bn = badgeOf(x.id); });
      html += '<button type="button" data-page="' + esc(id) + '" class="' + (id === current ? 'on' : '') + '"><i class="' + esc(icon) + '"></i><span>' + esc(label) + '</span><span class="ccl-bn-badge' + (bn ? ' show' : '') + '">' + esc(bn) + '</span></button>';
    });
    html += '</div><div class="ccl-sheet-title">อื่นๆ</div><div class="ccl-sheet-grid">' +
      '<a href="/index.html"><i class="fa-solid fa-house"></i><span>ศูนย์รวมงาน</span></a>' +
      '<button type="button" data-act="reload"><i class="fa-solid fa-rotate-right"></i><span>โหลดใหม่</span></button>' +
      '<button type="button" data-act="logout" class="ccl-danger"><i class="fa-solid fa-power-off"></i><span>ออกจากระบบ</span></button>' +
      '</div>';
    sh.innerHTML = html;
    Array.prototype.forEach.call(sh.querySelectorAll('button[data-page]'), function (b) {
      b.addEventListener('click', function () { closeMore(); go(b.dataset.page); });
    });
    sh.querySelector('[data-act="reload"]').addEventListener('click', function () { location.reload(); });
    sh.querySelector('[data-act="logout"]').addEventListener('click', function () { closeMore(); var lb = $('cclLogoutBtn'); if (lb) lb.click(); });
    sh.classList.add('open'); $('cclMoreBackdrop').classList.add('open');
    var mb = document.querySelector('#cclBottomNav [data-page="__more"]'); if (mb) mb.classList.add('on');
  }
  function closeMore() {
    var sh = $('cclMoreSheet'); if (!sh) return;
    sh.classList.remove('open'); $('cclMoreBackdrop').classList.remove('open');
    syncBar();
  }

  function syncBar() {
    var nav = $('cclBottomNav'); if (!nav) return;
    var inBar = BAR.some(function (b) { return b.id === current; });
    var otherBadge = false;
    Array.prototype.forEach.call(nav.querySelectorAll('button'), function (b) {
      var on = b.dataset.page === current || (b.dataset.page === '__more' && !inBar);
      b.classList.toggle('on', on);
      var bb = b.querySelector('.ccl-bn-badge');
      if (b.dataset.badge && bb) { var n = badgeOf(b.dataset.badge); bb.textContent = n; bb.classList.toggle('show', !!n); }
    });
    ['badge-close', 'approvalBadge', 'oldJobBadge'].forEach(function (id) { if (badgeOf(id)) otherBadge = true; });
    var mb = nav.querySelector('[data-page="__more"] .ccl-bn-badge');
    if (mb) { mb.textContent = otherBadge ? '•' : ''; mb.classList.toggle('show', otherBadge); }
  }

  function hookShowPage() {
    var orig = window.showPage;
    if (typeof orig !== 'function' || orig.__ccl) return;
    var wrapped = function (id) {
      var r = orig.apply(this, arguments);
      current = id; syncBar();
      if (id === 'inspectMap') { setTimeout(fixMap, 350); setTimeout(fixMap, 1500); setTimeout(fixMap, 4000); }
      setTimeout(scanTables, 60);
      return r;
    };
    wrapped.__ccl = true;
    window.showPage = wrapped;
  }

  // ───── แผนที่ตรวจรับ: ปุ่มขยายแผนที่ (มือถือ) ─────
  function fixMap() {
    try {
      if (typeof _imapMap !== 'undefined' && _imapMap) _imapMap.invalidateSize();
      // ถ้าข้อมูลมาถึงก่อนแผนที่สร้างเสร็จ รายการจะว่าง — สร้างรายการใหม่อีกรอบ
      var list = $('imap-list');
      if (list && !list.children.length && typeof _imapBuildJobs === 'function' && typeof allData !== 'undefined' && allData && allData.length && typeof _imapMap !== 'undefined' && _imapMap) _imapBuildJobs(allData);
    } catch (e) {}
  }
  function addMapToggle() {
    var p = $('page-inspectMap'); if (!p || p.querySelector('.ccl-imap-toggle')) return;
    var bar = p.querySelector(':scope > div > div:nth-child(1) > div:last-child'); if (!bar) return;
    var b = el('button', 'ccl-imap-toggle', '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> ขยาย');
    b.type = 'button';
    b.setAttribute('style', 'font-size:12px;padding:6px 9px;background:#0D1B4B;color:#fff;border:0;border-radius:10px;cursor:pointer');
    b.addEventListener('click', function () {
      var big = p.classList.toggle('ccl-map-big');
      b.innerHTML = big ? '<i class="fa-solid fa-list"></i> รายการ' : '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> ขยาย';
      setTimeout(fixMap, 230);
    });
    bar.appendChild(b);
  }

  // ───── ตาราง → การ์ด (ใส่ป้ายชื่อคอลัมน์ให้แต่ละช่อง) ─────
  var ACTION_RE = /จัดการ|เครื่องมือ|action|ดำเนินการ$/i;
  function labelTable(t) {
    var heads = t.querySelectorAll('thead th');
    if (!heads.length) return;
    t.classList.add('ccl-cards');
    var names = Array.prototype.map.call(heads, function (h) { return (h.textContent || '').replace(/\s+/g, ' ').trim(); });
    Array.prototype.forEach.call(t.tBodies, function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var cells = tr.cells;
        if (cells.length === 1 && (cells[0].colSpan > 1 || names.length > 1)) { cells[0].classList.add('ccl-td-full'); tr.classList.add('ccl-tr-empty'); return; }
        var col = 0;
        Array.prototype.forEach.call(cells, function (td, i) {
          var name = names[col] || '';
          col += td.colSpan || 1;
          if (td.dataset.label !== name) td.dataset.label = name;
          td.classList.toggle('ccl-td-head', i === 0 && cells.length > 2);
          td.classList.toggle('ccl-td-actions', i > 0 && (ACTION_RE.test(name) || (i === cells.length - 1 && td.querySelectorAll('button').length >= 2 && !(td.textContent || '').replace(/\s/g, '').length)));
          var txt = (td.textContent || '').replace(/\s/g, '');
          td.classList.toggle('ccl-td-empty', !txt && !td.querySelector('button,a,img,input,select,i,svg'));
        });
      });
    });
  }
  var scanQueued = false;
  function scanTables() {
    scanQueued = false;
    Array.prototype.forEach.call(document.querySelectorAll('#mainApp .page-section table'), labelTable);
  }
  function queueScan() { if (!scanQueued) { scanQueued = true; requestAnimationFrame(scanTables); } }

  function init() {
    buildBar();
    hookShowPage();
    addMapToggle();
    var active = document.querySelector('#cclNavTabs .ccl-nav-btn.active');
    if (active) current = active.id.replace(/^nav-/, '');
    syncBar();
    scanTables();
    var tabs = $('cclNavTabs');
    if (tabs) new MutationObserver(function () { syncBar(); }).observe(tabs, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
    var app = $('mainApp');
    if (app) new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.nodeName === 'TBODY' || t.nodeName === 'TABLE' || (t.closest && t.closest('table'))) { queueScan(); return; }
      }
    }).observe(app, { subtree: true, childList: true });
    function navH() { var n = $('cclNav'); if (n) document.documentElement.style.setProperty('--ccl-nav-h', n.offsetHeight + 'px'); }
    navH(); setTimeout(navH, 800);
    window.addEventListener('resize', function () { navH(); if (window.innerWidth >= 768) closeMore(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMore(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', hookShowPage);
})();
