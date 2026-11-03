/* TI-3 ladder: A (clock OFF ms) presses 开始排位 first and ends up hosting; B (correct clock) presses later. Do they meet? */
import { H, phone, toLadderHome, flat } from './common.mjs';
import { skewPhone } from './skew.mjs';
const OFF = Number(process.argv[2] || -45000);
const srv = await H.startStatic(); const browser = await H.launchBrowser();
const live = [], names = {};
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 40, jitterMs: 30, consistencyLagMs: 300 } });
const out = { OFF, timeline: [] };
const T0 = Date.now(); const s = () => Math.round((Date.now() - T0) / 1000);
try {
  const A = await H.openPhone(browser, emu, srv.origin, { name: 'A' }); live.push(A);
  out.skew = (await skewPhone(A, OFF)).offsetMs;
  const ra = await H.loginPhone(A, '13800000131'); A.nick = '小蜂A'; names[ra.uid] = 'A';
  const B = await phone(browser, emu, srv, 'B', '13800000132', '小蜂B', live, names);
  await toLadderHome(A); await A.tap('#ldGo');
  await A.waitScreen(/等对手进来/, { timeout: 45000 });
  out.timeline.push(`${s()}s A hosting (等对手进来)`);
  await toLadderHome(B); await B.tap('#ldGo');
  out.timeline.push(`${s()}s B pressed 开始排位`);
  const tB = Date.now(); let met = null, lb = '';
  while (Date.now() - tB < 80000) {
    if ((await H.battleView(A)) && (await H.battleView(B))) { met = Math.round((Date.now() - tB) / 1000); break; }
    const sb = /等对手进来/.test(await B.screen()) ? 'B 等对手进来' : (/正在找对手/.test(await B.screen()) ? 'B 正在找对手' : 'B other');
    if (sb !== lb) { out.timeline.push(`${s()}s ${sb}`); lb = sb; }
    await H.sleep(1000);
  }
  out.metAfterSecFromB = met;
  out.openRooms = H.roomDocs(emu).filter((d) => d.kind === 'room' && d.status === 'open').map((d) => `${names[d._openid] || '?'} createdAt=${d.createdAt - T0}`);
  out.finalA = flat(await A.screen()).slice(0, 60); out.finalB = flat(await B.screen()).slice(0, 60);
} catch (e) { out.err = String(e && e.message || e).slice(0, 400); }
console.log(JSON.stringify(out, null, 1));
for (const p of live) await p.close();
srv.close(); await browser.close();
process.exit(0);
