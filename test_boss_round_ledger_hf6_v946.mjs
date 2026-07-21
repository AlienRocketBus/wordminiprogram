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
    }
  };
}

function fakeDocument() {
  const body = {appendChild(node) { node.parentNode = body; }, removeChild(node) { node.parentNode = null; }};
  return {
    body, head:{appendChild() {}},
    createElement(tag) {
      return {
        tag, style:{}, textContent:'', innerHTML:'', parentNode:null,
        addEventListener() {}, remove() { if (this.parentNode) this.parentNode.removeChild(this); },
        querySelector() { return {addEventListener() {}}; }
      };
    },
    addEventListener() {}, removeEventListener() {}
  };
}

function boot(storage, path = '/island_action.html', bosses = 20) {
  const notices = [];
  const context = {
    console, JSON, Math, Number, Date:ClockDate, parseInt, isFinite,
    location:{pathname:path}, localStorage:storage, document:fakeDocument(),
    BOSSES:Array.from({length:bosses}, (_, i) => ({id:i + 1})),
    HansenCoins:wallet(storage, 'coin'), HansenGems:wallet(storage, 'gem'),
    HansenRoundBar:{refresh() {}},
    __hsnSaveNotice(message) { notices.push(message); },
    CustomEvent:class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    dispatchEvent() {}, setTimeout() { return 1; }, setInterval() { return 1; }, clearInterval() {},
    bossVictory() { return 'victory'; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_round_reward.js'});
  return {context, notices};
}

function full(n) { return Array.from({length:n}, (_, i) => i + 1); }
function order(n) {
  const result = [];
  for (let i = 2; i <= n; i += 2) result.push(i);
  for (let i = n % 2 ? n : n - 1; i >= 1; i -= 2) result.push(i);
  return result;
}
function balance(storage, kind) { return Number(storage.getItem(`__test_${kind}_balance`) || 0); }
function ids(storage, kind) { return Object.keys(storage.json(`__test_${kind}_ledger`, {})); }
function completeRound(run, n) {
  const sequence = order(n);
  for (let i = 0; i < sequence.length - 1; i++) {
    assert.equal(run.context.HansenRoundReward._win(sequence[i]), false);
  }
  assert.equal(run.context.HansenRoundReward._win(sequence.at(-1)), true);
}

// 任一损坏字段都必须 fail-closed，并原样保留存档，不能“自动修好”后误发奖励。
{
  const key = 'hansen_boss_round_state_v946_action';
  const valid = {
    schema:1, version:946, island:'action', mode:'regular', total:20,
    roundNo:2, completedCount:1, cleared:[1, 4], updatedAt:NOW,
    lastReceipt:{id:'round:v946:regular:action:r1', roundNo:1, paidAt:NOW}
  };
  const cases = [
    ['malformed JSON', '{not-json'],
    ['wrong schema', JSON.stringify({...valid, schema:2})],
    ['wrong version', JSON.stringify({...valid, version:945})],
    ['wrong island', JSON.stringify({...valid, island:'animal'})],
    ['wrong mode', JSON.stringify({...valid, mode:'land'})],
    ['wrong total', JSON.stringify({...valid, total:19})],
    ['round/count mismatch', JSON.stringify({...valid, roundNo:9})],
    ['duplicate cleared', JSON.stringify({...valid, cleared:[1, 1]})],
    ['unsorted cleared', JSON.stringify({...valid, cleared:[4, 1]})],
    ['out-of-range cleared', JSON.stringify({...valid, cleared:[1, 21]})],
    ['bad receipt id', JSON.stringify({...valid, lastReceipt:{...valid.lastReceipt, id:'round:v946:regular:action:r9'}})],
    ['bad receipt round', JSON.stringify({...valid, lastReceipt:{...valid.lastReceipt, roundNo:2}})]
  ];
  for (const [label, raw] of cases) {
    const storage = new Storage({[key]:raw});
    const run = boot(storage);
    assert.equal(run.context.HansenRoundReward.status().valid, false, `${label}: UI 状态必须标为无效`);
    assert.equal(run.context.HansenRoundReward._win(3), false, `${label}: 胜利不得推进`);
    assert.equal(storage.getItem(key), raw, `${label}: 原始数据必须保留`);
    assert.equal(balance(storage, 'coin'), 0, `${label}: 不得发金币`);
    assert.equal(balance(storage, 'gem'), 0, `${label}: 不得发钻石`);
    assert.ok(run.notices.length >= 1, `${label}: 必须提示存档异常`);
  }
}

// 迁移只读取 HF5 已完成轮数；旧永久 20/20 不迁入 cleared。第 3、4 轮各自独立结算。
{
  const storage = new Storage({
    hansen_boss_round_count_action:'2',
    hansen_boss_round_cleared_action:JSON.stringify(full(20))
  });
  const run = boot(storage);
  assert.equal(run.context.HansenRoundReward.roundNo(), 3);
  assert.deepEqual([...run.context.HansenRoundReward.progress()], []);

  assert.equal(run.context.HansenRoundReward._win(18), false);
  assert.equal(run.context.HansenRoundReward._win(18), false, '同轮重复 Lv18 不能累加');
  assert.deepEqual([...run.context.HansenRoundReward.progress()], [18]);
  for (const lv of order(20).filter(lv => lv !== 18).slice(0, -1)) {
    assert.equal(run.context.HansenRoundReward._win(lv), false);
  }
  const last = order(20).filter(lv => lv !== 18).at(-1);
  assert.equal(run.context.HansenRoundReward._win(last), true);
  assert.equal(run.context.HansenRoundReward.roundNo(), 4);
  assert.equal(run.context.HansenRoundReward.count(), 3);
  assert.deepEqual([...run.context.HansenRoundReward.progress()], []);

  completeRound(run, 20);
  assert.equal(run.context.HansenRoundReward.roundNo(), 5);
  assert.equal(run.context.HansenRoundReward.count(), 4);
  assert.equal(balance(storage, 'coin'), 600);
  assert.equal(balance(storage, 'gem'), 176);
  assert.deepEqual(ids(storage, 'coin'), [
    'round:v946:regular:action:r3:coins',
    'round:v946:regular:action:r4:coins'
  ]);
  assert.deepEqual(ids(storage, 'gem'), [
    'round:v946:regular:action:r3:gems',
    'round:v946:regular:action:r4:gems'
  ]);
  assert.ok(ids(storage, 'coin').every(id => /:r[1-9][0-9]*:coins$/.test(id)), '稳定钱包来源必须包含明确 roundNo');
}

// 各岛必须使用独立 state key；一个岛的本轮胜利不能污染另一个岛。
{
  const storage = new Storage();
  const action = boot(storage, '/island_action.html');
  assert.equal(action.context.HansenRoundReward._win(1), false);
  const animal = boot(storage, '/island_animal.html');
  assert.equal(animal.context.HansenRoundReward._win(2), false);
  assert.deepEqual([...animal.context.HansenRoundReward.progress()], [2]);
  const actionReload = boot(storage, '/island_action.html');
  assert.deepEqual([...actionReload.context.HansenRoundReward.progress()], [1]);
  assert.notEqual(storage.getItem('hansen_boss_round_state_v946_action'), storage.getItem('hansen_boss_round_state_v946_animal'));
}

// 源码层兜底：receipt/source 由 roundNo 构造，不能退回没有轮次号的每日或岛级来源。
assert.match(source, /receiptId:'round:v946:'\+state\.mode\+':'\+k\+':r'\+state\.roundNo/);
assert.match(source, /function sourceBase\(tx\)\{[^}]*tx\.receiptId/);
assert.match(source, /function gemPaidToday\(\)\{ return isSeason\(islandKey\(\)\)&&!!seasonLedger\(\); \}/, '旧每日键只能兼容清理，不能重新成为普通岛资格');

console.log('✅ HF6 独立轮次账本：损坏 fail-closed、旧进度隔离、跨轮/跨岛隔离、roundNo 稳定来源全部通过');
