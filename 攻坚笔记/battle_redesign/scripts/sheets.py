# 前后对比图（左：v1163 体检截图，右：2.0 样稿暗/亮）+ 每组状态的总览拼图。用法: python3 -I scripts/sheets.py
import json, os
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); B = os.path.dirname(HERE)
AUD = os.path.join(B, '..', 'next_inputs', 'ux_audit_shots'); SH = os.path.join(B, 'shots'); OUT = os.path.join(B, 'sheets'); os.makedirs(OUT, exist_ok=True)
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', s)
W, H = 390, 844
def tile(path, w=W, h=H):
    im = Image.open(path).convert('RGB'); return im.resize((w, int(im.height * w / im.width)))
def sheet(title, cols, out, h=H):
    pad, top = 14, 64
    c = Image.new('RGB', (pad + len(cols) * (W + pad), top + h + pad + 26), (244, 246, 251)); d = ImageDraw.Draw(c)
    d.text((pad, 14), title, fill=(20, 27, 52), font=F(24))
    for i, (lab, p) in enumerate(cols):
        x = pad + i * (W + pad); d.text((x, top - 24), lab, fill=(59, 70, 100), font=F(17))
        if p and os.path.exists(p): c.paste(tile(p).crop((0, 0, W, h)), (x, top))
        else: d.rectangle((x, top, x + W, top + h), outline=(200, 0, 0)); d.text((x + 10, top + 10), '缺图 ' + str(p), fill=(200, 0, 0), font=F(14))
    c.save(out, optimize=True)
PAIRS = [('11_ladder_home_ranked_board_dark', 'ld_ranked', '天梯主页'), ('13_ladder_matching_10s_dark', 'mt_search', '找对手'),
         ('21_lobby_rooms_dark', 'lb_rooms', '公开房间'), ('23_mode_chooser_dark', 'ch_default', '选玩法'), ('24_waiting_public_dark', 'wt_public', '等对手'),
         ('30_battle_A_midround_dark', 'bt_A_mid', '对战·暗色'), ('30_battle_A_midround_light', 'bt_A_mid', '对战·亮色'),
         ('40_result_win_A_dark', 'rs_win', '结算·赢'), ('40_result_lose_A_light', 'rs_lose', '结算·输(亮色)'), ('50_friends_list_dark', 'fr_list', '好友')]
for a, s, n in PAIRS:
    sheet(f'对战界面 前后对比 · {n} · 390×844', [('现在 v1163（体检截图）', os.path.join(AUD, a + '.png')), ('2.0 暗色 深空蓝', os.path.join(SH, '390x844', s + '_cosmos.png')), ('2.0 亮色 云端白', os.path.join(SH, '390x844', s + '_cloud.png'))],
          os.path.join(OUT, f'before_after_{a[:2]}_{s}.png'))
sheet('风格参照 · 岛内 Spelling Bee 对战机器人 vs 2.0 对战回合', [('参照：Spelling Bee 设置', os.path.join(AUD, '05_sibling_spellbee_dark.png')), ('参照：Spelling Bee 回合', os.path.join(AUD, '05b_sibling_spellbee_round_dark.png')),
      ('2.0 对战 · 暗色', os.path.join(SH, '390x844', 'bt_A_opp_cosmos.png')), ('2.0 对战 · 亮色', os.path.join(SH, '390x844', 'bt_A_opp_cloud.png'))], os.path.join(OUT, 'reference_spellbee_vs_battle.png'))
# 每组状态总览（暗/亮各一张；390 与 360 各一套）
states = json.load(open(os.path.join(B, 'metrics', 'states.json')))
groups = {}
for k, g, n in states: groups.setdefault(g, []).append((k, n))
for size in ('390x844', '360x640'):
    sw, shh = map(int, size.split('x'))
    for theme in ('cosmos', 'cloud'):
        for gi, (g, items) in enumerate(groups.items()):
            per = 6; rows = (len(items) + per - 1) // per; tw = 300; th = int(shh * tw / sw); pad = 12
            c = Image.new('RGB', (pad + per * (tw + pad), 56 + rows * (th + 44)), (244, 246, 251)); d = ImageDraw.Draw(c)
            d.text((pad, 12), f'{g} · {"暗色 深空蓝" if theme == "cosmos" else "亮色 云端白"} · {size}', fill=(20, 27, 52), font=F(22))
            for i, (k, n) in enumerate(items):
                x = pad + (i % per) * (tw + pad); y = 56 + (i // per) * (th + 44)
                d.text((x, y), n[:22], fill=(59, 70, 100), font=F(14)); d.text((x, y + 18), k, fill=(110, 120, 140), font=F(12))
                p = os.path.join(SH, size, f'{k}_{theme}.png')
                if os.path.exists(p): c.paste(Image.open(p).convert('RGB').resize((tw, th)), (x, y + 36))
            c.save(os.path.join(OUT, f'all_{size}_{theme}_{gi:02d}_{g}.png'), optimize=True)
print('ok', len(os.listdir(OUT)))
