#!/usr/bin/env node
// v946 HF5: Boss 彩虹倒计时在减少动态效果、亮暗主题与真实触摸期间都必须可见并持续缩短。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';
/* 🔴v963 合同同步: 版本钉改为动态读 VERSION(资源戳/appVersion随候选演进,合同本体不变) */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const bossSource = read('hansen_boss_lock.js');
const a11ySource = read('hansen_accessibility.js');
const workerSource = read('sw_v944.js');
const htmlFiles = ['template.html', 'check.html', ...fs.readdirSync(ROOT)
  .filter(name => /^island_[^/]+\.html$/.test(name)).sort()];

assert.equal(htmlFiles.length, 29, 'Boss 资源键必须覆盖 template、check 与 27 个岛页');
for (const name of htmlFiles) {
  const source = read(name);
  assert.equal((source.match(new RegExp('hansen_boss_lock\\.js\\?v='+__APPV__,'g')) || []).length, 1,
    `${name}: 必须且只能加载一次 v951 Boss 运行时`);
  assert.doesNotMatch(source, /hansen_boss_lock\.js\?v=946-hf2/,
    `${name}: 旧 HF2 Boss 运行时不得复活`);
}
assert.equal((workerSource.match(new RegExp("'\\./hansen_boss_lock\\.js\\?v="+__APPV__+"'",'g')) || []).length, 1,
  'Service Worker 必须精确缓存一次 v951 Boss 运行时');
assert.doesNotMatch(workerSource, /'\.\/hansen_boss_lock\.js\?v=946-hf2'/,
  'Service Worker 不得继续精确缓存旧 Boss 运行时');
assert.match(workerSource, /CACHE_PREFIX \+ 'shell-149'/);
assert.match(workerSource, /CACHE_PREFIX \+ 'pages-147'/);
assert.match(workerSource, /CACHE_PREFIX \+ 'assets-147'/);

// 锁死本次根因：全局减少动态规则仍存在，但功能性计时条的三次 transition 写入必须逐一行内提权。
assert.match(a11ySource, /transition-duration:\.001ms!important/,
  '测试必须真实覆盖会压缩普通 transition 的减少动态规则');
assert.match(bossSource, /setProperty\('transition', 'none', 'important'\)/);
assert.match(bossSource, /setProperty\('transition', 'transform 0\.3s ease-out', 'important'\)/);
assert.match(bossSource, /setProperty\('transition', 'transform ' \+ seconds \+ 's linear', 'important'\)/);

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};
let server = null;
let browser = null;
const listen = instance => new Promise((resolve, reject) => {
  instance.once('error', reject);
  instance.listen(0, '127.0.0.1', resolve);
});
const closeServer = instance => new Promise(resolve => {
  if (!instance || !instance.listening) return resolve();
  instance.close(() => resolve());
  try { instance.closeAllConnections?.(); } catch (_) {}
});

function sampleTimer(page) {
  return page.evaluate(() => {
    const track = document.getElementById('bossTimerEl');
    const fill = document.getElementById('bossTimerFill');
    if (!track || !fill) return null;
    const t = track.getBoundingClientRect();
    const f = fill.getBoundingClientRect();
    const style = getComputedStyle(fill);
    const bossHp = document.getElementById('bossHPFill')?.getBoundingClientRect();
    const heroHp = document.getElementById('heroHPFill')?.getBoundingClientRect();
    return {
      ratio: t.width ? f.width / t.width : 0,
      trackWidth: t.width, trackHeight: t.height,
      leftDelta: Math.abs(f.left - t.left),
      display: style.display, visibility: style.visibility, opacity: Number(style.opacity),
      background: style.backgroundImage,
      transitionProperty: style.transitionProperty,
      transitionDuration: Number.parseFloat(style.transitionDuration),
      transitionTiming: style.transitionTimingFunction,
      transitionPriority: fill.style.getPropertyPriority('transition'),
      timerCount: document.querySelectorAll('#bossTimerEl').length,
      fillCount: document.querySelectorAll('#bossTimerFill').length,
      insideHp: Boolean(fill.closest('.boss-hp-bar,.hero-hp-bar')),
      bossHpWidth: bossHp?.width ?? 0, heroHpWidth: heroHp?.width ?? 0,
      bossHpText: document.getElementById('bossHPText')?.textContent || '',
      heroHpText: document.getElementById('heroHPText')?.textContent || '',
      done: document.getElementById('bossOpts')?.dataset.done ?? null,
      word: window._bossWord?.en || '',
      animations: typeof fill.getAnimations === 'function' ? fill.getAnimations().length : -1
    };
  });
}

