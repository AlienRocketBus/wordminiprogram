#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./hansen_explore_progress_v945.js',import.meta.url),'utf8');

// 结构回归：旧四选一必须真正删除，两个按钮只能路由到现有拼写游戏。
for(const forbidden of ['hxpPractice','ensurePractice','openPractice','answerPractice','data-hxp-practice','hxp-option','_choiceSet']){
  assert.equal(source.includes(forbidden),false,`legacy explore quiz leaked: ${forbidden}`);
}
assert.match(source,/HansenTypingMasterV946\.openFocus/);
assert.match(source,/HansenSpellBee\.openFocused/);
assert.match(source,/disabled aria-disabled="true"/);
assert.match(source,/requiredForBee:beeRequired/);

const allW=[
  {en:'alpha',cn:'阿尔法',emoji:'📘'},
  {en:'beta',cn:'贝塔',emoji:'📘'},
  {en:'gamma',cn:'伽马',emoji:'📘'}
];
let petMastery=[0,0,3],crystalLv=[0,1,5],locked=[false,true,true];
const canonical=()=>({ok:true,id:'action',masterHits:3,items:allW.map((_,i)=>({localIndex:i,mastery:petMastery[i],mastered:petMastery[i]>=3,learned:false,slotId:'action:'+i,canonicalIndex:i}))});
const crystal=()=>({ok:true,id:'action',rules:{maxLevel:5,hitsPerStar:2,gemsPerWord:4,boostStarGain:2,dailyStarLocks:1},items:allW.map((_,i)=>({localIndex:i,lv:crystalLv[i],p:0,done:crystalLv[i]>=5,lockedToday:locked[i],boosted:false,boostMinutes:0,reward:{state:'not-earned'}}))});
const c={
  console,document:null,allW,S:{learned:[]},location:{pathname:'/island_action.html'},Date,JSON,Math,Number,isFinite,
  setTimeout(){return 1;},requestAnimationFrame(fn){fn();return 1;},addEventListener(){},dispatchEvent(){},
  HansenCanonical:{currentRef(){return 'wordIslandVerbs';},sliceSnapshot:canonical},
  HansenCrystal:{sliceProgress:crystal,getRules(){return crystal().rules;}},
  HsnPet:{progressSnapshot(){return {ok:true,maxed:false,mastered:petMastery.filter(n=>n>=3).length,xp:0,nextMasterReq:3,nextXpReq:0,remainingWords:2,remainingXP:0,nextStageName:'下一阶'};}}
};
c.window=c;c.globalThis=c;
vm.createContext(c);vm.runInContext(source,c,{filename:'hansen_explore_progress_v945.js'});
const gate=c.HansenSpellingProgressV946;
assert(gate,'v946 spelling gate must be exported');

assert.equal(gate.requiredForBee(20),10);
assert.equal(gate.requiredForBee(49),10);
assert.equal(gate.requiredForBee(50),7);
assert.equal(gate.requiredForBee(79),7);
assert.equal(gate.requiredForBee(80),5);
assert.equal(gate.requiredForBee(160),5);
assert.equal(gate.allows('pet',0),true);
assert.equal(gate.allows('pet',2),false,'mastered word cannot relaunch pet challenge');
assert.equal(gate.allows('crystal',0),true);
assert.equal(gate.allows('crystal',1),false,'same-day locked word cannot relaunch Bee');
assert.equal(gate.allows('crystal',2),false,'done crystal cannot relaunch Bee');

let petWrites=0,crystalWrites=0,ordinaryAnswers=0;
function formalMark(idx,correct){
  ordinaryAnswers++;
  if(!correct)return;
  const pet=gate.consume('pet',idx);
  if(pet){petWrites++;gate.settle(pet,{ok:true,changed:true,mastery:petWrites});}
  const gem=gate.consume('crystal',idx);
  if(gem){crystalWrites++;gate.settle(gem,{ok:true,changed:true,level:crystalWrites});}
}

// 通用选择题仍可记录答题，但绝对不得推进宠物或结晶。
formalMark(0,true);
assert.equal(ordinaryAnswers,1);assert.equal(petWrites,0);assert.equal(crystalWrites,0);

let out=gate.run('pet',0,{mode:'typing-master',focus:true,complete:true,exact:true,noHint:true},()=>formalMark(0,true));
assert.equal(out.ok,true);assert.equal(out.consumed,true);assert.equal(petWrites,1);assert.equal(crystalWrites,0,'pet proof must not bleed into crystal');

for(const cpm of [20,50,80]){
  const need=gate.requiredForBee(cpm);
  out=gate.run('crystal',0,{mode:'spelling-bee',focused:true,complete:true,exact:true,cpm,required:need,wins:need},()=>formalMark(0,true));
  assert.equal(out.ok,true,`qualified Bee @${cpm} CPM must settle`);
}
assert.equal(petWrites,1,'crystal proof must not bleed into pet');assert.equal(crystalWrites,3);

// 速度与次数必须由 gate 自己复验，不信任调用方声称。
out=gate.run('crystal',0,{mode:'spelling-bee',focused:true,complete:true,exact:true,cpm:80,required:4,wins:99},()=>formalMark(0,true));
assert.equal(out.ok,false);assert.equal(out.reason,'bee-proof-required');assert.equal(crystalWrites,3);
out=gate.run('crystal',0,{mode:'spelling-bee',focused:true,complete:true,exact:true,cpm:50,required:7,wins:6},()=>formalMark(0,true));
assert.equal(out.ok,false);assert.equal(crystalWrites,3);
out=gate.run('pet',0,{mode:'typing-master',focus:true,complete:true,exact:true,noHint:false},()=>formalMark(0,true));
assert.equal(out.ok,false);assert.equal(petWrites,1,'hinted typing cannot advance mastery');

// 没有账本 settle 的回调不能冒充成功，以便持久化收据保留重试。
out=gate.run('pet',0,{mode:'typing-master',focus:true,complete:true,exact:true,noHint:true},()=>{});
assert.equal(out.ok,false);assert.equal(out.reason,'proof-not-consumed');
out=gate.run('pet',0,{mode:'typing-master',focus:true,complete:true,exact:true,noHint:true},()=>{const p=gate.consume('pet',0);gate.settle(p,{ok:false,reason:'save-failed'});});
assert.equal(out.ok,false);assert.equal(out.reason,'save-failed');

// 真正的账本 wrapper 也必须 fail-closed 且回报 settle。
const petSource=fs.readFileSync(new URL('./hansen_pet_showcase.js',import.meta.url),'utf8');
const crystalSource=fs.readFileSync(new URL('./hansen_crystal.js',import.meta.url),'utf8');
assert.match(petSource,/consume\('pet',\+idx\)/);assert.match(petSource,/settle\(proof,masteryResult/);
assert.match(crystalSource,/consume\('crystal',\+idx\)/);assert.match(crystalSource,/onQualifiedSpelling\(idx,proof\)/);assert.match(crystalSource,/settle\(proof,qualified\)/);
assert.doesNotMatch(crystalSource,/try\{ onAnswer\(idx, correct\); refreshBadge\(\); \}catch/,'generic markAnswer must no longer advance crystal');

console.log('explore spelling gate v946: no quiz bypass + isolated one-shot proofs + Bee 10/7/5 + same-day launch lock ✅');
