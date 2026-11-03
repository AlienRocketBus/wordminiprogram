/* test_room_match_v1135.mjs —— 房间匹配的六条规则
 *
 * 🔴 挑刺挑出六个问题，其中第一个会让公开房间**完全不可用**：
 *
 *   ① 僵尸房遮住活房：旧写法是 `orderBy(createdAt desc).limit(30)` 之后
 *      才在本地滤心跳。房主关页面时房间不会被删，死房越攒越多、
 *      **攒到 30 个活房就彻底排不进那 30 条** —— 用户什么都看不到。
 *      实测模拟：50 个死房 + 2 个活房 → 看到 **0 间**。
 *   ② 死房永久留在数据库里烧存储和读次数（没有服务端定时任务可用）
 *   ③ 自己的房出现在自己的列表里 —— 点进去毫无意义
 *   ④ 满员房照样列出来 —— 点进去必然失败"这间房刚被别人占了"
 *   ⑤ 连开两次留下孤房 —— 别人点进去房主根本不在那间
 *   ⑥ 房主已跑两分钟，客人仍能"成功"进房 —— 进去对着空房干等 60 秒
 *
 * ③④⑥ 的共同点：**看得见但点了没用，比不显示更糟。**
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('房间匹配 v1135');

/* 🔴v1164：假数据库照真数据库的能力做 —— _id 唯一（重复 add 被拒）、
   只能改/删自己建的文档（「读取全部数据，修改本人数据」）。
   以前的假实现什么都让写，于是"客人去改房主的文档"在测试里一直是绿的、真机上一直不通。 */
function boot(rooms, who) {
  const me = who || 'H';
  const clone = o => JSON.parse(JSON.stringify(o));
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
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8'), ctx);
  const S = ctx.window.HansenPkRoom;
  const own = r => (r._openid || r.hostId || r.guestId || r.by) === me;
  S._setTransportForTest({
    read: async id => { const r = rooms.find(x => x._id === id); return r ? clone(r) : null; },
    patch: async (id, d) => { const r = rooms.find(x => x._id === id); if (!r || !own(r)) return { updated: 0 };
      Object.assign(r, clone(d)); return { updated: 1 }; },
    add: async d => {
      const id = d._id || ('N' + rooms.length);
      if (rooms.some(x => x._id === id)) throw Object.assign(new Error('duplicate key'), { code: 'DATABASE_DUPLICATE_WRITE', cloud: true });
      rooms.push(Object.assign(clone(d), { _id: id, _openid: me })); return { id };
    },
    list: async q => rooms.filter(r => Object.keys(q).every(k => r[k] === q[k])).map(clone),
    listOpen: async () => rooms.filter(r => r.status === 'open' && r.isPrivate === false).map(clone),
    remove: async id => { const i = rooms.findIndex(x => x._id === id); if (i < 0 || !own(rooms[i])) return { deleted: 0 };
      rooms.splice(i, 1); return { deleted: 1 }; }
  });
  S._setMeForTest({ id: me, name: me === 'H' ? '我' : me });
  return S;
}
/* 新版房间（proto:2）—— 种子数据也要长得和真的一样 */
const room = o => Object.assign({ proto: 2, kind: 'room', seat: 0, createdAt: Date.now() }, o);
const now = Date.now();

/* ①③④ 列表只留"真正能进的房" */
{
  const rooms = [
    room({ _id:'R1', status:'open', isPrivate:false, hostId:'H', guestId:'', hostName:'我的房',  heartbeatAt:now }),
    room({ _id:'R2', status:'open', isPrivate:false, hostId:'X', guestId:'G', hostName:'满员房', heartbeatAt:now }),
    room({ _id:'R3', status:'open', isPrivate:false, hostId:'Y', guestId:'', hostName:'可进的房', heartbeatAt:now }),
    room({ _id:'R4', status:'open', isPrivate:false, hostId:'Z', guestId:'', hostName:'死房',   heartbeatAt:now-120000 }),
    /* v1164：旧版本客户端开的房（没有 proto:2）—— 新旧协议不通，进去只会干等 */
    { _id:'R5', status:'open', isPrivate:false, hostId:'W', guestId:'', hostName:'旧版房', heartbeatAt:now }
  ];
  const S = boot(rooms, 'H');
  const r = await S.listRooms(); const list = r.rooms || r || [];
  ok(list.length === 1 && list[0].hostName === '可进的房',
     `★ 列表只剩真正能进的房（实得 [${list.map(x=>x.hostName).join(',')}]）`);
  ok(!list.some(x => x.hostId === 'H'), '★ 不列自己的房 —— 点进去毫无意义');
  ok(!list.some(x => x.guestId), '★ 不列满员的房 —— 点进去必然失败');
  ok(!list.some(x => (now - x.heartbeatAt) > 30000), '★ 不列心跳过期的房');
  {
    const src2 = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');
    /* v1164：判活的地方换成 roomAlive（看心跳在不在动），兜底规则不变：没有 heartbeatAt 就用 createdAt */
    ok(/num\(x\.heartbeatAt\) \|\| num\(x\.createdAt\)/.test(src2),
       '★ 本地判心跳时，老房间没有 heartbeatAt 就退回 createdAt —— ' +
       '别让它们凭空消失');
  }
}

