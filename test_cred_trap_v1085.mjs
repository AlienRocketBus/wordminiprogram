const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_cred_trap_v1085.mjs —— 凭证生死簿：抓出到底是谁删掉了云端凭证
 *
 * 现场事实（v1084 已确认部署，故证据可信）：
 *   登录那一刻 credentials_ambitious-… 存在 1314 字节，约 2 秒后消失，
 *   此后 getLoginState() 永远返回 null，所有云端读写被拦在门外。
 *
 * 已经猜错三次：
 *   v1076 匿名登录冲凭证 → 用户回复匿名是开着的
 *   v1077 凭证还没异步落定 → 轨迹显示登录 62 秒后仍为空
 *   v1080 signUp 响应缺 expires_in → 有依据但未证实
 *
 * 所以改为抓现行：劫持 localStorage，谁动凭证就记下调用栈。
 *
 * 合同：
 *   ① 写入/删除凭证都要被记录，且带调用栈
 *   ② 只观察不改行为 —— 原样转发给真实实现，值必须一字不差
 *   ③ 与凭证无关的键不记录（否则日志会被淹没）
 *   ④ 装不上时必须静默退回原生实现，绝不能因诊断代码把应用弄坏
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('凭证生死簿 v1085');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_cred_trap_v1085.js'), 'utf8');

function mk() {
  const raw = {};
  const store = {
    getItem(k) { return Object.prototype.hasOwnProperty.call(raw, k) ? raw[k] : null; },
    setItem(k, v) { raw[k] = String(v); },
    removeItem(k) { delete raw[k]; },
    clear() { for (const k of Object.keys(raw)) delete raw[k]; },
    get length() { return Object.keys(raw).length; },
    key(i) { return Object.keys(raw)[i] || null; }
  };
  /* 🔴v1087：模块改为持久化后，会通过 prototype 上的原始 setItem 回写日志。
     桩必须提供**真实可用的 prototype 方法**，否则 rawSetRef 为空、
     save() 静默失败 → 记录全丢，测试会误判成"没记录"。 */
  const proto = {
    setItem(k, v) { raw[k] = String(v); },
    removeItem(k) { delete raw[k]; },
    clear() { for (const k of Object.keys(raw)) delete raw[k]; }
  };
  Object.setPrototypeOf(store, proto);
  const win = { localStorage: store, console, Date, Error, String, Object, JSON, Number, Array, RegExp,
                Storage: function () {} };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { T: ctx.window.HansenCredTrap, store, raw };
}

/* ① 写入与删除都被记录，且带调用栈 */
{
  const { T, store } = mk();
  ok(!!T, '模块已装载');
  store.setItem('credentials_ambitious-x', JSON.stringify({ access_token: 'AT', expires_in: 7200 }));
  store.removeItem('credentials_ambitious-x');
  const t = T.text();
  ok(/写入/.test(t), '★ 写入凭证被记录');
  ok(/❗删除/.test(t), '★ 删除凭证被记录（这正是要抓的那一刻）');
  ok(/字节/.test(t), '记录了字节数，便于分辨"真凭证"还是空值');
  /* 🔴v1087：日志改为**跨页面重载持久化**后，开头会多一条「── 页面加载 ──」分界线。
     那条是刻意加的：用户现场曾出现「本次会话没人动过凭证」，
     而凭证确实不在、登录记录却是 49 秒前 ——
     说明凭证是在**上一次会话**里没的，只记内存等于什么都没抓到。
     有了分界线才能一眼看出这一点。 */
  const hits = T.hits();
  const marks = hits.filter(h => /页面加载/.test(h.action));
  const real = hits.filter(h => !/页面加载/.test(h.action));
  ok(marks.length === 1, `★ 有且只有一条页面加载分界线（实得 ${marks.length}）`);
  ok(real.length === 2, `写入+删除共两条真实记录（实得 ${real.length}）`);
  ok(real.every(h => (h.where || '').length > 0), '★ 每条真实记录都带调用栈 —— 才能看出是谁干的');
}

/* ② 只观察不改行为：值必须一字不差 */
{
  const { T, store } = mk();
  const v = JSON.stringify({ access_token: 'ABC', refresh_token: 'RT', expires_in: 7200 });
  store.setItem('credentials_env', v);
  ok(store.getItem('credentials_env') === v, '★ 写入的值一字不差（只观察，不改行为）');
  store.removeItem('credentials_env');
  ok(store.getItem('credentials_env') === null, '★ 删除确实生效（没有把真实行为吞掉）');
}

/* ③ 无关的键不记录 */
{
  const { T, store } = mk();
  const base = T.hits().filter(h => !/页面加载/.test(h.action)).length;
  store.setItem('wordIslandAnimal', '{}');
  store.setItem('hansen_wallet_coins', '100');
  /* hansen_auth_v1004 是我们自己的本地标记，**不是**云端凭证，同样不该记 */
  store.setItem('hansen_auth_v1004', '{"method":"phone"}');
  ok(T.hits().filter(h => !/页面加载/.test(h.action)).length === base,
     '★ 与凭证无关的键不记录（含我们自己的 hansen_auth_v1004）');
  store.setItem('access_token_x', 'v');
  ok(T.hits().filter(h => !/页面加载/.test(h.action)).length === base + 1,
     'access_token 类的键会被记录');
}

/* ④ 空记录时给出可读提示，而不是空白 */
{
  const { T } = mk();
  /* 现在开头必有一条页面加载分界线，所以"完全无记录"只在装不上时出现。
     而**装不上必须明说** —— 诊断工具最不能犯的错就是
     "看起来在工作、其实没在看"，那会让人把"没记录"误当成"没人动过"。 */
  ok(/页面加载|尚无记录|未能安装/.test(T.text()), '★ 无真实记录时也说人话，不留空白让人误判');
  ok(T.installed() === true, '★ 监视器确认已安装（否则记录不可信）');
}

/* ⑤ 必须最先加载 —— 否则抓不到早期动作 */
{
  const html = fs.readFileSync((__HSN_ROOT + 'island_animal.html'), 'utf8');
  const trap = html.indexOf('hansen_cred_trap_v1085');
  const auth = html.indexOf('hansen_auth_v1004');
  ok(trap >= 0, '岛屿页已装监视器');
  ok(trap < auth, '★ 监视器在账号模块**之前**加载（否则登录那一刻抓不到）');
  ok(!/defer[^>]*hansen_cred_trap/.test(html), '★ 不加 defer —— 必须同步执行才能赶在其它模块前面');
}

/* 🔴v1087 新增：**日志必须跨页面重载存活**。
   这是本模块存在的意义所在 —— 用户现场的凭证是在上一次会话里没的，
   只记内存就等于什么都没抓到。 */
{
  const { T, store } = mk();
  store.setItem('credentials_env', '{"access_token":"AT"}');
  store.removeItem('credentials_env');
  const dumped = store.getItem('hansen_credtrap_log');
  ok(!!dumped, '★ 日志确实写进了 localStorage');
  const parsed = JSON.parse(dumped || '[]');
  ok(parsed.some(h => /❗删除/.test(h.action)),
     '★ 删除记录已落盘 —— 页面重载后依然看得到');
  ok(parsed.some(h => (h.where || '').length > 0), '★ 落盘的记录带调用栈');
}

/* 🔴v1087：登录时刻要能写进同一条时间线（由 hansen_auth 调 mark）*/
{
  const { T } = mk();
  T.mark('🔑 登录成功', '凭证已就位');
  ok(/登录成功/.test(T.text()), '★ mark() 能把登录事件写进时间线');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