function assertVisible(sample, label) {
  assert(sample, `${label}: 倒计时 DOM 缺失`);
  assert.equal(sample.timerCount, 1, `${label}: 倒计时轨道重复`);
  assert.equal(sample.fillCount, 1, `${label}: 彩虹填充重复`);
  assert(sample.trackWidth >= 300 && sample.trackHeight >= 3, `${label}: 轨道尺寸异常`);
  assert(sample.ratio > 0.75 && sample.ratio <= 1, `${label}: 彩虹条不在可见倒计时范围 ${sample.ratio}`);
  assert(sample.leftDelta <= 1, `${label}: 彩虹条左端没有贴齐轨道`);
  assert.equal(sample.display, 'block');
  assert.equal(sample.visibility, 'visible');
  assert(sample.opacity > 0.9, `${label}: 彩虹条透明`);
  assert.match(sample.background, /linear-gradient/);
  for (const color of ['34, 197, 94', '251, 191, 36', '239, 68, 68']) {
    assert(sample.background.includes(color), `${label}: 彩虹渐变缺少 ${color}`);
  }
  assert.equal(sample.transitionPriority, 'important', `${label}: 功能性 transition 未提权`);
  assert.equal(sample.transitionProperty, 'transform');
  assert(sample.transitionDuration >= 7.5, `${label}: 倒计时又被压短为 ${sample.transitionDuration}s`);
  assert.equal(sample.transitionTiming, 'linear');
  assert.equal(sample.insideHp, false, `${label}: 倒计时误插进血条`);
}

async function preparePage(reducedMotion, theme) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion,
    serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('hansen_onboarded', '1');
    localStorage.setItem('hsnViewMode', 'desktop');
    localStorage.setItem('wordIsland', JSON.stringify({
      totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 1,
      coins: 9999, stats: { maxCombo: 3 }, wrongs: {}, bossUnlocked: 20
    }));
    window.__bossTimerTouchMoves = 0;
    document.addEventListener('touchmove', () => { window.__bossTimerTouchMoves++; }, { capture: true, passive: true });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/island_animal.html?boss-timer-hf5=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.startBoss === 'function' && window.HansenBossTheme);
  await page.evaluate(selectedTheme => {
    for (const id of ['alertModal', 'hsnStoryModal']) {
      const element = document.getElementById(id);
      if (element) { element.classList.remove('show'); element.style.display = 'none'; }
    }
    document.body.classList.remove('modal-open');
    window.S.level = 20;
    window.S.bossUnlocked = 20;
    window._hansenRebattleLv = 1;
    window.__hbuNewModeProb = 0;
    if (window.HansenBossProgress) window.HansenBossProgress.getUnlockedBossLv = () => 20;
    window.HansenBossTheme.apply(selectedTheme);
    window.showScreen('boss');
    window.startBoss();
  }, theme);
  await page.waitForSelector('#bossTimerFill');
  return { context, page, errors };
}

