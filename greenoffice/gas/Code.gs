/****************************************************
 * ซ้อมรับตรวจ Green Office 2569 — กฟส.อ่าวลึก  (หลังบ้าน เก็บผลการซ้อม)
 *
 * หน้าแอป: greenoffice/index.html  ส่งผลมาที่ doPost ทุกครั้งที่ซ้อมจบ 1 ชุด
 * ไม่เก็บชื่อ — เก็บแค่ กลุ่ม / แผนก / รหัสเครื่องแบบสุ่ม (ไม่ระบุตัวคน)
 *
 * ติดตั้ง: วางโค้ดนี้ใน Apps Script ของชีต → รัน setup ครั้งเดียว (อนุญาตสิทธิ์)
 *        → Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone)
 *        → คัดลอก URL ที่ลงท้าย /exec ไปใส่ในหน้าแอป (ค่า API ด้านบนไฟล์)
 ****************************************************/

const SH_SESS = 'ผลรายครั้ง';
const SH_ITEM = 'ผลรายข้อ';
const H_SESS = ['เวลา', 'รหัสชุด', 'รหัสเครื่อง', 'กลุ่ม', 'แผนก', 'ชุดที่ซ้อม', 'ตัวกรอง', 'จำนวนข้อ', 'ตอบได้', 'ร้อยละ', 'ใช้เวลา(วินาที)', 'ข้อที่ตอบไม่ได้'];
const H_ITEM = ['เวลา', 'รหัสชุด', 'กลุ่ม', 'แผนก', 'รหัสข้อ', 'หัวข้อ', 'เกณฑ์', 'ระดับ', 'แบบ', 'คำถาม', 'ตอบได้', 'ตอบไม่ได้'];

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(ss, SH_SESS, H_SESS);
  sheet_(ss, SH_ITEM, H_ITEM);
  summary_(ss, 'สรุปรายข้อ', [
    ['ข้อที่ตอบไม่ได้บ่อย (เรียงจากผิดมากไปน้อย)'],
    ['=IFERROR(QUERY(\'' + SH_ITEM + '\'!A:L,"select E,F,H,J,count(E),sum(L) where E is not null group by E,F,H,J order by sum(L) desc, count(E) desc label E \'รหัสข้อ\',F \'หัวข้อ\',H \'ระดับ\',J \'คำถาม\',count(E) \'ตอบทั้งหมด\',sum(L) \'ตอบไม่ได้\'",1),"ยังไม่มีข้อมูล")']
  ]);
  summary_(ss, 'สรุปรายหมวด', [
    ['ผลตามหัวข้อ'],
    ['=IFERROR(QUERY(\'' + SH_ITEM + '\'!A:L,"select F,count(E),sum(K),sum(L) where E is not null group by F order by sum(L) desc label F \'หัวข้อ\',count(E) \'ตอบทั้งหมด\',sum(K) \'ตอบได้\',sum(L) \'ตอบไม่ได้\'",1),"ยังไม่มีข้อมูล")']
  ]);
  summary_(ss, 'สรุปรายกลุ่ม', [
    ['ผลตามกลุ่ม / แผนก'],
    ['=IFERROR(QUERY(\'' + SH_SESS + '\'!A:L,"select D,E,count(B),sum(H),sum(I),avg(J) where B is not null group by D,E label D \'กลุ่ม\',E \'แผนก\',count(B) \'จำนวนครั้งที่ซ้อม\',sum(H) \'ข้อทั้งหมด\',sum(I) \'ตอบได้\',avg(J) \'ร้อยละเฉลี่ย\'",1),"ยังไม่มีข้อมูล")']
  ]);
  const sg = ss.getSheetByName('สรุปรายกลุ่ม');
  sg.getRange('H1').setValue('จำนวนเครื่องที่เข้ามาซ้อม (ไม่ซ้ำ)').setFontWeight('bold').setFontColor('#24553A');
  sg.getRange('H2').setFormula('=IFERROR(COUNTUNIQUE(FILTER(\'' + SH_SESS + '\'!C2:C,\'' + SH_SESS + '\'!C2:C<>"")),0)');
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('แผ่น1') || ss.getSheetByName('ชีต1');
  if (def && ss.getSheets().length > 1 && def.getLastRow() === 0) ss.deleteSheet(def);
  Logger.log('ติดตั้งแล้ว');
}

function sheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#E3F0E3');
    sh.setFrozenRows(1);
  }
  return sh;
}
function summary_(ss, name, rows) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  rows.forEach(function (r, i) {
    if (!r[0]) return;
    const c = sh.getRange(i + 1, 1);
    c.setValue(r[0]);
    if (r[0].charAt(0) !== '=') c.setFontWeight('bold').setFontColor('#24553A');
  });
}

/* ---------- รับผลจากแอป ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    const list = Array.isArray(d) ? d : [d];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const s1 = sheet_(ss, SH_SESS, H_SESS), s2 = sheet_(ss, SH_ITEM, H_ITEM);
    const seen = {};
    const lastIds = s1.getLastRow() > 1 ? s1.getRange(Math.max(2, s1.getLastRow() - 300), 2, Math.min(300, s1.getLastRow() - 1), 1).getValues() : [];
    lastIds.forEach(function (r) { seen[r[0]] = 1; });
    const rows1 = [], rows2 = [];
    list.forEach(function (x) {
      if (!x || !x.sid || seen[x.sid]) return;           // กันส่งซ้ำ
      seen[x.sid] = 1;
      const t = new Date(x.ts || Date.now());
      const items = x.items || [];
      const ok = items.filter(function (i) { return i.ok; }).length;
      rows1.push([t, x.sid, x.dev || '', x.grp || '', x.dept || '', x.title || '', x.filter || '', items.length, ok,
                  items.length ? Math.round(ok / items.length * 100) : 0, x.sec || 0,
                  items.filter(function (i) { return !i.ok; }).map(function (i) { return i.id; }).join(', ')]);
      items.forEach(function (i) {
        rows2.push([t, x.sid, x.grp || '', x.dept || '', i.id, i.topic || '', i.crit || '', i.lv || '', i.type || '', String(i.q || '').slice(0, 120), i.ok ? 1 : 0, i.ok ? 0 : 1]);
      });
    });
    if (rows1.length) s1.getRange(s1.getLastRow() + 1, 1, rows1.length, rows1[0].length).setValues(rows1);
    if (rows2.length) s2.getRange(s2.getLastRow() + 1, 1, rows2.length, rows2[0].length).setValues(rows2);
    return out_({ok: true, saved: rows1.length});
  } catch (err) {
    return out_({ok: false, error: String(err)});
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
function doGet() { return out_({ok: true, app: 'greenoffice-quiz'}); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
