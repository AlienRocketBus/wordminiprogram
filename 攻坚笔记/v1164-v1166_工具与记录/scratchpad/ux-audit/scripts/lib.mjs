// Shared harness for the UX audit: static server over the pristine v1163 snapshot,
// iPhone-like contexts, signed-in presets, fake transport helpers, measurement utils.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

export const SCR = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad';
export const ROOT = SCR + '/v1163_snapshot';
export const OUT = SCR + '/ux-audit/shots';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain'
};

export async function startServer() {
  const srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
    fs.readFile(fp, (e, d) => {
      if (e) { r.writeHead(404); r.end(); return; }
      const ext = path.extname(p);
      r.writeHead(200, { 'content-type': MIME[ext] || (p.endsWith('/VERSION') ? 'text/plain' : 'application/octet-stream'),
        'cache-control': 'no-store' });
      r.end(d);
    });
  });
  await new Promise(res => srv.listen(0, '127.0.0.1', res));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}

export async function launch() {
  return chromium.launch({ headless: true, args: ['--no-sandbox'] });
}

/* opts: theme 'dark'|'light', width, signedIn, name, cid, records (array for HansenPkRecord) */
export async function newCtx(browser, opts = {}) {
  const width = opts.width || 390;
  const ctx = await browser.newContext({
    viewport: { width, height: opts.height || 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'zh-CN',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.47(0x18002f2f) NetType/WIFI Language/zh_CN'
  });
  // Block everything that is not our local server (CDNs, cloud SDK endpoints)
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
  await ctx.addInitScript(o => {
    try {
      // Mark this init as done once so reload-based flows don't reset state the test changed
      if (sessionStorage.getItem('__ux_init')) return;
      sessionStorage.setItem('__ux_init', '1');
      if (o.theme === 'light') localStorage.setItem('hansen_palette_global', o.lightId || 'cloud');
      else localStorage.removeItem('hansen_palette_global');
      if (o.signedIn !== false) {
        localStorage.setItem('hansen_auth_v1004', JSON.stringify({ uid: 'ME', method: 'username', username: 'xiaoming', signedAt: Date.now() }));
        localStorage.setItem('hansen_sb_profile_owner_v1154', 'ME');
        localStorage.setItem('hansen_pk_record_owner_v1156', 'ME');
      }
      if (o.name !== '') {
        localStorage.setItem('hansen_sb_profile_v1002', JSON.stringify({ name: o.name || '小明', cid: o.cid || 7, cidLocked: true, showcase: [], privacy: 'public', nameChangedAt: 0, avatar: '' }));
      }
      // Skip first-run onboarding style overlays where keys are known
      localStorage.setItem('hansen_onboarded', '1');
    } catch (e) {}
  }, { theme: opts.theme || 'dark', lightId: opts.lightId, signedIn: opts.signedIn, name: opts.name, cid: opts.cid });
  return ctx;
}

export async function openPage(ctx, base, url, wait = 4000) {
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
  pg.on('dialog', async d => { errs.push('DIALOG(' + d.type() + '): ' + d.message()); try { await d.dismiss(); } catch (e) {} });
  await pg.goto(base + '/' + url, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(wait);
  pg.__errs = errs;
  return pg;
}

export async function shot(pg, name, full = false) {
  const file = OUT + '/' + name + '.png';
  await pg.screenshot({ path: file, fullPage: full });
  return file;
}

/* Install a fake in-memory transport + identity into the page */
export async function wire(pg, o = {}) {
  await pg.evaluate(o => {
    window.__hsnLadderWaitSec = o.waitSec || 20;
    const rooms = o.rooms || [];
    window.__rooms = rooms;
    window.HansenPkRoom._setMeForTest({ id: 'ME', name: '小明' });
    window.HansenPkRoom._setTransportForTest({
      read: async id => { if (o.offline) throw new TypeError('Failed to fetch'); return rooms.find(x => x._id === id) || null; },
      claim: async (id, g, p) => {
        if (o.claimFails) return { updated: 0 };
        const r = rooms.find(x => x._id === id); if (!r) return { updated: 0 };
        for (const k of Object.keys(g)) if (r[k] !== g[k]) return { updated: 0 };
        Object.assign(r, p); return { updated: 1 };
      },
      patch: async (id, p) => { const r = rooms.find(x => x._id === id); if (r) Object.assign(r, p); return { updated: 1 }; },
      add: async d => { const doc = Object.assign({ _id: 'NEW' + rooms.length }, d); rooms.push(doc); return { id: doc._id }; },
      list: async (w) => rooms.filter(r => (!w || !w.code || r.code === w.code) && r.status === 'open'),
      remove: async () => true,
      listOpen: async () => {
        if (o.offline) throw new TypeError('Failed to fetch');
        if (o.loginErr) { const e = new Error('[unauthenticated] credentials not found'); throw e; }
        return rooms.filter(r => r.status === 'open' && r.isPrivate === false && !r.guestId);
      }
    });
  }, o);
}

/* WCAG contrast of an element's text vs. its first opaque-ish ancestor background,
   compositing semi-transparent layers over the page background. */
export const CONTRAST_FN = `
window.__lum = function(c){
  const m=(c.match(/[\\d.]+/g)||[0,0,0]).map(Number);
  const f=x=>{x=x/255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};
  return 0.2126*f(m[0])+0.7152*f(m[1])+0.0722*f(m[2]);
};
window.__parse = function(c){ const m=(c.match(/[\\d.]+/g)||[0,0,0,1]).map(Number); return {r:m[0],g:m[1],b:m[2],a:m.length>3?m[3]:1}; };
window.__over = function(top, bot){ const a=top.a; return {r:top.r*a+bot.r*(1-a), g:top.g*a+bot.g*(1-a), b:top.b*a+bot.b*(1-a), a:1}; };
window.__bgOf = function(el, fallback){
  const layers=[]; let n=el;
  while(n && n.nodeType===1){
    const cs=getComputedStyle(n);
    const bi=cs.backgroundImage;
    if(bi && bi!=='none' && /gradient/.test(bi)){
      // take first color stop of the gradient as an approximation
      const m=bi.match(/rgba?\\([^)]+\\)/); if(m) layers.push(__parse(m[0]));
      if(m && __parse(m[0]).a>=0.99) break;
    }
    const c=cs.backgroundColor;
    if(c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)){ const p=__parse(c); layers.push(p); if(p.a>=0.99) break; }
    n=n.parentElement;
  }
  let base=__parse(fallback||'rgb(255,255,255)');
  for(let i=layers.length-1;i>=0;i--) base=__over(layers[i], base);
  return base;
};
window.__ratio = function(el, fallback){
  const cs=getComputedStyle(el); let fg=__parse(cs.color);
  let op=1, n=el; while(n&&n.nodeType===1){ op*=parseFloat(getComputedStyle(n).opacity||1); n=n.parentElement; }
  const bg=__bgOf(el, fallback);
  fg={...fg, a:(fg.a||1)*op}; const fgc=__over(fg,bg);
  const s=c=>'rgb('+Math.round(c.r)+','+Math.round(c.g)+','+Math.round(c.b)+')';
  const a=__lum(s(fgc)), b=__lum(s(bg));
  return {ratio:+((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)).toFixed(2), fg:s(fgc), bg:s(bg), size:parseFloat(cs.fontSize), weight:cs.fontWeight};
};
window.__textAudit = function(rootSel, fallback){
  const root=document.querySelector(rootSel); if(!root) return [{t:'(no '+rootSel+')'}];
  const out=[];
  root.querySelectorAll('*').forEach(el=>{
    if(!el.getClientRects().length) return;
    const st=getComputedStyle(el); if(st.visibility==='hidden'||st.display==='none') return;
    let t=''; el.childNodes.forEach(c=>{ if(c.nodeType===3) t+=c.textContent; });
    t=t.trim(); if(!t) return;
    const r=__ratio(el, fallback);
    const big = r.size>=24 || (r.size>=18.66 && parseInt(r.weight)>=700);
    out.push({t:t.slice(0,22), ...r, need: big?3:4.5, ok: r.ratio >= (big?3:4.5)});
  });
  return out;
};
window.__tapAudit = function(rootSel){
  const root=document.querySelector(rootSel)||document; const out=[];
  root.querySelectorAll('button,a[href],input,[role=button],summary,[onclick],.pr_mode,.pr_ask,.fr_item,.fr_q,.fr_st div,.k_me,.pk_me').forEach(el=>{
    const r=el.getBoundingClientRect(); if(!r.width||!r.height) return;
    const st=getComputedStyle(el); if(st.display==='none'||st.visibility==='hidden') return;
    out.push({t:(el.innerText||el.value||el.getAttribute('aria-label')||el.placeholder||'').trim().replace(/\\s+/g,' ').slice(0,24), w:Math.round(r.width), h:Math.round(r.height), ok: r.width>=44 && r.height>=44, x:Math.round(r.left), y:Math.round(r.top)});
  });
  return out;
};
window.__overflow = function(){
  const vw=document.documentElement.clientWidth; const bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const r=el.getBoundingClientRect(); if(!r.width) return;
    const st=getComputedStyle(el); if(st.position==='fixed' && (el.id||'').indexOf('hsn')<0) {}
    if(r.right>vw+1 || r.left<-1){ if(el.closest('[style*="display:none"]')) return; bad.push({tag:el.tagName, id:el.id, cls:(el.className&&el.className.baseVal===undefined?el.className:''), right:Math.round(r.right), left:Math.round(r.left), t:(el.innerText||'').slice(0,20)}); }
  });
  return {vw, scrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, bad: bad.slice(0,12)};
};
`;

export async function installMeasure(pg) { await pg.addScriptTag({ content: CONTRAST_FN }); }

export const WORDS = [
  { en: 'apple', cn: '苹果' }, { en: 'banana', cn: '香蕉' }, { en: 'bread', cn: '面包' },
  { en: 'noodles', cn: '面条' }, { en: 'milk', cn: '牛奶' }
];

/* Screenshot + measurements, appended to ux-audit/metrics/<name>.json */
export async function capture(pg, name, rootSel, fallbackBg) {
  await shot(pg, name);
  try { await installMeasure(pg); } catch (e) {}
  const m = await pg.evaluate(([sel, fb]) => {
    const has = !!document.querySelector(sel);
    return {
      root: sel, present: has,
      text: has ? (document.querySelector(sel).innerText || '').replace(/\s+/g, ' ').slice(0, 600) : '',
      contrastFails: has ? __textAudit(sel, fb).filter(x => !x.ok) : [],
      contrastAll: has ? __textAudit(sel, fb).slice(0, 60) : [],
      tapFails: has ? __tapAudit(sel).filter(x => !x.ok) : [],
      taps: has ? __tapAudit(sel) : [],
      overflow: __overflow(),
      rootScroll: has ? { sh: document.querySelector(sel).scrollHeight, ch: document.querySelector(sel).clientHeight } : null
    };
  }, [rootSel, fallbackBg || 'rgb(15,23,42)']);
  m.errs = (pg.__errs || []).slice();
  fs.mkdirSync(SCR + '/ux-audit/metrics', { recursive: true });
  fs.writeFileSync(SCR + '/ux-audit/metrics/' + name + '.json', JSON.stringify(m, null, 1));
  return m;
}

export async function islandPage(ctx, base, file = 'island_food.html') {
  const pg = await openPage(ctx, base, file, 6000);
  await pg.evaluate(() => { try { closeAlert(); } catch (e) {} });
  await pg.waitForTimeout(400);
  return pg;
}
