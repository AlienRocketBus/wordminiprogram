// Functional sweep of every mini-game on a list of islands (PART 1)
import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import fs from 'node:fs';

const ALL = ['sports','time','traffic','treasure','season','land1','land2','land3','land4','land5','land6','land7','land8'];
const argIsl = (process.argv[2]||'').split(',').filter(Boolean);
const ISL = argIsl.length ? argIsl : ALL;
const ONLY = (process.argv[3]||'').split(',').filter(Boolean); // optional game filter
const OPT = JSON.parse(process.argv[4]||'{}'); // {timeouts:true, fullBee:true, width:390, height:844, shots:true}
const W = OPT.width||390, H = OPT.height||844;
const SHOTDIR = OUT+'/shots'; fs.mkdirSync(SHOTDIR,{recursive:true});

const {srv, port} = await startServer();
const browser = await launch();

const INIT = () => {
  try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){}
  window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} });
};

function now(){ return Date.now(); }

async function runIsland(key){
  const {ctx, ext} = await newCtx(browser, port, {width:W, height:H, init: INIT});
  const page = await ctx.newPage();
  const events = []; let tag = key+':boot';
  attach(page, events, ()=>tag);
  const R = {island:key, games:{}, notes:[], ext:null};
  const note = (g, s)=>{ (R.games[g] = R.games[g]||{notes:[]}).notes.push(s); };
  let F = null; // island frame
  const getF = ()=> page.frames().find(f=>new RegExp('/island_'+key+'\\.html').test(f.url()));

  async function shot(name){ if(OPT.shots===false) return; try{ await page.screenshot({path:`${SHOTDIR}/${key}_${name}_${W}.png`}); }catch(e){} }
  async function fe(fn, arg){ return F.evaluate(fn, arg); }
  async function waitFor(fn, {timeout=8000, arg, interval=100, frame}={}){
    const fr = frame||F; const t0=now();
    while(now()-t0<timeout){ let v; try{ v = await fr.evaluate(fn, arg); }catch(e){ v=null; } if(v) return v; await sleep(interval); }
    return null;
  }
  // tap element found by a selector function inside the frame; returns hit info
  async function tapSel(fr, selFn, arg, {scroll=true, label='', retry=2}={}){
    for(let a=0;a<=retry;a++){
      const info = await fr.evaluate(([src, arg, scroll])=>{
        const fn = (0,eval)('('+src+')'); const el = fn(arg);
        if(!el) return {found:false};
        if(scroll) el.scrollIntoView({block:'center', behavior:'instant'});
        const r = el.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2;
        const hit = document.elementFromPoint(x,y);
        const ok = !!hit && (hit===el || el.contains(hit));
        const desc = h=> h? (h.tagName+(h.id?'#'+h.id:'')+(h.className&&typeof h.className==='string'?'.'+h.className.split(' ').slice(0,2).join('.'):'')+' "'+(h.innerText||'').slice(0,30).replace(/\s+/g,' ')+'"') : null;
        return {found:true, x, y, w:r.width, h:r.height, ok, hit: desc(hit), vw:innerWidth, vh:innerHeight};
      }, [selFn.toString(), arg, scroll]);
      if(!info.found) return {ok:false, found:false, label};
      if(info.ok && info.y>=0 && info.y<=info.vh && info.x>=0 && info.x<=info.vw){
        let ox=0, oy=0;
        if(fr !== page.mainFrame()){
          // accumulate nested frame offsets
          let f = fr; while(f.parentFrame()){ const el = await f.frameElement(); const b = await el.boundingBox(); ox+=b?b.x:0; oy+=b?b.y:0; f = f.parentFrame(); }
        }
        await page.touchscreen.tap(ox+info.x, oy+info.y);
        return {...info, label};
      }
      if(a<retry) await sleep(700);
      else return {...info, ok:false, label};
    }
  }
  const S = s => `{ return ${s}; }`; // helper not used

  async function pickLevel(contentId, fn, g){
    const info = await fe(([cid, fn])=>[...document.querySelectorAll('#'+cid+' [onclick^="'+fn+'("]')].map(e=>{ const m=(e.innerText||'').match(/(\d+)\s*(词|题|条(?!命)|个单词)/); return {oc:e.getAttribute('onclick'), n: m?+m[1]:null}; }), [contentId, fn]);
    let lv = 'easy';
    const easy = info.find(x=>/'easy'/.test(x.oc));
    if(OPT.level) lv = OPT.level; else if(easy && easy.n===0) lv='medium';
    if(lv!=='easy') note(g, 'easy level shows 0 words -> using '+lv+' | counts '+info.map(x=>x.n).join('/'));
    return lv;
  }

  async function homeState(){
    return fe(()=>{
      const act = document.querySelector('.screen.active');
      const cs = getComputedStyle(document.body);
      const vw=innerWidth, vh=innerHeight;
      const blockers=[];
      document.querySelectorAll('body *').forEach(el=>{
        const s=getComputedStyle(el); if(s.position!=='fixed') return; if(s.display==='none'||s.visibility==='hidden'||+s.opacity<0.05) return;
        const r=el.getBoundingClientRect(); if(r.width*r.height < vw*vh*0.3) return;
        if(el.id==='app'||el.classList.contains('bottom-nav')) return;
        if(s.pointerEvents==='none') return;
        blockers.push((el.id||el.className||el.tagName).toString().slice(0,60)+' z='+s.zIndex);
      });
      const g = n=>{ try{ return eval(n); }catch(e){ return 'n/a'; } };
      const flags = {listenActive:g('listenActive'), typeActive:g('typeActive'), spActive:g('spActive'), molesActive:g('molesActive'), fishActive:g('fishActive'), bubbleActive:g('bubbleActive'), eagleActive:g('eagleActive'), clozeActive:g('clozeActive'), matchActive:g('matchActive')};
      const timers = {spTimer:g('spTimer'), typeTimerInt:g('typeTimerInt'), eagleTimer:g('eagleTimer'), bubbleCountdownTimer:g('bubbleCountdownTimer'), bubbleFloatTimer:window.bubbleFloatTimer||null, molesWaveTimer:g('molesWaveTimer'), fishSpawnTimer:g('fishSpawnTimer')};
      const y0 = scrollY; scrollTo(0, 600); const canScroll = scrollY>0; scrollTo(0, y0);
      const hOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth+1;
      return {active: act&&act.id, bodyCls: document.body.className, bodyOverflow: cs.overflow, bodyPos: cs.position, blockers, flags, timers, canScroll, hOverflow,
        sbOv: !!document.getElementById('hsnSbOverlay'), pkOn: !!document.querySelector('#hsn_pk_screen.on'), pkOv: !!document.getElementById('__hsn_pk_ov'),
        alertShown: !!document.querySelector('#alertModal.show'), modalShown: !!document.querySelector('#wordModal.show')};
    });
  }
  async function overflowCheck(scope, fr){
    return (fr||F).evaluate((scope)=>{
      const root = document.querySelector(scope)||document.body; const vw = innerWidth; const out=[];
      root.querySelectorAll('*').forEach(el=>{
        const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden') return;
        const r=el.getBoundingClientRect(); if(r.width===0||r.height===0) return;
        if(r.right>vw+2 || r.left<-2){
          // ignore if an ancestor clips
          let p=el.parentElement, clipped=false; while(p&&p!==document.body){ const ps=getComputedStyle(p); if(/hidden|clip|auto|scroll/.test(ps.overflowX)){ const pr=p.getBoundingClientRect(); if(pr.right<=vw+2&&pr.left>=-2){clipped=true;break;} } p=p.parentElement; }
          if(!clipped && (el.innerText||'').trim()) out.push({t:(el.innerText||'').trim().slice(0,40), l:Math.round(r.left), r:Math.round(r.right), cls:String(el.className).slice(0,40)});
        }
        // text clipped inside fixed-size box
        if(el.children.length===0 && (el.innerText||'').trim() && el.scrollWidth>el.clientWidth+2 && /hidden|clip/.test(s.overflow) && s.textOverflow!=='ellipsis'){
          out.push({clip:true, t:(el.innerText||'').trim().slice(0,40), sw:el.scrollWidth, cw:el.clientWidth, cls:String(el.className).slice(0,40)});
        }
      });
      return {docOverflow: document.documentElement.scrollWidth>document.documentElement.clientWidth+1, items: out.slice(0,12)};
    }, scope);
  }
  async function dismissStrays(g){
    // close any modal that real kids would also have to close (level-up / achievements / alert)
    const st = await fe(()=>({alert: !!document.querySelector('#alertModal.show'), txt: (document.querySelector('#alertModal.show #alertInner')||{}).innerText||''}));
    if(st.alert){ note(g, 'alertModal popped: '+st.txt.slice(0,120).replace(/\s+/g,' ')); await tapSel(F, ()=>{ return document.querySelector('#alertModal.show #alertInner button')||document.querySelector('#alertModal.show button'); }); await sleep(300); }
  }
  async function tapCard(onclick){
    await fe(()=>{ if(document.querySelector('.screen.active').id!=='homeScreen') showScreen('home'); });
    const r = await tapSel(F, (oc)=>{ return [...document.querySelectorAll('#homeScreen .mode-card')].find(e=>(e.getAttribute('onclick')||'').indexOf(oc)===0); }, onclick);
    return r;
  }
  async function tapBack(screenId){
    return tapSel(F, (id)=>{ return document.querySelector('#'+id+' > .back-btn')||document.querySelector('#'+id+' .back-btn'); }, screenId);
  }
  async function afterClose(g){
    await sleep(400);
    const st = await homeState();
    R.games[g].home = st;
    const bad=[];
    if(st.active!=='homeScreen') bad.push('active screen='+st.active);
    if(st.blockers.length) bad.push('blockers '+st.blockers.join(','));
    if(/type-lock/.test(st.bodyCls)) bad.push('body.type-lock stuck');
    if(st.bodyPos==='fixed' || st.bodyOverflow==='hidden') bad.push('body pos/overflow '+st.bodyPos+'/'+st.bodyOverflow);
    if(!st.canScroll) bad.push('home cannot scroll');
    for(const [k,v] of Object.entries(st.flags)) if(v===true && k!=='matchActive') bad.push('flag '+k+' still true');
    for(const [k,v] of Object.entries(st.timers)) if(v && v!=='n/a') bad.push('timer '+k+' still set '+v);
    if(st.sbOv||st.pkOn||st.pkOv) bad.push('overlay left sb/pk');
    if(bad.length) note(g, 'AFTER CLOSE: '+bad.join(' | '));
    return bad;
  }
  function gEvents(g){ return events.filter(e=>e.tag.startsWith(key+':'+g)); }

  // ---------- open island via home ----------
  await page.goto(`http://127.0.0.1:${port}/index.html`, {waitUntil:'load'});
  await sleep(1200);
  // onboarding (we pre-set hansen_onboarded; if still shown, tap 跳过)
  const sk = await page.$('#__hsOnbSkip'); if(sk){ R.notes.push('onboarding shown despite flag'); await sk.tap().catch(()=>{}); await sleep(400); }
  if(/^(land\d|season)$/.test(key)){
    await page.evaluate((k)=>window.openIsland('island_'+k+'.html'), key);
    R.notes.push('opened via window.openIsland (no home card for this island)');
  } else {
    const cardTap = await tapSel(page.mainFrame(), (k)=>{ return document.querySelector('a[href="island_'+k+'.html"]'); }, key);
    R.notes.push('home card tap: '+JSON.stringify({ok:cardTap.ok, hit:cardTap.hit}));
  }
  const t0=now();
  for(let i=0;i<100;i++){ F = getF(); if(F){ try{ if(await F.evaluate(()=>document.readyState!=='loading' && typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
  R.openMs = now()-t0;
  if(!F){ R.notes.push('ISLAND FRAME NOT FOUND'); await ctx.close(); return R; }
  // season hub: story prologue overlay first
  const story = await waitFor(()=>document.getElementById('hsnStoryClose') ? (document.getElementById('hsnStoryModal').innerText||'').slice(0,80) : null, {timeout: /season/.test(key)?4000:300});
  if(story){ R.story = story; await sleep(900); const t = await tapSel(F, ()=>document.getElementById('hsnStoryClose')); R.notes.push('story close tap ok='+t.ok); await sleep(600); R.storyGone = await fe(()=>!document.getElementById('hsnStoryModal')); }
  R.landing = await fe(()=>{ const a=document.querySelector('.screen.active'); return a&&a.id; });
  if(OPT.landingShot) await shot('landing');
  // wait the welcome popup
  const wel = await waitFor(()=>document.querySelector('#alertModal.show') ? document.getElementById('alertInner').innerText : null, {timeout:3000});
  R.welcome = wel ? wel.replace(/\s+/g,' ').slice(0,300) : null;
  if(wel){ await sleep(900); const t = await tapSel(F, ()=>{ return [...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText)); }); R.notes.push('welcome btn tap ok='+t.ok); await sleep(400); }
  await shot('home');
  R.cards = await fe(()=>[...document.querySelectorAll('#homeScreen .mode-card')].map(e=>(e.innerText||'').trim().replace(/\s+/g,' ')));
  R.homeOverflow = await overflowCheck('#homeScreen');
  const startCoins = await fe(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP}));
  R.start = startCoins;

  const want = g => !ONLY.length || ONLY.includes(g);
  async function game(g, fn){
    if(!want(g)) return;
    R.games[g] = R.games[g]||{notes:[]};
    tag = key+':'+g; const t=now();
    const before = await fe(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP, answers:S.totalAnswers}));
    try{ await Promise.race([fn(g), sleep(OPT.gameTimeout||240000).then(()=>{ throw new Error('GAME TIMEOUT'); })]); }
    catch(e){ note(g, 'DRIVER ERROR: '+String(e.message||e).slice(0,300)); await shot(g+'_error'); }
    tag = key+':'+g+':close';
    try{ await dismissStrays(g); }catch(e){}
    const after = await fe(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP, answers:S.totalAnswers}));
    R.games[g].delta = {coins: after.coins-before.coins, xp: after.xp-before.xp, answers: after.answers-before.answers};
    R.games[g].ms = now()-t;
    try{ await afterClose(g); }catch(e){ note(g,'afterClose err '+e.message); }
    R.games[g].events = gEvents(g);
    tag = key+':between';
  }

  // ---------- EXPLORE ----------
  await game('explore', async g=>{
    const t = await tapCard("showScreen('explore')"); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    const n = await waitFor(()=>document.getElementById('exploreScreen').classList.contains('active') && document.querySelectorAll('#exploreContent .exp-card').length);
    const nw = await fe(()=>allW.length);
    note(g, `cards=${n} allW=${nw}`);
    R.games[g].overflow = await overflowCheck('#exploreScreen');
    await shot('explore');
    let r = await tapSel(F, ()=>{ return document.querySelector('#exploreContent .exp-card'); });
    if(!r.ok){ note(g,'exp-card tap blocked '+r.hit); return; }
    const m = await waitFor(()=>document.querySelector('#wordModal.show') ? document.getElementById('modalInner').innerText : null, {timeout:3000});
    await sleep(700);
    if(!m){ note(g,'word modal did not open'); return; }
    R.games[g].modal = m.replace(/\s+/g,' ').slice(0,200);
    R.games[g].modalOverflow = await overflowCheck('#wordModal');
    await shot('explore_modal');
    for(const lab of ['发音','慢速','例句']){ const rr = await tapSel(F, (lab)=>{ return [...document.querySelectorAll('#modalInner button')].find(b=>b.innerText.indexOf(lab)>=0); }, lab, {scroll:false}); if(!rr.ok) note(g,'modal btn '+lab+' tap failed '+rr.hit); await sleep(lab==='例句'?2500:900); }
    r = await tapSel(F, ()=>{ return [...document.querySelectorAll('#modalInner button')].find(b=>/加入学习/.test(b.innerText)); }, null, {scroll:false});
    if(!r.ok) note(g,'learn btn tap failed '+JSON.stringify(r));
    await sleep(600);
    const st = await fe(()=>({modal: !!document.querySelector('#wordModal.show'), learned:S.learned.length, firstLearned: !!document.querySelector('#exploreContent .exp-card.learned')}));
    note(g, 'after learn '+JSON.stringify(st));
    if(st.modal) note(g, 'BUG? modal still open after 加入学习');
    // open second word & close with X
    r = await tapSel(F, ()=>{ return document.querySelectorAll('#exploreContent .exp-card')[1]; });
    await waitFor(()=>!!document.querySelector('#wordModal.show'), {timeout:2000});
    await sleep(700); // let the zoom-in animation finish (a kid taps after seeing it)
    r = await tapSel(F, ()=>{ return document.querySelector('#modalInner .close'); }, null, {scroll:false});
    await sleep(400);
    const st2 = await fe(()=>!!document.querySelector('#wordModal.show'));
    if(st2) note(g,'modal not closed by ✕ (tap '+JSON.stringify(r)+')');
    // also tap outside to close? check
    await tapBack('exploreScreen');
  });

  // ---------- LISTEN ----------
  await game('listen', async g=>{
    const t = await tapCard('startListen()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    const lv = await waitFor(()=>document.querySelectorAll('#listenContent [onclick^="startListenLevel"]').length);
    note(g,'levels='+lv);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#listenContent [onclick^="startListenLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    await shot('listen_levels');
    { const __lv = await pickLevel('listenContent','startListenLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#listenContent [onclick="startListenLevel(\''+l+'\')"]'); }, __lv); }
    let q=0, right=0, wrong=0, stuck=0, waits=[];
    while(q<80){
      const ready = await waitFor(()=> (typeof listenQ!=='undefined' && listenQ && !listenQ.answered && document.querySelectorAll('#listenScreen .listen-opts .boss-opt').length===4) ? {cn:listenQ.word.cn, en:listenQ.word.en} : (/完成/.test((document.getElementById('listenContent')||{}).innerText||'') ? 'DONE':null), {timeout:9000});
      if(ready==='DONE') break;
      if(!ready){ note(g,'no next question within 9s at q='+q); stuck++; break; }
      await fe(()=>{ window.__prevQ = listenQ; });
      const doWrong = (q===1||q===4);
      const idx = await fe((w)=>{ const i = listenQ.opts.findIndex(o=>o.cn===listenQ.word.cn); return w ? (i+1)%4 : i; }, doWrong);
      if(q===0) await shot('listen_q');
      const r = await tapSel(F, (i)=>{ return document.querySelectorAll('#listenScreen .listen-opts .boss-opt')[i]; }, idx);
      if(!r.ok){ note(g,'opt tap blocked q='+q+' '+r.hit); break; }
      doWrong?wrong++:right++;
      const tq=now();
      const nx = await waitFor(()=> listenQ!==window.__prevQ || !listenActive, {timeout:9000, interval:80});
      waits.push(now()-tq);
      if(!nx){ note(g,'question did not advance within 9s after answer q='+q); stuck++; break; }
      q++;
    }
    const res = await fe(()=>(document.getElementById('listenContent')||{}).innerText||'');
    R.games[g].result = res.replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q, right, wrong, avgWait: Math.round(waits.reduce((a,b)=>a+b,0)/Math.max(1,waits.length)), maxWait: Math.max(0,...waits)};
    await shot('listen_result');
    const m = res.match(/答对\s*(\d+)\s*\/\s*(\d+)/); if(m && (+m[1]!==right || +m[2]!==right+wrong)) note(g, `RESULT MISMATCH shown ${m[1]}/${m[2]} actual ${right}/${right+wrong}`);
    await tapBack('listenScreen');
  });

  // ---------- MATCH ----------
  await game('match', async g=>{
    const t = await tapCard('startMatch()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    const n = await waitFor(()=>document.querySelectorAll('#matchBoard .match-card').length);
    note(g,'cards='+n);
    R.games[g].overflow = await overflowCheck('#matchScreen');
    const pairs = await fe(()=>matchPairs.map(p=>({t:p.type, i:p.idx})));
    // one deliberate mistake
    let a=0, b=pairs.findIndex((p,j)=>j>0 && p.i!==pairs[0].i);
    await tapSel(F, (i)=>{ return document.getElementById('mc'+i); }, a);
    await sleep(150);
    await tapSel(F, (i)=>{ return document.getElementById('mc'+i); }, b);
    await sleep(300); await shot('match_mistake');
    await sleep(900);
    const fl = await fe(()=>document.querySelectorAll('#matchBoard .match-card.flipped').length);
    if(fl) note(g,'cards stay flipped after mistake: '+fl);
    const done = new Set();
    for(let k=0;k<pairs.length;k++){
      if(done.has(pairs[k].i)) continue; done.add(pairs[k].i);
      const j = pairs.findIndex((p,jj)=>jj!==k && p.i===pairs[k].i);
      const r1 = await tapSel(F, (i)=>{ return document.getElementById('mc'+i); }, k);
      await sleep(120);
      const r2 = await tapSel(F, (i)=>{ return document.getElementById('mc'+i); }, j);
      if(!r1.ok||!r2.ok) note(g,'card tap blocked '+(r1.hit||'')+' '+(r2.hit||''));
      await sleep(560);
    }
    const res = await waitFor(()=>/步数/.test((document.getElementById('matchContent')||{}).innerText||'') && document.querySelector('#matchContent .game-btn') ? document.getElementById('matchContent').innerText : null, {timeout:4000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    if(res && !/失误：1/.test(res)) note(g,'unexpected mistake count in result');
    await shot('match_result');
    await tapBack('matchScreen');
  });

  // ---------- TYPING ----------
  await game('typing', async g=>{
    const t = await tapCard('showTypingMenu()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#typingContent [onclick^="startTyping"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#typingContent [onclick^="startTyping"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    const level = OPT.typingLevel||1;
    await tapSel(F, (l)=>{ return document.querySelector('#typingContent [onclick="startTyping('+l+')"]'); }, level);
    let q=0, right=0, wrongN=0, timeouts=0, untypeable=[];
    while(q<60){
      const w = await waitFor(()=> (typeActive && typeWord && document.querySelector('#typeSlots') && !document.getElementById('typeCompare')) ? {en:typeWord.en, idx:typeIdx} : (/字母\/分|打字完成|完成/.test((document.getElementById('typingContent')||{}).innerText||'') && !typeActive && !document.querySelector('#typingContent .keyboard') ? 'DONE' : null), {timeout:6000});
      if(w==='DONE') break;
      if(!w){ note(g,'typing: no next word in 6s at q='+q); break; }
      if(q===0){
        R.games[g].kbLayout = await fe(()=>{ const ks=[...document.querySelectorAll('.keyboard .key')]; const r=ks.map(k=>k.getBoundingClientRect()); return {n:ks.length, maxBottom:Math.round(Math.max(...r.map(x=>x.bottom))), minW:Math.round(Math.min(...r.map(x=>x.width))), vh:innerHeight, scrollY, bodyPos:getComputedStyle(document.body).position}; });
        R.games[g].overflow = await overflowCheck('#typingScreen');
        await shot('typing_q');
      }
      const keys = await fe(()=>{ const m={}; document.querySelectorAll('.keyboard .key').forEach(k=>{ const oc=k.getAttribute('onclick')||''; const mm=oc.match(/typeKey\('(.)'\)/); const r=k.getBoundingClientRect(); if(mm) m[mm[1]]={x:r.left+r.width/2,y:r.top+r.height/2}; }); return m; });
      const target = w.en.toLowerCase();
      const doTimeout = OPT.timeouts && q===2;
      const doWrong = (q===0||q===5);
      if(doTimeout){ const t1=now(); const adv = await waitFor((i)=>typeIdx!==i, {arg:w.idx, timeout:34000, interval:300}); note(g,'timeout test: advanced='+!!adv+' after '+(now()-t1)+'ms'); timeouts++; q++; continue; }
      const seq = doWrong ? target.split('').map(c=>c===' '?' ':(c==='z'?'x':'z')) : target.split('');
      let typed='';
      for(const c of seq){
        if(c===' ') continue; // auto-skipped by game
        const k = keys[c];
        if(!k){ untypeable.push(w.en+' ['+c+']'); continue; }
        await page.touchscreen.tap(k.x, k.y); typed+=c; await sleep(60);
      }
      if(untypeable.length && untypeable[untypeable.length-1].startsWith(w.en)){
        note(g,'word has chars with no key: '+w.en+' -> kid cannot type it correctly');
        // type remaining length with some letter so the game can progress
        const cur = await fe(()=>typeInput.length); const need = target.length-cur; for(let i=0;i<need;i++){ await page.touchscreen.tap(keys['a'].x, keys['a'].y); await sleep(60); }
      }
      const adv = await waitFor((i)=>typeIdx!==i || !typeActive && !document.querySelector('#typingContent .keyboard'), {arg:w.idx, timeout:5000, interval:100});
      if(!adv){ note(g,'typing did not advance after full word '+w.en+' typed='+typed+' input='+(await fe(()=>typeInput))); break; }
      if(doWrong){ wrongN++; } else right++;
      q++;
    }
    const res = await waitFor(()=>!document.querySelector('#typingContent .keyboard') ? document.getElementById('typingContent').innerText : null, {timeout:4000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,400);
    R.games[g].played = {q, right, wrongN, timeouts, untypeable};
    await shot('typing_result');
    R.games[g].resultOverflow = await overflowCheck('#typingScreen');
    await tapBack('typingScreen');
  });

  // ---------- CLOZE ----------
  await game('cloze', async g=>{
    const t = await tapCard('startCloze()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#clozeContent [onclick^="startClozeLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#clozeContent [onclick^="startClozeLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    const level = OPT.clozeLevel||'easy';
    await tapSel(F, (l)=>{ return document.querySelector('#clozeContent [onclick="startClozeLevel(\''+l+'\')"]'); }, level);
    let q=0, right=0, wrong=0, waits=[], counters=[];
    while(q<60){
      const ready = await waitFor(()=> (clozeActive && clozeQ && document.querySelectorAll('#clozeScreen .cloze-opt').length===4 && !document.querySelector('#clozeScreen .cloze-opt[data-done]')) ? {en:clozeQ.word.en, ctr:(document.querySelector('#clozeContent')||{}).innerText.match(/(\d+)\s*\/\s*(\d+)/)} : (!clozeActive && /完成/.test((document.getElementById('clozeContent')||{}).innerText||'') ? 'DONE':null), {timeout:10000});
      if(ready==='DONE') break;
      if(!ready){ note(g,'no next question in 10s q='+q); break; }
      counters.push(ready.ctr ? ready.ctr[1]+'/'+ready.ctr[2] : '?');
      if(q===0){ R.games[g].overflow = await overflowCheck('#clozeScreen'); await shot('cloze_q'); }
      await fe(()=>{ window.__prevQ = clozeQ; });
      const doWrong = (q===1);
      const idx = await fe((w)=>{ const i = clozeQ.opts.findIndex(o=>o.en===clozeQ.word.en); return w ? (i+1)%4 : i; }, doWrong);
      const r = await tapSel(F, (i)=>{ return document.querySelectorAll('#clozeScreen .cloze-opt')[i]; }, idx);
      if(!r.ok){ note(g,'opt tap blocked '+r.hit); break; }
      doWrong?wrong++:right++;
      const tq=now();
      const nx = await waitFor(()=> clozeQ!==window.__prevQ || !clozeActive, {timeout:10000, interval:100});
      waits.push(now()-tq);
      if(!nx){ note(g,'did not advance in 10s'); break; }
      q++;
    }
    const res = await fe(()=>(document.getElementById('clozeContent')||{}).innerText||'');
    R.games[g].result = res.replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q, right, wrong, counters, avgWait: Math.round(waits.reduce((a,b)=>a+b,0)/Math.max(1,waits.length)), maxWait:Math.max(0,...waits)};
    const m = res.match(/答对\s*(\d+)\s*\/\s*(\d+)\s*题\s*·\s*正确率\s*(\d+)%/);
    if(m && +m[2]!==right+wrong) note(g, `RESULT TOTAL MISMATCH: shown ${m[1]}/${m[2]} (${m[3]}%) but kid answered ${right+wrong} questions (${right} right)`);
    await shot('cloze_result');
    await tapBack('clozeScreen');
  });

  // ---------- SCRAMBLE ----------
  await game('scramble', async g=>{
    const t = await tapCard('startScramble()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#scrambleContent [onclick^="startScrambleLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#scrambleContent [onclick^="startScrambleLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    { const __lv = await pickLevel('scrambleContent','startScrambleLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#scrambleContent [onclick="startScrambleLevel(\''+l+'\')"]'); }, __lv); }
    let q=0, right=0, wrong=0, skips=0, hint=0;
    while(q<60){
      const w = await waitFor(()=> (scrWord && document.querySelector('#scrLetters .scramble-letter') && !document.querySelector('#scrLetters .scramble-letter.used')) ? {en:scrWord.en, idx:scrIdx, tiles:[...document.querySelectorAll('#scrLetters .scramble-letter')].map(e=>e.textContent)} : (/通关|完成|再试一次/.test((document.getElementById('scrambleContent')||{}).innerText||'') && !document.getElementById('scrLetters') ? 'DONE':null), {timeout:6000});
      if(w==='DONE') break;
      if(!w){ note(g,'no next word q='+q); break; }
      if(q===0){ R.games[g].overflow = await overflowCheck('#scrambleScreen'); await shot('scramble_q'); }
      const tgt = w.en.replace(/ /g,'').split('');
      const order = (target)=>{ const used=new Set(); const out=[]; for(const c of target){ const i=w.tiles.findIndex((t,ii)=>!used.has(ii)&&t===c); if(i<0) return null; used.add(i); out.push(i);} return out; };
      const ok = order(tgt);
      if(!ok){ note(g,'tiles cannot form word '+w.en+' tiles='+w.tiles.join('')); }
      if(q===1){ // hint overlay
        const r = await tapSel(F, ()=>{ return [...document.querySelectorAll('#scrambleContent button')].find(b=>/提示/.test(b.innerText)); });
        await sleep(300); const ov = await fe(()=>!!document.getElementById('scrHintOverlay')); hint++;
        if(!ov) note(g,'hint overlay did not show'); else { await tapSel(F, ()=>{ return document.getElementById('scrHintOverlay'); }, null, {scroll:false}); await sleep(200); }
      }
      if(q===2){ const r = await tapSel(F, ()=>{ return [...document.querySelectorAll('#scrambleContent button')].find(b=>/跳过/.test(b.innerText)); }); await sleep(300); const adv=await fe((i)=>scrIdx!==i, w.idx); skips++; note(g,'skip advanced='+adv); q++; continue; }
      if(q===0 && ok){ // wrong attempt: reversed order of tiles (ensure differs)
        let wrongOrd = ok.slice().reverse(); const typed = wrongOrd.map(i=>w.tiles[i]).join('');
        if(typed.toLowerCase()!==tgt.join('').toLowerCase()){
          for(const i of wrongOrd){ await tapSel(F, (i)=>{ return document.getElementById('sl'+i); }, i, {scroll:false}); await sleep(50); }
          wrong++; await sleep(300); const msg = await fe(()=>(document.getElementById('scrMsg')||{}).innerText||''); if(!/不对/.test(msg)) note(g,'no wrong message: '+msg);
          await sleep(1100);
          const cleared = await fe(()=>!document.querySelector('#scrLetters .scramble-letter.used'));
          if(!cleared) note(g,'tiles not cleared after wrong attempt');
        }
      }
      if(ok){ for(const i of ok){ const r=await tapSel(F, (i)=>{ return document.getElementById('sl'+i); }, i, {scroll:q===0}); if(!r.ok){ note(g,'tile tap blocked '+r.hit); } await sleep(50); } }
      const adv = await waitFor((i)=>scrIdx!==i || !document.getElementById('scrLetters'), {arg:w.idx, timeout:4000});
      if(!adv){ note(g,'did not advance after correct word '+w.en+' msg='+(await fe(()=>(document.getElementById('scrMsg')||{}).innerText))); break; }
      right++; q++;
    }
    const res = await waitFor(()=>!document.getElementById('scrLetters') ? document.getElementById('scrambleContent').innerText : null, {timeout:3000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q, right, wrong, skips, hint};
    await shot('scramble_result');
    await tapBack('scrambleScreen');
  });

  // ---------- SPELLING BEE ----------
  await game('spellbee', async g=>{
    const t = await tapCard('HansenSpellBee.open'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    let B=null; for(let i=0;i<80;i++){ B = page.frames().find(f=>/spelling_bee\.html/.test(f.url())); if(B){ try{ if(await B.evaluate(()=>document.readyState!=='loading' && !!document.getElementById('startBtn'))) break; }catch(e){} } await sleep(100); }
    if(!B){ note(g,'spelling bee frame not found'); return; }
    await sleep(600);
    const setup = await B.evaluate(()=>({tip:(document.querySelector('.sec-t .tip')||{}).textContent, sub:(document.querySelector('.sub')||{}).textContent, words: WORDS.length, chips:[...document.querySelectorAll('#diffBox .chip')].map(c=>c.innerText.replace(/\s+/g,' ')+(c.classList.contains('sel')?'[sel]':'')+(c.classList.contains('dis')||c.getAttribute('aria-disabled')==='true'?'[dis]':'')), qCount:S.qCount, diff:S.diff, mode:S.mode}));
    R.games[g].setup = setup;
    await shot('spellbee_setup');
    let r = await tapSel(B, ()=>{ return document.getElementById('startBtn'); });
    if(!r.ok){ note(g,'start tap blocked '+r.hit); }
    const started = await waitFor(()=>document.getElementById('game').classList.contains('on'), {frame:B, timeout:4000});
    if(!started){ note(g,'bee game did not start'); }
    const maxWords = OPT.fullBee ? 200 : 4;
    let q=0, right=0, lost=0;
    while(q<maxWords){
      const st = await waitFor(()=> document.getElementById('over').classList.contains('on') ? 'OVER' : ((!raceOver && curWord && /拼写中/.test(document.getElementById('sttYou').textContent) && yourInput.length===0) ? {t:target, en:curWord.en, q:qIdx, totalQ} : null), {frame:B, timeout:9000});
      if(st==='OVER') break;
      if(!st){ note(g,'bee: race did not start within 9s q='+q+' stt='+(await B.evaluate(()=>document.getElementById('sttYou').textContent))); break; }
      if(q===0){ R.games[g].totalQ=st.totalQ; await shot('spellbee_game'); R.games[g].overflow = await overflowCheck('#game', B).catch(()=>null); }
      const keys = await B.evaluate(()=>{ const m={}; document.querySelectorAll('#kb .key').forEach(k=>{ const r=k.getBoundingClientRect(); m[k.getAttribute('data-k')]={x:r.left+r.width/2,y:r.top+r.height/2,b:r.bottom}; }); return {m, vh:innerHeight}; });
      if(q===0){ const mb=Math.max(...Object.values(keys.m).map(v=>v.b)); R.games[g].kbBottom={max:Math.round(mb), vh:keys.vh}; }
      const doWrong = (q===1);
      const seq = doWrong ? st.t.split('').map(c=>c==='z'?'x':'z') : st.t.split('');
      for(const c of seq){ const k=keys.m[c]; if(!k){ note(g,'no key for '+c); continue; } await page.touchscreen.tap(k.x,k.y); await sleep(70); }
      const res = await waitFor(()=>document.getElementById('laneRes').classList.contains('on') ? document.getElementById('laneRes').innerText : null, {frame:B, timeout: doWrong? 15000 : 3000});
      if(!res){ note(g,'bee: no result panel after '+(doWrong?'wrong':'correct')+' word '+st.en+' input='+(await B.evaluate(()=>yourInput))); break; }
      if(doWrong) lost++; else right++;
      if(q===0) R.games[g].resPanel = res.replace(/\s+/g,' ').slice(0,200);
      q++;
    }
    const over = await B.evaluate(()=>document.getElementById('over').classList.contains('on'));
    if(over){
      R.games[g].over = await B.evaluate(()=>document.querySelector('#over .card').innerText.replace(/\s+/g,' ').slice(0,400));
      await shot('spellbee_over');
      await tapSel(B, ()=>{ return document.getElementById('backBtn'); });
    } else {
      // exit via X -> confirm
      await sleep(300);
      r = await tapSel(B, ()=>{ return document.getElementById('exitBtn'); });
      await sleep(300);
      r = await tapSel(B, ()=>{ return document.getElementById('exitYes'); });
      await sleep(300);
    }
    R.games[g].played = {q, right, lost, over};
    const onSetup = await waitFor(()=>document.getElementById('setup').classList.contains('on'), {frame:B, timeout:3000});
    if(!onSetup) note(g,'bee did not return to setup');
    r = await tapSel(B, ()=>{ return document.querySelector('.sb-back'); });
    const closed = await waitFor(()=>!document.getElementById('hsnSbOverlay'), {timeout:3000});
    if(!closed) note(g,'bee overlay not closed by ‹ 返回');
  });

  // ---------- PK (render only) ----------
  await game('pk', async g=>{
    const t = await tapCard('openSpellPK()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    const on = await waitFor(()=>document.querySelector('#hsn_pk_screen.on') ? document.getElementById('hsn_pk_screen').innerText : (document.getElementById('__hsn_pk_ov')?'IFRAME':null), {timeout:4000});
    R.games[g].text = (on||'NOT OPEN').replace(/\s+/g,' ').slice(0,400);
    R.games[g].overflow = await overflowCheck('#hsn_pk_screen');
    await shot('pk');
    const r = await tapSel(F, ()=>{ return document.getElementById('kBack'); }, null, {scroll:false});
    if(!r.ok) note(g,'PK back tap '+JSON.stringify(r));
    const closed = await waitFor(()=>!document.querySelector('#hsn_pk_screen.on'), {timeout:2000});
    if(!closed) note(g,'PK screen not closed by ← 返回');
  });

  // ---------- MOLES ----------
  await game('moles', async g=>{
    const t = await tapCard('startMoles()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#molesContent [onclick^="startMolesLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#molesContent [onclick^="startMolesLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    await shot('moles_levels');
    { const __lv = await pickLevel('molesContent','startMolesLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#molesContent [onclick="startMolesLevel(\''+l+'\')"]'); }, __lv); }
    let q=0, right=0, wrong=0, reshuf=0;
    while(q<80){
      const st = await waitFor(()=> (molesActive && molesTarget && document.querySelector('#moleSlot0 .mole-card') && !document.querySelector('[id^="moleSlot"][data-locked]')) ? {en:molesTarget.en, hit:molesHit} : (!molesActive && !document.getElementById('molesGrid') ? 'DONE' : null), {timeout:6000});
      if(st==='DONE') break;
      if(!st){ note(g,'moles no wave q='+q); break; }
      if(q===0){ R.games[g].overflow = await overflowCheck('#molesScreen'); await shot('moles_q'); }
      if(q===2){ // let reshuffle happen
        const lay0 = await fe(()=>[...document.querySelectorAll('[id^="moleSlot"]')].map(s=>s.dataset.en).join(','));
        await sleep(6000);
        const lay1 = await fe(()=>[...document.querySelectorAll('[id^="moleSlot"]')].map(s=>s.dataset.en).join(','));
        if(lay0===lay1) note(g,'no reshuffle after 6s'); else reshuf++;
      }
      const doWrong = (q===1);
      const idx = await fe((w)=>{ const sl=[...document.querySelectorAll('[id^="moleSlot"]')]; const i=sl.findIndex(s=>s.dataset.en===molesTarget.en); if(!w) return i; return sl.findIndex(s=>s.dataset.en && s.dataset.en!==molesTarget.en); }, doWrong);
      if(idx<0){ note(g,'target not on board '+st.en); break; }
      const r = await tapSel(F, (i)=>{ return document.getElementById('moleSlot'+i); }, idx, {scroll:q<2});
      if(!r.ok){ note(g,'slot tap blocked '+r.hit); break; }
      doWrong?wrong++:right++;
      const adv = await waitFor((e)=> !molesActive || (molesTarget && molesTarget.en!==e) || !document.querySelector('[id^="moleSlot"][data-locked]'), {arg:st.en, timeout:4000});
      if(!adv){ note(g,'moles did not advance'); break; }
      q++;
    }
    const res = await waitFor(()=>!document.getElementById('molesGrid') ? document.getElementById('molesContent').innerText : null, {timeout:3000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q,right,wrong,reshuf};
    await shot('moles_result');
    await tapBack('molesScreen');
  });

  // ---------- FISH ----------
  await game('fish', async g=>{
    const t = await tapCard('startFish()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#fishContent [onclick^="startFishLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#fishContent [onclick^="startFishLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    { const __lv = await pickLevel('fishContent','startFishLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#fishContent [onclick="startFishLevel(\''+l+'\')"]'); }, __lv); }
    await waitFor(()=>!!document.getElementById('fishPond'));
    await fe(()=>document.getElementById('fishPond').scrollIntoView({block:'center',behavior:'instant'}));
    let q=0, right=0, wrong=0, waitMax=0;
    while(q<80){
      const st = await waitFor(()=> (fishActive && fishTarget && !window.fishLocked) ? {en:fishTarget.en, caught:fishCaught, lives:fishLives} : (!fishActive && !document.getElementById('fishPond') ? 'DONE':null), {timeout:6000});
      if(st==='DONE') break;
      if(!st){ note(g,'fish: no target q='+q); break; }
      const doWrong = (q===1);
      const t1=now(); let tapped=false;
      while(now()-t1<15000){
        const c = await fe((w)=>{ const pond=document.getElementById('fishPond'); if(!pond) return null; const pr=pond.getBoundingClientRect(); const fs=[...pond.querySelectorAll('[data-en]')].filter(f=>!f.dataset.done && (w ? f.dataset.en!==fishTarget.en : f.dataset.en===fishTarget.en)); for(const f of fs){ const r=f.getBoundingClientRect(); const x=r.left+r.width/2, y=r.top+r.height/2; if(x>pr.left+30 && x<pr.right-30 && y>pr.top+10 && y<pr.bottom-10 && +getComputedStyle(f).opacity>0.5){ const hit=document.elementFromPoint(x,y); if(hit&&(hit===f||f.contains(hit))) return {x,y}; } } return null; }, doWrong);
        if(c){ await page.touchscreen.tap(c.x, c.y); tapped=true; break; }
        await sleep(150);
      }
      waitMax=Math.max(waitMax, now()-t1);
      if(!tapped){ note(g,'fish: no tappable '+(doWrong?'wrong':'target')+' fish for 15s (target '+st.en+')'); break; }
      if(q===0) await shot('fish_q');
      const adv = await waitFor((s)=> !fishActive || fishCaught!==s.caught || fishLives!==s.lives, {arg:st, timeout:3000, interval:80});
      if(!adv){ note(g,'fish tap did not register (target '+st.en+')'); continue; }
      doWrong?wrong++:right++; q++;
    }
    const res = await waitFor(()=>!document.getElementById('fishPond') ? document.getElementById('fishContent').innerText : null, {timeout:3000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q,right,wrong,waitMax};
    await shot('fish_result');
    await tapBack('fishScreen');
  });

  // ---------- BUBBLE ----------
  await game('bubble', async g=>{
    const t = await tapCard('startBubble()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#bubbleContent [onclick^="startBubbleLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#bubbleContent [onclick^="startBubbleLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    { const __lv = await pickLevel('bubbleContent','startBubbleLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#bubbleContent [onclick="startBubbleLevel(\''+l+'\')"]'); }, __lv); }
    await waitFor(()=>!!document.getElementById('bbArea'));
    await fe(()=>document.getElementById('bbArea').scrollIntoView({block:'center',behavior:'instant'}));
    let q=0, right=0, wrong=0, tmo=0;
    while(q<80){
      const st = await waitFor(()=> (bubbleActive && bubbleTarget && !window.bubbleLocked && document.querySelectorAll('#bbArea .bubble').length>=5) ? {en:bubbleTarget.en, done:bubbleDone, lives:bubbleLives} : (!bubbleActive && !document.getElementById('bbArea') ? 'DONE':null), {timeout:8000});
      if(st==='DONE') break;
      if(!st){ note(g,'bubble: no question q='+q); break; }
      if(q===0){ R.games[g].overflow = await overflowCheck('#bubbleScreen'); await shot('bubble_q'); }
      if(OPT.timeouts && q===3){ const t1=now(); const adv = await waitFor((s)=>bubbleLives!==s.lives || !bubbleActive, {arg:st, timeout:34000, interval:300}); note(g,'timeout test: lives '+st.lives+'->'+(await fe(()=>bubbleLives))+' after '+(now()-t1)+'ms'); tmo++; q++; continue; }
      const doWrong = (q===1);
      const c = await fe((w)=>{ const bs=[...document.querySelectorAll('#bbArea .bubble')].filter(b=>!b.dataset.done && (w? b.dataset.en!==bubbleTarget.en : b.dataset.en===bubbleTarget.en)); for(const b of bs){ const r=b.getBoundingClientRect(); const x=r.left+r.width/2,y=r.top+r.height/2; const hit=document.elementFromPoint(x,y); if(hit&&(hit===b||b.contains(hit))) return {x,y}; } return bs.length?{blocked:true, n:bs.length, hit: (()=>{const r=bs[0].getBoundingClientRect(); const h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return h&&(h.className||h.tagName);})()}:null; }, doWrong);
      if(!c){ note(g,'bubble: target bubble missing '+st.en); break; }
      if(c.blocked){ note(g,'bubble: target bubble covered by '+c.hit); await sleep(500); continue; }
      await page.touchscreen.tap(c.x, c.y);
      const adv = await waitFor((s)=> !bubbleActive || bubbleDone!==s.done || bubbleLives!==s.lives, {arg:st, timeout:3000, interval:80});
      if(!adv){ note(g,'bubble tap did not register'); continue; }
      doWrong?wrong++:right++; q++;
    }
    const res = await waitFor(()=>!document.getElementById('bbArea') ? document.getElementById('bubbleContent').innerText : null, {timeout:4000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q,right,wrong,tmo};
    await shot('bubble_result');
    await tapBack('bubbleScreen');
  });

  // ---------- SPEED ----------
  await game('speed', async g=>{
    const t = await tapCard('startSpeed()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#speedContent [onclick^="startSpeedLevel"]').length===3);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#speedContent [onclick^="startSpeedLevel"]')].map(e=>e.innerText.replace(/\s+/g,' ')));
    await tapSel(F, ()=>{ return document.querySelector('#speedContent [onclick="startSpeedLevel(\'easy\')"]'); });
    let q=0, right=0, wrong=0; const t0=now();
    while(now()-t0<75000){
      const st = await waitFor(()=> (spActive && document.querySelector('#spOpts .boss-opt') && !document.getElementById('spOpts').dataset.done) ? {c:window._spCorrect, t:spTime} : (!spActive ? 'DONE':null), {timeout:3000, interval:60});
      if(st==='DONE') break;
      if(!st){ note(g,'speed: stuck q='+q); break; }
      if(q===0){ R.games[g].overflow = await overflowCheck('#speedScreen'); await shot('speed_q'); }
      const doWrong = (q%6===2);
      const idx = await fe((w)=>{ const i=window._spOpts.findIndex(o=>o.en===window._spCorrect); return w?(i+1)%window._spOpts.length:i; }, doWrong);
      const r = await tapSel(F, (i)=>{ return document.querySelectorAll('#spOpts .boss-opt')[i]; }, idx, {scroll:false});
      if(!r.ok){ note(g,'speed opt tap blocked '+r.hit); await sleep(300); continue; }
      doWrong?wrong++:right++; q++;
      await sleep(250);
    }
    const res = await waitFor(()=>/时间到/.test((document.getElementById('speedContent')||{}).innerText||'') ? document.getElementById('speedContent').innerText : null, {timeout:5000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q,right,wrong, secs: Math.round((now()-t0)/1000)};
    await shot('speed_result');
    await tapBack('speedScreen');
  });

  // ---------- EAGLE ----------
  await game('eagle', async g=>{
    const t = await tapCard('startEagle()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    await waitFor(()=>document.querySelectorAll('#eagleContent [onclick^="startEagleLevel"]').length>=1);
    R.games[g].levelText = await fe(()=>[...document.querySelectorAll('#eagleContent > div > div')].map(e=>e.innerText.replace(/\s+/g,' ')));
    { const __lv = await pickLevel('eagleContent','startEagleLevel', g); R.games[g].level=__lv; await tapSel(F, (l)=>{ return document.querySelector('#eagleContent [onclick="startEagleLevel(\''+l+'\')"]'); }, __lv); }
    let q=0, right=0, wrong=0, tmo=0;
    while(q<80){
      const st = await waitFor(()=> (eagleActive && eagleTarget && document.querySelector('#eagleGrid .eagle-cell') && !document.querySelector('#eagleGrid .eagle-cell[data-done]')) ? {en:eagleTarget.en, round:eagleRound, cells:[...document.querySelectorAll('#eagleGrid .eagle-cell')].map(c=>c.textContent)} : (!eagleActive && !document.getElementById('eagleGrid') ? 'DONE':null), {timeout:6000});
      if(st==='DONE') break;
      if(!st){ note(g,'eagle: no round q='+q); break; }
      const dupTarget = st.cells.filter(c=>c===st.en).length; if(dupTarget!==1) note(g,'eagle: target appears '+dupTarget+' times '+st.en+' cells='+st.cells.join('|'));
      const dupCells = st.cells.length!==new Set(st.cells.map(c=>c.toLowerCase())).size; if(dupCells) note(g,'eagle: duplicate option texts '+st.cells.join('|'));
      if(q===0){ R.games[g].overflow = await overflowCheck('#eagleScreen'); await shot('eagle_q'); }
      if(q===2){ const t1=now(); await waitFor((r)=>eagleRound!==r || !eagleActive, {arg:st.round, timeout:16000, interval:200}); note(g,'timeout advanced after '+(now()-t1)+'ms'); tmo++; q++; continue; }
      const doWrong = (q===1);
      const idx = st.cells.findIndex(c=> doWrong ? c!==st.en : c===st.en);
      const r = await tapSel(F, (i)=>{ return document.querySelectorAll('#eagleGrid .eagle-cell')[i]; }, idx, {scroll:q===0});
      if(!r.ok){ note(g,'eagle tap blocked '+r.hit); break; }
      doWrong?wrong++:right++;
      const adv = await waitFor((rd)=>eagleRound!==rd || !eagleActive, {arg:st.round, timeout:4000});
      if(!adv){ note(g,'eagle did not advance'); break; }
      q++;
    }
    const res = await waitFor(()=>!document.getElementById('eagleGrid') ? document.getElementById('eagleContent').innerText : null, {timeout:3000});
    R.games[g].result = (res||'NO RESULT').replace(/\s+/g,' ').slice(0,300);
    R.games[g].played = {q,right,wrong,tmo};
    await shot('eagle_result');
    await tapBack('eagleScreen');
  });

  // ---------- GACHA ----------
  await game('gacha', async g=>{
    const t = await tapCard('HansenContextGacha.open()'); if(!t.ok){ note(g,'card tap failed '+JSON.stringify(t)); return; }
    const on = await waitFor(()=>document.querySelector('#gachaScreen.active') ? document.getElementById('gachaScreen').innerText : null, {timeout:3000});
    R.games[g].text = (on||'NOT OPEN').replace(/\s+/g,' ').slice(0,300);
    R.games[g].overflow = await overflowCheck('#gachaScreen');
    await shot('gacha');
    const r = await tapSel(F, ()=>{ return document.querySelector('#gachaScreen .gacha-draw-btn'); });
    await sleep(800);
    R.games[g].afterDraw = await fe(()=>({toast:[...document.querySelectorAll('.float-text,.hsn-toast,[class*=toast]')].map(e=>e.innerText).filter(Boolean).slice(0,3), coins: window.HansenCoins?HansenCoins.get():null, overlays:[...document.querySelectorAll('body > div')].filter(d=>{const s=getComputedStyle(d);return s.position==='fixed'&&s.display!=='none'&&d.getBoundingClientRect().height>400;}).map(d=>d.id||d.className).slice(0,5)}));
    await shot('gacha_draw');
    const lg = await fe(()=>{ const e=document.getElementById('landGachaScreen'); return !!e && e.style.display!=='none'; });
    if(lg){ const b = await tapSel(F, ()=>document.querySelector('#landGachaScreen [onclick="window.HansenLandGachaUI.close()"]'), null, {scroll:false}); note(g,'land gacha back tap ok='+b.ok); await sleep(400); }
    else await tapBack('gachaScreen');
  });

  R.ext = [...new Set(ext.map(u=>{ try{ const x=new URL(u); return x.host+x.pathname.slice(0,40);}catch(e){return u;} }))].slice(0,40);
  R.extCount = ext.length;
  R.allEvents = events.filter(e=>!/^.*:(explore|listen|match|typing|cloze|scramble|spellbee|pk|moles|fish|bubble|speed|eagle|gacha)/.test(e.tag));
  R.end = await fe(()=>({coins: window.HansenCoins?HansenCoins.get():null, xp:S.totalXP, answers:S.totalAnswers, learned:S.learned.length}));
  await ctx.close();
  return R;
}

const results = [];
for(const k of ISL){
  const t=now();
  let r; try{ r = await runIsland(k); }catch(e){ r={island:k, fatal:String(e.stack||e).slice(0,500)}; }
  r.totalMs = now()-t;
  results.push(r);
  fs.writeFileSync(`${OUT}/res_${k}_${W}${OPT.tagSuffix||''}.json`, JSON.stringify(r,null,1));
  console.log('DONE', k, Math.round(r.totalMs/1000)+'s', Object.entries(r.games||{}).map(([g,v])=>g+':'+(v.notes||[]).length+'n/'+(v.events||[]).length+'e').join(' '));
}
await browser.close(); srv.close();
process.exit(0);
