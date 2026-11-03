/* 玩岛屿时云存档多久上传一次（数据一变 → 8 秒内 force 上传；内容没变也传？）+ 切后台那一下传几次 */
import { H, tally, fmt } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, consistencyLagMs: 0 } });
const ISL_READY = () => !!(window.HansenAuth && window.HansenFriends && window.HansenCloudSave && window.HansenBackup);
const p = await H.openPhone(browser, emu, srv.origin, { name: 'isl', path: process.env.PAGE || '/island_animal.html', ready: ISL_READY });
await H.dismissIslandWelcome(p);
const r = await H.loginPhone(p, '13511112222');
await p.eval(async () => {
  window.HansenSbProfile && window.HansenSbProfile.setName('小岛');
  const k = 'wordIslandAnimal'; let o = {}; try { o = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) {}
  o.learned = [0, 1, 2, 3, 4]; localStorage.setItem(k, JSON.stringify(o));
});
await H.sleep(3000);
await p.page.reload({ waitUntil: 'domcontentloaded' });
await p.page.waitForFunction(ISL_READY, null, { timeout: 45000 });
await H.dismissIslandWelcome(p);
await H.sleep(8000);
const st0 = await p.eval(() => JSON.parse(localStorage.getItem('hansen_cloud_save_state_v965') || localStorage.getItem('hansen_cloudsave_v965') || '{}'));
console.log('登录', r.ok, ' 云存档状态键：', JSON.stringify(st0).slice(0, 160));
const isSave = (k) => / hansen_saves$/.test(k) && /^(update|add)/.test(k);
/* ① 60 秒里每 2 秒写一次同一个值（像答题时反复存档，但内容其实没变） */
let t0 = Date.now();
for (let i = 0; i < 30; i++) {
  await p.eval(() => { const v = localStorage.getItem('wordIslandAnimal'); localStorage.setItem('wordIslandAnimal', v); });
  await H.sleep(2000);
}
await H.sleep(9000);
let t1 = Date.now();
const a = tally(emu, { uid: p.cloudUid, t0, t1, filter: isSave });
console.log(`① 内容没变、每 2 秒写一次，${((t1 - t0) / 1000).toFixed(0)} 秒内上传云存档 ${a.total} 次`);
/* ② 切后台：每一层页面（岛 + 预热的赛季岛…）都收到 visibilitychange */
t0 = Date.now();
for (const f of p.page.frames()) {
  try { await f.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }); } catch (e) {}
}
await H.sleep(12000);
t1 = Date.now();
const b = tally(emu, { uid: p.cloudUid, t0, t1, filter: isSave });
const frames = p.page.frames().filter((f) => /island_|land_map/.test(f.url())).map((f) => f.url().replace(/^https?:\/\/[^/]+\//, ''));
console.log(`② 切后台一次（${frames.length} 层页面：${frames.join(', ')}）→ 上传云存档 ${b.total} 次`);
console.log(fmt(tally(emu, { uid: p.cloudUid, t0, t1 }), (t1 - t0) / 1000));
await p.close(); srv.close(); await browser.close();
