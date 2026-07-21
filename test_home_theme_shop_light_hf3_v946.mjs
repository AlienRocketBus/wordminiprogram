#!/usr/bin/env node
// v946 HF3：四套亮色配色的首页最近岛屿与真实主题商店专项回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
let indexUrl='';
let islandUrl='';
const LIGHT={
  cloud:'#f7fbff',
  sakura:'#fff7fb',
  cream:'#fff9ed',
  mint:'#f4fff9'
};

function rgb(value){
  const m=String(value).match(/rgba?\((\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);
  assert(m,`无法解析颜色 ${value}`);
  return [+m[1],+m[2],+m[3]];
}
function luminance(value){
  return rgb(value).map(v=>v/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4))
    .reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
}
function contrast(fg,bg){
  const a=luminance(fg),b=luminance(bg);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

const index=read('index.html');
const shop=read('hansen_diamond_shop.js');
assert.doesNotMatch(index,/html\.hsn-pal-light #recentNum\{\s*color:#cbd5e1/,
  '亮色最近岛屿不得恢复成白底浅灰字');
for(const palette of Object.keys(LIGHT)){
  assert.match(index,new RegExp(`html\\.hsn-pal-${palette}\\{--hsn-recent-surface:`));
  assert.match(shop,new RegExp(`html\\.hsn-pal-${palette}\\{--hsn-shop-surface:`));
}
assert.match(shop,/html\.hsn-pal-light #diamondshopScreen \.dia-item\{background:var\(--hsn-shop-surface/,
  '修复必须命中云朵梦境工厂等商品所在的真实 diamond shop');

let browser=null,server=null;
try{
  server=http.createServer((request,response)=>{
    let pathname='/';
    try{pathname=decodeURIComponent(new URL(request.url||'/','http://localhost').pathname);}catch{}
    if(pathname==='/')pathname='/index.html';
    const target=path.resolve(ROOT,'.'+pathname);
    if(target!==ROOT&&!target.startsWith(ROOT+path.sep)){response.writeHead(403).end();return;}
    fs.readFile(target,(error,data)=>{
      if(error){response.writeHead(error.code==='ENOENT'?404:500).end();return;}
      const ext=path.extname(target).toLowerCase();
      const type=ext==='.html'?'text/html; charset=utf-8':ext==='.js'||ext==='.mjs'?'text/javascript; charset=utf-8':ext==='.css'?'text/css; charset=utf-8':ext==='.webp'?'image/webp':ext==='.jpg'||ext==='.jpeg'?'image/jpeg':'application/octet-stream';
      response.writeHead(200,{'content-type':type,'cache-control':'no-store'});response.end(data);
    });
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();
  indexUrl=`http://127.0.0.1:${address.port}/index.html`;
  islandUrl=`http://127.0.0.1:${address.port}/island_animal.html`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--no-zygote','--single-process','--disable-gpu','--disable-webgl','--allow-file-access-from-files']});
  const context=await browser.newContext({
    viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,
    deviceScaleFactor:2,serviceWorkers:'block'
  });
  const page=await context.newPage();
  await page.goto(indexUrl,{waitUntil:'domcontentloaded'});
  for(const [palette,surface] of Object.entries(LIGHT)){
    await page.evaluate(palette=>{
      localStorage.setItem('hansen_palette_global',palette);
      localStorage.setItem('hansen_onboarded','1');
      localStorage.setItem('lastIslandKey','wordIslandAnimal');
      localStorage.setItem('lastIslandTime',String(Date.now()));
    },palette);
    await page.goto(indexUrl,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.HansenDiamondShop && document.documentElement.classList.contains('hsn-pal-light'));
    await page.waitForFunction(()=>parseFloat(getComputedStyle(document.querySelector('.stats')).opacity)>.99);

    const recent=await page.evaluate(()=>{
      const card=document.getElementById('recentLearnStat');
      const title=document.getElementById('recentLbl');
      const detail=document.getElementById('recentNum');
      const subtitle=document.querySelector('.subtitle');
      const tagline=document.querySelector('.tagline');
      const cs=el=>getComputedStyle(el);
      return {
        cardBg:cs(card).backgroundColor,
        title:cs(title).color,
        detail:cs(detail).color,
        detailFill:cs(detail).webkitTextFillColor,
        detailShadow:cs(detail).textShadow,
        detailText:detail.textContent,
        subtitleColor:cs(subtitle).color,
        subtitleFill:cs(subtitle).webkitTextFillColor,
        subtitleShadow:cs(subtitle).textShadow,
        taglineFill:cs(tagline).webkitTextFillColor,
        taglineBackground:cs(tagline).backgroundImage
      };
    });
    assert.equal(recent.cardBg,rgbCss(surface),`${palette}: 最近岛屿卡面必须是配色对应的干净浅彩色`);
    assert(contrast(recent.title,recent.cardBg)>=4.5,`${palette}: 最近岛屿标题对比度不足 ${JSON.stringify(recent)}`);
    assert(contrast(recent.detail,recent.cardBg)>=4.5,`${palette}: 最近岛屿副标题/箭头对比度不足 ${JSON.stringify(recent)}`);
    assert.equal(recent.detailFill,recent.detail,`${palette}: text-fill 不得把清晰字色覆盖掉`);
    assert.equal(recent.detailShadow,'none');
    assert.match(recent.detailText,/点击继续\s*→/);
    assert.equal(recent.subtitleFill,recent.subtitleColor,`${palette}: Word Adventures 不得被浅黄 text-fill 抢回去`);
    assert(contrast(recent.subtitleFill,recent.cardBg)>=4.5,`${palette}: Word Adventures 对比度不足 ${JSON.stringify(recent)}`);
    assert.equal(recent.subtitleShadow,'none');
    assert.equal(recent.taglineFill,'rgba(0, 0, 0, 0)',`${palette}: 首页标语必须显示深色渐变而非旧浅黄填充`);
    for(const deep of ['rgb(30, 64, 175)','rgb(159, 18, 57)','rgb(91, 33, 182)']){
      assert(contrast(deep,recent.cardBg)>=4.5,`${palette}: 首页标语渐变端点 ${deep} 对比度不足`);
    }
    assert.match(recent.taglineBackground,/linear-gradient/);
    if(process.env.HANSEN_CAPTURE_UI==='1'){
      const recentCard=page.locator('#recentLearnStat');
      assert.equal(await recentCard.isVisible(),true,`${palette}: 最近岛屿卡必须可见`);
      await recentCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(100);
      await recentCard.screenshot({path:`/tmp/v946-hf3-${palette}-home-recent.png`});
    }

    // 主题商店真正运行在岛内 screen 导航系统中；必须在真实岛页验证，而不是只造 DOM。
    await page.goto(islandUrl,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.HansenDiamondShop && document.documentElement.classList.contains('hsn-pal-light'));
    await page.evaluate(()=>window.HansenDiamondShop.open());
    await page.waitForSelector('#diamondshopScreen.active .dia-item');
    // 新存档会延迟弹一次岛屿欢迎层；关闭它后再做主题商店的真实视觉取样。
    await page.waitForTimeout(380);
    await page.evaluate(()=>{if(typeof window.closeAlert==='function')window.closeAlert();window.HansenDiamondShop.open();window.scrollTo(0,0);});
    const ui=await page.evaluate(()=>{
      const q=s=>document.querySelector('#diamondshopScreen '+s);
      const css=(s,p)=>getComputedStyle(q(s))[p];
      return {
        cardBg:css('.dia-item','backgroundColor'),
        cardImage:css('.dia-item','backgroundImage'),
        name:css('.dia-name','color'),
        nameShadow:css('.dia-name','textShadow'),
        desc:css('.dia-desc','color'),
        descShadow:css('.dia-desc','textShadow'),
        tryBg:css('.dia-btn.try','backgroundColor'),
        tryColor:css('.dia-btn.try','color'),
        buyBg:css('.dia-btn.buy','backgroundColor'),
        buyImage:css('.dia-btn.buy','backgroundImage'),
        buyColor:css('.dia-btn.buy','color'),
        tipBg:css('.dia-imax-tip','backgroundColor'),
        tipColor:css('.dia-imax-tip','color'),
        titleColor:css('.screen-title','color'),
        titleFill:css('.screen-title','webkitTextFillColor')
      };
    });
    assert.equal(ui.cardBg,rgbCss(surface),`${palette}: 商店不得再使用灰色背景板`);
    assert.equal(ui.cardImage,'none',`${palette}: 商品卡不得叠回脏灰渐变`);
    assert(contrast(ui.name,ui.cardBg)>=4.5,`${palette}: 商品名对比度不足 ${JSON.stringify(ui)}`);
    assert(contrast(ui.desc,ui.cardBg)>=4.5,`${palette}: 商品说明对比度不足 ${JSON.stringify(ui)}`);
    assert.equal(ui.nameShadow,'none');
    assert.equal(ui.descShadow,'none');
    assert(contrast(ui.tryColor,ui.tryBg)>=4.5,`${palette}: 试用按钮对比度不足 ${JSON.stringify(ui)}`);
    assert.equal(ui.buyImage,'none',`${palette}: 购买按钮必须使用可测量的稳定深青底`);
    assert(contrast(ui.buyColor,ui.buyBg)>=4.5,`${palette}: 购买按钮对比度不足 ${JSON.stringify(ui)}`);
    assert(contrast(ui.tipColor,ui.tipBg)>=4.5,`${palette}: IMAX 说明对比度不足 ${JSON.stringify(ui)}`);
    assert.equal(ui.titleFill,ui.titleColor,`${palette}: 商店标题不得被透明渐变字覆盖`);

    if(process.env.HANSEN_CAPTURE_UI==='1'){
      await page.screenshot({path:`/tmp/v946-hf3-${palette}-theme-shop.png`,fullPage:false});
    }
  }

  // 深空蓝不应被亮色修复反向污染。
  {
    await page.evaluate(()=>localStorage.setItem('hansen_palette_global','cosmos'));
    await page.goto(islandUrl,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.HansenDiamondShop);
    await page.evaluate(()=>window.HansenDiamondShop.open());
    await page.waitForSelector('#diamondshopScreen .dia-item');
    const dark=await page.evaluate(()=>({
      light:document.documentElement.classList.contains('hsn-pal-light'),
      bg:getComputedStyle(document.querySelector('.dia-item')).backgroundColor,
      name:getComputedStyle(document.querySelector('.dia-name')).color
    }));
    assert.equal(dark.light,false);
    assert.equal(dark.bg,'rgba(30, 41, 59, 0.5)','深色主题商品卡必须保持既有电影感');
    assert.equal(dark.name,'rgb(226, 232, 240)','深色主题商品名必须保持既有浅字');
  }
  await context.close();
  console.log('home/theme shop HF3: 4 light palettes AA contrast + clean light cards + dark-theme isolation ✅');
}finally{
  if(browser) await browser.close().catch(()=>{});
  if(server) await new Promise(resolve=>server.close(resolve));
}

function rgbCss(hex){
  const value=hex.slice(1);
  return `rgb(${parseInt(value.slice(0,2),16)}, ${parseInt(value.slice(2,4),16)}, ${parseInt(value.slice(4,6),16)})`;
}
