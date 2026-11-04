window.__textBoxes = function(){
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width>0 && r.height>0 && r.bottom>0 && r.top<innerHeight && r.right>0 && r.left<innerWidth && s.visibility!=='hidden' && s.display!=='none' && +s.opacity>0.05; };
  const out = []; const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while((n = walker.nextNode())){
    const t = n.textContent.trim(); if(!t || !/[A-Za-z0-9一-龥]/.test(t)) continue;
    const el = n.parentElement; if(!el || seen.has(el) || !vis(el)) continue;
    const range = document.createRange(); range.selectNodeContents(n); const rr = range.getBoundingClientRect();
    if(rr.width < 2 || rr.height < 2) continue;
    const cx = Math.min(innerWidth-1, Math.max(0, rr.left + Math.min(rr.width/2, 15))), cy = Math.min(innerHeight-1, Math.max(0, rr.top + rr.height/2));
    const top = document.elementFromPoint(cx, cy); if(!top || !(top === el || el.contains(top) || top.contains(el))) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    let col = s.color; const fill = s.webkitTextFillColor; if(fill && fill !== s.color) col = fill;
    out.push({ t: t.slice(0, 28), fs: parseFloat(s.fontSize), fw: +s.fontWeight || 400, col, ts: s.textShadow !== 'none', x: rr.left, y: rr.top, w: rr.width, h: rr.height });
  }
  return out;
};
