/* test_pk_room_v1065.mjs —— 在线对战房间匹配台架
 *
 * 为什么这个测试重要：
 *   开发容器连不上腾讯云，云端相关代码此前**完全没法验证**，只能靠推理——
 *   跨设备存档那条线因此空转了 40 版，每版都改对了一个真 bug，却都不是真凶。
 *   本模块因此把所有云端读写收敛到一个 transport 接口，
 *   `_setTransportForTest()` 换上假实现后，抢房竞态、心跳过期、断线回收
 *   这些**真机上最难复现**的场景全部可以在本地跑真实断言。
 *
 * 🔴v1164：假数据库以前**什么都让写**（两个人 add 同一个 _id 都成功、
 *   客人随便改房主的文档）—— 而真数据库的权限是「修改本人数据」。
 *   测试绿、真机上天梯从来没成功过一次，根子就在这里：
 *   > 桩要照着真货的能力做，不能照着"我需要什么"做。
 *   现在的假数据库：_id 唯一、只能改/删自己建的文档、值没变 updated:0。
 *
 * 覆盖的合同：
 *   ① 同一个种子在任何设备上给出同一批词（否则两人做的题不一样）
 *   ② 两人同时抢同一间房，**有且只有一个**成功，另一个收到明确提示（房主确认后才算进）
 *   ③ 心跳过期 / 旧版本的房不再被列出；同账号别的设备开的房要数出来提醒
 *   ④ 离房语义：等确认时退出 → 座位收回、下一个人能进；死座位 → 换轮次；
 *      房主没开打就走 = 删房；开打后走 = 标 done 留给客人读结果
 *   ⑤ 交卷双方齐了才判胜负，先交的人处于 waiting；房主先打完走了客人照样拿到结果
 *   ⑥ 失败一律可读，并带 kind（network/expired/config…）；真实传输层会查 r.code
 *   ⑦ 绝不自建云端实例——必须走 HansenAuth.ensureSession + _app
 *   ⑧ 文档里没有手机号/用户名；名字是资料里的真名字
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
const R = '/home/claude/work/repo/';
console.log('在线对战 · 房间匹配 v1065（v1164 新存储）');

const src = fs.readFileSync(R + 'hansen_pk_room_v1065.js', 'utf8');
const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ── 假云数据库：行为对齐 CloudBase「读取全部数据，修改本人数据」──
   ① _id 唯一：重复 add 被拒（真传输层把 {code} 变成抛错，这里直接抛）
   ② 谁建的文档只有谁能改/删（别人改 → updated:0，和真机 legacy 权限一样）
   ③ 值没变时 updated:0（MongoDB 语义） */
function fakeCloud() {
  const docs = new Map();
  const clone = o => JSON.parse(JSON.stringify(o));
  const dup = () => Object.assign(new Error('E11000 duplicate key error: _id'),
    { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
  const writes = [];
  return {
    docs, writes,
    as(uid) {
      return {
        add: async d => {
          const id = d._id || ('auto' + docs.size);
          writes.push({ uid, op: 'add', id });
          if (docs.has(id)) throw dup();
          docs.set(id, { ...clone(d), _id: id, _openid: uid });
          return { id };
        },
        read: async id => (docs.has(id) ? clone(docs.get(id)) : null),
        patch: async (id, data) => {
          writes.push({ uid, op: 'patch', id });
          const d = docs.get(id);
          if (!d || d._openid !== uid) return { updated: 0 };
          const n = { ...d, ...clone(data) };
          const ch = JSON.stringify(n) !== JSON.stringify(d);
          docs.set(id, n);
          return { updated: ch ? 1 : 0 };
        },
        remove: async id => {
          writes.push({ uid, op: 'remove', id });
          const d = docs.get(id);
          if (!d || d._openid !== uid) return { deleted: 0 };
          docs.delete(id);
          return { deleted: 1 };
        },
        list: async q => [...docs.values()].filter(d => Object.keys(q || {}).every(k => d[k] === q[k])).slice(0, 50).map(clone),
        listOpen: async () => [...docs.values()]
          .filter(d => d.status === 'open' && d.isPrivate === false)
          .sort((a, b) => b.createdAt - a.createdAt).slice(0, 40).map(clone)
      };
    }
  };
}

/* 0 → 'aa'、1 → 'ab' …：编号换成字母，词仍然唯一 */
function LETTERS(i) { return String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26)); }

