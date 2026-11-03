import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
console.log('chromium', b.version());
await b.close();
try { const { webkit } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'); const w = await webkit.launch({ headless: true }); console.log('webkit', w.version()); await w.close(); } catch (e) { console.log('webkit unavailable:', String(e.message).slice(0, 120)); }
