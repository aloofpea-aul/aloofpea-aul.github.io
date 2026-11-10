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
async function ocPage(){
  const a=ntAuth(); if(!a){ toast('ล็อกอินศูนย์รวมงาน หรือใส่ PIN ก่อน'); return; }
  let D=null, f='rep', hrs=24, err='';
  const load=async()=>{ try{ D=await apiPost(Object.assign({action:'ocList',hours:hrs},a)); err=''; }catch(e){ err=e.message; } if(!S.sld||!S.sld.dev.length) await sldData().catch(()=>{}); await loadNotices().catch(()=>{}); };
  const LV={sure:['ตรงรูปแบบแจ้งเหตุ','r'],maybe:['ไม่แน่ใจ','y'],back:['แจ้งไฟมาแล้ว','g'],no:['ข้อความทั่วไป','x'],staff:['เจ้าหน้าที่','b']};
  const eff=r=>/^yes/.test(r.fix)?'sure':/^no/.test(r.fix)?'no':r.lv;
  const draw=()=>{ const R=(D&&D.rows)||[], cnt=k=>R.filter(r=>eff(r)===k).length;
    // รวมข้อความคนเดียวกันภายใน 2 ชม. เป็นการ์ดเดียว
    const groups=[]; R.forEach(r=>{ const g=groups.find(x=>x.s===r.s&&r.s&&Math.abs(Date.parse(x.rows[0].at.replace(' ','T'))-Date.parse(r.at.replace(' ','T')))<2*3600e3); if(g) g.rows.push(r); else groups.push({s:r.s,rows:[r]}); });
    groups.forEach(g=>{ const ls=g.rows.map(eff); g.lv=ls.includes('sure')?'sure':ls.includes('maybe')?'maybe':ls.includes('back')?'back':ls.includes('staff')?'staff':'no'; });
    const show=groups.filter(g=>f==='all'||(f==='rep'?g.lv==='sure'||g.lv==='maybe':g.lv===f));
    const card=(g,i)=>{ const pl=ocPlace(g.rows.map(r=>r.x).join(' ')), nt=pl&&ocInPlan(pl.ids), tr=pl&&pl.ids.length&&S.sld.byId?S.sld.byId[pl.ids[0]]:null;
      return `<div class="oc-card ${g.lv}"><div class="oc-hd"><span class="oc-tag ${LV[g.lv][1]}">${LV[g.lv][0]}</span><b>${esc(g.s||'(ไม่ทราบชื่อ)')}</b><span class="muted">${esc(g.rows[g.rows.length-1].at.slice(11))}${g.rows.length>1?'–'+esc(g.rows[0].at.slice(11))+' · '+g.rows.length+' ข้อความ':''}</span></div>
        ${g.rows.slice().reverse().map(r=>`<div class="oc-q">${esc(r.x)}${r.why?`<small>ตรง “${esc(r.why)}”</small>`:''}${r.fix?`<small class="fx">ป้ายแก้: ${/^yes/.test(r.fix)?'เป็นการแจ้ง':'ไม่ใช่'} (${esc(r.fix.split('·')[1]||'')})</small>`:''}</div>`).join('')}
        ${pl?`<div class="oc-pl">📍 ${pl.name?'<b>'+esc(pl.name)+'</b>':''}${pl.moo?' ม.'+esc(pl.moo):''}${tr?(tr[1]==='TRANSFORMER'?ntChainHtml(tr[0],1,null):`<span class="nt-chn"><a>${esc(DEV_TH[tr[1]]||tr[1])} ${esc(tr[0])}</a>${ntUpSw(tr[0],2).map(w=>`<i>›</i><a>แยก ${esc(w[0])}</a>`).join('')}<i>›</i><b>${esc(tr[4])}</b></span>`):''}${pl&&pl.ids.length>1?`<span class="muted" style="font-size:11.5px"> · ชื่อนี้มี ${pl.ids.length} จุดใน SLD</span>`:''}</div>`:''}
        ${nt?`<div class="oc-plan">📢 อยู่ในประกาศงดจ่ายไฟ ${esc(ntHm(nt.startAt))}–${esc(ntHm(nt.endAt))} · ${esc(ntArea(nt))}</div>`:''}
        ${g.lv!=='staff'?`<div class="oc-bt"><button type="button" class="btn ghost sm" data-fx="yes" data-g="${i}">✓ เป็นการแจ้ง</button><button type="button" class="btn ghost sm" data-fx="no" data-g="${i}">✗ ไม่ใช่</button><span class="muted oc-soon">เปิดเป็นงาน · ใช้ได้เมื่อเปิดโหมดใช้งานจริง</span></div>`:''}</div>`; };
    ntSheet('💬 ข้อความ OpenChat',`<div id="ocP">
      <div class="oc-st">${err?`<div class="err">${esc(err)}</div>`:''}<b>${hrs} ชม.ล่าสุด</b> · รับ ${R.length} ข้อความ · <span class="oc-tag r">แจ้งเหตุ ${cnt('sure')}</span> <span class="oc-tag y">ไม่แน่ใจ ${cnt('maybe')}</span> <span class="oc-tag g">ไฟมาแล้ว ${cnt('back')}</span> <span class="oc-tag b">เจ้าหน้าที่ ${cnt('staff')}</span> <span class="oc-tag x">ทั่วไป ${cnt('no')}</span>
        <div class="muted" style="margin-top:4px">โหมด: <b>${D&&D.mode==='live'?'ใช้งานจริง':'ทดสอบ'}</b> · มือถือรับแจ้งส่งล่าสุด ${esc((D&&D.hb)||'-')} น. · กด ✓/✗ เพื่อบอกว่าระบบคัดถูกไหม (ใช้ปรับรูปแบบ)</div></div>
      <div class="chips">${[['rep','แจ้งเหตุ + ไม่แน่ใจ'],['sure','แจ้งเหตุ'],['maybe','ไม่แน่ใจ'],['back','ไฟมาแล้ว'],['staff','เจ้าหน้าที่'],['all','ทั้งหมด']].map(([k,l])=>`<button type="button" class="ch ${f===k?'on':''}" data-f="${k}">${l}</button>`).join('')}
        ${[6,24,48].map(h=>`<button type="button" class="ch ${hrs===h?'on':''}" data-h="${h}">${h} ชม.</button>`).join('')}<button type="button" class="ch" id="ocRe">↻</button></div>
      ${show.length?show.map(card).join(''):'<div class="muted" style="padding:20px;text-align:center">ไม่มีข้อความ</div>'}</div>`);
    document.querySelectorAll('#ocP [data-f]').forEach(b=>b.onclick=()=>{ f=b.dataset.f; draw(); });
    document.querySelectorAll('#ocP [data-h]').forEach(b=>b.onclick=async()=>{ hrs=+b.dataset.h; await load(); draw(); });
    $('ocRe').onclick=async()=>{ await load(); draw(); toast('อัปเดตแล้ว'); };
    document.querySelectorAll('#ocP [data-fx]').forEach(b=>b.onclick=async()=>{ const g=show[+b.dataset.g]; b.disabled=true;
      try{ for(const r of g.rows){ const cur=/^yes/.test(r.fix)?'yes':/^no/.test(r.fix)?'no':''; const v=cur===b.dataset.fx?'':b.dataset.fx; const j=await apiPost(Object.assign({action:'ocMark',r:r.r,fix:v},a)); r.fix=j.fix; } draw(); }catch(e){ b.disabled=false; toast(e.message); } });
  };
  ntSheet('💬 ข้อความ OpenChat','<div class="muted" style="padding:30px;text-align:center">กำลังโหลดข้อความ…</div>');
  await load(); draw();
}
