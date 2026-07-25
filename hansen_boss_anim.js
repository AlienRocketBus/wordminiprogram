/**
 * 🐉 Boss 动画增强层 v4 (究极打击感) — 让每一拳都值回票价
 * 在现有 Boss 战上"纯加法"叠加全套 game-feel, 19 岛通用。
 *
 * 待机   — 主题色光环呼吸 + 周身火星升腾
 * 入场   — 旋转砸入
 * 蓄力扑击— 答错时 Boss 蓄力再猛扑 + 红色冲击波
 * 勇者出击— 答对时勇者⚔️冲向 Boss
 * 斩击光刃— 命中白色光刃划过 + 中心爆点
 * 飘字伤害— 数字弹出飞升, 按连击染色, 暴击放大变金
 * 火花进化— 连击越高越多越烫, 带重力下坠
 * 连击华彩— 里程碑弹"连击 ×N 🔥"; 连击药丸每次命中心跳放大, 越高越烫
 * 血条手感— ★平滑下滑 + 残血"碎片拖影"(慢追的黄色损失量) + 残血红色脉动
 * 镜头猛推— ★暴击时 Boss 朝镜头猛推一下, 顿挫感拉满
 * 冲击速度线—★暴击/击杀瞬间向 Boss 汇聚的爆发线条
 * 命中震屏— 暴击/高连击震更狠
 * 狂怒登场— 全屏红闪 + 怒吼放大 + 竞技场边缘红色脉动
 * 阶段跃迁— 金色闪光
 * 史诗击败— ★放射神光 + 白屏爆闪 + 火花炸裂 + 双冲击波 + 「⚔️ 击败!」印章
 *
 * 铁律(零bug): 只包裹现有全局函数(原函数永远先跑); 所有追加全裹 try/catch, 缺元素静默跳过;
 *   全屏特效一律 fixed + pointer-events:none(绝不挡点题) + 自动回收无泄漏;
 *   伤害/暴击/连击/血量读 #bossHPText、#bossMsg、#bossComboNum、#bossHPFill 真实值, 不猜。
 */
