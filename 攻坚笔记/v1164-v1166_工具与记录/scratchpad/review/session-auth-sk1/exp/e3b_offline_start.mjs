/* E3b (AUTH-3, most common real trigger): the page is already loaded, the phone has NO signal when the app's first
 * cloud call happens (background startup check / heartbeat), signal comes back 20 s later.  Still broken?
 * OLD=1 -> v1163 snapshot. */
import * as L from './lib.mjs';
const { H } = L;
let vendorReq = 0;
const srv = await L.serve(L.ROOTSEL, (req, res, u) => { if (/vendor_cloudbase_esm_v965\.js$/.test(u.pathname)) vendorReq++; return false; });
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const o = { ver: L.VER };
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', ready: L.PK_READY });
  const lg = await H.loginPhone(ph, '13800000751');
  o.login = lg.ok;
  await H.sleep(61000);
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(L.PK_READY, null, { timeout: 45000 });
  const v0 = vendorReq;
  await ph.ctx.setOffline(true);            // no signal
  emu.setOffline(true);
  /* no kid action: wait for the app's own background cloud work */
  await H.sleep(12000);
  o.whileOffline = await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 90) }; });
  await ph.ctx.setOffline(false);           // signal is back
  emu.setOffline(false);
  await H.sleep(20000);
  o.onlineAgain = [];
  for (let i = 0; i < 3; i++) { o.onlineAgain.push(await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 90) }; })); await H.sleep(2000); }
  o.vendorReqSinceReload = vendorReq - v0;
  o.trace = (await ph.eval(() => HansenAuth._trace())).split('\n').filter((l) => /结论|没准备好/.test(l)).slice(0, 4);
} catch (e) { o.thrown = String(e && e.stack || e).slice(0, 900); }
L.out(o);
await browser.close(); srv.close(); process.exit(0);
