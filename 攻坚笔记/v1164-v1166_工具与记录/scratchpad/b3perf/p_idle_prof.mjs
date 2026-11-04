// 待机 8 秒 CPU 采样：哪些函数（含被 perf_boost 包着的定时器）在耗主线程
import { launch, throttle, sleep, BASE } from './lib.mjs';
const url = process.argv[2] || 'island_food.html';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await throttle(page, { net: false, cpu: 4 });
await page.goto(BASE + url); await sleep(12000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
await sleep(3000);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
await sleep(8000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map(); const dt = profile.timeDeltas; 
for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const k = n.callFrame.functionName + ' ' + n.callFrame.url.replace(BASE, '').split('?')[0] + ':' + n.callFrame.lineNumber; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); }
console.log([...self.entries()].filter(([k]) => !/^\(idle\)|^\(program\)|^\(garbage/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => Math.round(v) + 'ms ' + k).join('\n'));
await browser.close();
