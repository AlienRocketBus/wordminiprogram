/* hansen_cred_trap_v1085.js —— 凭证生死簿：抓出到底是谁弄没了云端凭证
 *
 * ═══ 为什么必须有这个东西 ═══
 *
 * 现场事实（v1084 起用户跑的确实是最新版，故以下证据可信）：
 *   · 某次截图：登录那一刻 `credentials_ambitious-…` 存在，1314 字节
 *   · 约 2 秒后：这把钥匙消失
 *   · 此后 getLoginState() 永远返回 null → 所有云端读写被拦在门外
 *
 * 我为此已经猜错四次（匿名冲凭证 / 异步未落定 / 用错 API / 响应缺 expires_in），
 * 每一次都靠用户截图来证伪。所以不再猜，改为**抓现行**。
 *
 * ═══ v1087 的关键教训：只记「本次会话」等于什么都没抓到 ═══
 *
 * v1086 版本的生死簿只存在内存里。用户下一张截图是这样的：
 *     凭证生死簿：（本次会话中没有任何模块动过凭证）
 *     失败的云端请求：（没有捕获到失败的云端请求）
 * 而 credentials_* 确实不在，本地登录记录却显示 **49 秒前登录过**。
 *
 * 唯一解释：**登录与凭证消失都发生在这个页面加载之前** ——
 * 页面中途重载过（版本守望者 / 开机恢复 / 用户自己刷新都可能），
 * 而日志一重载就全丢。**那句"没有记录"不是答案，是工具漏了。**
 *
 * 所以本版：
 *   ① 日志写进 localStorage，**跨重载累积**，并标出每次页面加载的分界线
 *   ② 登录成功/失败那一刻也写进同一条时间线（由 hansen_auth 调 mark()）
 *   ③ 网络记录同样持久化
 *   ④ **劫持装不上时必须明说** —— 诊断工具最不能犯的错就是
 *      "看起来在工作、其实没在看"，那会让人把"没记录"误当成"没人动过"
 *
 * ═══ 设计约束 ═══
 *   · 只观察，不改变任何行为（原样转发给真实实现）
 *   · 必须在所有其它模块之前加载（不加 defer）
 *   · 与凭证无关的键不记录，否则日志被淹没
 *   · 出任何异常都要退回原生实现，绝不能因诊断代码把应用弄坏
 */
