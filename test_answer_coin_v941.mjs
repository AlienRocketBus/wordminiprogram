import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage {
  constructor(seed = {}) { this.data = Object.fromEntries(Object.entries(seed).map(([k,v]) => [k,String(v)])); }
  get length() { return Object.keys(this.data).length; }
  key(i) { return Object.keys(this.data)[i] ?? null; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.data,k) ? this.data[k] : null; }
  setItem(k,v) { this.data[k] = String(v); }
  removeItem(k) { delete this.data[k]; }
}

const DAY = '2026-7-13';
const storage = new Storage({
  hansen_starter_coins_given: '1',
  hsn_ans_coin_day: DAY,
  hsn_ans_coin_today: '0'
});
let page = 'land1';
let coins = 0;
const document = {
  readyState: 'complete',
  addEventListener() {},
  getElementById() { return null; },
  querySelector() { return null; },
  createElement() { return {style:{},classList:{add(){},remove(){}},appendChild(){}}; },
  head: {appendChild(){}},
  body: {appendChild(){}}
};
const context = {
  console, JSON, Math, Number, isFinite,
  localStorage: storage,
  document,
  S: {coinDay:DAY,coinWordCount:{},learned:[],wrongs:{},stats:{modesPlayed:[],maxCombo:0},level:1,bossWon:[],pet:{}},
  HansenCoins: {add(n){coins += n;},get(){return coins;}},
  HansenCanonical: {
    currentRef(){ return page; },
    slotId(ref,idx){ return ref === 'land1' || ref === 'season' ? `season:${idx}` : `${ref}:${idx}`; },
    absorbCurrent(){}, totalLearned(){return 0;}
  },
  today(){ return DAY; },
  addCoin(){}, addGem(){}, updateTopBar(){}, save(){}, markAnswer(){}, markMode(){},
  setTimeout(fn){ fn(); return 1; }, clearTimeout(){},
};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hansen_island_upgrade.js', import.meta.url),'utf8'),context,{filename:'hansen_island_upgrade.js'});

assert.equal(typeof context.earnCoinOnCorrect,'function');
assert.equal(context.earnCoinOnCorrect(0),true);
assert.equal(context.earnCoinOnCorrect(0),true);
assert.equal(context.earnCoinOnCorrect(0),true);
assert.equal(context.earnCoinOnCorrect(0),false,'同一 canonical 词位每天最多3次');
assert.equal(coins,3);

// 换到 Season 总入口后，Land1[0] 仍是 season:0，不能重新获得3次额度。
page = 'season';
context.S = {coinDay:DAY,coinWordCount:{},learned:[],wrongs:{},stats:{modesPlayed:[]},level:1,bossWon:[],pet:{}};
assert.equal(context.earnCoinOnCorrect(0),false,'Land/Season 别名不得绕过同词日上限');

// 相同本地序号但属于另一个 canonical 岛，是不同词位，可以正常得币。
page = 'action';
assert.equal(context.earnCoinOnCorrect(0),true);
assert.equal(coins,4);

const ledger = JSON.parse(storage.getItem('hansen_answer_coin_words_v941'));
assert.equal(ledger.words['season:0'],3);
assert.equal(ledger.words['action:0'],1);

// 全局日上限边界：1999时只允许最后1枚，2000后不再发。
storage.setItem('hsn_ans_coin_today','1999');
page = 'animal';
assert.equal(context.earnCoinOnCorrect(7),true);
assert.equal(storage.getItem('hsn_ans_coin_today'),'2000');
assert.equal(context.earnCoinOnCorrect(8),false);
assert.equal(coins,5);

console.log('answer coin v941: canonical per-word ledger + global 2000 boundary ✅');
