/* 单词大冒险 v960：沿用 v944 独立 pathname 的有限离线缓存。
 * 只保存应用外壳、代码、最近访问的少量 HTML 和少量界面图标；
 * 明确不缓存 words/sentences 音频、Boss、宠物、卡牌等大型媒体库。
 */
'use strict';

const CACHE_PREFIX = 'hansen-v944-';
// v960 使用全新缓存代际：食物图标从大体积 PNG 切换为透明 WebP，
// 页面、引用与图标必须原子同包更新，绝不能让 ignoreSearch 命中旧 PNG。
// 新 worker 安装失败时，旧 shell-20 仍完整服务；成功后再切换到 shell-212。
const SHELL_CACHE = CACHE_PREFIX + 'shell-218';
const PAGE_CACHE = CACHE_PREFIX + 'pages-216';
const ASSET_CACHE = CACHE_PREFIX + 'assets-216';
const ICON_CACHE = CACHE_PREFIX + 'icons-3';
const CURRENT_CACHES = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE, ICON_CACHE]);

const SHELL = [
  './index.html', './_frame.html', './_sw_upgrade_v944.html', './manifest.webmanifest', './favicon.ico', './cartoon_font.woff2',
  './hansen_sw_upgrade_gate_v944.js', './hansen_backup_bootstrap_v944.js', './hansen_coin_wallet.js', './copy_protect.js', './perf_boost.js', './hansen_preload.js?v=1164', './click_sound.js', './click_setting.js',
  './vocab_all.js', './hansen_upgrade.js', './hansen_boss_lock.js?v=1164', './hansen_onboarding.js?v=1164', './hansen_theme_shop.js',
  './hansen_season.js?v=1164', './hansen_cinema_themes.js?v=1164', './hansen_diamond_shop.js?v=1164', './hansen_gem_system.js',
  './hansen_canonical_progress.js?v=1164', './hansen_crystal.js', './hansen_cards.js?v=1164', './hansen_gacha.js?v=1164', './hansen_land_cards.js?v=1164', './hansen_round_reward.js?v=1164', './hansen_round_bar.js?v=1164', './hansen_pet_showcase.js?v=1164', './hansen_quest_global.js?v=1164', './hansen_island_upgrade.js?v=1164', './hansen_focused_typing_v946.js', './hansen_explore_progress_v945.js?v=1164', './hansen_spell_practice.js?v=1164', './hansen_review.js?v=1164', './hansen_wrong_overview.js?v=1164', './hansen_backup_v944.js?v=1164', './hansen_accessibility.js?v=1164',
  './hansen_stability.js', './hansen_home_link.js', './hansen_addiction.js?v=1164', './hansen_mylearning.js?v=1164', './hansen_palette.js?v=1164', './hansen_boss_theme.js?v=1164', './hansen_econ_guide.js?v=1164', './hansen_perf_v944.js?v=1164',
  // v1165 答错小课：岛页用这个精确地址加载。不在外壳里时，离线进岛（运行时缓存被挤掉后）小课卡就悄悄没了。
  './hansen_mistake_lesson_v1165.js?v=1164'
];

/* 🔴v1165 复查第 2 轮：发版上传的那几分钟（CDN 新旧混着），新页面配着还没传上去的旧脚本 —— 新 SW 这时把
   「?v=新版本号 + 旧内容」当成这一版唯一的一份存进缓存，以后命中就不再联网：这个孩子整个版本都在跑旧脚本，刷新也没用。
   办法：这一代缓存装好以后 1 小时内存进去的带版本号代码，先算「临时的」；命中临时的、而且存进去已经 5 分钟以上，
   就在后台用 no-cache 问一次服务器（内容没变只回 304，几百字节），拿到的存回原来那个缓存。
   这一问发生在装好 1 小时以后，这份就算定了，以后命中一个请求都不发（267e849 省下的流量照旧省着）。
   每份代码存进去的时间记在它自己的响应头 x-hsn-at 里；这一代装好的时间记在外壳缓存的 __hsn_sw_installed 里。 */
