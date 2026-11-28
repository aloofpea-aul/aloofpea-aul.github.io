/**
 * Aloof Apps — ระบบบัญชีกลางสำหรับโปรแกรมขาย (แยกจากศูนย์รวมงาน กฟส.อ่าวลึก)
 * ฐานข้อมูล: Google Sheet "Aloof Apps Accounts" (สร้างอัตโนมัติเมื่อรัน setup ครั้งแรก)
 * Deploy: Web app · Execute as: Me · Who has access: Anyone
 * ผู้ดูแล: เข้าด้วยบัญชีศูนย์รวมงานที่เป็นแอดมิน (ไม่ต้องตั้งรหัสใหม่)
 */
const HUB_URL = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
const SESSION_DAYS = 60, ADMIN_HOURS = 12, MAX_FAIL = 5, LOCK_MIN = 15;
const TYPES = ['tester', 'trial', 'paid', 'staff'];
const APPS = { english: { name: 'English Step', langs: ['en', 'zh', 'ja'] } };

function ss_() {
  const p = PropertiesService.getScriptProperties();
  let id = p.getProperty('SHEET_ID');
  if (!id) { id = SpreadsheetApp.create('Aloof Apps Accounts').getId(); p.setProperty('SHEET_ID', id); }
  return SpreadsheetApp.openById(id);
}
function sheet_(name, head) {
  const ss = ss_(); let s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(head); s.setFrozenRows(1); const d = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1'); if (d && ss.getSheets().length > 1) ss.deleteSheet(d); }
  return s;
}
const U_HEAD = ['username', 'name', 'salt', 'hash', 'avatar', 'type', 'apps', 'expires', 'status', 'created', 'lastLogin', 'invite', 'lastApp'];
const users_ = () => sheet_('users', U_HEAD);
const invites_ = () => sheet_('invites', ['code', 'type', 'apps', 'days', 'maxUses', 'used', 'active', 'note', 'created', 'createdBy']);
const sessions_ = () => sheet_('sessions', ['token', 'username', 'expires', 'kind']);
const log_ = () => sheet_('log', ['time', 'username', 'action', 'detail']);

function setup() { users_(); invites_(); sessions_(); log_(); UrlFetchApp.fetch(HUB_URL, { muteHttpExceptions: true }); return ss_().getUrl(); }

function doGet() { return out_({ ok: true, app: 'aloof-apps-accounts' }); }
function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents || '{}'); } catch (x) { return out_({ ok: false, msg: 'ข้อมูลไม่ถูกต้อง' }); }
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); return out_(route_(b)); }
  catch (x) { return out_({ ok: false, msg: 'ระบบไม่ว่าง ลองใหม่อีกครั้ง', err: String(x) }); }
  finally { try { lock.releaseLock(); } catch (x) {} }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function route_(b) {
  switch (b.action) {
    case 'checkInvite': return checkInvite_(b);
    case 'register': return register_(b);
    case 'login': return login_(b);
    case 'me': return me_(b);
    case 'logout': return logout_(b);
    case 'verify': return verify_(b);           // ให้หลังบ้านของแต่ละโปรแกรมเรียกตรวจ token
    case 'adminLogin': return adminLogin_(b);
    case 'adminData': return admin_(b, adminData_);
    case 'createInvite': return admin_(b, createInvite_);
    case 'setInvite': return admin_(b, setInvite_);
    case 'setUser': return admin_(b, setUser_);
    case 'resetPass': return admin_(b, resetPass_);
  }
  return { ok: false, msg: 'ไม่รู้จักคำสั่ง' };
}

