// 每答一题的主线程开销（4× 慢 CPU），账本里有一个玩了很久的孩子的数据
import { openIsland, done } from './h.mjs';
const file = process.argv[2] || 'island_animal.html';
const { page, errs } = await openIsland(file);
const cdp = await page.context().newCDPSession(page);
// 造一个大账本：所有岛 learned/mc 满、每岛 10 个错词 + 计划 + 墓碑
await page.evaluate(() => {
  const st = HansenCanonical.read();
  const today = new Date(); const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  HansenCanonical.islands.forEach(isl => {
    const p = st.islands[isl.id];
    for (let i = 0; i < isl.words; i++) { if (p.learned.indexOf(i) < 0) p.learned.push(i); p.mc[i] = 3; p.cleared.wrongs[i] = Date.now() - 86400000 * (i % 30) - 1; }
    for (let i = 0; i < Math.min(10, isl.words); i++) { p.wrongs[i] = 2; p.srs[i] = { box: i % 4, due: ymd(today), last: '', updatedAt: Date.now() - 1000 }; }
  });
  HansenCanonical.write(st);
  HansenCanonical.migrate(); HansenCanonical.syncCurrent();
});
await page.waitForTimeout(500);
const size = await page.evaluate(() => (localStorage.getItem(HansenCanonical.STORE_KEY) || '').length);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const r = await page.evaluate(async () => {
  const n = allW.length, times = [];
  for (let k = 0; k < 40; k++) {
    const i = 12 + (k % Math.max(1, n - 12));
    const t0 = performance.now();
    markAnswer(i, k % 3 !== 0);
    times.push(performance.now() - t0);
    await new Promise(r => setTimeout(r, 30));
  }
  times.sort((a, b) => a - b);
  return { median: +times[20].toFixed(1), p90: +times[36].toFixed(1), max: +times[39].toFixed(1) };
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
console.log(JSON.stringify({ storeBytes: size, ...r }));
console.log('errs', errs.slice(0, 3));
await done();
