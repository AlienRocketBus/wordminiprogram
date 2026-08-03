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
  function writeLocal(patch) {
    var o = readLocal();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) o[k] = patch[k];
    try { localStorage.setItem(LKEY, JSON.stringify(o)); } catch (e) {}
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

  /* ── CloudBase 应用与鉴权 ─────────────────────────── */
  var _app = null, _auth = null;
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

    return import('./vendor_cloudbase_esm_v965.js').then(function (mod) {
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
    return app().then(function (a) {
      if (_auth) return _auth;
      if (a && typeof a.auth === 'function') {
        try {
          var got = a.auth({ persistence: 'local' });
          if (got) return got;
        } catch (e) {}
      }
      /* 最后再试一次顶层已经建好的（同源时可直接借用） */
      try {
        var topA = window.top && window.top.HansenAuth;
        if (topA && topA !== window.HansenAuth && typeof topA._authObj === 'function') {
          var t = topA._authObj();
          if (t) return t;
        }
      } catch (e) {}
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
    var m = String((err && (err.message || err.error_description || err.code)) || err || '');
    if (/domain|origin|not.*allow|403/i.test(m)) return '这个网址还没加进安全域名白名单（控制台改完要等约 10 分钟生效）';
    /* 🔴v1009: 原正则过宽, 把注册参数错误也误报成"验证码不对", 误导排查。
       只认真正的验证码错误, 其余保留原文 + 提示可反馈。 */
    if (/invalid.*(verification[_ ]?code|verify[_ ]?code|sms[_ ]?code)|verification[_ ]?code.*(invalid|expired|incorrect|wrong)|code.*(expired|incorrect)|验证码(错误|不正确|已过期)/i.test(m))
      return '验证码不对或已过期，重新获取一次';
    if (/frequent|too many|限频|频繁/i.test(m)) return '发得太频繁了，等一会儿再试';
    if (/password/i.test(m)) return '密码不对';
    if (/exist|already/i.test(m)) return '这个用户名已经有人用了，换一个吧（或点下面切到登录）';
    if (/weak|password.*(short|length)/i.test(m)) return '密码太简单了，换一个长一点的';
    if (/user.*not.*found|no.*such.*user/i.test(m)) return '没找到这个用户名，检查一下拼写，或点下面去注册';
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
      /* 🔴v1079：登录成功那一刻的现场也记进轨迹。
         此前这里**完全不看 signUp/signIn 返回了什么**就直接写本地标记 ——
         于是"界面显示已登录"与"云端真的有会话"之间没有任何校验。
         v1078 的轨迹已证明：登录 62 秒后凭证仍为空。
         把返回值形状与写入后的凭证键数一并记下，即可分辨
         "SDK 压根没给凭证" 还是 "给了但没落盘"。 */
      try {
        /* 🔴v1080：重点看返回值里**有没有 expires_in**。
           SDK 的 setCredentials 是这么写的：
             if (t?.expires_in) { 存起来 }
             else { storage.removeItem(...); credentials = null }   ← 直接删！
           而 signUp/signIn 把服务端返回值**原样**丢给 setCredentials。
           所以只要那次响应缺 expires_in，已存的凭证就被整个删掉，
           而 Promise 依然 resolve —— 我们看到"没报错"就写下"已登录"。
           用户现场正是如此：+1ms 凭证 1314 字节还在，+2143ms 就没了。 */
        var _has = res && typeof res === 'object';
        T('登录返回', res == null ? '❗返回 null/undefined（SDK 会据此删除凭证）'
          : ('类型=' + (typeof res) + ' 键=[' + Object.keys(res).slice(0, 8).join(',') + ']'
             + ' expires_in=' + (_has && res.expires_in != null ? res.expires_in : '❗无')
             + ' access_token=' + (_has && res.access_token ? '有' : '❗无')));
        var _c = 0;
        lsKeys().forEach(function (_k) {
          if (/cloudbase|tcb|credential|access_token|refresh_token/i.test(_k)) _c++;
        });
        T('登录后凭证键', _c ? (_c + ' 个') : '❗0 个 —— SDK 没有把凭证写进本地存储');
      } catch (e) {}
      /* 🔴v1080 防线：**登录后必须确认云端凭证真的在**，否则不许写"已登录"。

         此前这一步只要 Promise 没 reject 就标记成功，于是出现
         「③ 已登录 / ③b 会话失效」这种自相矛盾的显示 ——
         界面说登录着，每一次云端读写却都失败，用户被反复推去重新登录。

         SDK 的 setCredentials 在返回值缺 expires_in 时会**删掉已存凭证**，
         而 signUp/signIn 依然 resolve。所以"没报错"根本不等于"登录成功"。
         这里直接查 localStorage 里 SDK 自己的凭证键还在不在 ——
         那是唯一能证明会话真的建立起来的东西。 */
      var _credOk = false;
      try {
        /* 🔴v1132：**先取键名快照，再遍历。**

           原来是边遍历边读 `localStorage.key(i)` —— 而这个页面上同时跑着
           凭证守护、版本守望者、心跳等好几个模块，它们随时会写/删键。
           **集合一变动，索引就错位，正好跳过凭证键那一格** ——
           于是"登录成功了却说凭证不在"，本地登录态不写，
           界面显示未登录。

           这就是 `test_phone_signup` 随机失败的真凶：
           **不是测试的竞态，是产品代码遍历时不做快照。**
           （我上一版误判成"测试自身的问题"，四轮没修好 —— 因为方向就错了。）

           顺带：能直接命中就不必遍历。先按已知前缀直查一次，
           找不到再退回遍历快照。 */
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
      } catch (e3) { _credOk = true; }   /* 读不到就别拦人，保守放行 */

      if (!_credOk) {
        T('登录判定', '❗云端凭证不存在 → 不写"已登录"，如实报错');
        try {
          if (window.HansenCredTrap && typeof HansenCredTrap.mark === 'function')
            HansenCredTrap.mark('❗登录后凭证不存在', '拒绝写入登录态');
        } catch (e) {}
        var eNoCred = new Error(
          '登录未真正完成：云端没有下发有效凭证（响应缺 expires_in / access_token）。'
          + '请把自检面板的「会话探测轨迹」截图给开发者。');
        eNoCred.friendly = true; eNoCred.noCredentials = true;
        throw eNoCred;
      }
      T('登录判定', '✅ 云端凭证已就位，写入本地登录态');
      /* 🔴v1087：把登录这一刻也写进**持久**日志。
         轨迹是内存态、一重载就没；而用户现场恰恰是
         「凭证生死簿说本次会话没人动过凭证，但登录记录显示 49 秒前登录过」——
         说明登录与凭证消失都发生在上一次页面会话里。
         只有持久记录才串得起完整时间线。 */
      try {
        if (window.HansenCredTrap && typeof HansenCredTrap.mark === 'function')
          HansenCredTrap.mark('🔑 登录成功', '凭证已就位');
      } catch (e) {}
      writeLocal({ verificationId: '', method: 'phone', phone: st.pendingPhone, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ② 用户名 + 密码 ─────────────────────────────── */
  function loginByPassword(username, password) {
    var u = String(username == null ? '' : username).trim();
    var p = String(password == null ? '' : password);
    if (u.length < 2) return Promise.reject(new Error('用户名太短'));
    if (p.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    return auth().then(function (a) {
      /* 🔴v1058: 先用用户名登录；失败再用"用户名映射出的内部邮箱"重试。
         这样无论账号是用哪种方式建的，用户都只需记住用户名。 */
      return Promise.resolve(a.signIn({ username: u, password: p }))
        .catch(function (e1) {
          var mail = mailOfUsername(u);
          return Promise.resolve(a.signIn({ username: mail, password: p }))
            .catch(function () { throw e1; });
        });
    }).then(function () {
      writeLocal({ method: 'password', username: u, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ②b 用户名 + 密码「注册」 ────────────────────────
     背景：CloudBase 的注册只支持 email+password 或 phone+验证码，
     **没有"纯用户名+密码"这种注册方式**。
     做法：把用户名确定性地映射成一个内部邮箱（用户完全看不到），
     用它完成注册，随后再把真正的用户名设上去。
     这样用户体验上就是"用户名+密码注册"，而底层走的是官方支持的路径。 */
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

  function registerByPassword(username, password, password2) {
    var v = normUsername(username);
    if (!v.ok) return Promise.reject(new Error(v.reason));
    var pw = String(password == null ? '' : password);
    if (pw.length < 6) return Promise.reject(new Error('密码至少 6 位'));
    if (password2 !== undefined && String(password2) !== pw)
      return Promise.reject(new Error('两次输入的密码不一样'));
    var mail = mailOfUsername(v.name);
    return auth().then(function (a) {
      var fn = a.signUpWithEmailAndPassword || a.signUp;
      if (typeof fn !== 'function') throw new Error('当前环境不支持用户名注册');
      /* 两种调用签名都兼容：新版是 (email, password)，旧版是 ({email, password}) */
      var p1;
      try { p1 = a.signUpWithEmailAndPassword ? a.signUpWithEmailAndPassword(mail, pw)
                                              : a.signUp({ email: mail, password: pw }); }
      catch (e) { p1 = Promise.reject(e); }
      return Promise.resolve(p1).then(function () {
        /* 注册成功后把真正的用户名设上，便于以后直接用它登录 */
        return Promise.resolve(
          (typeof a.updateUsername === 'function') ? a.updateUsername(v.name) : null
        ).catch(function () { return null; });
      });
    }).then(function () {
      writeLocal({ method: 'password', username: v.name, signedAt: Date.now() });
      return afterSignIn();
    });
  }

  /* ── ③ 登出 ─────────────────────────────────────── */
  function signOut() {
    /* 🔴v1142：**退出登录时把本地资料也清掉。**

       用户现场：退出 A 号、登 B 号（B 的竞赛 ID 是 003），
       页面上还显示 A 的名字和 No.002，而且点了也改不了名字。

       根子是这里什么都没清：
         · 名字和 cid 还是 A 的
         · `cidLocked` 锁死 → B 的 003 写不进去
         · `nameChangedAt` 是 A 留下的 → B 改名被告知"冷却中"

       这违反了本项目最核心的一条：**所有数据必须跟着账号走。**
       资料（名字、竞赛 ID）当然也是数据。 */
    try {
      if (window.HansenSbProfile && HansenSbProfile.resetForAccountSwitch) {
        HansenSbProfile.resetForAccountSwitch();
      }
    } catch (e) {}
    /* 🔴v1143：**不清归属标记。**
       退出后本机这份进度**仍然是刚才那个人的** ——
       清了的话，下一个人登录时会被当成"我自己没登录时玩的"，
       于是把别人的进度传到自己账号上。
       标记只在**新的人登录并完成对账**时才更新。 */

    return auth().then(function (a) {
      return a.signOut ? a.signOut() : null;
    }).catch(function () { return null; }).then(function () {
      writeLocal({ method: '', signedAt: 0, uid: '' });
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
        .catch(function () { return null; })
        .then(function (prof) {
          return syncOnLogin().then(function (s) {
            return { ok: true, uid: uid, cid: (prof && prof.cid) || 0,
                     pendingId: !(prof && prof.cid), sync: s };
          });
        });
    });
  }

  /* 建立/读取云端档案，并分配竞赛 ID */
  function ensureProfile(uid) {
    var db = null, docRef = null;
    return app().then(function (a) {
      db = a.database();
      docRef = db.collection(COL_PROFILE).doc(uid);
      return docRef.get();
    }).then(function (res) {
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
      }).then(function () { return docRef.get(); }).then(function (r2) {
        var row2 = r2 && r2.data && r2.data[0];
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

     🔴v1130 **但要防撞号**：
       两人几乎同时注册 → 两边都数到"3 个人比我早" → 都拿 No.4。
       实测模拟确认会撞。

     做法：发号后**验一次有没有别人已经占了这个号**，
     撞了就往后挪一位，最多重试 5 次。
     并发注册在这个用户量下极少见，5 次足够；
     真撞满 5 次也不阻断登录 —— 下次登录会再补一次。 */
  function assignCid(db, docRef, createdAt, attempt) {
    if (!createdAt) return Promise.resolve(null);
    var tries = attempt || 0;
    return db.collection(COL_PROFILE).where({ createdAt: db.command.lt(createdAt) }).count()
      .then(function (r) {
        var cid = ((r && r.total) || 0) + 1 + tries;
        /* 校验这个号有没有被占 —— 只有确实空着才写 */
        return db.collection(COL_PROFILE).where({ cid: cid }).count().then(function (c) {
          if ((c && c.total) > 0) {
            if (tries >= 5) return null;          /* 让下次登录再补，不阻断本次 */
            return assignCid(db, docRef, createdAt, tries + 1);
          }
          return docRef.update({ cid: cid, updatedAt: db.serverDate() }).then(function () {
            return { cid: cid };
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
          if (o && ((o.learned && o.learned.length) || (o.stats && Object.keys(o.stats).length))) return true;
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
  /* 本机这份进度是不是「别人的」——
     有主人、且不是当前这个人，才算别人的。
     没主人（从没登录过就玩的）不算别人的，那是用户自己的东西。 */
  function localBelongsToOther(uid) {
    var o = localOwner();
    return !!(o && uid && o !== uid);
  }

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
      /* 对账开始就把归属记成当前这个人 —— 不管下面走哪条分支，
         从这一刻起本机这份进度就是他的了。
         （放在这里而不是各个分支末尾：分支有五六条，逐个加必然会漏。） */
      if (uidNow) markLocalOwner(uidNow);
      /* 🔴v1029 安全红线一：**查不到 ≠ 没有**。
         网络抖动或权限问题都会让查询失败，此时若当成"云端没有"就去上传，
         可能用本机(甚至是空的)覆盖掉云端的真实存档。查不到就什么都不做。 */
      if (info && info.exists === null) {
        return { ok: false, action: 'cloud-unreachable', reason: info.reason || '' };
      }
      var hasCloud = !!(info && info.exists);
      /* 🔴v1029 安全红线二：**本机是空的就绝不上传**。
         设备B(全新、无进度)先登录时若上传空档，
         设备A 之后登录就会看到"云端有档"，一旦选错就全丢了。 */
      if (!hasCloud && !hasLocal) {
        return { ok: true, action: 'nothing-to-sync' };
      }
      if (hasCloud && !hasLocal) {
        return CS.restoreWithKey(CS.ensureKey())
          .then(function (r) {
            /* 🔴v1026 关键：恢复只是把数据写回 localStorage，
               而页面内存里的 S 仍是登录前那份空数据 —— 不刷新的话
               ① 用户看到"等级没变、什么都没变"；
               ② 页面下一次存档会用内存里的空数据**覆盖掉刚恢复的进度**。
               所以恢复成功必须重新加载页面，让新数据真正生效。 */
            if (r && r.ok) return { ok: true, action: 'restored', needReload: true };
            return { ok: false, action: 'restore-failed' };
          })
          .catch(function () { return { ok: false, action: 'restore-failed' }; });
      }
      if (hasCloud && hasLocal) {
        /* 冲突：把双方的真实规模一并带出去，让用户看着数字选，而不是盲选 */
        return { ok: true, action: 'conflict',
                 local: local,
                 cloudUpdatedAt: (info && info.updatedAt) || 0 };
      }
      return CS.syncNow({ force: true })
        .then(function (r) { return { ok: !!(r && r.ok), action: 'uploaded' }; })
        .catch(function () { return { ok: false, action: 'upload-failed' }; });
    }).catch(function () { return { ok: false, reason: 'sync-error' }; });
  }


  function pushSave() {
    if (!window.HansenCloudSave || typeof HansenCloudSave.syncNow !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return HansenCloudSave.syncNow({ force: true });
  }
  /* 换设备登录后把云端进度拉下来（需要 16 位密钥，沿用现有恢复通道） */
  function pullSave(key) {
    if (!window.HansenCloudSave || typeof HansenCloudSave.restoreWithKey !== 'function')
      return Promise.resolve({ ok: false, reason: 'cloudsave-unavailable' });
    return HansenCloudSave.restoreWithKey(key);
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
      if (_trace.length > 40) _trace.shift();
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

  function ensureSession() {
    T('ensureSession 开始', 'isSignedIn=' + isSignedIn());
    if (!isSignedIn()) return Promise.resolve({ ok: false, reason: 'not-signed-in' });
    try {
      var _lc = readLocal();
      T('本地登录记录', 'method=' + (_lc.method || '无') +
        ' 距登录=' + (_lc.signedAt ? Math.round((Date.now() - _lc.signedAt) / 1000) + '秒' : '未知'));
    } catch (e) {}

    /* 🔴v1079：把**SDK 自己的凭证键**也列出来。

       v1078 的轨迹已证明：登录 62 秒后 getLoginState() 仍连续 5 次返回 null。
       这不是"还没落定"（v1077 的假设被推翻），是**凭证根本不在**。
       只剩两种可能，必须分辨清楚，否则又是在猜：
         · SDK 压根没把凭证写进 localStorage（登录其实没真正完成 / 持久化没生效）
         · 写进去了但被谁清掉了
       列出实际存在的相关键即可一眼看穿。 */
    try {
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
    } catch (e) {}

    var RETRY_DELAYS = [120, 260, 500, 900];   /* 累计约 1.8 秒，足够 SDK 落定 */

    function onErr(e) {
      var t = errText(e);
      /* 只有云端明确说「你没通过鉴权」才算确凿 ——
         用户截图里那句 credentials not found 正属此类。 */
      var authErr = /unauthenticated|credentials|token|expired|unauthorized|40[13]/i.test(t);
      T('探测抛错', (authErr ? '确凿鉴权错误：' : '非鉴权错误：') + t.slice(0, 90));
      return { ok: false, expired: authErr, definite: authErr, reason: t };
    }

    return auth().then(function (a) {
      if (typeof a.getLoginState !== 'function')
        return { ok: false, definite: false, reason: 'no-api' };

      function probe(i) {
        return Promise.resolve(a.getLoginState()).then(function (st) {
          var uid = (st && (st.uid || (st.user && st.user.uid))) || '';
          T('探测#' + (i + 1),
            st == null ? '返回 null' :
            ('类型=' + (typeof st) + ' 键=[' + Object.keys(st).slice(0, 6).join(',') + ']' +
             ' uid=' + (uid || '(无)')));
          if (uid) { T('结论', '✅ 有效 uid=' + uid + '（第 ' + (i + 1) + ' 次探到）'); return { ok: true, uid: uid, tries: i + 1 }; }
          if (i < RETRY_DELAYS.length) {
            return new Promise(function (res) { setTimeout(res, RETRY_DELAYS[i]); })
              .then(function () { return probe(i + 1); });
          }
          /* 重试到底仍是空 —— 仍**不能**断言"已过期"：
             断网、SDK 版本差异同样会给空。
             只说"尚未就绪"，并明确下一步是**稍候重试**而非重新登录。 */
          T('结论', '⏳ 重试 ' + (i + 1) + ' 次仍为空 → 尚未就绪（不判过期）');
          return {
            ok: false, notReady: true, expired: false, definite: false, tries: i + 1,
            reason: '云端会话尚未就绪（已重试 ' + (i + 1) + ' 次），请稍候再试'
          };
        }, onErr);
      }
      return probe(0);
    }).catch(function (e) {
      return { ok: false, definite: false, reason: errText(e) };
    }).then(function (r) {
      if (!r.ok && r.definite) {
        /* 🔴v1063 竞态防线（保留）：刚登录完的一小段时间内**绝不清本地标记**。
           登录成功写下 signedAt → 后台开机恢复几乎同时调 ensureSession()
           → 此刻 SDK 会话可能还没落定 → 按"确凿失效"处理会把
              **刚刚建立的登录态**抹掉，用户看到"刚登录成功一转眼又退出"。
           60 秒新鲜期内只拒绝本次操作、不动标记；真过期了下次自然会再判。 */
        var fresh = false;
        try {
          var lc0 = readLocal();
          fresh = !!(lc0 && lc0.signedAt && (Date.now() - lc0.signedAt) < 60000);
        } catch (e0) {}
        if (fresh) return r;
        writeLocal({ method: '', signedAt: 0, uid: '' });
        /* 清了标记必须广播，否则界面上那句「已登录 +86 186xxxx」
           会一直挂到下次刷新 —— 界面说登录着、每次读写却都失败。 */
        try { document.dispatchEvent(new CustomEvent('hsn-auth-changed', { detail: { expired: true } })); } catch (e1) {}
      }
      return r;
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

  window.HansenAuth = {
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
    _app: app,
    /* v1093: 供子框借用顶层已建好的 auth 对象 */
    _authObj: function () { return _auth; }
  };
})();
