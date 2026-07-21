/* v932: 用 CPU Profiler 钉死【是谁在阻塞主线程】
 * 输出: 自耗时最高的函数 TOP 15 (函数名 + 来自哪个文件)
 */
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
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Profiler.start');

  await p.goto(`http://localhost:8877/${ISLAND}`, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(6000);          // 覆盖 load 之后那一大块
  const { profile } = await cdp.send('Profiler.stop');

  // 汇总每个函数的自耗时
  const byId = new Map();
  profile.nodes.forEach(n => byId.set(n.id, n));
  const self = new Map();
  const total = profile.timeDeltas.reduce((a, d) => a + Math.max(0, d), 0);
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    const dt = Math.max(0, profile.timeDeltas[i] || 0);
    self.set(id, (self.get(id) || 0) + dt);
  }
  const rows = [...self.entries()].map(([id, us]) => {
    const n = byId.get(id) || {};
    const f = n.callFrame || {};
    return {
      ms: us / 1000,
      fn: f.functionName || '(匿名)',
      file: (f.url || '').split('/').pop().split('?')[0] || '-',
      line: f.lineNumber
    };
  }).sort((a, b) => b.ms - a.ms);

  console.log(`  ══ ${ISLAND} · CPU 采样 (CPU×4 降速, 覆盖 load 后 6 秒) ══`);
  console.log(`  采样总时长 ${(total / 1000).toFixed(0)}ms\n`);
  console.log('  自耗时最高的函数:');
  rows.slice(0, 16).forEach(r => {
    if (r.ms < 8) return;
    console.log(`   ${r.ms.toFixed(0).padStart(5)}ms  ${r.fn.slice(0, 30).padEnd(31)} ← ${r.file}${r.line >= 0 ? ':' + r.line : ''}`);
  });

  // 按文件汇总
  const byFile = new Map();
  rows.forEach(r => byFile.set(r.file, (byFile.get(r.file) || 0) + r.ms));
  console.log('\n  按文件汇总 (谁最吃 CPU):');
  [...byFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([f, ms]) => {
    if (ms < 15) return;
    console.log(`   ${ms.toFixed(0).padStart(5)}ms  ${f}`);
  });
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
