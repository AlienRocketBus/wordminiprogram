// 主题 2.0 样张逐像素对比度（不联网、约 1 分钟）
// 把 theme2_base.css 的全部组件放在一页上，44 个主题各渲染一次（画廊带真照片、IMAX 带真 canvas 静帧），
// 去掉文字截图 → 拿每段文字底下真实像素的中位数做背景 → 正文 ≥4.5、大字 ≥3。
// 门禁算的是“设计值”，这里证明“组件真的用对了角色”。
// 设 T2_SHOTS=<目录> 会顺便保存截图（默认不写文件）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ROOT, findOne, serve, browser, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';
import { specimenHTML, COLLECT, HIDE_CSS, MEASURE } from './攻坚笔记/theme2/tools/specimen.mjs';

const t = scorer('主题 2.0 样张逐像素对比度');
const REG = findOne(/^hansen_theme2_registry_v\d{4}\.js$/), ICONS = findOne(/^hansen_theme2_icons_v\d{4}\.js$/), FONTS = findOne(/^hansen_theme2_fonts_v\d{4}\.js$/);
const R = createRequire(import.meta.url)(path.join(ROOT, REG));
const pages = {};
for (const th of R.THEMES) {
  const sc = th.scene && th.scene.kind !== 'svg' ? th.scene : null;
  let html = specimenHTML({ registry: REG, icons: ICONS, fonts: FONTS, theme: th.id, base: th.base, mode: th.mode, scene: sc && sc.id, sceneKind: sc && sc.kind });
  if (sc && sc.kind === 'canvas') html = html.replace('</body>', `<script src="/hansen_cinema_themes.js"></script><script>HansenCinema.apply(${JSON.stringify(sc.id)})</script></body>`);
  pages[`/__t2/sp_${th.id}.html`] = html;
}
// 自证页：故意放一段“卡片色的字”（看不见），测量必须抓到它
pages['/__t2/sp_selfcheck.html'] = pages['/__t2/sp_cosmos.html'].replace('<div class="t2-word">fish</div>', '<div class="t2-word">fish</div><span id="bad" style="color:var(--t2-surface-2)">看不见的字</span>')
  .replace('<span class="t2-plate">打字大师</span>', '<span class="t2-plate" style="background:transparent">没底板的标签</span>');
const shots = process.env.T2_SHOTS ? path.resolve(process.env.T2_SHOTS) : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const srv = await serve(pages);
const br = await browser();
let total = 0, worstAll = 99, worstWhere = '';
try {
  // reducedMotion：IMAX canvas 只画一帧静图（两次截图之间不会变）
  const ctx = await br.newContext({ viewport: { width: 390, height: 1500 }, deviceScaleFactor: 1, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, r => r.abort());
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  for (const th of R.THEMES) {
    await pg.goto(`${srv.base}/__t2/sp_${th.id}.html`, { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(th.scene && th.scene.kind === 'canvas' ? 500 : 60);
    if (shots && ['cosmos', 'cloud', 'lantern', 'snow', 'kidsday', 'coin_peach', 'imax_candyland', 'gallery_fairytown'].includes(th.id)) await pg.screenshot({ path: path.join(shots, `specimen_${th.id}.png`) });
    const els = await pg.evaluate(COLLECT);
    const hide = await pg.addStyleTag({ content: HIDE_CSS });
    const png = (await pg.screenshot()).toString('base64');
    await hide.evaluate(n => n.remove());
    const res = await pg.evaluate(MEASURE, { png, els });
    total += res.length;
    const bad = res.filter(r => r.ratio < r.need);
    const mn = Math.min(...res.map(r => r.ratio / r.need));
    if (mn < worstAll) { worstAll = mn; const w = res.find(r => r.ratio / r.need === mn); worstWhere = `${th.id}「${w.text}」${w.ratio}`; }
    t.ok(res.length >= 40 && bad.length === 0, `${th.id}：${res.length} 段文字全部达标（最低 ${Math.min(...res.map(r => r.ratio))}）`, bad.slice(0, 5));
  }
  {
    await pg.goto(`${srv.base}/__t2/sp_selfcheck.html`, { waitUntil: 'load' }); await pg.evaluate(() => document.fonts.ready);
    const els = await pg.evaluate(COLLECT); const hide = await pg.addStyleTag({ content: HIDE_CSS });
    const png = (await pg.screenshot()).toString('base64'); await hide.evaluate(n => n.remove());
    const res = await pg.evaluate(MEASURE, { png, els });
    const caught = res.filter(r => r.ratio < r.need).map(r => r.text);
    t.ok(caught.includes('看不见的字') && caught.includes('没底板的标签') && caught.length === 2, '自证：故意放的两段看不清的字被抓到、其它没有误报', caught);
  }
  t.ok(errs.length === 0, '44 页 0 报错', errs.slice(0, 3));
  await ctx.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
console.log(`  共测 ${total} 段文字；离门槛最近的一段：${worstWhere}（= 门槛的 ${worstAll.toFixed(2)} 倍）`);
const failed = t.done();
process.exit(failed ? 1 : 0);
