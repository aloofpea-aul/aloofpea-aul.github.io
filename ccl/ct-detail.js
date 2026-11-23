/* Contractor Portal — หน้างานแบบใหม่ (ส่วนที่ 2)
   - หัวงาน: ชื่องาน เลขที่ หมายเลขงาน สถานที่ + ขั้นงาน 5 ขั้น
   - ปุ่มใหญ่ 4 ปุ่ม: อัปเดตงาน / แจ้งส่งมอบ / วัสดุ-เสา / แจ้งปัญหา (+ บันทึกทั่วไป · ส่งรูป · พิมพ์รายงาน)
   - แท็บ: ไทม์ไลน์ / วัสดุ / ข้อมูลงาน / รูป — ไม่ต้องเลื่อนยาว
   ใช้เนื้อหาที่ renderDetail เดิมสร้าง แล้วจัดวางใหม่ (การบันทึกข้อมูลเหมือนเดิมทุกอย่าง) */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var TAB = 'tl', LAST = null;

  var css =
    '.dx-h{background:#fff;border-radius:18px;padding:14px 15px 12px;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px}' +
    '.dx-h .n{font-size:17px;font-weight:800;line-height:1.35;color:#1E293B}.dx-h .s{font-size:12.5px;color:#64748B;margin-top:3px;line-height:1.5}.dx-h .s b{color:#334155;font-weight:700}' +
    '.dx-h .bd{display:inline-block;font-size:11.5px;font-weight:700;border-radius:7px;padding:1px 8px;margin-left:4px}' +
    '.dx-st{display:flex;margin-top:12px}.dx-st div{flex:1;text-align:center;font-size:11px;font-weight:700;color:#94A3B8;position:relative}' +
    '.dx-st div:not(:first-child)::before{content:"";position:absolute;top:11px;right:50%;width:100%;height:3px;background:#E2E8F0;z-index:0}.dx-st div.d::before,.dx-st div.c::before{background:#0D9488}' +
    '.dx-st b{position:relative;z-index:1;display:block;width:24px;height:24px;border-radius:50%;margin:0 auto 3px;background:#E2E8F0;color:#fff;line-height:24px;font-size:11.5px}' +
    '.dx-st .d{color:#0F766E}.dx-st .d b{background:#0D9488}.dx-st .c{color:#B45309}.dx-st .c b{background:#F59E0B;box-shadow:0 0 0 4px #FEF3C7}' +
    '.dx-big{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:8px}' +
    '.dx-big button{background:#fff;border:1.5px solid transparent;border-radius:15px;padding:11px;display:flex;gap:10px;align-items:center;text-align:left;font:800 14px inherit;font-family:inherit;color:#1E293B;box-shadow:0 1px 3px rgba(0,0,0,.06);cursor:pointer}' +
    '.dx-big button:hover{border-color:#99F6E4}.dx-big button:active{transform:scale(.98)}.dx-big button.hl{border-color:#0D9488;background:#F0FDFA}' +
    '.dx-big i.ic{font-style:normal;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:18px;flex-shrink:0}.dx-big small{display:block;font-weight:600;font-size:11.5px;color:#64748B}' +
    '.dx-sm{display:flex;gap:6px;margin-bottom:12px}.dx-sm button{flex:1;border:0;background:#E2E8F0;border-radius:10px;padding:7px 4px;font:700 12.5px inherit;font-family:inherit;color:#334155;cursor:pointer}' +
    '.dx-tabs{display:flex;gap:4px;background:#E2E8F0;border-radius:12px;padding:4px;margin-bottom:10px;position:sticky;top:60px;z-index:5}' +
    '.dx-tabs button{flex:1;border:0;background:none;border-radius:9px;padding:7px 2px;font:700 13px inherit;font-family:inherit;color:#64748B;cursor:pointer}.dx-tabs button.on{background:#fff;color:#0F172A;box-shadow:0 1px 3px rgba(0,0,0,.08)}' +
    '.dx-tabs button em{font-style:normal;font-size:11px;background:#CBD5E1;color:#334155;border-radius:99px;padding:0 6px;margin-left:3px}.dx-tabs button.on em{background:#CCFBF1;color:#0F766E}' +
    '.dx-pane{background:#fff;border-radius:16px;padding:12px 13px;box-shadow:0 1px 3px rgba(0,0,0,.06)}.dx-pane>.mt-3.pt-3{margin-top:0!important;padding-top:0!important;border-top:0!important}' +
    '.dx-emp{text-align:center;color:#94A3B8;padding:22px 8px;font-size:13.5px}.dx-emp button{margin-top:10px;border:0;background:#0D9488;color:#fff;border-radius:11px;padding:9px 16px;font:700 13.5px inherit;font-family:inherit;cursor:pointer}' +
    '.dx-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:7px}.dx-ph a{display:block;aspect-ratio:1;border-radius:11px;overflow:hidden;background:#F1F5F9;position:relative}' +
    '.dx-ph img{width:100%;height:100%;object-fit:cover;display:block}.dx-ph a span{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;color:#475569;text-align:center;padding:6px;word-break:break-all}' +
    '.dx-ph a small{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff;font-size:10.5px;padding:10px 5px 3px}' +
    '.dx-rep{display:inline-block;margin-top:7px;border:0;background:#fff;color:#2563EB;border:1.5px solid #BFDBFE;border-radius:9px;padding:4px 10px;font:700 12.5px inherit;font-family:inherit;cursor:pointer}' +
    '.dx-pg{display:flex;align-items:center;gap:10px;margin-top:10px}.dx-pg .tr{flex:1;height:8px;background:#E2E8F0;border-radius:5px;overflow:hidden}.dx-pg .tr i{display:block;height:100%;background:#0D9488}.dx-pg b{color:#0F766E;font-size:15px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function driveId(u) { var m = /\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})/.exec(u || ''); return m ? (m[1] || m[2]) : ''; }
  function photos(job) {
    var out = [];
    function add(list, when, who) {
      (Array.isArray(list) ? list : []).forEach(function (a) { if (a && a.fileUrl) out.push({ url: a.fileUrl, name: a.fileName || '', when: when, who: who }); });
    }
    (Array.isArray(job.updates) ? job.updates : []).forEach(function (u) { if (u) add(u.attachments, u.timestamp, u.contractorName); });
    (Array.isArray(job.contractorMaterials) ? job.contractorMaterials : []).forEach(function (m) { if (m) add(m.attachments, m.timestamp, m.contractorName); });
    return out.reverse();
  }
  function shortDate(ts) { var d = new Date(ts); return isNaN(d) ? '' : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); }

  function decorate() {
    var job = window._curJob, C = $('detailContent'); if (!job || !C) return;
    if (LAST !== job.id) { TAB = 'tl'; LAST = job.id; }
    var cards = C.children; if (cards.length < 3) return;
    var info = cards[0], hist = cards[cards.length - 1];
    // แยกส่วน "วัสดุ" ออกจากการ์ดข้อมูล
    var mat = null;
    Array.prototype.forEach.call(info.querySelectorAll(':scope > .mt-3.pt-3'), function (d) { if (/วัสดุ/.test((d.firstElementChild || {}).textContent || '')) mat = d; });
    if (mat) mat.parentNode.removeChild(mat);
    var head = hist.querySelector('h3'); if (head) head.parentNode.removeChild(head);
    var nHist = (Array.isArray(job.updates) ? job.updates : []).length;
    var H = window.ctHome || {}, p = H.prog ? H.prog(job) : 0, sg = H.stage ? H.stage(job) : 1, act = H.isActive ? H.isActive(job) : true, rdy = H.ready ? H.ready(job) : false;
    var done = sg >= 4, cancel = job.status === 'ยกเลิก', canMat = !done && !cancel;
    var plan = window.ctMat ? ctMat.planned(job) : [], planTxt = plan.map(function (q) { var r = ctMat.recorded(job, q.size); return 'เสา ' + q.size + ' ม. ใส่หมายเลขแล้ว ' + Math.min(r, q.n) + '/' + q.n; }).join(' · '), planLeft = plan.some(function (q) { return ctMat.recorded(job, q.size) < q.n; });
    var stc = done ? ['#DCFCE7', '#166534'] : job.status === 'ตรวจรับงาน' ? ['#F3E8FF', '#6B21A8'] : cancel ? ['#F1F5F9', '#64748B'] : ['#E0F2FE', '#075985'];
    var STG = ['รับงาน', 'ก่อสร้าง', 'ส่งมอบ', 'ตรวจรับ', 'เสร็จ'];
    var ph = photos(job), nMat = (Array.isArray(job.contractorMaterials) ? job.contractorMaterials : []).length;

    var top = document.createElement('div');
    top.innerHTML =
      '<div class="dx-h"><div class="n">' + esc(job.jobName || '-') + '</div>' +
      '<div class="s"><b>' + esc(job.receiveNo || '-') + '</b><span class="bd" style="background:' + stc[0] + ';color:' + stc[1] + '">' + esc(job.status || '-') + '</span>' +
      (job.jobIds ? '<br><i class="fa-solid fa-hashtag" style="color:#94A3B8"></i> ' + esc(job.jobIds) : '') +
      (job.location ? '<br><i class="fa-solid fa-location-dot" style="color:#EF4444"></i> ' + esc(job.location) : '') + '</div>' +
      (cancel ? '' : '<div class="dx-st">' + STG.map(function (x, i) { var c = i < sg || done ? 'd' : i === sg ? 'c' : ''; return '<div class="' + c + '"><b>' + (c === 'd' ? '✓' : i + 1) + '</b>' + x + (i === 1 && c === 'c' && p ? ' ' + p + '%' : '') + '</div>'; }).join('') + '</div>') +
      (p && !done ? '<div class="dx-pg"><div class="tr"><i style="width:' + Math.min(100, p) + '%"></i></div><b>' + p + '%</b></div>' : '') + '</div>' +
      (act ? '<div class="dx-big">' +
        '<button type="button" data-a="progress" class="' + (rdy ? '' : 'hl') + '"><i class="ic" style="background:#CCFBF1">📊</i><span>อัปเดตงาน<small>% + รูป + หมายเหตุ</small></span></button>' +
        '<button type="button" data-a="delivery" class="' + (rdy ? 'hl' : '') + '"><i class="ic" style="background:#FEF3C7">🚚</i><span>แจ้งส่งมอบ<small>ขอให้ PEA ตรวจรับ</small></span></button>' +
        '<button type="button" data-a="mat"><i class="ic" style="background:#DBEAFE">🔩</i><span>วัสดุ / เสา<small>' + esc(planTxt || 'บันทึกที่ใช้จริง') + '</small></span></button>' +
        '<button type="button" data-a="problem"><i class="ic" style="background:#FEE2E2">⚠️</i><span>แจ้งปัญหา<small>ขอขยายเวลา</small></span></button></div>' : '') +
      (!act && canMat ? '<div class="dx-big" style="grid-template-columns:1fr"><button type="button" data-a="mat" class="' + (planLeft ? 'hl' : '') + '"><i class="ic" style="background:#DBEAFE">🔩</i><span>ใส่หมายเลขเสา / หม้อแปลง<small>' + esc(planTxt || 'บันทึกวัสดุที่ใช้จริง') + '</small></span></button></div>' : '') +
      '<div class="dx-sm">' + (act ? '<button type="button" data-a="note">📝 บันทึกทั่วไป</button><button type="button" data-a="photo">📷 ส่งรูป</button>' : '<button type="button" data-a="note">📝 ข้อความถึง PEA</button>') + '<button type="button" data-a="print">🖨️ พิมพ์</button></div>' +
      '<div class="dx-tabs"><button type="button" data-t="tl">ไทม์ไลน์<em>' + nHist + '</em></button><button type="button" data-t="mat">วัสดุ' + (nMat ? '<em>' + nMat + '</em>' : '') + '</button><button type="button" data-t="info">ข้อมูลงาน</button><button type="button" data-t="ph">รูป<em>' + ph.length + '</em></button></div>';

    var pTl = document.createElement('div'); pTl.className = 'dx-pane'; pTl.dataset.p = 'tl';
    while (hist.firstChild) pTl.appendChild(hist.firstChild);
    // ปุ่มตอบกลับใต้ข้อความจาก PEA
    Array.prototype.forEach.call(pTl.querySelectorAll('.update-card'), function (c) {
      if (/PEA ตอบกลับ/.test(c.textContent) && !c.querySelector('.dx-rep')) { var b = document.createElement('button'); b.type = 'button'; b.className = 'dx-rep'; b.dataset.a = 'note'; b.textContent = '↩ ตอบกลับ / ส่งรูปเพิ่ม'; c.appendChild(b); }
    });
    var pMat = document.createElement('div'); pMat.className = 'dx-pane'; pMat.dataset.p = 'mat';
    if (mat) pMat.appendChild(mat); else pMat.innerHTML = '<div class="dx-emp">ยังไม่มีข้อมูลวัสดุ</div>';
    if (canMat) pMat.insertAdjacentHTML('beforeend', '<div style="text-align:center">' + (planTxt ? '<div style="font-size:12.5px;color:#92400E;font-weight:700;margin-top:10px">📋 ' + esc(planTxt) + '</div>' : '') + '<button type="button" class="dx-rep" data-a="mat" style="margin-top:8px;font-size:14px;padding:7px 14px">🔩 ใส่หมายเลขเสา / แก้ไขวัสดุ</button></div>');
    var pInfo = document.createElement('div'); pInfo.className = 'dx-pane'; pInfo.dataset.p = 'info';
    var t1 = info.querySelector(':scope > .flex.justify-between'); if (t1) t1.parentNode.removeChild(t1); // ชื่องาน/สถานะ อยู่ในหัวงานแล้ว
    while (info.firstChild) pInfo.appendChild(info.firstChild);
    var pPh = document.createElement('div'); pPh.className = 'dx-pane'; pPh.dataset.p = 'ph';
    pPh.innerHTML = ph.length ? '<div class="dx-ph">' + ph.map(function (x) {
      var id = driveId(x.url), img = id && !/\.pdf$/i.test(x.name);
      return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + (img ? '<img loading="lazy" src="https://drive.google.com/thumbnail?id=' + id + '&sz=w400" alt="" onerror="this.outerHTML=\'<span>📄 ' + esc(x.name).replace(/'/g, '') + '</span>\'">' : '<span>📄 ' + esc(x.name || 'ไฟล์') + '</span>') + '<small>' + esc(shortDate(x.when)) + '</small></a>';
    }).join('') + '</div>' : '<div class="dx-emp">ยังไม่มีรูปหรือไฟล์' + (act ? '<br><button type="button" data-a="photo">📷 ส่งรูป</button>' : '') + '</div>';

    C.innerHTML = ''; C.appendChild(top);
    [pTl, pMat, pInfo, pPh].forEach(function (x) { C.appendChild(x); });
    show();
  }
  function show() {
    var C = $('detailContent'); if (!C) return;
    Array.prototype.forEach.call(C.querySelectorAll('.dx-tabs [data-t]'), function (b) { b.classList.toggle('on', b.dataset.t === TAB); });
    Array.prototype.forEach.call(C.querySelectorAll('.dx-pane'), function (p) { p.style.display = p.dataset.p === TAB ? '' : 'none'; });
  }
  document.addEventListener('click', function (e) {
    var C = $('detailContent'); if (!C || !C.contains(e.target)) return;
    var t = e.target.closest('[data-t]'); if (t) { TAB = t.dataset.t; show(); return; }
    var a = e.target.closest('[data-a]'); if (!a) return;
    var k = a.dataset.a;
    if (k === 'mat') openMaterialForm();
    else if (k === 'print') printJobReport();
    else if (k === 'photo') { openUpdateSheet('note'); setTimeout(function () { try { addAttachRow(); var f = document.querySelector('#attachList input[type=file]'); if (f) f.click(); } catch (x) {} }, 120); }
    else openUpdateSheet(k);
  });

  var orig = window.renderDetail;
  if (typeof orig === 'function') window.renderDetail = function () { var r = orig.apply(this, arguments); try { decorate(); } catch (e) { console.error('[ct-detail]', e); } return r; };
})();
