/* test_login_restore_v1026.mjs —— 登录后「云端恢复」必须刷新页面
 * 事故：用户在设备 B 登录同一账号后「等级还是没变、什么都没变」。
 *   根因：restoreWithKey 只把数据写回 localStorage，**页面从不刷新** ——
 *   ① 内存里的 S 仍是登录前的空数据，界面自然毫无变化；
 *   ② 更糟的是页面下一次存档会用内存里的空数据**覆盖掉刚恢复的进度**。
 * 合同：① 恢复成功必须返回 needReload；② UI 必须据此重新加载页面；
 *       ③ 冲突分支选「用云端」后同样要刷新。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('登录后云端恢复 v1026');

const src = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');
const ui  = fs.readFileSync('/home/claude/work/repo/hansen_auth_ui_v1004.js','utf8');

/* ① 逻辑层：恢复成功必须带 needReload */
const win = { HANSEN_CLOUD_CONFIG:{envId:'x'},
  localStorage:{ _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];}, get length(){return Object.keys(this._d).length;}, key(i){return Object.keys(this._d)[i]||null;} },
  document:{ addEventListener(){}, dispatchEvent(){}, documentElement:{classList:{contains:()=>false}}, getElementById:()=>null, querySelector:()=>null },
  addEventListener(){}, setTimeout:(f)=>{f&&f();return 0;}, setInterval:()=>0 };
win.window = win;
const ctx = { ...win, window: win };
vm.createContext(ctx);
try { vm.runInContext(src, ctx); } catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const A = win.HansenAuth;
ok(!!A && typeof A.syncOnLogin==='function', 'syncOnLogin 已导出');

/* 模拟：云端有档、本机为空 → 应走恢复并要求刷新 */
let restoreCalled=false;
win.HansenCloudSave = {
  accountHasCloudSave: ()=>Promise.resolve(true),
  ensureKey: ()=>'AAAA-BBBB-CCCC-DDDD',
  restoreWithKey: ()=>{ restoreCalled=true; return Promise.resolve({ok:true}); },
  syncNow: ()=>Promise.resolve({ok:true})
};
const r1 = await A.syncOnLogin();
ok(restoreCalled, '云端有档+本机空 → 调用了恢复');
ok(r1 && r1.action==='restored', '返回 action=restored');
ok(r1 && r1.needReload===true, '**恢复成功必须要求刷新页面**(否则内存仍是旧数据)');

/* 云端无档 → 应上传, 且不要求刷新 */
win.HansenCloudSave.accountHasCloudSave = ()=>Promise.resolve(false);
const r2 = await A.syncOnLogin();
ok(r2 && r2.action==='uploaded' && !r2.needReload, '云端无档 → 上传, 不刷新');

/* ② UI 层：必须据 needReload 重新加载 */
ok(/needReload/.test(ui) && /location\.reload\(\)/.test(ui), 'UI 依据 needReload 调用 location.reload()');
/* ③ 冲突分支选云端后也要刷新 */
const conflictPart = ui.slice(ui.indexOf('keepCloud'));
ok(/restoreWithKey[\s\S]{0,260}location\.reload\(\)/.test(conflictPart), '冲突分支选「用云端」后同样刷新');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
