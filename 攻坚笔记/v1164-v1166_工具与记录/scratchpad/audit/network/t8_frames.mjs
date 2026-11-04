import { launch, newCtx, attach, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// How many documents/frames exist after opening ONE island? (room warm nesting, memory/bandwidth on weak phones)
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
const ctx = await newCtx(browser, { sw: false });
const page = await ctx.newPage();
await page.goto(O + '/', { waitUntil: 'load' });
await sleep(3000);
R.framesHome = page.frames().map(f => f.url().replace(O, ''));
srv.getLog();
await openIslandTap(page, 'island_food.html');
await waitIsland(page, 'island_food.html', 30000);
await sleep(25000);
function depth(f) { let d = 0; while (f.parentFrame()) { d++; f = f.parentFrame(); } return d; }
R.framesAfterIsland = page.frames().map(f => '  '.repeat(depth(f)) + f.url().replace(O, ''));
const log = srv.getLog();
R.docsLoaded = log.filter(x => /\.html/.test(x.path)).map(x => x.path + ' ' + x.dest + ' ' + x.status);
R.reqCount = log.length;
const cdp = await ctx.newCDPSession(page);
const m = await cdp.send('Performance.enable').then(() => cdp.send('Performance.getMetrics'));
R.metrics = Object.fromEntries(m.metrics.filter(x => /JSHeapUsedSize|Documents|Frames|Nodes/.test(x.name)).map(x => [x.name, x.name.includes('Heap') ? Math.round(x.value / 1048576) + 'MB' : x.value]));
await browser.close(); srv.server.close();
save('t8_result.json', R);
console.log(JSON.stringify(R, null, 1));
