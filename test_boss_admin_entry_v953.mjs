#!/usr/bin/env node
// v953 Boss 管理员隐藏入口可达性回归。
//
// 这个测试故意不启动 Chromium：它同时检查正式源码合约，并在 Node vm
// 中把轻量桥当成 fresh session 运行，专门防止 v929 的 Boss 引擎懒加载
// 再次把设置页入口一起变成不可达代码。

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const lockSource = read('hansen_boss_lock.js');
const attackSource = read('hansen_boss_attack.js');

function quotedItems(source) {
  return [...source.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1]);
}

function panelBossSegment() {
  const start = attackSource.indexOf('var BOSSES=[');
  assert.notEqual(start, -1, '管理员面板的 BOSSES 数组不得丢失');
  const end = attackSource.indexOf('\n];', start);
  assert.notEqual(end, -1, '管理员面板的 BOSSES 数组必须正常闭合');
  return attackSource.slice(start, end + 3);
}

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(String(key)) ? values.get(String(key)) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(String(key)); },
    clear() { values.clear(); },
  };
}

function makeBridgeHarness(plan = ['resolve']) {
  const listeners = new Map();
  const observers = [];
  const settings = {
    id: 'settingsContent',
    firstChild: null,
    children: [],
    appendChild(node) { this.children.push(node); if (!this.firstChild) this.firstChild = node; return node; },
  };
  const footer = {
    nodeType: 1,
    children: [],
    textContent: '动物大冒险 · 进度自动保存到本设备',
    parentElement: settings,
    replayed: 0,
    click() { this.replayed += 1; },
    closest() { return this; },
  };
  const body = {
    appendChild(node) { return node; },
    classList: { add() {}, remove() {}, contains() { return false; } },
  };
  const document = {
    readyState: 'loading',
    body,
    head: { appendChild(node) { return node; } },
    documentElement: { appendChild(node) { return node; }, style: { setProperty() {} } },
    getElementById(id) { return id === 'settingsContent' ? settings : null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
        appendChild(node) { return node; },
        addEventListener() {},
        remove() {},
        setAttribute() {},
      };
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      const index = list.indexOf(fn);
      if (index >= 0) list.splice(index, 1);
    },
  };

  let loadCalls = 0;
  let gateCalls = 0;
  let entryCalls = 0;
  let deferredResolve = null;
  let deferredReject = null;

  const context = {
    console: { log() {}, warn() {}, error() {} },
    document,
    localStorage: makeStorage(),
    sessionStorage: makeStorage(),
    navigator: { onLine: true },
    location: { href: '', reload() {} },
    Date,
    Math,
    JSON,
    Number,
    Object,
    Array,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    Promise,
    Set,
    Map,
    WeakMap,
    Uint8Array,
    TextEncoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    setImmediate,
    requestAnimationFrame(fn) { return setTimeout(fn, 0); },
    cancelAnimationFrame(id) { clearTimeout(id); },
    alert() {},
    confirm() { return false; },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() {}
      fire() { this.callback([], this); }
    },
  };
  context.window = context;
  context.globalThis = context;
  context.addEventListener = (type, fn) => document.addEventListener(type, fn);
  context.removeEventListener = (type, fn) => document.removeEventListener(type, fn);

  context.__hansenBossFXReady = function () {
    const step = plan[Math.min(loadCalls, plan.length - 1)] || 'resolve';
    loadCalls += 1;
    const publish = () => {
      context.__hsnOpenBossAdminGate = () => { gateCalls += 1; };
      context.__hsnEnsureBossFxSettingsEntry = () => { entryCalls += 1; };
    };
    if (step === 'reject') return Promise.reject(new Error('simulated load failure'));
    if (step === 'defer' || step === 'publish-defer') {
      if (step === 'publish-defer') publish();
      return new Promise((resolve, reject) => {
        deferredResolve = () => { if (step !== 'publish-defer') publish(); resolve(); };
        deferredReject = reject;
      });
    }
    publish();
    return Promise.resolve();
  };

  vm.createContext(context);
  vm.runInContext(lockSource, context, { filename: 'hansen_boss_lock.js' });

  // hansen_boss_lock.js 的历史主引擎和 v953 轻桥都可以等 DOMContentLoaded。
  // 桥在文件底部，所以只启动最后注册的回调，不需要在单元测试中启动整场 Boss 战。
  const ready = listeners.get('DOMContentLoaded') || [];
  assert.ok(ready.length >= 1, '轻量桥必须可在 DOMContentLoaded 安装');
  ready.at(-1)();

  return {
    context,
    settings,
    footer,
    observers,
    listeners,
    get loadCalls() { return loadCalls; },
    get gateCalls() { return gateCalls; },
    get entryCalls() { return entryCalls; },
    resolveDeferred() { assert.ok(deferredResolve, '没有待解决的加载'); deferredResolve(); },
    rejectDeferred() { assert.ok(deferredReject, '没有待拒绝的加载'); deferredReject(new Error('simulated deferred failure')); },
    dispatchFooterClick() {
      const event = {
        target: footer,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() {},
        stopImmediatePropagation() {},
      };
      for (const fn of [...(listeners.get('click') || [])]) fn(event);
      return event;
    },
  };
}

