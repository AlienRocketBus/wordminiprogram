#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const assets={
  cabbage:{file:'cabbage.webp',width:554,height:554,sha:'ce8ed6cc86804935c0a93989d6cc14d0737b28c88b686527381922141c5199af'},
  dinner:{file:'dinner.webp',width:582,height:555,sha:'07be7753dd67f34f2edcd7184b4e77e1b4182c2f61802f7e948f87edc5991222'},
  food:{file:'food.webp',width:846,height:779,sha:'9fbe6f1314c6e47b0a05fe5306b4d26f3ca830679a33f00b73dd84312baedf4e'},
  menu:{file:'menu.webp',width:486,height:819,sha:'a697bc2d7aa2ebdc8dbfeed0582fcd64b1b162155ee31bd31e32f784aca13bd3'},
  pork:{file:'pork.webp',width:702,height:438,sha:'f6a1b3e0e6f6f4359b68d899d952789baad6c5352af2e77ddfa1ab80845487c7'},
  restaurant:{file:'restaurant.webp',width:543,height:441,sha:'7d37dea9f46e2e7d2c47e8ddaff8c0cd495fdb2c5d05febd8e50e16ddd56527c'},
  snack:{file:'snack.webp',width:531,height:626,sha:'50a68fd1f9d5bcbdd430ffcefd813203e1f641a1b18bfb7bed2a9ac5a862db59'},
  sugar:{file:'sugar.webp',width:387,height:365,sha:'89b534bbd442d2793baa438422eccf02186a3f0d9183499ed2071e050e5b7c11'},
  vegetable:{file:'vegetable.webp',width:789,height:636,sha:'112bab354ec488597f8057ce1bc7069a2de6952d2c52d13a277968affa0bb654'},
  yogurt:{file:'yogurt.webp',width:1200,height:1200,sha:'818319d9efa7942b84d2149d0275e5fcb9709f2d2538ea8f2a67f47de1d10803'}
};
const words=Object.keys(assets).sort();

function pageData(source,label){
  const match=source.match(/const DATA=\[([\s\S]*?)\n\];\nconst allW=/);
  assert.ok(match,`${label}: DATA block missing`);
  return vm.runInNewContext(`[${match[1]}]`,Object.create(null));
}

const islandData=JSON.parse(fs.readFileSync('island_data.json','utf8'));
const canonical=vm.runInNewContext(islandData.food.DATA+'\nDATA',Object.create(null)).flatMap(group=>group.words);
const rendered=pageData(fs.readFileSync('island_food.html','utf8'),'island_food.html').flatMap(group=>group.words);
const vocabSource=fs.readFileSync('vocab_all.js','utf8');
const marker='window.HANSEN_VOCAB_ALL = ';
const start=vocabSource.indexOf(marker)+marker.length;
const end=vocabSource.indexOf(';\n// 同时写入',start);
const globalWords=JSON.parse(vocabSource.slice(start,end)).wordIslandFood;
const beeSource=fs.readFileSync('spelling_bee.html','utf8');
const swSource=fs.readFileSync('sw_v944.js','utf8');
const beeWords=beeSource.split('\n').filter(line=>line.includes('"isl": "food"')).map(line=>JSON.parse(line.trim().replace(/,$/,'')));

assert.equal(canonical.length,56,'canonical food vocabulary must remain 56 words');
assert.equal(rendered.length,56,'generated food vocabulary must remain 56 words');
assert.equal(globalWords.length,56,'global food vocabulary must remain 56 words');
assert.equal(beeWords.length,53,'Spelling Bee keeps its historical 53-word food scope');

