window.__a11yAudit = function(label){
  function parse(c){ const m = c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p = m[1].split(',').map(s=>parseFloat(s)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function lum(c){ const f = v => { v/=255; return v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); }
  function blend(top, bot){ const a = top.a; return {r: top.r*a+bot.r*(1-a), g: top.g*a+bot.g*(1-a), b: top.b*a+bot.b*(1-a), a:1}; }
  function bgOf(el){
    // walk up; collect background colors; if gradient/image encountered -> unknown
    let stack = [];
    for(let p = el; p; p = p.parentElement){
      const s = getComputedStyle(p);
      if(s.backgroundImage && s.backgroundImage !== 'none') return {unknown:true, kind: /gradient/.test(s.backgroundImage)?'gradient':'image'};
      const c = parse(s.backgroundColor);
      if(c && c.a > 0){ stack.push(c); if(c.a >= 0.99) break; }
    }
    let base = {r:255,g:255,b:255,a:1};
    // if no opaque found, use body/html computed bg
    for(let i = stack.length-1; i>=0; i--) base = blend(stack[i], base);
    return base;
  }
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth && s.visibility!=='hidden' && s.display!=='none' && +s.opacity>0.05; };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while((n = walker.nextNode())){
    const t = n.textContent.trim(); if(!t || t.length < 1) continue;
    if(!/[A-Za-z0-9一-龥]/.test(t)) continue;
    const el = n.parentElement; if(!el || seen.has(el) || !vis(el)) continue;
    // check topmost
    const r = el.getBoundingClientRect(); const cx = Math.min(innerWidth-1, Math.max(0, r.left + Math.min(r.width/2, 20))); const cy = Math.min(innerHeight-1, Math.max(0, r.top + r.height/2));
    const topEl = document.elementFromPoint(cx, cy); if(!topEl || !(topEl === el || el.contains(topEl) || topEl.contains(el))) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    const fs = parseFloat(s.fontSize);
    const col = parse(s.color); const fill = s.webkitTextFillColor; let fc = col; if(fill && fill !== s.color){ const p2 = parse(fill); if(p2 && p2.a>0) fc = p2; else if (p2 && p2.a===0) fc = null; }
    const bg = bgOf(el);
    let cr = null;
    if(fc && !bg.unknown){ const c2 = blend(fc, bg); const L1 = lum(c2), L2 = lum(bg); cr = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05); }
    texts.push({t: t.slice(0,30), fs, fw: s.fontWeight, cr: cr && Math.round(cr*100)/100, bgk: bg.unknown? bg.kind : 'solid', y: Math.round(r.top)});
  }
  const ctrls = [];
  for(const el of document.querySelectorAll('button, a[href], [onclick], [role=button], input, select, label[for]')){
    if(!vis(el)) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    if(cx<0||cy<0||cx>=innerWidth||cy>=innerHeight) continue;
    const topEl = document.elementFromPoint(cx, cy); if(!topEl || !(topEl===el || el.contains(topEl))) continue;
    ctrls.push({t: (el.innerText || el.getAttribute('aria-label') || el.title || el.value || '').trim().replace(/\s+/g,' ').slice(0,24), w: Math.round(r.width), h: Math.round(r.height)});
  }
  const small = ctrls.filter(c => c.w < 44 || c.h < 44);
  const fsBins = {lt10:0, '10-11':0, '12-13':0, '14-15':0, '16+':0};
  for(const t of texts){ const f=t.fs; if(f<10) fsBins.lt10++; else if(f<12) fsBins['10-11']++; else if(f<14) fsBins['12-13']++; else if(f<16) fsBins['14-15']++; else fsBins['16+']++; }
  const known = texts.filter(t => t.cr != null);
  const lowCr = known.filter(t => t.cr < (t.fs >= 18.66 || (t.fs>=14 && +t.fw>=700) ? 3 : 4.5));
  return { label, nText: texts.length, fsBins, nKnownContrast: known.length, nLowContrast: lowCr.length, lowSamples: lowCr.slice(0,12), smallFont: texts.filter(t=>t.fs<12).slice(0,15).map(t=>t.t+'('+t.fs+')'), nCtrls: ctrls.length, nSmall: small.length, smallSamples: small.slice(0,15) };
};
