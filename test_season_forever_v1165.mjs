/* test_season_forever_v1165.mjs —— 「✦番外篇 EXTRA」入口永远在（单词大陆 8 岛 + 星海终战的唯一首页入口）
 *
 * 事故（v1163 审计 CB-09）：S1 赛季配置 end:'2026-12-31'。到了 2027-01-01，HansenSeason.current() 变成 null，
 *   首页 buildProgressBar 直接 return —— 番外篇横幅消失，而它是首页通往 land_map / 单词大陆 8 岛 / 星海终战的唯一入口；
 *   赛季面板会说「秘境即将开启，敬请期待！」，神秘殿堂会把 S1 限定卡标成「已绝版 · 错过」。
 *
 * 合同（真浏览器，page.clock，Asia/Shanghai）：在 2026-11-03 / 2026-12-31 23:30 / 2027-01-01 09:00 / 2030-06-01：
 *   1. 首页有 #hsnSeasonBar，文字含「✦ 番外篇 EXTRA」
 *   2. 手指真点横幅 → #islandFrame 打开 land_map.html
 *   3. 赛季面板不说「敬请期待」，不出现负数天 / 「还剩 0 天」；赛季已过 end 就不显示倒计时
 *   4. 没有限定卡的孩子：神秘殿堂不把 S1 标成「已绝版」，pastSeasons() 不列当前在用的 S1
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

const WHEN = [
  ['2026-11-03T10:00:00+08:00', false],
  ['2026-12-31T23:30:00+08:00', false],
  ['2027-01-01T09:00:00+08:00', true],
  ['2030-06-01T10:00:00+08:00', true],
];

try {
  for (const [when, pastEnd] of WHEN) {
    console.log(`\n▶ 手机时间 ${when}`);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      serviceWorkers: 'block', timezoneId: 'Asia/Shanghai', locale: 'zh-CN' });
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(() => {
      try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {}
    });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.clock.install({ time: new Date(when) });
    await page.goto(BASE + 'index.html', { waitUntil: 'domcontentloaded' });
    let barOk = true;
    try { await page.waitForSelector('#hsnSeasonBar', { timeout: 12000 }); } catch (e) { barOk = false; }
    const text = barOk ? (await page.$eval('#hsnSeasonBar', el => el.innerText.replace(/\s+/g, ' '))) : '';
    ok(barOk && text.includes('✦ 番外篇 EXTRA'), `首页有番外篇横幅（${text.slice(0, 40) || '没有'}）`);
    const cur = await page.evaluate(() => window.HansenSeason && HansenSeason.current ? (HansenSeason.current() || {}).id || null : 'n/a');
    ok(cur === 'S1', `HansenSeason.current() 仍是 S1（实得 ${cur}）`);

    /* 手指真点：先滚到可见，确认点到的就是横幅本身，再用触屏点 */
    if (barOk) {
      const hit = await page.evaluate(async () => {
        const el = document.getElementById('hsnSeasonBar');
        el.scrollIntoView({ block: 'center' });
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b = el.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
        const h = document.elementFromPoint(x, y);
        return { x, y, ok: !!h && (h === el || el.contains(h)), who: h ? (h.id || h.className || h.tagName) : null };
      });
      ok(hit.ok, `横幅没被别的东西挡住（点到 ${hit.who}）`);
      await page.touchscreen.tap(hit.x, hit.y);
      let opened = false;
      try {
        await page.waitForFunction(() => {
          const w = document.getElementById('islandFrameWrap'), f = document.getElementById('islandFrame');
          let p = ''; try { p = f.contentWindow.location.pathname; } catch (e) {}
          return w && w.style.display !== 'none' && /\/land_map\.html$/.test(p);
        }, null, { timeout: 15000 });
        opened = true;
      } catch (e) {}
      ok(opened, '点横幅 → 单词大陆地图在首页外壳里打开');
      await page.evaluate(() => { try { window.closeIsland(); } catch (e) {} });
      await page.waitForTimeout(400);
    }

    const panel = await page.evaluate(() => {
      try { window.__hsnOpenSeason(); } catch (e) { return { err: String(e) }; }
      const m = document.getElementById('__hs_season_panel');
      const t = m ? m.innerText.replace(/\s+/g, ' ') : '';
      if (m) m.remove();
      return { t };
    });
    ok(panel.t && !/敬请期待/.test(panel.t), '赛季面板不说「敬请期待」');
    ok(!/还剩\s*-/.test(panel.t) && !/还剩\s*0\s*天/.test(panel.t), '赛季面板没有负数天 / 「还剩 0 天」');
    if (pastEnd) ok(!/还剩/.test(panel.t), '过了赛季结束日：面板不再显示倒计时');
    else ok(/还剩\s*[1-9]\d*\s*天/.test(panel.t), '赛季期内：面板照常显示剩余天数');
    ok(/星海学习岛/.test(panel.t), '面板里仍有「星海学习岛」入口');

    const hall = await page.evaluate(() => {
      try { window.__hsnOpenHall(); } catch (e) { return { err: String(e) }; }
      const m = document.getElementById('__hs_hall_panel');
      const t = m ? m.innerText.replace(/\s+/g, ' ') : '';
      if (m) m.remove();
      const past = (window.HansenSeason.pastSeasons() || []).map(s => s.id);
      return { t, past };
    });
    ok(hall.t && !/已绝版/.test(hall.t), '没有限定卡的孩子：神秘殿堂不把 S1 标成「已绝版 · 错过」');
    ok(Array.isArray(hall.past) && !hall.past.includes('S1'), `pastSeasons() 不列当前在用的 S1（${JSON.stringify(hall.past)}）`);
    ok(errs.length === 0, `页面无报错 ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.close();
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 番外篇入口永远在');
process.exit(fails ? 1 : 0);
