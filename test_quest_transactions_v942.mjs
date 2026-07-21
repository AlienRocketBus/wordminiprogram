import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_quest_global.js', import.meta.url), 'utf8');
const QUEST_KEY = 'hansen_global_daily_quests_v941';
const TX_KEY = 'hansen_quest_claim_pending_v942';
const XP_PENDING = 'hansen_reward_xp_pending_v942';
const XP_LEDGER = 'hansen_reward_xp_awards_v942';
const BOOST_PENDING = 'hansen_reward_boost_pending_v942';
const BOOST_LEDGER = 'hansen_reward_boost_awards_v942';
const ISLAND_XP = '__test_island_total_xp';

let fixedNow = Date.parse('2026-07-14T12:00:00-06:00');
class FixedDate extends Date {
  constructor(...args) { super(args.length ? args[0] : fixedNow); }
  static now() { return fixedNow; }
  getFullYear() { return this.getUTCFullYear(); }
  getMonth() { return this.getUTCMonth(); }
  getDate() { return this.getUTCDate(); }
}

class FaultStorage {
  constructor(seed = {}) { this.data = {...seed}; this.rule = null; }
  get length() { return Object.keys(this.data).length; }
  key(i) { return Object.keys(this.data)[i] ?? null; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; }
  setItem(k, v) {
    if (this.rule && this.rule.op === 'set' && this.rule.key === k && --this.rule.nth === 0) {
      this.rule = null; throw new Error(`fault:set:${k}`);
    }
    this.data[k] = String(v);
  }
  removeItem(k) {
    if (this.rule && this.rule.op === 'remove' && this.rule.key === k && --this.rule.nth === 0) {
      this.rule = null; throw new Error(`fault:remove:${k}`);
    }
    delete this.data[k];
  }
  arm(key, nth = 1, op = 'set') { this.rule = {key, nth, op}; }
  disarm() { this.rule = null; }
  put(k, v) { this.data[k] = String(v); }
}

