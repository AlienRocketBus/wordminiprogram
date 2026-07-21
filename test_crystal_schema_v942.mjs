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
const poisoned={
  0:{lv:5,p:0,d:'2026-7-14',done:'false'},      // 字符串 false 旧逻辑会被当真
  1:{lv:5,p:0,d:'2026-7-13',done:1},            // 唯一合法完成
  2:{lv:4,p:0,d:'2026-7-14',done:true},          // done 与星级矛盾
  999:{lv:5,p:0,d:'2026-7-12',done:1},           // 越过本岛 3 个 canonical 槽位
  '01':{lv:5,p:0,d:'2026-7-11',done:1},          // 非规范索引
  bad:{lv:5,p:0,d:'2026-7-10',done:1}
};
const storage=new Storage({hsn_crystal_action:j(poisoned),hansen_crystal_awards_seeded_v942:'1'});
const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;}};},head:{appendChild(){}},body:{appendChild(){}}};
const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},setInterval(){return 1;},clearTimeout(){},clearInterval(){},addEventListener(){},innerWidth:390,innerHeight:844,allW:[{en:'a'},{en:'b'},{en:'c'}],__hsnSaveKey:'wordIslandVerbs'};
c.window=c;c.globalThis=c;c.HansenCanonical={
  islands:[{id:'action',words:3}],currentRef(){return 'wordIslandVerbs';},
  resolve(ref){return /action|wordislandverbs/i.test(String(ref||''))?{id:'action',offset:0,length:3,words:3}:null;},
  toCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;},
  fromCanonicalIndex(ref,n){n=Number(n);return Number.isInteger(n)&&n>=0&&n<3?n:-1;}
};
vm.createContext(c);

// 攻击样例是一份校验和正确的备份内容：备份层允许玩家 JSON，结晶引擎仍必须做领域 schema 校验。
vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});
const backup=c.HansenBackup.build();assert.doesNotThrow(()=>c.HansenBackup.parse(JSON.stringify(backup)));

const paid=new Map();c.HansenGems={
  seedAwards(){return true;},
  award(id,n){if(!paid.has(id))paid.set(id,n);return true;},
  get(){return 0;},add(){return 0;}
};
vm.runInContext(fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8'),c,{filename:'hansen_crystal.js'});
let result=c.HansenCrystal.reconcileCanonicalRewards();
assert.equal(result.mastered,1,'只能统计一条合法 5 星完成记录');
assert.deepEqual([...paid.entries()],[['crystal:word:action:1',4]]);
assert.equal(paid.has('crystal:word:action:0'),false,'done="false" 不得发钻');
assert.equal(paid.has('crystal:word:action:999'),false,'越界槽位不得发钻');
assert.equal(paid.has('crystal:island:action'),false,'越界/伪记录不得凑成全岛奖');
assert.equal(storage.getItem('hsn_crystal_total'),'1');
assert.deepEqual(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action'))),['1'],'主副本应修复为只含合法槽位的映射');

// 补齐真实 0/1/2 三个槽位后，才可发剩余单词钻石与一次性全岛奖。
storage.setItem('hsn_crystal_action',j({
  0:{lv:5,p:0,d:'2026-7-14',done:1},
  1:{lv:5,p:0,d:'2026-7-13',done:1},
  2:{lv:5,p:0,d:'2026-7-12',done:true}
}));
result=c.HansenCrystal.reconcileCanonicalRewards();
assert.equal(result.mastered,3);assert.equal(result.islands,1);assert.equal(result.bonus,50);
assert.equal(paid.get('crystal:word:action:0'),4);assert.equal(paid.get('crystal:word:action:2'),4);assert.equal(paid.get('crystal:island:action'),50);
c.HansenCrystal.reconcileCanonicalRewards();assert.equal([...paid.keys()].filter(x=>x==='crystal:island:action').length,1,'重放不得重复发全岛奖');

// 合法但意外为空的主档不得压住健康备份（主写完、备写前中断的典型形态）。
const rec0={lv:5,p:0,d:'2026-7-14',done:1};
storage.setItem('hsn_crystal_action','{}');storage.setItem('hsn_crystal_action_bak',j({0:rec0}));
c.HansenCrystal.reconcileCanonicalRewards();
assert.deepEqual(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action'))),['0']);
assert.deepEqual(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action_bak'))),['0']);

// 污染主档也不得把健康备份清空；只合并两者中通过 schema/范围校验的记录。
storage.setItem('hsn_crystal_action',j({999:{lv:5,p:0,d:'2026-7-14',done:1}}));storage.setItem('hsn_crystal_action_bak',j({0:rec0}));
c.HansenCrystal.reconcileCanonicalRewards();
assert.deepEqual(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action'))),['0']);
assert.deepEqual(Object.keys(JSON.parse(storage.getItem('hsn_crystal_action_bak'))),['0']);

console.log('crystal schema v942: strict done type/state + canonical range + full-island reward boundary ✅');