/* ---------- ตัวช่วย ---------- */
const clean_ = (s) => String(s || '').trim().toLowerCase();
const safe_ = (s) => String(s || '').replace(/^[=+\-@]/, "'$&").slice(0, 60);
function hash_(salt, pw) {
  let h = salt + ':' + pw;
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt, Utilities.Charset.UTF_8));
  return h;
}
function find_(sh, key) {
  const v = sh.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === key) return { row: i + 1, vals: v[i] };
  return null;
}
function rows_(sh) { const v = sh.getDataRange().getValues(), h = v[0]; return v.slice(1).map((r, i) => { const o = { _row: i + 2 }; h.forEach((k, j) => o[k] = r[j]); return o; }); }
function parseApps_(s) { try { return JSON.parse(s || '{}') || {}; } catch (e) { return {}; } }
function log(u, a, d) { try { log_().appendRow([new Date(), u, a, String(d || '').slice(0, 200)]); } catch (e) {} }
function newSession_(u, kind, hours) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const sh = sessions_();
  sh.appendRow([token, u, new Date(Date.now() + (hours ? hours * 36e5 : SESSION_DAYS * 864e5)), kind || 'user']);
  if (Math.random() < 0.1) { const v = sh.getDataRange().getValues(), now = new Date(); for (let i = v.length - 1; i >= 1; i--) if (new Date(v[i][2]) < now) sh.deleteRow(i + 1); }
  return token;
}
function session_(token, kind) {
  if (!token) return null;
  const f = find_(sessions_(), String(token));
  if (!f || new Date(f.vals[2]) < new Date() || String(f.vals[3] || 'user') !== (kind || 'user')) return null;
  return String(f.vals[1]);
}
function pub_(r) {
  const exp = r.expires ? new Date(r.expires) : null;
  return { username: String(r.username), name: String(r.name), avatar: String(r.avatar || 'rocket'), type: String(r.type), apps: parseApps_(r.apps),
    expires: exp ? exp.toISOString() : '', status: String(r.status), expired: !!(exp && exp < new Date()) };
}
function userRow_(u) { const f = find_(users_(), u); if (!f) return null; const o = { _row: f.row }; U_HEAD.forEach((k, j) => o[k] = f.vals[j]); return o; }

/* ---------- โค้ดเชิญ ---------- */
function invite_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  const f = find_(invites_(), code); if (!f) return null;
  const [c, type, apps, days, maxUses, used, active] = f.vals;
  if (!active || active === 'FALSE') return { bad: 'โค้ดนี้ถูกปิดแล้ว' };
  if (Number(maxUses) > 0 && Number(used) >= Number(maxUses)) return { bad: 'โค้ดนี้ใช้ครบจำนวนแล้ว' };
  return { row: f.row, code: c, type: String(type), apps: parseApps_(apps), days: Number(days) || 0, used: Number(used) || 0 };
}
function checkInvite_(b) {
  const iv = invite_(b.code);
  if (!iv) return { ok: false, msg: 'ไม่พบโค้ดนี้ ตรวจตัวสะกดอีกครั้ง' };
  if (iv.bad) return { ok: false, msg: iv.bad };
  return { ok: true, type: iv.type, apps: iv.apps, days: iv.days };
}

