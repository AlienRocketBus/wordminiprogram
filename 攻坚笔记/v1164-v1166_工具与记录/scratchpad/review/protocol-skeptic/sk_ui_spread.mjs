// F5 generalised: after word 1 (host wins it), on word 2 find which side's clock is later (L) and which earlier (Ea).
// Nobody types; when Ea's timeout doc W1 lands, L taps the last letter of the correct word. What does L get?
import { env, H, sleep, doc, docs, out } from './slib.mjs';
const MODE = process.argv[2] || 'A';
const E = await env({ latencyMs: 50, jitterMs: 30, consistencyLagMs: 0, permissionMode: 'rules' });
const emu = E.emu;
const view = (p) => p.eval(() => { const c = document.getElementById('prClock'); const t = document.body.innerText; const m = /第\s*(\d+)\s*\/\s*(\d+)\s*词/.exec(t); return { clock: c ? Number((c.textContent.match(/\d+/) || [NaN])[0]) : null, word: m ? Number(m[1]) : null, hint: ((document.getElementById('prHint') || {}).innerText || '').trim(), my: ((document.getElementById('prMy') || {}).textContent || '') }; });
async function toLobby(p, nick) { await p.tap('#pkRooms'); await H.answerNameIfAsked(p, nick); await p.waitScreen(/开一间/, { timeout: 10000 }); }
try {
  const A = await E.phone('房主'), B = await E.phone('客人');
  await toLobby(A, '小房'); await A.tap('#prNew'); await A.tap(`.pr_mode[data-mode="${MODE}"]`);
  await A.waitScreen(/等对手进来/, { timeout: 15000 });
  const R = docs(emu).find((d) => d.kind === 'room' && d._openid === A.cloudUid);
  await toLobby(B, '小客');
  await H.until(async () => { const h = await B.hitTest(`button[data-rid="${R._id}"]`, { timeout: 400 }); if (h.ok) return h; await B.tap('#prRef').catch(() => {}); return null; }, { timeout: 15000, interval: 900 });
  await B.tap(`button[data-rid="${R._id}"]`);
  await H.until(async () => (await H.battleView(A)) && (await H.battleView(B)), { timeout: 30000 });
  const words = await H.wordsOfRoom(A, R);
  await H.until(async () => { const v = await H.battleView(A); return v && v.round === 0 && !v.disabled; }, { timeout: 10000 });
  await H.typeWord(A, words[0].en);
  await H.until(async () => { const a = await view(A), b = await view(B); return a.word === 2 && b.word === 2 ? 1 : null; }, { timeout: 40000, interval: 120 });
  await sleep(1500);
  const a = await view(A), b = await view(B);
  const L = a.clock >= b.clock ? A : B, Ea = L === A ? B : A;
  out(`[${MODE}] word-2 clocks sampled together: host ${a.clock}s guest ${b.clock}s -> late side = ${L.name}`);
  const w = words[1].en;
  await H.typeWord(L, w.slice(0, -1));
  let W1 = null;
  await H.until(async () => { W1 = doc(emu, R._id + '_w1'); return W1 || null; }, { timeout: 30000, interval: 50 });
  const l0 = await view(L);
  out(`  W1 landed: winner=${JSON.stringify(W1.winner)} by ${W1._openid === Ea.cloudUid ? Ea.name : L.name}; ${L.name}'s clock then: ${l0.clock}s (word ${l0.word})`);
  await L.tap(`#prKb .pr_key[data-k="${w.slice(-1).toLowerCase()}"]`, { timeout: 3000 });
  await sleep(1000);
  const l1 = await view(L);
  out(`  ${L.name} typed the correct word -> ${JSON.stringify(l1.hint)} score ${l0.my} -> ${l1.my}`);
} catch (e) { out('THREW', String(e && e.stack || e).slice(0, 500)); }
await E.done(); process.exit(0);
