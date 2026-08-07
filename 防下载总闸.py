#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🛡️ 防「打开网站变下载」总闸 —— 每次发版必跑

═══ 为什么要有这个文件 ═══

用户反复报「打开网站变成下载网页」，而且强调：

  「必须给我彻底彻底点了，再给我反复检查，反复检查，
    直到检查不出来任何可能会导致这种情况的 bug 为止。
    设立一个机制，防止这种情况以后再次出现。」

这个文件就是那个机制。它把**所有能让浏览器下载而不是渲染的原因**
收拢到一处，每次发版全部跑一遍 —— 少一条都不放行。

═══ 能导致「打开变下载」的全部原因（穷举）═══

    ┌─ 服务端 ────────────────────────────────────┐
    │ A. Content-Type 是 octet-stream / binary /  │
    │    text/plain / 空                          │
    │ B. Content-Disposition: attachment          │
    │ C. 根路径 / 的 CDN 缓存键存着坏响应          │
    │    （和 /index.html 是两个键！）             │
    │ D. 没扩展名的文件（服务器无从判断类型）       │
    └─────────────────────────────────────────────┘
    ┌─ 我们自己 ──────────────────────────────────┐
    │ E. 代码里 a.download + a.click() 自动触发    │
    │ F. Service Worker 把坏响应存进缓存并replay   │
    │ G. HTML 里写死 <a download>                  │
    │ H. 跳转到 blob: / data: URL                  │
    │ I. 部署时把不该上传的文件传上去               │
    └─────────────────────────────────────────────┘

A/B/C/D 靠「发版前线上体检」实测响应头（真去请求一次）。
E~I 靠这里的静态检查 —— **它们不需要联网，任何时候都能跑**。

═══ 一条原则 ═══