/* ---------- ผู้ใช้ ---------- */
function register_(b) {
  const iv = invite_(b.code);
  if (!iv) return { ok: false, msg: 'โค้ดเชิญไม่ถูกต้อง' };
  if (iv.bad) return { ok: false, msg: iv.bad };
  const u = clean_(b.username), pw = String(b.password || ''), name = String(b.name || '').trim();
  if (!/^[a-z0-9_.@\-]{3,40}$/.test(u)) return { ok: false, msg: 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 _ . - @ ยาว 3–40 ตัว (หรือใช้อีเมล)' };
  if (pw.length < 6) return { ok: false, msg: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว' };
  if (!name || name.length > 40) return { ok: false, msg: 'กรุณาใส่ชื่อที่แสดง (ไม่เกิน 40 ตัว)' };
  const sh = users_();
  if (find_(sh, u)) return { ok: false, msg: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว' };
  const salt = Utilities.getUuid(), exp = iv.days ? new Date(Date.now() + iv.days * 864e5) : '';
  sh.appendRow([u, safe_(name), salt, hash_(salt, pw), String(b.avatar || 'rocket').slice(0, 20), iv.type, JSON.stringify(iv.apps), exp, 'active', new Date(), new Date(), iv.code, '']);
  invites_().getRange(iv.row, 6).setValue(iv.used + 1);
  log(u, 'register', iv.code);
  return { ok: true, token: newSession_(u), user: pub_(userRow_(u)) };
}
function login_(b) {
  const u = clean_(b.username), pw = String(b.password || '');
  const cache = CacheService.getScriptCache(), ck = 'fail_' + u, fails = Number(cache.get(ck) || 0);
  if (fails >= MAX_FAIL) return { ok: false, msg: 'ใส่รหัสผิดหลายครั้ง กรุณารอ ' + LOCK_MIN + ' นาที' };
  const r = userRow_(u);
  if (!r || hash_(String(r.salt), pw) !== String(r.hash)) { cache.put(ck, String(fails + 1), LOCK_MIN * 60); return { ok: false, msg: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }; }
  cache.remove(ck);
  if (String(r.status) !== 'active') return { ok: false, msg: 'บัญชีนี้ถูกปิดชั่วคราว กรุณาติดต่อผู้ดูแล' };
  users_().getRange(r._row, 11).setValue(new Date());
  log(u, 'login', '');
  return { ok: true, token: newSession_(u), user: pub_(r) };
}
function me_(b) {
  const u = session_(b.token); if (!u) return { ok: false, auth: false, msg: 'กรุณาเข้าสู่ระบบใหม่' };
  const r = userRow_(u); if (!r || String(r.status) !== 'active') return { ok: false, auth: false, msg: 'บัญชีนี้ใช้งานไม่ได้' };
  return { ok: true, user: pub_(r) };
}
function logout_(b) { const f = b.token && find_(sessions_(), String(b.token)); if (f) sessions_().deleteRow(f.row); return { ok: true }; }

/** หลังบ้านโปรแกรมอื่นเรียก: {action:'verify', token, app} → สิทธิ์ใช้โปรแกรมนั้น */
function verify_(b) {
  const u = session_(b.token); if (!u) return { ok: false, auth: false, msg: 'กรุณาเข้าสู่ระบบใหม่' };
  const r = userRow_(u); if (!r) return { ok: false, auth: false, msg: 'ไม่พบบัญชี' };
  const p = pub_(r);
  if (p.status !== 'active') return { ok: false, perm: false, msg: 'บัญชีนี้ถูกปิดชั่วคราว กรุณาติดต่อผู้ดูแล' };
  if (p.expired) return { ok: false, perm: false, msg: 'บัญชีหมดอายุแล้ว กรุณาติดต่อผู้ดูแลเพื่อต่ออายุ' };
  const a = p.apps[String(b.app || '')];
  if (!a) return { ok: false, perm: false, msg: 'บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้โปรแกรมนี้' };
  users_().getRange(r._row, 13).setValue(String(b.app) + ' ' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm'));
  return { ok: true, user: p, perm: a };
}

/* ---------- ผู้ดูแล (บัญชีแอดมินของศูนย์รวมงาน) ---------- */
function adminLogin_(b) {
  const name = String(b.name || '').trim(), pass = String(b.pass || '');
  let r = null;
  try { r = JSON.parse(UrlFetchApp.fetch(HUB_URL, { method: 'post', contentType: 'text/plain', muteHttpExceptions: true, payload: JSON.stringify({ action: 'whoAmI', changedBy: name, changedByPassword: pass }) }).getContentText()); }
  catch (e) { return { ok: false, msg: 'ตรวจสอบกับศูนย์รวมงานไม่ได้' }; }
  if (!r || r.role !== 'admin') return { ok: false, msg: 'ต้องเป็นแอดมินของศูนย์รวมงานเท่านั้น' };
  log('admin:' + name, 'adminLogin', '');
  return { ok: true, token: newSession_('admin:' + name, 'admin', ADMIN_HOURS), name: name };
}
function admin_(b, fn) { const a = session_(b.token, 'admin'); if (!a) return { ok: false, auth: false, msg: 'กรุณาเข้าสู่ระบบผู้ดูแลใหม่' }; return fn(b, a); }
function adminData_() {
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  const users = rows_(users_()).map((r) => Object.assign(pub_(r), { created: r.created ? new Date(r.created).toISOString() : '', lastLogin: r.lastLogin ? new Date(r.lastLogin).toISOString() : '', invite: String(r.invite || ''), lastApp: String(r.lastApp || '') }));
  const invites = rows_(invites_()).map((r) => ({ code: String(r.code), type: String(r.type), apps: parseApps_(r.apps), days: Number(r.days) || 0, maxUses: Number(r.maxUses) || 0, used: Number(r.used) || 0, active: !(r.active === false || r.active === 'FALSE'), note: String(r.note || ''), created: r.created ? new Date(r.created).toISOString() : '' }));
  const stat = { tester: 0, trial: 0, paid: 0, staff: 0, activeToday: 0, total: users.length };
  users.forEach((u) => { stat[u.type] = (stat[u.type] || 0) + 1; if (u.lastApp.indexOf(today) >= 0 || (u.lastLogin || '').slice(0, 10) === today) stat.activeToday++; });
  return { ok: true, users: users.reverse(), invites: invites.reverse(), stat: stat, apps: APPS, sheet: ss_().getUrl() };
}
function cleanApps_(apps) {
  const out = {};
  Object.keys(apps || {}).forEach((k) => { if (!APPS[k]) return; const langs = (apps[k].langs || APPS[k].langs).filter((l) => APPS[k].langs.indexOf(l) >= 0); out[k] = { langs: langs.length ? langs : ['en'] }; });
  return out;
}
function createInvite_(b, a) {
  const type = TYPES.indexOf(b.type) >= 0 ? b.type : 'tester';
  const apps = cleanApps_(b.apps || { english: { langs: ['en', 'zh', 'ja'] } });
  if (!Object.keys(apps).length) return { ok: false, msg: 'เลือกโปรแกรมอย่างน้อย 1 โปรแกรม' };
  const pre = { tester: 'TEST', trial: 'TRY', paid: 'VIP', staff: 'TEAM' }[type];
  const ab = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code;
  do { code = pre + '-'; for (let i = 0; i < 4; i++) code += ab[Math.floor(Math.random() * ab.length)]; } while (find_(invites_(), code));
  invites_().appendRow([code, type, JSON.stringify(apps), Math.max(0, Math.min(3650, Number(b.days) || 0)), Math.max(0, Number(b.maxUses) || 1), 0, true, safe_(b.note), new Date(), a]);
  log(a, 'createInvite', code);
  return { ok: true, code: code };
}
function setInvite_(b, a) {
  const f = find_(invites_(), String(b.code || '').toUpperCase()); if (!f) return { ok: false, msg: 'ไม่พบโค้ด' };
  invites_().getRange(f.row, 7).setValue(!!b.active); log(a, 'setInvite', b.code + ' ' + !!b.active); return { ok: true };
}
function setUser_(b, a) {
  const r = userRow_(clean_(b.username)); if (!r) return { ok: false, msg: 'ไม่พบผู้ใช้' };
  const sh = users_(), set = b.set || {};
  if (set.type && TYPES.indexOf(set.type) >= 0) sh.getRange(r._row, 6).setValue(set.type);
  if (set.apps) sh.getRange(r._row, 7).setValue(JSON.stringify(cleanApps_(set.apps)));
  if (set.expires !== undefined) sh.getRange(r._row, 8).setValue(set.expires ? new Date(set.expires) : '');
  if (set.addDays) { const base = r.expires && new Date(r.expires) > new Date() ? new Date(r.expires) : new Date(); sh.getRange(r._row, 8).setValue(new Date(base.getTime() + Number(set.addDays) * 864e5)); }
  if (set.status) sh.getRange(r._row, 9).setValue(set.status === 'active' ? 'active' : 'disabled');
  if (set.name) sh.getRange(r._row, 2).setValue(safe_(set.name));
  log(a, 'setUser', r.username + ' ' + JSON.stringify(set));
  return { ok: true, user: pub_(userRow_(String(r.username))) };
}
function resetPass_(b, a) {
  const r = userRow_(clean_(b.username)); if (!r) return { ok: false, msg: 'ไม่พบผู้ใช้' };
  const pw = String(b.password || ''); if (pw.length < 6) return { ok: false, msg: 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัว' };
  const salt = Utilities.getUuid(); users_().getRange(r._row, 3, 1, 2).setValues([[salt, hash_(salt, pw)]]);
  log(a, 'resetPass', r.username); return { ok: true };
}
