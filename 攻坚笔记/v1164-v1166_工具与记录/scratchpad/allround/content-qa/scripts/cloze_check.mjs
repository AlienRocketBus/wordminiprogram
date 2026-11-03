import fs from 'node:fs';
const B='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/allround/content-qa/';
const rows=JSON.parse(fs.readFileSync(B+'data/master.json','utf8'));
const isl=JSON.parse(fs.readFileSync(B+'data/island_entries.json','utf8'));
const meta=JSON.parse(fs.readFileSync(B+'data/islands_meta.json','utf8'));
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const noForm=[], capIssue=[], multi=[];
for(const r of rows){
  const re=new RegExp('\\b'+esc(r.en)+'\\b','i');
  const m=r.ex.match(re);
  if(!m){ noForm.push(r); continue; }
  const reG=new RegExp('\\b'+esc(r.en)+'\\b','ig');
  const all=[...r.ex.matchAll(reG)];
  if(all.length>1) multi.push({id:r.id,island:r.island,en:r.en,ex:r.ex,n:all.length});
  const idx=m.index; const matched=m[0];
  const before=r.ex.slice(0,idx);
  const sentStart = idx===0 || /[.!?]\s+$/.test(before);
  // the app capitalises only when idx===0; otherwise displays r.en as-is
  const shown = idx===0 ? (r.en.charAt(0).toUpperCase()+r.en.slice(1)) : r.en;
  if(shown!==matched) capIssue.push({id:r.id,island:r.island,en:r.en,ex:r.ex,matched,shown,sentStart});
}
console.log('entries whose example lacks the exact headword form:',noForm.length);
for(const r of noForm) console.log('  NOFORM',r.id,r.island,r.line,r.en,'|',r.ex);
console.log('case mismatch between blank answer and original text:',capIssue.length);
for(const c of capIssue) console.log('  CASE',JSON.stringify(c));
console.log('multiple occurrences (only first blanked):',multi.length);
for(const c of multi) console.log('  MULTI',JSON.stringify(c));
// CLOZE_LEVELS / LISTEN_LEVELS consistency
for(const [f,m] of Object.entries(meta)){
  const words=new Set(isl.filter(e=>e.src===f).map(e=>e.en));
  const byEn=Object.fromEntries(isl.filter(e=>e.src===f).map(e=>[e.en,e]));
  for(const [lvName,L] of [['LISTEN',m.LISTEN],['CLOZE',m.CLOZE]]){
    if(!L) { console.log(f,lvName,'missing'); continue; }
    for(const [k,v] of Object.entries(L)){
      const ws=v.words||[];
      const missing=ws.filter(w=>!words.has(w));
      if(missing.length) console.log('  LEVEL-WORD-NOT-IN-DATA',f,lvName,k,missing.join(','));
      if(lvName==='CLOZE'){
        const skip=ws.filter(w=>words.has(w)&&!new RegExp('\\b'+esc(w)+'\\b','i').test(byEn[w].ex||''));
        if(skip.length) console.log('  CLOZE-SKIPPED',f,k,'total',ws.length,'skipped',skip.length,skip.join(','));
      }
      const dup=ws.filter((w,i)=>ws.indexOf(w)!==i); if(dup.length) console.log('  DUP-IN-LEVEL',f,lvName,k,dup.join(','));
    }
    // coverage: words not in any level
    const inLv=new Set(Object.values(L).flatMap(v=>v.words||[]));
    const notCovered=[...words].filter(w=>!inLv.has(w));
    if(notCovered.length) console.log('  NOT-IN-ANY-'+lvName,f,notCovered.length+'/'+words.size, notCovered.slice(0,80).join(','));
  }
}
fs.writeFileSync(B+'out/cloze_noform.json',JSON.stringify(noForm.map(r=>({id:r.id,island:r.island,line:r.line,en:r.en,ex:r.ex})),null,1));
