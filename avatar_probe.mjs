/* v933: 量【形象详情】大卡片里, 立绘到底画多大 (占卡片的百分比)
 * Hansen: "点进这个动物头像之后, 立体形象怎么变得这么小了?"
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const PORT = process.argv[2] || '8877';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
  });
  const p = await c.newPage();
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  // 打开形象选择器 → 详情
  await p.evaluate(() => {
    try {
      if (window.HansenAvatar && window.HansenAvatar.openPicker) window.HansenAvatar.openPicker();
      else { var a = document.querySelector('.avatar, .hsn-av-btn'); if (a) a.click(); }
    } catch (e) { }
  });
  await p.waitForTimeout(1200);
  // 点第一个格子进详情
  await p.evaluate(() => {
    var t = document.querySelector('.hsn-av-thumb, .hsn-av-tile, [data-av]');
    if (t) t.click();
  });
  await p.waitForTimeout(1800);

  const r = await p.evaluate(() => {
    const im = document.getElementById('hsnAvCardImg');
    if (!im) return { no: 1 };
    const card = im.closest('.hsn-av-card') || im.parentElement;
    const ib = im.getBoundingClientRect(), cb = card.getBoundingClientRect();
    return {
      src: (im.currentSrc || im.src || '').split('/').slice(-2).join('/').split('?')[0],
      natural: im.naturalWidth + 'x' + im.naturalHeight,
      drawn: Math.round(ib.width) + 'x' + Math.round(ib.height),
      card: Math.round(cb.width) + 'x' + Math.round(cb.height),
      pctW: Math.round(ib.width / cb.width * 100),
      pctH: Math.round(ib.height / cb.height * 100),
      complete: im.complete && im.naturalWidth > 0
    };
  });
  if (r.no) { console.log('  ❌ 没打开详情页'); await b.close(); return; }
  console.log('  ══ 形象详情 · 大卡片 ══');
  console.log(`  图片来源   : ${r.src}   (加载成功: ${r.complete ? '✅' : '❌'})`);
  console.log(`  图片原始尺寸: ${r.natural}`);
  console.log(`  卡片尺寸   : ${r.card}`);
  console.log(`  实际画出来 : ${r.drawn}  →  占卡片 宽 ${r.pctW}% · 高 ${r.pctH}%`);
  const ok = r.pctH >= 80;
  console.log(`  ${ok ? '✅ 立绘撑满卡片' : '❌ 立绘太小(应占卡片高度 ~92%)'}`);
  await p.screenshot({ path: '/tmp/av_detail.png' });
  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
