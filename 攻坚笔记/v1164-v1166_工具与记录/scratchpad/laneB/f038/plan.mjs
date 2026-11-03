import fs from 'node:fs'; import vm from 'node:vm';
const W='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const APPLY=process.argv.includes('--apply');
const isl=JSON.parse(fs.readFileSync(W+'island_data.json','utf8'));
const src={}; // island short key -> en -> word
for(const k of Object.keys(isl)){ const c={};vm.createContext(c);vm.runInContext(isl[k].DATA.replace('const DATA=','DATA='),c); src[k]={}; c.DATA.forEach(g=>g.words.forEach(w=>{src[k][w.en]=w;})); }
const saveKey={}; for(const k of Object.keys(isl)) saveKey[isl[k].key]=k;
// corrections: [island, en, field, old]
const C=[
 ['time','August','pn','/ɔːˈɡʌst/'],
 ['food','cabbage','cn','白菜'],['food','cabbage','exCn',null],
 ['animal','sheep','cn','羊'],['clothes','skirt','cn','短裙'],
 ['home','table','exCn','我们摆桌子吃晚饭吧。'],
 ['season','meanwhile','exCn',null],
 ['adjective','old','exCn','我爷爷年纪很老了。'],
 ['time','March','exCn','春天三月开始。'],
 ['job','scientist','emoji','👨‍🔬'],['job','singer','emoji','👨‍🎤'],['season','tradition','emoji','🎎'],
];
for(const w of 'available develop destroy struggle maximum minimum instead consequently generally fortunately public chemical business employee'.split(' ')) C.push(['season',w,'cn',';']);
const plan=[];
function want(i,en,f){ const w=src[i][en]; if(!w) throw new Error('no source '+i+' '+en); return w[f]; }
// vocab_all.js
let va=fs.readFileSync(W+'vocab_all.js','utf8');
const vaLine=va.split('\n').find(l=>l.startsWith('window.HANSEN_VOCAB_ALL = '));
const VA=JSON.parse(vaLine.slice('window.HANSEN_VOCAB_ALL = '.length).replace(/;\s*$/,''));
let vaChanged=0;
for(const [i,en,f,old] of C){
  const nv=want(i,en,f);
  for(const sk of Object.keys(VA)){ const si=saveKey[sk]||sk; if(si!==i && !(i==='season'&&/^wordIslandLand\d|wordIslandSeason/.test(sk))) continue;
    for(const w of VA[sk]){ if(w.en!==en) continue; const cur=w[f];
      if(cur===nv) continue;
      const isOld = old===null ? true : (old===';' ? (String(cur).replace(/;/g,'/')===nv) : cur===old);
      plan.push(['vocab_all.js',sk,en,f,cur,nv,isOld?'APPLY':'SKIP(unexpected)']);
      if(isOld&&APPLY){ w[f]=nv; vaChanged++; }
    }}
}
if(APPLY&&vaChanged){ const nl='window.HANSEN_VOCAB_ALL = '+JSON.stringify(VA)+(vaLine.trim().endsWith(';')?';':''); va=va.replace(vaLine,nl); fs.writeFileSync(W+'vocab_all.js',va); }
// spelling_bee.html WORDS
let sb=fs.readFileSync(W+'spelling_bee.html','utf8');
const si0=sb.indexOf('var WORDS=['), sj0=sb.indexOf('\n];',si0); let block=sb.slice(si0,sj0);
let sbChanged=0;
for(const [i,en,f,old] of C){
  const nv=want(i,en,f);
  const lines=block.split('\n').filter(l=>l.startsWith('{"en": '+JSON.stringify(en)+','));
  for(const line of lines){ const w=JSON.parse(line.replace(/,$/,'')); 
    const wIsl=w.isl||''; const match = (i==='season') ? /^(land[1-8]|season)$/.test(wIsl) : (wIsl===i);
    if(!match) continue; const cur=w[f]; if(cur===nv) continue;
    const isOld = old===null ? true : (old===';' ? (String(cur).replace(/;/g,'/')===nv) : cur===old);
    plan.push(['spelling_bee.html',wIsl,en,f,cur,nv,isOld?'APPLY':'SKIP(unexpected)']);
    if(isOld&&APPLY){ const o='"'+f+'": '+JSON.stringify(cur), n='"'+f+'": '+JSON.stringify(nv); if(!line.includes(o)) throw new Error('enc '+en+f); const nl=line.replace(o,n); block=block.replace(line,nl); sbChanged++; }
  }
}
if(APPLY&&sbChanged){ sb=sb.slice(0,si0)+block+sb.slice(sj0); fs.writeFileSync(W+'spelling_bee.html',sb); }
// land_map.html MAP_GROUPS (en/pn/cn only)
let lm=fs.readFileSync(W+'land_map.html','utf8');
const mm=lm.match(/window\.MAP_GROUPS=(\[[\s\S]*?\]);/); const MG=JSON.parse(mm[1]); let lmChanged=0;
for(const [i,en,f,old] of C){ if(i!=='season'||!['pn','cn'].includes(f)) continue; const nv=want(i,en,f);
  for(const g of MG) for(const w of g.words){ if(w.en!==en) continue; const cur=w[f]; if(cur===nv) continue;
    const isOld = old===null ? true : (old===';' ? (String(cur).replace(/;/g,'/')===nv) : cur===old);
    plan.push(['land_map.html','land'+g.id,en,f,cur,nv,isOld?'APPLY':'SKIP(unexpected)']);
    if(isOld&&APPLY){ w[f]=nv; lmChanged++; } } }
if(APPLY&&lmChanged){ const newJson=JSON.stringify(MG).replace(/":/g,'": ').replace(/,"/g,', "'); lm=lm.replace(mm[1], newJson); fs.writeFileSync(W+'land_map.html',lm); }
for(const p of plan) console.log(p.join(' | '));
console.log('plan',plan.length,'applied',APPLY?{vaChanged,sbChanged,lmChanged}:'(dry)');
