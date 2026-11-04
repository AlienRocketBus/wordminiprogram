#!/usr/bin/env python3
"""Static reference scan: find src/href/import/fetch/url()/asset-literal paths in runtime files of the
snapshot and check that each referenced file exists. Also: duplicate <script src> per HTML, ?v= stamps != VERSION,
sw precache list existence. Read-only."""
import os, re, json, sys, collections, urllib.parse
ROOT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot'
VER = open(os.path.join(ROOT, 'VERSION')).read().strip()
EXT = r'(?:js|mjs|css|png|jpe?g|webp|svg|gif|mp3|m4a|wav|ogg|mp4|woff2?|ttf|ico|json|html|webmanifest)'
runtime = []
for dp, dn, fn in os.walk(ROOT):
    rel = os.path.relpath(dp, ROOT)
    if rel.startswith(('__pycache__', 'docs', '.git', 'release-assets', '.github', '.devtools', 'evolution_reports')):
        continue
    for f in fn:
        p = os.path.normpath(os.path.join(rel, f))
        if f.endswith('.html') or f.endswith('.css') or f.endswith('.webmanifest') or (f.endswith('.js') and not f.startswith('test_')):
            runtime.append(p)
runtime.sort()
pat_attr = re.compile(r'''\b(?:src|href|poster|data-src|data-href|content)\s*=\s*["']([^"'<>]+)["']''', re.I)
pat_url = re.compile(r'''url\(\s*["']?([^"')]+)["']?\s*\)''')
pat_imp = re.compile(r'''(?:import\s*\(\s*|import\s+[^'"]*?from\s*|fetch\s*\(\s*|new\s+Audio\s*\(\s*|importScripts\s*\(\s*)["'`]([^"'`]+)["'`]''')
pat_lit = re.compile(r'''["'`]((?:\.{0,2}/)?[A-Za-z0-9_\-一-鿿./%]+\.''' + EXT + r''')(?:\?[^"'`\s]*)?["'`]''')
missing = collections.defaultdict(list)
checked = 0
def norm(ref):
    ref = ref.strip()
    if not ref or ref.startswith(('http:', 'https:', '//', 'data:', 'blob:', 'javascript:', 'mailto:', 'tel:', '#', 'about:', 'chrome:', 'wxp:', 'weixin:')):
        return None
    if any(t in ref for t in ('⟦', '${', '{{', '*', '+', ' ', '\\n')):
        return None
    ref = ref.split('#')[0].split('?')[0]
    if not ref or ref in ('.', '/'):
        return None
    if not re.search(r'\.' + EXT + '$', ref, re.I):
        return None
    return urllib.parse.unquote(ref)
for f in runtime:
    full = os.path.join(ROOT, f)
    try:
        txt = open(full, encoding='utf-8', errors='replace').read()
    except Exception:
        continue
    base = os.path.dirname(f) if f.endswith('.html') or f.endswith('.css') else ''
    if f.startswith('map8/') and f.endswith('.js'):
        base = 'map8'
    refs = set()
    for rx in (pat_attr, pat_url, pat_imp, pat_lit):
        for m in rx.finditer(txt):
            r = norm(m.group(1))
            if r:
                line = txt.count('\n', 0, m.start()) + 1
                refs.add((r, line))
    for r, line in sorted(refs):
        checked += 1
        cand = os.path.normpath(os.path.join(ROOT, r.lstrip('/'))) if r.startswith('/') else os.path.normpath(os.path.join(ROOT, base, r))
        if os.path.exists(cand):
            continue
        # JS executed from root page: also try root
        alt = os.path.normpath(os.path.join(ROOT, r))
        if os.path.exists(alt):
            continue
        missing[f].append((r, line))
print('runtime files scanned:', len(runtime), ' refs checked:', checked)
print('== MISSING (file -> ref @line) ==')
for f in sorted(missing):
    for r, line in missing[f]:
        print('%s:%d -> %s' % (f, line, r))
# duplicate script includes + version stamps in HTML
print('\n== DUPLICATE <script src> within one HTML ==')
stamp_bad = collections.defaultdict(list)
for f in runtime:
    if not f.endswith('.html'):
        continue
    txt = open(os.path.join(ROOT, f), encoding='utf-8', errors='replace').read()
    nocom = re.sub(r'<!--[\s\S]*?-->', '', txt)
    srcs = re.findall(r'<script\b[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']', nocom, re.I)
    c = collections.Counter(s.split('?')[0] for s in srcs)
    d = {k: v for k, v in c.items() if v > 1}
    if d:
        print(f, d)
    for m in re.finditer(r'''(?:src|href)\s*=\s*["']([^"']+\?(?:[^"']*&)?v=([^&"']+)[^"']*)["']''', nocom):
        if m.group(2) != VER:
            stamp_bad[f].append(m.group(1))
print('\n== ?v= stamps != %s in HTML (outside comments) ==' % VER)
for f in sorted(stamp_bad):
    c = collections.Counter(stamp_bad[f])
    print(f, len(stamp_bad[f]), list(c.items())[:8])
# JS-level ?v= literals
print('\n== ?v=NNN literals in runtime JS that != VERSION ==')
for f in runtime:
    if not f.endswith('.js'):
        continue
    txt = open(os.path.join(ROOT, f), encoding='utf-8', errors='replace').read()
    code = re.sub(r'/\*[\s\S]*?\*/', '', txt)
    code = re.sub(r'(^|[^:])//[^\n]*', r'\1', code)
    vals = collections.Counter(re.findall(r'[?&]v=(\d{3,4})\b', code))
    vals.pop(VER, None)
    if vals:
        print(f, dict(vals))
