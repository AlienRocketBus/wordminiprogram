# 把 measure.json / idle_cpu.json 汇总成 metrics/summary.md；并按 tokens.css 计算非文字元素（边框、图标、状态色）的对比度。
import json, os, re
B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = json.load(open(os.path.join(B, 'metrics', 'measure.json')))
tok = open(os.path.join(B, '..', 'next_inputs', 'theme_mockups', 'tokens.css')).read()
def theme_vars(name):
    v = {}
    for m in re.finditer(r'--([\w-]+):([^;}]+)', re.search(r':root\{[^}]*\}', tok).group(0)): v[m.group(1)] = m.group(2).strip()
    blk = re.search(r'(\[data-theme="%s"\])\{([^}]*)\}' % name, tok) or re.search(r':root,\[data-theme="%s"\]\{([^}]*)\}' % name, tok)
    for m in re.finditer(r'--([\w-]+):([^;}]+)', blk.group(0)): v[m.group(1)] = m.group(2).strip()
    return v
def rgb(s):
    s = s.strip()
    if s.startswith('#'): s = s[1:]; return [int(s[i:i + 2], 16) for i in (0, 2, 4)], 1.0
    m = re.match(r'rgba\(([^)]+)\)', s); p = [float(x) for x in m.group(1).split(',')]; return p[:3], p[3]
def lin(c): c /= 255; return c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
def L(c): return .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2])
def over(fg, bg):
    c, a = rgb(fg); b, _ = rgb(bg); return [c[i] * a + b[i] * (1 - a) for i in range(3)]
def cr(a, b): la, lb = sorted([L(a), L(b)], reverse=True); return (la + .05) / (lb + .05)
PAIRS = [  # (说明, 前景, 背景, 需要)
    ('字母格边框 line-strong / surface-2', 'line-strong', 'surface-2', 3), ('字母格边框 line-strong / surface-1', 'line-strong', 'surface-1', 3),
    ('当前格金框 focus / surface-1', 'focus', 'surface-1', 3), ('拼对格边 good / good-surface', 'good', 'good-surface', 3), ('拼错格边 bad / bad-surface', 'bad', 'bad-surface', 3),
    ('计时金边 accent-1 / bg-2', 'accent-1', 'bg-2', 3), ('最后5秒 bad 边 / bad-surface', 'bad', 'bad-surface', 3),
    ('键 surface-1 / 托盘 surface-3', 'surface-1', 'surface-3', 1.2), ('键字 ink-1 / 键 surface-1', 'ink-1', 'surface-1', 4.5), ('删除键 on-brand / brand-2', 'on-brand', 'brand-2', 4.5),
    ('进度条 xp-1 / 底槽 surface-3', 'xp-1', 'surface-3', 3), ('进度点 good / surface-3', 'good', 'surface-3', 3), ('在线绿点 good / surface-1', 'good', 'surface-1', 3),
    ('选中卡金框 accent-1 / surface-2', 'accent-2', 'surface-2', 3), ('ghost 按钮边 line-strong / surface-2', 'line-strong', 'surface-2', 3),
    ('我（排行榜）on-brand / brand-2', 'on-brand', 'brand-2', 4.5), ('金按钮字 on-accent / accent-2', 'on-accent', 'accent-2', 4.5), ('靛蓝按钮字 on-brand / brand-1', 'on-brand', 'brand-1', 4.5),
    ('卡片底板 on-plate / plate·最亮卡色', 'on-plate', 'plate@f-yellow-a', 4.5), ('角标 on-badge / badge-bg', 'on-badge', 'badge-bg', 4.5),
]
out = ['# 测量汇总（自动生成：scripts/summarize.py）', '']
for th in ('cosmos', 'cloud'):
    v = theme_vars(th)
    out += [f'## 非文字对比度 · {th}', '', '| 元素 | 比值 | 需要 | |', '|---|---:|---:|---|']
    for lab, f, b, need in PAIRS:
        if b.startswith('plate@'):
            bb = over(v['plate'], v[b.split('@')[1]]); fc = rgb(v[f])[0]
        else:
            bb = over(v[b], v['bg-1']) if v[b].startswith('rgba') else rgb(v[b])[0]
            fc = over(v[f], '#%02x%02x%02x' % tuple(int(x) for x in bb)) if v[f].startswith('rgba') else rgb(v[f])[0]
        r = cr(fc, bb); out.append(f'| {lab} | {r:.2f} | {need} | {"✅" if r >= need else "❌"} |')
    out.append('')
