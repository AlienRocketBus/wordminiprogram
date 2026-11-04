const __HSN_ROOT = decodeURIComponent(new URL('.', import.meta.url).pathname);   /* 仓库根目录跟着测试文件走 */
/* test_gate_cloud_limits_v1164.mjs —— 闸门给真 SDK 端到端测试的时间够不够、超时算不算失败（审查 T10）
 *
 * 起因：直接跑 `python3 jarvis_gate.py`（没有深度档、没有上次的耗时记录）时，
 *   真 SDK 端到端（test_*cloud*_v1164.mjs，单跑 2~5 分钟）只给 45 秒、补跑 135 秒 ——
 *   17 个里 10 个超时，记成「不计失败」、写进慢名单，之后普通档干脆跳过它们。
 *   闸门说「失败 0 个」，天梯和房间的修复一个都没验。
 *
 * 这里不靠读注释：用 Python 把闸门里真的那两个函数（_is_cloud / _limit_for）拿出来跑一遍，
 * 仓库里每一个 *cloud*_v1164 测试都要拿到 600 秒；再看超时的处理：真 SDK 测试超时算失败、永不进慢名单、
 * 已经在慢名单里的也照跑。分批跑测试.py 的时限也要一样。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  OK  ' + m); } else { fail++; console.log('  XX  ' + m); } };
console.log('闸门：真 SDK 端到端的时限和超时处理（审查 T10）');

const gatePath = path.join(__HSN_ROOT, 'jarvis_gate.py');
const gate = fs.readFileSync(gatePath, 'utf8');
const code = gate.replace(/#[^\n]*/g, '');
const cloudTests = fs.readdirSync(__HSN_ROOT).filter((f) => /^test_.*cloud.*_v1164\.mjs$/.test(f)).sort();
const otherTests = ['test_gate_schedule_v1151.mjs', 'test_pk_room_v1065.mjs', 'test_ladder_contrast_v1156.mjs'];
ok(cloudTests.length >= 10, `仓库里有 ${cloudTests.length} 个真 SDK 端到端测试`);

/* ① 把闸门里的 _is_cloud / _limit_for 原样拿出来跑 */
const py = `
import ast, json, sys
src = open(sys.argv[1], encoding='utf-8').read()
tree = ast.parse(src)
fns = {}
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name in ('_is_cloud', '_limit_for', '_limit'):
        fns[node.name] = node
out = {'found': sorted(fns)}
if '_is_cloud' in fns and '_limit_for' in fns:
    mod = ast.Module(body=[fns['_is_cloud'], fns['_limit_for']], type_ignores=[])
    res = {}
    for deep in (False, True):
        g = {'per_timeout': 120 if deep else 45}
        exec(compile(mod, 'jarvis_gate_fns', 'exec'), g)
        names = json.loads(sys.argv[2])
        res['deep' if deep else 'normal'] = {n: [g['_is_cloud'](n), g['_limit_for'](n), g['_limit_for'](n, True)] for n in names}
    out['res'] = res
print(json.dumps(out))
`;
const names = cloudTests.concat(otherTests);
const r = spawnSync('python3', ['-c', py, gatePath, JSON.stringify(names)], { encoding: 'utf8' });
let got = null;
try { got = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (e) { got = null; }
ok(got && got.found.includes('_is_cloud') && got.found.includes('_limit_for'), `闸门里有 _is_cloud / _limit_for（找到：${got ? got.found.join(', ') : String(r.stderr).slice(0, 200)}）`);
if (got && got.res) {
  for (const mode of ['normal', 'deep']) {
    const bad = cloudTests.filter((n) => { const v = got.res[mode][n]; return !(v && v[0] === true && v[1] >= 600 && v[2] >= 600); });
    ok(!bad.length, `★ ${mode === 'normal' ? '普通档' : '深度档'}：每个真 SDK 端到端测试都认得出、都给 600 秒（没给够的：${bad.join(', ') || '没有'}）`);
    const wrong = otherTests.filter((n) => { const v = got.res[mode][n]; return !(v && v[0] === false && v[1] < 600); });
    ok(!wrong.length, `${mode === 'normal' ? '普通档' : '深度档'}：普通测试还是原来的时限（${wrong.join(', ') || '对'}）`);
  }
}

/* ② 超时怎么算 */
ok(/subprocess\.run\(\[[^\]]*\][^)]*timeout=_limit_for\(os\.path\.basename\(t\), heavy\)\)/.test(code), '★ 并行跑每个测试时用 _limit_for 的时限');
ok(/tests = \[t for t in all_tests if os\.path\.basename\(t\) not in known_slow or _is_cloud\(os\.path\.basename\(t\)\)\]/.test(code), '★ 慢名单里就算有真 SDK 测试，也照样跑（不跳过）');
ok(/suspect \+= \[x for x in slow if _is_cloud\(x\)\]/.test(code) && /slow = \[x for x in slow if not _is_cloud\(x\)\]/.test(code), '★ 真 SDK 测试超时 = 失败（进复核），不算「慢、不计失败」');
ok(/timeout=\(_limit_for\(name\) if _is_cloud\(name\) else per_timeout \+ 20\)/.test(code), '★ 复核时真 SDK 测试也给足 600 秒');
ok(/json\.dump\(sorted\(x for x in \(known_slow \| set\(slow\)\) if not _is_cloud\(x\)\)/.test(code), '★ 写慢名单时剔掉真 SDK 测试（永不进慢名单）');

/* ③ 分批跑测试.py 同一个时限 */
const batch = fs.readFileSync(path.join(__HSN_ROOT, '分批跑测试.py'), 'utf8');
const r2 = spawnSync('python3', ['-c', `
import ast, json, sys
src = open(sys.argv[1], encoding='utf-8').read()
tree = ast.parse(src)
consts = {}
fn = None
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        try: consts[node.targets[0].id] = ast.literal_eval(node.value)
        except Exception: pass
    if isinstance(node, ast.FunctionDef) and node.name == '_limit':
        fn = node
g = dict(consts)
if fn is not None:
    exec(compile(ast.Module(body=[fn], type_ignores=[]), 'batch_fns', 'exec'), g)
names = json.loads(sys.argv[2])
print(json.dumps({n: (g['_limit'](n) if '_limit' in g else None) for n in names}))
`, path.join(__HSN_ROOT, '分批跑测试.py'), JSON.stringify(names)], { encoding: 'utf8' });
let lim = null;
try { lim = JSON.parse(String(r2.stdout || '').trim().split('\n').pop()); } catch (e) { lim = null; }
const shortB = lim ? cloudTests.filter((n) => !(lim[n] >= 600)) : ['(读不出 分批跑测试.py 的 _limit)'];
ok(batch.length > 0 && !shortB.length, `★ 分批跑测试.py：每个真 SDK 端到端测试也是 600 秒（不够的：${shortB.join(', ') || '没有'}）`);

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
