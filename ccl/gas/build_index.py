import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read().replace('\r\n', '\n')

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, (old[:60], n)
    s = s.replace(old, new)

SHIM = r'''<base target="_top">
  <script src="/pea-hub.js" data-app="ccl" data-gate="off" data-user-key="ccl_user_v1" data-user-field="name"></script>
  <script>
  // ===== CCL บน GitHub (ศูนย์รวมงาน) — เชื่อม Apps Script ผ่าน fetch =====
  // หน้าเว็บนี้ไม่มี google.script.run ของจริง จึงสร้างตัวจำลองที่ส่งคำขอไปยัง Api.gs แทน
  // โค้ดเดิมทั้งหมดทำงานได้เหมือนเดิม และใช้ข้อมูลชุดเดียวกับระบบเดิม
  var CCL_API_DEFAULT = 'https://script.google.com/macros/s/AKfycby4f-2rofhzok_cg9-YLftco1XuC-MCrKn72TTakoPhQfz-qGqjX9WTzZkY5Ye_BxejNQ/exec';   // ใส่ลิงก์ Web app ของ Api.gs (New deployment) ที่นี่
  var CCL_TOKEN_KEY = 'ccl_token_v1', CCL_USER_KEY = 'ccl_user_v1';
  function cclLs(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function cclApiUrl() { return cclLs('ccl_api_url') || CCL_API_DEFAULT; }
  function cclClearSession() { cclLs(CCL_TOKEN_KEY, null); cclLs(CCL_USER_KEY, null); }
  var CCL_SLOW = { uploadAttachment: 1, exportToExcel: 1, sendFollowUpLine: 1, getConstructionData: 1, getDashboardStats: 1 };

  function cclApiCall(fn, args) {
    var url = cclApiUrl();
    if (!url) return Promise.reject(new Error('ยังไม่ได้เชื่อมต่อระบบหลังบ้าน (Api.gs) กรุณาแจ้งผู้ดูแลระบบ'));
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, CCL_SLOW[fn] ? 120000 : 60000);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args || [], token: cclLs(CCL_TOKEN_KEY) }),
      redirect: 'follow',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { return r.text(); }).then(function (txt) {
      var j;
      try { j = JSON.parse(txt); } catch (e) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (อาจกำลังอัปเดตระบบ) ลองใหม่อีกครั้ง'); }
      if (!j.ok) throw new Error(j.error || 'ไม่ทราบสาเหตุ');
      return j.data;
    }).catch(function (e) {
      if (window.__cclUnloading) return new Promise(function () {});
      if (e && e.name === 'AbortError') throw new Error('เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง');
      if (e && e.name === 'TypeError') throw new Error('เชื่อมต่อเครือข่ายไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่');
      throw e;
    }).finally(function () { clearTimeout(timer); });
  }
  window.addEventListener('pagehide', function () { window.__cclUnloading = true; });

  function cclRunChain() {
    var onOk = null, onFail = null, userObj;
    var chain = new Proxy({}, {
      get: function (_, prop) {
        if (prop === 'withSuccessHandler') return function (f) { onOk = f; return chain; };
        if (prop === 'withFailureHandler') return function (f) { onFail = f; return chain; };
        if (prop === 'withUserObject') return function (o) { userObj = o; return chain; };
        return function () {
          var fn = String(prop), args = Array.prototype.slice.call(arguments);
          cclApiCall(fn, args).then(function (data) {
            if (fn === 'loginUser' && data && data.success && data.token) {
              cclLs(CCL_TOKEN_KEY, data.token); cclLs(CCL_USER_KEY, JSON.stringify(data.user));
            }
            if (onOk) onOk(data, userObj);
          }, function (err) {
            if (String(err && err.message) === 'AUTH_REQUIRED') { cclSessionExpired(); return; }
            if (onFail) onFail(err, userObj); else console.error(err);
          });
        };
      }
    });
    return chain;
  }
  window.google = { script: { run: new Proxy({}, { get: function (_, prop) { return cclRunChain()[prop]; } }) } };

  function cclSessionExpired() {
    cclClearSession();
    try { Swal.close(); } catch (e) {}
    try {
      document.getElementById('mainApp').classList.add('hidden');
      document.getElementById('loginGate').classList.remove('hidden');
      var box = document.getElementById('loginErrorMsg');
      document.getElementById('loginErrorText').innerText = 'หมดเวลาการเข้าระบบ กรุณาเข้าสู่ระบบอีกครั้ง';
      box.classList.remove('hidden');
    } catch (e) {}
  }
  </script>'''

