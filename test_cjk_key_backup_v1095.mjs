const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_cjk_key_backup_v1095.mjs —— 备份必须支持中文键名
 *
 * 事故（用户真机，卡了多个版本）：
 *   登录成功后点「立即把进度存到云端」，一直报
 *       「备份含非法键或非字符串值」
 *
 * 真凶（实测扫描用户真实 localStorage 找到）：
 *       hsn_progress:动物大冒险     ← 键名里有中文
 *   这是 hansen_mylearning.js 写的「我的学习」跨岛聚合数据，
 *   键名格式就是 `hsn_progress:<岛屿标题>`，而岛屿标题本来就是中文。
 *
 *   而备份的键名校验是 /^[A-Za-z0-9_:\-.]+$/ —— **只允许英文数字**，
 *   中文一律判为非法 → 整个备份失败 → 用户永远存不上云端。
 *
 * ⚠️ v1094 我曾以为是自己加的诊断键污染了备份 —— **那只对了一半**。
 *   诊断键确实该排除（v1094 修的），但真正卡住用户的是中文键名。
 *   教训：**先扫真实数据，再下结论。**
 *
 * 合同：
 *   ① 中文键名必须能进备份（那是真实玩家数据）
 *   ② 日文/韩文同样放行（同类命名风格）
 *   ③ 真正非法的字符（空格、引号、控制字符）仍要拦
 *   ④ 备份能原样解析回来，不是只写进去读不出
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('备份支持中文键名 v1095');

const src = fs.readFileSync((__HSN_ROOT + 'hansen_backup_v944.js'), 'utf8');

function mk(seed) {
  const d = { ...seed };
  const store = { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }, get length() { return Object.keys(d).length; },
    key: i => Object.keys(d)[i] || null, clear() { for (const k of Object.keys(d)) delete d[k]; } };
  const win = { localStorage: store, console, Date, Math, JSON, Object, Promise, Error, String, Number, Array, RegExp,
    document: { addEventListener() {}, getElementById: () => null, querySelector: () => null,
                querySelectorAll: () => [], documentElement: { classList: { contains: () => false } } },
    addEventListener() {}, setTimeout: () => 0, setInterval: () => 0,
    crypto: { getRandomValues: a => a }, TextEncoder, TextDecoder,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    atob: s => Buffer.from(s, 'base64').toString('binary') };
  win.window = win;
  const ctx = { ...win, window: win };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return { B: ctx.window.HansenBackup, store };
}

/* ① 中文键名必须能备份 */
{
  const { B } = mk({
    'hsn_progress:动物大冒险': JSON.stringify({ name: '动物大冒险', learned: 12 }),
    'hsn_progress:食物岛': JSON.stringify({ name: '食物岛', learned: 5 }),
    'wordIslandAnimal': JSON.stringify({ learned: [1, 2, 3] }),
    'hansen_wallet_coins': '888'
  });
  let err = '', items = [];
  try { items = (B.build().items || []); } catch (e) { err = String(e.message || e); }
  ok(!err, `★ 含中文键名时备份不再报错${err ? '：' + err.slice(0, 50) : ''}`);
  const cjk = items.filter(x => /[\u4e00-\u9fff]/.test(x.key));
  ok(cjk.length === 2, `★ 两条中文键都被收录（实得 ${cjk.length}）—— 那是真实玩家学习数据`);
}

/* ② 日文 / 韩文同样放行 */
{
  const { B } = mk({ 'hsn_progress:どうぶつ': '{}', 'hsn_progress:동물': '{}' });
  let err = '';
  try { B.build(); } catch (e) { err = String(e.message || e); }
  ok(!err, '日文/韩文键名同样放行');
}

/* ③ 真正非法的字符仍要拦 */
{
  const { B } = mk({ 'hansen_bad key': '1', 'hansen_ok': '1' });
  const items = (() => { try { return B.build().items || []; } catch (e) { return null; } })();
  if (items) {
    ok(!items.some(x => / /.test(x.key)), '★ 含空格的键名仍被拦住（不是无脑放行）');
  } else {
    /* 🔴v1098：原来这里是 ok(true,…) —— **恒真断言，等于没测**。
       build() 抛异常有两种可能：真的因为空格键被拒（对），
       或者因为别的原因崩了（那是 bug）。必须区分。 */
    let why = '';
    try { B.build(); } catch (e) { why = String(e.message || e); }
    ok(/非法键|illegal|invalid/i.test(why),
       `★ 含空格的键名被明确拒绝（而非其它原因崩溃）：${why.slice(0, 40)}`);
  }
}

/* ④ 能原样解析回来 */
{
  const { B } = mk({
    'hsn_progress:动物大冒险': JSON.stringify({ learned: 7 }),
    'hansen_wallet_coins': '123'
  });
  let n = -1, err = '';
  try { const code = B.exportCode(); n = (B.parse(code).items || []).length; }
  catch (e) { err = String(e.message || e); }
  ok(n > 0 && !err, `★ 备份能原样解析回来（${n} 条）—— 不是只写进去读不出`);
}

/* ⑤ 判据落在具名常量上，改动可被守卫看见 */
{
  ok(/KEY_CHARSET\s*=\s*\//.test(src), '★ 字符集判据是具名常量 KEY_CHARSET');
  ok(/u4e00.{0,10}u9fff/.test(src), '★ KEY_CHARSET 覆盖汉字区间');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
