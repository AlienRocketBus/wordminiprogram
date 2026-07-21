import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage {
  constructor(seed={}){this.data=Object.fromEntries(Object.entries(seed).map(([k,v])=>[String(k),String(v)]));this.resetTrace();}
  get length(){return Object.keys(this.data).length;}
  key(i){return Object.keys(this.data)[i]??null;}
  getItem(k){this.reads.push(String(k));return Object.hasOwn(this.data,String(k))?this.data[String(k)]:null;}
  setItem(k,v){this.writes.push(String(k));this.data[String(k)]=String(v);}
  removeItem(k){this.removes.push(String(k));delete this.data[String(k)];}
  resetTrace(){this.reads=[];this.writes=[];this.removes=[];}
}
function functionSource(src,name){
  const start=src.indexOf(`function ${name}(`);assert.ok(start>=0,`missing ${name}`);
  const open=src.indexOf('{',start);let depth=0,quote='',esc=false,line=false,block=false;
  for(let i=open;i<src.length;i++){
    const c=src[i],n=src[i+1];
    if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}
    if(quote){if(esc){esc=false;continue;}if(c==='\\'){esc=true;continue;}if(c===quote)quote='';continue;}
    if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}
    if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error(`unclosed ${name}`);
}

const html=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
const saveKey='⟦⟦ISLE_KEY⟧⟧',journalKey=`hansen_reset_pending_v942:${saveKey}`;
const state=step=>({step,xp:0,level:1,stars:0,gems:0,coins:0,streak:0,learned:[],wrongs:{},mc:{},stats:{gameCounts:{},modesPlayed:[]},pet:{},quests:{list:[]},bossWon:[],achievements:[],achPending:[],achNew:[]});
const oldMain=JSON.stringify(state(7)),oldBak=JSON.stringify(state(6));
const storage=new Storage({[saveKey]:oldMain,[`${saveKey}_bak`]:oldBak,[journalKey]:'{"schema":1,"broken"'}),notices=[],alerts=[];
const ctx={console,localStorage:storage,S:state(0),Date,JSON,Math,Number,isFinite,notices,alerts,location:{pathname:'/island_action.html',reload(){throw new Error('must not reload');}},CustomEvent:class{},setTimeout(){},clearTimeout(){},showToast:m=>ctx.notices.push(m),showAlertMsg:m=>ctx.alerts.push(m)};
ctx.window=ctx;ctx.dispatchEvent=()=>{};vm.createContext(ctx);
vm.runInContext(functionSource(html,'__hsnParseSave'),ctx);
const saveBlock=html.slice(html.indexOf('var __hsnSaveKey='),html.indexOf('/* v938:',html.indexOf('var __hsnSaveKey=')));
vm.runInContext(saveBlock,ctx);
const resetHelpers=html.slice(html.indexOf('function __hsnResetJournalKey'),html.indexOf('function load()',html.indexOf('function __hsnResetJournalKey')));
vm.runInContext(resetHelpers,ctx);
vm.runInContext(functionSource(html,'load'),ctx);
vm.runInContext(functionSource(html,'_actuallyDoReset'),ctx);

// 日志键存在但 JSON 损坏，不等同于“没有事务”：启动必须停载、只读并保留原始证据。
storage.resetTrace();ctx.load();
assert.equal(ctx.S.step,0,'损坏 journal 时不得选主档或备份继续启动');
assert.equal(ctx.__hsnStorageReadOnly,true);assert.equal(ctx.__hsnHasResetPending(),true);
assert.equal(storage.getItem(journalKey),'{"schema":1,"broken"');
assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[]);
storage.resetTrace();assert.equal(ctx.__hsnResumeReset(false),false);
assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[],'恢复器不得删除损坏证据');

// 用户再次点重置也不得覆盖损坏 journal 或任何玩家数据。
storage.resetTrace();assert.equal(ctx._actuallyDoReset(),false);
assert.equal(storage.getItem(saveKey),oldMain);assert.equal(storage.getItem(`${saveKey}_bak`),oldBak);
assert.equal(storage.getItem(journalKey),'{"schema":1,"broken"');assert.match(ctx.alerts.at(-1),/损坏/);
assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[]);

// 正常 journal 由唯一写入口补齐校验和，严格回读后才可恢复。
delete storage.data[journalKey];ctx.__hsnStorageReadOnly=false;
const now=Date.now(),freshRaw=JSON.stringify(state(1));
const valid={schema:1,saveKey,freshRaw,physical:'action',mainDone:false,crystalDone:false,canonicalDone:false,extrasDone:false,reloadOnComplete:false,createdAt:now,updatedAt:now};
assert.equal(ctx.__hsnWriteResetPending(valid),true);let read=ctx.__hsnReadResetPending();
assert.equal(read.__invalid,undefined);assert.match(read.checksum,/^[0-9a-f]{8}$/);assert.equal(read.freshRaw,freshRaw);

// 任意阶段位、正文或页面归属被篡改而未同步校验和，都必须失败关闭且不自删。
for(const mutate of [
  j=>{j.mainDone=true;},
  j=>{j.freshRaw=JSON.stringify(state(99));},
  j=>{j.physical='food';},
  j=>{j.crystalDone=1;}
]){
  assert.equal(ctx.__hsnWriteResetPending({...valid}),true);const raw=JSON.parse(storage.getItem(journalKey));mutate(raw);
  storage.setItem(journalKey,JSON.stringify(raw));storage.resetTrace();read=ctx.__hsnReadResetPending();
  assert.equal(read.__invalid,true);assert.equal(ctx.__hsnResumeReset(false),false);
  assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[]);
}

console.log('reset invalid journal v942: checksum + strict schema + fail-closed read-only evidence preservation ✅');
