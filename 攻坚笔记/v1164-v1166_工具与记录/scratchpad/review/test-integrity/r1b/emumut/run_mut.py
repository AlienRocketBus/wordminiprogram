import os, subprocess, sys, shutil
SRC='/home/user/wordminiprogram'
B=os.path.dirname(os.path.abspath(__file__))
emu=open(os.path.join(SRC,'cloudbase_emulator.mjs'),encoding='utf8').read()
test=open(os.path.join(SRC,'test_cloudbase_emulator_v1164.mjs'),encoding='utf8').read()
M = {
 'dup_allowed': ("if (c.docs.has(d._id) && latest(c.docs.get(d._id))) {", "if (false) {"),
 'client_openid_trusted': ("d._openid = uid;   // 服务端盖创建者章", "d._openid = d._openid || uid;   // MUT"),
 'no_openid_stamp': ("d._openid = uid;   // 服务端盖创建者章", "/*MUT*/"),
 'owns_always': ("const owns = (d) => acl === ACL.PUBLIC_TEST_ONLY || d._openid === uid;", "const owns = (d) => true;"),
 'http403_denied': ("const denied = () => dbErr(req, 'DATABASE_PERMISSION_DENIED', 'Permission denied');", "const denied = () => json(req, 403, { code: 'DATABASE_PERMISSION_DENIED', message: 'Permission denied', requestId: rid() });"),
 'http404_notexist': ("if (!c) return dbErr(req, 'DATABASE_COLLECTION_NOT_EXIST',", "if (!c) return (x=>({...x,status:404}))(dbErr(req, 'DATABASE_COLLECTION_NOT_EXIST',"),
 'match_always_true': ("function match(doc, q) {\n    if (!q) return true;", "function match(doc, q) {\n    return true;"),
 'sort_ignored': ("function sortDocs(arr, order) {\n    if (!order || !order.length) return arr;", "function sortDocs(arr, order) {\n    return arr;"),
 'limit_ignored': ("let out = rows.slice(offset, offset + limit);", "let out = rows.slice(offset);"),
 'lag_ignored_doc': ("const docsVisible = () => [...c.docs.values()].map((v) => visible(v, t)).filter(Boolean);", "const docsVisible = () => [...c.docs.values()].map((v) => (query && query._id ? latest(v) : visible(v, t))).filter(Boolean);"),
 'lag_ignored_all': ("const cutoff = t - (lag || 0);", "const cutoff = t;"),
 'writes_see_lag': ("if (c.docs.has(d._id) && latest(c.docs.get(d._id))) {", "if (c.docs.has(d._id) && visible(c.docs.get(d._id), t)) {"),
 'refresh_reusable': ("if (!r || r.revoked || (knobs.refreshTokenRotation && r.used))", "if (!r || r.revoked)"),
 'token_expiry_ignored_db': ("if (tok.exp < nowMs()) return dbErr(req, 'ACCESS_TOKEN_EXPIRED', 'access_token expired');", ""),
 'foreign_not_recorded': ("if (theirs.length) foreign.push(", "if (false) foreign.push("),
 'rules_multi_allowed': ("if (multi && acl !== ACL.PUBLIC_TEST_ONLY && !queryPinsOwner(query, uid)) return denied();", ""),
 'legacy_foreign_written': ("const targets = multi ? own : own.slice(0, 1);", "const targets = multi ? all : all.slice(0, 1);"),
 'set_ownership_change_allowed': ("case '$set': setPath(d, k, clone(v)); break;", "case '$set': setPath(d, k, clone(v)); break; /*MUT no-op marker*/"),
 'expires_in_always': ("if (knobs.omitExpiresIn) delete t.expires_in;", ""),
 'admin_read_allowed': ("const canRead = acl !== ACL.ADMINONLY;", "const canRead = true;"),
 'upsert_no_stamp': ("const nd = Object.assign(clone(data) || {}, { _id: query._id, _openid: uid });", "const nd = Object.assign(clone(data) || {}, { _id: query._id });"),
 'unmodified_counts': ("if (!eq(nd, d)) updated++;", "updated++;"),
 'serverdate_client': ("if (v.$date && typeof v.$date === 'object' && 'offset' in v.$date) return { $date: t + (Number(v.$date.offset) || 0) };", ""),
}
which = sys.argv[1:] or list(M)
res = {}
for name in which:
    a, b = M[name]
    if a not in emu:
        res[name] = 'PATTERN-NOT-FOUND'; continue
    d = os.path.join(B, name); os.makedirs(d, exist_ok=True)
    open(os.path.join(d,'cloudbase_emulator.mjs'),'w',encoding='utf8').write(emu.replace(a, b, 1))
    open(os.path.join(d,'test_cloudbase_emulator_v1164.mjs'),'w',encoding='utf8').write(test)
    r = subprocess.run(['node','test_cloudbase_emulator_v1164.mjs'], cwd=d, capture_output=True, timeout=120)
    out = r.stdout.decode('utf8','replace') + r.stderr.decode('utf8','replace')
    xx = [l for l in out.split('\n') if l.startswith('  XX')]
    res[name] = ('KILLED rc=%d xx=%d: %s' % (r.returncode, len(xx), ' | '.join(x[6:60] for x in xx[:3]))) if r.returncode else 'SURVIVED (self-test green)'
for k,v in res.items(): print('%-30s %s' % (k, v))