(function(){
  'use strict';
  if(window.__hsnBossAnim) return;
  window.__hsnBossAnim = true;

  function injectCSS(){
    if(document.getElementById('hsn-boss-anim-css')) return;
    var st = document.createElement('style');
    st.id = 'hsn-boss-anim-css';
    st.textContent = [
      '.boss-sprite.hsn-boss-enter{animation:hsnEnter .78s cubic-bezier(.34,1.56,.64,1) !important}',
      '@keyframes hsnEnter{0%{transform:translateY(-72px) scale(.24) rotate(0deg);opacity:0}55%{transform:translateY(10px) scale(1.22) rotate(0deg);opacity:1}78%{transform:translateY(-4px) scale(.95)}100%{transform:translateY(0) scale(1)}}',
      '.boss-sprite.hsn-boss-attack{animation:hsnAtk .58s ease-in-out !important}',
      '@keyframes hsnAtk{0%{transform:translateY(0) scale(1)}18%{transform:translateY(-14px) scale(1.08) rotate(0deg)}46%{transform:translateY(28px) scale(1.27) rotate(0deg);filter:drop-shadow(0 0 28px #ef4444) brightness(1.45)}66%{transform:translateY(-9px) scale(.92)}100%{transform:translateY(0) scale(1) rotate(0)}}',
      '.boss-sprite.hsn-roar{animation:hsnRoar .62s ease-in-out !important}',
      '@keyframes hsnRoar{0%{transform:scale(1)}20%{transform:scale(1.26) rotate(0deg);filter:drop-shadow(0 0 30px #ef4444) brightness(1.3)}42%{transform:scale(1.15) rotate(0deg)}62%{transform:scale(1.22) rotate(0deg)}100%{transform:scale(1)}}',
      '.boss-sprite.hsn-boss-die{animation:hsnDie .96s ease-in forwards !important}',
      '@keyframes hsnDie{0%{transform:scale(1) rotate(0);opacity:1;filter:brightness(1)}22%{transform:scale(1.34) rotate(0deg);filter:brightness(3) drop-shadow(0 0 40px #fff)}40%{transform:scale(1.16) rotate(0deg)}100%{transform:scale(0) rotate(0deg);opacity:0;filter:grayscale(1) brightness(.3)}}',
      '.hero-sprite.hsn-hero-strike{animation:hsnHero .5s cubic-bezier(.5,-0.4,.4,1.4)}',
      '@keyframes hsnHero{0%{transform:translateY(0) scale(1) rotate(0)}35%{transform:translateY(-36px) scale(1.45) rotate(0deg)}55%{transform:translateY(-32px) scale(1.5) rotate(0deg)}100%{transform:translateY(0) scale(1) rotate(0)}}',
      '.boss-sprite-wrap .hsn-dmg{position:absolute;left:50%;top:2px;transform:translateX(-50%);font-weight:900;font-size:27px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6),0 0 12px rgba(239,68,68,.7);pointer-events:none;z-index:6;white-space:nowrap;animation:hsnDmg .92s ease-out forwards}',
      '.boss-sprite-wrap .hsn-dmg.crit{font-size:41px;color:#fde047 !important;text-shadow:0 2px 8px rgba(0,0,0,.7),0 0 22px #fbbf24}',
      '@keyframes hsnDmg{0%{opacity:0;transform:translateX(-50%) translateY(10px) scale(.5)}18%{opacity:1;transform:translateX(-50%) translateY(-8px) scale(1.18)}38%{transform:translateX(-50%) translateY(-20px) scale(1)}100%{opacity:0;transform:translateX(-50%) translateY(-78px) scale(.92)}}',
      '.boss-sprite-wrap .hsn-spark{position:absolute;left:50%;top:50%;border-radius:50%;pointer-events:none;z-index:4;opacity:1}',
      '.boss-sprite-wrap .hsn-ember{position:absolute;border-radius:50%;pointer-events:none;z-index:1}',
      '.boss-sprite-wrap .hsn-shockwave{position:absolute;left:50%;top:50%;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(255,255,255,.85);pointer-events:none;z-index:3;animation:hsnShock .56s ease-out forwards}',
      '@keyframes hsnShock{0%{transform:scale(.3);opacity:.9;border-width:4px}100%{transform:scale(4.4);opacity:0;border-width:1px}}',
      '.boss-sprite-wrap .hsn-impact{position:absolute;left:50%;top:50%;width:80px;height:80px;margin:-40px 0 0 -40px;border-radius:50%;pointer-events:none;z-index:2;background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(248,113,113,.78) 36%,rgba(239,68,68,0) 70%);animation:hsnImpact .46s ease-out forwards}',
      '@keyframes hsnImpact{0%{transform:scale(.2);opacity:1}100%{transform:scale(2.7);opacity:0}}',
      '.boss-sprite-wrap .hsn-core{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.98),rgba(255,255,255,0) 70%);pointer-events:none;z-index:4;animation:hsnCore .26s ease-out forwards}',
      '@keyframes hsnCore{0%{transform:scale(.2);opacity:1}100%{transform:scale(2);opacity:0}}',
      '.boss-sprite-wrap .hsn-slash{position:absolute;left:50%;top:50%;width:150px;height:9px;margin:-4.5px 0 0 -75px;border-radius:9px;background:linear-gradient(90deg,transparent,#fff 45%,#dbeafe 55%,transparent);box-shadow:0 0 18px #fff,0 0 34px #93c5fd;pointer-events:none;z-index:5;transform:rotate(-34deg) scaleX(0);opacity:0}',
      '.boss-sprite-wrap .hsn-slash.go{animation:hsnSlash .33s ease-out forwards}',
      '@keyframes hsnSlash{0%{transform:rotate(-34deg) scaleX(0);opacity:0}42%{transform:rotate(-34deg) scaleX(1);opacity:1}100%{transform:rotate(-34deg) scaleX(1.1);opacity:0}}',
      '.boss-sprite-wrap .hsn-aura{position:absolute;left:50%;top:50%;width:132px;height:132px;margin:-66px 0 0 -66px;border-radius:50%;pointer-events:none;z-index:0;animation:hsnAura 2.6s ease-in-out infinite}',
      '@keyframes hsnAura{0%,100%{transform:scale(.82);opacity:.28}50%{transform:scale(1.12);opacity:.6}}',
      '.boss-sprite-wrap.hsn-zoom{animation:hsnZoom .26s ease-out}',
      '@keyframes hsnZoom{0%{transform:scale(1)}40%{transform:scale(1.07)}100%{transform:scale(1)}}',
      /* 血条手感 */
      '#bossHPFill{position:relative;z-index:2;transition:width .32s cubic-bezier(.4,0,.2,1)}',
      '.boss-hp-bar{position:relative;overflow:hidden}',
      '.boss-hp-bar .hsn-hp-ghost{position:absolute;left:0;top:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#fef08a,#fde047);box-shadow:0 0 8px rgba(253,224,71,.7);z-index:1;pointer-events:none}',
      '#bossHPFill.hsn-hp-low{animation:hsnHpLow .85s ease-in-out infinite}',
      '@keyframes hsnHpLow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.55) drop-shadow(0 0 9px #ef4444)}}',
      /* 连击药丸心跳 */
      '.boss-combo.hsn-combo-pop{animation:hsnComboPop .36s cubic-bezier(.3,1.5,.5,1)}',
      '@keyframes hsnComboPop{0%{transform:scale(1)}45%{transform:scale(1.3)}100%{transform:scale(1)}}',
      /* 震屏 */
      '.hsn-hit-shake{animation:hsnShakeSm .17s}',
      '.hsn-hit-shake.lg{animation:hsnShakeLg .3s}',
      '@keyframes hsnShakeSm{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px)}75%{transform:translate(-2px,1px)}}',
      '@keyframes hsnShakeLg{0%,100%{transform:translate(0,0)}15%{transform:translate(-8px,4px)}35%{transform:translate(8px,-4px)}55%{transform:translate(-6px,3px)}75%{transform:translate(5px,-3px)}}',
      /* 全屏闪光 */
      '.hsn-screen-flash{position:fixed;inset:0;pointer-events:none;z-index:99990;opacity:0}',
      '.hsn-screen-flash.show{animation:hsnScreenFlash .24s ease-out}',
      '@keyframes hsnScreenFlash{0%{opacity:0}28%{opacity:.7}100%{opacity:0}}',
      /* 速度线 / 神光 */
      '.hsn-speedlines{position:fixed;inset:0;pointer-events:none;z-index:99985;opacity:0;background:repeating-conic-gradient(from 0deg at 50% 44%,rgba(255,255,255,0) 0deg 3.4deg,rgba(255,255,255,.5) 3.4deg 4deg);-webkit-mask:radial-gradient(circle at 50% 44%,transparent 28%,#000 64%);mask:radial-gradient(circle at 50% 44%,transparent 28%,#000 64%)}',
      '.hsn-speedlines.go{animation:hsnSpeed .34s ease-out}',
      '@keyframes hsnSpeed{0%{opacity:0;transform:scale(1.6)}30%{opacity:.85}100%{opacity:0;transform:scale(1)}}',
      '.hsn-godrays{position:fixed;inset:0;pointer-events:none;z-index:99986;opacity:0;transform-origin:50% 42%;background:repeating-conic-gradient(from 0deg at 50% 42%,rgba(255,238,180,0) 0deg 5deg,rgba(255,238,180,.55) 5deg 9deg);-webkit-mask:radial-gradient(circle at 50% 42%,#000 0%,transparent 68%);mask:radial-gradient(circle at 50% 42%,#000 0%,transparent 68%)}',
      '.hsn-godrays.go{animation:hsnGod .78s ease-out}',
      '@keyframes hsnGod{0%{opacity:0;transform:scale(.3) rotate(0)}26%{opacity:.85}100%{opacity:0;transform:scale(1.5) rotate(0deg)}}',
      /* 狂怒边缘 */
      '.hsn-vignette{position:fixed;inset:0;pointer-events:none;z-index:99980;background:radial-gradient(ellipse at center,transparent 50%,rgba(239,68,68,.28) 100%);opacity:.55}',
      /* 🔴 BUG#50 修复 (v470): rage 红色边缘改【静态】—— 原 animation:hsnVignette 让边缘 opacity .42↔.92 持续脉动, 会让 Hansen 晕。保留静态红边氛围(其他特效), 绝不加回脉动动画。hsnVignette 关键帧已弃用。 */
      '@keyframes hsnVignette{0%,100%{opacity:.42}50%{opacity:.92}}',
      /* 连击华彩 / 击败印章 */
      '.hsn-combo{position:fixed;left:50%;top:25%;transform:translateX(-50%);pointer-events:none;z-index:99991;font-weight:900;font-size:31px;color:#fde047;text-shadow:0 2px 8px rgba(0,0,0,.6),0 0 20px #fbbf24;white-space:nowrap;animation:hsnCombo .92s ease-out forwards}',
      '@keyframes hsnCombo{0%{opacity:0;transform:translateX(-50%) scale(.4) rotate(0deg)}25%{opacity:1;transform:translateX(-50%) scale(1.28) rotate(0deg)}45%{transform:translateX(-50%) scale(1) rotate(0)}100%{opacity:0;transform:translateX(-50%) scale(1.05) translateY(-32px)}}',
      '.hsn-stamp{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);pointer-events:none;z-index:99992;font-weight:900;font-size:56px;color:#fff;text-shadow:0 4px 16px rgba(0,0,0,.7),0 0 32px #ef4444;white-space:nowrap;animation:hsnStamp 1.05s cubic-bezier(.2,1.4,.4,1) forwards}',
      '@keyframes hsnStamp{0%{opacity:0;transform:translate(-50%,-50%) scale(2.5) rotate(0deg)}30%{opacity:1;transform:translate(-50%,-50%) scale(.94) rotate(0deg)}46%{transform:translate(-50%,-50%) scale(1.05) rotate(0)}82%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  // ── 工具 ──
  function sprite(){ return document.getElementById('bossSprite'); }
  function wrap(){ return document.querySelector('.boss-sprite-wrap'); }
  function readNum(id){ var el = document.getElementById(id); if(!el) return null; var m = (el.textContent||'').match(/-?\d+/); return m ? parseInt(m[0],10) : null; }
  function fillWidth(){ var f = document.getElementById('bossHPFill'); if(!f) return null; var w = parseFloat((f.style.width||'').replace('%','')); return isNaN(w) ? null : w; }
  function bossMsgHas(s){ var el = document.getElementById('bossMsg'); return !!(el && (el.textContent||'').indexOf(s) >= 0); }
  function spriteColor(){ try { var f = (sprite() && sprite().style && sprite().style.filter) || ''; var m = f.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/); if(m) return m[0]; } catch(e){} return '#ef4444'; }
  function flashClass(el, cls, ms){ if(!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); if(ms) setTimeout(function(){ try { el.classList.remove(cls); } catch(e){} }, ms); }
  function comboColors(combo, crit){
    if(crit) return ['#fff','#fde047','#fbbf24','#f59e0b'];
    if(combo >= 8) return ['#fff','#fca5a5','#f87171','#ef4444'];
    if(combo >= 5) return ['#fff','#fdba74','#fb923c','#f59e0b'];
    if(combo >= 3) return ['#fff','#fde047','#fbbf24'];
    return ['#fff','#fef3c7','#fde047'];
  }

  // ── 特效 ──
  function bossEnter(){ flashClass(sprite(), 'hsn-boss-enter', 800); }
  function bossRoar(){ flashClass(sprite(), 'hsn-roar', 640); }
  function heroStrike(){ flashClass(document.querySelector('.hero-sprite'), 'hsn-hero-strike', 520); }
  function zoomPunch(){ /* 🔴 BUG#52 (v475): 竞技场缩放猛冲【禁用】—— 暴击时猛缩放=晃, Hansen 会晕。空函数。 */ }

  function bossAttack(){ flashClass(sprite(), 'hsn-boss-attack', 600); var w = wrap(); if(!w) return; var d = document.createElement('div'); d.className = 'hsn-impact'; w.appendChild(d); setTimeout(function(){ if(d.parentNode) d.remove(); }, 500); }
  function slash(){ /* 🔴 BUG#52 (v475): 白色斩击线【禁用】—— 每次答对白闪一道, Hansen 会晕。空函数。 */ }
  function impactCore(){ /* 🔴 BUG#52 (v475): boss中心白色亮闪核【禁用】—— 每次答对一下白闪, Hansen 会晕。空函数。 */ }
  function shockwave(){ var w = wrap(); if(!w) return; var r = document.createElement('div'); r.className = 'hsn-shockwave'; w.appendChild(r); setTimeout(function(){ if(r.parentNode) r.remove(); }, 580); }

  function damageNumber(dmg, crit, combo){
    var w = wrap(); if(!w || !(dmg > 0)) return;
    var d = document.createElement('div'); d.className = 'hsn-dmg' + (crit ? ' crit' : '');
    d.textContent = (crit ? '暴击 -' : '-') + dmg;
    if(!crit) d.style.color = combo >= 8 ? '#f87171' : combo >= 5 ? '#fb923c' : combo >= 3 ? '#fde047' : '#fff';
    w.appendChild(d); setTimeout(function(){ if(d.parentNode) d.remove(); }, 950);
  }

  function sparkBurst(combo, crit, killing){
    var w = wrap(); if(!w) return;
    var cols = comboColors(combo, crit);
    var n = killing ? 22 : Math.min(6 + Math.max(0, combo), 16) + (crit ? 5 : 0);
    for(var k = 0; k < n; k++){
      (function(idx){
        var s = document.createElement('div'); s.className = 'hsn-spark';
        var sz = 7 + Math.random() * 8;
        s.style.width = s.style.height = sz.toFixed(1) + 'px';
        s.style.margin = '-' + (sz/2).toFixed(1) + 'px 0 0 -' + (sz/2).toFixed(1) + 'px';
        var c = cols[idx % cols.length];
        s.style.background = c; s.style.boxShadow = '0 0 8px ' + c;
        s.style.transition = 'transform .72s cubic-bezier(.15,.7,.3,1), opacity .72s ease-out';
        w.appendChild(s); void s.offsetWidth;
        var ang = Math.random() * Math.PI * 2;
        var dist = (killing ? 46 : 32) + Math.random() * (killing ? 72 : 54);
        var dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist + (killing ? 20 : 8);
        s.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px) scale(.2)';
        s.style.opacity = '0';
        setTimeout(function(){ if(s.parentNode) s.remove(); }, 760);
      })(k);
    }
  }

  function screenShake(level){ /* 🔴 BUG#52 (v475): 震屏【彻底禁用】—— Hansen 打 boss 答对时屏幕晃动会晕。原连击≥5/暴击会震屏(.hsn-hit-shake)。空函数, 绝不恢复。check_resources 检查15 守卫。 */ }

  function comboLabel(n){
    if(!(n >= 3)) return;
    if(!(n === 3 || n === 5 || (n >= 8 && n % 4 === 0))) return;
    var d = document.createElement('div'); d.className = 'hsn-combo';
    d.textContent = '连击 ×' + n + ' 🔥';
    if(n >= 8){ d.style.color = '#fca5a5'; d.style.fontSize = '35px'; }
    document.body.appendChild(d); setTimeout(function(){ if(d.parentNode) d.remove(); }, 950);
  }

  // 连击药丸: 心跳放大 + 越高越烫
  function comboPulse(combo, doPop){
    var pill = document.querySelector('.boss-combo'); if(!pill) return;
    if(combo >= 8){ pill.style.borderColor = '#ef4444'; pill.style.color = '#fecaca'; pill.style.boxShadow = '0 0 14px rgba(239,68,68,.7)'; pill.style.background = 'rgba(239,68,68,.18)'; }
    else if(combo >= 5){ pill.style.borderColor = '#fb923c'; pill.style.color = '#fed7aa'; pill.style.boxShadow = '0 0 12px rgba(251,146,60,.6)'; pill.style.background = 'rgba(251,146,60,.16)'; }
    else if(combo >= 3){ pill.style.borderColor = '#fbbf24'; pill.style.color = '#fef3c7'; pill.style.boxShadow = '0 0 10px rgba(251,191,36,.5)'; pill.style.background = ''; }
    else { pill.style.borderColor = ''; pill.style.color = ''; pill.style.boxShadow = ''; pill.style.background = ''; }
    if(doPop) flashClass(pill, 'hsn-combo-pop', 380);
  }

  // 血条: 平滑下滑(CSS) + 碎片拖影 + 残血脉动
  function hpGhostTrail(oldW, newW){
    var bar = document.querySelector('.boss-hp-bar'); if(!bar) return;
    if(!(newW < oldW - 0.3)) return;
    var g = bar.querySelector('.hsn-hp-ghost');
    if(!g){ g = document.createElement('div'); g.className = 'hsn-hp-ghost'; bar.insertBefore(g, bar.firstChild); }
    g.style.transition = 'none'; g.style.width = oldW + '%';
    void g.offsetWidth;
    setTimeout(function(){ try { g.style.transition = 'width .55s ease-out'; g.style.width = newW + '%'; } catch(e){} }, 130);
  }
  function hpLowPulse(newW){
    var f = document.getElementById('bossHPFill'); if(!f || newW == null) return;
    if(newW > 0 && newW < 25) f.classList.add('hsn-hp-low'); else f.classList.remove('hsn-hp-low');
  }

  function screenFlash(color){ /* 🔴 BUG#50 修复 (v470): 全屏闪光特效【彻底禁用】—— Hansen 对屏幕闪会头晕、眼睛不适。狂怒登场红闪 / 阶段跃迁金闪 / 史诗击败白闪 全部经此函数, 保持【空函数】, 绝不恢复创建 .hsn-screen-flash。(check_resources 检查15 守卫: 本函数一旦再创建元素即拒打包。) */ }
  function speedLines(){ /* 🔴 BUG#52 (v475): 全屏速度线【禁用】—— 暴击/击败时全屏闪线, Hansen 会晕。空函数。 */ }
  function godRays(){ /* 🔴 BUG#52 (v475): 全屏神光【禁用】—— 击败时全屏放射光, Hansen 会晕。空函数。 */ }
  function defeatedStamp(){ var d = document.createElement('div'); d.className = 'hsn-stamp'; d.textContent = '⚔️ 击败!'; document.body.appendChild(d); setTimeout(function(){ if(d.parentNode) d.remove(); }, 1100); }

  function rageVignetteOn(){ if(document.querySelector('.hsn-vignette')) return; var v = document.createElement('div'); v.className = 'hsn-vignette'; document.body.appendChild(v); }
  function rageVignetteOff(){ var list = document.querySelectorAll('.hsn-vignette'); for(var i = 0; i < list.length; i++){ if(list[i].parentNode) list[i].remove(); } }

  function ensureAura(){
    var w = wrap(), s = sprite(); if(!w || !s) return;
    if(s.style.zIndex !== '1'){ s.style.position = 'relative'; s.style.zIndex = '1'; }
    if(w.querySelector('.hsn-aura')) return;
    var a = document.createElement('div'); a.className = 'hsn-aura';
    a.style.background = 'radial-gradient(circle,' + spriteColor() + ' 0%, transparent 68%)';
    w.insertBefore(a, w.firstChild);
  }
  function spawnEmber(){
    var w = wrap(); if(!w) return;
    var e = document.createElement('div'); e.className = 'hsn-ember';
    var sz = 4 + Math.random() * 5, c = spriteColor();
    e.style.width = e.style.height = sz.toFixed(1) + 'px';
    e.style.background = c; e.style.boxShadow = '0 0 6px ' + c;
    e.style.left = (20 + Math.random() * 60) + '%'; e.style.top = '78%'; e.style.opacity = '0.85';
    e.style.transition = 'transform 1.6s ease-out, opacity 1.6s ease-out';
    w.appendChild(e); void e.offsetWidth;
    e.style.transform = 'translateY(-72px) translateX(' + ((Math.random() - 0.5) * 30).toFixed(0) + 'px) scale(.4)';
    e.style.opacity = '0';
    setTimeout(function(){ if(e.parentNode) e.remove(); }, 1650);
  }
  function ambientTick(){
    try { var s = sprite(); if(s && s.offsetParent !== null){ ensureAura(); if(Math.random() < 0.75) spawnEmber(); } else { rageVignetteOff(); } } catch(e){}
  }

  function epicDeath(){
    try { godRays(); speedLines(); screenFlash('rgba(255,255,255,.92)'); } catch(e){}
    var s = sprite();
    if(s){ s.classList.remove('hsn-boss-attack', 'boss-hit-anim', 'hsn-roar'); void s.offsetWidth; s.classList.add('hsn-boss-die'); }
    sparkBurst(0, false, true);
    shockwave(); setTimeout(shockwave, 150);
    screenShake(2);
    setTimeout(defeatedStamp, 250);
    rageVignetteOff();
  }

  // ── 包裹器 ──
  function wrapFn(name, hooks){
    var orig = window[name];
    if(typeof orig !== 'function') return false;
    if(orig.__hsnWrapped) return true;
    var wrapped = function(){ var ctx = {}; try { if(hooks.before) hooks.before(ctx, arguments); } catch(e){} var r = orig.apply(this, arguments); try { if(hooks.after) hooks.after(ctx, arguments); } catch(e){} return r; };
    wrapped.__hsnWrapped = true;
    window[name] = wrapped;
    return true;
  }

  function init(){
    try { injectCSS(); } catch(e){}
    try { setInterval(ambientTick, 560); } catch(e){}

    wrapFn('startBoss', { after: function(){ setTimeout(bossEnter, 40); } });

    wrapFn('bossAnswer', {
      before: function(ctx){ ctx.hero = readNum('heroHPText'); ctx.boss = readNum('bossHPText'); ctx.hpW = fillWidth(); },
      after: function(ctx){
        var heroNow = readNum('heroHPText'), bossNow = readNum('bossHPText'), newW = fillWidth();
        if(ctx.boss != null && bossNow != null && bossNow < ctx.boss){
          var dmg = ctx.boss - bossNow;
          var crit = bossMsgHas('暴击');
          var combo = readNum('bossComboNum') || 0;
          var killed = bossNow <= 0;
          if(ctx.hpW != null && newW != null) hpGhostTrail(ctx.hpW, newW);
          hpLowPulse(newW);
          heroStrike();
          comboPulse(combo, true);
          if(crit){ zoomPunch(); speedLines(); }
          setTimeout(function(){
            slash(); impactCore();
            damageNumber(dmg, crit, combo);
            sparkBurst(combo, crit, false);
            screenShake(crit ? 2 : (combo >= 5 ? 1 : 0));
            comboLabel(combo);
          }, crit ? 130 : 95);
          if(killed) setTimeout(epicDeath, 280);
        } else if(ctx.hero != null && heroNow != null && heroNow < ctx.hero){
          bossAttack();
          comboPulse(0, false);   // 答错连击清零 → 复位药丸
        }
      }
    });

    wrapFn('triggerBossRage', { after: function(){ try { screenFlash('rgba(239,68,68,.85)'); bossRoar(); rageVignetteOn(); } catch(e){} } });
    wrapFn('enterNewPhase', { after: function(){ try { screenFlash('rgba(251,191,36,.5)'); } catch(e){} } });
    wrapFn('bossVictory', { after: function(){ rageVignetteOff(); } });
    wrapFn('bossDefeat', { after: function(){ rageVignetteOff(); } });
    wrapFn('stopBoss', { after: function(){ rageVignetteOff(); } });

    console.log('%c[HansenBossAnim v4]%c 究极打击感动画已就绪', 'color:#f87171;font-weight:bold', 'color:#94a3b8');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
