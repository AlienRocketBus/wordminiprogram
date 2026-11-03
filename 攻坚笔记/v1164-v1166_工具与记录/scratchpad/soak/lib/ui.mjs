/* ui.mjs — a DOM-free port of the control flow of hansen_pk_room_ui_v1065.js (房间 UI) and
 * hansen_ladder_ui_v1108.js (天梯 UI) as of the v1164 snapshot. It makes the SAME data-layer calls in the SAME
 * order with the SAME timers (the UI line numbers are given next to each port), but instead of painting HTML it
 * records which "screen" the phone shows and why. A simulated kid taps buttons and types answers.
 *
 * If a finding involves only this file's logic it is a UI-port finding: re-check it in the real UI file.
 */

const TERMINAL = { home: 1, lobby: 1, 'ladder-home': 1, result: 1, 'result-failed': 1, 'ladder-problem': 1 };

export class Ui {
  constructor(inst) {
    this.inst = inst; this.w = inst.world; this.P = inst.player; this.api = inst.api;
    /* room UI module state (hansen_pk_room_ui_v1065.js top-level vars) */
    this._state = null; this._rt = null; this._pollTimer = null; this._cancelWait = null;
    this._joinSeq = 0; this._joiningRid = ''; this._fromLadder = false; this._cameFromLadder = false;
    this._ladderCfg = null; this._pickedMode = 'C'; this._askMode = 'cn'; this._wantPrivate = false;
    this._waitMs = 120000; this._netMiss = 0; this._waitResult = 0; this._resultFail = 0; this._goneChecked = 0;
    this._onCancelJoin = null;
    /* ladder UI state */
    this._run = null; this._cancel = null; this._netFail = 0;
    /* kid / bookkeeping */
    this.screen = 'home'; this.screenAt = this.w.now; this.reason = '';
    this.joinPlan = null; this.cur = null; this.presses = 0;
  }
  /* ── plumbing ── */
  now() { return this.inst.localNow(); }                       /* the UI uses the phone's own Date.now() */
  setTimeout(f, ms) { return this.inst.setTimeout(f, ms); }
  setInterval(f, ms) { return this.inst.setInterval(f, ms); }
  clearTimer(id) { if (id) this.inst.clearTimer(id); }
  log(msg) { this.w.log(this.inst.label, msg); }
  ev(type, o) { const e = Object.assign({ t: this.w.now, inst: this.inst.no, type }, o || {}); this.P.events.push(e); return e; }
  idle() { return !!TERMINAL[this.screen]; }
  go(screen, reason, extra) {
    this.screen = screen; this.screenAt = this.w.now; this.reason = reason ? String(reason) : '';
    this.w.lastChange = this.w.now;
    this.ev('screen', Object.assign({ screen, reason: this.reason }, extra || {}));
    this.log('screen ' + screen + (this.reason ? ' 「' + this.reason.slice(0, 70) + '」' : ''));
    if (TERMINAL[screen]) this.w.onIdle(this);
  }
  kindOf(r) { try { if (r && typeof r.kind === 'string' && r.kind) return r.kind; return this.api.kindOf(r); } catch (e) { return 'other'; } }
  /* call a data-layer method and record the outcome (for the kind / liveness checks) */
  call(name, ...args) {
    const t0 = this.w.now, P = this.P, self = this;
    let p;
    try { p = this.api[name](...args); } catch (e) { this.w.moduleError(e, this.inst, 'call ' + name); return Promise.resolve({ ok: false, reason: String(e) }); }
    return Promise.resolve(p).then((r) => {
      const rec = { t0, t1: self.w.now, inst: self.inst.no, api: name, arg: args[0], ok: !!(r && r.ok), kind: r && r.ok === false ? self.kindOf(r) : '', reason: r && r.reason ? String(r.reason) : '' };
      if (r && r.ok === false) { rec.code = r.code || ''; rec.cancelled = !!r.cancelled; P.apiFails.push(rec); }
      if (name !== 'roundState' && name !== 'opponentGone') self.log(name + '(' + shortArg(args[0]) + ') → ' + brief(r));
      else if (r && r.ok === false) self.log(name + ' → ' + brief(r));
      return r;
    });
  }

