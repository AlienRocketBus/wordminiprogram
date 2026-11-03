// MG-16 quick check: typing keyboard bottom vs viewport at 360x640 (高级)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
const island = process.argv[2]||'question';
const {srv, port} = await startServer();
const browser = await launch();
for(const [w,h] of [[360,640],[390,844]]){
  const {ctx} = await phoneCtx(browser, port, {w,h,init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
  const page = await ctx.newPage();
  const F = await openIsland(page, port, island);
  await tapCard(page, F, /^showTypingMenu/);
  await waitIn(F, ()=>document.querySelector('#typingContent [onclick="startTyping(3)"]')); await sleep(300);
  await tap(page, F, ()=>document.querySelector('#typingContent [onclick="startTyping(3)"]'));
  await waitIn(F, ()=>document.querySelector('.keyboard .key')); await sleep(800);
  const r = await F.evaluate(()=>{ const k=document.querySelector('.keyboard').getBoundingClientRect(); const keys=[...document.querySelectorAll('.keyboard .key')].map(e=>e.getBoundingClientRect()); const slots=[...document.querySelectorAll('.typing-slot')].map(e=>Math.round(e.getBoundingClientRect().width)); return {vh:innerHeight, kbTop:Math.round(k.top), kbBottom:Math.round(k.bottom), lowestKeyBottom:Math.round(Math.max(...keys.map(x=>x.bottom))), lock:document.body.classList.contains('type-lock'), word:typeWord.en, minSlotW:Math.min(...slots)}; });
  await page.screenshot({path:`${OUT}/shots_s16_typing_${w}.png`});
  console.log(w+'x'+h, JSON.stringify(r));
  await ctx.close();
}
await browser.close(); srv.close(); process.exit(0);
