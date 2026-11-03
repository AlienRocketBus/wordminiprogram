import { launch, sleep, BASE, O } from './lib.mjs';
import fs from 'node:fs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
page.on('dialog', d => d.dismiss().catch(()=>{}));
await page.goto(BASE + 'island_animal.html'); await sleep(3000);
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) b.click(); }); await sleep(800);
const out = {};
async function tapText(re) { const p = await page.evaluate(src => { const re = new RegExp(src); const el = [...document.querySelectorAll('[onclick], button, a, .d-card, .util-card, .mode-card')].find(e => e.offsetParent && re.test((e.innerText || '').trim())); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, re.source); if (!p) return false; await sleep(300); await page.touchscreen.tap(p.x, p.y); return true; }
// quests
await tapText(/每日任务/); await sleep(1500);
await page.screenshot({ path: `${O}/shots/s19_quests.png` });
out.quests = await page.evaluate(() => { const els = [...document.querySelectorAll('body > *')].filter(e => { const s = getComputedStyle(e); return (s.position === 'fixed') && e.offsetHeight > 400; }); return els.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 1200)).join(' || '); });
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
// settings full
await page.evaluate(() => showScreen('settings')); await sleep(1200);
const H = await page.evaluate(() => document.documentElement.scrollHeight);
out.settingsH = H;
out.settings = await page.evaluate(() => (document.getElementById('settingsScreen') || document.body).innerText.replace(/\s+/g, ' '));
await page.screenshot({ path: `${O}/shots/s19_settings_full.png`, fullPage: true });
// chest
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await tapText(/每日宝箱/); await sleep(2500);
await page.screenshot({ path: `${O}/shots/s19_chest.png` });
// achievements
await page.goto(BASE + 'island_animal.html'); await sleep(2500);
await page.evaluate(() => showScreen('ach')); await sleep(1200);
await page.screenshot({ path: `${O}/shots/s19_ach.png` });
out.ach = await page.evaluate(() => (document.getElementById('achScreen') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 800));
// stats
await page.evaluate(() => showScreen('stats')); await sleep(1200);
await page.screenshot({ path: `${O}/shots/s19_stats.png` });
out.stats = await page.evaluate(() => (document.getElementById('statsScreen') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 1500));
fs.writeFileSync(`${O}/out/s19_panels.json`, JSON.stringify(out, null, 1));
console.log('QUESTS:', out.quests.slice(0, 900)); console.log('SETTINGS H', H, out.settings.length, out.settings.slice(0, 2500)); console.log('ACH:', out.ach.slice(0, 400)); console.log('STATS:', out.stats.slice(0, 900));
await browser.close();
