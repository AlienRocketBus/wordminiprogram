#!/usr/bin/env python3
"""Portability measurement for 单词大冒险 v1163 snapshot -> native WeChat Mini Program.

Usage: python3 -I measure.py <snapshot_dir> <out_json>
Replicates package_release.py deploy-file rules (ext allowlist, excluded dirs,
runtime-HTML allowlist, root "_" files excluded) to measure the *deploy* set.
"""
import json, os, re, sys
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])

DEPLOY_ALLOWED_EXT = {".html", ".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg",
                      ".webp", ".mp3", ".wav", ".ogg", ".woff", ".woff2", ".ttf", ".ico",
                      ".webmanifest"}
DEPLOY_RUNTIME_HTML = {"index.html", "_frame.html", "_sw_upgrade_v944.html", "boss_hall.html",
                       "land_map.html", "season_showcase.html", "spelling_bee.html", "spelling_pk.html"}
DEPLOY_EXCLUDE_DIRS = {".git", ".github", "__pycache__", ".pytest_cache", ".mypy_cache",
                       ".ruff_cache", "node_modules", "releases", "release-assets",
                       "evolution_reports", ".evolution_backups", "map8", "newboss"}
DEPLOY_EXCLUDE_FILES = {"evolution_dashboard.html", "_viewer_js.js"}


def deploy_allowed(rel: PurePosixPath) -> bool:
    if rel.name in DEPLOY_EXCLUDE_FILES:
        return False
    if len(rel.parts) == 1 and rel.name.startswith("_") and rel.name not in {"_frame.html", "_sw_upgrade_v944.html"}:
        return False
    if rel.as_posix() == "VERSION":
        return True
    suf = rel.suffix.lower()
    if suf not in DEPLOY_ALLOWED_EXT:
        return False
    if suf == ".html" and not (rel.name in DEPLOY_RUNTIME_HTML or rel.name.startswith("island_")):
        return False
    return True


deploy = []
for d, dirs, files in os.walk(ROOT):
    dirs[:] = sorted(x for x in dirs if x not in DEPLOY_EXCLUDE_DIRS and not x.startswith("."))
    # skip release-output-like dirs (攻坚笔记 has md mostly; still walk)
    for f in sorted(files):
        p = Path(d) / f
        rel = PurePosixPath(*p.relative_to(ROOT).parts)
        if f.startswith(".") or p.is_symlink():
            continue
        if deploy_allowed(rel):
            deploy.append((p, rel))

# ---------- sizes by type ----------
TYPE = {".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".png": "image", ".jpg": "image",
        ".jpeg": "image", ".gif": "image", ".svg": "image", ".webp": "image", ".ico": "image",
        ".woff": "font", ".woff2": "font", ".ttf": "font", ".js": "js", ".html": "html",
        ".css": "css", ".webmanifest": "other"}
by_type = defaultdict(lambda: [0, 0])
by_dir = defaultdict(lambda: [0, 0])
by_ext = defaultdict(lambda: [0, 0])
for p, rel in deploy:
    sz = p.stat().st_size
    t = TYPE.get(rel.suffix.lower(), "other")
    by_type[t][0] += 1; by_type[t][1] += sz
    top = rel.parts[0] if len(rel.parts) > 1 else "<root>"
    by_dir[top][0] += 1; by_dir[top][1] += sz
    by_ext[rel.suffix.lower()][0] += 1; by_ext[rel.suffix.lower()][1] += sz
largest = sorted(((p.stat().st_size, rel.as_posix()) for p, rel in deploy), reverse=True)[:40]

# ---------- JS / HTML code ----------
SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
STYLE_RE = re.compile(r"<style\b[^>]*>(.*?)</style>", re.S | re.I)
SRC_RE = re.compile(r"src\s*=\s*['\"]([^'\"]+)['\"]", re.I)

html_files = [(p, rel) for p, rel in deploy if rel.suffix == ".html"]
js_files = [(p, rel) for p, rel in deploy if rel.suffix == ".js"]

def nlines(s):
    return s.count("\n") + (1 if s and not s.endswith("\n") else 0)

def nonblank(s):
    return sum(1 for l in s.splitlines() if l.strip())

