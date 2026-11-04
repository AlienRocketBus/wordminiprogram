/* ui_r1.mjs — DOM-free port of the control flow of hansen_pk_room_ui_v1065.js (房间 UI) and hansen_ladder_ui_v1108.js
 * (天梯 UI) as of commit 3b6bbd7 (v1164 after review round 1). Same data-layer calls, same order, same timers and the
 * same branches as the real UI (line numbers of the real files next to each port); instead of painting HTML it records
 * which "screen" the phone shows and why. A simulated kid taps buttons and types answers.
 *
 * Differences to ui.mjs (the 47a97f9 port): joinRoom gets the room code; the battle starts when the opponent's
 * 「就绪」 is seen (≤2 s) and every word's deadline is local; the round result can be "pending" and is settled later;
 * kicked / void / roomGone endings; lobby auto-refresh; page-visibility handling (30 s close of a waiting room,
 * no ladder search in the background, 3-s grace in a word); the ladder's cloud probe after 4 failures.
 *
 * If a finding involves only this file's logic it is a UI-port finding: re-check it in the real UI file.
 */

const TERMINAL = { home: 1, lobby: 1, 'ladder-home': 1, result: 1, 'result-failed': 1, 'ladder-problem': 1 };

export class UiR1 {
  constructor(inst) {
    this.inst = inst; this.w = inst.world; this.P = inst.player; this.api = inst.api;
    /* room UI module state (hansen_pk_room_ui_v1065.js top-level vars) */
    this._state = null; this._rt = null; this._pollTimer = null; this._cancelWait = null;
    this._joinSeq = 0; this._joiningRid = ''; this._fromLadder = false; this._cameFromLadder = false;
    this._ladderCfg = null; this._pickedMode = 'C'; this._askMode = 'cn'; this._wantPrivate = false;
    this._waitMs = 120000; this._netMiss = 0; this._waitResult = 0; this._resultFail = 0; this._goneChecked = 0;
    this._onCancelJoin = null; this._lobbySeq = 0; this._createBusy = false; this._hidSeq = 0;
    /* ladder UI state */
    this._run = null; this._cancel = null; this._netFail = 0; this._probeSeq = 0;
    /* kid / bookkeeping */
    this.screen = 'home'; this.screenAt = this.w.now; this.reason = '';
    this.joinPlan = null; this.cur = null; this.presses = 0;
    /* reviewed UI fixes present in the repo's UI (see loadUiFlags in world.mjs); all false = the 3b6bbd7 UI */
    this.fix = (inst.world && inst.world.uiFlags) || {};
  }
  /* ── plumbing ── */
  now() { return this.inst.localNow(); }                       /* the UI uses the phone's own Date.now() */
  hidden() { return !!this.inst.hidden; }                      /* document.visibilityState === 'hidden' */
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
  endMatch(how, extra) {
    const m = this._state && this._state._match;
    if (m && !m.result && !m.end) m.end = Object.assign({ how, t: this.w.now }, extra || {});
  }

