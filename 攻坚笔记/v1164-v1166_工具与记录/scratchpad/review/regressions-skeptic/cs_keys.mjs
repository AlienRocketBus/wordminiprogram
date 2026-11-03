/* Which keys does each frame write while the kid does nothing (these trigger hsn-data-changed → forced upload)? */
const H = await import(process.env.HARNESS || '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const p = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: () => !!(window.HansenAuth && window.HansenSbProfile) });
await H.loginPhone(p, '1384444' + String(Math.floor(Math.random() * 9000) + 1000));
await p.page.goto(srv.origin + '/island_animal.html', { waitUntil: 'domcontentloaded' });
await H.sleep(14000);
await p.eval(() => { const k = 'wordIslandAnimal'; let o = {}; try { o = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) {} o.learned = [0, 1, 2]; localStorage.setItem(k, JSON.stringify(o)); });
await H.sleep(10000);
const rows = [];
p.page.on('console', (m) => { const t = m.text(); if (t.startsWith('[SET]')) rows.push(t); });
for (const f of p.page.frames()) {
  try {
    await f.evaluate(() => {
      const ls = window.localStorage, inner = ls.setItem;
      ls.setItem = function (k, v) {
        let owned = false; try { owned = !!(window.HansenBackup && HansenBackup.isOwnedKey && HansenBackup.isOwnedKey(k)); } catch (e) {}
        console.log('[SET] ' + location.pathname + ' ' + k + ' owned=' + owned);
        return inner.apply(this, arguments);
      };
    });
  } catch (e) {}
}
await H.sleep(40000);
const agg = {};
for (const r of rows) { const k = r.slice(6); agg[k] = (agg[k] || 0) + 1; }
console.log('localStorage.setItem calls in 40 s of doing nothing, by frame/key:');
for (const [k, v] of Object.entries(agg).sort((a, b) => b[1] - a[1])) console.log('  ', String(v).padStart(4), k);
const up = emu.log.filter((e) => e.method !== 'OPTIONS' && e.collection === 'hansen_saves' && /update|add/.test(e.action || '') && e.t >= Date.now() - 40000).length;
console.log('hansen_saves uploads in the same 40 s:', up);
await p.close(); srv.close(); await browser.close();
