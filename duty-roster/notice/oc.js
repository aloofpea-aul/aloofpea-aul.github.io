/* ===================== ข้อความจากห้อง LINE OpenChat (ทดลอง: ดู + ติดป้ายแก้การคัด) ===================== */
let OC_IDX=null;
function ocNormT(s){ return String(s||'').toLowerCase().replace(/[\s.\-_]/g,''); }
// ดัชนีชื่อสถานที่จาก SLD (ชื่อหม้อแปลง/อุปกรณ์) → ใช้จับหมู่บ้านในข้อความ
function ocIdx(){ if(OC_IDX) return OC_IDX; const s=S.sld; if(!s||!s.dev||!s.dev.length) return null; if(!s.byId) ntBelow(s.dev[0][0]);
  const m={}; s.dev.forEach(d=>{ const p=ntPlace(d[3]); if(!p) return; const k=ocNormT(p.replace(/^(หมู่บ้าน|บ้าน|บ\.)\s*/,'').replace(/\(.*?\)/g,'')).replace(/^ม\d+/,''); if(k.length<4) return; (m[k]=m[k]||{name:p,ids:[]}).ids.push(d[0]); });
  OC_IDX=Object.keys(m).sort((a,b)=>b.length-a.length).map(k=>[k,m[k]]); return OC_IDX; }
function ocPlace(txt){ const I=ocIdx(), t=ocNormT(txt), moo=(String(txt).match(/(?:ม\.|หมู่(?:ที่)?)\s*(\d{1,2})/)||[])[1]; let hit=null;
  if(I) for(const [k,v] of I){ if(t.includes(k)){ hit=v; break; } }
  if(!hit&&!moo) return null; const B=S.sld.byId||{}, ids=hit?hit.ids:[], tr=ids.filter(i=>(B[i]||[])[1]==='TRANSFORMER');
  return {name:hit?hit.name:'',ids:tr.length?tr:ids,moo}; }
function ocInPlan(ids){ if(!ids||!ids.length) return null; const td=ntNow().slice(0,10);
  for(const n of (S.nts||[])){ const s=ntState(n); if(!(s==='live'||s==='due'||(n.date===td&&s==='plan'))||!n.dev) continue; const g=ntGeo(n); if(g&&ids.some(i=>g.A[i])) return n; } return null; }
