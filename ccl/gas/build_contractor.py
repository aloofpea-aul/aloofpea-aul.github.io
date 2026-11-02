import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read().replace('\r\n', '\n')
a = '<meta charset="UTF-8">'
assert s.count(a) == 2
s = s.replace(a, a + '\n<script src="contractor-shim.js?v=1"></script>', 1)
s = s.replace('<title>Contractor Portal — PEA CCL</title>', '<title>Contractor Portal — PEA CCL</title>\n<meta name="theme-color" content="#0D2B5E">', 1)
j = s.rindex('</body>')
s = s[:j] + '<script src="contractor-extra.js?v=3"></script>\n' + s[j:]
# Tailwind แบบสร้างไว้ล่วงหน้า (ccl/tw.css) แทน CDN ที่ต้องประมวลผลในเบราว์เซอร์ทุกครั้ง
_tw = '<script src="https://cdn.tailwindcss.com"></script>'
assert s.count(_tw) == 1
s = s.replace(_tw, '<link rel="stylesheet" href="tw.css?v=1">', 1)
s = s.replace('<link rel="stylesheet" href="tw.css?v=1">', '<link rel="stylesheet" href="tw.css?v=1">\n<link rel="manifest" href="contractor.webmanifest">\n<link rel="apple-touch-icon" href="ct-apple-touch-icon.png">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="ผู้รับจ้าง">\n<script src="pwa.js?v=1"></script>', 1)
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
