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
/* v1060: 每日任务由 7 条扩充为 12 条（POOL 现有 12 个类型，模块内守卫为 length<12/>12）。
   本测试的 7 是扩充前的旧值，一直红着没人改。 */
assert.equal(listA.length, 12);
assert.equal(new Set(listA).size, 12);
assert.equal(new Set(a.HansenQuestGlobal.status().list.map(q => q.type)).size, 12);
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
/* v1060: 原为写死的 7 —— 本循环的本意是「逐条全部领取」(后面还要断言全清 200 奖励)，
   任务扩充到 12 条后只领 7 条，全清条件根本不成立。改为按实际条数走，今后再扩不会失配。 */
const TOTAL = d.HansenQuestGlobal.status().list.length;
for (let i = 0; i < TOTAL; i++) {
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

/* ═══ 🔴v1060 新增：伪造「全部已领取」不得白拿任何奖励 ═══
   背景：v1018/v1019 把备份层的「已领取必须满进度」「条数必须为 N」等校验
   一并放宽了（内嵌任务副本走散曾令云备份自 v1000 起整个抛错，放宽是对的）。
   但放宽之后，"伪造备份把所有任务标成已领取"这条路就没人守了。
   实测结论：只会自损（放弃奖励），拿不到任何东西——这里把它固化成断言。 */
{
  const s2 = new Storage();
  boot(s2, 0);
  const raw = JSON.parse(s2.getItem('hansen_global_daily_quests_v941'));
  raw.list.forEach(q => { q.claimed = true; q.progress = 0; });
  s2.setItem('hansen_global_daily_quests_v941', JSON.stringify(raw));
  const ev = [];
  const d2 = boot(s2, 0, ev);
  const coins = ev.filter(e => e[0] === 'coin');
  assert.equal(coins.length, 0, '★ 伪造"全部已领取"不得发放任何金币');
  assert.equal(coins.reduce((n, e) => n + e[1], 0), 0, '★ 金币总额必须为 0');
  assert.equal(d2.S.xp, 0, '★ 伪造"全部已领取"不得发放任何 XP');
  assert.equal(d2.claimQuest(0), false, '★ 已标记领取的任务不能再领一次');
  assert.equal(d2.HansenQuestGlobal.status().allDay, '', '★ 全清奖励不得因伪造状态而触发');
}
console.log('v1060 伪造已领取防线: 全绿');