const OC_TKT={home:'ไฟดับทั้งบ้าน',area:'ไฟดับทั้งซอย/หมู่บ้าน',low:'ไฟตก / กระพริบ',danger:'สายขาด / เสาล้ม / ไฟไหม้',other:'อื่น ๆ'};
function ocTkTag(tk){ if(!tk) return ''; const m=/^A-/.test(tk)?['📋 เปิดเป็นงาน '+tk,'g']:/^merge:/.test(tk)?['🔗 รวมกับ '+tk.slice(6),'g']:/^ok/.test(tk)?['✔ รับทราบแล้ว ('+(tk.split('·')[1]||'')+')','b']:['✗ ไม่ใช่การแจ้ง ('+(tk.split('·')[1]||'')+')','x']; return `<span class="oc-tag ${m[1]}">${esc(m[0])}</span>`; }
function ocGuessType(t){ return /สาย.*ขาด|เสา.*ล้ม|ไฟไหม้|ประกาย|ระเบิด/.test(t)?'danger':/ตก|กระพริบ|หรี่|ไม่เต็ม/.test(t)?'low':/ซอย|หมู่บ้าน|ทั้งหมู่|ทั้งตำบล|แถว/.test(t)?'area':'home'; }
async function ocPage(){
  const a=ntAuth(); if(!a){ toast('ล็อกอินศูนย์รวมงาน หรือใส่ PIN ก่อน'); return; }
  let D=null, f='q', hrs=24, err='', TK=[], openG=-1;
  const load=async()=>{ try{ D=await apiPost(Object.assign({action:'ocList',hours:hrs},a)); err=''; }catch(e){ err=e.message; }
    try{ const j=await apiPost(Object.assign({action:'tickets'},a)); TK=(j.tickets||[]).filter(t=>t.st==='new'||t.st==='acc'); }catch(e){ TK=[]; }
    if(!S.sld||!S.sld.dev.length) await sldData().catch(()=>{}); await loadNotices().catch(()=>{}); };
  const LV={sure:['ตรงรูปแบบแจ้งเหตุ','r'],maybe:['ไม่แน่ใจ','y'],back:['แจ้งไฟมาแล้ว','g'],no:['ข้อความทั่วไป','x'],staff:['เจ้าหน้าที่','b']};
  const eff=r=>/^yes/.test(r.fix)?'sure':/^no/.test(r.fix)?'no':r.lv;
  const live=()=>D&&D.mode==='live';
  const draw=()=>{ const R=(D&&D.rows)||[], cnt=k=>R.filter(r=>eff(r)===k).length;
    // รวมข้อความคนเดียวกันภายใน 2 ชม. เป็นการ์ดเดียว
    const groups=[]; R.forEach(r=>{ const g=groups.find(x=>x.s===r.s&&r.s&&!!x.rows[0].q===!!r.q&&Math.abs(Date.parse(x.rows[0].at.replace(' ','T'))-Date.parse(r.at.replace(' ','T')))<2*3600e3); if(g) g.rows.push(r); else groups.push({s:r.s,rows:[r]}); });
    groups.forEach(g=>{ const ls=g.rows.map(eff); g.lv=ls.includes('sure')?'sure':ls.includes('maybe')?'maybe':ls.includes('back')?'back':ls.includes('staff')?'staff':'no'; g.q=g.rows.some(r=>r.q); g.tk=(g.rows.find(r=>r.tk)||{}).tk||''; });
    const nq=groups.filter(g=>g.q).length;
    const show=groups.filter(g=>f==='all'||(f==='q'?g.q:f==='done'?!!g.tk:f==='rep'?g.lv==='sure'||g.lv==='maybe':g.lv===f));
    const card=(g,i)=>{ const txt=g.rows.map(r=>r.x).join(' '), pl=ocPlace(txt), nt=pl&&ocInPlan(pl.ids), tr=pl&&pl.ids.length&&S.sld.byId?S.sld.byId[pl.ids[0]]:null;
      const plTxt=pl?[(pl.name||''),pl.moo?'ม.'+pl.moo:''].filter(Boolean).join(' '):'';
      const form=openG===i?`<div class="oc-open"><div class="oc-ot">📋 เปิดเป็นงานรับแจ้ง</div>
          <label>ประเภท<select id="ocTy">${Object.entries(OC_TKT).map(([k,v])=>`<option value="${k}" ${ocGuessType(txt)===k?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>สถานที่<input id="ocPl" value="${esc(plTxt)}" placeholder="หมู่บ้าน / ซอย / จุดสังเกต"></label>
          <label class="oc-self"><input type="checkbox" id="ocSelf" checked> ฉันรับงานนี้เอง (ไม่ส่งการ์ด LINE / ไม่ปลุกกระดิ่งซ้ำ)</label>
          <div class="oc-bt"><button type="button" class="btn sm" id="ocGo">เปิดงาน</button><button type="button" class="btn ghost sm" id="ocNo">ยกเลิก</button></div></div>`:'';
      const acts=!g.q?(g.tk?`<div class="oc-bt">${ocTkTag(g.tk)}${/^(ok|skip)/.test(g.tk)?`<button type="button" class="btn ghost sm" data-a="undo" data-g="${i}">↺ ย้อนกลับ</button>`:''}</div>`:
          (g.lv!=='staff'?`<div class="oc-bt"><button type="button" class="btn ghost sm" data-fx="yes" data-g="${i}">✓ เป็นการแจ้ง</button><button type="button" class="btn ghost sm" data-fx="no" data-g="${i}">✗ ไม่ใช่</button></div>`:''))
        :`<div class="oc-bt">${live()?`<button type="button" class="btn sm" data-a="open" data-g="${i}">📋 เปิดเป็นงาน</button>${TK.slice(0,3).map(t=>`<button type="button" class="btn ghost sm" data-a="merge" data-ref="${esc(t.id)}" data-g="${i}" title="${esc(t.place||t.detail||'')}">🔗 รวมกับ ${esc(t.id)}</button>`).join('')}`:`<span class="muted oc-soon">เปิดเป็นงานได้เมื่อหัวหน้าเปิดโหมดใช้งานจริง</span>`}
          <button type="button" class="btn ghost sm" data-a="ack" data-g="${i}" title="รู้แล้ว/อยู่ในประกาศ ไม่ต้องเปิดงาน">✔ รับทราบ</button><button type="button" class="btn ghost sm" data-a="skip" data-g="${i}">✗ ไม่ใช่การแจ้ง</button></div>`;
      return `<div class="oc-card ${g.lv}${g.q?' q':''}"><div class="oc-hd"><span class="oc-tag ${LV[g.lv][1]}">${LV[g.lv][0]}</span><b>${esc(g.s||'(ไม่ทราบชื่อ)')}</b><span class="muted">${esc(g.rows[g.rows.length-1].at.slice(11))}${g.rows.length>1?'–'+esc(g.rows[0].at.slice(11))+' · '+g.rows.length+' ข้อความ':''}</span></div>
        ${g.rows.slice().reverse().map(r=>`<div class="oc-q">${esc(r.x)}${r.why?`<small>ตรง “${esc(r.why)}”</small>`:''}</div>`).join('')}
        ${pl?`<div class="oc-pl">📍 ${pl.name?'<b>'+esc(pl.name)+'</b>':''}${pl.moo?' ม.'+esc(pl.moo):''}${tr?(tr[1]==='TRANSFORMER'?ntChainHtml(tr[0],1,null):`<span class="nt-chn"><a>${esc(DEV_TH[tr[1]]||tr[1])} ${esc(tr[0])}</a>${ntUpSw(tr[0],2).map(w=>`<i>›</i><a>แยก ${esc(w[0])}</a>`).join('')}<i>›</i><b>${esc(tr[4])}</b></span>`):''}${pl&&pl.ids.length>1?`<span class="muted" style="font-size:11.5px"> · ชื่อนี้มี ${pl.ids.length} จุดใน SLD</span>`:''}</div>`:''}
        ${nt?`<div class="oc-plan">📢 อยู่ในประกาศงดจ่ายไฟ ${esc(ntHm(nt.startAt))}–${esc(ntHm(nt.endAt))} · ${esc(ntArea(nt))} — กด “รับทราบ” ได้</div>`:''}
        ${acts}${form}</div>`; };
    const md=live()?`<span class="oc-mode on">● ใช้งานจริง</span>`:`<span class="oc-mode">● ทดสอบ</span>`;
    ntSheet('💬 ข้อความ OpenChat',`<div id="ocP">
      <div class="oc-st">${err?`<div class="err">${esc(err)}</div>`:''}<div class="row" style="justify-content:space-between;gap:6px;flex-wrap:wrap"><span>${md} <b>รอตรวจ ${nq}</b> ราย</span>${D&&D.appr?`<button type="button" class="btn ghost sm" id="ocMd">${live()?'กลับโหมดทดสอบ':'เปิดโหมดใช้งานจริง'}</button>`:''}</div>
        <div class="muted" style="margin-top:4px">${live()?`ข้อความแจ้งเหตุ → LINE ถึงพนักงานเวร (${D.hours==='all'?'ตลอดเวลา':'เฉพาะนอกเวลาทำการ'}) · ค้างเกิน ${D.remind} นาที → กล่องหน้าห้องเวรขึ้นจอส้ม`:'โหมดทดสอบ: ยังไม่ส่ง LINE ถึงเวร · เปิดเป็นงานไม่ได้ · กล่องหน้าห้องเวรแสดงจำนวนรอตรวจได้'} · มือถือรับแจ้งส่งล่าสุด ${esc((D&&D.hb)||'-')} น.</div>
        <div style="margin-top:4px">${hrs} ชม. · รับ ${R.length} ข้อความ · <span class="oc-tag r">แจ้งเหตุ ${cnt('sure')}</span> <span class="oc-tag y">ไม่แน่ใจ ${cnt('maybe')}</span> <span class="oc-tag g">ไฟมาแล้ว ${cnt('back')}</span> <span class="oc-tag b">เจ้าหน้าที่ ${cnt('staff')}</span> <span class="oc-tag x">ทั่วไป ${cnt('no')}</span></div>
        ${D&&D.skip&&D.skip.length?`<details class="oc-skip"><summary>🔎 แจ้งเตือนที่มือถือส่งมาแต่ข้าม (ไม่ใช่ห้อง “${esc(D.room||'')}”) ${D.skip.length} รายการล่าสุด</summary>${D.skip.map(x=>`<div>${esc(x[0])} · ${esc(x[1]||'(ไม่มีหัวเรื่อง)')}${x[2]?' · '+esc(x[2]):''}</div>`).join('')}<div class="muted">ถ้าเห็นชื่อห้องที่ถูกต้องแต่สะกดต่างไป → แจ้งผมแก้ชื่อห้องในตั้งค่า</div></details>`:''}</div>
      <div class="chips">${[['q','รอตรวจ '+nq],['done','จัดการแล้ว'],['rep','แจ้งเหตุ + ไม่แน่ใจ'],['back','ไฟมาแล้ว'],['staff','เจ้าหน้าที่'],['all','ทั้งหมด']].map(([k,l])=>`<button type="button" class="ch ${f===k?'on':''}" data-f="${k}">${l}</button>`).join('')}
        ${[6,24,48].map(h=>`<button type="button" class="ch ${hrs===h?'on':''}" data-h="${h}">${h} ชม.</button>`).join('')}<button type="button" class="ch" id="ocRe">↻</button></div>
      ${show.length?show.map(card).join(''):`<div class="muted" style="padding:20px;text-align:center">${f==='q'?'ไม่มีข้อความรอตรวจ 👍 (เก็บไว้ในกล่องรอตรวจ '+((D&&D.qh)||3)+' ชม.)':'ไม่มีข้อความ'}</div>`}</div>`);
    document.querySelectorAll('#ocP [data-f]').forEach(b=>b.onclick=()=>{ f=b.dataset.f; openG=-1; draw(); });
    document.querySelectorAll('#ocP [data-h]').forEach(b=>b.onclick=async()=>{ hrs=+b.dataset.h; await load(); draw(); });
    $('ocRe').onclick=async()=>{ await load(); draw(); toast('อัปเดตแล้ว'); };
    if($('ocMd')) $('ocMd').onclick=async()=>{ const to=live()?'test':'live';
      if(to==='live'&&!confirm('เปิดโหมดใช้งานจริง?\n\n• ข้อความที่ตรงรูปแบบแจ้งเหตุ → LINE ถึงพนักงานเวร (นอกเวลาทำการ ไม่เกิน 1 ครั้ง/10 นาที)\n• กด "เปิดเป็นงาน" ได้ → เข้ารายการรับแจ้ง (นอกเวลา: กระดิ่งปลุก + การ์ด LINE ถึงเวร เว้นแต่ติ๊ก "ฉันรับงานเอง")')) return;
      try{ const j=await apiPost(Object.assign({action:'ocMode',mode:to},a)); D.mode=j.mode; D.hours=j.hours; toast(j.mode==='live'?'เปิดโหมดใช้งานจริงแล้ว':'กลับเป็นโหมดทดสอบแล้ว'); draw(); }catch(e){ toast(e.message); } };
    const act=async(b,body)=>{ const g=show[+b.dataset.g]; b.disabled=true;
      try{ const j=await apiPost(Object.assign({action:'ocAct',rows:g.rows.map(r=>r.r)},body,a)); g.rows.forEach(r=>{ r.tk=j.tk; r.q=j.tk?0:1; if(body.a==='skip') r.fix='no·'; else if(body.a!=='undo'&&!/^yes/.test(r.fix)) r.fix='yes·'; });
        openG=-1; if(j.ticket) toast('เปิดงาน '+j.ticket.id+(j.ticket.st==='acc'?' · รับงานแล้ว':' · ส่งถึงเวรแล้ว')); else toast(body.a==='merge'?'รวมกับ '+body.ref+' แล้ว':body.a==='undo'?'ย้อนกลับแล้ว':'บันทึกแล้ว');
        if(body.a==='open'||body.a==='merge') await load(); draw(); }catch(e){ b.disabled=false; toast(e.message); } };
    document.querySelectorAll('#ocP [data-a]').forEach(b=>b.onclick=()=>{ const x=b.dataset.a;
      if(x==='open'){ openG=+b.dataset.g; draw(); const el=document.querySelector('.oc-open'); if(el) el.scrollIntoView({block:'nearest'}); return; }
      if(x==='merge'&&!confirm('รวมข้อความนี้เข้ากับงาน '+b.dataset.ref+' ?')) return;
      act(b,{a:x,ref:b.dataset.ref||''}); });
    if($('ocGo')) $('ocGo').onclick=()=>{ const b=$('ocGo'); b.dataset.g=openG; act(b,{a:'open',type:$('ocTy').value,place:$('ocPl').value.trim(),self:$('ocSelf').checked?1:0}); };
    if($('ocNo')) $('ocNo').onclick=()=>{ openG=-1; draw(); };
    document.querySelectorAll('#ocP [data-fx]').forEach(b=>b.onclick=async()=>{ const g=show[+b.dataset.g]; b.disabled=true;
      try{ for(const r of g.rows){ const cur=/^yes/.test(r.fix)?'yes':/^no/.test(r.fix)?'no':''; const v=cur===b.dataset.fx?'':b.dataset.fx; const j=await apiPost(Object.assign({action:'ocMark',r:r.r,fix:v},a)); r.fix=j.fix; } draw(); }catch(e){ b.disabled=false; toast(e.message); } });
  };
  ntSheet('💬 ข้อความ OpenChat','<div class="muted" style="padding:30px;text-align:center">กำลังโหลดข้อความ…</div>');
  await load(); draw();
}
