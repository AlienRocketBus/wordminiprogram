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

function boot(rooms) {
  const ctx = { window: {}, document: { addEventListener() {} }, console, Date, Math, JSON,
    Promise, Error, String, Number, Array, Object, setTimeout, clearTimeout,
    setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8'), ctx);
  const S = ctx.window.HansenPkRoom;
  S._setTransportForTest({
    read: async id => rooms.find(r => r._id === id) || null,
    claim: async (id, g, p) => { const r = rooms.find(x => x._id === id); if (!r) return { updated: 0 };
      for (const k of Object.keys(g)) if (r[k] !== g[k]) return { updated: 0 };
      Object.assign(r, p); return { updated: 1 }; },
    patch: async (id, d) => { const r = rooms.find(x => x._id === id); if (r) Object.assign(r, d); return { updated: 1 }; },
    add: async d => { const doc = Object.assign({ _id: 'N' + rooms.length }, d); rooms.push(doc); return { id: doc._id }; },
    list: async q => rooms.filter(r => Object.keys(q).every(k => r[k] === q[k])),
    listOpen: async () => { const now = Date.now();
      return rooms.filter(r => r.status === 'open' && r.isPrivate === false && (now - (r.heartbeatAt || 0)) < 30000); },
    remove: async id => { const i = rooms.findIndex(x => x._id === id); if (i >= 0) rooms.splice(i, 1); return true; }
  });
  return S;
}
const now = Date.now();

/* ①③④ 列表只留"真正能进的房" */
{
  const rooms = [
    { _id:'R1', status:'open', isPrivate:false, hostId:'H', guestId:'', hostName:'我的房',  heartbeatAt:now },
    { _id:'R2', status:'open', isPrivate:false, hostId:'X', guestId:'G', hostName:'满员房', heartbeatAt:now },
    { _id:'R3', status:'open', isPrivate:false, hostId:'Y', guestId:'', hostName:'可进的房', heartbeatAt:now },
    { _id:'R4', status:'open', isPrivate:false, hostId:'Z', guestId:'', hostName:'死房',   heartbeatAt:now-120000 }
  ];
  const S = boot(rooms); S._setMeForTest({ id:'H', name:'我' });
  const r = await S.listRooms(); const list = r.rooms || r || [];
  ok(list.length === 1 && list[0].hostName === '可进的房',
     `★ 列表只剩真正能进的房（实得 [${list.map(x=>x.hostName).join(',')}]）`);
  ok(!list.some(x => x.hostId === 'H'), '★ 不列自己的房 —— 点进去毫无意义');
  ok(!list.some(x => x.guestId), '★ 不列满员的房 —— 点进去必然失败');
  ok(!list.some(x => (now - x.heartbeatAt) > 30000), '★ 不列心跳过期的房');
}

/* ② 查询层面先滤心跳（防僵尸房遮住活房） */
{
  const src = fs.readFileSync('/home/claude/work/repo/hansen_pk_room_v1065.js', 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/heartbeatAt:\s*d\.command\.gt\(/.test(code),
     '★ 查询条件里就带心跳下限 —— 让数据库先滤死房，而不是取回 30 条再本地滤');
  ok(/orderBy\('heartbeatAt'/.test(code),
     '★ 按 heartbeatAt 排序（最近还活着的优先），而不是按 createdAt');
}

/* ② 死房清理 */
{
  const rooms = [
    { _id:'D1', hostId:'H', heartbeatAt: now-500000 },
    { _id:'D2', hostId:'H', heartbeatAt: now-300000 },
    { _id:'A1', hostId:'H', heartbeatAt: now-1000 },      /* 活的 */
    { _id:'O1', hostId:'X', heartbeatAt: now-500000 },    /* 别人的 */
    { _id:'D3', hostId:'H', heartbeatAt: now-400000 },
    { _id:'D4', hostId:'H', heartbeatAt: now-450000 }
  ];
  const S = boot(rooms); S._setMeForTest({ id:'H', name:'我' });
  const n = await S.sweepMyDeadRooms();
  const left = rooms.map(r => r._id);
  ok(n <= 3, `★ 单次清理封顶 3 条（实得 ${n}）—— 清理不该拖慢列房这个高频操作`);
  ok(left.includes('O1'), '★ 不删别人的房（权限上也删不掉）');
  ok(left.includes('A1'), '★ 不删还活着的房');
}

/* ⑤ 开新房前关掉自己的旧房 */
{
  const rooms = []; const S = boot(rooms); S._setMeForTest({ id:'H', name:'我' });
  await S.createRoom({ mode:'C' });
  await new Promise(z => setTimeout(z, 80));
  await S.createRoom({ mode:'C' });
  await new Promise(z => setTimeout(z, 80));
  const mine = rooms.filter(r => r.hostId === 'H');
  ok(mine.length === 1, `★ 连开两次只剩 1 间（实得 ${mine.length}）—— 旧房成孤房，别人进去房主不在`);
}

/* ⑥ 房主已跑就别让人进 */
{
  const rooms = [{ _id:'R1', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: now-120000, seed:1, wordCount:3, mode:'C' }];
  const S = boot(rooms); S._setMeForTest({ id:'H', name:'我' });
  const r = await S.joinRoom('R1');
  ok(r.ok === false, '★ 房主已跑两分钟 → 拒绝进入');
  ok(/离开/.test(r.reason || ''), `★ 提示是人话：${r.reason}`);
}
{
  const rooms = [{ _id:'R1', status:'open', isPrivate:false, hostId:'X', guestId:'',
                   heartbeatAt: now, seed:1, wordCount:3, mode:'C' }];
  const S = boot(rooms); S._setMeForTest({ id:'H', name:'我' });
  ok((await S.joinRoom('R1')).ok === true, '★ 正常的房仍然能进（没有误伤）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
