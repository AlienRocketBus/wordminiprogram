/* test_cloud_identity_v1028.mjs —— 云存档必须复用**账号身份**回归
 * 事故（用户真机自检截图定位）：设备B「上次上传」显示刚刚成功，
 *   紧接着拉取却报「云端没有这把密钥对应的存档」——同一把密钥、刚写完就读不到。
 *   根因：云存档模块**总是另开一个 CloudBase 实例并 signInAnonymously()**，
 *   而 hansen_saves 权限为「仅创建者可读写」：
 *   设备A(匿名身份X)写的档，设备B(匿名身份Y)根本无权读 → 跨设备永远找不回。
 *   手机号账号从头到尾没被用上。
 * 合同：① 已登录时云存档必须复用账号会话(同一实例/同一身份)；
 *       ② 未登录时才回退匿名；③ 登录态变化必须作废实例缓存。 */
import vm from 'node:vm'; import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('云存档身份一致性 v1028');
const src = fs.readFileSync('/home/claude/work/repo/hansen_cloud_save_v965.js','utf8');
const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');

/* ① 源码层合同：已登录必须走账号会话，且不得再匿名 */
const appFn = src.slice(src.indexOf('_app: function()'), src.indexOf('_app: function()')+1400);
ok(/HansenAuth/.test(appFn) && /isSignedIn/.test(appFn), '已登录时会去取账号会话');
ok(/A\._app\(\)/.test(appFn) || /A\._app/.test(appFn), '复用账号的 CloudBase 实例(而非另建)');
/* 账号分支必须在"另建实例"之前就 return —— 登录时根本走不到匿名那段 */
const importIdx = appFn.indexOf("import('./vendor_cloudbase");
const acctIdx = appFn.indexOf('isSignedIn');
ok(acctIdx >= 0 && importIdx > acctIdx, '账号分支先于另建实例(登录时走不到匿名)');
ok(/signInAnonymously|anonymousAuthProvider/.test(appFn), '未登录仍保留匿名回退');

/* ② 缓存作废 */
ok(/resetApp/.test(src), '导出 resetApp 供作废缓存');
ok(/hsn-auth-changed[\s\S]{0,120}_cb\s*=\s*null/.test(src), '监听登录态变化并作废缓存实例');
ok(/HansenCloudSave[\s\S]{0,80}resetApp/.test(auth), '登录成功后调用 resetApp');

/* ③ 运行时：模拟已登录，确认走账号实例 */
const win = { HANSEN_CLOUD_CONFIG:{envId:'e'},
  localStorage:{ _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];}, get length(){return Object.keys(this._d).length;}, key(i){return Object.keys(this._d)[i]||null;} },
  document:{ addEventListener(){}, documentElement:{classList:{contains:()=>false}}, getElementById:()=>null, querySelector:()=>null },
  crypto:{ getRandomValues:(a)=>a, subtle:{ digest:()=>Promise.resolve(new ArrayBuffer(32)) } },
  addEventListener(){}, setTimeout:(f)=>{f&&f();return 0;}, setInterval:()=>0,
  TextEncoder, TextDecoder, btoa:(s)=>Buffer.from(s,'binary').toString('base64'), atob:(s)=>Buffer.from(s,'base64').toString('binary') };
win.window = win;
const ctx = { ...win, window: win };
vm.createContext(ctx);
try { vm.runInContext(src, ctx); } catch(e){ console.log('load:', String(e.message).slice(0,70)); }
const CS = win.HansenCloudSave;
ok(!!CS && typeof CS.resetApp==='function', 'resetApp 运行时可用');
let usedAccountApp = false;
win.HansenAuth = { isSignedIn:()=>true, currentUser:()=>({uid:'U1'}), readLocal:()=>({uid:'U1'}),
  _app: ()=>{ usedAccountApp = true; return Promise.resolve({ database:()=>({}), auth:()=>({}) }); } };
/* provider()._app 是内部的，通过 accountHasCloudSave 间接触发 */
await CS.accountHasCloudSave().catch(()=>{});
ok(usedAccountApp, '已登录时确实调用了账号的 _app()(未另开匿名实例)');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
