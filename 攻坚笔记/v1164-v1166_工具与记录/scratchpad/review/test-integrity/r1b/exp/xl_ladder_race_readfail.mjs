/* XI: read lag LAG ms (emulator tests use <= 500). One kid waits in a ladder room; three kids press 开始排位 together.
 * The two who lose the seat race: what does the ladder show them? Usage: node xi_ladder_race_lag.mjs <lagMs> */
import * as H from '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/test-integrity/r1b/cur/cloudbase_e2e_harness.mjs';
const LAG = Number(process.argv[2] || 3500);
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 60, jitterMs: 60, consistencyLagMs: LAG } });
const READFAILS = Number(process.argv[3] || 0);
if (READFAILS) {
  const dupUids = () => new Set(emu.log.filter((e) => e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED').map((e) => e.uid));
  emu.fault({ test: (ctx) => ctx.action === 'database.queryDocument' && dupUids().has(ctx.uid), do: 'abort', times: READFAILS });
}
const out = { LAG, READFAILS };
const live = [];
try {
  const names = ['房主', '甲', '乙', '丙'];
  const P = [];
  for (let i = 0; i < 4; i++) { const p = await H.openPhone(browser, emu, srv.origin, { name: names[i] }); live.push(p); P.push(p); }
  for (let i = 0; i < 4; i++) { const r = await H.loginPhone(P[i], '1380000098' + i); if (!r.ok) throw new Error('login ' + i); }
  await P[0].tap('#pkLadder'); await H.answerNameIfAsked(P[0], '小房主'); await P[0].waitScreen(/开始排位/, { timeout: 8000 });
  await P[0].tap('#ldGo');
  out.hostWaiting = await P[0].waitScreen(/等对手进来/, { timeout: 45000 }).then(() => true, () => false);
  await H.sleep(LAG + 1500);   /* the host's room is visible to everyone by now */
  for (let i = 1; i < 4; i++) { await P[i].tap('#pkLadder'); await H.answerNameIfAsked(P[i], '小' + names[i]); await P[i].waitScreen(/开始排位/, { timeout: 8000 }); }
  await Promise.all([P[1].tap('#ldGo'), P[2].tap('#ldGo'), P[3].tap('#ldGo')]);
  const seen = { 甲: new Set(), 乙: new Set(), 丙: new Set() };
  const t0 = Date.now();
  while (Date.now() - t0 < 45000) {
    for (let i = 1; i < 4; i++) {
      const s = (await P[i].screen()).replace(/\s+/g, ' ');
      for (const k of ['被别人抢走', '云端设置还差一步', '连不上网络', '这次没成功', '正在找对手', '等对手进来']) if (s.includes(k)) seen[names[i]].add(k);
      if ((await H.battleView(P[i]))) seen[names[i]].add('对战屏');
    }
    await H.sleep(700);
  }
  out.seen = Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]]));
  out.finalScreens = {};
  for (let i = 1; i < 4; i++) out.finalScreens[names[i]] = (await P[i].screen()).replace(/\s+/g, ' ').slice(0, 150);
} catch (e) { out.err = String(e && e.stack || e).slice(0, 500); }
console.log(JSON.stringify(out));
for (const p of live) await p.close().catch(() => {});
await browser.close(); srv.close(); process.exit(0);
