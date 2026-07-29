/* 单词大冒险 v960：沿用 v944 独立 pathname 的有限离线缓存。
 * 只保存应用外壳、代码、最近访问的少量 HTML 和少量界面图标；
 * 明确不缓存 words/sentences 音频、Boss、宠物、卡牌等大型媒体库。
 */
'use strict';

const CACHE_PREFIX = 'hansen-v944-';
// v960 使用全新缓存代际：食物图标从大体积 PNG 切换为透明 WebP，
// 页面、引用与图标必须原子同包更新，绝不能让 ignoreSearch 命中旧 PNG。
// 新 worker 安装失败时，旧 shell-20 仍完整服务；成功后再切换到 shell-127。
const SHELL_CACHE = CACHE_PREFIX + 'shell-127';
const PAGE_CACHE = CACHE_PREFIX + 'pages-125';
const ASSET_CACHE = CACHE_PREFIX + 'assets-125';
const ICON_CACHE = CACHE_PREFIX + 'icons-3';
const CURRENT_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, ICON_CACHE]);

const SHELL = [
  './index.html', './_frame.html', './_sw_upgrade_v944.html', './manifest.webmanifest', './favicon.ico', './cartoon_font.woff2',
  './hansen_sw_upgrade_gate_v944.js', './hansen_backup_bootstrap_v944.js', './hansen_coin_wallet.js', './copy_protect.js', './perf_boost.js', './hansen_preload.js?v=1068', './click_sound.js', './click_setting.js',
  './vocab_all.js', './hansen_upgrade.js', './hansen_boss_lock.js?v=1068', './hansen_onboarding.js?v=1068', './hansen_theme_shop.js',
  './hansen_season.js?v=1068', './hansen_cinema_themes.js?v=1068', './hansen_diamond_shop.js?v=1068', './hansen_gem_system.js',
  './hansen_canonical_progress.js?v=1068', './hansen_crystal.js', './hansen_cards.js?v=1068', './hansen_gacha.js?v=1068', './hansen_land_cards.js?v=1068', './hansen_round_reward.js?v=1068', './hansen_round_bar.js?v=1068', './hansen_pet_showcase.js?v=1068', './hansen_quest_global.js?v=1068', './hansen_island_upgrade.js?v=1068', './hansen_focused_typing_v946.js', './hansen_explore_progress_v945.js?v=1068', './hansen_spell_practice.js?v=1068', './hansen_review.js?v=1068', './hansen_wrong_overview.js?v=1068', './hansen_backup_v944.js?v=1068', './hansen_accessibility.js?v=1068',
  './hansen_stability.js', './hansen_home_link.js', './hansen_addiction.js?v=1068', './hansen_mylearning.js?v=1068', './hansen_palette.js?v=1068', './hansen_boss_theme.js?v=1068', './hansen_econ_guide.js?v=1068', './hansen_perf_v944.js?v=1068'
];

async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) await cache.delete(keys.shift());
}

async function putIfReasonable(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === 'opaque') return false;
  const length = Number(response.headers.get('content-length') || 0);
  if (length && length > 1572864) return false;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    await trim(cacheName, maxEntries);
    return true;
  } catch (error) {
    // 缓存配额不足/隐私模式禁止 Cache Storage 时，联网成功的业务响应仍必须交给页面。
    return false;
  }
}

const NAVIGATION_TIMEOUT_MS = 3000;
const COLD_NAVIGATION_TIMEOUT_MS = 12000;

