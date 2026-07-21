import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const DAY='2026-7-14',AUTH='hansen_answer_coin_words_v942',PENDING='hansen_answer_coin_pending_v942';
class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failSetOnce=null;this.failRemoveOnce=null;}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){k=String(k);if(this.failSetOnce===k){this.failSetOnce=null;throw new Error('set failure');}this.d[k]=String(v);}
  removeItem(k){k=String(k);if(this.failRemoveOnce===k){this.failRemoveOnce=null;throw new Error('remove failure');}delete this.d[k];}
}
class Wallet{
  constructor(){this.coins=0;this.ledger={};this.failOnce=false;}
  award(id,n){if(this.failOnce){this.failOnce=false;return false;}if(!Object.hasOwn(this.ledger,id)){this.ledger[id]=n;this.coins+=n;}return true;}
  add(n){this.coins+=n;}get(){return this.coins;}
}
function seed(total=0,words={}){return {[AUTH]:JSON.stringify({version:942,day:DAY,total,words}),hsn_ans_coin_day:DAY,hsn_ans_coin_today:String(total),hansen_starter_coins_given:'1'};}
function load(storage,wallet){
  const document={readyState:'complete',addEventListener(){},getElementById(){return null;},querySelector(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){}};},head:{appendChild(){}},body:{appendChild(){}}};
  const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},JSON,Math,Number,isFinite,Date,HansenCoins:wallet,
    HansenCanonical:{currentRef(){return 'action';},slotId(ref,idx){return 'action:'+idx;},absorbCurrent(){},totalLearned(){return 0;}},
    S:{coinDay:DAY,coinWordCount:{},learned:[],wrongs:{},stats:{modesPlayed:[],gameCounts:{}},level:1,bossWon:[],pet:{}},today(){return DAY;},
    addCoin(){},addGem(){},updateTopBar(){},save(){},markAnswer(){},markMode(){},setTimeout(fn){fn();return 1;},clearTimeout(){}};
  c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_island_upgrade.js',import.meta.url),'utf8'),c);return c;
}
function auth(s){return JSON.parse(s.getItem(AUTH));}

// 准备日志失败：不发币、不占词次数、不占日上限。
{
  const s=new Storage(seed()),w=new Wallet(),c=load(s,w);s.failSetOnce=PENDING;assert.equal(c.earnCoinOnCorrect(0),false);assert.equal(w.coins,0);assert.equal(auth(s).total,0);assert.equal(s.getItem(PENDING),null);
}

// 钱包第一次失败：pending 固定 source/ordinal；重载自动恢复一次，不多发。
{
  const s=new Storage(seed()),w=new Wallet();w.failOnce=true;let c=load(s,w);assert.equal(c.earnCoinOnCorrect(0),false);assert.ok(s.getItem(PENDING));assert.equal(w.coins,0);
  c=load(s,w);assert.equal(w.coins,1);assert.equal(auth(s).total,1);assert.equal(auth(s).words['action:0'],1);assert.equal(s.getItem(PENDING),null);
  load(s,w);assert.equal(w.coins,1,'再次重载不重复恢复同一 source');
}

// 金币已提交而权威 JSON 首写失败：重载只补 total+word commit，不重复发币。
{
  const s=new Storage(seed()),w=new Wallet(),c=load(s,w);s.failSetOnce=AUTH;assert.equal(c.earnCoinOnCorrect(0),false);assert.equal(w.coins,1);assert.equal(auth(s).total,0);assert.ok(s.getItem(PENDING));
  load(s,w);assert.equal(w.coins,1);assert.equal(auth(s).total,1);assert.equal(auth(s).words['action:0'],1);assert.equal(s.getItem(PENDING),null);
}

// 非权威兼容镜像每一个 setItem 失败都不得回滚/重复正式奖励；下一次加载会由 authority 修复。
for(const mirrorKey of ['hansen_answer_coin_words_v941','hsn_ans_coin_day','hsn_ans_coin_today']){
  const s=new Storage(seed()),w=new Wallet(),c=load(s,w);s.failSetOnce=mirrorKey;assert.equal(c.earnCoinOnCorrect(0),true,`${mirrorKey} 失败不应伪装正式事务失败`);assert.equal(w.coins,1);assert.equal(auth(s).total,1);load(s,w);assert.equal(w.coins,1);assert.equal(s.getItem('hsn_ans_coin_today'),'1');
}

// pending cleanup 失败：ledger+authority 已是提交点；重载清日志且不重发。
{
  const s=new Storage(seed()),w=new Wallet(),c=load(s,w);s.failRemoveOnce=PENDING;assert.equal(c.earnCoinOnCorrect(0),true);assert.equal(w.coins,1);assert.ok(s.getItem(PENDING));load(s,w);assert.equal(w.coins,1);assert.equal(s.getItem(PENDING),null);assert.equal(auth(s).total,1);
}

// 1999→2000 的断点：authority 写失败后重载补到 2000，下一题严格拒绝，绝不越过 cap。
{
  const s=new Storage(seed(1999,{'action:0':2})),w=new Wallet(),c=load(s,w);s.failSetOnce=AUTH;assert.equal(c.earnCoinOnCorrect(0),false);assert.equal(w.coins,1);assert.equal(auth(s).total,1999);
  const c2=load(s,w);assert.equal(auth(s).total,2000);assert.equal(auth(s).words['action:0'],3);assert.equal(c2.earnCoinOnCorrect(1),false);assert.equal(w.coins,1);assert.equal(auth(s).total,2000);
}

console.log('answer coin transaction v942: pending/award/authority/mirror/cleanup breakpoints + reload recovery + hard 2000 cap ✅');
