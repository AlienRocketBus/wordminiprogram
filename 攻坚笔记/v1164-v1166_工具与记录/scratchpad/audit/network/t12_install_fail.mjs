import { launch, newCtx, attach, swState, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Flaky network during SW install: one precache file fails -> how often is the whole 48-file shell re-downloaded?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = { steps: [] };
const browser = await launch();
const ctx = await newCtx(browser);
const page = await ctx.newPage();
// only the SW install fetches the bare /vocab_all.js (pages use ?v=1163); fail a different shell file for install requests
srv.cfg.rules = [{ re: '^/hansen_perf_v944\\.js\\?v=1163$', dest: 'empty', status: 503 }];
const count = () => { const l = srv.getLog(); return { shellRefetch: l.filter(x => x.path === '/vocab_all.js').length, failedInstallFile: l.filter(x => x.rule).length, total: l.length }; };
await page.goto(O + '/', { waitUntil: 'load' });
await sleep(8000);
R.steps.push({ step: 'first load', ...count(), sw: (await swState(page)).regs });
await page.reload({ waitUntil: 'load' }); await sleep(6000);
R.steps.push({ step: 'reload', ...count(), sw: (await swState(page)).regs });
await openIslandTap(page, 'island_food.html'); await waitIsland(page, 'island_food.html', 30000); await sleep(15000);
R.steps.push({ step: 'open island (+warm rooms)', ...count(), sw: (await swState(page)).regs });
await browser.close(); srv.server.close();
save('t12_result.json', R);
console.log(JSON.stringify(R, null, 1));
