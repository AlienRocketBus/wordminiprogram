import fs from 'node:fs'; import vm from 'node:vm';
const W='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const d=JSON.parse(fs.readFileSync(W+'island_data.json','utf8'));
const c={};vm.createContext(c);vm.runInContext(d.season.DATA.replace('const DATA=','DATA='),c);
const idx={};c.DATA.forEach(g=>g.words.forEach(w=>{idx[w.en]=w;}));
const src=fs.readFileSync(W+'spelling_bee.html','utf8');
const i=src.indexOf('var WORDS=['),j=src.indexOf('\n];',i);
const block=src.slice(i,j);
const words='describe realize mention admit indicate comment debate provide produce invent destroy repair establish manage handle perform examine calculate stranger customer chemical creature particle employee colleague'.split(' ');
let n=0;
for(const w of words){
  const m=block.match(new RegExp('\\{"en": "'+w+'"[^\\n]*'));
  const bee=m?JSON.parse(m[0].replace(/,$/,'')):null; const e=idx[w];
  if(!bee||!e){console.log('MISSING',w,!!bee,!!e);continue;}
  const same=bee.ex===e.ex&&bee.exCn===e.exCn; if(!same)n++;
  console.log(w,same?'SAME':'DIFF','|',bee.isl,'|',bee.ex,'=>',e.ex);
}
console.log('diff',n);
