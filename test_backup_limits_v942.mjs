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
  const localStorage=new Storage(seed),document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const c={console,localStorage,document,Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},location:{reload(){}}};c.window=c;c.globalThis=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});return c.HansenBackup;
}

// 自产自验是硬合同：每份 build() 结果都必须能立即被同版 parse()。
let HB=load({hansen_wallet_coins:'42',wordIslandAnimal:'{"learned":[1]}'}),payload=HB.build();
assert.doesNotThrow(()=>HB.parse(JSON.stringify(payload)));

// 条目数上限的边界可用，多一项则在“生成”阶段明确拒绝。
let seed={};for(let i=0;i<1200;i++)seed['hansen_limit_'+String(i).padStart(4,'0')]='';
HB=load(seed);payload=HB.build();assert.equal(payload.items.length,1200);assert.doesNotThrow(()=>HB.parse(JSON.stringify(payload)));
seed.hansen_limit_over='x';HB=load(seed);assert.throws(()=>HB.build(),/条目数量超限/);

// 单项 2MB（按 UTF-16 上限计算）可用，多一字符必须拒绝。
const oneMiB='x'.repeat(1024*1024);
HB=load({hansen_limit_blob:oneMiB});payload=HB.build();assert.doesNotThrow(()=>HB.parse(JSON.stringify(payload)));
HB=load({hansen_limit_blob:oneMiB+'x'});assert.throws(()=>HB.build(),/单项数据过大/);

// 总体积精确 12MB 可用，多一字符必须在导出前拒绝。
seed={};for(let i=0;i<6;i++)seed['hansen_limit_total_'+i]=oneMiB;
HB=load(seed);payload=HB.build();assert.doesNotThrow(()=>HB.parse(JSON.stringify(payload)));
seed.hansen_limit_total_over='x';HB=load(seed);assert.throws(()=>HB.build(),/总体积超过 12MB/);

console.log('backup limits v942: build/parse same contract + exact item/value/total boundaries ✅');
