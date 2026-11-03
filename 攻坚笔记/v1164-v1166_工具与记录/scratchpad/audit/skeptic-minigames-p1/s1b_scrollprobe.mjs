// Probe which synthetic gesture actually scrolls the island iframe (to validate the 'cannot scroll' check)
import {startServer, launch, phoneCtx, watch, tap, waitIn, openIsland, tapCard, sleep, OUT} from './lib.mjs';
const {srv, port} = await startServer();
const browser = await launch();
const {ctx} = await phoneCtx(browser, port, {init:()=>{ try{localStorage.setItem('hansen_onboarded','1')}catch(e){} }});
const page = await ctx.newPage(); const ev=[]; watch(page, ev);
const F = await openIsland(page, port, 'school');
const cdp = await ctx.newCDPSession(page);
async function swipe(label){
  const y0 = await F.evaluate(()=>scrollY);
  // manual touch sequence via CDP
  const pts = [700,650,600,550,500,450,400,350,300,250];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:pts[0]}]});
  for(const y of pts.slice(1)){ await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y}]}); await sleep(16); }
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await sleep(900);
  const y1 = await F.evaluate(()=>scrollY);
  console.log(label, 'manual touch swipe scrollY', y0, '->', y1);
  return [y0,y1];
}
await swipe('home normal');
await F.evaluate(()=>scrollTo(0,0)); await sleep(200);
await swipe('home normal from 0');
// now lock the body like nextTypeQ does, while on home
await F.evaluate(()=>{ scrollTo(0,0); document.body.classList.add('type-lock'); });
await sleep(200);
await swipe('home with type-lock');
await ctx.close(); await browser.close(); srv.close(); process.exit(0);
