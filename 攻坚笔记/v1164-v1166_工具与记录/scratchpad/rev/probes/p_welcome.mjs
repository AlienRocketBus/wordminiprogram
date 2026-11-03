// 新孩子进单词大陆②：测试的 openIsland 只在「开始冒险」已经可见时点一次。欢迎弹窗是开机后才出的，会不会晚一步出来挡住？
import { newPage, BASE, done } from './h.mjs';
const out = [];
for (let k = 0; k < 4; k++) {
  const { ctx, page } = await newPage();
  const t0 = Date.now();
  await page.goto(BASE + 'island_land2.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.startBoss === 'function' && typeof window.hansenStartRebattle === 'function' && typeof window.__hansenBossFXReady === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
  const tReady = Date.now() - t0;
  const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) { b.click(); return true; } return false; });
  await page.waitForTimeout(1900);
  const hit = await page.evaluate(() => {
    const el = document.querySelector('.daily-card.boss-card'); if (!el) return 'no card';
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const modal = document.querySelector('#alertModal.show');
    return { onCard: !!h && (h === el || el.contains(h)), hit: h ? (h.id || String(h.className).slice(0, 30) || h.tagName) : null, modalShown: !!modal };
  });
  out.push({ tReady, clickedWelcome: clicked, ...hit });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 0));
await done();
