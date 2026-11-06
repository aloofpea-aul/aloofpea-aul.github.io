/* CCL — เสาในงานนี้ (ขั้นที่ 1 ระบบเสา)
   แท็บ "วัสดุ" ในรายละเอียดงาน: สรุปเลขเสาที่ผู้รับจ้างบันทึก เทียบกับจำนวนเสาตามแบบงาน
   ใช้ข้อมูลเดิมจาก getMaterialData (คอลัมน์วัสดุผู้รับจ้าง) ไม่แก้ระบบหลังบ้าน */
(function () {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(s) { var m = String(s || '').match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : null; }
  function sizeKey(s) { var n = num(s); return n == null ? String(s || '').trim() || 'ไม่ระบุขนาด' : (Math.round(n * 100) / 100) + ' ม.'; }
  function job(id) { try { return (allData || []).find(function (j) { return String(j.id) === String(id); }); } catch (e) { return null; } }

  // เสาตามแบบงาน เช่น "8 เมตร (4 ต้น), 9 เมตร (1 ต้น)"
  function planned(j) {
    var out = {}, tot = 0;
    String((j && j.poleRaw) || '').split(',').forEach(function (s) {
      var m = s.trim().match(/^(.+?)\s*\((\d+)\s*ต้น\)/); if (!m) return;
      var k = sizeKey(m[1]), q = parseInt(m[2], 10) || 0; out[k] = (out[k] || 0) + q; tot += q;
    });
    return { by: out, total: tot };
  }

  // รวมเสาทุกครั้งที่ผู้รับจ้างบันทึก ต้นที่เลขซ้ำนับครั้งเดียว (ใช้ข้อมูลล่าสุด)
  function collect(materials) {
    var map = {}, order = [], noNo = 0;
    (materials || []).forEach(function (m, mi) {
      var lastLoc = '';
      (m.poles || []).forEach(function (p) {
        var loc = p.location || lastLoc; if (p.location) lastLoc = p.location;
        var rec = { no: String(p.no || '').trim(), type: p.type || '', size: sizeKey(p.type), pile: loc, lat: p.lat, lng: p.lng, by: m.contractorName || '', co: m.contractorCo || '', ts: m.timestamp, round: mi + 1 };
        if (!rec.no) { noNo++; return; }
        var k = rec.no.toUpperCase();
        if (map[k]) { map[k].dup = (map[k].dup || 1) + 1; if (rec.lat && rec.lng) { map[k].lat = rec.lat; map[k].lng = rec.lng; } }
        else { map[k] = rec; order.push(k); }
      });
    });
    return { poles: order.map(function (k) { return map[k]; }), noNo: noNo };
  }

  function summaryHtml(j, materials) {
    var pl = planned(j), c = collect(materials), poles = c.poles;
    var got = poles.length, gps = poles.filter(function (p) { return p.lat && p.lng; }).length;
    var tot = pl.total, pct = tot ? Math.min(100, Math.round(got / tot * 100)) : (got ? 100 : 0);
    var done = tot && got >= tot;
    var bySize = {}; poles.forEach(function (p) { bySize[p.size] = (bySize[p.size] || 0) + 1; });
    var sizes = Object.keys(pl.by).concat(Object.keys(bySize).filter(function (k) { return !(k in pl.by); }));
    var piles = {}; poles.forEach(function (p) { if (p.pile) piles[p.pile] = (piles[p.pile] || 0) + 1; });

    var h = '<div class="pj-card">' +
      '<div class="pj-top"><div><div class="pj-t">เสาในงานนี้</div>' +
      '<div class="pj-n">ระบุเลขเสาแล้ว <b>' + got + '</b>' + (tot ? ' จาก <b>' + tot + '</b> ต้น' : ' ต้น') + '</div></div>' +
      '<span class="pj-badge ' + (done ? 'ok' : (got ? 'wip' : 'none')) + '">' + (done ? 'ครบ' : (got ? 'ยังไม่ครบ' : 'ยังไม่มีเลขเสา')) + '</span></div>' +
      (tot ? '<div class="pj-bar"><i style="width:' + pct + '%;background:' + (done ? '#16A34A' : '#F57C00') + '"></i></div>' : '');
    if (sizes.length) {
      h += '<div class="pj-sizes">' + sizes.map(function (k) {
        var a = bySize[k] || 0, b = pl.by[k];
        var cls = b == null ? 'x' : (a >= b ? 'ok' : 'wip');
        return '<span class="pj-chip ' + cls + '">เสา ' + esc(k) + ' · ' + a + (b != null ? '/' + b : '') + '</span>';
      }).join('') + '</div>';
    }
    var notes = [];
    if (got) notes.push('<i class="fa-solid fa-location-dot"></i> มีพิกัด ' + gps + '/' + got + ' ต้น');
    if (Object.keys(piles).length) notes.push('<i class="fa-solid fa-cubes-stacked"></i> จาก ' + Object.keys(piles).map(function (k) { return esc(k) + ' (' + piles[k] + ')'; }).join(', '));
    if (c.noNo) notes.push('<span class="pj-warn"><i class="fa-solid fa-triangle-exclamation"></i> ไม่มีเลขเสา ' + c.noNo + ' ต้น</span>');
    var dups = poles.filter(function (p) { return p.dup; });
    if (dups.length) notes.push('<span class="pj-warn"><i class="fa-solid fa-clone"></i> เลขซ้ำ ' + dups.map(function (p) { return esc(p.no); }).join(', ') + '</span>');
    if (notes.length) h += '<div class="pj-notes">' + notes.map(function (n) { return '<div>' + n + '</div>'; }).join('') + '</div>';

    if (got) {
      h += '<div class="pj-list">' + poles.map(function (p, i) {
        var pin = (p.lat && p.lng)
          ? '<a class="pj-pin" target="_blank" href="https://maps.google.com/?q=' + encodeURIComponent(p.lat + ',' + p.lng) + '" title="เปิดแผนที่"><i class="fa-solid fa-location-dot"></i></a>'
          : '<span class="pj-pin off" title="ยังไม่มีพิกัด"><i class="fa-solid fa-location-dot"></i></span>';
        return '<div class="pj-row"><span class="pj-i">' + (i + 1) + '</span><div class="pj-m"><b>' + esc(p.no) + '</b><small>' + esc(p.size) + (p.pile ? ' · ' + esc(p.pile) : '') + (p.lat && p.lng ? ' · ปักแล้ว' : ' · ยังไม่มีพิกัด') + '</small></div>' + pin + '</div>';
      }).join('') + '</div>';
      if (gps) h += '<button type="button" class="pj-mapbtn" onclick="cclPoles.map()"><i class="fa-solid fa-map-location-dot"></i> ดูเสาทั้งหมดบนแผนที่</button>';
    } else if (tot) {
      h += '<div class="pj-empty">ผู้รับจ้างยังไม่ได้บันทึกเลขเสา (ตามแบบงาน ' + tot + ' ต้น)</div>';
    }
    h += '</div>';
    S.poles = poles; S.job = j;
    return h;
  }

  var S = {};
  function historyHtml(materials) {
    if (!materials || !materials.length) return '';
    return '<details class="pj-hist"><summary>ประวัติที่ผู้รับจ้างบันทึก (' + materials.length + ' ครั้ง)</summary>' + materials.map(function (m, idx) {
      var ts = m.timestamp ? new Date(m.timestamp).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      var poles = (m.poles || []).map(function (p) { return esc(p.no || '(ไม่มีเลข)') + (p.type ? ' <small>' + esc(p.type) + '</small>' : ''); }).join(' · ');
      var tr = m.transformer ? '<div class="pj-h-tr"><i class="fa-solid fa-bolt"></i> หม้อแปลง ' + esc(m.transformer.kva) + ' kVA' + (m.transformer.peaNo ? ' · PEA ' + esc(m.transformer.peaNo) : '') + (m.transformer.lat && m.transformer.lng ? ' · <a target="_blank" href="https://maps.google.com/?q=' + encodeURIComponent(m.transformer.lat + ',' + m.transformer.lng) + '">แผนที่</a>' : '') + '</div>' : '';
      var att = (m.attachments && m.attachments.length) ? '<div class="pj-h-att">' + m.attachments.map(function (a) { return '<a target="_blank" href="' + esc(a.fileUrl) + '"><i class="fa-solid fa-paperclip"></i> ' + esc(a.fileName || 'ไฟล์') + '</a>'; }).join('') + '</div>' : '';
      return '<div class="pj-h"><div class="pj-h-hd"><b>ครั้งที่ ' + (idx + 1) + '</b><span>' + ts + '</span></div><div class="pj-h-by">' + esc(m.contractorName || '-') + ' · ' + esc(m.contractorCo || '-') + '</div>' + (poles ? '<div class="pj-h-p">' + poles + '</div>' : '') + tr + att + '</div>';
    }).join('') + '</details>';
  }

  function render(jobId) {
    var el = document.getElementById('materialContent'); if (!el) return;
    el.innerHTML = '<div class="text-center py-6 text-slate-400 text-sm"><div class="spinner mx-auto mb-2"></div>กำลังโหลด...</div>';
    google.script.run.withSuccessHandler(function (materials) {
      var j = job(jobId) || {};
      el.innerHTML = summaryHtml(j, materials) + historyHtml(materials);
    }).withFailureHandler(function () {
      el.innerHTML = '<div class="text-center py-6 text-red-400 text-sm">โหลดข้อมูลไม่สำเร็จ</div>';
    }).getMaterialData(jobId);
  }

  function showMap() {
    var pts = (S.poles || []).filter(function (p) { return p.lat && p.lng && !isNaN(parseFloat(p.lat)) && !isNaN(parseFloat(p.lng)); });
    if (!pts.length || !window.L) return;
    Swal.fire({
      title: 'เสาในงานนี้', html: '<div id="pjMap" style="height:60vh;min-height:300px;border-radius:12px"></div>', width: 720, showConfirmButton: false, showCloseButton: true, returnFocus: false,
      didOpen: function () {
        var m = L.map('pjMap'), b = [];
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
        pts.forEach(function (p, i) {
          var ll = [parseFloat(p.lat), parseFloat(p.lng)]; b.push(ll);
          L.circleMarker(ll, { radius: 9, color: '#0D1B4B', weight: 2, fillColor: '#F57C00', fillOpacity: 0.95 }).addTo(m)
            .bindTooltip(esc(p.no), { permanent: true, direction: 'top', offset: [0, -8], className: 'pj-tip' })
            .bindPopup('<b>' + esc(p.no) + '</b><br>' + esc(p.size) + (p.pile ? '<br>' + esc(p.pile) : ''));
        });
        if (b.length > 1) L.polyline(b, { color: '#0D1B4B', weight: 2, dashArray: '4 4' }).addTo(m);
        if (b.length === 1) m.setView(b[0], 17); else m.fitBounds(b, { padding: [30, 30] });
        setTimeout(function () { m.invalidateSize(); }, 200);
      }
    });
  }

  function css() {
    if (document.getElementById('pjCss')) return;
    var st = document.createElement('style'); st.id = 'pjCss';
    st.textContent =
      '.pj-card{border:1px solid #E2E8F0;border-radius:14px;padding:12px;margin-bottom:12px;background:#fff}' +
      '.pj-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.pj-t{font-weight:700;color:#0f172a;font-size:15px}.pj-n{font-size:13px;color:#475569;margin-top:2px}.pj-n b{color:#0f172a}' +
      '.pj-badge{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}.pj-badge.ok{background:#DCFCE7;color:#166534}.pj-badge.wip{background:#FFEDD5;color:#9A3412}.pj-badge.none{background:#F1F5F9;color:#64748B}' +
      '.pj-bar{height:8px;border-radius:4px;background:#F1F5F9;margin:10px 0 8px;overflow:hidden}.pj-bar i{display:block;height:100%;border-radius:4px}' +
      '.pj-sizes{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.pj-chip{font-size:12px;padding:2px 9px;border-radius:8px;font-weight:600}.pj-chip.ok{background:#DCFCE7;color:#166534}.pj-chip.wip{background:#FFEDD5;color:#9A3412}.pj-chip.x{background:#F1F5F9;color:#475569}' +
      '.pj-notes{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#64748B;margin:6px 0 8px}.pj-notes i{width:14px;text-align:center;margin-right:4px}.pj-warn{color:#B45309}' +
      '.pj-list{border-top:1px solid #F1F5F9}.pj-row{display:flex;align-items:center;gap:10px;padding:8px 2px;border-bottom:1px solid #F1F5F9}.pj-i{width:22px;height:22px;border-radius:50%;background:#F1F5F9;color:#64748B;font-size:11px;display:flex;align-items:center;justify-content:center;flex:none}' +
      '.pj-m{flex:1;min-width:0}.pj-m b{font-size:14px;color:#0f172a}.pj-m small{display:block;font-size:12px;color:#64748B}' +
      '.pj-pin{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#DCFCE7;color:#16A34A;flex:none}.pj-pin.off{background:#F1F5F9;color:#CBD5E1}' +
      '.pj-mapbtn{width:100%;margin-top:10px;min-height:40px;border:0;border-radius:10px;background:#0D1B4B;color:#fff;font-weight:700;font-size:14px;cursor:pointer}' +
      '.pj-empty{font-size:13px;color:#94A3B8;text-align:center;padding:14px 0 4px}' +
      '.pj-hist{border:1px solid #E2E8F0;border-radius:12px;padding:8px 12px;background:#F8FAFC}.pj-hist summary{cursor:pointer;font-size:13px;font-weight:700;color:#475569;padding:4px 0}' +
      '.pj-h{border-top:1px solid #E2E8F0;padding:8px 0;font-size:12px;color:#475569}.pj-h-hd{display:flex;justify-content:space-between}.pj-h-hd span{color:#94A3B8}.pj-h-by{color:#94A3B8;margin:2px 0}.pj-h-p small{color:#94A3B8}.pj-h-tr{margin-top:4px;color:#A16207}.pj-h-att{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}.pj-h-att a{color:#2563EB}' +
      '.pj-tip{background:#0D1B4B;color:#fff;border:0;font-weight:700;font-size:12px;padding:1px 6px}.pj-tip:before{display:none}';
    document.head.appendChild(st);
  }

  // นับเสาไว้บนปุ่มแท็บ "วัสดุ" ทันทีที่เปิดรายละเอียดงาน (จากข้อมูลที่โหลดมาแล้ว ไม่เรียกเซิร์ฟเวอร์เพิ่ม)
  function tabBadge(jobId) {
    var b = document.getElementById('tabMaterial'); if (!b) return;
    var j = job(jobId) || {}, c = collect(Array.isArray(j.contractorMaterials) ? j.contractorMaterials : []).poles.length, t = planned(j).total;
    var s = b.querySelector('.pj-tb'); if (!s) { s = document.createElement('span'); s.className = 'pj-tb'; s.style.cssText = 'margin-left:4px;font-size:10px;padding:0 6px;border-radius:999px;background:rgba(245,124,0,.15);color:#B45309'; b.appendChild(s); }
    s.textContent = (c || t) ? (c + (t ? '/' + t : '')) : ''; s.style.display = (c || t) ? '' : 'none';
  }

  function setup() {
    css();
    window.loadMaterialData = render;
    var od = window.openDetailModal;
    if (typeof od === 'function' && !od.__pj) { var w = function (id) { var r = od.apply(this, arguments); try { tabBadge(id); } catch (e) {} return r; }; w.__pj = true; window.openDetailModal = w; }
    window.cclPoles = { map: showMap, planned: planned, collect: collect };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
