/* ⭐ v931 打Boss 主题探针 (Hansen: "认认真真设计, 千万不要出现字体看不清的情况")
 *
 * 真机渲染【打Boss 屏】× 两套主题(深空/晨曦) × 多个 boss(立绘明暗差别很大),
 * 把屏上【每一个可见文字】的对比度按【真实像素】量出来(取文字元素边框内侧一圈像素的众数当底色,
 * 而不是 getComputedStyle —— 后者会把渐变色标做平均, 得出的是假数)。
 *
 * 输出 JSON: [{theme, boss, texts:[{cls,txt,ratio,need,ok}], fails}]
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const THEMES = (process.argv[3] || 'dark,light').split(',');
const LEVELS = (process.argv[4] || '0,3,7').split(',').map(Number);   // 不同 boss = 不同立绘明暗
const ISLAND = process.argv[5] || 'island_land1.html';

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const out = [];
  for (const TH of THEMES) {
    for (const LV of LEVELS) {
      const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      await c.addInitScript((t) => {
        try {
          localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 13, coins: 9999, stats: { maxCombo: 3 }, wrongs: {} }));
          for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
          localStorage.setItem('hansen_boss_theme', t);
        } catch (e) { }
      }, TH);
      const p = await c.newPage();
      await p.goto(`http://localhost:${PORT}/${ISLAND}`, { waitUntil: 'load', timeout: 40000 });
      await p.waitForTimeout(1400);
      await p.evaluate((lv) => {
        ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
        document.body.classList.remove('modal-open');
        try { window._s1FightIdx = lv; showScreen('boss'); } catch (e) { }
      }, LV);
      await p.waitForTimeout(400);
      await p.evaluate(() => { try { startBoss(); } catch (e) { } });
      await p.waitForTimeout(1700);
      await p.evaluate(() => {
        ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
      });
      await p.waitForTimeout(250);
      const els = await p.evaluate(() => {
        // ⚠️ 曾经的坑: 用 /^[\W\d_\s]+$/ 判「纯符号」会把【所有中文】当成 emoji 跳过
        //    (JS 里中文属于 \W) —— 结果恰恰是 Hansen 抱怨的那些中文字, 一个都没被真正量到。
        //    正确做法: 只要含【字母 / 数字 / 汉字】就是真文字, 纯 emoji / 符号才跳过。
        const HASTXT = /[A-Za-z0-9\u4e00-\u9fff]/; const r = [];
        document.querySelectorAll('#bossScreen *').forEach(el => {
          const bb = el.getBoundingClientRect();
          if (bb.width < 12 || bb.height < 9) return;
          if (bb.top < 0 || bb.bottom > 844 || bb.left < 0 || bb.right > 390) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.35) return;
          const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
          if (!t || !HASTXT.test(t)) return;
          r.push({
            t: t.slice(0, 18), cls: (el.className || '').toString().slice(0, 26),
            color: cs.color, size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700,
            x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height)
          });
        });
        return r;
      });
      const png = `/tmp/bt2_${TH}_${LV}.png`;
      await p.screenshot({ path: png });
      out.push({ theme: TH, lv: LV, png, els });
      await c.close();
    }
  }
  await b.close();
  fs.writeFileSync('/tmp/boss_theme.json', JSON.stringify(out));
  console.log('  渲染完成: ' + out.map(o => `${o.theme}/lv${o.lv}(${o.els.length}字)`).join(' · '));
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
