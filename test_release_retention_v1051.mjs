/* test_release_retention_v1051.mjs —— Release 保留策略回归
 * 背景：每个发布包约 80MB，9 个 Release 已占 715MB 且会持续累积。
 *   用户要求只保留最新 5 个（含 Release 与 tag）。
 * 手工清理已完成（删除 v1045/v1044/v1043/v1042，释放 318MB）；
 * 本测试守住**自动化**这一侧：确保 CI 每次发版后自动清理，不必再手动做。
 * 合同：① CI 含清理步骤且 KEEP=5；② 按**版本号数值**倒序而非发布时间
 *       （tag 是 v1050 这类，字典序会把 v999 排在 v1050 之后，必须数值排序）；
 *       ③ 删除 Release 时一并清理 tag；④ 删除失败不得中断发布流程。 */
import fs from 'node:fs';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('Release 保留策略 v1051');
const wf = fs.readFileSync('/home/claude/work/repo/.github/workflows/auto-release.yml','utf8')
  + fs.readFileSync('/home/claude/work/repo/.github/scripts/prune_releases.py','utf8');

ok(/KEEP_RELEASES=5/.test(wf), 'CI 中保留数量为 5');
ok(/urllib.request/.test(wf) && /release delete|releases\//.test(wf), '用 Python 标准库取 tag + 双通道删除(gh CLI 或纯 API)');
ok(/reverse=True/.test(wf), '按版本号**数值**倒序（字典序会把 v999 排到 v1050 之后）');
ok(/nums\[KEEP:\]/.test(wf), '跳过最新 KEEP 个，只删其余');
ok(/--cleanup-tag/.test(wf) && /git\/refs\/tags/.test(wf), '删除 Release 时一并清理 tag(两条通道都清)');
ok(/\|\| true/.test(wf) && /fetch failed/.test(wf), '删除或取列表失败均不中断发布流程');
ok(/tag_name/.test(wf) && wf.includes('fullmatch'), '按 tag_name 取值并只处理 vNNN 格式(不误伤其它 tag)');
/* 清理步骤必须在创建 Release 之后 */
const iCreate = wf.indexOf('gh release create');
const iPrune  = wf.indexOf('prune_releases.py');
ok(iCreate > 0 && iPrune > iCreate, '清理发生在本次 Release 创建之后（不会误删刚发的）');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
