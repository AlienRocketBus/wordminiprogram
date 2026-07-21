import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_quest_global.js', import.meta.url), 'utf8');
const XP_PENDING = 'hansen_reward_xp_pending_v942';
const XP_LEDGER = 'hansen_reward_xp_awards_v942';
const ANIMAL = 'wordIslandAnimal';
const FOOD = 'wordIslandFood';

class FixedDate extends Date {
  constructor(...args) { super(args.length ? args[0] : '2026-07-14T12:00:00-06:00'); }
  static now() { return new FixedDate().getTime(); }
}
class Storage {
  constructor(seed = {}) { this.data = {...seed}; }
  get length() { return Object.keys(this.data).length; }
  key(i) { return Object.keys(this.data)[i] ?? null; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; }
  setItem(k, v) { this.data[k] = String(v); }
  removeItem(k) { delete this.data[k]; }
}
const state = (totalXP, charXP) => JSON.stringify({
  totalXP, charXP, xp:totalXP, level:1, learned:[], wrongs:{}, mc:{},
  stats:{modesPlayed:[], gameCounts:{}}, quests:{day:'', list:[]}
});
const object = (storage, key) => JSON.parse(storage.getItem(key) || '{}');

function boot(storage, saveKey) {
  const disk = object(storage, saveKey);
  const S = {totalXP:disk.totalXP || 0, charXP:Number(storage.getItem('hansen_wallet_charxp') || 0),
    xp:disk.xp || 0, level:disk.level || 1, streak:0, quests:{day:'', list:[]}};
  const context = {
    console:{log(){},warn(){},error(){}}, JSON, Math, Number, parseInt, isFinite, Date:FixedDate,
    localStorage:storage, S, __hsnSaveKey:saveKey,
    __hsnSaveNow(){ return true; }, __hsnSaveNotice(){}, dispatchEvent(){},
    CustomEvent:class {}, setTimeout(fn){ fn(); return 1; }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_quest_global.js'});
  return context;
}

/* Animal 领取 +20 XP：pending 已建立，全局 charXP 已从 150 写成 170，
   但硬崩发生在 Animal.totalXP 写入前。用户随后从 Food 打开。 */
const id = 'quest:2026-7-14:learn3:xp';
const pending = {
  version:942, id, amount:20, originKey:ANIMAL,
  beforeIsland:100, targetIsland:120,
  beforeGlobal:150, targetGlobal:170,
  createdAt:FixedDate.now()
};
const storage = new Storage({
  [ANIMAL]:state(100, 150), [ANIMAL + '_bak']:state(90, 150),
  [FOOD]:state(50, 150), [FOOD + '_bak']:state(45, 150),
  hansen_wallet_charxp:'170', [XP_PENDING]:JSON.stringify(pending)
});

const food = boot(storage, FOOD);
assert.equal(storage.getItem('hansen_wallet_charxp'), '170', '已写的全局 XP 绝不能再加一次');
assert.equal(object(storage, ANIMAL).totalXP, 120, 'XP 必须归回 pending.originKey 指向的 Animal');
assert.equal(object(storage, ANIMAL + '_bak').totalXP, 120, '来源岛安全快照也必须收口');
assert.equal(object(storage, FOOD).totalXP, 50, '当前打开的 Food 不得误收 Animal 的 XP');
assert.equal(food.S.totalXP, 50, 'Food 内存态也不得被跨岛 pending 污染');
assert.equal(storage.getItem(XP_PENDING), null, '来源岛与全局都确认后 pending 必须清理');
assert.deepEqual(object(storage, XP_LEDGER)[id], {
  amount:20, originKey:ANIMAL, targetIsland:120, targetGlobal:170, at:FixedDate.now()
});
assert.equal('hansenRewardXpProofsV942' in object(storage, ANIMAL), false, '临时岛内证明在账本提交后清理');

// 再开任意岛不得重放；三份数值保持完全不变。
boot(storage, FOOD);
assert.equal(storage.getItem('hansen_wallet_charxp'), '170');
assert.equal(object(storage, ANIMAL).totalXP, 120);
assert.equal(object(storage, FOOD).totalXP, 50);

console.log('XP origin recovery v942: global-written/source-not-written hard crash + cross-island reload exactly-once ✅');
