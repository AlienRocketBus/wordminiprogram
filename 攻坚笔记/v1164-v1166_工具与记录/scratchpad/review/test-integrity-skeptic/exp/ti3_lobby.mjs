/* TI-3: phone A's clock is OFF ms off; can phone B (correct clock) see/join A's public room and A's private room? */
import { H, phone, toLobby, flat } from './common.mjs';
import { skewPhone } from './skew.mjs';
const OFF = Number(process.argv[2] || -45000);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
const out = { OFF };
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); live.push(A);
  out.skew = await skewPhone(A, OFF);
  const ra = await H.loginPhone(A, '13800000121'); A.nick = '小蜂A'; names[ra.uid] = 'A';
  out.loginA = !!(ra && ra.ok);
  const B = await phone(browser, emu, srv, 'B', '13800000122', '小蜂B', live, names);
  /* ① public room */
  await toLobby(A); await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="C"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const RA = H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid && d.status === 'open');
  out.roomA = RA && { id: RA._id, heartbeatAgeBySrvClock: Date.now() - RA.heartbeatAt };
  await toLobby(B);
  let seen = null; const t0 = Date.now();
  while (Date.now() - t0 < 15000 && !seen) {
    const h = await B.hitTest(`button[data-rid="${RA._id}"]`, { timeout: 500 });
    if (h.ok) seen = Math.round((Date.now() - t0) / 1000); else { await B.tap('#prRef').catch(() => {}); await H.sleep(1200); }
  }
  out.public_lobbyListsA_afterSec = seen;
  out.public_lobbyTextB = flat(await B.screen()).slice(0, 90);
  /* ② private room by code */
  await A.eval(() => window.HansenPkRoomUI && HansenPkRoomUI.close());
  await H.sleep(1500);
  await toLobby(A); await A.tap('#prPriv'); await A.tap('.pr_mode[data-mode="C"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const code = ((await A.eval(() => (document.getElementById('prCodeBig') || {}).innerText || '')) || '').trim();
  out.privateCode = code;
  await B.eval(() => window.HansenPkRoomUI && HansenPkRoomUI.close());
  await H.sleep(800);
  await toLobby(B);
  await B.tap('details summary'); await B.tap('#prCode'); await B.type(code); await B.tap('#prJoinCode');
  const got = await H.until(async () => { if (await H.battleView(B)) return 'BATTLE'; const s = await B.screen(); return /没找到这间房|码输错|已经离开|过期/.test(s) ? flat(s).slice(0, 120) : null; }, { timeout: 25000, interval: 700 });
  out.private_joinResultB = got;
  out.pageErrors = live.map((p) => p.errors.length);
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
