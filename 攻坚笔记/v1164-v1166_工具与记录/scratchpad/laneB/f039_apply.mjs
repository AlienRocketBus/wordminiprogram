import fs from 'node:fs'; import vm from 'node:vm';
const W='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const d=JSON.parse(fs.readFileSync(W+'island_data.json','utf8'));
const c={};vm.createContext(c);vm.runInContext(d.season.DATA.replace('const DATA=','DATA='),c);
const idx={};c.DATA.forEach(g=>g.words.forEach(w=>{idx[w.en]=w;}));
let src=fs.readFileSync(W+'spelling_bee.html','utf8');
const i=src.indexOf('var WORDS=['),j=src.indexOf('\n];',i);
let block=src.slice(i,j);
const words='describe realize mention admit indicate comment debate provide produce invent destroy repair establish manage handle perform examine calculate stranger customer chemical creature particle employee colleague'.split(' ');
const enc=s=>JSON.stringify(s);
let changed=0;
for(const w of words){
  const re=new RegExp('\\{"en": "'+w+'"[^\\n]*');
  const m=block.match(re); if(!m) throw new Error('no line '+w);
  const line=m[0]; const bee=JSON.parse(line.replace(/,$/,'')); const e=idx[w];
  let nl=line;
  const oEx='"ex": '+enc(bee.ex), nEx='"ex": '+enc(e.ex);
  const oCn='"exCn": '+enc(bee.exCn), nCn='"exCn": '+enc(e.exCn);
  if(!nl.includes(oEx)||!nl.includes(oCn)) throw new Error('encoding mismatch '+w);
  nl=nl.replace(oEx,nEx).replace(oCn,nCn);
  const back=JSON.parse(nl.replace(/,$/,''));
  if(back.ex!==e.ex||back.exCn!==e.exCn) throw new Error('verify '+w);
  for(const k of Object.keys(bee)) if(k!=='ex'&&k!=='exCn'&&JSON.stringify(bee[k])!==JSON.stringify(back[k])) throw new Error('other field changed '+w+' '+k);
  block=block.replace(line,nl); changed++;
}
src=src.slice(0,i)+block+src.slice(j);
fs.writeFileSync(W+'spelling_bee.html',src);
console.log('changed',changed);
