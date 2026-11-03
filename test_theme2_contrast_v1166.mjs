// 主题 2.0 对比度门禁测试（不联网、确定性、约 10 秒）
//  ① 全部 44 个主题 × 全部组合达标（正文 ≥4.5、大字/图标 ≥3），可选主题两两看得出不同
//  ② 每个承载文字/图标的角色都被门禁查到（没有漏网角色）
//  ③ 自证：故意弄坏颜色，门禁必须报红（不咬人的门禁比没有更危险）
//  ④ theme2_tokens.css 和 registry 完全一致（没人手改 CSS）
//  ⑤ 真浏览器里，每个主题的 CSS 变量取到的值 = registry 的值（层叠/优先级没出错）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, serve, browser, phone, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';
import { loadRegistry, buildCSS } from './攻坚笔记/theme2/tools/theme2_build.mjs';
import { runGate, pairsFor, NEED } from './攻坚笔记/theme2/tools/theme2_contrast.mjs';

const t = scorer('主题 2.0 对比度门禁');
const R = loadRegistry();

console.log('① 门禁本身');
const rep = runGate(R);
t.ok(rep.ok, `全部主题达标（${Object.keys(rep.themes).length} 个主题、${rep.pairs} 对）`, { fails: rep.fails, notDistinct: rep.notDistinct, bad: Object.entries(rep.themes).filter(([, v]) => v.fail).map(([k, v]) => [k, v.bad.map(b => `${b.fg}/${b.bg}=${b.ratio}`)]) });
t.ok(R.THEMES.length === 44, '主题数 = 44（8 配色 + 3 季节 + 5 金币 + 8 IMAX + 18 画廊 + 2 打Boss）', R.THEMES.length);
const fam = {}; R.THEMES.forEach(x => { fam[x.family] = (fam[x.family] || 0) + 1; });
t.ok(fam.palette === 8 && fam.season === 3 && fam.coin === 5 && fam.imax === 8 && fam.gallery === 18 && fam.boss === 2, '各类数量正确', fam);
t.ok(R.THEMES.every(x => x.mode === 'light' || x.mode === 'dark'), '每个主题都声明了亮/暗');
const minPairs = Math.min(...Object.values(rep.themes).map(v => v.pairs));
t.ok(minPairs >= 90, `每个主题至少查 90 对（最少 ${minPairs}）`);
const minText = Math.min(...Object.values(rep.themes).map(v => v.minText)), minIcon = Math.min(...Object.values(rep.themes).map(v => v.minIcon));
t.ok(minText >= NEED.text && minIcon >= NEED.icon, `最低文字 ${minText} ≥ 4.5、最低图标 ${minIcon} ≥ 3`);

