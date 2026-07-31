/* hansen_cloud_diag_v1027.js —— 云同步「逐环自检」诊断面板
 *
 * 为什么要有这个：开发环境连不上腾讯云，我无法端到端验证跨设备存档，
 * 已经连续几版靠推理修改而没能真正解决。与其继续盲改，不如把整条链路
 * 每一步的**真实结果**显示在用户设备上——一张截图就能定位断点。
 *
 * 打开方式：拼写大PK 页面内屏 → 长按标题 3 秒；或控制台 HansenCloudDiag.open()
 */
(function () {
  'use strict';
  if (window.HansenCloudDiag) return;

  var ID = 'hsn_diag';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function short(v, n) {
    var s = (typeof v === 'string') ? v : JSON.stringify(v);
    s = String(s == null ? '' : s);
    return s.length > (n || 90) ? s.slice(0, n || 90) + '…' : s;
  }

  /* 🔴v1059：诊断面板里凡是要显示错误的地方，一律走这里。
     此前 `'…：' + (i.reason || '')` 这种直接拼接，遇到 CloudBase 抛出的
     普通对象就变成 '[object Object]'——用户截图上看到的全是这个，
     真正的 {"error":"unauthenticated","error_description":"credentials not found"}
     被挡了 40 版。诊断面板存在的意义就是把现场显示出来，
     它自己却把最关键的一句吃掉了。 */
  function E(e) {
    try { if (window.HBErrText) return window.HBErrText(e); } catch (_) {}
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var v = e.error_description || e.errMsg || e.message || e.error || e.reason;
    if (v != null && typeof v !== 'object') return String(v);
    try { var j = JSON.stringify(e); if (j && j !== '{}') return j; } catch (_) {}
    return '(无法解析的错误对象)';
  }

  function style() {
    if (document.getElementById('hsn_diag_css')) return;
    var st = document.createElement('style');
    st.id = 'hsn_diag_css';
    st.textContent = [
      '#' + ID + '{position:fixed;inset:0;z-index:2147483600;display:none;overflow-y:auto;',
      '  background:#0b1020;color:#e8eefc;padding:16px 12px 40px;font-size:13px;line-height:1.55}',
      '#' + ID + '.on{display:block}',
      '#' + ID + ' h3{font-size:17px;font-weight:900;margin-bottom:4px}',
      '#' + ID + ' .d_sub{opacity:.7;font-size:12px;margin-bottom:14px}',
      '#' + ID + ' .d_row{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);',
      '  border-radius:10px;padding:10px 12px;margin-bottom:8px;word-break:break-all}',
      '#' + ID + ' .d_k{font-weight:800;font-size:12.5px;opacity:.85}',
      '#' + ID + ' .d_v{white-space:pre-wrap;margin-top:3px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}',
      '#' + ID + ' .ok{color:#86efac}  #' + ID + ' .bad{color:#fca5a5}  #' + ID + ' .warn{color:#fde68a}',
      '#' + ID + ' .d_btn{width:100%;min-height:46px;border:0;border-radius:12px;font:inherit;font-weight:900;',
      '  cursor:pointer;margin-top:10px;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff}',
      '#' + ID + ' .d_close{background:rgba(255,255,255,.14);color:#e8eefc}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  function row(k, v, cls) {
    return '<div class="d_row"><div class="d_k">' + esc(k) + '</div>'
      + '<div class="d_v ' + (cls || '') + '">' + esc(v) + '</div></div>';
  }

  function localProgressSummary() {
    var islands = 0, learned = 0, keys = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k) continue;
        keys++;
        if (k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.learned && o.learned.length) { islands++; learned += o.learned.length; }
        }
      }
    } catch (e) {}
    return { islands: islands, learned: learned, keys: keys };
  }

  function run() {
    var el = document.getElementById(ID);
    if (!el) return;
    var out = '<h3>☁️ 云同步自检</h3><div class="d_sub">把这一屏截图发给开发者即可定位问题</div>';
    var A = window.HansenAuth, CS = window.HansenCloudSave, B = window.HansenBackup;

    /* 1 模块是否到场 */
    out += row('① 模块到场', '账号=' + (!!A) + ' 云存档=' + (!!CS) + ' 备份=' + (!!B),
      (A && CS && B) ? 'ok' : 'bad');

    /* 2 云配置 */
    var env = '';
    try { env = (window.HANSEN_CLOUD_CONFIG || {}).envId || ''; } catch (e) {}
    out += row('② 云环境 envId', env || '(空)', env ? 'ok' : 'bad');

    /* 3 登录态 */
    var signed = false, lc = {};
    try { signed = A && A.isSignedIn(); lc = (A && A.readLocal()) || {}; } catch (e) {}
    out += row('③ 登录态', signed ? ('已登录 ' + (lc.phone || lc.username || '')) : '未登录',
      signed ? 'ok' : 'bad');

    /* 4 账号 uid 与推导密钥 */
    var uid = '', key = '';
    try { uid = CS && CS.accountUid ? CS.accountUid() : ''; } catch (e) {}
    try { key = CS && CS.ensureKey ? CS.ensureKey() : ''; } catch (e) {}
    /* 🔴v1047: 标识已改为以手机号为准(p:号码)，uid 仅兜底(u:xxx)。
       两台设备上这一行**必须完全相同**，不同就说明会各开各的柜子。 */
    out += row('④ 账号标识（两台设备必须一致）', uid || '(读不到——存档不会跟着账号走)', uid ? 'ok' : 'bad');
    out += row('⑤ 存档密钥', key || '(无)', uid ? 'ok' : 'warn');

    /* 🔴v1031: 本地标记 ≠ 云端会话仍在 —— 这一项专门戳破"以为登录着其实没有" */
    out += '<div class="d_row"><div class="d_k">③b 云端会话(真实探测)</div>'
      + '<div class="d_v warn" id="dSess">检测中…</div></div>';
    setTimeout(function () {
      var v = document.getElementById('dSess');
      if (!v) return;
      if (!A || typeof A.verifySession !== 'function') { v.textContent = '(旧版本，无此探测)'; return; }
      A.verifySession().then(function (s) {
        v.textContent = s.ok
          ? ('✅ 有效 uid=' + s.uid + (s.tries > 1 ? '（重试 ' + s.tries + ' 次后就绪）' : ''))
          : (s.notReady
              ? ('⏳ ' + (s.reason || '云端会话尚未就绪') + ' —— 请稍候再试，不必重新登录')
              : ('❌ 云端会话已失效 ' + (s.reason || '') + ' —— 读写会失败，请退出后重新登录'));
        v.className = 'd_v ' + (s.ok ? 'ok' : 'bad');
      }).catch(function (e) { v.textContent = '探测出错：' + short(e && e.message || e, 90); v.className = 'd_v bad'; });
    }, 60);

    /* 5 本机进度 */
    var lp = localProgressSummary();
    out += row('⑥ 本机进度', '岛屿 ' + lp.islands + ' 个 · 已学 ' + lp.learned + ' 词 · 存储键 ' + lp.keys + ' 个',
      lp.learned > 0 ? 'ok' : 'warn');

    /* 6 备份能否打包（v1019 曾发现这里长期抛错） */
    var backupN = -1, backupErr = '';
    try {
      var b = B && B.build ? B.build() : null;
      backupN = (b && b.items) ? Object.keys(b.items).length : -1;
    } catch (e) { backupErr = String(e && e.message || e); }
    out += row('⑦ 备份打包', backupErr ? ('失败：' + short(backupErr, 120)) : ('成功，收录 ' + backupN + ' 个键'),
      backupErr ? 'bad' : 'ok');

    /* 7 上次同步时间 */
    var st = {};
    try { st = JSON.parse(localStorage.getItem('hansen_cloud_state_v965') || '{}') || {}; } catch (e) {}
    out += row('⑧ 上次上传', st.lastUpAt ? new Date(st.lastUpAt).toLocaleString() : '(从未上传过)',
      st.lastUpAt ? 'ok' : 'bad');
    out += row('⑨ 自动同步开关', st.enabled ? '已开启' : '未开启（不会自动上传）', st.enabled ? 'ok' : 'warn');

    /* 🔴v1043 最关键的一项：直接问云端"你那儿到底有没有我的存档"。
       此前面板只显示 ⑧「上次上传」——那是**本机记录**，
       在 v1039 之前"跳过写入却返回成功"的情况下，本机会记下时间而云端其实空空。
       所以必须真去云端查一次，这一项才是判断"该上传还是该拉取"的唯一依据。 */
    out += '<div class="d_row"><div class="d_k">⑩ 云端是否已有你的存档（真查）</div>'
      + '<div class="d_v warn" id="dCloud">查询中…</div></div>';
    setTimeout(function () {
      var v = document.getElementById('dCloud');
      if (!v) return;
      if (!CS || typeof CS.accountCloudInfo !== 'function') { v.textContent = '(旧版本，无此查询)'; return; }
      CS.accountCloudInfo().then(function (i) {
        if (!i) { v.textContent = '查询无结果'; v.className = 'd_v bad'; return; }
        if (i.exists === true) {
          var t = i.updatedAt ? new Date(i.updatedAt).toLocaleString() : '时间未知';
          v.textContent = '✅ 有存档，最后保存于 ' + t + '\n → 在新设备上点「⬇ 从云端拉取一次」即可恢复';
          v.className = 'd_v ok';
        } else if (i.exists === false) {
          v.textContent = '❌ 云端还没有你的存档\n → 请到**有进度的那台设备**上点「▶ 立刻上传一次」\n   （在空设备上拉取永远不会成功，因为云端确实是空的）';
          v.className = 'd_v bad';
        } else {
          v.textContent = '⚠️ 查不到（网络或权限）：' + (E(i.reason) || '(无错误信息)');
          v.className = 'd_v warn';
        }
      }).catch(function (e) { v.textContent = '查询出错：' + short(E(e), 160); v.className = 'd_v bad'; });
    }, 120);

    el.innerHTML = out
      + '<button class="d_btn" id="dTest">▶ 实测：立刻上传一次</button>'
      + '<button class="d_btn" id="dPull">⬇ 实测：从云端拉取一次</button>'
      + '<button class="d_btn" id="dRT" style="background:linear-gradient(135deg,#0ea5e9,#0369a1)">🔁 一键往返自检（推荐先点这个）</button>'
      + '<button class="d_btn d_close" id="dClose">关闭</button>'
      + '<div class="d_row" id="dOut" style="margin-top:12px"><div class="d_k">实测结果</div>'
      + '<div class="d_v" id="dOutV">（点上面的按钮）</div></div>';

    var say = function (t, cls) {
      var v = document.getElementById('dOutV');
      if (v) { v.textContent = t; v.className = 'd_v ' + (cls || ''); }
    };
    document.getElementById('dClose').onclick = close;
    /* 🔴v1037 往返自检：写→立刻读回，把问题定位到 地址/身份/权限 三者之一 */
    var rt = document.getElementById('dRT');
    if (rt) rt.onclick = function () {
      say('往返测试中…');
      if (!CS || typeof CS.roundTrip !== 'function') { say('请先更新到 v1037 以上版本', 'bad'); return; }
      CS.roundTrip().then(function (r) {
        var lines = [];
        lines.push('环境: ' + (r.envId || '(空)'));
        lines.push('密钥: ' + (r.key || '(无)'));
        lines.push('地址: ' + (r.docId || '(无)'));
        lines.push('写入: ' + (r.wrote === true ? '成功 ✔' : '失败 ✘'));
        lines.push('读回: ' + (r.readBack === true ? '成功 ✔' : (r.readBack === false ? '失败 ✘（写进去了但读不回）' : '未执行')));
        if (r.error) lines.push('原始错误: ' + E(r.error));
        var verdict;
        if (r.step === 'ok') verdict = '【结论】通道完全正常。既然写完能立刻读回，说明你的存档是「从来没被写进去过」，问题不在读取。';
        else if (r.step === 'wrote-but-cannot-read') verdict =
            '【结论】写进去了却读不回。\n\n'
          + '文档确实建出来了，但数据库权限规则判定「这不是你的数据」，\n'
          + '于是返回空结果（所以不报错，只是读不到）。\n\n'
          + '【请这样修，一次就好】\n'
          + '腾讯云控制台 → 文档型数据库 → 集合 hansen_saves\n'
          + '→ 权限设置 → 改为「读取全部数据，修改本人数据」\n'
          + '（改完等约 1 分钟生效，再回来点一次本自检）\n\n'
          + '为什么这样安全：存档内容是加密的，密钥由你的账号推导；\n'
          + '文档地址也是哈希值。别人即便读到也解不开。';
        else if (r.step === 'write-failed') verdict = '【结论】连写都失败 —— 是权限或登录会话问题，看上面的原始错误。';
        else verdict = '【结论】' + r.step;
        lines.push('');
        lines.push(verdict);
        say(lines.join('\n'), r.step === 'ok' ? 'ok' : 'bad');
      }).catch(function (e) { say('往返测试异常：' + short(e && e.message || e, 200), 'bad'); });
    };
    document.getElementById('dTest').onclick = function () {
      say('上传中…');
      if (!CS || !CS.syncNow) { say('云存档模块不可用', 'bad'); return; }
      CS.syncNow({ force: true }).then(function (r) {
        say(r && r.ok ? ('上传成功 ✔ ' + short(r, 120)) : ('上传未成功：' + short(r, 160)),
          (r && r.ok) ? 'ok' : 'bad');
        setTimeout(run, 1200);
      }).catch(function (e) { say('上传报错：' + short(e && e.message || e, 200), 'bad'); });
    };
    document.getElementById('dPull').onclick = function () {
      say('拉取中…');
      if (!CS || !CS.restoreWithKey) { say('云存档模块不可用', 'bad'); return; }
      CS.restoreWithKey(CS.ensureKey()).then(function (r) {
        say(r && r.ok ? '拉取成功 ✔ 关闭后请重新进入页面查看' : ('拉取未成功：' + short(r, 160)),
          (r && r.ok) ? 'ok' : 'bad');
      }).catch(function (e) { say('拉取报错：' + short(e && e.message || e, 200), 'bad'); });
    };
  }

  function host() {
    var el = document.getElementById(ID);
    if (el) return el;
    style();
    el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }
  function open() { host(); run(); document.getElementById(ID).classList.add('on'); }
  function close() { var el = document.getElementById(ID); if (el) el.classList.remove('on'); }

  window.HansenCloudDiag = { open: open, close: close, run: run };
})();
