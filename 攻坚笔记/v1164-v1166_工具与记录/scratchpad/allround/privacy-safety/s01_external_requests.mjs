// Records every request the app tries to send to a non-local host (all are aborted), per page.
// Two states: fresh signed-out child, and a locally "signed-in" child (cloud calls are expected to go to Tencent CloudBase).
import fs from 'node:fs';
import { startServer, launch, newCtx, OUT } from './lib.mjs';

const PAGES = ['index.html', 'island_animal.html', 'island_land1.html', 'spelling_bee.html', 'spelling_pk.html',
  'boss_hall.html', 'land_map.html', 'season_showcase.html'];
const { srv, base } = await startServer();
const browser = await launch();
const result = {};
try {
  for (const state of ['signed_out', 'signed_in']) {
    for (const pg of PAGES) {
      const ext = [];
      const ctx = await newCtx(browser, ext);
      if (state === 'signed_in') {
        await ctx.addInitScript(() => {
          try {
            if (sessionStorage.getItem('__ps_init')) return; sessionStorage.setItem('__ps_init', '1');
            localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'TESTUID', method: 'phone', phone: '+86 10000000000', signedAt: Date.now() }));
          } catch (e) {}
        });
      }
      const page = await ctx.newPage();
      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.goto(base + '/' + pg, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(9000);
      const hosts = {};
      for (const e of ext) { const k = e.host; hosts[k] = hosts[k] || { n: 0, sample: [] }; hosts[k].n++; if (hosts[k].sample.length < 3) hosts[k].sample.push(e.type + ' ' + e.path); }
      result[state + ':' + pg] = hosts;
      await ctx.close();
    }
  }
} finally {
  await browser.close(); srv.close();
}
fs.writeFileSync(OUT + '/s01_external_requests.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1));
