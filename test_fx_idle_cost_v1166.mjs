// 主题 2.0 庆祝引擎：性能测试（不联网、约 2 分钟）
// 方法与主题审查报告完全相同：CDP 把 CPU 降速 4 倍，看触发后 3 秒内主线程忙了百分之多少。
// 用老师看过的三张样稿页（答对 / 结算 / 开宝箱）原样跑，只把样稿的 fx.js 换成 hansen_fx：
//   ① 每个时刻 3 次取中位数，必须 ≤ 报告里样稿的数字（答对 9.6%、结算 20.7%、开宝箱 25.1%）
//   ② 同一台机器上再跑一次样稿自己的 fx.js 作对照（只记录，不判）
//   ③ 播完以后：0 个运行中的动画、图层删掉
//   ④ 什么都不做的 5 秒：主线程忙 ≤ 0.3%（报告里样稿 0–0.3%），0 次 rAF
import path from 'node:path';
import { ROOT, findOne, serve, browser, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';
import fs from 'node:fs';

const t = scorer('主题 2.0 庆祝引擎·性能');
const FX = findOne(/^hansen_fx_v\d{4}\.js$/), ICONS = findOne(/^hansen_theme2_icons_v\d{4}\.js$/);
const DIR = '/攻坚笔记/next_inputs/theme_mockups/';
const LIMIT = { answer: 9.6, result: 20.7, chest: 25.1 }, IDLE_LIMIT = 0.3;
const CASES = [['answer', 'answer.html', '?theme=cosmos&s=q', "answer('right')"], ['result', 'result.html', '?theme=cosmos', 'replay()'], ['chest', 'chest.html', '?theme=cosmos', 'openChest()']];
const pages = {};
for (const [k, f] of CASES) {
  const html = fs.readFileSync(path.join(ROOT, DIR, f), 'utf8');
  if (!html.includes('<script src="fx.js"></script>')) throw new Error(f + ' 里找不到 fx.js');
  pages[DIR + 't2_' + f] = html.replace('<script src="fx.js"></script>', `<script src="/${ICONS}"></script><script src="/${FX}"></script><script>window.FX=window.HansenFX;</script>`);
}
const srv = await serve(pages);
const br = await browser();
const metric = async cdp => { const m = await cdp.send('Performance.getMetrics'); return Object.fromEntries(m.metrics.map(x => [x.name, x.value])); };
async function run(kind, file, qs, trig, engine) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^(?!http:\/\/127\.0\.0\.1)/, r => r.abort());
  await ctx.addInitScript(() => { const c = window.__c = { raf: 0 }; const raf = window.requestAnimationFrame; window.requestAnimationFrame = function () { c.raf++; return raf.apply(this, arguments); }; });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
  await pg.goto(srv.base + DIR + (engine === 'hansen' ? 't2_' : '') + file + qs, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(2500);
  const m0 = await metric(cdp); await pg.evaluate(trig); await pg.waitForTimeout(3000); const m1 = await metric(cdp);
  const busy = (m1.TaskDuration - m0.TaskDuration) / 3 * 100;
  await pg.waitForTimeout(1500);
  const after = await pg.evaluate(() => ({ running: document.getAnimations().filter(a => a.playState === 'running').length, all: document.getAnimations().length,
    layer: !!document.querySelector('.t2-fx-layer,.fx-layer'), raf: window.__c.raf }));
  let idle = null, idleRaf = null;
  if (engine === 'hansen') {
    const i0 = await metric(cdp); await pg.waitForTimeout(5000); const i1 = await metric(cdp);
    idle = (i1.TaskDuration - i0.TaskDuration) / 5 * 100; idleRaf = (await pg.evaluate(() => window.__c.raf)) - after.raf;
  }
  await ctx.close();
  return { busy: +busy.toFixed(1), ...after, idle: idle == null ? null : +idle.toFixed(2), idleRaf, errs };
}
const med = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
const out = {};
try {
  for (let round = 0; round < 3; round++) for (const [k, f, qs, trig] of CASES) {
    const r = await run(k, f, qs, trig, 'hansen'); (out[k] = out[k] || { hansen: [], mock: [] }).hansen.push(r);
    if (round === 0) out[k].mock.push(await run(k, f, qs, trig, 'mock'));
    console.log(`  · 第 ${round + 1} 轮 ${k}: hansen_fx ${r.busy}%` + (round === 0 ? `（同机样稿 fx.js ${out[k].mock[0].busy}%）` : '') + ` 空闲 ${r.idle}%`);
  }
} finally {
  await br.close().catch(() => {}); await srv.close();
}
for (const [k] of CASES) {
  const H = out[k].hansen, m = med(H.map(x => x.busy));
  t.ok(m <= LIMIT[k], `${k}：触发后 3 秒主线程忙 ${m}%（中位数）≤ 样稿报告 ${LIMIT[k]}%；同机样稿 fx.js ${out[k].mock[0].busy}%`, H.map(x => x.busy));
  t.ok(H.every(x => x.running === 0 && x.all === 0 && !x.layer), `${k}：播完 4.5 秒后 0 个动画、图层已删`, H.map(x => [x.running, x.all, x.layer]));
  const idle = med(H.map(x => x.idle));
  t.ok(idle <= IDLE_LIMIT && H.every(x => x.idleRaf === 0), `${k}：之后什么都不做的 5 秒，主线程忙 ${idle}% ≤ ${IDLE_LIMIT}%，0 次 rAF`, H.map(x => [x.idle, x.idleRaf]));
  t.ok(H.every(x => x.errs.length === 0), `${k}：0 报错`, H.flatMap(x => x.errs).slice(0, 2));
}
const failed = t.done();
process.exit(failed ? 1 : 0);
