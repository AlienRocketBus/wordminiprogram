const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_session_persist_v1031.mjs —— 登录会话持久化一致性回归
 * 事故：用户在微信与浏览器两处登录同一账号，从云端拉取仍报「云端没有这把密钥对应的存档」。
 *   根因：账号模块用 auth() **未声明 persistence**，默认只在当前会话内有效——
 *   页面一刷新 CloudBase 登录会话就没了，而本地标记仍写着"已登录"；
 *   云存档于是拿着**未认证**的实例去读账号名下文档，永远读不到。
 *   （云存档模块本身用的是 persistence:'local'，两处不一致。）
 * 合同：两处持久化策略必须一致为 local；并提供 verifySession 真实探测，
 *       让"以为登录着其实没有"这种状态能被自检面板当场戳破。 */
import fs from 'node:fs';
const a = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'),'utf8');
const cs = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'),'utf8');
const dg = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_diag_v1027.js'),'utf8');
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('登录会话持久化 v1031');
ok(/_app\.auth\(\{\s*persistence:\s*'local'\s*\}\)/.test(a), '账号模块声明 persistence:local');
ok(/auth\(\{\s*persistence:\s*'local'\s*\}\)/.test(cs), '云存档模块同样是 persistence:local');
const aP=(a.match(/persistence:\s*'(\w+)'/)||[])[1], cP=(cs.match(/persistence:\s*'(\w+)'/)||[])[1];
ok(aP===cP && !!aP, `两处持久化策略一致(${aP} / ${cP})`);
ok(/function verifySession/.test(a) && /verifySession:/.test(a), '提供 verifySession 真实探测并导出');
ok(/verifySession/.test(dg), '自检面板已接入会话探测');
ok(/云端会话已失效/.test(dg), '会话失效时给出明确指引');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
