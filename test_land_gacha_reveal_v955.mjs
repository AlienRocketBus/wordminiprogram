#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const FILE = path.join(ROOT, 'hansen_land_cards.js');
const src = fs.readFileSync(FILE, 'utf8');

function section(start, end) {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `缺少起始标记: ${start}`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `缺少结束标记: ${end}`);
  return src.slice(a, b);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

const data = section('var LAND_CARDS = [', '  ];');
const cards = [...data.matchAll(/\{id:'(L(\d)(\d))',\s*land:(\d),\s*name:'([^']+)',\s*img:'([^']+)',\s*frame:'([^']+)',\s*rarity:'([^']+)'/g)]
  .map((m) => ({ id: m[1], idLand: Number(m[2]), slot: Number(m[3]), land: Number(m[4]), name: m[5], img: m[6], rarity: m[8] }));

assert.equal(cards.length, 40, '星海／单词大陆卡池必须是 8 岛 × 5 张 = 40 张');
assert.equal(new Set(cards.map((c) => c.id)).size, 40, '40 张卡的 id 必须唯一');
for (let land = 1; land <= 8; land += 1) {
  const group = cards.filter((c) => c.land === land);
  assert.equal(group.length, 5, `第 ${land} 岛必须恰好 5 张卡`);
  assert.deepEqual(group.map((c) => c.slot).sort(), [1, 2, 3, 4, 5], `第 ${land} 岛卡位必须完整`);
  assert.ok(group.every((c) => c.idLand === land), `第 ${land} 岛 id 与 land 字段必须一致`);
}
for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
  assert.equal(cards.filter((c) => c.rarity === rarity).length, 8, `${rarity} 必须每岛一张，共 8 张`);
}
for (const card of cards) {
  assert.ok(fs.existsSync(path.join(ROOT, card.img)), `卡图缺失: ${card.id} ${card.img}`);
}
assert.match(src.slice(0, 300), /LAND_CARDS\(40张·8岛\)/, '文件头必须使用正确的 40 张口径');
assert.doesNotMatch(src.slice(0, 300), /LAND_CARDS\(39张/, '不得继续传播旧的 39 张口径');
assert.doesNotMatch(src, /\?v=954/, '星海卡册、预载和详情图不得继续请求 v954 旧资源');

const starSeaPages = [...Array.from({ length: 8 }, (_, i) => `island_land${i + 1}.html`), 'island_season.html'];
for (const name of starSeaPages) {
  const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
  assert.equal(count(html, 'onclick="HansenContextGacha.open()"'), 1, `${name} 必须唯一接入上下文抽卡路由`);
  assert.equal(count(html, 'onclick="HansenGacha.open()"'), 0, `${name} 不得绕过路由直接进入普通 20 张卡池`);
  assert.equal(count(html, 'onclick="HansenLandGachaUI.open()"'), 0, `${name} 不得把卡池选择逻辑散落在生成页面`);
  assert.equal(count(html, 'hansen_land_cards.js?v='+__APPV__), 1, `${name} 必须唯一加载 v955 星海卡池引擎`);
}
const template = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
assert.equal(count(template, 'onclick="HansenContextGacha.open()"'), 1, '印章母版必须唯一接入上下文抽卡路由');
for (const name of fs.readdirSync(ROOT).filter((n) => /^island_[a-z0-9]+\.html$/.test(n))) {
  const html = fs.readFileSync(path.join(ROOT, name), 'utf8');
  assert.equal(count(html, 'onclick="HansenContextGacha.open()"'), 1, `${name} 必须与印章母版使用同一个稳定入口`);
}
const routerStart = src.indexOf('window.HansenContextGacha = {');
assert.ok(routerStart >= 0, '缺少上下文抽卡路由');
const routerEnd = src.indexOf('\n})();', routerStart);
assert.ok(routerEnd > routerStart, '上下文抽卡路由没有正常闭合');
const router = src.slice(routerStart, routerEnd);
assert.match(router, /island_\(\?:land\[1-8\]\|season\)\\\.html\$\/i/, '路由必须精确识别星海8岛与星海篇共9页');
assert.match(router, /isStarSea&&window\.HansenLandGachaUI[\s\S]*?HansenLandGachaUI\.open/, '星海页必须进入40张Boss专属卡池');
assert.match(router, /window\.HansenGacha[\s\S]*?window\.HansenGacha\.open/, '普通页必须回落到原20张正片卡池');

const reveal = section('function reveal(id, result){', '  function restoreReveal(known){');
const sealed = reveal.slice(0, reveal.indexOf('function lgrDoReveal(){'));
const sealedShell = sealed.slice(0, sealed.indexOf('var timers=[]'));
const finalReveal = section('function lgrDoReveal(){', '    function lgrSettle(){');
const settle = section('function lgrSettle(){', '    function lgrAnimationEnd(e)');

assert.match(src, /hansenLandRevealCSSV955/, '星海揭晓必须自行注入专属 CSS');
assert.match(src, /\.lgr-overlay/, '必须使用独立 lgr-* 命名空间');
assert.doesNotMatch(reveal, /gacha-reveal-overlay|gr-info|gr-card-wrap|gr-real|gr-myst/, '星海揭晓不得再半复用普通抽卡 gr-* 结构');

assert.equal(count(sealed, "cardBackHTML('lgr-front')"), 1, '揭晓前必须创建统一正面卡背');
assert.equal(count(sealed, "cardBackHTML('lgr-rear')"), 1, '揭晓前必须创建统一背面卡背');
assert.match(sealed, /aria-label','正在抽取神秘卡牌'/, '揭晓前可访问名称必须保持中性');
assert.match(sealed, /preloader=new Image\(\)/, '真卡图必须先在脱离 DOM 的 Image 中预载');
assert.match(sealed, new RegExp("preloader\\.src=c\\.img\\+'\\?v="+__APPV__+"'"), '预载必须命中 v955 精确资源键');

for (const leak of [
  /c\.name/,
  /c\.desc/,
  /c\.rarity/,
  /ri\.color/,
  /ri\.glow/,
  /lgr-result-card/,
  /lgr-rarity/,
  /lgr-status/,
  /新卡入册/,
  /重复卡/
]) {
  assert.doesNotMatch(sealed, leak, `停稳前不得出现真实结果信息: ${leak}`);
}
assert.doesNotMatch(sealedShell, /tier[0-4]|--lgr-rc|--lgr-glow/, '停稳前实际创建的舞台不得用档位或结果色暗示稀有度');

for (const required of [
  /c\.name/,
  /c\.desc/,
  /c\.rarity/,
  /ri\.color/,
  /ri\.glow/,
  /lgr-result-card/,
  /lgr-rarity/,
  /lgr-status/,
  /slot\.appendChild\(img\)/,
  /mountImage\(preloader\)/,
  /scroll\.innerHTML=''/,
  /aria-labelledby','lgrResultTitle'/
]) {
  assert.match(finalReveal, required, `最终揭晓缺少合同: ${required}`);
}
assert.match(settle, /data-phase','settle'/, '必须先进入完全停稳状态');
assert.match(settle, /later\(lgrDoReveal,180\)/, '正常路径必须停稳后再揭晓');
assert.match(settle, /lgr-no-motion/, '兜底路径必须先强制停止动画');
assert.match(settle, /raf2\(lgrDoReveal\)/, '兜底路径必须等待两个绘制帧后再揭晓');
assert.match(reveal, /animationend',lgrAnimationEnd/, '正常揭晓门必须由真实 animationend 驱动');
assert.match(reveal, /e\.animationName==='lgrCardSpin'/, '必须校验正确的卡牌旋转动画名');
assert.match(src, /@keyframes lgrCardSpin\{[^}]*rotateY\(0deg\)[\s\S]*?100%\{[^}]*rotateY\(1440deg\)/, '卡背必须完成四整圈并正面停稳');
assert.doesNotMatch(section("s.textContent=''", 'document.head.appendChild(s);'), /rotate\((?!0deg)[^)]+\)/, '揭晓层不得使用平面 rotate() 造成整体摇晃');

assert.match(src, /prefers-reduced-motion:reduce/, 'CSS 必须尊重减少动态效果');
assert.match(reveal, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/, 'JS 状态机必须处理减少动态效果，不能等待被 CSS 禁掉的 animationend');
assert.match(reveal, /reduce\?1200:3900/, '减少动态效果也必须保留短暂的先隐藏后揭晓时序');

for (const recovery of [/visibilitychange/, /pagehide/, /pageshow/, /data-paused/, /lgrForceComplete/, /hardDeadline/, /lgrScheduleSafety/]) {
  assert.match(reveal, recovery, `后台恢复合同缺失: ${recovery}`);
}
assert.match(reveal, /if\(revealed\|\|closed\)return/, '揭晓必须幂等');
assert.match(reveal, /if\(settled\|\|revealed\|\|closed\)return/, '停稳必须幂等');
assert.match(reveal, /removeListeners\(\)/, '关闭时必须清理页面生命周期监听器');
assert.match(reveal, /clearAllTimers\(\)/, '关闭时必须清理全部计时器');
assert.match(reveal, /later\(finish,96\)/, '双绘制帧必须有老 WebView 计时兜底');
assert.match(reveal, /setBusy\(true\);lgrScheduleSafety\(\);[\s\S]*?raf2\(/, '安全计时器必须在等待首个绘制帧前启动');
assert.ok(finalReveal.indexOf("scroll.appendChild(resultBox)") < finalReveal.lastIndexOf('revealed=true'), '只有最终结果真正挂入 DOM 后才能提交 revealed');
assert.match(finalReveal, /catch\(buildError\)/, '复杂结果 DOM 构建失败时必须进入可关闭兜底');
assert.match(finalReveal, /卡牌已安全入册/, '兜底也必须明确奖励已经入册');

assert.match(src, /width:58vw;height:81\.2vw;max-width:230px;max-height:322px/, '旧 WebView 必须有不依赖 aspect-ratio 的卡背尺寸');
assert.match(src, /@supports \(width:clamp\(1px,2px,3px\)\) and \(aspect-ratio:5\/7\)/, '现代尺寸增强必须用 @supports 隔离，不能覆盖旧 WebView 兜底');
assert.match(reveal, /shieldBackground\(\)/, '模态揭晓必须屏蔽背景交互与读屏焦点');
assert.match(reveal, /restoreBackground\(\)/, '关闭时必须恢复背景的 aria-hidden 与 inert 状态');
assert.match(reveal, /e\.key==='Tab'/, '揭晓期间必须把键盘焦点留在模态层内');
assert.match(reveal, /catch\(setupError\)/, '初始搭台同步异常必须进入统一回滚');
assert.match(reveal, /restoreShielded\(\);lgrActive=null/, '搭台失败必须恢复背景并释放全局揭晓锁');
assert.match(reveal, /try\{setBusy\(false\);\}/, '搭台失败必须解锁抽卡按钮');

assert.match(src, /if\(uiBusy\|\|lgrActive\)\{toast\('星海命轮正在揭晓，请稍等'\);return;\}/, '抽卡与兑换必须有统一互斥锁');
assert.match(src, /landGachaDrawBtn/, '抽卡按钮必须可被禁用并标记忙碌');
assert.match(src, /pendingReveal:null/, '待揭晓结果必须属于星海卡册主存档，而不是易丢的临时会话');
assert.match(src, /peekPendingReveal: function/, 'UI 必须能同步读取唯一待确认结果');
assert.match(src, /ackPendingReveal: function\(txid\)/, '用户收下后必须按事务号确认同一张卡');
assert.match(src, /o\.pendingReveal=\{version:955,txid:p\.txid,id:res\.id/, '付费奖励与待揭晓凭据必须在同一次主存档写入中提交');
assert.match(src, /o\.owned\[pick\]=true;o\.pendingReveal=\{version:955,txid:'landfrag-'/, '碎片兑换奖励与待揭晓凭据也必须原子提交');
assert.match(src, /status:'reveal-pending'/, '未收下上一张卡时必须拒绝第二次付费并补播原结果');
assert.doesNotMatch(src, /sessionStorage/, '待揭晓结果不得只存在会随标签页消失的 sessionStorage');
assert.match(src, /if\(pending\)\{uiBusy=false;if\(!restoreReveal\(pending\)\)toast/, '重新进入卡册必须同步锁定并补播未收下的同一张卡');
assert.match(src, /if\(!reveal\(queued\.id,queued\)\)\{setBusy\(false\);render\(\);toast/, '补播启动失败时必须解锁按钮，不能留下假死界面');

assert.match(finalReveal, /legendary:20/, '至尊揭晓粒子也必须有明确上限');
assert.match(finalReveal, /reduce\?0:/, '减少动态效果时不得创建粒子');
assert.match(reveal, /1600\)/, '粒子必须自动清理');
assert.doesNotMatch(reveal, /requestAnimationFrame\([^)]*requestAnimationFrame[^)]*requestAnimationFrame/, '不得启动无终点的逐帧循环');

assert.equal(count(src, 'reveal(id,res)'), 1, '付费抽卡必须统一进入星海揭晓引擎');
assert.equal(count(src, "reveal(id,{dup:false,frag:0})"), 1, '碎片兑换必须统一进入星海揭晓引擎');
assert.match(src, /purchase\(\)/, '原有可恢复付费交易入口必须保留');
assert.match(src, /exchangeByFrag\(r\)/, '原有碎片兑换入口必须保留');

console.log('✅ v955 星海命轮抽卡揭晓专项回归通过：40张卡、停稳前零泄露、四圈减速、后台恢复、防连点与减少动态效果均已锁定。');
