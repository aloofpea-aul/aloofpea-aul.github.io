/**
 * Parser.gs — แปลงตาราง (getDisplayValues) ของชีตแผนปฏิบัติการ K04 ให้เป็นโครงข้อมูลสำหรับหน้าเว็บ
 * ไม่มีการเขียนข้อมูลใดๆ ในไฟล์นี้ (อ่านอย่างเดียว)
 */

var K04_CODE_RE = /^\s*(\d+(?:\.\d+)+|\d+\.)\s*(.*)$/;      // 1.1 / 1.4.1 / 1.
var K04_OFFICE_RE = /^\s*(กฟ[จส]\.[^,(]*?)\s*(\([^)]*\))?\s*$/; // กฟส.อ่าวลึก (ALA03)

function k04Cell_(row, i) {
  var v = row && row[i] !== undefined && row[i] !== null ? String(row[i]) : '';
  return v.replace(/\s+/g, ' ').trim();
}

/** คืนค่าเฉพาะที่เป็นตัวเลข (กันหัวคอลัมน์ "คะแนน"/"เต็ม" ที่อยู่แถวเดียวกับกิจกรรม) */
function k04Num_(v) {
  return /^-?\d+(\.\d+)?%?$/.test(String(v).replace(/,/g, '')) ? v : '';
}

function k04Empty_(v) {
  return v === '' || v === '-' || v === '–';
}

/** หา layout คอลัมน์จากหัวตาราง: คืน null ถ้าชีตนี้ไม่ใช่ชีตแผนงาน */
function k04FindLayout_(values) {
  for (var r = 0; r < Math.min(values.length, 60); r++) {
    if (k04Cell_(values[r], 3) === 'เป้า Q1' && k04Cell_(values[r], 4) === 'ผล Q1') {
      var scoreCols = [], scoreHdr = r + 1;
      for (var rr = r + 1; rr <= r + 3 && rr < values.length && !scoreCols.length; rr++) {
        var sr = values[rr] || [];
        for (var c = 0; c < sr.length; c++) if (k04Cell_(sr, c) === 'คะแนน') scoreCols.push(c);
        if (scoreCols.length) scoreHdr = rr;
      }
      var q = [];
      for (var k = 0; k < 4; k++) {
        var sc = scoreCols[k];
        q.push({
          t: 3 + k * 2, r: 4 + k * 2,
          ratio: sc !== undefined ? sc - 1 : -1,
          score: sc !== undefined ? sc : -1,
          full: sc !== undefined ? sc + 1 : -1,
          note: sc !== undefined ? sc - 2 : -1
        });
      }
      return { headerRow: r, dataStart: r + 1, q: q, resp: 11, doer: 12 };
    }
  }
  return null;
}

function k04HasNumbers_(row, L) {
  for (var k = 0; k < 4; k++) {
    if (!k04Empty_(k04Cell_(row, L.q[k].t)) || !k04Empty_(k04Cell_(row, L.q[k].r))) return true;
  }
  return !k04Empty_(k04Cell_(row, 2));
}

function k04RowData_(row, L, rowIndex) {
  var qs = L.q.map(function (c) {
    return {
      t: k04Cell_(row, c.t), r: k04Cell_(row, c.r),
      score: k04Num_(c.score >= 0 ? k04Cell_(row, c.score) : ''),
      full: k04Num_(c.full >= 0 ? k04Cell_(row, c.full) : ''),
      note: c.note >= 0 && k04Cell_(row, c.note) !== 'Note' ? k04Cell_(row, c.note) : ''
    };
  });
  return { row: rowIndex + 1, unit: k04Cell_(row, 2), q: qs };
}

function k04Strategy_(sheetName) {
  var m = /\(([A-Z]+\d*)\)/.exec(sheetName);
  return m ? m[1] : sheetName;
}

/**
 * แยกกิจกรรมจากชีต
 * คืน {name, strategy, activities:[{key, code, title, plan, flag, desc[], resp, doer, rows:[{label, office, scope, row, unit, q[4]}]}]}
 */
