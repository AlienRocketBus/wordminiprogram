/* Skeptic: cloud-save uploads per minute while a kid's progress key is rewritten (same value) every 2 s,
 * and per app backgrounding.  PAGE=/island_animal.html | /spelling_pk.html */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const PAGE = process.env.PAGE || '/island_animal.html';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: () => !!(window.HansenAuth && window.HansenSbProfile) });
const r = await H.loginPhone(p, '1382222' + String(Math.floor(Math.random() * 9000) + 1000));
console.log('login', !!(r && r.ok));
/* the kid already learned something (otherwise uploads are refused as "local empty") */

const evs = [];
p.page.on('console', (m) => { const t = m.text(); if (t.startsWith('[CHG]')) evs.push(t); });
await p.page.goto(srv.origin + PAGE, { waitUntil: 'domcontentloaded' });
await H.sleep(14000);
/* the kid has learned 3 words on this island (real key + real shape: word indices) */
const SAME = await p.eval(() => { const k = 'wordIslandAnimal'; let o = {}; try { o = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) {} o.learned = [0, 1, 2]; const v = JSON.stringify(o); localStorage.setItem(k, v); return v; });
const firstSync = await p.eval(async () => window.HansenCloudSave.syncNow({ force: true }));
console.log('first explicit sync', JSON.stringify(firstSync));
await H.sleep(3000);
/* every frame that has cloud-save: log when it gets hsn-data-changed */
let csFrames = 0;
for (const f of p.page.frames()) {
  try {
    const has = await f.evaluate(() => { if (!window.HansenCloudSave) return false; document.addEventListener('hsn-data-changed', () => console.log('[CHG] ' + location.pathname + ' @' + Date.now())); return true; });
    if (has) csFrames++;
  } catch (e) {}
}
const saves = (t0, t1) => emu.log.filter((e) => e.method !== 'OPTIONS' && e.collection === 'hansen_saves' && /update|add/.test(e.action || '') && e.t >= t0 && e.t < t1).length;
const savesRead = (t0, t1) => emu.log.filter((e) => e.method !== 'OPTIONS' && e.collection === 'hansen_saves' && /query/.test(e.action || '') && e.t >= t0 && e.t < t1).length;
console.log('frames', p.page.frames().length, 'frames with HansenCloudSave', csFrames);
let t0 = Date.now(); await H.sleep(20000);
console.log('A) idle 20 s, no data change: uploads', saves(t0, Date.now()), 'reads', savesRead(t0, Date.now()));
/* same value every 2 s for 60 s (content never changes after the first write) */
t0 = Date.now();
for (let i = 0; i < 30; i++) { await p.eval((v) => localStorage.setItem('wordIslandAnimal', v), SAME); await H.sleep(2000); }
await H.sleep(9000);
const tA = Date.now();
console.log('B) same value rewritten every 2 s for 60 s (+9 s tail): uploads', saves(t0, tA), 'reads', savesRead(t0, tA), '| hsn-data-changed events by frame:', JSON.stringify(evs.filter((x) => Number(x.split('@')[1]) >= t0).reduce((o, x) => { const k = x.split(' ')[1]; o[k] = (o[k] || 0) + 1; return o; }, {})));
await H.sleep(10000);
/* app goes to background: every document in the page becomes hidden and gets visibilitychange */
t0 = Date.now();
for (const f of p.page.frames()) {
  try { await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }); } catch (e) {}
}
await H.sleep(10000);
console.log('C) one backgrounding (nothing changed): uploads', saves(t0, Date.now()));
console.log('errors', p.errors.slice(0, 3).join(' | ') || 'none');
await p.close(); srv.close(); await browser.close();
