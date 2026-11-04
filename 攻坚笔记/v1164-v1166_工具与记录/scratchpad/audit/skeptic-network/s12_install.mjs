// NET-12 re-check: (a) SW install failing -> how many install attempts after opening one island? (b) first-visit bytes with vs without SW.
import { launch, ctxOf, tapIsland, waitIsland, start, SNAP, save, sleep } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
async function a() {
  srv.cfg.rules = [{ re: '^/hansen_perf_v944\\.js\\?v=1163$', dest: 'empty', status: 503 }];
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  srv.take();
  const t0 = Date.now();
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(6000);
  const homeOnly = srv.peek().filter(x => x.path === '/vocab_all.js').length;
  await tapIsland(page, 'island_food.html');
  await waitIsland(page, 'island_food.html', 30000);
  await sleep(25000);
  const log = srv.take();
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? { active: !!r.active, installing: !!r.installing, waiting: !!r.waiting } : null; });
  R.a_installFails = {
    installAttempts_bareVocabFetches: log.filter(x => x.path === '/vocab_all.js').length,
    attemptsWhileOnlyHome: homeOnly,
    swScriptFetches: log.filter(x => x.path.startsWith('/sw_v944.js')).length,
    failingFileHits: log.filter(x => x.rule).length,
    totalRequests: log.length,
    totalKB: Math.round(log.reduce((s, x) => s + (x.size || 0), 0) / 1024),
    shellRefetchKB: Math.round(log.filter(x => x.dest === 'empty' && /\.(js|html|woff2|ico|webmanifest)/.test(x.path) && !/purpose/.test(x.purpose) && x.purpose !== 'prefetch').reduce((s, x) => s + (x.size || 0), 0) / 1024),
    registration: reg, controller: await page.evaluate(() => !!navigator.serviceWorker.controller), seconds: Math.round((Date.now() - t0) / 1000)
  };
  srv.cfg.rules = [];
  await ctx.close();
}
async function b(sw) {
  srv.cfg.rules = [];
  const ctx = await ctxOf(browser, { sw });
  const page = await ctx.newPage();
  srv.take();
  await page.goto(O + '/', { waitUntil: 'load' });
  await sleep(30000);
  const log = srv.take();
  const installFetches = log.filter(x => x.dest === 'empty' && /\.(js|html|woff2|ico|webmanifest)(\?|$)/.test(x.path) && x.purpose !== 'prefetch' && !/island_|land_map/.test(x.path));
  R['b_firstVisit_' + (sw ? 'sw' : 'nosw')] = { reqs: log.length, kb: Math.round(log.reduce((s, x) => s + (x.size || 0), 0) / 1024), swInstallStyleFetches: installFetches.length, swInstallKB: Math.round(installFetches.reduce((s, x) => s + (x.size || 0), 0) / 1024), vocabFetches: log.filter(x => /^\/vocab_all\.js/.test(x.path)).map(x => x.path + ' ' + x.dest + ' ' + x.status) };
  await ctx.close();
}
try { await a(); } catch (e) { R.a_fatal = String(e.stack || e).slice(0, 500); }
try { await b(true); await b(false); } catch (e) { R.b_fatal = String(e.stack || e).slice(0, 500); }
await browser.close(); await srv.close();
save('s12_result.json', R);
console.log(JSON.stringify(R, null, 1));
