// INT-05 part 2: on a 3G-class connection the shared policy says "no background download" - does the island prefetch obey?
import { sleep } from './kit.mjs';
import { boot2 } from './kit2.mjs';
import { freshHome } from './nav.mjs';
const K = await boot2({ cache: 'public, max-age=3600' });
const page = await K.ctx.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));
const cdp = await K.ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 320, downloadThroughput: 5 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8, connectionType: 'cellular3g' });
await freshHome(K, page);
await sleep(20000);
const r = await page.evaluate(() => ({
  ect: navigator.connection && navigator.connection.effectiveType,
  policyAllows: window.HansenPreloadPolicy && HansenPreloadPolicy.canBackgroundDownload(),
  islandPrefetchLinks: [...document.querySelectorAll('link[rel=prefetch]')].map(l => l.getAttribute('href') + '(' + (l.dataset.why || '') + ')')
}));
console.log(JSON.stringify(r));
console.log('island html fetched by server:', K.reqs.filter(q => /island_.*\.html/.test(q.path)).map(q => q.url + ' ' + (q.bytes / 1e3).toFixed(0) + 'KB').join(' | '));
await K.done();