function readObject(storage, key, fallback = {}) {
  try { return JSON.parse(storage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; }
}
function putObject(storage, key, value) { storage.put(key, JSON.stringify(value)); }

function wallet(storage, kind, controls) {
  const ledgerKey = `__mock_${kind}_ledger`;
  const balanceKey = `__mock_${kind}_balance`;
  return {
    award(id, amount) {
      if (controls.walletFault === `${kind}:${id}` || controls.walletFault === kind) {
        controls.walletFault = null; return false;
      }
      const ledger = readObject(storage, ledgerKey);
      if (Object.prototype.hasOwnProperty.call(ledger, id)) return true;
      ledger[id] = amount;
      putObject(storage, ledgerKey, ledger);
      storage.put(balanceKey, Number(storage.getItem(balanceKey) || 0) + amount);
      return true;
    },
    get() { return Number(storage.getItem(balanceKey) || 0); }
  };
}

function boot(storage, controls = {}) {
  const totalXP = Number(storage.getItem(ISLAND_XP) || 0);
  const S = {totalXP, xp:totalXP, charXP:totalXP, level:1, streak:5, quests:{day:'', list:[]}};
  const notices = [];
  const context = {
    console, JSON, Math, Date:FixedDate, Number, parseInt, isFinite,
    localStorage:storage, S,
    HansenCheckin:{getStreak(){ return 5; }},
    HansenCoins:wallet(storage, 'coin', controls),
    addXP(n) { S.totalXP += Number(n); S.xp += Number(n); S.charXP += Number(n); },
    __hsnSaveNow() {
      storage.setItem(ISLAND_XP, String(S.totalXP));
      return storage.getItem(ISLAND_XP) === String(S.totalXP);
    },
    save() { return true; },
    __hsnSaveNotice(msg) { notices.push(msg); },
    setTimeout(fn) { fn(); return 1; },
    showToast(){}, playOpenChest(){}, bigConfetti(){},
    dispatchEvent(){}, CustomEvent:class { constructor(type, init) { this.type=type; this.detail=init?.detail; } }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_quest_global.js'});
  return {context, controls, notices};
}

function completeOne(storage, allBonus = false) {
  const s = readObject(storage, QUEST_KEY);
  if (allBonus) {
    s.list.forEach((q, i) => { q.progress = q.goal; q.claimed = i < s.list.length - 1; });
    putObject(storage, QUEST_KEY, s);
    return s.list.length - 1;
  }
  s.list[0].progress = s.list[0].goal;
  putObject(storage, QUEST_KEY, s);
  return 0;
}

function claimed(storage, index) { return readObject(storage, QUEST_KEY).list[index].claimed; }
function coinTotal(storage) { return Number(storage.getItem('__mock_coin_balance') || 0); }
function retryUntilClaimed(storage, controls, index, max = 5) {
  for (let i = 0; i < max && !claimed(storage, index); i++) {
    const run = boot(storage, controls);
    run.context.HansenQuestGlobal.claim(index);
  }
  assert.equal(claimed(storage, index), true, '解除故障后必须可恢复并最终 claimed');
}

// 1) 任一非法任务字段都会让整份当日状态 fail-closed 重建；展示/经济字段始终来自 POOL。
{
  const storage = new FaultStorage();
  let run = boot(storage);
  const clean = run.context.HansenQuestGlobal.status();
  const poisoned = structuredClone(clean);
  poisoned.version = 941;
  poisoned.list.forEach((q, i) => Object.assign(q, {
    title:'<img src=x onerror=globalThis.__xss=1>',
    icon:'<svg onload=globalThis.__xss=2>',
    type:`<script>${i}</script>`, goal:999999,
    reward:{xp:999999, html:'<img onerror=1>'},
    progress:i === 0 ? 999999 : -999,
    claimed:i === 1 ? 'true' : false
  }));
  putObject(storage, QUEST_KEY, poisoned);
  run = boot(storage);
  const safe = run.context.HansenQuestGlobal.status();
  assert.deepEqual([...safe.list.map(q => q.id)], [...clean.list.map(q => q.id)]);
  for (let i = 0; i < safe.list.length; i++) {
    assert.equal(safe.list[i].title, clean.list[i].title);
    assert.equal(safe.list[i].icon, clean.list[i].icon);
    assert.equal(safe.list[i].type, clean.list[i].type);
    assert.equal(safe.list[i].goal, clean.list[i].goal);
    assert.equal(safe.list[i].reward.xp, clean.list[i].reward.xp);
    assert.equal(safe.list[i].claimed, false, '只有布尔 true 才能恢复 claimed');
  }
  assert.equal(safe.list[0].progress, 0, '越界 progress 必须拒绝整份状态，不能夹到 goal 后变成可领奖');
  assert.equal(safe.list[1].progress, 0);
  assert.equal(JSON.stringify(run.context.S.quests).includes('<img'), false);
  assert.equal(JSON.stringify(readObject(storage, QUEST_KEY)).includes('<img'), false, '启动即覆写纯净 schema');

  const unknown = structuredClone(safe); unknown.list[0].id = 'evil-task';
  putObject(storage, QUEST_KEY, unknown);
  run = boot(storage);
  assert.equal(run.context.HansenQuestGlobal.status().list.some(q => q.id === 'evil-task'), false);
}

// 2) 单条任务：逐个切断事务准备、金币、XP pending、岛存档、XP ledger、claimed 写入。
const singleFaults = [
  {name:'quest transaction prepare', arm:s => s.arm(TX_KEY)},
  {name:'coin wallet', wallet:'coin'},
  {name:'xp pending', arm:s => s.arm(XP_PENDING)},
  {name:'island XP save', arm:s => s.arm(ISLAND_XP)},
  {name:'xp ledger', arm:s => s.arm(XP_LEDGER)},
  {name:'final claimed state', arm:s => s.arm(QUEST_KEY, 2)} // claim 内 ensure 第 1 写，最终 persist 第 2 写
];
for (const fault of singleFaults) {
  const storage = new FaultStorage(); const controls = {};
  boot(storage, controls); const index = completeOne(storage);
  const before = readObject(storage, QUEST_KEY).list[index];
  const expectedCoins = Math.max(20, Math.round(before.reward.xp * 0.6 / 5) * 5);
  const run = boot(storage, controls);
  if (fault.wallet) controls.walletFault = fault.wallet;
  if (fault.arm) fault.arm(storage);
  assert.equal(run.context.HansenQuestGlobal.claim(index), false, `${fault.name}: 故障当次不得报告成功`);
  assert.equal(claimed(storage, index), false, `${fault.name}: 未完全发奖不得 claimed`);
  storage.disarm(); controls.walletFault = null;
  retryUntilClaimed(storage, controls, index);
  assert.equal(coinTotal(storage), expectedCoins, `${fault.name}: 金币必须恰好一次`);
  assert.equal(Number(storage.getItem(ISLAND_XP) || 0), before.reward.xp, `${fault.name}: XP 必须恰好一次`);
  assert.equal(Object.keys(readObject(storage, '__mock_coin_ledger')).length, 1);
  assert.equal(Object.keys(readObject(storage, XP_LEDGER)).length, 1);
}

// 3) 全清奖励：额外金币和 90 分钟强化的每个断点都能恢复且不重复。
const allFaults = [
  {name:'all bonus wallet', walletSource:':all:coins'},
  {name:'boost pending', arm:s => s.arm(BOOST_PENDING)},
  {name:'boost target', arm:s => s.arm('hsn_crystal_boost_until')},
  {name:'boost ledger', arm:s => s.arm(BOOST_LEDGER)}
];
for (const fault of allFaults) {
  const storage = new FaultStorage(); const controls = {};
  boot(storage, controls); const index = completeOne(storage, true);
  const q = readObject(storage, QUEST_KEY).list[index];
  const baseCoins = Math.max(20, Math.round(q.reward.xp * 0.6 / 5) * 5);
  // 精确命中“全清金币”来源，而不是单条任务金币。
  if (fault.walletSource) {
    const original = wallet(storage, 'coin', controls);
    controls.walletFault = 'never';
    const run = boot(storage, controls);
    const origAward = run.context.HansenCoins.award;
    let failed = false;
    run.context.HansenCoins.award = (id, n) => {
      if (!failed && id.includes(fault.walletSource)) { failed = true; return false; }
      return origAward(id, n);
    };
    assert.equal(run.context.HansenQuestGlobal.claim(index), false);
  } else {
    const run = boot(storage, controls); fault.arm(storage);
    assert.equal(run.context.HansenQuestGlobal.claim(index), false, `${fault.name}: 故障当次不得成功`);
  }
  assert.equal(claimed(storage, index), false, `${fault.name}: 全奖未齐不得 claimed`);
  storage.disarm(); controls.walletFault = null;
  retryUntilClaimed(storage, controls, index);
  assert.equal(coinTotal(storage), baseCoins + 200, `${fault.name}: 单条+连签5日全清金币各一次`);
  assert.equal(Number(storage.getItem(ISLAND_XP) || 0), q.reward.xp, `${fault.name}: XP 一次`);
  const until = Number(storage.getItem('hsn_crystal_boost_until') || 0);
  assert.equal(until, FixedDate.now() + 90 * 60000, `${fault.name}: 强化只延长 90 分钟`);
  assert.equal(readObject(storage, QUEST_KEY).allDay, '2026-7-14');
}

// 4) 同一标签跨午夜：必须先恢复 D1 pending，再创建 D2 的 7 个新任务。
{
  fixedNow = Date.parse('2026-07-14T23:59:50Z');
  const storage = new FaultStorage(); const controls = {};
  const run = boot(storage, controls); const index = completeOne(storage);
  const d1 = readObject(storage, QUEST_KEY); const rewardXP = d1.list[index].reward.xp;
  const rewardCoins = Math.max(20, Math.round(rewardXP * 0.6 / 5) * 5);
  controls.walletFault = 'coin';
  assert.equal(run.context.HansenQuestGlobal.claim(index), false, 'D1 钱包中断必须保留 pending');
  assert.notEqual(storage.getItem(TX_KEY), null);

  fixedNow = Date.parse('2026-07-15T00:00:10Z');
  let d2 = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    d2 = run.context.HansenQuestGlobal.status();
    if (d2.day === '2026-7-15') break;
  }
  assert.equal(d2.day, '2026-7-15', JSON.stringify({notices:run.notices, data:storage.data}, null, 2));
  assert.equal(d2.list.length, 7);
  assert.equal(d2.list.every(q => q.claimed === false), true, 'D2 必须生成 7 个未领取任务');
  assert.equal(storage.getItem(TX_KEY), null, 'D1 事务应在换日前先完成并清理');
  assert.equal(coinTotal(storage), rewardCoins, 'D1 金币恰好补发一次');
  assert.equal(Number(storage.getItem(ISLAND_XP) || 0), rewardXP, 'D1 XP 恰好补发一次');
  assert.equal(Object.keys(readObject(storage, '__mock_coin_ledger')).every(id => id.startsWith('quest:2026-7-14:')), true);
}

console.log('✅ v942 任务 schema/XSS、领取事务与跨午夜恢复：金币、XP、全清强化恰好一次');