const META_INSTALLED = './__hsn_sw_installed';
const DEPLOY_WINDOW_MS = 60 * 60 * 1000;
const RECHECK_AFTER_MS = 5 * 60 * 1000;
let installedAtMemo = 0;
async function installedAt() {
  if (installedAtMemo) return installedAtMemo;
  try {
    const shell = await caches.open(SHELL_CACHE);
    const r = await shell.match(new Request(new URL(META_INSTALLED, self.location.href).href));
    const t = r ? Number(await r.text()) : 0;
    if (t > 0) installedAtMemo = t;
    return t;
  } catch (error) { return 0; }
}
function stampedCopy(response) {
  /* 存进缓存的那一份带上「什么时候存的」；正文是流，不读、不复制 */
  const h = new Headers(response.headers);
  h.set('x-hsn-at', String(Date.now()));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: h });
}
/* 命中一份带版本号的代码：该不该在后台再问一次服务器 */
async function needsRecheck(found, request) {
  try {
    const inst = await installedAt();
    if (!inst) return false;                                  // 这一代没记装好时间（老 SW 装的）：照旧不问
    let at = Number(found.headers.get('x-hsn-at')) || 0;
    if (!at) {
      /* 没有时间戳 = 装 SW 时外壳一起下的那批（addAll 加不了头），就是装好那一刻存的 */
      const inShell = await (await caches.open(SHELL_CACHE)).match(request);
      if (!inShell) return false;
      at = inst;
    }
    if (at - inst >= DEPLOY_WINDOW_MS) return false;          // 装好 1 小时以后才存的：已经是定下来的
    return Date.now() - at >= RECHECK_AFTER_MS;               // 刚存的先不问（同一次打开里不来回问）
  } catch (error) { return false; }
}
const recheckedAt = new Map();   // 同一个地址几个页面框同时要（首页 + 岛 + 预热）：这一会儿只问一次
async function recheckVersioned(request) {
  const last = recheckedAt.get(request.url) || 0;
  if (Date.now() - last < RECHECK_AFTER_MS) return false;
  recheckedAt.set(request.url, Date.now());
  const fresh = await fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  if (!fresh || !fresh.ok || fresh.type === 'opaque') return false;
  const length = Number(fresh.headers.get('content-length') || 0);
  if (length && length > 1572864) return false;
  /* 外壳里的那份放回外壳（不会被修剪掉，离线照样有）；别的放回代码缓存 */
  const shell = await caches.open(SHELL_CACHE);
  if (await shell.match(request)) { await shell.put(request, stampedCopy(fresh)); return true; }
  return putIfReasonable(ASSET_CACHE, request, fresh, 400);
}

async function trim(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) await cache.delete(keys.shift());
}
/* v1165：同一个缓存同时只跑一次修剪（以前每存一条就各自修剪一遍，并发时互相踩），跑的期间又有新写入就再跑一次 */
const trimState = {};
function scheduleTrim(cacheName, maxEntries) {
  const st = trimState[cacheName] || (trimState[cacheName] = { running: null, again: false });
  if (st.running) { st.again = true; return st.running; }
  st.running = (async () => {
    try { do { st.again = false; await trim(cacheName, maxEntries); } while (st.again); }
    finally { st.running = null; }
  })();
  return st.running;
}
/* v1165：页面缓存按「路径」存一份（去掉 ?v / ?warm / _fresh / _r），同一个岛不再因为地址后缀不同占好几格，
   把别的岛挤出 12 格的页面缓存（离线时就打不开了）。 */
function pageCacheKey(request) {
  try { const u = new URL(request.url, self.location.origin); return new Request(u.origin + u.pathname); }
  catch (error) { return request; }
}