function k04ParseSheet(sheetName, values) {
  var L = k04FindLayout_(values);
  if (!L) return null;
  var out = { name: sheetName, strategy: k04Strategy_(sheetName), activities: [] };
  var plan = '', planRow = -99, cur = null, seen = {}, group = '';  var gCount = {};

  function push() { if (cur) out.activities.push(cur); cur = null; }

  for (var r = L.dataStart; r < values.length; r++) {
    var row = values[r];
    var a = k04Cell_(row, 0), b = k04Cell_(row, 1);
    if (/^แผนงาน/.test(a)) { plan = a; planRow = r; }
    else if (plan && a && r - planRow <= 3 && !/^(ยกเลิก|เพิ่ม|\*)/.test(a)) {
      plan += ' ' + a; planRow = r;
      if (cur) cur.plan = plan;
    }

    var mCode = K04_CODE_RE.exec(b);
    // เลขข้อเดี่ยว "6." ที่ไม่มีเป้า/หน่วยในแถว และไม่ใช่แถวแผนงาน = ข้อย่อยภายในกิจกรรม ไม่ใช่กิจกรรมใหม่
    // หรือเลขข้อเดี่ยวที่ตามหลังกิจกรรมรหัสหลายระดับ (เช่น 4.3 → 1. ระบบสายส่ง) = ตัวชี้วัดย่อยของกิจกรรมนั้น
    if (mCode && cur && /^\d+\.$/.test(mCode[1]) && !/^แผนงาน/.test(a) &&
        (!k04HasNumbers_(row, L) || cur.code.indexOf('.') >= 0)) mCode = null;
    var mOff = K04_OFFICE_RE.exec(b);

    if (mCode && !mOff) {
      push(); group = ''; gCount = {};
      var code = mCode[1].replace(/\.$/, '');
      var title = mCode[2];
      var base = out.strategy + '|' + code + '|' + title.slice(0, 40);
      seen[base] = (seen[base] || 0) + 1;
      cur = {
        key: base + (seen[base] > 1 ? '#' + seen[base] : ''),
        code: code, title: title, plan: plan,
        flag: /^ยกเลิก/.test(a) ? 'ยกเลิก' : (/^เพิ่ม/.test(a) ? 'เพิ่มใหม่' : ''),
        desc: [], resp: k04Cell_(row, L.resp), doer: k04Cell_(row, L.doer),
        row: r + 1, rows: []
      };
      if (k04HasNumbers_(row, L)) {
        var d0 = k04RowData_(row, L, r);
        d0.label = 'เป้าหมายรวม'; d0.office = ''; d0.scope = 'all'; d0.group = '';
        cur.rows.push(d0);
      }
      continue;
    }
    if (!cur) continue;

    if (!cur.resp && k04Cell_(row, L.resp)) cur.resp = k04Cell_(row, L.resp);
    else if (k04Cell_(row, L.resp) && cur.rows.length === 0 && cur.resp.indexOf(k04Cell_(row, L.resp)) < 0) cur.resp += ' ' + k04Cell_(row, L.resp);
    if (!cur.doer && k04Cell_(row, L.doer)) cur.doer = k04Cell_(row, L.doer);

    if (mOff) {
      var office = mOff[1].trim();
      var province = /และ\s*(สังกัด|กฟฟ)/.test(b);
      var d = k04RowData_(row, L, r);
      d.label = b; d.office = province ? '' : office; d.scope = province ? 'province' : 'office'; d.group = group;
      var gk = d.office + '|' + group.slice(0, 40);
      gCount[gk] = (gCount[gk] || 0) + 1;
      d.gk = group.slice(0, 40) + (gCount[gk] > 1 ? '#' + gCount[gk] : '');   // ใช้ทำ key บันทึกของเรา
      cur.rows.push(d);
      continue;
    }
    if (k04HasNumbers_(row, L)) {
      var s = k04RowData_(row, L, r);
      s.label = b ? b.replace(/^>\s*/, '') : '(ต่อจากแถวบน)'; s.office = ''; s.scope = 'all';
      if (b) group = s.label;   // แถว กฟฟ. ที่ตามมาเป็นของตัวชี้วัดย่อยนี้
      s.group = group;
      cur.rows.push(s);
      continue;
    }
    if (b) {
      cur.desc.push(b);
      if (/^\d+\.\s|^\(\d+\)/.test(b)) group = b;   // ข้อย่อยที่มีแถว กฟฟ. ตามมา
    }
  }
  push();

  // ต่อชื่อกิจกรรมให้ครบ: บรรทัดคำอธิบายก่อนคำว่า "เป้าหมาย" ที่ยังเป็นประโยคต่อเนื่อง
  out.activities.forEach(function (act) {
    var i = 0;
    while (i < act.desc.length && !/^(เป้าหมาย|[-–>*(]|\(|หมายเหตุ)/.test(act.desc[i]) && act.title.length < 160) {
      act.title += ' ' + act.desc[i]; i++;
    }
    act.desc = act.desc.slice(i);
  });
  return out;
}

/** แยกหน้า สารบัญ: ความสำเร็จสะสมรายด้าน */
function k04ParseSummary(values) {
  var res = { items: [], total: null, header: [] };
  var hdr = -1;
  for (var r = 0; r < values.length; r++) {
    if (k04Cell_(values[r], 5) === 'ไตรมาส 1') { hdr = r; break; }
  }
  if (hdr < 0) return res;
  res.header = [5, 6, 7, 8].map(function (c) { return k04Cell_(values[hdr], c); });
  var persp = '';
  for (var r2 = hdr + 1; r2 < values.length; r2++) {
    var row = values[r2];
    if (k04Cell_(row, 0)) persp = k04Cell_(row, 0);
    var nums = [5, 6, 7, 8].map(function (c) { return k04Cell_(row, c); });
    if (!nums.some(function (n) { return /^\d/.test(n); })) continue;
    var c2 = k04Cell_(row, 2);
    var m = /^([A-Z]+\d+)/.exec(c2);
    var code = m ? m[1] : 'Goal';
    if (!k04Cell_(row, 0) && !c2 && !k04Cell_(row, 3) && !k04Cell_(row, 4)) { res.total = nums; continue; }
    res.items.push({ perspective: persp, code: code, name: c2 || k04Cell_(row, 3), q: nums });
  }
  return res;
}
