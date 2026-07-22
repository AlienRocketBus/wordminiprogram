#!/usr/bin/env node
/**
 * v960 Boss 答题字色合同（无 Chromium 也必须完整执行）。
 *
 * 回归目标：
 *   1. 深空 / 电影两套深底 Boss 主题的题干、选项、提示、对/错反馈使用统一高对比亮色。
 *   2. 晨曦主题保持自己的深色字，不被深空 / 电影亮色反向污染。
 *   3. 八种题型（英译汉/汉译英/完形/听音/拼写补全/拼字辨认/句子翻译/打字）
 *      全部走同一套语义颜色层，不再依赖全局配色的 accentText。
 *   4. 专门锁死本次根因：樱花粉 #9f1239 不得落入 Boss 深底题面。
 *   5. 测试不得给 question.textContent 赋值后清空真实子元素。可选浏览器
 *      探针会遍历真实可见文本节点，这样内层 inline color 无法再逃检。
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.dirname(SELF);
/* 🔴v963: 资源戳随候选演进 */
import { readFileSync as __rf } from 'node:fs';
const VERSION = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const LOCK_FILE = 'hansen_boss_lock.js';
const PALETTE_FILE = 'hansen_palette.js';
const THEME_FILE = 'hansen_boss_theme.js';

const DARK_CONTRACT = Object.freeze({
  primary: '#fde68a',
  normal: '#f8fafc',
  hint: '#e2e8f0',
  correct: '#86efac',
  wrong: '#fca5a5',
});

// 晨曦是独立浅底主题：题干、选项、提示必须保持深色。
const LIGHT_CONTRACT = Object.freeze({
  primary: '#1e40af',
  normal: '#1e293b',
  hint: '#334155',
  correct: '#14532d',
  wrong: '#7f1d1d',
});

const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const lockSource = read(LOCK_FILE);
const paletteSource = read(PALETTE_FILE);
const themeSource = read(THEME_FILE);

