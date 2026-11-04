/**
 * Analysis.gs — สร้างข้อมูลย่อ (JSON) สำหรับหน้า Dashboard จากแถวในชีต Data
 * - เดือนเดียวกันมีหลายไฟล์ → ใช้ไฟล์ที่ชื่อระบุเดือนนั้น (ไฟล์รายเดือน) ก่อนไฟล์รวม
 * - ติดธงค่าที่ "ซ้ำกับเดือนก่อนทุกตัว" (ต้นทางคัดลอกมา) และ MW ไม่สอดคล้องกับกระแส
 */
function buildDashboardData(header, rows, fileNames) {
  var I = {};
  header.forEach(function (h, i) { I[h] = i; });
  fileNames = fileNames || {};

  // 1) เลือกไฟล์ต้นทางหนึ่งไฟล์ต่อเดือน
  var byYm = {};
  rows.forEach(function (r) {
    var ym = String(r[I.ym]); var src = String(r[I.file_id] || r[I.source_file]);
    byYm[ym] = byYm[ym] || {};
    byYm[ym][src] = (byYm[ym][src] || 0) + 1;
  });
  var chosen = {};
  Object.keys(byYm).forEach(function (ym) {
    var best = null, bestScore = -1;
    Object.keys(byYm[ym]).forEach(function (src) {
      var name = fileNames[src] || src;
      var fm = monthFromText_(String(name).replace(/\.xlsx?$/i, ''));
      var dedicated = fm && (fm.y + '-' + pad2_(fm.m)) === ym ? 1e6 : 0;
      var score = dedicated + byYm[ym][src];
      if (score > bestScore) { bestScore = score; best = src; }
    });
    chosen[ym] = best;
  });

  var months = Object.keys(chosen).sort();
  var mIdx = {}; months.forEach(function (m, i) { mIdx[m] = i; });

  // 2) ตารางฟีดเดอร์ + แถวข้อมูลย่อ
  var feeders = [], fIdx = {};
  var recs = [];
  var hour = function (s) {
    var m = String(s || '').match(/ (\d{2}):(\d{2})$/);
    return m ? +m[1] + (+m[2]) / 60 : null;
  };
  var n = function (v) { return v === '' || v == null ? null : +v; };
  rows.forEach(function (r) {
    var ym = String(r[I.ym]);
    var src = String(r[I.file_id] || r[I.source_file]);
    if (chosen[ym] !== src) return;
    var key = r[I.substation] + '|' + r[I.feeder];
    if (fIdx[key] == null) {
      fIdx[key] = feeders.length;
      feeders.push([r[I.province], r[I.substation], r[I.type], r[I.feeder], r[I.area] || '', ym]);
    } else {
      var fe = feeders[fIdx[key]];
      if (ym >= fe[5]) { fe[0] = r[I.province]; fe[2] = r[I.type]; fe[5] = ym; } // ใช้ชื่อจังหวัด/ประเภทล่าสุด
      if (r[I.area] && !fe[4]) fe[4] = r[I.area];
    }
    recs.push([
      mIdx[ym], fIdx[key], n(r[I.peak_mw]), n(r[I.peak_mvar]), n(r[I.peak_kv]),
      n(r[I.peak_ia]), n(r[I.peak_ib]), n(r[I.peak_ic]), n(r[I.light_mw]),
      hour(r[I.peak_time]), hour(r[I.light_time]), n(r[I.ub_pct]), n(r[I.peak_pf]), n(r[I.lf]),
      r[I.qc] === 'MW?' ? 2 : 0, String(r[I.peak_time] || '').slice(8, 10)
    ]);
  });

  // 3) ธง "ซ้ำเดือนก่อน"
  recs.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  for (var i = 1; i < recs.length; i++) {
    var a = recs[i - 1], b = recs[i];
    if (a[1] !== b[1] || b[0] - a[0] !== 1) continue;
    var same = a[2] === b[2] && a[5] === b[5] && a[6] === b[6] && a[7] === b[7] && a[15] === b[15];
    if (same && (b[2] || b[5])) b[14] = b[14] || 1;
  }
  recs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  recs.forEach(function (r) {
    for (var k = 2; k < 14; k++) if (typeof r[k] === 'number') r[k] = Math.round(r[k] * 1000) / 1000;
    r.pop(); // ตัดวันที่ peak (ใช้ตรวจซ้ำเท่านั้น)
  });

  feeders.forEach(function (f) { f.pop(); });
  return {
    generated: new Date().toISOString(),
    months: months,
    feeders: feeders,
    cols: ['m', 'f', 'mw', 'mvar', 'kv', 'ia', 'ib', 'ic', 'lmw', 'ph', 'lh', 'ub', 'pf', 'lf', 'q'],
    rows: recs,
    sources: months.map(function (m) { return fileNames[chosen[m]] || chosen[m]; })
  };
}

if (typeof module !== 'undefined') module.exports = { buildDashboardData: buildDashboardData };
