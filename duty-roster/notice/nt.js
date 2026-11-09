/* ======================================================================
   ประกาศงดจ่ายไฟ — แจ้งล่วงหน้า (แนบหนังสือประกาศ) / ดับไฟฉุกเฉิน
   โปสเตอร์สร้างในเบราว์เซอร์ (html2canvas) · QR สร้างจากลิงก์ในตั้งค่า · ไม่มีค่าใช้จ่าย
   ใช้ตัวแปร/ฟังก์ชันกลางจากหน้า index.html (S, $, esc, apiGet, apiPost, toast, msg, hmNorm …)
   ====================================================================== */
const NT_ART={heart:'notice/heart.svg',mascot:'notice/mascot.svg',badge:'notice/badge.svg'};
const NT_RS={
  plan:[['improve','ปรับปรุง ซ่อมแซมระบบจำหน่าย'],['tree','ตัดต้นไม้ใกล้แนวสายไฟ'],['tr','เปลี่ยน/เพิ่มขนาดหม้อแปลง'],['pole','ย้าย/เปลี่ยนเสาไฟฟ้า'],['other','อื่น ๆ']],
  emg:[['tree','ต้นไม้ล้มทับสายไฟ'],['equip','อุปกรณ์ชำรุด เสี่ยงอันตราย'],['fire','ไฟไหม้ / ช่วยเหลือผู้ประสบภัย'],['car','รถชนเสาไฟฟ้า'],['other','อื่น ๆ']]};
const NT_SAY={improve:'ขอปรับปรุงสายไฟ\nให้ไฟนิ่งขึ้นนะครับ 🙏',tree:'ขอตัดต้นไม้ใกล้สายไฟ\nกันไฟดับหน้าฝนครับ 🙏',tr:'ขอเปลี่ยนหม้อแปลงใหม่\nไฟจะได้ไม่ตกครับ 🙏',pole:'ขอปรับเสาไฟให้มั่นคง\nปลอดภัยขึ้นครับ 🙏',other:'ขออภัยในความไม่สะดวก\nนะครับ 🙏',emg:'ขออภัยที่แจ้งกะทันหัน\nรีบแก้ให้เร็วที่สุดครับ 🙏'};
const NT_WD=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'], NT_MS=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function ntCfg(){ let c={}; try{ c=JSON.parse((S.boot&&S.boot.config&&S.boot.config.noticeCfg)||'{}'); }catch(e){}
  return Object.assign({unit:(S.boot&&S.boot.config&&S.boot.config.office)||'กฟส.อ่าวลึก',speaker:'heart',footer:'karst',phone:'0-7566-6925',
    qr:'https://line.me/ti/g2/kG8leDxLn2xEjQPvYMUB3R8BKqXoUhuj_Ocp8w',qrLabel:'ห้องแจ้งไฟฟ้าขัดข้อง',slogan:'ไฟดีทุกบ้าน ใส่ใจทุกครั้ง',sub:'อ.อ่าวลึก จ.กระบี่'},c); }
const ntT=x=>Date.parse(x+':00+07:00');
const ntNow=()=>new Date(Date.now()+7*36e5).toISOString().slice(0,16);
const ntHm=x=>String(x||'').slice(11,16).replace(':','.');
function ntDateTh(ymd,long){ const d=new Date(ymd+'T00:00:00Z'); return (long?NT_WD[d.getUTCDay()]+' ':'')+d.getUTCDate()+' '+NT_MS[d.getUTCMonth()]+' '+String(d.getUTCFullYear()+543).slice(2); }
function ntDaysTo(ymd){ return Math.round((Date.parse(ymd+'T00:00:00Z')-Date.parse(ntNow().slice(0,10)+'T00:00:00Z'))/864e5); }
function ntState(n){ const now=Date.now();
  if(n.status==='cancel') return 'cancel'; if(n.status==='done') return 'done'; if(n.status==='live') return 'live';
  if(n.type==='emg') return 'live'; if(ntT(n.startAt)<=now&&(!n.endAt||ntT(n.endAt)>now)) return 'due'; if(n.endAt&&ntT(n.endAt)<=now) return 'over'; return 'plan'; }
function ntAuth(){ return (typeof tkAuthBody==='function'&&tkAuthBody(S.outPin))||null; }
async function loadNotices(force){
  if(!force&&S.nts&&Date.now()-(S.ntsAt||0)<60e3) return S.nts;
  if(!S.nts) S.nts=LS.get('nts')||[];
  try{ const j=await apiGet({action:'notices'}); S.nts=j.notices||[]; S.ntsAt=Date.now(); LS.set('nts',S.nts); }catch(e){}
  return S.nts;
}
/* ---------- สคริปต์ภายนอก (โหลดเมื่อใช้) ---------- */
const ntLibs={};
function ntLoad(src){ if(!ntLibs[src]) ntLibs[src]=new Promise((ok,no)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=()=>{ delete ntLibs[src]; no(new Error('โหลดไม่สำเร็จ — ตรวจอินเทอร์เน็ต')); }; document.head.appendChild(s); }); return ntLibs[src]; }
const NT_QR='https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', NT_H2C='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', NT_PDF='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
async function ntQr(url){ S.ntQrC=S.ntQrC||{}; if(S.ntQrC[url]) return S.ntQrC[url]; await ntLoad(NT_QR); const q=qrcode(0,'M'); q.addData(url); q.make(); return S.ntQrC[url]=q.createDataURL(6,2); }
/* ไฟล์ใน Drive → data URL (ใช้กับโปสเตอร์/แชร์ได้ ไม่ติด CORS) */
async function ntFile(id){ S.ntFiles=S.ntFiles||{}; if(S.ntFiles[id]) return S.ntFiles[id]; const c=LS.get('ntf_'+id); if(c) return S.ntFiles[id]=c;
  const j=await apiGet({action:'noticeFile',f:id}); const u='data:'+j.mime+';base64,'+j.base64; S.ntFiles[id]=u; if(u.length<450e3) LS.set('ntf_'+id,u); return u; }
/* SVG → PNG (html2canvas วาด SVG ใน <img> ไม่ได้ทุกเครื่อง) */
async function ntRaster(src,px){ if(!/\.svg/.test(src)) return src; S.ntRas=S.ntRas||{}; if(S.ntRas[src]) return S.ntRas[src];
  const im=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=src; });
  const w=px||300, h=Math.round(w*(im.naturalHeight||im.height||w)/(im.naturalWidth||im.width||w)), c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(im,0,0,w,h);
  return S.ntRas[src]=c.toDataURL('image/png'); }
async function ntImgs(n){ const c=ntCfg();
  const sp=n.type==='emg'&&c.speaker!=='custom'?NT_ART.mascot:c.speaker==='custom'&&c.speakerFile?await ntFile(c.speakerFile).catch(()=>NT_ART.heart):NT_ART[c.speaker]||NT_ART.heart;
  const logo=c.logoFile?await ntFile(c.logoFile).catch(()=>'notice/pea.png'):'notice/pea.png';
  const qr=c.qr?await ntQr(c.qr).catch(()=>''):'';
  return {sp:await ntRaster(sp,300).catch(()=>sp),logo,qr}; }
