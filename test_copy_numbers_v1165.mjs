/* test_copy_numbers_v1165.mjs —— 给孩子看的文字和数字要说得通
 *
 * v1163 实测的问题：
 *   ① 任务横幅「🎯 还差 1 个! undefined」：横幅读 q.text，全局任务的字段叫 title
 *   ② 岛里欢迎弹窗写「5 大动物岛屿」（其实是岛里的 5 个小组）、「12 种玩法」（页面上 14 张卡）
 *   ③ 成就「万词王者 · 1500 个单词」永远拿不到：全游戏只有 952 个词
 *   ④ 首页 <title> 是「单词大冒险 · 单词大冒险」；首页写死「711+ 单词」「12 种」
 *   ⑤「我的学习」写死「已点亮 N / 19 座岛」，而能记进度的岛页有 27 个（会出现 22 / 19）
 *   ⑥（v1165 补）首页统计条还写死「18 主题岛屿 / 711+ 英语单词」；进岛提示和「最近探险」用的岛名/图标和岛卡不一样
 *      （卡片「百宝大冒险 🔤」，提示却是「正在进入 常用词岛」；卡片 🦁，最近探险是 🐯）
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
let SLOW_ISLANDS = false;   // ⑥ 用：岛页晚 800ms 才给，进岛提示一定会出来
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/VERSION') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(VERSION); }
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  const send = () => fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' }); res.end(d); });
  if (SLOW_ISLANDS && /^\/island_[a-z0-9]+\.html$/.test(p)) setTimeout(send, 800); else send();
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH });

async function fresh(file) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem('hansen_onboarded', '1'); sessionStorage.setItem('__s', '1'); } } catch (e) {} });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.goto(BASE + file, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  return { ctx, page, errs };
}

try {
  for (const [file, groupWord] of [['island_animal.html', '动物'], ['island_land1.html', '单词']]) {
    console.log(`\n▶ ${file}`);
    const { ctx, page, errs } = await fresh(file);
    const r = await page.evaluate(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const pop = document.getElementById('alertInner');
      const welcome = pop ? pop.textContent.replace(/\s+/g, ' ') : '';
      const cards = document.querySelectorAll('.mode-card').length;
      const groups = DATA.length;
      try { closeAlert(); } catch (e) {}
      // ① 任务横幅
      let banner = '';
      try {
        const q = (S.quests && S.quests.list || []).find(x => !x.claimed && x.goal >= 2);
        if (q) { q.progress = q.goal - 1; window._lastAlmost = {}; checkAlmostQuest(); await sleep(50); const b = document.querySelector('.almost-banner'); banner = b ? b.textContent : ''; return { welcome, cards, groups, banner, title: q.title }; }
      } catch (e) { banner = 'ERR ' + e; }
      return { welcome, cards, groups, banner, title: null };
    });
    ok(r.title && r.banner.includes(r.title) && !/undefined/.test(r.banner), '① 任务横幅显示任务名，不再是 undefined: ' + r.banner);
    ok(new RegExp(r.groups + ' 个' + groupWord + '小组').test(r.welcome) && !/大.{0,4}岛屿等你探索/.test(r.welcome), '② 欢迎弹窗：岛里说「N 个小组」不说「N 大…岛屿」: ' + (r.welcome.match(/🗺️[^📚]*/) || [''])[0]);
    ok(r.welcome.includes(r.cards + ' 种超酷玩法') && r.cards >= 10, `② 欢迎弹窗玩法数 = 页面上真有的卡片数 (${r.cards}): ` + (r.welcome.match(/🎮[^🐉]*/) || [''])[0]);
    ok(errs.length === 0, '页面无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  // ③ 成就目标能达到（常规岛有判定逻辑）
  {
    console.log('\n▶ 成就「全词王者」');
    const { ctx, page } = await fresh('island_animal.html');
    const r = await page.evaluate(() => {
      try { closeAlert(); } catch (e) {}
      const a = ACHIEVEMENTS.find(x => x.id === 'vocabS1500');
      const total = HansenCanonical.TOTAL_WORDS;
      // 真实判定走 hansen_island_upgrade.js 的 checkAch（它读权威账本的 totalLearned）
      const HC = window.HansenCanonical, orig = HC.totalLearned, got = [];
      const ou = window.unlockAch; window.unlockAch = function(id){ got.push(id); return ou.apply(this, arguments); };
      HC.totalLearned = () => total - 1; checkAch(); const below = got.includes('vocabS1500');
      got.length = 0; HC.totalLearned = () => total; checkAch(); const at = got.includes('vocabS1500');
      const prog = getAchProgress('vocabS1500');
      HC.totalLearned = orig; window.unlockAch = ou;
      return { name: a.name, desc: a.desc, total, below, at, prog };
    });
    ok(!/1500/.test(r.desc) && !/万词/.test(r.name), '③ 成就不再写达不到的 1500 词: ' + r.name + ' · ' + r.desc);
    ok(!r.below && r.at, `③ 认识全部 ${r.total} 个词时解锁，差 1 个不解锁`);
    ok(r.prog && r.prog.need === r.total, '③ 成就页进度条目标 = 全部单词数 ' + JSON.stringify(r.prog));
    await ctx.close();
  }

  // ④ 首页
  {
    console.log('\n▶ 首页');
    const { ctx, page, errs } = await fresh('index.html');
    const r = await page.evaluate(() => {
      const v = window.HANSEN_VOCAB_ALL || {}, k = Object.keys(v); let n = 0; k.forEach(x => n += v[x].length);
      const intro = (document.querySelector('.intro') || {}).textContent || '';
      return { title: document.title, intro: intro.replace(/\s+/g, ' '), islands: k.length, words: n,
        how: [...document.querySelectorAll('.how-step .title')].map(e => e.textContent).join('|'),
        desc: (document.querySelector('meta[name=description]') || {}).content || '',
        stats: [...document.querySelectorAll('.stats .stat')].map(e => (e.querySelector('.stat-num') || {}).textContent + ' ' + (e.querySelector('.stat-lbl') || {}).textContent) };
    });
    ok(r.title === '单词大冒险', '④ 网页标题不重复: ' + r.title);
    ok(r.intro.includes(r.islands + ' 座单词岛') && r.intro.includes(r.words + ' 个单词') && !/711\+|12 种/.test(r.intro), `④ 首页岛屿数/单词数从词库算 (${r.islands}/${r.words}): ` + r.intro.trim().slice(0, 90));
    ok(!/12 种/.test(r.how), '④ 「怎么玩」不再写死 12 种: ' + r.how);
    ok(!/27 座/.test(r.desc), '④ 分享描述不再写 27 座岛: ' + r.desc);
    ok(r.stats.includes(r.islands + ' 主题岛屿') && r.stats.includes(r.words + ' 英语单词') && !r.stats.some(x => /711\+/.test(x)), `⑥ 统计条的岛屿数/单词数也从词库算 (${r.islands}/${r.words}): ` + r.stats.join(' | '));
    ok(errs.length === 0, '首页无报错 ' + errs.join(' | '));
    await ctx.close();
  }

  // ⑥ 每张岛卡：进岛提示和「最近探险」用的岛名、图标和卡片一样
  {
    console.log('\n▶ 岛卡名字/图标');
    const { ctx, page } = await fresh('index.html');
    await page.waitForFunction(() => typeof window.openIsland === 'function', null, { timeout: 30000 });
    const cards = await page.evaluate(() => [...document.querySelectorAll('a.island[href^="island_"]')].map(a => ({ file: a.getAttribute('href'), name: a.querySelector('.island-name').textContent.trim(), icon: a.querySelector('.island-icon').textContent.trim() })));
    SLOW_ISLANDS = true;
    const bad = [];
    for (const c of cards) {
      const short = c.name.replace(/大冒险$/, '');
      await page.evaluate(f => openIsland(f), c.file);
      await page.waitForTimeout(450);
      const loading = await page.evaluate(() => (document.getElementById('islandLoadingText') || {}).textContent || '');
      await page.evaluate(() => closeIsland());
      await page.waitForTimeout(700);
      const recent = await page.evaluate(() => ({ emoji: (document.getElementById('recentEmoji') || {}).textContent || '', num: (document.getElementById('recentNum') || {}).textContent || '' }));
      if (loading !== '正在进入 ' + short + '岛…') bad.push(`${c.file} 提示「${loading}」应为「正在进入 ${short}岛…」`);
      if (recent.emoji !== c.icon || recent.num !== c.icon + ' ' + short + ' · 点击继续 →') bad.push(`${c.file} 最近探险「${recent.emoji} / ${recent.num}」应为「${c.icon} ${short}」`);
    }
    SLOW_ISLANDS = false;
    ok(cards.length >= 18 && bad.length === 0, `⑥ ${cards.length} 张岛卡：进岛提示、最近探险都和卡片一致` + (bad.length ? '：\n      ' + bad.join('\n      ') : ''));
    await ctx.close();
  }

  // ⑤ 我的学习：分母 = 真实能记进度的岛页数
  {
    console.log('\n▶ 我的学习');
    const { ctx, page } = await fresh('island_animal.html');
    const r = await page.evaluate(async () => {
      try { closeAlert(); } catch (e) {}
      for (let i = 1; i <= 22; i++) localStorage.setItem('hsn_progress:测试岛' + i, JSON.stringify({ name: '测试岛' + i, totalWords: 30, learned: 1, ans: 1, cor: 1, boss: 0, level: 1, ts: Date.now() - i }));
      HansenMyLearning._open(); await new Promise(r => setTimeout(r, 300));
      const t = (document.querySelector('.hsn-ml-sec .cnt') || {}).textContent || '';
      HansenMyLearning._close();
      return t;
    });
    const m = r.match(/已点亮 (\d+) \/ (\d+)/);
    ok(m && +m[2] === 27 && +m[1] <= +m[2], '⑤ 「已点亮 N / 27 座岛」分子不会超过分母: ' + r);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
console.log('');
if (fails) { console.log('❌ 失败 ' + fails + ' 项'); process.exit(1); }
console.log('✅ v1165 文案/数字校对：任务横幅、欢迎弹窗、成就目标、首页标题与数字、我的学习分母 全过');
