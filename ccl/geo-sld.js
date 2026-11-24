/* CCL — หาพิกัดงานจาก SLD (ข้อมูลกลาง sld-ala)
   - ปุ่ม "🔎 หาจาก SLD" ข้างช่องพิกัด (ฟอร์มบันทึกงาน + แก้ไขงาน) + แนะนำอัตโนมัติจากชื่องาน/ที่อยู่
   - ค้นได้: เลขมิเตอร์ PEA · CA · หม้อแปลง (63-019107) · เสา (4281PL000158483 / 158483) · ชื่อสถานที่ (หม้อแปลง/มิเตอร์ MV)
   - เลือกเป็น ⭐ จุดอ้างอิง → เรียงเสา/หม้อแปลงใกล้สุดพร้อมระยะ → แตะเสา หรือคลิก/ลากหมุดบนแผนที่ → ใช้พิกัดนี้
   ข้อมูลโหลดจาก /sld-ala/ เฉพาะตอนใช้ (ไม่มีค่าใช้จ่าย ไม่เก็บซ้ำใน CCL) */
(function () {
  'use strict';
  var BASE = '/sld-ala/';
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var D = { tr: null, mv: null, lv: null, pole: null, lines: null }, P = {};
  function csv(t) {
    var L = t.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean), h = L.shift().split(',');
    return L.map(function (l) { var a = [], cur = '', q = false; for (var i = 0; i < l.length; i++) { var c = l[i]; if (c === '"') q = !q; else if (c === ',' && !q) { a.push(cur); cur = ''; } else cur += c; } a.push(cur); var o = {}; h.forEach(function (k, i) { o[k] = a[i]; }); return o; });
  }
  function load(k) {
    if (D[k]) return Promise.resolve(D[k]); if (P[k]) return P[k];
    var u = { tr: 'gis_transformers.csv', mv: 'gis_mv_meters.csv', mva: 'gis_mv_meter_accounts.csv', lv: 'lvmeters.json', pole: 'poles.json', lines: 'mv-lines.json' }[k];
    P[k] = fetch(BASE + u).then(function (r) { if (!r.ok) throw new Error(r.status); return /\.csv$/.test(u) ? r.text().then(csv) : r.json(); }).then(function (x) {
      if (k === 'tr') x = x.map(function (o) { return { t: 'tr', id: o.TransformerID, kva: o.RatedKVA, ph: o.Phase, name: o.Location || '', fd: o.Feeder, lat: +o.Lat, lng: +o.Lon }; }).filter(function (o) { return o.lat; });
      if (k === 'mv') x = x.map(function (o) { return { t: 'mv', id: o.Tag || o.Code, name: o.Location || '', fd: o.Feeder, kva: o.TotalKVA, lat: +o.Lat, lng: +o.Lon }; }).filter(function (o) { return o.lat; });
      if (k === 'mva') x = x.map(function (o) { return { t: 'mv', id: o.CustomerAccount, ca: o.CustomerAccount, name: o.Location || '', fd: o.Feeder, lat: +o.Lat, lng: +o.Lon }; }).filter(function (o) { return o.lat; });
      return (D[k] = x);
    });
    return P[k];
  }
  function poleTag(p) { var pre = D.pole.prefix[p[3]] || ''; return p[4] ? pre + String(p[4]).padStart(9, '0') : ''; }
  function lvCA(m) { return D.lv.caPrefix + String(m[6]).padStart(8, '0'); }
  function dist(a, b) { var R = 6371000, x = (b.lng - a.lng) * Math.PI / 180 * Math.cos((a.lat + b.lat) / 2 * Math.PI / 180), y = (b.lat - a.lat) * Math.PI / 180; return Math.sqrt(x * x + y * y) * R; }
  function fmtD(m) { return m < 1000 ? Math.round(m) + ' ม.' : (m / 1000).toFixed(1) + ' กม.'; }
  function norm(s) { return String(s || '').replace(/^DCC_/i, '').replace(/\s+/g, '').replace(/(บจก\.|หจก\.|บริษัท|จำกัด|ห้างหุ้นส่วน|นาย|นางสาว|นาง|ม\.\d+|หมู่ที่?\d+|ต\.|อ\.|จ\.)/g, '').toLowerCase(); }
  function lcs(a, b) { if (!a || !b) return 0; var m = 0, prev = new Array(b.length + 1).fill(0); for (var i = 1; i <= a.length; i++) { var cur = [0]; for (var j = 1; j <= b.length; j++) { cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : 0; if (cur[j] > m) m = cur[j]; } prev = cur; } return m; }

  // ───── ค้นหา ─────
  function kind(q) {
    var s = q.replace(/\s+/g, '');
    if (/^\d{2}-\d{4,6}$/.test(s)) return 'tr';
    if (/^0200\d{8}$/.test(s) || /^\d{12}$/.test(s)) return 'ca';
    if (/^\d{10}$/.test(s)) return 'meter';
    if (/pl/i.test(s) || /^\d{5,9}$/.test(s)) return 'pole';
    return 'text';
  }
  function search(q) {
    q = String(q || '').trim(); if (q.length < 2) return Promise.resolve([]);
    var k = kind(q), s = q.replace(/\s+/g, '').toLowerCase(), out = [];
    var base = Promise.all([load('tr'), load('mv'), load('mva').catch(function () { return []; })]);
    return base.then(function () {
      if (k === 'tr' || k === 'text') D.tr.forEach(function (o) { if (o.id.toLowerCase().indexOf(s) >= 0 || norm(o.name).indexOf(norm(q)) >= 0) out.push(o); });
      if (k === 'text' || k === 'ca') D.mv.concat(D.mva || []).forEach(function (o) { if ((o.ca && o.ca.indexOf(s) >= 0) || (k === 'text' && norm(o.name).indexOf(norm(q)) >= 0)) out.push(o); });
      if (k === 'meter' || k === 'ca') return load('lv').then(function () {
        var cols = D.lv.meters; for (var i = 0; i < cols.length && out.length < 30; i++) { var m = cols[i]; if ((k === 'meter' && String(m[7]) === s) || (k === 'ca' && lvCA(m).indexOf(s) >= 0)) out.push({ t: 'lv', id: String(m[7]), ca: lvCA(m), fd: D.lv.feeder[m[2]], route: m[8], ph: m[5], lat: m[0], lng: m[1] }); }
        return out;
      });
      if (k === 'pole') return load('pole').then(function () {
        var num = s.replace(/^.*?pl/i, '').replace(/^0+/, ''), pre = /pl/i.test(s) ? s.replace(/pl.*$/i, '').toUpperCase() + 'PL' : '';
        var ps = D.pole.poles; for (var i = 0; i < ps.length && out.length < 30; i++) { var p = ps[i]; if (String(p[4]) === num && (!pre || (D.pole.prefix[p[3]] || '').toUpperCase() === pre)) out.push({ t: 'pole', id: poleTag(p), p: p, lat: p[0], lng: p[1] }); }
        return out;
      });
      return out;
    }).then(function (r) { return r.slice(0, 40); });
  }
  // แนะนำจากชื่องาน/ที่อยู่
  function suggest(text) {
    var t = norm(text); if (t.length < 4) return Promise.resolve([]);
    return Promise.all([load('tr'), load('mv'), load('mva').catch(function () { return []; })]).then(function () {
      var all = D.tr.concat(D.mv, D.mva || []), sc = [];
      all.forEach(function (o) { var n = norm(o.name); if (n.length < 4) return; var l = lcs(t, n); if (l >= 5) sc.push([l + (t.indexOf(n) >= 0 ? 5 : 0), o]); });
      sc.sort(function (a, b) { return b[0] - a[0]; }); return sc.slice(0, 8).map(function (x) { return x[1]; });
    });
  }

  // ───── หน้าต่างแผนที่ ─────
  var css =
    '#gsx{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:12px}' +
    '#gsx .bx{background:#fff;border-radius:18px;width:min(1120px,100%);height:min(680px,94vh);display:grid;grid-template-columns:370px 1fr;grid-template-rows:auto 1fr auto;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.3)}' +
    '#gsx .hd{grid-column:1/3;display:flex;align-items:center;gap:10px;padding:11px 16px;border-bottom:1px solid #F1F5F9}#gsx .hd b{font-size:16px}#gsx .hd small{display:block;color:#64748B;font-size:12px;max-width:760px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#gsx .x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#F1F5F9;color:#64748B;font-size:15px;cursor:pointer}' +
    '#gsx .lf{border-right:1px solid #F1F5F9;padding:12px;overflow-y:auto}' +
    '#gsx .sr{width:100%;border:2px solid #0D9488;border-radius:12px;padding:9px 12px;font:700 14.5px inherit;font-family:inherit;box-sizing:border-box}#gsx .sr:focus{outline:0;box-shadow:0 0 0 3px #CCFBF1}' +
    '#gsx .hint{font-size:11.5px;color:#64748B;margin:6px 2px 8px;line-height:1.5}' +
    '#gsx .sec{font-size:12.5px;font-weight:800;color:#475569;margin:10px 2px 6px;display:flex}#gsx .sec span{margin-left:auto;font-weight:600;color:#94A3B8;font-size:11.5px}' +
    '#gsx .it{display:flex;gap:9px;padding:8px 9px;border-radius:11px;margin-bottom:5px;border:1.5px solid #EEF2F7;align-items:flex-start;cursor:pointer;background:#fff;width:100%;text-align:left;font-family:inherit}#gsx .it:hover{border-color:#99F6E4}#gsx .it.on{border-color:#0D9488;background:#F0FDFA}' +
    '#gsx .it .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;font-size:15px;flex-shrink:0}#gsx .it b{font-size:13.5px;display:block;color:#1E293B}#gsx .it small{font-size:11.5px;color:#64748B;display:block;line-height:1.4}' +
    '#gsx .it em{font-style:normal;margin-left:auto;font-size:11px;color:#94A3B8;white-space:nowrap}' +
    '#gsx .emp{color:#94A3B8;font-size:13px;text-align:center;padding:16px 6px}' +
    '#gsx .mp{position:relative}#gsx #gsxMap{position:absolute;inset:0}' +
    '#gsx .tl{position:absolute;right:10px;top:10px;z-index:500;display:flex;flex-direction:column;gap:6px}#gsx .tl button{border:0;background:#fff;border-radius:9px;padding:6px 10px;font:700 12px inherit;font-family:inherit;box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer}' +
    '#gsx .ft{grid-column:1/3;border-top:1px solid #F1F5F9;padding:10px 16px;display:flex;gap:10px;align-items:center}#gsx .ft .co{font-size:13px;color:#334155;flex:1;min-width:0}#gsx .ft .co b{font-size:15px;color:#0F766E;font-family:monospace}' +
    '#gsx .ft button{border-radius:11px;padding:10px 18px;font:800 14px inherit;font-family:inherit;cursor:pointer}#gsx .c1{border:1.5px solid #E2E8F0;background:#fff;color:#64748B}#gsx .c2{border:0;background:#0D9488;color:#fff}#gsx .c2:disabled{background:#CBD5E1}' +
    '.gs-pl{font-size:10px;color:#334155;background:rgba(255,255,255,.85);border-radius:4px;padding:0 3px;border:0;box-shadow:none;white-space:nowrap}' +
    '.gs-btn{white-space:nowrap;font-size:12px!important;color:#1D4ED8!important;background:#EFF6FF!important;border:1px solid #BFDBFE!important;border-radius:6px;padding:1px 8px;margin-left:6px;cursor:pointer;font-weight:700}' +
    '.gs-sug{margin-top:6px;font-size:12px;color:#0F766E;background:#F0FDFA;border:1px dashed #5EEAD4;border-radius:10px;padding:6px 9px;cursor:pointer;line-height:1.45}.gs-sug b{color:#134E4A}.gs-sug u{color:#2563EB}' +
    '@media(max-width:760px){#gsx{padding:0}#gsx .bx{grid-template-columns:1fr;grid-template-rows:auto 42% 1fr auto;height:100%;border-radius:0}#gsx .lf{border-right:0;grid-row:3}#gsx .mp{grid-row:2}#gsx .hd small{max-width:70vw}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var M = null, S = null;
  function ensure() {
    if ($('gsx')) return;
    var w = document.createElement('div'); w.id = 'gsx';
    w.innerHTML = '<div class="bx"><div class="hd"><div style="min-width:0"><b>📍 หาพิกัดงานจาก SLD</b><small id="gsxSub"></small></div><button class="x" type="button" data-a="close">✕</button></div>' +
      '<div class="lf"><input class="sr" id="gsxQ" placeholder="🔍 เลขมิเตอร์ / CA / หม้อแปลง / เสา / ชื่อสถานที่" autocomplete="off">' +
      '<div class="hint">ค้นได้ทุกอย่าง: <b>เลขมิเตอร์ PEA</b> (6603074255) · <b>CA</b> (020008718948) · <b>หม้อแปลง</b> (63-019107) · <b>เสา</b> (4281PL000158483 หรือ 158483) · ชื่อสถานที่ — หรือคลิกบนแผนที่ได้เลย</div><div id="gsxL"></div></div>' +
      '<div class="mp"><div id="gsxMap"></div><div class="tl"><button type="button" data-a="me">🎯 ตำแหน่งฉัน</button><button type="button" data-a="sat">🛰️ ดาวเทียม</button></div></div>' +
      '<div class="ft"><div class="co" id="gsxCo">คลิกบนแผนที่ หรือเลือกจากรายการ</div><button class="c1" type="button" data-a="close">ยกเลิก</button><button class="c2" type="button" data-a="use" id="gsxUse" disabled>✓ ใช้พิกัดนี้</button></div></div>';
    document.body.appendChild(w);
    w.addEventListener('click', onClick);
    var tmr; $('gsxQ').addEventListener('input', function () { clearTimeout(tmr); var v = this.value; tmr = setTimeout(function () { runSearch(v); }, 300); });
  }
  function open(inputId) {
    if (!window.L) { alert('โหลดแผนที่ไม่สำเร็จ'); return; }
    ensure();
    var ctx = ctxText(inputId);
    S = { input: inputId, ref: null, pin: null, near: [], res: [], ctx: ctx };
    $('gsxSub').textContent = ctx || 'เลือกจุดอ้างอิง แล้วเลือกตำแหน่งจริง';
    $('gsx').style.display = 'flex'; $('gsxQ').value = '';
    if (!M) {
      M = L.map('gsxMap', { preferCanvas: true }).setView([8.33, 98.77], 12);
      M._osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OpenStreetMap' }).addTo(M);
      M._sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri' });
      M._lay = L.layerGroup().addTo(M); M._dyn = L.layerGroup().addTo(M); M._mark = L.layerGroup().addTo(M);
      M.on('click', function (e) { setPin(e.latlng.lat, e.latlng.lng, 'จุดที่คลิกบนแผนที่'); });
      M.on('moveend', dyn);
      Promise.all([load('tr'), load('lines').catch(function () { return null; })]).then(drawBase);
    }
    setTimeout(function () { M.invalidateSize(); }, 80);
    var cur = parseLL($(inputId) && $(inputId).value);
    if (cur) { setPin(cur.lat, cur.lng, 'พิกัดเดิมในฟอร์ม', true); M.setView([cur.lat, cur.lng], 17); }
    $('gsxL').innerHTML = '<div class="emp">กำลังหาจากชื่องาน/ที่อยู่…</div>';
    suggest(ctx).then(function (r) { S.res = r; list(); }).catch(function () { $('gsxL').innerHTML = '<div class="emp">โหลดข้อมูล SLD ไม่ได้</div>'; });
    setTimeout(function () { $('gsxQ').focus(); }, 150);
  }
  function close() { $('gsx').style.display = 'none'; }
  function parseLL(v) { var m = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/.exec(String(v || '')); return m ? { lat: +m[1], lng: +m[2] } : null; }
  function ctxText(inputId) {
    var f = $(inputId) && $(inputId).form; if (!f) return '';
    var n = f.querySelector('[name=jobName]'), l = f.querySelector('[name=location]');
    return [n && n.value, l && l.value].filter(Boolean).join(' · ');
  }
  function drawBase() {
    if (D.lines && D.lines.lines) Object.keys(D.lines.lines).forEach(function (fd) { D.lines.lines[fd].forEach(function (s) { L.polyline(s.v, { color: '#EF4444', weight: 2, opacity: .7, dashArray: '5 4', interactive: false }).addTo(M._lay); }); });
    D.tr.forEach(function (o) { L.circleMarker([o.lat, o.lng], { radius: 5, color: '#fff', weight: 1.5, fillColor: '#F59E0B', fillOpacity: 1 }).bindTooltip('⚡ ' + esc(o.id) + ' · ' + esc(o.kva) + ' kVA<br>' + esc(o.name)).on('click', function (e) { L.DomEvent.stop(e); pick(o); }).addTo(M._lay); });
  }
  function dyn() { // เสา (ซูม ≥16) / มิเตอร์ LV (ซูม ≥17) เฉพาะในจอ
    if (!M || $('gsx').style.display === 'none') return;
    M._dyn.clearLayers(); var z = M.getZoom(), b = M.getBounds(); if (z < 16) return;
    load('pole').then(function () {
      var n = 0; D.pole.poles.forEach(function (p) { if (n > 900 || !b.contains([p[0], p[1]])) return; n++;
        var mk = L.circleMarker([p[0], p[1]], { radius: z >= 18 ? 5 : 4, color: '#fff', weight: 1, fillColor: '#475569', fillOpacity: 1 }).on('click', function (e) { L.DomEvent.stop(e); setPin(p[0], p[1], 'เสา ' + poleTag(p), true); }).addTo(M._dyn);
        if (z >= 18 && p[4]) mk.bindTooltip(String(p[4]), { permanent: true, direction: 'right', className: 'gs-pl', offset: [4, 0] });
      });
    });
    if (z >= 17) load('lv').then(function () { var n = 0; D.lv.meters.forEach(function (m) { if (n > 700 || !b.contains([m[0], m[1]])) return; n++; L.circleMarker([m[0], m[1]], { radius: 3, color: '#3B82F6', weight: 1, fillColor: '#93C5FD', fillOpacity: 1 }).bindTooltip('🏠 มิเตอร์ ' + esc(m[7]) + '<br>CA ' + lvCA(m)).on('click', function (e) { L.DomEvent.stop(e); setPin(m[0], m[1], 'มิเตอร์ ' + m[7], true); }).addTo(M._dyn); }); });
  }
  function runSearch(q) {
    if (!q.trim()) { suggest(S.ctx).then(function (r) { S.res = r; list(); }); return; }
    $('gsxL').innerHTML = '<div class="emp">กำลังค้นหา…</div>';
    search(q).then(function (r) { S.res = r; list(); if (r.length === 1) pick(r[0]); }).catch(function () { $('gsxL').innerHTML = '<div class="emp">โหลดข้อมูล SLD ไม่ได้</div>'; });
  }
  function row(o, i, nearMode) {
    var ic = { tr: ['⚡', '#FEF3C7'], mv: ['🏭', '#FCE7F3'], lv: ['🏠', '#DBEAFE'], pole: ['🔵', '#F1F5F9'] }[o.t];
    var t = o.t === 'tr' ? 'หม้อแปลง ' + o.id + (o.kva ? ' · ' + o.kva + ' kVA' : '') : o.t === 'lv' ? 'มิเตอร์ PEA ' + o.id : o.t === 'mv' ? 'มิเตอร์ MV ' + (o.ca || o.id || '') : 'เสา ' + o.id;
    var sub = o.t === 'lv' ? 'CA ' + o.ca + ' · ' + (o.fd || '') + (o.route ? ' · สาย ' + o.route : '') : o.t === 'pole' ? poleSub(o.p) : (o.name || '') + (o.fd ? ' · ' + o.fd : '');
    var sel = S.pin && Math.abs(S.pin.lat - o.lat) < 1e-7 && Math.abs(S.pin.lng - o.lng) < 1e-7;
    return '<button type="button" class="it' + (sel ? ' on' : '') + '" data-' + (nearMode ? 'n' : 'r') + '="' + i + '"><div class="ic" style="background:' + ic[1] + '">' + ic[0] + '</div><div style="min-width:0"><b>' + esc(t) + '</b><small>' + esc(sub) + '</small></div><em>' + (o.d != null ? fmtD(o.d) : S.ref && S.ref.o === o ? '⭐ อ้างอิง' : '') + '</em></button>';
  }
  function poleSub(p) { if (!p || !D.pole) return ''; var v = String(D.pole.volt[p[2]] || '').replace('?', ''); return 'เสา' + (v ? ' ' + v : '') + (p[6] ? ' ' + p[6] + ' ม.' : '') + (D.pole.assembly[p[5]] ? ' · ' + D.pole.assembly[p[5]] : ''); }
  function list() {
    var h = '';
    if (S.ref) h += '<div class="sec">⭐ จุดอ้างอิง</div>' + row(S.ref.o, -1, false).replace('data-r="-1"', 'data-a="ref"');
    if (S.near.length) h += '<div class="sec">🔵 ใกล้จุดอ้างอิง <span>แตะเพื่อใช้พิกัด</span></div>' + S.near.map(function (o, i) { return row(o, i, true); }).join('');
    var rs = S.res.filter(function (o) { return !S.ref || o !== S.ref.o; });
    if (rs.length) h += '<div class="sec">' + ($('gsxQ').value.trim() ? 'ผลค้นหา' : '💡 แนะนำจากชื่องาน/ที่อยู่') + ' <span>' + rs.length + ' รายการ · แตะเพื่อตั้งเป็นจุดอ้างอิง</span></div>' + rs.map(function (o) { return row(o, S.res.indexOf(o), false); }).join('');
    if (!h) h = '<div class="emp">' + ($('gsxQ').value.trim() ? 'ไม่พบ — ลองพิมพ์เลขมิเตอร์ / CA / หม้อแปลง / เสา' : 'พิมพ์ค้นหา หรือคลิกบนแผนที่') + '</div>';
    $('gsxL').innerHTML = h;
  }
  function pick(o) { // ตั้งเป็นจุดอ้างอิง
    S.ref = { o: o }; M._mark.clearLayers();
    L.marker([o.lat, o.lng], { icon: L.divIcon({ className: '', html: '<div style="font-size:24px;transform:translate(-50%,-50%)">⭐</div>', iconSize: [0, 0] }), interactive: false }).addTo(M._mark);
    M.setView([o.lat, o.lng], 18);
    setPin(o.lat, o.lng, labelOf(o), true);
    load('pole').then(function () {
      var near = [];
      D.pole.poles.forEach(function (p) { if (Math.abs(p[0] - o.lat) > .004 || Math.abs(p[1] - o.lng) > .004) return; var d = dist(o, { lat: p[0], lng: p[1] }); if (d < 400 && d > 0.5) near.push({ t: 'pole', id: poleTag(p) || '(ไม่มีเลข)', p: p, lat: p[0], lng: p[1], d: d }); });
      near.sort(function (a, b) { return a.d - b.d; }); near = near.slice(0, 6);
      (D.tr || []).forEach(function (t) { if (t === o) return; var d = dist(o, t); if (d < 400) near.push(Object.assign({}, t, { d: d })); });
      near.sort(function (a, b) { return a.d - b.d; }); S.near = near.slice(0, 8); list();
    });
    list();
  }
  function labelOf(o) { return o.t === 'tr' ? 'หม้อแปลง ' + o.id : o.t === 'lv' ? 'มิเตอร์ ' + o.id : o.t === 'mv' ? 'มิเตอร์ MV ' + (o.ca || o.id) : 'เสา ' + o.id; }
  function setPin(lat, lng, label, keepView) {
    S.pin = { lat: lat, lng: lng, label: label };
    if (M._pin) M._pin.setLatLng([lat, lng]);
    else { M._pin = L.marker([lat, lng], { draggable: true, zIndexOffset: 1000, icon: L.divIcon({ className: '', html: '<div style="font-size:34px;line-height:1;transform:translate(-50%,-100%);filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))">📍</div>', iconSize: [0, 0] }) }).addTo(M); M._pin.on('dragend', function () { var p = M._pin.getLatLng(); S.pin = { lat: p.lat, lng: p.lng, label: 'ลากหมุดปรับเอง' }; foot(); list(); }); }
    if (!keepView) M.panTo([lat, lng]);
    foot(); list();
  }
  function foot() {
    var p = S.pin; if (!p) return;
    var d = S.ref ? dist(S.ref.o, p) : null;
    $('gsxCo').innerHTML = 'พิกัดที่เลือก: <b>' + p.lat.toFixed(6) + ', ' + p.lng.toFixed(6) + '</b> · ' + esc(p.label) + (d != null && d > 1 ? ' · ห่างจุดอ้างอิง ' + fmtD(d) : '') + ' <span style="color:#94A3B8">(คลิกแผนที่/ลากหมุดเพื่อปรับ)</span>';
    $('gsxUse').disabled = false;
  }
  function onClick(e) {
    var b = e.target.closest('[data-a],[data-r],[data-n]'); if (!b) { if (e.target.id === 'gsx') close(); return; }
    if (b.dataset.r != null) { pick(S.res[+b.dataset.r]); return; }
    if (b.dataset.n != null) { var o = S.near[+b.dataset.n]; setPin(o.lat, o.lng, labelOf(o), false); M.setView([o.lat, o.lng], Math.max(M.getZoom(), 18)); return; }
    var a = b.dataset.a;
    if (a === 'close') close();
    else if (a === 'ref') { var r = S.ref.o; setPin(r.lat, r.lng, labelOf(r)); }
    else if (a === 'sat') { if (M.hasLayer(M._sat)) { M.removeLayer(M._sat); M._osm.addTo(M); b.textContent = '🛰️ ดาวเทียม'; } else { M.removeLayer(M._osm); M._sat.addTo(M); M._sat.bringToBack(); b.textContent = '🗺️ แผนที่'; } }
    else if (a === 'me') { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(function (p) { setPin(p.coords.latitude, p.coords.longitude, 'ตำแหน่งฉัน'); M.setView([p.coords.latitude, p.coords.longitude], 18); }, function () { alert('ไม่สามารถระบุตำแหน่งได้'); }, { enableHighAccuracy: true, timeout: 10000 }); }
    else if (a === 'use') { var inp = $(S.input); if (inp && S.pin) { inp.value = S.pin.lat.toFixed(6) + ', ' + S.pin.lng.toFixed(6); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } close(); var g = $('gsSug_' + S.input); if (g) g.remove(); }
  }

  // ───── ปุ่ม + คำแนะนำในฟอร์ม ─────
  function addBtn(inputId) {
    var inp = $(inputId); if (!inp || $('gsB_' + inputId)) return;
    var box = inp.closest('.bg-slate-50') || inp.parentNode, head = box.querySelector('button');
    var b = document.createElement('button'); b.type = 'button'; b.id = 'gsB_' + inputId; b.className = 'gs-btn'; b.textContent = '🔎 หาจาก SLD';
    b.onclick = function () { open(inputId); };
    if (head) head.parentNode.insertBefore(b, head); else box.insertBefore(b, box.firstChild);
    var wrap = head && head.parentNode; if (wrap) { wrap.style.gap = '6px'; wrap.style.flexWrap = 'wrap'; }
  }
  var sugT = {};
  function sug(inputId) {
    var inp = $(inputId); if (!inp) return;
    clearTimeout(sugT[inputId]);
    sugT[inputId] = setTimeout(function () {
      var old = $('gsSug_' + inputId); if (old) old.remove();
      if (inp.value.trim()) return;
      var ctx = ctxText(inputId); if (!ctx) return;
      suggest(ctx).then(function (r) {
        if (!r.length || inp.value.trim()) return;
        var o = r[0], d = document.createElement('div'); d.id = 'gsSug_' + inputId; d.className = 'gs-sug';
        d.innerHTML = '💡 แนะนำจาก SLD: <b>' + (o.t === 'tr' ? '⚡ ' : '🏭 ') + esc(o.id || o.ca) + ' · ' + esc(o.name) + '</b>' + (o.kva ? ' (' + esc(o.kva) + ' kVA)' : '') + ' — กดเพื่อใช้พิกัดนี้' + (r.length > 1 ? ' · <u data-all="1">ดูทั้งหมด ' + r.length + '</u>' : '');
        d.onclick = function (e) { if (e.target.dataset.all) { open(inputId); return; } inp.value = o.lat.toFixed(6) + ', ' + o.lng.toFixed(6); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); d.remove(); };
        (inp.closest('.bg-slate-50') || inp.parentNode).appendChild(d);
      }).catch(function () {});
    }, 600);
  }
  function hookForm(inputId) {
    var inp = $(inputId); if (!inp) return; addBtn(inputId);
    var f = inp.form; if (!f || f.__gs) return; f.__gs = 1;
    f.addEventListener('input', function (e) { if (e.target.name === 'jobName' || e.target.name === 'location' || e.target === inp) sug(inputId); });
  }
  function boot() { hookForm('coordinatesInput'); hookForm('editCoordinates'); }
  var oEdit = window.openEditModal;
  if (typeof oEdit === 'function') window.openEditModal = function () { var r = oEdit.apply(this, arguments); setTimeout(function () { boot(); sug('editCoordinates'); }, 400); return r; };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  setTimeout(boot, 2000);
  window.cclGeoSld = { open: open, search: search, suggest: suggest };
})();