html_info = {}
inline_js_by_page = {}
inline_css_by_page = {}
script_refs = defaultdict(set)
for p, rel in html_files:
    t = p.read_text(encoding="utf-8", errors="replace")
    inline = []
    for attrs, body in SCRIPT_RE.findall(t):
        m = SRC_RE.search(attrs)
        if m:
            script_refs[m.group(1).split("?")[0]].add(rel.name)
        elif body.strip() and "application/ld+json" not in attrs and "text/template" not in attrs:
            inline.append(body)
    css = STYLE_RE.findall(t)
    inline_js_by_page[rel.name] = "\n".join(inline)
    inline_css_by_page[rel.name] = "\n".join(css)
    html_info[rel.name] = {
        "bytes": p.stat().st_size,
        "inline_script_blocks": len(inline),
        "inline_js_lines": nlines("\n".join(inline)),
        "inline_js_nonblank": nonblank("\n".join(inline)),
        "inline_js_bytes": len("\n".join(inline).encode()),
        "inline_css_lines": nlines("\n".join(css)),
        "inline_css_bytes": len("\n".join(css).encode()),
        "external_scripts": sum(1 for a, _ in SCRIPT_RE.findall(t) if SRC_RE.search(a)),
        "markup_bytes_excl_script_style": len(STYLE_RE.sub("", SCRIPT_RE.sub("", t)).encode()),
    }

VENDOR = lambda n: n.startswith("vendor_")
DATA_JS = {"vocab_all.js", "word_map.js", "sentence_map.js"}
js_info = {}
for p, rel in js_files:
    t = p.read_text(encoding="utf-8", errors="replace")
    js_info[rel.as_posix()] = {"bytes": p.stat().st_size, "lines": nlines(t), "nonblank": nonblank(t),
                               "vendor": VENDOR(rel.name), "data": rel.name in DATA_JS,
                               "max_line_len": max((len(l) for l in t.splitlines()), default=0),
                               "referenced_by_pages": len(script_refs.get(rel.as_posix(), ()))}

# Unique inline code: island pages are generated from template.html / land_template.html,
# so dedupe identical inline bodies by hash, and also report template-only counts.
import hashlib
uniq_inline = {}
for name, body in inline_js_by_page.items():
    h = hashlib.sha1(body.encode()).hexdigest()
    uniq_inline.setdefault(h, []).append(name)

