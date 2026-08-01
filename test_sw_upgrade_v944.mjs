#!/usr/bin/env node
/**
 * v944 migration regression: a real browser profile controlled by the v943
 * service worker must cross the upgrade gate before any stale player-state
 * script can execute.
 *
 * This test deliberately embeds its minimal v943 fixture.  It must never read
 * the historical release ZIP at runtime, because CI and a deployed source ZIP
 * only contain the current release.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';
/* v963 dyn */
import { readFileSync as __rf } from 'node:fs';
const __APPV__ = __rf(new URL('./VERSION', import.meta.url), 'utf8').trim();

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GATE_FILE = 'hansen_sw_upgrade_gate_v944.js';
const WORKER_FILE = 'sw_v944.js';
const UPGRADE_PAGE = '_sw_upgrade_v944.html';
const BOOTSTRAP_FILE = 'hansen_backup_bootstrap_v944.js';
const BACKUP_FILE = 'hansen_backup_v944.js';
const JOURNAL_KEY = 'hansen_backup_restore_journal_v942';
const OLD_BACKUP_COUNT = '__hsn_test_v943_backup_exec_count';
const OLD_PERF_COUNT = '__hsn_test_v943_perf_exec_count';

const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const CURRENT_VERSION = Number(read('VERSION').trim());
const CACHE_VERSION = String(CURRENT_VERSION);
for (const name of [GATE_FILE, WORKER_FILE, UPGRADE_PAGE, BOOTSTRAP_FILE, BACKUP_FILE]) {
  assert.equal(fs.existsSync(path.join(ROOT, name)), true,
    `${name} is required by the v944 early service-worker upgrade contract`);
}

