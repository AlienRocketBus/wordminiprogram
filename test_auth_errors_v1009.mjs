/* test_auth_errors_v1009.mjs —— 登录错误翻译回归 */
import vm from 'node:vm';import fs from 'node:fs';import path from 'node:path';import{fileURLToPath}from'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const win={HANSEN_CLOUD_CONFIG:{envId:'x'},__HANSEN_AUTH_NO_BOOT__:true,setTimeout,clearTimeout};win.window=win;
const ctx={window:win,setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(ROOT,'hansen_auth_v1004.js'),'utf8'),ctx);
const A=win.HansenAuth,f=A.friendly;let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  OK  '+m);}else{fail++;console.log('  XX  '+m);}};
console.log('登录错误翻译 v1009→v1076');
[['verification code invalid','验证码'],['invalid verification_code','验证码'],['verification_code expired','验证码'],['origin not allowed 403','安全域名'],['sms service not enabled','短信'],['too many requests','频繁'],['user already exist','有人用了'],['password incorrect','密码'],['USER_NOT_FOUND','没有找到'],['AUTH_OUTCOME_UNKNOWN','结果仍在确认']].forEach(([inp,want])=>ok(f(new Error(inp)).includes(want),inp+' → 含「'+want+'」'));
const raw='BACKEND_PARAM_MISMATCH_XYZ';ok(f(new Error(raw)).includes(raw),'未识别错误原样透出');
ok(!f(new Error('operation not allowed')).includes('安全域名'),'普通 not allowed 不误报安全域名');
ok(!f(new Error('invalid parameter: phone_number')).includes('验证码不对'),'参数错误不误报验证码');
ok(A.normPhone('15550836896')==='+86 15550836896','11位手机号归一');
ok(A.normPhone('155 5083 6896')==='+86 15550836896','带空格归一');
ok(A.normPhone('123')===null,'非法号返回 null');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);process.exit(fail===0?0:1);
