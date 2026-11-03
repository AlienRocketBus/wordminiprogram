/* hansen_theme2_icons — 主题 2.0 小图标（SVG，代替新版 emoji）
 * ------------------------------------------------------------------
 * 为什么：🪙（2020 年才有）、🫧、🪼 在旧手机上会显示成空框（TV-11）。
 *        货币和状态图标改成内联 SVG：每台手机都一样，永远不会是空框。
 * 怎么用：HansenIcons.svg('coin', {size: 20})            → SVG 字符串
 *        HansenIcons.el('star', {label: '星星'})          → <span class="t2-ic">…</span>
 *        HansenIcons.swapEmoji(某个元素)                  → 只换这个元素里面的货币/状态 emoji
 *        HansenIcons.emojiOk('🪼')                       → 这台手机能不能正常显示这个 emoji
 * 铁律：颜色全走 var(--t2-*)（带兜底色，没接 tokens 也能看）；不用渐变/id（同页多个也不冲突）；
 *      不自动扫整页（只在调用时换指定元素）；文件里不写版本号字面量。
 * ------------------------------------------------------------------ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.HansenIcons = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';
  var V = {
    coin: 'var(--t2-coin,#FFC93C)', coinRim: 'var(--t2-coin-rim,#9A6700)', gem: 'var(--t2-gem,#67E8F9)', star: 'var(--t2-star,#FFD54A)',
    starRim: 'var(--t2-star-rim,#9A6700)', off: 'var(--t2-surface-3,#E2E9F7)', offRim: 'var(--t2-line-strong,#7C8AD6)',
    good: 'var(--t2-good,#15803D)', bad: 'var(--t2-bad,#E11D48)', xp1: 'var(--t2-xp-1,#34D399)', xp2: 'var(--t2-xp-2,#22D3EE)'
  };
  /* 每个图标：24×24 画布里的形状。currentColor = 跟着文字颜色走 */
  var P = {
    coin: '<circle cx="12" cy="12" r="10.4" fill="' + V.coin + '" stroke="' + V.coinRim + '" stroke-width="1.8"/>' +
          '<circle cx="12" cy="12" r="6.6" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.4"/>' +
          '<path d="M12 7.6v8.8M9.6 9.8h4.8" stroke="' + V.coinRim + '" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    gem: '<path d="M6 3.2h12l4 5.8L12 21 2 9z" fill="' + V.gem + '" stroke="rgba(0,0,0,.35)" stroke-width="1.1" stroke-linejoin="round"/>' +
         '<path d="M2 9h20M8 3.2 12 21l4-17.8" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.1"/>',
    xp: '<path d="M12 1.8l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 15.3l-5.4 3 1.2-6-4.5-4.2 6.1-.7z" fill="' + V.xp1 + '" stroke="rgba(0,0,0,.3)" stroke-width="1.1" stroke-linejoin="round"/>' +
        '<text x="12" y="23.4" text-anchor="middle" font-size="7.6" font-weight="800" font-family="Baloo2,Arial,sans-serif" fill="currentColor">XP</text>',
    star: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="' + V.star + '" stroke="' + V.starRim + '" stroke-width="1.4" stroke-linejoin="round"/>',
    starOff: '<path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6-4.9-4.6 6.6-.8z" fill="' + V.off + '" stroke="' + V.offRim + '" stroke-width="1.4" stroke-linejoin="round"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z" fill="#FF6A3D" stroke="rgba(0,0,0,.25)" stroke-width=".9"/>' +
           '<path d="M12 12c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.6 1.6-3 .1 1 .6 1.5 1.1 1.5-.4-1.5 0-2.8.3-4z" fill="#FFD54A"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
    cross: '<path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    speaker: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.6" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    heart: '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 8 2.5c0 5.7-8 10.6-8 10.6z" fill="#F43F5E" stroke="rgba(0,0,0,.25)" stroke-width="1"/>',
    trophy: '<path d="M7 3.5h10v5a5 5 0 0 1-10 0z" fill="' + V.star + '" stroke="' + V.starRim + '" stroke-width="1.3"/>' +
            '<path d="M7 5H4.2a3 3 0 0 0 3.2 4.3M17 5h2.8a3 3 0 0 1-3.2 4.3" fill="none" stroke="' + V.starRim + '" stroke-width="1.5"/>' +
            '<path d="M10.5 13.4h3l.6 4h-4.2z" fill="' + V.starRim + '"/><rect x="7.5" y="17.4" width="9" height="3.2" rx="1" fill="' + V.starRim + '"/>',
    clock: '<circle cx="12" cy="13" r="8.4" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 8.6V13l3 2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M9.5 2.6h5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    chest: '<rect x="3" y="9.5" width="18" height="11" rx="2" fill="#C9772B" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' +
           '<path d="M3 10a6 5.5 0 0 1 6-5.5h6A6 5.5 0 0 1 21 10z" fill="#E08E3C" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' +
           '<rect x="3" y="10" width="18" height="2.6" fill="' + V.star + '"/><rect x="10.3" y="11" width="3.4" height="4.6" rx="1" fill="' + V.star + '" stroke="' + V.starRim + '" stroke-width=".9"/>'
  };
  /* 中文名：没有 label 时读屏软件不读；给了 label 就读出来 */
  var NAME = { coin: '金币', gem: '钻石', xp: '经验', star: '星星', starOff: '还没拿到的星星', flame: '连对', check: '对', cross: '错',
               speaker: '听发音', lock: '还没解锁', heart: '生命', trophy: '奖杯', clock: '时间', chest: '宝箱' };
  /* emoji → 图标（只收货币/状态类；功能入口继续用 3D 图） */
  var EMOJI = { '🪙': 'coin', '💰': 'coin', '💎': 'gem', '⭐': 'star', '🌟': 'star', '🔥': 'flame', '✅': 'check', '✔️': 'check', '✔': 'check',
                '❌': 'cross', '✖️': 'cross', '✖': 'cross', '🔊': 'speaker', '🔈': 'speaker', '🔒': 'lock', '❤️': 'heart', '❤': 'heart',
                '🏆': 'trophy', '⏱️': 'clock', '⏱': 'clock', '⏰': 'clock' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svg(name, o) {
    o = o || {}; var p = P[name]; if (!p) throw new Error('HansenIcons: 没有图标 ' + name);
    var size = o.size || '1.15em', a = o.label ? ' role="img" aria-label="' + esc(o.label) + '"' : ' aria-hidden="true" focusable="false"';
    var sz = typeof size === 'number' ? size + 'px' : size;
    return '<svg class="t2-ic-svg t2-ic-' + name + '" viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '"' + a +
      ' style="display:inline-block;vertical-align:-0.18em;flex:none;overflow:visible">' + p + '</svg>';
  }
  function el(name, o) {
    var s = document.createElement('span'); s.className = 't2-ic'; s.innerHTML = svg(name, o); return s;
  }
  var ALL = Object.keys(EMOJI).sort(function (a, b) { return b.length - a.length; });
  var RE = new RegExp('(' + ALL.map(function (e) { return e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'g');
  /* 只换给定元素里面的 emoji（不碰 input/textarea/script/style；不进 svg） */
  function swapEmoji(rootEl, o) {
    if (!rootEl || typeof document === 'undefined') return 0;
    var n = 0, w = document.createTreeWalker(rootEl, 4, null), list = [], t;
    while ((t = w.nextNode())) { RE.lastIndex = 0; if (RE.test(t.nodeValue)) list.push(t); }
    list.forEach(function (node) {
      var p = node.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|INPUT|OPTION)$/.test(p.nodeName) || (p.closest && p.closest('svg'))) return;
      var parts = node.nodeValue.split(RE), frag = document.createDocumentFragment();
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        if (EMOJI[parts[i]]) { frag.appendChild(el(EMOJI[parts[i]], o)); n++; }
        else frag.appendChild(document.createTextNode(parts[i].replace(/^️/, '')));
      }
      p.replaceChild(frag, node);
    });
    return n;
  }
  /* 这台手机能不能画出这个 emoji：和一定画不出的字符（私用区）比像素，一样 = 空框 */
  var okCache = {};
  function emojiOk(ch) {
    if (okCache.hasOwnProperty(ch)) return okCache[ch];
    var r = true;
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = 32; var c = cv.getContext('2d');
      if (!c) return true;
      function draw(s) { c.clearRect(0, 0, 32, 32); c.textBaseline = 'top'; c.font = '24px sans-serif'; c.fillStyle = '#000'; c.fillText(s, 2, 2); return c.getImageData(0, 0, 32, 32).data; }
      var a = draw(ch), b = draw(''), same = true, ink = 0;
      for (var i = 3; i < a.length; i += 4) { if (a[i] !== b[i]) same = false; if (a[i]) ink++; }
      r = !same && ink > 0;
    } catch (e) { r = true; }
    okCache[ch] = r; return r;
  }
  return { svg: svg, el: el, swapEmoji: swapEmoji, emojiOk: emojiOk, names: function () { return Object.keys(P); }, NAME: NAME, EMOJI: EMOJI };
});