async function bufferedNavigationResponse(response) {
  // fetch() 在响应头到达时就会 resolve；必须把正文也读完，超时才真正覆盖“头到了但页面一直白屏”。
  const bytes = await response.arrayBuffer();
  const noBody = response.status === 204 || response.status === 205 || response.status === 304;
  return new Response(noBody ? null : bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function fetchNavigationWithTimeout(request, timeoutMs) {
  // 已有当前页缓存时 3 秒快速回退；从未打开过的冷页面给 12 秒，避免把稍慢但可用的首访误判成离线。
  timeoutMs = Math.max(1, Number(timeoutMs) || NAVIGATION_TIMEOUT_MS);
  if (typeof AbortController === 'undefined') {
    let legacyTimer;
    try {
      return await Promise.race([
        fetch(request).then(bufferedNavigationResponse),
        new Promise((_, reject) => {
          legacyTimer = setTimeout(() => reject(new Error('navigation timeout')), timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(legacyTimer);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await bufferedNavigationResponse(await fetch(request, { signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

function scopeRootPath() {
  try {
    const scope = self.registration && self.registration.scope;
    if (scope) return new URL(scope).pathname.replace(/[^/]$/, '$&/');
  } catch (error) {}
  try { return new URL('./', self.location.href).pathname; } catch (error) { return '/'; }
}

function isHomeNavigation(url) {
  const root = scopeRootPath();
  return url.pathname === root || url.pathname === root + 'index.html';
}

function homeShellRequest() {
  try { return new Request(new URL('./index.html', self.location.href).href); }
  catch (error) { return new Request(self.location.origin + '/index.html'); }
}

function offlineNavigationResponse() {
  // 不再把未缓存的岛 URL 偷偷显示成首页。URL 与内容必须一致：
  // 当前岛没有缓存时就明确告知用户，联网打开一次后才可离线使用。
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>当前页面尚未下载</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
    'font-family:system-ui,-apple-system,Microsoft YaHei,sans-serif;background:#eef6ff;color:#172033">' +
    '<main style="max-width:28rem;padding:32px;text-align:center"><div style="font-size:52px">📡</div>' +
    '<h1 style="font-size:22px">当前页面尚未下载</h1><p style="line-height:1.7">请联网打开这个页面一次，' +
    '之后就能从本机缓存中访问。</p><button onclick="location.reload()" style="font:inherit;font-weight:700;' +
    'padding:12px 20px;border:0;border-radius:12px;background:#4f46e5;color:white">重试连接</button></main></body></html>';
  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Cache.addAll 的写入是整批成功或整批失败。任何一个核心文件 404/断网都会
    // 让 install 失败，因此不会 skipWaiting，更不会激活只下到一半的应用外壳。
    await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // HF1 changes security-critical code without changing the product version.
    // Remove both prior-version namespaces and older v944 shell generations so
    // an exact lookup can never fall back to a superseded shell entry.
    await Promise.all(names.filter(name => name.startsWith('hansen-') && !CURRENT_CACHES.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

/* 🔴v1049 重写：v1044 那版做法有害，已致「刷新就下载」。
   原实现对**每个导航请求**都 clone 整个响应并 await clone.text() 读完全文
   （index.html 有 150KB）来判断是不是 HTML，再重建 Response。
   代价：① 每次刷新都多一次全量读取与重建，拖慢加载；
        ② clone/text 在流式响应上可能失败或耗尽流，抛错后返回损坏的响应，
           浏览器拿到一个说不清类型的东西 → 直接当文件下载。
   本来是给"服务端 MIME 配错"兜底的，结果把本来正常的页面弄坏了。

   新做法：**只看响应头，一个字节都不读**。
   仅当 Content-Type 明确是"会触发下载"的类型（octet-stream / 缺失 /
   带 attachment）时才改写，且改写只换 headers、直接复用原 body 流，
   不做任何读取与克隆。其余情况原样返回，零开销、零风险。 */
function fixHtmlType(response) {
  try {
    if (!response || !response.ok) return response;
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    const dispo = (response.headers.get('content-disposition') || '').toLowerCase();
    const looksDownload =
      ct === '' ||
      ct.startsWith('application/octet-stream') ||
      ct.startsWith('binary/') ||
      dispo.includes('attachment');
    if (!looksDownload) return response;   /* 正常响应一律不碰 */
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.delete('content-disposition');
    return new Response(response.body, {
      status: response.status, statusText: response.statusText, headers: headers
    });
  } catch (e) { return response; }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isLargeMedia = /\.(?:mp3|mp4|wav|ogg|webm)$/i.test(path) ||
    /\/(?:words|sentences|bosses|bosses_bg|pets|cards|avatars|weapons)\//i.test(path);
  if (isLargeMedia) return;

  if (request.mode === 'navigate') {
    const navigation = (async () => {
      /* 🔴v1050: 根路径 `/` 若被服务端当成"找不到对应文件"而返回可下载的响应，
         页面就会变成下载（用户实测：加 /index.html 能正常打开，只有裸根路径不行，
         说明托管的「索引文档」未指向 index.html）。
         根本修法在控制台设置索引文档；这里做客户端兜底：
         导航到根路径时直接改取 /index.html，让已装 SW 的用户立刻恢复正常。 */
      let fallback = null;
      try { fallback = await caches.match(request, { ignoreSearch: true }); } catch (error) {}
      /* 🔴v1050: 根路径 `/` 的兜底。
         用户实测：`域名/index.html` 能正常打开，只有裸根路径变成下载 ——
         说明托管的「索引文档」没指向 index.html，服务器不知道该给哪个文件。
         根本修法在控制台设置索引文档；这里只在**正常流程已经拿不到东西**时，
         用 index.html 的缓存副本顶上，绝不插手主路径（首版插在主路径上
         导致导航超时、刷新失败，已改为此处）。 */
      if (!fallback && url.origin === self.location.origin &&
          (url.pathname === '/' || url.pathname === '')) {
        try {
          const indexReq = new Request(new URL('index.html', self.location.origin).href,
            { credentials: 'same-origin' });
          fallback = await caches.match(indexReq, { ignoreSearch: true });
        } catch (error) {}
      }
      if (!fallback && isHomeNavigation(url)) {
        try { fallback = await caches.match(homeShellRequest(), { ignoreSearch: true }); } catch (error) {}
      }
      try {
        const fresh = await fetchNavigationWithTimeout(request, fallback ? NAVIGATION_TIMEOUT_MS : COLD_NAVIGATION_TIMEOUT_MS);
        const cacheable = isHomeNavigation(url) || /\/(?:index|_frame|land_map|spelling_bee|boss_hall|season_showcase|island_[a-z0-9]+)\.html$/i.test(url.pathname);
        return { response: fresh, fresh, cacheable };
      } catch (e) {
        return { response: fallback || offlineNavigationResponse(), fresh: null, cacheable: false };
      }
    })();
    // Cache Storage 是旁路优化：无论 put/trim 成败，都不能改变已取得的网络响应。
    event.waitUntil(navigation.then(result => result.fresh && result.cacheable ?
      putIfReasonable(PAGE_CACHE, request, result.fresh, 12) : false).catch(() => false));
    /* 🔴v1044 兜住"网页变成下载"：
       静态托管若把 .html 发成 application/octet-stream（或缺 Content-Type），
       浏览器不会渲染而是直接下载——用户打开网址就变成下载文件。
       这属服务端配置问题，但我们可以在 SW 里把响应头改回 text/html，
       让已装过 SW 的用户立刻恢复正常（首次访问仍需服务端配置正确）。 */
    event.respondWith(navigation.then(result => fixHtmlType(result.response)));
    return;
  }

  const isCode = /\.(?:js|css|woff2|ico|webmanifest)$/i.test(path);
  // v960 食物图标继续按岛分目录保存。允许 icons/ 下的受控子目录，避免页面离线后
  // HTML 仍在缓存、但用户指定的透明 WebP 图标全部空白。
  const isSmallIcon = /\/icons\/(?:[^/]+\/)*[^/]+\.(?:webp|png|svg)$/i.test(path);
  if (!isCode && !isSmallIcon) return;

  const cacheName = isSmallIcon ? ICON_CACHE : ASSET_CACHE;
  const maxEntries = isSmallIcon ? 36 : 72;
  const network = fetch(request);
  const refresh = network.catch(() => null);
  event.waitUntil(network.then(response => putIfReasonable(cacheName, request, response, maxEntries)).catch(() => false));
  if (isCode) {
    // v946: code cache keys include the version query.  The former
    // ignoreSearch:true could answer ?v=1068 with stale prior-version JavaScript on
    // the first reload.  Try exact cache, then network, and use the install
    // shell's bare URL only as a true offline fallback.
    event.respondWith((async () => {
      const exact = await caches.match(request);
      if (exact) return exact;
      const fresh = await refresh;
      if (fresh) return fresh;
      return (await caches.match(new Request(url.origin + url.pathname))) ||
        new Response('', { status: 504 });
    })());
  } else {
    event.respondWith(caches.match(request, { ignoreSearch: true }).then(async cached => {
      return cached || (await refresh) || new Response('', { status: 504 });
    }));
  }
});
