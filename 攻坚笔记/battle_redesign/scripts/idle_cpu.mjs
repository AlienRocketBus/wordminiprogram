// 待机检查：① 所有状态（不冻结，计时数字照常每秒走）加载 2.5 秒后，document.getAnimations() 里还在跑的动画个数、rAF 次数；
// ② 代表性画面在 CPU 降速 4 倍下 8 秒内主线程忙碌百分比（CDP Performance.getMetrics TaskDuration 增量）。
import { createRequire } from 'node:module'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url); const { chromium } = require(process.env.HANSEN_PLAYWRIGHT_MODULE || 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url)), OUT = path.resolve(HERE, '..'); const sleep = ms => new Promise(r => setTimeout(r, ms));
const pf = path.join(OUT, 'metrics', '.port2'); try { fs.unlinkSync(pf); } catch {}
const srv = spawn(process.execPath, [path.join(HERE, 'server.mjs'), pf], { stdio: 'inherit' }); while (!fs.existsSync(pf)) await sleep(50);
const BASE = `http://127.0.0.1:${fs.readFileSync(pf, 'utf8')}/攻坚笔记/battle_redesign/mockups/`;
const states = JSON.parse(fs.readFileSync(path.join(OUT, 'metrics', 'states.json'))).map(s => s[0]);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = function (c) { window.__raf++; return r.call(window, c); }; window.__iv = 0; const si = setInterval; window.setInterval = function (f, ms) { window.__iv++; window.__ivms = ms; return si.call(window, f, ms); }; });
const res = { animations: {}, cpu: {} };
for (const theme of ['cosmos', 'cloud']) for (const k of states) {
  const pg = await ctx.newPage(); await pg.goto(`${BASE}screen.html?s=${k}&theme=${theme}`, { waitUntil: 'load' }); await sleep(2500);
  const r0 = await pg.evaluate(() => window.__raf); await sleep(1000);
  res.animations[`${k}_${theme}`] = await pg.evaluate(r0 => { const a = document.getAnimations(); return { running: a.filter(x => x.playState === 'running').length, total: a.length, infiniteCss: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).filter(r => /infinite/.test(r.cssText)).length, rafPerSec: window.__raf - r0, intervals: window.__iv, intervalMs: window.__ivms || null, fxLayer: !!document.querySelector('.fx-layer') }; }, r0);
  await pg.close();
}
const CPU = ['hub_island', 'ld_ranked', 'mt_search', 'mt_host', 'lb_rooms', 'ch_default', 'wt_private', 'jn_wait', 'bt_A_mid', 'bt_idle', 'sub_wait', 'rs_win', 'fr_list'];
for (const k of CPU) for (const theme of ['cosmos', 'cloud']) {
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await cdp.send('Performance.enable');
  await pg.goto(`${BASE}screen.html?s=${k}&theme=${theme}`, { waitUntil: 'load' }); await sleep(3500);
  const g = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const a = await g(); await sleep(8000); const b = await g();
  res.cpu[`${k}_${theme}`] = { busyPct: +((b.TaskDuration - a.TaskDuration) / 8 * 100).toFixed(2), scriptPct: +((b.ScriptDuration - a.ScriptDuration) / 8 * 100).toFixed(2), layoutPct: +((b.LayoutDuration - a.LayoutDuration) / 8 * 100).toFixed(2) };
  await pg.close();
}
fs.writeFileSync(path.join(OUT, 'metrics', 'idle_cpu.json'), JSON.stringify(res, null, 1));
const an = Object.values(res.animations), cpu = Object.values(res.cpu);
console.log(JSON.stringify({ states: an.length, maxRunningAnimations: Math.max(...an.map(x => x.running)), infiniteCssRules: Math.max(...an.map(x => x.infiniteCss)), maxRafPerSec: Math.max(...an.map(x => x.rafPerSec)), maxIntervals: Math.max(...an.map(x => x.intervals)), fxLeft: an.filter(x => x.fxLayer).length, maxBusyPct: Math.max(...cpu.map(x => x.busyPct)), meanBusyPct: +(cpu.reduce((s, x) => s + x.busyPct, 0) / cpu.length).toFixed(2) }));
await browser.close(); srv.kill();
