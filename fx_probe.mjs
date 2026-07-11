/* ⭐v912 特效不可破坏守卫 · 真机探针 (fx_probe.mjs)
 * Hansen 铁律: boss 攻击特效一旦定稿, 绝不允许被任何改动无声破坏。
 *
 * 为什么需要它: check_resources 的几百条守卫全是【盯代码字符串】的。而 v905 把一层不透明底涂在 #bossScreen 上,
 * 【没有改动任何特效代码】, 却把 z-index:-1 的背景特效层整个盖死 → 龙骑士统帅的巨翼、地狱犬王的地狱之门双双消失,
 * 所有字符串守卫全部通过、照常打包上线。教训: 特效"存在"不等于特效"看得见"。
 *
 * 本探针做的事: 在真浏览器里把每个 boss 的攻击特效真的放一遍, 冻结动画后拍三帧
 *   A = 全开   B = 关掉前景特效层(+canvas)   C = 关掉背景特效层
 * diff(A,B) = 前景特效实际画出的像素   diff(A,C) = 背景特效实际画出的像素
 * 由 fx_guard.py 与 hansen_fx_lock.json 里锁定的地板值比对, 低于地板 = 特效被破坏 = 拒绝打包。
 *
 * 用法: node fx_probe.mjs <出图目录> [boss级别列表,逗号分隔]
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const OUT = process.argv[2] || '/tmp/fxg';
const ONLY = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
const PORT = process.env.FXG_PORT || '8877';
const BASE = 'http://localhost:' + PORT + '/island_animal.html';

fs.mkdirSync(OUT, { recursive: true });

const run = async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandAnimal', JSON.stringify({
        totalAnswers: 20, totalCorrect: 16, learned: [0, 1, 2, 3],
        level: 1, coins: 500, stats: { maxCombo: 3 }, wrongs: {}
      }));
      localStorage.setItem('hansen_starter_coins_given', '1');
    } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });

  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);

  // 取本岛 20 个 boss 名单
  const bosses = await page.evaluate(() => BOSSES.map((b, i) => ({ lv: i + 1, name: b.name })));
  const targets = ONLY.length ? bosses.filter(b => ONLY.includes(b.lv)) : bosses;

  const results = [];
  const clip = { x: 0, y: 0, width: 390, height: 560 };   // 特效主战区(boss+血条+勇者条)

  for (const b of targets) {
    const errBefore = errors.length;
    // 清场: 上一场特效残留一律清掉
    await page.evaluate(() => {
      try { if (window.__hansenFxLayer) window.__hansenFxLayer.innerHTML = ''; } catch (e) {}
      try { if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.innerHTML = ''; } catch (e) {}
      document.querySelectorAll('canvas').forEach(c => { try { c.remove(); } catch (e) {} });
      try { if (window.__hansenFxLayer) window.__hansenFxLayer.style.display = ''; } catch (e) {}
      try { if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.style.display = ''; } catch (e) {}
    });

    await page.evaluate((lv) => {
      try { S.level = lv; } catch (e) {}
      try { showScreen('boss'); } catch (e) {}
      try { startBoss(); } catch (e) {}
    }, b.lv);
    await page.waitForTimeout(450);

    const shown = await page.evaluate(() => (document.querySelector('.boss-name') || {}).textContent || '');

    await page.evaluate((n) => {
      // ⭐ 彻底冻结的前提: 先接管 setTimeout, 记下特效排的每一个定时器
      window.__fxTimers = [];
      if (!window.__stOrig) {
        window.__stOrig = window.setTimeout;
        window.setTimeout = function (f, d) { const id = window.__stOrig(f, d); try { window.__fxTimers.push(id); } catch (e) {} return id; };
      }
      window.__rafOrig = window.__rafOrig || window.requestAnimationFrame;
      window.requestAnimationFrame = window.__rafOrig;   // 每个 boss 开场先恢复
      try { HansenBossAttack({ name: n, hp: 440, maxHp: 440, color: '#ef4444' }, 72, 428, 500); } catch (e) {}
    }, b.name);

    // 特效高潮前的展开期: 大多数特效此刻元素最多
    await page.waitForTimeout(950);

    // 彻底冻结: ①暂停所有动画 ②清掉特效排的全部定时器(否则新的枪/光球会在两帧之间冒出来)
    //          ③停掉 requestAnimationFrame(canvas 特效定格在最后一帧)
    // → 三帧之间【只差一个图层的显示与否】, 差值才等于"这一层真的画出了多少像素"
    const counts = await page.evaluate(() => {
      try { document.getAnimations().forEach(a => a.pause()); } catch (e) {}
      try { (window.__fxTimers || []).forEach(id => clearTimeout(id)); } catch (e) {}
      try { window.requestAnimationFrame = function () { return 0; }; } catch (e) {}
      const F = window.__hansenFxLayer, B = window.__hansenFxLayerBack;
      return {
        front: F ? F.children.length : -1,
        back: B ? B.children.length : -1,
        canvas: document.querySelectorAll('canvas').length,
        backZ: B ? getComputedStyle(B).zIndex : '?'
      };
    });

    const A = `${OUT}/${b.lv}_A.png`, Bf = `${OUT}/${b.lv}_B.png`, C = `${OUT}/${b.lv}_C.png`;
    await page.screenshot({ path: A, clip });

    // B: 关前景层 + canvas → diff(A,B) = 前景特效画出的像素
    await page.evaluate(() => {
      if (window.__hansenFxLayer) window.__hansenFxLayer.style.display = 'none';
      document.querySelectorAll('canvas').forEach(c => { c.style.display = 'none'; });
    });
    await page.screenshot({ path: Bf, clip });

    // C: 前景恢复, 只关背景层 → diff(A,C) = 背景特效画出的像素
    await page.evaluate(() => {
      if (window.__hansenFxLayer) window.__hansenFxLayer.style.display = '';
      document.querySelectorAll('canvas').forEach(c => { c.style.display = ''; });
      if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.style.display = 'none';
    });
    await page.screenshot({ path: C, clip });
    await page.evaluate(() => { if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.style.display = ''; });

    results.push({
      lv: b.lv, name: b.name, shown,
      frontEls: counts.front, backEls: counts.back, canvases: counts.canvas, backZ: counts.backZ,
      errors: errors.slice(errBefore)
    });
  }

  fs.writeFileSync(`${OUT}/probe.json`, JSON.stringify(results, null, 1));
  console.log('PROBE_OK ' + results.length);
  await browser.close();
};

run().catch(e => { console.log('PROBE_FATAL ' + e); process.exit(1); });
