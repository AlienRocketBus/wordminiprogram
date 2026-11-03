import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2];
function loadData(file){const html=fs.readFileSync(path.join(ROOT,file),'utf8');const i=html.indexOf('const DATA=[');const j=html.indexOf('const allW=',i);return (new Function(html.slice(i,j).replace('const DATA=','return ')))();}
function split(lens){
  const ls=[...new Set(lens)].sort((a,b)=>a-b);let best=null;
  for(let i=0;i<ls.length;i++)for(let j=i+1;j<ls.length;j++){
    const c1=ls[i],c2=ls[j];const a=lens.filter(l=>l<=c1).length,b=lens.filter(l=>l>c1&&l<=c2).length,c=lens.length-a-b;
    if(!c)continue;const mn=Math.min(a,b,c),mx=Math.max(a,b,c);
    const sc=[mn,-mx];if(!best||sc[0]>best.sc[0]||(sc[0]===best.sc[0]&&sc[1]>best.sc[1]))best={c1,c2,a,b,c,sc};
  }
  return best;
}
for(let n=1;n<=8;n++){const W=loadData('island_land'+n+'.html').flatMap(d=>d.words);const r=split(W.map(w=>w.en.replace(/[^a-z]/gi,'').length));console.log('land'+n,`≤${r.c1}:${r.a}  ${r.c1+1}–${r.c2}:${r.b}  ≥${r.c2+1}:${r.c}`);}
