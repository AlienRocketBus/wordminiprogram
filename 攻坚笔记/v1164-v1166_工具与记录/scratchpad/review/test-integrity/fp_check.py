import importlib.util, sys, os, shutil
D = sys.argv[1]
spec = importlib.util.spec_from_file_location('batch', os.path.join(D, '分批跑测试.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
assert os.path.dirname(os.path.abspath(m.__file__)) == D, m.ROOT
def fp(): return m.fingerprint()
base = fp()
res = {}
for f, mut in [('cloudbase_emulator.mjs', lambda s: s.replace("const owns = (d) => acl === ACL.PUBLIC_TEST_ONLY || d._openid === uid;", "const owns = (d) => true;  // loosened")),
               ('cloudbase_e2e_harness.mjs', lambda s: s.replace("const ok = !!hit && (hit === el || el.contains(hit));", "const ok = true;  // hit-test disabled")),
               ('vendor_cloudbase_esm_v965.js', lambda s: s + '\n//x'),
               ('test_ladder_cloud_v1164.mjs', lambda s: s + '\n//x')]:
    p = os.path.join(D, f); orig = open(p, encoding='utf-8').read()
    new = mut(orig); assert new != orig, f
    open(p, 'w', encoding='utf-8').write(new)
    res[f] = (fp() != base)
    open(p, 'w', encoding='utf-8').write(orig)
print('fingerprint changes when file is edited:', res)
