/* checks.mjs — invariants I1–I10 evaluated on a finished World.
 * Every violation: { inv, sig, sev: 'high'|'medium'|'low', who, t, msg }
 * `sig` is a stable root-cause-ish signature used for clustering. */
import { T0 } from './world.mjs';
import { advertised } from './run.mjs';

const MODE = { A: { first: 100, second: 0, span: 20000, waitAll: false }, B: { first: 100, second: 80, span: 15000, waitAll: true }, C: { first: 100, second: 60, span: 15000, waitAll: true } };
const rel = (t) => ((t - T0) / 1000).toFixed(1) + 's';

function overlaps(a, b, c, d) { return a < d && c < b; }

export function disruptionsOf(W, P, a, b) {
  const out = [];
  for (const x of (P.freezes || [])) if (overlaps(T0 + x.at, T0 + x.at + x.dur + 1000, a, b)) out.push('freeze');
  for (const x of (P.partitions || [])) if (overlaps(T0 + x.a, T0 + x.b + 1000, a, b)) out.push('partition');
  for (const x of (P.reloads || [])) if (T0 + x.at >= a - 1000 && T0 + x.at <= b) out.push('reload');
  for (const o of (W.spec.outages || [])) if (overlaps(T0 + o.a, T0 + o.b + 1000, a, b)) out.push('outage');
  for (const it of (P.intents || [])) if ((it.act === 'leave' || it.act === 'closeWaiting' || it.act === 'cancelJoin') && T0 + it.at >= a - 1000 && T0 + it.at <= b) out.push(it.act);
  if (W.marks.some((m) => m.who === P.label && m.what === 'session-fault' && m.t >= a && m.t <= b)) out.push('session');
  return out;
}
function faultNear(W, P, a, b) {
  return W.marks.some((m) => m.uid === P.uid && m.t >= a - 1500 && m.t <= b + 500 && (m.what === 'netfail' || m.what === 'slow' || m.what === 'freeze'))
    || (P.partitions || []).some((x) => overlaps(T0 + x.a, T0 + x.b, a - 1500, b + 500))
    || (W.spec.outages || []).some((o) => overlaps(T0 + o.a, T0 + o.b, a - 1500, b + 500))
    || (P.freezes || []).some((x) => overlaps(T0 + x.at, T0 + x.at + x.dur, a - 16000, b + 500));
}
/* first creation of a doc id (who created it, with what content) */
function firstAdd(W, id) {
  const h = W.server.history(id);
  for (const e of h) if (e.v) return e;
  return null;
}
function ownerPlayer(W, uid) { return W.players.find((p) => p.uid === uid) || (W.adversary && W.adversary.uid === uid ? W.adversary : null); }
function hostOfRoom(W, rid) { const e = firstAdd(W, rid); return e ? ownerPlayer(W, e.by) : null; }

/* the page instance that hosted room rid is alive, awake and online at time t, and still shows that room */
function hostAliveFor(W, rid, t) {
  const H = hostOfRoom(W, rid);
  if (!H || !H.honest) return false;
  const h = H.hosted.find((x) => x.roomId === rid);
  if (!h) return false;
  const inst = H.instances.find((i) => i.no === h.inst);
  if (!inst) return false;
  const deadAt = H.events.find((e) => e.type === 'reload' && e.inst === inst.no);
  if (deadAt && deadAt.t <= t) return false;
  if ((H.freezes || []).some((x) => T0 + x.at <= t && t < T0 + x.at + x.dur + 2000)) return false;
  if ((H.partitions || []).some((x) => T0 + x.a - 30000 <= t && t < T0 + x.b + 2000)) return false;
  if ((W.spec.outages || []).some((o) => T0 + o.a - 30000 <= t && t < T0 + o.b + 2000)) return false;
  /* the host's screen at t is about this room */
  let scr = null;
  for (const e of H.events) { if (e.t > t) break; if (e.type === 'screen' && e.inst === inst.no) scr = e; }
  return !!(scr && (scr.screen === 'waiting' || scr.screen === 'battle' || scr.screen === 'result-wait') && scr.roomId === rid);
}

