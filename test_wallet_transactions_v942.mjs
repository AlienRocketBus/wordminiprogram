import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failSet=null;this.failSetOnce=null;this.failRemoveOnce=null;this.failGet=false;}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){if(this.failGet)throw new Error('SecurityError');return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){k=String(k);if(this.failSet===k)throw new Error('QuotaExceededError');if(this.failSetOnce===k){this.failSetOnce=null;throw new Error('QuotaExceededError once');}this.d[k]=String(v);}
  removeItem(k){k=String(k);if(this.failRemoveOnce===k){this.failRemoveOnce=null;throw new Error('remove once');}delete this.d[k];}
}
const j=JSON.stringify;
function context(storage){
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},createElement(){return {style:{},appendChild(){},addEventListener(){}}},head:{appendChild(){}},body:{appendChild(){}}};
  const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,CustomEvent:class{},dispatchEvent(){},setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){}};c.window=c;c.globalThis=c;vm.createContext(c);return c;
}
function run(c,file){vm.runInContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),c,{filename:file});}

// ── 金币：余额+累计获得必须原子；sourceId 重放不重复，cleanup 失败也不能回滚已提交账本。
const cs=new Storage({hansen_starter_coins_given:'1',hansen_wallet_coins:'100',hansen_wallet_coins_earned:'150'}),cc=context(cs);run(cc,'hansen_coin_wallet.js');
assert.equal(cc.HansenCoins.add(10),110);assert.equal(cc.HansenCoins.getEarned(),160);
assert.equal(cc.HansenCoins.spend(20),true);assert.equal(cc.HansenCoins.get(),90);assert.equal(cc.HansenCoins.getEarned(),160,'消费不减少累计获得');
cs.failSet='hansen_wallet_coins_earned';assert.equal(cc.HansenCoins.add(10),90);cs.failSet=null;
assert.equal(cc.HansenCoins.get(),90);assert.equal(cc.HansenCoins.getEarned(),160,'earned 写失败必须回滚 balance');
assert.equal(cc.HansenCoins.award('test:coin:1',7),true);assert.equal(cc.HansenCoins.get(),97);assert.equal(cc.HansenCoins.getEarned(),167);
assert.equal(cc.HansenCoins.award('test:coin:1',7),true);assert.equal(cc.HansenCoins.get(),97,'同一 source 重放 no-op');
cs.failSet='hansen_wallet_coins';assert.equal(cc.HansenCoins.award('test:coin:retry',9),false);cs.failSet=null;assert.equal(cc.HansenCoins.get(),97);
assert.equal(cc.HansenCoins.award('test:coin:retry',9),true);assert.equal(cc.HansenCoins.get(),106);
cs.failRemoveOnce='hansen_coin_award_pending_v942';assert.equal(cc.HansenCoins.award('test:coin:cleanup',5),true);assert.equal(cc.HansenCoins.get(),111);
assert.ok(cs.getItem('hansen_coin_award_pending_v942'));assert.equal(cc.HansenCoins.recoverAwards(),true);assert.equal(cc.HansenCoins.get(),111);assert.equal(cs.getItem('hansen_coin_award_pending_v942'),null);
// 本地损坏/被篡改 pending 绝不能把钱包写到任意 target；拒绝并清理，余额与 earned 不变。
for(const bad of [
  {id:'evil',amount:-5,beforeWallet:111,beforeEarned:181,targetWallet:106,targetEarned:176,at:1},
  {id:'evil',amount:5,beforeWallet:111,beforeEarned:181,targetWallet:999999,targetEarned:186,at:1},
  {id:'evil',amount:null,beforeWallet:111,beforeEarned:181,targetWallet:111,targetEarned:181,at:1},
  {id:'__proto__',amount:5,beforeWallet:111,beforeEarned:181,targetWallet:116,targetEarned:186,at:1}
]){
  cs.setItem('hansen_coin_award_pending_v942',j(bad));assert.equal(cc.HansenCoins.recoverAwards(),false);assert.equal(cc.HansenCoins.get(),111);assert.equal(cc.HansenCoins.getEarned(),181);assert.equal(cs.getItem('hansen_coin_award_pending_v942'),null);
}

// 后恢复的旧岛金币仍会迁移；Infinity/损坏数字绝不污染钱包。
cs.setItem('wordIslandLate',j({coins:20}));cs.setItem('wordIslandLate_bak',j({coins:30}));cs.setItem('wordIslandBad',j({coins:1e309}));cc.__hansenCoinWalletLoaded=false;run(cc,'hansen_coin_wallet.js');
assert.equal(cc.HansenCoins.get(),131);assert.equal(JSON.parse(cs.getItem('wordIslandLate')).coins,0);assert.equal(JSON.parse(cs.getItem('wordIslandLate_bak')).coins,0);assert.equal(JSON.parse(cs.getItem('wordIslandBad')).coins,null);

