/* test_release_autorecord_v1165.mjs —— 打包时自动记下这一版的运行时指纹；开发记录（攻坚笔记）不进部署包
 *
 * 复查（v1165 第 2 轮）：
 *   R2-01：「同一个版本号、运行时代码变了就拒绝打包」只保护了 v1163 —— 记录要人手调 _record_published_runtime() 补，
 *          从来没有地方调它。v1165 发出去以后，改一个 .js 不升版本号再打包，照样放行（老孩子会一直用缓存里的旧脚本）。
 *   R2-SH-04 / R2-03：部署包里带着 攻坚笔记/v1165_inputs/fix_v1165_plan_reference.js（内部工作流脚本、本机路径、会话链接），
 *          老师用控制台「上传文件夹」时它就上了公网。cloudbaserc.json 的 ignore 早写了「攻坚笔记/**」，可那只管 tcb 命令行。
 *
 * 合同（调用 package_release.py 本身，在临时小树里真的打包，不碰仓库）：
 *   （临时小树用打包器专门留给单元测试的 v942 / v943 —— 它们不查缓存代号合同，别的版本号要先在 release_contracts 登记）
 *   ① 打包 v942（第一次）→ 成功，并自动记下 v942 的指纹（不用人手补）；原样再打一次 → 成功、两次的包一模一样
 *   ② 改一个 .js、版本号不变再打包 → 拒绝，并写出是哪个文件、让人先 bump_version.py
 *   ③ 升到 v943 再打包 → 成功，也记下了 v943
 *   ④ 真仓库：部署包的文件清单里没有任何 攻坚笔记/ 下的文件；cloudbaserc.json 里每个「目录/**」忽略项都在 DEPLOY_EXCLUDE_DIRS 里
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const PY = String.raw`
import importlib.util, sys, json, os, tempfile, hashlib
from pathlib import Path, PurePosixPath
os.environ['HANSEN_SKIP_JARVIS'] = '1'   # 体检凭证由 jarvis_gate 管，这里只测打包器自己
ROOT = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('pr_auto', ROOT / 'package_release.py')
P = importlib.util.module_from_spec(spec); sys.modules['pr_auto'] = P; spec.loader.exec_module(P)
out = {}
tmp = Path(tempfile.mkdtemp(prefix='hsn-autorec-'))
src = tmp / 'source'; src.mkdir()
for name in P.SOURCE_REQUIRED_FILES:
    f = src / name; f.parent.mkdir(parents=True, exist_ok=True)
    if not f.exists(): f.write_text('placeholder\n', encoding='utf-8')
(src / 'VERSION').write_text('942\n', encoding='utf-8')
(src / 'README.md').write_text('# test\n', encoding='utf-8')
(src / 'index.html').write_text('<!doctype html><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="favicon.ico"><script src="app.js?v=942"></script>', encoding='utf-8')
(src / 'app.js').write_text('window.ok = 1;\n', encoding='utf-8')
(src / 'sw_v944.js').write_text("const SHELL = ['./index.html','./manifest.webmanifest','./favicon.ico','./app.js'];\n", encoding='utf-8')
(src / 'manifest.webmanifest').write_text('{"start_url":"./index.html","icons":[{"src":"favicon.ico"}]}', encoding='utf-8')
(src / 'favicon.ico').write_bytes(b'icon')
P.ROOT = src
def pack(v, name):
    o = tmp / name
    try:
        P.package(v, o); return 'ok'
    except Exception as e:
        return 'refused: ' + str(e)
def recorded():
    f = src / P.PUBLISHED_RUNTIME_FILE
    return sorted((json.loads(f.read_text(encoding='utf-8')).get('versions') or {}).keys()) if f.is_file() else []
def sha(name, v):
    return hashlib.sha256((tmp / name / P.DEPLOY_NAME.format(version=v)).read_bytes()).hexdigest()
out['first'] = pack('942', 'out1'); out['rec1'] = recorded()
out['again'] = pack('942', 'out1b'); out['same'] = out['again'] == 'ok' and sha('out1', '942') == sha('out1b', '942')
(src / 'app.js').write_text('window.ok = 2;   // 热修\n', encoding='utf-8')
out['changed'] = pack('942', 'out2')
(src / 'VERSION').write_text('943\n', encoding='utf-8')
(src / 'index.html').write_text((src / 'index.html').read_text(encoding='utf-8').replace('?v=942', '?v=943'), encoding='utf-8')
out['bumped'] = pack('943', 'out3'); out['rec3'] = recorded()
# ④ 真仓库
P.ROOT = ROOT
files = [arc for _, arc in P._iter_files('deploy', tmp / 'real_out')]
out['deploy_n'] = len(files)
out['notes'] = [f for f in files if f.startswith('攻坚笔记/')]
cb = json.loads((ROOT / 'cloudbaserc.json').read_text(encoding='utf-8'))
ign = cb['framework']['plugins']['site']['inputs']['ignore']
dirs = [g[:-3] for g in ign if g.endswith('/**')]
out['cb_dirs'] = dirs
out['missing_dirs'] = [d for d in dirs if d not in P.DEPLOY_EXCLUDE_DIRS]
out['ref_allowed'] = P._deploy_allowed(PurePosixPath('攻坚笔记/v1165_inputs/fix_v1165_plan_reference.js'))
print(json.dumps(out, ensure_ascii=False))
`;
const r = spawnSync('python3', ['-I', '-c', PY, ROOT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const last = (r.stdout || '').trim().split('\n').pop();
let o = null; try { o = JSON.parse(last); } catch (e) {}
if (!o) { console.log((r.stdout || '').slice(-1500)); console.log((r.stderr || '').slice(-1500)); ok(false, '打包脚本没跑完'); }
else {
  console.log('\n▶ ① 第一次打包 v942');
  ok(o.first === 'ok', `打包成功（${o.first.slice(0, 120)}）`);
  ok(o.rec1.includes('942'), `自动记下了 v942 的指纹（记录里有：${o.rec1.join(', ') || '没有'}）`);
  ok(o.same, `原样再打一次也成功，两次的部署包一模一样（${o.again.slice(0, 80)}）`);
  console.log('\n▶ ② 改了 app.js、版本号没变');
  ok(/^refused: /.test(o.changed) && /app\.js/.test(o.changed) && /bump_version\.py/.test(o.changed), `拒绝打包，写出是哪个文件、让人先升版本号（${o.changed.slice(0, 160)}）`);
  console.log('\n▶ ③ 升到 v943');
  ok(o.bumped === 'ok' && o.rec3.includes('943'), `打包成功、也记下了 v943（${o.bumped.slice(0, 80)}；记录 ${o.rec3.join(', ')}）`);
  console.log('\n▶ ④ 真仓库的部署包');
  ok(o.deploy_n > 1000 && o.notes.length === 0, `部署包 ${o.deploy_n} 个文件，攻坚笔记/ 下的 ${o.notes.length} 个（${o.notes.slice(0, 3).join(', ')}）`);
  ok(!o.ref_allowed, '攻坚笔记/v1165_inputs/fix_v1165_plan_reference.js 不算可部署文件');
  ok(o.missing_dirs.length === 0 && o.cb_dirs.includes('攻坚笔记'), `cloudbaserc.json 忽略的目录（${o.cb_dirs.join(' ')}）都在 DEPLOY_EXCLUDE_DIRS 里（缺：${o.missing_dirs.join(' ') || '没有'}）`);
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 打包时自动记下发布指纹；开发记录不进部署包');
process.exit(fails ? 1 : 0);
