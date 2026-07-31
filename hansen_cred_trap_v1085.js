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

  function text() {
    if (!HITS.length) return '(本次会话中没有任何模块动过凭证)';
    return HITS.map(function (h) {
      return '+' + String(h.dt).padStart(6) + 'ms  ' + h.action + '  ' + h.key
             + (h.extra ? ('  ' + h.extra) : '')
             + '\n      ' + h.where;
    }).join('\n');
  }

  window.HansenCredTrap = { text: text, hits: function () { return HITS.slice(); } };
})();
