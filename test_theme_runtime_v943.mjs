#!/usr/bin/env node
/** v943 regression: Boss-only cinema suppression and legacy theme-state cleanup. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg'
};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filename = path.resolve(ROOT, relative);
  if (!filename.startsWith(ROOT + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': mime[path.extname(filename)] || 'application/octet-stream' });
  fs.createReadStream(filename).pipe(response);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

const executablePath = process.env.HANSEN_CHROMIUM_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('hansen_boss_theme', 'dark');
    localStorage.setItem('hansen_diamond_shop', JSON.stringify({
      owned: { theme_retired_history: true, theme_clouddream: true },
      equipped: 'theme_clouddream', pending: null, lastReceipt: null
    }));
    localStorage.setItem('hansen_unlocked_themes', JSON.stringify(['forest', 'retired-theme']));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenDiamondShop && window.HansenBossTheme &&
    document.getElementById('hsnCinemaCanvas'), null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const diamond = JSON.parse(localStorage.getItem('hansen_diamond_shop') || '{}');
    const basic = JSON.parse(localStorage.getItem('hansen_unlocked_themes') || '[]');
    return diamond.owned && !Object.prototype.hasOwnProperty.call(diamond.owned, 'theme_retired_history') &&
      basic.indexOf('retired-theme') < 0;
  });

  const migrated = await page.evaluate(() => ({
    equipped: HansenDiamondShop.getEquipped(),
    diamond: JSON.parse(localStorage.getItem('hansen_diamond_shop')),
    basic: JSON.parse(localStorage.getItem('hansen_unlocked_themes')),
    forest: HansenThemeLock.isUnlocked('forest')
  }));
  assert.equal(migrated.equipped, 'theme_clouddream', '合法钻石装备不得被历史 id 连坐清空');
  assert.deepEqual(Object.keys(migrated.diamond.owned), ['theme_clouddream'], '历史钻石主题 id 必须被安全清理');
  assert.deepEqual(migrated.basic, ['forest'], '历史基础主题 id 必须被安全清理');
  assert.equal(migrated.forest, true, '清理历史 id 后合法付费主题必须仍然解锁');
  assert.equal(await page.evaluate(() => HansenDiamondShop.isOwned('__proto__')), false,
    '对象原型名不能被误报为已购买的钻石主题');
  assert.equal(await page.evaluate(() => HansenDiamondShop.isOwned('constructor')), false,
    'constructor 不能被误报为已购买的钻石主题');
  await page.evaluate(() => {
    window.__hsnDiaEquip('__proto__');
    window.__hsnDiaEquip('constructor');
  });
  assert.equal(await page.evaluate(() => HansenDiamondShop.getEquipped()), 'theme_clouddream',
    '程序化装备原型键必须被拒绝，且不能覆盖当前合法主题');

  await page.evaluate(() => showScreen('boss'));
  await page.waitForTimeout(80);
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 0,
    'Boss 深空主题只在 Boss 屏抑制电影画布');

  await page.evaluate(() => showScreen('home'));
  await page.waitForFunction(() => document.getElementById('hsnCinemaCanvas'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 1,
    '离开 Boss 后必须恢复当前装备的动态主题');

  await page.evaluate(() => showScreen('boss'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 0, '再次进入 Boss 必须稳定抑制画布');
  await page.evaluate(() => HansenBossTheme.apply('cinema'));
  await page.waitForFunction(() => document.getElementById('hsnCinemaCanvas'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 1,
    'Boss 明确选择“电影场景”后必须恢复画布');
  await page.evaluate(() => HansenBossTheme.apply('light'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 0,
    'Boss 晨曦主题必须重新抑制画布');
  await page.evaluate(() => showScreen('home'));
  await page.waitForFunction(() => document.getElementById('hsnCinemaCanvas'));

  // 星海女帝页的 Boss 选关与实战共用 bossScreen：选关保留主题，真正开战才抑制。
  await page.goto(`http://127.0.0.1:${port}/island_season.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.HansenDiamondShop && window.HansenBossTheme &&
    document.getElementById('hsnCinemaCanvas'), null, { timeout: 15000 });
  await page.evaluate(() => showScreen('boss'));
  assert.equal(await page.evaluate(() => document.body.classList.contains('hsn-boss-noheader')), false,
    '星海女帝选关页不应错误套用普通岛 noheader 标记');
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 1,
    '星海女帝选关页仍应展示当前装备的动态主题');
  await page.evaluate(() => startBoss());
  await page.waitForFunction(() => document.body.classList.contains('hsn-boss-battle'));
  await page.waitForFunction(() => !document.getElementById('hsnCinemaCanvas'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 0,
    '星海女帝真正开战后深空主题必须抑制电影画布');
  await page.evaluate(() => stopBoss());
  await page.waitForFunction(() => !document.body.classList.contains('hsn-boss-battle'));
  await page.waitForFunction(() => document.getElementById('hsnCinemaCanvas'));
  assert.equal(await page.locator('#hsnCinemaCanvas').count(), 1,
    '星海女帝停战返回选关后必须恢复动态主题');

  assert.equal(errors.length, 0, `主题运行期出现页面错误: ${errors.join(' | ')}`);
  await context.close();

  // lateBoot 在 DOMContentLoaded 后 80ms 执行，必须经过 Boss guard，不能闪现画布。
  const raceContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await raceContext.addInitScript(() => {
    localStorage.setItem('hansen_boss_theme', 'dark');
    localStorage.setItem('hansen_diamond_shop', JSON.stringify({
      owned: { theme_clouddream: true }, equipped: 'theme_clouddream', pending: null, lastReceipt: null
    }));
    window.__bossCanvasAdds = 0;
    const observer = new MutationObserver(records => {
      const blocked = document.body && (document.body.classList.contains('hsn-boss-noheader') ||
        document.body.classList.contains('hsn-boss-battle'));
      if (!blocked) return;
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.id === 'hsnCinemaCanvas' || (node.querySelector && node.querySelector('#hsnCinemaCanvas'))) {
            window.__bossCanvasAdds++;
          }
        }
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  const racePage = await raceContext.newPage();
  const raceErrors = [];
  racePage.on('pageerror', error => raceErrors.push(String(error)));
  await racePage.goto(`http://127.0.0.1:${port}/island_animal.html`, { waitUntil: 'domcontentloaded' });
  await racePage.evaluate(() => showScreen('boss'));
  const raceSamples = [];
  let raceElapsed = 0;
  for (const at of [0, 30, 60, 90, 120, 220]) {
    if (at > raceElapsed) await racePage.waitForTimeout(at - raceElapsed);
    raceElapsed = at;
    raceSamples.push(await racePage.locator('#hsnCinemaCanvas').count());
  }
  assert.deepEqual(raceSamples, [0, 0, 0, 0, 0, 0],
    '延迟主题启动后的密集采样中不得出现 Boss 电影画布');
  assert.equal(await racePage.evaluate(() => window.__bossCanvasAdds), 0,
    '进入 Boss 后不得哪怕短暂创建再删除电影画布');
  assert.equal(raceErrors.length, 0, `延迟启动竞态出现页面错误: ${raceErrors.join(' | ')}`);
  await raceContext.close();

  // 试用主题优先级：Boss 抑制后回首页必须恢复同一试用；刷新后仍续用；
  // 将到期时间压到约 1 秒，限时验证到期后恢复原装备而不是默认背景。
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const trialContext = await browser.newContext({
      viewport: { width: 360, height: 640 }, reducedMotion
    });
    await trialContext.addInitScript(() => {
      if (sessionStorage.getItem('__hsn_v943_trial_seeded') === '1') return;
      sessionStorage.setItem('__hsn_v943_trial_seeded', '1');
      localStorage.setItem('hansen_boss_theme', 'dark');
      localStorage.setItem('hansen_diamond_shop', JSON.stringify({
        owned: { theme_clouddream: true }, equipped: 'theme_clouddream', pending: null, lastReceipt: null
      }));
      sessionStorage.setItem('hansen_dia_trial', JSON.stringify({
        id: 'theme_photo_magicschool', until: Date.now() + 60000
      }));
    });
    const trialPage = await trialContext.newPage();
    const trialErrors = [];
    trialPage.on('pageerror', error => trialErrors.push(String(error)));
    await trialPage.goto(`http://127.0.0.1:${port}/island_animal.html`, { waitUntil: 'domcontentloaded' });
    await trialPage.waitForFunction(() => window.HansenDiamondShop && window.HansenBossTheme &&
      document.getElementById('hsnCinemaCanvas') &&
      document.body.classList.contains('hsn-dia-theme_photo_magicschool'), null, { timeout: 15000 });
    const beforeReload = await trialPage.evaluate(() => JSON.parse(sessionStorage.getItem('hansen_dia_trial')));

    await trialPage.evaluate(() => showScreen('boss'));
    await trialPage.waitForFunction(() => !document.getElementById('hsnCinemaCanvas'), null, { timeout: 3000 });
    await trialPage.evaluate(() => showScreen('home'));
    await trialPage.waitForFunction(() => document.getElementById('hsnCinemaCanvas') &&
      document.body.classList.contains('hsn-dia-theme_photo_magicschool'), null, { timeout: 3000 });
    assert.equal(await trialPage.evaluate(() => JSON.parse(sessionStorage.getItem('hansen_dia_trial')).id),
      'theme_photo_magicschool', `${reducedMotion}: 离开 Boss 后必须恢复同一试用主题`);
    await trialPage.evaluate(() => {
      for (let i = 0; i < 8; i++) { showScreen('boss'); showScreen('home'); }
    });
    assert.equal(await trialPage.locator('.dia-trial-bar').count(), 1,
      `${reducedMotion}: 快速往返 Boss 不得堆叠多个试用提示条`);
    assert.equal(await trialPage.evaluate(() => JSON.parse(sessionStorage.getItem('hansen_dia_trial')).until),
      beforeReload.until, `${reducedMotion}: 快速往返 Boss 不得延长或缩短试用截止时间`);

    await trialPage.reload({ waitUntil: 'domcontentloaded' });
    await trialPage.waitForFunction(() => window.HansenDiamondShop &&
      document.getElementById('hsnCinemaCanvas') &&
      document.body.classList.contains('hsn-dia-theme_photo_magicschool'), null, { timeout: 15000 });
    const afterReload = await trialPage.evaluate(() => JSON.parse(sessionStorage.getItem('hansen_dia_trial')));
    assert.equal(afterReload.id, beforeReload.id, `${reducedMotion}: 刷新后试用主题 id 必须保持`);
    assert.equal(afterReload.until, beforeReload.until, `${reducedMotion}: 刷新不得重置试用截止时间`);

    await trialPage.evaluate(() => {
      const trial = JSON.parse(sessionStorage.getItem('hansen_dia_trial'));
      trial.until = Date.now() + 1200;
      sessionStorage.setItem('hansen_dia_trial', JSON.stringify(trial));
      HansenDiamondShop.restoreActiveTheme();
    });
    await trialPage.waitForFunction(() => !sessionStorage.getItem('hansen_dia_trial') &&
      document.getElementById('hsnCinemaCanvas') &&
      document.body.classList.contains('hsn-dia-theme_clouddream') &&
      !document.body.classList.contains('hsn-dia-theme_photo_magicschool'), null, { timeout: 5000 });
    assert.equal(await trialPage.evaluate(() => HansenDiamondShop.getEquipped()), 'theme_clouddream',
      `${reducedMotion}: 试用到期后必须恢复原装备主题`);
    assert.equal(trialErrors.length, 0, `${reducedMotion}: 试用主题回归出现页面错误: ${trialErrors.join(' | ')}`);
    await trialContext.close();
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('✅ v943 theme runtime regression passed (Boss scope + trial restore/expiry + legacy state migration)');
