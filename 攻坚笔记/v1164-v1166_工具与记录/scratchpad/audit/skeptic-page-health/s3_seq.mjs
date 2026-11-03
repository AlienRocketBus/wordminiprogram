// S3: home -> food -> 🏠 -> animal -> 🏠 -> sports -> 🏠 -> animal -> 🏠 (real taps on cards and on the island 🏠 button)
// After every 🏠: which document is in the hidden iframe, which island HTML the server served since that tap,
// what the home "最近探险的岛屿" card says, plus unhandled rejections / page errors per step.
import fs from 'node:fs';
import { startServer, log } from './srv.mjs';
import { launch, newCtx, realTap } from './lib.mjs';

const W = +(process.env.W || 390);
const SETTLE = +(process.env.SETTLE || 9000);
const SEQ = (process.env.SEQ || 'island_food.html,island_animal.html,island_sports.html,island_animal.html').split(',');
const OUT = process.env.OUT || `s3_seq_${W}${process.env.DEFER_PUSH ? '_deferpush' : ''}.json`;
const ANCH = `    if(!fromHistory){
      try{
        if(history.state && history.state.hsnIsland){
          history.replaceState({ hsnIsland:file }, '', location.href);
        } else {
          history.pushState({ hsnIsland:file }, '', location.href);
        }
      }catch(e){}
    }`;
const DEFER = `    if(!fromHistory){
      var __doPush=function(){ try{
        if(history.state && history.state.hsnIsland){ history.replaceState({ hsnIsland:file }, '', location.href); }
        else { history.pushState({ hsnIsland:file }, '', location.href); }
      }catch(e){} };
      var __fr=document.getElementById('islandFrame'), __n=0;
      (function __wait(){ var u=''; try{ u=__fr.contentWindow.location.pathname.split('/').pop(); }catch(e){} if(u===file || __n++>400){ __doPush(); } else { setTimeout(__wait,25); } })();
    }`;
const patch = {};
if (process.env.DEFER_PUSH) patch['/index.html'] = s => { if (!s.includes(ANCH)) throw new Error('index anchor missing'); return s.replace(ANCH, DEFER); };
const { srv, port } = await startServer({ patch });
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const ctx = await newCtx(browser, W);
const page = await ctx.newPage();
const pageerrors = [];
page.on('pageerror', e => pageerrors.push(String(e.message || e).slice(0, 200)));
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const sk = page.locator('#__hsOnbSkip'); if (await sk.count()) await realTap(page, sk.first(), 'skip');
await page.waitForTimeout(1500);
const steps = [];
const iframePath = () => page.evaluate(() => { try { return document.getElementById('islandFrame').contentWindow.location.pathname + document.getElementById('islandFrame').contentWindow.location.search; } catch (e) { return 'ERR ' + e; } });
const recent = () => page.evaluate(() => { const el = document.getElementById('recentLearnStat'); return el ? { text: el.innerText.replace(/\s+/g, ' ').trim(), target: el._target || null } : null; });
const rejAll = async () => { const r = []; for (const f of page.frames()) { try { const x = await f.evaluate(() => (window.__sk && window.__sk.rej) || []); if (x.length) r.push([f.url().replace(ORIGIN, ''), x]); } catch (e) {} } return r; };
for (const isl of SEQ) {
  const st = { isl };
  const i0 = log.length;
  const card = page.locator(`a.island[href="${isl}"]`).first();
  st.tap = await realTap(page, card, isl);
  const tTap = Date.now();
  for (let i = 0; i < 100; i++) { const ok = await page.evaluate(f => { const w = document.getElementById('islandFrameWrap'), fr = document.getElementById('islandFrame'); let p = ''; try { p = fr.contentWindow.location.pathname.split('/').pop(); } catch (e) {} return w.style.display === 'block' && fr.style.opacity === '1' && p === f; }, isl); if (ok) { st.revealMs = Date.now() - tTap; break; } await page.waitForTimeout(100); }
  st.openServed = log.slice(i0).filter(e => /^\/island_|^\/land_map/.test(e.p) && (e.dest === 'iframe')).map(e => `${e.p}${e.q} ${e.st}`);
  st.historyLenAfterOpen = await page.evaluate(() => history.length);
  st.stateAfterOpen = await page.evaluate(() => JSON.stringify(history.state));
  await page.waitForTimeout(SETTLE);
  // tap the real 🏠 button inside the island frame
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
  // close welcome popup if shown, so the 🏠 button is not covered
  try { const b = fr.locator('#alertModal.show button:has-text("开始冒险")'); if (await b.count()) { await realTap(page, b.first(), 'welcome'); await page.waitForTimeout(600); } } catch (e) { st.welcomeErr = String(e).slice(0, 80); }
  const home = fr.locator('a.world-map-btn').first();
  st.homeTap = await realTap(page, home, 'home');
  const i1 = log.length;
  await page.waitForTimeout(4000);
  st.afterHome = {
    wrap: await page.evaluate(() => document.getElementById('islandFrameWrap').style.display),
    iframe: await iframePath(),
    served: log.slice(i1).filter(e => /^\/island_|^\/land_map/.test(e.p)).map(e => `${e.p}${e.q} ${e.st} dest=${e.dest} ref=${(e.ref || '').replace(ORIGIN, '')}`),
    recent: await recent(),
    historyLen: await page.evaluate(() => history.length),
    state: await page.evaluate(() => JSON.stringify(history.state)),
  };
  st.rej = await rejAll();
  steps.push(st);
  console.log(JSON.stringify(st));
}
const out = { W, steps, pageerrors, blackbox: await page.evaluate(() => localStorage.getItem('hansen_blackbox')), silentWatch: await page.evaluate(() => { try { return window.HansenSilentWatch ? HansenSilentWatch.recent() : null; } catch (e) { return String(e); } }) };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('pageerrors', JSON.stringify(pageerrors)); console.log('blackbox', out.blackbox);
await browser.close(); srv.close();