  /* ══ room UI ══ */
  /* hansen_pk_room_ui_v1065.js:154 close() */
  close() {
    if (this._state && this._state._match && !this._state._match.result && !this._state._match.end) this._state._match.end = { how: 'left', t: this.w.now };
    this.stopPoll();
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    this.cancelJoin();
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (this._state && this._state.roomId) { this.call('leaveRoom', this._state.roomId); }
    this._state = null;
    this._fromLadder = false; this._ladderCfg = null; this._pickedMode = 'C'; this._wantPrivate = false;
    this.go('home');
  }
  /* :200 cancelJoin() */
  cancelJoin() {
    this._joinSeq++;
    const rid = this._joiningRid; this._joiningRid = '';
    if (rid) this.call('leaveRoom', rid);
  }
  /* :348 lobby(err) → paints and calls refresh() (:427 → listRooms) */
  lobby(err) {
    this._fromLadder = false; this._ladderCfg = null; this._cameFromLadder = false;
    this.go('lobby', err && (err.reason || err.error || ''), err && err.kind ? { kind: err.kind } : null);
    this.refresh();
  }
  refresh() {
    this.call('listRooms').then((r) => { this.lastList = r; this.onLobbyList(r); });
  }
  /* :648 doCreate(cfg) */
  doCreate(cfg) {
    cfg = cfg || { mode: this._pickedMode, askMode: this._askMode, private: this._wantPrivate };
    const lad = !!cfg.ladder;
    this.go('creating');
    const rating = this.P.rating;
    this.call('createRoom', { tier: '', mode: cfg.mode, askMode: cfg.askMode, private: !!cfg.private,
      hostRating: lad ? (Number(cfg.rating) || rating || 1000) : 0, wordCount: cfg.wordCount }).then((r) => {
      if (!r || !r.ok) {
        if (lad) { this.ladderFail(cfg, r || { ok: false, reason: '房没开成' }); return; }
        this.lobby(r); return;
      }
      this._state = { roomId: r.roomId, words: r.words, isHost: true, ladder: lad,
        mode: (r.room && r.room.mode) || cfg.mode || 'C', askMode: (r.room && r.room.askMode) || cfg.askMode || 'cn',
        code: (r.room && r.room.code) || '' };
      this.ev('created', { roomId: r.roomId, code: this._state.code, mode: this._state.mode, ladder: lad, words: (r.words || []).length });
      this.P.hosted.push({ roomId: r.roomId, code: this._state.code, inst: this.inst.no, t: this.w.now });
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      this.waiting(r.roomId, (r.room && r.room.code) || '', cfg);
    });
  }
  /* :674 ladderFail */
  ladderFail(cfg, r) {
    this._fromLadder = false; this._state = null;
    if (cfg && typeof cfg.onFail === 'function') { try { cfg.onFail(r); } catch (e) { this.w.moduleError(e, this.inst, 'onFail'); } return; }
    this.fromRoom('rematch', '', r);
  }
  /* :685 ladderBack */
  ladderBack(how, text, r) { this.close(); this.fromRoom(how, text, r); }
  /* :694 waiting(roomId, code, cfg) */
  waiting(roomId, code, cfg) {
    cfg = cfg || null;
    const lad = !!(cfg && cfg.ladder);
    this.go('waiting', '', { roomId, ladder: lad });
    const WAIT_MS = this._waitMs;
    if (this._state && !this._state._waitStart) this._state._waitStart = this.now();
    const left = WAIT_MS - (this.now() - ((this._state && this._state._waitStart) || this.now()));
    const st = this._state;
    const wopts = lad ? { ladder: { rating: Number(cfg.rating) || 0,
      band: () => (typeof cfg.band === 'function' ? cfg.band() : 400) } } : undefined;
    const t0 = this.w.now;
    this._cancelWait = this.api.waitForOpponent(roomId, (ev) => {
      this.P.waitEvents.push({ t0, t: this.w.now, inst: this.inst.no, roomId, ev: Object.assign({}, ev, { room: undefined }),
        guestId: ev.room && ev.room.guestId, guestRating: ev.room && ev.room.guestRating, seat: ev.room && ev.room.seat });
      this.log('wait(' + roomId + ') → ' + JSON.stringify(Object.assign({}, ev, { room: undefined })).slice(0, 160));
      if (st !== this._state) return;
      if (ev.joined) {
        const rm = ev.room || {};
        if (rm.guestName) st.oppName = rm.guestName;
        if (Number(rm.guestRating) > 0) st._oppRating = Number(rm.guestRating);
        st.oppKey = rm.guestId; st.seat = rm.seat;
        this.startMatch(); return;
      }
      if (ev.switchTo && lad) { this.clearWait(st); this.switchRoom(roomId, code, cfg, ev.switchTo); return; }
      if (ev.gone) {
        this.clearWait(st);
        if (lad) { this.ladderBack('rematch', '刚才那间房没了，接着帮你找…'); return; }
        this.endWait(st); this.lobby({ reason: '房间已经不在了' }); return;
      }
      if (ev.timeout) {
        this.endWait(st);
        if (lad) { this.ladderBack('home', '暂时没有对手，等会儿再来'); return; }
        this.lobby({ reason: '等了两分钟还没人来，房间先关掉了。想玩就再开一间吧。' }); return;
      }
      if (ev.error) {
        const fr = { ok: false, reason: ev.error, kind: ev.kind || this.kindOf({ reason: ev.error }), expired: !!ev.expired };
        this.clearWait(st);
        if (lad) { this.ladderBack('rematch', '', fr); return; }
        this.endWait(st, true); this.lobby(fr);
      }
    }, Math.max(Math.min(15000, WAIT_MS), left), wopts);
  }
  /* :839 clearWait / :844 endWait */
  clearWait() { if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; } }
  endWait(st, leave) {
    this.clearWait(st);
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (leave && st && st.roomId) this.call('leaveRoom', st.roomId);
    if (this._state === st) this._state = null;
  }
  /* :856 switchRoom */
  switchRoom(myRid, myCode, cfg, target) {
    const mine = this._state;
    this.go('switching', '', { roomId: target, from: myRid });
    const join = {};
    for (const k of Object.keys(cfg)) join[k] = cfg[k];
    join.onOk = null;
    join.onFail = (r) => {
      let stillMine = false;
      try { stillMine = (this.api._currentRoomId() === myRid && this.api._currentRole() === 'host'); } catch (e) {}
      if (r && r.cancelled) { this.ladderBack('home', ''); return; }
      if (stillMine && mine) { this._state = mine; this._fromLadder = true; this.waiting(myRid, myCode, cfg); return; }
      this.ladderBack('rematch', '那间房没进去，接着帮你找…', r);
    };
    this._state = null;
    this.doJoin(target, null, join);
  }
  /* :889 doJoin */
  doJoin(rid, btn, cfg) {
    cfg = cfg || null;
    const lad = !!(cfg && cfg.ladder);
    this.cancelJoin();
    const my = this._joinSeq;
    this._joiningRid = rid;
    this.go('joining', '', { roomId: rid, ladder: lad });
    let userCancel = false;
    this._onCancelJoin = () => { userCancel = true; this.call('leaveRoom', rid); };
    const myRating = Number(cfg && cfg.rating) || Number(this.P.rating) || 0;
    const t0 = this.w.now;
    this.call('joinRoom', rid, { rating: myRating }).then((r) => {
      this.P.joins.push({ t0, t1: this.w.now, inst: this.inst.no, roomId: rid, ok: !!(r && r.ok), kind: r && !r.ok ? this.kindOf(r) : '',
        reason: r && r.reason, seat: r && r.ok && r.room ? r.room.seat : null, hostId: r && r.ok && r.room ? r.room.hostId : '',
        hostRating: r && r.ok && r.room ? r.room.hostRating : 0, cancelledByUser: userCancel, stale: my !== this._joinSeq });
      if (my !== this._joinSeq) { if (r && r.ok) this.call('leaveRoom', r.roomId); return; }
      this._joiningRid = ''; this._onCancelJoin = null;
      if (userCancel) {
        if (r && r.ok) this.call('leaveRoom', r.roomId);
        r = { ok: false, cancelled: true, kind: 'other', reason: '已经退出这间房了' };
      }
      if (!r || !r.ok) {
        r = r || { ok: false, reason: '没进去' };
        if (lad) { this.ladderFail(cfg, r); return; }
        this._fromLadder = false;
        if (r.cancelled) { this.lobby(); return; }
        this.lobby(r); return;
      }
      this._fromLadder = false;
      this.joinPlan = null;
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      const rm = r.room || {};
      this._state = { roomId: r.roomId, words: r.words, isHost: false, ladder: lad,
        mode: rm.mode || r.mode || '', askMode: rm.askMode || 'cn', oppName: rm.hostName || '',
        _oppRating: Number(rm.hostRating) || 0, oppKey: rm.hostId, seat: rm.seat };
      this.startMatch();
    });
  }
  /* :1025 startMatch */
  startMatch() {
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    const st = this._state;
    if (!st) return;
    st.startAt = this.now();
    st.myScore = 0; st.oppScore = 0; st.oppAns = -1;
    st.mode = st.mode || this._pickedMode || 'C';
    st.oppName = st.oppName || '';
    this._netMiss = 0; this._waitResult = 0; this._goneChecked = 0; this._resultFail = 0;
    this.cur = { roomId: st.roomId, side: st.isHost ? 'host' : 'guest', myKey: 'u' + this.P.uid, oppKey: st.oppKey || '',
      seat: st.seat, mode: st.mode, ladder: !!st.ladder, nWords: (st.words || []).length, startT: this.w.now, inst: this.inst.no,
      words: [], claims: [], lastWinners: [], result: null, reported: null, oppRatingUsed: 0, oppIds: [] };
    this.P.matches.push(this.cur);
    st._match = this.cur;
    this.go('battle', '', { roomId: st.roomId, side: this.cur.side });
    let started = false;
    const go = () => { if (started) return; started = true; this.askRound(0); };
    this.call('markReady', st.roomId);
    this.setTimeout(go, 1200);
    this.call('roundState', st.roomId).then((r) => {
      if (!this.stillLive(st)) return;
      if (r && r.ok && r.roundAt) { st.roundAt = r.roundAt; st.roundIdxOfRoundAt = r.round; }
      go();
    }, go);
  }
  stopPoll() { if (this._pollTimer) { this.clearTimer(this._pollTimer); this._pollTimer = null; } }
  /* :1109 askRound */
  askRound(idx) {
    this.stopPoll();
    const st = this._state;
    if (!st) return;
    const words = st.words || [];
    if (idx >= words.length) { this.finish(); return; }
    const M = this.api.modeOf(st.mode);
    const span = (M.perWordSecs || 15) * 1000;
    const useShared = (idx === 0) || !M.waitAll;
    const shared = (useShared && st.roundAt && idx === st.roundIdxOfRoundAt) ? st.roundAt : 0;
    const fresh = shared && (this.now() - shared) < span;
    const base = fresh ? shared : this.now();
    const rt = this._rt = { idx, answered: false, t0: this.now(), deadline: base + span };
    const m = st._match;
    const wr = { idx, t: this.w.now, localDeadlineIn: Math.round(rt.deadline - this.now()), correct: false, submitted: '', gain: 0 };
    if (m) m.words[idx] = wr;
    /* the kid: types the word right after delay ms (or never) */
    const k = this.P.kid || {}, kr = this.P.kidRng;
    const correct = kr.chance(k.pCorrect == null ? 0.75 : k.pCorrect);
    let delay = kr.range(k.minMs || 1500, k.maxMs || 9000);
    if (k.slowP && kr.chance(k.slowP)) delay = kr.range(span * 0.7, span * 1.3);
    if (correct) this.setTimeout(() => { if (this._rt === rt && !rt.answered) { wr.typedAt = this.w.now; this.submitRound(idx, true); } }, delay);
    this._pollTimer = this.setInterval(() => {
      if (!this._rt || this._rt.idx !== idx) return;
      const left = Math.max(0, Math.ceil((this._rt.deadline - this.now()) / 1000));
      if (left <= 0 && !this._rt.answered) { this.submitRound(idx, false); return; }
      this.pollOpponent(idx);
    }, 1000);
  }
  /* :1375 checkOpponentAlive */
  checkOpponentAlive(idx) {
    const st = this._state;
    if (!st || !st.roomId) return;
    if (this.now() - this._goneChecked < 4000) return;
    this._goneChecked = this.now();
    this.call('opponentGone', st.roomId).then((g) => {
      if (!this.stillLive(st)) return;
      if (!g || !g.ok || !this._rt || this._rt.idx !== idx) return;
      if (g.ended && g.endedBy === 'abandon' && g.abandonWin && g.abandonWin !== (st.isHost ? 'host' : 'guest')) {
        this.stopPoll();
        this.showResult({ result: 'lose', byAbandon: true, mine: st.myScore, theirs: st.oppScore }, 'opp-claimed-abandon');
        return;
      }
      if (g.gone && !st._oppSeen) {
        this.stopPoll();
        const lad0 = !!st.ladder, rid0 = st.roomId;
        if (st._match) st._match.end = { how: 'opp-never-came', kicked: !!g.kicked, t: this.w.now };
        this._state = null;
        this.call('leaveRoom', rid0);
        if (lad0) { this.ladderBack('rematch', '对手刚才没进来，接着帮你找…'); return; }
        this.lobby({ reason: '对手刚才没进来，这间房先关掉了。再开一间吧。' });
        return;
      }
      if (g.gone) {
        this.stopPoll();
        if (st._match) st._match.goneSeen = { kicked: !!g.kicked, left: !!g.left, idle: g.idleSecs, t: this.w.now };
        this.call('claimAbandonWin', st.roomId).then(() => {
          if (!this.stillLive(st)) return;
          this.showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone' + (g.kicked ? '-kicked' : ''));
        }, () => { this.showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone-catch'); });
      }
    }, () => {});
  }
  /* :1424 pollOpponent */
  pollOpponent(idx) {
    const st = this._state;
    if (!st) return;
    this.checkOpponentAlive(idx);
    this.call('roundState', st.roomId).then((r) => {
      if (!this.stillLive(st)) return;
      const m = st._match;
      if (r && r.ok && typeof r.oppId === 'string') {
        if (!st._oppId && r.oppId) st._oppId = r.oppId;
        if (Number(r.oppRating) > 0) st._oppRating = Number(r.oppRating);
        if (r.oppName && r.oppName !== st.oppName) st.oppName = String(r.oppName);
        if ((r.mySide === 'host' ? r.guestReady : r.hostReady) || (r.winners || []).some((x) => x && x !== r.mySide)) st._oppSeen = true;
        if (m && r.oppId && m.oppIds.indexOf(r.oppId) < 0) m.oppIds.push(r.oppId);
        if (st._oppId && r.oppId && r.oppId !== st._oppId && !st._oppSwapped) { st._oppSwapped = true; if (m) m.swapped = true; }
      }
      if (!r || !r.ok) { this._netMiss = (this._netMiss || 0) + 1; return; }
      const rd = Number((r.room && r.room.round) != null ? r.room.round : r.round);
      if (isFinite(rd)) { if (rd < (st.maxRound || 0)) return; st.maxRound = rd; }
      if (this._netMiss) this._netMiss = 0;
      const mm = this.api.modeOf(st.mode);
      let ws = (r.room && r.room.winners) || r.winners || [];
      if (!Array.isArray(ws)) ws = [];
      const wcap = Math.max(1, Math.min(30, (st.words && st.words.length) || 30));
      if (ws.length > wcap) ws = ws.slice(0, wcap);
      const meIsHost = !!(r.mySide ? r.mySide === 'host' : st.isHost);
      let opp = 0;
      for (const who of ws) { if (who && (meIsHost ? who === 'guest' : who === 'host')) opp += (mm.firstScore || 100); }
      if (mm.waitAll && isFinite(Number(r.oppPts)) && Number(r.oppPts) > opp) opp = Number(r.oppPts);
      if (opp < (st.oppScore || 0)) opp = st.oppScore || 0;
      st.oppScore = opp;
      if (m) { m.lastWinners = (r.winners || []).slice(); m.lastRound = r.round; }
      if (r.oppAns != null && isFinite(Number(r.oppAns))) st.oppAns = Math.max(st.oppAns == null ? -1 : st.oppAns, Number(r.oppAns));
      if (mm && mm.waitAll) this.oppPtsShow(st, r);
      if (!this._rt || this._rt.idx !== idx) return;
      if (r.roundAt) { st.roundAt = r.roundAt; st.roundIdxOfRoundAt = r.round; }
      const w = (r.winners || [])[idx];
      if (!w) return;
      const mySide = r.mySide || (st.isHost ? 'host' : 'guest');
      const oppGot = (w !== mySide);
      if (oppGot && !mm.waitAll && !this._rt.answered) { this.submitRound(idx, false, true); }
    }, () => {});
  }
  /* :1660 stillLive */
  stillLive(st) {
    if (!st || !this._state) return false;
    if (st !== this._state) { if (!st.roomId || st.roomId !== this._state.roomId) return false; }
    return true;
  }
  /* :1673 submitRound */
  submitRound(idx, correct, forced) {
    if (!this._rt || this._rt.answered) return;
    this._rt.answered = true;
    this.stopPoll();
    const st = this._state;
    if (!st) return;
    const m = st._match, wr = m && m.words[idx];
    if (wr) { wr.submitted = correct ? 'correct' : (forced ? 'forced' : 'timeout'); wr.correct = !!correct; wr.subT = this.w.now; }
    const after = (gain, first) => {
      st.myScore += gain;
      if (wr) { wr.gain = gain; wr.first = !!first; }
      this.setTimeout(() => { if (!this.stillLive(st)) return; this.nextWord(st, idx); }, 1400);
    };
    if (!correct) {
      this.call('skipRound', st.roomId, idx);
      after(0, false); return;
    }
    this.call('claimRound', st.roomId, idx).then((r) => {
      if (m) m.claims.push({ idx, t: this.w.now, ok: !!(r && r.ok), won: !!(r && r.won), score: r && r.score, winner: r && r.winner, kind: r && !r.ok ? this.kindOf(r) : '' });
      if (!this.stillLive(st)) return;
      if (!r || !r.ok) { after(0, false); return; }
      after(Number(r.score) || 0, !!r.first);
    }, () => { after(0, false); });
  }
  /* :1777 nextWord */
  nextWord(st, idx) {
    const M = this.api.modeOf(st && st.mode);
    const last = idx + 1 >= (st.words || []).length;
    if (!M.waitAll || last || !st.roomId || (st.oppAns != null && st.oppAns >= idx)) { this.askRound(idx + 1); return; }
    const rt = this._rt;
    const cap = Math.max((rt && rt.deadline) || 0, this.now()) + 3000;
    const go = () => { if (this.stillLive(st) && this._rt === rt) this.askRound(idx + 1); };
    const poll = () => {
      if (!this.stillLive(st) || this._rt !== rt) return;
      if (this.now() >= cap) { go(); return; }
      this.call('roundState', st.roomId).then((r) => {
        if (!this.stillLive(st) || this._rt !== rt) return;
        if (r && r.ok) {
          this.oppPtsShow(st, r);
          if (st._match) { st._match.lastWinners = (r.winners || []).slice(); }
          if (Number(r.oppAns) >= idx) { st.oppAns = Number(r.oppAns); go(); return; }
        }
        this.setTimeout(poll, 900);
      }, () => { this.setTimeout(poll, 900); });
    };
    poll();
  }
  oppPtsShow(st, r) {
    const n = Number(r && r.oppPts);
    if (!isFinite(n) || n <= (st.oppScore || 0)) return;
    st.oppScore = n;
  }
  /* :1819 finish */
  finish() {
    const st = this._state;
    if (!st) return;
    this.stopPoll();
    const score = Number(st.myScore) || 0;
    if (st._match) st._match.reported = score;
    this.go('result-wait', '', { roomId: st.roomId, score });
    this._waitResult = 0; this._resultFail = 0;
    this.pollResult(st, score);
  }
  /* :1847 pollResult */
  pollResult(st, score) {
    if (!this.stillLive(st)) return;
    this.call('reportResult', st.roomId, score).then((r) => {
      if (!this.stillLive(st)) return;
      if (!r || !r.ok) {
        this._resultFail = (this._resultFail || 0) + 1;
        const k = this.kindOf(r);
        if (this._resultFail < 5 && k !== 'expired' && k !== 'config') { this.setTimeout(() => this.pollResult(st, score), 2000); return; }
        this.resultFailed(st, r || { ok: false, reason: '交卷没成功' });
        return;
      }
      this._resultFail = 0;
      if (r.waiting) {
        this._waitResult = (this._waitResult || 0) + 1;
        if (this._waitResult > 22) { this.checkStillThere(st, score); return; }
        this.setTimeout(() => this.pollResult(st, score), 2000);
        return;
      }
      this._waitResult = 0;
      const raw = r;
      if (r.byAbandon) r = { ok: true, result: r.result, byAbandon: true, mine: st.myScore, theirs: st.oppScore };
      this.showResult(r, 'report', raw);
    }, () => {
      this._waitResult = (this._waitResult || 0) + 1;
      if (this._waitResult > 22) { this.checkStillThere(st, score); return; }
      this.setTimeout(() => this.pollResult(st, score), 2500);
    });
  }
  /* :1893 checkStillThere */
  checkStillThere(st, score) {
    const give = (why) => {
      this._waitResult = 0;
      const fin = () => {
        if (!this.stillLive(st)) return;
        this.showResult({ ok: true, result: 'win', byAbandon: true, mine: score, theirs: 0 }, 'result-wait-' + why);
      };
      this.call('claimAbandonWin', st.roomId).then(fin, fin);
    };
    this.call('opponentGone', st.roomId).then((g) => {
      if (!this.stillLive(st)) return;
      const alive = g && g.ok && !g.gone && (g.idleSecs || 0) < 30;
      if (alive && this._waitResult < 150) { this.setTimeout(() => this.pollResult(st, score), 2000); return; }
      give(g && g.ok ? (g.gone ? 'gone' : 'idle' + g.idleSecs) : 'checkfail:' + this.kindOf(g));
    }, () => give('reject'));
  }
  /* :1912 resultFailed */
  resultFailed(st, r) {
    const rid = st && st.roomId;
    if (st && st._match) st._match.end = { how: 'result-failed', kind: this.kindOf(r), t: this.w.now };
    this._state = null;
    if (rid) this.call('leaveRoom', rid);
    this.go('result-failed', r && r.reason, { kind: this.kindOf(r) });
  }
  /* :2030 showResult */
  showResult(r, why, raw) {
    const wasLadder = this._state ? !!this._state.ladder : this._cameFromLadder;
    const st = this._state;
    const m = (st && st._match) || this.cur;
    if (m && !m.result) {
      m.result = { result: r.result, byAbandon: !!r.byAbandon, mine: r.mine, theirs: r.theirs, why: why || '', t: this.w.now,
        rawMine: raw && raw.mine, rawTheirs: raw && raw.theirs, oppLeft: !!(raw && raw.oppLeft) };
      m.oppRatingUsed = (st && st._oppRating) || 0;
      m.oppNameUsed = (st && st.oppName) || '';
    }
    const rid = st && st.roomId;
    this._state = null;
    this.stopPoll();
    if (rid) this.call('leaveRoom', rid);
    this._cameFromLadder = wasLadder;
    this.go('result', r.result + (r.byAbandon ? ' (byAbandon)' : '') + ' ' + r.mine + ':' + r.theirs, { why });
    /* 「再来一局」 */
    const ag = this.P.again || {};
    if (wasLadder && this.presses < (ag.max || 0) && this.P.kidRng.chance(ag.p || 0)) {
      this.pressPending = true;
      this.setTimeout(() => {
        if (this.screen !== 'result') { this.pressPending = false; return; }
        this._cameFromLadder = false;
        this.close(); this.ladderOpen();
        this.setTimeout(() => { if (this.screen === 'ladder-home') this.pressLadder(); else this.pressPending = false; }, 260);
      }, 2500 + Math.floor(this.P.kidRng.float() * 4000));
    }
  }
  /* :2196 _createForLadder / :2224 _joinForLadder */
  createForLadder(rating, opts) {
    opts = opts || {};
    this._cameFromLadder = true; this._pickedMode = 'A'; this._wantPrivate = false; this._fromLadder = true;
    this._ladderCfg = { ladder: true, mode: 'A', askMode: 'cn', private: false, rating: Number(rating) || 1000,
      t0: Number(opts.t0) || this.now(), band: opts.band, onOk: opts.onOk, onFail: opts.onFail };
    this.doCreate(this._ladderCfg);
  }
  joinForLadder(roomId, opts) {
    opts = opts || {};
    this._cameFromLadder = true; this._pickedMode = 'A'; this._fromLadder = true;
    this._ladderCfg = { ladder: true, rating: Number(opts.rating) || 0, onOk: opts.onOk, onFail: opts.onFail };
    this.doJoin(roomId, null, this._ladderCfg);
  }
  /* :2252 bindUnloadCleanup — pagehide → leaveRoom(_state.roomId) */
  onPageHide() {
    const rid = this._state && this._state.roomId;
    if (rid) { try { this.api.leaveRoom(rid); } catch (e) {} }
  }

  /* ══ ladder UI (hansen_ladder_ui_v1108.js) ══ */
  bandOf(waited) { const s = Math.max(0, Number(waited) || 0); return Math.max(100, Math.min(400, 100 + Math.floor(s / 5) * 50)); }
  stopRun() {
    const run = this._run; this._run = null;
    if (!run) return;
    run.stop = true;
    if (run.timer) { this.clearTimer(run.timer); run.timer = null; }
  }
  later(run, ms) {
    if (run.stop) return;
    if (run.timer) this.clearTimer(run.timer);
    run.timer = this.setTimeout(() => { run.timer = null; this.ladTick(run); }, ms);
  }
  /* :228 open(opts) — ladder home; closePeers() closes the room UI */
  ladderOpen(opts) {
    if (this._cancel) { try { this._cancel(); } catch (e) {} this._cancel = null; }
    this.stopRun();
    this.closeRoomUiQuietly();
    this.go('ladder-home', opts && opts.note);
  }
  closeRoomUiQuietly() {
    /* closePeers → HansenPkRoomUI.close() (same body as close(), without our screen change) */
    if (this._state && this._state._match && !this._state._match.result && !this._state._match.end) this._state._match.end = { how: 'left', t: this.w.now };
    this.stopPoll();
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    this.cancelJoin();
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (this._state && this._state.roomId) this.call('leaveRoom', this._state.roomId);
    this._state = null;
    this._fromLadder = false; this._ladderCfg = null; this._pickedMode = 'C'; this._wantPrivate = false;
  }
  pressLadder() { this.pressPending = false; this.presses++; this.ev('ladder-press', { n: this.presses }); this.startMatching(); }
  /* :724 startMatching */
  startMatching() {
    if (this._cancel) { try { this._cancel(); } catch (e) {} this._cancel = null; }
    this.stopRun();
    this._netFail = 0;
    const run = this._run = { stop: false, t0: this.now(), netFail: 0, sessT0: 0, busy: false, sm: { rating: this.P.rating },
      timer: null, tried: {}, createFail: 0 };
    this._cancel = () => this.stopRun();
    this.go('ladder-matching');
    this.ladTick(run);
  }
  /* :764 tick */
  ladTick(run) {
    if (run.stop || run.busy) return;
    this.call('listRooms').then((lr) => {
      if (run.stop || run.busy) return;
      if (lr && lr.ok === false) { this.ladOnFail(run, lr); return; }
      if (!lr) { this.ladOnFail(run, { ok: false, reason: '没有拿到房间列表' }); return; }
      run.netFail = 0; this._netFail = 0; run.sessT0 = 0;
      const rooms = (lr && lr.rooms) || [];
      const sm = run.sm;
      const waited = Math.round((this.now() - run.t0) / 1000);
      const band = this.bandOf(waited);
      const fit = rooms.filter((r) => {
        if (r.mode !== 'A') return false;
        if (run.tried[r._id]) return false;
        let raw = Number(r.hostRating); if (!isFinite(raw)) raw = 1000;
        const rr = Math.max(0, Math.min(4000, raw));
        const gap = Math.abs(rr - sm.rating);
        if (gap > band * 2) return false;
        return gap <= band;
      });
      fit.sort((a, b) => {
        const ca = Number(a.createdAt) || 0, cb = Number(b.createdAt) || 0;
        if (ca !== cb) return ca - cb;
        return String(a._id) < String(b._id) ? -1 : 1;
      });
      if (fit.length) { this.tryRooms(run, fit, 0); return; }
      if (waited >= 20) { this.selfHost(run); return; }
      this.later(run, 2500);
    }, (e) => { if (run.stop) return; this.ladOnFail(run, { ok: false, reason: String((e && e.message) || e || '出错了') }); });
  }
  /* :812 tryRooms */
  tryRooms(run, fit, i) {
    if (run.stop) return;
    if (i >= fit.length) { run.busy = false; this.later(run, 1500); return; }
    const x = fit[i];
    run.busy = true;
    run.tried[x._id] = 1;
    let done = false;
    this.joinForLadder(x._id, {
      rating: run.sm.rating,
      onOk: () => { done = true; this.stopRun(); },
      onFail: (r) => {
        if (done) return;
        done = true;
        run.busy = false;
        if (run.stop) return;
        if (r && r.cancelled) { this.stopRun(); this.ladderOpen(); return; }
        if (this.roomProblem(r)) { this.go('ladder-matching', this.failNote(r)); this.tryRooms(run, fit, i + 1); return; }
        this.go('ladder-matching');
        this.ladOnFail(run, r);
      }
    });
  }
  /* :845 selfHost */
  selfHost(run) {
    run.busy = true;
    let done = false;
    this.createForLadder(run.sm.rating, {
      t0: run.t0,
      band: () => this.bandOf(Math.round((this.now() - run.t0) / 1000)),
      onOk: () => { done = true; this.stopRun(); },
      onFail: (r) => {
        if (done) return;
        done = true;
        run.busy = false;
        if (run.stop) return;
        this.go('ladder-matching');
        const k = this.kindOf(r);
        if (k === 'expired' || k === 'config' || k === 'session') { this.ladOnFail(run, r); return; }
        run.createFail = (run.createFail || 0) + 1;
        if (run.createFail >= 3) { this.showProblem(k === 'network' || k === 'slow' ? 'network' : 'other', r); return; }
        this.later(run, 2500);
      }
    });
  }
  /* :883 onFail */
  ladOnFail(run, r) {
    if (run.stop) return;
    const k = this.kindOf(r);
    if (k === 'expired') { this.stopRun(); this.go('ladder-problem', 'need-login', { kind: k, raw: r && r.reason }); return; }
    if (k === 'config') { this.showProblem('config', r); return; }
    if (k === 'session') {
      if (!run.sessT0) run.sessT0 = this.now();
      if (this.now() - run.sessT0 < 20000) { this.later(run, 2000); return; }
      this.showProblem('session', r); return;
    }
    run.netFail++; this._netFail = run.netFail;
    if (run.netFail >= 4) { if (k === 'other') this.showProblem('other', r); else this.showProblem('network', r); return; }
    this.later(run, 3000);
  }
  showProblem(kind, r) { this.stopRun(); this.go('ladder-problem', kind, { kind, raw: r && r.reason }); }
  roomProblem(r) { const k = this.kindOf(r); return k === 'taken' || k === 'gone' || k === 'other' || k === 'self'; }
  failNote(r) {
    const k = this.kindOf(r);
    return k === 'taken' ? '那间房刚被别人抢走了，接着帮你找…' : k === 'gone' ? '那间房刚关了，接着帮你找…'
      : k === 'self' ? '那是你自己账号开的房，接着找别人的…' : '那间房没进去，接着帮你找…';
  }
  /* :1015 fromRoom */
  fromRoom(how, text, r) {
    if (how === 'home' || (r && r.cancelled)) { this.stopRun(); this.ladderOpen({ note: text || '' }); return; }
    this.ladderOpen();
    this.startMatching();
    const run = this._run;
    if (!run) return;
    if (r && r.ok === false && !this.roomProblem(r)) { this.ladOnFail(run, r); return; }
  }

  /* ══ the kid's intents (scheduled by the scenario) ══ */
  intent(it) {
    this.ev('intent', { act: it.act });
    this.log('intent ' + JSON.stringify(it));
    switch (it.act) {
      case 'create': {
        if (!this.idle()) return this.retryIntent(it);
        this._pickedMode = it.mode || 'C'; this._askMode = it.askMode || 'cn'; this._wantPrivate = !!it.private;
        this.lobby();
        this.setTimeout(() => {
          if (this.screen !== 'lobby') return;
          this.doCreate({ mode: this._pickedMode, askMode: this._askMode, private: this._wantPrivate, wordCount: it.wordCount });
        }, 400);
        return;
      }
      case 'join': {
        if (!this.idle()) return this.retryIntent(it);
        this.joinPlan = { it, attempt: 0 };
        if (it.via === 'code') { this.lobby(); this.setTimeout(() => this.codeJoin(), 600); }
        else this.lobby();
        return;
      }
      case 'ladder': {
        if (!this.idle()) return this.retryIntent(it);
        this.close(); this.ladderOpen();
        this.setTimeout(() => { if (this.screen === 'ladder-home') this.pressLadder(); }, 300);
        return;
      }
      case 'browse': if (this.idle()) this.lobby(); return;
      case 'cancelJoin': if (this.screen === 'joining' && this._onCancelJoin) this._onCancelJoin(); return;
      case 'closeWaiting':
        if (this.screen === 'waiting') {
          if (this._state && this._state.ladder) this.ladderBack('home', ''); else this.close();
        }
        return;
      case 'leave':
        if (this.screen === 'ladder-matching') { this.stopRun(); this.ladderOpen(); return; }
        if (!this.idle()) this.close();
        return;
    }
  }
  retryIntent(it) {
    it._retry = (it._retry || 0) + 1;
    if (it._retry > 8) return;
    this.setTimeout(() => this.intent(it), 3000);
  }
  /* lobby list arrived: if the kid wants to join, tap the target's room (or refresh / give up) */
  onLobbyList(r) {
    const jp = this.joinPlan;
    if (!jp || jp.it.via === 'code' || this.screen !== 'lobby') return;
    const it = jp.it;
    const want = it.target ? this.w.playerByLabel(it.target) : null;
    const rooms = (r && r.ok && r.rooms) || [];
    let cand = rooms.filter((x) => !want || x.hostName === want.name);
    let room = null;
    if (cand.length) room = it.pick === 'random' ? cand[Math.floor(this.P.kidRng.float() * cand.length)] : cand[0];
    jp.attempt++;
    if (!room) {
      if (jp.attempt > (it.tries || 4)) { this.joinPlan = null; this.ev('join-gave-up', { why: 'not-listed' }); return; }
      this.setTimeout(() => { if (this.screen === 'lobby' && this.joinPlan === jp) this.refresh(); }, 2000);
      return;
    }
    if (jp.attempt > (it.tries || 4) + 1) { this.joinPlan = null; return; }
    this.setTimeout(() => {
      if (this.screen !== 'lobby' || this.joinPlan !== jp) return;
      this.doJoin(room.id, true, null);
    }, 300 + Math.floor(this.P.kidRng.float() * 700));
  }
  /* :503 joinByCode → findByCode with find(2) retries */
  codeJoin() {
    const jp = this.joinPlan;
    if (!jp || this.screen !== 'lobby') return;
    const it = jp.it;
    const host = this.w.playerByLabel(it.target);
    const h = host && host.hosted[host.hosted.length - 1];
    jp.attempt++;
    if (!h || !h.code) {
      if (jp.attempt > (it.tries || 4)) { this.joinPlan = null; this.ev('join-gave-up', { why: 'no-code' }); return; }
      this.setTimeout(() => this.codeJoin(), 2500); return;
    }
    const find = (left) => this.call('findByCode', h.code).then((r) => {
      if (r && !r.ok && r.kind === 'gone' && left > 0) return new Promise((z) => this.setTimeout(z, 1200)).then(() => find(left - 1));
      return r;
    });
    find(2).then((r) => {
      if (this.screen !== 'lobby' || this.joinPlan !== jp) return;
      if (!r.ok) {
        this.ev('code-fail', { kind: this.kindOf(r), reason: r.reason });
        if (jp.attempt > (it.tries || 3)) { this.joinPlan = null; return; }
        this.setTimeout(() => this.codeJoin(), 3000);
        return;
      }
      this.joinPlan = null;
      this.doJoin(r.roomId, true, null);
    });
  }
  /* after a terminal screen: retry joining (rooms) or press 开始排位 again (ladder) */
  onIdleKid() {
    const jp = this.joinPlan;
    if (jp && this.screen === 'lobby' && jp.it.via === 'code') return;   /* codeJoin drives itself */
    if (this.screen === 'ladder-home' && this.reason && this.P.ladderer) {
      const ag = this.P.again || {};
      if (this.presses < (ag.max || 0) && this.P.kidRng.chance(ag.p2 == null ? 0.5 : ag.p2)) {
        this.pressPending = true;
        this.setTimeout(() => { if (this.screen === 'ladder-home') this.pressLadder(); else this.pressPending = false; }, 1500 + Math.floor(this.P.kidRng.float() * 3000));
      }
    }
  }
}

function shortArg(a) {
  if (a == null) return '';
  if (typeof a === 'object') return JSON.stringify(a).slice(0, 60);
  return String(a).slice(0, 40);
}
export function brief(r) {
  if (!r || typeof r !== 'object') return String(r);
  if (r.ok === false) return 'FAIL kind=' + (r.kind || '?') + ' 「' + String(r.reason || '').slice(0, 110) + '」';
  const o = {};
  for (const k of ['roomId', 'won', 'first', 'score', 'winner', 'round', 'waiting', 'result', 'mine', 'theirs', 'byAbandon', 'gone', 'left', 'kicked', 'idleSecs', 'oppFinished', 'ended', 'skipped', 'sameAccount']) if (r[k] !== undefined) o[k] = r[k];
  if (r.rooms) o.rooms = r.rooms.length;
  if (r.room && r.room.seat !== undefined) o.seat = r.room.seat;
  if (r.winners) o.winners = r.winners.join(',');
  return 'ok ' + JSON.stringify(o).slice(0, 160);
}