export function checkWorld(W) {
  const V = [];
  const add = (inv, sig, sev, who, t, msg) => V.push({ inv, sig: inv + ':' + sig, sev, who, t, msg });
  const H = W.players.filter((p) => p.honest);
  const advUid = W.adversary && W.adversary.uid;
  const byKey = new Map(H.filter((p) => !p.twinOf).map((p) => [p.key, p]));

  /* ── module exceptions ── */
  for (const e of W.errors) add('ERR', 'exception:' + e.where, 'high', e.who, e.t, e.msg.split('\n').slice(0, 3).join(' | '));

  /* ── I2: an honest phone attempted to change a doc it does not own ── */
  for (const r of W.ops) {
    if (r.res !== 'denied') continue;
    const P = W.players.find((p) => p.uid === r.uid);
    if (!P || !P.honest) continue;
    const ownerAdv = advUid && r.owner === advUid;
    const fr = frameOf(r.stack);
    add('I2', r.op + (fr ? '@' + fr : '') + (ownerAdv ? ':adv-forged-target' : ''), ownerAdv ? 'low' : 'high', r.who, r.t0,
      r.op + ' ' + r.id + ' owned by ' + (ownerPlayer(W, r.owner) || { label: r.owner }).label + (r.fault ? ' (fault ' + r.fault + ')' : ''));
  }

  /* ── pair up matches ── */
  const pairs = [];
  const guestMatches = [];
  for (const P of H) for (const m of P.matches) {
    m.P = P;
    if (m.side === 'guest') guestMatches.push(m);
  }
  for (const P of H) for (const m of P.matches) {
    if (m.side !== 'host') continue;
    const G = byKey.get(m.oppKey);
    const sameSeat = (x) => x.seat == null || m.seat == null || Number(x.seat) === Number(m.seat);
    const mg = G ? G.matches.filter((x) => x.roomId === m.roomId && x.side === 'guest' && sameSeat(x)).pop() : null;
    if (mg) { pairs.push({ h: m, g: mg, H: P, G, R: m.roomId }); mg.paired = true; m.paired = true; }
    else m.oppPlayer = G || null;
  }

  /* ── I1: seat exclusivity, phantom seats ── */
  const seated = new Map();
  for (const P of H) for (const j of P.joins) {
    if (!j.ok || j.stale || j.cancelledByUser) continue;
    const k = j.roomId + '|' + j.seat;
    if (!seated.has(k)) seated.set(k, new Set());
    seated.get(k).add(P.label);
  }
  for (const [k, s] of seated) if (s.size > 1) add('I1', 'double-seat', 'high', [...s].join(','), 0, 'room|epoch ' + k + ' seated ' + [...s].join(' & '));
  for (const mg of guestMatches) {
    if (mg.paired) continue;
    const G = mg.P;
    const host = hostOfRoom(W, mg.roomId);
    const hostJoinedMe = host && host.honest && host.waitEvents.some((e) => e.roomId === mg.roomId && e.ev.joined && e.guestId === G.key && (e.seat == null || mg.seat == null || Number(e.seat) === Number(mg.seat)));
    if (hostJoinedMe) continue;   /* host accepted me but never started (e.g. it left) – not a phantom */
    if (mg.end && mg.end.how === 'left') continue;   /* the kid itself left right away */
    const j = G.joins.find((x) => x.ok && x.roomId === mg.roomId);
    if (host && disruptionsOf(W, host, (j ? j.t0 : mg.startT) - 2000, (mg.result ? mg.result.t : mg.end ? mg.end.t : W.phase1End)).length) continue;   /* the host lost its network / went away: graceful kick is fine */
    const res = mg.result;
    const end = mg.end;
    const w = (mg.words || []).filter(Boolean).length;
    const ownW = [];
    for (let i = 0; i < 30; i++) { const e = firstAdd(W, mg.roomId + '_w' + i); if (e && e.by === G.uid) ownW.push(i); }
    const detail = 'guest ' + G.label + ' got joinRoom ok for ' + mg.roomId + ' seat ' + mg.seat + ' but host ' + (host ? host.label : '?')
      + ' never started with it; guest played ' + w + ' words, wrote W' + JSON.stringify(ownW) + ', ended: '
      + (res ? res.result + (res.byAbandon ? ' byAbandon(' + res.why + ')' : '') : (end ? end.how + (end.kicked ? ' (kicked)' : '') : G.inst.ui.screen));
    if (res && res.result === 'win') add('I1', 'phantom-seat-awarded-win', 'high', G.label, mg.startT, detail);
    else if (res) add('I1', 'phantom-seat-settled', 'medium', G.label, mg.startT, detail);
    else add('I1', 'phantom-seat', 'low', G.label, mg.startT, detail);
  }

  /* ── I3 / I4 per real match ── */
  for (const pr of pairs) {
    const { h, g, R } = pr;
    const M = MODE[h.mode] || MODE.C;
    const nW = Math.max(h.nWords || 0, g.nWords || 0);
    const W_ = [];
    for (let i = 0; i < nW; i++) {
      const e = firstAdd(W, R + '_w' + i);
      W_[i] = e ? { winner: e.v.winner, by: e.by, at: e.t } : null;
    }
    const sideUid = { host: pr.H.uid, guest: pr.G.uid };
    /* integrity: every decided round doc was written by one of the two players */
    for (let i = 0; i < nW; i++) {
      const w = W_[i];
      if (!w) continue;
      if (w.by !== pr.H.uid && w.by !== pr.G.uid) {
        if (advUid && w.by === advUid) add('I8', 'adv-win-doc-accepted', 'high', pr.H.label + '/' + pr.G.label, w.at, R + '_w' + i + ' (winner ' + JSON.stringify(w.winner) + ') was created by the adversary and decided an honest round');
        else add('I3', 'foreign-win-doc', 'high', pr.H.label + '/' + pr.G.label, w.at, R + '_w' + i + ' (winner ' + JSON.stringify(w.winner) + ') created by ' + (ownerPlayer(W, w.by) || { label: w.by }).label + ', not by either player of this match');
      } else if (w.winner && sideUid[w.winner] !== w.by) {
        add('I3', 'win-doc-wrong-side', 'high', '', w.at, R + '_w' + i + ' winner ' + w.winner + ' written by the other side');
      }
    }
    for (const [m, P] of [[h, pr.H], [g, pr.G]]) {
      const side = m.side, ws = m.lastWinners || [];
      for (let i = 0; i < ws.length && i < nW; i++) {
        const truth = W_[i] ? W_[i].winner : undefined;
        if (truth === undefined) { add('I3', 'winner-without-doc', 'high', P.label, m.startT, 'saw winners[' + i + ']=' + JSON.stringify(ws[i]) + ' but no W doc'); continue; }
        if ((ws[i] || '') !== (truth || '')) add('I3', 'winner-mismatch', 'high', P.label, m.startT, 'winners[' + i + '] seen ' + JSON.stringify(ws[i]) + ' vs doc ' + JSON.stringify(truth));
      }
      for (const c of m.claims) {
        const truth = W_[c.idx];
        if (!c.ok) continue;
        if (c.won && (!truth || truth.by !== P.uid)) add('I3', 'claim-won-not-mine', 'high', P.label, c.t, 'claimRound(' + c.idx + ') said won but W doc ' + JSON.stringify(truth));
        if (!c.won && truth && truth.winner === side && truth.by === P.uid) add('I3', 'claim-lost-but-mine', 'medium', P.label, c.t, 'claimRound(' + c.idx + ') said lost but my W doc won');
      }
      /* the kid spelled it right before its deadline, but a skip doc ('' = nobody) had already decided the word */
      for (let i = 0; i < nW; i++) {
        const wr = m.words && m.words[i];
        if (!wr || !wr.correct || !W_[i] || W_[i].winner !== '') continue;
        if (wr.subT - wr.t >= wr.localDeadlineIn - 250) continue;   /* typed at/after its own deadline: the UI still takes it for <1 s, the skip legitimately won */
        const other = side === 'host' ? g : h;
        const OP = side === 'host' ? pr.G : pr.H;
        if (disruptionsOf(W, P, wr.t - 25000, wr.subT).length || disruptionsOf(W, OP, wr.t - 25000, wr.subT).length) continue;   /* somebody was away: the skip is legitimate */
        const ow = other.words && other.words[i];
        const dsk = Math.abs((OP.skew || 0) - (P.skew || 0));
        add('I3', 'skip-beat-correct-answer' + (M.waitAll ? ':BC' : ':A') + (dsk > 3000 ? ':skew' : ''), M.waitAll ? 'low' : 'medium', P.label, wr.subT,
          'word ' + i + ': ' + P.label + ' spelled it right ' + ((wr.subT - wr.t) / 1000).toFixed(1) + 's after the word appeared (local deadline in '
          + (wr.localDeadlineIn / 1000).toFixed(1) + 's) but the skip W doc of ' + ((ownerPlayer(W, W_[i].by) || {}).label) + ' was already there'
          + (ow ? ' (the other phone timed out ' + ((ow.subT - ow.t) / 1000).toFixed(1) + 's after its word appeared, deadline in ' + (ow.localDeadlineIn / 1000).toFixed(1) + 's)' : ''));
      }
    }
    /* the match was decided by an abandon claim, but this phone kept playing words for a long time without being told */
    for (const [m, P, myDoc, oppDoc, oppSide] of [[h, pr.H, R, R + '_s' + h.seat, 'guest'], [g, pr.G, R + '_s' + g.seat, R, 'host']]) {
      let tClaim = 0;
      for (const x of W.server.history(oppDoc)) if (x.v && x.v.abandonWin === oppSide) { tClaim = x.t; break; }
      if (!tClaim) continue;
      const late = (m.words || []).filter((w) => w && w.subT && w.subT > tClaim + 15000);
      const awake = !disruptionsOf(W, P, tClaim, tClaim + 15000).length;
      if (late.length >= 2) add('I5', 'played-on-after-opponent-claimed-abandon:' + m.side + (awake ? '' : '-after-resume'), 'low', P.label, tClaim,
        P.label + ' (' + m.side + ') kept answering ' + late.length + ' more words after the opponent had claimed the win by abandon at ' + rel(tClaim) + ' — it is only told at the very end');
    }
    /* I4: results */
    const rh = h.result, rg = g.result;
    const a = Math.min(h.startT, g.startT);
    const b = Math.max(rh ? rh.t : W.phase1End, rg ? rg.t : W.phase1End);
    const disH = disruptionsOf(W, pr.H, a - 3000, b), disG = disruptionsOf(W, pr.G, a - 3000, b);
    const clean = !disH.length && !disG.length && !W.adversary;
    const tag = clean ? 'clean' : 'disrupted(' + [...new Set(disH.concat(disG))].join(',') + ')';
    if (rh && rg) {
      const comp = (rh.result === 'win' && rg.result === 'lose') || (rh.result === 'lose' && rg.result === 'win') || (rh.result === 'draw' && rg.result === 'draw');
      if (!comp) {
        const ab = (rh.byAbandon ? 'H-abandon(' + rh.why + ')' : 'H-real') + '/' + (rg.byAbandon ? 'G-abandon(' + rg.why + ')' : 'G-real');
        add('I4', 'results-' + rh.result + '-' + rg.result + ':' + abSig(rh, rg), 'high', pr.H.label + '/' + pr.G.label, Math.max(rh.t, rg.t),
          R + ' host ' + rh.result + ' ' + rh.mine + ':' + rh.theirs + ' vs guest ' + rg.result + ' ' + rg.mine + ':' + rg.theirs + ' [' + ab + '] ' + tag);
      } else if (!rh.byAbandon && !rg.byAbandon && (rh.mine !== rg.theirs || rh.theirs !== rg.mine)) {
        add('I4', 'scores-not-mirrored', 'high', pr.H.label + '/' + pr.G.label, Math.max(rh.t, rg.t), R + ' host ' + rh.mine + ':' + rh.theirs + ' guest ' + rg.mine + ':' + rg.theirs);
      }
    }
    const sweptBy = W.ops.find((o) => o.op === 'remove' && o.res === 'del' && (o.id === R || o.id.startsWith(R + '_s')) && o.t0 < b
      && W.players.some((p) => p.twinOf && o.who.startsWith(p.label)));
    if (clean) {
      if (!rh || !rg) add('I4', 'clean-match-unsettled' + (sweptBy ? ':live-doc-swept-by-same-account-device' : ''), 'high', pr.H.label + '/' + pr.G.label, a,
        R + ' both phones stayed on and connected, but host ' + (rh ? rh.result : endOf(h, pr.H)) + ' / guest ' + (rg ? rg.result : endOf(g, pr.G)));
      else if (rh.byAbandon || rg.byAbandon) add('I4', 'clean-match-false-abandon:' + (rh.byAbandon ? 'H:' + rh.why : '') + (rg.byAbandon ? 'G:' + rg.why : ''), 'high', pr.H.label + '/' + pr.G.label, Math.max(rh.t, rg.t),
        R + ' both phones stayed on and connected, yet ' + (rh.byAbandon ? 'host ' + rh.result + ' by abandon (' + rh.why + ') ' : '') + (rg.byAbandon ? 'guest ' + rg.result + ' by abandon (' + rg.why + ')' : ''));
    }
    /* I4b: every reported score agrees with the round docs and the kid's answers */
    for (const [m, P] of [[h, pr.H], [g, pr.G]]) {
      for (let i = 0; i < nW; i++) {
        const wr = m.words && m.words[i];
        if (!wr || !wr.correct) continue;
        const w = W_[i];
        const mineWon = !!(w && w.winner === m.side && w.by === P.uid);
        const pts = mineWon ? M.first : M.second;
        if (wr.gain === pts) continue;
        const c = m.claims.find((x) => x.idx === i);
        const tEnd = m.result ? m.result.t : (m.end ? m.end.t : Infinity);
        if ((c && c.t >= tEnd) || (!c && wr.subT >= tEnd)) continue;   /* the match was already over when the answer came back */
        if (!c && disruptionsOf(W, P, wr.subT - 1000, wr.subT + 20000).length) continue;   /* the page died / froze before the answer came back */
        if (c && !c.ok && c.kind === 'session' && W.marks.some((mk) => mk.who.startsWith(P.label) && mk.what === 'session-fault' && Math.abs(mk.t - c.t) < 25000)) continue;
        const outage = disruptionsOf(W, P, wr.subT - 2000, (c ? c.t : wr.subT) + 500).some((d) => d === 'partition' || d === 'outage' || d === 'freeze');
        let why;
        if (mineWon && wr.gain === 0) why = 'own-win-doc-landed-but-scored-0' + (c && !c.ok ? ':' + c.kind : '');
        else if (c && !c.ok) { if (outage && (c.kind === 'network' || c.kind === 'slow')) continue; why = 'claim-failed:' + c.kind; }
        else if (!c) continue;
        else why = 'claim-ok-but-scored-' + wr.gain + '-vs-' + pts;
        add('I4', 'score-vs-rounds:' + why, 'medium', P.label, wr.subT,
          R + ' word ' + i + ': ' + P.label + ' spelled it right; round doc ' + JSON.stringify(w) + ' ⇒ ' + pts + ' points, the UI scored ' + wr.gain + (c ? ' (claimRound ' + (c.ok ? 'ok won=' + c.won : 'FAILED kind=' + c.kind) + ')' : ''));
        break;
      }
    }
    /* I10: ratings passed */
    if (h.ladder && rh && rg) {
      if (h.oppRatingUsed !== pr.G.rating) add('I10', 'host-used-wrong-opp-rating', 'medium', pr.H.label, rh.t, 'host recorded opp rating ' + h.oppRatingUsed + ', guest rating is ' + pr.G.rating);
      if (g.oppRatingUsed !== pr.H.rating) add('I10', 'guest-used-wrong-opp-rating', 'medium', pr.G.label, rg.t, 'guest recorded opp rating ' + g.oppRatingUsed + ', host rating is ' + pr.H.rating);
    }
  }
  /* host played against someone who is not an honest guest of this room */
  for (const P of H) for (const m of P.matches) {
    if (m.side !== 'host' || m.paired) continue;
    const seatDoc = firstAdd(W, m.roomId + '_s' + m.seat);
    if (seatDoc && advUid && seatDoc.by === advUid) {
      const forged = byKey.has(m.oppKey);
      add('I8', forged ? 'impersonated-guest-accepted' : 'adv-seat-accepted', forged ? 'high' : 'low', P.label, m.startT,
        'host accepted ' + m.roomId + '_s' + m.seat + ' created by the adversary' + (forged ? ' claiming to be ' + byKey.get(m.oppKey).label : ''));
    } else if (m.result && m.result.result === 'win' && !m.result.byAbandon) {
      add('I1', 'host-won-vs-phantom', 'medium', P.label, m.startT, 'host played ' + m.roomId + ' vs ' + m.oppKey + ' who never played it');
    }
  }

  /* ── I5: liveness ── */
  for (const P of H) {
    const s1 = W.screenAtP1 && W.screenAtP1.get(P.label);
    const LIM = { joining: 45000, creating: 45000, switching: 45000, waiting: 200000, 'ladder-matching': 240000, 'result-wait': 420000, battle: 400000 };
    if (!W.phase1Complete && s1 && !s1.idle && (W.phase1End - s1.at) > (LIM[s1.screen] || 120000)) {
      add('I5', 'stuck-at-end:' + s1.screen, 'high', P.label, s1.at, P.label + ' still on 「' + s1.screen + '」 since ' + rel(s1.at) + ' when the run hit the hard limit ' + rel(W.phase1End) + ' (last scripted event ' + rel(W.lastAt) + ')');
    }
    /* long non-terminal stretches */
    const segs = segments(P, W.phase1End);
    for (const s of segs) {
      if (disruptionsOf(W, P, s.t, s.t + s.dur).some((d) => d === 'freeze' || d === 'partition' || d === 'outage' || d === 'reload')) continue;
      const lim = { joining: 45000, creating: 45000, switching: 45000, waiting: 200000, 'ladder-matching': 240000, 'result-wait': 420000 }[s.screen];
      if (lim && s.dur > lim) add('I5', 'too-long:' + s.screen, 'medium', P.label, s.t, P.label + ' spent ' + (s.dur / 1000).toFixed(0) + 's on 「' + s.screen + '」 (limit ' + lim / 1000 + 's)');
      if (s.screen === 'battle') {
        const m = P.matches.find((x) => x.startT === s.t);
        const nw = m ? m.nWords : 10;
        const limB = nw * 26000 + 90000;
        if (s.dur > limB) add('I5', 'battle-too-long', 'medium', P.label, s.t, P.label + ' battle lasted ' + (s.dur / 1000).toFixed(0) + 's for ' + nw + ' words (limit ' + limB / 1000 + 's)');
      }
    }
  }

  /* ── I5b: a page that is idle (everybody done, end phase) must not keep heartbeating some room ── */
  for (const r of W.ops) {
    if (r.op !== 'update' || r.t0 < W.phase1End + 20000 || !r.data) continue;
    if (!('guestBeat' in r.data) && !('hostBeat' in r.data) && !('heartbeatAt' in r.data)) continue;
    const P = W.players.find((p) => p.uid === r.uid && r.who.startsWith(p.label));
    if (!P || !P.honest) continue;
    const key = 'zombie|' + r.who + '|' + r.id;
    if (V.some((v) => v.key === key)) continue;
    const scr = P.inst && P.inst.ui ? P.inst.ui.screen : '?';
    V.push({ inv: 'I5', sig: 'I5:zombie-heartbeat-after-leave', sev: 'medium', who: r.who, t: r.t0, key,
      msg: r.who + ' (screen 「' + scr + '」, idle since ' + rel(W.phase1End) + ') still patches ' + r.id + ' ' + JSON.stringify(r.data).slice(0, 90) + ' at ' + rel(r.t0) });
  }

  /* ── I6: failure kinds must describe the cause ── */
  for (const P of H) {
    for (const f of P.apiFails) {
      if (f.cancelled) continue;
      const k = f.kind;
      if (k === 'config') add('I6', 'config:' + f.api + ':' + (f.code || rawCode(f.reason)), 'high', P.label, f.t1, f.api + ' → kind config 「' + f.reason.slice(0, 140) + '」');
      else if (k === 'expired') add('I6', 'expired:' + f.api, 'high', P.label, f.t1, f.api + ' → kind expired 「' + f.reason.slice(0, 120) + '」');
      else if (k === 'session' && !W.marks.some((m) => m.who.startsWith(P.label) && m.what === 'session-fault' && m.t >= f.t0 - 2000 && m.t <= f.t1)) add('I6', 'session-without-cause:' + f.api, 'medium', P.label, f.t1, f.api + ' → session');
      else if ((k === 'network' || k === 'slow') && !faultNear(W, P, f.t0, f.t1)) add('I6', k + '-without-fault:' + f.api, 'medium', P.label, f.t1, f.api + ' → ' + k + ' 「' + f.reason.slice(0, 100) + '」 with no network fault on this phone');
      else if (k === 'taken' && f.api === 'joinRoom') {
        const R0 = W.server.stateAt(f.arg, f.t0);
        if (!takenTruth(W, P, f)) add('I6', 'taken-but-nobody-else:' + (R0 && R0.guestId === P.key ? 'room-holds-my-own-key' : takenWhy(W, P, f)), R0 && R0.guestId === P.key ? 'low' : 'medium', P.label, f.t1, 'joinRoom(' + f.arg + ') → 「' + f.reason.slice(0, 60) + '」 but no other guest ever held a seat / the host never re-opened for someone else');
      } else if (k === 'gone' && (f.api === 'joinRoom' || f.api === 'findByCode') && f.arg) {
        const rid = f.api === 'joinRoom' ? f.arg : codeRoom(W, f.arg, f.t0);
        if (rid && hostAliveFor(W, rid, f.t0) && hostAliveFor(W, rid, f.t1)) {
          const hp = hostOfRoom(W, rid);
          const skewish = hp && Math.abs(hp.skew - P.skew) > 25000;
          const R0 = W.server.stateAt(rid, f.t0), R1 = W.server.stateAt(rid, f.t1);
          const open = (R) => R && R.status === 'open' && !R.guestId;
          const born = firstAdd(W, rid);
          const young = born && (f.t0 - born.t) < 8000 && !skewish;
          if (open(R0) && open(R1)) add('I6', 'gone-but-room-open:' + f.api + (skewish ? ':skew' : young ? ':room-just-created' : ':lag'), skewish ? 'high' : young ? 'low' : 'medium', P.label, f.t1,
            f.api + '(' + f.arg + ') → 「' + f.reason.slice(0, 60) + '」 while host ' + hp.label + ' was online and waiting with the room open (clock diff ' + Math.round((hp.skew - P.skew) / 1000) + 's)');
          else add('I6', 'full-room-reported-gone:' + f.api, 'low', P.label, f.t1,
            f.api + '(' + f.arg + ') → 「' + f.reason.slice(0, 60) + '」 but the room is alive, just already playing with someone else');
        }
      } else if (k === 'other' && /房主没有回应/.test(f.reason) && f.api === 'joinRoom') {
        const ackT = ackedAt(W, f.arg, P.key, f.t0, f.t1);
        if (ackT) add('I6', 'ack-timeout-but-host-had-acked', 'medium', P.label, f.t1, 'joinRoom(' + f.arg + ') gave up 「房主没有回应」 although the host had written guestId=me at ' + rel(ackT));
        else if (hostAliveFor(W, f.arg, f.t0 + 1000) && hostAliveFor(W, f.arg, f.t1 - 1000)) {
          const hp = hostOfRoom(W, f.arg);
          add('I6', 'ack-timeout-host-alive' + (hp && Math.abs(hp.skew - P.skew) > 14000 ? ':skew' : ''), 'low', P.label, f.t1, 'joinRoom(' + f.arg + ') 「房主没有回应」 while host ' + (hp && hp.label) + ' was online and waiting');
        }
      }
    }
    for (const e of P.waitEvents) {
      if (e.ev.gone) {
        const R = W.server.latest(e.roomId);
        if (R && R.status !== 'done') add('I6', 'own-room-reported-gone', 'medium', P.label, e.t, 'waitForOpponent(' + e.roomId + ') → {gone} but the room exists (status ' + R.status + ')');
      }
      if (e.ev.error) {
        const k = e.ev.kind;
        if (k === 'config' || k === 'expired') add('I6', 'wait-error:' + k, 'high', P.label, e.t, 'waitForOpponent → error ' + k + ' 「' + String(e.ev.error).slice(0, 100) + '」');
        else if ((k === 'network' || k === 'slow') && !faultNear(W, P, e.t - 12000, e.t)) add('I6', 'wait-error-' + k + '-without-fault', 'medium', P.label, e.t, 'waitForOpponent → ' + k);
      }
    }
    /* told "your opponent never came" while the opponent was there and playing */
    for (const m of P.matches) {
      if (!m.end || m.end.how !== 'opp-never-came') continue;
      const pr = pairs.find((x) => x.h === m || x.g === m);
      if (!pr) continue;
      const O = pr.h === m ? pr.G : pr.H, om = pr.h === m ? pr.g : pr.h;
      const played = (om.words || []).filter((w) => w && w.submitted).length;
      if (played > 0 && !disruptionsOf(W, O, m.startT, m.end.t).length) add('I6', 'opp-never-came-but-was-playing' + (m.end.kicked ? ':kicked' : ''), 'medium', P.label, m.end.t,
        P.label + ' was told 「对手刚才没进来」 in ' + m.roomId + ' while ' + O.label + ' had played ' + played + ' words');
    }
  }

  /* ── I7: nothing honest still advertised as open once everyone left and the sweeps ran ── */
  const honestUids = new Set(H.map((p) => p.uid));
  for (const x of advertised(W, W.now)) {
    if (!honestUids.has(x._openid)) continue;
    const hp = ownerPlayer(W, x._openid);
    add('I7', 'ghost-room-listed' + (hp && Math.abs(hp.skew) > 120000 ? ':host-clock-ahead' : ''), 'medium', hp ? hp.label : x._openid, W.now,
      x._id + ' still listed as open ' + ((W.now - W.phase1End) / 1000).toFixed(0) + 's after everyone went idle (heartbeatAt = observer clock '
      + (((x.heartbeatAt || 0) - W.now) / 1000).toFixed(0) + 's; host skew ' + (hp ? Math.round(hp.skew / 1000) : '?') + 's)');
  }

  /* ── I10: simultaneous ladder starts converge ── */
  if (W.spec.kind === 'ladder' && !W.adversary) {
    const L = H.filter((p) => p.ladderer);
    const firsts = L.map((p) => { const e = p.events.find((x) => x.type === 'ladder-press'); return e ? e.t : null; }).filter((x) => x != null);
    if (L.length >= 2 && firsts.length === L.length) {
      const t0 = Math.min(...firsts), t1 = Math.max(...firsts);
      const ratings = L.map((p) => p.rating);
      const tConv = t1 + 150000;
      const calm = L.every((p) => !disruptionsOf(W, p, t0 - 1000, tConv).length) && !(W.spec.outages || []).some((o) => overlaps(T0 + o.a, T0 + o.b, t0, tConv));
      if (t1 - t0 <= 5000 && Math.max(...ratings) - Math.min(...ratings) <= 100 && calm) {
        const got = new Set();
        let nPairs = 0;
        for (const pr of pairs.slice().sort((x, y) => Math.min(x.h.startT, x.g.startT) - Math.min(y.h.startT, y.g.startT))) {
          if (!pr.h.ladder) continue;
          if (pr.h.startT > tConv || pr.g.startT > tConv) continue;
          if (got.has(pr.H.label) || got.has(pr.G.label)) continue;
          got.add(pr.H.label); got.add(pr.G.label); nPairs++;
        }
        const need = Math.floor(L.length / 2);
        if (nPairs < need) {
          const sk = L.map((p) => p.label + ':' + Math.round(p.skew / 1000) + 's').join(' ');
          const skewed = L.some((p) => Math.abs(p.skew - L[0].skew) > 25000);
          add('I10', 'no-convergence' + (skewed ? ':skew' : ''), 'high', L.map((p) => p.label).join(','), t1,
            L.length + ' kids pressed 开始排位 within ' + ((t1 - t0) / 1000).toFixed(1) + 's, only ' + nPairs + '/' + need + ' matches formed within 150s (skews ' + sk + ')');
        }
      }
    }
  }
  return V;
}

