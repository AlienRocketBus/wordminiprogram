#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
/* v963 dyn */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const legacy={
  vegetable:'🥬',cabbage:'🥦',food:'🍽️',pork:'🐖',yogurt:'🥣',
  sugar:'🍯',dinner:'🍝',snack:'🍿',restaurant:'🏪',menu:'🗒️'
};
const targets=Object.keys(legacy).sort();
const unsafe=/<\/?(?:script|style|foreignObject|iframe|object|embed|a)\b|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=/i;

function dataFromPage(source,label){
  const match=source.match(/const DATA=\[([\s\S]*?)\n\];\nconst allW=/);
  assert.ok(match,`${label}: DATA block missing`);
  return vm.runInNewContext(`[${match[1]}]`,Object.create(null));
}

const islandData=JSON.parse(fs.readFileSync('island_data.json','utf8'));
const canonical=vm.runInNewContext(islandData.food.DATA+'\nDATA',Object.create(null));
const canonicalWords=canonical.flatMap(group=>group.words);
assert.equal(canonicalWords.length,56,'food island must keep exactly 56 words');

const pageSource=fs.readFileSync('island_food.html','utf8');
const renderedWords=dataFromPage(pageSource,'island_food.html').flatMap(group=>group.words);
assert.equal(renderedWords.length,56,'generated food page must keep exactly 56 words');

const vocabSource=fs.readFileSync('vocab_all.js','utf8');
const marker='window.HANSEN_VOCAB_ALL = ';
const start=vocabSource.indexOf(marker)+marker.length;
const end=vocabSource.indexOf(';\n// 同时写入',start);
assert.ok(start>=marker.length && end>start,'global vocabulary payload missing');
const globalWords=JSON.parse(vocabSource.slice(start,end)).wordIslandFood;
assert.equal(globalWords.length,56,'global food vocabulary must keep exactly 56 words');

const beeSource=fs.readFileSync('spelling_bee.html','utf8');
const beeWords=beeSource.split('\n')
  .filter(line=>line.includes('"isl": "food"'))
  .map(line=>JSON.parse(line.trim().replace(/,$/,'')));
assert.equal(beeWords.length,53,'Spelling Bee food pool must keep its existing 53-word scope');

const markupWords=canonicalWords.filter(word=>String(word.emoji).startsWith('<')).map(word=>word.en).sort();
assert.deepEqual(Array.from(markupWords),targets,'only the ten approved food words may use app-owned SVG icons');

const icons=[];
for(const [word,oldIcon] of Object.entries(legacy)){
  const rows=[canonicalWords,renderedWords,globalWords,beeWords].map(list=>list.find(item=>item.en===word));
  assert.ok(rows.every(Boolean),`${word}: missing from one vocabulary surface`);
  const icon=rows[0].emoji;
  for(const [index,row] of rows.entries()) assert.equal(row.emoji,icon,`${word}: surface ${index+1} drifted from canonical data`);
  assert.notEqual(icon,oldIcon,`${word}: ambiguous legacy emoji returned`);
  assert.match(icon,/^<span class='fd-icon(?: [a-z0-9-]+)*'/,`${word}: fd-icon wrapper missing`);
  assert.match(icon,/aria-hidden='true'/,`${word}: decorative artwork must stay hidden from answer-reading assistive output`);
  assert.doesNotMatch(icon,unsafe,`${word}: active or external markup is forbidden`);
  if(icon.includes('<svg')){
    assert.match(icon,/<svg\b[^>]*viewBox='0 0 96 96'[^>]*xmlns='http:\/\/www\.w3\.org\/2000\/svg'[^>]*>/,
      `${word}: professional 96×96 SVG root missing`);
    assert.match(icon,/<\/svg><\/span>$/,`${word}: SVG root is not closed`);
    assert.doesNotMatch(icon,/<text\b/i,`${word}: labels inside inline SVG could reveal an answer`);
    assert.ok((icon.match(/<(?:path|rect|circle|ellipse|line|polygon)\b/g)||[]).length>=6,
      `${word}: identifying details are too sparse for the approved SVG`);
  }else{
    assert.match(icon,new RegExp("<img src='icons/food-v958/[a-z]+\\.webp\\?v="+__APPV__+"' alt='' decoding='async' draggable='false'></"+"span>$"),
      `${word}: local optimized WebP contract missing`);
  }
  icons.push(icon);
}
assert.equal(new Set(icons).size,10,'every improved food word must have a distinct illustration');

for(const sourceName of ['template.html','island_food.html']){
  const source=fs.readFileSync(sourceName,'utf8');
  assert.match(source,/\.fd-icon svg\{width:100%;height:100%;display:block;overflow:visible\}/,
    `${sourceName}: SVG sizing contract missing`);
  assert.match(source,/\.fd-icon img\{width:100%;height:100%;display:block;object-fit:contain;/,
    `${sourceName}: PNG sizing contract missing`);
  assert.match(source,/\.exp-card \.emoji \.fd-icon\{width:46px;height:46px;vertical-align:middle\}/,
    `${sourceName}: exploration cards must render food art at 46px`);
  assert.match(source,/\.modal \.m-emoji \.fd-icon\{width:72px;height:72px;vertical-align:middle\}/,
    `${sourceName}: word details must render food art at 72px`);
}
assert.match(beeSource,/\.cnemoji \.fd-icon\{display:inline-block;width:1em;height:1em;/,
  'Spelling Bee must size app-owned food illustrations like emoji');
assert.match(beeSource,/\.cnemoji \.fd-icon svg\{display:block;width:100%;height:100%;overflow:visible\}/,
  'Spelling Bee nested SVG sizing contract missing');

for(const word of canonicalWords){
  const peers=[renderedWords,globalWords].map(list=>list.find(item=>item.en===word.en));
  assert.ok(peers.every(Boolean),`${word.en}: missing from a synchronized full food vocabulary`);
  assert.ok(peers.every(item=>item.emoji===word.emoji),`${word.en}: icon drift across canonical full-food surfaces`);
}
for(const word of beeWords){
  const canonicalWord=canonicalWords.find(item=>item.en===word.en);
  assert.ok(canonicalWord,`${word.en}: Spelling Bee has a non-canonical food word`);
  assert.equal(word.emoji,canonicalWord.emoji,`${word.en}: Spelling Bee icon drifted from canonical data`);
}
const untouched=canonicalWords.filter(word=>!targets.includes(word.en));
assert.equal(untouched.length,46,'the other 46 food words must remain outside this change');
assert.ok(untouched.every(word=>!String(word.emoji).startsWith('<')),
  'the other 46 food icons must remain their original Unicode emoji');

console.log('food word icons v957 compatibility: 10 owned illustrations + 4-surface sync + 46 untouched words ✅');