console.log('② 没有漏网的角色');
for (const id of ['cosmos', 'cloud', 'imax_candyland', 'gallery_fairytown']) {
  const P = pairsFor(R, id), fgs = new Set(P.flatMap(p => String(p.fg).split('|'))), bgs = new Set(P.map(p => String(p.bg).split(/[∘+#]/)[0]));
  const inkRoles = R.ROLE_KEYS.filter(k => R.ROLES[k][0] === 'ink'), iconRoles = R.ROLE_KEYS.filter(k => R.ROLES[k][0] === 'icon');
  const surf = R.ROLE_KEYS.filter(k => R.ROLES[k][0] === 'surface');
  const missFg = inkRoles.concat(iconRoles).filter(k => !fgs.has(k));
  const missBg = surf.filter(k => !bgs.has(k) && !(R.get(id).scene && /^bg_/.test(k)));
  t.ok(missFg.length === 0, `${id}：每个文字/图标角色都当过前景`, missFg);
  t.ok(missBg.length === 0, `${id}：每个底色角色都当过背景`, missBg);
}

console.log('③ 自证：弄坏颜色，门禁必须报红');
function bites(name, mutate, expectTheme) {
  const X = loadRegistry(); mutate(X); const r = runGate(X);
  const hit = expectTheme ? (r.themes[expectTheme] && r.themes[expectTheme].fail > 0) || r.notDistinct.some(d => d.a === expectTheme || d.b === expectTheme) : !r.ok;
  t.ok(!r.ok && hit, '会咬人：' + name, { ok: r.ok, fails: r.fails });
}
bites('说明文字和卡片同色', X => { X.BASES.cosmos.ink_3 = X.BASES.cosmos.surface_1; }, 'cosmos');
bites('金色按钮又写回白字（TV-04 “再来一轮” 2.61）', X => { X.BASES.violet.on_accent = '#FFFFFF'; }, 'violet');
bites('标签底板太淡（TV-04 听音辨义 2.08）', X => { X.BASES.cloud.plate = 'rgba(20,16,48,0.10)'; }, 'cloud');
bites('场景遮罩太淡（TV-03 糖果乐园 1.02）', X => { X.BASES.sakura.scrim = 'rgba(255,255,255,0.15)'; }, 'imax_candyland');
bites('星云把顶部背景照亮（标题看不清）', X => { X.BASES.woods.neb_1 = 'rgba(255,255,255,0.9)'; }, 'woods');
bites('图标描边太浅（亮色下金币看不见）', X => { X.BASES.mint.coin_rim = '#FFE7A0'; }, 'mint');
bites('焦点框看不见', X => { X.BASES.snow.focus = '#E6F0FA'; }, 'snow');
bites('金币主题只改背景改得太少（TV-13 两个主题几乎一样）', X => {
  const c = X.THEMES.find(x => x.id === 'coin_peach'); c.over = { bg_1: X.BASES.cream.bg_1, bg_2: X.BASES.cream.bg_2, bg_3: X.BASES.cream.bg_3 };
}, 'coin_peach');

console.log('④ CSS 与 registry 一致');
const css = fs.readFileSync(path.join(ROOT, 'theme2_tokens.css'), 'utf8');
t.ok(css === buildCSS(R), 'theme2_tokens.css 是 registry 生成的最新版（没被手改）');
t.ok(!/Bowlby/i.test(css) && !/\bserif\b(?!-)/.test(css.replace(/sans-serif/g, '')), 'tokens 里没有 Bowlby One、没有 serif 兜底');
t.ok(!/@keyframes|animation\s*:/.test(css), 'tokens 里没有任何动画');

console.log('⑤ 真浏览器：每个主题取到的 CSS 变量 = registry');
const page = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/theme2_tokens.css"></head>
<body><div id="pv" data-t2-base="cloud">预览卡</div></body></html>`;
const srv = await serve({ '/__t2/vars.html': page });
const br = await browser();
try {
  const ctx = await phone(br, srv.base); const pg = await ctx.newPage();
  await pg.goto(srv.base + '/__t2/vars.html', { waitUntil: 'load' });
  const expected = Object.fromEntries(R.THEMES.map(x => [x.id, { base: x.base, mode: x.mode, roles: R.roles(x.id) }]));
  const got = await pg.evaluate(({ expected, keys }) => {
    const h = document.documentElement, out = {};
    for (const [id, e] of Object.entries(expected)) {
      h.setAttribute('data-t2-theme', id); h.setAttribute('data-t2-base', e.base); h.setAttribute('data-t2-mode', e.mode);
      const cs = getComputedStyle(h); out[id] = {};
      for (const k of keys) out[id][k] = cs.getPropertyValue('--t2-' + k.replace(/_/g, '-')).trim();
    }
    h.removeAttribute('data-t2-theme'); h.removeAttribute('data-t2-base'); h.removeAttribute('data-t2-mode');
    const d = getComputedStyle(h), pv = getComputedStyle(document.getElementById('pv'));
    out.__default = { ink_1: d.getPropertyValue('--t2-ink-1').trim(), bg_1: d.getPropertyValue('--t2-bg-1').trim(), fs9: d.getPropertyValue('--t2-fs-9').trim() };
    out.__preview = { ink_1: pv.getPropertyValue('--t2-ink-1').trim() };
    return out;
  }, { expected, keys: R.ROLE_KEYS });
  const same = (a, b) => { try { const p = R.color.parse(a), q = R.color.parse(b); return p.r === q.r && p.g === q.g && p.b === q.b && Math.abs(p.a - q.a) < 0.001; } catch (e) { return false; } };
  const wrong = [];
  for (const [id, e] of Object.entries(expected)) for (const k of R.ROLE_KEYS) if (!same(got[id][k], e.roles[k])) wrong.push(`${id}.${k}: css=${got[id][k]} reg=${e.roles[k]}`);
  t.ok(wrong.length === 0, `${R.THEMES.length} 个主题 × ${R.ROLE_KEYS.length} 个角色，浏览器取值全部一致`, wrong.slice(0, 8));
  t.ok(same(got.__default.ink_1, R.BASES.cosmos.ink_1) && same(got.__default.bg_1, R.BASES.cosmos.bg_1) && got.__default.fs9 === '44px', '没写属性时默认 = 深空蓝，字号 token 在');
  t.ok(same(got.__preview.ink_1, R.BASES.cloud.ink_1), '局部 data-t2-base 能在深色页面里显示亮色预览卡');
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
const failed = t.done();
process.exit(failed ? 1 : 0);
