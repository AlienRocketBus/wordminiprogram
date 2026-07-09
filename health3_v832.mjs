import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const PORT = 8942;
const ISLANDS = ['island_animal', 'island_season', 'island_food'];
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let allPass = true;
for (const isl of ISLANDS) {
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); const u = (m.location() && m.location().url) || ''; if (!/favicon|autoplay|Autoplay|net::ERR/i.test(t) && !/favicon/i.test(u)) errs.push('C:' + t); } });
  page.on('pageerror', e => errs.push('P:' + e.message));
  await page.goto(`http://127.0.0.1:${PORT}/${isl}.html`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => ({
    bodyKids: document.body ? document.body.children.length : 0,
    wm: (window.allW && window.allW.length) || 0,
    crystal: !!(window.HansenCrystal && window.HansenCrystal._onAnswer),
    btn: !!document.getElementById('hsnCrystalBtn'),
    gems: !!(window.HansenGems && window.HansenGems.add),
    redBar: !!Array.from(document.querySelectorAll('*')).find(e => /版本不一致|version.*mismatch/i.test(e.textContent || '') && e.children.length === 0),
    title: (document.title || '').slice(0, 20)
  }));
  const pass = m.bodyKids > 0 && m.wm > 0 && m.crystal && m.btn && m.gems && !m.redBar && errs.length === 0;
  if (!pass) allPass = false;
  console.log(`${pass ? '✅' : '❌'} ${isl}: 词${m.wm} body${m.bodyKids} crystal${m.crystal ? '✓' : '✗'} 按钮${m.btn ? '✓' : '✗'} Gems${m.gems ? '✓' : '✗'} 红条${m.redBar ? '有!' : '无'} "${m.title}"${errs.length ? '  错误:' + errs.slice(0, 3).join(' | ') : ''}`);
  await page.close();
}
await browser.close();
console.log('\n' + (allPass ? '🎉 三岛健康全部通过' : '❌ 三岛健康有问题'));
process.exit(allPass ? 0 : 1);
