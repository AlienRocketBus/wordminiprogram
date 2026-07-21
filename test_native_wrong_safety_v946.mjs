#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const pages=['template.html',...fs.readdirSync(ROOT).filter(n=>/^island_[a-z0-9]+\.html$/.test(n)).sort()];
assert.equal(pages.length,28,'template + 27 playable islands must be covered');

for(const name of pages){
  const html=read(name);
  assert.equal((html.match(/function __hsnSafeWrongCount\(/g)||[]).length,1,`${name}: missing count validator`);
  assert.equal((html.match(/function __hsnNormalizeWrongMap\(/g)||[]).length,1,`${name}: missing wrong-map normalizer`);
  assert.match(html,/S\.wrongs=__hsnNormalizeWrongMap\(S\.wrongs\)/,`${name}: load must normalize persisted wrongs`);
  assert.match(html,/S\.stats=__hsnNormalizeStats\(S\.stats\)/,`${name}: load must normalize persisted statistics`);
  assert.match(html,/const weight=Math\.min\(20,__hsnSafeWrongCount\(S\.wrongs\[i\]\)\*2\)/,
    `${name}: smart-pool weight must be capped at 20 slots`);
  assert.doesNotMatch(html,/×'\+S\.wrongs\[idx\]/,`${name}: raw wrong count must never enter HTML`);
  assert.doesNotMatch(html,/count:S\.wrongs\[k\]/,`${name}: statistics/review must not carry raw counts`);
}

// Execute the exact template helpers to prove type, index and range behavior.
const template=read('template.html');
const helperStart=template.indexOf('var __HSN_MAX_WRONG_COUNT=');
const helperEnd=template.indexOf('function __hsnResetJournalKey',helperStart);
assert(helperStart>=0&&helperEnd>helperStart,'helper block not found');
const smartStart=template.indexOf('function getSmartPool()');
const smartEnd=template.indexOf('// ============================================================',smartStart+30);
assert(smartStart>=0&&smartEnd>smartStart,'smart pool block not found');
const context={allW:Array.from({length:5},(_,i)=>({en:`w${i}`})),S:{wrongs:{}},Number,Math,isFinite};
vm.createContext(context);
vm.runInContext(template.slice(helperStart,helperEnd)+template.slice(smartStart,smartEnd),context);

const poisoned=JSON.parse('{"0":1,"1":"3","01":4,"-1":5,"4":1000000,"5":2,"__proto__":9}');
const normalized=context.__hsnNormalizeWrongMap(poisoned);
assert.deepEqual(JSON.parse(JSON.stringify(normalized)),{0:1,4:1000000},'only canonical in-range numeric counts survive');
context.S.wrongs=normalized;
const pool=context.getSmartPool();
assert.equal(pool.length,27,'normal 5-word pool + 2 slots for count 1 + capped 20 slots for huge count');
assert.equal(pool.filter(i=>i===4).length,21,'word 4 appears once normally plus at most 20 weighted slots');

const cleanStats=context.__hsnNormalizeStats({
  molesCleared:'<img src=x onerror=sentinel()>',fishCleared:3,eagleCleared:-1,reviewToday:1.5,
  bubbleBest:{easy:4,medium:'<svg onload=sentinel()>',hard:6},
  gameCounts:{typing:7,bad:'<img onerror=1>','<svg>':9},
  modesPlayed:['typing','<img>',9],reviewDay:'<img>',scrLevels:{easy:true,medium:'yes'},
});
assert.equal(cleanStats.molesCleared,0);
assert.equal(cleanStats.fishCleared,3);
assert.equal(cleanStats.eagleCleared,0);
assert.equal(cleanStats.reviewToday,0);
assert.deepEqual(JSON.parse(JSON.stringify(cleanStats.bubbleBest)),{easy:4,medium:0,hard:6});
assert.deepEqual(JSON.parse(JSON.stringify(cleanStats.gameCounts)),{typing:7,bad:0});
assert.deepEqual(JSON.parse(JSON.stringify(cleanStats.modesPlayed)),['typing']);
assert.equal(cleanStats.reviewDay,'');
assert.equal(context.__hsnBestStatValue(cleanStats.bubbleBest),6);

console.log('native persisted-data safety v946: 28-page wrong/stat normalization + numeric rendering + bounded weighting ✅');