function assertEntryContract(name, { fullBackup = false } = {}) {
  const source = read(name);
  const headIndex = source.search(/<head\b/i);
  const firstScript = source.match(/<script\b[^>]*>/i);
  assert(headIndex >= 0, `${name}: missing <head>`);
  assert(firstScript, `${name}: missing scripts`);
  assert(firstScript.index > headIndex, `${name}: first script is outside <head>`);
  assert.match(firstScript[0], new RegExp(`\\bsrc=["'](?:\\./)?${GATE_FILE.replace('.', '\\.')}\\?v=${CACHE_VERSION}["']`, 'i'),
    `${name}: the synchronous v944 upgrade gate must be the first script`);
  assert.doesNotMatch(firstScript[0], /\b(?:async|defer)\b|\btype=["']module["']/i,
    `${name}: the early upgrade gate must be parser-blocking`);
  assert.match(source, new RegExp(`\\bsrc=["'](?:\\./)?${BOOTSTRAP_FILE.replace('.', '\\.')}\\?v=${CACHE_VERSION}["']`, 'i'),
    `${name}: the backup bootstrap needs a pathname that v943 never cached`);
  assert.doesNotMatch(source, /\bsrc=["'](?:\.\/)?hansen_backup_bootstrap\.js(?:[?"'])/i,
    `${name}: the v943 bootstrap pathname must not return`);
  assert.match(source, new RegExp(`\\bsrc=["'](?:\\./)?hansen_perf_v944\\.js\\?v=${CACHE_VERSION}["']`, 'i'),
    `${name}: the scrolling fix must use the v944-only pathname`);
  assert.doesNotMatch(source, /\bsrc=["'](?:\.\/)?hansen_perf\.js(?:[?"'])/i,
    `${name}: the old performance engine must not return`);
  assert.doesNotMatch(source, /serviceWorker\.register\(\s*["']\.\/sw\.js["']/,
    `${name}: a late registration must not switch the scope back to sw.js`);
  if (fullBackup) {
    assert.match(source, new RegExp(`\\bsrc=["'](?:\\./)?${BACKUP_FILE.replace('.', '\\.')}\\?v=${CACHE_VERSION}["']`, 'i'),
      `${name}: the full backup runtime also needs a v944-only pathname`);
    assert.doesNotMatch(source, /\bsrc=["'](?:\.\/)?hansen_backup\.js(?:[?"'])/i,
      `${name}: the v943 full-backup pathname must not return`);
  }
}

assertEntryContract('index.html');
assertEntryContract('island_home.html', { fullBackup: true });

const gateSource = read(GATE_FILE);
assert.match(gateSource, /__hansenSwUpgradeGateV944/,
  'the gate must expose window.__hansenSwUpgradeGateV944');
assert.match(gateSource, /sw_v944\.js/,
  'the gate must register the new service-worker pathname');
assert.match(gateSource, /_sw_upgrade_v944\.html/,
  'the gate must use the isolated upgrade page while the old worker controls the tab');
assert.match(gateSource, /\.stop\s*\(/,
  'the gate must stop parsing before a stale v943 state script can execute');
assert.doesNotMatch(gateSource, /\bdocument\.write\s*\(/,
  'the early upgrade gate must replace the stopped document without document.write');

const workerSource = read(WORKER_FILE);
assert.match(workerSource, /hansen-v944-/,
  'the new worker must use the v944 cache namespace');
assert.match(workerSource, /hansen_backup_bootstrap_v944\.js/,
  'the new worker shell must cache the renamed bootstrap');
assert.doesNotMatch(workerSource, /["']\.\/hansen_backup_bootstrap\.js["']/,
  'the new worker shell must not cache the v943 bootstrap pathname');
assert.match(workerSource, /hansen_perf_v944\.js/,
  'the new worker shell must cache the non-pausing performance engine');
assert.match(workerSource, /SHELL_CACHE\s*=\s*CACHE_PREFIX\s*\+\s*['"]shell-157['"]/,
  'v960 must atomically install the current release shell');
assert.match(workerSource, /PAGE_CACHE\s*=\s*CACHE_PREFIX\s*\+\s*['"]pages-155['"]/,
  'v960 must rotate navigation pages to the current wiring');
assert.match(workerSource, /ASSET_CACHE\s*=\s*CACHE_PREFIX\s*\+\s*['"]assets-155['"]/,
  'v960 must rotate code so stale earlier Boss code cannot return');
for (const exactHotfixKey of [
  'hansen_canonical_progress.js?v='+__APPV__,
  'hansen_season.js?v='+__APPV__,
  'hansen_pet_showcase.js?v='+__APPV__,
  'hansen_cards.js?v='+__APPV__,
  'hansen_gacha.js?v='+__APPV__,
  'hansen_land_cards.js?v='+__APPV__,
  'hansen_quest_global.js?v='+__APPV__,
  'hansen_island_upgrade.js?v='+__APPV__,
  'hansen_explore_progress_v945.js?v='+__APPV__,
  'hansen_spell_practice.js?v='+__APPV__,
  'hansen_review.js?v='+__APPV__,
  'hansen_wrong_overview.js?v='+__APPV__,
  'hansen_backup_v944.js?v='+__APPV__,
  'hansen_accessibility.js?v='+__APPV__,
  'hansen_perf_v944.js?v='+__APPV__,
  'hansen_boss_lock.js?v='+__APPV__,
  'hansen_addiction.js?v='+__APPV__,
  'hansen_diamond_shop.js?v='+__APPV__,
  'hansen_round_reward.js?v='+__APPV__,
  'hansen_round_bar.js?v='+__APPV__,
  'hansen_econ_guide.js?v='+__APPV__,
  'hansen_mylearning.js?v='+__APPV__,
  'hansen_palette.js?v='+__APPV__,
  'hansen_boss_theme.js?v='+__APPV__,
]) {
  assert.equal(workerSource.includes(`'./${exactHotfixKey}'`), true,
    `the current v951 worker shell must cache the exact ${exactHotfixKey} request`);
}

const oldBackupFixture = String.raw`(function(){
  var key=${JSON.stringify(OLD_BACKUP_COUNT)};
  var count=Number(sessionStorage.getItem(key)||0)+1;
  sessionStorage.setItem(key,String(count));
  window.__V943_BACKUP_BOOTSTRAP_EXECUTED__=true;
  var raw=localStorage.getItem(${JSON.stringify(JOURNAL_KEY)});
  if(raw){
    try{
      var journal=JSON.parse(raw);
      if(journal&&journal.appVersion===${CURRENT_VERSION}){
        window.__hansenBackupRecoveryBlocked='v943 rejected a valid current journal';
        window.__hansenBackupBootstrap={result:{recovered:false,blocked:true,oldVersion:943}};
      }
    }catch(_error){}
  }
})();`;

const oldPerfFixture = String.raw`(function(){
  var key=${JSON.stringify(OLD_PERF_COUNT)};
  var count=Number(sessionStorage.getItem(key)||0)+1;
  sessionStorage.setItem(key,String(count));
  window.__V943_PERF_EXECUTED__=true;
  document.documentElement.classList.add('hsn-scrolling');
  var style=document.createElement('style');
  style.id='hsn-perf-css';
  style.textContent='.flyer{animation-play-state:paused!important}';
  (document.head||document.documentElement).appendChild(style);
})();`;

const oldIndexFixture = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<script src="./hansen_backup_bootstrap.js?v=943"></script>
<title>v943 fixture</title></head><body><main id="v943Fixture">v943</main>
<script src="./hansen_perf.js?v=943"></script>
<script>
window.__v943Registration=navigator.serviceWorker.register('./sw.js',{scope:'./'});
</script></body></html>`;

// This is the relevant v943 behavior, kept intentionally small: same-path code
// is answered with ignoreSearch:true, so a current cache stamp can receive cached v943 JS.
const oldWorkerFixture = `
'use strict';
const CACHE='hansen-v943-shell-upgrade-test';
const FIXTURES=${JSON.stringify({
  '/index.html': oldIndexFixture,
  '/hansen_backup_bootstrap.js': oldBackupFixture,
  '/hansen_perf.js': oldPerfFixture,
})};
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(Object.entries(FIXTURES).map(([pathname,body])=>
      cache.put(new Request(new URL(pathname,self.location.origin).href),new Response(body,{
        headers:{'content-type':pathname.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8'}
      }))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(async()=>
      (await caches.match(request,{ignoreSearch:true}))||
      (await caches.match(new URL('/index.html',self.location.origin).href,{ignoreSearch:true}))));
    return;
  }
  if(!/\\.(?:js|css|woff2|ico|webmanifest)$/i.test(url.pathname))return;
  const refresh=fetch(request).then(async response=>{
    if(response&&response.ok){
      const cache=await caches.open(CACHE);
      await cache.put(request,response.clone());
    }
    return response;
  }).catch(()=>null);
  event.waitUntil(refresh.then(()=>{}));
  event.respondWith((async()=>
    (await caches.match(request,{ignoreSearch:true}))||
    (await refresh)||new Response('',{status:504}))());
});`;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

let phase = 'v943';
const requestLog = [];

function sendText(response, status, body, contentType, extraHeaders = {}) {
  response.writeHead(status, {
    'content-type': contentType,
    'cache-control': 'no-store, max-age=0',
    ...extraHeaders,
  });
  response.end(body);
}

function serveCurrent(pathname, response) {
  try {
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filename = path.resolve(ROOT, relative);
    if (!filename.startsWith(ROOT + path.sep) || !fs.statSync(filename).isFile()) {
      throw new Error('not found');
    }
    const headers = {
      'content-type': mime[path.extname(filename)] || 'application/octet-stream',
      'cache-control': 'no-store, max-age=0',
    };
    if (pathname === `/${WORKER_FILE}`) headers['service-worker-allowed'] = '/';
    response.writeHead(200, headers);
    fs.createReadStream(filename).pipe(response);
  } catch (_error) {
    sendText(response, 404, 'not found', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer((request, response) => {
  let pathname = '/';
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch (_error) {}
  requestLog.push({ phase, pathname, url: request.url });

  // Keep the legacy URL byte-identical after the deployment switch.  This
  // prevents Chromium's automatic update check from hiding the migration bug;
  // only the agreed new sw_v944.js registration may cross the boundary.
  if (pathname === '/sw.js') {
    sendText(response, 200, oldWorkerFixture, mime['.js'], { 'service-worker-allowed': '/' });
    return;
  }

  if (phase === 'v943') {
    if (pathname === '/' || pathname === '/index.html') {
      sendText(response, 200, oldIndexFixture, mime['.html']);
    } else if (pathname === '/hansen_backup_bootstrap.js') {
      sendText(response, 200, oldBackupFixture, mime['.js']);
    } else if (pathname === '/hansen_perf.js') {
      sendText(response, 200, oldPerfFixture, mime['.js']);
    } else {
      sendText(response, 404, 'v943 fixture: not found', 'text/plain; charset=utf-8');
    }
    return;
  }

  // Make the stale cache win deterministically if a broken v944 entry ever
  // requests an old same-path script before the gate stops parsing.
  if (pathname === '/hansen_backup_bootstrap.js' || pathname === '/hansen_perf.js') {
    setTimeout(() => serveCurrent(pathname, response), 150);
    return;
  }
  serveCurrent(pathname, response);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

const validCurrentJournal = {
  schema: 1,
  appVersion: CURRENT_VERSION,
  phase: 'committed',
  beforeRaw: [],
  checksum: 'fnv1a32-811c9dc5',
};

async function installV943(page, scenario) {
  await page.goto(`${origin}/index.html?v943-fixture=${encodeURIComponent(scenario)}`, {
    waitUntil: 'load',
  });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  try {
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 8000 });
  } catch (_error) {
    // clients.claim() should control the first document; the reload keeps the
    // test portable to engines that only attach the controller on navigation.
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  }
  const oldState = await page.evaluate(async () => ({
    controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
    caches: await caches.keys(),
  }));
  assert.equal(new URL(oldState.controller).pathname, '/sw.js', `${scenario}: v943 did not control the profile`);
  assert(oldState.caches.includes('hansen-v943-shell-upgrade-test'),
    `${scenario}: v943 poison cache was not installed`);
}

async function runScenario(entry) {
  phase = 'v943';
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'allow',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await installV943(page, entry);
    await page.evaluate(({ journalKey, journal, backupCount, perfCount }) => {
      localStorage.clear();
      sessionStorage.clear();
      sessionStorage.setItem(backupCount, '0');
      sessionStorage.setItem(perfCount, '0');
      localStorage.setItem(journalKey, JSON.stringify(journal));
    }, {
      journalKey: JOURNAL_KEY,
      journal: validCurrentJournal,
      backupCount: OLD_BACKUP_COUNT,
      perfCount: OLD_PERF_COUNT,
    });
    await page.evaluate(async () => {
      const stalePage = await caches.open('hansen-v944-pages-1');
      await stalePage.put('/__v946_hf1_stale_page_probe.html', new Response('<svg data-stale-hf1-page>literal stale markup</svg>', {headers:{'content-type':'text/html'}}));
      const staleAsset = await caches.open('hansen-v944-assets-1');
      await staleAsset.put('/__v946_hf1_stale_asset_probe.js', new Response('window.__staleHf1Asset=true', {headers:{'content-type':'text/javascript'}}));
      const hf1Page = await caches.open('hansen-v944-pages-2');
      await hf1Page.put('/__v946_hf2_stale_page_probe.html', new Response('<svg data-stale-hf2-page>HF1 markup</svg>', {headers:{'content-type':'text/html'}}));
      const hf1Asset = await caches.open('hansen-v944-assets-2');
      await hf1Asset.put('/__v946_hf2_stale_asset_probe.js', new Response('window.__staleHf2Asset=true', {headers:{'content-type':'text/javascript'}}));
      const hf2Page = await caches.open('hansen-v944-pages-3');
      await hf2Page.put('/__v946_hf3_stale_page_probe.html', new Response('<span data-stale-hf3-page>HF2 pale text</span>', {headers:{'content-type':'text/html'}}));
      const hf2Asset = await caches.open('hansen-v944-assets-3');
      await hf2Asset.put('/__v946_hf3_stale_asset_probe.js', new Response('window.__staleHf3Asset=true', {headers:{'content-type':'text/javascript'}}));
      const hf2Shell = await caches.open('hansen-v944-shell-5');
      await hf2Shell.put('/__v946_hf3_stale_shell_probe.js', new Response('window.__staleHf3Shell=true', {headers:{'content-type':'text/javascript'}}));
      const hf3Page = await caches.open('hansen-v944-pages-4');
      await hf3Page.put('/__v946_hf4_stale_page_probe.html', new Response('<span data-stale-hf4-page>old long guide</span>', {headers:{'content-type':'text/html'}}));
      const hf3Asset = await caches.open('hansen-v944-assets-4');
      await hf3Asset.put('/__v946_hf4_stale_asset_probe.js', new Response('window.__staleHf4Guide=true', {headers:{'content-type':'text/javascript'}}));
      const hf3Shell = await caches.open('hansen-v944-shell-6');
      await hf3Shell.put('/__v946_hf4_stale_shell_probe.js', new Response('window.__staleHf4Shell=true', {headers:{'content-type':'text/javascript'}}));
      const hf6Page = await caches.open('hansen-v944-pages-7');
      await hf6Page.put('/__v946_hf7_stale_page_probe.html', new Response('<span data-stale-hf7-page style="color:#92400e">camel</span>', {headers:{'content-type':'text/html'}}));
      const hf6Asset = await caches.open('hansen-v944-assets-7');
      await hf6Asset.put('/hansen_boss_theme.js?v=946-hf6', new Response('window.__staleCamelBossTheme=true', {headers:{'content-type':'text/javascript'}}));
      const hf6Shell = await caches.open('hansen-v944-shell-9');
      await hf6Shell.put('/__v946_hf7_stale_shell_probe.js', new Response('window.__staleCamelShell=true', {headers:{'content-type':'text/javascript'}}));
    });

    const transitionLogStart = requestLog.length;
    phase = 'v944';
    await page.evaluate(url => location.assign(url), `${origin}/${entry}?sw-upgrade-v${CURRENT_VERSION}=${Date.now()}`);

    await page.waitForFunction(({ worker, expectedPath, currentVersion }) => {
      const marker = window.__hansenSwUpgradeGateV944;
      const controller = navigator.serviceWorker.controller;
      if (!marker || marker.version !== currentVersion || marker.ready !== true || !controller) return false;
      let controllerPath = '';
      try { controllerPath = new URL(controller.scriptURL).pathname; } catch (_error) {}
      return controllerPath === `/${worker}` && location.pathname === expectedPath;
    }, { worker: WORKER_FILE, expectedPath: `/${entry}`, currentVersion: CURRENT_VERSION });

    /* 🔴v1063 修复测试竞态：此前只等到 controller 与 pathname 就位就抓状态，
       但 hansen_backup_bootstrap_v944.js 可能**还没执行完**，于是
       window.__hansenBackupBootstrap 为 undefined，
       断言 bootstrapResult?.recovered 随机失败——该测试时红时绿的根因。
       实测证据：稍后再探测同一页面，obj 已为 true、loaded 已为 true。
       产品代码无问题，是台架少等了一步。 */
    await page.waitForFunction(() => !!(window.__hansenBackupBootstrap
                                        && window.__hansenBackupBootstrap.result),
                               null, { timeout: 20000 }).catch(() => {});

    const finalState = await page.evaluate(async ({ journalKey, backupCount, perfCount }) => {
      const registration = await navigator.serviceWorker.getRegistration('./');
      return {
        pathname: location.pathname,
        gate: window.__hansenSwUpgradeGateV944,
        controller: navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL,
        activeWorker: registration && registration.active && registration.active.scriptURL,
        oldBackupCount: Number(sessionStorage.getItem(backupCount) || 0),
        oldPerfCount: Number(sessionStorage.getItem(perfCount) || 0),
        oldBackupWindowMarker: window.__V943_BACKUP_BOOTSTRAP_EXECUTED__ === true,
        oldPerfWindowMarker: window.__V943_PERF_EXECUTED__ === true,
        recoveryBlocked: window.__hansenBackupRecoveryBlocked || '',
        bootstrapResult: window.__hansenBackupBootstrap && window.__hansenBackupBootstrap.result,
        journal: localStorage.getItem(journalKey),
        scriptPaths: Array.from(document.scripts).map(script => {
          try { return script.src ? new URL(script.src).pathname : ''; } catch (_error) { return ''; }
        }).filter(Boolean),
        oldPerfStyle: Boolean(document.getElementById('hsn-perf-css')),
        oldScrollClass: document.documentElement.classList.contains('hsn-scrolling'),
        cacheNames: await caches.keys(),
        stalePageStillReachable: Boolean(await caches.match('/__v946_hf1_stale_page_probe.html', {ignoreSearch:true})),
        staleAssetStillReachable: Boolean(await caches.match('/__v946_hf1_stale_asset_probe.js', {ignoreSearch:true})),
        hf1PageStillReachable: Boolean(await caches.match('/__v946_hf2_stale_page_probe.html', {ignoreSearch:true})),
        hf1AssetStillReachable: Boolean(await caches.match('/__v946_hf2_stale_asset_probe.js', {ignoreSearch:true})),
        hf2PageStillReachable: Boolean(await caches.match('/__v946_hf3_stale_page_probe.html', {ignoreSearch:true})),
        hf2AssetStillReachable: Boolean(await caches.match('/__v946_hf3_stale_asset_probe.js', {ignoreSearch:true})),
        hf3PageStillReachable: Boolean(await caches.match('/__v946_hf4_stale_page_probe.html', {ignoreSearch:true})),
        hf3AssetStillReachable: Boolean(await caches.match('/__v946_hf4_stale_asset_probe.js', {ignoreSearch:true})),
        hf6PageStillReachable: Boolean(await caches.match('/__v946_hf7_stale_page_probe.html', {ignoreSearch:true})),
        hf6BossThemeStillReachable: Boolean(await caches.match('/hansen_boss_theme.js?v=946-hf6')),
        hf6ShellStillReachable: Boolean(await caches.match('/__v946_hf7_stale_shell_probe.js', {ignoreSearch:true})),
      };
    }, { journalKey: JOURNAL_KEY, backupCount: OLD_BACKUP_COUNT, perfCount: OLD_PERF_COUNT });

    assert.equal(finalState.pathname, `/${entry}`, `${entry}: upgrade did not return to the original URL`);
    assert.equal(finalState.gate.version, CURRENT_VERSION, `${entry}: gate marker has the wrong version`);
    assert.equal(finalState.gate.ready, true, `${entry}: gate marker is not ready`);
    assert.equal(String(finalState.gate.controller).replace(/^.*\//, ''), WORKER_FILE,
      `${entry}: gate marker does not identify ${WORKER_FILE}`);
    assert.equal(new URL(finalState.controller).pathname, `/${WORKER_FILE}`,
      `${entry}: final page is not controlled by the new worker`);
    assert.equal(new URL(finalState.activeWorker).pathname, `/${WORKER_FILE}`,
      `${entry}: the active scope registration switched back to the legacy worker`);

    assert.equal(finalState.oldBackupCount, 0,
      `${entry}: cached v943 backup bootstrap executed during the first v944 navigation`);
    assert.equal(finalState.oldPerfCount, 0,
      `${entry}: cached v943 performance engine executed during the first v944 navigation`);
    assert.equal(finalState.oldBackupWindowMarker, false, `${entry}: stale backup window marker survived`);
    assert.equal(finalState.oldPerfWindowMarker, false, `${entry}: stale perf window marker survived`);
    assert.equal(finalState.oldPerfStyle, false, `${entry}: stale perf pause style was installed`);
    assert.equal(finalState.oldScrollClass, false, `${entry}: stale scroll-pause class was installed`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-pages-1'), false,
      `${entry}: stale pre-HF1 navigation cache survived HF2 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-assets-1'), false,
      `${entry}: stale pre-HF1 code cache survived HF2 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-pages-2'), false,
      `${entry}: stale HF1 navigation cache survived HF2 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-assets-2'), false,
      `${entry}: stale HF1 code cache survived HF2 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-pages-3'), false,
      `${entry}: stale HF2 navigation cache survived HF3 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-assets-3'), false,
      `${entry}: stale HF2 code cache survived HF3 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-shell-5'), false,
      `${entry}: stale HF2 shell cache survived HF3 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-pages-4'), false,
      `${entry}: stale HF3 navigation cache survived HF4 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-assets-4'), false,
      `${entry}: stale HF3 code cache survived HF4 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-shell-6'), false,
      `${entry}: stale HF3 shell cache survived HF4 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-pages-7'), false,
      `${entry}: stale HF6 navigation cache survived HF7 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-assets-7'), false,
      `${entry}: stale HF6 code cache survived HF7 activation`);
    assert.equal(finalState.cacheNames.includes('hansen-v944-shell-9'), false,
      `${entry}: stale HF6 shell cache survived HF7 activation`);
    assert.equal(finalState.stalePageStillReachable, false,
      `${entry}: offline navigation could still see pre-HF1 inline HTML`);
    assert.equal(finalState.staleAssetStillReachable, false,
      `${entry}: exact code lookup could still see pre-HF1 JavaScript`);
    assert.equal(finalState.hf1PageStillReachable, false,
      `${entry}: offline navigation could still see HF1 inline HTML`);
    assert.equal(finalState.hf1AssetStillReachable, false,
      `${entry}: exact code lookup could still see HF1 JavaScript`);
    assert.equal(finalState.hf2PageStillReachable, false,
      `${entry}: offline navigation could still see HF2 light-theme HTML`);
    assert.equal(finalState.hf2AssetStillReachable, false,
      `${entry}: exact code lookup could still see the HF2 theme-shop script`);
    assert.equal(finalState.hf3PageStillReachable, false,
      `${entry}: offline navigation could still see the HF3 settings wiring`);
    assert.equal(finalState.hf3AssetStillReachable, false,
      `${entry}: exact code lookup could still see the HF3 settings guide`);
    assert.equal(finalState.hf6PageStillReachable, false,
      `${entry}: offline navigation could still see the HF6 camel-coloured page`);
    assert.equal(finalState.hf6BossThemeStillReachable, false,
      `${entry}: exact lookup could still see the HF6 camel-coloured Boss theme`);
    assert.equal(finalState.hf6ShellStillReachable, false,
      `${entry}: exact lookup could still see the HF6 shell`);

    assert.equal(finalState.recoveryBlocked, '',
      `${entry}: the v944 journal was rejected: ${finalState.recoveryBlocked}`);
    assert.equal(finalState.bootstrapResult?.recovered, true,
      `${entry}: renamed bootstrap did not recover the v944 journal`);
    assert.equal(finalState.bootstrapResult?.committed, true,
      `${entry}: committed v944 journal was not accepted as committed`);
    assert.equal(finalState.journal, null, `${entry}: accepted v944 journal was not cleaned up`);
    assert(finalState.scriptPaths.includes(`/${BOOTSTRAP_FILE}`),
      `${entry}: renamed bootstrap was not executed on the safe final page`);
    assert.equal(finalState.scriptPaths.includes('/hansen_backup_bootstrap.js'), false,
      `${entry}: legacy bootstrap pathname appeared in the final document`);
    assert.equal(finalState.scriptPaths.includes('/hansen_perf.js'), false,
      `${entry}: legacy perf pathname appeared in the final document`);

    const transitionRequests = requestLog.slice(transitionLogStart).filter(item => item.phase === 'v944');
    assert(transitionRequests.some(item => item.pathname === `/${GATE_FILE}`),
      `${entry}: old worker never fetched the new-path gate`);
    assert(transitionRequests.some(item => item.pathname === `/${UPGRADE_PAGE}`),
      `${entry}: old-controlled page did not pass through the isolated upgrade page`);
    assert(transitionRequests.some(item => item.pathname === `/${WORKER_FILE}`),
      `${entry}: browser never requested the new worker pathname`);
  } finally {
    await context.close();
  }
}

try {
  await runScenario('index.html');
  await runScenario('island_home.html');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('✅ v944 SW upgrade regression passed (v943 profile → index + direct island, stale scripts = 0)');
