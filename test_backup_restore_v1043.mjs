const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_backup_restore_v1043.mjs —— 备份→恢复能否真正带回等级
 * 背景：云端通道已全绿（往返自检通过），但用户在新设备登录后仍是 Lv.1、
 *   进度毫无变化。需要先排除"备份/恢复机制本身有问题"这一可能，
 *   才能确定问题出在"云端到底有没有那份存档"。
 * 做法：设备A 造出 charXP=1200(远超 Lv7) 的存档并导出备份码；
 *   设备B 全新环境导入该码，断言等级与岛屿存档确实被带回。
 * 这个链路完全不依赖云端，本地即可验证。 */
import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=__HSN_ROOT.replace(/\/$/, '');
const srv=http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/index.html';
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.mp3':'audio/mpeg','.json':'application/json','.css':'text/css'})[path.extname(p)]||'application/octet-stream'});res.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({executablePath:process.env.HANSEN_CHROMIUM_PATH});
/* ① 设备A：造一份"7级+进度"的存档，导出备份码 */
const pA=await b.newPage({viewport:{width:390,height:844}});
await pA.addInitScript(()=>{ if (window.top === window) localStorage.clear();
  localStorage.setItem('hansen_wallet_charxp','1200');           // 远超 Lv7 门槛
  localStorage.setItem('wordIslandAnimal', JSON.stringify({learned:[1,2,3,4,5,6,7,8],stats:{daysPlayed:9,bossBeaten:5}}));
  localStorage.setItem('hansen_coin_wallet','1500');
});
await pA.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await pA.waitForTimeout(2600);
const a = await pA.evaluate(()=>{
  const B=window.HansenBackup;
  let code=null, err='';
  try{ code = B.exportCode(); }catch(e){ err=String(e.message).slice(0,90); }
  return { xp: localStorage.getItem('hansen_wallet_charxp'),
    lvl: (typeof getAdvLevel==='function')? getAdvLevel().lv : -1,
    codeLen: code?code.length:0, err, code };
});
console.log('[设备A] charXP=%s 等级=%s 备份码长度=%s %s', a.xp, a.lvl, a.codeLen, a.err?('ERR:'+a.err):'');
await pA.close();

/* ② 设备B：全新，导入这份备份码，看等级回不回来 */
const pB=await b.newPage({viewport:{width:390,height:844}});
await pB.addInitScript(()=>{ if (window.top === window) localStorage.clear(); });
await pB.goto(`http://127.0.0.1:${port}/island_animal.html`,{waitUntil:'domcontentloaded'});
await pB.waitForTimeout(2600);
const before = await pB.evaluate(()=>({ xp: localStorage.getItem('hansen_wallet_charxp'),
  lvl:(typeof getAdvLevel==='function')?getAdvLevel().lv:-1 }));
const r = await pB.evaluate((code)=>{
  const B=window.HansenBackup;
  let ok=null, err='';
  try{ const parsed=B.parse(code); ok=B.restore(parsed); }
  catch(e){ try{ ok=B.restore(code); }catch(e2){ err=String(e2.message).slice(0,120); } }
  return { ok, err, xpAfter: localStorage.getItem('hansen_wallet_charxp'),
    islands: Object.keys(localStorage).filter(k=>k.indexOf('wordIsland')===0).length };
}, a.code);
console.log('[设备B] 导入前 charXP=%s 等级=%s', before.xp, before.lvl);
console.log('[设备B] 导入结果 ok=%s %s', r.ok, r.err?('ERR:'+r.err):'');
console.log('[设备B] 导入后 charXP=%s 岛屿存档=%s 个', r.xpAfter, r.islands);
await pB.close(); await b.close(); srv.close();
const good = a.codeLen>0 && r.xpAfter==='1200';
console.log(good ? '\n✅ 备份→恢复能带回等级' : '\n❌ 恢复后等级没回来 —— 问题就在这一环');
process.exit(good?0:1);
