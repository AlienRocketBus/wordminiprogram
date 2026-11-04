import os, subprocess, shutil, sys
SRC='/home/user/wordminiprogram/'
W=os.path.dirname(os.path.abspath(__file__))
emu=open(SRC+'cloudbase_emulator.mjs',encoding='utf-8').read()
test=open(SRC+'test_cloudbase_emulator_v1164.mjs',encoding='utf-8').read()
M = {
 'unmodified': [],
 'match_always_true': [("function match(doc, q) {\n    if (!q) return true;", "function match(doc, q) {\n    return true;")],
 'sort_ignored': [("function sortDocs(arr, order) {\n    if (!order || !order.length) return arr;", "function sortDocs(arr, order) {\n    return arr;")],
 'limit_ignored': [("let out = rows.slice(offset, offset + limit);", "let out = rows.slice(offset);")],
 'client_openid_trusted': [("d._openid = uid;   // 服务端盖创建者章", "d._openid = d._openid || uid;   // 服务端盖创建者章")],
 'upsert_no_stamp': [("const nd = Object.assign(clone(data) || {}, { _id: query._id, _openid: uid });", "const nd = Object.assign(clone(data) || {}, { _id: query._id });")],
 'http403_denied': [("const denied = () => dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');", "const denied = () => json(req, 403, { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', requestId: rid() });")],
 # controls that SHOULD be killed
 'CTRL_dup_allowed': [("if (c.docs.has(d._id) && latest(c.docs.get(d._id))) {", "if (false) {")],
 'CTRL_owns_always': [("const owns = (d) => acl === ACL.PUBLIC_TEST_ONLY || d._openid === uid;", "const owns = (d) => true;")],
 'CTRL_http404_notexist': [("if (!c) return dbErr(req, 'DATABASE_COLLECTION_NOT_EXIST',", "if (!c) return json(req, 404, {code:'DATABASE_COLLECTION_NOT_EXIST', message:")],
}
# fix up the 404 control so it is syntactically valid
res = {}
for name, edits in M.items():
    d = os.path.join(W, name); os.makedirs(d, exist_ok=True)
    s = emu
    for old, new in edits:
        assert s.count(old) == 1, (name, old[:60], s.count(old))
        s = s.replace(old, new)
    if name == 'CTRL_http404_notexist':
        s = s.replace("contact us.: ${colName}`);", "contact us.: ${colName}`});", 1)
    open(os.path.join(d, 'cloudbase_emulator.mjs'), 'w', encoding='utf-8').write(s)
    open(os.path.join(d, 'test_cloudbase_emulator_v1164.mjs'), 'w', encoding='utf-8').write(test)
    r = subprocess.run(['node', 'test_cloudbase_emulator_v1164.mjs'], cwd=d, capture_output=True, timeout=120)
    out = r.stdout.decode('utf-8','replace') + r.stderr.decode('utf-8','replace')
    xx = [l.strip() for l in out.split('\n') if l.startswith('  XX')]
    summ = [l for l in out.split('\n') if '通过' in l and '失败' in l]
    print(f"{name:26s} rc={r.returncode} {'SURVIVED' if r.returncode == 0 else 'KILLED'}  {summ[-1].strip() if summ else ''}  {xx[:2]}")
