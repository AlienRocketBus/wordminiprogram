// INT-08: new version deployed while the child is in the app -> forced refresh while inside an island
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
const topNavs = [];
page.on('framenavigated', f => { if (f === page.mainFrame()) topNavs.push({ t: Date.now(), url: f.url().replace(K.base, '') }); });
await freshHome(K, page);
await sleep(9000); // home's own version check done with 1163
out('home version state:', JSON.stringify(await page.evaluate(() => window.HansenVersionWatch && HansenVersionWatch.state ? HansenVersionWatch.state() : null)));
K.state.version = '1164'; // deploy happens
const tDeploy = Date.now();
let t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
const v = await waitVisible(page, 'island_animal.html', t0);
out('island visible after', v.ms, 'ms');
await dismissWelcome(page, 2500).catch(() => {});
let started = false;
try {
  const fr = await frameOf(page);
  await tap(page, fr, '.mode-card[onclick="startSpeed()"]');
  await sleep(500);
  await tap(page, fr, `#speedContent div[onclick="startSpeedLevel('easy')"]`);
  started = true;
} catch (e) { out('could not start game:', e.message.slice(0, 80)); }
const tStart = Date.now();
for (let i = 0; i < 30; i++) {
  await sleep(500);
  const s = await islandState(page).catch(e => ({ err: e.message.slice(0, 60) }));
  if (topNavs.length) break;
}
await sleep(2500);
out('game started:', started, '| top navigations:', JSON.stringify(topNavs.map(n => ({ dtFromDeploy: n.t - tDeploy, dtFromGameStart: n.t - tStart, url: n.url }))));
out('final state:', JSON.stringify(await islandState(page).catch(e => ({ err: e.message }))));
out('VERSION requests:', K.reqs.filter(r => r.path === '/VERSION').length);
await K.done();
