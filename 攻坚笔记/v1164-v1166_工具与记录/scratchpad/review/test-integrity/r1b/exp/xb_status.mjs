/* XB: emulator assumption "DB business errors come back as HTTP 200 + {code}" flipped.
 * hansen_pk_rooms = ADMINONLY (or missing); server answers the code with HTTP <STATUS>.
 * What does the kid/teacher see on the ladder? Usage: node xb_status.mjs <status> <admin|missing> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/mut/cloudbase_e2e_harness.mjs';
const STATUS = Number(process.argv[2] || 403), WHAT = process.argv[3] || 'admin';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const cols = H.defaultCollections(WHAT === 'admin' ? { hansen_pk_rooms: H.ACL.ADMINONLY } : {});
if (WHAT === 'missing') delete cols.hansen_pk_rooms;
const emu = H.makeEmulator({ collections: cols, knobs: { permissionMode: 'rules', latencyMs: 40, deniedStatus: STATUS } });
const out = { STATUS, WHAT, timeline: [] };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' });
  out.login = (await H.loginPhone(A, '13800000931')).ok;
  await A.tap('#pkLadder'); await H.answerNameIfAsked(A, '小甲'); await A.waitScreen(/开始排位/, { timeout: 8000 });
  await A.tap('#ldGo');
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < 45000) {
    const s = (await A.screen()).replace(/\s+/g, ' ');
    const k = ['云端设置还差一步', '连不上网络', '云端还没连上', '登录过期', '正在找对手', '等对手进来'].find((x) => s.includes(x)) || '?';
    if (!out.timeline.length || out.timeline[out.timeline.length - 1].split(' ')[1] !== k) out.timeline.push(Math.round((Date.now() - t0) / 1000) + 's ' + k);
    last = s;
    if (/云端设置还差一步|连不上网络/.test(s)) break;
    await H.sleep(500);
  }
  out.final = last.slice(0, 260);
  await A.close();
} catch (e) { out.err = String(e && e.stack || e).slice(0, 400); }
console.log(JSON.stringify(out));
await browser.close(); srv.close(); process.exit(0);
