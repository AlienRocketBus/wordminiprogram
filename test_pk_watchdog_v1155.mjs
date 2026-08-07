#!/usr/bin/env node
/* test_pk_watchdog_v1155.mjs —— 对战/天梯看门狗
 *
 * ═══ 为什么有这个模块 ═══
 *
 * 今天挖出的天梯 bug，**形态出奇地一致**：
 *
 *   · 房建好了，屏幕是白的           （_createForLadder 没开界面）
 *   · 一直转圈，永远不给结果          （断网没人判断）
 *   · 卡在"正在等对手交卷…"永不结束   （没有超时）
 *   · 停在倒计时，答了没反应          （对战中断网）
 *
 * **共同点：界面进了一个"废掉但没人管"的状态。**
 * 而每一次我都是「找到那条路 → 在那条路上补一句提示」。
 *
 * > **与其把每条路都堵一遍（总会漏），不如守住必经之地。**
 *
 * 看门狗就是那个必经之地：**不管因为什么原因废掉，
 * 只要用户被卡住超过一段时间，它就把人救出来。**
 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/claude/work/repo';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };

/* ── 静态契约 ───────────────────────────────────── */
const src = fs.readFileSync(path.join(ROOT, 'hansen_pk_watchdog_v1155.js'), 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('对战看门狗 v1155');

ok(/WHITE_MS = 6000/.test(code) && /FROZEN_MS = 25000/.test(code) && /WAIT_MS = 90000/.test(code),
   '★ 三档阈值：白屏 6 秒 / 僵住 25 秒 / 等待类 90 秒');
ok(/正在找对手\|等对手进来\|等对手交卷\|正在拼/.test(code),
   '★ **等待类界面单独给更长上限** —— 它本来就该长时间不变，' +
   '按对战屏的 25 秒判会天天误报');
ok(/document\.visibilityState === 'hidden'/.test(code),
   '★ **页面在后台时不判定** —— 后台本来就不刷新，误报会很烦人');
ok(/_lastPaint = ''; _lastPaintAt = Date\.now\(\)/.test(code),
   '★ 关掉救援屏时把"上次变化"重新计时');

/* 只保护第一次 = 等于没保护 */
{
  const i = code.indexOf('var quit = function');
  const seg = code.slice(i, i + 400);
  ok(/_rescued = false/.test(seg),
     '★🔒 **点了出口要把哨重新架起来** —— ' +
     '`_rescued` 是"已经救过一次"的锁；如果不在出口处解锁，' +
     '用户回去再玩、第二次卡住就再也不会被救。' +
     '**一个"只保护第一次"的防崩溃系统等于没有。**');
}
ok(/if \(_rescued && !document\.getElementById\('pkRescue'\)\) _rescued = false/.test(code),
   '★🔒 画面一动也解锁 —— 说明上一次的故障已经过去了');

/* 救的方式：不自动跳转 */
ok(!/location\.(href|reload)\s*=/.test(code) && !/location\.reload\(\)/.test(code),
   '★ **不自动跳转、不自动刷新** —— ' +
   '那可能把人从正常对局里踢出去；只盖一层说明 + 给出口');
ok(/pkRescueBack/.test(code) && /pkRescueRetry/.test(code),
   '★ 救援屏给两个出口：回首页 / 重新找对手');
ok(/你的进度和天梯分都还在，没有丢/.test(src),
   '★ **明说"进度没丢"** —— ' +
   '用户最怕的不是出错，是出错了还不知道该怎么办、以为东西没了');

/* ── 真浏览器行为 ───────────────────────────────── */
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/VERSION') { r.writeHead(200, { 'content-type': 'text/plain' }); r.end('1155'); return; }
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise(r => srv.listen(0, r));
const port = srv.address().port;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

/* 每条用独立页面 —— 看门狗有内部状态，共用页面会互相污染
   （这一条是实测撞出来的：同一页里连测多条，前面的 _rescued 会让后面全部假失败） */
async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 70)));
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4600);
  await pg.evaluate(() => window.HansenPkWatchdog._pauseForTest());
  return { pg, ctx, errs };
}

const MAKE_BATTLE = `
  const h=document.createElement('div');h.className='on';
  const w=document.createElement('div');w.className='pr_wrap';
  w.innerText='你 0 ⚡抢答赛 0 对手 第 1 / 3 词 · ⏱ 8s';
  h.appendChild(w);document.body.appendChild(h);`;

/* ① 对战屏僵住 → 救 */
{
  const { pg, ctx, errs } = await fresh();
  const r = await pg.evaluate(new Function(`
    ${MAKE_BATTLE}
    const W=window.HansenPkWatchdog;
    W._tickForTest(); W._agePaintForTest(30000); W._tickForTest();
    return new Promise(res=>setTimeout(()=>res(!!document.getElementById('pkRescue')),150));`));
  ok(r === true, '★ 对战屏 25 秒一动不动 → 救出来');
  ok(errs.length === 0, '★ 救援过程零脚本错误');
  await ctx.close();
}