function mkCtx(who, extraLocal) {
  const win = {
    /* 真词库的词只有字母（外加少数带空格/连字符的词组）—— 假词库也照这个样子：
       纯字母的 80 个，外加两个对战键盘打不出来的词组（数据层必须跳过它们） */
    HANSEN_VOCAB_ALL: {
      wordIslandFood: Array.from({ length: 40 }, (_, i) => ({ en: 'food' + LETTERS(i), cn: '食' + i }))
        .concat([{ en: 'ice cream', cn: '冰淇淋' }, { en: 'T-shirt', cn: 'T恤' }]),
      wordIslandAnimal: Array.from({ length: 40 }, (_, i) => ({ en: 'ani' + LETTERS(i), cn: '兽' + i }))
    },
    /* 真 ensureSession 成功时返回 {ok:true, uid} —— 假的也得给 uid */
    HansenAuth: { readLocal: () => ({ uid: who, ...(extraLocal || {}) }),
                  ensureSession: () => Promise.resolve({ ok: true, uid: who }), _app: () => Promise.resolve({}) },
    HansenSbProfile: { readProfile: () => ({ name: who + '的名字' }) },
    setInterval: () => 0, clearInterval() {}, setTimeout: (f, ms) => setTimeout(f, Math.min(ms || 0, 5)), clearTimeout,
    console, Date, Math, JSON, Object, Promise, Error, String, Number, Array, isFinite, isNaN
  };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.HansenPkRoom;
}
const tick = ms => new Promise(z => setTimeout(z, ms));
/* 🔴v1164：房主写了确认之后还要等客人「回个话」（座位上的 acked）才算开打 ——
   客人那边 joinRoom 先返回，房主的 {joined} 晚一次轮询才到。和真机一样，等它到了再断言。 */
const until = async (fn, ms = 2000) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await tick(5); return fn(); };

/* ═══ ① 同种子 → 同词表 ═══ */
{
  const A = mkCtx('userA'), B = mkCtx('userB');
  const wa = A.wordsFromSeed(123456, 10), wb = B.wordsFromSeed(123456, 10);
  ok(wa.length === 10, `取到 10 个词（实得 ${wa.length}）`);
  ok(JSON.stringify(wa) === JSON.stringify(wb), '★ 同一种子在两台设备上给出完全相同的词表');
  const wc = A.wordsFromSeed(999, 10);
  ok(JSON.stringify(wa) !== JSON.stringify(wc), '不同种子给出不同词表（不是常量）');
  ok(new Set(wa.map(w => w.en)).size === wa.length, '同一局内不重复出词');
  /* 🔴v1164：对战键盘只有 26 个字母 —— 带空格/连字符的词抽到就只能白白超时 */
  let typeableAll = true;
  for (let sd = 1; sd <= 300; sd++) {
    if (!A.wordsFromSeed(sd, 30).every(w => /^[a-zA-Z]+$/.test(w.en))) { typeableAll = false; break; }
  }
  ok(typeableAll, '300 个种子 × 30 词：抽到的词全是键盘能打出来的纯字母词（ice cream / T-shirt 不会出现）');
}

