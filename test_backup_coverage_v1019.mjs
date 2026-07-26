/* test_backup_coverage_v1019.mjs —— 备份覆盖面回归「所有东西都跟着账号走」
 * 事故：备份原为**白名单**(只收特定前缀/名单)，每加新功能就可能漏键——
 *       sb_best_cpm(拼写蜂最快纪录)、主题、语音等设置都曾在备份之外，换设备即丢。
 * 合同：① 全仓实际用到的存储键必须全部进备份；
 *       ② 登录会话与云存档密钥状态**必须排除**(跨设备同步它们会出安全/逻辑问题)。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
/* 曾经漏掉、现在必须覆盖的键 */
const MUST = ['sb_best_cpm','theme','ttsProvider','voiceName','clickSoundEnabled','hsnViewMode',
  'lastIslandKey','lastIslandTime','land','land1_prog','land8_prog','season1_prog',
  'season_word_mastery','season_boss_perfect','season_wrong_words',
  'wordIslandAnimal','hansen_canonical_progress_v941','hansen_sb_profile_v1002','hsn_sb_coin_day'];
/* 绝不可同步的键 */
const MUST_NOT = ['hansen_auth_v1004','hansen_cloud_state_v965','hsn_debug_flag','hansen_admin_panel'];
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.addInitScript(({m,n})=>{ localStorage.clear();
  m.forEach(k=>localStorage.setItem(k, JSON.stringify({v:1})));
  n.forEach(k=>localStorage.setItem(k, JSON.stringify({v:1})));
}, {m:MUST, n:MUST_NOT});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2600);
console.log('备份覆盖面 v1019');
const r = await page.evaluate(({m,n})=>{
  var HB = window.HansenBackup;
  if(!HB || typeof HB.build!=='function') return {no:1};
  var b = HB.build();
  var items = (b && b.items) || {};
  var data = Array.isArray(items) ? items.reduce(function(a,x){ a[x&&x.k||x&&x.key]=1; return a; },{}) : items;
  var keys = Object.keys(data);
  return { total:keys.length,
    missing: m.filter(k=>!(k in data)),
    leaked:  n.filter(k=>(k in data)) };
}, {m:MUST, n:MUST_NOT});
if(r.no){ console.log('  XX  HansenBackup 不可用'); process.exit(1); }
console.log(`  备份收录 ${r.total} 个键`);
ok(r.missing.length===0, '应收录的键一个不漏'+(r.missing.length?'：缺 '+r.missing.join(','):''));
ok(r.leaked.length===0, '登录会话/密钥状态/调试键均未混入'+(r.leaked.length?'：混入 '+r.leaked.join(','):''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
