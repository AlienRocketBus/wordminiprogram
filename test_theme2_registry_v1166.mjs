// 主题 2.0 registry 测试（不联网、确定性、约 10 秒）
//  ① 老主题一个不漏：直接读 hansen_palette / theme_shop / theme_lock / diamond_shop / boss_theme /
//     spelling_bee / cards / boss_hall 的源码，和 registry 的映射逐个对比（以后谁加了主题忘了映射，这里就红）
//  ② 读老存档 → 显示哪个主题：和现在画面的优先级一致；没付钱的不显示；坏数据不崩；绝不写老键
//  ③ 季节窗口
//  ④ 真浏览器：同步脚本在首帧前写好 data-t2-*；除此之外 DOM、存档、定时器全都不动；换配色后靠事件刷新
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, findOne, serve, browser, phone, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';

const t = scorer('主题 2.0 registry');
const REG = findOne(/^hansen_theme2_registry_v\d{4}\.js$/);
const R = createRequire(import.meta.url)(path.join(ROOT, REG));
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const setEq = (a, b) => { const A = [...new Set(a)].sort(), B = [...new Set(b)].sort(); return A.length === B.length && A.every((x, i) => x === B[i]); };

console.log('① 老主题一个不漏（对源码）');
const pal = [...src('hansen_palette.js').matchAll(/\{id:'([a-z]+)', name:'/g)].map(m => m[1]);
t.ok(pal.length === 8 && setEq(pal, Object.keys(R.LEGACY.palette)), '整体配色 8 个 = hansen_palette.js', pal);
const shop = src('hansen_theme_shop.js'), lock = src('hansen_theme_lock.js');
const shopNames = Object.keys(Function('return ' + /var THEME_NAME = (\{[\s\S]*?\});/.exec(shop)[1])());
const lockOrder = Function('return ' + /var THEME_ORDER = (\[[^\]]*\]);/.exec(lock)[1])();
const shopFree = Function('return ' + /var FREE_THEMES = (\[[^\]]*\]);/.exec(shop)[1])();
t.ok(setEq(shopNames, Object.keys(R.LEGACY.coin)) && setEq(lockOrder, Object.keys(R.LEGACY.coin)), '金币主题 6 个 = theme_shop / theme_lock', shopNames);
t.ok(setEq(shopFree, R.LEGACY.coinFree), '免费金币主题与商店一致（没付钱的不会被显示出来）', shopFree);
const dia = src('hansen_diamond_shop.js');
const items = [...dia.matchAll(/\{id:'(theme_[a-z_]+)',\s*type:'theme',\s*series:'(imax|gallery)'/g)].map(m => ({ id: m[1], series: m[2] }));
t.ok(items.length === 26 && setEq(items.map(i => i.id), Object.keys(R.LEGACY.diamond)), '钻石主题 26 个（IMAX 8 + 画廊 18）= diamond_shop', items.length);
t.ok(items.every(i => R.get(R.LEGACY.diamond[i.id]).family === i.series), '每个钻石主题归到对的系列');
const retired = Function('return ' + /var LEGACY_ITEM_MAP=(\{[^}]*\});/.exec(dia)[1])();
t.ok(JSON.stringify(retired) === JSON.stringify(R.LEGACY.diamondRetired), '已下架老钻石 id 的映射与商店完全一致（老购买记录照样算数）');
const missingArt = R.THEMES.filter(x => x.scene && x.scene.img).flatMap(x => [x.scene.img, x.scene.thumb]).filter(f => !fs.existsSync(path.join(ROOT, f)));
t.ok(missingArt.length === 0, '画廊 18 张场景图和缩略图都在仓库里', missingArt);
const boss = [...src('hansen_boss_theme.js').matchAll(/\{ id: '([a-z]+)',\s+name:/g)].map(m => m[1]);
t.ok(setEq(boss, Object.keys(R.LEGACY.boss)), '打Boss 主题 3 个 = hansen_boss_theme.js', boss);
const sb = [...src('spelling_bee.html').matchAll(/data-sbtheme="([a-z]+)"/g)].map(m => m[1]);
t.ok(sb.length === 6 && setEq(sb, Object.keys(R.LEGACY.spellingBee)), '拼写蜂主题 6 个 = spelling_bee.html', sb);
const cb = [...src('hansen_cards.js').matchAll(/\{id:'([a-z]+)',\s+emoji:/g)].map(m => m[1]);
t.ok(cb.length === 9 && setEq(cb, Object.keys(R.LEGACY.cardBg)), '卡册 Boss 底色 9 个 = hansen_cards.js', cb);
const hallBlock = /var BGS=\[([\s\S]*?)\n\];/.exec(src('boss_hall.html'))[1];
const hall = [...hallBlock.matchAll(/\{n:'/g)].length;
t.ok(hall === 13 && R.LEGACY.bossHallBg.length === 13 && R.LEGACY.bossHallBg[0] === null, 'Boss 殿堂卡面背景 13 个（第 0 个本命场景跟随主题）', hall);
const targets = [].concat(Object.values(R.LEGACY.palette), Object.values(R.LEGACY.coin), Object.values(R.LEGACY.diamond), Object.values(R.LEGACY.spellingBee),
  Object.values(R.LEGACY.cardBg), R.LEGACY.bossHallBg, ['boss_dark', 'boss_light']).filter(Boolean);
t.ok(targets.every(id => R.get(id)), '所有映射目标都是真实存在的 2.0 主题', targets.filter(id => !R.get(id)));
const modeOf = id => R.get(id).mode;
t.ok(['imax_clouddream', 'imax_rainbowsweet', 'imax_candyland', 'imax_balloon', 'imax_lagoon'].every(id => modeOf(id) === 'light') &&
  ['imax_zombiedance', 'imax_fireworks', 'imax_spacepark'].every(id => modeOf(id) === 'dark'), 'IMAX 亮/暗声明与主题审查报告一致（亮场景配亮色角色，TV-03）');
t.ok(['coin_pink', 'coin_forest', 'coin_peach'].every(id => modeOf(id) === 'light') && ['coin_ocean', 'coin_rainbow'].every(id => modeOf(id) === 'dark'),
  '金币主题明暗统一（首页和岛内不再一亮一暗，TV-02）');
t.ok(R.THEMES.filter(x => x.family === 'gallery').every(x => x.mode === 'dark'), '画廊 18 款都是暗色角色 + 遮罩');

console.log('② 读老存档 → 显示哪个主题');
function store(init = {}, opts = {}) {
  const m = new Map(Object.entries(init)), writes = [];
  return { writes, getItem: k => { if (opts.throws) throw new Error('blocked'); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { writes.push(k); m.set(k, String(v)); }, removeItem: k => { writes.push('-' + k); m.delete(k); } };
}
const dshop = (equipped, owned) => JSON.stringify({ owned, equipped });
const cases = [
  ['什么都没选 → 深空蓝', {}, 'cosmos', 'default'],
  ['选了云端白', { hansen_palette_global: 'cloud' }, 'cloud', 'palette'],
  ['免费金币主题樱花粉', { theme: 'pink' }, 'coin_pink', 'coin'],
  ['没买的海洋蓝 → 不显示', { theme: 'ocean' }, 'cosmos', 'default'],
  ['买过的海洋蓝', { theme: 'ocean', hansen_unlocked_themes: '["ocean"]' }, 'coin_ocean', 'coin'],
  ['解锁记录坏了 → 不显示', { theme: 'peach', hansen_unlocked_themes: '{oops' }, 'cosmos', 'default'],
  ['非默认配色压过金币主题（与现在一致）', { hansen_palette_global: 'violet', theme: 'pink' }, 'violet', 'palette'],
  ['装备了买过的钻石主题 → 场景最优先', { hansen_palette_global: 'cloud', hansen_diamond_shop: dshop('theme_candyland', { theme_candyland: true }) }, 'imax_candyland', 'diamond'],
  ['装备了但没买 → 不显示', { hansen_diamond_shop: dshop('theme_candyland', {}) }, 'cosmos', 'default'],
  ['已下架老 id（theme_storm）买过 → 焰火盛典', { hansen_diamond_shop: dshop('theme_storm', { theme_storm: true }) }, 'imax_fireworks', 'diamond'],
  ['画廊主题', { hansen_diamond_shop: dshop('theme_photo_fairytown', { theme_photo_fairytown: true }) }, 'gallery_fairytown', 'diamond'],
  ['钻石存档坏了 → 不崩', { hansen_diamond_shop: '{"owned":' }, 'cosmos', 'default'],
  ['不认识的配色 id → 深空蓝', { hansen_palette_global: 'neon' }, 'cosmos', 'default'],
  ['选了新春灯笼', { hansen_theme2_season_pick: JSON.stringify({ id: 'lantern', palette: 'cosmos', coin: 'cosmos' }) }, 'lantern', 'season'],
  ['选了灯笼后又在老设置里换成薄荷绿 → 后来的为准', { hansen_palette_global: 'mint', hansen_theme2_season_pick: JSON.stringify({ id: 'lantern', palette: 'cosmos', coin: 'cosmos' }) }, 'mint', 'palette'],
  ['季节选择被篡改成非季节主题 → 不认', { hansen_theme2_season_pick: JSON.stringify({ id: 'imax_candyland', palette: 'cosmos', coin: 'cosmos' }) }, 'cosmos', 'default'],
];
for (const [name, init, want, source] of cases) {
  const s = store(init); const r = R.resolve(s);
  t.ok(r.id === want && r.source === source && s.writes.length === 0, name + ` → ${want}（且没写任何存档）`, { got: r.id, source: r.source, writes: s.writes });
}
t.ok(R.resolve(store({}, { throws: true })).id === 'cosmos', '存储被浏览器禁用（隐私模式）→ 不崩，深空蓝');
t.ok(R.resolve(null).id === 'cosmos', '没有存储对象 → 深空蓝');
const g = R.resolve(store({ hansen_palette_global: 'sakura' }));
t.ok(R.bossStage(store({ hansen_palette_global: 'sakura' }), g) === 'boss_light', '打Boss 没选过 → 跟随全局（亮色配色 → 晨曦）');
t.ok(R.bossStage(store({ hansen_boss_theme: 'dark', hansen_palette_global: 'sakura' })) === 'boss_dark', '打Boss 选了深空 → 深空');
const cin = store({ hansen_boss_theme: 'cinema', hansen_diamond_shop: dshop('theme_balloon', { theme_balloon: true }) });
t.ok(R.bossStage(cin) === 'imax_balloon', '打Boss 选了电影场景 → 当前装备的 IMAX');
t.ok(R.bossStage(store({ hansen_boss_theme: 'cinema' })) === 'boss_dark', '电影场景但没装备 IMAX → 深空（不会空白）');
t.ok(R.spellingBee(store({ hansen_sb_theme: 'sunny' })) === 'cream' && R.spellingBee(store({ hansen_sb_theme: 'night' })) === 'cosmos', '拼写蜂老选择照样生效（暖阳→奶油杏、暗夜→深空）');
t.ok(R.spellingBee(store({ hansen_palette_global: 'mint' })) === 'mint', '拼写蜂没选过 → 跟随全局');
t.ok(R.cardBg('trans', g) === 'sakura' && R.cardBg('purple') === 'violet' && R.bossHallBg(0, g) === 'sakura' && R.bossHallBg(8) === 'cloud', '卡册底色 / 殿堂卡面映射');
const ps = store({ hansen_palette_global: 'cloud' });
t.ok(R.pickSeason('snow', ps) && ps.writes.join() === 'hansen_theme2_season_pick' && R.resolve(ps).id === 'snow', '选季节主题只写一个新键 hansen_theme2_season_pick');
t.ok(!R.pickSeason('cloud', store()) && !R.pickSeason('nope', store()), '不是季节主题的不能当季节主题选');

console.log('③ 季节窗口');
t.ok(R.inSeason('cny', '2027-01-20T12:00:00') && R.inSeason('cny', '2027-02-21T12:00:00') && !R.inSeason('cny', '2027-03-01T12:00:00') && !R.inSeason('cny', '2026-12-20T12:00:00'), '新春：2027 春节(2/6) 前 21 天到元宵');
t.ok(R.inSeason('cny', '2028-01-10T12:00:00') && !R.inSeason('cny', '2028-02-15T12:00:00'), '新春：2028 春节(1/26) 窗口跟着农历走');
t.ok(R.inSeason('winter', '2026-12-05T12:00:00') && R.inSeason('winter', '2027-02-27T12:00:00') && !R.inSeason('winter', '2027-03-02T12:00:00'), '冬日雪国：12 月到 2 月');
t.ok(R.inSeason('kidsday', '2027-06-01T12:00:00') && R.inSeason('kidsday', '2027-05-25T12:00:00') && !R.inSeason('kidsday', '2027-06-08T12:00:00'), '六一派对：5/25–6/7');
const yrs = Object.keys(R.CNY).map(Number);
t.ok(Math.max(...yrs) >= 2035 && yrs.every((y, i) => i === 0 || y === yrs[i - 1] + 1), '春节日期表连续写到 2035');
t.ok(Math.max(...yrs) >= new Date().getFullYear() + 1, '春节日期表至少写到明年（快用完时这条会红，提醒补表）', Math.max(...yrs));
t.ok(JSON.stringify(R.seasonal('2027-02-01T12:00:00').sort()) === '["lantern","snow"]', '2027-02-01 同时可选：新春灯笼 + 冬日雪国');

console.log('④ 运行时代码风格（旧手机内核）');
const code = src(REG).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/'(?:\\.|[^'\\])*'/g, "''");
t.ok(!/=>|\blet\s|\bconst\s|`|\.\.\.|\bclass\s/.test(code), '只用 ES5 写法（没有箭头函数、let/const、模板字符串）');
t.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(code), '没有任何定时器 / 轮询');
t.ok(!/\?v=\d|\b1166\b/.test(src(REG)), '文件里没有版本号字面量（批量升版不会误改它）');

console.log('⑤ 真浏览器');
const pageA = `<!doctype html><html lang="zh-CN" class="hsn-pal-cloud keep"><head><meta charset="utf-8">
<script>window.__t2first=null;new MutationObserver(function(){}).observe(document.documentElement,{attributes:true});</script>
<script src="/${REG}"></script>
<script>window.__t2first=document.documentElement.getAttribute('data-t2-theme');</script>
<link rel="stylesheet" href="/theme2_tokens.css"></head><body data-theme="cosmos"><p id="p" style="color:var(--t2-ink-1)">你好</p></body></html>`;
const srv = await serve({ '/__t2/a.html': pageA });
const br = await browser();
try {
  const ctx = await phone(br, srv.base);
  await ctx.addInitScript(() => {
    localStorage.setItem('hansen_palette_global', 'cloud');
    const c = { st: 0, si: 0, raf: 0 }; window.__t2c = c;
    const st = window.setTimeout, si = window.setInterval, raf = window.requestAnimationFrame;
    window.setTimeout = function () { c.st++; return st.apply(this, arguments); };
    window.setInterval = function () { c.si++; return si.apply(this, arguments); };
    window.requestAnimationFrame = function () { c.raf++; return raf.apply(this, arguments); };
    const set = Storage.prototype.setItem; window.__t2w = [];
    Storage.prototype.setItem = function (k, v) { window.__t2w.push(k); return set.call(this, k, v); };
  });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(srv.base + '/__t2/a.html', { waitUntil: 'load' });
  const s1 = await pg.evaluate(() => ({ first: window.__t2first, cls: document.documentElement.className, body: document.body.getAttribute('data-theme'),
    attrs: [...document.documentElement.attributes].map(a => a.name).sort(), c: window.__t2c, w: window.__t2w.slice(), color: getComputedStyle(document.getElementById('p')).color }));
  t.ok(s1.first === 'cloud', '同步脚本：下一行代码执行时 data-t2-theme 已经写好（首帧前，不闪）', s1.first);
  t.ok(s1.cls === 'hsn-pal-cloud keep' && s1.body === 'cosmos', '老的类名、body[data-theme] 一点没动');
  t.ok(JSON.stringify(s1.attrs) === JSON.stringify(['class', 'data-t2-base', 'data-t2-mode', 'data-t2-theme', 'lang']), '<html> 只多了 data-t2-* 三个属性', s1.attrs);
  t.ok(s1.c.st === 0 && s1.c.si === 0 && s1.c.raf === 0, '加载后 0 个定时器、0 个 rAF（不轮询）', s1.c);
  t.ok(s1.w.filter(k => k !== 'hansen_palette_global').length === 0, '加载时没写任何存档', s1.w);
  t.ok(s1.color === 'rgb(20, 27, 52)', '云端白下 var(--t2-ink-1) = #141B34', s1.color);
  // 别的标签页改了配色 → storage 事件 → 立即跟上
  const s2 = await pg.evaluate(() => {
    let ev = null; window.addEventListener('hansen:theme2', e => { ev = e.detail.id; });
    localStorage.setItem('hansen_palette_global', 'woods');
    window.dispatchEvent(new StorageEvent('storage', { key: 'hansen_palette_global' }));
    return { theme: document.documentElement.getAttribute('data-t2-theme'), mode: document.documentElement.getAttribute('data-t2-mode'), ev };
  });
  t.ok(s2.theme === 'woods' && s2.mode === 'dark' && s2.ev === 'woods', '别处换了配色 → 收到事件立刻跟上，并发出 hansen:theme2 事件', s2);
  const s3 = await pg.evaluate(() => {
    localStorage.setItem('hansen_diamond_shop', JSON.stringify({ owned: { theme_photo_goodnight: true }, equipped: 'theme_photo_goodnight' }));
    window.dispatchEvent(new Event('pageshow'));
    return { theme: document.documentElement.getAttribute('data-t2-theme'), scene: document.documentElement.getAttribute('data-t2-scene') };
  });
  t.ok(s3.theme === 'gallery_goodnight' && s3.scene === 'theme_photo_goodnight', '返回页面（pageshow）时重新读存档：钻石场景生效并写 data-t2-scene', s3);
  t.ok(errs.length === 0, '页面 0 报错', errs);
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
const failed = t.done();
process.exit(failed ? 1 : 0);
