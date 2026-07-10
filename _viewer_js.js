/* ============================================================
   hansen_boss_attack.js  —  每个 Boss 的专属攻击特效 (v487 接入)
   - 答错被反击时, 按当前 boss 自动播放专属攻击特效
   - 命中瞬间调用 window.HansenHeroHit(浮动伤害+血条受击), 永不破坏掉血反馈
   - 全程: 无屏幕闪/无震屏/无脉动; 仅"斩击"用固定斜角(与游戏既有刀斩白名单一致)
   - SVG 一律整段字符串解析(微信内核安全), 不用 <image>/<use> 故无需 xlink
   - 所有类名/keyframe 加 hba- 前缀, 与游戏现有样式零冲突
   ============================================================ */
(function(){
  if(window.__hbaInit) return; window.__hbaInit=true;

  // 🔴 v499 (BUG#67 修复): 机械泰坦拳头是【唯一用外部图片(mechfist_real.webp)的 boss 特效】——其他所有 boss 都是内联 SVG(瞬时渲染·无加载)。
  //   根因: 原 makeWeapon 每次攻击【现新建 <img> 现取图】, 首次(未缓存)或解码慢时, slam 动画(hbaWeaponSlam·500ms)在图解码出来之前就放完了 → 拳头一片空白没出现
  //   (Hansen 实测"机械泰坦拳头有几次没出现"·已用延迟图片复现: slam 可见期拳头 img 未解码)。
  //   修法: ①页面加载即【预加载 + 解码】拳头图并保留引用(防 GC) → 用户走到战斗(总在数秒后)首次攻击时图已在内存解码好;
  //         ②makeWeapon 改为【克隆预加载好的图】(cloneNode·共享已解码位图·即时绘制, 不重新请求/解码) → 每次攻击拳头必即时显示。
  var _fistSrc='bosses/mechfist_real.webp?v=908';
  var _fistImg=new Image();
  _fistImg.src=_fistSrc;
  if(_fistImg.decode){ try{ _fistImg.decode().then(function(){ window.__hbaFistReady=true; }).catch(function(){}); }catch(e){} }
  _fistImg.onload=function(){ window.__hbaFistReady=true; };
  window.__hbaFistImg=_fistImg;   // 保留引用 + 供 makeWeapon 克隆复用

  // 🔴 v503: 上古太阳神火球图(同拳头——第二个外部图片FX, 同样预加载+解码+克隆, 防首次/慢解码时火球空白 BUG#67同理)
  var _sunSrc='bosses/sunball_real.webp?v=908';
  var _sunImg=new Image();
  _sunImg.src=_sunSrc;
  if(_sunImg.decode){ try{ _sunImg.decode().then(function(){ window.__hbaSunReady=true; }).catch(function(){}); }catch(e){} }
  _sunImg.onload=function(){ window.__hbaSunReady=true; };
  window.__hbaSunImg=_sunImg;

  // 🔴 v504: 混沌魔尊(Lv19)光波图(第三个外部图片FX——同拳头/火球: 预加载+解码+克隆, 防首次/慢解码空白 BUG#67同理)。
  var _waveSrc='bosses/chaoswave_real.webp?v=908';
  var _waveImg=new Image();
  _waveImg.src=_waveSrc;
  if(_waveImg.decode){ try{ _waveImg.decode().then(function(){ window.__hbaWaveReady=true; }).catch(function(){}); }catch(e){} }
  _waveImg.onload=function(){ window.__hbaWaveReady=true; };
  window.__hbaWaveImg=_waveImg;

  // 🔴 v505: 外星霸主(Lv18)光束图(第四个外部图片FX——同拳头/火球/光波: 预加载+解码+克隆防空白)。
  var _beamSrc='bosses/alienbeam_real.webp?v=908';
  var _beamImg=new Image();
  _beamImg.src=_beamSrc;
  if(_beamImg.decode){ try{ _beamImg.decode().then(function(){ window.__hbaBeamReady=true; }).catch(function(){}); }catch(e){} }
  _beamImg.onload=function(){ window.__hbaBeamReady=true; };
  window.__hbaBeamImg=_beamImg;

  // 🔴 v506: 暗夜吸血鬼(Lv6)獠牙咬合——4 颗牙齿图(第五个外部图片FX·同样预加载+解码防空白)。tl/tr=上牙(尖朝下) bl/br=下牙(尖朝上)。
  var _vfangSrcs={tl:'bosses/vfang_tl.webp?v=908',tr:'bosses/vfang_tr.webp?v=908',bl:'bosses/vfang_bl.webp?v=908',br:'bosses/vfang_br.webp?v=908'};
  var _vfangDim={tl:[191,417],tr:[191,417],bl:[183,512],br:[182,509]};
  var _vfangImgs={};
  ['tl','tr','bl','br'].forEach(function(k){ var im=new Image(); im.src=_vfangSrcs[k]; if(im.decode){ try{ im.decode().then(function(){}).catch(function(){}); }catch(e){} } _vfangImgs[k]=im; });
  window.__hbaVfangImgs=_vfangImgs;

  // 🔴 v507: 暗影忍者(Lv2)攻击——扔手里剑(第六个外部图片FX·同样预加载+解码防空白)。边飞边旋转·命中血液飞溅。
  var _shuriSrc='bosses/shuriken.webp?v=908';
  var _shuriImg=new Image(); _shuriImg.src=_shuriSrc; if(_shuriImg.decode){ try{ _shuriImg.decode().then(function(){}).catch(function(){}); }catch(e){} }
  window.__hbaShuriImg=_shuriImg;

  // 🔴 v512: 百战兽人(Lv3)战锤震地——真实战锤图(第七个外部图片FX·同拳头/火球: 预加载+解码+克隆 防首次/慢解码时锤子空白 BUG#67同理)。绕锤柄底为轴心抡弧砸地。
  var _hammerSrc='bosses/hammer_real.webp?v=908';
  var _hammerImg=new Image(); _hammerImg.src=_hammerSrc; if(_hammerImg.decode){ try{ _hammerImg.decode().then(function(){ window.__hbaHammerReady=true; }).catch(function(){}); }catch(e){} }
  _hammerImg.onload=function(){ window.__hbaHammerReady=true; };
  window.__hbaHammerImg=_hammerImg;

  // 🔴 v555: 史前霸王龙(Lv4)新四件套——Hansen 亲制真图(左爪撕痕/右爪撕痕/上颚獠牙/下颚獠牙, 第八组外部图片FX·预加载+解码+克隆 BUG#67 模式)。
  var _rfSrcs={cl:'bosses/rexclaw_l.webp?v=908',cr:'bosses/rexclaw_r.webp?v=908',jt:'bosses/rexjaw_top.webp?v=908',jb:'bosses/rexjaw_bot.webp?v=908'};
  var _rfImgs={};
  ['cl','cr','jt','jb'].forEach(function(k){ var im=new Image(); im.src=_rfSrcs[k]; if(im.decode){ try{ im.decode().then(function(){}).catch(function(){}); }catch(e){} } _rfImgs[k]=im; });
  window.__hbaRfImgs=_rfImgs;

  // 🔴 v558: 千年僵尸(Lv5)封印百拳五件套——Hansen 亲制(定身符/百拳全景/单拳x3, 第九组外部图片FX·BUG#67 模式)。
  var _zsSrcs={tl:'bosses/zb_talisman.webp?v=908',al:'bosses/zb_fists_all.webp?v=908',zb_fist1:'bosses/zb_fist1.webp?v=908',zb_fist2:'bosses/zb_fist2.webp?v=908',zb_fist3:'bosses/zb_fist3.webp?v=908'};
  var _zsImgs={};
  Object.keys(_zsSrcs).forEach(function(k){ var im=new Image(); im.src=_zsSrcs[k]; if(im.decode){ try{ im.decode().then(function(){}).catch(function(){}); }catch(e){} } _zsImgs[k]=im; });
  window.__hbaZsImgs=_zsImgs;

  // 🔴 v559: 千年僵尸(Lv5)二代四件套——左/右尸拳(自带尸气爆发光环)+新百拳全景, 符复用 zb_talisman.webp 同 URL 走缓存(第十组外部图片FX·BUG#67)。
  var _zfSrcs={fl:'bosses/zf_fist_l.webp?v=908',fr:'bosses/zf_fist_r.webp?v=908',al:'bosses/zf_fists_all.webp?v=908',tl:'bosses/zb_talisman.webp?v=908'};
  var _zfImgs={};
  Object.keys(_zfSrcs).forEach(function(k){ var im=new Image(); im.src=_zfSrcs[k]; if(im.decode){ try{ im.decode().then(function(){}).catch(function(){}); }catch(e){} } _zfImgs[k]=im; });
  window.__hbaZfImgs=_zfImgs;

  // 🔴 v560: 雷电之主真雷电图预加载(BUG#67)。铁律: 大尺寸 PNG 严禁 drop-shadow(合成器渲染黑洞, DEMO 血案: opacity 0.96 整层被丢)。
  var _tl2Bolt=new Image(); _tl2Bolt.src='bosses/tl_bolt.webp?v=908';
  if(_tl2Bolt.decode){ try{ _tl2Bolt.decode().then(function(){}).catch(function(){}); }catch(e){} }
  window.__hbaTl2BoltImg=_tl2Bolt;

  var CSS=
  ".hba-orb{position:fixed;pointer-events:none;z-index:9998;width:46px;height:46px;border-radius:50%;will-change:transform;transition:transform .3s cubic-bezier(.45,.05,.55,1)}"+
  ".hba-orb::after{content:'';position:absolute;inset:-3px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.35),transparent 70%);pointer-events:none}"+
  ".hba-orb.sun::before{content:'';position:absolute;inset:-20px;border-radius:50%;pointer-events:none;z-index:-1;background:radial-gradient(circle,rgba(253,224,71,.55) 0%,rgba(251,191,36,.25) 40%,transparent 68%),conic-gradient(from 0deg,rgba(253,224,71,.6) 0deg,transparent 16deg,rgba(253,224,71,.6) 32deg,transparent 48deg,rgba(253,224,71,.6) 64deg,transparent 80deg,rgba(253,224,71,.6) 96deg,transparent 112deg,rgba(253,224,71,.6) 128deg,transparent 144deg,rgba(253,224,71,.6) 160deg,transparent 176deg,rgba(253,224,71,.6) 192deg,transparent 208deg,rgba(253,224,71,.6) 224deg,transparent 240deg,rgba(253,224,71,.6) 256deg,transparent 272deg,rgba(253,224,71,.6) 288deg,transparent 304deg,rgba(253,224,71,.6) 320deg,transparent 336deg,rgba(253,224,71,.6) 352deg,transparent 360deg);-webkit-mask:radial-gradient(circle,transparent 52%,#000 56%,#000 80%,transparent 88%);mask:radial-gradient(circle,transparent 52%,#000 56%,#000 80%,transparent 88%)}"+
  ".hba-orb.fancy::before{content:'';position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(216,180,254,.7);box-shadow:0 0 10px rgba(168,85,247,.6);pointer-events:none;z-index:-1}"+
  ".hba-proj-emoji{position:fixed;pointer-events:none;z-index:9998;font-size:36px;line-height:1;will-change:transform;transition:transform .3s cubic-bezier(.45,.05,.55,1)}"+
  ".hba-proj-icicle{position:fixed;pointer-events:none;z-index:9998;width:18px;height:44px;will-change:transform;transition:transform .3s cubic-bezier(.45,.05,.55,1);background:linear-gradient(to bottom,#fff,#cffafe 28%,#67e8f9 60%,#0891b2 100%);clip-path:polygon(50% 100%,14% 0,86% 0);box-shadow:0 0 10px rgba(34,211,238,.85),0 0 20px rgba(8,145,178,.5)}"+
  ".hba-proj-flame{position:fixed;pointer-events:none;z-index:9998;width:48px;height:62px;will-change:transform;transition:transform .3s cubic-bezier(.45,.05,.55,1);filter:drop-shadow(0 0 8px rgba(249,115,22,.9)) drop-shadow(0 0 17px rgba(234,88,12,.6))}"+
  ".hba-laser{position:fixed;pointer-events:none;z-index:9998;width:8px;border-radius:4px;transform-origin:top center;background:linear-gradient(to bottom,rgba(255,255,255,.98),#f9a8d4 25%,#ec4899 55%,#db2777 100%);box-shadow:0 0 12px #ec4899,0 0 26px #f472b6,0 0 42px rgba(236,72,153,.5);transform:translateX(-50%) scaleY(0);animation:hbaLaser .4s ease-out forwards}"+
  "@keyframes hbaLaser{0%{transform:translateX(-50%) scaleY(0);opacity:1}22%{transform:translateX(-50%) scaleY(1);opacity:1}60%{opacity:.9}100%{transform:translateX(-50%) scaleY(1);opacity:0}}"+
  ".hba-spiralbeam{position:fixed;pointer-events:none;z-index:9998;width:30px;border-radius:15px;transform-origin:top center;background:repeating-linear-gradient(122deg,rgba(255,255,255,.95) 0 4px,transparent 4px 12px,rgba(216,180,254,.95) 12px 17px,transparent 17px 23px,rgba(168,85,247,.9) 23px 28px,transparent 28px 34px),linear-gradient(to bottom,rgba(245,235,255,.98),#c084fc 32%,#9333ea 66%,#6b21a8 100%);background-size:100% 34px,100% 100%;box-shadow:0 0 14px #c084fc,0 0 30px rgba(168,85,247,.7),0 0 54px rgba(147,51,234,.5);transform:translateX(-50%) scaleY(0);animation:hbaBeamShoot .42s ease-out forwards,hbaSpiralScroll .34s linear infinite}"+
  ".hba-spiralbeam::before{content:'';position:absolute;left:50%;top:0;bottom:0;width:5px;transform:translateX(-50%);border-radius:3px;background:linear-gradient(to bottom,#fff,rgba(245,235,255,.85));box-shadow:0 0 10px #fff,0 0 18px #d8b4fe}"+
  ".hba-spiralbeam::after{content:'';position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);width:0;height:0;border-left:16px solid transparent;border-right:16px solid transparent;border-top:24px solid #c084fc;filter:drop-shadow(0 0 9px #a855f7)}"+
  "@keyframes hbaBeamShoot{0%{transform:translateX(-50%) scaleY(0);opacity:1}24%{transform:translateX(-50%) scaleY(1);opacity:1}68%{opacity:.92}100%{transform:translateX(-50%) scaleY(1);opacity:0}}"+
  "@keyframes hbaSpiralScroll{from{background-position:0 0,0 0}to{background-position:0 34px,0 0}}"+
  ".hba-bigboom{position:fixed;pointer-events:none;z-index:9999;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(240,171,252,.8) 24%,rgba(168,85,247,.55) 50%,rgba(88,28,135,.3) 70%,transparent 82%);transform:translate(-50%,-50%) scale(.2);will-change:transform,opacity;animation:hbaBigBoom .6s cubic-bezier(.15,.7,.3,1) forwards}"+
  "@keyframes hbaBigBoom{0%{transform:translate(-50%,-50%) scale(.2);opacity:.98}100%{transform:translate(-50%,-50%) scale(3.6);opacity:0}}"+
  ".hba-boom-core{position:fixed;pointer-events:none;z-index:9999;width:42px;height:42px;border-radius:50%;background:radial-gradient(circle,#fff 0%,rgba(245,235,255,.92) 38%,transparent 72%);transform:translate(-50%,-50%) scale(.2);will-change:transform,opacity;animation:hbaBoomCore .4s ease-out forwards}"+
  "@keyframes hbaBoomCore{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}45%{transform:translate(-50%,-50%) scale(1.7);opacity:1}100%{transform:translate(-50%,-50%) scale(2.3);opacity:0}}"+
  ".hba-boom-rays{position:fixed;pointer-events:none;z-index:9998;width:96px;height:96px;border-radius:50%;background:repeating-conic-gradient(rgba(216,180,254,.85) 0deg 6deg,transparent 6deg 30deg);transform:translate(-50%,-50%) scale(.3);will-change:transform,opacity;animation:hbaBoomRays .55s ease-out forwards;-webkit-mask:radial-gradient(circle,#000 16%,rgba(0,0,0,.5) 50%,transparent 72%);mask:radial-gradient(circle,#000 16%,rgba(0,0,0,.5) 50%,transparent 72%)}"+
  "@keyframes hbaBoomRays{0%{transform:translate(-50%,-50%) scale(.3);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}"+
  ".hba-boom-halo{position:fixed;pointer-events:none;z-index:9997;width:80px;height:80px;border-radius:50%;border:3px solid rgba(192,132,252,.7);box-shadow:0 0 18px rgba(168,85,247,.6),inset 0 0 14px rgba(168,85,247,.4);transform:translate(-50%,-50%) scale(.4);will-change:transform,opacity;animation:hbaBoomHalo .8s ease-out forwards}"+
  "@keyframes hbaBoomHalo{0%{transform:translate(-50%,-50%) scale(.4);opacity:0}30%{opacity:.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}"+
  ".hba-beam-charge{position:fixed;pointer-events:none;z-index:9998;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,#fff,#c084fc 50%,#7e22ce);box-shadow:0 0 14px #a855f7,0 0 30px rgba(168,85,247,.7);transform:translate(-50%,-50%) scale(0);animation:hbaBeamCharge .24s ease-out forwards}"+
  "@keyframes hbaBeamCharge{0%{transform:translate(-50%,-50%) scale(0);opacity:.6}70%{transform:translate(-50%,-50%) scale(2.3);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:1}}"+
  ".hba-orb-burst{position:fixed;pointer-events:none;z-index:9999;width:66px;height:66px;border-radius:50%;transform:translate(-50%,-50%) scale(.3);will-change:transform,opacity;animation:hbaOrbBurst .5s cubic-bezier(.2,.7,.3,1) forwards}"+
  "@keyframes hbaOrbBurst{0%{transform:translate(-50%,-50%) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}"+
  ".hba-shard{position:fixed;pointer-events:none;z-index:9999;width:8px;height:8px;border-radius:2px;will-change:transform,opacity;animation:hbaShardFly .62s cubic-bezier(.2,.6,.4,1) forwards}"+
  "@keyframes hbaShardFly{0%{transform:translate(-50%,-50%) translate(0,0) scale(1);opacity:1}100%{transform:translate(-50%,-50%) translate(var(--tx),var(--ty)) scale(.25);opacity:0}}"+
  ".hba-chunk{position:fixed;pointer-events:none;z-index:9999;width:14px;height:14px;border-radius:3px;will-change:transform,opacity;animation:hbaShardFly .72s cubic-bezier(.2,.6,.4,1) forwards}"+
  ".hba-tint{position:fixed;pointer-events:none;z-index:9997;border-radius:12px;animation:hbaTintIn .9s ease-out forwards}"+
  "@keyframes hbaTintIn{0%{opacity:0}20%{opacity:1}65%{opacity:.85}100%{opacity:0}}"+
  ".hba-lightning{position:fixed;pointer-events:none;z-index:9998;overflow:visible;animation:hbaBoltFade .5s ease-out forwards}"+
  ".hba-lightning .hba-bolt{fill:none;stroke:#fff;stroke-linejoin:round;stroke-linecap:round;filter:drop-shadow(0 0 3px #e0f2fe) drop-shadow(0 0 7px #38bdf8) drop-shadow(0 0 14px #0ea5e9) drop-shadow(0 0 22px #2563eb);stroke-dasharray:1400;stroke-dashoffset:1400;animation:hbaBoltDraw .12s ease-out forwards}"+
  ".hba-lightning .hba-bolt.main{stroke-width:5}.hba-lightning .hba-bolt.branch{stroke-width:2.5}"+
  "@keyframes hbaBoltDraw{to{stroke-dashoffset:0}}@keyframes hbaBoltFade{0%{opacity:1}50%{opacity:1}100%{opacity:0}}"+
  ".hba-halberd{position:fixed;pointer-events:none;z-index:9998;will-change:transform,opacity;filter:drop-shadow(0 0 6px rgba(251,191,36,.5)) drop-shadow(0 2px 4px rgba(0,0,0,.45));transform:translate(-50%,0) translateY(-46px);animation:hbaSpearThrust .42s cubic-bezier(.5,0,.35,1) forwards}"+
  "@keyframes hbaSpearThrust{0%{transform:translate(-50%,0) translateY(-46px);opacity:0}16%{transform:translate(-50%,0) translateY(-46px);opacity:1}44%{transform:translate(-50%,0) translateY(var(--reach));opacity:1}60%{transform:translate(-50%,0) translateY(var(--reach));opacity:1}100%{transform:translate(-50%,0) translateY(-46px);opacity:0}}"+
  ".hba-stab-mark{position:fixed;pointer-events:none;z-index:9999;width:5px;height:36px;border-radius:3px;background:linear-gradient(to bottom,rgba(255,255,255,.95),#ef4444 42%,#991b1b 100%);box-shadow:0 0 10px #ef4444,0 0 18px rgba(220,38,38,.6);transform:translate(-50%,-50%) scaleY(.3);will-change:transform,opacity;animation:hbaStabMark .42s ease-out forwards}"+
  "@keyframes hbaStabMark{0%{transform:translate(-50%,-50%) scaleY(.3);opacity:0}30%{transform:translate(-50%,-50%) scaleY(1);opacity:1}100%{transform:translate(-50%,-50%) scaleY(1);opacity:0}}"+
  ".hba-ghostie{position:fixed;pointer-events:none;z-index:9998;will-change:transform;transition:transform .32s cubic-bezier(.4,.1,.5,1);filter:drop-shadow(0 0 12px rgba(226,232,240,.85)) drop-shadow(0 0 22px rgba(148,163,184,.5))}"+
  ".hba-ghost-poof{position:fixed;pointer-events:none;z-index:9999;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.92) 0%,rgba(226,232,240,.6) 40%,transparent 75%);transform:translate(-50%,-50%) scale(.4);will-change:transform,opacity;animation:hbaGhostPoof .5s ease-out forwards}"+
  "@keyframes hbaGhostPoof{0%{transform:translate(-50%,-50%) scale(.4);opacity:.95}100%{transform:translate(-50%,-50%) scale(2);opacity:0}}"+
  ".hba-carpet{position:fixed;pointer-events:none;z-index:9998;will-change:transform;transition:transform .34s cubic-bezier(.4,.1,.5,1);filter:drop-shadow(0 4px 8px rgba(0,0,0,.4)) drop-shadow(0 0 14px rgba(168,85,247,.5))}"+
  ".hba-slash-mark{position:fixed;pointer-events:none;z-index:9999;border-radius:3px;transform-origin:center;transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(0);will-change:transform,opacity;animation:hbaSlashCut .34s cubic-bezier(.3,.7,.4,1) forwards}"+
  "@keyframes hbaSlashCut{0%{transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(0);opacity:0}30%{transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1);opacity:1}100%{transform:translate(-50%,-50%) rotate(var(--ang)) scaleX(1);opacity:0}}"+
  ".hba-weapon{position:fixed;pointer-events:none;z-index:9998;will-change:transform,opacity;filter:drop-shadow(0 3px 5px rgba(0,0,0,.45));transform:translate(-50%,0) translateY(-72px);animation:hbaWeaponSlam .5s cubic-bezier(.45,0,.3,1) forwards}"+
  "@keyframes hbaWeaponSlam{0%{transform:translate(-50%,0) translateY(-72px);opacity:0}14%{transform:translate(-50%,0) translateY(-72px);opacity:1}40%{transform:translate(-50%,0) translateY(var(--reach));opacity:1}52%{transform:translate(-50%,0) translateY(calc(var(--reach) - 10px));opacity:1}64%{transform:translate(-50%,0) translateY(var(--reach));opacity:1}100%{transform:translate(-50%,0) translateY(-72px);opacity:0}}"+
  /* 🔴 v502: 机械泰坦拳头专用——从小变大(起始30%→满)+ 砸中后原地淡出(不回撤不缩小)+ 0.8s 加速冲击。与百战兽人锤子(hba-weapon)分开互不影响。 */
  ".hba-fist{position:fixed;pointer-events:none;z-index:9998;will-change:transform,opacity;transform-origin:center center;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5)) drop-shadow(0 0 10px rgba(124,58,237,.32));transform:translate(-50%,0) translateY(var(--startY,0px)) scale(var(--startScale,.3));animation:hbaFistSlam var(--fistdur,.5s) cubic-bezier(.5,0,.85,.55) forwards}"+
  "@keyframes hbaFistSlam{0%{transform:translate(-50%,0) translateY(var(--startY)) scale(var(--startScale));opacity:0}10%{transform:translate(-50%,0) translateY(var(--startY)) scale(var(--startScale));opacity:1}50%{transform:translate(-50%,0) translateY(var(--reach)) scale(1);opacity:1}66%{transform:translate(-50%,0) translateY(var(--reach)) scale(1);opacity:1}100%{transform:translate(-50%,0) translateY(var(--reach)) scale(1);opacity:0}}"+
  /* 🔴 v503: 上古太阳神——太阳火球(外部图)从小变大砸向勇者(复用 hbaFistSlam 键帧·同拳头模式) + 命中血条火焰燃烧。零屏闪零震屏。 */
  ".hba-sunball{position:fixed;pointer-events:none;z-index:9998;will-change:transform,opacity;transform-origin:center center;filter:drop-shadow(0 0 12px rgba(251,146,60,.85)) drop-shadow(0 0 22px rgba(239,68,68,.5));transform:translate(-50%,0) translateY(var(--startY,0px)) scale(var(--startScale,.3));animation:hbaFistSlam .8s cubic-bezier(.5,0,.85,.55) forwards}"+
  ".hba-sunfire{position:fixed;pointer-events:none;z-index:9999;width:122px;height:42px;transform:translate(-50%,-50%);display:flex;justify-content:space-between;align-items:flex-end;opacity:0;animation:hbaSunFire .8s ease-out forwards}"+
  "@keyframes hbaSunFire{0%{opacity:0}14%{opacity:1}66%{opacity:1}100%{opacity:0}}"+
  ".hba-sunflame{width:13px;background:radial-gradient(ellipse at 50% 82%,#fffbe8 0%,#fde047 20%,#fb923c 48%,#ef4444 72%,transparent 86%);border-radius:50% 50% 48% 48% / 72% 72% 40% 40%;transform-origin:bottom center;filter:blur(.4px);animation:hbaSunFlick .26s ease-in-out infinite alternate}"+
  "@keyframes hbaSunFlick{0%{transform:scaleY(.82) scaleX(1.06)}100%{transform:scaleY(1.36) scaleX(.76)}}"+
  /* 🔴 v504: 混沌魔尊(Lv19)——光波(外部图·细尖在顶=boss·大漩涡口在底=血条)从尖端沿 boss→血条逐渐展开画出(clip 从上往下揭示·Hansen 定稿 0.88s)。漩涡口抵达血条命中。零震屏零屏闪。 */
  ".hba-chaoswave{position:fixed;pointer-events:none;z-index:9998;will-change:clip-path,opacity;transform:translateX(-50%);filter:drop-shadow(0 0 10px rgba(168,85,247,.75)) drop-shadow(0 0 20px rgba(124,58,237,.5));-webkit-clip-path:inset(0 0 100% 0);clip-path:inset(0 0 100% 0);animation:hbaChaosWave var(--wdur,.5s) cubic-bezier(.35,.15,.5,1) forwards}"+
  "@keyframes hbaChaosWave{0%{-webkit-clip-path:inset(0 0 100% 0);clip-path:inset(0 0 100% 0);opacity:1}78%{-webkit-clip-path:inset(0 0 0 0);clip-path:inset(0 0 0 0);opacity:1}88%{-webkit-clip-path:inset(0 0 0 0);clip-path:inset(0 0 0 0);opacity:1}100%{-webkit-clip-path:inset(0 0 0 0);clip-path:inset(0 0 0 0);opacity:0}}"+
  /* 🔴 v506: 暗夜吸血鬼(Lv6)獠牙咬合——4 颗牙齿(图片)咬住勇者血条, 上2颗下咬·下2颗上咬·牙尖在血条中线相碰, 血条泛红+滴血。零震屏零屏闪。 */
  ".hba-vfang{position:fixed;pointer-events:none;z-index:9998;opacity:0;will-change:transform,opacity;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}"+
  ".hba-vfang img{display:block;width:100%;height:100%}"+
  ".hba-vfang.top{animation:hbaVbiteTop var(--vdur,.5s) cubic-bezier(.32,.78,.4,1) forwards}"+
  ".hba-vfang.bot{animation:hbaVbiteBot var(--vdur,.5s) cubic-bezier(.32,.78,.4,1) forwards}"+
  "@keyframes hbaVbiteTop{0%{transform:translateY(-18px) scale(.62);opacity:0}30%{transform:translateY(0) scale(1);opacity:1}70%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-10px) scale(.93);opacity:0}}"+
  "@keyframes hbaVbiteBot{0%{transform:translateY(18px) scale(.62);opacity:0}30%{transform:translateY(0) scale(1);opacity:1}70%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(10px) scale(.93);opacity:0}}"+
  ".hero-hp-bar.hsn-bite-glow{box-shadow:0 0 13px rgba(220,38,38,.9),0 0 24px rgba(153,27,27,.6),inset 0 0 9px rgba(248,113,113,.5)!important;border-color:#dc2626!important}"+
  ".hba-vblood{position:fixed;pointer-events:none;z-index:9997;width:7px;height:10px;border-radius:60% 60% 50% 50%/72% 72% 38% 38%;background:radial-gradient(circle at 38% 28%,#fecaca,#dc2626 52%,#7f1d1d);box-shadow:0 0 5px rgba(220,38,38,.75);transform:translate(-50%,0);animation:hbaVblood var(--vdur,.5s) ease-in forwards}"+
  "@keyframes hbaVblood{0%{opacity:0;transform:translate(-50%,0) scale(.4)}30%{opacity:1;transform:translate(-50%,3px) scale(1)}100%{opacity:0;transform:translate(-50%,22px) scale(.65)}}"+
  /* 🔴 v507: 暗影忍者(Lv2)扔手里剑——手里剑(图片)边飞边旋转命中血条 + 血液飞溅(血滴四溅+红色冲击环)。零震屏零屏闪。 */
  ".hba-shuriken{position:fixed;pointer-events:none;z-index:9998;opacity:0;will-change:transform,opacity;filter:drop-shadow(0 0 8px rgba(56,189,248,.7))}"+
  ".hba-shuriken img{display:block;width:100%;height:100%}"+
  ".hba-splat{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;background:radial-gradient(circle at 38% 32%,#fecaca,#dc2626 50%,#7f1d1d);box-shadow:0 0 4px rgba(220,38,38,.6)}"+
  ".hba-splash-ring{position:fixed;pointer-events:none;z-index:9997;width:30px;height:30px;border-radius:50%;border:3px solid rgba(220,38,38,.7);transform:translate(-50%,-50%) scale(.2);will-change:transform,opacity;animation:hbaSplashRing .5s ease-out forwards}"+
  "@keyframes hbaSplashRing{0%{transform:translate(-50%,-50%) scale(.2);opacity:.9}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}"+
  ".hba-slam-flash{position:fixed;pointer-events:none;z-index:9999;width:58px;height:58px;border-radius:50%;transform:translate(-50%,-50%) scale(.3);will-change:transform,opacity;animation:hbaSlamFlash .42s cubic-bezier(.2,.7,.3,1) forwards}"+
  "@keyframes hbaSlamFlash{0%{transform:translate(-50%,-50%) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-drain-wisp{position:fixed;pointer-events:none;z-index:9999;width:8px;height:8px;border-radius:50%;background:radial-gradient(circle,#fecaca,#dc2626 60%,#7f1d1d);box-shadow:0 0 8px #ef4444;transform:translate(-50%,-50%);will-change:transform,opacity;animation:hbaDrainRise .6s ease-in forwards}"+
  "@keyframes hbaDrainRise{0%{transform:translate(-50%,-50%) translate(0,0) scale(1);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-50%) translate(var(--dx),var(--rise)) scale(.4);opacity:0}}"+
  ".hba-firebreath{position:fixed;pointer-events:none;z-index:9998;transform-origin:top center;transform:scaleY(0);filter:drop-shadow(0 0 8px rgba(249,115,22,.7));animation:hbaFireBreath .46s ease-out forwards}"+
  "@keyframes hbaFireBreath{0%{transform:scaleY(0);opacity:1}30%{transform:scaleY(1);opacity:1}70%{opacity:.9}100%{transform:scaleY(1);opacity:0}}"+
  ".hba-tentacle2{position:fixed;pointer-events:none;z-index:9999;transform-origin:bottom center;transform:translateX(-50%) scaleY(0);will-change:transform,opacity;filter:drop-shadow(0 0 6px rgba(20,184,166,.5));animation:hbaTentRise .78s cubic-bezier(.3,.8,.4,1) forwards}"+
  "@keyframes hbaTentRise{0%{transform:translateX(-50%) scaleY(0);opacity:0}25%{transform:translateX(-50%) scaleY(1);opacity:1}70%{transform:translateX(-50%) scaleY(1);opacity:1}100%{transform:translateX(-50%) scaleY(.85);opacity:0}}"+
  /* 🔴 v510: 机械泰坦导弹散射汇聚(Hansen 定稿)——主题色由 wrapper 内联 --mc1..--mc4/--mglow/--mband 决定(plasma/fire) */
  ".hba-mwrap{position:fixed;inset:0;pointer-events:none;z-index:9997}"+
  ".hba-missile{position:absolute;pointer-events:none;z-index:9998;will-change:transform,opacity;filter:drop-shadow(0 0 5px var(--mglow)) drop-shadow(0 2px 4px rgba(0,0,0,.5))}"+
  ".hba-missile svg{display:block;width:100%;height:100%}"+
  ".hba-mflame{position:absolute;left:50%;bottom:100%;transform:translateX(-50%);width:64%;border-radius:50% 50% 40% 40%/70% 70% 30% 30%;background:linear-gradient(to top,var(--mc1),var(--mc2) 30%,var(--mc3) 62%,var(--mc4) 82%,transparent);filter:blur(1px) drop-shadow(0 0 5px var(--mglow));animation:hbmFlick .08s infinite alternate}"+
  "@keyframes hbmFlick{0%{height:130%;opacity:.97}100%{height:175%;opacity:.72}}"+
  ".hba-mtrail{position:absolute;pointer-events:none;z-index:9996;border-radius:50%;background:radial-gradient(circle,var(--mc1),var(--mc3) 55%,transparent);box-shadow:0 0 6px var(--mglow)}"+
  ".hba-mflash{position:absolute;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,var(--mc2) 45%,transparent 70%);opacity:0;will-change:transform,opacity;animation:hbmFlash .26s ease-out forwards}"+
  "@keyframes hbmFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.35);opacity:0}}"+
  ".hba-mball{position:absolute;pointer-events:none;z-index:9998;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,var(--mc2) 25%,var(--mc3) 52%,var(--mc4) 74%,transparent 86%);opacity:0;will-change:transform,opacity;filter:drop-shadow(0 0 8px var(--mglow));animation:hbmBall .46s ease-out forwards}"+
  "@keyframes hbmBall{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}55%{opacity:1}100%{transform:translate(-50%,-50%) scale(1.55);opacity:0}}"+
  ".hba-mring{position:absolute;pointer-events:none;z-index:9998;border-radius:50%;border:3px solid var(--mc3);transform:translate(-50%,-50%) scale(.3);opacity:0;box-shadow:0 0 8px var(--mglow);will-change:transform,opacity;animation:hbmRing .52s ease-out forwards}"+
  ".hba-mring.r2{border-width:2px;border-color:var(--mc2);animation:hbmRing2 .66s ease-out forwards}"+
  "@keyframes hbmRing{0%{transform:translate(-50%,-50%) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}"+
  "@keyframes hbmRing2{0%{transform:translate(-50%,-50%) scale(.3);opacity:.8}100%{transform:translate(-50%,-50%) scale(3.6);opacity:0}}"+
  ".hba-mspark{position:absolute;pointer-events:none;z-index:9999;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,var(--mc3) 60%,var(--mc4));box-shadow:0 0 6px var(--mglow)}"+
  ".hba-member{position:absolute;pointer-events:none;z-index:9998;border-radius:50%;background:radial-gradient(circle,var(--mc2),var(--mc3) 60%,transparent);box-shadow:0 0 5px var(--mglow)}"+
  ".hba-mpuff{position:absolute;pointer-events:none;z-index:9997;border-radius:50%;background:radial-gradient(circle,rgba(120,120,130,.5),rgba(80,80,90,.18) 60%,transparent)}"+
  /* 🔴 v511: 烈焰魔神火焰陨石雨(Hansen 定稿)——熔岩岩石陨石SVG+燃烧彗尾·天降命中·残留地火。复用 --mc1..--mc4/--mglow + 上面爆炸/拖尾/火星层 */
  ".hba-meteor{position:absolute;pointer-events:none;z-index:9998;will-change:transform;filter:drop-shadow(0 0 9px var(--mglow))}"+
  ".hba-meteor svg{display:block;width:100%;height:100%}"+
  ".hba-gfire{position:absolute;pointer-events:none;z-index:9997;border-radius:50% 50% 46% 46%/70% 70% 32% 32%;background:linear-gradient(to top,var(--mc4),var(--mc3) 45%,var(--mc2) 78%,transparent);filter:blur(.6px) drop-shadow(0 0 6px var(--mglow));transform-origin:bottom center}"+
  ".hba-skyband{position:fixed;left:0;right:0;top:0;height:78px;pointer-events:none;z-index:9996;background:linear-gradient(to bottom,var(--mglow),transparent);opacity:0}"+
  /* 🔴 v512: 百战兽人(Lv3)战锤震地——锤子(真实图·绕锤柄底轴心抡弧·hbaHammerSlam由JS的WAAPI驱动) + 熔岩地裂(冲击闪+双冲击环+地裂SVG+岩刺+碎石+火星+尘土)。全 fixed 贴 body·熔岩色硬编码(橙)·hba-hq 前缀防冲突·零震屏零屏闪。 */
  ".hba-hammer2{position:fixed;pointer-events:none;z-index:9998;will-change:transform;filter:drop-shadow(0 5px 9px rgba(0,0,0,.6))}"+
  ".hba-hammer2 img{display:block;width:100%;height:100%}"+
  ".hba-hqflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fde68a 45%,transparent 70%);opacity:0}"+
  ".hba-hqflash.go{animation:hbaHqFlash .3s ease-out forwards}"+
  "@keyframes hbaHqFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  ".hba-hqcrack{position:fixed;pointer-events:none;z-index:9990;transform:translate(-50%,-50%) scaleX(1.3) scaleY(.5) scale(.3);opacity:0}"+
  ".hba-hqcrack.go{animation:hbaHqCrack .55s cubic-bezier(.2,.7,.3,1) forwards}"+
  "@keyframes hbaHqCrack{0%{transform:translate(-50%,-50%) scaleX(1.3) scaleY(.5) scale(.3);opacity:0}20%{opacity:1}100%{transform:translate(-50%,-50%) scaleX(1.3) scaleY(.5) scale(1.05);opacity:0}}"+
  ".hba-hqcrack svg{display:block;width:100%;height:100%}"+
  ".hba-hqspike{position:fixed;pointer-events:none;z-index:9991;transform-origin:bottom center;transform:translate(-50%,0) scaleY(0)}"+
  ".hba-hqspike.go{animation:hbaHqSpike .5s cubic-bezier(.2,.8,.3,1) forwards}"+
  "@keyframes hbaHqSpike{0%{transform:translate(-50%,0) scaleY(0);opacity:1}30%{transform:translate(-50%,0) scaleY(1)}70%{transform:translate(-50%,0) scaleY(1);opacity:1}100%{transform:translate(-50%,0) scaleY(.82);opacity:0}}"+
  ".hba-hqspike svg{display:block;width:100%;height:100%}"+
  ".hba-hqrock{position:fixed;pointer-events:none;z-index:9992;border-radius:2px;background:linear-gradient(150deg,#7a6150,#3e2f24 60%,#241a14);box-shadow:inset 0 1px 1px rgba(255,255,255,.18)}"+
  ".hba-hqring{position:fixed;pointer-events:none;z-index:9991;border-radius:50%;border:3px solid #fb923c;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(251,146,60,.9)}"+
  ".hba-hqring.go{animation:hbaHqRing .5s ease-out forwards}"+
  ".hba-hqring.r2{border-width:2px;border-color:#fde68a}"+
  ".hba-hqring.r2.go{animation:hbaHqRing2 .62s ease-out forwards}"+
  "@keyframes hbaHqRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(2.8);opacity:0}}"+
  "@keyframes hbaHqRing2{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.8}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.6);opacity:0}}"+
  ".hba-hqspark{position:fixed;pointer-events:none;z-index:9999;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#fb923c 60%,#dc2626);box-shadow:0 0 6px rgba(251,146,60,.9)}"+
  ".hba-hqdust{position:fixed;pointer-events:none;z-index:9989;border-radius:50%;background:radial-gradient(circle,rgba(140,120,100,.5),rgba(90,76,62,.2) 60%,transparent)}"+
  /* 🔴 v550 百战兽人·战意全开: 战吼环/怒气点/锤头辉光/弧光容器/残影/部落绿环 */
  ".hba-hq3roar{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;border:3px solid #a3e635;transform:translate(-50%,-50%) scale(.3);opacity:.95;box-shadow:0 0 10px rgba(163,230,53,.85),inset 0 0 8px rgba(101,163,13,.5)}"+
  ".hba-hq3roar.go{transition:transform .6s cubic-bezier(.2,.7,.3,1),opacity .6s ease-out;transform:translate(-50%,-50%) scale(3.4);opacity:0}"+
  ".hba-hq3rage{position:fixed;pointer-events:none;z-index:9997;width:9px;height:9px;border-radius:50%;background:radial-gradient(circle,#f7fee7,#a3e635 55%,#65a30d);box-shadow:0 0 8px rgba(163,230,53,.95)}"+
  ".hba-hq3glow{position:fixed;pointer-events:none;z-index:9996;width:84px;height:84px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(217,249,157,.85) 0%,rgba(163,230,53,.5) 38%,rgba(101,163,13,.18) 62%,transparent 75%);opacity:0}"+
  ".hba-hq3arc{position:fixed;pointer-events:none;z-index:9995;opacity:0}"+
  ".hba-hq3ghost{position:fixed;pointer-events:none;z-index:9994;filter:saturate(.7) brightness(1.1)}"+
  ".hba-hqring.grn{border-color:#a3e635;box-shadow:0 0 10px rgba(163,230,53,.9)}"+
  /* 🔴 v551 暗影忍者·影舞三连杀: 烟雾/影分身/命中紫闪/刀光拖尾/十字斩/暗影爆 */
  ".hba-sdsmoke{position:fixed;pointer-events:none;z-index:9991;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(91,82,120,.85) 0%,rgba(55,48,80,.55) 45%,rgba(31,41,55,.25) 70%,transparent 80%)}"+
  ".hba-sdclone{position:fixed;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-sdclone img{width:100%;height:100%;object-fit:contain;filter:brightness(0) drop-shadow(0 0 9px rgba(167,139,250,.95)) drop-shadow(0 0 2px rgba(124,58,237,.9))}"+
  ".hba-sdhitflash{position:fixed;pointer-events:none;z-index:9998;border-radius:50%;transform:translate(-50%,-50%) scale(.2);opacity:.95;background:radial-gradient(circle,#fff 0%,#c4b5fd 40%,rgba(124,58,237,.6) 65%,transparent 78%)}"+
  ".hba-sdhitflash.go{transition:transform .24s ease-out,opacity .24s ease-out;transform:translate(-50%,-50%) scale(1.5);opacity:0}"+
  ".hba-sdtrail{position:fixed;pointer-events:none;z-index:9995;background:linear-gradient(90deg,rgba(124,58,237,.0) 0%,rgba(167,139,250,.65) 30%,rgba(196,181,253,.9) 100%);border-radius:6px;filter:blur(1.2px)}"+
  ".hba-sdslash{position:fixed;pointer-events:none;z-index:9998;border-radius:3px;background:linear-gradient(90deg,transparent,#e9d5ff 18%,#fff 50%,#e9d5ff 82%,transparent);box-shadow:0 0 10px rgba(167,139,250,.95)}"+
  ".hba-sdburst{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;background:radial-gradient(circle,rgba(196,181,253,.9) 0%,rgba(124,58,237,.6) 38%,rgba(31,41,55,.45) 62%,transparent 76%)}"+
  /* 🔴 v552 淘气小幽灵·淘气捉迷藏: 虚影/嘟嘟弹/灵光涟漪/幽灵泡泡/小星星 */
  ".hba-gpphantom{position:fixed;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-gpphantom img{width:100%;height:100%;object-fit:contain;opacity:.92;filter:drop-shadow(0 0 10px rgba(147,197,253,.9)) drop-shadow(0 0 3px rgba(196,181,253,.8)) saturate(1.05)}"+
  ".hba-gpphantom.big{z-index:9997}"+
  ".hba-gporb{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 34% 30%,#fff 0%,#e0f2fe 28%,#93c5fd 62%,rgba(147,197,253,.35) 80%,transparent 88%);box-shadow:0 0 12px rgba(147,197,253,.95),inset -2px -3px 6px rgba(99,102,241,.35)}"+
  ".hba-gpripple{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;border:3px solid #bfdbfe;transform:translate(-50%,-50%) scale(.3);opacity:.95;box-shadow:0 0 10px rgba(147,197,253,.9),inset 0 0 8px rgba(196,181,253,.55)}"+
  ".hba-gpripple.go{transition:transform .44s cubic-bezier(.2,.7,.3,1),opacity .44s ease-out;transform:translate(-50%,-50%) scale(2.6);opacity:0}"+
  ".hba-gpbubble{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.95) 0%,rgba(224,242,254,.75) 36%,rgba(147,197,253,.45) 70%,transparent 84%);box-shadow:0 0 6px rgba(147,197,253,.7)}"+
  ".hba-gpstar{position:fixed;pointer-events:none;z-index:9997;font-size:15px;line-height:1;color:#c4b5fd;text-shadow:0 0 7px rgba(196,181,253,.95),0 0 2px #fff;transform:translate(-50%,-50%)}"+
  /* 🔴 v553 百战兽人·狂暴怒嚎百战连锤: 狂暴虚影/粗音浪/碎石跳/充能/岩浆滴/熔岩柱/尘墙 */
  ".hba-hq4rage{position:fixed;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-hq4rage img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 14px rgba(239,68,68,.85)) drop-shadow(0 0 4px rgba(251,146,60,.9)) saturate(1.4) brightness(1.08)}"+
  ".hba-hq4roar{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;border:5px solid #fb923c;outline:3px solid rgba(163,230,53,.85);outline-offset:-9px;transform:translate(-50%,-50%) scale(.25);opacity:.95;box-shadow:0 0 16px rgba(251,146,60,.9),inset 0 0 12px rgba(163,230,53,.5)}"+
  ".hba-hq4roar.go{transition:transform .62s cubic-bezier(.2,.7,.3,1),opacity .62s ease-out;transform:translate(-50%,-50%) scale(4.4);opacity:0}"+
  ".hba-hq4pebble{position:fixed;pointer-events:none;z-index:9990;border-radius:2px;background:linear-gradient(150deg,#7a6150,#3e2f24 60%,#241a14);box-shadow:inset 0 1px 1px rgba(255,255,255,.18)}"+
  ".hba-hq4charge{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(254,243,199,.95) 0%,rgba(251,146,60,.7) 36%,rgba(220,38,38,.35) 62%,transparent 76%);opacity:0}"+
  ".hba-hq4drip{position:fixed;pointer-events:none;z-index:9997;border-radius:50% 50% 60% 60%;background:radial-gradient(circle at 38% 30%,#fef3c7,#fb923c 55%,#dc2626);box-shadow:0 0 7px rgba(251,146,60,.95)}"+
  ".hba-hq4lava{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-100%) scaleY(0);transform-origin:bottom center;border-radius:7px 7px 3px 3px;background:linear-gradient(180deg,#fef3c7 0%,#fb923c 34%,#ef4444 70%,#991b1b 100%);box-shadow:0 0 12px rgba(251,146,60,.9)}"+
  ".hba-hq4lava.go{transition:transform .3s cubic-bezier(.2,.8,.3,1.2),opacity .5s ease-out .22s;transform:translate(-50%,-100%) scaleY(1);opacity:0}"+
  ".hba-hq4dustwall{position:fixed;pointer-events:none;z-index:9989;border-radius:50%;background:radial-gradient(ellipse at 50% 100%,rgba(140,120,100,.55),rgba(90,76,62,.25) 58%,transparent 78%)}"+
  /* 🔴 v554 史前霸王龙·灭绝之咬: 霸主虚影/咆哮波/碎石/巨颚/咬合闪/碎屑/撕痕/陨石/火星/化石环/琥珀晶/石化尘 */
  ".hba-rx2apex{position:fixed;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-rx2apex img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 0 14px rgba(220,38,38,.85)) drop-shadow(0 0 4px rgba(245,158,11,.9)) saturate(1.35) brightness(1.06)}"+
  ".hba-rx2wave{position:fixed;pointer-events:none;z-index:9992}"+
  ".hba-rx2peb{position:fixed;pointer-events:none;z-index:9990;border-radius:2px;background:linear-gradient(150deg,#8a6d50,#4e3a24 60%,#2c2014);box-shadow:inset 0 1px 1px rgba(255,255,255,.18)}"+
  ".hba-rx2jaw{position:fixed;pointer-events:none;z-index:9996;filter:drop-shadow(0 0 9px rgba(245,158,11,.55))}"+
  ".hba-rx2biteflash{position:fixed;pointer-events:none;z-index:9998;border-radius:50%;transform:translate(-50%,-50%) scale(.25);opacity:.95;background:radial-gradient(circle,#fff 0%,#fde68a 42%,rgba(245,158,11,.55) 66%,transparent 78%)}"+
  ".hba-rx2biteflash.go{transition:transform .28s ease-out,opacity .28s ease-out;transform:translate(-50%,-50%) scale(1.7);opacity:0}"+
  ".hba-rx2biteflash.big.go{transition-duration:.32s;transform:translate(-50%,-50%) scale(2.1)}"+
  ".hba-rx2chip{position:fixed;pointer-events:none;z-index:9997;border-radius:1.5px;background:linear-gradient(140deg,#fef3c7,#f59e0b 55%,#b45309);box-shadow:0 0 4px rgba(245,158,11,.8)}"+
  ".hba-rx2tear{position:fixed;pointer-events:none;z-index:9997}"+
  ".hba-rx2meteor{position:fixed;pointer-events:none;z-index:9997;filter:drop-shadow(0 0 14px rgba(251,146,60,.95)) drop-shadow(0 0 4px rgba(254,243,199,.9))}"+
  ".hba-rx2spark{position:fixed;pointer-events:none;z-index:9996;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#fb923c 60%,#dc2626);box-shadow:0 0 6px rgba(251,146,60,.9)}"+
  ".hba-rx2fossil{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%) scale(.25);opacity:.95}"+
  ".hba-rx2fossil.go{transition:transform .72s cubic-bezier(.2,.7,.3,1),opacity .72s ease-out .18s;transform:translate(-50%,-50%) scale(1.75);opacity:0}"+
  ".hba-rx2amber{position:fixed;pointer-events:none;z-index:9995;transform-origin:bottom center;clip-path:polygon(50% 0,100% 30%,82% 100%,18% 100%,0 30%);background:linear-gradient(180deg,#fef3c7 0%,#fbbf24 38%,#d97706 78%,#92400e 100%);box-shadow:0 0 9px rgba(245,158,11,.85)}"+
  ".hba-rx2dust{position:fixed;pointer-events:none;z-index:9989;border-radius:50%;background:radial-gradient(circle,rgba(241,245,249,.65),rgba(203,213,225,.3) 60%,transparent)}"+
  /* 🔴 v555: 史前霸王龙(Lv4)远古之怒·灭绝之颚——Hansen 亲制真图四件套: 虚影/咆哮波/刀光/爪痕/命中闪/碎屑/双颚/血条出血层/血珠 */
  ".hba-rf-apex{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);opacity:1}"+
  ".hba-rf-apex img{width:100%;height:100%;object-fit:contain;display:block;filter:brightness(.42) saturate(2.2) drop-shadow(0 0 16px rgba(255,60,30,.9)) drop-shadow(0 0 40px rgba(255,120,40,.55))}"+
  ".hba-rf-wave{position:fixed;pointer-events:none;z-index:9994;opacity:1}"+
  ".hba-rf-slash{position:fixed;pointer-events:none;z-index:9996;border-radius:6px;opacity:1;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95) 35%,rgba(255,230,180,.95) 60%,transparent);box-shadow:0 0 14px rgba(255,255,255,.8),0 0 30px rgba(255,180,80,.6)}"+
  ".hba-rf-claw{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity}"+
  ".hba-rf-claw img{width:100%;height:100%;object-fit:contain;display:block;filter:brightness(1.22) saturate(1.3) drop-shadow(0 0 16px rgba(255,160,50,1)) drop-shadow(0 0 44px rgba(255,90,20,.65))}"+
  ".hba-rf-jaw{position:fixed;pointer-events:none;z-index:9998;left:0;top:0;opacity:1;will-change:transform}"+
  ".hba-rf-jaw img{width:100%;height:100%;object-fit:fill;display:block;filter:drop-shadow(0 0 12px rgba(255,170,60,.75)) drop-shadow(0 0 34px rgba(255,110,30,.4))}"+
  ".hba-rf-flash{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;background:radial-gradient(ellipse,rgba(255,255,255,.95),rgba(255,210,130,.6) 45%,transparent 72%)}"+
  ".hba-rf-big{z-index:9997;background:radial-gradient(ellipse,rgba(255,255,255,1),rgba(255,200,110,.7) 40%,rgba(255,120,40,.3) 62%,transparent 78%)}"+
  ".hba-rf-deb{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);opacity:1;border-radius:24%;background:linear-gradient(135deg,#fcd34d,#b45309);box-shadow:0 0 6px rgba(251,191,36,.8)}"+
  ".hba-rf-bleed{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:6px;opacity:0;background:linear-gradient(90deg,rgba(220,38,38,.88),rgba(255,80,60,.95) 50%,rgba(220,38,38,.88));box-shadow:0 0 12px rgba(239,68,68,.9),0 0 26px rgba(220,38,38,.6)}"+
  ".hba-rf-drip{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);opacity:1;border-radius:50% 50% 60% 60%/40% 40% 70% 70%;background:linear-gradient(180deg,#ef4444,#991b1b);box-shadow:0 0 5px rgba(239,68,68,.7)}"+
  /* 🔴 v558: 千年僵尸(Lv5)封印百拳·定身符爆——虚影/磷火/符/波纹环/束缚圈/金碎片/单拳/命中闪/冲击环/速度线/符纸屑/百拳全景/总攻闪 */
  ".hba-zs-apex{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);opacity:1}"+
  ".hba-zs-apex img{width:100%;height:100%;object-fit:contain;display:block;filter:brightness(.4) saturate(1.6) drop-shadow(0 0 14px rgba(132,204,22,.95)) drop-shadow(0 0 36px rgba(74,222,128,.5))}"+
  ".hba-zs-ghfire{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%);opacity:1;border-radius:50% 50% 35% 35%/60% 60% 40% 40%;background:radial-gradient(ellipse at 50% 70%,rgba(190,242,100,.95),rgba(74,222,128,.7) 50%,rgba(34,197,94,0) 78%);filter:blur(.5px)}"+
  ".hba-zs-tali{position:fixed;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity}"+
  ".hba-zs-tali img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 10px rgba(255,200,60,.85)) drop-shadow(0 0 26px rgba(255,160,30,.45))}"+
  ".hba-zs-ring{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px solid rgba(255,210,80,.95);box-shadow:0 0 12px rgba(255,190,50,.8),inset 0 0 8px rgba(255,220,120,.6)}"+
  ".hba-zs-bind{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px dashed rgba(255,200,60,.95);box-shadow:0 0 14px rgba(255,180,40,.7)}"+
  ".hba-zs-shard{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);opacity:1;border-radius:18%;background:linear-gradient(135deg,#fde68a,#f59e0b);box-shadow:0 0 8px rgba(251,191,36,.9)}"+
  ".hba-zs-fist{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity,filter}"+
  ".hba-zs-fist img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 10px rgba(148,163,184,.7)) drop-shadow(0 0 24px rgba(74,222,128,.35))}"+
  ".hba-zs-flash{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;background:radial-gradient(ellipse,rgba(255,255,255,.95),rgba(220,240,200,.55) 45%,transparent 72%)}"+
  ".hba-zs-impact{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 10px rgba(255,255,255,.7)}"+
  ".hba-zs-line{position:fixed;pointer-events:none;z-index:9995;opacity:1;border-radius:4px;background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(255,255,255,0))}"+
  ".hba-zs-paper{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%);opacity:1;border-radius:12%;background:linear-gradient(180deg,#fcd34d,#f59e0b);border:1px solid rgba(180,83,9,.7);box-shadow:0 0 5px rgba(251,191,36,.6)}"+
  ".hba-zs-all{position:fixed;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity,filter}"+
  ".hba-zs-all img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 18px rgba(132,204,22,.5))}"+
  ".hba-zs-bigflash{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);border-radius:50%;opacity:1;background:radial-gradient(ellipse,rgba(255,255,255,1),rgba(230,250,210,.65) 42%,rgba(190,242,100,.25) 62%,transparent 78%)}"+
  /* 🔴 v559: 千年僵尸(Lv5)定身符咒·万拳齐发——二代素材(尸气爆发拳), 虚影/磷火/符/环/束缚/碎片/纸屑沿 v558 视觉语言, 新前缀 hba-zf */
  ".hba-zf-apex{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);opacity:1}"+
  ".hba-zf-apex img{width:100%;height:100%;object-fit:contain;display:block;filter:brightness(.4) saturate(1.6) drop-shadow(0 0 14px rgba(132,204,22,.95)) drop-shadow(0 0 36px rgba(74,222,128,.5))}"+
  ".hba-zf-ghfire{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%);opacity:1;border-radius:50% 50% 35% 35%/60% 60% 40% 40%;background:radial-gradient(ellipse at 50% 70%,rgba(190,242,100,.95),rgba(74,222,128,.7) 50%,rgba(34,197,94,0) 78%);filter:blur(.5px)}"+
  ".hba-zf-tali{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity}"+
  ".hba-zf-tali img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 10px rgba(255,200,60,.85)) drop-shadow(0 0 26px rgba(255,160,30,.45))}"+
  ".hba-zf-ring{position:fixed;pointer-events:none;z-index:9995;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px solid rgba(255,210,80,.95);box-shadow:0 0 12px rgba(255,190,50,.8),inset 0 0 8px rgba(255,220,120,.6)}"+
  ".hba-zf-bind{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px dashed rgba(255,200,60,.95);box-shadow:0 0 14px rgba(255,180,40,.7)}"+
  ".hba-zf-shard{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);opacity:1;border-radius:18%;background:linear-gradient(135deg,#fde68a,#f59e0b);box-shadow:0 0 8px rgba(251,191,36,.9)}"+
  ".hba-zf-fist{position:fixed;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity,filter}"+
  ".hba-zf-fist img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 12px rgba(74,222,128,.6))}"+
  ".hba-zf-flash{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;background:radial-gradient(ellipse,rgba(255,255,255,.95),rgba(220,240,200,.55) 45%,transparent 72%)}"+
  ".hba-zf-impact{position:fixed;pointer-events:none;z-index:9996;transform:translate(-50%,-50%);border-radius:50%;opacity:1;border:3px solid rgba(255,255,255,.95);box-shadow:0 0 10px rgba(255,255,255,.7)}"+
  ".hba-zf-line{position:fixed;pointer-events:none;z-index:9995;opacity:1;border-radius:4px;background:linear-gradient(90deg,rgba(255,255,255,.95),rgba(255,255,255,0))}"+
  ".hba-zf-paper{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%);opacity:1;border-radius:12%;background:linear-gradient(180deg,#fcd34d,#f59e0b);border:1px solid rgba(180,83,9,.7);box-shadow:0 0 5px rgba(251,191,36,.6)}"+
  ".hba-zf-all{position:fixed;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);opacity:1;will-change:transform,opacity,filter}"+
  ".hba-zf-all img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 0 18px rgba(132,204,22,.55))}"+
  ".hba-zf-bigflash{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);border-radius:50%;opacity:1;background:radial-gradient(ellipse,rgba(255,255,255,1),rgba(230,250,210,.65) 42%,rgba(190,242,100,.25) 62%,transparent 78%)}"+
  /* 🔴 v560: 雷电之主二代——噪声真实乌云容器 + 真雷电(禁 drop-shadow) + 空气辉光 */
  ".hba-tl2-cloud{position:fixed;left:0;top:0;width:100%;pointer-events:none;z-index:9986;transform:translateY(-150px);opacity:0;transition:transform .9s cubic-bezier(.22,.8,.3,1.02),opacity .9s}"+
  ".hba-tl2-cloud.tl2in{transform:translateY(0);opacity:1}"+
  ".hba-tl2-cloud svg{display:block;width:100%;height:100%}"+
  ".hba-tl2-cloud .tl2-back{animation:hbaTl2d1 26s ease-in-out infinite alternate}"+
  ".hba-tl2-cloud .tl2-mid{animation:hbaTl2d2 19s ease-in-out infinite alternate}"+
  ".hba-tl2-cloud .tl2-front{animation:hbaTl2d3 14s ease-in-out infinite alternate}"+
  "@keyframes hbaTl2d1{0%{transform:translateX(-14px)}100%{transform:translateX(14px)}}"+
  "@keyframes hbaTl2d2{0%{transform:translateX(12px)}100%{transform:translateX(-12px)}}"+
  "@keyframes hbaTl2d3{0%{transform:translateX(-8px) translateY(0)}100%{transform:translateX(8px) translateY(3px)}}"+
  ".hba-tl2-bolt{position:fixed;pointer-events:none;z-index:9992;opacity:0;will-change:opacity,transform}"+
  ".hba-tl2-bolt img{width:100%;height:100%;display:block;object-fit:fill}"+
  ".hba-tl2-airglow{position:fixed;pointer-events:none;z-index:9991;opacity:0;border-radius:50%;background:radial-gradient(ellipse,rgba(186,230,253,.55),rgba(56,189,248,.22) 45%,transparent 72%)}"+
  /* 🔴 v513: 史前霸王龙(Lv4)远古霸主连击——①震地咆哮(双冲击环+三音波+碎石浮起+余烬+天色泛黄) ②地面冲击浪 ③能量巨爪左右双扫·各三道平行撕痕+火星 ④霸王巨口上下颌咬合·爆闪+冲击环+碎片。全SVG内联无外部图·琥珀色硬编码·hba-rx前缀·全fixed贴body·零震屏零屏闪(仅柔光)。 */
  ".hba-rxsky{position:fixed;left:0;right:0;top:0;height:70px;pointer-events:none;z-index:9986;background:linear-gradient(to bottom,rgba(245,158,11,.4),transparent);opacity:0}"+
  ".hba-rxvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 70px rgba(245,158,11,.4);opacity:0}"+
  ".hba-rxring{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;border:3px solid #f59e0b;transform:translate(-50%,-50%) scale(.25);opacity:0;box-shadow:0 0 10px rgba(245,158,11,.9)}"+
  ".hba-rxring.go{animation:hbaRxRing .42s ease-out forwards}"+
  ".hba-rxring.r2{border-width:2px;border-color:#fde68a}"+
  ".hba-rxring.r2.go{animation:hbaRxRing .55s ease-out forwards}"+
  "@keyframes hbaRxRing{0%{transform:translate(-50%,-50%) scale(.25);opacity:.95}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-rxwave{position:fixed;pointer-events:none;z-index:9991;will-change:transform,opacity}"+
  ".hba-rxwave svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-rxpeb{position:fixed;pointer-events:none;z-index:9989;border-radius:3px;background:linear-gradient(150deg,#7a6150,#3e2f24 60%,#241a14);box-shadow:0 0 6px rgba(245,158,11,.4)}"+
  ".hba-rxember{position:fixed;pointer-events:none;z-index:9990;width:4px;height:4px;border-radius:50%;background:radial-gradient(circle,#fff,#f59e0b 65%,transparent);box-shadow:0 0 5px rgba(245,158,11,.9)}"+
  ".hba-rxgwave{position:fixed;pointer-events:none;z-index:9991;will-change:transform,opacity}"+
  ".hba-rxgwave .arc{width:100%;height:100%;border-radius:50% 50% 0 0/100% 100% 0 0;border-top:4px solid #f59e0b;border-left:3px solid transparent;border-right:3px solid transparent;box-shadow:0 -4px 14px rgba(245,158,11,.9);background:linear-gradient(to top,transparent,rgba(245,158,11,.4))}"+
  ".hba-rxgdust{position:fixed;pointer-events:none;z-index:9990;border-radius:50%;background:radial-gradient(circle,rgba(150,126,100,.55),rgba(90,76,62,.22) 60%,transparent)}"+
  ".hba-rxpaw{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 14px rgba(245,158,11,.9))}"+
  ".hba-rxpaw svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-rxtear{position:fixed;pointer-events:none;z-index:9993;filter:drop-shadow(0 0 8px rgba(245,158,11,.9))}"+
  ".hba-rxtear .inner{width:100%;height:100%;transform:scaleX(0);will-change:transform}"+
  ".hba-rxtear svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-rxspark{position:fixed;pointer-events:none;z-index:9998;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#f59e0b 60%,#b45309);box-shadow:0 0 6px rgba(245,158,11,.9)}"+
  ".hba-rxjaw{position:fixed;pointer-events:none;z-index:9996;will-change:transform;filter:drop-shadow(0 0 12px rgba(245,158,11,.9))}"+
  ".hba-rxjaw svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-rxflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fde68a 45%,transparent 70%);opacity:0}"+
  ".hba-rxflash.go{animation:hbaRxFlash .3s ease-out forwards}"+
  "@keyframes hbaRxFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}"+
  ".hba-rxchompring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #f59e0b;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(245,158,11,.9)}"+
  ".hba-rxchompring.go{animation:hbaRxChompRing .5s ease-out forwards}"+
  "@keyframes hbaRxChompRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-rxshard{position:fixed;pointer-events:none;z-index:9997;width:7px;height:7px;border-radius:1px}"+
  /* 🔴 v514: 千年僵尸(Lv5)符咒尸毒连击——①阴风鬼火(天色泛绿+鬼火飘摇+阴风纹) ②飞符诅咒(黄纸红符旋转飞出贴勇者头顶·红光连闪) ③双尸爪抓击(青绿长甲爪左右交错·各三道腐蚀爪痕冒毒泡+毒滴) ④尸毒爆发(符咒炸裂引爆·毒云+毒泡升腾+毒液四溅+冲击环+柔光)。全SVG内联无外部图·尸毒绿硬编码(符咒黄纸红符固定)·hba-zb前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-zbsky{position:fixed;left:0;right:0;top:0;height:70px;pointer-events:none;z-index:9986;background:linear-gradient(to bottom,rgba(132,204,22,.4),transparent);opacity:0}"+
  ".hba-zbvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 70px rgba(132,204,22,.4);opacity:0}"+
  ".hba-zbwisp{position:fixed;pointer-events:none;z-index:9990;border-radius:50%;background:radial-gradient(circle at 50% 60%,#fff 0%,#d9f99d 24%,#84cc16 55%,transparent 78%);filter:blur(.7px);box-shadow:0 0 14px rgba(132,204,22,.9);will-change:transform,opacity}"+
  ".hba-zbwind{position:fixed;pointer-events:none;z-index:9989;will-change:transform,opacity}"+
  ".hba-zbwind svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-zbtalis{position:fixed;pointer-events:none;z-index:9996;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(250,204,21,.8))}"+
  ".hba-zbtalis svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-zbtring{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;border:2.5px solid #fde047;transform:translate(-50%,-50%) scale(.3);opacity:0;box-shadow:0 0 10px rgba(250,204,21,.85)}"+
  ".hba-zbtring.go{animation:hbaZbTring .42s ease-out forwards}"+
  "@keyframes hbaZbTring{0%{transform:translate(-50%,-50%) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}"+
  ".hba-zbclaw{position:fixed;pointer-events:none;z-index:9994;will-change:transform,opacity;filter:drop-shadow(0 0 14px rgba(132,204,22,.9))}"+
  ".hba-zbclaw svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-zbtear{position:fixed;pointer-events:none;z-index:9992;filter:drop-shadow(0 0 8px rgba(132,204,22,.9))}"+
  ".hba-zbtear .inner{width:100%;height:100%;transform:scaleX(0);will-change:transform}"+
  ".hba-zbtear svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-zbbub{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;border:1.5px solid #d9f99d;background:radial-gradient(circle at 36% 32%,rgba(255,255,255,.6),rgba(132,204,22,.4) 50%,transparent 80%);box-shadow:0 0 7px rgba(132,204,22,.9);will-change:transform,opacity}"+
  ".hba-zbdrop{position:fixed;pointer-events:none;z-index:9998;width:6px;height:8px;border-radius:50% 50% 60% 60%;background:radial-gradient(circle at 40% 30%,#fff,#84cc16 55%,#3f6212);box-shadow:0 0 6px rgba(132,204,22,.9)}"+
  ".hba-zbcloud{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;background:radial-gradient(circle,#d9f99d 0%,#84cc16 38%,rgba(132,204,22,.4) 62%,transparent 80%);filter:blur(2px);opacity:0;will-change:transform,opacity}"+
  ".hba-zbflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#d9f99d 45%,transparent 70%);opacity:0}"+
  ".hba-zbflash.go{animation:hbaZbFlash .3s ease-out forwards}"+
  "@keyframes hbaZbFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}"+
  ".hba-zbring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #84cc16;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(132,204,22,.9)}"+
  ".hba-zbring.go{animation:hbaZbRing .5s ease-out forwards}"+
  "@keyframes hbaZbRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-zbtshard{position:fixed;pointer-events:none;z-index:9997;width:8px;height:10px;border-radius:1px;background:linear-gradient(160deg,#fde047,#facc15 60%,#b45309)}"+
  /* 🔴 v515: 暗夜吸血鬼(Lv6)血月蝠群噬血连击——①血月升起(夜幕+剪影掠月) ②蝙蝠群袭(扇翅划弧扑勇者·命中蝠烟+红环) ③獠牙咬合(复用v506四颗真牙图·上下精确咬合血条·泛红滴血·deal) ④吸血回流(血球拖尾吸回血月·月亮胀亮+血光柔震)。血月红硬编码·hba-vm前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-vmnight{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(60,8,20,.34),transparent 56%);opacity:0}"+
  ".hba-vmvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(239,68,68,.38);opacity:0}"+
  ".hba-vmmoon{position:fixed;pointer-events:none;z-index:9987;border-radius:50%;background:radial-gradient(circle at 38% 34%,#fda4af 0%,#ef4444 42%,#7f1d1d 78%,#3b0a12 100%);box-shadow:0 0 26px rgba(239,68,68,.9),0 0 60px rgba(239,68,68,.38),inset -6px -8px 18px rgba(0,0,0,.4);opacity:0;will-change:transform,opacity}"+
  ".hba-vmmoon::after{content:'';position:absolute;left:22%;top:26%;width:18%;height:18%;border-radius:50%;background:rgba(0,0,0,.18)}"+
  ".hba-vmmoon::before{content:'';position:absolute;left:56%;top:52%;width:12%;height:12%;border-radius:50%;background:rgba(0,0,0,.15)}"+
  ".hba-vmbat{position:fixed;pointer-events:none;z-index:9994;will-change:transform,opacity;filter:drop-shadow(0 0 7px rgba(239,68,68,.38))}"+
  ".hba-vmbat svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-vmbat .wl{transform-origin:62% 50%;animation:hbaVmFlapL .17s ease-in-out infinite alternate}"+
  ".hba-vmbat .wr{transform-origin:38% 50%;animation:hbaVmFlapR .17s ease-in-out infinite alternate}"+
  "@keyframes hbaVmFlapL{0%{transform:rotate(16deg)}100%{transform:rotate(-26deg)}}"+
  "@keyframes hbaVmFlapR{0%{transform:rotate(-16deg)}100%{transform:rotate(26deg)}}"+
  ".hba-vmpuff{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;background:radial-gradient(circle,#fecaca 0%,#ef4444 36%,rgba(239,68,68,.38) 62%,transparent 80%);filter:blur(1.5px);opacity:0;will-change:transform,opacity}"+
  ".hba-vmring{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;border:2px solid #ef4444;transform:translate(-50%,-50%) scale(.3);opacity:0;box-shadow:0 0 8px rgba(239,68,68,.9)}"+
  ".hba-vmring.go{animation:hbaVmRing .4s ease-out forwards}"+
  "@keyframes hbaVmRing{0%{transform:translate(-50%,-50%) scale(.3);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.8);opacity:0}}"+
  ".hba-vmdrip{position:fixed;pointer-events:none;z-index:9998;width:7px;height:10px;border-radius:50% 50% 62% 62%;background:radial-gradient(circle at 40% 28%,#fda4af,#ef4444 55%,#7f1d1d);box-shadow:0 0 6px rgba(239,68,68,.9)}"+
  ".hba-vmorb{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;background:radial-gradient(circle at 38% 32%,#fff 0%,#fecaca 28%,#ef4444 62%,transparent 82%);box-shadow:0 0 10px rgba(239,68,68,.9);will-change:transform,opacity}"+
  ".hba-vmtrail{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;background:radial-gradient(circle,#ef4444,transparent 70%);opacity:.8}"+
  ".hba-vmflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fecaca 45%,transparent 70%);opacity:0}"+
  ".hba-vmflash.go{animation:hbaVmFlash .3s ease-out forwards}"+
  "@keyframes hbaVmFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  /* 🔴 v516: 蒙面大魔王(Lv7)黑暗领域千面幻杀——①黑暗领域(暗紫降临+双环魔法阵反向旋转+魔气) ②千面分裂(幻影面具按立绘: 紫脸+金冠红宝石+黄眼+红面罩·悬停浮动) ③锁定齐袭(眼齐亮→逐个旋转俯冲撞勇者·紫碎闪+环+金色连击数字) ④魔王终结(暗黑核→横贯暗黑冲击波+碎片+紫光柔震·deal)。魔王紫硬编码(面具金/红固定)·hba-mk前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-mkdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(40,10,60,.4),transparent 60%);opacity:0}"+
  ".hba-mkvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(168,85,247,.38);opacity:0}"+
  ".hba-mkcircle{position:fixed;pointer-events:none;z-index:9988;opacity:0;will-change:transform,opacity}"+
  ".hba-mkcircle svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-mkcircle .ringO{transform-origin:50% 50%;animation:hbaMkSpinO 5s linear infinite}"+
  ".hba-mkcircle .ringI{transform-origin:50% 50%;animation:hbaMkSpinI 3.6s linear infinite}"+
  "@keyframes hbaMkSpinO{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}"+
  "@keyframes hbaMkSpinI{0%{transform:rotate(0deg)}100%{transform:rotate(-360deg)}}"+
  ".hba-mkmote{position:fixed;pointer-events:none;z-index:9990;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#a855f7 60%,transparent);box-shadow:0 0 6px rgba(168,85,247,.9)}"+
  ".hba-mkmask{position:fixed;pointer-events:none;z-index:9994;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(168,85,247,.38))}"+
  ".hba-mkmask svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-mkmask.hover{animation:hbaMkHover 1.1s ease-in-out infinite alternate}"+
  "@keyframes hbaMkHover{0%{margin-top:0}100%{margin-top:-5px}}"+
  ".hba-mkmask .meye{opacity:.32;transition:opacity .12s}"+
  ".hba-mkmask.lock{filter:drop-shadow(0 0 14px rgba(250,204,21,.85)) drop-shadow(0 0 8px rgba(168,85,247,.9))}"+
  ".hba-mkmask.lock .meye{opacity:1}"+
  ".hba-mkcrack{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#e9d5ff 40%,transparent 70%);opacity:0}"+
  ".hba-mkcrack.go{animation:hbaMkCrack .3s ease-out forwards}"+
  "@keyframes hbaMkCrack{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.35);opacity:0}}"+
  ".hba-mkring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:2px solid #a855f7;transform:translate(-50%,-50%) scale(.3);opacity:0;box-shadow:0 0 8px rgba(168,85,247,.9)}"+
  ".hba-mkring.go{animation:hbaMkRing .4s ease-out forwards}"+
  "@keyframes hbaMkRing{0%{transform:translate(-50%,-50%) scale(.3);opacity:.9}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-mkcore{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;background:radial-gradient(circle at 40% 36%,#e9d5ff 0%,#a855f7 30%,#1a0626 70%,#000 100%);box-shadow:0 0 18px rgba(168,85,247,.9),0 0 38px rgba(168,85,247,.38);will-change:transform,opacity}"+
  ".hba-mkwave{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity}"+
  ".hba-mkwave .arc{width:100%;height:100%;border-radius:50% 50% 0 0/100% 100% 0 0;border-top:5px solid #a855f7;border-left:4px solid transparent;border-right:4px solid transparent;box-shadow:0 -5px 18px rgba(168,85,247,.9);background:linear-gradient(to top,transparent,rgba(168,85,247,.38))}"+
  ".hba-mkshard{position:fixed;pointer-events:none;z-index:9997;width:7px;height:7px;border-radius:1px}"+
  ".hba-mkflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#e9d5ff 45%,transparent 70%);opacity:0}"+
  ".hba-mkflash.go{animation:hbaMkFlash .32s ease-out forwards}"+
  "@keyframes hbaMkFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}"+
  ".hba-mkcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-mkcombo.go{animation:hbaMkCombo .5s ease-out forwards}"+
  "@keyframes hbaMkCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v517: 地狱犬王(Lv8)地狱之门三头炼狱——①地狱之门(半透明炉光黑石拱门在boss身后升起·门内火光脉动门口火苗·boss剪影于门火前) ②三头齐啸(左中右三头各两道啸波·地面火苗窜高) ③三头火球三连射(左→右→中·中头最大·rAF贝塞尔+火尾·连击数字) ④合体炼狱炎息(三核汇聚大核→锥形火焰吐息直灌勇者·烧灼爆燃+火环+碎片+浓烟+柔震·deal)。炼狱橙硬编码·hba-hg前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-hgdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(80,18,8,.42),transparent 58%);opacity:0}"+
  ".hba-hgvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(249,115,22,.38);opacity:0}"+
  ".hba-hggate{position:fixed;pointer-events:none;z-index:9987;opacity:0;will-change:transform,opacity}"+
  ".hba-hggate svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-hggate .ginner{animation:hbaHgGatePulse 1.2s ease-in-out infinite alternate}"+
  "@keyframes hbaHgGatePulse{0%{opacity:.35}100%{opacity:.7}}"+
  ".hba-hggate .gfl{transform-origin:50% 100%;animation:hbaHgGateFlick .3s ease-in-out infinite alternate}"+
  ".hba-hggate .gfl2{transform-origin:50% 100%;animation:hbaHgGateFlick .26s .1s ease-in-out infinite alternate}"+
  "@keyframes hbaHgGateFlick{0%{transform:scaleY(.85)}100%{transform:scaleY(1.12)}}"+
  ".hba-hgwave{position:fixed;pointer-events:none;z-index:9991;will-change:transform,opacity}"+
  ".hba-hgwave svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-hgflame{position:fixed;pointer-events:none;z-index:9990;transform-origin:50% 100%;will-change:transform,opacity}"+
  ".hba-hgflame svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-hgball{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#fde68a 26%,#f97316 58%,#b91c1c 86%);box-shadow:0 0 14px rgba(249,115,22,.9),0 0 30px rgba(249,115,22,.38);will-change:transform,opacity}"+
  ".hba-hgtrail{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;background:radial-gradient(circle,#f97316,transparent 70%);opacity:.85}"+
  ".hba-hgburst{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#fde68a 40%,transparent 70%);opacity:0}"+
  ".hba-hgburst.go{animation:hbaHgBurst .3s ease-out forwards}"+
  "@keyframes hbaHgBurst{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.4);opacity:0}}"+
  ".hba-hgcore{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#fde68a 30%,#f97316 62%,#b91c1c 92%);box-shadow:0 0 16px rgba(249,115,22,.9),0 0 34px rgba(249,115,22,.38);will-change:transform,opacity}"+
  ".hba-hgbeam{position:fixed;pointer-events:none;z-index:9992;transform-origin:50% 0;will-change:transform,opacity}"+
  ".hba-hgbeam .bouter{position:absolute;inset:0;background:linear-gradient(to bottom,#fde68a,#f97316 45%,#b91c1c);clip-path:polygon(44% 0,56% 0,84% 100%,16% 100%);filter:blur(.5px);opacity:.92}"+
  ".hba-hgbeam .binner{position:absolute;inset:0;background:linear-gradient(to bottom,#fff,#fde68a 70%,transparent);clip-path:polygon(47.5% 0,52.5% 0,68% 100%,32% 100%);animation:hbaHgBeamFlick .14s ease-in-out infinite alternate}"+
  "@keyframes hbaHgBeamFlick{0%{opacity:.75}100%{opacity:1}}"+
  ".hba-hgember{position:fixed;pointer-events:none;z-index:9996;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#f97316 60%,transparent);box-shadow:0 0 6px rgba(249,115,22,.9)}"+
  ".hba-hgsmoke{position:fixed;pointer-events:none;z-index:9991;border-radius:50%;background:radial-gradient(circle,rgba(80,60,50,.5),rgba(50,38,30,.2) 60%,transparent);filter:blur(2px)}"+
  ".hba-hgflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fde68a 45%,transparent 70%);opacity:0}"+
  ".hba-hgflash.go{animation:hbaHgFlash .32s ease-out forwards}"+
  "@keyframes hbaHgFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}"+
  ".hba-hgring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #f97316;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(249,115,22,.9)}"+
  ".hba-hgring.go{animation:hbaHgRing .5s ease-out forwards}"+
  "@keyframes hbaHgRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-hgshard{position:fixed;pointer-events:none;z-index:9997;width:7px;height:7px;border-radius:1px}"+
  ".hba-hgcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-hgcombo.go{animation:hbaHgCombo .5s ease-out forwards}"+
  "@keyframes hbaHgCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v518: 黑森林巫婆(Lv9)黑森林魔药毒苹果盛宴——①黑森林降临(巫毒紫天色+荆棘藤蔓两侧爬入+萤绿孢子) ②魔药大锅熬煮(三足黑锅升起·锅下紫火苗flicker·锅内绿魔药沸腾·毒泡interval持续上冒) ③毒苹果三连发(锅口蹦出3颗·红果绿叶绿毒裂纹固定配色·rAF贝塞尔旋转+绿毒尾·连击数字) ④荆棘缠杀魔药诅咒(双荆棘从血条下两侧窜出交叉缠紧收勒+锅药冲天·勇者紫绿双色毒雾大爆发+毒泡+毒液+冲击环+柔震·deal)。巫毒紫硬编码(魔药绿/苹果红固定)·hba-wt前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-wtdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(52,12,72,.42),transparent 60%);opacity:0}"+
  ".hba-wtvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(168,85,247,.38);opacity:0}"+
  ".hba-wtvine{position:fixed;pointer-events:none;z-index:9990;will-change:transform,opacity}"+
  ".hba-wtvine .vin{width:100%;height:100%;transform:scaleX(0);will-change:transform}"+
  ".hba-wtvine svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-wtspore{position:fixed;pointer-events:none;z-index:9989;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#a3e635 60%,transparent);box-shadow:0 0 6px rgba(163,230,53,.85)}"+
  ".hba-wtcauldron{position:fixed;pointer-events:none;z-index:9992;opacity:0;will-change:transform,opacity}"+
  ".hba-wtcauldron svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-wtcauldron .cfl{transform-origin:50% 100%;animation:hbaWtCFlick .3s ease-in-out infinite alternate}"+
  ".hba-wtcauldron .cfl2{transform-origin:50% 100%;animation:hbaWtCFlick .26s .1s ease-in-out infinite alternate}"+
  "@keyframes hbaWtCFlick{0%{transform:scaleY(.85)}100%{transform:scaleY(1.15)}}"+
  ".hba-wtcauldron .brew{animation:hbaWtBrewGlow 1s ease-in-out infinite alternate}"+
  "@keyframes hbaWtBrewGlow{0%{opacity:.8}100%{opacity:1}}"+
  ".hba-wtbub{position:fixed;pointer-events:none;z-index:9995;border-radius:50%;border:1.5px solid #d9f99d;background:radial-gradient(circle at 36% 32%,rgba(255,255,255,.6),rgba(132,204,22,.4) 50%,transparent 80%);box-shadow:0 0 7px rgba(132,204,22,.85);will-change:transform,opacity}"+
  ".hba-wtapple{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 9px rgba(132,204,22,.55))}"+
  ".hba-wtapple svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-wttrail{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;background:radial-gradient(circle,#84cc16,transparent 70%);opacity:.8}"+
  ".hba-wtburst{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#d9f99d 40%,transparent 70%);opacity:0}"+
  ".hba-wtburst.go{animation:hbaWtBurst .3s ease-out forwards}"+
  "@keyframes hbaWtBurst{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.4);opacity:0}}"+
  ".hba-wtcloud{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;filter:blur(2px);opacity:0;will-change:transform,opacity}"+
  ".hba-wtcloud.cp{background:radial-gradient(circle,#e9d5ff 0%,#a855f7 38%,rgba(168,85,247,.38) 62%,transparent 80%)}"+
  ".hba-wtcloud.cg{background:radial-gradient(circle,#d9f99d 0%,#84cc16 38%,rgba(132,204,22,.38) 62%,transparent 80%)}"+
  ".hba-wtdrop{position:fixed;pointer-events:none;z-index:9998;width:6px;height:8px;border-radius:50% 50% 60% 60%;background:radial-gradient(circle at 40% 30%,#fff,#84cc16 55%,#3f6212);box-shadow:0 0 6px rgba(132,204,22,.85)}"+
  ".hba-wtflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#e9d5ff 45%,transparent 70%);opacity:0}"+
  ".hba-wtflash.go{animation:hbaWtFlash .32s ease-out forwards}"+
  "@keyframes hbaWtFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}"+
  ".hba-wtring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #a855f7;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(168,85,247,.9)}"+
  ".hba-wtring.go{animation:hbaWtRing .5s ease-out forwards}"+
  "@keyframes hbaWtRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-wtcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-wtcombo.go{animation:hbaWtCombo .5s ease-out forwards}"+
  "@keyframes hbaWtCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v519: 异次元巫师(Lv10)维度裂隙五元素轮舞——①禁忌吟唱五元素觉醒(火橙/雷金/风青/水蓝/虚空紫立绘配色·绕巫师rAF公转+符文粒) ②空间撕裂(boss右侧空旷区开大锯齿裂隙·boss左侧开小裂口·星空内里+白边shimmer) ③五元素轮舞瞬移连击(球依次钻进小裂口缩小消失→从大裂隙射出贝塞尔砸血条·火爆/雷锯齿闪电/风双环/水花/虚空各带属性·1~5连) ④维度崩塌(裂隙胀亮→斜向五色混沌光柱轰血条·五色碎片15+大环+紫光柔震·deal·双裂隙横向挤压闭合)。异次元紫硬编码(五元素色固定)·hba-xw前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-xwdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(44,12,78,.42),transparent 60%);opacity:0}"+
  ".hba-xwvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(168,85,247,.38);opacity:0}"+
  ".hba-xworb{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;will-change:transform,opacity}"+
  ".hba-xwrune{position:fixed;pointer-events:none;z-index:9989;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#a855f7 60%,transparent);box-shadow:0 0 6px rgba(168,85,247,.9)}"+
  ".hba-xwrift{position:fixed;pointer-events:none;z-index:9992;will-change:transform,opacity;filter:drop-shadow(0 0 14px rgba(168,85,247,.9))}"+
  ".hba-xwrift svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-xwrift .redge{animation:hbaXwRiftShimmer .8s ease-in-out infinite alternate}"+
  "@keyframes hbaXwRiftShimmer{0%{opacity:.55}100%{opacity:1}}"+
  ".hba-xwhit{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.25);opacity:0}"+
  ".hba-xwhit.go{animation:hbaXwHit .3s ease-out forwards}"+
  "@keyframes hbaXwHit{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.4);opacity:0}}"+
  ".hba-xwringhit{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:2px solid #fff;transform:translate(-50%,-50%) scale(.3);opacity:0}"+
  ".hba-xwringhit.go{animation:hbaXwRingHit .42s ease-out forwards}"+
  "@keyframes hbaXwRingHit{0%{transform:translate(-50%,-50%) scale(.3);opacity:.92}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-xwspark{position:fixed;pointer-events:none;z-index:9998;width:5px;height:5px;border-radius:50%}"+
  ".hba-xwbolt{position:fixed;pointer-events:none;z-index:9998;will-change:opacity}"+
  ".hba-xwbolt svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-xwbeam{position:fixed;pointer-events:none;z-index:9993;transform-origin:50% 0;will-change:transform,opacity}"+
  ".hba-xwbeam .bo{position:absolute;inset:0;background:linear-gradient(to bottom,#f97316,#facc15 26%,#22d3ee 50%,#3b82f6 74%,#a855f7);clip-path:polygon(38% 0,62% 0,78% 100%,22% 100%);filter:blur(.5px);opacity:.92}"+
  ".hba-xwbeam .bi{position:absolute;inset:0;background:linear-gradient(to bottom,#fff,rgba(255,255,255,.7) 70%,transparent);clip-path:polygon(45% 0,55% 0,64% 100%,36% 100%);animation:hbaXwBeamFlick .14s ease-in-out infinite alternate}"+
  "@keyframes hbaXwBeamFlick{0%{opacity:.7}100%{opacity:1}}"+
  ".hba-xwshard{position:fixed;pointer-events:none;z-index:9998;width:7px;height:7px;border-radius:1px}"+
  ".hba-xwflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#e9d5ff 45%,transparent 70%);opacity:0}"+
  ".hba-xwflash.go{animation:hbaXwFlash .34s ease-out forwards}"+
  "@keyframes hbaXwFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.8);opacity:0}}"+
  ".hba-xwringbig{position:fixed;pointer-events:none;z-index:9998;border-radius:50%;border:3px solid #a855f7;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(168,85,247,.9)}"+
  ".hba-xwringbig.go{animation:hbaXwRingBig .5s ease-out forwards}"+
  "@keyframes hbaXwRingBig{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-xwcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-xwcombo.go{animation:hbaXwCombo .5s ease-out forwards}"+
  "@keyframes hbaXwCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v520: 龙骑士统帅(Lv11)巨龙之翼焚天枪雨——①巨龙之翼遮天蔽日(升级版SVG巨翼: 双层膜+黑曜金边四指骨+腕部金尖骨爪+焰脉发光+缘光+余烬星点·展开回弹过冲·持续扇动呼吸) ②统帅号令(金色龙魂盘旋一周+龙吼双环+蓄力金光) ③焚天枪雨(Hansen真枪图bosses/dragonlance.webp·预加载decode克隆·12根从翼下垂直坠落+橙色速度残影+贯穿闪+碎星·5根砸血条连击) ④终焉巨枪(巨翼收拢扇下·~2倍巨枪正中贯穿·deal+大爆+火环+碎片+浓烟+地面火舌+柔震·巨枪钉住半秒)。龙焰橙硬编码·hba-dk前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-dkdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(86,16,8,.46),transparent 60%);opacity:0}"+
  ".hba-dkvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(249,115,22,.38);opacity:0}"+
  ".hba-dkwing{position:fixed;pointer-events:none;z-index:9986;will-change:transform,opacity;filter:drop-shadow(0 0 16px rgba(239,68,68,.45))}"+
  ".hba-dkwing svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-dkwing .wflex{width:100%;height:100%;transform-origin:12% 72%;animation:hbaDkBreath 1.5s ease-in-out infinite alternate}"+
  "@keyframes hbaDkBreath{0%{transform:rotate(0deg) translateY(0)}100%{transform:rotate(-2.4deg) translateY(-3px)}}"+
  ".hba-dkwing .wmem{animation:hbaDkGlow 1.1s ease-in-out infinite alternate}"+
  "@keyframes hbaDkGlow{0%{opacity:.86}100%{opacity:1}}"+
  ".hba-dkwing .wvein{animation:hbaDkVein .9s ease-in-out infinite alternate}"+
  "@keyframes hbaDkVein{0%{opacity:.35}100%{opacity:.8}}"+
  ".hba-dkwing .wrim{animation:hbaDkVein 1.2s .2s ease-in-out infinite alternate}"+
  ".hba-dkwing .wtw{animation:hbaDkTw 1s ease-in-out infinite alternate}"+
  ".hba-dkwing .wtw2{animation:hbaDkTw 1.3s .3s ease-in-out infinite alternate}"+
  "@keyframes hbaDkTw{0%{opacity:.25}100%{opacity:1}}"+
  ".hba-dksoul{position:fixed;pointer-events:none;z-index:9992;will-change:transform,opacity}"+
  ".hba-dksoul svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-dkroar{position:fixed;pointer-events:none;z-index:9991;border-radius:50%;border:2.5px solid #fde68a;transform:translate(-50%,-50%) scale(.25);opacity:0;box-shadow:0 0 10px rgba(249,115,22,.9)}"+
  ".hba-dkroar.go{animation:hbaDkRoar .55s ease-out forwards}"+
  "@keyframes hbaDkRoar{0%{transform:translate(-50%,-50%) scale(.25);opacity:.95}100%{transform:translate(-50%,-50%) scale(2.4);opacity:0}}"+
  ".hba-dkcharge{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#fde68a 30%,#f97316 64%,#b91c1c 92%);box-shadow:0 0 16px rgba(249,115,22,.9),0 0 32px rgba(249,115,22,.38);will-change:transform,opacity}"+
  ".hba-dkspear{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 5px rgba(253,230,138,.95)) drop-shadow(0 0 12px rgba(249,115,22,.9))}"+
  ".hba-dkspear img{display:block;width:100%;height:100%;filter:brightness(1.28) contrast(1.06)}"+
  ".hba-dktrailv{position:fixed;pointer-events:none;z-index:9994;width:4px;border-radius:2px;background:linear-gradient(to bottom,transparent,#fde68a 30%,#f97316 75%,transparent);opacity:0;transform-origin:50% 0;filter:blur(.5px)}"+
  ".hba-dkpierce{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#fde68a 42%,transparent 72%);opacity:0}"+
  ".hba-dkpierce.go{animation:hbaDkPierce .3s ease-out forwards}"+
  "@keyframes hbaDkPierce{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  ".hba-dkstar{position:fixed;pointer-events:none;z-index:9998;width:6px;height:6px;border-radius:50%}"+
  ".hba-dkflame{position:fixed;pointer-events:none;z-index:9995;transform-origin:50% 100%;will-change:transform,opacity}"+
  ".hba-dkflame svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-dkember{position:fixed;pointer-events:none;z-index:9990;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#f97316 60%,transparent);box-shadow:0 0 6px rgba(249,115,22,.9)}"+
  ".hba-dksmoke{position:fixed;pointer-events:none;z-index:9993;border-radius:50%;background:radial-gradient(circle,rgba(80,60,50,.5),rgba(50,38,30,.2) 60%,transparent);filter:blur(2px)}"+
  ".hba-dkflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fde68a 45%,transparent 70%);opacity:0}"+
  ".hba-dkflash.go{animation:hbaDkFlash .34s ease-out forwards}"+
  "@keyframes hbaDkFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.8);opacity:0}}"+
  ".hba-dkring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #f97316;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(249,115,22,.9)}"+
  ".hba-dkring.go{animation:hbaDkRing .5s ease-out forwards}"+
  "@keyframes hbaDkRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-dkshard{position:fixed;pointer-events:none;z-index:9998;width:7px;height:7px;border-radius:1px}"+
  ".hba-dkcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-dkcombo.go{animation:hbaDkCombo .5s ease-out forwards}"+
  "@keyframes hbaDkCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v521: 暗黑灯神(Lv12)神灯魂狱万魂诅咒——①神灯降世黑暗烟雾笼罩(金辉爆闪+双金环+金辉光锥×3·Hansen真神灯图砸落入场过冲回弹+悬浮轻晃·灯嘴狂涌靛紫浓烟+烟海铺底+烟中三对绿眼明灭) ②三个愿望诅咒降临(八角金星+旋转光环依次升起·白闪→诅咒侵蚀成暗紫裂纹星→旋转重砸血条紫金双环·连击) ③灵魂之爪(浓烟翻涌·巨型魂爪从烟海升起罩住勇者·五指骨节+翠绿魂爪尖+掌心魂之印记脉动·猛攥拳指节峰+绿爪破剪影·两缕翠绿魂光被拽出螺旋拉向灯嘴·神灯绿芒逐魂增亮) ④万烟归灯魂狱审判(全场烟雾倒吸进灯嘴·蓄能珠+神灯暴震狂闪·灯嘴轰出金绿紫审判光柱斜贯勇者·巨爆+双环+16三色碎片+4魂光四散逃逸+柔震·deal·神灯熄火沉降)。暗黑靛硬编码(灯原图色/魂绿/诅咒紫固定)·hba-gn前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-gndome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(26,18,64,.55),transparent 64%);opacity:0}"+
  ".hba-gnvign{position:fixed;inset:0;pointer-events:none;z-index:9985;box-shadow:inset 0 0 74px rgba(99,102,241,.38);opacity:0}"+
  ".hba-gnlamp{position:fixed;pointer-events:none;z-index:9992;opacity:0;will-change:transform,opacity,filter;filter:drop-shadow(0 0 14px rgba(52,211,153,.5)) drop-shadow(0 0 24px rgba(251,191,36,.35))}"+
  ".hba-gnlamp img{display:block;width:100%;height:100%}"+
  ".hba-gnlamp .lbob{width:100%;height:100%;animation:hbaGnBob 2s ease-in-out infinite alternate}"+
  "@keyframes hbaGnBob{0%{transform:translateY(0)}100%{transform:translateY(-4px)}}"+
  ".hba-gnray{position:fixed;pointer-events:none;z-index:9989;transform-origin:50% 0;background:linear-gradient(to bottom,rgba(251,191,36,.4),rgba(251,191,36,.12) 55%,transparent);clip-path:polygon(42% 0,58% 0,86% 100%,14% 100%);opacity:0;will-change:transform,opacity}"+
  ".hba-gnsmoke{position:fixed;pointer-events:none;z-index:9990;border-radius:50%;background:radial-gradient(circle,rgba(129,140,248,.7),rgba(67,56,202,.52) 50%,rgba(30,27,75,.26) 76%,transparent 88%);filter:blur(2.5px);will-change:transform,opacity}"+
  ".hba-gnsmoke.dk{background:radial-gradient(circle,rgba(67,56,202,.62),rgba(30,27,75,.45) 55%,transparent 86%)}"+
  ".hba-gneyes{position:fixed;pointer-events:none;z-index:9991;opacity:0;will-change:opacity,transform}"+
  ".hba-gneyes i{position:absolute;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#d1fae5,#34d399 55%,#065f46);box-shadow:0 0 8px rgba(52,211,153,.95)}"+
  ".hba-gnwish{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(251,191,36,.9))}"+
  ".hba-gnwish svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-gnwish .halo{transform-origin:50% 50%;animation:hbaGnHalo 2.2s linear infinite}"+
  "@keyframes hbaGnHalo{to{transform:rotate(360deg)}}"+
  ".hba-gnwish.cursed{filter:drop-shadow(0 0 12px rgba(168,85,247,.95))}"+
  ".hba-gnwishtr{position:fixed;pointer-events:none;z-index:9994;border-radius:50%;background:radial-gradient(circle,#a855f7,transparent 70%);opacity:.85}"+
  ".hba-gnhit{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#a855f7 45%,transparent 72%);opacity:0}"+
  ".hba-gnhit.go{animation:hbaGnHit .3s ease-out forwards}"+
  "@keyframes hbaGnHit{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  ".hba-gnring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #a855f7;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(168,85,247,.9)}"+
  ".hba-gnring.go{animation:hbaGnRing .5s ease-out forwards}"+
  ".hba-gnring.gold{border-color:#fbbf24;box-shadow:0 0 8px rgba(251,191,36,.9)}"+
  "@keyframes hbaGnRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-gnstar{position:fixed;pointer-events:none;z-index:9998;width:6px;height:6px;border-radius:50%}"+
  ".hba-gnhand{position:fixed;pointer-events:none;z-index:9996;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(99,102,241,.6)) drop-shadow(0 0 18px rgba(52,211,153,.35))}"+
  ".hba-gnhand svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-gnhand .sigil{animation:hbaGnSigil .9s ease-in-out infinite alternate;transform-origin:center;transform-box:fill-box}"+
  "@keyframes hbaGnSigil{0%{opacity:.55}100%{opacity:1}}"+
  ".hba-gnhand .wsp{animation:hbaGnSigil 1.2s .2s ease-in-out infinite alternate}"+
  ".hba-gnsoul{position:fixed;pointer-events:none;z-index:9998;border-radius:50%;background:radial-gradient(circle at 38% 32%,#fff 0%,#a7f3d0 30%,#34d399 64%,#065f46 92%);box-shadow:0 0 14px rgba(52,211,153,.9),0 0 28px rgba(52,211,153,.4);will-change:transform,opacity}"+
  ".hba-gnsoultr{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;background:radial-gradient(circle,#34d399,transparent 70%);opacity:.8}"+
  ".hba-gncharge{position:fixed;pointer-events:none;z-index:9998;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#fde68a 28%,#34d399 60%,#4338ca 92%);box-shadow:0 0 18px rgba(251,191,36,.9),0 0 34px rgba(52,211,153,.55);will-change:transform,opacity}"+
  ".hba-gnbeam{position:fixed;pointer-events:none;z-index:9993;transform-origin:50% 0;will-change:transform,opacity}"+
  ".hba-gnbeam .bo{position:absolute;inset:0;background:linear-gradient(to bottom,#fde68a,#34d399 38%,#6366f1 70%,#581c87);clip-path:polygon(36% 0,64% 0,80% 100%,20% 100%);filter:blur(.5px);opacity:.93}"+
  ".hba-gnbeam .bi{position:absolute;inset:0;background:linear-gradient(to bottom,#fff,rgba(255,255,255,.75) 68%,transparent);clip-path:polygon(44% 0,56% 0,65% 100%,35% 100%);animation:hbaGnBeamFlick .13s ease-in-out infinite alternate}"+
  "@keyframes hbaGnBeamFlick{0%{opacity:.72}100%{opacity:1}}"+
  ".hba-gnflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#c7d2fe 45%,transparent 70%);opacity:0}"+
  ".hba-gnflash.go{animation:hbaGnFlash .36s ease-out forwards}"+
  "@keyframes hbaGnFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-gnshard{position:fixed;pointer-events:none;z-index:9998;width:7px;height:7px;border-radius:1px}"+
  ".hba-gncombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-gncombo.go{animation:hbaGnCombo .5s ease-out forwards}"+
  "@keyframes hbaGnCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v522: 海底巨怪(Lv13)深渊狂潮八爪绞杀——①深渊呼唤海水倒灌(战区水带: 血条上方活体水面双层波浪视差+白亮水光线·血条区浸水色调层·水下光斑+气泡群+深水两对青眼明灭·绝不遮答题区) ②八爪缠绕(四根巨触手破水水花飞溅·岩甲+发光吸盘+棘刺+青边缘光+摇曳·外侧两根甩鞭抽砸血条连击·内侧两根潜回化横向缠绕段左右夹击勇者区绞紧连击) ③深渊漩涡(双层螺旋反向旋转+气泡吸入中心蓄力) ④灭世狂潮(巨型海啸白沫浪卷立起砸落·白沫爆炸+青爆闪+青白双环+水珠四溅+柔震·deal·海水退潮干净收场)。深渊青硬编码·hba-sk前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-skdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(8,38,54,.55),transparent 64%);opacity:0}"+
  ".hba-skvign{position:fixed;inset:0;pointer-events:none;z-index:9998;box-shadow:inset 0 0 74px rgba(34,211,238,.38);opacity:0}"+
  ".hba-skbody{position:fixed;left:0;right:0;pointer-events:none;z-index:9985;background:linear-gradient(to bottom,rgba(14,116,144,.62),rgba(8,51,68,.74) 40%,rgba(4,30,42,.82));will-change:top,height,opacity;overflow:visible}"+
  ".hba-sksurf{position:absolute;left:-393px;top:-9px;width:200%;height:18px;pointer-events:none}"+
  ".hba-sksurf svg{display:block;width:100%;height:100%}"+
  ".hba-sksurf.s1{animation:hbaSkSurf 5.5s linear infinite;opacity:.95}"+
  ".hba-sksurf.s2{animation:hbaSkSurf 8.5s linear infinite reverse;opacity:.5;top:-5px}"+
  "@keyframes hbaSkSurf{0%{transform:translateX(0)}100%{transform:translateX(170px)}}"+
  ".hba-skhl{position:absolute;left:0;right:0;top:-2px;height:3px;background:linear-gradient(90deg,transparent,rgba(207,250,254,.95) 18%,rgba(207,250,254,.95) 82%,transparent);pointer-events:none;filter:blur(.4px)}"+
  ".hba-skover{position:fixed;left:0;right:0;pointer-events:none;z-index:9986;background:linear-gradient(to bottom,rgba(34,211,238,.15),rgba(8,51,68,.24));opacity:0;will-change:opacity}"+
  ".hba-skcau{position:fixed;pointer-events:none;z-index:9987;border-radius:50%;background:radial-gradient(ellipse,rgba(165,243,252,.22),transparent 70%);filter:blur(4px);animation:hbaSkCau 4.5s ease-in-out infinite alternate}"+
  "@keyframes hbaSkCau{0%{transform:translate(0,0) scale(1)}100%{transform:translate(26px,-8px) scale(1.2)}}"+
  ".hba-skbub{position:fixed;pointer-events:none;z-index:9990;border-radius:50%;border:1.4px solid rgba(165,243,252,.85);background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.5),rgba(165,243,252,.12) 60%,transparent)}"+
  ".hba-skeyes{position:fixed;pointer-events:none;z-index:9991;opacity:0;will-change:opacity,transform}"+
  ".hba-skeyes i{position:absolute;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#cffafe,#22d3ee 55%,#0e7490);box-shadow:0 0 9px rgba(34,211,238,.95)}"+
  ".hba-sktent{position:fixed;pointer-events:none;z-index:9992;will-change:transform,opacity;filter:drop-shadow(0 0 10px rgba(34,211,238,.4));transform-origin:50% 100%}"+
  ".hba-sktent svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-sktent .tsway{width:100%;height:100%;transform-origin:50% 96%;animation:hbaSkSway 1.7s ease-in-out infinite alternate}"+
  "@keyframes hbaSkSway{0%{transform:rotate(-3.5deg)}100%{transform:rotate(3.5deg)}}"+
  ".hba-sktent .tsuck,.hba-skwrap .tsuck{animation:hbaSkSuck 1.1s ease-in-out infinite alternate}"+
  "@keyframes hbaSkSuck{0%{opacity:.6}100%{opacity:1}}"+
  ".hba-skwrap{position:fixed;pointer-events:none;z-index:9993;will-change:transform,opacity;filter:drop-shadow(0 0 9px rgba(34,211,238,.45))}"+
  ".hba-skwrap svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-sksplash{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#cffafe 40%,transparent 72%);opacity:0}"+
  ".hba-sksplash.go{animation:hbaSkSplash .34s ease-out forwards}"+
  "@keyframes hbaSkSplash{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.6);opacity:0}}"+
  ".hba-skdrop{position:fixed;pointer-events:none;z-index:9997;width:5px;height:5px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#fff,#a5f3fc 60%,#22d3ee);transform:rotate(45deg)}"+
  ".hba-skring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #22d3ee;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(34,211,238,.9)}"+
  ".hba-skring.go{animation:hbaSkRing .5s ease-out forwards}"+
  ".hba-skring.white{border-color:#e0f2fe;box-shadow:0 0 8px rgba(224,242,254,.9)}"+
  "@keyframes hbaSkRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-skfoam{position:fixed;pointer-events:none;z-index:9997;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.92),rgba(207,250,254,.55) 55%,transparent 82%);filter:blur(1px);will-change:transform,opacity}"+
  ".hba-skvort{position:fixed;pointer-events:none;z-index:9994;will-change:transform,opacity}"+
  ".hba-skvort svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-skvort .vr1{transform-origin:50% 50%;animation:hbaSkSpin 1.1s linear infinite}"+
  ".hba-skvort .vr2{transform-origin:50% 50%;animation:hbaSkSpin .75s linear infinite reverse}"+
  "@keyframes hbaSkSpin{to{transform:rotate(360deg)}}"+
  ".hba-skwave{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity}"+
  ".hba-skwave svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-skwave .fdot{animation:hbaSkSuck .5s ease-in-out infinite alternate}"+
  ".hba-skflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#a5f3fc 45%,transparent 70%);opacity:0}"+
  ".hba-skflash.go{animation:hbaSkFlash .36s ease-out forwards}"+
  "@keyframes hbaSkFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-skcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-skcombo.go{animation:hbaSkCombo .5s ease-out forwards}"+
  "@keyframes hbaSkCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v523: 寒冰女王(Lv14)冰封万古绝对零度——①暴风雪降临(漫天六角雪花摇曳飘落+寒雾翻涌·杖尖凝光+冰霜符文绕身) ②冰晶风暴(五根冰晶长矛凝结列阵悬浮→依次极速射穿血条五点·冰爆+冰环+冰屑·五连击) ③绝对零度冰封勇者(寒气波横扫→巨型多棱冰晶罩死血条·垂冰锥+霜花绽开+寒雾爆发+内部微光脉动·冻结0.8秒·血条透冰可读) ④冰封万古粉碎(裂纹蔓延+咔咔双白闪→轰然炸碎: 白蓝爆闪+冰蓝霜白双环+16片菱形冰晶碎片+雪雾+柔震·deal·雪渐止)。寒冰蓝硬编码·hba-iq前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-iqdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(13,42,71,.5),transparent 62%);opacity:0}"+
  ".hba-iqvign{position:fixed;inset:0;pointer-events:none;z-index:9998;box-shadow:inset 0 0 74px rgba(34,211,238,.38);opacity:0}"+
  ".hba-iqflake{position:fixed;pointer-events:none;z-index:9988;will-change:transform,opacity;filter:drop-shadow(0 0 3px rgba(207,250,254,.6))}"+
  ".hba-iqflake svg{display:block;width:100%;height:100%}"+
  ".hba-iqmist{position:fixed;pointer-events:none;z-index:9989;border-radius:50%;background:radial-gradient(circle,rgba(207,250,254,.4),rgba(165,243,252,.18) 55%,transparent 82%);filter:blur(3px);will-change:transform,opacity}"+
  ".hba-iqcharge{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#cffafe 30%,#22d3ee 66%,#155e75 92%);box-shadow:0 0 16px rgba(34,211,238,.9),0 0 32px rgba(34,211,238,.4);will-change:transform,opacity}"+
  ".hba-iqrune{position:fixed;pointer-events:none;z-index:9991;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff,#67e8f9 60%,transparent);box-shadow:0 0 6px rgba(103,232,249,.95)}"+
  ".hba-iqspear{position:fixed;pointer-events:none;z-index:9993;will-change:transform,opacity;filter:drop-shadow(0 0 7px rgba(103,232,249,.85))}"+
  ".hba-iqspear svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-iqspear .ibob{width:100%;height:100%;animation:hbaIqBob 1.1s ease-in-out infinite alternate}"+
  "@keyframes hbaIqBob{0%{transform:translateY(0)}100%{transform:translateY(-3px)}}"+
  ".hba-iqtrail{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;background:radial-gradient(circle,#cffafe,transparent 70%);opacity:.85}"+
  ".hba-iqhit{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#cffafe 42%,transparent 72%);opacity:0}"+
  ".hba-iqhit.go{animation:hbaIqHit .3s ease-out forwards}"+
  "@keyframes hbaIqHit{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  ".hba-iqring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #22d3ee;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(34,211,238,.9)}"+
  ".hba-iqring.go{animation:hbaIqRing .5s ease-out forwards}"+
  ".hba-iqring.white{border-color:#f0f9ff;box-shadow:0 0 8px rgba(240,249,255,.9)}"+
  "@keyframes hbaIqRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-iqchip{position:fixed;pointer-events:none;z-index:9997;width:7px;height:7px;background:linear-gradient(135deg,#fff,#a5f3fc 55%,#22d3ee);transform:rotate(45deg)}"+
  ".hba-iqwave{position:fixed;pointer-events:none;z-index:9994;background:linear-gradient(to bottom,transparent,rgba(207,250,254,.55) 45%,rgba(34,211,238,.35) 60%,transparent);will-change:transform,opacity;border-radius:50%}"+
  ".hba-iqblock{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 14px rgba(103,232,249,.6))}"+
  ".hba-iqblock svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-iqblock .ipulse{animation:hbaIqPulse 1s ease-in-out infinite alternate}"+
  "@keyframes hbaIqPulse{0%{opacity:.35}100%{opacity:.7}}"+
  ".hba-iqfrost{position:fixed;pointer-events:none;z-index:9996;will-change:transform,opacity;filter:drop-shadow(0 0 5px rgba(207,250,254,.9))}"+
  ".hba-iqfrost svg{display:block;width:100%;height:100%}"+
  ".hba-iqcrack{position:fixed;pointer-events:none;z-index:9997;will-change:opacity}"+
  ".hba-iqcrack svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-iqflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#cffafe 45%,transparent 70%);opacity:0}"+
  ".hba-iqflash.go{animation:hbaIqFlash .36s ease-out forwards}"+
  "@keyframes hbaIqFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-iqcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-iqcombo.go{animation:hbaIqCombo .5s ease-out forwards}"+
  "@keyframes hbaIqCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  /* 🔴 v524: 烈焰魔神(Lv15)焚世天罚陨星灭世——meteorrain全面重铸(枪雨公式: 弹幕雨+巨型终结)。①天罚预兆(天幕染红压下+余烬升腾·双拳火球充能+胸口核心) ②陨星雨十二颗错峰(同屏峰值5颗·5血条连击+4地面残火+3远景纵深) ③灭世巨陨(黑岩核裂纹透光+火焰包裹+巨焰尾·缓入加速俯冲·超巨爆: 大爆闪+橙金红三环+16熔岩碎块+8团火焰+灰烬打旋飘落+柔震·deal) ④残火渐熄灰烬落尽天幕退红。炽焰橙硬编码·hba-fm前缀·全fixed贴body·零震屏零屏闪。 */
  ".hba-fmdome{position:fixed;inset:0;pointer-events:none;z-index:9984;background:linear-gradient(to bottom,rgba(78,26,5,.55),transparent 64%);opacity:0}"+
  ".hba-fmvign{position:fixed;inset:0;pointer-events:none;z-index:9998;box-shadow:inset 0 0 74px rgba(249,115,22,.38);opacity:0}"+
  ".hba-fmsky{position:fixed;left:0;right:0;top:0;height:120px;pointer-events:none;z-index:9985;background:linear-gradient(to bottom,rgba(220,38,38,.42),rgba(249,115,22,.16) 60%,transparent);opacity:0;will-change:opacity}"+
  ".hba-fmember{position:fixed;pointer-events:none;z-index:9988;border-radius:50%;background:radial-gradient(circle,#fde68a,#f97316 60%,transparent);box-shadow:0 0 5px rgba(249,115,22,.9);will-change:transform,opacity}"+
  ".hba-fmcharge{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;background:radial-gradient(circle at 40% 35%,#fff 0%,#fde68a 28%,#f97316 64%,#7c2d12 92%);box-shadow:0 0 16px rgba(249,115,22,.95),0 0 30px rgba(249,115,22,.5);will-change:transform,opacity}"+
  ".hba-fmmet{position:fixed;pointer-events:none;z-index:9993;will-change:transform,opacity;filter:drop-shadow(0 0 9px rgba(251,191,36,.85))}"+
  ".hba-fmmet.bg{z-index:9986;opacity:.6;filter:drop-shadow(0 0 5px rgba(251,191,36,.5))}"+
  ".hba-fmmet svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-fmmtr{position:fixed;pointer-events:none;z-index:9992;border-radius:50%;background:radial-gradient(circle,#fdba74,transparent 70%);opacity:.85}"+
  ".hba-fmbig{position:fixed;pointer-events:none;z-index:9995;will-change:transform,opacity;filter:drop-shadow(0 0 16px rgba(249,115,22,.85))}"+
  ".hba-fmbig svg{display:block;width:100%;height:100%;overflow:visible}"+
  ".hba-fmbig .fflick{animation:hbaFmFlick .15s ease-in-out infinite alternate}"+
  "@keyframes hbaFmFlick{0%{opacity:.75}100%{opacity:1}}"+
  ".hba-fmtuft{position:fixed;pointer-events:none;z-index:9990;border-radius:50% 50% 50% 50%/64% 64% 36% 36%;background:radial-gradient(circle at 50% 80%,#fff 0%,#fde68a 24%,#f97316 60%,transparent 88%);filter:blur(.5px);will-change:transform,opacity}"+
  ".hba-fmhit{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;transform:translate(-50%,-50%) scale(.25);background:radial-gradient(circle,#fff 0%,#fdba74 42%,transparent 72%);opacity:0}"+
  ".hba-fmhit.go{animation:hbaFmHit .3s ease-out forwards}"+
  "@keyframes hbaFmHit{0%{transform:translate(-50%,-50%) scale(.25);opacity:1}100%{transform:translate(-50%,-50%) scale(1.5);opacity:0}}"+
  ".hba-fmring{position:fixed;pointer-events:none;z-index:9996;border-radius:50%;border:3px solid #f97316;transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:0;box-shadow:0 0 8px rgba(249,115,22,.9)}"+
  ".hba-fmring.go{animation:hbaFmRing .5s ease-out forwards}"+
  ".hba-fmring.gold{border-color:#fbbf24;box-shadow:0 0 8px rgba(251,191,36,.9)}"+
  ".hba-fmring.red{border-color:#dc2626;box-shadow:0 0 8px rgba(220,38,38,.9)}"+
  "@keyframes hbaFmRing{0%{transform:translate(-50%,-50%) scaleY(.5) scale(.3);opacity:.95}100%{transform:translate(-50%,-50%) scaleY(.5) scale(3.0);opacity:0}}"+
  ".hba-fmdrop{position:fixed;pointer-events:none;z-index:9997;width:6px;height:6px;border-radius:50% 50% 50% 0;background:linear-gradient(135deg,#fde68a,#f97316 55%,#dc2626);transform:rotate(45deg);box-shadow:0 0 5px rgba(249,115,22,.8)}"+
  ".hba-fmchunk{position:fixed;pointer-events:none;z-index:9997;width:8px;height:8px;border-radius:2px}"+
  ".hba-fmflame{position:fixed;pointer-events:none;z-index:9996;border-radius:50% 50% 50% 50%/62% 62% 38% 38%;background:radial-gradient(circle at 50% 78%,#fff 0%,#fde68a 26%,#f97316 62%,transparent 88%);filter:blur(.6px);will-change:transform,opacity}"+
  ".hba-fmash{position:fixed;pointer-events:none;z-index:9996;background:linear-gradient(135deg,#57534e,#292524);border-radius:1px;will-change:transform,opacity}"+
  ".hba-fmflash{position:fixed;pointer-events:none;z-index:9999;border-radius:50%;transform:translate(-50%,-50%) scale(.2);background:radial-gradient(circle,#fff 0%,#fed7aa 45%,transparent 70%);opacity:0}"+
  ".hba-fmflash.go{animation:hbaFmFlash .36s ease-out forwards}"+
  "@keyframes hbaFmFlash{0%{transform:translate(-50%,-50%) scale(.2);opacity:1}100%{transform:translate(-50%,-50%) scale(1.9);opacity:0}}"+
  ".hba-fmcombo{position:fixed;pointer-events:none;z-index:9999;font-size:15px;font-weight:900;color:#fde047;text-shadow:0 0 8px rgba(250,204,21,.8),0 2px 4px #000;opacity:0;font-family:system-ui,-apple-system,sans-serif}"+
  ".hba-fmcombo.go{animation:hbaFmCombo .5s ease-out forwards}"+
  "@keyframes hbaFmCombo{0%{opacity:0;transform:translateY(4px) scale(.6)}28%{opacity:1;transform:translateY(0) scale(1.18)}100%{opacity:0;transform:translateY(-16px) scale(1)}}"+
  ".hba-tl-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .6s;background:linear-gradient(180deg,rgba(8,12,28,.78) 0%,rgba(10,14,30,.45) 46%,rgba(10,14,30,.12) 78%,transparent 100%)}"+
  ".hba-tl-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-tl-cloud{position:fixed;left:0;top:0;width:100%;pointer-events:none;z-index:9986;transform:translateY(-46px);opacity:0;transition:transform .5s cubic-bezier(.2,.7,.3,1.05),opacity .5s}"+
  ".hba-tl-cloud.tlin{transform:translateY(0);opacity:1}"+
  ".hba-tl-mote{position:fixed;border-radius:50%;pointer-events:none;z-index:9985}"+
  ".hba-tl-charge{position:fixed;border-radius:50%;pointer-events:none;z-index:9991;transform:scale(.2);opacity:0}"+
  ".hba-tl-bolt{position:fixed;pointer-events:none;z-index:9996;overflow:visible}"+
  ".hba-tl-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9997}"+
  ".hba-tl-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-tl-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-tl-thread{position:fixed;pointer-events:none;z-index:9987;border-radius:2px}"+
  ".hba-tl-arc{position:fixed;pointer-events:none;z-index:9996;overflow:visible}"+
  ".hba-tl-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#fde047;text-shadow:0 0 6px rgba(253,224,71,.9),0 1px 2px #000;pointer-events:none;animation:hbaTlCombo .62s ease-out forwards}"+
  "@keyframes hbaTlCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}"+
  ".hba-mt-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,rgba(10,8,12,.66) 0%,rgba(12,10,14,.4) 50%,rgba(12,10,14,.1) 80%,transparent 100%)}"+
  ".hba-mt-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-mt-corner{position:fixed;width:26px;height:26px;pointer-events:none;z-index:9988;opacity:0}"+
  ".hba-mt-statbar{position:fixed;left:50%;transform:translateX(-50%);display:flex;gap:3px;pointer-events:none;z-index:9988;opacity:0}"+
  ".hba-mt-statbar i{display:block;width:9px;height:4px;border-radius:1px}"+
  ".hba-mt-scan{position:fixed;left:0;width:100%;height:2px;pointer-events:none;z-index:9989}"+
  ".hba-mt-eye{position:fixed;border-radius:50%;pointer-events:none;z-index:9991}"+
  ".hba-mt-lamp{position:fixed;border-radius:50%;pointer-events:none;z-index:9991;animation:hbaMtBlink .7s ease-in-out 3}"+
  ".hba-mt-steam{position:fixed;border-radius:50%;pointer-events:none;z-index:9986}"+
  ".hba-mt-holo{position:fixed;pointer-events:none;z-index:9986;transform:translate(-50%,-50%)}"+
  ".hba-mt-hex{position:fixed;pointer-events:none;z-index:9985;transform:translate(-50%,-50%)}"+
  ".hba-mt-radar{position:fixed;border-radius:50%;pointer-events:none;z-index:9987;transform:translate(-50%,-50%);overflow:hidden}"+
  ".hba-mt-ret{position:fixed;pointer-events:none;z-index:9993}"+
  ".hba-mt-lockc{position:fixed;width:14px;height:14px;pointer-events:none;z-index:9993}"+
  ".hba-mt-lring{position:fixed;border:1.5px dashed currentColor;border-radius:50%;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-mt-rangeline{position:fixed;height:0;border-top:1.5px dashed currentColor;pointer-events:none;z-index:9987;transform-origin:0 50%}"+
  ".hba-mt-data{position:fixed;height:4px;border-radius:1px;pointer-events:none;z-index:9993}"+
  ".hba-mt-warn{position:fixed;width:0;height:0;pointer-events:none;z-index:9993}"+
  ".hba-mt-warnmark{position:fixed;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-mt-bladeglow{position:fixed;pointer-events:none;z-index:9991;transform-origin:50% 0;border-radius:4px}"+
  ".hba-mt-eflow{position:fixed;border-radius:50%;pointer-events:none;z-index:9991}"+
  ".hba-mt-charge{position:fixed;border-radius:50%;pointer-events:none;z-index:9992;transform:scale(.2);opacity:0}"+
  ".hba-mt-gwave{position:fixed;border-radius:50%;border:2px solid currentColor;pointer-events:none;z-index:9986;transform:translate(-50%,-50%) scale(.2);opacity:.8}"+
  ".hba-mt-slash{position:fixed;pointer-events:none;z-index:9994;overflow:visible}"+
  ".hba-mt-fist{position:fixed;pointer-events:none;z-index:9994}"+
  ".hba-mt-cut{position:fixed;height:3px;border-radius:2px;pointer-events:none;z-index:9995;transform-origin:50% 50%}"+
  ".hba-mt-sslash{position:fixed;height:2px;pointer-events:none;z-index:9997;transform-origin:50% 50%}"+
  ".hba-mt-gshock{position:fixed;height:6px;border-radius:3px;pointer-events:none;z-index:9995}"+
  ".hba-mt-crackln{position:fixed;height:1.5px;pointer-events:none;z-index:9995;transform-origin:0 50%}"+
  ".hba-mt-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-mt-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-mt-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-mt-shrap{position:fixed;pointer-events:none;z-index:9996;border-radius:1px}"+
  ".hba-mt-flame{position:fixed;border-radius:50% 50% 38% 38%;pointer-events:none;z-index:9996;transform-origin:50% 100%}"+
  ".hba-mt-smoke{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-mt-dust{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-mt-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#fde047;text-shadow:0 0 6px rgba(253,224,71,.9),0 1px 2px #000;pointer-events:none;animation:hbaMtCombo .62s ease-out forwards}"+
  "@keyframes hbaMtCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}"+
  "@keyframes hbaMtBlink{0%,100%{opacity:.15}50%{opacity:1}}"+
  ".hba-al-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,rgba(8,24,18,.6) 0%,rgba(8,22,18,.36) 50%,rgba(8,20,16,.1) 80%,transparent 100%)}"+
  ".hba-al-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-al-veil{position:fixed;left:0;top:0;width:100%;height:64px;pointer-events:none;z-index:9985;opacity:0}"+
  ".hba-al-grav{position:fixed;border-radius:50%;pointer-events:none;z-index:9986;transform:translate(-50%,-50%)}"+
  ".hba-al-gmote{position:fixed;border-radius:50%;pointer-events:none;z-index:9986}"+
  ".hba-al-ant{position:fixed;border-radius:50%;pointer-events:none;z-index:9991;animation:hbaAlBlink .6s ease-in-out infinite}"+
  ".hba-al-glyph{position:fixed;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-al-drone{position:fixed;pointer-events:none;z-index:9992}"+
  ".hba-al-lockln{position:fixed;height:0;border-top:1.5px dashed currentColor;pointer-events:none;z-index:9989;transform-origin:0 50%}"+
  ".hba-al-bolt{position:fixed;border-radius:50%;pointer-events:none;z-index:9994}"+
  ".hba-al-beam{position:fixed;pointer-events:none;z-index:9994;overflow:hidden}"+
  ".hba-al-beam img{position:absolute;left:0;top:0;width:100%;transform-origin:50% 0}"+
  ".hba-al-pre{position:fixed;border-radius:50%;pointer-events:none;z-index:9994}"+
  ".hba-al-vap{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-al-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-al-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-al-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-al-shrap{position:fixed;pointer-events:none;z-index:9996;border-radius:1px}"+
  ".hba-al-gshock{position:fixed;height:6px;border-radius:3px;pointer-events:none;z-index:9995}"+
  ".hba-al-glow{position:fixed;border-radius:50%;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-al-smoke{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-al-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#fde047;text-shadow:0 0 6px rgba(253,224,71,.9),0 1px 2px #000;pointer-events:none;animation:hbaAlCombo .62s ease-out forwards}"+
  "@keyframes hbaAlCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}"+
  "@keyframes hbaAlBlink{0%,100%{opacity:.25}50%{opacity:1}}"+
  "@keyframes hbaAlBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}"+
  ".hba-hl-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,rgba(20,6,26,.66) 0%,rgba(16,6,22,.4) 50%,rgba(14,6,18,.12) 80%,transparent 100%)}"+
  ".hba-hl-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-hl-crown{position:fixed;pointer-events:none;z-index:9991;transform:translate(-50%,-50%)}"+
  ".hba-hl-eye{position:fixed;border-radius:50%;pointer-events:none;z-index:9991}"+
  ".hba-hl-core{position:fixed;border-radius:50%;pointer-events:none;z-index:9991;transform:translate(-50%,-50%)}"+
  ".hba-hl-mist{position:fixed;border-radius:50%;pointer-events:none;z-index:9986}"+
  ".hba-hl-lwave{position:fixed;border-radius:50%;border:2px solid currentColor;pointer-events:none;z-index:9986;transform:translate(-50%,-50%) scale(.2);opacity:.85}"+
  ".hba-hl-trid{position:fixed;pointer-events:none;z-index:9991;transform-origin:50% 100%;border-radius:4px}"+
  ".hba-hl-tcharge{position:fixed;border-radius:50%;pointer-events:none;z-index:9993}"+
  ".hba-hl-circle{position:fixed;pointer-events:none;z-index:9988;transform:translate(-50%,-50%)}"+
  ".hba-hl-rune{position:fixed;pointer-events:none;z-index:9989;transform:translate(-50%,-50%)}"+
  ".hba-hl-bolt{position:fixed;pointer-events:none;z-index:9994}"+
  ".hba-hl-rip{position:fixed;pointer-events:none;z-index:9992;transform:translateX(-50%)}"+
  ".hba-hl-gframe{position:fixed;pointer-events:none;z-index:9990;overflow:visible}"+
  ".hba-hl-gpv{position:fixed;pointer-events:none;z-index:9991;perspective:520px;perspective-origin:50% 42%}"+
  ".hba-hl-gdoor{position:absolute;top:0;height:100%;width:50%;pointer-events:none}"+
  ".hba-hl-vortex{position:fixed;pointer-events:none;z-index:9994;overflow:hidden}"+
  ".hba-hl-vortex img{position:absolute}"+
  ".hba-hl-vring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-hl-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-hl-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-hl-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-hl-shrap{position:fixed;pointer-events:none;z-index:9996;border-radius:1px}"+
  ".hba-hl-gshock{position:fixed;height:6px;border-radius:3px;pointer-events:none;z-index:9995}"+
  ".hba-hl-flame{position:fixed;pointer-events:none;z-index:9996;transform-origin:50% 100%}"+
  ".hba-hl-smoke{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-hl-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#fde047;text-shadow:0 0 6px rgba(253,224,71,.9),0 1px 2px #000;pointer-events:none;animation:hbaHlCombo .62s ease-out forwards}"+
  "@keyframes hbaHlCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}"+
  ".hba-sg-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,rgba(40,26,6,.6) 0%,rgba(32,22,6,.36) 50%,rgba(26,18,6,.1) 80%,transparent 100%)}"+
  ".hba-sg-eclipse{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9985;opacity:0;background:rgba(8,5,2,.5)}"+
  ".hba-sg-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-sg-skyfall{position:fixed;pointer-events:none;z-index:9986;transform-origin:50% 0}"+
  ".hba-sg-corona{position:fixed;pointer-events:none;z-index:9990;transform:translate(-50%,-50%)}"+
  ".hba-sg-eye{position:fixed;border-radius:50%;pointer-events:none;z-index:9991}"+
  ".hba-sg-halo{position:fixed;pointer-events:none;z-index:9991;transform:translate(-50%,-50%)}"+
  ".hba-sg-dust{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-sg-palm{position:fixed;border-radius:50%;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-sg-star{position:fixed;border-radius:50%;pointer-events:none;z-index:9993}"+
  ".hba-sg-orbit{position:fixed;pointer-events:none;z-index:9992;transform:translate(-50%,-50%);border:1px dashed currentColor;border-radius:50%;opacity:.35}"+
  ".hba-sg-circle{position:fixed;pointer-events:none;z-index:9988;transform:translate(-50%,-50%)}"+
  ".hba-sg-seal{position:fixed;pointer-events:none;z-index:9989;transform:translate(-50%,-50%)}"+
  ".hba-sg-spear{position:fixed;pointer-events:none;z-index:9994}"+
  ".hba-sg-skycircle{position:fixed;pointer-events:none;z-index:9987;transform:translate(-50%,-50%)}"+
  ".hba-sg-sun{position:fixed;pointer-events:none;z-index:9994}"+
  ".hba-sg-sun img{position:absolute;left:0;top:0;width:100%;height:100%}"+
  ".hba-sg-heat{position:fixed;border-radius:50%;border:1.5px solid currentColor;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-sg-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-sg-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-sg-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-sg-shrap{position:fixed;pointer-events:none;z-index:9996;border-radius:1px}"+
  ".hba-sg-gshock{position:fixed;height:6px;border-radius:3px;pointer-events:none;z-index:9995}"+
  ".hba-sg-crack{position:fixed;height:2px;pointer-events:none;z-index:9995;transform-origin:0 50%}"+
  ".hba-sg-flame{position:fixed;pointer-events:none;z-index:9996;transform-origin:50% 100%}"+
  ".hba-sg-smoke{position:fixed;border-radius:50%;pointer-events:none;z-index:9990}"+
  ".hba-sg-glow{position:fixed;border-radius:50%;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-sg-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#fde047;text-shadow:0 0 6px rgba(253,224,71,.9),0 1px 2px #000;pointer-events:none;animation:hbaSgCombo .62s ease-out forwards}"+
  "@keyframes hbaSgCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}"+
  ".hba-se-dome{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9984;opacity:0;transition:opacity .5s;background:linear-gradient(180deg,rgba(10,6,22,.64) 0%,rgba(10,6,20,.4) 50%,rgba(8,5,16,.12) 80%,transparent 100%)}"+
  ".hba-se-hush{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9985;opacity:0;background:rgba(4,2,10,.55)}"+
  ".hba-se-vign{position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9999;opacity:0}"+
  ".hba-se-star{position:fixed;border-radius:50%;pointer-events:none;z-index:9986}"+
  ".hba-se-bigstar{position:fixed;pointer-events:none;z-index:9987;transform:translate(-50%,-50%)}"+
  ".hba-se-cline{position:fixed;pointer-events:none;z-index:9987}"+
  ".hba-se-halo{position:fixed;pointer-events:none;z-index:9990;transform:translate(-50%,-50%)}"+
  ".hba-se-eye{position:fixed;border-radius:50%;pointer-events:none;z-index:9991}"+
  ".hba-se-gflow{position:fixed;pointer-events:none;z-index:9989;overflow:hidden;border-radius:8px}"+
  ".hba-se-core{position:fixed;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-se-sword{position:fixed;pointer-events:none;z-index:9993;transform-origin:50% 88%}"+
  ".hba-se-circle{position:fixed;pointer-events:none;z-index:9988;transform:translate(-50%,-50%)}"+
  ".hba-se-meteor{position:fixed;pointer-events:none;z-index:9994}"+
  ".hba-se-note{position:fixed;pointer-events:none;z-index:9997;font-size:14px;font-weight:800}"+
  ".hba-se-arc{position:fixed;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-se-rift{position:fixed;pointer-events:none;z-index:9990;transform:translate(-50%,-50%)}"+
  ".hba-se-gfall{position:fixed;pointer-events:none;z-index:9991;overflow:hidden}"+
  ".hba-se-nuc{position:fixed;pointer-events:none;z-index:9994;transform:translate(-50%,-50%)}"+
  ".hba-se-accr{position:fixed;border-radius:50%;pointer-events:none;z-index:9993;transform:translate(-50%,-50%)}"+
  ".hba-se-hit{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%)}"+
  ".hba-se-ring{position:fixed;border-radius:50%;pointer-events:none;z-index:9995;transform:translate(-50%,-50%) scale(.18);opacity:.95}"+
  ".hba-se-spark{position:fixed;border-radius:50%;pointer-events:none;z-index:9996}"+
  ".hba-se-shrap{position:fixed;pointer-events:none;z-index:9996;border-radius:1px}"+
  ".hba-se-gshock{position:fixed;height:6px;border-radius:3px;pointer-events:none;z-index:9995}"+
  ".hba-se-crack{position:fixed;height:2px;pointer-events:none;z-index:9995;transform-origin:0 50%}"+
  ".hba-se-newstar{position:fixed;pointer-events:none;z-index:9997;transform:translate(-50%,-50%)}"+
  ".hba-se-glow{position:fixed;border-radius:50%;pointer-events:none;z-index:9992;transform:translate(-50%,-50%)}"+
  ".hba-se-combo{position:fixed;z-index:9999;font-weight:900;font-size:17px;color:#e9d5ff;text-shadow:0 0 6px rgba(196,181,253,.95),0 1px 2px #000;pointer-events:none;animation:hbaSeCombo .62s ease-out forwards}"+
  "@keyframes hbaSeCombo{0%{transform:translateY(8px) scale(.6);opacity:0}22%{transform:translateY(0) scale(1.18);opacity:1}60%{transform:translateY(-10px) scale(1);opacity:1}100%{transform:translateY(-24px) scale(.94);opacity:0}}";

  try{ var st=document.createElement('style'); st.id='hansen-boss-attack-css'; st.textContent=CSS; document.head.appendChild(st); }catch(e){}
  /* 🔴 v533: 常驻特效容器层——所有 boss 特效元素统一挂载于此, 后台调参面板的「配色」通过给本层设 filter(hue-rotate/saturate/brightness)实现全招整体换色(连太阳/漩涡/光束等真图一起转色, 与预览页同原理)。fixed inset0 全屏, fixed 子元素坐标系不变; pointer-events:none 不挡操作; filter 每次攻击由调度入口按 override 重设(无配色→'none')。 */
  /* 🔴 v536(BUG#70): 背景特效层——前景层 z9980 盖在页面一切内容之上, 导致"设计上应在 boss 身后"的元素(龙骑士巨翼/地狱犬王地狱之门)反而盖住 boss 立绘(Hansen 真机实拍: 翅膀挡脸/拱门挡三头犬)。新增 #hansenFxLayerBack(fixed inset0·pointer-events:none·z-index:-1): 负 z 沉到页面全部内容之下、body 背景之上 → boss 立绘/血条/HUD 天然在前。调度入口对两层同步设同一 filter, 调色面板对背景层元素同样生效。 */
  function __mkFxLayer(){ try{ if(!window.__hansenFxLayer){ var L=document.createElement('div'); L.id='hansenFxLayer'; L.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:9980;'; document.body.appendChild(L); window.__hansenFxLayer=L; } if(!window.__hansenFxLayerBack){ var B=document.createElement('div'); B.id='hansenFxLayerBack'; B.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:-1;'; document.body.appendChild(B); window.__hansenFxLayerBack=B; } }catch(e){} }
  if(document.body){__mkFxLayer();}else{try{document.addEventListener('DOMContentLoaded',__mkFxLayer);}catch(e){}}

  var PAL={
    rainbow:['#ff5e5e','#ffb84d','#ffe24d','#5eff8f','#4dd2ff','#6b7bff','#c44dff','#ff6bd6'],
    poison:['#a3e635','#65a30d','#84cc16','#bef264','#4d7c0f','#bbf7d0'],
    ice:['#cffafe','#67e8f9','#22d3ee','#a5f3fc','#e0f2fe'],
    fire:['#fef08a','#fb923c','#f97316','#ef4444','#fdba74'],
    magic:['#e9d5ff','#c084fc','#a855f7','#d8b4fe','#f0abfc'],
    pink:['#fbcfe8','#f9a8d4','#f472b6','#ec4899','#fce7f3'],
    steel:['#f8fafc','#cbd5e1','#94a3b8','#fbbf24','#fde68a']
  };

  function svgEl(markup){var d=document.createElement('div');d.innerHTML=markup;return d.firstElementChild;}
  function rm(el,ms){setTimeout(function(){if(el&&el.parentNode)el.parentNode.removeChild(el)},ms);}
  function centerOf(el){var r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,r:r};}
  function heroSec(){return document.querySelector('.hero-section');}
  function bossSprite(){return document.getElementById('bossSprite');}
  // 🔴 v859 (Hansen真机截图: 日轮飘头顶·掌中日脱手·眼光离眼): 所有特效锚点必须量【视觉盒】。
  //   v857起外层#bossSprite是230布局盒, 真正可见的是里面被transform的svg(普通scale.826=190·底部锚定)——
  //   量外层div → 普通态特效整体偏高~28px且大21%(狂怒scale=1时布局=视觉才碰巧对上)。
  //   修法: 锚点一律取svg/img视觉元素, rect跟着transform走 → 普通/狂怒/拼写三态全自动对齐, 狂怒变大特效等比跟大。
  function bossVis(){var d=bossSprite();if(!d)return d;try{return d.querySelector('svg,img')||d;}catch(e){return d;}}
  function add(el){(window.__hansenFxLayer||document.body).appendChild(el);}

  // 🔴 v510: 机械泰坦导弹散射汇聚 辅助(SVG导弹内联·无需外部图; 多层爆炸; 发射闪光; 二次贝塞尔)
  function hbmMissileSVG(uid){
    return '<svg viewBox="0 0 22 56" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="mb'+uid+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#475569"/><stop offset="0.32" stop-color="#f1f5f9"/><stop offset="0.6" stop-color="#cbd5e1"/><stop offset="1" stop-color="#334155"/></linearGradient>'
      +'<linearGradient id="mn'+uid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fecaca"/><stop offset="0.5" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs>'
      +'<path d="M5,15 L0.5,7 L5,20 Z" fill="#334155"/><path d="M17,15 L21.5,7 L17,20 Z" fill="#334155"/>'
      +'<path d="M7.5,11 L11,4.5 L14.5,11 Z" fill="#475569"/>'
      +'<rect x="6" y="10" width="10" height="34" rx="5" fill="url(#mb'+uid+')" stroke="#1e293b" stroke-width="0.5"/>'
      +'<rect x="6" y="20.5" width="10" height="4" fill="var(--mband)"/><rect x="6" y="20.5" width="10" height="4" fill="#fff" opacity="0.35"/>'
      +'<circle cx="11" cy="34" r="2.4" fill="var(--mband)"/><circle cx="11" cy="34" r="1.2" fill="#fff" opacity="0.9"/>'
      +'<path d="M6,42 Q11,57 16,42 Z" fill="url(#mn'+uid+')"/>'
      +'</svg>';
  }
  function hbmEl(wrap,cls,cx,cy,w,h){var d=document.createElement('div');d.className=cls;d.style.left=cx+'px';d.style.top=cy+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}wrap.appendChild(d);return d;}
  function qBez(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x,y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  function hbmMuzzle(wrap,cx,cy){
    var m=hbmEl(wrap,'hba-mflash',cx,cy,34); rm(m,300);
    for(var i=0;i<6;i++){ var sp=hbmEl(wrap,'hba-mspark',cx,cy); var a=(Math.PI*2*i/6)+Math.random(), dist=12+Math.random()*18;
      try{ sp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+Math.cos(a)*dist+'px,'+Math.sin(a)*dist+'px) scale(.4)',opacity:0}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(sp,300); }
  }
  function hbmExplode(wrap,cx,cy,big){
    var k=big?1.5:0.82;
    rm(hbmEl(wrap,'hba-mflash',cx,cy,Math.round(40*k)),300);
    rm(hbmEl(wrap,'hba-mball',cx,cy,Math.round((44+Math.random()*8)*k)),500);
    rm(hbmEl(wrap,'hba-mring',cx,cy,28),560);
    if(big){ rm(hbmEl(wrap,'hba-mring r2',cx,cy,28),780); }
    var ns=big?16:7,i;
    for(i=0;i<ns;i++){ var sp=hbmEl(wrap,'hba-mspark',cx,cy); var ang=(Math.PI*2*i/ns)+(Math.random()-.5)*0.5, dist=(20+Math.random()*46)*k, dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist-8, gy=dy+30+Math.random()*22;
      try{ sp.animate([{transform:'translate(-50%,-50%) translate(0,0) scale(1.1)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) scale(.9)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) scale(.4)',opacity:0}],{duration:480+Math.random()*200,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){} rm(sp,740); }
    var ne=big?9:4,j;
    for(j=0;j<ne;j++){ var es=3+Math.random()*4, em=hbmEl(wrap,'hba-member',cx,cy,es), ea=Math.random()*Math.PI*2, ed=(10+Math.random()*30)*k, edx=Math.cos(ea)*ed, edy=Math.sin(ea)*ed-14;
      try{ em.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.95},{transform:'translate(-50%,-50%) translate('+edx+'px,'+edy+'px) scale(.5)',opacity:0}],{duration:750+Math.random()*350,easing:'ease-out',fill:'forwards'});}catch(e){} rm(em,1150); }
    if(big){ var s; for(s=0;s<5;s++){ var ps=18+Math.random()*16, pf=hbmEl(wrap,'hba-mpuff',cx,cy,ps), pdx=(Math.random()-.5)*36, pdy=-10-Math.random()*24;
      try{ pf.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.55},{transform:'translate(-50%,-50%) translate('+pdx+'px,'+pdy+'px) scale(1.8)',opacity:0}],{duration:700+Math.random()*220,easing:'ease-out',fill:'forwards'});}catch(e){} rm(pf,950); } }
  }

  function burstShards(cx,cy,colors,N){
    for(var i=0;i<N;i++){
      var ang=(Math.PI*2*i/N)+(Math.random()*0.5-0.25),dist=42+Math.random()*56,col=colors[i%colors.length];
      var s=document.createElement('div');s.className='hba-shard';
      s.style.left=cx+'px';s.style.top=cy+'px';s.style.background=col;s.style.boxShadow='0 0 7px '+col;
      s.style.setProperty('--tx',(Math.cos(ang)*dist).toFixed(1)+'px');s.style.setProperty('--ty',(Math.sin(ang)*dist).toFixed(1)+'px');
      add(s);rm(s,640);
    }
  }
  function burstChunks(cx,cy){
    var cols=['#c084fc','#a855f7','#9333ea','#d8b4fe'];
    for(var i=0;i<7;i++){
      var ang=(Math.PI*2*i/7)+(Math.random()*0.7-0.35),dist=56+Math.random()*72,col=cols[i%cols.length];
      var s=document.createElement('div');s.className='hba-chunk';
      s.style.left=cx+'px';s.style.top=cy+'px';s.style.background=col;s.style.boxShadow='0 0 9px '+col;
      s.style.setProperty('--tx',(Math.cos(ang)*dist).toFixed(1)+'px');s.style.setProperty('--ty',(Math.sin(ang)*dist).toFixed(1)+'px');
      add(s);rm(s,720);
    }
  }
  function tintOverlay(color){
    var hs=heroSec();if(!hs)return;var r=hs.getBoundingClientRect();
    var o=document.createElement('div');o.className='hba-tint';
    o.style.left=r.left+'px';o.style.top=r.top+'px';o.style.width=r.width+'px';o.style.height=r.height+'px';
    o.style.background='radial-gradient(circle at 50% 50%,'+color+',transparent 72%)';o.style.boxShadow='inset 0 0 18px '+color;
    add(o);rm(o,900);
  }
  function slashMark(cx,cy,color,n,big){
    var len=big?98:66,th=big?7:4,ang=big?-30:-38;
    for(var i=0;i<n;i++){
      (function(k){setTimeout(function(){
        var s=document.createElement('div');s.className='hba-slash-mark';
        var off=(k-(n-1)/2)*(big?18:12);
        s.style.left=(cx+off)+'px';s.style.top=cy+'px';s.style.width=len+'px';s.style.height=th+'px';
        s.style.background='linear-gradient(90deg,transparent,'+color+' 28%,#fff 50%,'+color+' 72%,transparent)';
        s.style.boxShadow='0 0 8px '+color+',0 0 14px '+color;s.style.setProperty('--ang',ang+'deg');
        add(s);rm(s,360);
      },k*55)})(i);
    }
  }
  function slamImpact(cx,cy,color){
    var fl=document.createElement('div');fl.className='hba-slam-flash';
    fl.style.left=cx+'px';fl.style.top=cy+'px';fl.style.background='radial-gradient(circle,#fff 0%,'+color+' 35%,transparent 72%)';
    add(fl);rm(fl,420);
    for(var i=0;i<9;i++){
      var ang=Math.PI*(0.06+0.88*(i/8)),dist=40+Math.random()*50;
      var s=document.createElement('div');s.className='hba-shard';
      s.style.left=cx+'px';s.style.top=cy+'px';s.style.background=(i%2?color:'#fff');s.style.boxShadow='0 0 6px '+color;
      s.style.setProperty('--tx',(Math.cos(ang)*dist).toFixed(1)+'px');s.style.setProperty('--ty',(Math.abs(Math.sin(ang))*dist*0.65).toFixed(1)+'px');
      add(s);rm(s,560);
    }
  }
  function drainEffect(cx,cy,bossY){
    for(var i=0;i<11;i++){
      (function(k){setTimeout(function(){
        var w=document.createElement('div');w.className='hba-drain-wisp';
        w.style.left=(cx+(Math.random()*54-27))+'px';w.style.top=cy+'px';
        w.style.setProperty('--rise',(-(cy-bossY+18)).toFixed(0)+'px');w.style.setProperty('--dx',(Math.random()*22-11).toFixed(0)+'px');
        add(w);rm(w,620);
      },k*42)})(i);
    }
  }
  function lightningStrike(hx,hy){
    var topY=hy-200;if(topY<50)topY=50;var h=hy-topY,w=140,mx=w/2;
    function P(a){return 'M'+a.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1)}).join(' L');}
    var main=[[mx,0],[mx-15,h*0.16],[mx+12,h*0.30],[mx-10,h*0.44],[mx+16,h*0.58],[mx-8,h*0.72],[mx+10,h*0.85],[mx,h]];
    var br1=[[mx+12,h*0.30],[mx+38,h*0.40],[mx+30,h*0.50]];
    var br2=[[mx-10,h*0.44],[mx-40,h*0.55],[mx-30,h*0.64]];
    var br3=[[mx+16,h*0.58],[mx+44,h*0.66],[mx+38,h*0.75]];
    var m='<svg class="hba-lightning" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+
      '<path class="hba-bolt main" d="'+P(main)+'"/>'+
      '<path class="hba-bolt branch" style="animation-delay:.04s" d="'+P(br1)+'"/>'+
      '<path class="hba-bolt branch" style="animation-delay:.05s" d="'+P(br2)+'"/>'+
      '<path class="hba-bolt branch" style="animation-delay:.06s" d="'+P(br3)+'"/></svg>';
    var svg=svgEl(m);svg.style.left=(hx-mx)+'px';svg.style.top=topY+'px';add(svg);rm(svg,540);
  }
  function fireBreath(bx,by,heroY){
    var h=heroY-by+4;if(h<20)h=20;var w=78,W=w/2;
    function flame(cx,tw,len,fill,op){
      return '<path d="M'+(cx-tw)+' 0 Q'+(cx-tw*1.7)+' '+(len*0.5)+' '+(cx-tw*0.4)+' '+(len*0.8)+' Q'+(cx-2)+' '+(len*0.93)+' '+cx+' '+len+' Q'+(cx+2)+' '+(len*0.93)+' '+(cx+tw*0.4)+' '+(len*0.8)+' Q'+(cx+tw*1.7)+' '+(len*0.5)+' '+(cx+tw)+' 0 Z" fill="'+fill+'" opacity="'+op+'"/>';
    }
    var inner='<defs><linearGradient id="hbaFbO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="0.5" stop-color="#fb923c"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>';
    inner+=flame(W,16,h*0.97,'url(#hbaFbO)',0.92)+flame(W-14,9,h*0.76,'url(#hbaFbO)',0.82)+flame(W+14,9,h*0.76,'url(#hbaFbO)',0.82)+flame(W,8,h*0.82,'#fef9c3',0.9)+flame(W,4,h*0.6,'#ffffff',0.82);
    var svg=svgEl('<svg class="hba-firebreath" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'+inner+'</svg>');
    svg.style.left=(bx-W)+'px';svg.style.top=by+'px';add(svg);rm(svg,480);
  }
  function makeProjectile(cfg){
    if(cfg.proj==='apple'){var e=document.createElement('div');e.className='hba-proj-emoji';e.textContent='🍎';e.style.filter='drop-shadow(0 0 9px '+(cfg.pglow||'rgba(132,204,22,.9)')+') drop-shadow(0 0 4px #14532d)';return e;}
    if(cfg.proj==='icicle'){var d=document.createElement('div');d.className='hba-proj-icicle';return d;}
    if(cfg.proj==='flame'){
      return svgEl('<svg class="hba-proj-flame" viewBox="0 0 100 130" width="48" height="62" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hbaFlmO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde047"/><stop offset="0.42" stop-color="#fb923c"/><stop offset="1" stop-color="#dc2626"/></linearGradient><linearGradient id="hbaFlmI" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#fef08a"/><stop offset="1" stop-color="#fb923c"/></linearGradient></defs><path d="M50 5 C 41 33 21 42 21 75 C 21 102 33 125 50 125 C 67 125 79 102 79 75 C 79 56 71 50 64 39 C 62 52 58 57 53 50 C 58 37 54 21 50 5 Z" fill="url(#hbaFlmO)"/><path d="M50 47 C 46 61 38 67 38 85 C 38 99 44 109 50 109 C 56 109 62 99 62 85 C 62 73 56 67 50 47 Z" fill="url(#hbaFlmI)"/></svg>');
    }
    var o=document.createElement('div');o.className='hba-orb'+(cfg.cls?(' '+cfg.cls):'');o.style.background=cfg.grad;o.style.boxShadow=cfg.glow;return o;
  }
  function makeHalberd(){
    return svgEl('<svg class="hba-halberd" viewBox="0 0 100 240" width="64" height="154" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hbaHbBlade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#94a3b8"/><stop offset="0.5" stop-color="#f8fafc"/><stop offset="1" stop-color="#64748b"/></linearGradient><linearGradient id="hbaHbShaft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7f1d1d"/><stop offset="0.5" stop-color="#dc2626"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient></defs><rect x="45" y="2" width="10" height="150" rx="4" fill="url(#hbaHbShaft)"/><rect x="43" y="42" width="14" height="5" rx="2" fill="#fbbf24"/><rect x="43" y="96" width="14" height="5" rx="2" fill="#fbbf24"/><rect x="40" y="150" width="20" height="9" rx="3" fill="#fbbf24"/><path d="M42 156 C 16 150 8 166 12 186 C 26 172 36 174 44 178 Z" fill="url(#hbaHbBlade)" stroke="#d4af37" stroke-width="1.5" stroke-linejoin="round"/><path d="M58 156 C 84 150 92 166 88 186 C 74 172 64 174 56 178 Z" fill="url(#hbaHbBlade)" stroke="#d4af37" stroke-width="1.5" stroke-linejoin="round"/><path d="M50 152 L60 172 L53 224 L50 234 L47 224 L40 172 Z" fill="url(#hbaHbBlade)" stroke="#cbd5e1" stroke-width="1"/><circle cx="50" cy="6" r="7" fill="#fbbf24"/></svg>');
  }
  function makeGhost(){
    return svgEl('<svg class="hba-ghostie" viewBox="0 0 100 116" width="66" height="76" xmlns="http://www.w3.org/2000/svg"><path d="M50 6 C 24 6 12 28 12 54 L12 104 Q22 92 30 104 Q38 116 47 104 Q50 99 53 104 Q62 116 70 104 Q78 92 88 104 L88 54 C88 28 76 6 50 6 Z" fill="#ffffff"/><ellipse cx="38" cy="50" rx="6.5" ry="9" fill="#1e293b"/><ellipse cx="64" cy="50" rx="6.5" ry="9" fill="#1e293b"/><ellipse cx="51" cy="71" rx="7" ry="5" fill="#1e293b" opacity="0.5"/></svg>');
  }
  function makeCarpet(){
    return svgEl('<svg class="hba-carpet" viewBox="0 0 150 74" width="100" height="49" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hbaCpG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="0.5" stop-color="#a855f7"/><stop offset="1" stop-color="#6b21a8"/></linearGradient></defs><path d="M10 20 Q42 8 74 18 Q106 28 140 16 L140 52 Q106 64 74 54 Q42 44 10 56 Z" fill="url(#hbaCpG)" stroke="#fbbf24" stroke-width="3"/><path d="M22 26 Q48 18 74 26 Q100 34 128 24 L128 46 Q100 56 74 48 Q48 40 22 48 Z" fill="none" stroke="#fde68a" stroke-width="1.8" opacity="0.8"/><path d="M54 36 l8 -6 l8 6 l-8 6 Z" fill="#fde68a" opacity="0.85"/><path d="M86 34 l8 -6 l8 6 l-8 6 Z" fill="#fde68a" opacity="0.85"/><path d="M10 20 l-8 -3 M10 32 l-9 -1 M10 44 l-9 2 M10 56 l-8 4" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/><path d="M140 16 l8 -3 M140 28 l9 -1 M140 40 l9 2 M140 52 l8 4" stroke="#fbbf24" stroke-width="2.5" stroke-linecap="round"/></svg>');
  }
  // 🔴 v512: 战锤震地——地裂SVG(8向放射锯齿裂纹·熔岩色硬编码)
  function hbaCrackSVG(){
    var paths='', n=8;
    for(var i=0;i<n;i++){
      var a=(Math.PI*2*i/n)+(Math.random()-.5)*0.4, len=34+Math.random()*16, x=0,y=0,d='M0,0';
      var segs=3+Math.floor(Math.random()*2);
      for(var s=1;s<=segs;s++){ var r=len*s/segs; var jit=(Math.random()-.5)*10;
        x=Math.cos(a)*r+Math.cos(a+Math.PI/2)*jit; y=Math.sin(a)*r+Math.sin(a+Math.PI/2)*jit; d+=' L'+x.toFixed(1)+','+y.toFixed(1); }
      paths+='<path d="'+d+'" stroke="#1a1208" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
      paths+='<path d="'+d+'" stroke="#fb923c" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" style="filter:drop-shadow(0 0 4px rgba(251,146,60,.9))"/>';
    }
    return '<svg viewBox="-55 -55 110 110" xmlns="http://www.w3.org/2000/svg">'+paths+'</svg>';
  }
  // 🔴 v512: 战锤震地——岩石尖刺SVG(熔岩色硬编码)
  function hbaSpikeSVG(u){
    return '<svg viewBox="0 0 30 44" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbasp'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a4636"/><stop offset="0.5" stop-color="#3a2c22"/><stop offset="1" stop-color="#1c140e"/></linearGradient></defs>'
      +'<path d="M15,0 L24,30 L20,44 L10,44 L6,30 Z" fill="url(#hbasp'+u+')" stroke="#0f0a06" stroke-width="1"/>'
      +'<path d="M15,2 L18,28" stroke="#fb923c" stroke-width="1.4" fill="none" opacity="0.7"/>'
      +'<path d="M15,0 L19,12 L13,12 Z" fill="#fde68a" opacity="0.55"/>'
      +'</svg>';
  }
  // 🔴 v512: 战锤震地命中——熔岩地裂(冲击闪+地裂+双冲击环+岩刺+碎石+火星+尘土)。全 fixed 贴 body·零震屏零屏闪。
  var _hquu=0;
  function hbaHammerQuake(cx,cy,fxi,orcRage){
    function hqEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
    var fl=hqEl('hba-hqflash',cx,cy,Math.round(50*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,300);
    var crackPx=Math.round(170*fxi); var cr=hqEl('hba-hqcrack',cx,cy,crackPx,crackPx); cr.innerHTML=hbaCrackSVG(); void cr.offsetWidth; cr.classList.add('go'); rm(cr,580);
    var r1=hqEl('hba-hqring',cx,cy,40); void r1.offsetWidth; r1.classList.add('go'); rm(r1,520);
    var r2=hqEl('hba-hqring r2',cx,cy,40); setTimeout(function(){void r2.offsetWidth; r2.classList.add('go');},70); rm(r2,700);
    if(orcRage){ var r3=hqEl('hba-hqring grn',cx,cy,40); setTimeout(function(){void r3.offsetWidth; r3.classList.add('go');},130); rm(r3,800); }  // 🔴 v550: 部落怒气绿环(为部落而战!)·仅百战兽人
    var nsp=Math.round(6*fxi);
    for(var i=0;i<nsp;i++){ var off=(Math.random()-.5)*120*fxi; var sw=12+Math.random()*10, sh=sw*1.5;
      var sp=hqEl('hba-hqspike',cx+off,cy-sh*0.1,sw,sh); sp.innerHTML=hbaSpikeSVG('s'+(_hquu++));
      (function(e,dl){ setTimeout(function(){ void e.offsetWidth; e.classList.add('go'); },dl); rm(e,dl+520); })(sp, Math.random()*60);
    }
    var nrk=Math.round(11*fxi);
    for(var j=0;j<nrk;j++){ var rs=4+Math.random()*7; var rk=hqEl('hba-hqrock',cx,cy,rs,rs*(0.7+Math.random()*0.5));
      var ang=-Math.PI/2+(Math.random()-.5)*2.2, dist=(30+Math.random()*70)*fxi, dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist, gy=Math.abs(dy)*0.6+30+Math.random()*30, rot=(Math.random()-.5)*720;
      try{ rk.animate([{transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(rot*0.5)+'deg)',opacity:1,offset:.45},{transform:'translate(-50%,-50%) translate('+(dx*1.2)+'px,'+gy+'px) rotate('+rot+'deg)',opacity:0}],{duration:600+Math.random()*260,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
      rm(rk,900);
    }
    var nsk=Math.round(10*fxi);
    for(var k=0;k<nsk;k++){ var sk=hqEl('hba-hqspark',cx,cy); var sa=-Math.PI/2+(Math.random()-.5)*2.4, sd=(24+Math.random()*46)*fxi, sx=Math.cos(sa)*sd, sy2=Math.sin(sa)*sd, sgy=Math.abs(sy2)*0.5+28+Math.random()*22;
      try{ sk.animate([{transform:'translate(-50%,-50%) translate(0,0) scale(1.1)',opacity:1},{transform:'translate(-50%,-50%) translate('+sx+'px,'+sy2+'px) scale(.9)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(sx*1.1)+'px,'+sgy+'px) scale(.4)',opacity:0}],{duration:520+Math.random()*200,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
      rm(sk,740);
    }
    var nd=Math.round(6*fxi);
    for(var mq=0;mq<nd;mq++){ var ds=20+Math.random()*22, du=hqEl('hba-hqdust',cx+(Math.random()-.5)*70*fxi,cy+2,ds,ds); var ddx=(Math.random()-.5)*40, ddy=-14-Math.random()*26;
      try{ du.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.55},{transform:'translate(-50%,-50%) translate('+ddx+'px,'+ddy+'px) scale(1.9)',opacity:0}],{duration:720+Math.random()*240,easing:'ease-out',fill:'forwards'}); }catch(e){}
      rm(du,1000);
    }
  }
  // 🔴 v512: 战锤(克隆预加载图·防 BUG#67 空白)。返回带 _w/_h 的 wrapper(锤柄底=轴心)。
  var HAMMER_GEO={ ratio:280/600, pommel:{x:0.50,y:0.96}, head:{x:0.50,y:0.13}, pivot:{x:0.50,y:0.683} };  // 🔴 v512: pivot=锤柄靠底1/3处(离锤头2/3·离柄底1/3)=兽人真实握位·转动轴心
  function makeHammer(H){
    var W=Math.round(H*HAMMER_GEO.ratio);
    var wrap=document.createElement('div'); wrap.className='hba-hammer2';
    wrap.style.width=W+'px'; wrap.style.height=H+'px';
    var img;
    if(window.__hbaHammerImg && (window.__hbaHammerImg.complete||window.__hbaHammerReady)){ img=window.__hbaHammerImg.cloneNode(true); }
    else { img=new Image(); img.src='bosses/hammer_real.webp?v=908'; }
    img.alt=''; img.draggable=false; wrap.appendChild(img);
    wrap._w=W; wrap._h=H; return wrap;
  }
  // 🔴 v513: 史前霸王龙·远古霸主连击——SVG 件(全内联无外部图)。琥珀色硬编码。
  function hbaRxEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  // 🔴 v554: 化石化裂纹环 SVG(灰白·圆环+放射裂纹, "你将化为化石!")
  function hbaRx2FossilSVG(u){
    var ln='', i, n=7;
    for(i=0;i<n;i++){ var a=(i/n)*Math.PI*2+0.35, r1=22, r2=58+(i%3)*9;
      ln+='<path d="M'+(75+Math.cos(a)*r1).toFixed(1)+','+(75+Math.sin(a)*r1).toFixed(1)+' L'+(75+Math.cos(a+0.06)*r2).toFixed(1)+','+(75+Math.sin(a+0.06)*r2).toFixed(1)+'" stroke="#cbd5e1" stroke-width="4.6" stroke-linecap="round" opacity=".88"/>';
      ln+='<path d="M'+(75+Math.cos(a)*((r1+r2)/2)).toFixed(1)+','+(75+Math.sin(a)*((r1+r2)/2)).toFixed(1)+' l'+(Math.cos(a+1.2)*10).toFixed(1)+','+(Math.sin(a+1.2)*10).toFixed(1)+'" stroke="#f1f5f9" stroke-width="3" stroke-linecap="round" opacity=".8"/>'; }
    return '<svg viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="75" cy="75" r="26" fill="none" stroke="#f1f5f9" stroke-width="5.5" opacity=".95" style="filter:drop-shadow(0 0 9px rgba(241,245,249,.95))"/>'
      +'<circle cx="75" cy="75" r="44" fill="none" stroke="#cbd5e1" stroke-width="3.2" stroke-dasharray="9 7" opacity=".85" style="filter:drop-shadow(0 0 6px rgba(203,213,225,.8))"/>'
      +ln+'</svg>';
  }
  function hbaRxWaveSVG(){
    return '<svg viewBox="0 0 120 56" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M8,8 Q60,62 112,8" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linecap="round" opacity="0.85" style="filter:drop-shadow(0 0 6px rgba(245,158,11,.9))"/>'
      +'<path d="M16,12 Q60,52 104,12" fill="none" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>'
      +'</svg>';
  }
  function hbaRxPawSVG(u){
    return '<svg viewBox="0 0 170 120" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="hbarxpw'+u+'" cx="0.75" cy="0.5" r="0.7"><stop offset="0" stop-color="#fde68a" stop-opacity="0.55"/><stop offset="0.55" stop-color="#f59e0b" stop-opacity="0.34"/><stop offset="1" stop-color="#b45309" stop-opacity="0.12"/></radialGradient></defs>'
      +'<ellipse cx="124" cy="60" rx="40" ry="46" fill="url(#hbarxpw'+u+')" stroke="#f59e0b" stroke-width="2.5" opacity="0.9"/>'
      +'<path d="M96,26 Q44,12 10,30 Q48,38 94,44 Z" fill="url(#hbarxpw'+u+')" stroke="#fde68a" stroke-width="2" stroke-linejoin="round"/>'
      +'<path d="M100,58 Q38,52 4,72 Q44,78 98,76 Z" fill="url(#hbarxpw'+u+')" stroke="#fde68a" stroke-width="2" stroke-linejoin="round"/>'
      +'<path d="M104,88 Q52,98 22,114 Q60,110 104,100 Z" fill="url(#hbarxpw'+u+')" stroke="#fde68a" stroke-width="2" stroke-linejoin="round"/>'
      +'<path d="M10,30 L24,26 M4,72 L18,66 M22,114 L34,106" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>'
      +'</svg>';
  }
  function hbaRxTearSVG(u){
    return '<svg viewBox="0 0 200 22" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbarxtw'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b45309"/><stop offset="0.5" stop-color="#f59e0b"/><stop offset="1" stop-color="#b45309"/></linearGradient></defs>'
      +'<path d="M2,11 Q60,2 100,1.5 Q140,2 198,11 Q140,20 100,20.5 Q60,20 2,11 Z" fill="#140c06" stroke="url(#hbarxtw'+u+')" stroke-width="2.2" stroke-linejoin="round" opacity="0.97"/>'
      +'<path d="M26,11 Q100,8 174,11" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0.85"/>'
      +'</svg>';
  }
  function hbaRxJawSVG(u,which){
    var teethN=7, pad=14, tw=(200-pad*2)/teethN, t='', i, x;
    if(which==='up'){
      t+='<path d="M3,3 Q100,-13 197,3 L197,26 Q100,12 3,26 Z" fill="#b45309" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>';
      for(i=0;i<teethN;i++){x=pad+i*tw;
        t+='<path d="M'+x.toFixed(1)+',22 L'+(x+tw*0.5).toFixed(1)+',62 L'+(x+tw).toFixed(1)+',22 Z" fill="#fff7e6" stroke="#d6c39a" stroke-width="1.4" stroke-linejoin="round"/>';}
      t+='<path d="M8,7 Q100,-7 192,7" fill="none" stroke="#fde68a" stroke-width="1.6" opacity="0.8"/>';
      return '<svg viewBox="0 0 200 64" xmlns="http://www.w3.org/2000/svg">'+t+'</svg>';
    }
    t+='<path d="M3,61 Q100,77 197,61 L197,38 Q100,52 3,38 Z" fill="#b45309" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>';
    for(i=0;i<teethN;i++){x=pad+i*tw+tw*0.5;
      t+='<path d="M'+(x-tw*0.5).toFixed(1)+',42 L'+x.toFixed(1)+',2 L'+(x+tw*0.5).toFixed(1)+',42 Z" fill="#fff7e6" stroke="#d6c39a" stroke-width="1.4" stroke-linejoin="round"/>';}
    t+='<path d="M8,57 Q100,71 192,57" fill="none" stroke="#fde68a" stroke-width="1.6" opacity="0.8"/>';
    return '<svg viewBox="0 0 200 64" xmlns="http://www.w3.org/2000/svg">'+t+'</svg>';
  }
  var _rxuu=0;
  // 主编排: ①咆哮 ②冲击浪 ③双爪三连撕 ④巨口咬合(咬合时 deal)
  function hbaRexCombo(bx,by,hx,hy,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    /* ① 震地咆哮 */
    var sky=hbaRxEl('hba-rxsky',0,0); sky.style.left='0'; sky.style.top='0';
    try{sky.animate([{opacity:0},{opacity:.5,offset:.3},{opacity:0}],{duration:520/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(sky,580/sp);
    var rr1=hbaRxEl('hba-rxring',bx,by-6,Math.round(56*sz)); void rr1.offsetWidth; rr1.classList.add('go'); rm(rr1,460);
    var rr2=hbaRxEl('hba-rxring r2',bx,by-6,Math.round(56*sz)); setTimeout(function(){void rr2.offsetWidth;rr2.classList.add('go');},70); rm(rr2,620);
    var dist=hy-by, wi;
    for(wi=0;wi<3;wi++){(function(k){setTimeout(function(){
      var w=Math.round(120*sz), h=Math.round(w*56/120);
      var wv=hbaRxEl('hba-rxwave',bx-w/2,by-6,w,h); wv.innerHTML=hbaRxWaveSVG();
      try{wv.animate([
        {transform:'translateY(0) scale(.5)',opacity:0},
        {transform:'translateY('+(dist*0.18)+'px) scale(.82)',opacity:.95,offset:.18},
        {transform:'translateY('+dist+'px) scale(1.5)',opacity:0}
      ],{duration:430/sp,easing:'cubic-bezier(.3,.5,.5,1)',fill:'forwards'});}catch(e){}
      rm(wv,470/sp);
    },k*(90/sp));})(wi);}
    var np=Math.round(7*fxi), pi;
    for(pi=0;pi<np;pi++){(function(){
      var ps=3.5+Math.random()*4.5;
      var pb=hbaRxEl('hba-rxpeb',hx+(Math.random()-.5)*210,hy-4+Math.random()*16,ps,ps*0.85);
      var rise=12+Math.random()*16, drift=(Math.random()-.5)*10;
      try{pb.animate([
        {transform:'translate(0,0) rotate(0deg)',opacity:.95},
        {transform:'translate('+drift+'px,-'+rise+'px) rotate('+((Math.random()-.5)*60)+'deg)',opacity:1,offset:.55},
        {transform:'translate('+(drift*1.4)+'px,4px) rotate('+((Math.random()-.5)*120)+'deg)',opacity:0}
      ],{duration:(480+Math.random()*180)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(pb,760/sp);
    })();}
    var ne=Math.round(9*fxi), ei;
    for(ei=0;ei<ne;ei++){(function(){
      var em=hbaRxEl('hba-rxember',bx+(Math.random()-.5)*180,by+30+Math.random()*(dist-60));
      try{em.animate([{transform:'translate(0,0) scale(1)',opacity:.9},{transform:'translate('+((Math.random()-.5)*18)+'px,-'+(20+Math.random()*26)+'px) scale(.4)',opacity:0}],{duration:(420+Math.random()*220)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(em,700/sp);
    })();}
    /* ② 地面冲击浪 */
    setTimeout(function(){
      var W=Math.round(120*sz), H=Math.round(34*sz);
      var g=hbaRxEl('hba-rxgwave',bx-W/2,by+24,W,H);
      var arc=document.createElement('div'); arc.className='arc'; g.appendChild(arc);
      var dy=hy-(by+24)-6;
      try{g.animate([
        {transform:'translateY(0) scaleX(.55)',opacity:0},
        {transform:'translateY('+(dy*0.2)+'px) scaleX(.8)',opacity:.95,offset:.2},
        {transform:'translateY('+dy+'px) scaleX(1.35)',opacity:.9,offset:.92},
        {transform:'translateY('+(dy+8)+'px) scaleX(1.5)',opacity:0}
      ],{duration:300/sp,easing:'cubic-bezier(.4,.1,.6,.9)',fill:'forwards'});}catch(e){}
      rm(g,340/sp);
      var nd=Math.round(6*fxi), di;
      for(di=0;di<nd;di++){(function(k){setTimeout(function(){
        var t=k/nd, ds=14+Math.random()*16;
        var du=hbaRxEl('hba-rxgdust',bx+(hx-bx)*t+(Math.random()-.5)*40,by+24+dy*t,ds,ds);
        try{du.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.55},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*22)+'px,-'+(8+Math.random()*14)+'px) scale(1.7)',opacity:0}],{duration:420,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(du,460);
      },(300/sp)*(k/nd));})(di);}
    },300/sp);
    /* ③ 双爪三连撕 */
    function sweep(which){
      var mirror=(which===2);
      var PW=Math.round(150*sz), PH=Math.round(PW*120/170);
      var startX=mirror?(hx-190*sz):(hx+190*sz), endX=mirror?(hx+150*sz):(hx-150*sz);
      var startY=hy-120, endY=hy+4, sweepDur=235/sp;
      var paw=document.createElement('div'); paw.className='hba-rxpaw';
      paw.style.width=PW+'px'; paw.style.height=PH+'px';
      paw.style.left=(startX-PW/2)+'px'; paw.style.top=(startY-PH/2)+'px';
      paw.innerHTML=hbaRxPawSVG('p'+(_rxuu++));
      (window.__hansenFxLayer||document.body).appendChild(paw);
      var ddx=endX-startX, ddy=endY-startY;
      var baseR=mirror?14:-14, endR=mirror?34:-34, flip=mirror?' scaleX(-1)':'';
      try{paw.animate([
        {transform:'translate(0,0) rotate('+baseR+'deg)'+flip,opacity:0},
        {transform:'translate('+(ddx*0.16)+'px,'+(ddy*0.16)+'px) rotate('+baseR+'deg)'+flip,opacity:.96,offset:.14},
        {transform:'translate('+ddx+'px,'+ddy+'px) rotate('+endR+'deg)'+flip,opacity:.9,offset:.9},
        {transform:'translate('+(ddx*1.12)+'px,'+(ddy*1.1)+'px) rotate('+endR+'deg)'+flip+' scale(.94)',opacity:0}
      ],{duration:sweepDur+90/sp,easing:'cubic-bezier(.45,.05,.6,.95)',fill:'forwards'});}catch(e){}
      rm(paw,sweepDur+150/sp);
      var ang=mirror?160:20, rad=ang*Math.PI/180;
      var nx=-Math.sin(rad), ny=Math.cos(rad);
      var gap=15*sz, L=Math.round(195*sz), TH=Math.round(L*22/200);
      var cx0=hx+(mirror?8:-8), cy0=hy-(which===1?42:6), ti;
      for(ti=0;ti<3;ti++){(function(tk){
        var off=(tk-1)*gap, cx=cx0+nx*off, cy=cy0+ny*off;
        var tm=document.createElement('div'); tm.className='hba-rxtear';
        tm.style.width=L+'px'; tm.style.height=TH+'px';
        tm.style.left=(cx-L/2)+'px'; tm.style.top=(cy-TH/2)+'px';
        tm.style.transform='rotate('+ang+'deg)';
        var inner=document.createElement('div'); inner.className='inner';
        inner.style.transformOrigin=mirror?'left center':'right center';
        inner.innerHTML=hbaRxTearSVG('t'+(_rxuu++));
        tm.appendChild(inner); (window.__hansenFxLayer||document.body).appendChild(tm);
        try{inner.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:sweepDur*0.9,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});}catch(e){inner.style.transform='scaleX(1)';}
        try{tm.animate([{opacity:1,offset:0},{opacity:1,offset:.62},{opacity:0,offset:1}],{duration:sweepDur*0.9+560/sp,fill:'forwards'});}catch(e){}
        rm(tm,sweepDur*0.9+600/sp);
        var ns=Math.round(5*fxi), si;
        for(si=0;si<ns;si++){(function(sk){setTimeout(function(){
          var tt=(sk+0.5)/ns;
          var px=cx+Math.cos(rad)*((mirror?tt:(1-tt))-0.5)*L, py=cy+Math.sin(rad)*((mirror?tt:(1-tt))-0.5)*L;
          var spk=hbaRxEl('hba-rxspark',px,py);
          var pa=rad+Math.PI/2*(Math.random()<0.5?1:-1)+(Math.random()-.5)*0.6, pd=(14+Math.random()*26)*fxi;
          var dx2=Math.cos(pa)*pd, dy2=Math.sin(pa)*pd, gy2=dy2+20+Math.random()*16;
          try{spk.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx2+'px,'+dy2+'px) scale(.9)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx2*1.1)+'px,'+gy2+'px) scale(.35)',opacity:0}],{duration:400+Math.random()*170,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(spk,610);
        },sweepDur*0.9*((sk+0.5)/ns));})(si);}
      })(ti);}
    }
    setTimeout(function(){sweep(1);},560/sp);
    setTimeout(function(){sweep(2);},790/sp);
    /* ④ 霸王巨口咬合(咬合瞬间 deal) */
    setTimeout(function(){
      var JW=Math.round(186*sz), JH=Math.round(JW*64/200), closeDur=240/sp;
      var up=document.createElement('div'); up.className='hba-rxjaw';
      up.style.width=JW+'px'; up.style.height=JH+'px'; up.style.left=(hx-JW/2)+'px';
      var upEnd=hy-JH*0.92, upStart=upEnd-130;
      up.style.top=upStart+'px'; up.innerHTML=hbaRxJawSVG('ju'+(_rxuu++),'up');
      var lo=document.createElement('div'); lo.className='hba-rxjaw';
      lo.style.width=JW+'px'; lo.style.height=JH+'px'; lo.style.left=(hx-JW/2)+'px';
      var loEnd=hy-JH*0.08, loStart=loEnd+130;
      lo.style.top=loStart+'px'; lo.innerHTML=hbaRxJawSVG('jl'+(_rxuu++),'lo');
      (window.__hansenFxLayer||document.body).appendChild(up); (window.__hansenFxLayer||document.body).appendChild(lo);
      try{up.animate([
        {transform:'translateY(0)',opacity:0},
        {transform:'translateY(0)',opacity:1,offset:.12},
        {transform:'translateY('+(upEnd-upStart)+'px)',opacity:1}
      ],{duration:closeDur,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'});}catch(e){up.style.top=upEnd+'px';}
      try{lo.animate([
        {transform:'translateY(0)',opacity:0},
        {transform:'translateY(0)',opacity:1,offset:.12},
        {transform:'translateY('+(loEnd-loStart)+'px)',opacity:1}
      ],{duration:closeDur,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'});}catch(e){lo.style.top=loEnd+'px';}
      setTimeout(function(){
        var vg=hbaRxEl('hba-rxvign',0,0); vg.style.left='0'; vg.style.top='0';
        try{vg.animate([{opacity:0},{opacity:.45,offset:.3},{opacity:0}],{duration:360/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,420/sp);
        var fl=hbaRxEl('hba-rxflash',hx,hy,Math.round(60*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,320);
        var cr=hbaRxEl('hba-rxchompring',hx,hy,44); void cr.offsetWidth; cr.classList.add('go'); rm(cr,520);
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},300); }
        var nsh=Math.round(12*fxi), shi;
        for(shi=0;shi<nsh;shi++){(function(){
          var sh=hbaRxEl('hba-rxshard',hx,hy); sh.style.background=(Math.random()<0.5)?'#fde68a':'#f59e0b'; sh.style.boxShadow='0 0 6px rgba(245,158,11,.9)';
          var a=-Math.PI/2+(Math.random()-.5)*2.6, d=(30+Math.random()*52)*fxi, dx=Math.cos(a)*d, dy=Math.sin(a)*d, gy=Math.abs(dy)*0.55+26+Math.random()*22, rot=(Math.random()-.5)*540;
          try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(rot*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(sh,860);
        })();}
        deal();
        setTimeout(function(){
          try{up.animate([{transform:'translateY('+(upEnd-upStart)+'px)',opacity:1},{transform:'translateY('+(upEnd-upStart-16)+'px)',opacity:0}],{duration:200/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
          try{lo.animate([{transform:'translateY('+(loEnd-loStart)+'px)',opacity:1},{transform:'translateY('+(loEnd-loStart+16)+'px)',opacity:0}],{duration:200/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
          setTimeout(function(){if(up.parentNode)up.remove();if(lo.parentNode)lo.remove();},240/sp);
        },170/sp);
      },closeDur);
    },1040/sp);
  }
  // 🔴 v514: 千年僵尸·符咒尸毒连击——SVG 件(全内联无外部图)。尸毒绿硬编码·符咒黄纸红符固定。
  function hbaZbEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaZbWindSVG(){
    return '<svg viewBox="0 0 140 40" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M4,30 Q40,6 76,18 Q104,27 136,10" fill="none" stroke="#84cc16" stroke-width="3" stroke-linecap="round" opacity="0.6" style="filter:drop-shadow(0 0 5px rgba(132,204,22,.9))"/>'
      +'<path d="M14,36 Q46,18 80,28" fill="none" stroke="#d9f99d" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>'
      +'</svg>';
  }
  function hbaZbTalisSVG(){
    return '<svg viewBox="0 0 44 96" xmlns="http://www.w3.org/2000/svg">'
      +'<rect x="2" y="2" width="40" height="92" rx="4" fill="#fde047" stroke="#b91c1c" stroke-width="2.5"/>'
      +'<rect x="7" y="7" width="30" height="82" rx="2" fill="none" stroke="#ef4444" stroke-width="1.2" opacity="0.7"/>'
      +'<circle cx="22" cy="20" r="7" fill="none" stroke="#dc2626" stroke-width="2.4"/>'
      +'<path d="M22,13 L22,27 M15,20 L29,20" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/>'
      +'<path d="M14,34 L30,34 M22,34 L22,52 M15,44 Q22,50 29,44" stroke="#dc2626" stroke-width="2.6" stroke-linecap="round" fill="none"/>'
      +'<path d="M14,60 Q22,56 30,60 M14,68 L30,68 M16,76 L28,84 M28,76 L16,84" stroke="#dc2626" stroke-width="2.4" stroke-linecap="round" fill="none"/>'
      +'</svg>';
  }
  function hbaZbClawSVG(u){
    return '<svg viewBox="0 0 160 110" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="hbazbc'+u+'" cx="0.2" cy="0.5" r="0.85"><stop offset="0" stop-color="#d9f99d" stop-opacity="0.5"/><stop offset="0.55" stop-color="#84cc16" stop-opacity="0.32"/><stop offset="1" stop-color="#3f6212" stop-opacity="0.12"/></radialGradient></defs>'
      +'<ellipse cx="34" cy="58" rx="32" ry="36" fill="url(#hbazbc'+u+')" stroke="#84cc16" stroke-width="2.4" opacity="0.92"/>'
      +'<path d="M58,22 Q108,8 142,14 Q112,26 62,36 Z" fill="url(#hbazbc'+u+')" stroke="#d9f99d" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M64,44 Q118,34 152,42 Q120,52 66,56 Z" fill="url(#hbazbc'+u+')" stroke="#d9f99d" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M64,66 Q120,62 154,72 Q120,80 66,78 Z" fill="url(#hbazbc'+u+')" stroke="#d9f99d" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M58,88 Q104,92 134,102 Q102,104 60,98 Z" fill="url(#hbazbc'+u+')" stroke="#d9f99d" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M142,14 L152,11 M152,42 L162,41 M154,72 L164,74 M134,102 L143,106" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity="0.92"/>'
      +'</svg>';
  }
  function hbaZbTearSVG(u){
    return '<svg viewBox="0 0 200 22" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbazbt'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3f6212"/><stop offset="0.5" stop-color="#84cc16"/><stop offset="1" stop-color="#3f6212"/></linearGradient></defs>'
      +'<path d="M2,11 Q60,2 100,1.5 Q140,2 198,11 Q140,20 100,20.5 Q60,20 2,11 Z" fill="#0a1206" stroke="url(#hbazbt'+u+')" stroke-width="2.2" stroke-linejoin="round" opacity="0.97"/>'
      +'<path d="M26,11 Q100,8 174,11" fill="none" stroke="#d9f99d" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>'
      +'</svg>';
  }
  var _zbuu=0;
  // 主编排: ①阴风鬼火 ②飞符诅咒 ③双尸爪 ④尸毒爆发(deal)
  function hbaZombieCurse(bx,by,hx,hy,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    /* ① 阴风鬼火 */
    var sky=hbaZbEl('hba-zbsky',0,0); sky.style.left='0'; sky.style.top='0';
    try{sky.animate([{opacity:0},{opacity:.5,offset:.3},{opacity:0}],{duration:560/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(sky,620/sp);
    var nw=Math.round(5*fxi), wi;
    for(wi=0;wi<nw;wi++){(function(k){setTimeout(function(){
      var ws=Math.round((16+Math.random()*12)*sz);
      var w=hbaZbEl('hba-zbwisp',hx+(Math.random()-.5)*260,hy-10-Math.random()*40,ws,Math.round(ws*1.25));
      var rise=60+Math.random()*70, sway=(Math.random()<.5?-1:1)*(14+Math.random()*14);
      try{w.animate([
        {transform:'translate(0,0) scale(.5)',opacity:0},
        {transform:'translate('+sway+'px,-'+(rise*0.4)+'px) scale(1.05)',opacity:.95,offset:.4},
        {transform:'translate('+(-sway*0.6)+'px,-'+(rise*0.75)+'px) scale(.95)',opacity:.8,offset:.7},
        {transform:'translate('+(sway*0.3)+'px,-'+rise+'px) scale(.5)',opacity:0}
      ],{duration:(700+Math.random()*260)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(w,1020/sp);
    },k*(70/sp));})(wi);}
    var wj;
    for(wj=0;wj<3;wj++){(function(k){setTimeout(function(){
      var ww=Math.round(130*sz), wh=Math.round(ww*40/140);
      var wd=hbaZbEl('hba-zbwind',(k%2?bx+10:bx-ww-10),by+24+k*36,ww,wh); wd.innerHTML=hbaZbWindSVG();
      var dx=(k%2?-1:1)*(70+Math.random()*40);
      try{wd.animate([
        {transform:'translate(0,0)',opacity:0},
        {transform:'translate('+(dx*0.4)+'px,14px)',opacity:.85,offset:.4},
        {transform:'translate('+dx+'px,34px)',opacity:0}
      ],{duration:520/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(wd,560/sp);
    },k*(80/sp));})(wj);}
    /* ② 飞符诅咒 */
    var talis=null;
    setTimeout(function(){
      var TW=Math.round(34*sz), TH=Math.round(TW*96/44);
      var tx=hx, ty=hy-58;
      var t=document.createElement('div'); t.className='hba-zbtalis';
      t.style.width=TW+'px'; t.style.height=TH+'px';
      t.style.left=(bx-TW/2)+'px'; t.style.top=(by-TH/2)+'px';
      t.innerHTML=hbaZbTalisSVG();
      (window.__hansenFxLayer||document.body).appendChild(t);
      var dx=tx-bx, dy=ty-by, fdur=300/sp;
      try{t.animate([
        {transform:'translate(0,0) rotate(0deg) scale(.6)',opacity:0},
        {transform:'translate('+(dx*0.15)+'px,'+(dy*0.15)+'px) rotate(108deg) scale(1)',opacity:1,offset:.15},
        {transform:'translate('+dx+'px,'+dy+'px) rotate(720deg) scale(1)',opacity:1}
      ],{duration:fdur,easing:'cubic-bezier(.45,.05,.7,.6)',fill:'forwards'});}catch(e){t.style.left=(tx-TW/2)+'px';t.style.top=(ty-TH/2)+'px';}
      setTimeout(function(){
        try{t.animate([
          {transform:'translate('+dx+'px,'+dy+'px) rotate(720deg) scale(1)'},
          {transform:'translate('+dx+'px,'+dy+'px) rotate(720deg) scale(1.22)',offset:.3},
          {transform:'translate('+dx+'px,'+dy+'px) rotate(720deg) scale(1)'}
        ],{duration:200/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        var tr=hbaZbEl('hba-zbtring',tx,ty,Math.round(40*sz)); void tr.offsetWidth; tr.classList.add('go'); rm(tr,460);
        var fEl=t.querySelector('svg');
        try{fEl.animate([{filter:'drop-shadow(0 0 4px rgba(220,38,38,0))'},{filter:'drop-shadow(0 0 14px rgba(220,38,38,.95))'},{filter:'drop-shadow(0 0 4px rgba(220,38,38,0))'},{filter:'drop-shadow(0 0 14px rgba(220,38,38,.95))'},{filter:'drop-shadow(0 0 4px rgba(220,38,38,0))'}],{duration:520/sp,fill:'forwards'});}catch(e){}
      },fdur);
      talis={el:t,x:tx,y:ty};
    },380/sp);
    /* ③ 双尸爪 */
    function zClaw(which){
      var mirror=(which===2);
      var CW=Math.round(150*sz), CH=Math.round(CW*110/160);
      var startX=mirror?(hx+200*sz):(hx-200*sz), endX=mirror?(hx+10):(hx-10);
      var sy=hy-30, grabDur=240/sp;
      var cl=document.createElement('div'); cl.className='hba-zbclaw';
      cl.style.width=CW+'px'; cl.style.height=CH+'px';
      cl.style.left=(startX-CW/2)+'px'; cl.style.top=(sy-CH/2)+'px';
      cl.innerHTML=hbaZbClawSVG('c'+(_zbuu++));
      (window.__hansenFxLayer||document.body).appendChild(cl);
      var ddx=endX-startX, flip=mirror?' scaleX(-1)':'';
      try{cl.animate([
        {transform:'translate(0,0)'+flip,opacity:0},
        {transform:'translate('+(ddx*0.2)+'px,4px)'+flip,opacity:.96,offset:.18},
        {transform:'translate('+ddx+'px,16px)'+flip,opacity:.92,offset:.88},
        {transform:'translate('+(ddx*1.06)+'px,20px)'+flip+' scale(.95)',opacity:0}
      ],{duration:grabDur+110/sp,easing:'cubic-bezier(.5,.05,.6,.95)',fill:'forwards'});}catch(e){}
      rm(cl,grabDur+170/sp);
      var ang=mirror?168:12, rad=ang*Math.PI/180;
      var nx=-Math.sin(rad), ny=Math.cos(rad);
      var gap=15*sz, L=Math.round(185*sz), TH2=Math.round(L*22/200);
      var cx0=hx+(mirror?6:-6), cy0=hy-(which===1?34:0), ti;
      for(ti=0;ti<3;ti++){(function(tk){
        var off=(tk-1)*gap, cx=cx0+nx*off, cy=cy0+ny*off;
        var tm=document.createElement('div'); tm.className='hba-zbtear';
        tm.style.width=L+'px'; tm.style.height=TH2+'px';
        tm.style.left=(cx-L/2)+'px'; tm.style.top=(cy-TH2/2)+'px';
        tm.style.transform='rotate('+ang+'deg)';
        var inner=document.createElement('div'); inner.className='inner';
        inner.style.transformOrigin=mirror?'right center':'left center';
        inner.innerHTML=hbaZbTearSVG('z'+(_zbuu++));
        tm.appendChild(inner); (window.__hansenFxLayer||document.body).appendChild(tm);
        try{inner.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:grabDur*0.9,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});}catch(e){inner.style.transform='scaleX(1)';}
        try{tm.animate([{opacity:1,offset:0},{opacity:1,offset:.6},{opacity:0,offset:1}],{duration:grabDur*0.9+560/sp,fill:'forwards'});}catch(e){}
        rm(tm,grabDur*0.9+600/sp);
        var nb=2+Math.round(1*fxi), bi;
        for(bi=0;bi<nb;bi++){(function(bk){setTimeout(function(){
          var tt=0.2+0.6*Math.random();
          var px=cx+Math.cos(rad)*(tt-0.5)*L, py=cy+Math.sin(rad)*(tt-0.5)*L;
          var bsz=Math.round((7+Math.random()*7)*sz);
          var bb=hbaZbEl('hba-zbbub',px,py,bsz,bsz);
          try{bb.animate([
            {transform:'translate(-50%,-50%) scale(.4)',opacity:.9},
            {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*10)+'px,-'+(14+Math.random()*16)+'px) scale(1)',opacity:.85,offset:.7},
            {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*14)+'px,-'+(24+Math.random()*18)+'px) scale(1.5)',opacity:0}
          ],{duration:480+Math.random()*200,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(bb,720);
        },grabDur*0.5+bk*90);})(bi);}
        var ns=Math.round(4*fxi), si;
        for(si=0;si<ns;si++){(function(sk){setTimeout(function(){
          var tt=(sk+0.5)/ns;
          var px=cx+Math.cos(rad)*((mirror?(1-tt):tt)-0.5)*L, py=cy+Math.sin(rad)*((mirror?(1-tt):tt)-0.5)*L;
          var dp=hbaZbEl('hba-zbdrop',px,py);
          var pa=rad+Math.PI/2*(Math.random()<0.5?1:-1)+(Math.random()-.5)*0.5, pd=(12+Math.random()*22)*fxi;
          var dx2=Math.cos(pa)*pd, dy2=Math.sin(pa)*pd, gy2=dy2+24+Math.random()*16;
          try{dp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx2+'px,'+dy2+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx2*1.1)+'px,'+gy2+'px) scale(.5)',opacity:0}],{duration:430+Math.random()*170,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(dp,640);
        },grabDur*0.9*((sk+0.5)/ns));})(si);}
      })(ti);}
    }
    setTimeout(function(){zClaw(1);},760/sp);
    setTimeout(function(){zClaw(2);},950/sp);
    /* ④ 尸毒爆发(符咒炸裂引爆·deal) */
    setTimeout(function(){
      if(talis&&talis.el&&talis.el.parentNode){
        var tx=talis.x, ty=talis.y;
        try{talis.el.animate([{opacity:1},{opacity:0}],{duration:120,fill:'forwards'});}catch(e){}
        rm(talis.el,140);
        var si4;
        for(si4=0;si4<4;si4++){(function(){
          var sh=hbaZbEl('hba-zbtshard',tx,ty);
          var a=Math.random()*Math.PI*2, d=20+Math.random()*30, dx=Math.cos(a)*d, dy=Math.sin(a)*d, gy=dy+30+Math.random()*20;
          try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+((Math.random()-.5)*360)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) rotate('+((Math.random()-.5)*540)+'deg)',opacity:0}],{duration:520,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(sh,560);
        })();}
      }
      var vg=hbaZbEl('hba-zbvign',0,0); vg.style.left='0'; vg.style.top='0';
      try{vg.animate([{opacity:0},{opacity:.45,offset:.3},{opacity:0}],{duration:380/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,440/sp);
      var fl=hbaZbEl('hba-zbflash',hx,hy,Math.round(58*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,320);
      var zr=hbaZbEl('hba-zbring',hx,hy,44); void zr.offsetWidth; zr.classList.add('go'); rm(zr,520);
      var bar=document.querySelector('.hero-hp-bar');
      if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},300); }
      var clouds=[{ox:0,oy:0,s:74},{ox:-26,oy:-16,s:54},{ox:26,oy:-12,s:58}];
      clouds.forEach(function(cd,k){setTimeout(function(){
        var cs=Math.round(cd.s*fxi*sz);
        var cl=hbaZbEl('hba-zbcloud',hx+cd.ox*sz,hy+cd.oy*sz,cs,cs);
        try{cl.animate([
          {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
          {transform:'translate(-50%,-50%) scale(1)',opacity:.85,offset:.3},
          {transform:'translate(-50%,-50%) translate(0,-14px) scale(1.45)',opacity:0}
        ],{duration:560/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(cl,620/sp);
      },k*60);});
      var nb4=Math.round(8*fxi), b4;
      for(b4=0;b4<nb4;b4++){(function(){
        var bsz=Math.round((8+Math.random()*10)*sz);
        var bb=hbaZbEl('hba-zbbub',hx+(Math.random()-.5)*90*fxi,hy+(Math.random()-.5)*20,bsz,bsz);
        var rise=26+Math.random()*34, sway=(Math.random()-.5)*22;
        try{bb.animate([
          {transform:'translate(-50%,-50%) scale(.35)',opacity:.95},
          {transform:'translate(-50%,-50%) translate('+(sway*0.5)+'px,-'+(rise*0.6)+'px) scale(1)',opacity:.9,offset:.65},
          {transform:'translate(-50%,-50%) translate('+sway+'px,-'+rise+'px) scale(1.6)',opacity:0}
        ],{duration:560+Math.random()*240,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(bb,860);
      })();}
      var ns4=Math.round(10*fxi), s4;
      for(s4=0;s4<ns4;s4++){(function(){
        var dp=hbaZbEl('hba-zbdrop',hx,hy);
        var a=-Math.PI/2+(Math.random()-.5)*2.6, d=(28+Math.random()*48)*fxi, dx=Math.cos(a)*d, dy=Math.sin(a)*d, gy=Math.abs(dy)*0.55+26+Math.random()*22;
        try{dp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) scale(.5)',opacity:0}],{duration:540+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
        rm(dp,830);
      })();}
      deal();
    },1240/sp);
  }
  // 🔴 v515: 暗夜吸血鬼·血月蝠群——SVG蝙蝠(双翼独立扇动)·复用 v506 四牙图(makeVfang)。血月红硬编码。
  function hbaVmEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaVmBatSVG(u){
    return '<svg viewBox="0 0 100 56" xmlns="http://www.w3.org/2000/svg">'
      +'<g class="wl"><path d="M40,28 Q22,8 4,14 Q14,22 10,30 Q20,28 24,36 Q32,32 40,34 Z" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.6" stroke-linejoin="round"/></g>'
      +'<g class="wr"><path d="M60,28 Q78,8 96,14 Q86,22 90,30 Q80,28 76,36 Q68,32 60,34 Z" fill="#7f1d1d" stroke="#ef4444" stroke-width="1.6" stroke-linejoin="round"/></g>'
      +'<ellipse cx="50" cy="30" rx="9" ry="12" fill="#1c0a10" stroke="#ef4444" stroke-width="1.4"/>'
      +'<path d="M44,20 L42,10 L48,16 Z M56,20 L58,10 L52,16 Z" fill="#1c0a10" stroke="#ef4444" stroke-width="1.2" stroke-linejoin="round"/>'
      +'<circle cx="46.5" cy="26" r="1.8" fill="#fecaca"/><circle cx="53.5" cy="26" r="1.8" fill="#fecaca"/>'
      +'</svg>';
  }
  function hbaVmQB(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x, y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  var _vmuu=0;
  // 主编排: ①血月 ②蝠群 ③真牙咬合(deal) ④吸血回流
  function hbaBatMoon(bx,bsTop,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    /* ① 血月升起 + 夜幕 + 剪影掠月 */
    var nt=hbaVmEl('hba-vmnight',0,0); nt.style.left='0'; nt.style.top='0';
    try{nt.animate([{opacity:0},{opacity:.85,offset:.32},{opacity:0}],{duration:1900/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(nt,1960/sp);
    var MS=Math.round(64*sz);
    var moonX=Math.min(bx+52, window.innerWidth-4-MS), moonTop=bsTop+2;  /* 🔴 v622(Hansen): 血月回到【右侧】原位(bx+52)——v614 改成 bx-MS/2 居中后, 血月(红)正好压在吸血鬼头部(也是红)上=挡脸严重影响视觉; 现恢复 v614 之前的偏右位+钳位防出屏。獠牙咬合/血条仍走中线(barL+barW·不受月亮影响)。 */
    var m=hbaVmEl('hba-vmmoon',moonX,moonTop,MS,MS);
    var mc={x:moonX+MS/2, y:moonTop+MS/2};
    try{m.animate([
      {transform:'translateY(16px) scale(.7)',opacity:0},
      {transform:'translateY(0) scale(1)',opacity:1,offset:.3},
      {transform:'translateY(0) scale(1)',opacity:1}
    ],{duration:1700/sp,easing:'ease-out',fill:'forwards'});}catch(e){m.style.opacity='1';}
    var si;
    for(si=0;si<2;si++){(function(k){setTimeout(function(){
      var bsz=Math.round(26*sz);
      var b=document.createElement('div'); b.className='hba-vmbat';
      b.style.width=bsz+'px'; b.style.height=Math.round(bsz*56/100)+'px';
      b.style.left=(mc.x-34-bsz/2)+'px'; b.style.top=(moonTop+10+k*16)+'px';
      b.style.opacity='0'; b.innerHTML=hbaVmBatSVG('s'+(_vmuu++));
      (window.__hansenFxLayer||document.body).appendChild(b);
      var dx=(k%2?-1:1)*70;
      try{b.animate([
        {transform:'translate(0,0) scale(.8)',opacity:0},
        {transform:'translate('+(dx*0.5)+'px,-4px) scale(.9)',opacity:.85,offset:.5},
        {transform:'translate('+dx+'px,2px) scale(.8)',opacity:0}
      ],{duration:520/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(b,560/sp);
    },120/sp+k*(170/sp));})(si);}
    /* ② 蝙蝠群袭 */
    setTimeout(function(){
      var n=Math.round(9*fxi), bi;
      for(bi=0;bi<n;bi++){(function(k){setTimeout(function(){
        var bsz=Math.round((30+Math.random()*14)*sz);
        var b=document.createElement('div'); b.className='hba-vmbat';
        b.style.width=bsz+'px'; b.style.height=Math.round(bsz*56/100)+'px';
        b.innerHTML=hbaVmBatSVG('b'+(_vmuu++));
        (window.__hansenFxLayer||document.body).appendChild(b);
        var p0={x:mc.x+(Math.random()-.5)*40, y:mc.y+10+Math.random()*16};
        var p1={x:barL+barW*(0.1+0.8*Math.random()), y:midY-8+Math.random()*10};
        var side=(k%2?1:-1);
        var pc={x:(p0.x+p1.x)/2+side*(60+Math.random()*70), y:(p0.y+p1.y)/2-10+Math.random()*40};
        var dur=(560+Math.random()*180)/sp, t0=null, prev=p0;
        function step(now){
          if(t0===null)t0=now;
          var t=(now-t0)/dur; if(t>1)t=1;
          var pos=hbaVmQB(p0,pc,p1,t);
          b.style.left=(pos.x-bsz/2)+'px'; b.style.top=(pos.y-bsz*56/200)+'px';
          b.style.opacity = t<0.1 ? (t/0.1).toFixed(2) : (t>0.94?((1-t)/0.06).toFixed(2):'1');
          var ang=Math.atan2(pos.y-prev.y,pos.x-prev.x)*180/Math.PI;
          b.style.transform='rotate('+(ang*0.4)+'deg)';
          prev=pos;
          if(t<1){requestAnimationFrame(step);}
          else{
            if(b.parentNode)b.remove();
            var ps=Math.round((22+Math.random()*12)*sz);
            var pf=hbaVmEl('hba-vmpuff',p1.x,p1.y,ps,ps);
            try{pf.animate([
              {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
              {transform:'translate(-50%,-50%) scale(1)',opacity:.85,offset:.3},
              {transform:'translate(-50%,-50%) translate(0,-8px) scale(1.4)',opacity:0}
            ],{duration:380,easing:'ease-out',fill:'forwards'});}catch(e){}
            rm(pf,420);
            if(Math.random()<0.5){var rg=hbaVmEl('hba-vmring',p1.x,p1.y,26); void rg.offsetWidth; rg.classList.add('go'); rm(rg,420);}
          }
        }
        requestAnimationFrame(step);
      },k*(62/sp));})(bi);}
    },340/sp);
    /* ③ 獠牙咬合(复用 v506 makeVfang 真牙图·deal) */
    setTimeout(function(){
      var closeDur=380/sp, pairs=[[0.34,'tl','bl'],[0.62,'tr','br']], made=[];
      pairs.forEach(function(pr){
        var fxp=barL+barW*pr[0];
        [pr[1],pr[2]].forEach(function(which){
          var isTop=(which==='tl'||which==='tr');
          var f=makeVfang(which, sz*1.15);
          f.style.left=(fxp-f._w/2)+'px';
          f.style.top=(isTop?(midY-f._h):midY)+'px';
          (window.__hansenFxLayer||document.body).appendChild(f); made.push(f);
          var fromY=isTop?-(70*sz):(70*sz);
          try{f.animate([
            {transform:'translateY('+fromY+'px)',opacity:0},
            {transform:'translateY('+fromY+'px)',opacity:1,offset:.16},
            {transform:'translateY(0)',opacity:1}
          ],{duration:closeDur,easing:'cubic-bezier(.5,.05,.7,.4)',fill:'forwards'});}catch(e){f.style.opacity='1';}
        });
      });
      setTimeout(function(){
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},320); }
        var fl=hbaVmEl('hba-vmflash',barL+barW*0.48,midY,Math.round(46*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,320);
        var di;
        for(di=0;di<2;di++){(function(k){
          var dp=hbaVmEl('hba-vmdrip',barL+barW*(k?0.62:0.34)+(Math.random()-.5)*8,midY+4);
          try{dp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*8)+'px,'+(22+Math.random()*14)+'px)',opacity:0}],{duration:480,easing:'cubic-bezier(.4,.1,.7,.6)',fill:'forwards'});}catch(e){}
          rm(dp,520);
        })(di);}
        deal();
        setTimeout(function(){
          made.forEach(function(f){try{f.animate([{opacity:1},{opacity:0}],{duration:200,fill:'forwards'});}catch(e){} rm(f,230);});
        },210/sp);
      },closeDur);
    },1080/sp);
    /* ④ 吸血回流(血球拖尾吸回血月·月亮胀亮) */
    setTimeout(function(){
      var n4=Math.round(7*fxi), oi;
      for(oi=0;oi<n4;oi++){(function(k){setTimeout(function(){
        var os=Math.round((9+Math.random()*7)*sz);
        var o=hbaVmEl('hba-vmorb',0,0,os,os);
        var p0={x:hx+(Math.random()-.5)*110, y:midY+(Math.random()-.5)*10};
        var p1={x:mc.x, y:mc.y};
        var pc={x:(p0.x+p1.x)/2+(Math.random()-.5)*90, y:(p0.y+p1.y)/2-20-Math.random()*40};
        var dur=(520+Math.random()*180)/sp, t0=null, fr=0;
        function step(now){
          if(t0===null)t0=now;
          var t=(now-t0)/dur; if(t>1)t=1;
          var pos=hbaVmQB(p0,pc,p1,t);
          o.style.left=(pos.x-os/2)+'px'; o.style.top=(pos.y-os/2)+'px';
          o.style.opacity = t<0.12 ? (t/0.12).toFixed(2) : (t>0.9?((1-t)/0.1).toFixed(2):'1');
          if((fr++%3)===0&&t>0.05&&t<0.9){var ts=4+Math.random()*4;var tr=hbaVmEl('hba-vmtrail',pos.x,pos.y,ts,ts);tr.style.transform='translate(-50%,-50%)';
            try{tr.animate([{opacity:.8,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:300,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,340);}
          if(t<1){requestAnimationFrame(step);}
          else{
            if(o.parentNode)o.remove();
            try{m.animate([{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.13)',filter:'brightness(1.35)'},{transform:'scale(1)',filter:'brightness(1)'}],{duration:200,easing:'ease-out'});}catch(e){}
          }
        }
        requestAnimationFrame(step);
      },k*(70/sp));})(oi);}
      setTimeout(function(){
        var vg=hbaVmEl('hba-vmvign',0,0); vg.style.left='0'; vg.style.top='0';
        try{vg.animate([{opacity:0},{opacity:.5,offset:.32},{opacity:0}],{duration:420/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,480/sp);
      },(n4*70+260)/sp);
    },1560/sp);
    /* 血月退场 */
    setTimeout(function(){
      try{m.animate([{opacity:1},{opacity:0}],{duration:340,fill:'forwards'});}catch(e){}
      rm(m,380);
    },2320/sp);
  }
  // 🔴 v516: 蒙面大魔王·千面幻杀——SVG件(魔法阵+幻影面具·全内联无外部图)。魔王紫硬编码·面具金冠/红面罩固定。
  function hbaMkEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaMkCircleSVG(u){
    var ticks='', i;
    for(i=0;i<12;i++){var a=i*30*Math.PI/180, r1=44, r2=50;
      ticks+='<line x1="'+(60+Math.cos(a)*r1).toFixed(1)+'" y1="'+(60+Math.sin(a)*r1).toFixed(1)+'" x2="'+(60+Math.cos(a)*r2).toFixed(1)+'" y2="'+(60+Math.sin(a)*r2).toFixed(1)+'" stroke="#fbbf24" stroke-width="2.4" stroke-linecap="round"/>';}
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">'
      +'<g class="ringO"><circle cx="60" cy="60" r="52" fill="none" stroke="#a855f7" stroke-width="2.6" stroke-dasharray="10 6" opacity="0.92"/>'
      +'<circle cx="60" cy="60" r="44" fill="none" stroke="#fbbf24" stroke-width="1.4" opacity="0.75"/>'+ticks+'</g>'
      +'<g class="ringI"><circle cx="60" cy="60" r="30" fill="none" stroke="#e9d5ff" stroke-width="1.8" opacity="0.85"/>'
      +'<path d="M60,32 L84,74 L36,74 Z" fill="none" stroke="#a855f7" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>'
      +'<path d="M60,88 L36,46 L84,46 Z" fill="none" stroke="#a855f7" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>'
      +'<circle cx="60" cy="60" r="6" fill="#a855f7" opacity="0.85"/></g>'
      +'</svg>';
  }
  function hbaMkMaskSVG(u){
    return '<svg viewBox="0 0 80 96" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M40,10 Q66,12 68,40 Q69,66 54,82 Q40,93 26,82 Q11,66 12,40 Q14,12 40,10 Z" fill="#2a1140" stroke="#a855f7" stroke-width="2.4" stroke-linejoin="round"/>'
      +'<path d="M12,38 L2,30 L13,28 Z M68,38 L78,30 L67,28 Z" fill="#2a1140" stroke="#a855f7" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M24,14 L28,2 L34,12 L40,1 L46,12 L52,2 L56,14 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.4" stroke-linejoin="round"/>'
      +'<circle cx="40" cy="11" r="3.4" fill="#dc2626" stroke="#7f1d1d" stroke-width="1"/>'
      +'<path class="meye" d="M20,36 Q28,30 36,36 Q28,41 20,36 Z" fill="#facc15" style="filter:drop-shadow(0 0 4px rgba(250,204,21,.9))"/>'
      +'<path class="meye" d="M44,36 Q52,30 60,36 Q52,41 44,36 Z" fill="#facc15" style="filter:drop-shadow(0 0 4px rgba(250,204,21,.9))"/>'
      +'<path d="M14,52 Q40,46 66,52 L64,74 Q40,84 16,74 Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="2" stroke-linejoin="round"/>'
      +'<path d="M22,58 Q40,54 58,58 M21,66 Q40,62 59,66" fill="none" stroke="#7f1d1d" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>'
      +'</svg>';
  }
  var _mkuu=0;
  // 主编排: ①黑暗领域 ②千面分裂 ③锁定齐袭(连击) ④暗黑核+横贯波(deal)
  function hbaMaskPhantom(bx,by,bBot,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 黑暗领域 */
    var dm=hbaMkEl('hba-mkdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:.95,offset:.32},{opacity:0}],{duration:2300/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,2360/sp);
    var CS=Math.round(130*sz);
    var mc=hbaMkEl('hba-mkcircle',bx-CS/2,by-CS*0.62,CS,CS); mc.innerHTML=hbaMkCircleSVG('c'+(_mkuu++));
    try{mc.animate([
      {transform:'scale(.4)',opacity:0},
      {transform:'scale(1)',opacity:.95,offset:.25},
      {transform:'scale(1)',opacity:.95}
    ],{duration:2150/sp,easing:'ease-out',fill:'forwards'});}catch(e){mc.style.opacity='.95';}
    setTimeout(function(){
      try{mc.animate([{opacity:.95},{opacity:0}],{duration:300,fill:'forwards'});}catch(e){}
      rm(mc,340);
    },2150/sp);
    var nm=Math.round(8*fxi), mi;
    for(mi=0;mi<nm;mi++){(function(){
      var mo=hbaMkEl('hba-mkmote',bx+(Math.random()-.5)*150,by+10+Math.random()*40);
      try{mo.animate([{transform:'translate(0,0) scale(1)',opacity:.9},{transform:'translate('+((Math.random()-.5)*16)+'px,-'+(24+Math.random()*30)+'px) scale(.4)',opacity:0}],{duration:(520+Math.random()*260)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(mo,840/sp);
    })();}
    /* ② 千面分裂 */
    var masks=[];
    setTimeout(function(){
      var n=Math.round(5*fxi); if(n<3)n=3;
      var MW=Math.round(44*sz), MH=Math.round(MW*96/80);
      var yTop=bBot+18;
      var yAmp=Math.min(50, Math.max(18,(midY-96)-yTop-10));
      var ki;
      for(ki=0;ki<n;ki++){(function(k){
        var t=(k+0.5)/n;
        var txx=24+t*(vw-48)-MW/2;
        var ty=yTop+Math.sin(t*Math.PI)*yAmp+((k%2)?12:-4);
        if(ty>midY-92)ty=midY-92;
        var pm=document.createElement('div'); pm.className='hba-mkmask';
        pm.style.width=MW+'px'; pm.style.height=MH+'px';
        pm.style.left=(bx-MW/2)+'px'; pm.style.top=(by-MH/2)+'px';
        pm.innerHTML=hbaMkMaskSVG('m'+(_mkuu++));
        (window.__hansenFxLayer||document.body).appendChild(pm);
        var dx=txx-(bx-MW/2), dy=ty-(by-MH/2);
        setTimeout(function(){
          try{pm.animate([
            {transform:'translate(0,0) rotate(0deg) scale(.5)',opacity:0},
            {transform:'translate('+(dx*0.3)+'px,'+(dy*0.3)+'px) rotate('+((k%2?1:-1)*120)+'deg) scale(.9)',opacity:.95,offset:.3},
            {transform:'translate('+dx+'px,'+dy+'px) rotate(360deg) scale(1)',opacity:1}
          ],{duration:340/sp,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});}catch(e){pm.style.left=txx+'px';pm.style.top=ty+'px';}
          setTimeout(function(){
            pm.style.left=txx+'px'; pm.style.top=ty+'px';
            try{var an=pm.getAnimations&&pm.getAnimations(); if(an)an.forEach(function(a){a.cancel();});}catch(e){}
            pm.style.transform='none';
            pm.classList.add('hover');
          },360/sp);
        },k*(70/sp));
        masks.push({el:pm,x:txx+MW/2,y:ty+MH/2});
      })(ki);}
    },280/sp);
    /* ③ 锁定+齐袭 */
    setTimeout(function(){
      masks.forEach(function(mk){mk.el.classList.add('lock');});
      var n=masks.length, hit=0;
      setTimeout(function(){
        masks.forEach(function(mk,k){setTimeout(function(){
          mk.el.classList.remove('hover');
          var tx=barL+barW*(0.16+0.68*(k/(n-1||1)))+(Math.random()-.5)*14;
          var ty=midY-2;
          var dx=tx-mk.x, dy=ty-mk.y, dur=240/sp;
          try{mk.el.animate([
            {transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1},
            {transform:'translate('+(dx*0.5)+'px,'+(dy*0.45)+'px) rotate(270deg) scale(.95)',opacity:1,offset:.5},
            {transform:'translate('+dx+'px,'+dy+'px) rotate(540deg) scale(.82)',opacity:1,offset:.92},
            {transform:'translate('+dx+'px,'+dy+'px) rotate(560deg) scale(.5)',opacity:0}
          ],{duration:dur+60,easing:'cubic-bezier(.5,.05,.7,.4)',fill:'forwards'});}catch(e){}
          setTimeout(function(){
            if(mk.el.parentNode)mk.el.remove();
            var cf=hbaMkEl('hba-mkcrack',tx,ty,Math.round(34*fxi)); void cf.offsetWidth; cf.classList.add('go'); rm(cf,320);
            var rg=hbaMkEl('hba-mkring',tx,ty,24); void rg.offsetWidth; rg.classList.add('go'); rm(rg,420);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},130); }
            hit++;
            var cb=document.createElement('div'); cb.className='hba-mkcombo'; cb.textContent=hit+' 连!';
            cb.style.left=(tx-14)+'px'; cb.style.top=(midY-34)+'px';
            (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
          },dur);
        },k*(95/sp));});
      },180/sp);
    },980/sp);
    /* ④ 暗黑核+横贯波(deal) */
    var nMask=Math.max(3,Math.round(5*fxi));
    var strikeEnd=(980+180+(nMask-1)*95+300)/sp;
    setTimeout(function(){
      var CS2=Math.round(30*sz);
      var core=hbaMkEl('hba-mkcore',bx-CS2/2,bBot-6-CS2/2,CS2,CS2);
      try{core.animate([
        {transform:'scale(.25)',opacity:0},
        {transform:'scale(1.15)',opacity:1,offset:.55},
        {transform:'scale(.95)',opacity:1,offset:.75},
        {transform:'scale(1.3)',opacity:0}
      ],{duration:330/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(core,370/sp);
      setTimeout(function(){
        var W=Math.round(190*sz), H=Math.round(48*sz);
        var w=hbaMkEl('hba-mkwave',bx-W/2,bBot+18,W,H);
        var inner=document.createElement('div'); inner.className='arc'; w.appendChild(inner);
        var dy=midY-(bBot+18)-8;
        try{w.animate([
          {transform:'translateY(0) scaleX(.5)',opacity:0},
          {transform:'translateY('+(dy*0.22)+'px) scaleX(.85)',opacity:.95,offset:.22},
          {transform:'translateY('+dy+'px) scaleX(1.45)',opacity:.92,offset:.9},
          {transform:'translateY('+(dy+10)+'px) scaleX(1.6)',opacity:0}
        ],{duration:330/sp,easing:'cubic-bezier(.45,.1,.6,.9)',fill:'forwards'});}catch(e){}
        rm(w,370/sp);
        setTimeout(function(){
          var fl=hbaMkEl('hba-mkflash',hx,midY,Math.round(58*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,340);
          var rg2=hbaMkEl('hba-mkring',hx,midY,44); rg2.style.borderWidth='3px'; void rg2.offsetWidth; rg2.classList.add('go'); rm(rg2,430);
          var bar2=document.querySelector('.hero-hp-bar');
          if(bar2){ bar2.classList.add('hsn-bite-glow'); setTimeout(function(){bar2.classList.remove('hsn-bite-glow');},320); }
          var ns=Math.round(12*fxi), si;
          for(si=0;si<ns;si++){(function(){
            var sh=hbaMkEl('hba-mkshard',hx,midY); sh.style.background=(Math.random()<0.5)?'#e9d5ff':'#a855f7'; sh.style.boxShadow='0 0 6px rgba(168,85,247,.9)';
            var a=-Math.PI/2+(Math.random()-.5)*2.6, d=(28+Math.random()*50)*fxi, dx=Math.cos(a)*d, dy2=Math.sin(a)*d, gy=Math.abs(dy2)*0.55+26+Math.random()*22, rot=(Math.random()-.5)*540;
            try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate('+(rot*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
            rm(sh,860);
          })();}
          var vg=hbaMkEl('hba-mkvign',0,0); vg.style.left='0'; vg.style.top='0';
          try{vg.animate([{opacity:0},{opacity:.5,offset:.32},{opacity:0}],{duration:420/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,480/sp);
          deal();
        },(330*0.9)/sp);
      },300/sp);
    },strikeEnd);
  }
  // 🔴 v517: 地狱犬王·三头炼狱——SVG件(地狱之门半透明炉光/啸波/火苗·全内联无外部图)。炼狱橙硬编码。
  function hbaHgEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaHgGateSVG(u){
    return '<svg viewBox="0 0 150 120" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="hbahg'+u+'" cx="0.5" cy="0.85" r="0.9"><stop offset="0" stop-color="#fde68a" stop-opacity="0.85"/><stop offset="0.4" stop-color="#f97316" stop-opacity="0.55"/><stop offset="1" stop-color="#b91c1c" stop-opacity="0.12"/></radialGradient></defs>'
      +'<path class="ginner" d="M35,116 L35,52 Q75,8 115,52 L115,116 Z" fill="url(#hbahg'+u+')"/>'
      +'<path d="M28,118 L28,50 Q75,0 122,50 L122,118 L106,118 L106,54 Q75,18 44,54 L44,118 Z" fill="#171210" stroke="#3a2c22" stroke-width="2.5" stroke-linejoin="round" opacity="0.96"/>'
      +'<path d="M34,84 L42,80 M108,92 L116,88 M32,62 L40,60 M110,66 L118,62" stroke="#f97316" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>'
      +'<path d="M22,118 L128,118" stroke="#3a2c22" stroke-width="4" stroke-linecap="round"/>'
      +'<path class="gfl" d="M58,116 Q54,104 60,96 Q64,104 62,108 Q68,102 66,94 Q72,104 66,116 Z" fill="#f97316" opacity="0.92"/>'
      +'<path class="gfl2" d="M92,116 Q88,106 93,99 Q96,106 94,110 Q99,104 98,97 Q103,107 97,116 Z" fill="#fde68a" opacity="0.85"/>'
      +'</svg>';
  }
  function hbaHgWaveSVG(){
    return '<svg viewBox="0 0 120 56" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M8,8 Q60,62 112,8" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round" opacity="0.85" style="filter:drop-shadow(0 0 6px rgba(249,115,22,.9))"/>'
      +'<path d="M16,12 Q60,52 104,12" fill="none" stroke="#fde68a" stroke-width="2.2" stroke-linecap="round" opacity="0.9"/>'
      +'</svg>';
  }
  function hbaHgFlameSVG(u){
    return '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M12,2 Q19,12 16,20 Q21,17 20,26 Q17,35 12,35 Q7,35 4,26 Q3,17 8,20 Q5,12 12,2 Z" fill="#f97316" opacity="0.9"/>'
      +'<path d="M12,12 Q15,18 13,24 Q16,28 12,32 Q8,28 11,24 Q9,18 12,12 Z" fill="#fde68a" opacity="0.95"/>'
      +'</svg>';
  }
  function hbaHgQB(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x, y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  var _hguu=0;
  // 主编排: ①地狱之门 ②三头齐啸 ③三连火球(连击) ④三核汇聚+炎息(deal)
  function hbaHellGate(bsL,bsT,bsW,bsH,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    var cx=bsL+bsW/2, cy=bsT+bsH/2, bsBot=bsT+bsH;
    var heads=[
      {x:cx-bsW*0.31, y:cy+bsH*0.04},
      {x:cx+bsW*0.31, y:cy+bsH*0.04},
      {x:cx,          y:cy-bsH*0.10}
    ];
    /* ① 地狱之门 + 余烬 */
    var dm=hbaHgEl('hba-hgdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:.95,offset:.32},{opacity:0}],{duration:2400/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,2460/sp);
    var GW=Math.round(Math.max(150*sz, bsW*1.5)), GH=Math.round(GW*120/150);
    var g=hbaHgEl('hba-hggate',cx-GW/2,bsBot-GH+6,GW,GH); g.innerHTML=hbaHgGateSVG('g'+(_hguu++));
    try{if(window.__hansenFxLayerBack)window.__hansenFxLayerBack.appendChild(g);}catch(e){} //🔴BUG#70(v536): 门移背景层——v517设计本意"门在boss身后升起·boss剪影于门火前", v533迁前景层后门盖住了三头犬(Hansen真机实拍)
    try{g.animate([
      {transform:'translateY(26px) scale(.8)',opacity:0},
      {transform:'translateY(0) scale(1)',opacity:1,offset:.3},
      {transform:'translateY(0) scale(1)',opacity:1}
    ],{duration:2150/sp,easing:'ease-out',fill:'forwards'});}catch(e){g.style.opacity='1';}
    setTimeout(function(){
      try{g.animate([{opacity:1},{opacity:0}],{duration:320,fill:'forwards'});}catch(e){}
      rm(g,360);
    },2150/sp);
    var ne=Math.round(8*fxi), ei;
    for(ei=0;ei<ne;ei++){(function(){
      var em=hbaHgEl('hba-hgember',cx+(Math.random()-.5)*170,cy+30+Math.random()*120);
      try{em.animate([{transform:'translate(0,0) scale(1)',opacity:.9},{transform:'translate('+((Math.random()-.5)*18)+'px,-'+(24+Math.random()*32)+'px) scale(.4)',opacity:0}],{duration:(520+Math.random()*280)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(em,860/sp);
    })();}
    /* ② 三头齐啸 + 地面火苗 */
    setTimeout(function(){
      heads.forEach(function(hp,k){
        var ri;
        for(ri=0;ri<2;ri++){(function(r){setTimeout(function(){
          var w=Math.round(96*sz), h=Math.round(w*56/120);
          var wv=hbaHgEl('hba-hgwave',hp.x-w/2,hp.y+4,w,h); wv.innerHTML=hbaHgWaveSVG();
          var dist=midY-hp.y-10;
          try{wv.animate([
            {transform:'translateY(0) scale(.5)',opacity:0},
            {transform:'translateY('+(dist*0.18)+'px) scale(.82)',opacity:.95,offset:.18},
            {transform:'translateY('+dist+'px) scale(1.4)',opacity:0}
          ],{duration:420/sp,easing:'cubic-bezier(.3,.5,.5,1)',fill:'forwards'});}catch(e){}
          rm(wv,460/sp);
        },r*(120/sp)+k*30);})(ri);}
      });
      var nf=Math.round(5*fxi), fi;
      for(fi=0;fi<nf;fi++){(function(){
        var fw=Math.round((14+Math.random()*8)*sz), fh=Math.round(fw*36/24);
        var fl=hbaHgEl('hba-hgflame',24+Math.random()*(vw-48),midY+8-fh,fw,fh); fl.innerHTML=hbaHgFlameSVG('f'+(_hguu++));
        try{fl.animate([
          {transform:'scaleY(.3)',opacity:0},
          {transform:'scaleY(1.25)',opacity:1,offset:.4},
          {transform:'scaleY(.9)',opacity:.9,offset:.7},
          {transform:'scaleY(.2)',opacity:0}
        ],{duration:(560+Math.random()*200)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(fl,820/sp);
      })();}
    },260/sp);
    /* ③ 三头火球三连射(左→右→中) */
    setTimeout(function(){
      var order=[0,1,2], tgt=[0.28,0.72,0.5], hit=0;
      order.forEach(function(hi,k){setTimeout(function(){
        var hp=heads[hi];
        var BS=Math.round((18+(hi===2?8:0))*sz);
        var b=hbaHgEl('hba-hgball',0,0,BS,BS);
        var p0={x:hp.x,y:hp.y+8};
        var p1={x:barL+barW*tgt[k],y:midY-2};
        var pc={x:(p0.x+p1.x)/2+(hi===0?-46:(hi===1?46:0)),y:(p0.y+p1.y)/2-44};
        var dur=320/sp, t0=null, fr=0;
        function step(now){
          if(t0===null)t0=now;
          var t=(now-t0)/dur; if(t>1)t=1;
          var pos=hbaHgQB(p0,pc,p1,t);
          b.style.left=(pos.x-BS/2)+'px'; b.style.top=(pos.y-BS/2)+'px';
          b.style.opacity = t<0.1?(t/0.1).toFixed(2):'1';
          if((fr++%2)===0&&t>0.04&&t<0.96){var ts=5+Math.random()*5;var tr=hbaHgEl('hba-hgtrail',pos.x,pos.y,ts,ts);tr.style.transform='translate(-50%,-50%)';
            try{tr.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,300);}
          if(t<1){requestAnimationFrame(step);}
          else{
            if(b.parentNode)b.remove();
            var bu=hbaHgEl('hba-hgburst',p1.x,p1.y,Math.round(36*fxi)); void bu.offsetWidth; bu.classList.add('go'); rm(bu,320);
            var rg=hbaHgEl('hba-hgring',p1.x,p1.y,22); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},120); }
            hit++;
            var cb=document.createElement('div'); cb.className='hba-hgcombo'; cb.textContent=hit+' 连!';
            cb.style.left=(p1.x-14)+'px'; cb.style.top=(midY-34)+'px';
            (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
          }
        }
        requestAnimationFrame(step);
      },k*(150/sp));});
    },620/sp);
    /* ④ 三核汇聚 + 炎息(deal) */
    setTimeout(function(){
      var cores=[];
      heads.forEach(function(hp){
        var CS=Math.round(16*sz);
        var co=hbaHgEl('hba-hgcore',hp.x-CS/2,hp.y-CS/2+6,CS,CS);
        try{co.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:150/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        cores.push({el:co,x:hp.x,y:hp.y+6});
      });
      var mx=cx, my=cy+30;
      setTimeout(function(){
        cores.forEach(function(co){
          try{co.el.animate([
            {transform:'translate(0,0) scale(1)',opacity:1},
            {transform:'translate('+(mx-co.x)+'px,'+(my-co.y)+'px) scale(.7)',opacity:.9}
          ],{duration:170/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
          rm(co.el,190/sp);
        });
        setTimeout(function(){
          var BIG=Math.round(30*sz);
          var big=hbaHgEl('hba-hgcore',mx-BIG/2,my-BIG/2,BIG,BIG);
          try{big.animate([
            {transform:'scale(.4)',opacity:.6},
            {transform:'scale(1.2)',opacity:1,offset:.6},
            {transform:'scale(1)',opacity:1}
          ],{duration:170/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
          setTimeout(function(){
            try{big.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'});}catch(e){}
            rm(big,170);
            var BW=Math.round(120*sz), BH=Math.max(40,midY-my-6);
            var bm=hbaHgEl('hba-hgbeam',mx-BW/2,my,BW,BH);
            var o=document.createElement('div'); o.className='bouter';
            var n2=document.createElement('div'); n2.className='binner';
            bm.appendChild(o); bm.appendChild(n2);
            try{bm.animate([
              {transform:'scaleY(0)',opacity:.6},
              {transform:'scaleY(1)',opacity:1,offset:.28},
              {transform:'scaleY(1)',opacity:1,offset:.82},
              {transform:'scaleY(1)',opacity:0}
            ],{duration:580/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
            rm(bm,620/sp);
            var nem=Math.round(9*fxi), e2;
            for(e2=0;e2<nem;e2++){(function(){setTimeout(function(){
              var t=Math.random();
              var px=mx+(Math.random()-.5)*BW*(0.3+0.5*t), py=my+BH*t;
              var em=hbaHgEl('hba-hgember',px,py);
              try{em.animate([{transform:'translate(0,0) scale(1)',opacity:.95},{transform:'translate('+((Math.random()-.5)*26)+'px,'+(8+Math.random()*16)+'px) scale(.4)',opacity:0}],{duration:300+Math.random()*200,easing:'ease-out',fill:'forwards'});}catch(e){}
              rm(em,540);
            },Math.random()*380/sp);})(e2);}
            setTimeout(function(){
              var fl=hbaHgEl('hba-hgflash',hx,midY,Math.round(60*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,340);
              var rg2=hbaHgEl('hba-hgring',hx,midY,44); void rg2.offsetWidth; rg2.classList.add('go'); rm(rg2,520);
              var bar2=document.querySelector('.hero-hp-bar');
              if(bar2){ bar2.classList.add('hsn-bite-glow'); setTimeout(function(){bar2.classList.remove('hsn-bite-glow');},340); }
              var ns=Math.round(12*fxi), s3;
              for(s3=0;s3<ns;s3++){(function(){
                var sh=hbaHgEl('hba-hgshard',hx,midY); sh.style.background=(Math.random()<0.5)?'#fde68a':'#f97316'; sh.style.boxShadow='0 0 6px rgba(249,115,22,.9)';
                var a=-Math.PI/2+(Math.random()-.5)*2.6, d=(28+Math.random()*50)*fxi, dx=Math.cos(a)*d, dy2=Math.sin(a)*d, gy=Math.abs(dy2)*0.55+26+Math.random()*22, rot=(Math.random()-.5)*540;
                try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate('+(rot*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
                rm(sh,860);
              })();}
              var s4;
              for(s4=0;s4<3;s4++){(function(k){
                var ss=Math.round((22+Math.random()*16)*sz);
                var sm=hbaHgEl('hba-hgsmoke',hx+(k-1)*22,midY-6,ss,ss);
                try{sm.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:.55},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*22)+'px,-'+(18+Math.random()*20)+'px) scale(1.7)',opacity:0}],{duration:680+Math.random()*220,easing:'ease-out',fill:'forwards'});}catch(e){}
                rm(sm,940);
              })(s4);}
              var vg=hbaHgEl('hba-hgvign',0,0); vg.style.left='0'; vg.style.top='0';
              try{vg.animate([{opacity:0},{opacity:.5,offset:.32},{opacity:0}],{duration:420/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,480/sp);
              deal();
            },(580*0.34)/sp);
          },170/sp);
        },170/sp);
      },150/sp);
    },1280/sp);
  }
  // 🔴 v518: 黑森林巫婆·魔药毒苹果——SVG件(荆棘/三足大锅/毒苹果·全内联无外部图)。巫毒紫硬编码·魔药绿/苹果红固定。
  function hbaWtEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaWtVineSVG(u){
    return '<svg viewBox="0 0 200 46" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M2,30 Q40,8 90,26 Q140,42 198,16" fill="none" stroke="#3f6212" stroke-width="5" stroke-linecap="round"/>'
      +'<path d="M2,30 Q40,8 90,26 Q140,42 198,16" fill="none" stroke="#65a30d" stroke-width="2" stroke-linecap="round" opacity="0.8"/>'
      +'<path d="M34,18 L40,6 L44,18 Z M78,24 L86,13 L90,25 Z M126,36 L134,26 L138,38 Z M168,24 L176,13 L180,25 Z" fill="#4d7c0f" stroke="#1a2e05" stroke-width="1" stroke-linejoin="round"/>'
      +'<path d="M58,22 Q62,12 70,12 Q64,20 58,22 Z M150,32 Q156,24 164,25 Q157,32 150,32 Z" fill="#65a30d" opacity="0.85"/>'
      +'</svg>';
  }
  function hbaWtCauldronSVG(u){
    return '<svg viewBox="0 0 90 78" xmlns="http://www.w3.org/2000/svg">'
      +'<path class="cfl" d="M32,76 Q28,66 33,59 Q36,66 34,69 Q40,63 38,56 Q44,66 38,76 Z" fill="#a855f7" opacity="0.9"/>'
      +'<path class="cfl2" d="M54,76 Q50,68 54,61 Q57,68 55,71 Q60,65 59,59 Q64,68 58,76 Z" fill="#e9d5ff" opacity="0.8"/>'
      +'<path d="M20,40 Q20,64 45,64 Q70,64 70,40 L66,40 Q66,60 45,60 Q24,60 24,40 Z" fill="#1c1917" stroke="#44403c" stroke-width="2"/>'
      +'<ellipse cx="45" cy="40" rx="25" ry="8" fill="#1c1917" stroke="#44403c" stroke-width="2.5"/>'
      +'<ellipse class="brew" cx="45" cy="40" rx="20" ry="5.5" fill="#84cc16" stroke="#a3e635" stroke-width="1.4"/>'
      +'<ellipse cx="39" cy="38.6" rx="6" ry="1.8" fill="#d9f99d" opacity="0.85"/>'
      +'<path d="M28,62 L24,72 M62,62 L66,72 M45,64 L45,73" stroke="#44403c" stroke-width="3.4" stroke-linecap="round"/>'
      +'</svg>';
  }
  function hbaWtAppleSVG(u){
    return '<svg viewBox="0 0 48 54" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><radialGradient id="hbawt'+u+'" cx="0.38" cy="0.32" r="0.85"><stop offset="0" stop-color="#fca5a5"/><stop offset="0.45" stop-color="#ef4444"/><stop offset="1" stop-color="#7f1d1d"/></radialGradient></defs>'
      +'<path d="M24,12 Q23,5 19,2" fill="none" stroke="#92400e" stroke-width="2.6" stroke-linecap="round"/>'
      +'<path d="M25,9 Q33,2 40,6 Q34,12 25,9 Z" fill="#65a30d" stroke="#3f6212" stroke-width="1.2"/>'
      +'<path d="M24,12 Q38,10 41,24 Q43,40 33,48 Q24,53 15,48 Q5,40 7,24 Q10,10 24,12 Z" fill="url(#hbawt'+u+')" stroke="#7f1d1d" stroke-width="1.6"/>'
      +'<path d="M24,16 L21,26 L27,30 L23,40" fill="none" stroke="#a3e635" stroke-width="1.8" stroke-linecap="round" opacity="0.95" style="filter:drop-shadow(0 0 3px rgba(163,230,53,.9))"/>'
      +'<circle cx="23" cy="44" r="2" fill="#a3e635" opacity="0.95"/>'
      +'<path d="M14,20 Q17,16 20,18" fill="none" stroke="#fecaca" stroke-width="2" stroke-linecap="round" opacity="0.8"/>'
      +'</svg>';
  }
  function hbaWtQB(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x, y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  var _wtuu=0;
  // 主编排: ①黑森林降临 ②魔药大锅(泡泡interval) ③毒苹果三连(连击) ④荆棘缠杀+毒雾爆发(deal)
  function hbaWitchBrew(bx,bsBot,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 黑森林降临 */
    var dm=hbaWtEl('hba-wtdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:.95,offset:.32},{opacity:0}],{duration:2300/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,2360/sp);
    [0,1].forEach(function(side){
      var L=Math.round(150*sz), H=Math.round(L*46/200);
      var vy=Math.min(bsBot+10+side*42, midY-30);
      var v=document.createElement('div'); v.className='hba-wtvine';
      v.style.width=L+'px'; v.style.height=H+'px';
      v.style.left=(side?vw-L:0)+'px'; v.style.top=vy+'px';
      if(side)v.style.transform='scaleX(-1)';
      var inner=document.createElement('div'); inner.className='vin';
      inner.style.transformOrigin='left center';
      inner.innerHTML=hbaWtVineSVG('v'+(_wtuu++));
      v.appendChild(inner); (window.__hansenFxLayer||document.body).appendChild(v);
      try{inner.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:420/sp,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});}catch(e){inner.style.transform='scaleX(1)';}
      try{v.animate([{opacity:1,offset:0},{opacity:1,offset:.78},{opacity:0,offset:1}],{duration:2100/sp,fill:'forwards'});}catch(e){}
      rm(v,2150/sp);
    });
    var ns=Math.round(7*fxi), si;
    for(si=0;si<ns;si++){(function(){
      var sx=20+Math.random()*(vw-40), sy=bsBot+Math.random()*Math.max(40,(midY+50-bsBot));
      var sp2=hbaWtEl('hba-wtspore',sx,sy);
      try{sp2.animate([{transform:'translate(0,0) scale(.6)',opacity:0},{transform:'translate('+((Math.random()-.5)*22)+'px,-'+(18+Math.random()*26)+'px) scale(1)',opacity:.95,offset:.5},{transform:'translate('+((Math.random()-.5)*30)+'px,-'+(34+Math.random()*30)+'px) scale(.4)',opacity:0}],{duration:(900+Math.random()*500)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(sp2,1500/sp);
    })();}
    /* ② 魔药大锅(锅口坐标进闭包) */
    var mouth=null;
    setTimeout(function(){
      var CW=Math.round(86*sz), CH=Math.round(CW*78/90);
      var cx2=bx, cy2=bsBot+CH*0.18;
      var cd=hbaWtEl('hba-wtcauldron',cx2-CW/2,cy2-CH/2,CW,CH); cd.innerHTML=hbaWtCauldronSVG('c'+(_wtuu++));
      try{cd.animate([
        {transform:'translateY(20px) scale(.6)',opacity:0},
        {transform:'translateY(0) scale(1)',opacity:1,offset:.3},
        {transform:'translateY(0) scale(1)',opacity:1}
      ],{duration:1750/sp,easing:'ease-out',fill:'forwards'});}catch(e){cd.style.opacity='1';}
      setTimeout(function(){
        try{cd.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});}catch(e){}
        rm(cd,340);
      },1750/sp);
      var mouthX=cx2, mouthY=cy2-CH*0.12;
      var bubT=setInterval(function(){
        var bs2=Math.round((6+Math.random()*7)*sz);
        var bb=hbaWtEl('hba-wtbub',mouthX+(Math.random()-.5)*CW*0.4,mouthY,bs2,bs2);
        try{bb.animate([
          {transform:'translate(-50%,-50%) scale(.4)',opacity:.9},
          {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*10)+'px,-'+(12+Math.random()*14)+'px) scale(1)',opacity:.85,offset:.7},
          {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*14)+'px,-'+(20+Math.random()*14)+'px) scale(1.5)',opacity:0}
        ],{duration:430+Math.random()*180,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(bb,660);
      },120/sp);
      setTimeout(function(){clearInterval(bubT);},1700/sp);
      mouth={x:mouthX,y:mouthY};
    },320/sp);
    /* ③ 毒苹果三连发 */
    setTimeout(function(){
      var tgt=[0.26,0.5,0.74], hit=0, ki;
      tgt.forEach(function(tx,k){setTimeout(function(){
        var m0=mouth||{x:bx,y:bsBot};
        var AW=Math.round(26*sz), AH=Math.round(AW*54/48);
        var ap=document.createElement('div'); ap.className='hba-wtapple';
        ap.style.width=AW+'px'; ap.style.height=AH+'px';
        ap.innerHTML=hbaWtAppleSVG('a'+(_wtuu++));
        (window.__hansenFxLayer||document.body).appendChild(ap);
        var p0={x:m0.x,y:m0.y-4};
        var p1={x:barL+barW*tx,y:midY-2};
        var pc={x:(p0.x+p1.x)/2+(k===0?-44:(k===2?44:0)),y:(p0.y+p1.y)/2-52};
        var dur=340/sp, t0=null, fr=0, rot=0, rotV=(k%2?1:-1)*(8+Math.random()*5);
        function step(now){
          if(t0===null)t0=now;
          var t=(now-t0)/dur; if(t>1)t=1;
          var pos=hbaWtQB(p0,pc,p1,t);
          rot+=rotV;
          ap.style.left=(pos.x-AW/2)+'px'; ap.style.top=(pos.y-AH/2)+'px';
          ap.style.transform='rotate('+rot+'deg)';
          ap.style.opacity = t<0.1?(t/0.1).toFixed(2):'1';
          if((fr++%3)===0&&t>0.05&&t<0.95){var ts=4+Math.random()*4;var tr=hbaWtEl('hba-wttrail',pos.x,pos.y,ts,ts);tr.style.transform='translate(-50%,-50%)';
            try{tr.animate([{opacity:.8,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,300);}
          if(t<1){requestAnimationFrame(step);}
          else{
            if(ap.parentNode)ap.remove();
            var bu=hbaWtEl('hba-wtburst',p1.x,p1.y,Math.round(34*fxi)); void bu.offsetWidth; bu.classList.add('go'); rm(bu,320);
            var rg=hbaWtEl('hba-wtring',p1.x,p1.y,22); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},120); }
            hit++;
            var cb=document.createElement('div'); cb.className='hba-wtcombo'; cb.textContent=hit+' 连!';
            cb.style.left=(p1.x-14)+'px'; cb.style.top=(midY-34)+'px';
            (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
          }
        }
        requestAnimationFrame(step);
      },k*(170/sp));});
    },700/sp);
    /* ④ 荆棘缠杀 + 魔药诅咒爆发(deal) */
    setTimeout(function(){
      [0,1].forEach(function(side){
        var sx=side?(vw-12):12, sy=midY+90;
        var L=Math.round(Math.hypot(hx-sx,midY-sy)+12), H=Math.round(Math.max(28,L*46/200));
        var ang=Math.atan2(midY-sy,hx-sx)*180/Math.PI;
        var v=document.createElement('div'); v.className='hba-wtvine';
        v.style.width=L+'px'; v.style.height=H+'px';
        v.style.left=sx+'px'; v.style.top=(sy-H/2)+'px';
        v.style.transform='rotate('+ang+'deg)'; v.style.transformOrigin='left center';
        var inner=document.createElement('div'); inner.className='vin';
        inner.style.transformOrigin='left center';
        inner.innerHTML=hbaWtVineSVG('t'+(_wtuu++));
        v.appendChild(inner); (window.__hansenFxLayer||document.body).appendChild(v);
        try{inner.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:200/sp,easing:'cubic-bezier(.4,.1,.6,.9)',fill:'forwards'});}catch(e){inner.style.transform='scaleX(1)';}
        setTimeout(function(){
          try{inner.animate([{transform:'scaleX(1) scaleY(1)'},{transform:'scaleX(1.04) scaleY(.86)',offset:.4},{transform:'scaleX(1) scaleY(1)'}],{duration:180/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        },220/sp);
        setTimeout(function(){
          try{v.animate([{opacity:1},{opacity:0}],{duration:300/sp,fill:'forwards'});}catch(e){}
          rm(v,340/sp);
        },560/sp);
      });
      setTimeout(function(){
        var m0=mouth||{x:bx,y:bsBot}, di;
        for(di=0;di<5;di++){(function(){
          var dp=hbaWtEl('hba-wtdrop',m0.x+(Math.random()-.5)*24,m0.y);
          var dx=(Math.random()-.5)*30, dy=-(26+Math.random()*30);
          try{dp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.55},{transform:'translate(-50%,-50%) translate('+(dx*1.2)+'px,'+(dy*0.3)+'px)',opacity:0}],{duration:430+Math.random()*150,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(dp,620);
        })();}
      },180/sp);
      setTimeout(function(){
        var fl=hbaWtEl('hba-wtflash',hx,midY,Math.round(58*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,340);
        var rg2=hbaWtEl('hba-wtring',hx,midY,44); void rg2.offsetWidth; rg2.classList.add('go'); rm(rg2,520);
        var bar2=document.querySelector('.hero-hp-bar');
        if(bar2){ bar2.classList.add('hsn-bite-glow'); setTimeout(function(){bar2.classList.remove('hsn-bite-glow');},340); }
        var clouds=[{ox:0,oy:0,s:72,cls:'cg'},{ox:-26,oy:-14,s:54,cls:'cp'},{ox:26,oy:-12,s:56,cls:'cp'},{ox:0,oy:-24,s:46,cls:'cg'}];
        clouds.forEach(function(cd2,k){setTimeout(function(){
          var cs=Math.round(cd2.s*fxi*sz);
          var cl=hbaWtEl('hba-wtcloud '+cd2.cls,hx+cd2.ox*sz,midY+cd2.oy*sz,cs,cs);
          try{cl.animate([
            {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
            {transform:'translate(-50%,-50%) scale(1)',opacity:.85,offset:.3},
            {transform:'translate(-50%,-50%) translate(0,-14px) scale(1.45)',opacity:0}
          ],{duration:560/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(cl,620/sp);
        },k*55);});
        var nb=Math.round(8*fxi), b2;
        for(b2=0;b2<nb;b2++){(function(){
          var bs3=Math.round((8+Math.random()*9)*sz);
          var bb=hbaWtEl('hba-wtbub',hx+(Math.random()-.5)*90*fxi,midY+(Math.random()-.5)*18,bs3,bs3);
          var rise=24+Math.random()*32, sway=(Math.random()-.5)*22;
          try{bb.animate([
            {transform:'translate(-50%,-50%) scale(.35)',opacity:.95},
            {transform:'translate(-50%,-50%) translate('+(sway*0.5)+'px,-'+(rise*0.6)+'px) scale(1)',opacity:.9,offset:.65},
            {transform:'translate(-50%,-50%) translate('+sway+'px,-'+rise+'px) scale(1.6)',opacity:0}
          ],{duration:540+Math.random()*220,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(bb,830);
        })();}
        var nd=Math.round(10*fxi), d2;
        for(d2=0;d2<nd;d2++){(function(){
          var dp=hbaWtEl('hba-wtdrop',hx,midY);
          var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(28+Math.random()*48)*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.55+26+Math.random()*22;
          try{dp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) scale(.5)',opacity:0}],{duration:540+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(dp,830);
        })();}
        var vg=hbaWtEl('hba-wtvign',0,0); vg.style.left='0'; vg.style.top='0';
        try{vg.animate([{opacity:0},{opacity:.5,offset:.32},{opacity:0}],{duration:420/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,480/sp);
        deal();
      },330/sp);
    },1560/sp);
  }
  // 🔴 v519: 异次元巫师·五元素轮舞——五元素表+裂隙/闪电SVG(全内联无外部图)。异次元紫硬编码·五元素色按立绘固定。
  var _hbaXwELEM=[
    {n:'fire',  c1:'#fde68a', c2:'#f97316', c3:'#b91c1c', glow:'rgba(249,115,22,.9)'},
    {n:'thunder',c1:'#fef9c3', c2:'#facc15', c3:'#a16207', glow:'rgba(250,204,21,.9)'},
    {n:'wind',  c1:'#cffafe', c2:'#22d3ee', c3:'#155e75', glow:'rgba(34,211,238,.9)'},
    {n:'water', c1:'#dbeafe', c2:'#3b82f6', c3:'#1e3a8a', glow:'rgba(59,130,246,.9)'},
    {n:'void',  c1:'#f3e8ff', c2:'#a855f7', c3:'#581c87', glow:'rgba(168,85,247,.9)'}
  ];
  function hbaXwEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaXwRiftSVG(u){
    return '<svg viewBox="0 0 60 140" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbaxw'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b021a"/><stop offset="0.5" stop-color="#1e0a3a"/><stop offset="1" stop-color="#0b021a"/></linearGradient></defs>'
      +'<path d="M30,4 L20,30 L32,52 L22,78 L34,100 L25,122 L30,136 L36,118 L27,96 L38,72 L28,48 L38,26 Z" fill="url(#hbaxw'+u+')" stroke="#a855f7" stroke-width="2.4" stroke-linejoin="round"/>'
      +'<path class="redge" d="M30,4 L20,30 L32,52 L22,78 L34,100 L25,122 L30,136" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round" opacity="0.7"/>'
      +'<circle cx="28" cy="36" r="1.6" fill="#fff" opacity="0.9"/><circle cx="31" cy="66" r="1.2" fill="#e9d5ff" opacity="0.85"/><circle cx="29" cy="98" r="1.5" fill="#bfdbfe" opacity="0.9"/>'
      +'</svg>';
  }
  function hbaXwBoltSVG(col){
    return '<svg viewBox="0 0 30 56" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M16,2 L8,24 L15,24 L9,42 L22,18 L14,18 L20,2 Z" fill="'+col+'" stroke="#fff" stroke-width="1.2" stroke-linejoin="round" opacity="0.95"/>'
      +'</svg>';
  }
  function hbaXwOrbDiv(e,sz){
    var d=document.createElement('div'); d.className='hba-xworb';
    d.style.width=sz+'px'; d.style.height=sz+'px';
    d.style.background='radial-gradient(circle at 38% 32%,#fff 0%,'+e.c1+' 26%,'+e.c2+' 60%,'+e.c3+' 92%)';
    d.style.boxShadow='0 0 14px '+e.glow+',0 0 28px '+e.glow.replace('.9','.4');
    (window.__hansenFxLayer||document.body).appendChild(d); return d;
  }
  function hbaXwQB(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x, y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  var _xwuu=0;
  // 主编排: ①五元素觉醒公转 ②双裂隙(大: boss右侧空旷区/小: boss左) ③轮舞瞬移连击 ④斜向五色光柱崩塌(deal)
  function hbaDimRift(bx,by,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 觉醒+公转 */
    var dm=hbaXwEl('hba-xwdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:.95,offset:.32},{opacity:0}],{duration:2600/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,2660/sp);
    var R=Math.round(66*sz), OS=Math.round(20*sz);
    var orbs=[], stopOrbit=false;
    _hbaXwELEM.forEach(function(e,k){setTimeout(function(){
      var st={el:hbaXwOrbDiv(e,OS), ang:(-150+k*40)*Math.PI/180, e:e, gone:false};
      orbs.push(st);
      try{st.el.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.15)',opacity:1,offset:.6},{transform:'scale(1)',opacity:1}],{duration:200/sp,easing:'ease-out',fill:'forwards'});}catch(e2){}
    },k*(90/sp));});
    (function loop(){
      if(stopOrbit)return;
      orbs.forEach(function(st){
        if(st.gone)return;
        st.ang+=0.045/sp;
        st.el.style.left=(bx+Math.cos(st.ang)*R-OS/2)+'px';
        st.el.style.top=(by+6+Math.sin(st.ang)*R*0.72-OS/2)+'px';
      });
      requestAnimationFrame(loop);
    })();
    var nr=Math.round(8*fxi), ri;
    for(ri=0;ri<nr;ri++){(function(){
      var rn=hbaXwEl('hba-xwrune',bx+(Math.random()-.5)*170,by+30+Math.random()*60);
      try{rn.animate([{transform:'translate(0,0) scale(.6)',opacity:0},{transform:'translate('+((Math.random()-.5)*16)+'px,-'+(20+Math.random()*26)+'px) scale(1)',opacity:.95,offset:.5},{transform:'translate('+((Math.random()-.5)*22)+'px,-'+(36+Math.random()*26)+'px) scale(.4)',opacity:0}],{duration:(800+Math.random()*400)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(rn,1300/sp);
    })();}
    /* ② 双裂隙(游戏空间适配: 大裂隙开在boss右侧空旷区·小裂口在boss左) */
    var rifts=null;
    setTimeout(function(){
      var RW=Math.round(40*sz), RH=Math.round(RW*140/60);
      var rcy=Math.max(by, 84+RH/2);
      var rx=vw-RW/2-14;
      var big=hbaXwEl('hba-xwrift',rx-RW/2,rcy-RH/2,RW,RH); big.innerHTML=hbaXwRiftSVG('b'+(_xwuu++));
      try{big.animate([
        {transform:'scaleY(0) rotate(-4deg)',opacity:0},
        {transform:'scaleY(1.1) rotate(2deg)',opacity:1,offset:.55},
        {transform:'scaleY(1) rotate(0deg)',opacity:1}
      ],{duration:260/sp,easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'});}catch(e){big.style.opacity='1';}
      var SW=Math.round(22*sz), SH=Math.round(SW*140/60);
      var mx=bx-54*sz, my=by-4;
      var mini=hbaXwEl('hba-xwrift',mx-SW/2,my-SH/2,SW,SH); mini.innerHTML=hbaXwRiftSVG('m'+(_xwuu++));
      try{mini.animate([
        {transform:'scaleY(0)',opacity:0},
        {transform:'scaleY(1)',opacity:1}
      ],{duration:220/sp,easing:'ease-out',fill:'forwards'});}catch(e){mini.style.opacity='1';}
      rifts={big:big,bigX:rx,bigCy:rcy,bigMouthY:rcy+RH*0.28,beamY:rcy+RH*0.34,mini:mini,miniX:mx,miniY:my};
    },520/sp);
    /* ③ 五元素轮舞瞬移连击 */
    setTimeout(function(){
      stopOrbit=true;
      var n=orbs.length, hit=0, tgt=[0.18,0.34,0.5,0.66,0.82];
      orbs.forEach(function(ob,k){setTimeout(function(){
        ob.gone=true;
        var e=ob.e;
        var r0=ob.el.getBoundingClientRect();
        var p0={x:r0.left+r0.width/2, y:r0.top+r0.height/2};
        var rf=rifts||{miniX:bx-54*sz,miniY:by-4,bigX:vw-34,bigMouthY:by,beamY:by};
        var p1={x:rf.miniX, y:rf.miniY};
        var pc={x:(p0.x+p1.x)/2, y:(p0.y+p1.y)/2-30};
        var dur=170/sp, t0=null;
        (function fly1(now){
          if(t0===null)t0=now;
          var t=((now||performance.now())-t0)/dur; if(t>1)t=1;
          var pos=hbaXwQB(p0,pc,p1,t);
          ob.el.style.left=(pos.x-OS/2)+'px'; ob.el.style.top=(pos.y-OS/2)+'px';
          ob.el.style.transform='scale('+(1-0.5*t)+')';
          if(t<1){requestAnimationFrame(fly1);}
          else{
            if(ob.el.parentNode)ob.el.remove();
            var f=hbaXwEl('hba-xwhit',p1.x,p1.y,Math.round(22*sz)); f.style.background='radial-gradient(circle,#fff,'+e.c2+' 55%,transparent 75%)'; void f.offsetWidth; f.classList.add('go'); rm(f,320);
            setTimeout(function(){
              var OS2=Math.round(OS*1.05);
              var o2=hbaXwOrbDiv(e,OS2);
              var q0={x:rf.bigX,y:rf.bigMouthY};
              var q1={x:barL+barW*tgt[k],y:midY-2};
              var qc={x:(q0.x+q1.x)/2-30,y:(q0.y+q1.y)/2-26};
              var dur2=230/sp, t1=null;
              o2.style.left=(q0.x-OS2/2)+'px'; o2.style.top=(q0.y-OS2/2)+'px';
              (function fly2(now2){
                if(t1===null)t1=now2;
                var t=((now2||performance.now())-t1)/dur2; if(t>1)t=1;
                var pos2=hbaXwQB(q0,qc,q1,t);
                o2.style.left=(pos2.x-OS2/2)+'px'; o2.style.top=(pos2.y-OS2/2)+'px';
                if(t<1){requestAnimationFrame(fly2);}
                else{
                  if(o2.parentNode)o2.remove();
                  var f2=hbaXwEl('hba-xwhit',q1.x,q1.y,Math.round(34*fxi)); f2.style.background='radial-gradient(circle,#fff,'+e.c1+' 40%,'+e.c2+' 62%,transparent 78%)'; void f2.offsetWidth; f2.classList.add('go'); rm(f2,320);
                  var rg=hbaXwEl('hba-xwringhit',q1.x,q1.y,24); rg.style.borderColor=e.c2; rg.style.boxShadow='0 0 8px '+e.glow; void rg.offsetWidth; rg.classList.add('go'); rm(rg,440);
                  if(e.n==='wind'){var rg2=hbaXwEl('hba-xwringhit',q1.x,q1.y,24); rg2.style.borderColor=e.c1; setTimeout(function(){void rg2.offsetWidth;rg2.classList.add('go');},80); rm(rg2,560);}
                  if(e.n==='thunder'){var bw=Math.round(22*sz), bh=Math.round(bw*56/30);
                    var bo=hbaXwEl('hba-xwbolt',q1.x-bw/2,q1.y-bh,bw,bh); bo.innerHTML=hbaXwBoltSVG(e.c2);
                    try{bo.animate([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.6},{opacity:0}],{duration:240,fill:'forwards'});}catch(e3){}
                    rm(bo,280);}
                  var nsp=Math.round(4*fxi), si;
                  for(si=0;si<nsp;si++){(function(){
                    var sp2=hbaXwEl('hba-xwspark',q1.x,q1.y); sp2.style.background='radial-gradient(circle,#fff,'+e.c2+' 60%,'+e.c3+')'; sp2.style.boxShadow='0 0 6px '+e.glow;
                    var a=-Math.PI/2+(Math.random()-.5)*2.4, d=(16+Math.random()*26)*fxi, dx=Math.cos(a)*d, dy=Math.sin(a)*d, gy=Math.abs(dy)*0.5+18+Math.random()*14;
                    try{sp2.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) scale(.4)',opacity:0}],{duration:430+Math.random()*150,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e4){}
                    rm(sp2,620);
                  })();}
                  var bar=document.querySelector('.hero-hp-bar');
                  if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
                  hit++;
                  var cb=document.createElement('div'); cb.className='hba-xwcombo'; cb.textContent=hit+' 连!';
                  cb.style.left=(q1.x-14)+'px'; cb.style.top=(midY-34)+'px';
                  (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
                }
              })(performance.now());
            },80/sp);
          }
        })(performance.now());
      },k*(200/sp));});
    },900/sp);
    /* ④ 维度崩塌: 裂隙胀亮→斜向五色光柱→闭合(deal) */
    var lastHit=(900+4*200+170+80+230)/sp;
    setTimeout(function(){
      var rf=rifts; if(!rf)return;
      try{rf.big.animate([
        {transform:'scale(1)',filter:'brightness(1) drop-shadow(0 0 14px rgba(168,85,247,.9))'},
        {transform:'scale(1.28)',filter:'brightness(1.5) drop-shadow(0 0 24px rgba(168,85,247,.9))'}
      ],{duration:200/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      setTimeout(function(){
        var BW=Math.round(46*sz);
        var sxp=rf.bigX, syp=rf.beamY;
        var L=Math.round(Math.hypot(hx-sxp,midY-syp));
        var rot=Math.atan2(-(hx-sxp),(midY-syp))*180/Math.PI;
        var bm=hbaXwEl('hba-xwbeam',sxp-BW/2,syp,BW,L);
        var bo=document.createElement('div'); bo.className='bo';
        var bi=document.createElement('div'); bi.className='bi';
        bm.appendChild(bo); bm.appendChild(bi);
        try{bm.animate([
          {transform:'rotate('+rot+'deg) scaleY(0)',opacity:.7},
          {transform:'rotate('+rot+'deg) scaleY(1)',opacity:1,offset:.3},
          {transform:'rotate('+rot+'deg) scaleY(1)',opacity:1,offset:.82},
          {transform:'rotate('+rot+'deg) scaleY(1)',opacity:0}
        ],{duration:520/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(bm,560/sp);
        setTimeout(function(){
          var fl=hbaXwEl('hba-xwflash',hx,midY,Math.round(64*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,360);
          var rg=hbaXwEl('hba-xwringbig',hx,midY,46); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
          var bar2=document.querySelector('.hero-hp-bar');
          if(bar2){ bar2.classList.add('hsn-bite-glow'); setTimeout(function(){bar2.classList.remove('hsn-bite-glow');},340); }
          var ns=Math.round(15*fxi), s3;
          for(s3=0;s3<ns;s3++){(function(){
            var e=_hbaXwELEM[Math.floor(Math.random()*5)];
            var sh=hbaXwEl('hba-xwshard',hx,midY); sh.style.background='linear-gradient(160deg,'+e.c1+','+e.c2+' 60%,'+e.c3+')'; sh.style.boxShadow='0 0 6px '+e.glow;
            var a=-Math.PI/2+(Math.random()-.5)*2.6, d=(30+Math.random()*52)*fxi, dx=Math.cos(a)*d, dy=Math.sin(a)*d, gy=Math.abs(dy)*0.55+26+Math.random()*22, rot2=(Math.random()-.5)*540;
            try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(rot2*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot2+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e5){}
            rm(sh,860);
          })();}
          var vg=hbaXwEl('hba-xwvign',0,0); vg.style.left='0'; vg.style.top='0';
          try{vg.animate([{opacity:0},{opacity:.55,offset:.32},{opacity:0}],{duration:440/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,500/sp);
          deal();
        },(520*0.34)/sp);
        setTimeout(function(){
          [rf.big,rf.mini].forEach(function(r){
            try{r.animate([{transform:'scaleY(1) scaleX(1)',opacity:1},{transform:'scaleY(1.05) scaleX(0)',opacity:0}],{duration:200/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
            rm(r,240/sp);
          });
          var pf=hbaXwEl('hba-xwhit',rf.bigX,rf.bigCy,Math.round(30*sz)); pf.style.background='radial-gradient(circle,#fff,#e9d5ff 55%,transparent 78%)'; void pf.offsetWidth; pf.classList.add('go'); rm(pf,320);
        },560/sp);
      },200/sp);
    },lastHit+120/sp);
  }
  // 🔴 v520: 龙骑士统帅·焚天枪雨——SVG巨翼/龙魂 + Hansen真枪图(bosses/dragonlance.webp 165x360)。BUG#67方案: IIFE初始化预加载+decode存window.__hbaDkLance·落枪cloneNode秒绘。龙焰橙硬编码。
  var _hbaDkLanceSrc='bosses/dragonlance.webp?v=908';
  var _hbaDkLW=165, _hbaDkLH=360;
  window.__hbaDkLance=null;
  (function(){
    try{
      var im=new Image(); im.src=_hbaDkLanceSrc;
      if(im.decode){ im.decode().then(function(){window.__hbaDkLance=im;}).catch(function(){window.__hbaDkLance=im;}); }
      else { im.onload=function(){window.__hbaDkLance=im;}; }
    }catch(e){}
  })();
  function hbaDkEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaDkWingSVG(u){
    return '<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">'
      +'<defs>'
      +'<linearGradient id="hbadk'+u+'" x1="0" y1="0.7" x2="1" y2="0.1"><stop offset="0" stop-color="#5b0f0f"/><stop offset="0.42" stop-color="#991b1b"/><stop offset="0.78" stop-color="#dc2626"/><stop offset="1" stop-color="#f87171"/></linearGradient>'
      +'<radialGradient id="hbadkh'+u+'" cx="0.22" cy="0.34" r="0.55"><stop offset="0" stop-color="#fb923c" stop-opacity="0.5"/><stop offset="1" stop-color="#fb923c" stop-opacity="0"/></radialGradient>'
      +'</defs>'
      +'<path d="M8,132 Q22,72 40,40 L214,16 Q186,46 178,64 L202,70 Q166,88 152,100 L172,108 Q138,124 118,134 Q60,146 8,132 Z" fill="#450a0a" opacity="0.75" transform="translate(3,5)"/>'
      +'<path class="wmem" d="M8,128 Q20,70 38,36 L212,8 Q176,34 170,52 L178,50 Q198,56 196,60 Q160,76 150,88 L158,88 Q172,96 170,100 Q138,114 116,126 L121,131 Q92,140 64,138 Q32,136 8,128 Z" fill="url(#hbadk'+u+')" stroke="#7f1d1d" stroke-width="2.6" stroke-linejoin="round"/>'
      +'<path d="M8,128 Q20,70 38,36 L120,24 Q90,70 70,110 Q40,128 8,128 Z" fill="url(#hbadkh'+u+')"/>'
      +'<path class="wvein" d="M46,44 Q92,40 134,26 M48,52 Q100,58 158,52 M50,62 Q104,80 142,86 M52,72 Q92,100 112,116" fill="none" stroke="#fb923c" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>'
      +'<path d="M6,132 Q14,88 30,52 Q36,40 42,34 L50,38 Q42,46 36,60 Q22,94 16,134 Z" fill="#100a08" stroke="#b45309" stroke-width="1.8" stroke-linejoin="round"/>'
      +'<path d="M40,36 L210,7 L211,12 L42,42 Z" fill="#100a08" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round"/>'
      +'<path d="M41,40 L194,57 L193,62 L42,45 Z" fill="#100a08" stroke="#b45309" stroke-width="1.4" stroke-linejoin="round"/>'
      +'<path d="M42,44 L168,97 L166,102 L41,49 Z" fill="#100a08" stroke="#b45309" stroke-width="1.3" stroke-linejoin="round"/>'
      +'<path d="M41,48 L118,128 L114,131 L39,52 Z" fill="#100a08" stroke="#b45309" stroke-width="1.2" stroke-linejoin="round"/>'
      +'<circle cx="42" cy="40" r="4.6" fill="#1c1208" stroke="#fbbf24" stroke-width="1.6"/>'
      +'<circle cx="118" cy="24" r="2.2" fill="#fbbf24" opacity="0.9"/><circle cx="116" cy="50" r="2" fill="#fbbf24" opacity="0.85"/><circle cx="104" cy="70" r="1.9" fill="#fbbf24" opacity="0.8"/>'
      +'<path d="M40,34 Q30,18 14,6 Q24,8 32,14 Q26,6 22,2 Q36,8 44,26 Q45,31 40,34 Z" fill="#100a08" stroke="#b45309" stroke-width="1.6" stroke-linejoin="round"/>'
      +'<path d="M14,6 L6,0 L17,3 Z" fill="#fbbf24" stroke="#a16207" stroke-width="1"/>'
      +'<path d="M210,7 L218,2 L212,12 Z M194,57 L203,55 L196,63 Z M168,97 L177,98 L169,104 Z" fill="#fb923c" stroke="#7f1d1d" stroke-width="1" stroke-linejoin="round"/>'
      +'<path class="wrim" d="M212,8 Q176,34 170,52 L178,50 Q198,56 196,60 Q160,76 150,88 L158,88 Q172,96 170,100 Q138,114 116,126" fill="none" stroke="#f87171" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>'
      +'<circle class="wtw" cx="96" cy="52" r="1.8" fill="#fde68a"/><circle class="wtw2" cx="128" cy="72" r="1.5" fill="#fb923c"/><circle class="wtw" cx="78" cy="92" r="1.6" fill="#fde68a"/>'
      +'</svg>';
  }
  function hbaDkSoulSVG(u){
    return '<svg viewBox="0 0 140 60" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M6,40 Q30,12 58,30 Q86,48 112,26 L126,18" fill="none" stroke="#fbbf24" stroke-width="6" stroke-linecap="round" opacity="0.92" style="filter:drop-shadow(0 0 7px rgba(250,204,21,.9))"/>'
      +'<path d="M6,40 Q30,12 58,30 Q86,48 112,26 L126,18" fill="none" stroke="#fef9c3" stroke-width="2.2" stroke-linecap="round" opacity="0.95"/>'
      +'<path d="M124,20 L138,10 L132,22 L139,24 L125,27 Z" fill="#fbbf24" stroke="#a16207" stroke-width="1.4" stroke-linejoin="round"/>'
      +'<circle cx="129" cy="20" r="1.7" fill="#7f1d1d"/>'
      +'</svg>';
  }
  function hbaDkFlameSVG(u){
    return '<svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M12,2 Q19,12 16,20 Q21,17 20,26 Q17,35 12,35 Q7,35 4,26 Q3,17 8,20 Q5,12 12,2 Z" fill="#f97316" opacity="0.9"/>'
      +'<path d="M12,12 Q15,18 13,24 Q16,28 12,32 Q8,28 11,24 Q9,18 12,12 Z" fill="#fde68a" opacity="0.95"/>'
      +'</svg>';
  }
  var _dkuu=0;
  // 单根落枪(真枪图·预加载克隆·速度残影·贯穿)
  function hbaDkDropSpear(sp,sz,fxi,x,landY,scale,comboNo,midY,onLand){
    var LH=Math.round(80*sz*scale), LW=Math.round(LH*_hbaDkLW/_hbaDkLH);
    var spd=document.createElement('div'); spd.className='hba-dkspear';
    spd.style.width=LW+'px'; spd.style.height=LH+'px';
    spd.style.left=(x-LW/2)+'px'; spd.style.top=(landY-LH)+'px';
    var jit=(Math.random()-.5)*5;
    var pre=window.__hbaDkLance, img;
    if(pre && pre.naturalWidth>0){ img=pre.cloneNode(false); }
    else { img=document.createElement('img'); img.src=_hbaDkLanceSrc; }
    img.alt=''; img.draggable=false;
    spd.appendChild(img); (window.__hansenFxLayer||document.body).appendChild(spd);
    var fall=(210+Math.random()*50)/sp;
    var dropD=Math.min(landY-LH-70,150)+60; if(dropD<80)dropD=80;
    var tv=hbaDkEl('hba-dktrailv',x-2,landY-LH-dropD,4,Math.round(dropD*0.8));
    try{tv.animate([
      {transform:'scaleY(0)',opacity:0},
      {transform:'scaleY(1) translateY('+(dropD*0.3)+'px)',opacity:.75,offset:.55},
      {transform:'scaleY(.4) translateY('+dropD+'px)',opacity:0}
    ],{duration:fall*1.05,easing:'cubic-bezier(.55,.05,.7,.4)',fill:'forwards'});}catch(e){}
    rm(tv,fall*1.1+40);
    try{spd.animate([
      {transform:'rotate('+jit+'deg) translateY(-'+dropD+'px)',opacity:0},
      {transform:'rotate('+jit+'deg) translateY(-'+(dropD*0.5)+'px)',opacity:1,offset:.3},
      {transform:'rotate('+jit+'deg) translateY(0)',opacity:1,offset:.86},
      {transform:'rotate('+jit+'deg) translateY(3px)',opacity:1}
    ],{duration:fall,easing:'cubic-bezier(.55,.05,.7,.4)',fill:'forwards'});}catch(e){}
    setTimeout(function(){
      if(onLand)onLand();
      var pf=hbaDkEl('hba-dkpierce',x,landY,Math.round((26+scale*8)*fxi)); void pf.offsetWidth; pf.classList.add('go'); rm(pf,320);
      if(comboNo||Math.random()<0.35){var rg=hbaDkEl('hba-dkring',x,landY,18); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);}
      var nst=Math.round((comboNo?4:2)*fxi), si;
      for(si=0;si<nst;si++){(function(){
        var st=hbaDkEl('hba-dkstar',x,landY); st.style.background='radial-gradient(circle,#fff,#fde68a 55%,#f97316)'; st.style.boxShadow='0 0 6px rgba(249,115,22,.9)';
        var a=-Math.PI/2+(Math.random()-.5)*2.4, dd=(14+Math.random()*22)*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.5+16+Math.random()*12;
        try{st.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) scale(.4)',opacity:0}],{duration:400+Math.random()*140,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
        rm(st,580);
      })();}
      if(comboNo){
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
        var cb=document.createElement('div'); cb.className='hba-dkcombo'; cb.textContent=comboNo+' 连!';
        cb.style.left=(x-14)+'px'; cb.style.top=(midY-34)+'px';
        (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
      }
      setTimeout(function(){
        try{spd.animate([{opacity:1},{opacity:0}],{duration:150,fill:'forwards'});}catch(e){}
        rm(spd,180);
      },(comboNo?300:220)/sp);
    },fall*0.86);
  }
  // 主编排: ①巨翼展开 ②统帅号令 ③焚天枪雨 ④终焉巨枪(deal)
  function hbaDragonRain(bx,by,bsTop,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 巨翼展开 */
    var dm=hbaDkEl('hba-dkdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:.98,offset:.32},{opacity:0}],{duration:2700/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,2760/sp);
    var wings=[];
    [0,1].forEach(function(side){
      var W=Math.round(Math.min(196*sz, vw/2+10)), H=Math.round(W*150/220);
      var w=document.createElement('div'); w.className='hba-dkwing';
      w.style.width=W+'px'; w.style.height=H+'px';
      w.style.top=Math.max(62,bsTop-54)+'px';
      w.style.left=(side? (bx-6) : (bx+6-W))+'px';
      if(!side)w.style.transform='scaleX(-1)';
      var fx2=document.createElement('div'); fx2.className='wflex';
      fx2.innerHTML=hbaDkWingSVG('w'+(_dkuu++));
      w.appendChild(fx2);
      (window.__hansenFxLayerBack||window.__hansenFxLayer||document.body).appendChild(w); wings.push({el:w,side:side}); //🔴BUG#70(v536): 巨翼挂背景层——翅膀必须从龙骑士背后展开, 曾在前景层盖住boss脸(Hansen真机实拍)
      var base=side?'':'scaleX(-1) ';
      try{w.animate([
        {transform:base+'rotate('+(side?-62:62)+'deg) scale(.34)',opacity:0},
        {transform:base+'rotate('+(side?9:-9)+'deg) scale(1.07)',opacity:.97,offset:.56},
        {transform:base+'rotate('+(side?-3:3)+'deg) scale(.985)',opacity:.97,offset:.8},
        {transform:base+'rotate(0deg) scale(1)',opacity:.97}
      ],{duration:480/sp,easing:'cubic-bezier(.3,.75,.35,1.02)',fill:'forwards'});}catch(e){w.style.opacity='.97';}
      w._base=base;
    });
    var ne=Math.round(8*fxi), ei;
    for(ei=0;ei<ne;ei++){(function(){setTimeout(function(){
      var em=hbaDkEl('hba-dkember',30+Math.random()*(vw-60),Math.max(70,bsTop-26)+Math.random()*70);
      try{em.animate([{transform:'translate(0,0) scale(1)',opacity:.95},{transform:'translate('+((Math.random()-.5)*16)+'px,'+(30+Math.random()*46)+'px) scale(.4)',opacity:0}],{duration:(700+Math.random()*400)/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
      rm(em,1150/sp);
    },Math.random()*500/sp);})();}
    /* ② 统帅号令 */
    setTimeout(function(){
      var SW=Math.round(96*sz), SH=Math.round(SW*60/140);
      var holder=document.createElement('div');
      holder.style.cssText='position:fixed;pointer-events:none;z-index:9992;left:'+(bx)+'px;top:'+(by+4)+'px;width:0;height:0;will-change:transform';
      var s=document.createElement('div'); s.className='hba-dksoul';
      s.style.width=SW+'px'; s.style.height=SH+'px';
      s.style.position='absolute'; s.style.left=(56*sz)+'px'; s.style.top=(-SH/2)+'px';
      s.innerHTML=hbaDkSoulSVG('s'+(_dkuu++));
      holder.appendChild(s); (window.__hansenFxLayer||document.body).appendChild(holder);
      try{holder.animate([
        {transform:'rotate(0deg)',opacity:0},
        {transform:'rotate(40deg)',opacity:1,offset:.14},
        {transform:'rotate(360deg)',opacity:1,offset:.9},
        {transform:'rotate(395deg)',opacity:0}
      ],{duration:640/sp,easing:'cubic-bezier(.4,.2,.5,.9)',fill:'forwards'});}catch(e){}
      rm(holder,700/sp);
      [0,1].forEach(function(k){setTimeout(function(){
        var r=hbaDkEl('hba-dkroar',bx,by,Math.round(40*sz)); void r.offsetWidth; r.classList.add('go'); rm(r,580);
      },60+k*(140/sp));});
      setTimeout(function(){
        var CS=Math.round(16*sz);
        var ch=hbaDkEl('hba-dkcharge',bx-30*sz-CS/2,by-34*sz-CS/2,CS,CS);
        try{ch.animate([
          {transform:'scale(.2)',opacity:0},
          {transform:'scale(1.25)',opacity:1,offset:.55},
          {transform:'scale(.9)',opacity:1,offset:.8},
          {transform:'scale(1.4)',opacity:0}
        ],{duration:300/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(ch,340/sp);
      },360/sp);
    },320/sp);
    /* ③ 焚天枪雨 */
    setTimeout(function(){
      var n=Math.round(12*fxi);
      var comboXs=[0.18,0.34,0.5,0.66,0.82].map(function(t){return barL+barW*t;});
      var xs=[], i, j;
      for(i=0;i<n;i++){xs.push(26+(i+0.5)/n*(vw-52)+(Math.random()-.5)*16);}
      for(j=xs.length-1;j>0;j--){var k2=Math.floor(Math.random()*(j+1));var tmp=xs[j];xs[j]=xs[k2];xs[k2]=tmp;}
      var comboUsed=0;
      xs.forEach(function(x,k){setTimeout(function(){
        var comboNo=0;
        if(comboUsed<5){
          var cx2=comboXs[comboUsed];
          if(Math.abs(x-cx2)<40||k>=n-(5-comboUsed)){ x=cx2; comboUsed++; comboNo=comboUsed; }
        }
        hbaDkDropSpear(sp,sz,fxi,x,midY-2,0.9+Math.random()*0.25,comboNo,midY,null);
      },k*(65/sp));});
    },880/sp);
    /* ④ 终焉巨枪 + 收翼(deal) */
    var rainEnd=(880+Math.round(12*fxi)*65+230)/sp;
    setTimeout(function(){
      wings.forEach(function(w){
        try{w.el.animate([
          {transform:w._base+'rotate(0deg) translateY(0)',opacity:.97,filter:'brightness(1)'},
          {transform:w._base+'rotate('+(w.side?-14:14)+'deg) translateY(16px)',opacity:1,offset:.3,filter:'brightness(1.45)'},
          {transform:w._base+'rotate('+(w.side?-10:10)+'deg) translateY(20px)',opacity:0,filter:'brightness(1.2)'}
        ],{duration:560/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(w.el,600/sp);
      });
      setTimeout(function(){
        hbaDkDropSpear(sp,sz,fxi,hx,midY-2,1.95,0,midY,function(){
          var fl=hbaDkEl('hba-dkflash',hx,midY,Math.round(62*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,360);
          var rg=hbaDkEl('hba-dkring',hx,midY,46); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
          var bar=document.querySelector('.hero-hp-bar');
          if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},340); }
          var ns=Math.round(13*fxi), s3;
          for(s3=0;s3<ns;s3++){(function(){
            var sh=hbaDkEl('hba-dkshard',hx,midY); sh.style.background=(Math.random()<0.5)?'#fde68a':'#f97316'; sh.style.boxShadow='0 0 6px rgba(249,115,22,.9)';
            var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(30+Math.random()*52)*fxi, dx=Math.cos(a)*dd, dy2=Math.sin(a)*dd, gy=Math.abs(dy2)*0.55+26+Math.random()*22, rot=(Math.random()-.5)*540;
            try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate('+(rot*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
            rm(sh,860);
          })();}
          var s4;
          for(s4=0;s4<3;s4++){(function(k){
            var ss=Math.round((22+Math.random()*16)*sz);
            var sm=hbaDkEl('hba-dksmoke',hx+(k-1)*24,midY-6,ss,ss);
            try{sm.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:.55},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*22)+'px,-'+(18+Math.random()*20)+'px) scale(1.7)',opacity:0}],{duration:680+Math.random()*220,easing:'ease-out',fill:'forwards'});}catch(e){}
            rm(sm,940);
          })(s4);}
          var nf=Math.round(4*fxi), i3;
          for(i3=0;i3<nf;i3++){(function(){setTimeout(function(){
            var fw=Math.round((13+Math.random()*7)*sz), fh=Math.round(fw*36/24);
            var fl2=hbaDkEl('hba-dkflame',60+Math.random()*(vw-120),midY+6-fh,fw,fh); fl2.innerHTML=hbaDkFlameSVG('f'+(_dkuu++));
            try{fl2.animate([
              {transform:'scaleY(.3)',opacity:0},
              {transform:'scaleY(1.2)',opacity:1,offset:.4},
              {transform:'scaleY(.2)',opacity:0}
            ],{duration:(480+Math.random()*180)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
            rm(fl2,700/sp);
          },Math.random()*140/sp);})(i3);}
          var vg=hbaDkEl('hba-dkvign',0,0); vg.style.left='0'; vg.style.top='0';
          try{vg.animate([{opacity:0},{opacity:.55,offset:.32},{opacity:0}],{duration:440/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,500/sp);
          deal();
        });
      },300/sp);
    },rainEnd);
  }
  // 🔴 v521: 暗黑灯神·神灯魂狱——SVG许愿星/魂爪 + Hansen真神灯图(bosses/genielamp.webp 400x203)。BUG#67方案: IIFE初始化预加载+decode存window.__hbaGnLamp·使用cloneNode秒绘。暗黑靛硬编码。
  var _hbaGnLampSrc='bosses/genielamp.webp?v=908';
  var _hbaGnLW=400, _hbaGnLH=203;
  window.__hbaGnLamp=null;
  (function(){
    try{
      var im=new Image(); im.src=_hbaGnLampSrc;
      if(im.decode){ im.decode().then(function(){window.__hbaGnLamp=im;}).catch(function(){window.__hbaGnLamp=im;}); }
      else { im.onload=function(){window.__hbaGnLamp=im;}; }
    }catch(e){}
  })();
  function hbaGnEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaGnQB(p0,pc,p1,t){var u=1-t;return {x:u*u*p0.x+2*u*t*pc.x+t*t*p1.x, y:u*u*p0.y+2*u*t*pc.y+t*t*p1.y};}
  function hbaGnSmoke(x,y,sz,dx,dy,dur,dark){
    var sm=hbaGnEl('hba-gnsmoke'+(dark?' dk':''),x,y,sz,sz);
    try{sm.animate([
      {transform:'translate(-50%,-50%) scale(.3)',opacity:0},
      {transform:'translate(-50%,-50%) translate('+(dx*0.5)+'px,'+(dy*0.5)+'px) scale(1)',opacity:.9,offset:.4},
      {transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) scale(1.8)',opacity:0}
    ],{duration:dur,easing:'ease-out',fill:'forwards'});}catch(e){}
    rm(sm,dur+60);
  }
  function hbaGnWishSVG(u,c1,c2,cursed){
    var crack=cursed?'<path d="M20,8 L17,17 L23,21 L18,29" fill="none" stroke="#0c0518" stroke-width="1.6" stroke-linecap="round" opacity="0.9"/>':'';
    return '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">'
      +'<circle class="halo" cx="20" cy="20" r="17" fill="none" stroke="'+c1+'" stroke-width="1.6" stroke-dasharray="'+(cursed?'3 5':'6 6')+'" opacity="0.8"/>'
      +'<path d="M20,3 L23,14 L33,8 L26,17 L37,20 L26,23 L33,32 L23,26 L20,37 L17,26 L7,32 L14,23 L3,20 L14,17 L7,8 L17,14 Z" fill="'+c1+'" stroke="'+c2+'" stroke-width="1.4" stroke-linejoin="round"/>'
      +crack
      +'<circle cx="20" cy="20" r="3.6" fill="#fff" opacity="0.95"/>'
      +'</svg>';
  }
  function hbaGnHandOpenSVG(u){
    return '<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">'
      +'<defs>'
      +'<linearGradient id="hbagnb'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a5b4fc"/><stop offset="0.45" stop-color="#4f46e5"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>'
      +'<radialGradient id="hbagnp'+u+'" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#34d399" stop-opacity="0.5"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient>'
      +'</defs>'
      +'<path d="M30,104 Q22,92 24,78 Q14,70 9,52 L13,30 L19,31 L21,48 Q22,38 22,18 L28,14 L33,18 L34,44 Q36,30 38,8 L44,4 L49,9 L49,44 Q52,28 56,12 L62,10 L66,16 L62,48 Q67,38 73,30 L79,32 L80,42 Q74,58 71,72 Q72,88 60,100 Q45,110 30,104 Z" fill="#0c0a24" opacity="0.8" transform="translate(3,4)"/>'
      +'<path d="M30,104 Q22,92 24,78 Q14,70 9,52 L13,30 Q15,27 17,30 L21,48 Q22,38 22,18 Q24,13 28,14 Q32,15 33,18 L34,44 Q36,30 38,8 Q40,3 44,4 Q48,5 49,9 L49,44 Q52,28 56,12 Q58,8 62,10 Q66,12 66,16 L62,48 Q67,38 73,30 Q76,27 79,32 Q81,36 80,42 Q74,58 71,72 Q72,88 60,100 Q45,110 30,104 Z" fill="url(#hbagnb'+u+')" stroke="#c7d2fe" stroke-width="1.7" stroke-linejoin="round" opacity="0.95"/>'
      +'<path d="M17,40 Q19,38 21,40 M24,30 Q27,28 30,30 M40,22 Q43,20 46,22 M54,24 Q57,22 60,24 M68,40 Q71,38 73,41 M22,58 Q26,55 30,57 M36,54 Q40,51 44,53 M50,54 Q54,51 58,53" fill="none" stroke="#e0e7ff" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>'
      +'<path d="M13,30 Q9,22 9,15 Q14,21 17,29 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.95))"/>'
      +'<path d="M22,18 Q20,9 22,2 Q26,9 28,16 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.95))"/>'
      +'<path d="M38,8 Q38,0 41,-5 Q44,2 44,7 Z" fill="#6ee7b7" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(52,211,153,1))"/>'
      +'<path d="M56,12 Q57,4 61,-1 Q63,6 62,12 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.95))"/>'
      +'<path d="M73,30 Q78,23 84,20 Q81,28 77,33 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.95))"/>'
      +'<circle cx="46" cy="74" r="13" fill="url(#hbagnp'+u+')"/>'
      +'<circle class="sigil" cx="46" cy="74" r="8.5" fill="none" stroke="#34d399" stroke-width="1.8" stroke-dasharray="4 3" style="filter:drop-shadow(0 0 5px rgba(52,211,153,.95))"/>'
      +'<path class="sigil" d="M46,68 L46,80 M40,74 L52,74" stroke="#a7f3d0" stroke-width="1.6" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.9))"/>'
      +'<path class="wsp" d="M32,103 Q24,108 18,105 Q24,112 32,109 M52,105 Q58,112 66,109 Q58,114 50,111" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>'
      +'</svg>';
  }
  function hbaGnHandFistSVG(u){
    return '<svg viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">'
      +'<defs>'
      +'<linearGradient id="hbagnf'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d2fe"/><stop offset="0.45" stop-color="#4f46e5"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>'
      +'<radialGradient id="hbagnq'+u+'" cx="0.5" cy="0.5" r="0.6"><stop offset="0" stop-color="#34d399" stop-opacity="0.6"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></radialGradient>'
      +'</defs>'
      +'<path d="M22,90 Q12,78 15,60 Q13,46 21,37 Q23,29 30,31 Q32,22 40,24 Q43,16 52,19 Q57,13 64,18 Q71,17 74,26 Q82,30 83,42 Q86,54 79,63 Q81,79 68,88 Q47,99 22,90 Z" fill="#0c0a24" opacity="0.8" transform="translate(3,4)"/>'
      +'<path d="M22,90 Q12,78 15,60 Q13,46 21,37 Q23,29 30,31 Q32,22 40,24 Q43,16 52,19 Q57,13 64,18 Q71,17 74,26 Q82,30 83,42 Q86,54 79,63 Q81,79 68,88 Q47,99 22,90 Z" fill="url(#hbagnf'+u+')" stroke="#e0e7ff" stroke-width="2" stroke-linejoin="round" opacity="0.96"/>'
      +'<path d="M24,36 Q27,31 31,33 M34,28 Q38,23 43,26 M46,22 Q51,17 56,21 M59,20 Q64,16 69,21" fill="none" stroke="#eef2ff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>'
      +'<path d="M30,52 Q44,60 62,52 M28,66 Q45,74 66,64" fill="none" stroke="#312e81" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>'
      +'<path d="M31,45 Q27,60 32,73 Q38,62 35,47 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(52,211,153,.95))"/>'
      +'<path d="M43,42 Q40,58 45,73 Q51,61 48,44 Z" fill="#6ee7b7" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 6px rgba(52,211,153,1))"/>'
      +'<path d="M55,42 Q54,58 59,72 Q63,60 60,44 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(52,211,153,.95))"/>'
      +'<path d="M66,46 Q66,58 71,69 Q74,59 71,47 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px rgba(52,211,153,.95))"/>'
      +'<path d="M24,70 Q34,78 50,77 Q60,76 64,72 Q60,84 46,86 Q31,87 24,78 Z" fill="url(#hbagnf'+u+')" stroke="#c7d2fe" stroke-width="1.8" stroke-linejoin="round" opacity="0.95"/>'
      +'<path d="M60,73 Q66,70 69,65 Q70,72 66,76 Z" fill="#34d399" stroke="#065f46" stroke-width="1.1" style="filter:drop-shadow(0 0 4px rgba(52,211,153,.95))"/>'
      +'<circle cx="49" cy="50" r="11" fill="url(#hbagnq'+u+')"/>'
      +'<circle class="sigil" cx="49" cy="50" r="6.5" fill="none" stroke="#6ee7b7" stroke-width="2" stroke-dasharray="3 2.5" style="filter:drop-shadow(0 0 6px rgba(52,211,153,1))"/>'
      +'<path class="wsp" d="M30,92 Q22,98 15,95 Q22,102 31,99 M56,94 Q63,101 71,98 Q63,104 54,101" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" opacity="0.7"/>'
      +'</svg>';
  }
  var _gnuu=0;
  // 主编排: ①神灯降世+烟雾笼罩 ②三个愿望成诅咒 ③灵魂之爪攥魂 ④万烟归灯审判光柱(deal)
  function hbaGenieCurse(bx,bsBot,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 神灯降世 */
    var dm=hbaGnEl('hba-gndome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:1,offset:.32},{opacity:0}],{duration:4200/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,4260/sp);
    var LW=Math.round(150*sz), LH=Math.round(LW*_hbaGnLH/_hbaGnLW);
    var lx=bx, ly=bsBot+LH*0.42;
    var f0=hbaGnEl('hba-gnflash',lx,ly,Math.round(52*sz)); f0.style.background='radial-gradient(circle,#fff,#fde68a 45%,transparent 72%)'; void f0.offsetWidth; f0.classList.add('go'); rm(f0,380);
    [0,1].forEach(function(k){setTimeout(function(){
      var rg=hbaGnEl('hba-gnring gold',lx,ly,26+k*14); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
    },k*90);});
    var rayH=Math.round(Math.max(40,Math.min(120*sz, midY-ly-8)));
    [-18,0,18].forEach(function(ang,k){
      var rw=Math.round(40*sz);
      var ry=hbaGnEl('hba-gnray',lx-rw/2,ly-6,rw,rayH);
      ry.style.transform='rotate('+ang+'deg)';
      try{ry.animate([
        {opacity:0,transform:'rotate('+ang+'deg) scaleY(.3)'},
        {opacity:.9,transform:'rotate('+ang+'deg) scaleY(1)',offset:.35},
        {opacity:0,transform:'rotate('+ang+'deg) scaleY(1.05)'}
      ],{duration:(820+k*60)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(ry,900/sp);
    });
    var lp=document.createElement('div'); lp.className='hba-gnlamp';
    lp.style.width=LW+'px'; lp.style.height=LH+'px';
    lp.style.left=(lx-LW/2)+'px'; lp.style.top=(ly-LH/2)+'px';
    var bob=document.createElement('div'); bob.className='lbob';
    var pre=window.__hbaGnLamp, im2;
    if(pre && pre.naturalWidth>0){ im2=pre.cloneNode(false); }
    else { im2=document.createElement('img'); im2.src=_hbaGnLampSrc; }
    im2.alt=''; im2.draggable=false; im2.style.width='100%'; im2.style.height='100%';
    bob.appendChild(im2); lp.appendChild(bob); (window.__hansenFxLayer||document.body).appendChild(lp);
    try{lp.animate([
      {transform:'translateY(-44px) scale(1.3)',opacity:0},
      {transform:'translateY(4px) scale(.94)',opacity:1,offset:.55},
      {transform:'translateY(-2px) scale(1.03)',opacity:1,offset:.8},
      {transform:'translateY(0) scale(1)',opacity:1}
    ],{duration:380/sp,easing:'cubic-bezier(.3,.7,.4,1.05)',fill:'forwards'});}catch(e){lp.style.opacity='1';}
    var lamp={el:lp,x:lx,y:ly,spout:{x:lx-LW*0.38,y:ly-LH*0.34},LW:LW,LH:LH};
    var smT=setInterval(function(){
      var ss=Math.round((26+Math.random()*26)*sz*fxi);
      hbaGnSmoke(lamp.spout.x,lamp.spout.y,ss,-(12+Math.random()*52),-(26+Math.random()*58),950+Math.random()*450);
    },70/sp);
    setTimeout(function(){clearInterval(smT);},2850/sp);
    var fi;
    for(fi=0;fi<5;fi++){(function(k){setTimeout(function(){
      var ss=Math.round((44+Math.random()*30)*sz*fxi);
      hbaGnSmoke(40+Math.random()*(vw-80),ly+10+Math.random()*26,ss,(Math.random()-.5)*60,-(8+Math.random()*18),1400+Math.random()*600,true);
    },120+k*160/sp);})(fi);}
    var ei;
    for(ei=0;ei<3;ei++){(function(k){setTimeout(function(){
      var ex=70+Math.random()*(vw-140), ey=ly-8+Math.random()*30;
      var eyes=hbaGnEl('hba-gneyes',ex,ey,22,8);
      var i1=document.createElement('i'); i1.style.left='0'; i1.style.top='1px';
      var i2=document.createElement('i'); i2.style.right='0'; i2.style.top='0';
      eyes.appendChild(i1); eyes.appendChild(i2);
      try{eyes.animate([
        {opacity:0,transform:'scale(.7)'},
        {opacity:1,transform:'scale(1)',offset:.25},
        {opacity:1,transform:'scale(1)',offset:.7},
        {opacity:0,transform:'scale(.8)'}
      ],{duration:900/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(eyes,960/sp);
    },500+k*420/sp);})(ei);}
    /* ② 三个愿望成诅咒 */
    setTimeout(function(){
      var tgt=[0.26,0.5,0.74], hit=0;
      tgt.forEach(function(tx,k){setTimeout(function(){
        var WS=Math.round(40*sz);
        var wx=lamp.x+(k-1)*52*sz, wy=lamp.y-lamp.LH*0.5-34*sz;
        var w=document.createElement('div'); w.className='hba-gnwish';
        w.style.width=WS+'px'; w.style.height=WS+'px';
        w.style.left=(wx-WS/2)+'px'; w.style.top=(wy-WS/2)+'px';
        w.innerHTML=hbaGnWishSVG('g'+(_gnuu++),'#fbbf24','#92600a',false);
        (window.__hansenFxLayer||document.body).appendChild(w);
        try{w.animate([
          {transform:'translateY(16px) scale(.2) rotate(-120deg)',opacity:0},
          {transform:'translateY(0) scale(1.2) rotate(8deg)',opacity:1,offset:.6},
          {transform:'translateY(0) scale(1) rotate(0deg)',opacity:1}
        ],{duration:220/sp,easing:'ease-out',fill:'forwards'});}catch(e){w.style.opacity='1';}
        setTimeout(function(){
          var cf=hbaGnEl('hba-gnhit',wx,wy,Math.round(30*sz)); cf.style.background='radial-gradient(circle,#fff,#e9d5ff 55%,transparent 78%)'; void cf.offsetWidth; cf.classList.add('go'); rm(cf,320);
          w.innerHTML=hbaGnWishSVG('c'+(_gnuu++),'#a855f7','#3b0764',true);
          w.classList.add('cursed');
          try{w.animate([
            {transform:'scale(1) rotate(0deg)'},
            {transform:'scale(1.25) rotate(-9deg)',offset:.3},
            {transform:'scale(.92) rotate(6deg)',offset:.6},
            {transform:'scale(1.06) rotate(0deg)'}
          ],{duration:190/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
        },300/sp);
        setTimeout(function(){
          var p0={x:wx,y:wy}, p1={x:barL+barW*tx,y:midY-2};
          var pc={x:(p0.x+p1.x)/2+(k===0?-34:(k===2?34:0)),y:(p0.y+p1.y)/2-22};
          var dur=200/sp, t0=null, rot=0, rotV=(k%2?1:-1)*16, fr=0;
          function step(now){
            if(t0===null)t0=now;
            var t=(now-t0)/dur; if(t>1)t=1;
            var pos=hbaGnQB(p0,pc,p1,t);
            rot+=rotV;
            w.style.left=(pos.x-WS/2)+'px'; w.style.top=(pos.y-WS/2)+'px';
            w.style.transform='rotate('+rot+'deg) scale('+(1+0.2*t)+')';
            if((fr++%2)===0&&t>0.05&&t<0.95){var ts=5+Math.random()*5;var tr=hbaGnEl('hba-gnwishtr',pos.x,pos.y,ts,ts);tr.style.transform='translate(-50%,-50%)';
              try{tr.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,300);}
            if(t<1){requestAnimationFrame(step);}
            else{
              if(w.parentNode)w.remove();
              var bu=hbaGnEl('hba-gnhit',p1.x,p1.y,Math.round(40*fxi)); void bu.offsetWidth; bu.classList.add('go'); rm(bu,320);
              var rg=hbaGnEl('hba-gnring',p1.x,p1.y,22); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
              var rg2=hbaGnEl('hba-gnring gold',p1.x,p1.y,22); rg2.style.borderWidth='2px'; setTimeout(function(){void rg2.offsetWidth;rg2.classList.add('go');},90); rm(rg2,620);
              var nst=Math.round(5*fxi), si2;
              for(si2=0;si2<nst;si2++){(function(){
                var st=hbaGnEl('hba-gnstar',p1.x,p1.y); st.style.background='radial-gradient(circle,#fff,#a855f7 55%,#4338ca)'; st.style.boxShadow='0 0 6px rgba(168,85,247,.9)';
                var a=-Math.PI/2+(Math.random()-.5)*2.4, dd=(16+Math.random()*26)*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.5+17+Math.random()*13;
                try{st.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) scale(.4)',opacity:0}],{duration:420+Math.random()*150,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
                rm(st,620);
              })();}
              var bar=document.querySelector('.hero-hp-bar');
              if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
              hit++;
              var cb=document.createElement('div'); cb.className='hba-gncombo'; cb.textContent=hit+' 连!';
              cb.style.left=(p1.x-14)+'px'; cb.style.top=(midY-34)+'px';
              (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
            }
          }
          requestAnimationFrame(step);
        },400/sp);
      },k*(280/sp));});
    },640/sp);
    /* ③ 灵魂之爪 */
    setTimeout(function(){
      var si;
      for(si=0;si<6;si++){(function(){
        var ss=Math.round((30+Math.random()*26)*sz*fxi);
        hbaGnSmoke(hx+(Math.random()-.5)*150,midY+26+Math.random()*24,ss,(Math.random()-.5)*36,-(14+Math.random()*26),900+Math.random()*350,true);
      })();}
      var HW=Math.round(126*sz), HH=Math.round(HW*110/100);
      var hdx=hx, hdy=midY-HH*0.52;
      var hd=document.createElement('div'); hd.className='hba-gnhand';
      hd.style.width=HW+'px'; hd.style.height=HH+'px';
      hd.style.left=(hdx-HW/2)+'px'; hd.style.top=(hdy-HH/2)+'px';
      hd.innerHTML=hbaGnHandOpenSVG('o'+(_gnuu++));
      (window.__hansenFxLayer||document.body).appendChild(hd);
      try{hd.animate([
        {transform:'translateY(64px) scale(.5)',opacity:0},
        {transform:'translateY(-4px) scale(1.05)',opacity:.96,offset:.66},
        {transform:'translateY(0) scale(1)',opacity:.96}
      ],{duration:340/sp,easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'});}catch(e){hd.style.opacity='.96';}
      setTimeout(function(){
        hd.innerHTML=hbaGnHandFistSVG('f'+(_gnuu++));
        try{hd.animate([
          {transform:'scale(1.08)'},
          {transform:'scale(.8) translateY(10px)',offset:.5},
          {transform:'scale(.88) translateY(7px)'}
        ],{duration:160/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
        var f=hbaGnEl('hba-gnhit',hx,midY-8,Math.round(46*fxi)); f.style.background='radial-gradient(circle,#fff,#818cf8 50%,transparent 75%)'; void f.offsetWidth; f.classList.add('go'); rm(f,320);
        var vg0=hbaGnEl('hba-gnvign',0,0); vg0.style.left='0'; vg0.style.top='0';
        try{vg0.animate([{opacity:0},{opacity:.4,offset:.32},{opacity:0}],{duration:300/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg0,360/sp);
        var bar0=document.querySelector('.hero-hp-bar');
        if(bar0){ bar0.classList.add('hsn-bite-glow'); setTimeout(function(){bar0.classList.remove('hsn-bite-glow');},220); }
        var arrived=0;
        [0,1].forEach(function(n){setTimeout(function(){
          var OS=Math.round(14*sz);
          var so=hbaGnEl('hba-gnsoul',hx-OS/2+(n?16:-16),midY-6-OS/2,OS,OS);
          var p0={x:hx+(n?16:-16),y:midY-6}, p1={x:lamp.spout.x,y:lamp.spout.y};
          var pc={x:(p0.x+p1.x)/2+(n?44:14),y:(p0.y+p1.y)/2-(n?58:34)};
          var dur=330/sp, t0=null, fr=0;
          function step(now){
            if(t0===null)t0=now;
            var t=(now-t0)/dur; if(t>1)t=1;
            var pos=hbaGnQB(p0,pc,p1,t);
            so.style.left=(pos.x-OS/2)+'px'; so.style.top=(pos.y-OS/2)+'px';
            so.style.transform='scale('+(1-0.35*t)+')';
            if((fr++%2)===0&&t>0.04&&t<0.96){var ts=4+Math.random()*4;var tr=hbaGnEl('hba-gnsoultr',pos.x,pos.y,ts,ts);tr.style.transform='translate(-50%,-50%)';
              try{tr.animate([{opacity:.8,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,300);}
            if(t<1){requestAnimationFrame(step);}
            else{
              if(so.parentNode)so.remove();
              var sf=hbaGnEl('hba-gnhit',p1.x,p1.y,Math.round(20*sz)); sf.style.background='radial-gradient(circle,#fff,#34d399 52%,transparent 78%)'; void sf.offsetWidth; sf.classList.add('go'); rm(sf,320);
              try{lamp.el.animate([{filter:'drop-shadow(0 0 14px rgba(52,211,153,.5)) drop-shadow(0 0 24px rgba(251,191,36,.35)) brightness(1)'},{filter:'drop-shadow(0 0 '+(20+arrived*8)+'px rgba(52,211,153,.85)) drop-shadow(0 0 30px rgba(251,191,36,.5)) brightness('+(1.12+arrived*0.1)+')'}],{duration:200,fill:'forwards'});}catch(e){}
              arrived++;
              if(arrived===2){
                /* ④ 万烟归灯+审判 */
                hbaGnJudgment(lamp,hx,barL,barW,midY,sp,sz,fxi,vw,deal);
              }
            }
          }
          requestAnimationFrame(step);
        },n*(110/sp));});
        try{hd.animate([{opacity:.96},{opacity:0}],{duration:300/sp,fill:'forwards'});}catch(e){}
        rm(hd,340/sp);
      },(340+160)/sp);
    },1950/sp);
  }
  // ④ 万烟归灯→暴震蓄能→审判光柱(deal)
  function hbaGnJudgment(lamp,hx,barL,barW,midY,sp,sz,fxi,vw,deal){
    var ni=Math.round(9*fxi), i;
    for(i=0;i<ni;i++){(function(k){setTimeout(function(){
      var sx=40+Math.random()*(vw-80), sy=lamp.y-50+Math.random()*120;
      var ss=Math.round((20+Math.random()*20)*sz);
      var sm=hbaGnEl('hba-gnsmoke dk',sx,sy,ss,ss);
      try{sm.animate([
        {transform:'translate(-50%,-50%) scale(1)',opacity:.85},
        {transform:'translate(-50%,-50%) translate('+(lamp.spout.x-sx)+'px,'+(lamp.spout.y-sy)+'px) scale(.15)',opacity:.9}
      ],{duration:(320+Math.random()*160)/sp,easing:'cubic-bezier(.5,.05,.8,.4)',fill:'forwards'});}catch(e){}
      rm(sm,520/sp);
    },k*(38/sp));})(i);}
    setTimeout(function(){
      var CS=Math.round(18*sz);
      var ch=hbaGnEl('hba-gncharge',lamp.spout.x-CS/2,lamp.spout.y-CS/2,CS,CS);
      try{ch.animate([
        {transform:'scale(.2)',opacity:0},
        {transform:'scale(1.3)',opacity:1,offset:.6},
        {transform:'scale(1)',opacity:1,offset:.85},
        {transform:'scale(1.6)',opacity:0}
      ],{duration:380/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(ch,420/sp);
      try{lamp.el.animate([
        {transform:'rotate(0deg) scale(1)',filter:'brightness(1.3) drop-shadow(0 0 26px rgba(52,211,153,.85))'},
        {transform:'rotate(-4deg) scale(1.08)',filter:'brightness(1.5) drop-shadow(0 0 34px rgba(251,191,36,.95))',offset:.25},
        {transform:'rotate(4deg) scale(1.12)',filter:'brightness(1.7) drop-shadow(0 0 40px rgba(52,211,153,1))',offset:.5},
        {transform:'rotate(-3deg) scale(1.1)',filter:'brightness(1.55) drop-shadow(0 0 36px rgba(168,85,247,.9))',offset:.75},
        {transform:'rotate(0deg) scale(1.06)',filter:'brightness(1.4) drop-shadow(0 0 30px rgba(251,191,36,.85))'}
      ],{duration:340/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
    },180/sp);
    setTimeout(function(){
      var BW=Math.round(52*sz);
      var sxp=lamp.spout.x, syp=lamp.spout.y;
      var L=Math.round(Math.hypot(hx-sxp,midY-syp))+6;
      var rot=Math.atan2(-(hx-sxp),(midY-syp))*180/Math.PI;
      var bm=hbaGnEl('hba-gnbeam',sxp-BW/2,syp,BW,L);
      var bo=document.createElement('div'); bo.className='bo';
      var bi=document.createElement('div'); bi.className='bi';
      bm.appendChild(bo); bm.appendChild(bi);
      try{bm.animate([
        {transform:'rotate('+rot+'deg) scaleY(0)',opacity:.7},
        {transform:'rotate('+rot+'deg) scaleY(1)',opacity:1,offset:.26},
        {transform:'rotate('+rot+'deg) scaleY(1)',opacity:1,offset:.82},
        {transform:'rotate('+rot+'deg) scaleY(1)',opacity:0}
      ],{duration:540/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(bm,580/sp);
      setTimeout(function(){
        var fl=hbaGnEl('hba-gnflash',hx,midY,Math.round(70*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,380);
        var rg=hbaGnEl('hba-gnring',hx,midY,48); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
        var rg2=hbaGnEl('hba-gnring gold',hx,midY,48); setTimeout(function(){void rg2.offsetWidth;rg2.classList.add('go');},110); rm(rg2,650);
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},340); }
        var ns=Math.round(16*fxi), i2;
        for(i2=0;i2<ns;i2++){(function(){
          var r=Math.random();
          var col=r<0.4?['#fde68a','rgba(251,191,36,.9)']:(r<0.75?['#a855f7','rgba(168,85,247,.9)']:['#34d399','rgba(52,211,153,.9)']);
          var sh=hbaGnEl('hba-gnshard',hx,midY); sh.style.background=col[0]; sh.style.boxShadow='0 0 6px '+col[1];
          var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(32+Math.random()*54)*fxi, dx=Math.cos(a)*dd, dy2=Math.sin(a)*dd, gy=Math.abs(dy2)*0.55+26+Math.random()*22, rot2=(Math.random()-.5)*540;
          try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate('+(rot2*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+rot2+'deg)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(sh,860);
        })();}
        var sj;
        for(sj=0;sj<4;sj++){(function(k){
          var OS=Math.round(10*sz);
          var so=hbaGnEl('hba-gnsoul',hx-OS/2,midY-OS/2,OS,OS);
          var ang=-Math.PI/2+(k-1.5)*0.7, dd=44+Math.random()*30;
          try{so.animate([
            {transform:'translate(0,0) scale(.6)',opacity:0},
            {transform:'translate('+(Math.cos(ang)*dd*0.5)+'px,'+(Math.sin(ang)*dd*0.5)+'px) scale(1)',opacity:.95,offset:.4},
            {transform:'translate('+(Math.cos(ang)*dd)+'px,'+(Math.sin(ang)*dd-12)+'px) scale(.4)',opacity:0}
          ],{duration:620+Math.random()*200,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(so,880);
        })(sj);}
        var s2;
        for(s2=0;s2<3;s2++){(function(k){
          var ss=Math.round((24+Math.random()*16)*sz);
          hbaGnSmoke(hx+(k-1)*26,midY-6,ss,(Math.random()-.5)*24,-(18+Math.random()*22),760+Math.random()*220,true);
        })(s2);}
        var vg=hbaGnEl('hba-gnvign',0,0); vg.style.left='0'; vg.style.top='0';
        try{vg.animate([{opacity:0},{opacity:.6,offset:.32},{opacity:0}],{duration:460/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,520/sp);
        deal();
        setTimeout(function(){
          try{lamp.el.animate([
            {transform:'translateY(0) scale(1.06)',opacity:1,filter:'brightness(1.4)'},
            {transform:'translateY(26px) scale(.78)',opacity:0,filter:'brightness(.9)'}
          ],{duration:380/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
          hbaGnSmoke(lamp.x,lamp.y+10,Math.round(30*sz),0,-14,600,true);
          rm(lamp.el,420/sp);
        },260/sp);
      },(540*0.34)/sp);
    },560/sp);
  }
  // 🔴 v522: 海底巨怪·深渊狂潮——全SVG+CSS内联无外部图。战区水带空间适配: 水只占血条上方活水面+血条区浸水色调, 绝不遮答题区。深渊青硬编码。
  function hbaSkEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaSkSurfSVG(u,col){
    var w='M0,10 Q21,2 42,10 T84,10 T126,10 T168,10 T210,10 T252,10 T294,10 T336,10 T378,10 T420,10 T462,10 T504,10 T546,10 T588,10 T630,10 T672,10 V18 H0 Z';
    return '<svg viewBox="0 0 672 18" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="'+w+'" fill="'+col+'"/></svg>';
  }
  function hbaSkTentSVG(u){
    return '<svg viewBox="0 0 70 210" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbask'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e293b"/><stop offset="0.5" stop-color="#475569"/><stop offset="1" stop-color="#27303f"/></linearGradient></defs>'
      +'<path d="M14,210 Q8,160 18,124 Q30,84 24,52 Q20,28 36,8 Q40,2 45,7 Q52,16 48,36 Q42,66 50,98 Q58,138 50,172 Q46,196 44,210 Z" fill="#0b1220" opacity="0.7" transform="translate(3,3)"/>'
      +'<path d="M14,210 Q8,160 18,124 Q30,84 24,52 Q20,28 36,8 Q40,2 45,7 Q52,16 48,36 Q42,66 50,98 Q58,138 50,172 Q46,196 44,210 Z" fill="url(#hbask'+u+')" stroke="#0f172a" stroke-width="2.2" stroke-linejoin="round"/>'
      +'<path d="M36,8 Q40,2 45,7 Q52,16 48,36 Q42,66 50,98 Q58,138 50,172" fill="none" stroke="#22d3ee" stroke-width="1.7" stroke-linecap="round" opacity="0.75"/>'
      +'<g class="tsuck">'
      +'<circle cx="33" cy="30" r="4.4" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="33" cy="30" r="2" fill="#67e8f9"/>'
      +'<circle cx="30" cy="56" r="5" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="30" cy="56" r="2.3" fill="#67e8f9"/>'
      +'<circle cx="34" cy="84" r="5.6" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="34" cy="84" r="2.6" fill="#67e8f9"/>'
      +'<circle cx="38" cy="114" r="6" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="38" cy="114" r="2.8" fill="#67e8f9"/>'
      +'<circle cx="36" cy="146" r="6.4" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="36" cy="146" r="3" fill="#67e8f9"/>'
      +'<circle cx="32" cy="178" r="6.8" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="32" cy="178" r="3.2" fill="#67e8f9"/>'
      +'</g>'
      +'<path d="M20,70 L11,64 L19,78 Z M16,118 L7,114 L15,126 Z M19,162 L10,160 L18,170 Z" fill="#334155" stroke="#0f172a" stroke-width="1.3" stroke-linejoin="round"/>'
      +'<circle cx="41" cy="14" r="1.6" fill="#cffafe" opacity="0.9"/>'
      +'</svg>';
  }
  function hbaSkWrapSVG(u,flip){
    var inner=''
      +'<path d="M220,8 Q150,2 90,8 Q44,12 18,20 Q4,25 10,33 Q20,40 44,36 Q100,32 160,36 Q196,38 220,36 Z" fill="#0b1220" opacity="0.7" transform="translate(2,3)"/>'
      +'<path d="M220,8 Q150,2 90,8 Q44,12 18,20 Q4,25 10,33 Q20,40 44,36 Q100,32 160,36 Q196,38 220,36 Z" fill="url(#hbaskw'+u+')" stroke="#0f172a" stroke-width="2" stroke-linejoin="round"/>'
      +'<path d="M220,8 Q150,2 90,8 Q44,12 18,20" fill="none" stroke="#22d3ee" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>'
      +'<g class="tsuck">'
      +'<circle cx="190" cy="22" r="6" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="190" cy="22" r="2.8" fill="#67e8f9"/>'
      +'<circle cx="156" cy="21" r="5.6" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="156" cy="21" r="2.6" fill="#67e8f9"/>'
      +'<circle cx="122" cy="20" r="5.2" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="122" cy="20" r="2.4" fill="#67e8f9"/>'
      +'<circle cx="90" cy="20" r="4.6" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="90" cy="20" r="2.1" fill="#67e8f9"/>'
      +'<circle cx="60" cy="22" r="4" fill="#0e7490" stroke="#155e75" stroke-width="1.2"/><circle cx="60" cy="22" r="1.8" fill="#67e8f9"/>'
      +'</g>';
    var body=flip?('<g transform="translate(220,0) scale(-1,1)">'+inner+'</g>'):inner;
    return '<svg viewBox="0 0 220 44" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbaskw'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="0.55" stop-color="#27303f"/><stop offset="1" stop-color="#1e293b"/></linearGradient></defs>'
      +body
      +'</svg>';
  }
  function hbaSkVortSVG(u){
    return '<svg viewBox="0 0 120 60" xmlns="http://www.w3.org/2000/svg">'
      +'<g class="vr1"><ellipse cx="60" cy="30" rx="52" ry="22" fill="none" stroke="#67e8f9" stroke-width="2.4" stroke-dasharray="34 22" opacity="0.85"/></g>'
      +'<g class="vr2"><ellipse cx="60" cy="30" rx="34" ry="14" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="20 14" opacity="0.9"/></g>'
      +'<ellipse cx="60" cy="30" rx="14" ry="6" fill="rgba(8,51,68,.75)" stroke="#0e7490" stroke-width="1.4"/>'
      +'</svg>';
  }
  function hbaSkWaveSVG(u){
    return '<svg viewBox="0 0 320 130" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbaskv'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e7490"/><stop offset="0.55" stop-color="#155e75"/><stop offset="1" stop-color="#083344"/></linearGradient></defs>'
      +'<path d="M0,130 Q30,96 60,78 Q120,44 200,30 Q258,20 288,38 Q310,52 296,66 Q282,76 262,68 Q276,58 266,48 Q240,32 190,46 Q120,64 70,94 Q34,114 0,130 Z" fill="url(#hbaskv'+u+')" stroke="#083344" stroke-width="2.4" stroke-linejoin="round"/>'
      +'<path d="M196,32 Q254,20 288,38 Q308,50 296,64 Q286,72 268,66 Q282,56 270,46 Q246,30 196,42 Z" fill="#e0f2fe" opacity="0.92"/>'
      +'<path d="M0,130 Q30,96 60,78 Q120,44 200,30" fill="none" stroke="#a5f3fc" stroke-width="3" stroke-linecap="round" opacity="0.8"/>'
      +'<circle class="fdot" cx="252" cy="34" r="4" fill="#fff" opacity="0.95"/><circle class="fdot" cx="282" cy="46" r="3.4" fill="#e0f2fe"/><circle class="fdot" cx="226" cy="38" r="3" fill="#fff" opacity="0.85"/><circle class="fdot" cx="292" cy="60" r="2.6" fill="#e0f2fe"/>'
      +'</svg>';
  }
  var _skuu=0;
  // 主编排: ①海水倒灌(战区水带) ②八爪缠绕(甩鞭+夹击) ③深渊漩涡 ④灭世狂潮(deal)+退潮
  function hbaAbyssTide(hx,barL,barW,midY,barTop,barBot,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 海水倒灌 */
    var dm=hbaSkEl('hba-skdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:1,offset:.32},{opacity:0}],{duration:4600/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,4660/sp);
    var WL=midY-64;
    var bodyBot=barTop-6, H=bodyBot-WL;
    var ovTop=barTop-8, ovBot=barBot+26, ovH=ovBot-ovTop;
    var wb=document.createElement('div'); wb.className='hba-skbody';
    wb.style.top=bodyBot+'px'; wb.style.height='0px';
    (window.__hansenFxLayer||document.body).appendChild(wb);
    var s2d=document.createElement('div'); s2d.className='hba-sksurf s2'; s2d.innerHTML=hbaSkSurfSVG('b'+(_skuu++),'rgba(34,211,238,.6)');
    var s1d=document.createElement('div'); s1d.className='hba-sksurf s1'; s1d.innerHTML=hbaSkSurfSVG('a'+(_skuu++),'rgba(103,232,249,.85)');
    var hl=document.createElement('div'); hl.className='hba-skhl';
    wb.appendChild(s2d); wb.appendChild(s1d); wb.appendChild(hl);
    try{wb.animate([{top:bodyBot+'px',height:'0px'},{top:WL+'px',height:H+'px'}],{duration:620/sp,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});}catch(e){wb.style.top=WL+'px';wb.style.height=H+'px';}
    var ov=document.createElement('div'); ov.className='hba-skover';
    ov.style.top=ovTop+'px'; ov.style.height=ovH+'px';
    (window.__hansenFxLayer||document.body).appendChild(ov);
    try{ov.animate([{opacity:0},{opacity:1}],{duration:620/sp,easing:'ease-out',fill:'forwards'});}catch(e){ov.style.opacity='1';}
    var cau=[];
    [0,1].forEach(function(k){
      var cu=hbaSkEl('hba-skcau',50+k*(vw*0.45),WL+14+k*8,90+k*30,30);
      cu.style.animationDelay=(k*0.9)+'s'; cau.push(cu);
    });
    var cu3=hbaSkEl('hba-skcau',vw*0.3,barTop+4,110,28); cu3.style.animationDelay='.5s'; cau.push(cu3);
    function bubble(x,y){
      var ssz=5+Math.random()*7;
      var b2=hbaSkEl('hba-skbub',x,y,ssz,ssz);
      var wob=(Math.random()-.5)*22, rise=Math.min(40+Math.random()*60, Math.max(14,y-WL-4));
      try{b2.animate([
        {transform:'translate(-50%,-50%) scale(.4)',opacity:0},
        {transform:'translate(-50%,-50%) translate('+(wob*0.5)+'px,-'+(rise*0.5)+'px) scale(1)',opacity:.9,offset:.5},
        {transform:'translate(-50%,-50%) translate('+wob+'px,-'+rise+'px) scale(.7)',opacity:0}
      ],{duration:(900+Math.random()*600)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(b2,1600/sp);
    }
    var bt=setInterval(function(){bubble(24+Math.random()*(vw-48),WL+14+Math.random()*(ovBot-WL-26));},150/sp);
    var ei;
    for(ei=0;ei<2;ei++){(function(k){setTimeout(function(){
      var ex=60+Math.random()*(vw-120), ey=WL+16+Math.random()*Math.max(14,H-18);
      var eyes=hbaSkEl('hba-skeyes',ex,ey,26,9);
      var i1=document.createElement('i'); i1.style.left='0'; i1.style.top='1px';
      var i2=document.createElement('i'); i2.style.right='0'; i2.style.top='0';
      eyes.appendChild(i1); eyes.appendChild(i2);
      try{eyes.animate([
        {opacity:0,transform:'scale(.7)'},
        {opacity:1,transform:'scale(1)',offset:.25},
        {opacity:1,transform:'scale(1)',offset:.7},
        {opacity:0,transform:'scale(.8)'}
      ],{duration:950/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(eyes,1000/sp);
    },700+k*430/sp);})(ei);}
    /* 触手破水 */
    function tentRise(x,flip){
      var W=Math.round(52*sz), TH=Math.round(W*210/70);
      var t=document.createElement('div'); t.className='hba-sktent';
      t.style.width=W+'px'; t.style.height=TH+'px';
      t.style.left=(x-W/2)+'px'; t.style.top=(WL-TH+24)+'px';
      var sw=document.createElement('div'); sw.className='tsway';
      sw.style.animationDelay=(Math.random()*1.2)+'s';
      if(flip)sw.style.transform='scaleX(-1)';
      sw.innerHTML=hbaSkTentSVG('t'+(_skuu++));
      t.appendChild(sw); (window.__hansenFxLayer||document.body).appendChild(t);
      try{t.animate([
        {transform:'translateY('+(TH-20)+'px)',opacity:0},
        {transform:'translateY('+(TH*0.3)+'px)',opacity:1,offset:.45},
        {transform:'translateY(-8px)',opacity:1,offset:.82},
        {transform:'translateY(0)',opacity:1}
      ],{duration:400/sp,easing:'cubic-bezier(.35,.7,.4,1)',fill:'forwards'});}catch(e){t.style.opacity='1';}
      var sp2=hbaSkEl('hba-sksplash',x,WL,Math.round(40*fxi)); void sp2.offsetWidth; sp2.classList.add('go'); rm(sp2,360);
      var nd=Math.round(4*fxi), d2;
      for(d2=0;d2<nd;d2++){(function(){
        var dr=hbaSkEl('hba-skdrop',x,WL);
        var a=-Math.PI/2+(Math.random()-.5)*1.8, dd=(18+Math.random()*28)*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.6+24+Math.random()*14;
        try{dr.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate(45deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) rotate(45deg) scale(.5)',opacity:0}],{duration:460+Math.random()*160,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
        rm(dr,660);
      })();}
      return t;
    }
    function tentWhip(t,tx,comboNo){
      if(!t)return;
      var dir=(tx>parseFloat(t.style.left)+t.offsetWidth/2)?1:-1;
      try{t.animate([
        {transform:'translateY(0) rotate(0deg)'},
        {transform:'translateY(0) rotate('+(-dir*14)+'deg)',offset:.3},
        {transform:'translateY(0) rotate('+(dir*30)+'deg)',offset:.72},
        {transform:'translateY(0) rotate('+(dir*24)+'deg)'}
      ],{duration:300/sp,easing:'cubic-bezier(.45,.05,.6,.95)',fill:'forwards'});}catch(e){}
      setTimeout(function(){
        var sp3=hbaSkEl('hba-sksplash',tx,midY,Math.round(42*fxi)); void sp3.offsetWidth; sp3.classList.add('go'); rm(sp3,360);
        var rg=hbaSkEl('hba-skring',tx,midY,22); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
        var nd=Math.round(4*fxi), d2;
        for(d2=0;d2<nd;d2++){(function(){
          var dr=hbaSkEl('hba-skdrop',tx,midY);
          var a=-Math.PI/2+(Math.random()-.5)*2.2, dd=(16+Math.random()*24)*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.5+18+Math.random()*12;
          try{dr.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate(45deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) rotate(45deg) scale(.5)',opacity:0}],{duration:430+Math.random()*150,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(dr,620);
        })();}
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
        var cb=document.createElement('div'); cb.className='hba-skcombo'; cb.textContent=comboNo+' 连!';
        cb.style.left=Math.min(Math.max(tx-14,8),vw-58)+'px'; cb.style.top=(midY-34)+'px';
        (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
        setTimeout(function(){
          try{t.animate([{transform:'rotate(0deg)',opacity:1},{transform:'rotate(0deg) translateY(60px)',opacity:0}],{duration:280/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
          rm(t,320/sp);
        },180/sp);
      },(300*0.72)/sp);
    }
    /* 缠绕段: side=0 左上(尖向右), side=1 右下(尖向左) */
    function wrapSqueeze(side,comboNo){
      var W=Math.round(196*sz), WH=Math.round(W*44/220);
      var y=side? ovBot-WH+2 : ovTop-WH*0.3;
      var startL=side? vw : -W;
      var finalL=side? Math.round(hx-W*0.12) : Math.round(hx-W*0.88);
      var w=document.createElement('div'); w.className='hba-skwrap';
      w.style.width=W+'px'; w.style.height=WH+'px';
      w.style.top=y+'px'; w.style.left=startL+'px';
      w.innerHTML=hbaSkWrapSVG('w'+(_skuu++), side?false:true);
      (window.__hansenFxLayer||document.body).appendChild(w);
      try{w.animate([
        {left:startL+'px',opacity:0},
        {left:finalL+'px',opacity:1,offset:.72},
        {left:finalL+'px',opacity:1}
      ],{duration:300/sp,easing:'cubic-bezier(.35,.7,.4,1)',fill:'forwards'});}catch(e){w.style.left=finalL+'px';w.style.opacity='1';}
      setTimeout(function(){
        try{w.animate([
          {transform:'scaleY(1)'},
          {transform:'scaleY(1.26) translateY('+(side?-3:3)+'px)',offset:.4},
          {transform:'scaleY(1)'}
        ],{duration:240/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
        var f=hbaSkEl('hba-sksplash',hx,midY,Math.round(34*fxi)); void f.offsetWidth; f.classList.add('go'); rm(f,360);
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},130); }
        var cb=document.createElement('div'); cb.className='hba-skcombo'; cb.textContent=comboNo+' 连!';
        cb.style.left=Math.min(Math.max(hx-14+(side?26:-26),8),vw-58)+'px'; cb.style.top=(midY-34)+'px';
        (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
      },(360+(side?200:0))/sp);
      setTimeout(function(){
        try{w.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(34px)',opacity:0}],{duration:300/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
        rm(w,340/sp);
      },1000/sp);
    }
    /* ③ 漩涡 */
    function vortex(){
      var VW=Math.round(120*sz), VH=Math.round(VW*60/120);
      var v=document.createElement('div'); v.className='hba-skvort';
      v.style.width=VW+'px'; v.style.height=VH+'px';
      v.style.left=(hx-VW/2)+'px'; v.style.top=(midY-VH/2+4)+'px';
      v.innerHTML=hbaSkVortSVG('v'+(_skuu++));
      (window.__hansenFxLayer||document.body).appendChild(v);
      try{v.animate([
        {transform:'scale(.3)',opacity:0},
        {transform:'scale(1.05)',opacity:1,offset:.4},
        {transform:'scale(1)',opacity:1,offset:.85},
        {transform:'scale(1.15)',opacity:0}
      ],{duration:760/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(v,800/sp);
      var nb=Math.round(7*fxi), i;
      for(i=0;i<nb;i++){(function(k){setTimeout(function(){
        var a=Math.random()*Math.PI*2, r=46+Math.random()*30;
        var bx2=hx+Math.cos(a)*r, by2=midY+Math.sin(a)*r*0.45;
        var ssz=5+Math.random()*5;
        var b2=hbaSkEl('hba-skbub',bx2,by2,ssz,ssz);
        try{b2.animate([
          {transform:'translate(-50%,-50%) scale(1)',opacity:.9},
          {transform:'translate(-50%,-50%) translate('+(hx-bx2)+'px,'+(midY-by2)+'px) scale(.2)',opacity:.95}
        ],{duration:(300+Math.random()*180)/sp,easing:'cubic-bezier(.5,.05,.8,.4)',fill:'forwards'});}catch(e){}
        rm(b2,520/sp);
      },k*(55/sp));})(i);}
    }
    /* ④ 海啸(deal) */
    function tsunami(){
      var W=Math.round(Math.min(300*sz,vw-20)), WH=Math.round(W*130/320);
      var w=document.createElement('div'); w.className='hba-skwave';
      w.style.width=W+'px'; w.style.height=WH+'px';
      w.style.left=Math.round(vw/2-W/2)+'px'; w.style.top=(WL-WH+14)+'px';
      w.innerHTML=hbaSkWaveSVG('w'+(_skuu++));
      (window.__hansenFxLayer||document.body).appendChild(w);
      var dy=midY-(WL+14);
      try{w.animate([
        {transform:'translateY('+(WH*0.7)+'px) scaleY(.4)',opacity:0},
        {transform:'translateY(0) scaleY(1.06)',opacity:1,offset:.4},
        {transform:'translateY(-4px) scaleY(1)',opacity:1,offset:.56},
        {transform:'translateY('+(dy+WH*0.34)+'px) scaleY(.72) scaleX(1.18)',opacity:.95,offset:.92},
        {transform:'translateY('+(dy+WH*0.4)+'px) scaleY(.6) scaleX(1.26)',opacity:0}
      ],{duration:560/sp,easing:'cubic-bezier(.5,.05,.65,.4)',fill:'forwards'});}catch(e){}
      rm(w,600/sp);
      setTimeout(function(){
        var fl=hbaSkEl('hba-skflash',hx,midY,Math.round(68*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,380);
        var rg=hbaSkEl('hba-skring',hx,midY,48); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
        var rg2=hbaSkEl('hba-skring white',hx,midY,48); setTimeout(function(){void rg2.offsetWidth;rg2.classList.add('go');},110); rm(rg2,650);
        var bar=document.querySelector('.hero-hp-bar');
        if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},340); }
        var nf=Math.round(8*fxi), f2;
        for(f2=0;f2<nf;f2++){(function(){
          var fs=Math.round((18+Math.random()*16)*sz);
          var fo=hbaSkEl('hba-skfoam',hx+(Math.random()-.5)*90,midY-4,fs,fs);
          try{fo.animate([
            {transform:'translate(-50%,-50%) scale(.4)',opacity:.95},
            {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*46)+'px,-'+(16+Math.random()*26)+'px) scale(1.6)',opacity:0}
          ],{duration:560+Math.random()*240,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(fo,860);
        })();}
        var nd=Math.round(14*fxi), d2;
        for(d2=0;d2<nd;d2++){(function(){
          var dr=hbaSkEl('hba-skdrop',hx,midY);
          var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(30+Math.random()*52)*fxi, dx=Math.cos(a)*dd, dy2=Math.sin(a)*dd, gy=Math.abs(dy2)*0.55+26+Math.random()*22;
          try{dr.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate(45deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate(45deg) scale(.5)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
          rm(dr,860);
        })();}
        var vg=hbaSkEl('hba-skvign',0,0); vg.style.left='0'; vg.style.top='0';
        try{vg.animate([{opacity:0},{opacity:.6,offset:.32},{opacity:0}],{duration:460/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,520/sp);
        deal();
      },(560*0.92)/sp);
    }
    /* 退潮 */
    function floodOut(){
      clearInterval(bt);
      cau.forEach(function(cu){try{cu.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});}catch(e){} rm(cu,340);});
      try{wb.animate([{top:WL+'px',height:H+'px',opacity:1},{top:bodyBot+'px',height:'0px',opacity:.7}],{duration:520/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
      try{ov.animate([{opacity:1},{opacity:0}],{duration:480/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
      rm(wb,560/sp); rm(ov,560/sp);
    }
    /* 时间轴 */
    var tents=[];
    var TX=[Math.round(vw*0.16),Math.round(vw*0.38),Math.round(vw*0.62),Math.round(vw*0.84)];
    setTimeout(function(){
      TX.forEach(function(x,k){setTimeout(function(){
        tents.push(tentRise(x,k>=2));
      },k*(130/sp));});
    },950/sp);
    setTimeout(function(){ tentWhip(tents[0],barL+barW*0.22,1); },1700/sp);
    setTimeout(function(){ tentWhip(tents[3],barL+barW*0.78,2); },1930/sp);
    setTimeout(function(){
      [1,2].forEach(function(i){
        var t=tents[i]; if(!t)return;
        try{t.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(80px)',opacity:0}],{duration:280/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
        rm(t,320/sp);
      });
    },2100/sp);
    setTimeout(function(){
      wrapSqueeze(0,3);
      wrapSqueeze(1,4);
    },2300/sp);
    setTimeout(function(){vortex();},3100/sp);
    setTimeout(function(){tsunami();},3650/sp);
    setTimeout(function(){floodOut();},4450/sp);
  }
  // 🔴 v523: 寒冰女王·冰封万古——全SVG+CSS内联无外部图。寒冰蓝硬编码。名场面: 巨型冰晶罩死血条0.8秒后炸碎。
  function hbaIqEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaIqFlakeSVG(u){
    var arm='M0,0 L0,-9 M0,-5 L-2.4,-7.4 M0,-5 L2.4,-7.4';
    var g='', k;
    for(k=0;k<6;k++){g+='<g transform="rotate('+(k*60)+')"><path d="'+arm+'" stroke="#e0f7fe" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>';}
    return '<svg viewBox="-10 -10 20 20" xmlns="http://www.w3.org/2000/svg"><g>'+g+'<circle r="1.4" fill="#fff"/></g></svg>';
  }
  function hbaIqSpearSVG(u){
    return '<svg viewBox="0 0 26 110" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbaiq'+u+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0f7fe"/><stop offset="0.45" stop-color="#67e8f9"/><stop offset="1" stop-color="#0891b2"/></linearGradient></defs>'
      +'<path d="M13,2 L21,30 L17,72 L13,108 L9,72 L5,30 Z" fill="url(#hbaiq'+u+')" stroke="#a5f3fc" stroke-width="1.4" stroke-linejoin="round" opacity="0.94"/>'
      +'<path d="M13,2 L13,108" stroke="#fff" stroke-width="1.2" opacity="0.85"/>'
      +'<path d="M13,2 L21,30 L17,72" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.55"/>'
      +'<path d="M9,30 L13,40 L17,30" fill="none" stroke="#e0f7fe" stroke-width="0.9" opacity="0.6"/>'
      +'<circle cx="11" cy="22" r="1.2" fill="#fff" opacity="0.8"/><circle cx="15" cy="52" r="1" fill="#e0f7fe" opacity="0.7"/>'
      +'</svg>';
  }
  function hbaIqBlockSVG(u){
    return '<svg viewBox="0 0 180 90" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbaiqb'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(224,247,254,.5)"/><stop offset="0.5" stop-color="rgba(103,232,249,.34)"/><stop offset="1" stop-color="rgba(8,145,178,.3)"/></linearGradient></defs>'
      +'<path d="M16,66 L8,38 L26,14 L62,6 L118,4 L156,12 L172,36 L166,62 L138,72 L96,76 L52,74 Z" fill="url(#hbaiqb'+u+')" stroke="#cffafe" stroke-width="2.2" stroke-linejoin="round"/>'
      +'<path d="M26,14 L58,34 L52,74 M58,34 L118,4 M58,34 L112,44 L96,76 M112,44 L156,12 M112,44 L166,62" fill="none" stroke="#e0f7fe" stroke-width="1.2" opacity="0.6"/>'
      +'<path d="M8,38 L58,34 M118,4 L112,44" fill="none" stroke="#fff" stroke-width="0.9" opacity="0.45"/>'
      +'<path d="M62,6 L58,34 L26,14 Z" fill="rgba(255,255,255,.18)"/>'
      +'<path d="M112,44 L156,12 L172,36 Z" fill="rgba(8,145,178,.2)"/>'
      +'<path d="M40,74 L36,88 L46,75 Z M86,76 L84,89 L93,76 Z M132,72 L132,86 L140,71 Z" fill="rgba(165,243,252,.55)" stroke="#cffafe" stroke-width="1.2" stroke-linejoin="round"/>'
      +'<circle class="ipulse" cx="74" cy="40" r="10" fill="rgba(207,250,254,.5)"/>'
      +'<circle cx="44" cy="50" r="1.6" fill="#fff" opacity="0.7"/><circle cx="128" cy="30" r="1.4" fill="#fff" opacity="0.6"/><circle cx="98" cy="58" r="1.2" fill="#e0f7fe" opacity="0.6"/>'
      +'</svg>';
  }
  function hbaIqFrostSVG(u){
    var arm='M0,0 L0,-14 M0,-7 L-3.6,-10.6 M0,-7 L3.6,-10.6 M0,-11 L-2.4,-13.6 M0,-11 L2.4,-13.6';
    var g='', k;
    for(k=0;k<6;k++){g+='<g transform="rotate('+(k*60)+')"><path d="'+arm+'" stroke="#f0f9ff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity="0.9"/></g>';}
    return '<svg viewBox="-16 -16 32 32" xmlns="http://www.w3.org/2000/svg"><g>'+g+'<circle r="2" fill="#fff" opacity="0.95"/></g></svg>';
  }
  function hbaIqCrackSVG(u){
    return '<svg viewBox="0 0 180 90" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M88,42 L64,28 L52,30 M88,42 L116,24 L128,26 M88,42 L70,60 L58,66 M88,42 L112,58 L126,56 M88,42 L92,16 M88,42 L84,70" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.95"/>'
      +'<path d="M64,28 L58,18 M116,24 L122,14 M70,60 L62,72 M112,58 L120,70" fill="none" stroke="#e0f7fe" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>'
      +'</svg>';
  }
  var _iquu=0;
  // 主编排: ①暴风雪+举杖 ②冰晶风暴五连 ③绝对零度冰封 ④裂纹炸碎(deal)
  function hbaIceQueen(bx,by,hx,barL,barW,midY,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 暴风雪 */
    var dm=hbaIqEl('hba-iqdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:1,offset:.32},{opacity:0}],{duration:4400/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,4460/sp);
    function snowflake(){
      var fsz=(8+Math.random()*10)*sz;
      var x=10+Math.random()*(vw-20), drift=(Math.random()-.5)*46, fall=120+Math.random()*180, rot=(Math.random()-.5)*240;
      var fk=document.createElement('div'); fk.className='hba-iqflake';
      fk.style.width=fsz+'px'; fk.style.height=fsz+'px';
      fk.style.left=x+'px'; fk.style.top='-16px';
      fk.innerHTML=hbaIqFlakeSVG('f'+(_iquu++));
      (window.__hansenFxLayer||document.body).appendChild(fk);
      var dur=(2200+Math.random()*1600)/sp;
      try{fk.animate([
        {transform:'translate(0,0) rotate(0deg)',opacity:0},
        {transform:'translate('+(drift*0.3)+'px,'+(fall*0.25)+'px) rotate('+(rot*0.25)+'deg)',opacity:.95,offset:.18},
        {transform:'translate('+(drift*0.7)+'px,'+(fall*0.7)+'px) rotate('+(rot*0.7)+'deg)',opacity:.9,offset:.7},
        {transform:'translate('+drift+'px,'+fall+'px) rotate('+rot+'deg)',opacity:0}
      ],{duration:dur,easing:'linear',fill:'forwards'});}catch(e){}
      rm(fk,dur+80);
    }
    var st=setInterval(function(){snowflake();},90/sp);
    setTimeout(function(){clearInterval(st);},4200/sp);
    var mi;
    for(mi=0;mi<4;mi++){(function(k){setTimeout(function(){
      var ms=Math.round((40+Math.random()*26)*sz);
      var m=hbaIqEl('hba-iqmist',30+Math.random()*(vw-60),midY+30+Math.random()*14,ms,ms*0.6);
      try{m.animate([
        {transform:'translate(-50%,-50%) scale(.5)',opacity:0},
        {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*40)+'px,-8px) scale(1.2)',opacity:.85,offset:.45},
        {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*60)+'px,-18px) scale(1.7)',opacity:0}
      ],{duration:(1300+Math.random()*500)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(m,1900/sp);
    },k*180/sp);})(mi);}
    setTimeout(function(){
      var CS=Math.round(15*sz);
      var ch=hbaIqEl('hba-iqcharge',bx-34*sz-CS/2,by-12*sz-CS/2,CS,CS);
      try{ch.animate([
        {transform:'scale(.2)',opacity:0},
        {transform:'scale(1.3)',opacity:1,offset:.55},
        {transform:'scale(1)',opacity:1,offset:.82},
        {transform:'scale(1.5)',opacity:0}
      ],{duration:360/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(ch,400/sp);
      var ri;
      for(ri=0;ri<Math.round(7*fxi);ri++){(function(){
        var rn=hbaIqEl('hba-iqrune',bx+(Math.random()-.5)*150,by+16+Math.random()*46);
        try{rn.animate([{transform:'translate(0,0) scale(.6)',opacity:0},{transform:'translate('+((Math.random()-.5)*14)+'px,-'+(18+Math.random()*22)+'px) scale(1)',opacity:.95,offset:.5},{transform:'translate('+((Math.random()-.5)*20)+'px,-'+(32+Math.random()*22)+'px) scale(.4)',opacity:0}],{duration:(740+Math.random()*360)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
        rm(rn,1150/sp);
      })();}
    },500/sp);
    /* ② 冰晶风暴 */
    setTimeout(function(){
      var n=5, hit=0, spears=[], k;
      for(k=0;k<n;k++){(function(k){setTimeout(function(){
        var SW=Math.round(20*sz), SH=Math.round(SW*110/26);
        var sx=Math.min(Math.max(bx+(k-2)*44*sz,18),vw-18), sy=by+34*sz;
        var s=document.createElement('div'); s.className='hba-iqspear';
        s.style.width=SW+'px'; s.style.height=SH+'px';
        s.style.left=(sx-SW/2)+'px'; s.style.top=(sy-SH/2)+'px';
        var bob=document.createElement('div'); bob.className='ibob'; bob.style.animationDelay=(k*0.15)+'s';
        bob.innerHTML=hbaIqSpearSVG('s'+(_iquu++));
        s.appendChild(bob); (window.__hansenFxLayer||document.body).appendChild(s);
        spears.push({el:s,x:sx,y:sy,SW:SW,SH:SH});
        try{s.animate([
          {transform:'scale(.2) rotate('+((k-2)*14-10)+'deg)',opacity:0},
          {transform:'scale(1.12) rotate('+((k-2)*3)+'deg)',opacity:1,offset:.6},
          {transform:'scale(1) rotate(0deg)',opacity:1}
        ],{duration:220/sp,easing:'ease-out',fill:'forwards'});}catch(e){s.style.opacity='1';}
        var f=hbaIqEl('hba-iqhit',sx,sy,Math.round(20*sz)); void f.offsetWidth; f.classList.add('go'); rm(f,320);
      },k*(110/sp));})(k);}
      setTimeout(function(){
        var tgt=[0.18,0.34,0.5,0.66,0.82];
        spears.forEach(function(sp2,k){setTimeout(function(){
          var p1x=barL+barW*tgt[k], dy=midY-2-sp2.y;
          var dur=160/sp, t0=null, fr=0;
          var dx=p1x-sp2.x;
          var rot=Math.atan2(dx,dy)*180/Math.PI*-1;
          function step(now){
            if(t0===null)t0=now;
            var t=(now-t0)/dur; if(t>1)t=1;
            var cx=sp2.x+dx*t, cy=sp2.y+dy*t;
            sp2.el.style.left=(cx-sp2.SW/2)+'px'; sp2.el.style.top=(cy-sp2.SH/2)+'px';
            sp2.el.style.transform='rotate('+rot+'deg)';
            if((fr++%2)===0&&t>0.05&&t<0.95){var ts=4+Math.random()*4;var tr=hbaIqEl('hba-iqtrail',cx,cy,ts,ts);tr.style.transform='translate(-50%,-50%)';
              try{tr.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:240,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,280);}
            if(t<1){requestAnimationFrame(step);}
            else{
              if(sp2.el.parentNode)sp2.el.remove();
              var bu=hbaIqEl('hba-iqhit',p1x,midY,Math.round(36*fxi)); void bu.offsetWidth; bu.classList.add('go'); rm(bu,320);
              var rg=hbaIqEl('hba-iqring',p1x,midY,22); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
              var nch=Math.round(4*fxi), s2;
              for(s2=0;s2<nch;s2++){(function(){
                var chp=hbaIqEl('hba-iqchip',p1x,midY);
                var a=-Math.PI/2+(Math.random()-.5)*2.4, dd=(15+Math.random()*24)*fxi, ddx=Math.cos(a)*dd, ddy=Math.sin(a)*dd, gy=Math.abs(ddy)*0.5+17+Math.random()*13;
                try{chp.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+ddx+'px,'+ddy+'px) rotate(145deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(ddx*1.1)+'px,'+gy+'px) rotate(245deg) scale(.5)',opacity:0}],{duration:430+Math.random()*150,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
                rm(chp,620);
              })();}
              var bar=document.querySelector('.hero-hp-bar');
              if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
              hit++;
              var cb=document.createElement('div'); cb.className='hba-iqcombo'; cb.textContent=hit+' 连!';
              cb.style.left=Math.min(Math.max(p1x-14,8),vw-58)+'px'; cb.style.top=(midY-34)+'px';
              (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
            }
          }
          requestAnimationFrame(step);
        },k*(120/sp));});
      },(n*110+200)/sp);
    },900/sp);
    /* ③ 绝对零度冰封 → ④ 裂纹炸碎 */
    setTimeout(function(){
      var WW=Math.round(150*sz);
      var wv=hbaIqEl('hba-iqwave',bx-WW/2,by+30,WW,24);
      var wdy=midY-(by+42);
      try{wv.animate([
        {transform:'translateY(0) scaleX(.4)',opacity:0},
        {transform:'translateY('+(wdy*0.5)+'px) scaleX(1.1)',opacity:.95,offset:.55},
        {transform:'translateY('+wdy+'px) scaleX(1.5)',opacity:0}
      ],{duration:280/sp,easing:'cubic-bezier(.4,.1,.6,.9)',fill:'forwards'});}catch(e){}
      rm(wv,320/sp);
      setTimeout(function(){
        var BW=Math.round(Math.min(216*sz,barW+24)), BH=Math.round(BW*90/180);
        var b2=document.createElement('div'); b2.className='hba-iqblock';
        b2.style.width=BW+'px'; b2.style.height=BH+'px';
        b2.style.left=(hx-BW/2)+'px'; b2.style.top=(midY-BH*0.56)+'px';
        b2.innerHTML=hbaIqBlockSVG('b'+(_iquu++));
        (window.__hansenFxLayer||document.body).appendChild(b2);
        try{b2.animate([
          {transform:'scale(1.3)',opacity:0},
          {transform:'scale(.96)',opacity:1,offset:.55},
          {transform:'scale(1.02)',opacity:1,offset:.8},
          {transform:'scale(1)',opacity:1}
        ],{duration:240/sp,easing:'cubic-bezier(.3,.7,.4,1.05)',fill:'forwards'});}catch(e){b2.style.opacity='1';}
        var f=hbaIqEl('hba-iqflash',hx,midY,Math.round(56*fxi)); void f.offsetWidth; f.classList.add('go'); rm(f,380);
        var rg=hbaIqEl('hba-iqring white',hx,midY,40); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
        var frosts=[];
        [[-0.26,-8],[0.24,6]].forEach(function(pos,k){setTimeout(function(){
          var FS=Math.round(30*sz);
          var fr2=document.createElement('div'); fr2.className='hba-iqfrost';
          fr2.style.width=FS+'px'; fr2.style.height=FS+'px';
          fr2.style.left=(hx+BW*pos[0]-FS/2)+'px'; fr2.style.top=(midY+pos[1]-FS/2)+'px';
          fr2.innerHTML=hbaIqFrostSVG('r'+(_iquu++));
          (window.__hansenFxLayer||document.body).appendChild(fr2);
          try{fr2.animate([
            {transform:'scale(.2) rotate(-50deg)',opacity:0},
            {transform:'scale(1.1) rotate(8deg)',opacity:1,offset:.6},
            {transform:'scale(1) rotate(0deg)',opacity:.95}
          ],{duration:240/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
          frosts.push(fr2);
        },120+k*150/sp);});
        var mi2;
        for(mi2=0;mi2<4;mi2++){(function(){
          var ms=Math.round((26+Math.random()*18)*sz);
          var m=hbaIqEl('hba-iqmist',hx+(Math.random()-.5)*BW*0.9,midY+BH*0.3,ms,ms*0.7);
          try{m.animate([
            {transform:'translate(-50%,-50%) scale(.4)',opacity:.8},
            {transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*40)+'px,-'+(14+Math.random()*18)+'px) scale(1.6)',opacity:0}
          ],{duration:620+Math.random()*240,easing:'ease-out',fill:'forwards'});}catch(e){}
          rm(m,900);
        })();}
        /* ④ 冻结0.8s后炸碎 */
        setTimeout(function(){
          var cr=document.createElement('div'); cr.className='hba-iqcrack';
          cr.style.width=BW+'px'; cr.style.height=BH+'px';
          cr.style.left=b2.style.left; cr.style.top=b2.style.top;
          cr.innerHTML=hbaIqCrackSVG('c'+(_iquu++));
          (window.__hansenFxLayer||document.body).appendChild(cr);
          try{cr.animate([{opacity:0},{opacity:1}],{duration:160/sp,easing:'ease-out',fill:'forwards'});}catch(e){cr.style.opacity='1';}
          [0,1].forEach(function(k){setTimeout(function(){
            var mf=hbaIqEl('hba-iqhit',hx+(k?14:-12),midY+(k?4:-6),Math.round(24*sz)); void mf.offsetWidth; mf.classList.add('go'); rm(mf,300);
          },k*(150/sp));});
          setTimeout(function(){
            if(b2.parentNode)b2.remove(); if(cr.parentNode)cr.remove();
            frosts.forEach(function(fr2){if(fr2.parentNode)fr2.remove();});
            var fl=hbaIqEl('hba-iqflash',hx,midY,Math.round(70*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,380);
            var rg3=hbaIqEl('hba-iqring',hx,midY,48); void rg3.offsetWidth; rg3.classList.add('go'); rm(rg3,520);
            var rg4=hbaIqEl('hba-iqring white',hx,midY,48); setTimeout(function(){void rg4.offsetWidth;rg4.classList.add('go');},110); rm(rg4,650);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},340); }
            var ns=Math.round(16*fxi), i2;
            for(i2=0;i2<ns;i2++){(function(){
              var sh=hbaIqEl('hba-iqchip',hx,midY); sh.style.width='8px'; sh.style.height='8px';
              var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(32+Math.random()*54)*fxi, dx=Math.cos(a)*dd, dy2=Math.sin(a)*dd, gy=Math.abs(dy2)*0.55+26+Math.random()*22, rot2=(Math.random()-.5)*540;
              try{sh.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy2+'px) rotate('+(45+rot2*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) rotate('+(45+rot2)+'deg) scale(.5)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
              rm(sh,860);
            })();}
            var mi3;
            for(mi3=0;mi3<4;mi3++){(function(k){
              var ms=Math.round((24+Math.random()*16)*sz);
              var m=hbaIqEl('hba-iqmist',hx+(k-1.5)*26,midY-4,ms,ms*0.7);
              try{m.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:.8},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*30)+'px,-'+(18+Math.random()*22)+'px) scale(1.8)',opacity:0}],{duration:680+Math.random()*220,easing:'ease-out',fill:'forwards'});}catch(e){}
              rm(m,940);
            })(mi3);}
            var vg=hbaIqEl('hba-iqvign',0,0); vg.style.left='0'; vg.style.top='0';
            try{vg.animate([{opacity:0},{opacity:.6,offset:.32},{opacity:0}],{duration:460/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,520/sp);
            deal();
          },(150+340)/sp);
        },800/sp);
      },(280*0.85)/sp);
    },2450/sp);
  }
  // 🔴 v524: 烈焰魔神·陨星灭世——全SVG+CSS内联无外部图。炽焰橙硬编码。枪雨公式: 12颗弹幕雨+1发灭世巨陨终结。
  function hbaFmEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaFmMetSVG(u){
    return '<svg viewBox="0 0 40 90" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbafm'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(253,230,138,0)"/><stop offset="0.45" stop-color="#fbbf24"/><stop offset="0.8" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>'
      +'<path d="M20,2 Q27,28 25,52 Q24,64 20,72 Q16,64 15,52 Q13,28 20,2 Z" fill="url(#hbafm'+u+')" opacity="0.92"/>'
      +'<path d="M20,14 Q23,36 21,58" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>'
      +'<circle cx="20" cy="74" r="9" fill="#dc2626"/>'
      +'<circle cx="20" cy="74" r="6.4" fill="#f97316"/>'
      +'<circle cx="18.5" cy="72.5" r="3.6" fill="#fde68a"/>'
      +'<circle cx="18" cy="72" r="1.8" fill="#fff"/>'
      +'<circle cx="27" cy="48" r="2" fill="#44403c" opacity="0.7"/><circle cx="13" cy="34" r="1.6" fill="#57534e" opacity="0.6"/>'
      +'</svg>';
  }
  function hbaFmBigSVG(u){
    return '<svg viewBox="0 0 80 170" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="hbafb'+u+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(253,230,138,0)"/><stop offset="0.4" stop-color="#fbbf24"/><stop offset="0.78" stop-color="#f97316"/><stop offset="1" stop-color="#dc2626"/></linearGradient></defs>'
      +'<path d="M40,0 Q56,42 52,86 Q50,106 40,118 Q30,106 28,86 Q24,42 40,0 Z" fill="url(#hbafb'+u+')" opacity="0.9"/>'
      +'<path d="M40,16 Q47,52 44,92" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity="0.6"/>'
      +'<g class="fflick"><path d="M16,118 Q8,104 14,92 Q20,102 24,108 Z M64,120 Q74,106 70,92 Q62,102 58,110 Z M40,104 Q36,92 40,82 Q45,92 43,102 Z" fill="#fbbf24" opacity="0.85"/></g>'
      +'<circle cx="40" cy="134" r="26" fill="#dc2626"/>'
      +'<circle cx="40" cy="134" r="22" fill="#1c1917" stroke="#0c0a09" stroke-width="2"/>'
      +'<path d="M28,124 L38,132 L34,142 M44,120 L48,132 L56,136 M36,146 L44,142 L50,148" fill="none" stroke="#f97316" stroke-width="2.4" stroke-linecap="round" style="filter:drop-shadow(0 0 4px rgba(249,115,22,.95))"/>'
      +'<path d="M38,132 L48,132" fill="none" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>'
      +'<circle cx="32" cy="128" r="2.2" fill="#44403c"/><circle cx="50" cy="142" r="2.6" fill="#44403c"/>'
      +'<path class="fflick" d="M18,138 Q10,148 14,158 Q22,152 24,144 Z M62,140 Q72,148 68,160 Q58,154 56,146 Z" fill="#f97316" opacity="0.9"/>'
      +'<circle cx="34" cy="128" r="2" fill="#fde68a" opacity="0.9"/>'
      +'</svg>';
  }
  var _fmuu=0;
  // 主编排: ①天罚预兆 ②陨星雨12颗 ③灭世巨陨(deal) ④残火灰烬收场
  function hbaDoomStar(bx,by,hx,barL,barW,midY,barBot,fx,deal){
    var sp=fx.sp||1, sz=fx.sz||1, fxi=fx.fxi||1;
    var vw=window.innerWidth||393;
    /* ① 天罚预兆 */
    var dm=hbaFmEl('hba-fmdome',0,0); dm.style.left='0'; dm.style.top='0';
    try{dm.animate([{opacity:0},{opacity:1,offset:.32},{opacity:0}],{duration:4500/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(dm,4560/sp);
    var sky=hbaFmEl('hba-fmsky',0,0); sky.style.left='0'; sky.style.top='0';
    try{sky.animate([{opacity:0},{opacity:1,offset:.18},{opacity:1,offset:.8},{opacity:0}],{duration:4300/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(sky,4360/sp);
    function ember(){
      var esz=(3+Math.random()*4)*sz;
      var x=10+Math.random()*(vw-20), rise=90+Math.random()*150, wob=(Math.random()-.5)*40;
      var e2=hbaFmEl('hba-fmember',x,midY+30+Math.random()*16,esz,esz);
      var dur=(1400+Math.random()*900)/sp;
      try{e2.animate([
        {transform:'translate(0,0) scale(.6)',opacity:0},
        {transform:'translate('+(wob*0.4)+'px,-'+(rise*0.3)+'px) scale(1)',opacity:.95,offset:.22},
        {transform:'translate('+(wob*0.8)+'px,-'+(rise*0.75)+'px) scale(.9)',opacity:.8,offset:.72},
        {transform:'translate('+wob+'px,-'+rise+'px) scale(.4)',opacity:0}
      ],{duration:dur,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(e2,dur+80);
    }
    var st=setInterval(function(){ember();},110/sp);
    setTimeout(function(){clearInterval(st);},4300/sp);
    [[-38,-32],[38,-32]].forEach(function(off,k){setTimeout(function(){
      var CS=Math.round(15*sz);
      var ch=hbaFmEl('hba-fmcharge',bx+off[0]*sz-CS/2,by+off[1]*sz-CS/2,CS,CS);
      try{ch.animate([
        {transform:'scale(.2)',opacity:0},
        {transform:'scale(1.25)',opacity:1,offset:.5},
        {transform:'scale(.95)',opacity:.95,offset:.72},
        {transform:'scale(1.45)',opacity:0}
      ],{duration:560/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
      rm(ch,620/sp);
    },350+k*130/sp);});
    setTimeout(function(){
      var CS=Math.round(13*sz);
      var ch=hbaFmEl('hba-fmcharge',bx-CS/2,by+12*sz-CS/2,CS,CS);
      try{ch.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.2)',opacity:1,offset:.6},{transform:'scale(1.5)',opacity:0}],{duration:420/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      rm(ch,480/sp);
    },680/sp);
    /* 小爆 */
    function smallBurst(x,y,scale,tuft){
      var bu=hbaFmEl('hba-fmhit',x,y,Math.round(30*scale*fxi)); void bu.offsetWidth; bu.classList.add('go'); rm(bu,320);
      var rg=hbaFmEl('hba-fmring',x,y,Math.round(18*scale)); rg.style.borderWidth='2px'; void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
      var nd=Math.round(3*scale*fxi), d2;
      for(d2=0;d2<nd;d2++){(function(){
        var dr=hbaFmEl('hba-fmdrop',x,y);
        var a=-Math.PI/2+(Math.random()-.5)*2.2, dd=(14+Math.random()*20)*scale*fxi, dx=Math.cos(a)*dd, dy=Math.sin(a)*dd, gy=Math.abs(dy)*0.5+15+Math.random()*10;
        try{dr.animate([{transform:'translate(-50%,-50%) rotate(45deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate(45deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(dx*1.1)+'px,'+gy+'px) rotate(45deg) scale(.5)',opacity:0}],{duration:420+Math.random()*140,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
        rm(dr,600);
      })();}
      if(tuft){
        var ts=Math.round((9+Math.random()*7)*sz*scale);
        var tf=hbaFmEl('hba-fmtuft',x-ts/2,y-ts,ts,Math.round(ts*1.4));
        try{tf.animate([
          {transform:'scaleY(.2)',opacity:0},
          {transform:'scaleY(1.05)',opacity:.95,offset:.2},
          {transform:'scaleY(.9)',opacity:.9,offset:.42},
          {transform:'scaleY(1)',opacity:.85,offset:.66},
          {transform:'scaleY(.5) translateY(4px)',opacity:0}
        ],{duration:(780+Math.random()*260)/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
        rm(tf,1120/sp);
      }
    }
    /* 单颗流星 */
    function oneMeteor(sx,sy,ex,ey,scale,bg,dur,onHit){
      var MW=Math.round(30*scale*sz), MH=Math.round(MW*90/40);
      var m=document.createElement('div'); m.className='hba-fmmet'+(bg?' bg':'');
      m.style.width=MW+'px'; m.style.height=MH+'px';
      m.style.left=(sx-MW/2)+'px'; m.style.top=(sy-MH/2)+'px';
      m.innerHTML=hbaFmMetSVG('m'+(_fmuu++));
      (window.__hansenFxLayer||document.body).appendChild(m);
      var dx=ex-sx, dy=ey-sy;
      var rot=Math.atan2(dx,dy)*180/Math.PI*-1;
      var t0=null, fr=0;
      function step(now){
        if(t0===null)t0=now;
        var t=(now-t0)/dur; if(t>1)t=1;
        var tt=t*t*0.6+t*0.4;
        var cx=sx+dx*tt, cy=sy+dy*tt;
        m.style.left=(cx-MW/2)+'px'; m.style.top=(cy-MH/2)+'px';
        m.style.transform='rotate('+rot+'deg)';
        if(!bg)m.style.opacity=t<0.1?(t/0.1).toFixed(2):'1';
        if(!bg&&(fr++%2)===0&&t>0.06&&t<0.94){var ts=5+Math.random()*6;var tr=hbaFmEl('hba-fmmtr',cx,cy,ts,ts);tr.style.transform='translate(-50%,-50%)';
          try{tr.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:260,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,300);}
        if(t<1){requestAnimationFrame(step);}
        else{ if(m.parentNode)m.remove(); if(onHit)onHit(); }
      }
      requestAnimationFrame(step);
    }
    /* ② 陨星雨12颗 */
    setTimeout(function(){
      var hit=0;
      var plan=[
        {kind:'bar', t:0.18}, {kind:'ground'}, {kind:'bar', t:0.34}, {kind:'bg'},
        {kind:'ground'}, {kind:'bar', t:0.5}, {kind:'bg'}, {kind:'ground'},
        {kind:'bar', t:0.66}, {kind:'bg'}, {kind:'ground'}, {kind:'bar', t:0.82}
      ];
      plan.forEach(function(p,k){setTimeout(function(){
        if(p.kind==='bar'){
          var ex=barL+barW*p.t, ey=midY-2;
          var sx=ex+(Math.random()<0.5?1:-1)*(40+Math.random()*60);
          oneMeteor(sx,-40,ex,ey,1,false,(320+Math.random()*70)/sp,function(){
            smallBurst(ex,ey,1.15,false);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},110); }
            hit++;
            var cb=document.createElement('div'); cb.className='hba-fmcombo'; cb.textContent=hit+' 连!';
            cb.style.left=Math.min(Math.max(ex-14,8),vw-58)+'px'; cb.style.top=(midY-34)+'px';
            (window.__hansenFxLayer||document.body).appendChild(cb); void cb.offsetWidth; cb.classList.add('go'); rm(cb,520);
          });
        } else if(p.kind==='ground'){
          var gx=30+Math.random()*(vw-60), gy=barBot+8+Math.random()*8;
          var sx2=gx+(Math.random()<0.5?1:-1)*(30+Math.random()*60);
          oneMeteor(sx2,-40,gx,gy,0.78,false,(340+Math.random()*80)/sp,function(){
            smallBurst(gx,gy,0.8,true);
          });
        } else {
          var bx2=24+Math.random()*(vw-48), by2=130+Math.random()*50;
          var sx3=bx2+(Math.random()<0.5?1:-1)*(20+Math.random()*40);
          oneMeteor(sx3,-30,bx2,by2,0.5,true,(380+Math.random()*90)/sp,function(){
            smallBurst(bx2,by2,0.5,false);
          });
        }
      },k*(85/sp));});
    },900/sp);
    /* ③ 灭世巨陨 */
    setTimeout(function(){
      var MW=Math.round(64*sz), MH=Math.round(MW*170/80);
      var msx=hx+50, msy=-MH*0.7;
      var m=document.createElement('div'); m.className='hba-fmbig';
      m.style.width=MW+'px'; m.style.height=MH+'px';
      m.style.left=(msx-MW/2)+'px'; m.style.top=(msy-MH/2)+'px';
      m.innerHTML=hbaFmBigSVG('B'+(_fmuu++));
      (window.__hansenFxLayer||document.body).appendChild(m);
      var ex=hx, ey=midY-6;
      var dx=ex-msx, dy=ey-msy;
      var rot=Math.atan2(dx,dy)*180/Math.PI*-1;
      m.style.transform='rotate('+rot+'deg)';
      try{m.animate([
        {transform:'rotate('+rot+'deg) translateY(-26px) scale(.7)',opacity:0},
        {transform:'rotate('+rot+'deg) translateY(0) scale(1)',opacity:1}
      ],{duration:220/sp,easing:'ease-out',fill:'forwards'});}catch(e){m.style.opacity='1';}
      setTimeout(function(){
        var dur=400/sp, t0=null, fr=0;
        function step(now){
          if(t0===null)t0=now;
          var t=(now-t0)/dur; if(t>1)t=1;
          var tt=t*t;
          var cx=msx+dx*tt, cy=msy+dy*tt;
          m.style.left=(cx-MW/2)+'px'; m.style.top=(cy-MH/2)+'px';
          if((fr++%2)===0&&t>0.1&&t<0.95){var ts=8+Math.random()*8;var tr=hbaFmEl('hba-fmmtr',cx,cy-MH*0.2,ts,ts);tr.style.transform='translate(-50%,-50%)';
            try{tr.animate([{opacity:.9,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:300,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,340);}
          if(t<1){requestAnimationFrame(step);}
          else{
            if(m.parentNode)m.remove();
            var fl=hbaFmEl('hba-fmflash',ex,ey,Math.round(76*fxi)); void fl.offsetWidth; fl.classList.add('go'); rm(fl,380);
            var rg=hbaFmEl('hba-fmring',ex,ey,50); void rg.offsetWidth; rg.classList.add('go'); rm(rg,520);
            var rg2=hbaFmEl('hba-fmring gold',ex,ey,50); setTimeout(function(){void rg2.offsetWidth;rg2.classList.add('go');},100); rm(rg2,640);
            var rg3=hbaFmEl('hba-fmring red',ex,ey,50); setTimeout(function(){void rg3.offsetWidth;rg3.classList.add('go');},200); rm(rg3,760);
            var bar=document.querySelector('.hero-hp-bar');
            if(bar){ bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');},340); }
            var ns=Math.round(16*fxi), i2;
            for(i2=0;i2<ns;i2++){(function(){
              var r=Math.random();
              var col=r<0.4?'#fbbf24':(r<0.75?'#f97316':'#dc2626');
              var sh=hbaFmEl('hba-fmchunk',ex,ey); sh.style.background='linear-gradient(135deg,'+col+',#7c2d12)'; sh.style.boxShadow='0 0 6px rgba(249,115,22,.85)';
              var a=-Math.PI/2+(Math.random()-.5)*2.6, dd=(34+Math.random()*56)*fxi, ddx=Math.cos(a)*dd, ddy=Math.sin(a)*dd, gy=Math.abs(ddy)*0.55+26+Math.random()*22, rot2=(Math.random()-.5)*540;
              try{sh.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+ddx+'px,'+ddy+'px) rotate('+(rot2*.5)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+(ddx*1.15)+'px,'+gy+'px) rotate('+rot2+'deg) scale(.6)',opacity:0}],{duration:560+Math.random()*220,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'});}catch(e){}
              rm(sh,860);
            })();}
            var nf=Math.round(8*fxi), f2;
            for(f2=0;f2<nf;f2++){(function(){
              var fs=Math.round((14+Math.random()*12)*sz);
              var fo=hbaFmEl('hba-fmflame',ex+(Math.random()-.5)*100-fs/2,ey-fs,fs,Math.round(fs*1.4));
              try{fo.animate([
                {transform:'scaleY(.3)',opacity:.95},
                {transform:'scaleY(1.1) translateY(-6px)',opacity:.9,offset:.4},
                {transform:'scaleY(.6) translateY(-16px)',opacity:0}
              ],{duration:560+Math.random()*240,easing:'ease-out',fill:'forwards'});}catch(e){}
              rm(fo,860);
            })();}
            var na=Math.round(9*fxi), a2;
            for(a2=0;a2<na;a2++){(function(k){setTimeout(function(){
              var aw=3+Math.random()*4, ah=3+Math.random()*4;
              var ash=hbaFmEl('hba-fmash',ex+(Math.random()-.5)*110,ey-26-Math.random()*24,aw,ah);
              var drift=(Math.random()-.5)*56, fall=40+Math.random()*40, rot3=(Math.random()-.5)*420;
              try{ash.animate([
                {transform:'translate(0,0) rotate(0deg)',opacity:0},
                {transform:'translate('+(drift*0.3)+'px,-'+(8+Math.random()*10)+'px) rotate('+(rot3*0.25)+'deg)',opacity:.95,offset:.2},
                {transform:'translate('+(drift*0.7)+'px,'+(fall*0.55)+'px) rotate('+(rot3*0.7)+'deg)',opacity:.85,offset:.7},
                {transform:'translate('+drift+'px,'+fall+'px) rotate('+rot3+'deg)',opacity:0}
              ],{duration:(1300+Math.random()*700)/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
              rm(ash,2100/sp);
            },k*70/sp);})(a2);}
            var vg=hbaFmEl('hba-fmvign',0,0); vg.style.left='0'; vg.style.top='0';
            try{vg.animate([{opacity:0},{opacity:.62,offset:.32},{opacity:0}],{duration:460/sp,easing:'ease-out',fill:'forwards'});}catch(e){} rm(vg,520/sp);
            deal();
          }
        }
        requestAnimationFrame(step);
      },220/sp);
    },2650/sp);
  }
  /* 🔴 v527: 雷电之主(Lv16·epic)天雷轰顶——Hansen 定稿: 苍雷蓝·规模140%·速度1.00x·雷霆强度160%。
     核心=树状分形闪电: 中点位移 hbaTlBoltPts(段长可控=硬折角) + 多级分叉 hbaTlTree(主干→一级支8条上密下收→二级细枝85%可双发·
     向下偏置17~40°·末梢渐细·端点钳位不入答题区)·白炽细芯+紧贴窄晕(锐度优先)·实时生成永不重复。
     主雷=return stroke 复闪(亮段65%暗隙短促)+130ms鬼影通道(通道跳动)+boss雷电之躯过载发光+云层回闪。
     四阶段: ①雷暴降临(积雨云tlin降入+云内预兆闪×3+三点蓄能: 左手雷球/右拳电弧/头冠=立绘招牌) ②万雷连击(n=min(7,round(5*fxi))道
     近垂直劈落血条·起点跟随命中点不斜穿立绘·1~N连) ③雷能汇聚(电丝两波+云核充能620ms) ④天罚主雷(三重电环+地弧爬行+火花·deal)+残余电弧滋滋。
     空间适配: 静电粒子只在战区带上飘·火花坠程钳位barBot+16·闪电分支端点钳位midY-6——答题区零侵犯。零震屏零屏闪(柔光vignette≤.62)。 */
  function hbaTlEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaTlR(a,b){return a+Math.random()*(b-a);}
  function hbaTlBoltPts(x1,y1,x2,y2,disp,minD){
    var pts=[[x1,y1],[x2,y2]],d=disp,md=minD||2.4;
    while(d>md){
      var np=[pts[0]];
      for(var i=0;i<pts.length-1;i++){
        var a=pts[i],b=pts[i+1];
        np.push([(a[0]+b[0])/2+(Math.random()*2-1)*d,(a[1]+b[1])/2+(Math.random()*2-1)*d*.5],b);
      }
      pts=np;d*=.5;
    }
    return pts;
  }
  function hbaTlPath(pts){var s='M'+pts[0][0].toFixed(1)+','+pts[0][1].toFixed(1);for(var i=1;i<pts.length;i++){s+='L'+pts[i][0].toFixed(1)+','+pts[i][1].toFixed(1);}return s;}
  function hbaTlTree(x1,y1,x2,y2,disp,forks,capY,vw){
    var paths=[],main=hbaTlBoltPts(x1,y1,x2,y2,disp,4.4);
    paths.push({pts:main,w:1,op:1});
    for(var f=0;f<forks;f++){
      var ti=Math.pow(Math.random(),1.45)*.66+.1;
      var i0=Math.floor(main.length*ti);
      var a=main[i0],nb=main[Math.min(i0+1,main.length-1)];
      var base=Math.atan2(nb[1]-a[1],nb[0]-a[0]);
      var ang=base+(Math.random()<.5?-1:1)*hbaTlR(.3,.7);
      if(Math.sin(ang)<.18)ang=base+(ang>base?1:-1)*hbaTlR(.3,.55);
      var remain=Math.hypot(x2-a[0],y2-a[1]);
      var len=remain*hbaTlR(.3,.52)*(1-ti*.4);
      var ex=Math.min(Math.max(a[0]+Math.cos(ang)*len,8),vw-8);
      var ey=Math.min(a[1]+Math.sin(ang)*len,capY);
      var sub=hbaTlBoltPts(a[0],a[1],ex,ey,disp*.6,3.2);
      paths.push({pts:sub,w:.5,op:.92});
      if(f===forks-1){ti=hbaTlR(.56,.76);i0=Math.floor(main.length*ti);a=main[i0];nb=main[Math.min(i0+1,main.length-1)];base=Math.atan2(nb[1]-a[1],nb[0]-a[0]);ang=base+(Math.random()<.5?-1:1)*hbaTlR(.4,.8);remain=Math.hypot(x2-a[0],y2-a[1]);len=remain*hbaTlR(.26,.4);ex=Math.min(Math.max(a[0]+Math.cos(ang)*len,8),vw-8);ey=Math.min(a[1]+Math.sin(ang)*len,capY);sub=hbaTlBoltPts(a[0],a[1],ex,ey,disp*.55,3.2);paths.push({pts:sub,w:.46,op:.9});}
      var n2=Math.random()<.85?(Math.random()<.45?2:1):0;
      for(var q=0;q<n2;q++){
        var j0=Math.floor(sub.length*hbaTlR(.28,.72));
        var b2=sub[j0],nb2=sub[Math.min(j0+1,sub.length-1)];
        var a2=Math.atan2(nb2[1]-b2[1],nb2[0]-b2[0])+(Math.random()<.5?-1:1)*hbaTlR(.28,.7);
        if(Math.sin(a2)<.12)a2+=.65;
        var l2=len*hbaTlR(.34,.56);
        var ex2=Math.min(Math.max(b2[0]+Math.cos(a2)*l2,8),vw-8);
        var ey2=Math.min(b2[1]+Math.sin(a2)*l2,capY);
        paths.push({pts:hbaTlBoltPts(b2[0],b2[1],ex2,ey2,disp*.34,2.6),w:.27,op:.82});
      }
    }
    return paths;
  }
  function hbaTlSvgBase(L,T,W,H,filt){
    var NS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('class','hba-tl-bolt');svg.setAttribute('width',W);svg.setAttribute('height',H);
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.style.left=L+'px';svg.style.top=T+'px';svg.style.filter=filt;
    return svg;
  }
  function hbaTlLayer(svg,d,w,col,op){var NS='http://www.w3.org/2000/svg';var ph=document.createElementNS(NS,'path');ph.setAttribute('d',d);ph.setAttribute('fill','none');ph.setAttribute('stroke',col);ph.setAttribute('stroke-width',Math.max(.7,w));ph.setAttribute('stroke-linejoin','round');ph.setAttribute('stroke-linecap','round');ph.setAttribute('opacity',op);svg.appendChild(ph);}
  function hbaTlBoltSvg(x1,y1,x2,y2,opt){ /* 简版(连击/蓄能小雷): 主干+浅分支 */
    var pad=46;
    var L=Math.min(x1,x2)-pad,T=Math.min(y1,y2)-pad,W=Math.abs(x2-x1)+pad*2,H=Math.abs(y2-y1)+pad*2;
    var main=hbaTlBoltPts(x1-L,y1-T,x2-L,y2-T,opt.disp);
    var paths=[{pts:main,k:1}];
    for(var b=0;b<opt.branches;b++){
      var i0=Math.floor(main.length*hbaTlR(.22,.62));
      var a=main[i0],nb=main[Math.min(i0+1,main.length-1)];
      var ang=Math.atan2(nb[1]-a[1],nb[0]-a[0])+(Math.random()<.5?-1:1)*hbaTlR(.5,1.05);
      var len=Math.hypot(x2-x1,y2-y1)*hbaTlR(.2,.36);
      paths.push({pts:hbaTlBoltPts(a[0],a[1],a[0]+Math.cos(ang)*len,a[1]+Math.sin(ang)*len,opt.disp*.5),k:.52});
    }
    var svg=hbaTlSvgBase(L,T,W,H,'drop-shadow(0 0 4px #38bdf8) drop-shadow(0 0 11px rgba(56,189,248,.75))');
    paths.forEach(function(o){
      var d=hbaTlPath(o.pts);
      hbaTlLayer(svg,d,opt.glow*o.k,'#0ea5e9',.3);
      hbaTlLayer(svg,d,opt.mid*o.k,'#38bdf8',.8);
      hbaTlLayer(svg,d,opt.core*o.k,'#ffffff',1);
    });
    (window.__hansenFxLayer||document.body).appendChild(svg);
    try{svg.animate([{opacity:0},{opacity:1,offset:.06},{opacity:.25,offset:.3},{opacity:1,offset:.46},{opacity:.15,offset:.68},{opacity:1,offset:.82},{opacity:0}],{duration:opt.life,easing:'linear',fill:'forwards'});}catch(e){}
    rm(svg,opt.life+80);
  }
  function hbaTlBoltTree(x1,y1,x2,y2,opt){ /* 树状(主雷/残余): 真闪电级多级分叉 */
    var pad=64,vw=window.innerWidth;
    var L=Math.min(x1,x2)-pad,T=Math.min(y1,y2)-pad,W=Math.abs(x2-x1)+pad*2,H=Math.abs(y2-y1)+pad*2;
    var paths=hbaTlTree(x1-L,y1-T,x2-L,y2-T,opt.disp,opt.forks,(opt.capY!=null?opt.capY:y2)-T,vw-L);
    var svg=hbaTlSvgBase(L,T,W,H,'drop-shadow(0 0 2.5px #bae6fd) drop-shadow(0 0 7px #38bdf8)');
    paths.forEach(function(o){
      var d=hbaTlPath(o.pts);
      hbaTlLayer(svg,d,opt.glow*o.w,'#0ea5e9',.18*o.op);
      hbaTlLayer(svg,d,opt.mid*o.w,'#38bdf8',.75*o.op);
      hbaTlLayer(svg,d,opt.core*o.w,'#ffffff',o.op);
    });
    (window.__hansenFxLayer||document.body).appendChild(svg);
    try{svg.animate([{opacity:0},{opacity:1,offset:.04},{opacity:1,offset:.16},{opacity:.3,offset:.21},{opacity:1,offset:.28},{opacity:1,offset:.46},{opacity:.22,offset:.52},{opacity:.96,offset:.6},{opacity:.9,offset:.74},{opacity:.32,offset:.84},{opacity:0}],{duration:opt.life,easing:'linear',fill:'forwards'});}catch(e){}
    rm(svg,opt.life+80);
  }
  function hbaTlVign(peak,ms){var v=hbaTlEl('hba-tl-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(56,189,248,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaTlRing(x,y,sz0,col,ms){var r=hbaTlEl('hba-tl-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaTlHit(x,y,szp,ms){var h=hbaTlEl('hba-tl-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#bae6fd 32%,rgba(56,189,248,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaTlSparks(x,y,n,pow,capY){
    for(var i=0;i<n;i++){
      var w=hbaTlR(2,3.4);
      var s=hbaTlEl('hba-tl-spark',x,y,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#38bdf8';s.style.boxShadow='0 0 6px #38bdf8';
      var ang=hbaTlR(0,Math.PI*2),v=hbaTlR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaTlR(8,22)+hbaTlR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaTlR(380,620),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,680);
    }
  }
  function hbaTlCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-tl-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaTlBarGlow(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaTlCloud(vw){
    var H=86;
    var box=hbaTlEl('hba-tl-cloud',null,null,null,H);
    var s='<svg width="'+vw+'" height="'+H+'" viewBox="0 0 '+vw+' '+H+'" xmlns="http://www.w3.org/2000/svg">';
    s+='<defs><radialGradient id="hbaTlGw" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bae6fd" stop-opacity=".95"/><stop offset="45%" stop-color="#38bdf8" stop-opacity=".5"/><stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/></radialGradient></defs>';
    s+='<rect x="0" y="-30" width="'+vw+'" height="64" fill="#0b1220"/>';
    var rows=[[16,17,'#16263f',7],[34,15,'#1e3a5f',8],[52,12,'#16263f',9]];
    for(var r0=0;r0<rows.length;r0++){
      var y=rows[r0][0],rr0=rows[r0][1],col=rows[r0][2],nn=rows[r0][3];
      for(var i=0;i<=nn;i++){var cx=vw*i/nn+hbaTlR(-9,9),rr=rr0*hbaTlR(.78,1.3);s+='<ellipse cx="'+cx.toFixed(1)+'" cy="'+(y+hbaTlR(-4,4)).toFixed(1)+'" rx="'+(rr*1.5).toFixed(1)+'" ry="'+rr.toFixed(1)+'" fill="'+col+'"/>';}
    }
    s+='<circle class="tl-lite tl-lite1" cx="'+(vw*.3)+'" cy="30" r="34" fill="url(#hbaTlGw)" opacity="0"/>';
    s+='<circle class="tl-lite tl-lite2" cx="'+(vw*.72)+'" cy="38" r="30" fill="url(#hbaTlGw)" opacity="0"/>';
    s+='<circle class="tl-core" cx="'+(vw*.5)+'" cy="40" r="13" fill="url(#hbaTlGw)" opacity="0"/>';
    s+='</svg>';
    box.innerHTML=s;
    requestAnimationFrame(function(){box.classList.add('tlin');});
    return box;
  }
  function hbaTlOmen(cloud,idx,dur){if(!cloud)return;var c=cloud.querySelector('.tl-lite'+(idx%2+1));if(!c)return;
    try{c.animate([{opacity:0},{opacity:.9,offset:.18},{opacity:.2,offset:.42},{opacity:.75,offset:.6},{opacity:0}],{duration:dur,easing:'linear'});}catch(e){}}
  function hbaTlCharge(bx,by,bsTop,bw,sz,sp){
    var pts=[{x:bx-bw*.30,y:by-bw*.07,r:30*sz,main:1},{x:bx+bw*.30,y:by+bw*.03,r:20*sz},{x:bx,y:bsTop+bw*.05,r:16*sz}];
    pts.forEach(function(o,i){setTimeout(function(){
      var c=hbaTlEl('hba-tl-charge',o.x-o.r/2,o.y-o.r/2,o.r,o.r);
      c.style.background='radial-gradient(circle at 42% 38%,#ffffff 0%,#bae6fd 30%,rgba(56,189,248,.55) 62%,transparent 80%)';
      c.style.boxShadow='0 0 14px rgba(56,189,248,.9), 0 0 30px rgba(56,189,248,.5)';
      try{c.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.18)',opacity:1,offset:.55},{transform:'scale(1)',opacity:.95}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.4,1.2)',fill:'forwards'});
      c.animate([{filter:'brightness(1)'},{filter:'brightness(1.5)'},{filter:'brightness(1)'}],{duration:520/sp,iterations:3,delay:340/sp});}catch(e){}
      rm(c,1500/sp);
      if(o.main){hbaTlBoltSvg(o.x,o.y,o.x+hbaTlR(-22,22),o.y+hbaTlR(18,30),{core:1.6,mid:3,glow:6,disp:7,branches:1,life:300/sp});}
    },i*120/sp);});
  }
  function hbaTlThreads(vw,midY,sp,n){
    var tx=vw*.5,ty=46;
    for(var i=0;i<n;i++){(function(i){setTimeout(function(){
      var ang=i/n*Math.PI*2+hbaTlR(-.2,.2),rr=hbaTlR(vw*.34,vw*.5);
      var x=tx+Math.cos(ang)*rr,y=Math.max(14,Math.min(midY-26,ty+Math.sin(ang)*rr*.8));
      var L=Math.hypot(tx-x,ty-y);
      var t=hbaTlEl('hba-tl-thread',x,y,L,2);
      t.style.background='linear-gradient(90deg,transparent,#bae6fd 60%,#ffffff)';
      t.style.transformOrigin='0 50%';t.style.boxShadow='0 0 5px #38bdf8';
      var rot=Math.atan2(ty-y,tx-x);
      t.style.transform='rotate('+rot+'rad) scaleX(0)';
      try{t.animate([{transform:'rotate('+rot+'rad) scaleX(0)',opacity:.2},{transform:'rotate('+rot+'rad) scaleX(1)',opacity:1,offset:.7},{transform:'rotate('+rot+'rad) scaleX(1)',opacity:0}],{duration:320/sp,easing:'cubic-bezier(.4,0,.7,1)'});}catch(e){}
      rm(t,360/sp);
    },i*46/sp);})(i);}
  }
  function hbaTlGroundArcs(hx,barL,barW,midY,vw,sp){
    [-1,1].forEach(function(dir){
      var x1=hx,x2=dir<0?Math.max(barL-4,8):Math.min(barL+barW+4,vw-8);
      var y=midY+5;
      var pts=hbaTlBoltPts(x1,y,x2,y+hbaTlR(-3,3),5);
      var pad=14;
      var L=Math.min(x1,x2)-pad,T=y-pad-8,W=Math.abs(x2-x1)+pad*2,H=34;
      var svg=hbaTlSvgBase(L,T,W,H,'drop-shadow(0 0 4px #38bdf8)');
      svg.setAttribute('class','hba-tl-arc');
      var d=hbaTlPath(pts.map(function(q){return [q[0]-L,q[1]-T];}));
      [[5,'#0ea5e9',.3],[2.6,'#38bdf8',.85],[1.3,'#ffffff',1]].forEach(function(ly){
        var NS='http://www.w3.org/2000/svg';
        var ph=document.createElementNS(NS,'path');ph.setAttribute('d',d);ph.setAttribute('fill','none');
        ph.setAttribute('stroke',ly[1]);ph.setAttribute('stroke-width',ly[0]);ph.setAttribute('opacity',ly[2]);
        ph.setAttribute('stroke-linejoin','round');ph.setAttribute('stroke-dasharray','620');ph.setAttribute('stroke-dashoffset','620');
        svg.appendChild(ph);
        try{ph.animate([{strokeDashoffset:620},{strokeDashoffset:0}],{duration:300/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
      });
      (window.__hansenFxLayer||document.body).appendChild(svg);
      try{svg.animate([{opacity:1},{opacity:1,offset:.55},{opacity:.3,offset:.75},{opacity:.9,offset:.85},{opacity:0}],{duration:560/sp,fill:'forwards'});}catch(e){}
      rm(svg,620/sp);
    });
  }
  // 🔴 v560: 雷电之主(Lv16)二代乌云+真雷电(Hansen 提供 1024×1536 真实分形闪电素材, DEMO 验收过关后融入)。
  //   ①新乌云 hbaTlCloud2: 噪声真实云(feTurbulence fractalNoise 撕碎边缘)×四层(顶层碎云/背/中/前)+顶部近黑压暗+底缘环境光亮边(青调, 体积感关键)+下垂云须+三速缓慢翻滚——好莱坞雷暴感, 彻底告别 2D flash 椭圆排。
  //     兼容老接口: 保留 .tl-lite1/.tl-lite2/.tl-core 同名类供 hbaTlOmen/雷能汇聚直接驱动。老 hbaTlCloud 保留勿删(v528 先例)。
  //   ②④段天罚主雷换 Hansen 真雷电图: 几何精确对位——顶端贴云底(实测 rect), 底端正好劈到血条(+14 咬入); 真实频闪三连(主闪→灭→镜像回闪换姿态→灭→余闪);
  //     空气辉光大范围照亮(局部径向, 非全屏 tint)+原命中全家桶(Vign/Hit/Ring×3/GroundArcs/Sparks/BarGlow)原时序保留→deal 时刻不变(dealDelay 3700 不动)。
  //   🔴 铁律(DEMO 血案): 大尺寸 PNG 严禁 drop-shadow——headless/手机合成器渲染黑洞, opacity 0.96 整层被丢肉眼全不可见; 发光由素材自带辉光+空气辉光承担。
  function hbaTlCloud2(vw){
    var H=140;
    var box=hbaTlEl('hba-tl2-cloud',null,null,null,H);
    var s='<svg width="'+vw+'" height="'+H+'" viewBox="0 0 420 140" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">';
    s+='<defs>';
    s+='<filter id="hbaTl2Tb1" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.013 0.028" numOctaves="4" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="30" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation="1.1"/></filter>';
    s+='<filter id="hbaTl2Tb2" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.017 0.034" numOctaves="4" seed="23" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="25" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".9"/></filter>';
    s+='<filter id="hbaTl2Tb3" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.022 0.045" numOctaves="3" seed="41" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".7"/></filter>';
    s+='<filter id="hbaTl2Tb4" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.06" numOctaves="3" seed="63" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/><feGaussianBlur stdDeviation=".6"/></filter>';
    s+='<linearGradient id="hbaTl2cb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#070d18"/><stop offset="55%" stop-color="#141e32"/><stop offset="100%" stop-color="#26344c"/></linearGradient>';
    s+='<linearGradient id="hbaTl2cm" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#101a2c"/><stop offset="60%" stop-color="#20304a"/><stop offset="100%" stop-color="#374a68"/></linearGradient>';
    s+='<linearGradient id="hbaTl2cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#17233a"/><stop offset="55%" stop-color="#2f4163"/><stop offset="100%" stop-color="#586e94"/></linearGradient>';
    s+='<linearGradient id="hbaTl2ce" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b5375"/><stop offset="100%" stop-color="#7da7c4"/></linearGradient>';
    s+='<radialGradient id="hbaTl2gw" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#bfe8ff" stop-opacity=".95"/><stop offset="40%" stop-color="#60b9f5" stop-opacity=".55"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>';
    s+='</defs>';
    s+='<rect x="-20" y="-20" width="460" height="80" fill="#060b14"/>';
    /* 云内电光(埋云层间, 透光; 类名兼容 hbaTlOmen) */
    s+='<circle class="tl-lite tl-lite1" cx="120" cy="52" r="48" fill="url(#hbaTl2gw)" opacity="0"/>';
    s+='<circle class="tl-lite tl-lite2" cx="300" cy="48" r="42" fill="url(#hbaTl2gw)" opacity="0"/>';
    s+='<circle class="tl-core" cx="210" cy="64" r="13" fill="url(#hbaTl2gw)" opacity="0"/>';
    /* 顶层碎云(最暗最远) */
    s+='<g class="tl2-back" filter="url(#hbaTl2Tb1)">';
    s+='<ellipse cx="55" cy="34" rx="110" ry="38" fill="url(#hbaTl2cb)"/><ellipse cx="208" cy="27" rx="140" ry="42" fill="url(#hbaTl2cb)"/><ellipse cx="368" cy="36" rx="120" ry="40" fill="url(#hbaTl2cb)"/>';
    s+='</g>';
    /* 中层云 */
    s+='<g class="tl2-mid" filter="url(#hbaTl2Tb2)">';
    s+='<ellipse cx="28" cy="56" rx="98" ry="34" fill="url(#hbaTl2cm)"/><ellipse cx="158" cy="52" rx="110" ry="37" fill="url(#hbaTl2cm)"/><ellipse cx="288" cy="56" rx="104" ry="35" fill="url(#hbaTl2cm)"/><ellipse cx="402" cy="50" rx="92" ry="34" fill="url(#hbaTl2cm)"/>';
    s+='</g>';
    /* 前层云(底缘下垂云须) */
    s+='<g class="tl2-front" filter="url(#hbaTl2Tb3)">';
    s+='<ellipse cx="68" cy="76" rx="86" ry="29" fill="url(#hbaTl2cf)"/><ellipse cx="184" cy="81" rx="92" ry="31" fill="url(#hbaTl2cf)"/><ellipse cx="298" cy="76" rx="84" ry="29" fill="url(#hbaTl2cf)"/><ellipse cx="394" cy="80" rx="74" ry="27" fill="url(#hbaTl2cf)"/>';
    s+='<ellipse cx="118" cy="98" rx="32" ry="14" fill="url(#hbaTl2cf)"/><ellipse cx="230" cy="104" rx="38" ry="16" fill="url(#hbaTl2cf)"/><ellipse cx="328" cy="98" rx="28" ry="13" fill="url(#hbaTl2cf)"/><ellipse cx="52" cy="94" rx="24" ry="12" fill="url(#hbaTl2cf)"/>';
    s+='</g>';
    /* 底缘亮边: 环境光照亮的云底(青调·体积感关键) */
    s+='<g class="tl2-front" filter="url(#hbaTl2Tb4)" opacity=".48">';
    s+='<ellipse cx="98" cy="90" rx="54" ry="8" fill="url(#hbaTl2ce)"/><ellipse cx="222" cy="96" rx="62" ry="9" fill="url(#hbaTl2ce)"/><ellipse cx="338" cy="90" rx="48" ry="8" fill="url(#hbaTl2ce)"/>';
    s+='</g>';
    s+='</svg>';
    box.innerHTML=s;
    requestAnimationFrame(function(){box.classList.add('tl2in');});
    return box;
  }
  // 真雷电频闪三连(几何: 云底→血条)。返回主闪到位时刻偏移(ms, 未除 sp)。
  function hbaTl2RealBolt(cloud, hx, midY, sz, sp){
    var vw=window.innerWidth;
    var im=window.__hbaTl2BoltImg;
    var cloudBottom=104;
    if(cloud){ try{ var cr=cloud.getBoundingClientRect(); cloudBottom=cr.top+cr.height*0.72; }catch(e){} }
    var BH=Math.max(120,(midY-cloudBottom+30));
    var BW=BH*(640/960)*Math.max(.8,Math.min(sz,1.4));
    var maxW=vw*0.96; if(BW>maxW)BW=maxW;
    var holder=document.createElement('div');
    holder.className='hba-tl2-bolt';
    holder.style.left=(hx-BW/2)+'px'; holder.style.top=cloudBottom+'px';
    holder.style.width=BW+'px'; holder.style.height=BH+'px';
    var img=(im&&im.complete&&im.naturalWidth>0)?im.cloneNode(false):new Image();
    if(!img.src)img.src='bosses/tl_bolt.webp?v=908';
    img.draggable=false; img.alt='';
    holder.appendChild(img);
    (window.__hansenFxLayer||document.body).appendChild(holder);
    /* 空气辉光: 局部大范围照亮(非全屏 tint) */
    var gw=Math.max(BW*1.7, vw*0.9), gh=BH*1.25;
    var glow=document.createElement('div');
    glow.className='hba-tl2-airglow';
    glow.style.left=(hx-gw/2)+'px'; glow.style.top=(cloudBottom-gh*0.08)+'px';
    glow.style.width=gw+'px'; glow.style.height=gh+'px';
    (window.__hansenFxLayer||document.body).appendChild(glow);
    try{ glow.animate([{opacity:0},{opacity:.9,offset:.06},{opacity:.15,offset:.3},{opacity:.7,offset:.44},{opacity:.1,offset:.62},{opacity:.45,offset:.74},{opacity:0}],{duration:640/sp,easing:'linear',fill:'forwards'}); }catch(e){}
    /* 频闪三连: 主闪→灭→镜像回闪→灭→余闪 */
    try{ holder.animate([
      {opacity:0,transform:'scaleX(1)'},
      {opacity:1,transform:'scaleX(1)',offset:.04},
      {opacity:1,transform:'scaleX(1)',offset:.18},
      {opacity:0,transform:'scaleX(1)',offset:.24},
      {opacity:0,transform:'scaleX(-1)',offset:.3},
      {opacity:.95,transform:'scaleX(-1)',offset:.36},
      {opacity:.95,transform:'scaleX(-1)',offset:.5},
      {opacity:0,transform:'scaleX(-1)',offset:.56},
      {opacity:0,transform:'scaleX(1)',offset:.64},
      {opacity:.6,transform:'scaleX(1)',offset:.7},
      {opacity:0,transform:'scaleX(1)',offset:.88},
      {opacity:0,transform:'scaleX(1)'}
    ],{duration:640/sp,easing:'linear',fill:'forwards'}); }catch(e){}
    rm(holder,720/sp); rm(glow,720/sp);
  }

  function hbaThunderLord(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:192, bw=br?Math.max(br.width,120):150, bsTop=br?br.top:117;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    /* ① 雷暴降临 */
    var dome=hbaTlEl('hba-tl-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},4350/sp);rm(dome,5100/sp);
    var cloud=hbaTlCloud2(vw);   // 🔴 v560: 二代噪声真实乌云(老 hbaTlCloud 保留勿删)
    setTimeout(function(){hbaTlOmen(cloud,0,420/sp);},260/sp);
    setTimeout(function(){hbaTlOmen(cloud,1,380/sp);},560/sp);
    setTimeout(function(){hbaTlOmen(cloud,0,340/sp);},880/sp);
    setTimeout(function(){hbaTlCharge(bx,by,bsTop,bw,sz,sp);},460/sp);
    var moteIv=setInterval(function(){
      var w=hbaTlR(2,3.2);
      var m=hbaTlEl('hba-tl-mote',hbaTlR(14,vw-14),midY+hbaTlR(-18,4),w,w);
      m.style.background='#bae6fd';m.style.boxShadow='0 0 6px #38bdf8';
      try{m.animate([{transform:'translate(0,0)',opacity:0},{opacity:.9,offset:.18},{transform:'translate('+hbaTlR(-12,12)+'px,'+(-hbaTlR(64,118))+'px)',opacity:0}],{duration:hbaTlR(1100,1700)/sp,easing:'linear'});}catch(e){}
      rm(m,1800/sp);
    },120);
    setTimeout(function(){clearInterval(moteIv);},3400/sp);
    /* ② 万雷连击 */
    var n=Math.max(3,Math.round(5*fxi)); if(n>7)n=7;
    var slots=[.18,.34,.5,.66,.82];
    for(var k=0;k<n;k++){(function(k){setTimeout(function(){
      var tx=barL+barW*(n<=5?slots[k%5]:(0.12+0.76*k/(n-1)));
      var sx=Math.min(Math.max(tx+hbaTlR(-34,34),12),vw-12),sy=hbaTlR(60,80);
      hbaTlBoltSvg(sx,sy,tx,midY-2,{core:2.1,mid:4.6,glow:9,disp:Math.max(10,(midY-sy)*.08)*sz,branches:2+(Math.random()<.5?1:0),life:340/sp});
      hbaTlOmen(cloud,k,260/sp);
      setTimeout(function(){
        hbaTlHit(tx,midY,40*sz,260/sp);hbaTlRing(tx,midY,32*sz,'#38bdf8',300/sp);
        hbaTlSparks(tx,midY,Math.round(6*fxi),.85,barBot+16);hbaTlBarGlow(120);hbaTlCombo(k+1,tx,midY,vw);
      },60/sp);
    },(1150+k*170)/sp);})(k);}
    var lastHit=(1150+(n-1)*170+70)/sp;
    /* ③ 雷能汇聚 */
    setTimeout(function(){
      hbaTlThreads(vw,midY,sp,8);
      setTimeout(function(){hbaTlThreads(vw,midY,sp,6);},340/sp);
      var core=cloud?cloud.querySelector('.tl-core'):null;
      if(core){try{core.animate([{opacity:0},{opacity:1}],{duration:300/sp,fill:'forwards'});
        core.animate([{r:13},{r:24}],{duration:620/sp,fill:'forwards'});}catch(e){try{core.setAttribute('opacity',1);core.setAttribute('r',22);}catch(e2){}}}
      hbaTlCharge(bx,by,bsTop,bw,sz*0.7,sp);
    },lastHit+180/sp);
    /* ④ 天罚主雷 */
    var mainT=lastHit+(180+850)/sp;
    setTimeout(function(){
      // 🔴 v560: 天罚主雷换 Hansen 真雷电图(频闪三连+空气辉光); 老 hbaTlBoltTree 程序闪电保留(残余小弧仍在用)
      hbaTl2RealBolt(cloud, hx, midY, sz, sp);
      if(cloud){try{cloud.animate([{filter:'brightness(1)'},{filter:'brightness(2.1)'},{filter:'brightness(1)',offset:.4},{filter:'brightness(1.7)',offset:.55},{filter:'brightness(1)'}],{duration:760/sp});}catch(e){}}
      if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 30px rgba(56,189,248,.95)) brightness(1.55)',offset:.18},{filter:'drop-shadow(0 0 18px rgba(56,189,248,.5)) brightness(1.1)',offset:.5},{filter:'drop-shadow(0 0 26px rgba(56,189,248,.8)) brightness(1.4)',offset:.66},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
      setTimeout(function(){
        hbaTlVign(.62,560/sp);
        hbaTlHit(hx,midY,84*sz*fxi,340/sp);
        hbaTlRing(hx,midY,44*sz,'#e0f2fe',340/sp);
        setTimeout(function(){hbaTlRing(hx,midY,64*sz,'#38bdf8',360/sp);},90/sp);
        setTimeout(function(){hbaTlRing(hx,midY,86*sz,'#38bdf8',380/sp);},180/sp);
        hbaTlGroundArcs(hx,barL,barW,midY,vw,sp);
        hbaTlSparks(hx,midY,Math.round(16*fxi),1.25,barBot+16);
        hbaTlBarGlow(340);
        deal();
      },110/sp);
      setTimeout(function(){
        [0,1].forEach(function(i){setTimeout(function(){
          hbaTlBoltTree(hx+hbaTlR(-26,26)*sz,midY-hbaTlR(10,22),hx+hbaTlR(-30,30)*sz,midY+4,{core:1.2,mid:2.4,glow:4.5,disp:6,forks:2,life:260/sp,capY:midY+6});
        },i*180/sp);});
      },760/sp);
    },mainT);
    /* 收场 */
    setTimeout(function(){if(cloud){cloud.classList.remove('tl2in');cloud.classList.remove('tlin');rm(cloud,560);}},4450/sp);
  }
  /* 🔴 v528: 机械泰坦(Lv17·legendary)歼灭协议·泰坦终结斩+天降流星拳——Hansen 定稿: 猩红警戒·规模100%·速度1.00x·火力强度100%。
     四阶段(全英文机械音台词=分镜): ①SYSTEM ONLINE(HUD角标+状态格+扫描线+六边形网格+全息启动环+双眼觉醒lens flare+机体灯×4+双肩排气)
     ②TARGET LOCKED(雷达扇扫1.5圈+准星搜索飞抵+锁定框三段吸附"咔咔咔"咬死血条+确认爆闪+警告三角×4+双眼双测距线)
     ③武器过载(能量回路胸口→剑柄光点×3+剑刃过载充能贴立绘+剑尖聚能+盾核心/胸口核心+地面能量波)
     ④TERMINATING: 剑气三连斩(月牙弧刃110px白锋描边+滞后残影=速度感·命中全屏刀光掠上半屏+斜切闪+电环+火花1~3连)
       →终结·天降流星拳: boss过载+胸核暴亮+落点警告标记(红圈+▼跳动)→机械巨拳(复用__hbaFistImg·BUG#67预加载链路·FH150)
       流星坠落(rAF·陨石曲线tt=t*t*.6+t*.4·前缘贴指节摩擦火焰脉动+长焰尾+双侧火舌+沿途火星/速度线)
       →砸击巨爆(反弹8px+爆闪96+三重环+地面冲击波两侧横扫+地裂×4+火焰飞溅8团+火星18+金属碎片7+烟尘横涌+deal≈4600ms)
       →拳头停留280ms向上抽离+尾火星→歼灭确认白角括号外弹→残余火苗×3+烟缕。
     空间适配: 全屏刀光只扫midY-48以上·地裂限角±10°·火焰/火星/碎片坠程钳位barBot+16——答题区零侵犯。零震屏零屏闪(柔光≤.62)。 */
  function hbaMtEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaMtR(a,b){return a+Math.random()*(b-a);}
  function hbaMtVign(peak,ms){var v=hbaMtEl('hba-mt-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(244,63,94,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaMtRing(x,y,sz0,col,ms){var r=hbaMtEl('hba-mt-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaMtHit(x,y,szp,ms){var h=hbaMtEl('hba-mt-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#fda4af 32%,rgba(244,63,94,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaMtSparks(x,y,n,pow,capY){
    for(var i=0;i<n;i++){
      var w=hbaMtR(2,3.4);
      var s=hbaMtEl('hba-mt-spark',x,y,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#f43f5e';s.style.boxShadow='0 0 6px #f43f5e';
      var ang=hbaMtR(0,Math.PI*2),v=hbaMtR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaMtR(8,22)+hbaMtR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaMtR(380,620),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,680);
    }
  }
  function hbaMtShrap(x,y,n,capY){
    for(var i=0;i<n;i++){var w=hbaMtR(3,6),h=hbaMtR(2,3.5);
      var s=hbaMtEl('hba-mt-shrap',x,y,w,h);
      s.style.background='linear-gradient(135deg,#cbd5e1,#64748b)';s.style.boxShadow='0 0 3px rgba(203,213,225,.6)';
      var ang=hbaMtR(-2.6,-0.5),v=hbaMtR(30,64),dx=Math.cos(ang)*v*hbaMtR(.8,1.4),dy=Math.sin(ang)*v+hbaMtR(40,70);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) rotate('+hbaMtR(-540,540)+'deg)',opacity:0}],{duration:hbaMtR(460,700),easing:'cubic-bezier(.3,.5,.6,1)'});}catch(e){}
      rm(s,760);
    }
  }
  function hbaMtCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-mt-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaMtBarGlow(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaMtFlame(x,y,w,life){
    var f=hbaMtEl('hba-mt-flame',x-w/2,y-w*1.4,w,w*1.4);
    f.style.background='linear-gradient(180deg,#fda4af 0%,#f43f5e 45%,rgba(244,63,94,.5) 80%,transparent)';
    f.style.boxShadow='0 0 8px rgba(244,63,94,.6)';
    try{f.animate([{transform:'scaleY(.3)',opacity:0},{transform:'scaleY(1.1)',opacity:.95,offset:.3},{transform:'scaleY(.85)',opacity:.8,offset:.6},{transform:'scaleY(.2)',opacity:0}],{duration:life,easing:'ease-in-out'});}catch(e){}
    rm(f,life+60);
  }
  function hbaMtSmoke(x,y,sp){
    for(var i=0;i<4;i++){(function(i){setTimeout(function(){
      var w=hbaMtR(8,14);
      var s=hbaMtEl('hba-mt-smoke',x+hbaMtR(-16,16),y,w,w);
      s.style.background='radial-gradient(circle,rgba(148,163,184,.6),rgba(100,116,139,.25) 60%,transparent 80%)';
      try{s.animate([{transform:'translate(0,0) scale(.6)',opacity:.7},{transform:'translate('+hbaMtR(-14,14)+'px,'+(-hbaMtR(40,72))+'px) scale(1.8)',opacity:0}],{duration:hbaMtR(700,1100)/sp,easing:'ease-out'});}catch(e){}
      rm(s,1200/sp);
    },i*130/sp);})(i);}
  }
  function hbaMtCut(x,y,len,deg){
    var c=hbaMtEl('hba-mt-cut',x-len/2,y,len,null);
    c.style.background='linear-gradient(90deg,transparent,#ffffff 30%,#ffffff 70%,transparent)';
    c.style.boxShadow='0 0 8px #fda4af';
    c.style.transform='rotate('+deg+'deg) scaleX(.1)';
    try{c.animate([{transform:'rotate('+deg+'deg) scaleX(.1)',opacity:1},{transform:'rotate('+deg+'deg) scaleX(1)',opacity:1,offset:.4},{transform:'rotate('+deg+'deg) scaleX(1)',opacity:0}],{duration:240,easing:'ease-out'});}catch(e){}
    rm(c,300);
  }
  function hbaMtSSlash(hx,vw,deg,cy,sp){
    var L=vw*1.35;
    var c=hbaMtEl('hba-mt-sslash',hx-L/2,cy,L,null);
    c.style.background='linear-gradient(90deg,transparent,#fda4af 30%,#ffffff 50%,#fda4af 70%,transparent)';
    c.style.boxShadow='0 0 10px #fda4af, 0 0 24px rgba(244,63,94,.5)';
    c.style.transform='rotate('+deg+'deg) scaleX(.04)';
    try{c.animate([{transform:'rotate('+deg+'deg) scaleX(.04)',opacity:1},{transform:'rotate('+deg+'deg) scaleX(1)',opacity:1,offset:.42},{transform:'rotate('+deg+'deg) scaleX(1)',opacity:0}],{duration:230/sp,easing:'cubic-bezier(.2,.7,.3,1)'});}catch(e){}
    rm(c,300/sp);
  }
  function hbaMtGShock(hx,barL,barW,midY,vw,sz,sp){
    [[-1,'100% 50%'],[1,'0 50%']].forEach(function(d){
      var w=d[0]<0?(hx-8):(vw-hx-8);
      var s=hbaMtEl('hba-mt-gshock',d[0]<0?(hx-w):hx,midY+4,w,null);
      s.style.transformOrigin=d[1];
      s.style.background=d[0]<0?'linear-gradient(90deg,transparent,#f43f5e 60%,#ffffff)':'linear-gradient(90deg,#ffffff,#f43f5e 40%,transparent)';
      s.style.boxShadow='0 0 10px rgba(244,63,94,.7)';
      try{s.animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(1)',opacity:.95,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}
      rm(s,400/sp);
    });
    for(var i=0;i<4;i++){
      var ang=(Math.random()<.5?-1:1)*hbaMtR(.06,.17), len=hbaMtR(34,56);
      var rot2=ang+(Math.random()<.5?Math.PI:0);
      var c2=hbaMtEl('hba-mt-crackln',hx,midY+5,len,null);
      c2.style.background='linear-gradient(90deg,#fda4af,transparent)';c2.style.boxShadow='0 0 4px rgba(244,63,94,.6)';
      c2.style.transform='rotate('+rot2+'rad) scaleX(0)';
      try{c2.animate([{transform:'rotate('+rot2+'rad) scaleX(0)',opacity:1},{transform:'rotate('+rot2+'rad) scaleX(1)',opacity:.9,offset:.4},{opacity:0}],{duration:hbaMtR(380,520)/sp});}catch(e){}
      rm(c2,580/sp);
    }
  }
  function hbaMtCrescent(W,H,heavy){
    var id='hbamtg'+Math.floor(Math.random()*1e6);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0%" stop-color="#ffffff"/><stop offset="42%" stop-color="#fda4af"/><stop offset="78%" stop-color="#f43f5e" stop-opacity=".85"/><stop offset="100%" stop-color="#be123c" stop-opacity="0"/></linearGradient></defs>'
      +'<path d="M 3,'+(H*0.62)+' Q '+(W*0.5)+','+(-H*0.52)+' '+(W-3)+','+(H*0.62)+' Q '+(W*0.5)+','+(H*0.38)+' 3,'+(H*0.62)+' Z" fill="url(#'+id+')" stroke="#ffffff" stroke-width="'+(heavy?2:1.3)+'" stroke-opacity=".9"/></svg>';
  }
  function hbaMtHud(vw,ms){
    [[8,58,'borderLeft','borderTop'],[vw-34,58,'borderRight','borderTop']].forEach(function(c){
      var d=hbaMtEl('hba-mt-corner',c[0],c[1]);
      d.style[c[2]]='2.5px solid #f87171';d.style[c[3]]='2.5px solid #f87171';
      d.style.boxShadow='0 0 8px rgba(248,113,113,.5)';
      try{d.animate([{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.92},{opacity:0}],{duration:ms,fill:'forwards'});}catch(e){}
      rm(d,ms+80);
    });
    var sb=hbaMtEl('hba-mt-statbar');sb.style.top='52px';
    for(var i=0;i<7;i++){var b=document.createElement('i');b.style.background='#f87171';b.style.opacity=.25;
      try{b.animate([{opacity:.15},{opacity:1},{opacity:.15}],{duration:hbaMtR(380,720),iterations:Infinity});}catch(e){}
      sb.appendChild(b);}
    try{sb.animate([{opacity:0},{opacity:.92,offset:.15},{opacity:.92,offset:.92},{opacity:0}],{duration:ms,fill:'forwards'});}catch(e){}
    rm(sb,ms+80);
  }
  function hbaMtScan(midY,sp){
    var s=hbaMtEl('hba-mt-scan',null,0);
    s.style.background='linear-gradient(90deg,transparent,#f87171 30%,#ffffff 50%,#f87171 70%,transparent)';
    s.style.boxShadow='0 0 10px rgba(248,113,113,.8), 0 6px 18px rgba(248,113,113,.25)';
    try{s.animate([{transform:'translateY(0)',opacity:0},{opacity:1,offset:.08},{opacity:1,offset:.88},{transform:'translateY('+(midY+30)+'px)',opacity:0}],{duration:620/sp,easing:'cubic-bezier(.3,.1,.6,.9)'});}catch(e){}
    rm(s,700/sp);
  }
  function hbaMtEyes(bsEl,bx,by,bw,bh,sp){
    [[-0.035,-0.275],[0.035,-0.275]].forEach(function(o,i){setTimeout(function(){
      var x=bx+bw*o[0], y=by+bh*o[1], r=13;
      var fl=hbaMtEl('hba-mt-cut',x-16,y-0.75,32,null);
      fl.style.height='1.5px';
      fl.style.background='linear-gradient(90deg,transparent,#ffffff 50%,transparent)';fl.style.boxShadow='0 0 6px #fda4af';
      try{fl.animate([{transform:'scaleX(.1)',opacity:0},{transform:'scaleX(1)',opacity:1,offset:.4},{transform:'scaleX(1.15)',opacity:0}],{duration:420/sp,easing:'ease-out'});}catch(e){}
      rm(fl,480/sp);
      var e2=hbaMtEl('hba-mt-eye',x-r/2,y-r/2,r,r);
      e2.style.background='radial-gradient(circle,#ffffff 0%,#fda4af 38%,rgba(244,63,94,.55) 65%,transparent 80%)';
      e2.style.boxShadow='0 0 10px rgba(244,63,94,.95), 0 0 22px rgba(244,63,94,.5)';
      try{e2.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.5)',opacity:1,offset:.3},{transform:'scale(1)',opacity:.95,offset:.5},{transform:'scale(1)',opacity:.9}],{duration:2600/sp,fill:'forwards'});}catch(e){}
      rm(e2,2700/sp);
    },i*90/sp);});
    if(bsEl){try{bsEl.animate([{filter:'brightness(.72)'},{filter:'brightness(1.12) drop-shadow(0 0 16px rgba(244,63,94,.4))',offset:.3},{filter:'brightness(.92)',offset:.45},{filter:'brightness(1.06) drop-shadow(0 0 14px rgba(244,63,94,.35))',offset:.62},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
  }
  function hbaMtLamps(bx,by,bw,bh,sp){
    [[-0.30,-0.18],[0.30,-0.10],[-0.01,-0.115],[0.27,0.12]].forEach(function(o,i){setTimeout(function(){
      var l=hbaMtEl('hba-mt-lamp',bx+bw*o[0]-3,by+bh*o[1]-3,6,6);
      l.style.background='#fda4af';l.style.boxShadow='0 0 7px rgba(244,63,94,.9)';
      rm(l,2200/sp);
    },(180+i*130)/sp);});
  }
  function hbaMtSteam(bx,by,bw,bh,sp){
    [[-0.42,-0.16,-1],[0.42,-0.2,1]].forEach(function(s0){
      for(var i=0;i<4;i++){(function(i){setTimeout(function(){
        var w=hbaMtR(7,12);
        var st=hbaMtEl('hba-mt-steam',bx+bw*s0[0],by+bh*s0[1],w,w);
        st.style.background='radial-gradient(circle,rgba(226,232,240,.85),rgba(148,163,184,.3) 60%,transparent 80%)';
        try{st.animate([{transform:'translate(0,0) scale(.5)',opacity:.85},{transform:'translate('+(s0[2]*hbaMtR(26,46))+'px,'+(-hbaMtR(10,22))+'px) scale(1.6)',opacity:0}],{duration:hbaMtR(480,720)/sp,easing:'ease-out'});}catch(e){}
        rm(st,800/sp);
      },i*90/sp);})(i);}
    });
  }
  function hbaMtHolo(bx,by,bw,bh,sp){
    var D=Math.round(bw*1.22), cy=by+bh*0.46;
    var h=hbaMtEl('hba-mt-holo',bx,cy,D,Math.round(D*0.34));
    var tick='';
    for(var i=0;i<24;i++){var a=i/24*360;tick+='<line x1="50" y1="3.5" x2="50" y2="7" stroke="#f87171" stroke-width="1" transform="rotate('+a+' 50 50)" opacity=".8"/>';}
    h.innerHTML='<svg width="'+D+'" height="'+Math.round(D*0.34)+'" viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="46" fill="none" stroke="#f87171" stroke-width="1.4" stroke-dasharray="9 5" opacity=".85"/>'
      +'<circle cx="50" cy="50" r="38" fill="none" stroke="rgba(248,113,113,.5)" stroke-width="1" stroke-dasharray="3 6"/>'
      +'<g>'+tick+'</g></svg>';
    h.style.filter='drop-shadow(0 0 6px rgba(248,113,113,.6))';
    var svg=h.querySelector('svg');
    try{h.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:.85,offset:.86},{opacity:0}],{duration:2400/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:2600/sp,iterations:Infinity});}catch(e){}
    rm(h,2500/sp);
  }
  function hbaMtHex(bx,by,bw,bh,sp){
    var W=Math.round(bw*1.35),H=Math.round(bh*1.1);
    var hexes='';
    for(var r=0;r<5;r++){for(var c=0;c<6;c++){
      var cx2=14+c*20+(r%2?10:0), cy2=12+r*17;
      hexes+='<polygon points="0,-9 7.8,-4.5 7.8,4.5 0,9 -7.8,4.5 -7.8,-4.5" transform="translate('+cx2+','+cy2+')" fill="none" stroke="rgba(248,113,113,.5)" stroke-width="1"/>';
    }}
    var x=hbaMtEl('hba-mt-hex',bx,by-6,W,H);
    x.innerHTML='<svg width="'+W+'" height="'+H+'" viewBox="0 0 134 86" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'+hexes+'</svg>';
    try{x.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.92)'},{opacity:.7,offset:.3},{opacity:.45,offset:.62},{opacity:0,transform:'translate(-50%,-50%) scale(1.02)'}],{duration:900/sp});}catch(e){}
    rm(x,980/sp);
  }
  function hbaMtRadar(hx,midY,sp){
    var D=96;
    var r=hbaMtEl('hba-mt-radar',hx,midY,D,D);
    r.style.border='1.5px solid rgba(248,113,113,.7)';
    r.innerHTML='<div style="position:absolute;left:0;top:0;right:0;bottom:0;border-radius:50%;background:conic-gradient(from 0deg,rgba(248,113,113,.55) 0deg,rgba(248,113,113,.18) 46deg,transparent 70deg)"></div>'
      +'<div style="position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px;border-radius:50%;background:#f87171"></div>';
    var fan=r.firstChild;
    try{r.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.9,offset:.18},{opacity:.85,offset:.84},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:880/sp,fill:'forwards'});
    if(fan)fan.animate([{transform:'rotate(0deg)'},{transform:'rotate(540deg)'}],{duration:880/sp,easing:'cubic-bezier(.3,.2,.6,1)'});}catch(e){}
    rm(r,960/sp);
  }
  function hbaMtReticle(bx,by,hx,midY,sp,onLocked){
    var sz0=64;
    var r=hbaMtEl('hba-mt-ret',null,null,sz0,sz0);
    r.innerHTML='<svg width="'+sz0+'" height="'+sz0+'" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="32" cy="32" r="24" fill="none" stroke="#f87171" stroke-width="2" opacity=".9"/>'
      +'<circle cx="32" cy="32" r="3" fill="#f87171"/>'
      +'<line x1="32" y1="1" x2="32" y2="14" stroke="#f87171" stroke-width="2"/><line x1="32" y1="50" x2="32" y2="63" stroke="#f87171" stroke-width="2"/>'
      +'<line x1="1" y1="32" x2="14" y2="32" stroke="#f87171" stroke-width="2"/><line x1="50" y1="32" x2="63" y2="32" stroke="#f87171" stroke-width="2"/></svg>';
    r.style.filter='drop-shadow(0 0 6px rgba(248,113,113,.7))';
    var x0=bx-sz0/2, y0=by-sz0/2, x1=hx-sz0/2, y1=midY-sz0/2;
    r.style.left=x0+'px';r.style.top=y0+'px';
    var jx=hx+hbaMtR(-44,44)-sz0/2, jy=midY-hbaMtR(26,50)-sz0/2;
    try{var an=r.animate([
      {transform:'translate(0,0) scale(1.25)',opacity:0},
      {transform:'translate(0,0) scale(1.1)',opacity:1,offset:.12},
      {transform:'translate('+(jx-x0)+'px,'+(jy-y0)+'px) scale(1.05)',opacity:1,offset:.5},
      {transform:'translate('+(x1-x0)+'px,'+(y1-y0)+'px) scale(1)',opacity:1,offset:.78},
      {transform:'translate('+(x1-x0)+'px,'+(y1-y0)+'px) scale(.92)',opacity:0}
    ],{duration:820/sp,easing:'cubic-bezier(.35,.1,.3,1)',fill:'forwards'});
    an.onfinish=function(){try{onLocked&&onLocked();}catch(e){}};}catch(e){setTimeout(function(){try{onLocked&&onLocked();}catch(e2){}},820/sp);}
    rm(r,900/sp);
  }
  function hbaMtWarnTris(hx,barL,barW,midY,sp){
    var pad=10,L=barL-pad,T=midY-17,W2=barW+pad*2,H2=34;
    [[L+W2/2,T-10,0],[L+W2/2,T+H2+10,180],[L-12,T+H2/2,-90],[L+W2+12,T+H2/2,90]].forEach(function(c,i){setTimeout(function(){
      var w=hbaMtEl('hba-mt-warn',c[0],c[1]);
      w.style.borderLeft='5px solid transparent';w.style.borderRight='5px solid transparent';w.style.borderBottom='8px solid #f87171';
      w.style.transform='translate(-50%,-50%) rotate('+c[2]+'deg)';
      w.style.filter='drop-shadow(0 0 5px rgba(248,113,113,.8))';
      try{w.animate([{opacity:0},{opacity:1},{opacity:.2},{opacity:1},{opacity:0}],{duration:520/sp});}catch(e){}
      rm(w,580/sp);
    },i*40/sp);});
  }
  function hbaMtLockBox(hx,barL,barW,midY,sp,life,vw){
    var pad=10, L=barL-pad, T=midY-17, W2=barW+pad*2, H2=34;
    var corners=[[L,T,'borderLeft','borderTop'],[L+W2-14,T,'borderRight','borderTop'],[L,T+H2-14,'borderLeft','borderBottom'],[L+W2-14,T+H2-14,'borderRight','borderBottom']];
    corners.forEach(function(c){
      var d=hbaMtEl('hba-mt-lockc',c[0],c[1]);
      d.style[c[2]]='3px solid #f87171';d.style[c[3]]='3px solid #f87171';
      d.style.boxShadow='0 0 8px rgba(248,113,113,.65)';
      var cx2=L+W2/2-7, cy2=T+H2/2-7, dx=(c[0]-cx2), dy=(c[1]-cy2);
      try{d.animate([
        {transform:'translate('+(dx*2.4)+'px,'+(dy*3.4)+'px)',opacity:0},
        {transform:'translate('+(dx*2.4)+'px,'+(dy*3.4)+'px)',opacity:1,offset:.03},
        {transform:'translate('+(dx*1.2)+'px,'+(dy*1.7)+'px)',opacity:1,offset:.09},
        {transform:'translate('+(dx*0.5)+'px,'+(dy*0.7)+'px)',opacity:1,offset:.15},
        {transform:'translate(0,0)',opacity:1,offset:.2},
        {opacity:.4,offset:.26},{opacity:1,offset:.32},
        {opacity:1,offset:.93},{opacity:0}
      ],{duration:life/sp,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});}catch(e){}
      rm(d,life/sp+80);
    });
    setTimeout(function(){hbaMtHit(hx,midY,26,200/sp);hbaMtWarnTris(hx,barL,barW,midY,sp);},life*0.2/sp);
    var lr=hbaMtEl('hba-mt-lring',hx,midY,90,90);lr.style.color='#f87171';
    try{lr.animate([{transform:'translate(-50%,-50%) scale(1.1) rotate(0deg)',opacity:0},{opacity:.85,offset:.2},{transform:'translate(-50%,-50%) scale(.62) rotate(200deg)',opacity:.75,offset:.65},{transform:'translate(-50%,-50%) scale(.58) rotate(260deg)',opacity:0}],{duration:900/sp,easing:'ease-out'});}catch(e){}
    rm(lr,980/sp);
    for(var i=0;i<3;i++){(function(i){setTimeout(function(){
      var dW=hbaMtR(14,26);
      var d2=hbaMtEl('hba-mt-data',Math.min(L+W2+6,vw-30),T+5+i*8,dW,null);
      d2.style.background='#f87171';d2.style.opacity=.85;
      try{d2.animate([{opacity:0},{opacity:.9},{opacity:.2},{opacity:.85},{opacity:0}],{duration:560/sp});}catch(e){}
      rm(d2,620/sp);
    },i*70/sp);})(i);}
  }
  function hbaMtRange(bx,by,bw,bh,hx,midY,sp){
    var x1=bx+bw*0.035, y1=by-bh*0.27;
    var L=Math.hypot(hx-x1,midY-y1), rot=Math.atan2(midY-y1,hx-x1);
    var d=hbaMtEl('hba-mt-rangeline',x1,y1,L,null);
    d.style.color='#f87171';d.style.transform='rotate('+rot+'rad)';d.style.opacity=0;
    try{d.animate([{opacity:0},{opacity:.85,offset:.15},{opacity:.1,offset:.4},{opacity:.8,offset:.6},{opacity:0}],{duration:480/sp});}catch(e){}
    rm(d,540/sp);
  }
  function hbaMtEFlow(bx,by,bw,bh,sp){
    var x1=bx, y1=by-bh*0.115, x2=bx-bw*0.24, y2=by+bh*0.16;
    for(var i=0;i<3;i++){(function(i){setTimeout(function(){
      var f=hbaMtEl('hba-mt-eflow',x1-2.5,y1-2.5,5,5);
      f.style.background='#ffffff';f.style.boxShadow='0 0 8px #fda4af, 0 0 16px rgba(244,63,94,.7)';
      try{f.animate([{transform:'translate(0,0)',opacity:0},{opacity:1,offset:.15},{transform:'translate('+(x2-x1)+'px,'+(y2-y1)+'px)',opacity:.9,offset:.9},{transform:'translate('+(x2-x1)+'px,'+(y2-y1)+'px)',opacity:0}],{duration:280/sp,easing:'cubic-bezier(.4,.1,.6,1)'});}catch(e){}
      rm(f,340/sp);
    },i*100/sp);})(i);}
  }
  function hbaMtBladeOverload(bx,by,bw,bh,sz,sp){
    var hxx=bx-bw*0.24, hyy=by+bh*0.16, txx=bx-bw*0.345, tyy=by-bh*0.345;
    var L=Math.hypot(txx-hxx,tyy-hyy), rot=Math.atan2(txx-hxx,-(tyy-hyy));
    var b=hbaMtEl('hba-mt-bladeglow',hxx-5*sz,hyy,10*sz,0);
    b.style.transform='rotate('+rot+'rad)';
    b.style.background='linear-gradient(180deg,#ffffff 0%,#fda4af 30%,rgba(244,63,94,.7) 70%,transparent)';
    b.style.boxShadow='0 0 12px rgba(244,63,94,.9), 0 0 26px rgba(244,63,94,.5)';
    try{b.animate([{height:'0px',opacity:.4},{height:L+'px',opacity:1,offset:.55},{height:L+'px',opacity:.92}],{duration:560/sp,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});
    b.animate([{filter:'brightness(1)'},{filter:'brightness(1.6)'},{filter:'brightness(1)'}],{duration:420/sp,iterations:3,delay:560/sp});}catch(e){}
    rm(b,1900/sp);
    var c=hbaMtEl('hba-mt-charge',txx-11*sz,tyy-11*sz,22*sz,22*sz);
    c.style.background='radial-gradient(circle at 42% 38%,#ffffff 0%,#fda4af 32%,rgba(244,63,94,.55) 64%,transparent 80%)';
    c.style.boxShadow='0 0 16px rgba(244,63,94,.9), 0 0 34px rgba(244,63,94,.5)';
    try{c.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.15)',opacity:1,offset:.5},{transform:'scale(1)',opacity:.95}],{duration:520/sp,easing:'cubic-bezier(.2,.8,.4,1.2)',fill:'forwards'});}catch(e){}
    rm(c,1900/sp);
    [[0.275,-0.05,30],[0.0,-0.115,18]].forEach(function(o,i){setTimeout(function(){
      var r2=o[2]*sz;
      var s2=hbaMtEl('hba-mt-charge',bx+bw*o[0]-r2/2,by+bh*o[1]-r2/2,r2,r2);
      s2.style.background='radial-gradient(circle,#fda4af 0%,rgba(244,63,94,.4) 55%,transparent 78%)';
      s2.style.boxShadow='0 0 14px rgba(244,63,94,.7)';
      try{s2.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1)',opacity:.9,offset:.4},{transform:'scale(1.08)',opacity:.75},{transform:'scale(1)',opacity:.9}],{duration:1100/sp,fill:'forwards'});}catch(e){}
      rm(s2,1600/sp);
    },(150+i*160)/sp);});
    var gw=hbaMtEl('hba-mt-gwave',bx,by+bh*0.42,110*sz,110*sz);gw.style.color='#f43f5e';
    try{gw.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.8},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:620/sp,easing:'ease-out'});}catch(e){}
    rm(gw,700/sp);
  }
  function hbaMtSwordWave(bx,by,bw,bh,hx,barL,barW,midY,barBot,vw,sz,sp,fxi,tx,k){
    var W=110*sz,H=62*sz;
    var x1=bx-bw*0.30+hbaMtR(-8,8), y1=by-bh*0.18+hbaMtR(-10,10);
    var dx=tx-x1, dy=midY-4-y1;
    var rot=Math.atan2(dy,dx)*180/Math.PI+90;
    [1,0].forEach(function(main){
      setTimeout(function(){
        var s=hbaMtEl('hba-mt-slash',x1-W/2,y1-H/2,W,H);
        s.innerHTML=hbaMtCrescent(W,H,false);
        s.style.filter='drop-shadow(0 0 5px rgba(244,63,94,.85)) drop-shadow(0 0 14px rgba(244,63,94,.45))';
        var op=main?1:.38, sc=main?1:.86;
        try{s.animate([
          {transform:'translate(0,0) rotate('+rot+'deg) scale(.5)',opacity:0},
          {transform:'translate('+(dx*0.16)+'px,'+(dy*0.16)+'px) rotate('+rot+'deg) scale('+sc+')',opacity:op,offset:.16},
          {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+(sc*1.04)+')',opacity:op,offset:.92},
          {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+(sc*1.04)+')',opacity:0}
        ],{duration:300/sp,easing:'cubic-bezier(.4,.05,.7,.9)',fill:'forwards'});}catch(e){}
        rm(s,360/sp);
      },main?0:40/sp);
    });
    setTimeout(function(){
      hbaMtSSlash(hx,vw,hbaMtR(-16,16),midY-hbaMtR(48,66),sp);
      hbaMtCut(tx,midY,46*sz,hbaMtR(-38,-22));
      hbaMtHit(tx,midY,38*sz,240/sp);
      hbaMtRing(tx,midY,32*sz,'#f43f5e',300/sp);
      hbaMtSparks(tx,midY,Math.round(5*fxi),.8,barBot+16);
      hbaMtBarGlow(120);hbaMtCombo(k,tx,midY,vw);
    },280/sp);
  }
  function hbaMtWarnMark(hx,sp){
    var w=hbaMtEl('hba-mt-warnmark',hx,150,54,54);
    w.innerHTML='<div style="position:absolute;left:0;top:0;right:0;bottom:0;border:2px solid #f87171;border-radius:50%;box-shadow:0 0 10px rgba(248,113,113,.7)"></div>'
      +'<div style="position:absolute;left:9px;top:9px;right:9px;bottom:9px;border:1.5px dashed rgba(248,113,113,.8);border-radius:50%"></div>'
      +'<div class="wm-arrow" style="position:absolute;left:50%;top:50%;width:0;height:0;margin:-7px 0 0 -7px;border-left:7px solid transparent;border-right:7px solid transparent;border-top:11px solid #f87171;filter:drop-shadow(0 0 5px rgba(248,113,113,.9))"></div>';
    var ar=w.querySelector('.wm-arrow');
    try{w.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1.5)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.25},{opacity:.4,offset:.5},{opacity:1,offset:.7},{opacity:0,transform:'translate(-50%,-50%) scale(.85)'}],{duration:420/sp});
    if(ar)ar.animate([{transform:'translateY(0)'},{transform:'translateY(7px)'},{transform:'translateY(0)'}],{duration:200/sp,iterations:2});}catch(e){}
    rm(w,480/sp);
  }
  function hbaMtMSpark(x,y){
    if(Math.random()<.3){
      var l=hbaMtEl('hba-mt-spark',x,y,null,null);
      l.style.width='1.5px';l.style.height=hbaMtR(16,30)+'px';l.style.borderRadius='1px';
      l.style.background='linear-gradient(180deg,transparent,#ffffff)';l.style.opacity=.6;
      try{l.animate([{opacity:.6},{opacity:0}],{duration:160});}catch(e){}
      rm(l,200);return;
    }
    var w=hbaMtR(2,3.6);
    var s=hbaMtEl('hba-mt-spark',x,y,w,w);
    s.style.background=Math.random()<.45?'#ffffff':'#fda4af';s.style.boxShadow='0 0 6px #f43f5e';
    try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+hbaMtR(-16,16)+'px,'+(-hbaMtR(12,30))+'px)',opacity:0}],{duration:hbaMtR(240,360),easing:'ease-out'});}catch(e){}
    rm(s,400);
  }
  function hbaMtFlameBurst(x,y,n,sz,capY){
    for(var i=0;i<n;i++){
      var ang=hbaMtR(Math.PI*1.08,Math.PI*1.92),d=hbaMtR(26,56)*sz;
      var dx=Math.cos(ang)*d,dy=Math.sin(ang)*d*0.85;
      var endY=y+dy+hbaMtR(12,24); if(capY!=null&&endY>capY)endY=capY;
      var w=hbaMtR(8,13)*sz;
      var f=hbaMtEl('hba-mt-flame',x-w/2,y-w*1.4,w,w*1.4);
      f.style.background='linear-gradient(180deg,#ffffff 0%,#fda4af 38%,#f43f5e 70%,transparent)';
      f.style.boxShadow='0 0 9px rgba(244,63,94,.7)';
      try{f.animate([{transform:'translate(0,0) scale(.4)',opacity:0},{transform:'translate('+(dx*0.7)+'px,'+dy+'px) scale(1)',opacity:.95,offset:.42},{transform:'translate('+dx+'px,'+(endY-y)+'px) scale(.45)',opacity:0}],{duration:hbaMtR(440,660),easing:'cubic-bezier(.3,.6,.5,1)'});}catch(e){}
      rm(f,720);
    }
  }
  function hbaMtDust(x,y,sz,sp){
    [-1,1].forEach(function(d){
      for(var i=0;i<2;i++){(function(i){setTimeout(function(){
        var w=hbaMtR(20,30)*sz;
        var s=hbaMtEl('hba-mt-dust',x-w/2,y-w*0.4,w,w);
        s.style.background='radial-gradient(circle,rgba(148,163,184,.55),rgba(100,116,139,.22) 58%,transparent 78%)';
        try{s.animate([{transform:'translate(0,0) scale(.5)',opacity:.8},{transform:'translate('+(d*hbaMtR(34,56))+'px,'+(-hbaMtR(4,12))+'px) scale(1.9)',opacity:0}],{duration:hbaMtR(460,640)/sp,easing:'ease-out'});}catch(e){}
        rm(s,700/sp);
      },i*90/sp);})(i);}
    });
  }
  function hbaMtFinalFist(bsEl,bx,by,bw,bh,hx,barL,barW,midY,barBot,vw,sz,sp,fxi,deal){
    if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 26px rgba(244,63,94,.9)) brightness(1.5)',offset:.25},{filter:'drop-shadow(0 0 16px rgba(244,63,94,.5)) brightness(1.1)',offset:.6},{filter:'brightness(1)'}],{duration:880/sp});}catch(e){}}
    var r0=34*sz;
    var c=hbaMtEl('hba-mt-charge',bx-r0/2,by-bh*0.115-r0/2,r0,r0);
    c.style.background='radial-gradient(circle,#ffffff 0%,#fda4af 36%,rgba(244,63,94,.6) 66%,transparent 82%)';
    c.style.boxShadow='0 0 22px rgba(244,63,94,.95)';
    try{c.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.35)',opacity:1,offset:.6},{transform:'scale(.2)',opacity:0}],{duration:400/sp,easing:'cubic-bezier(.3,.7,.5,1)'});}catch(e){}
    rm(c,460/sp);
    hbaMtWarnMark(hx,sp);
    setTimeout(function(){
      var FH=150*sz, FW=FH*201/360;
      var fx0=hx+5, yStart=-FH-12, yEnd=midY-FH+12;
      var f=hbaMtEl('hba-mt-fist',fx0-FW/2,yStart,FW,FH);
      var fimg;
      if(window.__hbaFistImg && (window.__hbaFistReady || window.__hbaFistImg.complete) && window.__hbaFistImg.naturalWidth>0){
        fimg=window.__hbaFistImg.cloneNode(false);
      } else { fimg=document.createElement('img'); fimg.src='bosses/mechfist_real.webp'; }
      fimg.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%';
      f.innerHTML='<div class="ftail" style="position:absolute;left:50%;bottom:84%;width:'+(FW*0.78)+'px;height:'+(FH*1.18)+'px;margin-left:-'+(FW*0.39)+'px;background:linear-gradient(0deg,#fda4af 0%,rgba(244,63,94,.55) 32%,rgba(244,63,94,.22) 62%,transparent);border-radius:50% 50% 34% 34%;filter:blur(1.2px)"></div>'
        +'<div style="position:absolute;left:-7%;top:26%;width:15%;height:58%;background:linear-gradient(0deg,#fda4af 10%,rgba(244,63,94,.45) 55%,transparent);border-radius:50% 50% 40% 40%;transform:skewY(9deg)"></div>'
        +'<div style="position:absolute;right:-7%;top:22%;width:15%;height:62%;background:linear-gradient(0deg,#fda4af 10%,rgba(244,63,94,.45) 55%,transparent);border-radius:50% 50% 40% 40%;transform:skewY(-9deg)"></div>';
      f.appendChild(fimg);
      var ffr=document.createElement('div');
      ffr.className='ffront';
      ffr.style.cssText='position:absolute;left:50%;bottom:-'+(FW*0.10)+'px;width:'+(FW*1.06)+'px;height:'+(FW*0.42)+'px;margin-left:-'+(FW*0.53)+'px;background:radial-gradient(ellipse at 50% 16%,#ffffff 0%,#fda4af 36%,#f43f5e 62%,transparent 80%);border-radius:50%';
      f.appendChild(ffr);
      f.style.transform='rotate(4deg)';
      f.style.filter='drop-shadow(0 0 14px rgba(244,63,94,.85)) drop-shadow(0 8px 30px rgba(244,63,94,.5))';
      var ft=f.querySelector('.ftail');
      try{ffr.animate([{transform:'scale(1)'},{transform:'scale(1.16)'},{transform:'scale(1)'}],{duration:110,iterations:Infinity});
      if(ft)ft.animate([{transform:'scaleY(1)'},{transform:'scaleY(1.12)'},{transform:'scaleY(1)'}],{duration:140,iterations:Infinity});}catch(e){}
      var T=390/sp, st=null;
      function hbaMtImpact(){
        try{f.animate([{transform:'rotate(4deg) translateY(0)'},{transform:'rotate(4deg) translateY(-8px)',offset:.34},{transform:'rotate(4deg) translateY(0)'}],{duration:220/sp});}catch(e){}
        hbaMtVign(.62,560/sp);
        hbaMtHit(hx,midY,96*sz*fxi,380/sp);
        hbaMtGShock(hx,barL,barW,midY,vw,sz,sp);
        hbaMtRing(hx,midY,48*sz,'#fee2e2',340/sp);
        setTimeout(function(){hbaMtRing(hx,midY,72*sz,'#f43f5e',360/sp);},90/sp);
        setTimeout(function(){hbaMtRing(hx,midY,98*sz,'#f43f5e',380/sp);},180/sp);
        hbaMtFlameBurst(hx,midY,Math.round(8*fxi),sz,barBot+16);
        hbaMtSparks(hx,midY,Math.round(18*fxi),1.3,barBot+16);
        hbaMtShrap(hx,midY,Math.round(7*fxi),barBot+16);
        hbaMtDust(hx,midY+4,sz,sp);
        hbaMtBarGlow(360);
        deal();
        setTimeout(function(){
          try{f.animate([{top:yEnd+'px',opacity:1},{top:(yEnd-150)+'px',opacity:0}],{duration:250/sp,easing:'cubic-bezier(.5,0,.85,.4)',fill:'forwards'});}catch(e){f.style.opacity=0;}
          for(var i2=0;i2<3;i2++){(function(i2){setTimeout(function(){hbaMtMSpark(hx+hbaMtR(-20,20),midY-hbaMtR(20,80));},i2*60/sp);})(i2);}
          rm(f,320/sp);
        },280/sp);
        setTimeout(function(){
          var pad2=10,L2=barL-pad2,T2=midY-17,W3=barW+pad2*2,H3=34;
          [[L2,T2,'borderLeft','borderTop'],[L2+W3-14,T2,'borderRight','borderTop'],[L2,T2+H3-14,'borderLeft','borderBottom'],[L2+W3-14,T2+H3-14,'borderRight','borderBottom']].forEach(function(c2){
            var d2=hbaMtEl('hba-mt-lockc',c2[0],c2[1]);
            d2.style[c2[2]]='3px solid #fff';d2.style[c2[3]]='3px solid #fff';
            d2.style.boxShadow='0 0 10px rgba(255,255,255,.9)';
            var cx3=L2+W3/2-7, cy3=T2+H3/2-7, ex=(c2[0]-cx3)*0.9, ey=(c2[1]-cy3)*1.6;
            try{d2.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+ex+'px,'+ey+'px)',opacity:0}],{duration:380/sp,easing:'cubic-bezier(.3,.6,.4,1)'});}catch(e){}
            rm(d2,440/sp);
          });
        },340/sp);
        setTimeout(function(){
          [-0.2,0.12,0.3].forEach(function(o,i3){setTimeout(function(){
            hbaMtFlame(hx+barW*o*0.8,midY+3,hbaMtR(9,13)*sz,hbaMtR(420,640)/sp);
          },i3*110/sp);});
          hbaMtSmoke(hx,midY-4,sp);
        },240/sp);
      }
      function step(ts){
        if(st==null)st=ts;
        var t2=Math.min(1,(ts-st)/T), tt=t2*t2*0.6+t2*0.4;
        f.style.top=(yStart+(yEnd-yStart)*tt)+'px';
        if(t2<0.92&&Math.random()<.6){hbaMtMSpark(fx0+hbaMtR(-FW*0.5,FW*0.5), yStart+(yEnd-yStart)*tt+FH*hbaMtR(.15,.75));}
        if(t2<1){requestAnimationFrame(step);}else{hbaMtImpact();}
      }
      try{requestAnimationFrame(step);}catch(e){f.style.top=yEnd+'px';hbaMtImpact();}
    },430/sp);
  }
  function hbaTitanStrike(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:192, bw=br?Math.max(br.width,120):150, bh=br?Math.max(br.height,120):150;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var dome=hbaMtEl('hba-mt-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},4750/sp);rm(dome,5500/sp);
    /* ① SYSTEM ONLINE */
    hbaMtHud(vw,4750/sp);
    setTimeout(function(){hbaMtScan(midY,sp);},120/sp);
    setTimeout(function(){hbaMtHex(bx,by,bw,bh,sp);},220/sp);
    setTimeout(function(){hbaMtHolo(bx,by,bw,bh,sp);},300/sp);
    setTimeout(function(){hbaMtEyes(bsEl,bx,by,bw,bh,sp);},340/sp);
    hbaMtLamps(bx,by,bw,bh,sp);
    setTimeout(function(){hbaMtSteam(bx,by,bw,bh,sp);},520/sp);
    /* ② TARGET LOCKED */
    setTimeout(function(){
      hbaMtRadar(hx,midY,sp);
      hbaMtReticle(bx,by,hx,midY,sp,function(){
        hbaMtLockBox(hx,barL,barW,midY,sp,3450,vw);
        hbaMtRange(bx,by,bw,bh,hx,midY,sp);
        setTimeout(function(){hbaMtRange(bx,by,bw,bh,hx,midY,sp);},180/sp);
      });
    },1050/sp);
    /* ③ 武器过载 */
    setTimeout(function(){hbaMtEFlow(bx,by,bw,bh,sp);},2050/sp);
    setTimeout(function(){hbaMtBladeOverload(bx,by,bw,bh,sz,sp);},2180/sp);
    /* ④ TERMINATING: 剑气三连斩 + 天降流星拳 */
    var n=Math.max(2,Math.round(3*fxi)); if(n>5)n=5;
    var slots5=[.14,.32,.5,.68,.86], slots3=[.25,.5,.75];
    for(var k=0;k<n;k++){(function(k){setTimeout(function(){
      var tx=barL+barW*((n<=3?slots3:slots5)[k]);
      hbaMtSwordWave(bx,by,bw,bh,hx,barL,barW,midY,barBot,vw,sz,sp,fxi,tx,k+1);
    },(2980+k*190)/sp);})(k);}
    var lastHit=(2980+(n-1)*190+280)/sp;
    setTimeout(function(){hbaMtFinalFist(bsEl,bx,by,bw,bh,hx,barL,barW,midY,barBot,vw,sz,sp,fxi,deal);},lastHit+140/sp);
  }
  /* 🔴 v529: 外星霸主(Lv18·legendary)歼星协议·轨道湮灭——Hansen 定稿: 异星翠绿·规模100%·速度1.00x·火力强度100%(5颗无人机)。
     四阶段(台词三连=分镜): ①"你的星球归我了!"=入侵领域(异星光帘流动+飞碟座驾反重力光环+上升光粒+触角双球信号灯+掌心法阵旋入持续旋转)
     ②"宇宙最强生物!"=无人机僚机群(5颗侦察无人机从立绘环绕位弹出→血条上空 midY-70 一字列阵悬停 bob+单眼齐闪锁定+锁定虚线×5射血条)
     ③等离子齐射(五机错峰190ms射光弹[主体+2残影拖尾]飞240ms命中血条五点1~5连+爆+环+火花→编队归航淡出)
     ④"哼哼...弱小地球人!"=歼星炮轨道轰炸(boss过载+法阵推出至(hx,110)定位58px→预热光点屏顶降落220ms→歼星光束
       [复用 __hbaBeamImg·BUG#67三件判定·300×664竖版真图·hue-rotate(140deg)转翠绿·命中冲击中心=图高88%对准midY·底部裁切barBot+16]
       scaleY轰出130ms→全功率brightness脉冲560ms→第一脉冲190ms时主爆: 柔光.62+爆闪90+三重环+地面冲击波+火花15+碎片5+deal≈4050ms
       ·汽化离子interval 70ms升空至760ms→730ms光束scaleX收束)→法阵碎裂4光片→命中点辐射光斑渐熄+烟缕。
     空间适配: 光束底部冲击区裁到barBot+16·汽化粒只向上·火花/碎片坠程钳位——答题区零侵犯。零震屏零屏闪(柔光≤.62)。 */
  function hbaAlEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaAlR(a,b){return a+Math.random()*(b-a);}
  function hbaAlVign(peak,ms){var v=hbaAlEl('hba-al-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(52,211,153,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaAlRing(x,y,sz0,col,ms){var r=hbaAlEl('hba-al-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaAlHit(x,y,szp,ms){var h=hbaAlEl('hba-al-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#a7f3d0 32%,rgba(52,211,153,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaAlSparks(x,y,n,pow,capY){
    for(var i=0;i<n;i++){
      var w=hbaAlR(2,3.4);
      var s=hbaAlEl('hba-al-spark',x,y,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#34d399';s.style.boxShadow='0 0 6px #34d399';
      var ang=hbaAlR(0,Math.PI*2),v=hbaAlR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaAlR(8,22)+hbaAlR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaAlR(380,620),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,680);
    }
  }
  function hbaAlShrap(x,y,n,capY){
    for(var i=0;i<n;i++){var w=hbaAlR(3,6),h=hbaAlR(2,3.5);
      var s=hbaAlEl('hba-al-shrap',x,y,w,h);
      s.style.background='linear-gradient(135deg,#a7f3d0,#10b981)';s.style.boxShadow='0 0 3px rgba(52,211,153,.6)';
      var ang=hbaAlR(-2.6,-0.5),v=hbaAlR(30,64),dx=Math.cos(ang)*v*hbaAlR(.8,1.4),dy=Math.sin(ang)*v+hbaAlR(40,70);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) rotate('+hbaAlR(-540,540)+'deg)',opacity:0}],{duration:hbaAlR(460,700),easing:'cubic-bezier(.3,.5,.6,1)'});}catch(e){}
      rm(s,760);
    }
  }
  function hbaAlCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-al-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaAlBarGlow(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaAlSmoke(x,y,sp){
    for(var i=0;i<3;i++){(function(i){setTimeout(function(){
      var w=hbaAlR(8,14);
      var s=hbaAlEl('hba-al-smoke',x+hbaAlR(-16,16),y,w,w);
      s.style.background='radial-gradient(circle,rgba(52,211,153,.35),rgba(52,211,153,.12) 60%,transparent 80%)';
      try{s.animate([{transform:'translate(0,0) scale(.6)',opacity:.7},{transform:'translate('+hbaAlR(-12,12)+'px,'+(-hbaAlR(36,66))+'px) scale(1.7)',opacity:0}],{duration:hbaAlR(700,1000)/sp,easing:'ease-out'});}catch(e){}
      rm(s,1100/sp);
    },i*130/sp);})(i);}
  }
  function hbaAlGShock(hx,midY,vw,sp){
    [[-1,'100% 50%'],[1,'0 50%']].forEach(function(d){
      var w=d[0]<0?(hx-8):(vw-hx-8);
      var s=hbaAlEl('hba-al-gshock',d[0]<0?(hx-w):hx,midY+4,w,null);
      s.style.transformOrigin=d[1];
      s.style.background=d[0]<0?'linear-gradient(90deg,transparent,#34d399 60%,#ffffff)':'linear-gradient(90deg,#ffffff,#34d399 40%,transparent)';
      s.style.boxShadow='0 0 10px rgba(52,211,153,.7)';
      try{s.animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(1)',opacity:.95,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}
      rm(s,400/sp);
    });
  }
  function hbaAlSkyVeil(sp,life){
    var v=hbaAlEl('hba-al-veil',null,null);
    v.style.background='linear-gradient(180deg,rgba(52,211,153,.30) 0%,rgba(52,211,153,.12) 55%,transparent),repeating-linear-gradient(100deg,transparent 0 14px,rgba(52,211,153,.10) 14px 17px)';
    try{v.animate([{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.9},{opacity:0}],{duration:life/sp,fill:'forwards'});
    v.animate([{backgroundPosition:'0 0,0 0'},{backgroundPosition:'0 0,90px 0'}],{duration:2400/sp,iterations:Infinity});}catch(e){}
    rm(v,life/sp+80);
  }
  function hbaAlGravField(bx,by,bw,bh,sp,life){
    var w=bw*0.92;
    var gr=hbaAlEl('hba-al-grav',bx,by+bh*0.36,w,w*0.26);
    gr.style.border='2px solid rgba(52,211,153,.7)';gr.style.boxShadow='0 0 14px rgba(52,211,153,.5), inset 0 0 12px rgba(52,211,153,.35)';
    try{gr.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.6)'},{opacity:.9,transform:'translate(-50%,-50%) scale(1)',offset:.12},{opacity:.7,offset:.5},{opacity:.9,offset:.62},{opacity:.75,offset:.9},{opacity:0}],{duration:life/sp,fill:'forwards'});}catch(e){}
    rm(gr,life/sp+80);
    var iv=setInterval(function(){
      var mw=hbaAlR(2,3.2);
      var m=hbaAlEl('hba-al-gmote',bx+hbaAlR(-w*0.4,w*0.4),by+bh*0.34,mw,mw);
      m.style.background='#a7f3d0';m.style.boxShadow='0 0 6px #34d399';
      try{m.animate([{transform:'translate(0,0)',opacity:0},{opacity:.9,offset:.2},{transform:'translate('+hbaAlR(-8,8)+'px,'+(-hbaAlR(40,80))+'px)',opacity:0}],{duration:hbaAlR(900,1400)/sp,easing:'linear'});}catch(e){}
      rm(m,1500/sp);
    },150);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  function hbaAlAnt(bx,by,bw,bh,sp){
    [[-0.085,-0.43],[0.085,-0.43]].forEach(function(o){
      var a=hbaAlEl('hba-al-ant',bx+bw*o[0]-3.5,by+bh*o[1]-3.5,7,7);
      a.style.background='radial-gradient(circle,#ffffff,#a7f3d0 50%,transparent 80%)';
      a.style.boxShadow='0 0 8px rgba(52,211,153,.95)';
      rm(a,3100/sp);
    });
  }
  function hbaAlGlyphSVG(D){
    return '<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="46" fill="none" stroke="#34d399" stroke-width="2.5" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="36" fill="none" stroke="#a7f3d0" stroke-width="1.4" stroke-dasharray="7 5"/>'
      +'<circle cx="50" cy="50" r="10" fill="none" stroke="#ffffff" stroke-width="2"/>'
      +'<polygon points="50,22 74,64 26,64" fill="none" stroke="#a7f3d0" stroke-width="1.6" opacity=".85"/>'
      +'<g stroke="#34d399" stroke-width="1.6">'
      +'<line x1="50" y1="2" x2="50" y2="12"/><line x1="50" y1="88" x2="50" y2="98"/>'
      +'<line x1="2" y1="50" x2="12" y2="50"/><line x1="88" y1="50" x2="98" y2="50"/></g></svg>';
  }
  function hbaAlPalmGlyph(bx,by,bw,bh,sz,sp,life){
    var D=44*sz;
    var gl=hbaAlEl('hba-al-glyph',bx+bw*0.22,by-bh*0.14,D,D);
    gl.innerHTML=hbaAlGlyphSVG(D);
    gl.style.filter='drop-shadow(0 0 8px rgba(52,211,153,.8))';
    var svg=gl.querySelector('svg');
    try{gl.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2) rotate(-90deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(0deg)',offset:.2},{opacity:.95,offset:1}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:2200/sp,iterations:Infinity});}catch(e){}
    return gl;
  }
  function hbaAlDroneSVG(D){
    return '<svg width="'+D+'" height="'+D+'" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">'
      +'<ellipse cx="20" cy="34" rx="7" ry="4" fill="#34d399" opacity=".55"/>'
      +'<ellipse cx="20" cy="31" rx="4" ry="6" fill="#a7f3d0" opacity=".5"/>'
      +'<circle cx="20" cy="18" r="13" fill="#efeaf4" stroke="#b9aecb" stroke-width="1"/>'
      +'<circle cx="15.5" cy="13" r="4.5" fill="#ffffff" opacity=".85"/>'
      +'<circle cx="20" cy="18" r="6.5" fill="#10b981"/>'
      +'<circle cx="20" cy="18" r="3.6" fill="#34d399"/>'
      +'<circle cx="18.4" cy="16.4" r="1.4" fill="#ffffff"/>'
      +'</svg>';
  }
  function hbaAlDeploy(bx,by,bw,bh,barL,barW,midY,sz,sp,n,onDone){
    var D=30*sz;
    var starts=[[-0.42,-0.22],[0.42,-0.25],[-0.38,0.10],[0.40,0.08],[0,-0.46],[-0.2,-0.4],[0.2,-0.42]];
    var slots=[.1,.3,.5,.7,.9,.2,.8];
    var rowY=midY-70;
    var drones=[];
    for(var i=0;i<n;i++){(function(i){setTimeout(function(){
      var d=hbaAlEl('hba-al-drone',null,null,D,D);
      d.innerHTML=hbaAlDroneSVG(D);
      d.style.filter='drop-shadow(0 0 6px rgba(52,211,153,.6))';
      var s0=starts[i%7];
      var x0=bx+bw*s0[0]-D/2, y0=by+bh*s0[1]-D/2;
      var x1=barL+barW*slots[i%7]-D/2, y1=rowY-D/2;
      d.style.left=x0+'px';d.style.top=y0+'px';
      try{var an=d.animate([
        {transform:'translate(0,0) scale(.4)',opacity:0},
        {transform:'translate('+((x1-x0)*0.3)+'px,'+((y1-y0)*0.55)+'px) scale(1)',opacity:1,offset:.4},
        {transform:'translate('+(x1-x0)+'px,'+(y1-y0)+'px) scale(1)',opacity:1}
      ],{duration:380/sp,easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'});
      an.onfinish=function(){
        try{an.cancel();}catch(e2){}
        d.style.left=x1+'px';d.style.top=y1+'px';
        d.style.animation='hbaAlBob '+(1.1+i*0.13)+'s ease-in-out infinite';
      };}catch(e){d.style.left=x1+'px';d.style.top=y1+'px';}
      drones.push({el:d,x:x1+D/2,y:y1+D/2,tx:barL+barW*slots[i%7]});
    },i*90/sp);})(i);}
    setTimeout(function(){try{onDone&&onDone(drones);}catch(e){}},(n-1)*90/sp+420/sp);
  }
  function hbaAlLockFlash(midY,sp,drones){
    drones.forEach(function(o){
      var eye=hbaAlEl('hba-al-glow',o.x,o.y,16,16);
      eye.style.background='radial-gradient(circle,#ffffff,#34d399 50%,transparent 78%)';
      try{eye.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.2)',offset:.4},{opacity:0,transform:'translate(-50%,-50%) scale(.6)'}],{duration:260/sp});}catch(e){}
      rm(eye,320/sp);
      var L=Math.hypot(o.tx-o.x,midY-o.y), rot=Math.atan2(midY-o.y,o.tx-o.x);
      var ln=hbaAlEl('hba-al-lockln',o.x,o.y,L,null);
      ln.style.color='#34d399';ln.style.transform='rotate('+rot+'rad)';ln.style.opacity=0;
      try{ln.animate([{opacity:0},{opacity:.9,offset:.25},{opacity:.2,offset:.55},{opacity:.85,offset:.75},{opacity:0}],{duration:340/sp});}catch(e){}
      rm(ln,400/sp);
    });
  }
  function hbaAlBolt(midY,barBot,vw,sz,sp,fxi,o,k){
    var r0=13*sz;
    [0,1,2].forEach(function(ghost){
      setTimeout(function(){
        var b=hbaAlEl('hba-al-bolt',o.x-r0/2,o.y-r0/2,r0,r0);
        b.style.background='radial-gradient(circle at 40% 36%,#ffffff 0%,#a7f3d0 36%,#34d399 66%,transparent 84%)';
        b.style.boxShadow=ghost?'0 0 8px rgba(52,211,153,.4)':'0 0 12px rgba(52,211,153,.95), 0 0 26px rgba(52,211,153,.5)';
        var op=ghost?(.34-ghost*.1):1;
        var dx=o.tx-o.x, dy=midY-3-o.y;
        try{b.animate([
          {transform:'translate(0,0) scale('+(ghost?.7:1)+')',opacity:op},
          {transform:'translate('+dx+'px,'+dy+'px) scale('+(ghost?.6:.9)+')',opacity:ghost?0:op}
        ],{duration:240/sp,easing:'cubic-bezier(.5,.05,.8,.6)',fill:'forwards'});}catch(e){}
        rm(b,300/sp);
      },ghost*36/sp);
    });
    setTimeout(function(){
      hbaAlHit(o.tx,midY,34*sz,240/sp);
      hbaAlRing(o.tx,midY,30*sz,'#34d399',290/sp);
      hbaAlSparks(o.tx,midY,Math.round(5*fxi),.8,barBot+16);
      hbaAlBarGlow(120);hbaAlCombo(k,o.tx,midY,vw);
    },240/sp);
  }
  function hbaAlReturn(bx,by,sp,drones){
    drones.forEach(function(o,i){setTimeout(function(){
      var d=o.el;
      d.style.animation='';
      try{d.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+((bx-o.x)*0.8)+'px,'+((by-o.y)*0.8)+'px) scale(.4)',opacity:0}],{duration:380/sp,easing:'cubic-bezier(.5,.1,.8,.5)',fill:'forwards'});}catch(e){d.style.opacity=0;}
      rm(d,440/sp);
    },i*60/sp);});
  }
  function hbaAlGlyphFly(hx,sz,sp,gl){
    if(!gl)return;
    var D2=58*sz, x1=hx, y1=110;
    var r=gl.getBoundingClientRect();
    var cx=r.left+r.width/2, cy=r.top+r.height/2;
    try{gl.animate([
      {left:cx+'px',top:cy+'px',width:gl.style.width,height:gl.style.height},
      {left:x1+'px',top:y1+'px',width:D2+'px',height:D2+'px'}
    ],{duration:320/sp,easing:'cubic-bezier(.3,.6,.3,1)',fill:'forwards'});}catch(e){gl.style.left=x1+'px';gl.style.top=y1+'px';}
  }
  function hbaAlPreheat(hx,sz,sp,cb){
    var r=10*sz;
    var d=hbaAlEl('hba-al-pre',hx-r/2,-r,r,r);
    d.style.background='radial-gradient(circle,#ffffff,#a7f3d0 55%,transparent 80%)';
    d.style.boxShadow='0 0 12px rgba(52,211,153,.95)';
    try{var an=d.animate([{transform:'translate(0,0) scale(.5)',opacity:0},{opacity:1,offset:.2},{transform:'translate(0,'+(110+r)+'px) scale(1.3)',opacity:1}],{duration:220/sp,easing:'cubic-bezier(.5,.05,.8,.5)',fill:'forwards'});
    an.onfinish=function(){try{cb&&cb();}catch(e){}};}catch(e){setTimeout(function(){try{cb&&cb();}catch(e2){}},220/sp);}
    rm(d,280/sp);
  }
  function hbaAlBeamFire(hx,barL,barW,midY,barBot,vw,sz,sp,fxi,deal){
    var H=Math.round((midY+8)/0.88*Math.min(1.18,Math.max(.8,sz)));
    var W=Math.round(H*300/664);
    var top=midY-Math.round(H*0.88);
    // 🔴BUG#72(Hansen v620修正): 光束【完整显示】——真图底部本就是设计好的自然淡出余焰·爆裂区在图85-95%。原裁切barBot+16恰好切在最亮爆裂区→硬切线; 上一版(v619)淡出遮罩又把爆裂核心淡没了(Hansen: 光效像被切了半截/快看不见)。现盒高=整图高(top+H)·光束+爆裂+触地余焰完整呈现·底部靠图自身alpha自然收尾(无硬切·无变暗)。余焰落在血条下方半个身位的空隙·不触及题目/输入(答题区不受影响)。
    var wrapBot=top+H;
    var box=hbaAlEl('hba-al-beam',hx-W/2,top,W,wrapBot-top);
    // 🔴BUG#72(Hansen): 伤害数字-NN落在光束命中点(一次性·HansenHeroHit读后即清·不设则其他boss仍走v614 boss中线·零影响)
    try{ window.__hsnDmgX=hx; }catch(_e){}
    setTimeout(function(){ try{ if(window.__hsnDmgX===hx) window.__hsnDmgX=null; }catch(_e){} },1200);
    var img;
    if(window.__hbaBeamImg && (window.__hbaBeamReady || window.__hbaBeamImg.complete) && window.__hbaBeamImg.naturalWidth>0){
      img=window.__hbaBeamImg.cloneNode(false);
    } else { img=document.createElement('img'); img.src='bosses/alienbeam_real.webp'; }
    img.style.cssText='position:absolute;left:0;top:0;width:100%;transform-origin:50% 0';
    img.style.height=H+'px';
    img.style.filter='hue-rotate(140deg) saturate(1.15)';
    box.appendChild(img);
    try{img.animate([{transform:'scaleY(0)',opacity:.7},{transform:'scaleY(1)',opacity:1}],{duration:130/sp,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});
    img.animate([{filter:'hue-rotate(140deg) saturate(1.15) brightness(1)'},{filter:'hue-rotate(140deg) saturate(1.3) brightness(1.4)',offset:.22},{filter:'hue-rotate(140deg) saturate(1.15) brightness(1)',offset:.42},{filter:'hue-rotate(140deg) saturate(1.3) brightness(1.35)',offset:.62},{filter:'hue-rotate(140deg) saturate(1.15) brightness(1)'}],{duration:560/sp,delay:130/sp});}catch(e){}
    // 🔴BUG#72(Hansen v620修正): 落地爆裂感增强——光束触底(scaleY完成≈130ms)即刻大爆裂: 大命中辉+强白核瞬爆+四重冲击波环+地面横向冲击+更多径向火花/碎片。Hansen: 打下来那一刻要有强烈爆裂打击感, 然后再掉血——故爆裂在前(150ms)·掉血deal紧随其后(220ms)。
    setTimeout(function(){
      hbaAlVign(.66,600/sp);
      hbaAlHit(hx,midY,Math.round(132*sz*fxi),440/sp);          // 大命中辉(原90→132)
      hbaAlHit(hx,midY,Math.round(52*sz*fxi),250/sp);           // 强白核·瞬爆pop(快闪)
      hbaAlRing(hx,midY,Math.round(50*sz),'#ffffff',320/sp);     // 白色内环
      setTimeout(function(){hbaAlRing(hx,midY,Math.round(80*sz),'#34d399',360/sp);},70/sp);
      setTimeout(function(){hbaAlRing(hx,midY,Math.round(112*sz),'#34d399',400/sp);},150/sp);
      setTimeout(function(){hbaAlRing(hx,midY,Math.round(146*sz),'#6ee7b7',440/sp);},230/sp); // 第四圈外扩(更强冲击波)
      hbaAlGShock(hx,midY,vw,sp);
      hbaAlSparks(hx,midY,Math.round(24*fxi),1.45,barBot+28);    // 火花更多更猛(原15)
      hbaAlShrap(hx,midY,Math.round(8*fxi),barBot+28);           // 碎片更多(原5)
      hbaAlBarGlow(420);
    },150/sp);
    setTimeout(function(){ deal(); },220/sp);                    // 爆裂之后再掉血(Hansen要的顺序)
    var vap=setInterval(function(){
      var mw=hbaAlR(2.2,3.8);
      var m=hbaAlEl('hba-al-vap',hx+hbaAlR(-W*0.36,W*0.36),midY+hbaAlR(-6,6),mw,mw);
      m.style.background=Math.random()<.4?'#ffffff':'#a7f3d0';m.style.boxShadow='0 0 6px #34d399';
      try{m.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+hbaAlR(-10,10)+'px,'+(-hbaAlR(50,110))+'px)',opacity:0}],{duration:hbaAlR(420,640)/sp,easing:'ease-out'});}catch(e){}
      rm(m,700/sp);
    },70);
    setTimeout(function(){clearInterval(vap);},760/sp);
    setTimeout(function(){
      try{img.animate([{transform:'scaleX(1) scaleY(1)',opacity:1},{transform:'scaleX(.06) scaleY(1)',opacity:0}],{duration:170/sp,easing:'cubic-bezier(.6,0,.8,.5)',fill:'forwards'});}catch(e){img.style.opacity=0;}
      rm(box,240/sp);
    },730/sp);
  }
  function hbaAlGlyphShatter(hx,sz,sp,gl){
    if(gl){
      try{gl.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:'translate(-50%,-50%) scale(1.35)',opacity:0}],{duration:260/sp,easing:'ease-out',fill:'forwards'});}catch(e){gl.style.opacity=0;}
      rm(gl,320/sp);
    }
    for(var i=0;i<4;i++){
      var w2=hbaAlR(3,5);
      var s=hbaAlEl('hba-al-spark',hx,110,w2,w2);
      s.style.background='#a7f3d0';s.style.boxShadow='0 0 6px #34d399';
      var ang=hbaAlR(0,Math.PI*2),d2=hbaAlR(20,38);
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+(Math.cos(ang)*d2)+'px,'+(Math.sin(ang)*d2)+'px)',opacity:0}],{duration:hbaAlR(300,440)/sp});}catch(e){}
      rm(s,500/sp);
    }
  }
  function hbaAlAfterGlow(hx,midY,sz,sp){
    var a=hbaAlEl('hba-al-glow',hx,midY,70*sz,22*sz);
    a.style.background='radial-gradient(ellipse,rgba(52,211,153,.55) 0%,rgba(52,211,153,.2) 55%,transparent 80%)';
    try{a.animate([{opacity:.95},{opacity:.5,offset:.5},{opacity:0}],{duration:700/sp,easing:'ease-out'});}catch(e){}
    rm(a,780/sp);
    hbaAlSmoke(hx,midY-4,sp);
  }
  function hbaAlienLord(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:192, bw=br?Math.max(br.width,120):150, bh=br?Math.max(br.height,120):150;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var dome=hbaAlEl('hba-al-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},4800/sp);rm(dome,5500/sp);
    /* ① 入侵领域 */
    hbaAlSkyVeil(sp,4700);
    hbaAlGravField(bx,by,bw,bh,sp,4400);
    setTimeout(function(){hbaAlAnt(bx,by,bw,bh,sp);},200/sp);
    var glyph=null;
    setTimeout(function(){glyph=hbaAlPalmGlyph(bx,by,bw,bh,sz,sp,2900);},380/sp);
    /* ② 无人机僚机群 */
    var n=Math.max(3,Math.round(5*fxi)); if(n>7)n=7;
    var dronesRef=null;
    setTimeout(function(){
      hbaAlDeploy(bx,by,bw,bh,barL,barW,midY,sz,sp,n,function(ds){
        dronesRef=ds;
        hbaAlLockFlash(midY,sp,ds);
      });
    },1100/sp);
    /* ③ 等离子齐射 */
    setTimeout(function(){
      if(!dronesRef)return;
      dronesRef.forEach(function(o,k){setTimeout(function(){
        hbaAlBolt(midY,barBot,vw,sz,sp,fxi,o,k+1);
      },k*190/sp);});
      setTimeout(function(){hbaAlReturn(bx,by,sp,dronesRef);},(dronesRef.length-1)*190/sp+340/sp);
    },2150/sp);
    var lastHit=(2150+(n-1)*190+240)/sp;
    /* ④ 歼星炮轨道湮灭 */
    setTimeout(function(){
      if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 24px rgba(52,211,153,.85)) brightness(1.4)',offset:.2},{filter:'drop-shadow(0 0 14px rgba(52,211,153,.45)) brightness(1.08)',offset:.55},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
      hbaAlGlyphFly(hx,sz,sp,glyph);
      setTimeout(function(){
        hbaAlPreheat(hx,sz,sp,function(){
          hbaAlBeamFire(hx,barL,barW,midY,barBot,vw,sz,sp,fxi,deal);
          setTimeout(function(){hbaAlGlyphShatter(hx,sz,sp,glyph);},760/sp);
          setTimeout(function(){hbaAlAfterGlow(hx,midY,sz,sp);},880/sp);
        });
      },340/sp);
    },lastHit+150/sp);
  }
  /* 🔴 v530: 混沌魔尊(Lv19·legendary)深渊审判·地狱之门——Hansen 定稿: 深渊魔紫·规模100%·速度1.00x·业火强度160%(5道三叉刺)。
     台词三连=分镜: ①"哈哈哈哈哈!"=魔王降世(荆棘火环逼真火焰[贝塞尔火苗SVG·双层内外焰·skew摆动]顺序点燃+黄瞳觉醒+胸口熔岩核心+地狱裂地熔岩纹+余烬上飘+脚下暗影+狂笑震慑波)
     ②"深渊审判!"=审判仪式(三叉戟过载贴立绘+戟尖三叉聚能品字+倒五芒星审判魔法阵压扁透视旋转罩血条+封印符文×4+符文→血条中心锁定光链)
     ③业火三叉连刺(三叉戟形能量矢tridSVG·双残影·1~5连·命中地狱火苗)
     ④"地狱之门已开启!"=地狱之门(左侧·gx=vw*0.195): 空间扭曲波×2+撕裂主缝→哥特石拱门框SVG浮现(顶刺+熔岩缝+铰链+门槛)+门内深渊底→
       双扉浮雕SVG(熔岩刻线+门环+门钉)3D透视轰开78°带过冲回弹+开门冲击(紫光迸出+门口双环)→门内蓄能光点pulse 260ms→
       混沌龙卷光波斜射(复用__hbaWaveImg·BUG#67三件判定·473×440·命中冲击中心=图高80%对准(cx,midY)·θ=-atan2(ddx,ddy)[屏幕系顺时针修正]·
       rotate在独立包层rotW[keyframes同帧clipPath+transform会丢rotate]·clip揭示inset(0 0 100%→0)从无到有光带逐段推进450ms+锋头光球沿斜线开路+穿越光屑)→
       盘端砸正中: 下压回弹+柔光.62+爆闪+三重环+地面冲击波+火花24+碎片8+deal≈5030ms兜底5400+三连灼烧环+汽化光屑interval+
       吞噬倒吸(爆出粒子29颗炸开45%后反吸回门内+吸入光屑9颗)→光波clip反向缩回门内+门内光点回闪→双扉合上→门框/深渊缩回→裂缝愈合→腐蚀地狱火+烟。
     空间适配: wrapper包络矩形底裁barBot+16·汽化只向上·火花/碎片坠程钳位——答题区零侵犯。零震屏零屏闪(柔光≤.62)。 */
  function hbaHlEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaHlR(a,b){return a+Math.random()*(b-a);}
  function hbaHlVign(peak,ms){var v=hbaHlEl('hba-hl-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(168,85,247,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaHlRing(x,y,sz0,col,ms){var r=hbaHlEl('hba-hl-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaHlHit(x,y,szp,ms){var h=hbaHlEl('hba-hl-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#e9d5ff 32%,rgba(168,85,247,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaHlSparks(x,y,n,pow,capY){
    for(var i=0;i<n;i++){
      var w=hbaHlR(2,3.4);
      var s=hbaHlEl('hba-hl-spark',x,y,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#c084fc';s.style.boxShadow='0 0 6px #c084fc';
      var ang=hbaHlR(0,Math.PI*2),v=hbaHlR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaHlR(8,22)+hbaHlR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaHlR(380,620),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,680);
    }
  }
  function hbaHlShrap(x,y,n,capY){
    for(var i=0;i<n;i++){var w=hbaHlR(3,6),h=hbaHlR(2,3.5);
      var s=hbaHlEl('hba-hl-shrap',x,y,w,h);
      s.style.background='linear-gradient(135deg,#e9d5ff,#a855f7)';s.style.boxShadow='0 0 3px rgba(168,85,247,.6)';
      var ang=hbaHlR(-2.6,-0.5),v=hbaHlR(30,64),dx=Math.cos(ang)*v*hbaHlR(.8,1.4),dy=Math.sin(ang)*v+hbaHlR(40,70);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) rotate('+hbaHlR(-540,540)+'deg)',opacity:0}],{duration:hbaHlR(460,700),easing:'cubic-bezier(.3,.5,.6,1)'});}catch(e){}
      rm(s,760);
    }
  }
  function hbaHlCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-hl-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaHlBarGlow(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaHlSmoke(x,y,sp){
    for(var i=0;i<3;i++){(function(i){setTimeout(function(){
      var w=hbaHlR(8,14);
      var s=hbaHlEl('hba-hl-smoke',x+hbaHlR(-16,16),y,w,w);
      s.style.background='radial-gradient(circle,rgba(168,85,247,.35),rgba(168,85,247,.12) 60%,transparent 80%)';
      try{s.animate([{transform:'translate(0,0) scale(.6)',opacity:.7},{transform:'translate('+hbaHlR(-12,12)+'px,'+(-hbaHlR(36,66))+'px) scale(1.7)',opacity:0}],{duration:hbaHlR(700,1000)/sp,easing:'ease-out'});}catch(e){}
      rm(s,1100/sp);
    },i*130/sp);})(i);}
  }
  function hbaHlGShock(cx,midY,vw,sp){
    [[-1,'100% 50%'],[1,'0 50%']].forEach(function(d){
      var w=d[0]<0?(cx-8):(vw-cx-8);
      var s=hbaHlEl('hba-hl-gshock',d[0]<0?(cx-w):cx,midY+4,w,null);
      s.style.transformOrigin=d[1];
      s.style.background=d[0]<0?'linear-gradient(90deg,transparent,#c084fc 60%,#ffffff)':'linear-gradient(90deg,#ffffff,#c084fc 40%,transparent)';
      s.style.boxShadow='0 0 10px rgba(168,85,247,.7)';
      try{s.animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(1)',opacity:.95,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}
      rm(s,400/sp);
    });
  }
  /* 逼真火焰(贝塞尔火苗·外焰+内焰+白炽芯·skew摆动) */
  function hbaHlFlameSVG(W,H,seed2){
    var id='hhf'+Math.floor(Math.random()*1e6);
    var sway=(seed2%2?1:-1)*(2+seed2%3);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 20 30" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#f97316"/><stop offset="55%" stop-color="#f97316"/><stop offset="100%" stop-color="#fde047" stop-opacity=".9"/></linearGradient></defs>'
      +'<path d="M10,29 C4.5,25 2.5,20 4,15 C5,11.5 7,9 8,5.5 C8.6,3.5 9.4,1.8 10,0.5 C10.6,2.5 11.6,4.5 12.6,7 C14,10 16,13 15.6,17.5 C15.2,22.5 13.5,26 10,29 Z" fill="url(#'+id+')" opacity=".92" transform="rotate('+sway+' 10 29)"/>'
      +'<path d="M10,27.5 C7,24.5 6,20.5 7,17 C7.8,14.5 9,12.5 10,9.5 C11,12.5 12.4,15 12.8,18 C13.2,21.5 12.2,25 10,27.5 Z" fill="#fde047" opacity=".95" transform="rotate('+(sway*0.6)+' 10 27)"/>'
      +'<ellipse cx="10" cy="24.5" rx="2.4" ry="3.6" fill="#ffffff" opacity=".88"/></svg>';
  }
  function hbaHlFlame(x,y,w,life){
    var H=w*1.55;
    var f=hbaHlEl('hba-hl-flame',x-w/2,y-H,w,H);
    f.innerHTML=hbaHlFlameSVG(w,H,Math.floor(Math.random()*9));
    f.style.filter='drop-shadow(0 0 6px rgba(249,115,22,.85)) drop-shadow(0 0 13px rgba(168,85,247,.4))';
    var svg=f.querySelector('svg');
    try{f.animate([{transform:'scaleY(.25)',opacity:0},{transform:'scaleY(1.08)',opacity:1,offset:.28},{transform:'scaleY(.92)',opacity:.95,offset:.55},{transform:'scaleY(1.02)',opacity:.9,offset:.78},{transform:'scaleY(.3)',opacity:0}],{duration:life,easing:'ease-in-out'});
    if(svg)svg.animate([{transform:'skewX(-4deg) scaleX(1)'},{transform:'skewX(5deg) scaleX(.92)'},{transform:'skewX(-3deg) scaleX(1.04)'},{transform:'skewX(4deg) scaleX(.95)'}],{duration:Math.max(220,life*0.42),iterations:Infinity,direction:'alternate'});}catch(e){}
    rm(f,life+70);
  }
  /* ① 魔王降世 */
  function hbaHlGroundCracks(bx,bsBot,bw,sp,life){
    [[-0.28,-0.10],[0.05,0.07],[0.30,-0.06]].forEach(function(o,i){setTimeout(function(){
      var len=hbaHlR(26,44), rot=o[1]+(Math.random()<.5?Math.PI:0);
      var c=hbaHlEl('hba-hl-rip',bx+bw*o[0],bsBot-8,len,null);
      c.style.height='2px';c.style.transformOrigin='0 50%';
      c.style.background='linear-gradient(90deg,#fde047,#f97316 45%,rgba(249,115,22,.4) 80%,transparent)';
      c.style.boxShadow='0 0 7px rgba(249,115,22,.85)';
      c.style.transform='rotate('+rot+'rad) scaleX(0)';
      try{c.animate([{transform:'rotate('+rot+'rad) scaleX(0)',opacity:1},{transform:'rotate('+rot+'rad) scaleX(1)',opacity:.95,offset:.18},{opacity:.6,offset:.5},{opacity:.9,offset:.62},{opacity:.7,offset:.9},{opacity:0}],{duration:life/sp,fill:'forwards'});}catch(e){}
      rm(c,life/sp+80);
    },i*120/sp);});
    var iv=setInterval(function(){
      var w=hbaHlR(2,3.2);
      var em=hbaHlEl('hba-hl-spark',bx+hbaHlR(-bw*0.34,bw*0.34),bsBot-10,w,w);
      em.style.background=Math.random()<.5?'#fde047':'#f97316';em.style.boxShadow='0 0 5px rgba(249,115,22,.85)';
      try{em.animate([{transform:'translate(0,0)',opacity:.9},{transform:'translate('+hbaHlR(-10,10)+'px,'+(-hbaHlR(30,60))+'px)',opacity:0}],{duration:hbaHlR(700,1100)/sp,easing:'ease-out'});}catch(e){}
      rm(em,1200/sp);
    },200);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  function hbaHlCrownFire(bx,by,bw,bh,sp,life){
    var W=bw*0.34, H2=W*0.4;
    var c=hbaHlEl('hba-hl-crown',bx,by-bh*0.40,W,H2);
    c.innerHTML='<div style="position:absolute;left:0;top:30%;right:0;bottom:0;border:2.5px solid #f97316;border-radius:50%;box-shadow:0 0 12px rgba(168,85,247,.8), 0 0 22px rgba(249,115,22,.6);opacity:.92"></div>';
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)',offset:.15},{opacity:.95,offset:.9},{opacity:0}],{duration:life/sp,fill:'forwards'});}catch(e){}
    rm(c,life/sp+80);
    [-0.42,-0.21,0,0.21,0.42].forEach(function(ox,i){setTimeout(function(){
      hbaHlFlame(bx+W*ox, by-bh*0.40-H2*0.18, hbaHlR(8,11), hbaHlR(520,680)/sp);
    },(120+i*85)/sp);});
    var iv=setInterval(function(){
      hbaHlFlame(bx+hbaHlR(-W*0.42,W*0.42), by-bh*0.40-H2*0.18, hbaHlR(7,11), hbaHlR(480,680)/sp);
    },130);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  function hbaHlEyes(bsEl,bx,by,bw,bh,sp){
    [[-0.045,-0.14],[0.025,-0.14]].forEach(function(o,i){setTimeout(function(){
      var x=bx+bw*o[0], y=by+bh*o[1], r=9;
      var e2=hbaHlEl('hba-hl-eye',x-r/2,y-r/2,r,r);
      e2.style.background='radial-gradient(circle,#fff 0%,#fde047 40%,rgba(250,204,21,.5) 68%,transparent 82%)';
      e2.style.boxShadow='0 0 9px rgba(250,204,21,.95), 0 0 20px rgba(250,204,21,.5)';
      try{e2.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.5)',opacity:1,offset:.3},{transform:'scale(1)',opacity:.95,offset:.5},{transform:'scale(1)',opacity:.9}],{duration:2400/sp,fill:'forwards'});}catch(e){}
      rm(e2,2500/sp);
    },i*90/sp);});
    if(bsEl){try{bsEl.animate([{filter:'brightness(.72)'},{filter:'brightness(1.12) drop-shadow(0 0 16px rgba(168,85,247,.45))',offset:.3},{filter:'brightness(.92)',offset:.45},{filter:'brightness(1.06)',offset:.62},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
  }
  function hbaHlCore(bx,by,bw,bh,sz,sp){
    var r=20*sz;
    var c=hbaHlEl('hba-hl-core',bx-bw*0.01,by-bh*0.03,r,r);
    c.style.background='radial-gradient(circle,#fecaca 0%,rgba(239,68,68,.5) 55%,transparent 78%)';
    c.style.boxShadow='0 0 14px rgba(239,68,68,.7)';
    try{c.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:.9,offset:.3},{transform:'translate(-50%,-50%) scale(1.12)',opacity:.7,offset:.6},{transform:'translate(-50%,-50%) scale(1)',opacity:.85,offset:.85},{opacity:0}],{duration:2300/sp});}catch(e){}
    rm(c,2400/sp);
  }
  function hbaHlMist(bx,bsBot,bw,sp,life){
    var iv=setInterval(function(){
      var w=hbaHlR(16,26);
      var m=hbaHlEl('hba-hl-mist',bx+hbaHlR(-bw*0.4,bw*0.4)-w/2,bsBot-10,w,w);
      m.style.background='radial-gradient(circle,rgba(168,85,247,.4),rgba(168,85,247,.14) 58%,transparent 80%)';
      try{m.animate([{transform:'translate(0,0) scale(.5)',opacity:.75},{transform:'translate('+hbaHlR(-30,30)+'px,'+(-hbaHlR(2,10))+'px) scale(1.8)',opacity:0}],{duration:hbaHlR(800,1200)/sp,easing:'ease-out'});}catch(e){}
      rm(m,1300/sp);
    },170);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  function hbaHlLaughWave(bx,by,bw,sp){
    [0,200].forEach(function(d){setTimeout(function(){
      var w=hbaHlEl('hba-hl-lwave',bx,by,bw*1.1,bw*1.1);w.style.color='#c084fc';
      w.style.boxShadow='0 0 12px rgba(168,85,247,.5)';
      try{w.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:.85},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:560/sp,easing:'ease-out'});}catch(e){}
      rm(w,640/sp);
    },d/sp);});
  }
  /* ② 深渊审判 */
  function hbaHlTridOverload(bx,by,bw,bh,sz,sp){
    var hxx=bx-bw*0.255, hyy=by+bh*0.05, txx=bx-bw*0.335, tyy=by-bh*0.43;
    var L=Math.hypot(txx-hxx,tyy-hyy), rot=Math.atan2(txx-hxx,-(tyy-hyy));
    var b=hbaHlEl('hba-hl-trid',hxx-4.5*sz,hyy,9*sz,0);
    b.style.transform='rotate('+rot+'rad)';
    b.style.background='linear-gradient(180deg,#ffffff 0%,#e9d5ff 30%,rgba(168,85,247,.7) 70%,transparent)';
    b.style.boxShadow='0 0 12px rgba(168,85,247,.9), 0 0 26px rgba(168,85,247,.5)';
    try{b.animate([{height:'0px',opacity:.4},{height:L+'px',opacity:1,offset:.55},{height:L+'px',opacity:.92}],{duration:560/sp,easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'});
    b.animate([{filter:'brightness(1)'},{filter:'brightness(1.6)'},{filter:'brightness(1)'}],{duration:420/sp,iterations:3,delay:560/sp});}catch(e){}
    rm(b,1950/sp);
    [[-7,0],[0,-6],[7,0]].forEach(function(o,i){setTimeout(function(){
      var r=10*sz;
      var c=hbaHlEl('hba-hl-tcharge',txx+o[0]*sz-r/2,tyy+o[1]*sz-r/2,r,r);
      c.style.background='radial-gradient(circle,#ffffff,#e9d5ff 50%,transparent 80%)';
      c.style.boxShadow='0 0 10px rgba(168,85,247,.95)';
      try{c.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.1)',opacity:1,offset:.4},{transform:'scale(.95)',opacity:.9}],{duration:480/sp,fill:'forwards'});}catch(e){}
      rm(c,1500/sp);
    },(380+i*110)/sp);});
  }
  function hbaHlCircleSVG(D){
    return '<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="47" fill="none" stroke="#c084fc" stroke-width="2" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="39" fill="none" stroke="#e9d5ff" stroke-width="1.2" stroke-dasharray="6 4"/>'
      +'<polygon points="50,88 14,28 86,28" fill="none" stroke="#e9d5ff" stroke-width="1.8" opacity=".9"/>'
      +'<polygon points="50,12 86,72 14,72" fill="none" stroke="#c084fc" stroke-width="1.4" opacity=".7"/>'
      +'<circle cx="50" cy="50" r="8" fill="none" stroke="#ffffff" stroke-width="1.6"/></svg>';
  }
  function hbaHlJudgeCircle(hx,midY,sz,sp,life){
    var D=120*sz;
    var c=hbaHlEl('hba-hl-circle',hx,midY,D,Math.round(D*0.42));
    c.innerHTML='<div style="position:absolute;left:0;top:0;width:100%;height:100%">'+hbaHlCircleSVG(D)+'</div>';
    var inner=c.firstChild; inner.style.transform='scaleY(0.42)'; inner.style.transformOrigin='50% 50%';
    var svg=c.querySelector('svg'); if(svg){svg.style.position='absolute';svg.style.left='0';svg.style.top=(-D*0.29)+'px';}
    c.style.filter='drop-shadow(0 0 8px rgba(168,85,247,.7))';
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(-360deg)'}],{duration:2600/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
  }
  function hbaHlSealRunes(hx,barL,barW,midY,sz,sp,life){
    var pad=16;
    [[barL-pad,midY-15],[barL+barW+pad,midY-15],[barL-pad,midY+15],[barL+barW+pad,midY+15]].forEach(function(c2,i){setTimeout(function(){
      var D=14*sz;
      var r=hbaHlEl('hba-hl-rune',c2[0],c2[1],D,D);
      r.innerHTML='<svg width="'+D+'" height="'+D+'" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><polygon points="10,17 3,5 17,5" fill="none" stroke="#c084fc" stroke-width="1.6"/><circle cx="10" cy="10" r="8.5" fill="none" stroke="#e9d5ff" stroke-width="1" stroke-dasharray="3 2.4"/></svg>';
      r.style.filter='drop-shadow(0 0 5px rgba(168,85,247,.8))';
      var svg=r.querySelector('svg');
      try{r.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.2},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
      if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1800/sp,iterations:Infinity});}catch(e){}
      rm(r,life/sp+80);
      setTimeout(function(){
        var L=Math.hypot(hx-c2[0],midY-c2[1]), lrot=Math.atan2(midY-c2[1],hx-c2[0]);
        var ln=hbaHlEl('hba-hl-rip',c2[0],c2[1],L,null);ln.style.height='1.5px';
        ln.style.transformOrigin='0 50%';ln.style.transform='rotate('+lrot+'rad)';
        ln.style.background='linear-gradient(90deg,#e9d5ff,rgba(168,85,247,.4) 60%,transparent)';
        ln.style.boxShadow='0 0 5px rgba(168,85,247,.8)';
        try{ln.animate([{opacity:0},{opacity:.9,offset:.3},{opacity:.2,offset:.6},{opacity:.85,offset:.8},{opacity:0}],{duration:380/sp});}catch(e){}
        rm(ln,440/sp);
      },240/sp);
    },i*70/sp);});
  }
  /* ③ 业火三叉连刺 */
  function hbaHlTridSVG(W,H){
    var id='hht'+Math.floor(Math.random()*1e6);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 30 60" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#c084fc"/><stop offset="100%" stop-color="#a855f7" stop-opacity=".25"/></linearGradient></defs>'
      +'<path d="M15,2 L18.5,16 L15,12.5 L11.5,16 Z M5,8 L8.5,19 L5,16 L2.5,19.5 Z M25,8 L27.5,19.5 L25,16 L21.5,19 Z" fill="#e9d5ff" stroke="#ffffff" stroke-width="1"/>'
      +'<rect x="13.4" y="12" width="3.2" height="44" rx="1.6" fill="#c084fc" opacity=".9"/>'
      +'<rect x="3.8" y="14" width="2.4" height="9" rx="1.2" fill="#c084fc" opacity=".8"/><rect x="23.8" y="14" width="2.4" height="9" rx="1.2" fill="#c084fc" opacity=".8"/>'
      +'<rect x="2.5" y="21.5" width="25" height="2.6" rx="1.3" fill="#c084fc" opacity=".85"/></svg>';
  }
  function hbaHlTridentBolt(bx,by,bw,bh,barL,barW,midY,barBot,vw,sz,sp,fxi,tx,k){
    var W=26*sz,H=52*sz;
    var x1=bx-bw*0.31+hbaHlR(-6,6), y1=by-bh*0.26+hbaHlR(-8,8);
    var dx=tx-x1, dy=midY-6-y1;
    var rot=Math.atan2(dy,dx)*180/Math.PI-90;
    [2,1,0].forEach(function(main){setTimeout(function(){
      var s=hbaHlEl('hba-hl-bolt',x1-W/2,y1-H/2,W,H);
      s.innerHTML=hbaHlTridSVG(W,H);
      s.style.filter='drop-shadow(0 0 6px rgba(168,85,247,.9)) drop-shadow(0 0 14px rgba(168,85,247,.45))';
      var op=main===2?1:(main===1?.4:.22), sc=main===2?1:(main===1?.86:.72);
      try{s.animate([
        {transform:'translate(0,0) rotate('+rot+'deg) scale(.5)',opacity:0},
        {transform:'translate('+(dx*0.15)+'px,'+(dy*0.15)+'px) rotate('+rot+'deg) scale('+sc+')',opacity:op,offset:.15},
        {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+sc+')',opacity:op,offset:.92},
        {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+sc+')',opacity:0}
      ],{duration:260/sp,easing:'cubic-bezier(.45,.05,.75,.7)',fill:'forwards'});}catch(e){}
      rm(s,320/sp);
    },(2-main)*36/sp);});
    setTimeout(function(){
      hbaHlHit(tx,midY,36*sz,240/sp);
      hbaHlRing(tx,midY,30*sz,'#c084fc',290/sp);
      hbaHlSparks(tx,midY,Math.round(5*fxi),.8,barBot+16);
      hbaHlFlame(tx+hbaHlR(-8,8),midY+3,hbaHlR(8,11)*sz,hbaHlR(360,520)/sp);
      hbaHlBarGlow(120);hbaHlCombo(k,tx,midY,vw);
    },250/sp);
  }
  /* ④ 地狱之门(左侧·哥特拱门·3D开门·光波斜射) */
  function hbaHlGateRip(sp,gx,gyC,gh){
    [0,140].forEach(function(d){setTimeout(function(){
      var w=hbaHlEl('hba-hl-lwave',gx,gyC,70,Math.round(gh*0.9));w.style.color='#c084fc';
      w.style.boxShadow='0 0 10px rgba(168,85,247,.5)';
      try{w.animate([{transform:'translate(-50%,-50%) scale(.2,.5)',opacity:.85},{transform:'translate(-50%,-50%) scale(2.2,1.15)',opacity:0}],{duration:520/sp,easing:'ease-out'});}catch(e){}
      rm(w,600/sp);
    },d/sp);});
    var r=hbaHlEl('hba-hl-rip',gx,gyC-gh/2,3,gh);
    r.style.background='linear-gradient(180deg,transparent,#ffffff 18%,#e9d5ff 50%,#ffffff 82%,transparent)';
    r.style.boxShadow='0 0 12px rgba(168,85,247,.95), 0 0 30px rgba(168,85,247,.55)';
    try{r.animate([{transform:'translateX(-50%) scaleY(0)',opacity:0},{transform:'translateX(-50%) scaleY(1)',opacity:1,offset:.5},{transform:'translateX(-50%) scaleY(1)',opacity:.9}],{duration:200/sp,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});}catch(e){}
    rm(r,560/sp);
  }
  function hbaHlGateFrameSVG(GW,GH){
    return '<svg width="'+GW+'" height="'+GH+'" viewBox="0 0 108 178" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<path d="M44,13 L48,-4 L52,13 Z M28,18 L31,5 L35,17 Z M73,17 L77,5 L80,18 Z" fill="#2b1838" stroke="#a855f7" stroke-width="1"/>'
      +'<path d="M10,178 L10,64 Q10,16 54,10 Q98,16 98,64 L98,178" fill="none" stroke="#241430" stroke-width="11" stroke-linecap="round"/>'
      +'<path d="M10,178 L10,64 Q10,16 54,10 Q98,16 98,64 L98,178" fill="none" stroke="#3b2152" stroke-width="7"/>'
      +'<path d="M10,178 L10,64 Q10,16 54,10 Q98,16 98,64 L98,178" fill="none" stroke="#c084fc" stroke-width="1.4" stroke-dasharray="10 7" opacity=".85"/>'
      +'<path d="M9,92 l-2,16 M99,84 l2,18 M30,21 l8,-5 M97,140 l3,12 M11,150 l-3,10" stroke="#f97316" stroke-width="2" stroke-linecap="round" opacity=".9"/>'
      +'<rect x="2" y="172" width="104" height="7" rx="2.5" fill="#241430" stroke="#3b2152" stroke-width="1.5"/>'
      +'<circle cx="10" cy="64" r="3.2" fill="#e9d5ff"/><circle cx="98" cy="64" r="3.2" fill="#e9d5ff"/></svg>';
  }
  function hbaHlGateDoorSVG(){
    var id='hgd'+Math.floor(Math.random()*1e6);
    return '<svg width="100%" height="100%" viewBox="0 0 44 158" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1f1130"/><stop offset="100%" stop-color="#0e0718"/></linearGradient></defs>'
      +'<path d="M2,158 L2,48 Q2,15 43,7 L43,158 Z" fill="#160c22" stroke="#3b2152" stroke-width="2"/>'
      +'<path d="M10,150 L10,46 Q10,26 36,18 L36,150 Z" fill="none" stroke="#4c2a66" stroke-width="1.5" opacity=".8"/>'
      +'<path d="M14,60 l7,22 l-4,18 M27,40 l5,26" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>'
      +'<circle cx="34" cy="88" r="4.5" fill="none" stroke="#b88a3a" stroke-width="1.8"/><circle cx="34" cy="93" r="1.4" fill="#b88a3a"/>'
      +'<circle cx="6" cy="70" r="1.5" fill="#6b4d8a"/><circle cx="6" cy="100" r="1.5" fill="#6b4d8a"/><circle cx="6" cy="130" r="1.5" fill="#6b4d8a"/><circle cx="38" cy="130" r="1.5" fill="#6b4d8a"/></svg>';
  }
  function hbaHlGate(sz,sp,gx,gyC,GH,GW){
    var doors={};
    var dark=hbaHlEl('hba-hl-gframe',gx-GW*0.40,gyC-GH*0.42,Math.round(GW*0.80),Math.round(GH*0.90));
    dark.style.borderRadius='46% 46% 5px 5px / 34% 34% 5px 5px';
    dark.style.background='radial-gradient(ellipse at 50% 42%,#0a0414 0%,#150a22 62%,rgba(168,85,247,.28) 92%)';
    dark.style.boxShadow='inset 0 0 30px rgba(0,0,0,.9), 0 0 18px rgba(168,85,247,.35)';
    try{dark.animate([{transform:'scale(.25)',opacity:0},{transform:'scale(1)',opacity:1,offset:.55},{opacity:1}],{duration:240/sp,easing:'cubic-bezier(.25,.8,.3,1)',fill:'forwards'});}catch(e){}
    doors.dark=dark;
    var frame=hbaHlEl('hba-hl-gframe',gx-GW/2,gyC-GH/2,GW,GH);
    frame.innerHTML=hbaHlGateFrameSVG(GW,GH);
    frame.style.filter='drop-shadow(0 0 9px rgba(168,85,247,.75)) drop-shadow(0 0 22px rgba(168,85,247,.4))';
    try{frame.animate([{transform:'scale(.25)',opacity:0},{transform:'scale(1.06)',opacity:1,offset:.62},{transform:'scale(1)',opacity:1}],{duration:240/sp,easing:'cubic-bezier(.25,.8,.35,1.1)',fill:'forwards'});}catch(e){}
    doors.frame=frame;
    var pv=hbaHlEl('hba-hl-gpv',gx-GW*0.40,gyC-GH*0.42,Math.round(GW*0.80),Math.round(GH*0.88));
    doors.pv=pv; doors.L=null; doors.R=null;
    setTimeout(function(){
      [[-1],[1]].forEach(function(dd){
        var d=dd[0];
        var door=document.createElement('div');door.className='hba-hl-gdoor';
        door.style.left=d<0?'0':'50%';
        door.style.transformOrigin=(d<0?'left':'right')+' center';
        var inner=document.createElement('div');
        inner.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;'+(d>0?'transform:scaleX(-1);':'');
        inner.innerHTML=hbaHlGateDoorSVG();
        door.appendChild(inner);
        door.style.filter='drop-shadow(0 0 6px rgba(0,0,0,.7))';
        pv.appendChild(door);
        try{door.animate([
          {transform:'rotateY(0deg)'},
          {transform:'rotateY('+(d<0?-84:84)+'deg)',offset:.66},
          {transform:'rotateY('+(d<0?-74:74)+'deg)',offset:.84},
          {transform:'rotateY('+(d<0?-78:78)+'deg)'}
        ],{duration:420/sp,easing:'cubic-bezier(.35,.08,.35,1)',fill:'forwards'});}catch(e){door.style.transform='rotateY('+(d<0?-78:78)+'deg)';}
        if(d<0)doors.L=door;else doors.R=door;
      });
      var burst=hbaHlEl('hba-hl-hit',gx,gyC,Math.round(GW*0.7),Math.round(GW*0.7));
      burst.style.background='radial-gradient(circle,#e9d5ff 0%,rgba(168,85,247,.5) 50%,transparent 76%)';
      try{burst.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:.95,offset:.4},{transform:'translate(-50%,-50%) scale(1.25)',opacity:0}],{duration:340/sp,easing:'ease-out'});}catch(e){}
      rm(burst,400/sp);
      [0,130].forEach(function(dl){setTimeout(function(){hbaHlRing(gx,gyC,Math.round(GW*0.85),'#c084fc',360/sp);},dl/sp);});
    },260/sp);
    return doors;
  }
  function hbaHlGateClose(sp,doors,gx,gyC,gh){
    [doors.L,doors.R].forEach(function(door,i){
      if(!door)return;var d=i===0?-1:1;
      try{door.animate([{transform:'rotateY('+(d<0?-78:78)+'deg)'},{transform:'rotateY(0deg)'}],{duration:300/sp,easing:'cubic-bezier(.5,.05,.6,1)',fill:'forwards'});}catch(e){door.style.transform='rotateY(0deg)';}
    });
    setTimeout(function(){
      [doors.frame,doors.dark,doors.pv].forEach(function(el2){
        if(!el2)return;
        try{el2.animate([{transform:'scale(1)',opacity:1},{transform:'scale(.2)',opacity:0}],{duration:240/sp,easing:'cubic-bezier(.6,0,.8,.4)',fill:'forwards'});}catch(e){el2.style.opacity=0;}
        rm(el2,310/sp);
      });
      setTimeout(function(){
        var r=hbaHlEl('hba-hl-rip',gx,gyC-gh/2,2,gh);
        r.style.background='linear-gradient(180deg,transparent,#e9d5ff 50%,transparent)';
        r.style.boxShadow='0 0 9px rgba(168,85,247,.8)';
        try{r.animate([{transform:'translateX(-50%) scaleY(1)',opacity:.9},{transform:'translateX(-50%) scaleY(0)',opacity:0}],{duration:240/sp,easing:'ease-in'});}catch(e){}
        rm(r,300/sp);
      },220/sp);
    },320/sp);
  }
  function hbaHlVortexFire(gx,gyC,cx,midY,barL,barW,barBot,vw,sz,sp,fxi,deal){
    var ddx=cx-gx, ddy=midY-gyC;
    var Ldist=Math.hypot(ddx,ddy), theta=-Math.atan2(ddx,ddy);
    var H=Math.round(Ldist/0.80*Math.min(1.15,Math.max(.85,sz)));
    var W=Math.round(H*473/440);
    var wrapL=Math.round(Math.min(gx,cx)-W*0.62), wrapT=gyC-26;
    var wrapR=Math.round(Math.max(gx,cx)+W*0.62), wrapB=barBot+16;
    var seed=hbaHlEl('hba-hl-tcharge',gx-4.5*sz,gyC-4.5*sz,9*sz,9*sz);
    seed.style.background='radial-gradient(circle,#ffffff,#e9d5ff 50%,transparent 80%)';
    seed.style.boxShadow='0 0 12px rgba(168,85,247,.95), 0 0 26px rgba(168,85,247,.55)';
    try{seed.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.3)',opacity:1,offset:.3},{transform:'scale(.8)',opacity:.7,offset:.55},{transform:'scale(1.4)',opacity:1,offset:.8},{transform:'scale(.4)',opacity:0}],{duration:280/sp,easing:'ease-in-out'});}catch(e){}
    rm(seed,340/sp);
    var box=hbaHlEl('hba-hl-vortex',wrapL,wrapT,wrapR-wrapL,wrapB-wrapT);
    var img;
    if(window.__hbaWaveImg && (window.__hbaWaveReady || window.__hbaWaveImg.complete) && window.__hbaWaveImg.naturalWidth>0){
      img=window.__hbaWaveImg.cloneNode(false);
    } else { img=document.createElement('img'); img.src='bosses/chaoswave_real.webp'; }
    img.style.cssText='position:absolute;left:0;top:0;width:100%';
    img.style.height=H+'px';
    img.style.filter='saturate(1.12) drop-shadow(0 0 14px rgba(168,85,247,.9)) drop-shadow(0 0 30px rgba(168,85,247,.5))';
    var rotW=document.createElement('div');
    rotW.style.cssText='position:absolute;left:'+(gx-wrapL-W/2)+'px;top:'+(gyC-wrapT)+'px;width:'+W+'px;height:'+H+'px;transform-origin:50% 0;transform:rotate('+theta+'rad);pointer-events:none';
    rotW.appendChild(img);
    box.appendChild(rotW);
    var T=450/sp, DLY=260/sp;
    img.style.clipPath='inset(0 0 100% 0)';img.style.webkitClipPath='inset(0 0 100% 0)';
    try{img.animate([
      {clipPath:'inset(0 0 100% 0)',opacity:.95},
      {clipPath:'inset(0 0 62% 0)',opacity:1,offset:.3},
      {clipPath:'inset(0 0 22% 0)',opacity:1,offset:.66},
      {clipPath:'inset(0 0 0% 0)',opacity:1}
    ],{duration:T,delay:DLY,easing:'cubic-bezier(.45,.08,.8,.5)',fill:'both'});
    try{img.animate([{filter:'saturate(1.12) brightness(1)'},{filter:'saturate(1.3) brightness(1.42)',offset:.25},{filter:'saturate(1.12) brightness(1)',offset:.5},{filter:'saturate(1.26) brightness(1.34)',offset:.74},{filter:'saturate(1.12) brightness(1)'}],{duration:620/sp,delay:T+DLY});}catch(e2){}
    box.animate([{transform:'translateY(0)'},{transform:'translateY(5px)',offset:.4},{transform:'translateY(0)'}],{duration:140/sp,delay:DLY+T,easing:'ease-out'});}catch(e){try{img.style.clipPath='inset(0 0 0 0)';}catch(e2){}}
    var head=hbaHlEl('hba-hl-tcharge',gx-8*sz,gyC-8*sz,16*sz,16*sz);
    head.style.background='radial-gradient(circle,#ffffff 0%,#e9d5ff 42%,rgba(168,85,247,.55) 70%,transparent 84%)';
    head.style.boxShadow='0 0 14px rgba(168,85,247,.95), 0 0 30px rgba(168,85,247,.55)';
    try{head.animate([
      {transform:'translate(0,0) scale(.7)',opacity:0},
      {transform:'translate(0,0) scale(1)',opacity:1,offset:.06},
      {transform:'translate('+(ddx*0.38)+'px,'+(ddy*0.38)+'px) scale(1.05)',opacity:1,offset:.3},
      {transform:'translate('+(ddx*0.78)+'px,'+(ddy*0.78)+'px) scale(1.12)',opacity:1,offset:.66},
      {transform:'translate('+ddx+'px,'+ddy+'px) scale(1.5)',opacity:.9,offset:.97},
      {transform:'translate('+ddx+'px,'+ddy+'px) scale(.3)',opacity:0}
    ],{duration:T+40/sp,delay:DLY,easing:'cubic-bezier(.45,.08,.8,.5)',fill:'both'});}catch(e){}
    rm(head,DLY+T+120/sp);
    setTimeout(function(){
      var fly=setInterval(function(){
        var fw=hbaHlR(1.5,3), fp=hbaHlR(.12,.62);
        var fs=hbaHlEl('hba-hl-spark',gx+ddx*fp+hbaHlR(-W*0.18,W*0.18),gyC+ddy*fp+hbaHlR(-14,14),fw,fw);
        fs.style.background=Math.random()<.5?'#ffffff':'#e9d5ff';fs.style.boxShadow='0 0 5px #c084fc';
        try{fs.animate([{transform:'translate(0,0)',opacity:.9},{transform:'translate('+hbaHlR(-26,26)+'px,'+(-hbaHlR(18,38))+'px)',opacity:0}],{duration:hbaHlR(150,240),easing:'ease-out'});}catch(e){}
        rm(fs,280);
      },42);
      setTimeout(function(){clearInterval(fly);},T);
    },DLY);
    setTimeout(function(){
      var vr=hbaHlEl('hba-hl-vring',cx,midY,Math.round(W*0.5),Math.round(W*0.17));
      vr.style.background='conic-gradient(from 0deg,rgba(168,85,247,.0) 0deg,rgba(168,85,247,.65) 80deg,rgba(168,85,247,.0) 160deg,rgba(168,85,247,.55) 250deg,rgba(168,85,247,.0) 360deg)';
      vr.style.borderRadius='50%';
      try{vr.animate([{transform:'translate(-50%,-50%) rotate(0deg)',opacity:0},{opacity:.85,offset:.2},{transform:'translate(-50%,-50%) rotate(720deg)',opacity:.7,offset:.85},{transform:'translate(-50%,-50%) rotate(880deg)',opacity:0}],{duration:900/sp,easing:'linear'});}catch(e){}
      rm(vr,980/sp);
      hbaHlVign(.62,560/sp);
      hbaHlHit(cx,midY,92*sz*fxi,380/sp);
      hbaHlRing(cx,midY,46*sz,'#f3e8ff',340/sp);
      setTimeout(function(){hbaHlRing(cx,midY,72*sz,'#c084fc',360/sp);},90/sp);
      setTimeout(function(){hbaHlRing(cx,midY,96*sz,'#c084fc',380/sp);},180/sp);
      hbaHlGShock(cx,midY,vw,sp);
      hbaHlDevour(cx,midY,barBot,sz,fxi,gx,gyC);
      hbaHlShrap(cx,midY,Math.round(5*fxi),barBot+16);
      hbaHlBarGlow(380);
      deal();
      [180,330,480].forEach(function(d){setTimeout(function(){hbaHlRing(cx,midY,hbaHlR(22,30)*sz,'#c084fc',260/sp);},d/sp);});
      var vap=setInterval(function(){
        var vw2=hbaHlR(2,3.4);
        var vm=hbaHlEl('hba-hl-spark',cx+hbaHlR(-W*0.3,W*0.3),midY+hbaHlR(-5,5),vw2,vw2);
        vm.style.background=Math.random()<.4?'#ffffff':'#e9d5ff';vm.style.boxShadow='0 0 5px #c084fc';
        try{vm.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+hbaHlR(-9,9)+'px,'+(-hbaHlR(40,90))+'px)',opacity:0}],{duration:hbaHlR(380,560)/sp,easing:'ease-out'});}catch(e){}
        rm(vm,620/sp);
      },75);
      setTimeout(function(){clearInterval(vap);},620/sp);
      setTimeout(function(){hbaHlSuck(cx,midY,barW,sp,gx,gyC);},260/sp);
    },DLY+T);
    setTimeout(function(){
      try{img.animate([{clipPath:'inset(0 0 0% 0)',opacity:1},{clipPath:'inset(0 0 72% 0)',opacity:.85,offset:.6},{clipPath:'inset(0 0 100% 0)',opacity:0}],{duration:280/sp,easing:'cubic-bezier(.5,0,.85,.4)',fill:'forwards'});}catch(e){img.style.opacity=0;}
      var s2=hbaHlEl('hba-hl-tcharge',gx-4*sz,gyC-4*sz,8*sz,8*sz);
      s2.style.background='radial-gradient(circle,#ffffff,#e9d5ff 50%,transparent 80%)';
      s2.style.boxShadow='0 0 10px rgba(168,85,247,.9)';
      try{s2.animate([{transform:'scale(.3)',opacity:0},{transform:'scale(1.3)',opacity:1,offset:.6},{transform:'scale(.2)',opacity:0}],{duration:320/sp,delay:220/sp});}catch(e){}
      rm(s2,600/sp);
      rm(box,380/sp);
    },DLY+T+560/sp);
  }
  function hbaHlDevour(cx,midY,barBot,sz,fxi,gx,gy){
    var n=Math.round(18*fxi);
    for(var i=0;i<n;i++){
      var w=hbaHlR(2,3.6);
      var s=hbaHlEl('hba-hl-spark',cx,midY,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#c084fc';s.style.boxShadow='0 0 6px #c084fc';
      var ang=hbaHlR(0,Math.PI*2),v=hbaHlR(30,62)*1.15,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v*0.7;
      if(midY+dy>barBot+16)dy=barBot+16-midY;
      var gdx=gx-cx, gdy=gy-midY;
      try{s.animate([
        {transform:'translate(0,0)',opacity:1},
        {transform:'translate('+dx+'px,'+dy+'px)',opacity:1,offset:.42},
        {transform:'translate('+(gdx+hbaHlR(-10,10))+'px,'+(gdy+hbaHlR(-8,8))+'px) scale(.3)',opacity:0}
      ],{duration:hbaHlR(560,780),easing:'cubic-bezier(.3,.4,.5,1)'});}catch(e){}
      rm(s,840);
    }
  }
  function hbaHlSuck(cx,midY,barW,sp,tx,ty){
    for(var i=0;i<9;i++){(function(i){setTimeout(function(){
      var w=hbaHlR(2,3.2);
      var x0=cx+hbaHlR(-barW*0.42,barW*0.42), y0=midY+hbaHlR(-10,10);
      var s=hbaHlEl('hba-hl-spark',x0,y0,w,w);
      s.style.background='#e9d5ff';s.style.boxShadow='0 0 5px #c084fc';
      try{s.animate([{transform:'translate(0,0)',opacity:.9},{transform:'translate('+(tx-x0+hbaHlR(-8,8))+'px,'+(ty-y0)+'px) scale(.25)',opacity:0}],{duration:hbaHlR(380,560)/sp,easing:'cubic-bezier(.4,.2,.7,1)'});}catch(e){}
      rm(s,620/sp);
    },i*55/sp);})(i);}
  }
  function hbaHlCorrodeFire(cx,midY,barW,sz,sp){
    [-0.18,0.1,0.28].forEach(function(o,i){setTimeout(function(){
      hbaHlFlame(cx+barW*o*0.7,midY+3,hbaHlR(8,12)*sz,hbaHlR(420,620)/sp);
    },i*110/sp);});
    hbaHlSmoke(cx,midY-4,sp);
  }
  function hbaHellLord(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:192, bw=br?Math.max(br.width,120):150, bh=br?Math.max(br.height,120):150, bsBot=br?br.bottom:252;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var dome=hbaHlEl('hba-hl-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},5600/sp);rm(dome,6300/sp);
    /* ① 魔王降世 */
    hbaHlCrownFire(bx,by,bw,bh,sp,4900);
    hbaHlMist(bx,bsBot,bw,sp,4800);
    setTimeout(function(){hbaHlGroundCracks(bx,bsBot,bw,sp,4400);},260/sp);
    setTimeout(function(){hbaHlEyes(bsEl,bx,by,bw,bh,sp);},200/sp);
    setTimeout(function(){hbaHlCore(bx,by,bw,bh,sz,sp);},340/sp);
    setTimeout(function(){hbaHlLaughWave(bx,by,bw,sp);},480/sp);
    /* ② 深渊审判 */
    setTimeout(function(){
      hbaHlTridOverload(bx,by,bw,bh,sz,sp);
      hbaHlJudgeCircle(hx,midY,sz,sp,2150);
      setTimeout(function(){hbaHlSealRunes(hx,barL,barW,midY,sz,sp,1900);},280/sp);
    },1100/sp);
    /* ③ 业火三叉连刺 */
    var n=Math.max(2,Math.round(3*fxi)); if(n>5)n=5;
    var slots5=[.14,.32,.5,.68,.86], slots3=[.25,.5,.75];
    for(var k=0;k<n;k++){(function(k){setTimeout(function(){
      var tx=barL+barW*((n<=3?slots3:slots5)[k]);
      hbaHlTridentBolt(bx,by,bw,bh,barL,barW,midY,barBot,vw,sz,sp,fxi,tx,k+1);
    },(2250+k*190)/sp);})(k);}
    var lastHit=(2250+(n-1)*190+250)/sp;
    /* ④ 地狱之门(左侧·光波斜射正中) */
    var cx=Math.round(vw/2);
    var gx=Math.round(vw*0.195), gyC=240, gh=150*Math.min(1.1,Math.max(.85,sz)), gw=148*sz;
    /* 🔴BUG#69(v536): 光波盘端下缘曾被 vortex 容器底(barBot+16·答题区保护裁切线)切平一块(Hansen 真机实拍)。根因: 图是旋转显示的, 最低可见点≠轴向尾端, 而是漩涡盘左下缘经旋转向下投影(比纯轴向多 0.22~0.25H, 屏幕越高越严重)。修复=按真图可见像素凸包支撑点精确计算最低下探 hlOff(三候选点离线提取自 chaoswave_real.webp alpha>40 像素·显示坐标系含1.075拉伸·α∈20°~65°零误差), 门+光波整体上移 hlLift(两端同移→距离/角度/图高全不变), 保证最低可见点≤barBot+10(容器底内留6px), 答题区保护线 barBot+16 一毫米不动。 */
    var kz4=Math.min(1.15,Math.max(.85,sz));
    var hlDdx=cx-gx, hlDdy=midY-gyC, hlA=Math.atan2(hlDdx,hlDdy), hlH=Math.hypot(hlDdx,hlDdy)/0.80*kz4;
    var hlSin=Math.sin(hlA), hlCos=Math.cos(hlA);
    var hlOff=Math.max(0.2101*hlSin+0.9598*hlCos, 0.3078*hlSin+0.8753*hlCos, 0.4838*hlSin+0.6385*hlCos)*hlH;
    var hlLift=Math.max(0,Math.round(gyC+hlOff-(barBot+10)));
    gyC-=hlLift; var aimY=midY-hlLift;
    setTimeout(function(){
      if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 24px rgba(168,85,247,.85)) brightness(1.4)',offset:.2},{filter:'drop-shadow(0 0 14px rgba(168,85,247,.45)) brightness(1.08)',offset:.55},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
      hbaHlGateRip(sp,gx,gyC,gh);
      setTimeout(function(){
        var doors=hbaHlGate(sz,sp,gx,gyC,gh,gw);
        setTimeout(function(){
          hbaHlVortexFire(gx,gyC,cx,aimY,barL,barW,barBot,vw,sz,sp,fxi,deal); //🔴BUG#69(v536): 瞄准点随门同步上移
          setTimeout(function(){hbaHlCorrodeFire(cx,aimY,barW,sz,sp);},1010/sp);
          setTimeout(function(){hbaHlGateClose(sp,doors,gx,gyC,gh);},1760/sp);
        },700/sp);
      },200/sp);
    },lastHit+160/sp);
  }
  /* 🔴 v531: 上古太阳神(Lv20·legendary·HP850 全游最高)创世神谕·天降太阳——Hansen 定稿: 鎏金圣阳·规模100%·速度1.00x·圣焰强度100%(3道耀斑光矛)。
     台词三连=三幕剧(人设驱动: 纯金神王/背后日冕太阳轮/左手托掌中日/右手施令):
     ①"吾 即是万物之始!"=创世神谕(天光瀑布×3斜洒+日冕法阵觉醒贴立绘日轮(0,-0.20h)旋转[24刻度+8耀斑齿]+日冕圣火沿轮上缘顺序点燃→持续随机[复用贝塞尔火苗引擎金色版]+双目金光+头顶光环+金尘上飘)
     ②"宇宙在我掌中!"=掌中宇宙(掌中日(+0.165,-0.04)暴亮pulse+5颗星辰椭圆轨道公转1.5圈[a=34,b=13,12帧keyframes]+轨道虚线椭圆+八芒日纹审判金阵压扁透视旋转罩血条+太阳圣印×4[圆+8短芒])
     ③太阳耀斑光矛(spearSVG菱形长刃+双弧耀斑尾·双残影op 1/.4/.22·1~5连·命中圣火苗)
     ④"凡人 终须臣服!"=天降太阳: 日蚀(fixed全屏暗层opacity≤.5缓入缓出700ms·变暗非闪光零屏闪原则内)→天穹法阵skyCircle@(cx,95) D=130三环+12芒持续旋转→掌中日飞升至法阵中心320ms→
       聚日成阳(复用__hbaSunImg[三件判定]·D=116*sz*限幅·scale .18→1充能380ms+8颗汇聚光粒+热浪环×2+悬停压迫320ms脉动+边缘小耀斑interval130)→
       陨石坠落(rAF tt=t²·.6+t·.4·T=380·终点球心y=midY-46·体积scale 1→1.15·焰尾bottom78% D*0.62×D*1.1+沿途光屑)→
       命中(压扁反弹scaleY.88+柔光.62+爆闪110*fxi+四重环错峰0/80/160/240+gShock+熔金地裂×5限角±.17rad+圣火liveFlame×6*fxi+蒸发金尘interval70至640+碎片+deal≈4720兜底5100)→
       灼烧余威(brightness脉冲520+灼环三连180/340/500)→升天消散(scale.5 translateY(-170) 440ms+尾光粒×4)→afterGlow熔金光斑+圣火残苗×2+烟。
     空间适配: 太阳终点球心y=midY-46, D=116→放大1.15后球底≈363<barBot+16=366·火花/碎片坠程钳位·汽化只向上——答题区零侵犯。零震屏零屏闪。 */
  function hbaSgEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaSgR(a,b){return a+Math.random()*(b-a);}
  function hbaSgVign(peak,ms){var v=hbaSgEl('hba-sg-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(251,191,36,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaSgRing(x,y,sz0,col,ms){var r=hbaSgEl('hba-sg-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaSgHit(x,y,szp,ms){var h=hbaSgEl('hba-sg-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#fef3c7 32%,rgba(251,191,36,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaSgSparks(x,y,n,pow,capY){
    for(var i=0;i<n;i++){
      var w=hbaSgR(2,3.4);
      var s=hbaSgEl('hba-sg-spark',x,y,w,w);
      s.style.background=Math.random()<.4?'#ffffff':'#fbbf24';s.style.boxShadow='0 0 6px #fbbf24';
      var ang=hbaSgR(0,Math.PI*2),v=hbaSgR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaSgR(8,22)+hbaSgR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaSgR(380,620),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,680);
    }
  }
  function hbaSgShrap(x,y,n,capY){
    for(var i=0;i<n;i++){var w=hbaSgR(3,6),h=hbaSgR(2,3.5);
      var s=hbaSgEl('hba-sg-shrap',x,y,w,h);
      s.style.background='linear-gradient(135deg,#fef3c7,#f59e0b)';s.style.boxShadow='0 0 3px rgba(251,191,36,.6)';
      var ang=hbaSgR(-2.6,-0.5),v=hbaSgR(30,64),dx=Math.cos(ang)*v*hbaSgR(.8,1.4),dy=Math.sin(ang)*v+hbaSgR(40,70);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) rotate('+hbaSgR(-540,540)+'deg)',opacity:0}],{duration:hbaSgR(460,700),easing:'cubic-bezier(.3,.5,.6,1)'});}catch(e){}
      rm(s,760);
    }
  }
  function hbaSgCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-sg-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaSgBarGlow(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaSgSmoke(x,y,sp){
    for(var i=0;i<3;i++){(function(i){setTimeout(function(){
      var w=hbaSgR(8,14);
      var s=hbaSgEl('hba-sg-smoke',x+hbaSgR(-16,16),y,w,w);
      s.style.background='radial-gradient(circle,rgba(251,191,36,.32),rgba(251,191,36,.12) 60%,transparent 80%)';
      try{s.animate([{transform:'translate(0,0) scale(.6)',opacity:.7},{transform:'translate('+hbaSgR(-12,12)+'px,'+(-hbaSgR(36,66))+'px) scale(1.7)',opacity:0}],{duration:hbaSgR(700,1000)/sp,easing:'ease-out'});}catch(e){}
      rm(s,1100/sp);
    },i*130/sp);})(i);}
  }
  function hbaSgGShock(cx,midY,vw,sp){
    [[-1,'100% 50%'],[1,'0 50%']].forEach(function(d){
      var w=d[0]<0?(cx-8):(vw-cx-8);
      var s=hbaSgEl('hba-sg-gshock',d[0]<0?(cx-w):cx,midY+4,w,null);
      s.style.transformOrigin=d[1];
      s.style.background=d[0]<0?'linear-gradient(90deg,transparent,#fbbf24 60%,#ffffff)':'linear-gradient(90deg,#ffffff,#fbbf24 40%,transparent)';
      s.style.boxShadow='0 0 10px rgba(251,191,36,.7)';
      try{s.animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(1)',opacity:.95,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}
      rm(s,400/sp);
    });
  }
  function hbaSgFlameSVG(W,H,seed2){
    var id='shf'+Math.floor(Math.random()*1e6);
    var sway=(seed2%2?1:-1)*(2+seed2%3);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 20 30" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stop-color="#fbbf24"/><stop offset="55%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#fef9c3" stop-opacity=".9"/></linearGradient></defs>'
      +'<path d="M10,29 C4.5,25 2.5,20 4,15 C5,11.5 7,9 8,5.5 C8.6,3.5 9.4,1.8 10,0.5 C10.6,2.5 11.6,4.5 12.6,7 C14,10 16,13 15.6,17.5 C15.2,22.5 13.5,26 10,29 Z" fill="url(#'+id+')" opacity=".92" transform="rotate('+sway+' 10 29)"/>'
      +'<path d="M10,27.5 C7,24.5 6,20.5 7,17 C7.8,14.5 9,12.5 10,9.5 C11,12.5 12.4,15 12.8,18 C13.2,21.5 12.2,25 10,27.5 Z" fill="#fef9c3" opacity=".95" transform="rotate('+(sway*0.6)+' 10 27)"/>'
      +'<ellipse cx="10" cy="24.5" rx="2.4" ry="3.6" fill="#ffffff" opacity=".88"/></svg>';
  }
  function hbaSgFlame(x,y,w,life){
    var H=w*1.55;
    var f=hbaSgEl('hba-sg-flame',x-w/2,y-H,w,H);
    f.innerHTML=hbaSgFlameSVG(w,H,Math.floor(Math.random()*9));
    f.style.filter='drop-shadow(0 0 6px rgba(251,191,36,.85)) drop-shadow(0 0 13px rgba(251,191,36,.4))';
    var svg=f.querySelector('svg');
    try{f.animate([{transform:'scaleY(.25)',opacity:0},{transform:'scaleY(1.08)',opacity:1,offset:.28},{transform:'scaleY(.92)',opacity:.95,offset:.55},{transform:'scaleY(1.02)',opacity:.9,offset:.78},{transform:'scaleY(.3)',opacity:0}],{duration:life,easing:'ease-in-out'});
    if(svg)svg.animate([{transform:'skewX(-4deg) scaleX(1)'},{transform:'skewX(5deg) scaleX(.92)'},{transform:'skewX(-3deg) scaleX(1.04)'},{transform:'skewX(4deg) scaleX(.95)'}],{duration:Math.max(220,life*0.42),iterations:Infinity,direction:'alternate'});}catch(e){}
    rm(f,life+70);
  }
  /* ① 创世神谕 */
  function hbaSgSkyFall(vw,vh,sp){
    [[0.22,-6],[0.5,3],[0.78,7]].forEach(function(o,i){setTimeout(function(){
      var w=hbaSgR(24,36);
      var s=hbaSgEl('hba-sg-skyfall',vw*o[0]-w/2,0,w,Math.round(vh*0.5));
      s.style.background='linear-gradient(180deg,rgba(251,191,36,.32) 0%,rgba(251,191,36,.13) 55%,transparent)';
      s.style.transform='skewX('+o[1]+'deg)';
      try{s.animate([{opacity:0,transform:'skewX('+o[1]+'deg) scaleY(0)'},{opacity:1,transform:'skewX('+o[1]+'deg) scaleY(1)',offset:.3},{opacity:.7,offset:.75},{opacity:0}],{duration:1500/sp,easing:'ease-out'});}catch(e){}
      rm(s,1600/sp);
    },i*140/sp);});
  }
  function hbaSgCoronaSVG(D){
    var ticks='', teeth='';
    for(var i=0;i<24;i++){var a=i/24*360;ticks+='<line x1="50" y1="5" x2="50" y2="9" stroke="#fbbf24" stroke-width="1.2" transform="rotate('+a+' 50 50)" opacity=".85"/>';}
    for(var j=0;j<8;j++){var b=j/8*360+22;teeth+='<polygon points="50,0 47.4,7 52.6,7" fill="#fef3c7" opacity=".9" transform="rotate('+b+' 50 50)"/>';}
    return '<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf24" stroke-width="2" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="39" fill="none" stroke="#fef3c7" stroke-width="1.1" stroke-dasharray="6 4" opacity=".85"/>'
      +ticks+teeth+'</svg>';
  }
  function hbaSgCorona(bx,by,bw,bh,sp,life){
    var D=Math.round(bw*0.85);
    var c=hbaSgEl('hba-sg-corona',bx,by-bh*0.20,D,D);
    c.innerHTML=hbaSgCoronaSVG(D);
    c.style.filter='drop-shadow(0 0 9px rgba(251,191,36,.7))';
    var svg=c.querySelector('svg');
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.55)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.16},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:5200/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
    var ringR=D/2, cy0=by-bh*0.20;
    [-0.85,-0.45,0,0.45,0.85].forEach(function(fr,i){setTimeout(function(){
      var ang=-Math.PI/2+fr*0.9;
      hbaSgFlame(bx+Math.cos(ang)*ringR, cy0+Math.sin(ang)*ringR+4, hbaSgR(8,11), hbaSgR(540,700)/sp);
    },(150+i*85)/sp);});
    var iv=setInterval(function(){
      var ang=-Math.PI/2+hbaSgR(-1.15,1.15);
      hbaSgFlame(bx+Math.cos(ang)*ringR, cy0+Math.sin(ang)*ringR+4, hbaSgR(7,11), hbaSgR(480,680)/sp);
    },140);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  function hbaSgEyesHalo(bsEl,bx,by,bw,bh,sp){
    [[-0.04,-0.18],[0.04,-0.18]].forEach(function(o,i){setTimeout(function(){
      var x=bx+bw*o[0], y=by+bh*o[1], r=9;
      var e2=hbaSgEl('hba-sg-eye',x-r/2,y-r/2,r,r);
      e2.style.background='radial-gradient(circle,#fff 0%,#fef3c7 40%,rgba(251,191,36,.5) 68%,transparent 82%)';
      e2.style.boxShadow='0 0 9px rgba(251,191,36,.95), 0 0 20px rgba(251,191,36,.5)';
      try{e2.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.5)',opacity:1,offset:.3},{transform:'scale(1)',opacity:.9}],{duration:2400/sp,fill:'forwards'});}catch(e){}
      rm(e2,2500/sp);
    },i*90/sp);});
    var h=hbaSgEl('hba-sg-halo',bx,by-bh*0.415,Math.round(bw*0.22),Math.round(bw*0.07));
    h.innerHTML='<div style="position:absolute;left:0;top:0;right:0;bottom:0;border:2px solid #fef3c7;border-radius:50%;box-shadow:0 0 10px rgba(251,191,36,.85)"></div>';
    try{h.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.25},{opacity:.85,offset:.9},{opacity:0}],{duration:2600/sp});}catch(e){}
    rm(h,2700/sp);
    if(bsEl){try{bsEl.animate([{filter:'brightness(.78)'},{filter:'brightness(1.15) drop-shadow(0 0 18px rgba(251,191,36,.5))',offset:.3},{filter:'brightness(.95)',offset:.45},{filter:'brightness(1.08)',offset:.62},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
  }
  function hbaSgDust(bx,by,bw,bh,sp,life){
    var iv=setInterval(function(){
      var w=hbaSgR(2,3.4);
      var m=hbaSgEl('hba-sg-dust',bx+hbaSgR(-bw*0.42,bw*0.42),by+hbaSgR(-bh*0.1,bh*0.42),w,w);
      m.style.background=Math.random()<.4?'#ffffff':'#fef3c7';m.style.boxShadow='0 0 6px #fbbf24';
      try{m.animate([{transform:'translate(0,0)',opacity:0},{opacity:.9,offset:.2},{transform:'translate('+hbaSgR(-8,8)+'px,'+(-hbaSgR(38,76))+'px)',opacity:0}],{duration:hbaSgR(900,1400)/sp,easing:'linear'});}catch(e){}
      rm(m,1500/sp);
    },160);
    setTimeout(function(){clearInterval(iv);},life/sp);
  }
  /* ② 宇宙在我掌中 */
  function hbaSgPalmSun(bx,by,bw,bh,sz,sp,life){
    var px=bx+bw*0.165, py=by-bh*0.04;
    var r=22*sz;
    var c=hbaSgEl('hba-sg-palm',px,py,r,r);
    c.style.background='radial-gradient(circle at 42% 38%,#ffffff 0%,#fef3c7 36%,rgba(251,191,36,.55) 66%,transparent 82%)';
    c.style.boxShadow='0 0 16px rgba(251,191,36,.95), 0 0 34px rgba(251,191,36,.5)';
    try{c.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:0},{transform:'translate(-50%,-50%) scale(1.18)',opacity:1,offset:.25},{transform:'translate(-50%,-50%) scale(.96)',opacity:.95,offset:.5},{transform:'translate(-50%,-50%) scale(1.08)',opacity:1,offset:.75},{transform:'translate(-50%,-50%) scale(1)',opacity:.95}],{duration:life/sp,fill:'forwards'});}catch(e){}
    return {el:c,x:px,y:py};
  }
  function hbaSgOrbitStars(sz,sp,px,py){
    var a=34*sz,b=13*sz;
    var ob=hbaSgEl('hba-sg-orbit',px,py,a*2,b*2);ob.style.color='#fbbf24';
    try{ob.animate([{opacity:0},{opacity:.4,offset:.2},{opacity:.35,offset:.85},{opacity:0}],{duration:1500/sp});}catch(e){}
    rm(ob,1600/sp);
    for(var i=0;i<5;i++){(function(i){
      var phi=i/5*Math.PI*2;
      var w=hbaSgR(3,4.6);
      var st=hbaSgEl('hba-sg-star',px-w/2,py-w/2,w,w);
      st.style.background=Math.random()<.4?'#ffffff':'#fef3c7';st.style.boxShadow='0 0 7px #fbbf24, 0 0 14px rgba(251,191,36,.5)';
      var kf=[];
      for(var k2=0;k2<=12;k2++){var t2=k2/12, ang=phi+t2*Math.PI*3;
        kf.push({transform:'translate('+(Math.cos(ang)*a)+'px,'+(Math.sin(ang)*b)+'px)',opacity:(k2===0||k2===12)?0:.95});}
      try{st.animate(kf,{duration:1450/sp,easing:'linear'});}catch(e){}
      rm(st,1550/sp);
    })(i);}
  }
  function hbaSgJudgeCircle(hx,midY,sz,sp,life){
    var D=120*sz;
    var rays='';
    for(var i=0;i<8;i++){var a=i/8*360;rays+='<line x1="50" y1="18" x2="50" y2="28" stroke="#fef3c7" stroke-width="2" transform="rotate('+a+' 50 50)" opacity=".85"/>';}
    var c=hbaSgEl('hba-sg-circle',hx,midY,D,Math.round(D*0.42));
    c.innerHTML='<div style="position:absolute;left:0;top:0;width:100%;height:100%;transform:scaleY(0.42);transform-origin:50% 50%"><svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" style="position:absolute;left:0;top:'+(-D*0.29)+'px" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="47" fill="none" stroke="#fbbf24" stroke-width="2" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="38" fill="none" stroke="#fef3c7" stroke-width="1.2" stroke-dasharray="6 4"/>'
      +rays+'<circle cx="50" cy="50" r="7" fill="none" stroke="#ffffff" stroke-width="1.6"/></svg></div>';
    c.style.filter='drop-shadow(0 0 8px rgba(251,191,36,.7))';
    var svg=c.querySelector('svg');
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:2600/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
  }
  function hbaSgSeals(barL,barW,midY,sz,sp,life){
    var pad=16;
    [[barL-pad,midY-15],[barL+barW+pad,midY-15],[barL-pad,midY+15],[barL+barW+pad,midY+15]].forEach(function(c2,i){setTimeout(function(){
      var D=14*sz;
      var r=hbaSgEl('hba-sg-seal',c2[0],c2[1],D,D);
      var sm='';for(var j=0;j<8;j++){var a=j/8*360;sm+='<line x1="10" y1="2" x2="10" y2="4.6" stroke="#fbbf24" stroke-width="1.4" transform="rotate('+a+' 10 10)"/>';}
      r.innerHTML='<svg width="'+D+'" height="'+D+'" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="4.6" fill="none" stroke="#fef3c7" stroke-width="1.4"/>'+sm+'</svg>';
      r.style.filter='drop-shadow(0 0 5px rgba(251,191,36,.8))';
      var svg=r.querySelector('svg');
      try{r.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.3)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.2},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
      if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:1800/sp,iterations:Infinity});}catch(e){}
      rm(r,life/sp+80);
    },i*70/sp);});
  }
  /* ③ 太阳耀斑光矛 */
  function hbaSgSpearSVG(W,H){
    var id='shs'+Math.floor(Math.random()*1e6);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 24 60" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#fef3c7"/><stop offset="100%" stop-color="#f59e0b" stop-opacity=".2"/></linearGradient></defs>'
      +'<path d="M12,1 L16,16 L13.4,50 L12,58 L10.6,50 L8,16 Z" fill="url(#'+id+')" stroke="#ffffff" stroke-width=".9" stroke-opacity=".85"/>'
      +'<path d="M9,14 Q3,26 7,42" fill="none" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>'
      +'<path d="M15,14 Q21,26 17,42" fill="none" stroke="#fbbf24" stroke-width="1.6" stroke-linecap="round" opacity=".75"/></svg>';
  }
  function hbaSgFlareSpear(bx,by,bw,bh,midY,barBot,vw,sz,sp,fxi,tx,k){
    var W=22*sz,H=52*sz;
    var x1=bx+bw*0.165+hbaSgR(-5,5), y1=by-bh*0.04+hbaSgR(-5,5);
    var dx=tx-x1, dy=midY-6-y1;
    var rot=Math.atan2(dy,dx)*180/Math.PI-90;
    [2,1,0].forEach(function(main){setTimeout(function(){
      var s=hbaSgEl('hba-sg-spear',x1-W/2,y1-H/2,W,H);
      s.innerHTML=hbaSgSpearSVG(W,H);
      s.style.filter='drop-shadow(0 0 6px rgba(251,191,36,.9)) drop-shadow(0 0 14px rgba(251,191,36,.45))';
      var op=main===2?1:(main===1?.4:.22), sc=main===2?1:(main===1?.86:.72);
      try{s.animate([
        {transform:'translate(0,0) rotate('+rot+'deg) scale(.5)',opacity:0},
        {transform:'translate('+(dx*0.15)+'px,'+(dy*0.15)+'px) rotate('+rot+'deg) scale('+sc+')',opacity:op,offset:.15},
        {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+sc+')',opacity:op,offset:.92},
        {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale('+sc+')',opacity:0}
      ],{duration:260/sp,easing:'cubic-bezier(.45,.05,.75,.7)',fill:'forwards'});}catch(e){}
      rm(s,320/sp);
    },(2-main)*36/sp);});
    setTimeout(function(){
      hbaSgHit(tx,midY,36*sz,240/sp);
      hbaSgRing(tx,midY,30*sz,'#fbbf24',290/sp);
      hbaSgSparks(tx,midY,Math.round(5*fxi),.8,barBot+16);
      hbaSgFlame(tx+hbaSgR(-8,8),midY+3,hbaSgR(8,11)*sz,hbaSgR(360,520)/sp);
      hbaSgBarGlow(120);hbaSgCombo(k,tx,midY,vw);
    },250/sp);
  }
  /* ④ 天降太阳 */
  function hbaSgSkyCircle(sz,sp,cx,cy,life){
    var D=130*sz;
    var rays='';
    for(var i=0;i<12;i++){var a=i/12*360;rays+='<line x1="50" y1="4" x2="50" y2="9.5" stroke="#fbbf24" stroke-width="1.4" transform="rotate('+a+' 50 50)" opacity=".85"/>';}
    var c=hbaSgEl('hba-sg-skycircle',cx,cy,D,D);
    c.innerHTML='<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf24" stroke-width="2" opacity=".92"/>'
      +'<circle cx="50" cy="50" r="37" fill="none" stroke="#fef3c7" stroke-width="1.2" stroke-dasharray="7 5"/>'
      +'<circle cx="50" cy="50" r="26" fill="none" stroke="#fef3c7" stroke-width="1" stroke-dasharray="3 5" opacity=".8"/>'
      +rays+'</svg>';
    c.style.filter='drop-shadow(0 0 10px rgba(251,191,36,.75))';
    var svg=c.querySelector('svg');
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.3) rotate(-60deg)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1) rotate(0deg)',offset:.22},{opacity:.9,offset:.93},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(-360deg)'}],{duration:3000/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
  }
  function hbaSgSunAscend(sp,palm,cx,cy){
    if(!palm||!palm.el)return;
    var d=palm.el;
    try{d.animate([{left:palm.x+'px',top:palm.y+'px'},{left:cx+'px',top:cy+'px'}],{duration:320/sp,easing:'cubic-bezier(.3,.5,.3,1)',fill:'forwards'});}catch(e){d.style.left=cx+'px';d.style.top=cy+'px';}
    rm(d,380/sp);
  }
  function hbaSgSunForm(cx,cy,midY,barL,barW,barBot,vw,sz,sp,fxi,deal){
    var D=Math.round(116*sz*Math.min(1.25,Math.max(.85,fxi)));
    var box=hbaSgEl('hba-sg-sun',cx-D/2,cy-D/2,D,D);
    var img;
    if(window.__hbaSunImg && (window.__hbaSunReady || window.__hbaSunImg.complete) && window.__hbaSunImg.naturalWidth>0){
      img=window.__hbaSunImg.cloneNode(false);
      img.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%';
    } else { img=document.createElement('img'); img.src='bosses/sunball_real.webp'; img.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%'; }
    img.style.filter='saturate(1.08) drop-shadow(0 0 18px rgba(251,191,36,.9)) drop-shadow(0 0 40px rgba(251,191,36,.5))';
    box.appendChild(img);
    try{img.animate([{transform:'scale(.18) rotate(-30deg)',opacity:.5},{transform:'scale(.65) rotate(-10deg)',opacity:.95,offset:.55},{transform:'scale(1.04) rotate(0deg)',opacity:1,offset:.88},{transform:'scale(1) rotate(0deg)',opacity:1}],{duration:380/sp,easing:'cubic-bezier(.3,.5,.4,1)',fill:'both'});}catch(e){}
    for(var i=0;i<8;i++){(function(i){setTimeout(function(){
      var ang=hbaSgR(0,Math.PI*2),d0=hbaSgR(56,86)*sz;
      var x0=cx+Math.cos(ang)*d0, y0=cy+Math.sin(ang)*d0;
      var w=hbaSgR(2.4,4);
      var m=hbaSgEl('hba-sg-spark',x0,y0,w,w);
      m.style.background=Math.random()<.4?'#ffffff':'#fef3c7';m.style.boxShadow='0 0 6px #fbbf24';
      try{m.animate([{transform:'translate(0,0)',opacity:.95},{transform:'translate('+(cx-x0)+'px,'+(cy-y0)+'px) scale(.3)',opacity:0}],{duration:hbaSgR(260,380)/sp,easing:'cubic-bezier(.4,.1,.7,1)'});}catch(e){}
      rm(m,420/sp);
    },i*36/sp);})(i);}
    [0,160].forEach(function(dl){setTimeout(function(){
      var h=hbaSgEl('hba-sg-heat',cx,cy,Math.round(D*1.15),Math.round(D*1.15));h.style.color='#fef3c7';
      try{h.animate([{transform:'translate(-50%,-50%) scale(.8)',opacity:.5},{transform:'translate(-50%,-50%) scale(1.5)',opacity:0}],{duration:560/sp,easing:'ease-out'});}catch(e){}
      rm(h,640/sp);
    },(380+dl)/sp);});
    var flick=setInterval(function(){
      var ang=hbaSgR(0,Math.PI*2);
      hbaSgFlame(cx+Math.cos(ang)*D*0.47, cy+Math.sin(ang)*D*0.47+5, hbaSgR(6,9)*sz, hbaSgR(300,420)/sp);
    },130);
    try{img.animate([{filter:'saturate(1.08) brightness(1)'},{filter:'saturate(1.08) brightness(1.18)'},{filter:'saturate(1.08) brightness(1)'}],{duration:300/sp,iterations:2,delay:380/sp});}catch(e){}
    setTimeout(function(){
      clearInterval(flick);
      var tail=document.createElement('div');
      tail.style.cssText='position:absolute;left:50%;bottom:78%;width:'+(D*0.62)+'px;height:'+(D*1.1)+'px;margin-left:-'+(D*0.31)+'px;background:linear-gradient(0deg,#fef3c7 0%,rgba(251,191,36,.5) 36%,rgba(251,191,36,.18) 66%,transparent);border-radius:50% 50% 34% 34%;filter:blur(1.4px);pointer-events:none';
      box.appendChild(tail);
      try{tail.animate([{transform:'scaleY(.3)',opacity:0},{transform:'scaleY(1)',opacity:1,offset:.4},{transform:'scaleY(1.08)',opacity:.95}],{duration:200/sp,fill:'forwards'});}catch(e){}
      var yStart=cy-D/2, yEnd=(midY-46*sz)-D/2;
      var T=380/sp, st=null;
      function step(ts){
        if(st==null)st=ts;
        var t2=Math.min(1,(ts-st)/T), tt=t2*t2*0.6+t2*0.4;
        box.style.top=(yStart+(yEnd-yStart)*tt)+'px';
        box.style.transform='scale('+(1+0.15*tt)+')';
        if(t2<0.9&&Math.random()<.55){
          var w=hbaSgR(1.6,3);
          var m=hbaSgEl('hba-sg-spark',cx+hbaSgR(-D*0.4,D*0.4),yStart+(yEnd-yStart)*tt+D*hbaSgR(.1,.6),w,w);
          m.style.background=Math.random()<.5?'#ffffff':'#fef3c7';m.style.boxShadow='0 0 5px #fbbf24';
          try{m.animate([{transform:'translate(0,0)',opacity:.9},{transform:'translate('+hbaSgR(-18,18)+'px,'+(-hbaSgR(16,34))+'px)',opacity:0}],{duration:hbaSgR(160,260),easing:'ease-out'});}catch(e){}
          rm(m,300);
        }
        if(t2<1){requestAnimationFrame(step);}else{sgImpact();}
      }
      function sgImpact(){
        try{tail.animate([{opacity:.95},{opacity:0}],{duration:180/sp,fill:'forwards'});}catch(e){}
        try{box.animate([{transform:'scale(1.15) scaleY(1)'},{transform:'scale(1.15) scaleY(.88)',offset:.3},{transform:'scale(1.15) scaleY(1)'}],{duration:200/sp,easing:'ease-out'});}catch(e){}
        hbaSgVign(.62,600/sp);
        hbaSgHit(cx,midY,110*sz*fxi,420/sp);
        hbaSgRing(cx,midY,46*sz,'#fffbeb',330/sp);
        setTimeout(function(){hbaSgRing(cx,midY,72*sz,'#fbbf24',350/sp);},80/sp);
        setTimeout(function(){hbaSgRing(cx,midY,98*sz,'#fbbf24',370/sp);},160/sp);
        setTimeout(function(){hbaSgRing(cx,midY,124*sz,'#fbbf24',390/sp);},240/sp);
        hbaSgGShock(cx,midY,vw,sp);
        hbaSgMoltenCracks(cx,midY,sz,sp);
        for(var i2=0;i2<Math.round(6*fxi);i2++){(function(i2){setTimeout(function(){
          hbaSgFlame(cx+hbaSgR(-58,58)*sz, midY+hbaSgR(-2,5), hbaSgR(8,13)*sz, hbaSgR(420,640)/sp);
        },i2*60/sp);})(i2);}
        hbaSgSparks(cx,midY,Math.round(18*fxi),1.3,barBot+16);
        hbaSgShrap(cx,midY,Math.round(6*fxi),barBot+16);
        hbaSgBarGlow(420);
        deal();
        var vap=setInterval(function(){
          var w=hbaSgR(2,3.6);
          var m=hbaSgEl('hba-sg-spark',cx+hbaSgR(-D*0.5,D*0.5),midY+hbaSgR(-6,6),w,w);
          m.style.background=Math.random()<.4?'#ffffff':'#fef3c7';m.style.boxShadow='0 0 5px #fbbf24';
          try{m.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+hbaSgR(-9,9)+'px,'+(-hbaSgR(44,96))+'px)',opacity:0}],{duration:hbaSgR(400,580)/sp,easing:'ease-out'});}catch(e){}
          rm(m,640/sp);
        },70);
        setTimeout(function(){clearInterval(vap);},640/sp);
        try{img.animate([{filter:'saturate(1.08) brightness(1)'},{filter:'saturate(1.08) brightness(1.25)',offset:.25},{filter:'saturate(1.08) brightness(1)',offset:.5},{filter:'saturate(1.08) brightness(1.2)',offset:.75},{filter:'saturate(1.08) brightness(1)'}],{duration:520/sp});}catch(e){}
        [180,340,500].forEach(function(d){setTimeout(function(){hbaSgRing(cx,midY,hbaSgR(24,32)*sz,'#fbbf24',260/sp);},d/sp);});
        setTimeout(function(){
          try{box.animate([{transform:'scale(1.15) translateY(0)',opacity:1},{transform:'scale(.5) translateY(-170px)',opacity:0}],{duration:440/sp,easing:'cubic-bezier(.4,.1,.6,.9)',fill:'forwards'});}catch(e){box.style.opacity=0;}
          for(var i3=0;i3<4;i3++){(function(i3){setTimeout(function(){
            var w=hbaSgR(2,3.2);
            var m=hbaSgEl('hba-sg-spark',cx+hbaSgR(-20,20),midY-hbaSgR(20,90),w,w);
            m.style.background='#fef3c7';m.style.boxShadow='0 0 5px #fbbf24';
            try{m.animate([{opacity:.9},{transform:'translateY(-26px)',opacity:0}],{duration:300/sp});}catch(e){}
            rm(m,360/sp);
          },i3*70/sp);})(i3);}
          rm(box,520/sp);
          setTimeout(function(){hbaSgAfterGlow(cx,midY,barW,sz,sp);},220/sp);
        },560/sp);
      }
      try{requestAnimationFrame(step);}catch(e){box.style.top=yEnd+'px';sgImpact();}
    },(380+320)/sp);
  }
  function hbaSgMoltenCracks(cx,midY,sz,sp){
    for(var i=0;i<5;i++){
      var ang=(Math.random()<.5?-1:1)*hbaSgR(.05,.17), len=hbaSgR(36,62)*sz;
      var rot2=ang+(Math.random()<.5?Math.PI:0);
      var c=hbaSgEl('hba-sg-crack',cx,midY+5,len,null);
      c.style.background='linear-gradient(90deg,#ffffff,#fbbf24 40%,rgba(251,191,36,.4) 80%,transparent)';
      c.style.boxShadow='0 0 6px rgba(251,191,36,.85)';
      c.style.transform='rotate('+rot2+'rad) scaleX(0)';
      try{c.animate([{transform:'rotate('+rot2+'rad) scaleX(0)',opacity:1},{transform:'rotate('+rot2+'rad) scaleX(1)',opacity:.95,offset:.25},{opacity:.65,offset:.55},{opacity:.9,offset:.7},{opacity:0}],{duration:hbaSgR(620,860)/sp});}catch(e){}
      rm(c,920/sp);
    }
  }
  function hbaSgAfterGlow(cx,midY,barW,sz,sp){
    var a=hbaSgEl('hba-sg-glow',cx,midY,Math.round(76*sz),Math.round(24*sz));
    a.style.background='radial-gradient(ellipse,rgba(251,191,36,.55) 0%,rgba(251,191,36,.2) 55%,transparent 80%)';
    try{a.animate([{opacity:.95},{opacity:.5,offset:.5},{opacity:0}],{duration:700/sp,easing:'ease-out'});}catch(e){}
    rm(a,780/sp);
    [-0.14,0.16].forEach(function(o,i){setTimeout(function(){
      hbaSgFlame(cx+barW*o*0.7,midY+3,hbaSgR(8,11)*sz,hbaSgR(420,600)/sp);
    },i*120/sp);});
    hbaSgSmoke(cx,midY-4,sp);
  }
  function hbaSunGod(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth, vh=window.innerHeight;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:192, bw=br?Math.max(br.width,120):150, bh=br?Math.max(br.height,120):150;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var dome=hbaSgEl('hba-sg-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},6200/sp);rm(dome,6900/sp);
    /* ① 创世神谕 */
    hbaSgSkyFall(vw,vh,sp);
    hbaSgCorona(bx,by,bw,bh,sp,5000);
    hbaSgDust(bx,by,bw,bh,sp,4800);
    setTimeout(function(){hbaSgEyesHalo(bsEl,bx,by,bw,bh,sp);},220/sp);
    /* ② 宇宙在我掌中 */
    var palm=null;
    setTimeout(function(){
      palm=hbaSgPalmSun(bx,by,bw,bh,sz,sp,2300);
      hbaSgOrbitStars(sz,sp,palm.x,palm.y);
      hbaSgJudgeCircle(hx,midY,sz,sp,2150);
      setTimeout(function(){hbaSgSeals(barL,barW,midY,sz,sp,1900);},280/sp);
    },1100/sp);
    /* ③ 太阳耀斑光矛 */
    var n=Math.max(2,Math.round(3*fxi)); if(n>5)n=5;
    var slots5=[.14,.32,.5,.68,.86], slots3=[.25,.5,.75];
    for(var k=0;k<n;k++){(function(k){setTimeout(function(){
      var tx=barL+barW*((n<=3?slots3:slots5)[k]);
      hbaSgFlareSpear(bx,by,bw,bh,midY,barBot,vw,sz,sp,fxi,tx,k+1);
    },(2250+k*190)/sp);})(k);}
    var lastHit=(2250+(n-1)*190+250)/sp;
    /* ④ 天降太阳 */
    var cx=Math.round(vw/2), scy=95;
    setTimeout(function(){
      var ec=hbaSgEl('hba-sg-eclipse',0,0);
      try{ec.animate([{opacity:0},{opacity:1,offset:.35},{opacity:1,offset:.6},{opacity:0}],{duration:700/sp,easing:'ease-in-out'});}catch(e){}
      rm(ec,780/sp);
      if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 26px rgba(251,191,36,.9)) brightness(1.45)',offset:.2},{filter:'drop-shadow(0 0 16px rgba(251,191,36,.5)) brightness(1.1)',offset:.55},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
      hbaSgSkyCircle(sz,sp,cx,scy,2900);
      setTimeout(function(){
        hbaSgSunAscend(sp,palm,cx,scy);
        setTimeout(function(){
          hbaSgSunForm(cx,scy,midY,barL,barW,barBot,vw,sz,sp,fxi,deal);
        },320/sp);
      },280/sp);
    },lastHit+160/sp);
  }
  /* 🔴 v535: 星海女帝·赛尔娅(传说·赛季绝版·双形态HP阶梯)星海圣典·超新星挽歌——Hansen 定稿: 虹彩星海·规模100%·速度1.00x·星辉强度100%(七连满奏)。全游压轴最后一招, fly 自此全退役。
     台词驱动四阶段(13条台词=剧本, 立绘=道具图: 七彩星核环身/左手虹彩长剑=银河之泪/白金圣衣/头顶圣环组):
     ①"繁星为我加冕,银河在我足下流淌"=星海降临(22颗彩星错峰点亮twinkle+头冠上方星座五星连线SVG渐画+圣环组贴立绘(−0.03,−0.37h)旋转[16刻度]+紫瞳+足下银河横流带[内星点流动])
     ②"七颗星核绕我而行"+"银河之泪出鞘"=七星心跳·圣剑出鞘(立绘七核原位(CORE7POS)点亮各色脉动2拍→入轨大椭圆绕身公转1圈回相位+虹彩剑魂swordSVG贴立绘剑位(−0.325,+0.18)升起出鞘至身侧竖立+出鞘白闪+双剑鸣环+血条虹彩星轨锁定阵[七色点])
     ③"星辰序曲"=七色流星连射(七核依次化流星射血条·每颗用自己颜色·弧线中点偏移·命中该色爆+星屑+♪/♫音符飘起+连击·n=max(3,round(7*fxi)) cap7 默认7连满奏)
     ④"超新星挽歌"=终极(剑魂挥落斩天rotate弧光+巨弧光痕→天穹星空裂隙(cx,78)scaleX撕开[锯齿黑缝+白中线+内星点]→银河倾泻galaxyFall梯形clip光带[内星点下流]至nucY=midY−86→聚星成核[白炽核+七彩conic吸积盘mask环旋转]→引力坍缩[核scale.26+8颗七色光点吸入+吸积盘卷入]+休止符hush全屏静默330ms[缓入缓出零屏闪]→核坠落170ms至(cx,midY)→超新星爆发: 柔光.62+爆闪112*fxi+七色冲击环逐色错峰52ms+gShock+彩色星尘地纹×5+星屑22*fxi七色+碎片+deal≈5878兜底6300→新星诞生[四芒星升起58px旋转淡出]+♪♫余韵×2+满天星渐次熄灭killStars——"见证诞生亦送别熄灭"闭环+afterGlow)。
     空间适配: 星屑/碎片坠程钳位barBot+16·蒸发只向上·爆心(cx,midY)·答题区零侵犯。零震屏零屏闪(hush为缓变压暗)。 */
  var hbaSeRB7=['#f43f5e','#fb923c','#fbbf24','#4ade80','#38bdf8','#a855f7','#ec4899'];
  var hbaSeCORE7=[[-0.30,-0.30],[-0.40,-0.13],[-0.41,0.28],[0.27,-0.31],[0.37,-0.19],[0.39,0.04],[0.28,0.12]];
  function hbaSeEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;if(x!=null)d.style.left=x+'px';if(y!=null)d.style.top=y+'px';if(w!=null)d.style.width=w+'px';if(h!=null)d.style.height=h+'px';(window.__hansenFxLayer||document.body).appendChild(d);return d;}
  function hbaSeR(a,b){return a+Math.random()*(b-a);}
  function hbaSeStarSVG(D,col){
    return '<svg width="'+D+'" height="'+D+'" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10,1 L11.8,8.2 L19,10 L11.8,11.8 L10,19 L8.2,11.8 L1,10 L8.2,8.2 Z" fill="'+col+'" opacity=".95"/><circle cx="10" cy="10" r="2.2" fill="#ffffff"/></svg>';
  }
  function hbaSeVign(peak,ms){var v=hbaSeEl('hba-se-vign',0,0);v.style.boxShadow='inset 0 0 90px 26px rgba(196,181,253,'+peak+')';try{v.animate([{opacity:0},{opacity:1,offset:.18},{opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(v,ms+60);}
  function hbaSeRing(x,y,sz0,col,ms){var r=hbaSeEl('hba-se-ring',x,y,sz0,sz0);r.style.border='2.5px solid '+col;r.style.boxShadow='0 0 12px '+col;try{r.animate([{transform:'translate(-50%,-50%) scale(.18)',opacity:.95},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'cubic-bezier(.2,.7,.4,1)'});}catch(e){}rm(r,ms+40);}
  function hbaSeHit(x,y,szp,ms){var h=hbaSeEl('hba-se-hit',x,y,szp,szp);h.style.background='radial-gradient(circle,#ffffff 0%,#e9d5ff 32%,rgba(196,181,253,.5) 62%,transparent 78%)';try{h.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:0}],{duration:ms,easing:'ease-out'});}catch(e){}rm(h,ms+40);}
  function hbaSeSparks(x,y,n,pow,capY,colArr){
    for(var i=0;i<n;i++){var w=hbaSeR(2,3.4);
      var s=hbaSeEl('hba-se-spark',x,y,w,w);
      var col=colArr?colArr[i%colArr.length]:(Math.random()<.4?'#ffffff':'#c4b5fd');
      s.style.background=col;s.style.boxShadow='0 0 6px '+col;
      var ang=hbaSeR(0,Math.PI*2),v=hbaSeR(26,62)*pow,dx=Math.cos(ang)*v,dy=Math.sin(ang)*v-hbaSeR(8,22)+hbaSeR(26,46);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px)',opacity:0}],{duration:hbaSeR(380,640),easing:'cubic-bezier(.2,.6,.5,1)'});}catch(e){}
      rm(s,700);
    }
  }
  function hbaSeShrap(x,y,n,capY){
    for(var i=0;i<n;i++){var w=hbaSeR(3,6),h=hbaSeR(2,3.5);
      var s=hbaSeEl('hba-se-shrap',x,y,w,h);
      var col=hbaSeRB7[i%7];
      s.style.background='linear-gradient(135deg,#ffffff,'+col+')';s.style.boxShadow='0 0 3px '+col;
      var ang=hbaSeR(-2.6,-0.5),v=hbaSeR(30,64),dx=Math.cos(ang)*v*hbaSeR(.8,1.4),dy=Math.sin(ang)*v+hbaSeR(40,70);
      if(capY!=null&&y+dy>capY)dy=capY-y;
      try{s.animate([{transform:'translate(0,0) rotate(0deg)',opacity:1},{transform:'translate('+dx+'px,'+dy+'px) rotate('+hbaSeR(-540,540)+'deg)',opacity:0}],{duration:hbaSeR(460,700),easing:'cubic-bezier(.3,.5,.6,1)'});}catch(e){}
      rm(s,760);
    }
  }
  function hbaSeCombo(n,x,y,vw){var c=document.createElement('div');c.className='hba-se-combo';c.textContent=n+' 连!';c.style.left=Math.min(Math.max(x-16,8),vw-58)+'px';c.style.top=(y-36)+'px';(window.__hansenFxLayer||document.body).appendChild(c);rm(c,660);}
  function hbaSeBar(ms){var b=document.querySelector('.hero-hp-bar');if(!b)return;b.classList.add('hsn-bite-glow');setTimeout(function(){b.classList.remove('hsn-bite-glow');},ms);}
  function hbaSeGShock(cx,midY,vw,sp){
    [[-1,'100% 50%'],[1,'0 50%']].forEach(function(d){
      var w=d[0]<0?(cx-8):(vw-cx-8);
      var s=hbaSeEl('hba-se-gshock',d[0]<0?(cx-w):cx,midY+4,w,null);
      s.style.transformOrigin=d[1];
      s.style.background=d[0]<0?'linear-gradient(90deg,transparent,#c4b5fd 60%,#ffffff)':'linear-gradient(90deg,#ffffff,#c4b5fd 40%,transparent)';
      s.style.boxShadow='0 0 10px rgba(196,181,253,.7)';
      try{s.animate([{transform:'scaleX(0)',opacity:1},{transform:'scaleX(1)',opacity:.95,offset:.5},{transform:'scaleX(1)',opacity:0}],{duration:340/sp,easing:'cubic-bezier(.2,.8,.3,1)'});}catch(e){}
      rm(s,400/sp);
    });
  }
  /* ① 繁星为我加冕 */
  function hbaSeSkyStars(vw,vh,sp){
    var arr=[];
    for(var i=0;i<22;i++){(function(i){setTimeout(function(){
      var w=hbaSeR(1.8,3.4);
      var s=hbaSeEl('hba-se-star',hbaSeR(8,vw-8),hbaSeR(8,vh*0.52),w,w);
      var col=Math.random()<.5?'#ffffff':hbaSeRB7[i%7];
      s.style.background=col;s.style.boxShadow='0 0 5px '+col+', 0 0 9px '+col;
      arr.push(s);
      try{s.animate([{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(1.25)',offset:.4},{opacity:.85,transform:'scale(1)'}],{duration:380/sp,fill:'forwards'});
      s.animate([{opacity:.85},{opacity:.4},{opacity:.9}],{duration:hbaSeR(1100,1800)/sp,delay:400/sp,iterations:Infinity});}catch(e){}
    },i*55/sp);})(i);}
    return arr;
  }
  function hbaSeKillStars(arr,sp){
    arr.forEach(function(s,i){setTimeout(function(){
      try{s.animate([{opacity:.8},{opacity:0,transform:'scale(.2)'}],{duration:420/sp,fill:'forwards'});}catch(e){s.style.opacity=0;}
      rm(s,500/sp);
    },i*42/sp);});
  }
  function hbaSeConstellation(bx,by,bh,sz,sp){
    var cxp=bx, cyp=by-bh*0.52;
    var pts=[[-44,4],[-20,-14],[6,-20],[30,-10],[48,8]];
    pts.forEach(function(o,i){setTimeout(function(){
      var D=9;
      var s=hbaSeEl('hba-se-bigstar',cxp+o[0]*sz,cyp+o[1]*sz,D,D);
      s.innerHTML=hbaSeStarSVG(D,'#ffffff');
      s.style.filter='drop-shadow(0 0 5px #e9d5ff)';
      try{s.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.4)',offset:.5},{opacity:.95,transform:'translate(-50%,-50%) scale(1)'}],{duration:300/sp,fill:'forwards'});}catch(e){}
      rm(s,2700/sp);
    },(140+i*95)/sp);});
    setTimeout(function(){
      var minX=cxp-50*sz,minY=cyp-26*sz;
      var W=104*sz,H=44*sz;
      var c=hbaSeEl('hba-se-cline',minX,minY,W,H);
      var pl=pts.map(function(o){return (o[0]*sz+50*sz)+','+(o[1]*sz+26*sz);}).join(' ');
      c.innerHTML='<svg width="'+W+'" height="'+H+'" style="overflow:visible" xmlns="http://www.w3.org/2000/svg"><polyline points="'+pl+'" fill="none" stroke="#e9d5ff" stroke-width="1.4" stroke-dasharray="220" stroke-dashoffset="220" opacity=".85"><animate attributeName="stroke-dashoffset" from="220" to="0" dur="'+(0.62/sp)+'s" fill="freeze"/></polyline></svg>';
      c.style.filter='drop-shadow(0 0 4px rgba(196,181,253,.7))';
      try{c.animate([{opacity:1},{opacity:.85,offset:.85},{opacity:0}],{duration:2300/sp,fill:'forwards'});}catch(e){}
      rm(c,2400/sp);
    },620/sp);
  }
  function hbaSeHaloAwake(bsEl,bx,by,bw,bh,sp,life){
    var D=Math.round(bw*0.62);
    var c=hbaSeEl('hba-se-halo',bx-bw*0.03,by-bh*0.37,D,D);
    var ticks='';
    for(var i=0;i<16;i++){var a=i/16*360;ticks+='<line x1="50" y1="7" x2="50" y2="11" stroke="#c4b5fd" stroke-width="1.3" transform="rotate('+a+' 50 50)" opacity=".85"/>';}
    c.innerHTML='<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<circle cx="50" cy="50" r="44" fill="none" stroke="#c4b5fd" stroke-width="1.8" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="35" fill="none" stroke="#e9d5ff" stroke-width="1" stroke-dasharray="5 4" opacity=".85"/>'
      +ticks
      +'<path d="M50,2 L52.4,8 L50,6.4 L47.6,8 Z" fill="#e9d5ff"/></svg>';
    c.style.filter='drop-shadow(0 0 8px rgba(196,181,253,.7))';
    var svg=c.querySelector('svg');
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(-360deg)'}],{duration:5600/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
    [[-0.04,-0.255],[0.04,-0.255]].forEach(function(o,i){setTimeout(function(){
      var x=bx+bw*o[0], y=by+bh*o[1], r=8;
      var e2=hbaSeEl('hba-se-eye',x-r/2,y-r/2,r,r);
      e2.style.background='radial-gradient(circle,#fff 0%,#e9d5ff 40%,rgba(196,181,253,.5) 68%,transparent 82%)';
      e2.style.boxShadow='0 0 8px rgba(196,181,253,.95)';
      try{e2.animate([{transform:'scale(.2)',opacity:0},{transform:'scale(1.4)',opacity:1,offset:.3},{transform:'scale(1)',opacity:.88}],{duration:2200/sp,fill:'forwards'});}catch(e){}
      rm(e2,2300/sp);
    },(260+i*90)/sp);});
    if(bsEl){try{bsEl.animate([{filter:'brightness(.8)'},{filter:'brightness(1.14) drop-shadow(0 0 18px rgba(196,181,253,.5))',offset:.3},{filter:'brightness(.96)',offset:.45},{filter:'brightness(1.06)',offset:.62},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
  }
  function hbaSeGalaxyFlow(bx,bsBot,bw,sp,life){
    var W=Math.round(bw*1.25), H=13;
    var f=hbaSeEl('hba-se-gflow',bx-W/2,bsBot-9,W,H);
    f.style.background='linear-gradient(90deg,transparent 0%,rgba(196,181,253,.32) 18%,rgba(196,181,253,.5) 50%,rgba(196,181,253,.32) 82%,transparent 100%)';
    f.style.boxShadow='0 0 12px rgba(196,181,253,.4)';
    try{f.animate([{opacity:0},{opacity:1,offset:.14},{opacity:.9,offset:.9},{opacity:0}],{duration:life/sp,fill:'forwards'});}catch(e){}
    for(var i=0;i<5;i++){(function(i){
      var sd=document.createElement('div');
      var col=hbaSeRB7[i%7];
      sd.style.cssText='position:absolute;top:'+hbaSeR(2,9)+'px;left:-6px;width:3px;height:3px;border-radius:50%;background:'+col+';box-shadow:0 0 4px '+col;
      f.appendChild(sd);
      try{sd.animate([{transform:'translateX(0)',opacity:0},{opacity:.95,offset:.12},{opacity:.9,offset:.85},{transform:'translateX('+(W+10)+'px)',opacity:0}],{duration:hbaSeR(1100,1700)/sp,delay:i*230/sp,iterations:Infinity});}catch(e){}
    })(i);}
    rm(f,life/sp+80);
  }
  /* ② 七星心跳 · 圣剑出鞘 */
  function hbaSeSevenCores(bx,by,bw,bh,sz,sp){
    var cores=[];
    hbaSeCORE7.forEach(function(o,i){setTimeout(function(){
      var col=hbaSeRB7[i];
      var D=13*sz;
      var c=hbaSeEl('hba-se-core',bx+bw*o[0],by+bh*o[1],D,D);
      c.innerHTML=hbaSeStarSVG(D,col);
      c.style.filter='drop-shadow(0 0 7px '+col+') drop-shadow(0 0 14px '+col+')';
      try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.5)',offset:.4},{opacity:.95,transform:'translate(-50%,-50%) scale(1)'}],{duration:280/sp,fill:'forwards'});
      c.animate([{transform:'translate(-50%,-50%) scale(1)'},{transform:'translate(-50%,-50%) scale(1.22)'},{transform:'translate(-50%,-50%) scale(1)'}],{duration:430/sp,delay:300/sp,iterations:2});}catch(e){}
      cores.push({el:c,x:bx+bw*o[0],y:by+bh*o[1],col:col});
    },i*85/sp);});
    setTimeout(function(){
      var a=bw*0.62,b2=bh*0.34;
      cores.forEach(function(co,i){
        var phi=i/7*Math.PI*2;
        var kf=[];
        for(var k2=0;k2<=10;k2++){
          var t2=k2/10, ang=phi+t2*Math.PI*2;
          kf.push({left:(bx+Math.cos(ang)*a)+'px',top:(by-bh*0.04+Math.sin(ang)*b2)+'px'});
        }
        try{co.el.animate(kf,{duration:1050/sp,easing:'ease-in-out',fill:'forwards'});}catch(e){}
        co.ox=bx+Math.cos(phi)*a; co.oy=by-bh*0.04+Math.sin(phi)*b2;
      });
    },1180/sp);
    return cores;
  }
  function hbaSeSwordSVG(W,H){
    var id='ses'+Math.floor(Math.random()*1e6);
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 36 150" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">'
      +'<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1">'
      +'<stop offset="0%" stop-color="#ffffff"/><stop offset="14%" stop-color="#f43f5e"/><stop offset="30%" stop-color="#fb923c"/><stop offset="44%" stop-color="#fbbf24"/><stop offset="58%" stop-color="#4ade80"/><stop offset="72%" stop-color="#38bdf8"/><stop offset="86%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/>'
      +'</linearGradient></defs>'
      +'<path d="M18,2 L23,16 L21,108 L18,118 L15,108 L13,16 Z" fill="url(#'+id+')" stroke="#ffffff" stroke-width="1" stroke-opacity=".9"/>'
      +'<path d="M18,8 L18,112" stroke="#ffffff" stroke-width="1.1" opacity=".75"/>'
      +'<path d="M6,118 L30,118 L27,124 L9,124 Z" fill="#fbbf24" stroke="#fde68a" stroke-width="1"/>'
      +'<rect x="15.4" y="124" width="5.2" height="18" rx="2.4" fill="#b88a3a"/>'
      +'<circle cx="18" cy="146" r="4" fill="#c4b5fd" stroke="#fde68a" stroke-width="1.2"/></svg>';
  }
  function hbaSeSwordUnsheath(bx,by,bw,bh,sz,sp){
    var W=30*sz,H=126*sz;
    var sx=bx-bw*0.325, sy=by+bh*0.18;
    var s=hbaSeEl('hba-se-sword',sx-W/2,sy-H*0.88,W,H);
    s.innerHTML=hbaSeSwordSVG(W,H);
    s.style.filter='drop-shadow(0 0 8px rgba(196,181,253,.85)) drop-shadow(0 0 18px rgba(196,181,253,.45))';
    s.style.transform='rotate(14deg)';s.style.opacity='0';
    var upX=(bx-bw*0.46)-sx, upY=(by-bh*0.16)-sy;
    try{s.animate([
      {transform:'translate(0,0) rotate(14deg)',opacity:0},
      {transform:'translate(0,-8px) rotate(12deg)',opacity:.9,offset:.22},
      {transform:'translate('+upX+'px,'+upY+'px) rotate(-2deg)',opacity:1,offset:.78},
      {transform:'translate('+upX+'px,'+(upY-4)+'px) rotate(0deg)',opacity:1}
    ],{duration:520/sp,easing:'cubic-bezier(.3,.5,.35,1)',fill:'forwards'});}catch(e){s.style.opacity=1;}
    setTimeout(function(){
      var fl=hbaSeEl('hba-se-hit',sx+upX,sy+upY-H*0.5,26*sz,26*sz);
      fl.style.background='radial-gradient(circle,#ffffff,#e9d5ff 50%,transparent 78%)';
      try{fl.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:1},{transform:'translate(-50%,-50%) scale(1.3)',opacity:0}],{duration:260/sp});}catch(e){}
      rm(fl,320/sp);
      [0,120].forEach(function(d){setTimeout(function(){hbaSeRing(sx+upX,sy+upY-H*0.3,30*sz,'#e9d5ff',320/sp);},d/sp);});
    },480/sp);
    return {el:s,sx:sx,sy:sy};
  }
  function hbaSeLockCircle(hx,midY,sz,sp,life){
    var D=118*sz;
    var dots='';
    for(var i=0;i<7;i++){var a=i/7*360;var col=hbaSeRB7[i];dots+='<circle cx="50" cy="9" r="2.6" fill="'+col+'" transform="rotate('+a+' 50 50)"/>';}
    var c=hbaSeEl('hba-se-circle',hx,midY,D,Math.round(D*0.42));
    c.innerHTML='<div style="position:absolute;left:0;top:0;width:100%;height:100%;transform:scaleY(0.42);transform-origin:50% 50%"><svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" style="position:absolute;left:0;top:'+(-D*0.29)+'px" xmlns="http://www.w3.org/2000/svg">'
      +'<circle cx="50" cy="50" r="46" fill="none" stroke="#c4b5fd" stroke-width="1.8" opacity=".9"/>'
      +'<circle cx="50" cy="50" r="37" fill="none" stroke="#e9d5ff" stroke-width="1.1" stroke-dasharray="6 4"/>'
      +dots+'<circle cx="50" cy="50" r="7" fill="none" stroke="#ffffff" stroke-width="1.5"/></svg></div>';
    c.style.filter='drop-shadow(0 0 8px rgba(196,181,253,.7))';
    var svg=c.querySelector('svg');
    try{c.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.2)'},{opacity:.95,transform:'translate(-50%,-50%) scale(1)',offset:.18},{opacity:.85,offset:.92},{opacity:0}],{duration:life/sp,fill:'forwards'});
    if(svg)svg.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:2400/sp,iterations:Infinity});}catch(e){}
    rm(c,life/sp+80);
  }
  /* ③ 星辰序曲(七色流星) */
  function hbaSeMeteorShot(midY,barBot,vw,sz,sp,fxi,co,tx,k){
    var col=co.col;
    var x1=co.ox!=null?co.ox:co.x, y1=co.oy!=null?co.oy:co.y;
    try{co.el.style.opacity=0;}catch(e){}
    rm(co.el,80);
    var dx=tx-x1, dy=midY-6-y1;
    var rot=Math.atan2(dy,dx)*180/Math.PI+90;
    var W=10*sz,H=34*sz;
    var m=hbaSeEl('hba-se-meteor',x1-W/2,y1-H/2,W,H);
    m.innerHTML='<svg width="'+W+'" height="'+H+'" viewBox="0 0 10 34" xmlns="http://www.w3.org/2000/svg"><path d="M5,34 L8,12 Q5,8 5,2 Q5,8 2,12 Z" fill="'+col+'" opacity=".9"/><circle cx="5" cy="29" r="4" fill="#ffffff"/><circle cx="5" cy="29" r="2.2" fill="'+col+'"/></svg>';
    m.style.filter='drop-shadow(0 0 6px '+col+') drop-shadow(0 0 13px '+col+')';
    var mx=dx*0.5+hbaSeR(-22,22), my=dy*0.42-hbaSeR(18,40);
    try{m.animate([
      {transform:'translate(0,0) rotate('+rot+'deg) scale(.6)',opacity:0},
      {transform:'translate('+mx+'px,'+my+'px) rotate('+rot+'deg) scale(1)',opacity:1,offset:.42},
      {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale(1)',opacity:1,offset:.94},
      {transform:'translate('+dx+'px,'+dy+'px) rotate('+rot+'deg) scale(.7)',opacity:0}
    ],{duration:300/sp,easing:'cubic-bezier(.4,.05,.7,.6)',fill:'forwards'});}catch(e){}
    rm(m,360/sp);
    setTimeout(function(){
      hbaSeHit(tx,midY,34*sz,230/sp);
      hbaSeRing(tx,midY,28*sz,col,280/sp);
      hbaSeSparks(tx,midY,Math.round(4*fxi),.8,barBot+16,[col,'#ffffff']);
      var nt=hbaSeEl('hba-se-note',tx+hbaSeR(-10,10),midY-14,null,null);
      nt.textContent=Math.random()<.5?'♪':'♫';nt.style.color=col;nt.style.textShadow='0 0 6px '+col;
      try{nt.animate([{transform:'translateY(4px) scale(.6)',opacity:0},{transform:'translateY(-8px) scale(1.1)',opacity:1,offset:.3},{transform:'translateY(-26px) scale(.95) rotate(10deg)',opacity:0}],{duration:620/sp,easing:'ease-out'});}catch(e){}
      rm(nt,700/sp);
      hbaSeBar(120);hbaSeCombo(k,tx,midY,vw);
    },288/sp);
  }
  /* ④ 超新星挽歌 */
  function hbaSeSwordSlash(bx,by,bw,bh,sp,sw){
    if(sw&&sw.el){
      var sx=sw.sx, sy=sw.sy;
      try{sw.el.animate([
        {transform:'translate('+((bx-bw*0.46)-sx)+'px,'+((by-bh*0.16)-sy-4)+'px) rotate(0deg)'},
        {transform:'translate('+((bx-bw*0.2)-sx)+'px,'+((by-bh*0.42)-sy)+'px) rotate(58deg)',offset:.45},
        {transform:'translate('+((bx+bw*0.3)-sx)+'px,'+((by-bh*0.3)-sy)+'px) rotate(126deg)',opacity:1,offset:.82},
        {transform:'translate('+((bx+bw*0.34)-sx)+'px,'+((by-bh*0.26)-sy)+'px) rotate(132deg)',opacity:0}
      ],{duration:340/sp,easing:'cubic-bezier(.5,.05,.6,1)',fill:'forwards'});}catch(e){}
      rm(sw.el,420/sp);
    }
    var D=Math.round(bw*1.1);
    var a=hbaSeEl('hba-se-arc',bx,by-bh*0.3,D,D);
    var aid='sea'+Math.floor(Math.random()*1e6);
    a.innerHTML='<svg width="'+D+'" height="'+D+'" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="'+aid+'" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="transparent"/><stop offset="45%" stop-color="#e9d5ff"/><stop offset="100%" stop-color="#ffffff"/></linearGradient></defs><path d="M14,68 A 42 42 0 0 1 86,62" fill="none" stroke="url(#'+aid+')" stroke-width="5" stroke-linecap="round"/></svg>';
    a.style.filter='drop-shadow(0 0 9px rgba(196,181,253,.9))';
    try{a.animate([{opacity:0,transform:'translate(-50%,-50%) rotate(-26deg) scale(.7)'},{opacity:1,transform:'translate(-50%,-50%) rotate(0deg) scale(1.05)',offset:.55},{opacity:0,transform:'translate(-50%,-50%) rotate(10deg) scale(1.15)'}],{duration:380/sp,easing:'cubic-bezier(.4,.1,.5,1)'});}catch(e){}
    rm(a,440/sp);
  }
  function hbaSeSkyRift(vw,sz,sp,life){
    var W=Math.round(vw*0.78), H=24;
    var r=hbaSeEl('hba-se-rift',Math.round(vw/2),78,W,H);
    r.innerHTML='<svg width="'+W+'" height="'+H+'" viewBox="0 0 200 24" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
      +'<path d="M0,12 L26,7 L58,13 L96,5 L134,14 L168,8 L200,12 L168,15 L134,19 L96,12 L58,18 L26,15 Z" fill="#05030c" stroke="#c4b5fd" stroke-width="1"/>'
      +'<path d="M0,12 L200,12" stroke="#ffffff" stroke-width="1.6" opacity=".9"/>'
      +'<circle cx="58" cy="12" r="1.3" fill="#ffffff"/><circle cx="110" cy="10" r="1" fill="#e9d5ff"/><circle cx="152" cy="13" r="1.2" fill="#ffffff"/></svg>';
    r.style.filter='drop-shadow(0 0 10px rgba(196,181,253,.8))';
    try{r.animate([{opacity:0,transform:'translate(-50%,-50%) scaleX(0)'},{opacity:1,transform:'translate(-50%,-50%) scaleX(1.04)',offset:.5},{opacity:1,transform:'translate(-50%,-50%) scaleX(1)',offset:.62},{opacity:.95,offset:.9},{opacity:0,transform:'translate(-50%,-50%) scaleX(.1)'}],{duration:life/sp,easing:'cubic-bezier(.3,.7,.3,1)',fill:'forwards'});}catch(e){}
    rm(r,life/sp+80);
  }
  function hbaSeGalaxyFall(vw,sz,sp,nucY){
    var topY=92, H=Math.max(40,nucY-topY+8);
    var Wt=58*sz, Wb=30*sz, W=Math.round(Math.max(Wt,Wb)+8);
    var f=hbaSeEl('hba-se-gfall',Math.round(vw/2-W/2),topY,W,H);
    var inner=document.createElement('div');
    inner.style.cssText='position:absolute;left:0;top:0;width:100%;height:100%;'
      +'background:linear-gradient(180deg,rgba(196,181,253,.55) 0%,rgba(196,181,253,.36) 50%,rgba(196,181,253,.5) 100%);'
      +'clip-path:polygon('+((W-Wt)/2)+'px 0,'+((W+Wt)/2)+'px 0,'+((W+Wb)/2)+'px 100%,'+((W-Wb)/2)+'px 100%);'
      +'box-shadow:0 0 18px rgba(196,181,253,.4)';
    f.appendChild(inner);
    for(var i=0;i<6;i++){(function(i){
      var sd=document.createElement('div');
      var col=hbaSeRB7[i%7];
      sd.style.cssText='position:absolute;left:'+hbaSeR(W*0.3,W*0.7)+'px;top:-8px;width:3px;height:7px;border-radius:2px;background:'+col+';box-shadow:0 0 5px '+col;
      f.appendChild(sd);
      try{sd.animate([{transform:'translateY(0)',opacity:0},{opacity:.95,offset:.12},{opacity:.9,offset:.86},{transform:'translateY('+(H+12)+'px)',opacity:0}],{duration:hbaSeR(380,560)/sp,delay:i*70/sp,iterations:Infinity});}catch(e){}
    })(i);}
    f.style.clipPath='inset(0 0 100% 0)';
    try{f.animate([{clipPath:'inset(0 0 100% 0)',opacity:.95},{clipPath:'inset(0 0 0% 0)',opacity:1,offset:.5},{opacity:1,offset:.88},{opacity:0}],{duration:880/sp,easing:'cubic-bezier(.4,.1,.6,.9)',fill:'forwards'});}catch(e){f.style.clipPath='none';}
    rm(f,960/sp);
  }
  function hbaSeNova(cx,midY,barBot,vw,sz,sp,fxi,stars,deal){
    var nucY=midY-86*sz;
    var D=30*sz;
    var nuc=hbaSeEl('hba-se-nuc',cx,nucY,D,D);
    nuc.innerHTML='<div style="position:absolute;left:50%;top:50%;width:'+D+'px;height:'+D+'px;margin:-'+(D/2)+'px 0 0 -'+(D/2)+'px;border-radius:50%;background:radial-gradient(circle,#ffffff 0%,#e9d5ff 46%,rgba(196,181,253,.5) 70%,transparent 84%);box-shadow:0 0 18px rgba(196,181,253,.95),0 0 38px rgba(196,181,253,.5)"></div>';
    try{nuc.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.55},{transform:'translate(-50%,-50%) scale(1.06)',opacity:1}],{duration:320/sp,easing:'cubic-bezier(.3,.5,.4,1)',fill:'forwards'});}catch(e){}
    var ac=hbaSeEl('hba-se-accr',cx,nucY,Math.round(D*2.6),Math.round(D*2.6));
    ac.style.background='conic-gradient(from 0deg,#f43f5e,#fb923c,#fbbf24,#4ade80,#38bdf8,#a855f7,#ec4899,#f43f5e)';
    ac.style.webkitMask='radial-gradient(circle,transparent 56%,#000 60%,#000 78%,transparent 84%)';
    ac.style.mask='radial-gradient(circle,transparent 56%,#000 60%,#000 78%,transparent 84%)';
    ac.style.opacity='.85';
    try{ac.animate([{transform:'translate(-50%,-50%) rotate(0deg) scale(.4)',opacity:0},{opacity:.85,offset:.3},{transform:'translate(-50%,-50%) rotate(360deg) scale(1)',opacity:.85}],{duration:680/sp,easing:'ease-out',fill:'forwards'});}catch(e){}
    setTimeout(function(){
      for(var i=0;i<8;i++){(function(i){
        var ang=hbaSeR(0,Math.PI*2),d0=hbaSeR(46,80)*sz;
        var x0=cx+Math.cos(ang)*d0, y0=nucY+Math.sin(ang)*d0;
        var w=hbaSeR(2,3.4);
        var m=hbaSeEl('hba-se-spark',x0,y0,w,w);
        var col=hbaSeRB7[i%7];
        m.style.background=col;m.style.boxShadow='0 0 5px '+col;
        try{m.animate([{transform:'translate(0,0)',opacity:.95},{transform:'translate('+(cx-x0)+'px,'+(nucY-y0)+'px) scale(.25)',opacity:0}],{duration:hbaSeR(220,320)/sp,easing:'cubic-bezier(.4,.1,.7,1)'});}catch(e){}
        rm(m,360/sp);
      })(i);}
      try{nuc.animate([{transform:'translate(-50%,-50%) scale(1.06)'},{transform:'translate(-50%,-50%) scale(.32)',offset:.7},{transform:'translate(-50%,-50%) scale(.26)'}],{duration:300/sp,easing:'cubic-bezier(.6,.05,.8,.5)',fill:'forwards'});
      ac.animate([{transform:'translate(-50%,-50%) rotate(360deg) scale(1)',opacity:.85},{transform:'translate(-50%,-50%) rotate(560deg) scale(.3)',opacity:0}],{duration:300/sp,easing:'ease-in',fill:'forwards'});}catch(e){}
      var hush=hbaSeEl('hba-se-hush',0,0);
      try{hush.animate([{opacity:0},{opacity:1,offset:.4},{opacity:1,offset:.72},{opacity:0}],{duration:330/sp,easing:'ease-in-out'});}catch(e){}
      rm(hush,400/sp);
      rm(ac,340/sp);
      setTimeout(function(){
        try{nuc.animate([{top:nucY+'px',transform:'translate(-50%,-50%) scale(.26)'},{top:midY+'px',transform:'translate(-50%,-50%) scale(.5)',offset:.92},{top:midY+'px',transform:'translate(-50%,-50%) scale(1.6)',opacity:0}],{duration:170/sp,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'});}catch(e){}
        rm(nuc,230/sp);
        setTimeout(function(){
          hbaSeVign(.62,620/sp);
          hbaSeHit(cx,midY,112*sz*fxi,420/sp);
          hbaSeRB7.forEach(function(col,i){setTimeout(function(){
            hbaSeRing(cx,midY,(36+i*15)*sz,col,330/sp);
          },i*52/sp);});
          hbaSeGShock(cx,midY,vw,sp);
          for(var i2=0;i2<5;i2++){
            var ang2=(Math.random()<.5?-1:1)*hbaSeR(.05,.17), len=hbaSeR(36,60)*sz;
            var rot2=ang2+(Math.random()<.5?Math.PI:0);
            var col2=hbaSeRB7[i2%7];
            var c=hbaSeEl('hba-se-crack',cx,midY+5,len,null);
            c.style.background='linear-gradient(90deg,#ffffff,'+col2+' 40%,transparent)';
            c.style.boxShadow='0 0 6px '+col2;
            c.style.transform='rotate('+rot2+'rad) scaleX(0)';
            try{c.animate([{transform:'rotate('+rot2+'rad) scaleX(0)',opacity:1},{transform:'rotate('+rot2+'rad) scaleX(1)',opacity:.95,offset:.25},{opacity:.6,offset:.55},{opacity:.85,offset:.7},{opacity:0}],{duration:hbaSeR(600,840)/sp});}catch(e){}
            rm(c,900/sp);
          }
          hbaSeSparks(cx,midY,Math.round(22*fxi),1.3,barBot+16,hbaSeRB7);
          hbaSeShrap(cx,midY,Math.round(7*fxi),barBot+16);
          hbaSeBar(420);
          deal();
          var vap=setInterval(function(){
            var w=hbaSeR(2,3.4);
            var col3=hbaSeRB7[Math.floor(hbaSeR(0,7))];
            var m=hbaSeEl('hba-se-spark',cx+hbaSeR(-58,58)*sz,midY+hbaSeR(-6,6),w,w);
            m.style.background=col3;m.style.boxShadow='0 0 5px '+col3;
            try{m.animate([{transform:'translate(0,0)',opacity:1},{transform:'translate('+hbaSeR(-9,9)+'px,'+(-hbaSeR(40,86))+'px)',opacity:0}],{duration:hbaSeR(380,560)/sp,easing:'ease-out'});}catch(e){}
            rm(m,620/sp);
          },70);
          setTimeout(function(){clearInterval(vap);},600/sp);
          setTimeout(function(){
            var D2=15*sz;
            var ns=hbaSeEl('hba-se-newstar',cx,midY-6,D2,D2);
            ns.innerHTML=hbaSeStarSVG(D2,'#ffffff');
            ns.style.filter='drop-shadow(0 0 8px #e9d5ff) drop-shadow(0 0 16px rgba(196,181,253,.7))';
            try{ns.animate([{transform:'translate(-50%,-50%) scale(.2) rotate(0deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1.2) rotate(60deg)',opacity:1,offset:.28},{transform:'translate(-50%,-50%) translateY(-58px) scale(.7) rotate(170deg)',opacity:0}],{duration:920/sp,easing:'ease-out'});}catch(e){}
            rm(ns,1000/sp);
            [0,170].forEach(function(d,i){setTimeout(function(){
              var nt=hbaSeEl('hba-se-note',cx+hbaSeR(-26,26),midY-20,null,null);
              nt.textContent=i===0?'♪':'♫';nt.style.color='#e9d5ff';nt.style.textShadow='0 0 6px #c4b5fd';
              try{nt.animate([{transform:'translateY(4px) scale(.6)',opacity:0},{transform:'translateY(-10px) scale(1)',opacity:.95,offset:.3},{transform:'translateY(-32px) scale(.9) rotate(-8deg)',opacity:0}],{duration:760/sp,easing:'ease-out'});}catch(e){}
              rm(nt,840/sp);
            },d/sp);});
            hbaSeKillStars(stars,sp);
            var ag=hbaSeEl('hba-se-glow',cx,midY,Math.round(76*sz),Math.round(22*sz));
            ag.style.background='radial-gradient(ellipse,rgba(196,181,253,.5) 0%,rgba(196,181,253,.18) 55%,transparent 80%)';
            try{ag.animate([{opacity:.95},{opacity:.45,offset:.5},{opacity:0}],{duration:720/sp,easing:'ease-out'});}catch(e){}
            rm(ag,800/sp);
          },420/sp);
        },170/sp);
      },330/sp);
    },680/sp);
  }
  function hbaStarEmpress(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    var vw=window.innerWidth, vh=window.innerHeight;
    var br=(bsEl&&bsEl.getBoundingClientRect)?bsEl.getBoundingClientRect():null;
    var bx=br?br.left+br.width/2:vw/2, by=br?br.top+br.height/2:184, bw=br?Math.max(br.width,120):150, bh=br?Math.max(br.height,120):150, bsBot=br?br.bottom:252;
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var dome=hbaSeEl('hba-se-dome',0,0);
    requestAnimationFrame(function(){dome.style.opacity=1;});
    setTimeout(function(){dome.style.opacity=0;},6500/sp);rm(dome,7200/sp);
    /* ① 繁星为我加冕 */
    var stars=hbaSeSkyStars(vw,vh,sp);
    hbaSeConstellation(bx,by,bh,sz,sp);
    setTimeout(function(){hbaSeHaloAwake(bsEl,bx,by,bw,bh,sp,5200);},180/sp);
    setTimeout(function(){hbaSeGalaxyFlow(bx,bsBot,bw,sp,4900);},340/sp);
    /* ② 七星心跳 · 圣剑出鞘 */
    var cores=[], sw=null;
    setTimeout(function(){
      cores=hbaSeSevenCores(bx,by,bw,bh,sz,sp);
      setTimeout(function(){sw=hbaSeSwordUnsheath(bx,by,bw,bh,sz,sp);},560/sp);
      setTimeout(function(){hbaSeLockCircle(hx,barL!=null?midY:midY,sz,sp,2050);},760/sp);
    },1100/sp);
    /* ③ 星辰序曲 */
    var n=Math.max(3,Math.round(7*fxi)); if(n>7)n=7;
    var slots=[.5,.3,.7,.14,.86,.4,.6];
    for(var k=0;k<n;k++){(function(k){setTimeout(function(){
      var co=cores[k]||{x:bx,y:by,col:hbaSeRB7[k%7],el:document.createElement('div')};
      var tx=barL+barW*slots[k%7];
      hbaSeMeteorShot(midY,barBot,vw,sz,sp,fxi,co,tx,k+1);
    },(2350+k*150)/sp);})(k);}
    var lastHit=(2350+(n-1)*150+288)/sp;
    /* ④ 超新星挽歌 */
    var cx=Math.round(vw/2);
    setTimeout(function(){
      if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 24px rgba(196,181,253,.9)) brightness(1.4)',offset:.2},{filter:'drop-shadow(0 0 14px rgba(196,181,253,.5)) brightness(1.08)',offset:.55},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
      hbaSeSwordSlash(bx,by,bw,bh,sp,sw);
      setTimeout(function(){hbaSeSkyRift(vw,sz,sp,1500);},300/sp);
      setTimeout(function(){hbaSeGalaxyFall(vw,sz,sp,midY-86*sz);},550/sp);
      setTimeout(function(){hbaSeNova(cx,midY,barBot,vw,sz,sp,fxi,stars,deal);},1000/sp);
    },lastHit+160/sp);
  }
  function makeWeapon(type){
    if(type==='hammer'){
      var w=svgEl('<svg class="hba-weapon" viewBox="0 0 140 210" width="108" height="162" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="hbaHmH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1e293b"/><stop offset="0.45" stop-color="#cbd5e1"/><stop offset="0.55" stop-color="#94a3b8"/><stop offset="1" stop-color="#0f172a"/></linearGradient><linearGradient id="hbaHmW" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#451a03"/><stop offset="0.5" stop-color="#92400e"/><stop offset="1" stop-color="#451a03"/></linearGradient></defs><rect x="64" y="0" width="12" height="150" rx="5" fill="url(#hbaHmW)"/><rect x="62" y="30" width="16" height="4" fill="#1c0a00" opacity="0.6"/><rect x="62" y="46" width="16" height="4" fill="#1c0a00" opacity="0.6"/><rect x="62" y="62" width="16" height="4" fill="#1c0a00" opacity="0.6"/><path d="M28 122 L112 122 L124 150 L112 194 L28 194 L16 150 Z" fill="url(#hbaHmH)" stroke="#020617" stroke-width="3" stroke-linejoin="round"/><path d="M34 130 L106 130 L112 150 L106 186 L34 186 Z" fill="none" stroke="#e2e8f0" stroke-width="2" opacity="0.45"/><circle cx="38" cy="142" r="3.5" fill="#020617"/><circle cx="38" cy="174" r="3.5" fill="#020617"/><circle cx="102" cy="142" r="3.5" fill="#020617"/><circle cx="102" cy="174" r="3.5" fill="#020617"/><path d="M16 150 L4 143 L4 157 Z" fill="#94a3b8" stroke="#020617" stroke-width="1.5"/><path d="M124 150 L136 143 L136 157 Z" fill="#94a3b8" stroke="#020617" stroke-width="1.5"/></svg>');
      w._impY=150;return w;
    }
    // 🔴 v497: 机械泰坦拳头改用真实立绘图(Hansen 反馈旧 SVG 拳头太丑)+透明背景 PNG, 用 <img>(非 SVG <image>, 微信内核安全)。slam 动画(hbaWeaponSlam)垂直砸下。
    // 🔴 v501: Hansen 定稿——拳头改为【竖直砸下】(去掉旧 45° 斜角·mechfist_real.webp 已转正为前臂在上/指节朝正下的竖直图 204×337) + 尺寸缩小到高 86px。
    // 🔴 v499 BUG#67: 优先克隆【已预加载解码好】的拳头图(共享位图·即时绘制·不重新请求/不重新解码) → 拳头必即时显示; 预加载尚未完成时兜底现取。
    var m;
    if(window.__hbaFistImg && (window.__hbaFistReady || window.__hbaFistImg.complete) && window.__hbaFistImg.naturalWidth>0){
      m=window.__hbaFistImg.cloneNode(false);
    } else {
      m=document.createElement('img'); m.src=_fistSrc;
    }
    m.className='hba-fist';   // 🔴 v502: 用专属类(小变大+原地淡出), 与百战兽人锤子 hba-weapon 分开
    m.width=96;m.height=172;m.alt='';m.draggable=false;   // 🔴 v508: Hansen 定稿——换新拳头图(赛博机械拳套·图201×360·前臂在上指节朝下) + 大小200%(高172=旧86×2·宽96=高×0.559)
    m._impY=169;return m;  // 命中点(指节)在底部(≈172×0.98)
  }
  // 🔴 v503: 太阳火球(同拳头·克隆预加载解码好的图·即时绘制防空白; 正方·86px)
  function makeSunball(){
    var m;
    if(window.__hbaSunImg && (window.__hbaSunReady || window.__hbaSunImg.complete) && window.__hbaSunImg.naturalWidth>0){
      m=window.__hbaSunImg.cloneNode(false);
    } else {
      m=document.createElement('img'); m.src=_sunSrc;
    }
    m.className='hba-sunball'; m.width=86;m.height=86;m.alt='';m.draggable=false; return m;
  }
  // 🔴 v504/v505: 光波/光束(同拳头/火球·克隆预加载解码好的图·即时绘制防空白; 宽由 playFx 按 boss→勇者距离动态设, 高 auto 保持比例)。which='chaos'(混沌魔尊漩涡) | 'beam'(外星霸主光束)。
  function makeWaveImg(which){
    var src=(which==='beam')?_beamSrc:_waveSrc;
    var img=(which==='beam')?window.__hbaBeamImg:window.__hbaWaveImg;
    var ready=(which==='beam')?window.__hbaBeamReady:window.__hbaWaveReady;
    var m;
    if(img && (ready || img.complete) && img.naturalWidth>0){
      m=img.cloneNode(false);
    } else {
      m=document.createElement('img'); m.src=src;
    }
    m.className='hba-chaoswave'; m.alt='';m.draggable=false; m.style.height='auto'; return m;
  }
  // 🔴 v506: 单颗吸血鬼牙齿(图片·克隆预加载防空白; sz=缩放比例, which=tl/tr/bl/br)。返回带 _w/_h 的 wrapper。
  function makeVfang(which, sz){
    var dim=_vfangDim[which]||[191,417];
    var baseH=(which==='tl'||which==='tr')?48:44;   // 上牙基准48·下牙基准44
    var H=Math.round(baseH*sz), W=Math.round(H*dim[0]/dim[1]);
    var wrap=document.createElement('div'); wrap.className='hba-vfang';
    wrap.style.width=W+'px'; wrap.style.height=H+'px';
    var pre=window.__hbaVfangImgs&&window.__hbaVfangImgs[which], img;
    if(pre && pre.naturalWidth>0){ img=pre.cloneNode(false); } else { img=document.createElement('img'); img.src=_vfangSrcs[which]; }
    img.alt=''; img.draggable=false; wrap.appendChild(img);
    wrap._w=W; wrap._h=H; return wrap;
  }
  // 🔴 v507: 手里剑(图片·克隆预加载防空白; sz=显示边长px)。返回正方 wrapper。
  function makeShuriken(sz){
    var wrap=document.createElement('div'); wrap.className='hba-shuriken';
    wrap.style.width=sz+'px'; wrap.style.height=sz+'px';
    var pre=window.__hbaShuriImg, img;
    if(pre && pre.naturalWidth>0){ img=pre.cloneNode(false); } else { img=document.createElement('img'); img.src=_shuriSrc; }
    img.alt=''; img.draggable=false; wrap.appendChild(img); return wrap;
  }
  // 🔴 v507: 血液飞溅(在视口坐标 cx,cy 处)——红色冲击环 + 12 滴血四溅(带重力下落)。
  function bloodSplatter(cx,cy){
    var ring=document.createElement('div'); ring.className='hba-splash-ring';
    ring.style.left=cx+'px'; ring.style.top=cy+'px';
    add(ring); rm(ring,560);
    for(var i=0;i<12;i++){
      var sp=document.createElement('div'); sp.className='hba-splat';
      var s=4+Math.random()*7; sp.style.width=s+'px'; sp.style.height=s+'px';
      sp.style.left=cx+'px'; sp.style.top=cy+'px';
      var ang=(Math.PI*2*i/12)+(Math.random()-.5)*0.5, dist=24+Math.random()*46;
      var dx=Math.cos(ang)*dist, dy=Math.sin(ang)*dist-12, gy=dy+34+Math.random()*26;
      try{ sp.animate([
        {transform:'translate(-50%,-50%) translate(0,0) scale(1)',opacity:1},
        {transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) scale(.9)',opacity:1,offset:.45},
        {transform:'translate(-50%,-50%) translate('+(dx*1.15)+'px,'+gy+'px) scale(.5)',opacity:0}
      ],{duration:560+Math.random()*180,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
      add(sp); rm(sp,800);
    }
  }
  function makeTentacle2(dir,uid){
    var s=dir,gid='hbaTn'+uid;
    var d='M20 140 C '+(20+14*s)+' 112 '+(40-2*s)+' 96 '+(30+10*s)+' 70 C '+(24+16*s)+' 50 '+(38-4*s)+' 34 '+(30+6*s)+' 14 C '+(29+6*s)+' 8 '+(33+6*s)+' 8 '+(34+6*s)+' 14 C '+(40+6*s)+' 34 '+(30-4*s)+' 50 '+(40+10*s)+' 70 C '+(48+10*s)+' 96 '+(34+14*s)+' 112 36 140 Z';
    return svgEl('<svg class="hba-tentacle2" viewBox="0 0 56 140" width="44" height="110" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="'+gid+'" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f766e"/><stop offset="0.55" stop-color="#14b8a6"/><stop offset="1" stop-color="#5eead4"/></linearGradient></defs><path d="'+d+'" fill="url(#'+gid+')" stroke="#0d9488" stroke-width="2" stroke-linejoin="round"/><circle cx="'+(27+6*s)+'" cy="104" r="3.5" fill="#0a4f49"/><circle cx="'+(30+8*s)+'" cy="80" r="3.2" fill="#0a4f49"/><circle cx="'+(32+6*s)+'" cy="54" r="2.8" fill="#0a4f49"/><circle cx="'+(32+4*s)+'" cy="30" r="2.2" fill="#0a4f49"/></svg>');
  }
  function tentaclesRise(){
    var hs=heroSec();if(!hs)return;var r=hs.getBoundingClientRect();var n=8,baseY=r.bottom-6;
    for(var i=0;i<n;i++){
      (function(k){setTimeout(function(){
        var t=makeTentacle2((k%2===0)?1:-1,k);var x=r.left+r.width*((k+0.5)/n);
        t.style.left=x+'px';t.style.top=(baseY-110)+'px';add(t);rm(t,780);
      },k*38)})(i);
    }
  }
  function flyOnHit(cfg,x,y){
    var burst=document.createElement('div');burst.className='hba-orb-burst';
    burst.style.background=cfg.burst||'radial-gradient(circle,rgba(255,255,255,.9),transparent 75%)';burst.style.left=x+'px';burst.style.top=y+'px';
    add(burst);rm(burst,520);
    if(cfg.shards)burstShards(x,y,PAL[cfg.shards],cfg.shards==='rainbow'?16:12);
    if(cfg.frost)tintOverlay('rgba(94,234,212,.42)');
    if(cfg.tint)tintOverlay(cfg.tint);
  }
  // 🔴 v503: 上古太阳神火球命中——血条火焰燃烧(火苗鼓动)+炽热爆发光+火星+暖色覆盖。position:fixed·零震屏零屏闪。
  function sunFireBurn(x,y){
    var f=document.createElement('div');f.className='hba-sunfire';f.style.left=x+'px';f.style.top=y+'px';
    var n=9,html='';
    for(var i=0;i<n;i++){ var h=22+Math.floor(Math.random()*16); var d=(Math.random()*0.22).toFixed(2); html+='<span class="hba-sunflame" style="height:'+h+'px;animation-delay:'+d+'s"></span>'; }
    f.innerHTML=html;add(f);rm(f,840);
    var burst=document.createElement('div');burst.className='hba-orb-burst';burst.style.background='radial-gradient(circle,rgba(254,243,199,.95),rgba(251,146,60,.6) 42%,transparent 78%)';burst.style.left=x+'px';burst.style.top=y+'px';add(burst);rm(burst,520);
    burstShards(x,y,PAL.fire,12);
    tintOverlay('rgba(249,115,22,.34)');
  }
  function chaosExplode(x,y){
    var c=document.createElement('div');c.className='hba-boom-core';c.style.left=x+'px';c.style.top=y+'px';add(c);rm(c,420);
    var b=document.createElement('div');b.className='hba-bigboom';b.style.left=x+'px';b.style.top=y+'px';add(b);rm(b,640);
    var ry=document.createElement('div');ry.className='hba-boom-rays';ry.style.left=x+'px';ry.style.top=y+'px';add(ry);rm(ry,560);
    [['rgba(245,235,255,.95)','0s','.5s'],['rgba(192,132,252,.9)','.06s','.62s'],['rgba(147,51,234,.8)','.13s','.72s']].forEach(function(cf){
      var s=document.createElement('div');s.className='hba-orb-burst';s.style.width='60px';s.style.height='60px';s.style.border='4px solid '+cf[0];s.style.background='transparent';
      s.style.left=x+'px';s.style.top=y+'px';s.style.animationDelay=cf[1];s.style.animationDuration=cf[2];add(s);rm(s,950);
    });
    var h=document.createElement('div');h.className='hba-boom-halo';h.style.left=x+'px';h.style.top=y+'px';add(h);rm(h,820);
    burstShards(x,y,PAL.magic,16);burstChunks(x,y);
  }
  function pierceImpact(x,y){
    var m=document.createElement('div');m.className='hba-stab-mark';m.style.left=x+'px';m.style.top=y+'px';add(m);rm(m,420);
    tintOverlay('rgba(220,38,38,.46)');
  }

  // 🔴 v511: 烈焰魔神火焰陨石雨——熔岩岩石陨石SVG(岩石核心+裂纹+陨石坑+炽热前缘+燃烧彗尾·竖直朝下=前进方向) + 残留地火
  function hbmMeteorSVG(u){
    return '<svg viewBox="0 0 48 116" xmlns="http://www.w3.org/2000/svg">'
      +'<defs>'
      +'<linearGradient id="t'+u+'" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="var(--mc3)" stop-opacity="0"/><stop offset="0.3" stop-color="var(--mc4)" stop-opacity="0.6"/><stop offset="0.62" stop-color="var(--mc3)"/><stop offset="0.85" stop-color="var(--mc2)"/><stop offset="1" stop-color="#fff"/></linearGradient>'
      +'<radialGradient id="r'+u+'" cx="0.42" cy="0.4" r="0.72"><stop offset="0" stop-color="#7a6150"/><stop offset="0.55" stop-color="#3e2f24"/><stop offset="1" stop-color="#150e0a"/></radialGradient>'
      +'<radialGradient id="g'+u+'" cx="0.5" cy="0.62" r="0.62"><stop offset="0" stop-color="var(--mc2)" stop-opacity="0.85"/><stop offset="0.45" stop-color="var(--mc3)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--mc3)" stop-opacity="0"/></radialGradient>'
      +'</defs>'
      +'<path d="M24,2 C18,34 19,52 24,62 C29,52 30,34 24,2 Z" fill="url(#t'+u+')"/>'
      +'<ellipse cx="24" cy="64" rx="23" ry="25" fill="url(#g'+u+')"/>'
      +'<path d="M24,46 L34,51 L39,62 L37,76 L28,84 L18,83 L10,74 L9,60 L15,50 Z" fill="url(#r'+u+')" stroke="#0d0907" stroke-width="1"/>'
      +'<circle cx="19" cy="60" r="2.2" fill="#0d0907" opacity="0.55"/><circle cx="30" cy="66" r="1.5" fill="#0d0907" opacity="0.45"/>'
      +'<path d="M20,54 L25,61 L21,69 L26,77" stroke="var(--mc2)" stroke-width="1.7" fill="none" opacity="0.95"/>'
      +'<path d="M31,58 L25,64 L32,71" stroke="var(--mc3)" stroke-width="1.4" fill="none" opacity="0.9"/>'
      +'<path d="M13,64 L19,67" stroke="var(--mc2)" stroke-width="1.1" fill="none" opacity="0.8"/>'
      +'<ellipse cx="24" cy="80" rx="12" ry="5.5" fill="#fff" opacity="0.8"/>'
      +'<ellipse cx="24" cy="81" rx="8" ry="3.5" fill="var(--mc2)"/>'
      +'</svg>';
  }
  function hbmGroundFire(wrap,cx,cy,big){
    var nf=big?5:3,i;
    for(i=0;i<nf;i++){ var fw=(big?14:9)+Math.random()*8, fh=fw*(1.5+Math.random()*0.6);
      var g=hbmEl(wrap,'hba-gfire',cx+(Math.random()-.5)*(big?44:26),cy+2,fw,fh); g.style.transform='translate(-50%,-100%) scaleY(0)';
      try{ g.animate([{transform:'translate(-50%,-100%) scaleY(0)',opacity:0},{transform:'translate(-50%,-100%) scaleY(1.08)',opacity:1,offset:.18},{transform:'translate(-50%,-100%) scaleY(.92)',opacity:.92,offset:.6},{transform:'translate(-50%,-100%) scaleY(.5)',opacity:0}],{duration:(big?620:460)+Math.random()*160,easing:'ease-out',fill:'forwards'});}catch(e){} rm(g,850); }
  }
  /* ════════════════════════════════════════════════════════════════
     🔴 v802: 赛季六 boss canvas 攻击特效引擎(创世锻造/锁魂囚渊/终焉时刻/圣光裁决)
     —— 复用已锁定的 canvas 特效预览代码移植进游戏: 严格零震屏(shake 全清)零屏闪
     (删全屏 fillRect 白闪/定格罩, 只留局部辉光 radial-gradient/shadowBlur), 不重绘 boss
     (boss 是 DOM 立绘), 不依赖任何外部图(纯 canvas 绘制·无 BUG#67 风险), 锚定 boss 立绘+勇者血条,
     下落元素钳位答题区上方(clipBottom=barBot+16·答题区零侵犯), 命中时刻调 deal()。
     一层全屏 fixed canvas 挂 __hansenFxLayer(z9980·pointer-events:none), 播完即移除。
     全 ES5(var/function·无 const/let/arrow/for-of)·微信内核安全。
     ════════════════════════════════════════════════════════════════ */
  function __hbaFxCanvasNew(){
    var vw=window.innerWidth, vh=window.innerHeight;
    var DPR=Math.min(window.devicePixelRatio||1,2);
    var cv=document.createElement('canvas');
    cv.style.cssText='position:fixed;left:0;top:0;width:'+vw+'px;height:'+vh+'px;pointer-events:none;';
    cv.width=Math.round(vw*DPR); cv.height=Math.round(vh*DPR);
    (window.__hansenFxLayer||document.body).appendChild(cv);
    var ctx=cv.getContext('2d'); ctx.setTransform(DPR,0,0,DPR,0,0);
    return {cv:cv, ctx:ctx, W:vw, H:vh};
  }
  /* 把"预览虚拟舞台"映射到真实战场: 锚A/锚B 各 (vy=预览Y占比, sy=屏幕Y); cx=舞台水平中心屏幕X; aspect=舞台宽/高(预览=1.25) */
  function __hbaMapStage(aVy,aSy,bVy,bSy,cx,aspect){
    var H=(bSy-aSy)/(bVy-aVy);
    if(!isFinite(H)||H<=0){ H=Math.max(360, window.innerHeight*0.7); }
    if(H<240){H=240;} if(H>1200){H=1200;}
    var SY=aSy-aVy*H, W=H*aspect, SX=cx-0.5*W;
    return {W:W, H:H, SX:SX, SY:SY};
  }

  /* ─────────── 铸星者·原初匠人 → 创世锻造 ─────────── */
  function hbaStarForge(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect(), bcy=br.top+br.height*0.5;
      var clipBottom=barBot+16;
      var st=__hbaMapStage(0.70,bcy,1.0,midY,hx,1.25);
      var W=st.W,H=st.H,SX=st.SX,SY=st.SY;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      function rrect(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
      function star(x,y,R,rot,fill,glow,a){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.beginPath();for(var i=0;i<10;i++){var ang=Math.PI/5*i-Math.PI/2,rr=i%2?R*0.42:R;var px=Math.cos(ang)*rr,py=Math.sin(ang)*rr;if(i){ctx.lineTo(px,py);}else{ctx.moveTo(px,py);}}ctx.closePath();ctx.shadowBlur=R*1.8;ctx.shadowColor=glow;ctx.globalAlpha=a;ctx.fillStyle=fill;ctx.fill();ctx.restore();}
      function ember(k){if(k<0.34){return [255,Math.round(245-k*120),Math.round(205-k*180)];}if(k<0.67){return [255,Math.round(180-(k-0.34)*170),Math.round(55-(k-0.34)*90)];}return [Math.round(255-(k-0.67)*70),Math.round(72-(k-0.67)*90),28];}
      var _craters=[[-30,-12,7],[-8,8,5],[18,-16,6],[34,12,5],[-44,16,4],[6,-22,4]];
      function drawHammer(cx,cy,s,rot,a){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        ctx.fillStyle="#3a2a18";rrect(-9,-210,18,176,6);ctx.fill();ctx.strokeStyle="#7a5a2e";ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle="#caa24a";rrect(-11,-44,22,18,4);ctx.fill();
        ctx.fillStyle="#caa24a";rrect(-74,-46,148,92,18);ctx.fill();
        ctx.fillStyle="#34343c";rrect(-64,-37,128,74,13);ctx.fill();
        ctx.fillStyle="#e6c061";rrect(-74,-46,16,92,8);ctx.fill();rrect(58,-46,16,92,8);ctx.fill();
        ctx.fillStyle="rgba(20,20,26,.8)";for(var ci=0;ci<_craters.length;ci++){var c=_craters[ci];ctx.beginPath();ctx.arc(c[0],c[1],c[2],0,6.28);ctx.fill();}
        star(0,2,16,rot*0.3,"#fff6dc","#ffb13c",1);
        ctx.restore();
      }
      var sparks=[],rings=[],cracks=[],debris=[],meteors=[],flashes=[];
      var t=0,last=0,running=true,hammer={},bigFlash=0,didImpact=false,nextMeteor=0,didFinal=false,dealt=false;
      var SLAM_T=430, IMPACT_T=470, METEOR_END=1850, FINAL_T=1820;
      nextMeteor=470;
      function IMP(){return {x:W*0.5, y:H*0.70};}
      function impact(){
        didImpact=true;var p=IMP();bigFlash=1;
        flashes.push({x:p.x,y:p.y,r:0,vr:30*sz,life:0,max:300});
        for(var i=0;i<4;i++){rings.push({x:p.x,y:p.y,r:6*sz,vr:(7+i*2.2)*sz,life:0,max:560+i*120,w:(9-i*1.8)*sz});}
        var nc=Math.round(9*Math.min(1.6,fxi));
        for(var i2=0;i2<nc;i2++){var ang=(i2/nc)*6.28+Math.random()*0.3;var seg=[],n=4+Math.round(Math.random()*3);var x=p.x,y=p.y,len=(30+Math.random()*40)*sz;
          for(var j=0;j<n;j++){var aa=ang+(Math.random()-0.5)*0.5;x+=Math.cos(aa)*len;y+=Math.sin(aa)*len*0.5;seg.push([x,y]);len*=0.8;}
          cracks.push({seg:seg,life:0,max:1400,grow:0});}
        var nd=Math.round(22*fxi);
        for(var i3=0;i3<nd;i3++){var ang3=-Math.PI/2+(Math.random()-0.5)*2.2,spd=(4+Math.random()*8)*sz;
          debris.push({x:p.x+(Math.random()-0.5)*60*sz,y:p.y,vx:Math.cos(ang3)*spd,vy:Math.sin(ang3)*spd-Math.random()*3*sz,rot:Math.random()*6.28,vr:(Math.random()-0.5)*0.4,life:0,max:700+Math.random()*500,r:(3+Math.random()*5)*sz});}
        var ns=Math.round(60*fxi);
        for(var i4=0;i4<ns;i4++){var ang4=-Math.PI/2+(Math.random()-0.5)*2.4,spd4=(3+Math.random()*10)*sz;
          sparks.push({x:p.x,y:p.y,vx:Math.cos(ang4)*spd4,vy:Math.sin(ang4)*spd4-Math.random()*4*sz,life:0,max:500+Math.random()*600,r:(1.4+Math.random()*2.6)*sz,k:Math.random()*0.6});}
      }
      function launchMeteor(big){
        var tx=big?W*0.5:W*(0.16+Math.random()*0.68);var ty=big?H*1.0:H*(0.84+Math.random()*0.26);
        meteors.push({x0:W*0.5+(Math.random()-0.5)*140*sz,y0:H*0.46,tx:tx,ty:ty,prog:0,dur:big?660:560,end:(big?6.8:3.0+Math.random()*1.9)*sz,rot:Math.random()*6.28,big:big,hit:false,trail:[]});
      }
      var raf=0,dead=false;
      function done(){ if(dead){return;} dead=true; try{cancelAnimationFrame(raf);}catch(e){} if(cv&&cv.parentNode){cv.parentNode.removeChild(cv);} }
      var hardKill=setTimeout(done,5400);
      function frame(ts){
        if(dead){return;}
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){t+=dt;
          if(!didImpact&&t>=IMPACT_T){impact();}
          if(didImpact&&t>=nextMeteor&&t<METEOR_END&&!didFinal){launchMeteor(false);nextMeteor=t+(150+Math.random()*120);}
          if(!didFinal&&t>=FINAL_T){didFinal=true;launchMeteor(true);}
          if(t>2700&&meteors.length===0&&sparks.length===0){running=false;}
        }
        bigFlash*=0.88;
        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();ctx.translate(SX,SY);
        var p=IMP();
        if(running&&!didImpact){var pr=Math.min(1,t/IMPACT_T);var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,90*sz*pr);
          g.addColorStop(0,"rgba(255,220,130,"+(0.5*pr)+")");g.addColorStop(1,"rgba(255,120,40,0)");
          ctx.beginPath();ctx.arc(p.x,p.y,90*sz*pr,0,6.28);ctx.fillStyle=g;ctx.fill();}
        ctx.globalCompositeOperation="lighter";
        for(var i=cracks.length-1;i>=0;i--){var c=cracks[i];c.life+=dt;c.grow=Math.min(1,c.grow+dt/120);var pr2=c.life/c.max;if(pr2>=1){cracks.splice(i,1);continue;}
          ctx.beginPath();ctx.moveTo(p.x,p.y);var upto=Math.floor(c.grow*c.seg.length);for(var j=0;j<upto;j++){ctx.lineTo(c.seg[j][0],c.seg[j][1]);}
          ctx.lineWidth=3*sz*(1-pr2*0.6);ctx.strokeStyle="rgba(255,180,70,"+((1-pr2)*0.9)+")";ctx.shadowBlur=12*sz;ctx.shadowColor="#ff8a2a";ctx.stroke();}
        for(var i5=rings.length-1;i5>=0;i5--){var r=rings[i5];r.life+=dt;r.r+=r.vr*dt*0.06;var pr3=r.life/r.max;if(pr3>=1){rings.splice(i5,1);continue;}
          ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.lineWidth=r.w*(1-pr3);ctx.strokeStyle="rgba(255,210,120,"+((1-pr3)*0.85)+")";ctx.shadowBlur=14*sz;ctx.shadowColor="#ffb84d";ctx.stroke();}
        for(var i6=sparks.length-1;i6>=0;i6--){var s=sparks[i6];s.life+=dt;s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;var pr4=s.life/s.max;if(pr4>=1||s.y>H+20){sparks.splice(i6,1);continue;}
          var cc=ember(Math.min(1,s.k+pr4*0.5)),a=(1-pr4)*0.95;ctx.beginPath();ctx.arc(s.x,s.y,s.r*(1-pr4*0.4),0,6.28);ctx.shadowBlur=s.r*3;ctx.shadowColor="rgb("+cc[0]+","+cc[1]+","+cc[2]+")";ctx.fillStyle="rgba("+cc[0]+","+cc[1]+","+cc[2]+","+a+")";ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        for(var i7=debris.length-1;i7>=0;i7--){var d=debris[i7];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vr*dt*0.06;var pr5=d.life/d.max;if(pr5>=1||d.y>H+20){debris.splice(i7,1);continue;}
          ctx.save();ctx.globalAlpha=(1-pr5)*0.9;ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle="#5a4632";rrect(-d.r,-d.r*0.7,d.r*2,d.r*1.4,2);ctx.fill();ctx.fillStyle="#7a6242";rrect(-d.r,-d.r*0.7,d.r*2,d.r*0.5,2);ctx.fill();ctx.restore();}
        if(hammer&&running){
          var hy,hs,hr,ha=1;var above=p.y-H*0.58;
          if(t<SLAM_T){var prh=t/SLAM_T;var e=prh*prh*prh;hy=above+(p.y-above)*e;hr=-0.22+0.22*e;hs=(0.9+0.35*e)*sz;
            if(prh>0.45){for(var gg=1;gg<=3;gg++){var pe=Math.max(0,e-gg*0.10);var gy2=above+(p.y-above)*pe;drawHammer(p.x,gy2,(0.9+0.35*pe)*sz,-0.22+0.22*pe,0.16*(1-gg*0.25));}}
            drawHammer(p.x,hy,hs,hr,1);
          } else if(t<IMPACT_T+220){var k=Math.min(1,(t-SLAM_T)/220);hr=0+Math.sin(k*9)*0.04*(1-k);hs=(1.25-0.05*k)*sz;ha=1-k*0.3;drawHammer(p.x,p.y,hs,hr,ha);}
        }
        for(var i8=flashes.length-1;i8>=0;i8--){var f=flashes[i8];f.life+=dt;f.r+=f.vr*dt*0.06;var pr6=f.life/f.max;if(pr6>=1){flashes.splice(i8,1);continue;}
          var fg=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r);fg.addColorStop(0,"rgba(255,250,235,"+((1-pr6)*0.85)+")");fg.addColorStop(0.5,"rgba(255,190,90,"+((1-pr6)*0.4)+")");fg.addColorStop(1,"rgba(255,120,40,0)");
          ctx.globalCompositeOperation="lighter";ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.28);ctx.fillStyle=fg;ctx.fill();ctx.globalCompositeOperation="source-over";}
        ctx.globalCompositeOperation="lighter";
        for(var i9=meteors.length-1;i9>=0;i9--){var m=meteors[i9];m.prog+=dt/m.dur;
          var em=m.prog*m.prog;var mx=m.x0+(m.tx-m.x0)*em,my=m.y0+(m.ty-m.y0)*em;var sc=0.12+(m.end-0.12)*em;var R=26*sc;
          m.trail.push([mx,my,R]);if(m.trail.length>9){m.trail.shift();}
          if(m.prog>=1){if(!m.hit){m.hit=true;flashes.push({x:mx,y:my,r:0,vr:(m.big?34:18)*sz,life:0,max:m.big?420:280});if(m.big&&!dealt){dealt=true;if(deal){try{deal();}catch(e){}}}}meteors.splice(i9,1);continue;}
          for(var jt=0;jt<m.trail.length;jt++){var tt=m.trail[jt],aat=(jt/m.trail.length)*0.5;ctx.beginPath();ctx.arc(tt[0],tt[1],tt[2]*0.7*(jt/m.trail.length+0.3),0,6.28);ctx.fillStyle="rgba(255,150,50,"+aat+")";ctx.fill();}
          var mg=ctx.createRadialGradient(mx,my,0,mx,my,R*1.6);mg.addColorStop(0,"rgba(255,252,240,0.98)");mg.addColorStop(0.3,"rgba(255,215,130,0.95)");mg.addColorStop(0.62,"rgba(255,140,45,0.85)");mg.addColorStop(1,"rgba(255,80,20,0)");
          ctx.beginPath();ctx.arc(mx,my,R*1.6,0,6.28);ctx.fillStyle=mg;ctx.fill();
          star(mx,my,R*0.9,m.rot+m.prog*4,"rgba(255,250,235,0.95)","#ffba3c",1);}
        ctx.globalCompositeOperation="source-over";
        ctx.restore();
        if(!running&&meteors.length===0&&sparks.length===0&&debris.length===0&&flashes.length===0){clearTimeout(hardKill);if(!dealt&&deal){dealt=true;try{deal();}catch(e){}}done();return;}
        raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
    }catch(e){ try{if(deal){deal();}}catch(_){} }
  }

  /* ─────────── 无光之渊·暗噬君主 → 锁魂囚渊 ─────────── */

  /* ─────────── 暗影先锋·破阵者 → 猎手处决(星海第一星域·实体机甲) ─────────── */
  /* 🔴 v869 重做(Hansen 定稿·实体武器): 全程 canvas 画出的【实体爆能卡宾枪 + 等离子匕首】当主角, 不再是光点光条弹幕。
     四幕: ①举枪锁定(枪从下垂升起入镜·瞄准镜扫描射线锁定勇者) ②爆能扫射(真实枪口喷火连射·弹壳从抛壳口飞出·枪身后坐回弹) ③匕首突袭(抽实体等离子匕首交叉斩两刀) ④处决贯穿炮(枪口聚能成球→贯穿炮轰勇者)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标(不手动×DPR·修正旧隐患)·答题区 clip 到 barBot+18·零震屏。武器 source-over 画在特效之下当实体底, 能量/火花 lighter 叠其上。 */
  function hbaVanguard(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_GOLD='255,194,58', C_ORANGE='255,120,42', C_PLASMA='90,216,255', C_RED='255,60,70';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      /* ===== 实体爆能卡宾枪(枪管朝 +x·握把在原点) ===== */
      function drawCarbine(cx,cy,s,rot,a){
        ctx.save(); ctx.globalAlpha=a; ctx.translate(cx,cy); ctx.rotate(rot); ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";
        ctx.beginPath();ctx.moveTo(-40,-9);ctx.lineTo(-60,-13);ctx.lineTo(-86,-3);ctx.lineTo(-86,9);ctx.lineTo(-60,11);ctx.lineTo(-40,7);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#4a505c";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#171a20";ctx.beginPath();ctx.moveTo(-56,-6);ctx.lineTo(-76,0);ctx.lineTo(-56,6);ctx.closePath();ctx.fill();
        ctx.fillStyle="#3a3f4a";rr(-74,-13,32,4,2);ctx.fill();
        var bgd=ctx.createLinearGradient(0,-6,0,3);bgd.addColorStop(0,"#2e323a");bgd.addColorStop(.35,"#6b7380");bgd.addColorStop(.6,"#494f5a");bgd.addColorStop(1,"#22252b");
        ctx.fillStyle=bgd;rr(30,-6,58,9,3);ctx.fill();
        ctx.fillStyle="#34383f";rr(80,-8,17,13,3);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#14161b";ctx.fillRect(84,-6,2.4,9);ctx.fillRect(88.5,-6,2.4,9);ctx.fillRect(93,-6,2.4,9);
        ctx.fillStyle="#33373f";rr(16,-10,42,11,3);ctx.fill();
        ctx.fillStyle="#20232a";for(var r=0;r<6;r++){ctx.fillRect(20+r*6.5,-10,3,3);}
        var rgd=ctx.createLinearGradient(0,-12,0,7);rgd.addColorStop(0,"#2c303a");rgd.addColorStop(.28,"#565d6b");rgd.addColorStop(.5,"#41464f");rgd.addColorStop(1,"#24272e");
        ctx.fillStyle=rgd;rr(-44,-12,64,19,4);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#15171c";rr(-6,-6,14,5,1.5);ctx.fill();
        ctx.save();ctx.shadowBlur=11;ctx.shadowColor="#ff9a4a";
        ctx.fillStyle="#ff7a2a";rr(-34,-2,26,4.5,2);ctx.fill();
        ctx.fillStyle="#ffd7a0";rr(-34,-2,26,1.6,1);ctx.fill();ctx.restore();
        ctx.fillStyle="#2b2f38";ctx.fillRect(-14,-15,4,4);ctx.fillRect(9,-15,4,4);
        var sgd=ctx.createLinearGradient(0,-28,0,-15);sgd.addColorStop(0,"#2a2e36");sgd.addColorStop(.4,"#525967");sgd.addColorStop(1,"#282b32");
        ctx.fillStyle=sgd;rr(-18,-28,33,13,6);ctx.fill();ctx.strokeStyle="#4a505c";ctx.lineWidth=1.2;ctx.stroke();
        ctx.fillStyle="#20232a";rr(-18,-27,4,11,2);ctx.fill();
        ctx.save();ctx.shadowBlur=9;ctx.shadowColor="#5ad8ff";
        var lg=ctx.createRadialGradient(12,-21.5,0,12,-21.5,6);lg.addColorStop(0,"#d6f6ff");lg.addColorStop(.5,"#5ad8ff");lg.addColorStop(1,"#155a78");
        ctx.fillStyle=lg;ctx.beginPath();ctx.arc(12,-21.5,5,0,6.28);ctx.fill();ctx.restore();
        ctx.fillStyle="#2f333c";ctx.beginPath();ctx.moveTo(-28,6);ctx.lineTo(-18,6);ctx.lineTo(-13,31);ctx.lineTo(-25,33);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#454b57";ctx.lineWidth=1.3;ctx.stroke();
        ctx.strokeStyle="#20232a";ctx.lineWidth=1;
        for(var gk=0;gk<3;gk++){ctx.beginPath();ctx.moveTo(-26+gk*0.5,12+gk*6);ctx.lineTo(-16+gk*0.5,12+gk*6);ctx.stroke();}
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-13,7);ctx.arc(-8,13,6,-0.35,3.4);ctx.stroke();
        ctx.strokeStyle="#565d6b";ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-9,8);ctx.lineTo(-9,13);ctx.stroke();
        ctx.fillStyle="#34383f";ctx.beginPath();ctx.moveTo(-4,6);ctx.lineTo(9,6);ctx.quadraticCurveTo(15,25,10,43);ctx.lineTo(-2,45);ctx.quadraticCurveTo(-3,25,-4,6);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#4a505c";ctx.lineWidth=1.3;ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor="#ff9a4a";
        ctx.fillStyle="#ff7a2a";ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(6,13);ctx.quadraticCurveTo(10,27,7,39);ctx.lineTo(1,40);ctx.quadraticCurveTo(0,27,0,13);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle="#ffe0b0";ctx.fillRect(1,17,5,1.4);ctx.fillRect(1.5,23,4.5,1.4);ctx.fillRect(2,30,4,1.4);ctx.restore();
        ctx.restore();
      }
      /* ===== 实体等离子匕首(刀刃朝 +x·握把在原点) ===== */
      function drawDagger(cx,cy,s,rot,a){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";rr(-20,-3.5,17,7,2.5);ctx.fill();ctx.strokeStyle="#454b57";ctx.lineWidth=1;ctx.stroke();
        ctx.strokeStyle="#1a1d22";ctx.lineWidth=1;
        for(var w=0;w<3;w++){ctx.beginPath();ctx.moveTo(-17+w*4,-3.5);ctx.lineTo(-15+w*4,3.5);ctx.stroke();}
        ctx.fillStyle="#3a3f4a";ctx.beginPath();ctx.arc(-21,0,3,0,6.28);ctx.fill();
        ctx.fillStyle="#4a505c";rr(-4,-7,5,14,1.5);ctx.fill();
        var dbg=ctx.createLinearGradient(0,-6,0,6);dbg.addColorStop(0,"#8a93a3");dbg.addColorStop(.5,"#cfd6e0");dbg.addColorStop(1,"#6a7280");
        ctx.fillStyle=dbg;ctx.beginPath();ctx.moveTo(1,-5);ctx.lineTo(30,-3);ctx.lineTo(43,0);ctx.lineTo(30,3);ctx.lineTo(1,5);ctx.closePath();ctx.fill();
        ctx.save();ctx.shadowBlur=10;ctx.shadowColor="#5ad8ff";ctx.strokeStyle="#a8ecff";ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(1,-5);ctx.lineTo(30,-3);ctx.lineTo(43,0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(1,5);ctx.lineTo(30,3);ctx.lineTo(43,0);ctx.stroke();ctx.restore();
        ctx.strokeStyle="rgba(90,216,255,.5)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(39,0);ctx.stroke();
        ctx.restore();
      }

      /* 枪姿态: 握把支点在 boss 左上·枪管指向勇者血条 */
      var GS=1.05*sz;
      var gpivX=bx-br.width*0.20, gpivY=by-br.height*0.04;
      var aimAng=Math.atan2(tgtY-gpivY, tgtX-gpivX);
      /* 本地点(lx,ly)经 旋转ang+缩放s 映射到世界坐标 */
      function ptAt(px,py,ang,s,lx,ly){ return {x:px+s*(lx*Math.cos(ang)-ly*Math.sin(ang)), y:py+s*(lx*Math.sin(ang)+ly*Math.cos(ang))}; }

      var bolts=[], sparks=[], rings=[], shards=[], beams=[], shells=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var T_RAISE_DUR=440, T_LOCK_DONE=680, T_BARRAGE=760, T_BARRAGE_END=1680, T_DASH=1740, T_SLASH=1900, T_SLASH2=2030, T_EXEC_CHARGE=2320, T_EXEC_FIRE=2880, T_END=3540;
      var nextBolt=0, execCharge=0, didExecFire=false, gunRecoil=0, _raiseP=0;
      var dashDone=false, slashDone=false, slash2Done=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}

      /* 枪当前瞄准角(举枪→瞄准→匕首幕下摆→处决幕回位) */
      function curAng(){
        var base=aimAng;
        if(t<T_LOCK_DONE){ base=aimAng+0.5*(1-_raiseP); }
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ var dp=Math.min(1,(t-T_DASH)/240); base=aimAng+0.72*dp; }
        else if(t>=T_EXEC_CHARGE){ var ep=Math.min(1,(t-T_EXEC_CHARGE)/300); base=aimAng+0.72*(1-ep); }
        return base;
      }
      function gunX(){ var k=gunRecoil*8*sz; return gpivX - Math.cos(curAng())*k; }
      function gunY(){ var k=gunRecoil*8*sz; return gpivY - Math.sin(curAng())*k; }
      function gunAlpha(){
        if(t<60) return Math.min(1,t/60*_raiseP*1.4);
        if(t<T_LOCK_DONE) return Math.min(1,_raiseP*1.5);
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ return Math.max(0.18,1-(t-T_DASH)/240*0.82); }
        return 1;
      }
      /* 从真实枪口发射爆能弹 + 枪口闪 + 抛壳 + 后坐 */
      function fireBolt(){
        var ang=curAng(), mz=ptAt(gunX(),gunY(),ang,GS,97,-1);
        var spd=RND(15,19)*sp;
        bolts.push({x:mz.x,y:mz.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,col:C_ORANGE,w:3*sz,life:0,trail:[],hit:false});
        rings.push({x:mz.x,y:mz.y,r:2,vr:1.3,w:2*sz,col:C_ORANGE,life:0,max:110,muzzle:true});
        var ej=ptAt(gunX(),gunY(),ang,GS,2,-7);
        shells.push({x:ej.x,y:ej.y,vx:Math.cos(ang-1.7)*RND(1.5,3),vy:Math.sin(ang-1.7)*RND(1.5,3)-RND(1,2),rot:Math.random()*6.28,vrot:RND(-0.4,0.4),life:0,max:600});
        gunRecoil=1;
      }
      /* 幕①锁定 HUD(扫描线从枪口·锁定框+旋转刻度环+LOCKED) */
      function drawLockHUD(pr){
        var mz=ptAt(gunX(),gunY(),curAng(),GS,97,-1);
        if(pr<0.6){
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(0.6-pr)*1.3;
          ctx.strokeStyle=g(C_GOLD+',1');ctx.lineWidth=1.4;ctx.setLineDash([9,7]);ctx.lineDashOffset=-t*0.05;
          ctx.beginPath();ctx.moveTo(mz.x,mz.y);ctx.lineTo(tgtX,tgtY);ctx.stroke();ctx.setLineDash([]);ctx.restore();
        }
        var box=(1-Math.min(1,pr*1.35))*54+46, cn=17*sz;
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=g(C_GOLD+','+Math.min(1,pr*2));ctx.lineWidth=2.6*sz;ctx.lineCap='square';ctx.shadowBlur=10;ctx.shadowColor=g(C_GOLD+',1');
        var corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
        for(var ci=0;ci<4;ci++){var cc=corners[ci];var cx2=tgtX+cc[0]*box,cy2=tgtY+cc[1]*box*0.6;
          ctx.beginPath();ctx.moveTo(cx2,cy2+cc[1]*cn);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2-cc[0]*cn,cy2);ctx.stroke();}
        ctx.translate(tgtX,tgtY);ctx.rotate(t*0.002);
        var R=box*0.92;
        ctx.strokeStyle=g(C_GOLD+',0.6');ctx.lineWidth=1.6*sz;
        for(var k=0;k<3;k++){ctx.beginPath();var a0=k*2.09+0.3;ctx.arc(0,0,R,a0,a0+1.15);ctx.stroke();}
        ctx.strokeStyle=g(C_GOLD+',0.4');ctx.lineWidth=1;
        for(var m=0;m<24;m++){var a=m/24*6.28,r1=R+3*sz,r2=R+(m%6===0?10:5)*sz;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);ctx.stroke();}
        ctx.restore();
        if(pr>0.72){
          var fa=(pr-0.72)*3.5;
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(tgtX,tgtY);
          ctx.strokeStyle=g(C_GOLD+','+fa);ctx.lineWidth=1.6*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.moveTo(-11*sz,0);ctx.lineTo(11*sz,0);ctx.moveTo(0,-9*sz);ctx.lineTo(0,9*sz);ctx.stroke();
          ctx.fillStyle=g(C_GOLD+','+fa);ctx.font='bold '+(9*sz)+'px monospace';ctx.textAlign='center';
          ctx.fillText('\u25c6 TARGET LOCKED \u25c6',0,-box*0.6-11*sz);ctx.restore();
        }
      }
      /* 幕③匕首交叉斩: 生成等离子斩光 */
      function doSlash(rotAng){ beams.push({slash:true,x:tgtX,y:tgtY,rot:rotAng,life:0,max:210,col:C_PLASMA}); spawnSpark(tgtX,tgtY,'255,255,255',8,6); }
      /* 幕③实体匕首两次穿越勇者(冷兵器斩) */
      function drawDaggerDash(){
        var w1s=T_SLASH-120,w1d=280,w2s=T_SLASH2-120,w2d=280;
        function streak(tt,A){ var L=125*sz,dx=Math.cos(A)*L,dy=Math.sin(A)*L;
          var x=tgtX-dx+2*dx*tt,y=tgtY-dy+2*dy*tt;
          var a=1;if(tt<0.14)a=tt/0.14;else if(tt>0.82)a=(1-tt)/0.18;
          drawDagger(x,y,1.55*sz,A,a); }
        if(t>=w1s&&t<w1s+w1d){streak((t-w1s)/w1d,-0.6);}
        else if(t>=w2s&&t<w2s+w2d){streak((t-w2s)/w2d,0.5);}
      }
      /* 幕④处决贯穿炮: 从真实枪口轰出 */
      function launchExecBeam(){
        didExecFire=true;
        var ang=curAng(), mz=ptAt(gunX(),gunY(),ang,GS,97,-1);
        var len=Math.hypot(tgtX-mz.x,tgtY-mz.y)+40;
        beams.push({sx:mz.x,sy:mz.y,ang:ang,len:len,life:0,max:420});
        setTimeout(function(){
          if(dead)return; fireDeal();
          spawnRing(tgtX,tgtY,C_GOLD,0.9,5*sz); spawnRing(tgtX,tgtY,C_ORANGE,0.6,3*sz);
          spawnShards(tgtX,tgtY,C_ORANGE,16); spawnSpark(tgtX,tgtY,'255,255,255',20,9);
          sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:180,sz:40*sz,flash:true});
        },140/sp);
      }
      /* 幕④枪口聚能球(吸入粒子) */
      function drawExecCharge(pr){
        var mz=ptAt(gunX(),gunY(),curAng(),GS,97,-1);
        var R=pr*20*sz;
        var gr=ctx.createRadialGradient(mz.x,mz.y,0,mz.x,mz.y,R);
        gr.addColorStop(0,g('255,255,255,'+pr));gr.addColorStop(.4,g(C_ORANGE+','+pr));gr.addColorStop(1,g(C_ORANGE+',0'));
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(mz.x,mz.y,R,0,6.28);ctx.fill();
        if(Math.random()>0.35){var a=Math.random()*6.28,d=48*sz;sparks.push({x:mz.x+Math.cos(a)*d,y:mz.y+Math.sin(a)*d,vx:0,vy:0,col:C_ORANGE,life:0,max:200,sz:2*sz,suck:{x:mz.x,y:mz.y}});}
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5600);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          _raiseP=Math.min(1,t/T_RAISE_DUR);
          if(t>=T_BARRAGE&&t<T_BARRAGE_END&&t>=nextBolt){ fireBolt(); nextBolt=t+RND(60,86)/sp; }
          if(!dashDone&&t>=T_DASH){dashDone=true;
            if(bsEl){try{bsEl.animate([{transform:'translateX(0) scale(1)'},{transform:'translateX(14px) scale(1.05)',offset:.4},{transform:'translateX(0) scale(1)'}],{duration:420/sp});}catch(e){}}
          }
          if(!slashDone&&t>=T_SLASH){slashDone=true; doSlash(-0.6); fireDeal();}
          if(!slash2Done&&t>=T_SLASH2){slash2Done=true; doSlash(0.5);}
          if(t>=T_EXEC_CHARGE&&t<T_EXEC_FIRE){execCharge=Math.min(1,(t-T_EXEC_CHARGE)/(T_EXEC_FIRE-T_EXEC_CHARGE));}
          if(!didExecFire&&t>=T_EXEC_FIRE){launchExecBeam();}
          if(t>T_END&&bolts.length===0&&beams.length===0&&sparks.length<3){running=false;}
        }
        gunRecoil=Math.max(0,gunRecoil-dt/90);
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体武器(source-over 底) ===== */
        ctx.globalCompositeOperation='source-over';
        if(gunAlpha()>0.01){ drawCarbine(gunX(),gunY(),GS,curAng(),gunAlpha()); }
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ drawDaggerDash(); }
        for(var shi=shells.length-1;shi>=0;shi--){var sh=shells[shi];sh.life+=dt;sh.vy+=0.4;sh.x+=sh.vx;sh.y+=sh.vy;sh.rot+=sh.vrot;var shpr=sh.life/sh.max;if(shpr>=1||sh.y>clipBottom){shells.splice(shi,1);continue;}
          ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.rot);ctx.fillStyle=g('224,176,80,'+(1-shpr));ctx.fillRect(-1.5*sz,-3*sz,3*sz,6*sz);ctx.restore();}

        /* ===== 幕①锁定 HUD ===== */
        if(t<T_LOCK_DONE+200){ drawLockHUD(Math.min(1,t/T_LOCK_DONE)); }

        /* ===== 能量/火花层(lighter 叠加) ===== */
        ctx.globalCompositeOperation='lighter';
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          if(bm.slash){
            var env=Math.sin(bpr*Math.PI);
            ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(bm.rot);
            var slen=115*sz*env;
            var gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.5,g(bm.col+',0.5'));gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=20*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
            gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.45,'rgba(255,255,255,1)');gg.addColorStop(.55,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=(6-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
            ctx.restore();
          } else {
            var env2=bpr<0.25?bpr/0.25:(1-(bpr-0.25)/0.75);
            ctx.save();ctx.translate(bm.sx,bm.sy);ctx.rotate(bm.ang);ctx.shadowBlur=20;ctx.shadowColor=g(C_ORANGE+',1');
            var gg2=ctx.createLinearGradient(0,-30*sz,0,30*sz);gg2.addColorStop(0,g(C_ORANGE+',0'));gg2.addColorStop(.5,g(C_ORANGE+','+(0.5*env2)));gg2.addColorStop(1,g(C_ORANGE+',0'));
            ctx.fillStyle=gg2;ctx.fillRect(0,-30*sz*env2,bm.len,60*sz*env2);
            gg2=ctx.createLinearGradient(0,-11*sz,0,11*sz);gg2.addColorStop(0,g(C_ORANGE+',0'));gg2.addColorStop(.5,g('255,220,150,'+env2));gg2.addColorStop(1,g(C_ORANGE+',0'));
            ctx.fillStyle=gg2;ctx.fillRect(0,-11*sz*env2,bm.len,22*sz*env2);
            ctx.shadowBlur=0;ctx.fillStyle=g('255,255,255,'+env2);ctx.fillRect(0,-4*sz*env2,bm.len,8*sz*env2);
            ctx.restore();
          }
        }
        for(var i=bolts.length-1;i>=0;i--){var b=bolts[i];b.life+=dt;b.x+=b.vx*dt*0.06;b.y+=b.vy*dt*0.06;
          b.trail.push({x:b.x,y:b.y});if(b.trail.length>8)b.trail.shift();
          if(!b.hit&&Math.hypot(b.x-tgtX,b.y-tgtY)<24*sz){b.hit=true;
            spawnSpark(b.x,b.y,C_ORANGE,6,7);spawnRing(tgtX,tgtY,C_ORANGE,0.8,2*sz);
            if(t>T_BARRAGE+200)fireDeal(); bolts.splice(i,1);continue;}
          if(b.x<-40||b.x>vw+40||b.y>clipBottom+40){bolts.splice(i,1);continue;}
          for(var ti=0;ti<b.trail.length;ti++){var kk=ti/b.trail.length;ctx.fillStyle=g(b.col+','+(kk*0.5));ctx.beginPath();ctx.arc(b.trail[ti].x,b.trail[ti].y,b.w*kk,0,6.28);ctx.fill();}
          ctx.shadowBlur=10;ctx.shadowColor=g(b.col+',1');
          var bg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.w*1.6);bg.addColorStop(0,'rgba(255,255,255,1)');bg.addColorStop(.5,g(b.col+',1'));bg.addColorStop(1,g(b.col+',0'));
          ctx.fillStyle=bg;ctx.beginPath();ctx.arc(b.x,b.y,b.w*1.6,0,6.28);ctx.fill();ctx.shadowBlur=0;
        }
        if(t>=T_EXEC_CHARGE&&t<T_EXEC_FIRE){ drawExecCharge(execCharge); }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');
          ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(s.suck){var dx=s.suck.x-s.x,dy=s.suck.y-s.y;s.x+=dx*0.14;s.y+=dy*0.14;if(Math.hypot(dx,dy)<6){sparks.splice(si,1);continue;}}
          else if(s.flash){}
          else{s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg.addColorStop(0,g('255,255,255,'+(1-spr)));fg.addColorStop(.5,g(C_ORANGE+','+((1-spr)*0.7)));fg.addColorStop(1,g(C_ORANGE+',0'));ctx.fillStyle=fg;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2900)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }


  /* ─────────── 武器大师·战争铁砧 → 全武库压制(星海第一星域·实体军火库) ─────────── */
  /* 🔴 v869 重做(Hansen 定稿·实体武器): 全程 canvas 画出的【实体重机枪(粗管+弹链弹箱+散热护罩+炽热枪管) + 实体军刀 + 实体导弹】当主角。
     四幕: ①重机枪弹幕(真实枪口高频喷火·曳光弹雨·弹壳飞溅·枪管过热渐红) ②导弹环射汇聚(散开→盘旋→汇聚俯冲→连环爆·Hansen 招牌) ③军刀重斩(实体军刀大幅横扫+火焰扇形残影) ④全武库过载(机枪连发+导弹倾泻+胸甲过载红光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标(不手动×DPR)·答题区 clip 到 barBot+18·零震屏。武器/导弹 source-over 画实体, 火焰/曳光/爆炸 lighter 叠其上。 */
  function hbaWarAnvil(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_FIRE='255,122,26', C_ORANGE='255,150,40', C_PLASMA='90,216,255', C_RED='255,60,50', C_SMOKE='200,208,216';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      /* ===== 实体重机枪(枪管朝 +x·握把在原点·heat=过热0..1) ===== */
      function drawHMG(cx,cy,s,rot,a,heat){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        var abg=ctx.createLinearGradient(0,8,0,40);abg.addColorStop(0,"#454e34");abg.addColorStop(1,"#2c331f");
        ctx.fillStyle=abg;rr(-52,8,32,32,3);ctx.fill();ctx.strokeStyle="#5f6a45";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#5f6a45";rr(-49,11,26,4,1);ctx.fill();
        for(var bi=0;bi<6;bi++){var bxp=-46+bi*7.2,byp=9-bi*1.6;ctx.save();ctx.translate(bxp,byp);ctx.rotate(-0.42);
          ctx.fillStyle="#b8912f";rr(-2.3,-5,4.6,10,1.4);ctx.fill();ctx.fillStyle="#e6c065";rr(-2.3,-5,4.6,3,1.4);ctx.fill();
          ctx.fillStyle="#8a6a20";ctx.fillRect(-2.3,3,4.6,1.5);ctx.restore();}
        var rgd=ctx.createLinearGradient(0,-17,0,11);rgd.addColorStop(0,"#2c303a");rgd.addColorStop(.3,"#565d6b");rgd.addColorStop(.55,"#3e444e");rgd.addColorStop(1,"#22252b");
        ctx.fillStyle=rgd;rr(-42,-17,64,29,5);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1.8;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=4.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-22,-17);ctx.lineTo(-14,-28);ctx.lineTo(2,-28);ctx.lineTo(10,-17);ctx.stroke();ctx.lineCap="butt";
        ctx.fillStyle="#191c22";for(var v=0;v<4;v++){rr(-34+v*7.5,-11,4,11,1);ctx.fill();}
        var sgd=ctx.createLinearGradient(0,-10,0,9);sgd.addColorStop(0,"#33373f");sgd.addColorStop(.4,"#4a505c");sgd.addColorStop(1,"#26292f");
        ctx.fillStyle=sgd;rr(24,-10,46,20,4);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#141619";for(var h=0;h<5;h++){ctx.beginPath();ctx.arc(32+h*8.5,-3.5,2.7,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(32+h*8.5,4,2.7,0,6.28);ctx.fill();}
        var ht=heat||0;
        ctx.save();ctx.shadowBlur=10+ht*10;ctx.shadowColor="#ff7a1a";
        ctx.fillStyle="#5a2a18";rr(70,-5.5,20,11,2);ctx.fill();
        ctx.fillStyle=g((255)+','+Math.round(122-ht*40)+','+Math.round(26+ht*10)+',1');rr(70,-2.5,17,5,2);ctx.fill();
        ctx.fillStyle="#ffd08a";rr(70,-1.5,10,2,1);ctx.fill();ctx.restore();
        ctx.fillStyle="#2a2d33";rr(87,-7,9,14,2);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=0.8;ctx.stroke();
        ctx.fillStyle="#2f333c";ctx.beginPath();ctx.moveTo(-16,12);ctx.lineTo(-6,12);ctx.lineTo(-2,35);ctx.lineTo(-14,37);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#454b57";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-1,13);ctx.arc(4,19,6,-0.4,3.4);ctx.stroke();
        ctx.fillStyle="#2b2f38";rr(-44,-9,9,15,3);ctx.fill();
        ctx.restore();
      }
      /* ===== 实体军刀(重刃·刀刃朝 +x·火焰等离子刃) ===== */
      function drawSaber(cx,cy,s,rot,a){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";rr(-26,-4,20,8,2.5);ctx.fill();ctx.strokeStyle="#454b57";ctx.lineWidth=1;ctx.stroke();
        ctx.strokeStyle="#1a1d22";ctx.lineWidth=1;for(var w=0;w<4;w++){ctx.beginPath();ctx.moveTo(-23+w*4.5,-4);ctx.lineTo(-21+w*4.5,4);ctx.stroke();}
        ctx.fillStyle="#3a3f4a";ctx.beginPath();ctx.arc(-27,0,3.4,0,6.28);ctx.fill();
        ctx.fillStyle="#4a505c";rr(-7,-9,6,18,2);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1;ctx.stroke();
        var bg2=ctx.createLinearGradient(0,-9,0,7);bg2.addColorStop(0,"#9aa3b3");bg2.addColorStop(.5,"#dfe6f0");bg2.addColorStop(1,"#727a88");
        ctx.fillStyle=bg2;
        ctx.beginPath();ctx.moveTo(-1,-8);ctx.lineTo(46,-6);ctx.quadraticCurveTo(60,-2,64,2);ctx.quadraticCurveTo(52,7,30,8);ctx.lineTo(-1,7);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(120,130,150,.6)";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(2,-1);ctx.lineTo(50,-0.5);ctx.stroke();
        ctx.save();ctx.shadowBlur=11;ctx.shadowColor="#ff7a1a";ctx.strokeStyle="#ffb060";ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(-1,-8);ctx.lineTo(46,-6);ctx.quadraticCurveTo(60,-2,64,2);ctx.stroke();
        ctx.strokeStyle="#ff8a2a";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(30,8);ctx.lineTo(-1,7);ctx.stroke();ctx.restore();
        ctx.restore();
      }

      /* 枪姿态: 握把支点在 boss 左·枪管指向勇者 */
      var GS=1.1*sz;
      var gpivX=bx-br.width*0.20, gpivY=by-br.height*0.02;
      var aimAng=Math.atan2(tgtY-gpivY, tgtX-gpivX);
      function ptAt(px,py,ang,s,lx,ly){ return {x:px+s*(lx*Math.cos(ang)-ly*Math.sin(ang)), y:py+s*(lx*Math.sin(ang)+ly*Math.cos(ang))}; }

      var bolts=[], sparks=[], rings=[], shards=[], missiles=[], beams=[], shells=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var T_GUN=0, T_GUN_END=1080, T_MISSILE=1150, T_SLASH=2120, T_SLASH_HIT=2320, T_OVERLOAD=2620, T_END=4200;
      var nextBolt=0, missileFired=false, didSaber=false, saberHit=false, overloadFired=false, gunRecoil=0, heat=0;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}
      function explode(x,y,col,rad,shardN){
        rings.push({x:x,y:y,r:2,vr:1.0,w:4*sz,col:col,life:0,max:340});
        sparks.push({x:x,y:y,vx:0,vy:0,col:'255,255,255',life:0,max:180,sz:rad*sz,flash:true,fcol:col});
        spawnShards(x,y,col,shardN||8); spawnSpark(x,y,'255,255,255',6,8);
      }
      function curAng(){
        var base=aimAng;
        if(t<T_SLASH){ if(t<300){ base=aimAng+0.4*(1-t/300); } }
        else if(t<T_OVERLOAD){ var dp=Math.min(1,(t-T_SLASH)/220); base=aimAng+0.7*dp; }
        else { var ep=Math.min(1,(t-T_OVERLOAD)/260); base=aimAng+0.7*(1-ep); }
        return base;
      }
      function gunX(){ var k=gunRecoil*7*sz; return gpivX - Math.cos(curAng())*k; }
      function gunY(){ var k=gunRecoil*7*sz; return gpivY - Math.sin(curAng())*k; }
      function gunAlpha(){
        if(t<40) return t/40;
        if(t>=T_SLASH&&t<T_OVERLOAD){ return Math.max(0.16,1-(t-T_SLASH)/220*0.84); }
        return 1;
      }
      /* 重机枪曳光弹(从真实枪口·大枪口火舌+弹壳+后坐+过热累积) */
      function fireBolt(){
        var ang=curAng()+RND(-0.05,0.05), mz=ptAt(gunX(),gunY(),curAng(),GS,95,0);
        var spd=RND(16,20)*sp;
        bolts.push({x:mz.x,y:mz.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,w:2.6*sz,life:0,trail:[],hit:false});
        rings.push({x:mz.x,y:mz.y,r:2,vr:1.6,w:2.4*sz,col:C_FIRE,life:0,max:110,muzzle:true});
        var ej=ptAt(gunX(),gunY(),curAng(),GS,16,-9);
        shells.push({x:ej.x,y:ej.y,vx:Math.cos(curAng()-1.6)*RND(1.5,3),vy:Math.sin(curAng()-1.6)*RND(1.5,3)-RND(1,2),rot:Math.random()*6.28,vrot:RND(-0.5,0.5),life:0,max:600});
        gunRecoil=1; heat=Math.min(1,heat+0.10);
      }
      /* 导弹三阶段: 散开→盘旋→汇聚俯冲(Hansen 招牌·CSS 像素坐标) */
      function launchMissile(k,N,fromOverload){
        var spreadAng=(k/N)*6.28+RND(-0.3,0.3);
        var orbitR=RND(64,96)*sz;
        missiles.push({ x:bx, y:by-6, orbitR:orbitR, orbitAngle:spreadAng, phase:0, pt:0, ang:spreadAng, trail:[], hit:false,
          T_SPREAD:Math.round(20/sp), T_ORBIT:fromOverload?4:Math.round(14/sp) });
      }
      /* 军刀实体大横扫(经勇者·配火焰扇形残影) */
      function drawSaberSweep(){
        var ws=T_SLASH, wd=400; if(t<ws||t>=ws+wd)return;
        var pr=(t-ws)/wd, sweep=-0.95+pr*1.75;
        var a=1; if(pr<0.12)a=pr/0.12; else if(pr>0.84)a=(1-pr)/0.16;
        var pivX=tgtX-46*sz, pivY=tgtY-76*sz;
        drawSaber(pivX,pivY,1.75*sz,sweep,a);
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          if(t>=T_GUN&&t<T_GUN_END&&t>=nextBolt){ fireBolt(); nextBolt=t+RND(50,70)/sp; }
          if(!missileFired&&t>=T_MISSILE){ missileFired=true;
            explode(bx,by-6,C_FIRE,26,0);
            for(var mk=0;mk<8;mk++){(function(mk){setTimeout(function(){if(!dead)launchMissile(mk,8,false);},mk*45/sp);})(mk);}
          }
          if(!didSaber&&t>=T_SLASH){didSaber=true;
            if(bsEl){try{bsEl.animate([{transform:'translateX(0) scale(1)'},{transform:'translateX(16px) scale(1.05)',offset:.4},{transform:'translateX(0) scale(1)'}],{duration:440/sp});}catch(e){}}
          }
          if(!saberHit&&t>=T_SLASH_HIT){saberHit=true; fireDeal();
            beams.push({slash:true,x:tgtX,y:tgtY,rot:-0.3,life:0,max:260,col:C_FIRE,sweep:true});
            spawnSpark(tgtX,tgtY,'255,255,255',10,7);
          }
          if(!overloadFired&&t>=T_OVERLOAD){overloadFired=true;
            explode(bx,by,C_RED,52,0);
            if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 26px rgba('+C_RED+',1)) brightness(1.3)',offset:.3},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
            var on=0; var ofire=function(){if(dead||on++>=18)return; fireBolt(); setTimeout(ofire,40/sp);}; setTimeout(ofire,300/sp);
            for(var ok=0;ok<5;ok++){(function(ok){setTimeout(function(){if(!dead)launchMissile(ok,5,true);},400+ok*70/sp);})(ok);}
          }
          if(t>T_END&&bolts.length===0&&missiles.length===0&&beams.length===0&&sparks.length<3){running=false;}
        }
        gunRecoil=Math.max(0,gunRecoil-dt/80);
        heat=Math.max(0,heat-dt/1400);
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0&&missiles.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体武器 + 导弹 + 弹壳(source-over 底) ===== */
        ctx.globalCompositeOperation='source-over';
        if(gunAlpha()>0.01){ drawHMG(gunX(),gunY(),GS,curAng(),gunAlpha(),heat); }
        drawSaberSweep();
        for(var mi=missiles.length-1;mi>=0;mi--){var m=missiles[mi];m.pt++;
          if(m.phase===0){var ox=bx+Math.cos(m.orbitAngle)*m.orbitR,oy=by+Math.sin(m.orbitAngle)*m.orbitR-20;var dx=ox-m.x,dy=oy-m.y,d=Math.hypot(dx,dy);m.x+=dx*0.14*sp;m.y+=dy*0.14*sp;m.ang=Math.atan2(dy,dx);if(d<14||m.pt>m.T_SPREAD){m.phase=1;m.pt=0;m.orbitAngle=Math.atan2(m.y-by,m.x-bx);}}
          else if(m.phase===1){m.orbitAngle+=0.14*sp;var rr2=m.orbitR*0.92;var nx=bx+Math.cos(m.orbitAngle)*rr2,ny=by+Math.sin(m.orbitAngle)*rr2-20;m.ang=Math.atan2(ny-m.y,nx-m.x);m.x=nx;m.y=ny;if(m.pt>m.T_ORBIT){m.phase=2;m.pt=0;}}
          else{var dx2=tgtX-m.x,dy2=tgtY-m.y,d2=Math.hypot(dx2,dy2),spd2=13*sz*sp;m.x+=dx2/d2*spd2;m.y+=dy2/d2*spd2;m.ang=Math.atan2(dy2,dx2);if(d2<16&&!m.hit){m.hit=true;fireDeal();explode(tgtX+RND(-6,6),tgtY+RND(-6,6),C_FIRE,30,9);missiles.splice(mi,1);continue;}}
          m.trail.push({x:m.x,y:m.y});if(m.trail.length>12)m.trail.shift();
          for(var ti=0;ti<m.trail.length;ti++){var kk=ti/m.trail.length;ctx.fillStyle=g(C_SMOKE+','+(kk*0.28));ctx.beginPath();ctx.arc(m.trail[ti].x,m.trail[ti].y,(2.5+kk*2.5)*sz,0,6.28);ctx.fill();}
          ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.ang);
          ctx.fillStyle="#c9ced6";rr(-9*sz,-3*sz,16*sz,6*sz,2*sz);ctx.fill();
          ctx.fillStyle=g(C_RED+',1');ctx.beginPath();ctx.moveTo(7*sz,0);ctx.lineTo(-1*sz,-3*sz);ctx.lineTo(-1*sz,3*sz);ctx.closePath();ctx.fill();
          ctx.fillStyle="#8a9098";ctx.beginPath();ctx.moveTo(-9*sz,-3*sz);ctx.lineTo(-13*sz,-6*sz);ctx.lineTo(-9*sz,-1*sz);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(-9*sz,3*sz);ctx.lineTo(-13*sz,6*sz);ctx.lineTo(-9*sz,1*sz);ctx.closePath();ctx.fill();
          ctx.save();ctx.globalCompositeOperation='lighter';var fl=ctx.createLinearGradient(-9*sz,0,-22*sz,0);fl.addColorStop(0,g(C_FIRE+',0.9'));fl.addColorStop(1,g(C_FIRE+',0'));
          ctx.fillStyle=fl;ctx.beginPath();ctx.moveTo(-9*sz,-2.5*sz);ctx.lineTo(-20*sz*(0.7+Math.random()*0.3),0);ctx.lineTo(-9*sz,2.5*sz);ctx.closePath();ctx.fill();ctx.restore();
          ctx.restore();
        }
        for(var shi=shells.length-1;shi>=0;shi--){var sh=shells[shi];sh.life+=dt;sh.vy+=0.4;sh.x+=sh.vx;sh.y+=sh.vy;sh.rot+=sh.vrot;var shpr=sh.life/sh.max;if(shpr>=1||sh.y>clipBottom){shells.splice(shi,1);continue;}
          ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.rot);ctx.fillStyle=g('224,176,80,'+(1-shpr));ctx.fillRect(-1.6*sz,-3.2*sz,3.2*sz,6.4*sz);ctx.restore();}

        /* ===== 火焰/曳光/爆炸层(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        if((t>=T_GUN&&t<T_GUN_END)||(overloadFired&&t<T_OVERLOAD+900)){
          var mz2=ptAt(gunX(),gunY(),curAng(),GS,95,0), flick=0.5+Math.random()*0.5;
          ctx.save();ctx.translate(mz2.x,mz2.y);ctx.rotate(curAng());
          var fg=ctx.createLinearGradient(0,0,46*sz,0);fg.addColorStop(0,g('255,255,255,'+flick));fg.addColorStop(.4,g(C_FIRE+','+flick));fg.addColorStop(1,g(C_FIRE+',0'));
          ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(0,-10*sz*flick);ctx.lineTo(48*sz*flick,0);ctx.lineTo(0,10*sz*flick);ctx.closePath();ctx.fill();ctx.restore();
        }
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          if(bm.slash){
            var env=Math.sin(bpr*Math.PI), sweepAng=bm.sweep?(-0.7+bpr*1.6):bm.rot;
            ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(sweepAng);var slen=130*sz;
            ctx.fillStyle=g(bm.col+','+(0.15*env));ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,slen,-0.5,0.1);ctx.closePath();ctx.fill();
            var gg=ctx.createLinearGradient(0,0,slen,0);gg.addColorStop(0,g(bm.col+',0.5'));gg.addColorStop(.7,g(bm.col+',0.3'));gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=22*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(15*sz,0);ctx.lineTo(slen,0);ctx.stroke();
            gg=ctx.createLinearGradient(0,0,slen,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.6,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=(8-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(15*sz,0);ctx.lineTo(slen,0);ctx.stroke();ctx.restore();
          }
        }
        for(var i=bolts.length-1;i>=0;i--){var b=bolts[i];b.life+=dt;b.x+=b.vx*dt*0.06;b.y+=b.vy*dt*0.06;b.trail.push({x:b.x,y:b.y});if(b.trail.length>7)b.trail.shift();
          if(!b.hit&&Math.hypot(b.x-tgtX,b.y-tgtY)<22*sz){b.hit=true;spawnSpark(b.x,b.y,C_FIRE,4,6);spawnRing(tgtX,tgtY,C_FIRE,0.8,2*sz);if(t>T_GUN+150)fireDeal();bolts.splice(i,1);continue;}
          if(b.x<-40||b.x>vw+40||b.y>clipBottom+40){bolts.splice(i,1);continue;}
          for(var ti2=0;ti2<b.trail.length;ti2++){var k2=ti2/b.trail.length;ctx.strokeStyle=g(C_FIRE+','+(k2*0.5));ctx.lineWidth=2.5*sz*k2;if(ti2>0){ctx.beginPath();ctx.moveTo(b.trail[ti2-1].x,b.trail[ti2-1].y);ctx.lineTo(b.trail[ti2].x,b.trail[ti2].y);ctx.stroke();}}
          ctx.shadowBlur=8;ctx.shadowColor=g(C_FIRE+',1');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,2.5*sz,0,6.28);ctx.fill();ctx.shadowBlur=0;
        }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(!s.flash){s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fcol=s.fcol||C_FIRE;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.8)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2600)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

  /* ─────────── 星陨武士·流亡之刃 → 星陨连斩(星海第一星域·实体剑客) ─────────── */
  /* 🔴 v869 升级(Hansen 定稿·更强): 实体银蓝光刃剑当主角·星陨武士气质。
     四幕: ①拔剑凝气(剑点燃·星屑环绕聚气·锁定) ②八方闪现突袭(剑瞬移到勇者四面八方·刀光从八方汇聚劈斩·带残影+刀光弧) ③残影乱舞(高频乱斩·光刃银蓝↔暗紫剧烈闪烁·星陨坠落) ④居合·星陨一闪(收剑蓄势凝止→一记居合爆出星形裂斩·星屑碎裂+白光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。剑/残影 source-over, 刀光/星屑 lighter 叠其上。 */
  function hbaExileBlade(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_BLUE='138,180,255', C_PURPLE='168,128,255', C_EDGE='207,228,255', C_STAR='200,232,255';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}

      function drawSword(cx,cy,s,rot,a,flick){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        var GLOW=flick>0.5?"#b088ff":"#8ab4ff", EDGE=flick>0.5?"#e0ccff":"#cfe4ff";
        ctx.fillStyle="#3a4048";ctx.beginPath();ctx.arc(-30,0,4,0,6.28);ctx.fill();ctx.strokeStyle="#5a6270";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#2a2e36";ctx.beginPath();ctx.moveTo(-27,-3.5);ctx.arcTo(-7,-3.5,-7,3.5,2.5);ctx.arcTo(-7,3.5,-27,3.5,2.5);ctx.lineTo(-27,3.5);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#161a20";ctx.lineWidth=1;for(var w=0;w<4;w++){ctx.beginPath();ctx.moveTo(-24+w*4.5,-3.5);ctx.lineTo(-22+w*4.5,3.5);ctx.stroke();}
        ctx.fillStyle="#5a6472";ctx.beginPath();ctx.moveTo(-9,-13);ctx.quadraticCurveTo(-3,-14,-2,-11);ctx.lineTo(-2,11);ctx.quadraticCurveTo(-3,14,-9,13);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#7a8598";ctx.lineWidth=1;ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor=GLOW;ctx.fillStyle=EDGE;ctx.beginPath();ctx.arc(-6,0,2.6,0,6.28);ctx.fill();ctx.restore();
        var bgd=ctx.createLinearGradient(0,-7,0,7);bgd.addColorStop(0,"#b0bacc");bgd.addColorStop(.5,"#eef4fc");bgd.addColorStop(1,"#8a94a4");
        ctx.fillStyle=bgd;ctx.beginPath();ctx.moveTo(-2,-6);ctx.lineTo(80,-4.2);ctx.lineTo(100,0);ctx.lineTo(80,4.2);ctx.lineTo(-2,6);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(150,165,195,.5)";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(90,0);ctx.stroke();
        ctx.save();ctx.shadowBlur=13;ctx.shadowColor=GLOW;ctx.strokeStyle=EDGE;ctx.lineWidth=1.9;
        ctx.beginPath();ctx.moveTo(-2,-6);ctx.lineTo(80,-4.2);ctx.lineTo(100,0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-2,6);ctx.lineTo(80,4.2);ctx.lineTo(100,0);ctx.stroke();ctx.restore();
        ctx.restore();
      }

      var stAng=-0.82, stX=bx-br.width*0.06, stY=by+br.height*0.05;
      var sparks=[], rings=[], shards=[], beams=[], stars=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      /* ② 八方闪现斩 + ③ 乱舞斩(角度进入函数时随机, 每次施放不同) */
      var slashes=[]; var a8=[-0.5,0.6,-1.15,1.2,-1.95,2.05,-0.15,2.95], qk;
      for(qk=0;qk<8;qk++){ slashes.push({ts:820+qk*84,ang:a8[qk],w:200,fast:false}); }
      for(qk=0;qk<8;qk++){ slashes.push({ts:1640+qk*98,ang:RND(-2.1,2.1),w:172,fast:true}); }
      var T_LOCK=760, T_IAI_CHARGE=2540, T_IAI_STRIKE=2980, IAI_W=420, T_END=3760;
      var fired={}, iaiStruck=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,8)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.35,0.35),col:col,life:0,max:RND(300,560),sz:RND(2,5)*sz});}}
      function spawnStar(){ stars.push({x:RND(tgtX-190*sz,tgtX+190*sz),y:tgtY-RND(170,340)*sz,vx:RND(-2,2)*sz,vy:RND(7,11)*sz,trail:[],life:0,max:700}); }
      function flickProb(){ return (t>=1600&&t<2540)?0.42:0.18; }

      function slashPass(cx,cy,A,tt,scl){
        var L=142*sz, dx=Math.cos(A)*L, dy=Math.sin(A)*L;
        var echoes=[[0.18,0.16],[0.12,0.26],[0.06,0.42]],e;
        for(e=0;e<echoes.length;e++){ var pe=tt-echoes[e][0]; if(pe<0)continue; var ex=cx-dx+2*dx*pe, ey=cy-dy+2*dy*pe; drawSword(ex,ey,scl,A,echoes[e][1],0); }
        var px=cx-dx+2*dx*tt, py=cy-dy+2*dy*tt;
        var a=1; if(tt<0.12)a=tt/0.12; else if(tt>0.82)a=(1-tt)/0.18;
        drawSword(px,py,scl,A,a,(Math.random()<flickProb())?1:0);
      }
      function drawStance(){
        var ig=t<300?t/300:1;
        drawSword(stX,stY,1.6*sz,stAng,ig,(Math.random()<0.14)?1:0);
        if(t<T_LOCK&&Math.random()<0.6){ var an=Math.random()*6.28, rd=RND(30,80)*sz; sparks.push({x:tgtX+Math.cos(an)*rd,y:tgtY+Math.sin(an)*rd,vx:0,vy:0,col:C_STAR,life:0,max:300,sz:RND(1.4,2.6)*sz,suck:{x:tgtX,y:tgtY}}); }
      }
      /* 居合蓄势: 剑横持勇者侧·凝止蓄光 */
      function drawIaiCharge(pr){
        var cx=tgtX-96*sz, cy=tgtY, R=pr*46*sz;
        ctx.save();ctx.globalCompositeOperation='lighter';
        var gr=ctx.createRadialGradient(cx,cy,0,cx,cy,R);gr.addColorStop(0,g('255,255,255,'+(pr*0.5)));gr.addColorStop(.4,g(C_BLUE+','+(pr*0.5)));gr.addColorStop(1,g(C_BLUE+',0'));
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,R,0,6.28);ctx.fill();ctx.restore();
        drawSword(cx,cy,1.9*sz,0,1,(Math.random()<0.3)?1:0);
        if(Math.random()<0.7){var an=Math.random()*6.28,d=52*sz;sparks.push({x:cx+Math.cos(an)*d,y:cy+Math.sin(an)*d,vx:0,vy:0,col:C_STAR,life:0,max:200,sz:2*sz,suck:{x:cx,y:cy}});}
      }
      function pushSlashArc(A,col,scl,big){
        beams.push({slash:true,x:tgtX,y:tgtY,rot:A,life:0,max:big?360:240,col:col,scl:scl||1,big:big});
        spawnSpark(tgtX,tgtY,'255,255,255',big?12:6,big?8:6);
      }
      /* 居合·星形裂斩: 多道刀光放射 + 星屑碎裂 + 白光 */
      function iaiStrike(){
        iaiStruck=true; fireDeal();
        var k; for(k=0;k<7;k++){ pushSlashArc(k/7*Math.PI+RND(-0.12,0.12), (k%2?C_PURPLE:C_BLUE), 2.1, true); }
        sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:230,sz:60*sz,flash:true,fcol:C_STAR});
        spawnShards(tgtX,tgtY,C_STAR,28); spawnRing(tgtX,tgtY,C_EDGE,1.4,5*sz); spawnRing(tgtX,tgtY,C_BLUE,0.9,3*sz);
        for(k=0;k<10;k++)spawnStar();
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5600);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          var si; for(si=0;si<slashes.length;si++){ var sl=slashes[si]; if(!fired[si]&&t>=sl.ts+sl.w*0.4){fired[si]=true; pushSlashArc(sl.ang,(Math.random()<0.5?C_BLUE:C_PURPLE),sl.fast?1.05:1.25,false); if(si===0)fireDeal();} }
          if((t>=820&&t<2540)&&Math.random()<0.16){ spawnStar(); }
          if(!iaiStruck&&t>=T_IAI_STRIKE){ iaiStrike(); }
          if(t>T_END&&beams.length===0&&stars.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0&&stars.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体剑(source-over) ===== */
        ctx.globalCompositeOperation='source-over';
        var active=-1,ai;
        for(ai=0;ai<slashes.length;ai++){ if(t>=slashes[ai].ts&&t<slashes[ai].ts+slashes[ai].w){active=ai;break;} }
        if(active>=0){ var sa=slashes[active]; slashPass(tgtX,tgtY,sa.ang,(t-sa.ts)/sa.w, sa.fast?1.6*sz:1.7*sz); }
        else if(t>=T_IAI_CHARGE&&t<T_IAI_STRIKE){ drawIaiCharge((t-T_IAI_CHARGE)/(T_IAI_STRIKE-T_IAI_CHARGE)); }
        else if(t>=T_IAI_STRIKE&&t<T_IAI_STRIKE+220){ slashPass(tgtX,tgtY,0.2,(t-T_IAI_STRIKE)/220,2.3*sz); }
        else if(t<T_IAI_STRIKE){ drawStance(); }

        /* ===== 星屑坠落(source-over 拖尾) ===== */
        for(var ri2=stars.length-1;ri2>=0;ri2--){var st=stars[ri2];st.life+=dt;st.x+=st.vx*dt*0.06;st.y+=st.vy*dt*0.06;st.trail.push({x:st.x,y:st.y});if(st.trail.length>7)st.trail.shift();
          if(st.y>clipBottom+20||st.life>st.max){stars.splice(ri2,1);continue;}
          for(var tj=0;tj<st.trail.length;tj++){var kk=tj/st.trail.length;ctx.fillStyle=g(C_STAR+','+(kk*0.45));ctx.beginPath();ctx.arc(st.trail[tj].x,st.trail[tj].y,1.6*sz*kk,0,6.28);ctx.fill();}
          ctx.fillStyle=g('255,255,255,.9');ctx.beginPath();ctx.arc(st.x,st.y,1.8*sz,0,6.28);ctx.fill();
        }

        /* ===== 刀光/星屑碎裂(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          var env=Math.sin(bpr*Math.PI), scl=bm.scl||1;
          ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(bm.rot);
          var slen=(bm.big?185:126)*sz*scl*env;
          var gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.5,g(bm.col+',0.55'));gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(bm.big?26:18)*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.45,'rgba(255,255,255,1)');gg.addColorStop(.55,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(6-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          ctx.restore();
        }
        if(t<T_LOCK){ var lp=t/T_LOCK, R=(72-lp*40)*sz;
          ctx.strokeStyle=g(C_BLUE+','+(0.32+lp*0.4));ctx.lineWidth=1.6*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_BLUE+',1');
          ctx.beginPath();ctx.arc(tgtX,tgtY,R,0,6.28);ctx.stroke();
          for(var m=0;m<8;m++){var a=m/8*6.28+lp*1.2;ctx.beginPath();ctx.moveTo(tgtX+Math.cos(a)*(R+3*sz),tgtY+Math.sin(a)*(R+3*sz));ctx.lineTo(tgtX+Math.cos(a)*(R+9*sz),tgtY+Math.sin(a)*(R+9*sz));ctx.stroke();}
          ctx.shadowBlur=0;
        }
        for(var rri=rings.length-1;rri>=0;rri--){var r=rings[rri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(rri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var pi=sparks.length-1;pi>=0;pi--){var sp2=sparks[pi];sp2.life+=dt;
          if(sp2.suck){var dx=sp2.suck.x-sp2.x,dy=sp2.suck.y-sp2.y;sp2.x+=dx*0.14;sp2.y+=dy*0.14;if(Math.hypot(dx,dy)<6){sparks.splice(pi,1);continue;}}
          else if(sp2.flash){}
          else{sp2.vy+=0.012*dt*sz;sp2.x+=sp2.vx*dt*0.06;sp2.y+=sp2.vy*dt*0.06;sp2.vx*=0.99;}
          var spr=sp2.life/sp2.max;if(spr>=1){sparks.splice(pi,1);continue;}
          if(sp2.flash){var fcol=sp2.fcol||C_BLUE;var fg2=ctx.createRadialGradient(sp2.x,sp2.y,0,sp2.x,sp2.y,sp2.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.85)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(sp2.x,sp2.y,sp2.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(sp2.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(sp2.col+',1');ctx.beginPath();ctx.arc(sp2.x,sp2.y,sp2.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2800)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

  /* ─────────── 机械主教·组装者 → 全功率复产(星海第一星域·实体机械) ─────────── */
  /* 🔴 v869 新建(Hansen 定稿·实体机械造物): 全程 canvas 画出的【红独眼 + 多段机械臂(液压冲压头) + 流水线组装小兵】当主角, 不是光点。
     四幕: ①独眼激活扫描锁定(红扫描线+锁定框) ②流水线组装(传送带+机械臂组装小兵→launch 扑向勇者) ③机械臂液压冲压(巨臂砸落冲击)+独眼激光切割(红激光横扫) ④全功率复产(小兵成群涌出+连续冲压+独眼过载红光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。机械实体 source-over, 激光/火花/冲击 lighter 叠其上。 */
  function hbaAssembler(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_RED='255,58,42', C_REDDK='224,42,26', C_AMBER='255,176,32', C_LASER='255,48,32';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      function drawEye(cx,cy,r){
        ctx.save();ctx.translate(cx,cy);
        var hg=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.5,0,0,r*1.15);hg.addColorStop(0,"#565d6b");hg.addColorStop(1,"#22252b");
        ctx.fillStyle=hg;ctx.beginPath();ctx.arc(0,0,r*1.15,0,6.28);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle="#161a20";for(var i=0;i<8;i++){var a=i/8*6.28;ctx.beginPath();ctx.arc(Math.cos(a)*r*1.0,Math.sin(a)*r*1.0,r*0.09,0,6.28);ctx.fill();}
        var ig=ctx.createRadialGradient(0,0,0,0,0,r);ig.addColorStop(0,"#ff6a5a");ig.addColorStop(.5,"#e02a1a");ig.addColorStop(1,"#5a1008");
        ctx.save();ctx.shadowBlur=16;ctx.shadowColor="#ff3a2a";ctx.fillStyle=ig;ctx.beginPath();ctx.arc(0,0,r*0.82,0,6.28);ctx.fill();ctx.restore();
        ctx.strokeStyle="rgba(120,20,10,.6)";ctx.lineWidth=1;for(var j=0;j<16;j++){var a2=j/16*6.28;ctx.beginPath();ctx.moveTo(Math.cos(a2)*r*0.3,Math.sin(a2)*r*0.3);ctx.lineTo(Math.cos(a2)*r*0.78,Math.sin(a2)*r*0.78);ctx.stroke();}
        ctx.fillStyle="#0a0505";ctx.beginPath();ctx.arc(0,0,r*0.3,0,6.28);ctx.fill();
        ctx.save();ctx.shadowBlur=12;ctx.shadowColor="#ff5a4a";ctx.fillStyle="#ffece0";ctx.beginPath();ctx.arc(0,0,r*0.12,0,6.28);ctx.fill();ctx.restore();
        ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.arc(-r*0.28,-r*0.28,r*0.1,0,6.28);ctx.fill();
        ctx.restore();
      }
      function drawSeg(x1,y1,x2,y2,wd){
        var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
        ctx.save();ctx.translate(x1,y1);ctx.rotate(ang);
        var gd=ctx.createLinearGradient(0,-wd/2,0,wd/2);gd.addColorStop(0,"#2c303a");gd.addColorStop(.35,"#5a6270");gd.addColorStop(.6,"#3e444e");gd.addColorStop(1,"#22252b");
        ctx.fillStyle=gd;rr(0,-wd/2,L,wd,wd*0.35);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="rgba(150,160,175,.35)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L*0.2,-wd*0.18);ctx.lineTo(L*0.8,-wd*0.18);ctx.stroke();
        ctx.restore();
      }
      function joint(x,y,r){
        ctx.save();ctx.translate(x,y);var gd=ctx.createRadialGradient(-r*0.3,-r*0.3,0,0,0,r);gd.addColorStop(0,"#6a7280");gd.addColorStop(1,"#2a2e36");
        ctx.fillStyle=gd;ctx.beginPath();ctx.arc(0,0,r,0,6.28);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#161a20";ctx.beginPath();ctx.arc(0,0,r*0.4,0,6.28);ctx.fill();ctx.restore();
      }
      function drawPress(hx2,hy2,ang,s){
        ctx.save();ctx.translate(hx2,hy2);ctx.rotate(ang);
        ctx.fillStyle="#3e444e";rr(-6*s,-5*s,14*s,10*s,2);ctx.fill();
        var gd=ctx.createLinearGradient(0,-15*s,0,15*s);gd.addColorStop(0,"#565d6b");gd.addColorStop(.5,"#3a3f4a");gd.addColorStop(1,"#24272e");
        ctx.fillStyle=gd;rr(6*s,-15*s,20*s,30*s,3);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#ffb020";for(var i=0;i<3;i++){ctx.save();ctx.translate(11*s+i*5.5*s,0);ctx.rotate(0.5);ctx.fillRect(-1.6*s,-14*s,3.2*s,28*s);ctx.restore();}
        ctx.restore();
      }
      function drawArm(sx,sy,hx2,hy2,s){
        var dx=hx2-sx,dy=hy2-sy,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;
        var mx=(sx+hx2)/2,my=(sy+hy2)/2,ex=mx+px*24*s,ey=my+py*24*s;
        drawSeg(sx,sy,ex,ey,13*s); drawSeg(ex,ey,hx2,hy2,9.5*s);
        joint(sx,sy,11*s); joint(ex,ey,8*s);
        drawPress(hx2,hy2,Math.atan2(hy2-ey,hx2-ex),s);
      }
      function drawBot(cx,cy,s,ang){
        ctx.save();ctx.translate(cx,cy);ctx.rotate(ang||0);ctx.scale(s,s);
        ctx.fillStyle="#2a2e36";ctx.fillRect(-14,-4,5,8);
        var gd=ctx.createLinearGradient(0,-10,0,10);gd.addColorStop(0,"#565d6b");gd.addColorStop(.5,"#3a3f4a");gd.addColorStop(1,"#24272e");
        ctx.fillStyle=gd;rr(-10,-9,22,18,4);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,9);ctx.lineTo(-6,14);ctx.moveTo(4,9);ctx.lineTo(6,14);ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor="#ff3a2a";var eg=ctx.createRadialGradient(6,0,0,6,0,5);eg.addColorStop(0,"#ffd0c0");eg.addColorStop(.4,"#ff3a2a");eg.addColorStop(1,"#7a1008");ctx.fillStyle=eg;ctx.beginPath();ctx.arc(6,0,4,0,6.28);ctx.fill();ctx.restore();
        ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,-9);ctx.lineTo(-11,-15);ctx.stroke();ctx.fillStyle="#ff3a2a";ctx.beginPath();ctx.arc(-11,-15,1.5,0,6.28);ctx.fill();
        ctx.restore();
      }
      function drawConveyor(a){
        var cy=convY, x1=bx-br.width*0.46, x2=bx+br.width*0.46, w=x2-x1;
        ctx.save();ctx.globalAlpha=a;
        ctx.fillStyle="#1e222a";rr(x1,cy-7*sz,w,14*sz,3);ctx.fill();ctx.strokeStyle="#3a3f4a";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#2e343e";var off=(t*0.05*sz)%(14*sz);
        for(var tx=x1+off;tx<x2;tx+=14*sz){ ctx.fillRect(tx,cy-6*sz,6*sz,12*sz); }
        ctx.restore();
      }

      var eyeR=Math.max(24,Math.min(44,br.width*0.15))*sz, eyeX=bx, eyeY=by-br.height*0.10;
      var shoulderX=bx+br.width*0.16, shoulderY=by-br.height*0.26, convY=by+br.height*0.34;
      var minions=[], sparks=[], rings=[], shards=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var eyeA=0;
      var T_SCAN_END=820, T_PRESS=2000, T_LASER=2360, T_LASER_END=2620, T_OVERLOAD=2680, T_END=4200;
      var slams=[2000,2760,2960,3160,3360], slamFired={};
      var spawnPlan=[[920,360],[1240,360],[1560,360],[2760,240],[2920,240],[3080,240],[3240,240],[3400,240],[3560,240]], spawned={};

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}
      function spawnMinion(spotX,launchDelay){ minions.push({x:spotX,y:convY,phase:0,born:t,launchAt:t+launchDelay,vx:0,vy:0,rot:0,hit:false}); }
      function pressImpact(){
        fireDeal();
        rings.push({x:tgtX,y:tgtY,r:2,vr:1.4,w:5*sz,col:C_AMBER,life:0,max:360});
        rings.push({x:tgtX,y:tgtY,r:2,vr:0.9,w:3*sz,col:C_RED,life:0,max:320});
        spawnShards(tgtX,tgtY,C_AMBER,14); spawnSpark(tgtX,tgtY,'255,255,255',14,9);
        sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:190,sz:38*sz,flash:true,fcol:C_AMBER});
      }
      function lerp(a,b,e){return {x:a.x+(b.x-a.x)*e, y:a.y+(b.y-a.y)*e};}
      function armHand(){
        var raised={x:shoulderX-6*sz, y:shoulderY+72*sz}, heroP={x:tgtX, y:tgtY-12*sz};
        for(var i=0;i<slams.length;i++){ var st=slams[i]; if(t>=st&&t<st+300){ var p=(t-st)/300;
          if(p<0.4){ var e=p/0.4; e=e*e; return lerp(raised,heroP,e); } else { var e2=(p-0.4)/0.6; return lerp(heroP,raised,e2); } } }
        if(t>=880&&t<1900){ return {x:bx+Math.sin(t*0.006)*br.width*0.26, y:convY-36*sz+Math.sin(t*0.02)*6*sz}; }
        if(t>=T_OVERLOAD&&t<T_END){ return {x:bx+Math.sin(t*0.01)*br.width*0.2, y:convY-42*sz}; }
        return raised;
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          eyeA=Math.min(1,t/220);
          for(var pi=0;pi<spawnPlan.length;pi++){ if(!spawned[pi]&&t>=spawnPlan[pi][0]){spawned[pi]=true; var spotX=bx+RND(-0.34,0.34)*br.width; spawnMinion(spotX,spawnPlan[pi][1]);} }
          for(var i=0;i<slams.length;i++){ if(!slamFired[i]&&t>=slams[i]+120){slamFired[i]=true; pressImpact();} }
          if(t>=T_LASER&&t<T_LASER_END&&!dealt&&t>T_LASER+80){ /* 激光也可判定 */ }
          if(t>T_END&&minions.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&minions.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体机械(source-over) ===== */
        ctx.globalCompositeOperation='source-over';
        if((t>=760&&t<1900)||(t>=T_OVERLOAD&&t<T_END)){ drawConveyor(0.9); }
        // 机械臂(扫描幕后出现)
        if(t>=T_SCAN_END-120){ var hnd=armHand(); drawArm(shoulderX,shoulderY,hnd.x,hnd.y,sz); }
        // 红独眼
        if(eyeA>0.01){ ctx.save();ctx.globalAlpha=eyeA;drawEye(eyeX,eyeY,eyeR);ctx.restore(); }
        // 小兵(组装/飞行)
        for(var mi=minions.length-1;mi>=0;mi--){var m=minions[mi];
          if(m.phase===0){ var ap=(t-m.born)/(m.launchAt-m.born); if(ap>1)ap=1;
            if(t>=m.launchAt){ m.phase=1; var a=Math.atan2(tgtY-m.y,tgtX-m.x); var s2=RND(6,9)*sz; m.vx=Math.cos(a)*s2; m.vy=Math.sin(a)*s2; m.rot=a; }
            var parts=[[-18,-14],[16,-16],[-16,14],[18,12]];
            for(var q=0;q<4;q++){ var pe=Math.min(1,ap*1.3); var qx=m.x+parts[q][0]*(1-pe), qy=m.y+parts[q][1]*(1-pe);
              ctx.fillStyle=g('96,106,122,'+(0.55+0.4*pe));ctx.save();ctx.translate(qx,qy);ctx.rotate((1-pe)*3);rr(-3*sz,-2*sz,6*sz,4*sz,1);ctx.fill();ctx.restore(); }
            if(ap>0.5){ ctx.save();ctx.globalAlpha=(ap-0.5)/0.5;drawBot(m.x,m.y,1.4*sz,0);ctx.restore(); }
            if(Math.random()<0.4){ sparks.push({x:m.x+RND(-14,14),y:m.y+RND(-12,12),vx:0,vy:0,col:C_AMBER,life:0,max:200,sz:2*sz}); }
          } else {
            m.x+=m.vx*dt*0.075; m.y+=m.vy*dt*0.075; m.rot=Math.atan2(m.vy,m.vx);
            if(!m.hit&&Math.hypot(m.x-tgtX,m.y-tgtY)<20*sz){ m.hit=true; fireDeal(); rings.push({x:tgtX,y:tgtY,r:2,vr:0.9,w:3*sz,col:C_RED,life:0,max:280}); spawnSpark(m.x,m.y,C_AMBER,6,7); spawnShards(m.x,m.y,'150,160,175',5); minions.splice(mi,1); continue; }
            if(m.x<-40||m.x>vw+40||m.y>clipBottom+40){ minions.splice(mi,1); continue; }
            drawBot(m.x,m.y,1.4*sz,m.rot);
          }
        }

        /* ===== 激光/扫描/火花/冲击(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        // 扫描锁定(act1)
        if(t<T_SCAN_END){ var scp=t/T_SCAN_END;
          var swX=barL+barW*((Math.sin(t*0.014)+1)/2), swY=tgtY;
          ctx.save();ctx.globalAlpha=0.5+0.3*Math.sin(t*0.03);ctx.strokeStyle=g(C_RED+',1');ctx.lineWidth=1.4*sz;ctx.setLineDash([8,6]);ctx.lineDashOffset=-t*0.05;
          ctx.beginPath();ctx.moveTo(eyeX,eyeY+eyeR);ctx.lineTo(swX,swY);ctx.stroke();ctx.setLineDash([]);ctx.restore();
          if(scp>0.4){ var fa=(scp-0.4)*1.6, box=(1-Math.min(1,(scp-0.4)*1.8))*40+40, cn=15*sz;
            ctx.strokeStyle=g(C_RED+','+Math.min(1,fa));ctx.lineWidth=2.4*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_RED+',1');
            var cs=[[-1,-1],[1,-1],[-1,1],[1,1]];
            for(var ci=0;ci<4;ci++){var cc=cs[ci];var cx2=tgtX+cc[0]*box,cy2=tgtY+cc[1]*box*0.6;ctx.beginPath();ctx.moveTo(cx2,cy2+cc[1]*cn);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2-cc[0]*cn,cy2);ctx.stroke();}
            ctx.shadowBlur=0;
          }
        }
        // 独眼激光切割(act3)
        if(t>=T_LASER&&t<T_LASER_END){ var lp=(t-T_LASER)/(T_LASER_END-T_LASER);
          var endX=barL+barW*lp, endY=tgtY, ex0=eyeX, ey0=eyeY+eyeR*0.4;
          ctx.save();ctx.shadowBlur=14;ctx.shadowColor=g(C_LASER+',1');
          var lg=ctx.createLinearGradient(ex0,ey0,endX,endY);lg.addColorStop(0,g(C_LASER+',0.5'));lg.addColorStop(1,g(C_LASER+',0.9'));
          ctx.strokeStyle=lg;ctx.lineWidth=5*sz;ctx.beginPath();ctx.moveTo(ex0,ey0);ctx.lineTo(endX,endY);ctx.stroke();
          ctx.strokeStyle=g('255,220,210,0.95');ctx.lineWidth=1.8*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(ex0,ey0);ctx.lineTo(endX,endY);ctx.stroke();
          ctx.restore();
          if(Math.random()<0.7){ spawnSpark(endX,endY,C_LASER,3,6); }
          if(!dealt&&lp>0.2)fireDeal();
        }
        // 独眼过载红光(act4)
        if(t>=T_OVERLOAD&&t<T_END){ var pv=0.3+0.2*Math.sin(t*0.02);
          var og=ctx.createRadialGradient(eyeX,eyeY,0,eyeX,eyeY,eyeR*2.4);og.addColorStop(0,g(C_RED+','+pv));og.addColorStop(1,g(C_RED+',0'));
          ctx.fillStyle=og;ctx.beginPath();ctx.arc(eyeX,eyeY,eyeR*2.4,0,6.28);ctx.fill();
        }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var pi2=sparks.length-1;pi2>=0;pi2--){var s=sparks[pi2];s.life+=dt;
          if(!s.flash){s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(pi2,1);continue;}
          if(s.flash){var fcol=s.fcol||C_AMBER;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.8)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||3000)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

  /* ─────────── 活体行星·古老意志 → 引力坍缩(星海第一星域·守望之星) ─────────── */
  /* 🔴 v869 新建(Hansen 定稿·守望不战斗的活体行星): 全程 canvas 画出的【自转行星本体(金色脉络)+ 记忆环 + 引力场 + 引力奇点】当主角。不挥武器, 以引力意志碾压。
     四幕: ①苏醒凝视(行星脉络点亮·记忆环旋转·极光·大气辉光) ②引力低语(引力波从行星层层扩散washes勇者·近旁尘埃被牵引) ③星尘牵引(勇者处生成引力奇点·星尘螺旋吸入·行星金色引力束) ④引力坍缩(奇点坍缩内爆→炽金核→冲击波外爆·记忆环炸亮·行星脉络血脉贲张→判定, 之后归于守望)。
     刻意避开女帝专属的星系/繁星观感——这是一颗有环的行星, 不是星海。全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。 */
  function hbaAncientWill(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_GOLD='255,200,110', C_GOLDBR='255,226,150', C_CYAN='130,220,235';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}

      var plR=Math.max(38,br.width*0.40)*sz, plX=bx, plY=by;
      var sgX=tgtX, sgY=tgtY;

      function drawPlanet(cx,cy,r,rot,glow){
        ctx.save();ctx.globalCompositeOperation='lighter';
        var ag=ctx.createRadialGradient(cx,cy,r*0.85,cx,cy,r*1.42);ag.addColorStop(0,g('255,200,110,'+(0.22*glow)));ag.addColorStop(.6,g('130,220,235,'+(0.09*glow)));ag.addColorStop(1,g('255,180,90,0'));
        ctx.fillStyle=ag;ctx.beginPath();ctx.arc(cx,cy,r*1.42,0,6.28);ctx.fill();ctx.restore();
        ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.clip();
        var cg=ctx.createRadialGradient(cx,cy,0,cx,cy,r);cg.addColorStop(0,g('255,200,110,'+(0.18*glow)));cg.addColorStop(.6,g('255,180,90,'+(0.10*glow)));cg.addColorStop(1,g('255,180,90,0'));
        ctx.globalCompositeOperation='lighter';ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.fill();
        ctx.globalCompositeOperation='lighter';ctx.shadowBlur=8;ctx.shadowColor="#ffcf7a";
        var vn=6,i;
        for(i=0;i<vn;i++){ var ph=rot+i*(6.28/vn); var cp=Math.cos(ph); if(cp<=0.06)continue;
          ctx.strokeStyle=g('255,200,110,'+(glow*(0.3+0.55*cp)));ctx.lineWidth=1.8*sz;
          ctx.beginPath();ctx.moveTo(cx,cy-r*0.99);ctx.quadraticCurveTo(cx+Math.sin(ph)*r*1.32,cy,cx,cy+r*0.99);ctx.stroke(); }
        var la;
        for(la=-1;la<=1;la++){ if(la===0)continue; var ly=cy+la*r*0.42, lw=r*Math.sqrt(Math.max(0,1-0.42*0.42));
          ctx.strokeStyle=g('255,200,110,'+(glow*0.28));ctx.lineWidth=1.4*sz;ctx.beginPath();ctx.ellipse(cx,ly,lw*0.98,r*0.12,0,0,6.28);ctx.stroke(); }
        ctx.shadowBlur=0;
        var hg=ctx.createRadialGradient(cx-r*0.4,cy-r*0.4,0,cx-r*0.4,cy-r*0.4,r*0.7);hg.addColorStop(0,'rgba(180,230,240,.22)');hg.addColorStop(1,'rgba(180,230,240,0)');
        ctx.fillStyle=hg;ctx.fillRect(cx-r,cy-r,r*2,r*2);
        ctx.restore();
      }
      function drawRing(cx,cy,rx,ry,tickRot,glow,col){
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=g(col+','+(0.45*glow));ctx.lineWidth=2*sz;ctx.shadowBlur=8;ctx.shadowColor=g(col+',1');
        ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,6.28);ctx.stroke();
        ctx.strokeStyle=g(col+','+(0.7*glow));ctx.lineWidth=1.3*sz;
        var nt=30,k;
        for(k=0;k<nt;k++){ var a=k/nt*6.28+tickRot; var ex=cx+Math.cos(a)*rx, ey=cy+Math.sin(a)*ry, nx=cx+Math.cos(a)*(rx+4*sz), ny=cy+Math.sin(a)*(ry+4*sz);
          ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(nx,ny);ctx.stroke(); }
        // 前缘亮弧(下半·制造环绕行星的纵深)
        ctx.strokeStyle=g(col+','+(0.85*glow));ctx.lineWidth=2.4*sz;
        ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0.15,3.0);ctx.stroke();
        ctx.shadowBlur=0;ctx.restore();
      }
      function drawAurora(a){
        ctx.save();ctx.globalCompositeOperation='lighter';
        var cols=['120,230,170','150,200,245','185,150,240'],b2;
        for(b2=0;b2<3;b2++){ ctx.strokeStyle=g(cols[b2]+','+(0.09*a)); ctx.lineWidth=(14-b2*3)*sz; ctx.lineCap='round';
          ctx.beginPath(); var xx;
          for(xx=plX-plR*1.3;xx<=plX+plR*1.3;xx+=8){ var yy=plY-plR*0.55-b2*13*sz+Math.sin(xx*0.02+t*0.002+b2)*10*sz; if(xx<plX-plR*1.3+1)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy); }
          ctx.stroke(); }
        ctx.lineCap='butt';ctx.restore();
      }

      var waves=[], dust=[], motes=[], rings=[], shards=[], sparks=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var rot=0, ringRot=0, glow=0;
      var T_AWAKE=900, T_WHISPER_END=1900, T_PULL_END=2760, T_COLLAPSE=2760, T_END=3820;
      var nextWave=0, collapsed=false, imploded=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(240,460),sz:RND(1.4,3)*sz});}}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,8)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(300,560),sz:RND(2,5)*sz});}}
      function spawnDust(){ var a=Math.random()*6.28, rad=RND(60,95)*sz; dust.push({ang:a,rad:rad,vang:RND(0.004,0.008)*(Math.random()<0.5?1:-1),vrad:-RND(0.012,0.024),sz:RND(1.2,2.6)*sz,col:(Math.random()<0.5?C_GOLD:C_GOLDBR)}); }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt; rot+=dt*0.0006; ringRot+=dt*0.0008;
          glow=Math.min(1,t/T_AWAKE);
          // ② 引力波
          if(t>=T_AWAKE&&t<T_PULL_END&&t>=nextWave){ waves.push({r:plR*0.9,life:0,max:1500,vr:RND(0.10,0.14)}); nextWave=t+280/sp; }
          // ③ 星尘牵引
          if(t>=T_WHISPER_END&&t<T_COLLAPSE){ if(Math.random()<0.6)spawnDust(); }
          // ④ 坍缩
          if(!collapsed&&t>=T_COLLAPSE){ collapsed=true;
            for(var d0=0;d0<dust.length;d0++){ dust[d0].vrad=-RND(0.08,0.14); } // 全部急速吸入
          }
          if(collapsed&&!imploded&&t>=T_COLLAPSE+180){ imploded=true; fireDeal();
            rings.push({x:sgX,y:sgY,r:2,vr:1.5,w:6*sz,col:C_GOLDBR,life:0,max:420});
            rings.push({x:sgX,y:sgY,r:2,vr:1.0,w:4*sz,col:C_GOLD,life:0,max:380});
            rings.push({x:sgX,y:sgY,r:2,vr:0.7,w:3*sz,col:C_CYAN,life:0,max:340});
            spawnShards(sgX,sgY,C_GOLD,18); spawnSpark(sgX,sgY,'255,255,255',22,10);
            sparks.push({x:sgX,y:sgY,vx:0,vy:0,col:'255,255,255',life:0,max:220,sz:52*sz,flash:true,fcol:C_GOLDBR});
          }
          if(t>T_END&&waves.length===0&&dust.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&waves.length===0&&dust.length===0&&sparks.length===0&&rings.length===0&&shards.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* 极光(行星之后·先画) */
        if(glow>0.01) drawAurora(glow);
        /* 行星本体 */
        if(glow>0.01){ ctx.save();ctx.globalAlpha=Math.min(1,glow*1.2);drawPlanet(plX,plY,plR,rot,glow);ctx.restore(); }
        /* 记忆环(行星之前的后半在内部已含前缘弧) */
        if(glow>0.02){ drawRing(plX,plY,plR*1.5,plR*0.42,ringRot,glow,C_GOLD); drawRing(plX,plY,plR*1.86,plR*0.56,-ringRot*0.7,glow*0.8,C_CYAN); }

        ctx.globalCompositeOperation='lighter';
        /* 引力波(层层扩散·washes勇者) */
        for(var wi=waves.length-1;wi>=0;wi--){var w=waves[wi];w.life+=dt;w.r+=w.vr*dt;var wpr=w.life/w.max;if(wpr>=1||w.r>vh*1.1){waves.splice(wi,1);continue;}
          var wa=(1-wpr)*0.5;
          ctx.strokeStyle=g(C_GOLD+','+wa);ctx.lineWidth=2.4*sz*(1-wpr*0.5);ctx.shadowBlur=8;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.ellipse(plX,plY,w.r,w.r*0.82,0,0,6.28);ctx.stroke();ctx.shadowBlur=0;
          // 波峰经过勇者时牵引近旁尘埃
          if(Math.abs(w.r-Math.hypot(sgX-plX,sgY-plY))<12*sz && Math.random()<0.5){ motes.push({x:sgX+RND(-50,50)*sz,y:sgY+RND(-30,30)*sz,life:0,max:500}); }
        }
        /* ③④ 引力奇点 + 金色引力束 */
        if(t>=T_WHISPER_END){
          var grow=Math.min(1,(t-T_WHISPER_END)/(T_COLLAPSE-T_WHISPER_END));
          var coreR=grow*20*sz*(collapsed?Math.max(0,1-(t-T_COLLAPSE)/220):1);
          // 金色引力束: 行星→奇点
          ctx.strokeStyle=g(C_GOLD+','+(0.3+0.2*Math.sin(t*0.02))*grow);ctx.lineWidth=(3+grow*3)*sz;ctx.shadowBlur=12;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.moveTo(plX,plY+plR*0.6);ctx.lineTo(sgX,sgY-coreR);ctx.stroke();ctx.shadowBlur=0;
          if(coreR>0.5){
            // 吸积亮环
            ctx.strokeStyle=g(C_GOLDBR+','+(0.8*grow));ctx.lineWidth=2.4*sz;ctx.shadowBlur=14;ctx.shadowColor=g(C_GOLD+',1');
            ctx.beginPath();ctx.ellipse(sgX,sgY,coreR*1.5,coreR*1.05,0,0,6.28);ctx.stroke();ctx.shadowBlur=0;
            // 透镜暗核(source-over压暗中心)
            ctx.globalCompositeOperation='source-over';
            var cg=ctx.createRadialGradient(sgX,sgY,0,sgX,sgY,coreR);cg.addColorStop(0,'rgba(4,8,14,0.95)');cg.addColorStop(.7,'rgba(8,16,24,0.6)');cg.addColorStop(1,'rgba(8,16,24,0)');
            ctx.fillStyle=cg;ctx.beginPath();ctx.arc(sgX,sgY,coreR,0,6.28);ctx.fill();
            ctx.globalCompositeOperation='lighter';
          }
        }
        /* 星尘螺旋吸入 */
        for(var pi=dust.length-1;pi>=0;pi--){var p=dust[pi];p.ang+=p.vang*dt;p.rad+=p.vrad*dt;if(p.rad<4){dust.splice(pi,1);continue;}
          var px=sgX+Math.cos(p.ang)*p.rad, py=sgY+Math.sin(p.ang)*p.rad*0.72;
          ctx.fillStyle=g(p.col+','+Math.min(1,p.rad/50));ctx.shadowBlur=6;ctx.shadowColor=g(C_GOLD+',1');ctx.beginPath();ctx.arc(px,py,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0;}
        /* 被牵引的近旁尘埃(②) */
        for(var mi=motes.length-1;mi>=0;mi--){var m=motes[mi];m.life+=dt;var mpr=m.life/m.max;if(mpr>=1){motes.splice(mi,1);continue;}
          m.x+=(sgX-m.x)*0.02;m.y+=(sgY-m.y)*0.02;
          ctx.fillStyle=g(C_GOLD+','+((1-mpr)*0.7));ctx.beginPath();ctx.arc(m.x,m.y,1.6*sz,0,6.28);ctx.fill();}
        /* 坍缩冲击环 */
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=14;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        /* 火花/星屑 */
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(!s.flash){s.vy+=0.01*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fcol=s.fcol||C_GOLD;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.85)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=7;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=6;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.5);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||3300)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

  function hbaSoulAbyss(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect(), bossTop=br.top;
      var clipBottom=barBot+16;
      var st=__hbaMapStage(0.0,bossTop,0.52,midY,hx,1.25);
      var W=st.W,H=st.H,SX=st.SX,SY=st.SY;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      function drawChain(sx0,sy0,ex,ey,crawl,a){
        var dx=ex-sx0,dy=ey-sy0,len=Math.hypot(dx,dy);if(len<2){return;}
        var ang=Math.atan2(dy,dx);var link=13*sz;var n=Math.max(2,Math.floor(len/link));
        ctx.save();ctx.globalAlpha=a;ctx.translate(sx0,sy0);ctx.rotate(ang);
        for(var i=0;i<n;i++){var px=i*link;var crawled=(i/n)<crawl;
          ctx.save();ctx.translate(px+link*0.5,0);ctx.rotate(i%2?Math.PI/2:0);ctx.lineWidth=3.4*sz;
          if(crawled){ctx.strokeStyle="rgba(120,70,200,0.95)";ctx.shadowBlur=12;ctx.shadowColor="#a855f7";}
          else{ctx.strokeStyle="rgba(150,150,170,0.9)";ctx.shadowBlur=5;ctx.shadowColor="#1a1230";}
          ctx.beginPath();ctx.ellipse(0,0,link*0.42,link*0.27,0,0,6.28);ctx.stroke();ctx.restore();}
        ctx.restore();
      }
      var chains=[],impacts=[],souls=[],embers=[],pit=null;
      var t=0,last=0,running=true,pitA=0,dealt=false;
      var T_CHARGE=350,T_SHOOT=400,T_LOCK=900,T_CRAWL=1100,T_DRAG=1700,T_DOWN=2550;
      function CEN(){return {x:W*0.5, y:H*0.52};}
      (function(){
        var c=CEN();var N=Math.round(12*Math.min(1.7,fxi));
        for(var i=0;i<N;i++){var ang=(i/N)*6.28+(Math.random()-0.5)*0.2;var D=W*0.62;
          var sx0=c.x+Math.cos(ang)*D,sy0=c.y+Math.sin(ang)*D;
          var hitR=(40+Math.random()*30)*sz;var ex=c.x+Math.cos(ang)*hitR,ey=c.y+Math.sin(ang)*hitR*0.8;
          chains.push({sx:sx0,sy:sy0,ex:ex,ey:ey,t0:T_SHOOT+Math.random()*180,prog:0,dur:200,locked:false,crawl:0,wob:Math.random()*6.28,a:0});}
        for(var k=0;k<Math.round(5*Math.min(1.6,fxi));k++){
          souls.push({x:c.x+(Math.random()-0.5)*60*sz,y:c.y+(Math.random()-0.5)*40*sz,glow:0,a:0,emergeT:T_LOCK+Math.random()*200,wob:Math.random()*6.28,s:(0.9+Math.random()*0.5)*sz,prog:0});}
      })();
      function spawnImpact(x,y){impacts.push({x:x,y:y,life:0,max:340,r:0});for(var q=0;q<6;q++){var ang=Math.random()*6.28,spd=(3+Math.random()*5)*sz;embers.push({x:x,y:y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:0,max:400,r:(1.4+Math.random()*2)*sz});}}
      var raf=0,dead=false;
      function done(){ if(dead){return;} dead=true; try{cancelAnimationFrame(raf);}catch(e){} if(cv&&cv.parentNode){cv.parentNode.removeChild(cv);} }
      var hardKill=setTimeout(done,5200);
      function frame(ts){
        if(dead){return;}
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        var c=CEN();
        if(running){t+=dt;
          if(t<T_DRAG){pitA=0;}else if(t<T_DOWN){pitA=Math.min(1,(t-T_DRAG)/400);}else{pitA=Math.max(0,1-(t-T_DOWN)/450);}
          if(t>=T_DOWN&&!pit){pit={life:0};if(!dealt){dealt=true;if(deal){try{deal();}catch(e){}}}}
          if(t>3500){running=false;}
        }
        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();ctx.translate(SX,SY);
        if(t<T_LOCK&&t>0){var pr=Math.min(1,t/T_CHARGE);var g=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,W*0.3*pr);g.addColorStop(0,"rgba(40,18,80,"+(pr*0.4)+")");g.addColorStop(1,"rgba(124,58,237,0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(c.x,c.y,W*0.3*pr,0,6.28);ctx.fill();}
        if(pitA>0.01){ctx.save();ctx.translate(c.x,c.y+20*sz);ctx.scale(1,0.42);var prp=pitA;var R=W*0.16*prp*sz;
          var gp=ctx.createRadialGradient(0,0,0,0,0,R);gp.addColorStop(0,"rgba(2,0,8,0.98)");gp.addColorStop(0.55,"rgba(30,12,60,0.85)");gp.addColorStop(0.85,"rgba(120,70,200,0.5)");gp.addColorStop(1,"rgba(124,58,237,0)");
          ctx.beginPath();ctx.arc(0,0,R,0,6.28);ctx.fillStyle=gp;ctx.fill();
          ctx.lineWidth=3*sz;ctx.strokeStyle="rgba(168,85,247,"+(prp*0.8)+")";ctx.shadowBlur=14;ctx.shadowColor="#a855f7";ctx.beginPath();ctx.arc(0,0,R,0,6.28);ctx.stroke();ctx.restore();}
        for(var ic=0;ic<chains.length;ic++){var ch=chains[ic];if(t<ch.t0){continue;}var lt=t-ch.t0;
          ch.prog=Math.min(1,lt/ch.dur);var e=ch.prog;var hxp=ch.sx+(ch.ex-ch.sx)*e,hyp=ch.sy+(ch.ey-ch.sy)*e;ch.a=Math.min(1,lt/100);
          if(ch.prog>=1&&!ch.locked){ch.locked=true;spawnImpact(ch.ex,ch.ey);}
          var curSx=ch.sx;
          if(ch.locked){var tg=Math.min(1,(t-(ch.t0+ch.dur))/600);curSx=ch.sx+(ch.ex-ch.sx)*0.18*tg;var csy=ch.sy+(ch.ey-ch.sy)*0.18*tg;
            ch.crawl=Math.max(0,Math.min(1,(t-T_CRAWL)/700));
            var endX=ch.ex,endY=ch.ey;if(pitA>0.01){var dd=Math.min(1,(t-T_DRAG)/700);endY=ch.ey+dd*40*sz;}
            drawChain(curSx,csy,endX,endY,ch.crawl,ch.a*(pit?Math.max(0,1-pit.life/500):1));
          } else {
            drawChain(ch.sx,ch.sy,hxp,hyp,0,ch.a);
            ctx.beginPath();ctx.arc(hxp,hyp,5*sz,0,6.28);ctx.fillStyle="rgba(216,180,254,0.95)";ctx.shadowBlur=12;ctx.shadowColor="#c084fc";ctx.fill();
          }
        }
        ctx.globalCompositeOperation="lighter";
        for(var i=impacts.length-1;i>=0;i--){var im=impacts[i];im.life+=dt;var pri=im.life/im.max;im.r=pri*36*sz;if(pri>=1){impacts.splice(i,1);continue;}
          ctx.beginPath();ctx.arc(im.x,im.y,im.r,0,6.28);ctx.lineWidth=3*sz*(1-pri);ctx.strokeStyle="rgba(200,150,255,"+((1-pri)*0.8)+")";ctx.shadowBlur=12;ctx.shadowColor="#a855f7";ctx.stroke();
          var ig=ctx.createRadialGradient(im.x,im.y,0,im.x,im.y,im.r);ig.addColorStop(0,"rgba(216,180,254,"+((1-pri)*0.5)+")");ig.addColorStop(1,"rgba(124,58,237,0)");ctx.fillStyle=ig;ctx.beginPath();ctx.arc(im.x,im.y,im.r,0,6.28);ctx.fill();}
        for(var ie=embers.length-1;ie>=0;ie--){var eb=embers[ie];eb.life+=dt;eb.x+=eb.vx*dt*0.05;eb.y+=eb.vy*dt*0.05;eb.vx*=0.97;eb.vy*=0.97;var pre=eb.life/eb.max;if(pre>=1){embers.splice(ie,1);continue;}
          ctx.beginPath();ctx.arc(eb.x,eb.y,eb.r*(1-pre*0.4),0,6.28);ctx.shadowBlur=8;ctx.shadowColor="#a855f7";ctx.fillStyle="rgba(190,130,250,"+((1-pre)*0.8)+")";ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        for(var isx=0;isx<souls.length;isx++){var s=souls[isx];if(t<s.emergeT){continue;}s.a=Math.min(1,(t-s.emergeT)/300);s.glow=Math.min(1,(t-s.emergeT)/400);s.wob+=dt*0.006;
          var x=s.x+Math.sin(s.wob)*6*sz,y=s.y+Math.cos(s.wob*1.3)*5*sz;var sc,aa;
          if(t>=T_DRAG){s.prog=Math.min(1,(t-T_DRAG)/700);var ed=s.prog*s.prog;y=s.y+(c.y+25*sz-s.y)*ed+(1-ed)*Math.cos(s.wob*1.3)*5*sz;x=s.x+(c.x-s.x)*ed+Math.sin(s.wob)*6*sz*(1-ed);sc=s.s*(1-s.prog*0.7);aa=s.a*(1-s.prog*0.6);}
          else{sc=s.s;aa=s.a;}
          ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.globalAlpha=aa;ctx.shadowBlur=14;ctx.shadowColor="#7c3aed";
          ctx.beginPath();ctx.moveTo(-12,-6);ctx.bezierCurveTo(-14,-22,14,-22,12,-6);ctx.bezierCurveTo(11,6,8,12,10,24);ctx.bezierCurveTo(5,18,2,22,0,28);ctx.bezierCurveTo(-2,22,-5,18,-10,24);ctx.bezierCurveTo(-8,12,-11,6,-12,-6);ctx.closePath();
          var sg=ctx.createRadialGradient(0,-6,1,0,2,26);sg.addColorStop(0,"rgba(70,32,125,0.95)");sg.addColorStop(0.6,"rgba(36,16,68,0.85)");sg.addColorStop(1,"rgba(12,4,28,0.15)");ctx.fillStyle=sg;ctx.fill();
          ctx.shadowBlur=10*s.glow;ctx.shadowColor="#c084fc";
          var _eyes=[-5,5];for(var ey2=0;ey2<2;ey2++){ctx.beginPath();ctx.ellipse(_eyes[ey2],-9,2,2.8,0,0,6.28);ctx.fillStyle="rgba(210,160,255,"+(0.5+0.5*s.glow)+")";ctx.fill();}
          ctx.beginPath();ctx.ellipse(0,0,2.6,4.5,0,0,6.28);ctx.fillStyle="rgba(8,2,20,0.85)";ctx.fill();
          ctx.restore();}
        if(pit){pit.life+=dt;var prk=Math.min(1,pit.life/500);if(prk<1){ctx.globalCompositeOperation="lighter";var fg=ctx.createRadialGradient(c.x,c.y+20*sz,0,c.x,c.y+20*sz,W*0.3);fg.addColorStop(0,"rgba(180,120,255,"+((1-prk)*0.5)+")");fg.addColorStop(1,"rgba(124,58,237,0)");ctx.beginPath();ctx.arc(c.x,c.y+20*sz,W*0.3,0,6.28);ctx.fillStyle=fg;ctx.fill();ctx.globalCompositeOperation="source-over";}}
        ctx.restore();
        if(!running&&(!pit||pit.life>600)&&impacts.length===0&&embers.length===0){clearTimeout(hardKill);if(!dealt&&deal){dealt=true;try{deal();}catch(e){}}done();return;}
        raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
    }catch(e){ try{if(deal){deal();}}catch(_){} }
  }

  /* ─────────── 时之君主·克罗诺斯之影 → 终焉时刻 ─────────── */
  function hbaChronosEnd(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect(), bcy=br.top+br.height*0.5;
      var clipBottom=barBot+16;
      var st=__hbaMapStage(0.48,bcy,1.0,midY,hx,1.25);
      var W=st.W,H=st.H,SX=st.SX,SY=st.SY;
      var maxEndY=clipBottom-SY;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var _clockFace=null;
      function getClockFace(){
        if(_clockFace){return _clockFace;}
        var S=160,oc=document.createElement('canvas');oc.width=S;oc.height=S;var o=oc.getContext('2d');
        o.translate(S/2,S/2);var r=S/2-5;
        o.beginPath();o.arc(0,0,r,0,6.28);o.fillStyle="#d6aa4a";o.fill();
        o.beginPath();o.arc(0,0,r*0.86,0,6.28);o.fillStyle="#fffaeb";o.fill();
        o.strokeStyle="rgba(90,70,30,0.85)";for(var i=0;i<12;i++){var ang=i*Math.PI/6;o.lineWidth=(i%3?1.4:2.8);o.beginPath();o.moveTo(Math.cos(ang)*r*0.78,Math.sin(ang)*r*0.78);o.lineTo(Math.cos(ang)*r*0.66,Math.sin(ang)*r*0.66);o.stroke();}
        _clockFace=oc;return oc;
      }
      function drawClock(x,y,r,hAng,mAng,a,stopped){
        var f=getClockFace();ctx.save();ctx.globalAlpha=a;ctx.drawImage(f,x-r,y-r,r*2,r*2);ctx.translate(x,y);ctx.lineCap="round";
        ctx.strokeStyle=stopped?"rgba(185,30,30,0.96)":"rgba(40,30,15,0.95)";ctx.lineWidth=2.6*sz;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(hAng)*r*0.42,Math.sin(hAng)*r*0.42);ctx.stroke();
        ctx.lineWidth=1.8*sz;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(mAng)*r*0.62,Math.sin(mAng)*r*0.62);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,2.2*sz,0,6.28);ctx.fillStyle="rgba(180,140,50,1)";ctx.fill();ctx.restore();
      }
      var clocks=[],sands=[],rings=[],shards=[],bigStrike=null;
      var t=0,last=0,running=true,freeze=0,goldFlash=0,sandReverse=false,dealt=false;
      var T_GATHER=520,T_FREEZE=520,T_FREEZE_END=760,T_SWEEP=780,T_REVERSE=1350,T_TOLL=2050,T_END=3350;
      function CEN(){return {x:W*0.5, y:H*0.48};}
      (function(){
        var c=CEN();var N=Math.round(9*Math.min(1.7,fxi));
        for(var i=0;i<N;i++){var ang=(i/N)*6.28+0.3;var R=(W*0.30+(i%2)*W*0.05)*sz;
          clocks.push({ox:c.x+Math.cos(ang)*R,oy:c.y+Math.sin(ang)*R*0.9,r:(26+Math.random()*16)*sz,hA:Math.random()*6.28,mA:Math.random()*6.28,hsp:(2+Math.random()*3)*(Math.random()<0.5?1:-1),msp:(5+Math.random()*4)*(Math.random()<0.5?1:-1),stopT:T_FREEZE+Math.random()*180,a:0,stopped:false,beamA:0,gone:false});}
        for(var k=0;k<Math.round(95*Math.min(1.8,fxi));k++){var ang2=Math.random()*6.28,R2=(60+Math.random()*W*0.34)*sz;
          sands.push({ang:ang2,R:R2,spd:(0.0006+Math.random()*0.001),sz:(0.8+Math.random()*1.8)*sz,a:0.4+Math.random()*0.5,fall:Math.random()*6.28});}
      })();
      var raf=0,dead=false;
      function done(){ if(dead){return;} dead=true; try{cancelAnimationFrame(raf);}catch(e){} if(cv&&cv.parentNode){cv.parentNode.removeChild(cv);} }
      var hardKill=setTimeout(done,5400);
      function frame(ts){
        if(dead){return;}
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        var c=CEN();
        if(running){t+=dt;
          if(t>=T_FREEZE&&t<T_FREEZE_END){freeze=1;if(goldFlash<0.5&&t<T_FREEZE+60){goldFlash=1;}}else{freeze=Math.max(0,freeze-dt/200);}
          if(t>=T_FREEZE&&t<T_FREEZE+90){if(rings.length===0){for(var ri=0;ri<2;ri++){rings.push({life:0,max:560+ri*120,r:6*sz,vr:(9+ri*3)*sz});}}}
          if(t>=T_REVERSE){sandReverse=true;}
          if(t>=T_TOLL&&!bigStrike){bigStrike={life:0};
            for(var ck0=0;ck0<clocks.length;ck0++){var ck=clocks[ck0];for(var q=0;q<8;q++){var ang=Math.random()*6.28,spd=(1.5+Math.random()*3.5)*sz;shards.push({x:ck.ox,y:ck.oy,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:0,max:520,sz:(1.3+Math.random()*1.8)*sz});}ck.gone=true;}}
          if(t>T_END&&(!bigStrike||bigStrike.life>1100)){running=false;}
        }
        goldFlash*=0.88;
        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();ctx.translate(SX,SY);
        /* 时之沙 */
        ctx.globalCompositeOperation="lighter";ctx.shadowBlur=0;
        var sandFade=t<T_TOLL?1:Math.max(0,1-(t-T_TOLL)/600);
        for(var isd=0;isd<sands.length;isd++){var s=sands[isd];if(!freeze){s.ang+=s.spd*dt*(sandReverse?-1.6:1);if(sandReverse){s.R=Math.max(2,s.R-dt*0.07*sz);}}
          var swirl=s.R+(sandReverse?0:Math.sin(t*0.002+s.fall)*8*sz);var sx2=c.x+Math.cos(s.ang)*swirl,sy2=c.y+Math.sin(s.ang)*swirl*0.92;
          var aa=s.a*(sandReverse&&s.R<14?(s.R/14):1)*sandFade;if(aa<=0.01){continue;}
          ctx.beginPath();ctx.arc(sx2,sy2,s.sz,0,6.28);ctx.fillStyle="rgba(255,228,150,"+aa.toFixed(2)+")";ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        /* 时钟 */
        for(var ick=0;ick<clocks.length;ick++){var ck2=clocks[ick];if(ck2.gone){continue;}ck2.a=Math.min(1,ck2.a+dt/300);
          if(!ck2.stopped){if(t>=ck2.stopT){ck2.stopped=true;var toC=Math.atan2(c.y-ck2.oy,c.x-ck2.ox);ck2.hA=toC-0.12;ck2.mA=toC+0.1;}else if(!freeze){ck2.hA+=ck2.hsp*dt*0.004*(t>T_GATHER?3:1);ck2.mA+=ck2.msp*dt*0.004*(t>T_GATHER?3:1);}}
          drawClock(ck2.ox,ck2.oy,ck2.r,ck2.hA,ck2.mA,ck2.a,ck2.stopped);}
        /* 定格金波纹环 */
        ctx.globalCompositeOperation="lighter";
        for(var ir=rings.length-1;ir>=0;ir--){var r=rings[ir];r.life+=dt;r.r+=r.vr*dt*0.06;var prr=r.life/r.max;if(prr>=1){rings.splice(ir,1);continue;}
          ctx.beginPath();ctx.arc(c.x,c.y,r.r,0,6.28);ctx.lineWidth=4*sz*(1-prr);ctx.strokeStyle="rgba(150,240,255,"+((1-prr)*0.8)+")";ctx.shadowBlur=14*sz;ctx.shadowColor="#22d3ee";ctx.stroke();}
        /* 钟表激光汇聚 */
        var convergeBurn=t<T_SWEEP?0:(t<T_TOLL?Math.min(1,(t-T_SWEEP)/520):Math.max(0,1-(t-T_TOLL)/300));
        ctx.globalCompositeOperation="lighter";
        for(var icl=0;icl<clocks.length;icl++){var ck3=clocks[icl];if(ck3.gone||t<T_SWEEP){continue;}
          var tgt=t<T_TOLL?1:Math.max(0,1-(t-T_TOLL)/250);ck3.beamA=Math.min(1,ck3.beamA+dt/280)*tgt;if(ck3.beamA<=0.02){continue;}
          var fire=Math.min(1,Math.max(0,(t-T_SWEEP)/200));var ex=ck3.ox+(c.x-ck3.ox)*fire,ey=ck3.oy+(c.y-ck3.oy)*fire;
          var flick=0.82+0.18*Math.sin(t*0.025+ck3.ox);
          var grad=ctx.createLinearGradient(ck3.ox,ck3.oy,ex,ey);grad.addColorStop(0,"rgba(255,205,95,"+(ck3.beamA*0.32)+")");grad.addColorStop(1,"rgba(185,245,255,"+(ck3.beamA*0.6*flick)+")");
          ctx.strokeStyle=grad;ctx.lineWidth=(1.8+convergeBurn*1.2)*sz;ctx.beginPath();ctx.moveTo(ck3.ox,ck3.oy);ctx.lineTo(ex,ey);ctx.stroke();
          ctx.strokeStyle="rgba(255,250,235,"+(ck3.beamA*0.8*flick)+")";ctx.lineWidth=(0.8+convergeBurn*0.5)*sz;ctx.beginPath();ctx.moveTo(ck3.ox,ck3.oy);ctx.lineTo(ex,ey);ctx.stroke();
          ctx.beginPath();ctx.arc(ex,ey,(2.4+convergeBurn*1.5)*sz,0,6.28);ctx.fillStyle="rgba(255,245,220,"+(ck3.beamA*0.85)+")";ctx.fill();}
        if(convergeBurn>0.01){var Rc=(9+convergeBurn*15)*sz*(1+Math.sin(t*0.014)*0.08);
          var gc=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,Rc);gc.addColorStop(0,"rgba(255,250,238,"+(convergeBurn*0.72)+")");gc.addColorStop(0.4,"rgba(255,205,115,"+(convergeBurn*0.55)+")");gc.addColorStop(0.75,"rgba(255,175,80,"+(convergeBurn*0.3)+")");gc.addColorStop(1,"rgba(103,232,249,0)");
          ctx.beginPath();ctx.arc(c.x,c.y,Rc,0,6.28);ctx.fillStyle=gc;ctx.fill();
          var g2=ctx.createRadialGradient(c.x,c.y,Rc*0.8,c.x,c.y,Rc*2.2);g2.addColorStop(0,"rgba(103,232,249,"+(convergeBurn*0.18)+")");g2.addColorStop(1,"rgba(103,232,249,0)");ctx.beginPath();ctx.arc(c.x,c.y,Rc*2.2,0,6.28);ctx.fillStyle=g2;ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        /* 时钟碎沙 */
        ctx.globalCompositeOperation="lighter";
        for(var ish=shards.length-1;ish>=0;ish--){var sh=shards[ish];sh.life+=dt;sh.vy+=0.02*dt*sz;sh.x+=sh.vx*dt*0.06;sh.y+=sh.vy*dt*0.06;var prs=sh.life/sh.max;if(prs>=1){shards.splice(ish,1);continue;}
          ctx.beginPath();ctx.arc(sh.x,sh.y,sh.sz*(1-prs*0.3),0,6.28);ctx.fillStyle="rgba(255,224,140,"+((1-prs)*0.9)+")";ctx.shadowBlur=6;ctx.shadowColor="#ffd27a";ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        /* 终焉·汇能轰击: 炽核蓄满→贯穿梯形激光打向勇者(钳位答题区上方) */
        if(bigStrike){bigStrike.life+=dt;var L=bigStrike.life;var cx=c.x,cy=c.y;
          var charge=Math.min(1,L/170);var fireP=L<170?0:Math.min(1,(L-170)/150);var beamFade=L<170?0:(L<720?1:Math.max(0,1-(L-720)/320));
          if(fireP>0.5&&!dealt){dealt=true;if(deal){try{deal();}catch(e){}}}
          ctx.globalCompositeOperation="lighter";
          var flash=L<170?charge:Math.max(0,1-(L-170)/280);
          if(flash>0.01){var fr=(18+charge*24)*sz;var fg=ctx.createRadialGradient(cx,cy,0,cx,cy,fr*2.4);fg.addColorStop(0,"rgba(255,255,252,"+(flash*0.95)+")");fg.addColorStop(0.35,"rgba(255,228,150,"+(flash*0.72)+")");fg.addColorStop(0.7,"rgba(103,232,249,"+(flash*0.36)+")");fg.addColorStop(1,"rgba(103,232,249,0)");ctx.beginPath();ctx.arc(cx,cy,fr*2.4,0,6.28);ctx.fillStyle=fg;ctx.fill();}
          if(beamFade>0.01){var endY=Math.min(cy+(H+80-cy)*fireP, maxEndY);
            var wTop=(9+9*beamFade)*sz, wBot=(26+40*beamFade)*sz;
            var bg=ctx.createLinearGradient(cx,cy,cx,endY);bg.addColorStop(0,"rgba(255,235,150,"+(beamFade*0.8)+")");bg.addColorStop(1,"rgba(255,198,88,"+(beamFade*0.5)+")");
            ctx.beginPath();ctx.moveTo(cx-wTop,cy);ctx.lineTo(cx+wTop,cy);ctx.lineTo(cx+wBot,endY);ctx.lineTo(cx-wBot,endY);ctx.closePath();ctx.fillStyle=bg;ctx.fill();
            ctx.beginPath();ctx.moveTo(cx-wTop*0.42,cy);ctx.lineTo(cx+wTop*0.42,cy);ctx.lineTo(cx+wBot*0.42,endY);ctx.lineTo(cx-wBot*0.42,endY);ctx.closePath();ctx.fillStyle="rgba(255,255,250,"+(beamFade*0.9)+")";ctx.fill();
            ctx.strokeStyle="rgba(103,232,249,"+(beamFade*0.45)+")";ctx.lineWidth=2*sz;ctx.beginPath();ctx.moveTo(cx-wTop,cy);ctx.lineTo(cx-wBot,endY);ctx.moveTo(cx+wTop,cy);ctx.lineTo(cx+wBot,endY);ctx.stroke();
            if(fireP>0.5){var iy=Math.min(endY,maxEndY);var irr=(24+beamFade*46)*sz;var ig=ctx.createRadialGradient(cx,iy,0,cx,iy,irr);ig.addColorStop(0,"rgba(255,252,242,"+(beamFade*0.9)+")");ig.addColorStop(0.4,"rgba(255,210,120,"+(beamFade*0.55)+")");ig.addColorStop(1,"rgba(255,180,80,0)");ctx.beginPath();ctx.arc(cx,iy,irr,0,6.28);ctx.fillStyle=ig;ctx.fill();}}
          ctx.globalCompositeOperation="source-over";}
        /* 定格全屏金罩已删(零屏闪)。goldFlash 局部辉光保留 */
        if(goldFlash>0.02&&!bigStrike){var gf=ctx.createRadialGradient(c.x,c.y,0,c.x,c.y,W*0.55);gf.addColorStop(0,"rgba(255,245,210,"+(goldFlash*0.45)+")");gf.addColorStop(0.5,"rgba(180,240,255,"+(goldFlash*0.2)+")");gf.addColorStop(1,"rgba(255,210,110,0)");
          ctx.globalCompositeOperation="lighter";ctx.beginPath();ctx.arc(c.x,c.y,W*0.55,0,6.28);ctx.fillStyle=gf;ctx.fill();ctx.globalCompositeOperation="source-over";}
        ctx.restore();
        if(!running&&(!bigStrike||bigStrike.life>1100)&&shards.length===0){clearTimeout(hardKill);if(!dealt&&deal){dealt=true;try{deal();}catch(e){}}done();return;}
        raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
    }catch(e){ try{if(deal){deal();}}catch(_){} }
  }

  /* ─────────── 统御天使·圣光之翼 → 圣光裁决 ─────────── */
  function hbaLightJudge(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect(), bcy=br.top+br.height*0.5;
      var clipBottom=barBot+16;
      var st=__hbaMapStage(0.5,bcy,0.86,midY,hx,1.25);
      var W=st.W,H=st.H,SX=st.SX,SY=st.SY;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      function groundY(){return H*0.86;}
      function drawFeather(x,y,s,rot,a){
        ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(s,s);ctx.globalAlpha=a;
        ctx.beginPath();ctx.moveTo(0,-9);ctx.bezierCurveTo(4,-4,4,5,0,11);ctx.bezierCurveTo(-4,5,-4,-4,0,-9);ctx.closePath();
        var g=ctx.createLinearGradient(0,-9,0,11);g.addColorStop(0,"rgba(255,252,240,"+a+")");g.addColorStop(1,"rgba(255,228,150,"+(a*0.7)+")");ctx.fillStyle=g;ctx.fill();
        ctx.strokeStyle="rgba(255,210,120,"+(a*0.5)+")";ctx.lineWidth=0.6;ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(0,10);ctx.stroke();ctx.restore();
      }
      var pillars=[],feathers=[],motes=[],impacts=[],halo=0,haloRot=0,arrayA=0,arrayRot=0,radiance=0,giant=null;
      var t=0,last=0,running=true,dealt=false;
      var T_DESCEND=600,T_LOCK=1000,T_RAIN=1080,T_JUDGE=2200,T_FADE=2780,T_END=3450;
      function CEN(){return {x:W*0.5, y:H*0.5};}
      function spawnFeather(delay){feathers.push({x:Math.random()*W,y:-20-Math.random()*60,vx:(Math.random()-0.5)*0.4,vy:(0.5+Math.random()*0.8),rot:Math.random()*6.28,vr:(Math.random()-0.5)*0.04,s:(0.7+Math.random()*0.8)*sz,sway:Math.random()*6.28,t0:t+delay,a:0});}
      function spawnMote(){var gy=groundY();motes.push({x:Math.random()*W,y:gy-Math.random()*20,vy:-(0.3+Math.random()*0.9)*sz,life:0,max:900+Math.random()*500,r:(1+Math.random()*2)*sz});}
      (function(){
        var np=Math.round(16*Math.min(1.7,fxi));
        for(var i=0;i<np;i++){var x=(i+0.5)/np*W+(Math.random()-0.5)*30;
          pillars.push({x:x,t0:T_RAIN+Math.random()*(T_JUDGE-T_RAIN-200),w:(10+Math.random()*16)*sz,life:0,dur:560+Math.random()*200,landed:false});}
        for(var k=0;k<Math.round(18*fxi);k++){spawnFeather(Math.random()*900);}
      })();
      var raf=0,dead=false;
      function done(){ if(dead){return;} dead=true; try{cancelAnimationFrame(raf);}catch(e){} if(cv&&cv.parentNode){cv.parentNode.removeChild(cv);} }
      var hardKill=setTimeout(done,5400);
      function frame(ts){
        if(dead){return;}
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        var c=CEN(),gy=groundY();
        if(running){t+=dt;haloRot+=dt*0.0009;arrayRot+=dt*0.0011;
          halo=t<T_FADE?Math.min(1,t/T_DESCEND):Math.max(0,1-(t-T_FADE)/400);
          radiance=t<T_FADE?Math.min(1,t/T_DESCEND):Math.max(0,radiance-dt/450);
          arrayA=t<T_LOCK?0:(t<T_FADE?Math.min(1,(t-T_LOCK)/300):Math.max(0,1-(t-T_FADE)/350));
          if(t>=T_DESCEND&&Math.random()<0.5*fxi){spawnMote();}
          if(t>=T_RAIN&&t<T_JUDGE&&Math.random()<0.25*fxi){spawnFeather(0);}
          if(t>=T_JUDGE&&!giant){giant={life:0};for(var gi=0;gi<Math.round(16*fxi);gi++){spawnFeather(0);}}
          if(t>T_END){running=false;}
        }
        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();ctx.translate(SX,SY);
        /* 圣光铺底 radiance(稳态局部辉光氛围·非屏闪) */
        if(radiance>0.01){var g=ctx.createRadialGradient(c.x,H*0.42,0,c.x,H*0.42,Math.max(W,H)*0.7);
          g.addColorStop(0,"rgba(255,245,205,"+(radiance*0.16)+")");g.addColorStop(0.5,"rgba(255,228,150,"+(radiance*0.07)+")");g.addColorStop(1,"rgba(255,210,110,0)");ctx.fillStyle=g;ctx.fillRect(0,0,W,gy+H*0.16);}
        /* 地面圣光裁决法阵 */
        if(arrayA>0.01){ctx.save();ctx.translate(c.x,gy);ctx.scale(1,0.32);ctx.globalAlpha=arrayA;
          ctx.strokeStyle="rgba(255,225,140,0.9)";ctx.shadowBlur=16;ctx.shadowColor="#ffd27a";
          ctx.save();ctx.rotate(arrayRot);var _arr=[W*0.34,W*0.26,W*0.17];for(var ia=0;ia<_arr.length;ia++){ctx.lineWidth=2.4*sz;ctx.beginPath();ctx.arc(0,0,_arr[ia],0,6.28);ctx.stroke();}
          ctx.lineWidth=1.8*sz;for(var kk=0;kk<12;kk++){var a2=kk*6.28/12;ctx.beginPath();ctx.moveTo(Math.cos(a2)*W*0.17,Math.sin(a2)*W*0.17);ctx.lineTo(Math.cos(a2)*W*0.34,Math.sin(a2)*W*0.34);ctx.stroke();}ctx.restore();
          ctx.save();ctx.rotate(-arrayRot*1.4);ctx.lineWidth=2*sz;ctx.beginPath();ctx.arc(0,0,W*0.215,0,6.28);ctx.stroke();ctx.restore();
          ctx.restore();}
        /* 上升金尘 */
        ctx.globalCompositeOperation="lighter";
        for(var im=motes.length-1;im>=0;im--){var m=motes[im];m.life+=dt;m.y+=m.vy*dt*0.05;var prm=m.life/m.max;if(prm>=1){motes.splice(im,1);continue;}
          ctx.beginPath();ctx.arc(m.x,m.y,m.r,0,6.28);ctx.fillStyle="rgba(255,235,160,"+((1-prm)*0.6)+")";ctx.fill();}
        ctx.globalCompositeOperation="source-over";
        /* 万道光柱天降 */
        ctx.globalCompositeOperation="lighter";
        for(var ip=0;ip<pillars.length;ip++){var p=pillars[ip];if(t<p.t0){continue;}p.life+=dt;var prp=p.life/p.dur;if(prp>=1){continue;}
          var drop=Math.min(1,(p.life)/130);var leadY=gy*drop;var fade=prp<0.55?1:(1-prp)/0.45;
          var half=p.w*fade;
          var bg=ctx.createLinearGradient(p.x-half,0,p.x+half,0);bg.addColorStop(0,"rgba(255,225,140,0)");bg.addColorStop(0.5,"rgba(255,250,230,"+(fade*0.85)+")");bg.addColorStop(1,"rgba(255,225,140,0)");
          ctx.fillStyle=bg;ctx.fillRect(p.x-half,0,half*2,leadY);
          var cw=half*0.32;var wg=ctx.createLinearGradient(p.x-cw,0,p.x+cw,0);wg.addColorStop(0,"rgba(255,255,250,0)");wg.addColorStop(0.5,"rgba(255,255,252,"+fade+")");wg.addColorStop(1,"rgba(255,255,250,0)");
          ctx.fillStyle=wg;ctx.fillRect(p.x-cw,0,cw*2,leadY);
          if(drop>=1&&!p.landed){p.landed=true;impacts.push({x:p.x,y:gy,life:0,max:380,r:0,w:p.w});}
        }
        for(var ii=impacts.length-1;ii>=0;ii--){var iim=impacts[ii];iim.life+=dt;var pri=iim.life/iim.max;iim.r=pri*iim.w*4*sz;if(pri>=1){impacts.splice(ii,1);continue;}
          var ig=ctx.createRadialGradient(iim.x,iim.y,0,iim.x,iim.y,Math.max(1,iim.r));ig.addColorStop(0,"rgba(255,250,235,"+((1-pri)*0.8)+")");ig.addColorStop(0.5,"rgba(255,220,130,"+((1-pri)*0.4)+")");ig.addColorStop(1,"rgba(255,210,110,0)");
          ctx.beginPath();ctx.ellipse(iim.x,iim.y,iim.r,iim.r*0.4,0,0,6.28);ctx.fillStyle=ig;ctx.fill();
          ctx.strokeStyle="rgba(255,240,180,"+((1-pri)*0.7)+")";ctx.lineWidth=2*sz*(1-pri);ctx.beginPath();ctx.ellipse(iim.x,iim.y,iim.r,iim.r*0.4,0,0,6.28);ctx.stroke();}
        ctx.globalCompositeOperation="source-over";
        /* 头顶三重金环 */
        if(halo>0.01){var hxh=c.x,hyh=H*0.5-W*0.52*0.5*0.86;ctx.save();ctx.translate(hxh,hyh);ctx.globalAlpha=halo;ctx.globalCompositeOperation="lighter";
          for(var rr=0;rr<3;rr++){var ry=(W*0.10-rr*W*0.018)*sz;ctx.save();ctx.rotate(haloRot*(rr%2?-1:1));ctx.scale(1,0.30);
            ctx.lineWidth=(3.4-rr*0.6)*sz;ctx.strokeStyle="rgba(255,225,140,"+(0.85-rr*0.12)+")";ctx.shadowBlur=14;ctx.shadowColor="#ffd27a";ctx.beginPath();ctx.arc(0,0,ry,0,6.28);ctx.stroke();ctx.restore();}
          ctx.restore();}
        /* 终末审判·擎天巨柱 */
        if(giant){giant.life+=dt;var L=giant.life;var drop2=Math.min(1,L/220);var leadY2=gy*drop2;var fade2=L<900?1:Math.max(0,1-(L-900)/450);
          if(L>=220&&!dealt){dealt=true;if(deal){try{deal();}catch(e){}}}
          ctx.globalCompositeOperation="lighter";
          var half2=(W*0.13)*sz*fade2*(1+Math.sin(L*0.01)*0.04);
          var bg2=ctx.createLinearGradient(c.x-half2,0,c.x+half2,0);bg2.addColorStop(0,"rgba(255,225,140,0)");bg2.addColorStop(0.3,"rgba(255,245,200,"+(fade2*0.5)+")");bg2.addColorStop(0.5,"rgba(255,255,250,"+(fade2*0.9)+")");bg2.addColorStop(0.7,"rgba(255,245,200,"+(fade2*0.5)+")");bg2.addColorStop(1,"rgba(255,225,140,0)");
          ctx.fillStyle=bg2;ctx.fillRect(c.x-half2,0,half2*2,leadY2);
          if(drop2>=1){var sp2=Math.min(1,(L-220)/350);var gw=W*0.5*sp2*sz;
            var gg=ctx.createRadialGradient(c.x,gy,0,c.x,gy,Math.max(1,gw));gg.addColorStop(0,"rgba(255,252,240,"+(fade2*0.75)+")");gg.addColorStop(0.5,"rgba(255,225,140,"+(fade2*0.4)+")");gg.addColorStop(1,"rgba(255,210,110,0)");
            ctx.beginPath();ctx.ellipse(c.x,gy,gw,gw*0.34,0,0,6.28);ctx.fillStyle=gg;ctx.fill();}
          ctx.globalCompositeOperation="source-over";}
        /* 前景圣羽飘落 */
        for(var iff=0;iff<feathers.length;iff++){var f=feathers[iff];if(t<f.t0){continue;}f.a=Math.min(1,f.a+dt/300);f.sway+=dt*0.004;f.x+=(f.vx+Math.sin(f.sway)*0.4)*dt*0.05*sz;f.y+=f.vy*dt*0.05*sz;f.rot+=f.vr*dt;
          var aa=f.a;if(f.y>gy){aa*=Math.max(0,1-(f.y-gy)/40);}if(t>=T_FADE){aa*=Math.max(0,1-(t-T_FADE)/400);}
          if(aa<=0.02){continue;}drawFeather(f.x,f.y,f.s,f.rot,aa*0.9);}
        /* 审判全屏白闪已删(零屏闪)。审判由擎天巨柱表现 */
        ctx.restore();
        if(!running&&impacts.length===0&&(!giant||giant.life>1400)){clearTimeout(hardKill);if(!dealt&&deal){dealt=true;try{deal();}catch(e){}}done();return;}
        raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
    }catch(e){ try{if(deal){deal();}}catch(_){} }
  }

  function __hbaSbBurst(ctx,x,y,R,a,col){ctx.save();ctx.translate(x,y);ctx.globalCompositeOperation="lighter";var g=ctx.createRadialGradient(0,0,0,0,0,R);g.addColorStop(0,"rgba(255,255,255,"+a+")");g.addColorStop(0.32,col);g.addColorStop(1,"rgba(10,4,4,0)");ctx.beginPath();ctx.arc(0,0,R,0,6.28);ctx.fillStyle=g;ctx.fill();ctx.restore();}
  /* ───── 终末观测者·边界守夜人 → 星图烙印(v803) ─────
     星点逐个亮→星座连线一笔笔画across连到勇者→火花沿线游走逐点引爆→勇者处终爆。网状连线引爆·非光束。
     零震屏·零全屏闪·纯canvas无外部图·答题区零侵犯(clip到barBot+16) */
  function hbaStarBrand(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=(fx&&fx.sz)||1, fxi=(fx&&fx.fxi)||1, sp=(fx&&fx.sp)||1;
      var br=bsEl.getBoundingClientRect();
      var clipBottom=barBot+16;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var ex=br.left+br.width/2, ey=br.top+br.height*0.46;   // 星图起点(boss·义眼处)
      var tgx=hx, tgy=midY;                                    // 终点(勇者血条)
      var amp=Math.min(vw*0.16, 64*sz);                        // 连线横向摆幅
      var N=Math.round(9+(fxi>1.2?2:0)), i, nodes=[];
      var sy0=ey+(tgy-ey)*0.06;
      for(i=0;i<N;i++){var p=i/(N-1);
        var x=ex+(tgx-ex)*p + Math.sin(p*8+1)*amp*(1-p*0.4)*((i%2)?1:-1);
        var y=sy0+(tgy-sy0)*p;
        if(x<8){x=8;} if(x>vw-8){x=vw-8;}
        nodes.push({x:x,y:y,det:0});}
      nodes[N-1].x=tgx; nodes[N-1].y=tgy;
      var segs=N-1;
      var T_DRAW0=300, perSeg=120, IG_GAP=160, igSpeed=100, T_END=3500;
      var t=0,last=0,running=true,spark=0,fin=false,finT=0,dealt=false,raf=0,dead=false;
      function fireDeal(){ if(dealt){return;} dealt=true; if(deal){try{deal();}catch(e){}} }
      function done(){ if(dead){return;} dead=true; try{cancelAnimationFrame(raf);}catch(e){} if(cv&&cv.parentNode){cv.parentNode.removeChild(cv);} }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5200);
      function frame(ts){
        if(dead){return;}
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){t+=dt;}
        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();
        ctx.globalCompositeOperation="lighter";
        /* 义眼蓄光(短暂) */
        var eg=(t<800)?(Math.min(1,t/300)*(1-Math.max(0,(t-450)/350)*0.5)):0;
        if(eg>0.02){var g0=ctx.createRadialGradient(ex,ey,0,ex,ey,(14+eg*8)*sz);g0.addColorStop(0,"rgba(180,240,255,"+(eg*0.85)+")");g0.addColorStop(0.4,"rgba(95,216,255,"+(eg*0.5)+")");g0.addColorStop(1,"rgba(34,211,238,0)");ctx.beginPath();ctx.arc(ex,ey,(14+eg*8)*sz,0,6.28);ctx.fillStyle=g0;ctx.fill();}
        var drawnSegs=Math.max(0,(t-T_DRAW0)/perSeg);
        /* 连线(逐段画·已点火段变红) */
        for(i=0;i<segs;i++){var a=nodes[i],b2=nodes[i+1];var frac=Math.min(1,drawnSegs-i);if(frac<=0){continue;}
          var ign=spark>i+0.5;
          ctx.strokeStyle=ign?"rgba(255,90,74,0.9)":"rgba(95,216,255,0.5)";ctx.lineWidth=(ign?2.2:1.3)*sz;ctx.shadowBlur=ign?12:6;ctx.shadowColor=ign?"#ef4444":"#22d3ee";
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+(b2.x-a.x)*frac,a.y+(b2.y-a.y)*frac);ctx.stroke();}
        /* 星点 + 引爆 */
        for(i=0;i<N;i++){var n=nodes[i];var show=(i===0)?(t>T_DRAW0*0.3):(drawnSegs>(i-1));if(!show){continue;}
          var rr=(n.det>0?2+n.det*6:2)*sz;ctx.beginPath();ctx.arc(n.x,n.y,rr,0,6.28);ctx.fillStyle=n.det>0?"rgba(255,205,185,1)":"#eaf6ff";ctx.shadowBlur=n.det>0?14:7;ctx.shadowColor=n.det>0?"#ef4444":"#22d3ee";ctx.fill();
          if(n.det>0){ __hbaSbBurst(ctx,n.x,n.y,(8+n.det*22)*sz,Math.max(0,n.det),"rgba(255,140,110,0.9)"); n.det-=dt/300; if(n.det<0){n.det=0;} }}
        /* 点火沿线游走逐点引爆 */
        var fullT=T_DRAW0+segs*perSeg;
        if(t>fullT+IG_GAP){var prev=spark;spark=(t-(fullT+IG_GAP))/igSpeed;
          for(var k=Math.ceil(prev);k<=Math.floor(spark)&&k<N;k++){ if(nodes[k]){nodes[k].det=1;} }
          if(spark<N-0.5){var fi=Math.floor(spark),fr=spark-fi;if(fi<N-1){var a3=nodes[fi],b3=nodes[fi+1];__hbaSbBurst(ctx,a3.x+(b3.x-a3.x)*fr,a3.y+(b3.y-a3.y)*fr,16*sz,0.9,"rgba(255,232,205,0.95)");}}
          if(spark>=N-1&&!fin){fin=true;finT=0;fireDeal();}}
        /* 目标终爆 */
        if(fin){finT+=dt;var tg=nodes[N-1];__hbaSbBurst(ctx,tg.x,tg.y,(28+Math.min(1,finT/150)*50)*sz,Math.max(0,1-finT/440),"rgba(255,120,100,0.95)");
          var rsh=Math.min(1,finT/300)*vw*0.14,ra=Math.max(0,1-finT/440);ctx.save();ctx.translate(tg.x,tg.y);ctx.scale(1,0.6);ctx.strokeStyle="rgba(255,140,110,"+ra+")";ctx.lineWidth=3*sz*ra;ctx.shadowBlur=12;ctx.shadowColor="#ef4444";ctx.beginPath();ctx.arc(0,0,rsh,0,6.28);ctx.stroke();ctx.restore();}
        ctx.globalCompositeOperation="source-over";
        ctx.restore();
        if(t>T_END){running=false;}
        if(fin&&finT>620){clearTimeout(hardKill);fireDeal();done();return;}
        raf=requestAnimationFrame(frame);
      }
      raf=requestAnimationFrame(frame);
    }catch(e){ try{if(deal){deal();}}catch(_e){} }
  }
  function playFx(fx,bs,hs,deal){
    var bc=centerOf(bs),hc=centerOf(hs),t=fx.t;
    try{ hc.x=bc.x; }catch(e){}  /* 🔴 v614(Hansen): 大招命中中心x锁 boss 自己中线(bc=boss立绘水平中心·即boss精度十字线·而非血条中央/屏幕中心)·特效以boss自身为中心展示·随boss对齐 */
    if(t==='slash'){
      setTimeout(function(){slashMark(hc.x,hc.y,fx.color,fx.n||3,fx.big);if(fx.tint)tintOverlay(fx.tint);deal();},120);return;
    }
    if(t==='slam'){
      var w=makeWeapon(fx.weapon);w.style.left=bc.x+'px';var topY=bc.y-22;w.style.top=topY+'px';
      var reach=hc.y-(topY+w._impY)+4;w.style.setProperty('--reach',reach+'px');
      if(fx.weapon==='mechfist'){
        // 🔴 v508: Hansen 定稿——拳头新图(赛博机械拳套·200%)。定位模型: 指节(impY)砸下时精确落勇者中心; 起点高度=拳头从勇者上方多少px处开始(--startY=-startH); 小变大(起始30%→满)·砸中后原地淡出。大小200%·起点300px·速度0.8s(均可在 FX 配置调)。
        var imp=w._impY, fdur=fx.dur||0.8, sH=fx.startH||100;
        w.style.left=hc.x+'px';
        w.style.top=(hc.y-imp)+'px';                 // translateY(0)·scale1 时指节落 hc.y
        w.style.setProperty('--reach','0px');
        w.style.setProperty('--startY',(-sH)+'px');  // 起点在勇者上方 sH px(高处)
        w.style.setProperty('--startScale','0.3');
        w.style.setProperty('--fistdur',fdur+'s');
        add(w);rm(w,Math.round(fdur*1000)+120);
        setTimeout(function(){slamImpact(hc.x,hc.y,fx.impact);deal();},Math.round(fdur*1000*0.5));
      } else {
        add(w);rm(w,540);
        setTimeout(function(){slamImpact(hc.x,hc.y,fx.impact);deal();},210);
      }
      return;
    }
    if(t==='carpet'){
      var cp=makeCarpet();cp.style.left=bc.x+'px';cp.style.top=(bc.y+10)+'px';cp.style.transform='translate(-50%,-50%) translate(0,0) scale(.6)';
      add(cp);void cp.offsetWidth;var dx=hc.x-bc.x,dy=hc.y-(bc.y+10);
      requestAnimationFrame(function(){cp.style.transform='translate(-50%,-50%) translate('+dx+'px,'+dy+'px) scale(1.15)';});
      setTimeout(function(){rm(cp,0);slamImpact(hc.x,hc.y,'rgba(168,85,247,.85)');tintOverlay('rgba(168,85,247,.32)');deal();},340);return;
    }
    if(t==='tentacles'){
      tentaclesRise();setTimeout(function(){tintOverlay('rgba(20,184,166,.34)');deal();},200);return;
    }
    if(t==='drain'){
      drainEffect(hc.x,hc.y,bc.y);setTimeout(function(){tintOverlay('rgba(220,38,38,.42)');deal();},200);return;
    }
    if(t==='firebreath'){
      fireBreath(bc.x,bc.y,hc.y);setTimeout(function(){slamImpact(hc.x,hc.y,'rgba(249,115,22,.9)');tintOverlay('rgba(249,115,22,.4)');deal();},300);return;
    }
    // 🔴 v552: 淘气小幽灵(Lv1)——淘气捉迷藏(Hansen: 按形象台词做到非常好·可爱淘气不吓人)。台词三象逐句可视化——
    //   "飘飘飘!抓不到我~"→3 个半透明小幽灵虚影(lv01 立绘+蓝灵光)在屏上三处错峰飘现又消失(捉迷藏);
    //   "嘿嘿 我可不怕你!"→每个虚影消失瞬间弹出一颗幽灵嘟嘟弹(白蓝灵球), S 形飘向勇者(幽灵攻击飘飘忽忽不走直线), 错峰命中小灵光涟漪+泡泡;
    //   "呜~ 来抓我呀!"→本体大虚影 S 形飘扑贴脸做鬼脸(放大+wiggle 两下), "啵"撞血条: 灵光大涟漪+8 幽灵泡泡上飘+4 小星星+得逞溜走→deal。
    //   不变量: 零震屏零屏闪(不用 tintOverlay) / 全 fixed 贴 __hansenFxLayer / hba-gp 前缀 / 立绘图浏览器原生缓存 / deal 兜底 dealDelay。
    if(t==='ghostprank'){
      var gpbar=document.querySelector('.hero-hp-bar'), gpx,gpy;
      if(gpbar){ var gpbr=gpbar.getBoundingClientRect(); gpx=bc.x; gpy=gpbr.top+gpbr.height/2; }
      else { gpx=hc.x; gpy=hc.y; }
      var gsz=fx.sz||1, gsp=fx.sp||1, gfxi=fx.fxi||1;
      var GT=function(ms){return Math.round(ms/gsp);};
      var gvw=window.innerWidth, gvh=window.innerHeight;
      function gpEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
      // S 形飘行关键帧(主位移 + 垂直正弦横摆衰减)
      function gpSFly(el, fromX, fromY, toX, toY, dur, amp, easing){
        var dx=toX-fromX, dy=toY-fromY, len=Math.sqrt(dx*dx+dy*dy)||1;
        var px=-dy/len, py=dx/len;  // 垂直单位向量
        var kf=[]; var offs=[0,.18,.36,.54,.72,.88,1];
        for(var i=0;i<offs.length;i++){ var t=offs[i];
          var sway=Math.sin(t*Math.PI*2.5)*amp*(1-t*0.55);
          kf.push({transform:'translate(calc(-50% + '+(dx*t+px*sway).toFixed(1)+'px), calc(-50% + '+(dy*t+py*sway).toFixed(1)+'px))', offset:t});
        }
        kf[0].opacity=0; kf[1].opacity=1; kf[kf.length-1].opacity=1;
        try{ el.animate(kf,{duration:dur,easing:easing||'ease-in-out',fill:'forwards'}); }catch(e){ el.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px))'; }
      }
      // 命中小灵光: 涟漪环 + 2 泡泡上飘
      function gpHit(x,y,small){
        var rp=gpEl('hba-gpripple',x,y,Math.round((small?30:52)*gfxi)); void rp.offsetWidth; rp.classList.add('go'); rm(rp,460);
        var nb=small?2:8;
        for(var bi=0;bi<nb;bi++){ var bsz=small?(7+Math.random()*5):(8+Math.random()*8);
          var bb=gpEl('hba-gpbubble',x+(Math.random()-.5)*(small?22:54),y+(Math.random()-.5)*10,bsz);
          var bdx=(Math.random()-.5)*(small?26:60), bdy=-(22+Math.random()*(small?20:42));
          try{ bb.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.95},{transform:'translate(calc(-50% + '+(bdx*0.6)+'px), calc(-50% + '+(bdy*0.6)+'px)) scale(1)',opacity:.85,offset:.55},{transform:'translate(calc(-50% + '+bdx+'px), calc(-50% + '+bdy+'px)) scale(.85)',opacity:0}],{duration:560+Math.random()*180,easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(bb,800); }
        if(!small){ for(var si2=0;si2<4;si2++){ var st2=gpEl('hba-gpstar',x+(Math.random()-.5)*46,y+(Math.random()-.5)*16); st2.textContent='\u2726';
          var sdx2=(Math.random()-.5)*72, sdy2=-(26+Math.random()*36), srot=(Math.random()-.5)*220;
          try{ st2.animate([{transform:'translate(-50%,-50%) scale(.4) rotate(0deg)',opacity:1},{transform:'translate(calc(-50% + '+sdx2+'px), calc(-50% + '+sdy2+'px)) scale(1) rotate('+srot+'deg)',opacity:0}],{duration:620,easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(st2,680); } }
        if(gpbar){ gpbar.classList.add('hsn-bite-glow'); setTimeout(function(){gpbar.classList.remove('hsn-bite-glow');},small?160:240); }
      }
      // ①+② 三个虚影捉迷藏 + 各弹一颗 S 形嘟嘟弹
      var gpos=[ {x:bc.x-118,y:bc.y+44}, {x:bc.x+102,y:bc.y-30}, {x:bc.x-58,y:bc.y+96} ];
      for(var gi=0;gi<3;gi++){ (function(i){
        var pp=gpos[i];
        pp.x=Math.max(56,Math.min(gvw-56,pp.x)); pp.y=Math.max(72,Math.min(gvh-130,pp.y));
        setTimeout(function(){
          var ph=gpEl('hba-gpphantom', pp.x, pp.y, Math.round(92*gsz), Math.round(92*gsz));
          ph.innerHTML='<img src="bosses/lv01.webp?v=908" alt="" draggable="false">';
          try{ ph.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(8px) scale(.78)'},{opacity:.6,transform:'translate(-50%,-50%) translateY(-4px) scale(1)',offset:.4},{opacity:.55,transform:'translate(-50%,-50%) translateY(2px) scale(.98)',offset:.7},{opacity:0,transform:'translate(-50%,-50%) translateY(-9px) scale(.86)'}],{duration:GT(380),easing:'ease-in-out',fill:'forwards'}); }catch(e){}
          rm(ph,GT(430));
        }, GT(120+i*200));
        setTimeout(function(){
          var ob=gpEl('hba-gporb', pp.x, pp.y, Math.round(26*gsz));
          gpSFly(ob, pp.x, pp.y, gpx+(Math.random()-.5)*22, gpy, GT(520), 26, 'cubic-bezier(.5,.1,.6,.9)');
          setTimeout(function(){ rm(ob,0); gpHit(gpx+(Math.random()-.5)*20, gpy, true); }, GT(520));
        }, GT(400+i*200));
      })(gi); }
      // ③ 本体大虚影 S 形飘扑 → 贴脸鬼脸 → "啵"命中 → 得逞溜走 → deal
      setTimeout(function(){
        var startX=(bc.x<gvw*0.5)?(gvw-70):70, startY=Math.max(90,bc.y-40);
        var BW=Math.round(128*gsz);
        var body=gpEl('hba-gpphantom big', startX, startY, BW, BW);
        body.innerHTML='<img src="bosses/lv01.webp?v=908" alt="" draggable="false">';
        var faceX=gpx, faceY=Math.max(96,gpy-58);
        gpSFly(body, startX, startY, faceX, faceY, GT(480), 34, 'cubic-bezier(.45,.05,.6,.9)');
        setTimeout(function(){
          // 贴脸鬼脸: 放大 + wiggle 两下
          try{ body.animate([{transform:'translate(-50%,-50%) scale(1) rotate(0deg)'},{transform:'translate(-50%,-50%) scale(1.16) rotate(-8deg)',offset:.3},{transform:'translate(-50%,-50%) scale(1.16) rotate(8deg)',offset:.6},{transform:'translate(-50%,-50%) scale(1.1) rotate(0deg)'}],{duration:GT(230),easing:'ease-in-out',fill:'forwards'}); }catch(e){}
        }, GT(490));
        setTimeout(function(){
          // "啵"——下扑撞血条
          try{ body.animate([{transform:'translate(-50%,-50%) scale(1.1)'},{transform:'translate(calc(-50%), calc(-50% + '+(gpy-faceY-8)+'px)) scale(.92)'}],{duration:GT(130),easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'}); }catch(e){}
        }, GT(740));
        setTimeout(function(){
          gpHit(gpx,gpy,false);
          deal();
          // 得逞溜走: 上飘淡出
          try{ body.animate([{transform:'translate(calc(-50%), calc(-50% + '+(gpy-faceY-8)+'px)) scale(.92)',opacity:.85},{transform:'translate(calc(-50% + 26px), calc(-50% + '+(gpy-faceY-66)+'px)) scale(.7) rotate(10deg)',opacity:0}],{duration:GT(380),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(body,GT(430));
        }, GT(880));
      }, GT(1150));
      return;
    }
    if(t==='ghost'){
      var g=makeGhost();g.style.left=bc.x+'px';g.style.top=(bc.y+10)+'px';g.style.transform='translate(-50%,-50%) translate(0,0) scale(.5)';
      add(g);void g.offsetWidth;var gx=hc.x-bc.x,gy=hc.y-(bc.y+10);
      requestAnimationFrame(function(){g.style.transform='translate(-50%,-50%) translate('+gx+'px,'+gy+'px) scale(1.5)';});
      setTimeout(function(){rm(g,0);var p=document.createElement('div');p.className='hba-ghost-poof';p.style.left=hc.x+'px';p.style.top=hc.y+'px';add(p);rm(p,520);tintOverlay('rgba(226,232,240,.3)');deal();},320);return;
    }
    if(t==='lightning'){ lightningStrike(hc.x,hc.y);setTimeout(deal,180);return; } // 🔴 v527起历史死代码(雷电之主已换 thunderlord)·分支+lightningStrike+.hba-lightning CSS 守卫盯防勿删
    if(t==='laser'){
      var lz=document.createElement('div');lz.className='hba-laser';lz.style.left=hc.x+'px';lz.style.top=bc.y+'px';lz.style.height=Math.max(8,hc.y-bc.y)+'px';
      add(lz);rm(lz,420);setTimeout(function(){burstShards(hc.x,hc.y,PAL.pink,12);tintOverlay('rgba(236,72,153,.3)');deal();},200);return;
    }
    if(t==='spiral'){
      var orbc=document.createElement('div');orbc.className='hba-beam-charge';orbc.style.left=bc.x+'px';orbc.style.top=bc.y+'px';add(orbc);rm(orbc,260);
      setTimeout(function(){var beam=document.createElement('div');beam.className='hba-spiralbeam';beam.style.left=hc.x+'px';beam.style.top=bc.y+'px';beam.style.height=Math.max(8,hc.y-bc.y)+'px';add(beam);rm(beam,440);},120);
      setTimeout(function(){chaosExplode(hc.x,hc.y);deal();},340);return;
    }
    if(t==='spear'){
      var hb=makeHalberd();hb.style.left=bc.x+'px';var topYh=bc.y-10;hb.style.top=topYh+'px';
      var reachh=hc.y-(topYh+150)+4;hb.style.setProperty('--reach',reachh+'px');add(hb);rm(hb,460);
      setTimeout(function(){pierceImpact(hc.x,hc.y);deal();},200);return;
    }
    // 🔴 v503: 上古太阳神——太阳火球从小变大砸向勇者(同机械泰坦拳头模式: 起点稍低·起始30%→满·砸中后原地淡出·0.8s) + 命中血条火焰燃烧 + 同时掉血。火球为正方·命中点取中心(43=86/2)。
    if(t==='sunslam'){ // 🔴 v531起历史死代码(上古太阳神→sungod)·分支+makeSunball+sunFireBurn 守卫盯防勿删·__hbaSunImg 预加载仍现役(sungod 聚日成阳直接复用)
      var sb=makeSunball();sb.style.left=bc.x+'px';var topYs=bc.y-22;sb.style.top=topYs+'px';
      var reachS=hc.y-(topYs+43)+4;sb.style.setProperty('--reach',reachS+'px');
      var sYs=(reachS-100); if(sYs<-40)sYs=Math.round(reachS*0.5);   // 兜底: boss/勇者太近时改用半程
      sb.style.setProperty('--startY',sYs+'px');
      sb.style.setProperty('--startScale','0.3');
      add(sb);rm(sb,880);
      setTimeout(function(){sunFireBurn(hc.x,hc.y);deal();},400);
      return;
    }
    // 🔴 v504/v505: 光波/光束(混沌魔尊Lv19漩涡·外星霸主Lv18光束)——从 boss 处细端逐渐展开(clip 揭示)沿 boss→血条画出, 大端(漩涡口/冲击)抵达血条命中+掉血。尺寸按 boss→勇者距离动态贴合(细端在 boss·大端落勇者)·保持各图比例(fx.ar=高/宽)。展开速度 fx.dur(Hansen 定稿 0.50s)。
    if(t==='wave'){ // 🔴 v530起历史死代码(双boss均已离开wave: 外星霸主v529→alienlord·混沌魔尊v530→hellgate)·分支+hbaChaosWave键帧+--wdur+makeWaveImg 守卫盯防勿删·两图预加载仍现役(光束→alienlord·漩涡→hellgate)
      var wv=makeWaveImg(fx.img);
      var topY=bc.y-18, botY=hc.y+32;            // 细端在 boss 上中部·大端延到勇者稍下
      var H=Math.max(120, botY-topY);
      var W=Math.round(H/(fx.ar||1.075));         // W=H÷(高/宽), 保持图比例
      var dur=fx.dur||0.5;
      wv.style.width=W+'px'; wv.style.left=bc.x+'px'; wv.style.top=topY+'px';
      wv.style.setProperty('--wdur',dur+'s');
      add(wv); rm(wv,Math.round(dur*1000)+160);
      setTimeout(function(){
        if(fx.shards){ // 外星霸主等: 简洁冲击(boss色环+碎片+tint)·图本身已带冲击爆裂
          var bst=document.createElement('div');bst.className='hba-orb-burst';bst.style.background=fx.burst||'radial-gradient(circle,rgba(255,255,255,.9),transparent 75%)';bst.style.left=hc.x+'px';bst.style.top=hc.y+'px';add(bst);rm(bst,520);
          burstShards(hc.x,hc.y,PAL[fx.shards]||PAL.magic,14);
          if(fx.tint)tintOverlay(fx.tint);
        } else { // 混沌魔尊: 保留混沌爆炸(Hansen 已认可)
          chaosExplode(hc.x,hc.y); tintOverlay('rgba(124,58,237,.34)');
        }
        deal();
      }, Math.round(dur*1000*0.78));   // ≈78% 展开到大端
      return;
    }
    // 🔴 v506: 暗夜吸血鬼(Lv6)——4 颗牙齿咬住勇者血条(上2颗下咬·下2颗上咬·牙尖在血条中线相碰)+血条泛红+滴血+掉血。Hansen 定稿: 大小70% · 0.5s。
    if(t==='fangbite'){
      var bar=document.querySelector('.hero-hp-bar');
      if(!bar){ deal(); return; }
      var br2=bar.getBoundingClientRect(), midY=br2.top+br2.height/2;
      var xs=[br2.left+br2.width*0.34, br2.left+br2.width*0.62];
      var vdur=fx.dur||0.5, vsz=fx.sz||0.7;
      var defs=[['tl',xs[0],true],['tr',xs[1],true],['bl',xs[0],false],['br',xs[1],false]];
      defs.forEach(function(d){
        var fg=makeVfang(d[0],vsz);
        fg.style.left=(d[1]-fg._w/2)+'px';
        fg.style.top=(d[2]?(midY-fg._h):midY)+'px';   // 上牙尖在底→落midY; 下牙尖在顶→落midY
        fg.style.setProperty('--vdur',vdur+'s');
        fg.classList.add(d[2]?'top':'bot');
        add(fg); rm(fg, Math.round(vdur*1000)+220);
      });
      setTimeout(function(){
        bar.classList.add('hsn-bite-glow'); setTimeout(function(){bar.classList.remove('hsn-bite-glow');}, Math.round(vdur*1000*0.55));
        xs.forEach(function(x){ var bd=document.createElement('div'); bd.className='hba-vblood'; bd.style.left=x+'px'; bd.style.top=midY+'px'; bd.style.setProperty('--vdur',vdur+'s'); add(bd); rm(bd, Math.round(vdur*1000)+120); });
        deal();
      }, Math.round(vdur*1000*0.30));
      return;
    }
    // 🔴 v507: 暗影忍者(Lv2)——扔手里剑(图片), 从boss边飞边旋转命中勇者血条, 血液飞溅+掉血。Hansen 定稿: 大小86% · 0.66s · 1圈。
    // 🔴 v551: 暗影忍者(Lv2)——影舞·三连杀(Hansen: 按形象台词做到最棒)。台词三象逐句可视化——
    //   "忍法!隐身术!"→开场 boss 处炸出忍者烟雾遁入暗影; "影舞步!你看不见我!"→屏上三处闪现影分身
    //   (忍者立绘黑剪影+紫磷光), 每个分身各掷一枚手里剑·三镖多方向包夹旋飞勇者·错峰命中小紫闪;
    //   "一刀致命!"→最后 1.6 倍大手里剑带紫色刀光拖尾急速射出, 命中十字斩光+血溅+暗影爆→deal。
    //   不变量: 零震屏零屏闪 / 全 fixed 贴 __hansenFxLayer / hba-sd 前缀防冲突 / 手里剑图 decode 克隆(BUG#67同理) / deal 兜底 dealDelay。
    if(t==='shadowdance'){
      var sdbar=document.querySelector('.hero-hp-bar'), sdx,sdy;
      if(sdbar){ var sdbr=sdbar.getBoundingClientRect(); sdx=bc.x; sdy=sdbr.top+sdbr.height/2; }
      else { sdx=hc.x; sdy=hc.y; }
      var ssz=fx.sz||0.86, ssp=fx.sp||1, sfxi=fx.fxi||1;
      var T=function(ms){return Math.round(ms/ssp);};
      var vw=window.innerWidth, vh=window.innerHeight;
      function sdEl(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
      // ① 忍法!隐身术!——boss 处忍者烟雾 ×3
      for(var si=0;si<3;si++){ (function(i){ setTimeout(function(){
        var sm=sdEl('hba-sdsmoke', bc.x+(Math.random()-.5)*56, bc.y+(Math.random()-.5)*40, 64+Math.random()*30);
        try{ sm.animate([{transform:'translate(-50%,-50%) scale(.35)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:.75,offset:.3},{transform:'translate(-50%,-50%) scale(1.7)',opacity:0}],{duration:620,easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(sm,680); }, T(i*90)); })(si); }
      // ② 影舞步!——三个影分身闪现 + 各掷一镖(多方向包夹)
      var clonePos=[ {x:bc.x-112,y:bc.y+58}, {x:bc.x+96,y:bc.y+26}, {x:bc.x-66,y:bc.y-54} ];
      var KSZ=Math.round(42*ssz);
      function sdThrow(fromX,fromY,delay,spins,hitCb){
        setTimeout(function(){
          var sh=makeShuriken(KSZ); sh.style.left=(fromX-KSZ/2)+'px'; sh.style.top=(fromY-KSZ/2)+'px';
          (window.__hansenFxLayer||document.body).appendChild(sh);
          var dx=sdx-fromX, dy=sdy-fromY, fdur=T(420);
          try{ sh.animate([
            {transform:'translate(0,0) rotate(0deg) scale(.65)',opacity:0,offset:0},
            {transform:'translate('+(dx*0.14)+'px,'+(dy*0.14)+'px) rotate('+(spins*360*0.14)+'deg) scale(1)',opacity:1,offset:.14},
            {transform:'translate('+dx+'px,'+dy+'px) rotate('+(spins*360)+'deg) scale(1)',opacity:1,offset:1}
          ],{duration:fdur,easing:'cubic-bezier(.45,.05,.75,.7)',fill:'forwards'}); }catch(e){ sh.style.transform='translate('+dx+'px,'+dy+'px)'; sh.style.opacity='1'; }
          setTimeout(function(){ try{ sh.animate([{opacity:1},{opacity:0}],{duration:130,fill:'forwards'}); }catch(e){} rm(sh,160); if(hitCb)hitCb(); }, fdur);
        }, delay);
      }
      for(var ci=0;ci<3;ci++){ (function(i){
        var cp=clonePos[i];
        cp.x=Math.max(58,Math.min(vw-58,cp.x)); cp.y=Math.max(70,Math.min(vh-120,cp.y));
        setTimeout(function(){
          var cl=sdEl('hba-sdclone', cp.x, cp.y, 104, 104);
          cl.innerHTML='<img src="bosses/lv02.webp?v=908" alt="" draggable="false">';
          try{ cl.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.7)'},{opacity:.62,transform:'translate(-50%,-50%) scale(1)',offset:.4},{opacity:0,transform:'translate(-50%,-50%) scale(.92)'}],{duration:T(300),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(cl,T(340));
        }, T(200+i*180));
        sdThrow(cp.x, cp.y, T(310+i*180), 2, function(){
          var hf=sdEl('hba-sdhitflash', sdx+(Math.random()-.5)*26, sdy+(Math.random()-.5)*10, Math.round(34*sfxi));
          void hf.offsetWidth; hf.classList.add('go'); rm(hf,260);
          if(sdbar){ sdbar.classList.add('hsn-bite-glow'); setTimeout(function(){sdbar.classList.remove('hsn-bite-glow');},180); }
        });
      })(ci); }
      // ③ 一刀致命!——1.6 倍大手里剑·紫刀光拖尾·十字斩+血溅+暗影爆+deal
      var bigDelay=T(1240);
      setTimeout(function(){
        var BK=Math.round(KSZ*1.6), bsh=makeShuriken(BK); bsh.classList.add('big');
        bsh.style.left=(bc.x-BK/2)+'px'; bsh.style.top=(bc.y-BK/2)+'px';
        (window.__hansenFxLayer||document.body).appendChild(bsh);
        var bdx=sdx-bc.x, bdy=sdy-bc.y, bdur=T(380);
        // 紫刀光拖尾(沿飞行方向的渐变光带)
        var ang=Math.atan2(bdy,bdx)*180/Math.PI, blen=Math.sqrt(bdx*bdx+bdy*bdy);
        var tr=sdEl('hba-sdtrail', bc.x, bc.y, Math.round(blen), 12);
        tr.style.transformOrigin='0 50%'; tr.style.transform='translate(0,-50%) rotate('+ang+'deg) scaleX(0)';
        try{ tr.animate([{transform:'translate(0,-50%) rotate('+ang+'deg) scaleX(0)',opacity:.9},{transform:'translate(0,-50%) rotate('+ang+'deg) scaleX(1)',opacity:.7,offset:.6},{transform:'translate(0,-50%) rotate('+ang+'deg) scaleX(1)',opacity:0}],{duration:bdur+200,easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(tr,bdur+260);
        try{ bsh.animate([
          {transform:'translate(0,0) rotate(0deg) scale(.6)',opacity:0,offset:0},
          {transform:'translate('+(bdx*0.12)+'px,'+(bdy*0.12)+'px) rotate(130deg) scale(1.05)',opacity:1,offset:.12},
          {transform:'translate('+bdx+'px,'+bdy+'px) rotate(1080deg) scale(1)',opacity:1,offset:1}
        ],{duration:bdur,easing:'cubic-bezier(.5,.02,.78,.6)',fill:'forwards'}); }catch(e){ bsh.style.transform='translate('+bdx+'px,'+bdy+'px)'; bsh.style.opacity='1'; }
        setTimeout(function(){
          // 十字斩光 ×2
          for(var xi2=0;xi2<2;xi2++){ var sl=sdEl('hba-sdslash', sdx, sdy, Math.round(150*sfxi), 6);
            sl.style.transform='translate(-50%,-50%) rotate('+(xi2?-45:45)+'deg) scaleX(0)';
            (function(e,rot){ try{ e.animate([{transform:'translate(-50%,-50%) rotate('+rot+'deg) scaleX(0)',opacity:1},{transform:'translate(-50%,-50%) rotate('+rot+'deg) scaleX(1)',opacity:1,offset:.45},{transform:'translate(-50%,-50%) rotate('+rot+'deg) scaleX(1.06)',opacity:0}],{duration:260,easing:'ease-out',fill:'forwards'}); }catch(e2){} })(sl, xi2?-45:45);
            rm(sl,300); }
          // 暗影爆
          var bu=sdEl('hba-sdburst', sdx, sdy, Math.round(56*sfxi));
          try{ bu.animate([{transform:'translate(-50%,-50%) scale(.3)',opacity:.95},{transform:'translate(-50%,-50%) scale(2.1)',opacity:0}],{duration:430,easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(bu,470);
          bloodSplatter(sdx,sdy);
          if(sdbar){ sdbar.classList.add('hsn-bite-glow'); setTimeout(function(){sdbar.classList.remove('hsn-bite-glow');},230); }
          try{ bsh.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'}); }catch(e){}
          rm(bsh,170);
          deal();
        }, bdur);
      }, bigDelay);
      return;
    }
    if(t==='shuriken'){
      var bar3=document.querySelector('.hero-hp-bar'), ex,ey;
      if(bar3){ var br3=bar3.getBoundingClientRect(); ex=bc.x; ey=br3.top+br3.height/2; }
      else { ex=hc.x; ey=hc.y; }
      var kdur=fx.dur||0.66, ksz=fx.sz||0.86, kspin=(fx.spins!=null?fx.spins:1);
      var KSZ=Math.round(48*ksz), sh=makeShuriken(KSZ);
      sh.style.left=(bc.x-KSZ/2)+'px'; sh.style.top=(bc.y-KSZ/2)+'px';
      add(sh);
      var kdx=ex-bc.x, kdy=ey-bc.y, kdeg=kspin*360;
      try{ sh.animate([
        {transform:'translate(0,0) rotate(0deg) scale(.7)',opacity:0,offset:0},
        {transform:'translate('+(kdx*0.12)+'px,'+(kdy*0.12)+'px) rotate('+(kdeg*0.12)+'deg) scale(1)',opacity:1,offset:.12},
        {transform:'translate('+kdx+'px,'+kdy+'px) rotate('+kdeg+'deg) scale(1)',opacity:1,offset:1}
      ],{duration:kdur*1000,easing:'cubic-bezier(.45,.05,.75,.7)',fill:'forwards'}); }catch(e){ sh.style.transform='translate('+kdx+'px,'+kdy+'px)'; sh.style.opacity='1'; }
      setTimeout(function(){
        if(bar3){ bar3.classList.add('hsn-bite-glow'); setTimeout(function(){bar3.classList.remove('hsn-bite-glow');},230); }
        bloodSplatter(ex,ey);
        try{ sh.animate([{opacity:1},{opacity:0}],{duration:150,fill:'forwards'}); }catch(e){ sh.style.opacity='0'; }
        rm(sh,200);
        deal();
      }, Math.round(kdur*1000));
      return;
    }
    // 🔴 v535: 星海女帝·赛尔娅(传说·双形态)——星海圣典·超新星挽歌(Hansen 定稿: 虹彩星海·规模100%·速度1.00x·星辉强度100%=七连满奏)。全游压轴最后一招·fly 全退役。①繁星为我加冕(22彩星点亮+星座连线+圣环+足下银河) ②七颗星核绕我而行+银河之泪出鞘(七核原位点亮入轨公转+虹彩剑魂出鞘) ③星辰序曲(七色流星各用本色+♪音符·1~7连) ④超新星挽歌(挥剑斩天→星空裂隙→银河倾泻→聚星成核七彩吸积盘→引力坍缩+休止符hush静默→坠落爆发: 七色冲击环+星屑+彩色地纹+deal≈5878兜底6300→新星诞生+满天星熄灭——诞生与熄灭闭环)。零震屏零屏闪·答题区零侵犯。
    if(t==='starempress'){
      var sebar=document.querySelector('.hero-hp-bar'), sebarL,sebarW,semidY,sehx,sebB;
      if(sebar){ var sebr=sebar.getBoundingClientRect(); sebarL=bc.x-sebr.width/2;sebarW=sebr.width;semidY=sebr.top+sebr.height*0.5;sehx=bc.x;sebB=sebr.bottom; }
      else { sebarL=hc.x-60;sebarW=120;semidY=hc.y;sehx=hc.x;sebB=hc.y+6; }
      hbaStarEmpress(bs, sehx, sebarL, sebarW, semidY, sebB, fx, deal);
      return;
    }
    if(t==='starforge'){
      var sfbar=document.querySelector('.hero-hp-bar'), sfbarL,sfbarW,sfmidY,sfhx,sfbB;
      if(sfbar){ var sfr=sfbar.getBoundingClientRect(); sfbarL=bc.x-sfr.width/2;sfbarW=sfr.width;sfmidY=sfr.top+sfr.height*0.5;sfhx=bc.x;sfbB=sfr.bottom; }
      else { sfbarL=hc.x-60;sfbarW=120;sfmidY=hc.y;sfhx=hc.x;sfbB=hc.y+6; }
      hbaStarForge(bs, sfhx, sfbarL, sfbarW, sfmidY, sfbB, fx, deal);
      return;
    }
    if(t==='vanguard'){
      var vgbar=document.querySelector('.hero-hp-bar'), vgL,vgW,vgMY,vgHX,vgBB;
      if(vgbar){ var vgr=vgbar.getBoundingClientRect(); vgL=bc.x-vgr.width/2;vgW=vgr.width;vgMY=vgr.top+vgr.height*0.5;vgHX=bc.x;vgBB=vgr.bottom; }
      else { vgL=hc.x-60;vgW=120;vgMY=hc.y;vgHX=hc.x;vgBB=hc.y+6; }
      hbaVanguard(bs, vgHX, vgL, vgW, vgMY, vgBB, fx, deal);
      return;
    }
    if(t==='waranvil'){
      var wabar=document.querySelector('.hero-hp-bar'), waL,waW,waMY,waHX,waBB;
      if(wabar){ var war=wabar.getBoundingClientRect(); waL=bc.x-war.width/2;waW=war.width;waMY=war.top+war.height*0.5;waHX=bc.x;waBB=war.bottom; }
      else { waL=hc.x-60;waW=120;waMY=hc.y;waHX=hc.x;waBB=hc.y+6; }
      hbaWarAnvil(bs, waHX, waL, waW, waMY, waBB, fx, deal);
      return;
    }
    if(t==='exileblade'){
      var ebbar=document.querySelector('.hero-hp-bar'), ebL,ebW,ebMY,ebHX,ebBB;
      if(ebbar){ var ebr=ebbar.getBoundingClientRect(); ebL=bc.x-ebr.width/2;ebW=ebr.width;ebMY=ebr.top+ebr.height*0.5;ebHX=bc.x;ebBB=ebr.bottom; }
      else { ebL=hc.x-60;ebW=120;ebMY=hc.y;ebHX=hc.x;ebBB=hc.y+6; }
      hbaExileBlade(bs, ebHX, ebL, ebW, ebMY, ebBB, fx, deal);
      return;
    }
    if(t==='assembler'){
      var asbar=document.querySelector('.hero-hp-bar'), asL,asW,asMY,asHX,asBB;
      if(asbar){ var asr=asbar.getBoundingClientRect(); asL=bc.x-asr.width/2;asW=asr.width;asMY=asr.top+asr.height*0.5;asHX=bc.x;asBB=asr.bottom; }
      else { asL=hc.x-60;asW=120;asMY=hc.y;asHX=hc.x;asBB=hc.y+6; }
      hbaAssembler(bs, asHX, asL, asW, asMY, asBB, fx, deal);
      return;
    }
    if(t==='ancientwill'){
      var awbar=document.querySelector('.hero-hp-bar'), awL,awW,awMY,awHX,awBB;
      if(awbar){ var awr=awbar.getBoundingClientRect(); awL=bc.x-awr.width/2;awW=awr.width;awMY=awr.top+awr.height*0.5;awHX=bc.x;awBB=awr.bottom; }
      else { awL=hc.x-60;awW=120;awMY=hc.y;awHX=hc.x;awBB=hc.y+6; }
      hbaAncientWill(bs, awHX, awL, awW, awMY, awBB, fx, deal);
      return;
    }
    if(t==='lightjudge'){
      var ljbar=document.querySelector('.hero-hp-bar'), ljbarL,ljbarW,ljmidY,ljhx,ljbB;
      if(ljbar){ var ljr=ljbar.getBoundingClientRect(); ljbarL=bc.x-ljr.width/2;ljbarW=ljr.width;ljmidY=ljr.top+ljr.height*0.5;ljhx=bc.x;ljbB=ljr.bottom; }
      else { ljbarL=hc.x-60;ljbarW=120;ljmidY=hc.y;ljhx=hc.x;ljbB=hc.y+6; }
      hbaLightJudge(bs, ljhx, ljbarL, ljbarW, ljmidY, ljbB, fx, deal);
      return;
    }
    if(t==='soulabyss'){
      var sabar=document.querySelector('.hero-hp-bar'), sabarL,sabarW,samidY,sahx,sabB;
      if(sabar){ var sar=sabar.getBoundingClientRect(); sabarL=bc.x-sar.width/2;sabarW=sar.width;samidY=sar.top+sar.height*0.5;sahx=bc.x;sabB=sar.bottom; }
      else { sabarL=hc.x-60;sabarW=120;samidY=hc.y;sahx=hc.x;sabB=hc.y+6; }
      hbaSoulAbyss(bs, sahx, sabarL, sabarW, samidY, sabB, fx, deal);
      return;
    }
    if(t==='chronosend'){
      var cebar=document.querySelector('.hero-hp-bar'), cebarL,cebarW,cemidY,cehx,cebB;
      if(cebar){ var cer=cebar.getBoundingClientRect(); cebarL=bc.x-cer.width/2;cebarW=cer.width;cemidY=cer.top+cer.height*0.5;cehx=bc.x;cebB=cer.bottom; }
      else { cebarL=hc.x-60;cebarW=120;cemidY=hc.y;cehx=hc.x;cebB=hc.y+6; }
      hbaChronosEnd(bs, cehx, cebarL, cebarW, cemidY, cebB, fx, deal);
      return;
    }
    if(t==='starbrand'){
      var sbbar=document.querySelector('.hero-hp-bar'), sbbarL,sbbarW,sbmidY,sbhx,sbbB;
      if(sbbar){ var sbr=sbbar.getBoundingClientRect(); sbbarL=bc.x-sbr.width/2;sbbarW=sbr.width;sbmidY=sbr.top+sbr.height*0.5;sbhx=bc.x;sbbB=sbr.bottom; }
      else { sbbarL=hc.x-60;sbbarW=120;sbmidY=hc.y;sbhx=hc.x;sbbB=hc.y+6; }
      hbaStarBrand(bs, sbhx, sbbarL, sbbarW, sbmidY, sbbB, fx, deal);
      return;
    }
    // 🔴 v531: 上古太阳神(Lv20)——创世神谕·天降太阳(Hansen 定稿: 鎏金圣阳·规模100%·速度1.00x·圣焰强度100%=3道耀斑光矛)。①吾即是万物之始!(天光瀑布×3+日冕法阵觉醒贴日轮+日冕圣火顺序点燃+金目+头顶光环+金尘) ②宇宙在我掌中!(掌中日暴亮+5星辰椭圆轨道公转1.5圈+八芒审判金阵+太阳圣印×4) ③太阳耀斑光矛(双弧耀斑尾·双残影·1~5连·命中圣火) ④凡人终须臣服!(日蚀700ms→天穹法阵(cx,95)→掌中日飞升→聚日成阳[复用__hbaSunImg·scale.18→1充能+8汇聚光粒+热浪×2+悬停脉动+边缘耀斑]→陨石坠落[rAF tt=t²·.6+t·.4·终点球心midY-46·放大1.15+焰尾+光屑]→命中[压扁反弹+柔光.62+爆闪+四重环+gShock+熔金地裂×5+圣火×6+蒸发金尘+deal≈4720兜底5100]→灼烧余威[脉冲+灼环三连]→升天消散[scale.5上升170]→afterGlow)。零震屏零屏闪·答题区零侵犯(球底≈363<366)。
    if(t==='sungod'){
      var sgbar=document.querySelector('.hero-hp-bar'), sgbarL,sgbarW,sgmidY,sghx,sgbB;
      if(sgbar){ var sgbr=sgbar.getBoundingClientRect(); sgbarL=bc.x-sgbr.width/2;sgbarW=sgbr.width;sgmidY=sgbr.top+sgbr.height*0.5;sghx=bc.x;sgbB=sgbr.bottom; }
      else { sgbarL=hc.x-60;sgbarW=120;sgmidY=hc.y;sghx=hc.x;sgbB=hc.y+6; }
      hbaSunGod(bs, sghx, sgbarL, sgbarW, sgmidY, sgbB, fx, deal);
      return;
    }
    // 🔴 v530: 混沌魔尊(Lv19)——深渊审判·地狱之门(Hansen 定稿: 深渊魔紫·规模100%·速度1.00x·业火强度160%=5道三叉刺)。①哈哈哈哈哈!(荆棘火环逼真火焰顺序点燃+黄瞳+熔岩核心+裂地+暗影+震慑波) ②深渊审判!(三叉戟过载+戟尖品字聚能+倒五芒星审判阵+封印符文×4+锁定光链) ③业火三叉连刺(双残影·1~5连·命中火苗) ④地狱之门已开启!(左侧gx=vw*0.195: 扭曲波+撕裂缝→哥特石拱门框+深渊底→双扉3D轰开78°+开门冲击→门内蓄能→混沌龙卷光波斜射[复用__hbaWaveImg·clip揭示从无到有·rotate独立层·θ=-atan2修正]→盘端砸正中(cx,midY)主爆deal≈5030兜底5400+灼烧+汽化+吞噬倒吸回门→光波缩回→合扉→门框缩回→裂缝愈合+腐蚀火)。零震屏零屏闪·答题区零侵犯。
    //🔴BUG#68(v532): t:'hellgate' 被 Lv8 地狱犬王(pal:'fire')与 Lv19 混沌魔尊(pal:'purple')共用——v530 新分支在前导致地狱犬王误放魔尊大招(火环+三叉戟实测复现)。修复: 分支加 pal==='purple' 判定, 犬王落回下方老 hellgate 分支。教训: 新招类型名必须全配置表查重。
    if(t==='hellgate'&&fx.pal==='purple'){
      var hlbar=document.querySelector('.hero-hp-bar'), hlbarL,hlbarW,hlmidY,hlhx,hlbB;
      if(hlbar){ var hlbr=hlbar.getBoundingClientRect(); hlbarL=bc.x-hlbr.width/2;hlbarW=hlbr.width;hlmidY=hlbr.top+hlbr.height*0.5;hlhx=bc.x;hlbB=hlbr.bottom; }
      else { hlbarL=hc.x-60;hlbarW=120;hlmidY=hc.y;hlhx=hc.x;hlbB=hc.y+6; }
      hbaHellLord(bs, hlhx, hlbarL, hlbarW, hlmidY, hlbB, fx, deal);
      return;
    }
    // 🔴 v529: 外星霸主(Lv18)——歼星协议·轨道湮灭(Hansen 定稿: 异星翠绿·规模100%·速度1.00x·火力100%)。①你的星球归我了!(异星光帘+反重力光环+触角灯+掌心法阵旋入) ②宇宙最强生物!(5颗侦察无人机弹出→血条上空列阵悬停+单眼齐闪+锁定线×5) ③等离子齐射(五机错峰射光弹带残影·1~5连→归航) ④哼哼...弱小地球人!(法阵推出定位→预热光点→歼星光束复用__hbaBeamImg·hue-rotate翠绿·命中心88%对准midY·全功率脉冲+汽化离子+主爆deal≈4050ms→收束+法阵碎裂+辐射余韵)。零震屏零屏闪·答题区零侵犯。
    if(t==='alienlord'){
      var albar=document.querySelector('.hero-hp-bar'), albarL,albarW,almidY,alhx,albB;
      if(albar){ var albr=albar.getBoundingClientRect(); albarL=bc.x-albr.width/2;albarW=albr.width;almidY=albr.top+albr.height*0.5;alhx=bc.x;albB=albr.bottom; }
      else { albarL=hc.x-60;albarW=120;almidY=hc.y;alhx=hc.x;albB=hc.y+6; }
      // 🔴BUG#72(Hansen): 歼星光束(stage④)右移避免挡boss立绘——alhx只喂stage④(法阵/预热/光束/命中/伤害数字), 其余阶段(光帘/无人机/齐射)仍锚boss·血条不动。核心右移≈半个光束宽(亮核移到boss右缘外)·钳位盒右缘≤vw-4防出屏。
      var _alsz=fx.sz||1, _alH=Math.round((almidY+8)/0.88*Math.min(1.18,Math.max(.8,_alsz))), _alW=Math.round(_alH*300/664);
      alhx = bc.x + Math.round(_alW/2);
      var _almax = window.innerWidth - 4 - Math.round(_alW/2);
      if(alhx > _almax) alhx = _almax;
      hbaAlienLord(bs, alhx, albarL, albarW, almidY, albB, fx, deal);
      return;
    }
    // 🔴 v528: 机械泰坦(Lv17)——歼灭协议·泰坦终结斩+天降流星拳(Hansen 定稿: 猩红警戒·规模100%·速度1.00x·火力强度100%)。①SYSTEM ONLINE(HUD+扫描线+六边形网格+全息环+双眼觉醒+机体灯+排气) ②TARGET LOCKED(雷达+准星三段吸附锁定+警告三角+双测距) ③武器过载(能量回路+剑刃充能+盾/胸核心) ④TERMINATING(剑气三连斩带残影+全屏刀光→落点警告→机械巨拳流星坠落[摩擦火焰+焰尾+火星·复用__hbaFistImg]→砸击巨爆[三重环+地面冲击波+火焰飞溅+烟尘+碎片]→抽离·deal≈4600ms)。零震屏零屏闪·答题区零侵犯。
    if(t==='titanstrike'){
      var mtbar=document.querySelector('.hero-hp-bar'), mtbarL,mtbarW,mtmidY,mthx,mtbB;
      if(mtbar){ var mtbr=mtbar.getBoundingClientRect(); mtbarL=bc.x-mtbr.width/2;mtbarW=mtbr.width;mtmidY=mtbr.top+mtbr.height*0.5;mthx=bc.x;mtbB=mtbr.bottom; }
      else { mtbarL=hc.x-60;mtbarW=120;mtmidY=hc.y;mthx=hc.x;mtbB=hc.y+6; }
      hbaTitanStrike(bs, mthx, mtbarL, mtbarW, mtmidY, mtbB, fx, deal);
      return;
    }
    // 🔴 v527: 雷电之主(Lv16)——天雷轰顶(Hansen 定稿: 苍雷蓝·规模140%·速度1.00x·雷霆强度160%)。①雷暴降临(积雨云+预兆闪×3+三点蓄能: 左手雷球/右拳电弧/头冠) ②万雷连击(7道分形闪电近垂直劈落血条1~7连) ③雷能汇聚(电丝两波+云核充能) ④天罚主雷(树状多级分叉·return stroke复闪·boss过载发光·云层回闪·三重电环+地弧爬行+火花·deal≈3380ms)+残余电弧。零震屏零屏闪·答题区零侵犯(火花/粒子/分支端点全钳位)。
    if(t==='thunderlord'){
      var tlbar=document.querySelector('.hero-hp-bar'), tlbarL,tlbarW,tlmidY,tlhx,tlbB;
      if(tlbar){ var tlbr=tlbar.getBoundingClientRect(); tlbarL=bc.x-tlbr.width/2;tlbarW=tlbr.width;tlmidY=tlbr.top+tlbr.height*0.5;tlhx=bc.x;tlbB=tlbr.bottom; }
      else { tlbarL=hc.x-60;tlbarW=120;tlmidY=hc.y;tlhx=hc.x;tlbB=hc.y+6; }
      hbaThunderLord(bs, tlhx, tlbarL, tlbarW, tlmidY, tlbB, fx, deal);
      return;
    }
    // 🔴 v524: 烈焰魔神(Lv15)——焚世天罚陨星灭世(Hansen 定稿)。①天罚预兆 ②陨星雨12颗(5血条连击+4地面残火+3远景) ③灭世巨陨超巨爆(deal)+灰烬。零震屏零屏闪。
    if(t==='doomstar'){
      var fmbar=document.querySelector('.hero-hp-bar'), fmbarL, fmbarW, fmmidY, fmhx, fmbB;
      if(fmbar){ var fmbr=fmbar.getBoundingClientRect(); fmbarL=bc.x-fmbr.width/2; fmbarW=fmbr.width; fmmidY=fmbr.top+fmbr.height*0.5; fmhx=bc.x; fmbB=fmbr.bottom; }
      else { fmbarL=hc.x-60; fmbarW=120; fmmidY=hc.y; fmhx=hc.x; fmbB=hc.y+6; }
      var fmbs=bs.getBoundingClientRect();
      hbaDoomStar(fmbs.left+fmbs.width/2, fmbs.top+fmbs.height/2, fmhx, fmbarL, fmbarW, fmmidY, fmbB, fx, deal);
      return;
    }
    // 🔴 v523: 寒冰女王(Lv14)——冰封万古绝对零度(Hansen 定稿)。①暴风雪+举杖 ②冰晶风暴五连 ③绝对零度冰封勇者0.8秒 ④裂纹炸碎(deal)。零震屏零屏闪。
    if(t==='icequeen'){
      var iqbar=document.querySelector('.hero-hp-bar'), iqbarL, iqbarW, iqmidY, iqhx;
      if(iqbar){ var iqbr=iqbar.getBoundingClientRect(); iqbarL=bc.x-iqbr.width/2; iqbarW=iqbr.width; iqmidY=iqbr.top+iqbr.height*0.5; iqhx=bc.x; }
      else { iqbarL=hc.x-60; iqbarW=120; iqmidY=hc.y; iqhx=hc.x; }
      var iqbs=bs.getBoundingClientRect();
      hbaIceQueen(iqbs.left+iqbs.width/2, iqbs.top+iqbs.height/2, iqhx, iqbarL, iqbarW, iqmidY, fx, deal);
      return;
    }
    // 🔴 v522: 海底巨怪(Lv13)——深渊狂潮八爪绞杀(Hansen 定稿)。①海水倒灌(战区水带) ②八爪缠绕(甩鞭+夹击连击) ③深渊漩涡 ④灭世狂潮(deal)+退潮。零震屏零屏闪。
    if(t==='abysstide'){
      var skbar=document.querySelector('.hero-hp-bar'), skbarL, skbarW, skmidY, skhx, skbT, skbB;
      if(skbar){ var skbr=skbar.getBoundingClientRect(); skbarL=bc.x-skbr.width/2; skbarW=skbr.width; skmidY=skbr.top+skbr.height*0.5; skhx=bc.x; skbT=skbr.top; skbB=skbr.bottom; }
      else { skbarL=hc.x-60; skbarW=120; skmidY=hc.y; skhx=hc.x; skbT=hc.y-6; skbB=hc.y+6; }
      hbaAbyssTide(skhx, skbarL, skbarW, skmidY, skbT, skbB, fx, deal);
      return;
    }
    // 🔴 v521: 暗黑灯神(Lv12)——神灯魂狱万魂诅咒(Hansen 定稿·真神灯图)。①神灯降世烟雾笼罩 ②三愿成诅咒(连击) ③灵魂之爪攥魂 ④万烟归灯审判光柱(deal)。零震屏零屏闪。
    if(t==='geniecurse'){
      var gnbar=document.querySelector('.hero-hp-bar'), gnbarL, gnbarW, gnmidY, gnhx;
      if(gnbar){ var gnbr=gnbar.getBoundingClientRect(); gnbarL=bc.x-gnbr.width/2; gnbarW=gnbr.width; gnmidY=gnbr.top+gnbr.height*0.5; gnhx=bc.x; }
      else { gnbarL=hc.x-60; gnbarW=120; gnmidY=hc.y; gnhx=hc.x; }
      var gnbs=bs.getBoundingClientRect();
      hbaGenieCurse(gnbs.left+gnbs.width/2, gnbs.bottom, gnhx, gnbarL, gnbarW, gnmidY, fx, deal);
      return;
    }
    // 🔴 v520: 龙骑士统帅(Lv11)——巨龙之翼焚天枪雨(Hansen 定稿·真枪图)。①巨翼展开 ②统帅号令 ③焚天枪雨(连击) ④终焉巨枪(deal)。零震屏零屏闪。
    if(t==='dragonrain'){
      var dkbar=document.querySelector('.hero-hp-bar'), dkbarL, dkbarW, dkmidY, dkhx;
      if(dkbar){ var dkbr=dkbar.getBoundingClientRect(); dkbarL=bc.x-dkbr.width/2; dkbarW=dkbr.width; dkmidY=dkbr.top+dkbr.height*0.5; dkhx=bc.x; }
      else { dkbarL=hc.x-60; dkbarW=120; dkmidY=hc.y; dkhx=hc.x; }
      var dkbs=bs.getBoundingClientRect();
      hbaDragonRain(dkbs.left+dkbs.width/2, dkbs.top+dkbs.height/2, dkbs.top, dkhx, dkbarL, dkbarW, dkmidY, fx, deal);
      return;
    }
    // 🔴 v519: 异次元巫师(Lv10)——维度裂隙五元素轮舞(Hansen 定稿)。①五元素觉醒公转 ②双裂隙(大: boss右侧/小: boss左) ③轮舞瞬移连击 ④斜向五色光柱崩塌(deal)。零震屏零屏闪。
    if(t==='dimrift'){
      var xbar2=document.querySelector('.hero-hp-bar'), xbarL, xbarW, xmidY2, xhx2;
      if(xbar2){ var xbr2=xbar2.getBoundingClientRect(); xbarL=bc.x-xbr2.width/2; xbarW=xbr2.width; xmidY2=xbr2.top+xbr2.height*0.5; xhx2=bc.x; }
      else { xbarL=hc.x-60; xbarW=120; xmidY2=hc.y; xhx2=hc.x; }
      var xbs2=bs.getBoundingClientRect();
      hbaDimRift(xbs2.left+xbs2.width/2, xbs2.top+xbs2.height/2, xhx2, xbarL, xbarW, xmidY2, fx, deal);
      return;
    }
    // 🔴 v518: 黑森林巫婆(Lv9)——黑森林魔药毒苹果盛宴(Hansen 定稿)。①黑森林降临 ②魔药大锅熬煮 ③毒苹果三连(连击) ④荆棘缠杀+毒雾爆发(deal)。零震屏零屏闪。
    if(t==='witchbrew'){
      var wbar=document.querySelector('.hero-hp-bar'), wbarL, wbarW, wmidY, whx;
      if(wbar){ var wbr=wbar.getBoundingClientRect(); wbarL=bc.x-wbr.width/2; wbarW=wbr.width; wmidY=wbr.top+wbr.height*0.5; whx=bc.x; }
      else { wbarL=hc.x-60; wbarW=120; wmidY=hc.y; whx=hc.x; }
      var wbs=bs.getBoundingClientRect();
      hbaWitchBrew(wbs.left+wbs.width/2, wbs.bottom, whx, wbarL, wbarW, wmidY, fx, deal);
      return;
    }
    // 🔴 v517: 地狱犬王(Lv8)——地狱之门三头炼狱(Hansen 定稿)。①地狱之门 ②三头齐啸 ③三连火球(连击) ④三核汇聚+炎息(deal)。零震屏零屏闪。
    if(t==='hellgate'){
      var gbar=document.querySelector('.hero-hp-bar'), gbarL, gbarW, gmidY, ghx;
      if(gbar){ var gbr=gbar.getBoundingClientRect(); gbarL=bc.x-gbr.width/2; gbarW=gbr.width; gmidY=gbr.top+gbr.height*0.5; ghx=bc.x; }
      else { gbarL=hc.x-60; gbarW=120; gmidY=hc.y; ghx=hc.x; }
      var gbs=bs.getBoundingClientRect();
      hbaHellGate(gbs.left, gbs.top, gbs.width, gbs.height, ghx, gbarL, gbarW, gmidY, fx, deal);
      return;
    }
    // 🔴 v516: 蒙面大魔王(Lv7)——黑暗领域千面幻杀(Hansen 定稿)。①黑暗领域 ②千面分裂 ③锁定齐袭(连击) ④暗黑核+横贯波(deal)。零震屏零屏闪。
    if(t==='maskphantom'){
      var kbar=document.querySelector('.hero-hp-bar'), kbarL, kbarW, kmidY, khx;
      if(kbar){ var kbr=kbar.getBoundingClientRect(); kbarL=bc.x-kbr.width/2; kbarW=kbr.width; kmidY=kbr.top+kbr.height*0.5; khx=bc.x; }
      else { kbarL=hc.x-60; kbarW=120; kmidY=hc.y; khx=hc.x; }
      var kbs=bs.getBoundingClientRect();
      hbaMaskPhantom(kbs.left+kbs.width/2, kbs.top+kbs.height/2, kbs.bottom-12, khx, kbarL, kbarW, kmidY, fx, deal);
      return;
    }
    // 🔴 v515: 暗夜吸血鬼(Lv6)——血月蝠群噬血连击(Hansen 定稿)。①血月升起 ②蝙蝠群袭 ③真牙咬合(复用v506四牙图·deal) ④吸血回流。零震屏零屏闪。
    if(t==='batmoon'){
      var vbar=document.querySelector('.hero-hp-bar'), vbarL, vbarW, vmidY, vhx;
      if(vbar){ var vbr=vbar.getBoundingClientRect(); vbarL=bc.x-vbr.width/2; vbarW=vbr.width; vmidY=vbr.top+vbr.height*0.5; vhx=bc.x; }
      else { vbarL=hc.x-60; vbarW=120; vmidY=hc.y; vhx=hc.x; }
      var vbs=bs.getBoundingClientRect();
      hbaBatMoon(vbs.left+vbs.width/2, vbs.top, vhx, vbarL, vbarW, vmidY, fx, deal);
      return;
    }
    // 🔴 v559: 千年僵尸(Lv5)——定身符咒·万拳齐发(Hansen 二代素材: 左/右尸拳自带绿色尸气爆发光环+符纸, 新百拳全景每拳带爆发圈; 符沿用 zb_talisman)。
    //   Hansen: v558 没达预期(图不行), 换图重做。新设计=①先展示黄符贴住定身 ②左右交替快速连击"刷刷刷"(强烈沉重打击感) ③最后一堆拳同时打击过来(压迫感)+掉血。
    //   三段式——
    //   ①僵尸驾到(0~520ms): lv05 虚影绿磷光【蹦跳两段】压近 + 磷火×2(v558 验证有效, 保留);
    //   ②符咒定身(420~总命中): 黄符旋转翻飞→"啪"贴住勇者(squash 弹性)+束缚金圈脉冲×2——符全程贴着不爆, 持续高频小幅挣扎抖动(被定住挨揍的叙事), 直到总命中才炸裂(金碎片×8, 定身解除);
    //   ③万拳齐发(1350~2960ms): 左右尸拳斜向冲脸交替连击×8(左拳自左下 scale.3→1 斜冲, 右拳镜像, 命中点左右交替偏移交叉重拳, 间隔 180→110ms 递减"刷刷刷"),
    //     每拳命中=白闪+冲击环急扩+放射速度线×6+符纸屑×2; 拳命中后 100ms 急撤无缝衔接下一拳
    //     → 压轴: 新百拳全景(每拳带尸气爆发圈) scale .2→1.3 冲满屏(360ms ease-in) → 总命中(≈2960): 最强白闪+三重冲击环+符炸裂 → deal → 全图淡出+符纸屑飘落。
    //   打击感(零震屏): 斜向 POV 急停 + 冲击环 + 速度线瞬现 + 白闪 + 命中点交替偏移交叉感, 绝不动页面根节点。
    //   不变量: hba-zf 前缀 / 老 zombiecurse(v514)+zombieseal(v558) 分支全保留勿删(v528 先例) / deal 兜底 dealDelay / 四图预加载 __hbaZfImgs(BUG#67, 符复用 zb_talisman.webp 同 URL 走缓存) / 闭包循环变量全在 setTimeout 外(v554 tt 血案)。
    if(t==='zombiefury'){
      var zfbar=document.querySelector('.hero-hp-bar'), zfhx, zfhy;
      if(zfbar){ var zfr=zfbar.getBoundingClientRect(); zfhx=bc.x; zfhy=zfr.top+zfr.height*0.5; }
      else { zfhx=hc.x; zfhy=hc.y; }
      var zfsz=fx.sz||1, zfsp=fx.sp||1, zffxi=fx.fxi||1;
      var ZFT=function(ms){return Math.round(ms/zfsp);};
      var zfvw=window.innerWidth;
      var zfImgs=window.__hbaZfImgs||{};
      function zfImg(key,src){ var im; if(zfImgs[key]&&zfImgs[key].complete&&zfImgs[key].naturalWidth>0){ im=zfImgs[key].cloneNode(false); } else { im=new Image(); im.src=src; } im.draggable=false; im.alt=''; return im; }
      var zfbs=bs.getBoundingClientRect();
      var zfbx=zfbs.left+zfbs.width/2, zfby=zfbs.top+zfbs.height*0.45;
      // ===== ① 僵尸驾到: 虚影蹦跳两段 + 磷火(v558 验证模式) =====
      var zfapex=hbaRxEl('hba-zf-apex', zfbx, zfby, Math.round(120*zfsz), Math.round(120*zfsz));
      zfapex.innerHTML='<img src="bosses/lv05.webp?v=908" alt="" draggable="false">';
      try{ zfapex.animate([
        {opacity:0,transform:'translate(-50%,-50%) translate(0,0) scale(.85)'},
        {opacity:.62,transform:'translate(-50%,-50%) translate(0,-26px) scale(1.05)',offset:.25},
        {opacity:.62,transform:'translate(-50%,-50%) translate(0,6px) scale(1.18)',offset:.45},
        {opacity:.58,transform:'translate(-50%,-50%) translate(0,-30px) scale(1.38)',offset:.7},
        {opacity:0,transform:'translate(-50%,-50%) translate(0,10px) scale(1.62)'}
      ],{duration:ZFT(520),easing:'cubic-bezier(.35,.5,.4,1)',fill:'forwards'}); }catch(e){}
      rm(zfapex,ZFT(580));
      var zfgi; // 磷火循环变量(setTimeout 外)
      for(zfgi=0;zfgi<2;zfgi++){ (function(k){ setTimeout(function(){
        var gf=hbaRxEl('hba-zf-ghfire', zfbx+(k?52:-48)*zfsz, zfby+14, Math.round(20*zffxi), Math.round(26*zffxi));
        try{ gf.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(8px) scale(.6)'},{opacity:.92,transform:'translate(-50%,-50%) translateY(-26px) scale(1.08)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) translateY(-58px) scale(.8)'}],{duration:ZFT(620),easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(gf,ZFT(680));
      }, ZFT(k*150)); })(zfgi); }
      // ===== ② 符咒定身: 飞贴 + 束缚圈 + 全程挣扎抖动(总命中才炸) =====
      var zfTW=Math.round(Math.max(86, Math.min(zfvw*0.27, 130))*zfsz);
      var zfTH=Math.round(zfTW*582/280);
      var zfTX=zfhx, zfTY=zfhy-Math.round(zfTH*0.12);
      var zfTali=null;
      setTimeout(function(){
        zfTali=hbaRxEl('hba-zf-tali', zfTX, zfTY, zfTW, zfTH);
        zfTali.appendChild(zfImg('tl','bosses/zb_talisman.webp?v=908'));
        var fdx=zfbx-zfTX, fdy=zfby-zfTY;
        try{ zfTali.animate([
          {opacity:0,transform:'translate(-50%,-50%) translate('+fdx+'px,'+fdy+'px) scale(.3) rotate(-340deg)'},
          {opacity:1,transform:'translate(-50%,-50%) translate('+(fdx*.5)+'px,'+(fdy*.5-44)+'px) scale(.66) rotate(-160deg)',offset:.5},
          {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1.06) rotate(0deg)',offset:.96},
          {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1) rotate(0deg)'}
        ],{duration:ZFT(380),easing:'cubic-bezier(.3,.4,.6,1)',fill:'forwards'}); }catch(e){}
        // "啪"贴住: squash 弹性 + 束缚圈×2
        setTimeout(function(){
          if(!zfTali)return;
          try{ zfTali.animate([{transform:'translate(-50%,-50%) scale(1.18,.84)'},{transform:'translate(-50%,-50%) scale(.94,1.07)',offset:.45},{transform:'translate(-50%,-50%) scale(1,1)'}],{duration:ZFT(220),easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'}); }catch(e){}
          var zfwi; // 波纹/束缚循环变量(setTimeout 外)
          for(zfwi=0;zfwi<2;zfwi++){ (function(j){ setTimeout(function(){
            var rg2=hbaRxEl('hba-zf-ring', zfTX, zfTY, 12, 12);
            try{ rg2.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(13+j*5)+')'}],{duration:ZFT(460),easing:'cubic-bezier(.2,.6,.4,1)',fill:'forwards'}); }catch(e){}
            rm(rg2,ZFT(520));
            var bd=hbaRxEl('hba-zf-bind', zfTX, zfTY+10, Math.round(150*zfsz), Math.round(54*zfsz));
            try{ bd.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1.5)'},{opacity:.9,transform:'translate(-50%,-50%) scale(1)',offset:.4},{opacity:.85,transform:'translate(-50%,-50%) scale(1.04)',offset:.7},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:ZFT(560),easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(bd,ZFT(620));
          }, ZFT(120+j*240)); })(zfwi); }
        }, ZFT(380));
        // 挣扎抖动(830ms 后开始, 高频小幅, 持续到总命中前 ≈2100ms): 被定住的挣扎感
        setTimeout(function(){
          if(!zfTali)return;
          var kf=[], steps=22, zk;
          for(zk=0;zk<=steps;zk++){
            var jx=(zk===0||zk===steps)?0:(Math.random()*5-2.5), jy=(zk===0||zk===steps)?0:(Math.random()*3-1.5);
            kf.push({transform:'translate(-50%,-50%) translate('+jx.toFixed(1)+'px,'+jy.toFixed(1)+'px)',offset:zk/steps});
          }
          try{ zfTali.animate(kf,{duration:ZFT(2100),easing:'linear',fill:'forwards'}); }catch(e){}
        }, ZFT(830));
      }, ZFT(420));
      // ===== ③ 万拳齐发: 左右斜向冲脸交替×8 → 百拳全景压轴 =====
      var zfFW=Math.round(Math.max(150, Math.min(zfvw*0.46, 230))*zfsz);
      function zfPunch(t0, side, ofs){
        var sgn=(side==='l')?1:-1;                                  // 左拳自左下来(sgn=1), 右拳镜像
        var px=zfhx+ofs*zfsz, py=zfhy+(side==='l'?6:-6)*zfsz;       // 命中点左右交替偏移+微高低差=交叉重拳
        var key=(side==='l')?'fl':'fr';
        setTimeout(function(){
          var fi=hbaRxEl('hba-zf-fist', px, py, zfFW, zfFW);
          fi.appendChild(zfImg(key, side==='l'?'bosses/zf_fist_l.webp?v=908':'bosses/zf_fist_r.webp?v=908'));
          var fromX=-sgn*Math.round(zfvw*0.34), fromY=Math.round(zfFW*0.26);
          try{ fi.animate([
            {opacity:0,transform:'translate(-50%,-50%) translate('+fromX+'px,'+fromY+'px) scale(.3) rotate('+(sgn*-10)+'deg)',filter:'blur(4px)'},
            {opacity:1,transform:'translate(-50%,-50%) translate('+(fromX*.4)+'px,'+(fromY*.4)+'px) scale(.62) rotate('+(sgn*-5)+'deg)',filter:'blur(2px)',offset:.45},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1.05) rotate(0deg)',filter:'blur(0)',offset:.6},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(.96) rotate(0deg)',filter:'blur(0)',offset:.7},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1) rotate(0deg)',filter:'blur(0)',offset:.82},
            {opacity:0,transform:'translate(-50%,-50%) translate('+(sgn*22)+'px,-10px) scale(.8)',filter:'blur(1px)'}
          ],{duration:ZFT(210),easing:'cubic-bezier(.5,0,.5,1)',fill:'forwards'}); }catch(e){}
          rm(fi,ZFT(260));
        }, ZFT(t0));
        // 命中 t0+125: 白闪 + 冲击环 + 速度线×6 + 符纸屑×2
        setTimeout(function(){
          var fl=hbaRxEl('hba-zf-flash', px, py, Math.round(zfFW*0.8), Math.round(zfFW*0.8));
          try{ fl.animate([{opacity:.92,transform:'translate(-50%,-50%) scale(.4)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.15)'}],{duration:ZFT(190),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(fl,ZFT(230));
          var im2=hbaRxEl('hba-zf-impact', px, py, 14, 14);
          try{ im2.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(8+Math.random()*3)+')'}],{duration:ZFT(280),easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'}); }catch(e){}
          rm(im2,ZFT(320));
          var zfli; // 速度线循环变量(setTimeout 外)
          for(zfli=0;zfli<6;zfli++){ (function(j){
            var ln=hbaRxEl('hba-zf-line', px, py, Math.round(38*zffxi), Math.round(4*zffxi));
            var a=360*j/6+Math.random()*24;
            ln.style.transform='translate(-50%,-50%) rotate('+a+'deg)';
            try{ ln.animate([{opacity:.95,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX(12px) scaleX(.4)'},{opacity:.85,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX('+Math.round(34*zffxi)+'px) scaleX(1)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX('+Math.round(54*zffxi)+'px) scaleX(.5)'}],{duration:ZFT(200),easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(ln,ZFT(240));
          })(zfli); }
          var zfpi; // 符纸屑循环变量(setTimeout 外)
          for(zfpi=0;zfpi<2;zfpi++){ (function(j){
            var pp=hbaRxEl('hba-zf-paper', px, py, Math.round((8+Math.random()*7)*zffxi), Math.round((10+Math.random()*8)*zffxi));
            var ang=Math.random()*6.28, ds=28+Math.random()*42;
            try{ pp.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)'},{opacity:0,transform:'translate(-50%,-50%) translate('+(Math.cos(ang)*ds)+'px,'+(Math.sin(ang)*ds+30)+'px) rotate('+(160+Math.random()*240)+'deg)'}],{duration:ZFT(440),easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
            rm(pp,ZFT(500));
          })(zfpi); }
        }, ZFT(t0+125));
      }
      zfPunch(1350,'l', 26);
      zfPunch(1530,'r',-26);
      zfPunch(1695,'l', 30);
      zfPunch(1845,'r',-30);
      zfPunch(1985,'l', 24);
      zfPunch(2115,'r',-24);
      zfPunch(2235,'l', 28);
      zfPunch(2345,'r',-28);
      // 压轴: 新百拳全景冲满屏 → 总命中(符炸裂) → deal → 淡出
      var zfAW=Math.round(Math.min(zfvw*1.08, 640)*zfsz);
      var zfAll=null;
      setTimeout(function(){
        zfAll=hbaRxEl('hba-zf-all', zfhx, zfhy-Math.round(zfAW*0.04), zfAW, zfAW);
        zfAll.appendChild(zfImg('al','bosses/zf_fists_all.webp?v=908'));
        try{ zfAll.animate([
          {opacity:0,transform:'translate(-50%,-50%) scale(.2)',filter:'blur(6px)'},
          {opacity:1,transform:'translate(-50%,-50%) scale(.5)',filter:'blur(3px)',offset:.4},
          {opacity:1,transform:'translate(-50%,-50%) scale(1.3)',filter:'blur(0)'}
        ],{duration:ZFT(360),easing:'cubic-bezier(.6,0,.85,.35)',fill:'forwards'}); }catch(e){}
      }, ZFT(2600));
      // 总命中 2960: 最强白闪 + 三重冲击环 + 符炸裂金碎片(定身解除) + deal
      setTimeout(function(){
        var gf2=hbaRxEl('hba-zf-bigflash', zfhx, zfhy, Math.round(zfvw*0.95), Math.round(zfvw*0.7));
        try{ gf2.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.55,transform:'translate(-50%,-50%) scale(1)',offset:.45},{opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}],{duration:ZFT(340),easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(gf2,ZFT(380));
        var zfri; // 三重冲击环循环变量(setTimeout 外)
        for(zfri=0;zfri<3;zfri++){ (function(j){ setTimeout(function(){
          var ir=hbaRxEl('hba-zf-impact', zfhx, zfhy, 16, 16);
          try{ ir.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(15+j*6)+')'}],{duration:ZFT(420),easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'}); }catch(e){}
          rm(ir,ZFT(470));
        }, ZFT(j*90)); })(zfri); }
        // 符炸裂(定身解除)
        if(zfTali){ try{ zfTali.animate([{opacity:1,transform:'translate(-50%,-50%) scale(1.12)',filter:'brightness(1.6)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.5)',filter:'brightness(2)'}],{duration:ZFT(180),easing:'ease-out',fill:'forwards'}); }catch(e){} rm(zfTali,ZFT(230)); }
        var zfsi; // 金碎片循环变量(setTimeout 外)
        for(zfsi=0;zfsi<8;zfsi++){ (function(j){
          var sh=hbaRxEl('hba-zf-shard', zfTX, zfTY, Math.round((7+Math.random()*8)*zffxi), Math.round((10+Math.random()*9)*zffxi));
          var ang=Math.PI*2*j/8+(Math.random()-.5)*.5, ds=55+Math.random()*75;
          var dx=Math.cos(ang)*ds, dy=Math.sin(ang)*ds;
          try{ sh.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1)'},{opacity:1,transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(220+Math.random()*220)+'deg) scale(.9)',offset:.55},{opacity:0,transform:'translate(-50%,-50%) translate('+(dx*1.25)+'px,'+(dy+44)+'px) rotate(480deg) scale(.7)'}],{duration:ZFT(620),easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
          rm(sh,ZFT(680));
        })(zfsi); }
        if(zfAll){ try{ zfAll.animate([{transform:'translate(-50%,-50%) scale(1.3)'},{transform:'translate(-50%,-50%) scale(1.24)',offset:.4},{transform:'translate(-50%,-50%) scale(1.28)'}],{duration:ZFT(220),easing:'ease-out',fill:'forwards'}); }catch(e){}}
        deal();
        setTimeout(function(){
          if(zfAll){ try{ zfAll.animate([{opacity:1,transform:'translate(-50%,-50%) scale(1.28)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.44)',filter:'blur(2px)'}],{duration:ZFT(300),easing:'ease-in',fill:'forwards'}); }catch(e){} rm(zfAll,ZFT(350)); }
          var zffi; // 飘落符纸循环变量(setTimeout 外)
          for(zffi=0;zffi<6;zffi++){ (function(j){
            var pf=hbaRxEl('hba-zf-paper', zfhx+(Math.random()-.5)*zfvw*.5, zfhy-30, Math.round((9+Math.random()*8)*zffxi), Math.round((11+Math.random()*9)*zffxi));
            try{ pf.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)'},{opacity:.9,transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*60)+'px,52px) rotate('+(120+Math.random()*200)+'deg)',offset:.6},{opacity:0,transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*90)+'px,108px) rotate(380deg)'}],{duration:ZFT(760),easing:'cubic-bezier(.4,.2,.7,.8)',fill:'forwards'}); }catch(e){}
            rm(pf,ZFT(830));
          })(zffi); }
        }, ZFT(340));
      }, ZFT(2960));
      return;
    }
    // 🔴 v558: 千年僵尸(Lv5)——封印百拳·定身符爆(Hansen 亲制双素材: '定住你了哈哈'黄符 + 清装僵尸百拳冲脸全景图, 1254px 原图裁剪缩放)。
    //   Hansen: v514 zombiecurse 没达预期; 新设计=符飞来贴住勇者(定身)→符啪一爆炸→上百拳头打过来(好莱坞大片打击感)→掉血。
    //   三段式——
    //   ①僵尸驾到(0~520ms): lv05 虚影绿磷光剪影【蹦跳两段】压近(中式僵尸跳!) + 绿磷火×2 飘起;
    //   ②贴符定身(420~1610ms): 黄符自 boss 旋转翻飞弧线飞出→"啪"贴住勇者(squash 弹性压扁回弹)+金色波纹环×2+束缚金圈脉冲×2(定身感)→符剧烈震颤金光蓄爆→爆裂(白闪+金碎片×8);
    //   ③百拳轰击(1700~3360ms): 单拳 POV 冲脸连击×6(裁剪真拳图, scale .18→1.06+模糊渐清, 错落方位, 间隔 250→170ms 加速), 每拳命中=白闪+冲击环+放射速度线×8+符纸屑×3
    //     → 压轴: 百拳全景图 scale .2→1.28 冲满屏(360ms ease-in 加速) → 总命中: 最强白闪+三重冲击环 → deal → 全图淡出+符纸屑飘落。
    //   打击感(零震屏前提的好莱坞感): POV 冲脸急停 + 冲击环急扩 + 漫画放射速度线瞬现瞬隐 + 白闪 + 回弹, 绝不 transform 页面根节点。
    //   不变量: 零震屏零屏闪 / 禁 tintOverlay / hba-zs 前缀 / 老 zombiecurse(v514) 分支保留勿删(v528 先例) / deal 兜底 dealDelay / 五图预加载 __hbaZsImgs(BUG#67 克隆) / 闭包循环变量全在 setTimeout 外(v554 tt 血案)。
    if(t==='zombieseal'){
      var zsbar=document.querySelector('.hero-hp-bar'), zshx, zshy;
      if(zsbar){ var zsr=zsbar.getBoundingClientRect(); zshx=bc.x; zshy=zsr.top+zsr.height*0.5; }
      else { zshx=hc.x; zshy=hc.y; }
      var zssz=fx.sz||1, zssp=fx.sp||1, zsfxi=fx.fxi||1;
      var ZST=function(ms){return Math.round(ms/zssp);};
      var zsvw=window.innerWidth, zsvh=window.innerHeight;
      var zsImgs=window.__hbaZsImgs||{};
      function zsImg(key,src){ var im; if(zsImgs[key]&&zsImgs[key].complete&&zsImgs[key].naturalWidth>0){ im=zsImgs[key].cloneNode(false); } else { im=new Image(); im.src=src; } im.draggable=false; im.alt=''; return im; }
      var zsbs=bs.getBoundingClientRect();
      var zsbx=zsbs.left+zsbs.width/2, zsby=zsbs.top+zsbs.height*0.45;
      // ===== ① 僵尸驾到: 虚影蹦跳两段压近 + 绿磷火 =====
      var zsapex=hbaRxEl('hba-zs-apex', zsbx, zsby, Math.round(120*zssz), Math.round(120*zssz));
      zsapex.innerHTML='<img src="bosses/lv05.webp?v=908" alt="" draggable="false">';
      try{ zsapex.animate([
        {opacity:0,transform:'translate(-50%,-50%) translate(0,0) scale(.85)'},
        {opacity:.62,transform:'translate(-50%,-50%) translate(0,-26px) scale(1.05)',offset:.25},
        {opacity:.62,transform:'translate(-50%,-50%) translate(0,6px) scale(1.18)',offset:.45},
        {opacity:.58,transform:'translate(-50%,-50%) translate(0,-30px) scale(1.38)',offset:.7},
        {opacity:0,transform:'translate(-50%,-50%) translate(0,10px) scale(1.62)'}
      ],{duration:ZST(520),easing:'cubic-bezier(.35,.5,.4,1)',fill:'forwards'}); }catch(e){}
      rm(zsapex,ZST(580));
      var zsgi; // 磷火循环变量(setTimeout 外)
      for(zsgi=0;zsgi<2;zsgi++){ (function(k){ setTimeout(function(){
        var gf=hbaRxEl('hba-zs-ghfire', zsbx+(k?52:-48)*zssz, zsby+14, Math.round(20*zsfxi), Math.round(26*zsfxi));
        try{ gf.animate([{opacity:0,transform:'translate(-50%,-50%) translateY(8px) scale(.6)'},{opacity:.92,transform:'translate(-50%,-50%) translateY(-26px) scale(1.08)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) translateY(-58px) scale(.8)'}],{duration:ZST(620),easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(gf,ZST(680));
      }, ZST(k*150)); })(zsgi); }
      // ===== ② 贴符定身 → 蓄爆 → 爆裂 =====
      var zsTW=Math.round(Math.max(86, Math.min(zsvw*0.27, 130))*zssz);   // 符宽
      var zsTH=Math.round(zsTW*582/280);
      var zsTaliX=zshx, zsTaliY=zshy-Math.round(zsTH*0.12);
      var zsTali=null;
      setTimeout(function(){
        zsTali=hbaRxEl('hba-zs-tali', zsTaliX, zsTaliY, zsTW, zsTH);
        zsTali.appendChild(zsImg('tl','bosses/zb_talisman.webp?v=908'));
        var fdx=zsbx-zsTaliX, fdy=zsby-zsTaliY;
        try{ zsTali.animate([
          {opacity:0,transform:'translate(-50%,-50%) translate('+fdx+'px,'+fdy+'px) scale(.3) rotate(-340deg)'},
          {opacity:1,transform:'translate(-50%,-50%) translate('+(fdx*.5)+'px,'+(fdy*.5-44)+'px) scale(.66) rotate(-160deg)',offset:.5},
          {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1.06) rotate(0deg)',offset:.96},
          {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1) rotate(0deg)'}
        ],{duration:ZST(380),easing:'cubic-bezier(.3,.4,.6,1)',fill:'forwards'}); }catch(e){}
        // "啪"贴住: squash 压扁回弹(到位瞬间)
        setTimeout(function(){
          if(!zsTali)return;
          try{ zsTali.animate([{transform:'translate(-50%,-50%) scale(1.18,.84)'},{transform:'translate(-50%,-50%) scale(.94,1.07)',offset:.45},{transform:'translate(-50%,-50%) scale(1,1)'}],{duration:ZST(220),easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'}); }catch(e){}
          // 金色波纹环×2 + 束缚金圈脉冲×2(定身感)
          var zwi; // 循环变量(setTimeout 外)
          for(zwi=0;zwi<2;zwi++){ (function(j){ setTimeout(function(){
            var rg2=hbaRxEl('hba-zs-ring', zsTaliX, zsTaliY, 12, 12);
            try{ rg2.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(13+j*5)+')'}],{duration:ZST(460),easing:'cubic-bezier(.2,.6,.4,1)',fill:'forwards'}); }catch(e){}
            rm(rg2,ZST(520));
          }, ZST(j*130)); })(zwi); }
          var zbi2; // 束缚圈循环变量(setTimeout 外)
          for(zbi2=0;zbi2<2;zbi2++){ (function(j){ setTimeout(function(){
            var bd=hbaRxEl('hba-zs-bind', zsTaliX, zsTaliY+10, Math.round(150*zssz), Math.round(54*zssz));
            try{ bd.animate([{opacity:0,transform:'translate(-50%,-50%) scale(1.5)'},{opacity:.9,transform:'translate(-50%,-50%) scale(1)',offset:.4},{opacity:.85,transform:'translate(-50%,-50%) scale(1.04)',offset:.7},{opacity:0,transform:'translate(-50%,-50%) scale(1)'}],{duration:ZST(560),easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(bd,ZST(620));
          }, ZST(140+j*260)); })(zbi2); }
        }, ZST(380));
        // 震颤蓄爆(930ms 后): 快速左右微抖 + 金光增强
        setTimeout(function(){
          if(!zsTali)return;
          try{ zsTali.animate([
            {transform:'translate(-50%,-50%) translate(0,0)',filter:'brightness(1)'},
            {transform:'translate(-50%,-50%) translate(-3px,1px)',offset:.15},
            {transform:'translate(-50%,-50%) translate(3px,-1px)',offset:.3},
            {transform:'translate(-50%,-50%) translate(-4px,0)',offset:.45},
            {transform:'translate(-50%,-50%) translate(4px,1px)',offset:.6},
            {transform:'translate(-50%,-50%) translate(-3px,-1px)',offset:.75},
            {transform:'translate(-50%,-50%) translate(0,0) scale(1.12)',filter:'brightness(1.65) drop-shadow(0 0 22px rgba(255,200,60,.95))'}
          ],{duration:ZST(260),easing:'linear',fill:'forwards'}); }catch(e){}
        }, ZST(930));
        // 爆裂(1190ms 后): 白闪 + 金碎片×8 + 符消失
        setTimeout(function(){
          var bf=hbaRxEl('hba-zs-flash', zsTaliX, zsTaliY, Math.round(170*zssz), Math.round(170*zssz));
          try{ bf.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.35)'},{opacity:.55,transform:'translate(-50%,-50%) scale(1)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) scale(1.3)'}],{duration:ZST(280),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(bf,ZST(320));
          if(zsTali){ try{ zsTali.animate([{opacity:1,transform:'translate(-50%,-50%) scale(1.12)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.5)'}],{duration:ZST(160),easing:'ease-out',fill:'forwards'}); }catch(e){} rm(zsTali,ZST(200)); }
          var zsi; // 金碎片循环变量(setTimeout 外)
          for(zsi=0;zsi<8;zsi++){ (function(j){
            var sh=hbaRxEl('hba-zs-shard', zsTaliX, zsTaliY, Math.round((7+Math.random()*8)*zsfxi), Math.round((10+Math.random()*9)*zsfxi));
            var ang=Math.PI*2*j/8+(Math.random()-.5)*.5, ds=55+Math.random()*75;
            var dx=Math.cos(ang)*ds, dy=Math.sin(ang)*ds;
            try{ sh.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg) scale(1)'},{opacity:1,transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(220+Math.random()*220)+'deg) scale(.9)',offset:.55},{opacity:0,transform:'translate(-50%,-50%) translate('+(dx*1.25)+'px,'+(dy+44)+'px) rotate(480deg) scale(.7)'}],{duration:ZST(620),easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
            rm(sh,ZST(680));
          })(zsi); }
        }, ZST(1190));
      }, ZST(420));
      // ===== ③ 百拳轰击: 单拳 POV 冲脸×6 → 百拳全景压轴 =====
      var zsFW=Math.round(Math.max(120, Math.min(zsvw*0.4, 200))*zssz);   // 单拳尺寸
      function zsPunch(t0, ox, oy, key){
        var px=zshx+ox*zssz, py=zshy+oy*zssz;
        // 冲脸: scale .18→1.06 + 模糊渐清, 急停回弹撤出
        setTimeout(function(){
          var fi=hbaRxEl('hba-zs-fist', px, py, zsFW, zsFW);
          fi.appendChild(zsImg(key,'bosses/'+key+'.webp?v=908'));
          try{ fi.animate([
            {opacity:0,transform:'translate(-50%,-50%) scale(.18)',filter:'blur(5px) brightness(1.15)'},
            {opacity:1,transform:'translate(-50%,-50%) scale(.55)',filter:'blur(2px) brightness(1.1)',offset:.42},
            {opacity:1,transform:'translate(-50%,-50%) scale(1.06)',filter:'blur(0) brightness(1)',offset:.52},
            {opacity:1,transform:'translate(-50%,-50%) scale(.97)',filter:'blur(0)',offset:.62},
            {opacity:1,transform:'translate(-50%,-50%) scale(1)',filter:'blur(0)',offset:.78},
            {opacity:0,transform:'translate(-50%,-50%) scale(.78)',filter:'blur(1px)'}
          ],{duration:ZST(260),easing:'cubic-bezier(.55,0,.45,1)',fill:'forwards'}); }catch(e){}
          rm(fi,ZST(310));
        }, ZST(t0));
        // 命中 t0+135: 白闪 + 冲击环 + 速度线×8 + 符纸屑×3
        setTimeout(function(){
          var fl=hbaRxEl('hba-zs-flash', px, py, Math.round(zsFW*0.85), Math.round(zsFW*0.85));
          try{ fl.animate([{opacity:.92,transform:'translate(-50%,-50%) scale(.4)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.15)'}],{duration:ZST(200),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(fl,ZST(240));
          var im2=hbaRxEl('hba-zs-impact', px, py, 14, 14);
          try{ im2.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(9+Math.random()*3)+')'}],{duration:ZST(300),easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'}); }catch(e){}
          rm(im2,ZST(340));
          var zli; // 速度线循环变量(setTimeout 外)
          for(zli=0;zli<8;zli++){ (function(j){
            var ln=hbaRxEl('hba-zs-line', px, py, Math.round(40*zsfxi), Math.round(4*zsfxi));
            var a=360*j/8+Math.random()*20;
            ln.style.transform='translate(-50%,-50%) rotate('+a+'deg)';
            try{ ln.animate([{opacity:.95,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX(12px) scaleX(.4)'},{opacity:.85,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX('+Math.round(36*zsfxi)+'px) scaleX(1)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) rotate('+a+'deg) translateX('+Math.round(58*zsfxi)+'px) scaleX(.5)'}],{duration:ZST(220),easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(ln,ZST(260));
          })(zli); }
          var zpi; // 符纸屑循环变量(setTimeout 外)
          for(zpi=0;zpi<3;zpi++){ (function(j){
            var pp=hbaRxEl('hba-zs-paper', px, py, Math.round((8+Math.random()*7)*zsfxi), Math.round((10+Math.random()*8)*zsfxi));
            var ang=Math.random()*6.28, ds=30+Math.random()*46;
            try{ pp.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)'},{opacity:0,transform:'translate(-50%,-50%) translate('+(Math.cos(ang)*ds)+'px,'+(Math.sin(ang)*ds+34)+'px) rotate('+(160+Math.random()*240)+'deg)'}],{duration:ZST(480),easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
            rm(pp,ZST(540));
          })(zpi); }
        }, ZST(t0+135));
      }
      zsPunch(1700, -42, -26, 'zb_fist1');
      zsPunch(1950,  46, -10, 'zb_fist2');
      zsPunch(2180, -30,  22, 'zb_fist3');
      zsPunch(2390,  34, -34, 'zb_fist2');
      zsPunch(2580, -48,   6, 'zb_fist1');
      zsPunch(2750,  12,  14, 'zb_fist3');
      // 压轴: 百拳全景冲满屏 → 总命中 deal → 淡出
      var zsAW=Math.round(Math.min(zsvw*1.05, 620)*zssz);
      var zsAll=null;
      setTimeout(function(){
        zsAll=hbaRxEl('hba-zs-all', zshx, zshy-Math.round(zsAW*0.04), zsAW, zsAW);
        zsAll.appendChild(zsImg('al','bosses/zb_fists_all.webp?v=908'));
        try{ zsAll.animate([
          {opacity:0,transform:'translate(-50%,-50%) scale(.2)',filter:'blur(6px)'},
          {opacity:1,transform:'translate(-50%,-50%) scale(.5)',filter:'blur(3px)',offset:.4},
          {opacity:1,transform:'translate(-50%,-50%) scale(1.28)',filter:'blur(0)'}
        ],{duration:ZST(360),easing:'cubic-bezier(.6,0,.85,.35)',fill:'forwards'}); }catch(e){}
      }, ZST(3000));
      // 总命中 3360: 最强白闪 + 三重冲击环 + deal
      setTimeout(function(){
        var gf2=hbaRxEl('hba-zs-bigflash', zshx, zshy, Math.round(zsvw*0.95), Math.round(zsvw*0.7));
        try{ gf2.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.55,transform:'translate(-50%,-50%) scale(1)',offset:.45},{opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}],{duration:ZST(340),easing:'ease-out',fill:'forwards'}); }catch(e){}
        rm(gf2,ZST(380));
        var zri; // 三重冲击环循环变量(setTimeout 外)
        for(zri=0;zri<3;zri++){ (function(j){ setTimeout(function(){
          var ir=hbaRxEl('hba-zs-impact', zshx, zshy, 16, 16);
          try{ ir.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale('+(15+j*6)+')'}],{duration:ZST(420),easing:'cubic-bezier(.2,.7,.4,1)',fill:'forwards'}); }catch(e){}
          rm(ir,ZST(470));
        }, ZST(j*90)); })(zri); }
        if(zsAll){ try{ zsAll.animate([{transform:'translate(-50%,-50%) scale(1.28)'},{transform:'translate(-50%,-50%) scale(1.22)',offset:.4},{transform:'translate(-50%,-50%) scale(1.26)'}],{duration:ZST(220),easing:'ease-out',fill:'forwards'}); }catch(e){}}
        deal();
        // 全图淡出 + 符纸屑×6 飘落
        setTimeout(function(){
          if(zsAll){ try{ zsAll.animate([{opacity:1,transform:'translate(-50%,-50%) scale(1.26)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.42)',filter:'blur(2px)'}],{duration:ZST(300),easing:'ease-in',fill:'forwards'}); }catch(e){} rm(zsAll,ZST(350)); }
          var zfi; // 飘落符纸循环变量(setTimeout 外)
          for(zfi=0;zfi<6;zfi++){ (function(j){
            var pf=hbaRxEl('hba-zs-paper', zshx+(Math.random()-.5)*zsvw*.5, zshy-30, Math.round((9+Math.random()*8)*zsfxi), Math.round((11+Math.random()*9)*zsfxi));
            try{ pf.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)'},{opacity:.9,transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*60)+'px,52px) rotate('+(120+Math.random()*200)+'deg)',offset:.6},{opacity:0,transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*90)+'px,108px) rotate(380deg)'}],{duration:ZST(760),easing:'cubic-bezier(.4,.2,.7,.8)',fill:'forwards'}); }catch(e){}
            rm(pf,ZST(830));
          })(zfi); }
        }, ZST(340));
      }, ZST(3360));
      return;
    }
    // 🔴 v514: 千年僵尸(Lv5)——符咒尸毒连击(Hansen 定稿)。①阴风鬼火 ②飞符诅咒(黄纸红符贴勇者头顶) ③双尸爪抓击·三道腐蚀爪痕冒毒泡 ④符咒炸裂引爆尸毒(deal)。全SVG内联无外部图·零震屏零屏闪。
    if(t==='zombiecurse'){
      var zbar=document.querySelector('.hero-hp-bar'), zhx, zhy;
      if(zbar){ var zbr=zbar.getBoundingClientRect(); zhx=bc.x; zhy=zbr.top+zbr.height*0.42; }
      else { zhx=hc.x; zhy=hc.y; }
      var zbs=bs.getBoundingClientRect();
      var zbx=zbs.left+zbs.width/2, zby=zbs.bottom-zbs.height*0.15;
      hbaZombieCurse(zbx,zby,zhx,zhy,fx,deal);
      return;
    }
    // 🔴 v555: 史前霸王龙(Lv4)——远古之怒·灭绝之颚(Hansen 亲制四件套真图: 左爪撕痕/右爪撕痕/上颚獠牙/下颚獠牙, 1254px 原图切割缩放至 720px)。
    //   Hansen: v554 的陨石太烂弃用; 新结构=左爪抓一下→右爪抓一下→最后巨口咬血条(上下牙从张开到咬合), 血条整体出血。
    //   三段式——
    //   ①霸主驾到(0~460ms): lv04 虚影血红霸主光猛然压近 + 双咆哮音波(复用 RxWaveSVG)轰向勇者;
    //   ②双爪撕裂(430~1300ms): 白色刀光先扫(速度感)→ 左爪三趾撕痕(真图)自左上扑入定格·命中白闪+琥珀碎屑+血溅 → 右爪镜像自右上扑入交叉撕;
    //   ③灭绝之颚(1250~2550ms): 上颚自屏顶探入+下颚自屏底升起·对准勇者血条大张悬停(血条暴露于巨口中央)·蓄势微颤+琥珀辉光
    //     → 猛然咬合(牙尖交错锁死血条)→ 命中: 爆闪+咬合再压紧微动+血条红色出血覆盖层脉冲+血珠×7滴落+bloodSplatter → deal → 双颚弹开退场。
    //   不变量: 零震屏零屏闪 / 禁 tintOverlay / 全 fixed 贴 __hansenFxLayer / hba-rf 前缀 / 老 rexapex(v554)+dinocombo(v513) 分支全保留勿删(v528 先例) / deal 兜底 dealDelay。
    //   坑防: 闭包变量全部定义在 IIFE 顶部 setTimeout 外(v554 tt 血案); 全程 element.animate(fill:forwards) 不用 .go 过渡(踩坑#1); 四图预加载 __hbaRfImgs cloneNode(BUG#67)。
    if(t==='rexfury'){
      var rfbar=document.querySelector('.hero-hp-bar'), rfbx,rfby,rfbw,rfbh;
      if(rfbar){ var rfbr=rfbar.getBoundingClientRect(); rfbx=bc.x; rfby=rfbr.top+rfbr.height/2; rfbw=rfbr.width; rfbh=rfbr.height; }
      else { rfbx=hc.x; rfby=hc.y; rfbw=200; rfbh=9; }
      var rfsz=fx.sz||1, rfsp=fx.sp||1, rffxi=fx.fxi||1;
      var RFT=function(ms){return Math.round(ms/rfsp);};
      var rfvw=window.innerWidth, rfvh=window.innerHeight;
      var rfImgs=window.__hbaRfImgs||{};
      function rfImg(key,src){ var im; if(rfImgs[key]&&rfImgs[key].complete&&rfImgs[key].naturalWidth>0){ im=rfImgs[key].cloneNode(false); } else { im=new Image(); im.src=src; } im.draggable=false; im.alt=''; return im; }
      // ===== ① 霸主驾到 (0~460ms) =====
      var rfapex=hbaRxEl('hba-rf-apex', bc.x, bc.y, Math.round(128*rfsz), Math.round(128*rfsz));
      rfapex.innerHTML='<img src="bosses/lv04.webp?v=908" alt="" draggable="false">';
      try{ rfapex.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.82)'},{opacity:.66,transform:'translate(-50%,-50%) scale(1.3)',offset:.45},{opacity:.5,transform:'translate(-50%,-50%) scale(1.68)',offset:.8},{opacity:0,transform:'translate(-50%,-50%) scale(1.92)'}],{duration:RFT(460),easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'}); }catch(e){}
      rm(rfapex,RFT(520));
      var rfwk; // 咆哮波循环变量(定义在 setTimeout 外)
      for(rfwk=0;rfwk<2;rfwk++){ (function(k){ setTimeout(function(){
        var w=Math.round(122*rfsz), h=Math.round(w*56/120);
        var wv=hbaRxEl('hba-rf-wave', bc.x-w/2+(k-1)*30, bc.y-4, w, h); wv.innerHTML=hbaRxWaveSVG();
        var tx=(hc.x-bc.x), ty=(hc.y-bc.y);
        try{ wv.animate([{opacity:.9,transform:'translate(0,0) scale(.55)'},{opacity:.85,transform:'translate('+(tx*.6)+'px,'+(ty*.6)+'px) scale(1.05)',offset:.62},{opacity:0,transform:'translate('+tx+'px,'+ty+'px) scale(1.35)'}],{duration:RFT(400),easing:'cubic-bezier(.25,.5,.45,1)',fill:'forwards'}); }catch(e){}
        rm(wv,RFT(450));
      }, RFT(k*140)); })(rfwk); }
      // ===== ② 双爪撕裂 (430~1300ms) =====
      var rfCW=Math.round(Math.max(290, Math.min(rfvw*0.8, 480))*rfsz);
      function rfClawStrike(side, t0){
        var sgn=(side==='l')?1:-1;                      // 左爪从左上来(向右下撕), 右爪镜像
        var cx=hc.x - sgn*Math.round(rfCW*0.10);        // 左爪略偏左, 右爪略偏右 → 交叉撕
        var cy=hc.y - Math.round(rfCW*0.06);
        // 先行白色刀光(速度感)
        setTimeout(function(){
          var sl=hbaRxEl('hba-rf-slash', cx, cy, Math.round(rfCW*1.05), Math.round(10*rfsz));
          sl.style.transform='translate(-50%,-50%) rotate('+(sgn*38)+'deg)';
          try{ sl.animate([{opacity:0,transform:'translate(-50%,-50%) rotate('+(sgn*38)+'deg) translateX('+(-sgn*rfCW*0.55)+'px) scaleX(.3)'},{opacity:1,transform:'translate(-50%,-50%) rotate('+(sgn*38)+'deg) translateX(0) scaleX(1.05)',offset:.55},{opacity:0,transform:'translate(-50%,-50%) rotate('+(sgn*38)+'deg) translateX('+(sgn*rfCW*0.5)+'px) scaleX(.5)'}],{duration:RFT(170),easing:'cubic-bezier(.2,.7,.5,1)',fill:'forwards'}); }catch(e){}
          rm(sl,RFT(220));
        }, RFT(t0));
        // 爪痕真图扑入
        setTimeout(function(){
          var cl=hbaRxEl('hba-rf-claw', cx, cy, rfCW, rfCW);
          cl.appendChild(rfImg(side==='l'?'cl':'cr', side==='l'?'bosses/rexclaw_l.webp?v=908':'bosses/rexclaw_r.webp?v=908'));
          var fromX=-sgn*Math.round(rfCW*0.34), fromY=-Math.round(rfCW*0.3);
          try{ cl.animate([
            {opacity:0,transform:'translate(-50%,-50%) translate('+fromX+'px,'+fromY+'px) scale(.5) rotate('+(sgn*-9)+'deg)'},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1.12) rotate(0deg)',offset:.22},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,0) scale(1.03) rotate(0deg)',offset:.34},
            {opacity:1,transform:'translate(-50%,-50%) translate(0,'+Math.round(6*rfsz)+'px) scale(1.03) rotate(0deg)',offset:.86},
            {opacity:0,transform:'translate(-50%,-50%) translate(0,'+Math.round(16*rfsz)+'px) scale(.98) rotate(0deg)'}
          ],{duration:RFT(700),easing:'cubic-bezier(.3,.6,.35,1)',fill:'forwards'}); }catch(e){}
          rm(cl,RFT(760));
        }, RFT(t0+70));
        // 命中: 白闪 + 琥珀碎屑×6 + 血溅
        setTimeout(function(){
          var fl=hbaRxEl('hba-rf-flash', cx, cy, Math.round(rfCW*0.5), Math.round(rfCW*0.5));
          try{ fl.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(.4)'},{opacity:.5,transform:'translate(-50%,-50%) scale(1)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) scale(1.25)'}],{duration:RFT(240),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(fl,RFT(280));
          var di; // 碎屑循环变量(setTimeout 外)
          for(di=0;di<6;di++){ (function(j){
            var db=hbaRxEl('hba-rf-deb', cx, cy, Math.round((5+Math.random()*7)*rffxi), Math.round((5+Math.random()*7)*rffxi));
            var ang=Math.PI*2*j/6+(Math.random()-.5)*.7, ds=40+Math.random()*70;
            var dx=Math.cos(ang)*ds, dy=Math.sin(ang)*ds-20, gy=dy+50+Math.random()*30;
            try{ db.animate([{opacity:1,transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)'},{opacity:1,transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px) rotate('+(180+Math.random()*180)+'deg)',offset:.5},{opacity:0,transform:'translate(-50%,-50%) translate('+(dx*1.2)+'px,'+gy+'px) rotate(360deg)'}],{duration:RFT(520),easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
            rm(db,RFT(580));
          })(di); }
          try{ bloodSplatter(cx+(Math.random()-.5)*20, cy+(Math.random()-.5)*16); }catch(e){}
        }, RFT(t0+185));
      }
      rfClawStrike('l', 430);
      rfClawStrike('r', 880);
      // ===== ③ 灭绝之颚 (1250~2550ms): 双颚对准血条·张开→咬合→出血 =====
      var rfJW=Math.round(Math.max(270, Math.min(rfbw*1.3, rfvw*0.92, 560))*rfsz);
      var rfJHt=Math.round(rfJW*386/720), rfJHb=Math.round(rfJW*334/720);
      var rfOV=Math.round(rfJW*160/720);            // 咬合时上下颚重叠量(原图标度 160/720)
      var rfGAP=Math.round(rfJW*0.17);              // 大张悬停时, 在咬合位基础上各退开的距离
      // 咬合终态 top(fixed 坐标): 上颚 bottom 压到 rfby+ov/2, 下颚 top 顶到 rfby-ov/2
      var rfTopBite=rfby+rfOV/2-rfJHt, rfBotBite=rfby-rfOV/2;
      var rfTopHold=rfTopBite-rfGAP,   rfBotHold=rfBotBite+rfGAP;
      var rfJawT=null, rfJawB=null;
      setTimeout(function(){
        rfJawT=hbaRxEl('hba-rf-jaw', rfbx, 0, rfJW, rfJHt); rfJawT.style.top='0px'; rfJawT.style.transform='translateX(-50%)';
        rfJawT.appendChild(rfImg('jt','bosses/rexjaw_top.webp?v=908'));
        rfJawB=hbaRxEl('hba-rf-jaw', rfbx, 0, rfJW, rfJHb); rfJawB.style.top='0px'; rfJawB.style.transform='translateX(-50%)';
        rfJawB.appendChild(rfImg('jb','bosses/rexjaw_bot.webp?v=908'));
        // 入场: 屏外 → 悬停位(大张, 血条暴露巨口中央)
        try{ rfJawT.animate([{transform:'translateX(-50%) translateY('+(-rfJHt-20)+'px)'},{transform:'translateX(-50%) translateY('+rfTopHold+'px)'}],{duration:RFT(320),easing:'cubic-bezier(.25,.6,.3,1)',fill:'forwards'}); }catch(e){}
        try{ rfJawB.animate([{transform:'translateX(-50%) translateY('+(rfvh+20)+'px)'},{transform:'translateX(-50%) translateY('+rfBotHold+'px)'}],{duration:RFT(320),easing:'cubic-bezier(.25,.6,.3,1)',fill:'forwards'}); }catch(e){}
        // 蓄势微颤(330ms): 小幅再张 → 回悬停(饥饿感)
        setTimeout(function(){
          if(!rfJawT||!rfJawB)return;
          var jit=Math.round(rfGAP*0.34);
          try{ rfJawT.animate([{transform:'translateX(-50%) translateY('+rfTopHold+'px)'},{transform:'translateX(-50%) translateY('+(rfTopHold-jit)+'px)',offset:.5},{transform:'translateX(-50%) translateY('+rfTopHold+'px)'}],{duration:RFT(300),easing:'ease-in-out',fill:'forwards'}); }catch(e){}
          try{ rfJawB.animate([{transform:'translateX(-50%) translateY('+rfBotHold+'px)'},{transform:'translateX(-50%) translateY('+(rfBotHold+jit)+'px)',offset:.5},{transform:'translateX(-50%) translateY('+rfBotHold+'px)'}],{duration:RFT(300),easing:'ease-in-out',fill:'forwards'}); }catch(e){}
        }, RFT(330));
        // 猛然咬合(110ms, ease-in 加速) → 命中
        setTimeout(function(){
          if(!rfJawT||!rfJawB)return;
          try{ rfJawT.animate([{transform:'translateX(-50%) translateY('+rfTopHold+'px)'},{transform:'translateX(-50%) translateY('+rfTopBite+'px)'}],{duration:RFT(110),easing:'cubic-bezier(.7,0,.9,.4)',fill:'forwards'}); }catch(e){}
          try{ rfJawB.animate([{transform:'translateX(-50%) translateY('+rfBotHold+'px)'},{transform:'translateX(-50%) translateY('+rfBotBite+'px)'}],{duration:RFT(110),easing:'cubic-bezier(.7,0,.9,.4)',fill:'forwards'}); }catch(e){}
        }, RFT(660));
        // 命中(入场320+蓄势330+咬合110 ≈ t0+770): 爆闪 + 压紧微动 + 血条出血 + deal
        setTimeout(function(){
          // 爆闪(白+琥珀, 血条中心)
          var bf=hbaRxEl('hba-rf-flash big', rfbx, rfby, Math.round(rfJW*0.82), Math.round(rfJW*0.5));
          bf.className='hba-rf-flash hba-rf-big';
          try{ bf.animate([{opacity:1,transform:'translate(-50%,-50%) scale(.35)'},{opacity:.6,transform:'translate(-50%,-50%) scale(1)',offset:.45},{opacity:0,transform:'translate(-50%,-50%) scale(1.3)'}],{duration:RFT(300),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(bf,RFT(340));
          // 双颚咬住后再压紧微动(2~3px)
          if(rfJawT&&rfJawB){
            try{ rfJawT.animate([{transform:'translateX(-50%) translateY('+rfTopBite+'px)'},{transform:'translateX(-50%) translateY('+(rfTopBite+3)+'px)',offset:.4},{transform:'translateX(-50%) translateY('+rfTopBite+'px)'}],{duration:RFT(180),easing:'ease-out',fill:'forwards'}); }catch(e){}
            try{ rfJawB.animate([{transform:'translateX(-50%) translateY('+rfBotBite+'px)'},{transform:'translateX(-50%) translateY('+(rfBotBite-3)+'px)',offset:.4},{transform:'translateX(-50%) translateY('+rfBotBite+'px)'}],{duration:RFT(180),easing:'ease-out',fill:'forwards'}); }catch(e){}
          }
          // 血条出血: 红色覆盖层脉冲(盖在血条矩形上, 不动游戏 DOM)
          var bl=hbaRxEl('hba-rf-bleed', rfbx, rfby, Math.round(rfbw+8), Math.round(rfbh+8));
          try{ bl.animate([{opacity:0},{opacity:.95,offset:.09},{opacity:.7,offset:.32},{opacity:.92,offset:.46},{opacity:.65,offset:.72},{opacity:0}],{duration:RFT(1150),easing:'ease-out',fill:'forwards'}); }catch(e){}
          rm(bl,RFT(1210));
          // 血珠×7 自血条下沿滴落
          var bi; // 循环变量(setTimeout 外)
          for(bi=0;bi<7;bi++){ (function(j){ setTimeout(function(){
            var px=rfbx-rfbw/2+rfbw*(0.08+0.84*Math.random());
            var dsz=Math.round((5+Math.random()*6)*rffxi);
            var dr=hbaRxEl('hba-rf-drip', px, rfby+rfbh/2, dsz, Math.round(dsz*1.45));
            var fall=46+Math.random()*60;
            try{ dr.animate([{opacity:1,transform:'translate(-50%,-50%) translateY(0) scaleY(1)'},{opacity:1,transform:'translate(-50%,-50%) translateY('+(fall*.55)+'px) scaleY(1.25)',offset:.55},{opacity:0,transform:'translate(-50%,-50%) translateY('+fall+'px) scaleY(1.4)'}],{duration:RFT(560+Math.random()*240),easing:'cubic-bezier(.4,.1,.8,.6)',fill:'forwards'}); }catch(e){}
            rm(dr,RFT(880));
          }, RFT(j*55)); })(bi); }
          try{ bloodSplatter(rfbx, rfby); }catch(e){}
          deal();
          // 咬住 280ms 后双颚反向弹开退场
          setTimeout(function(){
            if(rfJawT){ try{ rfJawT.animate([{transform:'translateX(-50%) translateY('+rfTopBite+'px)',opacity:1},{transform:'translateX(-50%) translateY('+(-rfJHt-30)+'px)',opacity:.9}],{duration:RFT(280),easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'}); }catch(e){} rm(rfJawT,RFT(330)); }
            if(rfJawB){ try{ rfJawB.animate([{transform:'translateX(-50%) translateY('+rfBotBite+'px)',opacity:1},{transform:'translateX(-50%) translateY('+(rfvh+30)+'px)',opacity:.9}],{duration:RFT(280),easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'}); }catch(e){} rm(rfJawB,RFT(330)); }
          }, RFT(280));
        }, RFT(770));
      }, RFT(1330));
      return;
    }
    // 🔴 v513: 史前霸王龙(Lv4)——远古霸主连击(Hansen 定稿)。①震地咆哮 ②地面冲击浪 ③能量巨爪左右双扫·各三道平行撕痕 ④霸王巨口咬合(咬合时 deal)。全SVG内联无外部图·零震屏零屏闪(仅柔光)。
    // 🔴 v554: 史前霸王龙(Lv4)——史前霸主·灭绝之咬(Hansen: dinocombo 太一般, 要绝对吸引人)。三阶段大戏——
    //   ①霸主驾到"吼!!!史前霸主驾到!": lv04 虚影血红霸主光猛然压近 + 三道咆哮音波(复用 RxWaveSVG)轰向勇者 + 底部碎石震跳;
    //   ②远古巨颚"感受远古之力!": 巨型上颚自屏顶探入+下颚自屏底升起, 在勇者血条处悬停蓄势→"咔嚓"合拢咬合(白闪+琥珀碎屑+三道撕痕)→双颚弹开退场;
    //   ③灭绝陨石·化石化"你将化为化石!": 大陨石(复用 hbmMeteorSVG)拖火尾自右上斜砸→命中爆闪+双琥珀环+灰白石化裂纹环扩散+琥珀结晶×5迸立+石化尘→deal。
    //   不变量: 零震屏零屏闪 / 全 fixed 贴 __hansenFxLayer / hba-rx2 前缀 / 老 dinocombo 分支+hbaRexCombo 保留勿删(v528 先例) / deal 兜底 dealDelay 2600。
    if(t==='rexapex'){
      var rxbar=document.querySelector('.hero-hp-bar'), rxx,rxy;
      if(rxbar){ var rxbr=rxbar.getBoundingClientRect(); rxx=bc.x; rxy=rxbr.top+rxbr.height/2; }
      else { rxx=hc.x; rxy=hc.y; }
      var rsz=fx.sz||1, rsp=fx.sp||1, rfxi=fx.fxi||1;
      var RT=function(ms){return Math.round(ms/rsp);};
      var rvw=window.innerWidth, rvh=window.innerHeight;
      // ===== ① 霸主驾到 (0~500ms) =====
      var apex=hbaRxEl('hba-rx2apex', bc.x, bc.y, Math.round(124*rsz), Math.round(124*rsz));
      apex.innerHTML='<img src="bosses/lv04.webp?v=908" alt="" draggable="false">';
      try{ apex.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.85)'},{opacity:.64,transform:'translate(-50%,-50%) scale(1.28)',offset:.42},{opacity:.5,transform:'translate(-50%,-50%) scale(1.66)',offset:.78},{opacity:0,transform:'translate(-50%,-50%) scale(1.9)'}],{duration:RT(460),easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'}); }catch(e){}
      rm(apex,RT(510));
      for(var rwi=0;rwi<3;rwi++){ (function(k){ setTimeout(function(){
        var w=Math.round(126*rsz), h=Math.round(w*56/120);
        var wv=hbaRxEl('hba-rx2wave', bc.x-w/2+(k-1)*26, bc.y-2, w, h); wv.innerHTML=hbaRxWaveSVG();
        var dist=rxy-bc.y;
        try{ wv.animate([{transform:'translateY(0) scale(.5) rotate('+((k-1)*9)+'deg)',opacity:0},{transform:'translateY('+(dist*0.2)+'px) scale(.85) rotate('+((k-1)*9)+'deg)',opacity:.95,offset:.2},{transform:'translateY('+dist+'px) scale(1.55) rotate('+((k-1)*9)+'deg)',opacity:0}],{duration:RT(440),easing:'cubic-bezier(.3,.5,.5,1)',fill:'forwards'}); }catch(e){}
        rm(wv,RT(490)); }, RT(80+k*95)); })(rwi); }
      for(var rpi=0;rpi<5;rpi++){ (function(i){ setTimeout(function(){
        var pb=hbaRxEl('hba-rx2peb', 40+Math.random()*(rvw-80), rvh-14-Math.random()*8, 5+Math.random()*5);
        var jy=-(15+Math.random()*24), jx=(Math.random()-.5)*20;
        try{ pb.animate([{transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+(jx*0.6)+'px,'+jy+'px) rotate('+((Math.random()-.5)*170)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+jx+'px,6px) rotate('+((Math.random()-.5)*320)+'deg)',opacity:0}],{duration:460+Math.random()*160,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
        rm(pb,680); }, RT(40+i*55)); })(rpi); }
      // ===== ② 远古巨颚·咬合 (500~1500ms) =====
      setTimeout(function(){
        var JW=Math.round(216*rsz), JH=Math.round(JW*0.42);
        var gapTop=rxy-Math.round(34*rsz), gapBot=rxy+Math.round(34*rsz);
        var upJ=hbaRxEl('hba-rx2jaw up', rxx-JW/2, -JH-8, JW, JH); upJ.innerHTML=hbaRxJawSVG('x2u'+(_hquu++),'up');
        var dnJ=hbaRxEl('hba-rx2jaw dn', rxx-JW/2, rvh+8, JW, JH); dnJ.innerHTML=hbaRxJawSVG('x2d'+(_hquu++),'down');
        var upTo=gapTop-JH, dnTo=gapBot;
        // 入场+悬停蓄势
        try{ upJ.animate([{transform:'translateY(0)'},{transform:'translateY('+(upTo-(-JH-8))+'px)'}],{duration:RT(300),easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'}); }catch(e){ upJ.style.top=upTo+'px'; }
        try{ dnJ.animate([{transform:'translateY(0)'},{transform:'translateY('+(dnTo-(rvh+8))+'px)'}],{duration:RT(300),easing:'cubic-bezier(.3,.7,.4,1)',fill:'forwards'}); }catch(e){ dnJ.style.top=dnTo+'px'; }
        // 咔嚓合拢
        var snapAt=RT(520), snapDur=RT(120);
        var upSnap=(rxy-Math.round(6*rsz))-JH-upTo, dnSnap=(rxy+Math.round(6*rsz))-dnTo;
        setTimeout(function(){
          try{ upJ.animate([{transform:'translateY('+(upTo-(-JH-8))+'px)'},{transform:'translateY('+(upTo-(-JH-8)+upSnap)+'px)'}],{duration:snapDur,easing:'cubic-bezier(.6,0,.9,.4)',fill:'forwards'}); }catch(e){}
          try{ dnJ.animate([{transform:'translateY('+(dnTo-(rvh+8))+'px)'},{transform:'translateY('+(dnTo-(rvh+8)+dnSnap)+'px)'}],{duration:snapDur,easing:'cubic-bezier(.6,0,.9,.4)',fill:'forwards'}); }catch(e){}
        }, snapAt);
        // 咬合瞬间: 白闪+琥珀碎屑+撕痕三道+血条反馈
        setTimeout(function(){
          var bf=hbaRxEl('hba-rx2biteflash', rxx, rxy, Math.round(58*rfxi)); void bf.offsetWidth; bf.classList.add('go'); rm(bf,300);
          for(var ci=0;ci<6;ci++){ var cs=hbaRxEl('hba-rx2chip', rxx+(Math.random()-.5)*46, rxy+(Math.random()-.5)*14, 4+Math.random()*4);
            var ca=Math.random()*Math.PI*2, cd=(24+Math.random()*38)*rfxi, cdx=Math.cos(ca)*cd, cdy=Math.sin(ca)*cd*0.7;
            try{ cs.animate([{transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+cdx+'px,'+(cdy+24)+'px) rotate('+((Math.random()-.5)*420)+'deg)',opacity:0}],{duration:520+Math.random()*180,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){} rm(cs,740); }
          for(var ti=0;ti<3;ti++){ (function(k){ setTimeout(function(){
            var tw=Math.round(96*rfxi), th=Math.round(tw*0.62);
            var tr=hbaRxEl('hba-rx2tear', rxx-tw/2+(k-1)*30, rxy-th/2, tw, th); tr.innerHTML=hbaRxTearSVG('x2t'+(_hquu++));
            try{ tr.animate([{transform:'scale(.4) rotate('+(-14+k*14)+'deg)',opacity:0},{transform:'scale(1) rotate('+(-14+k*14)+'deg)',opacity:1,offset:.3},{transform:'scale(1.06) rotate('+(-14+k*14)+'deg)',opacity:0}],{duration:RT(320),easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(tr,RT(360)); }, RT(70+k*110)); })(ti); }
          if(rxbar){ rxbar.classList.add('hsn-bite-glow'); setTimeout(function(){rxbar.classList.remove('hsn-bite-glow');},260); }
        }, snapAt+snapDur);
        // 双颚弹开退场
        setTimeout(function(){
          try{ upJ.animate([{transform:'translateY('+(upTo-(-JH-8)+upSnap)+'px)',opacity:1},{transform:'translateY('+(upTo-(-JH-8)+upSnap-12)+'px)',opacity:1,offset:.25},{transform:'translateY('+(upTo-(-JH-8)-70)+'px)',opacity:0}],{duration:RT(330),easing:'ease-in',fill:'forwards'}); }catch(e){}
          try{ dnJ.animate([{transform:'translateY('+(dnTo-(rvh+8)+dnSnap)+'px)',opacity:1},{transform:'translateY('+(dnTo-(rvh+8)+dnSnap+12)+'px)',opacity:1,offset:.25},{transform:'translateY('+(dnTo-(rvh+8)+70)+'px)',opacity:0}],{duration:RT(330),easing:'ease-in',fill:'forwards'}); }catch(e){}
          rm(upJ,RT(380)); rm(dnJ,RT(380));
        }, snapAt+snapDur+RT(360));
      }, RT(500));
      // ===== ③ 灭绝陨石·化石化 (1500ms~) =====
      setTimeout(function(){
        var m0x=rvw*0.86, m0y=-60, mdur=RT(600);
        var MW=Math.round(74*rsz), MH=Math.round(178*rsz);
        var mt=hbaRxEl('hba-rx2meteor', m0x-MW/2, m0y-MH/2, MW, MH);
        mt.style.cssText+=';--mc1:#fff;--mc2:#fde68a;--mc3:#fb923c;--mc4:#dc2626;--mglow:rgba(251,146,60,.9)';  // 🔴 v554: hbmMeteorSVG 依赖 --mc* 变量(v511 机制), 不设则黑块
        mt.innerHTML=hbmMeteorSVG('x2m'+(_hquu++));
        var mdx=rxx-m0x, mdy=rxy-m0y;
        var mang=Math.atan2(mdy,mdx)*180/Math.PI-90;
        try{ mt.animate([
          {transform:'translate(0,0) rotate('+mang+'deg) scale(.7)',opacity:0,offset:0},
          {transform:'translate('+(mdx*0.12)+'px,'+(mdy*0.12)+'px) rotate('+mang+'deg) scale(1)',opacity:1,offset:.12},
          {transform:'translate('+mdx+'px,'+mdy+'px) rotate('+mang+'deg) scale(1.05)',opacity:1,offset:1}
        ],{duration:mdur,easing:'cubic-bezier(.5,.05,.8,.5)',fill:'forwards'}); }catch(e){ mt.style.transform='translate('+mdx+'px,'+mdy+'px)'; mt.style.opacity='1'; }
        for(var mi=0;mi<5;mi++){ (function(k){ var tt=0.18+k*0.16; setTimeout(function(){
          var sx=m0x+mdx*tt+(Math.random()-.5)*16, sy=m0y+mdy*tt+(Math.random()-.5)*16;
          var sp2=hbaRxEl('hba-rx2spark', sx, sy);
          try{ sp2.animate([{transform:'translate(-50%,-50%) scale(1.1)',opacity:.95},{transform:'translate(calc(-50% + '+((Math.random()-.5)*22)+'px), calc(-50% + '+(14+Math.random()*18)+'px)) scale(.3)',opacity:0}],{duration:380,easing:'ease-out',fill:'forwards'}); }catch(e){} rm(sp2,430); }, mdur*tt); })(mi); }
        // 命中: 爆闪+双环+化石化
        setTimeout(function(){
          rm(mt,0);
          var ef=hbaRxEl('hba-rx2biteflash big', rxx, rxy, Math.round(72*rfxi)); void ef.offsetWidth; ef.classList.add('go'); rm(ef,340);
          var er1=hbaRxEl('hba-rxring', rxx, rxy, Math.round(50*rfxi)); void er1.offsetWidth; er1.classList.add('go'); rm(er1,500);
          var er2=hbaRxEl('hba-rxring r2', rxx, rxy, Math.round(50*rfxi)); setTimeout(function(){void er2.offsetWidth; er2.classList.add('go');},80); rm(er2,660);
          var fo=hbaRxEl('hba-rx2fossil', rxx, rxy, Math.round(196*rfxi)); fo.innerHTML=hbaRx2FossilSVG('x2f'+(_hquu++));
          void fo.offsetWidth; fo.classList.add('go'); rm(fo,860);
          for(var ai=0;ai<5;ai++){ (function(k){ setTimeout(function(){
            var aw=12+Math.random()*7, ah=aw*(2.2+Math.random()*0.8);
            var ax=rxx+(k-2)*26+(Math.random()-.5)*10;
            var am=hbaRxEl('hba-rx2amber', ax, rxy+4, aw, ah);
            try{ am.animate([{transform:'translate(-50%,-100%) scaleY(0) rotate('+((Math.random()-.5)*22)+'deg)',opacity:0},{transform:'translate(-50%,-100%) scaleY(1.12) rotate('+((Math.random()-.5)*22)+'deg)',opacity:1,offset:.4},{transform:'translate(-50%,-100%) scaleY(1) rotate('+((Math.random()-.5)*22)+'deg)',opacity:1,offset:.62},{transform:'translate(-50%,-100%) scaleY(.96)',opacity:0}],{duration:680,easing:'cubic-bezier(.2,.8,.3,1.15)',fill:'forwards'}); }catch(e){}
            rm(am,740); }, k*55); })(ai); }
          for(var di2=0;di2<4;di2++){ (function(){ var ds=26+Math.random()*26;
            var du=hbaRxEl('hba-rx2dust', rxx+(Math.random()-.5)*90*rfxi, rxy+4, ds, ds);
            try{ du.animate([{transform:'translate(-50%,-50%) scale(.5)',opacity:.5},{transform:'translate(-50%,-50%) translate('+((Math.random()-.5)*36)+'px,'+(-(12+Math.random()*22))+'px) scale(1.8)',opacity:0}],{duration:700+Math.random()*220,easing:'ease-out',fill:'forwards'}); }catch(e){} rm(du,980); })(di2); }
          if(rxbar){ rxbar.classList.add('hsn-bite-glow'); setTimeout(function(){rxbar.classList.remove('hsn-bite-glow');},260); }
          deal();
        }, mdur);
      }, RT(1550));
      return;
    }
    if(t==='dinocombo'){
      var xbar=document.querySelector('.hero-hp-bar'), xhx, xhy;
      if(xbar){ var xbr=xbar.getBoundingClientRect(); xhx=bc.x; xhy=xbr.top+xbr.height*0.42; }
      else { xhx=hc.x; xhy=hc.y; }
      var xbs=bs.getBoundingClientRect();
      var xbx=xbs.left+xbs.width/2, xby=xbs.bottom-xbs.height*0.15;
      hbaRexCombo(xbx,xby,xhx,xhy,fx,deal);
      return;
    }
    // 🔴 v553: 百战兽人(Lv3)——狂暴怒嚎·百战连锤(Hansen: v550 太一般, 要更惊艳更酷)。三阶段大戏——
    //   ①狂暴变身"吼——!": 兽人虚影(lv03 立绘)猛然放大压近+泛红狂暴光, 双层粗音浪(橙外绿内)炸出, 底部碎石被吼得弹跳;
    //   ②百战连锤"百战不败!": 左锤抡砸→右锤镜像反手, 快狠包夹勇者血条两侧, 各起小地裂(fxi 0.55);
    //   ③灭世终结"让你见识真正的勇士!": 大锤升至屏中巨大化+熔岩充能(锤头红光脉动+岩浆滴落)→悬停震颤→垂直轰落→
    //     超级地裂(fxi 1.5)+部落绿环+三道熔岩喷柱+底部尘墙→锤嵌地反弹两下拔起淡出→deal 在轰落命中。
    //   不变量: 零震屏零屏闪 / 全 fixed 贴 __hansenFxLayer / hba-hq4 前缀 / 真锤图 decode 克隆(BUG#67) / deal 兜底 dealDelay 2600。
    if(t==='hammerquake'){
      var hbar=document.querySelector('.hero-hp-bar'), hhx, hhy, hbarL, hbarW;
      if(hbar){ var hbr=hbar.getBoundingClientRect(); hhx=bc.x; hhy=hbr.top+hbr.height*0.42; hbarL=bc.x-hbr.width/2; hbarW=hbr.width; }
      else { hhx=hc.x; hhy=hc.y; hbarL=hc.x-80; hbarW=160; }
      var hsz=fx.sz||1, hsp=fx.sp||1, hfxi=fx.fxi||1;
      var HT=function(ms){return Math.round(ms/hsp);};
      var hvw=window.innerWidth, hvh=window.innerHeight;
      function hq4El(cls,x,y,w,h){var d=document.createElement('div');d.className=cls;d.style.left=x+'px';d.style.top=y+'px';if(w){d.style.width=w+'px';d.style.height=(h||w)+'px';}(window.__hansenFxLayer||document.body).appendChild(d);return d;}
      // ===== ① 狂暴变身 (0~450ms) =====
      var rage=hq4El('hba-hq4rage', bc.x, bc.y, Math.round(120*hsz), Math.round(120*hsz));
      rage.innerHTML='<img src="bosses/lv03.webp?v=908" alt="" draggable="false">';
      try{ rage.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.85)'},{opacity:.62,transform:'translate(-50%,-50%) scale(1.25)',offset:.42},{opacity:.5,transform:'translate(-50%,-50%) scale(1.62)',offset:.78},{opacity:0,transform:'translate(-50%,-50%) scale(1.85)'}],{duration:HT(440),easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'}); }catch(e){}
      rm(rage,HT(490));
      for(var wi=0;wi<2;wi++){ (function(i){ setTimeout(function(){
        var wave=hq4El('hba-hq4roar', bc.x, bc.y, 50);
        void wave.offsetWidth; wave.classList.add('go'); rm(wave,640);
      }, HT(60+i*150)); })(wi); }
      for(var pi=0;pi<5;pi++){ (function(i){ setTimeout(function(){
        var pb=hq4El('hba-hq4pebble', 40+Math.random()*(hvw-80), hvh-14-Math.random()*8, 5+Math.random()*5);
        var jy=-(16+Math.random()*26), jx=(Math.random()-.5)*22;
        try{ pb.animate([{transform:'translate(-50%,-50%) translate(0,0) rotate(0deg)',opacity:1},{transform:'translate(-50%,-50%) translate('+(jx*0.6)+'px,'+jy+'px) rotate('+((Math.random()-.5)*180)+'deg)',opacity:1,offset:.5},{transform:'translate(-50%,-50%) translate('+jx+'px,6px) rotate('+((Math.random()-.5)*340)+'deg)',opacity:0}],{duration:480+Math.random()*160,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){}
        rm(pb,700); }, HT(40+i*55)); })(pi); }
      // ===== 锤子工具: 小连锤(抡弧) =====
      function hq4Swing(hitX,hitY,mirror,delay){
        setTimeout(function(){
          var HH=Math.round(170*hsz), HW=Math.round(HH*HAMMER_GEO.ratio);
          var hpo={x:HAMMER_GEO.pivot.x*HW, y:HAMMER_GEO.pivot.y*HH}, hhe={x:HAMMER_GEO.head.x*HW, y:HAMMER_GEO.head.y*HH};
          var hoff={x:hhe.x-hpo.x, y:hhe.y-hpo.y};
          var impactDeg=mirror?-104:104, hrad=impactDeg*Math.PI/180;
          var hox=hoff.x*Math.cos(hrad)-hoff.y*Math.sin(hrad), hoy=hoff.x*Math.sin(hrad)+hoff.y*Math.cos(hrad);
          var pvX=hitX-hox, pvY=hitY-hoy;
          pvX=Math.max(8,Math.min(hvw-8,pvX));
          var hm=makeHammer(HH); hm.classList.add('hq4small');
          hm.style.left=(pvX-hpo.x)+'px'; hm.style.top=(pvY-hpo.y)+'px';
          hm.style.transformOrigin=(HAMMER_GEO.pivot.x*100)+'% '+(HAMMER_GEO.pivot.y*100)+'%';
          (window.__hansenFxLayer||document.body).appendChild(hm);
          var sdur=HT(380), startDeg=mirror?-18:18;
          try{ hm.animate([
            {transform:'rotate('+startDeg+'deg) scale(.85)',opacity:0,offset:0},
            {transform:'rotate('+(startDeg*1.6)+'deg) scale(1)',opacity:1,offset:.22,easing:'cubic-bezier(.55,0,.9,.45)'},
            {transform:'rotate('+impactDeg+'deg)',opacity:1,offset:.62,easing:'cubic-bezier(.2,.7,.3,1)'},
            {transform:'rotate('+(impactDeg+(mirror?6:-6))+'deg)',opacity:1,offset:.8},
            {transform:'rotate('+(impactDeg+(mirror?-3:3))+'deg) scale(.96)',opacity:0,offset:1}
          ],{duration:sdur,fill:'forwards'}); }catch(e){ hm.style.transform='rotate('+impactDeg+'deg)'; }
          rm(hm,sdur+90);
          setTimeout(function(){ hbaHammerQuake(hitX,hitY,hfxi*0.55,false); }, Math.round(sdur*0.62));
        }, delay);
      }
      // ===== ② 百战连锤: 左→右 (450~1250ms) =====
      var hitL=hbarL+hbarW*0.22, hitR=hbarL+hbarW*0.78;
      hq4Swing(hitL, hhy, false, HT(450));
      hq4Swing(hitR, hhy, true,  HT(850));
      // ===== ③ 灭世终结 (1250ms~) =====
      setTimeout(function(){
        var BH=Math.round(300*hsz), BW=Math.round(BH*HAMMER_GEO.ratio);
        var headFrac=HAMMER_GEO.head.y;
        var hoverY=Math.round(hvh*0.20);
        var big=makeHammer(BH); big.classList.add('hq4big');
        big.style.left=(hhx-BW/2)+'px';
        big.style.top=(hoverY-BH*0.5)+'px';
        big.style.transformOrigin='50% 50%';
        (window.__hansenFxLayer||document.body).appendChild(big);
        try{ big.animate([
          {transform:'rotate(140deg) scale(.45)',opacity:0,offset:0},
          {transform:'rotate(172deg) scale(.9)',opacity:1,offset:.5},
          {transform:'rotate(180deg) scale(1)',opacity:1,offset:1}
        ],{duration:HT(380),easing:'cubic-bezier(.3,.6,.4,1)',fill:'forwards'}); }catch(e){ big.style.transform='rotate(180deg)'; big.style.opacity='1'; }
        var headY=hoverY+BH*(0.5-headFrac);
        var chg=hq4El('hba-hq4charge', hhx, headY, Math.round(96*hsz));
        try{ chg.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5)'},{opacity:.92,transform:'translate(-50%,-50%) scale(1.05)',offset:.4},{opacity:.6,transform:'translate(-50%,-50%) scale(.9)',offset:.65},{opacity:.95,transform:'translate(-50%,-50%) scale(1.12)',offset:.88},{opacity:0,transform:'translate(-50%,-50%) scale(1.2)'}],{duration:HT(620),delay:HT(200),easing:'ease-in-out',fill:'forwards'}); }catch(e){}
        rm(chg,HT(880));
        for(var di=0;di<3;di++){ (function(i){ setTimeout(function(){
          var dp=hq4El('hba-hq4drip', hhx+(Math.random()-.5)*36, headY+12, 6+Math.random()*4);
          var fall=(hhy-headY-20)*(0.45+Math.random()*0.35);
          try{ dp.animate([{transform:'translate(-50%,-50%) translateY(0) scale(1)',opacity:.95},{transform:'translate(-50%,-50%) translateY('+fall+'px) scale(.6)',opacity:0}],{duration:430+Math.random()*160,easing:'cubic-bezier(.5,0,.8,.4)',fill:'forwards'}); }catch(e){}
          rm(dp,650); }, HT(300+i*160)); })(di); }
        setTimeout(function(){
          try{ big.animate([{transform:'rotate(180deg) translateX(0)'},{transform:'rotate(180.8deg) translateX(1.4px)',offset:.25},{transform:'rotate(179.2deg) translateX(-1.4px)',offset:.5},{transform:'rotate(180.6deg) translateX(1px)',offset:.75},{transform:'rotate(180deg) translateX(0)'}],{duration:HT(200),fill:'forwards'}); }catch(e){}
        }, HT(420));
        var dropDist=hhy-headY-6;
        setTimeout(function(){
          try{ big.animate([{transform:'rotate(180deg) translateX(0) translateY(0)'},{transform:'rotate(180deg) translateX(0) translateY('+(-dropDist*0.04)+'px)',offset:.16},{transform:'rotate(180deg) translateX(0) translateY('+dropDist+'px) scaleY(.95)',offset:1}],{duration:HT(240),easing:'cubic-bezier(.55,0,.85,.36)',fill:'forwards'}); }catch(e){}
        }, HT(650));
        setTimeout(function(){
          hbaHammerQuake(hhx,hhy,hfxi*1.5,true);
          for(var li=0;li<3;li++){ (function(i){
            var lx=hhx+(i-1)*44+(Math.random()-.5)*10;
            var lh=64+Math.random()*34;
            var lv=hq4El('hba-hq4lava', lx, hhy+2, 13, Math.round(lh));
            (function(e,dl){ setTimeout(function(){ void e.offsetWidth; e.classList.add('go'); },dl); rm(e,dl+560); })(lv, i*60);
            setTimeout(function(){ for(var fi=0;fi<2;fi++){ var fs=hq4El('hba-hqspark', lx+(Math.random()-.5)*12, hhy-lh+6);
              var fa=-Math.PI/2+(Math.random()-.5)*1.1, fd=18+Math.random()*22, fx2=Math.cos(fa)*fd, fy2=Math.sin(fa)*fd;
              try{ fs.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:'translate(calc(-50% + '+fx2+'px), calc(-50% + '+(fy2+26)+'px)) scale(.4)',opacity:0}],{duration:440,easing:'cubic-bezier(.3,.5,.6,1)',fill:'forwards'}); }catch(e){} rm(fs,500); } }, i*60+150);
          })(li); }
          for(var ui=0;ui<4;ui++){ (function(i){
            var du2=hq4El('hba-hq4dustwall', hvw*(0.14+i*0.24), hvh-8, 76+Math.random()*30, 40);
            try{ du2.animate([{transform:'translate(-50%,-100%) scaleY(.2)',opacity:.5},{transform:'translate(-50%,-100%) translateY(-10px) scaleY(1)',opacity:.4,offset:.5},{transform:'translate(-50%,-100%) translateY(-22px) scaleY(1.25)',opacity:0}],{duration:760+Math.random()*220,easing:'ease-out',fill:'forwards'}); }catch(e){}
            rm(du2,1060); })(ui); }
          deal();
          try{ big.animate([
            {transform:'rotate(180deg) translateX(0) translateY('+dropDist+'px) scaleY(.95)',offset:0},
            {transform:'rotate(180deg) translateX(0) translateY('+(dropDist-7)+'px) scaleY(1)',offset:.16},
            {transform:'rotate(180deg) translateX(0) translateY('+dropDist+'px)',offset:.3},
            {transform:'rotate(180deg) translateX(0) translateY('+(dropDist-3)+'px)',offset:.42},
            {transform:'rotate(180deg) translateX(0) translateY('+dropDist+'px)',opacity:1,offset:.62},
            {transform:'rotate(174deg) translateX(4px) translateY('+(dropDist-52)+'px) scale(.94)',opacity:0,offset:1}
          ],{duration:HT(560),fill:'forwards'}); }catch(e){}
          rm(big,HT(620));
        }, HT(900));
      }, HT(1250));
      return;
    }
    // 🔴 v510: 机械泰坦——导弹散射汇聚(Hansen 定稿)。n枚导弹从boss向四面八方喷出(二次贝塞尔控制点=boss+方向×散开距离)→ 各自划弧转向 → 全部汇聚命中勇者血条 → 连环小爆炸 + 最后一记大爆炸。SVG导弹内联无需外部图。零震屏零屏闪(仅命中柔光)。
    if(t==='missilestorm'){ // 🔴 v528起历史死代码(机械泰坦已换 titanstrike)·分支+hbmMissileSVG/qBez/hbmExplode+.hba-missile/.hba-mwrap 守卫盯防勿删
      var mwrap=document.createElement('div'); mwrap.className='hba-mwrap';
      mwrap.setAttribute('style', (fx.theme==='fire')
        ? '--mc1:#fff;--mc2:#fde68a;--mc3:#fb923c;--mc4:#ef4444;--mglow:rgba(251,146,60,.85);--mband:#fb923c'
        : '--mc1:#fff;--mc2:#a5f3fc;--mc3:#38bdf8;--mc4:#7c3aed;--mglow:rgba(56,189,248,.9);--mband:#38bdf8');
      add(mwrap);
      var mbar=document.querySelector('.hero-hp-bar'), mhx, mhy;
      if(mbar){ var mbr=mbar.getBoundingClientRect(); mhx=bc.x; mhy=mbr.top+mbr.height/2; }
      else { mhx=hc.x; mhy=hc.y; }
      var mlx=bc.x, mly=bc.y;   // 发射点(boss中心)
      var mn=fx.n||8, mspread=fx.spread||115, mdur=(fx.dur||0.95)*1000, msz=fx.sz||0.9;
      var MW=Math.round(22*msz), MH=Math.round(56*msz), muu=0, marr=[];
      for(var mi=0;mi<mn;mi++){
        var mang=(mi/mn)*Math.PI*2+(Math.random()-.5)*0.22, msd=mspread*(0.75+Math.random()*0.5);
        var mcp={x:mlx+Math.cos(mang)*msd, y:mly+Math.sin(mang)*msd*0.92};
        var mEl=document.createElement('div'); mEl.className='hba-missile'; mEl.style.width=MW+'px'; mEl.style.height=MH+'px'; mEl.style.opacity='0';
        mEl.innerHTML=hbmMissileSVG('g'+(muu++))+'<div class="hba-mflame"></div>';
        mwrap.appendChild(mEl);
        marr.push({el:mEl, p0:{x:mlx,y:mly}, pc:mcp, p1:{x:mhx,y:mhy}, hit:false, fr:0, prev:{x:mlx,y:mly}, ph:(Math.random()-.5)*0.07});
      }
      hbmMuzzle(mwrap,mlx,mly);
      var mt0=null;
      function mstep(now){
        if(mt0===null)mt0=now;
        var tg=(now-mt0)/mdur; if(tg>1)tg=1;
        for(var qi=0;qi<marr.length;qi++){ var o=marr[qi];
          if(o.hit)continue;
          var tt=Math.min(1, tg*(1+o.ph));
          var pos=qBez(o.p0,o.pc,o.p1,tt);
          o.el.style.left=(pos.x-MW/2)+'px'; o.el.style.top=(pos.y-MH/2)+'px';
          o.el.style.opacity = tt<0.08 ? (tt/0.08).toFixed(2) : '1';
          o.el.style.transform='rotate('+(Math.atan2(pos.y-o.prev.y, pos.x-o.prev.x)*180/Math.PI-90)+'deg)';
          if((o.fr++ %2)===0 && tt>0.05 && tt<0.985){ var ts=4+Math.random()*4, trl=hbmEl(mwrap,'hba-mtrail',pos.x,pos.y,ts); trl.style.transform='translate(-50%,-50%)';
            try{ trl.animate([{opacity:.85,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:340,easing:'ease-out',fill:'forwards'});}catch(e){} rm(trl,380); }
          o.prev=pos;
          if(tt>=0.999){ o.hit=true; rm(o.el,0); hbmExplode(mwrap, mhx+(Math.random()-.5)*18, mhy+(Math.random()-.5)*9, false); }
        }
        if(tg<1){ requestAnimationFrame(mstep); }
        else {
          for(var ci=0;ci<marr.length;ci++){ rm(marr[ci].el,0); }
          hbmExplode(mwrap, mhx, mhy, true);
          deal();
          rm(mwrap, 1300);
        }
      }
      requestAnimationFrame(mstep);
      return;
    }
    // 🔴 v511: 烈焰魔神——火焰陨石雨(Hansen 定稿)。n颗熔岩陨石从天(屏幕上方)斜射砸向勇者血条·边落边掉火星彗尾·命中连环火爆+残留地火·最后一颗巨型陨石大爆炸。复用 hbmExplode/拖尾/火星(--mc*) + 陨石SVG + 地火。零震屏零屏闪(仅巨型命中柔光)。
    if(t==='meteorrain'){
      var rwrap=document.createElement('div'); rwrap.className='hba-mwrap';
      rwrap.setAttribute('style', (fx.pal==='purple') ? '--mc1:#fff;--mc2:#f5d0fe;--mc3:#c084fc;--mc4:#7c3aed;--mglow:rgba(168,85,247,.9)'
        : (fx.pal==='blue') ? '--mc1:#fff;--mc2:#a5f3fc;--mc3:#38bdf8;--mc4:#6366f1;--mglow:rgba(56,189,248,.9)'
        : '--mc1:#fff;--mc2:#fde68a;--mc3:#fb923c;--mc4:#ef4444;--mglow:rgba(251,146,60,.9)');
      add(rwrap);
      var rsky=document.createElement('div'); rsky.className='hba-skyband'; rwrap.appendChild(rsky);
      try{ rsky.animate([{opacity:0},{opacity:.5,offset:.25},{opacity:0}],{duration:900,easing:'ease-out',fill:'forwards'});}catch(e){}
      var rbar=document.querySelector('.hero-hp-bar'), rbx, rby, rbw;
      if(rbar){ var rbr=rbar.getBoundingClientRect(); rbx=rbr.left; rbw=rbr.width; rby=rbr.top+rbr.height/2; }
      else { rbx=hc.x-60; rbw=120; rby=hc.y; }
      var rn=fx.n||6, rsz=fx.sz||1, rdur=(fx.dur||0.58), ruu=0;
      var rDelay=180, rStep=Math.max(70, rdur*1000*0.34/rn*2);
      function dropOne(x0,y0,x1,y1,dur,big){
        var MW=Math.round((big?58:40)*rsz), MH=Math.round((big?140:96)*rsz);
        var m=document.createElement('div'); m.className='hba-meteor'; m.style.width=MW+'px'; m.style.height=MH+'px';
        m.style.left=(x0-MW/2)+'px'; m.style.top=(y0-MH/2)+'px';
        m.innerHTML=hbmMeteorSVG('r'+(ruu++));
        rwrap.appendChild(m);
        var dx=x1-x0, dy=y1-y0, ang=Math.atan2(dy,dx)*180/Math.PI-90;
        try{ m.animate([
          {transform:'translate(0,0) rotate('+ang+'deg) scale('+(big?.72:.86)+')',opacity:.28},
          {transform:'translate('+(dx*0.12)+'px,'+(dy*0.12)+'px) rotate('+ang+'deg) scale(1)',opacity:1,offset:.12},
          {transform:'translate('+dx+'px,'+dy+'px) rotate('+ang+'deg) scale(1)',opacity:1,offset:1}
        ],{duration:dur*1000,easing:'cubic-bezier(.45,.1,.85,.55)',fill:'forwards'});}catch(e){ m.style.opacity='1'; }
        var t0=Date.now(); var iv=setInterval(function(){
          var pr=(Date.now()-t0)/(dur*1000); if(pr>=1){clearInterval(iv);return;}
          var sx=x0+dx*pr, sy=y0+dy*pr;
          var ts=(big?9:6)+Math.random()*5; var tr=hbmEl(rwrap,'hba-mtrail',sx+(Math.random()-.5)*6,sy+(Math.random()-.5)*6,ts); tr.style.transform='translate(-50%,-50%)';
          try{ tr.animate([{opacity:.95,transform:'translate(-50%,-50%) scale(1.1)'},{opacity:0,transform:'translate(-50%,-50%) scale(.3)'}],{duration:430,easing:'ease-out',fill:'forwards'});}catch(e){} rm(tr,470);
          if(Math.random()<0.5){ var sp=hbmEl(rwrap,'hba-mspark',sx,sy); var sa=Math.random()*Math.PI*2, sd=6+Math.random()*15;
            try{ sp.animate([{transform:'translate(-50%,-50%)',opacity:1},{transform:'translate(-50%,-50%) translate('+Math.cos(sa)*sd+'px,'+Math.sin(sa)*sd+'px) scale(.3)',opacity:0}],{duration:320,easing:'ease-out',fill:'forwards'});}catch(e){} rm(sp,360); }
        },20);
        setTimeout(function(){
          if(m.parentNode)m.remove(); clearInterval(iv);
          if(rbar){ rbar.classList.add('hsn-bite-glow'); setTimeout(function(){rbar.classList.remove('hsn-bite-glow');},big?260:170); }
          hbmExplode(rwrap, x1, y1, big);
          hbmGroundFire(rwrap, x1, y1, big);
        }, dur*1000);
      }
      for(var ri=0;ri<rn;ri++){ (function(idx){
        var rtx=rbx+rbw*(0.12+0.76*Math.random()), rsx=rtx+(Math.random()-.5)*150, rsy=-50-Math.random()*40;
        setTimeout(function(){ dropOne(rsx,rsy,rtx,rby,rdur*(0.92+Math.random()*0.18),false); }, rDelay+idx*rStep);
      })(ri); }
      var rfdelay=rDelay+rn*rStep+120;
      (function(){ var rftx=rbx+rbw*0.5, rfsx=rftx+(Math.random()-.5)*90;
        setTimeout(function(){ dropOne(rfsx,-70,rftx,rby,rdur*1.25,true); }, rfdelay); })();
      setTimeout(function(){ deal(); }, Math.round(rDelay + rdur*1000));   // 伤害≈首颗命中
      rm(rwrap, rfdelay + Math.round(rdur*1250) + 1300);
      return;
    }
    // 默认: 飞行投射物 (orb / apple / icicle / flame / sun / fancy / rainbow)
    var p=makeProjectile(fx);p.style.left=bc.x+'px';p.style.top=(bc.y+12)+'px';p.style.transform='translate(-50%,-50%) translate(0,0) scale(.78)';
    add(p);void p.offsetWidth;var px=hc.x-bc.x,py=hc.y-(bc.y+12);
    requestAnimationFrame(function(){p.style.transform='translate(-50%,-50%) translate('+px+'px,'+py+'px) scale(1.05)';});
    setTimeout(function(){rm(p,0);flyOnHit(fx,hc.x,hc.y);deal();},320);
  }

  /* boss 名 → 专属特效 */
  var FX={ '武器大师·战争铁砧':{t:'waranvil',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2600},
'星陨武士·流亡之刃':{t:'exileblade',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2800},
'机械主教·组装者':{t:'assembler',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3000},
'活体行星·古老意志':{t:'ancientwill',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3300}, // 🔴 星海第一星域第5关 引力坦塌: 行星苏醒凝视→引力低语层层扩散→星尘牵引入引力奇点→引力坦塌内爆外爆(守望不战斗的行星意志) // 🔴 星海第一星域第4关 全功率复产: 红独眼扫描锁定→流水线组装小兵扑击→机械臂液压冲压+独眼激光切割→全功率复产成群 // 🔴 星海第一星域第3关 星陨连斩: 实体银蓝光刃剑·拔剑凝气→残影突袭→高频连斩(银蓝↔暗紫闪)→决胜一闪巨斩 // 🔴 星海第一星域第2关 全武库压制: 重机枪弹幕→导弹环射汇聚(散开盘旋汇聚)→等离子军刀重斩→全武库过载(全屏canvas·lighter发光)
'暗影先锋·破阵者':{t:'vanguard',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2900}, // 🔴 星海第一星域第1关 猟手处决: 目镜锁定全息阵→爆能弹幕风暴→等离子突袭→狩猎处决贯穿炮(全屏canvas·lighter发光·零震屏)

    '终末观测者·边界守夜人':{t:'starbrand',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2200}, // 🔴 v803 星图烙印:观测青+末日红·义眼亮→星座连线逐段画across连到勇者→火花沿线游走逐点引爆→勇者处终爆(网状连线引爆·非光束·deal命中≈2220·兜底2200)
    '铸星者·原初匠人':{t:'starforge',sz:0.55,sp:1.0,fxi:1.0,dealDelay:2900}, // 🔴 v802 创世锻造: 暖金·蓄力星核→陨铁锤砸地爆轰→熔金陨星朝勇者轰来(deal巨陨命中≈2480·兜底2900)·canvas覆盖层移植·零震屏零屏闪(删全屏白闪)
    '统御天使·圣光之翼':{t:'lightjudge',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2700}, // 🔴 v802 圣光裁决: 纯白金·展翼降临三重金环→法阵锁定→万道光柱垂直天降钉满全场→擎天巨柱终末审判(deal巨柱落地≈2420·兜底2700)·canvas移植·零震屏零屏闪(删审判白闪)
    '无光之渊·暗噬君主':{t:'soulabyss',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2900}, // 🔴 v802 锁魂囚渊: 深紫·四面暗链激射钉锁勇者→收紧→暗影爬满→渊口张开→灵魂被拖入→坍缩紫闪(deal灵魂坍缩≈2550·兜底2900)·canvas移植·零震屏零屏闪
    '时之君主·克罗诺斯之影':{t:'chronosend',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2700}, // 🔴 v802 终焉时刻: 金沙时空青·十二钟疯转→时停→每钟射激光汇聚成炽核→轰出贯穿梯形激光打勇者(不爆炸是汇能轰击·deal命中≈2370·兜底2700)·canvas移植·零震屏零屏闪(删定格全屏罩)
    '淘气小幽灵':{t:'ghostprank',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2300}, // 🔴 v552 淘气捉迷藏(台词三象: 虚影捉迷藏x3+S形嘟嘟弹x3+本体鬼脸扑\"啵\")·deal实测≈2030兜底2300·老ghost分支保留勿删(v528先例)
    '暗影忍者':{t:'shadowdance',sz:0.86,sp:1.0,fxi:1.0,dealDelay:1900}, // 🔴 v551 影舞·三连杀(台词三象: 隐身烟雾+三影分身三连镖+致命大镖十字斩)·deal实测≈1620兜底1900·老shuriken分支保留勿删(v528先例)
    '百战兽人':{t:'hammerquake',pal:'lava',sz:0.70,sp:1.0,fxi:1.0,dealDelay:2600}, // 🔴 v553 狂暴怒嚎·百战连锤(三阶段: 狂暴虚影+左右连锤+灭世大锤垂直轰落)·deal实测≈2150兜底2600
    '史前霸王龙':{t:'rexfury',pal:'amber',sz:0.5,sp:1.0,fxi:1.0,dealDelay:2500}, // 🔴 v556(Hansen 定稿): 默认规模 50%(v555 全尺寸太大), 加大须后台调参面板自调·远古之怒·灭绝之颚·deal实测2100兜底2500·老rexapex(v554)+dinocombo(v513)分支保留勿删(v528先例)
    '千年僵尸':{t:'zombiefury',pal:'poison',sz:0.50,sp:1.0,fxi:2.0,dealDelay:3400}, // 🔴 v559(Hansen 二代素材): 定身符咒·万拳齐发(符贴住全程挣扎+左右尸气拳交替x8刷刷刷+新百拳全景压轴+总命中符炸裂)·deal实测待真机·老zombiecurse(v514)+zombieseal(v558)分支保留勿删(v528先例)
    '暗夜吸血鬼':{t:'batmoon',pal:'blood',sz:1.0,sp:1.0,fxi:1.30,dealDelay:1700},
    '蒙面大魔王':{t:'maskphantom',pal:'king',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2700},
    '地狱犬王':{t:'hellgate',pal:'fire',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2200},
    '黑森林巫婆':{t:'witchbrew',pal:'hex',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2150},
    '异次元巫师':{t:'dimrift',pal:'dim',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2900},
    '龙骑士统帅':{t:'dragonrain',pal:'fire',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2700},
    '暗黑灯神':{t:'geniecurse',pal:'dark',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3900},
    '海底巨怪':{t:'abysstide',pal:'abyss',sz:1.0,sp:1.0,fxi:1.0,dealDelay:4500},
    '寒冰女王':{t:'icequeen',pal:'ice',sz:1.0,sp:1.0,fxi:1.0,dealDelay:4300},
    '烈焰魔神':{t:'doomstar',pal:'fire',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3600},
    '雷电之主':{t:'thunderlord',pal:'storm',sz:1.40,sp:1.0,fxi:1.60,dealDelay:3700}, // 🔴 v527 Hansen定稿: 苍雷蓝·规模140%·强度160%(7道连击雷)·deal实测≈3380ms兜底3700
    '机械泰坦':{t:'titanstrike',pal:'crimson',sz:1.0,sp:1.0,fxi:1.0,dealDelay:4950}, // 🔴 v528 Hansen定稿: 猩红警戒·规模100%·火力100%(3道剑气)·deal实测≈4600ms兜底4950
    '外星霸主':{t:'alienlord',pal:'green',sz:1.0,sp:1.0,fxi:1.0,dealDelay:4400}, // 🔴 v529 Hansen定稿: 异星翠绿·规模100%·火力100%(5无人机)·deal实测≈4050ms兜底4400·光束图复用__hbaBeamImg(wave仍现役于混沌魔尊勿动)
    '混沌魔尊':{t:'hellgate',pal:'purple',sz:1.0,sp:1.0,fxi:1.6,dealDelay:5400}, // 🔴 v530 Hansen定稿: 深渊魔紫·规模100%·业火160%(5道三叉刺)·deal实测≈5030ms兜底5400·漩涡图复用__hbaWaveImg
    '上古太阳神':{t:'sungod',pal:'gold',sz:1.0,sp:1.0,fxi:1.0,dealDelay:5100}, // 🔴 v531 Hansen定稿: 鎏金圣阳·规模100%·圣焰100%(3道耀斑光矛)·deal实测≈4720ms兜底5100·火球图复用__hbaSunImg
    '星海女帝·赛尔娅':{t:'starempress',sz:1.0,sp:1.0,fxi:1.0,dealDelay:6300}, // 🔴 v535 Hansen定稿: 虹彩星海·规模100%·星辉100%(七连满奏)·deal实测≈5878ms兜底6300·fly自此全退役
    '星海女帝':{t:'starempress',sz:1.0,sp:1.0,fxi:1.0,dealDelay:6300} // 🔴 v535 双形态同款(HP阶梯在赛季岛侧)
  };

  window.HansenBossAttack=function(boss,dmg,newHP,maxHP){
    var dealt=false;
    function deal(){ if(dealt)return; dealt=true; try{ if(window.HansenHeroHit) window.HansenHeroHit(dmg,newHP,maxHP); }catch(e){} }
    try{
      /* 🔴 v537(Hansen 定稿): boss 攻击特效总开关——boss 选择页横条上的 ON/OFF 滑块(hansen_cards.js 写 localStorage 'hansen_bossfx_on')。OFF('0')时全部攻击特效一律不放, 但 deal() 立即执行→HansenHeroHit 掉血反馈/血条/飘字完全照常, 游戏逻辑零改变(v487 铁则: 掉血反馈永不被破坏)。缺省/读取异常一律视为开。 */
      try{ if(window.__fxOn==='0'){ deal(); return; } }catch(e0){}
      var name=(boss&&boss.name)?boss.name:'';
      var fx=FX[name],bs=bossVis(),hs=heroSec(); /* 🔴v859 量视觉盒 */
      if(!fx||!bs||!hs){ deal(); return; }
      // 🔴 v532: boss 特效后台调参覆盖层(设置→Boss特效·密码门)。override 合并后 dealDelay 随 sp 反比换算, 慢速时兜底不提前扣血。
      try{ var __ov=(window.__fxOverride||{})[name];
        if(__ov){ var __base=fx; fx=Object.assign({},__base,__ov);
          if(__ov.sp&&__base.dealDelay){ fx.dealDelay=Math.round(__base.dealDelay*((__base.sp||1)/__ov.sp)); } }
        /* v533: 配色 filter——每次攻击按 override 重设容器层(hue/sat/bri 任一存在→设, 否则 none) */
        if(window.__hansenFxLayer){ var __f='';
          if(__ov){ if(__ov.hue)__f+='hue-rotate('+__ov.hue+'deg) '; if(__ov.sat)__f+='saturate('+__ov.sat+') '; if(__ov.bri)__f+='brightness('+__ov.bri+') '; }
          window.__hansenFxLayer.style.filter=__f?__f.trim():'none';
          if(window.__hansenFxLayerBack)window.__hansenFxLayerBack.style.filter=__f?__f.trim():'none'; /* 🔴 v536(BUG#70): 背景层同色 */ } }catch(e){}
      setTimeout(deal,(fx&&fx.dealDelay)?fx.dealDelay:750);
      playFx(fx,bs,hs,deal);
    }catch(e){ deal(); }
  };
})();

/* ════════════════════════════════════════════════════════════════
   🔴 v532: Boss 特效后台调参面板(Hansen 专用)
   入口: 设置 → 「⚔️ Boss 特效」(MutationObserver 幂等注入 settingsContent)
   密码门: SHA-256 比对(crypto.subtle 优先, djb2 回退), sessionStorage 本会话记忆
   生效: 滑杆实时写 localStorage('hansen_bossfx_override'), 调度入口合并覆盖 fx,
         dealDelay 随 sp 反比换算。重置=删该 boss 覆盖项。配色为定稿硬编码(只读展示)。
   ════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var PW_SHA='603496ea13d3aa14a70ad2a79b7d6d138b3dfb0448441ac7cd14e0ef9358ecd6';
var PW_DJB=346366539;
var LSK='hansen_bossfx_override', SSK='hansen_bossfx_auth';
/* 🔴 v538(Hansen 定稿): 双入口重构。
   ① 用户入口(设置行): 不再提密码——通关全部 18 个常规岛的所有 boss(每岛 Lv1~20, 共360关)解锁, 解锁前🔒+进度提示, 解锁后免密直接进面板(用户模式)。
   ② 管理员入口(伪装): 底部「…进度自动保存到本设备」一行外观零变化, 点击弹「输入密码」极简框(可粘贴·copy_protect 对 input 豁免);
      连续输错 3 次(跨会话累计·无时限·输对一次清零重计)→永久锁定: 点击毫无反应。计数与锁双存 localStorage+IndexedDB(清档也难抹), 键名隐蔽不含 pw/boss 字样。
      密码只存 SHA-256(PW_SHA)+djb2 双指纹, 明文不在任何代码/存储中出现——爬走的只能是乱码。 */
var L_N='__hsn_sys_a', L_LK='__hsn_sys_b';
/* 🔴 v539(Hansen 定稿): 管理员面板「卡牌入口」二级密码门——SHA-256+djb2 双指纹(明文不出现在任何代码), 10 秒倒计时(超时未提交=记一次错), 连续错 3 次该入口永久关闭(点击零反应), 输对清零重计; 计数/锁双存 localStorage(__hsn_sys_c/d)+IndexedDB('c'/'d'), 开机 idbReconcile 校正抗清档。成功=hansenTempUnlock(24h 临时全解锁, 只影响显示不污染真实存档)。 */
var C_N='__hsn_sys_c', C_LK='__hsn_sys_d';
var CARD_SHA='bb00f979cb70044ae85e54906d2b96f24b7211714ef57c88b0596231540d2713';
var CARD_DJB=3674270565;
var ISLES=['action','adjective','animal','body','city','clothes','color','family','food','home','job','nature','question','school','sports','time','traffic','treasure'];
function islandKey(isle){ return 'wordIsland'+isle.charAt(0).toUpperCase()+isle.slice(1); }
var CLEARALL_ON='hansen_admin_clearall_on', CLEARALL_BAK='hansen_admin_clearall_bak';
function isAllBossClearOn(){ try{ return localStorage.getItem(CLEARALL_ON)==='1'; }catch(e){ return false; } }
function bossClearProgress(){
  var total=ISLES.length*20;
  if(isAllBossClearOn()){ return {done:total,total:total,all:true}; } /* 🔴 v804: 管理员"一键通关"开关 ON → 直接视为全通关 */
  var done=0;
  for(var i=0;i<ISLES.length;i++){
    var k=islandKey(ISLES[i]), s=null;
    try{ s=JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ s=null; }
    if(!s||typeof s!=='object') continue;
    for(var lv=1;lv<=20;lv++){
      if((s.bossWins&&s.bossWins[lv]>=1)||(Array.isArray(s.bossWon)&&s.bossWon.indexOf(lv)>=0)) done++;
    }
  }
  return {done:done,total:total,all:done>=total};
}
/* 🔴 v804: 管理员"一键通关所有 Boss"——ON: 先把各岛真实进度备份, 再给 18 岛全部 20 关写满 bossWon/bossWins(=游戏读到全通关); OFF: 从备份精确还原。只动 boss 通关两个字段, 其余存档一律不碰。reversible。 */
function setAllBossClear(on){
  try{
    var CISLES=ISLES.concat(['season']);  //🔴v806: 一键通关也覆盖赛季岛(wordIslandSeason·islandKey('season')·同 lv1-20+bossWon 结构)→ 赛季6守关boss全算进去全通关。ISLES(18)仍供 bossClearProgress 的360计数用·不破坏入口闸
    if(on){
      if(!localStorage.getItem(CLEARALL_BAK)){
        var bak={};
        for(var i=0;i<CISLES.length;i++){ var k=islandKey(CISLES[i]); var s=null; try{s=JSON.parse(localStorage.getItem(k)||'null');}catch(e){}
          if(s&&typeof s==='object'){ bak[k]={ex:1, bw:(s.bossWins&&typeof s.bossWins==='object')?s.bossWins:null, bn:Array.isArray(s.bossWon)?s.bossWon.slice():null, bu:(typeof s.bossUnlocked==='number'&&isFinite(s.bossUnlocked))?s.bossUnlocked:null}; }
          else { bak[k]={ex:0}; } }
        try{localStorage.setItem(CLEARALL_BAK,JSON.stringify(bak));}catch(e){}
      }
      for(var j=0;j<CISLES.length;j++){ var k2=islandKey(CISLES[j]); var s2=null; try{s2=JSON.parse(localStorage.getItem(k2)||'null');}catch(e){} if(!s2||typeof s2!=='object')s2={};
        var bw=(s2.bossWins&&typeof s2.bossWins==='object')?s2.bossWins:{}; var won=[];
        for(var lv=1;lv<=20;lv++){ if(!(bw[lv]>=3))bw[lv]=3; won.push(lv); }  //🔴v807: 每关 bossWins 写满3次(≥getRequiredWins: lv1需1/lv2需2/lv3-19需3)→ 即使 hansen_boss_progress.js 的 v319 迁移按 bossWins 重算 bossUnlocked 也会算出20·不会把我们写的解锁覆盖回低关
        s2.bossWins=bw; s2.bossWon=won; s2.bossUnlocked=20;  //🔴v807: boss 的「锁」由 bossUnlocked(解锁到第几关·getUnlockedBossLv/选关界面读它·非 bossWon)控制 → 一键通关必须把 bossUnlocked 也写满20, 否则 boss 仍是加锁状态(v804/v806 只写 bossWon 是不够的·赛季岛/常规岛同此机制)
        try{localStorage.setItem(k2,JSON.stringify(s2));}catch(e){} }
      try{localStorage.setItem(CLEARALL_ON,'1');}catch(e){}
    } else {
      var bakStr=null; try{bakStr=localStorage.getItem(CLEARALL_BAK);}catch(e){}
      var b=bakStr?JSON.parse(bakStr):null;
      if(b){ for(var m=0;m<CISLES.length;m++){ var k3=islandKey(CISLES[m]); var rec=b[k3]; if(!rec)continue;
        var s3=null; try{s3=JSON.parse(localStorage.getItem(k3)||'null');}catch(e){}
        if(!rec.ex){ /* 开启前本无此岛存档 → 删我们写入的三个字段, 若整条空了就移除 */
          if(s3&&typeof s3==='object'){ delete s3.bossWins; delete s3.bossWon; delete s3.bossUnlocked;
            try{ if(Object.keys(s3).length===0){localStorage.removeItem(k3);}else{localStorage.setItem(k3,JSON.stringify(s3));} }catch(e){} } }
        else if(s3&&typeof s3==='object'){
          if(rec.bw!=null){s3.bossWins=rec.bw;}else{delete s3.bossWins;}
          if(rec.bn!=null){s3.bossWon=rec.bn;}else{delete s3.bossWon;}
          if(rec.bu!=null){s3.bossUnlocked=rec.bu;}else{delete s3.bossUnlocked;}
          try{localStorage.setItem(k3,JSON.stringify(s3));}catch(e){} } } }
      try{localStorage.removeItem(CLEARALL_BAK);}catch(e){}
      try{localStorage.removeItem(CLEARALL_ON);}catch(e){}
    }
  }catch(e){}
}
function idbKV(mode,fn){ try{ if(!window.indexedDB)return; var q=indexedDB.open('hsn_sys',1);
  q.onupgradeneeded=function(){ try{ q.result.createObjectStore('kv'); }catch(e){} };
  q.onsuccess=function(){ try{ fn(q.result.transaction('kv',mode).objectStore('kv')); }catch(e){} };
  q.onerror=function(){};
}catch(e){} }
function isLocked(){ try{ return localStorage.getItem(L_LK)==='1'; }catch(e){ return false; } }
function cardLocked(){ try{ return localStorage.getItem(C_LK)==='1'; }catch(e){ return false; } }
function cardLockNow(){ try{ localStorage.setItem(C_LK,'1'); }catch(e){} idbKV('readwrite',function(st){ try{ st.put('1','d'); }catch(e){} }); }
function getCardFails(){ try{ return parseInt(localStorage.getItem(C_N)||'0',10)||0; }catch(e){ return 0; } }
function setCardFails(n){ try{ localStorage.setItem(C_N,String(n)); }catch(e){} idbKV('readwrite',function(st){ try{ st.put(String(n),'c'); }catch(e){} }); }
function checkCardPw(pw,cb){
  if(window.crypto&&crypto.subtle&&crypto.subtle.digest){
    try{
      crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw)).then(function(buf){
        var hex=Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
        cb(hex===CARD_SHA);
      }).catch(function(){cb(djb2(pw)===CARD_DJB&&pw.length===6);});
      return;
    }catch(e){}
  }
  cb(djb2(pw)===CARD_DJB&&pw.length===6);
}
function lockNow(){ try{ localStorage.setItem(L_LK,'1'); }catch(e){} idbKV('readwrite',function(st){ try{ st.put('1','b'); }catch(e){} }); }
function getFails(){ try{ return parseInt(localStorage.getItem(L_N)||'0',10)||0; }catch(e){ return 0; } }
function setFails(n){ try{ localStorage.setItem(L_N,String(n)); }catch(e){} idbKV('readwrite',function(st){ try{ st.put(String(n),'a'); }catch(e){} }); }
function idbReconcile(){ idbKV('readonly',function(st){ try{
  var ga=st.get('a'); ga.onsuccess=function(){ try{ var v=parseInt(ga.result||'0',10)||0; if(v>getFails()){ localStorage.setItem(L_N,String(v)); } if(v>=3){ try{localStorage.setItem(L_LK,'1');}catch(e){} } }catch(e){} };
  var gb=st.get('b'); gb.onsuccess=function(){ try{ if(gb.result==='1'){ localStorage.setItem(L_LK,'1'); } }catch(e){} };
  var gc=st.get('c'); gc.onsuccess=function(){ try{ var v=parseInt(gc.result||'0',10)||0; if(v>getCardFails()){ localStorage.setItem(C_N,String(v)); } if(v>=3){ try{localStorage.setItem(C_LK,'1');}catch(e){} } }catch(e){} };
  var gd=st.get('d'); gd.onsuccess=function(){ try{ if(gd.result==='1'){ localStorage.setItem(C_LK,'1'); } }catch(e){} };
}catch(e){} }); }
var BOSSES=[
 {n:'淘气小幽灵',lv:'Lv1',mv:'淘气捉迷藏',pal:'灵蓝',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'暗影忍者',lv:'Lv2',mv:'影舞三连杀',pal:'暗影紫',ps:['sz','sp','fxi'],df:{sz:86,sp:100,fxi:100}},
 {n:'百战兽人',lv:'Lv3',mv:'百战连锤',pal:'熔岩',ps:['sz','sp','fxi'],df:{sz:70,sp:100,fxi:100}},
 {n:'史前霸王龙',lv:'Lv4',mv:'远古之怒·灭绝之颚',pal:'琥珀',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:100}},
 {n:'千年僵尸',lv:'Lv5',mv:'定身符咒·万拳齐发',pal:'剧毒',ps:['sz','sp','fxi'],df:{sz:50,sp:100,fxi:200}},
 {n:'暗夜吸血鬼',lv:'Lv6',mv:'血月蝠群',pal:'猩红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:130}},
 {n:'蒙面大魔王',lv:'Lv7',mv:'魅影假面',pal:'王者',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'地狱犬王',lv:'Lv8',mv:'地狱之门(经典)',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'黑森林巫婆',lv:'Lv9',mv:'魔釜诅咒',pal:'巫毒',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'异次元巫师',lv:'Lv10',mv:'次元裂隙',pal:'异界',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'龙骑士统帅',lv:'Lv11',mv:'龙焰天降',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'暗黑灯神',lv:'Lv12',mv:'灯神诅咒',pal:'暗黑',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'海底巨怪',lv:'Lv13',mv:'深渊海啸',pal:'深渊',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'寒冰女王',lv:'Lv14',mv:'极寒风暴',pal:'寒冰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'烈焰魔神',lv:'Lv15',mv:'末日陨星',pal:'烈焰',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'雷电之主',lv:'Lv16',mv:'雷霆审判',pal:'苍雷蓝',ps:['sz','sp','fxi'],df:{sz:140,sp:100,fxi:160}},
 {n:'机械泰坦',lv:'Lv17',mv:'歼灭协议·泰坦终结斩',pal:'猩红警戒',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'外星霸主',lv:'Lv18',mv:'歼星协议·轨道湮灭',pal:'异星翠绿',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'混沌魔尊',lv:'Lv19',mv:'深渊审判·地狱之门',pal:'深渊魔紫',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:160}},
 {n:'上古太阳神',lv:'Lv20',mv:'创世神谕·天降太阳',pal:'鎏金圣阳',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'铸星者·原初匠人',lv:'赛季',mv:'创世锻造',pal:'熔金星核',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'统御天使·圣光之翼',lv:'赛季',mv:'圣光裁决',pal:'纯白圣光',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'无光之渊·暗噬君主',lv:'赛季',mv:'锁魂囚渊',pal:'渊狱紫',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'时之君主·克罗诺斯之影',lv:'赛季',mv:'终焉时刻',pal:'时空金青',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'终末观测者·边界守夜人',lv:'赛季',mv:'星图烙印',pal:'观测青·末日红',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}},
 {n:'星海女帝·赛尔娅',alias:'星海女帝',lv:'传说',mv:'星海圣典·超新星挽歌',pal:'虹彩星海',ps:['sz','sp','fxi'],df:{sz:100,sp:100,fxi:100}}
];
var PLBL={sz:'规模',sp:'速度',fxi:'强度(弹幕/火花)'};
/* 配色预设(新五招): 定稿=无 filter; 变体=hue-rotate/saturate/brightness 组合, 与预览页三配色同观感 */
var PALSETS={
 '史前霸王龙':[{n:'🟡 远古琥珀'},{n:'🔴 血怒',hue:-38},{n:'🟢 丛林',hue:46}],
 '千年僵尸':[{n:'🟢 尸毒'},{n:'🟣 怨灵',hue:-173,bri:1.4},{n:'🔵 阴火',hue:104}],
 '暗夜吸血鬼':[{n:'🔴 血月'},{n:'🟣 魅影',hue:-89},{n:'🔵 幽蓝',hue:-162}],
 '蒙面大魔王':[{n:'🟣 魔王紫'},{n:'🔴 炼狱',hue:89},{n:'🟢 鬼焰',hue:173,bri:.7}],
 '地狱犬王':[{n:'🔥 炼狱橙'},{n:'🟢 幽冥',hue:59},{n:'🔵 鬼火',hue:163}],
 '黑森林巫婆':[{n:'🟣 巫毒紫'},{n:'🟢 沼泽',hue:173,bri:.7},{n:'🔴 血咒',hue:89}],
 '异次元巫师':[{n:'🟣 异次元紫'},{n:'🔵 星空',hue:-54},{n:'🟢 翡翠',hue:-111,bri:.7}],
 '龙骑士统帅':[{n:'🔥 龙焰'},{n:'🟡 圣金',hue:23},{n:'🔵 苍蓝',hue:-167}],
 '暗黑灯神':[{n:'🟣 暗黑靛'},{n:'🟢 魂绿',hue:-81,sat:.77,bri:.77},{n:'🔴 血咒',hue:121}],
 '海底巨怪':[{n:'🌊 深渊青'},{n:'🟣 幽紫',hue:70,bri:1.24},{n:'🟢 毒绿',hue:-104}],
 '寒冰女王':[{n:'❄️ 寒冰蓝'},{n:'🟣 极光紫',hue:67,bri:1.4},{n:'⚪ 霜白',hue:27,bri:1.22}],
 '烈焰魔神':[{n:'🔥 炽焰橙'},{n:'🔵 幽蓝魔焰',hue:174},{n:'🟣 炼狱紫',hue:-114,bri:1.23}],
 '雷电之主':[{n:'⚡ 苍雷蓝'},{n:'🟣 紫电狱雷',hue:70,sat:1.05},{n:'🟢 翡翠神雷',hue:-60,sat:1.05}],
 '机械泰坦':[{n:'🔴 猩红警戒'},{n:'🔵 量子冷光',hue:200},{n:'🟡 战术鎏金',hue:45,sat:1.1}],
 '外星霸主':[{n:'👽 异星翠绿'},{n:'🔵 深空幽蓝',hue:70},{n:'🟣 星云魔紫',hue:130}],
 '混沌魔尊':[{n:'🟣 深渊魔紫'},{n:'🔴 血狱赤焰',hue:90,sat:1.05},{n:'🟠 熔狱业火',hue:115,sat:1.08}],
 '上古太阳神':[{n:'☀️ 鎏金圣阳'},{n:'🔥 炽核熔阳',hue:-18,sat:1.18},{n:'⚪ 白炽圣辉',hue:7,sat:.6,bri:1.15}]
};
function palMatch(bo,ps){ return (bo.hue||0)===(ps.hue||0)&&(bo.sat||0)===(ps.sat||0)&&(bo.bri||0)===(ps.bri||0); }
function lsGet(){try{return JSON.parse(localStorage.getItem(LSK)||'{}');}catch(e){return {};}}
function lsSet(o){try{localStorage.setItem(LSK,JSON.stringify(o));}catch(e){}}
function syncAlias(all,b){ if(!b||!b.alias)return; if(all[b.n]){all[b.alias]=JSON.parse(JSON.stringify(all[b.n]));}else{delete all[b.alias];} }
function djb2(s){var h=5381;for(var i=0;i<s.length;i++){h=((h*33)^s.charCodeAt(i))>>>0;}return h;}
function checkPw(pw,cb){
  if(window.crypto&&crypto.subtle&&crypto.subtle.digest){
    try{
      crypto.subtle.digest('SHA-256',new TextEncoder().encode(pw)).then(function(buf){
        var hex=Array.prototype.map.call(new Uint8Array(buf),function(b){return ('0'+b.toString(16)).slice(-2);}).join('');
        cb(hex===PW_SHA);
      }).catch(function(){cb(djb2(pw)===PW_DJB&&pw.length===50);});
      return;
    }catch(e){}
  }
  cb(djb2(pw)===PW_DJB&&pw.length===50);
}
var CSS='.hbafx-ovl{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(8,5,14,.88);z-index:10500;display:flex;align-items:center;justify-content:center;padding:14px}'+
'.hbafx-box{background:#1c1226;border:2px solid #4c3268;border-radius:18px;width:100%;max-width:420px;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 44px rgba(0,0,0,.6)}'+
'.hbafx-hd{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid #3a2752;flex:0 0 auto}'+
'.hbafx-hd b{color:#e9d5ff;font-size:15px;letter-spacing:1px}'+
'.hbafx-x{width:30px;height:30px;border-radius:9px;border:1px solid #4c3268;background:#241733;color:#c4b5fd;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer}'+
'.hbafx-body{overflow-y:auto;padding:12px 14px;flex:1 1 auto;-webkit-overflow-scrolling:touch}'+
'.hbafx-tip{font-size:11px;color:#a78bca;background:#241733;border:1px solid #3a2752;border-radius:10px;padding:8px 10px;line-height:1.55;margin-bottom:11px}'+
'.hbafx-card{background:#221531;border:1.5px solid #3a2752;border-radius:13px;padding:11px 12px;margin-bottom:10px}'+
'.hbafx-card.hbafx-mod{border-color:#fbbf24}'+
'.hbafx-bn{display:flex;align-items:center;gap:7px;flex-wrap:wrap}'+
'.hbafx-bn b{color:#f3e8ff;font-size:13.5px}'+
'.hbafx-lv{font-size:10px;color:#1c1226;background:#c4b5fd;border-radius:7px;padding:1.5px 7px;font-weight:800}'+
'.hbafx-pal{font-size:10px;color:#fde68a;border:1px solid #6b5224;border-radius:7px;padding:1.5px 7px}'+
'.hbafx-mv{font-size:11px;color:#a78bca;margin-top:2.5px}'+
'.hbafx-row{display:flex;align-items:center;gap:9px;margin-top:8px}'+
'.hbafx-row label{font-size:11.5px;color:#d8cbe8;width:96px;flex:0 0 auto}'+
'.hbafx-row input[type=range]{flex:1;accent-color:#a855f7}'+
'.hbafx-val{font-size:11.5px;color:#fde68a;width:46px;text-align:right;flex:0 0 auto;font-weight:700}'+
'.hbafx-palrow{display:flex;gap:6px;margin-top:9px;flex-wrap:wrap}'+
'.hbafx-palbtn{font-size:10.5px;color:#e9d5ff;border:1.5px solid #4c3268;border-radius:9px;padding:5px 9px;background:#1a1024;cursor:pointer}'+
'.hbafx-palbtn.on{border-color:#fde047;color:#fde68a;box-shadow:0 0 8px rgba(253,224,71,.35)}'+
'.hbafx-rst{margin-top:9px;font-size:11px;color:#c4b5fd;border:1px solid #4c3268;border-radius:8px;padding:4px 10px;background:none;cursor:pointer}'+
'.hbafx-none{font-size:11px;color:#7c6a96;margin-top:6px}'+
'.hbafx-ft{padding:11px 14px;border-top:1px solid #3a2752;display:flex;gap:9px;flex:0 0 auto}'+
'.hbafx-btn{flex:1;padding:10px 0;border-radius:11px;border:none;font-size:13px;font-weight:800;cursor:pointer}'+
'.hbafx-btn.pri{background:linear-gradient(135deg,#a855f7,#7c3aed);color:#fff}'+
'.hbafx-btn.sec{background:#241733;color:#c4b5fd;border:1px solid #4c3268}'+
'.hbafx-pwbox{padding:20px 18px;display:flex;flex-direction:column;gap:12px}'+
'.hbafx-pwbox p{font-size:12.5px;color:#c4b5fd;line-height:1.6}'+
'.hbafx-pw{width:100%;padding:11px 12px;border-radius:11px;border:1.5px solid #4c3268;background:#140c1e;color:#f3e8ff;font-size:14px;outline:none}'+
'.hbafx-pw:focus{border-color:#a855f7}'+
'.hbafx-err{font-size:11.5px;color:#f87171;min-height:15px}'+
'.hbafx-entry{display:flex;align-items:center;justify-content:space-between;padding:11px 13px;background:#221531;border:1.5px solid #4c3268;border-radius:12px;margin-top:10px;cursor:pointer}'+
'.hbafx-entry b{color:#e9d5ff;font-size:13.5px}'+
'.hbafx-entry span{color:#a78bca;font-size:11px}';
function injectCSS(){
  if(document.getElementById('hbafx-style'))return;
  var st=document.createElement('style');st.id='hbafx-style';st.textContent=CSS;document.head.appendChild(st);
}
function closeOvl(){var o=document.getElementById('hbafx-ovl');if(o&&o.parentNode)o.parentNode.removeChild(o);}
/* 🔴 v538: 伪装管理员门——只显示「输入密码」四个字+输入框(可粘贴); 永久锁定后点击毫无反应; 连续3次错锁死, 输对清零重计。 */
function openHiddenGate(){
  if(isLocked()) return;
  injectCSS();closeOvl();
  if(sessionStorage.getItem(SSK)==='1'){openPanel(false);return;}
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  o.innerHTML='<div class="hbafx-box" style="max-width:300px"><div class="hbafx-pwbox">'+
    '<p style="font-size:14.5px;color:#e9d5ff;font-weight:800;text-align:center;letter-spacing:2px">输入密码</p>'+
    '<input class="hbafx-pw" id="hbafxPw" type="password" autocomplete="off">'+
    '<div class="hbafx-err" id="hbafxErr"></div>'+
    '<button class="hbafx-btn pri" id="hbafxGo">确 定</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener('click',function(e){if(e.target===o)closeOvl();});
  var ip=document.getElementById('hbafxPw');
  function go(){
    if(isLocked()){closeOvl();return;}
    var v=ip.value||'';
    checkPw(v,function(ok){
      if(ok){ setFails(0); try{sessionStorage.setItem(SSK,'1');}catch(e){} openPanel(false); }
      else{
        var n=getFails()+1; setFails(n);
        if(n>=3){ lockNow(); closeOvl(); return; }   /* 第3次错: 永久锁死, 静默关闭 */
        var er=document.getElementById('hbafxErr');if(er)er.textContent='密码错误';
        ip.value='';try{ip.focus();}catch(e){}
      }
    });
  }
  document.getElementById('hbafxGo').onclick=go;
  ip.addEventListener('keydown',function(e){if(e.key==='Enter')go();});
  setTimeout(function(){try{ip.focus();}catch(e){}},80);
}
/* 🔴 v538: 用户未解锁提示框 */
function openUserLockTip(p){
  injectCSS();closeOvl();
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  o.innerHTML='<div class="hbafx-box" style="max-width:330px"><div class="hbafx-pwbox" style="text-align:center">'+
    '<div style="font-size:46px;line-height:1">🔒</div>'+
    '<p style="text-align:center"><b style="color:#fde68a;font-size:14px">Boss 特效调节 · 尚未解锁</b><br><br>通关全部 <b style="color:#fde68a">18 个岛</b>的所有 boss(每岛 Lv1~Lv20), 即可亲自调节每个 boss 的攻击特效!</p>'+
    '<div style="font-size:12px;color:#a78bca">当前进度: <b style="color:#fde68a">'+p.done+'</b> / '+p.total+'</div>'+
    '<button class="hbafx-btn pri" id="hbafxOk">继续闯关!</button></div></div>';
  document.body.appendChild(o);
  o.addEventListener('click',function(e){if(e.target===o)closeOvl();});
  var okb=document.getElementById('hbafxOk');if(okb)okb.onclick=closeOvl;
}
/* 🔴 v539: 卡牌入口密码门——只显示「输入密码」+输入框(可粘贴)+10 秒倒计时。
   倒计时归零未提交=记一次错并静默关窗; 提交错误=记一次错(未满3次→提示并重置10秒); 累计连续3次错→入口永久关闭(cardLockNow, 此后点击毫无反应); 输对→清零计数+临时解锁全部卡牌(24h)+轻提示。 */
function openCardGate(){
  if(cardLocked()) return;
  injectCSS();
  var old=document.getElementById('hbafx-cardovl'); if(old&&old.parentNode)old.parentNode.removeChild(old);
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-cardovl';o.style.zIndex='10600';
  o.innerHTML='<div class="hbafx-box" style="max-width:300px"><div class="hbafx-pwbox">'+
    '<p style="font-size:14.5px;color:#e9d5ff;font-weight:800;text-align:center;letter-spacing:2px">输入密码</p>'+
    '<div style="text-align:center;font-size:12px;color:#fcd34d;font-weight:800;letter-spacing:1px" id="hbafxCardCd">10.0 s</div>'+
    '<input class="hbafx-pw" id="hbafxCardPw" type="password" autocomplete="off" inputmode="numeric">'+
    '<div class="hbafx-err" id="hbafxCardErr"></div>'+
    '<button class="hbafx-btn pri" id="hbafxCardGo">确 定</button></div></div>';
  document.body.appendChild(o);
  var ip=document.getElementById('hbafxCardPw'), cd=document.getElementById('hbafxCardCd'), er=document.getElementById('hbafxCardErr');
  var deadline=Date.now()+10000, tick=null, settled=false;
  function killTimer(){ if(tick){clearInterval(tick);tick=null;} }
  function closeGate(){ killTimer(); if(o.parentNode)o.parentNode.removeChild(o); }
  function oneFail(silent){
    var n=getCardFails()+1; setCardFails(n);
    if(n>=3){ cardLockNow(); closeGate(); var row=document.getElementById('hbafxCardEntry'); if(row)row.onclick=function(){}; return true; }
    if(silent){ closeGate(); return false; }
    if(er)er.textContent='密码错误';
    ip.value=''; try{ip.focus();}catch(e){}
    deadline=Date.now()+10000;          // 每次尝试各给 10 秒
    return false;
  }
  tick=setInterval(function(){
    var left=deadline-Date.now();
    if(left<=0){ if(settled)return; settled=true; killTimer(); oneFail(true); /* 🔴 超时未提交=记一次错, 静默关窗 */ return; }
    if(cd)cd.textContent=(left/1000).toFixed(1)+' s';
  },100);
  function go(){
    if(settled)return;
    if(cardLocked()){ closeGate(); return; }
    var v=ip.value||'';
    checkCardPw(v,function(ok){
      if(settled)return;
      if(ok){
        settled=true; killTimer(); setCardFails(0); closeGate();
        try{ if(typeof window.hansenTempUnlock==='function'){ window.hansenTempUnlock(24); } else { localStorage.setItem('hansen_card_temp_unlock_until',String(Date.now()+24*3600*1000)); } }catch(e){ try{localStorage.setItem('hansen_card_temp_unlock_until',String(Date.now()+24*3600*1000));}catch(e2){} }
        try{
          var t=document.createElement('div');
          t.style.cssText='position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:10700;background:rgba(16,12,30,.92);border:1px solid rgba(74,222,128,.55);color:#bbf7d0;font-size:12.5px;font-weight:800;letter-spacing:1px;padding:10px 18px;border-radius:12px;box-shadow:0 6px 22px rgba(0,0,0,.5)';
          t.textContent='✅ 已解锁全部 boss 卡牌(预览 24 小时)';
          document.body.appendChild(t);
          setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },2300);
        }catch(e){}
        try{ if(typeof window.hansenRenderCards==='function')window.hansenRenderCards(); }catch(e){}
      }else{
        var locked=oneFail(false); if(locked){settled=true;}
      }
    });
  }
  document.getElementById('hbafxCardGo').onclick=go;
  ip.addEventListener('keydown',function(e){if(e.key==='Enter')go();});
  o.addEventListener('click',function(e){ if(e.target===o){ if(settled)return; settled=true; killTimer(); oneFail(true); /* 🔴 弹出后中途放弃=未在窗口内输对, 同样记一次错 */ } });
  setTimeout(function(){try{ip.focus();}catch(e){}},80);
}
var CUR_USER=false; /* 🔴 v538: 面板当前模式(用户/管理员), 内部重开沿用 */
function openPanel(userMode){
  if(userMode!==undefined)CUR_USER=!!userMode;
  injectCSS();closeOvl();
  var ov=lsGet();
  var o=document.createElement('div');o.className='hbafx-ovl';o.id='hbafx-ovl';
  var h='<div class="hbafx-box"><div class="hbafx-hd"><b>⚔️ Boss 特效调参'+(CUR_USER?'':'(管理员)')+'</b><div class="hbafx-x" id="hbafxX">✕</div></div><div class="hbafx-body">'+
    '<div class="hbafx-tip">⚠️ 所有调整<b style="color:#fde68a">实时生效并永久保存</b>。配色=整体换色(新五招有预设配色, 全员可用色相滑杆自定义); 速度调慢时伤害判定自动顺延; 改动过的 boss 亮金边。</div>';
  BOSSES.forEach(function(b,bi){
    var bo=ov[b.n]||{};
    var mod=Object.keys(bo).length>0;
    h+='<div class="hbafx-card'+(mod?' hbafx-mod':'')+'" data-bi="'+bi+'"><div class="hbafx-bn"><span class="hbafx-lv">'+b.lv+'</span><b>'+b.n+'</b><span class="hbafx-pal">🎨 '+b.pal+'</span></div><div class="hbafx-mv">'+b.mv+'</div>';
    var pset=PALSETS[b.n];
    if(pset){
      h+='<div class="hbafx-palrow">';
      pset.forEach(function(ps,pi){
        var on=(pi===0)?(!bo.hue&&!bo.sat&&!bo.bri):palMatch(bo,ps);
        h+='<button class="hbafx-palbtn'+(on?' on':'')+'" data-pb="'+bi+'" data-pi="'+pi+'">'+ps.n+'</button>';
      });
      h+='</div>';
    }
    var hv=Math.round((bo.hue||0));
    h+='<div class="hbafx-row"><label>🎨 色相偏移</label><input type="range" min="-180" max="180" value="'+hv+'" data-b="'+bi+'" data-p="hue"><span class="hbafx-val" data-v="'+bi+'_hue">'+(hv>0?'+':'')+hv+'°</span></div>';
    if(b.ps.length===0){
      h+='<div class="hbafx-none">基础特效 · 标准参数不可调(配色可调)</div>';
      h+='<button class="hbafx-rst" data-r="'+bi+'">↺ 恢复默认</button>';
    }else{
      b.ps.forEach(function(pk){
        var dv=b.df[pk], cur=(bo[pk]!=null)?Math.round(bo[pk]*100):dv;
        h+='<div class="hbafx-row"><label>'+PLBL[pk]+'</label><input type="range" min="50" max="200" value="'+cur+'" data-b="'+bi+'" data-p="'+pk+'"><span class="hbafx-val" data-v="'+bi+'_'+pk+'">'+(pk==='sp'?(cur/100).toFixed(2)+'x':cur+'%')+'</span></div>';
      });
      h+='<button class="hbafx-rst" data-r="'+bi+'">↺ 恢复默认</button>';
    }
    h+='</div>';
  });
  /* 🔴 v539: 卡牌入口——仅管理员面板可见(用户模式绝不渲染); 永久关闭后点击零反应(openCardGate 开头拦截)。 */
  if(!CUR_USER){
    h+='<div class="hbafx-entry" id="hbafxCardEntry" style="margin-top:4px"><b>🎴 卡牌入口</b><span>解锁全部 boss 卡牌 ›</span></div>';
    /* 🔴v766 难度图标调节器(藏管理员·卡牌入口下方·Hansen不让放公开「更多设置」): 拖动写 localStorage·拼写对战开机读取生效 */
    h+='<div style="margin-top:10px;padding:12px 13px;background:#1c1230;border:1.5px solid #4c3268;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🐢 拼写对战 · 难度图标</b></div>'+
       '<div class="hbafx-mv">容易/中等/困难三个图标的大小和上下位置 · 拖动实时保存 · 进拼写对战即生效</div>'+
       '<div class="hbafx-row"><label>📏 大小</label><input type="range" min="30" max="120" value="69" id="diffIcSizeRange"><span class="hbafx-val" id="diffIcSizeVal">69px</span></div>'+
       '<div class="hbafx-row"><label>↕️ 上下</label><input type="range" min="-30" max="30" value="0" id="diffIcDyRange"><span class="hbafx-val" id="diffIcDyVal">0px</span></div>'+
       '<div class="hbafx-row"><label>📦 框大小</label><input type="range" min="48" max="150" value="60" id="diffIcHRange"><span class="hbafx-val" id="diffIcHVal">60px</span></div>'+
       '<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:9px;padding:12px;background:rgba(255,255,255,.04);border-radius:10px"><div id="diffIcPvB0" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv0" src="speed/slow.webp?v=908" alt="" style="width:69px;height:69px;object-fit:contain"></div><div id="diffIcPvB1" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv1" src="speed/medium.webp?v=908" alt="" style="width:69px;height:69px;object-fit:contain"></div><div id="diffIcPvB2" style="background:#fbfcfe;border:1.5px solid #e3e9f2;border-radius:12px;height:60px;padding:0 13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center"><img id="diffIcPv2" src="speed/fast.webp?v=908" alt="" style="width:69px;height:69px;object-fit:contain"></div></div>'+
       '</div>';
    /* 🔴v775 左上角头像大小调节器(藏管理员·难度图标下方·Hansen嫌头像太小): 框大小+形象大小各自独立·拖动写localStorage·各岛开机读取生效 */
    h+='<div style="margin-top:10px;padding:12px 13px;background:#1c1230;border:1.5px solid #4c3268;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🦊 左上角头像 · 大小</b></div>'+
       '<div class="hbafx-mv">调的是头像那个彩色方框 + 里面形象的大小 · 顶栏高度锁死永不变 · 方框最大填满顶栏不溢出 · 两者各自独立 · 实时保存各岛生效</div>'+
       '<div class="hbafx-row"><label>📦 方框大小</label><input type="range" min="32" max="60" value="60" id="avFrameRange"><span class="hbafx-val" id="avFrameVal">60px</span></div>'+
       '<div class="hbafx-row"><label>🧍 形象大小</label><input type="range" min="55" max="115" value="95" id="avImgRange"><span class="hbafx-val" id="avImgVal">95%</span></div>'+
       '<div style="display:flex;align-items:center;justify-content:center;margin-top:9px;padding:18px;background:rgba(255,255,255,.04);border-radius:10px">'+
         '<div id="avPvBox" style="width:var(--hsnAvSize,60px);height:var(--hsnAvSize,60px);border-radius:13px;background:#34c3e0;overflow:hidden;position:relative;flex:none"><img id="avPvImg" src="avatars/01.webp?v=908" alt="" style="position:absolute;inset:0;margin:auto;max-width:var(--hsnAvImg,95%);max-height:var(--hsnAvImg,95%);width:auto;height:auto;object-fit:contain"></div>'+
       '</div>'+
       '</div>';
    /* 🔴 v804: 一键通关所有 Boss 开关(藏管理员·头像调节器下方·Hansen): ON=18岛360关全标记通关, OFF=精确还原真实进度 */
    var _allClr=isAllBossClearOn();
    h+='<div style="margin-top:10px;padding:12px 13px;background:#241533;border:1.5px solid #7c3aed;border-radius:12px">'+
       '<div class="hbafx-bn"><b>🗝️ 一键通关所有 Boss</b></div>'+
       '<div class="hbafx-mv">打开 = 18 个岛全部 360 个 boss 关立刻标记为已通关(解锁全部关卡/进度);关闭 = 精确恢复到打开前的真实进度。仅本机管理员可见。</div>'+
       '<button id="hbafxClearAll" style="width:100%;margin-top:10px;padding:11px;border-radius:11px;border:none;font-size:13px;font-weight:800;cursor:pointer;'+(_allClr?'background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff':'background:#1a1024;color:#c4b5fd;border:1.5px solid #7c3aed')+'">'+(_allClr?'✅ 已全部通关 · 点击关闭还原':'🗝️ 点击一键通关全部 Boss')+'</button>'+
       '<div id="hbafxClearAllNote" style="font-size:11px;color:#a78bca;margin-top:7px;text-align:center">'+(_allClr?'当前:全部 360 关已通关':'当前:按真实进度')+'</div>'+
       '</div>';
  }
  h+='</div><div class="hbafx-ft"><button class="hbafx-btn sec" id="hbafxRstAll">全部恢复默认</button><button class="hbafx-btn pri" id="hbafxDone">完 成</button></div></div>';
  o.innerHTML=h;
  (function(){var ce=o.querySelector('#hbafxCardEntry');if(ce)ce.onclick=function(){openCardGate();};})(); /* 🔴 v539: 必须 o.querySelector——此刻 o 尚未 appendChild 进文档, document.getElementById 找不到会静默漏绑(开发期真机抓获的时序bug) */
  /* 🔴v766/v768 难度图标调节器接线(管理员模式才有这些元素·用户模式querySelector=null自动跳过): 图标大小/图标上下/框大小3档·框大小=独立固定高度·与图标大小彻底解耦·写localStorage(size/dy/h)·拼写对战开机读取生效 */
  (function(){var KS='hansen_sb_diffic_size',KD='hansen_sb_diffic_dy',KH='hansen_sb_diffic_h';
    var sz=parseInt(localStorage.getItem(KS),10); if(isNaN(sz))sz=69;
    var dy=parseInt(localStorage.getItem(KD),10); if(isNaN(dy))dy=0;
    var fh=parseInt(localStorage.getItem(KH),10); if(isNaN(fh))fh=60;
    var rS=o.querySelector('#diffIcSizeRange'),rD=o.querySelector('#diffIcDyRange'),rH=o.querySelector('#diffIcHRange');
    var pv=[o.querySelector('#diffIcPv0'),o.querySelector('#diffIcPv1'),o.querySelector('#diffIcPv2')];
    var pvb=[o.querySelector('#diffIcPvB0'),o.querySelector('#diffIcPvB1'),o.querySelector('#diffIcPvB2')];
    /* 🔴v768 框大小=预览框独立高度(与图标解耦): 改图标只动图标·改框大小只动框高 */
    function paint(){pv.forEach(function(im){if(im){im.style.width=sz+'px';im.style.height=sz+'px';im.style.transform='translateY('+dy+'px)';}});
      pvb.forEach(function(bx){if(bx){bx.style.height=fh+'px';}});}
    if(rS){rS.value=sz; var sV=o.querySelector('#diffIcSizeVal'); if(sV)sV.textContent=sz+'px';
      rS.addEventListener('input',function(){sz=+this.value; var l=o.querySelector('#diffIcSizeVal'); if(l)l.textContent=sz+'px'; try{localStorage.setItem(KS,String(sz));}catch(e){} paint();});}
    if(rD){rD.value=dy; var dV=o.querySelector('#diffIcDyVal'); if(dV)dV.textContent=dy+'px';
      rD.addEventListener('input',function(){dy=+this.value; var l=o.querySelector('#diffIcDyVal'); if(l)l.textContent=dy+'px'; try{localStorage.setItem(KD,String(dy));}catch(e){} paint();});}
    if(rH){rH.value=fh; var hV=o.querySelector('#diffIcHVal'); if(hV)hV.textContent=fh+'px';
      rH.addEventListener('input',function(){fh=+this.value; var l=o.querySelector('#diffIcHVal'); if(l)l.textContent=fh+'px'; try{localStorage.setItem(KH,String(fh));}catch(e){} paint();});}
    paint();})();
  /* 🔴v775 左上角头像大小调节器接线(管理员才有这些元素·用户模式querySelector=null自动跳过): 框大小--hsnAvSize+形象大小--hsnAvImg各自独立·写localStorage(hansen_av_frame/img)·各岛hansen_avatar.js开机读取·顶栏头像+预览当场变 */
  (function(){var KF='hansen_av_frame',KI='hansen_av_img';
    var fr=parseInt(localStorage.getItem(KF),10); if(isNaN(fr))fr=60; if(fr>60)fr=60; if(fr<32)fr=32;
    var ig=parseInt(localStorage.getItem(KI),10); if(isNaN(ig))ig=95;
    var de=document.documentElement;
    de.style.setProperty('--hsnAvSize',fr+'px'); de.style.setProperty('--hsnAvImg',ig+'%');
    /* 预览显示当前头像角色立绘(只换src·尺寸靠CSS变量自动随动) */
    try{var av=JSON.parse(localStorage.getItem('hsn_avatar')||'{}');var cur=parseInt(av.cur,10)||1;var pi=o.querySelector('#avPvImg');if(pi)pi.src='avatars/'+(cur<10?'0'+cur:cur)+'.webp?v=908';}catch(e){}
    var rF=o.querySelector('#avFrameRange'),rI=o.querySelector('#avImgRange');
    if(rF){rF.value=fr; var fV=o.querySelector('#avFrameVal'); if(fV)fV.textContent=fr+'px';
      rF.addEventListener('input',function(){fr=+this.value; var l=o.querySelector('#avFrameVal'); if(l)l.textContent=fr+'px'; try{localStorage.setItem(KF,String(fr));}catch(e){} de.style.setProperty('--hsnAvSize',fr+'px');});}
    if(rI){rI.value=ig; var iV=o.querySelector('#avImgVal'); if(iV)iV.textContent=ig+'%';
      rI.addEventListener('input',function(){ig=+this.value; var l=o.querySelector('#avImgVal'); if(l)l.textContent=ig+'%'; try{localStorage.setItem(KI,String(ig));}catch(e){} de.style.setProperty('--hsnAvImg',ig+'%');});}
  })();
  document.body.appendChild(o);
  document.getElementById('hbafxX').onclick=closeOvl;
  document.getElementById('hbafxDone').onclick=closeOvl;
  o.addEventListener('input',function(e){
    var t=e.target;if(!t||t.type!=='range')return;
    if(!t.hasAttribute('data-b'))return;/*🔴v766 跳过非boss滑块(难度图标调节器diffIcSize/DyRange)·避免误判为boss参数*/
    var bi=+t.getAttribute('data-b'), pk=t.getAttribute('data-p'), b=BOSSES[bi];
    var v=+t.value;
    var vEl=o.querySelector('[data-v="'+bi+'_'+pk+'"]');
    var all=lsGet(); var cur=all[b.n]||{};
    if(pk==='hue'){
      if(vEl)vEl.textContent=(v>0?'+':'')+v+'°';
      if(v===0){delete cur.hue;}else{cur.hue=v;}
      var pr=o.querySelector('.hbafx-card[data-bi="'+bi+'"] .hbafx-palrow');
      if(pr){Array.prototype.forEach.call(pr.children,function(x,pi){
        var ps=(PALSETS[b.n]||[])[pi]||{};
        x.classList.toggle('on', pi===0?(!cur.hue&&!cur.sat&&!cur.bri):palMatch(cur,ps));
      });}
    }else{
      if(vEl)vEl.textContent=(pk==='sp'?(v/100).toFixed(2)+'x':v+'%');
      if(v===b.df[pk]){delete cur[pk];}else{cur[pk]=v/100;}
    }
    if(Object.keys(cur).length===0){delete all[b.n];}else{all[b.n]=cur;}
    syncAlias(all,b);
    lsSet(all);
    var card=o.querySelector('.hbafx-card[data-bi="'+bi+'"]');
    if(card)card.classList.toggle('hbafx-mod',!!all[b.n]);
  });
  o.addEventListener('click',function(e){
    var t=e.target;
    if(t===o){closeOvl();return;}
    if(t.classList&&t.classList.contains('hbafx-palbtn')){
      var pbi=+t.getAttribute('data-pb'), ppi=+t.getAttribute('data-pi');
      var pb=BOSSES[pbi], pps=(PALSETS[pb.n]||[])[ppi]||{};
      var pall=lsGet(); var pcur=pall[pb.n]||{};
      delete pcur.hue; delete pcur.sat; delete pcur.bri;
      if(pps.hue)pcur.hue=pps.hue; if(pps.sat)pcur.sat=pps.sat; if(pps.bri)pcur.bri=pps.bri;
      if(Object.keys(pcur).length===0){delete pall[pb.n];}else{pall[pb.n]=pcur;}
      syncAlias(pall,pb);
      lsSet(pall);
      var pcard=o.querySelector('.hbafx-card[data-bi="'+pbi+'"]');
      if(pcard){
        pcard.classList.toggle('hbafx-mod',!!pall[pb.n]);
        Array.prototype.forEach.call(pcard.querySelectorAll('.hbafx-palbtn'),function(x,pi){x.classList.toggle('on',pi===ppi);});
        var hrg=pcard.querySelector('input[data-p="hue"]'); if(hrg)hrg.value=pps.hue||0;
        var hvl=pcard.querySelector('[data-v="'+pbi+'_hue"]'); if(hvl)hvl.textContent=((pps.hue||0)>0?'+':'')+(pps.hue||0)+'°';
      }
      return;
    }
    if(t.classList&&t.classList.contains('hbafx-rst')){
      var bi=+t.getAttribute('data-r'), b=BOSSES[bi];
      var all=lsGet(); delete all[b.n]; syncAlias(all,b); lsSet(all);
      var card=o.querySelector('.hbafx-card[data-bi="'+bi+'"]');
      if(card){card.classList.remove('hbafx-mod');
        b.ps.forEach(function(pk){
          var rg=card.querySelector('input[data-p="'+pk+'"]'); if(rg)rg.value=b.df[pk];
          var vEl=card.querySelector('[data-v="'+bi+'_'+pk+'"]'); if(vEl)vEl.textContent=(pk==='sp'?(b.df[pk]/100).toFixed(2)+'x':b.df[pk]+'%');
        });
        var hrg=card.querySelector('input[data-p="hue"]'); if(hrg)hrg.value=0;
        var hvl=card.querySelector('[data-v="'+bi+'_hue"]'); if(hvl)hvl.textContent='0°';
        Array.prototype.forEach.call(card.querySelectorAll('.hbafx-palbtn'),function(x,pi){x.classList.toggle('on',pi===0);});
      }
    }
    if(t.id==='hbafxClearAll'){
      setAllBossClear(!isAllBossClearOn());
      var _on=isAllBossClearOn();
      t.style.background=_on?'linear-gradient(135deg,#22c55e,#16a34a)':'#1a1024';
      t.style.color=_on?'#fff':'#c4b5fd';
      t.style.border=_on?'none':'1.5px solid #7c3aed';
      t.textContent=_on?'✅ 已全部通关 · 点击关闭还原':'🗝️ 点击一键通关全部 Boss';
      var _nt=o.querySelector('#hbafxClearAllNote'); if(_nt)_nt.textContent=_on?'当前:全部 360 关已通关':'当前:按真实进度';
      return;
    }
    if(t.id==='hbafxRstAll'){
      lsSet({});
      closeOvl();openPanel();
    }
  });
}
/* 设置入口: MutationObserver 幂等注入 */
function ensureEntry(){
  /* 🔴 v538: 用户入口——不再提密码。锁态实时计算: 未解锁=🔒+进度, 点击弹解锁条件提示; 解锁=免密直接进面板(用户模式)。
     MutationObserver 触发即重算(只改 entry 自身 innerHTML, 不触发 sc childList → 无循环)。 */
  var sc=document.getElementById('settingsContent');
  if(!sc||!sc.firstChild)return;
  var d=document.getElementById('hbafxEntry');
  if(!d){
    d=document.createElement('div');
    d.className='hbafx-entry';d.id='hbafxEntry';
    d.onclick=function(){ var p=bossClearProgress(); if(p.all){ openPanel(true); } else { openUserLockTip(p); } };
    sc.appendChild(d);
  }
  var p=bossClearProgress();
  d.innerHTML = p.all ? '<b>🎚️ Boss 特效调节</b><span>已解锁 ›</span>'
                      : '<b>🔒 Boss 特效调节</b><span>通关全部 boss 解锁 '+p.done+'/'+p.total+'</span>';
}
function boot(){
  injectCSS();
  idbReconcile(); /* 🔴 v538: 开机用 IndexedDB 镜像校正锁/计数(清档难抹) */
  /* 🔴 v538: 伪装管理员入口——捕获级委托, 只命中"叶子节点+短文本+含『进度自动保存到本设备』"; 元素本身零改动零样式零提示。锁定后 openHiddenGate 内部直接 return = 毫无反应。 */
  try{
    document.addEventListener('click',function(e){
      try{
        var t=e.target;
        if(!t||t.nodeType!==1)return;
        if(t.children&&t.children.length>0)return;
        var tx=t.textContent||'';
        if(tx.length<40&&tx.indexOf('进度自动保存到本设备')>=0){ openHiddenGate(); }
      }catch(e2){}
    },true);
  }catch(e){}
  var sc=document.getElementById('settingsContent');
  if(sc){
    ensureEntry();
    try{ new MutationObserver(function(){ensureEntry();}).observe(sc,{childList:true}); }catch(e){ setInterval(ensureEntry,1500); }
  }else{ setInterval(ensureEntry,1500); }
}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}
})();
