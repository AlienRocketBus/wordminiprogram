/* E9: emulator assumption "DB business errors come back as HTTP 200 + {code}" flipped:
 * the same DATABASE_PERMISSION_DENIED body, but with HTTP 403. hansen_pk_rooms = ADMINONLY (test_cloud_errors ①). */
import * as H from '/home/user/wordminiprogram/cloudbase_e2e_harness.mjs';
import { createEmulator } from './emu_flip403.mjs';
const STATUS = Number(process.env.DENY_STATUS || 403);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const cc = H.cloudConfig();
const emu = createEmulator({ env: cc.env, region: cc.region, collections: H.defaultCollections({ hansen_pk_rooms: H.ACL.ADMINONLY }), knobs: { permissionMode: 'rules', latencyMs: 40 } });
const out = { STATUS, timeline: [] };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  out.login = (await H.loginPhone(A, '13800000941')).ok;
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '小权');
  await A.waitScreen(/开始排位/, { timeout: 8000 });
  const t0 = Date.now();
  await A.tap('#ldGo');
  let last = '';
  while (Date.now() - t0 < 60000) {
    const s = (await A.screen()).replace(/\s+/g, ' ');
    const key = (/连不上网络|云端设置还差一步|云端还没连上|正在找对手|等对手进来/.exec(s) || ['?'])[0];
    if (key !== last) { out.timeline.push(`${Math.round((Date.now() - t0) / 1000)}s ${key}`); last = key; }
    if (/连不上网络|云端设置还差一步/.test(s)) { out.final = s.slice(0, 260); break; }
    await H.sleep(800);
  }
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
await browser.close(); srv.close(); process.exit(0);
