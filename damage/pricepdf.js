/* อ่านไฟล์ PDF "ราคามาตรฐานพัสดุ (กรณีละเมิดทรัพย์สินระบบไฟฟ้า ของ กฟภ.)" → รายการ {code, d, u, p, g}
 * ใช้ได้ทั้งในเบราว์เซอร์ (window.PricePdf) และใน node (module.exports) — ไม่ต้องพึ่งเซิร์ฟเวอร์
 * หลักการ: แต่ละแถวเริ่มที่รหัสพัสดุ 10 หลัก · ชื่อที่ขึ้นบรรทัดใหม่ (ไม่มีรหัส) ต่อท้ายแถวก่อนหน้า
 * ตำแหน่งคอลัมน์ หน่วย / ราคา อ่านจากหัวตารางของแต่ละหน้า */
(function (root) {
  'use strict';
  // ฟอนต์ไทยรุ่นเก่าใน PDF ใช้ตัวอักษรพิเศษ (Private Use) แทนวรรณยุกต์ — แปลงกลับเป็นตัวปกติ
  const PUA = { '': 'ฐ', '': 'ญ', '': 'ป', '': 'ฝ', '': 'ฟ',
    '': '่', '': '้', '': '๊', '': '๋', '': '์',
    '': '่', '': '้', '': '๊', '': '๋', '': '์',
    '': 'ญ', '': 'ั', '': 'ํ', '': '็', '': '่', '': '้', '': '๊', '': '๋', '': '์', '': 'ุ', '': 'ู', '': 'ฺ' };
  const fixTh = s => String(s || '').replace(/[-]/g, c => PUA[c] || '').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ').trim();
  const UNIT_TH = { 'EACH': 'อัน', 'EACH.': 'อัน', 'EA': 'อัน', 'SETS': 'ชุด', 'UNIT': 'ชุด', 'ROLLS': 'ม้วน', 'PCS': 'อัน', 'PCS.': 'อัน', 'PC': 'อัน', 'SET': 'ชุด', 'PAC': 'ชุด', 'M': 'เมตร', 'M.': 'เมตร', 'KG': 'กก.', 'KG.': 'กก.', 'ROLL': 'ม้วน', 'PAIR': 'คู่', 'LOT': 'ชุด' };

  /** pages = [{ height, items: [{ str, x, y(baseline from bottom), w }] }] */
  function parse(pages) {
    const out = []; let round = '', group = '';
    for (const pg of pages) {
      const toks = pg.items.map(t => ({ s: fixTh(t.str), x: t.x, top: pg.height - t.y, w: t.w || 0 })).filter(t => t.s);
      // หัวกระดาษ: กลุ่มพัสดุ (บรรทัดที่ 2) และ "ครั้งที่ x/yyyy"
      const r = toks.map(t => t.s).join(' ').match(/ครั้งที่\s*([0-9]+\s*\/\s*[0-9]{4})/); if (r) round = r[1].replace(/\s/g, '');
      const lines = groupLines(toks);
      const titleIdx = lines.findIndex(l => /ราคามาตรฐานพัสดุ/.test(l.text));
      if (titleIdx >= 0 && lines[titleIdx + 1] && !/ครั้งที่/.test(lines[titleIdx + 1].text)) group = lines[titleIdx + 1].text;
      // คอลัมน์จากหัวตาราง
      const hUnit = toks.find(t => /^หน่วย/.test(t.s)), hPrice = toks.find(t => /^ราคา/.test(t.s) && hUnit && t.x > hUnit.x);
      const hCode = toks.find(t => /^รหัสพัสดุ/.test(t.s));
      const headBottom = hUnit ? hUnit.top + 30 : 0;
      const unitX = hUnit ? hUnit.x - 12 : null, priceX = hPrice ? hPrice.x - 4 : null;
      if (unitX == null || priceX == null) continue;
      const rows = [];
      const codeToks = toks.filter(t => /^\d{10}$/.test(t.s) && t.top > headBottom - 30).sort((a, b) => a.top - b.top);
      for (const c of codeToks) rows.push({ top: c.top, codeX: c.x + c.w, code: c.s, name: [], unit: [], price: [] });
      if (!rows.length) continue;
      const nameX = hCode ? Math.max(hCode.x + 30, rows[0].codeX + 2) : rows[0].codeX + 2;
      for (const t of toks) {
        if (t.top <= headBottom - 30 || /^\d{10}$/.test(t.s)) continue;
        if (t.x < nameX - 4) continue;                                     // เลขลำดับ "ที่"
        let row = null;
        for (const rw of rows) { if (rw.top <= t.top + 1.2) row = rw; else break; }
        if (!row) continue;
        if (t.x >= priceX) row.price.push(t);
        else if (t.x >= unitX) row.unit.push(t);
        else row.name.push(t);
      }
      for (const rw of rows) {
        const nm = rw.name.sort((a, b) => a.top - b.top || a.x - b.x);
        const name = fixTh(joinLines(nm));
        const unitRaw = fixTh(rw.unit.sort((a, b) => a.x - b.x).map(t => t.s).join(' ')).replace(/^[^A-Za-zก-ฮ]+/, '');
        const price = parseFloat(rw.price.sort((a, b) => a.x - b.x).map(t => t.s).join('').replace(/[^0-9.]/g, ''));
        if (!name || !isFinite(price)) continue;
        out.push({ code: rw.code, d: name, u: UNIT_TH[unitRaw.toUpperCase()] || (/^m\.?$/i.test(unitRaw) ? 'เมตร' : unitRaw), uRaw: unitRaw, p: price, g: group });
      }
    }
    // รหัสซ้ำ (แถวยาวคร่อมหน้า) เก็บตัวแรก
    const seen = new Set();
    return { round, items: out.filter(x => !seen.has(x.code) && seen.add(x.code)) };
  }
  function groupLines(toks) {
    const s = toks.slice().sort((a, b) => a.top - b.top || a.x - b.x), lines = [];
    for (const t of s) { const l = lines[lines.length - 1]; if (l && Math.abs(l.top - t.top) < 2.5) l.t.push(t); else lines.push({ top: t.top, t: [t] }); }
    lines.forEach(l => { l.t.sort((a, b) => a.x - b.x); l.text = fixTh(l.t.map(x => x.s).join(' ')); });
    return lines;
  }
  function joinLines(toks) {
    const lines = groupLines(toks);
    return lines.map(l => l.text).join(' ').replace(/(\d)-\s+(m\.)/g, '$1-$2').replace(/-\s+(m\.)/g, '-$1');
  }

  /** เบราว์เซอร์/โหนด: ใช้ pdf.js อ่านไฟล์ (ArrayBuffer) → pages ตามรูปแบบที่ parse ต้องการ */
  async function readPdf(pdfjsLib, data) {
    const doc = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
      pages.push({ height: vp.height, items: tc.items.filter(t => t.str && t.str.trim()).map(t => ({ str: t.str, x: t.transform[4], y: t.transform[5], w: t.width })) });
    }
    return parse(pages);
  }
  const api = { parse, readPdf, fixTh };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PricePdf = api;
})(typeof window !== 'undefined' ? window : this);
