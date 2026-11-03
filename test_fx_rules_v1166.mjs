// 主题 2.0 庆祝引擎：红线与队列测试（不联网、约 20 秒）
//  ① 老师的红线：只动 transform/opacity；不旋转、不震、不闪（大面积不淡入淡出）、只播 1 次；违规的动画直接拒绝
//  ② 同一时刻最多 28 个粒子（连放 5 次也不超）
//  ③ 播完：document.getAnimations() = 0，图层删掉，rAF 停，从不用 setInterval
//  ④ 做题中：升级/进化/成就只记下来、不出任何画面、不挡点击；宝箱/结算/Boss 拒绝；结算页一次交回，成就合并
//  ⑤ 队列：一次只播一个，按优先级（宝箱/Boss > 结算 > 升级/进化 > 成就）
//  ⑥ 切页 stopAll：立刻停、删干净
//  ⑦ 系统“减少动态效果”：0 个动画，直接显示最终结果
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, findOne, serve, browser, phone, scorer } from './攻坚笔记/theme2/tools/testkit.mjs';

const t = scorer('主题 2.0 庆祝引擎·红线与队列');
const FX = findOne(/^hansen_fx_v\d{4}\.js$/), ICONS = findOne(/^hansen_theme2_icons_v\d{4}\.js$/);
const code = fs.readFileSync(path.join(ROOT, FX), 'utf8');
const bare = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/'(?:\\.|[^'\\])*'/g, "''");
console.log('① 静态检查');
t.ok(!/=>|\blet\s|\bconst\s|`|\bclass\s/.test(bare), '只用 ES5 写法（旧手机内核）');
t.ok(!/setInterval/.test(bare), '没有 setInterval');
t.ok(!/infinite|Infinity/.test(bare), '没有 infinite（不许一直循环）');
t.ok(!/filter|brightness|box-?shadow|drop-shadow/i.test(bare.replace(/\.filter\(/g, '')), '不动 filter / 亮度 / 阴影（TV-07：老宝箱 brightness(2.7) + 644px 白光）');
t.ok(!/\?v=\d|\b1166\b/.test(code), '文件里没有版本号字面量');

const page = `<!doctype html><html data-t2-base="cosmos" data-t2-mode="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/theme2_tokens.css"><link rel="stylesheet" href="/theme2_base.css"><script src="/${ICONS}"></script><script src="/${FX}"></script></head>
<body class="t2-page" style="margin:0">
<header class="t2-topbar"><span class="t2-chip" id="coins">金币 <b id="coinN" class="t2-num">1,280</b></span><span class="t2-chip" id="xp">经验</span></header>
<div style="padding:16px"><button class="t2-btn t2-btn-ghost" id="opt" style="width:100%">apple</button>
<button class="t2-btn t2-btn-gold" id="opt2" style="width:100%;margin-top:12px">banana</button>
<div id="chest" style="width:120px;height:100px;margin:20px auto;background:#c9772b;border-radius:16px"></div>
<div id="reward" class="t2-card" style="padding:12px">+36 金币</div>
<div style="display:flex;gap:10px;justify-content:center;margin-top:12px"><span class="s">★</span><span class="s">★</span><span class="s">★</span></div><b id="score">0</b></div>
<div id="page" style="position:fixed;inset:0;pointer-events:none"></div>
</body></html>`;
const INSTR = () => {
  const rec = window.__rec = { anims: [], si: 0, raf: 0, maxLive: 0 };
  const A = Element.prototype.animate;
  Element.prototype.animate = function (frames, opts) {
    const r = this.getBoundingClientRect();
    rec.anims.push({ frames: JSON.parse(JSON.stringify(frames)), opts: typeof opts === 'object' ? { iterations: opts.iterations, duration: opts.duration } : { duration: opts },
      particle: !!(this.closest && this.closest('.t2-fx-layer')), area: r.width * r.height, cls: this.className || this.id || this.tagName });
    return A.call(this, frames, opts);
  };
  const si = window.setInterval; window.setInterval = function () { rec.si++; return si.apply(this, arguments); };
  const raf = window.requestAnimationFrame; window.requestAnimationFrame = function () { rec.raf++; return raf.apply(this, arguments); };
  new MutationObserver(() => { const l = document.querySelector('.t2-fx-layer'); if (l) rec.maxLive = Math.max(rec.maxLive, l.querySelectorAll(':scope > .t2-fx-p').length); })
    .observe(document, { childList: true, subtree: true });
};
const srv = await serve({ '/__t2/fx.html': page });
const br = await browser();
try {
  const ctx = await phone(br, srv.base); await ctx.addInitScript(INSTR);
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(srv.base + '/__t2/fx.html', { waitUntil: 'load' });
  const settle = ms => pg.waitForTimeout(ms);

  console.log('② 红线（真动画逐个检查）');
  await pg.evaluate(() => {
    const $ = id => document.getElementById(id);
    HansenFX.answerRight($('opt'), { xp: $('xp'), streak: $('coins') });
    HansenFX.chestOpen({ chest: $('chest'), target: $('coins'), countEl: $('coinN'), from: 1280, to: 1316, reward: $('reward'), fmt: v => v.toLocaleString('en-US') });
    HansenFX.roundResult({ stars: [...document.querySelectorAll('.s')], lit: 2, scoreEl: $('score'), to: 7, cards: [$('reward')] });
    HansenFX.ribbon(HansenFX.COPY.streak5, 1600);
    for (let i = 0; i < 5; i++) HansenFX.burst(100 + i * 40, 300, { n: 28 });
    HansenFX.confetti({ n: 40 });
  });
  await settle(200);
  const mid = await pg.evaluate(() => { const r = document.getElementById('opt2').getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { hit: e && e.id, layerPE: getComputedStyle(document.querySelector('.t2-fx-layer')).pointerEvents }; });
  await settle(3200);
  const r1 = await pg.evaluate(() => ({ rec: window.__rec, anims: document.getAnimations().length, layer: !!document.querySelector('.t2-fx-layer'), stats: HansenFX.stats(), coin: document.getElementById('coinN').textContent, score: document.getElementById('score').textContent }));
  const props = new Set(), badT = [], multi = [], uiMoves = [], bigFade = [];
  for (const a of r1.rec.anims) {
    for (const f of a.frames) for (const k of Object.keys(f)) { props.add(k); if (k === 'transform' && /rotate|skew|matrix/.test(f[k])) badT.push(f[k]); }
    if (a.opts.iterations != null && a.opts.iterations !== 1) multi.push(a.opts.iterations);
    if (!a.particle) for (const f of a.frames) if (f.transform && !/^(none|scale\([\d.]+\)|translateY\(-?[\d.]+px\)( scale\([\d.]+\))?)$/.test(f.transform)) uiMoves.push(f.transform);
    if (a.area > 0.6 * 390 * 844 && a.frames.some(f => f.opacity != null && f.opacity < 0.95)) bigFade.push(a.cls);
  }
  t.ok(r1.rec.anims.length >= 30, `一共创建了 ${r1.rec.anims.length} 个动画（答对 + 宝箱 + 结算 + 丝带 + 5 次爆点 + 彩纸；超过 28 个粒子的部分被预算挡掉）`);
  t.ok([...props].every(k => ['transform', 'opacity', 'offset', 'easing', 'composite'].includes(k)), '只动 transform / opacity', [...props]);
  t.ok(badT.length === 0, '没有旋转 / 倾斜', badT.slice(0, 3));
  t.ok(multi.length === 0, '每个动画只播 1 次（不一闪一闪）', multi);
  t.ok(uiMoves.length === 0, '真界面元素只会“弹一下 / 升起来”，没有左右晃（不震）', uiMoves.slice(0, 3));
  t.ok(bigFade.length === 0, '大面积元素没有淡入淡出（不闪屏、切页不淡入）', bigFade);
  t.ok(r1.rec.maxLive <= 28 && r1.rec.maxLive >= 20, `同一时刻最多 ${r1.rec.maxLive} 个粒子（上限 28，连放 5 次 28 个也不超）`);
  t.ok(mid.layerPE === 'none' && mid.hit === 'opt2', '特效正在播时，点按钮照样点得到（图层不挡点击）', mid);
  t.ok(r1.anims === 0 && !r1.layer && r1.stats.live === 0 && r1.stats.running === 0, '播完：0 个动画、图层已删、0 个粒子', { anims: r1.anims, layer: r1.layer, stats: r1.stats });
  t.ok(r1.coin === '1,316' && r1.score === '7', '数字滚到了最终值（1,316 / 7）', [r1.coin, r1.score]);
  const raf0 = r1.rec.raf; await settle(1000); const raf1 = await pg.evaluate(() => window.__rec.raf);
  t.ok(raf1 === raf0 && r1.rec.si === 0, '空闲时 rAF 不再被调用，从没用过 setInterval', { rafDelta: raf1 - raf0, si: r1.rec.si });
  const ref = await pg.evaluate(() => {
    const big = document.getElementById('page');
    const a = HansenFX.rise(big, 20, 0, 300);
    const b = HansenFX._safeFrames([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }]);
    const c = HansenFX._safeFrames([{ filter: 'brightness(1)' }, { filter: 'brightness(2.7)' }]);
    const d = HansenFX._safeFrames([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }]);
    return { a: a === null, b, c, d: d === true, refused: HansenFX.stats().refused };
  });
  t.ok(ref.a && ref.refused.some(x => /大面积/.test(x)), '整页元素做淡入 → 被拒绝，直接显示（切页不淡入）', ref);
  t.ok(ref.b !== true && ref.c !== true, '旋转、亮度滤镜 → 被拒绝', ref);

  console.log('③ 做题中 / 队列');
  const q = await pg.evaluate(async () => {
    const out = {}; const order = [];
    const mk = name => () => { order.push(name); return new Promise(r => setTimeout(r, 120)); };
    HansenFX.roundStart();
    const before = document.body.innerHTML.length;
    out.lv = HansenFX.celebrate('levelUp', { lv: 8 }, mk('levelUp'));
    out.ev = HansenFX.celebrate('evolve', { pet: 3 }, mk('evolve'));
    for (let i = 0; i < 3; i++) HansenFX.celebrate('achievement', { id: 'a' + i }, mk('achievement'));
    out.chest = HansenFX.celebrate('chest', {}, mk('chest'));
    out.result = HansenFX.celebrate('result', {}, mk('result'));
    out.domSame = document.body.innerHTML.length === before && !document.querySelector('.t2-fx-layer');
    out.hit = document.elementFromPoint(195, 200) && document.elementFromPoint(195, 200).id;
    out.playedDuring = order.length;
    HansenFX.roundEnd();
    const batch = HansenFX.flushDeferred();
    out.batch = batch.map(b => [b.kind, b.text, Array.isArray(b.data) ? b.data.length : 1]);
    out.again = HansenFX.flushDeferred().length;
    // 不在做题中：按优先级排队，一个一个播
    HansenFX.celebrate('result', {}, mk('result'));
    HansenFX.celebrate('achievement', {}, mk('achievement'));
    HansenFX.celebrate('levelUp', {}, mk('levelUp'));
    HansenFX.celebrate('boss', {}, mk('boss'));
    HansenFX.celebrate('evolve', {}, mk('evolve'));
    out.unknown = HansenFX.celebrate('fireworks', {}, mk('x')).ok;
    await new Promise(r => setTimeout(r, 1800));
    out.order = order.slice();
    return out;
  });
  t.ok(q.lv.deferred && q.ev.deferred && q.playedDuring === 0 && q.domSame, '做题中：升级 / 进化 / 成就只记下来，页面上什么都不出现', q);
  t.ok(q.hit === 'opt' || q.hit === 'opt2' || q.hit === 'reward' || !!q.hit, '做题中点击不受影响', q.hit);
  t.ok(q.chest.ok === false && q.result.ok === false, '做题中宝箱 / 结算庆祝被拒绝（不会在答题时弹出来）');
  t.ok(JSON.stringify(q.batch) === JSON.stringify([['levelUp', '升级啦！', 1], ['evolve', '宠物长大啦！', 1], ['achievement', '拿到 3 个新成就！', 3]]) && q.again === 0,
    '结算页一次交回：升级 → 进化 → 3 个成就合并成一条（只交一次）', q.batch);
  t.ok(JSON.stringify(q.order) === JSON.stringify(['result', 'boss', 'levelUp', 'evolve', 'achievement']),
    '队列一次只播一个：先到的结算先播，其余按 Boss > 升级 = 进化（先来先播）> 成就', q.order);
  t.ok(q.unknown === false, '不认识的庆祝名字直接拒绝');

  console.log('④ 切页 stopAll');
  const s = await pg.evaluate(async () => {
    HansenFX.confetti({ n: 28 }); HansenFX.burst(100, 100, { n: 10 });
    await new Promise(r => setTimeout(r, 100));
    const during = document.getAnimations().length;
    HansenFX.stopAll();
    return { during, after: document.getAnimations().length, layer: !!document.querySelector('.t2-fx-layer'), stats: HansenFX.stats() };
  });
  t.ok(s.during > 0 && s.after === 0 && !s.layer && s.stats.live === 0, 'stopAll：正在播的立刻停、节点全删', s);
  t.ok(errs.length === 0, '页面 0 报错', errs);
  await ctx.close();

  console.log('⑤ 系统“减少动态效果”');
  const ctx2 = await phone(br, srv.base, { reducedMotion: true }); await ctx2.addInitScript(INSTR);
  const p2 = await ctx2.newPage(); await p2.goto(srv.base + '/__t2/fx.html', { waitUntil: 'load' });
  const rm = await p2.evaluate(async () => {
    const $ = id => document.getElementById(id); let arrived = 0;
    HansenFX.answerRight($('opt'), { xp: $('xp'), onArrive: () => arrived++ });
    HansenFX.chestOpen({ chest: $('chest'), target: $('coins'), countEl: $('coinN'), from: 1280, to: 1316, reward: $('reward'), fmt: v => v.toLocaleString('en-US') });
    HansenFX.roundResult({ stars: [...document.querySelectorAll('.s')], scoreEl: $('score'), to: 7 });
    HansenFX.confetti({ n: 20 }); HansenFX.ribbon('连对 5 个，真棒！', 400);
    await new Promise(r => setTimeout(r, 700));
    return { reduced: HansenFX.reduced(), created: window.__rec.anims.length, anims: document.getAnimations().length, coin: $('coinN').textContent, score: $('score').textContent, arrived,
      layer: !!document.querySelector('.t2-fx-layer'), ribbon: !!document.querySelector('.t2-ribbon') };
  });
  t.ok(rm.reduced && rm.created === 0 && rm.anims === 0 && !rm.layer, '减少动态效果：一个动画都不创建', rm);
  t.ok(rm.coin === '1,316' && rm.score === '7' && rm.arrived === 3, '直接显示最终结果（金币 1,316、答对 7、3 颗星“到达”）', rm);
  t.ok(!rm.ribbon, '丝带到时间自己收起', rm);
  await ctx2.close();
} finally {
  await br.close().catch(() => {}); await srv.close();
}
const failed = t.done();
process.exit(failed ? 1 : 0);
