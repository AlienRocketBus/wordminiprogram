/* v932 运行时体检: 抓【图片没画出来】+【主线程卡顿 long task】+【切屏耗时】
 * Hansen: "进去之后操作有点卡顿" / "18个岛屿有的表面图片没加载出来" / "要求非常非常丝滑"
 * 用法: node jank_probe.mjs <island.html> <none|4g>
 */
import { chromium } from './playwright_loader.mjs';

const ISLAND = process.argv[2] || 'island_land1.html';
const NET = process.argv[3] || 'none';

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
    window.__lt = [];
    try {
      new PerformanceObserver((l) => { l.getEntries().forEach(e => window.__lt.push({ d: Math.round(e.duration), t: Math.round(e.startTime) })); })
        .observe({ entryTypes: ['longtask'] });
    } catch (e) { }
  });
  const p = await c.newPage();

  if (NET === '4g') {
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 70, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  const imgs = [], fails = [];
  p.on('response', async (r) => {
    const u = r.url();
    if (!/\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(u)) return;
    let bytes = 0;
    try { bytes = (await r.body()).length; } catch (e) { }
    imgs.push({ url: u.split('/').slice(-2).join('/').split('?')[0], status: r.status(), bytes });
    if (r.status() >= 400) fails.push({ url: u, status: r.status() });
  });
  p.on('requestfailed', (r) => {
    const u = r.url();
    if (/\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(u)) fails.push({ url: u, status: 'FAILED:' + (r.failure() ? r.failure().errorText : '?') });
  });

  const t0 = Date.now();
  await p.goto(`http://localhost:8877/${ISLAND}`, { waitUntil: 'load', timeout: 60000 });
  const loadMs = Date.now() - t0;
  await p.waitForTimeout(2600);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  const broken = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('img').forEach(im => {
      const bb = im.getBoundingClientRect();
      if (bb.width < 2 || bb.height < 2) return;
      if (!im.complete || im.naturalWidth === 0) out.push({ 空白img: (im.currentSrc || im.src || '(空src)').split('/').slice(-1)[0], 在首屏: bb.top < 844 });
    });
    document.querySelectorAll('svg image').forEach(im => {
      const h = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
      const bb = im.getBoundingClientRect();
      if (bb.width < 2) return;
      if (!h) out.push({ svg空href: '(空)', 在首屏: bb.top < 844 });
    });
    return out;
  });

  const screens = ['home', 'cards', 'home', 'review', 'home'];
  const jank = [];
  for (const s of screens) {
    const a = Date.now();
    await p.evaluate((id) => { try { showScreen(id); } catch (e) { } }, s);
    await p.waitForTimeout(650);
    jank.push({ s, ms: Date.now() - a - 650 });
  }

  const lt = await p.evaluate(() => window.__lt || []);
  const perf = await p.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0] || {};
    const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime;
    let anims = 0, imgEls = 0, willc = 0;
    document.querySelectorAll('*').forEach(e => {
      const s = getComputedStyle(e);
      if (s.animationName && s.animationName !== 'none') anims++;
      if (s.willChange && s.willChange !== 'auto') willc++;
    });
    imgEls = document.querySelectorAll('img').length + document.querySelectorAll('svg image').length;
    return {
      dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0),
      fcp: Math.round(fcp || 0), domNodes: document.querySelectorAll('*').length,
      imgEls, anims, willc,
      scripts: [...document.querySelectorAll('script[src]')].length
    };
  });

  console.log(`  ══ ${ISLAND} ${NET === '4g' ? '(4G + CPU×4 降速 ≈ 中端手机)' : '(本地全速)'} ══`);
  console.log(`  FCP ${perf.fcp}ms · DCL ${perf.dcl}ms · load ${perf.load}ms`);
  console.log(`  DOM ${perf.domNodes} 节点 · 图片元素 ${perf.imgEls} 个 · 外链脚本 ${perf.scripts} 个`);
  console.log(`  🔥 同时在跑 CSS 动画的元素: ${perf.anims} 个  ${perf.anims > 40 ? '❌ 太多了, 这是卡顿主因之一' : perf.anims > 20 ? '⚠️ 偏多' : '✅'}`);
  console.log(`  will-change 元素: ${perf.willc} 个 ${perf.willc > 30 ? '❌ 太多(每个都占一层 GPU 内存)' : ''}`);
  console.log(`  图片请求 ${imgs.length} 个 · ${(imgs.reduce((a, x) => a + x.bytes, 0) / 1048576).toFixed(2)} MB`);
  console.log('  最大的图:');
  imgs.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 6).forEach(x => console.log(`     ${(x.bytes / 1024).toFixed(0).padStart(5)} KB  ${x.url}`));
  console.log(`\n  ❌ 网络层失败: ${fails.length} 个`);
  fails.slice(0, 10).forEach(f => console.log(`     [${f.status}] ${f.url.split('/').slice(-2).join('/')}`));
  console.log(`  ❌ 页面上空白/没画出来的图: ${broken.length} 个`);
  broken.slice(0, 10).forEach(x => console.log(`     ${JSON.stringify(x)}`));

  const total = lt.reduce((a, x) => a + x.d, 0);
  console.log(`\n  ⏱ 主线程卡顿 long task: ${lt.length} 次 · 累计阻塞 ${total}ms  ${total > 600 ? '❌ 明显卡' : total > 250 ? '⚠️ 有点顿' : '✅ 顺'}`);
  lt.slice(0, 8).forEach(x => console.log(`     ${String(x.d).padStart(4)}ms @${x.t}ms`));
  console.log('  切屏净耗时:');
  jank.forEach(j => console.log(`     → ${j.s.padEnd(7)} ${j.ms}ms ${j.ms > 100 ? '❌' : j.ms > 50 ? '⚠️' : '✅'}`));

  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
