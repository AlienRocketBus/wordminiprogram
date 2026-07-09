#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
贾维斯 2.0 · 超级全域体检引擎 (jarvis_scan.py)
════════════════════════════════════════════════════════════════════════
Hansen「全面进化贾维斯·让小程序达到最完美状态」——从"记住的 bug 不复发"(被动守卫)
跃升为"把整个代码库当陌生系统全方位 X 光扫描"的主动体检超级智能体。

设计原则:
  · 纯静态分析·秒级跑完(不依赖长驻浏览器/服务器·抗环境进程收割)
  · 8 大主动扫描器·每个独立·发现即定位到文件:行
  · 三级严重度(CRIT致命/WARN警告/INFO提示)·加权健康分
  · 产出: 控制台摘要 + 可视化 HTML 体检报告(体检仪表盘)
  · 与 check_resources(防复发) / hansen_evolve(使命体检) 三足鼎立·互补不重叠

用法:
  python3 jarvis_scan.py            # 全域体检 + 生成报告
  python3 jarvis_scan.py --quiet    # 只出健康分(CI 友好)
  python3 jarvis_scan.py --report   # 额外打开报告路径
════════════════════════════════════════════════════════════════════════
"""
import os, re, sys, glob, json, html, hashlib, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
CRIT, WARN, INFO = "CRIT", "WARN", "INFO"
W_CRIT, W_WARN = 8.0, 2.0   # 每个致命扣8·每个警告扣2·INFO不扣分

def read(p):
    try:
        with open(p, encoding="utf-8", errors="replace") as f: return f.read()
    except Exception: return ""

def rel(p): return os.path.relpath(p, ROOT)

def lineno(text, idx):
    return text.count("\n", 0, idx) + 1

def html_files():
    return sorted(glob.glob(os.path.join(ROOT, "*.html")))
def js_files():
    return sorted(glob.glob(os.path.join(ROOT, "*.js")))
def all_code():
    return html_files() + js_files()

# ══════════════════════════════════════════════════════════════════
class Report:
    def __init__(self):
        self.items = []   # (sev, scanner, title, where, detail)
    def add(self, sev, scanner, title, where="", detail=""):
        self.items.append({"sev": sev, "scanner": scanner, "title": title, "where": where, "detail": detail})
    def by_sev(self, sev): return [i for i in self.items if i["sev"] == sev]
    def score(self):
        s = 100.0 - W_CRIT*len(self.by_sev(CRIT)) - W_WARN*len(self.by_sev(WARN))
        return max(0.0, round(s, 1))

# ══════════════════════════════════════════════════════════════════
# 扫描器 1: 资源引用完整性 (死链 + 孤儿)
#   死链: HTML/JS 里引用了 src/href 的 .js/.css/.png/.mp3 等但文件不存在
#   孤儿: 磁盘上存在的资源文件, 但全库无任何引用(可安全清理·省体积)
# ══════════════════════════════════════════════════════════════════
_REF_RE = re.compile(r"""(?:src|href)\s*=\s*["']([^"'#?]+\.(?:js|css|png|jpg|jpeg|gif|svg|mp3|wav|webp|woff2?|ttf))(?:\?[^"']*)?["']""", re.I)
_JS_REF_RE = re.compile(r"""['"]([\w\-./]+\.(?:png|jpg|jpeg|gif|svg|mp3|wav|webp))(?:\?[^'"]*)?['"]""", re.I)

