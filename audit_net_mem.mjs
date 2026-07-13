/* audit_net_mem.mjs — D.弱网体验 + E.内存泄漏 真机体检
 *
 * D. 弱网: 模拟 3G(750kbps/延迟100ms), 量:
 *    ① 多久能看到内容(白屏时长) ② 多久能点(可交互) ③ 音频缺失时会不会卡死
 * E. 内存: 反复进出游戏 40 次, JS 堆涨幅 —— 泄漏会让低端手机越玩越卡直到闪退。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8877';
let pass = 0, fail = 0;
const chk = (n, ok, note) => { ok ? pass++ : fail++; console.log(`   ${ok ? '✅' : '❌'} ${n}${note ? '  ' + note : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

  // ══ D. 3G 弱网 ══
  console.log('  ══ D. 弱网体验(3G · 750kbps · 100ms延迟) ══');
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 750 * 1024 / 8, uploadThroughput: 250 * 1024 / 8 });
    const t0 = Date.now();
    let fcp = 0, tti = 0;
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // 首次有内容
    for (let i = 0; i < 200; i++) {
      const has = await p.evaluate(() => (document.body.innerText || '').length > 50).catch(() => false);
      if (has) { fcp = Date.now() - t0; break; }
      await p.waitForTimeout(100);
    }
    // 可交互(showScreen 就位 + 首页可见)
    for (let i = 0; i < 300; i++) {
      const ok = await p.evaluate(() => typeof window.showScreen === 'function' && !!window.S).catch(() => false);
      if (ok) { tti = Date.now() - t0; break; }
      await p.waitForTimeout(100);
    }
    chk('3G 下多久看到内容(白屏结束)', fcp > 0 && fcp < 6000, `${fcp}ms (预算<6000ms)`);
    chk('3G 下多久可交互', tti > 0 && tti < 15000, `${tti}ms (预算<15000ms)`);
    await c.close();
  }
  // 音频缺失不能卡死(线上 CDN 偶发 404)
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const p = await c.newPage();
    await p.route('**/*.mp3', route => route.abort());   // 所有音频全部失败
    const errs = []; p.on('pageerror', e => errs.push(1));
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(2400);
    await p.evaluate(() => {
      ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      document.body.classList.remove('modal-open');
    });
    const ok = await p.evaluate(async () => {
      try {
        showScreen('explore'); await new Promise(r => setTimeout(r, 600));
        showWord(0); await new Promise(r => setTimeout(r, 500));
        if (typeof speak === 'function') speak((window.allW && allW[0] && allW[0].en) || 'apple');
        await new Promise(r => setTimeout(r, 1200));
        return true;
      } catch (e) { return false; }
    });
    chk('全部音频404 → 页面不卡死不报错', ok && errs.length === 0, `JS报错 ${errs.length}`);
    await c.close();
  }

  // ══ E. 内存泄漏 ══
  console.log('\n  ══ E. 内存泄漏(反复进出游戏 40 次) ══');
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => { try { localStorage.setItem('wordIslandLand1', JSON.stringify({ totalAnswers: 30, totalCorrect: 28, learned: [0, 1, 2, 3], level: 5, coins: 500, stats: { gameCounts: {} }, wrongs: { 0: 1 } })); } catch (e) { } });
    const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/island_land1.html`, { waitUntil: 'load', timeout: 60000 });
    await p.waitForTimeout(2400);
    await p.evaluate(() => {
      ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      document.body.classList.remove('modal-open');
    });
    const cdp = await c.newCDPSession(p);
    const heap = async () => {
      await cdp.send('HeapProfiler.collectGarbage').catch(() => { });
      const m = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
      return Math.round(m / 1024 / 1024 * 10) / 10;
    };
    const h0 = await heap();
    const screens = ['moles', 'fish', 'bubble', 'eagle', 'speed', 'cards', 'stats', 'pet'];
    for (let i = 0; i < 40; i++) {
      const sc = screens[i % screens.length];
      await p.evaluate((s) => { try { showScreen(s); } catch (e) { } }, sc);
      await p.waitForTimeout(140);
      await p.evaluate(() => { try { showScreen('home'); } catch (e) { } });
      await p.waitForTimeout(90);
    }
    const h1 = await heap();
    // 定时器泄漏: 回到首页后不该有一堆游戏定时器还在跑
    const timers = await p.evaluate(() => {
      let alive = 0;
      const id = setInterval(() => { }, 99999); clearInterval(id);
      return Number(id);   // 粗略: 分配过的定时器总量
    });
    chk('40 次进出后 JS 堆涨幅 < 18MB', (h1 - h0) < 18, `${h0}MB → ${h1}MB (+${Math.round((h1 - h0) * 10) / 10}MB)`);
    console.log(`   · 累计分配过的定时器 id: ${timers}(参考值, 只增不减是正常的)`);
    await c.close();
  }

  console.log(`\n  ══ ${pass} 项通过 · ${fail} 项失败 ══`);
  await b.close();
  if (fail) process.exit(1);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
