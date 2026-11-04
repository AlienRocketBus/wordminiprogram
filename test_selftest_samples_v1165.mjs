/* test_selftest_samples_v1165.mjs —— 守卫自证的两个样本又能用了：「启动自检」「别攒着不发」注入后真的报红
 *
 * 复查（v1165 第 2 轮 R2-07）：jarvis_selftest 对 5 道守卫报「⏭ 注入样本不适用，跳过（需更新样本）」——
 *   样本按老写法一字不差地找，代码早就改了，找不到就跳过：这些守卫一直没有「会咬人」的证明。
 *   我们自己的两道：
 *     · 启动自检：样本找 `['HansenCoins', '金币'],`，清单行早已是三列、空格对齐的 `['HansenCoins',   '金币', 'hansen_coin_wallet'],`
 *     · 别攒着不发：样本找 `if n > 25:`，守卫早已是 `if n > 12 and os.environ.get('JARVIS_RELEASING') != '1':`
 *   （三态不分 / 前端瞎猜 / 要真跑过 是对战组的文件，交给他们。）
 *
 * 合同（直接调 jarvis_selftest 的样本函数和 hansen_guards 的守卫函数，不改仓库里任何文件）：
 *   ① 启动自检：样本能注入（不再「不适用」）；守卫对原文件不报、对注入后的文件报红
 *   ② 别攒着不发：在一个有 v 标签、标签后 1 个提交的临时仓库里 —— 样本能注入；原守卫不报（1 个 ≤ 12）、
 *      注入后的守卫报红（带着 JARVIS_RELEASING=1 也红，发版时闸门就带着它跑）
 */
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✅ ' : '  ❌ ') + m); if (!c) fails++; };
const PY = String.raw`
import importlib.util, sys, json, os, tempfile, subprocess, shutil
from pathlib import Path
ROOT = Path(sys.argv[1])
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path); m = importlib.util.module_from_spec(spec); sys.modules[name] = m; spec.loader.exec_module(m); return m
J = load('js_t', ROOT / 'jarvis_selftest.py')
G = load('hg_t', ROOT / 'hansen_guards_v1068.py')
out = {}
# ① 启动自检
src = (ROOT / 'hansen_boot_check_v1156.js').read_text(encoding='utf-8')
hurt = J._inj_boot_check(src)
out['boot_applies'] = bool(hurt) and hurt != src
def run_boot(text):
    G.PROBLEMS.clear()
    orig = G._read
    G._read = lambda name: text if name == 'hansen_boot_check_v1156.js' else orig(name)
    try: G.guard_boot_check()
    finally: G._read = orig
    return [p[0] for p in G.PROBLEMS]
out['boot_base'] = run_boot(src)
out['boot_hurt'] = run_boot(hurt) if hurt else None
# ② 别攒着不发：临时仓库（有 v 标签、标签后 1 个提交）
tmp = Path(tempfile.mkdtemp(prefix='hsn-backlog-'))
def git(*a): return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', *a], cwd=tmp, capture_output=True, text=True)
git('init', '-q'); (tmp / 'a.txt').write_text('1'); git('add', '-A'); git('commit', '-qm', 'one'); git('tag', 'v1')
(tmp / 'a.txt').write_text('2'); git('add', '-A'); git('commit', '-qm', 'two')
gsrc = (ROOT / 'hansen_guards_v1068.py').read_text(encoding='utf-8')
J.ROOT = str(tmp)   # 样本函数在这个仓库里看有没有 v 标签
bhurt = J._inj_backlog(gsrc)
out['backlog_applies'] = bool(bhurt) and bhurt != gsrc
def run_backlog(text, releasing):
    d = tmp / ('g_%d_%d' % (len(text) % 9973, releasing)); d.mkdir(exist_ok=True)
    f = tmp / 'hansen_guards_v1068.py'; f.write_text(text, encoding='utf-8')
    if releasing: os.environ['JARVIS_RELEASING'] = '1'
    else: os.environ.pop('JARVIS_RELEASING', None)
    m = load('hg_b_%d_%d' % (len(text) % 9973, releasing), f)
    m.PROBLEMS.clear(); m.guard_release_backlog()
    return [p[0] for p in m.PROBLEMS]
out['backlog_base'] = run_backlog(gsrc, False)
out['backlog_hurt'] = run_backlog(bhurt, False) if bhurt else None
out['backlog_hurt_releasing'] = run_backlog(bhurt, True) if bhurt else None
os.environ.pop('JARVIS_RELEASING', None)
shutil.rmtree(tmp, ignore_errors=True)
print(json.dumps(out, ensure_ascii=False))
`;
const r = spawnSync('python3', ['-I', '-c', PY, ROOT], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const last = (r.stdout || '').trim().split('\n').pop();
let o = null; try { o = JSON.parse(last); } catch (e) {}
if (!o) { console.log((r.stdout || '').slice(-1200)); console.log((r.stderr || '').slice(-1500)); ok(false, '自证脚本没跑完'); }
else {
  console.log('\n▶ ① 启动自检');
  ok(o.boot_applies, '样本能注入（不再「样本不适用，跳过」）');
  ok(!o.boot_base.includes('启动自检'), `原文件：守卫不报（${JSON.stringify(o.boot_base)}）`);
  ok(Array.isArray(o.boot_hurt) && o.boot_hurt.includes('启动自检'), `注入后：守卫报红（${JSON.stringify(o.boot_hurt)}）`);
  console.log('\n▶ ② 别攒着不发（临时仓库：v 标签后 1 个提交）');
  ok(o.backlog_applies, '样本能注入（不再「样本不适用，跳过」）');
  ok(!o.backlog_base.includes('别攒着不发'), `原守卫：1 个提交不报（${JSON.stringify(o.backlog_base)}）`);
  ok(Array.isArray(o.backlog_hurt) && o.backlog_hurt.includes('别攒着不发'), `注入后：守卫报红（${JSON.stringify(o.backlog_hurt)}）`);
  ok(Array.isArray(o.backlog_hurt_releasing) && o.backlog_hurt_releasing.includes('别攒着不发'), `注入后带着 JARVIS_RELEASING=1 也报红（${JSON.stringify(o.backlog_hurt_releasing)}）`);
}
console.log(fails ? `\n❌ ${fails} 项失败` : '\n✅ 两个自证样本都会咬人');
process.exit(fails ? 1 : 0);
