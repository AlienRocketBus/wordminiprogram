#!/usr/bin/env node
/* test_ladder_e2e_v1155.mjs —— 天梯：真开浏览器打一局
 *
 * ═══ 为什么要有这个测试 ═══
 *
 * 用户问：「天梯怎么还是有这么多 bug？」
 * 我用数据查了一遍，答案是三条叠加：
 *
 *   ① **天梯的测试从来没真打过一局**
 *      原有 38 条断言里，26 条只是"读源码做正则匹配"，
 *      **0 条真的开浏览器走一遍流程**。
 *      而今天挖出的每一个 bug，**代码里看都是对的**。
 *
 *   ② **天梯是寄生在房间系统上的一层薄皮**
 *      它靠 5 个接口活着（listRooms / _createForLadder /
 *      _joinForLadder / summary / open），
 *      而房间系统改过 **40 次**、天梯只改过 **8 次** ——
 *      中间那几个接口**没有任何测试守着**：
 *        · v1135 改房间查询 → 天梯匹配全废（漏了 mode/hostRating）
 *        · v1154 改界面调用 → 天梯白屏（没先 open）
 *
 *   ③ **56 处空 catch 让断掉的接口一声不吭**
 *      代码看正常、控制台零错误、用户看到白屏。
 *
 * 这个文件治的是 ①。它把今天手动点出来的那 11 个 bug，
 * **变成每次发版都会自动重跑的流程**。
 *
 * ⚠️ 它跑得慢（要开浏览器、要等匹配超时），但这正是它的价值：
 * **省下的每一秒，都可能是用户看到白屏的那一秒。**
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

/* 造一个"已登录"的页面，并接上假传输层 */
async function openPage(uid = 'U1') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(u => {
    try {
      localStorage.setItem('hansen_auth_v1004',
        JSON.stringify({ uid: u, method: 'phone', signedAt: Date.now() }));
    } catch (e) {}
  }, uid);
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
  await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4600);
  return { pg, errs, ctx };
}

const wire = (pg, opts = {}) => pg.evaluate(o => {
  /* v1155: 把"等 20 秒自动开房"的门槛调到 2 秒 ——
     整条 E2E 从 135 秒降到十几秒。
     产品默认不变，只有测试改它。 */
  window.__hsnLadderWaitSec = 2;
  const rooms = o.rooms || [];
  window.__rooms = rooms;
  window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
  window.HansenPkRoom._setTransportForTest({
    read: async id => rooms.find(x => x._id === id) || null,
    claim: async (id, g, p) => {
      if (o.claimFails) return { updated: 0 };
      const r = rooms.find(x => x._id === id);
      if (!r) return { updated: 0 };
      for (const k of Object.keys(g)) if (r[k] !== g[k]) return { updated: 0 };
      Object.assign(r, p); return { updated: 1 };
    },
    patch: async (id, p) => { const r = rooms.find(x => x._id === id); if (r) Object.assign(r, p); return { updated: 1 }; },
    add: async d => { const doc = Object.assign({ _id: 'NEW' + rooms.length }, d); rooms.push(doc); return { id: doc._id }; },
    list: async () => [], remove: async () => true,
    listOpen: async () => {
      if (o.offline) throw new TypeError('Failed to fetch');
      return rooms.filter(r => r.status === 'open' && r.isPrivate === false && !r.guestId);
    }
  });
}, opts);

const screen = pg => pg.evaluate(() => {
  const w = document.querySelector('.pr_wrap') || document.querySelector('.ld_wrap');
  return w ? (w.innerText || '').replace(/\s+/g, ' ').slice(0, 200) : '';
});

console.log('天梯全流程 E2E v1155（真开浏览器）\n');

/* ══ ① 打开天梯页 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg);
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(900);
  const s = await screen(pg);
  ok(/天梯排位/.test(s), '★① 天梯页能打开');
  ok(errs.length === 0, '★① 打开天梯零脚本错误');
  await ctx.close();
}

/* ══ ② 有实力接近的对手 → 能进他的房 ══
 * 这条曾经**从来没通过**：listRooms 的映射漏了 mode 和 hostRating，
 * 天梯的筛选拿不到这两个字段，于是永远找不到任何房。 */
{
  const { pg, errs, ctx } = await openPage();
  const now = Date.now();
  await wire(pg, { rooms: [{
    _id: 'RIVAL', status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '对手', hostRating: 1000, mode: 'A', askMode: 'cn', wordCount: 5,
    seed: 1, winners: [], round: 0, heartbeatAt: now, createdAt: now
  }] });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(6500);
  const joined = await pg.evaluate(() => (window.__rooms[0] || {}).guestId === 'ME');
  ok(joined, '★② **找到实力接近的对手就进他的房** —— ' +
     '这条曾经从来没通过（listRooms 漏了 mode/hostRating，筛选永远落空）');
  ok(errs.length === 0, '★② 进房零脚本错误');
  await ctx.close();
}

