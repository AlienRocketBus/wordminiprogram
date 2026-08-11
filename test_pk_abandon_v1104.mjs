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

function boot(guestBeat, extra) {
  const now = Date.now();
  const doc = Object.assign({ _id: 'R1', hostId: 'H', guestId: 'G', mode: 'A',
    round: 0, winners: [], wordCount: 3, createdAt: now, roundAt: now,
    hostBeat: now, guestBeat: guestBeat }, extra || {});
  const t = { read: async () => JSON.parse(JSON.stringify(doc)),
    claim: async (i, g, p) => { for (const k of Object.keys(g)) if (doc[k] !== g[k]) return { updated: 0 };
      Object.assign(doc, p); return { updated: 1 }; },
    patch: async (i, d) => { Object.assign(doc, d); return { updated: 1 }; },
    add: async () => ({ id: 'R1' }), list: async () => [], remove: async () => ({}) };
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(t); S._setMeForTest({ id: 'H', name: '房主' });
  return { S, doc };
}

const now = Date.now();

/* ① 阈值就是 1 分钟 */
{
  const { S } = boot(now);
  ok(S.ABANDON_MS === 60000, `★ 阈值 1 分钟（实得 ${S.ABANDON_MS / 1000}s）`);
}

/* ② 未超时一律继续等 */
{
  for (const [idle, label] of [[5000, '5 秒'], [30000, '30 秒'], [59000, '59 秒']]) {
    const { S } = boot(now - idle);
    const r = await S.opponentGone('R1');
    ok(r.gone === false, `★ 对手 ${label}没动静 → 继续等（不误判成逃跑）`);
  }
}

/* ③ 超时才判 */
{
  const { S } = boot(now - 61000);
  const r = await S.opponentGone('R1');
  ok(r.gone === true, '★ 对手 61 秒没动静 → 判他离场');
  ok(r.idleSecs >= 60, `报告闲置秒数（${r.idleSecs}s）`);
}

/* ④ 刚开局没心跳不能误判 */
{
  const { S } = boot(0);
  const r = await S.opponentGone('R1');
  ok(r.gone === false,
     '★ 对手还没发过心跳（刚开局）→ 用房间时间兜底，不能误判成"从没来过"');
}

/* ⑤ 判离场后自动结算 */
{
  const { S, doc } = boot(now - 70000);
  const w = await S.claimAbandonWin('R1');
  ok(w.ok && w.result === 'win' && w.byAbandon, '★ 结算为我方胜，且标明 byAbandon');
  ok(doc.status === 'done' && doc.endedBy === 'abandon', '★ 房间标记 endedBy=abandon');
  ok(doc.hostScore === 1 && doc.guestScore === 0, '★ 比分记为 1:0');
}

/* ⑥ 双方各发各的心跳 —— 修之前只有房主发 */
{
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/hostBeat/.test(code) && /guestBeat/.test(code), '★ 房间文档有双方各自的心跳字段');
  const i = code.indexOf('function startHeartbeat');
  const seg = code.slice(i, i + 700);
  ok(/hostId === u\.id/.test(seg) && /hostBeat/.test(seg) && /guestBeat/.test(seg),
     '★ 心跳按身份写到自己那一侧');
  const j = code.indexOf('function joinRoom');
  ok(/startHeartbeat/.test(code.slice(j, j + 2500)),
     '★ 客人加入时也启动心跳（原来只有房主发，房主根本检测不到客人掉线）');
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