out += ['## 每个状态（文字对比度最低值 · 不达标段数 · <44px 点击区 · 横向溢出）', '', '| 尺寸 | 状态_主题 | 文字段 | 最低(正文) | 最低(大字) | 不达标 | 小点击区 | 溢出 | 键宽最小 | 键高 | 省略号 | 错误 |', '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|']
tot = dict(files=0, fail=0, small=0, overflow=0, errs=0, minb=99, minl=99, minkw=99, fonts=0)
for sz in M:
    for n, m in sorted(M[sz].items()):
        g = m['geom']; c = m.get('contrast'); tot['files'] += 1
        kw = min([k['w'] for k in g['keys']], default=None); kh = min([k['h'] for k in g['keys']], default=None)
        if kw: tot['minkw'] = min(tot['minkw'], kw)
        ov = (1 if g['scrollW'] > g['vw'] else 0) + len(g['offscreen'])
        tot['small'] += len(g['small']); tot['overflow'] += ov; tot['errs'] += len(m['errs']); tot['fonts'] += m['fonts'].count(False)
        if c:
            tot['fail'] += c['fail']; tot['minb'] = min(tot['minb'], c['minByType']['body']); tot['minl'] = min(tot['minl'], c['minByType']['large'])
        out.append(f"| {sz} | {n} | {c['n'] if c else '–'} | {c['minByType']['body'] if c else '–'} | {c['minByType']['large'] if c else '–'} | {c['fail'] if c else '–'} | {len(g['small'])} | {ov} | {kw or ''} | {kh or ''} | {'、'.join(g['clipped'][:2])} | {len(m['errs'])} |")
out.insert(2, f"**总计**：{tot['files']} 张截图；文字对比度不达标 **{tot['fail']}** 段；正文最低 **{tot['minb']}**，大字最低 **{tot['minl']}**；<44px 点击区 **{tot['small']}** 个；横向溢出 **{tot['overflow']}** 处；字母键最窄 **{tot['minkw']}px**；加载错误 **{tot['errs']}**；用到却没加载的字体 **{tot['fonts']}**。\n")
ip = os.path.join(B, 'metrics', 'idle_cpu.json')
if os.path.exists(ip):
    I = json.load(open(ip)); an = I['animations']
    out += ['', '## 待机（加载 2.5 秒后再看 1 秒）', '', f"- 状态 × 主题：{len(an)}；仍在运行的动画最多 **{max(x['running'] for x in an.values())}** 个；样式表里 `infinite` 规则 **{max(x['infiniteCss'] for x in an.values())}** 条；rAF 每秒最多 **{max(x['rafPerSec'] for x in an.values())}** 次；残留特效层 **{sum(1 for x in an.values() if x['fxLayer'])}** 个；计时器最多 {max(x['intervals'] for x in an.values())} 个（每秒 1 次，只改文字）", '',
            '| 画面_主题 | 主线程忙(%) CPU×4 | 脚本(%) | 布局(%) |', '|---|---:|---:|---:|']
    for k, v in I['cpu'].items(): out.append(f"| {k} | {v['busyPct']} | {v['scriptPct']} | {v['layoutPct']} |")
open(os.path.join(B, 'metrics', 'summary.md'), 'w').write('\n'.join(out) + '\n')
print(out[2])
