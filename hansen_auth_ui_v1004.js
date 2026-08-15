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
  var _pwReg = false;   /* 🔴v1058: 用户名密码页签内的「登录/注册」开关 */

  function html() {
    var A = window.HansenAuth;
    var signed = A && A.isSignedIn && A.isSignedIn();
    if (signed) {
      var lc = A.readLocal();
      return '<div class="au_card"><div class="au_hd"><span class="au_t">👤 已登录</span>'
        + '<button class="au_x" id="auX" aria-label="关闭">✕</button></div>'
        + '<div class="au_tip" style="opacity:.9;font-size:13px">'
        + (lc.phone ? '手机号：' + esc(lc.phone) : (lc.username ? '用户名：' + esc(lc.username) : '账号已登录'))
        + '<br>你的进度会保存在云端，换设备登录同一个账号就能找回。</div>'
        + '<button class="au_go" id="auPush" style="margin-top:14px">☁️ 立即把进度存到云端</button>'
        + '<button class="au_skip" id="auOut">退出登录</button>'
        + '<div class="au_msg" id="auMsg"></div></div>';
    }
    var h = '<div class="au_card"><div class="au_hd"><span class="au_t">🔐 登录 / 注册</span>'
      + '<button class="au_x" id="auX" aria-label="关闭">✕</button></div>'
      + '<div class="au_tabs">'
      + '<button class="au_tab' + (mode === 'phone' ? ' on' : '') + '" data-m="phone">手机号</button>'
      + '<button class="au_tab' + (mode === 'password' ? ' on' : '') + '" data-m="password">用户名密码</button>'
      + '</div>';
    if (mode === 'phone') {
      h += '<div class="au_row"><div class="au_lb">手机号</div>'
        + '<input class="au_in" id="auPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="11 位手机号" maxlength="14"></div>'
        + '<div class="au_row"><div class="au_lb">验证码</div><div class="au_code">'
        + '<input class="au_in" id="auCode" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="收到的数字" maxlength="8">'
        + '<button class="au_send" id="auSend">获取验证码</button></div></div>'
        + '<button class="au_go" id="auGo">登录 / 注册</button>'
        + '<div class="au_tip">第一次用这个手机号 = 自动注册，不用另外填表。</div>';
    } else {
      /* 🔴v1058: 用户名密码支持**直接注册**（此前只能登录，必须先用手机号注册过）。
         登录/注册用一个开关切换，注册时多一个确认密码框。 */
      var reg = (mode === 'password' && _pwReg);
      h += '<div class="au_row"><div class="au_lb">用户名</div>'
        + '<input class="au_in" id="auUser" type="text" autocomplete="username" placeholder="3-20 个字，不含空格"></div>'
        + '<div class="au_row"><div class="au_lb">密码</div>'
        + '<input class="au_in" id="auPwd" type="password" autocomplete="' + (reg ? 'new-password' : 'current-password') + '" placeholder="至少 6 位"></div>'
        + (reg ? ('<div class="au_row"><div class="au_lb">确认密码</div>'
            + '<input class="au_in" id="auPwd2" type="password" autocomplete="new-password" placeholder="再输一次"></div>') : '')
        + '<button class="au_go" id="auGo">' + (reg ? '注册并登录' : '登录') + '</button>'
        + '<button class="au_skip" id="auPwToggle" style="color:#a5b4fc">'
        + (reg ? '已有账号？去登录' : '还没有账号？点这里注册') + '</button>'
        + '<div class="au_tip">' + (reg
            ? '用户名 3-20 个字，密码至少 6 位。注册后进度会存到云端，换设备用同一账号即可找回。'
            : '没有账号可以点上面直接注册，不需要手机号。') + '</div>';
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

    var tabs = el.querySelectorAll('.au_tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = (function (m) {
        return function () { mode = m; render(); };
      })(tabs[i].getAttribute('data-m'));
    }

    /* 发验证码 + 60 秒倒计时 */
    if (q('auSend')) q('auSend').onclick = function () {
      var btn = this;
      var phone = (q('auPhone') || {}).value || '';
      msg('正在发送…');
      btn.disabled = true;
      A.sendPhoneCode(phone).then(function (r) {
        msg(r.isUser ? '验证码已发送，收到后填进去登录' : '验证码已发送，填完即可完成注册', 'ok');
        _left = 60;
        if (_tick) clearInterval(_tick);
        _tick = setInterval(function () {
          _left--;
          var b = q('auSend');
          if (!b) { clearInterval(_tick); _tick = null; return; }
          if (_left <= 0) { clearInterval(_tick); _tick = null; b.disabled = false; b.textContent = '重新获取'; return; }
          b.textContent = _left + ' 秒后重发';
        }, 1000);
      }).catch(function (e) {
        msg(A.friendly(e), 'err');
        btn.disabled = false;
      });
    };

    /* 用户名密码：登录 ↔ 注册 切换 */
    if (q('auPwToggle')) q('auPwToggle').onclick = function () { _pwReg = !_pwReg; render(); };

    /* 登录 / 注册 */
    if (q('auGo')) q('auGo').onclick = function () {
      var btn = this;
      btn.disabled = true;
      msg('处理中…');
      var task;
      if (mode === 'phone') {
        task = A.loginByPhoneCode((q('auCode') || {}).value || '');
      } else if (_pwReg) {
        task = A.registerByPassword((q('auUser') || {}).value || '',
                                    (q('auPwd') || {}).value || '',
                                    (q('auPwd2') || {}).value || '');
      } else {
        task = A.loginByPassword((q('auUser') || {}).value || '', (q('auPwd') || {}).value || '');
      }
      task.then(function (r) {
        /* 🔴v1017: 把"进度对账"的结果如实说给用户, 冲突时让他自己选 */
        var idTxt = (r && r.cid) ? ' 竞赛 ID No.' + pad(r.cid) : (r && r.pendingId ? ' 竞赛 ID 稍后分配。' : '');
        var s = r && r.sync;
        var syncTxt = '';
        if (s) {
          if (s.action === 'restored') syncTxt = ' 已从云端找回你的全部进度，正在载入…';
          else if (s.action === 'uploaded') syncTxt = ' 进度已存到云端。';
          else if (s.action === 'conflict') syncTxt = ' 云端和本机都有进度，请选择保留哪一份。';
          else if (s.action === 'nothing-to-sync') syncTxt = ' 本机还没有进度，玩一会儿就会自动存到云端。';
          else if (s.action === 'cloud-unreachable') syncTxt = ' 暂时读不到云端，进度先留在本机，稍后会自动重试。';
          else if (s.action === 'restore-failed' || s.action === 'upload-failed') syncTxt = ' 进度同步没成功，可稍后手动同步。';
        }
        /* 🔴v1154：**自动用了云端要说一声，但不拦人。**
           用户不想每次点确定，但也不该"进度突然变了却不知道为什么"。
           所以：照常自动恢复、页面照常刷新，只是在提示条里带一句。 */
        if (s && s.autoPicked === 'cloud') {
          syncTxt = '，已自动取回云端进度（' + (s.cloudWords || 0) + ' 个单词）';
        }
        msg('登录成功！' + idTxt + syncTxt, 'ok');
        /* 🔴v1026: 恢复成功后必须重新加载页面, 否则内存里仍是旧数据,
           用户会看到"什么都没变", 且下一次存档会把恢复的进度覆盖掉 */
        if (s && s.needReload) {
          setTimeout(function () { try { location.reload(); } catch (e) {} }, 1200);
          return;
        }
        /* 🔴v1162：**这个选择框已经不该出现了。**

       BAT MAN 定的规则：注册那一次上传，之后登录一律云端覆盖本机。
       后端 `syncOnLogin` 从 v1162 起不再返回 'conflict' ——
       两边都有数据时直接恢复云端。

       这段代码留着当**兜底**：万一以后有人改回去、
       或者装了旧版的 auth 模块，用户至少还有得选，
       不会因为拿到一个没人处理的 action 而卡住。

       > 删掉一条分支和让它永远不触发，风险不一样。
       > 前者是"以后一定不会有"，后者是"现在不会有，将来有也不怕"。 */
    if (s && s.action === 'conflict') {
          setTimeout(function () {
            /* 🔴v1029: 把双方真实规模摆出来, 让用户看着数字选, 而不是盲选 */
            var L = (s.local || {});
            var cloudWhen = s.cloudUpdatedAt ? new Date(s.cloudUpdatedAt).toLocaleString() : '时间未知';
            /* 🔴v1156：**这是全项目最危险的一个对话框，不该用 confirm。**

               原来写成：
                 点「确定」= 用云端覆盖本机
                 点「取消」= 用本机覆盖云端

               `confirm` 只有两个按钮，而且**「取消」这个词的意思是
               "我不要做这件事"** —— 用户下意识点它想退出，
               结果触发的是"用本机覆盖云端"，**云端存档当场没了**。

               这类"两个都是破坏性操作"的选择，
               **必须给两个写清楚的按钮，外加一个真正的退出**。 */
            var CS = window.HansenCloudSave;
            if (!CS) return;
            pickProgress(L, cloudWhen, function (keepCloud) {
              if (keepCloud === null) return;          /* 用户选了"先不弄" */
            if (keepCloud) {
              CS.restoreWithKey(CS.ensureKey())
                .then(function(){ msg('已恢复云端进度，正在载入…', 'ok');
                  setTimeout(function(){ try{ location.reload(); }catch(e){} }, 1200); })
                .catch(function(e){ msg(A.friendly(e), 'err'); });
            } else {
              CS.syncNow({force:true})
                .then(function(){ msg('已用本机进度覆盖云端。', 'ok'); })
                .catch(function(e){ msg(A.friendly(e), 'err'); });
            }
            });
          }, 700);
        }
        setTimeout(function () { render(); notify(); }, 900);
      }).catch(function (e) {
        msg(A.friendly(e), 'err');
        btn.disabled = false;
      });
    };

    /* 已登录态：上传 / 退出 */
    if (q('auPush')) q('auPush').onclick = function () {
      var btn = this; btn.disabled = true; msg('正在上传…');
      A.pushSave().then(function (r) {
        if (r && r.ok) msg('已存到云端。换设备登录同一账号即可找回。', 'ok');
        else msg('上传没成功：' + ((r && r.reason) || '未知原因'), 'err');
        btn.disabled = false;
      }).catch(function (e) { msg(A.friendly(e), 'err'); btn.disabled = false; });
    };
    if (q('auOut')) q('auOut').onclick = function () {
      A.signOut().then(function () { render(); notify(); });
    };
  }

  function pad(n) { var s = String(n); while (s.length < 3) s = '0' + s; return s; }

  function notify() {
    try { document.dispatchEvent(new CustomEvent('hsn-auth-changed')); } catch (e) {}
  }

  /* 🔴v1156 选保留哪份进度 —— 两个都是破坏性操作，必须写清楚。

     原来用的是 `confirm`：确定=用云端覆盖本机，取消=用本机覆盖云端。
     **「取消」这个词的意思是"我不要做这件事"** ——
     用户下意识点它想退出，结果触发的是覆盖云端，存档当场没了。

     现在：两个按钮各自写明白"保留哪份、另一份会没",
     外加一个真正的"先不弄"。
     默认不预选任何一个 —— 这种事不该有默认答案。 */
  function pickProgress(local, cloudWhen, cb) {
    var done = false;
    var finish = function (v) {
      if (done) return;
      done = true;
      try { d.remove(); } catch (e) {}
      try { cb(v); } catch (e) {}
    };
    var esc2 = function (t) {
      return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
      });
    };
    var d = document.createElement('div');
    d.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483647;background:rgba(8,12,24,.95);' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'padding:22px;color:#e8eefc;overflow:auto;' +
      'font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
    d.innerHTML =
      '<div style="font-size:19px;font-weight:900;text-align:center">两边都有进度</div>' +
      '<div style="font-size:13.5px;color:#a9b4c7;margin-top:9px;text-align:center;' +
        'max-width:330px;line-height:1.8">' +
        '你要留下哪一份？<b style="color:#fca5a5">另一份会被覆盖掉，没法找回。</b></div>' +

      '<button id="hsnKeepLocal" style="margin-top:18px;width:100%;max-width:330px;' +
        'background:#1e293b;color:#fff;border:2px solid #4f46e5;border-radius:14px;' +
        'padding:14px 16px;text-align:left;cursor:pointer">' +
        '<div style="font-size:15px;font-weight:800">📱 留这台手机上的</div>' +
        '<div style="font-size:12.5px;color:#a9b4c7;margin-top:5px;line-height:1.7">' +
          esc2(local && local.islands || 0) + ' 个岛 · 已学 ' +
          esc2(local && local.learned || 0) + ' 个单词<br>' +
          '<span style="color:#fca5a5">云端那份会被覆盖</span></div>' +
      '</button>' +

      '<button id="hsnKeepCloud" style="margin-top:11px;width:100%;max-width:330px;' +
        'background:#1e293b;color:#fff;border:2px solid #4f46e5;border-radius:14px;' +
        'padding:14px 16px;text-align:left;cursor:pointer">' +
        '<div style="font-size:15px;font-weight:800">☁️ 留云端的</div>' +
        '<div style="font-size:12.5px;color:#a9b4c7;margin-top:5px;line-height:1.7">' +
          '最后保存于 ' + esc2(cloudWhen || '未知时间') + '<br>' +
          '<span style="color:#fca5a5">这台手机上的会被覆盖</span></div>' +
      '</button>' +

      '<button id="hsnKeepNone" style="margin-top:15px;background:transparent;color:#a9b4c7;' +
        'border:1px solid #3a4560;padding:10px 22px;border-radius:12px;' +
        'font-size:13.5px;cursor:pointer">先不弄，我再想想</button>' +
      '<div style="font-size:11.5px;color:#7c8798;margin-top:9px;text-align:center;' +
        'max-width:320px;line-height:1.7">不选也没关系，两份都还在，' +
        '下次登录还会问你。</div>';
    (document.body || document.documentElement).appendChild(d);
    var bl = document.getElementById('hsnKeepLocal');
    var bc = document.getElementById('hsnKeepCloud');
    var bn = document.getElementById('hsnKeepNone');
    if (bl) bl.onclick = function () { finish(false); };   /* 留本机 */
    if (bc) bc.onclick = function () { finish(true); };    /* 留云端 */
    if (bn) bn.onclick = function () { finish(null); };    /* 先不弄 */
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
