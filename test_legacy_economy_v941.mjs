import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const cardsSource = fs.readFileSync(new URL('./hansen_cards.js', import.meta.url), 'utf8');
const seasonSource = fs.readFileSync(new URL('./hansen_season.js', import.meta.url), 'utf8');

function makeStorage(seed = {}) {
  const data = new Map(Object.entries(seed).map(([key, value]) => [key, String(value)]));
  return {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); },
    snapshot() { return Object.fromEntries(data); }
  };
}

function elementStub(tag = 'div') {
  return {
    tagName: String(tag).toUpperCase(),
    style: {}, dataset: {}, children: [], parentNode: null,
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    insertBefore(child) { return this.appendChild(child); },
    removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    addEventListener() {}, setAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, contains() { return false; } },
    textContent: '', innerHTML: '', id: ''
  };
}

function documentStub() {
  const body = elementStub('body');
  const head = elementStub('head');
  return {
    readyState: 'complete', body, head, documentElement: elementStub('html'),
    createElement: elementStub,
    getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}
  };
}

// ── hansen_cards.js: 只记录，经济必须为零；关号不能从 S.level 推断。 ──
{
  const storage = makeStorage();
  const economy = [];
  const bosses = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
  const document = documentStub();
  let baseVictories = 0;
  const context = {
    console, localStorage: storage, document,
    location: { pathname: '/island_action.html' },
    BOSSES: bosses, bossCurrent: bosses[3],
    S: { level: 19, bossCurrentLv: 4, bossUnlocked: 20 },
    showScreen() {}, bossVictory() { baseVictories++; return 'base-victory'; },
    addGem(n) { economy.push(['legacy-gem-or-coin', n]); },
    addXP(n) { economy.push(['xp', n]); },
    HansenCoins: { add(n) { economy.push(['coins', n]); } },
    HansenGems: { add(n) { economy.push(['gems', n]); } },
    HansenCrystal: { grantBoost(n) { economy.push(['boost', n]); } },
    setTimeout() { return 1; }, clearTimeout() {},
    requestIdleCallback() { return 1; },
    Image: class {}, Audio: class {}, Date, Math,
    addEventListener() {}, innerWidth: 390, innerHeight: 844
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(cardsSource, context, { filename: 'hansen_cards.js' });

  assert.equal(context.bossVictory(), 'base-victory');
  assert.equal(baseVictories, 1);
  let cardData = JSON.parse(storage.getItem('hansen_card_data_action'));
  assert.deepEqual(cardData.collected, [4], '普通战必须记录实际 bossCurrent，而不是 S.level=19');

  context.bossCurrent = null;
  delete context.S.bossCurrentLv;
  context.S.level = 15;
  context.bossVictory();
  cardData = JSON.parse(storage.getItem('hansen_card_data_action'));
  assert.deepEqual(cardData.collected, [4], '没有权威 Boss 关号时不得把 XP 段位 S.level 冒充关号');

  context._hansenRebattleLv = 7;
  context.bossCurrent = bosses[18];
  context.S.level = 20;
  context.bossVictory();
  cardData = JSON.parse(storage.getItem('hansen_card_data_action'));
  assert.deepEqual(cardData.collected, [4, 7], '重战必须优先记录真实 _hansenRebattleLv');

  for (let lv = 1; lv <= 20; lv++) context.hansenCardsMarkBoss(lv);
  cardData = JSON.parse(storage.getItem('hansen_card_data_action'));
  assert.equal(cardData.collected.length, 20);
  assert.equal(cardData.masterUnlocked, true);
  assert.deepEqual(economy, [], '卡牌首记和 20 关全亮均不得暗发金币/钻石/XP/强化');
}

// ── hansen_season.js: 旧积分与里程碑永久只读，answer/boss 调用均不得写账或发奖。 ──
{
  const initialSeason = JSON.stringify({
    points: { S1: 199 },
    unlockedCards: [],
    claimedMilestones: { S1: [] }
  });
  const storage = makeStorage({
    hansen_season_data: initialSeason,
    hansen_season_wordcap: 'legacy-wordcap-must-stay',
    hansen_season_bosscap: 'legacy-bosscap-must-stay'
  });
  const before = storage.snapshot();
  const economy = [];
  let answers = 0;
  let baseVictories = 0;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-07-13T12:00:00Z'])); }
    static now() { return Date.parse('2026-07-13T12:00:00Z'); }
  }
  const document = documentStub();
  const markAnswer = function() { answers++; return 'answer'; };
  const context = {
    console, localStorage: storage, document,
    location: { pathname: '/island_season.html' },
    markAnswer,
    bossVictory() { baseVictories++; return 'boss'; },
    HansenCoins: { add(n) { economy.push(['coins', n]); } },
    HansenGems: { add(n) { economy.push(['gems', n]); } },
    HansenCrystal: { grantBoost(n) { economy.push(['boost', n]); } },
    addXP(n) { economy.push(['xp', n]); },
    setTimeout() { return 1; }, clearTimeout() {},
    setInterval(fn) { fn(); return 1; }, clearInterval() {},
    Date: FixedDate, Math,
    addEventListener() {}, fetch() { return Promise.resolve(); }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(seasonSource, context, { filename: 'hansen_season.js' });

  assert.equal(context.markAnswer, markAnswer, 'v941 不应再包裹 markAnswer');
  assert.equal(context.markAnswer(12, true), 'answer');
  assert.equal(answers, 1);
  assert.equal(context.HansenSeason.getPoints(), 199, '旧积分应可只读展示');
  assert.equal(context.HansenSeason.pointsReadOnly, true);
  assert.equal(context.HansenSeason.addPoints(10000), false, '兼容 addPoints API 必须是明确 no-op');
  assert.equal(context.HansenSeason.nextMilestone(), null, '停用后不得宣传下一笔可领里程碑');
  assert.equal(context.bossVictory(), 'boss');
  assert.equal(context.bossVictory(), undefined, '3 秒重复 Boss 结算锁仍应保留');
  assert.equal(baseVictories, 1);
  assert.deepEqual(storage.snapshot(), before, '答题、Boss 与 addPoints 均不得改旧积分/防刷副账');
  assert.deepEqual(economy, [], '旧 200/500 积分里程碑不得再发金币/XP/强化/钻石');
}

assert.doesNotMatch(cardsSource, /\b(?:addGem|addXP)\s*\(/, '卡牌模块不得保留旧经济发奖调用');
assert.doesNotMatch(seasonSource, /\b(?:HansenCoins|HansenGems|HansenCrystal|addXP)\b/, '赛季模块不得保留经济发奖入口');

console.log('v941 legacy economy isolation: PASS');
