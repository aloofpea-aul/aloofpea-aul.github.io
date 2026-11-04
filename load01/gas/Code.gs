/**
 * Code.gs — ซิงค์ข้อมูลโหลด Load01 (SCADA กฟต.2) จากโฟลเดอร์ Google Drive → Google Sheet นี้ อัตโนมัติ
 *
 * วิธีใช้ (ครั้งแรก):
 *   1) รัน setup()        → สร้างชีต + ตั้งเวลาซิงค์อัตโนมัติทุกวัน + ซิงค์รอบแรก
 *   2) Deploy > New deployment > Web app (Execute as: Me, Access: Anyone within/Anyone) → ได้ลิงก์ Dashboard
 *
 * การทำงาน:
 *   - สแกนโฟลเดอร์ต้นทาง (รวมโฟลเดอร์ย่อยทุกปี) หาไฟล์ .xlsx
 *   - ไฟล์ใหม่ หรือไฟล์ที่ถูกแก้ไข (modified time เปลี่ยน) → ดึงใหม่ แทนที่ข้อมูลเดิมของไฟล์นั้น
 *   - ไฟล์ที่ถูกลบออกจากโฟลเดอร์ → ลบข้อมูลของไฟล์นั้นออก
 *   - ถ้างานยังไม่เสร็จใน 1 รอบ (จำกัดเวลา 6 นาทีของ GAS) จะตั้งให้ทำต่ออัตโนมัติ
 */

var CFG = {
  ROOT_FOLDER_ID: '1UXY43k4lQp-l6Rc1yap5iV9KxM2LQyJZ', // โฟลเดอร์ Load01 ต้นทาง
  DB_ID: '1GKNEcIyej5dOe0b38DBvN8eGdjZq_G0xP7YZPmVDioo',  // ชีต "ฐานข้อมูล Load01 กฟต.2"
  SHEET_DATA: 'Data',
  SHEET_FILES: 'Files',
  SHEET_LOG: 'Log',
  TIME_BUDGET_MS: 3.5 * 60 * 1000, // เผื่อเวลาเขียนชีต (GAS จำกัด 6 นาที/รอบ)
  DAILY_HOUR: 6,               // ซิงค์ทุกวันเวลา ~06:00
  CACHE_FILE_NAME: 'load01_dashboard.json'
};

var FILE_HEADERS = ['file_id', 'name', 'path', 'modified', 'size', 'status', 'rows', 'months', 'processed_at', 'message'];

/* ====================== เมนู & ตั้งค่า ====================== */

function getSS_() {
  return SpreadsheetApp.getActive() || SpreadsheetApp.openById(CFG.DB_ID);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚡ Load01')
    .addItem('ซิงค์ตอนนี้', 'syncLoad')
    .addItem('ดึงใหม่ทั้งหมด (ล้างแล้วดึงใหม่)', 'resyncAll')
    .addItem('สร้างข้อมูล Dashboard ใหม่', 'rebuildDashboardCache')
    .addSeparator()
    .addItem('ตั้งค่าเริ่มต้น (setup)', 'setup')
    .addToUi();
}

function setup() {
  var ss = getSS_();
  ensureSheet_(ss, CFG.SHEET_DATA, LOAD_HEADERS.concat(['file_id']));
  ensureSheet_(ss, CFG.SHEET_FILES, FILE_HEADERS);
  ensureSheet_(ss, CFG.SHEET_LOG, ['time', 'level', 'message']);
  // ตั้งเวลาซิงค์รายวัน (ลบของเดิมก่อนกันซ้ำ)
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['syncLoad', 'continueSync_'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncLoad').timeBased().everyDays(1).atHour(CFG.DAILY_HOUR).create();
  log_('INFO', 'setup เสร็จ: ตั้งซิงค์อัตโนมัติทุกวัน ~' + CFG.DAILY_HOUR + ':00');
  syncLoad();
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ====================== ซิงค์ ====================== */

function resyncAll() {
  var ss = getSS_();
  [CFG.SHEET_DATA, CFG.SHEET_FILES].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  });
  syncLoad();
}

function continueSync_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'continueSync_') ScriptApp.deleteTrigger(t);
  });
  syncLoad();
}

