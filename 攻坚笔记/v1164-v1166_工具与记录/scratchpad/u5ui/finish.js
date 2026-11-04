  function finish() {
    var st = _state;
    if (!st) return;
    stopPoll(); stopKb();
    var secs = Math.max(1, Math.round((Date.now() - st.startAt) / 1000));

    /* 🔴v1122：**改用回合制的实际得分。** 改了计分方式，就要顺着链条查到最后一环。 */
    var stat = st.st || { words: 0, correct: 0 };
    var score = Number(st.myScore) || 0;

    paint('<div class="pr_top"><div class="pr_h">📨 交卷了</div></div>'
      + '<div class="pr_empty">你答对 ' + stat.correct + ' / ' + (st.words || []).length
      + ' 个，得 ' + score + ' 分，用时 ' + secs + ' 秒。<br>'
      + '正在等对手交卷…</div>');
    _waitResult = 0; _resultFail = 0;
    /* 🔴v1164：第一次交卷失败也走同一条重试路（原来 `!r.ok` 直接回列表，这一局就白打了） */
    pollResult(st, score);
  }

  /* 交卷 + 等对手交卷。st 是这一局的状态 ——
     🔴v1164：原来这里用了一个没定义的 `st`（只传了 roomId），一断网就 ReferenceError，
     等交卷这条链当场断掉，人卡在「正在等对手交卷…」。 */
  function pollResult(st, score) {
    if (!stillLive(st)) return;
    S().reportResult(st.roomId, score).then(function (r) {
      if (!stillLive(st)) return;
      if (!r || !r.ok) {
        /* 🔴v1164：**交卷失败先重试，不立刻放弃。** 网抖一下就把人甩回列表，
           这一局的战绩和天梯分就都没了。登录过期、云端设置不对这种重试也没用 —— 直接说。 */
        _resultFail = (_resultFail || 0) + 1;
        var k = kindOf(r);
        if (_resultFail < 5 && k !== 'expired' && k !== 'config') {
          setTimeout(function () { pollResult(st, score); }, 2000);
          return;
        }
        resultFailed(st, r || { ok: false, reason: '交卷没成功' });
        return;
      }
      _resultFail = 0;
      if (r.waiting) {
        /* 🔴v1154：**等对手交卷不能没有上限。**
           给 45 秒：正常情况下对手交卷只要几秒。
           v1164：到点先问一句对手还在不在 —— 还在（心跳在跳，只是慢）就再多等一会儿，
           真不在了才判离场，并且把「离场」写进自己的文档，两边看到同一个结论。 */
        _waitResult = (_waitResult || 0) + 1;
        if (_waitResult > 22) {                 /* 22 次 × 2 秒 ≈ 45 秒 */
          checkStillThere(st, score);
          return;
        }
        setTimeout(function () { pollResult(st, score); }, 2000);
        return;
      }
      _waitResult = 0;
      /* 对手离场判的胜负：比分显示这一局实际拿到的分（数据层那边是 1:0 的记号） */
      if (r.byAbandon) r = { ok: true, result: r.result, byAbandon: true,
                             mine: st.myScore, theirs: st.oppScore };
      showResult(r);
    })['catch'](function () {
      /* 网络抖动也算一次等待，别让异常把这条链断掉 */
      _waitResult = (_waitResult || 0) + 1;
      if (_waitResult > 22) { checkStillThere(st, score); return; }
      setTimeout(function () { pollResult(st, score); }, 2500);
    });
  }

  /* 等了 45 秒还没交卷：对手还在就再等（最多约 2 分钟），不在了就判他离场 */
  function checkStillThere(st, score) {
    var give = function () {
      _waitResult = 0;
      var fin = function () {
        if (!stillLive(st)) return;
        showResult({ ok: true, result: 'win', byAbandon: true, mine: score, theirs: 0 });
      };
      S().claimAbandonWin(st.roomId).then(fin, fin);
    };
    S().opponentGone(st.roomId).then(function (g) {
      if (!stillLive(st)) return;
      var alive = g && g.ok && !g.gone && (g.idleSecs || 0) < 30;
      if (alive && _waitResult < 60) { setTimeout(function () { pollResult(st, score); }, 2000); return; }
      give();
    }, give);
  }

  /* 结果实在拿不到：说清楚，并给回去的路（排位回天梯，自由房回列表） */
  function resultFailed(st, r) {
    var lad = !!(st && st.ladder);
    var rid = st && st.roomId;
    _state = null;
    if (rid) { try { S().leaveRoom(rid); } catch (e) {} }
    paint('<div class="pr_top"><div class="pr_h">📨 这一局的结果没拿到</div></div>'
      + errBlock(r)
      + '<div class="pr_empty" style="font-size:13px">网好了以后，下一局会照常记分。</div>'
      + '<button class="pr_btn" id="prResBack">' + (lad ? '← 回天梯' : '← 回到房间列表') + '</button>');
    wireErr();
    if (q('prResBack')) q('prResBack').onclick = function () {
      if (lad) { ladderBack('home', ''); return; }
      lobby();
    };
  }

