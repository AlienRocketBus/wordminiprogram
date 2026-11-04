// F5 / F7 (real UI, A mode): host wins word 1; word 2 nobody types. Sample both clocks; when the guest's
// timeout doc W1 lands, the host taps the last letter of the correct word. Optional host clock skew.
import { env, H, sleep, doc, docs, out } from './slib.mjs';
const SKEW = Number(process.argv[2] || 0), MODE = process.argv[3] || 'A';
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
const clock = (p) => p.eval(() => { const c = document.getElementById('prClock'); const t = document.body.innerText; const m = /第\s*(\d+)\s*\/\s*(\d+)\s*词/.exec(t); return { clock: c ? c.textContent : null, word: m ? Number(m[1]) : null, hint: ((document.getElementById('prHint') || {}).innerText || '').trim(), my: ((document.getElementById('prMy') || {}).textContent || '') }; });
async function toLobby(p, nick) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, nick); await p.waitScreen(/开一间/, { timeout: 10000 }); }
try {
  const A = await E.phone('房主', { skewMs: SKEW }), B = await E.phone('客人');
  await toLobby(A, '小房'); await A.tap('#prNew'); await A.tap(`.pr_mode[data-mode="${MODE}"]`);
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = docs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid);
  await toLobby(B, '小客');
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await B.tap(`button[data-rid="${R._id}"]`);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
  const words = await H.wordsOfRoom(A, R);
  out('words', words.slice(0, 3).map((w) => w.en), 'host skew', SKEW);
  // word 1: host types it right away
  await H.until(async () => { const v = await H.battleView(A); return v && v.round === 0 && !v.disabled; }, { timeout: 10000 });
  await H.typeWord(A, words[0].en);
  // word 2: wait until both show it
  await H.until(async () => { const a = await clock(A), b = await clock(B); return a.word === 2 && b.word === 2 ? 1 : null; }, { timeout: 15000, interval: 150 });
  out('word-2 start: host', (await clock(A)).clock, ' guest', (await clock(B)).clock);
  if (Math.abs(SKEW) >= 60000 || SKEW < 0) {
    for (let k = 0; k < 6; k++) { await sleep(5000); const a = await clock(A), b = await clock(B); out(`  +${(k + 1) * 5}s host word ${a.word} ${a.clock} | guest word ${b.word} ${b.clock}  W1=${JSON.stringify((doc(emu, R._id + '_w1') || {}).winner)}`); }
  } else {
    const w = words[1].en;
    await H.typeWord(A, w.slice(0, -1));          // everything but the last letter
    let at = null;
    await H.until(async () => { const W1 = doc(emu, R._id + '_w1'); if (W1) { at = W1; return 1; } return null; }, { timeout: 30000, interval: 60 });
    const hostAt = await clock(A);
    out('W1 landed:', { winner: at.winner, byGuest: at._openid === B.cloudUid }, ' host clock now:', hostAt.clock, ' host word', hostAt.word);
    await A.tap(`#prKb .pr_key[data-k="${w.slice(-1).toLowerCase()}"]`, { timeout: 3000 });
    await sleep(900);
    const after = await clock(A);
    out('host after typing the correct word:', JSON.stringify(after.hint), ' host score', after.my);
  }
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 600)); }
await E.done(); process.exit(0);
