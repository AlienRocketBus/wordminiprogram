const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_startup_restore_v1048.mjs —— 开机检查 + 一键恢复
 * 死角（用户实测暴露）：两台设备的账号标识、地址、上传下载全部对齐，
 *   云端也确实有存档，但手机 B 打开应用仍是 Lv.1。
 *   原因：恢复只挂在「登录成功」那一刻，而手机 B 早已处于登录状态——
 *   打开应用不算登录，那段代码根本没被触发。
 *   **已登录的设备永远等不到恢复。**
 * 合同：① 提供开机检查 check() 与随时可调的 now()；
 *       ② 云端有档且(本机空 或 云端更新) 才提示，绝不静默覆盖；
 *       ③ 本机已是最新则不打扰；④ 同一份云端存档只问一次；
 *       ⑤ 恢复成功必须重载页面（否则内存仍是旧数据）；
 *       ⑥ PK 界面有随时可点的「从云端恢复进度」按钮。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
const errs=[];
console.log('开机检查+一键恢复 v1048');
const page=await browser.newPage({viewport:{width:390,height:900}});
page.on('pageerror',e=>errs.push(String(e.message).slice(0,80)));
page.on('dialog',async d=>{ await d.dismiss().catch(()=>{}); });
await page.addInitScript(()=>{ if (window.top === window) localStorage.clear();
  localStorage.setItem('hansen_auth_v1004', JSON.stringify({method:'phone',phone:'+8615550836896',signedAt:Date.now(),uid:'U1'}));
});
await page.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await page.waitForTimeout(2800);
const r = await page.evaluate(()=>{
  const R=window.HansenCloudRestore;
  return { loaded:!!R, api: R? ['check','now'].every(k=>typeof R[k]==='function') : false,
    lp: R? R._localProgress() : null };
});
ok(r.loaded, '恢复模块已加载');
ok(r.api, 'check() 与 now() 两个接口齐备');
ok(r.lp && typeof r.lp.learned==='number', `能统计本机进度(已学 ${r.lp&&r.lp.learned} 词)`);

/* 未登录时不打扰 */
const noAuth = await page.evaluate(async ()=>{
  localStorage.removeItem('hansen_auth_v1004');
  const res = await window.HansenCloudRestore.check();
  return res && res.skip;
});
ok(noAuth==='not-signed-in', `未登录时不打扰(skip=${noAuth})`);
/* 未登录时 now() 也应拒绝 */
const nowNoAuth = await page.evaluate(async ()=> (await window.HansenCloudRestore.now()).reason);
ok(nowNoAuth==='not-signed-in', '未登录时手动恢复被拒');
await page.close();

/* 源码合同 */
const src = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_restore_v1048.js'),'utf8');
ok(/location\.reload/.test(src), '恢复成功后重载页面(避免内存仍是旧数据)');
ok(/confirm\(/.test(src), '替换本机进度前必须用户点头(不静默覆盖)');
ok(/local-is-current/.test(src), '本机已是最新时不打扰');
ok(/alreadyAsked/.test(src) && /markAsked/.test(src), '同一份云端存档只问一次');
ok(/hsn-auth-changed/.test(src), '登录状态变化后也会再查一次');
const pk = fs.readFileSync((__HSN_ROOT + 'hansen_sb_pk_v1022.js'),'utf8');
ok(/kPull/.test(pk) && /从云端恢复进度/.test(pk), 'PK 界面有随时可点的「从云端恢复进度」按钮');
ok(errs.length===0, '零脚本错误'+(errs.length?': '+errs[0]:''));
await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
