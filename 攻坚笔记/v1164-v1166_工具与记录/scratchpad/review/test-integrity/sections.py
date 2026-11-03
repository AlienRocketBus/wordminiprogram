"""Make per-section variants of a v1164 cloud test: keep the shared prelude/epilogue, keep only section K.
Sections start at lines matching '/* ══ <circled digit>' inside the main try block."""
import re, sys, os
src_path, out_dir = sys.argv[1], sys.argv[2]
src = open(src_path, encoding='utf-8').read()
lines = src.split('\n')
starts = [i for i, l in enumerate(lines) if re.match(r'\s*/\* ══ [①②③④⑤⑥⑦⑧⑨]', l)]
end = max(i for i, l in enumerate(lines) if re.match(r'\}\s*catch\s*\(e\)\s*\{', l))
base = os.path.basename(src_path)
for k, s in enumerate(starts):
    e = starts[k + 1] if k + 1 < len(starts) else end
    keep = lines[:starts[0]] + lines[s:e] + lines[end:]
    name = base.replace('.mjs', '__sec%d.mjs' % (k + 1))
    open(os.path.join(out_dir, name), 'w', encoding='utf-8').write('\n'.join(keep))
    print(name, 'lines', s + 1, '-', e)
