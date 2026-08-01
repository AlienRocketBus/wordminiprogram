/* test_pk_room_code_v1105.mjs —— 房间码：邀请好友来打
 *
 * 产品需求：「可以邀请自己的好友到房间里面来进行对战。」
 *
 * 🔴 我没有做「加好友」那一套（好友列表 / 申请 / 通过），理由：
 *   ① 对现在的用户量太重 —— 要维护关系表、申请状态、双向确认
 *   ② **解决不了核心问题**：你想跟谁打，通常是身边的人（同学、家人），
 *      微信里发一句话比在 App 里加好友快得多
 *
 * 做的是**房间码**：
 *   开房 → 拿到 4 位码「G9QN」→ 微信发给朋友 → 他输码直接进
 *   整个过程不需要任何账号关系，也不需要对方先注册好友。
 *
 * 合同：
 *   ① 私密房带 4 位码，公开房没有码
 *   ② **私密房不出现在公开列表**（否则"邀请"就没意义了）
 *   ③ 码用不易混淆的字符集（去掉 0/O、1/I/L —— 看错就进错房）
 *   ④ 输码大小写都认
 *   ⑤ 错码 / 位数不对，提示要具体，不能只说"失败"
 *   ⑥ 等待屏必须把码显示得最显眼，并可一键复制
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('房间码 v1105');

const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');

function boot() {
  const rooms = [];
  const t = {
    read: async id => rooms.find(x => x._id === id) || null,
    claim: async () => ({ updated: 1 }), patch: async () => ({ updated: 1 }),
    add: async d => { const doc = Object.assign({ _id: 'R' + rooms.length }, d); rooms.push(doc); return { id: doc._id }; },
    list: async w => rooms.filter(x => Object.keys(w || {}).every(k => x[k] === w[k])),
    listOpen: async () => rooms.filter(x => x.status === 'open' && x.isPrivate === false),
    remove: async () => ({})
  };
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(t); S._setMeForTest({ id: 'H', name: '房主' });
  return { S, rooms };
}

/* ① 私密房有码，公开房没有 */
{
  const { S } = boot();
  const pub = await S.createRoom({ mode: 'C' });
  const pri = await S.createRoom({ mode: 'A', private: true });
  ok(!pub.room.code, '★ 公开房没有码');
  ok(/^[0-9A-Z]{4}$/.test(pri.room.code), `★ 私密房有 4 位码（${pri.room.code}）`);
  ok(pri.room.isPrivate === true, '私密房标记正确');
}

/* ② 私密房不进公开列表 —— 否则"邀请"没意义 */
{
  const { S } = boot();
  await S.createRoom({ mode: 'C' });
  await S.createRoom({ mode: 'A', private: true });
  const lr = await S.listRooms();
  const list = lr.rooms || lr || [];
  ok(!list.some(x => x.isPrivate), '★ 私密房不出现在公开列表（否则谁都能进，邀请就没意义）');
}

/* ③ 字符集不易混淆 */
{
  const { S } = boot();
  let bad = 0;
  for (let i = 0; i < 300; i++) if (/[01OIL]/.test(S.makeCode())) bad++;
  ok(bad === 0, `★ 300 次生成都不含易混字符 0/O/1/I/L（看错就进错房）`);
}

/* ④⑤ 查码 */
{
  const { S } = boot();
  const pri = await S.createRoom({ mode: 'A', private: true });
  const code = pri.room.code;
  ok((await S.findByCode(code)).ok === true, '★ 按码能找到房间');
  ok((await S.findByCode(code.toLowerCase())).ok === true, '★ 小写码也认（用户不会记得切大写）');
  ok((await S.findByCode(' ' + code + ' ')).ok === true, '★ 前后空格也认（复制粘贴常带空格）');
  const bad1 = await S.findByCode('AB');
  ok(/4 位/.test(bad1.reason || ''), `★ 位数不对提示具体：${bad1.reason}`);
  const bad2 = await S.findByCode('ZZZZ');
  ok(/没找到/.test(bad2.reason || ''), `★ 码不存在提示具体：${bad2.reason}`);
}

/* ⑥ 界面 */
{
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/prCodeBig/.test(ui), '★ 等待屏把码显示得最显眼');
  ok(/font-size:44px/.test(ui), '★ 码是大字号（要一眼看见才好念给朋友听）');
  ok(/prCopy/.test(ui), '★ 有一键复制');
  ok(/navigator\.clipboard/.test(ui) && /长按/.test(ui),
     '★ 复制失败有退路（微信内置浏览器常拿不到剪贴板权限，不能只弹"失败"）');
  ok(/prJoinCode/.test(ui) && /prCode/.test(ui), '★ 房间列表有输码进房入口');
  ok(/toUpperCase/.test(ui), '★ 输入自动转大写');
  ok(/开私密房|私密房，邀请好友/.test(ui), '★ 有"开私密房邀请好友"的按钮');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
