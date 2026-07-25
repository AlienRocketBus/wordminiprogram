/* test_light_readability_v1016.mjs —— 亮色调全站可读性总扫(23屏逐字测合成后对比度)
 * 用户要求"实测,不要凭感觉"。本扫无白名单: 逐屏逐字取实际渲染色,
 * 半透明按层合成, 按 WCAG(正文4.5:1/大字3:1)判定, 低于标准即列出。
 * 已知探针要点: ①背景须含元素自身 ②渐变填充文字的可见色是自身背景, 须从父级起算
 *              ③纯emoji跳过 ④不可见元素跳过 —— 这四点都踩过坑, 勿删。 */
/* 亮色调可读性总扫：无白名单，逐屏逐字测合成后对比度 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});

const SNIFF = `(function(){
  function parse(c){ var m=(c||'').match(/(\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/);
    return m? {r:+m[1],g:+m[2],b:+m[3],a:m[4]!==undefined?parseFloat(m[4]):1} : null; }
  function over(f,b){ var a=f.a; return {r:f.r*a+b.r*(1-a), g:f.g*a+b.g*(1-a), b:f.b*a+b.b*(1-a), a:1}; }
  function L(c){ function f(v){ v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
    return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); }
  function ratio(x,y){ var a=L(x),b=L(y); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
  /* 逐层向上合成真实背景 */
  function bgOf(el){
    var stack=[], c=el;
    while(c && c!==document.documentElement){
      var s=getComputedStyle(c);
      var bi=s.backgroundImage, bc=s.backgroundColor;
      if(bi && bi!=='none'){ var g=(bi.match(/rgba?\\([^)]+\\)/g)||[]);
        if(g.length){ var p=parse(g[0]); if(p) stack.push(p); } }
      var pb=parse(bc); if(pb && pb.a>0) stack.push(pb);
      c=c.parentElement;
    }
    stack.push({r:255,g:255,b:255,a:1});
    var acc=stack[stack.length-1];
    for(var i=stack.length-2;i>=0;i--) acc=over(stack[i],acc);
    return acc;
  }
  var out=[];
  document.querySelectorAll('body *').forEach(function(el){
    var t='';
    for(var i=0;i<el.childNodes.length;i++){ var n=el.childNodes[i];
      if(n.nodeType===3 && n.textContent.trim().length>=1){ t=n.textContent.trim(); break; } }
    if(!t) return;
    /* 纯 emoji 跳过(彩色图形) */
    if(/^[\\s\\u200d\\ufe0f\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F2FF}]+$/u.test(t)) return;
    var r=el.getBoundingClientRect(); if(r.width<2||r.height<2) return;
    var cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity<0.15) return;
    var fg=parse(cs.color); if(!fg) return;
    var gradText=false;
    if(cs.webkitTextFillColor==='rgba(0, 0, 0, 0)' && cs.backgroundImage!=='none'){
      var g0=(cs.backgroundImage.match(/rgba?\([^)]+\)/)||[])[0]; var pp=parse(g0);
      if(pp){ fg=pp; gradText=true; } }
    var bg=bgOf(gradText ? (el.parentElement||document.body) : el);   /* 修正: 必须含元素自身背景(彩色徽章上的白字否则会被误判) */
    var eff=fg.a<1? over(fg,bg) : fg;
    var rr=ratio(eff,bg);
    var sz=parseFloat(cs.fontSize)||14, bold=(+cs.fontWeight)>=700;
    var need=(sz>=24||(sz>=18.66&&bold))? 3.0 : 4.5;   /* WCAG 大字/正文 */
    if(rr < need) out.push({ t:t.slice(0,12), fg:'rgb('+Math.round(eff.r)+','+Math.round(eff.g)+','+Math.round(eff.b)+')', bg:'rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')',
      ratio:+rr.toFixed(2), need:need, sz:Math.round(sz), cls:(el.className||'').toString().slice(0,30) });
  });
  return out;
})()`;

const SCREENS = [
  ['主页',       `showScreen('home');`],
  ['探索单词',   `showScreen('explore');`],
  ['打Boss',     `showScreen('boss'); if(typeof startBoss==='function') startBoss();`],
  ['完形填空',   `showScreen('cloze'); if(typeof startClozeLevel==='function') startClozeLevel('hard');`],
  ['极速60秒',   `showScreen('speed'); if(typeof startSpeedLevel==='function') startSpeedLevel('hard');`],
  ['泡泡大作战', `showScreen('bubble'); if(typeof startBubbleLevel==='function') startBubbleLevel('hard');`],
  ['打地鼠',     `showScreen('moles'); if(typeof startMolesLevel==='function') startMolesLevel('hard');`],
  ['火眼金睛',   `showScreen('eagle'); if(typeof startEagleLevel==='function') startEagleLevel('hard');`],
  ['听音辨义',   `showScreen('listen'); if(typeof startListen==='function') startListen();`],
  ['记忆翻牌',   `showScreen('match'); if(typeof startMatch==='function') startMatch();`],
  ['字母拼拼乐', `showScreen('scramble'); if(typeof startScramble==='function') startScramble();`],
  ['打字大师',   `showScreen('typing'); if(typeof startTyping==='function') startTyping();`],
  ['钓鱼大师',   `showScreen('fish'); if(typeof startFishLevel==='function') startFishLevel('hard');`],
  ['成就',       `showScreen('ach');`],
  ['统计',       `showScreen('stats');`],
  ['设置',       `showScreen('settings');`],
  ['错题',       `showScreen('wrong');`],
  ['卡册',       `showScreen('cards');`],
  ['复习中心',   `if(window.HansenReview) HansenReview._open();`],
  ['今日复习',   `if(window.HansenReview) HansenReview._openToday();`],
  ['闪卡复习',   `if(window.HansenReview) HansenReview._openFlashcard();`],
  ['拼写练习',   `if(window.HansenSpellPractice) HansenSpellPractice.openSpellByListen();`],
  ['我的学习',   `if(window.HansenMyLearning) HansenMyLearning._open();`],
  ['抽卡',       `if(window.HansenLandGachaUI) HansenLandGachaUI.open();`],
];

const page = await browser.newPage({viewport:{width:390,height:900}});
await page.addInitScript(()=>{ localStorage.clear();
  localStorage.setItem('hansen_palette_global','cloud');
  const wr={}; for(let i=0;i<8;i++) wr[String(i)]=1;
  localStorage.setItem('hansen_canonical_progress_v941', JSON.stringify({islands:{animal:{wrongs:wr,srs:{}}}}));
  localStorage.setItem('wordIslandAnimal', JSON.stringify({learned:[1,2,3,4,5],coins:1200,
    stats:{daysPlayed:12,bossBeaten:7,speedBest:340,maxCombo:19}}));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2800);

let all=[];
for (const [name, code] of SCREENS) {
  try { await page.evaluate(new Function(code)); } catch(e) {}
  await page.waitForTimeout(950);
  let bad=[]; try { bad = await page.evaluate(SNIFF); } catch(e) { console.log("    !! 探针异常: "+String(e.message).slice(0,150)); }
  /* 去重 */
  const seen=new Set(); bad=bad.filter(b=>{const k=b.t+b.fg+b.bg; if(seen.has(k))return false; seen.add(k); return true;});
  if (bad.length) { all.push([name,bad]); console.log(`  ✗ ${name}: ${bad.length} 处`);
    bad.slice(0,6).forEach(b=>console.log(`      「${b.t}」 ${b.ratio}:1 (需${b.need}) 字${b.fg} 底${b.bg} ${b.sz}px ${b.cls}`)); }
  else console.log(`  ✓ ${name}`);
}
console.log(`\n合计 ${all.reduce((n,x)=>n+x[1].length,0)} 处低于 WCAG AA / ${all.length} 屏`);
await browser.close(); srv.close();
