// S4: does the home card 「最近探险的岛屿 · 点击继续」 point at the island the child really played?
// Flow A (PLAY=1): food -> a real answer is simulated by calling the island's own save() after the warm frames
//   have loaded (t=14s) -> 🏠 -> read card -> animal -> save() at t=14s -> 🏠 -> wait 12s -> read card -> tap card -> which island opens?
// Flow B (PLAY=0): same without save() calls.
import fs from 'node:fs';
import { startServer, log } from './srv.mjs';
import { launch, newCtx, realTap } from './lib.mjs';

const W = +(process.env.W || 390);
const PLAY = process.env.PLAY !== '0';
const MODE = process.env.MODE || 'asis';
const A = "if (document.readyState === 'complete') scheduleWarm();\n  else window.addEventListener('load', scheduleWarm);";
const patch = {};
if (MODE === 'nowarm') patch['/hansen_room_warm_v1023.js'] = s => { if (!s.includes(A)) throw new Error('anchor'); return s.replace(A, '/* off */'); };
const { srv, port } = await startServer({ patch });
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const ctx = await newCtx(browser, W);
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const sk = page.locator('#__hsOnbSkip'); if (await sk.count()) await realTap(page, sk.first(), 'skip');
await page.waitForTimeout(1500);
const card = () => page.evaluate(() => { const el = document.getElementById('recentLearnStat'); return el ? el.innerText.replace(/\s+/g, ' ').trim() + ' => ' + (el._target || null) : null; });
const times = () => page.evaluate(() => { const o = {}; for (const k of ['wordIslandFood', 'wordIslandAnimal', 'wordIslandSeason']) { try { const d = JSON.parse(localStorage.getItem(k) || 'null'); o[k] = d ? d.lastSaveTime : null; } catch (e) { o[k] = 'ERR'; } } o.lastIslandTime = +localStorage.getItem('lastIslandTime'); o.lastIslandKey = localStorage.getItem('lastIslandKey'); return o; });
const res = { W, PLAY, MODE, steps: [] };
for (const isl of ['island_food.html', 'island_animal.html']) {
  await realTap(page, page.locator(`a.island[href="${isl}"]`).first(), isl);
  await page.waitForTimeout(14000);
  const fr = page.frames().find(f => f.parentFrame() === page.mainFrame());
  try { const b = fr.locator('#alertModal.show button:has-text("开始冒险")'); if (await b.count()) { await realTap(page, b.first(), 'welcome'); await page.waitForTimeout(500); } } catch (e) {}
  if (PLAY) await fr.evaluate(() => { try { return save(); } catch (e) { return 'ERR ' + e; } });
  await page.waitForTimeout(800);
  await realTap(page, fr.locator('a.world-map-btn').first(), 'home');
  await page.waitForTimeout(12000);
  res.steps.push({ after: isl, iframe: await page.evaluate(() => { try { return document.getElementById('islandFrame').contentWindow.location.pathname; } catch (e) { return 'ERR'; } }), card: await card(), times: await times() });
  console.log(JSON.stringify(res.steps[res.steps.length - 1]));
}
// tap the 「最近探险」 card like a child would
const rc = page.locator('#recentLearnStat');
res.cardTap = await realTap(page, rc.first(), 'recent');
await page.waitForTimeout(6000);
res.openedAfterCardTap = await page.evaluate(() => { try { const fr = document.getElementById('islandFrame'); return { wrap: document.getElementById('islandFrameWrap').style.display, path: fr.contentWindow.location.pathname, title: fr.contentDocument.title }; } catch (e) { return 'ERR ' + e; } });
console.log('cardTap', JSON.stringify(res.cardTap), 'opened', JSON.stringify(res.openedAfterCardTap));
await page.screenshot({ path: `shots/s4_after_card_${MODE}_${PLAY ? 'play' : 'noplay'}.png` });
fs.writeFileSync(`s4_recent_${MODE}_${PLAY ? 'play' : 'noplay'}.json`, JSON.stringify(res, null, 1));
await browser.close(); srv.close();
