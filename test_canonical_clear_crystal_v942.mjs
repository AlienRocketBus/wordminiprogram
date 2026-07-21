import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.m=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));this.failKey=null;this.failGet=false;}
  get length(){return this.m.size;}key(i){return [...this.m.keys()][i]??null;}
  getItem(k){if(this.failGet)throw new Error('SecurityError');return this.m.has(String(k))?this.m.get(String(k)):null;}setItem(k,v){if(this.failKey===String(k))throw new Error('QuotaExceededError');this.m.set(String(k),String(v));}removeItem(k){this.m.delete(String(k));}
}
const j=JSON.stringify;
const plain=v=>JSON.parse(JSON.stringify(v));
const storage=new Storage({
  wordIslandSeason:j({lastSaveTime:100,learned:[0,30],mc:{0:3,30:2},wrongs:{0:2,30:4}}),
  wordIslandLand1:j({lastSaveTime:100,learned:[0],mc:{0:5},wrongs:{0:9}}),
  hsn_crystal_island_land1:j({0:{lv:5,p:0,d:'2025-1-1',done:1}})
});
const nodes=new Map();
const document={readyState:'loading',addEventListener(){},getElementById(id){return nodes.get(id)||null;},
  createElement(){return {id:'',style:{},className:'',classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;},remove(){}};},
  head:{appendChild(){}},body:{children:[],appendChild(el){if(el.id)nodes.set(el.id,el);}},querySelector(){return null;}};
const context={console,localStorage:storage,location:{pathname:'/island_land1.html'},document,S:{lastSaveTime:100,learned:[0],mc:{0:5},wrongs:{0:9}},
  addEventListener(){},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},innerWidth:390,innerHeight:844,getComputedStyle(){return {display:'none',position:'static'};}};
context.window=context;context.globalThis=context;context.__hsnSaveKey='wordIslandLand1';context.__hsnSaveNow=()=>true;
vm.createContext(context);vm.runInContext(fs.readFileSync('hansen_canonical_progress.js','utf8'),context);
const HC=context.HansenCanonical;HC.migrate();
assert.equal(HC.mastery('land1',0),5);assert.equal(HC.read().islands.season.wrongs[0],9);

// 清 Land1 后 canonical 与当前 UI 都精确为空；旧 Season/Land 和旧 crystal done 都不能复活。
HC.clearCurrent(['learned','wrongs','mc']);HC.syncCurrent();
assert.deepEqual(plain(context.S.learned),[]);assert.deepEqual(plain(context.S.wrongs),{});assert.deepEqual(plain(context.S.mc),{});
HC.migrate();HC.syncCurrent();
assert.equal(HC.isLearned('land1',0),false);assert.equal(HC.mastery('land1',0),0);assert.deepEqual(plain(context.S.wrongs),{});

// 其它切片不受影响（Season local30 = Land2 local0）。
assert.equal(HC.isLearned('land2',0),true);assert.equal(HC.mastery('land2',0),2);

// 清后新学习是新事实，允许重新写入；永久水位仍阻挡更老别名里的 wrong=9/mc=5。
context.S.lastSaveTime=Date.now()+1000;context.S.learned=[0];context.S.mc={0:1};context.S.wrongs={0:1};HC.absorbCurrent();
assert.equal(HC.isLearned('land1',0),true);assert.equal(HC.mastery('land1',0),1);assert.equal(HC.read().islands.season.wrongs[0],1);
HC.migrate();HC.syncCurrent();
assert.equal(HC.mastery('land1',0),1,'旧高 mc 不得越过清除水位');assert.equal(context.S.wrongs[0],1,'旧 wrong=9 不得复活');

// canonical main 损坏后必须从带同一墓碑的 backup 恢复，旧 alias 仍不得复活。
storage.setItem('hansen_canonical_progress_v941','{broken');HC.migrate();HC.syncCurrent();
assert.equal(HC.mastery('land1',0),1);assert.equal(context.S.wrongs[0],1);assert.doesNotThrow(()=>JSON.parse(storage.getItem('hansen_canonical_progress_v941')));

// 破坏性 clear 写入 quota 失败要严格 false，并保持 main/backup/事实不变。
const canonBefore=storage.getItem('hansen_canonical_progress_v941'),canonBakBefore=storage.getItem('hansen_canonical_progress_v941_bak');storage.failKey='hansen_canonical_progress_v941';
assert.equal(HC.clearCurrent(['learned','wrongs','mc']),false);storage.failKey=null;
assert.equal(storage.getItem('hansen_canonical_progress_v941'),canonBefore);assert.equal(storage.getItem('hansen_canonical_progress_v941_bak'),canonBakBefore);assert.equal(HC.isLearned('land1',0),true);

// 短暂 localStorage 读失败必须 fail-closed：不用 blank 覆盖 19 岛账本，权限恢复后可正常续做。
const beforeSecurityMain=storage.getItem('hansen_canonical_progress_v941'),beforeSecurityBak=storage.getItem('hansen_canonical_progress_v941_bak');storage.failGet=true;
assert.equal(HC.absorbCurrent(),false);assert.equal(HC.migrate().error,'storage-read');assert.equal(HC.isLearned('land1',0),false);
assert.equal(storage.m.get('hansen_canonical_progress_v941'),beforeSecurityMain);assert.equal(storage.m.get('hansen_canonical_progress_v941_bak'),beforeSecurityBak);
storage.failGet=false;assert.equal(HC.isLearned('land1',0),true);assert.notEqual(HC.migrate().error,'storage-read');

// 结晶 p 必须精确 1→0；再次迁移旧别名也不能把 p 回灌成1。
storage.setItem('hsn_crystal_action',j({0:{lv:0,p:1,d:'',done:0}}));
storage.setItem('hsn_crystal_island_action',j({0:{lv:0,p:1,d:'',done:0}}));
context.__hsnSaveKey='wordIslandVerbs';context.location.pathname='/island_action.html';context.S={learned:[],mc:{},wrongs:{}};
context.HansenGems={add(){},get(){return 0;}};context.allW=[{en:'run'}];
vm.runInContext(fs.readFileSync('hansen_crystal.js','utf8'),context);
context.HansenCrystal.reconcileCanonicalRewards();context.HansenCrystal._onAnswer(0,true);
let rec=JSON.parse(storage.getItem('hsn_crystal_action'))[0];assert.equal(rec.lv,1);assert.equal(rec.p,0);
context.HansenCrystal.reconcileCanonicalRewards();rec=JSON.parse(storage.getItem('hsn_crystal_action'))[0];assert.equal(rec.p,0,'旧结晶别名不得在下次启动回灌 p');

// 不同等级必须整条记录择强，不能把 legacy 低等级的 p 拼到 canonical 高等级上。
storage.setItem('hsn_crystal_action',j({0:{lv:2,p:0,d:'2026-7-14',done:0}}));
storage.setItem('hsn_crystal_wordIslandVerbs',j({0:{lv:1,p:1,d:'2026-7-13',done:0}}));
context.HansenCrystal.reconcileCanonicalRewards();rec=JSON.parse(storage.getItem('hsn_crystal_action'))[0];
assert.equal(rec.lv,2);assert.equal(rec.p,0,'canonical lv2/p0 不得被 legacy lv1/p1 污染成 lv2/p1');assert.equal(rec.d,'2026-7-14');

console.log('canonical/crystal v942: exact alias sync + permanent clear waterline + new learning + p reset + whole-level merge ✅');
