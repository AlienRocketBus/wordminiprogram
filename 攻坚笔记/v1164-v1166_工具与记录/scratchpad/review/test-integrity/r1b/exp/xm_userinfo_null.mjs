/* XM: does the REAL SDK 2.30.0 throw on user_info {content:null} (the stub in test_auth_session ⑤ assumes it does)? */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 30 } });
const out = {};
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  out.login = (await H.loginPhone(A, '13800000991')).ok;
  for (const [label, val] of [['content-null', '{"version":"localCachev1","content":null}'], ['truncated', '{"version":"localCachev1","content":{"uid":']]) {
    await A.eval(([env, v]) => localStorage.setItem('user_info_' + env, v), [emu.env, val]);
    out[label] = await A.eval(async () => {
      const a = window.HansenAuth._authObj();
      let raw;
      try { const st = await a.getLoginState(); raw = { resolved: true, uid: st && st.user && st.user.uid, hasState: !!st }; }
      catch (e) { raw = { threw: String(e && (e.name + ': ' + e.message)).slice(0, 120) }; }
      const s = await window.HansenAuth.ensureSession();
      return { sdkGetLoginState: raw, ensureSession: { ok: s.ok, uid: s.uid, kind: s.kind } };
    });
  }
} catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
console.log(JSON.stringify(out));
await browser.close(); srv.close(); process.exit(0);
