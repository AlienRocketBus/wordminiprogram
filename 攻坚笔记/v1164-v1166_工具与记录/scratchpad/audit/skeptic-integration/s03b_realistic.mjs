// INT-01 + INT-03 combined, realistic: child plays 动物, then plays 食物 (answers questions) and goes home.
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
const navs = [];
page.on('framenavigated', f => { if (f.parentFrame() === page.mainFrame()) navs.push({ t: Date.now(), url: f.url().replace(K.base, '') }); });
out('onboard', JSON.stringify(await freshHome(K, page)));
await sleep(1500);
const card = async () => page.evaluate(() => (document.getElementById('recentNum') || {}).textContent);
async function playListen(n) {
  const fr = await frameOf(page);
  await tap(page, fr, '.mode-card[onclick="startListen()"]');
  await sleep(700);
  await tap(page, fr, '#listenContent div[onclick^="startListenLevel"]');
  for (let i = 0; i < n; i++) {
    await sleep(1200);
    const opt = await fr.$('#listenScreen .boss-opt');
    if (opt) await tap(page, fr, opt);
    await sleep(1900);
  }
  const ta = await fr.evaluate(() => { try { return { url: location.pathname.split('/').pop(), ta: (typeof S !== 'undefined') ? S.totalAnswers : 'noS', scr: (document.querySelector('.screen.active') || {}).id, opts: document.querySelectorAll('#listenScreen .boss-opt').length }; } catch (e) { return 'err ' + e.message; } });
  await fr.evaluate(() => { try { showScreen('home'); } catch (e) {} });
  return ta;
}
async function visit(file, answers) {
  const t0 = Date.now();
  const tr = await tap(page, page, `a.island[href="${file}"]`);
  const vv = await waitVisible(page, file, t0);
  out('open', file, JSON.stringify(tr), vv.ms, JSON.stringify(vv.s));
  await dismissWelcome(page, 3000);
  await sleep(7000); // hidden warm copies load + save meanwhile
  const ta = answers ? await playListen(answers) : 0;
  const tClose = Date.now();
  const nMark = navs.length;
  await tapMap(page); await waitHidden(page, Date.now());
  await sleep(8000);
  const ls = await page.evaluate(() => { const o = {}; for (const k of ['wordIslandAnimal', 'wordIslandFood', 'wordIslandSeason']) { try { o[k] = JSON.parse(localStorage.getItem(k)).lastSaveTime; } catch (e) { o[k] = null; } } o.lastIslandKey = localStorage.getItem('lastIslandKey'); return o; });
  out(`after playing ${file} (answers=${JSON.stringify(ta)}) and closing: card="${await card()}" | iframe now ${(await islandState(page)).path} | iframe navs after close: ${JSON.stringify(navs.slice(nMark).map(n => n.url))} | lastSaveTimes ${JSON.stringify(ls)}`);
}
await visit('island_animal.html', 2);
await visit('island_food.html', 2);
await K.done();