async function putIfReasonable(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === 'opaque') return false;

  /* 🔴v1156：**进缓存之前就把坏的 Content-Type 修掉。**

     原来是"缓存时原样存、取出时才 fixHtmlType" —— 这留了一个大洞：

       服务端某次回了一份坏响应（text/plain / octet-stream）
       → **原样存进 Cache Storage**
       → 之后即使服务端修好了、CDN 缓存也刷了，
         **这个用户的浏览器里还留着那份坏的**
       → 他会一直下载，而且怎么刷新都没用（SW 缓存不吃刷新）

     也就是说：**服务端的一次抽风，会被我们自己永久固化下来。**

     所以在这里就修 —— 存进去的必须已经是好的。
     取出时的 fixHtmlType 保留，作为老用户缓存里已有坏数据的兜底。 */
  const length = Number(response.headers.get('content-length') || 0);
  if (length && length > 1572864) return false;
  try {
    /* 🔴v1156：**只在"要存进去的那一份"上修 Content-Type，
       不动传进来的 response 本身。**

       第一版写成 `response = fixHtmlType(response)` —— 把整个变量换掉了。
       而调用方后面还要用这个 response 返回给浏览器，
       于是 body 归属乱掉，**缓存写失败时导航直接落到离线兜底页（503）**，
       而那时候网络明明是通的、页面明明已经拿到了。

       > 一个"顺手修一下"的动作，如果改了调用方还要用的对象，
       > 就不再是顺手 —— 它成了副作用。

       改为：克隆一份、在副本上修、只把副本存进去。 */
    let _toStore = null;
    try {
      const _u = new URL(request.url, self.location.origin);
      const _isPage = /\.html?$/i.test(_u.pathname) || _u.pathname === '/' ||
                      _u.pathname.endsWith('/');
      if (_isPage) _toStore = fixHtmlType(response.clone());
    } catch (error) { _toStore = null; }
    /* ⚠️ 修不成就存原样 —— **存一份 Content-Type 不对的，
       也好过因为修的过程出错而整个存不进去**：
       取出时还有 fixHtmlType 兜底，而存不进去就彻底没有缓存了。 */
    if (!_toStore) _toStore = response.clone();
    /* 🔴v1165 复查第 2 轮：带版本号的代码记下存进来的时间（见上面 META_INSTALLED 那段） */
    try {
      const _u2 = new URL(request.url, self.location.origin);
      if (cacheName === ASSET_CACHE && /(?:^|&)v=\d+(?:&|$)/.test(_u2.search.slice(1))) _toStore = stampedCopy(_toStore);
    } catch (error) {}

    const cache = await caches.open(cacheName);
    await cache.put(cacheName === PAGE_CACHE ? pageCacheKey(request) : request, _toStore);
    await scheduleTrim(cacheName, maxEntries);
    return true;
  } catch (error) {
    // 缓存配额不足/隐私模式禁止 Cache Storage 时，联网成功的业务响应仍必须交给页面。
    return false;
  }
}

/* 🔴v1082：3 秒太短了。
   用户反馈「你做的东西可能根本没显示出来」—— 查证属实：
   导航虽是网络优先，但**有缓存时只等 3 秒**，手机在微信里、信号波动，
   稍慢就退回旧缓存；而 HTML 文件名不带版本戳，旧页面会被一直复用，
   里面引用的又全是旧版 JS。
   结果：开发端连改六版，用户手机上跑的仍是旧代码，而**双方都看不出来** ——
   据此做的每一次诊断都建立在过期证据上，白白消耗了很多轮。
   放宽到 8 秒：仍能在真断网时快速兜底，但不会因为"慢一点"就把人钉在旧版本上。
   同时自检面板已提供「强制更新」按钮作为明确出口。 */
const NAVIGATION_TIMEOUT_MS = 8000;
const COLD_NAVIGATION_TIMEOUT_MS = 12000;

