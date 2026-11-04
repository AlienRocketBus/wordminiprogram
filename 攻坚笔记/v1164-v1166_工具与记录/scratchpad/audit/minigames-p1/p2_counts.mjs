import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';
const ISL = ['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school'];
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await newCtx(browser, port, {init: ()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const out = {};
for(const k of ISL){
  const page = await ctx.newPage();
  const ev=[]; attach(page, ev, ()=>k);
  await page.goto(`http://127.0.0.1:${port}/island_${k}.html`, {waitUntil:'load'});
  await sleep(800);
  const url = page.url();
  const r = await page.evaluate(()=>{
    const res = {n: allW.length, url: location.href};
    const lv = (name, obj)=>{ const o={}; for(const key of Object.keys(obj)){ try{ o[key]=[...Array(allW.length).keys()].filter(obj[key].filter).length; }catch(e){ o[key]='ERR '+e.message; } } res[name]=o; };
    try{ lv('moles', MOLES_LEVELS);}catch(e){res.moles='x'}
    try{ lv('fish', FISH_LEVELS);}catch(e){res.fish='x'}
    try{ lv('bubble', BUBBLE_LEVELS);}catch(e){res.bubble='x'}
    try{ lv('scramble', SCRAMBLE_LEVELS);}catch(e){res.scramble='x'}
    try{ lv('eagle', EAGLE_LEVELS);}catch(e){res.eagle='x'}
    try{ lv('typing', TYPING_LEVELS);}catch(e){res.typing='x'}
    try{ const o={}; for(const key in LISTEN_LEVEL_IDX) o[key]=LISTEN_LEVEL_IDX[key].length; res.listen=o; }catch(e){res.listen='x'}
    try{ const o={}; for(const key in CLOZE_LEVEL_IDX) o[key]=CLOZE_LEVEL_IDX[key].length; res.cloze=o; }catch(e){res.cloze='x'}
    // cloze: how many have ex containing the word
    try{ const bad=[]; allW.forEach((w,i)=>{ const re=new RegExp('\\b'+w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i'); if(!w.ex||!re.test(w.ex)) bad.push(w.en+' | '+w.ex); }); res.clozeNoBlank=bad; }catch(e){}
    // duplicate cn
    try{ const m={}; allW.forEach(w=>{m[w.cn]=(m[w.cn]||[]).concat(w.en)}); res.dupCn=Object.entries(m).filter(([c,a])=>a.length>1).map(([c,a])=>c+':'+a.join('/')); }catch(e){}
    try{ const m={}; allW.forEach(w=>{m[w.en.toLowerCase()]=(m[w.en.toLowerCase()]||0)+1}); res.dupEn=Object.entries(m).filter(([c,a])=>a>1).map(([c])=>c); }catch(e){}
    // audio map coverage
    try{ res.noLocalAudio = allW.filter(w=>{const l=w.en.toLowerCase(); return !((window.__ISLAND_LOCAL_AUDIO&&window.__ISLAND_LOCAL_AUDIO[l])||(window.WORD_MAP&&(window.WORD_MAP[l]||window.WORD_MAP[w.en])));}).map(w=>w.en); }catch(e){ res.noLocalAudio='ERR '+e.message; }
    try{ res.noExAudio = allW.filter(w=>{ if(!w.ex) return true; const t=w.ex.trim(); const k=t.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim(); return !(window.__HANSEN_EX_AUDIO&&window.__HANSEN_EX_AUDIO[k]) && !(window.SENTENCE_MAP&&window.SENTENCE_MAP[t]); }).map(w=>w.en); }catch(e){ res.noExAudio='ERR '+e.message; }
    try{ res.audioUrls = allW.map(w=>{const l=w.en.toLowerCase(); return (window.__ISLAND_LOCAL_AUDIO&&window.__ISLAND_LOCAL_AUDIO[l])||(window.WORD_MAP&&(window.WORD_MAP[l]||window.WORD_MAP[w.en]))||null;}).filter(Boolean); }catch(e){}
    try{ res.exUrls = allW.map(w=>{ if(!w.ex) return null; const t=w.ex.trim(); const k=t.toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim(); if(window.__HANSEN_EX_AUDIO&&window.__HANSEN_EX_AUDIO[k]) return window.__HANSEN_EX_AUDIO[k]; if(window.SENTENCE_MAP&&window.SENTENCE_MAP[t]!=null) return 'sentences/sentence_'+String(window.SENTENCE_MAP[t]).padStart(4,'0')+'.mp3'; return null;}).filter(Boolean); }catch(e){}
    res.emptyEmoji = allW.filter(w=>!w.emoji).map(w=>w.en);
    res.noPn = allW.filter(w=>!w.pn).map(w=>w.en);
    return res;
  });
  r.finalUrl = url; r.events = ev;
  out[k]=r;
  await page.close();
}
fs.writeFileSync(OUT+'/counts.json', JSON.stringify(out,null,1));
for(const k of ISL){ const r=out[k]; console.log(k, 'n='+r.n, 'listen',JSON.stringify(r.listen),'cloze',JSON.stringify(r.cloze),'moles',JSON.stringify(r.moles),'fish',JSON.stringify(r.fish),'bubble',JSON.stringify(r.bubble),'scr',JSON.stringify(r.scramble),'eagle',JSON.stringify(r.eagle),'typing',JSON.stringify(r.typing)); console.log('   clozeNoBlank',r.clozeNoBlank, 'dupCn',r.dupCn,'dupEn',r.dupEn,'noLocalAudio',r.noLocalAudio,'noExAudio',r.noExAudio, 'emptyEmoji', r.emptyEmoji, 'noPn', r.noPn, 'events', r.events.length, r.finalUrl); }
await browser.close(); srv.close();
