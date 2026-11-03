/* test_pk_abandon_v1104.mjs —— 对手掉线判负
 *
 * 产品定的规则：**对手超过 1 分钟没回来就判他负。**
 *
 * 之前的问题：对手强退/掉线/关页面，你会一直等到 10 分钟兜底 ——
 * 那不是"等待"，那是把人晾在那里。
 *
 * 🔴 修之前还有个更基础的毛病：**只有房主发心跳，客人不发** ——
 * 所以房主根本检测不到客人掉线。这是个明显的不对称，改成双方各发各的。
 *
 * 为什么阈值是 1 分钟而不是更短：
 *   手机切后台、接个电话、网络抖一下都很常见，
 *   太敏感会把正常玩家误判成逃跑 —— 那比等一分钟糟得多。
 *
 * 合同：
 *   ① 双方各写各的心跳（hostBeat / guestBeat）
 *   ② 超过 ABANDON_MS 才判离场，之前一律继续等
 *   ③ 刚开局对手还没发过心跳时，用房间时间兜底，不能误判
 *   ④ 判离场后自动结算为我方胜，房间标记 endedBy='abandon'
 *   ⑤ 界面要有倒计时提示，不能让人干等着不知道发生了什么
 *   ⑥ 结算文案要说清是"对手离场"赢的，不能让人以为实打实赢了
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('对手掉线判负 v1104');

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');

/* 🔴v1164：两处跟着真实情况改了
   ① 假数据库照真数据库的能力做：房间是房主的、座位是客人的，谁建的谁才能改
      （以前一个对象答所有 id，客人"改房主的文档"在测试里永远成功）
   ② 「多久没动静」改用**本机时钟**量：记住对手心跳的值，看它多久没变。
      两台手机的时间差几分钟很常见 —— 拿对方写的时间戳和本机比，
      对方手机慢 2 分钟就会被当场判成逃跑。这里用一个可拨动的本机时钟来测。 */
const clock = { t: Date.now() };
class FakeDate extends Date { static now() { return clock.t; } }

