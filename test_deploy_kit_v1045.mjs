/* test_deploy_kit_v1045.mjs —— 部署工具包随包交付回归
 * 事故：用户打开网址被下载 `file.html`。经完整排查确认代码与包结构均正常，
 *   真因是**上传时丢了文件类型信息**，COS 把 index.html 标成 application/octet-stream。
 *   而这一步用户绕不过去（v1044 的 SW 兜底救不了首次访问）。
 * 因此本版把"能一次做对"的东西打进部署包：
 *   ① cloudbaserc.json —— 预填 envId，让 `tcb hosting deploy` 一键上传，
 *      命令行按扩展名自动贴对 Content-Type，从根上不再出这个问题；
 *   ② 部署说明 —— 三种上传方式 + 如何判断是单文件还是整批问题。
 * 合同：两个文件必须真的在部署包里（它们不是 .html/.js，默认会被白名单挡掉）；
 *   envId 必须与线上配置一致；index.html 仍在根层。 */
import fs from 'node:fs'; import zlib from 'node:zlib';
let pass=0,fail=0; const ok=(c,m)=>{ if(c){pass++;console.log('  OK  '+m);} else {fail++;console.log('  XX  '+m);} };
console.log('部署工具包 v1045');

/* 解析 zip 中央目录取文件名（避免额外依赖） */
function zipNames(buf){
  const names=[]; const sig=Buffer.from([0x50,0x4b,0x01,0x02]);
  let i=0;
  while((i=buf.indexOf(sig,i))!==-1){
    const nlen=buf.readUInt16LE(i+28);
    names.push(buf.slice(i+46,i+46+nlen).toString('utf8'));
    i+=46+nlen;
  }
  return names;
}
const zpath = fs.readdirSync('/home/claude/work/repo/release-assets')
  .filter(f=>f.includes('可直接部署')&&f.endsWith('.zip'))[0];
ok(!!zpath, '找到部署包: '+zpath);
const names = zipNames(fs.readFileSync('/home/claude/work/repo/release-assets/'+zpath));
ok(names.length>2000, `包内文件 ${names.length} 个`);
ok(names.includes('index.html'), 'index.html 在包根层');
ok(names.includes('cloudbaserc.json'), 'cloudbaserc.json 已随包交付（一键部署配置）');
ok(names.some(n=>n.includes('部署说明')), '部署说明已随包交付');

/* 配置内容正确性 */
const cfg = JSON.parse(fs.readFileSync('/home/claude/work/repo/cloudbaserc.json','utf8'));
const live = fs.readFileSync('/home/claude/work/repo/hansen_cloud_config_v965.js','utf8');
const liveEnv = (live.match(/envId:\s*'([^']+)'/)||[])[1];
ok(cfg.envId === liveEnv, `配置里的 envId 与线上一致（${cfg.envId}）`);
ok(cfg.framework && cfg.framework.plugins && cfg.framework.plugins.site, '含 website 插件配置');
const ig = cfg.framework.plugins.site.inputs.ignore || [];
ok(ig.some(x=>x.includes('release-assets')) && ig.some(x=>x.includes('test_')),
   '忽略清单排除了发布产物与测试文件（不会被传上线）');

/* 说明文档要把"必须解压"和"SW 兜底的边界"讲清楚 */
const doc = fs.readFileSync('/home/claude/work/repo/部署说明_解决打开变下载.md','utf8');
ok(/必须先解压/.test(doc), '说明强调"必须先解压"（直接传 zip 会下载压缩包）');
ok(/tcb hosting deploy/.test(doc), '说明给出命令行一键上传命令');
ok(/Content-Disposition/.test(doc) && /inline/.test(doc), '说明给出单文件应急修法(Content-Disposition: inline)');
ok(/救不了首次访问|从未渲染/.test(doc), '说明诚实交代 SW 兜底救不了首次访问');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
