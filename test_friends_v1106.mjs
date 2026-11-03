const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
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
 *   ③ 🔴v1164：**每人只写自己的记录**（集合权限「读取全部数据，修改本人数据」，
 *      改/删别人的记录在真云端是静默失败的）。互为好友 = 两边各自那条都在；
 *      删好友 = 删自己那条，对方那边随之变回「待确认」（不会以为还是好友）
 *   ④ 隐身 = 心跳抹成 0 = 对别人和离线完全一样，看不出差别
 *   ⑤ **快捷语必须在服务层校验** —— 即使改前端也发不出自定义内容
 *   ⑥ 收到未知 qid 只显示"(未知消息)"，绝不渲染原始内容
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('好友系统 v1106');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_friends_v1106.js'), 'utf8');

/* 🔴v1164：假云端要和真数据库一个脾气 ——
   集合权限「读取全部数据，修改本人数据」：谁都能读；add 时服务端盖上写入者的 _openid；
   **只有创建者能改、能删**，改/删别人的记录不报错、只是改了 0 条（真云端就是这样静默失败的）。
   旧的假云端谁都能改谁 → 测试一直绿，真机上「互为好友」却从来没成立过。 */
const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
function matcher(w) {
  return (x) => Object.keys(w || {}).every((k) => {
    const v = w[k];
    if (v && typeof v === 'object' && Array.isArray(v.$in)) return v.$in.includes(x[k]);
    if (v && typeof v === 'object' && typeof v.$lt === 'number') return typeof x[k] === 'number' && x[k] < v.$lt;
    return x[k] === v;
  });
}
let _seq = 0;
function boot(shared, openid) {
  const rows = (shared && shared.rows) || [];
  const msgs = (shared && shared.msgs) || [];
  const denied = (shared && shared.denied) || [];
  const who = openid || ('o' + (++_seq));
  const own = (r) => r && r._openid === who;
  const t = {
    read: async id => clone(rows.find(x => x._id === id) || null),
    list: async (w, o) => rows.filter(matcher(w)).slice(0, (o && o.limit) || 100).map(clone),
    add: async d => {
      const doc = Object.assign({}, clone(d), { _id: d._id || ('D' + rows.length + '_' + Math.random().toString(36).slice(2, 7)), _openid: who });
      rows.push(doc); return { id: doc._id };
    },
    patch: async (id, d) => {
      const r = rows.find(x => x._id === id);
      if (!r) return { updated: 0 };
      if (!own(r)) { denied.push(['patch', id, who]); return { updated: 0 }; }
      Object.assign(r, clone(d)); return { updated: 1 };
    },
    remove: async id => {
      const i = rows.findIndex(x => x._id === id);
      if (i < 0) return { deleted: 0 };
      if (!own(rows[i])) { denied.push(['remove', id, who]); return { deleted: 0 }; }
      rows.splice(i, 1); return { deleted: 1 };
    },
    addMsg: async d => { const doc = Object.assign({}, clone(d), { _id: 'M' + msgs.length, _openid: who }); msgs.push(doc); return { id: doc._id }; },
    listMsg: async (w, o) => msgs.filter(matcher(w)).slice(0, (o && o.limit) || 100).map(clone),
    removeMsg: async id => {
      const i = msgs.findIndex(x => x._id === id);
      if (i < 0 || msgs[i]._openid !== who) return { deleted: 0 };
      msgs.splice(i, 1); return { deleted: 1 };
    }
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
  return { F, rows, msgs, denied, openid: who, t };
}
const S = () => ({ rows: [], msgs: [], denied: [] });

/* ① 不用手机号 */
{
  ok(!/phone|手机号/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
     '★ 好友模块代码里完全不碰手机号（那是隐私，只用公开的竞赛 ID）');
}

/* ② 加好友的各种情况 */
{
  const s = S();
  const A = boot(s); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  s.rows.push({ _id: 'P2', kind: 'presence', cid: 2, name: '小红', at: Date.now() });
  ok((await A.F.addFriend(999)).reason.includes('没找到'), '★ 加不存在的号 → 明确提示');
  ok((await A.F.addFriend(1)).reason === '不能加自己', '★ 不能加自己');
  const r = await A.F.addFriend(2);
  ok(r.ok && r.name === '小红' && r.pending === true && r.mutual === false,
     `★ 加 No.2 成功（${r.name}），对方还没加我 → 待确认`);
  /* v1164：重复加要说准 —— 对方还没加回来时不能说「已经是好友了」（那是骗人） */
  const dup = await A.F.addFriend(2);
  ok(!dup.ok && /已经加过他了/.test(dup.reason), `★ 重复加（对方还没加我）→ 明确提示：${dup.reason}`);
  const B = boot(s, 'oB'); B.F._setMeForTest({ cid: 2, name: '小红' });
  await B.F.addFriend(1);
  ok((await A.F.addFriend(2)).reason === '已经是好友了', '★ 重复加（已互为好友）→「已经是好友了」');
}

/* ③ 双向关系：每人只写自己的记录 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  const B = boot(s, 'oB'); B.F._setMeForTest({ cid: 2, name: '小红' });
  await A.F._beat(); await B.F._beat();
  ok(A.F._myOpenid() === 'oA' && B.F._myOpenid() === 'oB',
     '★ 各自学到数据库盖的 _openid（写一条自己的在线记录再读回来）');
  await A.F.addFriend(2);
  /* 🔴v1114：**不单方面写进对方的好友表** —— 陌生人不能单方面进孩子的列表 */
  const mine = s.rows.filter(x => x.kind === 'friend' && x.owner === 1);
  const theirs = s.rows.filter(x => x.kind === 'friend' && x.owner === 2);
  ok(mine.length === 1 && mine[0]._openid === 'oA', '★ 只写自己这边一条（盖的是自己的 _openid）');
  ok(theirs.length === 0, '★ **不往对方好友表里塞** —— 陌生人不能单方面进孩子的列表');
  const lb1 = await B.F.listFriends();
  ok(lb1.ok && lb1.friends.length === 0 && lb1.incoming.some(x => x.cid === 1),
     '★ 对方那边：不是好友，只显示「想加你为好友」（等他自己决定）');
  const la1 = await A.F.listFriends();
  ok(la1.ok && la1.friends.length === 1 && la1.friends[0].pending === true,
     '★ 我这边：标成待确认（「我加了他」和「互为好友」是两回事）');

  const back = await B.F.addFriend(1);
  ok(back.ok && back.mutual === true, '★ 对方加回来 → 当场互为好友（不用谁去改谁的记录）');
  const la2 = await A.F.listFriends(), lb2 = await B.F.listFriends();
  ok(la2.friends[0] && la2.friends[0].pending === false && la2.friends[0].mutual === true, '★ 我这边变成正式好友');
  ok(lb2.friends[0] && lb2.friends[0].pending === false && lb2.incoming.length === 0, '★ 对方那边也是正式好友，请求消失');

  await A.F.removeFriend(2);
  ok(!s.rows.some(x => x.kind === 'friend' && x.owner === 1), '★ 删好友：我自己那条删掉了');
  ok(s.rows.some(x => x.kind === 'friend' && x.owner === 2),
     '对方那条还在（那是他的记录，别人删不了 —— 真云端也是这样）');
  const lb3 = await B.F.listFriends();
  ok(lb3.friends[0] && lb3.friends[0].pending === true,
     '★ 对方那边自动变回「等他也加你」—— 不会以为还是好友');
  const la3 = await A.F.listFriends();
  ok(la3.friends.length === 0 && la3.incoming.length === 0,
     '★ 我这边：列表里没有他了，也不会马上冒出「他想加你」（刚删的）');
  ok(s.denied.length === 0, `★ **全程没有一次去改/删别人的记录**（实得 ${s.denied.length} 次）`);
}

