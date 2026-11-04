/**
 * Parser.gs — อ่านไฟล์ Load01 (.xlsx) ทุกรูปแบบปี 2021–2026 แล้วแปลงเป็นแถวมาตรฐานเดียวกัน
 * ไม่ต้องแปลงไฟล์เป็น Google Sheet: แตก zip แล้วอ่าน XML ตรงๆ (ค่าที่ได้คือค่าที่บันทึกไว้ในไฟล์)
 *
 * รองรับ:
 *  - แบบเก่า (2021–ส.ค.2024) : หัวตาราง PROVINCE / SUBSTATION / CODE / DATE PEAK / TIME PEAK / Ia PEAK ...
 *  - แบบ SCADA (ก.ย.2024–ส.ค.2026) : Province / Substastion / Feeder / Date/Time / kV / IA ... P_Max ...
 *  - แบบใหม่ (ก.ย.2026– ) : Province / Substation / Type / Code / Feeder / Peak Time / Peak kV ... LF / UB%
 */

var LOAD_HEADERS = [
  'ym', 'year', 'month', 'province', 'substation', 'type', 'feeder',
  'peak_time', 'peak_kv', 'peak_ia', 'peak_ib', 'peak_ic', 'peak_mw', 'peak_mvar', 'peak_pf',
  'light_time', 'light_kv', 'light_ia', 'light_ib', 'light_ic', 'light_mw', 'light_mvar', 'light_pf',
  'lf', 'ub_pct', 'rating', 'area', 'qc', 'source_file', 'sheet'
];

var PROVINCE_MAP = {
  KRABI: 'Krabi', PHUKET: 'Phuket', PHANGNGA: 'Phang Nga', SURATTHANI: 'Surat Thani',
  NAKHONSITHAMMARAT: 'Nakhon Si Thammarat', TRANG: 'Trang'
};

var MONTHS_EN = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/* ---------------- XLSX (zip ของ XML) ---------------- */

function xmlDecode_(s) {
  if (s == null) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, function (m, e) {
    if (e === 'amp') return '&'; if (e === 'lt') return '<'; if (e === 'gt') return '>';
    if (e === 'quot') return '"'; if (e === 'apos') return "'";
    if (e[1] === 'x') return String.fromCharCode(parseInt(e.slice(2), 16));
    return String.fromCharCode(parseInt(e.slice(1), 10));
  });
}

function colIndex_(ref) {
  var letters = ref.replace(/\d+/g, ''), n = 0;
  for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n - 1;
}

