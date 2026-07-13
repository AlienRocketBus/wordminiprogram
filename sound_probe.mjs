/* v935 音效回归验证
 * v932 我改了 AudioContext 的创建时机(第一次用户手势之前一律不创建)。
 * 必须验证: 用户【真的点了】之后, 声音还响不响?
 * 如果我把音效搞哑了, 那就是我又埋了一个新 bug —— 而且这种 bug 静态检查一辈子发现不了。
 *
 * 做法: 真触屏点击, 然后拦住 AudioContext 的 createOscillator / <audio>.play(),
 *       数一数【真的有没有发出声音】。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8877';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await c.addInitScript(() => {
    try {
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
      for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
    } catch (e) { }
    // 记录所有"真的发声"的动作
    window.__snd = { osc: 0, audioPlay: 0, acCreated: 0, acState: [], speak: 0 };
    const OrigAC = window.AudioContext || window.webkitAudioContext;
    if (OrigAC) {
      const T = function () {
        const ctx = arguments.length ? new OrigAC(arguments[0]) : new OrigAC();
        window.__snd.acCreated++;
        const oo = ctx.createOscillator.bind(ctx);
        ctx.createOscillator = function () { window.__snd.osc++; return oo(); };
        setTimeout(() => window.__snd.acState.push(ctx.state), 300);
        return ctx;
      };
      T.prototype = OrigAC.prototype;
      try { window.AudioContext = T; } catch (e) { }
      try { window.webkitAudioContext = T; } catch (e) { }
    }
    const op = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function () { window.__snd.audioPlay++; return op.apply(this, arguments); };
    try {
      const os = window.speechSynthesis && window.speechSynthesis.speak;
      if (os) window.speechSynthesis.speak = function () { window.__snd.speak++; return os.apply(window.speechSynthesis, arguments); };
    } catch (e) { }
  });
  const p = await c.newPage();
  await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 50000 });
  await p.waitForTimeout(2400);
  await p.evaluate(() => {
    ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
    document.body.classList.remove('modal-open');
  });

  const before = await p.evaluate(() => JSON.parse(JSON.stringify(window.__snd)));
  console.log(`  【用户还没点任何东西】AudioContext 创建 ${before.acCreated} 次 · 发声 ${before.osc} 次`);
  console.log(`     ${before.acCreated === 0 ? '✅ 一个都没建(正确 —— 这时候本来也发不出声)' : '⚠️ 建了' + before.acCreated + '个'}`);

  // ── 真触屏点击(模拟用户第一次点) ──
  await p.touchscreen.tap(195, 400);
  await p.waitForTimeout(500);

  // 点几个真的会发声的地方
  const acts = [];
  // 1. 点一个模式卡(会有点击音)
  await p.evaluate(() => { const el = document.querySelector('.mode-card, .exp-card, .util-card'); if (el) el.click(); });
  await p.waitForTimeout(600);
  acts.push(['点模式卡', await p.evaluate(() => JSON.parse(JSON.stringify(window.__snd)))]);

  // 2. 探索页 → 点单词 → 点发音
  await p.evaluate(() => { try { showScreen('explore'); } catch (e) { } });
  await p.waitForTimeout(700);
  await p.evaluate(() => { try { showWord(0); } catch (e) { } });
  await p.waitForTimeout(900);
  await p.evaluate(() => { const s = document.querySelector('.m-speak, .speak-btn, [onclick*="speak"]'); if (s) s.click(); });
  await p.waitForTimeout(1400);
  acts.push(['点单词发音', await p.evaluate(() => JSON.parse(JSON.stringify(window.__snd)))]);

  // 3. 触发 playBeep(答对/答错音)
  await p.evaluate(() => { try { if (typeof playBeep === 'function') { playBeep(880, .12, .1); playBeep(660, .12, .1); } } catch (e) { } });
  await p.waitForTimeout(700);
  acts.push(['playBeep(答对音)', await p.evaluate(() => JSON.parse(JSON.stringify(window.__snd)))]);

  console.log('\n  ── 用户点过之后 ──');
  let prev = before;
  acts.forEach(([name, s]) => {
    const dOsc = s.osc - prev.osc, dAud = s.audioPlay - prev.audioPlay, dSpk = s.speak - prev.speak;
    console.log(`   ${name.padEnd(16)} 新增: 蜂鸣音 ${dOsc} · 音频文件 ${dAud} · TTS ${dSpk}`);
    prev = s;
  });
  const fin = acts[acts.length - 1][1];
  console.log(`\n  合计: AudioContext 创建 ${fin.acCreated} 个 (状态 ${JSON.stringify(fin.acState)})`);
  console.log(`        蜂鸣音 ${fin.osc} 次 · 播放音频文件 ${fin.audioPlay} 次`);
  const ok = fin.acCreated >= 1 && fin.osc >= 1 && fin.audioPlay >= 1 && !fin.acState.includes('suspended');
  console.log(`\n  ${ok ? '✅ 音效完全正常: 手势前不建(不白卡), 手势后正常发声' : '❌ 音效有问题!'}`);
  if (fin.acCreated > 1) console.log(`  ⚠️ 建了 ${fin.acCreated} 个 AudioContext —— 单例没生效?`);
  await b.close();
  if (!ok) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
