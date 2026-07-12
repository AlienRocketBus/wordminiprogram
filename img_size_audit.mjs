/* ⭐ v933 全库图片体检: 找出【被 v929 压小之后, 在大尺寸展示位上撑不起来 / 被拉糊】的图
 *
 * v929 为了提速把图标(512~768px → 288px)和头像(720px → 192px)全压小了。
 * 顶栏/网格这些小展示位完全没问题, 但只要有【大尺寸展示位】还在用同一张图, 就会出两种毛病:
 *   ① 图片是靠【原始尺寸】撑开的(width:auto) → 压小之后根本撑不起来 = 缩成一小坨(形象详情就是这个)
 *   ② 图片被 CSS 拉伸填满 → 源图不够大 = 糊(放大倍数 > 1.5 就肉眼可见)
 * 本体检把全库每个屏都渲一遍, 把这两类全揪出来。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8877';
const DPR = 3;   // 手机通常 2~3 倍屏

const SCREENS = ['home', 'cards', 'review', 'settings', 'stats', 'pet', 'quests', 'ach'];

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
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 45000 });
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  const blurry = [], tiny = [];
  const seen = new Set();

  async function scan(where) {
    const rows = await p.evaluate((dpr) => {
      const out = [];
      document.querySelectorAll('img').forEach(im => {
        const bb = im.getBoundingClientRect();
        if (bb.width < 20 || bb.height < 20) return;
        if (!im.complete || !im.naturalWidth) return;
        const cs = getComputedStyle(im);
        /* 展示位 = 它的定位父级(position:absolute 的图, offsetParent 就是那个卡片/槽位) */
        const par = im.offsetParent || im.parentElement;
        const pb = par ? par.getBoundingClientRect() : bb;
        const src = (im.currentSrc || im.src || '').split('/').slice(-2).join('/').split('?')[0];
        out.push({
          src,
          nat: [im.naturalWidth, im.naturalHeight],
          box: [Math.round(bb.width), Math.round(bb.height)],
          parent: [Math.round(pb.width), Math.round(pb.height)],
          autoSize: (cs.width === 'auto' || cs.height === 'auto'),
          fit: cs.objectFit
        });
      });
      return out;
    }, DPR);

    console.log(`     [调试] ${where}: 扫到 ${rows.length} 张图`);
    rows.forEach(r => {
      const key = r.src + '|' + r.box.join('x');
      if (seen.has(key)) return;
      seen.add(key);
      // ① 被拉糊: 显示尺寸 x DPR 明显超过源图
      const upW = (r.box[0] * DPR) / r.nat[0], upH = (r.box[1] * DPR) / r.nat[1];
      const up = Math.max(upW, upH);
      if (up > 1.5) blurry.push({ ...r, up: up.toFixed(1), where });
      /* ② 撑不起展示位 —— 判据(这才是能真抓到的):
            【源图原始高度 <= 画出来的高度】= 这张图【根本没被缩小过】, 已经按原尺寸顶格画了, 再也长不大;
            而展示位却比它大得多(填充率 < 70%) → 就是"源图太小撑不起来", 正是形象详情那个 bug。
         (之前用 getComputedStyle().width==='auto' 判断是错的 —— computed style 返回的是解析后的像素值, 永远不会是 'auto'。) */
      const fillH = r.box[1] / (r.parent[1] || 1);
      const cannotGrow = r.nat[1] <= r.box[1] + 1;
      if (cannotGrow && r.parent[1] > 200 && fillH < 0.7) tiny.push({ ...r, fill: Math.round(fillH * 100), where });
    });
  }

  await scan('home');
  for (const s of SCREENS.slice(1)) {
    await p.evaluate((id) => { try { showScreen(id); } catch (e) { } }, s);
    await p.waitForTimeout(550);
    await scan(s);
  }
  // 形象选择器 + 详情 (必须先回首页, 否则选择器打不开)
  await p.evaluate(() => { try { showScreen('home'); } catch (e) { } });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    try {
      if (window.HansenAvatar && window.HansenAvatar.openPicker) window.HansenAvatar.openPicker();
      else { var a = document.querySelector('.avatar, .hsn-av-btn'); if (a) a.click(); }
    } catch (e) { }
  });
  await p.waitForTimeout(1300);
  await scan('形象选择器');
  await p.evaluate(() => { const t = document.querySelector('.hsn-av-thumb,.hsn-av-tile,[data-av]'); if (t) t.click(); });
  await p.waitForTimeout(1600);
  await scan('形象详情');

  console.log('  ══ 全库图片体检 (按手机 3 倍屏算) ══\n');
  console.log(`  ❌ 被拉糊的图 (显示尺寸 x3 超过源图 1.5 倍以上): ${blurry.length} 个`);
  blurry.sort((a, b) => b.up - a.up).slice(0, 12).forEach(r =>
    console.log(`     放大 ${r.up}x  ${r.src.padEnd(26)} 源图${r.nat.join('x').padEnd(9)} 显示${r.box.join('x')}  [${r.where}]`));
  if (!blurry.length) console.log('     (无)');

  console.log(`\n  ❌ 撑不起展示位的图 (原始尺寸太小, 在大展示位里缩成一小坨): ${tiny.length} 个`);
  tiny.sort((a, b) => a.fill - b.fill).slice(0, 12).forEach(r =>
    console.log(`     只占容器 ${r.fill}%  ${r.src.padEnd(26)} 源图${r.nat.join('x').padEnd(9)} 显示${r.box.join('x')} 容器${r.parent.join('x')}  [${r.where}]`));
  if (!tiny.length) console.log('     (无)');

  await b.close();
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
