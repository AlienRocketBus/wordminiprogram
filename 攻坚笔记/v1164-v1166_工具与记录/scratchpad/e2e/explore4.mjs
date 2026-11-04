import * as H from '/home/claude/work/repo/cloudbase_e2e_harness.mjs';
const emu = H.makeEmulator({ knobs: { omitExpiresIn: true } });
emu.seedUser({ username: 'kid_pw01', password: 'pw123456' });
const srv = await H.startStatic();
const browser = await H.launchBrowser();
try {
  const R = await H.openPhone(browser, emu, srv.origin, { name: 'R' });
  const r = await R.eval(async () => {
    const out = {};
    try { await HansenAuth.loginByPassword('kid_pw01', 'pw123456'); out.ok = true; }
    catch (e) { out.err = { type: typeof e, isErr: e instanceof Error, msg: e && e.message, keys: e && Object.keys(e), json: JSON.stringify(e).slice(0, 300), friendly: HansenAuth.friendly(e) }; }
    out.trace = HansenAuth._trace().split('\n').slice(-8);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log(H.recentLog(emu, 10));
} catch (e) { console.log('ERR', e.message); }
await browser.close(); srv.close();
