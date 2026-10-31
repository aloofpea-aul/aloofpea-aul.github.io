/**
 * ระบบสำรวจออกแบบงานก่อสร้าง กฟส.อ่าวลึก — Backend (Google Apps Script)
 * เก็บงานสำรวจและราคาวัสดุลง Google Sheet เพื่อใช้ข้ามเครื่อง (มือถือหน้างาน ↔ คอมสำนักงาน)
 *
 * วิธีติดตั้ง
 * 1) สร้าง Google Sheet ใหม่ → ส่วนขยาย → Apps Script → วางโค้ดนี้ทั้งหมด → บันทึก
 * 2) ทำให้ใช้งานได้ → การทำให้ใช้งานได้รายการใหม่ → ประเภท: เว็บแอป
 *    - เรียกใช้ในฐานะ: ฉัน
 *    - ผู้ที่มีสิทธิ์เข้าถึง: ทุกคน
 * 3) คัดลอก URL ที่ลงท้ายด้วย /exec ไปใส่ในหน้า "ตั้งค่า" ของแอป
 * ชีต Jobs / Prices / Deleted จะถูกสร้างให้อัตโนมัติ
 * ติดตั้งแล้ว: ชีต "ฐานข้อมูลสำรวจงานก่อสร้าง กฟส.อ่าวลึก" · โครงการ Apps Script "สำรวจงานก่อสร้าง API"
 */
const SH = { jobs: 'Jobs', prices: 'Prices', del: 'Deleted' };

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
const jobsSheet_ = () => sheet_(SH.jobs, ['id', 'name', 'status', 'place', 'customer', 'updated', 'json']);
const pricesSheet_ = () => sheet_(SH.prices, ['code', 'price', 'updated']);
const delSheet_ = () => sheet_(SH.del, ['id', 'deletedAt']);
/** กด Run ครั้งแรก เพื่อสร้างชีตและอนุญาตสิทธิ์ */
function setup() { jobsSheet_(); pricesSheet_(); delSheet_(); }
const out_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || 'list';
    if (action !== 'list') return out_({ ok: false, error: 'unknown action' });
    const jobs = [];
    const jv = jobsSheet_().getDataRange().getValues();
    for (let i = 1; i < jv.length; i++) {
      // json อาจถูกแบ่งหลายคอลัมน์ถ้ายาวเกิน 50,000 ตัวอักษร
      const txt = jv[i].slice(6).join('');
      if (txt) { try { jobs.push(JSON.parse(txt)); } catch (err) {} }
    }
    const prices = {};
    const pv = pricesSheet_().getDataRange().getValues();
    for (let i = 1; i < pv.length; i++) if (pv[i][0] !== '') prices[String(pv[i][0])] = Number(pv[i][1]);
    const deleted = delSheet_().getDataRange().getValues().slice(1).map(r => String(r[0]));
    return out_({ ok: true, jobs, prices, deleted });
  } catch (err) { return out_({ ok: false, error: String(err) }); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.action === 'saveJob') return out_(saveJob_(body.job));
    if (body.action === 'deleteJob') return out_(deleteJob_(body.id));
    if (body.action === 'savePrices') return out_(savePrices_(body.prices || {}));
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) { return out_({ ok: false, error: String(err) });
  } finally { lock.releaseLock(); }
}

function chunks_(s, n) { const a = []; for (let i = 0; i < s.length; i += n) a.push(s.slice(i, i + n)); return a.length ? a : ['']; }

function saveJob_(job) {
  if (!job || !job.id) return { ok: false, error: 'no job' };
  const sh = jobsSheet_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]));
  let row = ids.indexOf(String(job.id)) + 1;
  if (row > 1) {
    const old = sh.getRange(row, 6).getValue();
    if (Number(old) > Number(job.updated)) return { ok: true, skipped: 'newer on server' };
  }
  const parts = chunks_(JSON.stringify(job), 45000);
  const vals = [job.id, job.name || '', job.status || 0, job.place || '', (job.cust && job.cust.n) || '', job.updated || Date.now()].concat(parts);
  if (row < 2) row = sh.getLastRow() + 1;
  else sh.getRange(row, 7, 1, Math.max(sh.getLastColumn() - 6, 1)).clearContent();
  sh.getRange(row, 1, 1, vals.length).setValues([vals]);
  return { ok: true };
}

function deleteJob_(id) {
  const sh = jobsSheet_();
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]));
  const row = ids.indexOf(String(id)) + 1;
  if (row > 1) sh.deleteRow(row);
  delSheet_().appendRow([id, new Date()]);
  return { ok: true };
}

function savePrices_(prices) {
  const sh = pricesSheet_();
  const rows = Object.keys(prices).map(c => [c, Number(prices[c]), new Date()]);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 1).setNumberFormat('@');
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  return { ok: true, n: rows.length };
}
