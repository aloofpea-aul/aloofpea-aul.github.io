/* ====================== เจาะลึกสถานี: ไลน์แยก 1 เฟส จากข้อมูล SLD ======================
 * อ่านข้อมูลจากระบบ SLD (GitHub: aloofpea-aul/sld-ala) แบบอ่านอย่างเดียว
 *   - สายแรงกลาง GIS_MV_LINES (ชนิดสาย + เฟส) ใน index.html
 *   - gis_transformers.csv (kVA + เฟส: 4=A 2=B 1=C 7=3 เฟส)
 *   - devices.csv (ฟิวส์/สวิตช์ ไว้บอกชื่อจุดตัด)
 * แล้วรวมสาย 1 เฟสที่ต่อกันเป็น "ไลน์แยก" + ผูกหม้อแปลง 1 เฟสเข้ากับไลน์ที่ใกล้ที่สุด (เฟสเดียวกัน ≤ 80 ม.)
 */
var SLD_CFG = {
  BASE: 'https://raw.githubusercontent.com/aloofpea-aul/sld-ala/main/',
  SUB: 'ALA',
  CACHE_NAME: 'load01_sld_ala.json',
  MAX_AGE_H: 72
};
var SLD_PH = { '4': 'A', '2': 'B', '1': 'C', '7': '3P' };