for(const word of words){
  const spec=assets[word];
  const asset=`icons/food-v958/${spec.file}`;
  const bytes=fs.readFileSync(asset);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',`${word}: invalid RIFF signature`);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',`${word}: invalid WebP signature`);
  assert.equal(bytes.toString('ascii',12,16),'VP8X',`${word}: extended WebP header missing`);
  assert.ok((bytes[20]&0x10)!==0,`${word}: transparent alpha channel missing`);
  const width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);
  const height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);
  assert.equal(width,spec.width,`${word}: source width changed`);
  assert.equal(height,spec.height,`${word}: source height changed`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),spec.sha,`${word}: optimized WebP bytes changed`);

  const rows=[canonical,rendered,globalWords,beeWords].map(list=>list.find(item=>item.en===word));
  assert.ok(rows.every(Boolean),`${word}: missing from a required vocabulary surface`);
  const expected=`<span class='fd-icon fd-photo fd-photo-${word}' aria-hidden='true'><img src='${asset}?v=960' alt='' decoding='async' draggable='false'></span>`;
  rows.forEach((row,index)=>assert.equal(row.emoji,expected,`${word}: surface ${index+1} does not use the named user icon`));
  assert.doesNotMatch(expected,/\son[a-z]+\s*=|javascript:|https?:|data:/i,`${word}: active or external image markup is forbidden`);
}

assert.ok(!canonical.some(item=>String(item.emoji).includes('/pig.png')),'pig filename must map explicitly to the pork word');
const markupWords=canonical.filter(item=>String(item.emoji).startsWith('<')).map(item=>item.en).sort();
assert.deepEqual(Array.from(markupWords),words,'only the ten requested food words may use user PNG markup');
const untouched=canonical.filter(item=>!words.includes(item.en));
assert.equal(untouched.length,46,'the other 46 food words must remain untouched');
assert.ok(untouched.every(item=>!String(item.emoji).startsWith('<')),'an unrelated food icon was replaced');

for(const page of ['template.html','island_food.html']){
  const source=fs.readFileSync(page,'utf8');
  assert.match(source,/\.fd-icon img\{width:100%;height:100%;display:block;object-fit:contain;object-position:center;/,
    `${page}: PNG sizing contract missing`);
  assert.match(source,/\.fd-photo img\{filter:drop-shadow\(0 1px 1px rgba\(15,23,42,\.38\)\)\}/,
    `${page}: light-background edge contrast contract missing`);
  assert.match(source,/\.exp-card \.emoji \.fd-icon\{width:46px;height:46px;/,`${page}: 46px card contract missing`);
  assert.match(source,/\.modal \.m-emoji \.fd-icon\{width:72px;height:72px;/,`${page}: 72px modal contract missing`);
}
assert.match(beeSource,/\.cnemoji \.fd-icon img\{width:100%;height:100%;display:block;object-fit:contain;/,
  'Spelling Bee PNG sizing contract missing');
assert.match(beeSource,/\.cnemoji \.fd-photo-sugar\{--fd-photo-scale:1\.30\}/,'small sugar artwork must be optically normalized');
assert.match(beeSource,/\.cnemoji \.fd-photo-yogurt\{--fd-photo-scale:1\.18\}/,'small yogurt artwork must be optically normalized');
assert.match(swSource,/const ICON_CACHE = CACHE_PREFIX \+ 'icons-3'/,
  'v960 must rotate the icon cache after replacing user PNGs with WebP');
assert.ok(swSource.includes("/\\/icons\\/(?:[^/]+\\/)*[^/]+\\.(?:webp|png|svg)$/i"),
  'service worker must cache icons stored in controlled subdirectories');
assert.match(beeSource,/icons\/food-v958\//,'Spelling Bee must reference the user icon directory');
assert.match(beeSource,/dataset\.imgFallback='1'/,'Spelling Bee must stop retrying a permanently broken user icon');
assert.match(beeSource,/f\.textContent='\?'/,'Spelling Bee must show a neutral final image fallback');
assert.doesNotMatch(beeSource,/food-v958[^\n>]*onerror=/i,'word data must not contain per-answer image handlers');

console.log('food word icons v960: 10 optimized transparent WebPs + filename mapping + 4-surface sync + mobile sizing ✅');
