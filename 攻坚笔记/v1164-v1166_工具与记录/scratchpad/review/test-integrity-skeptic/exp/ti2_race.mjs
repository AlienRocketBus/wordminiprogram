/* TI-2 (data layer + lobby UI): three guests join the same open room at once.
   argv: LAG(ms) READFAIL(0|1) STYLE(request_failed|duplicate_write|http500)
   READFAIL=1: each loser's first 3 queryDocument calls after its duplicate rejection are aborted (weak 4G blip). */
import { H, phone, toLobby, flat } from './common.mjs';
const LAG = Number(process.argv[2] || 500), READFAIL = process.argv[3] === '1', STYLE = process.argv[4] || 'request_failed';
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'rules', latencyMs: 50, jitterMs: 40, consistencyLagMs: LAG, duplicateStyle: STYLE } });
const out = { LAG, READFAIL, STYLE };
try {
  const Hh = await phone(browser, emu, srv, 'H', '13800000101', '小蜂房主', live, names);
  const G = [await phone(browser, emu, srv, 'G1', '13800000102', '小蜂一', live, names),
             await phone(browser, emu, srv, 'G2', '13800000103', '小蜂二', live, names),
             await phone(browser, emu, srv, 'G3', '13800000104', '小蜂三', live, names)];
  if (READFAIL) {
    const left = new Map();
    emu.fault({ db: true, do: 'abort', test: (ctx) => {
      if (ctx.action !== 'database.queryDocument' || !ctx.uid) return false;
      const dup = emu.log.some((e) => e.uid === ctx.uid && e.action === 'database.addDocument' && e.code === 'DATABASE_REQUEST_FAILED');
      if (!dup) return false;
      const n = left.has(ctx.uid) ? left.get(ctx.uid) : 3;
      if (n <= 0) return false;
      left.set(ctx.uid, n - 1);
      return true;
    } });
  }
  await toLobby(Hh);
  await Hh.tap('#prNew'); await Hh.tap('.pr_mode[data-mode="C"]');
  await Hh.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === Hh.cloudUid);
  await H.sleep(LAG + 1500);   /* the room itself is visible to reads by now */
  const res = await Promise.all(G.map((g) => g.eval(async (rid) => {
    const r = await window.HansenPkRoom.joinRoom(rid, { rating: 1000 });
    return { ok: r.ok, kind: r.kind, reason: String(r.reason || '').slice(0, 160) };
  }, R._id)));
  out.results = res.map((r, i) => `${G[i].name}: ${r.ok ? 'OK' : r.kind + ' | ' + r.reason}`);
  out.winners = res.filter((r) => r.ok).length;
  out.configLosers = res.filter((r) => !r.ok && r.kind === 'config').length;
  out.takenLosers = res.filter((r) => !r.ok && r.kind === 'taken').length;
  out.dupRejections = emu.log.filter((e) => e.action === 'database.addDocument' && (e.code === 'DATABASE_REQUEST_FAILED' || e.code === 'DATABASE_DUPLICATE_WRITE' || e.status === 500)).length;
  out.aborted = emu.log.filter((e) => e.fault === 'abort').length;
  out.seatDocs = H.roomDocs(emu).filter((d) => d.kind === 'seat').length;
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
