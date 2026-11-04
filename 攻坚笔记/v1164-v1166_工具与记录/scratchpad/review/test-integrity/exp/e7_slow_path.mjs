/* E7: the 'slow' path (DB requests hang; no E2E test covers it). What does the kid see, and when? */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40 } });
const out = { timeline: [] };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  out.login = (await H.loginPhone(A, '13800000911')).ok;
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '小慢');
  await A.waitScreen(/开始排位/, { timeout: 8000 });
  emu.fault({ uid: A.cloudUid, db: true, do: 'hang', ms: 30000 });
  const t0 = Date.now();
  await A.tap('#ldGo');
  let last = '';
  while (Date.now() - t0 < 150000) {
    const s = (await A.screen()).replace(/\s+/g, ' ');
    const key = (/连不上网络|网络太慢|云端还没连上|云端设置还差一步|正在找对手|等对手进来|这一步没能打开|这一局卡住了/.exec(s) || ['?'])[0];
    if (key !== last) { out.timeline.push(`${Math.round((Date.now() - t0) / 1000)}s ${key} :: ${s.slice(0, 110)}`); last = key; }
    if (/连不上网络/.test(s)) { out.tech = (/技术信息：[^ ]*( [^ ]*){0,6}/.exec(s) || [''])[0]; break; }
    await H.sleep(1000);
  }
  out.total = Math.round((Date.now() - t0) / 1000);
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close(); process.exit(0);
