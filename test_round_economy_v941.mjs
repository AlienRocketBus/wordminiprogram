import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_round_reward.js', import.meta.url), 'utf8');
const NOW = Date.parse('2026-07-17T12:00:00Z');

class ClockDate extends Date {
  constructor(...args) { super(args.length ? args[0] : NOW); }
  static now() { return NOW; }
}

class Storage {
  constructor(seed = {}) { this.data = {...seed}; }
  getItem(key) { return Object.hasOwn(this.data, key) ? this.data[key] : null; }
  setItem(key, value) { this.data[key] = String(value); }
  removeItem(key) { delete this.data[key]; }
  putJson(key, value) { this.data[key] = JSON.stringify(value); }
  json(key, fallback = null) {
    try { return JSON.parse(this.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  }
}

function fakeDocument() {
  const appended = [];
  const body = {
    appendChild(node) { appended.push(node); node.parentNode = body; },
    removeChild(node) {
      const index = appended.indexOf(node);
      if (index >= 0) appended.splice(index, 1);
      node.parentNode = null;
    }
  };
  return {
    appended,
    body,
    head:{appendChild() {}},
    createElement(tag) {
      return {
        tag, style:{}, textContent:'', innerHTML:'', parentNode:null,
        addEventListener() {},
        remove() { if (this.parentNode) this.parentNode.removeChild(this); },
        querySelector(selector) { return selector === '#hrrOk' ? {addEventListener() {}} : null; }
      };
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

function wallet(storage, kind) {
  const ledgerKey = `__test_${kind}_ledger`;
  const balanceKey = `__test_${kind}_balance`;
  return {
    award(id, amount) {
      const ledger = storage.json(ledgerKey, {});
      if (Object.hasOwn(ledger, id)) return true;
      ledger[id] = amount;
      storage.putJson(ledgerKey, ledger);
      storage.setItem(balanceKey, Number(storage.getItem(balanceKey) || 0) + amount);
      return true;
    },
    get() { return Number(storage.getItem(balanceKey) || 0); }
  };
}

function boot({path = '/island_action.html', storage = new Storage(), bosses = 20, index, regularClears} = {}) {
  const document = fakeDocument();
  const notices = [];
  const context = {
    console, JSON, Math, Number, Date:ClockDate, parseInt, isFinite,
    location:{pathname:path}, localStorage:storage, document,
    BOSSES:Array.from({length:bosses}, (_, i) => ({id:i + 1})),
    HansenCoins:wallet(storage, 'coin'),
    HansenGems:wallet(storage, 'gem'),
    HansenRoundBar:{refresh() {}},
    __hsnSaveNotice(message) { notices.push(message); },
    CustomEvent:class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent() {},
    setTimeout() { return 1; },
    setInterval() { return 1; },
    clearInterval() {},
    bossVictory() { return 'victory'; }
  };
  if (index !== undefined) context._s1Idx = index;
  if (Array.isArray(regularClears)) context.getIslandClearedLevels = () => regularClears.slice();
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_round_reward.js'});
  return {context, storage, document, notices};
}

function balance(storage, kind) { return Number(storage.getItem(`__test_${kind}_balance`) || 0); }
function ledgerIds(storage, kind) { return Object.keys(storage.json(`__test_${kind}_ledger`, {})); }
function full(n) { return Array.from({length:n}, (_, i) => i + 1); }
function shuffled(n) {
  const values = full(n);
  const order = [];
  let left = 0, right = values.length - 1;
  while (left <= right) {
    if (right >= left) order.push(values[right--]);
    if (left <= right) order.push(values[left++]);
  }
  return order;
}

// 历史永久通关记录只负责解锁，不能充当 HF6 当前奖励轮的进度。
{
  const storage = new Storage({
    hansen_boss_round_count_action:'1',
    hansen_boss_round_cleared_action:JSON.stringify(full(20)),
    hansen_boss_round_gemday_action:'2026-7-17'
  });
  const run = boot({storage, regularClears:full(20)});
  assert.equal(run.context.HansenRoundReward._win(18), false, '历史 20/20 后只赢 Lv18 不能领奖');
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [18]);
  assert.deepEqual([...run.context.HansenRoundReward.remain()], full(20).filter(n => n !== 18));
  assert.equal(run.context.HansenRoundReward.roundNo(), 2, 'HF5 历史完成次数只决定新账本从第几轮开始');
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);

  assert.equal(run.context.HansenRoundReward._win(18), false, '同一轮重复赢同一 Boss 不能增加进度');
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [18]);
}

// 20 位 Boss 可以任意顺序完成；恰好在第 20 个不同关号时结算一次并清空进入下一轮。
{
  const storage = new Storage();
  const run = boot({storage});
  const order = shuffled(20);
  for (let i = 0; i < order.length - 1; i++) {
    assert.equal(run.context.HansenRoundReward._win(order[i]), false, `第 ${i + 1} 个不同 Boss 不得提前结算`);
  }
  assert.equal(run.context.HansenRoundReward._win(order.at(-1)), true, '20 个不同 Boss 全部完成才结算');
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 88);
  assert.equal(run.context.HansenRoundReward.count(), 1);
  assert.equal(run.context.HansenRoundReward.roundNo(), 2);
  assert.deepEqual([...run.context.HansenRoundReward.progress()], []);
  assert.deepEqual([...run.context.HansenRoundReward.remain()], full(20));
  assert.deepEqual(ledgerIds(storage, 'coin'), ['round:v946:regular:action:r1:coins']);
  assert.deepEqual(ledgerIds(storage, 'gem'), ['round:v946:regular:action:r1:gems']);

  assert.equal(run.context.HansenRoundReward._win(18), false, '下一轮只赢 Lv18 不能复用上一轮全通记录');
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [18]);
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 88);
}

