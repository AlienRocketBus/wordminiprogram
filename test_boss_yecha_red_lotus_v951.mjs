#!/usr/bin/env node
// v951: 夜罗刹·红莲战鬼《红莲圣域·万瓣天葬》正式接入回归锁。
// 目标：动作身份、四幕分镜、正式战斗节奏、单次命中、移动端上限和纯 Canvas 安全约束同时成立。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
/* 🔴v963 合同同步: 版本钉改为动态读 VERSION(资源戳/appVersion随候选演进,合同本体不变) */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const source = read('hansen_boss_attack.js');
const land5 = read('island_land5.html');
const worker = read('sw_v944.js');

function extractNamedFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert(start >= 0, `缺少 ${name}`);
  const brace = text.indexOf('{', start);
  assert(brace >= 0, `${name} 缺少函数体`);
  let depth = 0;
  let mode = 'code';
  let quote = '';
  let escaped = false;
  for (let i = brace; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (mode === 'line') { if (ch === '\n') mode = 'code'; continue; }
    if (mode === 'block') { if (ch === '*' && next === '/') { mode = 'code'; i++; } continue; }
    if (mode === 'string') {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) mode = 'code';
      continue;
    }
    if (ch === '/' && next === '/') { mode = 'line'; i++; continue; }
    if (ch === '/' && next === '*') { mode = 'block'; i++; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { mode = 'string'; quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  assert.fail(`${name} 函数体没有闭合`);
}

const fnSource = extractNamedFunction(source, 'fxYecha');
const fnStart = source.indexOf('function fxYecha(');
const identityWindow = source.slice(Math.max(0, fnStart - 620), fnStart);

// ── 身份、接线与正式发布缓存 ───────────────────────────────────
assert.match(identityWindow, /v951[\s\S]*红莲圣域[\s\S]*万瓣天葬/,
  '夜罗刹正式动作必须明确标记为 v951《红莲圣域·万瓣天葬》');
assert.match(identityWindow, /三重景深红莲绽放[\s\S]*万瓣逆流聚向战斧[\s\S]*金红斧轨贯穿[\s\S]*主莲在勇者处合葬/,
  '四幕分镜说明缺失或顺序被改坏');
assert.match(source, /var __WFX=\{[^\n;]*\byecha:fxYecha\b/,
  'yecha 分发码没有接到 fxYecha');
assert.match(source, /'夜罗刹·红莲战鬼':\{t:'yecha',sz:1\.0,sp:1\.0,fxi:1\.0,dealDelay:4900\}/,
  '夜罗刹必须保留 4900ms 调速安全兜底');
assert.match(source, /\{n:'夜罗刹·红莲战鬼',lv:'岛⑤',mv:'红莲圣域·万瓣天葬',pal:'红莲圣域'/,
  '管理面板动作名或配色名没有同步');

assert.equal((land5.match(new RegExp('<script src="hansen_boss_lock\\.js\\?v='+__APPV__+'"></'+'script>',"g")) || []).length, 1,
  '岛⑤必须且只能加载一次 v951 Boss 锁运行时');
assert.match(land5, /s\.src='hansen_boss_attack\.js'\+ver\(\)/,
  'Boss 特效引擎必须继续按需加载并继承当前查询键');
assert.match(worker, new RegExp("'\\./hansen_boss_lock\\.js\\?v="+__APPV__+"'"),
  'Service Worker 没有缓存 v951 Boss 锁运行时');
assert.match(worker, /CACHE_PREFIX \+ 'shell-157'/);
assert.match(worker, /CACHE_PREFIX \+ 'pages-155'/);
assert.match(worker, /CACHE_PREFIX \+ 'assets-155'/);
assert.doesNotMatch(land5, /hansen_boss_(?:lock|attack)\.js\?v=950/,
  '岛⑤仍直接引用旧版 Boss 运行时');

// ── 旧招彻底退役；新招不得产生页面副作用 ─────────────────────
for (const marker of ['drawMoon', 'drawChain', 'drawPillar', 'pillarT', '血月', '熔链', '焚界火柱']) {
  assert(!fnSource.includes(marker), `旧《血月焚界》残留复活：${marker}`);
}
assert.match(fnSource, /CINEMA_SCALE=3520\/2040/,
  '网页试片必须等比映射到正式 2040ms 命中节奏');
assert.match(fnSource, /ct>=1880[\s\S]*ct>=2520[\s\S]*ct>=3520/,
  '万瓣逆流、战斧敕令和主莲合葬关键帧缺失');
assert.match(fnSource, /\(t-3320\)\/980/,
  '主莲合葬必须从试片 3320ms 关键帧开始');
assert.doesNotMatch(fnSource, /\bclipExtra\b/,
  '夜罗刹不得越过 FXCore 默认战区裁剪');
assert.doesNotMatch(fnSource, /\bsetInterval\s*\(/,
  '夜罗刹不得创建无法随战斗清理的独立循环');
assert.doesNotMatch(fnSource, /\b(?:document|window|navigator)\b|createElement\s*\(|new\s+Image\b|\.(?:webp|png|jpe?g)\b|data:image|url\s*\(/i,
  '红莲圣域必须是纯 FXCore/canvas 动作，不得碰 DOM、全局窗口或外部图片');
assert.doesNotMatch(fnSource, /\b(?:screenShake|shakeScreen|vibrate)\b|document\.body\.style\.transform/i,
  '红莲圣域禁止震屏或机身震动');
assert.match(fnSource, /F\.shell\([\s\S]*?hardMs:/,
  '动作必须托管给 FXCore.shell，确保统一裁剪与清理');

const sparkCaps = [...fnSource.matchAll(/st\.P\.sparks\.length\s*<\s*(\d+)/g)].map(match => Number(match[1]));
assert(sparkCaps.length >= 2, '余烬与命中火花都必须检查粒子池上限');
assert(Math.max(...sparkCaps) <= 150, `粒子池上限过大：${sparkCaps.join(', ')}`);
const runtimeSparkCap = Math.max(...sparkCaps);
const petalCap = fnSource.match(/Math\.min\((\d+),Math\.round\([^)]*fxi\)\)/);
assert(petalCap, '红莲花瓣数量缺少硬上限');
assert(Number(petalCap[1]) <= 42, `红莲花瓣上限过大：${petalCap[1]}`);
assert.match(fnSource, /Math\.max\(0\.45,Math\.min\(1\.35,st\.fxi\)\)/,
  '特效强度必须先钳制，防止后台异常值拖垮低端手机');

// ── 纯 Node VM 分镜、长帧与单次命中模拟 ───────────────────────
const fxEvents = [];
const canvasEvents = [];
let shellOptions = null;
let fallbackDeals = 0;
let currentTime = 0;

function finiteEvent(kind, args) {
  for (const value of args) {
    if (typeof value !== 'number') continue;
    assert(Number.isFinite(value), `${kind} 产生非有限数值`);
    assert(Math.abs(value) < 4096, `${kind} 坐标/尺寸越界：${value}`);
  }
}

function gradient(kind, args) {
  finiteEvent(kind, args);
  canvasEvents.push({ kind, args, t: currentTime });
  return { addColorStop(...stopArgs) { finiteEvent('addColorStop', stopArgs); canvasEvents.push({ kind: 'addColorStop', args: stopArgs, t: currentTime }); } };
}

const ctx = new Proxy({}, {
  get(target, property) {
    if (property in target) return target[property];
    if (property === 'createRadialGradient' || property === 'createLinearGradient') return (...args) => gradient(property, args);
    return (...args) => { finiteEvent(String(property), args); canvasEvents.push({ kind: String(property), args, t: currentTime }); };
  },
  set(target, property, value) { target[property] = value; if (typeof value === 'number') finiteEvent(`set:${String(property)}`, [value]); return true; }
});

function recordFx(kind, args) {
  finiteEvent(kind, args.slice(1));
  fxEvents.push({ kind, args, t: currentTime });
}

const deterministicMath = Object.create(Math);
deterministicMath.random = () => 0;
const FXCore = {
  g: value => `rgba(${value})`,
  rnd: (a, b) => (a + b) / 2,
  shell(...args) { shellOptions = args.at(-1); },
  jet(...args) { recordFx('jet', args); if (args[0]?.sparks) args[0].sparks.push({ kind: 'jet' }); },
  ring(...args) { recordFx('ring', args); },
  burst(...args) { recordFx('burst', args); },
  flash(...args) { recordFx('flash', args); },
  shards(...args) { recordFx('shards', args); }
};

const sandbox = { FXCore, Math: deterministicMath };
vm.createContext(sandbox);
vm.runInContext(`${fnSource}\n;globalThis.__fxYecha = fxYecha;`, sandbox, { filename: 'hansen_boss_attack.js#fxYecha' });
assert.equal(typeof sandbox.__fxYecha, 'function');
sandbox.__fxYecha({}, 196, 42, 306, 300, 430, { sz: 1, sp: 1, fxi: 1 }, () => { fallbackDeals++; });
assert(shellOptions && typeof shellOptions.tick === 'function', 'FXCore.shell 没有收到分镜回调');
assert.equal(shellOptions.hardMs, 5900, '动作硬清理时限必须保持 5900ms');
assert.equal(shellOptions.endMs, 4900, '常规清理时限必须保持 4900ms');
assert.equal(fallbackDeals, 0, '动作初始化异常，错误地走了降级伤害');

let fireCount = 0;
const fireTimes = [];
const state = {
  t: 0, dt: 16, sz: 1, fxi: 1,
  vw: 390, vh: 844, bx: 195, by: 180, hx: 196, hy: 348, barBot: 430,
  br: { width: 190, height: 220, top: 58 },
  fired: Object.create(null), P: { sparks: [] }, ctx,
  fire() { fireCount++; fireTimes.push(currentTime); }
};

function phase(t) {
  currentTime = t;
  state.t = t;
  const start = canvasEvents.length;
  shellOptions.tick(state);
  shellOptions.solid(state);
  shellOptions.glow(state);
  return canvasEvents.slice(start);
}
const count = (events, kind) => events.filter(event => event.kind === kind).length;

phase(0);
assert.equal(fireCount, 0);
const bloom = phase(420);
assert(count(bloom, 'bezierCurveTo') >= 36 && count(bloom, 'ellipse') >= 3,
  '三重景深红莲没有按第 4 套试片绽放');

const reverse = phase(1400);
assert(count(reverse, 'bezierCurveTo') >= 50 && count(reverse, 'lineTo') >= 4,
  '万瓣逆流没有形成可见花瓣河与拖尾');

phase(1458);
assert(!fxEvents.some(event => event.t === 1458 && event.kind === 'flash'),
  '战斧敕令在试片关键帧前提前爆光');
phase(1461);
assert(fxEvents.some(event => event.t === 1461 && event.kind === 'flash'),
  '战斧敕令缺少斧心聚能闪光');

const closing = phase(1930);
assert(count(closing, 'ellipse') >= 4 && count(closing, 'bezierCurveTo') >= 46,
  '主莲在命中前没有包围勇者并开始合拢');

phase(2039);
assert.equal(fireCount, 0, '伤害反馈在 2040ms 视觉命中前提前结算');
phase(2040);
assert.equal(fireCount, 1, '2040ms 必须且只能结算一次攻击反馈');
assert.deepEqual(fireTimes, [2040]);
assert(fxEvents.some(event => event.t === 2040 && event.kind === 'flash'),
  '2040ms 花心闭合缺少局部核心闪光');
assert(fxEvents.filter(event => event.t === 2040 && event.kind === 'ring').length >= 4,
  '2040ms 花心闭合缺少四层金红冲击环');
phase(2041);
assert.equal(fireCount, 1, '相邻帧重复结算攻击反馈');
assert.equal(shellOptions.busy(state), true, '命中后的花瓣/余辉没有延续，shell 会过早清场');

state.P.sparks = Array.from({ length: runtimeSparkCap - 1 }, () => ({ kind: 'seed' }));
for (const t of [2050, 2066, 2082, 2098]) {
  currentTime = t; state.t = t; shellOptions.tick(state);
  assert(state.P.sparks.length <= runtimeSparkCap, `${t}ms 粒子池突破 ${runtimeSparkCap} 上限`);
}
assert.equal(state.P.sparks.length, runtimeSparkCap, '粒子上限探针没有真实命中边界');
assert.equal(fallbackDeals, 0, '分镜模拟期间发生异常并错误调用降级伤害');

console.log('PASS v951 夜罗刹《红莲圣域·万瓣天葬》：身份/四幕/2040ms单次命中/4900ms兜底/纯Canvas/粒子上限全部通过');