# ---------- API usage counts ----------
PATTERNS = {
    "document.*": r"\bdocument\.",
    "innerHTML": r"\.innerHTML\b",
    "outerHTML": r"\.outerHTML\b",
    "insertAdjacentHTML": r"\binsertAdjacentHTML\b",
    "createElement": r"\bcreateElement(?:NS)?\s*\(",
    "querySelector(All)": r"\bquerySelector(?:All)?\s*\(",
    "getElementById": r"\bgetElementById\s*\(",
    "getElementsBy*": r"\bgetElementsBy\w+\s*\(",
    "addEventListener": r"\baddEventListener\s*\(",
    "removeEventListener": r"\bremoveEventListener\s*\(",
    "inline on*= attr handlers (onclick= etc, in HTML/JS strings)": r"\bon(?:click|touchstart|touchend|input|change|load|error|keydown|keyup|pointerdown|pointerup|mousedown|submit)\s*=\s*['\"]",
    ".style.* manipulation": r"\.style\.\w+|\.style\s*\[|\.style\.cssText|setProperty\s*\(",
    "classList": r"\.classList\.",
    "setAttribute/getAttribute/dataset": r"\b(?:set|get|remove)Attribute\s*\(|\.dataset\.",
    "appendChild/insertBefore/remove/replaceChild": r"\.(?:appendChild|insertBefore|replaceChild|removeChild|append|prepend)\s*\(|\.remove\s*\(\s*\)",
    "getBoundingClientRect": r"\bgetBoundingClientRect\s*\(",
    "elementFromPoint": r"\belementsFromPoint\s*\(|\belementFromPoint\s*\(",
    "offsetWidth/Height/Top/Left, clientWidth etc": r"\.(?:offset|client|scroll)(?:Width|Height|Top|Left)\b",
    "getComputedStyle": r"\bgetComputedStyle\s*\(",
    "MutationObserver": r"\bMutationObserver\b",
    "IntersectionObserver": r"\bIntersectionObserver\b",
    "ResizeObserver": r"\bResizeObserver\b",
    "requestAnimationFrame": r"\brequestAnimationFrame\s*\(",
    "setTimeout/setInterval": r"\bset(?:Timeout|Interval)\s*\(",
    "element.animate (WAAPI)": r"\.animate\s*\(\s*[\[{]",
    "iframe (string)": r"\biframe\b",
    "islandFrame": r"islandFrame",
    "window.top": r"\bwindow\.top\b|\btop\.(?:location|document|window|postMessage|\w+)\b",
    "window.parent / parent.": r"\bwindow\.parent\b|(?<![\w.])parent\.(?:location|document|window|postMessage|[A-Za-z_$][\w$]*)",
    "postMessage": r"\bpostMessage\s*\(",
    "message event listener": r"addEventListener\s*\(\s*['\"]message['\"]",
    "contentWindow/contentDocument": r"\bcontent(?:Window|Document)\b",
    "location.href/replace/reload/assign": r"\blocation\.(?:href|replace|reload|assign|search|hash)\b",
    "history.*": r"\bhistory\.(?:pushState|replaceState|back|go)\b",
    "window.open": r"\bwindow\.open\s*\(",
    "localStorage": r"\blocalStorage\b",
    "sessionStorage": r"\bsessionStorage\b",
    "indexedDB": r"\bindexedDB\b",
    "document.cookie": r"\bdocument\.cookie\b",
    "caches (CacheStorage)": r"\bcaches\.(?:open|match|keys|delete)\b",
    "serviceWorker": r"\bserviceWorker\b",
    "BroadcastChannel": r"\bBroadcastChannel\b",
    "storage event": r"addEventListener\s*\(\s*['\"]storage['\"]",
    "new Audio / HTMLAudioElement": r"\bnew\s+Audio\s*\(|\bHTMLAudioElement\b|createElement\s*\(\s*['\"]audio['\"]",
    ".play() calls": r"\.play\s*\(\s*\)",
    "AudioContext / webkitAudioContext": r"\b(?:webkit)?AudioContext\b",
    "createOscillator/createGain/decodeAudioData/createBufferSource": r"\b(?:createOscillator|createGain|decodeAudioData|createBufferSource|createBiquadFilter|createDynamicsCompressor)\s*\(",
    "speechSynthesis / SpeechSynthesisUtterance": r"\bspeechSynthesis\b|\bSpeechSynthesisUtterance\b",
    "SpeechRecognition": r"\b(?:webkit)?SpeechRecognition\b",
    "navigator.vibrate": r"\bnavigator\.vibrate\b",
    "canvas getContext": r"\bgetContext\s*\(\s*['\"](?:2d|webgl)",
    "<canvas> / createElement('canvas')": r"<canvas\b|createElement\s*\(\s*['\"]canvas['\"]",
    "toDataURL/toBlob": r"\.to(?:DataURL|Blob)\s*\(",
    "fetch(": r"(?<![\w.])fetch\s*\(",
    "XMLHttpRequest": r"\bXMLHttpRequest\b",
    "WebSocket": r"\bWebSocket\b",
    "dynamic import(": r"(?<![\w.$])import\s*\(",
    "ES module import/export statements": r"^\s*(?:import\s+[\w{*]|export\s+(?:default|const|function|class|\{|let|var))",
    "type=module script": r"type\s*=\s*['\"]module['\"]",
    "eval(": r"(?<![\w.$])eval\s*\(",
    "new Function(": r"\bnew\s+Function\s*\(",
    "setTimeout with string arg": r"set(?:Timeout|Interval)\s*\(\s*['\"]",
    "with(/document.write": r"\bdocument\.write(?:ln)?\s*\(",
    "Blob / URL.createObjectURL": r"\bURL\.createObjectURL\b|\bnew\s+Blob\s*\(",
    "FileReader / input type=file": r"\bFileReader\b|type\s*=\s*['\"]file['\"]",
    "clipboard / execCommand": r"\bnavigator\.clipboard\b|\bexecCommand\s*\(",
    "visibilitychange/pagehide/beforeunload": r"['\"](?:visibilitychange|pagehide|pageshow|beforeunload|unload)['\"]",
    "touch events": r"['\"]touch(?:start|move|end|cancel)['\"]",
    "pointer events": r"['\"]pointer(?:down|move|up|cancel)['\"]",
    "keyboard events / <input>": r"['\"]key(?:down|up|press)['\"]",
    "focus()/blur() (keyboard input)": r"\.focus\s*\(\s*\)|\.blur\s*\(\s*\)",
    "navigator.userAgent / MicroMessenger": r"\buserAgent\b|MicroMessenger",
    "WeixinJSBridge / wx. JSSDK": r"\bWeixinJSBridge\b|\bwx\.(?:config|ready|miniProgram)\b",
    "window.cloudbase / tcb": r"\bcloudbase\.|\btcb\b|cloudbase\.init",
    "Worker (web worker)": r"\bnew\s+(?:Shared)?Worker\s*\(",
    "performance.*": r"\bperformance\.(?:now|mark|measure|memory|getEntries)",
    "window.* global assignment": r"\bwindow\.[A-Za-z_$][\w$]*\s*=(?!=)",
    "prompt/alert/confirm": r"(?<![\w.$])(?:window\.)?(?:alert|confirm|prompt)\s*\(",
    "matchMedia": r"\bmatchMedia\s*\(",
    "Proxy / defineProperty": r"\bnew\s+Proxy\s*\(|Object\.defineProperty\s*\(",
    "Storage.prototype patch": r"Storage\.prototype",
}
CRE = {k: re.compile(v, re.M) for k, v in PATTERNS.items()}

