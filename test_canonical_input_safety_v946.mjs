#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return this.map.size;}key(i){return [...this.map.keys()][i]??null;}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}removeItem(k){this.map.delete(String(k));}
}
const canonical={version:941,islands:{sports:{
  learned:[0,'1',1,9999],
  mc:{0:'3',1:3,2:1000000,3:1000001,'01':4,'-1':5},
  wrongs:{0:'<img src=x onerror=sentinel()>',1:'3',2:5,3:1000000,4:1000001,'01':6,'-1':7},
  cleared:{learned:{0:1700000000000,'01':1700000000001},mc:{1:'1700000000000',2:1700000000000},wrongs:{2:1700000000000,3:'<svg>'}},
}}};
const island={learned:[0,'1'],stats:{},mc:{0:'3',1:3,2:1000000,3:1000001,'01':4},wrongs:{0:'<img>',1:'3',2:5,3:1000000,4:1000001,'01':6}};
const storage=new Storage({
  hansen_canonical_progress_v941:JSON.stringify(canonical),
  wordIslandSports:JSON.stringify(island),
});
const context={console,localStorage:storage,location:{pathname:'/island_sports.html'},S:{learned:[],mc:{},wrongs:{}},document:{readyState:'complete',addEventListener(){}},addEventListener(){},setTimeout(){return 1;},clearTimeout(){}};
context.window=context;context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('./hansen_canonical_progress.js',import.meta.url),'utf8'),context,{filename:'hansen_canonical_progress.js'});

const HC=context.HansenCanonical,snapshot=HC.snapshot(),sports=snapshot.islands.sports;
assert.deepEqual(JSON.parse(JSON.stringify(sports.learned)),[0,1],'only exact numeric learned indexes survive');
assert.deepEqual(JSON.parse(JSON.stringify(sports.mc)),{1:3,2:1000000},'mc rejects strings, oversized values, noncanonical and out-of-range indexes');
assert.deepEqual(JSON.parse(JSON.stringify(sports.wrongs)),{2:5,3:1000000},'wrongs reject HTML/string counts, oversized values and noncanonical indexes');
assert.deepEqual(JSON.parse(JSON.stringify(sports.cleared)),{
  learned:{0:1700000000000},mc:{2:1700000000000},wrongs:{2:1700000000000},srs:{},
},'clear-waterline indexes and timestamps are strict');
assert.deepEqual(JSON.parse(JSON.stringify(context.S.mc)),{1:3,2:1000000});
assert.deepEqual(JSON.parse(JSON.stringify(context.S.wrongs)),{2:5,3:1000000});
assert.doesNotMatch(storage.getItem(HC.STORE_KEY),/<(?:img|svg)/i,'canonical rewrite must not retain attacker markup');
const slice=HC.sliceSnapshot('sports');
assert.equal(slice.items[2].wrongs,5);
assert.equal(slice.items[3].wrongs,1000000);
assert.equal(slice.items[0].wrongs,0);

console.log('canonical input safety v946: strict types/indexes/count caps + safe current-slice synchronization ✅');