function syncLoad() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) { log_('WARN', 'มีการซิงค์อื่นทำงานอยู่ ข้ามรอบนี้'); return; }
  var t0 = Date.now();
  try {
    var ss = getSS_();
    var shData = ensureSheet_(ss, CFG.SHEET_DATA, LOAD_HEADERS.concat(['file_id']));
    var shFiles = ensureSheet_(ss, CFG.SHEET_FILES, FILE_HEADERS);

    // 1) รายการไฟล์ในโฟลเดอร์ต้นทาง
    var found = listXlsx_(DriveApp.getFolderById(CFG.ROOT_FOLDER_ID), '');
    var known = readFiles_(shFiles); // id -> record
    var foundIds = {};
    found.forEach(function (f) { foundIds[f.id] = 1; });

    var queue = found.filter(function (f) {
      var k = known[f.id];
      return !k || k.modified !== f.modified || k.status === 'ERROR' || k.status === 'PENDING';
    });
    // เรียงเก่า→ใหม่ เพื่อให้รอบแรกได้ข้อมูลครบเป็นช่วง
    queue.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var removed = Object.keys(known).filter(function (id) { return !foundIds[id]; });

    if (!queue.length && !removed.length) {
      log_('INFO', 'ไม่มีไฟล์ใหม่/แก้ไข (' + found.length + ' ไฟล์)');
      return;
    }

    // 2) ดึงไฟล์ตามคิวจนหมดเวลา
    var newRows = [], replaceIds = {}, done = [];
    for (var i = 0; i < queue.length; i++) {
      if (Date.now() - t0 > CFG.TIME_BUDGET_MS) break;
      var f = queue[i];
      try {
        var res = parseDriveFile_(f);
        res.rows.forEach(function (r) { r.push(f.id); newRows.push(r); });
        replaceIds[f.id] = 1;
        done.push({ f: f, status: res.rows.length ? 'OK' : 'NO_DATA', rows: res.rows.length, months: res.months.join(','), message: res.log.join(' | ').slice(0, 45000) });
      } catch (e) {
        done.push({ f: f, status: 'ERROR', rows: 0, months: '', message: String(e && e.message || e).slice(0, 2000) });
        log_('ERROR', f.name + ': ' + e);
      }
    }
    removed.forEach(function (id) { replaceIds[id] = 1; });

    // 3) เขียนชีต Data (ลบข้อมูลเก่าของไฟล์ที่ดึงใหม่/ถูกลบ แล้วเพิ่มของใหม่)
    writeData_(shData, replaceIds, newRows);

    // 4) อัปเดตชีต Files
    done.forEach(function (d) {
      known[d.f.id] = { file_id: d.f.id, name: d.f.name, path: d.f.path, modified: d.f.modified, size: d.f.size,
        status: d.status, rows: d.rows, months: d.months, processed_at: new Date(), message: d.message };
    });
    removed.forEach(function (id) { delete known[id]; });
    var pendingLeft = queue.length - done.length;
    queue.slice(done.length).forEach(function (f) {
      if (!known[f.id] || known[f.id].modified !== f.modified) {
        known[f.id] = { file_id: f.id, name: f.name, path: f.path, modified: f.modified, size: f.size, status: 'PENDING', rows: '', months: '', processed_at: '', message: '' };
      }
    });
    writeFiles_(shFiles, known);

    log_('INFO', 'ดึง ' + done.length + ' ไฟล์ (' + newRows.length + ' แถว), ลบ ' + removed.length + ' ไฟล์, ค้าง ' + pendingLeft + ' ไฟล์, ใช้เวลา ' + Math.round((Date.now() - t0) / 1000) + ' วิ');

    if (pendingLeft > 0) {
      ScriptApp.newTrigger('continueSync_').timeBased().after(60 * 1000).create();
    } else {
      rebuildDashboardCache();
    }
  } finally {
    lock.releaseLock();
  }
}

function listXlsx_(folder, path) {
  var out = [];
  var files = folder.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    if (!/\.xlsx$/i.test(f.getName())) continue;
    out.push({ id: f.getId(), name: f.getName(), path: path, modified: f.getLastUpdated().toISOString(), size: f.getSize() });
  }
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var s = subs.next();
    out = out.concat(listXlsx_(s, path ? path + '/' + s.getName() : s.getName()));
  }
  return out;
}