def count_in(text):
    return {k: len(r.findall(text)) for k, r in CRE.items()}

def add(a, b):
    for k, v in b.items():
        a[k] = a.get(k, 0) + v

own_js_counts = {}
vendor_js_counts = {}
per_file_counts = {}
for p, rel in js_files:
    t = p.read_text(encoding="utf-8", errors="replace")
    c = count_in(t)
    per_file_counts[rel.as_posix()] = c
    if VENDOR(rel.name):
        add(vendor_js_counts, c)
    elif rel.name != "sw_v944.js":
        add(own_js_counts, c)

# inline: count unique bodies once (dedupe island copies), and also all pages
inline_counts_unique = {}
for h, names in uniq_inline.items():
    add(inline_counts_unique, count_in(inline_js_by_page[names[0]]))
inline_counts_all = {}
for name, body in inline_js_by_page.items():
    add(inline_counts_all, count_in(body))

# ---------- localStorage keys ----------
LS_LIT = re.compile(r"localStorage\s*(?:\.\s*(?:getItem|setItem|removeItem)\s*\(\s*|\[\s*)(['\"`])([^'\"`]{1,80})\1")
LS_ANY_STR_KEY = re.compile(r"(['\"])((?:hansen|wa_|hb|sb_|hbu|word|island|boss|pet|coin|gem|diamond|card|theme|season|tcb|cloud|pk|gear|quest)[\w\-:.]{1,60})\1")
keys = Counter()
key_files = defaultdict(set)
all_code = []
for p, rel in js_files:
    if VENDOR(rel.name):
        continue
    all_code.append((rel.as_posix(), p.read_text(encoding="utf-8", errors="replace")))
for h, names in uniq_inline.items():
    all_code.append(("inline:" + names[0] + (f"(+{len(names)-1} copies)" if len(names) > 1 else ""), inline_js_by_page[names[0]]))
for name, t in all_code:
    for m in LS_LIT.finditer(t):
        keys[m.group(2)] += 1
        key_files[m.group(2)].add(name)
dyn_keys = 0
DYN = re.compile(r"localStorage\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(?!['\"`])")
for name, t in all_code:
    dyn_keys += len(DYN.findall(t))
prefix = Counter()
for k in keys:
    m = re.match(r"([A-Za-z]+[_\-]?)", k)
    prefix[m.group(1) if m else k[:4]] += 1

