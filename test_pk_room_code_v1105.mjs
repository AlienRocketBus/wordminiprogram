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

/* 🔴v1164：假数据库照真数据库的能力做 —— _id 唯一（重复 add 被拒）、
   只能改/删自己建的文档。以前的假实现什么都让写，真机上的权限问题因此一直没被测出来。 */
function boot(shared, me) {
  const rooms = shared || [];
  const uid = (me && me.id) || 'H';
  const clone = o => JSON.parse(JSON.stringify(o));
  const t = {
    read: async id => { const d = rooms.find(x => x._id === id); return d ? clone(d) : null; },
    patch: async (id, p) => { const d = rooms.find(x => x._id === id); if (!d || d._openid !== uid) return { updated: 0 }; Object.assign(d, clone(p)); return { updated: 1 }; },
    add: async d => {
      const id = d._id || ('R' + rooms.length);
      if (rooms.some(x => x._id === id)) throw Object.assign(new Error('duplicate key'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
      rooms.push(Object.assign(clone(d), { _id: id, _openid: uid })); return { id };
    },
    list: async w => rooms.filter(x => Object.keys(w || {}).every(k => x[k] === w[k])).map(clone),
    listOpen: async () => rooms.filter(x => x.status === 'open' && x.isPrivate === false).map(clone),
    remove: async id => { const i = rooms.findIndex(x => x._id === id && x._openid === uid); if (i >= 0) rooms.splice(i, 1); return { deleted: i >= 0 ? 1 : 0 }; }
  };
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {}, isFinite, isNaN,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  /* 🔴v1158：**沙箱里也要有词库。**
     v1158 起 createRoom 会先探一次词表，取不到就拒绝建房
     （防止"房建起来了、一开打就秒结束"——那正是用户报的 bug）。
     沙箱环境没有 vocab_all.js，所以这里手动放几个词进去，
     否则这些测试会因为"没词不许建房"而红，
     而那不是它们要测的东西。 */
  ctx.HANSEN_VOCAB_ALL = { t: [
    { en: 'cat', cn: '猫' }, { en: 'dog', cn: '狗' }, { en: 'sun', cn: '太阳' },
    { en: 'red', cn: '红色' }, { en: 'run', cn: '跑' }, { en: 'big', cn: '大的' },
    { en: 'eye', cn: '眼睛' }, { en: 'cup', cn: '杯子' }, { en: 'box', cn: '盒子' },
    { en: 'map', cn: '地图' }, { en: 'sky', cn: '天空' }, { en: 'egg', cn: '鸡蛋' }] };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest(t); S._setMeForTest(me || { id: 'H', name: '房主' });
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

/* ② 私密房不进公开列表 —— 否则"邀请"没意义
   v1164：从**第三个账号**看（房主本来就看不到自己的房，原写法恒为真） */
{
  const { S: A, rooms } = boot();
  const { S: B } = boot(rooms, { id: 'B', name: '乙' });
  const { S: F } = boot(rooms, { id: 'F', name: '朋友' });
  await A.createRoom({ mode: 'C' });
  await B.createRoom({ mode: 'A', private: true });
  const lr = await F.listRooms();
  const list = lr.rooms || [];
  ok(lr.ok && list.length === 1 && list[0].hostName === '房主', `公开房照常列出（实得 ${list.length} 间）`);
  ok(!list.some(x => x.isPrivate), '★ 私密房不出现在公开列表（否则谁都能进，邀请就没意义）');
}

/* ③ 字符集不易混淆 */
{
  const { S } = boot();
  let bad = 0;
  for (let i = 0; i < 300; i++) if (/[01OIL]/.test(S.makeCode())) bad++;
  ok(bad === 0, `★ 300 次生成都不含易混字符 0/O/1/I/L（看错就进错房）`);
}

/* ④⑤ 查码 —— 输码的是**朋友**（另一个账号），房主自己查自己的码要明说"这是你自己的房" */
{
  const { S, rooms } = boot();
  const pri = await S.createRoom({ mode: 'A', private: true });
  const code = pri.room.code;
  const { S: F } = boot(rooms, { id: 'F', name: '朋友' });
  ok((await F.findByCode(code)).ok === true, '★ 按码能找到房间');
  ok((await F.findByCode(code)).roomId === pri.roomId, '★ 找到的就是那一间');
  ok((await F.findByCode(code.toLowerCase())).ok === true, '★ 小写码也认（用户不会记得切大写）');
  ok((await F.findByCode(' ' + code + ' ')).ok === true, '★ 前后空格也认（复制粘贴常带空格）');
  const bad1 = await F.findByCode('AB');
  ok(/4 位/.test(bad1.reason || ''), `★ 位数不对提示具体：${bad1.reason}`);
  const bad2 = await F.findByCode('ZZZZ');
  ok(/没找到/.test(bad2.reason || ''), `★ 码不存在提示具体：${bad2.reason}`);
  const self = await S.findByCode(code);
  ok(self.ok === false && self.kind === 'self' && /自己账号/.test(self.reason),
     `★ 房主输自己的码 → 明说"这是你自己账号开的房"（kind=self）：${self.reason}`);
  rooms.push({ _id: 'OLD1', status: 'open', isPrivate: true, code: 'QQQQ', hostId: 'X', heartbeatAt: Date.now() });
  ok((await F.findByCode('QQQQ')).ok === false, '★ 旧版本开的私密房（没有 proto:2）不认 —— 新旧协议不通，进去只会干等');
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
