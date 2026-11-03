/* 岛屿页打开要多久：v1163 vs v1164（同一台机器、CPU 降速 4 倍、没登录、腾讯云由模拟云端应答） */
const roots = { v1163: '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/review/side-effects/base1163', v1164: '/home/user/wordminiprogram' };
const RUNS = Number(process.env.RUNS || 3);
const PAGE = process.env.PAGE || '/island_animal.html';
const out = {};
for (const [ver, root] of Object.entries(roots)) {
  const H = await import(root + '/cloudbase_e2e_harness.mjs');
  const srv = await H.startStatic();
  const browser = await H.launchBrowser();
  out[ver] = [];
  for (let i = 0; i < RUNS; i++) {
    const emu = H.makeEmulator({});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, serviceWorkers: 'block', locale: 'zh-CN' });
    await emu.attach(ctx);
    await ctx.route((u) => { const h = new URL(u).hostname; return !/^(127\.0\.0\.1|localhost)$/.test(h) && !/(tencentcloudapi\.com|tcloudbase\.com|tcloudbasegateway\.com|tcloudbaseapp\.com|myqcloud\.com|qcloud\.com|cloudbase\.net)$/.test(h); }, (r) => r.abort().catch(() => {}));
    await ctx.addInitScript(() => { window.__lt = 0; window.__ltN = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt += e.duration; window.__ltN++; } }).observe({ type: 'longtask', buffered: true }); } catch (e) {} });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    const t0 = Date.now();
    await page.goto(srv.origin + PAGE, { waitUntil: 'load', timeout: 120000 });
    const tLoad = Date.now() - t0;
    await page.waitForFunction(() => !!(window.HansenAuth && window.HansenPkRoom && window.HansenFriends && window.HansenLadderUI), null, { timeout: 120000 });
    const tReady = Date.now() - t0;
    await new Promise((r) => setTimeout(r, 6000));
    const m = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), lt: Math.round(window.__lt), ltN: window.__ltN, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1 }; });
    out[ver].push({ tLoad, tReady, ...m, frames: page.frames().length, errs: errs.length });
    await ctx.close();
  }
  await browser.close(); srv.close();
}
for (const [v, rs] of Object.entries(out)) {
  const avg = (k) => Math.round(rs.reduce((a, r) => a + r[k], 0) / rs.length);
  console.log(v, JSON.stringify(rs));
  console.log(`  ${v} 平均: DOMContentLoaded ${avg('dcl')}ms · load ${avg('load')}ms · 模块就绪 ${avg('tReady')}ms · 长任务合计 ${avg('lt')}ms（${avg('ltN')} 个，含加载后 6 秒）· 堆 ${avg('heap')}MB`);
}
