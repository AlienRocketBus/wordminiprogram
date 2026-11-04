/* X8: the real tap path a kid takes: home (index.html) -> island -> 拼写大PK -> 🏆 天梯 -> 「排位要先登录」 -> 去登录
 * -> phone + code -> 登录.  What is on screen right after the login succeeds?  OLD=1 -> v1163. */
import * as H from './h2.mjs';
const ROOT = process.env.OLD ? H.V1163 : H.REPO;
const srv = await H.startStaticAt(ROOT);
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { latencyMs: 30 } });
const out = { root: ROOT.slice(-20) };
const clickIn = (fr, sel) => fr.evaluate((s) => { const e = document.querySelector(s); if (!e) return 'missing ' + s; e.click(); return 'ok'; }, sel);
try {
  const ph = await H.openPhone(browser, emu, srv.origin, { name: 'kid', path: '/index.html', ready: () => !!(window.HansenAuth && window.openIsland) });
  await ph.eval(() => window.openIsland('island_animal.html'));
  const fr = await H.until(async () => ph.page.frames().find((f) => /island_animal\.html/.test(f.url())), { timeout: 20000 });
  await fr.waitForFunction(() => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI && window.HansenAuthUI), null, { timeout: 45000 });
  await H.sleep(1200);
  out.openPK = await fr.evaluate(() => { try { window.openSpellPK(); return 'ok'; } catch (e) { return String(e.message); } });
  await H.sleep(800);
  out.tapLadder = await clickIn(fr, '#kLadder');
  await H.sleep(1500);
  out.ladderText = (await fr.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').match(/排位要先登录|去登录|天梯排位[^。]{0,30}/g);
  out.tapStart = await clickIn(fr, '#ldGo');
  await H.sleep(1500);
  out.tapGoLogin = await clickIn(fr, '#ldGoLogin');
  await H.sleep(800);
  /* fill the login panel inside the island */
  await fr.fill('#auPhone', '13800000901');
  out.tapSend = await clickIn(fr, '#auSend');
  await H.sleep(1500);
  await fr.fill('#auCode', '123456');
  out.tapGo = await clickIn(fr, '#auGo');
  await H.sleep(4000);
  out.panelMsg = await fr.evaluate(() => ((document.getElementById('auMsg') || {}).innerText || '').trim());
  out.topOverlay = await ph.eval(() => { const d = document.getElementById('hsnTabStale'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 90) : null; });
  out.whatKidSees = (await ph.screen()).replace(/\s+/g, ' ').slice(0, 160);
} catch (e) { out.thrown = String(e && e.stack || e).slice(0, 800); }
console.log(JSON.stringify(out, null, 2));
await browser.close(); srv.close(); process.exit(0);
