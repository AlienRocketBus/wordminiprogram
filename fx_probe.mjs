/* ⭐v912 特效不可破坏守卫 · 真机探针 (fx_probe.mjs)
 * Hansen 钦令: boss 攻击特效一旦定稿, 绝不允许被任何改动无声破坏。
 *
 * 【为什么需要】check_resources 几百条守卫全是【盯代码字符串】的。v905 只是把一层不透明底涂在 #bossScreen 上,
 * 没改一行特效代码, 却把 z-index:-1 的背景特效层整个盖死 → 龙骑士统帅巨翼 / 地狱犬王地狱之门双双消失, 字符串守卫全过照常上线。
 * 教训: 特效"代码还在" ≠ 特效"看得见"。
 *
 * 【手法】
 *  ① 关掉一切弹窗(欢迎框 alertModal z=1000 会盖住背景特效层; 剧情框 hsnStoryModal z=2147483646 连前景层都盖) → 否则全是假阳性
 *  ② canvas 特效是每帧清空重画的(墨量忽有忽无) → 不能在固定时刻硬拍, 改为【边跑边量墨量, 等特效真的在画的那一刻再定格】
 *  ③ 定格 = 暂停动画 + 清掉特效排的所有 setTimeout + 停掉 requestAnimationFrame → 三帧之间只差一个图层
 *  ④ 三帧: A=全开   B=关前景层(+canvas)   C=关背景层
 *     diff(A,B) = 前景特效真的画在屏幕上的像素;  diff(A,C) = 背景特效真的画在屏幕上的像素
 *  ⑤ 同时读 canvas 墨量(直接读画布·不受遮挡影响) → fx_guard 判定:
 *       墨很多 却 屏幕上 0 像素 = 被遮死 = 特效已被破坏
 *       墨本来就少        = 特效朴素, 不是 bug (避免误杀)
 *  ⑥ 报错只算 JS 异常 + 本地资源丢失; 外网发音兜底(gstatic/百度TTS)在沙箱必然 403, 与特效无关, 不计入
 *
 * 用法: node fx_probe.mjs <出图目录> <island.html> [关卡序号,逗号分隔]
 */
import { chromium } from './playwright_loader.mjs';
import fs from 'fs';

const OUT = process.argv[2] || '/tmp/fxg';
const ISLAND = process.argv[3] || 'island_animal.html';
const ONLY = (process.argv[4] || '').split(',').filter(Boolean).map(Number);
const PORT = process.env.FXG_PORT || '8877';
const BASE = 'http://localhost:' + PORT + '/' + ISLAND;
const IS_LAND = /island_land\d/.test(ISLAND);
const TAG = ISLAND.replace('island_', '').replace('.html', '');
const CLIP = { x: 0, y: 0, width: 390, height: 640 };

fs.mkdirSync(OUT, { recursive: true });

const INK_JS = `(function(){
  var ink=0, cvs=document.querySelectorAll('canvas');
  for(var i=0;i<cvs.length;i++){
    try{
      var cv=cvs[i], c2=cv.getContext('2d'); if(!c2) continue;
      var h=Math.min(cv.height,640);
      var d=c2.getImageData(0,0,cv.width,h).data;
      var lit=0,tot=0;
      for(var j=3;j<d.length;j+=32){ tot++; if(d[j]>12) lit++; }
      if(tot) ink=Math.max(ink, Math.round(lit*1000/tot)/10);
    }catch(e){}
  }
  var F=window.__hansenFxLayer, B=window.__hansenFxLayerBack;
  return {ink:ink, front:F?F.children.length:0, back:B?B.children.length:0, cvs:cvs.length};
})()`;

