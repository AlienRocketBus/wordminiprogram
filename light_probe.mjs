/*
 * v946 HF3 light-theme contrast probe.
 *
 * The old probe only visited island_land3.html.  That left three real product
 * surfaces completely untested: the home-page "recent island" card, the
 * injected diamond theme shop, the standalone Spelling Bee iframe/page, and
 * the Boss 大满贯进度卡。后者同时受全局 palette 与 Boss 专属主题影响，必须
 * 用 hsn-pal-light + hsn-bt-light 的真实组合测量，不能再跟整个 bossScreen
 * 一起被 legacy 探针跳过。
 * It also skipped text whenever its computed colour was close to the sampled
 * background, which is exactly what truly invisible text looks like.
 *
 * This probe renders all four light palettes on real mobile pages.  For every
 * direct text node it temporarily wraps the text in a visibility:hidden span
 * and screenshots the page.  The screenshot therefore contains the exact
 * composited background that sat behind the glyphs (including gradients,
 * translucent cards and images) without changing layout or element colours.
 * Python calculates WCAG contrast against those background pixels.
 */
import { chromium } from './playwright_loader.mjs';
import fs from 'node:fs';

const PORT = process.argv[2] || '8879';
const ISLAND = process.argv[3] || 'island_land3.html';
const PALETTES = (process.argv[4] || 'sakura,cloud,cream,mint').split(',').filter(Boolean);
const ISLAND_SCREENS = ['home', 'explore', 'stats', 'ach', 'pet', 'settings', 'cards', 'review'];
const BEE_THEME = { cloud: 'sky', cream: 'sunny', sakura: 'sakura', mint: 'mint' };
const URL = path => `http://127.0.0.1:${PORT}/${path}`;
// v946 HF7：对比度合格也不代表颜色符合产品规范。用户永久封杀的
// 驼棕文字族必须在真实可见文字的计算样式中保持为零。
const FORBIDDEN_TEXT_RGB = new Set([
  '146,64,14', '120,53,15', '124,45,18', '154,52,18', '133,77,14',
  '113,63,18', '180,83,9', '161,98,7', '194,65,12',
]);

function assertNoForbiddenText(entries, label) {
  const bad = entries.filter(entry => {
    const match = String(entry.color || '').match(/rgba?\(\s*(\d+)\s*[, ]+\s*(\d+)\s*[, ]+\s*(\d+)/i);
    return match && FORBIDDEN_TEXT_RGB.has(`${match[1]},${match[2]},${match[3]}`);
  });
  if (bad.length) {
    throw new Error(`${label} 出现已封杀的驼棕文字色: ${JSON.stringify(bad.slice(0, 8))}`);
  }
}

function safeTag(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]+/g, '_');
}

async function waitSettled(page, ms = 350) {
  await page.waitForTimeout(ms);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function closeIncidentalOverlays(page) {
  await page.evaluate(() => {
    ['alertModal', 'hsnStoryModal', '__hansen_onboarding'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show', 'on');
      el.style.display = 'none';
    });
    document.body.classList.remove('modal-open', 'hsn-theme-only');
  });
}

/*
 * Capture text metadata plus the page with the text made invisible.  Wrapping
 * only non-empty direct text nodes preserves line wrapping and leaves every
 * background/border/currentColor rule untouched.
 */
