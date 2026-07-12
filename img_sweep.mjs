/* v932: 全岛扫描 —— 找出所有【404 / 空白 / 没画出来】的图片 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const ISLANDS = fs.readdirSync('.').filter(f => /^island_.*\.html$/.test(f)).sort();

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  let totalBad = 0;
  const missing = new Map();
  for (const isl of ISLANDS) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try {
        localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
        for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
      } catch (e) { }
    });
    const p = await c.newPage();
    const bad404 = [];
    p.on('response', r => { if (r.status() >= 400 && /\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(r.url())) bad404.push(r.url().split('/').slice(-2).join('/').split('?')[0]); });
    p.on('requestfailed', r => { if (/\.(png|jpg|jpeg|webp|svg|gif)(\?|$)/i.test(r.url())) bad404.push('FAIL ' + r.url().split('/').slice(-2).join('/').split('?')[0]); });
    try {
      await p.goto(`http://localhost:8877/${isl}`, { waitUntil: 'load', timeout: 45000 });
      await p.waitForTimeout(2200);
      await p.evaluate(() => {
        ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
        document.body.classList.remove('modal-open');
      });
      // 各屏都逛一下, 逼出更多图
      for (const s of ['home', 'cards', 'review', 'home']) {
        await p.evaluate((id) => { try { showScreen(id); } catch (e) { } }, s);
        await p.waitForTimeout(450);
      }
      const blank = await p.evaluate(() => {
        const o = [];
        document.querySelectorAll('img').forEach(im => {
          const bb = im.getBoundingClientRect();
          if (bb.width < 3 || bb.height < 3) return;
          if (!im.complete || im.naturalWidth === 0) o.push((im.currentSrc || im.src || '(空src)').split('/').slice(-2).join('/').split('?')[0]);
        });
        return o;
      });
      const all = [...new Set([...bad404, ...blank])];
      if (all.length) {
        totalBad += all.length;
        console.log(`  ❌ ${isl}: ${all.length} 张图有问题`);
        all.slice(0, 5).forEach(x => { console.log(`       ${x}`); missing.set(x, (missing.get(x) || 0) + 1); });
      } else {
        console.log(`  ✅ ${isl}`);
      }
    } catch (e) {
      console.log(`  ⚠️ ${isl}: ${String(e).slice(0, 60)}`);
    }
    await c.close();
  }
  console.log(`\n  ══ 合计 ${totalBad} 张问题图 ══`);
  if (missing.size) {
    console.log('  出问题最多的文件:');
    [...missing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([f, n]) => console.log(`     ×${n}  ${f}`));
  }
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
