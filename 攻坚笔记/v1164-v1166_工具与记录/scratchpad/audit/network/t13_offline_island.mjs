import { launch, newCtx, attach, cacheSummary, waitSwActive, save, startServer, SNAP, OUT, sleep, openIslandTap, waitIsland } from './lib.mjs';
// Offline promise: "联网打开一次之后就能从本机缓存中访问" — is a previously-visited island fully usable offline?
const srv = await startServer(SNAP);
const O = srv.origin;
const R = {};
const browser = await launch();
async function visit(page, file) {
  await openIslandTap(page, file);
  await waitIsland(page, file, 30000);
  await sleep(6000);
  const f = page.frames().find(fr => fr.url().includes(file));
  await f.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /开始冒险/.test(x.textContent) && x.offsetParent); if (b) b.click(); }).catch(() => {});
  await page.evaluate(() => window.closeIsland());
  await sleep(1500);
}
async function scenario(label, islands) {
  const ctx = await newCtx(browser);
  await ctx.addInitScript(() => { window.__tts = 0; try { const S = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = function (u) { if (u && u.text && u.text.trim()) window.__tts++; return S(u); }; } catch (e) {} });
  const page = await ctx.newPage();
  const ev = []; attach(page, label, ev);
  await page.goto(O + '/', { waitUntil: 'load' });
  await waitSwActive(page);
  await sleep(3000);
  await page.reload({ waitUntil: 'load' });
  await sleep(2000);
  for (const f of islands) await visit(page, f);
  const cs = await cacheSummary(page);
  await ctx.setOffline(true);
  ev.length = 0;
  await page.reload({ waitUntil: 'load' });
  await sleep(1500);
  await openIslandTap(page, 'island_food.html');
  const w = await waitIsland(page, 'island_food.html', 20000);
  await sleep(4000);
  const f = page.frames().find(fr => fr.url().includes('island_food.html'));
  const g = await f.evaluate(() => ({ WORD_MAP: typeof window.WORD_MAP, SENTENCE_MAP: typeof window.SENTENCE_MAP, HansenSpellBee: typeof window.HansenSpellBee, HsnAvatar: typeof window.HsnAvatar, smartHighlight: typeof window.smartHighlight, EX_AUDIO: typeof window.__HANSEN_EX_AUDIO, HansenAuth: typeof window.HansenAuth }));
  const homeBanner = await page.evaluate(() => (document.getElementById('hsnBootBad') || {}).innerText || null);
  R[label] = {
    islandsVisitedOnline: islands, cacheCounts: Object.fromEntries(Object.entries(cs).map(([k, v]) => [k, v.n])),
    offlineIsland: { title: w.title, ms: w.ms }, globals: g,
    failedScripts: [...new Set(ev.filter(e => e.kind === 'http504').map(e => e.text.split('?')[0]))],
    homeBanner
  };
  await page.screenshot({ path: OUT + `/t13_${label}.png` });
  await ctx.close();
}
try {
  await scenario('food_only', ['island_food.html']);
  await scenario('food_then_2_more', ['island_food.html', 'island_animal.html', 'island_sports.html']);
} catch (e) { R.fatal = String(e.stack || e).slice(0, 800); }
await browser.close(); srv.server.close();
save('t13_result.json', R);
console.log(JSON.stringify(R, null, 1));
