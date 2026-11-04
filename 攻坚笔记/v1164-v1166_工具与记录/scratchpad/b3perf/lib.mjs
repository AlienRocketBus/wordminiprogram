import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
export const O = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/b3perf';
export const PORT = fs.readFileSync(O + '/' + (process.env.PORTFILE || 'port.txt'), 'utf8').trim();
export const BASE = `http://127.0.0.1:${PORT}/`;
export async function launch(opts = {}) {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: opts.dpr || 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; V2118A Build/SP1A.210812.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5235 MMWEBSDK/20230701 MMWEBID/1234 MicroMessenger/8.0.40.2420(0x28002837) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64',
    serviceWorkers: opts.sw ? 'allow' : 'block', locale: 'zh-CN', colorScheme: opts.colorScheme || 'light',
  });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  if (opts.init) await ctx.addInitScript(opts.init);
  return { browser, ctx };
}
export async function throttle(page, { net = true, cpu = 4 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 9e6 / 8, uploadThroughput: 1.5e6 / 8 });
  if (cpu) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return cdp;
}
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
