// 主题 2.0 样张页：把 theme2_base.css 的每个组件都摆出来，给逐像素对比度测试和截图用。
// sceneTheme = true 时，页面上的大标题放进遮罩（场景主题的规矩：字不直接压在画上）。
export function specimenHTML({ registry, icons, fonts, theme, base, mode, scene, sceneKind }) {
  const onScene = !!scene;
  const tiles = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink']
    .map((f, i) => `<div class="t2-tile t2-f-${f}" style="height:92px"><span class="t2-plate">${['听音辨义', '记忆翻牌', '打字大师', '完形填空', '探索单词', '打地鼠', '极速60秒', '挑战BOSS', '每日任务'][i]}</span></div>`).join('');
  const head = onScene
    ? `<h1 class="t2-display t2-fs-7 t2-scrim" id="h1">今天也来冒险吧！</h1><p class="t2-scrim" style="margin-top:6px"><span>6 个词等你复习</span> <b class="t2-hi t2-num">+12</b></p>`
    : `<h1 class="t2-display t2-fs-7" id="h1" style="color:var(--t2-ink-1)">今天也来冒险吧！</h1><p class="t2-ink-2">6 个词等你复习 <b class="t2-hi t2-num">+12</b></p>`;
  return `<!doctype html><html lang="zh-CN" data-t2-theme="${theme}" data-t2-base="${base}" data-t2-mode="${mode}"${scene ? ` data-t2-scene="${scene}"` : ''}>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/theme2_tokens.css"><link rel="stylesheet" href="/theme2_base.css">
<script src="/${icons}"></script><script src="/${fonts}"></script>
<style>body{margin:0}.wrap{padding:0 16px 96px}.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.card{padding:12px;margin:10px 0}</style></head>
<body class="t2-page">
<div class="t2-backdrop"></div>${sceneKind === 'canvas' ? '' : '<div class="t2-scene"></div>'}
<header class="t2-topbar"><b style="flex:1" class="t2-fs-2">小明 · Lv.<span class="t2-num">7</span></b>
  <span class="t2-chip"><i id="ic1"></i><span class="t2-num">1,280</span></span><span class="t2-chip"><i id="ic2"></i><span class="t2-num">36</span></span></header>
<div class="wrap">
  <div style="margin-top:14px">${head}</div>
  <div class="t2-card card">
    <div class="t2-word">fish</div><div class="t2-ink-2 t2-latin">/fɪʃ/</div><div class="t2-ink-2">中文：鱼</div>
    <div class="t2-ink-3 t2-fs-1">第 6 / 10 题 · 说明文字最小 12 号</div><div class="t2-hi t2-num t2-fs-6">+23 金币</div>
    <div class="t2-track" style="margin-top:8px"><i style="--p:.6"></i></div>
    <div class="t2-panel" style="padding:8px;margin-top:8px"><span>抬高的面板</span> <span class="t2-ink-2">次要</span> <span class="t2-ink-3">说明</span> <span class="t2-hi">关键词</span></div>
    <div class="row"><span class="t2-pill t2-pill-gold">金色标签</span><span class="t2-pill t2-pill-good">答对 7</span><span class="t2-pill t2-pill-bad">再练 2</span><span class="t2-badge">3</span></div>
  </div>
  <div class="row"><button class="t2-btn t2-btn-gold t2-btn-lg">再来一轮</button><button class="t2-btn t2-btn-brand">挑战</button><button class="t2-btn t2-btn-ghost">换难度</button></div>
  <div class="t2-good card"><b>答对啦！</b> apple = 苹果</div>
  <div class="t2-bad card"><b>正确答案</b> banana = 香蕉 · 这个词等会儿再考你一次</div>
  <div class="grid">${tiles}</div>
  <div class="t2-hero card"><b class="t2-display t2-fs-5">开始冒险</b><div>今天复习 6 个词</div></div>
</div>
<nav class="t2-nav"><a class="on">首页</a><a>单词</a><a>宝库</a><a>我的</a></nav>
<script>document.getElementById('ic1').outerHTML=HansenIcons.svg('coin',{size:20});document.getElementById('ic2').outerHTML=HansenIcons.svg('gem',{size:20});</script>
</body></html>`;
}

/* 在页面里收集所有文字段：位置、颜色、字号、粗细 */
export const COLLECT = () => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || /^(SCRIPT|STYLE)$/.test(el.tagName)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = [...r.getClientRects()].filter(q => q.width > 2 && q.height > 4 && q.bottom > 0 && q.top < innerHeight);
    if (!rects.length) continue;
    const cs = getComputedStyle(el);
    out.push({ text: n.nodeValue.trim().slice(0, 24), rects: rects.map(q => [Math.max(0, q.left), Math.max(0, q.top), Math.min(innerWidth, q.right), Math.min(innerHeight, q.bottom)]),
      color: cs.color, size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, cls: el.className || el.tagName });
  }
  return out;
};
export const HIDE_CSS = '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';

/* 在页面里：把“去掉文字”的截图画到 canvas，取每段文字底下像素的中位数和最暗/最亮，算对比度 */
export const MEASURE = async ({ png, els }) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + png; await im.decode();
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const res = [];
  for (const e of els) {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(e.color); if (!m) continue;
    const R = [], G = [], B = [], Ls = [];
    for (const [x0, y0, x1, y1] of e.rects) {
      const d = c.getImageData(Math.floor(x0), Math.floor(y0), Math.max(1, Math.ceil(x1 - x0)), Math.max(1, Math.ceil(y1 - y0))).data;
      for (let i = 0; i < d.length; i += 4) { R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]); Ls.push(L(d[i], d[i + 1], d[i + 2])); }
    }
    if (!R.length) continue;
    const med = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
    let fr = +m[1], fg = +m[2], fb = +m[3]; const fa = m[4] == null ? 1 : +m[4];
    const br = med(R), bg = med(G), bb = med(B);
    if (fa < 1) { fr = fr * fa + br * (1 - fa); fg = fg * fa + bg * (1 - fa); fb = fb * fa + bb * (1 - fa); }
    const lf = L(fr, fg, fb), ratio = cr(lf, L(br, bg, bb));
    const sl = Ls.slice().sort((p, q) => p - q), p05 = sl[Math.floor(sl.length * 0.05)], p95 = sl[Math.floor(sl.length * 0.95)];
    const worst = Math.min(cr(lf, p05), cr(lf, p95));
    const large = e.size >= 24 || (e.size >= 18.66 && e.weight >= 700);
    res.push({ text: e.text, cls: String(e.cls).slice(0, 40), size: e.size, large, ratio: Math.round(ratio * 100) / 100, worst: Math.round(worst * 100) / 100, need: large ? 3 : 4.5 });
  }
  return res;
};
