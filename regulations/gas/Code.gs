/**
 * ระบบค้นหากฎหมายและระเบียบ กฟภ. — เฟส OCR
 * แปลง PDF ทุกไฟล์เป็นข้อความ (Google Drive OCR ภาษาไทย, ฟรี) แล้วเก็บลงชีต "Text"
 *
 * ต้องเปิด: Services (บริการ) > Drive API > เลือกเวอร์ชัน v2
 *
 * ขั้นตอน:
 *   1) (ไม่ต้องนำเข้า CSV — รายการ 832 ไฟล์ฝังอยู่ท้ายสคริปต์แล้ว)
 *   2) รัน testOne()   -> ดูข้อความตัวอย่างใน Log ว่าอ่านภาษาไทยออกถูกไหม
 *   3) รัน setup()     -> สร้างชีต + ตั้งทริกเกอร์ทุก 10 นาที ให้ทยอยทำจนครบเอง
 *   4) รัน status()    -> ดูความคืบหน้าเมื่อไหร่ก็ได้
 */

const CFG = {
  DOCS: 'Docs',            // ชีตรายการเอกสาร (จาก CSV)
  TEXT: 'Text',            // ชีตเก็บข้อความที่ OCR ได้
  MAX_MS: 4.5 * 60 * 1000, // ไม่เริ่มไฟล์ใหม่หลังนาทีที่ 4.5
  HARD_MS: 5.3 * 60 * 1000, // เส้นตายภายในไฟล์ (GAS ตัดที่ 6 นาที)
  PAGES_PER_PART: 10,      // Drive OCR อ่าน PDF ได้ครั้งละ ~10 หน้า -> ตัดไฟล์เป็นชุดละ 10 หน้า
  CELL: 45000,             // 1 เซลล์เก็บได้ไม่เกิน 50,000 ตัวอักษร
  MAX_TRY: 3,              // ลองซ้ำไฟล์ที่ error ได้กี่ครั้ง
  OCR_LANG: 'th',
  GARBLE: 0.03,            // อักขระแปลกเกิน 3% = ถือว่าข้อความเพี้ยน ต้อง OCR จริง
};

// คอลัมน์ในชีต Docs
const C = { NO: 0, LINK: 1, STATUS: 2, PAGES: 3, CHARS: 4, UPDATED: 5 };

/* ================= ทดสอบ 1 ไฟล์ก่อน ================= */
async function testOne() {
  // reg0885 (ราชกิจจาฯ ฟอนต์เพี้ยน) + reg0203 (บันทึก กฟภ. ปกติ)
  for (const id of ['1tTVipxdm-j9iOImYYmb1EKeDt5vJlBgf', '1n_cyjrWQneS4tN4-VcMvHyqqC0Jt_rwW']) {
    const t0 = Date.now();
    const r = await processFile_(id, '');
    console.log(`สถานะ: ${r.status} | หน้า: ${r.pages} | ตัวอักษร: ${r.text.length} | สัดส่วนอักขระเพี้ยน ${(garbleRatio_(r.text) * 100).toFixed(1)}% | ${((Date.now() - t0) / 1000).toFixed(1)} วินาที`);
    console.log(r.text.slice(0, 700));
  }
}

/* ================= ตั้งค่าครั้งแรก ================= */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const docs = ss.getSheetByName(CFG.DOCS) || ss.getSheets()[0];
  docs.setName(CFG.DOCS);
  if (docs.getLastRow() < 2) {
    const rows = DOC_LIST.split(';').map(x => { const [n, l] = x.split('|'); return ['reg' + n, l, '', '', '', '']; });
    docs.getRange(1, 1, 1, 6).setValues([['File_No', 'ไฟล์ Drive (ID/ลิงก์)', 'สถานะOCR', 'จำนวนหน้า', 'จำนวนตัวอักษร', 'อัปเดต']]);
    docs.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  docs.setFrozenRows(1);

  if (!ss.getSheetByName(CFG.TEXT)) {
    const t = ss.insertSheet(CFG.TEXT);
    t.appendRow(['File_No', 'ส่วนที่', 'ข้อความ']);
    t.setFrozenRows(1);
  }
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'runOCR')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runOCR').timeBased().everyMinutes(10).create();
  console.log('ตั้งทริกเกอร์ทุก 10 นาทีแล้ว — เริ่มรอบแรกเลย');
  return runOCR();
}

/* ================= งานหลัก (ทริกเกอร์เรียกซ้ำจนครบ) =================
 * สถานะ: OK = ข้อความดี | OK-OCR = ผ่าน OCR จริง | WAIT-OCR = ข้อความเพี้ยน รอ OCR (ติดโควตา)
 *        SKIP-... = ข้าม | ERR#n = ผิดพลาด (ลองใหม่ได้ MAX_TRY ครั้ง)
 */
async function runOCR() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const t0 = Date.now();
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CFG.DOCS);
    const tx = ss.getSheetByName(CFG.TEXT);
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, C.UPDATED + 1).getValues();
    let did = 0;

    for (let i = 0; i < rows.length; i++) {
      if (Date.now() - t0 > CFG.MAX_MS) break;
      const st = String(rows[i][C.STATUS] || '');
      if (!needWork_(st)) continue;
      if (st === 'WAIT-OCR' && ocrBlocked_()) continue;

      const r = i + 2, no = rows[i][C.NO], link = String(rows[i][C.LINK] || '');
      const setRow = (status, pages, chars) =>
        sh.getRange(r, C.STATUS + 1, 1, 4).setValues([[status, pages, chars, new Date()]]);

      if (/\/folders\//.test(link)) { setRow('SKIP-ลิงก์เป็นโฟลเดอร์', '', ''); continue; }
      let fid = /^http/.test(link) ? null : link;
      if (!fid) {
        const m = link.match(/\/d\/([\w-]+)|[?&]id=([\w-]+)/);
        if (!/drive\.google\.com/.test(link) || !m) { setRow('SKIP-ไม่ใช่ไฟล์ Drive', '', ''); continue; }
        fid = m[1] || m[2];
      }

      const fileStart = Date.now();
      const runs = runs_(st);
      sh.getRange(r, C.STATUS + 1).setValue(`RUN#${runs + 1}`);   // ถ้าโดนตัดกลางทาง รอบหน้าจะรู้
      SpreadsheetApp.flush();
      try {
        // ไฟล์ที่เริ่มต้นรอบ หรือเคยค้างมาแล้ว -> ยอมเก็บบางส่วนถ้าเวลาไม่พอ
        const allowPartial = (fileStart - t0 < 30 * 1000) || runs >= 1;
        const res = await processFile_(fid, st.startsWith('RUN') ? '' : st, t0 + CFG.HARD_MS, allowPartial);
        if (res.abandon) { sh.getRange(r, C.STATUS + 1).setValue(st || ''); break; }  // ไม่ทัน -> ทำต้นรอบหน้า
        if (res.status === st) { sh.getRange(r, C.STATUS + 1).setValue(st); continue; }  // WAIT-OCR ที่ยังติดโควตา -> คงเดิม
        clearText_(tx, no);
        writeText_(tx, no, res.text);
        setRow(res.status, res.pages, res.text.length);
        did++;
      } catch (e) {
        const n = tries_(st) + 1;
        setRow(`ERR#${n} ${String(e && e.message || e).slice(0, 150)}`, '', '');
      }
      SpreadsheetApp.flush();
    }

    const left = sh.getRange(2, C.STATUS + 1, sh.getLastRow() - 1, 1).getValues()
      .filter(([s]) => needWork_(String(s || ''))).length;
    console.log(`รอบนี้ทำได้ ${did} ไฟล์ | เหลือ ${left}` + (ocrBlocked_() ? ' | OCR ติดโควตา พักไว้ก่อน' : ''));
    if (left === 0) {
      ScriptApp.getProjectTriggers()
        .filter(t => t.getHandlerFunction() === 'runOCR')
        .forEach(t => ScriptApp.deleteTrigger(t));
      console.log('✅ ครบทุกไฟล์แล้ว — ลบทริกเกอร์เรียบร้อย');
    }
  } finally {
    lock.releaseLock();
  }
}