/* ② 正常对局（内容在变）→ 不救 */
{
  const { pg, ctx } = await fresh();
  const r = await pg.evaluate(new Function(`
    ${MAKE_BATTLE}
    const W=window.HansenPkWatchdog;
    const scr=document.querySelector('.pr_wrap');
    for(let i=10;i>4;i--){ scr.innerText='你 0 ⚡抢答赛 0 对手 第 1 / 3 词 · ⏱ '+i+'s';
      W._tickForTest(); W._agePaintForTest(30000); }
    return new Promise(res=>setTimeout(()=>res(!!document.getElementById('pkRescue')),150));`));
  ok(r === false, '★ **正常对局（倒计时在走）不误救** —— 误救比不救更糟');
  await ctx.close();
}

/* ③ 页面在后台 → 不救 */
{
  const { pg, ctx } = await fresh();
  const r = await pg.evaluate(new Function(`
    ${MAKE_BATTLE}
    Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});
    const W=window.HansenPkWatchdog;
    W._tickForTest(); W._agePaintForTest(60000); W._tickForTest();
    return new Promise(res=>setTimeout(()=>res(!!document.getElementById('pkRescue')),150));`));
  ok(r === false, '★ **页面在后台不判定** —— 切出去本来就不刷新');
  await ctx.close();
}

/* ④ 救过一次后还能再救 —— 这条最要紧 */
{
  const { pg, ctx } = await fresh();
  const r = await pg.evaluate(new Function(`
    ${MAKE_BATTLE}
    const W=window.HansenPkWatchdog;
    W._tickForTest(); W._agePaintForTest(30000); W._tickForTest();
    return new Promise(async res=>{
      await new Promise(z=>setTimeout(z,150));
      const first=!!document.getElementById('pkRescue');
      /* ⚠️ 这里用 quit 的等价操作，不真点按钮：
         真点会触发 HansenPkRoomUI.close() → 可能导致页面跳转，
         Playwright 的执行上下文就没了（实测撞到 "Execution context was destroyed"）。
         我们要验的是"锁有没有解开"，不是"跳转对不对"。 */
      (function(){ const el=document.getElementById('pkRescue'); if(el) el.remove();
                   window.HansenPkWatchdog._resetForTest(); })();
      await new Promise(z=>setTimeout(z,300));
      document.querySelectorAll('.pr_wrap').forEach(e=>e.parentElement&&e.parentElement.remove());
      ${MAKE_BATTLE}
      W._tickForTest(); W._agePaintForTest(30000); W._tickForTest();
      await new Promise(z=>setTimeout(z,150));
      res(first && !!document.getElementById('pkRescue'));
    });`));
  ok(r === true,
     '★🔒 **救过一次、用户点了出口之后，第二次卡住还能再救** —— ' +
     '这条不成立的话，防崩溃系统就只保护第一次');
  await ctx.close();
}

/* ⑤ 出口真的能把人送走 */
{
  const { pg, ctx } = await fresh();
  const r = await pg.evaluate(async () => {
    window.HansenPkWatchdog._rescueForTest('测试', '说明');
    await new Promise(z => setTimeout(z, 150));
    const b1 = document.getElementById('pkRescueBack');
    if (!b1) return 'no-btn';
    b1.click();
    await new Promise(z => setTimeout(z, 300));
    return document.getElementById('pkRescue') ? 'stuck' : 'ok';
  });
  ok(r === 'ok', '★ 点「回到大PK首页」能真的关掉救援屏');
  await ctx.close();
}

/* ⑥ 必须接到页面上 —— 否则等于没做 */
{
  for (const pg of ['index.html', 'spelling_pk.html']) {
    const html = fs.readFileSync(path.join(ROOT, pg), 'utf8');
    ok(html.includes('hansen_pk_watchdog_v1155.js'), `★ ${pg} 已加载看门狗`);
  }
  const html = fs.readFileSync(path.join(ROOT, 'spelling_pk.html'), 'utf8');
  const iGate = html.indexOf('hansen_sw_upgrade_gate_v944.js');
  const iWd = html.indexOf('hansen_pk_watchdog_v1155.js');
  ok(iGate >= 0 && iWd > iGate,
     '★ 排在 SW 升级门之后 —— 升级门必须保持首脚本位置（v1139 的教训）');
}

/* ⑦ 天梯和对战要在动作前"上哨" */
{
  const ld = fs.readFileSync(path.join(ROOT, 'hansen_ladder_ui_v1108.js'), 'utf8');
  const ui = fs.readFileSync(path.join(ROOT, 'hansen_pk_room_ui_v1065.js'), 'utf8');
  ok(/HansenPkWatchdog\.arm\('排位'\)/.test(ld), '★ 开始排位前上哨');
  ok(/HansenPkWatchdog\.arm\('开排位房'\)/.test(ui), '★ 开排位房前上哨');
  ok(/HansenPkWatchdog\.arm\('进排位房'\)/.test(ui), '★ 进排位房前上哨');
}

await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
