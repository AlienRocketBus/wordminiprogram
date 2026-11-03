# Aggregate the screenshot/contrast matrix into tables for the report.
import json, glob, os, collections
TV = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual'
P = ['cosmos', 'violet', 'aurora', 'woods', 'cloud', 'sakura', 'cream', 'mint', 'coin_rainbow', 'coin_pink', 'imax_candy', 'gallery_fairy']
S = ['home_top', 'home_cards', 'food_menu', 'food_modes', 'animal_menu', 'school_menu', 'land1_menu', 'land1_modes', 'land5_menu', 'listen_q', 'listen_right', 'listen_wrong', 'listen_result',
     'pop_ach', 'pop_levelup', 'pop_petevolve', 'chest', 'chest_open', 'boss_list', 'boss_fight', 'boss_victory', 'settings', 'settings_themes', 'shop', 'boss_hall', 'land_map', 'season_showcase']
cell = {}; tot = collections.Counter(); totf = collections.Counter(); rec = collections.defaultdict(dict)
for p in P:
    for s in S:
        f = f'{TV}/out/contrast_m_{p}_{s}.json'
        if not os.path.exists(f): continue
        r = json.load(open(f)); sm = r['summary']
        cell[(p, s)] = (sm['fail'], sm['minRatio'], sm['n'])
        tot[p] += sm['n']; totf[p] += sm['fail']
        for x in r['all']:
            if x.get('fail'):
                key = (x['path'].split(' ')[-1][:40], x['text'][:14])
                prev = rec[key].get(p)
                if prev is None or x['ratio'] < prev: rec[key][p] = x['ratio']
lines = ['| 画面 \\ 主题 | ' + ' | '.join(P) + ' |', '|---|' + '---:|' * len(P)]
for s in S:
    row = [s]
    for p in P:
        c = cell.get((p, s)); row.append('—' if not c else f'{c[0]}/{c[2]} · {c[1]}')
    lines.append('| ' + ' | '.join(row) + ' |')
lines.append('| **合计不达标 / 测量文字段** | ' + ' | '.join(f'**{totf[p]}/{tot[p]}** ({(totf[p]/tot[p]*100 if tot[p] else 0):.0f}%)' for p in P) + ' |')
open(f'{TV}/out/matrix_table.md', 'w').write('\n'.join(lines) + '\n')
# recurring failures: how many themes each failing element fails in, worst ratio
recl = sorted(rec.items(), key=lambda kv: (-len(kv[1]), min(kv[1].values())))
out = ['| 元素 (选择器 · 文字) | 在几个主题里不达标 | 最差对比 | 各主题最差 |', '|---|---:|---:|---|']
for (path, text), d in recl[:40]:
    out.append(f"| `{path}` · {text} | {len(d)} | {min(d.values())} | " + ', '.join(f'{k}:{v}' for k, v in sorted(d.items(), key=lambda x: P.index(x[0]))) + ' |')
open(f'{TV}/out/matrix_recurring.md', 'w').write('\n'.join(out) + '\n')
json.dump({'cells': {f'{p}|{s}': v for (p, s), v in cell.items()}, 'totals': {p: [totf[p], tot[p]] for p in P}}, open(f'{TV}/out/matrix_summary.json', 'w'), indent=1)
print('\n'.join(lines)); print(); print('\n'.join(out[:30]))