function store() {
  const docs = new Map();
  const clone = o => JSON.parse(JSON.stringify(o));
  return {
    docs,
    as(uid) {
      return {
        read: async id => (docs.has(id) ? clone(docs.get(id)) : null),
        add: async d => { if (docs.has(d._id)) throw Object.assign(new Error('duplicate'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
          docs.set(d._id, { ...clone(d), _openid: uid }); return { id: d._id }; },
        patch: async (id, d) => { const x = docs.get(id); if (!x || x._openid !== uid) return { updated: 0 };
          docs.set(id, { ...x, ...clone(d) }); return { updated: 1 }; },
        remove: async id => { const x = docs.get(id); if (!x || x._openid !== uid) return { deleted: 0 }; docs.delete(id); return { deleted: 1 }; },
        list: async q => [...docs.values()].filter(d => Object.keys(q || {}).every(k => d[k] === q[k])).map(clone),
        listOpen: async () => []
      };
    }
  };
}

function mod(db, who, timers) {
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date: FakeDate, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout, isFinite, isNaN,
    setInterval: (timers && timers.setInterval) || (() => 0), clearInterval() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.HANSEN_VOCAB_ALL = { t: [{ en: 'cat', cn: '猫' }, { en: 'dog', cn: '狗' }, { en: 'sun', cn: '太阳' }] };   /* 没词不许建房 */
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(db.as(who)); S._setMeForTest({ id: who, name: who });
  return S;
}

/* 一局已经开打的房：房间（房主 H 的）+ 座位（客人 G 的） */
function boot(guestBeat, extra) {
  const db = store();
  const t = clock.t;
  db.docs.set('R1', Object.assign({ _id: 'R1', proto: 2, kind: 'room', _openid: 'H', hostId: 'H', guestId: 'G',
    status: 'playing', seat: 0, mode: 'A', wordCount: 3, createdAt: t - 5000, startedAt: t - 4000,
    heartbeatAt: t, hostBeat: t }, extra || {}));
  db.docs.set('R1_s0', { _id: 'R1_s0', proto: 2, kind: 'seat', _openid: 'G', roomId: 'R1', epoch: 0,
    guestId: 'G', guestBeat: guestBeat, createdAt: t - 4000 });
  const S = mod(db, 'H');
  return { S, db, doc: db.docs.get('R1') };
}
const later = ms => { clock.t += ms; };

const now = clock.t;

/* ① 阈值就是 1 分钟 */
{
  const { S } = boot(now);
  ok(S.ABANDON_MS === 60000, `★ 阈值 1 分钟（实得 ${S.ABANDON_MS / 1000}s）`);
}

/* ② 未超时一律继续等（本机时钟上对手心跳 N 秒没变） */
{
  for (const [idle, label] of [[5000, '5 秒'], [30000, '30 秒'], [59000, '59 秒']]) {
    const { S } = boot(clock.t);
    await S.opponentGone('R1');            /* 第一次看到对手心跳 */
    later(idle);
    const r = await S.opponentGone('R1');
    ok(r.ok && r.gone === false, `★ 对手 ${label}没动静 → 继续等（不误判成逃跑）`);
  }
}

/* ③ 超时才判 */
{
  const { S } = boot(clock.t);
  await S.opponentGone('R1');
  later(61000);
  const r = await S.opponentGone('R1');
  ok(r.gone === true, '★ 对手 61 秒没动静 → 判他离场');
  ok(r.idleSecs >= 60, `报告闲置秒数（${r.idleSecs}s）`);
}

/* ③b 心跳一直在动就永远不判 —— 哪怕对方手机的时间差了 10 分钟 */
{
  for (const [skew, label] of [[-600000, '慢 10 分钟'], [600000, '快 10 分钟']]) {
    const { S, db } = boot(clock.t + skew);
    let gone = false;
    for (let k = 0; k < 10; k++) {
      later(8000);
      const seat = db.docs.get('R1_s0'); seat.guestBeat = clock.t + skew;   /* 对方每 8 秒用他自己的钟写一次 */
      const r = await S.opponentGone('R1');
      if (r.gone) gone = true;
    }
    ok(!gone, `★ 对方手机时间${label}、但心跳一直在动 → 不会被判逃跑（以前拿对方时间戳和本机比）`);
  }
}

/* ④ 刚开局没心跳不能误判 */
{
  const { S } = boot(0);
  const r = await S.opponentGone('R1');
  ok(r.gone === false,
     '★ 对手还没发过心跳（刚开局）→ 从本机第一次看到算起，不能误判成"从没来过"');
}

/* ④b 对手明确离开 / 正常交卷 */
{
  const { S, db } = boot(clock.t);
  db.docs.get('R1_s0').left = true;
  const r = await S.opponentGone('R1');
  ok(r.gone === true, '★ 客人点了离开（座位标 left）→ 房主立刻知道，不用等 60 秒');
  const b2 = boot(clock.t);
  b2.db.docs.get('R1_s0').guestScore = 300;
  b2.db.docs.get('R1_s0').left = true;
  const r2 = await b2.S.opponentGone('R1');
  ok(r2.gone === false && r2.oppFinished === true, '★ 客人交了卷再走 = 正常打完，不是逃跑');
}

/* ⑤ 判离场后自动结算（只写自己的文档） */
{
  const { S, db } = boot(clock.t - 70000);
  const w = await S.claimAbandonWin('R1');
  ok(w.ok && w.result === 'win' && w.byAbandon, '★ 结算为我方胜，且标明 byAbandon');
  const doc = db.docs.get('R1');
  ok(doc.status === 'done' && doc.endedBy === 'abandon' && doc.abandonWin === 'host', '★ 房间标记 endedBy=abandon');
  ok(doc.hostScore === 1 && db.docs.get('R1_s0').guestScore == null, '★ 房主只写自己的分（客人的座位一个字没碰）');
  const st = await S.roundState('R1');
  ok(st.hostScore === 1 && st.guestScore === 0, `★ 合并后比分记为 1:0（实得 ${st.hostScore}:${st.guestScore}）`);
  /* 客人其实还在、后来交了卷 —— 两边也得是同一个结论（房主已经判了） */
  const G = mod(db, 'G');
  const gr = await G.reportResult('R1', 300);
  ok(gr.ok && gr.result === 'lose' && gr.byAbandon === true, `★ 房主判了离场后，客人那边也是同一个结论（${gr.result}），不会拿 300 分去比 1 分`);
}
{
  /* 反过来：房主跑了，客人判赢 —— 客人只写自己的座位 */
  const { db } = boot(clock.t);
  const G = mod(db, 'G');
  const w = await G.claimAbandonWin('R1');
  ok(w.ok && w.result === 'win', '★ 客人也能判对方离场');
  ok(db.docs.get('R1_s0').abandonWin === 'guest' && db.docs.get('R1_s0').guestScore === 1 && db.docs.get('R1').status === 'playing',
     '★ 客人只写自己的座位，房主的房间文档没被碰');
  const st = await G.roundState('R1');
  ok(st.guestScore === 1 && st.hostScore === 0, `★ 合并后比分 0:1（实得 ${st.hostScore}:${st.guestScore}）`);
}

/* ⑥ 双方各发各的心跳 —— 修之前只有房主发；v1164 起各写各的文档 */
{
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/hostBeat/.test(code) && /guestBeat/.test(code), '★ 房间文档有双方各自的心跳字段');
  const db = store();
  const ticks = [];
  const timers = { setInterval: (f) => { ticks.push(f); return ticks.length; } };
  const H = mod(db, 'H', timers);
  const G = mod(db, 'G', timers);
  H._setTimingForTest({ waitPollMs: 20 }); G._setTimingForTest({ ackPollMs: 10 });
  const made = await H.createRoom({ mode: 'A' });
  H.waitForOpponent(made.roomId, () => {});
  const nBefore = ticks.length;
  const j = await G.joinRoom(made.roomId);
  ok(j.ok && ticks.length > nBefore, '★ 客人加入时也启动心跳（原来只有房主发，房主根本检测不到客人掉线）');
  const seatId = made.roomId + '_s0';
  const before = { room: { ...db.docs.get(made.roomId) }, seat: { ...db.docs.get(seatId) } };
  later(9000);
  ticks[ticks.length - 1]();                    /* 客人的心跳跳一下 */
  await new Promise(z => setTimeout(z, 20));
  ok(db.docs.get(seatId).guestBeat === clock.t, '★ 客人的心跳写在自己的座位上');
  ok(db.docs.get(made.roomId).guestBeat === undefined && db.docs.get(made.roomId).hostBeat === before.room.hostBeat,
     '★ 客人的心跳不碰房主的房间文档');
  await H.markReady(made.roomId);
  later(9000);
  ticks[ticks.length - 1]();                    /* 房主的心跳跳一下 */
  await new Promise(z => setTimeout(z, 20));
  ok(db.docs.get(made.roomId).hostBeat === clock.t && db.docs.get(made.roomId).heartbeatAt === clock.t,
     '★ 房主的心跳写在自己的房间上（列表靠 heartbeatAt 判房主还在不在）');
}

/* ⑦ 界面提示与结算文案 */
{
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/checkOpponentAlive/.test(ui), '★ 对战屏定期检查对手是否还在');
  ok(/掉线了…/.test(ui), '★ 有倒计时提示（不让人干等着不知道发生了什么）');
  /* 🔴v1156 更新：文案统一成「对手已离场」了。
     原来同一件事有两种说法（差一个「已」字），
     是复制粘贴时改了一处漏了一处；
     现在由守卫「文案一致」保证只有一种写法。 */
  ok(/对手已离场，本局你胜/.test(ui),
     '★ 结算文案说清是"对手已离场"赢的，不冒充实打实赢');
  ok(/_goneChecked/.test(ui), '★ 检查有节流（不刷爆数据库）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
