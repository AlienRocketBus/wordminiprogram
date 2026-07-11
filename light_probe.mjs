/* ⭐ v928 亮色主题对比度守卫 · 探针
 * 真机渲染 → 整页截图 → 逐个文字元素取【边缘环真实像素】当背景 → 算 WCAG 对比度。
 * 为什么必须用真实像素: 用 getComputedStyle 拿背景会把渐变的色标做平均(掺进深色星云),
 *   实测会把 6 处真问题放大成 230 处假警报。像素才是真相。
 * 输出 JSON: {palette, checked, fails:[...]}
 */
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';

const PORT = process.argv[2] || '8877';
const ISLAND = process.argv[3] || 'island_land3.html';
const PALS = (process.argv[4] || 'sakura,cloud,cream,mint').split(',');
const SCREENS = ['home', 'explore', 'stats', 'ach', 'pet', 'settings', 'cards', 'review'];

function lum(c) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}

(async () => {
  const out = [];
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  for (const PAL of PALS) {
    // isMobile+hasTouch: 真触屏环境(hover:none) —— 和用户手机一致
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await c.addInitScript((p) => {
      try {
        localStorage.setItem('hansen_palette_global', p);
        localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 13, coins: 678, stats: { maxCombo: 3 }, wrongs: {} }));
        for (let i = 1; i <= 8; i++) localStorage.setItem('land' + i + '_prog', '8');
        localStorage.setItem('hansen_starter_coins_given', '1');
      } catch (e) { }
    }, PAL);
    const p = await c.newPage();
    const fails = [];
    let checked = 0;
    try {
      await p.goto(`http://localhost:${PORT}/${ISLAND}`, { waitUntil: 'load', timeout: 30000 });
      await p.waitForTimeout(1300);
      await p.evaluate(() => {
        ['alertModal', 'hsnStoryModal'].forEach(id => { const m = document.getElementById(id); if (m) { m.classList.remove('show'); m.style.display = 'none'; } });
        document.body.classList.remove('modal-open');
      });
      // 触屏防闪自检: hover 效果必须已被中和(否则手指一点就"一闪一闪")
      await p.evaluate(() => { try { showScreen('explore'); } catch (e) { } });
      await p.waitForTimeout(400);
      const flick = await p.evaluate(() => {
        const card = document.querySelector('.exp-card');
        if (!card) return null;
        const cs = getComputedStyle(card), bf = getComputedStyle(card, '::before');
        return {
          hoverNone: matchMedia('(hover: none)').matches,
          transform: cs.transform,
          beforeOpacity: parseFloat(bf.opacity),
          tap: (cs.webkitTapHighlightColor || '')
        };
      });
      if (flick && flick.hoverNone) {
        if (flick.transform !== 'none') fails.push({ screen: '触屏防闪', t: '.exp-card 在触屏上仍有 hover 位移(点一下会闪)', ratio: 0, need: 0 });
        if (flick.beforeOpacity > 0.01) fails.push({ screen: '触屏防闪', t: '.exp-card::before 蒙层在触屏上仍会淡入(点一下会闪)', ratio: 0, need: 0 });
        if (!/rgba\(0, 0, 0, 0\)|transparent/.test(flick.tap)) fails.push({ screen: '触屏防闪', t: '.exp-card 未关掉系统点击高亮块', ratio: 0, need: 0 });
      }

      for (const sc of [...SCREENS, '__modal']) {
        if (sc === '__modal') {
          await p.evaluate(() => { try { showScreen('explore'); } catch (e) { } });
          await p.waitForTimeout(350);
          await p.evaluate(() => { const c = document.querySelector('.exp-card'); if (c) c.click(); });
          await p.waitForTimeout(600);
        } else {
          await p.evaluate((s) => { try { showScreen(s); } catch (e) { } }, sc);
          await p.waitForTimeout(400);
        }
        const els = await p.evaluate(() => {
          const EMO = /^[\W\d_\s]+$/;
          const modalOpen = !!document.querySelector('#wordModal.show, .modal-bg.show');
          const r = [];
          document.querySelectorAll('*').forEach(el => {
            if (el.closest('#bossScreen')) return;              // 铁律: 打Boss屏任何配色都不动
            if (modalOpen && !el.closest('#wordModal')) return; // 被弹窗遮住的不算
            const b = el.getBoundingClientRect();
            if (b.width < 12 || b.height < 10) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.3) return;
            const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
            if (!t || EMO.test(t)) return;                      // 纯表情不算(彩色字形, 量对比度没意义)
            const inl = el.getAttribute('style') || '';
            // 行内 !important 锁死字色(如首页"挑战BOSS", v664调节器钦定白字) → CSS 改不动,
            // 只能靠重描边缓解; 有重描边就算已缓解。
            if (/color\s*:\s*#fff[^;]*!important/i.test(inl) && (cs.textShadow || '').split('rgb').length >= 3) return;
            r.push({
              t: t.slice(0, 16), cls: (el.className || '').toString().slice(0, 26),
              color: cs.color, size: parseFloat(cs.fontSize), bold: parseInt(cs.fontWeight) >= 700,
              x: Math.round(b.x + scrollX), y: Math.round(b.y + scrollY),
              w: Math.round(b.width), h: Math.round(b.height)
            });
          });
          return r;
        });
        const png = await p.screenshot({ fullPage: true });
        // 用 sharp 不可用 → 直接把 PNG 交给 python 侧解析太重, 这里在 node 侧用 canvas 不可用,
        // 所以改为: 把截图落盘 + 元素坐标落盘, 由 python 侧(PIL)算像素。
        const tag = `${PAL}__${sc}`;
        fs.writeFileSync(`/tmp/lg_${tag}.png`, png);
        fs.writeFileSync(`/tmp/lg_${tag}.json`, JSON.stringify(els));
        checked += els.length;
      }
    } catch (e) {
      fails.push({ screen: '致命', t: String(e).slice(0, 80), ratio: 0, need: 0 });
    }
    out.push({ palette: PAL, checked, fails, screens: [...SCREENS, '__modal'] });
    await c.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})().catch(e => { console.log(JSON.stringify([{ palette: '?', checked: 0, fails: [{ screen: '致命', t: String(e).slice(0, 80) }] }])); });