function parseDriveFile_(f) {
  var blob = DriveApp.getFileById(f.id).getBlob().setContentType('application/zip');
  var parts = Utilities.unzip(blob);
  var map = {};
  parts.forEach(function (b) { map[b.getName()] = b; });
  parts = null;
  var zip = { text: function (p) { var b = map[p]; return b ? b.getDataAsString('UTF-8') : null; } };
  return parseLoadWorkbook(f.name, zip);
}

function readFiles_(sh) {
  var out = {};
  if (sh.getLastRow() < 2) return out;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, FILE_HEADERS.length).getValues();
  v.forEach(function (r) {
    if (!r[0]) return;
    var o = {}; FILE_HEADERS.forEach(function (h, i) { o[h] = r[i]; });
    o.modified = String(o.modified);
    out[o.file_id] = o;
  });
  return out;
}

function writeFiles_(sh, known) {
  var rows = Object.keys(known).map(function (id) {
    var o = known[id]; return FILE_HEADERS.map(function (h) { return o[h] == null ? '' : o[h]; });
  });
  rows.sort(function (a, b) { return (a[2] + a[1]) < (b[2] + b[1]) ? -1 : 1; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, FILE_HEADERS.length).clearContent();
  if (rows.length) {
    ensureRows_(sh, rows.length + 1);
    sh.getRange(2, 4, rows.length, 1).setNumberFormat('@'); // modified เก็บเป็นข้อความ ISO
    sh.getRange(2, 1, rows.length, FILE_HEADERS.length).setValues(rows);
  }
}

function writeData_(sh, replaceIds, newRows) {
  var ncol = LOAD_HEADERS.length + 1;
  var fileCol = ncol - 1;
  var hasReplace = Object.keys(replaceIds).length > 0;
  var last = sh.getLastRow();
  var existingAffected = false;
  var keep = [];
  if (last > 1 && hasReplace) {
    var ids = sh.getRange(2, ncol, last - 1, 1).getValues();
    existingAffected = ids.some(function (r) { return replaceIds[r[0]]; });
    if (existingAffected) {
      keep = sh.getRange(2, 1, last - 1, ncol).getValues().filter(function (r) { return !replaceIds[r[fileCol]]; });
    }
  }
  // ตั้งรูปแบบคอลัมน์ข้อความกัน Sheets แปลง "2026-09" หรือเวลาเป็นวันที่
  var textCols = ['ym', 'peak_time', 'light_time', 'feeder', 'substation'].map(function (h) { return LOAD_HEADERS.indexOf(h) + 1; });
  if (existingAffected) {
    var all = keep.concat(newRows);
    all.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    sh.getRange(2, 1, Math.max(last - 1, 1), ncol).clearContent();
    if (all.length) {
      ensureRows_(sh, all.length + 1);
      textCols.forEach(function (c) { sh.getRange(2, c, all.length, 1).setNumberFormat('@'); });
      writeChunks_(sh, 2, all, ncol);
    }
  } else if (newRows.length) {
    var start = Math.max(last, 1) + 1;
    ensureRows_(sh, start + newRows.length);
    textCols.forEach(function (c) { sh.getRange(start, c, newRows.length, 1).setNumberFormat('@'); });
    writeChunks_(sh, start, newRows, ncol);
  }
}

function ensureRows_(sh, lastRowNeeded) {
  var max = sh.getMaxRows();
  if (max < lastRowNeeded) sh.insertRowsAfter(max, lastRowNeeded - max);
}

function writeChunks_(sh, startRow, rows, ncol) {
  var CH = 5000;
  for (var i = 0; i < rows.length; i += CH) {
    var part = rows.slice(i, i + CH);
    sh.getRange(startRow + i, 1, part.length, ncol).setValues(part);
  }
  SpreadsheetApp.flush();
}

/* ====================== Dashboard ====================== */

function rebuildDashboardCache() {
  var ss = getSS_();
  var sh = ss.getSheetByName(CFG.SHEET_DATA);
  if (!sh || sh.getLastRow() < 2) return;
  var header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
  var names = {};
  var known = readFiles_(ss.getSheetByName(CFG.SHEET_FILES));
  Object.keys(known).forEach(function (id) { names[id] = known[id].name; });
  var data = buildDashboardData(header, rows, names);
  data.files = Object.keys(known).map(function (id) {
    var k = known[id]; return [k.path, k.name, k.status, k.rows, k.months, String(k.processed_at)];
  });
  var json = JSON.stringify(data);
  var props = PropertiesService.getScriptProperties();
  var fid = props.getProperty('CACHE_FILE_ID');
  var file = null;
  if (fid) { try { file = DriveApp.getFileById(fid); file.setContent(json); } catch (e) { file = null; } }
  if (!file) {
    var parent = DriveApp.getFileById(ss.getId()).getParents();
    var folder = parent.hasNext() ? parent.next() : DriveApp.getRootFolder();
    file = folder.createFile(CFG.CACHE_FILE_NAME, json, 'application/json');
    props.setProperty('CACHE_FILE_ID', file.getId());
  }
  CacheService.getScriptCache().remove('dash_v');
  props.setProperty('CACHE_VERSION', String(Date.now()));
  log_('INFO', 'สร้างข้อมูล Dashboard: ' + data.rows.length + ' แถว / ' + data.months.length + ' เดือน (' + Math.round(json.length / 1024) + ' KB)');
}

function getDashboardData() {
  var fid = PropertiesService.getScriptProperties().getProperty('CACHE_FILE_ID');
  if (!fid) return null;
  return DriveApp.getFileById(fid).getBlob().getDataAsString('UTF-8');
}

function doGet(e) {
  if (e && e.parameter && e.parameter.format === 'json') {
    // สำหรับเรียกจาก GitHub Pages: fetch(URL + '?format=json')
    return ContentService.createTextOutput(getDashboardData() || '{}').setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutput(getIndexHtml_())
    .setTitle('วิเคราะห์โหลด Load01 กฟต.2')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getIndexHtml_() {
  var base = (typeof INDEX_HTML !== 'undefined') ? INDEX_HTML : HtmlService.createHtmlOutputFromFile('Index').getContent();
  var ext = (typeof INDEX_EXT !== 'undefined') ? INDEX_EXT : HtmlService.createHtmlOutputFromFile('IndexExt').getContent();
  var ext2 = (typeof INDEX_EXT2 !== 'undefined') ? INDEX_EXT2 : HtmlService.createHtmlOutputFromFile('IndexExt2').getContent();
  var ext3 = (typeof INDEX_EXT3 !== 'undefined') ? INDEX_EXT3 : '';
  var ext4 = (typeof INDEX_EXT4 !== 'undefined') ? INDEX_EXT4 : '';
  var ext5 = (typeof INDEX_EXT5 !== 'undefined') ? INDEX_EXT5 : '';
  return base.replace('</body>', function () { return ext + '\n' + ext2 + '\n' + ext3 + '\n' + ext4 + '\n' + ext5 + '\n</body>'; }); // ใช้ฟังก์ชัน กัน $ ในโค้ดถูกตีความ
}

/* ====================== สถานะงานแก้ไข (ชีต Actions) ====================== */

function getActionStatus() {
  var sh = getSS_().getSheetByName('Actions');
  if (!sh || sh.getLastRow() < 2) return {};
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues(), o = {};
  v.forEach(function (r) {
    if (r[0]) o[r[0]] = { s: r[1], t: r[2] ? Utilities.formatDate(new Date(r[2]), 'Asia/Bangkok', 'd/M/yyyy HH:mm') : '' };
  });
  return o;
}

function setActionStatus(key, status) {
  if (!/^UB\|[A-Z0-9]{2,5}\|[A-Z0-9\-]{2,20}$/.test(String(key))) throw new Error('รหัสงานไม่ถูกต้อง');
  if (['todo', 'doing', 'done'].indexOf(status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = ensureSheet_(getSS_(), 'Actions', ['key', 'status', 'updated']);
    var last = sh.getLastRow();
    if (last > 1) {
      var keys = sh.getRange(2, 1, last - 1, 1).getValues();
      for (var i = 0; i < keys.length; i++) {
        if (keys[i][0] === key) { sh.getRange(i + 2, 2, 1, 2).setValues([[status, new Date()]]); return true; }
      }
    }
    sh.appendRow([key, status, new Date()]);
    return true;
  } finally { lock.releaseLock(); }
}

/* ====================== Log ====================== */

function log_(level, msg) {
  console.log(level + ' ' + msg);
  try {
    var sh = getSS_().getSheetByName(CFG.SHEET_LOG);
    if (!sh) return;
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, 3).setValues([[new Date(), level, msg]]);
    if (sh.getLastRow() > 500) sh.deleteRows(501, sh.getLastRow() - 500);
  } catch (e) { /* ไม่เป็นไร */ }
}
