#!/usr/bin/env python3
"""สร้างหน้าโหมดทดลอง demo/index.html จาก index.html หลัก — รันใหม่ทุกครั้งที่แก้ index.html
   python3 duty-roster/demo/build.py"""
import os, re
here = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(here, '..', 'index.html'), encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    c = s.count(a)
    assert c == n, (c, a[:70])
    s = s.replace(a, b)
rep('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="../">\n<meta name="robots" content="noindex">')
s = re.sub(r'<script src="/pea-hub\.js[^"]*"[^>]*></script>\n?', '', s, count=1)
s = re.sub(r'<link rel="manifest"[^>]*>', '', s, count=1)
rep('<title>งานเวรแก้ไฟ กฟส.อ่าวลึก</title>', '<title>ทดลองใช้ งานเวรแก้ไฟ</title>')
rep("<script>\n/* ===== ตั้งค่า: วาง URL", '<script src="demo/demo.js?v=__V__"></script>\n<script>\n/* ===== ตั้งค่า: วาง URL')
rep("localStorage.getItem('dr_'+k)", "localStorage.getItem('drdemo_'+k)")
rep("localStorage.setItem('dr_'+k,", "localStorage.setItem('drdemo_'+k,")
rep("localStorage.removeItem('dr_'+k)", "localStorage.removeItem('drdemo_'+k)")
rep("function hubCreds(){", "function hubCreds(){return window.DEMO.creds();}\nfunction hubCreds0(){")
rep("startsWith('dr_mr_')", "startsWith('drdemo_mr_')", 3)
rep("localStorage.getItem('sld_gas_url')||SLD_API", 'SLD_API', 2)
rep('เช่น ธวัชชัย/พงศธร', 'เช่น ชยพล/วีรยุทธ')
import hashlib
v = hashlib.sha1(open(os.path.join(here, 'demo.js'), 'rb').read()).hexdigest()[:8]
s = s.replace('__V__', v)
leak = [n for n in ['นทีธร','ธวัชชัย','กลวัชร','พุทธภงค์','กัมปนาทท์','พงศธร','อติวิทย์','สุรเชษฐ์','ราชภัฎ','พยงค์','ย่าร้อหมาด','บุญล่อง','มานศักดิ์','ชญานิน'] if n in s]
assert not leak, leak
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(s)
print('demo/index.html ok', v)
