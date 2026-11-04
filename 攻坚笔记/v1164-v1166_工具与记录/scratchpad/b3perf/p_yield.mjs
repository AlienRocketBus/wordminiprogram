import { launch, sleep, BASE } from './lib.mjs';
const { browser, ctx } = await launch({ init: () => { try { if (!sessionStorage.getItem('_x')) { localStorage.clear(); localStorage.setItem('hansen_onboarded','1'); localStorage.setItem('hansen_room_opened_v1165_land','1'); localStorage.setItem('hansen_room_opened_v1165_season','1'); localStorage.setItem('hsn_progress:食物大冒险', JSON.stringify({ans:5,learned:2,totalWords:40})); sessionStorage.setItem('_x','1'); } } catch(e){} } });
const page = await ctx.newPage();
await page.goto(BASE + 'island_food.html');
for (let i = 0; i < 20; i++) { await sleep(1000); console.log(i, JSON.stringify(await page.evaluate(() => ({ y: HansenPreloadPolicy.shouldYield(), can: HansenPreloadPolicy.canBackgroundDownload(), ab: Math.max(0, (window.__hansenAudioBusyUntil||0) - Date.now()), ua: Math.max(0,(window.__hansenUserActiveUntil||0)-Date.now()), ib: Math.max(0,(window.__hsnIslandBusyUntil||0)-Date.now()), rooms: window.HansenRoom && HansenRoom._rooms(), pf: window.HansenRoom && HansenRoom.prefetched() })))); }
await browser.close();
