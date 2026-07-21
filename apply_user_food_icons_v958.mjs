#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const mapping={
  vegetable:'vegetable.webp',
  cabbage:'cabbage.webp',
  food:'food.webp',
  pork:'pork.webp',
  yogurt:'yogurt.webp',
  sugar:'sugar.webp',
  dinner:'dinner.webp',
  snack:'snack.webp',
  restaurant:'restaurant.webp',
  menu:'menu.webp'
};
const words=Object.keys(mapping);
const assetDir='icons/food-v958';

function iconMarkup(word){
  return `<span class='fd-icon fd-photo fd-photo-${word}' aria-hidden='true'><img src='${assetDir}/${mapping[word]}?v=960' alt='' decoding='async' draggable='false'></span>`;
}

for(const word of words){
  const asset=`${assetDir}/${mapping[word]}`;
  assert.ok(fs.statSync(asset).isFile(),`${word}: user icon is missing`);
  const bytes=fs.readFileSync(asset);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',`${word}: asset is not RIFF`);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',`${word}: asset is not WebP`);
}

const islandPath='island_data.json';
const islandData=JSON.parse(fs.readFileSync(islandPath,'utf8'));
const canonical=vm.runInNewContext(islandData.food.DATA+'\nDATA',Object.create(null));
const canonicalWords=canonical.flatMap(group=>group.words);
assert.equal(canonicalWords.length,56,'food island word count changed');
let foodSource=islandData.food.DATA;
for(const word of words){
  const rows=foodSource.split('\n');
  const indexes=[];
  rows.forEach((line,index)=>{if(line.startsWith(`{en:"${word}",`))indexes.push(index);});
  assert.equal(indexes.length,1,`${word}: canonical row must be unique`);
  rows[indexes[0]]=rows[indexes[0]].replace(/emoji:"[^"]*"/,`emoji:"${iconMarkup(word)}"`);
  foodSource=rows.join('\n');
}
islandData.food.DATA=foodSource;
fs.writeFileSync(islandPath,JSON.stringify(islandData)+'\n','utf8');

const vocabPath='vocab_all.js';
const vocabSource=fs.readFileSync(vocabPath,'utf8');
const marker='window.HANSEN_VOCAB_ALL = ';
const start=vocabSource.indexOf(marker)+marker.length;
const end=vocabSource.indexOf(';\n// 同时写入',start);
assert.ok(start>=marker.length&&end>start,'global vocabulary payload missing');
const vocab=JSON.parse(vocabSource.slice(start,end));
assert.equal(vocab.wordIslandFood.length,56,'global food vocabulary size changed');
for(const word of words){
  const entry=vocab.wordIslandFood.find(item=>item.en===word);
  assert.ok(entry,`${word}: global vocabulary entry missing`);
  entry.emoji=iconMarkup(word);
}
fs.writeFileSync(vocabPath,vocabSource.slice(0,start)+JSON.stringify(vocab)+vocabSource.slice(end),'utf8');

const beePath='spelling_bee.html';
let bee=fs.readFileSync(beePath,'utf8');
for(const word of words){
  const rows=bee.split('\n');
  const indexes=[];
  rows.forEach((line,index)=>{
    if(line.includes(`"en": "${word}"`)&&line.includes('"isl": "food"'))indexes.push(index);
  });
  assert.equal(indexes.length,1,`${word}: Spelling Bee row must be unique`);
  rows[indexes[0]]=rows[indexes[0]].replace(/"emoji": "[^"]*"/,`"emoji": "${iconMarkup(word)}"`);
  bee=rows.join('\n');
}

const photoCss=`
.fd-icon img{width:100%;height:100%;display:block;object-fit:contain;object-position:center;transform:scale(var(--fd-photo-scale,1));transform-origin:center;pointer-events:none}
.fd-photo img{filter:drop-shadow(0 1px 1px rgba(15,23,42,.38))}
.fd-photo-cabbage{--fd-photo-scale:1.08}
.fd-photo-sugar{--fd-photo-scale:1.30}
.fd-photo-yogurt{--fd-photo-scale:1.18}`;

const templatePath='template.html';
let template=fs.readFileSync(templatePath,'utf8');
assert.ok(!template.includes('.fd-icon img{'),'photo sizing CSS already exists in template');
template=template.replace(
  '.fd-icon svg{width:100%;height:100%;display:block;overflow:visible}',
  '.fd-icon svg{width:100%;height:100%;display:block;overflow:visible}'+photoCss
);
fs.writeFileSync(templatePath,template,'utf8');

assert.ok(!bee.includes('.cnemoji .fd-icon img{'),'photo sizing CSS already exists in Spelling Bee');
bee=bee.replace(
  '.cnemoji .fd-icon svg{display:block;width:100%;height:100%;overflow:visible}',
  '.cnemoji .fd-icon svg{display:block;width:100%;height:100%;overflow:visible}\n.cnemoji .fd-icon img{width:100%;height:100%;display:block;object-fit:contain;object-position:center;transform:scale(var(--fd-photo-scale,1));transform-origin:center;pointer-events:none}\n.cnemoji .fd-photo img{filter:drop-shadow(0 1px 1px rgba(15,23,42,.38))}\n.cnemoji .fd-photo-cabbage{--fd-photo-scale:1.08}\n.cnemoji .fd-photo-sugar{--fd-photo-scale:1.30}\n.cnemoji .fd-photo-yogurt{--fd-photo-scale:1.18}'
);
fs.writeFileSync(beePath,bee,'utf8');

console.log('Applied 10 bandwidth-optimized user WebP icons to canonical food data, global vocabulary and Spelling Bee');
