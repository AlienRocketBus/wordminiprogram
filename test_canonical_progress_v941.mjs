import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class MemoryStorage {
  constructor(seed={}){ this.map=new Map(Object.entries(seed).map(([k,v])=>[k,String(v)])); }
  get length(){ return this.map.size; }
  key(i){ return [...this.map.keys()][i] ?? null; }
  getItem(k){ return this.map.has(String(k)) ? this.map.get(String(k)) : null; }
  setItem(k,v){ this.map.set(String(k),String(v)); }
  removeItem(k){ this.map.delete(String(k)); }
}

const j=o=>JSON.stringify(o);
const storage=new MemoryStorage({
  wordIslandVerbs:j({learned:[0,1],mc:{0:3,1:1},wrongs:{1:2}}),
  wordIslandSeason:j({learned:[0,30],mc:{0:1,30:2}}),
  wordIslandLand1:j({learned:[0,1],mc:{0:2,1:3},wrongs:{1:1}}),
  wordIslandLand2:j({learned:[0],mc:{0:2}}),
  wordIslandSeason3:j({learned:[2],mc:{2:2}}),
  hsn_crystal_island_land8:j({29:{lv:5,p:0,d:'2026-7-13',done:1}})
});
const context={
  console, localStorage:storage, location:{pathname:'/island_land3.html'},
  S:{learned:[],mc:{},wrongs:{}},
  document:{readyState:'loading',addEventListener(){}}, addEventListener(){},
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){}
};
context.window=context; context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('hansen_canonical_progress.js','utf8'),context,{filename:'hansen_canonical_progress.js'});
const HC=context.HansenCanonical;

assert.equal(HC.VERSION,941);
assert.equal(HC.islands.length,19);
assert.equal(HC.REGULAR_WORDS,712);
assert.equal(HC.STAR_SEA_WORDS,240);
assert.equal(HC.TOTAL_WORDS,952);
assert.equal(HC.islands.reduce((n,i)=>n+i.words,0),952);

// 权威常量必须与仓库真实词表同源：18 常规=712，Season=240，Land=连续八段×30。
const islandData=JSON.parse(fs.readFileSync('island_data.json','utf8'));
const dataCount=s=>(s.match(/\ben\s*:/g)||[]).length;
assert.equal(Object.entries(islandData).filter(([k])=>k!=='season').reduce((n,[,d])=>n+dataCount(d.DATA),0),712);
assert.equal(dataCount(islandData.season.DATA),240);
const htmlWords=file=>{
  const s=fs.readFileSync(file,'utf8'),a=s.indexOf('const DATA=['),b=s.indexOf('const allW=DATA.flatMap',a);
  return [...s.slice(a,b).matchAll(/\{en:"([^"]+)"/g)].map(m=>m[1]);
};
const seasonWords=htmlWords('island_season.html');
for(let i=1;i<=8;i++)assert.deepEqual(htmlWords(`island_land${i}.html`),seasonWords.slice((i-1)*30,i*30));

assert.deepEqual(
  JSON.parse(JSON.stringify(HC.resolve('island_land8.html'))),
  {id:'season',offset:210,length:30,saveKey:'wordIslandLand8',words:240,start:712,file:'island_season.html',canonicalSaveKey:'wordIslandSeason'}
);
assert.equal(HC.toCanonicalIndex('wordIslandLand1',29),29);
assert.equal(HC.toCanonicalIndex('wordIslandLand2',0),30);
assert.equal(HC.toCanonicalIndex('island_season3.html',2),82);
assert.equal(HC.toCanonicalIndex('land8',29),239);
assert.equal(HC.fromCanonicalIndex('land8',239),29);
assert.equal(HC.fromCanonicalIndex('land8',209),-1);
assert.equal(HC.slotId('land2',0),'season:30');

HC.migrate();
assert.equal(HC.totalLearned(),7); // action 2 + season {0,1,30,82,239}
assert.equal(HC.totalMastered(3),3); // action:0, season:1, season:239
assert.equal(HC.isLearned('land1',1),true);
assert.equal(HC.mastery('season',1),3);
assert.equal(HC.isMastered('season',239),true);

// Land3 打开时只回填其 60~89 切片；legacy season3:2 => canonical 82 => Land3 local 22。
HC.syncCurrent();
assert.deepEqual(JSON.parse(JSON.stringify(context.S.learned)),[22]);
assert.equal(context.S.mc[22],2);

// 当前内存比落盘新时，absorb 必须即时纳入，且别名仍是同一 slot。
context.S.learned.push(5);
context.S.mc[5]=3;
HC.absorbCurrent();
assert.equal(HC.slotId('land3',5),'season:65');
assert.equal(HC.isMastered('season',65),true);
assert.equal(HC.totalLearned(),8);
assert.equal(HC.totalMastered(3),4);

// 幂等：重复迁移不改变 canonical JSON，也不重复累计 Land/Season。
const once=storage.getItem(HC.STORE_KEY);
HC.migrate();
const twice=storage.getItem(HC.STORE_KEY);
assert.equal(twice,once);
assert.equal(HC.totalLearned(),8);
assert.equal(HC.totalMastered(3),4);
assert.equal(storage.getItem('hansen_canonical_migrated_v941'),'1');

console.log('canonical progress v941: 19 islands / 952 unique slots / alias migration / idempotence ✅');