/* ② 查询层面先滤心跳（防僵尸房遮住活房） */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  /* 🔴v1154 **推翻 v1135 这两条**。
     用户现场：「房间功能到现在根本就不能用。」

     v1135 为了"让数据库先滤死房"，往 where 里塞了
     `guestId:''` + `heartbeatAt: gt(...)`，还加了 `orderBy('heartbeatAt')`。
     三个都出了问题：
       ① **字段缺失 ≠ 空字符串** —— 数据库里 v1135 之前建的房间
          没有 `guestId` 字段，一间都匹配不上
       ② 老房间同样没有 `heartbeatAt`
       ③ `orderBy` 的字段在云开发要建索引，没建就整个查询报错
     实测模拟：云端 6 间房，用户只看到 1 间。

     改为：**查询只留每间房都有的字段**（status + isPrivate），
     其余判断放本地。把过滤下推给数据库省的那点流量，
     **不值得用"老数据全看不见"来换**。 */
  /* 🔴v1164（审查 TI-1）**又推翻一次**：v1154 不让 heartbeatAt 进查询，理由是「老房间没这个字段」。
     现在只查新协议的房（proto:2）—— 它们从建房那一刻就带 heartbeatAt，不存在字段缺失；
     而不按心跳查的代价是：orderBy 没建索引、退成「不排序取前 N 条」时，攒够 N 间死房，**活房一间都排不进来**。
     所以：心跳条件要和 proto:2 写在同一个查询里，并且窗口要宽（≥10 分钟），房主手机钟慢几分钟也查得到。 */
  const wh = [...code.matchAll(/\.where\(\{([^}]*heartbeatAt[^}]*)\}\)/g)].map(m => m[1]);
  ok(wh.length >= 1 && wh.every(c => /proto:\s*PROTO/.test(c)),
     '★ 查询里带 heartbeatAt 的地方都同时限定 proto:2（只有新协议的房才保证有这个字段）');
  const win = Number((/LIST_WINDOW_MS\s*=\s*(\d+)/.exec(code) || [])[1] || 0);
  ok(win >= 600000, `★ 心跳查询窗口够宽（${win / 60000} 分钟）—— 两台手机钟差几分钟也不会把活房漏掉`);
  ok(!/where\(\{ status: 'open', isPrivate: false, guestId: ''/.test(code),
     '★ 查询条件里**不带** guestId —— 同上，字段缺失匹配不上空字符串');
  ok(/orderBy\('createdAt'/.test(code),
     '★ 按 createdAt 排序 —— 那是每间房必有的字段');
}

/* ② 死房清理 —— 只清**自己的**剩余文档；v1164 起一次最多 10 条 */
{
  const rooms = [];
  /* 🔴v1164（审查 F8）：这些死房不是这台设备建的（同账号别的设备 / 上次打开页面留下的）——
     要 30 分钟没心跳才清：另一台手机的钟慢的话，「几分钟没心跳」其实是它正开着房在等人 */
  for (let i = 0; i < 12; i++) rooms.push(room({ _id:'D'+i, hostId:'H', status:'open', heartbeatAt: now-1860000-i*1000 }));
  rooms.push(room({ _id:'A1', hostId:'H', status:'open', heartbeatAt: now-1000 }));            /* 活的 */
  rooms.push(room({ _id:'K1', hostId:'H', status:'open', heartbeatAt: now-300000 }));          /* 5 分钟没心跳、别的设备建的：先不动 */
  rooms.push(room({ _id:'O1', hostId:'X', status:'open', heartbeatAt: now-500000 }));          /* 别人的 */
  rooms.push(room({ _id:'F1', hostId:'H', status:'done', heartbeatAt: now-20000, endedAt: now-20000 })); /* 刚打完：客人可能还在读结果 */
  const S = boot(rooms, 'H');
  const n = await S.sweepMyDeadRooms();
  const left = rooms.map(r => r._id);
  ok(n === 10, `★ 单次清理封顶 10 条（实得 ${n}）—— 清理不该拖慢列房这个高频操作`);
  ok(left.includes('O1'), '★ 不删别人的房（权限上也删不掉）');
  ok(left.includes('A1'), '★ 不删还活着的房');
  ok(left.includes('F1'), '★ 刚打完的房留着（宽限期内客人还要读结果）');
  ok(left.includes('K1'), '★ 同账号别的设备的房 5 分钟没心跳 → 不删（那台手机钟慢时它其实还活着）');
  const n2 = await S.sweepMyDeadRooms();
  ok(n2 === 2 && !rooms.some(r => /^D/.test(r._id)), `下一次把剩下的死房清完（实得 ${n2}）`);
}
{
  /* 自己的座位、回合文档也要清（过了宽限期）；别人的一律不碰 */
  const rooms = [
    { _id:'Z_s0', proto:2, kind:'seat', roomId:'Z', guestId:'H', guestBeat: now-1900000, _openid:'H' },
    { _id:'Z_s1', proto:2, kind:'seat', roomId:'Z', guestId:'H', guestBeat: now-5000, _openid:'H' },
    { _id:'Z_w0', proto:2, kind:'win', roomId:'Z', i:0, by:'H', at: now-3600000, _openid:'H' },
    { _id:'Y_w0', proto:2, kind:'win', roomId:'Y', i:0, by:'X', at: now-3600000, _openid:'X' }
  ];
  const S = boot(rooms, 'H');
  await S.sweepMyDeadRooms();
  const left = rooms.map(r => r._id);
  ok(!left.includes('Z_s0') && !left.includes('Z_w0'), '★ 过期的自己的座位、回合文档被清掉');
  ok(left.includes('Z_s1') && left.includes('Y_w0'), '★ 还新鲜的座位、别人的回合文档不动');
}

/* ⑤ 开新房前关掉自己的旧房 */
{
  const rooms = []; const S = boot(rooms, 'H');
  await S.createRoom({ mode:'C' });
  await new Promise(z => setTimeout(z, 80));
  await S.createRoom({ mode:'C' });
  await new Promise(z => setTimeout(z, 80));
  const mine = rooms.filter(r => r.hostId === 'H');
  ok(mine.length === 1, `★ 连开两次只剩 1 间（实得 ${mine.length}）—— 旧房成孤房，别人进去房主不在`);
}

/* ⑥ 房主已跑就别让人进 */
{
  const rooms = [room({ _id:'R1', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: now-120000, seed:1, wordCount:3, mode:'C' })];
  const S = boot(rooms, 'H');
  const r = await S.joinRoom('R1');
  ok(r.ok === false, '★ 房主已跑两分钟 → 拒绝进入');
  ok(/离开/.test(r.reason || ''), `★ 提示是人话：${r.reason}`);
}
{
  const rooms = [room({ _id:'R1', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: now, seed:1, wordCount:3, mode:'C' })];
  /* v1164：进房 = 抢到座位 + 房主确认，所以要有一个真在等人的房主 */
  const host = boot(rooms, 'X'); host._setTimingForTest({ waitPollMs: 40 });
  const cancelW = host.waitForOpponent('R1', () => {});
  const S = boot(rooms, 'H'); S._setTimingForTest({ ackPollMs: 20 });
  ok((await S.joinRoom('R1')).ok === true, '★ 正常的房仍然能进（没有误伤）');
  cancelW();
  const self = await boot(rooms, 'X').joinRoom('R1');
  ok(self.ok === false, '自己的房不能进');
}
{
  /* 房主没在等（页面卡住 / 旧标签页）：客人等确认超时 → 收回座位，说人话 */
  const rooms = [room({ _id:'R9', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: Date.now(), seed:1, wordCount:3, mode:'C' })];
  const S = boot(rooms, 'H'); S._setTimingForTest({ ackMs: 300, ackPollMs: 30 });
  const r = await S.joinRoom('R9');
  ok(r.ok === false && /没有回应/.test(r.reason || ''), `★ 房主不确认 → 明说"房主没有回应"：${r.reason}`);
  ok(!rooms.some(x => x.kind === 'seat'), '★ 超时后座位收回（不留孤儿座位挡住下一个人）');
}


/* ── v1136 追加 ────────────────────────────────────────── */

/* ⑦ 进别人的房之前要关掉自己开的那间 */
{
  const rooms = [room({ _id:'R0', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: Date.now(), seed:1, wordCount:3, mode:'C' })];
  const host = boot(rooms, 'X'); host._setTimingForTest({ waitPollMs: 40 });
  host.waitForOpponent('R0', () => {});
  const S = boot(rooms, 'A'); S._setTimingForTest({ ackPollMs: 20 });
  await S.createRoom({ mode:'C' });
  await new Promise(z => setTimeout(z, 60));
  const j = await S.joinRoom('R0');
  ok(j.ok === true, '进别人的房成功');
  await new Promise(z => setTimeout(z, 60));
  const mine = rooms.filter(r => r.hostId === 'A');
  ok(mine.length === 0,
     `★ 开房后又进别人的房 → 自己那间要关掉（实得剩 ${mine.length} 间）—— ` +
     `否则别人从列表点进来，房主正在别人房里打，只能干等到掉线判定`);
}

/* ⑧ 房间码要查重 */
{
  const rooms = ['AB12','CD34','EF56'].map((c,i) =>
    room({ _id:'E'+i, status:'open', isPrivate:true, code:c, hostId:'X', heartbeatAt: now }));
  const S = boot(rooms, 'A');
  const r = await S.createRoom({ mode:'C', private:true });
  const code = r.room && r.room.code;
  ok(/^[0-9A-Z]{4}$/.test(code || ''), `★ 私密房有 4 位码（${code}）`);
  ok(!['AB12','CD34','EF56'].includes(code),
     '★ 不与已有的码重复 —— 撞了的后果是"朋友输了码，进的却是陌生人的房"');
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');
  ok(/pickCode/.test(src), '★ 生成后查一次重，撞了重来');
}

/* ⑨ 公开房不该有码 */
{
  const rooms = []; const S = boot(rooms, 'A');
  const r = await S.createRoom({ mode:'C' });
  ok(!r.room.code, '★ 公开房没有码');
}


/* ── v1137 追加：等待屏 ────────────────────────────────── */

/* ⑩ 轮询间隔递增（省云端读次数） */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');
  ok(/function nextDelay/.test(src),
     '★ 轮询间隔递增 —— 固定 2 秒等满 2 分钟要 60 次云端读，递增后约 31 次');
  ok(/fails >= 3/.test(src),
     '★ 连续失败 3 次才报错 —— 手机网络瞬断很常见，抖一下不该把人踢出等待');
}

/* ⑪ 等待过程的行为 */
{
  /* v1164：对手是真的「抢座位」进来的（客人写不了房主的文档） */
  const rooms = [room({ _id:'W1', status:'open', isPrivate:false, hostId:'H', guestId:'', heartbeatAt: Date.now(), seed:1, wordCount:3, mode:'C' })];
  const S = boot(rooms, 'H');
  let got = null;
  const cancel = S.waitForOpponent('W1', ev => { got = ev; }, 20000);
  let jr = null;
  setTimeout(() => { boot(rooms, 'G').joinRoom('W1').then(r => { jr = r; }); }, 2500);
  await new Promise(z => setTimeout(z, 5500));
  cancel();
  ok(got && got.joined === true && got.room.guestId === 'G', '★ 对手 2.5 秒后进来能被发现');
  ok(jr && jr.ok === true, '★ 客人那边也确认进来了（房主写了确认）');
}

/* ── v1164 追加：天梯两个人同时开房 → 按「先开的赢」收敛到同一间 ── */
{
  const rooms = [];
  const A = boot(rooms, 'A'), B = boot(rooms, 'B');
  [A, B].forEach(m => m._setTimingForTest({ waitPollMs: 30, ackPollMs: 20 }));
  const ra = await A.createRoom({ mode:'A', hostRating: 1000 });
  await new Promise(z => setTimeout(z, 5));
  const rb = await B.createRoom({ mode:'A', hostRating: 1050 });
  const lad = (r) => ({ ladder: { rating: r, band: () => 200 } });
  let ea = null, eb = null;
  A.waitForOpponent(ra.roomId, ev => { ea = ev; }, 20000, lad(1000));
  B.waitForOpponent(rb.roomId, ev => { eb = ev; }, 20000, lad(1050));
  await new Promise(z => setTimeout(z, 400));
  ok(eb && eb.switchTo === ra.roomId, `★ 后开房的 B 被告知去进更早的那间（switchTo=${eb && eb.switchTo}）`);
  ok(ea === null, '★ 先开房的 A 不动，继续等 —— 两个人不会互相跳来跳去');
  const j = await B.joinRoom(eb.switchTo);
  await new Promise(z => setTimeout(z, 100));
  ok(j.ok === true && ea && ea.joined === true && ea.room.guestId === 'B', '★ B 进了 A 的房，A 等到了 B');
  ok(!rooms.some(r => r._id === rb.roomId), '★ B 自己那间被收掉（不留幽灵房）');
}
{
  /* 同一毫秒开房（createdAt 完全相同）→ 按 _id 小的赢，两边结论一致 */
  const t = Date.now();
  const rooms = [
    room({ _id:'rTIEa', status:'open', isPrivate:false, hostId:'A', guestId:'', mode:'A', hostRating: 1000, heartbeatAt: t, createdAt: t, seed:1, wordCount:3 }),
    room({ _id:'rTIEb', status:'open', isPrivate:false, hostId:'B', guestId:'', mode:'A', hostRating: 1000, heartbeatAt: t, createdAt: t, seed:1, wordCount:3 })
  ];
  const A = boot(rooms, 'A'), B = boot(rooms, 'B');
  [A, B].forEach(m => m._setTimingForTest({ waitPollMs: 30 }));
  let ea = null, eb = null;
  const lad = { ladder: { rating: 1000, band: () => 100 } };
  const ca = A.waitForOpponent('rTIEa', ev => { ea = ev; }, 20000, lad);
  const cb = B.waitForOpponent('rTIEb', ev => { eb = ev; }, 20000, lad);
  await new Promise(z => setTimeout(z, 300));
  ca(); cb();
  ok(ea === null && eb && eb.switchTo === 'rTIEa', `★ 同一毫秒开房 → _id 大的去进 _id 小的（A=${JSON.stringify(ea)} B→${eb && eb.switchTo}）`);
}
{
  /* 分差太大、不是抢答赛、私密房 —— 都不能当成天梯对手 */
  const rooms = [
    room({ _id:'r0far', status:'open', isPrivate:false, hostId:'F', mode:'A', hostRating: 2000, heartbeatAt: Date.now(), createdAt: 1 }),
    room({ _id:'r0modeC', status:'open', isPrivate:false, hostId:'C', mode:'C', hostRating: 1000, heartbeatAt: Date.now(), createdAt: 1 }),
    room({ _id:'r0pri', status:'open', isPrivate:true, hostId:'P', mode:'A', hostRating: 1000, heartbeatAt: Date.now(), createdAt: 1, code:'ABCD' })
  ];
  const B = boot(rooms, 'B'); B._setTimingForTest({ waitPollMs: 30 });
  const rb = await B.createRoom({ mode:'A', hostRating: 1000 });
  let eb = null;
  const cancel = B.waitForOpponent(rb.roomId, ev => { eb = ev; }, 20000, { ladder: { rating: 1000, band: () => 150 } });
  await new Promise(z => setTimeout(z, 300));
  cancel();
  ok(eb === null, '★ 分差太大 / 非抢答赛 / 私密房都不会被当成天梯对手');
}


/* ── v1138 追加：关页面时收房 ──────────────────────────── */
{
  const ui = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_ui_v1065.js', 'utf8');
  ok(/pagehide/.test(ui),
     '★ 监听 pagehide —— 直接关标签页/切走时也要把房收掉，否则就是僵尸房的源头');
  ok(/visibilityState !== 'hidden'/.test(ui) && /30000/.test(ui),
     '★ 切后台超过 30 秒才收房 —— 只是切出去看一眼不该把房关了');
  ok(!/beforeunload/.test(ui) || /pagehide/.test(ui),
     '★ 用 pagehide 而不是只用 beforeunload（iOS Safari 上后者常常不触发）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
