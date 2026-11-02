/**
 * K04 แผนปฏิบัติการ กฟจ.กระบี่ ปี 2569 — สำเนา อ่าวลึก
 * - ซิงค์ค่าจากต้นฉบับวันละครั้ง (อ่านต้นฉบับอย่างเดียว ไม่เขียนกลับ)
 * - ค่าที่ลงผ่านมือถือเก็บในชีต "_บันทึกของเรา" ซึ่งการซิงค์ไม่แตะเลย
 * - หน้าเว็บอยู่บน GitHub Pages: aloofpea-aul.github.io/k04/ (ศูนย์รวมงาน) เรียก API นี้
 */

var CONFIG = {
  SRC_ID: '1cOhijPPm3W079pM0EEZQONPKNao_cFGqubcMVxjPc9g',   // ต้นฉบับ (อ่านอย่างเดียว)
  DST_ID: '1k-x9dTYXPOyWa8Uf2hl-uG5-yNWIDuC1ICvwyel-nAk',   // ไฟล์ของเรา
  OVERLAY: '_บันทึกของเรา',
  LOG: '_ประวัติซิงค์',
  TMP_PREFIX: '__tmp__',
  SYNC_HOUR: 6,              // ซิงค์ทุกวันราว 06:00 น.
  DEFAULT_OFFICE: 'กฟส.อ่าวลึก',
  CACHE_KEY: 'k04_data_v1'
};

var OVERLAY_HEADER = ['key', 'ชีต', 'รหัส', 'กิจกรรม', 'กฟฟ.', 'ไตรมาส', 'ผล (ของเรา)', 'หมายเหตุ/ลิงก์',
  'ค่าต้นฉบับตอนบันทึก', 'ผู้บันทึก', 'เวลาบันทึก'];

/* ======================= ติดตั้งครั้งแรก ======================= */

/** รันครั้งเดียว: สร้างชีตของเรา + ตั้งเวลาซิงค์รายวัน + ซิงค์รอบแรก */
function setup() {
  var ss = SpreadsheetApp.openById(CONFIG.DST_ID);
  ensureOwnSheets_(ss);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'dailySync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySync').timeBased().everyDays(1).atHour(CONFIG.SYNC_HOUR)
    .inTimezone('Asia/Bangkok').create();
  syncFromSource(true);
}

function ensureOwnSheets_(ss) {
  var ov = ss.getSheetByName(CONFIG.OVERLAY);
  if (!ov) {
    ov = ss.insertSheet(CONFIG.OVERLAY);
    ov.getRange(1, 1, 1, OVERLAY_HEADER.length).setValues([OVERLAY_HEADER]).setFontWeight('bold').setBackground('#e8f0fe');
    ov.setFrozenRows(1);
    ov.getRange('A:K').setNumberFormat('@'); // เก็บเป็นข้อความ กันตัวเลข/วันที่ถูกแปลง
  }
  var lg = ss.getSheetByName(CONFIG.LOG);
  if (!lg) {
    lg = ss.insertSheet(CONFIG.LOG);
    lg.getRange(1, 1, 1, 5).setValues([['เวลา', 'ผล', 'จำนวนชีต', 'ต้นฉบับแก้ไขล่าสุด', 'รายละเอียด']]).setFontWeight('bold');
    lg.setFrozenRows(1);
  }
  return { overlay: ov, log: lg };
}

/* ======================= ซิงค์จากต้นฉบับ ======================= */

function dailySync() { syncFromSource(false); }

/**
 * ดึงทุกชีตจากต้นฉบับมาเป็น "ค่า" (รูปแบบ/การผสานเซลล์เหมือนต้นฉบับ)
 * ขั้นตอนปลอดภัย: สร้างชีตชั่วคราวให้ครบทุกชีตก่อน → ถ้าพลาดแม้ชีตเดียว ลบชั่วคราวทิ้ง ข้อมูลเดิมยังอยู่ครบ
 * → ถ้าครบ ค่อยสลับแทนของเดิมทีเดียว   ชีต _บันทึกของเรา / _ประวัติซิงค์ ไม่ถูกแตะ
 */
