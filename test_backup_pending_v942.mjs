import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){this.d[String(k)]=String(v);}removeItem(k){delete this.d[String(k)];}
}
function load(seed){
  const storage=new Storage(seed),document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},location:{reload(){}}};c.window=c;c.globalThis=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});return {HB:c.HansenBackup,storage};
}

// 顶层 pending 是恢复/回滚唯一证据：导出必须拒绝且不得修改原值。
let original=JSON.stringify({id:'coin:test',amount:10,beforeWallet:5,targetWallet:15}),x=load({hansen_wallet_coins:'15',hansen_coin_award_pending_v942:original});
assert.throws(()=>x.HB.build(),/未完成事务 hansen_coin_award_pending_v942/);
assert.equal(x.storage.getItem('hansen_coin_award_pending_v942'),original);

// 重置/购买证明损坏时也不能被当成“没有 pending”静默略过。
x=load({hansen_wallet_coins:'15',hansen_theme_purchase_transaction_v942:'{broken'});
assert.throws(()=>x.HB.build(),/未完成事务 hansen_theme_purchase_transaction_v942/);
assert.equal(x.storage.getItem('hansen_theme_purchase_transaction_v942'),'{broken');

// nested pending 同样拒绝，不再导出“已扣款资产 + 被剥离的续做日志”。
original=JSON.stringify({owned:{boss1:1},pending:{stage:'spent',id:'draw:1'}});x=load({hansen_wallet_cardbook:original,hansen_wallet_coins:'5'});
assert.throws(()=>x.HB.build(),/当前存档含未完成交易：hansen_wallet_cardbook/);
assert.equal(x.storage.getItem('hansen_wallet_cardbook'),original);

// 运行模块收尾后允许空 pending 容器/显式 null，成功备份仍必须能自我 parse。
x=load({
  hansen_wallet_coins:'15',hansen_coin_award_pending_v942:'{}',hansen_sb_reward_pending_v942:'{}',
  hansen_wallet_cardbook:JSON.stringify({owned:{boss1:1},pending:null})
});
const payload=x.HB.build();assert.doesNotThrow(()=>x.HB.parse(JSON.stringify(payload)));
assert.equal(payload.items.some(i=>/pending|journal|transaction/.test(i.key)),false);
assert.equal(Object.prototype.hasOwnProperty.call(JSON.parse(payload.items.find(i=>i.key==='hansen_wallet_cardbook').value),'pending'),false);

console.log('backup pending v942: top-level/nested/corrupt transaction refusal + committed-only export ✅');
