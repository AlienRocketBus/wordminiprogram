import { launch, sleep, BASE, O } from './lib.mjs';
const theme = process.argv[2] || 'light';
const { browser, ctx } = await launch({ init: () => { try { if(!sessionStorage.getItem('x')){localStorage.clear();localStorage.setItem('hansen_onboarded','1');if(location.search.includes('light'))localStorage.setItem('hansen_palette_global','cloud');sessionStorage.setItem('x','1');} } catch(e){} } });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + 'island_animal.html' + (theme==='light'?'?light':'')); await sleep(2500);
await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try{closeAlert()}catch(e){}
  markAnswer(3,false); markAnswer(3,true);   // plan-only
  const d=new Date(); const y=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  HansenCanonical.setCurrentSrs(3,{box:1,due:y,last:''}); S.srs[3]={box:1,due:y,last:''};
  markAnswer(5,false); if(window.__hsnSaveNow)__hsnSaveNow();
  HansenWrongOverview.open(); await sleep(600);
});
await page.screenshot({ path: `${O}/shots/overview_${theme}.png` });
await page.evaluate(async () => { document.getElementById('hwo_overlay').remove(); startListen(); startListenLevel('easy'); await new Promise(r=>setTimeout(r,400)); const wi=listenQ.opts.findIndex(o=>o.cn!==listenQ.word.cn); document.querySelectorAll('#listenScreen .boss-opt')[wi].click(); });
await sleep(700);
await page.screenshot({ path: `${O}/shots/lesson_listen_${theme}.png` });
console.log('errs', errs);
await browser.close();
