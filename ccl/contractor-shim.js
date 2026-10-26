/* Contractor Portal บน GitHub — แทน google.script.run ด้วยการเรียก Api.gs (deployment เดียวกับ CCL)
   - ล็อกอินแล้วได้ token แบบ "ผู้รับจ้าง" หลังบ้านบังคับให้เห็น/แก้ได้เฉพาะงานของบริษัทตัวเอง
   - ย่อรูปก่อนอัปโหลด และแนบพิกัดอัตโนมัติเมื่อส่งอัปเดต */
var CT_API = 'https://script.google.com/macros/s/AKfycby4f-2rofhzok_cg9-YLftco1XuC-MCrKn72TTakoPhQfz-qGqjX9WTzZkY5Ye_BxejNQ/exec';
var CT_TOKEN_KEY = 'ct_token_v1', CT_USER_KEY = 'ct_user_v1', CT_BRANCH_KEY = 'ct_branch_v1';
function ctLs(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function ctApiUrl() { return ctLs('ccl_api_url') || CT_API; }

// ย่อรูปให้ด้านยาวไม่เกิน 1600px (JPEG) — รูปจากมือถือ 4–8 MB เหลือราว 300–600 KB
function ctShrinkImage(b64, mime) {
  return new Promise(function (resolve) {
    if (!/^image\/(jpeg|jpg|png|webp|heic|heif)$/i.test(mime || '') || !b64 || b64.length < 400000) return resolve({ b64: b64, mime: mime });
    var img = new Image();
    img.onload = function () {
      try {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * r); c.height = Math.round(h * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var out = c.toDataURL('image/jpeg', 0.82).split(',')[1];
        resolve(out && out.length < b64.length ? { b64: out, mime: 'image/jpeg' } : { b64: b64, mime: mime });
      } catch (e) { resolve({ b64: b64, mime: mime }); }
    };
    img.onerror = function () { resolve({ b64: b64, mime: mime }); };
    img.src = 'data:' + mime + ';base64,' + b64;
  });
}
function ctGetGps() {
  return new Promise(function (resolve) {
    if (!navigator.geolocation) return resolve(null);
    var done = false, t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 6000);
    navigator.geolocation.getCurrentPosition(function (p) { if (done) return; done = true; clearTimeout(t); resolve(p.coords.latitude.toFixed(6) + ',' + p.coords.longitude.toFixed(6)); },
      function () { if (done) return; done = true; clearTimeout(t); resolve(null); }, { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 });
  });
}

function ctPrepare(fn, args) {
  if (fn === 'loginContractor') { args[2] = (document.getElementById('ctBranch') || {}).value || ctLs(CT_BRANCH_KEY) || 'aoluek'; ctLs(CT_BRANCH_KEY, args[2]); }
  if (fn === 'uploadContractorAttachment') {
    return ctShrinkImage(args[2], args[3]).then(function (r) {
      args[2] = r.b64; args[3] = r.mime;
      if (r.mime === 'image/jpeg') args[1] = String(args[1] || 'photo').replace(/\.(png|webp|heic|heif)$/i, '.jpg');
      return args;
    });
  }
  if (fn === 'addContractorUpdate' && args[1] && typeof args[1] === 'object' && !args[1].gps) {
    return ctGetGps().then(function (g) {
      if (g) { args[1].gps = g; args[1].note = (args[1].note || '') + '\n📍 พิกัดตอนส่ง: https://maps.google.com/?q=' + g; }
      return args;
    });
  }
  return Promise.resolve(args);
}

function ctApiCall(fn, args) {
  args = (args || []).slice();
  return ctPrepare(fn, args).then(function (a) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, fn === 'uploadContractorAttachment' ? 180000 : 60000);
    return fetch(ctApiUrl(), {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ fn: fn, args: a, token: ctLs(CT_TOKEN_KEY) }), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.text(); }).then(function (t) {
      var j; try { j = JSON.parse(t); } catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง ลองใหม่อีกครั้ง'); }
      if (!j.ok) throw new Error(j.error || 'ไม่ทราบสาเหตุ');
      return j.data;
    }).catch(function (e) {
      if (window.__ctUnloading) return new Promise(function () {});
      if (e && e.name === 'AbortError') throw new Error('เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง');
      if (e && e.name === 'TypeError') throw new Error('เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      throw e;
    }).finally(function () { clearTimeout(timer); });
  });
}
window.addEventListener('pagehide', function () { window.__ctUnloading = true; });

function ctRunChain() {
  var onOk = null, onFail = null, uo;
  var chain = new Proxy({}, {
    get: function (_, prop) {
      if (prop === 'withSuccessHandler') return function (f) { onOk = f; return chain; };
      if (prop === 'withFailureHandler') return function (f) { onFail = f; return chain; };
      if (prop === 'withUserObject') return function (o) { uo = o; return chain; };
      return function () {
        var fn = String(prop), args = Array.prototype.slice.call(arguments);
        ctApiCall(fn, args).then(function (data) {
          if (fn === 'loginContractor' && data && data.success && data.token) { ctLs(CT_TOKEN_KEY, data.token); ctLs(CT_USER_KEY, JSON.stringify(data.user)); }
          if (onOk) onOk(data, uo);
        }, function (err) {
          if (String(err && err.message) === 'AUTH_REQUIRED') { ctSessionExpired(); return; }
          if (onFail) onFail(err, uo); else console.error(err);
        });
      };
    }
  });
  return chain;
}
window.google = { script: { run: new Proxy({}, { get: function (_, p) { return ctRunChain()[p]; } }) } };

function ctClearSession() { ctLs(CT_TOKEN_KEY, null); ctLs(CT_USER_KEY, null); }
function ctSessionExpired() {
  ctClearSession();
  try { if (typeof stopNotificationPolling === 'function') stopNotificationPolling(); } catch (e) {}
  try { Swal.close(); } catch (e) {}
  try {
    _user = null;
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('detailPanel').classList.remove('open');
    document.getElementById('loginScreen').style.display = 'flex';
    showToast('หมดเวลาการเข้าระบบ หรือบัญชีถูกระงับ กรุณาเข้าสู่ระบบใหม่', 'error');
  } catch (e) {}
}
