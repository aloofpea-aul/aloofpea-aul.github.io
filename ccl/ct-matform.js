/* Contractor Portal — หน้าบันทึกหมายเลขเสา / หม้อแปลง แบบใหม่ (แทนฟอร์มวัสดุเดิมสำหรับ "เพิ่มใหม่")
   - หน้าต่างกะทัดรัด (มือถือ: แผ่นล่าง · คอม: กลางจอ) ปุ่มบันทึกติดล่าง
   - กองหมอน: แตะเลือกครั้งเดียว (จำค่าที่ใช้ล่าสุด) · ขนาดเสาตามแบบเป็นปุ่ม พร้อมนับ ใส่แล้ว/ตามแบบ
   - ช่องเลขเสาเล็ก (มือถือ 2 คอลัมน์ / คอม 4) · Enter ไปช่องถัดไป · เรียงเลขต่อ · วางหลายเลข · +5 · พิกัดทีละต้น/ทั้งหมด
   - หม้อแปลง: สวิตช์ → ปุ่ม kVA + หมายเลข PEA + พิกัด · รูปถ่ายหลายรูป
   บันทึกด้วยรูปแบบข้อมูลเดิม (submitMaterialData / uploadContractorAttachment) — แก้ไขรายการเก่ายังใช้ฟอร์มเดิม */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var SIZES = ['8', '9', '12', '12.20', '14', '14.30', '22'], KVA = ['30', '50', '100', '160', '250'], KG = 'ct_gongmon_last';
  var S = null; // state

  var css =
    '#pmxO{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:400;display:none}' +
    '#pmx{position:fixed;left:0;right:0;bottom:0;max-height:94vh;z-index:401;background:#fff;border-radius:22px 22px 0 0;display:none;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,.2);font-family:inherit}' +
    '@media(min-width:760px){#pmx{left:50%;right:auto;bottom:auto;top:50%;transform:translate(-50%,-50%);width:min(720px,94vw);max-height:90vh;border-radius:20px}}' +
    '#pmx .hd{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid #F1F5F9}#pmx .hd b{font-size:16px;font-weight:800}#pmx .hd small{display:block;color:#64748B;font-size:12px;margin-top:1px}' +
    '#pmx .hd .pr{margin-left:auto;text-align:right;font-size:11.5px;color:#64748B;white-space:nowrap}#pmx .hd .pr b{display:block;font-size:20px;color:#0F766E}' +
    '#pmx .hd .x{width:32px;height:32px;border-radius:50%;border:0;background:#F1F5F9;color:#64748B;font-size:15px;cursor:pointer;flex-shrink:0}' +
    '#pmx .bd{padding:12px 16px;overflow-y:auto;flex:1}' +
    '#pmx .lb{font-size:12.5px;font-weight:800;color:#475569;margin:0 0 6px;display:flex;gap:6px;align-items:center}#pmx .lb span{margin-left:auto;font-weight:600;color:#94A3B8;font-size:11.5px}' +
    '#pmx .ch{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}#pmx .ch button{border:1.5px solid #E2E8F0;border-radius:99px;padding:5px 12px;font:700 13px inherit;font-family:inherit;color:#475569;background:#fff;cursor:pointer}' +
    '#pmx .ch button.on{background:#0D9488;border-color:#0D9488;color:#fff}#pmx .ch button.ad{border-style:dashed;color:#64748B}' +
    '#pmx .in{width:100%;border:1.5px solid #E2E8F0;border-radius:10px;padding:8px 10px;font:600 14px inherit;font-family:inherit;box-sizing:border-box}#pmx .in:focus{outline:0;border-color:#0D9488}' +
    '#pmx .sz{display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap}#pmx .sz button{flex:1;min-width:92px;border:2px solid #E2E8F0;border-radius:12px;padding:6px;font:800 13.5px inherit;font-family:inherit;color:#475569;background:#fff;cursor:pointer}' +
    '#pmx .sz button small{display:block;font-size:11px;font-weight:700}#pmx .sz button.on{border-color:#F59E0B;background:#FFFBEB;color:#92400E}#pmx .sz button.ad{border-style:dashed;color:#64748B;flex:0 0 auto}' +
    '#pmx .tl{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}#pmx .tl button{border:0;border-radius:9px;padding:6px 10px;font:700 12.5px inherit;font-family:inherit;background:#F1F5F9;color:#334155;cursor:pointer}#pmx .tl button.w{background:#EDE9FE;color:#5B21B6}' +
    '#pmx .pst{display:none;margin-bottom:10px}#pmx .pst textarea{width:100%;min-height:64px;border:1.5px dashed #C4B5FD;border-radius:12px;padding:8px 10px;font:14px inherit;font-family:inherit;background:#FAF5FF;box-sizing:border-box}' +
    '#pmx .pst div{display:flex;gap:6px;margin-top:6px}#pmx .pst button{border:0;border-radius:9px;padding:6px 12px;font:700 13px inherit;font-family:inherit;cursor:pointer}' +
    '#pmx .gr{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:12px}@media(min-width:760px){#pmx .gr{grid-template-columns:repeat(4,minmax(0,1fr))}}' +
    '#pmx .c{display:flex;align-items:stretch;border:1.5px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#fff;height:40px}#pmx .c b{width:28px;flex-shrink:0;font-size:11.5px;color:#94A3B8;background:#F8FAFC;display:grid;place-items:center;border-right:1px solid #F1F5F9}' +
    '#pmx .c input{flex:1;min-width:0;border:0;padding:0 8px;font:700 15px inherit;font-family:inherit;letter-spacing:.3px;background:transparent}#pmx .c input:focus{outline:0}' +
    '#pmx .c button{border:0;background:none;padding:0 7px;font-size:14px;cursor:pointer;filter:grayscale(1);opacity:.45}#pmx .c button.g{filter:none;opacity:1}' +
    '#pmx .c.f{border-color:#5EEAD4;background:#F0FDFA}#pmx .c:focus-within{border-color:#0D9488;box-shadow:0 0 0 3px #CCFBF1}' +
    '#pmx .tr{border:1.5px solid #E2E8F0;border-radius:12px;padding:9px 12px;display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;margin-bottom:8px;cursor:pointer;user-select:none}' +
    '#pmx .sw{margin-left:auto;width:40px;height:23px;border-radius:99px;background:#CBD5E1;position:relative;flex-shrink:0}#pmx .sw:after{content:"";position:absolute;left:3px;top:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:left .15s}' +
    '#pmx .tr.on .sw{background:#0D9488}#pmx .tr.on .sw:after{left:20px}' +
    '#pmx .trb{display:none;margin-bottom:10px}#pmx .trb .rw{display:flex;gap:6px}#pmx .trb .gp{border:1.5px solid #BBF7D0;background:#F0FDF4;color:#166534;border-radius:10px;padding:0 12px;font:700 13px inherit;font-family:inherit;cursor:pointer;white-space:nowrap}' +
    '#pmx .ph{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}#pmx .ph .a{width:58px;height:58px;border-radius:11px;background:#F0FDFA;border:2px dashed #5EEAD4;display:grid;place-items:center;font-size:21px;cursor:pointer}' +
    '#pmx .ph .t{width:58px;height:58px;border-radius:11px;overflow:hidden;position:relative;background:#F1F5F9;font-size:10px;display:grid;place-items:center;text-align:center}#pmx .ph .t img{width:100%;height:100%;object-fit:cover}' +
    '#pmx .ph .t button{position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:10px;cursor:pointer;line-height:18px;padding:0}' +
    '#pmx .prev{font-size:12.5px;background:#F8FAFC;border-radius:10px;padding:7px 10px;color:#475569;margin-bottom:12px;font-weight:700;cursor:pointer}#pmx .prevl{display:none;margin:-6px 0 12px}' +
    '#pmx .prevl div{display:flex;gap:8px;align-items:center;font-size:12.5px;padding:6px 10px;border-bottom:1px solid #F1F5F9}#pmx .prevl div span{flex:1;min-width:0}#pmx .prevl button{border:0;border-radius:8px;padding:3px 9px;font:700 12px inherit;font-family:inherit;cursor:pointer;background:#EFF6FF;color:#1D4ED8}' +
    '#pmx .ft{border-top:1px solid #F1F5F9;padding:10px 16px calc(12px + env(safe-area-inset-bottom));display:flex;gap:8px}' +
    '#pmx .ft button{border-radius:12px;padding:12px;font:800 14.5px inherit;font-family:inherit;cursor:pointer}#pmx .ft .c1{border:1.5px solid #E2E8F0;background:#fff;color:#64748B;flex:1}#pmx .ft .c2{border:0;background:#0D9488;color:#fff;flex:3}#pmx .ft .c2:disabled{background:#CBD5E1}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function typeOf(size) { return 'เสาคอนกรีต ' + size + ' ม.'; }
  function sizeOfType(t) { var m = /(\d+(?:\.\d+)?)\s*ม/.exec(t || ''); return m ? m[1] : ''; }
  function gongList() { return (window._gongmonOptions || []).map(function (g) { return typeof g === 'string' ? g : (g && g.name) || ''; }).filter(Boolean); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { return ''; } }

  function build() {
    if ($('pmx')) return;
    var o = document.createElement('div'); o.id = 'pmxO'; o.onclick = close; document.body.appendChild(o);
    var p = document.createElement('div'); p.id = 'pmx'; document.body.appendChild(p);
    p.addEventListener('click', onClick); p.addEventListener('input', onInput); p.addEventListener('keydown', onKey); p.addEventListener('change', onChange);
  }
  function close() { $('pmx').style.display = 'none'; $('pmxO').style.display = 'none'; }

  function open() {
    var job = window._curJob; if (!job) return;
    build();
    var plan = window.ctMat ? ctMat.planned(job) : [];
    var groups = plan.map(function (q) { var r = ctMat.recorded(job, q.size); return { size: q.size, plan: q.n, done: r, nos: blank(Math.max(q.n - r, q.n - r > 0 ? 0 : 0)) }; });
    groups.forEach(function (g) { if (!g.nos.length) g.nos = blank(2); });
    if (!groups.length) groups.push({ size: '', plan: 0, done: 0, nos: blank(8) });
    var gl = gongList(), last = ls(KG);
    S = { groups: groups, gi: 0, gong: gl.indexOf(last) >= 0 ? last : (gl.length === 1 ? gl[0] : ''), gongOther: '', tr: false, kva: '', kvaOther: '', peaNo: '', trLat: '', trLng: '', files: [] };
    render();
    $('pmx').style.display = 'flex'; $('pmxO').style.display = 'block';
    setTimeout(function () { var f = document.querySelector('#pmx .c input'); if (f && window.innerWidth >= 760) f.focus(); }, 200);
  }
  function blank(n) { var a = []; for (var i = 0; i < n; i++) a.push({ no: '', lat: '', lng: '' }); return a; }
  function filled(g) { return g.nos.filter(function (x) { return x.no.trim(); }).length; }
  function totals() { var f = 0, plan = 0, done = 0; S.groups.forEach(function (g) { f += filled(g); plan += g.plan; done += g.done; }); return { f: f, plan: plan, done: done }; }
  function gong() { return S.gong === '__o' ? S.gongOther.trim() : S.gong; }

  function render() {
    var job = window._curJob, P = $('pmx'), g = S.groups[S.gi], T = totals();
    var ex = Array.isArray(job.contractorMaterials) ? job.contractorMaterials : [], exPoles = 0;
    ex.forEach(function (e) { exPoles += (e && e.poles || []).filter(function (p) { return p && p.no; }).length; });
    var gl = gongList();
    P.innerHTML =
      '<div class="hd"><div style="min-width:0"><b>🔩 หมายเลขเสา / หม้อแปลง</b><small>' + esc((job.receiveNo || '') + ' · ' + (job.jobName || '')) + '</small></div>' +
      (T.plan ? '<div class="pr"><b id="pmxCnt">' + (T.done + T.f) + '/' + T.plan + '</b>ใส่แล้ว</div>' : '<div class="pr"><b id="pmxCnt">' + T.f + '</b>ต้น</div>') +
      '<button type="button" class="x" data-a="close">✕</button></div>' +
      '<div class="bd">' +
      (ex.length ? '<div class="prev" data-a="prev">✓ บันทึกไปแล้ว ' + ex.length + ' ครั้ง · ' + exPoles + ' ต้น ▸ ดู/แก้ไข</div><div class="prevl" id="pmxPrev">' + ex.map(function (e, i) {
        var ps = (e.poles || []).filter(function (p) { return p && p.no; });
        return '<div><span>' + esc(new Date(e.timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })) + ' · ' + ps.length + ' ต้น' + (ps.length ? ' (' + esc(ps.slice(0, 3).map(function (p) { return p.no; }).join(', ')) + (ps.length > 3 ? ' …' : '') + ')' : '') + (e.transformer ? ' · หม้อแปลง ' + esc(e.transformer.kva) + ' kVA' : '') + '</span><button type="button" data-ed="' + i + '">แก้ไข</button></div>';
      }).join('') + '</div>' : '') +
      '<p class="lb">🏗️ กองหมอน <span>แตะเลือกได้เลย</span></p><div class="ch" data-g="gong">' +
      gl.map(function (x) { return '<button type="button" data-v="' + esc(x) + '" class="' + (S.gong === x ? 'on' : '') + '">' + esc(x) + '</button>'; }).join('') +
      '<button type="button" data-v="__o" class="ad' + (S.gong === '__o' ? ' on' : '') + '">＋ อื่นๆ</button></div>' +
      (S.gong === '__o' ? '<input class="in" id="pmxGo" placeholder="ระบุกองหมอน" value="' + esc(S.gongOther) + '" style="margin:-6px 0 12px">' : '') +
      '<p class="lb">📏 ขนาดเสา' + (S.groups.some(function (x) { return x.plan; }) ? ' <span>ตามแบบ</span>' : '') + '</p><div class="sz">' +
      S.groups.map(function (x, i) { return '<button type="button" data-gi="' + i + '" class="' + (i === S.gi ? 'on' : '') + '">' + (x.size ? 'เสา ' + esc(x.size) + ' ม.' : 'เลือกขนาด') + '<small>' + (x.plan ? (x.done + filled(x)) + '/' + x.plan + ' ต้น' : filled(x) + ' ต้น') + '</small></button>'; }).join('') +
      '<button type="button" class="ad" data-a="addsz">＋ ขนาดอื่น</button></div>' +
      (!g.size ? '<div class="ch" data-g="size" style="margin-top:-4px">' + SIZES.map(function (z) { return '<button type="button" data-v="' + z + '">' + z + ' ม.</button>'; }).join('') + '</div>' : '') +
      '<div class="tl"><button type="button" data-a="seq">🔢 เรียงเลขต่อ</button><button type="button" class="w" data-a="paste">📋 วางหลายเลข</button><button type="button" data-a="add5">＋5 ต้น</button><button type="button" data-a="gpsall">📍 ใส่พิกัดตำแหน่งนี้ทุกต้นที่ยังไม่มี</button></div>' +
      '<div class="pst" id="pmxPst"><textarea placeholder="วางรายการเลขเสา เช่น KT0106 KT0107 KT0108 (คั่นด้วยเว้นวรรค/ขึ้นบรรทัด/จุลภาค)"></textarea><div><button type="button" data-a="pasteok" style="background:#7C3AED;color:#fff">เติมลงช่องที่ว่าง</button><button type="button" data-a="paste" style="background:#F1F5F9;color:#475569">ปิด</button></div></div>' +
      '<div class="gr" id="pmxGr">' + cells(g) + '</div>' +
      '<div class="tr' + (S.tr ? ' on' : '') + '" data-a="tr"><span>⚡ มีหม้อแปลงในงานนี้</span><div class="sw"></div></div>' +
      '<div class="trb" style="display:' + (S.tr ? 'block' : 'none') + '"><div class="ch" data-g="kva" style="margin-bottom:6px">' + KVA.map(function (k) { return '<button type="button" data-v="' + k + '" class="' + (S.kva === k ? 'on' : '') + '">' + k + ' kVA</button>'; }).join('') +
      '<button type="button" data-v="__o" class="ad' + (S.kva === '__o' ? ' on' : '') + '">อื่นๆ</button></div>' +
      (S.kva === '__o' ? '<input class="in" id="pmxKo" type="number" placeholder="ขนาด kVA" value="' + esc(S.kvaOther) + '" style="margin-bottom:6px">' : '') +
      '<div class="rw"><input class="in" id="pmxPea" placeholder="หมายเลข PEA หม้อแปลง" value="' + esc(S.peaNo) + '"><button type="button" class="gp" data-a="trgps">' + (S.trLat ? '✓ มีพิกัดแล้ว' : '📍 ใช้ตำแหน่งนี้') + '</button></div></div>' +
      '<p class="lb">📷 รูปถ่าย <span>ได้หลายรูป</span></p><div class="ph" id="pmxPh"></div><input type="file" id="pmxFile" accept="image/*,application/pdf" multiple style="display:none">' +
      '</div><div class="ft"><button type="button" class="c1" data-a="close">ยกเลิก</button><button type="button" class="c2" data-a="save" id="pmxSave"></button></div>';
    photos(); count();
  }
  function cells(g) {
    return g.nos.map(function (x, i) {
      return '<div class="c' + (x.no.trim() ? ' f' : '') + '" data-i="' + i + '"><b>' + (g.done + i + 1) + '</b><input value="' + esc(x.no) + '" placeholder="' + (i === 0 ? 'หมายเลขเสา' : '') + '" enterkeyhint="next" autocomplete="off" autocapitalize="characters"><button type="button" data-a="gps" class="' + (x.lat ? 'g' : '') + '" title="ใช้ตำแหน่งนี้เป็นพิกัดเสาต้นนี้">📍</button></div>';
    }).join('');
  }
  function redrawCells() { var G = $('pmxGr'); if (G) G.innerHTML = cells(S.groups[S.gi]); count(); }
  function photos() {
    var P = $('pmxPh'); if (!P) return;
    P.innerHTML = S.files.map(function (f, i) { return '<div class="t">' + (f.url ? '<img src="' + f.url + '">' : '📄<br>' + esc(f.file.name.slice(0, 12))) + '<button type="button" data-rmf="' + i + '">✕</button></div>'; }).join('') + '<div class="a" data-a="file">📷</div>';
  }
  function count() {
    var T = totals(), c = $('pmxCnt'); if (c) c.textContent = T.plan ? (T.done + T.f) + '/' + T.plan : T.f;
    var kv = S.kva === '__o' ? S.kvaOther : S.kva, b = $('pmxSave');
    var parts = []; if (T.f) parts.push(T.f + ' ต้น'); if (S.tr && kv) parts.push('หม้อแปลง ' + kv + ' kVA'); if (S.files.length) parts.push(S.files.length + ' รูป');
    if (b) { b.textContent = parts.length ? '💾 บันทึก ' + parts.join(' + ') : 'ใส่หมายเลขเสาก่อน'; b.disabled = !parts.length; }
    Array.prototype.forEach.call(document.querySelectorAll('#pmx .sz [data-gi]'), function (bt) { var x = S.groups[+bt.dataset.gi], sm = bt.querySelector('small'); if (sm) sm.textContent = x.plan ? (x.done + filled(x)) + '/' + x.plan + ' ต้น' : filled(x) + ' ต้น'; });
  }
  function gps(cb) {
    if (!navigator.geolocation) { if (window.showToast) showToast('เครื่องนี้ไม่รองรับพิกัด', 'error'); return; }
    if (window.showToast) showToast('กำลังหาพิกัด…', 'info');
    navigator.geolocation.getCurrentPosition(function (p) { cb(p.coords.latitude.toFixed(6), p.coords.longitude.toFixed(6)); }, function () { if (window.showToast) showToast('ไม่สามารถระบุพิกัดได้', 'error'); }, { enableHighAccuracy: true, timeout: 10000 });
  }

  function onInput(e) {
    var t = e.target, c = t.closest('.c[data-i]');
    if (c) { var x = S.groups[S.gi].nos[+c.dataset.i]; x.no = t.value; c.classList.toggle('f', !!t.value.trim()); count(); return; }
    if (t.id === 'pmxGo') S.gongOther = t.value; else if (t.id === 'pmxKo') { S.kvaOther = t.value; count(); } else if (t.id === 'pmxPea') S.peaNo = t.value;
  }
  function onKey(e) {
    var c = e.target.closest && e.target.closest('.c[data-i]'); if (!c || e.key !== 'Enter') return;
    e.preventDefault(); var i = +c.dataset.i, g = S.groups[S.gi];
    if (i === g.nos.length - 1) { g.nos.push({ no: '', lat: '', lng: '' }); redrawCells(); }
    var nx = document.querySelector('#pmxGr .c[data-i="' + (i + 1) + '"] input'); if (nx) nx.focus();
  }
  function onChange(e) {
    if (e.target.id !== 'pmxFile') return;
    Array.prototype.forEach.call(e.target.files, function (f) { S.files.push({ file: f, url: /^image\//.test(f.type) ? URL.createObjectURL(f) : '' }); });
    e.target.value = ''; photos(); count();
  }
  function onClick(e) {
    var b = e.target.closest('button,[data-a]'); if (!b) return;
    var chg = b.closest('.ch[data-g]');
    if (chg && b.dataset.v != null) {
      var k = chg.dataset.g, v = b.dataset.v;
      if (k === 'gong') { S.gong = S.gong === v && v !== '__o' ? '' : v; if (v !== '__o') ls(KG, v); render(); if (v === '__o') { var gi = $('pmxGo'); if (gi) gi.focus(); } }
      else if (k === 'size') { S.groups[S.gi].size = v; render(); }
      else if (k === 'kva') { S.kva = v; render(); }
      return;
    }
    if (b.dataset.gi != null) { S.gi = +b.dataset.gi; render(); return; }
    if (b.dataset.ed != null) { close(); editMaterialEntry(+b.dataset.ed); return; }
    if (b.dataset.rmf != null) { S.files.splice(+b.dataset.rmf, 1); photos(); count(); return; }
    var a = b.dataset.a, g = S.groups[S.gi];
    if (a === 'close') close();
    else if (a === 'prev') { var L = $('pmxPrev'); L.style.display = L.style.display === 'block' ? 'none' : 'block'; }
    else if (a === 'addsz') { S.groups.push({ size: '', plan: 0, done: 0, nos: blank(4) }); S.gi = S.groups.length - 1; render(); }
    else if (a === 'add5') { for (var i = 0; i < 5; i++) g.nos.push({ no: '', lat: '', lng: '' }); redrawCells(); }
    else if (a === 'seq') {
      var prev = null, n = 0;
      g.nos.forEach(function (x) { var v = x.no.trim(); if (v) { prev = v; return; } if (prev == null) return; var m = /^(.*?)(\d+)(\D*)$/.exec(prev); if (!m) return; var nx = String(parseInt(m[2], 10) + 1); while (nx.length < m[2].length) nx = '0' + nx; x.no = prev = m[1] + nx + m[3]; n++; });
      if (!n && window.showToast) showToast('ใส่หมายเลขต้นแรกก่อน แล้วกดอีกครั้ง', 'info'); redrawCells();
    }
    else if (a === 'paste') { var p = $('pmxPst'); p.style.display = p.style.display === 'block' ? 'none' : 'block'; if (p.style.display === 'block') p.querySelector('textarea').focus(); }
    else if (a === 'pasteok') {
      var ta = document.querySelector('#pmxPst textarea'), list = ta.value.split(/[\s,;]+/).map(function (s) { return s.trim(); }).filter(Boolean), j = 0;
      g.nos.forEach(function (x) { if (!x.no.trim() && j < list.length) x.no = list[j++]; });
      while (j < list.length) g.nos.push({ no: list[j++], lat: '', lng: '' });
      ta.value = ''; $('pmxPst').style.display = 'none'; redrawCells();
    }
    else if (a === 'gps') { var c = b.closest('.c[data-i]'), x = g.nos[+c.dataset.i]; gps(function (la, ln) { x.lat = la; x.lng = ln; b.classList.add('g'); if (window.showToast) showToast('ใส่พิกัดต้นนี้แล้ว', 'success'); }); }
    else if (a === 'gpsall') { gps(function (la, ln) { var n = 0; g.nos.forEach(function (x) { if (x.no.trim() && !x.lat) { x.lat = la; x.lng = ln; n++; } }); redrawCells(); if (window.showToast) showToast(n ? 'ใส่พิกัดให้ ' + n + ' ต้น' : 'ใส่หมายเลขเสาก่อน แล้วค่อยกด', n ? 'success' : 'info'); }); }
    else if (a === 'tr') { S.tr = !S.tr; render(); }
    else if (a === 'trgps') gps(function (la, ln) { S.trLat = la; S.trLng = ln; render(); });
    else if (a === 'file') $('pmxFile').click();
    else if (a === 'save') save();
  }

  function save() {
    var loc = gong(), poles = [], bad = null;
    S.groups.forEach(function (g) {
      g.nos.forEach(function (x) { if (x.no.trim()) { if (!g.size) bad = g; poles.push({ no: x.no.trim(), type: g.size ? typeOf(g.size) : '', location: loc, lat: x.lat, lng: x.lng }); } });
    });
    if (bad) { S.gi = S.groups.indexOf(bad); render(); if (window.showToast) showToast('เลือกขนาดเสาก่อน', 'error'); return; }
    var kv = S.kva === '__o' ? String(S.kvaOther || '').trim() : S.kva;
    if (S.tr && !kv) { if (window.showToast) showToast('เลือกขนาดหม้อแปลง (kVA)', 'error'); return; }
    if (poles.length && !loc && !confirm('ยังไม่ได้เลือกกองหมอน — บันทึกต่อไหม?')) return;
    var data = { poles: poles, transformer: S.tr && kv ? { kva: kv, peaNo: S.peaNo.trim(), lat: S.trLat, lng: S.trLng, location: loc } : null, contractorName: _user.name, contractorCo: _user.company, attachments: [] };
    var files = S.files.slice(); close();
    if (!files.length) { submitMaterialData(data); return; }
    showLoading('กำลังอัปโหลดรูปภาพ...');
    Promise.all(files.map(function (f) {
      return new Promise(function (res) { var r = new FileReader(); r.onload = function (e) { res({ fileName: f.file.name, base64: e.target.result.split(',')[1], mimeType: f.file.type }); }; r.readAsDataURL(f.file); });
    })).then(function (list) {
      var n = 0;
      list.forEach(function (f) {
        google.script.run.withSuccessHandler(function (r) { if (r && r.success) data.attachments.push({ fileName: r.fileName, fileUrl: r.fileUrl }); if (++n === list.length) { hideLoading(); submitMaterialData(data); } })
          .withFailureHandler(function () { if (++n === list.length) { hideLoading(); submitMaterialData(data); } })
          .uploadContractorAttachment(_curJob.id, f.fileName, f.base64, f.mimeType);
      });
    });
  }

  window.openMaterialForm = function () { if (typeof loadGongMonOptions === 'function') loadGongMonOptions(open); else open(); };
})();
