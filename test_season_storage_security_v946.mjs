#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright_loader.mjs';
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.join(ROOT,'hansen_season.js'),'utf8');

assert.match(source,/var SEASON_BY_ID\s*=\s*Object\.create\(null\)/,'season ids need a static lookup whitelist');
assert.match(source,/MAX_SEASON_POINTS\s*=\s*1000000/,'legacy season points need a hard numeric ceiling');
assert.match(source,/JSON\.stringify\(normalize\(d\)\)/,'season writes must pass through the same normalizer');
assert.match(source,/formPng:forms\[formIdx\],\s*bgCss:BGS\[bgIdx\]/,'display paths and CSS must be rebuilt from static tables');
assert.doesNotMatch(source,/return\s+\(p&&typeof p===['"]object['"]\)\?p/,'raw showcase preferences must never be returned');

const fixture=`<!doctype html><html><head><meta charset="utf-8"><title>season security</title></head><body>
  <main><div class="util-card">工具</div><div class="islands">岛屿</div></main>
  <script>window.bossVictory=function(){};</script>
  <script src="/hansen_season.js"></script>
</body></html>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png'};
const server=http.createServer((request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    if(pathname==='/season-security-fixture.html'){
      response.writeHead(200,{'content-type':mime['.html'],'cache-control':'no-store'}).end(fixture);
      return;
    }
    const file=path.resolve(ROOT,pathname.replace(/^\/+/,''));
    if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
    response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
    fs.createReadStream(file).pipe(response);
  }catch(error){response.writeHead(404).end('not found');}
});
const listen=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const closeServer=()=>new Promise(resolve=>server.close(()=>resolve()));
let browser=null;

try{
  await listen();
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    // Keep this v946 regression inside the configured S1 interval on every CI machine.
    const NativeDate=Date;
    const fixed=NativeDate.parse('2026-07-16T12:00:00Z');
    class FixedDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[fixed]));}
      static now(){return fixed;}
    }
    window.Date=FixedDate;
    if (window.top === window) localStorage.clear();sessionStorage.clear();
    window.__seasonSecuritySentinel=0;
    const pointsPayload='<img data-season-points src=x onerror="window.__seasonSecuritySentinel++">';
    localStorage.setItem('hansen_season_data',JSON.stringify({
      points:{S1:pointsPayload,UNKNOWN:999999},
      unlockedCards:['S1','S1','S1B1','S1B1','UNKNOWN',7,null],
      claimedMilestones:{
        S1:[200,200,500,-1,200.5,1000001,'1000','<img data-season-milestone src=x onerror="window.__seasonSecuritySentinel++">'],
        UNKNOWN:[200],
      },
      attacker:'<svg onload="window.__seasonSecuritySentinel++"></svg>',
    }));
    localStorage.setItem('hs_showcase_S1',JSON.stringify({
      formIdx:1,
      bgIdx:3,
      formPng:'x" onerror="window.__seasonSecuritySentinel++" data-season-form="1',
      bgCss:'red"></div><img data-season-bg src=x onerror="window.__seasonSecuritySentinel++"><div style="background:blue',
    }));
  });

  const page=await context.newPage(),pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  await page.goto(`${origin}/season-security-fixture.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.HansenSeason&&typeof window.__hsnOpenSeason==='function'&&typeof window.__hsnOpenHall==='function');

  const normalized=await page.evaluate(()=>window.HansenSeason.data());
  assert.deepEqual(normalized,{
    points:{S1:0},
    unlockedCards:['S1','S1B1'],
    claimedMilestones:{S1:[200,500]},
  },'backup season data must retain only bounded, deduplicated, statically known values');

  await page.evaluate(()=>{window.__hsnOpenSeason();window.__hsnOpenHall();});
  await page.waitForTimeout(120);
  const rendered=await page.evaluate(()=>{
    const panel=document.getElementById('__hs_season_panel');
    const hall=document.getElementById('__hs_hall_panel');
    const panelThumb=panel?.querySelector('.__hs_panel_thumb');
    const hallThumb=hall?.querySelector('.__hs_thumb_box');
    return {
      sentinel:window.__seasonSecuritySentinel,
      evilNodes:document.querySelectorAll('[data-season-points],[data-season-milestone],[data-season-form],[data-season-bg],#__hs_season_panel script,#__hs_hall_panel script,#__hs_season_panel svg,#__hs_hall_panel svg').length,
      panelImg:panelThumb?.querySelector('img')?.getAttribute('src')||'',
      hallImg:hallThumb?.querySelector('img')?.getAttribute('src')||'',
      panelBg:panelThumb?.getAttribute('style')||'',
      hallBg:hallThumb?.getAttribute('style')||'',
      panelHtml:panel?.innerHTML||'',
      hallHtml:hall?.innerHTML||'',
      panelText:panel?.textContent||'',
    };
  });
  assert.equal(rendered.sentinel,0,'stored season/showcase markup must never execute');
  assert.equal(rendered.evilNodes,0,'stored season/showcase strings must not create HTML, SVG, or script nodes');
  assert.equal(rendered.panelImg,'bosses/saelya2.webp?v='+__APPV__,'valid formIdx must select the second static form in the season panel');
  assert.equal(rendered.hallImg,'bosses/saelya2.webp?v='+__APPV__,'valid formIdx must select the second static form in the hall');
  assert(rendered.panelBg.includes('linear-gradient(165deg'),'valid bgIdx must select the fourth static background in the season panel');
  assert(rendered.hallBg.includes('linear-gradient(165deg'),'valid bgIdx must select the fourth static background in the hall');
  assert(!rendered.panelHtml.includes('__seasonSecuritySentinel')&&!rendered.hallHtml.includes('__seasonSecuritySentinel'),'derived stored path/CSS strings must be ignored, not escaped into the DOM');
  assert.match(rendered.panelText,/历史赛季积分（只读）\s*0/,'invalid point markup must render as numeric zero');

  const pointCases=await page.evaluate(()=>{
    const values=[0,1000000,-1,1.5,1000001,'5','<img src=x onerror="window.__seasonSecuritySentinel++">'];
    return values.map(value=>{
      localStorage.setItem('hansen_season_data',JSON.stringify({points:{S1:value,UNKNOWN:42},unlockedCards:[],claimedMilestones:{}}));
      const d=window.HansenSeason.data();
      return {input:value,point:d.points.S1,keys:Object.keys(d.points)};
    });
  });
  assert.deepEqual(pointCases.map(item=>item.point),[0,1000000,0,0,0,0,0],'only exact integer points from 0 through 1,000,000 are valid');
  assert(pointCases.every(item=>item.keys.length===1&&item.keys[0]==='S1'),'unknown season point ids must always be removed');

  const invalidPrefs=await page.evaluate(()=>{
    const cases=[[-1,-1],[1.5,2.5],[3,8],['1','3']];
    return cases.map(([formIdx,bgIdx])=>{
      document.getElementById('__hs_season_panel')?.remove();
      localStorage.setItem('hansen_season_data',JSON.stringify({points:{S1:0},unlockedCards:['S1'],claimedMilestones:{}}));
      localStorage.setItem('hs_showcase_S1',JSON.stringify({formIdx,bgIdx,formPng:'evil',bgCss:'evil'}));
      window.__hsnOpenSeason();
      const thumb=document.querySelector('#__hs_season_panel .__hs_panel_thumb');
      return {src:thumb?.querySelector('img')?.getAttribute('src')||'',style:thumb?.getAttribute('style')||''};
    });
  });
  assert(invalidPrefs.every(item=>item.src==='bosses/saelya.webp?v='+__APPV__),'negative, fractional, oversized, and string form indexes must use static index zero');
  assert(invalidPrefs.every(item=>item.style.includes('radial-gradient(circle at 50% 26%')),'negative, fractional, oversized, and string background indexes must use static index zero');

  const unlocks=await page.evaluate(()=>{
    localStorage.setItem('hansen_season_data',JSON.stringify({points:{S1:123},unlockedCards:['S1','S1','UNKNOWN'],claimedMilestones:{S1:[200,200]}}));
    HansenSeason.unlockCard('UNKNOWN');
    HansenSeason.unlockCard('S1B2');
    HansenSeason.unlockCard('S1B2');
    return {data:HansenSeason.data(),stored:JSON.parse(localStorage.getItem('hansen_season_data'))};
  });
  const expectedUnlocked={points:{S1:123},unlockedCards:['S1','S1B2'],claimedMilestones:{S1:[200]}};
  assert.deepEqual(unlocks.data,expectedUnlocked,'unknown unlock ids must be rejected and valid ids must remain unique');
  assert.deepEqual(unlocks.stored,expectedUnlocked,'every season write must persist only normalized data');
  assert.equal(await page.evaluate(()=>window.__seasonSecuritySentinel),0,'no delayed image/style injection may execute');
  assert.deepEqual(pageErrors,[],'season storage security regression must not cause page exceptions');

  await context.close();
  console.log('season storage security v951: whitelist + exact bounds + static showcase resources + injection regression ✅');
}finally{
  if(browser)await browser.close().catch(()=>{});
  await closeServer().catch(()=>{});
}
