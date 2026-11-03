import { launch, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { localStorage.setItem('hansen_onboarded','1'); } catch(e){} } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page); await cdp.send('Network.enable');
cdp.on('Network.requestWillBeSent', e => { if (/bosses\/lv/.test(e.request.url)) { const i = e.initiator; const f = i.stack && i.stack.callFrames && i.stack.callFrames[0]; console.log(e.request.url.replace(BASE,''), i.type, f ? f.url.replace(BASE,'') + ':' + f.lineNumber + ' ' + f.functionName : (i.url||'')); } });
await page.goto(BASE + (process.argv[2]||'island_food.html')); await sleep(7000);
console.log(await page.evaluate(() => [window.HansenBossProgress && HansenBossProgress.getUnlockedBossLv(), window.S && S.bossUnlocked]));
await browser.close();
