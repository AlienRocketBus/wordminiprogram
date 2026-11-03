/* hansen_fx — 主题 2.0 庆祝特效引擎（只在事件发生时播一次，播完什么都不剩）
 * ------------------------------------------------------------------
 * 老师定下的红线，全部由代码本身保证（不是靠自觉）：
 *   · 不闪屏：不对大面积元素做透明度动画；没有全屏白光、没有 brightness 滤镜
 *   · 不震屏：没有左右来回的位移
 *   · 不旋转：关键帧里出现 rotate / skew / matrix 一律拒绝（彩纸用 scaleY 模拟翻面）
 *   · 不一闪一闪：每个动画只播 1 次，不许 infinite / 多次循环
 *   · 切页不淡入：盖住大半屏的元素（= 一个“页面”）不做进入动画，直接显示
 *   · 升级不挡做题：做题过程中，升级 / 宠物进化 / 成就只记下来，到结算页才一起播
 * 性能：只动 transform 和 opacity（合成器就能画）；同一时刻最多 28 个粒子；
 *       播完立刻删节点，图层空了连图层一起删 → document.getAnimations() 回到 0；
 *       没有 setInterval、没有常驻 rAF（数字滚动只在滚动那 0.7 秒里用 rAF）。
 * 系统“减少动态效果”打开时：不播任何动画，直接显示最终结果（金币数直接变成最终值）。
 *
 * 用法（接入步骤见 攻坚笔记/theme2/INTEGRATION.md）：
 *   HansenFX.roundStart() / HansenFX.roundEnd()     —— 一轮做题开始 / 结束（之间叫“做题中”）
 *   HansenFX.answerRight(选项元素, {xp: 经验条元素})   —— 答对的小庆祝（做题中允许，不挡点击）
 *   HansenFX.celebrate('levelUp' | 'evolve' | 'achievement' | 'result' | 'chest' | 'boss', 数据, 播放函数)
 *       → 做题中：升级/进化/成就先攒着；结算/宝箱/Boss 在做题中直接拒绝
 *       → 不在做题中：进队列，一次只播一个，优先级 宝箱/Boss > 结算 > 升级/进化 > 成就
 *   HansenFX.flushDeferred()  —— 结算页调用：把攒着的一次性按优先级排好（多个成就合并成一条）交回给结算页
 *   HansenFX.stopAll()        —— 切页时调用：立刻停掉、删干净
 * 文件里不写版本号字面量（批量升版会误改）。
 * ------------------------------------------------------------------ */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.HansenFX = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (W) {
  'use strict';
  var MAX_PARTICLES = 28;
  var PRI = { chest: 3, boss: 3, result: 2, levelUp: 1, evolve: 1, achievement: 0 };
  var IN_ROUND_DEFER = { levelUp: 1, evolve: 1, achievement: 1 };   /* 做题中只记下来 */
  var IN_ROUND_REFUSE = { chest: 1, boss: 1, result: 1 };          /* 做题中不该出现 */
  /* 给孩子看的字（接入时直接用） */
  var COPY = { levelUp: '升级啦！', evolve: '宠物长大啦！', achievement: '拿到新成就啦！', achievements: '拿到 {n} 个新成就！',
               streak5: '连对 5 个，真棒！', streak10: '连对 10 个，太厉害了！', again: '这个词等会儿再考你一次' };

  var doc = W && W.document;
  var mq = null; try { mq = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)'); } catch (e) {}
  function reduced() { return !!(mq && mq.matches); }

  /* ---------- 红线检查：每个动画都先过这里 ---------- */
  var BAD_TRANSFORM = /rotate|skew|matrix|perspective/i;
  var ALLOWED = { transform: 1, opacity: 1, offset: 1, easing: 1, composite: 1 };
  var refused = [];   /* 被拒绝的动画（测试读它；正式环境只是不播） */
  function safeFrames(frames) {
    if (!frames || !frames.length) return false;
    for (var i = 0; i < frames.length; i++) {
      for (var k in frames[i]) {
        if (!ALLOWED[k]) return '不许动 ' + k;
        if (k === 'transform' && BAD_TRANSFORM.test(frames[i][k])) return '不许旋转/倾斜';
      }
    }
    return true;
  }
  function bigElement(el) {
    try { var r = el.getBoundingClientRect(); return r.width * r.height > 0.6 * W.innerWidth * W.innerHeight; } catch (e) { return false; }
  }
  /* 粒子是引擎自己建的小方块，不用量尺寸（量尺寸会强制排版，粒子多了就费电） */
  function isParticle(el) {
    function is(n) { return !!(n && n.classList && n.classList.contains('t2-fx-p')); }
    return is(el) || is(el.parentNode);
  }
  var running = [];
  function anim(el, frames, opts) {
    if (!el || !el.animate || reduced()) return null;
    var ok = safeFrames(frames);
    if (ok !== true) { refused.push(ok); return null; }
    opts = opts || {};
    if (opts.iterations != null && opts.iterations !== 1) { refused.push('只许播 1 次'); return null; }
    var fades = false; for (var i = 0; i < frames.length; i++) if (frames[i].opacity != null && frames[i].opacity < 0.95) fades = true;
    if (fades && !isParticle(el) && bigElement(el)) { refused.push('大面积元素不做淡入淡出（防闪屏 / 切页淡入）'); return null; }
    var o = { duration: Math.min(opts.duration || 320, 2200), delay: Math.min(opts.delay || 0, 1500), easing: opts.easing || 'cubic-bezier(.2,.8,.2,1)', iterations: 1 };
    if (opts.fill) o.fill = opts.fill;
    var a; try { a = el.animate(frames, o); } catch (e) { return null; }
    running.push(a);
    function off() { var i = running.indexOf(a); if (i >= 0) running.splice(i, 1); }
    a.addEventListener('finish', off); a.addEventListener('cancel', off);
    return a;
  }

  /* ---------- 粒子图层：要用才建，空了就删 ---------- */
  var layer = null, live = 0, busy = 0, waiters = [];
  function getLayer() {
    if (!layer) {
      layer = doc.createElement('div'); layer.className = 't2-fx-layer'; layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:500;overflow:hidden';
      doc.body.appendChild(layer);
    }
    return layer;
  }
  function settle() {
    if (live <= 0 && busy <= 0) {
      live = 0; busy = 0;
      if (layer && !layer.childNodes.length) { if (layer.parentNode) layer.parentNode.removeChild(layer); layer = null; }
      var w = waiters; waiters = []; for (var i = 0; i < w.length; i++) try { w[i](); } catch (e) {}
    }
  }
  function particle(cls, x, y) {
    if (live >= MAX_PARTICLES) return null;   /* 同一时刻最多 28 个 */
    var d = doc.createElement('div'); d.className = 't2-fx-p ' + (cls || '');
    d.style.cssText = 'position:absolute;left:0;top:0;width:10px;height:10px;will-change:transform,opacity;transform:translate(' + x + 'px,' + y + 'px)';
    getLayer().appendChild(d); live++; return d;
  }
  function kill(node) { if (node && node.parentNode) { node.parentNode.removeChild(node); live--; } settle(); }
  function hold() { busy++; }
  function release() { busy--; settle(); }
  function cssv(name, dflt) { try { return getComputedStyle(doc.documentElement).getPropertyValue(name).trim() || dflt; } catch (e) { return dflt; } }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function after(a, fn) { if (!a) { fn(); return; } a.addEventListener('finish', fn); a.addEventListener('cancel', fn); }

  /* ---------- 基本动作 ---------- */
  /* 弹一下（选项、数字、角标） */
  function pop(el, s, dur) { return anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(' + Math.min(s || 1.08, 1.2) + ')' }, { transform: 'scale(1)' }], { duration: dur || 320, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }
  /* 升起出现（卡片进入）：最终状态就是元素本来的样子，动画失败也不影响显示 */
  function rise(el, dy, delay, dur) {
    return anim(el, [{ transform: 'translateY(' + (dy == null ? 16 : dy) + 'px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: dur || 320, delay: delay || 0, fill: 'backwards' });
  }
  /* 从一点向外撒星星和小圆点 */
  function burst(x, y, o) {
    o = o || {}; if (reduced()) return 0;
    var n = Math.min(o.n || 10, MAX_PARTICLES), spread = o.spread || 74, dur = o.dur || 820, made = 0;
    var cols = [cssv('--t2-star', '#FFD54A'), cssv('--t2-good', '#34D399'), cssv('--t2-gem', '#67E8F9'), cssv('--t2-accent-1', '#FFD54A')];
    for (var i = 0; i < n; i++) {
      var star = i % 2 === 0, p = particle(star ? 't2-fx-star' : 't2-fx-dot', x - 6, y - 6); if (!p) break; made++;
      if (star) { p.style.width = p.style.height = '20px'; p.style.background = cols[0]; p.style.clipPath = 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)'; }
      else { var s = 6 + ((i * 37) % 6); p.style.width = p.style.height = s + 'px'; p.style.borderRadius = '50%'; p.style.background = cols[i % cols.length]; }
      var ang = (Math.PI * 2 * i) / n + ((i * 13) % 7) / 18, r = spread * (0.75 + ((i * 29) % 10) / 20), dx = Math.cos(ang) * r, dy = Math.sin(ang) * r, bx = x - 6, by = y - 6;
      var a = anim(p, [
        { transform: 'translate(' + bx + 'px,' + by + 'px) scale(.4)', opacity: 1, easing: 'cubic-bezier(.2,.8,.2,1)' },
        { transform: 'translate(' + (bx + dx) + 'px,' + (by + dy) + 'px) scale(1)', opacity: 1, offset: 0.42, easing: 'linear' },
        { transform: 'translate(' + (bx + dx * 1.06) + 'px,' + (by + dy * 1.06 + 6) + 'px) scale(.95)', opacity: 1, offset: 0.7, easing: 'cubic-bezier(.4,0,1,1)' },
        { transform: 'translate(' + (bx + dx * 1.12) + 'px,' + (by + dy * 1.12 + 18) + 'px) scale(.55)', opacity: 0 }], { duration: dur, easing: 'linear' });
      after(a, (function (q) { return function () { kill(q); }; })(p));
    }
    return made;
  }
  /* 一圈细光环（头像、宝箱后面）：细线圈，不是闪屏 */
  function ring(x, y, size) {
    if (reduced()) return null; size = Math.min(size || 120, 220);
    var p = particle('', x - size / 2, y - size / 2); if (!p) return null;
    p.style.width = p.style.height = size + 'px'; p.style.borderRadius = '50%'; p.style.border = '4px solid ' + cssv('--t2-star', '#FFD54A');
    var bx = x - size / 2, by = y - size / 2;
    var a = anim(p, [{ transform: 'translate(' + bx + 'px,' + by + 'px) scale(.3)', opacity: 0.9 }, { transform: 'translate(' + bx + 'px,' + by + 'px) scale(1.5)', opacity: 0 }], { duration: 700 });
    after(a, function () { kill(p); }); return a;
  }
  /* 金币 / 星星沿弧线飞到顶栏；每到一个调 onArrive（减少动态时立刻全部到达） */
  function fly(fromEl, toEl, o) {
    o = o || {}; var n = Math.min(o.n || 6, 12);
    if (!fromEl || !toEl) return 0;
    if (reduced()) { for (var k = 0; k < n; k++) if (o.onArrive) o.onArrive(k, n); return 0; }
    var A = center(fromEl), B = center(toEl), made = 0;
    for (var i = 0; i < n; i++) (function (i) {
      var outer = particle('', 0, 0); if (!outer) { if (o.onArrive) o.onArrive(i, n); return; } made++;
      outer.style.width = outer.style.height = '0px';
      var inner = doc.createElement('div'); inner.innerHTML = o.html || coinSVG(); inner.style.cssText = 'width:28px;height:28px;margin:-14px 0 0 -14px';
      outer.appendChild(inner);
      var jx = ((i * 41) % 60) - 30, dur = (o.dur || 720) + i * 30, delay = i * (o.stagger || 70);
      var a1 = anim(outer, [{ transform: 'translate(' + (A.x + jx) + 'px,0)' }, { transform: 'translate(' + B.x + 'px,0)' }], { duration: dur, delay: delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
      var lift = Math.min(160, Math.abs(A.y - B.y) * 0.35 + 60);
      var a2 = anim(inner, [
        { transform: 'translateY(' + A.y + 'px) scale(.6)', opacity: 0, easing: 'cubic-bezier(.2,.8,.4,1)' },
        { transform: 'translateY(' + (Math.min(A.y, B.y) - lift) + 'px) scale(1.15)', opacity: 1, offset: 0.38, easing: 'cubic-bezier(.6,0,.9,.4)' },
        { transform: 'translateY(' + B.y + 'px) scale(.55)', opacity: 0.9 }], { duration: dur, delay: delay, fill: 'both' });
      after(a2, function () { if (a1) a1.cancel(); if (o.onArrive) o.onArrive(i, n); pop(toEl, 1.18, 220); kill(outer); });
    })(i);
    return made;
  }
  /* 数字往上数（只在这 0.7 秒里用 rAF，到了就停） */
  function count(el, from, to, dur, fmt) {
    fmt = fmt || function (v) { return String(v); }; if (!el) return;
    if (reduced() || !W.requestAnimationFrame) { el.textContent = fmt(to); return; }
    var t0 = W.performance.now(); dur = Math.min(dur || 700, 1600); hold();
    (function tick(t) {
      if (!el.isConnected) { release(); return; }
      var k = Math.min(1, Math.max(0, (t - t0) / dur));
      el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) W.requestAnimationFrame(tick); else release();
    })(t0);
  }
  /* 纸片彩纸：落下 + 左右飘 + scaleY 模拟翻面（不旋转） */
  function confetti(o) {
    o = o || {}; if (reduced()) return 0;
    var n = Math.min(o.n || 20, MAX_PARTICLES), w = W.innerWidth, h = W.innerHeight, made = 0;
    var cols = ['--t2-f-red-b', '--t2-f-yellow-a', '--t2-f-green-b', '--t2-f-blue-b', '--t2-f-pink-b', '--t2-f-purple-b'].map(function (c) { return cssv(c, '#FFD54A'); });
    for (var i = 0; i < n; i++) {
      var x = ((i * 97) % 100) / 100 * w, sz = 7 + ((i * 13) % 6), hh = sz * (1.3 + ((i * 7) % 6) / 10), sway = (((i * 53) % 70) - 35);
      var p = particle('', x, -20); if (!p) break; made++;
      p.style.width = sz + 'px'; p.style.height = hh + 'px'; p.style.borderRadius = '2px'; p.style.background = cols[i % cols.length];
      var fall = h * (0.55 + ((i * 31) % 30) / 100), dur = (o.dur || 1300) + ((i * 71) % 500);
      var a = anim(p, [{ transform: 'translate(' + x + 'px,-20px) scaleY(1)', opacity: 1 },
        { transform: 'translate(' + (x + sway) + 'px,' + (fall * 0.35) + 'px) scaleY(.25)', opacity: 1, offset: 0.3 },
        { transform: 'translate(' + (x - sway * 0.6) + 'px,' + (fall * 0.7) + 'px) scaleY(1)', opacity: 1, offset: 0.65 },
        { transform: 'translate(' + (x + sway * 0.3) + 'px,' + fall + 'px) scaleY(.3)', opacity: 0 }],
        { duration: dur, delay: (i * 37) % 180, easing: 'cubic-bezier(.25,.6,.5,1)', fill: 'backwards' });
      after(a, (function (q) { return function () { kill(q); }; })(p));
    }
    return made;
  }
  /* 顶栏下面的金色丝带：pointer-events:none，不挡点击，自己收起 */
  function ribbon(text, ms) {
    ms = Math.min(ms || 2200, 3000);
    var host = doc.createElement('div');
    host.style.cssText = 'position:fixed;left:50%;top:calc(66px + env(safe-area-inset-top));z-index:300;pointer-events:none;transform:translateX(-50%)';
    var r = doc.createElement('div'); r.className = 't2-ribbon'; r.textContent = text; host.appendChild(r); doc.body.appendChild(host); hold();
    function done() { if (host.parentNode) host.parentNode.removeChild(host); release(); }
    var a = anim(r, [{ transform: 'translateY(-24px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1, offset: 0.12 }, { transform: 'none', opacity: 1, offset: 0.86 }, { transform: 'translateY(-16px)', opacity: 0 }], { duration: ms });
    if (a) after(a, done); else W.setTimeout(done, ms);
    return r;
  }
  function coinSVG() {
    if (W.HansenIcons && W.HansenIcons.svg) return W.HansenIcons.svg('coin', { size: 28 });
    return '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><circle cx="12" cy="12" r="10.4" fill="var(--t2-coin,#FFC93C)" stroke="var(--t2-coin-rim,#9A6700)" stroke-width="1.8"/></svg>';
  }
  function starSVG() {
    if (W.HansenIcons && W.HansenIcons.svg) return W.HansenIcons.svg('star', { size: 24 });
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="var(--t2-star,#FFD54A)"/></svg>';
  }
  function idle() { return (live || busy) ? new Promise(function (r) { waiters.push(r); }) : Promise.resolve(); }

  /* ---------- 做题中 / 庆祝队列 ---------- */
  var inRound = false, deferred = [], queue = [], qBusy = false, current = null, seq = 0;
  function roundStart() { inRound = true; }
  function roundEnd() { inRound = false; if (queue.length && !qBusy) next(); }
  function next() {
    if (inRound) { qBusy = false; return; }   /* 做题又开始了：队列停住，等下次 */
    var it = queue.shift(); if (!it) { qBusy = false; current = null; return; }
    qBusy = true; current = it;
    var ret = null;
    try { if (typeof it.play === 'function') ret = it.play(it.data, api); } catch (e) {}
    /* 播放函数可以返回 Promise（比如“等孩子点了收下”）；等它和动画都结束再播下一个 */
    var wait = ret && typeof ret.then === 'function' ? ret.then(null, function () {}) : Promise.resolve();
    W.setTimeout(function () { wait.then(idle).then(function () { W.setTimeout(next, 120); }); }, 30);
  }
  function celebrate(kind, data, play) {
    if (!PRI.hasOwnProperty(kind)) return { ok: false, why: '不认识的庆祝：' + kind };
    if (inRound && IN_ROUND_REFUSE[kind]) return { ok: false, why: '做题中不放 ' + kind };
    var it = { kind: kind, pri: PRI[kind], data: data, play: play, id: ++seq };
    if (inRound && IN_ROUND_DEFER[kind]) { deferred.push(it); return { ok: true, deferred: true, id: it.id }; }
    queue.push(it);
    queue.sort(function (a, b) { return b.pri - a.pri || a.id - b.id; });
    if (!qBusy) next();
    return { ok: true, queued: true, id: it.id };
  }
  /* 结算页：把攒着的按优先级交回去；多个成就合并成一条 */
  function flushDeferred() {
    var list = deferred.slice(); deferred = [];
    var ach = list.filter(function (x) { return x.kind === 'achievement'; }), rest = list.filter(function (x) { return x.kind !== 'achievement'; });
    if (ach.length) rest.push({ kind: 'achievement', pri: PRI.achievement, id: ach[0].id, data: ach.map(function (x) { return x.data; }), play: ach[0].play,
      text: ach.length > 1 ? COPY.achievements.replace('{n}', ach.length) : COPY.achievement });
    rest.sort(function (a, b) { return b.pri - a.pri || a.id - b.id; });
    return rest.map(function (x) { return { kind: x.kind, data: x.data, text: x.text || COPY[x.kind] || '', play: x.play }; });
  }
  function stopAll() {
    queue = []; qBusy = false; current = null;
    var r = running.slice(); for (var i = 0; i < r.length; i++) try { r[i].cancel(); } catch (e) {}
    running = [];
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer); layer = null; live = 0;
    settle();
  }

  /* ---------- 现成配方（与老师看过的样稿一致，粒子预算 ≤ 28） ---------- */
  /* 答对：选项弹一下 + 12 颗星点 + 3 颗星飞向经验条 */
  function answerRight(optEl, o) {
    o = o || {}; if (!optEl) return;
    pop(optEl, 1.07, 340);
    var c = center(optEl); burst(c.x, c.y, { n: 12 });
    if (o.xp) fly(optEl, o.xp, { n: 3, html: starSVG(), dur: 640, onArrive: o.onArrive });
    if (o.streak) pop(o.streak, 1.15, 300);
  }
  /* 答错：平静，只轻轻弹一下（没有粒子、不闪、不抖） */
  function answerWrong(optEl) { if (optEl) pop(optEl, 1.04, 300); }
  /* 一轮结算：星星依次弹出 + 亮星小爆点 + 彩纸 + 数字往上数 */
  function roundResult(o) {
    o = o || {}; var stars = o.stars || [], lit = o.lit == null ? stars.length : o.lit;
    for (var i = 0; i < stars.length; i++) {
      rise(stars[i], 14, 120 + i * 160, 380);
      if (i < lit && !reduced()) (function (el, d) { hold(); W.setTimeout(function () { var c = center(el); burst(c.x, c.y, { n: 4, spread: 54, dur: 520 }); release(); }, d); })(stars[i], 420 + i * 160);
    }
    if (o.scoreEl) count(o.scoreEl, o.from || 0, o.to || 0, 700);
    (o.cards || []).forEach(function (el, k) { rise(el, 18, 80 + k * 100); });
    if (!reduced()) { hold(); W.setTimeout(function () { confetti({ n: 16, dur: 1200 }); release(); }, 260); }
  }
  /* 开宝箱：宝箱弹 + 光环 + 18 个粒子 + 6 枚金币飞进顶栏 + 金币数往上数 + 奖励卡升起 */
  function chestOpen(o) {
    o = o || {}; var ch = o.chest; if (!ch) return;
    pop(ch, 1.06, 380);
    var r = ch.getBoundingClientRect();
    ring(r.left + r.width / 2, r.top + r.height * 0.45, 200);
    burst(r.left + r.width / 2, r.top + r.height * 0.35, { n: 18, spread: 120, dur: 760 });
    if (o.target) {
      hold();
      W.setTimeout(function () {
        fly(ch, o.target, { n: 6, dur: 700, stagger: 80 });
        if (o.countEl) count(o.countEl, o.from || 0, o.to || 0, 1100, o.fmt);
        release();
      }, reduced() ? 0 : 260);
    } else if (o.countEl) count(o.countEl, o.from || 0, o.to || 0, 1100, o.fmt);
    if (o.reward) rise(o.reward, 30, 160, 420);
  }

  var api = {
    MAX_PARTICLES: MAX_PARTICLES, PRI: PRI, COPY: COPY,
    reduced: reduced, pop: pop, rise: rise, burst: burst, ring: ring, fly: fly, count: count, confetti: confetti, ribbon: ribbon, idle: idle,
    roundStart: roundStart, roundEnd: roundEnd, inRound: function () { return inRound; },
    celebrate: celebrate, flushDeferred: flushDeferred, stopAll: stopAll,
    answerRight: answerRight, answerWrong: answerWrong, roundResult: roundResult, chestOpen: chestOpen,
    stats: function () { return { live: live, busy: busy, running: running.length, queue: queue.length, deferred: deferred.length, current: current && current.kind, layer: !!layer, refused: refused.slice() }; },
    _safeFrames: safeFrames
  };
  return api;
});
