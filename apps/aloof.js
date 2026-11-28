/* Aloof Apps — ตัวช่วยกลางของระบบบัญชี (ใช้ร่วมทุกโปรแกรมขาย) */
(function(){
var API='https://script.google.com/macros/s/AKfycbw3ify1S1DyG8fmm-xuDuEoTY7_vl6caAjlpnt5RNU-1I3lB6N5h8bWbz1-Jfxv3eU1/exec';
var KEY='aloof_apps_auth';
var AV={rocket:['#7F77DD','ti-rocket'],cat:['#5DCAA5','ti-cat'],paw:['#F0997B','ti-paw'],star:['#EF9F27','ti-star'],heart:['#D4537E','ti-heart'],bolt:['#378ADD','ti-bolt'],leaf:['#639922','ti-leaf'],music:['#993556','ti-music']};
var TYPE={tester:['ผู้ทดสอบ','#EEEDFE','#3C3489'],trial:['ทดลองใช้','#FAEEDA','#633806'],paid:['สมาชิก','#FBEAF0','#72243E'],staff:['ทีมงาน','#E1F5EE','#085041']};
var APPS={english:{name:'English Step',desc:'ฝึกภาษาอังกฤษ จีน ญี่ปุ่น',url:'/english-step/',color:'#EF9F27',icon:'ti-language'}};
function get(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){return null}}
function set(v){try{if(v)localStorage.setItem(KEY,JSON.stringify(v));else localStorage.removeItem(KEY)}catch(e){}}
function api(action,body){return fetch(API,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({action:action},body||{}))}).then(function(r){return r.json()})}
function avatar(id,size){var a=AV[id]||AV.rocket;size=size||40;return '<span style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+a[0]+';color:#fff;display:inline-flex;align-items:center;justify-content:center;flex:none;font-size:'+Math.round(size*.55)+'px"><i class="ti '+a[1]+'" aria-hidden="true"></i></span>'}
function loginUrl(next){return '/apps/?next='+encodeURIComponent(next||location.pathname+location.search)}
window.AloofApps={API:API,KEY:KEY,AV:AV,TYPE:TYPE,APPS:APPS,get:get,set:set,api:api,avatar:avatar,loginUrl:loginUrl,
 logout:function(next){var a=get();if(a&&a.token)api('logout',{token:a.token}).catch(function(){});set(null);location.href=loginUrl(next||'/apps/')}};
})();
