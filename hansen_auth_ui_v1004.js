/* hansen_auth_ui_v1004.js —— 登录 / 注册面板（配合 hansen_auth_v1004.js）
 * 手机号验证码为主，用户名密码为辅；未登录也能继续玩（匿名）。
 * 双色调：暗色调深底浅字（本文件自带），亮色调由 hansen_palette.js 接管。 */
(function () {
  'use strict';
  if (window.HansenAuthUI) return;

  var ID = 'hsn_auth_panel';
  var _tick = null, _left = 0;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function style() {
    if (document.getElementById('hsn_auth_css')) return;
    var css = [
      '#' + ID + '{position:fixed;inset:0;z-index:2147483645;display:none;align-items:flex-end;justify-content:center;background:rgba(2,6,23,.62)}',
      '#' + ID + '.on{display:flex}',
      '#' + ID + ' .au_card{width:100%;max-width:460px;background:linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%);',
      '  color:#e8eefc;border-radius:22px 22px 0 0;padding:20px 18px calc(24px + env(safe-area-inset-bottom,0px));',
      '  box-shadow:0 -8px 30px rgba(0,0,0,.4);max-height:92vh;overflow-y:auto}',
      '#' + ID + ' .au_hd{display:flex;align-items:center;margin-bottom:14px}',
      '#' + ID + ' .au_t{font-size:19px;font-weight:900;letter-spacing:.4px}',
      '#' + ID + ' .au_x{margin-left:auto;background:rgba(255,255,255,.12);color:#e8eefc;border:0;border-radius:50%;width:34px;height:34px;font-size:17px;font-weight:900;cursor:pointer}',
      '#' + ID + ' .au_x:disabled{opacity:.45;cursor:default}',
      '#' + ID + ' .au_tabs{display:flex;gap:8px;margin-bottom:14px}',
      '#' + ID + ' .au_tab{flex:1;background:rgba(255,255,255,.08);color:#cbd5e1;border:1px solid rgba(255,255,255,.12);',
      '  border-radius:12px;padding:10px 8px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer}',
      '#' + ID + ' .au_tab.on{background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;border-color:transparent}',
      '#' + ID + ' .au_row{margin-bottom:11px}',
      '#' + ID + ' .au_lb{font-size:12px;font-weight:800;opacity:.78;margin-bottom:5px}',
      '#' + ID + ' .au_in{width:100%;min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.18);',
      '  background:rgba(255,255,255,.07);color:#fff;font:inherit;font-size:16px;padding:10px 13px;outline:none}',
      '#' + ID + ' .au_in:focus{border-color:#818cf8}',
      '#' + ID + ' .au_code{display:flex;gap:8px}',
      '#' + ID + ' .au_code .au_in{flex:1}',
      '#' + ID + ' .au_send{flex:none;min-width:112px;border:0;border-radius:12px;background:rgba(255,255,255,.14);',
      '  color:#e8eefc;font:inherit;font-weight:800;font-size:13px;cursor:pointer;padding:0 12px}',
      '#' + ID + ' .au_send:disabled{opacity:.5;cursor:default}',
      '#' + ID + ' .au_go{width:100%;min-height:50px;border:0;border-radius:13px;background:linear-gradient(135deg,#4f46e5,#4338ca);',
      '  color:#fff;font:inherit;font-weight:900;font-size:15.5px;cursor:pointer;margin-top:6px}',
      '#' + ID + ' .au_go:disabled{opacity:.55;cursor:default}',
      '#' + ID + ' .au_msg{font-size:12.5px;line-height:1.6;margin-top:10px;min-height:18px;font-weight:700}',
      '#' + ID + ' .au_msg.err{color:#fca5a5}',
      '#' + ID + ' .au_msg.ok{color:#86efac}',
      '#' + ID + ' .au_skip{width:100%;background:none;border:0;color:#a5b4fc;font:inherit;font-weight:800;font-size:13px;cursor:pointer;margin-top:12px;padding:8px}',
      '#' + ID + ' .au_tip{font-size:11.5px;opacity:.62;line-height:1.65;margin-top:10px}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'hsn_auth_css'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  var mode = 'phone';   /* phone | password */
  var _syncState = null;
  var _cloudChoiceBusy = null;  /* {choice,uid,previous}：破坏性选择一次只允许一个 Promise */
  var _renderEpoch = 0;          /* 每次重绘/关闭作废所有旧 DOM 事件闭包 */
  var _cleanupReloadRequired = false;
  var _message = { text: '', kind: '' };

  function A() { return window.HansenAuth; }
  function panelOpen() {
    var el = document.getElementById(ID);
    return !!(el && el.classList && el.classList.contains('on'));
  }
  function notify() {
    try { document.dispatchEvent(new CustomEvent('hsn-auth-changed')); } catch (e) {}
  }
  function pad(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }
  function setMessage(text, kind) {
    _message = { text: text || '', kind: kind || '' };
    var el = document.getElementById('auMsg');
    if (el) {
      el.textContent = _message.text;
      el.className = 'au_msg' + (_message.kind ? ' ' + _message.kind : '');
    }
  }
  function pendingState() {
    var p = A() && A().readPending ? A().readPending() : {};
    return (p && p.verificationId) ? p : {};
  }
  function sessionBanner(st, marker) {
    if (!st) return '';
    if (st.state === 'checking')
      return '<div class="au_tip" style="color:#fde68a;opacity:1;margin:0 0 12px">正在向 CloudBase 核对真实会话，请稍候…</div>';
    if (st.state === 'unknown')
      return '<div class="au_tip" style="color:#fca5a5;opacity:1;margin:0 0 12px">当前无法确认旧会话，云端操作已暂停。可重试确认；若仍显示安全清理，请先退出未知会话再登录。本地学习进度不会删除。</div>';
    if (st.state === 'mismatch')
      return '<div class="au_tip" style="color:#fca5a5;opacity:1;margin:0 0 12px">本地账号与 SDK 会话不是同一用户，已禁止云端读写。请退出隐藏会话后重新登录。</div>';
    if (st.state === 'legacy_reauth' || (marker && marker.method && marker.signedAt && !marker.uid))
      return '<div class="au_tip" style="color:#fca5a5;opacity:1;margin:0 0 12px">旧版本没有留下可验证 UID。你的本地学习进度仍在，但账号必须重新验证。</div>';
    return '';
  }

  function syncChoices(uid) {
    var s = _syncState;
    if (!s || s.uid !== uid) return '';
    if (s.action === 'checking')
      return '<div class="au_tip" style="opacity:.9;color:#fde68a">正在只读检查云端是否有存档，不会自动覆盖任何一边。</div>';
    if (s.action === 'applying-cloud' || s.action === 'applying-local')
      return '<div class="au_tip" style="opacity:1;color:#fde68a">'
        + (s.action === 'applying-cloud' ? '正在恢复云端进度并复验当前账号…' : '正在上传本机进度并复验当前账号…')
        + '<br>操作完成前不能改选、稍后处理、关闭或退出。</div>';
    if (s.action === 'restored-awaiting-reload')
      return '<div class="au_tip" style="opacity:1;color:#86efac">云端进度已恢复到本机。请重新载入后再继续，避免旧页面内存覆盖新数据。</div>'
        + '<button class="au_go" id="auReload">重新载入并使用云端进度</button>';
    if (s.action === 'conflict' || s.action === 'restore-available' || s.action === 'upload-available') {
      var h = '<div class="au_tip" style="opacity:1;color:#fde68a">云存档需要你的明确选择。关闭、取消或点“稍后”都不会写入任何数据。</div>';
      if (s.action === 'conflict') {
        var l = s.local || {};
        h += '<div class="au_tip" style="opacity:.9">本机：' + (l.islands || 0) + ' 个岛，已学 ' + (l.learned || 0)
          + ' 个词；云端最后保存：' + esc(s.cloudUpdatedAt ? new Date(s.cloudUpdatedAt).toLocaleString() : '时间未知') + '。</div>';
      }
      if (s.action === 'conflict' || s.action === 'restore-available')
        h += '<button class="au_go" id="auKeepCloud" style="background:linear-gradient(135deg,#0369a1,#0ea5e9)">保留云端（将覆盖本机）</button>';
      if (s.action === 'conflict' || s.action === 'upload-available')
        h += '<button class="au_go" id="auKeepLocal" style="background:linear-gradient(135deg,#a16207,#f59e0b)">保留本机（将覆盖云端）</button>';
      h += '<button class="au_skip" id="auDefer">稍后处理（现在零写入）</button>';
      return h;
    }
    return '';
  }

  function signedHtml(marker) {
    var st = A().sessionStatus ? A().sessionStatus() : {};
    var applying = !!_cloudChoiceBusy;
    var disabled = applying ? ' disabled' : '';
    var storage = st.storageWarning
      ? '<br><span style="color:#fde68a">浏览器未能持久保存账号显示信息；当前 session 有效，刷新后会重新核对。</span>'
      : '';
    return '<div class="au_card"><div class="au_hd"><span class="au_t">👤 已登录</span>'
      + '<button class="au_x" id="auX" aria-label="关闭"' + disabled + '>✕</button></div>'
      + '<div class="au_tip" style="opacity:.9;font-size:13px">'
      + (marker.phone ? '手机号：' + esc(marker.phone) : (marker.username ? '用户名：' + esc(marker.username) : '账号 UID 已确认'))
      + '<br>CloudBase session UID 与本地 UID 已精确一致。' + storage + '</div>'
      + syncChoices(marker.uid)
      + '<button class="au_go" id="auPush" style="margin-top:14px"' + disabled + '>☁️ 明确上传本机进度</button>'
      + '<button class="au_skip" id="auOut"' + disabled + '>安全退出登录</button>'
      + '<div class="au_msg" id="auMsg"></div></div>';
  }

  function html() {
    var auth = A();
    var marker = auth && auth.readLocal ? auth.readLocal() : {};
    var st = auth && auth.sessionStatus ? auth.sessionStatus() : { state: 'signed_out' };
    if (auth && auth.isSignedIn && auth.isSignedIn()) return signedHtml(marker);

    var pending = pendingState();
    var known = !!pending.verificationId;
    var isNew = known && pending.isUser === false;
    var phoneValue = known && pending.phone ? String(pending.phone).replace(/^\+86\s*/, '') : '';
    var wait = known && pending.resendAt ? Math.max(0, Math.ceil((pending.resendAt - Date.now()) / 1000)) : 0;
    _left = wait;
    var op = auth && auth.operationStatus ? auth.operationStatus() : { busy: false, state: 'idle' };
    var busy = !!(op.busy || op.requiresCleanup || _cleanupReloadRequired);
    var banner = sessionBanner(st, marker);

    var h = '<div class="au_card"><div class="au_hd"><span class="au_t">🔐 登录 / 注册</span>'
      + '<button class="au_x" id="auX" aria-label="关闭">✕</button></div>' + banner
      + (st.state === 'unknown' || st.state === 'mismatch'
          ? '<button class="au_skip" id="auRetrySession" style="color:#fde68a">重新确认旧会话</button>' : '')
      + (st.state === 'unknown' || st.state === 'mismatch' || st.state === 'legacy_reauth' ||
          op.state === 'outcome_unknown' || op.requiresCleanup || _cleanupReloadRequired
          ? '<button class="au_go" id="auSafeOut" style="background:linear-gradient(135deg,#991b1b,#dc2626)">安全退出并清理会话</button>' : '')
      + (_cleanupReloadRequired
          ? '<button class="au_skip" id="auReloadCleanup" style="color:#fde68a">重新载入并再次核对服务器 session</button>'
            + '<div class="au_tip" style="color:#fecaca">若旧请求始终不结算：先导出本机备份，关闭本小程序的所有标签页，优先仅清除该站点的认证相关数据。若浏览器只能“清除全部站点数据”，它会删除本机学习进度，必须确认备份后再操作；系统不会靠 TTL 自动放行。</div>' : '')
      + '<div class="au_tabs">'
      + '<button class="au_tab' + (mode === 'phone' ? ' on' : '') + '" data-m="phone"' + (busy ? ' disabled' : '') + '>手机号继续</button>'
      + '<button class="au_tab' + (mode === 'password' ? ' on' : '') + '" data-m="password"' + (busy ? ' disabled' : '') + '>账号密码登录</button>'
      + '</div>';

    if (mode === 'phone') {
      h += '<div class="au_row"><div class="au_lb">手机号</div>'
        + '<input class="au_in" id="auPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="11 位手机号" maxlength="14" value="' + esc(phoneValue) + '"' + (known || busy ? ' readonly' : '') + '></div>';
      if (known && !busy)
        h += '<button class="au_skip" id="auChangePhone" style="margin-top:-6px">更换手机号（结束当前验证码事务）</button>';
      h += '<div class="au_row"><div class="au_lb">验证码</div><div class="au_code">'
        + '<input class="au_in" id="auCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="收到的数字" maxlength="8"' + (!known || busy ? ' disabled' : '') + '>'
        + '<button class="au_send" id="auSend"' + (wait > 0 || busy ? ' disabled' : '') + '>'
        + (wait > 0 ? (wait + ' 秒后重发') : (known ? '重新获取' : '获取验证码')) + '</button></div></div>';

      if (isNew) {
        h += '<div class="au_tip" style="opacity:.95;color:#fde68a;margin:2px 0 10px">这是新手机号。用户名和密码会在同一个 CloudBase v2 注册事务中设置。</div>'
          + '<div class="au_row"><div class="au_lb">创建用户名</div><input class="au_in" id="auNewUser" type="text" autocomplete="username" placeholder="字母/数字/-/_，1-32 位"' + (busy ? ' disabled' : '') + '></div>'
          + '<div class="au_row"><div class="au_lb">创建密码</div><input class="au_in" id="auNewPwd" type="password" autocomplete="new-password" placeholder="按云端密码策略设置"' + (busy ? ' disabled' : '') + '></div>'
          + '<div class="au_row"><div class="au_lb">确认密码</div><input class="au_in" id="auNewPwd2" type="password" autocomplete="new-password" placeholder="再输一次"' + (busy ? ' disabled' : '') + '></div>';
      }

      h += '<button class="au_go" id="auGo"' + (!known || busy ? ' disabled' : '') + '>'
        + (op.state === 'outcome_unknown' ? '登录结果待确认' : (isNew ? '验证并注册' : (known ? '验证并登录' : '请先获取验证码'))) + '</button>'
        + (op.state === 'outcome_unknown'
          ? '<button class="au_skip" id="auRecover" style="color:#fde68a">重新确认刚才的登录结果（不重复注册）</button>' : '')
        + '<div class="au_tip">sessionStorage 只暂存手机号、事务 ID、新老用户标志和时间；密码、短信码、verification token 永不落盘。</div>';
    } else {
      h += '<div class="au_row"><div class="au_lb">用户名</div><input class="au_in" id="auUser" type="text" autocomplete="username" placeholder="已存在的用户名"' + (busy ? ' disabled' : '') + '></div>'
        + '<div class="au_row"><div class="au_lb">密码</div><input class="au_in" id="auPwd" type="password" autocomplete="current-password" placeholder="账号密码"' + (busy ? ' disabled' : '') + '></div>'
        + '<button class="au_go" id="auGo"' + (busy ? ' disabled' : '') + '>' + (op.state === 'outcome_unknown' ? '登录结果待确认' : '登录') + '</button>'
        + (op.state === 'outcome_unknown'
          ? '<button class="au_skip" id="auRecover" style="color:#fde68a">重新确认刚才的登录结果（不重复登录）</button>' : '')
        + '<button class="au_skip" id="auUsePhone" style="color:#a5b4fc">第一次使用？请用手机号创建账号</button>'
        + '<div class="au_tip">这里仅登录已经通过受支持方式创建的账号，不提供虚假“无手机号直接注册”。</div>';
    }
    h += '<button class="au_skip" id="auSkip">先不登录，直接玩</button>'
      + '<div class="au_msg" id="auMsg"></div></div>';
    return h;
  }

  function host() {
    var el = document.getElementById(ID);
    if (el) return el;
    style();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '登录注册');
    (document.body || document.documentElement).appendChild(el);
    el.addEventListener('click', function (ev) {
      if (ev.target === el) close();
    });
    return el;
  }

  function armTimer() {
    if (_tick) { clearInterval(_tick); _tick = null; }
    function step() {
      var p = pendingState();
      var left = p.resendAt ? Math.max(0, Math.ceil((p.resendAt - Date.now()) / 1000)) : 0;
      _left = left;
      var b = document.getElementById('auSend');
      if (b) {
        var busy = A() && A().operationStatus && A().operationStatus().busy;
        b.disabled = left > 0 || !!busy;
        b.textContent = left > 0 ? (left + ' 秒后重发') : (p.verificationId ? '重新获取' : '获取验证码');
      }
      if (left <= 0 && _tick) { clearInterval(_tick); _tick = null; }
    }
    step();
    if (_left > 0) _tick = setInterval(step, 1000);
  }

  function finishPostLogin(base, post) {
    var auth = A();
    var marker = auth.readLocal ? auth.readLocal() : {};
    if (!base || !base.uid || marker.uid !== base.uid ||
        !auth.isSignedIn || !auth.isSignedIn() || (post && post.stale)) return;
    var sync = (post && post.sync) || { action: 'deferred' };
    _syncState = {};
    for (var k in sync) if (Object.prototype.hasOwnProperty.call(sync, k)) _syncState[k] = sync[k];
    _syncState.uid = base.uid;
    var idTxt = post && post.cid ? ' 竞赛 ID No.' + pad(post.cid)
      : (post && post.competitionIdUnavailable
        ? ' 云端竞赛 ID 尚未启用，不影响登录和本机游戏。'
        : (post && post.pendingId ? ' 竞赛 ID 等待服务端配置。' : ''));
    render();
    if (sync.action === 'conflict')
      setMessage('登录成功！' + idTxt + ' 云端和本机都有进度；默认不覆盖，请明确选择。', 'ok');
    else if (sync.action === 'restore-available')
      setMessage('登录成功！' + idTxt + ' 云端有存档；需要你明确选择是否恢复。', 'ok');
    else if (sync.action === 'upload-available')
      setMessage('登录成功！' + idTxt + ' 本机有进度；需要你明确选择是否上传。', 'ok');
    else if (sync.action === 'nothing-to-sync')
      setMessage('登录成功！' + idTxt + ' 当前没有需要同步的进度。', 'ok');
    else
      setMessage('登录成功！' + idTxt + ' 云存档暂未处理，本地进度仍然安全。', 'ok');
  }

  function acceptAuthResult(r) {
    var auth = A();
    var marker = auth.readLocal ? auth.readLocal() : {};
    if (!r || !r.ok || !r.uid || !auth.isSignedIn || !auth.isSignedIn() ||
        String(marker.uid || '') !== String(r.uid)) {
      _syncState = null;
      notify();
      render();
      setMessage('认证边界在成功展示前发生变化；本次不算登录成功，请安全退出并重新核对。', 'err');
      return false;
    }
    _syncState = { action: 'checking', uid: r.uid };
    notify();
    render();
    setMessage('真实 session UID 与共享认证边界均已确认，登录成功。正在只读检查云存档；不会自动覆盖。', 'ok');
    if (r.postLogin && typeof r.postLogin.then === 'function') {
      r.postLogin.then(function (post) { finishPostLogin(r, post); }, function () {
        finishPostLogin(r, {
          pendingId: false,
          competitionIdUnavailable: true,
          sync: { action: 'deferred' }
        });
      });
    }
    return true;
  }

  function chooseCloud(choice, uid) {
    if (_cloudChoiceBusy) {
      setMessage('云存档选择正在处理中，完成前不能重复提交或改成“稍后”。');
      return;
    }
    var label = choice === 'cloud' ? '云端进度将覆盖本机当前进度。' : '本机进度将覆盖云端当前存档。';
    if (!confirm(label + '\n\n这是不可自动撤销的操作。确定继续吗？')) {
      setMessage('已取消，双方数据都没有改动。', '');
      return;
    }
    var previous = _syncState;
    var token = { choice: choice, uid: uid, previous: previous };
    _cloudChoiceBusy = token;
    _syncState = { action: choice === 'cloud' ? 'applying-cloud' : 'applying-local', uid: uid };
    render();
    setMessage(choice === 'cloud' ? '正在恢复云端进度并复验账号…' : '正在上传本机进度并复验账号…');

    function sameRequest(){
      return _cloudChoiceBusy === token;
    }
    function sameAccount(){
      try {
        var auth = A(), marker = auth.readLocal ? auth.readLocal() : {};
        return !!(auth.isSignedIn && auth.isSignedIn() &&
          marker && String(marker.uid || '') === String(uid));
      } catch (e) { return false; }
    }
    function restoreChoices(){
      _syncState = sameAccount() ? previous : null;
    }

    return Promise.resolve().then(function(){
      return A().resolveCloudChoice(choice, uid);
    }).then(function (r) {
      if (!sameRequest()) return;
      _cloudChoiceBusy = null;
      if (!r || !r.ok) {
        restoreChoices();
        render();
        setMessage(r && r.stale ? '账号会话已变化，本次结果不再采用。' : ('操作没有完成：' + ((r && r.reason) || '未知原因')), 'err');
        return;
      }
      if (!sameAccount()) {
        _syncState = null;
        render();
        setMessage('账号会话已变化，本次界面结果不再采用。', 'err');
        return;
      }
      if (r.needReload) {
        _syncState = { action: 'restored-awaiting-reload', uid: uid };
        render();
        setMessage('云端进度已安全恢复；请重新载入后继续。', 'ok');
      } else {
        _syncState = { action: 'done', uid: uid };
        render();
        setMessage('本机进度已明确上传到云端。', 'ok');
      }
    }).catch(function (e) {
      if (!sameRequest()) return;
      _cloudChoiceBusy = null;
      restoreChoices();
      render();
      setMessage(A().friendly(e), 'err');
    });
  }

  function bind(epoch) {
    var el = document.getElementById(ID);
    if (!el) return;
    var auth = A();
    var q = function (id) { return document.getElementById(id); };
    function on(id, handler) {
      var node = q(id);
      if (!node) return;
      node.onclick = function (ev) {
        if (epoch !== _renderEpoch || node !== document.getElementById(id)) return;
        if (_cloudChoiceBusy) {
          setMessage('云存档选择正在处理中，完成前不能切换账号、关闭或执行其他操作。');
          return;
        }
        return handler.call(node, ev);
      };
    }
    function stillLive(id, node) {
      return epoch === _renderEpoch && node === document.getElementById(id);
    }

    on('auX', close);
    on('auSkip', close);
    on('auUsePhone', function () { mode = 'phone'; render(); });
    on('auRetrySession', function () {
      var node = this;
      setMessage('正在重新确认会话…');
      auth.refreshSession().then(function () {
        if (stillLive('auRetrySession', node)) render();
      });
    });
    on('auSafeOut', function () {
      if (_cloudChoiceBusy) {
        setMessage('云存档选择正在处理中，不能清理会话。');
        return;
      }
      if (!confirm('确认安全退出并清理当前服务器会话吗？本机学习进度会保留。')) return;
      this.disabled = true;
      _syncState = null;
      setMessage('正在安全退出并清理服务器会话…');
      auth.signOut().then(function (r) {
        _cleanupReloadRequired = !!(r && r.cleanupPending);
        render();
        notify();
        if (_cleanupReloadRequired)
          setMessage('本机已退出，但旧登录请求仍可能晚到。请重新载入并再次安全退出；若仍无法清理，请先导出本机备份、关闭所有相关标签页，优先仅清除认证相关数据。若只能清除全部站点数据，会删除本机学习进度；确认备份后再操作。完成前不要重新登录。', 'err');
        else
          setMessage('会话已安全清理，可以重新登录。', 'ok');
      }).catch(function (e) {
        render();
        setMessage('安全清理没有完成：' + auth.friendly(e), 'err');
      });
    });
    on('auReloadCleanup', function () { location.reload(); });
    on('auRecover', function () {
      var node = this;
      setMessage('正在确认刚才的结果；不会重复注册或登录…');
      auth.recoverAuthOutcome().then(function (r) {
        if (stillLive('auRecover', node)) acceptAuthResult(r);
      }).catch(function (e) {
        if (stillLive('auRecover', node)) setMessage(auth.friendly(e), 'err');
      });
    });
    on('auChangePhone', function () {
      if (auth.clearPending()) {
        _left = 0; render();
        setMessage('已结束旧验证码事务，可以输入新的手机号。');
      }
    });

    var tabs = el.querySelectorAll('.au_tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (node, m) {
        node.onclick = function () {
          if (epoch !== _renderEpoch || node !== document.querySelector('[data-m="' + m + '"]') ||
              _cloudChoiceBusy) return;
          mode = m; render();
        };
      })(tabs[i], tabs[i].getAttribute('data-m'));
    }

    on('auSend', function () {
      var node = this;
      var phone = (q('auPhone') || {}).value || '';
      setMessage('正在发送验证码…');
      node.disabled = true;
      auth.sendPhoneCode(phone).then(function (r) {
        if (!stillLive('auSend', node)) return;
        render();
        setMessage(r.isUser
          ? '验证码已发送。这个手机号已有账号，本次只登录。'
          : '验证码已发送。这是新手机号，请设置用户名和密码。', 'ok');
      }).catch(function (e) {
        if (!stillLive('auSend', node)) return;
        render();
        setMessage(auth.friendly(e), 'err');
      });
    });

    on('auGo', function () {
      var node = this;
      node.disabled = true;
      setMessage(mode === 'phone' ? '正在验证并确认同一 UID 的云端会话…' : '正在登录并确认同一 UID 的云端会话…');
      var task = mode === 'phone'
        ? auth.loginByPhoneCode((q('auCode') || {}).value || '', (q('auNewUser') || {}).value || '',
            (q('auNewPwd') || {}).value || '', (q('auNewPwd2') || {}).value || '')
        : auth.loginByPassword((q('auUser') || {}).value || '', (q('auPwd') || {}).value || '');
      task.then(function (r) {
        if (stillLive('auGo', node)) acceptAuthResult(r);
      }).catch(function (e) {
        if (!stillLive('auGo', node)) return;
        render();
        setMessage(auth.friendly(e), 'err');
      });
    });

    on('auKeepCloud', function () { chooseCloud('cloud', auth.readLocal().uid); });
    on('auKeepLocal', function () { chooseCloud('local', auth.readLocal().uid); });
    on('auDefer', function () {
      _syncState = { action: 'deferred-by-user', uid: auth.readLocal().uid };
      render();
      setMessage('已选择稍后处理；本机和云端都没有被改动。', 'ok');
    });
    on('auReload', function () { location.reload(); });

    /* 手动上传也复用同一个 applying 锁和 UID 复验，不能成为旁路。 */
    on('auPush', function () { chooseCloud('local', auth.readLocal().uid); });
    on('auOut', function () {
      setMessage('正在安全退出并核对服务器会话…');
      auth.signOut().then(function (r) {
        _syncState = null;
        _cleanupReloadRequired = !!(r && r.cleanupPending);
        render();
        notify();
        if (_cleanupReloadRequired)
          setMessage('本机已退出，但旧登录请求仍在收尾。请重新载入并再次安全退出；若仍未结算，请先导出本机备份、关闭所有相关标签页，优先仅清除认证相关数据。若只能清除全部站点数据，会删除本机学习进度；确认备份后再操作。', 'err');
        else
          setMessage('已安全退出。游戏本地进度仍保留。', 'ok');
      }).catch(function (e) {
        render();
        setMessage('退出没有完成：' + auth.friendly(e), 'err');
      });
    });
  }

  function render() {
    var el = host();
    var epoch = ++_renderEpoch;
    el.innerHTML = html();
    bind(epoch);
    armTimer();
    if (_message.text) setMessage(_message.text, _message.kind);
  }

  function open() {
    if (!window.HansenAuth || !HansenAuth.ready()) {
      alert('云服务还没配置好，暂时不能登录。');
      return;
    }
    render();
    host().classList.add('on');
    setMessage('正在核对真实云端会话…');
    HansenAuth.refreshSession().then(function () {
      if (panelOpen()) render();
    });
  }
  function close() {
    if (_cloudChoiceBusy) {
      setMessage('云存档选择正在处理中，完成前不能关闭。');
      return;
    }
    var el = document.getElementById(ID);
    if (el) el.classList.remove('on');
    _renderEpoch++;  /* 即使 DOM 尚未销毁，关闭也立即作废全部旧引用 */
    if (_tick) { clearInterval(_tick); _tick = null; }
  }

  try {
    document.addEventListener('hsn-auth-session', function () {
      if (panelOpen()) render();
    });
    document.addEventListener('hsn-auth-operation', function (ev) {
      if (panelOpen() && ev && ev.detail && ev.detail.slow)
        setMessage('服务器仍在处理本次认证，请勿重复提交或切换账号。');
    });
  } catch (e) {}

  window.HansenAuthUI = { open: open, close: close, _render: render };
})();
