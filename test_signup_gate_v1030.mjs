/* test_signup_gate_v1030.mjs —— Lv.3 强制注册门槛回归
 * 产品决策：前两级自由玩(让人先看到价值)，升到 Lv.3(250XP) 必须注册才能继续；
 *   注册即把本机进度上云，之后任何设备登录同一账号都能恢复。
 * 合同：① 未达 Lv.3 不打扰；② 达到 Lv.3 且未登录 → 弹出且**无法关闭**(无 ✕、点遮罩不关)；
 *       ③ 已登录 → 不再弹；④ 云服务未开通时不得把人堵死；⑤ 弹窗要显示待保存的真实进度。 */
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
console.log('Lv.3 强制注册门槛 v1030');

async function scene(name, seed){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  page.on('pageerror',e=>errs.push(name+':'+String(e.message).slice(0,70)));
  await page.addInitScript(s=>{ localStorage.clear();
    Object.keys(s).forEach(k=>localStorage.setItem(k, s[k])); }, seed);
  await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2800);
  const r = await page.evaluate(()=>{
    const el=document.getElementById('hsn_gate');
    const G=window.HansenSignupGate;
    return { loaded:!!G, xp:G?G._xp():-1, should:G?G.shouldGate():null,
      on: !!(el&&el.classList.contains('on')),
      hasClose: !!(el&&el.querySelector('[aria-label="关闭"], .g_close, button.close')),
      text: el? (el.textContent||'').replace(/\s+/g,' ').slice(0,240):'' };
  });
  await page.close();
  return r;
}

/* ① 未达门槛(Lv.1) */
let r = await scene('lv1', { 'hansen_wallet_charxp':'50' });
ok(r.loaded, '门槛模块已加载');
ok(!r.on, 'Lv.1 时不打扰(未弹窗)');

/* ② 达到 Lv.3 且未登录 → 必须弹且不可关 */
r = await scene('lv3', { 'hansen_wallet_charxp':'300',
  'wordIslandAnimal': JSON.stringify({learned:[1,2,3,4,5,6]}) });
ok(r.should===true, 'Lv.3 未登录 → 判定需要拦截');
ok(r.on, '**弹出注册门槛**');
ok(!r.hasClose, '**没有关闭按钮**(硬门槛, 关不掉)');
ok(/Lv\.3|注册/.test(r.text), '文案正确: '+r.text.slice(0,40));
ok(/待保存的进度/.test(r.text) && /已探索 \d+ 个岛/.test(r.text) && /已学 \d+ 个单词/.test(r.text), '显示待保存的进度明细: '+(r.text.match(/已探索[^。]{0,28}/)||[''])[0]);

/* ③ 已登录 → 不再弹 */
r = await scene('signed', { 'hansen_wallet_charxp':'300',
  'wordIslandAnimal': JSON.stringify({learned:[1,2,3]}),
  'hansen_auth_v1004': JSON.stringify({method:'phone',phone:'+8613800138000',signedAt:Date.now(),uid:'U9'}) });
ok(!r.on && r.should===false, '已登录 → 不再拦截');

ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
