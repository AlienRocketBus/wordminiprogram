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
const main={
  0:{lv:2,p:0,d:'2026-7-14',done:0},
  2:{lv:3,p:0,d:'2026-7-14',done:0}
};
const previous={
  0:{lv:1,p:1,d:'2026-7-13',done:0},
  1:{lv:5,p:0,d:'2026-7-12',done:1},
  2:{lv:2,p:1,d:'2026-7-13',done:0}
};
const storage=new Storage({hsn_crystal_action:j(main),hsn_crystal_action_bak:j(previous),hansen_crystal_awards_seeded_v942:'1'});
const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;}};},head:{appendChild(){}},body:{appendChild(){}}};
const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},clearInterval(){},addEventListener(){},innerWidth:390,innerHeight:844,allW:[{},{},{},{}],__hsnSaveKey:'wordIslandVerbs'};
c.window=c;c.globalThis=c;c.HansenCanonical={
  islands:[{id:'action',words:4}],currentRef(){return 'wordIslandVerbs';},
  resolve(){return {id:'action',offset:0,length:4,words:4};},
  toCanonicalIndex(ref,n){return Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<4?Number(n):-1;},
  fromCanonicalIndex(ref,n){return Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<4?Number(n):-1;}
};
vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8'),c,{filename:'hansen_crystal.js'});
let snap=c.HansenCrystal.snapshotCurrentSlice();
assert.deepEqual(Object.keys(snap.map),['0','1','2'],'非空主档缺失的单槽必须从 previous-good 补回');
assert.deepEqual(JSON.parse(JSON.stringify(snap.map[1])),previous[1]);
assert.deepEqual(JSON.parse(JSON.stringify(snap.map[0])),main[0],'当前代已有槽位不能被旧低等级覆盖');
assert.deepEqual(JSON.parse(JSON.stringify(snap.map[2])),main[2],'锁星后 p=0 是精确当前状态，旧 p=1 不得复活');
const snapPlain=JSON.parse(JSON.stringify(snap.map));
assert.deepEqual(JSON.parse(storage.getItem('hsn_crystal_action')),snapPlain,'合并后严格修复主档');
assert.deepEqual(JSON.parse(storage.getItem('hsn_crystal_action_bak')),snapPlain,'修复后主备必须收口为同一健康映射');

// 明确清除使用 exact 双写；后续读取不得再从旧代恢复任何槽位。
assert.equal(c.HansenCrystal.clearCurrentSlice(),true);
assert.deepEqual(JSON.parse(storage.getItem('hsn_crystal_action')),{});assert.deepEqual(JSON.parse(storage.getItem('hsn_crystal_action_bak')),{});
snap=c.HansenCrystal.snapshotCurrentSlice();assert.deepEqual(Object.keys(snap.map),[]);

console.log('crystal partial backup v942: partial-slot recovery + current-record exactness + exact-clear boundary ✅');
