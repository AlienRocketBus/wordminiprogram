const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_anon_migration_v1029.mjs —— 匿名 → 账号 存档迁移的**安全红线**回归
 * 背景：决定保留"先玩后注册"，那么匿名期的进度必须能安全带进账号。
 *   关键认识：进度一直在本机 localStorage，迁移 = 登录后把本机传到账号名下，
 *   不需要搬云端旧档（旧档挂在匿名身份下，账号本就无权读）。
 * 但有两个会**丢数据**的坑必须堵死：
 *   ① 查不到 ≠ 没有：网络抖动导致查询失败时若当成"云端没有"就上传，
 *      可能用本机覆盖掉云端真实存档；
 *   ② 空档覆盖：全新设备(无进度)先登录若上传空档，
 *      老设备之后登录会看到"云端有档"，选错就全丢。
 * 合同：查不到→什么都不做；本机空且云端空→什么都不做；
 *       两边都有→冲突且必须带上双方真实规模供用户判断。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('匿名→账号 迁移安全红线 v1029');
const src = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'),'utf8');
const ui  = fs.readFileSync((__HSN_ROOT + 'hansen_auth_ui_v1004.js'),'utf8');
const store = { _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);},
  removeItem(k){delete this._d[k];}, get length(){return Object.keys(this._d).length;}, key(i){return Object.keys(this._d)[i]||null;} };
const win = { HANSEN_CLOUD_CONFIG:{envId:'e'}, localStorage:store,
  document:{ addEventListener(){}, dispatchEvent(){}, documentElement:{classList:{contains:()=>false}}, getElementById:()=>null, querySelector:()=>null },
  addEventListener(){}, setTimeout:(f)=>{f&&f();return 0;}, setInterval:()=>0 };
win.window = win; const ctx = { ...win, window: win }; vm.createContext(ctx);
try { vm.runInContext(src, ctx); } catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const A = win.HansenAuth;
ok(!!A, '账号模块已加载');

function setCloud(info){ win.HansenCloudSave = {
  accountCloudInfo: ()=>Promise.resolve(info),
  accountHasCloudSave: ()=>Promise.resolve(!!(info&&info.exists)),
  ensureKey: ()=>'K', restoreWithKey: ()=>Promise.resolve({ok:true}),
  syncNow: ()=>{ uploaded=true; return Promise.resolve({ok:true}); } }; }
let uploaded=false;

/* ① 查不到云端 → 绝不上传 */
store._d = {}; store._d['wordIslandAnimal']=JSON.stringify({learned:[1,2,3]});
uploaded=false; setCloud({exists:null, reason:'network'});
let r = await A.syncOnLogin();
ok(r.action==='cloud-unreachable', '查不到云端 → action=cloud-unreachable');
ok(uploaded===false, '**查不到时绝不上传**(避免覆盖云端真实存档)');

/* ② 本机空 + 云端空 → 什么都不做 */
store._d = {}; uploaded=false; setCloud({exists:false});
r = await A.syncOnLogin();
ok(r.action==='nothing-to-sync', '两边都空 → nothing-to-sync');
ok(uploaded===false, '**本机是空的就绝不上传**(避免空档日后覆盖老设备)');

/* ③ 本机有 + 云端无 → 上传(这就是匿名期进度的迁移路径) */
store._d = {}; store._d['wordIslandFood']=JSON.stringify({learned:[1,2,3,4,5]});
uploaded=false; setCloud({exists:false});
r = await A.syncOnLogin();
ok(r.action==='uploaded' && uploaded===true, '本机有进度+云端无 → 上传(匿名期进度完成迁移)');

  /* ④ 两边都有 → **直接恢复云端**（v1158 规则变了）

     BAT MAN 定的规则：注册那一次上传，之后登录一律云端覆盖本机。
     用户不知道两边差多少，只能瞎选，而选错不可逆；
     而规则本身保证云端永远最新，就不该把这个没依据的选择丢给他。 */
store._d = {}; store._d['wordIslandAnimal']=JSON.stringify({learned:[1,2,3]});
store._d['wordIslandFood']=JSON.stringify({learned:[1,2]});
uploaded=false; setCloud({exists:true, updatedAt: 1700000000000});
r = await A.syncOnLogin();
  ok(r.action==='restored', '两边都有 → 直接恢复云端，不再问用户');
ok(uploaded===false, '冲突时不擅自上传');
  ok(r.autoPicked==='cloud', '标明是自动选的云端（不是用户选的）');
  /* v1158: cloudUpdatedAt 只在 conflict 时才有，这条随规则一起去掉 */

/* ⑤ UI 必须把数字摆给用户看 */
/* 🔴v1156 更新：**从 confirm 换成了两个写清楚的按钮。**

   原来用 `confirm` 让用户二选一：
     点「确定」= 用云端覆盖本机
     点「取消」= 用本机覆盖云端

   而「取消」这个词的意思是"我不要做这件事" ——
   **用户下意识点它想退出，结果触发的是覆盖云端，存档当场没了。**

   现在是三个按钮：留本机 / 留云端 / 先不弄，
   每个按钮里都写明"另一份会被覆盖"。 */
ok(/留这台手机上的/.test(ui) && /留云端的/.test(ui),
   '★ 冲突时给出两份各自的选项（不再是「确定/取消」）');
ok(/先不弄/.test(ui),
   '★ **有一个真正的退出** —— ' +
   '两个选项都是破坏性操作时，必须让人能什么都不做');
ok(/会被覆盖/.test(ui),
   '★ **后果写在按钮里** —— 用户点按钮时看的是按钮，不是标题');
ok(/learned/.test(ui) && /cloudUpdatedAt|cloudWhen/.test(ui), '弹窗使用真实词数与云端时间');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
