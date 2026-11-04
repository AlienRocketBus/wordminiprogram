// 首页「什么动画都关了」还在每帧合成：谁在作废样式/图层
import { launch, throttle, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
const cdp = await throttle(page, { net: false, cpu: 4 });
await page.goto(BASE + (process.argv[2] || "index.html")); await sleep(+(process.env.WAIT || 12000));
if (process.argv[3] === 'noanim') await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
await sleep(2000);
const events = [];
cdp.on('Tracing.dataCollected', e => events.push(...e.value));
const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,disabled-by-default-devtools.timeline.stack', transferMode: 'ReportEvents' });
await sleep(3000);
await cdp.send('Tracing.end'); await done;
const cnt = {};
for (const e of events) { if (/Invalidation|ScheduleStyle|StyleRecalc|LayerTree|BeginFrame|NeedsBeginFrame|RequestMainThreadFrame|ScheduleAction|SetNeeds/.test(e.name)) { const d = e.args && e.args.data; const st = d && d.stackTrace && d.stackTrace[0] ? (d.stackTrace[0].url || '').replace(BASE,'').split('?')[0] + ':' + d.stackTrace[0].lineNumber + ' ' + d.stackTrace[0].functionName : ''; const k = e.name + ' ' + (d ? (d.nodeName || d.reason || '') : '') + ' <' + st + '>'; cnt[k] = (cnt[k] || 0) + 1; } }
console.log(Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => v + ' ' + k).join('\n'));
await browser.close();