rep('<base target="_top">', SHIM)

# ป้ายเวอร์ชัน + ปุ่มกลับศูนย์รวมงาน
rep('<span class="ccl-brand-sub">Construction Control Ledger · v3.1.1</span>',
    '<span class="ccl-brand-sub">Construction Control Ledger · v3.1.1 · GitHub</span>')
rep('  <div id="cclNavRight">\n',
    '  <div id="cclNavRight">\n\n    <a href="/index.html" class="ccl-icon-btn" title="กลับศูนย์รวมงาน" style="text-decoration:none;">\n      <i class="fa-solid fa-house"></i>\n    </a>\n')

# ออกจากระบบ = ลบ token ที่จำไว้ในเครื่องด้วย
rep("        currentUser = { role: 'Guest', name: '...' };\n",
    "        currentUser = { role: 'Guest', name: '...' };\n        cclClearSession();\n")

# เปิดเครื่องครั้งต่อไป เข้าได้เลยถ้ายังจำการเข้าระบบไว้
AUTO = r'''<script>
// เคยเข้าระบบในเครื่องนี้แล้ว (และ token ยังไม่หมดอายุ) = เข้าได้เลย ไม่ต้องกรอกรหัสใหม่
document.addEventListener('DOMContentLoaded', function () {
  var raw = cclLs(CCL_USER_KEY), tok = cclLs(CCL_TOKEN_KEY);
  if (!raw || !tok) return;
  try { var u = JSON.parse(raw); if (u && u.name) enterApp(u); } catch (e) { cclClearSession(); }
});
</script>
</body>'''
assert s.rstrip().endswith('</html>')
idx = s.rfind('</body>')
s = s[:idx] + AUTO + s[idx + len('</body>'):]

# ชั้นปรับหน้าจอมือถือ/iPad (ccl/mobile.css + ccl/mobile.js)
s = s.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">', 1)
_i = s.index('</head>'); s = s[:_i] + '<link rel="stylesheet" href="mobile.css?v=2">\n' + s[_i:]
_j = s.rindex('</body>'); s = s[:_j] + '<script src="mobile.js?v=2"></script>\n<script src="branch.js?v=3"></script>\n' + s[_j:]
# Tailwind แบบสร้างไว้ล่วงหน้า (ccl/tw.css) แทน CDN ที่ต้องประมวลผลในเบราว์เซอร์ทุกครั้ง
_tw = '<script src="https://cdn.tailwindcss.com"></script>'
assert s.count(_tw) == 1
s = s.replace(_tw, '<link rel="stylesheet" href="tw.css?v=1">', 1)
s = s.replace('<script src="mobile.js?v=2"></script>', '<script src="perf.js?v=1"></script>\n<script src="mobile.js?v=2"></script>', 1)
# ส่วนรับข้อมูลจากระบบสำรวจงานก่อสร้าง (?import=1) — อยู่ใน ccl/gas/import-block.html
import os
_blk = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'import-block.html')
if not os.path.exists(_blk): _blk = '/home/claude/aloofpea-aul.github.io/ccl/gas/import-block.html'
_j = s.rindex('</body>'); s = s[:_j] + open(_blk, encoding='utf-8').read() + s[_j:]
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
