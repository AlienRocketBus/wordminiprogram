// VC-01 (pink theme home vs island), VC-11 (pink home hero text), VC-14 (12 vs 14 modes), VC-17 (prefetch 404),
// VC-13 (island-en font / overflow at 390), VC-08 (explore highlights wrong tab)
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, served, external, OUT, saveJson } from './lib.mjs';
const out = { notes: [] };
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
try {
  const ctx = await newCtx(browser, { dsf: 2, init: { fn: () => { try { if (!sessionStorage.getItem('__sk_init')) { sessionStorage.setItem('__sk_init', '1'); localStorage.setItem('hansen_onboarded', '1'); localStorage.setItem('theme', 'pink'); } } catch (e) { } } } });
  const page = await ctx.newPage();
  attachLogs(page, 'home', errs);
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(2500);
  out.home = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const q = s => document.querySelector(s);
    const col = el => el ? { color: getComputedStyle(el).color, fill: getComputedStyle(el).webkitTextFillColor, shadow: getComputedStyle(el).textShadow.slice(0, 160), font: getComputedStyle(el).fontFamily.slice(0, 120), text: (el.innerText || '').slice(0, 40) } : null;
    return {
      theme: document.body.dataset.theme, htmlClass: document.documentElement.className,
      bgDeep: cs.getPropertyValue('--th-bg-deep').trim(), bgMid: cs.getPropertyValue('--th-bg-mid').trim(),
      tagline: col(q('.tagline')), subtitle: col(q('.subtitle')), feedbackSub: col(q('.feedback-sub')),
      modesText: Array.from(document.querySelectorAll('body *')).filter(e => e.children.length === 0 && /12\s*(种|学习模式)/.test(e.textContent || '')).map(e => (e.textContent || '').trim().slice(0, 60)),
      stat12: Array.from(document.querySelectorAll('.stat')).map(s => (s.innerText || '').replace(/\s+/g, ' ').slice(0, 30)),
    };
  });
  await page.screenshot({ path: OUT + '/shots/s1_pink_home_top.png' });
  // scroll to feedback area
  await page.evaluate(() => { const e = document.querySelector('.feedback-sub'); if (e) e.scrollIntoView({ block: 'center' }); });
  await sleep(400);
  await page.screenshot({ path: OUT + '/shots/s1_pink_home_feedback.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  // island EN labels font + overflow (390)
  out.islandEn390 = await page.evaluate(() => Array.from(document.querySelectorAll('.island-en')).map(e => ({ t: e.textContent, font: getComputedStyle(e).fontFamily, sw: e.scrollWidth, cw: e.clientWidth, ow: getComputedStyle(e).overflow, ws: getComputedStyle(e).whiteSpace })));
  out.fontsCheck = await page.evaluate(() => ({ bowlby: document.fonts.check('12px "Bowlby One"'), cartoon: document.fonts.check('900 12px "CartoonBlack"'), faces: Array.from(document.fonts).map(f => f.family + ':' + f.status) }));
  // CDP: platform font used for first island-en
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const doc = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: '.island-en' });
  out.platformFonts = [];
  for (const id of nodeIds.slice(0, 3)) { try { const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: id }); out.platformFonts.push(r.fonts); } catch (e) { out.platformFonts.push(String(e)); } }
  // ---- open island the real way ----
  const t = await tapSel(page, page, 'a.island[href="island_animal.html"]');
  out.tapIsland = t;
  const fr = await waitFor(async () => { const f = page.frames().find(f => f.url().includes('island_animal.html')); if (!f) return null; const ok = await f.evaluate(() => document.readyState !== 'loading').catch(() => false); return ok ? f : null; }, 15000);
  await sleep(2500);
  const frame = page.frames().find(f => f.url().includes('island_animal.html'));
  attachLogs(page, 'island', errs);
  out.welcome = await frame.evaluate(() => { const m = document.getElementById('alertModal'); return { shown: m && m.classList.contains('show'), text: m ? (m.innerText || '').replace(/\n+/g, ' | ').slice(0, 400) : null }; });
  out.modeCards = await frame.evaluate(() => ({ n: document.querySelectorAll('.mode-card').length, labels: Array.from(document.querySelectorAll('.mode-card')).map(c => (c.innerText || '').replace(/\s+/g, ' ').slice(0, 20)) }));
  await page.screenshot({ path: OUT + '/shots/s1_pink_island_welcome.png' });
  const w = await tapText(page, frame, '#alertModal button', '开始冒险');
  out.tapWelcome = w;
  await sleep(800);
  out.island = await frame.evaluate(() => { const cs = getComputedStyle(document.body); return { theme: document.body.dataset.theme, htmlClass: document.documentElement.className, bgDeep: cs.getPropertyValue('--th-bg-deep').trim(), bgMid: cs.getPropertyValue('--th-bg-mid').trim(), bgImg: cs.backgroundImage.slice(0, 300) }; });
  await page.screenshot({ path: OUT + '/shots/s1_pink_island_top.png' });
  // VC-08: tap 探索单词 mode card and check active nav
  const ex = await tapText(page, frame, '.mode-card', '探索单词');
  out.tapExplore = ex;
  await sleep(1200);
  out.navAfterExplore = await frame.evaluate(() => ({ active: Array.from(document.querySelectorAll('.bottom-nav .active, .bottom-nav [class*="active"]')).map(e => (e.id || '') + ':' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 12)), navItems: Array.from(document.querySelectorAll('.bottom-nav > *')).map(e => (e.id || '') + ':' + e.className + ':' + (e.innerText || '').replace(/\s+/g, ' ').slice(0, 12)), screen: Array.from(document.querySelectorAll('.screen.active')).map(s => s.id) }));
  await page.screenshot({ path: OUT + '/shots/s1_pink_explore.png' });
  // go home via world map button
  const back = await tapSel(page, frame, '.back-btn');
  await sleep(600);
  out.backFromExplore = back;
  const gh = await tapSel(page, frame, '.world-map-btn');
  out.tapHome = gh;
  await sleep(1500);
  out.homeVisible = await page.evaluate(() => document.getElementById('islandFrameWrap').style.display);
  // VC-17: reload home after visiting an island, record 404s
  served.length = 0;
  await page.reload({ waitUntil: 'load' });
  await sleep(7000);
  out.after_reload_404 = served.filter(s => s.code === 404).map(s => s.p);
  out.prefetched = await page.evaluate(() => (window.HansenIslandPrefetch ? HansenIslandPrefetch.prefetched() : null));
  out.lsIslandKeys = await page.evaluate(() => { const o = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^wordIsland|^lastIsland/.test(k)) o.push(k); } return o; });
  await page.close();
  await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs; out.external = external.slice(0, 30);
saveJson('s1_home_island.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1).slice(0, 9000));
