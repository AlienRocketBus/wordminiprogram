/* test_tts_volume_v1032.mjs —— 全站发音音量统一 + 可调回归
 * 事故：用户反映各处单词发音音量不一致（拼写蜂偏小、别处偏大）。
 *   审计发现：部分发音点显式设了音量，**另一部分从不设置**（走浏览器默认），
 *   而 `hansen_tts_volume` 模块虽已写好却**从未被任何页面加载**（孤儿文件）。
 *   （注：template 的 volume=0.01 与 spelling_bee 的 volume=0 是 iOS 音频解锁静音探针，
 *    故意为之，不得改动。）
 * 合同：① 模块在四个入口页均加载且**位置足够早**（要在其它脚本发音前完成打补丁）；
 *       ② 语音合成与 Audio 都被统一接管；③ 设置页有音量滑杆且改动能持久化。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('全站发音音量统一 v1032');

/* ① 四个入口页都加载, 且在其它脚本之前 */
for (const f of ['template.html','index.html','spelling_bee.html','spelling_pk.html']) {
  const src = fs.readFileSync(path.join(ROOT,f),'utf8');
  const iVol = src.indexOf('hansen_tts_volume');
  const iOther = src.indexOf('<script', src.indexOf('<script')+1);
  ok(iVol >= 0, `${f} 已加载音量模块`);
  ok(iVol >= 0 && iVol < src.indexOf('hansen_sw_upgrade_gate') + 1 || iVol < iOther + 200,
     `${f} 加载位置足够早`);
}
/* iOS 解锁探针不得被改动 */
const tpl = fs.readFileSync(path.join(ROOT,'template.html'),'utf8');
ok(/a\.volume = 0\.01/.test(tpl), 'iOS 音频解锁探针(0.01)保持原样');

/* ② 运行时：模块接管语音合成与 Audio */
const page=await browser.newPage({viewport:{width:390,height:844}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,70)));
await page.addInitScript(()=>{localStorage.clear();});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
const r = await page.evaluate(()=>{
  const V=window.HansenTTSVolume;
  if(!V) return {no:1};
  const before=V.get();
  V.set(40);   /* 模块用 0-100 刻度 */
  const after=V.get();
  /* 新建的语音实例应被打过补丁(音量随设置缩放) */
  let uVol=null;
  try { const u=new SpeechSynthesisUtterance('hi'); u.volume=1; uVol=u.volume; } catch(e){}
  let aVol=null;
  try { const a=new Audio(); a.volume=1; aVol=a.volume; } catch(e){}
  V.set(before);
  return { has:true, before, after, uVol, aVol, key:V.KEY };
});
ok(!r.no, '音量模块运行时可用');
ok(r.after===40, `设置能读写(设 40 读回 ${r.after})`);
ok(r.uVol!==null && r.uVol<=0.45, `语音合成音量被接管(设1实得${r.uVol})`);
ok(r.aVol!==null && r.aVol<=0.45, `Audio 音量被接管(设1实得${r.aVol})`);
/* ③ 持久化 */
const persisted = await page.evaluate(()=>{
  window.HansenTTSVolume.set(60);
  return localStorage.getItem(window.HansenTTSVolume.KEY);
});
ok(String(persisted)==='60', `音量已持久化(${persisted})`);
/* ④ 设置页有滑杆 */
const slider = await page.evaluate(()=>{
  try{ showScreen('settings'); }catch(e){}
  return new Promise(res=>setTimeout(()=>{
    const s=document.getElementById('ttsVolSlider');
    res({ has:!!s, val:s?s.value:null, num:!!document.getElementById('ttsVolNum') });
  }, 700));
});
ok(slider.has && slider.num, `设置页有音量滑杆(当前 ${slider.val}%)`);
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
