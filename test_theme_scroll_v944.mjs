#!/usr/bin/env node
/** v944 regression: every free-theme actor keeps moving during and after a real touch scroll. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from './playwright_loader.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const GLOBAL_TIMEOUT_MS = 120_000;
const expected = { cosmos: 5, pink: 8, ocean: 6, forest: 9, rainbow: 8, peach: 10 };

const read = filename => fs.readFileSync(path.join(ROOT, filename), 'utf8');
const CACHE_VERSION = read('VERSION').trim();
const perfSource = read('hansen_perf_v944.js');
assert.doesNotMatch(perfSource, /hsn-scrolling|animation-play-state\s*:\s*paused/i,
  'the performance engine must not pause CSS animation during scrolling');

const indexSource = read('index.html');
const perfScriptRefs = Array.from(indexSource.matchAll(
  /<script\b[^>]*\bsrc=["']([^"']*hansen_perf[^"']*)["'][^>]*>/gi
), match => match[1]);
assert.deepEqual(perfScriptRefs, [`hansen_perf_v944.js?v=${CACHE_VERSION}`],
  'index.html must load only the immutable v944 performance script');

// v944 uses an immutable service-worker pathname so an older worker cannot
// answer the update request with stale code from the old shell cache.
const swSource = read('sw_v944.js');
assert.match(swSource, new RegExp(`'\\.\\/hansen_perf_v944\\.js\\?v=${CACHE_VERSION}'`),
  'the v944 service-worker shell must use the new performance-script pathname');
assert.doesNotMatch(swSource, /'\.\/hansen_perf\.js'/,
  'the old performance-script pathname must not return to the shell cache');
const codeBranch = swSource.slice(swSource.indexOf('if (isCode)'));
assert(codeBranch.indexOf('const exact = await caches.match(request)') >= 0,
  'versioned code must use an exact cache key');
assert(codeBranch.indexOf('const exact = await caches.match(request)') < codeBranch.indexOf('const fresh = await refresh'),
  'versioned code must check exact cache before network');
assert(codeBranch.indexOf('const fresh = await refresh') < codeBranch.indexOf('url.origin + url.pathname'),
  'bare shell code may only be used after the network fails');

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};

let server = null;
let browser = null;
let globalTimer = null;

function listen(serverInstance) {
  return new Promise((resolve, reject) => {
    const onError = error => { serverInstance.off('listening', onListening); reject(error); };
    const onListening = () => { serverInstance.off('error', onError); resolve(); };
    serverInstance.once('error', onError);
    serverInstance.once('listening', onListening);
    serverInstance.listen(0, '127.0.0.1');
  });
}

function closeServer(serverInstance) {
  return new Promise((resolve, reject) => {
    if (!serverInstance || !serverInstance.listening) { resolve(); return; }
    serverInstance.close(error => error ? reject(error) : resolve());
    try { serverInstance.closeAllConnections?.(); } catch (_) {}
  });
}

function actorMap(reference, sample, label) {
  const expectedClasses = reference.actors.map(actor => actor.className).sort();
  const actualClasses = sample.actors.map(actor => actor.className).sort();
  assert.equal(new Set(actualClasses).size, actualClasses.length,
    `${label}: duplicate actor identity`);
  assert.equal(sample.actors.length, reference.actors.length,
    `${label}: actor count changed during the gesture`);
  assert.deepEqual(actualClasses, expectedClasses,
    `${label}: actor identity changed during the gesture`);
  return new Map(sample.actors.map(actor => [actor.className, actor]));
}

function assertRunningFrame(reference, sample, label) {
  const current = actorMap(reference, sample, label);
  for (const baseline of reference.actors) {
    const actor = current.get(baseline.className);
    assert(actor.cssStates.length > 0 && actor.cssStates.every(state => state === 'running'),
      `${label}/${baseline.className}: computed CSS paused an animation`);
    assert(baseline.animations.length > 0,
      `${label}/${baseline.className}: actor has no CSS animation baseline`);
    assert.equal(new Set(baseline.animations.map(animation => animation.name)).size,
      baseline.animations.length, `${label}/${baseline.className}: duplicate animation names are ambiguous`);
    assert.deepEqual(actor.animations.map(animation => animation.name).sort(),
      baseline.animations.map(animation => animation.name).sort(),
      `${label}/${baseline.className}: animation identity changed`);
    assert(actor.animations.every(animation => animation.state === 'running'),
      `${label}/${baseline.className}: Web Animations state is not running`);
  }
  assert.equal(sample.actors.some(actor => Math.abs(actor.x) < 1 && Math.abs(actor.y) < 1), false,
    `${label}: an actor collapsed to the top-left`);
  return current;
}

function assertAnimationsAdvanced(reference, samples, minimumMs, label) {
  assert(samples.length > 0, `${label}: no samples were collected`);
  const finalActors = actorMap(reference, samples.at(-1), `${label}/final`);
  for (const baseline of reference.actors) {
    const finalActor = finalActors.get(baseline.className);
    const finalAnimations = new Map(finalActor.animations.map(animation => [animation.name, animation]));
    baseline.animations.forEach((animation, animationIndex) => {
      const finalAnimation = finalAnimations.get(animation.name);
      assert(finalAnimation, `${label}/${baseline.className}/${animation.name}: animation disappeared`);
      assert(finalAnimation.time - animation.time > minimumMs,
        `${label}/${baseline.className}/${animation.name}${animationIndex === 0 ? ' (primary track)' : ''}: ` +
        `currentTime advanced only ${(finalAnimation.time - animation.time).toFixed(1)}ms`);
    });
  }
}

function isLocalCritical(urlString, resourceType, origin) {
  let url;
  try { url = new URL(urlString); } catch (_) { return false; }
  if (url.origin !== origin) return false;
  if (['document', 'script', 'stylesheet', 'font', 'manifest'].includes(resourceType)) return true;
  return /\.(?:html?|js|css|json|woff2?|webmanifest)$/i.test(url.pathname);
}

async function run() {
  server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const filename = path.resolve(ROOT, relative);
      if (!filename.startsWith(ROOT + path.sep) || !fs.statSync(filename).isFile()) throw new Error('not found');
      response.writeHead(200, {
        'content-type': mime[path.extname(filename)] || 'application/octet-stream',
        'cache-control': 'no-store'
      });
      const stream = fs.createReadStream(filename);
      stream.on('error', () => { if (!response.headersSent) response.writeHead(500); response.end(); });
      stream.pipe(response);
    } catch (_) {
      response.writeHead(404).end('not found');
    }
  });
  await listen(server);
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const executablePath = process.env.HANSEN_CHROMIUM_PATH ||
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
  browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox'] });

  for (const reducedMotion of ['no-preference', 'reduce']) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 },
      isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion,
      serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/149 Mobile Safari/537.36'
    });
    try {
      await context.addInitScript(() => {
        if (window.top === window) localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem('hsnViewMode', 'desktop');
        localStorage.setItem('hansen_onboarded', '1');
        window.__hsnThemeScrollTouchEvents = [];
        const record = event => {
          window.__hsnThemeScrollTouchEvents.push({
            type: event.type,
            touches: event.touches ? event.touches.length : 0,
            changedTouches: event.changedTouches ? event.changedTouches.length : 0,
            at: performance.now()
          });
        };
        for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
          document.addEventListener(type, record, { capture: true, passive: true });
        }
      });

      const page = await context.newPage();
      page.setDefaultTimeout(12_000);
      page.setDefaultNavigationTimeout(20_000);
      const pageErrors = [];
      const consoleErrors = [];
      const requestFailures = [];
      const criticalResponses = [];
      const perfRequests = [];
      const perfResponses = [];
      const oldPerfRequests = [];

      page.on('pageerror', error => pageErrors.push(String(error)));
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin !== origin) return;
        if (url.pathname === '/hansen_perf_v944.js') perfRequests.push(request.url());
        if (url.pathname === '/hansen_perf.js') oldPerfRequests.push(request.url());
      });
      page.on('requestfailed', request => {
        if (isLocalCritical(request.url(), request.resourceType(), origin)) {
          const errorText = request.failure()?.errorText || '';
          // hansen_preload intentionally races/cancels speculative fetches.
          // A cancelled `fetch` is not a failed parser-loaded script; direct
          // document/script/style/font failures remain release-blocking.
          if (request.resourceType() === 'fetch' && errorText === 'net::ERR_ABORTED') return;
          requestFailures.push(`${request.resourceType()} ${request.url()} ${errorText}`);
        }
      });
      page.on('response', response => {
        const request = response.request();
        const url = new URL(response.url());
        if (url.origin === origin && url.pathname === '/hansen_perf_v944.js') {
          perfResponses.push({ url: response.url(), status: response.status() });
        }
        if (isLocalCritical(response.url(), request.resourceType(), origin) &&
            (response.status() < 200 || response.status() >= 300)) {
          criticalResponses.push(`${response.status()} ${request.resourceType()} ${response.url()}`);
        }
      });

      await page.goto(`${origin}/index.html?theme-scroll-v944=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('.star').length === 80);
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
        reducedMotion === 'reduce', `${reducedMotion}: browser did not apply the requested motion preference`);
      assert.equal(await page.evaluate(() => localStorage.getItem('hansen_onboarded')), '1',
        `${reducedMotion}: onboarding suppression marker was lost`);
      assert.equal(await page.evaluate(() => Boolean(document.getElementById('__hansen_onboarding'))), false,
        `${reducedMotion}: onboarding overlay is intercepting the touch gesture`);
      assert.equal(await page.evaluate(() => document.scrollingElement.scrollHeight > innerHeight + 500), true,
        `${reducedMotion}: real home page is not tall enough for the touch-scroll regression`);
      const expectedPerfVersion = `${CACHE_VERSION}`;
      assert(perfRequests.length >= 1 && perfRequests.every(url => new URL(url).searchParams.get('v') === expectedPerfVersion),
        `${reducedMotion}: immutable v944 performance script was not requested with ?v=${expectedPerfVersion}`);
      assert(perfResponses.length >= 1 && perfResponses.every(response => response.status === 200),
        `${reducedMotion}: immutable v944 performance script did not load with HTTP 200`);
      assert.deepEqual(oldPerfRequests, [], `${reducedMotion}: page requested the old performance-script path`);

      const client = await context.newCDPSession(page);
      await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
      const touch = y => [{ x: 200, y, id: 1, radiusX: 1, radiusY: 1, force: 1 }];
      const sample = () => page.evaluate(() => ({
        scrollY,
        touchEvents: (window.__hsnThemeScrollTouchEvents || []).slice(),
        actors: Array.from(document.querySelectorAll('.flyer[data-flyer-theme]'))
          .filter(element => getComputedStyle(element).display !== 'none')
          .map(element => {
            const style = getComputedStyle(element);
            const box = element.getBoundingClientRect();
            return {
              className: element.className,
              cssStates: style.animationPlayState.split(',').map(value => value.trim()),
              animations: element.getAnimations().map(animation => ({
                name: animation.animationName || animation.id || '',
                state: animation.playState,
                time: Number(animation.currentTime) || 0
              })),
              transform: style.transform,
              x: box.x,
              y: box.y
            };
          })
      }));

      for (const [theme, count] of Object.entries(expected)) {
        await page.evaluate(value => {
          localStorage.setItem('theme', value);
          document.body.dataset.theme = value;
          window.__hsnThemeScrollTouchEvents = [];
          scrollTo(0, 0);
        }, theme);
        // Reassert scrollTop several times to cancel any fling left by the previous theme.
        for (let settle = 0; settle < 3; settle++) {
          await page.waitForTimeout(55);
          await page.evaluate(() => scrollTo(0, 0));
        }
        const stableY = await page.evaluate(() => scrollY);
        await page.waitForTimeout(70);
        const stableYAfter = await page.evaluate(() => scrollY);
        assert(Math.abs(stableY) < 1 && Math.abs(stableYAfter) < 1,
          `${reducedMotion}/${theme}: residual inertial scroll was not stopped at the test origin`);

        const before = await sample();
        assert.equal(before.actors.length, count, `${reducedMotion}/${theme}: actor count changed`);
        assertRunningFrame(before, before, `${reducedMotion}/${theme}/before`);

        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(690) });
        const during = [];
        for (let step = 0; step < 10; step++) {
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: touch(690 - (step + 1) * 27)
          });
          await page.waitForTimeout(55);
          during.push(await sample());
        }

        for (const [frameIndex, frame] of during.entries()) {
          assertRunningFrame(before, frame, `${reducedMotion}/${theme}/during-${frameIndex}`);
          assert.equal(frame.touchEvents.some(event => event.type === 'touchend'), false,
            `${reducedMotion}/${theme}: a during-scroll sample happened after touchend`);
        }
        const duringEvents = during.at(-1).touchEvents;
        assert(duringEvents.some(event => event.type === 'touchstart'),
          `${reducedMotion}/${theme}: browser did not dispatch touchstart`);
        // Once Chromium hands scrolling to the compositor it may suppress later
        // DOM touchmove events.  The explicit CDP moves plus the scroll-distance
        // assertion below are the authoritative proof of an active gesture.
        assert(during.at(-1).scrollY - before.scrollY > 150,
          `${reducedMotion}/${theme}: CDP gesture did not produce a real vertical scroll`);
        assertAnimationsAdvanced(before, during, 350, `${reducedMotion}/${theme}/during-touch`);
        assert.equal(before.actors.some(actor => {
          const transforms = new Set(during.map(frame =>
            frame.actors.find(item => item.className === actor.className)?.transform));
          return transforms.size >= 4;
        }), true, `${reducedMotion}/${theme}: no visible travel transform changed during touch scrolling`);

        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const ended = await sample();
        const afterTouchEnd = [];
        for (let frame = 0; frame < 7; frame++) {
          await page.waitForTimeout(45);
          afterTouchEnd.push(await sample());
        }
        // Chromium transfers a native scroll to the compositor after the first
        // touchmove and may consequently expose neither touchend nor touchcancel
        // to page JavaScript.  The recorded sequence still proves touchstart /
        // touchmove occurred before every `during` sample; the CDP touchEnd above
        // is the authoritative end boundary for the post-end samples below.
        const postEvents = afterTouchEnd.at(-1).touchEvents;
        assert.deepEqual(postEvents.slice(0, duringEvents.length), duringEvents,
          `${reducedMotion}/${theme}: recorded touch sequence was rewritten after CDP touchEnd`);
        for (const [frameIndex, frame] of afterTouchEnd.entries()) {
          assertRunningFrame(ended, frame, `${reducedMotion}/${theme}/after-touchend-${frameIndex}`);
        }
        assertAnimationsAdvanced(ended, afterTouchEnd, 180,
          `${reducedMotion}/${theme}/after-touchend`);

        // Raw Input.dispatchTouchEvent deliberately makes no promise that a
        // discrete synthetic release will create a fling.  Exercise inertia in
        // its dedicated CDP path, with preventFling:false and an explicit speed,
        // then sample the compositor tail after the command has returned.
        const inertiaBaseline = afterTouchEnd.at(-1);
        const inertialGesture = client.send('Input.synthesizeScrollGesture', {
          x: 200, y: 650, yDistance: -600, speed: 900,
          gestureSourceType: 'mouse', preventFling: false
        });
        const inertia = [];
        // Sample while the synthetic smooth-scroll gesture is in flight; awaiting the
        // command first would return only after Chromium has completed it.
        for (let frame = 0; frame < 18; frame++) {
          await page.waitForTimeout(35);
          inertia.push(await sample());
        }
        await inertialGesture;
        for (let frame = 0; frame < 4; frame++) {
          await page.waitForTimeout(45);
          inertia.push(await sample());
        }
        for (const [frameIndex, frame] of inertia.entries()) {
          assertRunningFrame(inertiaBaseline, frame,
            `${reducedMotion}/${theme}/inertia-${frameIndex}`);
        }
        assertAnimationsAdvanced(inertiaBaseline, inertia, 500,
          `${reducedMotion}/${theme}/synthetic-inertia`);
        const inertiaPositions = [inertiaBaseline, ...inertia].map(frame => frame.scrollY);
        assert(Math.max(...inertiaPositions) - Math.min(...inertiaPositions) > 1,
          `${reducedMotion}/${theme}: synthesizeScrollGesture produced no measurable scroll: ${JSON.stringify(inertiaPositions)}`);
      }

      await page.waitForTimeout(100);
      assert.deepEqual(oldPerfRequests, [], `${reducedMotion}: old performance path was requested late`);
      assert(perfResponses.length >= 1 && perfResponses.every(response => response.status === 200),
        `${reducedMotion}: v944 performance script lost its successful response`);
      assert.deepEqual(pageErrors, [], `${reducedMotion}: page errors during touch scrolling`);
      assert.deepEqual(consoleErrors, [], `${reducedMotion}: console errors during touch scrolling`);
      assert.deepEqual(requestFailures, [], `${reducedMotion}: critical local request failures`);
      assert.deepEqual(criticalResponses, [], `${reducedMotion}: critical local non-2xx responses`);
    } finally {
      await context.close();
    }
  }
}

let runError = null;
try {
  const timeout = new Promise((_, reject) => {
    globalTimer = setTimeout(() => reject(new Error(
      `v944 theme-scroll regression exceeded ${GLOBAL_TIMEOUT_MS}ms global timeout`
    )), GLOBAL_TIMEOUT_MS);
  });
  await Promise.race([run(), timeout]);
} catch (error) {
  runError = error;
} finally {
  if (globalTimer) clearTimeout(globalTimer);
  const cleanupTasks = [];
  if (browser) cleanupTasks.push(Promise.resolve().then(() => browser.close()));
  if (server) cleanupTasks.push(Promise.resolve().then(() => closeServer(server)));
  const cleanupResults = await Promise.allSettled(cleanupTasks);
  const cleanupErrors = cleanupResults
    .filter(result => result.status === 'rejected')
    .map(result => result.reason);
  if (!runError && cleanupErrors.length) runError = new AggregateError(cleanupErrors, 'theme-scroll cleanup failed');
}

if (runError) throw runError;
console.log('✅ v944 theme scroll regression passed (6 themes × normal/reduced-motion × real CDP touch)');
