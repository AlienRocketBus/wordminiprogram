#!/usr/bin/env python3
"""mutants.py — build 'patched minus one fix' variants (mutation check: every fix must have a scenario that goes red without it).
   python3 mutants.py <patchedDir> <baseDir> <outRoot>   → <outRoot>/M_<fix>/ with the four room/ladder files.
   patchedDir = the code with the 联机压力测试 fixes (R1–R12); baseDir = the same code before them (56b8146).
   Data-layer fixes are reverted in hansen_pk_room_v1065.js; UI fixes in hansen_pk_room_ui_v1065.js (by restoring the base
   version of the function, or by making the fixed helper behave like the old code)."""
import sys, os, shutil, re
P, O, OUT = sys.argv[1:4]
FILES = ['hansen_pk_room_v1065.js', 'hansen_pk_room_ui_v1065.js', 'hansen_ladder_ui_v1108.js', 'hansen_sb_ladder_v1002.js']
def rd(d, f): return open(os.path.join(d, f), encoding='utf-8').read()
def fn(src, name):
    m = re.search(r'\n  function ' + re.escape(name) + r'\s*\(', src)
    rest = src[m.start() + 1:]
    e = re.search(r'\n  (function |var |window\.|/\* ──)', rest[1:])
    return rest[: e.start() + 2] if e else rest
def swap_fn(dst, orig, name):
    a, b = fn(dst, name), fn(orig, name)
    assert dst.count(a) == 1, name
    return dst.replace(a, b)
def rep(s, old, new):
    assert s.count(old) == 1, (old[:70], s.count(old))
    return s.replace(old, new)
def cut(s, start, end_incl):
    a = s.index(start); b = s.index(end_incl, a) + len(end_incl)
    return s[:a] + s[b:]
oui = rd(O, FILES[1]); odata = rd(O, FILES[0])
M = {}
# ── data layer ──
M['R1'] = ('data', lambda s: rep(s, "      delete _rc[roomId];\n      var c0 = rc(roomId);", "      var c0 = rc(roomId);"))
def r5d(s):
    a = s.index("      if (k === 'expired') throw addErr;   /* 没登录：读也读不了 */")
    b = s.index("      if (k === 'session') return { mine: false, unknown: true, id: id, err: addErr, dup: false };\n", a)
    b += len("      if (k === 'session') return { mine: false, unknown: true, id: id, err: addErr, dup: false };\n")
    return s[:a] + "      if (k === 'expired' || k === 'session') throw addErr;   /* MUTANT R5 */\n" + s[b:]
def r5u(s):
    return rep(s, "        if (fk === 'network' || fk === 'slow' || fk === 'session') { st.pendingR = st.pendingR || {}; st.pendingR[idx] = Date.now(); }\n", "")
M['R5'] = ('both', (r5d, r5u))
M['R6'] = ('data', lambda s: rep(s, "          if (Date.now() - t0 > limit) { emit({ timeout: true }); leaveRoom(roomId); return; }\n", ""))
def r8(s):   # the sweep back to 6165390 (local-clock age alone)
    a = s.index("        var later = false, live = {};")
    b = s.index("        kill = kill.slice(0, 10);", a)
    oa = odata.index("        (L[0] || []).forEach(function (r) {\n          if (!r || !r._id || r._id === _myRoomId")
    ob = odata.index("        kill = kill.slice(0, 10);", oa)
    return s[:a] + odata[oa:ob] + s[b:]
M['R8'] = ('data', r8)
M['R9b'] = ('data', lambda s: rep(s, "    var p = (nonce0 ? tryRead(3) : T().remove(sid)).then(noop, noop);",
                                      "    var p = T().remove(sid).then(noop, noop);   /* MUTANT R9b: blind remove by _id */"))
M['R11'] = ('data', lambda s: rep(s, "        if ((_leftGen[roomId] || 0) !== lg) return { cancelled: true };\n", ""))
# ── UI ──
def r3(s):   # a failed abandon claim counts as a win again (the helper behaves like the old code) + the early banner
    s = rep(s, "      if (w && w.ok) { onOk(w); return; }\n        again(w);", "      onOk(w && w.ok ? w : { result: 'win' }); return;   /* MUTANT R3 */")
    s = rep(s, "            if (!(w && w.ok)) { next(4000); return; }\n            if (w.real) {",
               "            if (!(w && w.ok)) { done({ result: 'win', byAbandon: true }); return; }   /* MUTANT R3 */\n            if (w.real) {")
    s = rep(s, "            done({ result: (w.result === 'void' || w.result === 'lose') ? w.result : 'win', byAbandon: true });\n          }, function () { next(4000); });",
               "            done({ result: (w && w.ok && (w.result === 'void' || w.result === 'lose')) ? w.result : 'win', byAbandon: true });\n          }, function () { done({ result: 'win', byAbandon: true }); });")
    return rep(s, "el.textContent = '📶 对手好像掉线了，正在确认这一局的结果…'; el.style.color = 'var(--pk-dim)';", "el.textContent = '🏆 对手已离场，本局你胜'; el.style.color = 'var(--pk-ok)';")
M['R3'] = ('ui', r3)
def r4(s):   # finish() back to one 8-s resolvePending
    a = s.index("    var tFin = Date.now();")
    b = s.index("    settle().then(function (gone) {\n      if (gone === 'gone' || !stillLive(st)) return;", a)
    s = s[:a] + s[b:]
    return rep(s, "    settle().then(function (gone) {\n      if (gone === 'gone' || !stillLive(st)) return;", "    resolvePending(st, 8000).then(function () {\n      if (!stillLive(st)) return;")
M['R4'] = ('ui', r4)
def r10(s):
    s = rep(s, "      if (!st._oppSeen && !(g && g.oppSeen)) { neverCame(st); return; }\n", "")
    return rep(s, "      if (r.byAbandon && r.oppLeft && !st._oppSeen) { neverCame(st); return; }\n", "")
M['R10'] = ('ui', r10)
def r12(s):
    s = swap_fn(s, oui, 'retryPending')
    s = rep(s, "          /* 🔴联机压力测试 R12：不再一分钟就扔掉 —— 交卷前 resolvePending 还会再核对、再补写一次 */",
               "          if (Date.now() - pend[k] > 60000) delete pend[k];   /* 一分钟还不知道：不等了 */")
    return rep(s, "        if (st.pendTry) delete st.pendTry[i];   /* 联机压力测试 R12：交卷前一定再补写一次 */\n", "")
M['R12'] = ('ui', r12)
M['D2'] = ('ui', lambda s: rep(s, "if (alive && Date.now() - (st._resWaitT0 || Date.now()) < 300000)", "if (alive && _waitResult < 150)"))
for name, (kind, f) in M.items():
    d = os.path.join(OUT, 'M_' + name)
    os.makedirs(d, exist_ok=True)
    for x in FILES: shutil.copy(os.path.join(P, x), os.path.join(d, x))
    for i, part in ((0, 'data'), (1, 'ui')):
        if kind == part or kind == 'both':
            g = f if kind != 'both' else f[i]
            p = os.path.join(d, FILES[i]); txt = g(rd(d, FILES[i])); open(p, 'w', encoding='utf-8').write(txt)
    print('built', 'M_' + name)
