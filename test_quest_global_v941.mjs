import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('./hansen_quest_global.js', import.meta.url), 'utf8');

class Storage {
  constructor(seed = {}) { this.data = {...seed}; this.writes = []; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.data, k) ? this.data[k] : null; }
  setItem(k, v) { this.data[k] = String(v); this.writes.push([k, String(v)]); }
  removeItem(k) { delete this.data[k]; }
}

class FixedDate extends Date {
  // Daily quests follow the player's local calendar.  Keep the fixture on the
  // same local day in every CI/container timezone instead of pinning a Denver
  // instant that becomes July 15 in Asia.
  constructor(...args) { super(args.length ? args[0] : '2026-07-14T12:00:00'); }
  static now() { return new FixedDate().getTime(); }
}

function boot(storage, learnedCount, events = []) {
  const S = {learned:Array(learnedCount).fill(0), streak:999, quests:{day:'', list:[]}, xp:0, physical:'test-island'};
  const context = {
    console, JSON, Math, Date:FixedDate, isFinite, localStorage:storage, S,
    setTimeout(fn) { events.push(['timer']); fn(); return 1; },
    save() { events.push(['save']); },
    addCoin(n) {
      const state = JSON.parse(storage.getItem('hansen_global_daily_quests_v941'));
      events.push(['coin', n, state]);
    },
    addXP(n) {
      const state = JSON.parse(storage.getItem('hansen_global_daily_quests_v941'));
      events.push(['xp', n, state]); S.xp += n;
    },
    HansenCheckin:{getStreak(){ return 5; }},
    HansenCrystal:{grantBoost(min, silent){ events.push(['boost', min, silent]); }},
    showToast(){}, playOpenChest(){}, bigConfetti(){}
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, {filename:'hansen_quest_global.js'});
  return context;
}

// 同一天的 7 条任务完全由日期决定，不受当前岛 learned 或首次进入页面影响。
const aStore = new Storage();
const a = boot(aStore, 0);
const listA = a.HansenQuestGlobal.status().list.map(q => q.id);
assert.equal(listA.length, 7);
assert.equal(new Set(listA).size, 7);
assert.equal(new Set(a.HansenQuestGlobal.status().list.map(q => q.type)).size, 7);
assert.ok(a.HansenQuestGlobal.status().list.some(q => q.type === 'scramble'));
assert.ok(a.HansenQuestGlobal.status().list.some(q => q.type === 'type'));

const bStore = new Storage();
const b = boot(bStore, 9999);
assert.deepEqual([...b.HansenQuestGlobal.status().list.map(q => q.id)], listA);

// 切到另一物理岛后仍读取同一 list / progress / claimed。
const firstType = a.HansenQuestGlobal.status().list[0].type;
a.progressQuest(firstType, 1);
const c = boot(aStore, 200);
assert.deepEqual([...c.HansenQuestGlobal.status().list.map(q => q.id)], listA);
assert.equal(c.HansenQuestGlobal.status().list[0].progress, 1);

// 逐条完成并领取；每笔发奖发生时，对应 claimed 必须已经写入全局账本。
let raw = JSON.parse(aStore.getItem('hansen_global_daily_quests_v941'));
raw.list.forEach(q => { q.progress = q.goal; });
aStore.setItem('hansen_global_daily_quests_v941', JSON.stringify(raw));
const events = [];
const d = boot(aStore, 0, events);
let expectedXP = 0;
let expectedCoins = 0;
for (let i = 0; i < 7; i++) {
  const before = d.HansenQuestGlobal.status().list[i];
  expectedXP += before.reward.xp;
  expectedCoins += Math.max(20, Math.round(before.reward.xp * 0.6 / 5) * 5);
  assert.equal(d.claimQuest(i), true);
  const coinEvent = events.findLast(e => e[0] === 'coin');
  assert.equal(coinEvent[2].list[i].claimed, true, 'claimed 必须先持久化再发奖');
}
expectedCoins += 200; // 全清：100 + min(全局连签5, 7) × 20
assert.equal(d.S.xp, expectedXP, '任务 XP 必须进入当前物理岛的 S/addXP');
assert.equal(events.filter(e => e[0] === 'coin').reduce((n, e) => n + e[1], 0), expectedCoins);
assert.equal(d.HansenQuestGlobal.status().allDay, '2026-7-14');
const finalBonusEvent = events.filter(e => e[0] === 'coin').at(-1);
assert.equal(finalBonusEvent[1], 200);
assert.equal(finalBonusEvent[2].allDay, '2026-7-14', 'allDay 必须先持久化再发全清奖励');

// 重复点击、切页后再点都不能二次发奖。
const coinEventCount = events.filter(e => e[0] === 'coin').length;
assert.equal(d.claimQuest(0), false);
const e = boot(aStore, 0, events);
assert.equal(e.claimQuest(6), false);
assert.equal(events.filter(x => x[0] === 'coin').length, coinEventCount);

console.log('✅ v941 全局每日任务：日期确定、27页共享、先落账后发奖、全局连签与物理岛XP均通过');
