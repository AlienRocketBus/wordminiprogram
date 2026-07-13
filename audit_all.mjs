/* audit_all.mjs — 全27岛 + 地图页: JS报错 + 资源404 + 关键函数就位 扫描
 * 发布前总体检 A+B 项。每个页面真机加载, 抓:
 *   ① pageerror(未捕获 JS 异常)  ② console.error  ③ HTTP>=400 的请求
 *   ④ 关键函数就位(showScreen/petTaskComplete/speak/save)
 * 一个岛有问题就整体不过。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const pages = fs.readdirSync('.').filter(f => /^island_\w+\.html$/.test(f)).sort();
pages.unshift('index.html');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  let bad = 0;
  const rows = [];
  for (const pg of pages) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try { localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 5, totalCorrect: 4, learned: [0], level: 2, coins: 50, stats: {}, wrongs: {} })); } catch (e) { }
    });
    const p = await c.newPage();
    const errs = [], e404 = [];
    p.on('pageerror', e => errs.push('JS: ' + String(e).slice(0, 90)));
    p.on('console', m => { if (m.type() === 'error') errs.push('CE: ' + m.text().slice(0, 90)); });
    p.on('response', r => { if (r.status() >= 400) e404.push(r.url().split('/').slice(-1)[0].slice(0, 40)); });
    let loadOk = true;
    try {
      await p.goto(`http://localhost:${PORT}/${pg}`, { waitUntil: 'load', timeout: 45000 });
      await p.waitForTimeout(2600);
    } catch (e) { loadOk = false; errs.push('LOAD: ' + String(e).slice(0, 60)); }
    let fns = {};
    if (loadOk) {
      fns = await p.evaluate(() => ({
        show: typeof window.showScreen,
        pet: typeof window.petTaskComplete,
        speak: typeof window.speak,
        save: typeof window.save,
        S: !!window.S,
      })).catch(() => ({}));
    }
    const fnBad = pg !== 'index.html' && (fns.show !== 'function' || fns.pet !== 'function' || fns.save !== 'function' || !fns.S);
    const isBad = errs.length > 0 || e404.length > 0 || fnBad;
    if (isBad) bad++;
    rows.push({ pg, errs: errs.length, e404: e404.length, fnBad, detail: [...errs.slice(0, 2), ...e404.slice(0, 2)] });
    await c.close();
  }
  console.log('  页面                      JS报错  404   关键函数   判定');
  console.log('  ' + '─'.repeat(62));
  rows.forEach(r => {
    console.log(`  ${r.pg.padEnd(26)} ${String(r.errs).padEnd(6)} ${String(r.e404).padEnd(5)} ${r.fnBad ? '❌缺失' : '✅在位'}    ${(r.errs || r.e404 || r.fnBad) ? '❌' : '✅'}`);
    r.detail.forEach(d => console.log(`      · ${d}`));
  });
  console.log(`\n  ${bad === 0 ? '✅ 全部 ' + rows.length + ' 个页面: 0 JS报错 · 0 资源404 · 关键函数全部在位' : '❌ ' + bad + ' 个页面有问题'}`);
  await b.close();
  if (bad) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
