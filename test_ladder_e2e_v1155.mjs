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

/* 🔴v1164：假传输层要**和真数据库一个脾气**，否则测的是一个不存在的世界。
   v1155~v1163 的假库：同一个 _id 加两次都成功、谁都能改谁的文档、read 不管 id 永远返回那间房 ——
   真库（「读取全部数据，修改本人数据」）恰恰相反，所以这个测试一直绿、真机上天梯一次都没成过。
   现在：_id 唯一（重复 add 抛 DATABASE_DUPLICATE_WRITE）、只能改/删自己建的文档、read 按 id 查。
   「对面那台手机」的动作（别的房主确认座位、别人先占了座）由 o.remote 模拟 —— 只模拟网络那头，不碰被测代码。 */
const wire = (pg, opts = {}) => pg.evaluate(o => {
  /* v1155: 把"等 20 秒自动开房"的门槛调到 2 秒 —— 产品默认不变，只有测试改它 */
  window.__hsnLadderWaitSec = 2;
  const ME = 'ME';
  const rooms = (o.rooms || []).map(r => Object.assign({ _openid: r.hostId || 'OTHER' }, r));
  window.__rooms = rooms;
  window.__denied = 0;
  const cp = x => x == null ? null : JSON.parse(JSON.stringify(x));
  const dup = () => Object.assign(new Error('E11000 duplicate key error: _id'),
                                  { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
  window.HansenPkRoom._setMeForTest({ id: ME, name: '我' });
  window.HansenPkRoom._setTimingForTest({ lagMs: 150, ackPollMs: 300 });
  window.HansenPkRoom._setTransportForTest({
    read: async id => cp(rooms.find(x => x._id === id) || null),
    patch: async (id, p) => {
      const r = rooms.find(x => x._id === id);
      if (!r) return { updated: 0 };
      if (r._openid !== ME) { window.__denied++; return { updated: 0 }; }
      Object.assign(r, cp(p)); return { updated: 1 };
    },
    add: async d => {
      /* 云端集合权限不对时，真库返回的是这个（SDK 不抛、我们的传输层把 code 变成异常） */
      if (window.__denyAdd) throw Object.assign(new Error('Permission denied'), { code: 'DATABASE_PERMISSION_DENIED', cloud: true });
      const id = d._id || ('NEW' + rooms.length);
      if (rooms.some(x => x._id === id)) throw dup();
      const doc = Object.assign(cp(d), { _id: id, _openid: ME });
      rooms.push(doc);
      /* 对面房主那台手机：看到座位就确认（真房主在 waitForOpponent 里做同样的事） */
      if (o.remote === 'ack' && doc.kind === 'seat') {
        const R = rooms.find(x => x._id === doc.roomId);
        if (R && R._openid !== ME) setTimeout(() => {
          Object.assign(R, { guestId: doc.guestId, guestName: doc.guestName,
                             guestRating: doc.guestRating, status: 'playing', seat: doc.epoch,
                             startedAt: Date.now(), heartbeatAt: Date.now() });
        }, 200);
      }
      return { id: id };
    },
    list: async q => rooms.filter(x => Object.keys(q || {}).every(k => x[k] === q[k])).map(cp),
    remove: async id => {
      const i = rooms.findIndex(x => x._id === id);
      if (i < 0) return { deleted: 0 };
      if (rooms[i]._openid !== ME) { window.__denied++; return { deleted: 0 }; }
      rooms.splice(i, 1); return { deleted: 1 };
    },
    listOpen: async () => {
      if (o.offline) throw new TypeError('Failed to fetch');
      /* 别人的房：房主一直在（心跳是新的） */
      rooms.forEach(r => { if (r._openid !== ME && r.kind === 'room') r.heartbeatAt = Date.now(); });
      return rooms.filter(r => r.kind === 'room' && r.status === 'open' && r.isPrivate === false && !r.guestId).map(cp);
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
  await wire(pg, { remote: 'ack', rooms: [{
    _id: 'RIVAL', proto: 2, kind: 'room', seat: 0, status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '对手', hostRating: 1000, mode: 'A', askMode: 'cn', wordCount: 5,
    seed: 1, heartbeatAt: now, createdAt: now
  }] });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  await pg.waitForTimeout(6500);
  const joined = await pg.evaluate(() => (window.__rooms[0] || {}).guestId === 'ME');
  ok(joined, '★② **找到实力接近的对手就进他的房** —— ' +
     '这条曾经从来没通过（listRooms 漏了 mode/hostRating，筛选永远落空）');
  /* v1164：进房 = 自己 add 一个座位文档，等房主确认；从头到尾不碰房主的文档 */
  const seat = await pg.evaluate(() => window.__rooms.filter(x => x.kind === 'seat' && x.roomId === 'RIVAL' && x._openid === 'ME').length);
  const denied = await pg.evaluate(() => window.__denied);
  ok(seat === 1 && denied === 0, `★② 进房只写自己的座位（座位 ${seat} 个，越权写 ${denied} 次）`);
  const s2 = await screen(pg);
  ok(/第 1 \/ 5 词|你\s*0/.test(s2), `★② 进房后直接进对战屏（实际：${s2.slice(0, 40)}）`);
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
  const made = await pg.evaluate(() => (window.__rooms || []).filter(x => x.kind === 'room').length);
  const s = await screen(pg);
  ok(made === 1, '★③ 等满 20 秒自己开一间排位房');
  ok(/等对手进来/.test(s),
     '★③ **开完房界面要显示「等对手进来」** —— ' +
     '曾经是白屏：只建房没开界面，而 try/catch 把报错吞了');
  ok(errs.length === 0, '★③ 自动开房零脚本错误');
  await ctx.close();
}

/* ══ ④ 房刚好被别人抢走 → 要说人话，而且自动接着找 ══
 * v1164 起进不去不再停在「再找一次对手」那一屏等孩子点 ——
 * 原因要说出来（「被别人抢走了」），然后自己接着找、找不到就自己开一间。 */
{
  const { pg, errs, ctx } = await openPage();
  const now = Date.now();
  await wire(pg, { rooms: [{
    _id: 'TAKEN', proto: 2, kind: 'room', seat: 0, status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '对手', hostRating: 1000, mode: 'A', askMode: 'cn', wordCount: 5,
    seed: 1, heartbeatAt: now, createdAt: now
  }, {
    /* 别人刚抢到的座位（房主还没来得及确认）—— 真库里我再 add 同一个 _id 会被拒 */
    _id: 'TAKEN_s0', _openid: 'G2', proto: 2, kind: 'seat', roomId: 'TAKEN', epoch: 0,
    guestId: 'G2', guestName: '别人', createdAt: now, guestBeat: now, nonce: 'other'
  }] });
  await pg.evaluate(() => window.HansenLadderUI.open());
  await pg.waitForTimeout(700);
  await pg.evaluate(() => document.getElementById('ldGo').click());
  const seen = [];
  for (let i = 0; i < 40; i++) { seen.push(await screen(pg)); await pg.waitForTimeout(200); }
  const all = seen.join(' | ');
  ok(/被别人抢走/.test(all),
     '★④ **房被抢走时说清楚** —— ' +
     '曾经直接甩回房间列表，用户不知道发生了什么、以为天梯坏了');
  ok(/等对手进来|正在找对手/.test(seen[seen.length - 1]),
     `★④ **说完自动接着找（不用孩子再点）** —— 最后停在：${seen[seen.length - 1].slice(0, 30)}`);
  const mine = await pg.evaluate(() => window.__rooms.filter(x => x.kind === 'seat' && x._openid === 'ME').length);
  ok(mine === 0, `★④ 没抢到就不留自己的空座位（剩 ${mine} 个）`);
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
    /* v1164：真库里一词一个回合文档（R_w<i>），客人有自己的座位文档 —— 按 id 查 */
    const t = Date.now();
    const docs = {
      R: { _id: 'R', proto: 2, kind: 'room', seat: 0, status: 'playing', hostId: 'G', hostName: '小明',
           hostRating: 1200, guestId: 'ME', mode: 'A', askMode: 'cn', wordCount: 3,
           hostBeat: t, heartbeatAt: t, createdAt: t, hostReady: true, hostReadyAt: t },
      R_s0: { _id: 'R_s0', proto: 2, kind: 'seat', roomId: 'R', epoch: 0, guestId: 'ME', guestBeat: t, createdAt: t },
      R_w0: { _id: 'R_w0', proto: 2, kind: 'win', roomId: 'R', i: 0, winner: 'host', by: 'G', at: t }
    };
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
    window.HansenPkRoom._setTransportForTest({
      read: async id => { if (docs.R) docs.R.hostBeat = Date.now(); return docs[id] ? JSON.parse(JSON.stringify(docs[id])) : null; },
      patch: async id => ({ updated: id === 'R_s0' ? 1 : 0 }),
      add: async d => { if (docs[d._id]) throw Object.assign(new Error('dup'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
                        docs[d._id] = JSON.parse(JSON.stringify(d)); return { id: d._id }; },
      list: async q => Object.values(docs).filter(x => Object.keys(q || {}).every(k => x[k] === q[k])),
      remove: async () => ({ deleted: 0 }), listOpen: async () => [] });
    window.HansenPkRoomUI._startMatchForTest(
      [{ en: 'cat', cn: '猫' }, { en: 'dog', cn: '狗' }, { en: 'sun', cn: '太阳' }], '对手', 'cn', 'A', 'R');
  });
  await pg.waitForTimeout(4000);
  const opp = await pg.evaluate(() => {
    const e = document.getElementById('prOpp'); return e ? e.textContent : null; });
  ok(opp && Number(opp) > 0,
     `★⑥ **对手得分要跟着更新**（实得 ${opp}）—— ` +
     '曾经永远显示 0：oppScore 开局设 0 后再没被赋值');
  const nm = await pg.evaluate(() => { const e = document.getElementById('prOppName'); return e ? e.textContent : null; });
  ok(nm === '小明', `★⑥ 对手名字从房间里拿（实得 ${nm}）—— 原来客人这边永远显示「对手」`);
  const rt = await pg.evaluate(() => (window.HansenPkRoomUI._stateForTest() || {})._oppRating);
  ok(rt === 1200, `★⑥ 对手的天梯分记下来了（${rt}）—— 结算算 ELO 要用真实分数，不是默认 1000`);
  ok(errs.length === 0, '★⑥ 对战中零脚本错误');
  await ctx.close();
}

/* ══ ⑦ 对战中断网 → 提示，且不打断对局 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await pg.evaluate(() => {
    let dead = false; window.__kill = () => { dead = true; };
    const t = Date.now();
    const docs = {
      R: { _id: 'R', proto: 2, kind: 'room', seat: 0, status: 'playing', hostId: 'ME', guestId: 'G',
           guestName: '小红', mode: 'A', askMode: 'cn', wordCount: 3, hostBeat: t, heartbeatAt: t, createdAt: t },
      R_s0: { _id: 'R_s0', proto: 2, kind: 'seat', roomId: 'R', epoch: 0, guestId: 'G', guestName: '小红',
              guestBeat: t, createdAt: t }
    };
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '我' });
    window.HansenPkRoom._setTransportForTest({
      read: async id => { if (dead) throw new TypeError('fail'); docs.R_s0.guestBeat = Date.now();
        return docs[id] ? JSON.parse(JSON.stringify(docs[id])) : null; },
      patch: async id => ({ updated: id === 'R' ? 1 : 0 }),
      add: async d => { if (docs[d._id]) throw Object.assign(new Error('dup'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
                        docs[d._id] = JSON.parse(JSON.stringify(d)); return { id: d._id }; },
      list: async () => [], remove: async () => ({ deleted: 0 }), listOpen: async () => [] });
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


/* ══ ⑩ 🔴v1164 岛屿页：天梯必须开在「拼写大PK」屏**上面**，手指点得到 ══
 * 真机上天梯从来没用起来的第一道墙：岛屿页里大PK屏 z-index 2147483400，
 * 天梯只有 2147482000 —— 点了「天梯排位」，天梯其实开了，但在大PK屏**后面**，
 * 「开始排位」被盖住、手指点下去点到的是后面的「公开房间」卡片。
 * 每一条回天梯的路（再来一局 / 救援屏的「重新找对手」/ 对战那边交回来）都要看得见。
 * 用 touchscreen.tap（真手指的点法：点到哪个元素由页面上谁在最上面决定）。 */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'U1', method: 'phone', signedAt: Date.now() }));
      localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify({ name: '小明', cid: 'C0001' }));
    } catch (e) {}
  });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 80)));
  await pg.goto(`http://127.0.0.1:${port}/island_animal.html`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(5000);
  await wire(pg, { rooms: [] });
  await pg.evaluate(() => { window.__hsnLadderWaitSec = 60; openSpellPK(); });
  await pg.waitForTimeout(400);
  /* 找到元素在屏幕上的中心点，用手指点（滚到看得见的地方再点） */
  const tapId = async id => {
    const box = await pg.evaluate(i => {
      const el = document.getElementById(i); if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, id);
    if (!box) return 'missing';
    const top = await pg.evaluate(b => { const e = document.elementFromPoint(b.x, b.y); return e ? (e.closest('[id]') || e).id : ''; }, box);
    await pg.touchscreen.tap(box.x, box.y);
    return top;
  };
  const onTop = () => pg.evaluate(() => {
    const e = document.elementFromPoint(195, 300);
    return !!(e && e.closest('#hsn_ladder_screen'));
  });
  const hitKL = await tapId('kLadder');
  await pg.waitForTimeout(600);
  const z = await pg.evaluate(() => {
    const L = document.getElementById('hsn_ladder_screen'), P = document.getElementById('hsn_pk_screen');
    return { l: L ? +getComputedStyle(L).zIndex : 0, p: P ? +getComputedStyle(P).zIndex : 0,
             pkOn: !!(P && P.classList.contains('on')) };
  });
  ok(hitKL === 'kLadder', `★⑩ 手指点到的是「天梯排位」卡片（实得 ${hitKL}）`);
  ok(z.pkOn && z.l > z.p && z.l < 2147483600,
     `★⑩ **天梯层在大PK屏之上、对战屏之下**（天梯 ${z.l} / 大PK ${z.p}）`);
  ok(await onTop(), '★⑩ 屏幕中间最上面的是天梯（不是被盖在大PK屏后面）');
  const hitGo = await tapId('ldGo');
  await pg.waitForTimeout(800);
  const s1 = await screen(pg);
  ok(hitGo === 'ldGo' && /正在找对手/.test(s1) && await onTop(),
     `★⑩ **「开始排位」手指点得到，点了就开始找对手**（点到 ${hitGo}；屏幕：${s1.slice(0, 24)}）`);
  /* 「已等 N 秒」自己在跳 —— 不靠找房请求刷新 */
  const w1 = await pg.evaluate(() => (document.getElementById('ldWaited') || {}).textContent || '');
  await pg.waitForTimeout(2200);
  const w2 = await pg.evaluate(() => (document.getElementById('ldWaited') || {}).textContent || '');
  ok(w1 !== w2 && /已等 \d+ 秒/.test(w2), `★⑩ 「已等 N 秒」每秒自己跳（${w1.slice(0, 6)} → ${w2.slice(0, 6)}）`);
  await pg.evaluate(() => window.HansenLadderUI.close());

  /* 回天梯的几条路：救援屏「重新找对手」、对战那边交回来（回首页 / 接着找）、再来一局 */
  await pg.evaluate(() => window.HansenPkWatchdog._rescueForTest('测试', '说明'));
  await pg.waitForTimeout(200);
  const hitRetry = await tapId('pkRescueRetry');
  await pg.waitForTimeout(800);
  const s2 = await screen(pg);
  ok(hitRetry === 'pkRescueRetry' && /正在找对手/.test(s2) && await onTop(),
     `★⑩ 救援屏「重新找对手」→ 天梯在最上面并直接开始找（屏幕：${s2.slice(0, 20)}）`);
  await pg.evaluate(() => window.HansenLadderUI._fromRoom('home', '暂时没有对手，等会儿再来'));
  await pg.waitForTimeout(500);
  const s3 = await screen(pg);
  ok(/暂时没有对手，等会儿再来/.test(s3) && await onTop(), '★⑩ 对战那边等不到人 → 回到天梯首页并说「暂时没有对手，等会儿再来」');
  await pg.evaluate(() => window.HansenLadderUI._fromRoom('rematch', '那间房刚被别人抢走了，接着帮你找…'));
  await pg.waitForTimeout(500);
  const s4 = await screen(pg);
  ok(/正在找对手/.test(s4) && /被别人抢走/.test(s4) && await onTop(), '★⑩ 对战那边进不去房 → 回天梯自动接着找，并说清楚原因');
  await pg.evaluate(() => { window.HansenLadderUI.close(); window.HansenLadderUI.open(); document.getElementById('ldGo').click(); });
  await pg.waitForTimeout(600);
  ok(/正在找对手/.test(await screen(pg)) && await onTop(), '★⑩ 「再来一局」那条路（打开天梯 + 点开始排位）也在最上面');
  await pg.evaluate(() => window.HansenLadderUI.close());
  ok(errs.length === 0, '★⑩ 岛屿页全程零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ══ ⑪ 🔴v1164 失败按原因分流 —— 不再一律「排位要先登录」/「连不上网络」 ══ */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { rooms: [] });
  const cases = [
    ['expired', { ok: false, kind: 'expired', expired: true, reason: '云端登录过期了，重新登录一次就能继续 ⟨invalid_grant⟩' }, /云端登录过期了/, /重新登录/],
    ['config', { ok: false, kind: 'config', code: 'DATABASE_PERMISSION_DENIED',
                 reason: '云端设置还差一步：数据库集合「hansen_pk_rooms」的权限不允许这样读写 ⟨DATABASE_PERMISSION_DENIED | Permission denied⟩' },
     /云端设置还差一步/, /技术信息：DATABASE_PERMISSION_DENIED/],
    ['network', { ok: false, kind: 'network', reason: '连不上网络，检查一下 Wi-Fi 或数据再试 ⟨network request error⟩' },
     /连不上网络/, /技术信息：network request error/]
  ];
  for (const [k, r, want, tech] of cases) {
    const s = await pg.evaluate(async rr => {
      window.HansenPkRoom.listRooms = async () => rr;
      window.HansenLadderUI.open();
      document.getElementById('ldGo').click();
      await new Promise(z => setTimeout(z, rr.kind === 'network' ? 13000 : 600));
      const w = document.querySelector('.ld_wrap');
      return w ? w.innerText.replace(/\s+/g, ' ') : '';
    }, r);
    ok(want.test(s) && tech.test(s) && !/排位要先登录/.test(s), `★⑪ ${k} → 「${(s.match(want) || [''])[0]}」+ 技术信息（不是「排位要先登录」）`);
  }
  /* 云端会话还没好（已经登录了）：悄悄重试、说「正在连接云端…」，不说「要先登录」 */
  const ss = await pg.evaluate(async () => {
    window.HansenPkRoom.listRooms = async () => ({ ok: false, kind: 'session', reason: '云端还在准备中，等一两秒再点一次 ⟨云端会话尚未就绪⟩' });
    window.HansenLadderUI.open();
    document.getElementById('ldGo').click();
    await new Promise(z => setTimeout(z, 2500));
    const w = document.querySelector('.ld_wrap');
    return w ? w.innerText.replace(/\s+/g, ' ') : '';
  });
  ok(/正在连接云端/.test(ss) && /正在找对手/.test(ss) && !/要先登录/.test(ss),
     '★⑪ session（已登录、云端会话还没好）→ 留在找对手屏，显示「正在连接云端…」，悄悄重试');
  await pg.evaluate(() => window.HansenLadderUI.close());
  ok(errs.length === 0, '★⑪ 零脚本错误');
  await ctx.close();
}

/* ══ ⑫ 🔴v1164 排位自己开房失败 → 回天梯说清楚原因（原来：白屏 / 无限重试 / 一律「出了点问题」）══ */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { rooms: [] });
  /* 云端拒绝建文档（集合权限不对）→ 「云端设置还差一步」 */
  const s1 = await pg.evaluate(async () => {
    window.__denyAdd = true;
    window.HansenLadderUI.open();
    document.getElementById('ldGo').click();
    await new Promise(z => setTimeout(z, 6000));
    const w = document.querySelector('#hsn_ladder_screen.on .ld_wrap');
    const pr = document.querySelector('#hsn_pkroom_screen.on');
    return { s: w ? w.innerText.replace(/\s+/g, ' ') : '', roomUi: !!pr };
  });
  ok(/云端设置还差一步/.test(s1.s) && /技术信息/.test(s1.s) && !s1.roomUi,
     `★⑫ 开排位房被云端拒 → 回天梯「云端设置还差一步」+ 技术信息（${s1.s.slice(0, 40)}）`);
  /* 词库没加载 → 试 3 次后把原话（「刷新一下页面」）告诉孩子，不无限重试 */
  const s2 = await pg.evaluate(async () => {
    window.__denyAdd = false;
    window.__vocabBak = window.HANSEN_VOCAB_ALL; window.HANSEN_VOCAB_ALL = {};
    window.HansenLadderUI.open();
    document.getElementById('ldGo').click();
    await new Promise(z => setTimeout(z, 14000));
    window.HANSEN_VOCAB_ALL = window.__vocabBak;
    const w = document.querySelector('#hsn_ladder_screen.on .ld_wrap');
    return w ? w.innerText.replace(/\s+/g, ' ') : '';
  });
  ok(/词库还没加载好/.test(s2) && /再试一次/.test(s2),
     `★⑫ 开房一直失败 → 几次后停下来说真实原因（${s2.slice(0, 50)}）`);
  await pg.evaluate(() => window.HansenLadderUI.close());
  ok(errs.length === 0, '★⑫ 零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ══ ⑬ 🔴v1164 等不到人：房收掉、心跳停掉，并说人话 ══
 * 原来：自由房等满两分钟 → 「出了点问题，再试一次吧」（sayHuman 认不得那句话），
 * 而且房没退、心跳还在跑 → 一间「看得见、进去没人」的幽灵房；
 * 排位那边则停在自由房的列表里。 */
{
  const { pg, errs, ctx } = await openPage();
  await wire(pg, { rooms: [] });
  const r = await pg.evaluate(async () => {
    window.HansenPkRoomUI._setWaitMsForTest(1500);
    const out = {};
    /* 自由房 */
    window.HansenPkRoomUI.open();
    await new Promise(z => setTimeout(z, 300));
    document.getElementById('prNew').click();
    await new Promise(z => setTimeout(z, 200));
    document.querySelector('.pr_mode[data-mode="C"]').click();
    await new Promise(z => setTimeout(z, 6000));
    out.lobby = (document.querySelector('.pr_wrap') || {}).innerText || '';
    out.left1 = window.__rooms.filter(x => x.kind === 'room' && x._openid === 'ME').length;
    window.HansenPkRoomUI.close();
    /* 排位 */
    window.__hsnLadderWaitSec = 1;
    window.HansenLadderUI.open();
    document.getElementById('ldGo').click();
    await new Promise(z => setTimeout(z, 9000));
    const w = document.querySelector('#hsn_ladder_screen.on .ld_wrap');
    out.ladder = w ? w.innerText.replace(/\s+/g, ' ') : '';
    out.left2 = window.__rooms.filter(x => x.kind === 'room' && x._openid === 'ME').length;
    window.HansenPkRoomUI._setWaitMsForTest(0);
    window.HansenLadderUI.close();
    return out;
  });
  ok(/房间先关掉了/.test(r.lobby) && !/出了点问题/.test(r.lobby) && r.left1 === 0,
     `★⑬ 自由房等不到人 → 房收掉，列表上说「${(r.lobby.match(/等了两分钟[^。]*/) || [''])[0]}」（剩 ${r.left1} 间）`);
  ok(/暂时没有对手，等会儿再来/.test(r.ladder) && r.left2 === 0,
     `★⑬ 排位等不到人 → 房收掉，回天梯首页「暂时没有对手，等会儿再来」（剩 ${r.left2} 间）`);
  ok(errs.length === 0, '★⑬ 零脚本错误' + (errs.length ? '：' + errs[0] : ''));
  await ctx.close();
}

/* ══ ⑭ 🔴v1164 进不去房要说真实原因；交卷网络失败不能断链 ══ */
{
  const { pg, errs, ctx } = await openPage();
  const now = Date.now();
  await wire(pg, { rooms: [{
    _id: 'GONE', proto: 2, kind: 'room', seat: 0, status: 'open', isPrivate: false, guestId: '', hostId: 'OTHER',
    hostName: '小刚', hostRating: 0, mode: 'C', askMode: 'cn', wordCount: 3, seed: 7, heartbeatAt: now, createdAt: now
  }] });
  const r = await pg.evaluate(async () => {
    window.HansenPkRoomUI.open();
    await new Promise(z => setTimeout(z, 1500));
    /* 列表画出来以后房主那边关了房（文档没了）—— 再点「进去打」 */
    const i = window.__rooms.findIndex(x => x._id === 'GONE'); if (i >= 0) window.__rooms.splice(i, 1);
    const b = document.querySelector('#prList button[data-rid]');
    if (!b) return { err: 'no-btn' };
    b.click();
    await new Promise(z => setTimeout(z, 4000));
    return { s: ((document.querySelector('.pr_err') || {}).innerText || '') };
  });
  ok(/已经没有了|不在了/.test(r.s || '') && !/抢走/.test(r.s || ''),
     `★⑭ 房没了 → 说「房没了」，不再一律说「被别人抢走了」（${(r.s || r.err || '').slice(0, 30)}）`);
  /* 交卷时网络抛错：原来 pollResult 的 catch 里用了没定义的 st → ReferenceError，等交卷这条链当场断 */
  const p2 = await pg.evaluate(async () => {
    window.HansenPkRoom.reportResult = () => Promise.reject(new TypeError('Failed to fetch'));
    window.HansenPkRoomUI._startMatchForTest([{ en: 'cat', cn: '猫' }], '对手', 'cn', 'C', 'test');
    await new Promise(z => setTimeout(z, 1500));
    const inp = document.getElementById('prIn'); inp.value = 'cat'; inp.oninput();
    await new Promise(z => setTimeout(z, 8000));
    return ((document.querySelector('.pr_wrap') || {}).innerText || '').replace(/\s+/g, ' ');
  });
  ok(/等对手交卷/.test(p2), `★⑭ 交卷网络失败 → 还在等、还在重试（${p2.slice(0, 30)}）`);
  await pg.evaluate(() => window.HansenPkRoomUI.close());
  ok(errs.length === 0, '★⑭ 零脚本错误（原来这里是 ReferenceError: st is not defined）' + (errs.length ? '：' + errs[0] : ''));
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