/* ③b 冒充：别人替我写的「我的好友」、替他写的「他加了我」都不算 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  const B = boot(s, 'oB'); B.F._setMeForTest({ cid: 2, name: '小红' });
  const M = boot(s, 'oM'); M.F._setMeForTest({ cid: 9, name: '坏人' });
  await A.F._beat(); await B.F._beat(); await M.F._beat();
  await M.t.add({ kind: 'friend', owner: 1, friend: 9, name: '坏人', at: Date.now() });   /* 冒充 A 加 M */
  await A.F.addFriend(2);
  await M.t.add({ kind: 'friend', owner: 2, friend: 1, name: '小明', at: Date.now() });   /* 冒充 B 加回 A */
  const la = await A.F.listFriends();
  ok(!la.friends.some(f => f.cid === 9), '★ 别人替我写的"好友"不算 —— 只认我自己盖章的记录');
  const fb = la.friends.find(f => f.cid === 2);
  ok(fb && fb.pending === true, '★ 冒充 B 写的「B 加了我」不算 —— B 的在线记录不是这个 _openid');
}

/* ③c 集合没建 / 权限不对：要说清楚去控制台改哪里 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  /* 和真传输层一样：SDK 回了 {code}，传输层抛出带 code 和集合名的错误 */
  const cloudErr = (code, coll) => Object.assign(new Error('失败 ⟨' + code + '⟩'), { code, cloud: true, collection: coll });
  /* v1164（审查 SEC-3）：招呼只能发给自己加过的人 —— 先加上 No.2，才走得到「发招呼」那一步 */
  await A.t.add({ kind: 'friend', owner: 1, friend: 2, name: '小红', at: Date.now() });
  A.t.addMsg = async () => { throw cloudErr('DATABASE_COLLECTION_NOT_EXIST', 'hansen_friend_msgs'); };
  A.F._setTransportForTest(A.t);      /* 注入时会包一层超时，改了方法要重新注入 */
  const r = await A.F.sendQuick(2, 'pk');
  ok(!r.ok && r.kind === 'config', '★ 缺集合 → kind=config（不是"网络不好"）');
  ok(/hansen_friend_msgs/.test(r.reason) && /读取全部数据，修改本人数据/.test(r.reason),
     `★ 说清楚建哪个集合、权限选什么：${r.text}`);
  ok(/DATABASE_COLLECTION_NOT_EXIST/.test(r.reason), '★ 原话留在 ⟨⟩ 里（界面的技术信息那行显示它）');
  A.t.list = async () => { throw cloudErr('DATABASE_PERMISSION_DENIED', 'hansen_friends'); };
  A.F._setTransportForTest(A.t);
  const l = await A.F.listFriends();
  ok(!l.ok && l.kind === 'config' && /hansen_friends/.test(l.reason) && /权限/.test(l.text),
     '★ 权限不对 → 说是哪个集合的权限要改');
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
  /* 🔴v1164（审查 SEC-3）：没加过的人发不了（以前任何竞赛 ID 都能发，改前端就能给陌生孩子发招呼） */
  const nf = await A.F.sendQuick(2, 'pk');
  ok(nf.ok === false && /好友/.test(nf.reason || '') && s.msgs.length === 0, `★ 没加过的人发不了招呼：${nf.reason}`);
  await A.t.add({ kind: 'friend', owner: 1, friend: 2, name: '小红', at: Date.now() });
  ok((await A.F.sendQuick(2, 'pk')).ok === true, '预设快捷语能发');
  for (const bad of ['我要自己打字', '<script>x</script>', '', null, 'PK']) {
    const r = await A.F.sendQuick(2, bad);
    ok(r.ok === false, `★ 拒绝非预设内容 ${JSON.stringify(bad)} —— 改前端也发不出打字内容`);
  }
  ok(s.msgs.every(m => !m.text),
     '★ 数据库里只存 qid 不存文本（即使被写入奇怪的值，界面也只显示"未知消息"）');
}

