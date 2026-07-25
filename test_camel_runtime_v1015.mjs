/* test_camel_runtime_v1015.mjs —— 驼色/锈色「运行时」全玩法彻查
 * 背景：静态扫描只能看源码写了什么，看不到"实际渲染成什么"（变量、继承、色板覆盖都会变）。
 *       用户多次反映题目里仍有驼锈色，静态扫描却查不出——故改为真机运行时取色。
 * 判据：进入每个玩法屏，取每一段**可见文字**的 computed color，
 *       换算 HSL 后凡落在 驼/锈 区间（色相 12–48°、饱和≥30%、明度 18–52%）即判违规。
 *       两种色调各扫一遍。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});

const GAMES = [
  ['打Boss',      `showScreen('boss'); if(typeof startBoss==='function') startBoss();`],
  ['完形填空',    `showScreen('cloze'); if(typeof startClozeLevel==='function') startClozeLevel('hard');`],
  ['极速60秒',    `showScreen('speed'); if(typeof startSpeedLevel==='function') startSpeedLevel('hard');`],
  ['泡泡大作战',  `showScreen('bubble'); if(typeof startBubbleLevel==='function') startBubbleLevel('hard');`],
  ['打地鼠',      `showScreen('moles'); if(typeof startMolesLevel==='function') startMolesLevel('hard');`],
  ['火眼金睛',    `showScreen('eagle'); if(typeof startEagleLevel==='function') startEagleLevel('hard');`],
  ['听音辨义',    `showScreen('listen'); if(typeof startListen==='function') startListen();`],
  ['记忆翻牌',    `showScreen('match'); if(typeof startMatch==='function') startMatch();`],
  ['字母拼拼乐',  `showScreen('scramble'); if(typeof startScramble==='function') startScramble();`],
  ['打字大师',    `showScreen('typing'); if(typeof startTyping==='function') startTyping();`],
  ['钓鱼大师',    `showScreen('fish'); if(typeof startFishLevel==='function') startFishLevel('hard');`],
  ['探索单词',    `showScreen('explore');`],
];

const SNIFF = `(function(){
  function hsl(r,g,b){ r/=255;g/=255;b/=255;
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,h=0,s=0,d=mx-mn;
    if(d){ s=l>0.5? d/(2-mx-mn) : d/(mx+mn);
      if(mx===r) h=((g-b)/d+(g<b?6:0)); else if(mx===g) h=((b-r)/d+2); else h=((r-g)/d+4);
      h*=60; }
    return [h, s*100, l*100]; }
  var out=[];
  var all=document.querySelectorAll('body *');
  for(var i=0;i<all.length;i++){
    var el=all[i];
    var hasText=false;
    for(var j=0;j<el.childNodes.length;j++){
      var n=el.childNodes[j];
      if(n.nodeType===3 && n.textContent.trim().length>=1){ hasText=true; break; }
    }
    if(!hasText) continue;
    var r=el.getBoundingClientRect(); if(r.width<1||r.height<1) continue;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0) continue;
    /* 渐变填充文字: 真正可见的是自身背景渐变 */
    var col=cs.color;
    if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)' && cs.backgroundImage && cs.backgroundImage!=='none'){
      var g0=(cs.backgroundImage.match(/rgba?\\([^)]+\\)/)||[])[0]; if(g0) col=g0;
    }
    var m=col.match(/(\\d+),\\s*(\\d+),\\s*(\\d+)/); if(!m) continue;
    var a=col.match(/rgba\\([^)]*,\\s*([\\d.]+)\\s*\\)/); if(a && parseFloat(a[1])<0.15) continue;
    var v=hsl(+m[1],+m[2],+m[3]);
    if(v[0]>=12 && v[0]<=48 && v[1]>=30 && v[2]>=18 && v[2]<=52){
      var t=''; for(var k=0;k<el.childNodes.length;k++){ var nn=el.childNodes[k];
        if(nn.nodeType===3 && nn.textContent.trim()){ t=nn.textContent.trim().slice(0,10); break; } }
      out.push({ txt:t, col:col, h:Math.round(v[0]), s:Math.round(v[1]), l:Math.round(v[2]),
                 cls:(el.className||'').toString().slice(0,34) });
    }
  }
  return out;
})()`;

let violations = [];
for (const [tag, pal] of [['亮色调','cloud'], ['暗色调',null]]) {
  const page = await browser.newPage({viewport:{width:390,height:900}});
  await page.addInitScript(p=>{ localStorage.clear(); if(p) localStorage.setItem('hansen_palette_global',p);
    const wr={}; for(let i=0;i<8;i++) wr[String(i)]=1;
    localStorage.setItem('hansen_canonical_progress_v941', JSON.stringify({islands:{animal:{wrongs:wr,srs:{}}}}));
  }, pal);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2600);
  for (const [name, launcher] of GAMES) {
    try { await page.evaluate(new Function(launcher)); } catch(e) {}
    await page.waitForTimeout(1100);
    let bad = [];
    try { bad = await page.evaluate(SNIFF); } catch(e) {}
    if (bad.length) {
      violations.push({ pal:tag, game:name, items:bad });
      console.log(`  ✗ [${tag}] ${name}: ${bad.length} 处`);
      bad.slice(0,5).forEach(b=>console.log(`        「${b.txt}」 ${b.col} (H${b.h} S${b.s} L${b.l}) ${b.cls}`));
    } else {
      console.log(`  ✓ [${tag}] ${name}`);
    }
  }
  await page.close();
}
await browser.close(); srv.close();
const total = violations.reduce((n,v)=>n+v.items.length,0);
console.log(`\n合计违规 ${total} 处 / ${violations.length} 个屏次`);
process.exit(total===0?0:1);
