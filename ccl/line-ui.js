/* line-ui.js — หน้าต่าง "ส่ง / แชร์ทาง LINE": เลือกกลุ่ม/รายชื่อของบอท CCL หรือแชร์เองผ่านแอป LINE
   ใช้แทน sendDetailToLine เดิม (ทุกปุ่ม LINE ในระบบ) · window.cclLineShare({title, sub, text}) ใช้จากหน้าอื่นได้ */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  var APP = 'https://aloofpea-aul.github.io/ccl/';
  var KSEL = 'ccl_line_sel_v1', KTAB = 'ccl_line_tab_v1', T = null, TT = 0, LAST = '';
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  var COLORS = ['#06c755', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#64748b', '#ec4899'];

  var css = '.lnx{text-align:left;font-family:inherit}.lnx .lab{font-size:13px;font-weight:700;color:#475569;margin:0 0 6px;display:flex;gap:6px}.lnx .lab span{margin-left:auto;font-weight:500;color:#94a3b8;font-size:12px}' +
    '.lnx textarea{width:100%;border:1.5px solid #e2e8f0;border-radius:12px;padding:9px 11px;font-size:13px!important;line-height:1.55;font-family:inherit;background:#f8fafc;resize:vertical;min-height:110px;max-height:240px;box-sizing:border-box;color:#1e293b}' +
    '.lnx .tabs{display:grid;grid-template-columns:1fr 1fr;background:#f1f5f9;border-radius:12px;padding:4px;margin:12px 0}' +
    '.lnx .tabs button{border:0;background:none;text-align:center;padding:8px 6px;border-radius:9px;font:700 13.5px inherit;font-family:inherit;color:#64748b;cursor:pointer}.lnx .tabs .on{background:#fff;color:#0f172a;box-shadow:0 1px 4px rgba(0,0,0,.08)}' +
    '.lnx .tabs small{display:block;font-weight:500;font-size:11px;color:#94a3b8}' +
    '.lnx .srch{width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 11px;font-size:13px;margin-bottom:8px;box-sizing:border-box;font-family:inherit}' +
    '.lnx .chips{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}.lnx .chips button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;padding:2px 10px;font:600 12px inherit;font-family:inherit;color:#475569;cursor:pointer}.lnx .chips .on{background:#0f172a;color:#fff;border-color:#0f172a}' +
    '.lnx .lst{max-height:290px;overflow:auto}' +
    '.lnx .r{display:flex;align-items:center;gap:10px;padding:7px 10px;border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:6px;cursor:pointer;user-select:none}.lnx .r.on{border-color:#06c755;background:#f0fdf4}' +
    '.lnx .av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:15px;flex-shrink:0;color:#fff;font-weight:700}' +
    '.lnx .r b{font-size:14px;display:block;color:#1e293b}.lnx .r small{color:#64748b;font-size:12px}' +
    '.lnx .ck{margin-left:auto;width:22px;height:22px;border-radius:7px;border:2px solid #cbd5e1;flex-shrink:0;position:relative}.lnx .r.on .ck{background:#06c755;border-color:#06c755}.lnx .r.on .ck:after{content:"✓";color:#fff;font-size:14px;font-weight:800;position:absolute;left:4px;top:-1px}' +
    '.lnx .mem{font-size:12.5px;color:#475569;display:flex;gap:6px;align-items:center;margin:6px 0 0}' +
    '.lnx .sb{display:flex;gap:12px;align-items:center;border:1.5px solid #e2e8f0;border-radius:14px;padding:11px 12px;width:100%;background:#fff;cursor:pointer;text-align:left;font-family:inherit;margin-bottom:8px}.lnx .sb:hover{border-color:#86efac}' +
    '.lnx .sb .av{border-radius:12px;width:40px;height:40px;font-size:17px}.lnx .sb b{display:block;font-size:14.5px;color:#1e293b}.lnx .sb small{color:#64748b;font-size:12.5px}' +
    '.lnx .tag{display:inline-block;background:#dcfce7;color:#166534;border-radius:6px;font-size:11px;font-weight:700;padding:0 6px;margin-left:4px}' +
    '.lnx .emp{color:#94a3b8;text-align:center;padding:18px 6px;font-size:13px}.lnx .note{font-size:12px;color:#64748b;margin-top:8px}' +
    '.swal2-popup.lnpop{width:min(560px,96vw)!important;padding:0 0 12px!important}.lnpop .swal2-title{font-size:18px!important;padding:16px 18px 0!important;text-align:left!important}.lnpop .swal2-html-container{margin:8px 16px 0!important}' +
    '.lnpop .swal2-confirm{background:#06c755!important}' +
    '#lnAdm .r{cursor:default}#lnAdm input.nm{border:1.5px solid #e2e8f0;border-radius:8px;padding:4px 8px;font:600 13.5px inherit;font-family:inherit;width:100%;box-sizing:border-box}' +
    '#lnAdm .ac{display:flex;gap:6px;align-items:center;margin-left:auto;flex-shrink:0;font-size:12px}#lnAdm .ac label{display:flex;gap:4px;align-items:center;white-space:nowrap;color:#166534;font-weight:600}' +
    '#lnAdm .ac button{border:0;background:#fef2f2;color:#b91c1c;border-radius:8px;padding:4px 8px;font-weight:700;cursor:pointer}' +
    '@media(max-width:560px){.lnx .lst{max-height:240px}#lnAdm .r{flex-wrap:wrap}#lnAdm .ac{width:100%;justify-content:flex-end}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function targets(cb, admin, refresh) {
    if (!admin && !refresh && T && Date.now() - TT < 5 * 60000) return cb(T);
    google.script.run.withSuccessHandler(function (r) { if (!admin) { T = r || []; TT = Date.now(); } cb(r || []); })
      .withFailureHandler(function (e) { cb(null, e); }).cclLineTargets(!!admin, !!refresh);
  }
  function avatar(t, i) {
    var c = COLORS[i % COLORS.length];
    return '<div class="av" style="background:' + c + '">' + (t.type === 'user' ? esc((t.name.replace(/^[^A-Za-z0-9\u0E01-\u0E2E]+/, '').replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '') || '?').charAt(0).toUpperCase()) : '👥') + '</div>';
  }
  function subOf(t) { return (t.type === 'user' ? 'รายคน' : t.type === 'room' ? 'ห้องแชท' : 'กลุ่ม') + (t.count ? ' · ' + t.count + ' คน' : '') + (t.def ? ' · แจ้งเตือนอัตโนมัติ' : ''); }

  // ───── หน้าต่างส่ง/แชร์ ─────
  function share(o) {
    o = o || {}; var text = String(o.text || '');
    var tab = ls(KTAB) || 'bot', sel = ls(KSEL), q = '', flt = 'all', list = null, err = '';
    var html = '<div class="lnx"><p class="lab">ข้อความที่จะส่ง <span id="lnCnt"></span></p><textarea id="lnTxt"></textarea>' +
      '<div class="tabs"><button data-tab="bot">🤖 ส่งผ่านบอท CCL<small>เลือกกลุ่ม/คน ส่งได้ทันที</small></button><button data-tab="me">📲 แชร์เอง<small>เลือกจากแอป LINE</small></button></div><div id="lnBody"></div></div>';
    Swal.fire({
      title: '<span style="display:inline-flex;gap:10px;align-items:center"><span style="width:32px;height:32px;border-radius:10px;background:#06c755;color:#fff;display:inline-grid;place-items:center;font-weight:800">L</span><span>ส่ง / แชร์ทาง LINE<small style="display:block;font-size:12.5px;color:#64748b;font-weight:500">' + esc(o.sub || o.title || '') + '</small></span></span>',
      html: html, customClass: { popup: 'lnpop' }, showCloseButton: true, showCancelButton: true, cancelButtonText: 'ยกเลิก', confirmButtonText: 'ส่ง', reverseButtons: true, focusConfirm: false,
      didOpen: function () {
        var P = Swal.getHtmlContainer(), ta = P.querySelector('#lnTxt');
        ta.value = text; var cnt = function () { P.querySelector('#lnCnt').textContent = ta.value.length + ' ตัวอักษร'; }; ta.addEventListener('input', cnt); cnt();
        P.querySelector('.tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; ls(KTAB, tab); draw(); } });
        function btn() {
          var c = Swal.getConfirmButton();
          if (tab !== 'bot') { c.style.display = 'none'; Swal.getCancelButton().textContent = 'ปิด'; return; }
          c.style.display = ''; Swal.getCancelButton().textContent = 'ยกเลิก';
          var n = list ? list.filter(function (t) { return sel.indexOf(t.k) >= 0; }).length : 0;
          c.textContent = n ? 'ส่ง → ' + n + ' ปลายทาง' : 'เลือกปลายทางก่อน'; c.disabled = !n;
        }
        function draw() {
          P.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
          var B = P.querySelector('#lnBody');
          if (tab === 'me') {
            B.innerHTML = '<button class="sb" data-s="line"><div class="av" style="background:#06c755">L</div><div><b>แชร์ไปที่ LINE <span class="tag">ฟรี ไม่จำกัด</span></b><small>เปิดแอป LINE → เลือกแชท กลุ่ม หรือเพื่อน (ได้หลายคน) → ส่ง</small></div></button>' +
              (navigator.share ? '<button class="sb" data-s="os"><div class="av" style="background:#2563eb">⇪</div><div><b>แชร์ช่องทางอื่น</b><small>เมนูแชร์ของเครื่อง — LINE, Messenger, อีเมล …</small></div></button>' : '') +
              '<button class="sb" data-s="copy"><div class="av" style="background:#64748b">⧉</div><div><b>คัดลอกข้อความ</b><small>ไปวางเองในแชทไหนก็ได้</small></div></button>' +
              '<div class="note">ข้อความมีลิงก์เข้า CCL ต่อท้ายให้แล้ว</div>';
          } else if (!list) {
            B.innerHTML = '<div class="emp">' + (err ? 'โหลดรายชื่อไม่ได้: ' + esc(err) : 'กำลังโหลดรายชื่อ…') + '</div>';
          } else if (!list.length) {
            B.innerHTML = '<div class="emp">ยังไม่มีปลายทางของบอท — ให้ Admin เพิ่มที่หน้า Admin → LINE<br>หรือใช้แท็บ "แชร์เอง"</div>';
          } else {
            var ng = list.filter(function (t) { return t.type !== 'user'; }).length;
            B.innerHTML = (list.length > 5 ? '<input class="srch" id="lnQ" placeholder="🔍 ค้นหากลุ่มหรือรายชื่อ…" value="' + esc(q) + '">' : '') +
              '<div class="chips"><button data-f="all">ทั้งหมด ' + list.length + '</button><button data-f="g">👥 กลุ่ม ' + ng + '</button><button data-f="u">👤 รายคน ' + (list.length - ng) + '</button><button data-f="none" style="margin-left:auto">ล้างที่เลือก</button></div><div class="lst" id="lnL"></div>' +
              '<label class="mem"><input type="checkbox" id="lnMem" checked> จำการเลือกนี้ไว้ใช้ครั้งหน้า</label>';
            var Q = B.querySelector('#lnQ'); if (Q) Q.addEventListener('input', function () { q = Q.value; rows(); });
            B.querySelector('.chips').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; if (b.dataset.f === 'none') sel = []; else flt = b.dataset.f; rows(); btn(); });
            B.querySelector('#lnL').addEventListener('click', function (e) { var r = e.target.closest('[data-k]'); if (!r) return; var k = r.dataset.k, i = sel.indexOf(k); if (i >= 0) sel.splice(i, 1); else sel.push(k); r.classList.toggle('on', i < 0); btn(); });
            rows();
          }
          btn();
        }
        function rows() {
          var L = P.querySelector('#lnL'); if (!L) return;
          P.querySelectorAll('.chips [data-f]').forEach(function (b) { b.classList.toggle('on', b.dataset.f === flt); });
          var a = list.filter(function (t) { return (flt === 'all' || (flt === 'g') === (t.type !== 'user')) && (!q || t.name.toLowerCase().indexOf(q.toLowerCase()) >= 0); });
          L.innerHTML = a.length ? a.map(function (t) { return '<div class="r' + (sel.indexOf(t.k) >= 0 ? ' on' : '') + '" data-k="' + t.k + '">' + avatar(t, list.indexOf(t)) + '<div><b>' + esc(t.name) + '</b><small>' + esc(subOf(t)) + '</small></div><div class="ck"></div></div>'; }).join('') : '<div class="emp">ไม่พบ</div>';
        }
        P.querySelector('#lnBody').addEventListener('click', function (e) {
          var b = e.target.closest('[data-s]'); if (!b) return; var t = ta.value;
          if (b.dataset.s === 'line') window.open('https://line.me/R/share?text=' + encodeURIComponent(t), '_blank');
          else if (b.dataset.s === 'os') navigator.share({ text: t }).catch(function () {});
          else copy(t, b);
        });
        draw();
        targets(function (r, e) {
          if (!Swal.isVisible() || !P.isConnected) return;
          if (!r) { err = (e && e.message) || String(e); draw(); return; }
          list = r; var ks = r.map(function (t) { return t.k; });
          sel = Array.isArray(sel) ? sel.filter(function (k) { return ks.indexOf(k) >= 0; }) : r.filter(function (t) { return t.def; }).map(function (t) { return t.k; });
          draw();
        });
      },
      preConfirm: function () {
        var P = Swal.getHtmlContainer(), t = P.querySelector('#lnTxt').value.trim(), mem = P.querySelector('#lnMem');
        if (!t) { Swal.showValidationMessage('ไม่มีข้อความ'); return false; }
        if (mem && mem.checked) ls(KSEL, sel);
        Swal.showLoading();
        LAST = t;
        return new Promise(function (ok) {
          google.script.run.withSuccessHandler(function (r) { ok(r); }).withFailureHandler(function (e) { Swal.hideLoading(); Swal.showValidationMessage((e && e.message) || String(e)); ok(false); }).cclLineSend(sel, t);
        });
      }
    }).then(function (r) {
      if (!r.isConfirmed || !r.value) return;
      var v = r.value;
      var quota = v.fail && v.fail.length && v.fail.every(function (f) { return /\(429\)$/.test(f); });
      if (quota) {
        // โควตาข้อความฟรีของบอทเดือนนี้หมด — ส่งต่อด้วย "แชร์เอง" (ฟรี ไม่ใช้โควตา) และจำไว้ให้เปิดแท็บแชร์เองครั้งถัดไป
        ls(KTAB, 'me');
        Swal.fire({ icon: 'info', title: v.sent ? 'ส่งแล้ว ' + v.sent + ' ปลายทาง · ที่เหลือโควตาหมด' : 'โควตาบอทเดือนนี้หมดแล้ว',
          html: 'บอท CCL ส่งข้อความฟรีได้จำกัดต่อเดือน ตอนนี้ใช้ครบแล้ว (เริ่มใหม่วันที่ 1 ของเดือนหน้า)<br><b>แชร์เองทาง LINE ได้เลย — ฟรี ไม่ใช้โควตา</b>',
          showCancelButton: true, confirmButtonText: '📲 แชร์เองทาง LINE', cancelButtonText: 'ปิด', confirmButtonColor: '#06c755' })
          .then(function (x) { if (x.isConfirmed && LAST) window.open('https://line.me/R/share?text=' + encodeURIComponent(LAST), '_blank'); });
        return;
      }
      if (v.fail && v.fail.length) Swal.fire({ icon: v.sent ? 'warning' : 'error', title: v.sent ? 'ส่งแล้ว ' + v.sent + ' ปลายทาง' : 'ส่งไม่สำเร็จ', html: 'ส่งไม่ได้: ' + esc(v.fail.join(', ')) + '<br><small style="color:#64748b">บอทต้องอยู่ในกลุ่ม หรือผู้รับต้องเพิ่มบอทเป็นเพื่อน</small>' });
      else Swal.fire({ icon: 'success', title: 'ส่ง LINE แล้ว ' + v.sent + ' ปลายทาง', timer: 1800, showConfirmButton: false });
    });
  }
  function copy(t, b) {
    var done = function () { if (b) { var s = b.querySelector('small'); if (s) s.textContent = '✓ คัดลอกแล้ว — ไปวางในแชทได้เลย'; } };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () { fb(); }); else fb();
    function fb() { var x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); try { document.execCommand('copy'); done(); } catch (e) {} x.remove(); }
  }
  window.cclLineShare = share;

  // ───── ข้อความติดตามงาน (แทน sendFollowUpLine เดิม) ─────
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function nowTh() { var d = new Date(); return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' น.'; }
  function num(v) { return String(v || '').split(',').reduce(function (s, x) { return s + (parseFloat(String(x).replace(/[^\d.\-]/g, '')) || 0); }, 0); }
  function followText(ids) {
    var data = g('allData', []) || [], jobs = ids.map(function (id) { return data.find(function (d) { return d.id == id; }); }).filter(Boolean);
    var m = '📋 รายงานติดตามงาน CCL\n🕒 ' + nowTh() + ' · ' + jobs.length + ' งาน\n';
    jobs.forEach(function (d, i) {
      var budget = num(d.laborCost) + num(d.supervisionCost) + num(d.miscCost) || num(d.budget), spent = 0;
      (Array.isArray(d.expenses) ? d.expenses : []).forEach(function (e) { spent += parseFloat(e.amount) || 0; });
      var code = String(d.jobStatus || '').trim(), info = window.cclCode && code ? cclCode.info(code) : null;
      var days = d.receiveDate ? Math.floor((Date.now() - new Date(d.receiveDate)) / 864e5) : null;
      m += '\n' + (i + 1) + ') ' + (d.receiveNo || '-') + ' ' + (d.jobName || '') + '\n';
      m += '   📌 ' + (d.status || '-') + (code ? ' · ' + code + (info && info.t ? ' ' + info.t : '') : '') + '\n';
      if (d.assignee || d.responsibleEntity) m += '   👷 ' + [d.assignee, d.responsibleEntity].filter(Boolean).join(' · ') + '\n';
      if (budget) m += '   💰 เบิกแล้ว ' + Math.round(spent / budget * 100) + '% · คงเหลือ ' + Math.round(budget - spent).toLocaleString('th-TH') + ' บาท\n';
      if (days != null && !isNaN(days)) m += '   ⏱ อายุงาน ' + days + ' วัน' + (d.location ? ' · 📍 ' + d.location : '') + '\n';
    });
    return m + '\n🔗 ' + APP;
  }
  function sendDetailToLine() {
    var ids = g('currentDetailIds', []) || [];
    if (!ids.length) { Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'ไม่พบรายการที่จะส่ง', timer: 2000 }); return; }
    share({ sub: 'รายงานติดตามงาน ' + ids.length + ' รายการ', text: followText(ids) });
  }
  function hook() { if (window.sendDetailToLine !== sendDetailToLine) window.sendDetailToLine = sendDetailToLine; }
  hook(); setTimeout(hook, 1500);
  setTimeout(function () { try { if (g('currentUser', {}) && g('currentUser', {}).role && window.google && google.script) targets(function () {}); } catch (e) {} }, 4000); // โหลดรายชื่อไว้ก่อน document.addEventListener('DOMContentLoaded', hook);

  // ───── หน้า Admin: รายการปลายทางของบอท ─────
  var ADM = [], SEEN = [];
  function ago(v) { var m = Math.round((Date.now() - new Date(v)) / 60000); return isNaN(m) ? '' : m < 60 ? m + ' นาทีที่แล้ว' : m < 1440 ? Math.round(m / 60) + ' ชม.ที่แล้ว' : Math.round(m / 1440) + ' วันที่แล้ว'; }
  function seenRows() {
    var S = document.getElementById('lnSeen'); if (!S) return;
    S.innerHTML = SEEN.length ? '<p class="lab" style="margin-top:10px">🆕 บอทพบใหม่ — กด ＋ เพื่อเพิ่มเป็นปลายทาง</p>' + SEEN.map(function (t, i) {
      return '<div class="r" style="border-style:dashed">' + avatar({ type: t.type, name: t.name || '?' }, i + 3) + '<div style="flex:1;min-width:0"><b>' + esc(t.name || (t.type === 'user' ? 'ผู้ใช้' : 'กลุ่ม') + ' ' + t.mask) + '</b><small>' +
        esc((t.type === 'user' ? 'รายคน' : t.type === 'room' ? 'ห้องแชท' : 'กลุ่ม') + (t.count ? ' · ' + t.count + ' คน' : '') + ' · ' + t.mask + ' · ' + ({ join: 'บอทถูกเชิญเข้ากลุ่ม', follow: 'เพิ่มบอทเป็นเพื่อน', message: 'มีข้อความถึงบอท', memberJoined: 'มีสมาชิกเข้ากลุ่ม' }[t.ev] || t.ev || '') + ' ' + ago(t.at)) + '</small></div>' +
        '<div class="ac"><button type="button" data-add="' + i + '" style="background:#dcfce7;color:#166534">＋ เพิ่ม</button></div></div>';
    }).join('') : '';
  }
  function hookGet(r) {
    var H = document.getElementById('lnHook'); if (!H) return;
    var show = function (h) {
      if (!h) return;
      H.innerHTML = h.mine ? '✅ รับ ID อัตโนมัติ: เปิดอยู่' + (h.active ? '' : ' <b style="color:#b45309">(แต่ปิด "Use webhook" ใน LINE Developers — ต้องเปิดก่อน)</b>') + ' · เชิญบอท' + (h.bot ? ' "' + esc(h.bot) + '"' + (h.basicId ? ' (' + esc(h.basicId) + ')' : '') : '') + ' เข้ากลุ่ม แล้วกด ↻ ดึงชื่อจาก LINE'
        : '⚪ รับ ID อัตโนมัติ: ยังไม่เปิด' + (h.other ? ' <span style="color:#b45309">(ตอนนี้ webhook ของบอทชี้ไปที่ ' + esc(h.otherHost) + ')</span>' : '') + ' <button type="button" data-hook="1" style="border:0;background:#4338ca;color:#fff;border-radius:8px;padding:3px 10px;font-weight:700;cursor:pointer;margin-left:4px">เปิดรับ ID อัตโนมัติ</button>';
      H.dataset.other = h.other ? h.otherHost : '';
    };
    if (r) return show(r);
    google.script.run.withSuccessHandler(show).withFailureHandler(function (e) { H.textContent = 'ตรวจ webhook ไม่ได้: ' + ((e && e.message) || e); }).cclLineHook('get');
  }
  function hookOn() {
    var H = document.getElementById('lnHook'), other = H && H.dataset.other;
    Swal.fire({ icon: other ? 'warning' : 'question', title: 'เปิดรับ ID อัตโนมัติ?', html: 'ตั้ง Webhook ของบอทให้ส่งเหตุการณ์มาที่ CCL — เมื่อบอทถูกเชิญเข้ากลุ่มหรือมีข้อความถึงบอท จะเห็นในรายการ "บอทพบใหม่"' + (other ? '<br><br><b style="color:#b91c1c">ตอนนี้ webhook ชี้ไปที่ ' + esc(other) + ' — ถ้ามีระบบอื่นใช้บอทนี้รับข้อความอยู่ ระบบนั้นจะหยุดรับ</b>' : ''), showCancelButton: true, confirmButtonText: 'เปิด', cancelButtonText: 'ยกเลิก' })
      .then(function (x) { if (!x.isConfirmed) return; H.textContent = 'กำลังตั้งค่า…'; google.script.run.withSuccessHandler(function (r) { hookGet(r); }).withFailureHandler(function (e) { H.textContent = 'ตั้งค่าไม่สำเร็จ: ' + ((e && e.message) || e); }).cclLineHook('set'); });
  }
  function adminBox() {
    var inp = document.getElementById('lineTargetsInput'); if (!inp || document.getElementById('lnAdm')) return;
    var row = inp.closest('.flex.gap-2'); if (row) row.style.display = 'none';
    var box = document.createElement('div'); box.id = 'lnAdm'; box.className = 'lnx'; box.style.margin = '4px 0 10px';
    box.innerHTML = '<p class="lab">🎯 ปลายทาง LINE ของบอท CCL <span>✓ = ได้รับแจ้งเตือนอัตโนมัติด้วย</span></p><div id="lnHook" style="font-size:12.5px;margin:-2px 0 8px;color:#475569">กำลังตรวจการรับ ID อัตโนมัติ…</div><div id="lnAL"><div class="emp">กำลังโหลด…</div></div><div id="lnSeen"></div>' +
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap"><input class="srch" id="lnNewId" style="flex:2;min-width:200px;margin:0" placeholder="วาง Group ID (C…) หรือ User ID (U…)"><input class="srch" id="lnNewNm" style="flex:1;min-width:120px;margin:0" placeholder="ชื่อเรียก (ไม่ใส่ก็ได้)">' +
      '<button type="button" id="lnAdd" class="bg-blue-600 text-white px-3 py-2 rounded-lg font-bold">＋ เพิ่ม</button></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end"><button type="button" id="lnRef" class="px-3 py-2 rounded-lg font-bold" style="border:1.5px solid #c7d2fe;background:#fff;color:#4338ca">↻ ดึงชื่อจาก LINE</button><button type="button" id="lnSave" class="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">บันทึกปลายทาง</button></div>';
    (row || inp).parentNode.insertBefore(box, row ? row.nextSibling : null);
    box.querySelector('#lnAdd').onclick = function () {
      var id = box.querySelector('#lnNewId').value.trim(), nm = box.querySelector('#lnNewNm').value.trim();
      if (!/^[CUR][0-9a-f]{32}$/.test(id)) { Swal.fire({ icon: 'warning', title: 'ID ไม่ถูกต้อง', text: 'ต้องขึ้นต้นด้วย C (กลุ่ม) หรือ U (ผู้ใช้) ตามด้วยตัวอักษร 32 ตัว' }); return; }
      ADM.push({ id: id, name: nm, def: false, type: id[0] === 'U' ? 'user' : 'group', mask: id.slice(0, 5) + '…' + id.slice(-3), isNew: 1 });
      box.querySelector('#lnNewId').value = ''; box.querySelector('#lnNewNm').value = ''; adminRows();
    };
    box.querySelector('#lnRef').onclick = function () { adminLoad(true); };
    box.querySelector('#lnSave').onclick = adminSave;
    box.querySelector('#lnSeen').addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]'); if (!b) return; var t = SEEN[+b.dataset.add]; if (!t) return;
      SEEN.splice(+b.dataset.add, 1); ADM.push({ id: t.id, name: t.name, lineName: t.lineName, def: false, type: t.type, count: t.count, mask: t.mask, isNew: 1 }); adminRows(); seenRows();
    });
    box.querySelector('#lnHook').addEventListener('click', function (e) { if (e.target.closest('[data-hook]')) hookOn(); });
    hookGet();
    box.querySelector('#lnAL').addEventListener('input', function (e) { var i = e.target.closest('[data-i]'); if (!i) return; var o = ADM[+i.dataset.i]; if (e.target.classList.contains('nm')) o.name = e.target.value; });
    box.querySelector('#lnAL').addEventListener('change', function (e) { var i = e.target.closest('[data-i]'); if (i && e.target.type === 'checkbox') ADM[+i.dataset.i].def = e.target.checked; });
    box.querySelector('#lnAL').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; var o = ADM[+b.dataset.del]; o.del = !o.del; adminRows(); });
    adminLoad(false);
  }
  function adminLoad(refresh) {
    var L = document.getElementById('lnAL'); if (L) L.innerHTML = '<div class="emp">กำลังโหลด…</div>';
    targets(function (r, e) { if (!r) { L.innerHTML = '<div class="emp">โหลดไม่ได้: ' + esc((e && e.message) || e) + '</div>'; return; } SEEN = r.filter(function (t) { return t.seen; }); r = r.filter(function (t) { return !t.seen; }); seenRows(); ADM = r.map(function (t) { var n = t.name; return { k: t.k, name: t.lineName && n === t.lineName ? '' : n, lineName: t.lineName, def: t.def, type: t.type, count: t.count, mask: t.mask }; }); adminRows(); }, true, refresh);
  }
  function adminRows() {
    var L = document.getElementById('lnAL'); if (!L) return;
    L.innerHTML = ADM.length ? ADM.map(function (t, i) {
      return '<div class="r" data-i="' + i + '" style="' + (t.del ? 'opacity:.45;text-decoration:line-through' : '') + '">' + avatar({ type: t.type, name: t.name || t.lineName || '?' }, i) +
        '<div style="flex:1;min-width:0"><input class="nm" value="' + esc(t.name) + '" placeholder="' + esc(t.lineName || 'ตั้งชื่อเรียก') + '"><small>' + esc((t.type === 'user' ? 'รายคน' : 'กลุ่ม') + (t.count ? ' · ' + t.count + ' คน' : '') + ' · ' + (t.mask || '') + (t.lineName ? ' · ชื่อใน LINE: ' + t.lineName : '') + (t.isNew ? ' · ใหม่ (ยังไม่บันทึก)' : '')) + '</small></div>' +
        '<div class="ac"><label><input type="checkbox"' + (t.def ? ' checked' : '') + '> แจ้งเตือนอัตโนมัติ</label><button type="button" data-del="' + i + '">' + (t.del ? 'คืน' : 'ลบ') + '</button></div></div>';
    }).join('') : '<div class="emp">ยังไม่มีปลายทาง</div>';
  }
  function adminSave() {
    var items = ADM.map(function (t) { return t.k ? { k: t.k, name: t.name, def: t.def, del: !!t.del } : { id: t.id, name: t.name, def: t.def, del: !!t.del }; });
    if (!items.some(function (t) { return t.def && !t.del; }) && !confirm('ยังไม่มีปลายทางที่ "แจ้งเตือนอัตโนมัติ" — การแจ้งเตือนอัตโนมัติจะไม่ถูกส่งไปไหนเลย บันทึกต่อไหม?')) return;
    Swal.fire({ title: 'กำลังบันทึก…', allowOutsideClick: false, showConfirmButton: false, didOpen: function () { Swal.showLoading(); } });
    google.script.run.withSuccessHandler(function (r) { T = null; Swal.fire({ icon: 'success', title: 'บันทึกปลายทางแล้ว', text: 'แจ้งเตือนอัตโนมัติ ' + r.def + ' · เลือกส่งเพิ่มเติม ' + r.ex, timer: 1800, showConfirmButton: false }); adminLoad(false); })
      .withFailureHandler(function (e) { Swal.fire({ icon: 'error', title: 'บันทึกไม่ได้', text: (e && e.message) || String(e) }); }).cclLineSave(items);
  }
  var os = window.showPage;
  if (typeof os === 'function' && !os.__ln) { var w = function (id) { var r = os.apply(this, arguments); if (id === 'admin') setTimeout(adminBox, 300); return r; }; w.__ln = 1; for (var k in os) w[k] = os[k]; window.showPage = w; }
})();