async function captureBackground(page, palette, surface, screen, scopeSelector, criticalSelectors = []) {
  const tag = safeTag(`${palette}__${surface}__${screen}`);
  const prepared = await page.evaluate(({ scopeSelector, criticalSelectors }) => {
    const scope = document.querySelector(scopeSelector);
    if (!scope) return { error: `找不到界面 ${scopeSelector}`, entries: [], skippedGradient: 0 };

    const freeze = document.createElement('style');
    freeze.id = '__lgFreeze';
    freeze.textContent = '*,:before,:after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';
    document.head.appendChild(freeze);

    const candidates = [];
    let skippedDecorative = 0;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
      const parent = node.parentElement;
      if (!parent || parent.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
      if (/^(SCRIPT|STYLE|TITLE|NOSCRIPT|OPTION|TEXTAREA)$/i.test(parent.tagName)) continue;
      /* The five coloured characters are a decorative word-mark, not ordinary
       * body copy.  Their 3px dark text stroke is what supplies the visible
       * silhouette on light artwork; treating only the coloured fill as a WCAG
       * foreground produces a false failure (especially the yellow character).
       * Functional brand/tagline copy remains in the audit. */
      if (parent.closest('.game-logo') && parent.matches('.logo-char')) { skippedDecorative += 1; continue; }
      const rect = parent.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      const cs = getComputedStyle(parent);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (parent.checkVisibility && !parent.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;

      let opacity = 1;
      for (let cur = parent; cur && cur.nodeType === 1; cur = cur.parentElement) {
        const curStyle = getComputedStyle(cur);
        if (curStyle.display === 'none' || curStyle.visibility === 'hidden') { opacity = 0; break; }
        const part = Number.parseFloat(curStyle.opacity);
        if (Number.isFinite(part)) opacity *= part;
      }
      if (opacity < 0.05) continue;

      const fill = cs.webkitTextFillColor || '';
      const clip = `${cs.webkitBackgroundClip || ''} ${cs.backgroundClip || ''}`;
      const isGradientText = /transparent|rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(fill) && /text/i.test(clip);
      /* -webkit-text-fill-color wins over color in Chromium/WebView.  The old guard
       * inspected only color and therefore reported a healthy dark value while the
       * phone actually painted a nearly-white/yellow glyph. */
      const actualColor = fill && !/^currentcolor$/i.test(fill) ? fill : cs.color;
      candidates.push({ node, parent, text, color: actualColor, size: Number.parseFloat(cs.fontSize) || 0,
        bold: (Number.parseInt(cs.fontWeight, 10) || 400) >= 700, opacity, isGradientText });
    }

    const wrappers = [];
    const entries = [];
    let skippedGradient = 0;
    let skippedOccluded = 0;
    candidates.forEach((item, index) => {
      if (item.isGradientText) { skippedGradient += 1; return; }
      const span = document.createElement('span');
      span.setAttribute('data-lg-blank', String(index));
      span.style.cssText = 'font:inherit;letter-spacing:inherit;text-transform:inherit;white-space:inherit;';
      item.node.parentNode.replaceChild(span, item.node);
      span.appendChild(item.node);
      wrappers.push(span);
      const cls = (item.parent.className || '').toString().slice(0, 80);
      const critical = criticalSelectors.some(sel => {
        try { return item.parent.matches(sel) || !!item.parent.closest(sel); } catch (_) { return false; }
      });
      Array.from(span.getClientRects()).forEach((r, line) => {
        if (r.width < 1 || r.height < 1) return;
        /* Full-page screenshots keep fixed navigation at its viewport position.
         * Text geometrically behind that bar still has a DOM rectangle, but is
         * not visible to the user.  Requiring at least one unobscured sample
         * prevents navigation artwork from being mistaken for the hidden glyph.
         * This is deliberately evaluated after wrapping, so the wrapper itself
         * counts as part of the text target. */
        const intersectsViewport = r.bottom > 0 && r.top < innerHeight;
        const sampleX = [0.18, 0.5, 0.82].map(part => Math.max(0, Math.min(innerWidth - 1, r.left + r.width * part)));
        const sampleY = Math.max(0, Math.min(innerHeight - 1, r.top + r.height * 0.5));
        const unobscured = !intersectsViewport || sampleX.some(px => {
          const top = document.elementFromPoint(px, sampleY);
          return !!top && (top === item.parent || item.parent.contains(top));
        });
        if (!unobscured) { skippedOccluded += 1; return; }
        entries.push({
          t: item.text.slice(0, 48), cls, color: item.color, size: item.size, bold: item.bold,
          opacity: item.opacity, critical, line,
          x: Math.floor(r.left + scrollX), y: Math.floor(r.top + scrollY),
          w: Math.ceil(r.right + scrollX) - Math.floor(r.left + scrollX),
          h: Math.ceil(r.bottom + scrollY) - Math.floor(r.top + scrollY)
        });
      });
    });

    const hide = document.createElement('style');
    hide.id = '__lgHide';
    hide.textContent = '[data-lg-blank]{visibility:hidden!important}';
    hide.media = 'not all';
    document.head.appendChild(hide);
    window.__lgRestore = () => {
      document.querySelectorAll('[data-lg-blank]').forEach(span => {
        const parent = span.parentNode;
        if (!parent) return;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        span.remove();
      });
      document.getElementById('__lgHide')?.remove();
      document.getElementById('__lgFreeze')?.remove();
      delete window.__lgRestore;
    };
    return { entries, skippedGradient, skippedDecorative, skippedOccluded };
  }, { scopeSelector, criticalSelectors });

  if (prepared.error) throw new Error(prepared.error);
  assertNoForbiddenText(prepared.entries, `${surface}:${screen}:${palette}`);
  const normal = await page.screenshot({ fullPage: true, animations: 'disabled' });
  fs.writeFileSync(`/tmp/lg2_${tag}_normal.png`, normal);
  await page.evaluate(() => { const style = document.getElementById('__lgHide'); if (style) style.media = 'all'; });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  const background = await page.screenshot({ fullPage: true, animations: 'disabled' });
  fs.writeFileSync(`/tmp/lg2_${tag}_bg.png`, background);
  fs.writeFileSync(`/tmp/lg2_${tag}.json`, JSON.stringify(prepared.entries));
  await page.evaluate(() => { if (window.__lgRestore) window.__lgRestore(); });
  return { screen: `${surface}:${screen}`, tag, checked: prepared.entries.length,
    skippedGradient: prepared.skippedGradient, skippedDecorative: prepared.skippedDecorative,
    skippedOccluded: prepared.skippedOccluded };
}

/* Preserve the established v928 measurement for the nine already-covered island
 * states.  HF3 deliberately changes only the three blind spots; this prevents a
 * guard upgrade from silently redefining hundreds of long-standing decorative
 * treatments in an unrelated hotfix. */
async function captureLegacy(page, palette, screen) {
  const tag = safeTag(`${palette}__island__${screen}`);
  const entries = await page.evaluate(() => {
    const EMOJI_ONLY = /^[\W\d_\s]+$/;
    const modalOpen = !!document.querySelector('#wordModal.show, .modal-bg.show');
    const result = [];
    document.querySelectorAll('*').forEach(el => {
      if (el.closest('#bossScreen')) return;
      if (modalOpen && !el.closest('#wordModal')) return;
      const box = el.getBoundingClientRect();
      if (box.width < 12 || box.height < 10) return;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || Number.parseFloat(style.opacity) < 0.3) return;
      const text = Array.from(el.childNodes).filter(n => n.nodeType === 3)
        .map(n => n.textContent.trim()).join('').trim();
      if (!text || EMOJI_ONLY.test(text)) return;
      const inline = el.getAttribute('style') || '';
      if (/color\s*:\s*#fff[^;]*!important/i.test(inline) && (style.textShadow || '').split('rgb').length >= 3) return;
      result.push({ t: text.slice(0, 32), cls: (el.className || '').toString().slice(0, 48),
        color: style.color, size: Number.parseFloat(style.fontSize), bold: Number.parseInt(style.fontWeight, 10) >= 700,
        x: Math.round(box.x + scrollX), y: Math.round(box.y + scrollY),
        w: Math.round(box.width), h: Math.round(box.height) });
    });
    return result;
  });
  assertNoForbiddenText(entries, `island:${screen}:${palette}`);
  const normal = await page.screenshot({ fullPage: true, animations: 'disabled' });
  fs.writeFileSync(`/tmp/lg2_${tag}_normal.png`, normal);
  fs.writeFileSync(`/tmp/lg2_${tag}.json`, JSON.stringify(entries));
  return { screen: `island:${screen}`, tag, checked: entries.length, skippedGradient: 0, method: 'legacy' };
}

async function seedContext(context, palette) {
  await context.addInitScript(({ palette, beeTheme }) => {
    try {
      localStorage.setItem('hansen_palette_global', palette);
      localStorage.setItem('hansen_boss_theme', 'light');
      localStorage.setItem('hansen_sb_theme', beeTheme);
      localStorage.setItem('hansen_onboarded', '1');
      localStorage.setItem('lastIslandKey', 'wordIslandAnimal');
      localStorage.setItem('lastIslandTime', String(Date.now()));
      localStorage.setItem('wordIslandAnimal', JSON.stringify({ totalAnswers: 99, totalCorrect: 80,
        learned: [0, 1], level: 13, coins: 678, lastSaveTime: Date.now(), stats: { maxCombo: 3 }, wrongs: {} }));
      localStorage.setItem('wordIslandLand', JSON.stringify({ totalAnswers: 99, totalCorrect: 80,
        learned: [0, 1], level: 13, coins: 678, lastSaveTime: Date.now() - 1000,
        stats: { maxCombo: 3 }, wrongs: {} }));
      localStorage.setItem('hansen_starter_coins_given', '1');
      for (let i = 1; i <= 8; i++) localStorage.setItem(`land${i}_prog`, '8');
    } catch (_) {}
  }, { palette, beeTheme: BEE_THEME[palette] || 'sky' });
}

async function auditBossRoundBar(page, palette, block) {
  const prepared = await page.evaluate(() => {
    try {
      showScreen('boss');
      ['alertModal', 'hsnStoryModal', '__hansen_onboarding'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('show', 'on'); el.style.display = 'none'; }
      });
      document.querySelectorAll('.modal-bg.show').forEach(el => {
        el.classList.remove('show'); el.style.display = 'none';
      });
      document.body.classList.remove('modal-open');
      if (!window.HansenRoundReward || !window.HansenRoundBar || !window.HansenBossTheme) {
        return { error: 'Boss Round Bar API 未就绪' };
      }
      /* 固定为截图中的真实语义状态：第 2 轮只完成 Lv1，还需 Lv2-Lv20。
       * 这里只替换只读展示 API，不伪造钱包或触发奖励。 */
      window.HansenRoundReward.status = () => ({ valid: true, roundNo: 2, completed: 1,
        total: 20, cleared: [1], remain: Array.from({ length: 19 }, (_, i) => i + 2) });
      window.HansenRoundReward.total = () => 20;
      window.HansenRoundReward.count = () => 1;
      window.HansenBossTheme.apply('light');
      window.HansenRoundBar.ensure();
      window.HansenRoundBar.refresh();
      const bar = document.getElementById('hsnRoundBar');
      if (!bar) return { error: 'Boss Round Bar DOM 未生成' };
      bar.scrollIntoView({ block: 'center' });
      const style = getComputedStyle(bar);
      const key = selector => {
        const el = bar.querySelector(selector);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { color: cs.color, fill: cs.webkitTextFillColor,
          inline: el.getAttribute('style') || '', text: el.textContent.trim() };
      };
      return { error: '', parent: !!bar.closest('#bossScreen'), html: document.documentElement.className,
        background: style.backgroundImage,
        needed: key('.rb-needed'), amount: key('.rb-amount'), round: key('.rb-round') };
    } catch (error) { return { error: String(error) }; }
  });
  await waitSettled(page, 180);
  if (prepared.error) {
    block.fails.push({ screen: 'boss:round-bar-1-of-20', t: prepared.error });
    return;
  }
  if (!prepared.parent) block.fails.push({ screen: 'boss:round-bar-1-of-20', t: '进度卡不在 #bossScreen 内' });
  if (!/\bhsn-pal-light\b/.test(prepared.html) || !/\bhsn-bt-light\b/.test(prepared.html)) {
    block.fails.push({ screen: 'boss:round-bar-1-of-20', t: `主题组合错误：${prepared.html}` });
  }
  if (!/rgb\(215, 239, 255\).*rgb\(232, 221, 255\)/.test(prepared.background)) {
    block.fails.push({ screen: 'boss:round-bar-1-of-20',
      t: `晨曦卡仍是灰白/深色/透明旧底：${prepared.background}` });
  }
  for (const [name, item] of Object.entries({ needed: prepared.needed, amount: prepared.amount, round: prepared.round })) {
    if (!item) {
      block.fails.push({ screen: 'boss:round-bar-1-of-20', t: `缺少 .rb-${name}` });
      continue;
    }
    if (/color\s*:/i.test(item.inline)) {
      block.fails.push({ screen: 'boss:round-bar-1-of-20', t: `.rb-${name} 又写了行内色` });
    }
    if (item.color !== item.fill) {
      block.fails.push({ screen: 'boss:round-bar-1-of-20', t: `.rb-${name} 的 text-fill 覆盖了 color` });
    }
  }
  block.captures.push(await captureBackground(page, palette, 'boss', 'round-bar-1-of-20', '#hsnRoundBar',
    ['.rb-hd', '.rb-round', '.rb-nums', '.rb-summary', '.rb-needed', '.rb-amount',
      '.rb-remain', '.rb-list-label', '.rb-levels', '.rb-rule']));
}

