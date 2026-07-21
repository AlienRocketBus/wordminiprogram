import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failKey=null;}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){k=String(k);if(this.failKey===k)throw new Error('QuotaExceededError');this.d[k]=String(v);}
  removeItem(k){delete this.d[String(k)];}
}
const j=JSON.stringify;
function make(storage){
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;}};},head:{appendChild(){}},body:{children:[],appendChild(){}}};
  const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},clearInterval(){},addEventListener(){},innerWidth:390,innerHeight:844,allW:[{en:'a'},{en:'b'},{en:'c'}],__hsnSaveKey:'wordIslandVerbs'};
  c.window=c;c.globalThis=c;c.HansenCanonical={
    islands:[{id:'action',words:3}],currentRef(){return 'wordIslandVerbs';},
    resolve(ref){ref=String(ref||'').toLowerCase();return /action|wordislandverbs/.test(ref)?{id:'action',offset:0,length:3,words:3}:null;},
    toCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;},fromCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;}
  };
  vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8'),c,{filename:'hansen_crystal.js'});return c;
}

// v942 边界必须在钱包就绪前固化：旧 done 只 seed，新 done 即使第一次 award 失败也必须稍后补发。
const s1=new Storage({hsn_crystal_action:j({0:{lv:5,p:0,d:'2026-7-1',done:1}})}),c1=make(s1);
let out=c1.HansenCrystal.reconcileCanonicalRewards();assert.equal(out.pending,true);
const boundary=JSON.parse(s1.getItem('hansen_crystal_legacy_seed_v942'));assert.deepEqual(boundary.ids,['crystal:word:action:0']);
// 边界固化后才出现的新完成（代表钱包未就绪时 saveM 已成功、award 失败）。
s1.setItem('hsn_crystal_action',j({0:{lv:5,p:0,d:'2026-7-1',done:1},1:{lv:5,p:0,d:'2026-7-14',done:1}}));
const awards={},paid=[];c1.HansenGems={
  seedAwards(ids){ids.forEach(id=>{if(!Object.hasOwn(awards,id))awards[id]={amount:0,migrated:true};});return true;},
  award(id,n){if(!Object.hasOwn(awards,id)){awards[id]={amount:n};paid.push([id,n]);}return true;},add(){return 0;}
};
/* 🔴v963 合同更新: 逐星方案下所有done词(含legacy-seed的0号)对账补齐第5星+1💎；
 * legacy词的大额仍被seed边界拦截(不重发)，新done词大额照发。重放全部幂等。 */
out=c1.HansenCrystal.reconcileCanonicalRewards();assert.equal(out.pending,undefined);assert.deepEqual(paid,[['crystal:star:action:0:5',1],['crystal:word:action:1',4],['crystal:star:action:1:5',1]],'seed 后新增 done 不能被误种为历史已发；done 词逐星补齐第5星');
c1.HansenCrystal.reconcileCanonicalRewards();assert.deepEqual(paid,[['crystal:star:action:0:5',1],['crystal:word:action:1',4],['crystal:star:action:1:5',1]],'对账重放不得重复发钻');

// alias map 保存失败时绝不能先提交 source sig；权限恢复后仍能迁移。
const s2=new Storage({hsn_crystal_action:'{}',hsn_crystal_island_action:j({0:{lv:3,p:0,d:'2026-7-10',done:0}})}),c2=make(s2);
s2.failKey='hsn_crystal_action';c2.HansenCrystal._migrateCrystalMaps();
let ledger=JSON.parse(s2.getItem('hansen_crystal_sources_v942')||'{}');assert.equal(ledger.hsn_crystal_island_action,undefined);assert.deepEqual(JSON.parse(s2.getItem('hsn_crystal_action')),{});
s2.failKey=null;c2.HansenCrystal._migrateCrystalMaps();ledger=JSON.parse(s2.getItem('hansen_crystal_sources_v942'));assert.ok(ledger.hsn_crystal_island_action);assert.equal(JSON.parse(s2.getItem('hsn_crystal_action'))[0].lv,3);

// canonical map 已落盘但 sources ledger 写失败：下次仍重试 sig；合并幂等，不丢也不重复进度。
const firstSig=ledger.hsn_crystal_island_action;s2.setItem('hsn_crystal_island_action',j({0:{lv:4,p:0,d:'2026-7-11',done:0}}));s2.failKey='hansen_crystal_sources_v942';
assert.equal(c2.HansenCrystal._migrateCrystalMaps(),false);assert.equal(JSON.parse(s2.getItem('hsn_crystal_action'))[0].lv,4);assert.equal(JSON.parse(s2.getItem('hansen_crystal_sources_v942')).hsn_crystal_island_action,firstSig);
s2.failKey=null;assert.equal(c2.HansenCrystal._migrateCrystalMaps(),true);assert.notEqual(JSON.parse(s2.getItem('hansen_crystal_sources_v942')).hsn_crystal_island_action,firstSig);assert.equal(JSON.parse(s2.getItem('hsn_crystal_action'))[0].lv,4);

console.log('crystal migration v942: pre-wallet legacy boundary + failed-award retry + map/ledger commit ordering ✅');
