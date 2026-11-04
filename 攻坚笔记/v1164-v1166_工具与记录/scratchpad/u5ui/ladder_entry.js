  function _createForLadder(rating, opts) {
    opts = opts || {};
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('开排位房'); } catch (e) {}
    _pickedMode = 'A'; _wantPrivate = false; _fromLadder = true;
    try {
      var _h = host();
      if (_h) {
        _h.classList.add('on');
        _h.innerHTML = '<div class="pr_wrap">'
          + '<div class="pr_empty" style="padding:30px 12px">正在开房间…</div></div>';
      }
    } catch (e) {}
    /* 🔴v1156：**只让容器可见，不画房间列表**（lobby() 会先画出「房间已经不在了」）。
       🔴v1164：排位房的设定全部显式传 —— 固定抢答赛、固定看中文（不沿用自由房选过的「听发音」）、
       写上自己的分；等人时让数据层顺便看看有没有更早开的房（两人同时开始时能配到一起）。 */
    _ladderCfg = { ladder: true, mode: 'A', askMode: 'cn', private: false,
                   rating: Number(rating) || 1000,
                   t0: Number(opts.t0) || Date.now(), band: opts.band,
                   onOk: opts.onOk, onFail: opts.onFail };
    doCreate(_ladderCfg);
  }
  function _joinForLadder(roomId, opts) {
    opts = opts || {};
    _cameFromLadder = true;
    try { if (window.HansenPkWatchdog) HansenPkWatchdog.arm('进排位房'); } catch (e) {}
    _pickedMode = 'A';
    _fromLadder = true;      /* v1154: 记住这次是排位来的，进不去时好说人话 */
    try { var _h = host(); if (_h) { _h.classList.add('on'); } } catch (e) {}
    /* 🔴v1156：**只让容器可见，不画房间列表。**
       🔴v1164：进不去时不再停在「被抢走了 / 再找一次」那一屏 —— 原因交回天梯，
       天梯自动试下一间（孩子不用再点）；没有天梯回调时（老调用方）也自动回去接着找。 */
    _ladderCfg = { ladder: true, rating: Number(opts.rating) || 0,
                   onOk: opts.onOk, onFail: opts.onFail };
    doJoin(roomId, null, _ladderCfg);
  }

