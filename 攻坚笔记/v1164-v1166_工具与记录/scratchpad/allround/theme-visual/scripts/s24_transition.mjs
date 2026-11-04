// Screen transition home → island in a LIGHT palette: sample frames after the tap and record their mean luminance.
import { newCtx, closeBrowser, sleep, save, BASE, TV } from './lib.mjs';
import { execFileSync } from 'node:child_process';
const out = {};
for (const pal of ['cloud', 'cosmos']) {
  const ctx = await newCtx({ palette: pal }, { dpr: 1 });
  await ctx.route(/hansen_room_warm_v1023\.js/, r => r.abort());
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await pg.goto(BASE + 'index.html', { waitUntil: 'load' }); await sleep(4000);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await pg.evaluate(() => { const a = document.querySelector('a.island'); a.scrollIntoView({ block: 'center' }); });
  await sleep(600);
  const r = await pg.evaluate(() => { const a = document.querySelector('a.island').getBoundingClientRect(); return { x: a.x + a.width / 2, y: a.y + a.height / 2 }; });
  const frames = [];
  const t0 = Date.now();
  await pg.touchscreen.tap(r.x, r.y);
  for (let i = 0; i < 26; i++) {
    const f = `${TV}/out/tr_${pal}_${String(i).padStart(2, '0')}.png`;
    await pg.screenshot({ path: f });
    frames.push({ t: Date.now() - t0, f });
  }
  const lum = JSON.parse(execFileSync('python3', ['-I', '-c', `
import json,sys
from PIL import Image, ImageStat
fs=json.loads(sys.argv[1]); o=[]
for x in fs:
    im=Image.open(x['f']).convert('L'); o.append(round(ImageStat.Stat(im).mean[0],1))
print(json.dumps(o))`, JSON.stringify(frames)], { encoding: 'utf8' }));
  out[pal] = frames.map((x, i) => ({ t: x.t, meanLum: lum[i], f: x.f.split('/').pop() }));
  console.log(pal, out[pal].map(x => x.t + 'ms:' + x.meanLum).join(' '));
  await ctx.close();
}
save('transition', out);
await closeBrowser();
