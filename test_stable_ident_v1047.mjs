const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_stable_ident_v1047.mjs —— 账号标识必须在所有设备上一致
 * 决定性现象（用户实测）：同一账号，手机A ⑩ 显示"有存档"、
 *   手机B 却"没有"且拉取尝试 15 个地址全落空。
 * 根因：密钥原本由 **uid** 推导，而 uid 存在各自设备的 localStorage 里——
 *   一台可能存着登录前匿名会话留下的旧 uid，云端会话重建时 uid 也可能变。
 *   于是两台各算各的钥匙、各开各的柜子。
 * 修法：改用**手机号**作账号标识（唯一在所有设备上都相同且永不变的东西），
 *   uid 仅作兜底；并把 uid 形态的旧地址纳入兼容读取，老存档不丢。
 * 合同：① 同一手机号无论 uid 是否不同，必须算出同一密钥；
 *       ② 手机号书写差异（+86／空格／无前缀）必须归一到同一结果；
 *       ③ 不同手机号必须算出不同密钥；④ 无手机号时回退用户名/uid 仍可工作。 */
import vm from 'node:vm'; import fs from 'node:fs'; import crypto from 'node:crypto';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('账号标识跨设备一致性 v1047');
const src = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'),'utf8');
ok(/function accountIdent/.test(src), '提供 accountIdent（账号标识）');
ok(/lc\.phone/.test(src), '优先使用手机号');
ok(/replace\(\/\^\\\+\?86\//.test(src) || /\+\?86/.test(src), '手机号做了前缀归一(+86)');

function mk(){
  const store={_d:{},getItem(k){return this._d[k]||null;},setItem(k,v){this._d[k]=String(v);},
    removeItem(k){delete this._d[k];},get length(){return Object.keys(this._d).length;},key(i){return Object.keys(this._d)[i]||null;}};
  const win={ HANSEN_CLOUD_CONFIG:{envId:'e'}, localStorage:store,
    document:{addEventListener(){},getElementById:()=>null,querySelector:()=>null,documentElement:{classList:{contains:()=>false}}},
    crypto:{ getRandomValues:a=>a, subtle:{ digest:(a,b)=>Promise.resolve(crypto.createHash('sha256').update(Buffer.from(b)).digest().buffer) } },
    addEventListener(){}, setTimeout:f=>{f&&f();return 0;}, setInterval:()=>0, TextEncoder, TextDecoder,
    btoa:s=>Buffer.from(s,'binary').toString('base64'), atob:s=>Buffer.from(s,'base64').toString('binary') };
  win.window=win; const ctx={...win,window:win}; vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return win;
}
function keyFor(local){
  const w=mk();
  w.HansenAuth={ isSignedIn:()=>true, readLocal:()=>local,
    currentUser:()=>(local.uid?{uid:local.uid}:null) };
  return w.HansenCloudSave.ensureKey();
}
/* ① 同一手机号、不同 uid（正是用户两台手机的情形） */
const a = keyFor({method:'phone', phone:'+86 15550836896', uid:'UID-AAA', signedAt:1});
const b = keyFor({method:'phone', phone:'+86 15550836896', uid:'UID-BBB', signedAt:1});
ok(a===b, `同一手机号+不同uid → 同一密钥（${a}）`);
/* ② 手机号书写差异 */
const c1 = keyFor({method:'phone', phone:'15550836896', uid:'X', signedAt:1});
const c2 = keyFor({method:'phone', phone:'+8615550836896', uid:'Y', signedAt:1});
const c3 = keyFor({method:'phone', phone:'+86 155 5083 6896', uid:'Z', signedAt:1});
ok(a===c1 && a===c2 && a===c3, '带/不带 +86、有无空格 → 全部归一到同一密钥');
/* ③ 不同手机号必须不同 */
const d = keyFor({method:'phone', phone:'+86 13800138000', uid:'UID-AAA', signedAt:1});
ok(d!==a, `不同手机号 → 不同密钥（${d}）`);
/* ④ 无手机号时回退 */
const e = keyFor({method:'password', username:'Hansen', uid:'UID-AAA', signedAt:1});
const f = keyFor({method:'password', username:'hansen', uid:'UID-ZZZ', signedAt:1});
ok(e===f && !!e, '无手机号时用用户名(大小写归一)仍可工作');
const g = keyFor({method:'phone', uid:'UID-ONLY', signedAt:1});
ok(!!g && /^[A-Z0-9]{4}-/.test(g), '仅有 uid 时仍能推出合法密钥(兜底)');
/* ⑤ 兼容读取要包含旧 uid 形态的地址 */
ok(/keyFromUid\(rawUid\)/.test(src) && /legacyKeyFromUid\(rawUid\)/.test(src),
   '兼容读取已纳入旧 uid 形态的地址（老存档不丢）');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
