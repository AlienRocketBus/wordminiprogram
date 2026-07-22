// 🔴v970 Mock 契约测试：用真实模块当场校验测试替身的形态，永久堵死"假形态测真逻辑"。
// 事故背景：v969 真机走查发现全局到期口径读错 canonical 形态——Node 台架 mock 按错误
// 假设造型，测试全绿、生产全瞎。本文件让这类漂移在 Node 层就爆炸。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let fails = 0;
const ok = (c, n) => { console.log((c ? '  ✅ ' : '  ❌ ') + n); if(!c) fails++; };

/* ── 1) 在 Node 里加载【真实】canonical 模块 ── */
const store = new Map();
const storage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  key: i => [...store.keys()][i] ?? null,
  get length(){ return store.size; },
};
const context = {
  console, localStorage: storage,
  location: { pathname: '/island_food.html' },
  setTimeout, clearTimeout, setInterval, clearInterval, Date, JSON, Math,
};
context.window = context; context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hansen_canonical_progress.js', import.meta.url), 'utf8'),
  context, { filename: 'hansen_canonical_progress.js' });
const HC = context.HansenCanonical;
ok(!!HC, '真实 canonical 模块在 Node 加载成功');

/* ── 2) 用真实 API 产生一条错词+SRS，读出【真实存储形态】 ── */
console.log('T1 真实形态采样');
{
  const api = Object.keys(HC).sort().join(',');
  ok(/absorbAnswer/.test(api) && /setCurrentSrs/.test(api) && /read/.test(api),
     '真实API面: ' + api.slice(0, 90));
  context.S = { learned: [], wrongs: { '3': 1 } };             // 真实页面进度对象
  HC.absorbCurrent();                                          // 向上吸收(页面S→canonical, markAnswer真实入口)
  let sOK = HC.setCurrentSrs(3, { box: 1, due: '2026-7-21', last: '2026-7-20' });
  if(!sOK) sOK = HC.setCurrentSrs(3, { box: 1, due: '2026-07-21', last: '2026-07-20' });
  const st = HC.read();
  ok(st && typeof st === 'object', 'read() 返回存储对象');
  ok(st.islands && typeof st.islands === 'object', '真实形态：顶层是 islands 容器');
  ok(!('wrongs' in st) && !('srs' in st), '真实形态：顶层没有扁平 wrongs/srs（v969事故形态）');
  const ids = Object.keys(st.islands);
  ok(ids.length >= 1, '19岛节点齐备: ' + ids.length + '个');
  const food = st.islands.food;
  ok(food && Number(food.wrongs && food.wrongs['3']) >= 1, '真实答错落入 food.wrongs[3]');
  ok(food && food.srs && food.srs['3'] && food.srs['3'].box === 1,
     'food.srs[3] 真实写入可读回(到期日=昨天)');
}

/* ── 3) 契约：台架 mock 的形态必须与真实形态同构 ── */
console.log('T2 台架 mock 契约');
{
  const harness = fs.readFileSync(new URL('./test_review_rewards_v963.mjs', import.meta.url), 'utf8');
  ok(/CAN_STORE = \{ islands: \{/.test(harness),
     '奖励台架 CAN_STORE 采用真实嵌套形态 islands:{…}');
  ok(!/CAN_STORE = \{ wrongs\s*:/.test(harness),
     '奖励台架不存在 v969 事故的扁平形态');
}

/* ── 4) 契约：每个关键 mock 必须有真机走查孪生覆盖同一路径 ── */
console.log('T3 真机孪生覆盖');
{
  const walk = fs.readFileSync(new URL('./test_ui_walkthrough_v969.mjs', import.meta.url), 'utf8');
  ok(/hr_review_banner/.test(walk) && /markAnswer\(/.test(walk),
     '走查覆盖横幅+真实答题路径（canonical 消费端的真机孪生）');
  ok(/hsnCloudCard/.test(walk), '走查覆盖云卡片（云存档 mock 的真机孪生）');
}

/* ── 5) 消费端烟测：奖励模块的口径函数在【真实】canonical 上直接可用 ── */
console.log('T4 口径×真实模块合体');
{
  context.HansenCoins = { get: () => 0, award: () => true, hasAward: () => false };
  context.document = { readyState: 'complete', addEventListener(){}, getElementById(){ return null; },
                       createElement: () => ({ style:{}, appendChild(){}, remove(){} }), body: { appendChild(){}, insertBefore(){} } };
  context.MutationObserver = function(){ this.observe = () => {}; };
  vm.runInContext(fs.readFileSync(new URL('./hansen_review_rewards_v963.js', import.meta.url), 'utf8'),
    context, { filename: 'hansen_review_rewards_v963.js' });
  const info = context.HansenReviewRewardsV963._debug.globalDueInfo();
  ok(info.ok === true, '口径函数在真实 canonical 上 ok');
  ok(info.globalDue >= 1, '真实写入的到期错词被口径捕获 (globalDue=' + info.globalDue + ')');
}

console.log('');
if(fails){ console.log('❌ Mock 契约失败', fails, '项'); process.exit(1); }
console.log('mock contract v970: real-module shape sampled + harness mock isomorphic + real-machine twins present + gauge works on REAL canonical ✅');
