// UI-9 skeptic: island path, signed-in kid taps 「点这里设置名字」 (identity bar) on 拼写大PK.
import { env, sleep, H, islandFrame, ftap, fscreen, fwait, flat, report } from './sk.mjs';
const rep = report('UI-9 skeptic · island identity bar -> profile');
const E = await env({ latencyMs: 40 });
try {
  const K = await E.phone('岛', { path: '/index.html', login: false, ready: () => !!(window.HansenAuth && window.openIsland), promptAnswer: '岛上小美' });
  await K.eval(() => { localStorage.setItem('hansen_onboarded', '1'); return 1; });
  await K.page.reload({ waitUntil: 'domcontentloaded' });
  await K.page.waitForFunction(() => !!(window.HansenAuth && window.openIsland), null, { timeout: 30000 });
  await sleep(1000);
  await H.loginPhone(K, '13900007777');
  await K.tap('a.island.food');
  let fr = null;
  await H.until(async () => { fr = islandFrame(K.page); return fr && fr.evaluate(() => !!(window.HansenSbPK && window.HansenSbProfile)).catch(() => false); }, { timeout: 40000 });
  await sleep(1000);
  for (let i = 0; i < 4; i++) { try { await ftap(K.page, fr, '#alertModal.show button', { timeout: 1200 }); await sleep(400); } catch (e) { break; } }
  await ftap(K.page, fr, '.mode-card[onclick*="openSpellPK"]');
  await fwait(fr, /拼写大PK/);
  rep.log('PK screen identity bar:', flat(await fr.evaluate(() => (document.getElementById('kMe') || {}).innerText || ''), 80));
  await ftap(K.page, fr, '#kMe');
  await sleep(700);
  const prof = await fr.evaluate(() => { const p = document.getElementById('hsb_prof'); return p ? { on: p.classList.contains('on'), z: getComputedStyle(p).zIndex, disp: getComputedStyle(p).display } : null; });
  const pk = await fr.evaluate(() => { const p = document.getElementById('hsn_pk_screen'); return p ? { on: p.classList.contains('on'), z: getComputedStyle(p).zIndex } : null; });
  rep.log('profile overlay:', JSON.stringify(prof), '| PK screen:', JSON.stringify(pk));
  rep.log('what the kid sees after tapping:', flat(await fscreen(fr), 90));
  // does anything else let an island kid set a name? try the PK screen's back button
  await ftap(K.page, fr, '#kBack');
  await sleep(600);
  rep.log('after ← 返回 on 拼写大PK the kid sees:', flat(await fscreen(fr), 120));
  rep.log('errors', K.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done();
process.exit(0);
