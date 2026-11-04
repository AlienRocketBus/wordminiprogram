import { startServer, launch, newCtx, attach, sleep, tap, byText, waitFor, OUT } from './lib.mjs';
import { homeReady, getFrame, closeWelcome } from './nav.mjs';
const {srv, port} = await startServer();
const browser = await launch();
try{
  for(const key of ['time','land3']){
    const {ctx} = await newCtx(browser, port, {width:390});
    const page = await ctx.newPage();
    await homeReady(page, port);
    console.log('home keys', await page.evaluate(()=>({fp:localStorage.getItem('hansen_freepass_until'), ver:localStorage.getItem('hansen_freepass_ver'), temp:localStorage.getItem('hansen_card_temp_unlock_until')})));
    await page.evaluate(k=>openIsland('island_'+k+'.html'), key);
    const F = await getFrame(page, new RegExp('/island_'+key+'\\.html'), ()=>typeof allW!=='undefined', 20000);
    for(const t of [100, 1500, 4000]){
      await sleep(t);
      console.log(key, t, await F.evaluate(()=>({fp:localStorage.getItem('hansen_freepass_until'), ver:localStorage.getItem('hansen_freepass_ver'), temp:localStorage.getItem('hansen_card_temp_unlock_until'), active: !!(window.HansenFreepass&&HansenFreepass.active()), now:Date.now()})));
    }
    await page.close(); await ctx.close();
  }
}finally{ await browser.close(); srv.close(); }
