/* test_release_published_runtime_v1165.mjs —— 同一个版本号，不能带着不一样的代码再打一次包
 *
 * 复查（v1165 第 1 轮 SH8）：SW 把带 ?v=<版本号> 的脚本当成「这一版只有这一份」，缓存里有就直接用、不再联网。
 *   要是没跑 bump_version.py 就把改过的代码按老版本号发出去（比如一次「快速热修」），老孩子手机里会一直用缓存里的旧脚本。
 *   打包器以前只查缓存代号和 ?v= 戳 —— 没升版本号、代码却改了几十个文件的树（就是现在这棵）照样能打包。
 *
 * 合同（静态，调用 package_release.py 里的检查函数，不真的打包）：
 *   ① 现在这棵树还是 VERSION 1163、运行时代码和发布的 v1163 不一样 → 打包前的检查拒绝，并让人先运行 bump_version.py
 *   ② 临时小树：记下 v7 的指纹 → 原样打包放行；改一个 .js → 拒绝并写出是哪个文件；没记过的版本号不查；记录读不出来也拒绝
 *   ③ 已经记过的版本不能覆盖；记录只进源码包，不进部署包
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const py = code => {
  const r = spawnSync('python3', ['-I', '-c', `
import importlib.util, sys, json
from pathlib import Path
spec = importlib.util.spec_from_file_location('pr_t', ${JSON.stringify(path.join(ROOT, 'package_release.py'))})
P = importlib.util.module_from_spec(spec); sys.modules['pr_t'] = P; spec.loader.exec_module(P)
def check(v, root):
    try:
        P._verify_published_runtime_unchanged(v, Path(root)); return 'ok'
    except RuntimeError as e:
        return 'refused: ' + str(e)
${code}
`], { encoding: 'utf8' });
  return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status };
};

console.log('\n▶ ① 现在这棵树（VERSION ' + fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() + '）');
{
  const r = py(`print(check(open(${JSON.stringify(path.join(ROOT, 'VERSION'))}).read().strip(), ${JSON.stringify(ROOT)}))`);
  console.log('     ' + (r.out || r.err).slice(0, 220));
  const v = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  const recPath = path.join(ROOT, 'release_published_runtime.json');
  const rec = fs.existsSync(recPath) ? JSON.parse(fs.readFileSync(recPath, 'utf8')) : null;
  ok(!!(rec && rec.versions && rec.versions['1163'] && Object.keys(rec.versions['1163'].files || {}).length > 100), '记着已发布的 v1163 每个运行时代码文件的指纹（release_published_runtime.json）');
  const published = !!(rec && rec.versions && rec.versions[v]);
  if (published) ok(/^refused: /.test(r.out) && /bump_version\.py/.test(r.out), `v${v} 已发布过、代码变了 → 拒绝打包，并让人先运行 bump_version.py`);
  else ok(r.out === 'ok', `v${v} 是还没发布过的新版本号 → 不拦（${r.out || r.err}）`);
}

console.log('\n▶ ② 临时小树');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hsn-pub-'));
  fs.writeFileSync(path.join(tmp, 'VERSION'), '7\n');
  fs.writeFileSync(path.join(tmp, 'hansen_a.js'), 'window.a=1;\n');
  fs.writeFileSync(path.join(tmp, 'index.html'), '<script src="hansen_a.js?v=7"></script>\n');
  fs.mkdirSync(path.join(tmp, 'node_modules')); fs.writeFileSync(path.join(tmp, 'node_modules', 'x.js'), 'x');
  const r = py(`
root = Path(${JSON.stringify(tmp)})
rec = P._record_published_runtime('7', root, note='测试')
print(json.dumps(sorted(rec['files'].keys()), separators=(',', ':')))
print(check('7', root))
(root / 'hansen_a.js').write_text('window.a=2;\\n')
print(check('7', root))
print(check('8', root))
try:
    P._record_published_runtime('7', root); print('overwrote')
except RuntimeError as e:
    print('refused overwrite')
(root / P.PUBLISHED_RUNTIME_FILE).write_text('{坏的')
print(check('7', root))
print('deploy_allowed_record', P._deploy_allowed(__import__('pathlib').PurePosixPath(P.PUBLISHED_RUNTIME_FILE)))
`);
  const lines = r.out.split('\n');
  console.log('     ' + (r.err ? r.err.slice(-300) : lines.map(l => l.slice(0, 90)).join(' | ')));
  ok(lines[0] === '["hansen_a.js","index.html"]', `只记部署包里的运行时代码（${lines[0]}）`);
  ok(lines[1] === 'ok', '内容没变 → 放行');
  ok(/^refused: /.test(lines[2] || '') && /hansen_a\.js/.test(lines[2]), `改了 hansen_a.js、版本号没变 → 拒绝，并写出是哪个文件`);
  ok(lines[3] === 'ok', '没记过的版本号（v8）不查');
  ok(lines[4] === 'refused overwrite', '已经记过的版本不能覆盖');
  ok(/^refused: /.test(lines[5] || ''), '记录文件读不出来 → 也拒绝（宁可不打包，也不能把旧缓存钉死）');
  ok(lines[6] === 'deploy_allowed_record False', '记录文件不进部署包');
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\n▶ ③ 打包流程里真的会查');
{
  const src = fs.readFileSync(path.join(ROOT, 'package_release.py'), 'utf8');
  const pkg = src.slice(src.indexOf('def package('), src.indexOf('print(f"[1/3]'));
  ok(/_verify_published_runtime_unchanged\(canonical_version\)/.test(pkg), 'package() 在写任何 ZIP 之前先做这个检查');
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 同一个版本号不能带着不一样的代码再打包');
process.exit(fails ? 1 : 0);
