// F13: if the backend acked a duplicate-_id add (silently or by overwriting), can both racers be "first"?
import { env, call, bg, bgResult, wait, ev, doc, sleep, out } from './slib.mjs';
import { createEmulator } from './emu_dup.mjs';
import { H } from './slib.mjs';
const STYLE = process.argv[2] || 'silent', LAG = Number(process.argv[3] || 400);
const cc = H.cloudConfig();
const E = await env({ latencyMs: 40, jitterMs: 20, consistencyLagMs: LAG, permissionMode: 'rules', duplicateStyle: STYLE },
  { emuFactory: (knobs) => createEmulator({ env: cc.env, region: cc.region, collections: H.defaultCollections(), knobs }) });
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  const m = await call(A, 'createRoom', { mode: 'A', hostRating: 1000 });
  await sleep(LAG + 600);
  await wait(A, m.roomId);
  await sleep(LAG + 200);
  const j = await call(B, 'joinRoom', m.roomId, {}); await ev(A, 20000);
  await Promise.all([call(A, 'markReady', m.roomId), call(B, 'markReady', m.roomId)]);
  let both = 0;
  for (let i = 0; i < 4; i++) {
    await Promise.all([bg(A, 'c' + i, 'claimRound', m.roomId, i), bg(B, 'c' + i, 'claimRound', m.roomId, i)]);
    const [ra, rb] = await Promise.all([bgResult(A, 'c' + i), bgResult(B, 'c' + i)]);
    if (ra.r.first && rb.r.first) both++;
    out(`word ${i}: host first=${ra.r.first} guest first=${rb.r.first}`);
  }
  out(`${STYLE} lag ${LAG}: both "first" on ${both}/4 words`);
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
