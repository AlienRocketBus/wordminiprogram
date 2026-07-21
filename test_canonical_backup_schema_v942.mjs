import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.m=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return this.m.size;}key(i){return [...this.m.keys()][i]??null;}
  getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null;}
  setItem(k,v){this.m.set(String(k),String(v));}removeItem(k){this.m.delete(String(k));}
}
const j=JSON.stringify;
const healthy={version:941,islands:{action:{learned:[0],mc:{0:3},wrongs:{},cleared:{learned:{},mc:{},wrongs:{}}}}};
const storage=new Storage({
  hansen_canonical_progress_v941:j({version:941,islands:{}}),
  hansen_canonical_progress_v941_bak:j(healthy),
  hsn_crystal_action:j({1:{lv:5,p:0,d:'2026-7-14',done:'false'}})
});
const document={readyState:'loading',addEventListener(){}};
const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},addEventListener(){},__hsnSaveKey:'wordIslandVerbs'};c.window=c;c.globalThis=c;
vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_canonical_progress.js',import.meta.url),'utf8'),c,{filename:'hansen_canonical_progress.js'});
const HC=c.HansenCanonical;

// 合法 JSON 空主档不得压住含真实事实的 previous-good 备份。
let store=HC.read();assert.equal(store.islands.action.learned.includes(0),true);assert.equal(store.islands.action.mc[0],3);
assert.equal(JSON.parse(storage.getItem('hansen_canonical_progress_v941')).islands.action.mc[0],3,'健康备份应回写主档');

// truthy 字符串 done 不得把伪结晶并入 canonical 掌握度。
HC.migrate();assert.equal(HC.isLearned('action',1),false);assert.equal(HC.mastery('action',1),0);assert.equal(HC.isCrystalDone('action',1),false);

// 只有类型严格、lv=5/p=0 的合法终态才能进入迁移。
storage.setItem('hsn_crystal_action',j({1:{lv:5,p:0,d:'2026-7-14',done:true}}));
HC.migrate();assert.equal(HC.isLearned('action',1),true);assert.equal(HC.mastery('action',1),3);assert.equal(HC.isCrystalDone('action',1),true);

console.log('canonical backup/schema v942: empty-main recovery + strict crystal done migration ✅');
