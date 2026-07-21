/* ⭐ v931 打Boss 主题探针 (Hansen: "认认真真设计, 千万不要出现字体看不清的情况")
 *
 * 【测法: 两遍渲染 —— 彻底杜绝假数】
 *   第一遍: 正常渲染 → 记下每个文字元素的【真实字色】和位置。
 *   第二遍: 同一屏, 把 #bossScreen 里【所有字变透明】再截一次 →
 *           这时元素框里的像素【纯粹是底色】, 一个笔画都没有。
 *   底色 = 第二遍那张图里, 元素框内的众数色。字色 = 第一遍的 computed color。
 *
 *   ▸ 为什么非这么干不可: 直接在正常图上采样, 元素一紧凑, 采样点就压在字的笔画上,
 *     会量出"白字压白底 1.00:1"这种假警报; 而"字色≈底色就跳过"又会把
 *     【字真的看不见】这种最严重的问题当成没问题放过去。两遍渲染没有这个问题。
 *
 * 【覆盖的状态】每个 boss × 每套主题, 走一遍真实战斗:
 *   出题 → 答对(气泡变绿) → 答错(气泡变红) → boss 反击 → 胜利结算
 */
import { chromium } from './playwright_loader.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const THEMES = (process.argv[3] || 'dark,light').split(',');
const LEVELS = (process.argv[4] || '0,3,6').split(',').map(Number);
const ISLAND = process.argv[5] || 'island_land1.html';

// 抓一屏: 先记文字, 再把字变透明截底图
async function snap(p, tag, out) {
  const els = await p.evaluate(() => {
    const HASTXT = /[A-Za-z0-9\u4e00-\u9fff]/;   // ⚠️ 中文在 JS 里属于 \W, 绝不能用 \W 判"纯符号"
    const r = [];
    document.querySelectorAll('#bossScreen *').forEach(el => {
      const bb = el.getBoundingClientRect();
      if (bb.width < 12 || bb.height < 9) return;
      if (bb.top < 0 || bb.bottom > 844 || bb.left < 0 || bb.right > 390) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.35) return;
      if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') return;   // 渐变裁切字, 单独看
      const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
      if (!t || !HASTXT.test(t)) return;
      r.push({
        t: t.slice(0, 20), cls: (el.className || '').toString().slice(0, 24) || (el.id || el.tagName),
        color: cs.color, size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700,
        x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height)
      });
    });
    return r;
  });
  if (!els.length) return;
  // 第二遍: 所有字透明 → 拿纯底图
  await p.evaluate(() => {
    let s = document.getElementById('__hideTxt');
    if (!s) { s = document.createElement('style'); s.id = '__hideTxt'; document.head.appendChild(s); }
    s.textContent = '#bossScreen *{color:transparent !important;text-shadow:none !important;' +
      '-webkit-text-fill-color:transparent !important}';
  });
  await p.waitForTimeout(120);
  const png = `/tmp/bt_${tag}.png`;
  await p.screenshot({ path: png });
  await p.evaluate(() => { const s = document.getElementById('__hideTxt'); if (s) s.textContent = ''; });
  await p.waitForTimeout(80);
  out.push({ tag, png, els });
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH, args: ['--no-sandbox'] });
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
      const kill = () => p.evaluate(() => {
        ['alertModal', 'hsnStoryModal'].forEach(id => { var m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
        document.body.classList.remove('modal-open');
      });
      await kill();
      await p.evaluate((lv) => { try { window._s1FightIdx = lv; showScreen('boss'); } catch (e) { } }, LV);
      await p.waitForTimeout(350);
      await p.evaluate(() => { try { startBoss(); } catch (e) { } });
      await p.waitForTimeout(1700);
      await kill();

      const pre = `${TH}_${LV}`;
      await snap(p, pre + '_出题', out);

      // 答对 → 气泡变绿
      await p.evaluate(() => {
        try {
          const m = document.getElementById('bossMsg');
          if (m) { m.className = 'boss-msg hit'; const i = m.querySelector('.boss-msg-inner'); if (i) i.textContent = '💥 暴击! 造成 240 伤害'; }
        } catch (e) { }
      });
      await p.waitForTimeout(200);
      await snap(p, pre + '_答对', out);

      // 答错 → 气泡变红
      await p.evaluate(() => {
        try {
          const m = document.getElementById('bossMsg');
          if (m) { m.className = 'boss-msg miss'; const i = m.querySelector('.boss-msg-inner'); if (i) i.textContent = '😖 答错了! 受到 30 伤害'; }
          document.querySelectorAll('#bossScreen .boss-opt').forEach((o, i) => { o.className = 'boss-opt ' + (i === 0 ? 'correct' : (i === 1 ? 'wrong' : '')); });
        } catch (e) { }
      });
      await p.waitForTimeout(200);
      await snap(p, pre + '_答错', out);

      // 狂暴阶段
      await p.evaluate(() => {
        try {
          const m = document.getElementById('bossMsg');
          if (m) { m.className = 'boss-msg rage'; const i = m.querySelector('.boss-msg-inner'); if (i) i.textContent = '🔥 boss 狂暴了!'; }
        } catch (e) { }
      });
      await p.waitForTimeout(200);
      await snap(p, pre + '_狂暴', out);

      await c.close();
    }
  }
  await b.close();
  fs.writeFileSync('/tmp/boss_theme.json', JSON.stringify(out));
  console.log('  渲染完成: ' + out.length + ' 屏 · ' + out.reduce((a, o) => a + o.els.length, 0) + ' 个文字');
})().catch(e => { console.log('FATAL ' + e); process.exit(1); });