/** zip = { text(path) -> string|null } */
function wbSheetList_(zip) {
  var wb = zip.text('xl/workbook.xml') || '';
  var rels = zip.text('xl/_rels/workbook.xml.rels') || '';
  var relMap = {};
  rels.replace(/<Relationship\b[^>]*>/g, function (tag) {
    var id = (tag.match(/\bId="([^"]+)"/) || [])[1];
    var target = (tag.match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) {
      target = target.replace(/^\//, '');
      if (target.indexOf('xl/') !== 0) target = 'xl/' + target;
      relMap[id] = target;
    }
    return tag;
  });
  var out = [];
  wb.replace(/<sheet\b[^>]*>/g, function (tag) {
    var name = xmlDecode_((tag.match(/\bname="([^"]*)"/) || [])[1] || '');
    var rid = (tag.match(/\br:id="([^"]+)"/) || tag.match(/\bid="([^"]+)"/) || [])[1];
    if (relMap[rid]) out.push({ name: name, path: relMap[rid] });
    return tag;
  });
  return out;
}

function sharedStrings_(zip) {
  var xml = zip.text('xl/sharedStrings.xml');
  var arr = [];
  if (!xml) return arr;
  var re = /<si>([\s\S]*?)<\/si>/g, m;
  while ((m = re.exec(xml))) {
    var s = '', t, re2 = /<t[^>]*>([\s\S]*?)<\/t>/g;
    while ((t = re2.exec(m[1]))) s += t[1];
    arr.push(xmlDecode_(s));
  }
  return arr;
}

/** คืนค่า array ของแถว (array ของค่า) — maxRows จำกัดจำนวนแถวที่อ่าน */
function sheetRows_(xml, ss, maxRows) {
  var rows = [];
  if (!xml) return rows;
  var reRow = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, m, count = 0;
  while ((m = reRow.exec(xml))) {
    var rnum = (m[1].match(/\br="(\d+)"/) || [])[1];
    var ri = rnum ? parseInt(rnum, 10) - 1 : rows.length;
    var row = [];
    var body = m[2] || '';
    var reC = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
    var ci = 0;
    while ((c = reC.exec(body))) {
      var attrs = c[1];
      var ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      if (ref) ci = colIndex_(ref);
      var t = (attrs.match(/\bt="([^"]+)"/) || [])[1];
      var inner = c[2] || '';
      var v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      var val = null;
      if (t === 's') val = v != null ? ss[parseInt(v, 10)] : null;
      else if (t === 'inlineStr') {
        var s = '', tt, reT = /<t[^>]*>([\s\S]*?)<\/t>/g;
        while ((tt = reT.exec(inner))) s += tt[1];
        val = xmlDecode_(s);
      } else if (t === 'str') val = xmlDecode_(v);
      else if (t === 'e') val = v != null ? '#ERR' : null;
      else if (t === 'b') val = v === '1';
      else if (v != null) { var f = parseFloat(v); val = isNaN(f) ? xmlDecode_(v) : f; }
      row[ci] = val;
      ci++;
    }
    rows[ri] = row;
    count++;
    if (maxRows && count >= maxRows) break;
  }
  for (var i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/* ---------------- ตัวช่วย ---------------- */

function num_(v) {
  if (v == null || v === '' || typeof v === 'boolean') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var s = String(v).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?([eE]-?\d+)?$/.test(s)) return null;
  return parseFloat(s);
}
function str_(v) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim(); }
function normHdr_(v) { return str_(v).toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim(); }
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function round_(v, d) { if (v == null) return null; var p = Math.pow(10, d); return Math.round(v * p) / p; }

function normProvince_(v) {
  var k = str_(v).toUpperCase().replace(/[^A-Z]/g, '');
  if (PROVINCE_MAP[k]) return PROVINCE_MAP[k];
  for (var p in PROVINCE_MAP) if (k.indexOf(p) >= 0) return PROVINCE_MAP[p]; // เช่น SAMUI-SURAT THANI
  return str_(v);
}

/** ดึงเดือน/ปี จากข้อความ (ชื่อไฟล์หรือชื่อชีต) */
function monthFromText_(s) {
  if (!s) return null;
  var m = s.match(/(?<![A-Za-z0-9])(\d{1,2})\s*[-_ ]\s*(20\d{2})(?!\d)/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { y: +m[2], m: +m[1] };
  m = s.match(/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s*[-_ ]*\s*(20\d{2})/i);
  if (m) return { y: +m[2], m: MONTHS_EN[m[1].toUpperCase()] };
  m = s.match(/(?:^|\D)(0[1-9]|1[0-2])(20\d{2})(?!\d)/);
  if (m) return { y: +m[2], m: +m[1] };
  return null;
}

function excelSerialToStr_(n) {
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()) + ' ' +
    pad2_(d.getUTCHours()) + ':' + pad2_(d.getUTCMinutes());
}

/** 'dd/mm/yyyy HH:MM' | 'dd-mm-yyyy HH:MM' | Date | serial -> 'yyyy-mm-dd HH:MM' */
function dtFromValue_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return v.getFullYear() + '-' + pad2_(v.getMonth() + 1) + '-' + pad2_(v.getDate()) + ' ' + pad2_(v.getHours()) + ':' + pad2_(v.getMinutes());
  }
  if (typeof v === 'number') return v > 30000 ? excelSerialToStr_(v) : '';
  var m = String(v).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return m[3] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[1]) + ' ' + pad2_(+(m[4] || 0)) + ':' + (m[5] || '00');
  m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00');
  return '';
}

/** แบบเก่า: วันที่ = เลขวัน (1–31), เวลา = 19.3 หมายถึง 19:30 */
function dtFromDayTime_(y, mo, day, time) {
  var d = num_(day);
  if (d == null || d < 1 || d > 31) return '';
  var t = num_(time), h = 0, mi = 0;
  if (t == null && !(typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time))) return '';
  if (t != null) {
    h = Math.floor(t);
    mi = Math.round((t - h) * 100);
    if (mi >= 60) mi = Math.round((t - h) * 60);
    if (h > 24) { h = 0; mi = 0; }
  } else if (typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time)) {
    h = +time.split(':')[0]; mi = +time.split(':')[1].slice(0, 2);
  }
  return y + '-' + pad2_(mo) + '-' + pad2_(Math.round(d)) + ' ' + pad2_(h) + ':' + pad2_(mi);
}

