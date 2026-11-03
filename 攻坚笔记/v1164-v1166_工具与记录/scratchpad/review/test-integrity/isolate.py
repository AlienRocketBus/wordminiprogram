"""Variant of a v1164 cloud test where each section runs in its own try/catch, so a crash in one
section (typical on v1163) does not hide the verdict of the later sections."""
import re, sys, os
src_path, out_path = sys.argv[1], sys.argv[2]
lines = open(src_path, encoding='utf-8').read().split('\n')
t0 = next(i for i, l in enumerate(lines) if l.strip() == 'try {' and not l.startswith(' '))
end = max(i for i, l in enumerate(lines) if re.match(r'\}\s*catch\s*\(e\)\s*\{', l))
starts = [i for i, l in enumerate(lines) if re.match(r'\s*/\* ══ [①②③④⑤⑥⑦⑧⑨]', l)]
out = []
for i, l in enumerate(lines):
    if t0 < i < end:
        l = re.sub(r'^  (const|let) ', '  var ', l)
        if i in starts:
            if i != starts[0]:
                out.append("  } catch (e) { await t.ok(false, '本段脚本出错：' + String(e && e.message || e).slice(0, 200)); }")
            out.append('  try {')
    if i == end:
        out.append("  } catch (e) { await t.ok(false, '本段脚本出错：' + String(e && e.message || e).slice(0, 200)); }")
    out.append(l)
open(out_path, 'w', encoding='utf-8').write('\n'.join(out))