/* ---------- โปสเตอร์ (กว้าง 400 · สูง 545) ---------- */
const NT_KARST='<svg viewBox="0 0 400 70" preserveAspectRatio="none" style="position:absolute;left:0;right:0;top:0;width:100%;height:50px"><path d="M0 70 L0 48 C18 46 22 20 34 18 C44 16 46 40 58 42 C66 30 70 8 84 6 C98 4 100 34 110 40 C122 44 128 26 140 28 C150 30 152 46 166 46 C176 30 182 12 196 10 C212 8 214 36 226 42 C238 46 246 30 258 32 C270 34 272 48 286 48 C296 36 300 20 314 18 C328 16 330 40 342 44 C354 46 362 34 374 36 C386 38 390 50 400 50 L400 70Z" fill="#4A1B66"/></svg>';
function ntPoster(n,im){
  const c=ntCfg(), st=ntState(n), emg=n.type==='emg', mv=n.moved&&st==='plan';
  const sm=x=>{ const h=+String(x).slice(11,13), m=+String(x).slice(14,16); return h*60+m; };
  const a=sm(n.actualOff||n.startAt), bEnd=n.endAt?sm(n.endAt):Math.min(1440,a+120), b=bEnd<=a?1440:bEnd;
  const dur=n.endAt?Math.round((ntT(n.endAt)-ntT(n.startAt))/6e4):0, durT=dur?(dur>=60?Math.floor(dur/60)+' ชั่วโมง'+(dur%60?' '+dur%60+' นาที':''):dur+' นาที'):'';
  const dd=ntDaysTo(n.date), cd=st==='plan'?(dd>1?'อีก '+dd+' วัน':dd===1?'พรุ่งนี้':'วันนี้'):'';
  const d=new Date(n.date+'T00:00:00Z'), nowM=sm(ntNow());
  const [fa,fb]=String(n.area||'').split(/\s*(?:→|->|ถึง|-)\s*/);
  const say=String(n.speech||(emg?NT_SAY.emg:NT_SAY[n.reasonKey]||NT_SAY.other)).split('\n').map(esc).join('<br>');
  const prep=emg?`<span class="np-lab np-red">⚠️ เพื่อความปลอดภัย</span><div class="np-g3"><span>🚫<br>อย่าเข้าใกล้สาย<br>ที่ขาด/ห้อย</span><span>🔌<br>ถอดปลั๊ก<br>เครื่องใช้ไฟฟ้า</span><span class="np-w">📞<br>เห็นจุดอันตราย<br><b>แจ้ง ${esc(c.phone)}</b></span></div>`
    :`<span class="np-lab">🔋 เตรียมตัวก่อนไฟดับ</span><div class="np-g4"><span>📱<br>ชาร์จมือถือ</span><span>🧊<br>ตู้เย็นปิดสนิท</span><span>💧<br>สำรองน้ำ</span><span class="np-w">🩺<br>มีผู้ป่วยใช้เครื่องมือแพทย์<br><b>โทรแจ้งเราก่อน</b></span></div>`;
  const stamp=st==='done'?(()=>{ const on=n.actualOn, early=n.endAt&&on?Math.round((ntT(n.endAt)-ntT(on))/6e4):0;
      return `<div class="np-stamp g">✅ ไฟมาแล้ว ${ntHm(on)} น.<small>${early>0?'เร็วกว่ากำหนด '+early+' นาที · ':''}ขอบคุณที่รอครับ</small></div>`; })()
    :st==='cancel'?`<div class="np-stamp x">ยกเลิกการงดจ่ายไฟ<small>ใช้ไฟได้ตามปกติ</small></div>`:'';
  return `<div class="np"><div class="np-gl"></div>${emg?'<div class="np-emtop">⚠️ ด่วน · งดจ่ายไฟฉุกเฉิน</div>':''}
  <div class="np-top"><img class="np-logo" src="${im.logo}" alt=""></div>
  <div class="np-sp"><img src="${im.sp}" alt=""><div class="np-bub">${say}</div></div>
  <div class="np-hl">ประกาศ ${st==='live'?'<span class="np-live">● กำลังดับ</span>':cd?`<span class="np-cd">${cd}</span>`:''}<b class="${emg?'np-red':''}">${emg?'ดับไฟฉุกเฉิน':'งดจ่ายไฟฟ้า'}</b><small>${esc(n.reason||'')}</small></div>
  ${mv?`<div class="np-mv">⚠️ เลื่อนวัน — จากเดิม ${esc(ntDateTh(n.moved.from,true))} ${esc(n.moved.fromStart||'')}–${esc(n.moved.fromEnd||'')} น.</div>`:''}
  <div class="np-when"><div class="np-cal"><span>${emg&&dd===0?'วันนี้':NT_WD[d.getUTCDay()]}</span><b>${d.getUTCDate()}</b><span>${NT_MS[d.getUTCMonth()]} ${String(d.getUTCFullYear()+543).slice(2)}</span></div>
   <div class="np-tl"><div class="np-tlt"><b>${ntHm(n.actualOff||n.startAt)}</b><span class="${emg?'np-red':''}">${emg?(n.endAt?'คาดว่าไฟมา ~'+durT:'กำลังเร่งแก้ไข'):'ดับ '+durT}</span><b>${n.endAt?(emg?'~':'')+ntHm(n.endAt):'—'}</b></div>
   <div class="np-bar"><i class="${emg?'em':''}" style="left:${(a/14.4).toFixed(1)}%;width:${Math.max(1.5,(b-a)/14.4).toFixed(1)}%"></i>${emg&&st==='live'&&dd===0?`<b class="np-now" style="left:${(nowM/14.4).toFixed(1)}%">ตอนนี้</b>`:''}</div>
   <div class="np-tlx"><span>00.00</span><span>☀️ 12.00</span><span>24.00</span></div></div></div>
  <div class="np-where ${emg?'em':''}"><svg class="np-map" viewBox="0 0 120 90"><rect width="120" height="90" fill="${emg?'#F6ECEC':'#EEF4F2'}"/><path d="M0 72 C30 62 50 77 80 64 S120 57 120 57 L120 90 L0 90Z" fill="${emg?'#F3DADA':'#CFE6EA'}"/><path d="M6 24 L44 40 L100 26" stroke="#B9B2C0" stroke-width="3" fill="none"/>${fb?`<path d="M44 40 L62 70" stroke="${emg?'#D9480F':'#C92A2A'}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="62" cy="70" r="5" fill="${emg?'#D9480F':'#C92A2A'}"/>`:''}<circle cx="44" cy="40" r="5" fill="${emg?'#D9480F':'#C92A2A'}"/></svg>
   <div class="np-wt"><span class="np-lab">📍 พื้นที่ไฟดับ</span><b>${esc(fa||'')}${fb?' → '+esc(fb):''}</b><span>${esc(n.sub||c.sub||'')}</span><span class="np-tags">${(n.villages||[]).slice(0,3).map(v=>`<i>${esc(v)}</i>`).join('')}${n.cust?`<i>~${n.cust} ราย</i>`:''}</span></div></div>
  <div class="np-prep">${prep}</div>
  ${!emg&&n.doc?'<div class="np-dtag">📎 หนังสือประกาศ แนบภาพถัดไป</div>':''}
  <div class="np-foot">${NT_KARST}<div class="np-pf"><div><b>📞 ${esc(c.phone)}</b><span>${emg?'ติดตามสถานะในห้อง OpenChat<br>ไฟมาแล้วจะแจ้งทันที':'ไฟมาเร็วกว่ากำหนด — จ่ายไฟทันที<br>อย่าเข้าใกล้สายไฟ / ปฏิบัติงานเอง'}</span></div>${im.qr?`<div class="np-qr"><img src="${im.qr}" alt=""><span>${esc(c.qrLabel||'')}<br>สแกนเข้า<br>OpenChat</span></div>`:''}</div><div class="np-tag">${esc(c.unit)} · ${esc(c.slogan)}</div></div>
  ${stamp}</div>`;
}
async function ntPosterPng(n){
  const im=await ntImgs(n); await ntLoad(NT_H2C);
  const box=document.createElement('div'); box.style.cssText='position:fixed;left:-2000px;top:0;width:400px;z-index:-1'; box.innerHTML=ntPoster(n,im); document.body.appendChild(box);
  await Promise.all([...box.querySelectorAll('img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));
  try{ await document.fonts.ready; }catch(e){}
  const cv=await html2canvas(box.firstElementChild,{scale:2.7,backgroundColor:'#ffffff',useCORS:true,logging:false});
  box.remove();
  return await new Promise(r=>cv.toBlob(r,'image/png'));
}
const ntB64Blob=(u)=>{ const [h,b]=u.split(','), mime=(h.match(/data:([^;]+)/)||[])[1]||'image/jpeg', bin=atob(b), a=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i); return new Blob([a],{type:mime}); };
function ntFname(n,x){ return (n.type==='emg'?'ดับไฟฉุกเฉิน':'งดจ่ายไฟ')+' '+n.date+' '+String(n.area||'').replace(/[\\/:*?"<>|→]/g,'-').slice(0,40)+x; }
function ntText(n){ const c=ntCfg(), st=ntState(n), emg=n.type==='emg';
  const L=[(st==='done'?'✅ ไฟมาแล้ว '+ntHm(n.actualOn)+' น. — ':st==='cancel'?'❎ ยกเลิก — ':'')+(emg?'⚠️ ดับไฟฉุกเฉิน':'📢 ประกาศงดจ่ายไฟฟ้า')+' '+ntDateTh(n.date,true)+' เวลา '+ntHm(n.actualOff||n.startAt)+(n.endAt?'–'+(emg?'~':'')+ntHm(n.endAt):'')+' น.',
    '📍 '+(n.area||'')+(n.sub?' '+n.sub:''), n.reason?'🔧 '+n.reason:'', n.cust?'🏠 ผู้ใช้ไฟประมาณ '+n.cust+' ราย':'', !emg&&n.doc?'📎 หนังสือประกาศ (ภาพที่ 2)':'',
    emg?'⚠️ อย่าเข้าใกล้สายไฟที่ขาด/ห้อย · เห็นจุดอันตรายแจ้ง '+c.phone:'ไฟมาเร็วกว่ากำหนดจะจ่ายไฟทันที · สอบถาม '+c.phone, c.unit+' ขออภัยในความไม่สะดวก 🙏'];
  return L.filter(Boolean).join('\n'); }
async function ntFiles(n){ const files=[new File([await ntPosterPng(n)],ntFname(n,'.png'),{type:'image/png'})];
  if(n.type!=='emg'&&n.doc&&n.doc.fileId){ try{ const u=await ntFile(n.doc.fileId), bl=ntB64Blob(u); files.push(new File([bl],ntFname(n,' (หนังสือ)'+(bl.type==='application/pdf'?'.pdf':'.jpg')),{type:bl.type})); }catch(e){ toast('ดึงหนังสือประกาศไม่สำเร็จ — ส่งเฉพาะโปสเตอร์'); } }
  return files; }
function ntDl(f){ const a=document.createElement('a'); a.href=URL.createObjectURL(f); a.download=f.name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000); }
async function ntShare(n,b){ const t=b.innerHTML; b.disabled=true; b.innerHTML='<span class="spin"></span>กำลังเตรียม…';
  try{ const files=await ntFiles(n), text=ntText(n);
    if(navigator.canShare&&navigator.canShare({files})){ try{ await navigator.share({files,text}); }catch(e){ if(e.name!=='AbortError') throw e; } }
    else { files.forEach(ntDl); try{ await navigator.clipboard.writeText(text); toast('ดาวน์โหลด '+files.length+' ไฟล์ · คัดลอกข้อความแล้ว'); }catch(e){ toast('ดาวน์โหลด '+files.length+' ไฟล์แล้ว'); } }
  }catch(e){ alert(e.message); } b.disabled=false; b.innerHTML=t; }
async function ntPdf(n,b){ const t=b.innerHTML; b.disabled=true; b.innerHTML='<span class="spin"></span>กำลังทำ PDF…';
  try{ const files=await ntFiles(n); await ntLoad(NT_PDF); const {jsPDF}=window.jspdf, pdf=new jsPDF({unit:'mm',format:'a4'});
    const add=async(f,first)=>{ const u=await new Promise(r=>{const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(f);}); const im=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.src=u;});
      if(!first) pdf.addPage(); const W=210,H=297,m=8, s=Math.min((W-2*m)/im.width,(H-2*m)/im.height); pdf.addImage(u,f.type==='image/png'?'PNG':'JPEG',(W-im.width*s)/2,(H-im.height*s)/2,im.width*s,im.height*s); };
    await add(files[0],true); const extra=[];
    for(const f of files.slice(1)){ if(f.type==='application/pdf') extra.push(f); else await add(f,false); }
    ntDl(new File([pdf.output('blob')],ntFname(n,'.pdf'),{type:'application/pdf'})); extra.forEach(ntDl);
    if(extra.length) toast('หนังสือเป็นไฟล์ PDF อยู่แล้ว — ดาวน์โหลดแยกให้อีกไฟล์');
  }catch(e){ alert(e.message); } b.disabled=false; b.innerHTML=t; }
/* ---------- แถบในหน้าเวรรายวัน ---------- */
function renderNtBanner(){
  const el=$('dNt'); if(!el) return; const L=(S.nts||LS.get('nts')||[]);
  const td=ntNow().slice(0,10), lim=new Date(Date.parse(td+'T00:00:00Z')+7*864e5).toISOString().slice(0,10);
  const act=L.filter(n=>{ const s=ntState(n); return s==='live'||s==='due'||((s==='plan')&&n.date>=td&&n.date<=lim); }).sort((a,b)=>String(a.startAt).localeCompare(String(b.startAt)));
  if(!act.length){ el.classList.add('hide'); el.innerHTML=''; return; }
  const em=act.find(n=>n.type==='emg'&&ntState(n)==='live'), today=act.filter(n=>n.date===td);
  const c=ntCfg(), sp=c.speaker==='custom'?NT_ART.heart:(NT_ART[c.speaker]||NT_ART.heart);
  el.classList.remove('hide');
  if(em){ const mins=Math.max(0,Math.round((Date.now()-ntT(em.actualOff||em.startAt))/6e4));
    el.className='ntb em'; el.innerHTML=`<span class="ntb-ic">⚠️</span><div><b>ดับไฟฉุกเฉิน · กำลังดับ ${mins>=60?Math.floor(mins/60)+' ชม. ':''}${mins%60} นาที</b><small>${esc(em.area)}${em.cust?' · ~'+em.cust+' ราย':''}${em.endAt?' · คาดว่าไฟมา ~'+ntHm(em.endAt):''}</small></div><span class="ntb-go">อัปเดต ›</span>`;
    el.onclick=()=>ntDetail(em.id); return; }
  el.className='ntb'+(today.length?' td':''); el.innerHTML=`<img src="${sp}" alt=""><div><b>📢 งดจ่ายไฟ ${act.length} แผน${today.length?' · วันนี้':''}</b>${act.slice(0,2).map(n=>`<small>${n.date===td?'วันนี้':esc(ntDateTh(n.date,false))} ${ntHm(n.startAt)}–${ntHm(n.endAt)} · ${esc(n.area)}</small>`).join('')}</div><span class="ntb-go">ดูทั้งหมด ›</span>`;
  el.onclick=()=>ntPage();
}
async function ntBannerRefresh(){ await loadNotices(); renderNtBanner(); if(S.ntOpen){ const id=S.ntOpen; S.ntOpen=null; ntDetail(id); } }
/* ---------- หน้าประกาศ (แผ่นเต็มจอ) ---------- */
function ntSheet(title,html,onBack){
  let ov=$('ntOv'); if(!ov){ ov=document.createElement('div'); ov.id='ntOv'; ov.className='ntov'; document.body.appendChild(ov); }
  ov.innerHTML=`<div class="nt-hd"><button type="button" class="lnk" id="ntBack">${onBack?'‹ กลับ':'✕ ปิด'}</button><b>${title}</b><span></span></div><div class="nt-bd ofm">${html}</div>`;
  $('ntBack').onclick=()=>{ if(onBack) onBack(); else { ov.remove(); renderNtBanner(); } };
  ov.scrollTop=0; return ov; }
async function ntPage(){
  const draw=()=>{ const L=S.nts||[], td=ntNow().slice(0,10), up=L.filter(n=>{const s=ntState(n);return s!=='done'&&s!=='cancel'&&(n.date>=td||s==='live'||s==='due');}), past=L.filter(n=>up.indexOf(n)<0).reverse();
    const row=n=>{ const s=ntState(n), d=new Date(n.date+'T00:00:00Z'), dd=ntDaysTo(n.date);
      const pill=s==='live'?'<span class="ntp r">● กำลังดับ</span>':s==='due'?'<span class="ntp r">ถึงเวลาแล้ว</span>':s==='done'?'<span class="ntp g">✅ เสร็จ</span>':s==='cancel'?'<span class="ntp x">ยกเลิก</span>':s==='over'?'<span class="ntp o">ยังไม่ปิด</span>':`<span class="ntp o">${dd===0?'วันนี้':dd===1?'พรุ่งนี้':'อีก '+dd+' วัน'}</span>`;
      return `<button type="button" class="nt-row ${n.type==='emg'?'em':''}" data-n="${esc(n.id)}"><span class="nt-dt">${d.getUTCDate()}<small>${NT_MS[d.getUTCMonth()]}</small></span><span class="nt-mid"><b>${n.type==='emg'?'⚠️ ':''}${ntHm(n.actualOff||n.startAt)}–${n.endAt?ntHm(n.endAt):'?'} · ${esc(n.area)}</b><small>${esc(n.reason||'')}${n.cust?' · ~'+n.cust+' ราย':''}${n.type==='plan'&&!n.doc&&s!=='cancel'?' · <em class="ntw">📎 รอแนบหนังสือ</em>':''}</small></span>${pill}</button>`; };
    const can=!!ntAuth(), appr=!!((meInfo()||{}).appr||S.outPinAppr);
    ntSheet('📢 ประกาศงดจ่ายไฟ',`${can?'<button type="button" class="btn" id="ntNew" style="width:100%">＋ สร้างประกาศ</button>':'<div class="note">ล็อกอินศูนย์รวมงาน (หรือเปิดจากลิงก์ LINE ของเวร) เพื่อสร้าง/อัปเดตประกาศ</div>'}
      <div class="nt-card"><h4>กำลังจะถึง / กำลังดับ</h4>${up.map(row).join('')||'<div class="muted">ไม่มีแผนงดจ่ายไฟ</div>'}</div>
      <div class="nt-card"><h4>ผ่านมาแล้ว</h4>${past.slice(0,20).map(row).join('')||'<div class="muted">—</div>'}</div>
      ${appr?'<button type="button" class="btn ghost" id="ntCfgB" style="width:100%;margin-top:8px">⚙️ ตั้งค่าประกาศของหน่วยงาน</button>':''}`);
    document.querySelectorAll('#ntOv [data-n]').forEach(b=>b.onclick=()=>ntDetail(b.dataset.n));
    if($('ntNew')) $('ntNew').onclick=()=>ntForm(null);
    if($('ntCfgB')) $('ntCfgB').onclick=()=>ntSettings(); };
  draw(); await loadNotices(true); if($('ntOv')&&!$('ntF')&&!$('ntDet')) draw();
}
async function ntDetail(id){
  await loadNotices(); const n=(S.nts||[]).find(x=>x.id===id); if(!n){ toast('ไม่พบประกาศ'); return ntPage(); }
  const s=ntState(n), can=!!ntAuth(), emg=n.type==='emg';
  const acts=!can?'':s==='plan'||s==='due'||s==='over'?`<button type="button" class="btn" data-a="start">⚡ เริ่มดับแล้ว</button><button type="button" class="btn ok" data-a="done">✅ ไฟมาแล้ว</button><button type="button" class="btn ghost" data-a="move">⚠️ เลื่อนวัน</button><button type="button" class="btn ghost red" data-a="cancel">ยกเลิก</button>`
    :s==='live'?`<button type="button" class="btn ok" data-a="done">✅ ไฟมาแล้ว</button><button type="button" class="btn ghost" data-a="extend">⏱ ขยายเวลา</button>`
    :s==='done'?(n.outId?`<div class="oiss g" style="grid-column:1/-1">⚡ ลงรายการไฟดับแล้ว (${esc(n.outId)})</div>`:`<button type="button" class="btn" data-a="out" style="grid-column:1/-1">⚡ ลงรายการไฟดับในรายงานเวร</button>`)+`<button type="button" class="btn ghost" data-a="reopen">↺ เปิดใหม่</button>`
    :`<button type="button" class="btn ghost" data-a="reopen">↺ เปิดใหม่</button>`;
  ntSheet(emg?'⚠️ ดับไฟฉุกเฉิน':'📢 ประกาศงดจ่ายไฟ',`<div id="ntDet">
    <div class="nt-prev" id="ntPrev"><div class="muted">กำลังสร้างโปสเตอร์…</div></div>
    ${!emg?`<div class="nt-doc">${n.doc?`<span>📎 <b>หนังสือประกาศ</b> แนบแล้ว · ส่งเป็นภาพที่ 2</span>${can?'<button type="button" class="lnk" id="ntDocX">เปลี่ยน</button>':''}`:`<span class="ntw">📎 ยังไม่ได้แนบหนังสือประกาศ (ลงนามแล้ว)</span>${can?'<label class="btn sm">แนบไฟล์<input type="file" id="ntDocF" accept="image/*,application/pdf" hidden></label>':''}`}<div id="ntDocM"></div></div>`:''}
    <div class="nt-sh"><button type="button" class="btn line" id="ntShare">📤 แชร์ ${!emg&&n.doc?'2 ภาพ (โปสเตอร์+หนังสือ)':'โปสเตอร์'}</button><button type="button" class="btn ghost" id="ntPdfB">📄 PDF</button><button type="button" class="btn ghost" id="ntCopy">💬 คัดลอกข้อความ</button></div>
    ${acts?`<div class="nt-acts">${acts}</div>`:''}<div id="ntMsg"></div>
    ${can&&s!=='done'&&s!=='cancel'?'<button type="button" class="lnk" id="ntEdit" style="margin-top:8px">✏️ แก้ไขรายละเอียด</button>':''}
    <div class="nt-tl"><b>ไทม์ไลน์</b>${(n.tl||[]).slice().reverse().map(e=>`<div>${esc(String(e.at).slice(8,10)+'/'+String(e.at).slice(5,7)+' '+String(e.at).slice(11))} · ${esc({new:'สร้างประกาศ',edit:'แก้ไข',start:'เริ่มดับ',done:'ไฟมาแล้ว',extend:'ขยายเวลาถึง',move:'เลื่อนเป็น',cancel:'ยกเลิก',reopen:'เปิดใหม่',doc:'แนบหนังสือ',docDel:'ลบหนังสือ',link:'ลงรายการไฟดับ'}[e.act]||e.act)} ${esc(e.txt||'')} <span class="muted">(${esc(e.by||'')})</span></div>`).join('')}</div>
    ${can&&(s==='cancel'||s==='plan')?'<button type="button" class="lnk" id="ntDel" style="color:#A23434;margin-top:10px">ลบประกาศนี้</button>':''}</div>`,()=>ntPage());
  ntImgs(n).then(im=>{ const p=$('ntPrev'); if(p) p.innerHTML=`<div class="nt-scale">${ntPoster(n,im)}</div>`; });
  $('ntShare').onclick=e=>ntShare(n,e.currentTarget); $('ntPdfB').onclick=e=>ntPdf(n,e.currentTarget);
  $('ntCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(ntText(n)); toast('คัดลอกข้อความแล้ว'); }catch(e){ prompt('คัดลอกข้อความนี้',ntText(n)); } };
  if($('ntEdit')) $('ntEdit').onclick=()=>ntForm(n);
  if($('ntDel')) $('ntDel').onclick=async()=>{ if(!confirm('ลบประกาศนี้?')) return; try{ await apiPost(Object.assign({action:'noticeAct',id:n.id,a:'del'},ntAuth())); await loadNotices(true); toast('ลบแล้ว'); ntPage(); }catch(e){ msg('ntMsg',e.message,'err'); } };
  const docUp=async f=>{ if(!f) return; msg('ntDocM','กำลังอัปโหลด…'); try{ const x=await ntReadFile(f); const j=await apiPost(Object.assign({action:'noticeDoc',id:n.id,base64:x.base64,mime:x.mime},ntAuth())); if(j.notice.doc) S.ntFiles=Object.assign(S.ntFiles||{},{[j.notice.doc.fileId]:x.url}); await loadNotices(true); toast('แนบหนังสือแล้ว'); ntDetail(n.id); }catch(e){ msg('ntDocM',e.message,'err'); } };
  if($('ntDocF')) $('ntDocF').onchange=e=>docUp(e.target.files[0]);
  if($('ntDocX')) $('ntDocX').onclick=()=>{ const i=document.createElement('input'); i.type='file'; i.accept='image/*,application/pdf'; i.onchange=()=>docUp(i.files[0]); i.click(); };
  document.querySelectorAll('#ntOv [data-a]').forEach(b=>b.onclick=async()=>{ const a=b.dataset.a, body={action:'noticeAct',id:n.id,a};
    if(a==='out') return ntToOutage(n);
    if(a==='done'||a==='start'){ const t=prompt(a==='done'?'เวลาไฟมา (24 ชม.) — เว้นว่าง = ตอนนี้':'เวลาเริ่มดับ (24 ชม.) — เว้นว่าง = ตอนนี้',''); if(t===null) return; if(t.trim()){ const h=hmNorm(t); if(!h){ alert('เวลาไม่ถูกต้อง'); return; } body.at=h; } }
    if(a==='extend'){ const t=prompt('คาดว่าไฟมากี่โมง (24 ชม.)',ntHm(n.endAt).replace('.',':')); if(!t) return; const h=hmNorm(t); if(!h){ alert('เวลาไม่ถูกต้อง'); return; } body.to=h; }
    if(a==='move'){ const dt=prompt('เลื่อนเป็นวันที่ (ปปปป-ดด-วว ค.ศ.)',n.date); if(!dt) return; const st=hmNorm(prompt('เวลาเริ่ม',n.start)||''), en=hmNorm(prompt('เวลาสิ้นสุด',n.end)||''); if(!st||!en){ alert('เวลาไม่ถูกต้อง'); return; } Object.assign(body,{date:dt.trim(),start:st,end:en}); }
    if(a==='cancel'){ const r=prompt('เหตุผลที่ยกเลิก (ไม่บังคับ)',''); if(r===null) return; body.note=r; }
    b.disabled=true; msg('ntMsg','กำลังบันทึก…');
    try{ await apiPost(Object.assign(body,ntAuth())); await loadNotices(true); toast({start:'บันทึกเริ่มดับแล้ว',done:'ไฟมาแล้ว ✓ — โปสเตอร์เปลี่ยนให้แล้ว',extend:'ขยายเวลาแล้ว',move:'เลื่อนวันแล้ว',cancel:'ยกเลิกแล้ว',reopen:'เปิดใหม่แล้ว'}[a]||'บันทึกแล้ว'); ntDetail(n.id); }
    catch(e){ b.disabled=false; msg('ntMsg',e.message,'err'); } });
}
function ntReadFile(f){ return new Promise((ok,no)=>{ if(f.type==='application/pdf'){ if(f.size>6e6) return no(new Error('PDF ใหญ่เกิน 6 MB')); const fr=new FileReader(); fr.onload=()=>ok({base64:fr.result.split(',')[1],mime:'application/pdf',url:fr.result}); fr.onerror=no; fr.readAsDataURL(f); return; }
  const im=new Image(), u=URL.createObjectURL(f); im.onload=()=>{ const s=Math.min(1,2000/Math.max(im.width,im.height)), c=document.createElement('canvas'); c.width=Math.round(im.width*s); c.height=Math.round(im.height*s);
    const g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(u); const url=c.toDataURL('image/jpeg',.82); ok({base64:url.split(',')[1],mime:'image/jpeg',url}); }; im.onerror=()=>no(new Error('เปิดไฟล์ไม่ได้')); im.src=u; }); }
/* ---------- ลงรายการไฟดับจากประกาศ (ไฟมาแล้ว) ---------- */
async function ntToOutage(n){
  const off=n.actualOff||n.startAt, k=outKeyOfOff(off), m=k.slice(0,7);
  if(!S.boot.months.some(x=>x.month===m)){ alert('ยังไม่มีตารางเวรเดือนนี้'); return; }
  const mo=await loadMonth(m); const d=+k.slice(8,10), I=sheetInfo(m,mo.data,d,k.slice(-2));
  const ov=$('ntOv'); if(ov) ov.remove();
  S.dMonth=m; S.dDay=d; S.repOpen=k; if($('dMonth')) $('dMonth').value=m; await renderDaily();
  outForm(k,I,null,mo.data,{nt:n});
}
/* ---------- ฟอร์มสร้าง/แก้ประกาศ ---------- */
async function ntForm(n0){
  const c=ntCfg(), td=ntNow().slice(0,10);
  const F=n0?JSON.parse(JSON.stringify(n0)):{type:'plan',date:new Date(Date.parse(td+'T00:00:00Z')+3*864e5).toISOString().slice(0,10),start:'08:30',end:'16:30',reasonKey:'improve',reason:NT_RS.plan[0][1],area:'',sub:c.sub,villages:[],feeder:'',dev:null,cust:null,estMin:120,startIn:0};
  let docFile=null;
  sldData().then(()=>{ if($('ntF')) draw(); });
  const draw=()=>{ const emg=F.type==='emg', fd=(S.sld&&S.sld.fd&&S.sld.fd.length?S.sld.fd:FEEDERS0);
    ntSheet(n0?'✏️ แก้ไขประกาศ':'📢 สร้างประกาศ',`<div id="ntF">
     ${n0?'':`<div class="nt-typ"><button type="button" data-ty="plan" class="${!emg?'on':''}">📅 แจ้งล่วงหน้า<small>ปรับปรุง / บำรุงรักษา</small></button><button type="button" data-ty="emg" class="${emg?'on em':''}">⚠️ ฉุกเฉิน<small>ต้องดับเดี๋ยวนี้ / ภายในวันนี้</small></button></div>`}
     ${emg&&!n0?`<div class="lb">เริ่มดับ</div><div class="chips">${[[0,'ดับแล้ว (ตอนนี้)'],[15,'อีก 15 นาที'],[30,'อีก 30 นาที'],[60,'อีก 1 ชม.']].map(([v,l])=>`<button type="button" class="ch ${F.startIn===v?'on':''}" data-si="${v}">${l}</button>`).join('')}</div>
       <div class="lb">คาดว่าใช้เวลา</div><div class="chips">${[[60,'1 ชม.'],[120,'2 ชม.'],[180,'3 ชม.'],[240,'4 ชม.'],[0,'ยังไม่ทราบ']].map(([v,l])=>`<button type="button" class="ch ${F.estMin===v?'on':''}" data-es="${v}">${l}</button>`).join('')}</div>`
      :`<div class="grid3" style="margin-top:6px"><label class="tf">วันที่<input type="date" id="ntD" value="${esc(F.date)}" min="${emg?'':td}"></label><label class="tf">เริ่ม<input type="text" class="hm" inputmode="numeric" id="ntS" value="${esc(F.start||'')}" maxlength="5"></label>${emg?`<label class="tf">คาดว่าใช้ (นาที)<input type="number" id="ntE" value="${F.estMin||''}"></label>`:`<label class="tf">สิ้นสุด<input type="text" class="hm" inputmode="numeric" id="ntEn" value="${esc(F.end||'')}" maxlength="5"></label>`}</div>`}
     <div class="lb">สาเหตุ</div><div class="chips">${NT_RS[F.type].map(([k,l])=>`<button type="button" class="ch ${F.reasonKey===k?'on':''}" data-rk="${k}">${esc(l)}</button>`).join('')}</div>
     <input type="text" id="ntR" value="${esc(F.reason||'')}" placeholder="รายละเอียดสาเหตุ (แสดงบนโปสเตอร์)" style="margin-top:6px">
     <div class="lb">ฟีดเดอร์ / อุปกรณ์ที่ตัดไฟ (SLD) <i>ไม่บังคับ · ใช้คำนวณจำนวนผู้ใช้ไฟ</i></div>
     <div class="chips">${fd.map(([id,col])=>`<button type="button" class="ch ${F.feeder===id?'on':''}" data-fd="${id}"><span class="dot" style="background:${col}"></span>${id}</button>`).join('')}</div>
     ${F.dev?`<div class="hit on" style="margin-top:6px"><div><b>${esc(F.dev.id)}</b> ${esc(F.dev.desc||'')}${F.cust?' · ผู้ใช้ไฟ ~'+F.cust+' ราย':''}</div><button type="button" class="lnk" id="ntDevX">เปลี่ยน</button></div>`:`<input type="search" id="ntQ" placeholder="รหัสอุปกรณ์ เช่น DS-12 หรือชื่อหมู่บ้าน" style="margin-top:6px" autocomplete="off"><div id="ntHits"></div>`}
     <div class="lb">พื้นที่ไฟดับ <i>ชื่อที่ชาวบ้านรู้จัก · ใช้ → แบ่ง จาก/ถึง</i></div>
     <input type="text" id="ntA" value="${esc(F.area||'')}" placeholder="เช่น สามแยก ศพด.แหลมสัก → หัวแหลม">
     <div class="grid2" style="margin-top:6px"><input type="text" id="ntSub" value="${esc(F.sub||'')}" placeholder="ต./อ./จ."><input type="text" id="ntV" value="${esc((F.villages||[]).join(', '))}" placeholder="หมู่บ้าน/จุดสังเกต (คั่นด้วย ,)"></div>
     <label class="tf" style="margin-top:6px">ผู้ใช้ไฟประมาณ (ราย)<input type="number" id="ntC" value="${F.cust||''}" min="0"></label>
     <div class="lb">คำพูดของตัวพูดบนโปสเตอร์ <i>ไม่บังคับ</i></div><textarea id="ntSay" rows="2" placeholder="${esc((emg?NT_SAY.emg:NT_SAY[F.reasonKey]||NT_SAY.other))}">${esc(F.speech||'')}</textarea>
     ${!emg&&!n0?`<div class="lb">📎 หนังสือประกาศ ${esc(c.unit)} (ลงนามแล้ว) <i>แนบทีหลังได้</i></div><label class="nt-drop">📷 ถ่ายรูป / 📄 เลือกไฟล์ (รูป หรือ PDF)<input type="file" id="ntDocIn" accept="image/*,application/pdf" hidden></label><div id="ntDocN" class="muted">${docFile?'✓ '+esc(docFile.name):''}</div>`:''}
     <div id="ntFMsg"></div>
     <button type="button" class="btn ${emg?'redf':''}" id="ntSave" style="width:100%;margin-top:10px">${n0?'บันทึก':emg?'⚠️ ประกาศดับไฟฉุกเฉิน':'สร้างประกาศ'}</button>
     ${emg&&!n0?'<div class="note" style="margin-top:6px">กดแล้วระบบแจ้ง LINE ผู้อนุมัติและเวรตอนนี้ · ได้โปสเตอร์ด่วนทันที</div>':''}</div>`,()=>n0?ntDetail(n0.id):ntPage());
    bind(); };
  const keep=()=>{ const v=id=>{const e=$(id);return e?e.value:null;};
    if(v('ntD')!=null) F.date=v('ntD'); if(v('ntS')!=null){ const h=hmNorm(v('ntS')); if(h) F.start=h; } if(v('ntEn')!=null){ const h=hmNorm(v('ntEn')); if(h) F.end=h; } if(v('ntE')!=null) F.estMin=+v('ntE')||0;
    F.reason=v('ntR')??F.reason; F.area=v('ntA')??F.area; F.sub=v('ntSub')??F.sub; if(v('ntV')!=null) F.villages=v('ntV').split(/[,،]/).map(x=>x.trim()).filter(Boolean); if(v('ntC')!=null) F.cust=+v('ntC')||null; if(v('ntSay')!=null) F.speech=v('ntSay').trim(); };
  const bind=()=>{
    document.querySelectorAll('#ntF [data-ty]').forEach(b=>b.onclick=()=>{ keep(); F.type=b.dataset.ty; F.reasonKey=NT_RS[F.type][0][0]; F.reason=NT_RS[F.type][0][1]; if(F.type==='emg'){ F.startIn=0; F.estMin=120; } else { F.date=new Date(Date.parse(td+'T00:00:00Z')+3*864e5).toISOString().slice(0,10); F.start='08:30'; F.end='16:30'; } draw(); });
    document.querySelectorAll('#ntF [data-si]').forEach(b=>b.onclick=()=>{ keep(); F.startIn=+b.dataset.si; draw(); });
    document.querySelectorAll('#ntF [data-es]').forEach(b=>b.onclick=()=>{ keep(); F.estMin=+b.dataset.es; draw(); });
    document.querySelectorAll('#ntF [data-rk]').forEach(b=>b.onclick=()=>{ keep(); const r=NT_RS[F.type].find(x=>x[0]===b.dataset.rk); F.reasonKey=r[0]; F.reason=r[0]==='other'?'':r[1]; draw(); });
    document.querySelectorAll('#ntF [data-fd]').forEach(b=>b.onclick=()=>{ keep(); F.feeder=F.feeder===b.dataset.fd?'':b.dataset.fd; if(F.dev&&F.dev.feeder!==F.feeder) F.dev=null; draw(); });
    document.querySelectorAll('#ntF input.hm').forEach(x=>x.oninput=hmTyping);
    if($('ntDevX')) $('ntDevX').onclick=()=>{ keep(); F.dev=null; draw(); };
    const q=$('ntQ'); if(q) q.oninput=()=>{ const s=S.sld, v=q.value.trim().toLowerCase(); if(!s||v.length<2){ $('ntHits').innerHTML=''; return; }
      const L=s.dev.filter(d=>(!F.feeder||d[4]===F.feeder)&&(d[0].toLowerCase().includes(v)||String(d[3]).toLowerCase().includes(v))&&d[1]!=='TRANSFORMER').slice(0,8);
      $('ntHits').innerHTML=L.map((d,i)=>`<button type="button" class="hit" data-h="${i}"><span><b>${esc(d[0])}</b> ${esc(DEV_TH[d[1]]||d[1])} · ${esc(d[3])}</span><span class="muted">${esc(d[4])}</span></button>`).join('')||'<div class="muted">ไม่พบ</div>';
      $('ntHits').querySelectorAll('[data-h]').forEach(b=>b.onclick=()=>{ keep(); const d=L[+b.dataset.h]; F.dev={id:d[0],type:d[1],desc:d[3],feeder:d[4]}; F.feeder=d[4]; F.cust=custBelow(d[0])||F.cust; if(!F.area&&d[3]) F.area=d[3]; draw(); }); };
    if($('ntDocIn')) $('ntDocIn').onchange=e=>{ docFile=e.target.files[0]||null; $('ntDocN').textContent=docFile?'✓ '+docFile.name:''; };
    $('ntSave').onclick=async()=>{ keep(); const a=ntAuth(); if(!a){ msg('ntFMsg','ล็อกอินศูนย์รวมงาน หรือใส่ PIN ผู้อนุมัติก่อน','err'); return; }
      if(!String(F.area||'').trim()){ msg('ntFMsg','ใส่พื้นที่ไฟดับ','err'); return; }
      const o={type:F.type,reason:F.reason,reasonKey:F.reasonKey,feeder:F.feeder,dev:F.dev,cust:F.cust,area:F.area.trim(),sub:F.sub,villages:F.villages,speech:F.speech};
      if(n0) Object.assign(o,{id:n0.id,date:F.date,start:F.start,end:F.end,estMin:F.estMin});
      else if(F.type==='emg'){ const at=isoAt(Date.now()+F.startIn*6e4); Object.assign(o,{date:at.slice(0,10),start:at.slice(11,16),estMin:F.estMin,live:F.startIn===0}); }
      else { if(!F.date||!F.start||!F.end){ msg('ntFMsg','ใส่วันและเวลาให้ครบ','err'); return; } Object.assign(o,{date:F.date,start:F.start,end:F.end}); }
      $('ntSave').disabled=true; $('ntSave').innerHTML='<span class="spin"></span>กำลังบันทึก…';
      try{ const j=await apiPost(Object.assign({action:'saveNotice',n:o},a)); let nn=j.notice;
        if(docFile){ $('ntSave').innerHTML='<span class="spin"></span>กำลังแนบหนังสือ…'; try{ const x=await ntReadFile(docFile); const k=await apiPost(Object.assign({action:'noticeDoc',id:nn.id,base64:x.base64,mime:x.mime},a)); nn=k.notice; if(nn.doc) (S.ntFiles=S.ntFiles||{})[nn.doc.fileId]=x.url; }catch(e){ toast('สร้างประกาศแล้ว แต่แนบหนังสือไม่สำเร็จ: '+e.message); } }
        await loadNotices(true); renderNtBanner(); toast(n0?'บันทึกแล้ว':'สร้างประกาศแล้ว'); ntDetail(nn.id);
      }catch(e){ $('ntSave').disabled=false; $('ntSave').textContent=n0?'บันทึก':'ลองอีกครั้ง'; msg('ntFMsg',e.message,'err'); } };
  };
  draw();
}
/* ---------- ตั้งค่าประกาศของหน่วยงาน ---------- */
function ntSettings(){
  const c=ntCfg(); let spImg=null, lgImg=null;
  const draw=()=>{ ntSheet('⚙️ ตั้งค่าประกาศงดจ่ายไฟ',`<div id="ntSet">
    <label class="tf">ชื่อหน่วยงาน<input type="text" id="nsU" value="${esc(c.unit)}"></label>
    <div class="lb">ภาพตัวพูด</div><div class="nt-art">${[['heart','หัวใจอ่าวลึก'],['mascot','น้องช่างไฟ'],['badge','ตราอ่าวลึก']].map(([k,l])=>`<button type="button" data-sp="${k}" class="${c.speaker===k?'on':''}"><img src="${NT_ART[k]}" alt=""><span>${l}</span></button>`).join('')}<button type="button" data-sp="custom" class="${c.speaker==='custom'?'on':''}"><span style="font-size:24px">＋</span><span>${c.speakerFile||spImg?'ภาพของหน่วยงาน ✓':'อัปโหลดภาพเอง'}</span></button></div>
    <input type="file" id="nsSp" accept="image/*" hidden><div class="muted">ดับไฟฉุกเฉินใช้ "น้องช่างไฟ" เสมอ (ถ้าไม่ได้อัปโหลดภาพเอง) · PNG พื้นใสจะสวยที่สุด</div>
    <div class="lb">โลโก้</div><div class="row" style="gap:8px"><img src="${c.logoFile?'':'notice/pea.png'}" id="nsLgP" style="height:44px;background:#fff;border-radius:6px"><label class="btn ghost sm">เปลี่ยนโลโก้<input type="file" id="nsLg" accept="image/*" hidden></label>${c.logoFile?'<button type="button" class="lnk" id="nsLgX">ใช้โลโก้ กฟภ.</button>':''}</div>
    <div class="grid2" style="margin-top:8px"><label class="tf">เบอร์โทร<input type="text" id="nsP" value="${esc(c.phone)}"></label><label class="tf">ต./อ./จ. (ค่าเริ่มต้น)<input type="text" id="nsSub" value="${esc(c.sub)}"></label></div>
    <label class="tf" style="margin-top:6px">ลิงก์ QR (ห้อง OpenChat / LINE)<input type="url" id="nsQ" value="${esc(c.qr)}"></label>
    <label class="tf" style="margin-top:6px">ป้ายใต้ QR<input type="text" id="nsQL" value="${esc(c.qrLabel||'')}"></label>
    <label class="tf" style="margin-top:6px">คำขวัญ<input type="text" id="nsS" value="${esc(c.slogan)}"></label>
    ${(meInfo()||{}).appr&&hubCreds().user?'':'<label class="tf" style="margin-top:6px">PIN ผู้อนุมัติ<input type="password" id="nsPin" inputmode="numeric" autocomplete="new-password"></label>'}
    <div id="nsMsg"></div><button type="button" class="btn" id="nsSave" style="width:100%;margin-top:10px">บันทึกตั้งค่า</button></div>`,()=>ntPage());
    document.querySelectorAll('#ntSet [data-sp]').forEach(b=>b.onclick=()=>{ keep(); if(b.dataset.sp==='custom'&&!c.speakerFile&&!spImg){ $('nsSp').click(); return; } c.speaker=b.dataset.sp; draw(); });
    $('nsSp').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; keep(); spImg=await ntPng(f); c.speaker='custom'; draw(); };
    $('nsLg').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; keep(); lgImg=await ntPng(f); $('nsLgP').src=lgImg.url; };
    if($('nsLgX')) $('nsLgX').onclick=()=>{ keep(); c.logoFile=''; c.clearLogo=1; draw(); };
    $('nsSave').onclick=async()=>{ keep(); const cr=hubCreds(), m=meInfo()||{}, pin=($('nsPin')||{}).value||S.outPin||'';
      const body=Object.assign({action:'saveNoticeCfg',cfg:c},m.appr&&cr.user?{hubUser:cr.user,hubPass:cr.pass}:{pin});
      if(spImg){ body.speakerImg=spImg.base64; body.speakerMime='image/png'; } if(lgImg){ body.logoImg=lgImg.base64; body.logoMime='image/png'; }
      msg('nsMsg','กำลังบันทึก…'); try{ const j=await apiPost(body); S.boot.config.noticeCfg=JSON.stringify(j.cfg); msg('nsMsg','บันทึกแล้ว ✓'); }catch(e){ msg('nsMsg',e.message,'err'); } }; };
  const keep=()=>{ const v=id=>($(id)||{}).value; c.unit=v('nsU')??c.unit; c.phone=v('nsP')??c.phone; c.sub=v('nsSub')??c.sub; c.qr=v('nsQ')??c.qr; c.qrLabel=v('nsQL')??c.qrLabel; c.slogan=v('nsS')??c.slogan; };
  draw();
}
function ntPng(f){ return new Promise((ok,no)=>{ const im=new Image(), u=URL.createObjectURL(f); im.onload=()=>{ const s=Math.min(1,600/Math.max(im.width,im.height)), cv=document.createElement('canvas'); cv.width=Math.round(im.width*s); cv.height=Math.round(im.height*s); cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); const url=cv.toDataURL('image/png'); ok({base64:url.split(',')[1],url}); }; im.onerror=()=>no(new Error('เปิดภาพไม่ได้')); im.src=u; }); }