function pf_(p, q) {
  if (p == null || q == null) return null;
  var s = Math.sqrt(p * p + q * q);
  return s > 0 ? Math.abs(p) / s : null;
}

/** %Unbalance แบบ NEMA: ค่าเบี่ยงเบนสูงสุดจากค่าเฉลี่ย / ค่าเฉลี่ย */
function ub_(a, b, c) {
  if (a == null || b == null || c == null) return null;
  var avg = (a + b + c) / 3;
  if (avg <= 0) return null;
  return Math.max(Math.abs(a - avg), Math.abs(b - avg), Math.abs(c - avg)) / avg * 100;
}

function typeFromName_(name) {
  var n = str_(name).toUpperCase();
  if (/^INC|BWB/.test(n)) return 'Incoming';
  if (/^(TP|KT|TR|T)\d/.test(n)) return 'Transformer';
  if (/^LINE|YB-\d|-7\d{3}/.test(n)) return 'Line';   // เบรกเกอร์ 115 kV เช่น PK3-70132, ALA03YB-01
  return 'Feeder';
}

/* ---------------- ตรวจหัวตาราง ---------------- */

function detectHeader_(rows) {
  for (var i = 0; i < Math.min(rows.length, 10); i++) {
    var h = (rows[i] || []).map(normHdr_);
    var hasProv = h.indexOf('PROVINCE') >= 0;
    var hasSub = h.indexOf('SUBSTATION') >= 0 || h.indexOf('SUBSTASTION') >= 0;
    if (!hasProv || !hasSub) continue;
    if (h.indexOf('YEAR') >= 0) return null; // ชีตสรุปซ้ำ (Sheet1) ข้าม
    if (h.indexOf('PEAK TIME') >= 0) return { row: i, family: 'v2026', h: h };
    if (h.indexOf('DATE PEAK') >= 0) return { row: i, family: 'old', h: h };
    if (h.indexOf('DATE/TIME') >= 0) return { row: i, family: 'scada', h: h };
  }
  return null;
}

function idx_(h, names) {
  for (var k = 0; k < names.length; k++) { var i = h.indexOf(names[k]); if (i >= 0) return i; }
  return -1;
}
function at_(r, i) { return i >= 0 ? r[i] : null; }

/* ---------------- แปลงแถวตามรูปแบบ ---------------- */

function makeRow_(o) {
  // เติมค่าคำนวณ
  if (o.peak_pf == null) o.peak_pf = pf_(o.peak_mw, o.peak_mvar);
  if (o.light_pf == null) o.light_pf = pf_(o.light_mw, o.light_mvar);
  if (o.peak_pf != null && (o.peak_pf > 1.0001 || o.peak_pf < 0)) o.peak_pf = pf_(o.peak_mw, o.peak_mvar);
  o.ub_pct = ub_(o.peak_ia, o.peak_ib, o.peak_ic);
  // QC: MW ไม่สอดคล้องกับกระแส (เช่นพิมพ์ผิด 80 แทน 2.8)
  o.qc = '';
  var ia = [o.peak_ia, o.peak_ib, o.peak_ic].filter(function (x) { return x != null && x > 0; });
  if (o.type === 'Feeder' && o.peak_mw != null && ia.length === 3 && o.peak_kv != null && o.peak_kv > 20 && o.peak_kv < 130) {
    var iavg = (ia[0] + ia[1] + ia[2]) / 3;
    if (iavg >= 10) {
      var est = Math.sqrt(3) * o.peak_kv * iavg / 1000;
      var ratio = Math.abs(o.peak_mw) / est;
      if (ratio > 2.5 || ratio < 0.3) o.qc = 'MW?';
    }
  }
  // ฟีดเดอร์ 33 kV: แรงดันผิดช่วง (คอลัมน์เลื่อน) หรือ MW เกินจริง
  if (o.type === 'Feeder' && ((o.peak_kv != null && o.peak_kv !== 0 && (o.peak_kv < 25 || o.peak_kv > 40)) || (o.peak_mw != null && Math.abs(o.peak_mw) > 40))) o.qc = 'MW?';
  return LOAD_HEADERS.map(function (k) {
    var v = o[k];
    if (typeof v === 'number') {
      if (/_pf$|^lf$/.test(k)) return round_(v, 4);
      if (k === 'ub_pct') return round_(v, 2);
      return round_(v, 3);
    }
    return v == null ? '' : v;
  });
}

