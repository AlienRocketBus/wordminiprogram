/* 主题 2.0 — event-only celebration engine (mockup).
   Rules it enforces by construction:
   · runs only when called (answer / round end / chest / level-up); nothing loops while idle
   · animates transform + opacity only (compositor-friendly), via WAAPI; no rotate, no full-screen flash, no shake
   · every node it creates is removed on finish; the layer itself is removed when empty → getAnimations() returns to 0
   · prefers-reduced-motion: no movement, final state shown at once
   · hard caps: ≤ 28 particles per call; FX.queue() plays celebrations one at a time, highest priority first */
(function () {
  'use strict';
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches) || /[?&]rm=1/.test(location.search); }
  var layer = null, live = 0, waiters = [];
  function getLayer() { if (!layer) { layer = document.createElement('div'); layer.className = 'fx-layer'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); } return layer; }
  function done(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
    live--; if (live <= 0) { live = 0; if (layer && !layer.childNodes.length) { layer.remove(); layer = null; } var w = waiters; waiters = []; w.forEach(function (f) { f(); }); }
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#ffd54a'; }
  function make(cls, x, y) { var d = document.createElement('div'); d.className = 'fx-p ' + cls; d.style.transform = 'translate(' + x + 'px,' + y + 'px)'; getLayer().appendChild(d); live++; return d; }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  var q = [], qBusy = false;
  function qNext() { var it = q.shift(); if (!it) { qBusy = false; return; } qBusy = true; try { it.fn(); } catch (e) {} setTimeout(function () { FX.idle().then(qNext); }, 30); }
  var FX = {
    reduced: reduced,
    /* one celebration at a time: chest/boss (3) > round result (2) > level-up / pet evolution (1) > achievement (0) */
    queue: function (fn, pri) { q.push({ fn: fn, pri: pri || 0 }); q.sort(function (a, b) { return b.pri - a.pri; }); if (!qBusy) qNext(); },
    idle: function () { return live ? new Promise(function (r) { waiters.push(r); }) : Promise.resolve(); },
    /* small bounce on a real element (answer option, counter, badge) */
    pop: function (el, s, dur) {
      if (reduced() || !el) return;
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(' + (s || 1.08) + ')' }, { transform: 'scale(1)' }], { duration: dur || 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    },
    /* element enters: rise + fade in (final state is the element's normal CSS → nothing depends on the animation) */
    rise: function (el, dy, delay, dur) {
      if (!el) return; if (reduced()) { el.style.opacity = ''; return; }
      el.animate([{ transform: 'translateY(' + (dy == null ? 16 : dy) + 'px) scale(.96)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: dur || 320, delay: delay || 0, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    },
    /* star / dot burst from a point, e.g. the tapped correct option */
    burst: function (x, y, o) {
      o = o || {}; if (reduced()) return;
      var n = Math.min(o.n || 10, 28), spread = o.spread || 74, dur = o.dur || 820;
      var cols = [css('--star'), css('--good'), css('--gem'), css('--accent-1')];
      for (var i = 0; i < n; i++) {
        var a = (Math.PI * 2 * i) / n + Math.random() * .4, r = spread * (.7 + Math.random() * .5);
        var star = (o.kind || 'star') === 'star' && i % 2 === 0;
        var p = make(star ? 'fx-star' : 'fx-dot', x - 6, y - 6);
        if (!star) { var s = 6 + Math.random() * 6; p.style.width = p.style.height = s + 'px'; p.style.background = cols[i % cols.length]; }
        var dx = Math.cos(a) * r, dy = Math.sin(a) * r;
        /* per-segment easing (iteration is linear): fly out fast, hang a moment, then fade while drifting down */
        p.animate([{ transform: 'translate(' + (x - 6) + 'px,' + (y - 6) + 'px) scale(.4)', opacity: 1, easing: 'cubic-bezier(.2,.8,.2,1)' },
                   { transform: 'translate(' + (x - 6 + dx) + 'px,' + (y - 6 + dy) + 'px) scale(1)', opacity: 1, offset: .42, easing: 'linear' },
                   { transform: 'translate(' + (x - 6 + dx * 1.06) + 'px,' + (y - 6 + dy * 1.06 + 6) + 'px) scale(.95)', opacity: 1, offset: .7, easing: 'cubic-bezier(.4,0,1,1)' },
                   { transform: 'translate(' + (x - 6 + dx * 1.12) + 'px,' + (y - 6 + dy * 1.12 + 18) + 'px) scale(.55)', opacity: 0 }],
          { duration: dur, easing: 'linear' }).onfinish = (function (q) { return function () { done(q); }; })(p);
      }
    },
    /* expanding ring behind a badge (level-up, chest) — thin outline, not a screen flash */
    ring: function (x, y, size) {
      if (reduced()) return; size = size || 120;
      var p = make('', x - size / 2, y - size / 2);
      p.style.cssText += ';width:' + size + 'px;height:' + size + 'px;border-radius:50%;border:4px solid ' + css('--star');
      p.animate([{ transform: 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px) scale(.3)', opacity: .9 },
                 { transform: 'translate(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px) scale(1.5)', opacity: 0 }],
        { duration: 700, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = function () { done(p); };
    },
    /* coins / stars arc from one element to another (reward → top-bar counter). onArrive fires per coin. */
    fly: function (fromEl, toEl, o) {
      o = o || {}; var n = Math.min(o.n || 6, 12), a = center(fromEl), b = center(toEl);
      if (reduced()) { for (var k = 0; k < n; k++) o.onArrive && o.onArrive(k, n); return; }
      for (var i = 0; i < n; i++) (function (i) {
        var outer = make('', 0, 0), inner = document.createElement('div');
        inner.innerHTML = o.html || FX.coinSVG(); inner.style.cssText = 'width:28px;height:28px;margin:-14px 0 0 -14px';
        outer.appendChild(inner);
        var jx = (Math.random() - .5) * 60, dur = (o.dur || 720) + i * 30, delay = i * (o.stagger || 70);
        outer.animate([{ transform: 'translate(' + (a.x + jx) + 'px,0)' }, { transform: 'translate(' + b.x + 'px,0)' }], { duration: dur, delay: delay, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' });
        var lift = Math.min(160, Math.abs(a.y - b.y) * .35 + 60);
        var an = inner.animate([
          { transform: 'translateY(' + a.y + 'px) scale(.6)', opacity: 0, easing: 'cubic-bezier(.2,.8,.4,1)' },
          { transform: 'translateY(' + (Math.min(a.y, b.y) - lift) + 'px) scale(1.15)', opacity: 1, offset: .38, easing: 'cubic-bezier(.6,0,.9,.4)' },
          { transform: 'translateY(' + b.y + 'px) scale(.55)', opacity: .9 }], { duration: dur, delay: delay, fill: 'both' });
        an.onfinish = function () { o.onArrive && o.onArrive(i, n); FX.pop(toEl, 1.18, 220); done(outer); };
      })(i);
    },
    /* number ticks up during the event only (rAF stops at the end) */
    count: function (el, from, to, dur, fmt) {
      fmt = fmt || function (v) { return String(v); };
      if (reduced()) { el.textContent = fmt(to); return; }
      var t0 = performance.now(); dur = dur || 700; live++;
      (function tick(t) { var k = Math.min(1, (t - t0) / dur); el.textContent = fmt(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(tick); else done(null); })(t0);
    },
    /* paper confetti: falls + sways + "flutters" with scaleY (looks like a flip, uses no rotation) */
    confetti: function (o) {
      o = o || {}; if (reduced()) return;
      var n = Math.min(o.n || 26, 28), W = innerWidth, H = innerHeight;
      var cols = [css('--f-red-b'), css('--f-yellow-a'), css('--f-green-b'), css('--f-blue-b'), css('--f-pink-b'), css('--f-purple-b')];
      for (var i = 0; i < n; i++) {
        var x = Math.random() * W, w = 7 + Math.random() * 6, h = w * (1.3 + Math.random() * .6), sway = (Math.random() - .5) * 70;
        var p = make('', x, -20); p.style.width = w + 'px'; p.style.height = h + 'px'; p.style.borderRadius = '2px'; p.style.background = cols[i % cols.length];
        var fall = H * (.55 + Math.random() * .3), dur = (o.dur || 1300) + Math.random() * 500;
        p.animate([{ transform: 'translate(' + x + 'px,-20px) scaleY(1)', opacity: 1 },
                   { transform: 'translate(' + (x + sway) + 'px,' + fall * .35 + 'px) scaleY(.25)', opacity: 1, offset: .3 },
                   { transform: 'translate(' + (x - sway * .6) + 'px,' + fall * .7 + 'px) scaleY(1)', opacity: 1, offset: .65 },
                   { transform: 'translate(' + (x + sway * .3) + 'px,' + fall + 'px) scaleY(.3)', opacity: 0 }],
          { duration: dur, delay: Math.random() * 180, easing: 'cubic-bezier(.25,.6,.5,1)', fill: 'backwards' }).onfinish = (function (q) { return function () { done(q); }; })(p);
      }
    },
    /* ribbon under the top bar: never blocks input (pointer-events:none), auto hides */
    ribbon: function (html, ms) {
      var host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:50%;top:calc(66px + env(safe-area-inset-top));z-index:var(--z-toast);pointer-events:none;transform:translateX(-50%)';
      host.innerHTML = '<div class="ribbon">' + html + '</div>'; document.body.appendChild(host); live++;
      var r = host.firstChild;
      if (reduced()) { setTimeout(function () { done(host); }, ms || 2200); return r; }
      r.animate([{ transform: 'translateY(-24px) scale(.9)', opacity: 0 }, { transform: 'none', opacity: 1, offset: .12 }, { transform: 'none', opacity: 1, offset: .86 }, { transform: 'translateY(-16px)', opacity: 0 }],
        { duration: ms || 2200, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = function () { done(host); };
      return r;
    },
    coinSVG: function () {
      return '<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="10.5" fill="var(--coin)" stroke="var(--coin-rim,#9a6700)" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.4"/><path d="M12 7.6v8.8M9.6 9.6h4.8" stroke="var(--coin-rim,#9a6700)" stroke-width="1.6" stroke-linecap="round"/></svg>';
    }
  };
  window.FX = FX;
})();
