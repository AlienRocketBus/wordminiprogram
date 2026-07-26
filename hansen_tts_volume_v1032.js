/* hansen_tts_volume_v1032.js —— 发音音量：全局统一 + 用户可调
 *
 * 问题：全仓 21 处发音调用，音量设置各行其是——
 *   template.html 混着 1.0 / 0.01 / 0，spelling_bee 只有一处设了，
 *   hansen_cards.js 与 hansen_preload.js **完全没设**（听浏览器默认）。
 *   结果就是拼写蜂里声音小、别处声音大，忽大忽小。
 *
 * 为什么不逐个去改那 21 处：改完只解决今天，明天新增一处发音又会漏。
 * 本模块改为**在源头统一**——包装 SpeechSynthesisUtterance 与 Audio，
 * 凡是新建的发音对象一律套用当前音量设置。以后任何新代码自动生效。
 *
 * 例外：音量 ≤0.01 的一律放行不改——那是 iOS 解锁音频用的静音播放，
 *       强行调大会在用户没预期时发出声音。
 */
(function () {
  'use strict';
  if (window.HansenTTSVolume) return;

  var KEY = 'hansen_tts_volume';     /* 0–100，默认 100 */
  var SILENT_MAX = 0.01;             /* 视为"静音解锁"的阈值 */

  function read() {
    try {
      var v = parseInt(localStorage.getItem(KEY), 10);
      if (isFinite(v) && v >= 0 && v <= 100) return v;
    } catch (e) {}
    return 100;
  }
  function write(v) {
    v = Math.max(0, Math.min(100, Math.round(+v || 0)));
    try { localStorage.setItem(KEY, String(v)); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('hsn-tts-volume', { detail: v })); } catch (e) {}
    return v;
  }
  function factor() { return read() / 100; }

  /* ── 统一层①：语音合成 ─────────────────────────────── */
  try {
    var Native = window.SpeechSynthesisUtterance;
    if (Native && !Native.__hsnWrapped) {
      var Wrapped = function (text) {
        var u = new Native(text);
        try {
          var applied = false;
          /* 默认就套上当前音量；若调用方随后显式赋值，用 setter 判断是否为静音解锁 */
          u.volume = factor();
          Object.defineProperty(u, 'volume', {
            configurable: true,
            get: function () { return this.__v == null ? factor() : this.__v; },
            set: function (val) {
              var n = +val;
              if (!isFinite(n)) return;
              /* 静音解锁原样放行；其余一律按用户设置缩放 */
              this.__v = (n <= SILENT_MAX) ? n : factor() * Math.max(0, Math.min(1, n));
              applied = true;
            }
          });
          u.volume = 1;   /* 触发一次，落到 factor() */
        } catch (e) {}
        return u;
      };
      Wrapped.prototype = Native.prototype;
      Wrapped.__hsnWrapped = true;
      window.SpeechSynthesisUtterance = Wrapped;
    }
  } catch (e) {}

  /* ── 统一层②：音频元素（例句/单词音频文件）─────────── */
  try {
    var NativeAudio = window.Audio;
    if (NativeAudio && !NativeAudio.__hsnWrapped) {
      var WrappedAudio = function (src) {
        var a = src === undefined ? new NativeAudio() : new NativeAudio(src);
        /* 🔴v1032 修正：原先只在**创建时**设一次音量，之后任何
           `a.volume = 1` 都会把它覆盖回去——这正是各处音量不一致的根源
           （有的发音点创建后又自己设了一遍，有的没设）。
           改为**拦截赋值**：无论代码写多少，都按用户设定的比例缩放，
           全站从此只有一个音量口径。 */
        try {
          var want = 1;
          Object.defineProperty(a, 'volume', {
            configurable: true,
            get: function () { return want * factor(); },
            set: function (v) {
              v = +v; if (!isFinite(v)) v = 1;
              want = Math.max(0, Math.min(1, v));
              try {
                var d = Object.getOwnPropertyDescriptor(NativeAudio.prototype, 'volume');
                if (d && d.set) d.set.call(a, want * factor());
              } catch (e) {}
            }
          });
          a.volume = 1;   /* 触发一次, 落到 factor() 缩放后的实际值 */
        } catch (e) { try { a.volume = factor(); } catch (e2) {} }
        return a;
      };
      WrappedAudio.prototype = NativeAudio.prototype;
      WrappedAudio.__hsnWrapped = true;
      window.Audio = WrappedAudio;
    }
  } catch (e) {}

  /* 音量变化时，同步已在页面上的音频元素 */
  try {
    document.addEventListener('hsn-tts-volume', function () {
      var f = factor();
      try {
        var list = document.querySelectorAll('audio');
        for (var i = 0; i < list.length; i++) {
          try { list[i].volume = f; } catch (e) {}
        }
      } catch (e) {}
    });
  } catch (e) {}

  /* 试听：让用户调滑块时能立刻听到效果 */
  function preview(word) {
    try {
      if (!window.speechSynthesis) return false;
      speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(word || 'hello');
      u.lang = 'en-US';
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  window.HansenTTSVolume = {
    get: read, set: write, factor: factor, preview: preview, KEY: KEY
  };
})();
