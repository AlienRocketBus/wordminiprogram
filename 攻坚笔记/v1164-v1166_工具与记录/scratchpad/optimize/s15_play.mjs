import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => {
  try { localStorage.setItem('hansen_onboarded','1'); } catch(e){}
  window.__pop = [];
  const t0 = Date.now();
  const obs = new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n.nodeType !== 1) continue; setTimeout(() => { try { const s = getComputedStyle(n); const r = n.getBoundingClientRect(); const txt = (n.innerText || '').trim().replace(/\s+/g, ' '); if ((s.position === 'fixed' || s.position === 'absolute') && txt && r.width > 0 && txt.length < 300) window.__pop.push([Date.now() - t0, txt.slice(0, 90)]); } catch(e){} }, 50); } });
  document.addEventListener('DOMContentLoaded', () => obs.observe(document.body, { childList: true, subtree: false }));
}});
const page = await ctx.newPage();
const dialogs = []; page.on('dialog', d => { dialogs.push(d.message().slice(0, 120)); d.dismiss().catch(()=>{}); });
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(800);
// LISTEN easy round
await page.evaluate(() => startListen()); await sleep(600);
await page.evaluate(() => startListenLevel('easy')); await sleep(1200);
let k = 0, shotWrong = false, shotRight = false;
for (let q = 0; q < 20; q++) {
  const st = await page.evaluate(() => listenActive && listenQ ? { cn: listenQ.word.cn, opts: listenQ.opts.map(o => o.cn) } : null);
  if (!st) break;
  let pick = st.opts.indexOf(st.cn);
  const wrong = (q === 2 || q === 5);
  if (wrong) pick = (pick + 1) % 4;
  await page.evaluate(i => { const o = document.querySelectorAll('#listenScreen .boss-opt'); o[i].click(); }, pick);
  if (wrong && !shotWrong) { await sleep(500); await page.screenshot({ path: `${O}/shots/s15_listen_wrong.png` }); shotWrong = true; }
  if (!wrong && !shotRight && q === 1) { await sleep(700); await page.screenshot({ path: `${O}/shots/s15_listen_right.png` }); shotRight = true; }
  await sleep(wrong ? 2000 : 3200);
}
await sleep(1500);
await page.screenshot({ path: `${O}/shots/s15_listen_result.png` });
const listenPops = await page.evaluate(() => window.__pop.slice());
const resultTxt = await page.evaluate(() => document.getElementById('listenContent').innerText.replace(/\s+/g, ' '));
// MATCH
await page.evaluate(() => { window.__pop.length = 0; startMatch(); }); await sleep(800);
for (let p = 0; p < 8; p++) {
  const pair = await page.evaluate(() => { const done = new Set(); for (let i = 0; i < matchPairs.length; i++) { const el = document.getElementById('mc' + i); if (el.classList.contains('matched')) continue; for (let j = i + 1; j < matchPairs.length; j++) { const e2 = document.getElementById('mc' + j); if (!e2.classList.contains('matched') && matchPairs[i].idx === matchPairs[j].idx) return [i, j]; } } return null; });
  if (!pair) break;
  await page.evaluate(([i, j]) => { matchFlip(i); matchFlip(j); }, pair); await sleep(800);
}
await sleep(1500);
await page.screenshot({ path: `${O}/shots/s15_match_result.png` });
const matchPops = await page.evaluate(() => window.__pop.slice());
const hud = await page.evaluate(() => document.querySelector('.top-bar, header, #topBar') ? (document.querySelector('.top-bar, header, #topBar').innerText || '').replace(/\s+/g, ' ') : document.body.innerText.slice(0, 120).replace(/\s+/g, ' '));
fs.writeFileSync(`${O}/out/s15_play.json`, JSON.stringify({ listenPops, resultTxt, matchPops, hud, dialogs }, null, 1));
console.log('LISTEN result:', resultTxt.slice(0, 400));
console.log('listen pops', listenPops.length, JSON.stringify(listenPops.slice(0, 30)));
console.log('match pops', matchPops.length, JSON.stringify(matchPops.slice(0, 20)));
console.log('hud', hud, 'dialogs', dialogs);
await browser.close();
