import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const [PORT, OUT] = process.argv.slice(2);
const BASE = `http://127.0.0.1:${PORT}`;
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.50(0x1800322d) NetType/WIFI Language/zh_CN';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const res = {};
for (const url of ['/index.html', '/island_food.html', '/island_land1.html', '/spelling_bee.html', '/boss_hall.html', '/land_map.html', '/spelling_pk.html', '/season_showcase.html']) {
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block' });
  await c.route('**/*', r => r.request().url().startsWith(BASE) || r.request().url().startsWith('data:') ? r.continue() : r.abort());
  const p = await c.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await p.goto(BASE + url, { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(6000);
  res[url] = await p.evaluate(() => {
    const all = document.getElementsByTagName('*');
    let svg = 0, styleTags = document.querySelectorAll('style').length, fixed = 0, anims = 0;
    for (const el of all) { if (el.namespaceURI === 'http://www.w3.org/2000/svg') svg++; }
    try { anims = document.getAnimations().length; } catch (e) {}
    const globals = Object.keys(window).length;
    return { dom_nodes: all.length, svg_nodes: svg, style_tags: styleTags, running_animations: anims, window_own_keys: globals, iframes: document.querySelectorAll('iframe').length };
  });
  res[url].page_errors = errs.slice(0, 5);
  await c.close();
}
await b.close();
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
