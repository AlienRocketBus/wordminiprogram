import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.m=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return this.m.size;}key(i){return [...this.m.keys()][i]??null;}
  getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null;}
  setItem(k,v){this.m.set(String(k),String(v));}removeItem(k){this.m.delete(String(k));}
}
const j=JSON.stringify,blankCleared=()=>({learned:{},mc:{},wrongs:{}});
const previous={version:941,islands:{
  action:{learned:[0,1,2],mc:{0:4,1:3,2:2},wrongs:{1:2},cleared:blankCleared()},
  animal:{learned:[3],mc:{3:3},wrongs:{},cleared:blankCleared()}
}};
// 主档仍有 action:0，所以不是旧测试覆盖的“全空主档”；但 action:1 和整个
// animal 岛被截断。action:2 有明确清除水位，绝不能从 backup 复活。
const current={version:941,islands:{
  action:{learned:[0],mc:{0:2},wrongs:{},cleared:{learned:{2:200},mc:{2:200},wrongs:{1:200}}}
}};
const storage=new Storage({hansen_canonical_progress_v941:j(current),hansen_canonical_progress_v941_bak:j(previous)});
const c={console,localStorage:storage,document:{readyState:'loading',addEventListener(){}},location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},addEventListener(){},__hsnSaveKey:'wordIslandVerbs'};
c.window=c;c.globalThis=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(new URL('./hansen_canonical_progress.js',import.meta.url),'utf8'),c,{filename:'hansen_canonical_progress.js'});
let store=c.HansenCanonical.read();
assert.deepEqual([...store.islands.action.learned],[0,1],'无水位的截断槽位应从 previous-good 补回');
assert.equal(store.islands.action.mc[0],4,'未清除计数保留两代较强合法值');
assert.equal(store.islands.action.mc[1],3);assert.equal(store.islands.action.mc[2],undefined,'清除水位阻止旧计数复活');
assert.equal(store.islands.action.wrongs[1],undefined,'错词清除水位同样优先');
assert.deepEqual([...store.islands.animal.learned],[3],'非空主档也必须补回整个被截断岛');
assert.equal(store.islands.animal.mc[3],3);
assert.deepEqual(JSON.parse(storage.getItem('hansen_canonical_progress_v941')).islands.animal.learned,[3],'修复结果必须严格回写主档');

// 清除后重新学习会保留水位与当前较低计数；旧 backup 的高计数不能穿过重置。
store.islands.action.learned=[0,1,2];store.islands.action.mc[2]=1;
storage.setItem('hansen_canonical_progress_v941',j(store));
store=c.HansenCanonical.read();assert.equal(store.islands.action.learned.includes(2),true);assert.equal(store.islands.action.mc[2],1);

console.log('canonical partial backup v942: partial-island merge + tombstone precedence + relearn exactness ✅');
