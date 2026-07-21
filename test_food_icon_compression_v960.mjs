#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';

const originalTotal=3608986;
const assets={
  cabbage:{width:554,height:554,bytes:34308,sha:'ce8ed6cc86804935c0a93989d6cc14d0737b28c88b686527381922141c5199af'},
  dinner:{width:582,height:555,bytes:36968,sha:'07be7753dd67f34f2edcd7184b4e77e1b4182c2f61802f7e948f87edc5991222'},
  food:{width:846,height:779,bytes:45164,sha:'9fbe6f1314c6e47b0a05fe5306b4d26f3ca830679a33f00b73dd84312baedf4e'},
  menu:{width:486,height:819,bytes:51024,sha:'a697bc2d7aa2ebdc8dbfeed0582fcd64b1b162155ee31bd31e32f784aca13bd3'},
  pork:{width:702,height:438,bytes:54366,sha:'f6a1b3e0e6f6f4359b68d899d952789baad6c5352af2e77ddfa1ab80845487c7'},
  restaurant:{width:543,height:441,bytes:37442,sha:'7d37dea9f46e2e7d2c47e8ddaff8c0cd495fdb2c5d05febd8e50e16ddd56527c'},
  snack:{width:531,height:626,bytes:50478,sha:'50a68fd1f9d5bcbdd430ffcefd813203e1f641a1b18bfb7bed2a9ac5a862db59'},
  sugar:{width:387,height:365,bytes:12256,sha:'89b534bbd442d2793baa438422eccf02186a3f0d9183499ed2071e050e5b7c11'},
  vegetable:{width:789,height:636,bytes:70018,sha:'112bab354ec488597f8057ce1bc7069a2de6952d2c52d13a277968affa0bb654'},
  yogurt:{width:1200,height:1200,bytes:47838,sha:'818319d9efa7942b84d2149d0275e5fcb9709f2d2538ea8f2a67f47de1d10803'}
};
const words=Object.keys(assets).sort();

function u24le(bytes,offset){return bytes[offset]+(bytes[offset+1]<<8)+(bytes[offset+2]<<16);}
function pageData(source,label){
  const match=source.match(/const DATA=\[([\s\S]*?)\n\];\nconst allW=/);
  assert.ok(match,`${label}: DATA block missing`);
  return vm.runInNewContext(`[${match[1]}]`,Object.create(null)).flatMap(group=>group.words);
}

const dir='icons/food-v958';
const files=fs.readdirSync(dir).sort();
assert.deepEqual(files,words.map(word=>`${word}.webp`),'optimized directory must contain exactly ten WebPs and no legacy PNG');

let total=0;
for(const word of words){
  const spec=assets[word],file=`${dir}/${word}.webp`,bytes=fs.readFileSync(file);
  total+=bytes.length;
  assert.equal(bytes.length,spec.bytes,`${word}: encoded byte count changed`);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',`${word}: RIFF signature missing`);
  assert.equal(bytes.toString('ascii',8,12),'WEBP',`${word}: WebP signature missing`);
  assert.equal(bytes.toString('ascii',12,16),'VP8X',`${word}: VP8X canvas header missing`);
  assert.ok((bytes[20]&0x10)!==0,`${word}: alpha flag missing`);
  assert.equal(u24le(bytes,24)+1,spec.width,`${word}: original width was not preserved`);
  assert.equal(u24le(bytes,27)+1,spec.height,`${word}: original height was not preserved`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),spec.sha,`${word}: deterministic optimized bytes changed`);
}
assert.equal(total,439862,'optimized icon total changed unexpectedly');
assert.ok(total/originalTotal<0.123,`compression target missed: ${total}/${originalTotal}`);
assert.ok((1-total/originalTotal)>0.87,'the ten icons must save more than 87% of their original transfer bytes');

const islandData=JSON.parse(fs.readFileSync('island_data.json','utf8'));
const canonical=vm.runInNewContext(islandData.food.DATA+'\nDATA',Object.create(null)).flatMap(group=>group.words);
const rendered=pageData(fs.readFileSync('island_food.html','utf8'),'island_food.html');
const vocabSource=fs.readFileSync('vocab_all.js','utf8');
const marker='window.HANSEN_VOCAB_ALL = ';
const start=vocabSource.indexOf(marker)+marker.length;
const end=vocabSource.indexOf(';\n// 同时写入',start);
const globalWords=JSON.parse(vocabSource.slice(start,end)).wordIslandFood;
const beeSource=fs.readFileSync('spelling_bee.html','utf8');
const beeWords=beeSource.split('\n').filter(line=>line.includes('"isl": "food"')).map(line=>JSON.parse(line.trim().replace(/,$/,'')));

assert.equal(canonical.length,56);
assert.equal(rendered.length,56);
assert.equal(globalWords.length,56);
assert.equal(beeWords.length,53);
for(const word of words){
  /* 🔴v963 合同微调: 资源戳随候选版本演进(?v=<当前VERSION>)，10图字节/哈希/宽高/映射/四入口合同不变。 */
  const appStamp=fs.readFileSync(new URL('./VERSION',import.meta.url),'utf8').trim();
  const expected=`<span class='fd-icon fd-photo fd-photo-${word}' aria-hidden='true'><img src='${dir}/${word}.webp?v=${appStamp}' alt='' decoding='async' draggable='false'></span>`;
  for(const [index,list] of [canonical,rendered,globalWords,beeWords].entries()){
    const row=list.find(item=>item.en===word);
    assert.ok(row,`${word}: missing from surface ${index+1}`);
    assert.equal(row.emoji,expected,`${word}: surface ${index+1} uses the wrong optimized asset`);
  }
}
assert.ok(!canonical.some(item=>String(item.emoji).includes('/pig.')),'pig source filename must still map to the pork word');
assert.equal(canonical.filter(item=>String(item.emoji).startsWith('<')).length,10,'only the ten approved words may use user images');

for(const source of [islandData.food.DATA,fs.readFileSync('island_food.html','utf8'),vocabSource,beeSource]){
  assert.doesNotMatch(source,/icons\/food-v958\/[a-z]+\.png/i,'legacy heavy PNG reference survived');
  assert.doesNotMatch(source,/icons\/food-v958\/[a-z]+\.webp\?v=959/i,'stale v959 icon cache key survived');
}
const sw=fs.readFileSync('sw_v944.js','utf8');
assert.match(sw,/const ICON_CACHE = CACHE_PREFIX \+ 'icons-3'/,'v960 must isolate optimized WebP icons from icons-2');
assert.ok(sw.includes('/\\/icons\\/(?:[^/]+\\/)*[^/]+\\.(?:webp|png|svg)$/i'),'controlled icon subdirectories must stay offline-capable');

console.log(`food icon compression v960: ${originalTotal} → ${total} bytes (${((1-total/originalTotal)*100).toFixed(2)}% saved), dimensions + alpha + 4 surfaces locked ✅`);
