// hansen_diamond_shop.js — 主题商店(独立外挂)
// ============================================================
// 花钻石买顶级品。当前商品: IMAX 史诗主题(8款·影院级canvas动态大场面) + 典藏画廊(18款·手绘场景·各30钻)。【v743: 流光系列(aurora 6款)已整体删除】
// 依赖: HansenGems(花钻石)。零侵入独立文件, 各岛引用即有。
//
// 数据(全局, key=hansen_diamond_shop):
//   owned: {商品id:true}   — 已购买
//   equipped: 主题id 或 null — 当前装备的钻石主题
//
// 主题视觉: 装备后往 <body> 加 class 'hsn-dia-<id>' + 注入对应CSS背景层。
// ============================================================
(function(){
  if(window.__hansenDiamondShopLoaded){ return; } window.__hansenDiamondShopLoaded = true;

  var KEY = 'hansen_diamond_shop';

  // ===== 商品定义(6款钻石主题) =====
  var ITEMS = [
    /* 🗑️ v743(Hansen): 流光系列(series:aurora)6款主题已整体删除(深海/翡翠森林/樱粉梦境/熔岩/极光/黄金)——Hansen认为做得太差·要求连同所有代码痕迹删净。下方仅保留 IMAX 史诗系列(series:imax)8款 + 典藏画廊(series:gallery)18款。*/
    // 🎬 v543: IMAX 嘉年华系列(亮色重制·canvas 驱动) — 明亮高饱和+满屏可爱活物, 对齐游戏糖果系画风
    // 🔴 v557: Hansen 亲制典藏双主题(Hansen 提供全图手绘背景 themes/, 真图背景+canvas 粒子特效, IMAX 区置顶)
    {id:'theme_clouddream',   type:'theme', series:'imax', name:'云朵梦境工厂', emoji:'☁️', price:688, c1:'#8a87d8', c2:'#f3c8e0', desc:'全图手绘梦境云国，梦泡泡满天飘，小羊的 Zzz 冒上云端，梦境流星雨划过星空。'},
    {id:'theme_rainbowsweet', type:'theme', series:'imax', name:'彩虹甜心岛', emoji:'🍦', price:768, c1:'#63c4f5', c2:'#ffd9ec', desc:'全图手绘糖果海滩，心形糖与彩糖飘落，果冻气泡上浮，冰淇淋火山喷出彩虹糖果雨。'},
    {id:'theme_zombiedance', type:'theme', series:'imax', name:'僵尸舞王', emoji:'🧟', price:666, c1:'#1a1140', c2:'#0c2a26', desc:'月夜墓地，僵尸群舞，舞王登场！音符螺旋升空旋成炫光，鬼火幽幽飘，南瓜灯橙光摇曳。'},
    {id:'theme_fireworks', type:'theme', series:'imax', name:'焰火盛典', emoji:'🎆', price:380, c1:'#3d2a8f', c2:'#ff6b9d', desc:'烟花连放炸满夜空，孔明灯升起，屋顶彩灯闪烁。'},
    {id:'theme_candyland', type:'theme', series:'imax', name:'糖果乐园', emoji:'🍭', price:450, c1:'#7ec8ff', c2:'#ffb3d1', desc:'大彩虹高挂，糖果带着笑脸飘落，棉花糖云慢慢飘。'},
    {id:'theme_balloon',   type:'theme', series:'imax', name:'云端气球', emoji:'🎈', price:520, c1:'#41b8f5', c2:'#ffe680', desc:'热气球飘过晴空，小飞机拉着字母横幅，鸟群掠过。'},
    {id:'theme_lagoon',    type:'theme', series:'imax', name:'七彩珊瑚湾', emoji:'🐠', price:600, c1:'#27b6dd', c2:'#ffd54f', desc:'阳光洒进浅海，彩色鱼群环游，微笑鲸鱼喷着泡泡路过。'},
    /* 🗑️ v744(Hansen): 一款 IMAX 主题(原700💎)已整体删除·所有痕迹清净 */
    {id:'theme_spacepark', type:'theme', series:'imax', name:'星际乐园', emoji:'🚀', price:888, c1:'#311b92', c2:'#4dd0e1', desc:'卡通星球挂着笑脸，火箭喷火穿梭，UFO 眨灯巡游。压轴。'},
    {id:'theme_photo_cloudhug', type:'theme', series:'gallery', name:'云端拥抱中转站', emoji:'☁️', price:30, c1:'#131321', c2:'#664D56', img:'themes/thumb_cloudhug.jpg', desc:'云端温柔场景，光点缓缓浮动，星屑轻闪。'},
    {id:'theme_photo_horsespa', type:'theme', series:'gallery', name:'千骏SPA', emoji:'🐴', price:30, c1:'#222F41', c2:'#161315', img:'themes/thumb_horsespa.jpg', desc:'温泉骏马场景，暖金光尘漂浮，星光微闪。'},
    {id:'theme_photo_beastworld', type:'theme', series:'gallery', name:'幻兽世界', emoji:'🦄', price:30, c1:'#1F2442', c2:'#141D2E', img:'themes/thumb_beastworld.jpg', desc:'奇幻幻兽场景，冷色光点流动，繁星点点。'},
    {id:'theme_photo_balloonbay', type:'theme', series:'gallery', name:'彩虹热气球港湾', emoji:'🎈', price:30, c1:'#596089', c2:'#B99394', img:'themes/thumb_balloonbay.jpg', desc:'彩虹热气球港湾，粉色光点上浮，柔光闪烁。'},
    {id:'theme_photo_starcollect', type:'theme', series:'gallery', name:'星光收集工坊', emoji:'✨', price:30, c1:'#262235', c2:'#513736', img:'themes/thumb_starcollect.jpg', desc:'星光收集工坊，星屑漂浮，四角星轻轻闪烁。'},
    {id:'theme_photo_flyingisle', type:'theme', series:'gallery', name:'星光飞行岛', emoji:'🛸', price:30, c1:'#121C3D', c2:'#644E6B', img:'themes/thumb_flyingisle.jpg', desc:'星光飞行岛，冷蓝光点游动，星空微闪。'},
    {id:'theme_photo_storybook', type:'theme', series:'gallery', name:'星夜故事书屋', emoji:'📖', price:30, c1:'#434960', c2:'#2D263A', img:'themes/thumb_storybook.jpg', desc:'星夜故事书屋，柔光尘埃浮动，夜空星闪。'},
    {id:'theme_photo_stardustfarm', type:'theme', series:'gallery', name:'星尘培育元', emoji:'🌱', price:30, c1:'#9C6F3F', c2:'#644B47', img:'themes/thumb_stardustfarm.jpg', desc:'星尘培育场景，暖金光尘升起，星光点缀。'},
    {id:'theme_photo_memoryrepair', type:'theme', series:'gallery', name:'星尘记忆修复馆', emoji:'🔮', price:30, c1:'#080B18', c2:'#2E2014', img:'themes/thumb_memoryrepair.jpg', desc:'星尘记忆修复馆，紫调光点流动，星屑闪烁。'},
    {id:'theme_photo_jamhouse', type:'theme', series:'gallery', name:'星露果酱暖房', emoji:'🍓', price:30, c1:'#9E8E8A', c2:'#846351', img:'themes/thumb_jamhouse.jpg', desc:'星露果酱暖房，暖色光点浮动，柔星微闪。'},
    {id:'theme_photo_dessertshop', type:'theme', series:'gallery', name:'星露点心坊', emoji:'🍰', price:30, c1:'#292645', c2:'#5B4E43', img:'themes/thumb_dessertshop.jpg', desc:'星露点心坊，甜暖光尘漂浮，星光轻闪。'},
    {id:'theme_photo_fairytown', type:'theme', series:'gallery', name:'星露童话镇', emoji:'🏰', price:30, c1:'#060C22', c2:'#674140', img:'themes/thumb_fairytown.jpg', desc:'星露童话镇，暖金光点升起，繁星闪烁。'},
    {id:'theme_photo_goodnight', type:'theme', series:'gallery', name:'晚安旋律', emoji:'🌙', price:30, c1:'#0E0E29', c2:'#2A2742', img:'themes/thumb_goodnight.jpg', desc:'晚安旋律场景，柔蓝光尘浮动，夜星轻眨。'},
    {id:'theme_photo_dreamcleanse', type:'theme', series:'gallery', name:'梦境净化', emoji:'💧', price:30, c1:'#373E4B', c2:'#62585A', img:'themes/thumb_dreamcleanse.jpg', desc:'梦境净化场景，清透光点流动，星屑微光。'},
    {id:'theme_photo_carworkshop', type:'theme', series:'gallery', name:'汽车工坊', emoji:'🚗', price:30, c1:'#403A4A', c2:'#82685F', img:'themes/thumb_carworkshop.jpg', desc:'汽车工坊场景，暖光尘埃浮动，星光点缀。'},
    {id:'theme_photo_honeyshop', type:'theme', series:'gallery', name:'蜂蜜加工小作坊', emoji:'🍯', price:30, c1:'#764114', c2:'#6B451F', img:'themes/thumb_honeyshop.jpg', desc:'蜂蜜加工小作坊，金色光尘漂浮，暖星轻闪。'},
    {id:'theme_photo_sunweave', type:'theme', series:'gallery', name:'阳光编织工坊', emoji:'🧶', price:30, c1:'#807682', c2:'#5B4F4D', img:'themes/thumb_sunweave.jpg', desc:'阳光编织工坊，暖金光点浮动，柔星闪烁。'},
    {id:'theme_photo_magicschool', type:'theme', series:'gallery', name:'魔法学校', emoji:'🪄', price:30, c1:'#05102B', c2:'#20223A', img:'themes/thumb_magicschool.jpg', desc:'魔法学校场景，冷紫光点游动，繁星微闪。'}
    // 以后可加: 头像框 / 稀有宠物...
  ];

  // 每款主题的两层光带渐变(用于注入CSS); 都只平移不旋转
  var THEME_GRAD = {
    /* 🎬 v543 IMAX 嘉年华系列基础层(canvas 不透明接管, 此处仅作降级兜底) */
    theme_clouddream: {bg:'#9d96dd',
      a:'radial-gradient(ellipse 55% 55% at 32% 32%,rgba(255,200,230,.5),transparent 70%),radial-gradient(ellipse 50% 50% at 70% 50%,rgba(180,170,240,.5),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 85%,rgba(255,225,190,.45),transparent 72%)'},
    theme_rainbowsweet: {bg:'#7fcdf5',
      a:'radial-gradient(ellipse 55% 55% at 30% 32%,rgba(255,200,230,.55),transparent 70%),radial-gradient(ellipse 50% 50% at 72% 52%,rgba(255,235,170,.55),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 86%,rgba(190,240,255,.5),transparent 72%)'},
    theme_zombiedance: {bg:'#140e33',
      a:'radial-gradient(ellipse 55% 55% at 32% 30%,rgba(120,90,220,.42),transparent 70%),radial-gradient(ellipse 50% 50% at 70% 55%,rgba(80,230,170,.32),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 86%,rgba(255,150,60,.3),transparent 72%)'},
    theme_fireworks: {bg:'#3d2a8f',
      a:'radial-gradient(ellipse 55% 55% at 30% 30%,rgba(255,107,157,.4),transparent 70%),radial-gradient(ellipse 50% 50% at 72% 50%,rgba(120,80,220,.4),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 80%,rgba(255,180,80,.3),transparent 72%)'},
    theme_candyland: {bg:'#9fd6ff',
      a:'radial-gradient(ellipse 55% 55% at 30% 35%,rgba(255,179,209,.55),transparent 70%),radial-gradient(ellipse 50% 50% at 72% 55%,rgba(255,243,196,.55),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 85%,rgba(174,234,255,.45),transparent 72%)'},
    theme_balloon: {bg:'#5cc3f7',
      a:'radial-gradient(ellipse 55% 55% at 32% 30%,rgba(255,230,128,.45),transparent 70%),radial-gradient(ellipse 50% 50% at 70% 55%,rgba(255,255,255,.5),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 85%,rgba(190,240,255,.45),transparent 72%)'},
    theme_lagoon: {bg:'#1ba3d4',
      a:'radial-gradient(ellipse 55% 55% at 32% 28%,rgba(95,221,229,.5),transparent 70%),radial-gradient(ellipse 50% 50% at 70% 60%,rgba(255,213,79,.32),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 90%,rgba(10,94,160,.5),transparent 72%)'},
    theme_spacepark: {bg:'#2a2a9e',
      a:'radial-gradient(ellipse 55% 55% at 30% 30%,rgba(77,208,225,.4),transparent 70%),radial-gradient(ellipse 50% 50% at 72% 50%,rgba(120,90,230,.45),transparent 70%)',
      b:'radial-gradient(ellipse 50% 55% at 50% 85%,rgba(60,130,220,.4),transparent 72%)'},
    theme_photo_cloudhug: {bg:'#131321', a:'radial-gradient(ellipse at 35% 30%, #131321, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #664D56, transparent 60%)'},
    theme_photo_horsespa: {bg:'#222F41', a:'radial-gradient(ellipse at 35% 30%, #222F41, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #161315, transparent 60%)'},
    theme_photo_beastworld: {bg:'#1F2442', a:'radial-gradient(ellipse at 35% 30%, #1F2442, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #141D2E, transparent 60%)'},
    theme_photo_balloonbay: {bg:'#596089', a:'radial-gradient(ellipse at 35% 30%, #596089, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #B99394, transparent 60%)'},
    theme_photo_starcollect: {bg:'#262235', a:'radial-gradient(ellipse at 35% 30%, #262235, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #513736, transparent 60%)'},
    theme_photo_flyingisle: {bg:'#121C3D', a:'radial-gradient(ellipse at 35% 30%, #121C3D, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #644E6B, transparent 60%)'},
    theme_photo_storybook: {bg:'#434960', a:'radial-gradient(ellipse at 35% 30%, #434960, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #2D263A, transparent 60%)'},
    theme_photo_stardustfarm: {bg:'#9C6F3F', a:'radial-gradient(ellipse at 35% 30%, #9C6F3F, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #644B47, transparent 60%)'},
    theme_photo_memoryrepair: {bg:'#080B18', a:'radial-gradient(ellipse at 35% 30%, #080B18, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #2E2014, transparent 60%)'},
    theme_photo_jamhouse: {bg:'#9E8E8A', a:'radial-gradient(ellipse at 35% 30%, #9E8E8A, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #846351, transparent 60%)'},
    theme_photo_dessertshop: {bg:'#292645', a:'radial-gradient(ellipse at 35% 30%, #292645, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #5B4E43, transparent 60%)'},
    theme_photo_fairytown: {bg:'#060C22', a:'radial-gradient(ellipse at 35% 30%, #060C22, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #674140, transparent 60%)'},
    theme_photo_goodnight: {bg:'#0E0E29', a:'radial-gradient(ellipse at 35% 30%, #0E0E29, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #2A2742, transparent 60%)'},
    theme_photo_dreamcleanse: {bg:'#373E4B', a:'radial-gradient(ellipse at 35% 30%, #373E4B, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #62585A, transparent 60%)'},
    theme_photo_carworkshop: {bg:'#403A4A', a:'radial-gradient(ellipse at 35% 30%, #403A4A, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #82685F, transparent 60%)'},
    theme_photo_honeyshop: {bg:'#764114', a:'radial-gradient(ellipse at 35% 30%, #764114, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #6B451F, transparent 60%)'},
    theme_photo_sunweave: {bg:'#807682', a:'radial-gradient(ellipse at 35% 30%, #807682, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #5B4F4D, transparent 60%)'},
    theme_photo_magicschool: {bg:'#05102B', a:'radial-gradient(ellipse at 35% 30%, #05102B, transparent 60%)', b:'radial-gradient(ellipse at 65% 75%, #20223A, transparent 60%)'}
  };

  function _read(){
    try{
      var raw=localStorage.getItem(KEY);
      if(!raw) return {owned:{}, equipped:null};
      var o=JSON.parse(raw);
      return {owned:(o.owned&&typeof o.owned==='object')?o.owned:{}, equipped:o.equipped||null};
    }catch(e){ return {owned:{}, equipped:null}; }
  }
  function _write(o){ try{ localStorage.setItem(KEY, JSON.stringify(o)); }catch(e){} }

  window.HansenDiamondShop = {
    /* 🔴 v542: 主题唯一真源——首页换主题面板从这里读, 杜绝第二份硬编码清单(v540 教训: index.html 内嵌 DIA_THEMES 漏掉 IMAX 六款) */
    listThemes: function(){ return ITEMS.filter(function(x){return x.type==='theme';}).map(function(x){ return {id:x.id,name:x.name,emoji:x.emoji,desc:x.desc,price:x.price,series:x.series||'aurora',c1:x.c1||'#0a0a1c',c2:x.c2||'#475569'}; }); },
    isOwned: function(id){ return !!_read().owned[id]; },
    getEquipped: function(){ return _read().equipped; },
    open: openShop,
    // 应用当前已装备的主题(开机时调)
    applyEquipped: function(){ var o=_read(); var x=o.equipped; if(x && !o.owned[x]) return; applyTheme(x); },
    // 🔴 v716: 接收来自子页(岛 iframe)的主题同步——在本页(顶层主页/中间层)应用同一主题; applyTheme 内部会继续沿 parent 链往上传(到顶层 parent===window 自然停, 无回环)。试用/装备/卸下/试用结束统一走它。
    applyThemeId: function(id){ applyTheme(id); },
    // 🔴 v718: 切到基础主题(金币购买)时·静默清掉钻石主题装备(不弹 toast/不重渲, 由调用方统一重渲)——互斥用
    clearEquipped: function(){ var o=_read(); if(o.equipped){ o.equipped=null; _write(o); applyTheme(null); } }
  };

  // ===== 主题视觉: 注入CSS + 给body加class =====
  function injectThemeCSS(){
    if(document.getElementById('hsnDiaThemeCSS')) return;
    var css=''+
    // 通用: 装备任意钻石主题时的流光层(颜色由JS动态设置 background, 这里只管定位+模糊+动画)
    '[class*="hsn-dia-theme_"]{position:relative;}'+
    '.hsn-dia-aurora-layer{position:fixed;inset:-30%;z-index:-2;pointer-events:none;filter:blur(48px);}'+
    '.hsn-dia-aurora-layer.a{animation:hsnDiaDriftA 18s ease-in-out infinite alternate;}'+
    '.hsn-dia-aurora-layer.b{animation:hsnDiaDriftB 22s ease-in-out infinite alternate;}'+
    '.hsn-dia-stars{position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(1.5px 1.5px at 20% 30%,rgba(255,255,255,.6),transparent),radial-gradient(1px 1px at 60% 20%,rgba(255,255,255,.45),transparent),radial-gradient(1.5px 1.5px at 80% 60%,rgba(255,255,255,.5),transparent),radial-gradient(1px 1px at 40% 70%,rgba(255,255,255,.4),transparent),radial-gradient(1px 1px at 90% 45%,rgba(255,255,255,.45),transparent);}'+
    // 只平移, 绝不旋转/缩放
    '@keyframes hsnDiaDriftA{0%{transform:translateX(-8%)}100%{transform:translateX(8%)}}'+
    '@keyframes hsnDiaDriftB{0%{transform:translateX(6%)}100%{transform:translateX(-6%)}}'+
    // ===== 熔岩主题 精致场景: 三层岩浆辉光 + 密集上升火星(纯上升淡出, 无旋转, 不晕) =====
    '.hsn-dia-scene{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;}'+
    // 🔥 hsn-ember: 与 Boss 战斗动画(hansen_boss_anim.js·.boss-sprite-wrap .hsn-ember)共享的火星类名·保留以零影响Boss动画(流光主题已删·此处对主题已惰性)
    '.hsn-ember{position:absolute;bottom:-12px;border-radius:50%;background:#fbbf24;opacity:0;animation:hsnEmberRise linear infinite;}'+
    '.hsn-ember.big{background:#fed7aa;box-shadow:0 0 10px 3px rgba(251,146,60,.95),0 0 18px 6px rgba(249,115,22,.5);}'+
    '.hsn-ember.sm{box-shadow:0 0 6px 2px rgba(251,146,60,.85);}'+
    '@keyframes hsnEmberRise{0%{transform:translateY(0);opacity:0}8%{opacity:1}78%{opacity:.85}100%{transform:translateY(-94vh);opacity:0}}';
    var st=document.createElement('style'); st.id='hsnDiaThemeCSS'; st.textContent=css; document.head.appendChild(st);
  }

  function applyTheme(themeId){
    try{
      injectThemeCSS();
      var body=document.body; if(!body) return;
      // 先清掉旧的钻石主题class(用className字符串操作, 最兼容)
      body.className = (body.className||'').split(/\s+/).filter(function(c){ return c && c.indexOf('hsn-dia-theme')!==0; }).join(' ');
      try{ if(window.HansenCinema)window.HansenCinema.stop(); }catch(e0){}   /* 🎬 v540: 先停影院引擎 */
      // 先清掉旧的流光层 + 场景层
      var oldLayers=document.querySelectorAll('.hsn-dia-aurora-layer,.hsn-dia-stars,.hsn-dia-scene');
      for(var i=0;i<oldLayers.length;i++){ oldLayers[i].parentNode && oldLayers[i].parentNode.removeChild(oldLayers[i]); }
      if(!themeId){ body.style.backgroundColor=''; body.style.removeProperty('--hsn-dia-bg'); body.classList.remove('hsn-dia-on'); return; }  // 没装备 = 默认背景·摘掉钻石标记+基色变量→恢复免费主题背景渐变+飞行元素
      var g = THEME_GRAD[themeId]; if(!g) return;
      // 套用 (themeId 已含 theme_ 前缀, class 直接用 hsn-dia-<themeId>)
      body.className = (body.className + ' hsn-dia-' + themeId).trim();
      body.classList.add('hsn-dia-on');   // 🔴 v731(Hansen): 钻石主题(装备/试用)生效标记→CSS 据此隐藏所有免费主题飞行元素(防正在用的免费主题如海洋蓝的帆船/海豚/鲸/章鱼残留漂在钻石主题背景上·看不清钻石主题真面目)
      var stars=document.createElement('div'); stars.className='hsn-dia-stars'; body.appendChild(stars);
      var a=document.createElement('div'); a.className='hsn-dia-aurora-layer a'; a.style.background=g.a; body.appendChild(a);
      var bb=document.createElement('div'); bb.className='hsn-dia-aurora-layer b'; bb.style.background=g.b; body.appendChild(bb);
      body.style.backgroundColor=g.bg;
      body.style.setProperty('--hsn-dia-bg', g.bg);   // 🔴 v732(Hansen): 把钻石主题基色喂给 CSS·body.hsn-dia-on{background:var(--hsn-dia-bg)!important} 据此中和免费主题背景渐变(否则浅色免费主题渐变从半透明极光层底下透出·背景串台)
      try{ if(window.HansenCinema)window.HansenCinema.apply(themeId); }catch(e1){}   /* 🎬 v540: IMAX/画廊主题由影院引擎接管大场面(非影院 id 内部自动忽略)。🗑️v743: 原 buildScene(流光6主题专属场景)已随流光主题删除 */
    }catch(e){ try{console.warn('[DiaTheme]',e);}catch(_){} }
    // 🔴 v716(Hansen): 主题在岛(iframe)里切换/试用后, 顶层主页(index.html 世界地图)也要同步生效。
    //   SPA 架构下岛跑在 index.html 的 iframe 里, applyTheme 只应用到了 iframe 自己的 body; 之前主页与岛主题割裂(尤其
    //   试用用 sessionStorage 跨 iframe 本就不通, 装备虽走 localStorage 但已加载的主页不会实时重读)。
    //   解决: 把同一主题沿 window.parent 链一路同步到顶层(到顶层 parent===window 自然停止·无回环)。覆盖 装备/试用/试用结束/卸下 全部路径(都走 applyTheme)。
    try{
      var P = window.parent;
      if(P && P !== window && P.HansenDiamondShop && typeof P.HansenDiamondShop.applyThemeId === 'function'){
        P.HansenDiamondShop.applyThemeId(themeId);
      }
    }catch(eP){}
  }

  // 🗑️ v743(Hansen): buildScene(流光6主题 lava/aurora/ocean/gold/sakura/forest 的专属场景构建)已随流光系列整体删除·IMAX与典藏画廊走影院引擎(HansenCinema.apply)无需此函数。

  // ===== 商店界面 =====
  function openShop(){
    ensureShopScreen();
    renderShop();
    if(typeof window.showScreen==='function'){ window.showScreen('diamondshop'); }
    else{ var s=document.getElementById('diamondshopScreen'); if(s) s.classList.add('active'); }
  }

  function ensureShopScreen(){
    if(document.getElementById('diamondshopScreen')) return;
    injectShopCSS();
    var screen=document.createElement('div');
    screen.className='screen'; screen.id='diamondshopScreen';
    screen.innerHTML='<button class="back-btn" onclick="showScreen(\'home\')">← 返回</button>'+
      '<div class="screen-title"><span style="-webkit-text-fill-color:initial;-webkit-background-clip:border-box;background:none;text-shadow:none">💎</span> 主题商店</div><div id="diaShopBody"></div>';
    (document.getElementById('app')||document.body).appendChild(screen);   // ★放进 #app(像 home/boss 等正常页面一样紧贴顶栏), 不再挂 body 之外导致顶部大空隙
  }

  function renderShop(){
    var body=document.getElementById('diaShopBody'); if(!body) return;
    var gems = window.HansenGems ? HansenGems.get() : 0;
    var data=_read();
    var h='';
    h+='<div class="dia-bal">💎 我的钻石：<b>'+gems+'</b></div>';
    h+='<div class="dia-tip">钻石极其珍贵（连续签到、通关整个岛才有）。这里只卖顶级专属品。</div>';
    /* 🎬 v540: 两个系列分开陈列, IMAX 史诗系列置顶(镇店之宝) */
    h+='<div class="dia-cat">🎬 IMAX 史诗主题 · 影院级动态大场面</div>';
    h+='<div class="dia-imax-tip">每款都有一个周期上演的「招牌大场面」：梦境流星雨 / 火山糖果喷发 / 闪电劈落 / 流星雨 / 花吹雪 / 鱼群巡游 / 数据光波 / 金环冲击。建议先点「试用」亲眼看 60 秒。</div>';
    h+=renderSeries('imax', data);
    /* 🖼️ v735(Hansen): 典藏画廊 — 18款手绘场景主题, 每款仅30钻, 人人买得起 */
    h+='<div class="dia-cat" style="margin-top:22px">🖼️ 典藏画廊 · 手绘场景主题</div>';
    h+='<div class="dia-imax-tip">18 款全图手绘场景，配星光浮动氛围特效。每款只要 30💎，挑你最喜欢的，先点「试用」看 60 秒。</div>';
    h+=renderSeries('gallery', data);
    if(data.equipped){
      h+='<div style="text-align:center;margin-top:14px"><button class="dia-unequip" onclick="window.__hsnDiaUnequip()">恢复默认背景</button></div>';
    }
    h+=renderBasicThemes(data);   /* 🔴 v718: 最初 6 款基础主题·金币购买(从首页搬进商店·统一来源) */
    h+='<div class="dia-cat" style="margin-top:24px">🔜 即将上线</div>'+
       '<div class="dia-soon">👑 顶级头像框 · 🐾 稀有宠物 · 更多主题……敬请期待</div>';
    body.innerHTML=h;
  }
  /* 🎬 v540: 按系列渲染商品列表(imax 卡片带系列徽标+招牌台词) */
  function renderSeries(series, data){
    var h='';
    ITEMS.forEach(function(it){
      if(it.type!=='theme' || (it.series||'aurora')!==series) return;
      var owned=!!data.owned[it.id];
      var equipped=data.equipped===it.id;
      var btn;
      if(equipped){ btn='<button class="dia-btn equipped" disabled>使用中 ✓</button>'; }
      else if(owned){ btn='<button class="dia-btn use" onclick="window.__hsnDiaEquip(\''+it.id+'\')">使用</button>'; }
      else{ btn='<button class="dia-btn try" onclick="window.__hsnDiaTry(\''+it.id+'\')">试用</button>'+
                '<button class="dia-btn buy" onclick="window.__hsnDiaBuy(\''+it.id+'\')">💎 '+it.price+'</button>'; }
      var imax=(series==='imax');
      h+='<div class="dia-item'+(imax?' dia-item-imax':'')+'">'+
           '<div class="dia-preview dia-prev-'+it.id+'"'+(it.img?(' style="background-image:url(\''+it.img+'?v=904\');background-size:cover;background-position:center"'):'')+'>'+(imax?'<span class="dia-imax-badge">IMAX</span>':'')+(it.img?'':('<span class="dia-prev-emoji">'+it.emoji+'</span>'))+'</div>'+
           '<div class="dia-info"><div class="dia-name">'+it.name+(owned?' <span class="owned-tag">已拥有</span>':'')+'</div>'+
           '<div class="dia-desc">'+it.desc+'</div></div>'+
           '<div class="dia-action">'+btn+'</div>'+
         '</div>';
    });
    return h;
  }

  /* 🔴 v718(Hansen): 最初 6 款基础主题(金币购买)从首页「更换主题」搬进主题商店——主题统一在这一个地方获取。
     ★自包含: 岛与首页都加载本模块(hansen_theme_shop.js 只在首页·不能依赖它)。解锁状态共享 localStorage 'hansen_unlocked_themes'
     (与岛设置主题锁 hansen_theme_lock.js 同源·买了到处通); 金币优先全局钱包 HansenCoins(岛)/HansenWallet(首页)·都没有就直读 key 兜底。
     价格须与 hansen_theme_shop.js / hansen_theme_lock.js 一致(ocean300/forest1000/rainbow2000/peach3000)。 */
  var BASIC_FREE = ['cosmos','pink'];
  var BASIC_THEMES = [
    {key:'cosmos',  name:'星空夜',   emoji:'🌌', desc:'蓝紫深空', price:0,    c1:'#0c1538', c2:'#1e3a8a'},
    {key:'pink',    name:'樱花粉',   emoji:'🌸', desc:'梦幻浪漫', price:0,    c1:'#2d1b2e', c2:'#be185d'},
    {key:'ocean',   name:'海洋蓝',   emoji:'🌊', desc:'深海冒险', price:300,  c1:'#0c2540', c2:'#0e7490'},
    {key:'forest',  name:'森林绿',   emoji:'🌳', desc:'清新自然', price:1000, c1:'#14271a', c2:'#15803d'},
    {key:'rainbow', name:'彩虹云朵', emoji:'🌈', desc:'童话奇幻', price:2000, c1:'#1e1b4b', c2:'#9d174d'},
    {key:'peach',   name:'桃子糖果', emoji:'🍑', desc:'甜美可爱', price:3000, c1:'#451a03', c2:'#c2410c'}
  ];
  var BASIC_UNLOCK_KEY = 'hansen_unlocked_themes';
  function _basicMeta(key){ for(var i=0;i<BASIC_THEMES.length;i++){ if(BASIC_THEMES[i].key===key) return BASIC_THEMES[i]; } return null; }
  function _basicUnlocked(key){
    if(BASIC_FREE.indexOf(key)>=0) return true;
    try{ var raw=localStorage.getItem(BASIC_UNLOCK_KEY); if(raw){ var a=JSON.parse(raw); if(Array.isArray(a)&&a.indexOf(key)>=0) return true; } }catch(e){}
    return false;
  }
  function _basicDoUnlock(key){
    try{ var a=[]; var raw=localStorage.getItem(BASIC_UNLOCK_KEY); if(raw){ var p=JSON.parse(raw); if(Array.isArray(p)) a=p; } if(a.indexOf(key)<0){ a.push(key); localStorage.setItem(BASIC_UNLOCK_KEY, JSON.stringify(a)); } }catch(e){}
  }
  function _coinsGet(){ try{ if(window.HansenCoins&&window.HansenCoins.get) return window.HansenCoins.get(); if(window.HansenWallet&&window.HansenWallet.get) return window.HansenWallet.get(); var v=parseInt(localStorage.getItem('hansen_wallet_coins'),10); return (isFinite(v)&&v>0)?v:0; }catch(e){ return 0; } }
  function _coinsSpend(n){ try{ if(window.HansenCoins&&window.HansenCoins.spend) return window.HansenCoins.spend(n); if(window.HansenWallet&&window.HansenWallet.spend) return window.HansenWallet.spend(n); var c=_coinsGet(); if(c<n) return false; localStorage.setItem('hansen_wallet_coins', String(c-n)); return true; }catch(e){ return false; } }
  function _curBasicKey(){ try{ return localStorage.getItem('theme')||'cosmos'; }catch(e){ return 'cosmos'; } }
  // 应用基础主题(仅已解锁): 静默清掉钻石主题装备(互斥) + 写 data-theme/localStorage(各页"6主题系统"维持渲染·钻石卸下回归默认)
  function applyBasicTheme(key){
    if(!_basicUnlocked(key)) return false;
    var o=_read(); if(o.equipped){ o.equipped=null; _write(o); applyTheme(null); }   // 静默清钻石装备(不弹toast)
    try{ document.body.dataset.theme = key; localStorage.setItem('theme', key); }catch(e){}
    return true;
  }

  function renderBasicThemes(data){
    var coins=_coinsGet();
    var diaEquipped=data.equipped;
    var curBasic=_curBasicKey();
    var h='<div class="dia-cat" style="margin-top:22px">🎨 基础主题 · 金币购买</div>';
    h+='<div class="dia-imax-tip">最初的 6 款主题（🌌 星空夜 / 🌸 樱花粉 免费，其余金币解锁）。当前金币：💰 '+coins+'</div>';
    BASIC_THEMES.forEach(function(t){
      var unlocked=_basicUnlocked(t.key);
      var free=(BASIC_FREE.indexOf(t.key)>=0);
      var active=(!diaEquipped && curBasic===t.key);   // 没装备钻石主题 + 正用这个基础主题 = 使用中
      var btn;
      if(active){ btn='<button class="dia-btn equipped" disabled>使用中 ✓</button>'; }
      else if(unlocked){ btn='<button class="dia-btn use" onclick="window.__hsnUseBasic(\''+t.key+'\')">使用</button>'; }
      else{ btn='<button class="dia-btn buy" onclick="window.__hsnBuyBasic(\''+t.key+'\')">💰 '+t.price+'</button>'; }
      h+='<div class="dia-item">'+
           '<div class="dia-preview" style="background:linear-gradient(135deg,'+t.c1+','+t.c2+')"><span class="dia-prev-emoji">'+t.emoji+'</span></div>'+
           '<div class="dia-info"><div class="dia-name">'+t.name+(free?' <span class="owned-tag">免费</span>':(unlocked?' <span class="owned-tag">已拥有</span>':''))+'</div>'+
           '<div class="dia-desc">'+(unlocked?(active?'正在使用':t.desc):('💰 '+t.price+' 金币解锁 · '+t.desc))+'</div></div>'+
           '<div class="dia-action">'+btn+'</div>'+
         '</div>';
    });
    return h;
  }
  // 使用(已解锁的基础主题)
  window.__hsnUseBasic = function(key){
    try{ if(applyBasicTheme(key)){ renderShop(); var m=_basicMeta(key); shopToast('已切换到「'+(m?m.name:'主题')+'」主题'); } }catch(e){}
  };
  // 金币购买基础主题(扣币 → 永久解锁 → 立即使用)
  window.__hsnBuyBasic = function(key){
    try{
      if(_basicUnlocked(key)){ window.__hsnUseBasic(key); return; }
      var m=_basicMeta(key); var price=m?m.price:0;
      var have=_coinsGet();
      if(have < price){ renderShop(); shopToast('金币不足，还差 '+(price-have)+' 💰（连续签到、通关整个岛可赚金币）'); return; }
      if(_coinsSpend(price)){ _basicDoUnlock(key); applyBasicTheme(key); renderShop(); shopToast('🎉 已解锁并使用「'+(m?m.name:'主题')+'」'); }
      else{ shopToast('购买失败，请重试'); }
    }catch(e){}
  };

  // 买
  window.__hsnDiaBuy = function(id){
    var it=ITEMS.find(function(x){return x.id===id;}); if(!it) return;
    var GM=window.HansenGems; if(!GM){ alert('钻石系统未就绪'); return; }
    if(GM.get() < it.price){ shopToast('钻石不够啦！连续签到、通关整个岛可以获得钻石 💎'); return; }
    // 确认
    if(!confirm('用 '+it.price+' 颗钻石购买「'+it.name+'」主题？')) return;
    GM.spend ? GM.spend(it.price) : GM.add(-it.price);
    var o=_read(); o.owned[id]=true; _write(o);
    shopToast('🎉 购买成功！已解锁「'+it.name+'」主题');
    // 买了直接装备
    equip(id);
    renderShop();
  };
  // 装备
  window.__hsnDiaEquip = function(id){ if(id && !_read().owned[id]){ shopToast('这个主题还没解锁，先购买吧 💎'); renderShop(); return; } equip(id); renderShop(); shopToast('已切换到「'+(ITEMS.find(function(x){return x.id===id;})||{}).name+'」主题'); };
  function equip(id){ var o=_read(); if(id && !o.owned[id]) return; o.equipped=id; _write(o); applyTheme(id); }  /* v454: 未购买不能装备(堵后台白嫖钻石主题) */
  // 卸下
  window.__hsnDiaUnequip = function(){ var o=_read(); o.equipped=null; _write(o); applyTheme(null); renderShop(); shopToast('已恢复默认背景'); };

  // ===== 1分钟试用(🔴 v541: sessionStorage 跨页持久——Hansen 实测: 商店页试用后回主页主题消失, 主题最重要的展示舞台恰恰是主页) =====
  var _trialTimer = null;
  var _trialBar = null;
  var TRIAL_SS = 'hansen_dia_trial';
  function startTrialFor(it, leftSec){
    endTrial(true);
    applyTheme(it.id);
    showTrialBar(it);
    var left=Math.max(1, Math.round(leftSec));
    if(_trialBar){ var c0=_trialBar.querySelector('.trial-count'); if(c0) c0.textContent=left; }
    _trialTimer = setInterval(function(){
      left--;
      if(_trialBar){ var c=_trialBar.querySelector('.trial-count'); if(c) c.textContent=left; }
      if(left<=0){ endTrial(false); shopToast('试用结束，已恢复原背景'); }
    }, 1000);
  }
  window.__hsnDiaTry = function(id){
    var it=ITEMS.find(function(x){return x.id===id;}); if(!it) return;
    startTrialFor(it, 60);   /* 🔴 先 startTrialFor(其内部 endTrial 会清旧 sessionStorage), 再写新试用——反过来会被自己清掉(开发期抓获) */
    try{ sessionStorage.setItem(TRIAL_SS, JSON.stringify({id:id, until:Date.now()+60000})); }catch(e){}
  };
  function showTrialBar(it){
    if(_trialBar) _trialBar.remove();
    _trialBar=document.createElement('div');
    _trialBar.className='dia-trial-bar';
    _trialBar.innerHTML='<span>👀 正在试用「'+it.name+'」· <b class="trial-count">60</b> 秒后恢复</span>'+
      '<button onclick="window.__hsnDiaBuyFromTrial(\''+it.id+'\')">💎 '+it.price+' 买下</button>'+
      '<button class="trial-stop" onclick="window.__hsnDiaStopTrial()">结束</button>';
    document.body.appendChild(_trialBar);
    requestAnimationFrame(function(){ _trialBar.classList.add('show'); });
  }
  function endTrial(silent){
    try{ sessionStorage.removeItem(TRIAL_SS); }catch(e){}
    if(_trialTimer){ clearInterval(_trialTimer); _trialTimer=null; }
    if(_trialBar){ _trialBar.classList.remove('show'); var bar=_trialBar; setTimeout(function(){ if(bar)bar.remove(); },300); _trialBar=null; }
    // 恢复到真正装备的主题(没有就默认)
    if(!silent){ applyTheme(_read().equipped); }
  }
  window.__hsnDiaStopTrial = function(){ endTrial(false); shopToast('已结束试用'); };
  window.__hsnDiaBuyFromTrial = function(id){ endTrial(true); window.__hsnDiaBuy(id); };

  function shopToast(msg){
    var t=document.createElement('div'); t.className='dia-toast'; t.textContent=msg;
    document.body.appendChild(t);
    requestAnimationFrame(function(){ t.classList.add('show'); });
    setTimeout(function(){ t.classList.remove('show'); setTimeout(function(){t.remove();},300); }, 2400);
  }

  // ===== 商店CSS =====
  function injectShopCSS(){
    if(document.getElementById('hsnDiaShopCSS')) return;
    var css=''+
    '#diamondshopScreen{padding:16px;max-width:560px;margin:0 auto}'+
    '.dia-bal{font-size:16px;color:#e2e8f0;margin-bottom:6px}.dia-bal b{color:#22d3ee;font-size:20px}'+
    '.dia-tip{font-size:12px;color:#94a3b8;line-height:1.6;margin-bottom:18px}'+
    '.dia-cat{font-size:15px;font-weight:800;color:#22d3ee;margin:0 0 12px}'+
    '.dia-item{display:flex;align-items:center;gap:12px;background:rgba(30,41,59,.5);border:1px solid rgba(34,211,238,.2);border-radius:14px;padding:12px;margin-bottom:12px}'+
    '.dia-preview{width:64px;height:64px;border-radius:12px;flex-shrink:0;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.12)}'+
    '.dia-prev-emoji{font-size:26px;position:relative;z-index:2}'+
    // 🗑️ v743(Hansen): 流光6主题(aurora/lava/ocean/gold/sakura/forest)预览缩影已随流光系列删除
    '.dia-info{flex:1;min-width:0}'+
    '.dia-name{font-size:16px;font-weight:800;color:#e2e8f0}'+
    '.owned-tag{font-size:11px;color:#22d3ee;background:rgba(34,211,238,.15);padding:1px 7px;border-radius:8px;font-weight:700}'+
    '.dia-desc{font-size:12px;color:#cbd5e1;margin-top:3px;line-height:1.5}'+
    '.dia-action{flex-shrink:0;display:flex;flex-direction:column;gap:5px}'+
    '.dia-btn{border:none;border-radius:10px;padding:7px 14px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap}'+
    '.dia-btn.buy{background:linear-gradient(90deg,#06b6d4,#0891b2);color:#fff}'+
    '.dia-btn.try{background:rgba(167,139,250,.2);color:#c4b5fd;border:1px solid rgba(167,139,250,.5)}'+
    '.dia-btn.use{background:linear-gradient(90deg,#7c3aed,#6d28d9);color:#fff}'+
    '.dia-btn.equipped{background:#334155;color:#22d3ee;cursor:default}'+
    '.dia-unequip{background:rgba(71,85,105,.5);color:#cbd5e1;border:1px solid #475569;border-radius:10px;padding:8px 20px;font-size:13px;cursor:pointer;font-family:inherit}'+
    '.dia-soon{font-size:13px;color:#64748b;line-height:1.8;background:rgba(30,41,59,.3);padding:14px;border-radius:12px;text-align:center}+\n    /* 🎬 v540 IMAX 系列卡片 */'+
    '.dia-imax-tip{font-size:11.5px;color:#c4b5fd;background:rgba(124,58,237,.12);border:1px solid rgba(167,139,250,.3);border-radius:10px;padding:8px 11px;line-height:1.6;margin:0 0 10px}'+
    '.dia-item-imax{border:1.5px solid rgba(251,191,36,.55)!important;box-shadow:0 0 14px rgba(251,191,36,.18),inset 0 1px 0 rgba(255,255,255,.06)}'+
    '.dia-imax-badge{position:absolute;top:4px;left:4px;font-size:8px;font-weight:900;letter-spacing:1px;color:#1a1206;background:linear-gradient(135deg,#fde68a,#f59e0b);padding:1.5px 5px;border-radius:5px;box-shadow:0 1px 4px rgba(0,0,0,.4)}'+
    '.dia-prev-theme_clouddream{background:url(themes/cloud_dream.jpg?v=904) center 28%/cover}'+
    '.dia-prev-theme_rainbowsweet{background:url(themes/rainbow_sweet.jpg?v=904) center 22%/cover}'+
    '.dia-prev-theme_zombiedance{background:url(themes/zombie_dance.jpg?v=904) center 42%/cover}'+
    '.dia-prev-theme_fireworks{background:linear-gradient(160deg,#5b3fc4,#ff6b9d)}'+
    '.dia-prev-theme_candyland{background:linear-gradient(160deg,#7ec8ff,#ffb3d1)}'+
    '.dia-prev-theme_balloon{background:linear-gradient(160deg,#41b8f5,#ffe680)}'+
    '.dia-prev-theme_lagoon{background:linear-gradient(160deg,#27b6dd,#0a5ea0)}'+
    '.dia-prev-theme_spacepark{background:linear-gradient(160deg,#311b92,#4dd0e1)}'+
    // 试用提示条(顶部)
    '.dia-trial-bar{position:fixed;top:0;left:0;right:0;z-index:99998;background:linear-gradient(90deg,#7c3aed,#db2777);color:#fff;display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 12px;font-size:13px;font-weight:700;transform:translateY(-100%);transition:transform .3s;flex-wrap:wrap}'+
    '.dia-trial-bar.show{transform:translateY(0)}'+
    '.dia-trial-bar b{font-size:16px;color:#fde047}'+
    '.dia-trial-bar button{background:#fff;color:#7c3aed;border:none;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}'+
    '.dia-trial-bar button.trial-stop{background:rgba(255,255,255,.25);color:#fff}'+
    '.dia-toast{position:fixed;top:28%;left:50%;transform:translateX(-50%) translateY(-10px);background:rgba(15,23,42,.96);border:1px solid #22d3ee;color:#22d3ee;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:700;z-index:99999;opacity:0;transition:all .3s;max-width:80%;text-align:center}'+
    '.dia-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
    var st=document.createElement('style'); st.id='hsnDiaShopCSS'; st.textContent=css; document.head.appendChild(st);
  }

  // ===== 自动注入入口 + 开机应用已装备主题 =====
  function injectEntry(){
    try{
      if(document.getElementById('hsnDiaEntry')) return;
      var anyCard=document.querySelector('.util-card'); if(!anyCard||!anyCard.parentElement) return;
      var entry=document.createElement('div');
      entry.className='util-card'; entry.id='hsnDiaEntry';
      entry.setAttribute('onclick','HansenDiamondShop.open()');
      entry.innerHTML='<span class="u-icon"><img src="icons/ic_diamond.webp" alt="" draggable="false" style="width:72px;height:72px;object-fit:contain;vertical-align:middle;display:inline-block;transform:translate(0px,1px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))" onerror="window.hansenImgErr&&window.hansenImgErr(this)"></span><div class="u-label">主题商店</div>';
      anyCard.parentElement.insertBefore(entry, anyCard);
    }catch(e){}
  }
  /* 🔴 v543: v540-542 旧 IMAX id → 嘉年华新 id 一次性迁移(按相同价位对位, 已购/已装备无损平移) */
  function migrateImaxIds(){
    try{
      var MAP={theme_storm:'theme_fireworks',theme_meteor:'theme_candyland',theme_sakurastorm:'theme_balloon',theme_abyss:'theme_lagoon',theme_goldenage:'theme_spacepark'};   /* 🗑️v744: 一款已删IMAX主题的旧id迁移项已移除 */
      var o=_read(), changed=false;
      Object.keys(MAP).forEach(function(k){ if(o.owned[k]){ delete o.owned[k]; o.owned[MAP[k]]=true; changed=true; } });
      if(o.equipped && MAP[o.equipped]){ o.equipped=MAP[o.equipped]; changed=true; }
      if(changed) _write(o);
    }catch(e){}
  }
  /* 🔴 v716(Hansen): 抽出"应用当前生效主题"(试用优先·否则装备)——供 start() 与 bfcache 恢复/可见性变化复用。 */
  function applyActiveTheme(){
    /* 试用跨页续上(优先级最高)——sessionStorage 里有未过期试用就继续, 让用户拿着试用主题回主页亲眼看效果 */
    try{
      var tr=JSON.parse(sessionStorage.getItem(TRIAL_SS)||'null');
      if(tr && tr.id && tr.until > Date.now()){
        var it=ITEMS.find(function(x){return x.id===tr.id;});
        if(it){ startTrialFor(it, (tr.until-Date.now())/1000); try{ sessionStorage.setItem(TRIAL_SS, JSON.stringify(tr)); }catch(e1){} return; }   /* 回写: startTrialFor 内的 endTrial 会清掉, 续上后必须写回剩余时长 */
      }else if(tr){ try{ sessionStorage.removeItem(TRIAL_SS); }catch(e0){} }
    }catch(e){}
    /* v454: equipped 是没买的主题(旧白嫖漏洞留下的非法状态)→ 清空恢复默认背景 */
    try{ var o=_read(); var eq=o.equipped; if(eq && !o.owned[eq]){ o.equipped=null; _write(o); eq=null; } applyTheme(eq); }catch(e){}
  }
  function start(){
    migrateImaxIds();
    applyActiveTheme();
    injectEntry();
  }
  if(document.readyState==='complete'||document.readyState==='interactive'){ setTimeout(start,450); }
  else{ document.addEventListener('DOMContentLoaded', function(){ setTimeout(start,450); }); }
  /* 🔴 v716(Hansen·主题主页/岛同步根治): 主页↔岛是【整页跳转】(非 iframe·见 hansen_home_link.js)。回主页常走 history.back()=
     bfcache 快照恢复, start() 不会重跑 → 在岛里试用/换的主题, 回到主页(快照=离开时的旧主题)就不同步(Hansen:"主页主题与大冒险完全割裂")。
     补 pageshow(bfcache 恢复)重新应用"当前生效主题"(试用优先·否则装备), 让主页与岛彻底同步。整页跳转时 sessionStorage 同标签共享
     (试用 until 跨页有效), 装备走 localStorage 天然共享。visibilitychange 仅在有效试用时兜底复用(避免纯装备主题每次切回 App 重建场景闪烁)。 */
  window.addEventListener('pageshow', function(e){ if(e && e.persisted){ try{ applyActiveTheme(); }catch(_){} } });
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState!=='visible') return;
    try{ var raw=sessionStorage.getItem(TRIAL_SS); if(raw){ var t=JSON.parse(raw); if(t && t.id && t.until>Date.now()){ applyActiveTheme(); } } }catch(_){}
  });
})();
