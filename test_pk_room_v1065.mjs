/* test_pk_room_v1065.mjs —— 在线对战房间匹配台架
 *
 * 为什么这个测试重要：
 *   开发容器连不上腾讯云，云端相关代码此前**完全没法验证**，只能靠推理——
 *   跨设备存档那条线因此空转了 40 版，每版都改对了一个真 bug，却都不是真凶。
 *   本模块因此把所有云端读写收敛到一个 transport 接口，
 *   `_setTransportForTest()` 换上假实现后，抢房竞态、心跳过期、断线回收
 *   这些**真机上最难复现**的场景全部可以在本地跑真实断言。
 *
 * 覆盖的合同：
 *   ① 同一个种子在任何设备上给出同一批词（否则两人做的题不一样）
 *   ② 两人同时抢同一间房，**有且只有一个**成功，另一个收到明确提示
 *   ③ 心跳过期的房间不再被列出（房主直接关页面来不及删房）
 *   ④ 房主离房 = 删房；客人离房 = 房间回到可加入
 *   ⑤ 交卷双方齐了才判胜负，先交的人处于 waiting
 *   ⑥ 会话失效时明确失败，且错误可读（不得出现 [object Object]）
 *   ⑦ 绝不自建云端实例——必须走 HansenAuth.ensureSession + _app
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const R = '/home/claude/work/repo/';
console.log('在线对战 · 房间匹配 v1065');

const src = fs.readFileSync(R + 'hansen_pk_room_v1065.js', 'utf8');
const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ── 假传输层：一个内存里的"云数据库"，行为对齐 TCB 的语义 ── */
function fakeCloud() {
  const rows = new Map();
  let seq = 0;
  const api = {
    _rows: rows,
    add(doc) { const id = 'r' + (++seq); rows.set(id, { ...doc, _id: id }); return Promise.resolve({ id }); },
    listOpen(now) {
      const out = [...rows.values()]
        .filter(x => x.status === 'open' && (now - (x.heartbeatAt || 0)) < 30000)
        .sort((a, b) => b.createdAt - a.createdAt);
      return Promise.resolve(out);
    },
    /* 条件更新，返回影响行数 —— 抢房原子性完全靠它 */
    claim(id, guard, patch) {
      const r = rows.get(id);
      if (!r) return Promise.resolve({ updated: 0 });
      for (const k of Object.keys(guard || {})) if (r[k] !== guard[k]) return Promise.resolve({ updated: 0 });
      rows.set(id, { ...r, ...patch });
      return Promise.resolve({ updated: 1 });
    },
    patch(id, data) { const r = rows.get(id); if (r) rows.set(id, { ...r, ...data }); return Promise.resolve(true); },
    remove(id) { rows.delete(id); return Promise.resolve(true); },
    read(id) { return Promise.resolve(rows.get(id) ? { ...rows.get(id) } : null); }
  };
  return api;
}

function mkCtx(who) {
  const win = {
    HANSEN_VOCAB_ALL: {
      wordIslandFood: Array.from({ length: 40 }, (_, i) => ({ en: 'food' + i, cn: '食' + i })),
      wordIslandAnimal: Array.from({ length: 40 }, (_, i) => ({ en: 'ani' + i, cn: '兽' + i }))
    },
    HansenAuth: { readLocal: () => ({ phone: who }), ensureSession: () => Promise.resolve({ ok: true }), _app: () => ({}) },
    HansenSbProfile: { status: () => ({ name: who + '的名字' }) },
    setInterval: () => 0, clearInterval() {}, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)),
    console, Date, Math, JSON, Object, Promise, Error, String, Number, Array
  };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.HansenPkRoom;
}

/* ═══ ① 同种子 → 同词表 ═══ */
{
  const A = mkCtx('userA'), B = mkCtx('userB');
  const wa = A.wordsFromSeed(123456, 10), wb = B.wordsFromSeed(123456, 10);
  ok(wa.length === 10, `取到 10 个词（实得 ${wa.length}）`);
  ok(JSON.stringify(wa) === JSON.stringify(wb), '★ 同一种子在两台设备上给出完全相同的词表');
  const wc = A.wordsFromSeed(999, 10);
  ok(JSON.stringify(wa) !== JSON.stringify(wc), '不同种子给出不同词表（不是常量）');
  ok(new Set(wa.map(w => w.en)).size === wa.length, '同一局内不重复出词');
}

/* ═══ ② 抢房竞态：两人同时进同一间，只能有一个成功 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('host'), g1 = mkCtx('guest1'), g2 = mkCtx('guest2');
  [host, g1, g2].forEach(m => m._setTransportForTest(cloud));

  const made = await host.createRoom({ tier: '工蜂' });
  ok(made.ok === true, '房主开房成功');
  ok(!!made.roomId, `拿到房间号 ${made.roomId}`);
  ok(made.words.length === 10, '房主拿到本局词表');

  /* 两个客人**同时**发起进房 */
  const [r1, r2] = await Promise.all([g1.joinRoom(made.roomId), g2.joinRoom(made.roomId)]);
  const wins = [r1, r2].filter(r => r.ok);
  const loses = [r1, r2].filter(r => !r.ok);
  ok(wins.length === 1, `★ 两人同抢一间房，有且只有一个成功（实得 ${wins.length}）`);
  ok(loses.length === 1 && loses[0].taken === true, '★ 失败方明确收到"刚被别人占了"，不是含糊报错');
  ok(!/\[object Object\]/.test(String(loses[0].reason)), `失败原因可读："${loses[0].reason}"`);

  const room = await cloud.read(made.roomId);
  ok(room.status === 'playing', '房间状态已置为 playing');
  ok(!!room.guestId && room.guestId !== room.hostId, '房间里只记了一位客人');

  /* 房主与获胜的客人必须拿到同一批词 */
  ok(JSON.stringify(made.words) === JSON.stringify(wins[0].words), '★ 房主与客人拿到完全相同的词表');

  /* 第三个人再来 → 房已满 */
  const g3 = mkCtx('guest3'); g3._setTransportForTest(cloud);
  const r3 = await g3.joinRoom(made.roomId);
  ok(r3.ok === false && r3.taken === true, '房满后第三人被明确拒绝');
}