/* ══ ③ 没有对手 → 等满 20 秒自己开一间，且界面要有东西 ══
 * 曾经：房建好了（数据库确实多一间），**屏幕是白的** ——
 * 因为 _createForLadder 只建房、没先打开界面，
 * 而外层 try/catch 把报错吞了（控制台干干净净）。 */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(7000);
  const made = await pg.evaluate(() => (window.__rooms || []).length);
  const s = await screen(pg);
  ok(made === 1, '★③ 等满 20 秒自己开一间排位房');
  ok(/等对手进来/.test(s),
     '★③ **开完房界面要显示「等对手进来」** —— ' +
     '曾经是白屏：只建房没开界面，而 try/catch 把报错吞了');
  ok(errs.length === 0, '★③ 自动开房零脚本错误');
  await ctx.close();
}

/* ══ ④ 房刚好被别人抢走 → 要说人话 ══ */
{
  const { pg, errs, ctx } = await openPage();
  const now = Date.now();
  await wire(pg, { claimFails: true, rooms: [{
    _id: 'TAKEN', status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '对手', hostRating: 1000, mode: 'A', askMode: 'cn', wordCount: 5,
    seed: 1, winners: [], round: 0, heartbeatAt: now, createdAt: now
  }] });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(7000);
  const s = await screen(pg);
  ok(/被别人抢走|再找一次/.test(s),
     '★④ **房被抢走时说清楚** —— ' +
     '曾经直接甩回房间列表，用户不知道发生了什么、以为天梯坏了');
  ok(errs.length === 0, '★④ 抢房失败零脚本错误');
  await ctx.close();
}

/* ══ ⑤ 一直连不上 → 要告诉用户，不能永远转圈 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { offline: true });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(14000);
  const s = await screen(pg);
  ok(/连不上网络|重新找对手/.test(s),
     '★⑤ **连不上时明说** —— ' +
     '曾经永远停在"正在找对手…"（listRooms 失败时返回 {ok:false} 不抛异常，' +
     '只挂 .catch 永远进不去）');
  ok(errs.length === 0, '★⑤ 断网零脚本错误');
  await ctx.close();
}

/* ══ ⑥ 对战中：对手得分要能看到 ══
 * 曾经 oppScore 只在开局被设成 0、之后一次都没赋值 ——
 * "实时比分"这个功能从来只有一半。 */
{
  const { pg, errs, ctx } = await openPage();
  await pg.evaluate(() => {
    const doc = { _id: 'R', hostId: 'G', guestId: 'ME', mode: 'A', askMode: 'cn',
      round: 1, winners: ['host'], wordCount: 3,
      hostBeat: Date.now(), guestBeat: Date.now(), createdAt: Date.now(), roundAt: Date.now() };
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
    window.HansenPkRoom._setTransportForTest({
      read: async () => { doc.hostBeat = Date.now(); return JSON.parse(JSON.stringify(doc)); },
      claim: async () => ({ updated: 1 }), patch: async () => ({ updated: 1 }),
      add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => [] });
    window.HansenPkRoomUI._startMatchForTest(
      [{ en: 'cat', cn: '猫' }, { en: 'dog', cn: '狗' }, { en: 'sun', cn: '太阳' }], '对手', 'cn', 'A', 'R');
  });
  await pg.waitForTimeout(4000);
  const opp = await pg.evaluate(() => {
    const e = document.getElementById('prOpp'); return e ? e.textContent : null; });
  ok(opp && Number(opp) > 0,
     `★⑥ **对手得分要跟着更新**（实得 ${opp}）—— ` +
     '曾经永远显示 0：oppScore 开局设 0 后再没被赋值');
  ok(errs.length === 0, '★⑥ 对战中零脚本错误');
  await ctx.close();
}