async function auditIsland(page, palette, block) {
  await page.goto(URL(ISLAND), { waitUntil: 'load', timeout: 45000 });
  await waitSettled(page, 1200);
  await closeIncidentalOverlays(page);

  await page.evaluate(() => { try { showScreen('explore'); } catch (_) {} });
  await waitSettled(page);
  const flick = await page.evaluate(() => {
    const card = document.querySelector('.exp-card');
    if (!card) return null;
    const cs = getComputedStyle(card), before = getComputedStyle(card, '::before');
    return { hoverNone: matchMedia('(hover: none)').matches, transform: cs.transform,
      beforeOpacity: Number.parseFloat(before.opacity), tap: cs.webkitTapHighlightColor || '' };
  });
  if (flick?.hoverNone) {
    if (flick.transform !== 'none') block.fails.push({ screen: 'island:触屏防闪', t: '.exp-card 触屏仍有 hover 位移' });
    if (flick.beforeOpacity > 0.01) block.fails.push({ screen: 'island:触屏防闪', t: '.exp-card::before 触屏仍会淡入' });
    if (!/rgba\(0, 0, 0, 0\)|transparent/.test(flick.tap)) block.fails.push({ screen: 'island:触屏防闪', t: '.exp-card 未关闭点击高亮' });
  }

  for (const screen of [...ISLAND_SCREENS, '__modal', 'theme-shop']) {
    if (screen === '__modal') {
      await page.evaluate(() => { try { showScreen('explore'); } catch (_) {} });
      await waitSettled(page);
      await page.evaluate(() => document.querySelector('.exp-card')?.click());
      await waitSettled(page, 500);
      block.captures.push(await captureLegacy(page, palette, screen));
      await page.evaluate(() => { const m = document.getElementById('wordModal'); if (m) m.classList.remove('show'); });
    } else if (screen === 'theme-shop') {
      await page.evaluate(() => { if (window.HansenDiamondShop?.open) window.HansenDiamondShop.open(); });
      await waitSettled(page, 650);
      const count = await page.locator('#diamondshopScreen .dia-item').count();
      if (count < 3) block.fails.push({ screen: 'island:theme-shop', t: `主题商店没有真实商品卡（仅 ${count} 张）` });
      const cardSurface = await page.evaluate(() => {
        const card = document.querySelector('#diamondshopScreen .dia-item');
        if (!card) return null;
        const style = getComputedStyle(card), match = style.backgroundColor.match(/[\d.]+/g) || [];
        const numbers = match.map(Number);
        return { css: style.backgroundColor, image: style.backgroundImage,
          rgb: numbers.slice(0, 3), alpha: numbers.length > 3 ? numbers[3] : 1 };
      });
      if (!cardSurface || cardSurface.rgb.length < 3 || cardSurface.alpha < 0.85 || Math.min(...cardSurface.rgb) < 210) {
        block.fails.push({ screen: 'island:theme-shop',
          t: `亮色商店仍在使用灰暗/透明底板（${cardSurface?.css || '缺失'}）` });
      }
      block.captures.push(await captureBackground(page, palette, 'island', screen, '#diamondshopScreen',
        ['.dia-bal', '.dia-tip', '.dia-cat', '.dia-imax-tip', '.dia-name', '.owned-tag', '.dia-desc', '.dia-btn', '.dia-unequip', '.dia-soon']));
    } else {
      await page.evaluate(id => { try { showScreen(id); } catch (_) {} }, screen);
      await waitSettled(page);
      block.captures.push(await captureLegacy(page, palette, screen));
    }
  }
  await auditBossRoundBar(page, palette, block);
}

