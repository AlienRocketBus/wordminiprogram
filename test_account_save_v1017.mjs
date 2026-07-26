/* test_account_save_v1017.mjs —— 「账号即存档」密钥推导回归
 * 缺口：云存档原按**每台设备本地随机生成**的16位密钥存取(既定位置又定加解密)，
 *       换设备即便登录同一账号也找不回来——账号建了却没用。
 * 合同：已登录时密钥由 uid 确定性推导(同账号任何设备同一把)，未登录回退本机密钥。 */
import vm from 'node:vm';
import fs from 'node:fs';
const win = { HANSEN_CLOUD_CONFIG:{envId:'x'},
  localStorage:{ getItem:()=>null, setItem(){}, removeItem(){}, length:0, key:()=>null },
  crypto:{ getRandomValues:(a)=>a, subtle:{} },
  document:{ addEventListener(){}, documentElement:{classList:{contains:()=>false}}, getElementById:()=>null, querySelector:()=>null },
  addEventListener(){}, setInterval:()=>0, setTimeout:()=>0, TextEncoder, TextDecoder, btoa:(s)=>Buffer.from(s,'binary').toString('base64'), atob:(s)=>Buffer.from(s,'base64').toString('binary') };
win.window = win;
const ctx = { ...win, window: win };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8'), ctx); }
catch(e){ console.log('load err:', String(e.message).slice(0,90)); }
const CS = win.HansenCloudSave;
if(!CS){ console.log('模块未导出'); process.exit(1); }
let pass=0, fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);}else{fail++;console.log('  XX  '+m);} };
console.log('账号即存档 · 密钥推导');
win.HansenAuth = { isSignedIn:()=>true, currentUser:()=>({uid:'user-AAA'}), readLocal:()=>({uid:'user-AAA'}) };
const k1=CS.ensureKey(), k1b=CS.ensureKey();
win.HansenAuth.currentUser=()=>({uid:'user-BBB'}); win.HansenAuth.readLocal=()=>({uid:'user-BBB'});
const k2=CS.ensureKey();
win.HansenAuth.currentUser=()=>({uid:'user-AAA'}); win.HansenAuth.readLocal=()=>({uid:'user-AAA'});
const k1c=CS.ensureKey();
ok(k1===k1b, '同一账号两次调用得同一密钥');
ok(k1===k1c, '切走再切回仍同一密钥(换设备可复现): '+k1);
ok(k1!==k2, '不同账号密钥不同: '+k1+' vs '+k2);
ok(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(k1), '密钥格式合法');
win.HansenAuth.isSignedIn=()=>false;
const kL=CS.ensureKey();
ok(kL!==k1, '未登录回退本机密钥, 不与账号混用');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
