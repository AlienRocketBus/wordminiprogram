/* v932: 列出所有脚本的【体积 + 下载/解析时机】, 找出 load 之后那个 1900ms 大块是谁 */
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
  });
  const p = await c.newPage();
  const cdp = await c.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

  const res = [];
  p.on('response', async (r) => {
    const u = r.url();
    if (!/\.(js|json|woff2?|css)(\?|$)/i.test(u)) return;
    let bytes = 0;
    try { bytes = (await r.body()).length; } catch (e) { }
    res.push({ url: u.split('/').pop().split('?')[0], bytes, t: Date.now() });
  });

  const t0 = Date.now();
  await p.goto(`http://localhost:8877/${ISLAND}`, { waitUntil: 'load', timeout: 60000 });
  const loadAt = Date.now() - t0;
  await p.waitForTimeout(6000);

  const after = res.filter(r => (r.t - t0) > loadAt).map(r => ({ ...r, rel: r.t - t0 }));

  console.log(`  ══ ${ISLAND} (CPU×4) · load 事件在 ${loadAt}ms ══\n`);
  console.log('  【体积最大的资源】(解析成本 ≈ 体积):');
  res.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 12).forEach(r => {
    const rel = r.t - t0;
    console.log(`   ${(r.bytes / 1024).toFixed(0).padStart(6)} KB  ${r.url.padEnd(30)} ${rel > loadAt ? '⚠️ load之后才拉 @' + rel + 'ms' : '(阻塞首屏)'}`);
  });
  console.log(`\n  【load 之后才加载的】(共 ${after.length} 个, ${(after.reduce((a, x) => a + x.bytes, 0) / 1048576).toFixed(2)} MB):`);
  after.sort((a, b) => b.bytes - a.bytes).slice(0, 8).forEach(r => console.log(`   ${(r.bytes / 1024).toFixed(0).padStart(6)} KB @${r.rel}ms  ${r.url}`));

  const totJS = res.filter(r => /\.js$/.test(r.url)).reduce((a, x) => a + x.bytes, 0);
  console.log(`\n  JS 总量 ${(totJS / 1048576).toFixed(2)} MB · 脚本数 ${res.filter(r => /\.js$/.test(r.url)).length} 个`);
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
