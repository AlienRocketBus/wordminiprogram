// Compare the two other embedded word copies (spelling_bee.html WORDS, land_map.html words) with the island DATA.
import fs from 'node:fs';
const S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot/';
const B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/';
const isl=JSON.parse(fs.readFileSync(B+'data/island_entries.json','utf8'));
const sb=fs.readFileSync(S+'spelling_bee.html','utf8');
const i=sb.indexOf('var WORDS=['); const j=sb.indexOf('\n];',i);
const WORDS=new Function('return '+sb.slice(i+10,j+2))();
const lineOf=(src,idx)=>src.slice(0,idx).split('\n').length;
console.log('spelling_bee WORDS',WORDS.length,'starts at line',lineOf(sb,i));
const byIslEn={}; isl.forEach(e=>{byIslEn[e.island+'|'+e.en]=e;});
const byEn={}; isl.forEach(e=>{(byEn[e.en]=byEn[e.en]||[]).push(e);});
let diffs=[], miss=[];
const islCount={};
WORDS.forEach((w,k)=>{
  islCount[w.isl]=(islCount[w.isl]||0)+1;
  const e=byIslEn[w.isl+'|'+w.en] || (byEn[w.en]||[])[0];
  if(!e){miss.push(w.en+'@'+w.isl);return;}
  for(const f of ['pn','cn','ex','exCn']) if((w[f]||'')!==(e[f]||'')) diffs.push([w.en,w.isl,f,w[f],e[f]]);
  if((w.emoji||'')!==(e.emojiRaw||'')) diffs.push([w.en,w.isl,'emoji','(differs)','']);
});
console.log('islands in WORDS',JSON.stringify(islCount));
console.log('missing from island data',miss.slice(0,20),miss.length);
const tf=diffs.filter(d=>d[2]!=='emoji'); console.log('text field diffs',tf.length); tf.forEach(d=>console.log('  ',JSON.stringify(d)));
console.log('emoji diffs',diffs.filter(d=>d[2]==='emoji').length);
// words in island data but not in WORDS
const inW=new Set(WORDS.map(w=>w.en)); const notIn=[...new Set(isl.map(e=>e.en))].filter(x=>!inW.has(x)); console.log('island words not in spelling_bee WORDS',notIn.length,notIn.slice(0,20));
// land_map
const lm=fs.readFileSync(S+'land_map.html','utf8');
const re=/\{"en": "([^"]+)", "pn": "([^"]*)", "cn": "([^"]*)"\}/g; let m, n=0, ld=[];
while((m=re.exec(lm))){n++; const e=(byEn[m[1]]||[])[0]; if(!e){ld.push(['missing',m[1]]);continue;} if(e.pn!==m[2]) ld.push(['pn',m[1],m[2],e.pn]); if(e.cn!==m[3]) ld.push(['cn',m[1],m[3],e.cn]);}
console.log('land_map words',n,'diffs',ld.length, JSON.stringify(ld.slice(0,20)));
