const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_tts_volume_v1038.mjs —— 发音音量全站统一回归
 * 事故：拼写蜂里单词读音特别小、几乎听不见，其它玩法正常——同一个单词音量不一致。
 * 根因：各处发音各自设音量。岛屿页 TTS 显式写 volume=1.0；
 *   拼写蜂走自己的 `_sbAudioEl` 播 MP3、**从不设 volume**；且 MP3 电平本就低于 TTS。
 *   而 template 里虽已有 HansenTTSVolume.get/set 的调用，模块文件却一直缺失，调用打空。
 * 合同：① 模块在岛屿页与拼写蜂**都加载**（同一音量真源）；
 *       ② 提供 get/set/gain/apply/preview；③ 音量能存取且夹在 0~100；
 *       ④ 兜底接管 utterance 与 audio.play，避免"某处忘了设"再次导致不一致；
 *       ⑤ 静音预热(volume=0)不得被接管改写。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('发音音量全站统一 v1038');

/* ① 两个页面都必须加载, 且读到同一个音量 */
const vals={};
for (const u of ['island_animal.html','spelling_bee.html']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errs.push(u+':'+String(e.message).slice(0,70)));
  await page.addInitScript(()=>{ if (window.top === window) localStorage.clear(); localStorage.setItem('hansen_tts_volume','60'); });
  await page.goto(`http://127.0.0.1:${port}/${u}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2200);
  const r = await page.evaluate(()=>{
    const V = window.HansenTTSVolume;
    if (!V) return { loaded:false };
    /* utterance 是否被统一 */
    let uVol = -1, silentKept = -1, audVol = -1;
    try { const u = new SpeechSynthesisUtterance('hi'); uVol = u.volume; } catch(e){}
    try { const s = new SpeechSynthesisUtterance(' '); s.volume = 0; silentKept = s.volume; } catch(e){}
    try { const a = new Audio(); a.volume = 0.5; try{ a.play(); }catch(e){} audVol = a.volume; } catch(e){}
    return { loaded:true, pct:V.get(), gain:V.gain(),
      api:['get','set','gain','apply','preview'].every(k=>typeof V[k]==='function'),
      uVol, silentKept, audVol };
  });
  vals[u]=r;
  ok(r.loaded, `[${u}] 音量模块已加载`);
  await page.close();
}
ok(vals['island_animal.html'].pct === vals['spelling_bee.html'].pct,
   `两页读到同一音量（${vals['island_animal.html'].pct} / ${vals['spelling_bee.html'].pct}）—— 同一真源`);
ok(vals['spelling_bee.html'].api, '五个接口齐备(get/set/gain/apply/preview)');
ok(Math.abs(vals['spelling_bee.html'].gain - 0.6) < 0.01, `gain 归一化正确: ${vals['spelling_bee.html'].gain}`);
ok(Math.abs(vals['spelling_bee.html'].uVol - 0.6) < 0.01,
   `新建 utterance 音量已被统一接管: ${vals['spelling_bee.html'].uVol}`);
ok(vals['spelling_bee.html'].silentKept === 0, '静音预热(volume=0)未被改写');
ok(Math.abs(vals['spelling_bee.html'].audVol - 0.6) < 0.01,
   `audio.play() 前音量已统一: ${vals['spelling_bee.html'].audVol}`);

/* ② 设置页滑块存在并能改 */
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errs.push('set:'+String(e.message).slice(0,70)));
await page.addInitScript(()=>{if (window.top === window) localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2400);
const s = await page.evaluate(()=>{
  try{ showScreen('settings'); }catch(e){}
  const sl=document.getElementById('ttsVolSlider');
  const before = window.HansenTTSVolume.get();
  window.HansenTTSVolume.set(40);
  return { hasSlider:!!sl, before, after: window.HansenTTSVolume.get(),
    stored: localStorage.getItem('hansen_tts_volume') };
});
ok(s.hasSlider, '设置页有音量滑块');
ok(s.after===40 && s.stored==='40', `音量可调并持久化(${s.before} → ${s.after})`);
const clampR = await page.evaluate(()=>{ const V=window.HansenTTSVolume;
  V.set(999); const hi=V.get(); V.set(-50); const lo=V.get(); return {hi,lo}; });
ok(clampR.hi===100 && clampR.lo===0, `越界被夹住(999→${clampR.hi}, -50→${clampR.lo})`);
await page.close();
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
