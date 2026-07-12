/* ⭐ v929 加载性能探针 (Hansen: "进岛很卡·图片加载不出来·点打Boss卡在那儿·要极致快·上线前最高优先级")
 *
 * 量【用户真正感觉到的东西】, 不是 load 事件那种没意义的数字:
 *   · 看到内容   = 首页模式卡出现(用户眼里"这个岛开了")
 *   · 可点击     = showScreen 就绪(用户能开始操作)
 *   · 图标画完   = 首屏 12 个模式卡图标全部真的画在屏幕上(Hansen 抱怨的"图片加载不出来")
 *   · 关键路径   = load 之前下载的字节数(这才是决定快慢的东西; load 之后的后台预取不算)
 *
 * 在【模拟 4G + gzip】下量 —— 和用户手机上的 CloudBase 一致(CloudBase 对文本开 gzip, 本地裸 http 不开,
 * 不模拟 gzip 会把结果测得比真实差 2~3 倍, 从而做出错误的优化决策)。
 *
 * 输出 JSON: {island, content, interactive, icons, criticalKB, requests}
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';

const PORT = process.argv[2] || '8891';
const ISLANDS = (process.argv[3] || 'island_land3.html,island_season.html,island_animal.html').split(',');

(async () => {
  const out = [];
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  for (const ISL of ISLANDS) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try {
        localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 13, coins: 678, stats: { maxCombo: 3 }, wrongs: {} }));
        for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
      } catch (e) { }
    });
    const p = await c.newPage();
    // 模拟普通 4G: 4Mbps 下行 / 40ms 延迟
    const cdp = await c.newCDPSession(p);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8, latency: 40
    });

    let bytes = 0, reqs = 0, loadDone = false;
    p.on('response', async r => {
      if (loadDone) return;                       // 只算【关键路径】: load 之前的
      reqs++;
      try {
        const h = await r.allHeaders();
        bytes += parseInt(h['content-length'] || '0') || 0;
      } catch (e) { }
    });

    const rec = { island: ISL, content: -1, interactive: -1, icons: -1, criticalKB: -1, requests: -1, err: '' };
    try {
      const t0 = Date.now();
      await p.goto(`http://localhost:${PORT}/${ISL}`, { waitUntil: 'commit', timeout: 60000 });
      await p.waitForFunction(() => document.querySelectorAll('.mode-card').length > 0, { timeout: 45000 });
      rec.content = Date.now() - t0;
      await p.waitForFunction(() => typeof window.showScreen === 'function', { timeout: 45000 });
      rec.interactive = Date.now() - t0;
      await p.waitForFunction(() => {
        const im = [...document.querySelectorAll('.mode-card img')];
        return im.length > 0 && im.every(x => x.complete && x.naturalWidth > 0);
      }, { timeout: 45000 });
      rec.icons = Date.now() - t0;
      await p.waitForLoadState('load', { timeout: 45000 });
      loadDone = true;
      rec.criticalKB = Math.round(bytes / 1024);
      rec.requests = reqs;
    } catch (e) {
      rec.err = String(e).slice(0, 70);
      loadDone = true;
    }
    out.push(rec);
    await c.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})().catch(e => console.log(JSON.stringify([{ island: '?', err: String(e).slice(0, 80) }])));
