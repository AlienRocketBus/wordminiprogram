import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor(seed={}){ this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)])); }
  get length(){ return this.map.size; }
  key(i){ return [...this.map.keys()][i] ?? null; }
  getItem(k){ return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k,v){ this.map.set(String(k),String(v)); }
  removeItem(k){ this.map.delete(String(k)); }
}
const complete=n=>Object.fromEntries(Array.from({length:n},(_,i)=>[i,{lv:5,p:0,d:'2026-7-13',done:1}]));
const seed={
  hansen_gems_cleared_v1:'1', hansen_wallet_gems:'10', hsn_crystal_rank:'0',
  hsn_crystal_island_action:JSON.stringify(complete(67)),
  // 八个物理入口覆盖 season 的完整 240；另放一份 season:0 验证不会重复计数/发钻。
  hsn_crystal_island_season:JSON.stringify({0:{lv:5,p:0,d:'2026-7-13',done:1}})
};
for(let i=1;i<=8;i++)seed[`hsn_crystal_island_land${i}`]=JSON.stringify(complete(30));
const storage=new MemoryStorage(seed), unlocked=[];
const document={
  readyState:'loading',addEventListener(){},getElementById(){return null;},
  createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){}};},
  head:{appendChild(){}},body:{appendChild(){}}
};
const context={
  console,localStorage:storage,location:{pathname:'/island_season.html'},document,
  HansenAch:{unlock(id){unlocked.push(id);return true;}},
  addEventListener(){},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
  innerWidth:390,innerHeight:844
};
context.window=context;context.globalThis=context;
vm.createContext(context);
for(const file of ['hansen_canonical_progress.js','hansen_gem_system.js','hansen_crystal.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
}
context.HansenCanonical.migrate();

// 已有钻石应立即补登 gem1，不必等下一次答题。
assert.ok(unlocked.includes('gem1'));

const first=context.HansenCrystal.reconcileCanonicalRewards();
assert.deepEqual(JSON.parse(JSON.stringify(first)),{mastered:307,islands:2,bonus:100});
assert.equal(Number(storage.getItem('hsn_crystal_total')),307);
assert.equal(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action'))).length,67);
assert.equal(Object.keys(JSON.parse(storage.getItem('hsn_crystal_season'))).length,240);
assert.equal(context.HansenCanonical.isCrystalDone('season',0),true);
assert.equal(context.HansenCanonical.isCrystalDone('land8',29),true);

// 钱包：初始10 + 段位20+40+80 + 两个 canonical 全岛奖2*50 = 250；
// 🔴v963 逐星迁移合同：307 个历史 done 词各补齐第5星 +1(人人5💎/词) → 250+307=557。
assert.equal(context.HansenGems.get(),557);
assert.equal(storage.getItem('hsn_crystal_isldone_action'),'1');
assert.equal(storage.getItem('hsn_crystal_isldone_season'),'1');
assert.equal(Number(storage.getItem('hsn_crystal_rank')),3);

// 再次对账完全幂等；Season 与 Land1 的同一 idx=0 也不能再次结晶。
const before=context.HansenGems.get();
const second=context.HansenCrystal.reconcileCanonicalRewards();
assert.equal(second.mastered,307);
assert.equal(second.islands,0);
assert.equal(second.bonus,0);
context.HansenCrystal._onAnswer(0,true);
context.HansenCrystal._onAnswer(0,true);
assert.equal(context.HansenGems.get(),before);

console.log('canonical economy v941: deduped crystals / rank reconciliation / 19-island bonus ledger / gem1 ✅');
