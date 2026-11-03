// 精确替换：只改计划里那几个对象里的那几个字段，其余字节一个不动
import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
const W='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const out=execFileSync('node',['/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneB/f038/plan.mjs'],{encoding:'utf8'});
const rows=out.split('\n').filter(l=>/\| APPLY$/.test(l)).map(l=>l.split(' | '));
const files={}; const get=f=>files[f]??=fs.readFileSync(W+f,'utf8');
function objRange(text, anchor, objStartPat){
  const a=text.indexOf(anchor); if(a<0) throw new Error('anchor '+anchor);
  const s=text.indexOf(objStartPat,a); if(s<0) throw new Error('obj '+objStartPat);
  let d=0,inStr=false,esc=false;
  for(let k=s;k<text.length;k++){const ch=text[k];
    if(inStr){ if(esc)esc=false; else if(ch==='\\')esc=true; else if(ch==='"')inStr=false; continue; }
    if(ch==='"')inStr=true; else if(ch==='{')d++; else if(ch==='}'){d--; if(!d) return [s,k+1];}
  } throw new Error('unterminated');
}
let n=0;
for(const [file,where,en,field,cur,nv] of rows){
  let t=get(file), anchor, objPat, sep;
  if(file==='vocab_all.js'){ anchor='"'+where+'":['; objPat='{"en":'+JSON.stringify(en)+','; sep=':'; }
  else if(file==='spelling_bee.html'){ anchor='var WORDS=['; objPat=null; sep=': '; }
  else { anchor='window.MAP_GROUPS='; objPat=null; sep=': '; }
  let r;
  if(file==='spelling_bee.html'){
    // 拼写蜂：一行一个词，按 en + isl 找那一行
    const lines=t.split('\n'); let idx=-1;
    for(let k=0;k<lines.length;k++){ const L=lines[k]; if(L.startsWith('{"en": '+JSON.stringify(en)+',') && L.includes('"isl": '+JSON.stringify(where))){ idx=k; break; } }
    if(idx<0) throw new Error('bee line '+en+' '+where);
    const o='"'+field+'"'+sep+JSON.stringify(cur), nn='"'+field+'"'+sep+JSON.stringify(nv);
    if(lines[idx].split(o).length!==2) throw new Error('bee field not unique '+en+field);
    lines[idx]=lines[idx].replace(o,nn); files[file]=lines.join('\n'); n++; continue;
  }
  if(file==='land_map.html'){
    const s0=t.indexOf(anchor); const s1=t.indexOf('\n',s0); const seg=t.slice(s0,s1);
    const o='"'+field+'"'+sep+JSON.stringify(cur), nn='"'+field+'"'+sep+JSON.stringify(nv);
    // 在这个词的对象里替换
    const wi=seg.indexOf('{"en": '+JSON.stringify(en)+','); if(wi<0) throw new Error('map word '+en);
    const we=seg.indexOf('}',wi); const obj=seg.slice(wi,we+1);
    if(obj.split(o).length!==2) throw new Error('map field '+en);
    const seg2=seg.slice(0,wi)+obj.replace(o,nn)+seg.slice(we+1);
    files[file]=t.slice(0,s0)+seg2+t.slice(s1); n++; continue;
  }
  r=objRange(t,anchor,objPat);
  const obj=t.slice(r[0],r[1]);
  const o='"'+field+'"'+sep+JSON.stringify(cur), nn='"'+field+'"'+sep+JSON.stringify(nv);
  if(obj.split(o).length!==2) throw new Error('vocab field not unique '+where+' '+en+' '+field);
  files[file]=t.slice(0,r[0])+obj.replace(o,nn)+t.slice(r[1]); n++;
}
for(const f of Object.keys(files)) fs.writeFileSync(W+f,files[f]);
console.log('replaced',n,'in',Object.keys(files).join(', '));
