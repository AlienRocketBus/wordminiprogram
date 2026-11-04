/* hansen_auth_v1004.js —— 账号系统：注册 / 登录 / 跨设备存档 / 竞赛 ID 发号
 *
 * 登录方式（对应控制台已开通的三种）：
 *   ① 手机号 + 短信验证码   —— 主力，注册与登录合一（is_user 判断走 signUp 还是 signIn）
 *   ② 用户名 + 密码         —— 备用
 *   ③ 匿名                  —— 不注册也能玩，之后可升级为正式账号
 *
 * 竞赛 ID 发号方案（不依赖云函数）：
 *   counters 集合设为 ADMINONLY，客户端写不了，所以**不走计数器**。
 *   改用「注册时间排名」：sb_profile 里 createdAt 由**服务端**写入（客户端伪造不了），
 *   竞赛 ID = 比我早注册的人数 + 1。一次算定后锁死，此后终身不变。
 */
(function () {
  'use strict';
  if (window.HansenAuth) return;

  var COL_PROFILE = 'sb_profile';
  var LKEY = 'hansen_auth_v1004';      /* 本地登录态缓存 */

  /* ── 基础 ─────────────────────────────────────────── */
  function cfg() {
    try {
      var c = window.HANSEN_CLOUD_CONFIG;
      return (c && typeof c === 'object' && c.envId) ? c : null;
    } catch (e) { return null; }
  }
  function ready() { return !!cfg(); }

  /* ── 🔴v1132 安全扫描 localStorage ──────────────────────────

     **绝不边遍历边读。**

     `localStorage.key(i)` 按索引取键，而这个页面上同时跑着
     凭证守护、心跳、版本守望者 —— 它们随时会写/删键。
     **集合一变动索引就错位，正好跳过某一格。**

     实际后果：登录成功了却扫不到凭证键 → 不写本地登录态 →
     界面显示未登录。跑得快没事、跑得慢就出问题，所以表现为"随机"。
     （`test_phone_signup` 随机红了很久，追了两轮才定位到这里。）

     做法：先把键名收成数组，再遍历数组。
     数组是快照，之后集合怎么变都不影响这一轮扫描。 */
  function lsKeys() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  function readLocal() {
    try {
      var o = JSON.parse(localStorage.getItem(LKEY));
      return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {};
    } catch (e) { return {}; }
  }
  /* 🔴v1154：**登录态只有这一个出口 —— 把"账号变了"的信号挂在这里。**

     这一整轮反复吃的亏是同一个：**我修的东西只修了一条路径。**
       · v1134「数据一变就同步」—— 钩子被盖、开关是关的、防抖被饿死，
         写了 20 版从没真正生效
       · v1142「换账号清资料」—— 只挂在"点退出登录"上，
         而直接登另一个账号、注册后自动登录、云端同步登录态都不走那条路

     用户现场就是后面这几条：「同一设备换账号，ID 还是原来那个，也改不了名」。

     所以这次不去数"有几条路径"，而是**盯住唯一的那个出口**：
     `writeLocal` 是全站改登录态的独苗（全站搜过，没有第二处）。
     只要 uid 变了就在这里发信号，**不管调用方是谁、走的哪条路**。

     > 与其把每条路都堵一遍（总会漏），不如守住必经之地。 */
  /* 🔴v1164（审查 AUTH-2）：这一个浏览器标签页的编号。同一个标签页里的几层页面（首页外壳 + 岛 iframe）
     共用一个 window.top，所以编号一样；另一个标签页是另一份内存，编号不同。
     写登录记录时带上它，别的页面收到 storage 通知时就分得清「是别的标签页改的」还是「我自己这页里的岛改的」。 */
  function tabId() {
    var mk = function () { return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
    try {
      var t = window.top;
      if (!t.__hsnTabId) t.__hsnTabId = mk();
      return t.__hsnTabId;
    } catch (e) {
      if (!window.__hsnTabId) window.__hsnTabId = mk();
      return window.__hsnTabId;
    }
  }
  function writeLocal(patch) {
    var o = readLocal();
    var _before = o.uid || '';
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    o._tab = tabId();
    try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) {}
    var _after = o.uid || '';
    if (_before !== _after) {
      try {
        document.dispatchEvent(new CustomEvent('hsn-account-uid-changed',
          { detail: { from: _before, to: _after } }));
      } catch (e) {}
    }
    return o;
  }

  /* 🔴v1059 关键修复：把云端错误变成人能读的字。
     整整 40 个版本里，每一条诊断都只显示 `[object Object]`——
     因为 CloudBase 抛出的是一个**普通对象**：
       {"error":"unauthenticated","error_description":"credentials not found"}
     它既不是 Error 实例、也没有 .message，于是 String(e) 退化成 '[object Object]'。
     真正的错因（credentials not found）被这层遮罩挡了 40 版，
     导致每一轮排查都只能靠推理，改对了六七个真 bug 却始终没碰到真凶。
     本函数按优先级逐层挖字段，最后兜底 JSON.stringify，
     **保证今后任何地方都不会再吐出 [object Object]**。 */
  function errText(e) {
    if (e == null) return '';
    if (typeof e === 'string') return e;
    var parts = [];
    var pick = ['error_description', 'errMsg', 'message', 'error', 'code', 'errCode', 'reason'];
    for (var i = 0; i < pick.length; i++) {
      var v = e[pick[i]];
      if (v != null && typeof v !== 'object') {
        var s = String(v);
        if (s && parts.indexOf(s) < 0) parts.push(s);
      }
    }
    if (parts.length) return parts.join(' | ');
    try { var j = JSON.stringify(e); if (j && j !== '{}' && j !== 'null') return j; } catch (_) {}
    try {
      var t = Object.prototype.toString.call(e);
      if (t !== '[object Object]') return t;
    } catch (_) {}
    return '(无法解析的错误对象)';
  }
  /* 立刻挂全局：云存档/恢复/诊断都可能先于本模块用到，取不到时各自有兜底 */
  try { window.HBErrText = errText; } catch (e) {}

  /* 归一手机号：11 位国内号 → +86 前缀 */
  function normPhone(raw) {
    var s = String(raw == null ? '' : raw).replace(/[\s\-()]/g, '');
    if (/^1\d{10}$/.test(s)) return '+86 ' + s;
    if (/^\+86\d{11}$/.test(s)) return '+86 ' + s.slice(3);
    if (/^\+\d{6,15}$/.test(s)) return s;
    return null;
  }

  /* ── 🔴v1164 会话判定用的小工具 ─────────────────────────
     SDK 2.30.0 的事实（读源码 + 模拟云端实测）：
       · getLoginState() 几乎从不抛错，没会话一律给 null；
       · uid 只来自本机缓存 user_info_<env>，缓存没了 st.user.uid 就是空的；
       · 凭证只存在 credentials_<env>，被 invalid_grant 删掉就再也回不来；
       · 刷新请求没有超时，网卡住时会一直挂着。
     所以"有没有凭证""缓存坏没坏""等了多久"都要我们自己看。 */
  function envId() { var c = cfg(); return c ? String(c.envId) : ''; }
  function userInfoKey() { var e = envId(); return e ? ('user_info_' + e) : ''; }

  /* 本机有没有 SDK 写下的云端凭证。
     v1132：先取键名快照再遍历（别的模块随时会改 localStorage，边遍历边读会漏键）。 */
  function credentialsPresent() {
    var _credOk = false;
    try {
      var _keys = [];
      for (var _i2 = 0; _i2 < localStorage.length; _i2++) {
        var _kk = localStorage.key(_i2);
        if (_kk) _keys.push(_kk);
      }
      for (var _i3 = 0; _i3 < _keys.length; _i3++) {
        var _k2 = _keys[_i3];
        if (/^credentials/i.test(_k2) && String(localStorage.getItem(_k2) || '').length > 50) {
          _credOk = true; break;
        }
      }
    } catch (e3) { _credOk = true; }   /* 读不了存储就别下"没凭证"的结论 */
    return _credOk;
  }

  /* SDK 的 user_info 缓存坏了没有：含 localCachev1 却不是合法 JSON、或 content 为空，
     getLoginState() 会直接抛 SyntaxError/TypeError（这是它唯一会抛错的情况）。 */
  function userInfoCorrupt() {
    var k = userInfoKey();
    if (!k) return false;
    try {
      var raw = localStorage.getItem(k);
      if (!raw || String(raw).indexOf('localCachev1') < 0) return false;
      var o = JSON.parse(raw);
      return !(o && typeof o === 'object' && o.content != null);
    } catch (e) { return true; }
  }

  /* 定时器保险：有的 WebView / 测试桩会让定时器提前触发，
     到点时用真实时间再核一次，没到就续上 —— 超时只按真实时间算。 */
  function timeoutAfter(ms, onFire) {
    var t0 = Date.now(), done = false;
    function tick() {
      if (done) return;
      var left = ms - (Date.now() - t0);
      if (left > 20) { setTimeout(tick, left); return; }
      done = true;
      try { onFire(); } catch (e) {}
    }
    setTimeout(tick, ms);
    return function () { done = true; };
  }
  function withTimeout(p, ms, what) {
    return new Promise(function (res, rej) {
      var cancel = timeoutAfter(ms, function () {
        var e = new Error(what + '超时（' + Math.round(ms / 1000) + ' 秒没有回应）');
        e.timeout = true; e.friendly = true;
        rej(e);
      });
      Promise.resolve(p).then(function (v) { cancel(); res(v); }, function (e) { cancel(); rej(e); });
    });
  }
  function netLike(t) {
    return /network|fetch|unreachable|load failed|timed? ?out|abort|ERR_|超时|断网|网络/i.test(String(t || ''));
  }

  /* 凭证守护（hansen_cred_guard_v1092.js）：
     新登录 = 新会话 → 救援次数、影子副本都从这次重新算；退出登录 → 清掉影子，别把退掉的会话救回来。 */
  function credGuardFresh() {
    try {
      var G = window.HansenCredGuard;
      if (G && typeof G.reset === 'function') G.reset();
      if (G && typeof G.backup === 'function') G.backup();
    } catch (e) {}
  }
  function credGuardReset() {
    try { var G = window.HansenCredGuard; if (G && typeof G.reset === 'function') G.reset(); } catch (e) {}
  }
  /* 凭证不见了时先请守护用影子副本救一次；救不了才算真过期。
     newerThan：只认这个时刻之后才备份的影子（别的页面刚换到的新凭证，审查 AUTH-5） */
  function credGuardRescue(newerThan) {
    try {
      var G = window.HansenCredGuard;
      if (G && typeof G.rescue === 'function') return !!G.rescue('会话探测发现凭证不在', newerThan);
    } catch (e) {}
    return false;
  }

  /* 登录 / 注册 resolve 之后：凭证真的在，才算登录成功。
     SDK 在响应缺 expires_in 时会删掉凭证却照样 resolve —— "没报错"不等于"登录了"。 */
  function credentialsCheck(res, where) {
    try {
      var _has = res && typeof res === 'object';
      T(where + '返回', res == null ? '❗返回 null/undefined（SDK 会据此删除凭证）'
        : ('类型=' + (typeof res) + ' 键=[' + Object.keys(res).slice(0, 8).join(',') + ']'
           + ' expires_in=' + (_has && res.expires_in != null ? res.expires_in : '❗无')
           + ' access_token=' + (_has && res.access_token ? '有' : '❗无')));
      var _c = 0;
      lsKeys().forEach(function (_k) {
        if (/cloudbase|tcb|credential|access_token|refresh_token/i.test(_k)) _c++;
      });
      T(where + '后凭证键', _c ? (_c + ' 个') : '❗0 个 —— SDK 没有把凭证写进本地存储');
    } catch (e) {}
    if (!credentialsPresent()) {
      T('登录判定', '❗' + where + '后云端凭证不存在 → 不写"已登录"，如实报错');
      try {
        if (window.HansenCredTrap && typeof HansenCredTrap.mark === 'function')
          HansenCredTrap.mark('❗登录后凭证不存在', where + '：拒绝写入登录态');
      } catch (e) {}
      var eNoCred = new Error(
        '登录未真正完成：云端没有下发有效凭证（响应缺 expires_in / access_token）。'
        + '请把自检面板的「会话探测轨迹」截图给开发者。');
      eNoCred.friendly = true; eNoCred.noCredentials = true;
      throw eNoCred;
    }
    T('登录判定', '✅ ' + where + '：云端凭证已就位，写入本地登录态');
    try {
      if (window.HansenCredTrap && typeof HansenCredTrap.mark === 'function')
        HansenCredTrap.mark('🔑 登录成功', where + '：凭证已就位');
    } catch (e) {}
    credGuardFresh();
  }

  /* ── CloudBase 应用与鉴权 ─────────────────────────── */
  var _app = null, _auth = null, _sdkLoad = null;

  /* 🔴v1164（审查 AUTH-3）：SDK 文件（548 KB）在弱网下没下载完整时，浏览器会把这次失败**记住** ——
     之后同一个地址再 import 都是立刻失败，网好了也一样，只有刷新页面才行；
     而界面一直说「连不上网络 · 检查一下 Wi-Fi」，重试多少次都没用。
     改为：失败就换个地址（加 ?r=时间）再取一次 —— 第一次没加载成，这时页面上还没有任何 SDK，
     不会分裂成两份（v1059 的坑）；全站只有这一处取 SDK（云存档没登录时也借这里）。
     还是失败，就明确告诉大家「刷新一下页面」。 */
  function loadSdk() {
    if (_sdkLoad) return _sdkLoad;
    var p = import('./vendor_cloudbase_esm_v965.js')['catch'](function (e1) {
      T('加载云端组件', '❗第一次没下载成功（' + errText(e1).slice(0, 70) + '）→ 换个地址再取一次');
      return import('./vendor_cloudbase_esm_v965.js?r=' + Date.now());
    })['catch'](function (e2) {
      if (_sdkLoad === p) _sdkLoad = null;
      T('加载云端组件', '❗换了地址还是没下载成功 → 只能刷新页面');
      var e = new Error('云端组件没下载完整，刷新一下页面就好 ⟨' + errText(e2).slice(0, 90) + '⟩');
      e.reload = true; e.friendly = true;
      throw e;
    });
    _sdkLoad = p;
    return p;
  }
  var _bgOnly = false;   /* v1091: 仅后台自动行为置为 true */

  function app() {
    if (_app) return Promise.resolve(_app);
    var c = cfg();
    if (!c) return Promise.reject(new Error('云服务未配置'));
    /* 🔴v1057 关键修复：这里原本先 import 一个**根本不存在的文件**
       `vendor_cloudbase_esm_v1004.js`（仓库里只有 v965 那一个），
       指望 404 时靠 .catch 退回。但动态 import 的 404 在部分浏览器
       （含微信内置浏览器）不会走 catch 分支，于是整个 SDK 加载失败，
       用户点「获取验证码」只看到"连不上服务器"——手机注册从 v1004
       起就一直是坏的，而这只是一个写错的文件名。
       现在直接 import 真实存在的文件，不再赌 fallback。 */
    /* 🔴v1089 补上 v1088 漏掉的一半：**子框内绝不创建云端实例。**

       v1088 已把云存档的多实例堵住，但**账号模块自己没堵** ——
       实测（真实浏览器，加载 5 个预热子页）：
           frame                   HansenAuth   顶层
           index.html                 ✅          是
           island_season.html         ✅          否   ← 子框里也建了实例
           island_season.html         ✅          否   ← 又一个
       子框中加载账号模块的数量：**2** —— 并发刷新的口子根本没堵死。

       为什么这件事致命（v1088 已用凭证生死簿抓到现行）：
           HTTP 400 /auth/v1/token
           invalid_grant | invalid refresh token. for it may be has been refreshed by
           → SDK 拦截器判鉴权失败 → **把整个凭证删掉** → 此后永远 null
       每个实例有各自内存态却共用同一个 localStorage 凭证槽位，
       A 刷新成功写入新 token，B 手里还是旧的 → 撞车。
       **实例数就是撞车概率。**

       子框只负责显示，云端的事交给顶层窗口。 */
    /* 🔴v1091 紧急修正：v1090 把子框**一律**拦死，结果连登录都点不了。

       用户现场：拼写大PK 页面本身就在 index.html 的 iframe 壳里跑，
       登录面板就在那个子框内 —— 一拦，用户看到的是
       「登录没成功：子页面不创建云端实例（由主窗口统一处理）」。
       **我把用户主动发起的登录，和后台自动的会话刷新，当成同一件事拦了。**

       正确的界线：
         · 后台自动行为（开机恢复、自动同步、会话探测）→ 子框内不该建实例，
           因为那正是多实例并发刷新 refresh_token、把凭证撞没的来源；
         · **用户主动操作（登录、注册、手动同步）→ 必须放行**，
           否则功能直接不可用 —— 那比凭证偶尔被撞掉严重得多。

       改为：默认放行；只有**明确标记为后台**的调用才在子框内拒绝。
       另外优先复用顶层已有的实例（同源时），这样即便在子框里操作，
       用的仍是同一个实例，照样不会产生并发刷新。 */
    var _inFrame = false;
    try { _inFrame = (window.top !== window.self); } catch (e) { _inFrame = true; }
    if (_inFrame) {
      /* 同源时直接借用顶层的实例 —— 一个实例，不会并发刷新 */
      try {
        var topA = window.top && window.top.HansenAuth;
        if (topA && typeof topA._app === 'function' && topA !== window.HansenAuth) {
          return topA._app();
        }
      } catch (e) {}
      /* 借不到（跨源/顶层还没加载好）：只拒绝后台行为，用户主动操作一律放行 */
      if (_bgOnly) {
        var eF = new Error('后台任务不在子页面建实例（由主窗口统一处理）');
        eF.friendly = true; eF.notReady = true; eF.inFrame = true;
        return Promise.reject(eF);
      }
    }

    return loadSdk().then(function (mod) {
      var cb = mod && (mod.default || mod);
      var init = cb && (cb.init || (cb.default && cb.default.init));
      if (typeof init !== 'function') throw new Error('云 SDK 加载失败');
      _app = init.call(cb, c.region ? { env: c.envId, region: c.region } : { env: c.envId });
      /* 🔴v1031 关键修复：必须显式声明 persistence:'local'。
         默认持久化只在当前会话内有效——页面一刷新/新开标签，
         CloudBase 的登录会话就没了，而本地标记仍写着"已登录"。
         于是云存档拿着一个**未认证**的实例去读账号名下的文档，
         永远读不到，报「云端没有这把密钥对应的存档」。
         云存档模块本来就用的是 {persistence:'local'}，两处必须一致。 */
      _auth = _app.auth ? _app.auth({ persistence: 'local' }) : null;
      return _app;
    });
  }
  /* 🔴v1057: 允许注入替身鉴权对象。
     此前这条"发码→验码→注册→写登录态"的链路**无法在没有真实云端时验证**，
     导致 v1004 那个写错的 SDK 文件名一直没被任何测试发现。
     有了注入口，回归测试就能用假 SDK 跑完整条链，不必依赖网络。 */
  var _authOverride = null;
  var _authFor = null, _authCached = null;
  function auth() {
    if (_authOverride) return Promise.resolve(_authOverride);
    /* 🔴v1093：**用 app() 返回的那个实例去取 auth，而不是本地的 _auth。**

       用户现场报的是「登录没成功：鉴权不可用」—— 这是 v1091 引入的新问题：
       v1091 让子框「借用顶层实例」，`app()` 于是返回顶层那个 app 对象，
       **但 `_auth` 是本模块的局部变量、在子框里永远是 null** ——
       于是这里直接抛「鉴权不可用」，登录照样点不动。

       我上一版只改了 app()，没跟着改 auth() —— 同一个疏漏的两半。

       改为：拿 app() 实际给回的实例现取 auth；
       本地 _auth 只作为顶层自己的缓存。 */
    /* 🔴v1164：子框里**每调一次就 a.auth() 一次**会造出一串鉴权对象
       （各自一份内存凭证，又是并发刷新的口子）。
       改为：先用顶层建好的那个；没有才自己取一次，并按 app 实例缓存。 */
    return app().then(function (a) {
      if (_auth && a === _app) return _auth;
      if (_authCached && _authFor === a) return _authCached;
      try {
        var topA = window.top && window.top.HansenAuth;
        if (topA && topA !== window.HansenAuth && typeof topA._authObj === 'function') {
          var t = topA._authObj();
          if (t) { _authFor = a; _authCached = t; return t; }
        }
      } catch (e) {}
      if (a && typeof a.auth === 'function') {
        try {
          var got = a.auth({ persistence: 'local' });
          if (got) { _authFor = a; _authCached = got; return got; }
        } catch (e) {}
      }
      throw new Error('鉴权不可用');
    });
  }

  /* ── 登录态 ───────────────────────────────────────── */
  /* 🔴v1012: SDK 的 getCurrentUser() 与 getLoginState() **都返回 Promise**，
     v1004 当同步用 → 拿到 Promise 对象、.uid 为 undefined → 误报「登录状态异常」，
     而实际上注册/登录已经成功。此处改为异步解析，并做多路兜底。 */
  function currentUserAsync() {
    return auth().then(function (a) {
      if (typeof a.getCurrentUser === 'function') {
        return Promise.resolve(a.getCurrentUser()).catch(function () { return null; });
      }
      return null;
    }).then(function (u) {
      if (u && u.uid) return u;
      /* 兜底：从登录态里取 */
      return auth().then(function (a) {
        if (typeof a.getLoginState !== 'function') return null;
        return Promise.resolve(a.getLoginState()).catch(function () { return null; });
      }).then(function (st) {
        if (!st) return null;
        return st.user || (st.uid ? st : null);
      });
    }).catch(function () { return null; });
  }
  /* 同步版仅用于 UI 判定：以本地缓存的登录态为准（登录成功时会写入 uid） */
  function isSignedIn() {
    try {
      var lc = readLocal();
      /* uid 可能因 SDK 异步而暂时读不到, 但只要签入成功(有登录方式+时间戳)就是已登录 */
      return !!(lc.method && lc.signedAt);
    } catch (e) { return false; }
  }
  function currentUser() {
    var lc = readLocal();
    return lc.uid ? { uid: lc.uid } : null;
  }

  /* 友好错误文案：把云端英文错误翻成人话 */
  function friendly(err) {
    /* v1164：我们自己写的中文提示（friendly 且含汉字）原样给人看，别再截断或改写；
       _readable 包过的英文原话仍往下翻译 */
    if (err && err.friendly && /[\u4e00-\u9fff]/.test(String(err.message || ''))) return String(err.message);
    var m = String((err && (err.message || err.error_description || err.code)) || err || '');
    if (/domain|origin|not.*allow|403/i.test(m)) return '这个网址还没加进安全域名白名单（控制台改完要等约 10 分钟生效）';
    /* 🔴v1009: 原正则过宽, 把注册参数错误也误报成"验证码不对", 误导排查。
       只认真正的验证码错误, 其余保留原文 + 提示可反馈。 */
    if (/invalid.*(verification[_ ]?code|verify[_ ]?code|sms[_ ]?code)|verification[_ ]?code.*(invalid|expired|incorrect|wrong)|code.*(expired|incorrect)|验证码(错误|不正确|已过期)/i.test(m))
      return '验证码不对或已过期，重新获取一次';
    if (/frequent|too many|限频|频繁/i.test(m)) return '发得太频繁了，等一会儿再试';
    /* v1164：云端说「没有凭证」= 登录没真正完成（账号密码其实没错），不能翻成「用户名不存在」 */
    if (/unauthenticated|credentials not found|invalid_grant/i.test(m))
      return '登录没真正完成：云端没有给出有效的登录凭证。再点一次登录试试；还不行，就打开自检面板截图发给老师';
    /* v1164：「用户不存在」要排在 /exist/ 前面，否则 "User not exist" 会被说成"用户名有人用了" */
    if (/user.*not.*(found|exist)|not[_ ]found|no.*such.*user|用户不存在/i.test(m)) {
      /* 审查 AUTH-7：旧版本「用户名注册」的孩子 —— 账号从来不存在，不是拼错了 */
      try { if (readLocal().legacyUser) return LEGACY_USERNAME_MSG; } catch (e) {}
      return '没找到这个用户名，检查一下拼写；还没有账号的话，点下面用手机号注册';
    }
    if (/password/i.test(m)) return '密码不对';
    if (/exist|already/i.test(m)) return '这个用户名已经有人用了，换一个吧（或点下面切到登录）';
    if (/weak|password.*(short|length)/i.test(m)) return '密码太简单了，换一个长一点的';
    if (/network|fetch|ERR_/i.test(m)) return '连不上服务器，检查一下网络';
    if (/sms|短信/i.test(m)) return '短信服务还没开通或余额不足（控制台看一下）';
    /* 未识别的错误保留原文——宁可显示英文, 也别用错误的中文误导排查 */
    return m ? ('登录没成功：' + m.slice(0, 90)) : '操作失败，再试一次';
  }

  /* ── ① 手机号验证码：发码 ───────────────────────── */
  function sendPhoneCode(phoneRaw) {
    var phone = normPhone(phoneRaw);
    if (!phone) return Promise.reject(new Error('手机号格式不对，填 11 位就行'));
    return auth().then(function (a) {
      return a.getVerification({ phone_number: phone });
    }).then(function (res) {
      writeLocal({ pendingPhone: phone, verificationId: res && res.verification_id, isUser: !!(res && res.is_user) });
      return { ok: true, isUser: !!(res && res.is_user), phone: phone };
    });
  }

  /* ── ① 手机号验证码：验码并登录/注册 ────────────── */
  function loginByPhoneCode(code) {
    var st = readLocal();
    if (!st.verificationId) return Promise.reject(new Error('请先获取验证码'));
    var c = String(code == null ? '' : code).trim();
    if (!/^\d{4,8}$/.test(c)) return Promise.reject(new Error('验证码是几位数字，检查一下'));
    return reconcilingWhile(loginByPhoneCode0(st, c));
  }
  function loginByPhoneCode0(st, c) {
    /* 🔴v1009 关键修正：注册与登录走**不同**的参数形状，此前混用导致
       "验证码明明输对却报错"——
         · 新用户注册：signUp({phone_number, verification_code}) 收**原始短信码**，
           绝不能先调 verify()，否则验证码在那一步已被消耗；
         · 老用户登录：先 verify() 换 verification_token，再 signIn({username, verification_token})。 */
    return auth().then(function (a) {
      if (!st.isUser) {
        return a.signUp({ phone_number: st.pendingPhone, verification_code: c })
          .catch(function (e1) {
            /* 兜底：若该环境的 signUp 走 token 形状，则补做 verify 再试一次 */
            return a.verify({ verification_id: st.verificationId, verification_code: c })
              .then(function (v) {
                var tk = v && v.verification_token;
                if (!tk) throw e1;
                return a.signUp({ phone_number: st.pendingPhone, verification_token: tk });
              })
              .catch(function () { throw e1; });   /* 报出第一手错误，别被兜底掩盖 */
          });
      }
      return a.verify({ verification_id: st.verificationId, verification_code: c })
        .then(function (v) {
          var token = v && v.verification_token;
          if (!token) throw new Error('验证失败，重新获取验证码');
          return a.signIn({ username: st.pendingPhone, verification_token: token });
        });
    }).then(function (res) {
      /* 🔴v1079/v1080/v1132：登录 resolve ≠ 登录成功。
         SDK 在响应缺 expires_in 时会删掉凭证却照样 resolve（真机：+1ms 凭证 1314 字节，+2143ms 没了）。
         所以先确认 credentials_ 真的在、轨迹记下返回值形状，才写"已登录"；
         否则抛「登录未真正完成」。手机号和用户名登录共用 credentialsCheck 这一处判据。 */
      credentialsCheck(res, '手机号登录');
      /* 审查 AUTH-4：上一个人用用户名登录过的话，username 还在记录里 —— 换成手机号登录要清掉 */
      writeLocal({ verificationId: '', method: 'phone', phone: st.pendingPhone, username: '', legacyUser: '', signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ② 用户名 + 密码 ─────────────────────────────── */
  function loginByPassword(username, password) {
    var u = String(username == null ? '' : username).trim();
    var p = String(password == null ? '' : password);
    if (u.length < 2) return Promise.reject(new Error('用户名太短'));
    if (p.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    return reconcilingWhile(auth().then(function (a) {
      /* 🔴v1058: 先用用户名登录；失败再用"用户名映射出的内部邮箱"重试。
         这样无论账号是用哪种方式建的，用户都只需记住用户名。 */
      return Promise.resolve(a.signIn({ username: u, password: p }))
        .catch(function (e1) {
          /* 🔴v1164：只有「没这个用户」才值得换内部邮箱再试 —— 密码错、云端没给凭证时再试一次，
             第二次的 404 会把第一手原因盖掉，孩子看到「没找到这个用户名」去改一个本来没错的东西 */
          var t1 = errText(e1);
          if (/credential|unauthenticated/i.test(t1) || !/not[_ ]?found|not[_ ]?exist|no such user|用户不存在/i.test(t1)) throw e1;
          var mail = mailOfUsername(u);
          return Promise.resolve(a.signIn({ username: mail, password: p }))
            .catch(function () { throw e1; });
        });
    }).then(function (res) {
      /* 🔴v1164：用户名登录以前**完全不查凭证**就写"已登录"——
         响应缺 expires_in 时 SDK 删了凭证照样 resolve，界面说已登录、云端却没会话。
         和手机号登录用同一处判据。 */
      credentialsCheck(res, '用户名登录');
      /* 🔴审查 AUTH-4：**上一个账号的手机号要清掉。** 以前只写了用户名，手机号还是上一个人的 ——
         云存档按手机号认人，于是用户名账号读写的是上一个人的存档，面板上也显示着他的手机号。 */
      writeLocal({ method: 'password', username: u, phone: '', pendingPhone: '', verificationId: '', legacyUser: '', signedAt: Date.now() });
      return afterSignIn();
    }));
  }

  /* ── ②b 用户名 + 密码「注册」 ────────────────────────
     背景：CloudBase 没有"纯用户名+密码"注册。v1058 曾把用户名映射成内部邮箱去注册，
     但 SDK 对邮箱只发验证码、不建账号（见下方 v1164）。
     映射函数仍保留：用户名登录失败时会用它再试一次。 */
  var INNER_MAIL_DOMAIN = 'u.wordadventure.local';

  function normUsername(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (s.length < 3) return { ok: false, reason: '用户名至少 3 个字' };
    if (s.length > 20) return { ok: false, reason: '用户名最多 20 个字' };
    if (/[\s<>"'`\\/@]/.test(s)) return { ok: false, reason: '用户名不能有空格或 @ < > / 等符号' };
    return { ok: true, name: s };
  }
  /* 用户名 → 内部邮箱：只用 [a-z0-9_] 与十六进制哈希，保证任何字符集都能落到合法邮箱 */
  function mailOfUsername(name) {
    var key = String(name).toLowerCase();
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < key.length; i++) {
      h1 = ((h1 ^ key.charCodeAt(i)) >>> 0) * 16777619 >>> 0;
      h2 = ((h2 + key.charCodeAt(i) * (i + 7)) >>> 0) * 2654435761 >>> 0;
    }
    var safe = key.replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'u';
    return safe + '_' + ((h1 >>> 0).toString(16)) + ((h2 >>> 0).toString(16)) + '@' + INNER_MAIL_DOMAIN;
  }

  /* 🔴v1164：**用户名注册从来没有建出过云端账号。**
     SDK 2.30.0 的 signUpWithEmailAndPassword 其实只是往那个内部邮箱"发一封验证码"，
     不调 /auth/v1/signup、不给凭证（模拟云端实测：1 次 verification、0 次 signup）。
     而这里以前照样写下"已登录" → 界面说登录了，云端永远「会话尚未就绪」。
     CloudBase 网页端只能用手机号（或真实邮箱收码）注册，所以这里如实拒绝、什么都不写，
     并告诉孩子/老师该怎么办。用户名**登录**保留（控制台建的用户名账号仍能用）。 */
  var LEGACY_USERNAME_MSG = '以前版本的「用户名注册」其实没能在云端建好账号，不是你的错。'
    + '请用手机号注册（家长的也可以），这台手机上的进度会自动带过去。';
  var USERNAME_SIGNUP_MSG = '用户名不能直接注册：云端只支持用手机号注册。'
    + '请点上面的「手机号」，收验证码注册（孩子没有手机号，用家长的手机号也可以）。';
  function registerByPassword() {
    T('用户名注册', '❗云端不支持用户名注册 → 如实拒绝，不写登录态');
    var e = new Error(USERNAME_SIGNUP_MSG);
    e.friendly = true; e.unsupported = true;
    return Promise.reject(e);
  }

  /* ── ③ 登出 ─────────────────────────────────────── */
  function signOut() {
    /* 🔴v1145：**退出登录前先把进度传上去。**

       推演 A→B→A 来回换时发现的：
         ① A 登录、玩了一会儿
         ② 退出
         ③ B 登录 → 本机被 B 的存档覆盖
         → **A 在①玩的那段进度，没上传就没了。**

       v1134 的"数据一变就同步"有 8 秒合并延迟 ——
       打完一局立刻退出登录，那 8 秒内的进度必丢。
       而"打完就退出换号"在多人共用一台手机时很常见（孩子轮流玩）。

       所以这里**同步等一次上传**再继续退出。
       上传失败也照常退出（不能把人卡在登录态里），
       但至少尽力了 —— 而且失败时归属标记还是旧的，
       下次那个人登录时对账会再救一次。 */
    var _bye = Promise.resolve();
    try {
      var CS = window.HansenCloudSave;
      if (CS && typeof CS.syncNow === 'function') {
        /* 🔴v1146：**上传要有超时。**
           实测推演：云端卡住不返回时 `_bye` 永不 resolve，
           后面的 signOut 就永远不执行 —— **用户点了退出，退不出去**。
           手机上网络卡住（连着但不返回）比断网还常见。

           给 6 秒：够一次正常上传（实测通常 1~2 秒），
           又不至于让人对着转圈干等。超时就放弃上传继续退出 ——
           **退不出去比丢一点进度更糟**，而且归属标记还是旧的，
           下次那个人登录时对账会再救一次。 */
        _bye = Promise.race([
          CS.syncNow({ force: true })['catch'](function () {}),
          new Promise(function (r) { setTimeout(r, 6000); })
        ]);
      }
    } catch (e) {}

    /* 🔴v1142 → 🔴审查第二轮 R2-1/FX-1：**退出登录时不再清资料。**
       v1142 在这里清名字 / 竞赛 ID，是为了「换账号后还显示上一个人的名字」。那件事 v1154 起由资料模块自己管：
       它记着资料属于哪个 uid，**换了一个人登录**（uid 变了）才清（hsn-account-uid-changed → syncOwner）。
       这里再清一次反而坏事：同一个人退出再登回来，对账看到「本机资料和上次传的不一样」（被这里清成了空白），
       就把空白传上了云 —— 名字、头像、展柜、隐私设置全没了，换台设备也找不回来。
       退出时的提示本来就说「这台手机上玩到哪儿了都还在」，资料也一样留着。 */
    /* 🔴v1143：**不清归属标记。**
       退出后本机这份进度**仍然是刚才那个人的** ——
       清了的话，下一个人登录时会被当成"我自己没登录时玩的"，
       于是把别人的进度传到自己账号上。
       标记只在**新的人登录并完成对账**时才更新。 */

    /* v1145: 等上传完再真正退出 —— 否则清了登录态，上传就没凭证了。
       上传失败也继续退出（不能把人卡在登录态里）。 */
    return _bye.then(function () { return auth(); }).then(function (a) {
      /* v1164：先清本地登录记录再让 SDK 退出 —— 凭证守护看到"已退出"，
         就不会把 SDK 刚删掉的凭证又救回来；退出请求限 6 秒，网卡住也退得出去。 */
      writeLocal({ method: '', signedAt: 0, uid: '', phone: '', username: '', pendingPhone: '', verificationId: '' });
      return a.signOut ? withTimeout(Promise.resolve().then(function () { return a.signOut(); }), 6000, '退出登录') : null;
    }).catch(function () { return null; }).then(function () {
      writeLocal({ method: '', signedAt: 0, uid: '', phone: '', username: '', pendingPhone: '', verificationId: '' });
      credGuardReset();
      return { ok: true };
    });
  }

  /* ── 登录之后：建档 + 发号 ──────────────────────── */
  function afterSignIn() {
    return currentUserAsync().then(function (u) {
      var uid = u && u.uid;
      if (!uid) {
        /* 🔴v1012: 读不到 uid **不等于登录失败**——签入这一步已经成功了。
           以前在这里直接判失败，用户看到「登录状态异常」，实际账号已注册好。
           这里标记为已登录，竞赛 ID 留待下次进入时补发。 */
        writeLocal({ signedAt: Date.now() });
        return { ok: true, uid: '', cid: 0, pendingId: true };
      }
      writeLocal({ uid: uid });
      /* 🔴v1028: 登录成功后作废云存档已缓存的实例, 让它按账号身份重建, 
         否则它可能仍拿着登录前的匿名身份读写。 */
      try { if (window.HansenCloudSave && HansenCloudSave.resetApp) HansenCloudSave.resetApp(); } catch (e) {}
      return ensureProfile(uid)
        .catch(function (e) { T('建档/发号', '没成功（不影响登录，下次登录再补）：' + errText(e).slice(0, 90)); return null; })
        .then(function (prof) {
          return syncOnLogin().then(function (s) {
            return { ok: true, uid: uid, cid: (prof && prof.cid) || 0,
                     pendingId: !(prof && prof.cid), sync: s };
          });
        });
    });
  }

  /* 🔴v1164：数据库出错时 SDK **不抛错**，而是照常返回 {code, message}
     （权限不够、集合没建都是这样）。以前把它当成"没有档案"去建档、
     把 count 的错误当成"0 个人比我早"发出 No.1。必须自己查 code。 */
  function dbFail(r, what) {
    if (!r || !r.code) return null;
    var e = new Error(what + '失败 ⟨' + r.code + (r.message ? ' ' + String(r.message).slice(0, 80) : '') + '⟩');
    e.code = r.code; e.cloud = true;
    return e;
  }

  /* 建立/读取云端档案，并分配竞赛 ID */
  function ensureProfile(uid) {
    var db = null, docRef = null;
    return app().then(function (a) {
      db = a.database();
      docRef = db.collection(COL_PROFILE).doc(uid);
      return docRef.get();
    }).then(function (res) {
      var bad = dbFail(res, '读取资料 sb_profile');
      if (bad) throw bad;
      var row = res && res.data && res.data[0];
      if (row && row.cid > 0) return row;                 /* 已有号码 → 直接用 */
      if (row) return assignCid(db, docRef, row.createdAt);
      /* 首次：建档，createdAt 用服务端时间（客户端伪造不了 → 排名可信） */
      return docRef.set({
        uid: uid,
        name: (localProfileName() || ''),
        cid: 0,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }).then(function (w) {
        var bad2 = dbFail(w, '建立资料 sb_profile');
        if (bad2) throw bad2;
        /* 🔴v1164：刚写进去马上读，未必读得到（主从同步有延迟）—— 读不到就隔半秒再读，
           最多 4 次；否则这次就发不出竞赛 ID，好友页一直说「先设置竞赛 ID」 */
        var readBack = function (n) {
          return docRef.get().then(function (r2) {
            var bad3 = dbFail(r2, '读取资料 sb_profile');
            if (bad3) throw bad3;
            var row2 = r2 && r2.data && r2.data[0];
            if ((row2 && row2.createdAt) || n <= 1) return row2;
            return new Promise(function (ok) { setTimeout(ok, 500); }).then(function () { return readBack(n - 1); });
          });
        };
        return readBack(4);
      }).then(function (row2) {
        return assignCid(db, docRef, row2 && row2.createdAt);
      });
    }).then(function (prof) {
      if (prof && prof.cid > 0) {
        try {
          if (window.HansenSbProfile && HansenSbProfile.claimCloudId) HansenSbProfile.claimCloudId(prof.cid);
        } catch (e) {}
      }
      return prof;
    });
  }

  /* ── 竞赛 ID = 比我早注册的人数 + 1 ──────────────────────────

     产品定义：**完全按注册人数的顺序分配**。
     所以不用计数器（`counters` 集合是 ADMINONLY，客户端也写不了），
     而是**数一下有多少人比我先注册** —— 这个语义天然就是"注册顺序"，
     而且不依赖任何额外的状态，重算一次结果还是一样。

     🔴v1130 **但要防撞号**：两人几乎同时注册会数到同一个号。
     发号后**验一次有没有别人已经占了这个号**，撞了就往后挪一位，最多重试 5 次；
     真撞满 5 次也不阻断登录 —— 下次登录会再补一次。
     🔴v1164：count 出错返回的是 {code}（没有 total）→ 这次不发号，绝不按 0 人算。 */
  function cntOk(r) { return !!(r && !r.code && typeof r.total === 'number'); }
  function assignCid(db, docRef, createdAt, attempt) {
    if (!createdAt) return Promise.resolve(null);
    var tries = attempt || 0;
    return db.collection(COL_PROFILE).where({ createdAt: db.command.lt(createdAt) }).count()
      .then(function (r) {
        if (!cntOk(r)) return null;
        var cid = r.total + 1 + tries;
        /* 校验这个号有没有被占 —— 只有确实空着才写 */
        return db.collection(COL_PROFILE).where({ cid: cid }).count().then(function (c) {
          if (!cntOk(c)) return null;
          if (c.total > 0) {
            if (tries >= 5) return null;          /* 让下次登录再补，不阻断本次 */
            return assignCid(db, docRef, createdAt, tries + 1);
          }
          return docRef.update({ cid: cid, updatedAt: db.serverDate() }).then(function (u) {
            return (u && u.code) ? null : { cid: cid };
          });
        });
      })
      .catch(function () { return null; });   /* 发号失败不阻断登录，下次登录再补 */
  }

  function localProfileName() {
    try {
      if (window.HansenSbProfile) return (HansenSbProfile.readProfile() || {}).name || '';
    } catch (e) {}
    return '';
  }

  /* ── 跨设备存档 ─────────────────────────────────── */
  /* 登录后把本地进度推上云 */
  /* 🔴v1017 登录后自动对账：让「登录 = 找回全部进度」真正成立
     · 云端有档 + 本机没进度 → 直接恢复（换新设备的典型场景）
     · 云端有档 + 本机也有进度 → 交给用户选，绝不静默覆盖任何一边
     · 云端没档 → 把本机进度传上去，这个账号从此有档 */
  function localHasProgress() {
    try {
      /* ⚠️ 这里不能用 forEach —— 里面要 `return true` 提前退出，
         而 forEach 的 return 只退出回调、退不出外层函数。
         所以仍用 for，但遍历的是**快照数组**而不是实时的 localStorage。 */
      var _ks = lsKeys();
      for (var _i = 0; _i < _ks.length; _i++) {
        var k = _ks[_i];
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          /* 🔴v1154：**"有进度"要按真正学过的东西算，不能算答题统计。**

             用户现场（截图）：对话框写着
               【本机】0 个岛 · 已学 0 个单词
             却还在问"需要你选一份保留" —— **本机什么都没有，有什么好选的？**

             根因就在这一行：原来 `stats` 里有任何键就算"有进度"，
             而 `stats` 只是答题统计（点开一个岛看一眼就会有），
             **一个单词没学也会被判成"本机有进度"**，于是每次登录都弹框。

             改为只认 `learned`（真正学会的单词）—— 那才是会丢的东西。 */
          if (o && o.learned && o.learned.length) return true;
        }
      }
    } catch (e) {}
    return false;
  }
  /* 本机进度的规模，用于冲突时给用户看真实数字 */
  function localProgressSize() {
    var islands = 0, learned = 0;
    try {
      /* v1132: 走快照 —— 边遍历边读会因集合变动漏掉键（见 lsKeys 注释） */
      var _ks = lsKeys();
      for (var i = 0; i < _ks.length; i++) {
        var k = _ks[i];
        if (k && k.indexOf('wordIsland') === 0) {
          var o = JSON.parse(localStorage.getItem(k) || 'null');
          if (o && o.learned && o.learned.length) { islands++; learned += o.learned.length; }
        }
      }
    } catch (e) {}
    return { islands: islands, learned: learned };
  }

  /* ── 🔴v1143 本机进度的归属标记 ──────────────────────────

     问题：换账号登录时，系统**不知道本机这份进度是谁的**。
     于是无法区分两种完全不同的情况：

       · 「我自己没登录时玩的」   → 该保留、该上传到我的账号
       · 「上一个账号留下的」     → 不该算成我的

     真机现场就撞上了后者：退出 A 号登 B 号，
     B 看到的是 A 的名字和号（v1142 修了资料这一层），
     **而进度、战绩、钱包这些同样还是 A 的**。

     修法：登录成功时记下「这份本机进度属于谁」。
     换账号登录时一比对就知道 —— 不一样就说明本机这份是别人的。

     ⚠️ **绝不直接删。** 没登录时玩的进度也在同一批键里，
     删了就是删用户数据 —— 这条红线比什么都硬。
     所以只做一件事：**告诉对账逻辑"本机这份不是你的"**，
     让它走「云端有档 → 直接恢复」那条路，而不是
     「云端有档 + 本机也有 → 让用户选」（用户根本不知道该选哪个）。 */
  var OWNER_KEY = 'hansen_local_progress_owner_v1143';

  function localOwner() {
    try { return localStorage.getItem(OWNER_KEY) || ''; } catch (e) { return ''; }
  }
  function markLocalOwner(uid) {
    try {
      if (uid) localStorage.setItem(OWNER_KEY, String(uid));
      else localStorage.removeItem(OWNER_KEY);
    } catch (e) {}
  }
  /* 云存档刚把本机进度传进当前账号：本机这份还没有主人时，记成这个账号的（有别的主人就不动 ——
     那要等登录对账去认，不能因为传了一次就把别人的进度算成我的） */
  function claimLocalProgress() {
    try {
      var uid = (readLocal() || {}).uid || '';
      if (uid && !localOwner() && isSignedIn()) markLocalOwner(uid);
    } catch (e) {}
  }
  /* 本机这份进度是不是「别人的」——
     有主人、且不是当前这个人，才算别人的。
     没主人（从没登录过就玩的）不算别人的，那是用户自己的东西。 */
  function localBelongsToOther(uid) {
    var o = localOwner();
    return !!(o && uid && o !== uid);
  }

  /* ── 🔴审查 R2-3 / R2-4：对账没做完 / 没做成之前，不许上传 ─────────────────────
     · 正在登录 + 对账（reconciling）：慢网下要好几秒。这期间换账号引出的那一串写入（资料重置、战绩换主人）
       会让云存档排上一次上传 —— 以前它抢在对账前面，把上一个人留在本机的进度传进了新账号的存档。
       同一个标签页里的几层页面（首页外壳、岛、预热页）共用 sessionStorage，记在那里大家都看得到。
     · 本机这份进度的主人是别的账号（owner-mismatch）：同上。
     · 登录时没读到云端 / 恢复失败（not-reconciled，记在云存档自己的状态里）：本机这几个词会把云端几十个词整个盖掉。
       面板说的「稍后会自动重试」由下面的 reconcileLater() 兑现：打开页面、切回来、网通了时再对一次账，对上了才放开。 */
  var RECON_KEY = 'hsnLoginRecon_v1164';
  var _reconN = 0;
  function reconcilingWhile(p) {
    _reconN++;
    try { sessionStorage.setItem(RECON_KEY, String(Date.now())); } catch (e) {}
    var done = function () {
      _reconN = Math.max(0, _reconN - 1);
      if (!_reconN) { try { sessionStorage.removeItem(RECON_KEY); } catch (e) {} }
    };
    return Promise.resolve(p).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
  }
  function reconcilingNow() {
    if (_reconN > 0) return true;
    try {
      var at = Number(sessionStorage.getItem(RECON_KEY) || 0);
      return !!(at && Date.now() - at < 90000);     /* 那一页对账到一半被关了：90 秒后自动作废 */
    } catch (e) { return false; }
  }
  function uploadGate() {
    if (reconcilingNow()) return { ok: false, reason: 'reconciling' };
    try {
      var uid = (readLocal() || {}).uid || '';
      if (!uid || !isSignedIn()) return { ok: true };
      if (localBelongsToOther(uid)) return { ok: false, reason: 'owner-mismatch' };
      var CS = window.HansenCloudSave;
      var nr = (CS && typeof CS.reconcileState === 'function') ? CS.reconcileState() : '';
      if (nr && nr === uid) { reconcileLater(); return { ok: false, reason: 'not-reconciled' }; }
    } catch (e) {}
    return { ok: true };
  }
  function setNotReconciled(uid) {
    try { var CS = window.HansenCloudSave; if (CS && CS.setReconcileState) CS.setReconcileState(uid || ''); } catch (e) {}
  }
  /* 登录时没对上账的，过一会儿再对一次（最多每 20 秒一次；对战中不打扰）。
     对上了：云端那份恢复到本机（要刷新页面才生效 —— 和登录时一样）、或者本机这份传上去 */
  var _laterBusy = false, _laterAt = 0, _laterHooked = false;
  function reconcileLater() {
    if (!_laterHooked) {
      _laterHooked = true;
      try {
        document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') setTimeout(reconcileLater, 1500); });
        window.addEventListener('online', function () { setTimeout(reconcileLater, 1500); });
      } catch (e) {}
    }
    if (_laterBusy || Date.now() - _laterAt < 20000) return;
    try {
      var CS = window.HansenCloudSave, uid = (readLocal() || {}).uid || '';
      if (!CS || !CS.reconcileState || !uid || !isSignedIn() || CS.reconcileState() !== uid) return;
      var U = window.HansenPkRoomUI, b = (U && typeof U.isBusy === 'function') ? U.isBusy() : null;
      if (b && (b.battle || b.waiting)) return;   /* 正在对战 / 等人：下次再说 */
    } catch (e) { return; }
    _laterBusy = true; _laterAt = Date.now();
    T('登录对账', '上次登录时没对上账 → 再对一次');
    reconcilingWhile(syncOnLogin()).then(function (s) {
      _laterBusy = false;
      T('登录对账', '再对一次：' + ((s && s.action) || (s && s.reason) || '?'));
      if (s && s.needReload) {
        try { if (window.HansenToast && HansenToast.say) HansenToast.say('☁️ 已从云端取回你的进度，正在载入…'); } catch (e) {}
        setTimeout(function () { try { location.reload(); } catch (e) {} }, 1200);
      }
    }, function () { _laterBusy = false; });
  }
  /* 打开页面时：上次没对上账的，等页面稳定了再对一次 */
  try { setTimeout(function () { try { uploadGate(); } catch (e) {} }, 5000); } catch (e) {}

  function syncOnLogin() {
    var CS = window.HansenCloudSave;
    if (!CS || typeof CS.accountCloudInfo !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return CS.accountCloudInfo().then(function (info) {
      var hasLocal = localHasProgress();
      var local = localProgressSize();
      /* 🔴v1143：本机这份是上一个账号的 → 当成"本机没有"来对账。
         这样走的是「云端有档 → 直接恢复」，而不是
         「两边都有 → 让用户选」—— 后者用户根本不知道该选哪个，
         而且很容易把别人的进度传到自己账号上。 */
      var uidNow = '';
      try { uidNow = (readLocal() || {}).uid || ''; } catch (e) {}
      var foreign = localBelongsToOther(uidNow);
      if (foreign) { hasLocal = false; }
      /* 🔴v1144：**标记不能在这里打。**

         v1143 图省事放在入口"不管走哪条分支都打" —— 实测挑出问题：
         对账**失败**时（云端连不上、恢复失败），
         A 的进度已经被标成 B 的了，
         → B 看到的还是 A 的进度，
         → **下次登录会被当成"B 自己的"直接上传到 B 的账号**。

         正确做法：**只在对账真正成功之后才打标记** ——
         也就是"本机这份进度确实已经是他的了"这件事成立之后。
         下面每条成功分支各打一次。虽然要多写几处，
         但"分支多容易漏"这个理由**不能拿来换正确性**：
         漏一处只是少标一次（下次登录会补），
         而早标一次会把别人的进度算成你的。 */
      /* 🔴v1029 安全红线一：**查不到 ≠ 没有**。
         网络抖动或权限问题都会让查询失败，此时若当成"云端没有"就去上传，
         可能用本机(甚至是空的)覆盖掉云端的真实存档。查不到就什么都不做。 */
      if (info && info.exists === null) {
        /* 🔴审查 R2-3：记下「这个账号在这台手机上还没对上账」—— 对上之前一律不上传（不然本机这几个词会盖掉云端的），
           面板说的「稍后会自动重试」由 reconcileLater() 兑现 */
        setNotReconciled(uidNow);
        reconcileLater();
        return { ok: false, action: 'cloud-unreachable', reason: info.reason || '' };
      }
      var hasCloud = !!(info && info.exists);
      /* 🔴v1029 安全红线二：**本机是空的就绝不上传**。
         设备B(全新、无进度)先登录时若上传空档，
         设备A 之后登录就会看到"云端有档"，一旦选错就全丢了。 */
      if (!hasCloud && !hasLocal) {
        markLocalOwner(uidNow);   /* v1144: 对账完成才算归他 */
        setNotReconciled('');
        return { ok: true, action: 'nothing-to-sync' };
      }
      if (hasCloud && !hasLocal) {
        return CS.restoreWithKey(CS.ensureKey(), true)
          .then(function (r) {
            /* 🔴v1026 关键：恢复只是把数据写回 localStorage，
               而页面内存里的 S 仍是登录前那份空数据 —— 不刷新的话
               ① 用户看到"等级没变、什么都没变"；
               ② 页面下一次存档会用内存里的空数据**覆盖掉刚恢复的进度**。
               所以恢复成功必须重新加载页面，让新数据真正生效。 */
            if (r && r.ok) {
              markLocalOwner(uidNow);   /* v1144: 恢复成功，本机这份确实是他的了 */
              setNotReconciled('');
              return { ok: true, action: 'restored', needReload: true };
            }
            /* 恢复失败 —— **不标记**。本机这份还是上一个人的，
               标了的话下次登录会被当成他自己的传上去。 */
            setNotReconciled(uidNow); reconcileLater();
            return { ok: false, action: 'restore-failed' };
          })
          .catch(function () { setNotReconciled(uidNow); reconcileLater(); return { ok: false, action: 'restore-failed' }; });
      }
      /* 🔴v1154：**本机明显比云端少 → 直接用云端，不问。**

         用户原话：「每次还得点个 ok，不需要每次出这种对话框，
         它会自动就覆盖现在的记录。」

         这个诉求是对的 —— 弹框的意义只在于"两边都有真东西、
         选错会丢"。而绝大多数登录场景根本不是那样：
         换了台手机、清了缓存、重装了浏览器 —— **本机本来就该被云端填满**。

         判据：本机学过的单词数 **少于云端的一半**（或本机干脆是 0）
         → 用云端覆盖是明显更优的选择，自动做掉。

         保留弹框的只剩一种情况：**两边都有相当规模的进度且互不包含** ——
         那时确实只有用户自己知道该留哪份。 */
      /* 🔴v1163（BAT MAN 定的规则）：**登录一律以云端为准，不再问。**

         规则原话：
           「玩到 3 级必须要注册，而且只在这次会上传到云端，
             之后都是登录直接覆盖」

         也就是说：
           · 注册那一刻 —— 本机进度上传，这是**唯一一次**本机往云端走
           · 之后每次登录 —— 云端**直接覆盖**本机

         为什么这样是安全的（三条一起才成立，缺一不可）：

           ① 3 级之前不能注册，所以匿名玩的进度一定在"注册上传"那次带上去了
           ② 退出登录前会**同步等一次上传**（v1134 做的），
              打完一局立刻退出也不会丢
           ③ 玩的过程中数据一变就自动同步（8 秒合并延迟）

         所以云端永远是最新的 —— 本机比云端新的情况不该存在。
         既然如此，弹「留本机还是留云端」就是在问一个
         **用户没有信息可以判断的问题**：
         他不知道两边差多少，只能瞎选，选错了就丢进度。

         > 与其让用户在没有依据的情况下做不可逆的选择，
         > 不如让规则本身保证一边永远是对的。

         ⚠️ 唯一保留的例外：**云端读不到**（网断了、权限出错）——
         那种情况在前面 `info.exists === null` 就返回了，
         走不到这里。不会出现"云端是空的却把本机清了"。 */
      /* 🔴v1164（审查 AUTH-1）：「云端永远是最新的」有一个例外 —— **这台手机后来玩的、没传上去的**。
         会话死掉的那段时间里，孩子照样在玩，上传一直失败；重新登录时再拿云端那份旧的一盖，这段进度就没了。
         认法（不看两台手机的钟）：本机这份是这个账号的（归属标记），内容和最后一次传成功的不一样，
         而且云端那一份还是我最后传的那份（密文的 iv 对得上 —— 没有别的设备在这之后传过）→ 传本机这份。
         云端那份已经被别的设备更新过（两边都有新东西）→ 解密数一下，谁学会的词多用谁。 */
      var us = (typeof CS.uploadState === 'function') ? CS.uploadState() : null;
      var lh = (typeof CS.localHash === 'function') ? CS.localHash() : '';
      var mineLocal = !!(hasCloud && hasLocal && uidNow && localOwner() === uidNow);
      var unsynced = !!(mineLocal && us && us.lastHash && lh && lh !== us.lastHash);
      if (unsynced) {
        var cloudIsMine = !!(us.lastIv && info && info.iv && info.iv === us.lastIv);
        var pick = cloudIsMine ? Promise.resolve('local')
          : (typeof CS.cloudLearned === 'function'
              ? CS.cloudLearned().then(function (n) { return ((local && local.learned) || 0) > n ? 'local' : 'cloud'; },
                                       function () { return 'cloud'; })
              : Promise.resolve('cloud'));
        return pick.then(function (who) {
          if (who !== 'local') return restoreCloud();
          T('登录对账', '本机有没传上去的进度（' + (cloudIsMine ? '云端还是上次那份' : '本机学会的词更多') + '）→ 传本机这份');
          return CS.syncNow({ force: true, rewrite: true, reconciled: true }).then(function (r) {
            if (r && r.ok) { markLocalOwner(uidNow); setNotReconciled(''); }
            return { ok: !!(r && r.ok), action: (r && r.ok) ? 'uploaded' : 'upload-failed', autoPicked: 'local',
                     localWords: (local && local.learned) || 0 };
          }, function () { return { ok: false, action: 'upload-failed' }; });
        });
      }
      if (hasCloud && hasLocal) return restoreCloud();
      function restoreCloud() {
        return CS.restoreWithKey(CS.ensureKey(), true)
          .then(function (r) {
            if (r && r.ok) {
              markLocalOwner(uidNow);
              setNotReconciled('');
              /* 审查 AUTH-6：数恢复之后本机学会的词（= 云端那份），别从密文里数（永远是 0） */
              return { ok: true, action: 'restored', needReload: true,
                       autoPicked: 'cloud',
                       localWords: (local && local.learned) || 0,
                       cloudWords: localProgressSize().learned || 0 };
            }
            /* 恢复失败：**什么都不动**，本机原样留着。
               宁可这次没同步上，也不能把人的进度清成半截。 */
            setNotReconciled(uidNow); reconcileLater();
            return { ok: false, action: 'restore-failed' };
          })['catch'](function () {
            setNotReconciled(uidNow); reconcileLater();
            return { ok: false, action: 'restore-failed' };
          });
      }
      /* 云端没有、本机有：传上去。🔴审查 FX-7：这里明明知道云端是空的 —— 内容「没变」也要真写（rewrite），
         以前本机记着「这份传过了」就跳过，面板说「进度已存到云端」，云端其实一个字都没有 */
      return CS.syncNow({ force: true, rewrite: true, reconciled: true })
        .then(function (r) {
          if (r && r.ok) setNotReconciled('');
          return { ok: !!(r && r.ok), action: (r && r.ok) ? 'uploaded' : 'upload-failed' };
        })
        .catch(function () { return { ok: false, action: 'upload-failed' }; });
    }).catch(function () { return { ok: false, reason: 'sync-error' }; });
  }


  function pushSave() {
    if (!window.HansenCloudSave || typeof HansenCloudSave.syncNow !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    /* 「立即把进度存到云端」是孩子自己点的：内容没变也真写一次（rewrite），他要的就是「现在就在云上」 */
    return HansenCloudSave.syncNow({ force: true, rewrite: true });
  }
  /* 换设备登录后把云端进度拉下来（需要 16 位密钥，沿用现有恢复通道） */
  function pullSave(key) {
    if (!window.HansenCloudSave || typeof HansenCloudSave.restoreWithKey !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return HansenCloudSave.restoreWithKey(key, true);
  }

  /* 🔴v1164（审查 TI-4）：问一下登录服务（同一个云端域名的 /auth/v1/user/me）—— 它能回话，网就是通的。
     数据库回非 200 时 SDK 只会说「network request error」，看着和断网一模一样。 */
  function probeDetail() {
    return auth().then(function (a) {
      if (typeof a.getLoginState !== 'function') return { reachable: false };
      var ask = Promise.resolve().then(function () { return a.getLoginState(); }).then(function (ls) {
        var u = ls && ls.user;
        if (!u || typeof u.refresh !== 'function') return { reachable: false };
        /* ⚠️ 不能用 getCurrentUser()：它把网络错误吞掉、拿本机缓存的用户信息当结果 —— 断网也说「通」
           （实测：/auth/v1/user/me 三次都没发出去，它照样回了用户）。
           user.refresh() 真去问 /auth/v1/user/me：回了话 = 通；SDK 报 unreachable = 不通。
           🔴审查 T5：回的是「令牌不对」（401）也是通的，但那是**登录的问题**，不是数据库 —— 单独标出来 */
        return Promise.resolve().then(function () { return u.refresh(); }).then(function () { return { reachable: true }; }, function (e) {
          var reach = !!(e && ((e.error && e.error !== 'unreachable') || e.code));
          var raw = errText(e);
          return { reachable: reach, unauth: reach && /unauthenticated|unauthori[sz]ed|invalid_token|access.?token|credential|401/i.test(raw),
                   raw: raw.slice(0, 90) };
        });
      });
      return withTimeout(ask, 6000, '探测云端').then(function (v) { return v || { reachable: false }; },
                                                     function () { return { reachable: false, slow: true }; });
    })['catch'](function () { return { reachable: false }; });
  }
  function probeCloud() { return probeDetail().then(function (p) { return !!(p && p.reachable); }); }

  /* 🔴审查 TI-4 / T5 / FX-8 / R2-UI-8：数据库那边接连失败时，弄清到底是哪一种（天梯、公开房间共用这一个判法）：
       登录服务也连不上（很快报错）→ 'offline'；登录服务也一样慢 → 'slow'；
       刚才的失败里有「太慢」（我们自己的超时）、登录服务又回话了 → 'slow'：网太慢，不怪数据库；
       登录服务说「令牌不对」→ 先换一张令牌：换到了就再试一次数据库，换不到 → 'expired'（去重新登录）；
       登录服务好好的 → **马上再试一次数据库**（多半是网刚刚恢复）：成了 → 'ok'（带回结果，接着用）；
         还是连不上 → 'dbblocked'（话说成「可能」，给「再试一次」—— 以前一口咬定「网没有断、是数据库拒绝了」）。
     kinds：刚才那几次失败各是什么种类；retry()：再试一次数据库，返回 Promise<{ok, kind?, ...}> */
  var DB_BLOCKED_TEXT = '云端连得上，但数据库这次没让读写：可能是网络刚好又断了一下，'
    + '也可能是云端设置还差一步（集合没建、权限不对，或者这个网址还没加进「安全域名」）。'
    + '先点「再试一次」；一直这样的话，把这一屏截图发给负责的老师';
  function diagnose(kinds, retry) {
    kinds = Array.isArray(kinds) ? kinds : [];
    /* 刚才的失败里有「太慢」（我们自己的超时）：也先问一下登录服务再说 ——
       它很快就回「连不上」= 是断网（比如刷新令牌的请求根本发不出去，SDK 一直重试直到我们超时）；
       它回话了 / 它也一样慢 → 才是「网太慢」。 */
    var slowSeen = kinds.some(function (k) { return k === 'slow'; });
    return probeDetail().then(function (p) {
      if (!p || !p.reachable) return { verdict: p && p.slow ? 'slow' : 'offline' };
      var again = function () {
        if (typeof retry !== 'function') return { verdict: 'dbblocked', text: DB_BLOCKED_TEXT };
        return Promise.resolve().then(retry).then(function (r) {
          if (r && r.ok !== false) return { verdict: 'ok', result: r };
          var k = String((r && r.kind) || '');
          if (k === 'network') return { verdict: 'dbblocked', text: DB_BLOCKED_TEXT, result: r };
          return { verdict: 'other', result: r };
        }, function () { return { verdict: 'dbblocked', text: DB_BLOCKED_TEXT }; });
      };
      if (p.unauth) {
        return recoverSession('登录服务说令牌不对：' + (p.raw || '')).then(function (rr) {
          if (rr && rr.ok) return again();
          return { verdict: 'expired', raw: p.raw || 'unauthenticated' };
        });
      }
      if (slowSeen) return { verdict: 'slow' };
      return again();
    }, function () { return { verdict: 'offline' }; });
  }

  /* 会话确实死了：清本机「登录着」这一条并通知界面（ensureSession 的确凿过期、recoverSession 换不到新令牌都走这里） */
  function clearSignedIn(r) {
    r = r || {};
    var _lcX = readLocal();
    /* 🔴v1164（审查 AUTH-7）：v1058~v1163 的「用户名注册」其实从没在云端建出账号，只在本机写了「已登录」。
       这些孩子第一次打开新版本就会走到这里 —— 说实话，别让他们去改一个本来没拼错的用户名。 */
    if (_lcX.method === 'password' && !_lcX.uid) {
      r.legacy = true;
      r.reason = LEGACY_USERNAME_MSG;
      T('结论', '❗这是旧版本「用户名注册」留下的登录记录（云端从来没有这个账号）');
    }
    /* 🔴v1164（审查 AUTH-1）：**只清「登录着」这一条，不清 uid。**
       uid 一变，全站都会当成「换了个人」：天梯战绩当场清零、重新登录后对账又拿云端的旧档盖掉
       这段时间玩的进度。会话过期 ≠ 换账号。手机号 / 用户名一起清掉（下一次登录重新写，别留给下一个人）。 */
    writeLocal({ method: '', signedAt: 0, phone: '', username: '', pendingPhone: '', verificationId: '',
                 legacyUser: r.legacy ? (_lcX.username || '') : '' });
    T('结论', '已清除本地"已登录"记录并通知界面 → 请重新登录');
    /* 清了标记必须广播，否则界面上那句「已登录 +86 186xxxx」会一直挂到下次刷新 */
    try { document.dispatchEvent(new CustomEvent('hsn-auth-changed', { detail: { expired: true } })); } catch (e1) {}
    return r;
  }
  /* 别的模块确认「云端不认这个会话了」时调：刚登录 60 秒内照样不清（v1063 竞态防线） */
  function markExpired(why) {
    if (!isSignedIn()) return false;
    if (isFresh()) { T('结论', '刚登录不到 60 秒 → 先不清本地登录记录（' + String(why || '').slice(0, 60) + '）'); return false; }
    clearSignedIn({ reason: String(why || '') });
    return true;
  }

  /* 🔴审查 R2-UI-7：数据库回「令牌过期 / 不对」，SDK 自己却还觉得令牌好好的（手机钟被往回调过、云端撤了这张令牌）。
     以前就这样一直错下去：天梯说「云端登录过期了」，「重新登录」打开的却是「已登录」面板，没有登录表单。
     现在：让 SDK 拿 refresh_token 换一张新令牌（refreshSession）；换到了 → 调用方再试一次；
     换不到、而且凭证没了 / 云端明说不认 → 会话确实死了，清掉本机「已登录」（界面就会出现登录表单）。
     网络问题不下结论。30 秒内只换一次，免得一直被拒时来回换。 */
  var _recover = null, _recoverAt = 0;
  function recoverSession(why) {
    if (_recover) return _recover;
    if (!isSignedIn()) return Promise.resolve({ ok: false, notSignedIn: true });
    if (Date.now() - _recoverAt < 30000) return Promise.resolve({ ok: false, recent: true });
    _recoverAt = Date.now();
    T('会话修复', '数据库不认这张令牌（' + String(why || '').slice(0, 60) + '）→ 用 refresh_token 换一张新的');
    var p = auth().then(function (a) {
      if (typeof a.refreshSession !== 'function') return { ok: false, reason: 'no-api' };
      return withTimeout(Promise.resolve().then(function () { return a.refreshSession(); }), 8000, '换新令牌').then(function (r) {
        var err = r && r.error;
        if (!err && r && r.data && r.data.session) { T('会话修复', '✅ 换到了新令牌'); _lastOkAt = 0; return { ok: true }; }
        var et = errText(err) || '换不到新令牌';
        if (!credentialsPresent() || /invalid_grant|unauthenticated|credentials|refresh token|invalid/i.test(et)) {
          T('会话修复', '❌ 换不到（' + et.slice(0, 70) + '）→ 确实过期了，需要重新登录');
          markExpired('令牌换不到新的：' + et);
          return { ok: false, dead: true, reason: et };
        }
        T('会话修复', '⏳ 这次没换成（' + et.slice(0, 70) + '）→ 先不下结论');
        return { ok: false, reason: et };
      });
    })['catch'](function (e) {
      var et = errText(e);
      T('会话修复', '⏳ 没换成（' + et.slice(0, 70) + '）');
      return { ok: false, reason: et };
    });
    _recover = p;
    var clr = function () { if (_recover === p) _recover = null; };
    p.then(clr, clr);
    return p;
  }

  /* 🔴v1031: 本地标记 ≠ 云端会话仍在。提供真实探测，避免"以为登录着其实没有"。 */
  /* 🔴v1077：面板 ③b 的数据来源就是这里。
     它原本也是**问一次就下结论**，于是与 ensureSession 犯同一个错：
     SDK 异步落定凭证的那几百毫秒里拿到空，就报「云端会话已失效」。
     用户看到的正是这一幕 —— ③ 显示已登录、③b 却说已失效。
     现在直接复用 ensureSession（带重试 + 区分尚未就绪/确凿过期），
     **两处不再各写一套判据**（本项目已因"同一件事两处真源"栽过八次）。 */
  function verifySession() {
    return ensureSession().then(function (r) {
      return {
        ok: !!r.ok,
        uid: r.uid || '',
        notReady: !!r.notReady,
        expired: !!r.expired,
        slow: !!r.slow,
        noCredentials: !!r.noCredentials,
        kind: r.kind || (r.ok ? '' : 'other'),
        uidFrom: r.uidFrom || '',
        tries: r.tries || 1,
        reason: r.reason || ''
      };
    }).catch(function (e) { return { ok: false, reason: errText(e) }; });
  }

  /* 🔴v1059 核心修复：云端读写的**唯一通行证**。

     此前所有云端路径（云存档 8 处调用）都拿 isSignedIn() 放行，而它长这样：
         return !!(lc.method && lc.signedAt);     // 只翻 localStorage
     ——「我登录过」被当成了「我现在还登录着」。

     verifySession()（真正去问云端的那个）v1031 就写好了，
     却**只接在诊断面板上显示给用户看，从没被任何一处决定采用**。
     于是会话过期后：面板正确地打出「❌ 云端会话已失效」，
     而同一个页面的 isSignedIn() 照样返回 true，
     界面继续显示「已登录 +86 186xxxx」，云存档拿着一个没有凭证的
     实例去读数据库，只拿回 credentials not found。
     这是本项目第四次「同一件事两处真源，而关键路径用了假的那个」。

     ensureSession() 把真源收敛成一处，并在**确认**会话已死时
     清掉那个撒谎的本地标记，让界面立刻说实话、让用户能重新登录。

     ⚠️ 只在「确定」时才清标记：getLoginState() 正常返回但无 uid（SDK 自己
     说没会话），或错误明确是鉴权类。断网等不确定情况**绝不动本地标记**，
     否则一次地铁进隧道就把用户登出了。 */
  /* 🔴v1077 关键修复：**空登录态要重试，不能问一次就下结论；
     而且「尚未就绪」与「确凿过期」必须分开说。**

     用户真机现场：明确确认「刚退出登录、重新用手机号登录成功了」，
     面板却同时显示 ③ 已登录 / ③b 云端会话已失效、写入失败「云端登录已过期」。

     根因链：
       登录成功 → SDK 正在**异步**把凭证写进本地存储（还没落定）
         ↓ 这几百毫秒内
       开机恢复 / 面板 / 上传 去问 getLoginState() → 返回空
         ↓ 空 = "还没好"，v1059 却把它标成 expired:true（"确凿过期"）
       吐出「云端登录已过期，请重新登录」→ 用户退出重登 → 循环重演

     用户因此被困在死循环里：每次登录都真的成功，
     但每次都在凭证落定前被问了一次，然后被告知"已过期"。

     v1059 那行 `{ ok:false, expired:true, definite:false }` 本身就自相矛盾：
     既说"说不准"(definite:false)，又说"确凿过期"(expired:true)。
     下游只看 expired，于是把"还没好"讲成了"已过期"。 */
  /* 🔴v1078：把每一步都记下来。

     开发容器连不上腾讯云，云端这条链**只能靠用户截图来看**。
     而前几版我一直在"猜哪一步坏了"——v1076 猜匿名冲凭证、
     v1077 猜凭证未落定，每次都只能等下一张截图来证伪。
     这一整轮最大的教训本来就是「看不见现场就别动手，先造能看见的工具」，
     我在云端登录这件事上又犯了同一个毛病。

     所以这里留下完整轨迹：每次探测问了几次、每次拿到什么形状、
     最终结论是什么、原始错误是什么。用户截一张图，我就能直接读出真相，
     不必再猜。 */
  var _trace = [];
  function T(step, detail) {
    try {
      _trace.push({ t: Date.now(), step: step, detail: detail });
      if (_trace.length > 60) _trace.shift();
    } catch (e) {}
  }
  function traceText() {
    if (!_trace.length) return '(尚无记录，请先做一次云端操作)';
    var t0 = _trace[0].t;
    return _trace.map(function (x) {
      return '+' + String(x.t - t0).padStart(5) + 'ms  ' + x.step +
             (x.detail ? ('  ' + x.detail) : '');
    }).join('\n');
  }

  /* 🔴v1164：会话判定按 SDK 2.30.0 的真实行为重写（读源码 + 模拟云端逐条实测）：

       getLoginState() 为 null 时，看本机还有没有 credentials_<env>：
         · 凭证还在 → 只是暂时连不上（刷新网络失败等）→ 尚未就绪，稍后重试；
         · 凭证没了 → 先请凭证守护用影子副本救一次；救不了 → **确凿过期**，
           去重新登录（60 秒新鲜期内仍只当"尚未就绪"，防刚登录就被踢出）。
           以前一律说"尚未就绪"，于是凭证被 invalid_grant 删掉的人永远在"稍候再试"。
       getLoginState() 有值却没 uid（user_info 缓存被删）→ getCurrentUser() 向云端补取，
         再不行就从登录令牌（JWT sub）取。以前直接判"尚未就绪"，已登录的人也进不了天梯。
       user_info 缓存坏了 → getLoginState 会抛 SyntaxError（它唯一会抛错的情况），
         以前被 /token/ 误判成"确凿过期"把人登出。现在删掉坏缓存再探一次。
       刷新请求没有超时 → 整个探测限 10 秒，超时就报"网络太慢"（不判过期）。

     返回值（房间/天梯/云存档都靠它）：
       成功 {ok:true, uid, tries}
       失败 {ok:false, kind, reason, notReady, expired, definite, slow?, noCredentials?, notSignedIn?}
         kind: 'signin' 没登录 | 'expired' 确凿过期 | 'session' 暂时没就绪 |
               'slow' 超时 | 'network' 断网类 | 'config' 云服务没配 | 'other' */
  var SESSION_TIMEOUT_MS = 10000;
  var USER_FETCH_TIMEOUT_MS = 6000;

  function isFresh() {
    try {
      var lc0 = readLocal();
      return !!(lc0 && lc0.signedAt && (Date.now() - lc0.signedAt) < 60000);
    } catch (e0) { return false; }
  }

  /* 从登录态里挑 uid（v1163：不同 SDK 版本放的位置不一样，挨个找） */
  function pickUid(st) {
    var uid = '';
    try {
      var cands = [
        st && st.uid,
        st && st.user && st.user.uid,
        st && st.user && st.user.userId,
        st && st.credential && st.credential.uid,
        st && st.userInfo && st.userInfo.uid,
        st && st.loginState && st.loginState.uid,
        st && st.data && st.data.uid
      ];
      for (var _c = 0; _c < cands.length; _c++) {
        var v = cands[_c];
        if (typeof v === 'number' && isFinite(v)) v = String(v);
        if (v && typeof v === 'string') { uid = v; break; }
      }
      if (!uid && st && typeof st === 'object') {
        T('结构', '拿不到 uid，顶层键=[' + Object.keys(st).join(',').slice(0, 120) + ']');
      }
    } catch (e) {}
    return uid;
  }

  /* 有会话、缓存里没 uid：先问云端（getCurrentUser 会重新拉 /user/me 并补回缓存），
     不行再读登录令牌里的 sub。两个都限时，网卡住也不会把探测拖死。 */
  function recoverUid(a) {
    var first = (typeof a.getCurrentUser === 'function')
      ? withTimeout(Promise.resolve().then(function () { return a.getCurrentUser(); }), USER_FETCH_TIMEOUT_MS, '取账号信息')
          .then(function (u) {
            var id = u && (u.uid || u.sub);
            return id ? String(id) : '';
          }, function (e) { T('补 uid', 'getCurrentUser 没成功：' + errText(e).slice(0, 80)); return ''; })
      : Promise.resolve('');
    return first.then(function (id) {
      if (id) return { uid: id, from: '云端账号信息' };
      if (typeof a.getClaims !== 'function') return { uid: '' };
      return withTimeout(Promise.resolve().then(function () { return a.getClaims(); }), USER_FETCH_TIMEOUT_MS, '读登录令牌')
        .then(function (c) {
          var cl = (c && c.data && c.data.claims) || (c && c.claims) || c;
          var sub = cl && cl.sub;
          if (!sub) T('补 uid', '❗登录令牌里也没有 sub');
          return sub ? { uid: String(sub), from: '登录令牌' } : { uid: '' };
        }, function (e) { T('补 uid', 'getClaims 没成功：' + errText(e).slice(0, 80)); return { uid: '' }; });
    });
  }

  var _lastOkAt = 0;   /* 上次探测成功的时间：30 秒内又来问就少记几行，别把出错时的轨迹挤掉 */
  var _inflight = null;
  /* 同一时刻只探一次：房间心跳、轮询、云存档常常同时来问，共用这一次的结果 */
  function ensureSession() {
    if (_inflight) return _inflight;
    var p = ensureSessionOnce();
    _inflight = p;
    p.then(function () { if (_inflight === p) _inflight = null; });
    return p;
  }
  function ensureSessionOnce() {
    var quiet = (Date.now() - _lastOkAt) < 30000;
    if (!quiet) T('ensureSession 开始', 'isSignedIn=' + isSignedIn());
    if (!isSignedIn()) {
      T('结论', '本机没有登录记录 → 需要先登录');
      return Promise.resolve({ ok: false, notSignedIn: true, expired: false, notReady: false,
                               definite: false, kind: 'signin', reason: 'not-signed-in' });
    }
    if (!quiet) try {
      var _lc = readLocal();
      T('本地登录记录', 'method=' + (_lc.method || '无') +
        ' 距登录=' + (_lc.signedAt ? Math.round((Date.now() - _lc.signedAt) / 1000) + '秒' : '未知'));
    } catch (e) {}

    /* 🔴v1079：把 SDK 自己的凭证键也列出来 —— 一眼分辨"凭证根本不在"还是"在但用不了"。 */
    if (!quiet) try {
      var _ks = [], _n = 0;
      lsKeys().forEach(function (_k) {
        if (/cloudbase|tcb|credential|access_token|refresh_token|auth/i.test(_k)) {
          _n++;
          var _val = '';
          try { _val = String(localStorage.getItem(_k) || ''); } catch (e2) {}
          _ks.push(_k.slice(0, 46) + '(' + _val.length + '字节)');
        }
      });
      T('SDK 凭证键', _n ? (_n + ' 个 → ' + _ks.slice(0, 4).join('  ')) :
        '❗一个都没有 —— SDK 从未把凭证写进本地存储');
      var _uk = userInfoKey();
      if (_uk) {
        var _uv = localStorage.getItem(_uk);
        T('用户信息缓存', _uv == null ? '没有（uid 要向云端补取）' :
          (userInfoCorrupt() ? '❗已损坏（' + String(_uv).length + '字节）' : '有（' + String(_uv).length + '字节）'));
      }
      var _G = window.HansenCredGuard;
      if (_G && typeof _G.status === 'function') {
        var _gs = _G.status();
        T('凭证守护', '影子副本=' + (_gs.hasShadow ? ('有(' + _gs.shadowAge + '秒前)') : '无') +
          ' 已救=' + _gs.rescued + '/' + (_gs.maxRescue || 3));
      }
    } catch (e) {}

    var RETRY_DELAYS = [120, 260, 500, 900];   /* 累计约 1.8 秒 */

    var core = auth().then(function (a) {
      if (typeof a.getLoginState !== 'function') {
        T('结论', '❗云端 SDK 没有 getLoginState（版本不对？）');
        return { ok: false, notReady: true, expired: false, definite: false, kind: 'other', reason: 'no-api' };
      }
      var rescued = false, fixedInfo = false, looked = false;

      /* 还没拿到会话：按 RETRY_DELAYS 再问；问到底仍没有就说"尚未就绪"（不判过期） */
      function again(i, why) {
        if (i < RETRY_DELAYS.length) {
          return new Promise(function (res) { setTimeout(res, RETRY_DELAYS[i]); })
            .then(function () { return probe(i + 1); });
        }
        T('结论', '⏳ 重试 ' + (i + 1) + ' 次仍没拿到会话（' + why + '）→ 尚未就绪，不判过期');
        return {
          ok: false, notReady: true, expired: false, definite: false, kind: 'session', tries: i + 1,
          reason: '云端会话尚未就绪（已重试 ' + (i + 1) + ' 次），请稍候再试'
        };
      }

      function onErr(e, i) {
        var t = errText(e);
        if (!fixedInfo && userInfoCorrupt()) {
          fixedInfo = true;
          try { localStorage.removeItem(userInfoKey()); } catch (e2) {}
          T('缓存修复', '❗SDK 的 user_info 缓存坏了（' + t.slice(0, 60) + '）→ 已删掉，再探一次');
          return probe(i + 1);
        }
        /* SyntaxError/TypeError 是程序层面的坏数据，不是"云端说你没登录" */
        var nm = String((e && e.name) || '');
        var codeBug = /SyntaxError|TypeError/.test(nm) || /unexpected token|in json/i.test(t);
        /* 只有云端明确说「你没通过鉴权」才算确凿（用户截图里的 credentials not found 正属此类） */
        var authErr = !codeBug && /unauthenticated|credentials|token|expired|unauthorized|40[13]/i.test(t);
        T('探测抛错', (authErr ? '确凿鉴权错误：' : '非鉴权错误：') + t.slice(0, 90));
        if (authErr) return { ok: false, expired: true, definite: true, notReady: false, kind: 'expired', tries: i + 1, reason: t };
        return { ok: false, expired: false, definite: false, notReady: true,
                 kind: netLike(t) ? 'network' : 'session', tries: i + 1, reason: t };
      }

      function probe(i) {
        return Promise.resolve().then(function () { return a.getLoginState(); }).then(function (st) {
          var uid = pickUid(st);
          /* 刚成功过、这次又一次就成：只记一行结论 */
          if (!(quiet && uid && i === 0)) T('探测#' + (i + 1),
            st == null ? '返回 null' :
            ('类型=' + (typeof st) + ' 键=[' + Object.keys(st).slice(0, 6).join(',') + ']' +
             ' uid=' + (uid || '(无)')));
          if (uid) { T('结论', '✅ 有效 uid=' + uid + '（第 ' + (i + 1) + ' 次探到）'); return { ok: true, uid: uid, tries: i + 1 }; }

          if (st) {
            T('判定', '有会话但本机缓存里没有 uid → 向云端补取');
            return recoverUid(a).then(function (got) {
              if (got.uid) {
                T('结论', '✅ 有效 uid=' + got.uid + '（从' + got.from + '补回，第 ' + (i + 1) + ' 次探测）');
                return { ok: true, uid: got.uid, tries: i + 1, uidFrom: got.from };
              }
              return again(i, '有会话但补不到 uid');
            });
          }
          if (credentialsPresent()) {
            T('判定', '本机云端凭证还在 → 多半是网络慢或刷新没成功，再等等');
            return again(i, '凭证还在');
          }
          if (!rescued && credGuardRescue()) {
            rescued = true;
            T('凭证守护', '🛟 本机凭证不在，已用影子副本救回 → 马上再探一次');
            return probe(i + 1);
          }
          if (isFresh()) {
            T('判定', '本机没有云端凭证，但刚登录不到 60 秒 → 先不判过期');
            return again(i, '刚登录');
          }
          if (!looked) {
            /* 🔴v1164（审查 AUTH-5）：两个页面同时刷新令牌时，另一个页面可能刚换到新凭证、马上就写回来 ——
               等 1.5 秒再看一眼，别把两个页面一起判成「登录过期」 */
            looked = true;
            var lookAt = Date.now();
            T('判定', '凭证不在 —— 等 1.5 秒再看一眼（另一个页面可能正在换新凭证）');
            return new Promise(function (res) { setTimeout(res, 1500); }).then(function () {
              if (credentialsPresent() || credGuardRescue(lookAt)) { T('判定', '凭证又回来了 → 再探一次'); return probe(i + 1); }
              return expiredNow(i);
            });
          }
          return expiredNow(i);
        }, function (e) { return onErr(e, i); });
      }
      function expiredNow(i) {
          T('结论', '❌ 本机没有云端凭证（credentials_ 不在，守护也救不回）→ 确凿过期，需要重新登录');
          return {
            ok: false, expired: true, definite: true, notReady: false, noCredentials: true,
            kind: 'expired', tries: i + 1,
            reason: '云端登录已过期：这台设备上的登录凭证没有了，请重新登录'
          };
      }
      return probe(0);
    }).catch(function (e) {
      var t = errText(e);
      T('结论', '❗云端模块没准备好：' + t.slice(0, 90));
      if (e && e.reload) {
        return { ok: false, expired: false, definite: false, notReady: true, reload: true, kind: 'network', reason: t };
      }
      return { ok: false, expired: false, definite: false, notReady: true,
               kind: /未配置/.test(t) ? 'config' : (netLike(t) ? 'network' : 'session'), reason: t };
    }).then(function (r) {
      _lastOkAt = r.ok ? Date.now() : 0;
      if (!r.ok && r.definite) {
        /* 🔴v1063 竞态防线（保留）：刚登录 60 秒内**绝不清本地标记**，只拒绝本次操作。 */
        if (isFresh()) { T('结论', '刚登录不到 60 秒 → 这次先不清本地登录记录'); return r; }
        clearSignedIn(r);
      }
      return r;
    });

    /* 整个探测限时：SDK 的刷新请求没有超时，网卡住时以前会一直转圈 */
    return new Promise(function (resolve) {
      var settled = false;
      var cancel = timeoutAfter(SESSION_TIMEOUT_MS, function () {
        if (settled) return;
        settled = true; _lastOkAt = 0;
        T('结论', '⌛ ' + (SESSION_TIMEOUT_MS / 1000) + ' 秒没等到云端回应 → 网络太慢（不判过期，稍后重试）');
        resolve({
          ok: false, notReady: true, slow: true, timeout: true, expired: false, definite: false, kind: 'slow',
          reason: '连接云端超时（' + (SESSION_TIMEOUT_MS / 1000) + ' 秒没有回应），网络可能太慢，请稍后再试'
        });
      });
      core.then(function (r) {
        if (settled) return;
        settled = true; cancel(); resolve(r);
      }, function (e) {
        if (settled) return;
        settled = true; cancel();
        resolve({ ok: false, notReady: true, expired: false, definite: false, kind: 'other', reason: errText(e) });
      });
    });
  }

  /* 🔴v1093：**用户可见的入口一律包一层可读错误。**
     实测子框里走真实 SDK 路径时，抛出来的是 CloudBase 的普通对象，
     界面直接显示成 `[object Object]` —— 正是本轮反复强调不许再出现的东西
     （v1059 那次它盖住真错误盖了 40 版）。
     这里对 sendPhoneCode / loginByPhoneCode / 用户名登录注册统一兜住：
     错误一律经 errText 转成人话再抛出。 */
  function _readable(fn) {
    return function () {
      var args = arguments, self = this;
      try {
        return Promise.resolve(fn.apply(self, args))['catch'](function (e) {
          if (e && e.friendly) throw e;          /* 已经是人话，原样透出 */
          var t = errText(e) || '操作失败';
          var e2 = new Error(t);
          e2.friendly = true;
          if (e) { e2.expired = !!e.expired; e2.sessionDead = !!e.sessionDead; e2.notReady = !!e.notReady; }
          throw e2;
        });
      } catch (e) {
        var t2 = errText(e) || '操作失败';
        var e3 = new Error(t2); e3.friendly = true;
        return Promise.reject(e3);
      }
    };
  }

  /* ── 🔴v1147 跨标签页的账号变更 ──────────────────────────

     推演：用户开着两个标签页。
       标签A：登着张三，正在玩
       标签B：在这里点了退出，登了李四

     → **标签A 完全不知道账号变了**，继续往 localStorage 写张三的进度
     → 而归属标记已经是李四了
     → **张三的新进度被算成李四的，下次同步传到李四账号**

     手机上不常开多标签，但电脑上很常见；
     而且"一个标签停在旧页面没关"这件事本身就很普遍。

     `storage` 事件专门为此设计：**别的标签页改了 localStorage，
     本标签页会收到通知**（自己改的不会触发，正合适）。

     收到账号变更后做什么：**不自作主张改数据，只提示用户刷新。**
     因为这个标签页此刻的内存状态（正在进行的一局、未保存的输入）
     没法安全迁移到新账号名下 —— 让用户自己决定什么时候刷新最稳妥。 */
  function watchCrossTabAuth() {
    if (window.__hsnAuthTabWatch) return;
    window.__hsnAuthTabWatch = 1;
    var mine = '';
    try { mine = (readLocal() || {}).uid || ''; } catch (e) {}
    try {
      window.addEventListener('storage', function (ev) {
        if (!ev || ev.key !== LKEY) return;
        var now = '', nv = null;
        try { nv = JSON.parse(ev.newValue || '{}') || {}; now = nv.uid || ''; } catch (e) {}
        /* 🔴v1164（审查 AUTH-2）：同一个标签页里的岛（iframe）改了登录记录，首页外壳也会收到这个通知 ——
           那不是「别的窗口」：孩子就在这个岛里登录 / 发现过期的。以前一律盖上「别的窗口退出了登录 · 刷新这个窗口」，
           把岛自己的「重新登录」整个挡住。是这个标签页写的就只更新记下的 uid，不提示。 */
        if (nv && nv._tab && nv._tab === tabId()) { mine = now; return; }
        if (now === mine) return;              /* 没变 */
        var was = mine;
        mine = now;
        try {
          document.dispatchEvent(new CustomEvent('hsn-auth-changed-elsewhere',
            { detail: { from: was, to: now } }));
        } catch (e) {}
        notifyTabStale(was, now);
      });
    } catch (e) {}
  }

  /* 提示这个标签页已经过期 —— 盖一层，别让人继续在这里玩 */
  function notifyTabStale(was, now) {
    try {
      if (document.getElementById('hsnTabStale')) return;

      /* 🔴v1148：**先把正在进行的对战收掉，再盖提示。**

         实测：提示盖上了，但**对战的定时器还在后台跑** ——
         心跳继续发、回合继续推进，
         → **对手那边看不出任何异常，一直等着一个已经不该在这儿的人**
         → 直到 60 秒掉线判定才结束，白白浪费对方一分钟

         而且这个人此刻用的还是上一个账号的身份，
         打完这局的战绩记到谁头上都不对。

         所以：**盖提示之前先退出房间**。
         对手会立刻收到"对手离场"，比干等一分钟好得多。 */
      try {
        if (window.HansenPkRoomUI && HansenPkRoomUI.close) HansenPkRoomUI.close();
      } catch (e) {}
      try {
        if (window.HansenFriendsUI && HansenFriendsUI.close) HansenFriendsUI.close();
        if (window.HansenLadderUI && HansenLadderUI.close) HansenLadderUI.close();
      } catch (e) {}
      var d = document.createElement('div');
      d.id = 'hsnTabStale';
      d.setAttribute('style',
        'position:fixed;inset:0;z-index:2147483646;background:rgba(11,16,32,.96);' +
        'color:#e8eefc;display:flex;flex-direction:column;align-items:center;' +
        'justify-content:center;padding:24px;text-align:center;' +
        'font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
      var what = now ? '别的窗口登录了另一个账号' : '别的窗口退出了登录';
      d.innerHTML =
        '<div style="font-size:44px">\ud83d\udd04</div>' +
        '<div style="font-size:18px;font-weight:800;margin-top:12px">' + what + '</div>' +
        '<div style="font-size:13.5px;color:#a9b4c7;margin-top:10px;line-height:1.8;max-width:330px">' +
          '这个窗口还停在上一个账号，<br>继续玩会把进度记到错的账号上。<br>刷新一下就好。' +
        '</div>' +
        '<button id="hsnTabStaleBtn" style="margin-top:20px;background:linear-gradient(135deg,#4f46e5,#4338ca);' +
          'color:#fff;border:0;padding:14px 26px;border-radius:14px;font-size:16px;font-weight:800;' +
          'cursor:pointer">刷新这个窗口</button>';
      (document.body || document.documentElement).appendChild(d);
      var btn = document.getElementById('hsnTabStaleBtn');
      if (btn) btn.onclick = function () { try { location.reload(); } catch (e) {} };
    } catch (e) {}
  }

  try { watchCrossTabAuth(); } catch (e) {}

  window.HansenAuth = {
    /* v1163: 让测试能直接验「登录同步」的分支走向 ——
       这条规则会删本机数据，必须能自动验证，不能只靠人工点。 */
    _syncOnLoginForTest: syncOnLogin,
    /* 审查 R2-3/R2-4：云存档上传前问一句「现在能传吗」（对账中 / 本机进度是别人的 / 没对上账 → 不能） */
    uploadGate: uploadGate,
    ready: ready,
    isSignedIn: isSignedIn,
    ensureSession: ensureSession,
    errText: errText,
    currentUser: currentUser,
    currentUserAsync: currentUserAsync,
    verifySession: verifySession,
    readLocal: readLocal,
    normPhone: normPhone,
    friendly: friendly,
    sendPhoneCode: _readable(sendPhoneCode),
    loginByPhoneCode: _readable(loginByPhoneCode),
    loginByPassword: loginByPassword,
    registerByPassword: registerByPassword,
    normUsername: normUsername,
    mailOfUsername: mailOfUsername,
    signOut: signOut,
    _trace: traceText,   /* v1078: 面板读它来展示完整轨迹 */
    ensureProfile: ensureProfile,
    pushSave: pushSave,
    syncOnLogin: syncOnLogin,
    localHasProgress: localHasProgress,
    localProgressSize: localProgressSize,
    pullSave: pullSave,
    _setAuthForTest: function (a) { _authOverride = a; },
    /* v1164：给诊断面板 / 测试看的判据（与 ensureSession 同一份） */
    credentialsPresent: credentialsPresent,
    _app: app,
    /* v1164：取 SDK 模块只有这一个出口（云存档没登录时也走这里，别各自 import 出第二份） */
    _sdk: loadSdk,
    /* 审查 TI-4：登录服务通不通 —— 数据库报 network request error 时，用它分辨「真断网」还是「数据库拒绝」 */
    probeCloud: probeCloud,
    /* 审查 T5/FX-8/R2-UI-8：数据库接连失败时到底是断网、太慢、登录过期，还是数据库那边（再试一次之后才下结论） */
    diagnose: diagnose,
    /* 审查 R2-UI-7：数据库不认令牌时先换一张；换不到就清本机「已登录」 */
    recoverSession: recoverSession,
    markExpired: markExpired,
    claimLocalProgress: claimLocalProgress,
    /* v1093: 供子框借用顶层已建好的 auth 对象 */
    _authObj: function () { return _auth; }
  };
})();
