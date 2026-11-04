#!/usr/bin/env python3
"""每个版本一份详细说明：版本说明/v####.md。

用法：
    python3 写版本说明.py          # 给当前 VERSION 建立/刷新说明
    python3 写版本说明.py 1164     # 指定版本

分工（虹吸主义）：
    · 机器做：从 main（上一个正式版）到现在，改了哪些文件、各加减多少行、按「产品 / 测试 / 工具 / 文档」分好类，
      写进 <!-- 自动生成开始 --> 和 <!-- 自动生成结束 --> 之间（每次运行都会刷新，别手改这一段）。
    · AI 写：给老师看的改动说明、实测的测试结果、工具和方法的改进、没验证的事、真机要点哪几下。
      模板里标着「（待填）」的地方都要填；没填完，一键体检.py 快检就不通过，这一版就发不出去（执行主义）。
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(ROOT, '版本说明')
BEGIN, END = '<!-- 自动生成开始 -->', '<!-- 自动生成结束 -->'
REQUIRED = ['## 给老师看：这一版改了什么', '## 详细改动', '## 测试结果（实测）',
            '## 工具和方法的改进', '## 已知问题和没验证的', '## 真机上请点一遍']
TODO = '（待填）'

TEMPLATE = '''# v{v} 版本说明

> 每个版本一份。机器生成的部分在「自动生成」两行之间；其余由做这一版的人写，写给不熟悉电脑的老师看。

## 给老师看：这一版改了什么

{t}

## 详细改动

{t}

## 测试结果（实测）

{t}

## 工具和方法的改进

{t}

## 已知问题和没验证的

{t}

## 真机上请点一遍

{t}

## 改动文件（自动生成）

{b}
{e}
'''


def git(*a):
    # core.quotePath=false：否则中文文件名会被转成 \346\224\273 这样的八进制，分类全错（11-04 实测踩到）
    return subprocess.run(['git', '-c', 'core.quotePath=false', *a], cwd=ROOT, capture_output=True, text=True).stdout


def kind(path):
    name = os.path.basename(path)
    if path.startswith('攻坚笔记/') or path.startswith('版本说明/') or name.endswith('.md'):
        return '文档'
    if name.startswith('test_'):
        return '测试'
    if path.startswith('.github/') or name.endswith('.py') or name.endswith('.mjs') or name.endswith('.sh'):
        return '工具'
    return '产品（会部署到网站的）'


def auto_section():
    base = git('merge-base', 'HEAD', 'origin/main').strip()
    if not base:
        return '（找不到 origin/main，没法自动统计 —— 先 `git fetch origin main`）'
    commits = len([l for l in git('rev-list', base + '..HEAD').split('\n') if l.strip()])
    groups = {}
    for line in git('diff', '--numstat', base, 'HEAD').split('\n'):
        m = re.match(r'(\S+)\t(\S+)\t(.+)', line)
        if not m:
            continue
        add, rem, path = m.groups()
        path = path.strip('"')
        a = int(add) if add.isdigit() else 0
        r = int(rem) if rem.isdigit() else 0
        groups.setdefault(kind(path), []).append((a + r, a, r, path))
    lines = ['从上一个正式版（main，%s）到现在：%d 个提交。' % (base[:7], commits), '']
    for k in ('产品（会部署到网站的）', '测试', '工具', '文档'):
        items = sorted(groups.get(k, []), reverse=True)
        if not items:
            continue
        lines.append('**%s**：%d 个文件，+%d / −%d 行' % (k, len(items), sum(i[1] for i in items), sum(i[2] for i in items)))
        lines += ['- `%s` +%d / −%d' % (p, a, r) for _, a, r, p in items[:15]]
        if len(items) > 15:
            lines.append('- …… 还有 %d 个' % (len(items) - 15))
        lines.append('')
    return '\n'.join(lines).rstrip()


def check(v):
    """给一键体检.py 用：返回问题列表（空 = 合格）。v1163 及以前的版本记录在 CHANGELOG.md，不查。"""
    if not v.isdigit() or int(v) <= 1163:
        return []
    p = os.path.join(DIR, 'v%s.md' % v)
    if not os.path.exists(p):
        return ['缺版本说明 版本说明/v%s.md（运行 python3 写版本说明.py 生成）' % v]
    s = open(p, encoding='utf-8').read()
    bad = ['缺一节「%s」' % h[3:] for h in REQUIRED if h not in s]
    n = s.count(TODO)
    if n:
        bad.append('还有 %d 处「待填」没写' % n)
    return ['版本说明/v%s.md：%s' % (v, '；'.join(bad))] if bad else []


def main():
    v = sys.argv[1] if len(sys.argv) > 1 else open(os.path.join(ROOT, 'VERSION')).read().strip()
    os.makedirs(DIR, exist_ok=True)
    p = os.path.join(DIR, 'v%s.md' % v)
    if not os.path.exists(p):
        open(p, 'w', encoding='utf-8').write(TEMPLATE.format(v=v, t=TODO, b=BEGIN, e=END))
    s = open(p, encoding='utf-8').read()
    if BEGIN in s and END in s:
        a, b = s.index(BEGIN) + len(BEGIN), s.index(END)
        s = s[:a] + '\n' + auto_section() + '\n' + s[b:]
    open(p, 'w', encoding='utf-8').write(s)
    left = s.count(TODO)
    print('版本说明/v%s.md 已更新；还有 %d 处「待填」%s' % (v, left, '' if left else '（齐了）'))


if __name__ == '__main__':
    main()