async function auditHome(page, palette, block) {
  await page.goto(URL('index.html'), { waitUntil: 'load', timeout: 45000 });
  await waitSettled(page, 1100);
  await closeIncidentalOverlays(page);
  await page.evaluate(() => { window.scrollTo(0, 0); try { window.renderRecent?.(); } catch (_) {} });
  const recent = await page.locator('#recentNum').textContent().catch(() => '');
  if (!/动物/.test(recent || '')) block.fails.push({ screen: 'home:recent-island', t: `最近探索真实数据未渲染（${recent || '空'}）` });
  block.captures.push(await captureBackground(page, palette, 'home', 'recent-island', 'main.page > header',
    ['.subtitle', '#recentLearnStat', '#recentLbl', '#recentNum']));
}

async function auditBee(page, palette, block) {
  const expected = BEE_THEME[palette] || 'sky';
  await page.goto(URL('spelling_bee.html?island=animal&embed=1'), { waitUntil: 'load', timeout: 45000 });
  await waitSettled(page, 650);
  const actual = await page.locator('body').getAttribute('data-theme');
  if (actual !== expected) block.fails.push({ screen: 'bee:setup', t: `亮色映射错误：期望 ${expected}，实际 ${actual || 'night'}` });
  block.captures.push(await captureBackground(page, palette, 'bee', 'setup', '#setup'));

  const gameReady = await page.evaluate(() => {
    try {
      S.mode = 'cn'; S.bot = 'custom'; S.customCpm = 1; S.qCount = 10; S.manualNext = true;
      startMatch();
      clearTimeout(botTimer); stopTimer();
      if (!target || target.length < 2) return false;
      typeKey(target[0]);
      typeKey(target[1] === 'z' ? 'x' : 'z');
      clearTimeout(botTimer); stopTimer();
      botProg = Math.min(2, target.length); renderBot();
      return true;
    } catch (_) { return false; }
  });
  await waitSettled(page, 250);
  const states = await page.evaluate(() => ({ ok: document.querySelectorAll('#slotsYou .slot.ok').length,
    bad: document.querySelectorAll('#slotsYou .slot.bad').length,
    bot: document.querySelectorAll('#slotsBot .slot.star').length }));
  if (!gameReady || states.ok < 1 || states.bad < 1 || states.bot < 1) {
    block.fails.push({ screen: 'bee:live-game', t: `未形成真实拼写格状态 ok=${states.ok} bad=${states.bad} bot=${states.bot}` });
  }
  block.captures.push(await captureBackground(page, palette, 'bee', 'live-game', '#game',
    ['.slot.ok', '.slot.bad', '.slot.star', '.slot.reveal', '.lane .who', '.lane .status']));
  await page.evaluate(() => { try { clearTimeout(botTimer); stopTimer(); } catch (_) {} });
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.HANSEN_CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const output = [];
  for (const palette of PALETTES) {
    const block = { palette, fails: [], captures: [] };
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true,
      hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await seedContext(context, palette);
    const page = await context.newPage();
    page.on('pageerror', error => block.fails.push({ screen: '页面异常', t: String(error).slice(0, 120) }));
    try {
      await auditIsland(page, palette, block);
      await auditHome(page, palette, block);
      await auditBee(page, palette, block);
    } catch (error) {
      block.fails.push({ screen: '致命', t: String(error).slice(0, 180) });
    }
    output.push(block);
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(output));
})().catch(error => {
  console.log(JSON.stringify([{ palette: '?', fails: [{ screen: '致命', t: String(error).slice(0, 180) }], captures: [] }]));
});
