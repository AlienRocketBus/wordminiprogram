#!/usr/bin/env node
// v946 HF7: 驼棕文字禁色墙。禁止静态文字样式/SVG 文字与 Boss 真实计算样式重新使用被封杀的棕橙色族。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// 用户点名封杀的驼棕/棕橙文字色族。这里用 RGB 作权威，因此
// #hex / rgb() / rgba() / hsl() 等不同写法最终都能在运行时被同一条规则拦住。
const FORBIDDEN = new Map([
  ['146,64,14', '#92400e'],
  ['120,53,15', '#78350f'],
  ['124,45,18', '#7c2d12'],
  ['154,52,18', '#9a3412'],
  ['133,77,14', '#854d0e'],
  ['113,63,18', '#713f12'],
  ['180,83,9', '#b45309'],
  ['161,98,7', '#a16207'],
  ['194,65,12', '#c2410c'],
]);

const LIGHT_BLUE = 'rgb(30, 64, 175)';       // #1e40af：晨曦题型/主词
const LIGHT_DIALOGUE = 'rgb(30, 58, 95)';    // #1e3a5f：晨曦普通台词
const LIGHT_CRIT = 'rgb(126, 34, 206)';       // #7e22ce：暴击台词
const LIGHT_RAGE = 'rgb(185, 28, 28)';       // #b91c1c：狂怒台词

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hslToRgb(hue, saturation, lightness) {
  hue = ((hue % 360) + 360) % 360;
  saturation = Math.max(0, Math.min(1, saturation));
  lightness = Math.max(0, Math.min(1, lightness));
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const part = hue / 60;
  const x = chroma * (1 - Math.abs((part % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (part < 1) [r, g] = [chroma, x];
  else if (part < 2) [r, g] = [x, chroma];
  else if (part < 3) [g, b] = [chroma, x];
  else if (part < 4) [g, b] = [x, chroma];
  else if (part < 5) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];
  const match = lightness - chroma / 2;
  return [clampByte((r + match) * 255), clampByte((g + match) * 255), clampByte((b + match) * 255)];
}

function colourTokens(value) {
  const tokens = [];
  const source = String(value || '');
  for (const match of source.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)) {
    tokens.push([
      Number.parseInt(match[1].slice(0, 2), 16),
      Number.parseInt(match[1].slice(2, 4), 16),
      Number.parseInt(match[1].slice(4, 6), 16),
    ]);
  }
  for (const match of source.matchAll(/rgba?\(\s*([\d.]+%?)\s*[, ]+\s*([\d.]+%?)\s*[, ]+\s*([\d.]+%?)/gi)) {
    tokens.push([match[1], match[2], match[3]].map(raw =>
      clampByte(raw.endsWith('%') ? Number.parseFloat(raw) * 2.55 : Number.parseFloat(raw))));
  }
  for (const match of source.matchAll(/hsla?\(\s*([-\d.]+)(?:deg)?\s*[, ]+\s*([\d.]+)%\s*[, ]+\s*([\d.]+)%/gi)) {
    tokens.push(hslToRgb(Number.parseFloat(match[1]), Number.parseFloat(match[2]) / 100,
      Number.parseFloat(match[3]) / 100));
  }
  return tokens;
}

function forbiddenIn(value) {
  const found = [];
  for (const rgb of colourTokens(value)) {
    const key = rgb.join(',');
    if (FORBIDDEN.has(key)) found.push(FORBIDDEN.get(key));
  }
  return [...new Set(found)];
}

function runtimeStaticFiles() {
  const names = fs.readdirSync(ROOT).sort();
  return names.filter(name => {
    const target = path.join(ROOT, name);
    if (!fs.statSync(target).isFile()) return false;
    if (/\.css$/i.test(name)) return true;
    if (/\.js$/i.test(name)) return true;
    if (name === 'island_data.json') return true; // 生成源也必须清零，否则下次 generate 会复活。
    return /^(?:index|template|check|spelling_bee|boss_hall|land_map|season_showcase|_frame|_sw_upgrade_v944|island_[a-z0-9_]+)\.html$/i.test(name);
  });
}

function staticCamelTextAudit() {
  const findings = [];
  for (const name of runtimeStaticFiles()) {
    const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
    // island_data.json / vocab_all.js 很大；预建换行索引，避免每个命中都从文件头重扫。
    const newlineOffsets = [];
    for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1)) {
      newlineOffsets.push(index);
    }
    const lineAt = offset => {
      let low = 0, high = newlineOffsets.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (newlineOffsets[middle] < offset) low = middle + 1;
        else high = middle;
      }
      return low + 1;
    };

    // CSS/inline CSS 文字声明。负向边界防止把 border-color / stop-color 误当文字。
    const declarations = /(?<![-\w])(?:color|-webkit-text-fill-color)\s*:\s*([^;}\n]+)/gim;
    for (const match of source.matchAll(declarations)) {
      // JS 数据对象 color:'#...' 通常是 Boss/卡牌装饰配色；但段位对象的
      // rank.color 会直接拼进文字 style，必须和普通 CSS 一样接受禁色检查。
      if (/^\s*['"`]/.test(match[1]) && name !== 'hansen_addiction.js') continue;
      const bad = forbiddenIn(match[1]);
      if (bad.length) findings.push(`${name}:${lineAt(match.index)} text-color ${bad.join('/')}`);
    }

    // 字体语义的 CSS 变量（包括 --hi/--you/--accent）不得绕过上面的 color 检查。
    const textVariables = /--[a-z0-9_-]*(?:ink|text|foreground|fg|accent|\bhi\b|\byou\b)[a-z0-9_-]*\s*:\s*([^;}\n]+)/gim;
    for (const match of source.matchAll(textVariables)) {
      const bad = forbiddenIn(match[1]);
      if (bad.length) findings.push(`${name}:${lineAt(match.index)} text-variable ${bad.join('/')}`);
    }

    // element.style.color / setProperty('color',...) 这类动态文字写法。
    const assignments = /(?:\.style\.(?:color|webkitTextFillColor)\s*=|setProperty\(\s*['"](?:color|-webkit-text-fill-color)['"]\s*,)\s*['"]([^'"]+)['"]/gim;
    for (const match of source.matchAll(assignments)) {
      const bad = forbiddenIn(match[1]);
      if (bad.length) findings.push(`${name}:${lineAt(match.index)} text-assignment ${bad.join('/')}`);
    }

    // 阴影、描边、装饰线和光标同样参与字形绘制，不能成为禁色旁路。
    const textEffects = /(?:text-shadow|-webkit-text-stroke(?:-color)?|text-decoration-color|caret-color)\s*:\s*([^;}]+)/gim;
    for (const match of source.matchAll(textEffects)) {
      const bad = forbiddenIn(match[1]);
      if (bad.length) findings.push(`${name}:${lineAt(match.index)} text-effect ${bad.join('/')}`);
    }

    // 透明文字用 background-clip:text 绘制颜色，必须检查整条规则的渐变端点。
    for (const match of source.matchAll(/(?:-webkit-)?background-clip\s*:\s*text/gim)) {
      const open = source.lastIndexOf('{', match.index);
      const close = source.indexOf('}', match.index);
      const rule = source.slice(open === -1 ? match.index : open, close === -1 ? match.index + 512 : close + 1);
      const bad = forbiddenIn(rule);
      if (bad.length) findings.push(`${name}:${lineAt(match.index)} clipped-text-gradient ${bad.join('/')}`);
    }

    // 只禁 SVG 里的 <text> 文字 fill/stroke；普通图形、木头、皮革与边框不在本次范围。
    for (const match of source.matchAll(/<text\b[^>]*>/gims)) {
      const tag = match[0];
      for (const attr of tag.matchAll(/\b(?:fill|stroke)\s*=\s*(['"])(.*?)\1/gims)) {
        const bad = forbiddenIn(attr[2]);
        if (bad.length) findings.push(`${name}:${lineAt(match.index)} svg-text ${bad.join('/')}`);
      }
      const style = tag.match(/\bstyle\s*=\s*(['"])(.*?)\1/is);
      if (style) {
        const bad = forbiddenIn(style[2]);
        if (bad.length) findings.push(`${name}:${lineAt(match.index)} svg-text-style ${bad.join('/')}`);
      }
    }
  }
  assert.deepEqual(findings, [], `发现被封杀的驼棕文字色：\n${findings.slice(0, 40).join('\n')}`);
}

staticCamelTextAudit();

function rgb(value) {
  const parsed = colourTokens(value)[0];
  assert(parsed, `无法解析颜色 ${value}`);
  return parsed;
}

function luminance(value) {
  const channels = rgb(value).map(channel => {
    channel /= 255;
    return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
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
  try { instance.closeAllConnections?.(); } catch (_) { }
});

function assertComputedClean(snapshot, label) {
  assert.equal(snapshot.themeClasses.length, 1,
    `${label}: Boss 主题类必须且只能有一个 ${snapshot.themeClasses.join(',')}`);
  for (const [name, item] of Object.entries(snapshot.items)) {
    // 内层自适应缩放包装按文案长度按需生成；外层 #bossMsg 始终必须存在并接受检查。
    if (name === 'messageInner' && !item) continue;
    assert(item, `${label}: 缺少 ${name}`);
    assert(item.visible, `${label}: ${name} 未在真实战斗中显示`);
    assert(item.text, `${label}: ${name} 没有真实文字`);
    for (const [property, value] of Object.entries({
      color: item.color, textFill: item.fill, clippedGradient: item.backgroundImage,
    })) {
      const bad = forbiddenIn(value);
      assert.equal(bad.length, 0, `${label}/${name}: ${property}=${value} 命中禁色 ${bad.join('/')}`);
    }
  }
}

function keyColours(snapshot) {
  return {
    message: snapshot.items.message.color,
    type: snapshot.items.type.color,
    question: snapshot.items.question.color,
    sub: snapshot.items.sub.color,
    bossName: snapshot.items.bossName.color,
    option: snapshot.items.option.color,
  };
}

async function takeSnapshot(page, theme, palette) {
  await page.evaluate(({ selectedTheme, selectedPalette }) => {
    window.hansenApplyPalette?.(selectedPalette, true);
    window.HansenBossTheme.apply(selectedTheme);
    const message = document.getElementById('bossMsg');
    const type = document.getElementById('bossQType');
    const question = document.getElementById('bossQ');
    const sub = document.getElementById('bossQSub');
    // 题干文字固定成用户截图的真实语义状态，不改结构与样式。
    message.className = 'boss-msg';
    message.textContent = '万物归我支配!';
    type.textContent = '📖 英译汉';
    question.textContent = 'camel';
    if (sub) sub.textContent = '这个英语单词是什么意思?';
  }, { selectedTheme: theme, selectedPalette: palette });
  // 从暴击/狂怒切回普通台词也有 .25s 颜色过渡；等到终态再做主题隔离比较。
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const take = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return {
        text: element.textContent.trim(), color: style.color,
        fill: style.webkitTextFillColor, background: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 &&
          rect.width > 0 && rect.height > 0,
      };
    };
    return {
      htmlClass: document.documentElement.className,
      themeClasses: [...document.documentElement.classList].filter(value => value.startsWith('hsn-bt-')),
      items: {
        message: take('#bossMsg'), messageInner: take('#bossMsg .boss-msg-inner'),
        type: take('#bossQType'), question: take('#bossQ'), sub: take('#bossQSub'),
        bossName: take('#bossName'), option: take('#bossOpts .boss-opt'),
      },
    };
  });
}

async function run() {
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'island_animal.html' : pathname.replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);
      if (!filename.startsWith(ROOT + path.sep) || !fs.statSync(filename).isFile()) throw new Error('not found');
      response.writeHead(200, {
        'content-type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      fs.createReadStream(filename).pipe(response);
    } catch (_) { response.writeHead(404).end('not found'); }
  });
  await listen(server);
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block',
  });
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('hansen_palette_global', 'cloud');
    localStorage.setItem('hansen_boss_theme', 'light');
    localStorage.setItem('hansen_onboarded', '1');
    localStorage.setItem('hansen_starter_coins_given', '1');
    localStorage.setItem('hsnViewMode', 'desktop');
    localStorage.setItem('wordIsland', JSON.stringify({
      totalAnswers: 99, totalCorrect: 80, learned: [0, 1], level: 20,
      coins: 9999, stats: { maxCombo: 3 }, wrongs: {}, bossUnlocked: 20,
    }));
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${origin}/island_animal.html?camel-color-ban-hf7=1`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.startBoss === 'function' && window.HansenBossTheme &&
    typeof window.hansenApplyPalette === 'function');
  await page.evaluate(() => {
    for (const id of ['alertModal', 'hsnStoryModal', '__hansen_onboarding']) {
      const element = document.getElementById(id);
      if (element) { element.classList.remove('show', 'on'); element.style.display = 'none'; }
    }
    document.querySelectorAll('.modal-bg.show').forEach(element => {
      element.classList.remove('show'); element.style.display = 'none';
    });
    document.body.classList.remove('modal-open');
    window.S.level = 20;
    window.S.bossUnlocked = 20;
    // Lv17～20 有 50% 概率进入会隐藏题型/台词的打字模式；颜色回归固定
    // Lv1，确保断言始终检查截图对应的基础题 UI，而不是依赖随机分支。
    window._hansenRebattleLv = 1;
    window.__hbuNewModeProb = 0;
    if (window.HansenBossProgress) window.HansenBossProgress.getUnlockedBossLv = () => 20;
    window.showScreen('boss');
    window.startBoss();
  });
  await page.waitForFunction(() => document.body.classList.contains('hsn-boss-battle') &&
    document.getElementById('bossQType')?.textContent.trim() &&
    document.getElementById('bossQ')?.textContent.trim() &&
    document.querySelector('#bossOpts .boss-opt'));

  const light = await takeSnapshot(page, 'light', 'cloud');
  assertComputedClean(light, 'cloud + Boss晨曦');
  assert.match(light.htmlClass, /\bhsn-pal-cloud\b/);
  assert.match(light.htmlClass, /\bhsn-pal-light\b/);
  assert.equal(light.items.type.color, LIGHT_BLUE, '晨曦“英译汉”必须是新深蓝');
  assert.equal(light.items.question.color, LIGHT_BLUE, '晨曦“camel”必须是新深蓝');
  assert.equal(light.items.type.fill, LIGHT_BLUE, '题型 text-fill 不得覆盖新蓝色');
  assert.equal(light.items.question.fill, LIGHT_BLUE, '主词 text-fill 不得覆盖新蓝色');
  assert.equal(light.items.message.color, LIGHT_DIALOGUE, '晨曦普通 Boss 台词必须是蓝灰墨色');
  for (const background of ['rgb(255, 255, 255)', 'rgb(188, 208, 234)']) {
    assert(contrast(LIGHT_BLUE, background) >= 4.5,
      `晨曦新蓝 ${LIGHT_BLUE} 对 ${background} 对比度不足`);
  }

  // 台词状态不得把驼棕色悄悄带回来。
  for (const [state, expected] of [['crit', LIGHT_CRIT], ['rage', LIGHT_RAGE]]) {
    await page.evaluate(selected => {
      const message = document.getElementById('bossMsg');
      message.className = `boss-msg ${selected}`;
      message.textContent = selected === 'crit' ? '暴击!' : '狂怒!';
    }, state);
    // Boss 锁定样式保留了 color .25s 的状态过渡；检查动画终态，而不是切类同一帧的起点。
    await page.waitForTimeout(300);
    const item = await page.evaluate(() => {
      const message = document.getElementById('bossMsg');
      const style = getComputedStyle(message);
      return { color: style.color, fill: style.webkitTextFillColor };
    });
    assert.equal(item.color, expected, `晨曦 ${state} 台词颜色错误`);
    assert.equal(forbiddenIn(item.color).length, 0, `晨曦 ${state} 台词命中驼棕禁色`);
    assert.equal(forbiddenIn(item.fill).length, 0, `晨曦 ${state} text-fill 命中驼棕禁色`);
  }

  // 全局配色切换不得污染 Boss 晨曦专属颜色。
  const lightKey = keyColours(light);
  for (const palette of ['sakura', 'cream', 'mint', 'cosmos', 'cloud']) {
    const sample = await takeSnapshot(page, 'light', palette);
    assertComputedClean(sample, `${palette} + Boss晨曦`);
    assert.deepEqual(keyColours(sample), lightKey, `${palette} 全局配色污染 Boss 晨曦文字`);
  }

  // dark/cinema 保留原有金色/浅色语义，不得被晨曦蓝色或驼棕色反向污染。
  const dark = await takeSnapshot(page, 'dark', 'cloud');
  const cinema = await takeSnapshot(page, 'cinema', 'cloud');
  assertComputedClean(dark, 'cloud + Boss深空');
  assertComputedClean(cinema, 'cloud + Boss电影');
  assert.notEqual(dark.items.type.color, LIGHT_BLUE, '深空题型被晨曦蓝色污染');
  assert.notEqual(dark.items.question.color, LIGHT_BLUE, '深空主词被晨曦蓝色污染');
  assert.notEqual(dark.items.message.color, LIGHT_DIALOGUE, '深空台词被晨曦蓝灰污染');
  assert.notEqual(cinema.items.type.color, LIGHT_BLUE, '电影题型被晨曦蓝色污染');
  assert.notEqual(cinema.items.question.color, LIGHT_BLUE, '电影主词被晨曦蓝色污染');
  assert.notEqual(cinema.items.message.color, LIGHT_DIALOGUE, '电影台词被晨曦蓝灰污染');

  // 三套 Boss 主题 × 三种消息状态都检查真实内层包装。长台词运行时会生成
  // .boss-msg-inner；外层和内层任何一层都不能用禁色或被主题切换污染。
  for (const theme of ['light', 'dark', 'cinema']) {
    for (const state of ['normal', 'crit', 'rage']) {
      await page.evaluate(({ selectedTheme, selectedState }) => {
        window.HansenBossTheme.apply(selectedTheme);
        const message = document.getElementById('bossMsg');
        message.className = selectedState === 'normal' ? 'boss-msg' : `boss-msg ${selectedState}`;
        message.innerHTML = `<span class="boss-msg-inner">${selectedState === 'normal' ? '万物归我支配!' : selectedState === 'crit' ? '暴击!' : '狂怒!'}</span>`;
      }, { selectedTheme: theme, selectedState: state });
      await page.waitForTimeout(300);
      const messageColours = await page.evaluate(() => {
        const readColour = selector => {
          const element = document.querySelector(selector), style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return { color: style.color, fill: style.webkitTextFillColor,
            visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 };
        };
        return { outer: readColour('#bossMsg'), inner: readColour('#bossMsg .boss-msg-inner') };
      });
      for (const [layer, item] of Object.entries(messageColours)) {
        assert(item.visible, `${theme}/${state}/${layer} 台词不可见`);
        assert.equal(forbiddenIn(item.color).length, 0, `${theme}/${state}/${layer} color 命中驼棕禁色`);
        assert.equal(forbiddenIn(item.fill).length, 0, `${theme}/${state}/${layer} text-fill 命中驼棕禁色`);
      }
    }
  }

  const lightAgain = await takeSnapshot(page, 'light', 'cloud');
  assertComputedClean(lightAgain, '深空/电影往返后的 Boss晨曦');
  assert.deepEqual(keyColours(lightAgain), lightKey, '主题往返后晨曦文字没有恢复精确配色');
  assert.deepEqual(errors, [], 'Boss 三主题/全局配色切换过程不得出现运行异常');
  await context.close();
}

try {
  await run();
  console.log('Camel text color ban HF7: static text/SVG + Boss dark/light/cinema computed colors + AA blue + isolation ✅');
} finally {
  if (browser) await browser.close().catch(() => { });
  await closeServer(server);
}