function hasData_(o) {
  return [o.peak_mw, o.peak_ia, o.peak_ib, o.peak_ic, o.light_mw].some(function (v) { return v != null && v !== 0; });
}

function parseOld_(rows, hd, ym, ctx) {
  var h = hd.h, out = [];
  var c = {
    prov: idx_(h, ['PROVINCE']), sub: idx_(h, ['SUBSTATION']), kind: idx_(h, ['CODE']),
    codeOf: h.findIndex(function (x) { return x.indexOf('CODE OF') === 0; }),
    size: idx_(h, ['SIZE OF TR']), rating: idx_(h, ['AMP OR MVA', 'CT OR MVA']), lf: idx_(h, ['LOAD FACTOR']),
    dP: idx_(h, ['DATE PEAK']), tP: idx_(h, ['TIME PEAK']),
    ia: idx_(h, ['IA PEAK']), ib: idx_(h, ['IB PEAK']), ic: idx_(h, ['IC PEAK']),
    mw: idx_(h, ['MW PEAK']), mvar: idx_(h, ['MVAR PEAK']), pf: idx_(h, ['PF PEAK']),
    dL: idx_(h, ['DATE LIGHT']), tL: idx_(h, ['TIME LIGHT']), kvL: idx_(h, ['KV LIGHT']),
    mwL: idx_(h, ['MW LIGHT']), mvarL: idx_(h, ['MVAR LIGHT']), pfL: idx_(h, ['PF LIGHT']),
    area: idx_(h, ['DISTRIBUTION AREA'])
  };
  c.kvP = idx_(h, ['KV PEAK']); if (c.kvP < 0 && c.tP >= 0) c.kvP = c.tP + 1;
  c.name = idx_(h, ['BREAKER', 'FEEDER']); if (c.name < 0 && c.size >= 0) c.name = c.size + 1;
  var lastProv = '';
  for (var i = hd.row + 1; i < rows.length; i++) {
    var r = rows[i] || [];
    var sub = str_(at_(r, c.sub)).toUpperCase();
    if (!sub || sub === 'SUBSTATION') continue;
    var prov = str_(at_(r, c.prov)) || lastProv; lastProv = prov;
    var kind = str_(at_(r, c.kind)).toUpperCase();
    var codeOf = str_(at_(r, c.codeOf)).toUpperCase();
    var nm = str_(at_(r, c.name)).toUpperCase();
    var type, feeder;
    if (/FD/.test(kind)) { type = 'Feeder'; feeder = nm || codeOf; }
    else if (/INC/.test(kind)) {
      type = 'Incoming';
      var mm = nm.match(/(\d{2})BWB/);
      feeder = /^INC\d+/.test(codeOf) ? codeOf : (mm ? 'INC' + mm[1] : nm);
    } else if (/^TR/.test(kind)) { type = 'Transformer'; feeder = codeOf || nm; }
    else if (/115|LINE/.test(kind)) { type = 'Line'; feeder = nm || codeOf; }
    else if (!kind && codeOf && /^(TP|KT)/.test(codeOf)) { type = 'Transformer'; feeder = codeOf; }
    else { feeder = nm || codeOf; type = typeFromName_(feeder); }
    if (!feeder) continue;
    var o = {
      ym: ym.y + '-' + pad2_(ym.m), year: ym.y, month: ym.m, province: normProvince_(prov), substation: sub, type: type, feeder: feeder,
      peak_time: dtFromDayTime_(ym.y, ym.m, at_(r, c.dP), at_(r, c.tP)),
      peak_kv: num_(at_(r, c.kvP)), peak_ia: num_(at_(r, c.ia)), peak_ib: num_(at_(r, c.ib)), peak_ic: num_(at_(r, c.ic)),
      peak_mw: num_(at_(r, c.mw)), peak_mvar: num_(at_(r, c.mvar)), peak_pf: num_(at_(r, c.pf)),
      light_time: dtFromDayTime_(ym.y, ym.m, at_(r, c.dL), at_(r, c.tL)),
      light_kv: num_(at_(r, c.kvL)), light_ia: null, light_ib: null, light_ic: null,
      light_mw: num_(at_(r, c.mwL)), light_mvar: num_(at_(r, c.mvarL)), light_pf: num_(at_(r, c.pfL)),
      lf: num_(at_(r, c.lf)), rating: num_(at_(r, c.rating)), area: str_(at_(r, c.area)),
      source_file: ctx.file, sheet: ctx.sheet
    };
    if (o.lf != null && (o.lf <= 0 || o.lf > 1.5)) o.lf = null;
    if (!hasData_(o)) continue;
    out.push(o);
  }
  return out;
}

