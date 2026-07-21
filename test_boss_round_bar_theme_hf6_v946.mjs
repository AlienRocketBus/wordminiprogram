#!/usr/bin/env node
// v946 HF6: Boss 大满贯进度卡必须由 Boss 专属主题完整换面，不能再被全局亮色规则只改字不改底。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const roundSource=fs.readFileSync(path.join(ROOT,'hansen_round_bar.js'),'utf8');

// 根因守卫：这三处一旦重新使用行内色，就会再次被 hansen_palette / hansen_boss_theme
// 的 [style*=color] 规则跨主题改写。
assert.match(roundSource,/class="rb-levels rb-needed"/,'缺少本轮待打 Boss 语义类');
assert.match(roundSource,/class="rb-amount"/,'缺少 +88 钻石语义类');
assert.match(roundSource,/class="rb-round"/,'缺少轮次语义类');
assert.doesNotMatch(roundSource,/class="rb-(?:needed|amount|round)"[^>]*style=["'][^"']*color/i,
  '关键文字不得重新写行内颜色');
for(const theme of ['dark','light','cinema']){
  assert.match(roundSource,new RegExp(`html\\.hsn-bt-${theme} #['"]?\\+?BAR_ID`),
    `Round Bar 源码必须有 ${theme} 独立主题选择器`);
}

function rgb(value){
  const m=String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  assert(m,`无法解析颜色 ${value}`);
  return [+m[1],+m[2],+m[3]];
}
function luminance(value){
  return rgb(value).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function contrast(foreground,background){
  const a=luminance(foreground),b=luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
function gradientStops(value){
  return [...String(value).matchAll(/rgba?\([^)]*\)/gi)].map(match=>match[0]);
}
function assertKeyContrast(snapshot,label){
  const stops=gradientStops(snapshot.background);
  assert(stops.length>=2,`${label}: 卡面不是可核验的完整渐变 ${snapshot.background}`);
  for(const [name,item] of Object.entries(snapshot.text)){
    assert.equal(item.fill,item.color,`${label}/${name}: text-fill 覆盖了清晰字色`);
    assert(!/color\s*:/i.test(item.inline||''),`${label}/${name}: 关键文字又写了行内色`);
    for(const stop of stops){
      assert(contrast(item.color,stop)>=4.5,
        `${label}/${name}: 字色 ${item.color} 对卡面 ${stop} 仅 ${contrast(item.color,stop).toFixed(2)}:1`);
    }
  }
}

const mime={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8',
  '.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png',
  '.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2',
  '.webmanifest':'application/manifest+json'
};
let browser=null,server=null;
try{
  server=http.createServer((request,response)=>{
    try{
      const pathname=decodeURIComponent(new URL(request.url||'/','http://127.0.0.1').pathname);
      const relative=pathname==='/'?'island_animal.html':pathname.replace(/^\/+/, '');
      const target=path.resolve(ROOT,relative);
      if(!target.startsWith(ROOT+path.sep)||!fs.statSync(target).isFile())throw new Error('not found');
      response.writeHead(200,{'content-type':mime[path.extname(target).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
      fs.createReadStream(target).pipe(response);
    }catch{response.writeHead(404).end('not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({
    viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,
    deviceScaleFactor:2,serviceWorkers:'block'
  });
  await context.addInitScript(()=>{
    localStorage.clear();
    localStorage.setItem('hansen_palette_global','cloud');
    localStorage.setItem('hansen_boss_theme','light');
    localStorage.setItem('hansen_onboarded','1');
    localStorage.setItem('hansen_starter_coins_given','1');
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(`${origin}/island_animal.html?round-bar-theme-hf6=1`,{waitUntil:'load'});
  await page.waitForFunction(()=>window.HansenRoundReward&&window.HansenRoundBar&&window.HansenBossTheme);
  await page.evaluate(()=>{
    for(const id of ['alertModal','hsnStoryModal','__hansen_onboarding']){
      const element=document.getElementById(id);
      if(element){element.classList.remove('show','on');element.style.display='none';}
    }
    document.querySelectorAll('.modal-bg.show').forEach(element=>{
      element.classList.remove('show');element.style.display='none';
    });
    document.body.classList.remove('modal-open');
    window.HansenRoundReward.status=()=>({
      valid:true,roundNo:2,completed:1,total:20,cleared:[1],
      remain:Array.from({length:19},(_,index)=>index+2)
    });
    window.HansenRoundReward.total=()=>20;
    window.HansenRoundReward.count=()=>1;
    window.HansenBossTheme.apply('light');
    window.showScreen('boss');
    window.HansenRoundBar.ensure();
    window.HansenRoundBar.refresh();
  });
  await page.waitForSelector('#hsnRoundBar .rb-needed');

  const snapshot=theme=>page.evaluate(selected=>{
    window.HansenBossTheme.apply(selected);
    window.HansenRoundBar.refresh();
    const bar=document.getElementById('hsnRoundBar');
    const take=selector=>{
      const element=bar.querySelector(selector),style=getComputedStyle(element);
      return {color:style.color,fill:style.webkitTextFillColor,inline:element.getAttribute('style')||'',text:element.textContent.trim()};
    };
    const style=getComputedStyle(bar);
    return {
      selected,html:document.documentElement.className,parent:Boolean(bar.closest('#bossScreen')),
      background:style.backgroundImage,bgColor:style.backgroundColor,
      text:{needed:take('.rb-needed'),amount:take('.rb-amount'),round:take('.rb-round')}
    };
  },theme);

  const light=await snapshot('light');
  assert(light.parent,'Round Bar 必须仍在 Boss 屏内');
  assert.match(light.html,/\bhsn-pal-cloud\b/,'没有真实覆盖全局云端白');
  assert.match(light.html,/\bhsn-pal-light\b/,'没有真实覆盖全局亮色类');
  assert.match(light.html,/\bhsn-bt-light\b/,'没有真实覆盖 Boss 晨曦主题');
  assert.match(light.text.needed.text,/Lv2/);
  assert.match(light.text.needed.text,/Lv20/);
  assert.match(light.text.amount.text,/\+88/);
  assert.equal(light.text.round.text,'第 2 轮');
  const lightStops=gradientStops(light.background).map(rgb);
  assert(lightStops.length>=2,'晨曦卡必须有完整浅彩渐变');
  for(const stop of lightStops){
    assert(Math.min(...stop)>=200,`晨曦卡仍是深卡 ${stop.join(',')}`);
    assert(Math.max(...stop)-Math.min(...stop)>=14,`晨曦卡退化成灰白板 ${stop.join(',')}`);
  }
  assertKeyContrast(light,'cloud + Boss 晨曦 + 1/20');

  const dark=await snapshot('dark');
  assert.match(dark.html,/\bhsn-bt-dark\b/);
  assert.notEqual(dark.background,light.background,'深空与晨曦卡面被混成同一套');
  assert(gradientStops(dark.background).every(stop=>Math.max(...rgb(stop))<150),
    `深空卡没有保持独立深面 ${dark.background}`);
  assertKeyContrast(dark,'cloud + Boss 深空 + 1/20');

  const cinema=await snapshot('cinema');
  assert.match(cinema.html,/\bhsn-bt-cinema\b/);
  assert.notEqual(cinema.background,light.background,'电影卡不得继承晨曦浅面');
  assert.notEqual(cinema.background,dark.background,'电影卡必须有自己的高不透明保护面');
  assert(gradientStops(cinema.background).every(stop=>Math.max(...rgb(stop))<80),
    `电影卡没有使用独立高不透明深面 ${cinema.background}`);
  assertKeyContrast(cinema,'cloud + Boss 电影 + 1/20');

  // 全局亮色只能换 Boss 屏外的配色；Boss 晨曦卡不得随 palette 的通用行内色映射改变。
  await page.evaluate(()=>{
    localStorage.setItem('hansen_palette_global','sakura');
    window.hansenApplyPalette?.('sakura',true);
  });
  const isolated=await snapshot('light');
  assert.match(isolated.html,/\bhsn-pal-sakura\b/);
  assert.equal(isolated.background,light.background,'全局亮色污染了 Boss 晨曦卡面');
  assert.deepEqual(isolated.text,light.text,'全局亮色污染了 Boss Round Bar 文字');
  assert.deepEqual(errors,[],'主题切换过程出现页面异常');
  await context.close();
  console.log('Boss Round Bar HF6: cloud+晨曦 1/20 清晰可读，dark/light/cinema 独立且无行内色污染 ✅');
}finally{
  if(browser)await browser.close().catch(()=>{});
  if(server)await new Promise(resolve=>server.close(resolve));
}
