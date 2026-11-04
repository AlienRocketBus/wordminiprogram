const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
/* test_force_upload_v1039.mjs —— 「上传显示成功但一个字都没写」回归
 * 用户自检结果给出决定性证据：
 *   · 往返自检（写探针→立刻读回）**全绿** → 会话/权限/地址算法全都正常；
 *   · 但拉取真实存档报「已尝试 15 个历史地址」全部落空 → 存档确实从未写入。
 * 根因：syncNow 有一条 `if(st.lastHash === h) return {ok:true}`，
 *   **连 force 也照样跳过**。于是：早先上传过一次(写到旧地址)并记下内容指纹；
 *   之后地址算法或账号变了，用户点「立刻上传」→ 内容没变 → 跳过 →
 *   返回 ok:true、界面显示「上传成功 ✔」，而新地址上一个字都没写。
 *   前六版反复失败正因如此：每次改完地址算法，重新上传都被这条跳过。
 * 合同：① force:true 必须真写，绝不因"内容没变"跳过；
 *       ② 非 force 时除内容指纹外还要比对**上次写入的地址**，地址变了必须重写；
 *       ③ 写入成功要记录 lastDocId。 */
import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('强制上传必须真写 v1039');
const src = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_save_v965.js'),'utf8');

/* 源码层合同 */
ok(/lastDocId/.test(src), '状态中记录 lastDocId(上次写到哪儿)');
ok(/writeState\(\{[^}]*lastDocId:\s*targetId/.test(src), '写入成功后记下目标地址');
/* 🔴v1164（审查 SE-4）：force 只管「不看冷却、排在前一次后面」，**内容没变、地址没变照样跳过**；
   要「不管变没变都真写一次」用 rewrite（「立即同步」按钮、登录对账传本机那份）。
   v1039 守的那条照旧：**地址变了**（换账号 / 换算法）一定重写。 */
ok(/!opts\.rewrite\s*&&\s*st\.lastHash === h\s*&&\s*st\.lastDocId === targetId/.test(src),
   '跳过判据 = 非 rewrite + 内容未变 + **地址未变**（三者同时满足才跳）');
/* 旧判据必须已消失 */
const oldSkip = /if\(st\.lastHash === h\)\s*\n\s*return Promise\.resolve\(\{ ok:true, skipped:true/.test(src);
ok(!oldSkip, '旧的"只看内容指纹就跳过"判据已移除');
ok(/function doUpload\(/.test(src), '写入逻辑已抽为 doUpload(先算地址再决定是否写)');
/* rewrite 语义：判据里带了 !opts.rewrite，故 rewrite 必然落到写入；手动「立即同步」和登录对账都用它 */
const skipLine = (src.match(/if \(!opts\.rewrite && st\.lastHash[^\n]*/)||[''])[0];
ok(/!opts\.rewrite/.test(skipLine), 'rewrite:true 不可能命中跳过分支: '+skipLine.trim().slice(0,58));
const authUi = fs.readFileSync((__HSN_ROOT + 'hansen_auth_ui_v1004.js'), 'utf8');
const authSrc = fs.readFileSync((__HSN_ROOT + 'hansen_auth_v1004.js'), 'utf8');
ok(/force:\s*true,\s*rewrite:\s*true/.test(authUi) && /syncNow\(\{ force: true, rewrite: true \}\)/.test(authSrc),
   '孩子自己点的「立即同步」/「存到云端」带 rewrite —— 他要的就是「现在就在云上」');
/* 注释里要留下为什么，避免以后又被"优化"掉 */
ok(/连 force 也照样跳过|force 一律真写/.test(src), '代码注释记录了此坑的来由');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
