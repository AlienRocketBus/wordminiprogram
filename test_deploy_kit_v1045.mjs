const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走，不写死路径（审查 TI-7：在别的检出目录里跑，测的得是那一份代码） */
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
/* 🔴v1153：**没有包时跳过，不判失败。**

   这个测试硬依赖 `release-assets/` 里的构建产物，形成了死循环：

     打包前 → 没有包 → 这个测试红 → 闸门不放行 → 打不了包

   实际撞上了：重新打包前要先清空旧包，闸门就再也过不去。

   包是**构建产物**，不是源码 —— 测试不该假设它一定存在。
   有包就验（那是它真正的价值：验包的内容对不对），
   没包就说明"这轮还没打包"，跳过即可。
   `package_release.py` 本身有完整的出包契约校验，那一层不会漏。 */
/* 🔴v1164（审查 R2-3）：部署包里不许混进开发记录（攻坚笔记/ 里的工作流脚本、改过的代码副本、截图）——
   以前 263 个记录文件跟着「可直接部署」包上了静态托管，人人都能下载。
   不依赖构建产物：直接用 package_release.py 自己挑部署文件的那段代码数一遍。 */
{
  const { execFileSync } = await import('node:child_process');
  const py = `import sys, json\nsys.path.insert(0, ${JSON.stringify(__HSN_ROOT)})\nimport package_release as pr\nfrom pathlib import Path\n`
    + `names=[rel for _, rel in pr._iter_files('deploy', Path('/nonexistent-release-out'))]\n`
    + `print(json.dumps({'n': len(names), 'tops': sorted({r.split('/')[0] for r in names if '/' in r}), 'allow': sorted(pr.DEPLOY_ALLOWED_TOP_DIRS)}))`;
  let info = null, err = '';
  try { info = JSON.parse(execFileSync('python3', ['-c', py], { encoding: 'utf8' }).trim().split('\n').pop()); }
  catch (e) { err = String((e && e.stderr) || e).slice(0, 300); }
  ok(info && info.n > 2000, `部署文件清单算得出来（${info ? info.n + ' 个' : err}）`);
  ok(info && !info.tops.includes('攻坚笔记'), '★ 部署包里没有「攻坚笔记」—— 开发记录不上网站');
  ok(info && info.tops.every((t) => info.allow.includes(t)), `★ 部署包的顶层文件夹全在运行时白名单里（${info ? info.tops.join(',') : ''}）`);
  /* 合同本身会咬：往仓库里放一个新的记录文件夹 + .js，打包必须报错，而不是悄悄发布出去 */
  const probeDir = __HSN_ROOT + '_tmp_records_probe_v1164';
  let threw = false;
  try {
    fs.mkdirSync(probeDir, { recursive: true });
    fs.writeFileSync(probeDir + '/leak.js', '/* 记录 */');
    try { execFileSync('python3', ['-c', py], { encoding: 'utf8', stdio: 'pipe' }); }
    catch (e) { threw = /unknown top-level folder/.test(String(e.stderr || '')); }
  } finally { try { fs.rmSync(probeDir, { recursive: true, force: true }); } catch (e) { /* 清掉 */ } }
  ok(threw, '★ 新冒出来的非运行时文件夹（带 .js）会让打包直接报错，不会被发布出去');
}

const zpath = fs.readdirSync((__HSN_ROOT + 'release-assets'))
  .filter(f=>f.includes('可直接部署')&&f.endsWith('.zip'))[0];
if (!zpath) {
  console.log('  ⏭  release-assets 里还没有部署包 —— 包内容那几条跳过（打包后会真正验一遍）');
  /* 上面「部署清单不带开发记录」那几条不依赖包，照样算数 */
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败（包内容已跳过）`);
  process.exit(fail ? 1 : 0);
}
ok(!!zpath, '找到部署包: '+zpath);
const names = zipNames(fs.readFileSync((__HSN_ROOT + 'release-assets/')+zpath));
ok(names.length>2000, `包内文件 ${names.length} 个`);
ok(names.includes('index.html'), 'index.html 在包根层');
ok(names.includes('cloudbaserc.json'), 'cloudbaserc.json 已随包交付（一键部署配置）');
ok(names.some(n=>n.includes('部署说明')), '部署说明已随包交付');

/* 配置内容正确性 */
const cfg = JSON.parse(fs.readFileSync((__HSN_ROOT + 'cloudbaserc.json'),'utf8'));
const live = fs.readFileSync((__HSN_ROOT + 'hansen_cloud_config_v965.js'),'utf8');
const liveEnv = (live.match(/envId:\s*'([^']+)'/)||[])[1];
ok(cfg.envId === liveEnv, `配置里的 envId 与线上一致（${cfg.envId}）`);
ok(cfg.framework && cfg.framework.plugins && cfg.framework.plugins.site, '含 website 插件配置');
const ig = cfg.framework.plugins.site.inputs.ignore || [];
ok(ig.some(x=>x.includes('release-assets')) && ig.some(x=>x.includes('test_')),
   '忽略清单排除了发布产物与测试文件（不会被传上线）');

/* 说明文档要把"必须解压"和"SW 兜底的边界"讲清楚 */
const doc = fs.readFileSync((__HSN_ROOT + '部署说明_解决打开变下载.md'),'utf8');
ok(/必须先解压/.test(doc), '说明强调"必须先解压"（直接传 zip 会下载压缩包）');
ok(/tcb hosting deploy/.test(doc), '说明给出命令行一键上传命令');
ok(/Content-Disposition/.test(doc) && /inline/.test(doc), '说明给出单文件应急修法(Content-Disposition: inline)');
ok(/救不了首次访问|从未渲染/.test(doc), '说明诚实交代 SW 兜底救不了首次访问');
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail===0?0:1);
