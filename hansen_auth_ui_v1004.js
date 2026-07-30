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
  var _phoneState = null;

  function html() {
    var A = window.HansenAuth;
    var signed = A && A.isSignedIn && A.isSignedIn();
    if (signed) {
      var lc = A.readLocal();
      return '<div class="au_card"><div class="au_hd"><span class="au_t">👤 已登录</span>'
        + '<button class="au_x" id="auX" aria-label="关闭">✕</button></div>'
        + '<div class="au_tip" style="opacity:.9;font-size:13px">'
        + (lc.phone ? '手机号：' + esc(lc.phone) : (lc.username ? '用户名：' + esc(lc.username) : '账号已登录'))
        + '<br>真实云端会话已确认。学习进度会在后台同步，失败时本机进度仍保留。</div>'
        + '<button class="au_go" id="auPush" style="margin-top:14px">☁️ 立即把进度存到云端</button>'
        + '<button class="au_skip" id="auOut">退出登录</button>'
        + '<div class="au_msg" id="auMsg"></div></div>';
    }

    var pending = (A && A.readPending) ? A.readPending() : {};
    if (pending && pending.verificationId) _phoneState = pending;
    var known = !!(_phoneState && _phoneState.verificationId);
    var isNew = known && _phoneState.isUser === false;
    var rawPhone = (known && _phoneState.phone) ? String(_phoneState.phone).replace(/^\+86\s*/, '') : '';
    var legacy = A && A.needsReauth && A.needsReauth();

    var h = '<div class="au_card"><div class="au_hd"><span class="au_t">🔐 登录 / 注册</span>'
      + '<button class="au_x" id="auX" aria-label="关闭">✕</button></div>'
      + (legacy
          ? '<div class="au_tip" style="color:#fca5a5;opacity:1;margin:0 0 12px">旧版本没有完成真实云端登录。你的本地学习进度仍在，请重新登录或用手机号创建真实账号。</div>'
          : '')
      + '<div class="au_tabs">'
      + '<button class="au_tab' + (mode === 'phone' ? ' on' : '') + '" data-m="phone">手机号继续</button>'
      + '<button class="au_tab' + (mode === 'password' ? ' on' : '') + '" data-m="password">账号密码登录</button>'
      + '</div>';

    if (mode === 'phone') {
      h += '<div class="au_row"><div class="au_lb">手机号</div>'
        + '<input class="au_in" id="auPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="11 位手机号" maxlength="14" value="' + esc(rawPhone) + '"></div>'
        + '<div class="au_row"><div class="au_lb">验证码</div><div class="au_code">'
        + '<input class="au_in" id="auCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="收到的数字" maxlength="8">'
        + '<button class="au_send" id="auSend"' + (_left > 0 ? ' disabled' : '') + '>'
        + (_left > 0 ? (_left + ' 秒后重发') : (known ? '重新获取' : '获取验证码')) + '</button></div></div>';

      if (isNew) {
        h += '<div class="au_tip" style="opacity:.95;color:#fde68a;margin:2px 0 10px">这是新手机号。请创建用户名和密码；注册成功后可以用手机号或用户名登录同一个账号。</div>'
          + '<div class="au_row"><div class="au_lb">创建用户名</div>'
          + '<input class="au_in" id="auNewUser" type="text" autocomplete="username" placeholder="字母/数字/-/_，1-32 位"></div>'
          + '<div class="au_row"><div class="au_lb">创建密码</div>'
          + '<input class="au_in" id="auNewPwd" type="password" autocomplete="new-password" placeholder="至少 6 位"></div>'
          + '<div class="au_row"><div class="au_lb">确认密码</div>'
          + '<input class="au_in" id="auNewPwd2" type="password" autocomplete="new-password" placeholder="再输一次"></div>';
      }

      h += '<button class="au_go" id="auGo">'
        + (isNew ? '验证并注册' : (known ? '验证并登录' : '请先获取验证码')) + '</button>'
        + '<div class="au_tip">'
        + (isNew
            ? '验证码、密码和验证凭证都不会写入本地存储。'
            : (known
                ? '这个手机号已有账号；本次只登录，不会重复注册。'
                : '第一次使用会在收到验证码后显示创建账号信息；已有账号直接验证登录。'))
        + '</div>';
    } else {
      h += '<div class="au_row"><div class="au_lb">用户名</div>'
        + '<input class="au_in" id="auUser" type="text" autocomplete="username" placeholder="已绑定的用户名"></div>'
        + '<div class="au_row"><div class="au_lb">密码</div>'
        + '<input class="au_in" id="auPwd" type="password" autocomplete="current-password" placeholder="至少 6 位"></div>'
        + '<button class="au_go" id="auGo">登录</button>'
        + '<button class="au_skip" id="auUsePhone" style="color:#a5b4fc">第一次使用？请用手机号创建账号</button>'
        + '<div class="au_tip">CloudBase 不支持直接用用户名注册。这里仅登录已经通过手机号真实创建并设置过用户名、密码的账号。</div>';
    }
    h += '<button class="au_skip" id="auSkip">先不登录，直接玩</button>'
      + '<div class="au_msg" id="auMsg"></div></div>';
    return h;
  }

  function msg(text, kind) {
    var el = document.getElementById('auMsg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'au_msg' + (kind ? ' ' + kind : '');
  }

  function mergeResult(a, b) {
    var out = {}, k;
    for (k in (a || {})) if (Object.prototype.hasOwnProperty.call(a, k) && k !== 'postLogin') out[k] = a[k];
    for (k in (b || {})) if (Object.prototype.hasOwnProperty.call(b, k)) out[k] = b[k];
    return out;
  }

  function finishPostLogin(base, post) {
    var r = mergeResult(base, post);
    if (r.stale) return;
    var A = window.HansenAuth;
    var idTxt = r.cid ? ' 竞赛 ID No.' + pad(r.cid) : (r.pendingId ? ' 竞赛 ID 稍后分配。' : '');
    var s = r.sync;
    var syncTxt = '';
    if (s) {
      if (s.action === 'restored') syncTxt = ' 已从云端找回全部进度，正在载入…';
      else if (s.action === 'uploaded') syncTxt = ' 进度已存到云端。';
      else if (s.action === 'conflict') syncTxt = ' 云端和本机都有进度，请选择保留哪一份。';
      else if (s.action === 'nothing-to-sync') syncTxt = ' 本机还没有进度，之后会自动同步。';
      else if (s.action === 'cloud-unreachable' || s.action === 'deferred')
        syncTxt = ' 已登录；云存档暂未同步，本地进度仍然安全。';
      else if (s.action === 'restore-failed' || s.action === 'upload-failed')
        syncTxt = ' 已登录；进度同步没成功，可稍后手动重试。';
    }
    msg('登录成功！' + idTxt + syncTxt, 'ok');

    if (s && s.needReload) {
      setTimeout(function () { try { location.reload(); } catch (e) {} }, 1200);
      return;
    }
    if (s && s.action === 'conflict') {
      setTimeout(function () {
        var L = s.local || {};
        var cloudWhen = s.cloudUpdatedAt ? new Date(s.cloudUpdatedAt).toLocaleString() : '时间未知';
        var keepCloud = confirm(
          '这个账号在云端已有进度，本机也有进度，需要你选一份保留：\n\n' +
          '【本机】' + (L.islands || 0) + ' 个岛 · 已学 ' + (L.learned || 0) + ' 个单词\n' +
          '【云端】最后保存于 ' + cloudWhen + '\n\n' +
          '点「确定」= 用云端覆盖本机\n' +
          '点「取消」= 用本机覆盖云端\n\n' +
          '（另一份会被替换，请对照上面的数字想清楚）');
        var CS = window.HansenCloudSave;
        if (!CS) return;
        if (keepCloud) {
          CS.restoreWithKey(CS.ensureKey())
            .then(function () {
              msg('已恢复云端进度，正在载入…', 'ok');
              setTimeout(function () { try { location.reload(); } catch (e) {} }, 1200);
            })
            .catch(function (e) { msg(A.friendly(e), 'err'); });
        } else {
          CS.syncNow({ force: true })
            .then(function () { msg('已用本机进度覆盖云端。', 'ok'); })
            .catch(function (e) { msg(A.friendly(e), 'err'); });
        }
      }, 300);
    }
  }

  function acceptAuthResult(r) {
    notify();
    msg('登录成功！正在后台检查云存档；你现在已经可以继续游戏。', 'ok');
    setTimeout(function () { render(); }, 500);
    if (r && r.postLogin && typeof r.postLogin.then === 'function') {
      r.postLogin.then(function (post) {
        finishPostLogin(r, post);
      }, function () {
        finishPostLogin(r, {
          sync: { ok: false, action: 'deferred' },
          pendingId: true
        });
      });
    } else {
      finishPostLogin(r || {}, {});
    }
  }

  function startSendTimer() {
    _left = 60;
    if (_tick) clearInterval(_tick);
    _tick = setInterval(function () {
      _left--;
      var b = document.getElementById('auSend');
      if (!b) return;
      if (_left <= 0) {
        clearInterval(_tick);
        _tick = null;
        b.disabled = false;
        b.textContent = '重新获取';
        return;
      }
      b.disabled = true;
      b.textContent = _left + ' 秒后重发';
    }, 1000);
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
    el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
    return el;
  }

  function bind() {
    var el = document.getElementById(ID);
    if (!el) return;
    var A = window.HansenAuth;
    var q = function (id) { return document.getElementById(id); };

    if (q('auX')) q('auX').onclick = close;
    if (q('auSkip')) q('auSkip').onclick = close;
    if (q('auUsePhone')) q('auUsePhone').onclick = function () { mode = 'phone'; render(); };

    var tabs = el.querySelectorAll('.au_tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = (function (m) {
        return function () { mode = m; render(); };
      })(tabs[i].getAttribute('data-m'));
    }

    if (q('auSend')) q('auSend').onclick = function () {
      var btn = this;
      var phone = (q('auPhone') || {}).value || '';
      msg('正在发送验证码…');
      btn.disabled = true;
      A.sendPhoneCode(phone).then(function (r) {
        _phoneState = A.readPending ? A.readPending() : {
          verificationId: 'sent',
          phone: r.phone,
          isUser: r.isUser
        };
        startSendTimer();
        render();
        msg(r.isUser
          ? '验证码已发送。这个手机号已有账号，输入后登录。'
          : '验证码已发送。这是新手机号，请同时创建用户名和密码。', 'ok');
      }).catch(function (e) {
        msg(A.friendly(e), 'err');
        btn.disabled = false;
      });
    };

    if (q('auGo')) q('auGo').onclick = function () {
      var btn = this;
      btn.disabled = true;
      msg(mode === 'phone' ? '正在验证并确认云端会话…' : '正在登录并确认云端会话…');
      var task;
      if (mode === 'phone') {
        task = A.loginByPhoneCode(
          (q('auCode') || {}).value || '',
          (q('auNewUser') || {}).value || '',
          (q('auNewPwd') || {}).value || '',
          (q('auNewPwd2') || {}).value || ''
        );
      } else {
        task = A.loginByPassword(
          (q('auUser') || {}).value || '',
          (q('auPwd') || {}).value || ''
        );
      }
      task.then(acceptAuthResult).catch(function (e) {
        var text = A.friendly(e);
        var p = A.readPending ? A.readPending() : {};
        if (mode === 'phone' && (!p || !p.verificationId)) {
          _phoneState = null;
          render();
        }
        msg(text, 'err');
        var live = q('auGo');
        if (live) live.disabled = false;
      });
    };

    if (q('auPush')) q('auPush').onclick = function () {
      var btn = this;
      btn.disabled = true;
      msg('正在上传…');
      A.pushSave().then(function (r) {
        if (r && r.ok) msg('已存到云端。换设备登录同一账号即可找回。', 'ok');
        else msg('上传没成功：' + ((r && r.reason) || '未知原因'), 'err');
        btn.disabled = false;
      }).catch(function (e) {
        msg(A.friendly(e), 'err');
        btn.disabled = false;
      });
    };
    if (q('auOut')) q('auOut').onclick = function () {
      A.signOut().then(function () {
        _phoneState = null;
        render();
        notify();
      });
    };
  }

  function pad(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }

  function notify() {
    try { document.dispatchEvent(new CustomEvent('hsn-auth-changed')); } catch (e) {}
  }

  function render() {
    var el = host();
    el.innerHTML = html();
    bind();
  }

  function open() {
    if (!window.HansenAuth || !HansenAuth.ready()) {
      alert('云服务还没配置好，暂时不能登录。');
      return;
    }
    render();
    host().classList.add('on');
  }
  function close() {
    var el = document.getElementById(ID);
    if (el) el.classList.remove('on');
    if (_tick) { clearInterval(_tick); _tick = null; }
  }

  window.HansenAuthUI = { open: open, close: close, _render: render };
})();