function abSig(rh, rg) {
  const f = (r) => (r.byAbandon ? 'ab:' + String(r.why || '').replace(/[0-9]+/g, '') : 'real');
  return f(rh) + '/' + f(rg);
}
function endOf(m, P) { return m.end ? m.end.how : ('no result (' + (P.inst && P.inst.ui ? P.inst.ui.screen : '?') + ')'); }
function rawCode(reason) { const m = /([A-Z][A-Z_]{6,})/.exec(String(reason || '')); return m ? m[1] : 'nocode'; }
function frameOf(stack) {
  if (!stack) return '';
  const lines = String(stack).split('\n').filter((l) => /hansen_pk_room_v1065\.js/.test(l));
  const pick = lines.find((l) => !/(wrapTimeout|once|withTimeout|\bout\.|realTransport|__hsnProbe)/.test(l)) || lines[0] || '';
  const m = /at (\S+) .*?:(\d+):\d+\)?$/.exec(pick.trim()) || /:(\d+):\d+\)?$/.exec(pick.trim());
  if (!m) return '';
  return m.length > 2 ? m[1] + ':L' + m[2] : 'L' + m[1];
}
function segments(P, tEnd) {
  const out = []; let cur = null;
  for (const e of P.events) {
    if (e.type === 'load' || e.type === 'reload') { if (cur) { cur.dur = e.t - cur.t; out.push(cur); cur = null; } continue; }
    if (e.type !== 'screen') continue;
    if (cur && cur.screen === e.screen && cur.inst === e.inst) continue;
    if (cur) { cur.dur = e.t - cur.t; out.push(cur); }
    cur = { screen: e.screen, t: e.t, inst: e.inst };
  }
  if (cur) { cur.dur = tEnd - cur.t; out.push(cur); }
  return out;
}
function codeRoom(W, code, t) {
  for (const P of W.players) for (const h of P.hosted) if (h.code === code && h.t <= t + 1) return h.roomId;
  return null;
}
/* was the seat really taken by somebody else (or the room really not open for me)? */
function takenTruth(W, P, f) {
  const rid = f.arg;
  for (let e = 0; e < 12; e++) {
    const h = W.server.history(rid + '_s' + e);
    for (const x of h) if (x.v && x.by !== P.uid && x.t <= f.t1) return true;
  }
  for (const x of W.server.history(rid)) {
    if (x.t > f.t1) break;
    if (x.v && x.v.guestId !== P.key && ((x.v.guestId) || x.v.status !== 'open')) { if (x.t >= f.t0 - 30000) return true; }
  }
  const R0 = W.server.stateAt(rid, f.t0);
  if (R0 && (R0.guestId && R0.guestId !== P.key)) return true;
  return false;
}
function takenWhy(W, P, f) {
  /* what the guest's own seat looked like: mine but unacked / re-opened by host */
  const rid = f.arg;
  let mine = false, bumped = false;
  for (let e = 0; e < 12; e++) for (const x of W.server.history(rid + '_s' + e)) if (x.v && x.by === P.uid && x.t >= f.t0 && x.t <= f.t1) mine = true;
  for (const x of W.server.history(rid)) if (x.v && x.t >= f.t0 && x.t <= f.t1 && Number(x.v.seat) > 0) bumped = true;
  return mine ? (bumped ? 'host-reopened-my-seat' : 'my-own-seat') : 'no-seat';
}
function ackedAt(W, rid, key, a, b) {
  for (const x of W.server.history(rid)) if (x.v && x.v.guestId === key && x.t >= a && x.t <= b) return x.t;
  return 0;
}
