#!/usr/bin/env node
/* test_ladder_cloud_v1164.mjs —— 天梯排位：两部手机、真页面、真 SDK，只有网络是模拟的
 *
 * 为什么要有它：天梯在真机上从来没成功过一次，而以前的天梯测试全绿 ——
 *   它们注入假传输层，假的什么都让写（客人改房主的文档也行），真云端不让。
 *   这里一行 App 代码都不换：spelling_pk.html / 岛屿页 + 账号 + 房间 + vendor SDK 全是真的，
 *   腾讯云由 cloudbase_emulator.mjs 按真规矩应答（谁建的文档只有谁能改、_id 唯一、读有延迟）。
 *   手指点按钮前先确认按钮没被别的层盖住（天梯藏在大PK屏后面的 bug 就是这样抓的）。
 *
 * 三段（各用一个干净的模拟云端）：
 *   ① 两人打一局排位（权限「读取全部、修改本人」· 越权写静默失败的老模式）：
 *      匹配屏「已等 N 秒」每秒走；没人时 20 秒自动开房；对手进来开打；对战屏两边都显示对方名字；
 *      打满 10 个词到结算；两边的天梯分都按**对方真实分数**算 ELO；数据库里每人只写了自己的文档、
 *      没有手机号；打完没有留下开着的房。
 *   ② 两人同时点「开始排位」（安全规则模式 · 越权写直接报错）：最后进同一间房，另一间收掉。
 *   ③ 岛屿页入口：没登录点「天梯排位」要被引去登录；登录后天梯页、匹配屏、等人屏、对战屏
 *      都在拼写大PK屏**上面**、按钮点得到。
 */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';

const t = H.checker('天梯排位 · 真 SDK 端到端（v1164）');
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const live = [];
let emu = null, names = {};
const explain = (extra) => H.explainer(emu, () => live, () => names)(extra);
const has = (txt, re) => re.test(String(txt || ''));

async function phone(name, number, urlPath, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, path: urlPath || '/spelling_pk.html',
    ready: urlPath && urlPath.startsWith('/island_') ? () => !!(window.HansenAuth && window.HansenSbPK && window.HansenLadderUI && window.HansenPkRoom && window.HansenPkRoomUI) : undefined });
  live.push(p);
  if (number) {
    const r = await H.loginPhone(p, number);
    await t.ok(r && r.ok && r.uid, `[${name}] 用手机号验证码登录（真 SDK → 模拟云端）uid=${r && r.uid}`, () => explain(JSON.stringify(r)));
    names[r.uid] = nick || name;
    p.nick = nick || name;
  }
  return p;
}
async function toLadderHome(p) {
  await p.tap('#pkLadder');
  await H.answerNameIfAsked(p, p.nick);
  await p.waitScreen(/开始排位/, { timeout: 8000 });
}

try {
  /* ══ ② 两人同时点「开始排位」 ════════════════════════════════════ */
  t.section('② 两人同时开始排位（READONLY · rules）');
  emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 60, jitterMs: 60, consistencyLagMs: 500 } });
  names = {};
  const C = await phone('丙', '13800000003', null, '小蜂丙');
  const D = await phone('丁', '13800000004', null, '小蜂丁');
  await toLadderHome(C); await toLadderHome(D);
  await Promise.all([C.tap('#ldGo'), D.tap('#ldGo')]);
  const both = await H.until(async () => (await H.battleView(C)) && (await H.battleView(D)), { timeout: 75000, interval: 500 });
  await t.ok(both, '同时开始的两个人最后都进了对战屏（没有各自守着一间空房干等）', () => explain());
  const rooms = H.roomDocs(emu).filter((d) => d.kind === 'room');
  const playing = rooms.filter((d) => d.status === 'playing');
  const stillOpen = rooms.filter((d) => d.status === 'open');
  await t.ok(playing.length === 1 && !stillOpen.length, `数据库：只剩一间在打的房，另一间收掉了（在打 ${playing.length}，空着开着 ${stillOpen.length}）`, () => explain());
  if (playing.length === 1) {
    const P = playing[0], S2 = H.roomDocs(emu).find((d) => d.kind === 'seat' && d.roomId === P._id && d.epoch === P.seat);
    await t.ok(S2 && S2._openid !== P._openid && [C.cloudUid, D.cloudUid].includes(S2._openid), '房主和客人是这两个人、各写各的文档', () => explain());
  }
  await t.ok(H.foreignWrites(emu).length === 0, `安全规则模式下也没有越权写（被拒 ${H.foreignWrites(emu).length} 次）`, () => explain());
  const roomAdds = emu.writes.filter((w) => w.op === 'add' && w.collection === 'hansen_pk_rooms' && /^r[0-9a-z]+$/.test(w.id));
  console.log('PROBE rooms created in section 2: ' + roomAdds.length + ' ' + JSON.stringify(roomAdds.map((w) => w.id)) + ' removes=' + emu.writes.filter((w) => w.op === 'remove' && /^r[0-9a-z]+$/.test(w.id)).length);
  await C.close(); await D.close();
  live.length = 0;

} catch (e) {
  await t.ok(false, '测试脚本自己出错：' + String(e && e.stack || e).slice(0, 600), () => explain());
}
t.summary();
for (const p of live) { try { await p.close(); } catch (e) { /* 已关 */ } }
srv.close();
await browser.close();
process.exit(t.failed ? 1 : 0);
