/* X4: the SDK file (vendor_cloudbase_esm_v965.js, ~548 KB) fails to download once (flaky 4G).
 * Is the failure cached by the browser's module map so that every later ensureSession / "再试一次"
 * keeps failing until the page is reloaded?  Real pages, real SDK. */
import * as H from './h2.mjs';

const srv = await H.startStaticAt(H.REPO);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 20 } });
const out = {};
try {
  /* phone already logged in (marker + creds) from an earlier visit */
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'p' });
  const lg = await H.loginPhone(ph, '13800000501');
  out.login = lg.ok;
  /* now: reload, but the SDK file download fails the first time only */
  let blocked = 0;
  await ph.ctx.route(/vendor_cloudbase_esm_v965\.js/, (r) => { if (blocked < 1) { blocked++; return r.abort('connectionreset'); } return r.continue(); });
  await ph.page.reload({ waitUntil: 'domcontentloaded' });
  await ph.page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom), null, { timeout: 45000 });
  await H.sleep(500);
  const calls = [];
  for (let i = 0; i < 4; i++) {
    calls.push(await ph.eval(async () => { const s = await HansenAuth.ensureSession(); return { ok: s.ok, kind: s.kind, reason: String(s.reason || '').slice(0, 90) }; }));
    await H.sleep(1500);
  }
  out.blockedRequests = blocked;
  out.calls = calls;
  out.sdkFetchesAfterFirst = 'see calls';
  /* what the ladder shows */
  await ph.tap('#pkLadder'); await H.answerNameIfAsked(ph, '小蜂');
  await ph.tap('#ldGo').catch(() => {});
  const t0 = Date.now(); let txt = '';
  while (Date.now() - t0 < 45000) { txt = await ph.screen(); if (/连不上网络|云端还没连上|这次没成功|云端设置/.test(txt)) break; await H.sleep(500); }
  out.ladderScreen = txt.replace(/\s+/g, ' ').slice(0, 220);
  out.secs = Math.round((Date.now() - t0) / 1000);
  /* tap 再试一次 / 重新找对手 */
  await ph.tap('#ldRetry').catch((e) => { out.retryTapErr = e.message.slice(0, 100); });
  const t1 = Date.now(); let txt2 = '';
  while (Date.now() - t1 < 45000) { txt2 = await ph.screen(); if (/连不上网络|云端还没连上|这次没成功|云端设置/.test(txt2) && Date.now() - t1 > 3000) break; if (/等对手|正在找|已等/.test(txt2) && Date.now() - t1 > 8000) break; await H.sleep(500); }
  out.afterRetry = txt2.replace(/\s+/g, ' ').slice(0, 220);
  out.errors = ph.errors.slice(0, 4);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close();
process.exit(0);
