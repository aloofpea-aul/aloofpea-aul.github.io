/* โหมดทดลอง "งานเวรแก้ไฟ" — ทำงานในเบราว์เซอร์ของผู้ทดลองทั้งหมด
 * - ใช้โค้ดหลังบ้านจริง (gas/Code.gs, Requests.gs, Line.gs) รันในเครื่อง กับ "ชีตจำลอง" ที่เก็บใน localStorage
 * - ไม่เรียกระบบจริงเลย: ไม่แตะชีต/ตารางเวรจริง · LINE ไม่ส่งจริง (เก็บไว้ในกล่อง "LINE จำลอง") · ไม่ต้องล็อกอินศูนย์รวมงาน
 * - ชื่อพนักงานเป็นชื่อสมมติทั้งหมด
 * ข้อมูลภายนอกที่อ่านจริง (อ่านอย่างเดียว): พยากรณ์อากาศ Open-Meteo และประกาศเตือนภัยกรมอุตุฯ (ข้อมูลสาธารณะ) */
(function () {
  'use strict';
  const NS = 'drdemo_', BOOK_K = NS + 'book', PROPS_K = NS + 'props', LINE_K = NS + 'line', WHO_K = NS + 'who', VER = 3;
  const PIN_A = '1234', PIN_B = '5678';
  const RealFetch = window.fetch.bind(window);
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('demo save', e); } };

  /* ---------------- ชื่อสมมติ (แทนชื่อจริงที่ฝังอยู่ในโค้ดตั้งต้น) ---------------- */
  const FIRST = { 'นทีธร': 'ก้องภพ', 'ธวัชชัย': 'ชยพล', 'กลวัชร': 'ธนากร', 'พุทธภงค์': 'ณัฐวุฒิ', 'กัมปนาทท์': 'ปิยะพงษ์', 'พงศธร': 'วีรยุทธ',
    'อติวิทย์': 'ศุภชัย', 'สุรเชษฐ์': 'อนุชา', 'ราชภัฎ': 'เกียรติศักดิ์', 'พยงค์': 'สมหมาย', 'ย่าร้อหมาด': 'ประสิทธิ์', 'บุญล่อง': 'สมพร',
    'มานศักดิ์': 'วิชัย', 'นงคราญ': 'มาลัย', 'พัชรียา': 'สุนิสา', 'ชญานิน': 'ประพันธ์' };
  const SUR = { 'เชียรแก้ว': 'ใจดี', 'ไหมสุข': 'มั่นคง', 'บุญช่วย': 'ศรีสุข', 'เมืองด้วง': 'รักไทย', 'เกลาจีน': 'แสงทอง', 'เกตุมณี': 'พูลผล',
    'ทองลา': 'ดีงาม', 'นาคะเกษม': 'สุขสม', 'จันทร์ชู': 'บุญมา', 'บุญแก้ว': 'ทองดี', 'หมันการ': 'ชูใจ', 'ดำเชื้อ': 'มีสุข', 'คงชนะ': 'แก้วใส',
    'พิลาฤทธิ์': 'สมบูรณ์', 'งานสัมพันธฤทธิ์': 'วงศ์ดี', 'ยศศิริ': 'ศรีงาม', 'เรียงสันเทียะ': 'ทองคำ' };
  const WORDY = { 'อาทิตย์': 'บุญมี' };                // ชื่อที่เป็นคำทั่วไปด้วย — แทนเฉพาะที่เป็นชื่อคน
  function rename(s) {
    if (typeof s !== 'string' || !s) return s;
    for (const k in WORDY) { if (s === k) return WORDY[k]; s = s.split('"' + k + '"').join('"' + WORDY[k] + '"').split('นาย' + k).join('นาย' + WORDY[k]); }
    for (const k in FIRST) s = s.split(k).join(FIRST[k]);
    for (const k in SUR) s = s.split(k).join(SUR[k]);
    return s;
  }

  /* ---------------- SHA-256 / HMAC (ซิงก์ ใช้กับ Utilities) ---------------- */
  const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const l = bytes.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const bl = l * 8; for (let i = 0; i < 4; i++) m[n - 1 - i] = (bl >>> (8 * i)) & 255; m[n - 5] = Math.floor(bl / 4294967296) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    const r = (x, k) => (x >>> k) | (x << (32 - k));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) { const a = W[i - 15], b = W[i - 2]; W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) | 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32); for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = (H[i] >>> (24 - 8 * j)) & 255; return out;
  }
  const utf8 = s => new TextEncoder().encode(String(s));
  function hmac(msg, key) {
    let k = utf8(key); if (k.length > 64) k = sha256(k); const kb = new Uint8Array(64); kb.set(k);
    const ip = kb.map(x => x ^ 0x36), op = kb.map(x => x ^ 0x5c), m = utf8(msg);
    const a = new Uint8Array(64 + m.length); a.set(ip); a.set(m, 64);
    const b = new Uint8Array(96); b.set(op); b.set(sha256(a), 64); return sha256(b);
  }
  const toSigned = u => Array.from(u, x => x > 127 ? x - 256 : x);
  const b64ws = x => { const by = typeof x === 'string' ? utf8(x) : Uint8Array.from(x, v => v & 255); let s = ''; by.forEach(c => s += String.fromCharCode(c)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_'); };

  /* ---------------- ชีตจำลอง (เลียนแบบการแปลงค่าอัตโนมัติของ Google Sheets) ---------------- */
  function conv(x) {
    if (typeof x === 'string') {
      if (x.startsWith("'")) return x.slice(1);
      const m = x.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/); if (m) return new Date(Date.parse(m[1] + '-' + m[2] + '-' + (m[3] || '01') + 'T00:00:00+07:00'));
      if (/^\d+$/.test(x) && x.length < 15) return Number(x);
    }
    return x;
  }
  function mkSheet(name, rows) {
    const s = { name, rows: rows || [], fmt: {},
      getName() { return name; },
      getLastRow() { let n = this.rows.length; while (n > 0 && this.rows[n - 1].every(v => v === '' || v == null)) n--; return n; },
      getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); },
      ensure(r, c) { while (this.rows.length < r) this.rows.push([]); for (const row of this.rows) while (row.length < c) row.push(''); },
      getRange(r, c, nr, nc) {
        const sh = this;
        if (typeof r === 'string') { const col = r.charCodeAt(0) - 64; return { setNumberFormat(f) { if (f === '@') sh.fmt[col] = '@'; return this; } }; }
        nr = nr || 1; nc = nc || 1;
        const put = (i, j, x) => { sh.rows[r - 1 + i][c - 1 + j] = sh.fmt[c + j] === '@' && x != null && !(x instanceof Date) ? String(x).replace(/^'/, '') : conv(x); };
        return {
          setValues(v) { sh.ensure(r + nr - 1, c + nc - 1); v.forEach((row, i) => row.forEach((x, j) => put(i, j, x))); return this; },
          getValues() { sh.ensure(r + nr - 1, c + nc - 1); return sh.rows.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)); },
          getValue() { sh.ensure(r, c); return sh.rows[r - 1][c - 1]; },
          setValue(x) { sh.ensure(r, c); put(0, 0, x); return this; },
          clearContent() { sh.ensure(r + nr - 1, c + nc - 1); for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.rows[r - 1 + i][c - 1 + j] = ''; return this; },
          setFontWeight() { return this; }, setNumberFormat(f) { if (f === '@') for (let j = 0; j < nc; j++) sh.fmt[c + j] = '@'; return this; },
          setBackground() { return this; }, setWrap() { return this; }
        };
      },
      getDataRange() { const n = this.getLastRow(), c = this.getLastColumn(); return this.getRange(1, 1, Math.max(n, 1), Math.max(c, 1)); },
      appendRow(row) { const n = this.getLastRow(); this.rows.splice(n, 0, row.map(conv)); this.ensure(n + 1, row.length); return this; },
      deleteRow(i) { this.rows.splice(i - 1, 1); },
      deleteRows(i, k) { this.rows.splice(i - 1, k || 1); },
      insertRowAfter() {}, setFrozenRows() {}, setColumnWidth() {}, autoResizeColumns() {}, clear() { this.rows = []; return this; },
      getMaxRows() { return Math.max(this.rows.length, 1000); }, getMaxColumns() { return Math.max(this.getLastColumn(), 26); }
    };
    return s;
  }
  function mkBook(src) {
    const b = { sheets: {}, getSheetByName(n) { return this.sheets[n] || null; }, insertSheet(n) { return this.sheets[n] = mkSheet(n); }, getSheets() { return Object.values(this.sheets); }, getId() { return 'demo'; } };
    if (src) for (const n in src) { const sh = b.sheets[n] = mkSheet(n, src[n].rows.map(r => r.map(rev))); sh.fmt = src[n].fmt || {}; }
    return b;
  }
  const enc = v => v instanceof Date ? { $d: v.getTime() } : v;
  const rev = v => v && typeof v === 'object' && '$d' in v ? new Date(v.$d) : v;
  const dumpBook = b => { const o = {}; for (const n in b.sheets) o[n] = { rows: b.sheets[n].rows.map(r => r.map(enc)), fmt: b.sheets[n].fmt }; return o; };

  /* ---------------- บริการ Apps Script จำลอง ---------------- */
  let book, sld, props, line = lsGet(LINE_K) || [];
  const cache = {}, triggers = [], pre = { wx: null, tmd: null };
  function fmtDate(d, tz, f) {
    const t = new Date(d.getTime() + 7 * 3600e3), p = n => String(n).padStart(2, '0');
    const Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1, D = t.getUTCDate(), h = t.getUTCHours(), m = t.getUTCMinutes(), s = t.getUTCSeconds();
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getUTCDay()];
    return f.replace('yyyy', Y).replace('yy', String(Y).slice(2)).replace('MM', p(M)).replace(/\bM\b/, M).replace('dd', p(D)).replace(/\bd\b/, D)
      .replace('HH', p(h)).replace('mm', p(m)).replace('ss', p(s)).replace(/\bEEE\b/, wd).replace(/\bu\b/, t.getUTCDay() || 7);
  }
  const resp = (code, text) => ({ getResponseCode: () => code, getContentText: () => text });
  function fetchSync(u, o) {
    const body = o && o.payload ? (() => { try { return JSON.parse(o.payload); } catch (e) { return null; } })() : null;
    if (/api\.line\.me/.test(u)) {
      if (/\/push$/.test(u) && body) { line.unshift({ at: Date.now(), to: body.to, msgs: body.messages }); line.length = Math.min(line.length, 60); lsSet(LINE_K, line); setTimeout(paintLineBtn, 0); return resp(200, '{}'); }
      if (/\/reply$/.test(u)) return resp(200, '{}');
      if (/members\/count/.test(u)) return resp(200, '{"count":12}');
      return resp(200, '{}');
    }
    if (/open-meteo/.test(u)) return resp(200, pre.wx || JSON.stringify({ current: { temperature_2m: 28, relative_humidity_2m: 80, weather_code: 2, wind_gusts_10m: 18, precipitation: 0 }, hourly: { time: [], precipitation_probability: [20, 20, 30, 30, 20, 10, 10, 10], weather_code: [2, 2, 3, 3, 2, 2, 1, 1], wind_gusts_10m: [18, 18, 20, 20, 18, 15, 12, 12], precipitation: [0, 0, 0, 0, 0, 0, 0, 0] } }));
    if (body && body.action === 'whoAmI') return resp(200, JSON.stringify(body.changedByPassword === 'demo' ? { ok: true, role: 'member', apps: ['dutyroster'] } : { ok: true, role: null }));
    if (/action=list/.test(u)) return resp(200, pre.tmd || '{"ok":true,"data":[]}');
    return resp(200, '{"ok":true}');
  }
  const SVC = {
    SpreadsheetApp: { getActiveSpreadsheet: () => book, openById: () => sld, flush() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props), setProperties: o => { Object.assign(props, o); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    ContentService: { MimeType: { JSON: 'json', TEXT: 'text' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) },
    Utilities: { formatDate: fmtDate, DigestAlgorithm: { SHA_256: 1 }, computeDigest: (a, s) => toSigned(sha256(utf8(s))), computeHmacSha256Signature: (v, k) => toSigned(hmac(v, k)),
      base64EncodeWebSafe: b64ws, base64Encode: x => b64ws(x).replace(/-/g, '+').replace(/_/g, '/'), getUuid: () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()), sleep() {} },
    Logger: { log: x => console.log('[demo]', x) },
    UrlFetchApp: { fetch: fetchSync },
    ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: h => { const t = { h, getHandlerFunction: () => h }; const b = { timeBased() { return b; }, at(d) { return b; }, atHour() { return b; }, nearMinute() { return b; }, everyMinutes() { return b; }, everyHours() { return b; }, everyDays() { return b; }, inTimezone() { return b; }, create() { triggers.push(t); return t; } }; return b; } }
  };

  /* ---------------- โหลดโค้ดหลังบ้าน ---------------- */
  let G = null;
  async function loadGas() {
    const v = '?v=' + Date.now().toString(36).slice(0, -3);
    const src = (await Promise.all(['Code.gs', 'Requests.gs', 'Line.gs'].map(f => RealFetch('gas/' + f + v).then(r => { if (!r.ok) throw new Error(f); return r.text(); })))).join('\n;\n');
    const names = Object.keys(SVC);
    G = new Function(...names, src + '\n;return { doGet: doGet, doPost: doPost, setup: setup, ev: function (s) { return eval(s); }, TMD: typeof TMD_API_DEFAULT !== "undefined" ? TMD_API_DEFAULT : "" };')(...names.map(n => SVC[n]));
  }
  const call = (kind, x) => { const out = kind === 'post' ? G.doPost({ postData: { contents: JSON.stringify(x) } }) : G.doGet({ parameter: x }); save(); return JSON.parse(out.t); };
  function save() { lsSet(BOOK_K, { v: VER, book: dumpBook(book), sld: dumpBook(sld) }); lsSet(PROPS_K, props); }

  /* ---------------- ข้อมูลตั้งต้น ---------------- */
  const ymdNow = (off) => fmtDate(new Date(Date.now() + (off || 0) * 864e5), '', 'yyyy-MM-dd');
  const mKey = (y, m) => y + '-' + String(m).padStart(2, '0');
  function seed() {
    book = mkBook(); sld = mkBook(); props = {};
    // ชีต Patrol ของระบบ SLD (จำลอง)
    const f = sld.insertSheet('PatrolFinding'); f.rows.push(['FindingID', 'CreatedAt', 'CreatedBy', 'CreatorRole', 'CreatorOrg', 'AnchorType', 'AnchorRef', 'Lat', 'Lon', 'GpsAccuracy', 'FeederID', 'ProblemType', 'Severity', 'Detail', 'Source', 'Status', 'JobID', 'ClosedAt', 'ClosedBy', 'CloseReason', 'NearPlace', 'Address', 'Moo', 'Landmark', 'OrderNo', 'OrderDate', 'FixedDate', 'FixedBy', 'FixedDetail']);
    const t = sld.insertSheet('PatrolType'); t.rows.push(['Code', 'Name', 'Category', 'DefaultSeverity', 'Active'], ['TREE', 'ต้นไม้ใกล้สาย', 'หน้างาน', 2, 'TRUE'], ['EQUIP', 'อุปกรณ์ชำรุด', 'หน้างาน', 2, 'TRUE']);
    G.setup();
    props.LINE_TOKEN = 'demo';
    call('get', { action: 'bootstrap' });          // ให้ระบบปรับข้อมูลตั้งต้นครบก่อน แล้วค่อยเปลี่ยนชื่อ
    // เปลี่ยนชื่อจริง → ชื่อสมมติ ทุกเซลล์
    for (const b of [book, sld]) for (const n in b.sheets) b.sheets[n].rows = b.sheets[n].rows.map(r => r.map(rename));
    for (const k of Object.keys(props)) props[k] = rename(props[k]);
    for (const k of Object.keys(cache)) delete cache[k];
    const lg = book.getSheetByName('Log'); if (lg) lg.rows = lg.rows.slice(0, 1);
    // PIN ทดลอง · LINE จำลอง · รหัสพนักงานสมมติ · เบอร์สมมติ
    const ap = book.getSheetByName('Approvers'); ap.rows.forEach((r, i) => { if (i) r[3] = i === 1 ? PIN_A : PIN_B; });
    const pp = book.getSheetByName('People'), h = pp.rows[0], col = k => h.indexOf(k);
    pp.rows.forEach((r, i) => { if (!i) return; r[col('lineUserId')] = 'Udemo-' + r[col('short')]; if (col('empId') >= 0 && r[col('empId')]) r[col('empId')] = String(500100 + i * 37); if (col('phone') >= 0) r[col('phone')] = '0' + String(810000000 + i * 1111111).slice(0, 9); });
    const cf = book.getSheetByName('Config'); const setC = (k, v) => { const r = cf.rows.find(x => x[0] === k); if (r) r[1] = v; else cf.rows.push([k, v]); };
    setC('webUrl', location.origin + location.pathname); setC('lineMonthlyLimit', 100000); setC('lineRegCode', '0000');
    // เดือนถัด ๆ ไปจนถึงเดือนหน้า: ที่ผ่านมาแล้ว/เดือนนี้ = อนุมัติแล้ว · เดือนหน้า = ร่าง (ให้ลองอนุมัติ)
    const now = new Date(Date.now() + 7 * 3600e3); let y = 2026, m = 10;
    const endY = now.getUTCFullYear(), endM = now.getUTCMonth() + 2;
    while (y * 12 + m < endY * 12 + endM) {
      m++; if (m > 12) { m = 1; y++; }
      const k = mKey(y, m), r = call('post', { action: 'generate', m: k, pair: 'continue', pin: PIN_A });
      if (r.ok && y * 12 + m <= endY * 12 + endM - 1) call('post', { action: 'setStatus', m: k, status: 'อนุมัติแล้ว', pin: PIN_A });
    }
    seedActivity();
    save();
  }
  /* ตัวอย่างกิจกรรมให้ดูเหมือนใช้งานจริง (คำขอรออนุมัติ ไฟดับเมื่อวาน งานรับแจ้งไฟดับ) — ผิดพลาดก็ข้าม */
  function seedActivity() {
    try {
      const today = ymdNow(0), mo = call('get', { action: 'month', m: today.slice(0, 7) }).month, d0 = +today.slice(8, 10);
      const emp = mo.data.emp, names = Object.keys(emp);
      // คำขอลาเวร (รออนุมัติ) ของคนที่มีเวรในอีก 2–5 วัน
      for (let dd = d0 + 2; dd <= Math.min(d0 + 5, mo.data.days.length); dd++) {
        const a = names.find(n => /3/.test(emp[n][dd - 1])), r = names.find(n => !emp[n][dd - 1] && !/1/.test(emp[n][dd] || ''));
        if (a && r) { call('post', { action: 'request', month: today.slice(0, 7), type: 'leave', payload: { g: 'emp', a, d: dd, r, why: { k: 'private' } }, requester: a, reason: 'ธุระส่วนตัว' }); break; }
      }
      // ไฟดับเมื่อวาน (ช่วง 3) + รายงานเวร
      const yd = ymdNow(-1), k = yd + '|p3';
      call('post', { action: 'saveOutage', k, pin: PIN_A, o: { lvl: 'lv', off: yd + 'T19:40', on: yd + 'T20:55', ws: yd + 'T19:55', we: yd + 'T20:55', feeder: 'ALA03', place: 'บ้านคลองหิน หมู่ 4', cType: 'ต้นไม้', cData: 'กิ่งไม้พาดสาย', cBtn: 'tree', known: 'ทราบสาเหตุ', weather: 'ฝนตก', fix: 'perm', cust: 18, mats: [], detail: 'ตัดกิ่งไม้ เปลี่ยนฟิวส์ 1 ชุด' } });
      // งานรับแจ้งไฟดับจากผู้ใช้ไฟ (ยังไม่มีคนรับ)
      call('post', { action: 'ticket', type: 'home', phone: '0899990001', name: 'ผู้ใช้ไฟ (ตัวอย่าง)', place: 'หน้าโรงเรียนบ้านแหลมสัก', detail: 'ไฟดับทั้งซอย ได้ยินเสียงดังที่หม้อแปลง', src: 'web' });
    } catch (e) { console.warn('demo seed', e); }
  }

  /* ---------------- เปิดใช้ ---------------- */
  async function prefetch() {
    const tmo = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
    const wxU = 'https://api.open-meteo.com/v1/forecast?latitude=8.3756&longitude=98.7271&current=temperature_2m,relative_humidity_2m,weather_code,wind_gusts_10m,precipitation&hourly=precipitation_probability,weather_code,wind_gusts_10m,precipitation&forecast_hours=8&timezone=Asia%2FBangkok';
    const [wx, tmd] = await Promise.all([
      tmo(RealFetch(wxU).then(r => r.ok ? r.text() : null).catch(() => null), 4000),
      G.TMD ? tmo(RealFetch(G.TMD + '?action=list&limit=80&focus=' + encodeURIComponent('ภาคใต้')).then(r => r.text()).catch(() => null), 6000) : null]);
    pre.wx = wx; pre.tmd = tmd && /^\s*\{/.test(tmd) ? tmd : null;
  }
  const ready = (async () => {
    await loadGas();
    const prf = prefetch();
    const st = lsGet(BOOK_K);
    if (st && st.v === VER) { book = mkBook(st.book); sld = mkBook(st.sld); props = lsGet(PROPS_K) || {}; }
    else { await prf; seed(); }
    await prf;
  })();
  ready.catch(e => { console.error(e); document.addEventListener('DOMContentLoaded', () => { document.body.insertAdjacentHTML('afterbegin', '<div style="padding:16px;background:#fdd;color:#900">เปิดโหมดทดลองไม่สำเร็จ: ' + String(e.message || e) + '</div>'); }); });

  const lag = () => new Promise(r => setTimeout(r, 120 + Math.random() * 180));   // หน่วงนิดหน่อยให้รู้สึกเหมือนจริง
  window.__MOCK__ = {
    async get(params) { await ready; await lag(); const j = call('get', params); if (!j.ok) throw new Error(j.error); return j; },
    async post(body) { await ready; await lag(); const j = call('post', body); if (!j.ok) throw new Error(j.error); return j; }
  };

  /* ระบบ SLD จำลอง: รายชื่ออุปกรณ์ตัวอย่าง + อัปโหลดรูป (ไม่ส่งรูปออกจากเครื่อง) */
  const SLD_RE = /AKfycbzqsOq/;
  function sldDemo() {
    const F = [['ALA01', '#e30613'], ['ALA02', '#a020f0'], ['ALA03', '#0033cc'], ['ALA05', '#00b0f0'], ['ALA06', '#ff8c00'], ['ALA07', '#4caf00'], ['ALA09', '#000000']];
    const PL = ['บ้านคลองหิน', 'บ้านแหลมสัก', 'บ้านนา', 'บ้านบากัน', 'บ้านทุ่ง', 'ตลาดอ่าวลึก', 'บ้านคลองยา', 'บ้านเขาใหญ่', 'บ้านถ้ำเพชร'];
    return { ok: true, feeders: F.map(([id, color], fi) => ({ id, color, devices: [].concat(
      [1, 2, 3].map(i => ({ id: 'WR-' + id.slice(3) + i, type: 'WR', rating: '', desc: PL[(fi + i) % PL.length], lat: 8.34 + fi * 0.012 + i * 0.004, lon: 98.70 + i * 0.01, parentId: '', customerImpact: 120 + i * 40 })),
      [1, 2, 3, 4, 5, 6].map(i => ({ id: 'F-' + id.slice(3) + String(i).padStart(2, '0'), type: 'WF', rating: '', desc: PL[(fi * 2 + i) % PL.length] + ' หมู่ ' + i, lat: 8.345 + fi * 0.012 + i * 0.003, lon: 98.705 + i * 0.008, parentId: 'WR-' + id.slice(3) + (1 + i % 3), customerImpact: 0 })),
      [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ id: 'T' + id.slice(3) + '-' + String(i * 7).padStart(3, '0'), type: 'TRANSFORMER', rating: [50, 100, 160][i % 3] + ' kVA', desc: PL[(fi + i * 3) % PL.length], lat: 8.35 + fi * 0.012 + i * 0.002, lon: 98.71 + i * 0.006, parentId: 'F-' + id.slice(3) + String(1 + i % 6).padStart(2, '0'), meterCount: 15 + i * 6 }))) })) };
  }
  window.fetch = function (u, o) {
    const url = String(u && u.url || u);
    if (SLD_RE.test(url)) {
      let b = null; try { b = o && o.body ? JSON.parse(o.body) : null; } catch (e) {}
      const j = b && b.action === 'patrolAddPhoto' ? { ok: true, photos: (b.photos || []).map((p, i) => ({ fileId: 'demo-' + Date.now() + i, url: '', kind: p.kind })), photoFailed: [] } : !b ? sldDemo() : { ok: true };
      return new Promise(r => setTimeout(() => r(new Response(JSON.stringify(j), { headers: { 'Content-Type': 'application/json' } })), 200));
    }
    return RealFetch(u, o);
  };

  /* ---------------- ผู้ใช้ทดลอง: สลับบทบาท ---------------- */
  function who() { return lsGet(WHO_K) || { kind: 'appr', name: '' }; }
  window.DEMO = {
    creds() { const w = who(); return w.name ? { user: w.name, pass: 'demo' } : { user: '', pass: '' }; },
    who, reset() { Object.keys(localStorage).filter(k => k.indexOf(NS) === 0).forEach(k => localStorage.removeItem(k)); location.reload(); },
    pins: [PIN_A, PIN_B]
  };
  async function people() {
    await ready;
    const b = call('get', { action: 'bootstrap' }), today = ymdNow(0), mo = call('get', { action: 'month', m: today.slice(0, 7) }).month;
    const t = new Date(Date.now() + 7 * 3600e3), hm = t.toISOString().slice(11, 16), d = +today.slice(8, 10);
    const yd = ymdNow(-1), moY = yd.slice(0, 7) === today.slice(0, 7) ? mo : (call('get', { action: 'month', m: yd.slice(0, 7) }).month || mo);
    const code = (n, dd, M) => String(((M || mo).data.emp[n] || [])[dd - 1] || '');
    const onNow = n => hm < '00:30' ? /3/.test(code(n, +yd.slice(8, 10), moY)) : hm < '08:30' ? /1/.test(code(n, d)) : /[23]/.test(code(n, d)) && (hm >= '16:30' || /2/.test(code(n, d)) || mo.data.days[d - 1].off);
    const ins = (mo.data.insp || [])[d - 1] || '';
    const P = b.people, full = s => { const x = [].concat(P.emp || [], P.wk || [], b.inspectors || []).find(p => p.short === s); return x ? x.full : s; };
    return { appr: (b.approvers || []).map(a => ({ name: a.name, label: a.name.replace(/^นาย|^นางสาว|^นาง/, '') + ' · ' + (a.role || 'ผู้อนุมัติ') })),
      emp: (P.emp || []).map(p => ({ name: p.full, label: p.short + (onNow(p.short) ? ' · อยู่เวรตอนนี้' : code(p.short, d) ? ' · มีเวรวันนี้' : '') })),
      wk: (P.wk || []).map(p => ({ name: p.full, label: p.short + ' (คนงาน)' })),
      insp: ins ? [{ name: full(ins), label: ins + ' · ผู้ตรวจเวรวันนี้' }] : [] };
  }

  /* ---------------- แถบโหมดทดลอง + กล่อง LINE จำลอง ---------------- */
  const CSS = `#demoBar{position:relative;z-index:60;background:#FFF4E0;border-bottom:1px solid #F0D49B;color:#6B4A00;font:13.5px/1.35 Sarabun,'Noto Sans Thai',sans-serif;padding:6px 10px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
#demoBar b{color:#7A3E00}#demoBar select{font:inherit;border:1px solid #E2C27F;border-radius:8px;padding:3px 6px;background:#fff;max-width:230px}
#demoBar button{font:inherit;border:1px solid #E2C27F;background:#fff;border-radius:8px;padding:3px 9px;color:#7A3E00;cursor:pointer}
#demoBar .pin{background:#fff;border-radius:6px;padding:1px 6px;border:1px dashed #E2C27F}
#demoLine{position:fixed;right:12px;bottom:84px;z-index:70;background:#06C755;color:#fff;border:0;border-radius:999px;padding:9px 14px;font:700 14px Sarabun,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer}
#demoLine i{font-style:normal;background:#fff;color:#06C755;border-radius:999px;padding:0 7px;margin-left:6px}
#demoBox{position:fixed;inset:0;z-index:80;background:rgba(20,10,30,.45);display:flex;align-items:flex-end;justify-content:center}
#demoBox .sh{background:#F5F6F8;width:100%;max-width:520px;max-height:82vh;overflow:auto;border-radius:18px 18px 0 0;padding:14px 14px 24px;font:14px/1.45 Sarabun,sans-serif}
#demoBox .m{background:#fff;border-radius:12px;padding:9px 11px;margin:8px 0;box-shadow:0 1px 2px rgba(0,0,0,.06);white-space:pre-wrap}
#demoBox .to{font-size:12.5px;color:#666;margin-bottom:3px}#demoBox .alt{font-weight:700;color:#1b5e20}`;
  function flexText(o, out) { if (!o || typeof o !== 'object') return out; if (Array.isArray(o)) { o.forEach(x => flexText(x, out)); return out; } if (o.type === 'text' && o.text) out.push(o.text); if (o.type === 'button' && o.action && o.action.label) out.push('[ ' + o.action.label + ' ]'); for (const k in o) if (k !== 'action' && typeof o[k] === 'object') flexText(o[k], out); return out; }
  function lineName(id) { const s = String(id || '').replace(/^Udemo-/, ''); return s || id; }
  function paintLineBtn() { const b = document.getElementById('demoLine'); if (!b) return; const seen = +(lsGet(NS + 'lineSeen') || 0), n = line.filter(x => x.at > seen).length; b.innerHTML = '📨 LINE จำลอง' + (n ? '<i>' + n + '</i>' : ''); }
  function openLine() {
    lsSet(NS + 'lineSeen', Date.now()); paintLineBtn();
    const tm = t => fmtDate(new Date(t), '', 'd/M HH:mm');
    const box = document.createElement('div'); box.id = 'demoBox';
    box.innerHTML = `<div class="sh"><div style="display:flex;align-items:center;gap:8px"><b style="font-size:17px">📨 ข้อความ LINE ที่ระบบจะส่ง</b><button id="dlX" style="margin-left:auto;border:0;background:none;font:700 15px Sarabun;color:#5C1A63">ปิด</button></div>
      <div style="color:#666;font-size:13px">โหมดทดลองไม่ส่ง LINE จริง — แสดงเนื้อความที่ระบบจริงจะส่งถึงแต่ละคน (ล่าสุดอยู่บน)</div>
      ${line.length ? line.map(x => `<div class="m"><div class="to">ถึง <b>${esc(lineName(x.to))}</b> · ${tm(x.at)} น.</div>${(x.msgs || []).map(m => m.type === 'text' ? esc(m.text) : `<div class="alt">${esc(m.altText || 'การ์ดข้อความ')}</div>${esc(flexText(m.contents, []).join('\n'))}`).join('<hr style="border:0;border-top:1px dashed #ddd">')}</div>`).join('') : '<div class="m">ยังไม่มีข้อความ — ลองยื่นคำขอเปลี่ยน/ลาเวร อนุมัติ หรือรับงานแจ้งไฟดับ</div>'}</div>`;
    box.onclick = e => { if (e.target === box || e.target.id === 'dlX') box.remove(); };
    document.body.appendChild(box);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function paintBar() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const bar = document.createElement('div'); bar.id = 'demoBar';
    bar.innerHTML = '🧪 <b>โหมดทดลอง</b> · ข้อมูลตัวอย่าง ไม่กระทบระบบจริง <span style="flex:1"></span>กำลังโหลด…';
    document.body.insertBefore(bar, document.body.firstChild);
    const lb = document.createElement('button'); lb.id = 'demoLine'; lb.onclick = openLine; document.body.appendChild(lb); paintLineBtn();
    new MutationObserver(() => { lb.style.display = document.querySelector('.osheet,.rqov,.dlgBg,#demoBox') ? 'none' : ''; }).observe(document.body, { childList: true });
    let P; try { P = await people(); } catch (e) { bar.lastChild.textContent = 'โหลดไม่สำเร็จ'; return; }
    const w = who(); if (!w.name && w.kind === 'appr' && P.appr[0]) { lsSet(WHO_K, { kind: 'appr', name: P.appr[0].name }); location.reload(); return; }
    let picked = false; const sel = n => { if (!picked && n === w.name) { picked = true; return 'selected'; } return ''; };
    const opt = (g, L) => L.length ? `<optgroup label="${g}">${L.map(x => `<option value="${esc(x.name)}" ${sel(x.name)}>${esc(x.label)}</option>`).join('')}</optgroup>` : '';
    bar.innerHTML = `🧪 <b>โหมดทดลอง</b><span>ข้อมูลสมมติ ไม่กระทบระบบจริง</span><span style="flex:1"></span>
      <label>ลองเป็น <select id="demoWho"><option value="" ${!w.name ? 'selected' : ''}>ผู้ชมทั่วไป (ไม่ล็อกอิน)</option>${opt('ผู้อนุมัติ', P.appr)}${opt('ผู้ตรวจเวร', P.insp)}${opt('พนักงาน', P.emp)}${opt('คนงาน', P.wk)}</select></label>
      <span>PIN ผู้อนุมัติ <span class="pin">${PIN_A}</span></span><button id="demoReset">เริ่มใหม่</button>`;
    document.getElementById('demoWho').onchange = e => { lsSet(WHO_K, { kind: 'pick', name: e.target.value }); location.reload(); };
    document.getElementById('demoReset').onclick = () => { if (confirm('ล้างข้อมูลทดลองทั้งหมด แล้วเริ่มใหม่?')) window.DEMO.reset(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintBar); else paintBar();
})();
