import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext()).newPage();
await p.setContent('<html><body></body></html>');
console.log('blank window own keys', await p.evaluate(() => Object.keys(window).length));
await b.close();
