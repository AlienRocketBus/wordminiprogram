// Extra: "已点亮 N/19" for a one-island user; back/close control touch-target sizes; gacha toast overlap with 抽一张 (VC-06)
import { startServer, launch, newCtx, attachLogs, sleep, waitFor, tapSel, tapText, external, OUT, saveJson } from './lib.mjs';
const out = {};
const errs = [];
const { srv, base } = await startServer();
const browser = await launch();
const ISL = 'island_animal.html';
async function openIsland(page) {
  await page.goto('about:blank');
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await sleep(1800);
  const t = await tapSel(page, page, `a.island[href="${ISL}"]`);
  if (!t.tapped) throw new Error('island tap failed ' + JSON.stringify(t));
  await waitFor(async () => { const f = page.frames().find(f => f.url().includes(ISL)); if (!f) return null; return await f.evaluate(() => document.readyState === 'complete').catch(() => false); }, 15000);
  await sleep(2200);
  const frame = page.frames().find(f => f.url().includes(ISL));
  const shown = await frame.evaluate(() => { const m = document.getElementById('alertModal'); return !!(m && m.classList.contains('show')); });
  if (shown) { await tapText(page, frame, '#alertModal button', '开始冒险'); await sleep(700); }
  return frame;
}
const box = (frame, sel) => frame.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(e => e.getBoundingClientRect().width > 0).slice(0, 3).map(e => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.textContent || '').trim().slice(0, 8), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }), sel);
try {
  const ctx = await newCtx(browser, { dsf: 1, init: { fn: () => { try { localStorage.setItem('hansen_onboarded', '1'); } catch (e) { } } } });
  const page = await ctx.newPage(); attachLogs(page, 'p', errs);
  let frame = await openIsland(page);
  // 1. 我的学习 for a one-island user
  await tapText(page, frame, '.util-card', '我的学习'); await sleep(1300);
  out.mylearn = await frame.evaluate(() => { const el = document.getElementById('hsn-ml'); const t = el ? el.innerText : ''; const m = t.match(/已点亮\s*(\d+)\s*\/\s*(\d+)/); const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.indexOf('hsn_progress:') === 0) keys.push(k); } return { lit: m ? m[0] : null, keys }; });
  out.backML = await box(frame, '#hsn-ml button, #hsn-ml [onclick]');
  // 2. 复习中心 back
  frame = await openIsland(page);
  await tapSel(page, frame, '#navReview'); await sleep(1300);
  out.backReview = await box(frame, '#hr_center button');
  // 3. 错题 back
  frame = await openIsland(page);
  await tapSel(page, frame, '#navExplore'); await sleep(1200);
  out.backWrong = await box(frame, '#hwo_overlay .hwo_back');
  // 4. 神秘殿堂 close ×
  frame = await openIsland(page);
  await tapSel(page, frame, '#navCards'); await sleep(1300);
  await tapText(page, frame, 'button, div[onclick], a, [role="button"]', '神秘殿堂'); await sleep(1300);
  out.closeHall = await box(frame, '#__hs_hall_close');
  // 5. Boss select back
  frame = await openIsland(page);
  await tapText(page, frame, '.daily-card', '挑战'); await sleep(2200);
  out.backBoss = await frame.evaluate(() => Array.from(document.querySelectorAll('#bossScreen button, #bossScreen [onclick]')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.top < 120 && /←|返回|‹/.test(e.innerText || e.textContent || ''); }).map(e => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.textContent).trim().slice(0, 6), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }));
  out.backBtnIsland = await box(frame, '.back-btn');
  // 6. gacha toast vs 抽一张
  frame = await openIsland(page);
  await tapText(page, frame, '.mode-card', '抽卡'); await sleep(1500);
  const btn = await frame.evaluate(() => { const b = Array.from(document.querySelectorAll('#gachaScreen button, #gachaScreen [onclick]')).find(e => /抽一张/.test(e.innerText || '')); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, t: b.innerText.replace(/\s+/g, ' ') }; });
  await sleep(300);
  const tp = await tapText(page, frame, '#gachaScreen button, #gachaScreen [onclick]', '抽一张');
  await sleep(350);
  out.gacha = { btn, tap: tp.tapped, toast: await frame.evaluate(() => { const t = document.querySelector('.gacha-toast'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.innerText, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }), btnNow: await frame.evaluate(() => { const b = Array.from(document.querySelectorAll('#gachaScreen button, #gachaScreen [onclick]')).find(e => /抽一张/.test(e.innerText || '')); const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }) };
  await page.screenshot({ path: OUT + '/shots/s6_gacha_toast.png' });
  await page.close(); await ctx.close();
} catch (e) { out.fatal = String(e && e.stack || e); }
out.errs = errs.slice(0, 20); out.external = external.slice(0, 20);
saveJson('s6_targets.json', out);
await browser.close(); srv.close();
console.log(JSON.stringify(out, null, 1).slice(0, 6000));
