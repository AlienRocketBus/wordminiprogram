#!/usr/bin/env node
// v946 HF2 网络发布阻断回归：land_map 单例、弱网零后台媒体、SW 原子安装/导航超时。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';
/* v963 dyn */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
const season=read('hansen_season.js');
const cards=read('hansen_cards.js');
const preload=read('hansen_preload.js');
const template=read('template.html');
const sw=read('sw_v944.js');

// 静态合约：修复必须落在正式生成源，不是只补一座岛的产物。
assert.match(season,/__hansenLandMapWarmAttempted/,'land_map 预热必须全页单例');
assert.match(season,/if\(!userIntent && !canAutoWarmLandMap\(\)\) return null/,'自动预热必须经快网门禁');
assert.equal((season.match(/fetch\('land_map\.html'/g)||[]).length,1,'land_map 只能有一个受控预热出口');
assert.doesNotMatch(season,/buildProgressBar[\s\S]{0,2500}requestIdleCallback\|\|function\(f\)/,
  '旧的轮询重复 idle fetch 不得回潮');
for(const [name,source] of [['hansen_cards.js',cards],['hansen_preload.js',preload]]){
  assert.match(source,/saveData/); // 确保对正式运行时文件做检查，不是空 fixture。
  assert.match(source,/effectiveType\s*===?\s*'4g'|t\s*!==\s*'4g'/,`${name}: 只能明确 4G 后台下载`);
  assert.match(source,/saveData/,`${name}: 必须尊重 Save-Data`);
  assert.match(source,/visibilityState/,`${name}: 必须尊重页面可见性`);
  assert.match(source,/visibilitychange/,`${name}: 条件改善后必须事件驱动恢复`);
}
assert.doesNotMatch(preload,/setTimeout\(function\(\)\{\s*pumpTimer\s*=\s*null;\s*pump\(\);\s*\},\s*1000\)/,
  '弱网/后台不得永久每秒轮询，应等待可见性或网络 change 事件');
assert.match(template,/function canBackgroundBossPrefetch\(/,'Boss 引擎预取门禁必须在 template 源');
assert.match(template,/__hansenBossFXPrefetched/,'Boss 引擎与特效图预取必须单例');
assert.match(sw,/CACHE_PREFIX \+ 'shell-140'/,'v960 必须使用当前外壳缓存隔离旧运行时与夜罗刹特效');
assert.match(sw,/await cache\.addAll\(/,'核心 shell 必须整批原子写入');
assert.doesNotMatch(sw,/Promise\.allSettled\(SHELL/,'半包 shell 不得被激活');
assert.match(sw,/const NAVIGATION_TIMEOUT_MS = 3000/,'导航网络优先必须有硬超时');
assert.match(sw,/const COLD_NAVIGATION_TIMEOUT_MS = 12000/,'从未缓存的冷页面必须有更宽容的首访窗口');
assert.match(sw,/controller\.abort\(\)/,'超时后必须终止在途导航');
assert.match(sw,/await response\.arrayBuffer\(\)/,'导航超时必须覆盖正文，不只覆盖响应头');
const navCatch=sw.slice(sw.indexOf("if (request.mode === 'navigate')"),sw.indexOf('const isCode'));
assert.doesNotMatch(navCatch,/caches\.match\('\.\/index\.html'/,'未缓存的岛不得偷偷显示首页');
assert.match(navCatch,/offlineNavigationResponse\(\)/,'未缓存的岛必须显示明确离线说明');

function workerHarness({installFails=false,cached=null,source=sw,fetchImpl,cachePutFails=false,matchImpl}={}){
  const listeners={};let waited=null,responded=null,skipCount=0;
  const cache={
    async addAll(){if(installFails)throw new Error('one required shell file failed');},
    async keys(){return[];},async delete(){return true;},async put(){if(cachePutFails)throw new Error('quota exceeded');}
  };
  const caches={
    async open(){return cache;},async keys(){return[];},async delete(){return true;},
    async match(request,options){return matchImpl?matchImpl(request,options):cached;}
  };
  class FakeRequest{constructor(url,options={}){this.url=new URL(url,'https://app.test/').href;Object.assign(this,options);}}
  const self={
    location:{origin:'https://app.test',href:'https://app.test/sw_v944.js',pathname:'/sw_v944.js'},registration:{scope:'https://app.test/'},clients:{async claim(){}},
    addEventListener(type,fn){listeners[type]=fn;},async skipWaiting(){skipCount++;}
  };
  const context={self,caches,Request:FakeRequest,Response,ReadableStream,URL,Set,Promise,AbortController,
    setTimeout,clearTimeout,fetch:fetchImpl||(()=>Promise.reject(new Error('offline')))};
  vm.createContext(context);vm.runInContext(source,context,{filename:'sw_v944.js'});
  return {
    listeners,get skipCount(){return skipCount;},
    install(){listeners.install({waitUntil(p){waited=p;}});return waited;},
    fetch(request){listeners.fetch({request,respondWith(p){responded=p;},waitUntil(){}});return responded;}
  };
}

// 任意一个必需 shell 失败：install 必须失败，且绝不 skipWaiting/激活。
{
  const h=workerHarness({installFails:true});
  await assert.rejects(h.install(),/required shell file failed/);
  assert.equal(h.skipCount,0,'半包 worker 不得 skipWaiting');
}
{
  const h=workerHarness();await h.install();assert.equal(h.skipCount,1,'整包成功后才允许激活');
}

// 用缩短超时的同源 worker 做行为验证：网络卡住后必须中止并返回当前 URL 的缓存。
{
  const cachedResponse=new Response('cached island',{status:200,headers:{'content-type':'text/html'}});
  const testSource=sw.replace('const NAVIGATION_TIMEOUT_MS = 3000;','const NAVIGATION_TIMEOUT_MS = 25;');
  let aborted=false;
  const h=workerHarness({cached:cachedResponse,source:testSource,fetchImpl:(_request,{signal}={})=>new Promise((_ok,fail)=>{
    signal.addEventListener('abort',()=>{aborted=true;fail(new Error('aborted'));},{once:true});
  })});
  const started=Date.now();
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/island_animal.html'});
  assert.equal(await response.text(),'cached island');assert.equal(aborted,true);
  assert(Date.now()-started<300,'慢网应快速回退当前页缓存');
}
{
  const h=workerHarness({cached:null});
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/island_animal.html'});
  assert.equal(response.status,503);assert.match(await response.text(),/当前页面尚未下载/);
}

// 根路径只允许回退预缓存 index；其它未缓存岛仍不得首页冒充。
{
  const indexResponse=new Response('offline home',{status:200,headers:{'content-type':'text/html'}});
  const h=workerHarness({matchImpl:request=>String(request&&request.url||request).endsWith('/index.html')?indexResponse.clone():null});
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/'});
  assert.equal(await response.text(),'offline home','部署根路径离线必须能打开预缓存首页');
}

// Cache Storage 配额失败只是旁路失败：已成功的导航和脚本网络响应必须原样返回。
{
  const h=workerHarness({cachePutFails:true,fetchImpl:()=>Promise.resolve(new Response('fresh page',{status:200,headers:{'content-type':'text/html'}}))});
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/island_animal.html'});
  assert.equal(response.status,200);assert.equal(await response.text(),'fresh page');
}
{
  const h=workerHarness({cachePutFails:true,fetchImpl:()=>Promise.resolve(new Response('window.fresh=1',{status:200,headers:{'content-type':'text/javascript'}}))});
  const response=await h.fetch({method:'GET',mode:'cors',url:'https://app.test/hansen_cards.js?v='+__APPV__});
  assert.equal(response.status,200);assert.equal(await response.text(),'window.fresh=1');
}

// 响应头立即到达但正文挂住：有当前页缓存时仍须在短上限内中止正文并回退。
{
  const cachedResponse=new Response('cached after body stall',{status:200});
  const testSource=sw.replace('const NAVIGATION_TIMEOUT_MS = 3000;','const NAVIGATION_TIMEOUT_MS = 25;');
  let aborted=false;
  const h=workerHarness({cached:cachedResponse,source:testSource,fetchImpl:(_request,{signal}={})=>Promise.resolve(new Response(new ReadableStream({
    start(controller){signal.addEventListener('abort',()=>{aborted=true;controller.error(new Error('body aborted'));},{once:true});}
  }),{status:200}))});
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/island_animal.html'});
  assert.equal(await response.text(),'cached after body stall');assert.equal(aborted,true);
}

// 冷页没有缓存时不套用 3 秒短门：模拟 3.1 秒相对于短门、但仍在冷启动上限内的成功响应。
{
  const testSource=sw.replace('const NAVIGATION_TIMEOUT_MS = 3000;','const NAVIGATION_TIMEOUT_MS = 25;')
    .replace('const COLD_NAVIGATION_TIMEOUT_MS = 12000;','const COLD_NAVIGATION_TIMEOUT_MS = 120;');
  const h=workerHarness({cached:null,source:testSource,fetchImpl:()=>new Promise(ok=>setTimeout(()=>ok(new Response('slow cold success',{status:200})),40))});
  const response=await h.fetch({method:'GET',mode:'navigate',url:'https://app.test/island_new.html'});
  assert.equal(response.status,200);assert.equal(await response.text(),'slow cold success');
}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg',
  '.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
let server=null,browser=null;
const listen=s=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(0,'127.0.0.1',ok);});
const closeServer=s=>new Promise(ok=>{if(!s||!s.listening)return ok();s.close(()=>ok());try{s.closeAllConnections?.();}catch(_){}});

async function browserChecks(){
  server=http.createServer((request,response)=>{
    try{
      const url=new URL(request.url,'http://127.0.0.1');
      if(url.pathname==='/_hf2_cards_probe.html'){
        response.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
        response.end('<!doctype html><meta charset="utf-8"><script>window.allW=[{en:"alpha",ex:"Alpha example."}];'+
          'window.SENTENCE_MAP={"Alpha example.":1};window.showScreen=function(){};window.bossVictory=function(){};<\/script>'+
          '<script src="hansen_preload.js?v="+__APPV__><\/script><script src="hansen_cards.js?v="+__APPV__><\/script>');
        return;
      }
      const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/,''),file=path.resolve(ROOT,rel);
      if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
      response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      fs.createReadStream(file).pipe(response);
    }catch(e){response.writeHead(404).end('not found');}
  });
  await listen(server);const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});

  // 真实首页跑过原 bug 的完整 100 次轮询窗口，30 秒内 land_map 后台请求不得超过 1。
  {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.addInitScript(()=>{
      try{Object.defineProperty(navigator,'connection',{configurable:true,get:()=>({saveData:false,effectiveType:'4g'})});}catch(_){ }
      localStorage.setItem('hansen_onboarded','1');localStorage.setItem('hsnViewMode','desktop');
    });
    const page=await context.newPage();const hits=[];
    page.on('request',request=>{if(/\/land_map\.html(?:[?#]|$)/.test(request.url()))hits.push(request.url());});
    await page.goto(origin+'/index.html',{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(30_000);
    assert(hits.length<=1,`30s land_map 预热必须 <=1，实际 ${hits.length}`);
    await context.close();
  }

  // 真实 Chromium + 3G/Save-Data：卡牌 Boss 图、例句音频、Boss 引擎/特效图后台请求必须为 0。
  {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.addInitScript(()=>{
      try{Object.defineProperty(navigator,'connection',{configurable:true,get:()=>({saveData:true,effectiveType:'3g'})});}catch(_){ }
    });
    const page=await context.newPage();const media=[];
    page.on('request',request=>{
      const u=request.url();
      if(/\/(?:bosses|bosses_bg|bossfx|sentences|newboss)\/|\/hansen_boss_attack\.js/.test(u))media.push(u);
    });
    await page.goto(origin+'/_hf2_cards_probe.html',{waitUntil:'load'});
    await page.waitForTimeout(5_000);
    assert.deepEqual(media,[],'3G/Save-Data 不得发起任何可选后台 Boss/例句媒体请求');
    await context.close();
  }
}

try{
  await browserChecks();
  console.log('✅ v951 网络阻断：land_map 30s≤1、3G/Save-Data 后台媒体0、SW半包不激活/慢网快速回退');
}finally{
  if(browser)await browser.close().catch(()=>{});
  await closeServer(server);
}
