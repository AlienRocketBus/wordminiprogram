/* E3 (AUTH-3): the 557 KB SDK file fails to download ONCE (connection dropped mid-body, or 504 like the SW's
 * offline answer), then the network is fine again.  Does the app ever recover without a page reload?
 * PAGE=pk    : standalone spelling_pk.html (signed-in kid), ensureSession x4 + ladder UI by taps.
 * PAGE=index : index.html + island iframe; close the island and open another one (no reload) -> still broken?
 * FAIL=drop|504.  OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
const PAGE = process.env.PAGE || 'pk';
const FAIL = process.env.FAIL || 'drop';
let failNext = 0, vendorReq = 0;
const srv = await L.serve(L.ROOTSEL, (req, res, u) => {
  if (!/vendor_cloudbase_esm_v965\.js$/.test(u.pathname)) return false;
  vendorReq++;
  if (failNext > 0) {
    failNext--;
    if (FAIL === '504') { res.writeHead(504, { 'content-type': 'text/plain' }); res.end(''); return true; }
    /* send headers + part of the body, then drop the connection (weak 4G) */
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': 557376, 'cache-control': 'no-store' });
    res.write('/* partial */ export const x = 1;\n' + ' '.repeat(20000));
    setTimeout(() => { try { req.socket.destroy(); } catch (e) {} }, 50);
    return true;
  }
  return false;
});
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const o = { ver: L.VER, page: PAGE, fail: FAIL };
try {
  const path = PAGE === 'index' ? '/index.html' : '/spelling_pk.html';
  const ready = PAGE === 'index' ? L.INDEX_READY : L.PK_READY;
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path, ready });
  const lg = await H.loginPhone(ph, '13800000721');
  o.login = { ok: lg.ok, uid: lg.uid };
  await H.sleep(62000);                       // not "fresh" any more
  failNext = 1;                               // the NEXT download of the SDK fails once
  const before = vendorReq;
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(ready, null, { timeout: 45000 });
  await H.sleep(800);
  let ctx = ph.page;
  if (PAGE === 'index') {
    await ph.eval(() => window.openIsland('island_animal.html'));
    ctx = await H.until(async () => ph.page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
    await ctx.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudSave), null, { timeout: 45000 });
  }
  o.calls = [];
  for (let i = 0; i < 4; i++) {
    await H.sleep(1500);
    const r = await ctx.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 110) }; });
    o.calls.push(r);
  }
  o.vendorReqAfterReload = vendorReq - before;
  o.signedStill = await ph.eval(() => HansenAuth.isSignedIn());
  if (PAGE === 'index') {
    /* kid goes home and opens a different island (no page reload) */
    await ph.eval(() => window.closeIsland());
    await H.sleep(800);
    await ph.eval(() => window.openIsland('island_food.html'));
    const fr2 = await H.until(async () => ph.page.frames().find((f) => /island_food\.html/.test(f.url())), { timeout: 20000 });
    await fr2.waitForFunction(() => !!(window.HansenAuth && window.HansenCloudSave), null, { timeout: 45000 });
    await H.sleep(1500);
    o.otherIsland = await fr2.evaluate(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 110) }; });
    o.vendorReqAfterIslandSwitch = vendorReq - before;
  } else {
    /* ladder by taps */
    await ph.tap('#pkLadder');
    await H.answerNameIfAsked(ph, '小蜂');
    await ph.tap('#ldGo').catch((e) => { o.ldGoErr = e.message.slice(0, 120); });
    const t0 = Date.now(); let txt = '';
    while (Date.now() - t0 < 40000) { txt = (await ph.screen()).replace(/\s+/g, ' '); if (/连不上网络|云端还没连上|这次没成功|过期/.test(txt)) break; await H.sleep(500); }
    o.ladderScreen = txt.slice(0, 260);
    o.ladderAfterMs = Date.now() - t0;
    const rb = await ph.hitTest('#ldRetry', { timeout: 1500 });
    if (rb.ok) { await ph.tap('#ldRetry'); await H.sleep(4000); o.afterRetry = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 200); }
  }
  /* does a cache-busting URL load in this same document? (validates the suggested fix) */
  o.bust = await ph.eval(async () => { try { const m = await import('./vendor_cloudbase_esm_v965.js?r=' + Date.now()); return !!(m && (m.default || m).init); } catch (e) { return 'ERR ' + e.message.slice(0, 80); } });
  /* reload heals it */
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(ready, null, { timeout: 45000 });
  await H.sleep(800);
  o.afterReload = await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind }; });
  o.errors = ph.errors.slice(0, 3);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
