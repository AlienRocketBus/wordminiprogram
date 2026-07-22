#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
/* v963 dyn */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const target={
  vegetable:'🥬',cabbage:'🥦',food:'🍽️',pork:'🐖',yogurt:'🥣',
  sugar:'🍯',dinner:'🍝',snack:'🍿',restaurant:'🏪',menu:'🗒️'
};
const targetWords=Object.keys(target).sort();
const unsafe=/<\/?(?:script|style|foreignObject|iframe|object|embed|a)\b|\son[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=/i;

function dataFromSource(source,label){
  const match=source.match(/const DATA=\[([\s\S]*?)\n\];\nconst allW=/);
  assert.ok(match,`${label}: DATA block missing`);
  return vm.runInNewContext(`[${match[1]}]`,Object.create(null));
}

const islandData=JSON.parse(fs.readFileSync('island_data.json','utf8'));
const canonical=vm.runInNewContext(islandData.food.DATA+'\nDATA',Object.create(null));
const canonicalWords=canonical.flatMap(group=>group.words);
assert.equal(canonicalWords.length,56,'food island must keep exactly 56 words');

const html=fs.readFileSync('island_food.html','utf8');
const renderedWords=dataFromSource(html,'island_food.html').flatMap(group=>group.words);
assert.equal(renderedWords.length,56,'generated food page must keep exactly 56 words');

const vocabSource=fs.readFileSync('vocab_all.js','utf8');
const marker='window.HANSEN_VOCAB_ALL = ';
const start=vocabSource.indexOf(marker)+marker.length;
const end=vocabSource.indexOf(';\n// 同时写入',start);
assert.ok(start>=marker.length && end>start,'global vocabulary payload missing');
const globalWords=JSON.parse(vocabSource.slice(start,end)).wordIslandFood;
assert.equal(globalWords.length,56,'global food vocabulary must keep exactly 56 words');

const canonicalMarkupWords=canonicalWords.filter(word=>String(word.emoji).startsWith('<')).map(word=>word.en).sort();
assert.equal(Array.from(canonicalMarkupWords).join('\n'),targetWords.join('\n'),
  'only the ten approved food words may use app-owned illustrations');

const icons=[];
for(const [word,oldIcon] of Object.entries(target)){
  const canonicalWord=canonicalWords.find(item=>item.en===word);
  const renderedWord=renderedWords.find(item=>item.en===word);
  const globalWord=globalWords.find(item=>item.en===word);
  assert.ok(canonicalWord && renderedWord && globalWord,`${word}: missing from one vocabulary surface`);
  const icon=canonicalWord.emoji;
  assert.equal(renderedWord.emoji,icon,`${word}: generated page drifted from island_data.json`);
  assert.equal(globalWord.emoji,icon,`${word}: global review vocabulary drifted from canonical data`);
  assert.notEqual(icon,oldIcon,`${word}: ambiguous legacy emoji returned`);
  assert.match(icon,/^<span class='fd-icon(?: [a-z0-9-]+)*'(?: aria-hidden='true')?>/,
    `${word}: canonical food illustration wrapper missing`);
  assert.doesNotMatch(icon,unsafe,`${word}: active or external markup is forbidden`);
  if(icon.includes('<svg')){
    assert.match(icon,/<svg\b[^>]*viewBox='0 0 (?:64|96) (?:64|96)'[^>]*xmlns='http:\/\/www\.w3\.org\/2000\/svg'[^>]*>/,
      `${word}: canonical food SVG root missing`);
    assert.match(icon,/<\/svg><\/span>$/,`${word}: SVG root is not closed`);
    assert.doesNotMatch(icon,/<text\b/i,`${word}: visible labels are forbidden in inline SVG`);
    assert.ok((icon.match(/<(?:path|rect|circle|ellipse|line)\b/g)||[]).length>=5,
      `${word}: SVG is too sparse to preserve its identifying features at mobile size`);
  }else{
    assert.match(icon,new RegExp("<img src='icons/food-v958/[a-z]+\\.webp\\?v="+__APPV__+"' alt='' decoding='async' draggable='false'></"+"span>$"),
      `${word}: local optimized WebP contract missing`);
  }
  icons.push(icon);
}
assert.equal(new Set(icons).size,10,'every improved food word must have a distinct illustration');

for(const [word,oldIcon] of Object.entries(target)){
  const item=canonicalWords.find(candidate=>candidate.en===word);
  assert.ok(!item.emoji.includes(oldIcon),`${word}: old glyph leaked into the new illustration`);
}

for(const sourceName of ['template.html','island_food.html']){
  const source=fs.readFileSync(sourceName,'utf8');
  assert.match(source,/\.fd-icon svg\{width:100%;height:100%;display:block;overflow:visible\}/,
    `${sourceName}: food SVG sizing contract missing`);
  assert.match(source,/\.fd-icon img\{width:100%;height:100%;display:block;object-fit:contain;/,
    `${sourceName}: food PNG sizing contract missing`);
  assert.match(source,/\.exp-card \.emoji \.fd-icon\{width:46px;height:46px;vertical-align:middle\}/,
    `${sourceName}: exploration cards must render food art at 46px`);
  assert.match(source,/\.modal \.m-emoji \.fd-icon\{width:72px;height:72px;vertical-align:middle\}/,
    `${sourceName}: word details must render food art at 72px`);
}

const untouched=canonicalWords.filter(word=>!targetWords.includes(word.en));
assert.equal(untouched.length,46,'the other 46 food words must remain outside this change');
assert.ok(untouched.every(word=>!String(word.emoji).startsWith('<')),
  'the other 46 food icons must remain their original Unicode emoji');

console.log('food word icons v956 compatibility: 10 owned illustrations + 3-surface sync + 46 untouched words ✅');
