// S5: returning player (played colour, action, home, food; last island = colour) opens index.html.
// Which island HTML does the home page prefetch, and do any of those requests 404?
import fs from 'node:fs';
import { startServer, log } from './srv.mjs';
import { launch, newCtx } from './lib.mjs';

const W = +(process.env.W || 390);
const { srv, port } = await startServer();
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await launch();
const ctx = await newCtx(browser, W);
const now = Date.now();
await ctx.addInitScript(([now]) => {
  if (window.top !== window || localStorage.getItem('__seeded')) return;
  const mk = (t) => JSON.stringify({ xp: 10, level: 1, learned: ['a'], totalAnswers: 5, totalCorrect: 4, bossWon: [], lastSaveTime: t });
  localStorage.setItem('wordIslandColorNum', mk(now - 1000));
  localStorage.setItem('wordIslandVerbs', mk(now - 50000));
  localStorage.setItem('wordIslandHouse', mk(now - 90000));
  localStorage.setItem('wordIslandFood', mk(now - 120000));
  localStorage.setItem('lastIslandKey', 'wordIslandColorNum');
  localStorage.setItem('lastIslandTime', String(now - 1000));
  localStorage.setItem('hansen_onboarding_done', '1');
  localStorage.setItem('__seeded', '1');
}, [now]);
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.goto(`${ORIGIN}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(10000);
const isl = log.filter(e => /^\/island_|^\/land_map/.test(e.p)).map(e => `${e.p}${e.q} ${e.st} dest=${e.dest} purpose=${e.purpose}`);
const n404 = log.filter(e => e.st === 404).map(e => e.p + e.q);
const prefetched = await page.evaluate(() => window.HansenIslandPrefetch ? HansenIslandPrefetch.prefetched() : null);
const links = await page.evaluate(() => [...document.querySelectorAll('link[rel=prefetch]')].map(l => l.getAttribute('href') + ' why=' + l.getAttribute('data-why')));
const card = await page.evaluate(() => { const el = document.getElementById('recentLearnStat'); return el ? el.innerText.replace(/\s+/g, ' ').trim() + ' => ' + el._target : null; });
const out = { isl, n404, prefetched, links, card };
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('s5_returning.json', JSON.stringify(out, null, 1));
await browser.close(); srv.close();