// Land 总关数必须取当前页面 BOSSES.length，旧 landN_prog 即使已满也不能直接领奖。
{
  const storage = new Storage({land3_prog:'7'});
  const run = boot({path:'/island_land3.html', storage, bosses:7, index:6});
  assert.equal(run.context.HansenRoundReward.total(), 7);
  assert.deepEqual([...run.context.HansenRoundReward.progress()], []);
  assert.equal(run.context.HansenRoundReward._win(4), false, '旧 Land 解锁进度不等于当前奖励轮');
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [4]);
  assert.equal(run.context.HansenRoundReward._win(4), false, 'Land 重复关号不增加进度');
  for (const lv of shuffled(7).filter(lv => lv !== 4).slice(0, -1)) {
    assert.equal(run.context.HansenRoundReward._win(lv), false);
  }
  const last = shuffled(7).filter(lv => lv !== 4).at(-1);
  assert.equal(run.context.HansenRoundReward._win(last), true);
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 88);
  assert.equal(run.context.HansenRoundReward.count(), 1);
  assert.deepEqual(ledgerIds(storage, 'gem'), ['round:v946:land:land3:r1:gems']);
}

// 星海女帝仍是独立的一次性 100 钻终战，不参加普通岛逐轮循环。
{
  const seed = {};
  for (let i = 1; i <= 8; i++) seed[`hsn_landmap_cleared_${i}`] = '1';
  const storage = new Storage(seed);
  const run = boot({path:'/island_season.html', storage, bosses:6, index:5});
  assert.equal(run.context.HansenRoundReward._win(5), false, '不是 Lv6 终战不得领奖');
  assert.equal(run.context.HansenRoundReward._win(6), true, '8 个 Land 真旗 + Lv6 终战应结算');
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 100);
  assert.deepEqual(ledgerIds(storage, 'gem'), ['round:v942:season:season:final:gems']);
  assert.equal(run.context.HansenRoundReward._win(6), false, '女帝奖励只能领取一次');
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 100);
  const finalLedger = storage.json('hansen_season_final_reward_v941');
  assert.equal(finalLedger.version, 942);
  assert.equal(finalLedger.gems, 100);
}

console.log('✅ HF6 经济回归：历史 20/20 隔离、重复关卡、乱序完整轮、Land 动态总数、Season 一次性 100 钻全部通过');
