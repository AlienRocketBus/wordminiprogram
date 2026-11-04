import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const BASE = 'http://127.0.0.1:8977';
export const OUT = '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/mp-research/optimize';
export const UA = 'Mozilla/5.0 (Linux; Android 12; M2012K11AC Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 Mobile Safari/537.36 XWEB/5197 MMWEBSDK/20230805 MMWEBID/1234 MicroMessenger/8.0.42.2460(0x28002A35) WeChat/arm64 Weixin NetType/4G Language/zh_CN ABI/arm64';
export async function launch(){ return chromium.launch({ headless:true, args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'] }); }
export async function ctx(b, opts={}){
  const c = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor: opts.dpr||2, isMobile:true, hasTouch:true,
    serviceWorkers: opts.sw||'block', locale:'zh-CN', userAgent: UA, colorScheme: opts.scheme||'light' });
  c.__ext = [];
  await c.route('**/*', r => { const u=r.request().url(); if(u.startsWith(BASE)||u.startsWith('data:')||u.startsWith('blob:')) return r.continue(); c.__ext.push(u.slice(0,160)); return r.abort(); });
  if (opts.init) await c.addInitScript(opts.init, opts.initArg);
  return c;
}
export async function visibleClickables(p){
  return p.evaluate(()=>{
    const out=[]; const els=document.querySelectorAll('button,a,[onclick],[role=button],.btn,[class*=card],[class*=island]');
    for(const e of els){ const r=e.getBoundingClientRect(); if(r.width<2||r.height<2) continue; if(r.bottom<0||r.top>window.innerHeight) continue;
      const cs=getComputedStyle(e); if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity===0) continue;
      out.push({t:(e.innerText||e.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,40), w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.x), y:Math.round(r.y), tag:e.tagName, id:e.id, cls:(e.className&&e.className.baseVal===undefined?e.className:'').toString().slice(0,40)}); }
    return out; });
}
