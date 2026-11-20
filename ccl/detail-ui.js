/* detail-ui.js — popup รายละเอียดงาน แบบใหม่
   - หัวการ์ด: เลขที่ ชื่องาน สถานะ สถานะงาน(Job Code) วันส่งมอบ + ปุ่มแก้ไข/เปลี่ยนสถานะ
   - แถบความคืบหน้า Job Code (B2 → F4) บอกขั้นที่ตัดงบ/ตรวจรับ/ส่งปิดได้
   - ข้อมูลงานแบบตารางกระชับ, งบแต่ละโครงข่ายแบบแถบ, เอกสารแนบ
   - ใช้ฟังก์ชัน/ไทม์ไลน์/วัสดุ/ผู้รับจ้างของเดิมทั้งหมด (แค่จัดหน้าใหม่) */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function g(n, d) { try { return eval(n); } catch (e) { return d; } }
  var TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function dth(v) {
    if (!v) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v)), d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v);
    if (isNaN(d)) return String(v);
    return d.getDate() + ' ' + TH_M[d.getMonth()] + ' ' + String(d.getFullYear() + 543).slice(-2);
  }
  function days(a, b) { a = new Date(a); if (isNaN(a)) return null; return Math.ceil(((b || new Date()) - a) / 86400000); }
  function n0(v) { return (Number(v) || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 }); }
  var CODES = ['B2', 'C1', 'C3', 'C4', 'C5', 'D1', 'D2', 'F4'];
  var GATE = { C1: 'ตัดงบได้', D1: 'ตรวจรับได้', D2: 'ส่งปิดได้' };
  var ST = {
    'รับเรื่อง': ['📥', '#7c3aed', '#f3e8ff'], 'สำรวจงาน': ['🔎', '#a16207', '#fef9c3'], 'ดำเนินงาน': ['⚙️', '#c2410c', '#ffedd5'],
    'ตรวจรับงาน': ['📋', '#1d4ed8', '#dbeafe'], 'ส่งปิดงาน': ['📨', '#7e22ce', '#f3e8ff'], 'ปิดงานแล้วเสร็จ': ['✅', '#15803d', '#dcfce7'],
    'อนุมัติ/เสร็จสิ้น': ['✅', '#15803d', '#dcfce7'], 'ยกเลิก': ['⛔', '#b91c1c', '#fee2e2']
  };
  var TL = { labor: 'ค่าแรง', supervision: 'ค่าคุมงาน', misc: 'ค่าเบ็ดเตล็ด' };
  var TC = { labor: '#2563eb', supervision: '#7c3aed', misc: '#d97706' };
  function ok(code, min) { return window.cclCode ? window.cclCode.ok(code, min) : true; }

  function css() {
    if ($('dmxCss')) return;
    var s = document.createElement('style'); s.id = 'dmxCss';
    s.textContent =
      '#detailModal.dmx>div{max-width:1040px;height:92vh;border-radius:18px;background:#f8fafc}' +
      '#detailModal.dmx>div>div:first-child{display:none !important}' +
      '#detailModal.dmx .dmx-hd{background:linear-gradient(135deg,#1e293b,#312e81);color:#fff;padding:13px 18px 12px;flex-shrink:0}' +
      '.dmx-t1{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#c7d2fe}' +
      '.dmx-no{background:rgba(255,255,255,.14);color:#fff;font-weight:700;border-radius:7px;padding:2px 9px;font-family:"IBM Plex Mono",monospace;font-size:13px}' +
      '.dmx-x{margin-left:auto;display:flex;gap:6px}' +
      '.dmx-hb{border:0;border-radius:9px;padding:7px 12px;font-weight:600;font-size:13px;color:#fff;background:rgba(255,255,255,.14);cursor:pointer;display:inline-flex;gap:6px;align-items:center}' +
      '.dmx-hb:hover{background:rgba(255,255,255,.24)}.dmx-hb.o{background:#f97316}.dmx-hb.o:hover{background:#ea580c}' +
      '.dmx-hd h2{margin:6px 0 8px;font-size:20px;line-height:1.35;font-weight:700}' +
      '.dmx-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
      '.dmx-cp{border-radius:999px;padding:3px 11px;font-size:12.5px;font-weight:600}' +
      '.dmx-code{display:inline-flex;align-items:center;gap:6px;background:#fef9c3;color:#854d0e;border-radius:9px;padding:3px 10px;font-weight:700;font-size:13px}.dmx-code b{font-size:16px}' +
      '.dmx-step{background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:10px 14px;margin-bottom:12px}' +
      '.dmx-step .h{display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap;font-size:12.5px;color:#64748b;margin-bottom:8px}.dmx-step .h b{color:#7c3aed}' +
      '.dmx-sr{display:grid;grid-template-columns:repeat(8,1fr);gap:4px}' +
      '.dmx-s{text-align:center;font-size:12px;font-weight:700;color:#94a3b8}' +
      '.dmx-s i{display:block;height:6px;border-radius:9px;background:#e2e8f0;margin-bottom:4px}' +
      '.dmx-s.ok{color:#16a34a}.dmx-s.ok i{background:#22c55e}' +
      '.dmx-s.now{color:#ca8a04}.dmx-s.now i{background:#facc15;box-shadow:0 0 0 3px #fef08a}' +
      '.dmx-s small{display:block;font-size:10.5px;font-weight:600;color:#7c3aed;margin-top:1px}' +
      '#detailModal.dmx .card{border-radius:14px !important;border:1px solid #e2e8f0 !important;border-left-width:1px !important;box-shadow:none !important;padding:12px 14px !important;background:#fff !important}' +
      '#detailModal.dmx .card h4{border:0 !important;padding-bottom:0 !important;margin-bottom:10px !important;font-size:14px;color:#1e293b !important}' +
      '#detailModal.dmx .flex-1.overflow-y-auto{padding:12px 14px !important}' +
      '#detailModal.dmx .grid.lg\\:grid-cols-3{gap:12px !important}' +
      '#detailModal.dmx .space-y-5>*+*{margin-top:12px !important}' +
      '.dmx-h3{margin:0 0 10px;font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px}.dmx-h3 span{margin-left:auto;font-size:12px;color:#64748b;font-weight:500}' +
      '.dmx-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 14px}' +
      '.dmx-kv>div small{display:block;font-size:11.5px;color:#94a3b8}' +
      '.dmx-kv>div>b{font-size:13.5px;font-weight:600;display:block;word-break:break-word}' +
      '.dmx-mono{font-family:"IBM Plex Mono",monospace;color:#1d4ed8;font-size:12.5px !important}' +
      '.dmx-mini{border:1px solid #e2e8f0;background:#fff;border-radius:7px;padding:1px 7px;font-size:11.5px;color:#475569;margin-left:4px;cursor:pointer;font-weight:500;white-space:nowrap;text-decoration:none;display:inline-block}' +
      '.dmx-mini:hover{background:#f1f5f9}' +
      '.dmx-net{border-top:1px dashed #e2e8f0;padding-top:9px;margin-top:9px}.dmx-net:first-of-type{border:0;margin:0;padding:0}' +
      '.dmx-nid{font-family:"IBM Plex Mono",monospace;color:#1d4ed8;font-weight:700;font-size:13px}' +
      '.dmx-tr{display:grid;grid-template-columns:96px minmax(0,1fr) auto;gap:4px 10px;align-items:center;margin-top:7px;font-size:12.5px}' +
      '.dmx-tr .ty{font-weight:600}.dmx-tr .ty small{display:block;color:#94a3b8;font-weight:500;font-size:11px}' +
      '.dmx-bar{height:8px;border-radius:9px;background:#e2e8f0;overflow:hidden}.dmx-bar i{display:block;height:100%;border-radius:9px}' +
      '.dmx-leg{font-size:11.5px;color:#64748b;margin-top:3px}.dmx-leg b{color:#1e293b}' +
      '.dmx-btn{border:1px solid #e2e8f0;background:#fff;border-radius:9px;padding:6px 11px;font-weight:600;font-size:12.5px;color:#334155;display:inline-flex;gap:5px;align-items:center;cursor:pointer;white-space:nowrap}' +
      '.dmx-btn:hover{background:#f8fafc}.dmx-btn.p{background:#2563eb;color:#fff;border-color:#2563eb}.dmx-btn.p:hover{background:#1d4ed8}' +
      '.dmx-btn.v{background:#7c3aed;color:#fff;border-color:#7c3aed}.dmx-btn.lock{background:#f1f5f9;color:#94a3b8}' +
      '.dmx-tot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px;background:#eef2ff;border-radius:10px;padding:8px 12px;margin-top:10px;font-size:13px}.dmx-tot b{font-size:15px;color:#4338ca}' +
      '.dmx-att{display:flex;flex-wrap:wrap;gap:6px}' +
      '.dmx-att a{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 9px;font-size:12.5px;color:#334155;text-decoration:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.dmx-att a:hover{background:#eff6ff}' +
      '.dmx-ft{flex-shrink:0;background:#fff;border-top:1px solid #e2e8f0;padding:9px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
      '.dmx-ft .sp{flex:1}.dmx-hint{font-size:12.5px;color:#7c3aed;background:#f5f3ff;border-radius:9px;padding:6px 10px}.dmx-hint.g{color:#15803d;background:#f0fdf4}' +
      '#detailModal.dmx #tabMaterial,#detailModal.dmx #tabTimeline,#detailModal.dmx #tabContractor{border-radius:8px !important;font-size:12.5px !important;padding:6px !important}' +
      '#detailModal.dmx .flex.gap-1.mb-3{background:#f1f5f9;border-radius:10px;padding:3px}' +
      '#detailModal.dmx #tabMaterial.bg-blue-600,#detailModal.dmx #tabTimeline.bg-blue-600,#detailModal.dmx #tabContractor.bg-blue-600{background:#fff !important;color:#1e293b !important;box-shadow:0 1px 3px rgba(0,0,0,.12)}' +
      '#detailModal.dmx #timelineContent,#detailModal.dmx #contractorUpdatesContent,#detailModal.dmx #materialContent{max-height:none !important}' +
      '#detailModal.dmx .lg\\:col-span-1>.card>h4{display:none !important}' +
      '@media(max-width:700px){#detailModal.dmx{padding:0 !important}#detailModal.dmx>div{height:100%;max-height:100%;border-radius:0}' +
      '.dmx-x{order:-1;width:100%;justify-content:flex-end}.dmx-hd h2{font-size:17px}.dmx-kv{grid-template-columns:repeat(2,minmax(0,1fr))}' +
      '.dmx-s{font-size:10.5px}.dmx-s small{font-size:9px}.dmx-tr{grid-template-columns:78px minmax(0,1fr)}.dmx-tr>.dmx-btn{grid-column:1/-1;justify-self:end}' +
      '.dmx-ft .dmx-hint{width:100%}#detailModal.dmx .flex-1.overflow-y-auto{padding:10px !important}}';
    document.head.appendChild(s);
  }

  function nets(job) {
    var split = function (s, num) { return String(s || '').split(',').map(function (v) { return num ? (parseFloat(String(v).replace(/,/g, '')) || 0) : v.trim(); }); };
    var ns = String(job.networkId || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var lc = split(job.laborCost, 1), lk = split(job.laborCode), sc = split(job.supervisionCost, 1), sk = split(job.supervisionCode), mc = split(job.miscCost, 1), mk = split(job.miscCode);
    var ex = job.expenses || []; if (typeof ex === 'string') { try { ex = JSON.parse(ex); } catch (e) { ex = []; } } if (!Array.isArray(ex)) ex = [];
    return ns.map(function (id, i) {
      var rows = [['labor', lc[i] || 0, lk[i] || '0030'], ['supervision', sc[i] || 0, sk[i] || '0040'], ['misc', mc[i] || 0, mk[i] || '0060']].filter(function (d) { return d[1] > 0; }).map(function (d) {
        var mine = ex.filter(function (e) { return Number(e.netIdx) === i && e.type === d[0]; });
        var spent = mine.reduce(function (s, e) { return s + (parseFloat(e.amount) || 0); }, 0);
        return { type: d[0], budget: d[1], code: d[2], spent: spent, n: mine.length };
      });
      return { id: id, idx: i, rows: rows };
    });
  }

  function decorate(id) {
    var job = (g('allData', []) || []).find(function (j) { return j.id === id; }); if (!job) return;
    var M = $('detailModal'); if (!M) return; css(); M.classList.add('dmx');
    var panel = M.firstElementChild, scroll = panel.querySelector('.flex-1.overflow-y-auto');
    var code = String(job.jobStatus || '').trim(), ci = CODES.indexOf(code.toUpperCase());
    var st = ST[job.status] || ['•', '#475569', '#f1f5f9'];
    var age = days(job.receiveDate), due = job.payDate ? days(new Date(), new Date(job.payDate)) : null;
    var closed = /ปิดงานแล้วเสร็จ|อนุมัติ\/เสร็จสิ้น|ยกเลิก/.test(job.status || '');

    // ===== หัวการ์ด =====
    var hd = panel.querySelector('.dmx-hd');
    if (!hd) { hd = document.createElement('div'); hd.className = 'dmx-hd'; panel.insertBefore(hd, panel.children[1]); }
    hd.innerHTML =
      '<div class="dmx-t1"><span class="dmx-no">' + esc(job.receiveNo || '-') + '</span>' +
        (job.receiveDate ? 'รับเรื่อง ' + esc(dth(job.receiveDate)) : '') + (age != null && !closed ? ' · อายุงาน ' + age + ' วัน' : '') +
        '<div class="dmx-x"><button class="dmx-hb o" onclick="handleDetailEdit()"><i class="fa-solid fa-pen"></i>แก้ไข</button>' +
        '<button class="dmx-hb" onclick="handleDetailChangeStatus()"><i class="fa-solid fa-rotate"></i>เปลี่ยนสถานะ</button>' +
        '<button class="dmx-hb" onclick="closeDetailModal()" title="ปิด"><i class="fa-solid fa-xmark"></i></button></div></div>' +
      '<h2>' + esc(job.jobName || '-') + '</h2>' +
      '<div class="dmx-chips"><span class="dmx-cp" style="background:' + st[2] + ';color:' + st[1] + '">' + st[0] + ' ' + esc(job.status || '-') + '</span>' +
        '<span class="dmx-code">📌 สถานะงาน <b>' + esc(code || 'ไม่ระบุ') + '</b></span>' +
        (job.budgetType ? '<span class="dmx-cp" style="background:#e0e7ff;color:#3730a3">' + esc(job.budgetType) + '</span>' : '') +
        (job.payDate ? '<span class="dmx-cp" style="background:rgba(255,255,255,.12);color:' + (due != null && due < 0 && !closed ? '#fecaca' : '#e0e7ff') + '">ส่งมอบ ' + esc(dth(job.payDate)) +
          (due != null && !closed ? (due >= 0 ? ' · อีก ' + due + ' วัน' : ' · เลยมา ' + (-due) + ' วัน') : '') + '</span>' : '') + '</div>';

    // ===== แถบ Job Code =====
    var next = closed ? null : ci < CODES.indexOf('C1') ? 'C1' : (/รับเรื่อง|สำรวจงาน|ดำเนินงาน/.test(job.status) && ci < 5) ? 'D1' : (job.status === 'ตรวจรับงาน' && ci < 6) ? 'D2' : null;
    var step = scroll.querySelector('.dmx-step');
    if (!step) { step = document.createElement('div'); step.className = 'dmx-step'; scroll.insertBefore(step, scroll.firstChild); }
    step.innerHTML = '<div class="h"><span>ความคืบหน้าสถานะงาน (Job Code)' + (ci < 0 && code ? ' · ค่าปัจจุบัน "' + esc(code) + '" ไม่อยู่ในลำดับ' : '') + '</span>' +
      (next ? '<span>ขั้นต่อไป: <b>เปลี่ยนเป็น ' + next + ' → ' + GATE[next] + '</b></span>' : '') + '</div>' +
      '<div class="dmx-sr">' + CODES.map(function (c, i) {
        return '<div class="dmx-s' + (i < ci ? ' ok' : i === ci ? ' now' : '') + '"><i></i>' + c + (GATE[c] ? '<small>' + GATE[c] + '</small>' : '') + '</div>';
      }).join('') + '</div>';

    // ===== ข้อมูลงาน =====
    var co = String(job.coordinates || '').trim();
    var idl = String(job.jobIds || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var ins = job.inspectionStatus || '';
    $('detailInfoContent').innerHTML = '<div class="dmx-h3">📋 ข้อมูลงาน</div><div class="dmx-kv">' +
      '<div style="grid-column:span ' + (idl.length > 1 ? 2 : 1) + '"><small>หมายเลขงาน</small><b class="dmx-mono">' + (idl.length ? idl.map(esc).join('<br>') : '-') +
        (idl.length ? ' <span class="dmx-mini" data-copy="' + esc(idl.join(', ')) + '">คัดลอก</span>' : '') + '</b></div>' +
      '<div><small>ผู้ควบคุมงาน</small><b>' + esc(job.assignee || '-') + '</b></div>' +
      '<div><small>ผู้รับจ้าง / หน่วยงาน</small><b><span>' + esc(job.responsibleEntity || '-') + '</span></b></div>' +
      '<div><small>สถานที่</small><b>' + esc(job.location || '-') + (co ? ' <a class="dmx-mini" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(co) + '">🗺 แผนที่</a>' : '') + '</b></div>' +
      '<div><small>สถานะตรวจรับ</small><b style="color:' + (/ไม่ผ่าน/.test(ins) ? '#dc2626' : /ผ่าน/.test(ins) ? '#16a34a' : '#ca8a04') + '">' + esc(ins || '-') + '</b></div>' +
      '<div><small>วันส่งมอบ</small><b>' + esc(job.payDate ? dth(job.payDate) : '-') + '</b></div>' +
      (job.recorder || job.recordedBy ? '<div><small>ผู้บันทึก</small><b>' + esc(job.recorder || job.recordedBy) + '</b></div>' : '') +
      '</div>';
    var ic = $('detailInfoContent').parentElement; if (ic) ic.style.borderLeftColor = '';

    // ===== งบประมาณ =====
    var N = nets(job), canCut = ok(code, 'C1') && !closed, TB = 0, TS = 0;
    var bh = '<div class="dmx-h3">💰 งบประมาณโครงข่าย <span>' + N.length + ' โครงข่าย</span></div>';
    if (!N.length) bh += '<div style="color:#94a3b8;font-size:13px">ยังไม่ได้ระบุโครงข่าย/งบ</div>';
    N.forEach(function (nt) {
      bh += '<div class="dmx-net"><span class="dmx-nid">Net ' + esc(nt.id) + '</span>';
      if (!nt.rows.length) bh += '<div class="dmx-leg">ยังไม่ได้ระบุงบ</div>';
      nt.rows.forEach(function (r) {
        TB += r.budget; TS += r.spent;
        var pct = r.budget > 0 ? Math.min(100, r.spent / r.budget * 100) : 0, left = r.budget - r.spent;
        bh += '<div class="dmx-tr"><div class="ty" style="color:' + TC[r.type] + '">' + TL[r.type] + '<small>รหัส ' + esc(r.code) + ' · ' + n0(r.budget) + ' บ.</small></div>' +
          '<div><div class="dmx-bar"><i style="width:' + pct.toFixed(1) + '%;background:' + (pct > 95 ? '#dc2626' : TC[r.type]) + '"></i></div>' +
          '<div class="dmx-leg">ตัดแล้ว <b>' + n0(r.spent) + '</b>' + (r.n ? ' (' + r.n + ' ครั้ง)' : '') + ' · คงเหลือ <b style="color:' + (left > 0 ? '#16a34a' : '#dc2626') + '">' + n0(left) + '</b></div></div>' +
          (closed ? '<span></span>' : canCut
            ? '<button class="dmx-btn p" onclick="openCutBudgetFromTable(' + job.id + ',\'' + esc(nt.id) + '\',' + nt.idx + ',\'' + r.type + '\',\'' + TL[r.type] + '\',' + left + ')"><i class="fa-solid fa-scissors"></i>ตัดงบ</button>'
            : '<button class="dmx-btn lock" onclick="cclCode.warn(' + job.id + ',\'C1\')"><i class="fa-solid fa-lock"></i>ต้อง C1</button>') + '</div>';
      });
      bh += '</div>';
    });
    if (TB > 0) bh += '<div class="dmx-tot"><span>งบรวม ' + n0(TB) + ' · ใช้ไป ' + n0(TS) + ' (' + Math.round(TS / TB * 100) + '%)</span><b>คงเหลือ ' + n0(TB - TS) + ' บาท</b></div>';
    $('detailBudgetContent').innerHTML = bh;
    $('detailBudgetContent').style.display = 'block';
    var bc = $('detailBudgetContent').closest('.card'); if (bc) {
      var h4 = bc.querySelector('h4'); if (h4) h4.style.display = 'none';
      var mc = $('detailMaterialsContent') && $('detailMaterialsContent').closest('.card');
      if (mc && mc.parentElement === bc.parentElement && mc.compareDocumentPosition(bc) & Node.DOCUMENT_POSITION_FOLLOWING) bc.parentElement.insertBefore(bc, mc);
    }

    // ===== เอกสารแนบ =====
    var atts = []; try { atts = JSON.parse(job.attachments || '[]'); } catch (e) { atts = []; } if (!Array.isArray(atts)) atts = [];
    var ac = scroll.querySelector('.dmx-attc');
    if (atts.length) {
      if (!ac) { ac = document.createElement('div'); ac.className = 'card dmx-attc'; var col = bc ? bc.parentElement : null; if (col) col.appendChild(ac); }
      if (ac) ac.innerHTML = '<div class="dmx-h3">📎 เอกสารแนบ <span>' + atts.length + ' ไฟล์</span></div><div class="dmx-att">' + atts.map(function (a) {
        return '<a href="' + esc(a.fileUrl) + '" target="_blank" rel="noopener">' + (a.mimeType === 'application/pdf' ? '📄 ' : /image/.test(a.mimeType || '') ? '🖼 ' : '📎 ') + esc(a.fileName || 'ไฟล์') + '</a>';
      }).join('') + '</div>';
    } else if (ac) ac.remove();

    // ===== แถบล่าง =====
    var ft = panel.querySelector('.dmx-ft');
    if (!ft) { ft = document.createElement('div'); ft.className = 'dmx-ft'; panel.appendChild(ft); }
    var hint = '', act = '';
    if (!closed && job.status !== 'ตรวจรับงาน' && job.status !== 'ส่งปิดงาน') {
      if (ok(code, 'D1')) { hint = '<span class="dmx-hint g">✓ สถานะงาน ' + esc(code) + ' — ส่งตรวจรับได้</span>'; act = '<button class="dmx-btn v" onclick="handleDetailChangeStatus()"><i class="fa-solid fa-clipboard-check"></i>ส่งตรวจรับ</button>'; }
      else { hint = '<span class="dmx-hint">🔒 ส่งตรวจรับได้เมื่อสถานะงานเป็น D1</span>'; act = '<button class="dmx-btn lock" onclick="cclCode.warn(' + job.id + ',\'D1\')"><i class="fa-solid fa-lock"></i>ส่งตรวจรับ</button>'; }
    } else if (job.status === 'ตรวจรับงาน') {
      hint = ok(code, 'D2') ? '<span class="dmx-hint g">✓ สถานะงาน ' + esc(code) + ' — ส่งปิดงานได้เมื่อผ่านตรวจรับ/มาตรฐาน</span>' : '<span class="dmx-hint">🔒 ส่งปิดงานได้เมื่อสถานะงานเป็น D2</span>';
      act = '<button class="dmx-btn v" onclick="closeDetailModal();showPage(\'inspection\')"><i class="fa-solid fa-clipboard-check"></i>ไปหน้าตรวจรับ</button>';
    }
    ft.innerHTML = hint + '<span class="sp"></span>' +
      (closed ? '' : '<button class="dmx-btn" data-line="' + job.id + '"><i class="fa-brands fa-line" style="color:#06c755"></i>ส่ง LINE ติดตาม</button>') + act;
  }

  function boot() {
    var o = window.openDetailModal; if (typeof o !== 'function' || o.__dmx) return;
    var w = function (id) { var r = o.apply(this, arguments); try { decorate(id); } catch (e) { console.error('detail-ui', e); } return r; };
    w.__dmx = 1; window.openDetailModal = w;
    document.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('#detailModal [data-copy]');
      if (c) { try { navigator.clipboard.writeText(c.dataset.copy); c.textContent = 'คัดลอกแล้ว ✓'; setTimeout(function () { c.textContent = 'คัดลอก'; }, 1500); } catch (x) {} return; }
      var l = e.target.closest && e.target.closest('#detailModal [data-line]');
      if (l && typeof window.sendDetailToLine === 'function') { try { eval('currentDetailIds = [' + Number(l.dataset.line) + ']'); } catch (x) {} window.sendDetailToLine(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 1500);
})();