/* ═══ ② 抢房竞态：两人同时进同一间，只能有一个成功 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('host'), g1 = mkCtx('guest1'), g2 = mkCtx('guest2');
  host._setTransportForTest(cloud.as('host'));
  g1._setTransportForTest(cloud.as('guest1'));
  g2._setTransportForTest(cloud.as('guest2'));

  const made = await host.createRoom({ tier: '工蜂' });
  ok(made.ok === true, '房主开房成功');
  ok(!!made.roomId, `拿到房间号 ${made.roomId}`);
  ok(made.words.length === 10, '房主拿到本局词表');
  ok(made.mySide === 'host', '开房结果标明我是房主');

  /* 房主在等人（真协议：客人抢到座位后要房主确认才算进） */
  let hostEv = null;
  host.waitForOpponent(made.roomId, ev => { hostEv = ev; });

  /* 两个客人**同时**发起进房 */
  const [r1, r2] = await Promise.all([g1.joinRoom(made.roomId), g2.joinRoom(made.roomId)]);
  const wins = [r1, r2].filter(r => r.ok);
  const loses = [r1, r2].filter(r => !r.ok);
  ok(wins.length === 1, `★ 两人同抢一间房，有且只有一个成功（实得 ${wins.length}）`);
  ok(loses.length === 1 && loses[0].taken === true && loses[0].kind === 'taken',
     '★ 失败方明确收到"刚被别人占了"（kind=taken），不是含糊报错');
  ok(!/\[object Object\]/.test(String(loses[0].reason)), `失败原因可读："${loses[0].reason}"`);

  const room = cloud.docs.get(made.roomId);
  ok(room.status === 'playing', '房间状态已置为 playing（房主自己写的）');
  const winnerKey = (r1.ok ? 'uguest1' : 'uguest2');
  ok(room.guestId === winnerKey && room.guestId !== room.hostId, '房间里只记了一位客人，就是抢到座位的那位');
  await until(() => hostEv);
  ok(hostEv && hostEv.joined === true && hostEv.room.guestId === winnerKey, '★ 房主等到的就是抢到座位的那位');
  ok(wins[0].mySide === 'guest' && wins[0].room.hostId === 'uhost', '客人拿到合并后的房间（旧字段名照用）');
  const seats = [...cloud.docs.values()].filter(d => d.kind === 'seat');
  ok(seats.length === 1, `★ 只留下一个座位文档，没抢到的人不留孤儿（实得 ${seats.length}）`);
  ok(!cloud.writes.some(w => w.uid !== 'host' && w.id === made.roomId && w.op !== 'add'),
     '★ 客人从头到尾没碰过房主的房间文档（权限「修改本人数据」下本来也写不进去）');

  /* 房主与获胜的客人必须拿到同一批词 */
  ok(JSON.stringify(made.words) === JSON.stringify(wins[0].words), '★ 房主与客人拿到完全相同的词表');

  /* 第三个人再来 → 房已满 */
  const g3 = mkCtx('guest3'); g3._setTransportForTest(cloud.as('guest3'));
  const r3 = await g3.joinRoom(made.roomId);
  ok(r3.ok === false && r3.taken === true, '房满后第三人被明确拒绝');
}

/* ═══ ③ 列表：过期 / 旧版本的房不列；同账号别的设备的房要数出来 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('host'), other = mkCtx('other');
  host._setTransportForTest(cloud.as('host')); other._setTransportForTest(cloud.as('other'));
  const made = await host.createRoom({});
  let ls = await other.listRooms();
  ok(ls.ok && ls.rooms.length === 1, '新开的房能被别人看到');

  /* 模拟房主直接关掉页面：心跳停在 40 秒前（房主自己的文档，房主才改得动） */
  await cloud.as('host').patch(made.roomId, { heartbeatAt: Date.now() - 40000 });
  ls = await other.listRooms();
  ok(ls.rooms.length === 0, '★ 心跳过期(>30s)的房间不再展示（房主关页面来不及删房）');

  /* 旧版本客户端开的房（没有 proto:2）：协议不通，进去只会干等 → 不列 */
  await cloud.as('old').add({ _id: 'rOLD', status: 'open', isPrivate: false, hostId: '13800001111',
                              guestId: '', heartbeatAt: Date.now(), createdAt: Date.now(), mode: 'A' });
  ls = await other.listRooms();
  ok(ls.rooms.length === 0, '★ 旧版本的房不列（新旧协议不通，点进去只会干等）');

  /* 同一个账号在另一台设备开的房：自己看不到，但要数出来让界面提醒 */
  const twin = mkCtx('other'); twin._setTransportForTest(cloud.as('other'));
  await twin.createRoom({});
  ls = await other.listRooms();
  ok(ls.ok && ls.rooms.length === 0 && ls.sameAccount === 1,
     `★ 同账号别的设备开的房不列，但 sameAccount=1 让界面提醒（实得 ${ls.sameAccount}）`);
}

