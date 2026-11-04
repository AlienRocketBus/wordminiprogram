const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_light_readability_v1016.mjs —— 亮色调全站可读性总扫(23屏逐字测合成后对比度)
 * 用户要求"实测,不要凭感觉"。本扫无白名单: 逐屏逐字取实际渲染色,
 * 半透明按层合成, 按 WCAG(正文4.5:1/大字3:1)判定, 低于标准即列出。
 * 已知探针要点: ①背景须含元素自身 ②渐变填充文字的可见色是自身背景, 须从父级起算
 *              ③纯emoji跳过 ④不可见元素跳过 —— 这四点都踩过坑, 勿删。 */
/* 亮色调可读性总扫：无白名单，逐屏逐字测合成后对比度 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
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
await page.addInitScript(()=>{ if (window.top === window) localStorage.clear();
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
const total = all.reduce((n,x)=>n+x[1].length,0);
console.log(`\n合计 ${total} 处低于 WCAG AA / ${all.length} 屏`);
await browser.close(); srv.close();

/* 🔴v1153：**这个测试原来永远不会失败。**

   它零个 assert、零个 throw、零个 process.exit ——
   把 220 处低对比度打印出来，然后**以 0 退出**。
   闸门看到 RC=0 就当它通过了，**这些问题从来没进过任何人的视野**。

   > 一个永远不红的测试比没有测试更糟：
   > 它占着"我们测了"的名分，却什么都不拦。

   但也不能一上来就红 —— 220 处是历史积累，
   全堵上要改很多屏的配色，而卡住发版对谁都没好处。

   所以用**基线机制**（和闸门的失败数基线同一个思路）：
   记下当前值，**只要不比基线更差就放行；变多了就红**。
   基线存在 .readability_baseline.json（gitignore，本机状态）。
   想收紧就手动把基线调小 —— 每次改好几屏就降一次。 */
const fsx = await import('node:fs');
const BASE_FILE = new URL('./.readability_baseline.json', import.meta.url).pathname;
let baseline = null;
try { baseline = JSON.parse(fsx.readFileSync(BASE_FILE, 'utf8')).total; } catch (_) {}
if (baseline == null) {
  /* 🔴v1153 自挑：**没有基线时不能默默通过。**

     第一版我把基线文件放进了 .gitignore ——
     CI 容器每次都是全新的，基线文件永远不存在，
     于是每次都走"首次记录"分支、每次都 RC=0
     → **这个测试在 CI 里永远不会红**，等于我给它留了个后门。

     基线不是"本机性能状态"（那才该 gitignore），
     它是**团队对当前水位的共识** —— 必须进版本库、必须跟着代码走。

     现在：基线文件缺失直接判失败，逼人显式补上一份。 */
  console.log(`\n❌ 找不到基线文件 —— 请把当前值 ${total} 写进 .readability_baseline.json 并提交`);
  fsx.writeFileSync(BASE_FILE, JSON.stringify({ total, note: '请提交这个文件；只许降不许升' }));
  process.exit(1);
} else {
  /* 🔴v1153 自挑：**这个数字本身会抖。**

     连跑三次实测：243 / 239 / 239 —— 差了 4 处。
     原因很实在：页面上有动画（元素位置在动、渐变在变），
     探测那一刻的截面每次都略有不同。

     所以基线不能卡死在一个精确值上，否则**每次跑都可能假红** ——
     而假红会让人开始忽略这个测试，那就白做了（v1149/v1150 的教训）。

     容忍带宽 5%（当前约 12 处）：
       · 超出带宽 → 真的变差了，报红
       · 明显低于基线 → 收紧基线（记的是**观测到的最好值**，
         这样改进会被锁住，不会因为下次抖回去就白改）
       · 带宽内 → 通过，不动基线 */
  const band = Math.max(5, Math.round(baseline * 0.05));
  if (total > baseline + band) {
    console.log(`\n❌ 低对比度从 ${baseline} 处涨到 ${total} 处（容忍带宽 ±${band}）—— 本版让可读性变差了`);
    process.exit(1);
  } else if (total < baseline - band) {
    /* 🔴v1153 自挑（第二轮）：**自动收紧太激进了。**

       第一版是"低于基线就立刻收紧到这个值" ——
       结果某次抖到 222（偏低的一端），基线就被钉死在 222，
       而正常水位是 239 左右，**之后每次都红**。

       实测就撞上了：闸门连续两轮因为这个假红被拦下。

       改为**收紧到"新值 + 半个带宽"**：
       既锁住了改进（不会退回旧水位），
       又给正常波动留了余地。
       想彻底收紧就手动改这个文件 —— 那才是"确认改好了"的动作。 */
    const tightened = total + Math.round(band / 2);
    fsx.writeFileSync(BASE_FILE, JSON.stringify({
      total: tightened, note: '观测到更好的值，收紧到 ' + total + '+半带宽' }));
    console.log(`  ✅ 从 ${baseline} 处降到 ${total} 处 —— 基线收紧到 ${tightened}`);
  } else {
    console.log(`  ✅ ${total} 处，在基线 ${baseline} ±${band} 之内，未变差`);
  }
}
