#!/usr/bin/env node
// v946 HF2: 320px、横屏手机、引导无障碍、减少动态效果与可缩放专项回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from './playwright_loader.mjs';
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const fileUrl=name=>pathToFileURL(path.join(ROOT,name)).href;
const read=name=>fs.readFileSync(path.join(ROOT,name),'utf8');
let browser=null;

async function run(){
  const perf=read('hansen_perf_v944.js');
  const a11y=read('hansen_accessibility.js');
  const onboarding=read('hansen_onboarding.js');
  const template=read('template.html');
  const cinema=read('hansen_cinema_themes.js');
  const bossLock=read('hansen_boss_lock.js');

  assert.match(perf,/\(hover: hover\) and \(pointer: fine\)/,'桌面分流必须核对精细指针和悬停');
  assert.match(perf,/maxTouchPoints/,'桌面分流必须核对触摸能力');
  assert.match(perf,/if \(!desktopLike\) return/,'横屏手机必须留在当前游戏页');
  assert.match(template,/@media\(max-width:340px\)/,'极窄屏必须有独立布局');
  assert.match(template,/repeat\(3,minmax\(0,1fr\)\)/,'日常三列必须允许收缩');
  assert.match(template,new RegExp('hansen_boss_lock\\.js\\?v='+__APPV__),'Boss 彩虹倒计时、安全区与 v951 特效必须绕过旧运行时缓存');
  assert.match(bossLock,/\.world-map-btn\{[^}]*env\(safe-area-inset-top/,'后加载的 Boss 样式也必须保留顶部安全区');
  assert.match(bossLock,/\.world-map-btn\{[^}]*env\(safe-area-inset-right/,'后加载的 Boss 样式也必须保留右侧安全区');
  assert.match(bossLock,/\.top-bar\{[^}]*env\(safe-area-inset-top/,'最终 !important 顶栏规则不得覆盖刘海安全区');
  assert.match(onboarding,/setAttribute\('role', 'dialog'\)/);
  assert.match(onboarding,/createElement\('button'\)/);
  assert.match(onboarding,/event\.key === 'Escape'/);
  assert.match(onboarding,/restoreFocus\.focus/);
  assert.match(cinema,/function reduceMotion\(\)/);
  assert.doesNotMatch(a11y,/\*,\*::before,\*::after\{[^}]*animation(?:-duration)?\s*:/,
    '禁止重新引入会让主题演员回退到左上角的全局动画闸门');
  for(const page of ['boss_hall.html','season_showcase.html']){
    const html=read(page),viewport=html.match(/<meta name="viewport" content="([^"]+)"/i)?.[1]||'';
    assert.doesNotMatch(viewport,/user-scalable\s*=\s*no/i,`${page} 必须允许缩放`);
    assert.doesNotMatch(viewport,/maximum-scale\s*=\s*1/i,`${page} 不得钳死缩放`);
    assert.match(viewport,/viewport-fit=cover/i);
  }

  browser=await chromium.launch({headless:true,args:['--no-sandbox','--allow-file-access-from-files']});

  // 320px：模板首页的任何可见元素都不得撑宽布局视口。
  {
    const context=await browser.newContext({viewport:{width:320,height:700},screen:{width:320,height:700},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
    const page=await context.newPage();
    await page.goto(fileUrl('template.html'),{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(150);
    const layout=await page.evaluate(()=>{
      const width=document.documentElement.clientWidth;
      const out=[...document.querySelectorAll('body *')].filter(el=>{
        const style=getComputedStyle(el),rect=el.getBoundingClientRect();
        return style.display!=='none' && (rect.left < -.5 || rect.right > width+.5);
      }).map(el=>el.id||el.className||el.tagName);
      return {width,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,out};
    });
    assert.equal(layout.width,320);
    assert.equal(layout.doc,320,JSON.stringify(layout));
    assert.equal(layout.body,320,JSON.stringify(layout));
    assert.deepEqual(layout.out,[],JSON.stringify(layout));
    const sizes=await page.evaluate(()=>{
      const modal=document.createElement('div'),close=document.createElement('button');
      modal.className='modal';close.className='close';modal.appendChild(close);
      const back=document.createElement('button'),small=document.createElement('button');
      back.className='back-btn';small.className='small-btn';
      document.body.append(modal,back,small);
      return {close:getComputedStyle(close).width,back:getComputedStyle(back).minHeight,small:getComputedStyle(small).minHeight};
    });
    assert.equal(sizes.close,'44px');assert.equal(sizes.back,'44px');assert.equal(sizes.small,'44px');
    await context.close();
  }

  // 同样的 844px 宽度：粗指针横屏手机不跳页；精细指针电脑仍进入选择包裹页。
  {
    const phone=await browser.newContext({viewport:{width:844,height:390},screen:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
    const page=await phone.newPage();
    await page.goto(fileUrl('island_animal.html'),{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(80);
    assert.match(await page.evaluate(()=>location.pathname),/island_animal\.html$/,'横屏手机不得被误判为电脑');
    assert.equal(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches),true);
    await phone.close();

    const desktop=await browser.newContext({viewport:{width:844,height:600},screen:{width:844,height:600},isMobile:false,hasTouch:false,serviceWorkers:'block'});
    const desktopPage=await desktop.newPage();
    await desktopPage.goto(fileUrl('island_animal.html'),{waitUntil:'domcontentloaded'});
    await desktopPage.waitForTimeout(80);
    assert.match(await desktopPage.evaluate(()=>location.pathname),/_frame\.html$/,'真正的桌面端仍应进入显示模式包裹页');
    await desktop.close();
  }

  // 新手引导：语义、焦点进入/环绕、Escape 关闭、焦点恢复、减少动态效果。
  {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.setContent('<button id="before">原按钮</button>');
    await page.locator('#before').focus();
    await page.addScriptTag({path:path.join(ROOT,'hansen_onboarding.js')});
    await page.waitForSelector('#__hansen_onboarding');
    assert.equal(await page.locator('#__hansen_onboarding').getAttribute('role'),'dialog');
    assert.equal(await page.locator('#__hansen_onboarding').getAttribute('aria-modal'),'true');
    assert.equal(await page.locator('#__hsOnbSkip').evaluate(el=>el.tagName),'BUTTON');
    assert.equal(await page.locator('#__hsOnbBtn').evaluate(el=>el.tagName),'BUTTON');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'__hsOnbBtn');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'__hsOnbSkip','焦点必须从末项环绕到首项');
    assert.equal(await page.locator('#__hsOnbEmoji').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#__hansen_onboarding',{state:'detached'});
    assert.equal(await page.evaluate(()=>document.activeElement?.id),'before','关闭后必须恢复原焦点');
    await context.close();
  }

  // 精确 reduced-motion：普通主题演员不能被全局 animation:none 误伤；Canvas 主题只画静态帧。
  {
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    const page=await context.newPage();
    await page.setContent('<style>@keyframes actorMove{from{transform:translateX(0)}to{transform:translateX(20px)}}</style><div id="actor" style="animation:actorMove 2s linear infinite"></div>');
    await page.addScriptTag({path:path.join(ROOT,'hansen_accessibility.js')});
    assert.equal(await page.locator('#actor').evaluate(el=>getComputedStyle(el).animationName),'actorMove',
      '未审计的主题演员不得被通配符停掉');
    await page.evaluate(()=>{
      window.__rafCalls=0;
      const native=window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame=function(cb){window.__rafCalls++;return native(cb);};
    });
    await page.addScriptTag({path:path.join(ROOT,'hansen_cinema_themes.js')});
    assert.equal(await page.evaluate(()=>HansenCinema.apply('theme_fireworks')),true);
    await page.waitForTimeout(60);
    const reduced=await page.evaluate(()=>({calls:window.__rafCalls,canvas:!!document.getElementById('hsnCinemaCanvas')}));
    assert.equal(reduced.canvas,true);
    assert.equal(reduced.calls,0,'减少动态效果时 Canvas 主题不得开启连续 rAF');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.waitForTimeout(80);
    assert((await page.evaluate(()=>window.__rafCalls))>0,'用户关闭减少动态效果后应恢复主题动画');
    await context.close();
  }
}

try{
  await run();
  console.log('UI/mobile HF2: 320px + landscape pointer gate + onboarding a11y + precise reduced-motion + zoom ✅');
}finally{
  if(browser)await browser.close().catch(()=>{});
}
