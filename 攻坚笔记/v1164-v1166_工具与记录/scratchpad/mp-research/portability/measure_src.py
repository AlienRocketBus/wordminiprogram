#!/usr/bin/env python3
"""Second pass: count code over the *source of truth* (templates, not 27 generated copies).
Usage: python3 -I measure_src.py <snapshot_dir> <measure.json> <out_json>
"""
import json, re, sys, difflib, importlib.util
from pathlib import Path

ROOT = Path(sys.argv[1]); M = json.load(open(sys.argv[2], encoding="utf-8")); OUT = Path(sys.argv[3])


SCRIPT_RE = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
STYLE_RE = re.compile(r"<style\b[^>]*>(.*?)</style>", re.S | re.I)

def inline(name):
    t = (ROOT / name).read_text(encoding="utf-8")
    return [b for a, b in SCRIPT_RE.findall(t) if "src=" not in a.lower() and b.strip()]

def css(name):
    t = (ROOT / name).read_text(encoding="utf-8")
    return STYLE_RE.findall(t)

tpl = "\n".join(inline("template.html")).splitlines()
land = "\n".join(inline("land_template.html")).splitlines()
sm = difflib.SequenceMatcher(None, tpl, land, autojunk=False)
land_only = []
for op, i1, i2, j1, j2 in sm.get_opcodes():
    if op in ("replace", "insert"):
        land_only += land[j1:j2]

OTHER = ["index.html", "spelling_bee.html", "spelling_pk.html", "boss_hall.html", "season_showcase.html",
         "land_map.html", "_frame.html", "_sw_upgrade_v944.html"]
src_inline = {"template.html": "\n".join(tpl), "land_template.html(diff vs template)": "\n".join(land_only)}
for n in OTHER:
    src_inline[n] = "\n".join(inline(n))

def nl(s):
    return len(s.splitlines())
def nb(s):
    return sum(1 for l in s.splitlines() if l.strip())
# Data-heavy lines (> 2000 chars) are data (word lists / base64), not logic
def logic_lines(s):
    return sum(1 for l in s.splitlines() if l.strip() and len(l) <= 2000)
def data_bytes(s):
    return sum(len(l.encode()) for l in s.splitlines() if len(l) > 2000)

inline_stats = {k: {"lines": nl(v), "nonblank": nb(v), "logic_lines(<=2000ch)": logic_lines(v),
                    "bytes": len(v.encode()), "data_line_bytes(>2000ch)": data_bytes(v)} for k, v in src_inline.items()}

# CSS from source templates
tpl_css = "\n".join(css("template.html")); land_css = "\n".join(css("land_template.html"))
csm = difflib.SequenceMatcher(None, tpl_css.splitlines(), land_css.splitlines(), autojunk=False)
land_css_only = []
for op, i1, i2, j1, j2 in csm.get_opcodes():
    if op in ("replace", "insert"):
        land_css_only += land_css.splitlines()[j1:j2]
src_css = {"template.html": tpl_css, "land_template.html(diff)": "\n".join(land_css_only)}
for n in OTHER:
    src_css[n] = "\n".join(css(n))
# island_season extra css comes from island_data.json extra_css
data = json.load(open(ROOT / "island_data.json", encoding="utf-8"))
extra = "\n".join(d.get("extra_css", "") for d in data.values())
src_css["island_data.json extra_css(all islands)"] = extra
css_stats = {k: {"lines": nl(v), "bytes": len(v.encode())} for k, v in src_css.items()}

# Markup (HTML minus script/style) of templates -> WXML work
def markup(name):
    t = (ROOT / name).read_text(encoding="utf-8")
    return STYLE_RE.sub("", SCRIPT_RE.sub("", t))
markup_stats = {}
for n in ["template.html", "land_template.html"] + OTHER:
    m = markup(n)
    markup_stats[n] = {"bytes": len(m.encode()), "lines": nl(m),
                       "elements": len(re.findall(r"<(?!/|!)[a-zA-Z][\w-]*", m)),
                       "onclick_attrs": len(re.findall(r"\bon[a-z]+\s*=", m))}

# own JS modules (logic)
own = {k: v for k, v in M["js_info"].items() if not v["vendor"]}
data_js = {"vocab_all.js", "word_map.js", "sentence_map.js"}
own_logic = {k: v for k, v in own.items() if k not in data_js and k != "sw_v944.js"}

# Exactly the same API pattern table as measure.py
import runpy
pat = runpy.run_path(str(Path(sys.argv[2]).parent / "patterns_only.py"))["PATTERNS"]
CRE = {k: re.compile(v, re.M) for k, v in pat.items()}
def count(text):
    return {k: len(r.findall(text)) for k, r in CRE.items()}
tot_inline = {k: 0 for k in pat}
per_src = {}
for k, v in src_inline.items():
    c = count(v); per_src[k] = c
    for a, b in c.items():
        tot_inline[a] += b
own_counts = M["api_counts_own_js_modules"]
grand = {k: own_counts.get(k, 0) + tot_inline[k] for k in pat}

res = {
    "inline_source_stats": inline_stats,
    "inline_source_total_lines": sum(v["lines"] for v in inline_stats.values()),
    "inline_source_total_logic_lines": sum(v["logic_lines(<=2000ch)"] for v in inline_stats.values()),
    "inline_source_total_bytes": sum(v["bytes"] for v in inline_stats.values()),
    "own_js_logic_modules": len(own_logic),
    "own_js_logic_lines": sum(v["lines"] for v in own_logic.values()),
    "own_js_logic_bytes": sum(v["bytes"] for v in own_logic.values()),
    "own_js_data_files": {k: own[k] for k in data_js if k in own},
    "sw": own.get("sw_v944.js"),
    "css_source_stats": css_stats,
    "css_source_total_lines": sum(v["lines"] for v in css_stats.values()),
    "markup_stats": markup_stats,
    "api_inline_source_total": tot_inline,
    "api_inline_per_source": per_src,
    "api_grand_total_source_of_truth(own modules + deduped inline)": grand,
}
OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
for k in ["inline_source_total_lines", "inline_source_total_logic_lines", "inline_source_total_bytes",
          "own_js_logic_modules", "own_js_logic_lines", "own_js_logic_bytes", "css_source_total_lines"]:
    print(k, res[k])
print(json.dumps(inline_stats, ensure_ascii=False, indent=0))
print(json.dumps(css_stats, ensure_ascii=False, indent=0))
print(json.dumps(markup_stats, ensure_ascii=False, indent=0))
