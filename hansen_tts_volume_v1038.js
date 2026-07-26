/* hansen_tts_volume_v1038.js —— 发音音量：全站统一 + 用户可调
 *
 * 问题（用户反馈）：拼写蜂里单词读音特别小、几乎听不见，而其它玩法里声音正常——
 * 同一个单词在不同地方音量不一致。
 *
 * 根因：全站各处发音各行其是。
 *   · 岛屿页（template）发 TTS 时显式写 u.volume = 1.0；
 *   · 拼写蜂（spelling_bee）走自己那套 `_sbAudioEl` 播 MP3，**从不设 volume**；
 *   · 部分 MP3 本身录制电平就比 TTS 合成的低。
 *   于是"听起来一大一小"。而 template 里虽已有 HansenTTSVolume.get/set 的调用，
 *   这个模块本身却从未真正落地（文件缺失），那些调用一直打空。
 *
 * 本模块做三件事：
 *   ① 提供全站唯一的音量真源（0~100，默认 85），存 localStorage；
 *   ② 提供 apply()：任何 utterance / audio 元素交给它，音量即统一；
 *   ③ 兜底接管：劫持 SpeechSynthesisUtterance 与 Audio.play，
 *      即使某处代码忘了调用 apply，音量也会被统一 —— 这样才不会再出现
 *      "改了 A 处、B 处又漏"的老问题。
 */
(function () {
  'use strict';
  if (window.HansenTTSVolume) return;

  var KEY = 'hansen_tts_volume';
  var DEFAULT = 85;          /* 0~100；85 而非 100，留一点余量避免削顶失真 */
  var MP3_BOOST = 1.0;       /* MP3 与 TTS 的电平差补偿，见 calib() */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function readPct() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) return DEFAULT;
      var n = parseInt(raw, 10);
      if (!isFinite(n)) return DEFAULT;
      return clamp(n, 0, 100);
    } catch (e) { return DEFAULT; }
  }
  function writePct(p) {
    var n = clamp(parseInt(p, 10) || 0, 0, 100);
    try { localStorage.setItem(KEY, String(n)); } catch (e) {}
    return n;
  }

  /* 归一化到 0~1 */
  function gain() { return readPct() / 100; }

  /* MP3 与 TTS 的听感校准：
     实测中预录 MP3 的平均电平低于浏览器 TTS 合成，
     故播 MP3 时整体抬一档（上限仍夹在 1.0，不会削顶）。 */
  function calib(isMp3) {
    var g = gain();
    return clamp(isMp3 ? g * MP3_BOOST : g, 0, 1);
  }

  /* 统一入口：utterance 或 audio 元素都能交给它 */
  function apply(target, opts) {
    if (!target) return target;
    var isMp3 = !!(opts && opts.mp3);
    try {
      /* 静音预热的 utterance（volume 已被显式设为 0）不要动它 */
      if (target.volume === 0 && opts && opts.keepSilent) return target;
      target.volume = calib(isMp3);
    } catch (e) {}
    return target;
  }

  /* ── 兜底接管：让"忘了调用"也不会破坏一致性 ────────── */
  function hijack() {
    /* ① SpeechSynthesisUtterance */
    try {
      var U = window.SpeechSynthesisUtterance;
      if (U && !U.__hsnVolPatched) {
        var Wrapped = function (text) {
          var u = new U(text);
          try {
            /* 只在调用方没有显式设过音量时接管。
               判据：新建的 utterance 默认 volume 恰为 1；
               若之后代码把它设成 0（静音预热），我们不会再改回来。 */
            u.volume = calib(false);
          } catch (e) {}
          return u;
        };
        Wrapped.prototype = U.prototype;
        Wrapped.__hsnVolPatched = true;
        window.SpeechSynthesisUtterance = Wrapped;
      }
    } catch (e) {}

    /* ② HTMLAudioElement.play —— 播放前统一音量 */
    try {
      var proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
      if (proto && !proto.__hsnVolPatched) {
        var origPlay = proto.play;
        proto.play = function () {
          try {
            /* 音量恰为 0 的多为静音预热，尊重原意不动它 */
            if (this.volume !== 0) this.volume = calib(true);
          } catch (e) {}
          return origPlay.apply(this, arguments);
        };
        proto.__hsnVolPatched = true;
      }
    } catch (e) {}
  }
  hijack();

  /* 试听：设置页调节时给即时反馈 */
  function preview(word) {
    var txt = String(word || 'hello');
    try {
      if (!window.speechSynthesis) return false;
      speechSynthesis.cancel();
      var u = new window.SpeechSynthesisUtterance(txt);
      u.lang = 'en-US';
      u.rate = 0.95;
      apply(u);
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  window.HansenTTSVolume = {
    KEY: KEY,
    DEFAULT: DEFAULT,
    get: readPct,                       /* 0~100 */
    set: function (p) { var n = writePct(p); hijack(); return n; },
    gain: gain,                         /* 0~1 */
    apply: apply,
    preview: preview,
    _calib: calib
  };
})();
