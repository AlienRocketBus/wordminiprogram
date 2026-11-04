// hansen_palette.js (v856) — 🎨 整体配色系统(Hansen: "游戏黑不拉几·要7-8种配色·亮色暗色都有·大家自由选")
// ============================================================================
// 机制: template CSS 高频色已变量化 var(--pal-X, 原色兜底) → 默认深空蓝 = 不加任何类 = 原样零变化。
//       选非默认配色 → <html> 加 hsn-pal-{id} 类(亮色系再加 hsn-pal-light) → 一组变量整体换装:
//       body 星空背景(压 --th-* 变量·比 body[data-theme] 优先级高) + 顶栏 + 底部导航 + 全部面板/卡片 + 文字。
//       JS 拼的行内样式用 [style*="..."] + !important 精准接管(样式表 !important > 行内非 important)。
// 例外: #bossScreen 内的行内配色全部还原(打Boss保持电影感原样·任何配色下都不动·防亮色下文字看不清)。
// 持久化: localStorage 全局键 hansen_palette_global(跨岛一致·金币钱包同款教训)。
// 防闪: template/index <head> 里有同步内联小脚本·首帧前就把类加到 <html>(v855 同款教训: 同步加·不闪)。
// 铁律: 纯静态 CSS·零动画·零闪·不改任何布局尺寸(健康检查 redbar 不受影响)。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenPaletteLoaded) return; window.__hansenPaletteLoaded=true;

  var KEY='hansen_palette_global';

  // ── 8 套配色(第1套=深空蓝=默认=现在的样子·零改动) ──
  // vars: c1/c2=顶栏渐变 | c1rgb=底导航第一渐变段rgb | navA/navB=底导航渐变 | s1..s4=面板四阶
  //       ink/inkHi/ink2/ink3=文字四阶 | line=描边rgb | glassA/glassB=设置区玻璃底
  // body: deep/mid/glow=星空底 | n1..n4=星云四团
  var PALETTES=[
    {id:'cosmos', name:'深空蓝', emoji:'🌌', light:false, isDefault:true},
    {id:'violet', name:'暗夜紫', emoji:'🔮', light:false, vars:{
      c1:'#2e1065',c2:'#4c1d95',c1rgb:'46,16,101',navA:'rgba(46,16,101,.92)',navB:'rgba(23,10,50,.95)',
      s1:'#191033',s2:'#251a44',s3:'#37295e',s4:'#4a3a78',
      ink:'#fff',inkHi:'#ede9fe',ink2:'#d6ccf5',ink3:'#a695d6',line:'167,139,250',
      glassA:'rgba(37,26,68,.60)',glassB:'rgba(25,16,51,.60)',
      deep:'#170b30',mid:'#2b1657',glow:'#4c1d95',
      n1:'rgba(192,132,252,.35)',n2:'rgba(129,140,248,.35)',n3:'rgba(236,72,153,.22)',n4:'rgba(56,189,248,.18)'}},
    {id:'aurora', name:'极光青', emoji:'🌊', light:false, vars:{
      c1:'#083344',c2:'#155e75',c1rgb:'8,51,68',navA:'rgba(8,51,68,.92)',navB:'rgba(4,25,31,.95)',
      s1:'#0a222b',s2:'#123441',s3:'#1c4a59',s4:'#2a6173',
      ink:'#fff',inkHi:'#e0fbf6',ink2:'#c4ece4',ink3:'#85bdb2',line:'45,212,191',
      glassA:'rgba(18,52,65,.60)',glassB:'rgba(10,34,43,.60)',
      deep:'#04191f',mid:'#0b3a45',glow:'#0e7490',
      n1:'rgba(45,212,191,.30)',n2:'rgba(34,211,238,.32)',n3:'rgba(59,130,246,.22)',n4:'rgba(163,230,53,.14)'}},
    {id:'woods', name:'森野绿', emoji:'🌲', light:false, vars:{
      c1:'#14532d',c2:'#166534',c1rgb:'20,83,45',navA:'rgba(20,83,45,.92)',navB:'rgba(9,30,17,.95)',
      s1:'#0f2417',s2:'#1a3524',s3:'#274a33',s4:'#366146',
      ink:'#fff',inkHi:'#e7fbe9',ink2:'#cfeed4',ink3:'#93bf9d',line:'74,222,128',
      glassA:'rgba(26,53,36,.60)',glassB:'rgba(15,36,23,.60)',
      deep:'#0b1f11',mid:'#1c4426',glow:'#3f6212',
      n1:'rgba(74,222,128,.28)',n2:'rgba(163,230,53,.26)',n3:'rgba(253,224,71,.16)',n4:'rgba(45,212,191,.16)'}},
    {id:'cloud', name:'云端白', emoji:'☁️', light:true, vars:{
      c1:'#ffffff',c2:'#eef2ff',c1rgb:'255,255,255',navA:'rgba(255,255,255,.94)',navB:'rgba(238,242,255,.96)',
      s1:'#e3eaf6',s2:'#f4f7fd',s3:'#ffffff',s4:'#d3ddee',
      ink:'#1c2942',inkHi:'#24324d',ink2:'#46587a',ink3:'#7387a8',accentText:'#3730a3',line:'99,102,241',
      glassA:'rgba(255,255,255,.80)',glassB:'rgba(238,243,252,.72)',
      deep:'#e8effc',mid:'#f6f9ff',glow:'#dbe7fb',
      n1:'rgba(129,140,248,.20)',n2:'rgba(56,189,248,.18)',n3:'rgba(244,114,182,.12)',n4:'rgba(52,211,153,.12)'}},
    {id:'sakura', name:'樱花粉', emoji:'🌸', light:true, vars:{
      c1:'#fff1f7',c2:'#fce7f1',c1rgb:'255,241,247',navA:'rgba(255,244,249,.94)',navB:'rgba(252,231,241,.96)',
      s1:'#f6e3ec',s2:'#fdf4f8',s3:'#ffffff',s4:'#ecd2de',
      ink:'#431c31',inkHi:'#4f2440',ink2:'#7c4a63',ink3:'#a97e92',accentText:'#9f1239',line:'236,72,153',
      glassA:'rgba(255,246,250,.82)',glassB:'rgba(251,233,241,.74)',
      deep:'#fbe7f0',mid:'#fdf3f8',glow:'#f9d8e8',
      n1:'rgba(244,114,182,.20)',n2:'rgba(192,132,252,.14)',n3:'rgba(251,191,36,.10)',n4:'rgba(56,189,248,.10)'}},
    {id:'cream', name:'奶油杏', emoji:'🍦', light:true, vars:{
      c1:'#fff8ed',c2:'#faedd6',c1rgb:'255,248,237',navA:'rgba(255,250,240,.94)',navB:'rgba(250,237,214,.96)',
      s1:'#f2e4cd',s2:'#fbf3e4',s3:'#fffdf7',s4:'#e8d3b2',
      ink:'#43301a',inkHi:'#4d3a22',ink2:'#79603f',ink3:'#a68a63',accentText:'#1e40af',line:'217,119,6',
      glassA:'rgba(255,250,241,.82)',glassB:'rgba(250,240,220,.74)',
      deep:'#f7ecd9',mid:'#fcf6ea',glow:'#f3e0c2',
      n1:'rgba(251,146,60,.16)',n2:'rgba(251,191,36,.16)',n3:'rgba(244,114,182,.10)',n4:'rgba(163,230,53,.08)'}},
    {id:'mint', name:'薄荷绿', emoji:'🌿', light:true, vars:{
      c1:'#f4fdf8',c2:'#e2f6ec',c1rgb:'244,253,248',navA:'rgba(246,253,249,.94)',navB:'rgba(226,246,236,.96)',
      s1:'#ddefe5',s2:'#f1faf5',s3:'#ffffff',s4:'#cbe5d6',
      ink:'#15342a',inkHi:'#1d4033',ink2:'#46705f',ink3:'#729a89',accentText:'#065f46',line:'16,185,129',
      glassA:'rgba(246,253,249,.82)',glassB:'rgba(228,246,237,.74)',
      deep:'#e2f5ea',mid:'#f2fbf6',glow:'#d2eede',
      n1:'rgba(52,211,153,.18)',n2:'rgba(45,212,191,.16)',n3:'rgba(56,189,248,.12)',n4:'rgba(163,230,53,.10)'}}
  ];

  function byId(id){ for(var i=0;i<PALETTES.length;i++) if(PALETTES[i].id===id) return PALETTES[i]; return PALETTES[0]; }

  // ── 注入配色 CSS(一次·纯静态) ──
  function buildCSS(){
    var css='';
    for(var i=0;i<PALETTES.length;i++){
      var p=PALETTES[i]; if(p.isDefault) continue; var v=p.vars;
      css+='html.hsn-pal-'+p.id+'{'
        +'--pal-chrome-1:'+v.c1+';--pal-chrome-2:'+v.c2+';--pal-c1rgb:'+v.c1rgb+';'
        +'--pal-nav-a:'+v.navA+';--pal-nav-b:'+v.navB+';'
        +'--pal-surf-1:'+v.s1+';--pal-surf-2:'+v.s2+';--pal-surf-3:'+v.s3+';--pal-surf-4:'+v.s4+';'
        +'--pal-ink:'+v.ink+';--pal-ink-hi:'+v.inkHi+';--pal-ink-2:'+v.ink2+';--pal-ink-3:'+v.ink3+';--pal-accent-text:'+(v.accentText||v.inkHi)+';'
        +'--pal-line-rgb:'+v.line+';--pal-glass-a:'+v.glassA+';--pal-glass-b:'+v.glassB+'}\n';
      // body 星空底: html.hsn-pal-X body 比 body[data-theme] 优先级高 → 配色接管背景(默认深空不接管·旧主题照旧)
      css+='html.hsn-pal-'+p.id+' body{'
        +'--th-bg-deep:'+v.deep+';--th-bg-mid:'+v.mid+';--th-bg-glow:'+v.glow+';'
        +'--th-cosmos-1:'+v.n1+';--th-cosmos-2:'+v.n2+';--th-cosmos-3:'+v.n3+';--th-cosmos-4:'+v.n4+'}\n';
    }
    // ── 共享结构接管(仅任一配色激活时·默认零触碰) ──
    var S='html[class*="hsn-pal-"] ';
    css+=S+'.top-bar{background:linear-gradient(135deg,var(--pal-chrome-1),var(--pal-chrome-2))!important;box-shadow:0 4px 18px rgba(0,0,0,.16)!important}\n';
    css+=S+'.bottom-nav{background:linear-gradient(180deg,var(--pal-nav-a),var(--pal-nav-b))!important;border-top:1px solid rgba(var(--pal-line-rgb),.32)!important}\n';
    css+=S+'.settings-section{background:linear-gradient(135deg,var(--pal-glass-a),var(--pal-glass-b))!important;border-color:rgba(var(--pal-line-rgb),.30)!important}\n';
    // JS 行内样式精准接管(样式表!important > 行内)· #bossScreen 除外(下方整体还原)
    css+=S+'[style*="color:#fff"]{color:var(--pal-ink)!important}\n';
    css+=S+'[style*="color:#e2e8f0"]{color:var(--pal-ink-hi)!important}\n';
    css+=S+'[style*="color:#cbd5e1"]{color:var(--pal-ink-2)!important}\n';
    css+=S+'[style*="color:#94a3b8"]{color:var(--pal-ink-3)!important}\n';
    css+=S+'[style*="background:linear-gradient(135deg,#1e293b"]{background:linear-gradient(135deg,var(--pal-surf-2),var(--pal-surf-1))!important}\n';
    css+=S+'[style*="background:#0f172a"]{background:var(--pal-surf-1)!important}\n';
    css+=S+'[style*="background:#1e293b"]{background:var(--pal-surf-2)!important}\n';
    css+=S+'[style*="background:#334155"]{background:var(--pal-surf-3)!important}\n';
    css+=S+'[style*="background:#475569"]{background:var(--pal-surf-4)!important}\n';
    // 打Boss区整体还原(电影感原样·任何配色都不碰·防亮色下叠在立绘/暗遮罩上看不清)
    /* \U0001f534v1010: \u539f\u56db\u6761"\u5168\u5c4f\u514d\u75ab"\u5df2\u64a4\u2014\u2014\u5b83\u4eec\u628a\u4eae\u8272\u8c03\u4e0b\u7684\u6df1\u5b57\u4e5f\u51bb\u6210\u6d45\u5b57,
       \u9020\u6210\u9009\u9879\u767d\u5e95\u767d\u5b57\u5b8c\u5168\u770b\u4e0d\u89c1\u3002\u6539\u7531\u4e0b\u65b9\u6574\u5c4f\u53cc\u8272\u8c03\u65b9\u6848\u63a5\u7ba1\u3002
       \u5f69\u5e95\u5143\u7d20(\u8840\u6761/\u76f8\u673a/\u5f69\u724c)\u7684\u767d\u5b57\u5728\u4e0b\u65b9\u5355\u72ec\u4fdd\u7559\u3002 */
    css+=S+'#bossScreen [style*="background:linear-gradient(135deg,#1e293b"]{background:linear-gradient(135deg,#1e293b,#0f172a)!important}\n';
    css+=S+'#bossScreen [style*="background:#0f172a"]{background:#0f172a!important}\n';
    css+=S+'#bossScreen [style*="background:#1e293b"]{background:#1e293b!important}\n';
    css+=S+'#bossScreen [style*="background:#334155"]{background:#334155!important}\n';
    css+=S+'#bossScreen [style*="background:#475569"]{background:#475569!important}\n';
    // 🔴v865 星海番外篇副本卡还原(#hsnSeasonBar·深紫底任何配色都不动·金tag/enter钮深字保深): 与bossScreen同属"固定深色组件"豁免区
    css+='#hsnSeasonBar .hsn-ex-tag, #hsnSeasonBar .hsn-ex-enter{color:#3b0764!important;text-shadow:none!important}\n';
    css+='#hsnSeasonBar [style*="color:#fff"]{color:#fff!important}\n';
    css+='#hsnSeasonBar [style*="color:#c4b5fd"]{color:#c4b5fd!important}\n';
    css+='#hsnSeasonBar [style*="color:#94a3b8"]{color:#94a3b8!important}\n';
    css+='#hsnSeasonBar [style*="color:#fcd34d"]{color:#fcd34d!important}\n';
    // 🔴v860 赛季横幅还原(Hansen: 亮色下横幅里"距+80金币/还剩天数"黑压黑看不清): #hsnSeasonEntry 是固定深蓝组件(同bossScreen电影感豁免)·任何配色都不改它内部文字
    css+='#hsnSeasonEntry [style*="color:#fff"]{color:#fff!important}\n';
    css+='#hsnSeasonEntry [style*="color:#e2e8f0"]{color:#e2e8f0!important}\n';
    css+='#hsnSeasonEntry [style*="color:#cbd5e1"]{color:#cbd5e1!important}\n';
    css+='#hsnSeasonEntry [style*="color:#94a3b8"]{color:#94a3b8!important}\n';
    css+='#hsnSeasonEntry, #hsnSeasonEntry *{--pal-ink:#f1f5f9;--pal-ink-2:#cbd5e1;--pal-ink-3:#94a3b8}\n';
    // 🔴v863 亮色全面整改(Hansen真机: 亮色下岛内大量文字看不清/发糊 · 七屏×两亮色逐元素扫描驱动·palette层统一修=24岛+index一次全治)
    var L='html.hsn-pal-light ';
    // ① boss屏深底归位: v856钦令"打Boss任何配色不动(电影感)"·此前只还原了内联字色, 屏底与继承字漏网→亮色下选关墙深卡字被调深+页底变浅全乱。整屏钉回深色=一条通杀。
    /* ⭐v912(Hansen真机: 龙骑士统帅巨翼特效消失): 与 v905 同因——boss屏暗底【绝不能涂在 #bossScreen 自身】, 那是普通内容层, 会盖死 z-index:-1 的背景特效层
       (BUG#70/v536 钦定挂背景层: 龙骑士统帅巨翼从背后展开 / 三头犬地狱之门在身后升起)。改涂到 #bossScreen::before(fixed 铺满视口·z-index:-2), 沉到背景特效层之下。 */
    css+=L+'#bossScreen{background:transparent!important}\n';
    css+=L+'#bossScreen::before{background:linear-gradient(180deg,#131c3a,#0c1538)!important}\n';
    css+=L+'#bossScreen, '+L+'#bossScreen *{--pal-ink:#f1f5f9;--pal-ink-2:#cbd5e1;--pal-ink-3:#94a3b8}\n';
    css+=L+'#bossScreen{color:#e2e8f0}\n';
    // ② 深色纯部件(任何配色下都是深底): 继承字回浅·金字回金(id/类+属性特异性压过③通用琥珀映射)
    var DK=['.util-card','.psw-nmrow','.psw-cap','.lkk','.ach-total']; // v863三批: settings两件改翻浅玻璃(见⑫)·ach-total入深区
    css+=DK.map(function(d){return L+d+','+L+d+' *';}).join(',')+'{color:#e2e8f0}\n';
    ['#fbbf24','#fde047','#fde68a','#facc15','#fef3c7','#fcd34d'].forEach(function(gold){
      css+=DK.map(function(d){return L+d+' [style*="color:'+gold+'"]';}).join(',')+'{color:'+gold+'!important}\n';
    });
    // ③ 通用金字系→各亮色主题自己的高对比强调色；旧驼棕文字族永久禁用。
    ['#fbbf24','#fde047','#fde68a','#facc15','#fcd34d'].forEach(function(gold){
      css+=L+'[style*="color:'+gold+'"]{color:var(--pal-accent-text,#1e40af)!important}\n'; // !important必须: inline style优先级>一切非important规则(v863教训); 深区/boss屏/金bar/横幅还原特异性更高照样赢
    });
    css+=L+'.quest-reward,'+L+'.ach-reward,'+L+'.ach-bar-count{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=L+'.pet-name{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
    css+=L+'.psw-sub,'+L+'.rsb{color:#475569!important}\n';
    // ④ mode卡标签万能白晕: 各卡自带深浅不一的own色底, 白字+黑晕任何底都读得清(island-en同款验证过的疗法)
    css+=L+'.mode-card,'+L+'.mode-card *{color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.55)!important}\n'; // 三批: 扩全卡(副行文字之前漏)
    // ⑤ 金底容器(内联金渐变)内文一律深棕: 已掌握块/等级图鉴金bar/一切金底=属性选一网打尽·零渲染源改动
    css+=L+'[style*="linear-gradient(135deg,#fbbf24"] *, '+L+'[style*="linear-gradient(135deg, #fbbf24"] *{color:#1a1200!important;text-shadow:none!important}\n'; // 终刀β: 逗号后带空格写法(stats掌握卡)
    // ⑥ 发光灭霸: 暗色时代的glow描边在亮底=发糊的元凶(Hansen: "很多字特别模糊")
    css+=L+'.screen-title,'+L+'.screen-title *{text-shadow:none!important}\n';
    // ⑦ 赛季横幅金系补还原(v860只还原了灰白系·金系漏网→通用琥珀映射会误伤深蓝横幅里的金字)
    ['#fbbf24','#fde68a','#fde047','#facc15'].forEach(function(gold){
      css+='#hsnSeasonEntry [style*="color:'+gold+'"]{color:'+gold+'!important}\n';
    });
    // 🔴v863第二批(复扫收尾): 
    // ⑧ 亮色系ink-2/3统一深化(mint的ink-2=浅绿灰压浅页仅2.9·cream同病)→浅页可读性治本
    css+=L+'body{--pal-ink-2:#475569;--pal-ink-3:#64748b}\n';
    // ⑨ 返回钮(深胶囊)字回浅(⑧深化后会深压深)
    css+=L+'.back-btn{color:#e2e8f0!important}\n';
    // ⑩ 成就卡脚注金字(类色·非inline)
    css+=L+'.ach-foot2,'+L+'.ach-prog{color:var(--pal-accent-text,#1e40af)!important}\n';
    // ⑪ 宠物进化墙: 阶段标签浅蓝+psw-sub里类金(36/进化全程)
    css+=L+'#petScreen .st{color:#475569!important}\n';
    css+=L+'.psw-sub b,'+L+'.psw-sub span{color:var(--pal-accent-text,#1e40af)!important}\n';
    // 🔴v863第三批(52条真清单终局):
    // ⑫ 设置卡翻浅玻璃(亮色统一语言·与how-step/说明书折叠卡一致): 卡浅+缺省深字·econ_guide三卡自动跟随
    css+=L+'.settings-section{background:rgba(255,255,255,.66)!important;border-color:rgba(0,0,0,.08)!important}\n';
    css+=L+'.settings-stat{background:rgba(255,255,255,.55)!important;border-color:rgba(0,0,0,.06)!important}\n';
    css+=L+'[style*="color:#22c55e"]{color:#15803d!important}\n';
    // ⑬ 全局灭晕(低优先·不带important): 暗色glow在亮底=糊的总根; m-title/mode-card/island-en等带important的黑晕白名单自动存活
    css+=L+'.screen *{text-shadow:none}\n';
    css+=L+'.island-hero *, '+L+'.section-label{text-shadow:none!important}\n';
    // ⑭ #1e1b4b深条通用还原(ach-total底/stats提示条·inline深底内字回浅)
    css+=L+'[style*="background:#1e1b4b"], '+L+'[style*="background:#1e1b4b"] *, '+L+'[style*="background: #1e1b4b"] *, '+L+'[style*="background:rgb(30, 27, 75"] *{color:#e2e8f0}\n'; // 四批: 限定bg·border撞色误伤过
    // ⑮ 宠物屏: 兜底深字+浅玻璃件点名·星灵简介深字
    css+=L+'#petScreen{color:#334155}\n';
    css+=L+'#petScreen .nm,'+L+'#petScreen .rnm{color:#334155!important}\n';
    css+=L+'#petScreen .now{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=L+'.pet-text{color:#334155!important;text-shadow:none!important}\n';
    // 🔴v863第四批(17条收官):
    // ⑯ 设置屏直系卡通杀翻浅(静音卡等非.settings-section类的注入卡一并·swatch深圆是孙级不受影响)
    css+=L+'#settingsContent > div{background:rgba(255,255,255,.66)!important;border-color:rgba(0,0,0,.08)!important;color:#334155}\n';
    css+=L+'#settingsContent h3{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
    css+=L+'.settings-stat span{color:var(--pal-accent-text,#1e40af)!important}\n';
    // ⑰ 宠物hero深行里的名字: 深行浅字(修⑮对nm一刀切误伤)
    css+=L+'#petScreen .psw-nmrow, '+L+'#petScreen .psw-nmrow *{color:#e2e8f0!important}\n'; // 五批修: 升id级特异性(⑮的#petScreen .nm曾反杀两类版)
    // 🔴v863第五批(终刀·最后3病灶):
    // ⑱ settings-stat 里的警示浅红b(如"3 次")→深红(浅卡可读·警示语义保留)
    css+=L+'.settings-stat b{color:#1e3a8a!important}\n';
    // ⑲ inline浅灰#cbd5e1通用深化(stats提示条等·此前通用映射只盖了金五色漏了灰系); 深区/boss屏/横幅的还原选择器特异性更高照样赢
    css+=L+'[style*="color:#cbd5e1"]{color:#475569!important}\n';
    // \U0001f534v987 \u7b2c\u516d\u6279(Hansen\u771f\u673a\u516d\u8fde\xb7\u4eae\u8272\u88c5\u4fee):
    // \u3251 \u6253\u5361\u4e09\u9762\u677f\u4eae\u5316: \u6df1\u73bb\u7483\u5e95\u2192\u6d45\u73bb\u7483(\u547d\u4e2d\u552f\u4e00\u7b7e\u540drgba(30,41,59,.55)\xb7\u91d1\u5b57\u5df2\u88ab\u2464\u6279\u63a5\u7ba1\u53d8\u5f3a\u8c03\u8272)
    css+=L+'[style*="background:rgba(30,41,59,.55)"]{background:rgba(255,255,255,.72)!important;border:1px solid rgba(0,0,0,.06)!important}\n';
    // \u3252 \u5b9d\u7bb1\u89d2\u6807(\u7ea2/\u84dd\u80f6\u56ca\u56fa\u5b9a\u6df1\u5e95): \u5b57\u6c38\u8fdc\u767d\xb7\u53bb\u6655
    css+=L+'.chest-badge{color:#fff!important;text-shadow:none!important}\n';
    // \u3254 \u5355\u8bcd\u5927\u9646\u62bd\u5361\u9875(#landGachaBody\xb7\u56fa\u5b9a\u6df1\u7d2b\u5e95): \u5bb9\u5668\u7ea7ink\u91cd\u9489(\u4eff\u2460bossScreen\u65b9\u6848)+\u91d1/\u7eff/\u6d45\u7070\u8fd8\u539f
    css+=L+'#landGachaBody, '+L+'#landGachaBody *{--pal-ink:#f1f5f9;--pal-ink-hi:#e2e8f0;--pal-ink-2:#cbd5e1;--pal-ink-3:#94a3b8}\n';
    css+=L+'#landGachaBody [style*="color:#cbd5e1"]{color:#cbd5e1!important}\n';
    ['#fbbf24','#fde047','#fde68a','#facc15','#fcd34d'].forEach(function(gold){
      css+=L+'#landGachaBody [style*="color:'+gold+'"]{color:'+gold+'!important}\n';
    });
    css+=L+'#landGachaBody [style*="color:#22c55e"]{color:#22c55e!important}\n';
    // \u3255 \u5361\u518c\u5927\u9646\u62bd\u5361\u6a2a\u6761(.lg-banner\xb7\u56fa\u5b9a\u6df1\u7d2b\u6e10\u53d8\u5e95): \u540c\u6cd5\u91cd\u9489
    css+=L+'.lg-banner, '+L+'.lg-banner *{--pal-ink:#fff;--pal-ink-hi:#f5f3ff;--pal-ink-2:#ddd6fe;--pal-ink-3:#c4b5fd}\n';
    ['.util-card','.psw-nmrow','.psw-cap','.lkk','.ach-total'].forEach(function(d){
      css+=L+d+' [style*="color:#cbd5e1"]{color:#cbd5e1!important}\n';
    });
    css+=L+'[style*="background:#1e1b4b"] [style*="color:#cbd5e1"]{color:#cbd5e1!important}\n';
    // ⑳ 宠物进化全程标题行改为主题强调色并去晕
    css+=L+'.psw-th, '+L+'.psw-th span, '+L+'.psw-th b{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
    // 🔴v863终刀: 深提示条linear-gradient写法(⑭三写法漏网·stats"点一下"条)
    css+=L+'[style*="linear-gradient(135deg,#1e1b4b"] *{color:#e2e8f0!important}\n';
    // 🔴v907 难度卡内奖励盒(rgba(0,0,0,.5)深遮罩+行内#fff)保白字: 深遮罩压彩卡=深底·须白字才可读(否则被①#fff→深墨映射翻深=深压深糊成一团·Hansen真机点名"做题下面解释看不清")。带两属性特异性(0,0,3,1)压过①的通用#fff映射(0,0,2,1)·且晚于金渐变③规则→通杀
    css+=L+'[style*="background:rgba(0,0,0,.5)"][style*="color:#fff"]{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.55)!important}\n';
    // 亮色系兜底: 默认文字全走深墨
    css+='html.hsn-pal-light body{color:var(--pal-ink)}\n';

    // ══════════════════════════════════════════════════════════════════
    // ⭐ v928 亮色主题总修 (Hansen: 配色实在太差·灰不拉几·字都看不清·弹窗里还有黄色的字)
    // 根因: 亮色主题此前【只改了 body 的字色】(上面那一行), 卡片/面板/弹窗的【底色】压根没被接管:
    //   · .exp-card 的渐变只有第一个色是变量, 第二个 #1a1f3a 是【写死的深蓝黑】→ 亮色下变成"浅→深"的脏灰渐变
    //   · .exp-card.learned / .modal / .mode-card / .util-card / .ach-* / .psw-* / .back-btn … 全是写死的深底
    //   · 而文字被 --pal-ink 改成了【深色】→ 深字压深底 = 灰不拉几 + 看不清
    //   · 弹窗里 .m-cn(中文释义)=#fbbf24 金、.m-excn(例句翻译)=#fde047 黄, 写死的 → 浅底上几乎隐形
    // 真机量过: 单词卡中文 2.23:1 · 顶栏名字 1.47:1 · 分类标题 1.38:1 · 统计页文字 1:1(纯隐形) —— WCAG AA 要 4.5:1
    // 修法: 亮色下所有卡面翻成干净浅色 + 文字走深墨 + 金/黄字改深琥珀(仍是金的味道但看得清),
    //       饱和色按钮保留底色但强制白字。#bossScreen 按既有铁律一律不动(打Boss保持电影感)。
    // ══════════════════════════════════════════════════════════════════
    var _L='html.hsn-pal-light ';
    var _LS='html[class*="hsn-pal-"].hsn-pal-light ';  /* \U0001f534v994: \u9ad8\u7279\u5f02\u6027\u524d\u7f00(\u538b\u8fc7\u901a\u7528\u94a9\u5b50) */
    var _SF='linear-gradient(135deg,#ffffff,var(--pal-surf-2,#eef2f8))';
    var _BD='1px solid rgba(var(--pal-line-rgb,99,102,241),.28)';
    var _SH='0 2px 10px rgba(30,41,59,.07)';
    var _AM='var(--pal-accent-text,#1e40af)'; // 浅底强调文字：主题化高对比蓝/紫/红/绿，禁止旧驼棕色族
    var _IK='var(--pal-ink,#1c2942)';
    var _IK2='var(--pal-ink-2,#46587a)';
    ['.exp-card','.modal','.mode-card','.util-card','.ach-card2','.ach-total','.ach-bar',
     '.psw-cap','.psw-hero','.psw-ped','.psw-bar','.psw-pethalo','.scramble-cn','.moles-prompt',
     '.ms-item','.fs-item','.settings-textarea','.small-btn.gray','.match-back'].forEach(function(sel){
      css+=_L+sel+'{background:'+_SF+'!important;border:'+_BD+'!important;box-shadow:'+_SH+'!important;color:'+_IK+'!important}\n';
    });
    css+=_L+'.exp-card .word{color:'+_IK+'!important}\n';
    css+=_L+'.exp-card .cn{color:'+_IK2+'!important}\n';
    css+=_L+'.cat-title{color:#4338ca!important}\n';
    css+=_L+'.cat-progress,'+_L+'.section-label,'+_L+'.st,'+_L+'.psw-sub,'+_L+'.pet-text{color:'+_IK2+'!important}\n';
    css+=_L+'.ach-tier,'+_L+'.pet-stage,'+_L+'.rsb{color:'+_IK+'!important}\n';
    css+=_L+'.exp-card.learned{background:linear-gradient(135deg,#f0fdf4,#dcfce7)!important;border:1px solid #22c55e!important}\n';
    css+=_L+'.exp-card.learned .word,'+_L+'.exp-card.learned .cn{color:#14532d!important}\n';
    css+=_L+'.modal .m-word{color:'+_IK+'!important}\n';
    css+=_L+'.modal .m-pn{color:#4338ca!important}\n';
    css+=_L+'.modal .m-cn{color:'+_AM+'!important}\n';
    css+=_L+'.modal .m-ex{color:'+_IK+'!important}\n';
    css+=_L+'.modal .m-excn{color:'+_AM+'!important}\n';
    css+=_L+'.modal .close{background:#ef4444!important;color:#fff!important;border-color:#dc2626!important}\n';
    css+=_L+'.m-btn,'+_L+'.game-btn,'+_L+'.back-btn,'+_L+'.danger-btn{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.35)!important}\n';
    css+=_L+'.m-btn.listen{background:linear-gradient(135deg,#6366f1,#4f46e5)!important;border:none!important}\n';
    css+=_L+'.m-btn.slow{background:linear-gradient(135deg,#14b8a6,#0f766e)!important;border:none!important}\n';
    css+=_L+'.m-btn.sentence{background:linear-gradient(135deg,#f59e0b,#d97706)!important;border:none!important}\n';
    css+=_L+'.m-btn.got-it{background:linear-gradient(135deg,#22c55e,#16a34a)!important;border:none!important}\n';
    css+=_L+'.back-btn{background:linear-gradient(135deg,#6366f1,#4338ca)!important;border:none!important}\n';
    // 设置页"Boss特效调节"锁定项: 淡紫字压白底 1.36:1 / 2.92:1 → 深紫
    css+=_L+'.hbafx-entry b{color:#5b21b6!important}\n';
    css+=_L+'.hbafx-entry span{color:#6d28d9!important}\n';
    // 统计页行内浅灰字(#cbd5e1)压在半透明深板上 → 亮色下那板子变浅灰, 浅字就糊了 3.13:1 → 改深墨
    css+=_L+'[style*="color:#cbd5e1"],'+_L+'[style*="color:#e2e8f0"],'+_L+'[style*="color:#94a3b8"]{color:'+_IK+'!important}\n';
    // 首页"挑战BOSS": 白字压在浅蓝boss图上 2.58:1 → 垫一层深底板(白字立刻 10:1+)
    // 首页"挑战BOSS"标签: 行内样式带 !important(color:#fff!important + -webkit-text-fill-color:#fff!important,
    // v664"首页文字按调节器统一"故意锁死) → 行内!important 压过任何样式表规则, 改色改不动。
    // 而 boss 图有深有浅, 白字本来就是通用解 —— 正确修法是【加重描边】(描边行内没锁, 样式表能加)。
    css+=_L+'.d-label.boss-card-label{text-shadow:0 1px 3px rgba(0,0,0,.95),0 0 7px rgba(0,0,0,.75),0 0 2px rgba(0,0,0,.9)!important}\n';
    css+=_L+'.top-name{color:'+_AM+'!important;text-shadow:none!important}\n';
    css+=_L+'.ni-label{color:'+_AM+'!important;text-shadow:none!important}\n';
    css+=_L+'.m-title,'+_L+'.d-label{color:'+_IK+'!important;text-shadow:none!important}\n';
    // 浅卡里残留的深色主题【浅灰字】(#e2e8f0/#cbd5e1) → 亮底上实测 1.19:1 = 隐形, 全部改深墨
    css+=_L+'.ach-name2,'+_L+'.ach-bar-name,'+_L+'.u-label,'+_L+'.nm,'+_L+'.d-label,'+_L+'.rt{color:'+_IK+'!important;text-shadow:none!important}\n';
    css+=_L+'.ach-desc2{color:'+_IK2+'!important}\n';
    // 饱和按钮: 底色必须够深, 白字才压得住(实测 slow 3.61:1 → 换 700/800 档)
    css+=_L+'.m-btn.slow{background:linear-gradient(135deg,#0f766e,#115e59)!important}\n';
    css+=_L+'.m-btn.sentence{background:linear-gradient(135deg,#b45309,#92400e)!important}\n';
    css+=_L+'.m-btn.got-it{background:linear-gradient(135deg,#16a34a,#15803d)!important}\n';
    css+=_L+'.game-btn{background:linear-gradient(135deg,#4f46e5,#4338ca)!important}\n';
    // \U0001f534v988\u3256 \u4e13\u6ce8\u6253\u5b57\u5c4f\u65cf(htm-\xb7\u968f\u8272\u677f\u5e95): \u4eae\u5e95\u6d45\u5b57\u2192\u58a8/\u5f3a\u8c03
    // \U0001f534v994\u321f \u4e13\u6ce8\u6253\u5b57\u65cf\u52a0\u56fa: \u63d0\u9ad8\u7279\u5f02\u6027(\u5c5e\u6027\u9009\u62e9\u5668\u524d\u7f00)+\u8986\u76d6\u5b50\u5143\u7d20+\u8865\u5168\u540c\u65cf\u7c7b
    // v988\u3256 \u5199\u6cd5\u5728\u90e8\u5206\u73af\u5883\u4e0b\u53ef\u80fd\u8f93\u7ed9\u540e\u4f4d\u901a\u7528\u94a9\u5b50, \u672c\u7248\u7edf\u4e00\u7528 _LS \u53cc\u91cd\u524d\u7f00
    css+=_LS+'.htm-complete,'+_LS+'.htm-complete *{color:#334155!important}\n';
    css+=_LS+'.htm-complete h2{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
    css+=_LS+'.htm-complete p,'+_LS+'.htm-complete p *{color:#475569!important;text-shadow:none!important}\n';
    css+=_LS+'.htm-complete p b,'+_LS+'.htm-complete p strong{color:#0f172a!important}\n';
    css+=_LS+'.htm-complete button{color:#fff!important}\n';
    css+=_LS+'.htm-focus-head{color:#0f172a!important;text-shadow:none!important}\n';
    css+=_LS+'.htm-rule{color:#475569!important}\n';
    css+=_LS+'.htm-pause{color:#0f172a!important}\n';
    css+=_LS+'.htm-focus-feedback{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
    css+=_LS+'.htm-focus-setup,'+_LS+'.htm-focus-setup *{color:#334155!important}\n';
    css+=_LS+'#typingContent [style*="color:#fff"]:not([style*="linear-gradient"]){color:#0f172a!important}\n';
    css+=_LS+'#typingContent [style*="color:#cbd5e1"]{color:#475569!important}\n';
    css+=_LS+'#typingContent [style*="color:#fde047"],'+_LS+'#typingContent [style*="color:#fde68a"]{color:var(--pal-accent-text,#1e40af)!important}\n';
    // \U0001f534v988\u3257 \u6211\u7684\u5b66\u4e60\u9875\u65cf(hsn-ml-\xb7\u968f\u8272\u677f\u5e95)
    /* \U0001f534v992: v988\u3257 \u65e7\u89c4(\u4ec5\u6539\u6587\u5b57\u8272)\u5df2\u64a4\u2014\u2014\u6539\u7531\u325d \u6574\u5c42\u53cc\u8272\u8c03\u5206\u79bb\u63a5\u7ba1 */
    // \U0001f534v988\u3258 \u730e\u4eba\u5956\u52b1\u5361(#hr_rvrw_card): \u73af\u5883\u514d\u75ab\u2014\u2014\u4eae\u677f\u4e0b\u56fa\u5316\u4e3a\u5b9e\u5fc3\u6df1\u7425\u73c0+\u6696\u5149\u58a8\u6c34, \u9875\u9762\u660e\u6697\u7686\u81ea\u6d3d
    css+=_L+'#hr_rvrw_card{background:linear-gradient(135deg,#78350f,#92400e)!important;border-color:#f59e0b!important;color:#fde68a!important}\n';
    css+=_L+'#hr_rvrw_card, '+_L+'#hr_rvrw_card *{--pal-ink:#fef3c7;--pal-ink-hi:#fde68a;--pal-ink-2:#fcd34d;--pal-ink-3:#e7cfa0;--pal-accent-text:#fbbf24}\n';
    ['#fbbf24','#fde047','#fde68a','#facc15','#fcd34d'].forEach(function(gold){
      css+=_L+'#hr_rvrw_card [style*="color:'+gold+'"]{color:'+gold+'!important}\n';
    });
    css+=_L+'#hr_rvrw_card [style*="color:#34d399"]{color:#34d399!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#64748b"]{color:#e7cfa0!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#c4b5fd"]{color:#f3e8ff!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#a5b4fc"]{color:#e0e7ff!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#cbd5e1"]{color:#fde68a!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#e2e8f0"]{color:#fef3c7!important}\n';
    css+=_L+'#hr_rvrw_card [style*="color:#fff"]{color:#fff!important}\n';
    // \U0001f534v989\u3259 \u4eae\u8272\u5168\u7ebf\u5ba1\u8ba1\u6839\u6cbb(\u5ba1\u8ba1\u673av3\u5224\u51b3\xb79\u7ec4): \u665a\u4f4d\u538b\u8fc7v928\u65e7\u89c4
    // A \u6210\u5c31\u603b\u8fdb\u5ea6\u5361: L249\u628a\u5e95\u7ffb\u6d45\u540eL141\u6b8b\u7559\u6d45\u5b57 \u2192 \u7edf\u4e00\u58a8\u5b57+\u91d1\u8fd8\u539f
    css+=_L+'.ach-total,'+_L+'.ach-total *{color:#334155!important}\n';
    ['#fbbf24','#fde047','#fde68a','#facc15','#fcd34d'].forEach(function(gold){
      css+=_L+'.ach-total [style*="color:'+gold+'"]{color:var(--pal-accent-text,#1e40af)!important}\n';
    });
    // B \u6210\u5c31\u5361\u811a\u6d45\u84dd\u8ba1\u6570
    css+=_L+'.ach-prog-txt{color:#1d4ed8!important}\n';
    // C \u5ba0\u7269\u82f1\u96c4\u5361\u5168\u5bb6(\u5e95\u5df2\u7ffb\u6d45\xb7\u5b57\u672a\u8ddf\u4e0a)
    css+=_L+'#petScreen .psw-nmrow,'+_L+'#petScreen .psw-nmrow *{color:#334155!important}\n';
    css+=_L+'.psw-hero .sg{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=_L+'.psw-hero .qt,'+_L+'.psw-barlab{color:#475569!important}\n';
    css+=_L+'.psw-barlab b{color:#1c2942!important}\n';
    css+=_L+'.lkk{color:#334155!important}\n';
    // D \u7edf\u8ba1\u6df1\u84dd\u63d0\u793a\u6761: L274\u665a\u4e8eL218\u7684\u8d8a\u6743\u590d\u4f4d
    css+=_L+'[style*="background:#1e1b4b"] [style*="color:#cbd5e1"],'+_L+'[style*="background: #1e1b4b"] [style*="color:#cbd5e1"]{color:#e2e8f0!important}\n';
    // E \u7edf\u8ba1\u6df1\u7ea2\u74e6\u7247\u5185\u91d1\u5b57\u8fd8\u539f
    css+=_L+'[style*="linear-gradient(135deg,#7f1d1d"] [style*="color:#fde047"],'+_L+'[style*="linear-gradient(135deg,#7f1d1d"] [style*="color:#fbbf24"]{color:#fde047!important}\n';
    // F Boss\u4e3b\u9898\u9009\u62e9\u5668\u8272\u5757\u6807\u7b7e: \u767d\u5b57+\u62a4\u6655\u4e0d\u5f97\u88ab\u52ab
    css+=_L+'#hsnBossThemePicker [style*="color:#fff"]{color:#fff!important}\n';
    // G \u4e3b\u9898\u9884\u89c8\u5361(\u56fa\u5b9a\u6df1\u8272\u5c0f\u7a97)\u5185\u91d1\u5b57\u8fd8\u539f
    css+=_L+'#themeBox [style*="color:#fbbf24"],'+_L+'#themeBox [style*="color:#fde047"]{color:#fbbf24!important}\n';
    // D2 \u6df1\u84dd\u74e6\u7247\u6e10\u53d8\u5199\u6cd5\u8865\u9057
    css+=_L+'[style*="linear-gradient(135deg,#1e1b4b"] [style*="color:#cbd5e1"]{color:#e2e8f0!important}\n';
    // G2 \u4e3b\u9898\u9884\u89c8\u5361\u767d\u5b57\u8fd8\u539f(\u81ea\u5e26\u62a4\u6655)
    css+=_L+'#themeBox [style*="color:#fff"]{color:#fff!important}\n';
    // E2 \u91d1\u4e38\u5976\u6cb9\u5b57\u8f6c\u6df1\u68d5(\u9876\u680f\u4efb\u52a1\u4e38)
    css+=_L+'[style*="linear-gradient(90deg,#fbbf24"] [style*="color:#fef3c7"]{color:#0f172a!important}\n';
    // D3 \u6df1\u84dd\u7edf\u8ba1\u5361\u5185\u5c0f\u74e6\u7247\u56de\u6df1(\u6574\u5361\u5c5e\u56fa\u5b9a\u6df1\u8bbe\u8ba1\xb7\u5185\u74e6\u4e0d\u5f97\u88ab\u901a\u7528\u94a9\u5b50\u7ffb\u4eae)
    css+=_L+'[style*="linear-gradient(135deg,#1e1b4b"] [style*="background:#0f172a"],'+_L+'[style*="background:#1e1b4b"] [style*="background:#0f172a"]{background:#0f172a!important}\n';
    css+=_L+'[style*="linear-gradient(135deg,#1e1b4b"] [style*="background:#1e293b"],'+_L+'[style*="background:#1e1b4b"] [style*="background:#1e293b"]{background:#1e293b!important}\n';
    // E3 \u6df1\u7ea2\u74e6\u5185\u6d45\u7070\u56de\u6d45
    css+=_L+'[style*="linear-gradient(135deg,#7f1d1d"] [style*="color:#cbd5e1"]{color:#e2e8f0!important}\n';
    // E2b \u91d1\u6e10\u53d8\u5bb9\u5668\u5976\u6cb9\u5b57\u5bbd\u914d\u8f6c\u6df1\u68d5
    css+=_L+'[style*="background:linear-gradient"][style*="#fbbf24"] [style*="color:#fef3c7"]{color:#0f172a!important}\n';
    // H \u590d\u4e60\u5e95\u90e8\u6df1\u6761\u63d0\u793a
    css+=_L+'.hr_btm_hint{color:#cbd5e1!important}\n';
    // I \u5361\u518c\u9501\u5361\u5c0f\u5b57\u52a0\u6df1
    css+=_L+'#cardsScreen [style*="color:#475569"]{color:#1f2937!important}\n';
    /* v1165: 卡册「✨ 全部集齐 · 卡牌大师」是深底用的浅绿 #86efac，亮色底上 1.3:1 看不清（体验期卡册全开时就会出现） */
    css+=_L+'#cardsScreen [style*="color:#86efac"]{color:#15803d!important}\n';
    // \U0001f534v991\u325a(\u91cd\u5199) \u4eca\u65e5\u590d\u4e60\u5c42(#hr_today) \u6539\u4e3a\u771f\u53cc\u8272\u8c03\u5206\u79bb
    // v990 \u66fe\u7528"\u51bb\u4f4f\u6df1\u5e95"\u4fdd\u62a4\u6587\u5b57; \u7528\u6237\u660e\u786e\u8981\u6c42\u4eae\u8272\u8c03\u5c31\u8be5\u4eae\u5e95\u9ed1\u5b57, \u6545\u6539\u4e3a\u6574\u5c42\u7ffb\u8f6c
    css+=_L+'#hr_today{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 60%,#e0e7ff 100%)!important}\n';
    css+=_L+'#hr_today, '+_L+'#hr_today *{--pal-ink:#0f172a;--pal-ink-hi:#020617;--pal-ink-2:#334155;--pal-ink-3:#64748b}\n';
    css+=_L+'#hr_today [style*="color:#fff"]{color:#0f172a!important}\n';
    css+=_L+'#hr_today [style*="color:#cbd5e1"]{color:#334155!important}\n';
    css+=_L+'#hr_today [style*="color:#94a3b8"]{color:#475569!important}\n';
    css+=_L+'#hr_today [style*="color:#fbbf24"],'+_L+'#hr_today [style*="color:#fde047"],'+_L+'#hr_today [style*="color:#fde68a"]{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=_L+'#hr_today [style*="color:#34d399"]{color:#065f46!important}\n';
    css+=_L+'#hr_today [style*="rgba(255,255,255,.55)"],'+_L+'#hr_today [style*="rgba(255,255,255,.6)"]{color:#475569!important}\n';
    css+=_L+'#hr_today .ht_prog{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=_L+'#hr_today .ht_top{color:#0f172a!important}\n';
    css+=_L+'#hr_today .ht_top button{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    css+=_L+'#hr_today .ht_bar{background:rgba(15,23,42,.12)!important}\n';
    // \u7b54\u9898\u4e2d\u7684\u56fa\u5b9a\u6df1\u5e95(\u6df1\u68d5\u6e10\u53d8)\u4e5f\u7ffb\u4eae
    css+=_L+'#hr_today[style*="linear-gradient(180deg,#7c2d12"]{background:linear-gradient(180deg,#fff7ed 0%,#fef3c7 55%,#eef2ff 100%)!important}\n';
    // \U0001f534v991\u325c(\u91cd\u5199) \u590d\u4e60\u7cfb\u6d6e\u5c42\u53cc\u8272\u8c03\u5206\u79bb\u2014\u2014\u6539\u7528\u7c7b\u9009\u62e9\u5668
    // \u9996\u8f6e\u7528[style*=color]\u5c5e\u6027\u9009\u62e9\u5668\u5931\u6548: \u672c\u5c42\u6587\u5b57\u8272\u5168\u8d70CSS\u7c7b(\u975e\u884c\u5185), \u63a2\u9488\u5b9e\u6d4b\u5df2\u8bc1
    ['#hr_center','#hr_flashcard'].forEach(function(ov){
      css+=_L+ov+'{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 60%,#e0e7ff 100%)!important}\n';
      css+=_L+ov+', '+_L+ov+' *{--pal-ink:#0f172a;--pal-ink-hi:#020617;--pal-ink-2:#334155;--pal-ink-3:#64748b}\n';
      /* \u5750\u5728\u6d45\u5e95\u4e0a\u7684\u5c42\u7ea7\u6587\u5b57 \u2192 \u58a8\u5b57\u7cfb */
      css+=_L+ov+' .hr_title,'+_L+ov+' .hr_wb_title{color:var(--pal-accent-text,#1e40af)!important}\n';
      css+=_L+ov+' .hr_sub,'+_L+ov+' .hr_wb_intro,'+_L+ov+' .lbl,'+_L+ov+' .hr_fc_progress{color:#475569!important}\n';
      css+=_L+ov+' .hr_section_title,'+_L+ov+' .hr_back,'+_L+ov+' .hr_wb_back{color:#334155!important}\n';
      css+=_L+ov+' .num{color:var(--pal-accent-text,#1e40af)!important}\n';
      css+=_L+ov+' .hr_btm_hint{color:#64748b!important}\n';
      /* \u5750\u5728\u5f69\u8272\u5361\u7247(\u91d1/\u7eff/\u7d2b\u7b49\u56fa\u5b9a\u6df1\u5e95)\u4e0a\u7684\u5b57 \u2192 \u4fdd\u6301\u6d45\u8272\u4e0d\u52a8 */
      css+=_L+ov+' .hr_card,'+_L+ov+' .hr_card *{color:#fff!important}\n';
      css+=_L+ov+' .hr_card .hr_card_cn{color:#fde047!important}\n';
      css+=_L+ov+' .hr_card .hr_card_tap_hint{color:rgba(255,255,255,.75)!important}\n';
      css+=_L+ov+' .hr_badge,'+_L+ov+' .hr_red_dot{color:#fff!important}\n';
      css+=_L+ov+' .hr_cal_m{color:#fff!important}\n';
      css+=_L+ov+' .hr_desc{color:rgba(255,255,255,.85)!important}\n';
      css+=_L+ov+' .hr_fc_top{color:#0f172a!important}\n';
      css+=_L+ov+' .hr_wb_item,'+_L+ov+' .hr_wb_count{color:#0f172a!important}\n';
      css+=_L+ov+' .hr_wb_cn{color:var(--pal-accent-text,#1e40af)!important}\n';
      /* \u534a\u900f\u767d\u5c0f\u5757 \u2192 \u6d45\u7070\u73bb\u7483 */
      css+=_L+ov+' [style*="background:rgba(255,255,255,.08)"],'+_L+ov+' [style*="background:rgba(255,255,255,.12)"]{background:rgba(15,23,42,.07)!important}\n';
      /* \u3010v991\u8865\u9057\xb7\u5ba1\u8ba1\u673a\u62d3\u51fa\u7684\u4e09\u5904\u6539\u9020\u526f\u4f5c\u7528\u3011 */
      /* 1) \u7edf\u8ba1\u5c0f\u5361\u534a\u900f\u6df1\u5e95 \u2192 \u6d45\u73bb\u7483(\u5426\u5219\u6df1\u5e95\u914d\u6df1\u5b57) */
      css+=_L+ov+' .hr_stat{background:rgba(255,255,255,.75)!important;border-color:rgba(15,23,42,.10)!important}\n';
      /* 2) \u65e5\u5386\u5361\u672c\u5c31\u767d\u5e95\u9ed1\u5b57: \u65e5\u671f\u6570\u5b57\u5fc5\u987b\u56de\u9ed1(\u88ab\u901a\u914dink\u6539\u767d\u4e86) */
      css+=_L+ov+' .hr_cal_d{color:#1c1c1e!important}\n';
      /* 3) \u5361\u5185\u91d1\u6570\u5b57\u5750\u6d45\u73bb\u7483 \u2192 \u6df1\u7425\u73c0\u4e14\u53bb\u6655 */
      css+=_L+ov+' .hr_stat .num{color:var(--pal-accent-text,#1e40af)!important;text-shadow:none!important}\n';
      css+=_L+ov+' .hr_stat .lbl{color:#475569!important}\n';
    });
    // v1165 错题总览(#hwo_overlay) 也翻成亮底黑字：首页横幅现在真的会打开它，以前亮色主题下深底配深字看不清
    css+=_L+'#hwo_overlay{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 60%,#e0e7ff 100%)!important}\n';
    css+=_L+'#hwo_overlay, '+_L+'#hwo_overlay *{--pal-ink:#0f172a;--pal-ink-hi:#020617;--pal-ink-2:#334155;--pal-ink-3:#64748b}\n';
    css+=_L+'#hwo_overlay .hwo_title{color:var(--pal-accent-text,#1e40af)!important}\n';
    css+=_L+'#hwo_overlay .hwo_sub,'+_L+'#hwo_overlay .hwo_btm,'+_L+'#hwo_overlay [style*="color:#94a3b8"]{color:#475569!important}\n';
    css+=_L+'#hwo_overlay [style*="color:#cbd5e1"]{color:#334155!important}\n';
    css+=_L+'#hwo_overlay [style*="color:#22c55e"]{color:#15803d!important}\n';
    css+=_L+'#hwo_overlay .hwo_back{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    css+=_L+'#hwo_overlay .hwo_island_card{background:rgba(255,255,255,.75)!important;border-color:rgba(15,23,42,.10)!important;color:#0f172a!important}\n';
    css+=_L+'#hwo_overlay .hwo_island_name{color:#0f172a!important}\n';
    css+=_L+'#hwo_overlay .hwo_island_hint{color:#475569!important}\n';
    /* 红色计数块 / 红总数卡 / 紫色「一起复习」本身是深色块：字保持浅色 */
    css+=_L+'#hwo_overlay .hwo_island_count,'+_L+'#hwo_overlay .hwo_island_count *,'+_L+'#hwo_overlay .hwo_total,'+_L+'#hwo_overlay .hwo_total *,'+_L+'#hwo_overlay .hwo_review_all,'+_L+'#hwo_overlay .hwo_review_all *{color:#fff!important}\n';
    css+=_L+'#hwo_overlay .hwo_total_n{color:#fde047!important}\n';
    // \U0001f534v992\u325d \u6211\u7684\u5b66\u4e60\u9875(#hsn-ml) \u771f\u53cc\u8272\u8c03\u5206\u79bb\u2014\u2014\u540c\u65cf\u6700\u540e\u4e00\u4e2a\u6df1\u5e95\u6d6e\u5c42
    // v988\u3257 \u66fe\u53ea\u6539\u6587\u5b57\u8272(\u5e95\u4ecd\u6df1\u7d2b) \u2192 \u5c9b\u5c7f\u540d\u6df1\u5b57\u538b\u6df1\u5e95\u5168\u7cca; \u672c\u7248\u6539\u4e3a\u6574\u5c42\u7ffb\u4eae
    css+=_L+'#hsn-ml{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#e0e7ff 100%)!important}\n';
    css+=_L+'#hsn-ml, '+_L+'#hsn-ml *{--pal-ink:#0f172a;--pal-ink-hi:#020617;--pal-ink-2:#334155;--pal-ink-3:#64748b}\n';
    /* \u5750\u6d45\u5e95\u7684\u5c42\u7ea7\u6587\u5b57 \u2192 \u58a8\u5b57\u7cfb */
    css+=_L+'#hsn-ml .hsn-ml-title{color:#0f172a!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-sec{color:#334155!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-empty{color:#64748b!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-foot,'+_L+'#hsn-ml .cnt{color:#4338ca!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-back{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    /* \u5c9b\u5c7f\u884c\u5361: \u534a\u900f\u767d\u5757\u2192\u6d45\u73bb\u7483, \u5c9b\u540d\u4e0e\u6570\u636e\u8f6c\u58a8 */
    css+=_L+'#hsn-ml .hsn-ml-isl{background:rgba(255,255,255,.75)!important;border-color:rgba(15,23,42,.10)!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-isl .nm{color:#0f172a!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-isl .ago{color:#64748b!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-isl .row2,'+_L+'#hsn-ml .hsn-ml-isl .l{color:#475569!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-isl .v{color:#0f172a!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-bar{background:rgba(15,23,42,.12)!important}\n';
    /* v1165: 「你的成长足迹」小字和每岛「0 / 42」数字以前还是深底用的浅紫/浅灰（亮色底上 1.4~1.8:1 看不清） */
    css+=_L+'#hsn-ml .hsn-ml-title small{color:#4338ca!important}\n';
    css+=_L+'#hsn-ml .hsn-ml-isl .row2 b{color:#0f172a!important}\n';
    /* \u5f69\u8272\u5361\u7247(\u6982\u89c8\u7d2b\u5361/\u7eff\u8272\u5b8c\u6210\u6761/\u91d1\u5361)\u5185\u767d\u5b57\u4fdd\u6301 */
    css+=_L+'#hsn-ml [style*="linear-gradient(135deg,#1e293b,#312e81)"] *,'+_L+'#hsn-ml [style*="linear-gradient(135deg,#064e3b,#065f46)"] *,'+_L+'#hsn-ml [style*="linear-gradient(135deg,#7c2d12,#9a3412)"] *{color:#fff!important}\n';
    css+=_L+'#hsn-ml [style*="linear-gradient(135deg,#1e293b,#312e81)"] .hsn-ml-bignum{color:#fde047!important}\n';
    css+=_L+'#hsn-ml [style*="linear-gradient(135deg,#1e293b,#312e81)"] .hsn-ml-biglbl{color:#cbd5e1!important}\n';
    // \U0001f534v993\u325e \u6781\u901f\u6a21\u5f0f\u9009\u9879\u4e0e\u96be\u5ea6\u6807\u7b7e \u53cc\u8272\u8c03\u5206\u79bb
    // \u7528\u6237\u771f\u673a\u62a5: \u2460\u7b54\u5bf9\u9ad8\u4eae\u683c\u6210\u767d\u6846(\u5e95\u7ffb\u767d\u4f46\u5b57\u4e5f\u6d45=\u767d\u5e95\u767d\u5b57) \u2461\u7ea2\u8272\u96be\u5ea6\u6807\u7b7e\u5185\u6df1\u5b57
    // \u9009\u9879\u5e38\u6001: \u4eae\u5e95\u58a8\u5b57(\u539f\u4e3a\u6df1\u5e95\u6d45\u5b57)
    css+=_L+'.boss-opt{background:linear-gradient(135deg,#ffffff,#f1f5f9)!important;border-color:#94a3b8!important;color:#0f172a!important}\n';
    // \u7b54\u5bf9: \u6d45\u7eff\u5e95 + \u6df1\u7eff\u5b57(\u4fee\u767d\u6846\u4e8b\u6545)
    css+=_L+'.boss-opt.correct{background:linear-gradient(135deg,#dcfce7,#bbf7d0)!important;border-color:#16a34a!important;color:#14532d!important}\n';
    // \u7b54\u9519: \u6d45\u7ea2\u5e95 + \u6df1\u7ea2\u5b57
    css+=_L+'.boss-opt.wrong{background:linear-gradient(135deg,#fee2e2,#fecaca)!important;border-color:#dc2626!important;color:#7f1d1d!important}/*HSN-RED-OK 答错语义*/\n';
    // \u96be\u5ea6\u6807\u7b7e(\u6613/\u4e2d/\u9ad8\u4e09\u8272\u6e10\u53d8\u5e95\u56fa\u5b9a\u6df1) \u2192 \u5b57\u6052\u767d\u514d\u6655
    /* \u96be\u5ea6\u6807\u7b7e\u7b49"\u6e10\u53d8\u5e95+\u884c\u5185\u767d\u5b57"\u5c0f\u80f6\u56ca: \u4e0d\u4f9d\u8d56\u5177\u4f53\u8272\u503c\u7684\u7a33\u5065\u5199\u6cd5
       \u884c\u5185\u540c\u65f6\u5199\u4e86 linear-gradient \u4e0e color:#fff \u7684\u5143\u7d20 = \u8bbe\u8ba1\u4e0a\u5c31\u662f\u5f69\u5e95\u767d\u5b57, \u767d\u5b57\u4e0d\u5f97\u88ab\u94a9\u6df1 */
    var _LS='html[class*="hsn-pal-"].hsn-pal-light ';
    css+=_LS+'[style*="linear-gradient"][style*="color:#fff"]{color:#fff!important;text-shadow:0 1px 2px rgba(0,0,0,.25)!important}\n';
    css+=_LS+'[style*="linear-gradient"][style*="color:#fff"] *{color:#fff!important}\n';
    // \u6781\u901f\u5c4f\u9898\u9762\u82f1\u6587\u5927\u5b57(\u884c\u5185#fff) \u2192 \u58a8\u5b57
    /* \u9898\u9762\u82f1\u6587\u5927\u5b57\u8f6c\u58a8: \u4ec5\u9650 #spQ \u5185(\u907f\u514d\u8bef\u4f24\u540c\u5c4f\u5f69\u5e95\u767d\u5b57\u6807\u7b7e\u2014\u2014v993\u9996\u8f6e\u81ea\u6211\u51b2\u7a81\u5df2\u8bc1) */
    css+=_L+'#spQ > [style*="color:#fff"]{color:#0f172a!important}\n';
    // \U0001f534v995\u3261 \u6ce1\u6ce1\u5927\u4f5c\u6218 \u4eae\u8272\u8c03\u6574\u4f53\u88c5\u4fee(\u7528\u6237\u62a5\u4e09\u75c5)
    // \u2460 \u6ce1\u6ce1\u5185\u5355\u8bcd\u6062\u590d\u767d\u5b57: .bubble \u5199 var(--pal-ink) \u2192 \u4eae\u677f\u53d8\u58a8\u8272\u538b\u5f69\u8272\u6ce1\u6ce1
    css+=_LS+'.bubble{color:#fff!important;text-shadow:0 2px 5px rgba(0,0,0,.55),0 0 2px rgba(0,0,0,.4)!important}\n';
    // \u2461 \u72b6\u6001\u6761\u7070\u767d\u5e95\u6839\u6cbb: \u534a\u900f\u6df1\u5e95 \u2192 \u6e05\u723d\u767d\u5361+\u8f6f\u9634\u5f71(\u7528\u6237\u591a\u6b21\u62a5\u7070\u5e95\u96be\u770b)
    css+=_LS+'.bubble-stats .bs-item{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;color:#334155!important;box-shadow:0 2px 6px rgba(15,23,42,.08)!important}\n';
    /* \u5b57\u5728\u5b50\u5143\u7d20\u4e0a(\u9996\u8f6e\u9057\u6f0f\u2192\u767d\u5b57\u538b\u767d\u5e95), \u9700\u9010\u5c42\u63a5\u7ba1; \u5fbd\u7ae0\u9664\u5916 */
    css+=_LS+'.bubble-stats .bs-item:not(#bbLvlBadge) *{color:#334155!important;text-shadow:none!important}\n';
    css+=_LS+'.bubble-stats .bs-item b{color:var(--pal-accent-text,#1e40af)!important}\n';
    // \u2462 \u96be\u5ea6\u5fbd\u7ae0(\u5f69\u5e95)\u4fdd\u767d\u5b57
    css+=_LS+'#bbLvlBadge{color:#fff!important;border-color:transparent!important;box-shadow:0 2px 8px rgba(220,38,38,.28)!important}\n';
    // \u2463 \u6ce1\u6ce1\u6c60\u5e95: \u6df1\u9752\u2192\u6e05\u6f88\u6d77\u6c34\u84dd(\u4eae\u677f\u66f4\u8f7b\u76c8), \u4fdd\u7559\u6df1\u5ea6\u611f\u4f7f\u5f69\u8272\u6ce1\u6ce1\u4ecd\u7a81\u51fa
    css+=_LS+'.bubble-area{background:linear-gradient(180deg,#38bdf8 0%,#0ea5e9 45%,#0284c7 100%)!important;box-shadow:0 6px 20px rgba(2,132,199,.18)!important}\n';
    // \u2464 \u9898\u9762\u63d0\u793a\u6761: \u9ed1\u80f6\u56ca\u2192\u767d\u5361\u6df1\u5b57(\u4e0e\u6d45\u84dd\u6c60\u9762\u6210\u5bf9\u6bd4)
    css+=_LS+'.bubble-prompt{background:rgba(255,255,255,.96)!important;color:#0f172a!important;box-shadow:0 4px 16px rgba(15,23,42,.18)!important}\n';
    css+=_LS+'.bubble-prompt *{color:#0f172a!important}\n';
    // \U0001f534v999\u3265 \u5b57\u6bcd\u62fc\u62fc\u4e50 \u4eae\u8272\u8c03\u6574\u4f53\u88c5\u4fee(\u7528\u6237\u62a5\u4e09\u75c5)
    // \u2460 \u5b57\u6bcd\u5757\u9ed1\u5b57: .scramble-letter \u5199 var(--pal-ink) \u2192 \u4eae\u677f\u53d8\u58a8\u538b\u7d2b\u5757
    css+=_LS+'.scramble-letter{color:#fff!important;text-shadow:0 1px 3px rgba(0,0,0,.35)!important}\n';
    // \u2461 \u4e2d\u6587\u5757\u8dd1\u5230\u6700\u5de6: inline-block \u65e0\u5c45\u4e2d\u7236\u5bb9\u5668 \u2192 \u81ea\u8eab\u5c45\u4e2d(\u4e0d\u52a8\u6a21\u677f)
    css+='.scramble-cn{display:block!important;width:fit-content!important;margin-left:auto!important;margin-right:auto!important}\n';
    // \u540c\u75c5\u540c\u6cbb: \u8fdb\u5ea6\u6761\u4e5f\u662f inline-block
    css+='.scramble-progress{display:block!important;width:fit-content!important;margin-left:auto!important;margin-right:auto!important}\n';
    // \u2462 \u4e2d\u6587\u5757\u4eae\u8272\u88c5\u4fee: \u6df1\u5e95\u91d1\u5b57 \u2192 \u767d\u5361\u58a8\u5b57+\u8f6f\u9634\u5f71
    css+=_LS+'.scramble-cn{background:#ffffff!important;color:#0f172a!important;border:1px solid rgba(15,23,42,.10)!important;box-shadow:0 2px 8px rgba(15,23,42,.10)!important}\n';
    // \u2463 \u5b57\u6bcd\u69fd(\u865a\u7ebf\u683c): \u6df1\u5e95 \u2192 \u6d45\u5361, \u5df2\u586b\u5b57\u6bcd\u8f6c\u58a8
    css+=_LS+'.scramble-slot{background:rgba(255,255,255,.85)!important;border-color:#94a3b8!important;color:#1e3a8a!important}\n';
    // \u2464 \u63d0\u793a\u884c
    css+=_LS+'.scramble-hint{color:#475569!important}\n';
    // \U0001f534v996\u3262 \u5b8c\u5f62\u586b\u7a7a \u4eae\u8272\u8c03\u6574\u4f53\u88c5\u4fee(\u7528\u6237\u62a5\u4e24\u75c5)
    // \u2460 \u53e5\u5b50\u5361\u7070\u5e95\u6839\u6cbb: rgba(30,41,59,.6) \u534a\u900f\u6df1\u5e95 \u2192 \u767d\u5361\u6df1\u5b57(\u540c\u6ce1\u6ce1\u72b6\u6001\u6761\u75c5\u56e0)
    css+=_LS+'.cloze-sentence{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;color:#0f172a!important;box-shadow:0 3px 10px rgba(15,23,42,.08)!important}\n';
    css+=_LS+'.cloze-sentence *{color:#0f172a!important}\n';
    // \u7a7a\u767d\u6a2a\u7ebf\u4fdd\u6301\u9192\u76ee(\u91d1\u2192\u6df1\u6a59, \u4eae\u5e95\u4e0a\u624d\u770b\u5f97\u89c1)
    css+=_LS+'.cloze-sentence .cloze-blank{color:#1e3a8a!important;border-bottom-color:#f59e0b!important}\n';
    // \u2461 \u3010\u529f\u80fd\u6027\u3011\u76ee\u6807\u8bcd\u4e2d\u6587\u9ad8\u4eae: \u91d1\u5b57#fbbf24\u538b\u6d45\u5e95\u51e0\u4e4e\u770b\u4e0d\u89c1
    // \u2192 \u6539\u4e3a\u9c9c\u660e\u6d0b\u7ea2+\u6de1\u9ec4\u5e95\u6807\u8bb0, \u50cf\u8367\u5149\u7b14\u4e00\u6837\u4e00\u773c\u5c31\u770b\u5230"\u8003\u54ea\u4e2a\u8bcd"
    css+=_LS+'.cloze-cn{color:#334155!important}\n';
    css+=_LS+'.cloze-cn [style*="color:#fbbf24"]{color:#1e3a8a!important;background:linear-gradient(180deg,transparent 52%,#fde68a 52%)!important;padding:0 4px!important;border-radius:3px!important;font-weight:900!important}\n';
    // \u2462 \u9009\u9879\u4e09\u6001(\u5e38\u6001\u5df2\u662f\u6d45\u5361, \u53ea\u4fee\u5bf9/\u9519)
    css+=_LS+'.cloze-opt.correct{background:linear-gradient(135deg,#dcfce7,#bbf7d0)!important;border-color:#16a34a!important;color:#14532d!important}\n';
    css+=_LS+'.cloze-opt.wrong{background:linear-gradient(135deg,#fee2e2,#fecaca)!important;border-color:#dc2626!important;color:#7f1d1d!important}/*HSN-RED-OK 答错语义*/\n';
    // \U0001f534v1002\u3263 \u62fc\u5199\u8702\u4e2a\u4eba\u8d44\u6599\u9875(#hsb_prof) \u771f\u53cc\u8272\u8c03\u5206\u79bb
    // \u5efa\u5c42\u5373\u5efa\u5408\u540c: \u4eae\u8272\u8c03=\u4eae\u5e95\u58a8\u5b57, \u6697\u8272\u8c03=\u6df1\u5e95\u6d45\u5b57(\u6a21\u5757\u81ea\u5e26)
    css+=_LS+'#hsb_prof{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#e0e7ff 100%)!important;color:#0f172a!important}\n';
    css+=_LS+'#hsb_prof .pf_ttl,'+_LS+'#hsb_prof .pf_name{color:#0f172a!important}\n';
    css+=_LS+'#hsb_prof .pf_back{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    css+=_LS+'#hsb_prof .pf_card{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;box-shadow:0 2px 8px rgba(15,23,42,.06)!important}\n';
    css+=_LS+'#hsb_prof .pf_it{background:rgba(15,23,42,.05)!important}\n';
    css+=_LS+'#hsb_prof .pf_v{color:#0f172a!important}\n';
    css+=_LS+'#hsb_prof .pf_l,'+_LS+'#hsb_prof .pf_sec,'+_LS+'#hsb_prof .pf_hint,'+_LS+'#hsb_prof .pf_empty,'+_LS+'#hsb_prof .pf_tag{color:#475569!important;opacity:1!important}\n';
    // \u91d1\u5b57\u7cfb\u2192\u9753\u84dd\u5f3a\u8c03(\u7981\u7ea2\u89c4\u8303\u4e0b\u7684\u4e3b\u5f3a\u8c03\u8272)
    css+=_LS+'#hsb_prof .pf_tier,'+_LS+'#hsb_prof .pf_hero .pf_v{color:var(--pal-accent-text,#1e3a8a)!important}\n';
    css+=_LS+'#hsb_prof .pf_bar{background:rgba(15,23,42,.12)!important}\n';
    css+=_LS+'#hsb_prof .pf_ava{background:radial-gradient(circle at 50% 42%,rgba(15,23,42,.10),rgba(15,23,42,.04) 65%,transparent 74%)!important}\n';
    css+=_LS+'#hsb_prof .pf_slot{background:rgba(15,23,42,.05)!important;border-color:rgba(15,23,42,.20)!important;color:#334155!important}\n';
    css+=_LS+'#hsb_prof .pf_slot.has{background:rgba(30,58,138,.10)!important;border-color:rgba(30,58,138,.42)!important}\n';
    css+=_LS+'#hsb_prof .pf_btn{color:#fff!important}\n';
    // \U0001f534v1002\u3264 \u62fc\u5199\u5927PK \u9875(spelling_pk.html) \u53cc\u8272\u8c03
    css+=_LS+'body{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#e0e7ff 100%)!important}\n';
    css+=_LS+'.pk_h1,'+_LS+'.pk_nm,'+_LS+'.pk_rn,'+_LS+'.pk_v{color:#0f172a!important}\n';
    css+=_LS+'.pk_sub,'+_LS+'.pk_l,'+_LS+'.pk_rm,'+_LS+'.pk_sec,'+_LS+'.pk_empty,'+_LS+'.pk_cid{color:#475569!important;opacity:1!important}\n';
    css+=_LS+'.pk_back{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    css+=_LS+'.pk_me,'+_LS+'.pk_row,'+_LS+'.pk_note{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;color:#334155!important;box-shadow:0 2px 8px rgba(15,23,42,.06)!important}\n';
    css+=_LS+'.pk_it{background:rgba(15,23,42,.05)!important}\n';
    css+=_LS+'.pk_tier{color:var(--pal-accent-text,#1e3a8a)!important}\n';
    css+=_LS+'.pk_prov{background:rgba(15,23,42,.09)!important;color:#475569!important}\n';
    css+=_LS+'.pk_ava{background:radial-gradient(circle at 50% 42%,rgba(15,23,42,.10),rgba(15,23,42,.04) 65%,transparent 74%)!important}\n';
    // \u5f69\u5e95\u5361\u4e0e\u6309\u94ae\u5185\u767d\u5b57\u4fdd\u6301
    css+=_LS+'.pk_card,'+_LS+'.pk_card *,'+_LS+'.pk_btn,'+_LS+'.pk_join{color:#fff!important}\n';
    // \U0001f534v1016 \u8d26\u53f7\u533a\u53cc\u8272\u8c03
    css+=_LS+'.pk_ab{background:rgba(15,23,42,.06)!important;color:#334155!important;border-color:rgba(15,23,42,.14)!important}\n';
    css+=_LS+'.pk_ab.primary,'+_LS+'.pk_ab.primary *{color:#fff!important}\n';
    css+=_LS+'.pk_acct_tip{color:#475569!important;opacity:1!important}\n';
    // \U0001f534v1022 \u62fc\u5199\u5927PK \u9875\u9762\u5185\u5c4f\u53cc\u8272\u8c03
    css+=_LS+'#hsn_pk_screen{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#e0e7ff 100%)!important;color:#0f172a!important}\n';
    css+=_LS+'#hsn_pk_screen .k_h1,'+_LS+'#hsn_pk_screen .k_nm,'+_LS+'#hsn_pk_screen .k_v{color:#0f172a!important}\n';
    css+=_LS+'#hsn_pk_screen .k_sub,'+_LS+'#hsn_pk_screen .k_l,'+_LS+'#hsn_pk_screen .k_sec,'+_LS+'#hsn_pk_screen .k_cid,'+_LS+'#hsn_pk_screen .k_tip{color:#475569!important;opacity:1!important}\n';
    css+=_LS+'#hsn_pk_screen .k_back,'+_LS+'#hsn_pk_screen .k_ab{background:rgba(15,23,42,.06)!important;color:#334155!important;border-color:rgba(15,23,42,.14)!important}\n';
    css+=_LS+'#hsn_pk_screen .k_me,'+_LS+'#hsn_pk_screen .k_note{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;color:#334155!important;box-shadow:0 2px 8px rgba(15,23,42,.06)!important}\n';
    css+=_LS+'#hsn_pk_screen .k_it{background:rgba(15,23,42,.05)!important}\n';
    css+=_LS+'#hsn_pk_screen .k_tier{color:var(--pal-accent-text,#1e3a8a)!important}\n';
    css+=_LS+'#hsn_pk_screen .k_ava{background:radial-gradient(circle at 50% 42%,rgba(15,23,42,.10),rgba(15,23,42,.04) 65%,transparent 74%)!important}\n';
    // \u5f69\u5e95\u5361\u4e0e\u4e3b\u6309\u94ae\u5185\u767d\u5b57\u4fdd\u7559
    css+=_LS+'#hsn_pk_screen .k_card,'+_LS+'#hsn_pk_screen .k_card *,'+_LS+'#hsn_pk_screen .k_ab.primary{color:#fff!important}\n';
    // \U0001f534v1004\u3265 \u767b\u5f55\u9762\u677f\u53cc\u8272\u8c03
    css+=_LS+'#hsn_auth_panel .au_card{background:#ffffff!important;color:#0f172a!important}\n';
    css+=_LS+'#hsn_auth_panel .au_t,'+_LS+'#hsn_auth_panel .au_lb{color:#0f172a!important;opacity:1!important}\n';
    css+=_LS+'#hsn_auth_panel .au_x,'+_LS+'#hsn_auth_panel .au_send{background:rgba(15,23,42,.08)!important;color:#334155!important}\n';
    css+=_LS+'#hsn_auth_panel .au_tab{background:rgba(15,23,42,.05)!important;color:#475569!important;border-color:rgba(15,23,42,.12)!important}\n';
    css+=_LS+'#hsn_auth_panel .au_tab.on,'+_LS+'#hsn_auth_panel .au_go{color:#fff!important}\n';
    css+=_LS+'#hsn_auth_panel .au_in{background:#f8fafc!important;color:#0f172a!important;border-color:rgba(15,23,42,.18)!important}\n';
    css+=_LS+'#hsn_auth_panel .au_tip{color:#64748b!important;opacity:1!important}\n';
    // \U0001f534v1007\u3266 \u6253\u5730\u9f20\u4eae\u8272\u8c03\u6574\u4f53\u91cd\u914d(\u7528\u6237\u62a5"\u9ed1\u4e0d\u9686\u51ac\u4ec0\u4e48\u90fd\u770b\u4e0d\u6e05")
    // \u539f: \u573a\u5730\u6df1\u58a8\u7eff #365314\u2192#1a2e05 / \u6d1e\u8fd1\u4e4e\u5168\u9ed1 #3f2317\u2192#1c0e05
    // \u65b0: \u9633\u5149\u8349\u576a + \u6d45\u8272\u571f\u6d1e, \u4fdd\u7559\u6df1\u5ea6\u611f\u4f46\u6574\u4f53\u660e\u4eae
    css+=_LS+'.moles-grid{background:linear-gradient(180deg,#bbf7d0 0%,#86efac 45%,#4ade80 100%)!important;border-color:#22c55e!important;box-shadow:inset 0 2px 10px rgba(255,255,255,.55),0 6px 18px rgba(22,163,74,.22)!important}\n';
    // \u6d1e\u53e3: \u6d45\u6c99\u571f\u8272 + \u5185\u9634\u5f71\u505a\u51fa\u51f9\u9677\u611f(\u4e0d\u9760\u53d8\u9ed1)
    // \U0001f534v1040 \u5730\u9f20\u6d1e\u6539\u767d\u5e95\u9ed1\u5b57
    // v1010 \u4e3a\u4e86"\u51f9\u9677\u7acb\u4f53\u611f"\u7528\u4e86\u91d1\u9ec4\u6e10\u53d8, \u4f46\u91d1\u5e95\u672c\u8eab\u4e0d\u5229\u4e8e\u770b\u6e05\u5185\u5bb9\u3002
    // \u6539\u4e3a\u767d\u5e95 + \u8f7b\u5185\u9634\u5f71 + \u6de1\u8fb9\u6846: \u7acb\u4f53\u611f\u9760\u9634\u5f71\u800c\u975e\u9760\u989c\u8272, \u5185\u5bb9\u6700\u6e05\u695a\u3002
    css+=_LS+'.mole-slot{background:radial-gradient(ellipse at center bottom,#ffffff 0%,#f8fafc 62%,#eef2f7 100%)!important;box-shadow:inset 0 5px 12px rgba(15,23,42,.14),inset 0 -2px 6px rgba(255,255,255,.9),0 2px 6px rgba(15,23,42,.08)!important;border:2px solid rgba(15,23,42,.14)!important}\n';
    // \u6d1e\u5185\u6587\u5b57\u4e0e emoji: \u767d\u5e95\u4e0a\u4e00\u5f8b\u58a8\u9ed1
    css+=_LS+'.mole-slot .mole-cn,'+_LS+'.mole-cn{background:transparent!important;color:#0f172a!important;text-shadow:none!important;box-shadow:none!important;font-weight:800!important}\n';
    css+=_LS+'.mole-slot .mole-emoji,'+_LS+'.mole-emoji{filter:drop-shadow(0 2px 3px rgba(15,23,42,.22))!important}\n';
    // \U0001f534v1042\u3268 \u6bcf\u65e5\u4efb\u52a1\u5361: \u9886\u53d6/\u5b8c\u6210\u540e\u53d8\u6df1\u7eff\u5e95(#052e16\u2192#14532d),
    // \u800c\u4eae\u8272\u8c03\u4e0b\u6587\u5b57\u5df2\u8f6c\u6df1\u8272 \u2192 \u6df1\u5e95\u6df1\u5b57, \u5b8c\u5168\u770b\u4e0d\u6e05\u3002
    css+=_LS+'.quest-card{background:#ffffff!important;border:1px solid rgba(15,23,42,.10)!important;box-shadow:0 2px 8px rgba(15,23,42,.06)!important}\n';
    css+=_LS+'.quest-card.done{background:linear-gradient(135deg,#dcfce7,#bbf7d0)!important;border-color:#22c55e!important}\n';
    css+=_LS+'.quest-card .quest-title,'+_LS+'.quest-card.done .quest-title{color:#0f172a!important}\n';
    css+=_LS+'.quest-card .quest-progress-text,'+_LS+'.quest-card.done .quest-progress-text{color:#334155!important}\n';
    css+=_LS+'.quest-card .quest-desc,'+_LS+'.quest-card.done .quest-desc{color:#475569!important}\n';
    // \u8fdb\u5ea6\u69fd\u5e95\u8272: \u9ed1\u534a\u900f \u2192 \u6d45\u7070, \u4e0d\u7136\u767d\u5361\u4e0a\u4e00\u6761\u9ed1\u69fd\u5f88\u810f
    css+=_LS+'.quest-progress-bar{background:rgba(15,23,42,.10)!important}\n';
    // \u5956\u52b1\u80f6\u56ca: \u91d1\u5b57\u5728\u767d\u5e95\u4e0a\u770b\u4e0d\u6e05 \u2192 \u91d1\u5e95\u767d\u5b57
    css+=_LS+'.quest-reward{background:linear-gradient(135deg,#fef3c7,#fde68a)!important;color:#0f172a!important;border:1px solid rgba(217,119,6,.35)!important}\n';/*\u91d1\u5e95\u767d\u5b57\u53ea\u6709 2.15:1, \u6539\u6d45\u91d1\u5e95+\u58a8\u5b57*/
    css+=_LS+'.quest-reward.claimed{background:rgba(15,23,42,.08)!important;color:#475569!important}\n';
    // \u5f69\u5e95\u6309\u94ae\u5185\u767d\u5b57\u4fdd\u7559
    css+=_LS+'.quest-card .game-btn,'+_LS+'.quest-card button.claim,'+_LS+'.quest-claim-btn{color:#fff!important}\n';
    // \u5730\u9f20\u4e2d\u6587\u540d: \u9ed1\u5e95\u767d\u5b57 \u2192 \u767d\u5e95\u58a8\u5b57(\u6d45\u6d1e\u4e0a\u624d\u770b\u5f97\u6e05)
    css+=_LS+'.mole-cn{background:rgba(255,255,255,.94)!important;color:#0f172a!important;text-shadow:none!important;box-shadow:0 1px 3px rgba(15,23,42,.18)!important}\n';
    // emoji \u91cd\u9ed1\u6655 \u2192 \u8f7b\u67d4\u5f71
    css+=_LS+'.mole-emoji{filter:drop-shadow(0 2px 4px rgba(120,53,15,.34))!important}\n';
    // \u72b6\u6001\u6761\u4e0e\u5f97\u5206
    css+=_LS+'.moles-stats{color:#334155!important}\n';
    css+=_LS+'.moles-stats b{color:var(--pal-accent-text,#1e3a8a)!important}\n';
    /* \U0001f534v1010\u3267 \u6253Boss \u914d\u8272\u5f52 hansen_boss_theme.js \u5355\u4e00\u7ba1\u8f96\u3002
       \u672c\u6b21\u66fe\u5728\u5f15\u64ce\u91cc\u53e6\u5199\u4e00\u5957 Boss \u4eae\u8272\u89c4\u5219, \u7ed3\u679c\u4e0e\u4e3b\u9898\u7cfb\u7edf\u91cd\u53e0\u5e76
       \u7834\u574f\u4e86"\u7528\u6237\u9009\u5b9a\u7684 Boss \u4e3b\u9898\u5e94\u72ec\u7acb\u4e8e\u5168\u5c40\u8272\u8c03"\u8fd9\u4e00\u5951\u7ea6(hf7 \u5f53\u573a\u62d3\u51fa)\u3002
       \u6b63\u786e\u505a\u6cd5: \u4e3b\u9898\u7cfb\u7edf\u5728\u7528\u6237\u672a\u663e\u5f0f\u9009\u62e9\u65f6\u8ddf\u968f\u5168\u5c40\u8272\u8c03(\u89c1 cur()), \u5f15\u64ce\u4e0d\u518d\u63d2\u624b\u3002 */
    // \U0001f534v1010: \u6d45\u8584\u8377\u7eff #bbf7d0 \u538b\u767d\u5e95 \u5bf9\u6bd4\u5ea6\u4ec5 1.03(\u7b49\u4e8e\u9690\u5f62)
    // \u5ba1\u8ba1\u673a\u5728\u8bbe\u7f6e\u9875/\u6211\u7684\u5b66\u4e60/\u9519\u9898\u603b\u89c8\u4e09\u5904\u62d3\u51fa; \u5f69\u5e95\u5361\u5185\u7684\u6d45\u7eff\u4e0d\u53d7\u5f71\u54cd
    css+=_LS+'[style*="color:#bbf7d0"]:not(.boss-opt):not(.boss-opt *){color:#15803d!important}\n';
    /* v1165: 揭晓卡在亮色主题下仍是深绿底，音标用深绿等于看不见(实测)；改回浅薄荷绿 */
    css+=_LS+'.listen-reveal .lr-pn{color:#bbf7d0!important}\n';
    /* \u4f46\u5f69\u5e95\u5361\u7247\u5185\u7684\u6d45\u7eff\u8981\u4fdd\u7559\u2014\u2014\u5b83\u672c\u6765\u5c31\u538b\u5728\u7eff\u6e10\u53d8\u4e0a\uff0c
       \u8f6c\u6df1\u7eff\u53cd\u800c\u53d8\u6210\u7eff\u5e95\u7eff\u5b57(\u5ba1\u8ba1\u673a\u5b9e\u6d4b 1.82)\u3002\u540e\u4f4d\u540e\u4ee3\u9009\u62e9\u5668\u7279\u5f02\u6027\u66f4\u9ad8\uff0c\u53ef\u590d\u4f4d\u3002 */
    css+=_LS+'[style*="linear-gradient"] [style*="color:#bbf7d0"]{color:#bbf7d0!important}\n';
    // \U0001f534v1013\u3268 \u5355\u8bcd\u5927\u9646\u62bd\u5361\u6574\u5c4f\u91cd\u505a(\u7528\u6237\u62a5"\u7070\u5e95\u7070\u5b57\u5b8c\u5168\u770b\u4e0d\u6e05")
    // \u539f: \u5361\u7247 rgba(30,41,59,.5) \u534a\u900f\u6df1\u5e95 + \u6d45\u5b57 \u2192 \u4eae\u677f\u5e95\u88ab\u94a9\u6210\u7070\u3001\u5b57\u4ecd\u6d45
    // \u65b0: \u767d\u5361 + \u8f6f\u9634\u5f71 + \u58a8\u5b57(\u7528\u6237\u591a\u6b21\u660e\u786e: \u4e0d\u8981\u7070\u5e95)
    css+=_LS+'#landGachaBody{background:linear-gradient(180deg,#f5f3ff 0%,#eef2ff 55%,#f8fafc 100%)!important;color:#0f172a!important}\n';
    css+=_LS+'#landGachaBody [style*="background:rgba(30,41,59,.5)"],'+_LS+'#landGachaBody [style*="background:rgba(30,41,59,0.5)"]{background:#ffffff!important;border:1px solid rgba(15,23,42,.09)!important;box-shadow:0 3px 12px rgba(76,29,149,.09)!important}\n';
    // \u6587\u5b57\u5c42\u7ea7
    css+=_LS+'#landGachaBody [style*="color:#fff"]:not([style*="linear-gradient"]){color:#0f172a!important}\n';
    css+=_LS+'#landGachaBody [style*="color:#e2e8f0"],'+_LS+'#landGachaBody [style*="color:#cbd5e1"]{color:#334155!important}\n';
    css+=_LS+'#landGachaBody [style*="color:#94a3b8"],'+_LS+'#landGachaBody [style*="color:#64748b"]{color:#475569!important}\n';
    // \u7a00\u6709\u5ea6\u8272: \u6de1\u8272\u7cfb\u5728\u767d\u5e95\u4e0a\u9690\u5f62 \u2192 \u540c\u8272\u7cfb\u52a0\u6df1(\u4fdd\u7559\u8fa8\u8bc6\u5ea6)
    css+=_LS+'#landGachaBody [style*="color:#6ee7b7"]{color:#047857!important}\n';
    css+=_LS+'#landGachaBody [style*="color:#c4b5fd"],'+_LS+'#landGachaBody [style*="color:#a78bfa"],'+_LS+'#landGachaBody [style*="color:#e9d5ff"]{color:#6d28d9!important}\n';
    css+=_LS+'#landGachaBody [style*="color:#f472b6"]{color:#a21caf!important}\n';
    // \u81f3\u5c0a\u91d1: \u767d\u5e95\u4e0a\u91d1\u5b57\u5fc5\u7cca\u4e14\u6df1\u91d1\u5c5e\u7981\u8272 \u2192 \u6539\u91d1\u5e95\u767d\u5b57\u80f6\u56ca, \u4fdd\u4f4f\u201c\u8d35\u6c14\u201d
    css+=_LS+'#landGachaBody [style*="color:#fbbf24"],'+_LS+'#landGachaBody [style*="color:#fde047"]{color:#fff!important;background:linear-gradient(135deg,#f59e0b,#d97706)!important;padding:1px 8px!important;border-radius:999px!important;text-shadow:0 1px 2px rgba(15,23,42,.32)!important}\n';
    // \u5165\u53e3\u6a2a\u5e45\u526f\u6807\u9898(\u7d2b\u5e95\u4e0a\u7684\u6de1\u7070\u5b57)
    css+=_LS+'.lg-banner{color:#fff!important}\n';
    css+=_LS+'.lg-banner *{color:rgba(255,255,255,.94)!important}\n';
    css+=_LS+'.lg-banner b,'+_LS+'.lg-banner strong{color:#fff!important}\n';
    // \U0001f534v1014\u3269 Boss \u7ed3\u7b97\u9875\u6807\u9898(\u6218\u8d25/\u80dc\u5229)
    // \u539f\u4e3a"\u6e10\u53d8\u586b\u5145\u6587\u5b57"(background-clip:text + text-fill-color:transparent),
    // \u4eae\u8272\u8c03\u4e0b\u586b\u5145\u8272\u88ab\u6539\u6210\u5b9e\u8272\u800c\u91cd\u6655\u8fd8\u5728 \u2192 \u6807\u9898\u80cc\u540e\u4e00\u56e2\u6df1\u8272\u6c61\u8ff9\u3002
    // \u4eae\u677f\u6539\u4e3a: \u5b9e\u8272\u6df1\u9753\u84dd + \u5f7b\u5e95\u53bb\u6655, \u5e72\u51c0\u53ef\u8bfb\u3002
    css+=_LS+'.boss-victory h2{background:none!important;-webkit-background-clip:initial!important;background-clip:initial!important;-webkit-text-fill-color:#1e3a8a!important;color:#1e3a8a!important;text-shadow:none!important;filter:none!important}\n';
    css+=_LS+'.boss-victory{color:#334155!important}\n';
    css+=_LS+'.boss-victory [style*="color:#cbd5e1"]{color:#475569!important}\n';
    // \u7ed3\u7b97\u9875\u6309\u94ae\u5185\u767d\u5b57\u4fdd\u7559
    css+=_LS+'.boss-victory .game-btn,'+_LS+'.boss-victory .game-btn *{color:#fff!important}\n';
    // \U0001f534v1016 \u4eae\u8272\u8c03\u53ef\u8bfb\u6027\u5b9e\u6d4b\u6574\u6539(23\u5c4f\u9010\u5b57\u6d4b\u5408\u6210\u540e\u5bf9\u6bd4\u5ea6\u540e\u62d3\u51fa)
    // \u2460 \u9876\u680f\u300c\u6253\u5361\u5929\u6570\u300d\u6570\u5b57: \u6d45\u91d1 #fcd34d \u538b\u767d\u5e95 = 1.44:1(\u51e0\u4e4e\u9690\u5f62)
    css+=_LS+'.hsn-streak-inline span{color:var(--pal-accent-text,#1e3a8a)!important}\n';
    css+=_LS+'.hsn-streak-inline{color:#475569!important}\n';
    // \u2462 \u64e6\u8fb9\u9879: \u767d\u5b57\u538b\u9753\u84dd\u8fd4\u56de\u952e 4.0:1 \u2192 \u5e95\u8272\u52a0\u6df1\u81f3\u8fbe\u6807
    css+=_LS+'.back-btn{background:linear-gradient(135deg,#4338ca,#3730a3)!important;color:#fff!important}\n';
    css+=_LS+'.back-btn *{color:#fff!important}\n';
    // \u2463 \u5c4f\u5e55\u6807\u9898: \u91d1\u8272\u6e10\u53d8\u6587\u5b57\u538b\u6d45\u5e95 1.6:1(27\u5904) \u2192 \u6539\u6df1\u9753\u84dd\u6e10\u53d8
    css+=_LS+'.screen-title{background:linear-gradient(90deg,#1e3a8a,#3730a3)!important;-webkit-background-clip:text!important;background-clip:text!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}\n';
    // \u2464 \u6de1\u91d1\u5b57\u538b\u91d1\u5e95(\u80f6\u56ca\u5185) \u2192 \u767d\u5b57\u63cf\u8fb9
    css+=_LS+'[style*="background:#fbbf24"] [style*="color:#fde68a"],'+_LS+'[style*="linear-gradient(135deg,#fbbf24"] [style*="color:#fde68a"]{color:#fff!important;text-shadow:0 1px 2px rgba(15,23,42,.35)!important}\n';
    // \u2461 \u767d\u5b57\u538b\u6de1\u7c89/\u6de1\u7eff\u5e95(~1.5:1) \u2192 \u8f6c\u6df1\u5b57
    css+=_LS+'[style*="background:#fee2e2"],'+_LS+'[style*="background:#fecaca"]{color:#7f1d1d!important}/*HSN-RED-OK \u7b54\u9519\u8bed\u4e49*/\n';
    css+=_LS+'[style*="background:#dcfce7"],'+_LS+'[style*="background:#bbf7d0"]{color:#14532d!important}\n';
    // \u2463 \u9898\u5e72\u63d0\u793a\u4e0e\u8ba1\u6570\u884c(\u884c\u5185#cbd5e1)
    css+=_LS+'#clozeContent [style*="color:#cbd5e1"]{color:#475569!important}\n';
    // \U0001f534v998\u3264 \u3010\u5168\u5c40\u6839\u6cbb\u3011\u4eae\u8272\u8c03\u4e0b\u7981\u6b62\u7070\u5e95\u2014\u2014\u7528\u6237\u591a\u6b21\u5f3a\u8c03\u7684\u603b\u89c4\u5219
    // \u5143\u51f6: \u5168\u4ed3 123+ \u5904\u534a\u900f\u660e\u6df1\u5e95 rgba(0,0,0,.x)/rgba(15,23,42,.x) \u7b49,
    // \u5b83\u4eec\u53e0\u5728\u6d45\u8272\u9875\u9762\u4e0a\u5c31\u662f"\u7070\u4e0d\u62c9\u51e0"\u2192 \u7edf\u4e00\u7ffb\u4e3a\u767d\u73bb\u7483\u5361
    (function(){
      var DARK_ALPHA = ['0,0,0','15,23,42','30,41,59','51,65,85','2,6,23','17,24,39'];
      var OPS = ['.2','.22','.25','.28','.3','.32','.35','.4','.45','.5','.52','.55','.6','.62','.64','.7','.75','.8','.82','.85'];
      DARK_ALPHA.forEach(function(rgb){
        OPS.forEach(function(op){
          var v1 = 'rgba('+rgb+','+op+')';
          var v2 = 'rgba('+rgb+', '+op+')';
          var v3 = 'rgba('+rgb+',0'+op+')';
          [v1,v2,v3].forEach(function(v){
            css+=_LS+'[style*="background:'+v+'"]{background:rgba(255,255,255,.88)!important;border-color:rgba(15,23,42,.10)!important}\n';
          });
        });
      });
    })();
    // \u6d45\u73bb\u7483\u5361\u5185\u6587\u5b57\u7edf\u4e00\u8f6c\u58a8(\u907f\u514d\u767d\u5b57\u538b\u767d\u5e95)
    // \u6d45\u73bb\u7483\u5361\u5185\u6587\u5b57\u7edf\u4e00\u8f6c\u58a8: \u5bb9\u5668\u81ea\u8eab + \u5b50\u5143\u7d20\u884c\u5185\u8272\u90fd\u8981\u63a5\u7ba1
    // (\u5426\u5219\u884c\u5185 color:#fff \u4f18\u5148\u7ea7\u66f4\u9ad8 \u2192 \u767d\u5e95\u767d\u5b57)
    ['rgba(0,0,0,','rgba(15,23,42,','rgba(30,41,59,','rgba(51,65,85,'].forEach(function(bg){
      css+=_LS+'[style*="background:'+bg+'"]{color:#0f172a!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#fff"]{color:#0f172a!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#cbd5e1"],'+_LS+'[style*="background:'+bg+'"] [style*="color:#e2e8f0"]{color:#475569!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#94a3b8"]{color:#64748b!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#fbbf24"],'+_LS+'[style*="background:'+bg+'"] [style*="color:#fde047"]{color:var(--pal-accent-text,#1e40af)!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#a78bfa"],'+_LS+'[style*="background:'+bg+'"] [style*="color:#c4b5fd"]{color:#5b21b6!important}\n';
      css+=_LS+'[style*="background:'+bg+'"] [style*="color:#22c55e"],'+_LS+'[style*="background:'+bg+'"] [style*="color:#4ade80"]{color:#15803d!important}\n';
    });
    /* \u91d1\u5b57\u8f6c\u5f3a\u8c03\u8272: \u5fc5\u987b\u6392\u9664 .cloze-cn \u5185\u7684\u9ad8\u4eae\u8bcd(\u5426\u5219\u8986\u76d6\u2461\u7684\u6d0b\u7ea2\u2014\u2014v996\u9996\u8f6e\u81ea\u6211\u51b2\u7a81\u5df2\u8bc1) */
    css+=_LS+'#clozeContent [style*="color:#fbbf24"]:not(.cloze-blank):not(.cloze-cn *){color:var(--pal-accent-text,#1e40af)!important}\n';
css+=_L+'#hr_toast, '+_L+'#hr_toast *,'+_L+'#hr_empty_msg, '+_L+'#hr_empty_msg *,'+_L+'#hr_to_sub_mask, '+_L+'#hr_to_sub_mask *{--pal-ink:#f1f5f9;--pal-ink-hi:#fff;--pal-ink-2:#cbd5e1;--pal-ink-3:#94a3b8;--pal-accent-text:#fbbf24}\n';

    // \U0001f534v991\u325b \u62fc\u5199\u7ec3\u4e60\u5c42(#hsp_mask) \u771f\u53cc\u8272\u8c03\u5206\u79bb
    // \u7528\u6237\u660e\u786e\u8981\u6c42: \u4eae\u8272\u8c03=\u4eae\u5e95\u9ed1\u5b57, \u6697\u8272\u8c03=\u6df1\u5e95\u6d45\u5b57\u2014\u2014\u4e0d\u662f\u628a\u6df1\u5e95\u51bb\u4f4f, \u800c\u662f\u6574\u5c42\u8ddf\u7740\u8272\u8c03\u7ffb
    css+=_L+'#hsp_mask{background:linear-gradient(180deg,#f8fafc 0%,#eef2ff 55%,#e0e7ff 100%)!important}\n';
    css+=_L+'#hsp_mask, '+_L+'#hsp_mask *{--pal-ink:#0f172a;--pal-ink-hi:#020617;--pal-ink-2:#334155;--pal-ink-3:#64748b}\n';
    // \u9898\u9762\u4e3b\u6587\u5b57(\u767d\u5b57\u7cfb) \u2192 \u58a8\u5b57
    css+=_L+'#hsp_mask [style*="color:#fff"],'+_L+'#hsp_mask [style*="color:#ffffff"]{color:#0f172a!important}\n';
    css+=_L+'#hsp_mask [style*="color:#cbd5e1"]{color:#334155!important}\n';
    css+=_L+'#hsp_mask [style*="color:#94a3b8"]{color:#64748b!important}\n';
    // \u5b57\u6bcd\u69fd(\u4e0b\u5212\u7ebf)\u4e0e\u5df2\u586b\u5b57\u6bcd
    css+=_L+'#hsp_mask #hspSlots > *{color:#0f172a!important;border-bottom-color:#475569!important}\n';
    // \u5173\u95ed\u94ae/\u8df3\u8fc7\u94ae: \u6d45\u5e95\u6df1\u5b57
    css+=_L+'#hsp_mask #hspCloseBtn{background:rgba(15,23,42,0.10)!important;color:#0f172a!important}\n';
    css+=_L+'#hsp_mask #hspSkipBtn{background:rgba(15,23,42,0.08)!important;color:#334155!important}\n';
    // \u518d\u542c\u4e00\u6b21\u6309\u94ae(\u672c\u5c31\u767d\u5e95) \u4fdd\u6301\u767d\u5e95\u6df1\u5b57+\u63cf\u8fb9\u589e\u5f3a
    css+=_L+'#hsp_mask #hspSpeakBtn{background:#fff!important;color:#0f172a!important;border:1px solid rgba(15,23,42,.12)!important}\n';
    // \u952e\u76d8: \u767d\u952e\u9ed1\u5b57(\u672c\u5c31\u662f), \u786e\u4fdd\u4e0d\u88ab\u94a9\u6210\u6d45\u5b57
    css+=_L+'#hsp_mask #hspKbd button,'+_L+'#hsp_mask #hspKbd [role="button"]{color:#0f172a!important}\n';
    // \u5b8c\u6210\u94ae\u91d1\u5e95\u6df1\u5b57\u4fdd\u6301
    css+=_L+'#hsp_mask #hspDoneBtn{color:#1e293b!important}\n';
    // \u534a\u900f\u660e\u6df1\u5e95\u5c0f\u5757(rgba(15,23,42,.5/.6)) \u2192 \u6d45\u73bb\u7483
    css+=_L+'#hsp_mask [style*="rgba(15,23,42,0.5)"],'+_L+'#hsp_mask [style*="rgba(15,23,42,0.6)"]{background:rgba(255,255,255,0.75)!important}\n';
    // 像素级实测补漏(边缘环取真实底色·非渐变平均): 最后 6 处
    css+=_L+'.d-label{color:#fff!important;text-shadow:0 2px 6px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.9)!important}\n';  // \u767d\u5b57\u538b\u5728\u56fe\u4e0a\u7684d-label\u901a\u7528\u6655
    // \U0001f534v987\u3253(\u6539\u5740\u81f3v928\u533a\u672b\xb7\u540e\u6765\u8005\u80dc\u538bL279/L292): \u6311\u6218BOSS\u6807\u7b7e\u5750\u7eaf\u4eae\u9ec4\u5361\u9762\u975eboss\u56fe\u4e0a\u2192\u58a8\u5b57(\u5df2\u7edf\u4e00\u70d9\u8272)\u514d\u6655\u5373\u9510
    css+=_L+'.d-label.boss-card-label{text-shadow:none!important}\n';  // 白字压在浅蓝boss图上 2.14:1 → 加重描边
    css+=_L+'[style*="color:#e9d5ff"],'+_L+'[style*="color:#a78bfa"],'+_L+'[style*="color:#c4b5fd"],'+_L+'[style*="color:#ddd6fe"]{color:#5b21b6!important}\n'; // 设置页淡紫字 1.36:1 → 深紫
    css+=_L+'.stat-card,'+_L+'.stats-card,'+_L+'.st-card{background:'+_SF+'!important;border:'+_BD+'!important;color:'+_IK+'!important}\n';
    // ⚠️ 不能一刀切改所有金色行内字: 有些金字是【压在深色/饱和卡上的】, 改深了反而更看不清。
    //    只接管【确定坐在浅底上】的那几处(顶栏/底栏已单独处理), 其余保持原样。
    var st=document.createElement('style'); st.id='hsnPaletteCSS'; st.textContent=css;
    (document.head||document.documentElement).appendChild(st);
  }

  // ── 应用配色 ──
  function apply(id, silent){
    var p=byId(id); var el=document.documentElement;
    var cur=(el.className||'').split(/\s+/).filter(function(c){return c.indexOf('hsn-pal-')!==0;});
    if(!p.isDefault){ cur.push('hsn-pal-'+p.id); if(p.light) cur.push('hsn-pal-light'); }
    el.className=cur.join(' ').replace(/\s+/g,' ').replace(/^\s|\s$/g,'');
    try{ localStorage.setItem(KEY, p.id); }catch(e){}
    refreshPicker();
    if(!silent){ try{ if(typeof window.showToast==='function') window.showToast('🎨 已切换配色: '+p.emoji+' '+p.name); }catch(e){} }
  }
  window.hansenApplyPalette=apply;

  function current(){ var c=''; try{ c=localStorage.getItem(KEY)||''; }catch(e){} return byId(c).id; }

  // ── 设置页选择器(注入 settingsContent 顶部·幂等) ──
  function swatchBg(p){
    if(p.isDefault) return 'linear-gradient(135deg,#1a2660,#0c1538)';
    return 'linear-gradient(135deg,'+p.vars.c2+','+p.vars.mid+' 55%,'+p.vars.deep+')';
  }
  function ensurePicker(){
    var sc=document.getElementById('settingsContent');
    if(!sc || document.getElementById('hsnPalPicker')) return;
    var cur=current();
    var h='<div class="settings-section" id="hsnPalPicker">'
      +'<h3 style="margin:0 0 4px">🎨 整体配色</h3>'
      +'<div style="font-size:12px;color:var(--pal-ink-3,#94a3b8);margin-bottom:10px">整个游戏换个颜色 · 全部免费 · 全岛通用</div>'
      +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">';
    for(var i=0;i<PALETTES.length;i++){
      var p=PALETTES[i]; var on=(p.id===cur);
      h+='<div class="hsn-pal-sw" data-pal="'+p.id+'" onclick="hansenApplyPalette(\''+p.id+'\')" style="cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent">'
        +'<div style="position:relative;width:46px;height:46px;margin:0 auto 5px;border-radius:50%;background:'+swatchBg(p)+';border:'+(on?'3px solid #fbbf24':'2px solid rgba(var(--pal-line-rgb,99,102,241),.45)')+';box-shadow:0 3px 10px rgba(0,0,0,.22)">'
        +'<span style="position:absolute;top:-2px;right:-4px;font-size:15px">'+(on?'✅':'')+'</span>'
        +'<span style="position:absolute;left:0;right:0;top:11px;font-size:17px;line-height:1">'+p.emoji+'</span>'
        +'</div>'
        +'<div style="font-size:11.5px;font-weight:800;color:'+(on?'#fbbf24':'var(--pal-ink-2,#cbd5e1)')+'">'+p.name+(p.isDefault?'<span style="font-weight:600;opacity:.75">(默认)</span>':'')+'</div>'
        +'</div>';
    }
    h+='</div></div>';
    var d=document.createElement('div'); d.innerHTML=h;
    sc.insertBefore(d.firstChild, sc.firstChild);
  }
  function refreshPicker(){
    var pk=document.getElementById('hsnPalPicker');
    if(!pk) return;
    pk.parentNode.removeChild(pk);
    ensurePicker();
  }

  // ── 启动 ──
  buildCSS();
  apply(current(), true);  // 幂等: head 内联已加类·这里补选择器高亮/无内联页面兜底
  // 包 renderSettings: 每次重渲染设置页都把选择器插回顶部
  var _wrapT=setInterval(function(){
    if(typeof window.renderSettings==='function' && !window.renderSettings.__hsnPal){
      var _o=window.renderSettings;
      window.renderSettings=function(){ var r=_o.apply(this,arguments); try{ensurePicker();}catch(e){} return r; };
      window.renderSettings.__hsnPal=true;
      clearInterval(_wrapT);
    }
  }, 250);
  setTimeout(function(){ clearInterval(_wrapT); }, 15000);
  if(document.readyState!=='loading') ensurePicker();
  else document.addEventListener('DOMContentLoaded', function(){ ensurePicker(); });

  // 🔴v860 同步中枢(Hansen: "岛里换回深空蓝·回首页还是亮的"——彻底相通·任督二脉):
  //   病根: 首页(父窗口)在岛(iframe)换配色时一直活着, 但只在自己加载那一刻读过一次配色, 之后永不再读。
  //   ① storage 事件: 同源下 iframe 一写 localStorage, 【其它窗口】(含父窗口首页)当场收到事件 → 立即重应用 = 零延迟同频;
  //   ② pageshow: 微信 WebView 从 bfcache 恢复页面(整页从内存复活·脚本不重跑)时补一次同步;
  //   ③ visibilitychange→visible: 后台切回前台兜底再对一次表。
  //   apply(current(),true) 幂等(类重建+选择器刷新+无 toast), 重复调用零副作用。
  function _hsnPalSync(){ try{ apply(current(), true); }catch(e){} }
  try{ window.addEventListener('storage', function(e){ if(!e || e.key === KEY || e.key === null) _hsnPalSync(); }); }catch(e){}
  try{ window.addEventListener('pageshow', function(){ _hsnPalSync(); }); }catch(e){}
  try{ document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') _hsnPalSync(); }); }catch(e){}
})();