  /* ══ room UI ══ */
  /* :154 close() */
  close() {
    this.endMatch('left');
    this.stopPoll();
    this._lobbySeq++;
    this.cancelCreating();   /* 56b8146 :160 */
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    this.cancelJoin();
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (this._state && this._state.roomId) { this.call('leaveRoom', this._state.roomId); }
    this._state = null;
    this._fromLadder = false; this._ladderCfg = null; this._pickedMode = 'C'; this._wantPrivate = false;
    this.go('home');
  }
  /* :204 cancelJoin() */
  cancelJoin() {
    this._joinSeq++;
    const rid = this._joiningRid; this._joiningRid = '';
    if (rid) this.call('leaveRoom', rid);
  }
  /* :353 lobby(err) → paints, refresh() (:439 → listRooms), auto-refresh every 8 s while the list is on screen */
  lobby(err) {
    this._fromLadder = false; this._ladderCfg = null; this._cameFromLadder = false;
    this.cancelCreating();
    const seq = ++this._lobbySeq;
    this._rowOrder = [];
    this.go('lobby', err && (err.reason || err.error || ''), err && err.kind ? { kind: err.kind } : null);
    this.refresh();
    const autoRef = () => {
      if (seq !== this._lobbySeq || this.screen !== 'lobby') return;     /* !q('prList'): another screen was painted */
      if (!this.hidden()) this.refresh();
      this.setTimeout(autoRef, 8000);
    };
    this.setTimeout(autoRef, 8000);
  }
  refresh() {
    const seq = this._lobbySeq;
    this.call('listRooms').then((r) => {
      if (seq !== this._lobbySeq) return;
      if (r && r.ok) {
        /* FX-9: rooms already on the list keep their place, new ones go last */
        const rooms = (r.rooms || []).filter((x) => !x.mine), byId = {};
        rooms.forEach((x) => { byId[x.id] = x; });
        const order = (this._rowOrder || []).filter((id) => byId[id]);
        rooms.forEach((x) => { if (order.indexOf(x.id) < 0) order.push(x.id); });
        this._rowOrder = order;
        r = Object.assign({}, r, { rooms: order.map((id) => byId[id]) });
      }
      this.lastList = r; if (this.screen === 'lobby') this.onLobbyList(r);
    });
  }
  /* 56b8146 cancelCreating(): leaving the 「正在开房」 screen voids that create (the data layer removes the room) */
  cancelCreating() {
    this._createCap = null;
    if (!this._createBusy) return;
    this._createSeq = (this._createSeq || 0) + 1; this._createBusy = false;
    try { if (this.api.cancelCreate) this.api.cancelCreate(); } catch (e) {}
  }
  /* :661 doCreate(cfg) */
  doCreate(cfg) {
    cfg = cfg || { mode: this._pickedMode, askMode: this._askMode, private: this._wantPrivate };
    const lad = !!cfg.ladder;
    if (this._createBusy) return;
    this._createBusy = true;
    const seq = this._createSeq = (this._createSeq || 0) + 1;
    this.go('creating');
    const cap = this._createCap = {};
    this.setTimeout(() => {
      if (this._createCap !== cap || seq !== this._createSeq) return;
      this.cancelCreating();
      const slow = { ok: false, kind: 'slow', reason: '网络太慢，房没开成，再点一次开房 ⟨开房 25 秒没有回应⟩' };
      if (lad) { this.ladderFail(cfg, slow); return; }
      this.lobby(slow);
    }, 25000);
    const rating = Number(this.P.rating) || 0;             /* HansenPkRecord.summary().rating */
    this.call('createRoom', { tier: '', mode: cfg.mode, askMode: cfg.askMode, private: !!cfg.private,
      hostRating: lad ? (Number(cfg.rating) || rating || 1000) : 0, elo: Number(cfg.rating) || rating || 0,
      /* harness extension: the real UI never passes wordCount (always 10); shorter rooms keep runs fast */
      wordCount: cfg.wordCount }).then((r) => {
      if (seq !== this._createSeq) { if (r && r.ok) this.call('leaveRoom', r.roomId); return; }
      this._createCap = null;
      this._createBusy = false;
      if (r && r.cancelled) return;
      if (!r || !r.ok) {
        if (lad) { this.ladderFail(cfg, r || { ok: false, reason: '房没开成' }); return; }
        this.lobby(r); return;
      }
      this._state = { roomId: r.roomId, words: r.words, isHost: true, ladder: lad,
        mode: (r.room && r.room.mode) || cfg.mode || 'C', askMode: (r.room && r.room.askMode) || cfg.askMode || 'cn',
        code: (r.room && r.room.code) || '', isPrivate: !!cfg.private };
      this.ev('created', { roomId: r.roomId, code: this._state.code, mode: this._state.mode, ladder: lad, words: (r.words || []).length });
      this.P.hosted.push({ roomId: r.roomId, code: this._state.code, inst: this.inst.no, t: this.w.now });
      if (lad && typeof cfg.onOk === 'function') { try { cfg.onOk(); } catch (e) {} }
      this.waiting(r.roomId, (r.room && r.room.code) || '', cfg);
    }, () => { if (seq === this._createSeq) { this._createBusy = false; this._createCap = null; } });
  }
  /* :693 ladderFail */
  ladderFail(cfg, r) {
    this._fromLadder = false; this._state = null;
    if (cfg && typeof cfg.onFail === 'function') { try { cfg.onFail(r); } catch (e) { this.w.moduleError(e, this.inst, 'onFail'); } return; }
    this.fromRoom('rematch', '', r);
  }
  /* :704 ladderBack */
  ladderBack(how, text, r) { this.close(); this.fromRoom(how, text, r); }
  /* :712 waiting(roomId, code, cfg) */
  waiting(roomId, code, cfg) {
    cfg = cfg || null;
    const lad = !!(cfg && cfg.ladder);
    this.go('waiting', '', { roomId, ladder: lad });
    const WAIT_MS = this._waitMs;
    if (this._state && !this._state._waitStart) this._state._waitStart = this.now();
    const left = WAIT_MS - (this.now() - ((this._state && this._state._waitStart) || this.now()));
    const st = this._state;
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }   /* :825 UI-6 */
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
  /* :871 clearWait / :876 endWait */
  clearWait() { if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; } }
  endWait(st, leave) {
    this.clearWait(st);
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (leave && st && st.roomId) this.call('leaveRoom', st.roomId);
    if (this._state === st) this._state = null;
  }
  /* :886 switchRoom */
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
  /* :914 doJoin(rid, btn, cfg, code) */
  doJoin(rid, btn, cfg, code) {
    cfg = cfg || null;
    const lad = !!(cfg && cfg.ladder);
    this.cancelJoin();
    const my = this._joinSeq;
    this._joiningRid = rid;
    this.go('joining', '', { roomId: rid, ladder: lad });
    let userCancel = false;
    const joinRec = { t0: this.w.now, inst: this.inst.no, roomId: rid, cancelledByUser: false };
    /* :937 取消：马上离开这一屏（UI-3），收尾交给数据层 */
    this._onCancelJoin = () => {
      if (userCancel) return;
      userCancel = true; joinRec.cancelledByUser = true;
      this._joinSeq++; this._joiningRid = ''; this._onCancelJoin = null;
      this.call('leaveRoom', rid);
      if (lad) { this.ladderFail(cfg, { ok: false, cancelled: true, kind: 'other', reason: '已经退出这间房了' }); return; }
      this._fromLadder = false;
      this.lobby();
    };
    const myRating = Number(cfg && cfg.rating) || Number(this.P.rating) || 0;
    this.call('joinRoom', rid, { rating: myRating, code: code || '', onWait: () => {} }).then((r) => {
      this.P.joins.push(Object.assign(joinRec, { t1: this.w.now, ok: !!(r && r.ok), kind: r && !r.ok ? this.kindOf(r) : '',
        reason: r && r.reason, seat: r && r.ok && r.room ? r.room.seat : null, hostId: r && r.ok && r.room ? r.room.hostId : '',
        hostRating: r && r.ok && r.room ? r.room.hostRating : 0, stale: my !== this._joinSeq }));
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
        _oppRating: Number(rm.hostElo) || Number(rm.hostRating) || 0, oppKey: rm.hostId, seat: rm.seat };
      this.startMatch();
    });
  }
  /* :1063 startMatch — 报到，看到对手也报到了（或 2 秒）就开第一词，第一词也按本机时间起算（F7） */
  startMatch() {
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    const st = this._state;
    if (!st) return;
    st.startAt = this.now();
    st.myScore = 0; st.oppScore = 0; st.oppAns = -1;
    st.mode = st.mode || this._pickedMode || 'C';
    st.oppName = st.oppName || '';
    this._netMiss = 0; this._waitResult = 0; this._goneChecked = 0; this._resultFail = 0;
    st.pendingR = {};
    this.cur = { roomId: st.roomId, side: st.isHost ? 'host' : 'guest', myKey: 'u' + this.P.uid, oppKey: st.oppKey || '',
      seat: st.seat, mode: st.mode, ladder: !!st.ladder, nWords: (st.words || []).length, startT: this.w.now, inst: this.inst.no,
      words: [], claims: [], lastWinners: [], result: null, reported: null, oppRatingUsed: 0, oppIds: [], proto: 'r1' };
    this.P.matches.push(this.cur);
    st._match = this.cur;
    this.go('battle', '', { roomId: st.roomId, side: this.cur.side });
    let started = false;
    const m = this.cur;
    const go = (why) => { if (started) return; started = true; m.round0 = { t: this.w.now, why }; this.askRound(0); };
    this.call('markReady', st.roomId);
    const t0 = this.now(), CAP = 2000;
    const poll = () => {
      if (started || !this.stillLive(st)) return;
      this.call('roundState', st.roomId).then((r) => {
        if (started || !this.stillLive(st)) return;
        const oppReady = r && r.ok && (r.mySide === 'host' ? r.guestReady : r.hostReady);
        if (oppReady) st._oppSeen = true;
        if (oppReady || this.now() - t0 >= CAP) { go(oppReady ? 'opp-ready' : 'cap'); return; }
        this.setTimeout(poll, 400);
      }, () => { if (this.now() - t0 >= CAP) go('cap'); else this.setTimeout(poll, 400); });
    };
    this.setTimeout(() => { if (this.stillLive(st)) go('backstop'); }, CAP + 500);
    poll();
  }
  /* :1058 stopPoll (+ the word's visibilitychange listener) */
  stopPoll() {
    if (this._pollTimer) { this.clearTimer(this._pollTimer); this._pollTimer = null; }
    if (this._rt && this._rt.vis) this._rt.vis = false;
  }
  /* :1153 askRound */
  askRound(idx) {
    this.stopPoll();
    const st = this._state;
    if (!st) return;
    const words = st.words || [];
    if (idx >= words.length) { this.finish(); return; }
    const M = this.api.modeOf(st.mode);
    const span = (M.perWordSecs || 15) * 1000;
    const base = this.now();                                  /* :1194 每一词都从本机看到这一词起算 */
    const rt = this._rt = { idx, answered: false, t0: this.now(), deadline: base + span, vis: true, hidAt: null, graced: false };
    const m = st._match;
    const wr = { idx, t: this.w.now, localDeadlineIn: span, correct: false, submitted: '', gain: 0, settled: 0 };
    if (m) m.words[idx] = wr;
    /* the kid: types the word right after delay ms (or never); nobody types while the page is hidden */
    const k = this.P.kid || {}, kr = this.P.kidRng;
    const correct = kr.chance(k.pCorrect == null ? 0.75 : k.pCorrect);
    let delay = kr.range(k.minMs || 1500, k.maxMs || 9000);
    if (k.slowP && kr.chance(k.slowP)) delay = kr.range(span * 0.7, span * 1.3);
    const type = () => {
      /* the kid can only type on THIS word's on-screen keyboard: once the battle screen of this match is gone
         (match ended, next match's 「对手到了」 screen) a pending keystroke must not land (the real keyboard DOM is repainted) */
      if (this._rt !== rt || rt.answered || this.screen !== 'battle' || !this._state || this._state._match !== m) return;
      if (this.hidden()) { this.setTimeout(type, 600); return; }
      wr.typedAt = this.w.now; this.submitRound(idx, true);
    };
    if (correct) this.setTimeout(type, delay);
    this._pollTimer = this.setInterval(() => {
      if (this.hidden()) return;                              /* :1381 后台不判超时、不轮询 */
      if (!this._rt || this._rt.idx !== idx) return;
      const left = Math.max(0, Math.ceil((this._rt.deadline - this.now()) / 1000));
      if (left <= 0 && !this._rt.answered) { this.submitRound(idx, false); return; }
      const rt0 = this._rt, M0 = this.api.modeOf(this._state && this._state.mode);
      rt0.pn = (rt0.pn || 0) + 1;
      if (M0.waitAll && this.now() - (rt0.t0 || 0) > 6000 && (rt0.pn % 2)) return;
      this.pollOpponent(idx);
    }, 1000);
  }
  /* visibilitychange: :1343 onVis (3-s grace, once per word) and :2410 bindUnloadCleanup (close a waiting room after 30 s) */
  onVisibility(hidden) {
    const rt = this._rt;
    if (rt && rt.vis && !rt.answered) {
      if (hidden) rt.hidAt = this.now();
      else if (rt.hidAt) {
        const away = this.now() - rt.hidAt;
        rt.hidAt = null;
        if (!rt.graced) { rt.graced = true; rt.deadline += Math.min(away, 3000); }
      }
    }
    try {
      if (this._cancelWait && this._state && !this._state.startAt) {
        if (hidden && typeof this._cancelWait.pause === 'function') this._cancelWait.pause();
        if (!hidden && typeof this._cancelWait.resume === 'function') this._cancelWait.resume();
      }
    } catch (e) {}
    if (!hidden && this.fix.resumeCheck && this._state && this._state.startAt && !this._state.finished && this._rt) {
      this.checkOpponentAlive(this._rt.idx, true);
    }
    if (!hidden) { this._hidSeq++; return; }
    const my = ++this._hidSeq, hidAt = this.now();
    const later = () => {
      if (my !== this._hidSeq || !this.hidden()) return;
      if (!this._state || this._state.startAt) return;
      if (this._state.isPrivate && this.now() - hidAt < 180000) { this.setTimeout(later, 15000); return; }
      const lad = !!this._state.ladder;
      this.log('hidden 30 s while waiting → close the room');
      this.endWait(this._state, true);
      if (lad) { this.ladderBack('home', '你切出去太久，房间先关掉了。回来点「开始排位」再找对手。'); return; }
      this.lobby({ reason: '你切出去太久，房间先关掉了。想玩就再开一间吧。' });
    };
    this.setTimeout(later, 30000);
  }
  /* :1418 checkOpponentAlive(idx, force) */
  checkOpponentAlive(idx, force) {
    const st = this._state;
    if (!st || !st.roomId) return;
    if (!force && this.now() - this._goneChecked < 4000) return;
    this._goneChecked = this.now();
    this.call('opponentGone', st.roomId).then((g) => {
      if (!this.stillLive(st)) return;
      if (!g) return;
      if (!g.ok && g.gone) g = { ok: true, gone: true, left: true, roomGone: true };
      if (!g.ok) return;
      const mySide = st.isHost ? 'host' : 'guest';
      if (g.ended && g.void) {
        this.stopPoll();
        this.showResult({ result: 'void', byAbandon: true, mine: st.myScore, theirs: st.oppScore }, 'both-abandoned');
        return;
      }
      if (g.ended && g.endedBy === 'abandon' && g.abandonWin && g.abandonWin !== mySide) {
        this.stopPoll();
        this.showResult({ result: 'lose', byAbandon: true, mine: st.myScore, theirs: st.oppScore }, 'opp-claimed-abandon');
        return;
      }
      if (g.kicked) {
        this.stopPoll();
        const ladK = !!st.ladder, ridK = st.roomId;
        if (st._match) st._match.end = { how: 'kicked', t: this.w.now, played: (st._match.words || []).filter((w) => w && w.submitted).length };
        this._state = null;
        this.call('leaveRoom', ridK);
        if (ladK) { this.ladderBack('rematch', '房主那边没收到你的回应，这局没开成，接着帮你找…'); return; }
        this.lobby({ reason: '房主那边没收到你的回应，这一局没开成。换一间吧。' });
        return;
      }
      if (g.gone && !st._oppSeen && !g.oppSeen) {
        this.stopPoll();
        const lad0 = !!st.ladder, rid0 = st.roomId;
        if (st._match) st._match.end = { how: 'opp-never-came', kicked: !!g.kicked, roomGone: !!g.roomGone, t: this.w.now };
        this._state = null;
        this.call('leaveRoom', rid0);
        if (lad0) { this.ladderBack('rematch', '对手刚才没进来，接着帮你找…'); return; }
        this.lobby({ reason: '对手刚才没进来，这间房先关掉了。再开一间吧。' });
        return;
      }
      if (g.gone && g.mine) {
        this.stopPoll();
        this.showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone-mine');
        return;
      }
      if (g.gone) {
        this.stopPoll();
        if (st._match) st._match.goneSeen = { left: !!g.left, roomGone: !!g.roomGone, idle: g.idleSecs, t: this.w.now };
        if (g.roomGone) { this.showResult({ result: 'void', roomGone: true, mine: st.myScore, theirs: st.oppScore }, 'room-gone'); return; }
        if (this.fix.abandonSure) {
          this.claimAbandonSure(st, (w) => {
            const res = (w.result === 'void' || w.result === 'lose') ? w.result : 'win';
            this.showResult({ result: res, mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone' + (g.left ? '-left' : '') + (res !== 'win' ? '-' + res : ''));
          });
          return;
        }
        this.call('claimAbandonWin', st.roomId).then((w) => {
          if (!this.stillLive(st)) return;
          const res = (w && w.ok && (w.result === 'void' || w.result === 'lose')) ? w.result : 'win';
          this.showResult({ result: res, mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone' + (g.left ? '-left' : '') + (res !== 'win' ? '-' + res : ''));
        }, () => { this.showResult({ result: 'win', mine: st.myScore, theirs: st.oppScore, byAbandon: true }, 'opp-gone-catch'); });
        return;
      }
    }, () => {});
  }
  /* :1503 pollOpponent */
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
        if ((r.mySide === 'host' ? r.guestReady : r.hostReady) || (r.winners || []).some((x) => x && x !== r.mySide)
            || Number(r.oppAns) >= 0 || Number(r.oppPts) > 0) st._oppSeen = true;
        if (m && r.oppId && m.oppIds.indexOf(r.oppId) < 0) m.oppIds.push(r.oppId);
        if (st._oppId && r.oppId && r.oppId !== st._oppId && !st._oppSwapped) { st._oppSwapped = true; if (m) m.swapped = true; }
      }
      if (r && !r.ok && (r.gone || r.kind === 'gone')) { this.checkOpponentAlive(idx, true); return; }   /* :1558 F3 */
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
      this.settlePending(st, r);
      if (r.oppAns != null && isFinite(Number(r.oppAns))) st.oppAns = Math.max(st.oppAns == null ? -1 : st.oppAns, Number(r.oppAns));
      this.oppPtsShow(st, r);
      if (!this._rt || this._rt.idx !== idx) return;
      const w = (r.winners || [])[idx];
      if (!w) return;
      const mySide = r.mySide || (st.isHost ? 'host' : 'guest');
      const oppGot = (w !== mySide);
      if (oppGot && !mm.waitAll && !this._rt.answered) { this.submitRound(idx, false, true); }
    }, () => {});
  }
  /* 56b8146 :1919 pendGain — a pending word's points arrive (for the checks: wr.settled) */
  pendGain(st, i, sc, winner) {
    const wr = st._match && st._match.words[i];
    if (wr) { wr.settled = sc || 0; wr.settledT = this.w.now; wr.settledWinner = winner || ''; }
    this.log('pending word ' + i + ' settled: winner ' + (winner || '?') + ' → +' + (sc || 0));
    if (sc) st.myScore += sc;
  }
  /* 56b8146 :1926 retryPending — 8 s without an answer: claim the word again (same _id, same nonce in the data layer).
     3b6bbd7..56b8146: once per word. Patched (R12): again after another 8 s, and once more at finish() */
  retryPending(st, i) {
    st.pendTry = st.pendTry || {};
    const last = st.pendTry[i];
    if (last && !(this.fix.pendingKept && this.now() - last > 8000)) return Promise.resolve(null);
    st.pendTry[i] = this.now();
    st._retrying = (st._retrying || 0) + 1;
    const doneTry = () => { st._retrying = Math.max(0, (st._retrying || 1) - 1); };
    return this.call('claimRound', st.roomId, i).then((r) => { doneTry(); return r; }, () => { doneTry(); return null; }).then((r) => {
      if (!st.pendingR || !(i in st.pendingR)) return null;
      if (!r || !r.ok || r.pending) return null;
      delete st.pendingR[i];
      this.pendGain(st, i, Number(r.score) || 0, r.winner);
      return r;
    }, () => null);
  }
  /* :1908 settlePending — a pending claim: once a poll shows who won word i, add my points; 8 s → retryPending; 60 s → dropped
     (patched R12: not dropped — finish() settles it) */
  settlePending(st, r) {
    const pend = st.pendingR || {}, ws = (r && r.winners) || [];
    const M = this.api.modeOf(st && st.mode);
    const mySide = r.mySide || (st.isHost ? 'host' : 'guest');
    for (const k of Object.keys(pend)) {
      const i = Number(k), w = ws[i];
      if (!w) {
        if (this.now() - pend[k] > 8000) this.retryPending(st, i);
        if (!this.fix.pendingKept && this.now() - pend[k] > 60000) { delete pend[k]; this.log('pending word ' + i + ' given up (60 s)'); }
        continue;
      }
      delete pend[k];
      const gain = (w === mySide) ? (M.firstScore || 100) : (M.waitAll ? (M.secondScore || 0) : 0);
      try { this.api.settleRound(st.roomId, i, 0); } catch (e) {}
      this.pendGain(st, i, gain, w);
    }
  }
  /* 56b8146 :1959 resolvePending — before handing in: settle (≤2.5 s) or re-claim each pending word, capMs overall */
  resolvePending(st, capMs) {
    const keys = Object.keys(st.pendingR || {});
    st._settleOffline = false;
    if (!keys.length) return Promise.resolve();
    const t0 = this.now();
    const one = (i) => this.call('settleRound', st.roomId, i, 2500).then((r) => {
      if (!st.pendingR || !(i in st.pendingR)) return null;
      const rk = r && !r.ok ? this.kindOf(r) : '';
      if (rk === 'network' || rk === 'slow') st._settleOffline = true;
      if (r && r.ok && r.settled) { delete st.pendingR[i]; this.pendGain(st, i, Number(r.score) || 0, r.winner); return null; }
      if (this.now() - t0 > capMs) return null;
      if (this.fix.pendingKept && st.pendTry) delete st.pendTry[i];   /* patched R12: one more re-send at the end */
      return this.retryPending(st, i);
    }, () => null);
    const all = Promise.all(keys.map((k) => one(Number(k))));
    return Promise.race([all, new Promise((z) => this.setTimeout(z, capMs))]);
  }
  /* :1766 stillLive */
  stillLive(st) {
    if (!st || !this._state) return false;
    if (st !== this._state) { if (!st.roomId || st.roomId !== this._state.roomId) return false; }
    return true;
  }
  /* :1775 submitRound */
  submitRound(idx, correct, forced) {
    if (!this._rt || this._rt.answered) return;
    this._rt.answered = true;
    this.stopPoll();
    const st = this._state;
    if (!st) return;
    const M = this.api.modeOf(st.mode);
    const m = st._match, wr = m && m.words[idx];
    if (wr) { wr.submitted = correct ? 'correct' : (forced ? 'forced' : 'timeout'); wr.correct = !!correct; wr.subT = this.w.now; wr.subLocalLeft = Math.round(this._rt.deadline - this.now()); }
    const after = (gain, first, how) => {
      st.myScore += gain;
      if (wr) { wr.gain = gain; wr.first = !!first; wr.how = how; }
      const extra = (how === 'won' && !M.waitAll) ? 700 : 0;
      this.setTimeout(() => { if (!this.stillLive(st)) return; this.nextWord(st, idx, how); }, 1400 + extra);
    };
    if (!correct) {
      this.call('skipRound', st.roomId, idx);
      after(0, false, forced ? 'lost' : 'timeout'); return;
    }
    this.call('claimRound', st.roomId, idx).then((r) => {
      if (m) m.claims.push({ idx, t: this.w.now, ok: !!(r && r.ok), won: !!(r && r.won), score: r && r.score, winner: r && r.winner, pending: !!(r && r.pending), ended: !!(r && r.ended), squatted: !!(r && r.squatted), kind: r && !r.ok ? this.kindOf(r) : '' });
      if (!this.stillLive(st)) return;
      if (r && r.ok && r.pending) { st.pendingR = st.pendingR || {}; st.pendingR[idx] = this.now(); after(0, false, 'pending'); return; }
      if (r && !r.ok && r.ended) { after(0, false, 'ended'); this.checkOpponentAlive(idx, true); return; }
      if (!r || !r.ok) {
        const k = this.kindOf(r);
        if (this.fix.failedPending && (k === 'network' || k === 'slow' || k === 'session')) { st.pendingR = st.pendingR || {}; st.pendingR[idx] = this.now(); }
        after(0, false, (r && k !== 'network' && k !== 'slow') ? 'failed-other' : 'failed'); return;
      }
      const sc = Number(r.score) || 0;
      if (r.squatted) { after(sc, false, 'squat'); return; }
      after(sc, !!r.first, r.first ? 'won' : (sc ? 'second-scored' : 'second'));
    }, () => { after(0, false, 'failed'); });
  }
  /* :1903 nextWord(st, idx, how) */
  nextWord(st, idx, how) {
    const M = this.api.modeOf(st && st.mode);
    const last = idx + 1 >= (st.words || []).length;
    const mustWait = M.waitAll || (how === 'timeout' || how === 'failed' || how === 'failed-other' || how === 'squat');
    if (!mustWait || last || !st.roomId || (st.oppAns != null && st.oppAns >= idx)) { this.askRound(idx + 1); return; }
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
          this.settlePending(st, r);
          if (st._match) { st._match.lastWinners = (r.winners || []).slice(); }
          const oa = Number(r.oppAns);
          if (isFinite(oa)) st.oppAns = Math.max(st.oppAns == null ? -1 : st.oppAns, oa);
          /* 56b8146: look at 「he won it」 first — he also records 「answered word i」 when he wins */
          if (!M.waitAll && (r.winners || [])[idx]) {
            if (!rt._oppWonAt) { rt._oppWonAt = this.now(); this.setTimeout(go, 1400); }
            return;
          }
          if (oa >= idx) { go(); return; }
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
  /* 56b8146 :2178 finish — resolvePending (≤8 s) then pollResult(finalScore) */
  finish() {
    const st = this._state;
    if (!st) return;
    this.stopPoll();
    st.finished = true;
    const pendN = Object.keys(st.pendingR || {}).length;
    this.go('result-wait', pendN ? 'settling' : '', { roomId: st.roomId });
    this._waitResult = 0; this._resultFail = 0;
    const go = () => {
      if (!this.stillLive(st)) return;
      const score = Number(st.myScore) || 0;
      st.finalScore = score; st._resWaitT0 = this.now();
      if (st._match) { st._match.reported = score; st._match.pendingAtFinish = Object.keys(st.pendingR || {}).map(Number); }
      this.ev('handed-in', { roomId: st.roomId, score });
      this.pollResult(st, score);
    };
    /* patched R4: while offline at the end keep settling (every 2 s, ≤60 s) before handing in */
    const tFin = this.now();
    const settle = () => this.resolvePending(st, 8000).then(() => {
      if (!this.stillLive(st)) return;
      if (this.fix.settleWhileOffline && Object.keys(st.pendingR || {}).length && (st._settleOffline || st._retrying > 0) && this.now() - tFin < 60000) {
        return new Promise((z) => this.setTimeout(z, 2000)).then(settle);
      }
    });
    if (this.fix.finishSettles) settle().then(go); else go();
  }
  /* :1983 pollResult */
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
      if (this.fix.neverCameGuardPoll && r.byAbandon && r.oppLeft && !st._oppSeen) { this.neverCame(st, 'report-oppLeft'); return; }
      if (r.byAbandon) r = { ok: true, result: r.result, byAbandon: true, mine: st.myScore, theirs: st.oppScore };
      this.showResult(r, 'report', raw);
    }, () => {
      this._waitResult = (this._waitResult || 0) + 1;
      if (this._waitResult > 22) { this.checkStillThere(st, score); return; }
      this.setTimeout(() => this.pollResult(st, score), 2500);
    });
  }
  /* :2027 checkStillThere */
  checkStillThere(st, score) {
    const give = (why, g) => {
      this._waitResult = 0;
      if (this.fix.neverCameGuard && !st._oppSeen && !(g && g.oppSeen)) { this.neverCame(st, 'result-wait-' + why); return; }
      if (this.fix.abandonSure) {
        this.claimAbandonSure(st, (w) => {
          const res = (w.result === 'void' || w.result === 'lose') ? w.result : 'win';
          this.showResult({ ok: true, result: res, byAbandon: true, mine: score, theirs: 0 }, 'result-wait-' + why + (res !== 'win' ? '-' + res : ''));
        });
        return;
      }
      const fin = (w) => {
        if (!this.stillLive(st)) return;
        const res = (w && w.ok && (w.result === 'void' || w.result === 'lose')) ? w.result : 'win';
        this.showResult({ ok: true, result: res, byAbandon: true, mine: score, theirs: 0 }, 'result-wait-' + why + (res !== 'win' ? '-' + res : ''));
      };
      this.call('claimAbandonWin', st.roomId).then(fin, () => fin(null));
    };
    this.call('opponentGone', st.roomId).then((g) => {
      if (!this.stillLive(st)) return;
      const alive = g && g.ok && !g.gone && (g.idleSecs || 0) < 30;
      /* 56b8146: cap = 150 polls (≈5 min only on a fast network); patched D2: 300 s since handing in */
      const more = this.fix.timeCap ? (this.now() - (st._resWaitT0 || this.now()) < 300000) : (this._waitResult < 150);
      if (alive && more) { this.setTimeout(() => this.pollResult(st, score), 2000); return; }
      give(g && g.ok ? (g.gone ? 'gone' : 'idle' + g.idleSecs) : 'checkfail:' + this.kindOf(g), g);
    }, () => give('reject'));
  }
  /* 56b8146 :2434 bgSettle — handed in, then left: the result is fetched in the background and recorded (toast).
     3b6bbd7..56b8146 award 'win' when the abandon claim fails; patched R3: only a written claim counts */
  bgSettle(st) {
    if (!st || !st.roomId || st._bg) return;
    st._bg = true;
    const m = st._match, inst = this.inst;
    const scoreNow = () => Number(st.finalScore != null ? st.finalScore : st.myScore) || 0;   /* 56b8146: hand in the score of this moment */
    let score = scoreNow();
    const t0 = this.now(); let n = 0, fin = false;
    const done = (r) => {
      if (fin || !r) return;
      fin = true;
      const rr = r.byAbandon ? { result: r.result, mine: score, theirs: r.result === 'win' ? 0 : (Number(st.oppScore) || 0), byAbandon: true } : r;
      if (rr.result === 'void') return;
      if (m && !m.result) m.result = Object.assign({ t: this.w.now, why: 'bg-settle' + (r.byAbandon ? ':abandon' : ''), bg: true }, rr);
      this.log('bgSettle → ' + rr.result);
    };
    const next = (ms) => { if (!fin && !inst.dead) inst.setTimeout(step, ms); };
    const step = () => {
      if (fin || inst.dead || this.now() - t0 > 6 * 60000) return;
      n++; score = scoreNow();
      this.api.reportResult(st.roomId, score).then((r) => {
        if (r && r.ok && !r.waiting) { done(r); return; }
        if (!(r && r.ok && r.waiting) || n % 8 !== 0) { next(4000); return; }
        this.api.opponentGone(st.roomId).then((g) => {
          if (!(g && g.ok && g.gone && !g.oppFinished)) { next(4000); return; }
          this.api.claimAbandonWin(st.roomId).then((w) => {
            if (this.fix.abandonSure && !(w && w.ok)) { next(4000); return; }
            if (w && w.ok && w.real) { done({ ok: true, result: w.result, mine: w.mine, theirs: w.theirs }); return; }
            done({ result: (w && w.ok && (w.result === 'void' || w.result === 'lose')) ? w.result : 'win', byAbandon: true });
          }, () => { if (this.fix.abandonSure) next(4000); else done({ result: 'win', byAbandon: true }); });
        }, () => next(4000));
      }, () => next(6000));
    };
    step();
  }
  /* patched UI (R10) neverCame: the opponent never reported ready → no result, back to the lobby / ladder */
  neverCame(st, why) {
    this.stopPoll();
    const lad0 = !!st.ladder, rid0 = st.roomId;
    if (st._match) st._match.end = { how: 'opp-never-came', why, t: this.w.now };
    this._state = null;
    this.call('leaveRoom', rid0);
    if (lad0) { this.ladderBack('rematch', '对手刚才没进来，接着帮你找…'); return; }
    this.lobby({ reason: '对手刚才没进来，这间房先关掉了。再开一间吧。' });
  }
  /* patched UI (R3) claimAbandonSure: the abandon win counts only once it is written; retry every 3 s, 6 tries, then 结果没拿到 */
  claimAbandonSure(st, onOk) {
    let n = 0;
    const again = (w) => {
      if (!this.stillLive(st)) return;
      const k = this.kindOf(w);
      if (++n < 6 && k !== 'expired' && k !== 'config') { this.setTimeout(go, 3000); return; }
      this.resultFailed(st, (w && w.ok === false) ? w : { ok: false, reason: '网络不稳，这一局的结果没记上' });
    };
    const go = () => {
      if (!this.stillLive(st)) return;
      this.call('claimAbandonWin', st.roomId).then((w) => {
        if (!this.stillLive(st)) return;
        if (w && w.ok && w.real) { this.showResult({ ok: true, result: w.result, mine: w.mine, theirs: w.theirs }, 'abandon-claim-real-scores'); return; }
        if (w && w.ok) { onOk(w); return; }
        again(w);
      }, (e) => again({ ok: false, reason: String((e && e.message) || e || '') }));
    };
    go();
  }
  /* :2047 resultFailed */
  resultFailed(st, r) {
    const rid = st && st.roomId;
    if (st && st._match) st._match.end = { how: 'result-failed', kind: this.kindOf(r), t: this.w.now };
    this._state = null;
    if (rid) this.call('leaveRoom', rid);
    this.go('result-failed', r && r.reason, { kind: this.kindOf(r) });
  }
  /* :2165 showResult */
  showResult(r, why, raw) {
    const wasLadder = this._state ? !!this._state.ladder : this._cameFromLadder;
    const st = this._state;
    const m = (st && st._match) || this.cur;
    if (m && !m.result) {
      m.result = { result: r.result, byAbandon: !!r.byAbandon, roomGone: !!r.roomGone, mine: r.mine, theirs: r.theirs, why: why || '', t: this.w.now,
        rawMine: raw && raw.mine, rawTheirs: raw && raw.theirs, oppLeft: !!(raw && raw.oppLeft) };
      m.oppRatingUsed = (st && st._oppRating) || 0;
      m.oppNameUsed = (st && st.oppName) || '';
    }
    const rid = st && st.roomId;
    this._state = null;
    this.stopPoll();
    if (rid) this.call('leaveRoom', rid);
    this._cameFromLadder = wasLadder;
    this.go('result', r.result + (r.byAbandon ? ' (byAbandon)' : '') + (r.roomGone ? ' (roomGone)' : '') + ' ' + r.mine + ':' + r.theirs, { why });
    /* 「再来一局」(:2292) */
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
  /* :2342 _createForLadder / :2364 _joinForLadder */
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
  /* :2399 bindUnloadCleanup — pagehide → leaveRoom(_state.roomId) */
  onPageHide() {
    const rid = this._state && this._state.roomId;
    if (rid) { try { this.api.leaveRoom(rid); } catch (e) {} }
  }

  /* ══ ladder UI (hansen_ladder_ui_v1108.js @3b6bbd7) ══ */
  bandOf(waited) { const s = Math.max(0, Number(waited) || 0); return Math.max(100, Math.min(400, 100 + Math.floor(s / 5) * 50)); }   /* HansenSbLadder.matchBand */
  stopRun() {
    const run = this._run; this._run = null;
    this._probeSeq++;
    if (!run) return;
    run.stop = true;
    if (run.timer) { this.clearTimer(run.timer); run.timer = null; }
  }
  later(run, ms) {
    if (run.stop) return;
    if (run.timer) this.clearTimer(run.timer);
    run.timer = this.setTimeout(() => { run.timer = null; this.ladTick(run); }, ms);
  }
  /* :238 open(opts) — ladder home; closePeers() closes the room UI */
  ladderOpen(opts) {
    if (this._cancel) { try { this._cancel(); } catch (e) {} this._cancel = null; }
    this.stopRun();
    this.closeRoomUiQuietly();
    this.go('ladder-home', opts && opts.note);
  }
  closeRoomUiQuietly() {
    /* closePeers → HansenPkRoomUI.close() (same body as close(), without our screen change) */
    this.endMatch('left');
    this.stopPoll();
    this._lobbySeq++;
    this.cancelCreating();   /* 56b8146 :160 */
    if (this._cancelWait) { try { this._cancelWait(); } catch (e) {} this._cancelWait = null; }
    this.cancelJoin();
    try { this.api.stopHeartbeat(); } catch (e) {}
    if (this._state && this._state.roomId) this.call('leaveRoom', this._state.roomId);
    this._state = null;
    this._fromLadder = false; this._ladderCfg = null; this._pickedMode = 'C'; this._wantPrivate = false;
  }
  pressLadder() { this.pressPending = false; this.presses++; this.ev('ladder-press', { n: this.presses }); this.startMatching(); }
  /* :735 startMatching */
  startMatching() {
    if (this._cancel) { try { this._cancel(); } catch (e) {} this._cancel = null; }
    this.stopRun();
    this._netFail = 0;
    const run = this._run = { stop: false, t0: this.now(), netFail: 0, sessT0: 0, busy: false, sm: { rating: this.P.rating },
      timer: null, tried: {}, createFail: 0, hidAt: 0 };
    this._cancel = () => this.stopRun();
    this.go('ladder-matching');
    this.ladTick(run);
  }
  /* :779 tick */
  ladTick(run) {
    if (run.stop || run.busy) return;
    if (this.hidden()) { if (!run.hidAt) run.hidAt = this.now(); this.later(run, 1000); return; }   /* UI-10 */
    if (run.hidAt) {
      const away = this.now() - run.hidAt;
      run.hidAt = 0;
      if (away > 30000) { this.stopRun(); this.ladderOpen({ note: '你切出去太久，先停下了。回来点「开始排位」再找对手。' }); return; }
    }
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
  /* :839 tryRooms */
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
  /* :870 selfHost */
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
  /* :908 onFail */
  ladOnFail(run, r) {
    if (run.stop) return;
    const k = this.kindOf(r);
    if (r && r.reload) { this.showProblem('reload', r); return; }
    if (k === 'expired') { this.stopRun(); this.go('ladder-problem', 'need-login', { kind: k, raw: r && r.reason }); return; }
    if (k === 'config') { this.showProblem('config', r); return; }
    if (k === 'session') {
      if (!run.sessT0) run.sessT0 = this.now();
      if (this.now() - run.sessT0 < 20000) { this.later(run, 2000); return; }
      this.showProblem('session', r); return;
    }
    run.netFail++; this._netFail = run.netFail;
    if (run.netFail >= 4) {
      if (k === 'other') { this.showProblem('other', r); return; }
      /* TI-4: ask the login service whether the network is up (≤ 6 s) → 'dbblocked' or offline */
      this.stopRun();
      const tok = ++this._probeSeq;
      this.go('ladder-probing');
      let settled = false;
      const fin = (reach) => { if (settled) return; settled = true; if (tok !== this._probeSeq) return; this.showProblem(reach ? 'dbblocked' : 'network', r); };
      Promise.resolve(this.inst.ctx.HansenAuth.probeCloud()).then((v) => fin(!!v), () => fin(false));
      this.setTimeout(() => fin(false), 6000);
      return;
    }
    this.later(run, 3000);
  }
  showProblem(kind, r) { this.stopRun(); this._probeSeq++; this.go('ladder-problem', kind, { kind, raw: r && r.reason }); }
  roomProblem(r) { const k = this.kindOf(r); return k === 'taken' || k === 'gone' || k === 'other' || k === 'self'; }
  failNote(r) {
    const k = this.kindOf(r);
    return k === 'taken' ? '那间房刚被别人抢走了，接着帮你找…' : k === 'gone' ? '那间房刚关了，接着帮你找…'
      : k === 'self' ? '那是你自己账号开的房，接着找别人的…' : '那间房没进去，接着帮你找…';
  }
  /* :1088 fromRoom */
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
        /* 天梯「取消」(:721) / 等人屏「关掉房间」(:783) / 进房屏「取消」(:937) /
           对战屏、等交卷屏的「退出」→ askQuit → 确认 → close(); 排位回天梯、自由房回列表 (:2458) */
        if (this.screen === 'ladder-matching') { this.stopRun(); this.ladderOpen(); return; }
        if (this.screen === 'waiting') { if (this._state && this._state.ladder) this.ladderBack('home', ''); else this.close(); return; }
        if (this.screen === 'joining' && this._onCancelJoin) { this._onCancelJoin(); return; }
        if (this.screen === 'battle' || this.screen === 'result-wait') {
          const lad = !!(this._state && this._state.ladder);
          if (this._state && this._state.startAt && this._state.finished) this.bgSettle(this._state);   /* 56b8146 :2760 */
          this.close();
          if (lad) this.ladderOpen(); else this.lobby();
          return;
        }
        if (!this.idle()) this.close();
        return;
    }
  }
  retryIntent(it) {
    it._retry = (it._retry || 0) + 1;
    if (it._retry > 8) return;
    this.setTimeout(() => this.intent(it), 3000);
  }
  /* a lobby list arrived (tap / auto-refresh): if the kid wants to join, tap the target's room (or refresh / give up) */
  onLobbyList(r) {
    const jp = this.joinPlan;
    if (!jp || jp.it.via === 'code' || this.screen !== 'lobby' || jp.tapPending) return;
    const it = jp.it;
    const want = it.target ? this.w.playerByLabel(it.target) : null;
    const rooms = (r && r.ok && r.rooms) || [];
    let cand = rooms.filter((x) => !want || x.hostName === want.name);
    let room = null;
    if (cand.length) room = it.pick === 'random' ? cand[Math.floor(this.P.kidRng.float() * cand.length)] : cand[0];
    jp.attempt++;
    if (!room) {
      if (jp.attempt > (it.tries || 4)) { this.joinPlan = null; this.ev('join-gave-up', { why: 'not-listed' }); return; }
      jp.tapPending = true;
      this.setTimeout(() => { jp.tapPending = false; if (this.screen === 'lobby' && this.joinPlan === jp) this.refresh(); }, 2000);
      return;
    }
    if (jp.attempt > (it.tries || 4) + 1) { this.joinPlan = null; return; }
    jp.tapPending = true;
    this.setTimeout(() => {
      jp.tapPending = false;
      if (this.screen !== 'lobby' || this.joinPlan !== jp) return;
      this.doJoin(room.id, true, null);
    }, 300 + Math.floor(this.P.kidRng.float() * 700));
  }
  /* :515 joinByCode → findByCode with find(2) retries → doJoin(roomId, btn, null, code) */
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
    const code = h.code;
    const find = (left) => this.call('findByCode', code).then((r) => {
      if (r && !r.ok && r.kind === 'gone' && left > 0) return new Promise((z) => this.setTimeout(z, 1200)).then(() => find(left - 1));
      return r;
    });
    const tFind = this.w.now;
    find(2).then((r) => {
      /* the UI retries 「没找到」 twice silently (:557 find(2)) — only the last answer reaches the kid */
      const fs = this.P.apiFails.filter((f) => f.api === 'findByCode' && f.t0 >= tFind && f.inst === this.inst.no);
      for (let q = 0; q < fs.length - (r && r.ok ? 0 : 1); q++) fs[q].retried = true;
      if (this.screen !== 'lobby' || this.joinPlan !== jp) return;
      if (!r.ok) {
        this.ev('code-fail', { kind: this.kindOf(r), reason: r.reason });
        if (jp.attempt > (it.tries || 3)) { this.joinPlan = null; return; }
        this.setTimeout(() => this.codeJoin(), 3000);
        return;
      }
      this.joinPlan = null;
      this.doJoin(r.roomId, true, null, code);
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
function brief(r) {
  if (!r || typeof r !== 'object') return String(r);
  if (r.ok === false) return 'FAIL kind=' + (r.kind || '?') + ' 「' + String(r.reason || '').slice(0, 110) + '」';
  const o = {};
  for (const k of ['roomId', 'won', 'first', 'score', 'winner', 'pending', 'settled', 'round', 'waiting', 'result', 'mine', 'theirs', 'byAbandon', 'void', 'gone', 'left', 'kicked', 'roomGone', 'mine', 'idleSecs', 'oppFinished', 'ended', 'skipped', 'sameAccount']) if (r[k] !== undefined) o[k] = r[k];
  if (r.rooms) o.rooms = r.rooms.length;
  if (r.room && r.room.seat !== undefined) o.seat = r.room.seat;
  if (r.winners) o.winners = r.winners.join(',');
  return 'ok ' + JSON.stringify(o).slice(0, 160);
}
