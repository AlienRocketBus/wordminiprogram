import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_round_reward.js', import.meta.url), 'utf8');
const NOW = Date.parse('2026-07-17T12:00:00Z');
const PATH = '/island_action.html';
const STATE = 'hansen_boss_round_state_v946_action';
const TX = 'hansen_round_reward_pending_v942_action';
const BOOST_PENDING = 'hansen_reward_boost_pending_v942';
const BOOST_LEDGER = 'hansen_reward_boost_awards_v942';

class ClockDate extends Date {
  constructor(...args) { super(args.length ? args[0] : NOW); }
  static now() { return NOW; }
}

class FaultStorage {
  constructor(seed = {}) { this.data = {...seed}; this.rule = null; }
  getItem(key) { return Object.hasOwn(this.data, key) ? this.data[key] : null; }
  setItem(key, value) {
    if (this.rule?.op === 'set' && this.rule.key === key && --this.rule.nth === 0) {
      this.rule = null;
      throw new Error(`fault:set:${key}`);
    }
    this.data[key] = String(value);
  }
  removeItem(key) {
    if (this.rule?.op === 'remove' && this.rule.key === key && --this.rule.nth === 0) {
      this.rule = null;
      throw new Error(`fault:remove:${key}`);
    }
    delete this.data[key];
  }
  arm(key, nth = 1, op = 'set') { this.rule = {key, nth, op}; }
  disarm() { this.rule = null; }
  put(key, value) { this.data[key] = String(value); }
  putJson(key, value) { this.put(key, JSON.stringify(value)); }
  json(key, fallback = null) {
    try { return JSON.parse(this.getItem(key) ?? 'null') ?? fallback; }
    catch { return fallback; }
  }
}

function wallet(storage, kind, controls) {
  const ledgerKey = `__test_${kind}_ledger`;
  const balanceKey = `__test_${kind}_balance`;
  return {
    award(id, amount) {
      if (controls.walletFault === kind) {
        controls.walletFault = null;
        return false;
      }
      const ledger = storage.json(ledgerKey, {});
      if (Object.hasOwn(ledger, id)) return true;
      ledger[id] = amount;
      storage.putJson(ledgerKey, ledger);
      storage.put(balanceKey, Number(storage.getItem(balanceKey) || 0) + amount);
      return true;
    }
  };
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
    appended, body, head:{appendChild() {}},
    createElement(tag) {
      return {
        tag, style:{}, textContent:'', innerHTML:'', parentNode:null,
        addEventListener() {},
        remove() { if (this.parentNode) this.parentNode.removeChild(this); },
        querySelector() { return {addEventListener() {}}; }
      };
    },
    addEventListener() {}, removeEventListener() {}
  };
}

