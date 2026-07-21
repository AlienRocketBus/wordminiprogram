#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage{
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[String(k),String(v)]));this.throwReads=false;}
  get length(){return Object.keys(this.d).length;}key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){if(this.throwReads)throw new Error('blocked');return Object.hasOwn(this.d,String(k))?this.d[String(k)]:null;}
  setItem(k,v){this.d[String(k)]=String(v);}removeItem(k){delete this.d[String(k)];}
}
const today=(()=>{const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;})();
const at=Date.now();
const awardKey='hansen_gem_awards_v942';
const storage=new Storage({
  hansen_gems_cleared_v1:'1',hansen_wallet_gems:'10',hsn_crystal_gems:'999999',
  [awardKey]:JSON.stringify({
    'crystal:word:action:3':{amount:4,at},
    'crystal:word:action:4':{amount:0,at,migrated:true},
    'crystal:word:action:5':{amount:3,at}
  })
});
const document={readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},createElement(){return {style:{},classList:{add(){},remove(){}},appendChild(){},addEventListener(){},querySelector(){return null;},setAttribute(){}};},head:{appendChild(){}},body:{appendChild(){},children:[]}};
const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},dispatchEvent(){},innerWidth:390,innerHeight:844,__hsnSaveKey:'wordIslandVerbs',allW:Array.from({length:67},(_,i)=>({en:'w'+i,cn:'义'+i,emoji:'📘'}))};
c.window=c;c.globalThis=c;c.S={learned:[],mc:{},wrongs:{}};
vm.createContext(c);
for(const file of ['hansen_canonical_progress.js','hansen_gem_system.js'])vm.runInContext(fs.readFileSync(new URL('./'+file,import.meta.url),'utf8'),c,{filename:file});
// Insert a valid in-flight transaction after gem boot, so the readonly API can
// expose “pending” without boot's recovery immediately committing it.
storage.setItem('hansen_gem_award_pending_v942',JSON.stringify({id:'crystal:word:action:6',amount:4,before:10,target:14,at}));

