# 只跑几条自证样本：在给定目录（某个版本的拷贝）里注入 → 跑守卫 → 看那道守卫红没红 → 还原
import sys, os, subprocess, importlib.util, shutil
root = sys.argv[1]; names = sys.argv[2].split(',')
spec = importlib.util.spec_from_file_location('jst', os.path.join(root, 'jarvis_selftest.py'))
m = importlib.util.module_from_spec(spec); sys.path.insert(0, root); spec.loader.exec_module(m)
cases = {c[0]: c for c in m.CASES}
def red_names():
    r = subprocess.run([sys.executable, os.path.join(root, 'hansen_guards_v1068.py')], cwd=root, capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout
for nm in names:
    if nm not in cases: print(nm, '不在 CASES 里'); continue
    _, fn, inj = cases[nm][:3]
    p = os.path.join(root, fn)
    if not os.path.exists(p): print(nm, '目标文件不存在', fn); continue
    src = open(p, encoding='utf-8').read()
    bad = inj(src)
    if bad is None or bad == src: print(f'{nm}: 注入样本不适用（锚点不在 {fn} 里）'); continue
    shutil.copy(p, p + '.selftestbak')
    try:
        open(p, 'w', encoding='utf-8').write(bad)
        rc, out = red_names()
        hit = [l for l in out.split('\n') if nm in l and ('❌' in l or '- [' in l)]
        print(f'{nm}: 注入后守卫 rc={rc}，{"变红 ✅" if hit else "依然全绿 ❌"}  {hit[:1]}')
    finally:
        shutil.move(p + '.selftestbak', p)
