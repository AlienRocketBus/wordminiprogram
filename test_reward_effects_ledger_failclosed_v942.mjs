import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const questSource = fs.readFileSync(new URL('./hansen_quest_global.js', import.meta.url), 'utf8');
const roundSource = fs.readFileSync(new URL('./hansen_round_reward.js', import.meta.url), 'utf8');
const XP_LEDGER = 'hansen_reward_xp_awards_v942';
const XP_PENDING = 'hansen_reward_xp_pending_v942';
const BOOST_LEDGER = 'hansen_reward_boost_awards_v942';
const BOOST_PENDING = 'hansen_reward_boost_pending_v942';
const SAVE = 'wordIslandAnimal';

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
const island = totalXP => JSON.stringify({totalXP, charXP:totalXP, xp:totalXP, level:1,
  learned:[], wrongs:{}, mc:{}, stats:{modesPlayed:[],gameCounts:{}}, quests:{day:'',list:[]}});

function bootQuest(storage) {
  const S = {totalXP:100,charXP:100,xp:100,level:1,streak:0,quests:{day:'',list:[]}};
  const notices=[];
  const c={console:{log(){},warn(){},error(){}},JSON,Math,Number,parseInt,isFinite,Date:FixedDate,
    localStorage:storage,S,__hsnSaveKey:SAVE,__hsnSaveNow(){return true;},
    __hsnSaveNotice(msg){notices.push(msg);},dispatchEvent(){},CustomEvent:class {},setTimeout(fn){fn();return 1;}};
  c.window=c;vm.createContext(c);vm.runInContext(questSource,c,{filename:'hansen_quest_global.js'});return {c,notices};
}

for (const bad of ['{broken', '[]', JSON.stringify({'quest:bad':{amount:20,actual:'20',at:FixedDate.now()}})]) {
  const storage=new Storage({[SAVE]:island(100),[SAVE+'_bak']:island(95),hansen_wallet_charxp:'100',
    [XP_LEDGER]:bad,hsn_crystal_boost_until:'1000'});
  const {c,notices}=bootQuest(storage), beforeMain=storage.getItem(SAVE);
  assert.equal(c.HansenRewardEffectsV942.xpAward('quest:2026-7-14:test:xp',20),false);
  assert.equal(storage.getItem(XP_LEDGER),bad,'损坏 XP ledger 必须原样保留供修复/取证');
  assert.equal(storage.getItem(XP_PENDING),null,'损坏 ledger 时不得建立新 XP pending');
  assert.equal(storage.getItem('hansen_wallet_charxp'),'100','损坏 ledger 时不得重发全局 XP');
  assert.equal(storage.getItem(SAVE),beforeMain,'损坏 ledger 时不得改来源岛 XP');
  assert.ok(notices.some(x=>x.includes('经验奖励账本已损坏')));
}

for (const bad of ['{broken', '[]', JSON.stringify({'quest:bad':{minutes:'90',target:123,at:FixedDate.now()}})]) {
  const storage=new Storage({[SAVE]:island(100),[SAVE+'_bak']:island(95),hansen_wallet_charxp:'100',
    [BOOST_LEDGER]:bad,hsn_crystal_boost_until:'1000'});
  const {c,notices}=bootQuest(storage);
  assert.equal(c.HansenRewardEffectsV942.boostAward('quest:2026-7-14:all:boost',90),false);
  assert.equal(storage.getItem(BOOST_LEDGER),bad,'损坏 boost ledger 必须原样保留供修复/取证');
  assert.equal(storage.getItem(BOOST_PENDING),null,'损坏 ledger 时不得建立新 boost pending');
  assert.equal(storage.getItem('hsn_crystal_boost_until'),'1000','损坏 ledger 时不得重发强化时长');
  assert.ok(notices.some(x=>x.includes('强化奖励账本已损坏')));
}

// Round 在 Quest 脚本加载前也可能先结算；它自己的 boost 实现同样必须失败关闭。
{
  const bad='{round-ledger-broken',storage=new Storage({
    [BOOST_LEDGER]:bad,hsn_crystal_boost_until:'1000',land3_prog:'5'
  });
  const wallet={award(){return true;}};
  const c={console:{log(){},warn(){},error(){}},JSON,Math,Number,parseInt,isFinite,Date:FixedDate,
    localStorage:storage,location:{pathname:'/island_land3.html'},BOSSES:new Array(5),
    HansenCoins:wallet,HansenGems:wallet,__hsnSaveNotice(){},
    document:{head:{appendChild(){}},createElement(){return {style:{},addEventListener(){},querySelector(){return null;},remove(){}};}},
    setTimeout(fn){fn();return 1;},setInterval(){return 1;},clearInterval(){},CustomEvent:class {},dispatchEvent(){}};
  c.window=c;vm.createContext(c);vm.runInContext(roundSource,c,{filename:'hansen_round_reward.js'});
  assert.equal(c.HansenRoundReward._win(5),false,'Round 不得越过损坏的 boost ledger 完成结算');
  assert.equal(storage.getItem(BOOST_LEDGER),bad);
  assert.equal(storage.getItem('hsn_crystal_boost_until'),'1000');
  assert.equal(storage.getItem(BOOST_PENDING),null);
}

console.log('reward effects ledger fail-closed v942: corrupt JSON/schema preserved, XP/boost never reissued ✅');
