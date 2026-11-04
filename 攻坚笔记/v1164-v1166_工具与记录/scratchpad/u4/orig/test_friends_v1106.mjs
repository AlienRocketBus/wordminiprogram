/* test_friends_v1106.mjs —— 好友 · 在线状态 · 隐身 · 快捷语
 *
 * 产品定义：
 *   · 加好友后能直接约战
 *   · 可设置在线（头像亮 + 绿点）/ 隐身（对别人完全等于离线）
 *   · **只能发固定快捷语，不能打字聊天**
 *
 * 🔴 为什么不做自由聊天（用户拍板，我完全同意）：
 *   这是给孩子用的产品。自由输入意味着陌生人能给孩子发任意内容 →
 *   需要敏感词过滤、举报、拉黑、人工审核 → 合规上是另一个量级的事，
 *   而**孩子想聊天本来就有微信**。
 *
 * 合同：
 *   ① 用竞赛 ID 互加，**绝不用手机号**（那是隐私）
 *   ② 加不存在的号 / 加自己 / 重复加，都要有明确提示
 *   ③ 双向各写一条关系，删好友两边都删（单向残留会让对方以为还是好友）
 *   ④ 隐身 = 心跳抹成 0 = 对别人和离线完全一样，看不出差别
 *   ⑤ **快捷语必须在服务层校验** —— 即使改前端也发不出自定义内容
 *   ⑥ 收到未知 qid 只显示"(未知消息)"，绝不渲染原始内容
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('好友系统 v1106');

const src = fs.readFileSync('/home/claude/work/repo/hansen_friends_v1106.js', 'utf8');

function boot(shared) {
  const rows = (shared && shared.rows) || [];
  const msgs = (shared && shared.msgs) || [];
  const t = {
    read: async id => rows.find(x => x._id === id) || null,
    list: async w => rows.filter(x => Object.keys(w || {}).every(k => x[k] === w[k])),
    add: async d => { const doc = Object.assign({ _id: 'D' + rows.length + Math.random() }, d); rows.push(doc); return { id: doc._id }; },
    patch: async (id, d) => { const r = rows.find(x => x._id === id); if (r) Object.assign(r, d); return { updated: 1 }; },
    remove: async id => { const i = rows.findIndex(x => x._id === id); if (i >= 0) rows.splice(i, 1); return {}; },
    addMsg: async d => { const doc = Object.assign({ _id: 'M' + msgs.length }, d); msgs.push(doc); return { id: doc._id }; },
    listMsg: async w => msgs.filter(x => Object.keys(w || {}).every(k => x[k] === w[k]))
  };
  const store = {};
  const ctx = { window: {}, document: { addEventListener() {}, readyState: 'complete' },
    console, Date, Math, JSON, Promise, Error, String, Number, Array, Object,
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k, v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; } } };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const F = ctx.window.HansenFriends; F._setTransportForTest(t);
  return { F, rows, msgs };
}

/* ① 不用手机号 */
{
  ok(!/phone|手机号/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 好友模块代码里完全不碰手机号（那是隐私，只用公开的竞赛 ID）');
}

/* ② 加好友的各种情况 */
{
  const s = { rows: [], msgs: [] };
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  s.rows.push({ _id: 'P2', kind: 'presence', cid: 2, name: '小红', at: Date.now() });
  ok((await A.F.addFriend(999)).reason.includes('没找到'), '★ 加不存在的号 → 明确提示');
  ok((await A.F.addFriend(1)).reason === '不能加自己', '★ 不能加自己');
  const r = await A.F.addFriend(2);
  ok(r.ok && r.name === '小红', `★ 加 No.2 成功（${r.name}）`);
  ok((await A.F.addFriend(2)).reason === '已经是好友了', '★ 重复加 → 明确提示');
}

/* ③ 双向关系 */
{
  const s = { rows: [], msgs: [] };
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  s.rows.push({ _id: 'P2', kind: 'presence', cid: 2, name: '小红', at: Date.now() });
  await A.F.addFriend(2);
  /* 🔴v1114 契约变更：**不再单方面写进对方的好友表**。
     实测发现陌生人单方面就能进孩子的好友列表 —— 对儿童产品不能接受。
     改为：只写我这边(state=pending) + 给对方留一条 request；
     对方也加我时双方自动转 accepted（仍然不用手动点通过）。 */
  const mine = s.rows.filter(x => x.kind === 'friend' && x.owner === 1);
  const theirs = s.rows.filter(x => x.kind === 'friend' && x.owner === 2);
  ok(mine.length === 1, '★ 只写自己这边一条');
  ok(theirs.length === 0, '★ **不往对方好友表里塞** —— 陌生人不能单方面进孩子的列表');
  ok(mine[0].state === 'pending', '★ 标记为 pending，等对方也加我');
  ok(s.rows.some(x => x.kind === 'request' && x.from === 1 && x.to === 2),
     '★ 给对方留了一条请求记录');
  await A.F.removeFriend(2);
  const left = s.rows.filter(x => x.kind === 'friend');
  ok(left.length === 0, '★ 删好友两边都删（单向残留会让对方以为还是好友）');
}

/* ④ 隐身 */
{
  const s = { rows: [], msgs: [] };
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  ok(A.F.myStatus() === 'online', '默认在线');
  const p = s.rows.find(x => x.kind === 'presence' && x.cid === 1);
  ok(p && p.at > 0, '在线时有心跳');
  A.F.setStatus('hidden');
  await new Promise(r => setTimeout(r, 60));
  ok(A.F.myStatus() === 'hidden', '可切换到隐身');
  const p2 = s.rows.find(x => x.kind === 'presence' && x.cid === 1);
  ok(p2 && p2.at === 0, '★ 隐身后心跳抹成 0 —— 对别人和离线完全一样，看不出差别');
  await A.F._beat();
  const p3 = s.rows.find(x => x.kind === 'presence' && x.cid === 1);
  ok(p3 && p3.at === 0, '★ 隐身期间即使调 beat 也不写心跳');
}

/* ⑤ 快捷语必须服务层校验 —— 本测试最关键的一条 */
{
  const s = { rows: [], msgs: [] };
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  ok((await A.F.sendQuick(2, 'pk')).ok === true, '预设快捷语能发');
  for (const bad of ['我要自己打字', '<script>x</script>', '', null, 'PK']) {
    const r = await A.F.sendQuick(2, bad);
    ok(r.ok === false, `★ 拒绝非预设内容 ${JSON.stringify(bad)} —— 改前端也发不出打字内容`);
  }
  ok(s.msgs.every(m => !m.text),
     '★ 数据库里只存 qid 不存文本（即使被写入奇怪的值，界面也只显示"未知消息"）');
}

/* ⑥ 未知消息不渲染原始内容 */
{
  const s = { rows: [], msgs: [{ _id: 'M0', from: 9, fromName: 'X', to: 1,
                                 qid: '<img onerror=alert(1)>', at: Date.now() }] };
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  const inb = await A.F.inbox();
  ok(inb.msgs[0].text === '(未知消息)',
     '★ 未知 qid 只显示"(未知消息)"，绝不把原始内容渲染出来');
}

/* ⑦ 快捷语表本身 */
{
  const A = boot({ rows: [], msgs: [] });
  ok(A.F.QUICK.length >= 8, `★ 快捷语够用（${A.F.QUICK.length} 条）`);
  ok(A.F.QUICK.every(x => x.id && x.text && x.emoji), '每条都有 id/文本/表情');
  ok(A.F.QUICK.some(x => /来一局/.test(x.text)), '★ 有"来一局？"（约战是核心场景）');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
