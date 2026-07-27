/* test_auth_errors_v1009.mjs —— 登录错误翻译回归（纯函数，无需网络）
 * 事故：v1004 的翻译正则过宽，把「注册参数错误」也误报成「验证码不对」，
 *       用户明明输对验证码却看到「验证码不对」，导致排查方向被带偏。
 * 合同：① 真正的验证码错误才说验证码；② 未识别错误必须原样透出，不得编造。 */
import vm from 'node:vm'; import fs from 'node:fs';
const ctx={window:{HANSEN_CLOUD_CONFIG:{envId:'x'}}}; ctx.window.window=ctx.window; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('/home/claude/work/repo/hansen_auth_v1004.js','utf8'), ctx);
const A=ctx.window.HansenAuth, f=A.friendly;
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('登录错误翻译 v1009');
[['verification code invalid','验证码'],['invalid verification_code','验证码'],
 ['verification_code expired','验证码'],['origin not allowed 403','安全域名'],
 ['sms service not enabled','短信'],['too many requests','频繁'],
 ['user already exist','有人用了'],['password incorrect','密码']
].forEach(([inp,want])=>ok(f(new Error(inp)).includes(want), inp+' → 含「'+want+'」'));
/* 未识别错误必须原样透出 */
const raw='BACKEND_PARAM_MISMATCH_XYZ';
ok(f(new Error(raw)).includes(raw), '未识别错误原样透出(不编造)');
/* 注册参数类错误绝不能被误报成验证码问题 */
ok(!f(new Error('invalid parameter: phone_number')).includes('验证码不对'), '参数错误不误报为验证码错');
/* 手机号归一 */
ok(A.normPhone('15550836896')==='+86 15550836896','11位手机号归一');
ok(A.normPhone('155 5083 6896')==='+86 15550836896','带空格归一');
ok(A.normPhone('123')===null,'非法号返回 null');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
