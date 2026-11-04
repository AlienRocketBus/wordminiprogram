import {startServer, launch, newCtx, attach, sleep, OUT} from './lib.mjs';
import {tapIn, waitIn} from './h.mjs';
const key = process.argv[2]||'traffic';
const {srv, port} = await startServer();
const browser = await launch();
const INIT = () => { try{ localStorage.setItem('hansen_onboarded','1'); }catch(e){} window.addEventListener('unhandledrejection', e=>{ try{ console.error('UNHANDLED_REJECTION '+String(e.reason && (e.reason.stack||e.reason.message) || e.reason).slice(0,300)); }catch(_){} }); };
const {ctx} = await newCtx(browser, port, {init: INIT});
const page = await ctx.newPage(); const ev=[]; let tag='boot'; attach(page, ev, ()=>tag);
await page.goto(`http://127.0.0.1:${port}/index.html`); await sleep(1500);
if(/^land|season/.test(key)) await page.evaluate(k=>openIsland('island_'+k+'.html'), key); else await tapIn(page, page.mainFrame(), (k)=>document.querySelector('a[href="island_'+k+'.html"]'), key);
let F=null; for(let i=0;i<120;i++){ F=page.frames().find(f=>f.url().includes('/island_'+key+'.html')); if(F){ try{ if(await F.evaluate(()=>typeof allW!=='undefined')) break; }catch(e){} } await sleep(100); }
if(await waitIn(F, ()=>!!document.querySelector('#alertModal.show'), null, 3000)){ await sleep(900); await tapIn(page,F,()=>[...document.querySelectorAll('#alertInner button')].find(b=>/开始冒险/.test(b.innerText))); await sleep(500); }
const G = [
 ['listen','startListen()','listenContent','startListenLevel','listenScreen'],
 ['typing','showTypingMenu()','typingContent','startTyping','typingScreen'],
 ['cloze','startCloze()','clozeContent','startClozeLevel','clozeScreen'],
 ['scramble','startScramble()','scrambleContent','startScrambleLevel','scrambleScreen'],
 ['moles','startMoles()','molesContent','startMolesLevel','molesScreen'],
 ['fish','startFish()','fishContent','startFishLevel','fishScreen'],
 ['bubble','startBubble()','bubbleContent','startBubbleLevel','bubbleScreen'],
 ['speed','startSpeed()','speedContent','startSpeedLevel','speedScreen'],
 ['eagle','startEagle()','eagleContent','startEagleLevel','eagleScreen'],
];
const state = ()=>F.evaluate(()=>{ const g=n=>{ try{ return eval(n); }catch(e){ return 'n/a'; } };
  return {screen:document.querySelector('.screen.active').id, bodyCls:document.body.className, bodyPos:getComputedStyle(document.body).position,
   flags:{listen:g('listenActive'),type:g('typeActive'),sp:g('spActive'),moles:g('molesActive'),fish:g('fishActive'),bubble:g('bubbleActive'),eagle:g('eagleActive'),cloze:g('clozeActive')},
   timers:{sp:g('spTimer'),type:g('typeTimerInt'),eagle:g('eagleTimer'),bubbleCd:g('bubbleCountdownTimer'),molesWave:g('molesWaveTimer'),fishSpawn:g('fishSpawnTimer')},
   overlays:[...document.querySelectorAll('body > div, body > section')].filter(d=>{const s=getComputedStyle(d); return s.position==='fixed'&&s.display!=='none'&&s.visibility!=='hidden'&&+s.opacity>0.05&&s.pointerEvents!=='none'&&d.getBoundingClientRect().height>300;}).map(d=>d.id||String(d.className).slice(0,30)),
   answers:S.totalAnswers, xp:S.totalXP}; });
for(const [g, card, cid, fn, scr] of G){
  tag=g;
  await F.evaluate(()=>{ if(document.querySelector('.screen.active').id!=='homeScreen') showScreen('home'); });
  await tapIn(page, F, (oc)=>[...document.querySelectorAll('#homeScreen .mode-card')].find(e=>(e.getAttribute('onclick')||'')===oc), card);
  await sleep(600);
  const lvOc = await F.evaluate(([cid,fn])=>{ const e=[...document.querySelectorAll('#'+cid+' [onclick^="'+fn+'("]')]; return e.length? e[0].getAttribute('onclick') : null; }, [cid,fn]);
  if(!lvOc){ console.log(g,'no level'); continue; }
  await tapIn(page, F, (oc)=>document.querySelector('[onclick="'+oc.replace(/"/g,'\\"')+'"]'), lvOc);
  await sleep(2500);
  const mid = await state();
  // tap back mid-round
  const b = await tapIn(page, F, (s)=>document.querySelector('#'+s+' > .back-btn')||document.querySelector('#'+s+' .back-btn'), scr, {scroll:false});
  await sleep(300);
  const s0 = await state();
  await sleep(6000);   // let any stray timers fire
  const s1 = await state();
  const bad=[];
  if(s1.screen!=='homeScreen') bad.push('screen='+s1.screen);
  for(const [k,v] of Object.entries(s1.flags)) if(v===true) bad.push('flag '+k);
  for(const [k,v] of Object.entries(s1.timers)) if(v && v!=='n/a') bad.push('timer '+k+'='+v);
  if(s1.answers!==s0.answers) bad.push('answers changed after exit '+s0.answers+'->'+s1.answers);
  if(/type-lock/.test(s1.bodyCls)) bad.push('type-lock');
  if(s1.bodyPos==='fixed') bad.push('body fixed');
  if(s1.overlays.length) bad.push('overlays '+s1.overlays.join(','));
  console.log(g.padEnd(9), 'midScreen', mid.screen, 'backTap', b.ok, '=>', bad.length? 'PROBLEMS: '+bad.join(' | ') : 'clean');
}
console.log('EVENTS', JSON.stringify(ev.filter(e=>!/ERR_FAILED|__rt=/.test(e.text) && e.kind!=='requestfailed').slice(0,20)));
await browser.close(); srv.close();
