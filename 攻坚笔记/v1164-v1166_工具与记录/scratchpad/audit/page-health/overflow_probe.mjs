// For pages with scrollWidth > innerWidth: find the elements that stick out and test whether the page really pans sideways.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { startServer } from './server.mjs';
const pages = process.argv.slice(2);
const { srv, port } = await startServer();
const ORIGIN = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ args: ['--no-sandbox'] });
for (const spec of pages) {
  const [pg, w] = spec.split('@'); const W = +(w || 390);
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', r => r.request().url().startsWith(ORIGIN) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(`${ORIGIN}/${pg}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const res = await page.evaluate((VW) => {
    const W = VW, se = document.scrollingElement;
    const rows = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.right <= W + 0.5) continue;
      const cs = getComputedStyle(el);
      rows.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''), left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), w: Math.round(r.width), pos: cs.position, vis: cs.visibility, op: cs.opacity, disp: cs.display, anim: cs.animationName, tf: cs.transform.slice(0, 40), text: (el.innerText || '').trim().slice(0, 30) });
    }
    rows.sort((a, b) => b.right - a.right);
    const before = scrollX; window.scrollTo(200, scrollY); const after = scrollX; window.scrollTo(0, scrollY);
    return { W, innerW: innerWidth, vvScale: visualViewport && visualViewport.scale, vvW: visualViewport && visualViewport.width, vp: (document.querySelector('meta[name=viewport]')||{}).content, sw: se.scrollWidth, htmlOX: getComputedStyle(document.documentElement).overflowX, bodyOX: getComputedStyle(document.body).overflowX, scrollXAfterScrollTo200: after, rows: rows.slice(0, 15) };
  }, W);
  // touch pan sideways
  await page.touchscreen.tap(5, 5).catch(() => {});
  let panX = null;
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(W * 0.7), y: 400, xDistance: -150, yDistance: 0, gestureSourceType: 'touch', speed: 800 });
    await page.waitForTimeout(400);
    panX = await page.evaluate(() => scrollX);
  } catch (e) { panX = 'err ' + String(e).slice(0, 80); }
  res.scrollXAfterTouchSwipe = panX;
  await page.screenshot({ path: `shots/ovf_${pg.replace(/\//g, '__')}_${W}.png` });
  console.log(pg, W, JSON.stringify(res, null, 0).slice(0, 3000));
  await ctx.close();
}
await browser.close(); srv.close();