let origin = '';
async function run() {
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);
      if (!filename.startsWith(ROOT + path.sep) || !fs.statSync(filename).isFile()) throw new Error('not found');
      response.writeHead(200, { 'content-type': mime[path.extname(filename)] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(filename).pipe(response);
    } catch (_) { response.writeHead(404).end('not found'); }
  });
  await listen(server);
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

  for (const reducedMotion of ['no-preference', 'reduce']) {
    for (const theme of ['dark', 'light']) {
      const label = `${reducedMotion}/${theme}`;
      const { context, page, errors } = await preparePage(reducedMotion, theme);
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches),
        reducedMotion === 'reduce', `${label}: 浏览器动效档位不正确`);
      /* 🔴v1063：先等倒计时**确实跑起来**再采样。
         原来一到就取样，常常撞上「transition 尚未启动」的窗口——
         此时 scaleX 还是 1，两次采样都得 ratio=1，于是断言随机失败。
         实测证据：同一测试不同次跑，读到的 transitionDuration 会在 8s / 60s 之间变，
         说明抓到的根本不是同一轮计时。 */
      await page.waitForFunction(() => {
        const tr = document.getElementById('bossTimerEl');
        const fl = document.getElementById('bossTimerFill');
        if (!tr || !fl) return false;
        const d = Number.parseFloat(getComputedStyle(fl).transitionDuration) || 0;
        if (d <= 0) return false;
        const t = tr.getBoundingClientRect(), f = fl.getBoundingClientRect();
        return t.width > 0 && (f.width / t.width) < 0.995;   /* 已开始收缩 */
      }, null, { timeout: 20000 }).catch(() => {});

      const first = await sampleTimer(page);
      assertVisible(first, `${label}/初始`);
      const t0 = Date.now();
      await page.waitForTimeout(500);
      const second = await sampleTimer(page);
      const elapsed = (Date.now() - t0) / 1000;
      assertVisible(second, `${label}/500ms`);
      /* 🔴v1063：原来写死「500ms 内至少缩短 0.035」，等价于假设倒计时总长 ≤14.3 秒。
         而 Lv.1 Boss 的 timeLimit 是 **60 秒**（hansen_boss_lock.js 的 BOSS_CFG），
         500ms 只该缩短约 0.83% —— 于是这条断言长期红着，报的却是产品没有的问题。
         写死的常量必然随配置漂移（本轮已在任务数、账号标识、force 语义上踩过同一件事）。
         改为**从实际 transition 时长推导**：条子是 scaleX(1)→scaleX(0) 的线性过渡，
         所以任意时间窗内的缩短量必然 ≈ 经过时间 / 总时长。这样倒计时怎么调都不会失配，
         而且比原来更严：不只要求"在缩短"，还要求**速率对得上配置**。 */
      const shrink = first.ratio - second.ratio;
      const dur = second.transitionDuration || first.transitionDuration;
      assert(dur > 0, `${label}: 读不到彩虹条的过渡时长(${dur})`);
      const expected = elapsed / dur;
      assert(shrink > 0, `${label}: 彩虹条没有在缩短 ${first.ratio}→${second.ratio}`);
      assert(shrink >= expected * 0.4 && shrink <= expected * 2.5,
        `${label}: 彩虹条缩短速率与配置不符 —— 实测 ${shrink.toFixed(4)}，`
        + `按 ${dur}s 总时长、经过 ${elapsed.toFixed(3)}s 应约 ${expected.toFixed(4)}`);
      assert.equal(second.bossHpText, first.bossHpText, `${label}: 只计时却改了 Boss HP`);
      assert.equal(second.heroHpText, first.heroHpText, `${label}: 只计时却改了勇者 HP`);
      assert(Math.abs(second.bossHpWidth - first.bossHpWidth) < 0.5, `${label}: 计时误改 Boss 血条`);
      assert(Math.abs(second.heroHpWidth - first.heroHpWidth) < 0.5, `${label}: 计时误改勇者血条`);

      if (reducedMotion === 'reduce' && theme === 'light') {
        const client = await context.newCDPSession(page);
        await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
        const point = y => [{ x: 195, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(730) });
        for (let i = 0; i < 30; i++) {
          await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(730 - i * 8) });
          await page.waitForTimeout(20);
        }
        const duringTouch = await sampleTimer(page);
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert(second.ratio - duringTouch.ratio >= 0.04,
          `${label}: 手指移动期间倒计时停止 ${second.ratio}→${duringTouch.ratio}`);
        assert((await page.evaluate(() => window.__bossTimerTouchMoves)) >= 20,
          `${label}: 没有产生真实触摸移动事件`);
        await page.waitForTimeout(200);
        const afterTouch = await sampleTimer(page);
        assert(duringTouch.ratio - afterTouch.ratio >= 0.01,
          `${label}: 松手后倒计时没有继续`);
      }
      assert.deepEqual(errors, [], `${label}: 页面出现运行异常`);
      await context.close();
    }
  }

  // 独立验证答题回满、下一题只保留一根新计时条，以及停战后彻底清理。
  const { context, page, errors } = await preparePage('reduce', 'light');
  await page.waitForTimeout(600);
  const active = await sampleTimer(page);
  assertVisible(active, '状态链/答题前');
  await page.evaluate(() => {
    const correct = window._bossCorrectIdx;
    window.bossAnswer(typeof correct === 'number' ? correct : 0);
  });
  await page.waitForTimeout(400);
  const answered = await sampleTimer(page);
  assert(answered && answered.ratio >= 0.98, `答题后彩虹条没有回满: ${answered?.ratio}`);
  assert.equal(answered.animations, 0, '答题后旧 transition 仍在运行');
  await page.waitForFunction(previous => {
    const options = document.getElementById('bossOpts');
    return document.getElementById('bossTimerFill') && options?.dataset.done === '' &&
      window._bossWord?.en && window._bossWord.en !== previous;
  }, active.word, { timeout: 6000 });
  const next = await sampleTimer(page);
  assertVisible(next, '状态链/下一题');
  assert.equal(next.animations, 1, '下一题必须只有一条新的倒计时 transition');
  await page.evaluate(() => window.stopBoss());
  assert.equal(await page.locator('#bossTimerEl').count(), 0, '停战后倒计时 DOM 必须删除');
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#bossTimerEl').count(), 0, '停战后倒计时不得复活');
  assert.deepEqual(errors, [], '答题/下一题/停战状态链不得出现页面异常');
  await context.close();
}

try {
  await run();
  console.log('Boss timer HF5: 4 motion/theme states + touch + HP isolation + answer/reset/stop ✅');
} finally {
  if (browser) await browser.close().catch(() => {});
  await closeServer(server);
}
