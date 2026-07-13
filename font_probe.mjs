/* v934 字体子集体检: 把【真正用卡通字体渲染出来】的每一个字抓出来
 *
 * v929 把 cartoon_font.woff2 从 613KB 子集化到 244KB。
 * 如果子集漏掉了某些字, 浏览器会【悄悄回退到系统默认字体】—— 不报错、不空白,
 * 只是那几个字长得和周围不一样。这种问题肉眼很难发现, 但一旦发现就是"怎么又冒出个 bug"。
 *
 * 做法: 走遍全库每个屏, 找出所有【计算后的 font-family 里含 cartoon 字体】的元素,
 *       把它们渲染出来的文字逐字收集, 输出成 JSON, 再用 fontTools 去字体里逐字查。
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const SCREENS = ['home', 'explore', 'listen', 'match', 'typing', 'cloze', 'scramble',
  'bubble', 'chest', 'eagle', 'fish', 'moles', 'speed', 'cards',
  'review', 'stats', 'pet', 'quests', 'ach', 'settings', 'boss'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const chars = new Set();
  const samples = {};

  for (const ISLAND of ['island_land1.html', 'island_season.html', 'island_animal.html']) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await c.addInitScript(() => {
      try {
        localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1, 2, 3, 4, 5], level: 13, coins: 99999, diamonds: 9999, stats: { maxCombo: 5 }, wrongs: { 0: 2, 1: 1 } }));
        for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
      } catch (e) { }
    });
    const p = await c.newPage();
    await p.goto(`http://localhost:${PORT}/${ISLAND}`, { waitUntil: 'load', timeout: 50000 });
    await p.waitForTimeout(2200);
    const kill = () => p.evaluate(() => {
      ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      document.body.classList.remove('modal-open');
    });
    await kill();

    async function grab(where) {
      const r = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('*').forEach(el => {
          const cs = getComputedStyle(el);
          const ff = (cs.fontFamily || '').toLowerCase();
          if (!/cartoon|bowlby/.test(ff)) return;
          const bb = el.getBoundingClientRect();
          if (bb.width < 2 || bb.height < 2) return;
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
          if (t.trim()) out.push({ t, cls: (el.className || '').toString().slice(0, 22) || el.tagName });
        });
        return out;
      });
      r.forEach(x => {
        for (const ch of x.t) {
          const o = ch.codePointAt(0);
          if (o < 0x20) continue;
          chars.add(ch);
          if (!samples[ch]) samples[ch] = `${where}·${x.cls}`;
        }
      });
    }

    for (const s of SCREENS) {
      await p.evaluate((id) => { try { showScreen(id); } catch (e) { } }, s);
      await p.waitForTimeout(s === 'boss' ? 1200 : 480);
      if (s === 'boss') { await p.evaluate(() => { try { startBoss(); } catch (e) { } }); await p.waitForTimeout(1400); }
      await kill();
      await grab(ISLAND.replace('island_', '').replace('.html', '') + '/' + s);
    }
    // 单词弹窗(.word-cn 用的就是卡通字体, 中文释义全在这里)
    await p.evaluate(() => { try { showScreen('explore'); } catch (e) { } });
    await p.waitForTimeout(700);
    for (let k = 0; k < 6; k++) {
      await p.evaluate((i) => {
        const ws = document.querySelectorAll('.word-card, .wcard, [data-w]');
        if (ws[i]) ws[i].click();
      }, k);
      await p.waitForTimeout(700);
      await grab('单词弹窗');
      await p.evaluate(() => { const m = document.getElementById('wordModal'); if (m) { m.classList.remove('show'); m.style.display = 'none'; } document.body.classList.remove('modal-open'); });
      await p.waitForTimeout(220);
    }
    await c.close();
  }
  await b.close();
  fs.writeFileSync('/tmp/cartoon_chars.json', JSON.stringify({ chars: [...chars], samples }));
  console.log(`  真机渲染: 用卡通字体画出来的不重复字符 ${chars.size} 个 (已写 /tmp/cartoon_chars.json)`);
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