function boot(storage, controls = {}, options = {}) {
  const notices = [];
  const document = fakeDocument();
  const context = {
    console, JSON, Math, Number, Date:ClockDate, parseInt, isFinite,
    localStorage:storage,
    location:{pathname:options.path || PATH},
    document,
    BOSSES:Array.from({length:options.bosses || 20}, (_, i) => ({id:i + 1})),
    HansenCoins:wallet(storage, 'coin', controls),
    HansenGems:wallet(storage, 'gem', controls),
    HansenRoundBar:{refresh() {}},
    __hsnSaveNotice(message) { notices.push(message); },
    CustomEvent:class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent() {},
    setTimeout() { return 1; }, setInterval() { return 1; }, clearInterval() {},
    bossVictory() { return 'victory'; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_round_reward.js'});
  return {context, notices, document};
}

function balance(storage, kind) { return Number(storage.getItem(`__test_${kind}_balance`) || 0); }
function ledgerIds(storage, kind) { return Object.keys(storage.json(`__test_${kind}_ledger`, {})); }
function winFirstN(run, n) {
  for (let lv = 1; lv <= n; lv++) assert.equal(run.context.HansenRoundReward._win(lv), false);
}
function assertPaidOnce(storage, label, roundNo = 1) {
  assert.equal(balance(storage, 'coin'), 300, `${label}: 金币只能发一次`);
  assert.equal(balance(storage, 'gem'), 88, `${label}: 钻石只能发一次`);
  assert.equal(Number(storage.getItem('hsn_crystal_boost_until') || 0), NOW + 120 * 60_000, `${label}: 强化只能加 120 分钟`);
  assert.deepEqual(ledgerIds(storage, 'coin'), [`round:v946:regular:action:r${roundNo}:coins`]);
  assert.deepEqual(ledgerIds(storage, 'gem'), [`round:v946:regular:action:r${roundNo}:gems`]);
  const state = storage.json(STATE);
  assert.equal(state.completedCount, roundNo);
  assert.equal(state.roundNo, roundNo + 1);
  assert.deepEqual(state.cleared, []);
  assert.equal(state.lastReceipt.id, `round:v946:regular:action:r${roundNo}`);
}

// HF5 的 v942 普通岛 pending 来自永久通关旧逻辑：只能隔离清理，绝不能恢复发奖。
{
  const old = {
    version:942, island:'action', day:'2026-7-17', mode:'regular', roundNo:99, winLv:20,
    coins:999999, gems:999999, boost:999999
  };
  const storage = new FaultStorage({[TX]:JSON.stringify(old)});
  const run = boot(storage, {});
  assert.equal(run.context.HansenRoundReward.recover(), true);
  assert.equal(storage.getItem(TX), null, '旧 v942 pending 应被清除');
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);
  assert.equal(storage.getItem('hsn_crystal_boost_until'), null);
  assert.equal(run.context.HansenRoundReward._win(18), false);
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [18]);
}

// 损坏的新 pending 必须 fail-closed：保留原文、暂停胜利入账、不给任何奖励。
{
  const raw = '{"version":946,"island":"action","mode":"regular","roundNo":1,"total":20,"winLv":20,"receiptId":"forged","cleared":[1]}';
  const storage = new FaultStorage({[TX]:raw});
  const run = boot(storage, {});
  assert.equal(run.context.HansenRoundReward.recover(), false);
  assert.equal(run.context.HansenRoundReward._win(1), false);
  assert.equal(storage.getItem(TX), raw, '损坏 pending 原始数据必须保留以便人工恢复');
  assert.equal(storage.getItem(STATE), null, 'pending 异常时不得推进轮次');
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);
  assert.ok(run.notices.length >= 1);
}

// 建立 pending 失败：完整 20/20 可保留；重载 recover 必须仅凭满轮 state
// 自动重建事务并恰好一次结算，不得要求玩家再打一场。
{
  const storage = new FaultStorage();
  const controls = {};
  const run = boot(storage, controls);
  winFirstN(run, 19);
  storage.arm(TX);
  assert.equal(run.context.HansenRoundReward._win(20), false);
  assert.deepEqual(storage.json(STATE).cleared, Array.from({length:20}, (_, i) => i + 1));
  assert.equal(storage.getItem(TX), null);
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);
  const reload = boot(storage, controls);
  assert.equal(reload.context.HansenRoundReward.recover(), true, '重载必须从 20/20 state 自动重建 pending');
  assert.equal(storage.getItem(TX), null);
  assertPaidOnce(storage, 'pending prepare crash reload');
  assert.equal(reload.context.HansenRoundReward.recover(), true, '重复恢复必须幂等');
  assertPaidOnce(storage, 'pending prepare crash reload idempotent');
}