/* ═══ ④ 离房语义 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('hostX'), gx = mkCtx('guestX'), gy = mkCtx('guestY');
  host._setTransportForTest(cloud.as('hostX')); gx._setTransportForTest(cloud.as('guestX')); gy._setTransportForTest(cloud.as('guestY'));
  const made = await host.createRoom({});

  /* 客人抢到座位、还在等房主确认时就退出了 → 座位收回，下一个人还能进 */
  const pending = gx.joinRoom(made.roomId);
  await tick(30);
  ok([...cloud.docs.values()].some(d => d.kind === 'seat' && d.guestId === 'uguestX'), '客人先占上了座位');
  await gx.leaveRoom(made.roomId);
  const gone = await pending;
  ok(gone.ok === false && gone.cancelled === true, '★ 等确认时退出 → 进房明确失败（cancelled），不会半进半不进');
  ok(![...cloud.docs.values()].some(d => d.kind === 'seat'), '★ 退出后座位被收回（自己的文档自己删）');

  let hostEv = null;
  host.waitForOpponent(made.roomId, ev => { hostEv = ev; });
  const rejoin = await gy.joinRoom(made.roomId);
  ok(rejoin.ok === true, '★ 新的客人能进这间空出来的房');
  await until(() => hostEv);
  ok(hostEv && hostEv.joined && hostEv.room.guestId === 'uguestY', '房主等到的是新客人');

  /* 房主开打后离开 → 房间标 done 但不删（客人还要读结果） */
  await host.leaveRoom(made.roomId);
  const r1 = cloud.docs.get(made.roomId);
  ok(r1 && r1.status === 'done' && r1.endedBy === 'leave', '★ 开打后房主离开：房间标 done/leave，**不删**（客人还要读结果）');
  const og = await gy.opponentGone(made.roomId);
  ok(og.ok && og.gone === true, '★ 客人立刻知道房主走了（不用干等 60 秒）');
}
{
  /* 死座位：客人占了座位就没了动静（页面被杀、来不及收）→ 房主换下一个轮次 */
  const cloud = fakeCloud();
  const host = mkCtx('hostD'), gw = mkCtx('guestW');
  host._setTransportForTest(cloud.as('hostD')); gw._setTransportForTest(cloud.as('guestW'));
  host._setTimingForTest({ seatStaleMs: 150 });
  const made = await host.createRoom({});
  const old = Date.now() - 300000;
  await cloud.as('ghost').add({ _id: made.roomId + '_s0', proto: 2, kind: 'seat', roomId: made.roomId, epoch: 0,
    guestId: 'ughost', guestName: '幽灵', guestBeat: old, createdAt: old, left: false });
  let hostEv = null;
  host.waitForOpponent(made.roomId, ev => { hostEv = ev; });
  await tick(400);
  ok(hostEv === null, '★ 死座位（心跳早就不动了）不会被房主当成对手确认');
  /* 🔴v1164（审查 F10）：换号是随机往后跳一段 —— 陌生人预先占好 1、2、3…号座位也堵不住门 */
  const seatNo = cloud.docs.get(made.roomId).seat;
  ok(seatNo > 0, `★ 房主把座位轮次换掉了（现在是 ${seatNo}；别人的死座位删不掉，就换号）`);
  const j = await gw.joinRoom(made.roomId);
  await until(() => hostEv);
  ok(j.ok === true && hostEv && hostEv.joined && hostEv.room.guestId === 'uguestW',
     '★ 换号之后新客人照常进房');
}
{
  /* 🔴v1164（真 SDK 端到端抓到）：房主读到的座位是旧快照 —— 客人其实已经点了返回。
     房主写了确认，但座位没了：不许跟空气开打，要撤回确认、重新开门。 */
  const cloud = fakeCloud();
  const host = mkCtx('hostK'), gz = mkCtx('guestZ');
  host._setTransportForTest(cloud.as('hostK')); gz._setTransportForTest(cloud.as('guestZ'));
  const made = await host.createRoom({});
  const now = Date.now();
  /* 客人的座位（心跳刚刚）—— 不经 joinRoom，所以没人会回「acked」 */
  await cloud.as('ghostK').add({ _id: made.roomId + '_s0', proto: 2, kind: 'seat', roomId: made.roomId, epoch: 0,
    guestId: 'ughostK', guestName: '走了的人', guestBeat: now, createdAt: now, left: false });
  let hostEv = null;
  host.waitForOpponent(made.roomId, ev => { hostEv = ev; });
  await until(() => cloud.docs.get(made.roomId).guestId === 'ughostK', 1000);
  ok(cloud.docs.get(made.roomId).guestId === 'ughostK', '房主看到座位、写了确认');
  ok(hostEv === null, '★ 写了确认还不算开打：要等客人回话');
  await cloud.as('ghostK').remove(made.roomId + '_s0');   /* 客人已经走了（座位收回） */
  await until(() => cloud.docs.get(made.roomId).status === 'open', 1500);
  const R0 = cloud.docs.get(made.roomId);
  ok(hostEv === null && R0.status === 'open' && !R0.guestId && R0.seat > 0,
     `★ 座位没了 → 房主撤回确认、房间重新开门、换了座位号（status=${R0.status} guestId=${R0.guestId || '空'} seat=${R0.seat}）`);
  const j = await gz.joinRoom(made.roomId);
  await until(() => hostEv);
  ok(j.ok === true && hostEv && hostEv.joined && hostEv.room.guestId === 'uguestZ', '★ 下一个客人照常进来开打');
  const seatZ = cloud.docs.get(made.roomId + '_s' + cloud.docs.get(made.roomId).seat);
  ok(seatZ && seatZ.acked === true && seatZ._openid === 'guestZ', '客人看到确认后在自己的座位上回了话（acked）');
}
{
  /* 写了确认之后客人一直不回话、心跳也不动（页面被杀）→ 过了死座位的时限同样撤回 */
  const cloud = fakeCloud();
  const host = mkCtx('hostS');
  host._setTransportForTest(cloud.as('hostS'));
  host._setTimingForTest({ seatStaleMs: 200 });
  const made = await host.createRoom({});
  const now = Date.now();
  await cloud.as('mute').add({ _id: made.roomId + '_s0', proto: 2, kind: 'seat', roomId: made.roomId, epoch: 0,
    guestId: 'umute', guestName: '不说话', guestBeat: now, createdAt: now, left: false });
  let hostEv = null;
  host.waitForOpponent(made.roomId, ev => { hostEv = ev; });
  await until(() => cloud.docs.get(made.roomId).seat > 0, 2000);
  const R1 = cloud.docs.get(made.roomId);
  ok(hostEv === null && R1.status === 'open' && !R1.guestId && R1.seat > 0,
     `★ 确认后客人始终没回话 → 撤回、重新开门（status=${R1.status} seat=${R1.seat}）`);
  host._setTimingForTest({ seatStaleMs: 20000 });
}
{
  /* 房主还没等到人就走 = 删房 */
  const cloud = fakeCloud();
  const host = mkCtx('hostL'); host._setTransportForTest(cloud.as('hostL'));
  const made = await host.createRoom({});
  await host.leaveRoom(made.roomId);
  ok(!cloud.docs.has(made.roomId), '★ 没人进来时房主离房 = 房间被删除，不留幽灵房');
}

