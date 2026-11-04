/* 客人抢到座位、房主没回应（房主手机卡住）：客人这 15 秒每秒读写多少 */
import { H, tally, fmt } from './meas_lib.mjs';
const srv = await H.startStatic();
const browser = await H.launchBrowser();
const emu = H.makeEmulator({ knobs: { permissionMode: 'legacy', latencyMs: 60, jitterMs: 60, consistencyLagMs: 400 } });
const PK_READY = () => !!(window.HansenAuth && window.HansenPkRoom && window.HansenPkRoomUI && window.HansenLadderUI && window.HansenSbProfile && window.HANSEN_VOCAB_ALL);
let seq = 10;
async function phone(name, nick) {
  const p = await H.openPhone(browser, emu, srv.origin, { name, ready: PK_READY });
  await H.loginPhone(p, '136000000' + (seq++));
  await p.eval((n) => window.HansenSbProfile.setName(n), nick); p.nick = nick;
  return p;
}
const A = await phone('房主', '小蜂甲'), B = await phone('客人', '小蜂乙');
await A.tap('#pkRooms'); await H.answerNameIfAsked(A, A.nick); await A.waitScreen(/开一间/, { timeout: 8000 });
await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="C"]'); await A.waitScreen(/等对手进来/, { timeout: 15000 });
await B.tap('#pkRooms'); await H.answerNameIfAsked(B, B.nick); await B.waitScreen(/开一间/, { timeout: 8000 });
const rid = (H.roomDocs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid) || {})._id;
await H.until(async () => { const h = await B.hitTest(`button[data-rid="${rid}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 20000, interval: 900 });
const hold = emu.hold({ uid: A.cloudUid, db: true });   /* 房主的手机卡住了：它的请求一个都回不来 */
await H.sleep(500);
const t0 = Date.now();
await B.tap(`button[data-rid="${rid}"]`);
const txt = await B.waitScreen(/没有回应|换一间|连不上|占了|没了/, { timeout: 40000 }).catch((e) => e.lastText || '');
const t1 = Date.now();
console.log(`客人等确认 ${((t1 - t0) / 1000).toFixed(1)} 秒，最后看到：${txt.replace(/\s+/g, ' ').slice(0, 120)}`);
console.log(fmt(tally(emu, { uid: B.cloudUid, t0, t1 }), (t1 - t0) / 1000));
const left = H.roomDocs(emu).filter((d) => d.kind === 'seat' && d._openid === B.cloudUid);
console.log('客人留下的座位文档：', left.length, left.map((d) => d._id).join(','));
hold.release();
await A.close(); await B.close(); srv.close(); await browser.close();
