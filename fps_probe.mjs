/* v932: 测【真实帧率】—— 卡不卡, 帧率说了算 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const PAGE = process.argv[2] || 'index.html';
const CPU = +(process.argv[3] || 4);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
  });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  await p.goto(`http://localhost:8877/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(3000);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  // 静止时的帧率(纯 CSS 动画在跑)
  const idle = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now();
    (function tick() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))); })();
  }));

  // 滚动时的帧率
  const scroll = await p.evaluate(() => new Promise(res => {
    let n = 0; const t0 = performance.now(); let y = 0;
    (function tick() {
      n++; y = (y + 14) % 600; window.scrollTo(0, y);
      if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
      else res(Math.round(n / ((performance.now() - t0) / 1000)));
    })();
  }));

  const stats = await p.evaluate(() => {
    let anims = 0, big = 0;
    document.querySelectorAll('*').forEach(e => {
      const s = getComputedStyle(e);
      if (s.animationName && s.animationName !== 'none' && s.animationIterationCount === 'infinite') anims++;
      const bb = e.getBoundingClientRect();
      if (bb.top > 900 || bb.bottom < -60) { /* 屏外 */ if (s.animationName !== 'none') big++; }
    });
    return { anims, offscreen: big, dom: document.querySelectorAll('*').length };
  });

  const j = (f) => f >= 55 ? '✅ 丝滑' : f >= 45 ? '⚠️ 偶有掉帧' : f >= 30 ? '❌ 明显卡' : '❌❌ 很卡';
  console.log(`  ══ ${PAGE} (CPU×${CPU}) ══`);
  console.log(`  DOM ${stats.dom} · 永不停的 CSS 动画元素 ${stats.anims} 个 (其中屏幕外还在跑的 ${stats.offscreen} 个)`);
  console.log(`  静止帧率: ${idle} fps  ${j(idle)}`);
  console.log(`  滚动帧率: ${scroll} fps  ${j(scroll)}`);
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
