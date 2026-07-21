#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Storage {
  constructor(seed={}){this.d=Object.fromEntries(Object.entries(seed).map(([k,v])=>[String(k),String(v)]));this.reads={};this.throwReads=false;}
  get length(){return Object.keys(this.d).length;}
  key(i){return Object.keys(this.d)[i]??null;}
  getItem(k){k=String(k);this.reads[k]=(this.reads[k]||0)+1;if(this.throwReads)throw new Error('blocked');return Object.hasOwn(this.d,k)?this.d[k]:null;}
  setItem(k,v){this.d[String(k)]=String(v);}
  removeItem(k){delete this.d[String(k)];}
  resetReads(){this.reads={};}
}

const storage=new Storage();
const document={readyState:'loading',addEventListener(){},getElementById(){return null;},createElement(){return {style:{},classList:{add(){},remove(){},contains(){return false;}},appendChild(){},addEventListener(){},querySelector(){return null;}};},head:{appendChild(){}},body:{appendChild(){}}};
const c={console,localStorage:storage,document,location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},addEventListener(){},dispatchEvent(){},innerWidth:390,innerHeight:844,__hsnSaveKey:'wordIslandVerbs'};
c.window=c;c.globalThis=c;c.S={learned:[],mc:{},wrongs:{},xp:0,totalXP:0,pet:{}};
vm.createContext(c);
vm.runInContext(fs.readFileSync(new URL('./hansen_canonical_progress.js',import.meta.url),'utf8'),c,{filename:'hansen_canonical_progress.js'});

const canonical=c.HansenCanonical;
const store=canonical._blankStore();
[0,1,2,3,9].forEach((hits,index)=>{if(hits)store.islands.action.mc[index]=hits;});
store.islands.action.learned=[0,1,2];
store.islands.season.mc[30]=2;
storage.setItem(canonical.STORE_KEY,JSON.stringify(store));
storage.setItem(canonical.STORE_KEY+'_bak',JSON.stringify(store));
storage.resetReads();

let snap=canonical.sliceSnapshot('wordIslandVerbs');
assert.equal(snap.ok,true);
assert.deepEqual([...snap.items].slice(0,5).map(x=>x.mastery),[0,1,2,3,9]);
assert.deepEqual([...snap.items].slice(0,5).map(x=>x.mastered),[false,false,false,true,true]);
assert.equal(snap.items[2].learned,true,'“已认识”不等于宠物掌握');
assert.equal(snap.items[2].mastered,false,'learned=true + mc=2 must not light the paw');
assert((storage.reads[canonical.STORE_KEY]||0)<=2,'batch snapshot must not parse the canonical main once per word');
assert((storage.reads[canonical.STORE_KEY+'_bak']||0)<=2,'batch snapshot must not parse the canonical backup once per word');

const land=canonical.sliceSnapshot('wordIslandLand2');
const season=canonical.sliceSnapshot('wordIslandSeason');
assert.equal(land.items[0].slotId,'season:30');
assert.equal(land.items[0].mastery,2);
assert.equal(season.items[30].slotId,land.items[0].slotId);
assert.equal(season.items[30].mastery,land.items[0].mastery,'Land2 and Season must read the same canonical slot');

// Main damaged + healthy backup recovers; both damaged and storage denial fail closed.
storage.setItem(canonical.STORE_KEY,'{broken');
storage.setItem(canonical.STORE_KEY+'_bak',JSON.stringify(store));
assert.equal(canonical.sliceSnapshot('wordIslandVerbs').ok,true);
storage.setItem(canonical.STORE_KEY,'{broken');storage.setItem(canonical.STORE_KEY+'_bak','[]');
snap=canonical.sliceSnapshot('wordIslandVerbs');assert.equal(snap.ok,false);assert.equal(snap.reason,'corrupt-store');
storage.throwReads=true;assert.equal(canonical.sliceSnapshot('wordIslandVerbs').ok,false);storage.throwReads=false;

// Screenshot case: 63 canonical mastered words + ample XP = current display stage 12,
// next stage requires 66, and progress is cumulative (not reset at evolution).
const petStore=canonical._blankStore();
for(let i=0;i<63;i++)petStore.islands.action.mc[i]=3;
storage.setItem(canonical.STORE_KEY,JSON.stringify(petStore));storage.setItem(canonical.STORE_KEY+'_bak',JSON.stringify(petStore));
storage.setItem('hansen_wallet_charxp','49471');
c.S={learned:[],mc:Object.fromEntries(Array.from({length:63},(_,i)=>[i,3])),wrongs:{},xp:0,totalXP:0,pet:{}};
c.PET_STAGES=Array.from({length:36},(_,i)=>({name:'阶段'+(i+1),text:'',img:'',emoji:'🥚'}));
vm.runInContext(fs.readFileSync(new URL('./hansen_pet_showcase.js',import.meta.url),'utf8'),c,{filename:'hansen_pet_showcase.js'});
let masteredReads=0,absorbs=0;
const originalTotal=canonical.totalMastered,originalAbsorb=canonical.absorbCurrent;
canonical.totalMastered=function(){masteredReads++;return originalTotal.apply(this,arguments);};
canonical.absorbCurrent=function(){absorbs++;return originalAbsorb.apply(this,arguments);};
const pet=c.HsnPet.progressSnapshot();
assert.equal(pet.stageNumber,12);assert.equal(pet.nextMasterReq,66);assert.equal(pet.remainingWords,3);
assert.equal(pet.mastered,63);assert.equal(pet.xp,49471);
assert.equal(masteredReads,1,'one pet snapshot must sample mastered words once');
assert.equal(absorbs,1,'one pet snapshot must absorb current state once');

// Crossing the next threshold keeps cumulative XP/mastery instead of resetting them.
const upgraded=canonical.read();for(let i=63;i<66;i++)upgraded.islands.action.mc[i]=3;canonical.write(upgraded,true);
c.S.mc[63]=3;c.S.mc[64]=3;c.S.mc[65]=3;
const next=c.HsnPet.progressSnapshot();
assert.equal(next.stageNumber,13);assert.equal(next.mastered,66);assert.equal(next.xp,49471);

console.log('explore progress API v945: canonical batch/fail-closed + Land alias + cumulative pet thresholds ✅');
