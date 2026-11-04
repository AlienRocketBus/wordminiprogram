// EXP10: nobody comes. (P1) lobby room times out after 2 min; (P2) ranked room times out.
//   Exact screen text after each; the 「同一个账号在另一台设备上开着房」 hint must not appear for
//   the kid's OWN room that was just closed.
import { setup, docs, sleep, report, H, toLobby, openRoom } from './lib.mjs';
const rep = report('EXP10 wait timeouts');
const env = await setup({ permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 400 });
try {
  const P1 = await env.phone('甲', { nick: '等人蜂' });
  const P2 = await env.phone('乙', { nick: '排位蜂' });
  await toLobby(P1);
  const R1 = await openRoom(env.emu, P1, 'C');
  await P2.tap('#pkLadder'); await P2.waitScreen(/开始排位/, { timeout: 8000 });
  await P2.tap('#ldGo');
  const t0 = Date.now();
  const s1 = await P1.waitScreen(/没人来|房间先关掉/, { timeout: 150000 }).catch((e) => e.lastText || '');
  rep.log(`P1 lobby room after ${Math.round((Date.now() - t0) / 1000)} s: ${s1.replace(/\s+/g, ' ').slice(0, 160)}`);
  rep.expect(!/同一个账号在另一台设备/.test(s1), 'P1: no 「同一个账号在另一台设备上开着房」 hint for its own just-closed room');
  await sleep(3000);
  rep.log(`P1 3 s later: ${(await P1.screen()).replace(/\s+/g, ' ').slice(0, 160)}`);
  const s2 = await P2.waitScreen(/暂时没有对手/, { timeout: 120000 }).catch((e) => e.lastText || '');
  rep.log(`P2 ranked after ${Math.round((Date.now() - t0) / 1000)} s: ${s2.replace(/\s+/g, ' ').slice(0, 120)}`);
  rep.expect(/暂时没有对手/.test(s2), 'P2: back to the ladder home with 「暂时没有对手，等会儿再来」');
  const left = docs(env.emu).filter((d) => d.kind === 'room' && d.status === 'open');
  rep.log('rooms still open on the server:', left.length);
  await P2.tap('#ldGo');
  await sleep(1500);
  rep.log(`P2 taps 开始排位 again right away: ${(await P2.screen()).replace(/\s+/g, ' ').slice(0, 160)}`);
  rep.log('errors', P1.errors, P2.errors);
} catch (e) { rep.log('THREW', String(e && e.stack || e)); }
await env.done();
console.log(`\nRESULT: ${rep.st.pass} as-expected, ${rep.st.fail} unexpected`);
process.exit(0);
