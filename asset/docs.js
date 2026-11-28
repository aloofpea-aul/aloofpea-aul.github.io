/* ระบบทรัพย์สิน ผปร. — ชุดเอกสารจำหน่ายทรัพย์สิน 18 ฉบับ
 * จัดหน้าตามมาตรฐานงานสารบรรณ: TH SarabunIT๙ 16 · A4 · ขอบซ้าย 3 ขวา 2 ซม. (พื้นที่พิมพ์ 16 ซม.) · ตราห่างขอบบน 1.5 ซม. · ขอบล่าง 2 ซม. · ระยะบรรทัด 1 เท่า
 * ใช้: DOCS.STEPS / DOCS.fields(step) / DOCS.defaults(ctx) / DOCS.html(ids, ctx) / DOCS.print(ids, ctx, title)
 * ctx = { items:[{code,name,serial,acq,cost,bv,cond}], d:{ข้อมูลชุด}, s:{ค่าตั้งต้นสำนักงาน} } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const pd = s => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? [+m[1], +m[2], +m[3]] : null; };
  const thLong = s => { const p = pd(s); return p ? p[2] + ' ' + MON[p[1] - 1] + ' ' + (p[0] + 543) : '..........................'; };
  const thShort = s => { const p = pd(s); return p ? p[2] + ' ' + MS[p[1] - 1] + ' ' + (p[0] + 543) : '................'; };
  const dmy = s => { const p = pd(s); return p ? String(p[2]).padStart(2, '0') + '.' + String(p[1]).padStart(2, '0') + '.' + p[0] : '-'; };
  const money = n => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function bahtText(n) {
    const D = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], P = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
    const rd = s => { let o = ''; s = String(+s); if (+s === 0) return ''; const L = s.length; for (let i = 0; i < L; i++) { const d = +s[i], p = L - i - 1; if (!d) continue; if (p === 0 && d === 1 && L > 1) o += 'เอ็ด'; else if (p === 1 && d === 2) o += 'ยี่'; else if (!(p === 1 && d === 1)) o += D[d]; o += P[p]; } return o; };
    const big = s => s.length > 6 ? big(s.slice(0, -6)) + 'ล้าน' + rd(s.slice(-6)) : rd(s);
    const [b, st] = Math.abs(Number(n) || 0).toFixed(2).split('.');
    return ((+b ? big(b) + 'บาท' : (+st ? '' : 'ศูนย์บาท')) + (+st ? rd(st) + 'สตางค์' : 'ถ้วน'));
  }
  const amt = n => `${money(n)} บาท (${bahtText(n)})`;
  const dots = (v, n) => (v && String(v).trim()) ? esc(v) : '.'.repeat(n || 20);
  const nm = p => (p && p[0]) ? esc(p[0]) : '.......................................';

  /* ---------- ค่าตั้งต้นของสำนักงาน (แก้ได้ในหน้าตั้งค่า) ---------- */
  const OFFICE = {
    orgFull: 'การไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก', org: 'กฟส.อ่าวลึก', orgS: 'กฟส.อล',
    dept: 'ผปร.กฟส.อ่าวลึก', deptFull: 'แผนกปฏิบัติการระบบไฟฟ้า', prefix: 'ต.2กฟส.อล.(ปร.)', intTel: '16555', bfTo: 'กบฟ.(ต.2)', bfHead: 'อก.บฟ.(ต.2)', bfShort: 'กบฟ.ต.2', orgAbbr: 'กฟส.อ่าวลึก', ext: 'มท 5307.60/กฟส.อล',
    addr1: '125 หมู่ที่ 1 ถนนเพชรเกษม ตำบลอ่าวลึกเหนือ', addr2: 'อำเภออ่าวลึก จังหวัดกระบี่ 81110', province: 'จังหวัดกระบี่',
    tel: '075-666920', contact: 'คุณมานศักดิ์ พิลาฤทธิ์',
    mgrName: 'นายชญานิน  งานสัมพันธฤทธิ์', mgrShort: 'ผจก.กฟส.อ่าวลึก', mgrFull: 'ผู้จัดการการไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก',
    head: 'นายมานศักดิ์  พิลาฤทธิ์', headPos: 'หผ.ปร.กฟส.อ่าวลึก', region: 'อก.บฟ.ต.2', fwdPrice: 'ผจก.กฟจ.กระบี่',
    bank: 'ธนาคารกรุงไทย ชื่อบัญชีการไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก บัญชีเลขที่ 818-1-23440-5',
    rule: 'หลักเกณฑ์และวิธีปฏิบัติเกี่ยวกับการจำหน่ายพัสดุของ กฟภ. พ.ศ. 2561',
    deleg: 'ตามคำสั่งการไฟฟ้าส่วนภูมิภาคที่ พ.(ม) 34/2566 เรื่อง มอบอำนาจเกี่ยวกับการจำหน่ายพัสดุ ให้ผู้จัดการการไฟฟ้าส่วนภูมิภาคสาขา ระดับ 9 หรือผู้รักษาการแทนตำแหน่งดังกล่าว มีอำนาจอนุมัติสั่งขายพัสดุ ครั้งหนึ่งซึ่งมีราคาซื้อหรือได้มารวมกันไม่เกิน 250,000.00 บาท (สองแสนห้าหมื่นบาทถ้วน)',
    salePlace: 'แผนกสนับสนุน การไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก ชั้น 2'
  };

  /* ---------- 10 ขั้น ตามลำดับเอกสาร ---------- */
  const STEPS = [
    { t: 'ขออนุมัติจำหน่าย + ตั้งกรรมการสอบข้อเท็จจริง', docs: [['d1', 'บันทึกขออนุมัติจำหน่ายทรัพย์สินออกจากบัญชี']] },
    { t: 'รายงานผลสอบข้อเท็จจริง + ขออนุมัติต่อ กบฟ.', docs: [['d2', 'รายงานผลการสอบสวนหาข้อเท็จจริง'], ['d2b', 'บันทึกขออนุมัติจำหน่ายทรัพย์สินโดยวิธีการขาย (ถึง กบฟ.ต.2)']] },
    { t: 'สืบราคา (ราคาประเมิน)', docs: [['d3', 'หนังสือขอให้เสนอราคา (ราคาประเมิน) × 3 ราย'], ['d6', 'ใบเสนอราคาซื้อ (ราคาประเมิน)']] },
    { t: 'รายงานผลประเมินราคา', docs: [['d7', 'รายงานผลการประเมินราคา (กำหนดราคาขั้นต่ำ)']] },
    { t: 'ขออนุมัติดำเนินการขาย', docs: [['d8', 'บันทึกขออนุมัติดำเนินการขาย']] },
    { t: 'เชิญเสนอราคาซื้อ', docs: [['d9', 'หนังสือขอให้เสนอราคาซื้อ × 3 ราย'], ['d12', 'ใบเสนอราคาซื้อ'], ['d13', 'ทะเบียนคุมการรับซองเสนอราคาซื้อ']] },
    { t: 'สรุปผล + ขออนุมัติขาย', docs: [['d14', 'สรุปผลใบเสนอราคาซื้อ'], ['d15', 'บันทึกขออนุมัติขายพัสดุ']] },
    { t: 'สนองรับราคา', docs: [['d16', 'หนังสือสนองรับราคาที่เสนอซื้อพัสดุ']] },
    { t: 'ส่งมอบ-รับมอบ', docs: [['d17', 'หนังสือส่งมอบ-รับมอบพัสดุ']] },
    { t: 'รายงานผลการขาย + ตัด SAP', docs: [['d18', 'รายงานผลการขายและส่งมอบพัสดุ']] }
  ];
  /* ช่องกรอกของแต่ละขั้น: [คีย์, ชื่อช่อง, ชนิด, คำอธิบาย] · ชนิด: text date person cmte bidders cond prices offer buyer area */
  const FIELDS = [
    [['no1', 'เลขที่บันทึก', 'text'], ['date1', 'วันที่', 'date'], ['from', 'หน่วยงานที่เสนอ', 'text'], ['kind', 'ประเภททรัพย์สิน (ใช้ในข้อความ)', 'text'],
      ['prop', 'ผู้เสนอ', 'person'], ['cmFact', 'คณะกรรมการสอบสวนหาข้อเท็จจริง', 'cmte'], ['ap1', 'ผู้สั่งการท้ายบันทึก (อนุมัติ)', 'person']],
    [['date2', 'วันที่รายงาน', 'date'], ['cond', 'สภาพ/อาการชำรุด รายชิ้น', 'cond'], ['date2b', 'วันที่บันทึกขออนุมัติถึง กบฟ.', 'date'], ['why', 'เหตุที่จำหน่าย (ติ๊กได้หลายข้อ)', 'checks', ['ชำรุดจากการใช้งาน', 'เสื่อมสภาพจากการใช้งาน', 'หมดความจำเป็นในการใช้งาน', 'หากใช้ในหน่วยงานต่อไปจะสิ้นเปลือง คชจ.มาก']], ['seller', 'ผู้มีหน้าที่ขาย', 'text'], ['att', 'เอกสารแนบ', 'checks', ['รายงานยืนยันมูลค่าการได้มาและค่าเสื่อมราคาทรัพย์สิน', 'หนังสือแต่งตั้งคณะกรรมการสอบหาข้อเท็จจริง', 'หนังสือรายงานสรุปผลการสอบหาข้อเท็จจริง', 'ใบสั่งซ่อมและภาพถ่ายสี (กรณีมูลค่าคงเหลือเกิน 1 บาท)']], ['sg2b', 'ผู้ลงนาม', 'person']],
    [['date3', 'วันที่หนังสือ', 'date'], ['bidders', 'ผู้เสนอราคา 3 ราย', 'bidders'], ['view3', 'ช่วงวันให้มาดูสภาพ', 'text', 'เช่น 2-4 เมษายน 2568'], ['due3', 'ให้ส่งใบเสนอราคาภายในวันที่', 'date']],
    [['date4', 'วันที่รายงาน', 'date'], ['ref4', 'อ้างถึง (คำสั่งแต่งตั้ง + หนังสือขอราคา)', 'area'], ['prices', 'ราคาที่แต่ละรายเสนอ (ระบบเลือกราคาสูงสุดเป็นราคากลาง)', 'prices'], ['cmPrice', 'คณะกรรมการประเมินราคา', 'cmte'], ['fwd4', 'เสนอให้ความเห็นชอบ (เรียน)', 'text']],
    [['no5', 'เลขที่บันทึก', 'text'], ['date5', 'วันที่', 'date'], ['ref5', 'อ้างถึง (หนังสืออนุมัติจำหน่าย + คำสั่ง + เห็นชอบราคากลาง)', 'area'], ['order', 'คำสั่งแต่งตั้งคณะกรรมการดำเนินการขาย (เลขที่ + วันที่)', 'text', 'เช่น ต.2กฟส.อล(มต.)44/2568 สั่ง ณ วันที่ 15 มกราคม 2568'], ['cmSale', 'คณะกรรมการดำเนินการขาย', 'cmte'], ['ap5', 'ผู้สั่งการท้ายบันทึก', 'person']],
    [['date6', 'วันที่หนังสือเชิญ', 'date'], ['nos6', 'เลขที่หนังสือเชิญ 3 ฉบับ', 'text', 'เช่น มท 5307.60/กฟส.อล23194/2568, ...'], ['open6', 'วันที่เปิดรับซอง', 'date'], ['time6', 'เวลา', 'text'], ['place6', 'สถานที่', 'text']],
    [['date7', 'วันที่ขออนุมัติขาย', 'date'], ['buyer', 'ผู้เสนอราคาซื้อ', 'buyer'], ['offer', 'ราคาที่ผู้ซื้อเสนอ (ไม่รวมภาษี)', 'offer'], ['ap7', 'ผู้อนุมัติ', 'person']],
    [['date8', 'วันที่หนังสือ', 'date'], ['sg8', 'ผู้ลงนาม', 'person'], ['sg8b', 'ตำแหน่งบรรทัดที่ 2 (ถ้ามี)', 'text', 'เช่น รักษาการแทน ผู้จัดการการไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก'], ['pay8', 'ชำระเงินภายใน (วันทำการ)', 'text'], ['move8', 'ขนย้ายภายใน (วัน)', 'text']],
    [['date9', 'วันที่ส่งมอบ', 'date'], ['rcpt', 'เลขที่ใบเสร็จรับเงิน/ใบกำกับภาษี', 'text'], ['bAddr', 'ที่อยู่ผู้ซื้อ', 'text'], ['bId', 'เลขประจำตัวประชาชนผู้ซื้อ', 'text'], ['bTel', 'โทรศัพท์ผู้ซื้อ', 'text'], ['cmDeliv', 'คณะกรรมการส่งมอบพัสดุ', 'cmte']],
    [['date10', 'วันที่รายงาน', 'date'], ['ap10', 'ผู้สั่งการท้ายบันทึก', 'person']]
  ];

  /* ค่าเริ่มต้นของชุด (เติมเฉพาะช่องที่ยังว่าง) */
  function defaults(ctx) {
    const s = Object.assign({}, OFFICE, ctx.s || {}), d = ctx.d || {}, its = ctx.items || [];
    const furn = its.length && its.every(a => /ตกแต่ง|สำนักงาน/.test(a.cat || '')), cats = [...new Set(its.map(a => a.cat).filter(Boolean))];
    const out = {
      no1: s.prefix, from: s.dept, kind: cats.length === 1 ? cats[0] : furn ? 'เครื่องตกแต่งสำนักงาน' : 'เครื่องมือเครื่องใช้',
      prop: [s.head, s.headPos], ap1: ['', s.mgrShort], ap5: [s.mgrName, s.mgrShort], ap7: [s.mgrName, s.mgrShort], ap10: [s.mgrName, s.mgrShort],
      cmFact: [['', ''], ['', ''], ['', '']], cmPrice: [['', ''], ['', ''], ['', '']], cmSale: [['', ''], ['', ''], ['', '']], cmDeliv: [['', ''], ['', ''], ['', '']],
      bidders: [{ name: '', addr: '' }, { name: '', addr: '' }, { name: '', addr: '' }], fwd4: s.fwdPrice, no5: s.prefix,
      why: [1], att: [0, 1, 2], sg2b: [s.mgrName, s.mgrShort], time6: '09.00 - 12.00 น.', place6: s.salePlace, buyer: 0, sg8: [s.mgrName, s.mgrFull], pay8: '2', move8: '1', cond: {}, prices: {}, offer: {}
    };
    const r = Object.assign({}, out);
    Object.keys(d).forEach(k => { if (d[k] != null && d[k] !== '') r[k] = d[k]; });
    if (!r.ref4) r.ref4 = `ตามคำสั่งเลขที่ ${r.order || '..........................'} เรื่อง แต่งตั้งคณะกรรมการประเมินราคา เพื่อจำหน่ายทรัพย์สินออกจากบัญชี และหนังสือเลขที่ ${s.ext}............/${r.date3 ? pd(r.date3)[0] + 543 : '.......'} ลงวันที่ ${thLong(r.date3)} นั้น`;
    if (!r.ref5) r.ref5 = `ตามหนังสือเลขที่ ............................ ลงวันที่ ............................ อนุมัติให้จำหน่ายพัสดุประเภท${r.kind} ของ ${r.from} จำนวน ${its.length} รายการ (เอกสารแนบ 1) รวมมูลค่าที่ได้มาเป็นเงิน ${money(sum(its, 'cost'))} บาท ออกจากบัญชีด้วยวิธีการขาย ตามคำสั่ง ${s.mgrShort} เลขที่ ${r.order || '............................'} แต่งตั้งคณะกรรมการเพื่อดำเนินการตามวิธีการขายฯ (กรณีจำหน่ายทรัพย์สิน) (เอกสารแนบ 2) หนังสือลงวันที่ ............................ ${s.fwdPrice} อนุมัติ/เห็นชอบกำหนดราคากลาง (ราคาขั้นต่ำ) ของพัสดุเพื่อจำหน่ายออกจากบัญชี จำนวน ${its.length} รายการ ในราคา ${amt(midTotal(its, r))} (ไม่รวมภาษีมูลค่าเพิ่ม) (เอกสารแนบ 3) ${s.deleg} (เอกสารแนบ 4)`;
    return r;
  }
  const sum = (its, k) => its.reduce((t, a) => t + (Number(a[k]) || 0), 0);
  const mid = (a, d) => Math.max(0, ...((d.prices || {})[a.code] || []).map(Number).filter(n => !isNaN(n)));
  const midTotal = (its, d) => its.reduce((t, a) => t + mid(a, d), 0);
  const offerOf = (a, d) => { const v = (d.offer || {})[a.code]; return v === '' || v == null ? mid(a, d) : Number(v) || 0; };

  /* ---------- ชิ้นส่วนเอกสาร ---------- */
  const LOGO = () => (window.DOCS_LOGO || 'pea-logo.png');
  const P = (t, cls, st) => `<p class="${cls || ''}"${st ? ` style="${st}"` : ''}>${t}</p>`;
  const B = (t, st) => P(t, 'in', st);                         // ย่อหน้าเนื้อความ เยื้อง 2.25 ซม.
  function memo(o) {
    return `<img class="lg" src="${LOGO()}" alt="">
<div class="mh"><span>จาก</span><span>${o.from}</span><span>ถึง</span><span>${o.to}</span><span>เลขที่</span><span>${o.no || ''}</span><span>วันที่</span><span>${o.date}</span></div>
<div class="h2"><span>เรื่อง</span><span>${o.sub}</span></div><div class="h2" style="margin:10pt 0 6pt"><span>เรียน</span><span>${o.dear}</span></div>`;
  }
  function letter(s, o) {
    return `<img class="lg" src="${LOGO()}" alt=""><div class="lh"><span>ที่ ${esc(s.ext)}</span><span>${esc(s.orgFull)}<br>${esc(s.addr1)}<br>${esc(s.addr2)}</span></div>
<p style="margin:10pt 0 10pt 7.05cm">${o.date}</p><div class="h2"><span>เรื่อง</span><span>${o.sub}</span></div><div class="h2" style="margin-top:6pt"><span>เรียน</span><span>${o.dear}</span></div>${o.refs ? o.refs.map((r, i) => `<div class="h2"><span>${i ? '' : 'อ้างถึง'}</span><span>${r}</span></div>`).join('') : ''}<div style="height:6pt"></div>`;
  }
  const sign = (name, lines, gap) => `<div class="sg keep"${gap ? ` style="margin-top:${gap}"` : ''}>(${nm([name])})${[].concat(lines).filter(Boolean).map(l => '<br>' + esc(l)).join('')}</div>`;
  const letterSign = (name, lines) => `<div class="sg keep" style="margin-top:12pt">ขอแสดงความนับถือ<br><br><br><br>(${nm([name])})${lines.filter(Boolean).map(l => '<br>' + esc(l)).join('')}</div>`;
  const DOTS = '<span>..............................</span><span class="d2">...............</span>';
  let AB = x => x;
  function cmteSign(cm) {
    cm = cm || [];
    const p = i => `(${nm(cm[i])})  ${esc(AB((cm[i] || [])[1] || ''))}`;
    return `<div class="keep cm"><p class="c">ลงชื่อ${DOTS}ประธานกรรมการ</p><p class="c">${p(0)}</p><div class="two"><div>ลงชื่อ${DOTS}กรรมการ<br>${p(1)}</div><div>ลงชื่อ${DOTS}กรรมการ<br>${p(2)}</div></div></div>`;
  }
  const tail = (sig, en) => `<div class="tail keep"><div class="tsig">${sig}</div>${en || ''}</div>`;
  function endorse(o) {
    return `<div class="en keep">${o.no != null ? `<p>ที่  ${esc(o.no)}</p>` : ''}<p>เรียน  ${esc(o.to)}</p>${o.lines.map(l => `<p style="padding-left:1cm">${l}</p>`).join('')}
<p class="c" style="margin-top:30pt">(${nm(o.p)})</p><p class="c">${esc((o.p || [])[1] || '')}</p>${o.date ? `<p class="c">${o.date}</p>` : ''}${o.foot ? `<p style="margin-top:10pt">${o.foot}</p>` : ''}</div>`;
  }
  const foot = s => `<div class="keep" style="margin-top:48pt"><p>${esc(s.dept)}</p><p>${esc(s.intTel || '')}</p></div>`;
  const cb = on => `<span class="cb${on ? ' on' : ''}"></span>`;
  const dash = n => Math.abs(n - Math.round(n)) < .005 ? Math.round(n).toLocaleString('en-US') + '.-' : money(n);
  const codeTd = a => { const m = String(a.code).match(/^(\d+)-(\d+)$/); return `<td class="c">${m ? m[1] : esc(a.code)}</td><td class="c">${m ? +m[2] : ''}</td>`; };
  function table(head, rows, foot) {
    return `<table><thead>${head}</thead><tbody>${rows}${foot || ''}</tbody></table>`;
  }
  const H = (t, w, cs, rs) => `<th${w ? ` style="width:${w}"` : ''}${cs ? ` colspan="${cs}"` : ''}${rs ? ` rowspan="${rs}"` : ''}>${t}</th>`;
  const HC = '<col style="width:.95cm"><col style="width:2.3cm"><col style="width:.6cm">';

  function formQuote(s, d, its, title, vat) {
    const L = w => `<i style="flex:0 0 ${w}"></i>`;
    return `<img class="lgc" src="${LOGO()}" alt="" style="width:2.3cm"><p class="t">${title}</p>
<div style="margin-left:9.2cm"><div class="dt">เขียนที่<i></i></div><div class="dt">วันที่<i></i></div></div>
<p style="margin-top:2pt">เรียน  ${esc(s.mgrFull)}</p>
<div class="dt" style="padding-left:2.25cm">ข้าพเจ้า (บริษัท/ห้าง/ร้าน/นาย/นาง/นางสาว)<i></i></div>
<div class="dt">ที่อยู่เลขที่${L('1.3cm')}หมู่${L('1cm')}ซอย${L('2.4cm')}ถนน${L('2.5cm')}ตำบล/แขวง<i></i></div>
<div class="dt">อำเภอ/เขต${L('3.3cm')}จังหวัด${L('3.6cm')}รหัสไปรษณีย์<i></i></div>
<div class="dt">โทรศัพท์${L('3.2cm')}โทรสาร${L('3.2cm')}เลขที่ผู้เสียภาษี<i></i></div>` +
      B(`ขอยื่นใบเสนอราคาซื้อ (ราคาประเมิน) (ไม่รวมภาษีมูลค่าเพิ่ม) พัสดุประเภท${esc(d.kind)} ของ${esc(s.orgFull)} จำนวน ${its.length} รายการ ดังนี้.-`) +
      table(`<tr>${H('ที่', '.95cm')}${H('รหัสทรัพย์สิน', '2.9cm', 2)}${H('รายการ')}${H('หน่วยนับ<br>(เครื่อง/ชิ้น)', '2.3cm')}${H('ราคาเสนอซื้อ<br>/เครื่อง/ชิ้น (บาท)', '3cm')}</tr>`,
        its.map((a, i) => `<tr><td class="c">${i + 1}</td>${codeTd(a)}<td>${esc(a.name)}</td><td class="c">1</td><td></td></tr>`).join(''),
        (vat ? ['ราคาที่เสนอ (บาท)', 'ภาษีมูลค่าเพิ่ม 7% (บาท)', 'รวมทั้งสิ้น (บาท)'] : ['ราคาที่เสนอ (บาท) (ไม่รวมภาษีมูลค่าเพิ่ม)']).map(t => `<tr><th colspan="5" class="r">${t}</th><td></td></tr>`).join('')) +
      B('ทั้งนี้ ขอยืนราคาเป็นระยะเวลา................วัน นับตั้งแต่วันยื่นเสนอราคาซื้อ', 'margin-top:4pt') +
      `<div class="sg" style="margin-top:4pt">ขอแสดงความนับถือ<br>ลงชื่อ${DOTS}<br>(${DOTS})<br>${vat ? 'ผู้เสนอราคา' : 'ผู้เสนอราคา (ประทับตรา (ถ้ามี))'}</div>`;
  }

  /* ---------- เอกสารแต่ละฉบับ (คืนค่าเป็นรายการหน้า) ---------- */
  function docs(id, ctx) {
    const s = Object.assign({}, OFFICE, ctx.s || {}), d = defaults(ctx), its = ctx.items, n = its.length;
    AB = x => String(x).split(s.org).join(s.orgAbbr || s.org).replace(/\.\.+/g, '.');
    const cost = sum(its, 'cost'), bv = sum(its, 'bv'), midT = midTotal(its, d);
    const by = d.bidders || [], buyer = by[+d.buyer || 0] || {}, off = its.reduce((t, a) => t + offerOf(a, d), 0);
    const vat = Math.round(off * 7) / 100, gross = Math.round((off + vat) * 100) / 100;
    const kind = esc(d.kind), from = esc(d.from), yr = x => { const p = pd(x); return p ? p[0] + 543 : '.......'; };
    const tbl1 = (extraH, extraTd) => table(`<tr>${H('ที่', '.95cm')}${H('รหัสทรัพย์สิน', '2.9cm', 2)}${H('รายการ')}${extraH}</tr>`, its.map((a, i) => `<tr><td class="c">${i + 1}</td>${codeTd(a)}<td>${esc(a.name)}</td>${extraTd(a, i)}</tr>`).join(''));
    const minAge = Math.max(1, Math.floor(Math.min(...its.map(a => a.age || 0)) / 10) * 10 || Math.floor(Math.min(...its.map(a => a.age || 0))));
    switch (id) {
      case 'd1': return [memo({ from, to: esc(s.org), no: esc(d.no1), date: thLong(d.date1), sub: 'ขออนุมัติจำหน่ายทรัพย์สินออกจากบัญชี', dear: esc(s.mgrShort) }) +
        B(`${from} ได้สำรวจทรัพย์สินที่ครอบครอง ประเภท${kind} อุปกรณ์ดังกล่าวเป็นรุ่นเก่าล้าสมัย มีอายุการใช้งานมากกว่า ${minAge} ปี และเกิดการชำรุดไม่สามารถใช้งานได้ เพื่อให้การบริหารทรัพย์สินประเภท${kind}นี้เกิดประโยชน์สูงสุด จึงเห็นควรขออนุมัติจำหน่ายทรัพย์สินออกจากบัญชี จำนวน ${n} รายการ มูลค่าที่ได้มาเป็นเงินรวม ${amt(cost)} ตามรายการ ดังนี้.-`) +
        tbl1(H('เลขที่ผลิตภัณฑ์', '2.6cm') + H('วันที่ได้มา', '2.6cm'), a => `<td class="c">${esc(a.serial) || '-'}</td><td class="c">${dmy(a.acq)}</td>`) +
        B(`ดังนั้น เพื่อให้การจำหน่ายทรัพย์สินเป็นไปด้วยความถูกต้องตาม${esc(s.rule)} ข้อ 2.1 จึงขออนุมัติแต่งตั้งคณะกรรมการสอบสวนหาข้อเท็จจริงเพื่อจำหน่ายทรัพย์สินออกจากบัญชี ดังนี้.-`, 'margin-top:10pt') +
        (d.cmFact || []).map((c, i) => `<div class="cl"><span>${i + 1}. ${nm(c)}</span><span>ตำแหน่ง  ${esc(AB(c[1] || ''))}</span><span>${i ? 'คณะกรรมการ' : 'ประธานกรรมการ'}</span></div>`).join('') +
        B('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป', 'margin-top:10pt') +
        tail(sign(d.prop[0], d.prop[1], '36pt'), endorse({ to: `${esc(String(d.prop[1] || '').replace(/กฟส\..*$/, ''))}, คณะกรรมการฯ`, lines: ['- อนุมัติ แจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป'], p: d.ap1 }))];
      case 'd2': return [memo({ from: 'คณะกรรมการสอบสวนหาข้อเท็จจริง', to: esc(s.mgrShort), no: '', date: thLong(d.date2), sub: 'รายงานผลการสอบสวนหาข้อเท็จจริงเพื่อจำหน่ายทรัพย์สินออกจากบัญชี', dear: esc(s.mgrShort) }) +
        B(`ตามอนุมัติ ${esc(s.mgrShort)} ลงวันที่ ${thLong(d.date1)} แต่งตั้งคณะกรรมการสอบข้อเท็จจริงเพื่อจำหน่ายทรัพย์สินออกจากบัญชีนั้น คณะกรรมการฯ ได้ร่วมกันสอบสวนข้อเท็จจริงเกี่ยวกับการเสื่อมสภาพของ${kind} ของ ${from} จำนวน ${n} รายการ ดังนี้.-`) +
        tbl1(H('เลขที่ผลิตภัณฑ์', '2.8cm') + H('สภาพ/<br>อาการชำรุด', '3.4cm'), a => `<td class="c">${esc(a.serial) || '-'}</td><td class="c">${esc((d.cond || {})[a.code] || a.cond || '')}</td>`) +
        B(`ทรัพย์สินดังกล่าวเป็นรุ่นเก่าล้าสมัย ผ่านการใช้งานมานานหลายปี ไม่สามารถซ่อมได้ หากจัดซ่อมจะไม่คุ้มกับค่าใช้จ่าย จึงเห็นควรอนุมัติจำหน่ายทรัพย์สินดังกล่าว จำนวน ${n} รายการ มูลค่าที่ได้มาเป็นเงินรวม ${amt(cost)} มูลค่าทางบัญชีคงเหลือ ${Math.abs(bv - Math.round(bv)) < .005 ? Math.round(bv).toLocaleString('en-US') : money(bv)} บาท โดยวิธีการขาย ตาม${esc(s.rule)} ต่อไป`, 'margin-top:10pt') +
        `<div class="keep">${B('จึงเรียนมาเพื่อโปรดพิจารณา และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป', 'margin-top:6pt')}${cmteSign(d.cmFact)}</div>` + foot(s)];
      case 'd3': case 'd9': {
        const r1 = id === 'd3';
        return [0, 1, 2].map(i => letter(s, { date: thLong(r1 ? d.date3 : d.date6), sub: `ขอให้เสนอราคาซื้อพัสดุที่ชำรุด ประเภท${kind} จำนวน ${n} รายการ`, dear: nm([(by[i] || {}).name]) }) +
          (r1 ? B(`ด้วย${esc(s.orgFull)} มีความประสงค์จำหน่ายพัสดุที่ชำรุด ประเภท${kind} จำนวน ${n} รายการ ออกจากบัญชี ซึ่งมีความจำเป็นต้องหาราคาซื้อ (ราคาประเมิน) จากท้องตลาด เพื่อประกอบการขออนุมัติกำหนดราคากลาง (ราคาประเมิน) ต่อไป`) +
            B(`ทั้งนี้ ขอให้ท่านมาดูสภาพพัสดุ ระหว่างวันที่ ${dots(d.view3, 24)} ณ ${esc(s.deptFull)} ชั้น 2 สำนักงาน${esc(s.orgFull)} เลขที่ ${esc(s.addr1)} ${esc(s.addr2)} โทรศัพท์ ${esc(s.tel)} ${esc(s.contact)} แล้วให้เสนอราคาซื้อพัสดุดังกล่าว (ตามแบบฟอร์มแนบ) ภายในวันที่ ${thLong(d.due3)} เพื่อจะได้ดำเนินการต่อไป`)
            : B(`ด้วย${esc(s.deptFull)} ${esc(s.orgFull)} ${esc(s.province)} มีความประสงค์จำหน่ายพัสดุที่ชำรุด ประเภท${kind} จำนวน ${n} รายการ ออกจากบัญชี จึงขอให้ท่านเสนอราคาซื้อพัสดุดังกล่าว`) +
            B(`ทั้งนี้ ขอให้ท่านมาดูสภาพพัสดุ พร้อมทั้งเสนอราคาซื้อพัสดุดังกล่าว (ตามแบบฟอร์มแนบ) ในวันที่ ${thLong(d.open6)} เวลา ${esc(d.time6)} ณ ${esc(d.place6)} ${esc(s.province)} เลขที่ ${esc(s.addr1)} ${esc(s.addr2)} โทรศัพท์ ${esc(s.tel)} ${esc(s.contact)} เพื่อจะได้ดำเนินการต่อไป`)) +
          B('จึงเรียนมาเพื่อโปรดทราบ', 'margin-top:6pt') + letterSign(s.mgrName, [s.mgrFull, s.province]));
      }
      case 'd2b': {
        const w = (d.why || []).map(Number), at = (d.att || []).map(Number), dep = Math.max(0, cost - bv);
        const W = ['ชำรุดจากการใช้งาน', 'เสื่อมสภาพจากการใช้งาน', 'หมดความจำเป็น ในการใช้งาน', 'หากใช้ในหน่วยงานต่อไปจะสิ้นเปลือง คชจ.มาก'];
        return [memo({ from: esc(s.org), to: esc(s.bfTo), no: '', date: thLong(d.date2b), sub: 'ขออนุมัติจำหน่ายทรัพย์สิน โดย<b>วิธีการขาย</b>', dear: esc(s.bfHead) }) +
          B(`ตามที่ ${esc(s.org)} ได้ตรวจสอบทรัพย์สิน ${kind} พบว่าทรัพย์สินดังกล่าว`) +
          `<div class="ck">${W.map((t, i) => `<span>${cb(w.includes(i))}${t}</span>`).join('')}</div>` +
          P(`จำนวน ${n} รายการ มีมูลค่าการได้มารวม ${dash(cost)} บาท ค่าเสื่อมราคาสะสม ณ วันที่ ${thLong(d.date2b)} จำนวนเงิน ${dash(dep)} บาท มูลค่าคงเหลือตามบัญชี ${dash(bv)} บาท ซึ่งคณะกรรมการสอบหาข้อเท็จจริงได้จัดทำรายงานสรุปผลการสอบหาข้อเท็จจริงเรียบร้อยแล้ว`, 'j') +
          B(`เพื่อให้เป็นไปตาม${esc(s.rule)} ข้อ 6.1 การจำหน่ายทรัพย์สินที่ชำรุด หรือเสื่อมสภาพ หรือหมดความจำเป็นในการใช้งาน หรือหากใช้ในหน่วยงานต่อไปจะสิ้นเปลืองค่าใช้จ่ายมาก เห็นควรขออนุมัติจำหน่ายทรัพย์สินดังกล่าว โดยวิธีการขาย และให้ ${dots(d.seller, 30)} เป็นผู้มีหน้าที่ขาย`, 'margin-top:8pt') +
          B('พร้อมนี้ได้แนบเอกสารประกอบการพิจารณาอนุมัติจำหน่ายทรัพย์สิน ดังนี้', 'margin-top:6pt') +
          `<div class="at"><p>${cb(at.includes(0))}1. รายงานยืนยันมูลค่าการได้มาและค่าเสื่อมราคาทรัพย์สิน</p><p class="s">-ผบส.กบฟ.ต.2 (เฉพาะหน่วยงานในสังกัด กฟต.2)</p><p class="s">-ผบป.กฟฟ.ชั้น 1-3, ผบง.กฟส.</p>
<p>${cb(at.includes(1))}2. หนังสือแต่งตั้งคณะกรรมการสอบหาข้อเท็จจริง</p><p>${cb(at.includes(2))}3. หนังสือรายงานสรุปผลการสอบหาข้อเท็จจริงของคณะกรรมการสอบหาข้อเท็จจริง</p>
<p class="nw">${cb(at.includes(3))}4. กรณีที่ทรัพย์สินที่ขออนุมัติจำหน่ายมีมูลค่าคงเหลือเกิน 1 บาท ให้แนบใบสั่งซ่อมและภาพถ่ายสี</p><p style="padding-left:.75cm">ของทรัพย์สินที่ชำรุดประกอบ</p></div>` +
          `<div class="keep">${B(`จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบโปรดนำเสนอ ${esc(s.bfShort)} ดำเนินการต่อไป`)}<div class="sg" style="margin-top:42pt">...................................................<br>(${nm(d.sg2b)})<br>${esc((d.sg2b || [])[1] || '')}</div></div>` +
          `<p class="fn">แบบฟอร์มนี้ใช้สำหรับการขออนุมัติจำหน่ายทรัพย์สินประเภทเครื่องตกแต่งและเครื่องมือเครื่องใช้<br>และสินทรัพย์ไม่มีตัวตนของ กฟฟ. ในสังกัด กฟต.2 โดยวิธีการขาย เท่านั้น ออกโดย ผบส.กบฟ.ต.2</p>`];
      }
      case 'd6': return [formQuote(s, d, its, 'ใบเสนอราคาซื้อ (ราคาประเมิน)', false)];
      case 'd12': return [formQuote(s, d, its, 'ใบเสนอราคาซื้อ', true)];
      case 'd7': {
        const tot = j => its.reduce((t, a) => t + (Number(((d.prices || {})[a.code] || [])[j]) || 0), 0);
        const short = b => esc(String((b || {}).name || '').replace(/^(นาย|นางสาว|นาง)\s*/, 'คุณ').split(/\s+/)[0] + 'ฯ');
        const pv = (a, j) => { const v = ((d.prices || {})[a.code] || [])[j]; return v === '' || v == null ? '' : money(v); };
        return [memo({ from: 'คณะกรรมการประเมินราคา', to: esc(s.mgrShort), no: '', date: thLong(d.date4), sub: 'ขอรายงานผลการประเมินราคา (กำหนดราคาขั้นต่ำ) เพื่อจำหน่ายทรัพย์สินออกจากบัญชี', dear: esc(s.mgrShort) }) +
          B(`${esc(d.ref4)} คณะกรรมการฯ ได้ร่วมกันสืบหาราคาจากท้องตลาด จำนวน 3 ราย (ตามใบเสนอราคาซื้อแนบ) ดังนี้.-`) +
          by.map((b, i) => `<p style="padding-left:2.25cm">${i + 1}. ${nm([b.name])}${b.addr ? '  ที่อยู่ ' + esc(b.addr) : ''}</p>`).join('') +
          B('คณะกรรมการฯ ดำเนินการประเมินราคาที่ซื้อขายตามปกติในท้องตลาด โดยการสอบถามเพื่อเปรียบเทียบราคา ดังนี้.-') +
          table(`<tr>${H('ที่', '.95cm', 0, 2)}${H('รหัสทรัพย์สิน', '2.9cm', 2, 2)}${H('รายการ', '', 0, 2)}${H('ผู้เสนอราคา/ราคา (ไม่รวมภาษีมูลค่าเพิ่ม)', '', 3)}</tr><tr>${by.map(b => H(short(b), '2.1cm')).join('')}</tr>`,
            its.map((a, i) => `<tr><td class="c">${i + 1}</td>${codeTd(a)}<td>${esc(a.name)}</td>${[0, 1, 2].map(j => `<td class="r">${pv(a, j)}</td>`).join('')}</tr>`).join(''),
            `<tr><th colspan="4" class="r">รวมทั้งสิ้น (บาท)</th>${[0, 1, 2].map(j => `<th class="r">${money(tot(j))}</th>`).join('')}</tr>`) +
          B(`คณะกรรมการฯ พิจารณาจากราคาสูงสุดที่ร้านเสนอมาแต่ละรายการ เพื่อกำหนดเป็นราคากลาง (ราคาประเมิน/ราคาขั้นต่ำ) และขออนุมัติกำหนดราคากลางขั้นต่ำในการขายพัสดุประเภท${kind} ของ ${from} จำนวน ${n} รายการ ดังนี้.-`, 'margin-top:10pt') +
          tbl1(H('ราคากลาง (ราคาประเมิน/ขั้นต่ำ)<br>(ไม่รวมภาษีมูลค่าเพิ่ม)', '4.6cm'), a => `<td class="r">${money(mid(a, d))}</td>`).replace('</tbody>', `<tr><th colspan="4" class="r">รวมทั้งสิ้น (บาท) (${bahtText(midT)})</th><th class="r">${money(midT)}</th></tr></tbody>`) +
          B(`จึงเรียนมาเพื่อโปรดให้ความเห็นชอบกำหนดราคาขายพัสดุประเภท${kind} ของ ${from} จำนวน ${n} รายการ เพื่อจำหน่ายออกจากบัญชีทรัพย์สินด้วยการขายโดยวิธีเฉพาะเจาะจง ตาม${esc(s.rule)} และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป`, 'margin-top:10pt') +
          tail(cmteSign(d.cmPrice), endorse({ no: s.prefix + '          /' + yr(d.date4), to: d.fwd4 || s.fwdPrice, lines: ['เพื่อโปรดพิจารณาให้ความเห็นชอบ', 'ตามที่คณะกรรมการประเมินราคานำเสนอต่อไป'], p: [s.mgrName, s.mgrShort], date: thLong(d.date4) })) + foot(s)];
      }
      case 'd8': return [memo({ from: 'คณะกรรมการดำเนินการขาย', to: esc(s.mgrShort), no: esc(d.no5), date: thLong(d.date5), sub: `ขออนุมัติดำเนินการขายพัสดุของ ${from} จำนวน ${n} รายการ`, dear: esc(s.mgrShort) }) +
        B(esc(d.ref5)) +
        B(`เพื่อให้การจำหน่ายพัสดุ จำนวน ${n} รายการ ดังกล่าว มีความถูกต้อง สอดคล้องกับ${esc(s.rule)} คณะกรรมการดำเนินการขายได้พิจารณาแล้ว เห็นควรอนุมัติดำเนินการขายพัสดุ จำนวน ${n} รายการ รวมมูลค่าที่ได้มาเป็นเงิน ${money(cost)} บาท ออกจากบัญชีด้วยการขายโดยวิธีเฉพาะเจาะจง โดยเจรจาตกลงราคา โดยกำหนดราคากลาง (ราคาขั้นต่ำ) เป็นเงินรวม ${amt(midT)} (ไม่รวมภาษีมูลค่าเพิ่ม)`, 'margin-top:6pt') +
        B('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป', 'margin-top:6pt') +
        tail(cmteSign(d.cmSale), endorse({ to: 'คณะกรรมการดำเนินการขาย', lines: ['- อนุมัติ / ดำเนินการต่อไป'], p: d.ap5, date: thShort(d.date5) }))];
      case 'd13': return [`<img class="lgc" src="${LOGO()}" alt=""><p class="t">ทะเบียนคุมการรับซองเสนอราคาซื้อ</p>
<p class="c">ขายพัสดุประเภท${kind}ที่ชำรุดของ ${esc(s.orgS)} จำนวน ${n} รายการ</p><p class="c">ด้วยวิธีการขายโดยวิธีเฉพาะเจาะจงโดยเจรจาตกลงราคา</p>
<p class="c">วันที่ ${thLong(d.open6)} เวลา ${esc(d.time6)}</p><p class="c" style="margin-bottom:8pt">ณ ${esc(d.place6)} ${esc(s.province)}</p>` +
        table(`<tr>${H('ที่', '.95cm')}${H('ผู้เสนอราคาซื้อ')}${H('เวลา', '1.9cm')}${H('ชื่อผู้ยื่นซอง<br>(ตัวบรรจง)', '3.5cm')}${H('ลายมือชื่อ', '2.7cm')}${H('เบอร์โทรศัพท์', '3cm')}</tr>`, Array.from({ length: 12 }, () => '<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')) + cmteSign(d.cmSale)];
      case 'd14': return [`<img class="lgc" src="${LOGO()}" alt=""><p class="t">สรุปผลใบเสนอราคาซื้อ</p>
<p class="c">ขายพัสดุประเภท${kind}ที่ชำรุดของ ${esc(s.orgS)} จำนวน ${n} รายการ</p><p class="c">ด้วยวิธีการขายโดยวิธีเฉพาะเจาะจงโดยเจรจาตกลงราคา</p>
<p class="c">เปิดซองวันที่ ${thLong(d.open6)}</p><p class="c" style="margin-bottom:8pt">ณ ${esc(d.place6)} ${esc(s.province)}</p>` +
        table(`<tr>${H('ที่', '.95cm', 0, 2)}${H('รหัสทรัพย์สิน', '2.9cm', 2, 2)}${H('รายการ', '', 0, 2)}${H('หน่วยนับ<br>(ตัว/ชิ้น)', '2cm', 0, 2)}${H('ราคารวมที่เสนอ (บาท)<br>(รวมภาษีมูลค่าเพิ่ม)', '3.6cm')}</tr><tr>${H(nm([buyer.name]))}</tr>`,
          its.map((a, i) => `<tr><td class="c">${i + 1}</td>${codeTd(a)}<td>${esc(a.name)}</td><td class="c">1</td><td class="r">${money(offerOf(a, d))}</td></tr>`).join(''),
          [['ราคาที่เสนอ (บาท)', off], ['ภาษีมูลค่าเพิ่ม 7% (บาท)', vat], ['รวมทั้งสิ้น (บาท)', gross]].map(r => `<tr><th colspan="5" class="r">${r[0]}</th><th class="r">${money(r[1])}</th></tr>`).join('')) + cmteSign(d.cmSale)];
      case 'd15': return [memo({ from: 'คณะกรรมการดำเนินการขาย', to: esc(s.mgrShort), no: esc(d.no5 || s.prefix), date: thLong(d.date7), sub: `ขออนุมัติขายพัสดุประเภท${kind} ของ ${esc(s.org)} จำนวน ${n} รายการ`, dear: esc(s.mgrShort) }) +
        P('1. เรื่องเดิม', 'b', 'padding-left:1cm') +
        B(`1.1 ตามคำสั่งเลขที่ ${dots(d.order, 40)} เรื่อง แต่งตั้งคณะกรรมการฯ เพื่อดำเนินการตามวิธีการขายพัสดุ`) +
        B(`1.2 ${esc(s.deleg)}`) +
        B(`1.3 ตามอนุมัติ ${esc(s.mgrShort)} ลงวันที่ ${thLong(d.date5)} ให้ดำเนินการขายพัสดุประเภท${kind} ของ ${esc(s.org)} จำนวน ${n} รายการ ด้วยวิธีขายโดยวิธีเฉพาะเจาะจง โดยการเจรจาตกลงราคา และอนุมัติราคาประเมินเป็นราคาเริ่มต้นการขาย โดยให้คณะกรรมการดำเนินการขายเป็นผู้ดำเนินการขาย รายละเอียดดังนี้`) +
        table(`<tr>${H('ที่', '.95cm', 0, 2)}${H('รายการ', '', 0, 2)}${H('รหัสพัสดุ /<br>รหัสทรัพย์สิน /<br>รหัสเศษวัสดุ', '2.9cm', 2, 2)}${H('จำนวน<br>(ตัว/ชิ้น)', '1.8cm', 0, 2)}${H('ราคาประเมิน (ราคาขายขั้นต่ำ)<br>(ไม่รวมภาษีมูลค่าเพิ่ม)', '', 2)}</tr><tr>${H('ราคาต่อหน่วย<br>(บาท)', '2.6cm')}${H('ราคารวม<br>(บาท)', '2.6cm')}</tr>`,
          its.map((a, i) => `<tr><td class="c">${i + 1}</td><td>${esc(a.name)}</td>${codeTd(a)}<td class="c">1</td><td class="r">${money(mid(a, d))}</td><td class="r">${money(mid(a, d))}</td></tr>`).join(''),
          `<tr><th colspan="4" class="r">รวมทั้งสิ้น</th><th class="c">${n}</th><th class="c">-</th><th class="r">${money(midT)}</th></tr>`) +
        P('2. ข้อเท็จจริง', 'b', 'padding-left:1cm;margin-top:8pt') +
        B(`2.1 คณะกรรมการดำเนินการขายได้ดำเนินการขายพัสดุดังกล่าวด้วยวิธีการเฉพาะเจาะจง โดยการเจรจาตกลงราคา พร้อมทั้งจัดทำหนังสือเชิญชวนให้เสนอราคาซื้อพัสดุ จำนวน 3 ราย ตามหนังสือเลขที่ ${dots(d.nos6, 40)} ลงวันที่ ${thLong(d.date6)} และกำหนดให้มาดูสภาพพัสดุ พร้อมทั้งเสนอราคาซื้อพัสดุดังกล่าว ในวันที่ ${thLong(d.open6)} ระหว่างเวลา ${esc(d.time6)} ณ ${esc(d.place6)} ${esc(s.province)}`) +
        B(`2.2 มีผู้เสนอราคาซื้อพัสดุในครั้งนี้ คือ ${nm([buyer.name])} ซึ่งเสนอราคาซื้อเป็นเงิน ${amt(gross)} (รวมภาษีมูลค่าเพิ่ม) (ตามเอกสารแนบ)`) +
        P('3. ข้อพิจารณาและข้อเสนอ', 'b', 'padding-left:1cm;margin-top:8pt') +
        B(`เพื่อให้การดำเนินการขายพัสดุประเภท${kind}ที่ชำรุด ของ ${from} จำนวน ${n} รายการ ด้วยวิธีการเฉพาะเจาะจง โดยการเจรจาตกลงราคา เป็นไปด้วยความเรียบร้อย ถูกต้องตรงตาม${esc(s.rule)} จึงเห็นควรดำเนินการ ดังนี้`) +
        B(`3.1 อนุมัติสนองรับราคาซื้อพัสดุ จำนวน ${n} รายการ ให้กับ ${nm([buyer.name])}`) +
        B(`3.2 อนุมัติให้ขายพัสดุ จำนวน ${n} รายการ เป็นเงินจำนวน ${amt(gross)} (รวมภาษีมูลค่าเพิ่ม)`) +
        B('จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบโปรดอนุมัติตามข้อ 3.1 - 3.2 ต่อไป', 'margin-top:6pt') +
        tail(cmteSign(d.cmSale), endorse({ to: 'คณะกรรมการฯ', lines: ['- อนุมัติตามข้อ 3.1 - 3.2', '- ดำเนินการต่อไป'], p: d.ap7, date: thLong(d.date7) }))];
      case 'd16': return [letter(s, { date: thLong(d.date8), sub: 'หนังสือสนองรับราคาที่เสนอซื้อพัสดุ', dear: nm([buyer.name]), refs: [`1. หนังสือ ${dots((String(d.nos6 || '').split(',')[+d.buyer || 0] || '').trim(), 30)} ลงวันที่ ${thLong(d.date6)}`, `2. ใบเสนอราคาซื้อ ลงวันที่ ${thLong(d.open6)}`] }) +
        B(`ตามที่${nm([buyer.name])} ได้เสนอราคาซื้อ ในการขายพัสดุประเภท${kind}ที่ชำรุด ของ${esc(s.deptFull)} ${esc(s.orgFull)} ${esc(s.province)} จำนวน ${n} รายการ ตามใบเสนอราคาซื้อ ลงวันที่ ${thLong(d.open6)} นั้น`) +
        B(`การไฟฟ้าส่วนภูมิภาค ได้พิจารณาแล้วตกลงสนองรับราคาที่เสนอซื้อ ในการขายพัสดุดังกล่าว จำนวน ${n} รายการ เป็นเงินทั้งสิ้น ${amt(gross)} (รวมภาษีมูลค่าเพิ่ม)`) +
        B(`ทั้งนี้ ขอให้${nm([buyer.name])} มาชำระเงิน ณ สำนักงาน${esc(s.orgFull)} ${esc(s.province)} หรือโอนเงินเข้าบัญชี${esc(s.bank)} ภายใน ${esc(d.pay8)} วันทำการ นับจากวันที่ได้รับหนังสือสนองรับราคาที่เสนอซื้อฉบับนี้ พร้อมทั้งขนย้ายพัสดุ จำนวน ${n} รายการ ภายใน ${esc(d.move8)} วัน นับจากวันที่ได้ชำระเงินครบถ้วนแล้ว`) +
        B('จึงเรียนมาเพื่อโปรดทราบ', 'margin-top:6pt') + letterSign((d.sg8 || [])[0], [(d.sg8 || [])[1], d.sg8b, s.province])];
      case 'd17': {
        const cm = d.cmDeliv || [];
        return [`<img class="lgc" src="${LOGO()}" alt=""><p class="t">หนังสือส่งมอบ-รับมอบพัสดุ</p><p class="c" style="margin-bottom:8pt">ประเภท${kind}ที่ชำรุด ของ ${from} จำนวน ${n} รายการ</p>
<p style="margin-left:7.8cm">เขียนที่  ${esc(s.salePlace)}</p><p style="margin-left:7.8cm;margin-bottom:8pt">วันที่  ${thLong(d.date9)}</p><div class="h2" style="margin-bottom:4pt"><span>เรียน</span><span>${nm([buyer.name])}</span></div>` +
          B(`ตามคำสั่งเลขที่ ${dots(d.order, 40)} เรื่อง แต่งตั้งคณะกรรมการฯ เพื่อดำเนินการตามวิธีการขายพัสดุ และตามอนุมัติ ${esc(s.mgrShort)} ลงวันที่ ${thLong(d.date7)} อนุมัติขายพัสดุประเภท${kind}ที่ชำรุด ของ ${from} จำนวน ${n} รายการ และ${nm([buyer.name])} เป็นผู้ที่การไฟฟ้าส่วนภูมิภาคสนองรับราคาที่เสนอซื้อ และได้ชำระเงิน จำนวน ${amt(gross)} (รวมภาษีมูลค่าเพิ่ม) ครบถ้วนแล้ว ตามใบเสร็จรับเงิน/ใบกำกับภาษี เลขที่ ${dots(d.rcpt, 24)} ลงวันที่ ${thLong(d.date9)} นั้น คณะกรรมการส่งมอบพัสดุ ขอส่งมอบพัสดุ จำนวน ${n} รายการ ดังนี้.-`) +
          tbl1(H('หน่วยนับ<br>(ตัว/ชิ้น)', '2.4cm'), () => '<td class="c">1</td>') + cmteSign(cm) +
          `<div class="keep" style="margin-top:18pt">${B(`ข้าพเจ้า ${nm([buyer.name])} ที่อยู่ ${dots(d.bAddr, 40)} เลขประจำตัวประชาชน ${dots(d.bId, 20)} โทรศัพท์ ${dots(d.bTel, 16)} ได้ชำระเงินค่าซื้อพัสดุที่ชำรุด ประเภท${kind}ของ ${from} จำนวน ${n} รายการ เป็นเงิน ${amt(gross)} (รวมภาษีมูลค่าเพิ่ม) ครบถ้วนแล้ว และรับมอบพร้อมทั้งขนย้ายพัสดุตามรายการข้างต้นถูกต้องครบถ้วนแล้ว เมื่อวันที่ ${thLong(d.date9)}`)}
<div class="sg" style="margin-top:24pt">ลงชื่อ${DOTS}<br>(${nm([buyer.name])})<br>ผู้รับมอบ<br>วันที่ ${thLong(d.date9)}</div></div>`];
      }
      case 'd18': return [memo({ from: 'คณะกรรมการส่งมอบพัสดุ', to: esc(s.mgrShort), no: '', date: thLong(d.date10), sub: `รายงานผลการขายและส่งมอบพัสดุของ ${from} จำนวน ${n} รายการ`, dear: esc(s.mgrShort) }) +
        P('1. เรื่องเดิม', 'b', 'padding-left:1cm') +
        B(`1.1 ตามคำสั่งเลขที่ ${dots(d.order, 40)} เรื่อง แต่งตั้งคณะกรรมการฯ เพื่อดำเนินการตามวิธีการขายพัสดุ`) +
        B(`1.2 ตามอนุมัติ ${esc(s.mgrShort)} ลงวันที่ ${thLong(d.date7)} ให้ดำเนินการขาย และรับราคาเสนอซื้อพัสดุประเภท${kind}ที่ชำรุดของ ${from} จำนวน ${n} รายการ`) +
        P('2. ข้อเท็จจริง', 'b', 'padding-left:1cm;margin-top:8pt') +
        B(`ตามใบเสนอราคาซื้อ ลงวันที่ ${thLong(d.open6)} โดย${nm([buyer.name])} เป็นผู้ที่การไฟฟ้าส่วนภูมิภาคสนองรับราคาซื้อพัสดุดังกล่าว และได้ชำระเงิน พร้อมทั้งขนย้ายพัสดุเรียบร้อยแล้ว ตามหนังสือส่งมอบ-รับมอบพัสดุ ลงวันที่ ${thLong(d.date9)}`) +
        P('3. ข้อเสนอ', 'b', 'padding-left:1cm;margin-top:8pt') +
        B(`3.1 คณะกรรมการส่งมอบพัสดุ ขอรายงานผลการขายและส่งมอบพัสดุประเภท${kind}ที่ชำรุดของ ${from} จำนวน ${n} รายการ ดังนี้`) +
        tbl1(H('หน่วยนับ<br>(ตัว/ชิ้น)', '2.4cm'), () => '<td class="c">1</td>') +
        B(`3.2 ให้ ผสน.${esc(s.org)} ดำเนินการตัดจ่ายพัสดุออกจากบัญชีในระบบ SAP ต่อไป`, 'margin-top:8pt') +
        B('จึงเรียนมาเพื่อโปรดพิจารณา และแจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป', 'margin-top:6pt') +
        tail(cmteSign(d.cmDeliv), endorse({ no: s.prefix + '          /' + yr(d.date10), to: s.region + ', คณะกรรมการฯ', lines: ['- เพื่อโปรดทราบ', '- แจ้งส่วนที่เกี่ยวข้องดำเนินการต่อไป'], p: d.ap10, date: thShort(d.date10) }))];
    }
    return [];
  }

  const CSS = `@font-face{font-family:'THSN';src:url('FONTDIR/THSarabunNew.woff') format('woff');font-display:block;size-adjust:65.5%;ascent-override:75%;descent-override:25%}
@font-face{font-family:'THSN';font-weight:700;src:url('FONTDIR/THSarabunNew-Bold.woff') format('woff');font-display:block;size-adjust:65.5%;ascent-override:75%;descent-override:25%}
@page{size:A4;margin:15mm 20mm 20mm 30mm}
.dp{font-family:'TH SarabunIT๙','TH SarabunIT9','THSN',serif;font-size:16pt;line-height:18.1pt;color:#000;background:#fff}
.dp .pg{break-before:page;page-break-before:always}.dp .pg:first-child{break-before:auto;page-break-before:auto}
.dp,.dp .pg{max-width:100%;overflow-wrap:anywhere}.dp p{margin:0}.dp .in{text-indent:2.25cm;text-align:justify;text-justify:inter-character}.dp .c{text-align:center}.dp .r{text-align:right}.dp .b{font-weight:700}
.dp .t{text-align:center;font-weight:700;font-size:20pt;line-height:22pt}
.dp .lg{width:3.05cm;display:block;margin-bottom:5pt}.dp .lgc{width:2.75cm;display:block;margin:0 auto 3pt}
.dp .mh{display:grid;grid-template-columns:1.5cm 6.5cm 1.2cm 1fr}.dp .h2{display:grid;grid-template-columns:1.5cm 1fr}
.dp .lh{display:grid;grid-template-columns:9.4cm 1fr}
.dp .cl{display:grid;grid-template-columns:5.4cm 5cm minmax(0,1fr);padding-left:2.25cm;white-space:nowrap}
.dp table{border-collapse:collapse;width:100%;margin:4pt 0;font-size:16pt;line-height:18.1pt}
.dp th,.dp td{border:.75pt solid #000;padding:1pt 1.4mm 0;vertical-align:top;font-weight:400}.dp th{font-weight:700;text-align:center;vertical-align:middle}.dp th.r{text-align:right}
.dp thead{display:table-header-group}.dp tr{break-inside:avoid;page-break-inside:avoid}
.dp .sg{margin-left:6.35cm;text-align:center}.dp .keep{break-inside:avoid;page-break-inside:avoid;padding-top:6pt}.dp p,.dp .h2,.dp .mh,.dp .cl{padding-top:.01pt}
.dp .cm{margin-top:26pt}.dp .two{display:grid;grid-template-columns:1fr 1fr;text-align:center;margin-top:26pt}
.dp .en{width:max-content;min-width:8.2cm;max-width:10.5cm;margin-top:14pt;padding:0}
.dp .tail.cmp,.cmp .tail{display:grid;grid-template-columns:max-content minmax(0,1fr);column-gap:.3cm;align-items:start}
.cmp .tail .en{grid-column:1;grid-row:1;width:auto;margin-top:6pt}.cmp .tail .tsig{grid-column:2;grid-row:1}
.cmp .tail .sg{margin-left:0}.cmp .tail .cm{margin-top:6pt}.cmp .tail .two{grid-template-columns:1fr;margin-top:14pt;row-gap:14pt}
.cmp .fn{margin-top:10pt}.cmp .tail .d2{display:none}.cmp .tail .en{max-width:8.6cm}
.tight .in{margin-top:0!important}.tight .cm{margin-top:12pt}.tight .two{margin-top:12pt}.tight .keep{padding-top:2pt}.tight .en p.c[style]{margin-top:22pt!important}.tight .sg[style]{margin-top:20pt!important}.dp .j{text-align:justify;text-justify:inter-character}
.dp .cb{text-indent:0;display:inline-block;width:10pt;height:10pt;border:1pt solid #000;margin-right:7pt;vertical-align:-1pt;position:relative}
.dp .cb.on::after{content:'';position:absolute;left:2.5pt;top:-1pt;width:3.5pt;height:7.5pt;border:solid #000;border-width:0 1.6pt 1.6pt 0;transform:rotate(40deg)}
.dp .ck{display:grid;grid-template-columns:5.9cm minmax(0,1fr);padding-left:2.25cm;row-gap:5pt;margin:4pt 0}.dp .ck span{display:flex;align-items:flex-start}.dp .ck .cb,.dp .at .nw .cb{flex:none;margin-top:4pt}.dp .at p{margin-bottom:3pt}.dp .at{padding-left:2.4cm}.dp .at .s{padding-left:1.2cm}.dp .at .nw{display:flex;align-items:flex-start}
.dp .fn{margin-top:56pt;text-align:right;font-size:12pt;line-height:16pt}
.dp .dt{display:flex;white-space:nowrap}.dp .dt i{flex:1;border-bottom:1.3pt dotted #000;margin:0 2pt 5pt;font-style:normal}`;

  /* แปลงเลขอารบิกในข้อความ (ไม่แตะแท็ก) เป็นเลขไทย แบบ TH SarabunIT๙ */
  const thaiDigits = html => html.replace(/(^|>)([^<]+)/g, (m, a, t) => a + t.replace(/\d/g, x => '๐๑๒๓๔๕๖๗๘๙'[x]));
  function html(ids, ctx) {
    return ids.map(id => docs(id, ctx).map(p => `<section class="pg">${thaiDigits(p)}</section>`).join('')).join('');
  }
  function print(ids, ctx, title, fontDir) {
    const w = window.open('', '_blank');
    if (!w) return false;
    const css = CSS.replace(/FONTDIR/g, fontDir || (location.origin + '/asset/fonts'));
    w.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><title>${esc(title || 'เอกสารจำหน่ายทรัพย์สิน')}</title><style>${css}
body{margin:0;background:#888}.dp{width:210mm;margin:0 auto}.scr .pg{background:#fff;padding:15mm 20mm 20mm 30mm;min-height:297mm;margin:10px 0;box-shadow:0 2px 8px rgba(0,0,0,.4)}
.bar{position:fixed;top:8px;right:8px;font:14px system-ui;display:flex;gap:8px;align-items:center}.bar .tip{background:#fff;color:#333;padding:6px 10px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.3);max-width:360px;font-size:12.5px}.bar button{font:inherit;padding:8px 16px;border-radius:8px;border:0;background:#6a1b74;color:#fff}
@media print{body{background:#fff}.dp{width:auto;margin:0}.bar{display:none}.scr .pg{padding:0;margin:0;min-height:0;box-shadow:none}}</style></head>
<body><div class="bar"><span class="tip">ตั้งค่าพิมพ์: กระดาษ A4 · มาตราส่วน 100% (ค่าเริ่มต้น) · ระยะขอบ ค่าเริ่มต้น · ปิด “ส่วนหัวและท้ายกระดาษ”</span><button onclick="print()">พิมพ์</button></div><div class="dp scr">${html(ids, ctx)}</div><script>function fit(){var H=262*96/25.4;[].forEach.call(document.querySelectorAll('.pg'),function(p){var h=function(){var a=p.firstElementChild,b=p.lastElementChild;return b.getBoundingClientRect().bottom-a.getBoundingClientRect().top};if(h()>H){p.classList.add('cmp');if(h()>H)p.classList.add('tight');}});}
(document.fonts?document.fonts.ready:Promise.resolve()).then(function(){fit();window.__fit=1;setTimeout(function(){try{print()}catch(e){}},300);});</script></body></html>`);
    w.document.close();
    try { w.focus(); } catch (e) {}
    return true;
  }
  window.DOCS = { STEPS, FIELDS, OFFICE, defaults, html, print, CSS, bahtText, money, thLong, mid };
})();
