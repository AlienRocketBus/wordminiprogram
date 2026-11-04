# Before (v1163) vs after (主题2.0 mockup) side-by-side sheets, each phone 390x844 css (shown at 50%).
import sys, os
from PIL import Image, ImageDraw, ImageFont
TV = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual'
F = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 22)
F2 = ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 16)
def load(p):
    if not os.path.exists(p): return Image.new('RGB', (780, 1688), (200, 200, 200))
    return Image.open(p).convert('RGB')
def sheet(out, rows, title):
    sc = 0.5; W, H = int(780 * sc), int(1688 * sc); pad = 14; head = 40; lab = 28
    cols = max(len(r[1]) for r in rows)
    img = Image.new('RGB', (pad + cols * (W + pad), head + len(rows) * (H + lab + pad) + pad), (246, 247, 251))
    d = ImageDraw.Draw(img); d.text((pad, 8), title, fill=(20, 27, 52), font=F)
    for ri, (rowname, cells) in enumerate(rows):
        y = head + ri * (H + lab + pad)
        for ci, (label, path) in enumerate(cells):
            x = pad + ci * (W + pad)
            d.text((x, y + 4), label, fill=(60, 70, 100), font=F2)
            img.paste(load(path).resize((W, H)), (x, y + lab))
    img.save(out); print(out, img.size)
S = TV + '/shots/'
def before(p, s): return S + f'm_{p}_{s}.png'
def mock(n): return S + f'mock_{n}.png'
for th, pal, nm in [('cosmos', 'cosmos', '暗色·深空蓝'), ('cloud', 'cloud', '亮色·云端白')]:
    sheet(f'{TV}/out/ba_{th}_1.png', [
        ('home', [('现在 · 首页第一屏', before(pal, 'home_top')), ('2.0 · 首页「今天」', mock(f'home_{th}')), ('现在 · 岛屿菜单', before(pal, 'food_menu')), ('2.0 · 岛屿菜单', mock(f'island_{th}'))]),
    ], f'主题2.0 前后对比（{nm}）· 首页 / 岛屿菜单 · 390×844')
    sheet(f'{TV}/out/ba_{th}_2.png', [
        ('answer', [('现在 · 答对', before(pal, 'listen_right')), ('2.0 · 答对（动画中）', mock(f'answer_right_{th}_mid')), ('2.0 · 答对（定格）', mock(f'answer_right_{th}')), ('现在 · 答错', before(pal, 'listen_wrong')), ('2.0 · 答错（变成小课）', mock(f'answer_wrong_{th}'))]),
    ], f'主题2.0 前后对比（{nm}）· 答题揭晓 · 390×844')
    sheet(f'{TV}/out/ba_{th}_3.png', [
        ('celebrate', [('现在 · 每日宝箱', before(pal, 'chest')), ('2.0 · 开箱（金币飞向顶栏）', mock(f'chestopen_{th}_mid')), ('2.0 · 开箱（定格）', mock(f'chestopen_{th}')), ('现在 · 结算页', before(pal, 'listen_result')), ('2.0 · 结算（星星+升级）', mock(f'result_{th}_mid')), ('2.0 · 结算（定格）', mock(f'result_{th}'))]),
    ], f'主题2.0 前后对比（{nm}）· 庆祝时刻 / 结算页 · 390×844')
sheet(f'{TV}/out/ba_new_themes.png', [('new', [(f'2.0 · {n}', mock(f'home_{k}')) for k, n in [('lantern', '新春灯笼(暗)'), ('snow', '冬日雪国(亮)'), ('kidsday', '六一派对(亮)'), ('violet', '暗夜紫'), ('sakura', '樱花粉'), ('mint', '薄荷绿')]])], '主题2.0 · 同一套颜色角色换上 6 个主题（含 3 个新季节主题）')
