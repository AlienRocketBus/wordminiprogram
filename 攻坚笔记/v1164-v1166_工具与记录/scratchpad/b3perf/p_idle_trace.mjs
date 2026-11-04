// 待机主线程拆账：录 8 秒 trace，按事件类型汇总主线程耗时
import { launch, throttle, sleep, BASE } from './lib.mjs';
const url = process.argv[2] || 'index.html';
const noAnim = process.argv[3] === 'noanim';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
const page = await ctx.newPage(); page.on('dialog', d => d.dismiss().catch(()=>{}));
const cdp = await throttle(page, { net: false, cpu: 4 });
await page.goto(BASE + url); await sleep(12000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); });
if (noAnim) await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
await sleep(3000);
const events = [];
cdp.on('Tracing.dataCollected', e => events.push(...e.value));
const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
await sleep(8000);
await cdp.send('Tracing.end'); await done;
// main thread = CrRendererMain of the page's renderer
const threads = {}; for (const e of events) if (e.name === 'thread_name') threads[e.pid + ':' + e.tid] = e.args.name;
const mainKeys = Object.keys(threads).filter(k => threads[k] === 'CrRendererMain');
const sum = {}; let tot = 0; const fns = {};
for (const e of events) {
  if (e.ph !== 'X' || !mainKeys.includes(e.pid + ':' + e.tid)) continue;
  const d = (e.dur || 0) / 1000;
  sum[e.name] = (sum[e.name] || 0) + d;
  if (e.name === 'RunTask') tot += d;
  if (e.name === 'FunctionCall' && e.args && e.args.data) { const k = (e.args.data.url || '').replace(BASE, '') + ':' + e.args.data.lineNumber + ' ' + (e.args.data.functionName || ''); fns[k] = (fns[k] || 0) + d; }
  if (e.name === 'TimerFire' || e.name === 'FireAnimationFrame') {}
}
console.log(url, noAnim ? 'noanim' : '', 'RunTask ms/8s', Math.round(tot), 'busy%', Math.round(tot / 80));
console.log(Object.entries(sum).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => k + ' ' + Math.round(v)).join('\n'));
console.log('-- top functions');
console.log(Object.entries(fns).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => Math.round(v) + 'ms ' + k).join('\n'));
await browser.close();