function syncFromSource(force) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(60 * 1000)) throw new Error('มีการซิงค์ค้างอยู่ ลองใหม่อีกครั้ง');
  var dst = SpreadsheetApp.openById(CONFIG.DST_ID);
  var own = ensureOwnSheets_(dst);
  var props = PropertiesService.getScriptProperties();
  var srcUpdated = DriveApp.getFileById(CONFIG.SRC_ID).getLastUpdated();
  try {
    if (!force && props.getProperty('SRC_UPDATED') === String(srcUpdated.getTime())) {
      writeLog_(own.log, 'ไม่มีการเปลี่ยนแปลง', '', srcUpdated, 'ข้าม');
      props.setProperty('LAST_CHECK', new Date().toISOString());
      return { status: 'unchanged' };
    }
    var src = SpreadsheetApp.openById(CONFIG.SRC_ID);
    var srcSheets = src.getSheets();
    var ownNames = [CONFIG.OVERLAY, CONFIG.LOG];

    // เก็บกวาดชีตชั่วคราวที่อาจค้างจากรอบก่อน
    dst.getSheets().forEach(function (sh) {
      if (sh.getName().indexOf(CONFIG.TMP_PREFIX) === 0) dst.deleteSheet(sh);
    });

    var temps = [];
    try {
      srcSheets.forEach(function (s) {
        if (ownNames.indexOf(s.getName()) >= 0) return; // กันชื่อชนกับชีตของเรา
        var t = s.copyTo(dst);
        t.setName(CONFIG.TMP_PREFIX + temps.length);
        var lr = s.getLastRow(), lc = s.getLastColumn();
        if (lr > 0 && lc > 0) {
          var vals = s.getRange(1, 1, lr, lc).getValues();   // ค่าที่คำนวณแล้วจากต้นฉบับ
          var rng = t.getRange(1, 1, lr, lc);
          rng.clearDataValidations();
          rng.setValues(vals);                                // แทนสูตรด้วยค่า
          // ตรวจซ้ำว่าเขียนครบ: เทียบค่าที่แสดงผลทุกเซลล์กับต้นฉบับ
          var a = s.getRange(1, 1, lr, lc).getDisplayValues();
          var diffs = listDiff_(a, rng.getDisplayValues());
          if (diffs.length > 300) throw new Error('ชีต "' + s.getName() + '" คัดลอกไม่ตรง ' + diffs.length + ' เซลล์');
          // เซลล์ที่ Sheets แปลงค่าเอง (เช่น ข้อความที่หน้าตาเหมือนตัวเลข/วันที่) → ใส่เป็นข้อความตามที่ต้นฉบับแสดง
          diffs.forEach(function (d) {
            t.getRange(d[0] + 1, d[1] + 1).setNumberFormat('@').setValue(a[d[0]][d[1]]);
          });
          if (diffs.length) {
            var left = listDiff_(a, rng.getDisplayValues()).length;
            if (left > 0) throw new Error('ชีต "' + s.getName() + '" ยังไม่ตรง ' + left + ' เซลล์');
          }
        }
        temps.push({ name: s.getName(), sheet: t, hidden: s.isSheetHidden() });
      });
    } catch (e) {
      temps.forEach(function (x) { try { dst.deleteSheet(x.sheet); } catch (e2) {} });
      throw e;
    }

    // สลับ: ลบชีตสำเนาเดิม (ยกเว้นชีตของเรา) แล้วตั้งชื่อชีตใหม่
    dst.getSheets().forEach(function (sh) {
      var n = sh.getName();
      if (ownNames.indexOf(n) < 0 && n.indexOf(CONFIG.TMP_PREFIX) !== 0) dst.deleteSheet(sh);
    });
    temps.forEach(function (x, i) {
      x.sheet.setName(x.name);
      dst.setActiveSheet(x.sheet);
      dst.moveActiveSheet(i + 1);
      if (x.hidden) x.sheet.hideSheet();
    });
    own.overlay.activate(); dst.moveActiveSheet(dst.getSheets().length);
    own.log.activate(); dst.moveActiveSheet(dst.getSheets().length);
    dst.setActiveSheet(dst.getSheets()[0]);

    props.setProperty('SRC_UPDATED', String(srcUpdated.getTime()));
    props.setProperty('LAST_SYNC', new Date().toISOString());
    props.setProperty('LAST_CHECK', new Date().toISOString());
    clearDataCache_();
    writeLog_(own.log, 'สำเร็จ', temps.length, srcUpdated, temps.map(function (x) { return x.name; }).join(', '));
    return { status: 'synced', sheets: temps.length };
  } catch (err) {
    writeLog_(own.log, 'ผิดพลาด', '', srcUpdated, String(err && err.message || err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function listDiff_(a, b) {
  var out = [];
  for (var i = 0; i < a.length; i++) for (var j = 0; j < a[i].length; j++) {
    if (String(a[i][j]) !== String((b[i] || [])[j])) out.push([i, j]);
  }
  return out;
}

function writeLog_(sheet, status, count, srcUpdated, detail) {
  sheet.insertRowAfter(1);
  sheet.getRange(2, 1, 1, 5).setValues([[new Date(), status, count, srcUpdated, String(detail).slice(0, 500)]]);
  if (sheet.getLastRow() > 400) sheet.deleteRows(401, sheet.getLastRow() - 400);
}

/* ======================= เว็บแอป ======================= */

/**
 * API สำหรับหน้าเว็บบน GitHub Pages (k04/index.html)
 *  GET  ?action=data                     → ข้อมูลทั้งหมด (อ่านอย่างเดียว)
 *  POST {action:'save'|'delete'|'sync'}  → เขียนเฉพาะชีต _บันทึกของเรา / สั่งซิงค์
 * Deploy เป็น Web app: ดำเนินการในฐานะ "ฉัน", ผู้มีสิทธิ์เข้าถึง "ทุกคน"
 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'data';
  try {
    if (action === 'data') return jsonOut_(apiGetData());
    if (action === 'ping') return jsonOut_(JSON.stringify({ ok: true }));
    throw new Error('ไม่รู้จักคำสั่ง ' + action);
  } catch (err) {
    return jsonOut_(JSON.stringify({ error: String(err && err.message || err) }));
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'save') return jsonOut_(apiSaveEntry(body));
    if (body.action === 'delete') return jsonOut_(apiDeleteEntry(body.key, body.pin));
    if (body.action === 'sync') return jsonOut_(apiSyncNow(body.pin));
    throw new Error('ไม่รู้จักคำสั่ง ' + body.action);
  } catch (err) {
    return jsonOut_(JSON.stringify({ error: String(err && err.message || err) }));
  }
}

function jsonOut_(str) {
  return ContentService.createTextOutput(str).setMimeType(ContentService.MimeType.JSON);
}

/** ข้อมูลทั้งหมดสำหรับหน้าเว็บ (อ่านอย่างเดียว) */
function apiGetData() {
  var data = getParsedCached_();
  data.overrides = readOverlay_();
  data.needPin = !!PropertiesService.getScriptProperties().getProperty('EDIT_PIN');
  return JSON.stringify(data);
}

function getParsedCached_() {
  var cache = CacheService.getScriptCache();
  var meta = cache.get(CONFIG.CACHE_KEY + '_n');
  if (meta) {
    var keys = []; for (var i = 0; i < Number(meta); i++) keys.push(CONFIG.CACHE_KEY + '_' + i);
    var parts = cache.getAll(keys);
    if (Object.keys(parts).length === keys.length) {
      return JSON.parse(keys.map(function (k) { return parts[k]; }).join(''));
    }
  }
  var data = buildData_();
  var s = JSON.stringify(data), size = 90000, put = {}, n = 0;
  for (var p = 0; p < s.length; p += size) put[CONFIG.CACHE_KEY + '_' + (n++)] = s.slice(p, p + size);
  put[CONFIG.CACHE_KEY + '_n'] = String(n);
  try { cache.putAll(put, 21600); } catch (e) {}
  return data;
}

function clearDataCache_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(CONFIG.CACHE_KEY + '_n') || 0);
  var keys = [CONFIG.CACHE_KEY + '_n']; for (var i = 0; i < n + 5; i++) keys.push(CONFIG.CACHE_KEY + '_' + i);
  cache.removeAll(keys);
}

function buildData_() {
  var ss = SpreadsheetApp.openById(CONFIG.DST_ID);
  var props = PropertiesService.getScriptProperties();
  var out = { sheets: [], summary: null, report: [], offices: [], defaultOffice: CONFIG.DEFAULT_OFFICE,
    lastSync: props.getProperty('LAST_SYNC') || '', lastCheck: props.getProperty('LAST_CHECK') || '',
    srcUpdated: props.getProperty('SRC_UPDATED') || '' };
  var officeSet = {};
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName();
    if (name.charAt(0) === '_') return;
    var lr = sh.getLastRow(), lc = sh.getLastColumn();
    if (!lr || !lc) return;
    var vals = sh.getRange(1, 1, lr, Math.min(lc, 45)).getDisplayValues();
    if (name === 'สารบัญ') { out.summary = k04ParseSummary(vals); return; }
    if (/^การายงาน|^การรายงาน/.test(name)) {
      out.report = vals.filter(function (r) { return /^\d/.test(String(r[2])); })
        .map(function (r) { return { code: r[1], q: [r[2], r[3], r[4], r[5]] }; });
      return;
    }
    var p = k04ParseSheet(name, vals);
    if (p && p.activities.length) {
      p.activities.forEach(function (a) { a.rows.forEach(function (r) { if (r.office) officeSet[r.office] = (officeSet[r.office] || 0) + 1; }); });
      out.sheets.push(p);
    }
  });
  var rank = function (o) { return o === CONFIG.DEFAULT_OFFICE ? 0 : (o.indexOf('กฟจ') === 0 ? 1 : 2); };
  out.offices = Object.keys(officeSet).sort(function (a, b) { return rank(a) - rank(b) || a.localeCompare(b, 'th'); });
  return out;
}