function sldHav_(a, b) {
  var R = 6371000, p1 = a[0] * Math.PI / 180, p2 = b[0] * Math.PI / 180, dp = p2 - p1, dl = (b[1] - a[1]) * Math.PI / 180;
  var h = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
function sldRows_(table) { // [[header...],[...]] → [{}]
  var h = table[0].map(function (x) { return String(x).replace(/^\uFEFF/, '').trim(); });
  return table.slice(1).filter(function (r) { return r.length > 1; }).map(function (r) {
    var o = {}; h.forEach(function (k, i) { o[k] = r[i] == null ? '' : String(r[i]); }); return o;
  });
}

function computeLaterals(lines, trs, devs) {
  var out = {};
  Object.keys(lines).forEach(function (f) {
    var segs = lines[f];
    var key = function (v) { return v[0].toFixed(5) + ',' + v[1].toFixed(5); };
    // union-find บนจุดยอดของสาย 1 เฟส (แยกตามเฟส)
    var par = {};
    var fd = function (x) { if (par[x] === undefined) par[x] = x; while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    segs.forEach(function (g) {
      if (g.p.length !== 1) return;
      var ks = g.v.map(function (v) { return g.p + '|' + key(v); });
      ks.forEach(fd);
      for (var i = 1; i < ks.length; i++) par[fd(ks[i])] = fd(ks[0]);
    });
    var comp = {}, segc = [];
    segs.forEach(function (g) {
      if (g.p.length !== 1) { segc.push(''); return; }
      var c = fd(g.p + '|' + key(g.v[0])); segc.push(c);
      var C = comp[c] || (comp[c] = { ph: g.p, len: 0, cond: {}, pts: [], kva: 0, n: 0 });
      var ln = 0; for (var k = 0; k < g.v.length - 1; k++) ln += sldHav_(g.v[k], g.v[k + 1]);
      C.len += ln; C.cond[g.c] = (C.cond[g.c] || 0) + ln;
      for (var j = 0; j < g.v.length; j++) C.pts.push(g.v[j]);
    });
    // ตารางกริดค้นจุดใกล้
    var G = 500, grid1 = {}, grid3 = {};
    var cell = function (v) { return Math.floor(v[0] * G) + ':' + Math.floor(v[1] * G); };
    Object.keys(comp).forEach(function (c) { comp[c].pts.forEach(function (v) { (grid1[cell(v)] = grid1[cell(v)] || []).push([v, c]); }); });
    segs.forEach(function (g) { if (g.p.length > 1) g.v.forEach(function (v) { (grid3[cell(v)] = grid3[cell(v)] || []).push([v, null]); }); });
    var near = function (idx, p) {
      var gx = Math.floor(p[0] * G), gy = Math.floor(p[1] * G), best = null;
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        var L = idx[(gx + dx) + ':' + (gy + dy)]; if (!L) continue;
        for (var i = 0; i < L.length; i++) { var d = sldHav_(p, L[i][0]); if (!best || d < best[0]) best = [d, L[i]]; }
      }
      return best;
    };
    Object.keys(comp).forEach(function (c) {
      var C = comp[c], st = Math.max(1, Math.floor(C.pts.length / 60)), bt = null;
      var cand = []; for (var i = 0; i < C.pts.length; i += st) cand.push(C.pts[i]);
      cand.push(C.pts[0], C.pts[C.pts.length - 1]);
      cand.forEach(function (v) { var b = near(grid3, v); if (b && (!bt || b[0] < bt[0])) bt = [b[0], v]; });
      C.tap = bt && bt[0] < 80 ? bt[1] : C.pts[0];
    });
    var k = { A: 0, B: 0, C: 0, '3P': 0 }, un = 0;
    trs.forEach(function (r) {
      if (r.Feeder !== f) return;
      var ph = SLD_PH[r.Phase], kva = parseFloat(r.RatedKVA) || 0;
      if (!ph) return;
      k[ph] += kva;
      if (ph === '3P') return;
      var p = [parseFloat(r.Lat), parseFloat(r.Lon)], b = near(grid1, p);
      if (b && b[0] < 80 && comp[b[1][1]].ph === ph) { comp[b[1][1]].kva += kva; comp[b[1][1]].n++; } else un += kva;
    });
    var wfs = devs.filter(function (d) { return d.Feeder === f && /^(WF|SW|MR)$/.test(d.Type) && d.Lat; });
    var lat = [], cIdx = {};
    Object.keys(comp).forEach(function (c) {
      var C = comp[c]; if (C.kva === 0 && C.len < 300) return;
      var w = null, wd = 1e9;
      wfs.forEach(function (d) { var x = sldHav_(C.tap, [parseFloat(d.Lat), parseFloat(d.Lon)]); if (x < wd) { wd = x; w = d; } });
      var cond = Object.keys(C.cond).sort(function (a, b) { return C.cond[b] - C.cond[a]; })[0];
      lat.push({ c: c, ph: C.ph, kva: C.kva, n: C.n, km: Math.round(C.len / 10) / 100, cond: cond,
        tap: [Math.round(C.tap[0] * 1e5) / 1e5, Math.round(C.tap[1] * 1e5) / 1e5],
        dev: w && wd < 150 ? w.DeviceID : '', devdesc: w && wd < 150 ? w.Description : '', devrating: w && wd < 150 ? w.Rating : '' });
    });
    lat.sort(function (a, b) { return b.kva - a.kva; });
    var seenId = {};
    lat.forEach(function (x, i) { cIdx[x.c] = i; var id = f + '-' + x.ph + Math.round(x.tap[0] * 1e4) + Math.round(x.tap[1] * 1e4); if (seenId[id]) id += '_' + i; seenId[id] = 1; x.id = id; delete x.c; });
    var sg = segs.map(function (g, si) {
      var v = g.v, st = Math.max(1, Math.floor(v.length / 25)), vv = [];
      for (var i = 0; i < v.length; i += st) vv.push(v[i]);
      if (vv[vv.length - 1] !== v[v.length - 1]) vv.push(v[v.length - 1]);
      var li = segc[si] && cIdx[segc[si]] !== undefined ? cIdx[segc[si]] : -1;
      return [g.p, g.m ? 1 : 0, li, vv.map(function (p) { return [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5]; })];
    });
    out[f] = { kva: k, laterals: lat, segs: sg, unmatched: un, flow: computeFlow(segs, trs, f) };
  });
  return out;
}

/* ===== GAS: ดึงจาก GitHub → คำนวณ → เก็บไฟล์แคชใน Drive ===== */
function rebuildSldCache() {
  var get = function (p) {
    var r = UrlFetchApp.fetch(SLD_CFG.BASE + p, { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw new Error('ดึง ' + p + ' ไม่ได้ (' + r.getResponseCode() + ')');
    return r.getContentText('UTF-8');
  };
  var html = get('index.html');
  var i = html.indexOf('const GIS_MV_LINES = ');
  if (i < 0) throw new Error('ไม่พบ GIS_MV_LINES ใน SLD');
  i += 'const GIS_MV_LINES = '.length;
  var j = html.indexOf(';\n', i); if (j < 0) j = html.indexOf(';', html.lastIndexOf(']}', html.indexOf('\n', i)));
  var lines = JSON.parse(html.substring(i, j).trim().replace(/;$/, ''));
  var trs = sldRows_(Utilities.parseCsv(get('gis_transformers.csv')));
  var devs = sldRows_(Utilities.parseCsv(get('devices.csv')));
  var res = { built: new Date().toISOString(), sub: SLD_CFG.SUB, feeders: computeLaterals(lines, trs, devs) };
  var json = JSON.stringify(res), props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('SLD_CACHE_ID'), file = null;
  if (fid) { try { file = DriveApp.getFileById(fid); file.setContent(json); } catch (e) { file = null; } }
  if (!file) {
    var ss = getSS_(), parent = DriveApp.getFileById(ss.getId()).getParents();
    file = (parent.hasNext() ? parent.next() : DriveApp.getRootFolder()).createFile(SLD_CFG.CACHE_NAME, json, 'application/json');
    props.setProperty('SLD_CACHE_ID', file.getId());
  }
  props.setProperty('SLD_CACHE_AT', String(Date.now()));
  log_('INFO', 'อัปเดตข้อมูล SLD (' + Object.keys(res.feeders).length + ' ฟีดเดอร์, ' + Math.round(json.length / 1024) + ' KB)');
  return json;
}

function getSldData() {
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('SLD_CACHE_ID'), at = +props.getProperty('SLD_CACHE_AT') || 0;
  if (fid && Date.now() - at < SLD_CFG.MAX_AGE_H * 3600e3) {
    try { return DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8'); } catch (e) {}
  }
  try { return rebuildSldCache(); }
  catch (e) { if (fid) { try { return DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8'); } catch (e2) {} } throw e; }
}

/* ===== สถานะงาน + กระแสที่วัดได้ ต่อไลน์แยก (ชีต LateralActions) ===== */
function getLateralActions() {
  var sh = getSS_().getSheetByName('LateralActions');
  if (!sh || sh.getLastRow() < 2) return {};
  var o = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    if (r[0]) o[r[0]] = { s: r[1], amp: r[2] === '' ? null : +r[2], to: r[3], t: r[4] ? Utilities.formatDate(new Date(r[4]), 'Asia/Bangkok', 'yyyy-MM-dd') : '' };
  });
  return o;
}
function setLateralAction(id, status, amp, to) {
  if (!/^[A-Z]{3}\d{2}-[ABC]\d{9,13}(_\d+)?$/.test(String(id))) throw new Error('รหัสไลน์ไม่ถูกต้อง');
  if (['todo', 'doing', 'done'].indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  if (amp !== null && amp !== '' && !(+amp >= 0 && +amp < 400)) throw new Error('ค่ากระแสไม่ถูกต้อง');
  if (to && !/^[ABC]$/.test(to)) throw new Error('เฟสไม่ถูกต้อง');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = ensureSheet_(getSS_(), 'LateralActions', ['lateral_id', 'status', 'measured_amp', 'to_phase', 'updated']);
    var row = [status, amp === null || amp === '' ? '' : +amp, to || '', new Date()], last = sh.getLastRow();
    if (last > 1) {
      var ids = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) { sh.getRange(i + 2, 2, 1, 4).setValues([row]); return getLateralActions(); }
    }
    sh.appendRow([id].concat(row));
    return getLateralActions();
  } finally { lock.releaseLock(); }
}

/* ====================== โหลดโฟลว์อย่างง่าย: สูญเสีย / แรงดันตก / Capacitor ======================
 * สร้างต้นไม้สายจากสถานีออกไป (ต่อช่วงที่ GIS ขาดด้วยการ snap ≤ 60 ม.) แบ่งกระแสแต่ละเฟสลงหม้อแปลงตาม kVA
 * เก็บเป็น "สัดส่วนกระแส" ต่อเฟส เพื่อให้หน้าเว็บคูณกับกระแส SCADA เดือนใดก็ได้
 */
var SLD_SUB_POS = [8.42033, 98.7397];
function sldRX_(c) {
  var n = String(c || '').split('-')[1] || '', m = n.match(/^(\d+)(.*)$/), size = m ? +m[1] : 50, typ = m ? m[2] : '';
  var Ral = { 35: 0.95, 50: 0.66, 95: 0.35, 120: 0.28, 185: 0.18, 240: 0.14, 400: 0.085 };
  var R = (Ral[size] || 0.66) * (typ === 'ACSR' ? 0.9 : 1);
  var X = { SAC: 0.30, PIC: 0.33, XLPE: 0.12, TAC: 0.33 }[typ] || 0.38;
  return [R, X];
}
function computeFlow(segs, trs, f) {
  var K = function (v) { return v[0].toFixed(5) + ',' + v[1].toFixed(5); };
  var pos = {}, adj = {};
  segs.forEach(function (g) {
    var rx = sldRX_(g.c);
    for (var i = 0; i < g.v.length - 1; i++) {
      var a = g.v[i], b = g.v[i + 1], ka = K(a), kb = K(b); pos[ka] = a; pos[kb] = b;
      if (ka === kb) continue;
      var l = sldHav_(a, b) / 1000, e1 = [kb, l, rx[0], rx[1], g.p, g.c], e2 = [ka, l, rx[0], rx[1], g.p, g.c];
      (adj[ka] = adj[ka] || []).push(e1); (adj[kb] = adj[kb] || []).push(e2);
    }
  });
  var nodes = Object.keys(pos); if (!nodes.length) return null;
  var root = nodes[0], rd = 1e18;
  nodes.forEach(function (k) { var d = sldHav_(pos[k], SLD_SUB_POS); if (d < rd) { rd = d; root = k; } });
  var comp = {}, members = [], cid = 0;
  nodes.forEach(function (n) {
    if (comp[n] !== undefined) return;
    var st = [n], mem = [n]; comp[n] = cid;
    while (st.length) { var u = st.pop(); (adj[u] || []).forEach(function (e) { if (comp[e[0]] === undefined) { comp[e[0]] = cid; st.push(e[0]); mem.push(e[0]); } }); }
    members.push(mem); cid++;
  });
  var par = {}, info = {}, order = [root]; par[root] = null;
  var G = 1000, pgrid = {};
  var addpt = function (p, node) { var c = Math.floor(p[0] * G) + ':' + Math.floor(p[1] * G); (pgrid[c] = pgrid[c] || []).push([p, node]); };
  var grow = function (start) {
    var q = [start], qi = 0; addpt(pos[start], start);
    while (qi < q.length) {
      var u = q[qi++];
      (adj[u] || []).forEach(function (e) {
        var v = e[0]; if (par[v] !== undefined) return;
        par[v] = u; info[v] = e.slice(1); order.push(v); q.push(v);
        var a = pos[u], b = pos[v], n = Math.max(1, Math.floor(e[1] * 1000 / 15));
        for (var i = 0; i <= n; i++) { var t = i / n; addpt([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t < 0.5 ? u : v); }
      });
    }
  };
  grow(root);
  var attached = {}; attached[comp[root]] = 1;
  while (true) {
    var best = null;
    for (var c = 0; c < members.length; c++) {
      if (attached[c]) continue;
      var mem = members[c];
      for (var mi = 0; mi < mem.length; mi++) {
        var p = pos[mem[mi]], gx = Math.floor(p[0] * G), gy = Math.floor(p[1] * G);
        for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
          var L = pgrid[(gx + dx) + ':' + (gy + dy)]; if (!L) continue;
          for (var j = 0; j < L.length; j++) { var d = sldHav_(p, L[j][0]); if (d < 60 && (!best || d < best[0])) best = [d, c, mem[mi], L[j][1]]; }
        }
      }
    }
    if (!best) break;
    attached[best[1]] = 1; par[best[2]] = best[3]; info[best[2]] = [Math.max(best[0], 1) / 1000, 0.66, 0.38, 'ABC', 'snap']; order.push(best[2]);
    grow(best[2]);
  }
  // หม้อแปลง → โหนดใกล้สุด (≤ 100 ม.)
  var G2 = 400, ngrid = {};
  order.forEach(function (k) { var c = Math.floor(pos[k][0] * G2) + ':' + Math.floor(pos[k][1] * G2); (ngrid[c] = ngrid[c] || []).push(k); });
  var load = {}, tot = [0, 0, 0];
  trs.forEach(function (r) {
    if (r.Feeder !== f) return;
    var ph = SLD_PH[r.Phase], kva = parseFloat(r.RatedKVA) || 0; if (!ph || !kva) return;
    var p = [parseFloat(r.Lat), parseFloat(r.Lon)], gx = Math.floor(p[0] * G2), gy = Math.floor(p[1] * G2), b = null;
    for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
      var L = ngrid[(gx + dx) + ':' + (gy + dy)]; if (!L) continue;
      L.forEach(function (o) { var d = sldHav_(p, pos[o]); if (d < 100 && (!b || d < b[0])) b = [d, o]; });
    }
    if (!b) return;
    var ld = load[b[1]] || (load[b[1]] = [0, 0, 0]);
    if (ph === '3P') { for (var j = 0; j < 3; j++) { ld[j] += kva / 3; tot[j] += kva / 3; } }
    else { var jj = 'ABC'.indexOf(ph); ld[jj] += kva; tot[jj] += kva; }
  });
  // สัดส่วนกระแสปลายทาง (ต่อเฟส)
  var fr = {};
  order.forEach(function (k) { var l = load[k] || [0, 0, 0]; fr[k] = [tot[0] ? l[0] / tot[0] : 0, tot[1] ? l[1] / tot[1] : 0, tot[2] ? l[2] / tot[2] : 0]; });
  for (var oi = order.length - 1; oi >= 0; oi--) { var k = order[oi], p = par[k]; if (p !== null) for (var j = 0; j < 3; j++) fr[p][j] += fr[k][j]; }
  var kids = {}; order.forEach(function (k) { if (par[k] !== null) (kids[par[k]] = kids[par[k]] || []).push(k); });
  var sec = {}, S = [], AB = {}, SS = {};
  AB[root] = [0, 0, 0, 0, 0, 0]; SS[root] = [0, 0];
  order.forEach(function (k) {
    var p = par[k]; if (p === null) return;
    var I = info[k], l = I[0], R = I[1], X = I[2], ph = I[3], c = I[4], mult = ph.length === 1 ? 2 : 1, F = fr[k];
    var sid;
    if (sec[p] !== undefined && (kids[p] || []).length === 1 && S[sec[p]].c === c) sid = sec[p];
    else { sid = S.length; S.push({ c: c, ph: ph, km: 0, R: R, C: [0, 0, 0], f0: F.slice(), pts: [pos[p]] }); }
    sec[k] = sid; var s = S[sid];
    s.km += l; for (var j = 0; j < 3; j++) s.C[j] += F[j] * F[j] * R * l * mult; s.pts.push(pos[k]);
    var a = AB[p]; AB[k] = [a[0] + F[0] * R * l * mult, a[1] + F[1] * R * l * mult, a[2] + F[2] * R * l * mult, a[3] + F[0] * X * l * mult, a[4] + F[1] * X * l * mult, a[5] + F[2] * X * l * mult];
    var w = (F[0] + F[1] + F[2]) / 3, s0 = SS[p];
    SS[k] = ph.length > 1 && s0 ? [s0[0] + R * l, s0[1] + R * l * w] : null;
  });
  var r5 = function (v) { return Math.round(v * 1e5) / 1e5; }, r6 = function (v) { return Math.round(v * 1e6) / 1e6; };
  var sections = S.map(function (s) {
    var st = Math.max(1, Math.floor(s.pts.length / 20)), pts = [];
    for (var i = 0; i < s.pts.length; i += st) pts.push([r5(s.pts[i][0]), r5(s.pts[i][1])]);
    var e = s.pts[s.pts.length - 1]; pts.push([r5(e[0]), r5(e[1])]);
    return [s.c, s.ph, Math.round(s.km * 1000) / 1000, s.R, s.C.map(r6), s.f0.map(function (x) { return Math.round(x * 1e4) / 1e4; }), pts];
  });
  // จุดแรงดันตก: เก็บเฉพาะปลายสาย (ไม่มีลูก) 60 จุดที่ค่ามากสุด
  var leaves = order.filter(function (k) { return !kids[k]; }).map(function (k) { var a = AB[k]; return [r5(pos[k][0]), r5(pos[k][1])].concat(a.map(r6)); });
  var mx = function (v) { return Math.max(v[2] + v[5], v[3] + v[6], v[4] + v[7]); };
  leaves.sort(function (x, y) { return mx(y) - mx(x); });
  // จุดติด Capacitor ที่เป็นไปได้ (สาย 3 เฟส) ทุก 3 โหนด
  var cands = [];
  order.forEach(function (k, i) { if (SS[k] && SS[k][0] > 0 && i % 3 === 0) cands.push([r5(pos[k][0]), r5(pos[k][1]), r6(SS[k][0]), r6(SS[k][1])]); });
  return { sections: sections, vd: leaves.slice(0, 120), cap: cands, snapped: Object.keys(attached).length - 1, unreached: nodes.length - order.length };
}

/* ตั้งเวลาอัปเดตข้อมูล SLD ทุกวัน ~05:00 (รันครั้งเดียว) */
function setupSldTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'rebuildSldCache') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('rebuildSldCache').timeBased().everyDays(1).atHour(5).create();
  rebuildSldCache();
}
