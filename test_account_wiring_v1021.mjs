/* test_account_wiring_v1021.mjs —— 「账号 ↔ 云存档」同页接线回归
 * 事故：账号模块只在拼写大PK 页加载，云存档只在岛屿页加载——**两者从未同页出现**。
 *       结果：登录时没有云存档可上传；岛屿页存档时读不到登录态，
 *       ensureKey() 退回**设备密钥** → 换设备登录后一无所有(用户实测证实)。
 * 合同：凡是有云存档的页面必须同时有账号模块，且登录态下密钥必须走账号推导。 */
import { chromium } from '/home/claude/work/repo/playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const browser=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('账号↔云存档 接线 v1021');
for (const page_url of ['island_animal.html','spelling_pk.html']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  /* 模拟已登录 */
  await page.addInitScript(()=>{ localStorage.clear();
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({method:'phone',phone:'+8613800138000',signedAt:Date.now(),uid:'UID-TEST-777'})); });
  await page.goto(`http://127.0.0.1:${port}/${page_url}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2600);
  const r = await page.evaluate(()=>{
    const A=window.HansenAuth, CS=window.HansenCloudSave, B=window.HansenBackup;
    return { auth:!!A, cloud:!!CS, backup:!!B,
      signedIn: A&&A.isSignedIn? A.isSignedIn():false,
      uid: CS&&CS.accountUid? CS.accountUid():'',
      key: CS&&CS.ensureKey? CS.ensureKey():'' };
  });
  ok(r.auth && r.cloud && r.backup, `[${page_url}] 账号/云存档/备份 三模块同页齐备`);
  ok(r.signedIn, `[${page_url}] 能读到登录态`);
  /* 🔴v1060 更正过期契约：v1047 特意把账号标识从 uid 改为**手机号**——
     uid 是会话产物，两台设备上并不相同，用它推导密钥导致换设备读不回存档。
     密钥格式也已改为 16 位无横线（与用户真机截图的 BENBH0C67SYSSYPR 一致）。 */
  ok(/^p:\d{6,}$/.test(r.uid), `[${page_url}] 账号标识为手机号派生(v1047): ${r.uid||'(空)'}`);
  /* 存储形态是 4-4-4-4 带横线；诊断面板显示时会去掉横线（用户截图里的
     BENBH0C67SYSSYPR 即为去横线形态）。两种都算合法，不过拟合任一种。 */
  ok(/^([A-Z0-9]{4}-){3}[A-Z0-9]{4}$|^[A-Z0-9]{16}$/.test(r.key), `[${page_url}] 密钥格式合法: ${r.key}`);
  await page.close();
}
/* 两页在同一账号下必须推出同一把密钥 —— 这是"换设备能找回"的根本 */
const keys=[];
for (const u of ['island_animal.html','spelling_pk.html']) {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.addInitScript(()=>{ localStorage.clear();
    localStorage.setItem('hansen_auth_v1004', JSON.stringify({method:'phone',phone:'+8613800138000',signedAt:Date.now(),uid:'UID-SAME'})); });
  await page.goto(`http://127.0.0.1:${port}/${u}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2400);
  keys.push(await page.evaluate(()=> window.HansenCloudSave? window.HansenCloudSave.ensureKey():''));
  await page.close();
}
ok(keys[0] && keys[0]===keys[1], `同账号在不同页面推出同一密钥: ${keys[0]} / ${keys[1]}`);
/* ═══ 🔴v1060 新增：同手机号 + 不同 uid → 必须得到同一把密钥 ═══
   这正是 v1047 存在的理由（uid 跨设备会变），也是"换手机进度没了"的直接成因。
   test_stable_ident_v1047 在模块层覆盖过，这里在**真实页面**上再守一道，
   因为本轮反复出现"模块层对、页面上接线不对"的情况。 */
{
  const keys = [];
  for (const fakeUid of ['UID-DEVICE-A', 'UID-DEVICE-B']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript((u) => {
      localStorage.clear();
      localStorage.setItem('hansen_auth_v1004', JSON.stringify({
        method: 'phone', phone: '+8613800138000', signedAt: Date.now(), uid: u }));
    }, fakeUid);
    await page.goto(`http://127.0.0.1:${port}/spelling_pk.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2600);
    keys.push(await page.evaluate(() => {
      const CS = window.HansenCloudSave;
      return { uid: CS && CS.accountUid ? CS.accountUid() : '', key: CS && CS.ensureKey ? CS.ensureKey() : '' };
    }));
    await page.close();
  }
  ok(keys[0].uid === keys[1].uid, `★ 同手机号不同 uid → 标识一致: ${keys[0].uid} / ${keys[1].uid}`);
  ok(!!keys[0].key && keys[0].key === keys[1].key, `★ 同手机号不同 uid → 密钥一致(换设备能读回): ${keys[0].key} / ${keys[1].key}`);
}

await browser.close(); srv.close();
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);