function assertStaticContracts() {
  assert.match(lockSource, /window\.__hansenBossAdminBridgeV953/,
    '中央轻量桥必须有 v953 全局单例标记');
  assert.match(lockSource, /window\.HansenBossAdminBridge\s*=/,
    '轻量桥必须暴露不含凭据的测试接口');
  const apiAt = lockSource.indexOf('window.HansenBossAdminBridge');
  const api = lockSource.slice(apiAt, apiAt + 900);
  for (const method of ['ensureLoaded', 'open', 'refresh']) {
    assert.match(api, new RegExp('\\b' + method + '\\b'),
      `HansenBossAdminBridge 缺 ${method} 方法`);
  }

  assert.match(attackSource, /window\.__hsnOpenBossAdminGate\s*=\s*openHiddenGate/,
    '重型文件必须导出管理员 gate，轻桥不得重放 DOM click');
  assert.match(attackSource, /window\.__hsnEnsureBossFxSettingsEntry\s*=\s*ensureEntry/,
    '重型文件必须导出公开设置入口刷新函数');

  const bridgeAt = lockSource.indexOf('window.__hansenBossAdminBridgeV953');
  const bridge = lockSource.slice(bridgeAt);
  assert.match(bridge, /__hansenBossFXReady/,
    '轻桥必须经正式 Boss FX loader 加载重文件');
  assert.match(bridge, /__hsnOpenBossAdminGate/,
    '轻桥必须直接调导出 gate');
  assert.match(bridge, /waitForExportedGate/,
    '密码门必须在脚本导出后立即可用，不得等待 Boss 特效图全部加载');
  assert.doesNotMatch(bridge, /\.click\s*\(/,
    '轻桥不得重放 click：加载后应直接调导出 gate，防止双开/双计数');

  // 旧密码与抗暴破语义是不可变协议；测试只锁指纹，不保存也不暴露明文。
  assert.match(attackSource,
    /PW_SHA='603496ea13d3aa14a70ad2a79b7d6d138b3dfb0448441ac7cd14e0ef9358ecd6'/,
    '主管理员密码 SHA-256 指纹不得改动');
  assert.match(attackSource, /PW_DJB=346366539/,
    '主管理员密码兼容指纹不得改动');
  assert.match(attackSource, /djb2\(pw\)===PW_DJB&&pw\.length===50/,
    '兼容校验必须仍要求 50 位，不得放宽');
  assert.match(attackSource, /L_N='__hsn_sys_a',\s*L_LK='__hsn_sys_b'/,
    '失败次数/永久锁键不得迁移或清空');
  assert.match(attackSource, /function openHiddenGate\(\)\{\s*if\(isLocked\(\)\) return;/,
    '已永久锁定的入口仍必须 fail closed');
  assert.match(attackSource, /if\(n>=3\)\{\s*lockNow\(\);\s*closeOvl\(\);\s*return;/,
    '主管理员门仍必须连续错 3 次永久锁定');
  assert.match(attackSource, /st\.put\('1','b'\)/,
    '主管理员永久锁必须保留 IndexedDB 镜像');

  const islesMatch = attackSource.match(/var ISLES=\[([^\]]+)\]/);
  assert.ok(islesMatch, '公开 Boss 特效入口的 18 岛清单不得丢失');
  const isles = quotedItems(islesMatch[1]);
  assert.equal(isles.length, 18, '公开入口必须仍以 18 岛×20 Boss=360 关解锁');
  assert.equal(new Set(isles).size, 18, '18 岛清单不得重复');
  assert.match(attackSource, /var total=ISLES\.length\*20/,
    '公开入口必须仍是 360 关进度');
  assert.match(attackSource, /d\.id='hbafxEntry'/,
    '公开「Boss 特效调节」设置行不得被隐藏桥取代');
  assert.match(attackSource, /if\(p\.all\)\{\s*openPanel\(true\)/,
    '通关 360 关后公开入口仍必须进用户模式');

  const bosses = panelBossSegment();
  for (const name of ['夜罗刹·红莲战鬼', '星核帝皇·弗沙欧']) {
    assert.equal((bosses.match(new RegExp(name, 'g')) || []).length, 1,
      `${name} 必须在管理员面板中有且只有一张调参卡`);
  }

  const islandPages = fs.readdirSync(ROOT)
    .filter(name => /^island_[a-z0-9]+\.html$/.test(name))
    .sort();
  const pages = ['template.html', ...islandPages];
  assert.equal(pages.length, 28, '必须覆盖母版 + 27 个可玩页');
  for (const name of pages) {
    const source = read(name);
    assert.match(source, /__hansenBossFXReady/,
      `${name}: 必须保留 Boss 引擎按需加载器`);
    assert.match(source, /hansen_boss_attack\.js/,
      `${name}: 懒加载器必须指向正式攻击引擎`);
    assert.doesNotMatch(source,
      /<script\b[^>]*\bsrc\s*=\s*['"][^'"]*hansen_boss_attack\.js[^'"]*['"][^>]*>/i,
      `${name}: 不得把 1.23MB 攻击引擎改回同步 script，否则 v929 首屏性能回退`);
    assert.match(source, /hansen_boss_lock\.js\?v=\d+/,
      `${name}: 必须同步加载承载轻量桥的中央 lock 模块`);
  }
}

async function assertFreshSettingsWakeup() {
  const h = makeBridgeHarness(['resolve']);
  const bridge = h.context.HansenBossAdminBridge;
  assert.equal(typeof bridge?.ensureLoaded, 'function');
  assert.equal(typeof bridge?.open, 'function');
  assert.equal(typeof bridge?.refresh, 'function');
  assert.equal(h.context.__hansenBossFXLoaded, undefined,
    'fresh session 不得伪造成已执行 hansen_boss_attack');

  await flush();
  assert.equal(h.loadCalls, 0, '设置内容未出现时不得偷跑 1.23MB 引擎');

  h.settings.firstChild = { nodeType: 1 };
  assert.ok(h.observers.length >= 1, '轻桥必须观察动态渲染的 settingsContent');
  h.observers.at(-1).fire();
  await flush();
  await flush();
  assert.equal(h.loadCalls, 1,
    '设置内容首次出现时必须调用 __hansenBossFXReady');
  assert.equal(h.entryCalls, 1,
    '重文件就位后必须立即刷新公开 360 关入口');

  await Promise.resolve(bridge.refresh());
  await flush();
  assert.equal(h.loadCalls, 1, '重复渲染设置页不得重复加载');
}

async function assertFirstFooterClickIsSingle() {
  const h = makeBridgeHarness(['defer']);
  h.settings.firstChild = h.footer;
  assert.ok((h.listeners.get('click') || []).length >= 1,
    '中央轻桥必须在攻击引擎未执行时就监听隐藏 footer');

  const first = h.dispatchFooterClick();
  h.dispatchFooterClick(); // 加载中的连点必须合并，不能打开两个密码门。
  await flush();
  assert.equal(h.loadCalls, 1, '隐藏 footer 连点不得启动两次加载');
  assert.equal(h.gateCalls, 0, '重文件未就位前不得提前调 gate');
  assert.equal(first.defaultPrevented, true, '首次隐藏点击必须由轻桥接管');

  h.resolveDeferred();
  await flush();
  await flush();
  assert.equal(h.gateCalls, 1, '加载后必须精确调用一次导出的管理员 gate');
  assert.equal(h.footer.replayed, 0, '不得用 element.click() 重放，否则新旧两层监听会双开');
}

async function assertLoadFailureCanRetry() {
  const h = makeBridgeHarness(['reject', 'resolve']);
  const bridge = h.context.HansenBossAdminBridge;

  await Promise.resolve(bridge.open()).catch(() => {});
  await flush();
  assert.equal(h.loadCalls, 1, '第一次应真实尝试加载');
  assert.equal(h.gateCalls, 0, '加载失败不得打开空 gate');

  await Promise.resolve(bridge.open()).catch(error => {
    assert.fail('第二次重试本应成功: ' + error);
  });
  await flush();
  assert.equal(h.loadCalls, 2, '加载 Promise 失败后必须清空，下次可重试');
  assert.equal(h.gateCalls, 1, '重试成功后必须打开且只打开一次 gate');
}

async function assertGateDoesNotWaitForFxImages() {
  const h = makeBridgeHarness(['publish-defer']);
  const opened = h.context.HansenBossAdminBridge.open();
  await flush();
  await flush();
  assert.equal(h.loadCalls, 1, '管理入口必须仍经正式 loader 启动脚本');
  assert.equal(h.gateCalls, 1,
    '脚本已经导出 gate 后应立即弹密码门，不得继续等待 6 张特效图');
  assert.equal(await opened, true, '图片仍在后台加载时 open() 也必须完成');
}

assertStaticContracts();
await assertFreshSettingsWakeup();
await assertFirstFooterClickIsSingle();
await assertLoadFailureCanRetry();
await assertGateDoesNotWaitForFxImages();

console.log('✅ v953 Boss 管理员入口：fresh settings 唤醒 + footer 单次 gate + 图片不阻塞 + 失败可重试 + 密码/360关/弗沙欧/28页懒加载合约全通过');
