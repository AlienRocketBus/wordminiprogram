#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const pages=['template.html',...fs.readdirSync(ROOT).filter(n=>/^island_[a-z0-9]+\.html$/.test(n)).sort()];
assert.equal(pages.length,28);
for(const name of pages){
  const html=read(name);
  assert.match(html,/const DAILY_QUEST_POOL=\[/,`${name}: task definitions must be authoritative`);
  assert.match(html,/S\.quests=__hsnNormalizeQuests\(S\.quests\)/,`${name}: persisted quests must be rebuilt`);
  assert.match(html,/rewardXp=def\.reward\.xp/,`${name}: claims must use the built-in reward`);
  assert.doesNotMatch(html,/addXP\(q\.reward\.xp\)/,`${name}: persisted reward must never be paid`);
  assert.match(html,/hsnEscapeText\(q\.icon\)/,`${name}: quest icon must be text escaped`);
  assert.match(html,/hsnEscapeText\(q\.title\)/,`${name}: quest title must be text escaped`);
}

const source=read('template.html');
const start=source.indexOf('const DAILY_QUEST_POOL=[');
const end=source.indexOf('function progressQuest',start);
assert(start>=0&&end>start,'quest authority block not found');
const context={console,isFinite,Object,Math,Set,Number,S:{quests:{day:'',list:[],allDay:''}}};
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);

const poisoned={day:'2026-7-16',allDay:'',list:[{
  id:'learn3',icon:'<img src=x onerror=sentinel()>',title:'<svg onload=sentinel()>',
  type:'boss',goal:999999,progress:3,claimed:false,reward:{xp:999999999,gems:999999999},
}]};
let clean=context.__hsnNormalizeQuests(poisoned);
assert.equal(clean.list.length,1);
assert.equal(clean.list[0].icon,'📚');
assert.equal(clean.list[0].title,'学会 3 个新单词');
assert.equal(clean.list[0].type,'learn');
assert.equal(clean.list[0].goal,3);
assert.deepEqual(JSON.parse(JSON.stringify(clean.list[0].reward)),{xp:20,gems:2});

for(const list of [
  [{id:'unknown',progress:0,claimed:false}],
  [{id:'learn3',progress:'3',claimed:false}],
  [{id:'learn3',progress:4,claimed:false}],
  [{id:'learn3',progress:2,claimed:true}],
  [{id:'learn3',progress:0,claimed:false},{id:'learn3',progress:0,claimed:false}],
]){
  clean=context.__hsnNormalizeQuests({day:'2026-7-16',list,allDay:''});
  assert.equal(clean.list.length,0,'invalid/duplicate task state must force a safe reroll');
}

const claimStart=source.indexOf('function claimQuest',end);
const claimEnd=source.indexOf('function updateQuestBadge',claimStart);
assert(claimStart>=0&&claimEnd>claimStart,'claim function not found');
const paid={coins:0,xp:0};
Object.assign(context,{
  S:{streak:0,quests:{day:'2026-7-16',allDay:'',list:[
    {id:'learn3',progress:3,claimed:false,reward:{xp:999999999},icon:'<img onerror=1>'},
    {id:'boss1',progress:0,claimed:false,reward:{xp:999999999}},
  ]}},
  addCoin:n=>{paid.coins+=n;},addXP:n=>{paid.xp+=n;},showToast(){},playOpenChest(){},renderQuests(){},save(){},
  today:()=> '2026-7-16',setTimeout(){},bigConfetti(){},HansenCrystal:null,
});
vm.runInContext(source.slice(claimStart,claimEnd),context);
context.claimQuest(0);
assert.deepEqual(paid,{coins:20,xp:20},'claim must pay the built-in learn3 reward, never persisted reward data');

console.log('daily quest safety v946: 28-page authoritative definitions + rebuilt state + reward integrity ✅');
