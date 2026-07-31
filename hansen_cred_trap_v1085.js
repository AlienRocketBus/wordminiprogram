/* hansen_cred_trap_v1085.js —— 抓现行：到底是谁删掉了云端凭证
 *
 * 为什么必须做这个
 * ================
 * 现场事实（v1084 已确认部署，所以以下证据可信）：
 *   · 登录成功那一刻：`credentials_ambitious-…` 存在，1314 字节
 *   · 大约 2 秒后：这把钥匙**消失**
 *   · 此后 getLoginState() 永远返回 null → 所有云端读写被拦在门外
 *
 * 我为此已经猜错三次：
 *   v1076 猜「匿名登录冲掉凭证」→ 用户回复匿名是开着的
 *   v1077 猜「凭证还没异步落定」→ 轨迹显示登录 62 秒后仍为空
 *   v1080 猜「signUp 响应缺 expires_in 导致 setCredentials 删掉」→ 有依据但未证实
 *
 * **不再猜。** 这个模块把 localStorage 的写入/删除全部劫持，
 * 一旦有人动了 `credentials_*` 这把钥匙，就**当场记下调用栈**。
 * 下一张截图就能直接看到是哪一行代码删的。
 *
 * 设计上必须极其克制：
 *   · 只观察、不改变任何行为（原样转发给真实实现）
 *   · 必须在所有其它模块之前加载，否则抓不到早期动作
 *   · 出任何异常都要静默退回原生实现，绝不能因为诊断代码把应用弄坏
 */
(function () {
  'use strict';
  if (window.HansenCredTrap) return;

  var HITS = [];
  var T0 = Date.now();
  var KEY_RE = /^credentials|access_token|refresh_token|^tcb|cloudbase.*(?:token|cred)/i;

  function stack() {
    try {
      var s = new Error().stack || '';
      return s.split('\n').slice(2, 7)
        .map(function (l) {
          return l.trim()
            .replace(/^at\s+/, '')
            .replace(/https?:\/\/[^/]+\//, '')
            .slice(0, 110);
        })
        .filter(Boolean).join('\n      ');
    } catch (e) { return '(取不到调用栈)'; }
  }

  function note(action, key, extra) {
    try {
      HITS.push({
        dt: Date.now() - T0,
        action: action,
        key: String(key).slice(0, 50),
        extra: extra || '',
        where: stack()
      });
      if (HITS.length > 30) HITS.shift();
      try { console.warn('[凭证监视] ' + action + ' ' + key + ' ' + (extra || '')); } catch (e) {}
    } catch (e) {}
  }

  try {
    var LS = window.localStorage;
    var proto = Object.getPrototypeOf(LS) || Storage.prototype;
    var rawSet = proto.setItem, rawRemove = proto.removeItem, rawClear = proto.clear;

    LS.setItem = function (k, v) {
      try { if (KEY_RE.test(String(k))) note('写入', k, String(v || '').length + ' 字节'); } catch (e) {}
      return rawSet.call(LS, k, v);
    };
    LS.removeItem = function (k) {
      try {
        if (KEY_RE.test(String(k))) {
          var had = 0;
          try { had = String(rawSet && LS.getItem(k) || '').length; } catch (e) {}
          note('❗删除', k, had ? ('原有 ' + had + ' 字节') : '(本就不存在)');
        }
      } catch (e) {}
      return rawRemove.call(LS, k);
    };
    LS.clear = function () {
      note('❗清空全部 localStorage', '(clear)', '');
      return rawClear.call(LS);
    };
  } catch (e) {
    /* 劫持失败就彻底放弃观察 —— 绝不能因为诊断代码影响应用 */
    try { console.warn('[凭证监视] 无法安装：' + (e && e.message)); } catch (e2) {}
  }


  /* 🔴v1086：抓「是哪个请求把凭证弄没的」。

     读 SDK 源码找到的确凿机制（不是推测）——请求拦截器里有这么一段：

         return n.withCredentials && d && d.error === UNAUTHENTICATED
              ? [4, this.setCredentials(null)]     // ← 删掉凭证！
              : [3, 17];

     **任何一个带凭证的请求，只要服务端回一次 UNAUTHENTICATED，
       SDK 就把整个凭证删掉。** 一次失败的数据库读取，毁掉整个登录会话。

     这完全对上现场：登录成功 → 凭证 1314 字节 →
     约 2 秒后（开机云端恢复正好在登录后 1.2 秒发起数据库读取）→
     那次请求被拒 → 凭证被 SDK 自己抹掉 → 之后永远 null。

     所以这里再劫持 fetch/XHR：凡是发往腾讯云的请求，
     记下地址与返回里的 error 字段。下一张截图就能看到
     **是哪个接口、哪张表、什么错误码**触发了这场清除。 */
  var NET = [];
  function netNote(url, status, body) {
    try {
      var short = String(url).replace(/^https?:\/\/[^/]+/, '').slice(0, 70);
      var err = '';
      try {
        var j = typeof body === 'string' ? JSON.parse(body) : body;
        err = (j && (j.error || j.code || j.errCode)) || '';
        if (j && j.error_description) err += ' | ' + String(j.error_description).slice(0, 60);
      } catch (e) { err = String(body || '').slice(0, 70); }
      if (!err && status >= 200 && status < 300) return;   /* 成功且无错误码 → 不记 */
      NET.push({ dt: Date.now() - T0, url: short, status: status, err: String(err).slice(0, 90) });
      if (NET.length > 20) NET.shift();
      if (/unauthenticated/i.test(String(err)))
        note('❗❗ 该请求会导致 SDK 清除凭证', short, 'error=' + err);
    } catch (e) {}
  }

  try {
    if (typeof fetch === 'function') {
      var rawFetch = fetch;
      window.fetch = function (input, init) {
        var u = (typeof input === 'string') ? input : (input && input.url) || '';
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
    if (RawXHR) {
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

  function netText() {
    if (!NET.length) return '(没有捕获到失败的云端请求)';
    return NET.map(function (h) {
      return '+' + String(h.dt).padStart(6) + 'ms  HTTP ' + h.status + '  ' + h.url + '\n      错误: ' + h.err;
    }).join('\n');
  }

  function text() {
    if (!HITS.length) return '(本次会话中没有任何模块动过凭证)';
    return HITS.map(function (h) {
      return '+' + String(h.dt).padStart(6) + 'ms  ' + h.action + '  ' + h.key
             + (h.extra ? ('  ' + h.extra) : '')
             + '\n      ' + h.where;
    }).join('\n');
  }

  window.HansenCredTrap = { text: text, netText: netText,
                            hits: function () { return HITS.slice(); },
                            net: function () { return NET.slice(); } };
})();
