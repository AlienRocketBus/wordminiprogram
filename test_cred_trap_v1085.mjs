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

const src = fs.readFileSync('/home/claude/work/repo/hansen_cred_trap_v1085.js', 'utf8');

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
  Object.setPrototypeOf(store, { setItem: store.setItem, removeItem: store.removeItem, clear: store.clear });
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
  const hits = T.hits();
  ok(hits.length === 2, `恰好两条记录（实得 ${hits.length}）`);
  ok(hits.every(h => (h.where || '').length > 0), '★ 每条都带调用栈 —— 才能看出是谁干的');
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
  store.setItem('wordIslandAnimal', '{}');
  store.setItem('hansen_wallet_coins', '100');
  ok(T.hits().length === 0, '★ 与凭证无关的键不记录（否则日志会被淹没）');
  store.setItem('access_token_x', 'v');
  ok(T.hits().length === 1, 'access_token 类的键会被记录');
}

/* ④ 空记录时给出可读提示，而不是空白 */
{
  const { T } = mk();
  ok(/没有任何模块动过凭证/.test(T.text()), '★ 无记录时说人话，不留空白让人误判');
}

/* ⑤ 必须最先加载 —— 否则抓不到早期动作 */
{
  const html = fs.readFileSync('/home/claude/work/repo/island_animal.html', 'utf8');
  const trap = html.indexOf('hansen_cred_trap_v1085');
  const auth = html.indexOf('hansen_auth_v1004');
  ok(trap >= 0, '岛屿页已装监视器');
  ok(trap < auth, '★ 监视器在账号模块**之前**加载（否则登录那一刻抓不到）');
  ok(!/defer[^>]*hansen_cred_trap/.test(html), '★ 不加 defer —— 必须同步执行才能赶在其它模块前面');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