function parseScada_(rows, hd, ym, ctx) {
  var h = hd.h, out = [];
  var d1 = h.indexOf('DATE/TIME'), d2 = -1;
  for (var k = d1 + 1; k < h.length; k++) if (/^DATE\/TIME/.test(h[k])) { d2 = k; break; }
  var cP = idx_(h, ['PROVINCE']), cS = idx_(h, ['SUBSTASTION', 'SUBSTATION']), cF = idx_(h, ['FEEDER']);
  for (var i = hd.row + 1; i < rows.length; i++) {
    var r = rows[i] || [];
    var sub = str_(at_(r, cS)).toUpperCase(), feeder = str_(at_(r, cF)).toUpperCase();
    if (!sub || !feeder || /ERR/.test(feeder) || /^\d+$/.test(feeder) || sub === 'SUBSTASTION') continue;
    var o = {
      ym: ym.y + '-' + pad2_(ym.m), year: ym.y, month: ym.m, province: normProvince_(at_(r, cP)), substation: sub,
      type: typeFromName_(feeder), feeder: feeder,
      peak_time: dtFromValue_(at_(r, d1)), peak_kv: num_(at_(r, d1 + 1)),
      peak_ia: num_(at_(r, d1 + 2)), peak_ib: num_(at_(r, d1 + 3)), peak_ic: num_(at_(r, d1 + 4)),
      peak_mw: num_(at_(r, d1 + 5)), peak_mvar: num_(at_(r, d1 + 6)), peak_pf: num_(at_(r, d1 + 7)),
      light_time: d2 > 0 ? dtFromValue_(at_(r, d2)) : '', light_kv: d2 > 0 ? num_(at_(r, d2 + 1)) : null,
      light_ia: d2 > 0 ? num_(at_(r, d2 + 2)) : null, light_ib: d2 > 0 ? num_(at_(r, d2 + 3)) : null, light_ic: d2 > 0 ? num_(at_(r, d2 + 4)) : null,
      light_mw: d2 > 0 ? num_(at_(r, d2 + 5)) : null, light_mvar: d2 > 0 ? num_(at_(r, d2 + 6)) : null, light_pf: d2 > 0 ? num_(at_(r, d2 + 7)) : null,
      lf: null, rating: null, area: '', source_file: ctx.file, sheet: ctx.sheet
    };
    if (!hasData_(o)) continue;
    out.push(o);
  }
  return out;
}

function parseV2026_(rows, hd, ym, ctx) {
  var h = hd.h, out = [];
  var g = function (n) { return idx_(h, [n]); };
  var c = {
    prov: g('PROVINCE'), sub: idx_(h, ['SUBSTATION', 'SUBSTASTION']), type: g('TYPE'), feeder: g('FEEDER'),
    pt: g('PEAK TIME'), pkv: g('PEAK KV'), pia: g('PEAK IA'), pib: g('PEAK IB'), pic: g('PEAK IC'), pp: g('PEAK P'), pq: g('PEAK Q'), ppf: g('PEAK PF'),
    lt: g('LIGHT TIME'), lkv: g('LIGHT KV'), lia: g('LIGHT IA'), lib: g('LIGHT IB'), lic: g('LIGHT IC'), lp: g('LIGHT P'), lq: g('LIGHT Q'), lpf: g('LIGHT PF'),
    lf: g('LF'), area: idx_(h, ['AREA', 'DISTRIBUTION AREA'])
  };
  for (var i = hd.row + 1; i < rows.length; i++) {
    var r = rows[i] || [];
    var sub = str_(at_(r, c.sub)).toUpperCase(), feeder = str_(at_(r, c.feeder)).toUpperCase();
    if (!sub || !feeder) continue;
    var t = str_(at_(r, c.type));
    var o = {
      ym: ym.y + '-' + pad2_(ym.m), year: ym.y, month: ym.m, province: normProvince_(at_(r, c.prov)), substation: sub,
      type: t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : typeFromName_(feeder), feeder: feeder,
      peak_time: dtFromValue_(at_(r, c.pt)), peak_kv: num_(at_(r, c.pkv)), peak_ia: num_(at_(r, c.pia)), peak_ib: num_(at_(r, c.pib)), peak_ic: num_(at_(r, c.pic)),
      peak_mw: num_(at_(r, c.pp)), peak_mvar: num_(at_(r, c.pq)), peak_pf: num_(at_(r, c.ppf)),
      light_time: dtFromValue_(at_(r, c.lt)), light_kv: num_(at_(r, c.lkv)), light_ia: num_(at_(r, c.lia)), light_ib: num_(at_(r, c.lib)), light_ic: num_(at_(r, c.lic)),
      light_mw: num_(at_(r, c.lp)), light_mvar: num_(at_(r, c.lq)), light_pf: num_(at_(r, c.lpf)),
      lf: num_(at_(r, c.lf)), rating: null, area: str_(at_(r, c.area)), source_file: ctx.file, sheet: ctx.sheet
    };
    if (o.peak_ia === 0 && o.peak_ib === 0 && o.peak_ic === 0) { o.peak_ia = o.peak_ib = o.peak_ic = null; }
    if (o.light_ia === 0 && o.light_ib === 0 && o.light_ic === 0) { o.light_ia = o.light_ib = o.light_ic = null; }
    if (!hasData_(o)) continue;
    out.push(o);
  }
  return out;
}

