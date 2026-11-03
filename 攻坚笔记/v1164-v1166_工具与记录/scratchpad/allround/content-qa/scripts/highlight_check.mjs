import fs from 'node:fs';
const S='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/v1163_snapshot';
const B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/';
const window={};
new Function('window', fs.readFileSync(S+'/highlight_helper.js','utf8'))(window);
const rows=JSON.parse(fs.readFileSync(B+'data/master.json','utf8'));
const exset=new Set(rows.map(r=>r.en+'|'+r.exCn));
const stale=Object.keys(window.HIGHLIGHT_MANUAL).filter(k=>!exset.has(k));
console.log('HIGHLIGHT_MANUAL entries',Object.keys(window.HIGHLIGHT_MANUAL).length,'stale (no matching en|exCn in data)',stale.length);
const out=[];
for(const r of rows){
  const h=window.smartHighlight(r.cn,r.exCn,r.en);
  const m=h.match(/<span[^>]*>([^<]*)<\/span>/);
  const hl=m?m[1]:null;
  let how='none';
  if(hl){
    const key=r.en+'|'+r.exCn;
    if(window.HIGHLIGHT_MANUAL[key]===hl) how='manual';
    else if(hl===r.cn) how='exact';
    else if(r.cn.split('/').includes(hl)) how='alt';
    else how='fragment';
  }
  out.push({id:r.id,island:r.island,en:r.en,cn:r.cn,exCn:r.exCn,hl,how});
}
const c={};out.forEach(o=>c[o.how]=(c[o.how]||0)+1);console.log(c);
fs.writeFileSync(B+'out/highlight_eval.json',JSON.stringify(out,null,1));
for(const o of out) if(o.how==='none'||o.how==='fragment') console.log(o.how, o.id,o.island,o.en,'|cn:',o.cn,'|hl:',o.hl,'|',o.exCn);
console.log('STALE sample:',stale.slice(0,200).join(' ;; '));