/* ═══ ⑤ 交卷：两边齐了才判胜负 ═══ */
async function pair(hn, gn) {
  const cloud = fakeCloud();
  const host = mkCtx(hn), guest = mkCtx(gn);
  host._setTransportForTest(cloud.as(hn)); guest._setTransportForTest(cloud.as(gn));
  const made = await host.createRoom({ mode: 'A' });
  let ev = null;
  host.waitForOpponent(made.roomId, (e) => { ev = e; });
  const j = await guest.joinRoom(made.roomId);
  await until(() => ev);   /* 房主也确认开打了，才算两人都进了对战屏 */
  return { cloud, host, guest, made, j };
}
{
  const { host, guest, made, j } = await pair('h2', 'g2b');
  ok(j.ok, '双人进房');
  const first = await host.reportResult(made.roomId, 80);
  ok(first.ok === true && first.waiting === true, '先交卷的一方处于等待状态，不提前判负');

  const second = await guest.reportResult(made.roomId, 95);
  ok(second.ok === true && second.waiting === false, '双方齐了才出结果');
  ok(second.result === 'win', `高分方判胜（${second.mine} vs ${second.theirs}）`);

  const hostView = await host.reportResult(made.roomId, 80);
  ok(hostView.result === 'lose', '★ 同一局在两边看到互补的结论（一方胜则另一方负）');
}
{
  /* 房主先打完、交卷、离开 —— 客人后交卷照样拿到结果（以前房主一走就删房） */
  const { cloud, host, guest, made } = await pair('h3', 'g3');
  await host.reportResult(made.roomId, 300);
  await host.leaveRoom(made.roomId);
  ok(cloud.docs.has(made.roomId), '★ 房主打完离开后房间还在（延后清理）');
  ok(cloud.docs.get(made.roomId).endedBy === 'finished', '房主是打完走的（endedBy=finished），不是逃跑');
  const og = await guest.opponentGone(made.roomId);
  ok(og.ok && og.gone === false, '★ 房主交了卷再走 ≠ 逃跑，客人不会白捡「对手离场」');
  const r = await guest.reportResult(made.roomId, 200);
  ok(r.ok && r.waiting === false && r.result === 'lose' && r.theirs === 300,
     `★ 客人后交卷也拿到真实结果（${r.mine}:${r.theirs} ${r.result}）`);
}

