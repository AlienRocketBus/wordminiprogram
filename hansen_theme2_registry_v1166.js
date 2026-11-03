/* hansen_theme2_registry — 主题 2.0 唯一真源（颜色角色 + 全部主题 + 老主题映射）
 * ------------------------------------------------------------------
 * 是什么：一份数据，说清楚「每个主题在每个颜色角色上用什么颜色」。
 *   · 12 套基础角色（8 个免费配色 + 3 个季节主题 + 打Boss晨曦）
 *   · 每个老主题（金币 6、钻石 IMAX 8 / 画廊 18、打Boss 3、拼写蜂 6、卡册底色 9、殿堂卡面 13）
 *     都映射到一个 2.0 主题；已买的东西一个不丢，老存档键一个不改。
 * 怎么用：
 *   · 浏览器：<script src="hansen_theme2_registry_vXXXX.js"> → window.HansenTheme2
 *     HansenTheme2.apply() 在 <html> 上写 data-t2-theme / data-t2-base / data-t2-mode，
 *     配合 theme2_tokens.css 生效。只写属性，不改任何老样式 → 接入前对画面零影响。
 *   · node：createRequire 引入（构建 CSS、对比度门禁都读这一份）。
 * 铁律：
 *   · 只读老存档键（hansen_palette_global / theme / hansen_unlocked_themes / hansen_diamond_shop /
 *     hansen_boss_theme / hansen_sb_theme / hansen_card_bg），绝不写它们。
 *   · 只新增一个键 hansen_theme2_season_pick（孩子选了季节主题时才写）。
 *   · 不轮询：只在 storage / pageshow / visibilitychange 事件时重算。
 *   · 改颜色只改这里，然后跑 攻坚笔记/theme2/tools/theme2_build.mjs 重新生成 CSS、跑对比度门禁。
 *   · 文件里不写版本号字面量（批量升版会误改）。
 * ------------------------------------------------------------------ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.HansenTheme2 = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  /* ================= 颜色小工具（门禁和运行时共用，同一套算法） ================= */
  function clamp255(n) { n = Math.round(n); return n < 0 ? 0 : n > 255 ? 255 : n; }
  /* 解析 #RGB / #RRGGBB / rgba(r,g,b,a) → {r,g,b,a} */
  function parse(c) {
    if (c && typeof c === 'object') return c;
    var s = String(c || '').trim(), m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(s))) {
      var h = m[1]; return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 };
    }
    if ((m = /^#([0-9a-f]{6})$/i.exec(s))) {
      var x = m[1]; return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: 1 };
    }
    if ((m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s))) {
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
    }
    throw new Error('theme2: 不认识的颜色 ' + s);
  }
  function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { c = parse(c); return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
  /* 半透明 top 叠在不透明 bot 上 */
  function over(top, bot) {
    top = parse(top); bot = parse(bot); var a = top.a;
    return { r: clamp255(top.r * a + bot.r * (1 - a)), g: clamp255(top.g * a + bot.g * (1 - a)), b: clamp255(top.b * a + bot.b * (1 - a)), a: 1 };
  }
  /* WCAG 对比度；前景半透明时先叠到背景上 */
  function ratio(fg, bg) {
    var b = parse(bg); if (b.a < 1) throw new Error('theme2: 背景必须不透明（先 over）');
    var f = parse(fg); if (f.a < 1) f = over(f, b);
    var la = lum(f), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function hex(c) { c = parse(c); function h(n) { return ('0' + clamp255(n).toString(16)).slice(-2); } return '#' + h(c.r) + h(c.g) + h(c.b); }
  /* CIE Lab 距离（看两个主题是不是“几乎一样”，TV-13） */
  function lab(c) {
    c = parse(c); var r = lin(c.r), g = lin(c.g), b = lin(c.b);
    var X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116; }
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  }
  function deltaE(a, b) { var p = lab(a), q = lab(b); return Math.sqrt(Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2) + Math.pow(p[2] - q[2], 2)); }

  /* ================= 颜色角色（组件只许用这些） ================= */
  /* kind: surface=底色 / ink=文字 / icon=图标边框 / deco=纯装饰（不承载文字） */
  var ROLES = {
    bg_1: ['surface', '页面背景（最暗/最浅一端）'], bg_2: ['surface', '页面背景（中段）'], bg_3: ['surface', '页面背景（顶端）'],
    neb_1: ['deco', '星云 1（装饰）'], neb_2: ['deco', '星云 2（装饰）'], neb_3: ['deco', '星云 3（装饰）'],
    chrome: ['surface', '顶栏'], chrome_ink: ['ink', '顶栏文字'],
    nav: ['surface', '底栏'], nav_ink: ['ink', '底栏文字'], nav_ink_on: ['ink', '底栏选中'],
    surface_1: ['surface', '卡片'], surface_2: ['surface', '抬高的面板 / 小胶囊'], surface_3: ['surface', '凹槽（进度条底）'],
    ink_1: ['ink', '主文字'], ink_2: ['ink', '次要文字'], ink_3: ['ink', '说明文字'],
    hi: ['ink', '数字、关键词'],
    line: ['deco', '分隔线（装饰，不承担边界）'], line_strong: ['icon', '输入框 / 选项边框'], focus: ['icon', '焦点框'],
    accent_1: ['surface', '金色主按钮（上）'], accent_2: ['surface', '金色主按钮（下）'], on_accent: ['ink', '金色按钮上的字'],
    brand_1: ['surface', '次按钮（上）'], brand_2: ['surface', '次按钮（下）'], on_brand: ['ink', '次按钮上的字'],
    good: ['icon', '答对（图标/边框）'], bad: ['icon', '答错（图标/边框）'], warn: ['icon', '提醒（图标/边框）'],
    good_surface: ['surface', '答对底'], on_good_surface: ['ink', '答对底上的字'],
    bad_surface: ['surface', '答错底'], on_bad_surface: ['ink', '答错底上的字'],
    badge_bg: ['surface', '红色角标'], on_badge: ['ink', '角标数字'],
    coin: ['icon', '金币填充'], coin_rim: ['icon', '金币描边'], gem: ['icon', '钻石'],
    star: ['icon', '星星填充'], star_rim: ['icon', '星星描边'], xp_1: ['icon', '经验条（左）'], xp_2: ['icon', '经验条（右）'],
    plate: ['surface', '彩色卡片上的标签底板（半透明）'], on_plate: ['ink', '底板上的字'],
    scrim: ['surface', '压在场景图上的遮罩（半透明）'], on_scrim: ['ink', '遮罩上的字']
  };
  var ROLE_KEYS = Object.keys(ROLES);

  /* ================= 不随主题变的 token ================= */
  /* 玩法卡渐变：功能的“身份色”，所有主题共用，只做装饰；字一律放在 --t2-plate 上 */
  var FEATURE = {
    red: ['#FF7A7A', '#E2445C'], orange: ['#FFC15E', '#FF8A1F'], yellow: ['#FFE36E', '#FFB81F'],
    green: ['#5BE38E', '#18A957'], teal: ['#3DDBC7', '#0E9C8F'], blue: ['#6CB2FF', '#2F6BEA'],
    indigo: ['#8E96FF', '#5A4CF0'], purple: ['#C98BFF', '#9338EA'], pink: ['#FFA8D6', '#E0347E']
  };
  var HERO = ['#D63A55', '#8E1A45'];
  /* 字体角色：不新下载任何字体；'Bowlby One' 从没打包过，2.0 不用；不许 serif 兜底 */
  var FONTS = {
    display: '"CartoonBlack","PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC",sans-serif',
    latin: '"Baloo2","Arial Rounded MT Bold","PingFang SC",-apple-system,"Segoe UI",Roboto,sans-serif',
    body: '-apple-system,"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei","Noto Sans SC",sans-serif'
  };
  var FONT_FILES = { display: { family: 'CartoonBlack', file: 'cartoon_font.woff2', weight: 900 }, latin: { family: 'Baloo2', file: 'baloo2.woff2', weight: 800 } };
  /* 9 级字号：12 只给说明文字；15 正文；36 英文目标词 */
  var TYPE = [['1', 12, '说明（最小）'], ['2', 14, '小字'], ['3', 15, '正文'], ['4', 17, '强调正文'], ['5', 20, '小标题'],
              ['6', 24, '标题 / 奖励数字'], ['7', 30, '大标题'], ['8', 36, '英文目标词'], ['9', 44, '展示大字']];
  var SPACE = [4, 8, 12, 16, 20, 24, 32];
  var RADIUS = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
  /* 动效：按下 120 / 界面 200 / 进入 320 / 揭晓 560 / 庆祝 ≤1100 */
  var MOTION = { press: 120, ui: 200, enter: 320, reveal: 560, celebrate: 1100 };
  var EASE = { out: 'cubic-bezier(.2,.8,.2,1)', pop: 'cubic-bezier(.34,1.56,.64,1)', 'in': 'cubic-bezier(.4,0,1,1)' };
  var Z = { nav: 100, sheet: 200, toast: 300, modal: 400, fx: 500 };
  var ELEVATION = {
    dark: ['0 1px 0 rgba(255,255,255,.06) inset,0 6px 16px rgba(0,0,0,.28)', '0 4px 0 rgba(0,0,0,.28),0 10px 22px rgba(0,0,0,.30)', '0 18px 44px rgba(0,0,0,.45)'],
    light: ['0 1px 2px rgba(20,27,52,.06),0 6px 16px rgba(20,27,52,.08)', '0 4px 0 rgba(20,27,52,.14),0 10px 22px rgba(20,27,52,.12)', '0 18px 44px rgba(20,27,52,.18)']
  };

  /* ================= 12 套基础角色（数值来自已给老师看过的样稿 tokens2.py） ================= */
  function mix(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  var COMMON_DARK = {
    accent_1: '#FFD54A', accent_2: '#FFAB2E', on_accent: '#3B0764', brand_1: '#6A5AF9', brand_2: '#4F3FE0', on_brand: '#FFFFFF',
    good: '#34D399', bad: '#FB7185', warn: '#FBBF24', coin: '#FFC93C', coin_rim: '#B7791F', gem: '#67E8F9', star: '#FFD54A', star_rim: '#B7791F',
    xp_1: '#34D399', xp_2: '#22D3EE', plate: 'rgba(9,12,36,0.62)', on_plate: '#FFFFFF', focus: '#FFD54A', badge_bg: '#E11D48', on_badge: '#FFFFFF',
    on_scrim: '#FFFFFF'
  };
  var COMMON_LIGHT = {
    accent_1: '#FFD54A', accent_2: '#FFB020', on_accent: '#3B0764', warn: '#B45F06', coin: '#FFC93C', coin_rim: '#9A6700',
    gem: '#0891B2', star: '#FFC93C', star_rim: '#9A6700', xp_1: '#159C47', xp_2: '#0891B2', plate: 'rgba(20,16,48,0.58)', on_plate: '#FFFFFF',
    good: '#15803D', bad: '#E11D48', good_surface: '#DCFCE7', on_good_surface: '#14532D', bad_surface: '#FFE4E6', on_bad_surface: '#881337',
    badge_bg: '#E11D48', on_badge: '#FFFFFF'
  };
  var BASES = {
    cosmos: mix(COMMON_DARK, { bg_1: '#0B1233', bg_2: '#1A2462', bg_3: '#2A3C93', neb_1: 'rgba(168,85,247,0.28)', neb_2: 'rgba(59,130,246,0.30)', neb_3: 'rgba(236,72,153,0.18)',
      chrome: '#141C4E', chrome_ink: '#F7F8FF', nav: '#10173F', nav_ink: '#C3CCEB', nav_ink_on: '#FFD54A',
      surface_1: '#19225A', surface_2: '#222D70', surface_3: '#0E1540', ink_1: '#F7F8FF', ink_2: '#CBD3F2', ink_3: '#A6B1DC',
      line: 'rgba(165,180,252,0.22)', line_strong: '#7C8AD6', hi: '#FFD54A',
      good_surface: '#0F4A34', on_good_surface: '#ECFDF5', bad_surface: '#4C1427', on_bad_surface: '#FFF1F2', scrim: 'rgba(11,18,51,0.72)' }),
    violet: mix(COMMON_DARK, { bg_1: '#150A2E', bg_2: '#2A1556', bg_3: '#4A1D8F', neb_1: 'rgba(192,132,252,0.30)', neb_2: 'rgba(129,140,248,0.28)', neb_3: 'rgba(236,72,153,0.20)',
      chrome: '#201342', chrome_ink: '#FBF8FF', nav: '#190F37', nav_ink: '#CFC4EE', nav_ink_on: '#FFD54A',
      surface_1: '#24174A', surface_2: '#302060', surface_3: '#170E33', ink_1: '#FBF8FF', ink_2: '#DCD2F7', ink_3: '#B7A9E2',
      line: 'rgba(196,181,253,0.24)', line_strong: '#8D7BD6', hi: '#FFD54A',
      good_surface: '#103F33', on_good_surface: '#ECFDF5', bad_surface: '#4A1030', on_bad_surface: '#FFF1F2', scrim: 'rgba(21,10,46,0.72)' }),
    aurora: mix(COMMON_DARK, { bg_1: '#031A20', bg_2: '#0A3440', bg_3: '#0B3F4C', neb_1: 'rgba(45,212,191,0.28)', neb_2: 'rgba(34,211,238,0.28)', neb_3: 'rgba(59,130,246,0.20)',
      chrome: '#082A33', chrome_ink: '#F2FFFC', nav: '#06222A', nav_ink: '#BFE6DF', nav_ink_on: '#FFD54A',
      surface_1: '#0D2B35', surface_2: '#123A47', surface_3: '#071D24', ink_1: '#F2FFFC', ink_2: '#C4ECE5', ink_3: '#95CABF',
      line: 'rgba(94,234,212,0.22)', line_strong: '#4FA89A', hi: '#FFD54A',
      good_surface: '#0C4434', on_good_surface: '#ECFDF5', bad_surface: '#4A1427', on_bad_surface: '#FFF1F2', scrim: 'rgba(3,26,32,0.72)' }),
    woods: mix(mix(COMMON_DARK, { star: '#FFE066' }), { bg_1: '#0A1C10', bg_2: '#153A20', bg_3: '#1E4927', neb_1: 'rgba(74,222,128,0.26)', neb_2: 'rgba(163,230,53,0.22)', neb_3: 'rgba(253,224,71,0.14)',
      chrome: '#102A18', chrome_ink: '#F4FFF5', nav: '#0C2213', nav_ink: '#C2E3C8', nav_ink_on: '#FFE066',
      surface_1: '#132E1C', surface_2: '#1B3D26', surface_3: '#0B1F12', ink_1: '#F4FFF5', ink_2: '#CBEBD0', ink_3: '#9DC8A6',
      line: 'rgba(134,239,172,0.22)', line_strong: '#5E9E6C', hi: '#FFE066',
      good_surface: '#0F4A2C', on_good_surface: '#ECFDF5', bad_surface: '#4A1427', on_bad_surface: '#FFF1F2', scrim: 'rgba(10,28,16,0.72)' }),
    cloud: mix(COMMON_LIGHT, { bg_1: '#E9F0FF', bg_2: '#F7FAFF', bg_3: '#DCE6FF', neb_1: 'rgba(129,140,248,0.22)', neb_2: 'rgba(56,189,248,0.18)', neb_3: 'rgba(244,114,182,0.12)',
      chrome: '#FFFFFF', chrome_ink: '#141B34', nav: '#FFFFFF', nav_ink: '#4A5573', nav_ink_on: '#4338CA',
      surface_1: '#FFFFFF', surface_2: '#F3F6FD', surface_3: '#E2E9F7', ink_1: '#141B34', ink_2: '#3B4664', ink_3: '#566180',
      line: 'rgba(67,56,202,0.16)', line_strong: '#7D88AD', hi: '#3730A3', brand_1: '#5B4CF0', brand_2: '#4338CA', on_brand: '#FFFFFF', focus: '#4338CA',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#141B34' }),
    sakura: mix(COMMON_LIGHT, { bg_1: '#FFE9F2', bg_2: '#FFF6FA', bg_3: '#FAD7E7', neb_1: 'rgba(244,114,182,0.22)', neb_2: 'rgba(192,132,252,0.14)', neb_3: 'rgba(251,191,36,0.10)',
      chrome: '#FFFFFF', chrome_ink: '#3D1630', nav: '#FFFFFF', nav_ink: '#6B3A55', nav_ink_on: '#BE185D',
      surface_1: '#FFFFFF', surface_2: '#FFF4F8', surface_3: '#F7DDE8', ink_1: '#3D1630', ink_2: '#6B3A55', ink_3: '#7A4863',
      line: 'rgba(190,24,93,0.16)', line_strong: '#B07A93', hi: '#9F1239', brand_1: '#C0266D', brand_2: '#9D174D', on_brand: '#FFFFFF', focus: '#BE185D',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#3D1630' }),
    cream: mix(COMMON_LIGHT, { bg_1: '#FBF1DE', bg_2: '#FFF9EE', bg_3: '#F4E2C2', neb_1: 'rgba(251,146,60,0.16)', neb_2: 'rgba(251,191,36,0.16)', neb_3: 'rgba(244,114,182,0.10)',
      chrome: '#FFFFFF', chrome_ink: '#2B2118', nav: '#FFFFFF', nav_ink: '#5B4B3B', nav_ink_on: '#1D4ED8',
      surface_1: '#FFFFFF', surface_2: '#FFF8EC', surface_3: '#F1E3C8', ink_1: '#2B2118', ink_2: '#5B4B3B', ink_3: '#6B5A49',
      line: 'rgba(120,90,40,0.18)', line_strong: '#A08A6E', hi: '#1E40AF', brand_1: '#2563EB', brand_2: '#1D4ED8', on_brand: '#FFFFFF', focus: '#1D4ED8',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#2B2118' }),
    mint: mix(COMMON_LIGHT, { bg_1: '#E3F6EC', bg_2: '#F3FBF7', bg_3: '#CDEEDD', neb_1: 'rgba(52,211,153,0.20)', neb_2: 'rgba(45,212,191,0.16)', neb_3: 'rgba(56,189,248,0.12)',
      chrome: '#FFFFFF', chrome_ink: '#10302A', nav: '#FFFFFF', nav_ink: '#2F5A4C', nav_ink_on: '#047857',
      surface_1: '#FFFFFF', surface_2: '#F1FAF5', surface_3: '#DCEFE4', ink_1: '#10302A', ink_2: '#2F5A4C', ink_3: '#41665A',
      line: 'rgba(4,120,87,0.16)', line_strong: '#6A9686', hi: '#065F46', brand_1: '#0F766E', brand_2: '#115E59', on_brand: '#FFFFFF', focus: '#047857',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#10302A' }),
    lantern: mix(mix(COMMON_DARK, { on_accent: '#5A0E14', brand_1: '#D41F45', brand_2: '#A3122F', bad: '#FDA4AF' }), { bg_1: '#2A0508', bg_2: '#5A0E14', bg_3: '#8E1B1B',
      neb_1: 'rgba(255,196,0,0.18)', neb_2: 'rgba(255,94,58,0.22)', neb_3: 'rgba(255,140,180,0.12)',
      chrome: '#3A0A0F', chrome_ink: '#FFF8EC', nav: '#2E070B', nav_ink: '#F4C9B5', nav_ink_on: '#FFD24A',
      surface_1: '#4A0E14', surface_2: '#5C141B', surface_3: '#33080D', ink_1: '#FFF8EC', ink_2: '#FFDCC8', ink_3: '#F4BBA3',
      line: 'rgba(255,210,74,0.24)', line_strong: '#C98A5A', hi: '#FFD24A',
      good_surface: '#0F4A2C', on_good_surface: '#ECFDF5', bad_surface: '#3B0A2A', on_bad_surface: '#FFE4E6', scrim: 'rgba(42,5,8,0.72)' }),
    snow: mix(COMMON_LIGHT, { bg_1: '#DDF3FF', bg_2: '#F4FBFF', bg_3: '#BDE7FB', neb_1: 'rgba(147,197,253,0.30)', neb_2: 'rgba(196,181,253,0.20)', neb_3: 'rgba(255,255,255,0.60)',
      chrome: '#FFFFFF', chrome_ink: '#0E2440', nav: '#FFFFFF', nav_ink: '#2E4A6B', nav_ink_on: '#1D4ED8',
      surface_1: '#FFFFFF', surface_2: '#F2F8FE', surface_3: '#DDEBF7', ink_1: '#0E2440', ink_2: '#2E4A6B', ink_3: '#46617F',
      line: 'rgba(29,78,216,0.16)', line_strong: '#768AAA', hi: '#1D4ED8', brand_1: '#2563EB', brand_2: '#1D4ED8', on_brand: '#FFFFFF', focus: '#1D4ED8',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#0E2440' }),
    kidsday: mix(COMMON_LIGHT, { bg_1: '#FFF1CF', bg_2: '#FFFBEF', bg_3: '#FFE0EE', neb_1: 'rgba(255,214,0,0.26)', neb_2: 'rgba(255,105,180,0.18)', neb_3: 'rgba(56,189,248,0.18)',
      chrome: '#FFFFFF', chrome_ink: '#22153A', nav: '#FFFFFF', nav_ink: '#4A3C66', nav_ink_on: '#7E22CE',
      surface_1: '#FFFFFF', surface_2: '#FFF8E8', surface_3: '#FCE9C8', ink_1: '#22153A', ink_2: '#4A3C66', ink_3: '#5C4E78',
      line: 'rgba(126,34,206,0.16)', line_strong: '#9484AE', hi: '#7E22CE', brand_1: '#C81E6B', brand_2: '#9D174D', on_brand: '#FFFFFF', focus: '#7E22CE',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#22153A' }),
    boss_light: mix(COMMON_LIGHT, { bg_1: '#FFFFFF', bg_2: '#DBE7F8', bg_3: '#BCD0EA', neb_1: 'rgba(30,64,175,0.10)', neb_2: 'rgba(30,64,175,0.06)', neb_3: 'rgba(255,255,255,0.0)',
      chrome: '#FFFFFF', chrome_ink: '#1E293B', nav: '#FFFFFF', nav_ink: '#334155', nav_ink_on: '#1E40AF',
      surface_1: '#F8FBFF', surface_2: '#EEF4FC', surface_3: '#D7E3F4', ink_1: '#1E293B', ink_2: '#334155', ink_3: '#475569',
      line: 'rgba(30,64,175,0.18)', line_strong: '#768AAA', hi: '#1E40AF', brand_1: '#3730A3', brand_2: '#312E81', on_brand: '#FFFFFF', focus: '#1E40AF',
      scrim: 'rgba(255,255,255,0.80)', on_scrim: '#1E293B' })
  };
  var BASE_MODE = { cosmos: 'dark', violet: 'dark', aurora: 'dark', woods: 'dark', lantern: 'dark',
                    cloud: 'light', sakura: 'light', cream: 'light', mint: 'light', snow: 'light', kidsday: 'light', boss_light: 'light' };

  /* ================= 全部主题 =================
   * family: palette 免费配色 / season 季节 / coin 金币主题 / imax 钻石·IMAX / gallery 钻石·画廊 / boss 打Boss舞台
   * base: 用哪套基础角色；over: 只改装饰背景（bg/neb）——字永远在不透明卡面、底板或遮罩上，门禁照样逐对检查
   * scene: 场景图（canvas 或照片），samples = 场景里最亮、最暗、主色的取样（门禁拿遮罩叠在每个取样上算）
   * legacy: 它对应的老 id（只读，不改老存档） */
  var THEMES = [];
  function T(o) { THEMES.push(o); }
  /* 8 个免费配色：同 id、同存储键 hansen_palette_global */
  T({ id: 'cosmos', name: '深空蓝', emoji: '🌌', family: 'palette', base: 'cosmos', legacy: { palette: 'cosmos', coin: 'cosmos' } });
  T({ id: 'violet', name: '暗夜紫', emoji: '🔮', family: 'palette', base: 'violet', legacy: { palette: 'violet' } });
  T({ id: 'aurora', name: '极光青', emoji: '🌊', family: 'palette', base: 'aurora', legacy: { palette: 'aurora' } });
  T({ id: 'woods', name: '森野绿', emoji: '🌲', family: 'palette', base: 'woods', legacy: { palette: 'woods' } });
  T({ id: 'cloud', name: '云端白', emoji: '☁️', family: 'palette', base: 'cloud', legacy: { palette: 'cloud' } });
  T({ id: 'sakura', name: '樱花粉', emoji: '🌸', family: 'palette', base: 'sakura', legacy: { palette: 'sakura' } });
  T({ id: 'cream', name: '奶油杏', emoji: '🍦', family: 'palette', base: 'cream', legacy: { palette: 'cream' } });
  T({ id: 'mint', name: '薄荷绿', emoji: '🌿', family: 'palette', base: 'mint', legacy: { palette: 'mint' } });
  /* 3 个新季节主题（静态 SVG 场景，没有任何循环动画） */
  T({ id: 'lantern', name: '新春灯笼', emoji: '🏮', family: 'season', base: 'lantern', scene: { kind: 'svg', id: 'lantern' }, season: 'cny' });
  T({ id: 'snow', name: '冬日雪国', emoji: '❄️', family: 'season', base: 'snow', scene: { kind: 'svg', id: 'snow' }, season: 'winter' });
  T({ id: 'kidsday', name: '六一派对', emoji: '🎈', family: 'season', base: 'kidsday', scene: { kind: 'svg', id: 'kidsday' }, season: 'kidsday' });
  /* 金币主题（键 theme / hansen_unlocked_themes）：首页和岛内从此只用这一份定义（TV-02）
     每个声明自己的明暗，背景保留各自的“身份色”，所以买过的主题仍然和免费配色不一样 */
  T({ id: 'coin_pink', name: '樱花粉·花瓣', emoji: '🌸', family: 'coin', base: 'sakura', legacy: { coin: 'pink' },
    over: { bg_1: '#FCE7F3', bg_2: '#FFF5FA', bg_3: '#F5D0FE', neb_1: 'rgba(244,114,182,0.30)', neb_2: 'rgba(216,180,254,0.30)', neb_3: 'rgba(253,224,71,0.20)' } });
  T({ id: 'coin_ocean', name: '海洋蓝', emoji: '🌊', family: 'coin', base: 'aurora', legacy: { coin: 'ocean' },
    over: { bg_1: '#04203A', bg_2: '#0B3B66', bg_3: '#0A4264', neb_1: 'rgba(59,130,246,0.32)', neb_2: 'rgba(14,165,233,0.30)', neb_3: 'rgba(34,211,238,0.24)' } });
  T({ id: 'coin_forest', name: '森林绿', emoji: '🌳', family: 'coin', base: 'mint', legacy: { coin: 'forest' },
    over: { bg_1: '#E4F7C8', bg_2: '#F6FDEB', bg_3: '#FDF3C4', neb_1: 'rgba(132,204,22,0.26)', neb_2: 'rgba(253,224,71,0.30)', neb_3: 'rgba(34,197,94,0.18)' } });
  T({ id: 'coin_rainbow', name: '彩虹云朵', emoji: '🌈', family: 'coin', base: 'violet', legacy: { coin: 'rainbow' },
    over: { bg_1: '#1E0B4A', bg_2: '#3B1784', bg_3: '#4E1D9C', neb_1: 'rgba(251,146,60,0.30)', neb_2: 'rgba(34,211,238,0.30)', neb_3: 'rgba(236,72,153,0.30)' } });
  T({ id: 'coin_peach', name: '桃子糖果', emoji: '🍑', family: 'coin', base: 'cream', legacy: { coin: 'peach' },
    over: { bg_1: '#FFEBD6', bg_2: '#FFF8F0', bg_3: '#FFD3C2', neb_1: 'rgba(251,146,60,0.28)', neb_2: 'rgba(253,164,175,0.32)', neb_3: 'rgba(252,231,166,0.30)' } });
  /* 钻石 · IMAX 8 款（canvas 场景：默认只画一帧，事件时才播 ≤6 秒） */
  function imax(id, name, emoji, base, samples) {
    T({ id: 'imax_' + id, name: name, emoji: emoji, family: 'imax', base: base, legacy: { diamond: 'theme_' + id },
      scene: { kind: 'canvas', id: 'theme_' + id, samples: samples } });
  }
  /* samples：c1/c2 和底色取自 hansen_diamond_shop.js；另加白/黑极值是因为 canvas 里有白云、白字横幅、深色剪影 */
  imax('clouddream', '云朵梦境工厂', '☁️', 'cloud', ['#8A87D8', '#F3C8E0', '#9D96DD', '#FFFFFF', '#3A2F7A']);
  imax('rainbowsweet', '彩虹甜心岛', '🍦', 'sakura', ['#63C4F5', '#FFD9EC', '#7FCDF5', '#FFFFFF', '#2B6B9A']);
  imax('zombiedance', '僵尸舞王', '🧟', 'violet', ['#1A1140', '#0C2A26', '#140E33', '#FF963C', '#50E6AA', '#FFFFFF']);
  imax('fireworks', '焰火盛典', '🎆', 'violet', ['#3D2A8F', '#FF6B9D', '#FFB450', '#FFFFFF', '#120A33']);
  imax('candyland', '糖果乐园', '🍭', 'sakura', ['#7EC8FF', '#FFB3D1', '#9FD6FF', '#FFFFFF', '#2A5E8F']);
  imax('balloon', '云端气球', '🎈', 'cloud', ['#41B8F5', '#FFE680', '#5CC3F7', '#FFFFFF', '#1F5F8B']);
  imax('lagoon', '七彩珊瑚湾', '🐠', 'mint', ['#27B6DD', '#FFD54F', '#1BA3D4', '#FFFFFF', '#0A5EA0']);
  imax('spacepark', '星际乐园', '🚀', 'cosmos', ['#311B92', '#4DD0E1', '#2A2A9E', '#FFFFFF', '#0A0A33']);
  /* 钻石 · 画廊 18 款（手绘照片 + 暗色遮罩；粒子改静态） */
  function gallery(id, name, emoji, base, c1, c2) {
    T({ id: 'gallery_' + id, name: name, emoji: emoji, family: 'gallery', base: base, legacy: { diamond: 'theme_photo_' + id },
      scene: { kind: 'photo', id: 'theme_photo_' + id, img: 'themes/photo_' + id + '.jpg', thumb: 'themes/thumb_' + id + '.jpg', samples: [c1, c2, '#FFFFFF'] } });
  }
  gallery('cloudhug', '云端拥抱中转站', '☁️', 'violet', '#131321', '#664D56');
  gallery('horsespa', '千骏SPA', '🐴', 'cosmos', '#222F41', '#161315');
  gallery('beastworld', '幻兽世界', '🦄', 'cosmos', '#1F2442', '#141D2E');
  gallery('balloonbay', '彩虹热气球港湾', '🎈', 'violet', '#596089', '#B99394');
  gallery('starcollect', '星光收集工坊', '✨', 'violet', '#262235', '#513736');
  gallery('flyingisle', '星光飞行岛', '🛸', 'cosmos', '#121C3D', '#644E6B');
  gallery('storybook', '星夜故事书屋', '📖', 'violet', '#434960', '#2D263A');
  gallery('stardustfarm', '星尘培育元', '🌱', 'woods', '#9C6F3F', '#644B47');
  gallery('memoryrepair', '星尘记忆修复馆', '🔮', 'violet', '#080B18', '#2E2014');
  gallery('jamhouse', '星露果酱暖房', '🍓', 'lantern', '#9E8E8A', '#846351');
  gallery('dessertshop', '星露点心坊', '🍰', 'violet', '#292645', '#5B4E43');
  gallery('fairytown', '星露童话镇', '🏰', 'cosmos', '#060C22', '#674140');
  gallery('goodnight', '晚安旋律', '🌙', 'cosmos', '#0E0E29', '#2A2742');
  gallery('dreamcleanse', '梦境净化', '💧', 'aurora', '#373E4B', '#62585A');
  gallery('carworkshop', '汽车工坊', '🚗', 'cosmos', '#403A4A', '#82685F');
  gallery('honeyshop', '蜂蜜加工小作坊', '🍯', 'lantern', '#764114', '#6B451F');
  gallery('sunweave', '阳光编织工坊', '🧶', 'violet', '#807682', '#5B4F4D');
  gallery('magicschool', '魔法学校', '🪄', 'cosmos', '#05102B', '#20223A');
  /* 打Boss 舞台（键 hansen_boss_theme）：深空=cosmos 角色、晨曦=boss_light 角色、电影场景=当前装备的钻石场景 */
  T({ id: 'boss_dark', name: '打Boss·深空', emoji: '🌌', family: 'boss', base: 'cosmos', alias: 'cosmos', legacy: { boss: 'dark' },
    over: { bg_1: '#141C3C', bg_2: '#1B2750', bg_3: '#243769' } });
  T({ id: 'boss_light', name: '打Boss·晨曦', emoji: '🌤️', family: 'boss', base: 'boss_light', legacy: { boss: 'light' } });

  var BY_ID = {};
  THEMES.forEach(function (t) { BY_ID[t.id] = t; t.mode = BASE_MODE[t.base]; });

  /* ================= 老 id → 2.0（只读映射） ================= */
  var LEGACY = {
    /* 整体配色 hansen_palette_global：同名 */
    palette: { cosmos: 'cosmos', violet: 'violet', aurora: 'aurora', woods: 'woods', cloud: 'cloud', sakura: 'sakura', cream: 'cream', mint: 'mint' },
    /* 金币主题 theme：星空夜就是默认深空蓝 */
    coin: { cosmos: 'cosmos', pink: 'coin_pink', ocean: 'coin_ocean', forest: 'coin_forest', rainbow: 'coin_rainbow', peach: 'coin_peach' },
    coinFree: ['cosmos', 'pink'],
    /* 钻石商店已下架老 id（与 hansen_diamond_shop.js 的 LEGACY_ITEM_MAP 一致，测试会对比） */
    diamondRetired: { theme_storm: 'theme_fireworks', theme_meteor: 'theme_candyland', theme_sakurastorm: 'theme_balloon', theme_abyss: 'theme_lagoon', theme_goldenage: 'theme_spacepark' },
    diamond: {},
    /* 打Boss：没选过 → 跟随全局明暗（与 v1010 行为一致） */
    boss: { dark: 'boss_dark', light: 'boss_light', cinema: 'cinema' },
    /* 拼写蜂 hansen_sb_theme：映射到同感觉的免费配色；没选过 → 跟随全局（2.0 起） */
    spellingBee: { sunny: 'cream', sky: 'cloud', sakura: 'sakura', mint: 'mint', dusk: 'violet', night: 'cosmos' },
    /* 卡册 Boss 底色 hansen_card_bg：底色本身保留为画面，卡上文字用映射主题的角色；trans=跟随当前主题 */
    cardBg: { dark: 'cosmos', white: 'cloud', navy: 'cosmos', sky: 'cloud', sunset: 'cream', purple: 'violet', pink: 'sakura', mint: 'mint', trans: null },
    /* Boss 殿堂卡面背景（页内下标 0..12，0=本命场景=跟随当前主题） */
    bossHallBg: [null, 'violet', 'cosmos', 'lantern', 'aurora', 'violet', 'cosmos', 'lantern', 'cloud', 'woods', 'violet', 'lantern', 'aurora']
  };
  THEMES.forEach(function (t) { if (t.legacy && t.legacy.diamond) LEGACY.diamond[t.legacy.diamond] = t.id; });

  /* ================= 合并后的完整角色表 ================= */
  function roles(id) {
    var t = BY_ID[id]; if (!t) return null;
    var out = mix(BASES[t.base], t.over || {});
    return out;
  }

  /* ================= 季节窗口 ================= */
  /* 春节日期（农历每年不同，先写到 2035，过期后测试会提醒补） */
  var CNY = { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08' };
  function ymd(y, md) { var p = md.split('-'); return new Date(y, +p[0] - 1, +p[1]); }
  function dayDiff(a, b) { return Math.round((a - b) / 86400000); }
  /* 在不在窗口里：春节前 21 天到元宵（+15）；冬天 12/1–2 月底；六一前后 5/25–6/7 */
  function inSeason(season, d) {
    d = d ? new Date(d) : new Date(); var y = d.getFullYear(), m = d.getMonth() + 1, day0 = new Date(y, d.getMonth(), d.getDate());
    if (season === 'cny') {
      for (var yy = y - 1; yy <= y + 1; yy++) { if (!CNY[yy]) continue; var diff = dayDiff(day0, ymd(yy, CNY[yy])); if (diff >= -21 && diff <= 15) return true; }
      return false;
    }
    if (season === 'winter') return m === 12 || m === 1 || m === 2;
    if (season === 'kidsday') return (m === 5 && d.getDate() >= 25) || (m === 6 && d.getDate() <= 7);
    return false;
  }
  function seasonal(d) { return THEMES.filter(function (t) { return t.family === 'season' && inSeason(t.season, d); }).map(function (t) { return t.id; }); }

  /* ================= 读老存档 → 现在该显示哪个主题 ================= */
  var KEYS = { palette: 'hansen_palette_global', coin: 'theme', coinUnlocked: 'hansen_unlocked_themes', diamond: 'hansen_diamond_shop',
               boss: 'hansen_boss_theme', spellingBee: 'hansen_sb_theme', cardBg: 'hansen_card_bg', seasonPick: 'hansen_theme2_season_pick' };
  function safeGet(store, k) { try { return store ? store.getItem(k) : null; } catch (e) { return null; } }
  function defaultStore() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } }
  function readDiamond(store) {
    var raw = safeGet(store, KEYS.diamond); if (!raw) return null;
    try {
      var o = JSON.parse(raw); if (!o || typeof o !== 'object' || typeof o.equipped !== 'string') return null;
      var eq = LEGACY.diamondRetired[o.equipped] || o.equipped;
      var owned = o.owned && typeof o.owned === 'object' ? o.owned : {};
      /* 只认真买过的（和商店的读法一致：已下架老 id 的购买记录同样算数） */
      var paid = owned[eq] === true || Object.keys(LEGACY.diamondRetired).some(function (k) { return LEGACY.diamondRetired[k] === eq && owned[k] === true; });
      return paid && LEGACY.diamond[eq] ? LEGACY.diamond[eq] : null;
    } catch (e) { return null; }
  }
  function readCoin(store) {
    var c = safeGet(store, KEYS.coin); if (!c || !LEGACY.coin[c]) return 'cosmos';
    if (LEGACY.coinFree.indexOf(c) >= 0) return c;
    try { var arr = JSON.parse(safeGet(store, KEYS.coinUnlocked) || '[]'); if (Array.isArray(arr) && arr.indexOf(c) >= 0) return c; } catch (e) {}
    return 'cosmos'; /* 没付钱的不显示（与 hansen_theme_lock 一致） */
  }
  function readPalette(store) { var p = safeGet(store, KEYS.palette); return LEGACY.palette[p] ? p : 'cosmos'; }
  function readSeasonPick(store, palette, coin) {
    var raw = safeGet(store, KEYS.seasonPick); if (!raw) return null;
    try {
      var o = JSON.parse(raw); if (!o || !BY_ID[o.id] || BY_ID[o.id].family !== 'season') return null;
      /* 选季节主题之后又在老设置里换了配色/金币主题 → 以后来的为准，季节选择自动失效 */
      if (o.palette !== palette || o.coin !== coin) return null;
      return o.id;
    } catch (e) { return null; }
  }
  /* 优先级（与现在画面一致）：钻石场景 > 季节选择 > 非默认配色 > 已买的金币主题 > 深空蓝 */
  function resolve(store) {
    store = store === undefined ? defaultStore() : store;
    var palette = readPalette(store), coin = readCoin(store), id, source;
    var dia = readDiamond(store), pick = readSeasonPick(store, palette, coin);
    if (dia) { id = dia; source = 'diamond'; }
    else if (pick) { id = pick; source = 'season'; }
    else if (palette !== 'cosmos') { id = LEGACY.palette[palette]; source = 'palette'; }
    else if (coin !== 'cosmos') { id = LEGACY.coin[coin]; source = 'coin'; }
    else { id = 'cosmos'; source = 'default'; }
    var t = BY_ID[id];
    return { id: id, base: t.base, mode: t.mode, family: t.family, scene: t.scene ? t.scene.id : null, source: source, palette: palette, coin: coin };
  }
  /* 打Boss 舞台该用哪个 */
  function bossStage(store, global) {
    store = store === undefined ? defaultStore() : store; global = global || resolve(store);
    var v = safeGet(store, KEYS.boss);
    if (v === 'dark') return 'boss_dark';
    if (v === 'light') return 'boss_light';
    if (v === 'cinema') return global.family === 'imax' ? global.id : 'boss_dark';
    return global.mode === 'light' ? 'boss_light' : 'boss_dark';
  }
  /* 拼写蜂：选过就用映射；没选过跟随全局（注：老页面没选过时默认 sky，这是 2.0 的有意改变，见 INTEGRATION） */
  function spellingBee(store, global) {
    store = store === undefined ? defaultStore() : store;
    var v = safeGet(store, KEYS.spellingBee);
    if (v && LEGACY.spellingBee[v]) return LEGACY.spellingBee[v];
    return (global || resolve(store)).id;
  }
  function cardBg(id, global) { var m = LEGACY.cardBg.hasOwnProperty(id) ? LEGACY.cardBg[id] : null; return m || (global || resolve()).id; }
  function bossHallBg(i, global) { var m = LEGACY.bossHallBg[i]; return m || (global || resolve()).id; }
  /* 孩子在新主题页选了季节主题：记下当时的配色/金币主题，以后老设置一改就自动失效 */
  function pickSeason(id, store) {
    store = store === undefined ? defaultStore() : store;
    if (!BY_ID[id] || BY_ID[id].family !== 'season' || !store) return false;
    try {
      var v = JSON.stringify({ id: id, palette: readPalette(store), coin: readCoin(store), at: Date.now() });
      store.setItem(KEYS.seasonPick, v); return store.getItem(KEYS.seasonPick) === v;
    } catch (e) { return false; }
  }
  function clearSeason(store) { store = store === undefined ? defaultStore() : store; try { store.removeItem(KEYS.seasonPick); return true; } catch (e) { return false; } }

  /* ================= 写到 <html> 上（只写 data-t2-*，不碰老类名） ================= */
  var applied = null, wired = false;
  function apply(doc, store) {
    doc = doc || (typeof document !== 'undefined' ? document : null); if (!doc || !doc.documentElement) return null;
    var r = resolve(store), h = doc.documentElement;
    if (h.getAttribute('data-t2-theme') !== r.id) h.setAttribute('data-t2-theme', r.id);
    if (h.getAttribute('data-t2-base') !== r.base) h.setAttribute('data-t2-base', r.base);
    if (h.getAttribute('data-t2-mode') !== r.mode) h.setAttribute('data-t2-mode', r.mode);
    if (r.scene) { if (h.getAttribute('data-t2-scene') !== r.scene) h.setAttribute('data-t2-scene', r.scene); } else if (h.hasAttribute('data-t2-scene')) h.removeAttribute('data-t2-scene');
    var changed = !applied || applied.id !== r.id;
    applied = r;
    if (changed && typeof CustomEvent === 'function' && typeof window !== 'undefined') {
      try { window.dispatchEvent(new CustomEvent('hansen:theme2', { detail: r })); } catch (e) {}
    }
    return r;
  }
  /* 只靠事件重算，不轮询（TV-08：老代码每 1.5 秒轮询一次） */
  function wire() {
    if (wired || typeof window === 'undefined' || !window.addEventListener) return; wired = true;
    function again() { apply(); }
    window.addEventListener('storage', function (e) { if (!e || !e.key || /^(hansen_palette_global|theme|hansen_unlocked_themes|hansen_diamond_shop|hansen_theme2_season_pick)$/.test(e.key)) again(); });
    window.addEventListener('pageshow', again);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', function () { if (!document.hidden) again(); });
  }

  var api = {
    ROLES: ROLES, ROLE_KEYS: ROLE_KEYS, BASES: BASES, BASE_MODE: BASE_MODE, THEMES: THEMES, LEGACY: LEGACY, KEYS: KEYS,
    FEATURE: FEATURE, HERO: HERO, FONTS: FONTS, FONT_FILES: FONT_FILES, TYPE: TYPE, SPACE: SPACE, RADIUS: RADIUS,
    MOTION: MOTION, EASE: EASE, Z: Z, ELEVATION: ELEVATION, CNY: CNY,
    get: function (id) { return BY_ID[id] || null; }, roles: roles, ids: function () { return THEMES.map(function (t) { return t.id; }); },
    resolve: resolve, apply: apply, wire: wire, bossStage: bossStage, spellingBee: spellingBee, cardBg: cardBg, bossHallBg: bossHallBg,
    inSeason: inSeason, seasonal: seasonal, pickSeason: pickSeason, clearSeason: clearSeason,
    color: { parse: parse, lum: lum, over: over, ratio: ratio, hex: hex, deltaE: deltaE },
    current: function () { return applied; }
  };
  /* 浏览器里：同步写属性 + 挂事件（放 <head> 里同步加载 → 首帧前就对，不闪） */
  if (typeof document !== 'undefined' && document.documentElement) { try { apply(); wire(); } catch (e) {} }
  return api;
});
