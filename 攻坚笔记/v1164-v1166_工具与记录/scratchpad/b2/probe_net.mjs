import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const PORT = fs.readFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/b2/port.txt','utf8').trim();
const b = await chromium.launch(); const p = await b.newPage();
p.on('requestfailed', r => { const u = r.url(); if (!u.startsWith('http://127.0.0.1')) console.log('FAILED', u.slice(0,100), r.failure() && r.failure().errorText); });
for (const f of ['index.html','island_animal.html','island_land1.html']) { await p.goto(`http://127.0.0.1:${PORT}/${f}`); await p.waitForTimeout(3500); }
await b.close();
