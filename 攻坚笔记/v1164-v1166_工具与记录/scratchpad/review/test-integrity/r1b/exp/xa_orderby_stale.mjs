/* XA: emulator assumption "orderBy never fails / needs no index" flipped, combined with N abandoned
 * open rooms already on the server (v1164-style: proto 2, status open, stale heartbeat — what a killed host leaves).
 * Two real kids (real pages + real SDK) then try the ladder. Usage: node xa_orderby_stale.mjs <ok|refuse> <N> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const MODE = process.argv[2] || 'refuse';
const N = Number(process.argv[3] || 40);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 40, consistencyLagMs: 300 } });
const t0 = Date.now(), day = 86400000;
for (let i = 0; i < N; i++) {
  const owner = '1888' + String(i).padStart(15, '0');
  emu.seedDoc('hansen_pk_rooms', { _id: 'rstale' + String(i).padStart(3, '0'), proto: 2, kind: 'room', status: 'open', isPrivate: false,
    mode: 'A', askMode: 'cn', hostId: 'u' + owner, hostName: '走了的' + i, hostRating: 1000, seat: 0, seed: 1, wordCount: 10,
    createdAt: t0 - day + i * 1000, heartbeatAt: t0 - day + i * 1000, hostBeat: t0 - day + i * 1000 }, owner, day);
}
let refused = 0;
async function overlay(p) {
  if (MODE !== 'refuse') return;
  await p.ctx.route((u) => /tencentcloudapi\.com$/.test(new URL(u).hostname), async (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) { /* */ }
    if (b.action === 'database.queryDocument' && Array.isArray(b.order) && b.order.length) {
      refused++;
      return r.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify({ code: 'DATABASE_REQUEST_FAILED', message: '[FailedOperation] sort field has no index (emulated)', requestId: 'x' }) });
    }
    return r.fallback();
  });
}
const out = { MODE, N };
const phones = [];
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); phones.push(A); await overlay(A);
  const Bp = await H.openPhone(browser, emu, srv.origin, { name: 'B' }); phones.push(Bp); await overlay(Bp);
  out.loginA = (await H.loginPhone(A, '13800000911')).ok; out.loginB = (await H.loginPhone(Bp, '13800000912')).ok;
  for (const [p, nick] of [[A, '小甲'], [Bp, '小乙']]) { await p.tap('#pkLadder'); await H.answerNameIfAsked(p, nick); await p.waitScreen(/开始排位/, { timeout: 8000 }); }
  await A.tap('#ldGo');
  const aw = await A.waitScreen(/等对手进来/, { timeout: 45000 }).then(() => true, () => false);
  out.aSelfHosted = aw;
  const ts = Date.now();
  await Bp.tap('#ldGo');
  const seen = new Set();
  let both = null;
  while (Date.now() - ts < 75000) {
    const va = await H.battleView(A), vb = await H.battleView(Bp);
    if (va && vb) { both = Math.round((Date.now() - ts) / 1000); break; }
    const s = (await Bp.screen()).replace(/\s+/g, ' ');
    for (const k of ['正在找对手', '等对手进来', '暂时没有对手', '连不上网络', '云端设置还差一步']) if (s.includes(k)) seen.add(k);
    await H.sleep(1000);
  }
  out.matchedAfterSec = both;
  out.bSaw = [...seen];
  out.openRoomsMine = H.roomDocs(emu).filter((d) => d.kind === 'room' && d.status !== 'done' && (d._openid === A.cloudUid || d._openid === Bp.cloudUid)).length;
  out.refusedOrderedQueries = refused;
} catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
console.log(JSON.stringify(out));
for (const p of phones) await p.close().catch(() => {});
await browser.close(); srv.close();
process.exit(0);
