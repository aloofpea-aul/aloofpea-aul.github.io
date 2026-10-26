import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read().replace('\r\n', '\n')
a = '<meta charset="UTF-8">'
assert s.count(a) == 2
s = s.replace(a, a + '\n<script src="contractor-shim.js?v=1"></script>', 1)
s = s.replace('<title>Contractor Portal — PEA CCL</title>', '<title>Contractor Portal — PEA CCL</title>\n<meta name="theme-color" content="#0D2B5E">', 1)
j = s.rindex('</body>')
s = s[:j] + '<script src="contractor-extra.js?v=1"></script>\n' + s[j:]
open(dst, 'w', encoding='utf-8').write(s)
print('ok', len(s))