function runs_(st) { const m = String(st).match(/^RUN#(\d+)/); return m ? +m[1] : 0; }
function needWork_(st) {
  if (st === 'OK' || st === 'OK-OCR' || st.startsWith('OK-PARTIAL') || st.startsWith('SKIP') || st.startsWith('FIX')) return false;
  if (st.startsWith('RUN') && runs_(st) >= 4) return false;   // ค้างซ้ำ 4 รอบ = เลิก
  if (st.startsWith('ERR') && tries_(st) >= CFG.MAX_TRY) return false;
  return true;
}
function tries_(st) { const m = String(st).match(/^ERR#(\d+)/); return m ? +m[1] : 0; }

/* ================= ความคืบหน้า ================= */
function status() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.DOCS);
  const v = sh.getRange(2, C.STATUS + 1, sh.getLastRow() - 1, 3).getValues();
  const c = { OK: 0, 'OK-OCR': 0, 'WAIT-OCR': 0, SKIP: 0, ERR: 0, รอ: 0 }; let chars = 0;
  v.forEach(([s, , n]) => {
    s = String(s || '');
    if (s === 'OK' || s === 'OK-OCR') { c[s]++; chars += +n || 0; }
    else if (s.startsWith('OK-PARTIAL')) { c.OK++; chars += +n || 0; }
    else if (s === 'WAIT-OCR') c['WAIT-OCR']++;
    else if (s.startsWith('SKIP')) c.SKIP++;
    else if (s.startsWith('ERR')) c.ERR++;
    else c.รอ++;
  });
  console.log(`สำเร็จ ${c.OK} | OCR จริง ${c['OK-OCR']} | รอ OCR ${c['WAIT-OCR']} | ข้าม ${c.SKIP} | error ${c.ERR} | ยังไม่ทำ ${c.รอ} | รวม ${v.length} | ข้อความ ${chars.toLocaleString()} ตัวอักษร` + (ocrBlocked_() ? ' | OCR ติดโควตาอยู่' : ''));
}

/* ================= ดึงข้อความ ================= */
// 1) แปลงเป็น Google Doc (เร็ว ไม่ติดโควตา) -> 2) ถ้าข้อความเพี้ยน ค่อยทำ OCR จริง
async function processFile_(fileId, prevStatus, deadline, allowPartial) {
  return processBlob_(DriveApp.getFileById(fileId).getBlob(), prevStatus, deadline, allowPartial);
}
async function processBlob_(blob, prevStatus, deadline, allowPartial) {
  deadline = deadline || Date.now() + CFG.HARD_MS;
  const type = blob.getContentType();
  const isPdf = type === 'application/pdf';

  let parts = [blob.getBytes()], pages = '';
  if (isPdf) {
    try { ({ parts, pages } = await splitPdf_(blob.getBytes())); }
    catch (e) { pages = '?'; }                     // PDF เข้ารหัส/เสีย -> ใช้ทั้งไฟล์
  }
  const mk = (b, k) => Utilities.newBlob(b, type, `part${k}`);
  // แปลงทีละชุด 10 หน้า จนกว่าจะหมดเวลา
  const run = (ocr) => {
    const out = [];
    for (let k = 0; k < parts.length; k++) {
      if (Date.now() > deadline) return { out, cut: true };
      out.push(toText_(mk(parts[k], k), ocr));
    }
    return { out, cut: false };
  };

  if (prevStatus !== 'WAIT-OCR') {
    const rr = run(false);
    const text = clean_(rr.out.join('\n'));
    if (rr.cut) {
      if (!allowPartial) return { abandon: true };
      return { status: `OK-PARTIAL ${rr.out.length * CFG.PAGES_PER_PART}/${pages} หน้า`, pages, text };
    }
    if (!isPdf && !/^image\//.test(type)) return { status: 'OK', pages, text };
    if (garbleRatio_(text) < CFG.GARBLE && text.replace(/\s/g, '').length > 30) return { status: 'OK', pages, text };
    if (ocrBlocked_()) return { status: 'WAIT-OCR', pages, text };
  }
  // OCR จริง
  try {
    const rr = run(true);
    const text = clean_(rr.out.join('\n'));
    if (rr.cut) {
      if (!allowPartial) return { abandon: true };
      return { status: `OK-PARTIAL ${rr.out.length * CFG.PAGES_PER_PART}/${pages} หน้า (OCR)`, pages, text };
    }
    return { status: 'OK-OCR', pages, text };
  } catch (e) {
    if (/rate limit|quota/i.test(String(e && e.message))) {
      PropertiesService.getScriptProperties().setProperty('OCR_BLOCK_UNTIL', String(Date.now() + 60 * 60 * 1000));
      return { status: 'WAIT-OCR', pages, text: '' };
    }
    throw e;
  }
}
function ocrBlocked_() {
  return Date.now() < Number(PropertiesService.getScriptProperties().getProperty('OCR_BLOCK_UNTIL') || 0);
}
// สัดส่วนอักขระแปลก (@ # ? ! ` ^ _ < > = | ~) ต่อข้อความ — ข้อความปกติแทบไม่มี
function garbleRatio_(t) {
  const s = String(t || '').replace(/https?:\/\/\S+/g, '').replace(/\s/g, '');
  if (!s.length) return 1;
  return (s.match(/[@#?!`^_<>=|~\\]/g) || []).length / s.length;
}
function clean_(t) { return String(t || '').replace(/Powered by TCPDF.*$/gm, '').replace(/\n{3,}/g, '\n\n').trim(); }

function toText_(blob, ocr) {
  const opt = ocr ? { ocr: true, ocrLanguage: CFG.OCR_LANG } : { convert: true, ocrLanguage: CFG.OCR_LANG };
  const f = Drive.Files.insert({ title: 'tmp_reg_ocr_' + Date.now() }, blob, opt);
  try {
    return DocumentApp.openById(f.id).getBody().getText();
  } finally {
    DriveApp.getFileById(f.id).setTrashed(true);
  }
}

/* ================= ตัด PDF เป็นชุดละ 10 หน้า (pdf-lib) ================= */
let PDFLIB_LOADED = false;
function loadPdfLib_() {
  if (PDFLIB_LOADED) return;
  const src = UrlFetchApp.fetch('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js').getContentText();
  eval(src.replace(/setTimeout\(.*?,.*?(\d*?)\)/g, 'Utilities.sleep($1);return t();'));
  PDFLIB_LOADED = true;
}

async function splitPdf_(bytes) {
  loadPdfLib_();
  const src = await PDFLib.PDFDocument.load(new Uint8Array(bytes), { ignoreEncryption: true });
  const n = src.getPageCount();
  if (n <= CFG.PAGES_PER_PART) return { parts: [bytes], pages: n };

  const parts = [];
  for (let s = 0; s < n; s += CFG.PAGES_PER_PART) {
    const doc = await PDFLib.PDFDocument.create();
    const idx = [];
    for (let p = s; p < Math.min(n, s + CFG.PAGES_PER_PART); p++) idx.push(p);
    (await doc.copyPages(src, idx)).forEach(pg => doc.addPage(pg));
    parts.push(Array.from(new Int8Array(await doc.save())));
  }
  return { parts, pages: n };
}

/* ================= บันทึกข้อความ ================= */
function clearText_(tx, no) {
  const found = tx.getRange('A:A').createTextFinder(no).matchEntireCell(true).findAll();
  found.map(r => r.getRow()).sort((a, b) => b - a).forEach(r => tx.deleteRow(r));
}
function writeText_(tx, no, text) {
  const chunks = [];
  for (let i = 0; i < Math.max(text.length, 1); i += CFG.CELL) chunks.push(text.slice(i, i + CFG.CELL));
  const rows = chunks.map((c, k) => [no, k + 1, c]);
  tx.getRange(tx.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}


/* ================= เก็บกวาดไฟล์ที่มีปัญหา (ERR / SKIP / ค้าง) =================
 * รัน setupFix() ครั้งเดียว -> ทำเองทุก 10 นาทีจนครบ แล้วลบทริกเกอร์ตัวเอง
 * ผลลัพธ์: FIX-OK-...   = ได้ข้อความแล้ว
 *          FIX-FAIL-... = ทำไม่ได้ (บอกเหตุผล) — ยังเปิด/ดาวน์โหลดจากลิงก์ได้ตามปกติ
 * คอลัมน์ G "ไฟล์ย่อย" = รายชื่อไฟล์ในโฟลเดอร์ (JSON) สำหรับหน้าค้นหา
 */
function setupFix() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.DOCS);
  sh.getRange(1, 7).setValue('ไฟล์ย่อย');
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runFix').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('runFix').timeBased().everyMinutes(10).create();
  console.log('ตั้งทริกเกอร์เก็บกวาดทุก 10 นาทีแล้ว — เริ่มรอบแรกเลย');
  return runFix();
}

function fixRuns_(st) { const m = String(st).match(/^FIXRUN#(\d+)/); return m ? +m[1] : 0; }
function fixNeeded_(st) {
  st = String(st || '');
  if (st.startsWith('FIX-OK') || st.startsWith('FIX-FAIL')) return false;
  if (st.startsWith('FIXRUN')) return fixRuns_(st) < 3;
  if (st.startsWith('ERR') || st.startsWith('SKIP')) return true;
  if (st.startsWith('RUN') && runs_(st) >= 4) return true;      // ไฟล์ที่ค้างจนถูกข้าม
  return false;
}

async function runFix() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const t0 = Date.now();
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CFG.DOCS);
    const tx = ss.getSheetByName(CFG.TEXT);
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, C.UPDATED + 1).getValues();
    let did = 0;
    for (let i = 0; i < rows.length; i++) {
      if (Date.now() - t0 > CFG.MAX_MS) break;
      const st = String(rows[i][C.STATUS] || '');
      if (!fixNeeded_(st)) continue;
      const r = i + 2, no = rows[i][C.NO], link = String(rows[i][C.LINK] || '');
      const runsNow = fixRuns_(st) + 1;
      sh.getRange(r, C.STATUS + 1).setValue(`FIXRUN#${runsNow}`);
      SpreadsheetApp.flush();
      const setRow = (status, pages, chars) =>
        sh.getRange(r, C.STATUS + 1, 1, 4).setValues([[status, pages, chars, new Date()]]);
      try {
        const res = await fixOne_(link, t0 + CFG.HARD_MS, Date.now() - t0 < 30 * 1000 || runsNow > 1);
        if (res.abandon) { sh.getRange(r, C.STATUS + 1).setValue(st); break; }
        if (res.text) { clearText_(tx, no); writeText_(tx, no, res.text); }
        setRow(res.status, res.pages || '', res.text ? res.text.length : '');
        if (res.files) sh.getRange(r, 7).setValue(JSON.stringify(res.files).slice(0, 45000));
        did++;
      } catch (e) {
        const msg = String(e && e.message || e);
        if (/rate limit|quota/i.test(msg)) {
          PropertiesService.getScriptProperties().setProperty('OCR_BLOCK_UNTIL', String(Date.now() + 60 * 60 * 1000));
          sh.getRange(r, C.STATUS + 1).setValue(st); continue;   // ติดโควตา OCR -> ข้ามรายการนี้ไปก่อน ไม่หยุดทั้งรอบ
        }
        if (runsNow >= 2) setRow('FIX-FAIL ' + msg.slice(0, 140), '', '');
        // ครั้งแรกที่พลาด -> คง FIXRUN#1 ไว้ ลองใหม่รอบหน้า
      }
      SpreadsheetApp.flush();
    }
    const left = sh.getRange(2, C.STATUS + 1, sh.getLastRow() - 1, 1).getValues().filter(([s]) => fixNeeded_(s)).length;
    console.log(`เก็บกวาดรอบนี้ ${did} ไฟล์ | เหลือ ${left}`);
    if (left === 0) {
      ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'runFix').forEach(t => ScriptApp.deleteTrigger(t));
      console.log('✅ เก็บกวาดครบแล้ว — ลบทริกเกอร์เรียบร้อย');
    }
  } finally {
    lock.releaseLock();
  }
}

// จัดการ 1 รายการตามชนิดลิงก์
async function fixOne_(link, deadline, allowPartial) {
  const folder = link.match(/\/folders\/([\w-]+)/);
  if (folder) return fixFolder_(folder[1], deadline);
  if (/^https?:\/\//.test(link) && !/drive\.google\.com/.test(link)) return fixWeb_(link, deadline, allowPartial);
  const m = /^https?:/.test(link) ? link.match(/\/d\/([\w-]+)|[?&]id=([\w-]+)/) : [null, link];
  if (!m) throw new Error('ลิงก์ไม่รู้จัก');
  const res = await extractDriveFile_(DriveApp.getFileById(m[1] || m[2]), deadline, allowPartial);
  if (res.abandon) return res;
  return { status: 'FIX-OK-' + res.how, pages: res.pages, text: res.text };
}

// ไฟล์ใน Drive: ใหญ่ -> แปลงฝั่ง Google / รูป (tiff ฯลฯ) -> OCR / ปกติ -> ขั้นตอนเดิม
async function extractDriveFile_(file, deadline, allowPartial) {
  const mime = file.getMimeType(), size = file.getSize();
  if (mime === MimeType.GOOGLE_DOCS) return { how: 'Google Doc', text: clean_(DocumentApp.openById(file.getId()).getBody().getText()) };
  if (/^image\//.test(mime)) {
    let blob = file.getBlob();
    try { return { how: 'OCR รูป', text: clean_(toText_(blob, true)) }; }
    catch (e) {
      if (/rate limit|quota/i.test(String(e.message))) throw e;
      blob = blob.getAs('image/png');                        // tiff -> png แล้วลองอีกครั้ง
      return { how: 'OCR รูป(png)', text: clean_(toText_(blob, true)) };
    }
  }
  if (size > 45 * 1024 * 1024) {                               // ใหญ่เกิน 50MB ของ Apps Script
    const f = Drive.Files.copy({ title: 'tmp_reg_big_' + Date.now() }, file.getId(), { convert: true, ocrLanguage: CFG.OCR_LANG });
    try { return { how: `ไฟล์ใหญ่ ${Math.round(size / 1048576)}MB`, text: clean_(DocumentApp.openById(f.id).getBody().getText()) }; }
    finally { DriveApp.getFileById(f.id).setTrashed(true); }
  }
  const r = await processBlob_(file.getBlob(), '', deadline, allowPartial);
  if (r.abandon) return r;
  if (r.status === 'WAIT-OCR') throw new Error('rate limit (OCR)');
  return { how: r.status.replace(/^OK-?/, '') || 'ปกติ', pages: r.pages, text: r.text };
}

// โฟลเดอร์: อ่านทุกไฟล์ข้างใน (ลึก 2 ชั้น) รวมเป็นข้อความเดียว + จำรายชื่อไฟล์
async function fixFolder_(folderId, deadline) {
  const files = [];
  const walk = (fd, depth) => {
    const it = fd.getFiles(); while (it.hasNext()) files.push(it.next());
    if (depth < 2) { const sub = fd.getFolders(); while (sub.hasNext()) walk(sub.next(), depth + 1); }
  };
  walk(DriveApp.getFolderById(folderId), 0);
  if (!files.length) throw new Error('โฟลเดอร์ว่าง หรือไม่มีสิทธิ์เปิด');
  const texts = []; let done = 0;
  for (const f of files) {
    if (Date.now() > deadline) break;
    try {
      const r = await extractDriveFile_(f, deadline, true);
      if (r.abandon) break;
      texts.push(`【${f.getName()}】\n${r.text}`); done++;
    } catch (e) {
      texts.push(`【${f.getName()}】 (อ่านไม่ได้: ${String(e.message).slice(0, 60)})`); done++;   // ไฟล์เดียวพลาด ไม่ล้มทั้งโฟลเดอร์
    }
  }
  if (!done) return { abandon: true };
  return {
    status: `FIX-OK-โฟลเดอร์ ${done}/${files.length} ไฟล์`,
    text: texts.join('\n\n'),
    files: files.map(f => ({ id: f.getId(), name: f.getName() })),
  };
}

// ลิงก์เว็บ: ดึงไฟล์มาอ่าน (PDF) หรือดึงข้อความจากหน้าเว็บ
async function fixWeb_(url, deadline, allowPartial) {
  let resp;
  try { resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: false }); }
  catch (e) {
    if (/pea\.co\.th/.test(url)) throw new Error('เซิร์ฟเวอร์ภายใน กฟภ. — เข้าจากนอกเครือข่ายไม่ได้');
    throw new Error('เปิดเว็บไม่ได้: ' + String(e.message).slice(0, 80));
  }
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error(`เว็บตอบกลับ ${code}`);
  const blob = resp.getBlob();
  const bytes = blob.getBytes();
  const isPdf = /pdf/i.test(blob.getContentType() || '') || (bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70); // %PDF
  if (isPdf) {
    if (bytes.length > 45 * 1024 * 1024) throw new Error('ไฟล์บนเว็บใหญ่เกิน 45MB');
    const r = await processBlob_(Utilities.newBlob(bytes, 'application/pdf', 'web.pdf'), '', deadline, allowPartial);
    if (r.abandon) return r;
    if (r.status === 'WAIT-OCR') throw new Error('rate limit (OCR)');
    return { status: 'FIX-OK-เว็บ PDF', pages: r.pages, text: r.text };
  }
  const text = resp.getContentText('UTF-8')
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  if (text.length < 300) throw new Error('หน้าเว็บไม่มีเนื้อหาเอกสาร');
  return { status: 'FIX-OK-หน้าเว็บ', text: clean_(text) };
}

function statusFix() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.DOCS);
  const v = sh.getRange(2, C.STATUS + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0] || ''));
  const ok = v.filter(s => s.startsWith('FIX-OK')).length, fail = v.filter(s => s.startsWith('FIX-FAIL')).length;
  console.log(`เก็บกวาดแล้ว: ได้ข้อความ ${ok} | ทำไม่ได้ ${fail} | เหลือ ${v.filter(fixNeeded_).length}`);
  v.filter(s => s.startsWith('FIX-FAIL')).forEach(s => console.log('  ' + s));
}