// 满轮 state 的自动重建若仍无法写 pending，recover 必须返回 false、保留 20/20，
// 让“重置当前岛”闸门停止删除；故障解除后再恢复，不能丢奖或重复发奖。
{
  const storage = new FaultStorage();
  const controls = {};
  const run = boot(storage, controls);
  winFirstN(run, 19);
  storage.arm(TX);
  assert.equal(run.context.HansenRoundReward._win(20), false);
  assert.equal(storage.json(STATE).cleared.length, 20);
  storage.arm(TX);
  const blocked = boot(storage, controls);
  assert.equal(blocked.context.HansenRoundReward.recover(), false, 'pending 仍写不进去时必须阻断重置');
  assert.equal(storage.json(STATE).cleared.length, 20, '阻断时必须原样保留满轮证明');
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);
  const retry = boot(storage, controls);
  assert.equal(retry.context.HansenRoundReward.recover(), true);
  assertPaidOnce(storage, 'full-state rebuild retry');
}

// 钱包中断：pending + 20/20 快照留存，重载 recover 按同一 receipt 补齐一次。
{
  const storage = new FaultStorage();
  const controls = {};
  const run = boot(storage, controls);
  winFirstN(run, 19);
  controls.walletFault = 'coin';
  assert.equal(run.context.HansenRoundReward._win(20), false);
  assert.notEqual(storage.getItem(TX), null);
  assert.equal(balance(storage, 'coin'), 0);
  assert.equal(balance(storage, 'gem'), 0);
  const reload = boot(storage, controls);
  assert.equal(reload.context.HansenRoundReward.recover(), true);
  assert.equal(storage.getItem(TX), null);
  assertPaidOnce(storage, 'wallet failure recovery');
  assert.equal(reload.context.HansenRoundReward._win(20), false, '进入下一轮后 Lv20 只能记作本轮一个关号');
  assert.equal(balance(storage, 'coin'), 300, '下一轮单关不得重复发金币');
  assert.equal(balance(storage, 'gem'), 88, '下一轮单关不得重复发钻石');
  assert.deepEqual(ledgerIds(storage, 'coin'), ['round:v946:regular:action:r1:coins']);
  assert.deepEqual(storage.json(STATE).cleared, [20], 'Lv20 应只进入下一轮自己的 cleared');
}

// 钱包和强化都成功、最终轮次提交失败：重载不能重复入账，只补写 receipt/下一轮状态。
{
  const storage = new FaultStorage();
  const controls = {};
  const run = boot(storage, controls);
  winFirstN(run, 19);
  storage.arm(STATE, 2); // 第 1 次是记录 Lv20；第 2 次是 finalizePaid 清空并进入下一轮。
  assert.equal(run.context.HansenRoundReward._win(20), false);
  assert.equal(balance(storage, 'coin'), 300);
  assert.equal(balance(storage, 'gem'), 88);
  assert.notEqual(storage.getItem(BOOST_LEDGER), null);
  assert.notEqual(storage.getItem(TX), null);
  assert.equal(storage.json(STATE).roundNo, 1);
  assert.equal(storage.json(STATE).cleared.length, 20);

  const reload = boot(storage, controls);
  assert.equal(reload.context.HansenRoundReward.recover(), true);
  assert.equal(storage.getItem(TX), null);
  assert.equal(storage.getItem(BOOST_PENDING), null);
  assertPaidOnce(storage, 'state commit recovery');
}

// 状态已经 commit、仅 pending 删除失败：下次恢复只能清凭据，不能再次发奖。
{
  const storage = new FaultStorage();
  const controls = {};
  const run = boot(storage, controls);
  winFirstN(run, 19);
  storage.arm(TX, 1, 'remove');
  assert.equal(run.context.HansenRoundReward._win(20), true);
  assert.notEqual(storage.getItem(TX), null);
  assertPaidOnce(storage, 'pending cleanup initial');
  const reload = boot(storage, controls);
  assert.equal(reload.context.HansenRoundReward.recover(), true);
  assert.equal(storage.getItem(TX), null);
  assertPaidOnce(storage, 'pending cleanup recovery');
}

console.log('✅ HF6 事务回归：旧 v942 隔离、损坏 pending fail-closed、满轮无 pending 自动重建、钱包/提交/清理断点均恰好一次');
