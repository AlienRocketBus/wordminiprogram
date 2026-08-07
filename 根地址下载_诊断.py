#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""根地址被下载：查清楚 + 给出能真正解决的做法

═══ 用户现场 ═══

「跟地址就是跟地址，所有的浏览器打开都会出现这种情况。」
而腾讯云控制台里「默认索引节点 = index.html」**已经配好了**。

═══ 为什么配好了还会下载 ═══

浏览器决定「渲染」还是「下载」，只看服务器回的 `Content-Type`：

    text/html                  → 渲染成网页  ✅
    application/octet-stream   → 弹下载框    ❌
    text/plain / 没有这个头     → 多半也是下载 ❌

而**根路径 `/` 和 `/index.html` 在 CDN 眼里是两个不同的缓存键**。
索引文档配置管的是「`/` 该取哪个文件」，
但如果某个时刻 `/` 这个键**被缓存了一份带着错误 Content-Type 的响应**，
那这份坏响应会一直发给用户，**直到它自己过期**。

这解释了三件事：
  · 为什么只有根地址出事，`/index.html` 是好的
  · 为什么「偶尔」—— CDN 有很多边缘节点，命中坏节点才出事
  · 为什么所有浏览器都一样 —— 问题在服务端，跟浏览器无关

═══ 客户端救不了 ═══

一旦浏览器决定下载，**页面根本不会执行，任何 JS 都没机会运行**。
v1141 那个自救层只能救「已经下载到手机里、又双击打开」的情况，
救不了「点链接就下载」。

**所以这件事必须在服务端解决。** 这个脚本负责：
  ① 说清楚该做什么（一次性）
  ② 检查代码侧该做的都做了
  ③ 给出一个不依赖服务端的稳妥分享方式
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = 'https://superwords-ambitious-d0g1d26xm740dc3d6.webapps.tcloudbase.com'


def check_deploy_config():
    """代码侧该配的都配了吗"""
    p = os.path.join(ROOT, 'cloudbaserc.json')
    if not os.path.exists(p):
        return ['缺 cloudbaserc.json —— 部署时不会自动带上索引文档配置']
    try:
        cfg = json.load(open(p, encoding='utf-8'))
    except Exception as e:
        return ['cloudbaserc.json 读不了：%s' % e]
    inputs = (cfg.get('framework', {}).get('plugins', {})
                 .get('site', {}).get('inputs', {}))
    bad = []
    if inputs.get('indexPath') != 'index.html':
        bad.append('indexPath 不是 index.html')
    if inputs.get('errorPath') != 'index.html':
        bad.append('errorPath 不是 index.html')
    return bad


def main():
    print('=' * 62)
    print('  根地址被下载 · 诊断与解决')
    print('=' * 62)

    print('\n【一】代码侧检查')
    bad = check_deploy_config()
    if bad:
        for b in bad:
            print('  ❌ ' + b)
    else:
        print('  ✅ cloudbaserc.json 里 indexPath / errorPath 都是 index.html')
        print('     （每次部署都会自动带上，不用记）')

    print('\n【二】你已经确认过的')
    print('  ✅ 腾讯云控制台 → 默认索引节点 = index.html')

    print('\n【三】那问题出在哪')
    print('  根路径「/」和「/index.html」在 CDN 眼里是**两个不同的缓存键**。')
    print('  索引文档配置管的是「/ 该取哪个文件」，')
    print('  但如果「/」这个键曾经被缓存了一份带错误 Content-Type 的响应，')
    print('  那份坏响应会一直发给用户 —— 直到它自己过期。')
    print()
    print('  这解释了三件事：')
    print('    · 为什么只有根地址出事，/index.html 是好的')
    print('    · 为什么「偶尔」—— CDN 有很多边缘节点，命中坏的才出事')
    print('    · 为什么所有浏览器都一样 —— 问题在服务端，跟浏览器无关')

    print('\n【四】彻底解决：刷新 CDN 缓存（一次性）')
    print('  腾讯云控制台 → 静态网站托管 → 找「刷新缓存 / 清除缓存」')
    print('  刷这两个地址：')
    print('    %s/' % SITE)
    print('    %s/index.html' % SITE)
    print()
    print('  ⚠️ 一定要**带最后那个斜杠**单独刷一次「/」——')
    print('     只刷 /index.html 不管用，坏的是「/」那个键。')

    print('\n【五】在那之前，分享链接时带上 index.html')
    print('  给别人发链接时用：')
    print('    %s/index.html' % SITE)
    print('  这个键是好的，绕开坏缓存，立刻可用。')

    print('\n【六】怎么确认修好了')
    print('  手机上**用无痕/隐私窗口**打开根地址（避开本机缓存）：')
    print('    %s/' % SITE)
    print('  能正常打开网页 = 好了；还下载 = 缓存还没刷干净，等几分钟再试。')

    print('\n' + '=' * 62)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
