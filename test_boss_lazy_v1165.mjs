/* test_boss_lazy_v1165.mjs —— Boss 引擎和攻击图只在真要用时才加载，Boss 战照样好玩
 *
 * 事故（v1163 实测，4G + 4 倍慢 CPU）：每开一个岛，1.23MB 的 hansen_boss_attack.js 在 1.2 秒内被执行，
 * 它一执行又下约 2MB 的攻击特效图，hansen_cards.js 再把 20 张 Boss 头像（≈2.9MB）全下一遍。
 * 原因：hansen_boss_lock.js 的 armSettings 只看 #settingsContent 里「有没有东西」，
 * 而静音/主题/备份等模块开机就往里塞开关 → 设置页从没打开，引擎也照样被加载。
 *
 * 合同（真浏览器、真点按）：
 *   L1 进岛停在菜单：引擎不执行、攻击图一张不下；空闲时只用 <link rel=prefetch> 把引擎文件下进缓存
 *   L2 Boss 头像：没打开过选关墙 → 最多下「现在能打的 + 下一关」两张；打开过之后 → 已解锁的 + 下一关
 *   L3 打开设置页 → 引擎按需加载，「Boss 特效调节」那一行出现
 *   L4 点「挑战BOSS」（真点按）→ 选关墙出现，引擎在后台准备好
 *   L5 打 Boss：赢（Boss 被打倒、大满贯进度记上这一关）、输（勇者倒下）都走得通，没有脚本错误
 *   L6 72 小时全开放期：选关墙 20 关都能打；全开放结束：只开第 1 关，其余是 🔒
 *   L7 伪装管理员入口：引擎没加载时点一下也能打开密码门；IndexedDB 里的「永久锁」先补回再开门
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERSION = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });
const SPRITE = /bosses\/(?:mechfist_real|sunball_real|chaoswave_real|alienbeam_real|vfang_|shuriken|hammer_real|rexclaw_|rexjaw_|zb_|zf_|tl_bolt)/;

/* 新孩子（只跳过首页引导）。extra 里的键在第一次加载前写入，之后刷新不再清空 */
async function openIsland(file, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(seed => {
    try {
      if (!sessionStorage.getItem('__s')) {
        localStorage.clear(); localStorage.setItem('hansen_onboarded', '1');
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        sessionStorage.setItem('__s', '1');
      }
    } catch (e) {}
  }, extra);
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  const reqs = []; page.on('request', r => reqs.push(r.url().replace(BASE, '')));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.startBoss === 'function' && typeof window.hansenStartRebattle === 'function' &&
    typeof window.__hansenBossFXReady === 'function' && document.readyState === 'complete', null, { timeout: 30000 });
  /* 新孩子的欢迎弹窗是开机后才弹的，常常晚于这一刻（复查实测 4 次里 2 次）→ 弹出来又挡住后面的真手指点按。
     等它出来再点掉；没有弹窗的孩子最多多等 2.5 秒 */
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(b => /开始冒险/.test(b.textContent) && b.offsetParent); if (b) { b.click(); return true; } return false; }, null, { timeout: 2500, polling: 100 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page, errs, reqs };
}
const engineState = page => page.evaluate(() => ({
  loaded: !!window.__hansenBossFXLoaded,
  scriptTag: !!document.querySelector('script[src*="hansen_boss_attack"]'),
  prefetchLink: !!document.querySelector('link[rel="prefetch"][href*="hansen_boss_attack"]'),
  entry: !!document.getElementById('hbafxEntry'),
}));
const lvReqs = reqs => [...new Set(reqs.filter(u => /bosses\/lv\d\d\.webp/.test(u)).map(u => +u.match(/lv(\d\d)/)[1]))].sort((a, b) => a - b);
async function tap(page, selector) {
  const box = await page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'auto' });
    return null;
  }, selector);
  await page.waitForTimeout(250);
  const p = await page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return null;
    const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: !!hit && (hit === el || el.contains(hit)) };
  }, selector);
  if (!p) return false;
  await page.touchscreen.tap(p.x, p.y);
  return p.hit;
}
/* 打一场：mode = 'win' 一直答对 / 'lose' 一直答错。返回结局 */
async function fight(page, mode) {
  for (let k = 0; k < 160; k++) {
    const st = await page.evaluate(() => ({ active: !!(typeof bossActive !== 'undefined' && bossActive), n: document.querySelectorAll('#bossOpts .boss-opt').length, done: !!(document.getElementById('bossOpts') || {}).dataset?.done }));
    if (!st.active) break;
    if (st.n && !st.done) {
      await page.evaluate(m => { const c = window._bossCorrectIdx; const n = document.querySelectorAll('#bossOpts .boss-opt').length; bossAnswer(m === 'win' ? c : (c + 1) % n); }, mode);
    }
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);
  return page.evaluate(() => ({ active: !!(typeof bossActive !== 'undefined' && bossActive), bossHP: bossHP, heroHP: heroHP, beaten: (window.S && S.stats && S.stats.bossBeaten) || 0,
    text: (document.getElementById('bossContent') || {}).innerText || '' }));
}

