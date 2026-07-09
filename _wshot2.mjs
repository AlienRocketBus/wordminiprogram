import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto('file:///home/claude/v846/dev/_wtest2.html');
await page.waitForTimeout(500);
const el = await page.$('#c');
await el.screenshot({ path: '/home/claude/v846/dev/_wshot2.png' });
await browser.close();
console.log('shot done');