const run = async () => {
  const browser = await chromium.launch({
    executablePath: process.env.HANSEN_CHROMIUM_PATH,
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      const save = JSON.stringify({ totalAnswers: 20, totalCorrect: 16, learned: [0, 1, 2, 3],
        level: 20, coins: 999, stats: { maxCombo: 3 }, wrongs: {} });
      ['wordIslandAnimal','wordIslandLand','wordIslandSeason','wordIslandFood','wordIslandColor',
       'wordIslandBody','wordIslandFamily','wordIslandSchool','wordIslandHome','wordIslandCity',
       'wordIslandJob','wordIslandSports','wordIslandNature','wordIslandTime','wordIslandClothes',
       'wordIslandTraffic','wordIslandAction','wordIslandAdjective','wordIslandQuestion','wordIslandTreasure'
      ].forEach(k => localStorage.setItem(k, save));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
      localStorage.setItem('hansen_starter_coins_given', '1');
    } catch (e) {}
  });
  const page = await ctx.newPage();

  const jsErrors = [], localFails = [];
  page.on('pageerror', e => jsErrors.push(String(e).slice(0, 100)));
  page.on('response', r => {
    if (r.status() >= 400 && r.url().indexOf('localhost') >= 0)
      localFails.push(r.status() + ' ' + r.url().split('/').pop().slice(0, 40));
  });

  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);

  const killModals = () => page.evaluate(() => {
    ['alertModal', 'hsnStoryModal', 'confirmModal'].forEach(id => {
      const m = document.getElementById(id);
      if (m) { m.classList.remove('show'); m.style.display = 'none'; }
    });
    document.querySelectorAll('.modal-bg').forEach(m => { m.classList.remove('show'); m.style.display = 'none'; });
    document.body.classList.remove('modal-open');
  });
  await killModals();

  const bosses = await page.evaluate(() => BOSSES.map((b, i) => ({ lv: i + 1, name: b.name })));
  const targets = ONLY.length ? bosses.filter(b => ONLY.includes(b.lv)) : bosses;
  const results = [];

  for (const b of targets) {
    const eJs = jsErrors.length, eLo = localFails.length;

    await page.evaluate(() => {
      try { if (window.__hansenFxLayer) { window.__hansenFxLayer.innerHTML = ''; window.__hansenFxLayer.style.visibility = ''; } } catch (e) {}
      try { if (window.__hansenFxLayerBack) { window.__hansenFxLayerBack.innerHTML = ''; window.__hansenFxLayerBack.style.visibility = ''; } } catch (e) {}
      document.querySelectorAll('canvas').forEach(c => { try { c.remove(); } catch (e) {} });
      try { if (window.__rafOrig) window.requestAnimationFrame = window.__rafOrig; } catch (e) {}
    });

    await page.evaluate((a) => {
      try { if (a.land) { window._s1FightIdx = a.lv - 1; } else { S.level = a.lv; } } catch (e) {}
      try { showScreen('boss'); } catch (e) {}
      try { startBoss(); } catch (e) {}
    }, { lv: b.lv, land: IS_LAND });
    // ⭐ v929: boss 引擎(2.44MB)改成了【按需加载】—— 进岛不下载, 首屏画完后空闲预取。
    //   探针是【绕过 showScreen 直接调 HansenBossAttack】的, 所以必须先等引擎真正就位,
    //   否则调到的是占位函数 → 特效为空 = 假警报。(真实玩家走 showScreen('boss'), 钩子会自动等它。)
    try { await page.waitForFunction(() => window.__hansenBossFXLoaded === true, { timeout: 25000 }); } catch (e) {}
    await page.waitForTimeout(420);
    await killModals();

    const shown = await page.evaluate(() => (document.querySelector('.boss-name') || {}).textContent || '');

    await page.evaluate((n) => {
      window.__fxTimers = [];
      if (!window.__stOrig) {
        window.__stOrig = window.setTimeout;
        window.setTimeout = function (f, d) { const id = window.__stOrig(f, d); try { window.__fxTimers.push(id); } catch (e) {} return id; };
      }
      window.__rafOrig = window.__rafOrig || window.requestAnimationFrame;
      try { HansenBossAttack({ name: n, hp: 440, maxHp: 440, color: '#ef4444' }, 72, 428, 500); } catch (e) {}
    }, b.name);

    let peakInk = 0, peakBack = 0, elapsed = 0;
    while (elapsed < 6200) {
      await page.waitForTimeout(140); elapsed += 140;
      const s = await page.evaluate(INK_JS);
      if (s.ink > peakInk) peakInk = s.ink;
      if (s.back > peakBack) peakBack = s.back;
      if (elapsed < 900) continue;                       // 巨翼/地狱之门等背景层特效要 ~0.8s 才展开完
      if (s.ink >= 2.0) break;                            // canvas 特效正在画
      if (s.front >= 3 || s.back > 0) break;              // DOM 特效已铺开
      if (elapsed >= 3000 && (s.front > 0 || s.cvs > 0 || s.back > 0)) break;   // 兜底: 有东西就拍
      if (elapsed >= 1500 && s.ink === 0 && s.front === 0 && s.cvs === 0 && s.back === 0) break;
    }

    const counts = await page.evaluate(() => {
      try { document.getAnimations().forEach(a => a.pause()); } catch (e) {}
      try { (window.__fxTimers || []).forEach(id => clearTimeout(id)); } catch (e) {}
      try { window.requestAnimationFrame = function () { return 0; }; } catch (e) {}
      var ink = 0, cvs = document.querySelectorAll('canvas');
      for (var i = 0; i < cvs.length; i++) {
        try {
          var cv = cvs[i], c2 = cv.getContext('2d'); if (!c2) continue;
          var h = Math.min(cv.height, 640);
          var d = c2.getImageData(0, 0, cv.width, h).data;
          var lit = 0, tot = 0;
          for (var j = 3; j < d.length; j += 32) { tot++; if (d[j] > 12) lit++; }
          if (tot) ink = Math.max(ink, Math.round(lit * 1000 / tot) / 10);
        } catch (e) {}
      }
      var F = window.__hansenFxLayer, B = window.__hansenFxLayerBack;
      return { front: F ? F.children.length : -1, back: B ? B.children.length : -1,
               canvas: cvs.length, ink: ink, backZ: B ? getComputedStyle(B).zIndex : '?',
               modalOpen: !!document.querySelector('.modal-bg.show') };
    });

    const A = `${OUT}/${TAG}_${b.lv}_A.png`, Bf = `${OUT}/${TAG}_${b.lv}_B.png`, C = `${OUT}/${TAG}_${b.lv}_C.png`;
    await page.screenshot({ path: A, clip: CLIP });
    // ⚠️ 必须用 visibility(不是 display): display:none 会【重置 CSS 动画】, 再显示时动画从头播 → 三帧不可比, 会测出假的差异
    await page.evaluate(() => {
      if (window.__hansenFxLayer) window.__hansenFxLayer.style.visibility = 'hidden';
      document.querySelectorAll('canvas').forEach(c => { c.style.visibility = 'hidden'; });
    });
    await page.screenshot({ path: Bf, clip: CLIP });
    await page.evaluate(() => {
      if (window.__hansenFxLayer) window.__hansenFxLayer.style.visibility = '';
      document.querySelectorAll('canvas').forEach(c => { c.style.visibility = ''; });
      if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.style.visibility = 'hidden';
    });
    await page.screenshot({ path: C, clip: CLIP });
    await page.evaluate(() => { if (window.__hansenFxLayerBack) window.__hansenFxLayerBack.style.visibility = ''; });

    results.push({
      island: TAG, lv: b.lv, name: b.name, shown,
      frontEls: counts.front, backEls: Math.max(counts.back, peakBack), canvases: counts.canvas,
      ink: counts.ink, peakInk: Math.max(peakInk, counts.ink), backZ: counts.backZ,
      modalOpen: counts.modalOpen, capturedAt: elapsed,
      jsErrors: jsErrors.slice(eJs), localFails: localFails.slice(eLo)
    });
  }

  fs.writeFileSync(`${OUT}/probe_${TAG}.json`, JSON.stringify(results, null, 1));
  console.log('PROBE_OK ' + results.length);
  await browser.close();
};

run().catch(e => { console.log('PROBE_FATAL ' + e); process.exit(1); });
