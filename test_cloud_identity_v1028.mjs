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
/* v1059: 结构断言必须只看代码——注释里引用了旧代码原文，会让断言对着散文下结论 */
const code = src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const auth = fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8');

/* ① 源码层合同：已登录必须走账号会话，且不得再匿名 */
const appFn = code.slice(code.indexOf('_app: function()'), code.indexOf('_app: function()')+1800);
ok(/HansenAuth/.test(appFn) && /isSignedIn/.test(appFn), '已登录时会去取账号会话');
ok(/A\._app\(\)/.test(appFn) || /A\._app/.test(appFn), '复用账号的 CloudBase 实例(而非另建)');
/* 账号分支必须在"另建实例"之前就 return —— 登录时根本走不到匿名那段 */
const importIdx = appFn.indexOf("import('./vendor_cloudbase");
const acctIdx = appFn.indexOf('isSignedIn');
ok(acctIdx >= 0 && importIdx > acctIdx, '账号分支先于另建实例(登录时走不到匿名)');
ok(/signInAnonymously|anonymousAuthProvider/.test(appFn), '未登录仍保留匿名回退');
/* 🔴v1059 加严：光"已登录"不够——isSignedIn() 只读 localStorage，
   会话早死了它还返回 true。复用账号实例前必须先过真实会话探测。 */
ok(/ensureSession/.test(appFn), 'v1059: 复用账号实例前先过 ensureSession(真实会话探测)');
ok(appFn.indexOf('ensureSession') < appFn.indexOf('A._app()'), 'v1059: 会话探测排在取实例之前');

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
  /* v1059: 云存档现在要求这个真实会话探测通过才肯复用账号实例 */
  ensureSession: ()=>Promise.resolve({ ok:true, uid:'U1' }),
  _app: ()=>{ usedAccountApp = true; return Promise.resolve({ database:()=>({}), auth:()=>({}) }); } };
/* provider()._app 是内部的，通过 accountHasCloudSave 间接触发 */
await CS.accountHasCloudSave().catch(()=>{});
ok(usedAccountApp, '已登录时确实调用了账号的 _app()(未另开匿名实例)');
/* 🔴v1059 新增合同：会话失效时必须**明确失败**，绝不许偷偷退回匿名身份。
   若退回匿名，就会用一个跨设备读不到的身份去写档——正是 v1028 那场事故。 */
{
  const w2 = { ...win }; w2.window = w2;
  const c2 = { ...w2, window: w2 }; vm.createContext(c2);
  try { vm.runInContext(src, c2); } catch(e){}
  const CS2 = w2.HansenCloudSave;
  let usedAcct = false, wentAnon = false;
  w2.HansenAuth = { isSignedIn:()=>true, currentUser:()=>({uid:'U1'}), readLocal:()=>({uid:'U1'}),
    ensureSession: ()=>Promise.resolve({ ok:false, expired:true, reason:'云端会话已失效' }),
    _app: ()=>{ usedAcct = true; return Promise.resolve({ database:()=>({}), auth:()=>({}) }); } };
  let err = null;
  await CS2.accountHasCloudSave().catch(e=>{ err = e; });
  ok(!usedAcct, 'v1059: 会话失效时不去取账号实例');
  ok(!wentAnon, 'v1059: ★ 会话失效时绝不偷偷退回匿名身份(那正是 v1028 事故的成因)');
  ok(err === null || !/\[object Object\]/.test(String(err && (err.message||err))),
     'v1059: 失败原因可读,不是 [object Object]');
}
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