async function bufferedNavigationResponse(response) {
  // fetch() 在响应头到达时就会 resolve；必须把正文也读完，超时才真正覆盖“头到了但页面一直白屏”。
  const bytes = await response.arrayBuffer();
  const noBody = response.status === 204 || response.status === 205 || response.status === 304;

  /* 🔴v1156：**这里也要修 Content-Type。**

     这个函数专门处理**导航请求** —— 也就是"用户打开一个页面"。
     原来它直接沿用 `response.headers`：服务端回什么就传什么。
     于是服务端一次抽风（回 text/plain），
     **浏览器就直接下载或显示满屏源代码** ——
     而这正是用户反复报的那个「打开网站变成下载」。

     它比缓存那条路更靠前：**缓存还没轮到，这里就已经把坏头交出去了。**
     之前查了六轮都盯着缓存，漏了这条真正的主路。 */
  /* ⚠️ 整段包在 try 里：**修 Content-Type 是锦上添花，
     它自己出错绝不能把"页面已经拿到了"这件事搞砸。**

     实测踩到过：某些环境里 `new Headers` 不可用，
     这里一抛错，导航就落到离线兜底页（503）——
     **而那时候网络明明是通的、页面明明已经下载完了。**

     > 一个"顺手改善"的动作，出错时必须能安静退回原样。 */
  let fixedHeaders = response.headers;
  try {
    const h2 = new Headers(response.headers);
    const ct0 = (h2.get('content-type') || '').toLowerCase();
    const dispo0 = (h2.get('content-disposition') || '').toLowerCase();
    if (ct0 === '' ||
        ct0.startsWith('application/octet-stream') ||
        ct0.startsWith('binary/') ||
        ct0.startsWith('text/plain') ||
        dispo0.includes('attachment')) {
      h2.set('content-type', 'text/html; charset=utf-8');
      h2.delete('content-disposition');
    }
    fixedHeaders = h2;
  } catch (error) {}

  return new Response(noBody ? null : bytes, {
    status: response.status,
    statusText: response.statusText,
    headers: fixedHeaders
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

/* v1165 冷页面：只限「响应头」到达的时间（连接根本建不起来才算失败）；头一到就清掉计时器，正文不限时、不缓冲。 */
async function fetchColdNavigation(request, headerTimeoutMs) {
  headerTimeoutMs = Math.max(1, Number(headerTimeoutMs) || COLD_NAVIGATION_TIMEOUT_MS);
  if (typeof AbortController === 'undefined') {
    let legacyTimer;
    try {
      return await Promise.race([
        fetch(request),
        new Promise((_, reject) => { legacyTimer = setTimeout(() => reject(new Error('navigation header timeout')), headerTimeoutMs); })
      ]);
    } finally { clearTimeout(legacyTimer); }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), headerTimeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);   // 头到了：之后不管正文多慢都不会再被掐断
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

/* v1165：离线页 / 网慢页都给孩子一个能点的「返回首页」。在首页外壳的岛框里，返回首页 = 关掉这个岛；
   单独打开时回首页。以前只有「重试连接」，孩子只能按手机返回键。 */
function kidNavigationPage(title, emoji, heading, text, status) {
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
    'font-family:system-ui,-apple-system,Microsoft YaHei,sans-serif;background:#eef6ff;color:#172033">' +
    '<main style="max-width:28rem;padding:32px;text-align:center"><div style="font-size:52px">' + emoji + '</div>' +
    '<h1 style="font-size:22px">' + heading + '</h1><p style="line-height:1.7;font-size:17px">' + text + '</p>' +
    '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
    '<button id="hsnNavHome" onclick="try{if(parent!==window&&typeof parent.closeIsland===\'function\'){parent.closeIsland();}else{location.href=\'./index.html\';}}catch(e){location.href=\'./index.html\';}" ' +
    'style="font:inherit;font-size:18px;font-weight:800;padding:14px 24px;border:0;border-radius:14px;background:#4f46e5;color:white">返回首页</button>' +
    '<button id="hsnNavRetry" onclick="location.reload()" style="font:inherit;font-size:18px;font-weight:700;padding:14px 22px;border:0;' +
    'border-radius:14px;background:#dbe4ff;color:#1e2a78">再试一次</button></div></main></body></html>';
  return new Response(html, {
    status: status || 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
function offlineNavigationResponse() {
  // 不再把未缓存的岛 URL 偷偷显示成首页。URL 与内容必须一致：
  // 当前岛没有缓存时就明确告知用户，联网打开一次后才可离线使用。
  return kidNavigationPage('这个岛还没下载过', '📡', '这个岛还没下载过', '连上网再来玩吧！连网打开过一次，以后没网也能玩。');
}
/* v1165：有网但这次没拿到页面（连接断了、服务器没回话）——不说「没网」，说「网络有点慢」，给重试和返回 */
function slowNavigationResponse() {
  return kidNavigationPage('网络有点慢', '🐢', '网络有点慢，没加载完', '可能是信号不太好。点「再试一次」，或者先回首页玩别的岛。');
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    /* 🔴v1156：**这里保留 addAll —— 试过换掉，代价太大。**

       `addAll` 的问题是真的：它把服务端回的响应原样塞进缓存，
       如果那次回的是 `text/plain`（线上实测到的正是这个），
       坏响应就被固化在用户浏览器里。

       我改成过"逐个 fetch → fixHtmlType → put"，
       但 **SW 安装直接超时**（48 个文件，无论全量并发还是分批都不行）。
       而安装超时的后果比 Content-Type 错更严重：
       **整个应用外壳装不上，离线完全用不了。**

       > 一个"修 A"的改动如果把 B 弄坏，那就不是修复。

       所以这里退回 addAll，把防线放在另外两处（都已生效）：
         · `putIfReasonable` 进缓存前修 —— 覆盖运行时抓到的所有页面
         · `fixHtmlType` 取出时修 —— 覆盖缓存里已经存了坏数据的情况
       两处合起来，用户实际拿到的响应一定是好的。

       ⚠️ 保留 addAll 还有一个可贵性质：**整批成功或整批失败**。
       任何一个核心文件 404/断网都会让 install 失败，
       于是不会 skipWaiting、更不会激活一个只下到一半的应用外壳。 */
    await cache.addAll(SHELL.map(url => new Request(url, { cache: 'reload' })));
    /* 🔴v1165 复查第 2 轮：记下这一代什么时候装好（写不进去就算了：只是不做发版窗口的复查，和以前一样） */
    try { await cache.put(new Request(new URL(META_INSTALLED, self.location.href).href), new Response(String(Date.now()), { headers: { 'content-type': 'text/plain' } })); } catch (error) {}
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
/* v1165：按地址后缀给出正确的类型。以前一律改成 text/html —— JS、字体、图片被服务器发错类型时也被标成网页。
   只有「/」、目录和 .html 才是网页；认不出的后缀就不改（原样交出去，不添乱）。 */
const MIME_BY_EXT = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', webmanifest: 'application/manifest+json',
  woff2: 'font/woff2', woff: 'font/woff', ico: 'image/x-icon', webp: 'image/webp', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif'
};
function typeForUrl(url) {
  let p = '';
  try { p = new URL(String(url), self.location.href).pathname; } catch (error) { return 'text/html; charset=utf-8'; }
  if (!p || p === '/' || p.endsWith('/')) return 'text/html; charset=utf-8';
  const m = p.match(/\.([a-z0-9]+)$/i);
  if (!m) return 'text/html; charset=utf-8';   // 没有后缀的地址（部署根/伪静态）按网页
  return MIME_BY_EXT[m[1].toLowerCase()] || null;
}
function fixHtmlType(response, url) {
  try {
    if (!response || !response.ok) return response;
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    const dispo = (response.headers.get('content-disposition') || '').toLowerCase();
    /* 🔴v1156：**`text/plain` 也要算。**
       用户现场：「根地址在所有浏览器里都会变成下载。」
       而线上探测到的响应正是 `content-type: text/plain` ——
       这一版之前的判据只认 octet-stream / binary / attachment，
       **text/plain 直接放过去了**，于是这道兜底形同虚设。

       浏览器对 `text/plain` 的处理不统一：有的显示成纯文本、
       有的直接下载 —— 无论哪种，**对一个网页来说都是坏的**。 */
    const looksDownload =
      ct === '' ||
      ct.startsWith('application/octet-stream') ||
      ct.startsWith('binary/') ||
      ct.startsWith('text/plain') ||
      dispo.includes('attachment');
    if (!looksDownload) return response;   /* 正常响应一律不碰 */
    const type = typeForUrl(url || response.url || '');
    if (!type) return response;
    const headers = new Headers(response.headers);
    headers.set('content-type', type);
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
      /* v1165 复查：页面缓存按「路径」存的是一个光秃秃的 Request（不带这次导航的请求头）。服务器 / CDN 给网页加了
         Vary: Accept 或 Vary: User-Agent 时，不加 ignoreVary 就永远对不上 → 离线时玩过的岛也打不开（「这个岛还没下载过」）。
         Cache Storage 里存的是解压后的正文，忽略 Vary 不会拿到错的编码。 */
      try { fallback = await caches.match(request, { ignoreSearch: true, ignoreVary: true }); } catch (error) {}
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
          fallback = await caches.match(indexReq, { ignoreSearch: true, ignoreVary: true });
        } catch (error) {}
      }
      if (!fallback && isHomeNavigation(url)) {
        try { fallback = await caches.match(homeShellRequest(), { ignoreSearch: true, ignoreVary: true }); } catch (error) {}
      }
      const cacheable = isHomeNavigation(url) || /\/(?:index|_frame|land_map|spelling_bee|boss_hall|season_showcase|island_[a-z0-9]+)\.html$/i.test(url.pathname);
      try {
        if (fallback) {
          // 有本机缓存：照旧限时（连正文一起读完），慢了就先用缓存，绝不让孩子干等
          const fresh = await fetchNavigationWithTimeout(request, NAVIGATION_TIMEOUT_MS);
          /* v1165：服务器回 5xx（或根路径/首页 404）是服务器的事，孩子手机里明明有能玩的缓存 → 用缓存，不显示错误页 */
          if (!fresh.ok && (fresh.status >= 500 || (fresh.status === 404 && isHomeNavigation(url)))) {
            return { response: fallback, fresh: null, cacheable: false };
          }
          return { response: fresh, fresh, cacheable };
        }
        /* v1165：从没打开过的岛（没有缓存可退）：不再 12 秒就掐断正文 —— 网慢但能用时，等多久都比「请联网」强。
           只给「连响应头都等不到」设上限；拿到头以后边下边显示（不整页读完），顺手克隆一份进缓存。 */
        const fresh = await fetchColdNavigation(request, COLD_NAVIGATION_TIMEOUT_MS);
        return { response: fresh, fresh: fresh.ok ? fresh.clone() : null, cacheable };
      } catch (e) {
        if (fallback) return { response: fallback, fresh: null, cacheable: false };
        let online = false;
        try { online = !!(self.navigator && self.navigator.onLine); } catch (_) { online = false; }
        return { response: online ? slowNavigationResponse() : offlineNavigationResponse(), fresh: null, cacheable: false };
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
    event.respondWith(navigation.then(result => fixHtmlType(result.response, url)));
    return;
  }

  const isCode = /\.(?:js|css|woff2|ico|webmanifest)$/i.test(path);
  // v960 食物图标继续按岛分目录保存。允许 icons/ 下的受控子目录，避免页面离线后
  // HTML 仍在缓存、但用户指定的透明 WebP 图标全部空白。
  const isSmallIcon = /\/icons\/(?:[^/]+\/)*[^/]+\.(?:webp|png|svg)$/i.test(path);
  if (!isCode && !isSmallIcon) return;

  const cacheName = isSmallIcon ? ICON_CACHE : ASSET_CACHE;
  /* v1165：带版本号的代码（?v=1164）一个版本只有一份内容 —— 300 多个脚本地址，72 格根本装不下，离线进岛就缺核心脚本。
     加到 400 格（每次发版换缓存代号，旧代整个删掉，不会越攒越多）。图标照旧 36 格。 */
  const maxEntries = isSmallIcon ? 36 : 400;
  const versioned = /(?:^|&)v=\d+(?:&|$)/.test(url.search.slice(1));
  /* v1165：带版本号、缓存里有一模一样的地址 → 直接用缓存，不再每次都联网重下、重写缓存（以前每个脚本每次都下一遍）。
     没带版本号的照旧：先给缓存、后台联网更新。 */
  const hit = caches.match(request).catch(() => null);
  const network = hit.then(found => (found && versioned) ? null : fetch(request));
  const refresh = network.catch(() => null);
  event.waitUntil(network.then(response => response ? putIfReasonable(cacheName, request, response, maxEntries) : false).catch(() => false));
  /* 🔴v1165 复查第 2 轮：命中的是发版窗口里存的那份 → 这次照旧用它，后台再问一次服务器（见 META_INSTALLED 那段） */
  if (isCode && versioned) {
    event.waitUntil(hit.then(found => found ? needsRecheck(found, request) : false)
      .then(yes => yes ? recheckVersioned(request) : false).catch(() => false));
  }
  if (isCode) {
    // v946: code cache keys include the version query.  The former
    // ignoreSearch:true could answer ?v=1164 with stale prior-version JavaScript on
    // the first reload.  Try exact cache, then network, and use the install
    // shell's bare URL only as a true offline fallback.
    /* 🔴v1156：**这条路径以前漏了 fixHtmlType。**
       导航请求那条（上面 `navigation.then(...)`）修了，
       但**页面被当成普通资源请求时走的是这条** ——
       比如从缓存里取 `index.html`、或者 `?v=` 带版本号的页面。
       缓存里如果存着一份 `text/plain` 的 index.html，
       这条路径会原样发出去，**浏览器照样下载**。

       三处读缓存的地方现在都过一遍 fixHtmlType：
       导航 / 精确命中 / 离线兜底。 */
    event.respondWith((async () => {
      const exact = await hit;
      if (exact) return fixHtmlType(exact, url);
      const fresh = await refresh;
      if (fresh) return fixHtmlType(fresh, url);
      const bare = await caches.match(new Request(url.origin + url.pathname));
      return (bare ? fixHtmlType(bare, url) : null) ||
        new Response('', { status: 504 });
    })());
  } else {
    /* 🔴v1156 第八轮：**这条路径也漏了 fixHtmlType。**

       SW 里一共三条 `respondWith`，前两条前几轮都修了，
       **这条第三条一直没人管** —— 它是资源请求的兜底路径，
       页面被当成普通资源（比如带 ?v= 版本号）时就走这里。

       缓存里如果存着一份 text/plain 的 HTML，这条会原样发出去。

       > 查了七轮才把三条路径凑齐 —— 这正说明
       > **"改一处就以为修好了"是这类问题最大的陷阱**。
       > 凡是"能把响应交给浏览器"的地方，一条都不能漏。 */
    /* v1165：图标先找一模一样的地址（?v= 也一样），再联网；忽略 ?v= 的旧副本只在断网时兜底 ——
       以前先按忽略 ?v= 去找，图标换了新图（新 ?v=）老玩家也一直看到旧图。 */
    event.respondWith((async () => {
      const exact = await hit;
      if (exact) return fixHtmlType(exact, url);
      const fresh2 = await refresh;
      if (fresh2) return fixHtmlType(fresh2, url);
      const cached = await caches.match(request, { ignoreSearch: true }).catch(() => null);
      if (cached) return fixHtmlType(cached, url);
      return new Response('', { status: 504 });
    })());
  }
});