/* ═══ ⑥ 失败一律可读，并带 kind ═══ */
{
  const m = mkCtx('userZ');
  m._setTransportForTest({
    add: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    listOpen: () => Promise.reject({ error: 'unauthenticated', error_description: 'credentials not found' }),
    patch: () => Promise.resolve({ updated: 1 }), remove: () => Promise.resolve({}), read: () => Promise.resolve(null),
    list: () => Promise.resolve([])
  });
  const made = await m.createRoom({});
  ok(made.ok === false, '会话失效时开房明确失败');
  ok(!/\[object Object\]/.test(String(made.reason)), `开房失败原因可读："${made.reason}"`);
  ok(/credentials not found/.test(made.reason), '挖出了云端的真实错因（在 ⟨⟩ 里）');
  ok(made.kind === 'expired' && made.expired === true, '★ kind=expired —— 界面才知道该去登录，而不是说"连不上网络"');
  const ls = await m.listRooms();
  ok(ls.ok === false && Array.isArray(ls.rooms) && ls.rooms.length === 0, '列房失败时返回空列表而非崩溃');
}
{
  /* 断网：SDK 的原话是 network request error（以前没被认出来） */
  const m = mkCtx('userN');
  let calls = 0;
  m._setTransportForTest({ listOpen: () => { calls++; return Promise.reject(new Error('network request error')); },
    read: async () => null, add: async () => ({}), patch: async () => ({}), remove: async () => ({}), list: async () => [] });
  const ls = await m.listRooms();
  ok(ls.ok === false && ls.kind === 'network' && /连不上网络/.test(ls.reason) && /network request error/.test(ls.reason),
     `★ "network request error" → kind=network，原话留在 ⟨⟩：${ls.reason}`);
  ok(calls === 3, `断网时读类自动重试两次（共 ${calls} 次）`);
  ok(m.kindOf(ls.reason) === 'network' && m.kindOf(ls) === 'network', 'kindOf 认得结果对象，也认得 reason 字符串');
}
{
  /* 会话还没好（有凭证但 SDK 还没落定）≠ 没登录 */
  const m = mkCtx('userS');
  m._setTransportForTest(fakeCloud().as('userS'));
  const ctxAuth = { readLocal: () => ({}), ensureSession: () => Promise.resolve({ ok: false, notReady: true, reason: '云端会话尚未就绪（已重试 5 次），请稍候再试' }), _app: () => Promise.resolve({}) };
  const m2 = (() => {
    const win = { HansenAuth: ctxAuth, HANSEN_VOCAB_ALL: { a: [{ en: 'cat', cn: '猫' }] }, setInterval: () => 0, clearInterval() {},
      setTimeout, clearTimeout, console, Date, Math, JSON, Object, Promise, Error, String, Number, Array, isFinite, isNaN };
    win.window = win; vm.createContext(win); vm.runInContext(src, win); return win.HansenPkRoom;
  })();
  const ls = await m2.listRooms();
  ok(ls.ok === false && ls.kind === 'session' && ls.expired === false,
     `★ 会话尚未就绪 → kind=session（稍后重试），不是"去登录"：${ls.reason}`);
  const win3 = { HansenAuth: { readLocal: () => ({}), ensureSession: () => Promise.resolve({ ok: false, reason: 'not-signed-in' }), _app: () => Promise.resolve({}) },
    HANSEN_VOCAB_ALL: { a: [{ en: 'cat', cn: '猫' }] }, setInterval: () => 0, clearInterval() {}, setTimeout, clearTimeout,
    console, Date, Math, JSON, Object, Promise, Error, String, Number, Array, isFinite, isNaN };
  win3.window = win3; vm.createContext(win3); vm.runInContext(src, win3);
  const c3 = await win3.HansenPkRoom.createRoom({});
  ok(c3.ok === false && c3.kind === 'expired', `★ 没登录 → kind=expired：${c3.reason}`);
}
{
  /* 真实传输层：SDK 遇到权限/集合问题是 resolve 一个 {code}，必须查出来 */
  function sdkDb(code) {
    const r = () => Promise.resolve({ code, message: code === 'DATABASE_PERMISSION_DENIED' ? 'Permission denied' : 'Db or Table not exist', requestId: 'rq1' });
    const q = { where: () => q, orderBy: () => q, limit: () => q, get: r };
    /* 真 SDK 的 db 带 command（gt / in …）—— 假的也得有，查询条件里会用到 */
    const command = { gt: (x) => ({ $gt: x }), lt: (x) => ({ $lt: x }), in: (x) => ({ $in: x }) };
    return { command, collection: () => ({ where: () => q, limit: () => q, add: r, doc: () => ({ get: r, update: r, remove: r }) }) };
  }
  for (const [code, want] of [['DATABASE_PERMISSION_DENIED', /权限/], ['DATABASE_COLLECTION_NOT_EXIST', /还没有建/]]) {
    const m = mkCtx('userC');
    m._setDbForTest(sdkDb(code));
    const ls = await m.listRooms();
    ok(ls.ok === false && ls.kind === 'config' && /hansen_pk_rooms/.test(ls.reason) && want.test(ls.reason) && ls.reason.includes(code),
       `★ 云端回 {code:${code}} → kind=config，说清是哪个集合、哪里不对：${ls.reason.slice(0, 60)}…`);
    const cr = await m.createRoom({});
    ok(cr.ok === false && cr.kind === 'config', `★ 开房也查 r.code（以前当成功，界面说"房开好了"）`);
  }
}