/**
 * แปลงไฟล์ 1 ไฟล์ → { rows: [[...LOAD_HEADERS]], months: ['2026-09'], log: [] }
 * zip = { text(path) -> string|null }
 */
function parseLoadWorkbook(fileName, zip) {
  var log = [];
  var fileYm = monthFromText_(fileName.replace(/\.xlsx?$/i, ''));
  var sheets = wbSheetList_(zip);
  var ss = null;
  var seen = {}, result = [], months = {};
  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    var sheetYm = monthFromText_(sh.name);
    if (fileYm && sheetYm && (sheetYm.y !== fileYm.y || sheetYm.m !== fileYm.m)) {
      // ไฟล์ระบุเดือนไว้แล้ว ชีตเดือนอื่นเป็นสำเนาเก่า — ข้าม (เว้นแต่ไม่มีชีตอื่นเลย จัดการด้านล่าง)
      sh.otherMonth = true;
    }
  }
  // รอบแรก: ชีตเดือนตรงกับชื่อไฟล์ (หรือไม่ระบุเดือน) / รอบสอง: ถ้ายังไม่ได้ข้อมูล ใช้ชีตที่ตั้งชื่อเดือนผิด
  for (var pass = 0; pass < 2; pass++) {
    if (pass === 1 && result.length) break;
    for (var s2 = 0; s2 < sheets.length; s2++) {
      var sh2 = sheets[s2];
      if (pass === 0 && sh2.otherMonth) continue;
      if (pass === 1 && !sh2.otherMonth) continue;
      var ym = fileYm || monthFromText_(sh2.name);
      if (!ym) continue;
      var xml = zip.text(sh2.path);
      if (!xml) continue;
      if (ss === null) ss = sharedStrings_(zip);
      var head = sheetRows_(xml.slice(0, 200000), ss, 10);
      var hd = detectHeader_(head);
      if (!hd) continue;
      var rows = sheetRows_(xml, ss, 0);
      xml = null;
      var ctx = { file: fileName, sheet: sh2.name };
      var parsed = hd.family === 'old' ? parseOld_(rows, hd, ym, ctx)
        : hd.family === 'scada' ? parseScada_(rows, hd, ym, ctx) : parseV2026_(rows, hd, ym, ctx);
      var added = 0;
      parsed.forEach(function (o) {
        var key = o.ym + '|' + o.substation + '|' + o.type + '|' + o.feeder;
        if (seen[key]) return;
        seen[key] = 1; result.push(makeRow_(o)); months[o.ym] = 1; added++;
      });
      log.push(sh2.name + ' [' + hd.family + '] ' + ym.y + '-' + pad2_(ym.m) + ': ' + added + ' แถว');
      // ไฟล์รายเดือน: ได้ข้อมูลครบจากชีตหลักแล้ว ไม่ต้องอ่านชีตสำเนาที่เหลือ (ประหยัดเวลา/หน่วยความจำ)
      if (fileYm && added >= 100) break;
    }
  }
  return { rows: result, months: Object.keys(months).sort(), log: log };
}

if (typeof module !== 'undefined') module.exports = { parseLoadWorkbook: parseLoadWorkbook, LOAD_HEADERS: LOAD_HEADERS };