/* ⑥b 只看好友发来的招呼：陌生人发的不给孩子看 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  const B = boot(s, 'oB'); B.F._setMeForTest({ cid: 2, name: '小红' });
  const M = boot(s, 'oM'); M.F._setMeForTest({ cid: 9, name: '陌生人' });
  await A.F._beat(); await B.F._beat(); await M.F._beat();
  /* 两个人都先「加了」A（发招呼要先加对方）—— A 只加了 B，陌生人 M 是单方面加的 */
  await B.t.add({ kind: 'friend', owner: 2, friend: 1, name: '小明', at: Date.now() });
  await M.t.add({ kind: 'friend', owner: 9, friend: 1, name: '小明', at: Date.now() });
  ok((await B.F.sendQuick(1, 'pk')).ok && (await M.F.sendQuick(1, 'hi')).ok, '两个人都发了招呼');
  const ib = await A.F.inbox({ onlyFrom: [2] });
  ok(ib.ok && ib.msgs.length === 1 && ib.msgs[0].from === 2 && /来一局/.test(ib.msgs[0].text),
     '★ 只显示好友 No.2 的「来一局？」');
  ok(ib.strangers === 1, '★ 陌生人那条没显示（只计数）');
  ok(ib.msgs[0].isNew === true && ib.unread === 1, '★ 新招呼标成"新"');
  A.F.markSeen();
  await new Promise(r => setTimeout(r, 5));
  const ib2 = await A.F.inbox({ onlyFrom: [2] });
  ok(ib2.unread === 0, '★ 看过之后不再算新的（已读记在本机 —— 别人的记录我改不了）');
  ok(s.msgs.every(m => m._openid === (m.from === 2 ? 'oB' : 'oM') && m.fromOpenid === m._openid),
     '★ 每条招呼都带着发件人自己的可信身份');
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