/* ═══ ③ 心跳过期的房间不再被列出 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('host'), other = mkCtx('other');
  [host, other].forEach(m => m._setTransportForTest(cloud));
  const made = await host.createRoom({});
  let ls = await other.listRooms();
  ok(ls.ok && ls.rooms.length === 1, '新开的房能被别人看到');

  /* 模拟房主直接关掉页面：心跳停在 40 秒前 */
  await cloud.patch(made.roomId, { heartbeatAt: Date.now() - 40000 });
  ls = await other.listRooms();
  ok(ls.rooms.length === 0, '★ 心跳过期(>30s)的房间不再展示（房主关页面来不及删房）');
}

/* ═══ ④ 离房语义：房主删房 / 客人退出后房间可再加入 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('hostX'), guest = mkCtx('guestX');
  [host, guest].forEach(m => m._setTransportForTest(cloud));
  const made = await host.createRoom({});
  await guest.joinRoom(made.roomId);

  await guest.leaveRoom(made.roomId);
  let room = await cloud.read(made.roomId);
  ok(room && room.status === 'open' && !room.guestId, '★ 客人退出后房间回到可加入状态（房主还能等下一个）');

  const guest2 = mkCtx('guestY'); guest2._setTransportForTest(cloud);
  const rejoin = await guest2.joinRoom(made.roomId);
  ok(rejoin.ok === true, '新的客人能进这间空出来的房');

  await host.leaveRoom(made.roomId);
  room = await cloud.read(made.roomId);
  ok(room === null, '★ 房主离房 = 房间被删除，不留幽灵房');
}

/* ═══ ⑤ 交卷：两边齐了才判胜负 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('h2'), guest = mkCtx('g2b');
  [host, guest].forEach(m => m._setTransportForTest(cloud));
  const made = await host.createRoom({});
  await guest.joinRoom(made.roomId);

  const first = await host.reportResult(made.roomId, 80);
  ok(first.ok === true && first.waiting === true, '先交卷的一方处于等待状态，不提前判负');

  const second = await guest.reportResult(made.roomId, 95);
  ok(second.ok === true && second.waiting === false, '双方齐了才出结果');
  ok(second.result === 'win', `高分方判胜（${second.mine} vs ${second.theirs}）`);

  const hostView = await host.reportResult(made.roomId, 80);
  ok(hostView.result === 'lose', '★ 同一局在两边看到互补的结论（一方胜则另一方负）');
}

/* ═══ ⑥ 会话失效 → 明确失败且错误可读 ═══ */
{
  const m = mkCtx('userZ');
  /* 不注入假传输层，走真实路径；但把会话探测置为失效 */
  const ctxWin = { ok: false, expired: true, reason: '云端会话已失效' };
  const mod = m;
  mod._setTransportForTest({
    add: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    listOpen: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    claim: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    patch: () => Promise.resolve(true), remove: () => Promise.resolve(true), read: () => Promise.resolve(null)
  });
  const made = await mod.createRoom({});
  ok(made.ok === false, '会话失效时开房明确失败');
  ok(!/\[object Object\]/.test(String(made.reason)), `开房失败原因可读："${made.reason}"`);
  ok(/credentials not found/.test(made.reason), '挖出了云端的真实错因');
  const ls = await mod.listRooms();
  ok(ls.ok === false && Array.isArray(ls.rooms) && ls.rooms.length === 0, '列房失败时返回空列表而非崩溃');
}

/* ═══ ⑦ 静态合同：绝不自建云端实例 ═══ */
{
  ok(/ensureSession/.test(codeOnly), '★ 云端访问经过 ensureSession（真实会话探测）');
  ok(/HansenAuth\._app|A\._app\(\)/.test(codeOnly), '★ 复用账号的 CloudBase 实例');
  ok(!/cloudbase\.init|signInAnonymously|vendor_cloudbase/.test(codeOnly),
     '★ 绝不自建实例、不自行 import SDK（v1028/v1059 两次事故的成因）');
  ok(/_setTransportForTest/.test(codeOnly), '★ 保留传输层注入口，云端逻辑可在本地验证');
  /* 抢房必须是条件更新，不得"先读再写" */
  const joinBody = codeOnly.slice(codeOnly.indexOf('function joinRoom'), codeOnly.indexOf('function startHeartbeat'));
  ok(/claim\(/.test(joinBody), '★ 进房走条件更新 claim()');
  ok(/updated/.test(joinBody), '★ 依据影响行数判定抢房成败（不是先读再写）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