// 启动金 source 是提交点：flag 在发奖后写失败/崩溃，重载只补 flag，不再送 300。
const ss=new Storage();ss.failSet='hansen_starter_coins_given';const sc=context(ss);run(sc,'hansen_coin_wallet.js');
assert.equal(sc.HansenCoins.get(),300);assert.equal(ss.getItem('hansen_starter_coins_given'),null);ss.failSet=null;sc.__hansenCoinWalletLoaded=false;run(sc,'hansen_coin_wallet.js');
assert.equal(sc.HansenCoins.get(),300);assert.equal(sc.HansenCoins.getEarned(),300);assert.equal(ss.getItem('hansen_starter_coins_given'),'1');

// ── 钻石：失败闭锁、幂等奖励、ledger 提交后 pending cleanup 失败不丢奖。
const gs=new Storage({hansen_gems_cleared_v1:'1',hansen_wallet_gems:'50'}),gc=context(gs);run(gc,'hansen_gem_system.js');
assert.equal(gc.HansenGems.spend(5),true);assert.equal(gc.HansenGems.get(),45);
gs.failSet='hansen_wallet_gems';assert.equal(gc.HansenGems.spend(5),false);assert.equal(gc.HansenGems.add(4),45);gs.failSet=null;assert.equal(gc.HansenGems.get(),45);
assert.equal(gc.HansenGems.award('test:gem:1',4),true);assert.equal(gc.HansenGems.award('test:gem:1',4),true);assert.equal(gc.HansenGems.get(),49);
gs.failRemoveOnce='hansen_gem_award_pending_v942';assert.equal(gc.HansenGems.award('test:gem:cleanup',3),true);assert.equal(gc.HansenGems.get(),52);assert.ok(gs.getItem('hansen_gem_award_pending_v942'));
assert.equal(gc.HansenGems.recoverAwards(),true);assert.equal(gc.HansenGems.get(),52);
for(const bad of [
  {id:'evil',amount:-3,before:52,target:49,at:1},
  {id:'evil',amount:3,before:52,target:999999999,at:1},
  {id:'evil',amount:null,before:52,target:52,at:1},
  {id:'constructor',amount:3,before:52,target:55,at:1}
]){
  gs.setItem('hansen_gem_award_pending_v942',j(bad));assert.equal(gc.HansenGems.recoverAwards(),false);assert.equal(gc.HansenGems.get(),52);assert.equal(gs.getItem('hansen_gem_award_pending_v942'),null);
}

// 旧钻石清零迁移任一步失败不打 flag，岛存档和钱包回滚。
const mf=new Storage({wordIslandAnimal:j({gems:12}),hansen_wallet_gems:'6'});mf.failSet='hansen_gems_cleared_v1';const mfc=context(mf);run(mfc,'hansen_gem_system.js');
assert.equal(JSON.parse(mf.getItem('wordIslandAnimal')).gems,12);assert.equal(mf.getItem('hansen_wallet_gems'),'6');assert.equal(mf.getItem('hansen_gems_cleared_v1'),null);

// ── 成就钱包：unlock/claim 只有严格回读成功才返回 true；reset 清主备且有删除水位。
const as=new Storage({wordIslandAnimal:j({lastSaveTime:10,achievements:[],achPending:['w1'],achNew:['w1']})}),ac=context(as);run(ac,'hansen_ach_wallet.js');
assert.equal(ac.HansenAch.isPending('w1'),true);as.failSet='hansen_wallet_ach';assert.equal(ac.HansenAch.claim('w1'),false);as.failSet=null;assert.equal(ac.HansenAch.isPending('w1'),true);
assert.equal(ac.HansenAch.claim('w1'),true);assert.equal(ac.HansenAch.isClaimed('w1'),true);
// 短暂读取 SecurityError 不得被当成“空成就”后覆盖真实 claimed。
const achBefore=as.d.hansen_wallet_ach;as.failGet=true;assert.equal(ac.HansenAch.unlock('w2'),false);assert.equal(as.d.hansen_wallet_ach,achBefore);as.failGet=false;assert.equal(ac.HansenAch.isClaimed('w1'),true);assert.equal(ac.HansenAch.unlock('w2'),true);
as.setItem('wordIslandAnimal_bak',j({lastSaveTime:10,achievements:['old'],achPending:[],achNew:[]}));assert.equal(ac.HansenAch.reset(),true);
assert.deepEqual(JSON.parse(as.getItem('hansen_wallet_ach')), {claimed:[],pending:[],newones:[]});assert.deepEqual(JSON.parse(as.getItem('wordIslandAnimal_bak')).achievements,[]);

console.log('wallet transactions v942: coin/gem atomic writes + lifetime earned + idempotent awards + achievement durability ✅');
