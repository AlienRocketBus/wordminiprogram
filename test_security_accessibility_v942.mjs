#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const CACHE_VERSION = read('VERSION').trim();
function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing function ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, line = false, block = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (line) { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && n === '/') { line = true; i++; continue; }
    if (c === '/' && n === '*') { block = true; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  assert.fail(`unclosed function ${name}`);
}

const dynamicCodeFiles = [
  'hansen_game_antifreeze.js',
  'hansen_addiction.js',
  'hansen_boss_lock.js'
];
for (const file of dynamicCodeFiles) {
  assert.doesNotMatch(read(file), /new\s+Function\s*\(/, `${file} 不能动态构造函数`);
  assert.doesNotMatch(read(file), /\beval\s*\(/, `${file} 不能执行 eval`);
}

for (const file of ['index.html', 'land_map.html', 'spelling_bee.html']) {
  const html = read(file);
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i)?.[1] || '';
  assert.ok(viewport, `${file} 必须有 viewport`);
  assert.doesNotMatch(viewport, /user-scalable\s*=\s*no/i, `${file} 必须允许缩放`);
  assert.doesNotMatch(viewport, /maximum-scale\s*=\s*1/i, `${file} 不得把缩放锁死`);
}

const frame = read('_frame.html');
assert.match(frame, /ALLOWED_TARGETS\s*=\s*Object\.freeze/, '_frame 必须使用明确目标白名单');
assert.match(frame, /target\.origin\s*!==\s*here\.origin/, '_frame 必须校验同源');
assert.match(frame, /targetDir\s*!==\s*hereDir/, '_frame 必须限制当前目录');
assert.match(frame, /document\.createElement\('iframe'\)/, '_frame 不得把 u 拼进 iframe HTML');

const copy = read('copy_protect.js');
assert.doesNotMatch(copy, /preventDefault\s*\(/, '版权提示不能拦截浏览器原生操作');
assert.doesNotMatch(copy, /addEventListener\s*\(\s*['"](?:copy|contextmenu|selectstart|keydown)/, '不能监听并封锁复制/右键/选择/快捷键');
assert.match(copy, /blocksNativeBrowserFeatures:\s*false/, '诊断接口必须声明不封锁原生能力');

const accessibility = read('hansen_accessibility.js');
assert.match(accessibility, /function isDialogRoot\(node\)/, '公共可达性层必须先识别真正的对话框根节点');
assert.match(accessibility, /classList\.contains\('modal-bg'\)/, '岛页弹窗的 show 状态位于 modal-bg，必须检查外层');
assert.match(accessibility, /querySelectorAll\('\.modal-bg,dialog'\)/, '弹窗扫描必须绑定真实开关所在的根节点');
assert.match(accessibility, /if\(record\.type === 'attributes' && isDialogRoot\(record\.target\)\)/,
  '普通元素 class 变化不得被误标成 dialog');
assert.doesNotMatch(accessibility, /querySelectorAll\('\.modal,dialog'\)/,
  '不能只扫描没有 show 状态的内层 modal');

const avatar = read('hansen_avatar.js');
assert.match(avatar, /function normalizeState\(raw\)/, '头像存档必须先经过纯净 schema 重建');
assert.match(avatar, /\^#\[0-9a-f\]\{6\}\$/i, '头像颜色只允许六位十六进制色值');
const template = read('template.html');
assert.match(template, /_ac<1\|\|_ac>66/, '头像首帧缓存必须限制在 1–66 号');
assert.match(template, /_avc=\/\^#\[0-9a-f\]\{6\}\$\/i\.test/, '头像首帧颜色必须过白名单');
assert.match(template, /\^pets\\\/pet_\\d\{2\}\\\.webp/, '宠物首帧图片必须只接受内置路径');
assert.doesNotMatch(template, /_pe\.innerHTML='<img src="'\+_ph/,
  '宠物首帧路径不得拼入 innerHTML');

/* 弹窗文案和宠物默认名可来自存档；必须当纯文本/属性处理。 */
for (const name of ['showAlertMsg', 'showConfirmMsg', 'showPromptMsg']) {
  const source = functionSource(template, name);
  assert.doesNotMatch(source, /\.innerHTML\s*=/, `${name} 不得拼接 HTML`);
  assert.match(source, /\.textContent\s*=/, `${name} 必须使用纯文本`);
}
class SafeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.className = ''; this.listeners = {}; this.classList = { add() {} }; this.isConnected = true; }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  focus() {} select() {}
}
const createdTags = [], alertInner = new SafeNode('root'), alertModal = new SafeNode('modal');
const dialogContext = {
  window: null,
  Date,
  setTimeout(fn) { fn(); return 1; },
  closeAlert() {},
  document: {
    createElement(tag) { createdTags.push(tag); return new SafeNode(tag); },
    getElementById(id) { return id === 'alertInner' ? alertInner : id === 'alertModal' ? alertModal : null; }
  }
};
dialogContext.window = dialogContext;
vm.createContext(dialogContext);
for (const name of ['showAlertMsg', 'showConfirmMsg', 'showPromptMsg'])
  vm.runInContext(functionSource(template, name), dialogContext);
const injected = '<img src=x onerror="globalThis.__dialogPwned=1">\n<script>bad()</script>';
dialogContext.showAlertMsg(injected);
assert.equal(alertInner.children[0].textContent, injected, '警告弹窗必须原样显示恶意字符串');
dialogContext.showConfirmMsg(injected);
assert.equal(alertInner.children[0].textContent, injected, '确认弹窗必须原样显示恶意字符串');
dialogContext.showPromptMsg(injected, injected);
assert.equal(alertInner.children[0].textContent, injected, '输入弹窗标题必须是纯文本');
assert.equal(alertInner.children[1].value, injected, '默认值必须通过 input.value 赋值');
assert.equal(createdTags.includes('img') || createdTags.includes('script'), false, '恶意存档不得生成标签');
assert.equal(dialogContext.__dialogPwned, undefined, '弹窗字符串不得执行');

const index = read('index.html');
assert.match(index, /rel="manifest"\s+href="manifest\.webmanifest"/, '首页必须声明 PWA manifest');
assert.match(index, /id="hansenPrivacy"/, '首页必须提供隐私说明');
assert.match(index, /serviceWorker\.register\('\.\/sw_v944\.js'/, '首页必须注册 v944 有限离线层');
assert.match(index.match(/<script\b[^>]*>/i)?.[0] || '',
  new RegExp(`hansen_sw_upgrade_gate_v944\\.js\\?v=${CACHE_VERSION}`),
  `v${CACHE_VERSION} Service Worker 升级门必须是首页第一支脚本`);
assert.doesNotMatch(index, /serviceWorker\.register\('\.\/sw\.js'/,
  '首页不得把已升级的 scope 切回旧 Worker pathname');
assert.match(index, /'_blank','noopener,noreferrer'/, '外部反馈页必须切断 opener');
assert.match(index, /function openIsland\(file, fromHistory\)/, '历史恢复必须有只读模式');
assert.match(index, /history\.state\s*&&\s*history\.state\.hsnIsland[\s\S]{0,180}history\.replaceState/, '岛内换岛必须替换同一条状态');
assert.match(index, /else\s*\{\s*history\.pushState/, '首次开岛才允许 pushState');

const land = read('land_map.html');
assert.match(land, /document\.createElement\('button'\)/, '大陆地图热点必须是键盘可达按钮');
assert.match(land, /aria-modal="true"/, '大陆详情必须声明模态对话框');
const goIslandBlock = land.match(/function goIsland\(n\)\{[\s\S]*?\n\}/)?.[0] || '';
assert.match(goIslandBlock, /var file='island_land'\+n\+'\.html'/,
  '大陆进岛回退地址必须由固定同源前缀和岛号构造');
assert.match(goIslandBlock, /typeof window\.parent\.openIsland==='function'/,
  '大陆在首页壳内必须调用 parent.openIsland');
assert.match(goIslandBlock, /window\.parent\.openIsland\(file\)/,
  '大陆壳路由必须传入构造后的安全相对地址');
assert.match(goIslandBlock, /window\.location\.assign\(file\)/,
  '大陆独立打开时必须用同源相对 location.assign 回退');
assert.doesNotMatch(goIslandBlock, /location\.href|:\/\//,
  '大陆进岛不得使用未约束 href 或跨源 URL');
assert.match(land, /if\(_cn&&!_cn\.saveData&&_cn\.effectiveType==='4g'/, '大陆仅可在明确 4G 且非省流量时预热');
assert.doesNotMatch(land, /for\s*\(var _pi=1;_pi<=8/, '大陆不得后台预热全部八岛');

const landPreheat = land.match(/try\{\s*var _cn=navigator\.connection[\s\S]*?\}catch\(_e2\)\{\}/)?.[0] || '';
assert.ok(landPreheat, '必须能定位大陆节流预热实现');
function runLandPreheat(connection, completed = []) {
  const calls = [];
  const sandbox = {
    navigator: { connection, onLine: true },
    window: { requestIdleCallback(fn) { fn(); } },
    setTimeout(fn) { fn(); },
    clearedN(i) { return completed.includes(i); },
    fetch(url, options) {
      calls.push({ url, options });
      return Promise.resolve();
    }
  };
  vm.runInNewContext(landPreheat, sandbox);
  return calls;
}
assert.equal(runLandPreheat(undefined).length, 0, '网络能力未知时不得预热');
assert.equal(runLandPreheat({ saveData: false, effectiveType: '3g' }).length, 0,
  '非明确 4G 时不得预热');
assert.equal(runLandPreheat({ saveData: true, effectiveType: '4g' }).length, 0,
  'Save-Data 开启时不得预热');
const nextOnly = runLandPreheat({ saveData: false, effectiveType: '4g' }, [1, 2]);
assert.equal(nextOnly.length, 1, '符合条件时最多只能预热一个岛');
assert.equal(nextOnly[0].url, 'island_land3.html', '只能预热下一座未完成岛');
assert.equal(nextOnly[0].options.credentials, 'same-origin', '预热请求必须限制同源凭据');
assert.equal(runLandPreheat({ saveData: false, effectiveType: '4g' }, [1,2,3,4,5,6,7,8]).length, 0,
  '八岛全通时没有下一未完成岛，必须零预热');

const spelling = read('spelling_bee.html');
assert.match(spelling, /function _safeSbReturn\(/, '拼写蜂返回地址必须校验');
assert.match(spelling, /target\.origin!==here\.origin/, '拼写蜂返回地址必须同源');
assert.match(spelling, /location\.replace\(_sbFrom\)/, '无可信前序页时必须 replace，避免历史污染');

const preload = read('hansen_preload.js');
assert.match(preload, /if\(!c\) return true/, '网络信息未知时必须阻止批量预加载');
assert.match(preload, /t !== '4g'/, '只有明确 4G 才可批量预加载');
assert.doesNotMatch(preload, /function preloadNamedBossArt\(/, '不得扫描全部岛预载具名 Boss 图');
assert.match(preload, /只预热一个最可能进入的岛/, '首页预热必须限制为一个候选岛');

const sw = read('sw_v944.js');
assert.match(sw, /words\|sentences\|bosses\|bosses_bg\|pets\|cards\|avatars\|weapons/, '离线层必须排除大型媒体目录');
assert.match(sw, /putIfReasonable\(PAGE_CACHE, request, result\.fresh, 12\)/, '离线 HTML 必须限制条目数');
assert.match(sw, /event\.waitUntil\(navigation\.then\(/, '离线 HTML 缓存写入必须旁路执行，不能阻塞联网响应');
assert.doesNotMatch(sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] || '', /\.mp3|\/bosses\/|\/pets\//, '预缓存清单不得包含大型媒体');

/* 真正执行防卡死恢复回调：确认显式引用能跨 classic-script 访问顶层 let，
   且不是只做“源码里没有某字符串”的表面检查。 */
const context = {
  console: { warn() {}, log() {}, error() {} },
  setTimeout(fn) { context.__timers.push(fn); return context.__timers.length; },
  clearTimeout(id) { context.__cleared.push(id); },
  __timers: [],
  __cleared: [],
  document: {
    visibilityState: 'visible',
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  },
  addEventListener() {}
};
context.window = context;
vm.createContext(context);
vm.runInContext(`
  let typeActive=false;
  let fishActive=true, fishOnscreen=0, fishSpawnTimer=77;
  let bubbleActive=true;
  let listenActive=true, listenQ={answered:true};
  let clozeActive=true;
  let molesActive=true;
  let reviewState={idx:2,currentQ:{answered:true},pool:[1,2,3,4]};
  var calls={typing:0,fish:0,bubble:0,listen:0,cloze:0,moles:0,review:0};
  function nextTypeQ(){calls.typing++;}
  function spawnFishLoop(){calls.fish++;}
  function nextBubble(){calls.bubble++;}
  function nextListenQ(){calls.listen++;}
  function nextClozeQ(){calls.cloze++;}
  function startMolesWave(){calls.moles++;}
  function reviewNext(){calls.review++;}
`, context);
vm.runInContext(read('hansen_game_antifreeze.js'), context, { filename: 'hansen_game_antifreeze.js' });

const modes = context.HansenAntiFreeze._modes;
for (const name of ['typing', 'fish', 'bubble', 'listen', 'cloze', 'moles', 'review']) {
  modes.find(mode => mode.name === name).recover();
}
assert.equal(vm.runInContext('typeActive', context), true, '打字恢复必须重新打开输入锁');
assert.equal(vm.runInContext('fishSpawnTimer', context), null, '钓鱼恢复必须清理丢失的旧定时器');
assert.equal(vm.runInContext('reviewState.idx', context), 3, '复习恢复必须推进一道题');
assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('Object.assign({}, calls)', context))), {
  typing: 1, fish: 1, bubble: 1, listen: 1, cloze: 1, moles: 1, review: 1
}, '七种小游戏恢复函数都必须真实执行');

/* 对 Boss/成瘾模块的真实 _r/_w 白名单做跨 script 词法读写测试。
   仅在测试内于 IIFE 结束前暴露闭包函数，生产源码不增加调试后门。 */
function instrumentLastIife(source, hook) {
  const replaced = source.replace(/\}\)\(\);\s*$/, `${hook}\n})();`);
  assert.notEqual(replaced, source, '测试必须成功注入最后一个 IIFE');
  return replaced;
}

/* v953 起 hansen_boss_lock.js 末尾还有一个独立的轻量管理员入口桥。
   _r/_w 仍属于前面的 Boss 主 IIFE，测试探针必须定向插入桥接注释之前，
   不能假设目标闭包永远是整份文件最后一个 IIFE。 */
function instrumentIifeBefore(source, boundary, hook) {
  const boundaryAt = source.indexOf(boundary);
  assert.ok(boundaryAt >= 0, `测试必须找到注入边界: ${boundary}`);
  const commentAt = source.lastIndexOf('/*', boundaryAt);
  assert.ok(commentAt >= 0, `注入边界必须位于独立注释中: ${boundary}`);
  const before = source.slice(0, commentAt);
  const after = source.slice(commentAt);
  return instrumentLastIife(before, hook) + '\n' + after;
}

/* 真正执行恶意头像存档：标签/CSS URL/越界编号都必须被丢弃，
   不只是检查源码里是否出现一条正则。 */
const avatarStorage = {
  getItem(key) {
    if (key !== 'hsn_avatar') return null;
    return JSON.stringify({
      cur: 999,
      colors: {
        1: 'red"><img src=x onerror=globalThis.__pwned=1>',
        2: 'url(https://tracker.invalid/x)',
        3: '#12abEF'
      }
    });
  },
  setItem() {}
};
const avatarContext = {
  console: { warn() {}, log() {}, error() {} },
  localStorage: avatarStorage,
  isFinite,
  setTimeout() { return 1; },
  clearTimeout() {},
  document: {
    readyState: 'loading',
    documentElement: { style: { setProperty() {} } },
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; }
  }
};
avatarContext.window = avatarContext;
vm.createContext(avatarContext);
vm.runInContext(instrumentLastIife(
  avatar,
  '\nwindow.__testAvatarState=state; window.__testAvatarColor=colorOf; window.__testAvatarNormalize=normalizeState;'
), avatarContext, { filename: 'hansen_avatar.js' });
assert.equal(avatarContext.__testAvatarState.cur, 1, '越界头像号必须回退 1');
assert.deepEqual(JSON.parse(JSON.stringify(avatarContext.__testAvatarState.colors)), { 3: '#12abEF' },
  '只能保留合法颜色');
assert.match(avatarContext.__testAvatarColor(1), /^#[0-9a-f]{6}$/i,
  '恶意颜色必须回退到内置色');
assert.equal(avatarContext.__pwned, undefined, '恶意存档不得执行');

const bridgeContext = {
  console: { warn() {}, log() {}, error() {} },
  setTimeout() { return 1; },
  clearTimeout() {},
  setInterval() { return 1; },
  clearInterval() {},
  document: { readyState: 'loading', addEventListener() {} },
  localStorage: { getItem() { return null; }, setItem() {} }
};
bridgeContext.window = bridgeContext;
vm.createContext(bridgeContext);
vm.runInContext(`
  let bossCurrent={name:'测试Boss'}, bossActive=true, bossPhase=2;
  let bossHP=80, bossMaxHP=100, bossRageMode=false, _bossCorrectIdx=3;
  let heroHP=45, heroMaxHP=120, bossCombo=7;
  let S={streak:12}, STORAGE_KEY='wordIslandTest';
`, bridgeContext);
vm.runInContext(instrumentIifeBefore(
  read('hansen_boss_lock.js'),
  'v953 · Boss 管理入口可达性桥',
  '\nwindow.__testBossRead=_r; window.__testBossWrite=_w;'
), bridgeContext, { filename: 'hansen_boss_lock.js' });
assert.equal(bridgeContext.__testBossRead('bossHP'), 80, 'Boss 白名单必须读到顶层 let');
assert.equal(bridgeContext.__testBossRead('bossCurrent').name, '测试Boss', 'Boss 对象必须保持可读');
bridgeContext.__testBossWrite('bossHP', 61);
bridgeContext.__testBossWrite('heroHP', 99);
assert.equal(vm.runInContext('bossHP', bridgeContext), 61, 'Boss HP 写回必须命中顶层 let');
assert.equal(vm.runInContext('heroHP', bridgeContext), 99, '勇者 HP 写回必须命中顶层 let');

vm.runInContext(instrumentLastIife(read('hansen_addiction.js'), '\nwindow.__testAddictionRead=_r;'), bridgeContext, { filename: 'hansen_addiction.js' });
assert.equal(bridgeContext.__testAddictionRead('S').streak, 12, '成瘾模块必须读到顶层 S');
assert.equal(bridgeContext.__testAddictionRead('STORAGE_KEY'), 'wordIslandTest', '成瘾模块必须读到顶层存档键');

console.log('✅ v942 安全、可达性、路由、预加载、PWA 与防卡死恢复回归测试通过');
