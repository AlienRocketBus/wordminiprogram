/* v932: 抓【谁在页面加载时创建 AudioContext】—— 单次创建在中端手机上要 300ms 主线程 */
import { chromium } from './playwright_loader.mjs';
const ISLAND = process.argv[2] || 'island_land1.html';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
    // 在【所有脚本之前】拦住原生构造器, 记录每次创建的调用栈
    window.__ACLOG = [];
    const Orig = window.AudioContext || window.webkitAudioContext;
    if (Orig) {
      const Traced = function () {
        const t0 = performance.now();
        const stack = (new Error()).stack || '';
        const ctx = arguments.length ? new Orig(arguments[0]) : new Orig();
        const cost = performance.now() - t0;
        window.__ACLOG.push({
          at: Math.round(performance.now()),
          cost: Math.round(cost),
          stack: stack.split('\n').slice(1, 6).map(s => s.trim()).join(' ← ')
        });
        return ctx;
      };
      Traced.prototype = Orig.prototype;
      try { window.AudioContext = Traced; } catch (e) { }
      try { window.webkitAudioContext = Traced; } catch (e) { }
    }
  });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  await p.goto(`http://localhost:8877/${ISLAND}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(5000);
  const log = await p.evaluate(() => window.__ACLOG || []);

  console.log(`  ══ ${ISLAND} · 【没有任何用户点击】的情况下, AudioContext 被创建了 ${log.length} 次 ══\n`);
  if (!log.length) console.log('  ✅ 加载阶段一个都没建(全部懒建, 正确)');
  log.forEach((x, i) => {
    console.log(`  #${i + 1}  在 ${x.at}ms 创建 · 耗时 ${x.cost}ms`);
    console.log(`      调用栈: ${x.stack.slice(0, 190)}`);
  });
  const total = log.reduce((a, x) => a + x.cost, 0);
  if (log.length) console.log(`\n  ⛔ 加载阶段白白花掉 ${total}ms 主线程`);
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