/* ═══ ⑦ 静态合同 ═══ */
{
  ok(/ensureSession/.test(codeOnly), '★ 云端访问经过 ensureSession（真实会话探测）');
  ok(/HansenAuth\._app|A\._app\(\)/.test(codeOnly), '★ 复用账号的 CloudBase 实例');
  ok(!/cloudbase\.init|signInAnonymously|vendor_cloudbase/.test(codeOnly),
     '★ 绝不自建实例、不自行 import SDK（v1028/v1059 两次事故的成因）');
  ok(/_setTransportForTest/.test(codeOnly), '★ 保留传输层注入口，云端逻辑可在本地验证');
  const joinBody = codeOnly.slice(codeOnly.indexOf('function joinRoom'), codeOnly.indexOf('function startHeartbeat'));
  ok(/claim\(seat\)/.test(joinBody), '★ 进房 = 用固定 _id 的 add 抢座位（claim）');
  const cl = codeOnly.slice(codeOnly.indexOf('function claim('), codeOnly.indexOf('function claim(') + 1500);
  ok(/T\(\)\.add\(/.test(cl) && /T\(\)\.read\(/.test(cl) && /nonce/.test(cl),
     '★ 抢占失败后按 _id 读回、看 nonce 判定（重复 _id 的报错文本没人见过，不能只信 add）');
  ok(!/\.where\([^)]*\)\s*\.update\(/.test(codeOnly), '★ 没有 where().update()（基础权限下客户端批量更新会被拒）');
  const rt = codeOnly.slice(codeOnly.indexOf('function realTransport'), codeOnly.indexOf('var NET_TIMEOUT_MS'));
  ok((rt.match(/chk\('/g) || []).length >= 6, '★ 真实传输层每个操作都查 r.code（chk）');
}

/* ═══ ⑧ 隐私与名字 ═══ */
{
  const cloud = fakeCloud();
  const host = mkCtx('h8', { phone: '13800001111', username: 'kid_h8' });
  const guest = mkCtx('g8', { phone: '13900002222', username: 'kid_g8' });
  host._setTransportForTest(cloud.as('h8')); guest._setTransportForTest(cloud.as('g8'));
  const made = await host.createRoom({ mode: 'A' });
  host.waitForOpponent(made.roomId, () => {});
  await guest.joinRoom(made.roomId);
  const all = JSON.stringify([...cloud.docs.values()]);
  ok(!/13800001111|13900002222|kid_h8|kid_g8/.test(all),
     '★ 所有人都能读的房间集合里**没有手机号、没有用户名**（身份键是 u+uid）');
  const r = cloud.docs.get(made.roomId);
  ok(r.hostId === 'uh8' && r.hostName === 'h8的名字' && r.guestName === 'g8的名字',
     `★ 名字是资料里的真名字（以前人人都叫「无名蜂」）：${r.hostName} / ${r.guestName}`);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