> **「打开变下载」是所有 bug 里最致命的一种：
> 用户连页面都进不去，我们所有的兜底代码一行都执行不了。**
>
> 所以这件事只能靠"发出去之前就拦住"，
> 不能指望"出了问题在页面里补救"。
"""
import json
import os
import re
import sys
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
bad = []


def fail(tag, msg):
    bad.append((tag, msg))


def read(name):
    p = os.path.join(ROOT, name)
    if not os.path.exists(p):
        return ''
    try:
        return open(p, encoding='utf-8', errors='replace').read()
    except Exception:
        return ''


def strip_comments(js):
    js = re.sub(r'/\*[\s\S]*?\*/', '', js)
    return re.sub(r'//[^\n]*', '', js)


# ── E：代码里不许有"不点就下载" ──────────────────────────
def check_auto_download():
    for f in sorted(glob.glob(os.path.join(ROOT, 'hansen_*.js'))):
        name = os.path.basename(f)
        code = strip_comments(read(name))
        for m in re.finditer(r'\.download\s*=', code):
            tail = code[m.end():m.end() + 500]
            if '.click()' not in tail:
                continue
            head = code[max(0, m.start() - 500):m.start()]
            fns = re.findall(r'function\s+(\w+)\s*\(', head)
            fname = fns[-1] if fns else None
            hooked = bool(fname and re.search(
                r'onclick\s*=\s*' + fname + r'\b', code))
            by_user = hooked or re.search(r"onclick|addEventListener\(['\"]click", head)
            auto = re.search(r"setTimeout|setInterval|"
                             r"addEventListener\(['\"](?:load|DOMContentLoaded)",
                             head[-260:])
            if (not by_user) or auto:
                ln = code[:m.start()].count('\n') + 1
                fail('E 自动下载',
                     '%s:%d 的下载不是由用户点击触发 —— '
                     '用户一打开页面就会莫名其妙下载一个文件' % (name, ln))


# ── F：SW 不许把坏响应存下来或发出去 ─────────────────────
def check_sw():
    code = strip_comments(read('sw_v944.js'))
    if not code:
        fail('F SW', '读不到 sw_v944.js')
        return
    m = re.search(r'const looksDownload =[\s\S]*?;', code)
    cond = m.group(0) if m else ''
    for frag, label in (("ct === ''", '空 Content-Type'),
                        ('octet-stream', 'octet-stream'),
                        ("startsWith('binary/')", 'binary/'),
                        ("startsWith('text/plain')", 'text/plain'),
                        ('attachment', 'attachment')):
        if frag not in cond:
            fail('F SW', '判据里没有「%s」—— 这种响应会被浏览器下载' % label)
    i = code.find('async function putIfReasonable')
    if i < 0 or 'fixHtmlType(response)' not in code[i:i + 900]:
        fail('F SW',
             '进缓存之前没修 Content-Type —— '
             '服务端一次抽风就会被永久固化在用户浏览器里，'
             '之后服务端修好了他也好不了（SW 缓存不吃刷新）')
    # 🔴v1156 第七轮：**导航响应这条主路以前漏了。**
    #   `bufferedNavigationResponse` 专门处理"用户打开一个页面"，
    #   原来直接沿用 `response.headers` —— 服务端回什么就传什么。
    #   它比缓存那条路更靠前：**缓存还没轮到，这里就已经把坏头交出去了**。
    #   前六轮都盯着缓存，漏了这条真正的主路。
    i_nav = code.find('async function bufferedNavigationResponse')
    seg_nav = code[i_nav:i_nav + 1200] if i_nav >= 0 else ''
    if i_nav < 0:
        fail('F SW', '找不到 bufferedNavigationResponse')
    elif 'headers: fixedHeaders' not in seg_nav:
        fail('F SW',
             '导航响应直接沿用了服务端的 headers —— '
             '服务端回 text/plain 时浏览器就下载或显示满屏源代码。'
             '这是「打开网站变下载」最直接的一条路')

    if len(re.findall(r'fixHtmlType\(', code)) < 3:
        fail('F SW',
             '读缓存的路径没有全部过一遍 fixHtmlType —— '
             '导航请求修了不够，普通资源请求走的是另一条')
    if 'if (!looksDownload) return response;' not in code:
        fail('F SW', '没有「正常响应一律不碰」这道闸')


# ── G/H：页面里不许有写死的下载或危险跳转 ────────────────
def check_pages():
    for f in sorted(glob.glob(os.path.join(ROOT, '*.html'))):
        name = os.path.basename(f)
        if name.startswith('_'):
            continue
        html = read(name)
        # 真正的 <a ... download ...>
        for m in re.finditer(r'<a\b[^>]*\bdownload\b[^>]*>', html, re.I):
            fail('G 写死下载', '%s 里有 <a download> —— 点了就下载' % name)
            break
        if re.search(r'location\s*(?:\.href)?\s*=\s*[\'"](?:blob|data):', html):
            fail('H 危险跳转', '%s 里有跳到 blob:/data: 的代码' % name)


# ── I：部署时不许把杂物传上去 ────────────────────────────
def check_deploy():
    try:
        cfg = json.loads(read('cloudbaserc.json'))
        inp = cfg['framework']['plugins']['site']['inputs']
    except Exception as e:
        fail('I 部署', 'cloudbaserc.json 读不了：%s' % str(e)[:50])
        return
    if inp.get('indexPath') != 'index.html':
        fail('I 部署', 'indexPath 不是 index.html —— 根路径会不知道该给哪个文件')
    if inp.get('errorPath') != 'index.html':
        fail('I 部署', 'errorPath 不是 index.html')
    ig = inp.get('ignore') or []
    # 没扩展名的文件最危险：服务器无从判断类型，多半回 octet-stream
    for must in ('SHA256SUMS', '_*.mjs'):
        if must not in ig:
            fail('I 部署',
                 'ignore 里没有「%s」—— 这类文件传上去会以 octet-stream 下发；'
                 '尤其没扩展名的，服务器根本无从判断类型' % must)
    # 工作区里现在有没有杂物
    junk = [os.path.basename(x) for x in glob.glob(os.path.join(ROOT, '_*.mjs'))]
    if junk:
        fail('I 部署',
             '工作区里还有 %d 个临时文件（如 %s）—— '
             '先删掉再发版' % (len(junk), junk[0]))


# ── 兜底层必须在 ────────────────────────────────────────
def check_fallbacks():
    for f, why in (
        ('hansen_download_fix_v1140.js', '下载自查（告诉用户该去哪里改）'),
        ('发版前_线上体检.py', '发版前实测响应头 —— 守卫查代码，这个查真相'),
    ):
        if not read(f):
            fail('兜底', '%s 不见了 —— %s' % (f, why))


def main():
    print('=' * 64)
    print('  🛡️  防「打开网站变下载」总闸')
    print('=' * 64)
    check_auto_download()
    check_sw()
    check_pages()
    check_deploy()
    check_fallbacks()

    if not bad:
        print('\n  ✅ 七条路径全部堵死：')
        print('     E 自动下载 · F SW缓存 · G 写死下载 · H 危险跳转 ·')
        print('     I 部署杂物 · 兜底层齐全')
        print('\n  ⚠️ 服务端那四条（Content-Type / Disposition / CDN缓存 / 无扩展名）')
        print('     由「发版前_线上体检.py」实测 —— 那个必须联网才有意义。')
        return 0

    print('\n  🚫 发现 %d 个问题：\n' % len(bad))
    for tag, msg in bad:
        print('   [%s] %s' % (tag, msg))
    print('\n  「打开变下载」是所有 bug 里最致命的一种：')
    print('  用户连页面都进不去，我们所有的兜底代码一行都执行不了。')
    return 1


if __name__ == '__main__':
    sys.exit(main())
