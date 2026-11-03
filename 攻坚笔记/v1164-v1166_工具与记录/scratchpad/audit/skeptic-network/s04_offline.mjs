// NET-04 re-check: after opening island_food once online (SW controlling), is it complete offline?
import { launch, ctxOf, watch, waitSw, tapIsland, waitIsland, start, SNAP, OUT, save, sleep, caches } from './lib.mjs';
const R = {};
const srv = await start([SNAP], { gzip: true });
const O = srv.origin;
const browser = await launch();
const isle = 'island_food.html';
const fr = page => page.frames().find(f => f.url().includes(isle));
async function run(label, extraIslands = []) {
  const ctx = await ctxOf(browser, { sw: true });
  const page = await ctx.newPage();
  const ev = []; watch(page, ev, label);
  await page.goto(O + '/', { waitUntil: 'load' });
  R[label] = { swActive: await waitSw(page) };
  await sleep(2500);
  await page.reload({ waitUntil: 'load' });
  await sleep(3000);
  const onlineCodeUrls = new Set();
  page.on('request', r => { const u = r.url(); if (u.startsWith(O) && /\.(js|css|woff2|ico|webmanifest)(\?|$)/.test(u)) onlineCodeUrls.add(u.replace(O, '')); });
  for (const f of [isle, ...extraIslands]) {
    await tapIsland(page, f);
    await waitIsland(page, f, 30000);
    await sleep(12000);
    const ff = page.frames().find(x => x.url().includes(f));
    await ff.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent) && x.offsetParent); if (b) b.click(); }).catch(() => {});
    await page.evaluate(() => window.closeIsland());
    await sleep(1500);
  }
  await sleep(3000);
  const cs = await caches(page);
  R[label].cacheCounts = Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, v.length]));
  R[label].distinctCodeUrlsRequestedOnline = onlineCodeUrls.size;
  // offline now
  await ctx.setOffline(true);
  ev.length = 0;
  await page.reload({ waitUntil: 'load' });
  await sleep(2000);
  const homeBad = await page.evaluate(() => (document.getElementById('hsnBootBad') || {}).innerText || null);
  const t = await tapIsland(page, isle);
  const w = await waitIsland(page, isle, 25000);
  await sleep(5000);
  const g = await fr(page).evaluate(() => ({ WORD_MAP: typeof window.WORD_MAP, SENTENCE_MAP: typeof window.SENTENCE_MAP, smartHighlight: typeof window.smartHighlight, EX_AUDIO: typeof window.__HANSEN_EX_AUDIO, HansenBossAnim: typeof window.HansenBossAnim, title: document.title, bootBad: (document.getElementById('hsnBootBad') || {}).innerText || null })).catch(e => String(e).slice(0, 120));
  const fails = [...new Set(ev.filter(e => /^http5/.test(e.k) || e.k === 'reqfail').map(e => e.k + ' ' + e.t.split('?')[0]))];
  R[label].offline = { tap: t, wait: { title: w.title, timeout: !!w.timeout }, globals: g, homeBootBanner: homeBad, failedCode: fails.filter(x => /\.(js|css|woff2)/.test(x)), pageerrors: ev.filter(e => e.k === 'pageerror').map(e => e.t).slice(0, 6) };
  // can the kid still play the listening game offline?
  try {
    await fr(page).evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent) && x.offsetParent); if (b) b.click(); });
    await fr(page).evaluate(() => { startListen(); });
    await sleep(300);
    await fr(page).evaluate(() => { startListenLevel(Object.keys(LISTEN_LEVELS)[0]); });
    await sleep(1500);
    R[label].offline.listen = await fr(page).evaluate(() => (document.getElementById('listenContent') || document.body).innerText.slice(0, 120));
  } catch (e) { R[label].offline.listenErr = String(e).slice(0, 200); }
  await page.screenshot({ path: OUT + `/s04_${label}.png` });
  await ctx.close();
}
try {
  await run('food_only');
  await run('food_then_animal_sports', ['island_animal.html', 'island_sports.html']);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); await srv.close();
save('s04_result.json', R);
console.log(JSON.stringify(R, null, 1).slice(0, 9000));