/* ======================= บันทึกของเรา ======================= */

function readOverlay_() {
  var ss = SpreadsheetApp.openById(CONFIG.DST_ID);
  var sh = ss.getSheetByName(CONFIG.OVERLAY);
  if (!sh || sh.getLastRow() < 2) return {};
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, OVERLAY_HEADER.length).getDisplayValues();
  var map = {};
  vals.forEach(function (r) {
    if (!r[0]) return;
    map[r[0]] = { value: r[6], note: r[7], srcAtEdit: r[8], by: r[9], at: r[10] };
  });
  return map;
}

function checkPin_(pin) {
  var need = PropertiesService.getScriptProperties().getProperty('EDIT_PIN');
  if (need && String(pin) !== String(need)) throw new Error('รหัส PIN ไม่ถูกต้อง');
}

/**
 * บันทึก/แก้ค่าผลของเรา (upsert ตาม key) — เขียนเฉพาะชีต _บันทึกของเรา เท่านั้น
 * e = {sheet, actKey, gk, group, code, title, office, q(1-4), value, note, srcValue, pin}
 */
function apiSaveEntry(e) {
  checkPin_(e.pin);
  if (!e || !e.actKey || !e.office || !(e.q >= 1 && e.q <= 4)) throw new Error('ข้อมูลไม่ครบ');
  var value = String(e.value == null ? '' : e.value).trim();
  if (value !== '' && !/^-?\d+(\.\d+)?$/.test(value.replace(/,/g, ''))) throw new Error('ผลต้องเป็นตัวเลข');
  var key = e.actKey + '|' + e.office + '|' + String(e.gk || '') + '|Q' + e.q;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = ensureOwnSheets_(SpreadsheetApp.openById(CONFIG.DST_ID)).overlay;
    var row = findOverlayRow_(sh, key);
    var rec = [key, e.sheet, e.code, (String(e.title || '').slice(0, 60) + (e.group ? ' › ' + String(e.group).slice(0, 40) : '')), e.office, 'Q' + e.q, value,
      String(e.note || '').slice(0, 1000), String(e.srcValue || ''), String(e.by || '').slice(0, 60) || 'หน้าเว็บ',
      Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm')];
    if (row) sh.getRange(row, 1, 1, rec.length).setValues([rec]);
    else sh.appendRow(rec);
    return JSON.stringify({ ok: true, key: key, rec: { value: rec[6], note: rec[7], srcAtEdit: rec[8], by: rec[9], at: rec[10] } });
  } finally { lock.releaseLock(); }
}

