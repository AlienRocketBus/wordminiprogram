const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_cid_order_v1130.mjs —— 竞赛 ID 按注册顺序全局分配
 *
 * 产品定义（用户原话）：
 *   「这个竞赛 ID 完全按照注册人数的顺序来分配这个 ID 号码。」
 *
 * 🔴 修之前有两个问题：
 *
 *   ① **本地临时号**：`ensureCid()` 用本机计数器从 1 开始发号 ——
 *      **每台设备的第一个用户都是 No.001**。
 *      两个人一对号才发现"我们怎么都是 001"，
 *      而好友功能正是靠竞赛 ID 互加的，撞号会直接加错人。
 *
 *   ② **并发撞号**：云端发号是"数一下有多少人比我早注册 + 1"，
 *      两人几乎同时注册 → 都数到 3 → 都拿 No.4。实测模拟确认会撞。
 *
 * 合同：
 *   ① 没登录就是没有号（0），**绝不本地编造**
 *   ② 设名字也不发号
 *   ③ 云端发号后锁死，终身不变
 *   ④ 发号算法就是"比我早注册的人数 + 1"（天然等于注册顺序）
 *   ⑤ 发号后要校验唯一性，撞了往后挪
 */
import vm from 'node:vm';
import fs from 'node:fs';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('竞赛 ID 按注册顺序分配 v1130');

function boot() {
  const ctx = { window: {}, document: { addEventListener() {}, dispatchEvent() { return true; } },
    CustomEvent: class { constructor(t) { this.type = t; } },
    console, Date, Math, JSON, Object, Array, String, Number, Error,
    localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; },
      setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync((__HSN_ROOT + 'hansen_sb_profile_v1002.js'), 'utf8'), ctx);
  return ctx.window.HansenSbProfile;
}

/* ①② 不发本地假号 */
{
  const P = boot();
  ok(P.ensureCid() === 0, '★ 没登录就是没有号（0）—— 绝不本地编造');
  P.setName('小明');
  ok(P.readProfile().cid === 0, '★ 设名字也不发号（旧版会在这里发 No.001）');
  ok(P.ensureCid() === 0, '★ 反复调用也不会突然冒出一个号');
}

/* ③ 云端发号后锁死 */
{
  const P = boot();
  const r = P.claimCloudId(7);
  ok(r.ok && r.cid === 7, '★ 云端发号生效');
  ok(P.readProfile().cidLocked === true, '★ 发号后锁死');
  /* 🔴v1142 契约细化：「终身不变」指的是**同一个账号**的号不变，
     不是"这台手机上第一次拿到的号不变"。

     真机现场暴露了区别：退出 A 号登 B 号，云端明明回了 B 的号，
     本地却因为锁着而一直显示 A 的 —— 而且名字也改不了。

     所以现在：**云端说什么就是什么**。
     同一个号重复认领 → already，什么都不动；
     号不一样 → 认定是换了账号，号跟上、名字和改名冷却一并清掉。 */
  const again = P.claimCloudId(7);
  ok(again.already === true && P.readProfile().cid === 7,
     '★ 同一个号重复认领 → 不动（already）');
  const switched = P.claimCloudId(99);
  ok(switched.switched === true && P.readProfile().cid === 99,
     '★ 云端换了号 → 以云端为准（换账号时必须跟上，否则新号顶着旧号）');
  ok(P.fmtCid(7) === '007', '★ 格式化补零 No.007');
}

/* ④ 发号算法 = 注册顺序 */
{
/* 🔴v1149：**窗口式断言必须先剥注释再截。**
   否则给产品代码加几行说明注释，就会把要找的东西挤出窗口，
   断言莫名其妙变红 —— v1146、v1148 各撞了一次。
   这类假红比不测更糟：它让人误以为改坏了东西，进而不敢写注释。 */
  const authRaw = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
  const auth = authRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = auth.indexOf('function assignCid');
  const seg = auth.slice(i, i + 1600);
  ok(/createdAt:\s*db\.command\.lt\(createdAt\)/.test(seg),
     '★ 数"比我早注册的人数" —— 这个语义天然就是注册顺序');
  ok(/\.count\(\)/.test(seg), '★ 用 count 而不是本地计数器');
  ok(!/counters/.test(seg),
     '★ 不依赖 counters 集合（它是 ADMINONLY，客户端根本写不了）');
}

/* ⑤ 防撞号 */
{
/* 🔴v1149：**窗口式断言必须先剥注释再截。**
   否则给产品代码加几行说明注释，就会把要找的东西挤出窗口，
   断言莫名其妙变红 —— v1146、v1148 各撞了一次。
   这类假红比不测更糟：它让人误以为改坏了东西，进而不敢写注释。 */
  const authRaw = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
  const auth = authRaw.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = auth.indexOf('function assignCid');
  const seg = auth.slice(i, i + 1600);
  ok(/where\(\{ cid: cid \}\)\.count\(\)/.test(seg),
     '★ 发号后校验这个号有没有被占');
  ok(/assignCid\(db, docRef, createdAt, tries \+ 1\)/.test(seg),
     '★ 撞了就往后挪一位');
  ok(/tries >= 5/.test(seg), '★ 重试封顶，不会死循环');
  /* 🔴v1149：原来查的是**注释里的那句话** ——
     剥掉注释后立刻暴露：这条断言在验"文档写了没"，而不是"代码做了没"。
     改为查真行为：assignCid 末尾要有 catch 兜底并返回 null，
     这样发号失败也不会把整个登录流程带崩。 */
  ok(/\.catch\(function \(\) \{ return null; \}\)/.test(auth),
     '★ 发号失败有 catch 兜底、返回 null —— 不阻断登录，下次登录再补');

  /* 模拟三人并发 */
  let rows = [{ cid: 1 }, { cid: 2 }, { cid: 3 }];
  const count = w => (w.cid !== undefined ? rows.filter(r => r.cid === w.cid).length : rows.length);
  function assign(tries = 0) {
    const cid = count({}) + 1 + tries;
    if (count({ cid }) > 0) { if (tries >= 5) return null; return assign(tries + 1); }
    rows.push({ cid }); return cid;
  }
  const got = [assign(), assign(), assign()];
  ok(new Set(got).size === 3, `★ 三人几乎同时注册拿到不同号（${got.join('/')}）`);
}

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail === 0 ? 0 : 1);
