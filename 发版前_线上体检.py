#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""发版前实测：线上会不会把网页当成文件下发

═══ 为什么要有这一档 ═══

v1156 用户现场：「跟地址就是跟地址，所有的浏览器打开都会出现这种情况。」

而当时：
  · 腾讯云控制台里索引文档**已经配好了**
  · 代码里的守卫**全绿**
  · 测试**全部通过**

**没有任何一处能提前告诉我们线上是坏的。**

因为这类问题的三个特征凑在一起，极难被发现：
  · **偶发** —— 只有命中坏节点/坏缓存的用户才遇到
  · **无声** —— 代码看正常、控制台零错误
  · **自我延续** —— 一旦发生就永久化，用户自己怎么弄都好不了

守卫查的是"代码写对了没"，**而这件事的真相只在服务器的响应头里**。
所以必须**真的去请求一次，看它到底回了什么**。

═══ 判据 ═══

浏览器决定「渲染」还是「下载」，只看 `Content-Type`：

    text/html                  → 渲染成网页  ✅
    application/octet-stream   → 弹下载框    ❌
    text/plain                 → 多半也是下载 ❌（v1156 线上实测到的就是它）
    没有这个头                  → 由浏览器猜，不可控 ❌
    Content-Disposition: attachment → 铁定下载 ❌

═══ 特别注意根路径 ═══

`/` 和 `/index.html` 在 CDN 眼里是**两个不同的缓存键**。
索引文档配置管的是「`/` 该取哪个文件」，
但 `/` 这个键上可能缓存着一份坏响应 —— 这解释了
「为什么只有根地址出事，`/index.html` 是好的」。

**所以这两个必须分开测。**

═══ 用法 ═══

    python3 发版前_线上体检.py                  # 用默认站点
    python3 发版前_线上体检.py https://xxx.com  # 指定站点

网络不通时**不报错、不拦发版** —— 只说清楚"没测到"，
因为拿不到结果和"结果是坏的"是两回事，
把前者当后者会让人开始忽略这道检查。
"""
import sys
import urllib.request
import urllib.error

DEFAULT_SITE = 'https://superwords-ambitious-d0g1d26xm740dc3d6.webapps.tcloudbase.com'

# 必须挨个测的入口。根路径单独列 —— 它和 /index.html 是两个缓存键。
#
# 🔴v1156 第二轮深查：**不能只测 HTML。**
#   实测（本地模拟服务端把 JS 回成 text/plain）：
#     · 页面能打开，但所有模块加载失败
#     · 控制台：The script has an unsupported MIME type
#     · window.HansenBackup === undefined —— 整个应用等于废了
#   而用户看到的是「页面打开了但什么都点不动」，比白屏更让人困惑。
#
#   同理 CSS 错了满屏没样式、manifest 错了装不了桌面图标。
#   **凡是浏览器会按 Content-Type 决定「怎么用」的资源，都要测。**
PATHS = [
    ('/',                               'text/html',  '根路径（和 /index.html 是两个缓存键）'),
    ('/index.html',                     'text/html',  '首页'),
    ('/spelling_pk.html',               'text/html',  '对战页'),
    ('/island_animal.html',             'text/html',  '岛屿页'),
    ('/sw_v944.js',                     'javascript', 'Service Worker（MIME 错就注册不上）'),
    ('/hansen_sw_upgrade_gate_v944.js', 'javascript', '首屏脚本（MIME 错整站废）'),
    ('/vocab_all.js',                   'javascript', '词库'),
    ('/manifest.webmanifest',           'manifest',   'PWA 清单'),
]


def probe(url):
    """拿到响应头。返回 (ok, content_type, disposition, 说明)"""
    req = urllib.request.Request(url, method='GET')
    req.add_header('Cache-Control', 'no-store')
    # 带上真实浏览器的 UA —— 有些 CDN 会按 UA 返回不同的头
    req.add_header('User-Agent',
                   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
                   'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148')
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return (True,
                    (r.headers.get('Content-Type') or '').lower(),
                    (r.headers.get('Content-Disposition') or '').lower(),
                    '')
    except urllib.error.HTTPError as e:
        return (False, '', '', 'HTTP %s' % e.code)
    except Exception as e:
        return (False, '', '', str(e)[:60])


def verdict(ct, dispo, want):
    '''这个响应浏览器会怎么用 —— 按资源类型分别判断'''
    if 'attachment' in dispo:
        return False, 'Content-Disposition 是 attachment —— 铁定下载'
    if not ct:
        return False, '没有 Content-Type —— 由浏览器猜，不可控'
    short = ct.split(';')[0]

    if want == 'text/html':
        if ct.startswith('text/html'):
            return True, ''
        if ct.startswith('text/plain'):
            return False, ('是 text/plain —— 浏览器要么下载、要么把整页 HTML '
                           '当纯文本显示（满屏源代码）。两种都等于打不开，'
                           '而且 JS 不执行、SW 装不上，客户端 100% 救不了')
        if ct.startswith(('application/octet-stream', 'binary/')):
            return False, '是 %s —— 弹下载框' % short
        return False, '是 %s —— 不是 text/html' % short

    if want == 'javascript':
        # 浏览器只接受 JavaScript 类 MIME，别的一律拒绝执行
        if ('javascript' in ct) or ct.startswith('application/ecmascript'):
            return True, ''
        return False, ('是 %s —— 浏览器会拒绝执行这个脚本'
                       '（The script has an unsupported MIME type），'
                       '所有模块加载失败，整站等于废了' % short)

    if want == 'manifest':
        if 'json' in ct or 'manifest' in ct:
            return True, ''
        return False, '是 %s —— PWA 清单读不了，装不了桌面图标' % short

    return True, ''


def main():
    site = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SITE).rstrip('/')
    print('▶ 发版前线上体检：浏览器拿到的东西能不能正常用')
    print('  站点：%s\n' % site)

    unreachable = 0
    bad = []
    for path, want, label in PATHS:
        url = site + path
        ok, ct, dispo, why = probe(url)
        if not ok:
            unreachable += 1
            print('  ⏭  %-34s 请求不通（%s）' % (path, why))
            continue
        good, reason = verdict(ct, dispo, want)
        if good:
            print('  ✅ %-34s %s' % (path, ct.split(';')[0]))
        else:
            print('  ❌ %-34s %s' % (path, label))
            print('      %s' % reason)
            bad.append((path, reason))

    print()
    if unreachable == len(PATHS):
        # 拿不到结果 ≠ 结果是坏的。把前者当后者，会让人开始忽略这道检查。
        print('  ⏭  一个入口都没请求通 —— 这里的网络到不了线上，跳过。')
        print('     （在能上网的机器上跑一次，或者用手机无痕窗口打开根地址看看。）')
        return 0

    if bad:
        print('  🚫 %d 个入口会被当成文件下载：' % len(bad))
        for path, reason in bad:
            print('     · %s —— %s' % (path, reason))
        print()
        print('  怎么修：')
        print('    1. 腾讯云控制台 → 静态网站托管 → 刷新缓存')
        print('       **单独刷「/」这个地址**（只刷 /index.html 不管用，')
        print('       它俩在 CDN 眼里是两个缓存键）')
        print('    2. 确认「默认索引节点 = index.html」')
        print('    3. 在那之前，分享链接用 /index.html 结尾的那个')
        return 1

    print('  ✅ 所有入口都回 text/html —— 不会被当成文件下载。')
    return 0


if __name__ == '__main__':
    sys.exit(main())