/* ── L1 / L2：停在岛屿菜单 ── */
console.log('\n▶ L1/L2 新孩子停在动物岛菜单 12 秒');
{
  const { ctx, page, errs, reqs } = await openIsland('island_animal.html');
  await page.waitForTimeout(12000);
  const st = await engineState(page);
  ok(!st.loaded && !st.scriptTag, `Boss 引擎没有被执行（loaded=${st.loaded} script=${st.scriptTag}）`);
  ok(!reqs.some(u => SPRITE.test(u)), `攻击特效图一张没下（实下 ${reqs.filter(u => SPRITE.test(u)).length} 张）`);
  ok(st.prefetchLink, '空闲时用 <link rel=prefetch> 把引擎文件下进缓存（不执行）');
  const lv = lvReqs(reqs);
  ok(lv.length <= 2 && lv.every(n => n <= 2), `没打开过选关墙：Boss 头像最多两张（实下 ${lv.join(',') || '无'}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── L3：设置页 ── */
console.log('\n▶ L3 打开设置页');
{
  const { ctx, page, errs } = await openIsland('island_animal.html');
  await page.waitForTimeout(2500);
  ok(!(await engineState(page)).loaded, '打开设置页之前引擎没加载');
  await tap(page, '.util-card[onclick*="settings"]');
  await page.waitForFunction(() => !!window.__hansenBossFXLoaded && !!document.getElementById('hbafxEntry'), null, { timeout: 20000 }).catch(() => {});
  const st = await engineState(page);
  ok(st.loaded && st.entry, `设置页打开后引擎就位、「Boss 特效调节」行出现（loaded=${st.loaded} entry=${st.entry}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── L4 / L5 / L6：真点按进选关墙，打赢、打输 ── */
console.log('\n▶ L4/L5/L6 全开放期：点「挑战BOSS」→ 选关墙 → 打赢 → 再打输');
{
  const { ctx, page, errs, reqs } = await openIsland('island_animal.html');
  await page.waitForTimeout(1500);
  ok(await tap(page, '.daily-card.boss-card'), '「挑战BOSS」卡片能被手指点中');
  await page.waitForFunction(() => document.querySelectorAll('#bossContent [onclick^="hansenStartRebattle"]').length > 0, null, { timeout: 15000 }).catch(() => {});
  const wall = await page.evaluate(() => ({ open: document.querySelectorAll('#bossContent [onclick^="hansenStartRebattle"]').length, locked: (document.getElementById('bossContent').innerText.match(/未解锁/g) || []).length }));
  ok(wall.open === 20 && wall.locked === 0, `全开放期选关墙 20 关都能打（可点 ${wall.open} / 锁 ${wall.locked}）`);
  ok(await page.evaluate(() => localStorage.getItem('hansen_boss_wall_seen_v1165') === '1'), '记下「打开过选关墙」');
  await page.waitForFunction(() => !!window.__hansenBossFXLoaded, null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => !!window.__hansenBossFXLoaded), '孩子点开选关墙后，引擎在后台准备好了');
  ok(await tap(page, '#bossContent [onclick="hansenStartRebattle(1)"]'), 'Lv1 卡片能被手指点中');
  await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(await page.evaluate(() => !!(typeof bossActive !== 'undefined' && bossActive)), 'Boss 战开打');
  /* 先答错一题：Boss 用真引擎反击 */
  const hp0 = await page.evaluate(() => heroHP);
  await page.evaluate(() => { const c = window._bossCorrectIdx; bossAnswer((c + 1) % document.querySelectorAll('#bossOpts .boss-opt').length); });
  await page.waitForTimeout(4500);
  const hit = await page.evaluate(() => ({ hp: heroHP, real: typeof window.HansenBossAttack === 'function' && !!window.__hbaInit }));
  ok(hit.real && hit.hp < hp0, `答错 → Boss 用攻击引擎反击，勇者掉血（${hp0} → ${hit.hp}）`);
  const win = await fight(page, 'win');
  ok(!win.active && win.bossHP <= 0 && win.beaten >= 1, `一直答对 → 打赢（Boss HP ${win.bossHP}，累计击败 ${win.beaten}）`);
  const slam = await page.evaluate(() => { try { return window.HansenRoundReward ? HansenRoundReward.progress() : null; } catch (e) { return 'err'; } });
  ok(Array.isArray(slam) && slam.includes(1), `大满贯进度记上了 Lv1（${JSON.stringify(slam)}）`);
  await page.evaluate(() => { showScreen('boss'); window.hansenStartRebattle(2); });
  await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0, null, { timeout: 15000 }).catch(() => {});
  const lose = await fight(page, 'lose');
  ok(!lose.active && lose.heroHP <= 0, `一直答错 → 打输（勇者 HP ${lose.heroHP}）`);
  ok(reqs.some(u => SPRITE.test(u)), '真打 Boss 时攻击特效图照常加载');
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── L2 第二部分 + L6 全开放结束 ── */
console.log('\n▶ L2/L6 全开放已结束、打开过选关墙的孩子');
{
  const past = String(Date.now() - 3600e3);
  const { ctx, page, errs, reqs } = await openIsland('island_animal.html', { hansen_freepass_until: past, hansen_freepass_ver: '72', hansen_card_temp_unlock_until: '0', hansen_boss_wall_seen_v1165: '1' });
  await page.waitForTimeout(9000);
  const lv = lvReqs(reqs);
  ok(lv.length >= 1 && lv.every(n => n <= 2), `打开过选关墙：只预下已解锁的 Lv1 + 下一关（实下 ${lv.join(',') || '无'}）`);
  await page.evaluate(() => showScreen('boss'));
  await page.waitForTimeout(800);
  const wall = await page.evaluate(() => ({ open: document.querySelectorAll('#bossContent [onclick^="hansenStartRebattle"]').length, locked: (document.getElementById('bossContent').innerText.match(/未解锁/g) || []).length }));
  ok(wall.open === 1 && wall.locked === 19, `全开放结束：只开 Lv1，其余 19 关是 🔒（可点 ${wall.open} / 锁 ${wall.locked}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── L7：伪装管理员入口 ── */
console.log('\n▶ L7 伪装管理员入口（引擎未加载时第一次点）');
{
  const { ctx, page, errs } = await openIsland('island_animal.html');
  await page.waitForTimeout(1500);
  /* 往 IndexedDB 镜像里写「已永久锁定」，但 localStorage 里没有（模拟清过档） */
  await page.evaluate(() => new Promise(res => { const q = indexedDB.open('hsn_sys', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => { const tx = q.result.transaction('kv', 'readwrite'); tx.objectStore('kv').put('1', 'b'); tx.oncomplete = () => res(); }; }));
  ok(await page.evaluate(() => localStorage.getItem('__hsn_sys_b') !== '1' && !window.__hansenBossFXLoaded), '前提：本地没有锁标记、引擎没加载');
  const opened = await page.evaluate(() => window.HansenBossAdminBridge.open());
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => ({ lock: localStorage.getItem('__hsn_sys_b'), gate: !!document.getElementById('hbafx-ovl') }));
  ok(opened === true && st.lock === '1' && !st.gate, `IndexedDB 里的永久锁先补回，密码门不弹（lock=${st.lock} gate=${st.gate}）`);
  /* 没锁的孩子：点一下就能弹门 */
  const c2 = await openIsland('island_animal.html');
  await c2.page.waitForTimeout(1500);
  await c2.page.evaluate(() => window.HansenBossAdminBridge.open());
  await c2.page.waitForFunction(() => !!document.getElementById('hbafx-ovl'), null, { timeout: 15000 }).catch(() => {});
  ok(await c2.page.evaluate(() => !!document.getElementById('hbafx-ovl')), '没锁时：第一次点就弹出密码门');
  ok(errs.length === 0 && c2.errs.length === 0, '零脚本错误' + ([...errs, ...c2.errs].length ? '：' + [...errs, ...c2.errs][0] : ''));
  await c2.ctx.close();
  await ctx.close();
}

/* ── L8：单词大陆岛（选关墙直接调 startBoss，不经过 showScreen） ── */
console.log('\n▶ L8 单词大陆②：点「挑战BOSS」→ 选关 → 打赢');
{
  const { ctx, page, errs } = await openIsland('island_land2.html');
  await page.waitForTimeout(1500);
  ok(!(await engineState(page)).loaded, '进岛停在菜单：引擎没加载');
  ok(await tap(page, '.daily-card.boss-card'), '「挑战BOSS」卡片能被手指点中');
  await page.waitForFunction(() => document.querySelectorAll('#bossContent [onclick^="window.__hsnZoneFight"]').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(await tap(page, '#bossContent [onclick="window.__hsnZoneFight(0)"]'), '第一关卡片能被手指点中');
  await page.waitForFunction(() => (typeof bossActive !== 'undefined' && bossActive) && document.querySelectorAll('#bossOpts .boss-opt').length > 0, null, { timeout: 15000 }).catch(() => {});
  ok(await page.evaluate(() => !!(typeof bossActive !== 'undefined' && bossActive)), '单词大陆 Boss 战开打');
  await page.waitForFunction(() => !!window.__hansenBossFXLoaded, null, { timeout: 20000 }).catch(() => {});
  ok(await page.evaluate(() => !!window.__hansenBossFXLoaded), '开打时引擎就开始准备并就位');
  const win = await fight(page, 'win');
  ok(!win.active && win.bossHP <= 0, `一直答对 → 打赢（Boss HP ${win.bossHP}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ── L9：星海岛开机就落在选关墙 ── */
console.log('\n▶ L9 星海岛：开机自动落在选关墙');
{
  const { ctx, page, errs } = await openIsland('island_season.html');
  await page.waitForTimeout(8000);
  const st = await engineState(page);
  ok(!st.loaded && !st.scriptTag, `只看选关墙（没有点按）不加载引擎（loaded=${st.loaded}）`);
  ok(errs.length === 0, '零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? `\n❌ Boss 按需加载：${fails} 项失败` : '\n✅ Boss 按需加载：菜单不加载引擎/攻击图、头像按进度、设置页/选关墙按需、赢/输/大满贯/全开放/管理员门全通过');
process.exit(fails ? 1 : 0);
