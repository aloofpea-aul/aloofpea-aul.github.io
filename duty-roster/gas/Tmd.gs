/**
 * Tmd.gs — ประกาศเตือนภัยกรมอุตุฯ ผ่านบอทงานเวรแก้ไฟ (ไฟล์ใหม่ ไม่แก้ฟังก์ชันเดิม)
 *  - ส่งเข้ากลุ่มเตือนภัย เมื่อมีประกาศใหม่ที่เกี่ยวกับกระบี่/ภาคใต้ (ใช้ push_ เดิม → นับโควต้าที่เดียวกับแจ้งเวร)
 *  - กันโควต้า: เว้นไว้ให้แจ้งเวร TMD_RESERVE ข้อความ (ค่าเริ่มต้น 80) · ส่งไม่เกิน 2 ครั้ง/วัน · รอบละ 1 การ์ด
 *  - คำสั่งในแชต (ตอบกลับฟรี ไม่นับโควต้า): เตือนภัย / กรมอุตุ
 *  - ตั้งกลุ่ม: ในกลุ่ม LINE แก้ไฟ ให้ หผ.ปร. พิมพ์  ตั้งกลุ่มเตือนภัย รหัส
 *
 * ตั้งค่า Script properties:
 *   TMD_API_URL  = URL Web app ของฐานข้อมูลประกาศ (tmd/gas/Code.gs)
 *   (ไม่บังคับ) TMD_RESERVE = 80 · TMD_DAILY_MAX = 2 · TMD_PUSH_FOCUS = ภาคใต้ (หรือ กระบี่ = ส่งเฉพาะที่ระบุกระบี่)
 * แล้วรัน tmdInstall() ครั้งเดียว
 */

function tmdR_(tok, msgs) { reply_(tok, msgs); return true; }
const TMD_PAGE_ = 'https://aloofpea-aul.github.io/tmd/';
const TMD_SHARE_ = 'https://liff.line.me/2012182540-CRgflPne';
/** ลิงก์เปิด PDF: กรมอุตุฯ เป็นหลัก ล่ม/ช้าเกิน 4 วิ → สำเนาใน Google Drive */
function tmdOpen_(d) {
  return 'https://aloofpea-aul.github.io/tmd/open.html?t=' + encodeURIComponent(d.pdfUrl || '') + (d.pdfDrive ? '&d=' + encodeURIComponent(d.pdfDrive) : '');
}

function tmdInstall() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'tmdPoll'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tmdPoll').timeBased().everyHours(1).create();
  tmdPoll();   // รอบแรกจำฉบับล่าสุดไว้เฉยๆ ไม่ส่งย้อนหลัง
  Logger.log('ติดตั้ง tmdPoll ทุก 1 ชั่วโมงแล้ว · กลุ่ม: ' + (tmdProp_('TMD_GROUP_ID') || 'ยังไม่ได้ตั้ง'));
}

function tmdProp_(k, d) { const v = PropertiesService.getScriptProperties().getProperty(k); return v == null || v === '' ? d : v; }
function tmdFetch_(qs) {
  const u = tmdProp_('TMD_API_URL'); if (!u) return null;
  const res = UrlFetchApp.fetch(u + (u.indexOf('?') < 0 ? '?' : '&') + qs, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) return null;
  try { return JSON.parse(res.getContentText()); } catch (e) { return null; }
}

/** Trigger ทุกชั่วโมง */
function tmdPoll() {
  const props = PropertiesService.getScriptProperties();
  const last = tmdProp_('TMD_LAST_SORT', '');
  const r = tmdFetch_('action=since&after=' + encodeURIComponent(last));
  if (!r || !r.ok) return;
  if (!last) { if (r.latest) props.setProperty('TMD_LAST_SORT', r.latest.sortKey); return; }   // รอบแรก ไม่ส่งย้อนหลัง
  if (!r.data.length) return;
  props.setProperty('TMD_LAST_SORT', r.data[0].sortKey);   // จำฉบับล่าสุดเสมอ

  const wantKrabiOnly = tmdProp_('TMD_PUSH_FOCUS', 'ภาคใต้') === 'กระบี่';
  const hit = r.data.filter(function (d) { return d.focus === 'กระบี่' || (!wantKrabiOnly && d.focus === 'ภาคใต้'); })[0];
  if (!hit) return;

  const gid = tmdProp_('TMD_GROUP_ID'); if (!gid) { log_('system', 'เตือนภัย: ยังไม่ได้ตั้งกลุ่ม', '', hit.title); return; }

  // จำกัดต่อวัน
  const dayKey = 'TMD_SENT_' + bkkYmd_(), sentToday = Number(tmdProp_(dayKey, 0));
  if (sentToday >= Number(tmdProp_('TMD_DAILY_MAX', 2))) { log_('system', 'เตือนภัย: ครบจำนวนต่อวัน', '', hit.title); return; }

  // กันโควต้าไว้ให้แจ้งเวร
  const cost = groupCount_(gid), limit = Number(getConfig_().lineMonthlyLimit || 300);
  const reserve = Number(tmdProp_('TMD_RESERVE', 80));
  if (pushCount_() + cost > limit - reserve) { log_('system', 'เตือนภัย: ข้ามเพื่อเก็บโควต้าแจ้งเวร', '', pushCount_() + '/' + limit + ' ต้องใช้ ' + cost); return; }

  if (push_(gid, [tmdCard_(hit)], 'tmd', cost)) {
    props.setProperty(dayKey, String(sentToday + 1));
    log_('system', 'ส่งประกาศเตือนภัยเข้ากลุ่ม', '', hit.issueNo + ' ' + hit.title);
  }
}

