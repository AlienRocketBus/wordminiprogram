/* sync theme bootstrap (runs in <head>, before first paint): ?theme=<id> → <html data-theme data-mode> */
(function () {
  var MODE = { cosmos: 'dark', violet: 'dark', aurora: 'dark', woods: 'dark', lantern: 'dark',
               cloud: 'light', sakura: 'light', cream: 'light', mint: 'light', snow: 'light', kidsday: 'light', boss_light: 'light' };
  var m = /[?&]theme=([a-z_]+)/.exec(location.search), t = m && MODE[m[1]] ? m[1] : 'cosmos';
  var h = document.documentElement; h.setAttribute('data-theme', t); h.setAttribute('data-mode', MODE[t]);
})();
/* tiny inline icon set (SVG instead of emoji: identical on every phone, never renders as an empty box) */
window.ICON = {
  coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="var(--coin)" stroke="var(--coin-rim,#9a6700)" stroke-width="1.6"/><circle cx="12" cy="12" r="6.6" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="1.4"/><path d="M12 7.6v8.8M9.6 9.6h4.8" stroke="var(--coin-rim,#9a6700)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  gem: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z" fill="var(--gem)" stroke="rgba(0,0,0,.25)" stroke-width="1"/><path d="M2 9h20M8 3l4 18 4-18" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.1"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z" fill="#ff6a3d"/><path d="M12 12c.5 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.6 1.6-3 .1 1 .6 1.5 1.1 1.5-.4-1.5 0-2.8.3-4z" fill="#ffd54a"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z" fill="var(--star)" stroke="var(--star-rim,rgba(0,0,0,.25))" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  starOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z" fill="var(--surface-3)" stroke="var(--line-strong)" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
};
