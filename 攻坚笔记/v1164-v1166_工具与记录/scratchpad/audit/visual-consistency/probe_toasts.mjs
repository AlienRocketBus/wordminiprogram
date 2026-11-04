import { startServer, launch, newCtx, attachLogs, sleep, OUT } from './lib.mjs';
import { seed, shot, openIsland, dismissWelcome } from './lib2.mjs';
import fs from 'node:fs';
const { srv, base } = await startServer();
const browser = await launch();
const errs=[]; const out={};
const ctx = await newCtx(browser,{dsf:2});
await seed(ctx, {});
const page = await ctx.newPage(); attachLogs(page,'top',errs);
await page.goto(base+'/index.html',{waitUntil:'load'}); await sleep(1500);
const fr = await openIsland(page,'island_animal.html'); await dismissWelcome(page,fr); await sleep(500);
// 1) template showToast (floatText) with a real long message used in code
await fr.evaluate(()=>showToast('⚠️ 签到账本尚未加载，本次未扣/发任何奖励，请稍后重试'));
await sleep(250);
out.floatRect = await fr.evaluate(()=>{ const e=document.querySelector('.float-text'); if(!e) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),vw:innerWidth}; });
await shot(page,'t1_template_showToast_250ms');
await sleep(700); await shot(page,'t1_template_showToast_950ms');
await sleep(1200);
// 2) HansenToast.say
await fr.evaluate(()=>HansenToast.say('这是统一提示 HansenToast.say：从底部浮上来'));
await sleep(500); await shot(page,'t2_HansenToast_say');
out.hansenToastRect = await fr.evaluate(()=>{ const h=document.getElementById('hsnToastHost'); const e=h&&h.lastElementChild; if(!e) return null; const r=e.getBoundingClientRect(); return {l:Math.round(r.left),r:Math.round(r.right),t:Math.round(r.top),b:Math.round(r.bottom)}; });
await sleep(3500);
// 3) gacha toast (diamond-shop-like): open gacha and trigger "not enough coins"
await fr.evaluate(()=>HansenContextGacha.open()); await sleep(1500);
const b = await fr.evaluate(()=>{ const e=document.querySelector('.gacha-draw-btn'); const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
const off = await page.evaluate(()=>{const r=document.getElementById('islandFrame').getBoundingClientRect(); return {x:r.left,y:r.top};});
await page.touchscreen.tap(b.x+off.x,b.y+off.y); await sleep(500);
out.gachaToast = await fr.evaluate(()=>{ const e=document.querySelector('.gacha-toast'); if(!e) return null; const r=e.getBoundingClientRect(); return {t:Math.round(r.top),b:Math.round(r.bottom),txt:e.innerText}; });
await shot(page,'t3_gacha_toast');
await sleep(2500);
// 4) review full-screen toast: open review center and trigger 暂无单词 path if available via HansenReview internal? use the global-scope wrapper if exposed
out.reviewToastExposed = await fr.evaluate(()=>!!(window.HansenReview && Object.keys(window.HansenReview)));
fs.writeFileSync(OUT+'/toasts.json', JSON.stringify({out,errs},null,1));
console.log(JSON.stringify(out,null,1), errs);
await browser.close(); srv.close();