# ---------- CSS features (inline <style> in HTML deduped + any style strings in JS) ----------
CSS_PATTERNS = {
    "@keyframes": r"@keyframes\b",
    "animation:": r"(?<![-\w])animation(?:-name)?\s*:",
    "transition:": r"(?<![-\w])transition\s*:",
    "transform:": r"(?<![-\w])transform\s*:",
    "filter:": r"(?<![-\w])filter\s*:",
    "backdrop-filter": r"backdrop-filter\s*:",
    "-webkit-backdrop-filter": r"-webkit-backdrop-filter\s*:",
    "mix-blend-mode": r"mix-blend-mode\s*:",
    "clip-path": r"clip-path\s*:",
    "mask/-webkit-mask": r"(?:-webkit-)?mask(?:-image)?\s*:",
    "vh/vw/dvh/svh units": r"\d(?:d|s|l)?v[hw]\b",
    "dvh/svh/lvh units": r"\d[dsl]v[hw]\b",
    "position:fixed": r"position\s*:\s*fixed",
    "position:sticky": r"position\s*:\s*sticky",
    "z-index": r"z-index\s*:",
    "@font-face": r"@font-face",
    "font-family": r"font-family\s*:",
    "linear/radial/conic-gradient": r"(?:linear|radial|conic)-gradient\s*\(",
    "box-shadow": r"box-shadow\s*:",
    "text-shadow": r"text-shadow\s*:",
    "var(--)": r"var\(\s*--",
    "custom property decl --x:": r"(?<![\w-])--[\w-]+\s*:",
    "calc(": r"calc\s*\(",
    "env(safe-area-inset": r"env\(\s*safe-area-inset",
    "@media": r"@media\b",
    "@supports": r"@supports\b",
    ":has(": r":has\(",
    "::before/::after": r"::?(?:before|after)\b",
    "!important": r"!important",
    "grid": r"display\s*:\s*(?:inline-)?grid",
    "flex": r"display\s*:\s*(?:inline-)?flex",
    "will-change": r"will-change\s*:",
    "aspect-ratio": r"aspect-ratio\s*:",
    "url( in css": r"url\(",
    "hover": r":hover\b",
    "pointer-events": r"pointer-events\s*:",
    "user-select": r"user-select\s*:",
    "-webkit-text-stroke": r"-webkit-text-stroke",
    "background-clip:text": r"background-clip\s*:\s*text",
    "*-selectors (universal)": r"(?:^|[\s,>{}])\*\s*[{,]",
}
CSSRE = {k: re.compile(v, re.M | re.I) for k, v in CSS_PATTERNS.items()}
uniq_css = {}
for name, css in inline_css_by_page.items():
    uniq_css.setdefault(hashlib.sha1(css.encode()).hexdigest(), []).append(name)
css_counts_unique = {k: 0 for k in CSS_PATTERNS}
css_lines_unique = 0
for h, names in uniq_css.items():
    css = inline_css_by_page[names[0]]
    css_lines_unique += nlines(css)
    for k, r in CSSRE.items():
        css_counts_unique[k] += len(r.findall(css))
css_in_js = {k: 0 for k in CSS_PATTERNS}
for p, rel in js_files:
    if VENDOR(rel.name):
        continue
    t = p.read_text(encoding="utf-8", errors="replace")
    for k, r in CSSRE.items():
        css_in_js[k] += len(r.findall(t))
# separate .css files
css_files = [(p, rel) for p, rel in deploy if rel.suffix == ".css"]

# ---------- external URLs / CDNs ----------
URL_RE = re.compile(r"https?://[A-Za-z0-9.\-]+(?:/[^\s'\"`)<>]*)?")
hosts = Counter()
host_files = defaultdict(set)
for p, rel in js_files + html_files:
    t = p.read_text(encoding="utf-8", errors="replace")
    for m in URL_RE.finditer(t):
        host = re.match(r"https?://([^/]+)", m.group(0)).group(1)
        hosts[host] += 1
        host_files[host].add(rel.as_posix())

# ---------- distinct screens: count top-level overlay/modal/screen ids in index + template ----------
def ids_like(t):
    return sorted(set(re.findall(r"id\s*=\s*['\"]([\w\-]*(?:screen|Screen|modal|Modal|overlay|Overlay|panel|Panel|page|Page|popup|Popup|dialog|Dialog|layer|Layer|sheet|Sheet|view|View)[\w\-]*)['\"]", t)))
screens = {}
for n in ["index.html", "template.html", "land_template.html", "boss_hall.html", "spelling_bee.html",
          "spelling_pk.html", "season_showcase.html", "land_map.html", "_frame.html"]:
    p = ROOT / n
    if p.exists():
        t = p.read_text(encoding="utf-8", errors="replace")
        screens[n] = ids_like(t)
