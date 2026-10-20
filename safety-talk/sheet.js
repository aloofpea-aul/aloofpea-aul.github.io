/* sheet.js — วาดรายงาน/ข่าว Safety Talk ขนาด A4 (1240×1754) ลง canvas
 * รูปไม่ถูกบีบหรือยืด:
 *   แบบ A "ตามสัดส่วนจริง" — จัดแถวให้เต็มความกว้าง รูปทุกใบคงสัดส่วนเดิม ไม่ตัดขอบ
 *   แบบ B "กรอบเท่ากัน"    — ทุกช่องสัดส่วน 4:3 รูปวางเต็มรูปในกรอบ ช่องว่างเติมด้วยรูปเดียวกันแบบเบลอ
 * ไม่ใช้ ctx.textAlign (บางเครื่องไม่ทำงาน) — คำนวณตำแหน่งข้อความเอง
 */
(function () {
  'use strict';
  const W = 1240, H = 1754, M = 64, G = '#1B5E20', INK = '#141A15';
  const FONT = '"Sarabun","Noto Sans Thai",sans-serif';
  const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const pd = ymd => { const p = String(ymd).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const thLong = ymd => { const d = pd(ymd); return DAYS[d.getDay()] + 'ที่ ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' พ.ศ.' + (d.getFullYear() + 543); };

  const f = (w, px) => w + ' ' + px + 'px ' + FONT;
  function T(ctx, s, x, y, align) {
    s = String(s);
    const w = ctx.measureText(s).width;
    ctx.fillText(s, align === 'center' ? x - w / 2 : align === 'right' ? x - w : x, y);
    return w;
  }
  const seg = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('th', { granularity: 'word' }) : null;
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text || '').split('\n').forEach(par => {
      const parts = seg ? Array.from(seg.segment(par), x => x.segment) : par.split('');
      let line = '';
      parts.forEach(w => {
        if (ctx.measureText(line + w).width > maxW && line) {
          if (ctx.measureText(w).width > maxW) { for (const ch of w) { if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; } }
          else { out.push(line.trimEnd()); line = w.trimStart(); }
        } else line += w;
      });
      out.push(line);
    });
    return out;
  }
  function textBlock(ctx, text, x, y, maxW, lh, maxLines) {
    let lines = wrap(ctx, text, maxW);
    if (maxLines && lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
    return y + lines.length * lh;
  }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function chip(ctx, text, x, y) {         // ป้ายใต้รูป (มุมซ้ายล่าง)
    if (!text) return;
    ctx.font = f(600, 22); const w = ctx.measureText(text).width + 18;
    ctx.fillStyle = 'rgba(255,255,255,.92)'; rr(ctx, x + 8, y - 40, w, 32, 6); ctx.fill();
    ctx.fillStyle = INK; T(ctx, text, x + 17, y - 17);
  }
  /* เบลอแบบใช้ได้ทุกเบราว์เซอร์: ย่อรูปให้เล็กมากแล้วขยายกลับ */
  const blurCache = new WeakMap();
  function blurred(img) {
    if (blurCache.has(img)) return blurCache.get(img);
    const s = document.createElement('canvas'); s.width = 24; s.height = Math.max(1, Math.round(24 * img.height / img.width));
    s.getContext('2d').drawImage(img, 0, 0, s.width, s.height);
    blurCache.set(img, s); return s;
  }
  /* วางรูปเต็มรูปในกรอบ (ไม่ตัด ไม่บีบ) ช่องว่างเติมรูปเดียวกันแบบเบลอ */
  function fit(ctx, img, x, y, w, h, r) {
    ctx.save(); rr(ctx, x, y, w, h, r || 8); ctx.clip();
    if (!img) { ctx.fillStyle = '#DDE7DA'; ctx.fillRect(x, y, w, h); ctx.restore(); return { x, y, w, h }; }
    const ir = img.width / img.height, fr = w / h;
    let dw = w, dh = h;
    if (Math.abs(ir - fr) > 0.01) {
      const b = blurred(img), k = Math.max(w / b.width, h / b.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(b, x + (w - b.width * k) / 2, y + (h - b.height * k) / 2, b.width * k, b.height * k);
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y, w, h);
      if (ir > fr) dh = w / ir; else dw = h * ir;
    }
    const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
    return { x: dx, y: dy, w: dw, h: dh };
  }

  /* ---------- จัดวางรูป ---------- */
  const PARTS = { 0: [[]], 1: [[1]], 2: [[2], [1, 1]], 3: [[3], [2, 1], [1, 2]], 4: [[2, 2], [4], [3, 1], [1, 3]], 5: [[3, 2], [2, 3], [5], [4, 1]], 6: [[3, 3], [2, 2, 2], [4, 2], [2, 4]] };
  // แบบ A: แถวกว้างเต็ม รูปทุกใบคงสัดส่วน — ลองหลายแบบการแบ่งแถว เลือกแบบที่เต็มหน้าที่สุด
  function layoutA(imgs, x, y, w, h, gap) {
    const ratio = im => im ? Math.max(0.5, Math.min(2.4, im.width / im.height)) : 4 / 3;
    const rest = imgs.slice(1, 7), heroNat = w / ratio(imgs[0]);
    let best = null;
    (PARTS[rest.length] || [[]]).forEach(part => {
      const rows = []; let k = 0;
      part.forEach(n => { rows.push(rest.slice(k, k + n).map((im, j) => ({ im, i: 1 + k + j }))); k += n; });
      let rowsH = rows.map(r => (w - gap * (r.length - 1)) / r.reduce((a, c) => a + ratio(c.im), 0));
      const natRest = rowsH.reduce((a, b) => a + b, 0) + gap * rows.length;
      let heroH = Math.min(heroNat, Math.max(h * 0.4, h - natRest)), scale = 1;
      if (heroH + natRest > h) { scale = (h - heroH - gap * rows.length) / (natRest - gap * rows.length); rowsH = rowsH.map(v => v * scale); }
      const restH = rowsH.reduce((a, b) => a + b, 0) + gap * rows.length;
      // คะแนน: ใช้พื้นที่ได้มาก + รูปใหญ่ไม่ต้องเติมขอบมาก + แถวไม่หด + ไม่มีรูปเล็กเกินไป
      const fill = (heroH + restH) / h, heroCover = heroH / heroNat, minH = Math.min(heroH, ...rowsH.concat([h]));
      const score = fill * 2 + Math.min(1, heroCover) + scale * 2 + Math.min(1, minH / 200) - (heroNat > heroH + 1 ? (1 - heroCover) : 0);
      if (!best || score > best.score) best = { score, rows, rowsH, heroH, restH };
    });
    const out = [{ i: 0, x, y, w, h: best.heroH, fit: heroNat > best.heroH + 1 }];
    let yy = y + best.heroH + gap;
    best.rows.forEach((r, ri) => {
      const rh = best.rowsH[ri], ws = r.map(c => rh * ratio(c.im));
      let xx = x + (w - (ws.reduce((a, b) => a + b, 0) + gap * (r.length - 1))) / 2;
      r.forEach((c, j) => { out.push({ i: c.i, x: xx, y: yy, w: ws[j], h: rh }); xx += ws[j] + gap; });
      yy += rh + gap;
    });
    return { boxes: out, used: yy - gap - y };
  }
  // แบบ B: ทุกช่อง 4:3 — ลองหลายรูปแบบ (แถว 1–4 รูป หรือบล็อกรูปใหญ่ + 2 รูปซ้อน) เลือกแบบที่รูปใหญ่และเต็มหน้าที่สุด
  const PLANS_B = {
    1: [[1]], 2: [[2], [1, 1]], 3: [['B'], [1, 2], [3]], 4: [[1, 3], [2, 2], ['B', 1]],
    5: [['B', 2], [1, 4], [2, 3], [1, 2, 2]], 6: [['B', 3], [2, 2, 2], [1, 2, 3], [3, 3]],
    7: [['B', 4], ['B', 2, 2], [1, 3, 3], [3, 2, 2], [1, 2, 4]]
  };
  function layoutB(imgs, x, y, w, h, gap) {
    const n = Math.max(1, Math.min(imgs.length, 7)), R = 3 / 4;
    function build(plan, x0, ww) {
      const out = []; let yy = y, i = 0;
      plan.forEach((r, ri) => {
        if (ri) yy += gap;
        if (r === 'B') {
          const ws = (ww - gap - gap / R) / 3, wh = ww - gap - ws;
          out.push({ i: i++, x: x0, y: yy, w: wh, h: wh * R });
          out.push({ i: i++, x: x0 + wh + gap, y: yy, w: ws, h: ws * R });
          out.push({ i: i++, x: x0 + wh + gap, y: yy + ws * R + gap, w: ws, h: ws * R });
          yy += wh * R;
        } else {
          const cw = (ww - gap * (r - 1)) / r;
          for (let j = 0; j < r; j++) out.push({ i: i++, x: x0 + j * (cw + gap), y: yy, w: cw, h: cw * R });
          yy += cw * R;
        }
      });
      return { boxes: out, used: yy - y };
    }
    let best = null;
    PLANS_B[n].forEach((plan, pi) => {
      let L = build(plan, x, w), k = 1;
      if (L.used > h) { k = h / L.used; const nw = w * k; L = build(plan, x + (w - nw) / 2, nw); }
      const minW = Math.min(...L.boxes.map(b => b.w)), heroArea = L.boxes[0].w * L.boxes[0].h;
      // คะแนน: เต็มหน้า + รูปเล็กสุดไม่เล็กเกิน + รูปแรกเด่น + ไม่ต้องย่อจนเหลือขอบข้างมาก
      const score = (L.used / h) * 3 + Math.min(1, minW / 360) * 1.5 + Math.min(1, heroArea / (w * w * 0.4)) + (k < 0.7 ? -3 : -(1 - k) * 4) - pi * 0.05;
      if (!best || score > best.score) best = Object.assign(L, { score });
    });
    return best;
  }
  /* เติมเต็มกรอบโดยคงสัดส่วน (ไม่บีบ) — ส่วนเกินตัดออก เน้นเก็บช่วงบนของภาพแนวตั้ง */
  function cover(ctx, img, x, y, w, h, r) {
    ctx.save(); rr(ctx, x, y, w, h, r || 8); ctx.clip();
    if (!img) { ctx.fillStyle = '#DDE7DA'; ctx.fillRect(x, y, w, h); }
    else {
      const k = Math.max(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k;
      const fy = img.height > img.width ? 0.3 : 0.5;            // แนวตั้ง: เก็บส่วนบน (หน้า/หมวก)
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) * fy, dw, dh);
    }
    ctx.restore();
  }
  function drawPhotos(ctx, imgs, tags, x, y, w, h, layout) {
    const L = (layout === 'B' ? layoutB : layoutA)(imgs, x, y, w, h, 14);
    L.boxes.forEach(b => {
      if (layout === 'B') cover(ctx, imgs[b.i], b.x, b.y, b.w, b.h, 8); else fit(ctx, imgs[b.i], b.x, b.y, b.w, b.h, 8);
      chip(ctx, tags[b.i], b.x, b.y + b.h);
    });
    return L.used;
  }

  /* ---------- แถบตัวเลขแบบเล็ก ---------- */
  function stats(ctx, items, total, x, y, w) {
    const h = 60;
    ctx.fillStyle = '#EEF5EC'; rr(ctx, x, y, w, h, 12); ctx.fill();
    ctx.font = f(700, 26); const totTxt = 'รวม ' + total + ' คน'; const tw = ctx.measureText(totTxt).width + 36;
    ctx.fillStyle = G; rr(ctx, x + w - tw - 8, y + 8, tw, h - 16, 10); ctx.fill();
    ctx.fillStyle = '#fff'; T(ctx, totTxt, x + w - 8 - tw / 2, y + 40, 'center');
    const cellW = (w - tw - 24) / items.length;
    items.forEach((it, i) => {
      const cx = x + 12 + cellW * i + cellW / 2;
      ctx.font = f(400, 22); const lw = ctx.measureText(it[0] + ' ').width;
      ctx.font = f(700, 28); const nw = ctx.measureText(String(it[1])).width;
      let sx = cx - (lw + nw) / 2;
      ctx.fillStyle = '#4A5A4D'; ctx.font = f(400, 22); T(ctx, it[0] + ' ', sx, y + 39);
      ctx.fillStyle = INK; ctx.font = f(700, 28); T(ctx, it[1], sx + lw, y + 40);
      if (i) { ctx.fillStyle = '#C9D6C5'; ctx.fillRect(x + 12 + cellW * i, y + 16, 2, h - 32); }
    });
    return h;
  }

  /* ---------- รายงาน ---------- */
  async function draw(cv, d, opt) {
    opt = opt || {};
    const kind = opt.kind || 'report', layout = opt.layout || 'A';
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    try { await Promise.all(['400 30px Sarabun', '600 30px Sarabun', '700 30px Sarabun', '800 30px Sarabun'].map(x => document.fonts.load(x))); } catch (e) {}
    const imgs = await Promise.all(d.images.map(i => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = i.data; })));
    const tags = d.images.map(i => i.tag);
    const s = d.session, c = d.counts, cc = Number(s.contractorCount) || 0, total = c.present + cc;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.textBaseline = 'alphabetic';
    const statItems = [['พนักงาน', c.staff], ['ลูกจ้าง', c.hired], ['ผู้รับจ้าง', cc], ['ติดภารกิจ/ลา', c.duty + c.leave]];
    let y;
    if (kind === 'report') {
      ctx.fillStyle = G; ctx.fillRect(0, 0, W, 150);
      ctx.fillStyle = '#fff'; ctx.font = f(700, 48); T(ctx, 'รายงานกิจกรรม SAFETY TALK', M, 82);
      ctx.fillStyle = '#D7EAD3'; ctx.font = f(400, 26); T(ctx, d.org + ' · กฟต.2', M, 124);
      ctx.fillStyle = '#F2A900'; rr(ctx, W - M - 160, 34, 160, 84, 14); ctx.fill();
      ctx.fillStyle = '#1F1A00'; ctx.font = f(700, 22); T(ctx, 'ครั้งที่', W - M - 80, 66, 'center');
      ctx.font = f(800, 32); T(ctx, s.seq + '/' + (+s.date.slice(0, 4) + 543), W - M - 80, 104, 'center');
      ctx.fillStyle = INK;
      const info = [['วันที่', thLong(s.date)], ['เวลา', s.time + ' น. · ' + s.place], ['นำโดย', s.leadBy ? s.leadBy + ' ' + (s.leadByPos || '') : '-'], ['ผู้นำออกกำลังกาย', s.leaderDept]];
      info.forEach((r, i) => {
        const x = M + (i % 2) * 560, yy = 196 + Math.floor(i / 2) * 40;
        ctx.font = f(700, 25); const lw = T(ctx, r[0] + ' ', x, yy);
        ctx.font = f(400, 25); textBlock(ctx, r[1], x + lw, yy, 540 - lw, 32, 1);
      });
      ctx.fillStyle = '#D6E0D2'; ctx.fillRect(M, 252, W - 2 * M, 2);
      // ส่วนล่าง: สาระสำคัญ + แถบตัวเลข + คำขวัญ
      ctx.font = f(400, 24);
      const pts = [];
      if (s.topic) pts.push('• ' + s.topic);
      if (s.speaker || s.emphasis) pts.push('• ' + (s.speaker ? s.speaker + ' ' + (s.speakerPos || '') + ' ' : '') + 'เน้นย้ำ ' + (s.emphasis || ''));
      pts.push('• ' + s.leaderDept + 'นำออกกำลังกาย (WARM UP) และกล่าวคำขวัญความปลอดภัยพร้อมกัน');
      const ptLines = pts.reduce((a, p) => a + Math.min(2, wrap(ctx, p, W - 2 * M).length), 0);
      const bottomH = 44 + ptLines * 34 + 22 + 60 + 70;
      const photoTop = 272, photoH = H - bottomH - photoTop - 16;
      const used = drawPhotos(ctx, imgs, tags, M, photoTop, W - 2 * M, photoH, layout);
      y = photoTop + used + 34;
      ctx.fillStyle = G; ctx.font = f(700, 28); T(ctx, 'สาระสำคัญ', M, y + 4); y += 40;
      ctx.fillStyle = INK; ctx.font = f(400, 24);
      pts.forEach(p => { y = textBlock(ctx, p, M, y, W - 2 * M, 34, 2); });
      y = Math.max(y + 10, H - 70 - 60 - 14);
      stats(ctx, statItems, total, M, y, W - 2 * M);
      ctx.fillStyle = G; ctx.font = f(700, 22); T(ctx, '“' + d.slogan + '”', M, H - 34);
      ctx.fillStyle = '#4A5A4D'; ctx.font = f(400, 20); T(ctx, 'ภาพ/ข่าว ประชาสัมพันธ์ ' + d.orgShort, W - M, H - 34, 'right');
    } else {
      ctx.fillStyle = G; ctx.fillRect(0, 0, W, 210);
      ctx.fillStyle = '#D7EAD3'; ctx.font = f(400, 24); T(ctx, 'ภาพ/ข่าว ประชาสัมพันธ์ · ' + d.orgShort, M, 56);
      ctx.fillStyle = '#fff'; ctx.font = f(800, 88); T(ctx, 'SAFETY TALK', M, 140);
      ctx.font = f(400, 28); T(ctx, thLong(s.date) + ' · ' + s.time + ' น.', M, 186);
      ctx.font = f(700, 34);
      const head = (s.leadByPos || 'ผจก.' + d.orgShort) + ' นำพนักงาน ลูกจ้าง' + (cc ? ' และผู้รับจ้าง' : '') + ' ร่วมกิจกรรมพูดคุยด้านความปลอดภัย';
      const body = (s.leadBy ? s.leadBy + ' ' + (s.leadByPos || '') + ' ' : '') + (s.topic ? s.topic + ' ' : '') + (s.speaker ? 'โดย ' + s.speaker + ' ' + (s.speakerPos || '') + ' ' : '') + (s.emphasis ? 'เน้นย้ำ ' + s.emphasis + ' ' : '') + 'จากนั้น' + s.leaderDept + 'นำออกกำลังกาย (WARM UP) และกล่าวคำขวัญความปลอดภัยพร้อมกัน';
      const hl = Math.min(2, wrap(ctx, head, W - 2 * M).length); ctx.font = f(400, 26);
      const bl = Math.min(3, wrap(ctx, body, W - 2 * M).length);
      const textH = hl * 46 + bl * 36 + 30;
      const photoTop = 236, photoH = H - 96 - 60 - 24 - textH - 40 - photoTop;
      const used = drawPhotos(ctx, imgs, tags, M, photoTop, W - 2 * M, photoH, layout);
      y = photoTop + used + 46;
      ctx.fillStyle = G; ctx.font = f(700, 34); y = textBlock(ctx, head, M, y, W - 2 * M, 46, 2) + 4;
      ctx.fillStyle = INK; ctx.font = f(400, 26); y = textBlock(ctx, body, M, y, W - 2 * M, 36, 3) + 12;
      y = Math.max(y, H - 96 - 60 - 24);
      stats(ctx, statItems, total, M, y, W - 2 * M);
      ctx.fillStyle = '#F2A900'; ctx.fillRect(0, H - 90, W, 90);
      ctx.fillStyle = '#1F1A00'; ctx.font = f(700, 28); T(ctx, '“' + d.slogan + '”', W / 2, H - 36, 'center');
    }
  }
  window.STSheet = { draw: draw, MAX: 7 };
})();
