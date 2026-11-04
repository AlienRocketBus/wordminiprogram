import { launch, throttle, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => {
  const _A = window.Audio; window.__firstAudio = null;
  window.Audio = function (u) { const a = new _A(u); const p = a.play.bind(a); a.play = function () { if (!window.__firstAudio && /words\//.test(String(u))) window.__firstAudio = { t: performance.timeOrigin + performance.now(), u: String(u) }; return p(); }; return a; };
}});
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await throttle(page);
const log = []; let taps = 0, waitSys = 0;
const T0 = Date.now();
const mark = (s) => log.push([((Date.now() - T0) / 1000).toFixed(1), s]);
async function waitFor(fnOrFrame, pred, label, timeout = 20000) { const t = Date.now(); while (Date.now() - t < timeout) { try { const ok = await (typeof fnOrFrame === 'function' ? fnOrFrame() : fnOrFrame).evaluate(pred); if (ok) { waitSys += Date.now() - t; mark('ready: ' + label + ' (' + (Date.now() - t) + 'ms)'); return true; } } catch (e) {} await sleep(100); } mark('TIMEOUT ' + label); return false; }
async function tapEl(frame, sel, re, label) { const p = await frame.evaluate(([sel, re]) => { const el = [...document.querySelectorAll(sel)].find(e => e.offsetParent && new RegExp(re).test((e.innerText || '').trim())); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, [sel, re]); if (!p) { mark('NOT FOUND ' + label); return false; } let ox = 0, oy = 0; if (frame !== page.mainFrame()) { const b = await page.evaluate(() => { const r = document.getElementById('islandFrame').getBoundingClientRect(); return { x: r.x, y: r.y }; }); ox = b.x; oy = b.y; } await sleep(250); await page.touchscreen.tap(p.x + ox, p.y + oy); taps++; mark('tap: ' + label); return true; }
page.goto(BASE + 'index.html').catch(() => {});
await waitFor(page, () => !!document.getElementById('__hsOnbTitle'), 'onboarding visible');
for (let i = 0; i < 3; i++) { await sleep(1500); await tapEl(page.mainFrame(), '[role=dialog] button', '下一步|开始冒险', 'onboarding ' + (i + 1)); await sleep(400); }
await sleep(1000);
// scroll to first island (kid swipes)
await page.evaluate(() => window.scrollBy(0, 600)); mark('swipe'); await sleep(800);
await tapEl(page.mainFrame(), 'a.island', '动物大冒险', 'animal island');
const fr = () => page.frames().find(f => f.url().includes('island_animal'));
await waitFor(() => fr() || page, () => !!(document.getElementById('alertModal') && document.getElementById('alertModal').classList.contains('show')), 'island welcome');
await sleep(1500);
await tapEl(fr(), 'button', '开始冒险', 'welcome 开始冒险');
await sleep(800);
await tapEl(fr(), '.mode-card', '听音辨义', 'listen card');
await waitFor(fr, () => /初级/.test(document.getElementById('listenContent').innerText), 'difficulty list');
await sleep(800);
await tapEl(fr(), '#listenContent [onclick]', '初级', 'easy');
await waitFor(fr, () => !!window.__firstAudio, 'first word audio playing');
const total = ((Date.now() - T0) / 1000).toFixed(1);
mark('DONE');
console.log(log.map(l => l.join('s  ')).join('\n'));
console.log({ totalSec: total, taps, systemWaitSec: (waitSys / 1000).toFixed(1) });
fs.writeFileSync(`${O}/out/s26_first_fun.json`, JSON.stringify({ log, total, taps, waitSys }, null, 1));
await page.screenshot({ path: `${O}/shots/s26_first_question.png` });
await browser.close();