/* ================= เว็บแอปค้นหา =================
 * buildIndex()  -> รวมข้อความทุกเอกสาร อัด gzip เป็นก้อนๆ เก็บในโฟลเดอร์ Drive "reg-search-index"
 *                  (รันใหม่เมื่อข้อความเปลี่ยน เช่น หลังเพิ่มไฟล์ doc-server)
 * doGet()       -> หน้าเว็บค้นหา (ไฟล์ index.html ในโปรเจกต์นี้)
 */
function doGet(e) {
  const act = e && e.parameter && e.parameter.action;
  if (act==='manifest') return ContentService.createTextOutput(JSON.stringify(getManifest())).setMimeType(ContentService.MimeType.JSON);
  if (act==='shard') return ContentService.createTextOutput(getShard(Number(e.parameter.i)||0)).setMimeType(ContentService.MimeType.TEXT);
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('ค้นหากฎหมายและระเบียบ กฟภ.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// โค้ดหลักของหน้าเว็บ ส่งเป็นข้อความดิบ (เลี่ยงการแปลงโค้ดของ HtmlService)
function getAppJs() {
  return HtmlService.createTemplateFromFile('appjs').getRawContent();
}
function getManifest() {
  const p = PropertiesService.getScriptProperties();
  return { version: p.getProperty('IDX_VERSION') || '', shards: JSON.parse(p.getProperty('IDX_SHARDS') || '[]').length };
}
function getShard(i) {
  const ids = JSON.parse(PropertiesService.getScriptProperties().getProperty('IDX_SHARDS') || '[]');
  return Utilities.base64Encode(DriveApp.getFileById(ids[i]).getBlob().getBytes());
}

function buildIndex() {
  const t0 = Date.now();
  const ss = SpreadsheetApp.getActive();
  const docs = ss.getSheetByName(CFG.DOCS).getDataRange().getValues();
  const tx = ss.getSheetByName(CFG.TEXT);
  const last = tx.getLastRow();
  const parts = {};
  for (let s = 2; s <= last; s += 1500) {
    tx.getRange(s, 1, Math.min(1500, last - s + 1), 3).getValues().forEach(([no, k, t]) => {
      if (!no) return;
      (parts[no] = parts[no] || [])[(+k || 1) - 1] = String(t || '');
    });
  }
  const files = {};
  docs.slice(1).forEach(r => { if (r[6]) { try { files[r[0]] = JSON.parse(r[6]); } catch (e) {} } });

  const entries = Object.keys(parts).map(no => [no,
    parts[no].join('').replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n'),
    files[no] || null]).filter(e => e[1].length > 20 || e[2]);
  const shards = []; let cur = [], size = 0;
  for (const e of entries) { cur.push(e); size += e[1].length; if (size > 2.5e6) { shards.push(cur); cur = []; size = 0; } }
  if (cur.length) shards.push(cur);

  const it = DriveApp.getFoldersByName('reg-search-index');
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder('reg-search-index');
  const old = folder.getFiles(); while (old.hasNext()) old.next().setTrashed(true);
  const ids = shards.map((sh, i) =>
    folder.createFile(Utilities.gzip(Utilities.newBlob(JSON.stringify(sh), 'application/json'), `shard${i}.json.gz`)).getId());
  const p = PropertiesService.getScriptProperties();
  p.setProperty('IDX_SHARDS', JSON.stringify(ids));
  p.setProperty('IDX_VERSION', new Date().toISOString());
  let total = 0; entries.forEach(e => total += e[1].length);
  console.log(`สร้างดัชนีแล้ว: ${entries.length} เอกสาร | ${total.toLocaleString()} ตัวอักษร | ${shards.length} ก้อน | ${((Date.now() - t0) / 1000).toFixed(0)} วินาที`);
}

/* ================= รายการเอกสาร 832 ไฟล์ (เลขที่|Drive ID) จากรายงานส่วนกลาง 31 ต.ค. 2569 ================= */
const DOC_LIST = '0899|1kzJijEIYk8rZMT-UlciwYSuVTr1xBTV-;0897|12FtT0bR9lJhc3VrhpYJanyrcbq9FvZyJ;0895|1zqNd2iEHHtt8NdkXOpzoi0JlEgS6dVu5;0894|10xFMXnRGe-YIkyFmlTP_VF6QXC0qtyoG;0893|1A2Zl4yN5pqWizYo2DNDizd8H-aGL0Wyc;0892|1hpsxispA2nBwAxJq1ZL4biQRp-B8OsTf;0891|1RZ5JDXWnmMdrMeI3po4jO8rozfepzqnM;0890|1lpL7gu6Bnk14Cz9DrPLSNvPqdkONuZcc;0889|1LbMTumTi43jcH20VRh2WiR7pN97n-ZZL;0888|1r-SjNXPTGmYx_jc-ALFedgIavpwvG6P2;0887|1SEQJTawHavW9hFkoWUHvRNY0UHwpNDnC;0886|1bKeo1AjeWADybaoLLHeJws4tJmvf2Utl;0885|1tTVipxdm-j9iOImYYmb1EKeDt5vJlBgf;0884|1MJcUvdEpOT7eJSCwMR6r7nF_5CCZHhGZ;0883|1TUCRnBWhlMFaOIC9VdObtSA3sb68Y3Sm;0881|1Ja_Tl3d-qQt0DBI1VrGzDS3sY-NPvHs_;0878|1ALjIJXymxLhGAuTmLYtAvzpjUfQBAITm;0877|1uYISj0TL6m66xTI3hpiK4pbwb7qgHyhn;0876|1bQpO2eKpRdlEdR0bYDnpGV9VrBD_AqRz;0874|11sCV9MOsUdny-cXZAqBxe-lKiHJUTVoY;0870|1UhPvmt5QZHsepFcrA75hFrA4cYayTDuC;0869|https://drive.google.com/drive/folders/15hDkwgb4oH-JVQW5BmmpeXAi0hTwxL5EjFOEbXGUvu8t9iYLfniLc7Xp-A1_dieBGSVP_AgF;0866|1RvGno2Mlv9HZfWbXMQv62-cJnRUwt0_K;0837|1xDXOyN83C3daVVI46SnuYLvB7fcCBB6y;0819|13Skh6S2nECbO8Mv6B49u_oDEXk8pKEq7;0818|1yQ39GnlPOEIljLJoqK-JZU0BjRT8iLyh;0817|13znHfMD735I2FQTaqMubTM05TwVD2-om;0816|1QpInq-d-KKeHTojJkjN4bwqKHN1yuUV-;0815|1tXyM0YIeqXmTBoiG9YvxAaYKDovvmfEG;0814|1QLLpyvBdu2hAa7JF6POjsxAVvrdREA2Q;0813|1bt1TgHWwoa8l4aLeYYu61zwSRqXQ7zGP;0812|18zIWjy7j4_F9Ed3eETvQbF-IuFPRXHfj;0811|1uwnmpCDWzx1EgI93a9aM0CmdtzjEhrYw;0810|1PEZ0YDVlq6mIsdH-aOigHzkBWxR1g144;0797|1fq6UKqkxHVsVFEtOz0xPJnnxfhkrpQSb;0791|1hRLSPVlXhTm8WQV1uIxFpWR5LnA6Pdx6;0789|1NdpWEie7BUdnWFE6NpAMLGY0k2nhNbz3;0788|1cg6c5V3zxHlTF-9de0BOdyjj9PTuaFIm;0782|1fXgJywFwK6y-u1klcseNI7p_geBsuJnD;0778|1E-wX5rdBvuCWKo0PWEXKv655d7EzAwoc;0775|1qsVJWJ0MxWy-XAf5gaPcHErDcWAi_KmF;0774|1WTo-moSibzxv2uEjyekEeIz_VOZCOFl7;0773|1kxnVH66rmmLArkrsEItNxlkFc_xP5U9Q;0772|18CHqehNfiDPc_Au4ILfBNeYOkVRG6SlP;0771|1ukwF8wK6hrZ6PmfvSdZRZVq6du7vOBVO;0770|1esmue6_MDfwZU_K00dAoHSfHU3-zkdJQ;0769|1CoU8dy_NXHr4edwEweR02C24PB0GrTai;0756|1be2szL59bH-Qdzwr6GV6u7CueYyixfVR;0755|1tT9ZE_BP4NA4m6r2MoqV0EiuYTsQZX1n;0752|1mzpQa--NU9DUTCRSjfA5kWXP0Tlj1Mbe;0750|1oALRltGiY5W6apEl6iykr6E4xMUdVDLO;0749|1OGax7t_4yFZCKnMMP47dEgTIRQOn6E3x;0748|1Nx4Nqfnd2qyMfSZYdV4cvZbSxVgpZ5LR;0747|16UZMxc_6tnVKtthZ_De_u2IxqHIZGlE_;0746|1sn45YQGcZB_AsT2zzyPLBrmIf6k1XMs-;0745|1lepuVP6jlFMagHdOyzOP378U1FwtNtGV;0744|1bV-4FgFk922BaliQ6H13Wfzm8JNrCBUD;0743|1XKiQyOISd_4v70HSZOEgA0PLRm3Qd9sp;0739|1-pqCszVMux058QMAICGPOrgaUj5ySGOn;0734|1rAtI6syCefCH2eapqIopl1yyfW_LAn08;0733|1fimhiqMLFkcF9r__-34YerXUvpOm_2Hb;0732|1chrQcgSBt_L8th486cme4F9uB336AaZv;0731|1nYm--Zab06XL22EVIyMapWbZkb7c96Jz;0730|1oMcGwQuE_5azGp50DZLBfQV8Iz0lAofo;0729|1nuN3Lsaw-NEADn693trrdY3l6CfyHKht;0728|13eIdocwqzOCramz1RUMEe1lpieDEYvqC;0727|1FbKFwGtVGu3pxJsPd60aT1RNOGfb8p5J;0725|1csF6caPCYJncEAwoQSIHcBSM8bi9SGdu;0724|1ivZ9aJCNoBWl4fCa7YCu4wTd2AGWamJj;0722|1-E3SyuzBUxN85tTY7jfzxG5MkODTBQFq;0717|1i2ofXEzA_T3EGv5kBYUIIXTav7CvoIq-;0716|1CtrBQc2kP0Ipkmy3xOdi8jaINMsonuNo;0715|1n3Y5XgSQ7NYKuwX503oPidr8-3Q_ZIdq;0714|1DQx47EuEKXtxeHnoHz6OK_nIbxLlmMhs;0713|1L1PlGw4y65pV3es4L0juO5G7kYNZDZvF;0712|1-2Z8xEAXKZnhD3Htpym6Bb7BV6FnECRM;0711|1d2hZaUOFNwjTTH8Thn0rjKCsRAwomeCu;0710|1pX6f2nBfJ4qZlX2Qtsw3B88BL40yIxck;0709|1lu-GcvNoqNKN01A27suedvZA_63Me6Rd;0708|1Xm2X5aMjiZ8zNz8iGXMr2l-4_Fq3SOGb;0706|1QgYkbCf8E8BSl7GQBWdMNhCzmT9ipX2O;0705|1y-mCqPJqjtkzuwWBd0OTYP8bcl1MB-Rn;0696|1qjpOEIV-Is7o_WrCcUfgXrQMT_4fzFyA;0694|1COQRhGovzM3B4xwQd4wA5iOaDj4H1GL2;0692|1h8I0zo2cbM_5f2-GHNAzDyIOnVcwXVMz;0691|1XrS2RnKDO8L1JTvjctdOeezC-fjwCz9K;0690|1_-fy9NJNq7Q592l9a9Dzr52X3i6dxpJV;0688|1OYHEPsvRd8_Hu5AbBtFPwWepg69oOfOc;0686|1BwAyM4ThCbggbpgFN6MeI78mwl-WLAzO;0682|1Rg80tJl9UMOp9baUgGnok6p-5fRnoSfd;0681|154Nvsb_j989WcBszyvPqx1EG1Fbl2Exo;0679|12skgayCWwRLA6qdpjz1OCte7HDvRUU35;0678|1m_3_wqr2UdTYOWtkel_B-nsId0f85d3e;0677|1PHJWcf6kVt4TgMq8-x3Mkb7d4xMTibGm;0673|1j6wbtkaIUIJ-Q9TxQJvyOUmlVCnM_Aue;0645|1XPSkt77oNc7LXrnIbBDAMZ-ZIynploMK;0644|1lLPfARRdFFLGT25sGHBSzV4pHxYvvHti;0632|1cvZ1rOvKhXeiglbDP4JChJWdWjqql6UL;0631|1STqiGkkuGUXqo0IG7S9MGgGmzAF4IbBB;0630|19_VaEpIGuvfeig88HcXLjw9ggYnqrnrY;0629|https://drive.google.com/drive/folders/1aQ0lsZr0sVyUyWUIpKtB3xDOtDf0WLHx?usp=drive_link;0627|https://drive.google.com/drive/folders/1b4c1LPekEMpUmqRCmujRc8pn-5CsqOzG?usp=drive_link;0626|1hvh1MchUuc-PcmT4OGkWoU1ZdLssBB3A;0623|1XY13mmQeDg2GStWWCVn8kiVZUF2_mlnf;0622|1XJLpnAIt0X7_H4c4HiMBOmUGhlB1Vdi2;0621|1XFMtT4IA-1VysrrBg52EdefrqRIDM-ue;0620|1XDUwSdy-OYGGRycbkwIxw_MewIeeOGa6;0619|1X6OxRauHvlCMZa8Vt-uZU4X7Ve-luMre;0618|1X5kFSBNb4IZ5rSSeHhP3QUu9todIBjd3;0617|1WzM58sb14jo60Lb1boqxWlwjb03_1RNH;0615|1Wx8GlNkx5ESozdPSxA8QKmZPB9k-ceW1;0614|1WvFhgI8JVLDJUGc3O9PC-48NV3BAp9F8;0613|1WnI5zDxqJsSX5dGeSKqyqRULq08cIFnd;0612|1Whm5UDnKfK0-ix41wqxbOXhJKdPklSR0;0611|1WfRpMxjyXuVthoTd-6QhgMsuza6MEvpV;0610|1WZes8lN2vE2wXl-J-rUmPBxqxPP7dQG7;0609|1WYHBbC9jnEeo7jI1WsCKNTN_ZKIksLLp;0608|1WUdhs6fl5EXHXU-le-uyoXk0i6cl3dor;0607|1WRwXCT282ib1C-nl-6cMEWfks_UptmJY;0606|1WG26-tHonljqLUbDMF7Q9eVptQyXFviT;0605|1WFFf1W6eMrygIMhuEJRGPtxl7-4SQC0Q;0604|1WCixhneeWnH_xSV-FkakYyU6R8DAXIIQ;0603|1WAAO71MADvIvdgUl9Jx-eOJ9EUhUY3wB;0602|1W9_niIUAXbx3x8n5kuvOW9OKN7mTqqGI;0601|1W8q6Jw4KHlQjmGIrBLxdkv_8yi5Yxoqb;0600|1VAcMXnNMLHv9mYzL1kH3rXpaZuIwQWnl;0599|1V9AFp42Q4bd69VRWB-w3WaRWvpQyvpXQ;0598|https://drive.google.com/drive/folders/1Un_TWke7Lu5TQQwCD7V1iH7k34W5f6sI?usp=sharing;0596|1ULGBF-DIskWtE3z3QMipGI0zcOFa0JYJ;0595|1UKYpE9HXcFJFG1wpmJKsCYCFCO0bzZpo;0593|1UGcQJ5hnHM939wjfTERPPzMqBuLgC-M5;0592|1UFubCSbEHEsz96xJiqo2wnxjOavg_mPR;0591|10BFy5lHGIB-dlA1EkFAi931OGvRZ7Vec;0587|1W07_iKIkMwZFD1TAd-6rNhCZAyUYjxLj;0586|1pO8J32xQczDihi2W-nhRQyO5IOcUpMpW;0585|1SKu6d2SgzyNcbOX2fnOSVdsqUATcSuWg;0580|1XAJpwYpBroeB4LhQVKGH1ETGmEeb4ZbS;0577|1KSl7vb_THmb6fM5Wif4EYUrnF7j3zKyS;0576|1jT7IMhSmSyvh2vAzbh7nlYiHaC0kupJe;0575|1SM3X5a5ArKN4bY8f4Y5NBkj90WSmb2CR;0574|1SM-V7qhN7mYEAHvjU5lY2xfm4_683DeG;0573|1SJeSbuIOiXCd6UOKoNBloZ0bxRQRWCsM;0572|https://drive.google.com/drive/folders/1RnAit1-ne3XWIf6xGBLw79AxsUyggqor?usp=sharing;0571|https://drive.google.com/drive/folders/1R9RIFCATuT2MogdS4OJYEv3wEkzRp_qB?usp=sharing;0570|1R0GqUG9WOSopqBuRKwNLgFYAnGAt3pXe;0569|1QxGdiXQvwPzHCuw4EsBTjztMJCmJB9o1;0568|1Qm6zyYzMwf8D7EXax1rMZ0RkqscfRx55;0567|1Qgi1FyWsi3YWygmf7lr35zmcdRB7eoca;0566|1Qd-mogaBqQRdTNu1NCqShBHVjSYA9hpZ;0565|1QSCfjDmpDP4hrn3m8ErwpLeGBWQbbKef;0564|1QM53DtKW7IbEvXK2nw-rg78XAlTEyMek;0563|1QInPrWJsCTvAsmwWEpdjk0lJ_3qV1ToK;0562|1QH8dd14sooIC8XNrzeYrZ8Ae7p5a3mry;0561|1QG7VJRypA96GG44eyooSpJTC6nRz6Eex;0560|1Q1xYXAYRt9is5_ufu_cKUf8xHai6TOOk;0559|1PwlOYdqc_5iHRbMg9f3xezblYSvgTiX4;0558|1PdkxK_PMeDXs3I68R4p0S5fLg8DqvzY9;0554|17zRiwV5yl97CEESsj9Cpje0_6sHaPSFO;0553|17siMDuvz-HEzKeukmI5VwgVT7UMV5fbH;0551|12x0twQoXaD6TN686Kt6sFkAUd9oUEOMQ;0550|12u2SvTcFhQD4d1HpNf3cqcT3JBd_iyPT;0549|12szQAfIGly6EZdiQTCnVZhuUvmErvghd;0548|12oB7bcl4jelfXnPtXrUU7hAbOvFKd9CY;0547|12lvudGNQP9MRKIyaIcgByXZct72Cqx8S;0544|1UbHYkuofwQPKIGEzx5XxmiJJTri5TEb7;0541|18JMJzJKg2mNoKhGe-GN-H9VwerkRmdNW;0532|1Gd5s6K3-w3_WGcowSdK7LLUrAIjypNIg;0530|1DgJphgYJwCFshZK59UrDKQ1Qk07AuyuA;0525|1xTBKgBcGW5UmqWJbWGhQaBn7LreXyJtG;0499|1nQdn-Hq3qxkthYG5z6jRQ3VidAEuJclv;0493|1n9R2YJq1util8FNp0UnE8GqUkBf4N6C3;0490|1kYw7gIZzcp6JPDFrgeD1M0BOFB-yl9kZ;0489|1kUGdzWi9YXNYaciV0cFQiSylM4feAfFQ;0488|1kIW3GFd6TfVNg_gQOEZ8aG4uY0aO0nj7;0487|1kEsuyUwOShmyhepxi-pW54jXxof1lqzE;0486|1k9uzEhIDdnN_93PLUV1BdQcED6N52_gl;0485|1k3XC9EbodFN1lumrNLDeyGhpFM6lAUNJ;0484|1juYfn6VMlmddw3uhFcB2bbFTqfzSWkOp;0483|1joxPsLCdVK39_oI98j2NqmD_QjMJxdip;0479|1j-eCfZO2K3u6VfLzLV1gjQ4TVjNLJlRN;0478|1ivi8MiULWdswuK8ungZZ6Br_aayC5TWY;0477|1ik5usN9OsQsHS8udLvadfkfY2XQS8TnP;0476|1ihFGfOYsTV6IYUWWzJb3D49LUVxVOUrr;0475|1iQ-L6xE_tPwET57h-1IQYwIHWqeM3jlq;0474|1iQHV8i3iRf-RNuru00SQ-lmCs7HCrw-I;0473|1i1zZPDl_Fg6p89BaoEsKslnrI7UuQlvb;0472|1i--iLT7YVRfzaw0NpFjd2J2wbJCDaUxI;0471|1hvRI7iTnFTCVWS7tbuAszvX11-_6Wi9b;0470|1hba8_j92vB32jwp6XyTy4rojYtAajvXA;0469|1hR_hYmih9QzB-7hmHS9oauM2c1QY34B2;0468|1B7TFEtBJE5vMsA6CAXJyp62oBfdfQgxm;0467|1XeevCakz6iU-ruluCvJ7oYSgT0R4C3kP;0466|12h7xJUCn6GfLgEFBL8d83ddGbUVlHFyj;0465|1jKYzbd6Z74VXhLIcAejYAZzQRDASbsDt;0464|1BCWaghcpk2fH9f5p2_KfRy45MBz2RLff;0462|1Qp5DgChZ8D1sRQoOsgKbXlfNImCMUgbC;0461|19WSwa1IbAHKbsH5iwJGXMrX8qD4Av4rn;0460|1fIPtWQJXCXezWCoxOv9Aw1-cBHOAKL1p;0458|1fFQo21k7UtzSAe7WeRzgwyilDSwHfX3l;0457|1f7vAeBBPquXr8V_CUTxB6b6JTBYw0nNi;0456|1f-TQfb5TAMW1qbeq1ye3M6l4hAqcWMMK;0455|182UWj6IMKnNYdQAoMzhZ4h_6fHxyc3xa;0454|1dy8vSIhbiz7y5UXc_wFpckYurv59e_pA;0453|1dxNmb6XRzyuLqvYiLQIkEappr5KB8M4A;0452|1dxAao5u4ibIrPLdUIW2BxCjeOGOLpGVU;0451|1dtz3jdvgF_ug2qvUSXOYwT-va2EHvLdT;0450|1driymc7Cu8EBzpTIObyZfCHKvXyWKrtW;0449|1dqTIyg-ylHxC6bFHDzdEjX2Cac5fg0HK;0448|1doO03lqSZWNNfGrXpRZpBF_tRaCN7kPr;0447|1dhbPhcVpd6CtDGArHWI2Ns3fY3INmuKi;0446|1dfQGoD_Avo2X0vR27phEftyE-vJHWV_4;0445|1dYF1hUMt7QSSeQTQWnoEKq43E5pZtwWQ;0442|1d6j8xHj4aODz8JUv4gNXc19R1h1x9gK0;0441|1cqyQU3xDOQ-0BlTKezorj8jNrVfC4Mm9;0439|1cm9181T9D1Tj8tCmPjYn0RCnXwKiUOg1;0438|1ZghsV7yk3euU3ilzNKdDllIpDQSxcK2t;0437|https://drive.google.com/drive/folders/1sUQ6tM_LurQ2UcZIk_Oeg61HsBT8Gk3R?usp=drive_link;0436|1ceD8dbl12ythGsWYjUOqggO2RcXKLjye;0434|1cdUarcJfeTioecuEhAiuJGGfmS0oNuD5;0432|1cQxj7WmjjuJZfpAQZo_QoHlh1nei5M2X;0414|1YZBaMweXvl-606GDCYAV1pVvNot5z3Fl;0395|1s98xRxhJO0QLFP_t5ZPR84DqQDdO0Urn;0394|1Q78Du0b2jsovJ90hyXnoqtNmXVAujmgK;0382|1V1otHAWcFEoI9obGuX-z-RjzkH6XJ3jr;0381|1V15IGLUEe853hPkIC3rUxrf74iMa8hyk;0380|https://drive.google.com/drive/folders/1UxdzZDhQwbYQnOTioO0em21acjgdsfxS?usp=drive_link;0379|1UfF3rmfjF6Gn3P3SXgA9CQ4zfPXALEwY;0378|1UerCxoUCXjl57QoysPO5K6ri-Ius7trS;0377|https://drive.google.com/drive/folders/1UuBF0Rf35YSKAmYc3-s8hR5xzLoBC0ex?usp=drive_link;0374|1U8OXaJu9eZa06D4TIV4cA2KjC5Zks-uC;0372|1Tvc-Cd3xmR5BdYekeio_yJIxKSp7TCy7;0371|1TtiQbHA2Ys3qbE0w-jvfEf__vDJuqPvH;0370|1ToyXVpufdNUXPDGCY1VDx1BIxuOwpE1P;0369|1TmWCqP7LM0E89ohgOjc-DL7urYRoEA1i;0368|1Tja6tw7JQUQHzVzeF42cc6NHh3pZRA1M;0367|1gH96OZDWWTWaOlEMa7Jzp9aHlnKVm-pZ;0361|1TNIpbHeUMQQUpJ97aTPxsa9i7IE_nygL;0360|1TJteuveRztwzdJDwvMKlLU5Fm-KI_8Gh;0359|1T8pjq4PGLVUAbixJDxEPisWfqiJRkeuK;0358|1T81tZz7sRWJz-XusAbQFgsL4rYcQjUL1;0349|1WwgOAY2PIM_SXN2I-fDbEk_eIKXDT8aw;0339|1TN-QK_53xs1B2qO2At4qUo1GR1lGdhsh;0338|1SFYFKIeL9NHmaFHIjzfgM-fnzfBCV8q6;0335|1A3anm2SFS6YNjPn_Ije_2tuEKzuIVky9;0333|1IE109g1y8d5z2wHBYQWYDmbCiWlrLdcO;0331|https://www.etda.or.th/getattachment/d1d438ea-972b-4dd9-9c61-9eeb6bc32e1c/%E0%B8%9E%E0%B8%A3%E0%B8%B0%E0%B8%A3%E0%B8%B2%E0%B8%8A%E0%B8%81%E0%B8%B3%E0%B8%AB%E0%B8%99%E0%B8%94%E0%B8%A7%E0%B8%B2%E0%B8%94%E0%B8%A7%E0%B8%A2%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%8A%E0%B8%A1%E0%B8%9C%E0%B8%B2%E0%B8%99%E0%B8%AA%E0%B8%AD%E0%B8%AD%E0%B9%80%E0%B8%A5%E0%B8%81%E0%B8%97%E0%B8%A3%E0%B8%AD%E0%B8%99%E0%B8%81%E0%B8%AA-%E0%B8%9E-%E0%B8%A8-2563.aspx;0327|https://www.etda.or.th/getattachment/534770e3-1873-430a-8a12-95180258739a/Electronic-Transactions-Act-B-E-2544-(Amendment).aspx;0321|1NrKh2yiTsrglpAFuzrRmd69THcQBk1nN;0320|1MLQZqJBT7or9mFVMbfCHl9si1DbX8TZa;0319|1_VwRhx1akO6tLU9wuQuKozDX0dMEc3pl;0318|17FzNvzHveb0m-HRxMBQtpJypAhKG1rEV;0317|1EU-TzOgvxb8HlmmVv7ncVm2cIeO-fGBj;0316|1CY-GiHa40O7s3e4QRwtB25c4McCFW-YB;0315|11NaDQ29SSPdGrpOWDZWDKvCP3AuL1U9X;0314|https://legal.labour.go.th/images/law/Safety2554/3/3146.pdf;0313|http://osh.labour.go.th/images/PDF/2022/01/3131/3131.pdf;0312|https://ddc.moph.go.th/uploads/files/8420191010020910.PDF;0288|12D9vyLFsiH2Cg3ixva6ihqfPPKtjOfAm;0287|1EZhbugAVyPStWQYJjNzjC7Ol1G_W1c_k;0286|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010764.PDF;0284|1M8esiDXt6PE6WWEbPH0XTjsfcTIR5-C-;0283|1_VgqS1ECRhtN02oeHGXgAwb2FnP1fAMu;0282|1t5Vsrj0zr4Z8f8S6R92GN7yIoqeH6dIH;0281|1cLhFNO7y4qC65OAcvic326jy8EdCz4R5;0280|1mV4iGzZiXIrMJ1SSRHzRLI29HJ8Uvol6;0279|1EYef_MOOkyiKzTuSagtH04kDaw1VaH7W;0278|1D7nzTzT4MlAl3FenSty3HFPpTLnmhUFY;0277|187jkmNHtP-P47qrmBy8N9T7y8OKqjQw9;0275|1MMQuqKJzkkq54t3tW3dofQfa2CyoWey1;0274|1kDcAFqFTLH2hkJwvrCmkTIqbL5fyrPFY;0273|1Ml2M0BIrxC3rYJ841u0b7pdUoyviK7Zi;0272|1LtmCkRxKGJJLZjT0muaGsWpI221yzJEf;0271|1thJxYAm7mfLZAPriU_bBcdG6WTZGtQ0W;0270|1rXa40MoJdXlJ46OrnAsBVz520VMzykOc;0269|1CAKzjU9g53fYAOygHDe35-dzyJmc-cIv;0268|183D1rieZdranLvI2S-kVowmzYCIgCZ3b;0267|1-PNEWZUgRtoHyDOAQqjgK2qDfGrKRy5G;0266|1ymk0IznsW86wowq3KwQGGSZ9A9RPLMwh;0265|1f0GXBdnylrRjR9p6b-vwyEwF5P5-MIQF;0264|1UEivwSZUAn22oYyAimOHG9KrhY9my4PJ;0263|1ebP-L8LnLBwdINVuRO_TJcHCkEVcbepV;0262|1N3z0tBaoxR2WtHiXjzCWMW464fLbBY3H;0187|1t_sPMkWqBtvv64GV3D4oljUgHjZX5Oi1;0186|1TfkIz_pdVGDZB16h9vahHxHKUgyTmj1I;0185|1jAtp2jwhic8p1RrJVPDWE_KcfET5YyAm;0174|1WQWTzOvZJIJTdL3i_NHSjsWyXQcxc68T;0171|14wEinq452RSmor-dATWnyT7coLeIkh_P;0156|1kWDEAUbFM_60aOoqbTZzcGpTEx4k0r13;0155|1kRAI3W8gbSfSOUKutX_LMBio4EpoylhU;0110|1E2hgMqfnZICMVjS91sxPMVsL2Ex75bcU;0109|1u6vSH5iVKrkRl4xsk2KY7W1MulKr2enX;0108|1WePXc8H03Vd29rmwTrb0R5w8MKepE0MQ;0107|1e4G8NNE8pCrrup70SUlyR8kmzeFsCvCm;0106|1ilfGmSa6iVAHiXuiwMJskOf5UNjWQamo;0105|1YjPI66-LJ0uovHU98HhpHmmQBWEl1cpe;0104|1noXQWVDa6bMsPsdkP0v8OKNpv1KrqzcB;0103|1H7b3JxEKzTaCAvCkhUkSAM0UwQwuxrwj;0102|1JUqOzDILwhydVtT0NxHQE_H1UsxqSgcm;0101|1NtbbKb6SKIT-eFzKzRsjJsbH5L2xpqW-;0100|1MBvHdVBAfUcM4CQVgFAvTaFkG88dUvMl;0099|1-Ddv9cCAWBNz1Vl0PEwUtM9gU7gQJqAq;0098|1EHLUXOhuAtSIx0FKqjP7IxSwdBCcS4eM;0097|1MxmIrvfeIDUQCSE9YyiIL4z180lc_XT2;0096|1QIgmtYsGg-IP2153P99FXfnoYq9YnL4S;0095|1pfbTTfVS9eiR1qk80vAMJTSicVqVbws_;0093|1glfa_iRMYMKt_zpnEIbZXqIf6xu7SGVP;0092|1BPNpEsoWjRnaqWH3EioaTXWCmdh5GF5N;0091|10x-cUWvpyRmKlomqsEt6YSqRkTm-MoH-;0090|15q3xcR3DMq9IivvLSI3mH-D6qKkfPq8b;0089|1ZbLnb2VUZMaKTx4yKicIOMJJW2WpAlk6;0087|1TX0R944Oekk6TZqgYRYQubZW9nHTeJ3_;0086|1I--iFWgcDzoy1r5akTd8cDZ_WXFZLCun;0085|1FY7x1bCXzxLU-mr3aF-hksRmHcMiqE9J;0084|1FmEzI2Y4AFyzJi4kOivZdmGc4VJMPld6;0083|1lrAXNvXLtWnZUeT3EXRbki9Lnc0dDrzB;0082|1sq_hxldSzAaHA_6hd6RLx8zrDxDRB9Ry;0081|1aWCnFM1iaFTUi4RN7Qv2dSvOCZYYVVPT;0080|1tCV5vGyWqO2NJ4WFTvvU9ZlOd6pEqaRw;0079|1Lg9yvkCAK3HmszofyCMClYmpbE7AzkX1;0078|13G2ELZGPDnVxahvNvGI6lv5EZCrt7-Sj;0077|1MGIgTbxzWS33TOFFqLurIUsxY6P3oa5B;0076|1kIBFh9d9aJebHp4zaAgElJiVGrNcc07k;0075|1Nvs9uSukDHkLsfoGb9GhdPk4oewtuBeV;0074|1-xfGiZpiYdAHdTTRYsoM_K8qCic7DHgH;0073|1dpmDE2TOwyhMmWEq4LESGF8eooLAgygP;0072|15yW-AnQxCED2cwBGrfxxxXYVNtA6KkXr;0071|1U02pEd5CFets_VvxWmfsRy751ThQpKDn;0070|1LWfHb58tvcuM9wynUsTgrXpD5443N6Ke;0069|1q5b7FABSNFbC5mA9bB_Kc0vjrcSe3V8Z;0068|1k_YrFU3PqcgxsR4VkiRvLVLCnxj04QbR;0067|1WnpsPbl6iKrChWDKHys4vGpmSjwxQEJV;0066|15A3XYMFfj3PrFKf1EAUyljC21OpdcgW3;0065|1EDh-XJ5vUYLRf5xOIM4xnUDY8EqPvZ8S;0064|1pUBlIoU7R70eKLjQvzer76LBJFBtzlo8;0063|18WljjXSd1HTRPC6JEJaxiq_NFhCyPlYb;0062|1aije8_nP0ViZg8-EJ3dndBG0nFSIp1Qm;0059|1d7zNEPtMjrTtAonClrdgww2vgv6bjoCS;0058|1fv0rOj5r2YgSkHMQg1thBj-wNU8nXtCp;0057|1FcDhVjmlTD-kXKIcr143_RQUVutfTYAH;0056|1s34l44oWM3L8erORg7CwWFsbz7VJbUGF;0055|1tb6LgdHT_cK6lqY25p0rT3dEa_xOZHHw;0054|11QoZ4qMxoMRxR-lmYntw67t4caWC2i3l;0053|1q3p1o0qb-B2D480nCcRGbePDwlTEep-k;0052|1B06-oKHSfsP96zyJ619mtQnODfZnZ47E;0051|1F-28-31hnSGqsvKkfwxtAYUhhADgCIQH;0050|1DzWFpvgWHMwhl01-KxgvksgoHUWP2V5x;0049|12WIGBne8ranCyGZVkZurVWQbfPev3_q1;0048|1sZ4s_ydYjD7FzAqDPkHpV4mPlvRN1Lg_;0047|1XZk_6lNGruM3Dn7DnoFzQtnvLid3svWp;0046|1zaALuZgRMvJJL70aQ4CX2w0EcWanv8aK;0045|12Yufo_ku4IooiUgL4u4nqx9Hft99aj7C;0044|13HuGFbffCQvI9ZHClaQdSF_mLtiCcdST;0043|1ezspUnAZuTPIsqKUHbmgXMsjZgtWp2XU;0042|1zu07ErtHUEE5pCgF1DVvWkFGjnEsQx-7;0041|1rKRfs4C7PwWHpM9NjJOe9E1a8itUMrHs;0040|1NeehCaqkPeHQ-hE3CZt4dEtwRk5wBnpM;0039|1GpcEJFsXOCa3EHbkBSYNRfr3DJZohqzQ;0038|1yzobywB9entHDiPuqNiPpnVb6Jy1t6Wu;0037|18MbAZS0iL60DcCuvSyo8ozaEdqvyWYIX;0036|18dqWJxKQj0wEAvAMheHQWCfK_UlOld7K;0033|1AEHoFc7xFUgHmetHTDM17ZvuqzXACL3G;0032|1szFZ4VI2cEcJtoxtvSUVaEV4Pi8t6ek4;0872|16ebBuB1hDb9VZhsE7s_5M5F7cAJsEIAd;0850|1nzjktfp-w6E4HanWAp01A5TpLvWpbWGJ;0882|1JP3F7gul7R5RdR34jQmPJtNEv8GBMXXZ;0880|1XCFzef17q7DTFgwjIEbya7XL0-Ox7l5t;0868|1u_OEG1o8RUoHKUfcUCIyZmASsIh5qI-6;0879|1dvsQYl8KYWIqlMJsBlzox4M5vjhjDTqR;0898|1j9Zl-TMxFHPwz_YX903LpsaeQErJQBoO;0861|16Upt77bULlLt3wHSoRcSer5AkXZH2Z1T;0849|1PV_3DaNEenjUB8kqu2I5XdtogHjIOL5z;0860|1wGkUrcWKhmBKJAuDh3DtgaeZ_UDo0y_H;0862|1tNLmXLfes9c8hYh0SrEyawxj0CTCuQcX;0875|17sXz5MW95ps4bs2xD8KsXT0_zwq4YYsj;0864|1CVSIUFydQRg8b56gw1fG_ptJnrsWjUfF;0857|1qt0j2K4T0OxJhActxc4xkzBG2SPRXiLW;0858|1sIQnve0cc_xkhhpTUfYPCkIU5Ked7616;0854|1ixYQ2anQJAPyngJCbHo_rK4A3AdpKTrz;0859|1jjpEdeKKFdNCf9nym31LqLzjq2vyKYhQ;0871|1WFVvpJrWQb7FrRZO2wMzlsyz5Bs53nB6;0856|11Mznipa9rgglEcUJ_OoQHG9_x3_KNxQW;0826|1E47d-u0GzvEuxBZAo_WChvgFVaXJhMVU;0829|1w0h8fgaoWWfmXpx7KD00RAHeYmNnwnsf;0896|1DAPrdrLbuhm9M4TTm4Vnmcf--G_NPT4m;0828|1IxL1VNl13duPCGujHdjlYtHUM8jFN0zg;0830|1FJAaOiDRbcTsMqfYohz9Xwd7VxmBtcGT;0835|https://drive.google.com/drive/folders/1MUlceZOdsi5K1cE1rUg-DbV_VZ1heUH0?usp=drive_link;0833|10d1ZWnAsSfPIkpCEcwbBq2EwWBfzcNn2;0824|1Aii2j3H1yG-FTDJXAfvjmDX_HPd1yqZ_;0831|1YR5-PIzF6IX0pyH2m6YCcPEWWi07av7L;0786|1Am5CEDwQmfv1XAjNh9rm-pxfYlZN6XGd;0804|12aVLYIMbyP_hxZAeGf43EBeKVs4RlylT;0855|1cQgcRcYLD0H5fCX4LBTXm_jIlE7QqmCb;0847|11w2UKC2QB_xn6K1r2PHIfL021nHrEWFY;0845|13nhVZxZQgCxev01_6jzU-9yOOC8M-qgJ;0863|1_RUfmmjRxvsMZ36GcZ0Iq4cXtll4q7eP;0801|1PVU2l09NyjUkQN2QtKzcU8UkTwuj1x89;0822|14xejyR8KXMJ5ppLWeCGerXfsrpa5EgtM;0838|1bmdWGXgbihe-5Van5j1X8-1YTTrsdzdI;0834|1NBHFHOhF5ZTbwVN1qzMJ0ZteV021BOJz;0783|1TxntdhynsLO4FJPMxjOgQn1_DuaoDYaX;0823|1gvJcPBmUvGtjF3ELmk1st84sAgJbgUNY;0846|1_BRVFkF2r1ogeO7tV2ruX2_zyluG2DBf;0840|17Zxxh86YOCZSCUiyRxX7SEz5cugJ5KCe;0793|1KB9rwhf5JMSG2fVqgPRzXvrIJ5HfNBxo;0796|1SxgUvh1eJR1OIdr4EPgD573yMyTTzk_7;0785|1T72-WJfacS4Wv4Q8O5dC3G_OEPtHBVMz;0852|1R6YXYoUTgC9rzXvHfhU-Td24ONbRHMbW;0836|19E677BijAmMIioaVVyL_3vnXhJjYe6MI;0798|1RQpsZlPz0J6KMwlnls1jLkSAxCg65MYb;0825|1f-2S5Y3BvetepNPSZeg5nRVELH_JxPpA;0839|https://drive.google.com/drive/folders/1ePifa0MYEXXbSDFYjQ02yewuJq41Ir9o?usp=drive_link;0827|1W1rJy-bit-mQZWRQeh_c3gZO6OLE4Nyt;0787|1HPkRrpNoy7o5HAcQxurTAUfzlQb6cLUB;0865|1yjwltKhvuB4xrej5hnMU2sgL11HhzWUv;0803|1bD0L1jj7sVSsXzEnfTLWXUUqcQ3J1M0R;0799|1-HZJPfZQLiSHWFXd53APTASPnFLl_DSA;0853|1GTbPAlF5ierbXMkqHT5P3c7jtJVnIBqy;0832|1QxMevDlQn-lS-4jQy6-RM1vXZHtNcNo2;0848|1WhHhDHgEFkcVckkP1HpQOuWIlGn0jbVx;0800|10vAU7ANKWEJtkZO2Goa8rBlBf-b1am5G;0683|https://drive.google.com/drive/folders/1lYTEAJPbZkL9V3DNAvUaQ7MRU-IFzZUc?usp=drive_link;0792|1E1_0yZzy9dGDNx3YnZkHZ6YuA3-EppHv;0704|18ROpy4U1cXK-HFBj7m9en_inNiSO5Wxj;0656|https://drive.google.com/drive/folders/1wR3TthWncOr-e-6XyWRF0_88mhiNM59F?usp=drive_link;0784|1W2p3WNKi70sFd1NIYdjk9DpOSkk_8tyO;0794|1b3HbWzHXiAScFEt3xUesRvCfRaYtlZ5O;0633|https://drive.google.com/drive/folders/15xTGiTHElGrfD0VG0By74nfvLoHTK8QE?usp=drive_link;0736|1wsPeN5ajPdTsuOPJUw5PvZn0qPh7rykR;0779|1iE_6NHMuQuDP9WII5bx7kvEFfT8RvD4c;0806|19JMqhAt1pFlstxmkoQa01wBOPI9RgWqJ;0589|1-9TW4c92UsVI_-Weqbp9PR31vLoKZjgH;0805|1XGn8jSUX4r1ZKi8-ze_fJdSl2J25jJDs;0689|1PM41Y3MKP0SwJiU0NscwA-wSc9CLFaal;0735|1FgbSer0I7VjUTHdMHJPpySTcnD-pyo_I;0655|1beVa6KwSann3tUAJcm6x4S5PrBoNQJAA;0721|1Z3yYoM6fXZLWDPezS__jWDKLpThVVwtr;0807|1oMFHcLLkwBgkUVK3N1WQxt2tgqhGyYQJ;0642|1DoibwfRXPAYHrC4gAV77w5nyE0WhmboW;0737|1w27lGNdd3yQtXdiu8nEHuxwu4mYtZdyc;0625|1vU5ldjXNFC-hxqf1oXPglxKRUPNheCR5;0843|1ecGpUV8WH7UyNyMQfX8S8J2ACiVRJbez;0720|https://drive.google.com/drive/folders/1CedbJRIqDQUe_d1q6qRqWsc-rVmtILwV?usp=drive_link;0844|1PJIZ6qLyDItgBBmTmImxW5BdCHCSN6Lo;0841|1CUMOKgHitu1mnlYEJkJNi05kPLcyiHrt;0780|1lXTTvEbMAjUekDlHhnHnRmASz8_Gmtbl;0842|1OVT0QHa5E-BEP3nB0Dt9ajusWr3LKcx_;0676|1Bqss0NNGwg6bnKg96HitrUw0oYAE4Kcy;0795|1_ErLFNI45yG1UGou7LM7TRFqnv8QjdQE;0516|https://bcms.pea.co.th/Content/View/2;0397|1D1_uru6CfszL94KJ8XkZBPRGEB0WFlNm;0672|1sqsh-rXjv5OKT8zt1JXRvePS_jl7PQm4;0429|1TSfWk_H5ujjnXqMPsMDDn2-8faKruBDY;0393|1yrOu4mUJoxEY2qXf5kCWa7NETXkH_eA_;0707|15id9xuIQwrKnHDBM54h44d-QxXq-u4_h;0422|1ax5JdyF9jSSbsgnEuJoc2ehOjPCg8Pdv;0417|1EGyrR_-098mXFc-Be8fIuXm2j0JuEjWm;0409|1Y4FN_DqsyUHyTThQWXZtCXTcCWdV2Vep;0406|https://drive.google.com/drive/folders/1Xu5BKEWxF5QqOybNerhbjMiD-p0sH4WH?usp=sharing;0581|1DslPAgluU6axNuldMNXhB660tNoXzj8H;0427|https://drive.google.com/drive/folders/1bQ-Cho6kO3PlycQTbYGAVjF1OZdybdmM?usp=sharing;0809|1yp8_Sl1q-SffBs-65UIwTETiFP1ueSi5;0398|1WnhvOMB0yOHHeCFKFvdspAYA9gfsA5vR;0396|1PlvT2FlIZTuRBUFNzEI4C4_hc2fRrhu0;0680|11NlDCkR-P1FaJXzfaldhE3pX5CtS1KiU;0390|1VW3LqetPCK3EB8Iy2gQGVG8BLQ_8AKzN;0675|1ctJLBDc-tLVWhLpFess7_n7z5nFHjZ68;0768|1NWfylcczE74WgPvKjBZK1XcwDq9HqRZa;0362|1TSfWk_H5ujjnXqMPsMDDn2-8faKruBDY;0790|175OA9HYcK54X_z1paXslax1USviC7dxa;0701|166J8TRK5pJPjDAGMY58GOdtciAV43Gf9;0348|1zb_YSRP56h_d97nyluw0422E7zV_QF_J;0522|1x-9U50FtDHzJ1vxhwDWid8wapPKKgS4f;0776|1hrwGnhls4q0XIqYiZ6WHOSSL2VzrSbSy;0420|1aoyuYo_W78R7oTQCIvCA9NFbdiiNR3wO;0767|1R2GHVc42gAq80dfaZADC18l2X5UrOAy4;0719|16hzNW3C8ph7ZhsCvnLHTt_TIps8Bk7B-;0351|1-edtCQuA0Z6k99DPm_R4RnQFM6PGWTk9;0520|1wu9uSFROa12X6X1wzWZ77TL-tKmvVV0F;0584|1RYEBYexN776f80_ImJWojb0Oe-Wdy6we;0346|1TCId-AmmBdutKpVJXExei2DkquJ5Umz9;0527|11M2Ki-OjwV5j6I9wU5VbUXu0kJPRK5V3;0363|1TU4AuPIurLxtorAAELEij_ir0CgT5sQC;0423|1b-FXo64AbAkqnYisUd8M2JPXgPEWb6C8;0674|1Q_MA2sId8_05-3HdFKDc1m157VBVCADJ;0741|1PAhkZRhF9f038JgbrxTmyoF9lRo9zi_p;0723|1pN-0HchePOa34GNrXz295veYA2NQoYsN;0524|1xSIYMIcl0SjopAzhiVoKvMUerzT_qkgb;0808|1DAWHd2hqNosHsHvmPLa9QLdz_3w29gT2;0637|1Slq7UoHX8XE_B6wjCQgviNP89ApgJRhD;0597|https://drive.google.com/drive/folders/1UPGAVSlF0naRwBzPzYQkFCnEdOhdEvdk?usp=sharing;0588|1Ewdx23DpQT0-w0Xy5WUxt2Sa0pk08RtC;0583|1KRHRHssu0dp39HICwLasxS48lCTE0RFi;0546|129YElQIVAsqafAULe-IEgqeSEYGkEs1c;0529|1XBD5m9Pz8Qbm2h2u1E72wnSBJMUAsFQl;0521|1wyR5WPk4aKl-9UK_k3Ux9XwXywz_IP92;0718|18Qze9Ig2gK3qLcFlqYeaZRQkGofE3ifj;0511|1rH8QqtdZPFvfKjrCFD1opfQoSi1rlk3_;0426|https://drive.google.com/drive/folders/1bGxAXr3QeZ2QhB8y1mHdoB2F7aQuJOWi?usp=sharing.;0421|1av7IcaNo2tW2s5YCjvbeVv66WCTvEUuv;0419|1aevt2gshmNVXV7J17dlTLLRwNWuqKtjD;0418|1aeMd8QCLp63DAnbFnuFI5j0-V9cectRQ;0413|1YJiIOqhBGOQsEwFY1ufNnSBxxZO1MQ4j;0366|1TZOXdRwDpr1nWizKRLXfYx4sATIwGJrt;0347|1Zx6PYcM7B94RZfJMX-ZYdfx8nY_QzdZd;0703|1-G8n34_8ybQWCjLtYHdSJWXSp8lInPFm;0323|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010704.PDF;0662|15isM2_w3rJ2TnE_zqe-H-VveYWDi5msG;0365|1TZDT_H8xqlP7mV3TmU8Sh17I4mNe7pAC;0350|1RtPS7-Dh2tNJclKVbQ_NHAUsSreaUJHt;0325|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010763.PDF;0324|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010755.PDF;0699|1Opo_QfXtIio3h4gj72SZihl7QqUuReyC;0635|https://drive.google.com/drive/folders/1jMA_0l_ra57b8YrVAyNl6Ovyl9Nuxxub?usp=drive_link;0261|19blv6tyOHpWTtK0BCu_H7juCcWCN-erf;0556|1_9mgtgOJq4QiaV2a5JaBoZZfAsaRpSuE;0481|1jk4BDixOlK_7aVJiG3eHLHdV2LsqgFs7;0357|https://drive.google.com/drive/folders/1Sf4aOC8I0O-2kxt38cA4TT5vrqsZZCnK?usp=sharing;0526|1xWKFd4_fu4MMgMqjLCwyuijDd4cDsIPE;0523|1xQwKyBjcYEyxyyrUF-hGWVWBOrovsbLE;0512|1rRzmhipwCT_MSWSZitr1a-1GmCo4mGvv;0482|1jfLoYxGpV8yxNnssGopbr5VLC8g0KpCy;0375|1UK2pekq6V5XQrCAvrIqsYEUBsy4IXKtU;0207|1bavcHUp4b4FtC3-tmPOPosqe-oBkCDaj;0206|1tkOXonVhSeYZpfugVLmRX3vVUtMZ6Ojx;0146|1WYA7li6IBF6sy4nDk8SsiO4koWSlpqgq;0435|1cdkGvibDgaCtmOOqSpn3AFoFuxvDg4i9;0430|1cIIUaSwdPryAdQZzCrSHzOs1YJyHdBH5;0015|1VtnShF9C1kLEULvvlajf5L7Ro25zZLRJ;0415|1ZQvGYLSn-yl9GHXXuejWyrjbPORfg6Uo;0412|1YJiIOqhBGOQsEwFY1ufNnSBxxZO1MQ4j;0215|1XMYfGe4rJ80k7FE9ZJqtpGaF1HocMZBg;0408|1Y61nO4K2c9VsOkXfN3nvIkVVjd355jT-;0402|1XYAXZ21Al5s1dh4QGtBv0WPr5E76MhZz;0754|1fT7q8-2n1uVBIvIGGhcdPzV0P7PY27_7;0205|1haHeugg-2KDunZpyAk6Kmb2KXx7-FCWN;0202|1KBUSzvABmswSusIN8G_4eM0axNCBRZh-;0201|1pyY1gPjHAU3uoc0zEAUtNj1G-Oh0NxMX;0200|1C76ff3JMMVx6szF5lBlP4pQoMrVf9leb;0007|13r9WSibhsCBCnorHvp1hyEyjDe2IK5YZ;0195|1-YYp3gFdpGbAJDvkImZ5wcJs6zX9YvmB;0191|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010630.PDF;0345|https://drive.google.com/drive/folders/1SDtsrRdFj0SP97UU6hoHhS3zbOcNCTp1?usp=sharing;0344|17RWxes1svAdZtO4DiT98c-cEA2zwxndl;0684|https://drive.google.com/drive/folders/1wqWsTpTanU-KdjokaGhAZ2NwlDvNtrji?usp=drive_link;0340|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER03/GENERAL/DATA0012/00012535.PDF;0671|1O_wpfqin3aHjpTdMbnSlSqUfL1lM1RF1;0416|1ZTAO2f5EUlp_5n0h4O_u79s8hS7_eWFU;0643|1nPCG-ObQSD7JHmm1gitThsefVqyo9zbD;0634|1hGYkVylFVXwBQGkjhoF4uNzJ813c9otY;0334|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER05/GENERAL/DATA0017/00017407.PDF;0256|1-HA9C3RCYVODuakLOnkg-VDG_ebBB50f;0019|1t3WOO5Pwggp7C8s6iNXNd5-k9imdIcG-;0252|18I4FBAUH4EUie3W8JY9kD9B90EHLD11K;0088|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010649.PDF;0249|1gRrU82QDySQDtYSW0TOY1uwms94ZvPFt;0154|16-nhigDX4uYlFJYyuwJ_rgKPLPZ_3gJB;0002|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010631.PDF;0242|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010701.PDF;0151|1dwn1Zv-iei-rmG0YbHwsqgNuVtQ346bT;0150|1XGHRQn-9uOXu3hghzvpg0-OVK1PFuAUx;0509|1r8jakKDT5W69XAjrbeD41yik2KKSFV35;0035|1rer5P-2yznRDGI-ZzftB8izxL5XIpYkW;0234|1qHfHJKy4il568cOjNjvmQKboR0x_58RV;0233|1vKDTliNnoxdYgXZjWrrG1LGbSwyPJPq5;0148|1aLaXLv0azF68wn34yxKuj8xCwgf45gon;0147|15WBhoh8ZDk6GNOfmeWlxkalkrIP2RM2M;0491|1Qrjh7uxzaBjLC1Y4bH9QJVJIRulfmegc;0480|1jnBn3IKOQaTT2FwHKoFjkP72yO4xzFop;0001|14jO3vB3_7Sq_K84XwUYseJBgK7e6dj9K;0145|1lQ2RSmDStQ-KI8Psy773yZ7aaaSVQPgX;0144|1Q4MFSKNnku_9kIqinXyicmn5_CvAWVuU;0223|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010674.PDF;0428|1bWWiVQtYuYzD-AkvFAcuKG5iYkr39UqX;0140|11bXV2XUgnPi_119sAM5MQqfHHic19409;0213|1rgPdwCfrBl1CwF2G6jYpLpcdULHtUnGz;0014|1MkwwLyFNXHSrcUpzruJeZBxp1ACdYvSi;0013|1Y4JpSeZBVFvW0f1Xr4g9rChsldnQNq3x;0134|1tmJy3fYs4S3JCh7e6ONlRg_-9iAGWHnQ;0781|1HslLiwR7Nd3GgxRftiQjCJyzL9veAVtY;0199|1gK6VDmmmTLZvR6-x2BETaJdVKrfHiTnn;0194|1r6coZrWtsQiulhQ6KgNBBbjsejXZQgRy;0012|1ZJxL3YAeuZfvdIaLxyWas-BDMczi0Htx;0702|1ErYoi7kbBBYbCuXLkc6lbOfWFDULEfTo;0700|1lT-xVoN5TBtp7B2ujaOkOS5g0Somksoj;0120|1U05RkGum0px89TbXrzgNDF5qJi-KUC7M;0693|159eZBeOvCv8Kk5lmqh26OGyQptYWe-gh;0118|10LC9Bw3Z4WsNYlmLCylUDWupEldwotfb;0670|17QSfYvzLqGzveQ_2g_zt6f_SJx0WuvN3;0661|1oGLzGH1l0f_gVfoUvBBrK1owsqcNWtpU;0652|11TE3AIlQQvJPOuO-5jkRpNvv0_9179Lq;0010|1g4YNB8iAi7IlrMd4WCcd1E0ImmVl1eBW;0198|1fQLxOlurrDH6eOGPM6O36hrP3k73A5mN;0257|1kHFh0J86N9l6DxTMtmAvmMnXFm4632ax;0255|1C5PfD3tUa1N5bhGPYmn7tNozN5c9wmAE;0254|1CxXif_0ZwwHSj_fFxL_rLVbSUxznT67P;0009|1e2ZBWxVBPcaqDB4utrUfN0W7-VPX886W;0251|1-N1i3O8S1Ou-u555BD22ROZQ5KHT5iOT;0250|17gdGVASB37KWMrwlqC9cJ1tT4mKgOPL7;0425|1bDeCrnBbOuVQ0BlhVf0pTI44SC5wQXZI;0018|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010629.PDF;0061|17fLVqL_uOYu5J2vwzb-k2BneTS2TLvwh;0152|1AwI5czsripRUqD3SQkX_2eZ_FryiHx_b;0240|1PWvgp1nMA4aWLJyUyPMRAiJoLteyaZ47;0237|1gOgZ3XMBJu8_BWdDZA5eD7zd7zFOQ9m6;0149|1LlndhdhpJ2N__m6DT4K7cfg64X_KgR93;0060|1rq3pnGg_JAuHMcqdsN1Of3Wbn8KcnGgo;0505|1qwEnQ--bnrZwBIxfwKnoZBfPWn9YgqmC;0503|1qp5esKilCMUBCevza_AC0X26zOajj7Tb;0232|17C5BwuH-gAs_LZZvotrdMAjhLlafWjq3;0034|1tv8PFJPjmbN_bu9jUVFHINNusPsWr8kt;0492|18aFpiBN2PUWmOzJxv-n0HKe1JI1kz_4V;0031|15nF6AZnuWGEqgjoWkFVOaih3lCfjsW-B;0227|1OLwELdYLal6Plhr4SrpnJ5yJXDMvmT-1;0433|1c_YGFps03HtP6a9Ogygx9qUwRqBt7yvz;0431|1cKIr0-xok45vYSQsHooMkj1kpKCtgwav;0029|1Q0_YPgPlmVsG00IcqjzgJybdRdAbWcwz;0221|1W2LslpKO5IuBs7vmLJhz1dvP1I8CaslW;0141|13OeUNLDkeUAiQmdd2jlGIkl50HzsSY0E;0008|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010570.PDF;0216|10myYj8jt8BiFM_nueaXVTEtJa8vCOJjC;0403|1Xb4ENS_j2GL6DV3g8LRdbnKnWUxWjMGv;0388|1VT4_PfjruUmMmVLGnISr-snGN4RI_CPD;0026|1LBa0ZtripAAZWpFP579I9NAiF5I-f5x_;0126|1W9dIP4txkUlEZkBf56pOLJHC8jryarcd;0125|1QqpqA0yX9AhFstuBU5KNII7M0n2K8AR1;0738|1eAh5Gdi-uApA4RAQUqcd4G1Y8kwSfTGi;0190|1uC0MM7d0FwPmbo9rRVmEWuu93lL2PSKb;0123|1SXAKxTx-X56gjtrWuIjHzQtSHXrXUM5c;0698|1nX7L9gUzBXdkQYzuvruzkgnnDUD5VlfB;0116|1g7boLBplW9b7uMMtvFivZTZ9HueKdlr6;0332|1zg0cKilYthi2ToJIGWVKzcpnerv-SN9k;0006|1Xat-VuTb85UmgeRFqaU9Br9TdFIuZEnn;0311|1RjOoNEIXTAVYA3fYmGHJ5CvcROtiWRkE;0114|1cmTFG6OU3MrKkRifMr5QwE7Sf-6wezNx;0648|1EOjWpee7Ix0WbBUrGG7th17RcTz8G46A;0647|1wDj1NFzi0yB8b7FrBYtlK3CPMvMh2Z1y;0160|1peMUiRwk5iMlYZqtEF0ZboveiwlpeKza;0235|1MBvZTLzRyoezPFXYkBuWIREmT6LSeVuc;0518|1wWydEKhFjI6KL2rHWihRVAHwuaI3mvBQ;0514|1rkVhYd8vumbwvWe87-35mzI_0fqNZW7K;0513|1rbERl4jhg2lbzwcQI3pivqNP8_K2dJiO;0236|1CNxMc4F4AK2HnCKJfJuwOCljZ7J4P-ME;0224|15I2ALKBGvSwfbZ6Nr-QvTqZ3UrkyLenL;0867|1XC7CDAlB78VRTKb56e5ASnVjjD9jgbBG;0220|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010406.PDF;0016|1xpfV6IqOo95mPUBVSSK17W4XV8xpzw2r;0139|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010400.PDF;0401|1XVBR419DWliLvtRBVVtNs1qZriSqJ6v0;0400|1X3T8FmR4Il0Zq20YjFEV_YKh2Nb7fGqa;0208|1TlqRd1SGZLkbGnCV5DTuU3FxPsl9Og9X;0399|1WzEPy2MkyZUDf8pY5VNrO7MxhkWIATPK;0391|1VXC9XsF1l7BXOY6Oz5WXnwlPztt4H4bx;0364|1TWM_cZkK84D1uyCOhOEIPvWesJMwx9uj;0005|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010403.PDF;0169|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER05/GENERAL/DATA0015/00015333.PDF;0664|1nc0g4Ly06YxZ1upV_Sbh5FaCQwy8eFYV;0168|19rqBH86h-I9oEjRkb3sK8O3dedMcy83F;0659|https://drive.google.com/drive/folders/13d8OMJh29hF5TA7iwLhipqo1tMvYwF4j?usp=drive_link;0658|https://drive.google.com/drive/folders/1IOWTvgrPtAfKuCAEHGQXbznD0_uHgEhW?usp=drive_link;0309|11HRbABhA15Np_2FM8sEml5RhCE3qubfX;0649|114n7uokGzHYSstfJIjBQyFhxCm0BMaFM;0636|1r05IXHnbhp1RbivxLw2zh5QEIRcG5n73;0017|1pAP3ZGb8ww4u8YAfrKTqdywSsVplnpN9;0161|1QV4ZW4JG2_fP4fp-l12_Z-8_vr9j9le4;0258|1D6Qxb8nZJqcjfQWYYOPdGfGxrKPx2UCQ;0004|1ZmTvr41vOU3EjVf-rZ_Qr6mPZOBiWXmG;0253|1XHjlq83GvBsnIDQiiUqMtU5h92abPYqq;0158|1HHh9T8gWjaKLK8Fqj-iLatX5Hdi4RrbV;0248|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010366.PDF;0153|1Vc0B5Fmvf-kmpyULW0UbAc9GG5-v5Sca;0241|184m1JBl3HSniZfZ6Ea_tUY8RsBJu9yPN;0500|https://drive.google.com/drive/folders/1Fkf3oIdf1D51dmfHVcCXHO2xPtpK_Cqx?usp=drive_link;0501|1qi6jlXz-HURZFxjM3yoOKV3G59ctt7WR;0222|1tPsz9aJWPuu-RZWQXboyqBZyuGGcw-u-;0218|1iDt2nKVDtke_nnQdOx0jCQKkGOkF9BGy;0410|1YFRiZRp8h0xc_luJEjtuiKtqM18BR2h0;0217|1X0Y63eF8w1pfMn3jfDiEE6quP0XsQEkx;0025|1u9xPnspT2aE7F2IlM5KzWYxKfO3-Q4Lv;0209|1u5F_SAP_PblMtHQiVeGJ72JbKdfots_L;0204|1dRhCprxoLnWs6KVLK-D91_CKmfVCwWQj;0392|1ZLuWyJ5czvsbclomzGt3hsZBoQJuGg1x;0136|1Z6p2IV8zBZkqCRi4pa98sWKdDaFSxUcR;0386|1VCe6PUMJX_Bwi7Rm36N_0ziqwiIvkjhu;0387|1VOXzzkUKurZI5fNbdG7cYKlPp0Xj2CkZ;0766|1Z9H_uSayuQUjT09AzjB0drscW3y4ppB-;0023|1u0tbXqlwbN1ENVa7R_2GzSbxdVIwYPqC;0188|1aGSSgm-ZwAnkJM2B1HULNJuB6zSiQZLC;0685|15aqFfZJdZzw3woj5ITDemAf4o9OW5ftd;0337|142KXtPYwEZXloMCmOpKdSB5-v6rNZ_YG;0669|1RFh63frw7yFGXENeOV6rRDkDqGSm-jrZ;0668|1HY-qTNxmzg-5c6MSzPdOoyuxtUW83hKQ;0667|1uPVr9RlaWyOQ-qYpyCwHnB1mM6vnt_Eo;0115|1GHv5ULg-Mqa6E_qq2Adgx8oUUpqTYgDO;0641|1vYo0yP-cNgFlTrY9thDDS3s-vFLTnI36;0638|149-OuoLBz_ZLG_BOqXKKwhKjBCveNamB;0624|1pMDcVuo5r1b7rNeHye8omt4U5Y_4Phgg;0531|1oVRWuPhvFzKCjNeYcdIl0s0zo_egY3C2;0030|1efwDgl1eSTDJsaqWnaHZcqgyD52V8FR9;0219|15KFG8QkaAW0shHcceAq_h-jGH9PvT8b_;0203|1n_cyjrWQneS4tN4-VcMvHyqqC0Jt_rwW;0802|1_uyHs3nrlfuSOkUevFWhA7pSkd2hqVCa;0027|1VriWRyJeGK4E-Oe1CELDooJaNMpSUjID;0385|1V3g5ZnEIvgLzPhFPXplBddE4KVdRyEe2;0384|1V3__8_Nx5HG9a_MPfMINDVkBQJskZOV1;0128|1zGKcICN9f768RjPFDwIkSXRqtyqGMBia;0383|1V3-IZ0sZl2k_4uqyCIvRHN-V3AlkRxmh;0197|13MKfauWWmffIWHCA2VpR7uuUL0SFjfgj;0763|1Dh_iK4mEn-cZR0czLPrF7n1ytjhxeRKV;0762|1sQz-6ViQlkJxDlJDNdy6PlJtanOVrqk1;0758|1JqtVbYVvBYFq32FJFG7bjjKKygu-PUWb;0759|1qdEr9bZ_2Zc9W1gMfVdWk-Bd5YBUMjJV;0024|16kWMZcckrnStI142yRJKpVCp-mhKf9do;0757|1nkqYq_1fqpWeyjptnrg2PNVAXIFNfog4;0726|1vlORt1NHIEvK76UJzH6hlERStoEv61_U;0182|1y7pjlAPzROygYPYdSHlklIudG8AxmlhL;0170|1lRYPrVsUgXcG8ZZ9Unf_2nWuQ7sdAktk;0011|1LOi9d7SZ4zsQack9Lgot3RNxmu2cB_GO;0166|1bDrMmg-rJLbItdUWiRVlE77WeJziH3FY;0094|1dL4Dm5AizIM8M7CDPFEVjjDwrJFlbRR2;0292|1NWMvoX7YeKSZ9a9uIBZ1jfBInPJ5GHfh;0163|1mE_L384MYUQiKh0mw80uh0JaWbPn_3go;0764|19yJinMTuPo8ROUWFOFaecsK56x9JMRyg;0260|1JgYWhJ4Js1_pZ6_tEXIMc9lu2jhyT2RY;0162|1ZOtbPxWdC3S8_EHGrHSl35UZb4OJQTOg;0543|1uR8DZjuKhV7nBZCMNOHqfQR3qSNbptMW;0761|1oFQsNihdwd1JIAd4i_vkpYWS-20BFBSd;0538|1ztqf1bhTXANXapvcI_N-3CrLbvlxPyuu;0537|1zGqMlHibfzMzXGSET1XAZ8ris6SsFTgy;0247|1bGSX3wb2JmFrV3QR60U-ecOHC_2ZO6l5;0244|180yMx9aXqRlHsnmtcMRsYkX7XyRTjWv3;0507|1r18uAD0OSZdLoLRZwk8kW5uKbxqJCU3t;0131|1Zwq6lCS-gqje7kSRdX0bkeFlPCqGzkQX;0355|1S1r-LZD2eta6dIusHSBTVGwAL9IukadN;0354|1S0mkAJbQwmWvqUTiOjBcDwzW0ttN7L0E;0175|1xEc_8eyqqv_cHID1Mxam0vHifFEHb1pj;0336|1OrNpaqgJOPtc5qoL52tOhKiqI3Yg1YQE;0322|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010628.PDF;0306|1rIgJtXH6X22vo1aoKgOg2IjPurWvNXxL;0113|1Y36Uo2qr5LQEqYdw6hEm6I4kXBvyUZvf;0628|https://drive.google.com/drive/folders/1NBeMwDa7-hR8MZvK_C9TBC_3oL12Zd0i?usp=drive_link;0259|1aE85s2Jvvw26IgKXdWmXeBNjnt2KYpPI;0545|11hA2fejvp4zgXf5101ORbQ13mSROJu9N;0542|19XOB9bTqCq6vJGBNCCRZ8M8SQduX18gD;0528|1jZnb6xLjuPit6VRy7Ed_xOgaReeVXkTt;0508|1r6QkmM6p4fl_ps5DTctjAVRF_XKPkyOR;0230|1psi2eTvQePdpVzVScxEEwoJxAUmjTAY9;0225|1Wv1oO1gS4QrE6eHXJws0BgElAQ6gv5d_;0821|1y7dodexhy9glKQpRIE5wa7Wt6OcSfm9x;0777|1BvX5Q8hcBxLNPcPdZkcsfHJPlKdVtTuC;0112|1fIJ8diENTDx8z-6NkIO0GadZw6wv0z73;0579|1g_k_snMQClJM4BtMpm_HM6zkYO9j0E0c;0519|1wXEkZUw_CXITrbonZQgHbTHgKOvfd-J9;0229|1QYmYWy58o7RCalr2GMCH1Fi_BbP24kk5;0211|1gMyNC34wGkF8i29JqyuELNbVeJHld_kC;0138|1JgHYCIfxxGtgmKVseIgqgVA9bbJ7RVrW;0753|1budLDapTO0NhYjWZEe2PEP0gAp_tKn-y;0740|1B_xlTKQATYB2t_MFiXNm-Ce9ROm8RZEG;0666|1rm_slTTsQU17as68y3I5uUxn_iGWw_r8;0640|13Rkb8gxu1guWmLXkTR2yDG0hq10obJDA;0639|1YSuAkTxD80j_2ZIhZNpa2Fw2orDB9cLG;0555|15NtqycLorlMUA8BsWqWwsl4nxOMEaCKV;0536|1z81CU-Pfm3KUz6ek3t_U5wbXxbsvkecJ;0157|1Gb7IiifJ_feJwITGCwGAfBz73lIqmXEr;0028|1BjSHOTj_Med6sEC_L8emFB6IZja-jSEK;0373|1U28rTma6EFGB4z9_wvabLdUTtVFvq8GM;0352|11yDEMc9G8PX_k_COuS-S1E7Qe4D9zded;0167|13lyIr2jwtOJql3iIccWMAVkPSBC-WpGN;0022|1RYzdqICYnjtJn72uIkVFcJBQWdrgD7HI;0651|11YVpNz00djVlS8x13KlYzv5Tztbt6U6z;0650|1KpcYS_jMB83A0By2yW2aQzTi-yKCNUj-;0294|1aUXmV8wTAV3ojkRg4zRLolOeInEZERCN;0021|1pqAZfZGd2WWRYRUy6fzu4T51JGvHPsYc;0535|1zpQI_skH893wMw0QwoyFqPCB4WltaQqF;0226|1dxmzaNN8Pp7eJZpFULc9ByB8cuV8Tg6c;0851|1lMn6ysINk5HoTh9C-h1D5ORhihayhgLh;0411|1YICk7jg2mUrOPq9fBdcbv9AjywFg0xTO;0687|1_PbHa099kbGMwCngqBWz_7Rg-2B6W909;0653|1GIrspGXxlVwJHCy1gfOwzO67aoYEYGdP;0291|1x55YdO3nI5C05Zh2qucmrWN6JRqeASxY;0873|1qh7I-ZBcJm1F3XQ6p7OMlgMWA9yhqJC5;0405|1Xg8KqW4yz0gxG_Du04pZCZ4WxdPklqHw;0404|1XeUMlWGtATtPlt9ymi4EQfEZIhf26O63;0389|1VUB998CcrU82WbuxGsHZfq7ZR1fNfR7l;0376|1UZj0nF-UuTukaTjYthXEgVIo9sAf9rdT;0582|1q12i8G89LlOgomPYNvjKXl8-oXuzWwd0;0504|1qqubJG2p3cGg_DKAGuzV9Fxv8XWDfQMm;0820|1xm60yr7_9R2P3_RH0DAtJOnfaVGfJX_p;0308|1pxAX5R9WsWINx866ww58_qeBTXQvoWLP;0534|1yrGAb_TOCeJe9cuCmjlc96H9RJzLKkcR;0443|1dC-GsnfDGCQr6Ag8WbWZ9SFD8IZzKYFh;0143|13Ehq0CDx0OS9K7HaOpPEdiIcsF2iMzSW;0765|1XDtZcd7iqjRZCrmJPXJzX24TE5DQTzW5;0760|1z5i4xkOsscKBig4j8PFMT0zO7hrKkGOY;0539|1BrZx7kwxfew75s8ljmXIxBnE9HRPBpz2;0515|156;0142|1pnWOao1izasP4dM3HVtKIZfU7uDvLti0;0310|1BMYtVDGrgIMZTmUdoWb0hRm9QqyNNx45;0502|1qjnDiI0N7-JG3OIRMmPs3Vu1Usn2zSFx;0444|1dNHxcgKMWuyPVA1050CDeP0d4A-eUwVl;0657|18cRdxDZrtFpcrvR7yROxCfq7PbNpBkE9;0646|1p1pHJZNfd44ZQAAwy8u-hEQljzvT9YRK;0356|1S4yAUyyIjUcvNRHCCFf7DLJS2cgrF-5R;0183|1rE_Y7aYxqa6cwQPVmEI3ULGUpanJPhFf;0663|13_s4tDZ59zqHIiesfHI9lFue6m0QDzAs;0654|https://drive.google.com/drive/folders/1FM11jtpVpgVnFU5E82HFvM05ltKDHG07?usp=drive_link;0293|1QI4dh4-kwU0CvGbkTYd5TIbkf4xYup5o;0111|1h4Yq8fn9g_RkVIC7rOt1cW3FZ3A6u6Fo;0184|1oiYTlDJhsHFkvIPArCBmJIkcOW256xGD;0533|1yr9yhVmMHscDMFt7aD3Dfa4qr_UXPkNa;0020|16N0erXlW8xLij3QqxtkbjxLPQ3mzMQNK;0196|1Xohcqzx112UxtKjZdKPhxxWjScN0ISMo;0290|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0010/00010664.PDF;0243|11twiJNN21BZAny4Z56uL5bHPt_onvqPb;0742|1pjfmcD4PEEFClnn9bcZiAEX2iYSDXgis;0660|1EuzuCByrPW4EE1gBJGgsH-y-njWMprNI;0751|1a2ToCyxUE3ZfdwY8yqa1vwrmcye8pgoB;0245|1FkVDT2Gy_PGCO0N-dBsyr9ZhTBL9zcDL;0459|1fHrKnqyXCRJCmn6N8PuieH9cmPj6fInh;0164|1vRVaObMJsyYeVXlmV-onIzC_e9ecpcBz;0159|1P9yY5lQC1ydkV_cO0FcecS6m6Z-MI7pE;0137|1eIKjPAoL8zWtPX7i5Ksyzamazko6Roch;0506|1qzvkDKSELmwYEY3hXBqtwf8sKuMMuJu5;0463|1QYv-e_BC9bPy3VaZ930j20Qxthxvm1TM;0510|1rFEXrNFf7WUVbBnrXyLQ4srIcju3pzE7;0540|1zvSqXMJqP3K1lJ-efF3MPcKIaAFkjUll;0341|https://drive.google.com/drive/folders/1TNt0TsB5j7ADNVyy0ZcWEiF_wL2cxyIq?usp=drive_link;0695|13zRXR7xG3Ex-4RuRKNnF-cSkPdN-NEVT;0228|14dPnBxgxc3mZNlqfOb5rxX4AQ4UL3cgU;0165|1TwcQi62l9favWo1uSbKE5N1eAv8X4QZk;0289|http://doc-server.pea.co.th/FILEROOM/CABFRM07/DRAWER02/GENERAL/DATA0009/00009811.PDF;0665|1g26lfxDZMcWi5c-uapyTRF9VLZkp_U_c';
