import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

class Storage{
  constructor(seed){this.d={...seed};this.reset();}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){this.reads.push(String(k));return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){this.writes.push(String(k));this.d[String(k)]=String(v);}
  removeItem(k){this.removes.push(String(k));delete this.d[String(k)];}
  reset(){this.reads=[];this.writes=[];this.removes=[];}
}
const saveKey='wordIslandVerbs',journalKey=`hansen_reset_pending_v942:${saveKey}`;
const journal='{broken-reset-journal',main='{"learned":[1],"stats":{}}',bak='{"learned":[0],"stats":{}}';
const storage=new Storage({[journalKey]:journal,[saveKey]:main,[`${saveKey}_bak`]:bak,hansen_wallet_coins:'99'});
let clicked=0,reloads=0,confirms=0,lastAnchor=null;
const body={appendChild(){}};
const document={readyState:'loading',body,addEventListener(){},getElementById(){return null;},createElement(){lastAnchor={click(){clicked++;},remove(){}};return lastAnchor;}};
const c={console,localStorage:storage,document,Date,JSON,Math,Number,isFinite,Blob,URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},setTimeout(fn){if(fn)fn();return 1;},clearTimeout(){},location:{reload(){reloads++;}},confirm(){confirms++;return true;},__hsnSaveKey:saveKey,__hsnResetJournalKey(){return journalKey;},__hsnReadResetPending(){return {__invalid:true,error:'bad checksum'};}};
c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('./hansen_backup_v944.js',import.meta.url),'utf8'),c,{filename:'hansen_backup_v944.js'});

storage.reset();const evidence=c.HansenBackup.buildResetForensic();
assert.equal(evidence.kind,'diagnostic-only-not-restorable');assert.equal(evidence.schema,'hansen.wordminiprogram.reset-forensic');
assert.equal(evidence.appVersion,Number(__APPV__),'v960 取证导出必须标记当前应用版本');
assert.deepEqual(JSON.parse(JSON.stringify(evidence.items)),[
  {role:'reset-journal',key:journalKey,value:journal},
  {role:'current-main',key:saveKey,value:main},
  {role:'previous-good',key:`${saveKey}_bak`,value:bak}
]);
assert.match(evidence.checksum,/^fnv1a32-[0-9a-f]{8}$/);assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[],'构建取证包必须严格只读');
assert.throws(()=>c.HansenBackup.parse(JSON.stringify(evidence)),/备份类型|schema/,'取证包绝不能被普通恢复入口执行');

// 未实际导出前不得删除；导出后也只在用户双重确认时删除唯一 journal，主备原样保留。
assert.equal(c.HansenBackup.discardInvalidResetJournal(),false);assert.equal(storage.getItem(journalKey),journal);
storage.reset();assert.equal(c.HansenBackup.downloadResetForensic(),true);assert.equal(clicked,1);assert.match(lastAnchor.download,new RegExp('v'+__APPV__+'_重置故障取证'));
assert.deepEqual(storage.writes,[]);assert.deepEqual(storage.removes,[]);
assert.equal(c.HansenBackup.discardInvalidResetJournal(),true);assert.equal(confirms,2);assert.equal(reloads,1);
assert.equal(storage.getItem(journalKey),null);assert.equal(storage.getItem(saveKey),main);assert.equal(storage.getItem(`${saveKey}_bak`),bak);
assert.deepEqual(storage.removes,[journalKey]);

console.log('reset forensic v960: read-only evidence + non-restorable schema + export-gated double-confirm discard ✅');