(function () {
  'use strict';
  if (window.HansenCredTrap) return;

  var LOG_KEY = 'hansen_credtrap_log';
  var NET_KEY = 'hansen_credtrap_net';
  var MAX_KEEP = 60;

  /* 只认真正的云端凭证键；`hansen_auth_v1004` 是我们自己的本地标记，不在此列 */
  var KEY_RE = /^credentials|^access_token|^refresh_token|^tcb[_-]|cloudbase.*(?:token|cred)/i;

  var HITS = [];
  var NET = [];
  var rawSetRef = null;              /* 原生 setItem，用于回写日志时绕开自己的劫持 */
  var INSTALLED = false;
  var INSTALL_ERR = '';
  var saving = false;

  function loadArr(key) {
    try {
      var raw = window.localStorage.getItem(key);
      var a = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(a) === '[object Array]' ? a : [];
    } catch (e) { return []; }
  }

  function save(key, arr) {
    if (saving || !rawSetRef) return;
    saving = true;                   /* 防止写日志本身又触发劫持导致递归 */
    try {
      while (arr.length > MAX_KEEP) arr.shift();
      rawSetRef.call(window.localStorage, key, JSON.stringify(arr));
    } catch (e) {}
    saving = false;
  }

  function now() {
    try { return new Date().toLocaleTimeString(); } catch (e) { return ''; }
  }

  function stack() {
    try {
      var s = (new Error()).stack || '';
      return s.split('\n').slice(3, 8)
        .map(function (l) {
          return l.trim().replace(/^at\s+/, '').replace(/https?:\/\/[^/]+\//, '').slice(0, 100);
        })
        .filter(Boolean).join('\n      ');
    } catch (e) { return ''; }
  }

  function note(action, key, extra) {
    try {
      HITS.push({ at: now(), action: action, key: String(key).slice(0, 46),
                  extra: extra || '', where: stack() });
      save(LOG_KEY, HITS);
      try { console.warn('[凭证监视] ' + action + ' ' + key + ' ' + (extra || '')); } catch (e) {}
    } catch (e) {}
  }

  function netNote(url, status, body) {
    try {
      var short = String(url).replace(/^https?:\/\/[^/]+/, '').slice(0, 66);
      var err = '';
      try {
        var j = (typeof body === 'string') ? JSON.parse(body) : body;
        err = (j && (j.error || j.code || j.errCode)) || '';
        if (j && j.error_description) err += ' | ' + String(j.error_description).slice(0, 60);
      } catch (e) { err = String(body || '').slice(0, 66); }
      if (!err && status >= 200 && status < 300) return;      /* 成功且无错误码 → 不记 */
      NET.push({ at: now(), url: short, status: status, err: String(err).slice(0, 90) });
      save(NET_KEY, NET);
      if (/unauthenticated/i.test(String(err))) {
        /* 读 SDK 源码确认：请求拦截器里
             if (withCredentials && resp.error === UNAUTHENTICATED) setCredentials(null)
           —— 任何带凭证的请求回一次 UNAUTHENTICATED，SDK 就把整个凭证删掉。 */
        note('❗❗ 该请求会导致 SDK 清除凭证', short, 'error=' + err);
      }
    } catch (e) {}
  }

  /* ── 安装劫持 ────────────────────────────────────────────── */
  (function install() {
    var LS, proto, rawSet, rawRemove, rawClear;
    try {
      LS = window.localStorage;
      proto = Object.getPrototypeOf(LS) ||
              ((typeof Storage !== 'undefined' && Storage.prototype) || null);
      rawSet = (proto && proto.setItem) || LS.setItem;
      rawRemove = (proto && proto.removeItem) || LS.removeItem;
      rawClear = (proto && proto.clear) || LS.clear;
      if (typeof rawSet !== 'function' || typeof rawRemove !== 'function') {
        INSTALL_ERR = '取不到原生 setItem/removeItem';
        return;
      }
      rawSetRef = rawSet;
    } catch (e) {
      INSTALL_ERR = '拿不到 localStorage';
      return;
    }

    /* 载入历史 + 标出本次页面加载的分界线 —— 这一条让人一眼看出
       "凭证是在上一次会话里没的"，而不是误以为"没人动过" */
    HITS = loadArr(LOG_KEY);
    NET = loadArr(NET_KEY);
    var where = '(未知页面)';
    try { where = String(location.pathname).slice(-28); } catch (e) {}
    HITS.push({ at: now(), action: '── 页面加载 ──', key: where, extra: '', where: '' });
    save(LOG_KEY, HITS);

    try {
      LS.setItem = function (k, v) {
        try { if (KEY_RE.test(String(k))) note('写入', k, String(v || '').length + ' 字节'); } catch (e) {}
        return rawSet.call(LS, k, v);
      };
      LS.removeItem = function (k) {
        try {
          if (KEY_RE.test(String(k))) {
            var had = 0;
            try { had = String(LS.getItem(k) || '').length; } catch (e) {}
            note('❗删除', k, had ? ('原有 ' + had + ' 字节') : '(本就不存在)');
          }
        } catch (e) {}
        return rawRemove.call(LS, k);
      };
      LS.clear = function () {
        try { note('❗清空全部 localStorage', '(clear)', ''); } catch (e) {}
        return rawClear.call(LS);
      };
      INSTALLED = true;
    } catch (e) {
      INSTALL_ERR = '安装劫持失败';
    }
  })();

  /* ── 网络劫持：抓那个触发清除的请求 ───────────────────────── */
  try {
    if (typeof fetch === 'function') {
      var rawFetch = fetch;
      window.fetch = function (input) {
        var u = (typeof input === 'string') ? input : ((input && input.url) || '');
        var p = rawFetch.apply(this, arguments);
        try {
          if (/tcb|cloudbase|tencentcloudapi/i.test(String(u))) {
            p.then(function (r) {
              try {
                r.clone().text().then(function (t) { netNote(u, r.status, t); })['catch'](function () {});
              } catch (e) {}
              return r;
            })['catch'](function () {});
          }
        } catch (e) {}
        return p;
      };
    }
  } catch (e) {}

  try {
    var RawXHR = window.XMLHttpRequest;
    if (RawXHR && RawXHR.prototype) {
      var rawOpen = RawXHR.prototype.open, rawSend = RawXHR.prototype.send;
      RawXHR.prototype.open = function (m, u) { this.__hsnUrl = u; return rawOpen.apply(this, arguments); };
      RawXHR.prototype.send = function () {
        var self = this;
        try {
          if (/tcb|cloudbase|tencentcloudapi/i.test(String(self.__hsnUrl || ''))) {
            self.addEventListener('load', function () {
              netNote(self.__hsnUrl, self.status, self.responseText);
            });
          }
        } catch (e) {}
        return rawSend.apply(this, arguments);
      };
    }
  } catch (e) {}

  /* ── 对外 ────────────────────────────────────────────────── */
  function text() {
    if (!INSTALLED)
      return '❗监视器未能安装（' + (INSTALL_ERR || '未知原因') + '）—— 本页记录不可信';
    if (!HITS.length) return '(尚无记录)';
    return HITS.map(function (h) {
      return (h.at || '') + '  ' + h.action + '  ' + h.key
             + (h.extra ? ('  ' + h.extra) : '')
             + (h.where ? ('\n      ' + h.where) : '');
    }).join('\n');
  }

  function netText() {
    if (!NET.length) return '(没有捕获到失败的云端请求)';
    return NET.map(function (h) {
      return (h.at || '') + '  HTTP ' + h.status + '  ' + h.url + '\n      错误: ' + h.err;
    }).join('\n');
  }

  window.HansenCredTrap = {
    text: text,
    netText: netText,
    installed: function () { return INSTALLED; },
    installError: function () { return INSTALL_ERR; },
    /* 供 hansen_auth 把「登录成功 / 登录后无凭证」写进同一条时间线 */
    mark: function (action, extra) { note(action, '(登录事件)', extra); },
    hits: function () { return HITS.slice(); },
    net: function () { return NET.slice(); },
    clear: function () { HITS = []; NET = []; save(LOG_KEY, HITS); save(NET_KEY, NET); }
  };
})();
