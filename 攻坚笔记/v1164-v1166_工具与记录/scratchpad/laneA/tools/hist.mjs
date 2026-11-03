import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.argv[2];
function loadData(file){const html=fs.readFileSync(path.join(ROOT,file),'utf8');const i=html.indexOf('const DATA=[');const j=html.indexOf('const allW=',i);return (new Function(html.slice(i,j).replace('const DATA=','return ')))();}
for(let n=1;n<=8;n++){const W=loadData('island_land'+n+'.html').flatMap(d=>d.words);const h={};W.forEach(w=>{h[w.en.length]=(h[w.en.length]||[]).concat(w.en)});
console.log('land'+n, Object.keys(h).sort((a,b)=>a-b).map(k=>k+':'+h[k].length).join(' '), '| special:', W.filter(w=>/[^a-z]/i.test(w.en)).map(w=>w.en).join(','));}
