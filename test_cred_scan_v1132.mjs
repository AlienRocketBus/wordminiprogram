/* test_cred_scan_v1132.mjs —— 凭证扫描必须先取快照
 *
 * 🔴 真实事故：`test_phone_signup_v1057` 随机失败（十次红三四次），
 *    「登录成功了却说凭证不在」，于是本地登录态不写、界面显示未登录。
 *
 * 追了两轮才找到根因 —— **是产品代码的 bug，不是测试的**：
 *
 *   for (var i = 0; i < localStorage.length; i++) {
 *     var k = localStorage.key(i);      // ← 边遍历边读
 *   }
 *
 * 页面上同时跑着凭证守护、心跳、版本守望者，
 * **它们随时会写/删 localStorage** —— 集合一变动索引就错位，
 * **正好跳过凭证键那一格**。跑得快没事，跑得慢就红，所以是随机的。
 *
 * 修法：**先把键名取成快照，再遍历快照**。
 *
 * 为什么单独写这个文件而不是改 v1057 那个：
 *   那个测试三段共用一个页面、后两段还会 clear()，结构本身就乱；
 *   我试过改它，改了六七次都在制造新问题。
 *   **重写一个干净的，比继续改一个乱的省事得多。**
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('凭证扫描快照 v1132');

const src = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js', 'utf8');
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ① 代码层面：不许边遍历边读 */
{
  /* 找出所有遍历 localStorage 的地方 */
  const loops = code.match(/for\s*\([^)]*localStorage\.length[^)]*\)\s*\{[\s\S]{0,300}?\}/g) || [];
  ok(loops.length > 0, `找到 ${loops.length} 处 localStorage 遍历`);
  const bad = loops.filter(L => {
    /* 循环体里直接用 localStorage.key(i) 取键，且这个循环不是"只收集键名"的快照循环 */
    if (!/localStorage\.key\(/.test(L)) return false;
    const onlyCollect = /push\(\s*_?k\w*\s*\)/.test(L) && !/getItem/.test(L);
    return !onlyCollect;
  });
  ok(bad.length === 0,
     `★ 没有"边遍历边读"的循环（实得 ${bad.length} 处）—— ` +
     `集合被别的模块改动时索引会错位，正好跳过凭证键`);
}

/* ② 凭证校验那段必须走快照 */
{
  const i = code.indexOf('_credOk');
  ok(i > 0, '找到凭证校验段');
  const seg = code.slice(i, i + 900);
  ok(/_keys\.push\(/.test(seg) || /snap/.test(seg), '★ 先把键名收集成数组');
  ok(/for\s*\([^)]*_keys\.length/.test(seg) || /for\s*\([^)]*snap/.test(seg),
     '★ 再遍历那个数组，而不是实时的 localStorage');
}

/* ③ 行为验证：集合在遍历中被改动，仍能找到凭证 */
{
  function scan(useSnapshot, mutateAt) {
    const store = { a: '1', credentials_x: 'X'.repeat(60), b: '2', c: '3' };
    let keys = Object.keys(store);
    const ls = { get length() { return keys.length; }, key(i) { return keys[i]; },
                 getItem(k) { return store[k]; } };
    let found = false;
    if (useSnapshot) {
      const snap = [];
      for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k) snap.push(k); }
      if (mutateAt >= 0) keys = keys.filter(k => k !== 'a');   /* 别的模块删了一个键 */
      for (const k of snap) {
        if (/^credentials/i.test(k) && String(store[k] || '').length > 50) found = true;
      }
    } else {
      for (let i = 0; i < ls.length; i++) {
        if (i === mutateAt) keys = keys.filter(k => k !== 'a');
        const k = ls.key(i) || '';
        if (/^credentials/i.test(k) && String(ls.getItem(k) || '').length > 50) found = true;
      }
    }
    return found;
  }
  ok(scan(false, -1) === true, '基准：集合不变时，两种写法都能找到');
  ok(scan(false, 1) === false, '★ 复现旧 bug：遍历中集合被改动 → 旧写法漏掉凭证');
  ok(scan(true, 1) === true, '★ 快照写法：同样情况下仍能找到 —— 这就是修复');
}

/* ④ 边界：快照期间键被删掉，getItem 返回 null 不能崩 */
{
  const store = { credentials_x: 'X'.repeat(60) };
  const snap = ['credentials_x', 'credentials_gone'];
  let crashed = false, found = false;
  try {
    for (const k of snap) {
      if (/^credentials/i.test(k) && String(store[k] || '').length > 50) found = true;
    }
  } catch (e) { crashed = true; }
  ok(!crashed, '★ 快照里的键已被删掉时不崩（String(null||"") 兜住）');
  ok(found === true, '★ 仍能找到还在的那个');
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
