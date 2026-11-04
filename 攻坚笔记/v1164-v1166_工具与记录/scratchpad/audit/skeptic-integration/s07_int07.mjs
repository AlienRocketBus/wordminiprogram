// INT-07: 极速60秒 keeps counting down while the island is hidden on home?
import { sleep, tap } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { islandState, waitVisible, waitHidden, frameOf, dismissWelcome, tapMap, freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const out = (...a) => console.log(...a);
await freshHome(K, page);
await sleep(1000);
let t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
await waitVisible(page, 'island_animal.html', t0);
await dismissWelcome(page);
await sleep(1500);
let fr = await frameOf(page);
await tap(page, fr, '.mode-card[onclick="startSpeed()"]');
await sleep(800);
await tap(page, fr, `#speedContent div[onclick="startSpeedLevel('easy')"]`);
await sleep(2200);
const rd = async () => (await frameOf(page)).evaluate(() => ({ spTime, spActive, timerOn: !!spTimer, screen: (document.querySelector('.screen.active') || {}).id, vis: document.visibilityState, xp: (typeof S !== 'undefined') ? S.xp : null }));
out('in game before leaving:', JSON.stringify(await rd()));
await page.evaluate(() => history.back()); // phone back
await sleep(300);
out('right after back (island hidden):', JSON.stringify(await islandState(page)), JSON.stringify(await rd()));
await sleep(10000);
out('after 10 s on home:', JSON.stringify(await rd()));
// re-enter via card (same island => keep-alive)
t0 = Date.now();
await tap(page, page, 'a.island[href="island_animal.html"]');
await waitVisible(page, 'island_animal.html', t0);
out('after re-enter:', JSON.stringify(await rd()));
// Compare: 打地鼠 (moles) hidden behaviour quickly
await (await frameOf(page)).evaluate(() => { try { stopSpeed(); showScreen('home'); } catch (e) {} });
await K.done();
