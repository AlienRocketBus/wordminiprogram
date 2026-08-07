/* hansen_silent_watch_v1155.js —— 让"被吞掉的错误"能被看见
 *
 * 🔴 为什么需要这个：
 *
 *   今天挖出的两个"天梯根本用不了"，**都是被空 catch 吞掉的**：
 *     · `_createForLadder` 没打开界面 → 房建好了、屏幕白的
 *       → 外层 `try{...}catch(e){}` 把报错吃了 → **控制台干干净净**
 *     · 匹配失败 → 同样被吞
 *
 *   一查：对战三个模块里一共有 **56 处空 catch**。
 *   它们本身不是错（很多是防御性的），
 *   但**一旦真出错，没有任何痕迹** —— 从代码看、从日志看都正常，
 *   只有用户看到白屏。
 *
 *   > 空 catch 的代价不是"隐藏了一个错误"，
 *   > 而是"隐藏了错误存在这件事"。
 *
 * 做法：不去改那 56 处（那会引入更大风险），
 * 而是**装一个全局的观察者**：把 window.onerror 和
 * unhandledrejection 记进一个环形缓冲区，
 * 云端自检面板里能看到最近 30 条。
 *
 * 平时零成本（只是记在内存里），出问题时能立刻知道"是不是有东西在悄悄报错"。
 */
(function () {
  'use strict';
  var MAX = 30;
  var buf = [];

  function note(kind, msg, extra) {
    try {
      buf.push({
        t: new Date().toLocaleTimeString(),
        kind: kind,
        msg: String(msg || '').slice(0, 160),
        at: String(extra || '').slice(0, 90)
      });
      if (buf.length > MAX) buf.shift();
    } catch (e) {}
  }

  try {
    window.addEventListener('error', function (ev) {
      note('error', ev && ev.message,
           ev && ev.filename ? (ev.filename.split('/').pop() + ':' + ev.lineno) : '');
    });
    /* Promise 里抛的错最容易被漏掉 —— 而对战/天梯全是 Promise 链 */
    window.addEventListener('unhandledrejection', function (ev) {
      var r = ev && ev.reason;
      note('promise', (r && r.message) || r, '');
    });
  } catch (e) {}

  window.HansenSilentWatch = {
    recent: function () { return buf.slice(); },
    count: function () { return buf.length; },
    clear: function () { buf.length = 0; },
    /* 给自检面板用：一段可读的摘要 */
    report: function () {
      if (!buf.length) return '最近没有悄悄报错 ✅';
      return buf.slice(-10).map(function (x) {
        return '[' + x.t + '] ' + x.kind + ': ' + x.msg + (x.at ? ' @' + x.at : '');
      }).join('\n');
    }
  };
})();
