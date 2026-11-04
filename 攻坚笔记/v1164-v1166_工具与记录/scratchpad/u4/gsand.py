# 在临时目录里验证：自测注入在我的文件上仍然有效（不碰仓库里的文件）
import sys, os, shutil, glob, importlib.util
REPO = '/home/user/wordminiprogram'
SB = sys.argv[1]
for f in glob.glob(SB + '/*'): os.remove(f)
for f in glob.glob(REPO + '/hansen_*.js'): shutil.copy(f, SB)
spec = importlib.util.spec_from_file_location('g', REPO + '/hansen_guards_v1068.py'); g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)
spec2 = importlib.util.spec_from_file_location('st', REPO + '/jarvis_selftest.py')
src = open(REPO + '/jarvis_selftest.py', encoding='utf-8').read()
ns = {}
# 只取需要的注入函数
import re
for name in ['_inj_n_plus_one', '_inj_load_order', '_inj_theme_fg']:
    m = re.search(r'^def ' + name + r'\(s\):.*?(?=^def |\Z)', src, re.S | re.M)
    exec(m.group(0), ns)
g.ROOT = SB
cases = [('_inj_n_plus_one', 'hansen_friends_v1106.js', g.guard_no_n_plus_one_query, '循环查库'),
         ('_inj_load_order', 'hansen_friends_v1106.js', g.guard_no_load_order_helper, '加载顺序依赖')]
for inj, f, guard, tag in cases:
    g.PROBLEMS.clear(); guard(); clean = list(g.PROBLEMS)
    p = os.path.join(SB, f); orig = open(p, encoding='utf-8').read()
    hurt = ns[inj](orig)
    assert hurt and hurt != orig, inj + ' 注入不上'
    open(p, 'w', encoding='utf-8').write(hurt)
    g.PROBLEMS.clear(); guard(); fired = [x for x in g.PROBLEMS if x[0] == tag]
    open(p, 'w', encoding='utf-8').write(orig)
    print(inj, 'clean=', len(clean), 'fired=', len(fired))
h = ns['_inj_theme_fg'](open(REPO + '/hansen_friends_ui_v1107.js', encoding='utf-8').read())
print('_inj_theme_fg applies:', h is not None)