const records={
  1:{lv:1,p:1,d:'',done:0},
  2:{lv:4,p:0,d:today,done:0},
  3:{lv:5,p:0,d:today,done:1},
  4:{lv:5,p:0,d:today,done:1},
  5:{lv:5,p:0,d:today,done:1},
  6:{lv:5,p:0,d:today,done:1},
  7:{lv:5,p:0,d:today,done:1}
};
storage.setItem('hsn_crystal_action',JSON.stringify(records));storage.setItem('hsn_crystal_action_bak',JSON.stringify(records));
vm.runInContext(fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8'),c,{filename:'hansen_crystal.js'});

let awardStateCalls=0,lastRequests=[];
const originalStates=c.HansenGems.awardStates;
c.HansenGems.awardStates=function(req){awardStateCalls++;lastRequests=req.slice();return originalStates(req);};
let snap=c.HansenCrystal.sliceProgress('wordIslandVerbs');
assert.equal(snap.ok,true);
assert.deepEqual(JSON.parse(JSON.stringify(snap.rules)),{maxLevel:5,hitsPerStar:2,gemsPerWord:4,boostStarGain:2,dailyStarLocks:1});
assert.deepEqual([snap.items[0].lv,snap.items[0].p,snap.items[0].done],[0,0,false]);
assert.deepEqual([snap.items[1].lv,snap.items[1].p],[1,1]);
assert.equal(snap.items[2].lockedToday,true);
assert.equal(snap.items[3].reward.state,'paid');
assert.equal(snap.items[4].reward.state,'legacy');
assert.equal(snap.items[5].reward.state,'mismatch');
assert.equal(snap.items[6].reward.state,'pending');
assert.equal(snap.items[7].reward.state,'unpaid');
assert.equal(awardStateCalls,1,'a whole island must query the reward ledger once');
assert.deepEqual([...lastRequests].map(x=>x.id),[3,4,5,6,7].map(i=>'crystal:word:action:'+i),'only done words need reward-ledger queries');

// Spending the wallet after a valid award never erases its paid proof.
storage.removeItem('hansen_gem_award_pending_v942');
assert.equal(c.HansenGems.spend(10),true);assert.equal(c.HansenGems.get(),0);
assert.equal(c.HansenGems.awardState('crystal:word:action:3',4).state,'paid');
assert.equal(c.HansenGems.awardState('crystal:word:action:7',4).state,'unpaid');
assert.equal(storage.getItem('hsn_crystal_gems'),'999999','legacy aggregate display is not payment proof');

// Land2 local word 0 and Season word 30 must share crystal slot/source.
const seasonRecord={30:{lv:5,p:0,d:today,done:1}};
storage.setItem('hsn_crystal_season',JSON.stringify(seasonRecord));storage.setItem('hsn_crystal_season_bak',JSON.stringify(seasonRecord));
const ledger=JSON.parse(storage.getItem(awardKey));ledger['crystal:word:season:30']={amount:4,at};storage.setItem(awardKey,JSON.stringify(ledger));
const land=c.HansenCrystal.sliceProgress('wordIslandLand2');
const season=c.HansenCrystal.sliceProgress('wordIslandSeason');
assert.equal(land.items[0].slotId,'season:30');
assert.equal(land.items[0].rewardSource,'crystal:word:season:30');
assert.equal(season.items[30].rewardSource,land.items[0].rewardSource);
assert.equal(land.items[0].reward.state,'paid');

// Crystal main damaged + good backup recovers; both damaged and storage denial fail closed.
storage.setItem('hsn_crystal_action','{bad');storage.setItem('hsn_crystal_action_bak',JSON.stringify(records));
assert.equal(c.HansenCrystal.sliceProgress('wordIslandVerbs').ok,true);
storage.setItem('hsn_crystal_action','{bad');storage.setItem('hsn_crystal_action_bak','[]');
snap=c.HansenCrystal.sliceProgress('wordIslandVerbs');assert.equal(snap.ok,false);assert.equal(snap.reason,'corrupt-store');
storage.throwReads=true;assert.equal(c.HansenCrystal.sliceProgress('wordIslandVerbs').ok,false);storage.throwReads=false;

// Pure UI mapping: only mc>=3 lights the paw, and only done + paid lights the diamond.
c.document=null;
c.allW=Array.from({length:80},(_,i)=>({en:'w'+i,cn:'义'+i,emoji:'📘'}));
c.allW[68]={en:'rarely',cn:'很少',emoji:'📘'};c.allW[75]={en:'seldom',cn:'很少',emoji:'📘'};
vm.runInContext(fs.readFileSync(new URL('./hansen_explore_progress_v945.js',import.meta.url),'utf8'),c,{filename:'hansen_explore_progress_v945.js'});
const ui=c.HansenExploreProgress;
for(const [mc,text,lit] of [[0,'🐾 0/3',false],[1,'🐾 1/3',false],[2,'🐾 2/3',false],[3,'🐾 3/3',true],[9,'🐾 3/3',true]]){
  const badge=ui._badgeInfo({masteryReadable:true,mastery:mc,mastered:mc>=3,masterHits:3,crystalReadable:false}).paw;
  assert.equal(badge.text,text);assert.equal(badge.cls.includes('done'),lit);
}
const learnedButNotMastered=ui._badgeInfo({seen:true,masteryReadable:true,mastery:2,mastered:false,masterHits:3,crystalReadable:false});
assert.equal(learnedButNotMastered.paw.cls.includes('done'),false);
for(const [reward,isPaid] of [['paid',true],['legacy',false],['pending',false],['unpaid',false],['blocked',false]]){
  const badge=ui._badgeInfo({masteryReadable:true,mastery:3,mastered:true,masterHits:3,crystalReadable:true,lv:5,p:0,done:true,reward:{state:reward}}).gem;
  assert.equal(badge.cls.includes('paid'),isPaid,`${reward} must map to the correct full-diamond state`);
}

// v946 不再自建选择题；难度次数由共享 gate 统一计算。
assert.equal(ui._choiceSet,undefined,'legacy explore multiple-choice helper must be removed');
assert.equal(ui._beeRequired(20),10);assert.equal(ui._beeRequired(49),10);
assert.equal(ui._beeRequired(50),7);assert.equal(ui._beeRequired(79),7);
assert.equal(ui._beeRequired(80),5);
assert.equal(typeof c.HansenSpellingProgressV946.run,'function');
assert.equal(typeof c.HansenSpellingProgressV946.consume,'function');

console.log('explore dual progress v945/v946: ledger truth + aliases + badge semantics + spelling-only thresholds ✅');
