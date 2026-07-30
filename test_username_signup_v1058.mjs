/* test_username_signup_v1058.mjs —— v1058 失败合同墓碑
 * v1058 曾用不可收件的内部邮箱伪装“用户名直接注册”。真实 SDK 只会发验证，
 * 所以 v1075 永久撤销该承诺。本测试防止失败方案被重新塞回产品。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const auth = fs.readFileSync(path.join(ROOT, 'hansen_auth_v1004.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'hansen_auth_ui_v1004.js'), 'utf8');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } }
console.log('v1058 假邮箱注册墓碑');
ok(!/@u\.wordadventure\.local/.test(auth), '不再生成不可收件的内部邮箱');
ok(!/signUpWithEmailAndPassword\s*\(/.test(auth), '不再把“已发验证”误判成注册成功');
ok(/function registerByPassword\(\)/.test(auth) && /请先在手机号页完成真实注册/.test(auth),
   '旧 API 只返回清晰迁移提示，不发伪注册请求');
ok(!/_pwReg|auPwToggle|不需要手机号/.test(ui), '界面不再承诺无需手机号直接注册');
ok(/auNewUser/.test(ui) && /auNewPwd2/.test(ui), '新手机号注册在真实短信事务内设置用户名密码');
console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail === 0 ? 0 : 1);