def scan_resources(rep):
    referenced = set()
    for p in all_code():
        t = read(p)
        for m in _REF_RE.finditer(t):
            ref = m.group(1).lstrip("./")
            referenced.add(ref)
            if not os.path.exists(os.path.join(ROOT, ref)):
                rep.add(CRIT, "资源完整性", "死链: 引用了不存在的文件", "%s:%d" % (rel(p), lineno(t, m.start())), ref)
        # JS 里字符串形式引用的媒体(bosses/xxx.png 等)
        for m in _JS_REF_RE.finditer(t):
            ref = m.group(1).lstrip("./")
            if "/" in ref or ref.endswith((".png",".mp3",".svg")):
                referenced.add(ref)
    # 孤儿检测(只查会明显占体积的媒体目录)
    orphan_exts = (".png",".jpg",".jpeg",".gif",".mp3",".wav",".webp")
    disk = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules","evolution_reports",".evolution_backups","releases")]
        for fn in files:
            if fn.lower().endswith(orphan_exts):
                disk.append(os.path.relpath(os.path.join(root, fn), ROOT))
    orphans = []
    for d in disk:
        base = os.path.basename(d)
        if d not in referenced and base not in referenced and not any(base in r for r in referenced):
            try: sz = os.path.getsize(os.path.join(ROOT, d))
            except Exception: sz = 0
            orphans.append((sz, d))
    if orphans:
        orphans.sort(reverse=True)
        total_kb = sum(s for s,_ in orphans) // 1024
        # 汇总一条(不逐个刷屏)+ 只单列 top8 最大的(便于优先清理)
        rep.add(INFO, "资源完整性", "孤儿资源共 %d 个·合计 %dKB(全库无引用·可清理省体积)" % (len(orphans), total_kb),
                "%s 等" % os.path.basename(orphans[0][1]), "疑早期生成素材残留·动态拼接引用者请忽略")
        for sz, d in orphans[:8]:
            if sz > 20*1024:
                rep.add(INFO, "资源完整性", "  ↳ 大孤儿 %dKB" % (sz//1024), d, "")

# ══════════════════════════════════════════════════════════════════
# 扫描器 2: 缓存戳一致性
#   全库 ?v=XXX 必须统一为当前 VERSION; 裸 ?v= (无号) 或旧号 = CDN 缓存地雷
# ══════════════════════════════════════════════════════════════════
def scan_cache_stamp(rep):
    ver = read(os.path.join(ROOT, "VERSION")).strip()
    if not ver: return
    # 只查【真实资源引用】上的戳: src/href="xxx.js?v=NNN" —— 排除 URL 构造/正则匹配/报告文本里的裸 ?v=
    stamp_re = re.compile(r"""(?:src|href)\s*=\s*["'][^"']+\.(?:js|css|png|jpg|jpeg|gif|svg|mp3|wav|webp)\?v=(\d*)["']""", re.I)
    for p in html_files():
        t = read(p)
        for m in stamp_re.finditer(t):
            num = m.group(1)
            if num == "":
                rep.add(WARN, "缓存戳", "资源裸戳 ?v= 无版本号(CDN 可能永远给旧文件)", "%s:%d" % (rel(p), lineno(t, m.start())), "应为 ?v=%s" % ver)
            elif num != ver:
                rep.add(WARN, "缓存戳", "资源旧戳 ?v=%s ≠ 当前 v%s" % (num, ver), "%s:%d" % (rel(p), lineno(t, m.start())), "改版后 CDN 缓存挡新文件")

# ══════════════════════════════════════════════════════════════════
# 扫描器 3: 重复 DOM id
#   同一 HTML 文件内 id 重复 → getElementById 只取第一个·隐蔽 bug 源
# ══════════════════════════════════════════════════════════════════
_ID_RE = re.compile(r"""\bid\s*=\s*["']([\w\-]+)["']""")
def scan_dup_id(rep):
    _strip_scr = re.compile(r"<script[^>]*>.*?</script>", re.S | re.I)
    for p in html_files():
        raw = read(p)
        t = _strip_scr.sub(lambda m: "\n"*m.group(0).count("\n"), raw)  # 抹掉script体·保留行号
        seen = {}
        for m in _ID_RE.finditer(t):
            seen.setdefault(m.group(1), []).append(lineno(t, m.start()))
        for idv, lines in seen.items():
            if len(lines) > 1:
                rep.add(WARN, "重复ID", "id='%s' 在同文件出现 %d 次" % (idv, len(lines)), "%s:%s" % (rel(p), ",".join(map(str, lines[:6]))), "getElementById 只返回第一个")

# ══════════════════════════════════════════════════════════════════
# 扫描器 4: 内存泄漏 / 危险模式
#   setInterval 无对应 clearInterval; addEventListener 明显未配 remove(仅提示)
#   localStorage 直接读未包 try-catch(隐私模式抛错); eval/document.write
# ══════════════════════════════════════════════════════════════════
def scan_leak_patterns(rep):
    # 页面级单例常驻定时器(如全局同步/内存哨兵)生命周期=整页·关页即回收·不算泄漏。
    # 只报【明显应清理却没清】的: setInterval 赋值给变量却从不 clear(疑似想管理却漏了)·或多个未管理 interval。
    for p in js_files():
        t = read(p)
        assigned = re.findall(r"(?:var|let|const)\s+(\w+)\s*=\s*setInterval", t)  # 存了句柄=意图管理
        cleared = set(re.findall(r"clearInterval\s*\(\s*(\w+)", t))
        for h in assigned:
            if h not in cleared:
                m = re.search(r"(?:var|let|const)\s+%s\s*=\s*setInterval" % re.escape(h), t)
                rep.add(WARN, "内存泄漏", "定时器句柄 %s=setInterval 存了却从不 clearInterval(疑漏清)" % h, "%s:%d" % (rel(p), lineno(t, m.start())), "存句柄通常意味着想管理·却没清")
        for m in re.finditer(r"\beval\s*\(", t):
            rep.add(CRIT, "危险模式", "使用 eval()(安全+性能风险)", "%s:%d" % (rel(p), lineno(t, m.start())), "微信审核红线")
        for m in re.finditer(r"\bdocument\.write\s*\(", t):
            rep.add(WARN, "危险模式", "document.write(阻塞渲染+可能清空文档)", "%s:%d" % (rel(p), lineno(t, m.start())), "")

# ══════════════════════════════════════════════════════════════════
# 扫描器 5: 上线卫生 (调试残留)
#   console.log / console.debug / debugger / alert / TODO/FIXME/XXX/HACK
# ══════════════════════════════════════════════════════════════════
def scan_hygiene(rep):
    for p in all_code():
        t = read(p)
        for m in re.finditer(r"\bdebugger\b", t):
            rep.add(CRIT, "上线卫生", "debugger 语句(会冻结用户浏览器)", "%s:%d" % (rel(p), lineno(t, m.start())), "")
        n_log = len(re.findall(r"\bconsole\.(log|debug|info)\s*\(", t))
        if n_log > 0:
            m = re.search(r"\bconsole\.(log|debug|info)\s*\(", t)
            rep.add(INFO, "上线卫生", "console 调试输出×%d(建议上线前清)" % n_log, "%s:%d起" % (rel(p), lineno(t, m.start())), "泄漏内部信息+微弱性能损耗")
        for m in re.finditer(r"(?<![\w.])alert\s*\(", t):
            rep.add(INFO, "上线卫生", "alert() 弹窗(阻塞·体验差)", "%s:%d" % (rel(p), lineno(t, m.start())), "")
        for m in re.finditer(r"\b(TODO|FIXME|XXX|HACK)\b", t):
            rep.add(INFO, "上线卫生", "%s 待办标记" % m.group(1), "%s:%d" % (rel(p), lineno(t, m.start())), t[m.start():m.start()+60].split("\n")[0])

# ══════════════════════════════════════════════════════════════════
# 扫描器 6: 体积性能哨兵
#   单文件过大排行(HTML>600KB / JS>150KB / 图>500KB / 音频>800KB)
# ══════════════════════════════════════════════════════════════════
def scan_perf(rep):
    limits = {".html": 600, ".js": 150, ".png": 500, ".jpg": 500, ".jpeg": 500, ".mp3": 800, ".wav": 1500, ".gif": 800}
    heavy = []
    for root, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not d.startswith(".") and d not in ("node_modules","evolution_reports",".evolution_backups","releases")]
        for fn in files:
            ext = os.path.splitext(fn)[1].lower()
            if ext in limits:
                fp = os.path.join(root, fn)
                try: kb = os.path.getsize(fp) // 1024
                except Exception: continue
                if kb > limits[ext]:
                    heavy.append((kb, os.path.relpath(fp, ROOT), limits[ext]))
    heavy.sort(reverse=True)
    for kb, path, lim in heavy[:15]:
        rep.add(INFO, "体积性能", "大文件 %dKB(超%dKB软阈)" % (kb, lim), path, "首屏/加载耗时·可压缩或懒加载")

# ══════════════════════════════════════════════════════════════════
# 扫描器 7: HTML 结构健康
#   常见成对标签开合计数不平衡(div/script/style)——粗筛结构断裂
# ══════════════════════════════════════════════════════════════════
def scan_html_structure(rep):
    for p in html_files():
        t = read(p)
        for tag in ("script", "style"):
            op = len(re.findall(r"<%s[\s>]" % tag, t, re.I))
            cl = len(re.findall(r"</%s>" % tag, t, re.I))
            if op != cl:
                rep.add(CRIT, "HTML结构", "<%s> 开%d/闭%d 不平衡" % (tag, op, cl), rel(p), "标签未闭合→后续内容全废")
        # <div 开合(自闭合极少·粗筛严重失衡)
        op = len(re.findall(r"<div[\s>]", t, re.I))
        cl = len(re.findall(r"</div>", t, re.I))
        if abs(op - cl) > 2:
            rep.add(WARN, "HTML结构", "<div> 开%d/闭%d 差%d(疑结构失衡)" % (op, cl, abs(op-cl)), rel(p), "布局可能错乱")

# ══════════════════════════════════════════════════════════════════
# 扫描器 8: JS 语法全量校验 (用 node --check)
#   每个 .js + 每个 HTML 内联 <script> 抽出临时校验
# ══════════════════════════════════════════════════════════════════
import subprocess, tempfile
def scan_js_syntax(rep):
    node = None
    for c in ("node",):
        try:
            subprocess.run([c, "--version"], capture_output=True, timeout=10); node = c; break
        except Exception: pass
    if not node:
        rep.add(INFO, "JS语法", "未找到 node·跳过语法校验", "", ""); return
    # 独立 .js
    for p in js_files():
        r = subprocess.run([node, "--check", p], capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            err = (r.stderr or "").strip().split("\n")[0][:120]
            rep.add(CRIT, "JS语法", "独立 JS 语法错误", rel(p), err)
    # HTML 内联 script(抽出逐个校验)
    scr_re = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.S | re.I)
    _PLACEHOLDER = re.compile(r"⟦⟦|⟧⟧|\{\{[A-Z_]{3,}\}\}|%%[A-Z_]{3,}%%")  # 印章/模板占位符
    for p in html_files():
        t = read(p)
        for idx, m in enumerate(scr_re.finditer(t)):
            code = m.group(1)
            if not code.strip(): continue
            if _PLACEHOLDER.search(code):  # 模板占位符未替换·非可执行成品·跳过(成品岛已逐个校验)
                continue
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as tf:
                tf.write(code); tmp = tf.name
            try:
                r = subprocess.run([node, "--check", tmp], capture_output=True, text=True, timeout=30)
                if r.returncode != 0:
                    err = (r.stderr or "").strip().split("\n")[0][:120]
                    rep.add(CRIT, "JS语法", "内联 script#%d 语法错误" % (idx+1), "%s:~%d" % (rel(p), lineno(t, m.start())), err)
            finally:
                try: os.unlink(tmp)
                except Exception: pass

# ══════════════════════════════════════════════════════════════════
SCANNERS = [
    ("资源引用完整性(死链+孤儿)", scan_resources),
    ("缓存戳一致性",             scan_cache_stamp),
    ("重复 DOM id",              scan_dup_id),
    ("内存泄漏/危险模式",         scan_leak_patterns),
    ("上线卫生(调试残留)",        scan_hygiene),
    ("体积性能哨兵",             scan_perf),
    ("HTML 结构健康",            scan_html_structure),
    ("JS 语法全量校验",          scan_js_syntax),
]

def run_all():
    rep = Report()
    for name, fn in SCANNERS:
        try: fn(rep)
        except Exception as e:
            rep.add(WARN, "引擎", "%s 扫描器异常: %s" % (name, str(e)[:80]), "", "")
    return rep

# ══════════════════════════════════════════════════════════════════
def render_html_report(rep, path):
    ver = read(os.path.join(ROOT, "VERSION")).strip()
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    score = rep.score()
    nc, nw, ni = len(rep.by_sev(CRIT)), len(rep.by_sev(WARN)), len(rep.by_sev(INFO))
    grade = "S" if score>=95 else "A" if score>=85 else "B" if score>=70 else "C" if score>=50 else "D"
    ring = "#22c55e" if score>=85 else "#f59e0b" if score>=60 else "#ef4444"
    # 按扫描器分组
    groups = {}
    for it in rep.items:
        groups.setdefault(it["scanner"], []).append(it)
    sev_color = {CRIT:"#ef4444", WARN:"#f59e0b", INFO:"#3b82f6"}
    sev_zh = {CRIT:"致命", WARN:"警告", INFO:"提示"}
    rows = []
    order = {CRIT:0, WARN:1, INFO:2}
    for scanner in sorted(groups, key=lambda k: min(order[i["sev"]] for i in groups[k])):
        items = sorted(groups[scanner], key=lambda i: order[i["sev"]])
        cc = sum(1 for i in items if i["sev"]==CRIT)
        cw = sum(1 for i in items if i["sev"]==WARN)
        ci = sum(1 for i in items if i["sev"]==INFO)
        badge = "".join([
            '<span class="pill" style="background:#ef444422;color:#ef4444">%d 致命</span>'%cc if cc else "",
            '<span class="pill" style="background:#f59e0b22;color:#f59e0b">%d 警告</span>'%cw if cw else "",
            '<span class="pill" style="background:#3b82f622;color:#3b82f6">%d 提示</span>'%ci if ci else "",
        ]) or '<span class="pill" style="background:#22c55e22;color:#22c55e">✓ 通过</span>'
        rows.append('<div class="card"><div class="ch"><h3>%s</h3><div>%s</div></div>' % (html.escape(scanner), badge))
        for it in items[:60]:
            rows.append(
                '<div class="row"><span class="sev" style="background:%s">%s</span>'
                '<div class="rt"><div class="tt">%s</div>'
                '<div class="wh">%s</div>%s</div></div>' % (
                    sev_color[it["sev"]], sev_zh[it["sev"]],
                    html.escape(it["title"]),
                    html.escape(it["where"]) or "—",
                    ('<div class="dt">%s</div>' % html.escape(it["detail"])) if it["detail"] else ""
                ))
        if len(items) > 60:
            rows.append('<div class="row"><span class="sev" style="background:#64748b">…</span><div class="rt"><div class="tt">另有 %d 项(同类)</div></div></div>' % (len(items)-60))
        rows.append('</div>')
    doc = """<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>贾维斯 2.0 体检报告 · v%s</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#0b1120;color:#e2e8f0;padding:20px;line-height:1.55}
.wrap{max-width:960px;margin:0 auto}
.hero{display:flex;align-items:center;gap:28px;background:linear-gradient(135deg,#1e293b,#0f172a);border:1px solid #334155;border-radius:20px;padding:28px 32px;margin-bottom:22px}
.ringbox{position:relative;width:150px;height:150px;flex:0 0 auto}
.ringbox svg{transform:rotate(-90deg)}
.ringnum{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ringnum b{font-size:40px;line-height:1;color:%s}
.ringnum span{font-size:13px;color:#94a3b8;margin-top:3px}
.htext h1{font-size:24px;margin-bottom:6px}
.htext h1 .grade{display:inline-block;background:%s;color:#0b1120;font-weight:900;border-radius:8px;padding:1px 12px;margin-left:8px}
.htext .meta{color:#94a3b8;font-size:14px;margin-bottom:14px}
.stat{display:flex;gap:10px;flex-wrap:wrap}
.stat .s{background:#0b1120;border:1px solid #334155;border-radius:12px;padding:8px 16px;font-size:14px}
.stat .s b{font-size:20px;display:block}
.card{background:#0f172a;border:1px solid #334155;border-radius:16px;padding:18px 20px;margin-bottom:14px}
.ch{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.ch h3{font-size:17px}
.pill{font-size:12px;font-weight:700;border-radius:20px;padding:3px 11px;margin-left:6px}
.row{display:flex;gap:12px;padding:9px 0;border-top:1px solid #1e293b}
.sev{flex:0 0 auto;font-size:11px;font-weight:800;color:#0b1120;border-radius:6px;padding:2px 8px;height:fit-content;margin-top:2px}
.rt{flex:1;min-width:0}
.tt{font-size:14px;font-weight:600}
.wh{font-size:12px;color:#7dd3fc;font-family:'SF Mono',Consolas,monospace;word-break:break-all;margin-top:2px}
.dt{font-size:12px;color:#94a3b8;margin-top:3px}
.foot{text-align:center;color:#64748b;font-size:12px;margin-top:24px;padding-top:16px;border-top:1px solid #1e293b}
</style></head><body><div class="wrap">
<div class="hero">
  <div class="ringbox"><svg width="150" height="150">
    <circle cx="75" cy="75" r="66" fill="none" stroke="#1e293b" stroke-width="12"/>
    <circle cx="75" cy="75" r="66" fill="none" stroke="%s" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="%.1f 999" /></svg>
    <div class="ringnum"><b>%s</b><span>健康分</span></div></div>
  <div class="htext">
    <h1>贾维斯 2.0 · 超级体检报告<span class="grade">%s 级</span></h1>
    <div class="meta">单词大冒险 v%s &nbsp;·&nbsp; %s &nbsp;·&nbsp; 8 大主动扫描器全域 X 光</div>
    <div class="stat">
      <div class="s" style="color:#ef4444"><b>%d</b>致命</div>
      <div class="s" style="color:#f59e0b"><b>%d</b>警告</div>
      <div class="s" style="color:#3b82f6"><b>%d</b>提示</div>
      <div class="s" style="color:#22c55e"><b>%d</b>扫描器</div>
    </div>
  </div>
</div>
%s
<div class="foot">贾维斯 2.0 超级体检引擎 · 纯静态全域扫描 · 与 check_resources(防复发)+hansen_evolve(使命体检) 三足鼎立<br>致命=8分/警告=2分/提示不扣分 &nbsp;·&nbsp; 报告由 jarvis_scan.py 生成</div>
</div></body></html>""" % (
        ver, ring, grade, ring, (score/100.0*414.7), int(score) if score==int(score) else score, grade,
        ver, ts, nc, nw, ni, len(SCANNERS), "\n".join(rows)
    )
    with open(path, "w", encoding="utf-8") as f: f.write(doc)

# ══════════════════════════════════════════════════════════════════
def main():
    quiet = "--quiet" in sys.argv
    rep = run_all()
    score = rep.score()
    nc, nw, ni = len(rep.by_sev(CRIT)), len(rep.by_sev(WARN)), len(rep.by_sev(INFO))
    grade = "S" if score>=95 else "A" if score>=85 else "B" if score>=70 else "C" if score>=50 else "D"

    if not quiet:
        print("=" * 62)
        print("  贾维斯 2.0 · 超级全域体检引擎")
        print("=" * 62)
        for name, _ in SCANNERS:
            n = sum(1 for i in rep.items if i["scanner"] == name.split("(")[0] or i["scanner"].startswith(name[:6]))
        # 按扫描器汇总
        cat = {}
        for i in rep.items:
            cat.setdefault(i["scanner"], [0,0,0])
            cat[i["scanner"]][{CRIT:0,WARN:1,INFO:2}[i["sev"]]] += 1
        for name, _ in SCANNERS:
            key = None
            for k in cat:
                if k in name or name.startswith(k[:4]) or k.startswith(name[:4]): key = k; break
            c = cat.get(key, [0,0,0]) if key else [0,0,0]
            mark = "❌" if c[0] else ("⚠️ " if c[1] else "✅")
            print("  %s %-26s 致命%d 警告%d 提示%d" % (mark, name, c[0], c[1], c[2]))
        print("-" * 62)
        # 致命项详列
        for it in rep.by_sev(CRIT)[:20]:
            print("  ❌ [%s] %s  @%s" % (it["scanner"], it["title"], it["where"]))
        print("-" * 62)

    # 生成报告
    rpt_dir = os.path.join(ROOT, "evolution_reports")
    os.makedirs(rpt_dir, exist_ok=True)
    rpt = os.path.join(rpt_dir, "jarvis2_scan_%s.html" % datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S"))
    try:
        render_html_report(rep, rpt)
        report_ok = True
    except Exception as e:
        report_ok = False
        print("  (报告生成异常: %s)" % str(e)[:80])

    print("  健康分: %s / 100  (%s 级)   致命×%d 警告×%d 提示×%d" % (
        int(score) if score==int(score) else score, grade, nc, nw, ni))
    if report_ok and not quiet:
        print("  📊 可视化体检报告: %s" % rel(rpt))
    print("=" * 62)
    return 0 if nc == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
