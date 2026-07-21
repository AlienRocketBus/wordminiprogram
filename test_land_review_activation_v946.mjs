#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const review=fs.readFileSync(path.join(ROOT,'hansen_review.js'),'utf8');
assert.match(review,/\/island_\(\[a-z0-9\]\+\)\\\.html\/i/,'review boot matcher must accept numeric Land page names');
assert.doesNotMatch(review,/\/island_\(\[a-z\]\+\)\\\.html\/i/,'letters-only review matcher must never return');
for(let number=1;number<=8;number++){
  const html=fs.readFileSync(path.join(ROOT,`island_land${number}.html`),'utf8');
  /* 🔴v963 合同微调: 资源戳随候选版本演进(动态读VERSION)，"恰好加载一份复习运行时"的合同不变。 */
  const appStamp=fs.readFileSync(path.join(ROOT,'VERSION'),'utf8').trim();
  assert.equal((html.match(new RegExp(`src="hansen_review\\.js\\?v=${appStamp}"`,'g'))||[]).length,1,`Land${number} must load exactly one v951 review runtime`);
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer((request,response)=>{
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    const file=path.resolve(ROOT,pathname.replace(/^\/+/,''));
    if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
    response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(response);
  }catch(error){response.writeHead(404).end('not found');}
});
const listen=()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const closeServer=()=>new Promise(resolve=>server.close(()=>resolve()));
let browser=null;

try{
  await listen();const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('hsnViewMode','desktop');localStorage.setItem('hansen_onboarded','1');});
  for(let number=1;number<=8;number++){
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(`${origin}/island_land${number}.html`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.HansenReview&&typeof window.HansenReview._open==='function'&&Array.isArray(window.allW)&&window.allW.length>0);
    const state=await page.evaluate(()=>({key:window.STORAGE_KEY||'',words:window.allW.length,review:typeof window.HansenReview._open}));
    assert.equal(state.review,'function',`Land${number}: review runtime must activate`);assert(state.key,`Land${number}: storage key must be available`);assert(state.words>0,`Land${number}: vocabulary must be available`);
    await page.evaluate(()=>window.HansenReview._open());await page.waitForSelector('#hr_center');
    assert.equal(await page.locator('#hr_center .hr_title').textContent(),'🎯 复习中心',`Land${number}: review center must open`);
    await page.evaluate(()=>window.HansenReview._close());assert.equal(await page.locator('#hr_center').count(),0,`Land${number}: review center must close cleanly`);
    assert.deepEqual(errors,[],`Land${number}: no page or console errors allowed`);await page.close();
  }
  await context.close();
  console.log('Land review activation v951: Land1-Land8 boot/open/close on mobile Chromium ✅');
}finally{
  if(browser)await browser.close().catch(()=>{});await closeServer().catch(()=>{});
}
