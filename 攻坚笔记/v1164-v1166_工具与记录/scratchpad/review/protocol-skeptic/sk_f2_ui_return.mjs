// F2 (real UI, A mode): the guest's network is cut for OUT s mid-match; the host's UI claims the abandon win.
// The guest's network comes back and the kid keeps typing. What does the kid see?
import { env, H, sleep, doc, docs, out } from './slib.mjs';
const OUT = Number(process.argv[2] || 68);
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
async function toLobby(p, nick) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, nick); await p.waitScreen(/开一间/, { timeout: 10000 }); }
const top = (p) => p.eval(() => { const w = document.querySelector('.pr_wrap'); return w ? w.innerText.replace(/\s+/g, ' ').slice(0, 140) : ''; });
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  await toLobby(A, '小房'); await A.tap('#prNew'); await A.tap('.pr_mode[data-mode="A"]');
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = docs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid);
  await toLobby(B, '小客');
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await B.tap(`button[data-rid="${R._id}"]`);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
  const words = await H.wordsOfRoom(A, R);
  await sleep(2500);
  const cut = emu.fault({ uid: B.cloudUid, db: true, do: 'abort' });
  out('guest network cut at word', (await H.battleView(B)).round + 1);
  let hostSaw = '';
  for (let s = 0; s < OUT; s += 4) { await sleep(4000); const t = await top(A); if (/对手已离场|本局你胜/.test(t)) hostSaw = hostSaw || t; }
  cut.remove();
  out('host screen during the outage:', hostSaw ? hostSaw.slice(0, 60) : '(no abandon verdict)');
  const Rd = doc(emu, R._id); out('room on server:', { status: Rd.status, endedBy: Rd.endedBy, abandonWin: Rd.abandonWin });
  const hints = [];
  const t0 = Date.now(); let last = -1;
  while (Date.now() - t0 < 200000) {
    const v = await H.battleView(B);
    if (!v) break;
    if (v.round !== last && !v.disabled && words[v.round] && H.typeable(words[v.round])) {
      last = v.round;
      try { await H.typeWord(B, words[v.round].en); } catch (e) {}
      await sleep(700);
      const v2 = await H.battleView(B); if (v2) hints.push(`word ${v.round + 1}: ${v2.hintLine.slice(0, 22)}`);
    }
    await sleep(300);
  }
  out('guest after the network came back:', hints);
  const res = await H.until(async () => { const t = await top(B); return /分 · 对手|这局|本局|这一局的结果/.test(t) ? t : null; }, { timeout: 90000, interval: 500 });
  out('guest final screen:', res && res.slice(0, 90));
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done(); process.exit(0);
