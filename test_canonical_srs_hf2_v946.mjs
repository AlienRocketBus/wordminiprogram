#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor(seed={}){this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)]));}
  get length(){return this.map.size;}
  key(i){return [...this.map.keys()][i]??null;}
  getItem(k){return this.map.has(String(k))?this.map.get(String(k)):null;}
  setItem(k,v){this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
}
const j=JSON.stringify;
const storage=new MemoryStorage({
  wordIslandSeason:j({lastSaveTime:100,wrongs:{30:2},srs:{30:{box:1,due:'2026-07-18',last:'2026-07-16'}}}),
  wordIslandLand2:j({lastSaveTime:200,wrongs:{0:2},srs:{0:{box:3,due:'2026-07-24',last:'2026-07-17'}}})
});
const context={
  console,localStorage:storage,location:{pathname:'/island_land2.html'},
  S:{lastSaveTime:200,learned:[],mc:{},wrongs:{0:2},srs:{0:{box:3,due:'2026-07-24',last:'2026-07-17'}}},
  document:{readyState:'loading',addEventListener(){}},setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}
};
context.window=context;context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('hansen_canonical_progress.js','utf8'),context,{filename:'hansen_canonical_progress.js'});
const HC=context.HansenCanonical;
const publicPlan=e=>e?{box:e.box,due:e.due,last:e.last}:e;

// 旧物理存档没有 updatedAt 时，以各自 lastSaveTime 判新旧；同一 last 日期绝不能靠更高 box 获胜。
const legacy=HC._blankStore();legacy.islands.season.wrongs[30]=2;
HC._mergeState(legacy,'season',{lastSaveTime:100,wrongs:{30:2},srs:{30:{box:4,due:'2026-08-01',last:'2026-07-17'}}});
HC._mergeState(legacy,'land2',{lastSaveTime:200,wrongs:{0:2},srs:{0:{box:0,due:'2026-07-18',last:'2026-07-17'}}});
assert.equal(legacy.islands.season.srs[30].box,0);assert.equal(legacy.islands.season.srs[30].updatedAt,200);

HC.migrate();
let store=HC.read();
assert.deepEqual(JSON.parse(JSON.stringify(store.islands.season.srs[30])),{box:3,due:'2026-07-24',last:'2026-07-17',updatedAt:200},'newest alias schedule must win and retain its revision');

HC.syncCurrent();
assert.deepEqual(JSON.parse(JSON.stringify(context.S.srs)),{0:{box:3,due:'2026-07-24',last:'2026-07-17'}},'Land2 must receive canonical Season slot 30 schedule');

assert.equal(HC.setCurrentSrs(0,{box:4,due:'2026-08-01',last:'2026-07-18'}),true);
const seasonView={learned:[],mc:{},wrongs:{},srs:{}};
HC.syncState('season',seasonView,false);
assert.deepEqual(JSON.parse(JSON.stringify(seasonView.srs[30])),{box:4,due:'2026-08-01',last:'2026-07-18'},'Season view must see Land2 grade immediately');

// 同一天先升盒、后答错降回盒0时，后写入必须获胜；旧别名不能靠“box 更高”抬回去。
assert.equal(HC.setCurrentSrs(0,{box:0,due:'2026-07-19',last:'2026-07-18'}),true);
store=HC.read();
assert.equal(store.islands.season.srs[30].box,0,'same-day later failure must lower the canonical box');
assert.ok(store.islands.season.srs[30].updatedAt>200,'canonical SRS must carry a monotonic revision');
storage.setItem('wordIslandSeason',j({lastSaveTime:150,wrongs:{30:2},srs:{30:{box:4,due:'2026-08-01',last:'2026-07-18'}}}));
HC.migrate();store=HC.read();
assert.equal(store.islands.season.srs[30].box,0,'stale same-day higher box must not overwrite the later failure');

// v1165: a correction that clears the wrong count clears ONLY the 错题本 (with a tombstone).
// The review plan stays until it graduates on due days — v946 deleted it here, so one miss +
// one same-day correct answer dropped the word from spaced review for good.
context.S.wrongs={};context.S.srs={};
assert.equal(HC.absorbAnswer(0),true);
store=HC.read();
assert.equal(store.islands.season.wrongs[30],undefined);
assert.ok(store.islands.season.cleared.wrongs[30]>0);
assert.deepEqual(JSON.parse(JSON.stringify(publicPlan(store.islands.season.srs[30]))),{box:0,due:'2026-07-19',last:'2026-07-18'},'clearing the wrong count must keep the review plan');
assert.ok(!store.islands.season.cleared.srs[30],'clearing the wrong count must not tombstone the plan');
HC.migrate();store=HC.read();
assert.equal(store.islands.season.wrongs[30],undefined,'stale alias saves must not resurrect a cleared wrong');
assert.equal(store.islands.season.srs[30].box,0,'stale alias saves must not raise the kept plan');
{
  const view={learned:[],mc:{},wrongs:{0:99},srs:{}};
  HC.syncState('land2',view,false);
  assert.deepEqual(JSON.parse(JSON.stringify(view.wrongs)),{});
  assert.deepEqual(JSON.parse(JSON.stringify(view.srs)),{0:{box:0,due:'2026-07-19',last:'2026-07-18'}},'the kept plan must still reach the alias entry');
}

// Graduation (plan set to null) must atomically remove the plan and leave a tombstone.
assert.equal(HC.setCurrentSrs(0,null),true);
store=HC.read();
assert.equal(store.islands.season.srs[30],undefined);
assert.ok(store.islands.season.cleared.srs[30]>0);

// Re-running migration over stale physical Season/Land saves must not resurrect either wrong or due.
HC.migrate();store=HC.read();
assert.equal(store.islands.season.wrongs[30],undefined);
assert.equal(store.islands.season.srs[30],undefined);
const landView={learned:[],mc:{},wrongs:{0:99},srs:{0:{box:0,due:'2026-01-01',last:''}}};
HC.syncState('land2',landView,false);
assert.deepEqual(JSON.parse(JSON.stringify(landView.wrongs)),{});
assert.deepEqual(JSON.parse(JSON.stringify(landView.srs)),{});

console.log('canonical SRS HF2 v946: alias merge + cross-entry sync + clear tombstone + stale due suppression + v1165 plan outlives 错题本 ✅');
