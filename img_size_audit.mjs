/* v934 全库图片体检 (全覆盖版)
 * Hansen: "查看一下还有没有其他地方也出现了这种类似的问题, 详细核查"
 *
 * 上一版自己就犯了同一个毛病: 只扫了随手挑的 8 个屏(全库其实有 21 个), 而且只看 <img>,
 * 漏了 CSS background-image。—— "只验我盯着的那一处" 正是所有 bug 的根源。
 * 这一版: 21 个屏 + 单词弹窗 + 形象选择器/详情 + 商店/扭蛋/展柜 + 三种图片用法全覆盖。
 *
 * 两类问题(v929 压图压过头会导致的):
 *  ① 撑不起展示位: 源图尺寸 <= 画出来的尺寸(已顶格, 再也长不大), 展示位却大得多(填充<70%)
 *  ② 被拉糊: 显示尺寸x3(手机倍屏) 超过源图 1.5 倍
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8877';
const ISLAND = process.argv[3] || 'island_land1.html';
const DPR = 3;
const SCREENS = ['home','explore','listen','match','typing','cloze','scramble',
  'bubble','chest','eagle','fish','moles','speed','cards',
  'review','stats','pet','quests','ach','settings','boss'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0,1,2,3,4,5], level: 13, coins: 99999, diamonds: 9999, stats: { maxCombo: 5 }, wrongs: { 0: 2, 1: 1 } }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) {}
  });
  const p = await c.newPage();
  await p.goto(`http://localhost:${PORT}/${ISLAND}`, { waitUntil: 'load', timeout: 50000 });
  await p.waitForTimeout(2400);
  const kill = () => p.evaluate(() => {
    ['alertModal','hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display='none'; } });
    document.body.classList.remove('modal-open');
  });
  await kill();

  const blurry = [], tiny = [], broken = [];
  const seen = new Set();
  let scanned = 0, imgsSeen = 0;

  async function scan(where) {
    const rows = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('img').forEach(im => {
        const bb = im.getBoundingClientRect();
        if (bb.width < 20 || bb.height < 20) return;
        /* ⚠️ v934: 原来这里遇到【加载失败的图】直接 return 跳过 —— "找不到 = 通过", 是最危险的漏洞。
           (实测: 把 avatars/hd 挪走, 守卫居然还报"通过" —— 因为图裂了就被跳过了。)
           现在: 裂图当场判死。一张画不出来的图, 比一张糊的图严重得多。 */
        if (!im.complete || !im.naturalWidth) {
          /* ⚠️ 但要分清两种情况, 否则会误报(守卫误报比漏报更糟 —— 会让人开始忽视它):
             · 【懒加载 + 还在屏幕外】= 完全正常, 浏览器故意还没下它(卡册里的 boss 图就是这样) → 跳过
             · 其它一律 = 真的画不出来(404/解码失败/空 src) → 当场判死 */
          const lazy = (im.loading === 'lazy') || im.getAttribute('loading') === 'lazy';
          const inView = bb.top < 950 && bb.bottom > -120;
          if (lazy && !inView) return;
          out.push({ kind: 'img', broken: true,
            src: (im.currentSrc || im.getAttribute('src') || '(空src)').split('/').slice(-2).join('/').split('?')[0],
            nat: [0, 0], box: [Math.round(bb.width), Math.round(bb.height)], parent: [Math.round(bb.width), Math.round(bb.height)] });
          return;
        }
        const par = im.offsetParent || im.parentElement;
        const pb = par ? par.getBoundingClientRect() : bb;
        out.push({ kind:'img', src:(im.currentSrc||im.src||'').split('/').slice(-2).join('/').split('?')[0],
          nat:[im.naturalWidth, im.naturalHeight], box:[Math.round(bb.width), Math.round(bb.height)],
          parent:[Math.round(pb.width), Math.round(pb.height)] });
      });
      document.querySelectorAll('svg image').forEach(im => {
        const bb = im.getBoundingClientRect();
        if (bb.width < 20 || bb.height < 20) return;
        const href = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
        if (!href || href.startsWith('data:')) return;
        out.push({ kind:'svgimg', href, src: href.split('/').slice(-2).join('/').split('?')[0],
          box:[Math.round(bb.width), Math.round(bb.height)], parent:[Math.round(bb.width), Math.round(bb.height)] });
      });
      document.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundImage;
        if (!bg || bg === 'none' || !/url\(/.test(bg)) return;
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!m) return;
        const u = m[1];
        if (u.startsWith('data:')) return;
        if (cs.backgroundRepeat === 'repeat') return;
        const bb = el.getBoundingClientRect();
        if (bb.width < 30 || bb.height < 30) return;
        out.push({ kind:'cssbg', href:u, src: u.split('/').slice(-2).join('/').split('?')[0],
          box:[Math.round(bb.width), Math.round(bb.height)], parent:[Math.round(bb.width), Math.round(bb.height)] });
      });
      return out;
    });

    for (const r of rows) {
      if (r.kind !== 'img' && r.href) {
        r.nat = await p.evaluate((u) => new Promise(res => {
          const i = new Image();
          i.onload = () => res([i.naturalWidth, i.naturalHeight]);
          i.onerror = () => res([0,0]);
          i.src = u;
        }), r.href);
      }
    }

    rows.forEach(r => {
      if (r.broken) { broken.push({ ...r, where }); imgsSeen++; return; }   /* 裂图 = 不合格 */
      if (!r.nat || !r.nat[1]) return;
      imgsSeen++;
      const key = r.src + '|' + r.box.join('x');
      if (seen.has(key)) return;
      seen.add(key);
      const up = Math.max((r.box[0]*DPR)/r.nat[0], (r.box[1]*DPR)/r.nat[1]);
      if (up > 1.5) blurry.push({ ...r, up: up.toFixed(1), where });
      const fillH = r.box[1] / (r.parent[1] || 1);
      const cannotGrow = r.nat[1] <= r.box[1] + 1;
      if (cannotGrow && r.parent[1] > 200 && fillH < 0.7) tiny.push({ ...r, fill: Math.round(fillH*100), where });
    });
    scanned++;
  }

  for (const s of SCREENS) {
    await p.evaluate((id) => { try { showScreen(id); } catch(e) {} }, s);
    await p.waitForTimeout(s === 'boss' ? 1400 : 600);
    if (s === 'boss') { await p.evaluate(() => { try { startBoss(); } catch(e) {} }); await p.waitForTimeout(1600); }
    await kill();
    await scan(s);
  }

  await p.evaluate(() => { try { showScreen('explore'); } catch(e) {} });
  await p.waitForTimeout(700);
  await p.evaluate(() => { const w = document.querySelector('.word-card, .wcard, [data-w]'); if (w) w.click(); });
  await p.waitForTimeout(1100);
  await scan('单词弹窗');
  await p.evaluate(() => { const m = document.getElementById('wordModal'); if (m) { m.classList.remove('show'); m.style.display='none'; } document.body.classList.remove('modal-open'); });

  await p.evaluate(() => { try { showScreen('home'); } catch(e) {} });
  await p.waitForTimeout(600);
  await p.evaluate(() => {
    try {
      if (window.HansenAvatar && window.HansenAvatar.openPicker) window.HansenAvatar.openPicker();
      else { const a = document.querySelector('.avatar, .hsn-av-btn'); if (a) a.click(); }
    } catch(e) {}
  });
  await p.waitForTimeout(1300);
  await scan('形象选择器');
  await p.evaluate(() => { const t = document.querySelector('.hsn-av-thumb,.hsn-av-tile,[data-av]'); if (t) t.click(); });
  await p.waitForTimeout(1600);
  await scan('形象详情');

  const extras = [
    ['钻石商店', 'HansenDiamondShop'],
    ['扭蛋', 'HansenGacha'],
    ['宠物展柜', 'HansenPetShowcase'],
  ];
  for (const [name, mod] of extras) {
    await p.evaluate(() => { try { showScreen('home'); } catch(e) {} });
    await p.waitForTimeout(500);
    await p.evaluate((m) => { try { const M = window[m]; if (M && M.open) M.open(); } catch(e) {} }, mod);
    await p.waitForTimeout(1200);
    await scan(name);
  }

  console.log(`  == 全库图片体检 · 全覆盖版 (${scanned} 个界面 · ${imgsSeen} 张图 · 按手机 3 倍屏算) ==\n`);
  console.log(`  被拉糊的图 (显示尺寸x3 超过源图 1.5 倍以上): ${blurry.length} 个`);
  blurry.sort((a,b)=>b.up-a.up).slice(0,14).forEach(r =>
    console.log(`     [X] 放大 ${r.up}x  ${r.src.padEnd(26)} 源图${r.nat.join('x').padEnd(9)} 显示${r.box.join('x')}  [${r.where}/${r.kind}]`));
  if (!blurry.length) console.log('     [OK] 一张都没有');

  console.log(`\n  画不出来的裂图 (加载失败/空白): ${broken.length} 个`);
  broken.slice(0, 14).forEach(r =>
    console.log(`     [X] ${r.src.padEnd(30)} 显示位${r.box.join('x')}  [${r.where}/${r.kind}]`));
  if (!broken.length) console.log('     [OK] 一张都没有');

  console.log(`\n  撑不起展示位的图 (源图太小, 在大展示位里缩成一小坨): ${tiny.length} 个`);
  tiny.sort((a,b)=>a.fill-b.fill).slice(0,14).forEach(r =>
    console.log(`     [X] 只占容器 ${r.fill}%  ${r.src.padEnd(26)} 源图${r.nat.join('x').padEnd(9)} 显示${r.box.join('x')} 容器${r.parent.join('x')}  [${r.where}/${r.kind}]`));
  if (!tiny.length) console.log('     [OK] 一张都没有');

  await b.close();
  if (blurry.length || tiny.length || broken.length) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
