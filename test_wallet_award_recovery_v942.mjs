import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){this.d[String(k)]=String(v);}removeItem(k){delete this.d[String(k)];}
}
const j=JSON.stringify;
function load(file,seed){
  const storage=new Storage(seed),document={readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},createElement(){return {style:{}}},body:{appendChild(){}},head:{appendChild(){}}};
  const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,CustomEvent:class{},dispatchEvent(){},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}};c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL(`./${file}`,import.meta.url),'utf8'),c,{filename:file});return {c,storage};
}

// ledger 已提交后，残留 pending 只是清理标记；余额若已合法消费，不得抬回旧 target。
let pending={id:'award:coin:done',amount:10,beforeWallet:100,beforeEarned:100,targetWallet:110,targetEarned:110,at:1700000000000};
let x=load('hansen_coin_wallet.js',{
  hansen_starter_coins_given:'1',hansen_wallet_coins:'70',hansen_wallet_coins_earned:'110',
  hansen_coin_awards_v942:j({'award:coin:done':{amount:10,at:pending.at}}),hansen_coin_award_pending_v942:j(pending)
});
assert.equal(x.c.HansenCoins.get(),70);assert.equal(x.c.HansenCoins.getEarned(),110);assert.equal(x.storage.getItem('hansen_coin_award_pending_v942'),null);

pending={id:'award:gem:done',amount:5,before:40,target:45,at:1700000000000};
x=load('hansen_gem_system.js',{
  hansen_gems_cleared_v1:'1',hansen_wallet_gems:'12',
  hansen_gem_awards_v942:j({'award:gem:done':{amount:5,at:pending.at}}),hansen_gem_award_pending_v942:j(pending)
});
assert.equal(x.c.HansenGems.get(),12);assert.equal(x.storage.getItem('hansen_gem_award_pending_v942'),null);

// 无 ledger 时只接受精确 before/target 崩溃点；任意第三余额保持 pending 证据且不伪提交。
pending={id:'award:coin:ambiguous',amount:10,beforeWallet:100,beforeEarned:100,targetWallet:110,targetEarned:110,at:1700000000001};
x=load('hansen_coin_wallet.js',{hansen_starter_coins_given:'1',hansen_wallet_coins:'85',hansen_wallet_coins_earned:'100',hansen_coin_awards_v942:'{}',hansen_coin_award_pending_v942:j(pending)});
assert.equal(x.c.HansenCoins.recoverAwards(),false);assert.equal(x.c.HansenCoins.get(),85);assert.equal(x.storage.getItem('hansen_coin_award_pending_v942'),j(pending));assert.equal(Object.hasOwn(JSON.parse(x.storage.getItem('hansen_coin_awards_v942')),'award:coin:ambiguous'),false);

pending={id:'award:gem:ambiguous',amount:5,before:40,target:45,at:1700000000001};
x=load('hansen_gem_system.js',{hansen_gems_cleared_v1:'1',hansen_wallet_gems:'17',hansen_gem_awards_v942:'{}',hansen_gem_award_pending_v942:j(pending)});
assert.equal(x.c.HansenGems.recoverAwards(),false);assert.equal(x.c.HansenGems.get(),17);assert.equal(x.storage.getItem('hansen_gem_award_pending_v942'),j(pending));assert.equal(Object.hasOwn(JSON.parse(x.storage.getItem('hansen_gem_awards_v942')),'award:gem:ambiguous'),false);

// target 已写、ledger 尚未写是唯一可直接补 ledger 的窗口，不得再加一次。
pending={id:'award:gem:target',amount:5,before:40,target:45,at:1700000000002};
x=load('hansen_gem_system.js',{hansen_gems_cleared_v1:'1',hansen_wallet_gems:'45',hansen_gem_awards_v942:'{}',hansen_gem_award_pending_v942:j(pending)});
assert.equal(x.c.HansenGems.get(),45);assert.equal(JSON.parse(x.storage.getItem('hansen_gem_awards_v942'))['award:gem:target'].amount,5);assert.equal(x.storage.getItem('hansen_gem_award_pending_v942'),null);

// 损坏 ledger 不能被当空账本后对同一 source 重发。
x=load('hansen_gem_system.js',{hansen_gems_cleared_v1:'1',hansen_wallet_gems:'45',hansen_gem_awards_v942:'{broken'});
assert.equal(x.c.HansenGems.award('same-source',5),false);assert.equal(x.c.HansenGems.get(),45);assert.equal(x.storage.getItem('hansen_gem_awards_v942'),'{broken');

console.log('wallet award recovery v942: committed cleanup no resurrection + exact crash states + corrupt-ledger fail-closed ✅');
