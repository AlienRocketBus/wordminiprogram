/* E8: which non-local, non-Tencent requests do the real pages try to make under the harness? (all are aborted + recorded) */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 20 } });
const out = {};
for (const p of ['/spelling_pk.html', '/island_animal.html', '/index.html']) {
  try {
    const ph = await H.openPhone(browser, emu, srv.origin, { name: p, path: p, ready: () => document.readyState === 'complete' });
    if (p === '/spelling_pk.html') await H.loginPhone(ph, '13800000931');
    await H.sleep(6000);
    out[p] = { leaks: ph.leaks.slice(0, 10), nLeaks: ph.leaks.length, pageErrors: ph.errors.slice(0, 3), missing: srv.missing.slice(0, 10) };
    await ph.close();
  } catch (e) { out[p] = { err: String(e.message || e).slice(0, 200) }; }
}
out.tencentPaths = [...new Set(emu.log.map((e) => e.host + e.path))].slice(0, 20);
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close(); process.exit(0);
