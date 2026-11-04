# 主题 2.0 — single source of truth for color roles of every theme + contrast gate.
# Generates mockups/tokens.css and out/tokens_contrast.json / .md. Exit code 1 if any pair fails.
import json, re, sys
OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/theme-visual'
def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))
def lin(v):
    v /= 255; return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
def L(rgb): return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2])
def cr(a, b):
    la, lb = L(a), L(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
def rgba(s):
    m = re.match(r'rgba\((\d+),(\d+),(\d+),([\d.]+)\)', s.replace(' ', ''))
    return (int(m.group(1)), int(m.group(2)), int(m.group(3))), float(m.group(4))
def over(top, a, bot): return tuple(round(top[i] * a + bot[i] * (1 - a)) for i in range(3))

# Shared feature (mode-card) gradients: decorative only, labels always sit on --plate.
FEATURE = {
 'f-red': ('#FF7A7A', '#E2445C'), 'f-orange': ('#FFC15E', '#FF8A1F'), 'f-yellow': ('#FFE36E', '#FFB81F'),
 'f-green': ('#5BE38E', '#18A957'), 'f-teal': ('#3DDBC7', '#0E9C8F'), 'f-blue': ('#6CB2FF', '#2F6BEA'),
 'f-indigo': ('#8E96FF', '#5A4CF0'), 'f-purple': ('#C98BFF', '#9338EA'), 'f-pink': ('#FFA8D6', '#E0347E'),
}
LIGHTEST_FEATURE = max((hx(a) for a, b in FEATURE.values()), key=L)
HERO = ('#D63A55', '#8E1A45')  # shared hero/CTA card gradient; white text must pass on its lighter stop

T = {}
def theme(id, name, emoji, mode, kind, **v): T[id] = dict(id=id, name=name, emoji=emoji, mode=mode, kind=kind, v=v)
# ---- dark palettes (free) ----
COMMON_DARK = dict(accent_1='#FFD54A', accent_2='#FFAB2E', on_accent='#3B0764', brand_1='#6A5AF9', brand_2='#4F3FE0', on_brand='#FFFFFF',
  good='#34D399', bad='#FB7185', warn='#FBBF24', coin='#FFC93C', gem='#67E8F9', star='#FFD54A', xp_1='#34D399', xp_2='#22D3EE',
  plate='rgba(9,12,36,0.62)', on_plate='#FFFFFF', focus='#FFD54A', badge_bg='#E11D48', on_badge='#FFFFFF')
theme('cosmos', '深空蓝', '🌌', 'dark', 'free', bg_1='#0B1233', bg_2='#1A2462', bg_3='#2A3C93',
  neb_1='rgba(168,85,247,0.28)', neb_2='rgba(59,130,246,0.30)', neb_3='rgba(236,72,153,0.18)',
  chrome='#141C4E', chrome_ink='#F7F8FF', nav='#10173F', nav_ink='#C3CCEB', nav_ink_on='#FFD54A',
  surface_1='#19225A', surface_2='#222D70', surface_3='#0E1540', ink_1='#F7F8FF', ink_2='#CBD3F2', ink_3='#A6B1DC',
  line='rgba(165,180,252,0.22)', line_strong='#7C8AD6', hi='#FFD54A',
  good_surface='#0F4A34', on_good_surface='#ECFDF5', bad_surface='#4C1427', on_bad_surface='#FFF1F2', **COMMON_DARK)
theme('violet', '暗夜紫', '🔮', 'dark', 'free', bg_1='#150A2E', bg_2='#2A1556', bg_3='#4A1D8F',
  neb_1='rgba(192,132,252,0.30)', neb_2='rgba(129,140,248,0.28)', neb_3='rgba(236,72,153,0.20)',
  chrome='#201342', chrome_ink='#FBF8FF', nav='#190F37', nav_ink='#CFC4EE', nav_ink_on='#FFD54A',
  surface_1='#24174A', surface_2='#302060', surface_3='#170E33', ink_1='#FBF8FF', ink_2='#DCD2F7', ink_3='#B7A9E2',
  line='rgba(196,181,253,0.24)', line_strong='#8D7BD6', hi='#FFD54A',
  good_surface='#103F33', on_good_surface='#ECFDF5', bad_surface='#4A1030', on_bad_surface='#FFF1F2', **COMMON_DARK)
theme('aurora', '极光青', '🌊', 'dark', 'free', bg_1='#031A20', bg_2='#0A3440', bg_3='#0E5A6B',
  neb_1='rgba(45,212,191,0.28)', neb_2='rgba(34,211,238,0.28)', neb_3='rgba(59,130,246,0.20)',
  chrome='#082A33', chrome_ink='#F2FFFC', nav='#06222A', nav_ink='#BFE6DF', nav_ink_on='#FFD54A',
  surface_1='#0D2B35', surface_2='#123A47', surface_3='#071D24', ink_1='#F2FFFC', ink_2='#C4ECE5', ink_3='#95CABF',
  line='rgba(94,234,212,0.22)', line_strong='#4FA89A', hi='#FFD54A',
  good_surface='#0C4434', on_good_surface='#ECFDF5', bad_surface='#4A1427', on_bad_surface='#FFF1F2', **COMMON_DARK)
theme('woods', '森野绿', '🌲', 'dark', 'free', bg_1='#0A1C10', bg_2='#153A20', bg_3='#24592F',
  neb_1='rgba(74,222,128,0.26)', neb_2='rgba(163,230,53,0.22)', neb_3='rgba(253,224,71,0.14)',
  chrome='#102A18', chrome_ink='#F4FFF5', nav='#0C2213', nav_ink='#C2E3C8', nav_ink_on='#FFE066',
  surface_1='#132E1C', surface_2='#1B3D26', surface_3='#0B1F12', ink_1='#F4FFF5', ink_2='#CBEBD0', ink_3='#9DC8A6',
  line='rgba(134,239,172,0.22)', line_strong='#5E9E6C', hi='#FFE066',
  good_surface='#0F4A2C', on_good_surface='#ECFDF5', bad_surface='#4A1427', on_bad_surface='#FFF1F2', **dict(COMMON_DARK, star='#FFE066'))
# ---- light palettes (free) ----
COMMON_LIGHT = dict(accent_1='#FFD54A', accent_2='#FFB020', on_accent='#3B0764', warn='#B45F06', coin='#FFC93C', coin_rim='#9A6700',
  gem='#0891B2', star='#FFC93C', star_rim='#9A6700', xp_1='#16A34A', xp_2='#0891B2', plate='rgba(20,16,48,0.58)', on_plate='#FFFFFF',
  good='#15803D', bad='#E11D48', good_surface='#DCFCE7', on_good_surface='#14532D', bad_surface='#FFE4E6', on_bad_surface='#881337', badge_bg='#E11D48', on_badge='#FFFFFF')
theme('cloud', '云端白', '☁️', 'light', 'free', bg_1='#E9F0FF', bg_2='#F7FAFF', bg_3='#DCE6FF',
  neb_1='rgba(129,140,248,0.22)', neb_2='rgba(56,189,248,0.18)', neb_3='rgba(244,114,182,0.12)',
  chrome='#FFFFFF', chrome_ink='#141B34', nav='#FFFFFF', nav_ink='#4A5573', nav_ink_on='#4338CA',
  surface_1='#FFFFFF', surface_2='#F3F6FD', surface_3='#E2E9F7', ink_1='#141B34', ink_2='#3B4664', ink_3='#566180',
  line='rgba(67,56,202,0.16)', line_strong='#7D88AD', hi='#3730A3', brand_1='#5B4CF0', brand_2='#4338CA', on_brand='#FFFFFF', focus='#4338CA', **COMMON_LIGHT)
theme('sakura', '樱花粉', '🌸', 'light', 'free', bg_1='#FFE9F2', bg_2='#FFF6FA', bg_3='#FAD7E7',
  neb_1='rgba(244,114,182,0.22)', neb_2='rgba(192,132,252,0.14)', neb_3='rgba(251,191,36,0.10)',
  chrome='#FFFFFF', chrome_ink='#3D1630', nav='#FFFFFF', nav_ink='#6B3A55', nav_ink_on='#BE185D',
  surface_1='#FFFFFF', surface_2='#FFF4F8', surface_3='#F7DDE8', ink_1='#3D1630', ink_2='#6B3A55', ink_3='#7A4863',
  line='rgba(190,24,93,0.16)', line_strong='#B07A93', hi='#9F1239', brand_1='#C0266D', brand_2='#9D174D', on_brand='#FFFFFF', focus='#BE185D', **COMMON_LIGHT)
theme('cream', '奶油杏', '🍦', 'light', 'free', bg_1='#FBF1DE', bg_2='#FFF9EE', bg_3='#F4E2C2',
  neb_1='rgba(251,146,60,0.16)', neb_2='rgba(251,191,36,0.16)', neb_3='rgba(244,114,182,0.10)',
  chrome='#FFFFFF', chrome_ink='#2B2118', nav='#FFFFFF', nav_ink='#5B4B3B', nav_ink_on='#1D4ED8',
  surface_1='#FFFFFF', surface_2='#FFF8EC', surface_3='#F1E3C8', ink_1='#2B2118', ink_2='#5B4B3B', ink_3='#6B5A49',
  line='rgba(120,90,40,0.18)', line_strong='#A08A6E', hi='#1E40AF', brand_1='#2563EB', brand_2='#1D4ED8', on_brand='#FFFFFF', focus='#1D4ED8', **COMMON_LIGHT)
theme('mint', '薄荷绿', '🌿', 'light', 'free', bg_1='#E3F6EC', bg_2='#F3FBF7', bg_3='#CDEEDD',
  neb_1='rgba(52,211,153,0.20)', neb_2='rgba(45,212,191,0.16)', neb_3='rgba(56,189,248,0.12)',
  chrome='#FFFFFF', chrome_ink='#10302A', nav='#FFFFFF', nav_ink='#2F5A4C', nav_ink_on='#047857',
  surface_1='#FFFFFF', surface_2='#F1FAF5', surface_3='#DCEFE4', ink_1='#10302A', ink_2='#2F5A4C', ink_3='#41665A',
  line='rgba(4,120,87,0.16)', line_strong='#6E9C8C', hi='#065F46', brand_1='#0F766E', brand_2='#115E59', on_brand='#FFFFFF', focus='#047857', **COMMON_LIGHT)
# ---- new seasonal themes built on the same roles ----
theme('lantern', '新春灯笼', '🏮', 'dark', 'season', bg_1='#2A0508', bg_2='#5A0E14', bg_3='#8E1B1B',
  neb_1='rgba(255,196,0,0.18)', neb_2='rgba(255,94,58,0.22)', neb_3='rgba(255,140,180,0.12)',
  chrome='#3A0A0F', chrome_ink='#FFF8EC', nav='#2E070B', nav_ink='#F4C9B5', nav_ink_on='#FFD24A',
  surface_1='#4A0E14', surface_2='#5C141B', surface_3='#33080D', ink_1='#FFF8EC', ink_2='#FFDCC8', ink_3='#F4BBA3',
  line='rgba(255,210,74,0.24)', line_strong='#C98A5A', hi='#FFD24A',
  good_surface='#0F4A2C', on_good_surface='#ECFDF5', bad_surface='#3B0A2A', on_bad_surface='#FFE4E6',
  **dict(COMMON_DARK, on_accent='#5A0E14', brand_1='#D41F45', brand_2='#A3122F', bad='#FDA4AF'))
theme('snow', '冬日雪国', '❄️', 'light', 'season', bg_1='#E6F4FF', bg_2='#F7FBFF', bg_3='#D3E9FB',
  neb_1='rgba(147,197,253,0.30)', neb_2='rgba(196,181,253,0.20)', neb_3='rgba(255,255,255,0.60)',
  chrome='#FFFFFF', chrome_ink='#0E2440', nav='#FFFFFF', nav_ink='#2E4A6B', nav_ink_on='#1D4ED8',
  surface_1='#FFFFFF', surface_2='#F2F8FE', surface_3='#DDEBF7', ink_1='#0E2440', ink_2='#2E4A6B', ink_3='#46617F',
  line='rgba(29,78,216,0.16)', line_strong='#7D93B5', hi='#1D4ED8', brand_1='#2563EB', brand_2='#1D4ED8', on_brand='#FFFFFF', focus='#1D4ED8', **COMMON_LIGHT)
theme('kidsday', '六一派对', '🎈', 'light', 'season', bg_1='#FFF1CF', bg_2='#FFFBEF', bg_3='#FFE0EE',
  neb_1='rgba(255,214,0,0.26)', neb_2='rgba(255,105,180,0.18)', neb_3='rgba(56,189,248,0.18)',
  chrome='#FFFFFF', chrome_ink='#22153A', nav='#FFFFFF', nav_ink='#4A3C66', nav_ink_on='#7E22CE',
  surface_1='#FFFFFF', surface_2='#FFF8E8', surface_3='#FCE9C8', ink_1='#22153A', ink_2='#4A3C66', ink_3='#5C4E78',
  line='rgba(126,34,206,0.16)', line_strong='#9A8AB5', hi='#7E22CE', brand_1='#C81E6B', brand_2='#9D174D', on_brand='#FFFFFF', focus='#7E22CE', **COMMON_LIGHT)
# ---- boss stage themes map onto the same roles (dark = cosmos stage, light = 晨曦) ----
theme('boss_light', '打Boss·晨曦', '🌤️', 'light', 'boss', bg_1='#FFFFFF', bg_2='#DBE7F8', bg_3='#BCD0EA',
  neb_1='rgba(30,64,175,0.10)', neb_2='rgba(30,64,175,0.06)', neb_3='rgba(255,255,255,0.0)',
  chrome='#FFFFFF', chrome_ink='#1E293B', nav='#FFFFFF', nav_ink='#334155', nav_ink_on='#1E40AF',
  surface_1='#F8FBFF', surface_2='#EEF4FC', surface_3='#D7E3F4', ink_1='#1E293B', ink_2='#334155', ink_3='#475569',
  line='rgba(30,64,175,0.18)', line_strong='#7D93B5', hi='#1E40AF', brand_1='#3730A3', brand_2='#312E81', on_brand='#FFFFFF', focus='#1E40AF', **COMMON_LIGHT)

FEATURE_KEYS = list(FEATURE)
# ---- contrast gate ----
def solid(v, k):
    s = v[k]
    return hx(s) if s.startswith('#') else None
def check(t):
    v = t['v']; res = []
    def pair(kind, fgk, bgk, need, fg=None, bg=None, label=None):
        f = fg or hx(v[fgk]); b = bg or hx(v[bgk])
        r = cr(f, b); res.append(dict(kind=kind, fg=fgk, bg=bgk if not label else label, ratio=round(r, 2), need=need, ok=r >= need))
    for fg in ('ink_1', 'ink_2', 'ink_3', 'hi'):
        for bg in ('surface_1', 'surface_2'): pair('text', fg, bg, 4.5)
    for fg in ('ink_1', 'ink_2'):
        for bg in ('bg_1', 'bg_2', 'bg_3'): pair('text', fg, bg, 4.5)
    pair('text', 'hi', 'bg_1', 4.5); pair('text', 'ink_1', 'surface_3', 4.5)
    pair('text', 'chrome_ink', 'chrome', 4.5); pair('text', 'nav_ink', 'nav', 4.5); pair('text', 'nav_ink_on', 'nav', 4.5)
    for bg in ('accent_1', 'accent_2'): pair('text', 'on_accent', bg, 4.5)
    for bg in ('brand_1', 'brand_2'): pair('text', 'on_brand', bg, 4.5)
    pair('text', 'on_good_surface', 'good_surface', 4.5); pair('text', 'on_bad_surface', 'bad_surface', 4.5)
    pair('text', 'on_badge', 'badge_bg', 4.5)
    pair('text', 'on_plate', 'hero', 4.5, fg=(255,255,255), bg=hx(HERO[0]), label='hero-a (white text)')
    # label plate over the lightest feature gradient stop (worst case)
    pc, pa = rgba(v['plate']); comp = over(pc, pa, LIGHTEST_FEATURE)
    pair('text', 'on_plate', 'plate', 4.5, bg=comp, label='plate∘lightest-feature')
    # non-text (icons, borders, focus) >= 3
    for fg in ('good', 'bad', 'focus', 'line_strong', 'gem', 'xp_1'):
        pair('non-text', fg, 'surface_1', 3.0)
    pair('non-text', 'star_rim' if 'star_rim' in v else 'star', 'surface_1', 3.0)
    coin = v.get('coin_rim') or v['coin']
    pair('non-text', 'coin' if 'coin_rim' not in v else 'coin_rim', 'surface_1', 3.0, fg=hx(coin))
    pair('non-text', 'focus', 'bg_1', 3.0)
    return res
report = {}; fails = 0
for k, t in T.items():
    r = check(t); bad = [x for x in r if not x['ok']]; fails += len(bad)
    report[k] = dict(name=t['name'], mode=t['mode'], kind=t['kind'], pairs=len(r), fail=len(bad), min_text=min(x['ratio'] for x in r if x['kind'] == 'text'),
                     min_nontext=min(x['ratio'] for x in r if x['kind'] == 'non-text'), bad=bad, all=r)
json.dump(report, open(OUT + '/out/tokens_contrast.json', 'w'), ensure_ascii=False, indent=1)
# ---- CSS ----
def var(k): return '--' + k.replace('_', '-')
css = ['/* 主题 2.0 tokens — generated by scripts/tokens2.py. Do not hand-edit colors; every theme passes the contrast gate. */']
css.append(':root{' + ';'.join(f'--{k}-a:{a};--{k}-b:{b}' for k, (a, b) in FEATURE.items()) + ';'
  '--font-display:"CartoonBlack","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",sans-serif;'
  '--font-body:-apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC",sans-serif;'
  '--font-latin:"Baloo2","Arial Rounded MT Bold",-apple-system,"Segoe UI",Roboto,sans-serif;'
  '--fs-cap:12px;--fs-sm:14px;--fs-body:15px;--fs-lg:17px;--fs-title:20px;--fs-h2:24px;--fs-h1:30px;--fs-word:36px;--fs-display:44px;'
  '--lh-tight:1.2;--lh-body:1.5;'
  '--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:20px;--sp-6:24px;--sp-8:32px;'
  '--r-sm:10px;--r-md:14px;--r-lg:20px;--r-xl:28px;--r-pill:999px;'
  '--m-press:120ms;--m-ui:200ms;--m-enter:320ms;--m-reveal:560ms;--m-celebrate:1100ms;'
  '--ease-out:cubic-bezier(.2,.8,.2,1);--ease-pop:cubic-bezier(.34,1.56,.64,1);--ease-in:cubic-bezier(.4,0,1,1);'
  '--z-nav:100;--z-sheet:200;--z-toast:300;--z-modal:400;--z-fx:500;--tap:48px;'
  f'--hero-a:{HERO[0]};--hero-b:{HERO[1]}}}')
for k, t in T.items():
    v = t['v']; sel = ':root,[data-theme="cosmos"]' if k == 'cosmos' else f'[data-theme="{k}"]'
    body = ';'.join(f'{var(x)}:{y}' for x, y in v.items())
    shadow = ('--e-1:0 1px 0 rgba(255,255,255,.06) inset,0 6px 16px rgba(0,0,0,.28);--e-2:0 4px 0 rgba(0,0,0,.28),0 10px 22px rgba(0,0,0,.30);--e-3:0 18px 44px rgba(0,0,0,.45)'
              if t['mode'] == 'dark' else
              '--e-1:0 1px 2px rgba(20,27,52,.06),0 6px 16px rgba(20,27,52,.08);--e-2:0 4px 0 rgba(20,27,52,.14),0 10px 22px rgba(20,27,52,.12);--e-3:0 18px 44px rgba(20,27,52,.18)')
    css.append(f'{sel}{{color-scheme:{t["mode"]};{body};{shadow}}}')
open(OUT + '/mockups/tokens.css', 'w').write('\n'.join(css) + '\n')
# ---- markdown ----
md = ['| 主题 | 类型 | 明暗 | 检查对数 | 不达标 | 最低文字对比 | 最低图标/边框对比 |', '|---|---|---|---:|---:|---:|---:|']
for k, r in report.items():
    md.append(f"| {T[k]['emoji']} {r['name']} (`{k}`) | {r['kind']} | {r['mode']} | {r['pairs']} | {r['fail']} | {r['min_text']} | {r['min_nontext']} |")
open(OUT + '/out/tokens_contrast.md', 'w').write('\n'.join(md) + '\n')
for k, r in report.items():
    print(k, 'fail', r['fail'], 'minText', r['min_text'], 'minNon', r['min_nontext'], [(b['fg'], b['bg'], b['ratio']) for b in r['bad']])
sys.exit(1 if fails else 0)
