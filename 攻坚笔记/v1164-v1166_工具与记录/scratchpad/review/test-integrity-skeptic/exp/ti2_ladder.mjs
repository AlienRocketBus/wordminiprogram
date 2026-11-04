/* TI-2 ladder UI: host waits in a ladder room; two kids press 开始排位 at the same moment → what does the loser see? */
import { H, phone, toLadderHome, flat } from './common.mjs';
const LAG = Number(process.argv[2] || 3500), READFAIL = process.argv[3] === '1';
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 50, jitterMs: 40, consistencyLagMs: LAG } });
const out = { LAG, READFAIL };
try {
  const Hh = await phone(browser, emu, srv, 'H', '13800000111', '小蜂房主', live, names);
  const G = [await phone(browser, emu, srv, 'G1', '13800000112', '小蜂一', live, names),
             await phone(browser, emu, srv, 'G2', '13800000113', '小蜂二', live, names)];
  if (READFAIL) {
    const left = new Map();
    emu.fault({ db: true, do: 'abort', test: (ctx) => {
      if (ctx.action !== 'database.queryDocument' || !ctx.uid) return false;
      if (!emu.log.some((e) => e.uid === ctx.uid && e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED')) return false;
      const n = left.has(ctx.uid) ? left.get(ctx.uid) : 3; if (n <= 0) return false; left.set(ctx.uid, n - 1); return true;
    } });
  }
  await toLadderHome(Hh); await Hh.tap('#ldGo');
  await Hh.waitScreen(/等对手进来/, { timeout: 45000 });
  await H.sleep(LAG + 1500);
  for (const g of G) await toLadderHome(g);
  await Promise.all(G.map((g) => g.tap('#ldGo')));
  const t0 = Date.now(); const seen = { G1: [], G2: [] };
  let finalState = null;
  while (Date.now() - t0 < 40000) {
    for (const g of G) { const sc = flat(await g.screen()).slice(0, 110); if (seen[g.name][seen[g.name].length - 1] !== sc) seen[g.name].push(sc); }
    const inB = []; for (const g of G) if (await H.battleView(g)) inB.push(g.name);
    const cfg = []; for (const g of G) if (/云端设置还差一步/.test(await g.screen())) cfg.push(g.name);
    if (inB.length === 1 && cfg.length === 1) { finalState = { inBattle: inB, configScreen: cfg }; break; }
    await H.sleep(700);
  }
  out.final = finalState;
  out.screens = Object.fromEntries(G.map((g) => [g.name, seen[g.name].filter((x) => !/正在找对手/.test(x)).slice(-4)]));
  const loser = G.find((g) => finalState && finalState.configScreen.includes(g.name));
  if (loser) out.loserFullScreen = flat(await loser.screen()).slice(0, 300);
  out.dupRejections = emu.log.filter((e) => e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED').length;
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