/* ⑧ 🔴v1164（审查 SEC-1 / SEC-5）：别人写进集合的「好友记录」不可信 ——
   ① owner 不是数字（'x'）的伪造记录：以前整页「没读到好友」，孩子永远进不去好友页；
   ② 往我名下塞一条 friend 是 HTML 的记录：以前在「还不知道我自己的 _openid」时当成我的、原样拼进页面（存储型 XSS）；
   ③ 服务端不回 _openid 时也不能「谁写的都算我的」 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  s.rows.push({ _id: 'X1', kind: 'friend', owner: 'x', friend: 1, at: Date.now(), _openid: 'oEvil' });
  s.rows.push({ _id: 'X2', kind: 'friend', owner: { $gt: 0 }, friend: 1, at: Date.now(), _openid: 'oEvil' });
  s.rows.push({ _id: 'X3', kind: 'friend', owner: 1, friend: '<img src=x onerror=alert(1)>', at: Date.now(), _openid: 'oEvil' });
  s.rows.push({ _id: 'X4', kind: 'presence', cid: '<b>9</b>', name: '<img src=x>', at: Date.now(), _openid: 'oEvil' });
  const la = await A.F.listFriends();
  ok(la && la.ok, `★ 伪造的好友记录（owner 不是数字）不会让整页读不出来（${la && (la.ok ? 'ok' : la.reason)}）`);
  const all = JSON.stringify(la && [la.friends, la.incoming, la.pending]);
  ok(la && la.ok && !/<img|<b>|onerror/.test(all), `★ 别人写的 HTML 一个字也进不了好友列表（${all.slice(0, 120)}）`);
  ok(la && la.ok && !(la.friends || []).length && !(la.pending || []).length, '★ 别人往我名下塞的记录不算我的好友');
  /* 服务端不回 _openid（或我自己的 _openid 还没读回来）：也不能把别人的记录当成我的 */
  const s2 = S();
  const B = boot(s2, 'oB'); B.F._setMeForTest({ cid: 2, name: '小红' });
  s2.rows.push({ _id: 'Y1', kind: 'friend', owner: 2, friend: 7, at: Date.now() });   /* 没有 _openid */
  s2.rows.push({ _id: 'P7', kind: 'presence', cid: 7, name: '陌生人', at: Date.now(), _openid: 'o7' });
  const lb = await B.F.listFriends();
  ok(lb && lb.ok && !(lb.friends || []).concat(lb.pending || []).some((x) => x.cid === 7),
     `★ 不知道是谁写的记录（没有 _openid）不当成我的（${JSON.stringify(lb && [lb.friends, lb.pending])}）`);
}

/* ⑨ 🔴v1164（审查 SEC-6）：在线记录只存到「分钟」—— 别人看不出我几点几分几秒在线 */
{
  const s = S();
  const A = boot(s, 'oA'); A.F._setMeForTest({ cid: 1, name: '小明' });
  await A.F._beat();
  const p = s.rows.find((x) => x.kind === 'presence' && x._openid === 'oA');
  ok(p && p.at > 0 && p.at % 60000 === 0, `★ 在线时间只到分钟（at=${p && p.at}，除以 60 秒余 ${p && p.at % 60000}）`);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
