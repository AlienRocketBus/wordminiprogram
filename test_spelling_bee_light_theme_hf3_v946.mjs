#!/usr/bin/env node
// v946 HF3: Spelling Bee 四套亮色主题的字母槽、状态、小字与主题化键盘可读性回归。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(ROOT,'spelling_bee.html'),'utf8');
const themes=['sunny','sky','sakura','mint'];
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
let server=null,browser=null;
const listen=s=>new Promise((ok,fail)=>{s.once('error',fail);s.listen(0,'127.0.0.1',ok);});
const closeServer=s=>new Promise(ok=>{if(!s||!s.listening)return ok();s.close(()=>ok());try{s.closeAllConnections?.();}catch(_){}});

// 静态合约：亮色主题不能再直接复用暗夜灰槽，四套主题都必须有独立键盘底色。
assert.match(html,/--slot-ok-bg:#dff8e8;--slot-ok-border:#15803d;--slot-ok-text:#14532d/);
assert.match(html,/--slot-cur-bg:#fff2bd/);
assert.match(html,/\.slot\.ok\{background:var\(--slot-ok-bg\);border-color:var\(--slot-ok-border\);color:var\(--slot-ok-text\)\}/);
assert.match(html,/\.slot\.cur:not\(\.ok\):not\(\.bad\)\{background:var\(--slot-cur-bg\)\}/);
assert.match(html,/body\[data-theme="sunny"\]\{--ink2:#5c421f;--ink3:#684b23;--hi:#1e40af;--keyboard-bg:#f5d49c\}/);
assert.match(html,/body\[data-theme="sky"\]\{--ink2:#2f5678;--ink3:#31587a;--hi:#1e40af;--keyboard-bg:#b9dcf5\}/);
assert.match(html,/body\[data-theme="sakura"\]\{--ink2:#6f3d57;--ink3:#713c59;--hi:#9d174d;--keyboard-bg:#f2bfd4\}/);
assert.match(html,/body\[data-theme="mint"\]\{--ink2:#2f5f47;--ink3:#315f49;--hi:#065f46;--keyboard-bg:#b8e5cc\}/);
assert.match(html,/\.cnmk\{[^}]*background:#b91c1c;color:#fff/,'中文模式小徽章必须使用深红底');
assert.doesNotMatch(html,/\.slot\{[^}]*background:rgba\(8,12,24,\.55\)/s,'字母槽不得硬编码暗夜灰底');

function channel(v){v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}
function rgb(value){
  const m=String(value).match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  assert(m,`无法解析颜色 ${value}`);return [+m[1],+m[2],+m[3]];
}
function contrast(a,b){
  const lum=c=>.2126*channel(c[0])+.7152*channel(c[1])+.0722*channel(c[2]);
  const [x,y]=[lum(rgb(a)),lum(rgb(b))].sort((u,v)=>v-u);return (x+.05)/(y+.05);
}

async function run(){
  server=http.createServer((request,response)=>{
    try{
      const pathname=decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
      const rel=pathname==='/'?'spelling_bee.html':pathname.replace(/^\/+/,''),file=path.resolve(ROOT,rel);
      if(!file.startsWith(ROOT+path.sep)||!fs.statSync(file).isFile())throw new Error('not found');
      response.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});
      fs.createReadStream(file).pipe(response);
    }catch(_){response.writeHead(404).end('not found');}
  });
  await listen(server);const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},screen:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.clear();localStorage.setItem('hansen_sb_theme','sky');});
  const page=await context.newPage();page.setDefaultTimeout(15_000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(origin+'/spelling_bee.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('#kb .key').length===27);
  await page.evaluate(()=>{
    document.querySelector('#setup').classList.remove('on');document.querySelector('#game').classList.add('on');
    document.querySelector('#prompt').innerHTML='<div class="ptag"><span class="cnmk">中</span> 汉译英模式 · 看中文拼单词</div><div class="hint">完整拼出这个单词</div><div class="len">共 <b>5</b> 个字母</div>';
    document.querySelector('#slotsYou').innerHTML='<div class="slot ok">m</div><div class="slot bad">x</div><div class="slot star">∗</div><div class="slot cur"></div>';
  });

  for(const theme of themes){
    await page.evaluate(t=>document.body.setAttribute('data-theme',t),theme);
    const styles=await page.evaluate(()=>{
      const take=selector=>{const s=getComputedStyle(document.querySelector(selector));return {color:s.color,bg:s.backgroundColor,border:s.borderColor,fontWeight:s.fontWeight};};
      return {
        ok:take('#slotsYou .ok'),bad:take('#slotsYou .bad'),star:take('#slotsYou .star'),cur:take('#slotsYou .cur'),
        status:take('#sttYou'),prompt:take('#prompt .ptag'),lengthHelp:take('#prompt .len'),pill:take('#qPill'),
        cnBadge:take('.cnmk'),vsYou:take('.vsbar .s:first-child'),modeHelp:take('.mode .ds'),chipHelp:take('.chip .ds'),
        header:take('.hd h1'),headerMeta:take('.hd .en'),settingHelp:take('.setds'),
        input:take('#botNameInput'),count:take('#qCountField'),themeName:take('.thm.sel .thm-nm'),
        keyboard:take('.keyboard'),key:take('.key[data-k="q"]'),del:take('.key.delete'),
        width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth
      };
    });
    assert(contrast(styles.ok.color,styles.ok.bg)>=4.5,`${theme} 正确字母对比不足: ${JSON.stringify(styles.ok)}`);
    assert(contrast(styles.bad.color,styles.bad.bg)>=4.5,`${theme} 错误字母对比不足: ${JSON.stringify(styles.bad)}`);
    assert(contrast(styles.star.color,styles.star.bg)>=4.5,`${theme} 机器人星号对比不足: ${JSON.stringify(styles.star)}`);
    assert.equal(styles.ok.fontWeight,'900',`${theme} 已输入字母必须保持粗体`);
    assert.equal(styles.cur.bg,'rgb(255, 242, 189)',`${theme} 当前槽必须是暖黄提示底，不能是灰底`);
    assert(contrast(styles.status.color,'rgb(255, 255, 255)')>=4.5,`${theme} 状态小字对白底对比不足`);
    assert(contrast(styles.prompt.color,'rgb(255, 255, 255)')>=4.5,`${theme} 提示小字对白底对比不足`);
    assert(contrast(styles.lengthHelp.color,'rgb(255, 255, 255)')>=4.5,`${theme} 字母长度说明对白底对比不足`);
    assert(contrast(styles.cnBadge.color,styles.cnBadge.bg)>=4.5,`${theme} 中文徽章对比不足`);
    assert(contrast(styles.vsYou.color,'rgb(255, 255, 255)')>=4.5,`${theme} VS 玩家文字对白底对比不足`);
    assert(contrast(styles.modeHelp.color,'rgb(255, 255, 255)')>=4.5,`${theme} 模式说明对白底对比不足`);
    assert(contrast(styles.chipHelp.color,'rgb(255, 255, 255)')>=4.5,`${theme} 难度说明对白底对比不足`);
    assert(contrast(styles.header.color,'rgb(255, 255, 255)')>=4.5,`${theme} 标题对白底对比不足`);
    assert(contrast(styles.headerMeta.color,'rgb(255, 255, 255)')>=4.5,`${theme} 标题副文字对白底对比不足`);
    assert(contrast(styles.settingHelp.color,'rgb(255, 255, 255)')>=4.5,`${theme} 设置说明对白底对比不足`);
    assert(contrast(styles.pill.color,styles.pill.bg)>=4.5,`${theme} 顶部状态条对比不足`);
    assert(contrast(styles.input.color,styles.input.bg)>=4.5,`${theme} 设置输入框对比不足`);
    assert(contrast(styles.count.color,styles.count.bg)>=4.5,`${theme} 题数控件对比不足`);
    assert(contrast(styles.themeName.color,'rgb(255, 255, 255)')>=4.5,`${theme} 主题名称对白底对比不足`);
    assert(contrast(styles.key.color,styles.key.bg)>=7,`${theme} 键盘字母对比不足`);
    assert(contrast(styles.del.color,styles.del.bg)>=4.5,`${theme} 删除键对比不足`);
    assert.notEqual(styles.keyboard.bg,'rgb(209, 213, 219)',`${theme} 亮色键盘不得继续使用灰底`);
    assert.equal(styles.scrollWidth,styles.width,`${theme} 手机宽度出现横向溢出`);
  }

  if(process.env.HANSEN_CAPTURE_PATH){
    await page.evaluate(()=>document.body.setAttribute('data-theme','sky'));
    await page.screenshot({path:process.env.HANSEN_CAPTURE_PATH,fullPage:true});
  }

  // 暗夜仍沿用原来的半透明深槽和浅色字，亮色修复不得污染深色主题。
  const night=await page.evaluate(()=>{
    document.body.removeAttribute('data-theme');
    const ok=getComputedStyle(document.querySelector('#slotsYou .ok')),keyboard=getComputedStyle(document.querySelector('.keyboard'));
    return {okColor:ok.color,okBg:ok.backgroundColor,keyboardBg:keyboard.backgroundColor};
  });
  assert.equal(night.okColor,'rgb(187, 247, 208)');
  assert.equal(night.okBg,'rgba(34, 197, 94, 0.18)');
  assert.equal(night.keyboardBg,'rgb(209, 213, 219)');
  assert.deepEqual(errors,[],'Spelling Bee 亮色主题检查期间不得出现页面异常');
  await context.close();
}

try{await run();console.log('Spelling Bee HF3 light themes: 4 palettes + slots + status + controls + keyboard + dark regression ✅');}
finally{if(browser)await browser.close().catch(()=>{});await closeServer(server);}