/* ══ ⑦ 对战中断网 → 提示，且不打断对局 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await pg.evaluate(() => {
    let dead = false; window.__kill = () => { dead = true; };
    const doc = { _id: 'R', hostId: 'ME', guestId: 'G', mode: 'A', askMode: 'cn',
      round: 0, winners: [], wordCount: 3,
      hostBeat: Date.now(), guestBeat: Date.now(), createdAt: Date.now(), roundAt: Date.now() };
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
    window.HansenPkRoom._setTransportForTest({
      read: async () => { if (dead) throw new TypeError('fail'); doc.guestBeat = Date.now();
        return JSON.parse(JSON.stringify(doc)); },
      claim: async () => ({ updated: 1 }), patch: async () => ({ updated: 1 }),
      add: async () => ({ id: 'R' }), list: async () => [], remove: async () => true, listOpen: async () => [] });
    window.HansenPkRoomUI._startMatchForTest([{ en: 'cat', cn: '猫' }, { en: 'dog', cn: '狗' }], '对手', 'cn', 'A', 'R');
  });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => window.__kill());
  await pg.waitForTimeout(7000);
  const warned = await pg.evaluate(() => !!document.getElementById('prNetWarn'));
  const still = await pg.evaluate(() => !!document.getElementById('prIn'));
  ok(warned, '★⑦ **对战中断网要提示** —— 曾经一直停在倒计时，用户不知道网断了');
  ok(still, '★⑦ **提示但不打断对局** —— 网可能马上回来，把人踢出去比卡着更糟');
  ok(errs.length === 0, '★⑦ 对战断网零脚本错误');
  await ctx.close();
}

/* ══ ⑧ 反复进出天梯不能泄漏定时器 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg);
  const leaked = await pg.evaluate(async () => {
    let live = 0;
    const oSI = window.setInterval, oCI = window.clearInterval;
    window.setInterval = function () { live++; return oSI.apply(this, arguments); };
    window.clearInterval = function () { live--; return oCI.apply(this, arguments); };
    const base = live;
    for (let i = 0; i < 8; i++) {
      window.HansenLadderUI.open();
      await new Promise(z => setTimeout(z, 180));
      const g = document.getElementById('ldGo'); if (g) g.click();
      await new Promise(z => setTimeout(z, 350));
      window.HansenLadderUI.close();
      await new Promise(z => setTimeout(z, 180));
    }
    await new Promise(z => setTimeout(z, 1500));
    window.setInterval = oSI; window.clearInterval = oCI;
    return live - base;
  });
  ok(leaked <= 1, `★⑧ 进出天梯 8 次不泄漏定时器（残留 ${leaked}）`);
  ok(errs.length === 0, '★⑧ 反复进出零脚本错误');
  await ctx.close();
}

/* ══ ⑨ 全程不许有"被吞掉的错误" ══
 * 今天两个"根本用不了"都是被空 catch 吞掉的 ——
 * 控制台干干净净，只有用户看到白屏。 */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { rooms: [] });
  const silent = await pg.evaluate(async () => {
    if (!window.HansenSilentWatch) return 'no-watch';
    window.HansenSilentWatch.clear();
    window.HansenLadderUI.open();
    await new Promise(z => setTimeout(z, 700));
    document.getElementById('ldGo').click();
    await new Promise(z => setTimeout(z, 24000));
    return window.HansenSilentWatch.count();
  });
  ok(silent !== 'no-watch', '★⑨ 悄悄报错观察者已就位');
  ok(silent === 0,
     `★⑨ **天梯完整跑一遍没有任何被吞掉的错误**（记录 ${silent} 条）—— ` +
     '今天两个"根本用不了"都是被空 catch 吞掉的：' +
     '代码看正常、控制台零错误、用户看到白屏');
  ok(errs.length === 0, '★⑨ 全程零脚本错误');
  await ctx.close();
}


/* ── 🔴v1156：排位开房时不许闪过"房间已经不在了" ────────
 *
 * v1155 为了修"自动开房后白屏"，在 `_createForLadder` 里调了 `lobby()`。
 * 白屏是治好了，但引入了新毛病：
 * **lobby() 会去拉房间列表，而那一刻我们的房还没建好**，
 * 于是它先画出一个「房间已经不在了」的错误列表，
 * 几百毫秒后才被等待屏盖掉。
 *
 * 用户等满 20 秒之后看到的第一眼是一句报错 —— 比白屏好不了多少。
 *
 * > 修一个问题时引入的新问题，往往比原问题更难发现，
 * > 因为注意力都在"原来那个治好了没有"上。
 */
{
  const ui = fs.readFileSync(ROOT + '/hansen_pk_room_ui_v1065.js', 'utf8');
  const code = ui.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const fn of ['_createForLadder', '_joinForLadder']) {
    const i = code.indexOf('function ' + fn);
    const seg = code.slice(i, i + 700);
    ok(!/\blobby\(\)/.test(seg),
       `★ ${fn} 不调 lobby() —— ` +
       '那会先画出一个「房间已经不在了」的错误列表，' +
       '而用户等满 20 秒后看到的第一眼不该是报错');
    ok(/classList\.add\('on'\)/.test(seg),
       `★ ${fn} 只把容器打开 —— 真正需要的只是"让等待屏有地方可画"`);
  }
}

await browser.close();
srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