/** ลบค่าของเรา → กลับไปใช้ค่าต้นฉบับ */
function apiDeleteEntry(key, pin) {
  checkPin_(pin);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.openById(CONFIG.DST_ID).getSheetByName(CONFIG.OVERLAY);
    var row = sh && findOverlayRow_(sh, key);
    if (row) sh.deleteRow(row);
    return JSON.stringify({ ok: true });
  } finally { lock.releaseLock(); }
}

function findOverlayRow_(sh, key) {
  if (sh.getLastRow() < 2) return 0;
  var keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getDisplayValues();
  for (var i = 0; i < keys.length; i++) if (keys[i][0] === key) return i + 2;
  return 0;
}

/** ปุ่ม "ซิงค์เดี๋ยวนี้" ในหน้าเว็บ */
function apiSyncNow(pin) {
  checkPin_(pin);
  var r = syncFromSource(false);
  return JSON.stringify(r);
}

/** เมนูในไฟล์ Sheets */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('K04 อ่าวลึก')
    .addItem('ซิงค์จากต้นฉบับเดี๋ยวนี้', 'menuSync')
    .addItem('ตั้ง PIN สำหรับลงข้อมูล', 'menuSetPin')
    .addToUi();
}
function menuSync() { var r = syncFromSource(true); SpreadsheetApp.getUi().alert('ซิงค์เสร็จ: ' + JSON.stringify(r)); }
function menuSetPin() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('ตั้ง PIN 4-6 หลัก (เว้นว่าง = ไม่ใช้ PIN)');
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var pin = res.getResponseText().trim();
  if (pin && !/^\d{4,6}$/.test(pin)) { ui.alert('PIN ต้องเป็นตัวเลข 4-6 หลัก'); return; }
  var p = PropertiesService.getScriptProperties();
  if (pin) p.setProperty('EDIT_PIN', pin); else p.deleteProperty('EDIT_PIN');
  ui.alert(pin ? 'ตั้ง PIN แล้ว' : 'ยกเลิก PIN แล้ว');
}