/** การ์ดประกาศ */
function tmdCard_(d) {
  const color = d.severity === 'สูง' ? '#8A2B2B' : d.severity === 'กลาง' ? '#B4570B' : '#455A64';
  const where = d.focus === 'กระบี่' ? 'กระบี่ อยู่ในพื้นที่ได้รับผลกระทบ'
              : d.focus === 'ภาคใต้' ? 'ภาคใต้ได้รับผลกระทบ (ไม่ระบุกระบี่)' : '';
  const desc = String(d.description || '');
  const lines = [where || d.title]
    .concat(d.krabiDetail ? String(d.krabiDetail).split('\n') : [])
    .concat([[d.issueNo, d.announceTime].filter(String).join(' · '), desc.length > 250 ? desc.slice(0, 250) + '…' : desc])
    .filter(String);
  const btn = [];
  if (d.pdfUrl) btn.push({ type: 'button', style: 'primary', color: color, height: 'sm', action: { type: 'uri', label: 'เปิดประกาศ', uri: tmdOpen_(d) } });
  btn.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'ค้นหาทั้งหมด', uri: TMD_PAGE_ } });
  const b = bubble_('ประกาศกรมอุตุนิยมวิทยา', color, d.title, lines, btn);
  // ปุ่มแชร์ (LIFF shareTargetPicker) — ส่งต่อการ์ดเข้ากลุ่มในนามผู้กด ไม่ใช้โควต้าบอท
  b.footer = { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
    { type: 'box', layout: 'horizontal', spacing: 'sm', contents: btn },
    { type: 'button', style: 'primary', color: '#06C755', height: 'sm',
      action: { type: 'uri', label: 'แชร์เข้ากลุ่ม LINE', uri: TMD_SHARE_ + '?k=' + encodeURIComponent(d.key || '') } }] };
  return flex_('เตือนภัย: ' + d.title, b);
}

/** คำสั่งแชต — คืนค่า reply ถ้าเป็นคำสั่งเตือนภัย, ไม่ใช่คืน null (เรียกจาก handleEvent_) */
function tmdHandle_(ev, t, me, uid) {
  let m = t.match(/^ตั้งกลุ่มเตือนภัย\s+(\S+)$/);
  if (m && ev.source.type === 'group') {
    if (String(m[1]) !== String(getConfig_().lineRegCode)) return tmdR_(ev.replyToken, [text_('รหัสไม่ถูกต้อง')]);
    PropertiesService.getScriptProperties().setProperty('TMD_GROUP_ID', ev.source.groupId);
    log_(me ? me.short : uid, 'ตั้งกลุ่มเตือนภัย LINE', '', ev.source.groupId);
    return tmdR_(ev.replyToken, [text_('ตั้งกลุ่มนี้รับประกาศเตือนภัยกรมอุตุฯ แล้ว ✓\nระบบส่งเมื่อมีประกาศใหม่ที่เกี่ยวกับกระบี่/ภาคใต้\nพิมพ์ "เตือนภัย" ดูฉบับล่าสุดได้ตลอด (ไม่เสียโควต้า)')]);
  }
  if (/^(เตือนภัย|กรมอุตุ|ประกาศกรมอุตุ)$/.test(t)) {
    const r = tmdFetch_('action=latest&focus=ภาคใต้');
    if (!r || !r.ok) return tmdR_(ev.replyToken, [text_('ยังดึงข้อมูลประกาศไม่ได้ ลองใหม่อีกครั้ง\n' + TMD_PAGE_)]);
    if (!r.data.length) return tmdR_(ev.replyToken, [text_('ยังไม่มีประกาศเตือนภัยที่เกี่ยวกับภาคใต้\nดูทั้งหมด: ' + TMD_PAGE_)]);
    return tmdR_(ev.replyToken, [tmdCard_(r.data[0])]);
  }
  return null;
}