function normalise(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function compact(value) {
  return normalise(value).replace(/\s*([:;,{}])\s*/g, '$1').replace(/\s*!important/g, '!important');
}

function hexRgb(value) {
  const match = String(value).trim().match(/^#([0-9a-f]{6})$/i);
  assert(match, `无法解析颜色 ${value}`);
  return [0, 2, 4].map(offset => Number.parseInt(match[1].slice(offset, offset + 2), 16));
}

function luminance(value) {
  const channels = hexRgb(value).map(channel => {
    const unit = channel / 255;
    return unit <= 0.04045 ? unit / 12.92 : Math.pow((unit + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function assertContrast(foreground, background, minimum, label) {
  const ratio = contrast(foreground, background);
  assert(ratio >= minimum, `${label}: ${foreground} / ${background} = ${ratio.toFixed(2)}:1 < ${minimum}:1`);
}

// 先用纯 Node 证明锁定的颜色本身具备可读性，不依赖浏览器。
for (const background of ['#05070f', '#0f172a', '#1e293b']) {
  for (const [role, colour] of Object.entries(DARK_CONTRACT)) {
    assertContrast(colour, background, 4.5, `Boss 深底 ${role}`);
  }
}
assertContrast(LIGHT_CONTRACT.primary, '#ffffff', 4.5, 'Boss 晨曦主题干');
assertContrast(LIGHT_CONTRACT.normal, '#eaf1fb', 4.5, 'Boss 晨曦普通选项');
assertContrast(LIGHT_CONTRACT.hint, '#ffffff', 4.5, 'Boss 晨曦提示');
assertContrast(LIGHT_CONTRACT.correct, '#ffffff', 4.5, 'Boss 晨曦正确反馈');
assertContrast(LIGHT_CONTRACT.wrong, '#ffffff', 4.5, 'Boss 晨曦错误反馈');

function bossPages() {
  const islands = fs.readdirSync(ROOT).filter(name => /^island_[a-z0-9_]+\.html$/i.test(name)).sort();
  const pages = ['template.html', ...islands];
  assert.equal(pages.length, 28, `v960 应有 template + 27 座岛 = 28 个 Boss 页，实际 ${pages.length}`);
  return pages;
}

// 28 个页面必须共用同一份 v960 逻辑，且顺序必须是 lock → palette → theme。
// theme 最后加载，才能以 Boss 专属规则压住樱花粉等全局亮色配色。
for (const pageName of bossPages()) {
  const source = read(pageName);
  assert.match(source, /id=["']bossScreen["']/, `${pageName}: 缺少 #bossScreen`);
  const refs = [LOCK_FILE, PALETTE_FILE, THEME_FILE].map(file => {
    const exact = `${file}?v=${VERSION}`;
    assert(source.includes(exact), `${pageName}: 未引用 ${exact}`);
    // template 内有一处 querySelector('script[src*=...]') 的加载守卫，它不是第二个脚本引用。
    // 只统计真实 <script src="..."> 标签，避免把守卫字符串误报为重复加载。
    const scriptLoads = [...source.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)]
      .filter(match => match[2].includes(file));
    assert.equal(scriptLoads.length, 1,
      `${pageName}: ${file} 必须且只能加载一次`);
    return source.indexOf(exact);
  });
  assert(refs[0] < refs[1] && refs[1] < refs[2], `${pageName}: 脚本顺序必须 lock → palette → theme`);
  for (const file of [LOCK_FILE, PALETTE_FILE, THEME_FILE]) {
    assert(!source.includes(`${file}?v=951`), `${pageName}: 仍残留 ${file}?v=951`);
  }
}

// 基础四题型存在于每个页面的真实出题逻辑；高级四题型由中央 lock 统一接管。
const BASE_TYPES = ['en2cn', 'cn2en', 'cloze', 'listen'];
for (const pageName of bossPages()) {
  const source = read(pageName);
  for (const type of BASE_TYPES) {
    assert(source.includes(`qType==='${type}'`) || source.includes(`qType = '${type}'`) || source.includes(`qType='${type}'`),
      `${pageName}: 基础 Boss 题型 ${type} 丢失`);
  }
}

const ADVANCED_TYPES = Object.freeze({
  spellFill: ['boss-answer-primary', 'boss-answer-kicker', 'boss-answer-box'],
  spellPick: ['boss-answer-primary', 'boss-answer-kicker', 'boss-answer-secondary', 'boss-answer-box'],
  sentTrans: ['boss-answer-primary'],
  typing: ['boss-answer-primary', 'boss-answer-kicker'],
});

function between(start, end) {
  const from = lockSource.indexOf(start);
  const to = lockSource.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `${LOCK_FILE}: 无法截取 ${start} → ${end}`);
  return lockSource.slice(from, to);
}

const advancedBlocks = {
  spellFill: between('function applySpellFill(', 'function applySpellPick('),
  spellPick: between('function applySpellPick(', 'function applySentTrans('),
  sentTrans: between('function applySentTrans(', 'var _btsTyped'),
  typing: between('function applyTyping(', 'function submitTyping('),
};

for (const [type, semanticClasses] of Object.entries(ADVANCED_TYPES)) {
  const block = advancedBlocks[type];
  assert(lockSource.includes(`mode === '${type}'`), `${LOCK_FILE}: ${type} 没有接入章节题型分发`);
  assert.match(block, /bq\.innerHTML\s*=/, `${LOCK_FILE}: ${type} 没有真实子元素题面`);
  for (const className of semanticClasses) {
    assert(block.includes(className), `${LOCK_FILE}: ${type} 题面缺少 .${className} 语义节点`);
  }
}

// #bsfHole 是唯一特例：未作答时必须“深字 + 亮黄底”，不能被题干亮黄规则染成黄字压黄底。
assert.match(advancedBlocks.spellFill,
  /id=["']bsfHole["'][^>]*style=["'][^"']*color:#1e293b[^"']*background:#fbbf24/i,
  `${LOCK_FILE}: #bsfHole 未作答态必须是 #1e293b / #fbbf24`);
assert.match(lockSource,
  /window\._bossQType\s*===\s*["']spellFill["'][\s\S]{0,800}?getElementById\(["']bsfHole["']\)[\s\S]{0,800}?classList\.add\(resultClass\)/i,
  `${LOCK_FILE}: #bsfHole 作答后必须挂上正确/错误语义状态类`);
assert(lockSource.includes('boss-answer-result-correct') && lockSource.includes('boss-answer-result-wrong'),
  `${LOCK_FILE}: 缺少亮绿/亮粉红结果语义类`);

// 从 JS 中执行主题引擎并取出它真正注入的 CSS，避免只做脆弱的源码字符串搜索。
function emittedThemeCss() {
  const elements = new Map();
  const classNames = new Set();
  const classList = {
    add: (...names) => names.forEach(name => classNames.add(name)),
    remove: (...names) => names.forEach(name => classNames.delete(name)),
    contains: name => classNames.has(name),
  };
  const appendChild = element => {
    if (element && element.id) elements.set(element.id, element);
    return element;
  };
  const documentElement = { classList, appendChild };
  const document = {
    readyState: 'complete',
    documentElement,
    head: { appendChild },
    body: { classList, __hsnBtClassObserver: true },
    createElement: tagName => ({
      tagName: String(tagName).toUpperCase(), id: '', textContent: '', innerHTML: '',
      className: '', classList: { add() {}, remove() {}, contains() { return false; } },
      appendChild() {}, querySelectorAll() { return []; },
    }),
    getElementById: id => elements.get(id) || null,
    addEventListener() {},
  };
  const localStorage = {
    values: new Map([['hansen_boss_theme', 'dark']]),
    getItem(key) { return this.values.get(key) || null; },
    setItem(key, value) { this.values.set(key, String(value)); },
  };
  const context = {
    document, localStorage, console,
    setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} },
  };
  context.window = context;
  context.addEventListener = () => {};
  vm.runInNewContext(themeSource, context, { filename: THEME_FILE });
  const style = elements.get('hsnBossThemeCSS');
  assert(style && style.textContent, `${THEME_FILE}: 未注入 #hsnBossThemeCSS`);
  return String(style.textContent);
}

function parseRules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({
      selectors: match[1].split(',').map(normalise),
      body: compact(match[2]),
    });
  }
  return rules;
}

const themeCss = emittedThemeCss();
const rules = parseRules(themeCss);

function selectorEndsWith(selector, target) {
  return selector === target || selector.endsWith(` ${target}`);
}

function matchingRules(theme, target) {
  const themePrefix = `html.hsn-bt-${theme}`;
  return rules.filter(rule => rule.selectors.some(selector =>
    selector.includes(themePrefix) && selector.includes('#bossscreen') && selectorEndsWith(selector, target)));
}

function assertColourRule(theme, target, expected, label = target) {
  const candidates = matchingRules(theme, target);
  assert(candidates.length, `${THEME_FILE}: ${theme}/${label} 缺少专属规则`);
  const wanted = `color:${expected}!important`;
  assert(candidates.some(rule => rule.body.includes(wanted)),
    `${THEME_FILE}: ${theme}/${label} 必须锁定 ${expected}\n` +
    candidates.map(rule => `  ${rule.selectors.join(',')} { ${rule.body} }`).join('\n'));
}

const ROLE_VARIABLE = Object.freeze({
  primary: '--boss-answer-primary',
  normal: '--boss-answer-text',
  hint: '--boss-answer-muted',
  correct: '--boss-answer-correct',
  wrong: '--boss-answer-wrong',
});

function assertDarkVariables(theme) {
  const candidates = matchingRules(theme, '#bossscreen');
  assert(candidates.length, `${THEME_FILE}: ${theme} 缺少 #bossScreen 语义色变量合同`);
  for (const [role, expected] of Object.entries(DARK_CONTRACT)) {
    const declaration = `${ROLE_VARIABLE[role]}:${expected}`;
    assert(candidates.some(rule => rule.body.includes(declaration)),
      `${THEME_FILE}: ${theme} 必须锁定 ${declaration}`);
  }
}

function assertRoleRule(theme, target, role, label = target) {
  const candidates = matchingRules(theme, target);
  assert(candidates.length, `${THEME_FILE}: ${theme}/${label} 缺少专属规则`);
  const direct = `color:${DARK_CONTRACT[role]}!important`;
  const variable = `color:var(${ROLE_VARIABLE[role]})!important`;
  assert(candidates.some(rule => rule.body.includes(direct) || rule.body.includes(variable)),
    `${THEME_FILE}: ${theme}/${label} 必须使用 ${DARK_CONTRACT[role]} (${ROLE_VARIABLE[role]})\n` +
    candidates.map(rule => `  ${rule.selectors.join(',')} { ${rule.body} }`).join('\n'));
}

function assertDarkThemeContract(theme) {
  assertDarkVariables(theme);
  assertRoleRule(theme, '#bossq', 'primary', '基础题干 #bossQ');
  assertRoleRule(theme, '.boss-answer-primary', 'primary', '高级题干');
  assertRoleRule(theme, '.boss-answer-secondary', 'primary', '高级题面答案');
  assertRoleRule(theme, '#bossqsub', 'hint', '基础提示 #bossQSub');
  assertRoleRule(theme, '.boss-answer-kicker', 'hint', '高级提示');
  assertRoleRule(theme, '.boss-opt', 'normal', '普通选项');
  assertRoleRule(theme, '.boss-answer-choice-text', 'normal', '句翻选项真实子元素');
  assertRoleRule(theme, '.boss-opt.correct', 'correct', '正确选项');
  assertRoleRule(theme, '.boss-opt.correct *', 'correct', '正确选项子元素');
  assertRoleRule(theme, '.boss-opt.wrong', 'wrong', '错误选项');
  assertRoleRule(theme, '.boss-opt.wrong *', 'wrong', '错误选项子元素');
  assertRoleRule(theme, '.boss-answer-result-correct', 'correct', '题面/打字正确状态');
  assertRoleRule(theme, '.boss-answer-result-wrong', 'wrong', '题面/打字错误状态');
  assertRoleRule(theme, '.bts-slot.filled', 'primary', '打字槽已输入字母');

  // 历史 inline 颜色是真正会绕过外层颜色的通道，必须在 Boss 主题里显式接管。
  for (const legacyGold of ['#fbbf24', '#fde047', '#facc15']) {
    assertRoleRule(theme, `[style*="color:${legacyGold}"]`, 'primary', `inline 金色 ${legacyGold}`);
  }
  assertRoleRule(theme, '[style*="color:#22c55e"]', 'correct', 'inline 旧绿色');
  assertRoleRule(theme, '[style*="color:#ef4444"]', 'wrong', 'inline 旧红色');

  // 宽口径题干染色后一定要有 #bsfHole 更高优先级特例，不准“黄字压黄底”。
  assertColourRule(theme, '#bsfhole:not(.boss-answer-result-correct):not(.boss-answer-result-wrong)',
    '#1e293b', '#bsfHole 未作答特例');
}

assertDarkThemeContract('dark');
assertDarkThemeContract('cinema');

// 晨曦的深色字必须有独立规则；不能偷用上面两套亮色合同。
assertColourRule('light', '#bossq', LIGHT_CONTRACT.primary, '晨曦题干');
assertColourRule('light', '#bossqsub', LIGHT_CONTRACT.hint, '晨曦提示');
assertColourRule('light', '.boss-opt', LIGHT_CONTRACT.normal, '晨曦选项');
assertColourRule('light', '.boss-opt.correct', LIGHT_CONTRACT.correct, '晨曦正确选项');
assertColourRule('light', '.boss-opt.wrong', LIGHT_CONTRACT.wrong, '晨曦错误选项');
assertColourRule('light', '[style*="color:#fbbf24"]', LIGHT_CONTRACT.primary, '晨曦 inline 金色');
assertColourRule('light', '[style*="color:#22c55e"]', '#15803d', '晨曦 inline 旧绿色');
assertColourRule('light', '[style*="color:#ef4444"]', '#b91c1c', '晨曦 inline 旧红色');

// 根因锁：#9f1239 可以继续作为樱花粉浅底页的全局强调色，但 Boss 专属 CSS 不得使用它。
assert.match(paletteSource, /accentText\s*:\s*["']#9f1239["']/i, '樱花粉全局强调色数据意外丢失');
assert(!/#9f1239/i.test(themeCss), `${THEME_FILE}: Boss 专属 CSS 再次引入了暗酒红 #9f1239`);

// 测试自身也要防回归：禁止重现旧测试的错误做法——用 textContent 清掉 #bossQ 真实子节点。
const selfSource = fs.readFileSync(SELF, 'utf8');
assert.doesNotMatch(selfSource, /(?:question|bossq)\s*\.\s*textContent\s*=/i,
  '本测试不得用 textContent 替换真实 Boss 题面');
assert.match(selfSource, /createTreeWalker\([\s\S]*NodeFilter\.SHOW_TEXT/,
  '可选浏览器探针必须遍历真实文本节点');

/**
 * 可选真机级探针。默认不要求 Chromium，保证纯 Node CI / 沙盒也能执行上面的全部强回归。
 * 环境已有 Chromium 时运行：HANSEN_RUN_BROWSER_CONTRAST=1 node test_boss_answer_contrast_v952.mjs
 */
async function optionalBrowserProbe() {
  if (process.env.HANSEN_RUN_BROWSER_CONTRAST !== '1') return false;
  const { chromium } = await import('./playwright_loader.mjs');
  let server;
  let browser;
  try {
    server = http.createServer((request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
        const relative = pathname === '/' ? 'island_animal.html' : pathname.replace(/^\/+/, '');
        const filename = path.resolve(ROOT, relative);
        if (!filename.startsWith(ROOT + path.sep) || !fs.statSync(filename).isFile()) throw new Error('not found');
        response.writeHead(200, { 'content-type': filename.endsWith('.html') ? 'text/html; charset=utf-8' :
          filename.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream', 'cache-control': 'no-store' });
        fs.createReadStream(filename).pipe(response);
      } catch (_) { response.writeHead(404).end('not found'); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      deviceScaleFactor: 2, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('hansen_onboarded', '1');
      localStorage.setItem('hansen_starter_coins_given', '1');
      localStorage.setItem('hsnViewMode', 'desktop');
      localStorage.setItem('wordIsland', JSON.stringify({ totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 20,
        coins: 9999, stats: { maxCombo: 3 }, wrongs: {}, bossUnlocked: 20 }));
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/island_animal.html?boss-answer-contrast-v960=1`, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.startBoss === 'function' && window.HansenBossTheme &&
      typeof window.hansenApplyPalette === 'function');
    await page.evaluate(() => {
      for (const id of ['alertModal', 'hsnStoryModal', '__hansen_onboarding']) {
        const element = document.getElementById(id);
        if (element) { element.classList.remove('show', 'on'); element.style.display = 'none'; }
      }
      document.body.classList.remove('modal-open');
      window.S.level = 20;
      window.S.bossUnlocked = 20;
      window._hansenRebattleLv = 1;
      window.__hbuNewModeProb = 0;
      if (window.HansenBossProgress) window.HansenBossProgress.getUnlockedBossLv = () => 20;
      window.showScreen('boss');
      window.startBoss();
    });
    await page.waitForFunction(() => document.body.classList.contains('hsn-boss-battle') &&
      document.getElementById('bossQ')?.textContent.trim() && document.querySelector('#bossOpts .boss-opt'));

    for (const palette of ['sakura', 'cloud', 'cream', 'mint', 'cosmos']) {
      for (const theme of ['dark', 'cinema', 'light']) {
        const snapshot = await page.evaluate(({ palette, theme }) => {
          window.hansenApplyPalette(palette, true);
          window.HansenBossTheme.apply(theme);
          // 重点：只读取真实后代文本节点，绝不改写 #bossQ.innerHTML/textContent。
          const roots = ['#bossQ', '#bossQSub', '#bossOpts'];
          const items = [];
          for (const selector of roots) {
            const root = document.querySelector(selector);
            if (!root) continue;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
              if (!textNode.nodeValue.trim()) continue;
              const element = textNode.parentElement;
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || !rect.width || !rect.height) continue;
              items.push({ root: selector, tag: element.tagName, id: element.id, classes: element.className,
                text: textNode.nodeValue.trim(), color: style.color });
            }
          }
          return { htmlClass: document.documentElement.className, items };
        }, { palette, theme });
        assert(snapshot.items.length, `${palette}/${theme}: 没有读到真实题面文本节点`);
        assert(!snapshot.items.some(item => item.color === 'rgb(159, 18, 57)'),
          `${palette}/${theme}: 真实子节点泄漏樱花暗酒红 #9f1239\n${JSON.stringify(snapshot.items, null, 2)}`);
      }
    }
    await context.close();
    return true;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server?.listening) await new Promise(resolve => server.close(resolve));
  }
}

const browserRan = await optionalBrowserProbe();
console.log(`Boss answer contrast v960: 28 pages + 8 modes + dark/cinema exact bright contract + light isolation + inline overrides + bsfHole + real-child guard ✅${browserRan ? ' + Chromium ✅' : ' (Chromium optional: skipped)'}`);