# JS-created overlays: id strings assigned in JS
js_overlay_ids = set()
for name, t in all_code:
    for m in re.finditer(r"\.id\s*=\s*['\"]([\w\-]+)['\"]", t):
        if re.search(r"(?i)modal|overlay|panel|popup|dialog|layer|sheet|screen|mask|toast|banner|view", m.group(1)):
            js_overlay_ids.add(m.group(1))

# ---------- totals ----------
own_js = {k: v for k, v in js_info.items() if not v["vendor"]}
tot = {
    "deploy_files": len(deploy),
    "deploy_bytes": sum(p.stat().st_size for p, _ in deploy),
    "html_pages_deploy": len(html_files),
    "js_files_deploy": len(js_files),
    "js_own_files": sum(1 for v in own_js.values()),
    "js_own_lines": sum(v["lines"] for v in own_js.values()),
    "js_own_nonblank": sum(v["nonblank"] for v in own_js.values()),
    "js_own_bytes": sum(v["bytes"] for v in own_js.values()),
    "js_own_logic_lines(excl data files)": sum(v["lines"] for v in own_js.values() if not v["data"]),
    "js_own_logic_bytes(excl data files)": sum(v["bytes"] for v in own_js.values() if not v["data"]),
    "js_vendor_files": sum(1 for v in js_info.values() if v["vendor"]),
    "js_vendor_bytes": sum(v["bytes"] for v in js_info.values() if v["vendor"]),
    "js_vendor_lines": sum(v["lines"] for v in js_info.values() if v["vendor"]),
    "inline_js_lines_all_pages": sum(v["inline_js_lines"] for v in html_info.values()),
    "inline_js_bytes_all_pages": sum(v["inline_js_bytes"] for v in html_info.values()),
    "inline_js_unique_bodies": len(uniq_inline),
    "inline_js_lines_unique": sum(nlines(inline_js_by_page[n[0]]) for n in uniq_inline.values()),
    "inline_js_nonblank_unique": sum(nonblank(inline_js_by_page[n[0]]) for n in uniq_inline.values()),
    "inline_js_bytes_unique": sum(len(inline_js_by_page[n[0]].encode()) for n in uniq_inline.values()),
    "inline_css_unique_bodies": len(uniq_css),
    "inline_css_lines_unique": css_lines_unique,
    "css_files": [r.as_posix() for _, r in css_files],
    "localStorage_literal_keys": len(keys),
    "localStorage_dynamic_key_calls": dyn_keys,
}

res = {
    "totals": tot,
    "by_type": {k: {"files": v[0], "bytes": v[1], "MB": round(v[1] / 1048576, 2)} for k, v in sorted(by_type.items(), key=lambda x: -x[1][1])},
    "by_dir": {k: {"files": v[0], "bytes": v[1], "MB": round(v[1] / 1048576, 2)} for k, v in sorted(by_dir.items(), key=lambda x: -x[1][1])},
    "by_ext": {k: {"files": v[0], "MB": round(v[1] / 1048576, 2)} for k, v in sorted(by_ext.items(), key=lambda x: -x[1][1])},
    "largest_files": [{"bytes": b, "path": n} for b, n in largest],
    "html_info": html_info,
    "uniq_inline_groups": {h[:8]: names for h, names in uniq_inline.items()},
    "uniq_css_groups": {h[:8]: names for h, names in uniq_css.items()},
    "js_info": js_info,
    "api_counts_own_js_modules": own_js_counts,
    "api_counts_inline_unique": inline_counts_unique,
    "api_counts_inline_all_pages": inline_counts_all,
    "api_counts_vendor": vendor_js_counts,
    "api_counts_per_file": per_file_counts,
    "localStorage_keys": dict(keys.most_common()),
    "localStorage_key_files": {k: sorted(v) for k, v in key_files.items()},
    "localStorage_key_prefixes": dict(prefix.most_common()),
    "css_counts_inline_unique": css_counts_unique,
    "css_counts_in_own_js": css_in_js,
    "external_hosts": dict(hosts.most_common()),
    "external_host_files": {k: sorted(v)[:10] for k, v in host_files.items()},
    "screens_ids": screens,
    "js_created_overlay_ids": sorted(js_overlay_ids),
    "script_refs": {k: sorted(v) for k, v in script_refs.items()},
}
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print(json.dumps(tot, ensure_ascii=False, indent=1))
