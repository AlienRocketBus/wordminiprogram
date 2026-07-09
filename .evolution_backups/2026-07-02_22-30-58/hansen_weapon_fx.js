// hansen_weapon_fx.js — 七武器差异化攻击特效(Hansen v611 重做)
// ============================================================================
// v611(Hansen 要求): 每把武器独立打法, 不再共用一个光球. 攻击从勇者血条左侧武器框射向 boss.
//   弓箭=能量箭矢 / 手枪=单发枪击+弹孔 / 机枪=连发扫射 / 狙击=精准光束爆头(十字准星) /
//   加特林=密集弹幕+弹孔 / 加农炮=炮弹+大爆炸 / 光子炮=粗激光束+能量散射爆发.
// 防晕铁律: 全程 translate/scale/opacity 为主; 方向元素(箭/子弹/光束/炮弹)用【静态】rotate 朝向 boss
//   (固定角度·不做旋转动画·与命中刀斩同理·不眩晕), 飞行靠 translate. 绝不给 boss 立绘加亮度/旋转/色相滤镜(BUG#52).
//   无闪屏·无震屏·无旋转动画. (本文件不在 check24 rotate 扫描范围内, 静态朝向合规)
// 接入不变: island 答对段调 window.HansenWeaponFx(weaponLvl, bossEl, dmg, isCrit).
// ============================================================================
(function(){
  if(window.__hansenWeaponFxLoaded) return; window.__hansenWeaponFxLoaded = true;
  var WCOLOR = ['#2ec4b6','#f0b429','#38bdf8','#ef4444','#f59e0b','#fb7c3c','#a855f7']; // 弓/手枪/机枪/狙击/加特林/加农炮/光子炮

  function layer(){
    var l=document.getElementById('hsnWfxLayer');
    if(!l){ l=document.createElement('div'); l.id='hsnWfxLayer'; l.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99990;overflow:hidden'; document.body.appendChild(l); }
    return l;
  }
  function rm(el,t){ setTimeout(function(){ try{el.remove();}catch(e){} }, t); }
  function node(html,x,y){
    var d=document.createElement('div'); d.innerHTML=html;
    d.style.cssText='position:absolute;left:0;top:0;will-change:transform,opacity';
    d.style.transform='translate('+x+'px,'+y+'px)';
    layer().appendChild(d); return d;
  }
  function hyp(a,b){ return Math.sqrt(a*a+b*b); }

  // ── 共用爆发组件 ──
  function coreFlash(x,y,color,size){
    var f=node('<div style="width:'+size+'px;height:'+size+'px;background:radial-gradient(circle,#fff 0%,#fff 16%,'+color+' 44%,'+color+'00 72%);border-radius:50%;margin:'+(-size/2)+'px 0 0 '+(-size/2)+'px"></div>', x,y);
    f.firstChild.animate([{transform:'scale(.25)',opacity:0},{transform:'scale(.8)',opacity:1,offset:.25},{transform:'scale(1.25)',opacity:0}], {duration:340,easing:'ease-out'});
    rm(f,360);
  }
  function ring(x,y,color,size,delay,thick){
    var r=node('<div style="width:'+size+'px;height:'+size+'px;border:'+(thick||3)+'px solid '+color+';border-radius:50%;margin:'+(-size/2)+'px 0 0 '+(-size/2)+'px;box-shadow:0 0 12px '+color+',inset 0 0 8px '+color+'"></div>', x,y);
    r.firstChild.animate([{transform:'scale(.2)',opacity:.95},{transform:'scale(1.3)',opacity:0}], {duration:460,delay:delay||0,easing:'ease-out',fill:'backwards'});
    rm(r,(delay||0)+480);
  }
  function shards(x,y,color,n,dist,sz){
    for(var i=0;i<n;i++){
      var a=Math.PI*2*i/n + Math.random()*0.3;
      var d=dist*(0.7+Math.random()*0.5);
      var s=sz*(0.7+Math.random()*0.6);
      var p=node('<div style="width:'+s+'px;height:'+s+'px;background:'+color+';border-radius:50%;margin:'+(-s/2)+'px 0 0 '+(-s/2)+'px;box-shadow:0 0 '+s+'px '+color+'"></div>', x,y);
      p.firstChild.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+(Math.cos(a)*d)+'px,'+(Math.sin(a)*d)+'px) scale(.3)',opacity:0}], {duration:420+Math.random()*160,easing:'cubic-bezier(.15,.7,.3,1)'});
      rm(p,620);
    }
  }
  function fireball(x,y,color){
    var f=node('<div style="width:88px;height:88px;background:radial-gradient(circle at 45% 40%,#fff,'+color+' 40%,#7f1d1d 82%,'+color+'00);border-radius:50%;margin:-44px 0 0 -44px"></div>', x,y);
    f.firstChild.animate([{transform:'scale(.3)',opacity:1},{transform:'scale(1.5)',opacity:0}], {duration:480,easing:'ease-out'});
    rm(f,500);
  }

  // ── 方向元素(静态 rotate 朝向 boss·飞行靠 translate·不做旋转动画) ──
  // 飞行物: 外层 translate 飞行(sx,sy→tx,ty), 内层静态 rotate(deg) 固定朝向
  function flyer(innerHtml,sx,sy,tx,ty,deg,dur,easing,onHit){
    var d=document.createElement('div');
    d.style.cssText='position:absolute;left:0;top:0;will-change:transform';
    var inner=document.createElement('div');
    inner.innerHTML=innerHtml;
    inner.style.cssText='transform:rotate('+deg+'deg);transform-origin:center';
    d.appendChild(inner);
    layer().appendChild(d);
    var a=d.animate([{transform:'translate('+sx+'px,'+sy+'px)'},{transform:'translate('+tx+'px,'+ty+'px)'}],{duration:dur,easing:easing||'linear'});
    var done=false; var fin=function(){ if(done)return; done=true; try{d.remove();}catch(e){} if(onHit)onHit(); };
    a.onfinish=fin; setTimeout(fin, dur+180);
    return d;
  }
  // 光束: 从(sx,sy)沿deg伸到boss·静态rotate·scaleX展开(不旋转)·到达即命中
  function beam(sx,sy,tx,ty,col,thick,dur,onHit){
    var dist=hyp(tx-sx,ty-sy);
    var deg=Math.atan2(ty-sy,tx-sx)*180/Math.PI;
    var d=document.createElement('div');
    d.style.cssText='position:absolute;left:0;top:0;transform:translate('+sx+'px,'+sy+'px) rotate('+deg+'deg);transform-origin:0 50%;will-change:transform,opacity';
    d.innerHTML='<div style="width:'+dist+'px;height:'+thick+'px;margin-top:'+(-thick/2)+'px;background:linear-gradient(90deg,'+col+'dd,#fff 50%,'+col+'dd);border-radius:'+thick+'px;box-shadow:0 0 '+(thick*2.2)+'px '+col+',0 0 '+thick+'px #fff"></div>';
    layer().appendChild(d);
    d.firstChild.animate([{transform:'scaleX(0)',opacity:0},{transform:'scaleX(1)',opacity:1,offset:.22},{transform:'scaleX(1)',opacity:1,offset:.66},{transform:'scaleX(1)',opacity:0}],{duration:dur,easing:'ease-out'});
    var hit=false; setTimeout(function(){ if(hit)return; hit=true; if(onHit)onHit(); }, Math.round(dur*0.32));
    rm(d,dur+60);
  }
  // 枪口锥形闪(朝向deg·静态)
  function muzzleCone(sx,sy,deg,col){
    var d=document.createElement('div');
    d.style.cssText='position:absolute;left:0;top:0;transform:translate('+sx+'px,'+sy+'px) rotate('+deg+'deg);transform-origin:0 50%;will-change:transform,opacity';
    d.innerHTML='<div style="width:28px;height:15px;margin:-7.5px 0 0 4px;background:radial-gradient(ellipse at 0% 50%,#fff,'+col+'cc 40%,'+col+'00 75%);border-radius:50%"></div>';
    layer().appendChild(d);
    d.firstChild.animate([{transform:'scaleX(.5)',opacity:.95},{transform:'scaleX(1.25)',opacity:0}],{duration:150,easing:'ease-out'});
    rm(d,165);
  }
  // 弹孔(暗坑+亮边·短暂留)
  function bulletHole(x,y,col){
    var d=node('<div style="width:13px;height:13px;margin:-6.5px 0 0 -6.5px;border-radius:50%;background:radial-gradient(circle,#0a0a0acc 28%,'+col+'88 58%,transparent);box-shadow:0 0 7px '+col+'"></div>',x,y);
    d.firstChild.animate([{transform:'scale(.4)',opacity:1},{transform:'scale(1.1)',opacity:.9,offset:.3},{transform:'scale(1)',opacity:0}],{duration:540,easing:'ease-out'});
    rm(d,560);
  }
  // 爆头十字准星(正交·无旋转)
  function crosshair(x,y,col){
    var d=node('<div style="position:relative;width:56px;height:56px;margin:-28px 0 0 -28px">'
      +'<div style="position:absolute;left:50%;top:0;width:2px;height:56px;margin-left:-1px;background:'+col+';box-shadow:0 0 6px '+col+'"></div>'
      +'<div style="position:absolute;top:50%;left:0;height:2px;width:56px;margin-top:-1px;background:'+col+';box-shadow:0 0 6px '+col+'"></div>'
      +'<div style="position:absolute;left:50%;top:50%;width:32px;height:32px;margin:-16px 0 0 -16px;border:2px solid '+col+';border-radius:50%"></div>'
      +'</div>',x,y);
    d.firstChild.animate([{transform:'scale(1.5)',opacity:0},{transform:'scale(1)',opacity:1,offset:.3},{transform:'scale(.9)',opacity:0}],{duration:440,easing:'ease-out'});
    rm(d,460);
  }
  // 炮弹拖尾(沿路径留烟)
  function cannonTrail(sx,sy,bx,by,col,dur){
    for(var i=1;i<=6;i++){ (function(k){ setTimeout(function(){
      var t=k/6; var px=sx+(bx-sx)*t, py=sy+(by-sy)*t;
      var s=node('<div style="width:15px;height:15px;margin:-7.5px 0 0 -7.5px;border-radius:50%;background:radial-gradient(circle,'+col+'aa,'+col+'00)"></div>',px,py);
      s.firstChild.animate([{transform:'scale(1)',opacity:.6},{transform:'scale(.4)',opacity:0}],{duration:300,easing:'ease-out'});
      rm(s,320);
    }, Math.round(dur*(k/6)*0.7)); })(i); }
  }
  // 散射光线(激光命中·中心向外·各自静态rotate·scaleX展开)
  function rays(x,y,col){
    for(var i=0;i<8;i++){
      var deg=360*i/8;
      var d=document.createElement('div');
      d.style.cssText='position:absolute;left:0;top:0;transform:translate('+x+'px,'+y+'px) rotate('+deg+'deg);transform-origin:0 50%;will-change:transform,opacity';
      d.innerHTML='<div style="width:42px;height:3px;margin-top:-1.5px;background:linear-gradient(90deg,'+col+',transparent);border-radius:2px;box-shadow:0 0 6px '+col+'"></div>';
      layer().appendChild(d);
      d.firstChild.animate([{transform:'scaleX(.2)',opacity:.9},{transform:'scaleX(1.3)',opacity:0}],{duration:400,easing:'ease-out'});
      rm(d,420);
    }
  }
  // 武器框开火(后坐scale+武器色光晕·style区分·不晃不转)
  function muzzle(wb,col,style){
    if(!wb)return;
    try{
      var sc = style==='recoil'?1.18 : style==='big'?1.16 : style==='charge'?1.2 : 1.13;
      var dur = style==='charge'?360:280;
      wb.animate([{transform:'scale(1)'},{transform:'scale('+sc+')',offset:.32},{transform:'scale(1)'}],{duration:dur,easing:'ease-out'});
      var wr=wb.getBoundingClientRect();
      var fx=wr.left+wr.width*0.5, fy=wr.top+wr.height*0.5;
      var sz = style==='charge'?46 : style==='big'?42 : style==='recoil'?44 : 32;
      var f=node('<div style="width:'+sz+'px;height:'+sz+'px;background:radial-gradient(circle,#fff,'+col+'aa 45%,'+col+'00);border-radius:50%;margin:'+(-sz/2)+'px 0 0 '+(-sz/2)+'px"></div>',fx,fy);
      f.firstChild.animate([{transform:'scale(.4)',opacity:.95},{transform:'scale(1.4)',opacity:0}],{duration:Math.round(dur*0.85),easing:'ease-out'});
      rm(f,dur);
    }catch(e){}
  }

  // 伤害数字(共用·只弹一次·上飘淡出·fill锁住消失态不闪回)
  function popDamage(x,y,dmg,isCrit,col){
    var sz=isCrit?46:34;
    var color=isCrit?'#fde047':'#ffffff';
    var stroke=isCrit?'#b45309':col;
    var txt=(isCrit?'\u26a1 ':'')+'-'+dmg;
    var d=node('<div style="font-size:'+sz+'px;font-weight:900;color:'+color+';line-height:1;white-space:nowrap;text-align:center;width:160px;margin-left:-80px;text-shadow:0 0 9px '+stroke+',0 0 3px '+stroke+',-1px -1px 0 '+stroke+',1px 1px 0 '+stroke+',0 3px 6px rgba(0,0,0,.75)">'+txt+'</div>', x,y);
    d.firstChild.animate([
      {transform:'translateY(6px) scale(.6)',opacity:0,offset:0},
      {transform:'translateY(-2px) scale('+(isCrit?1.25:1.12)+')',opacity:1,offset:.22},
      {transform:'translateY(-26px) scale(1)',opacity:1,offset:.72},
      {transform:'translateY(-44px) scale(1)',opacity:0,offset:1}
    ], {duration:820,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
    rm(d,850);
  }

  // ══ 七武器专属特效 ══
  // 0 弓箭: 能量箭矢(箭杆+箭头+尾羽·静态朝向飞向boss)
  function fxBow(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    muzzle(wb,col,'soft');
    var dur=Math.max(190,Math.min(310,hyp(bx-sx,by-sy)*0.62));
    var arrow='<div style="position:relative;width:42px;height:9px;margin:-4.5px 0 0 -21px">'
      +'<div style="position:absolute;left:3px;top:3px;width:28px;height:3px;background:linear-gradient(90deg,'+col+'44,'+col+');border-radius:2px;box-shadow:0 0 7px '+col+'"></div>'
      +'<div style="position:absolute;right:0;top:0.5px;width:0;height:0;border-left:13px solid #fff;border-top:4px solid transparent;border-bottom:4px solid transparent;filter:drop-shadow(0 0 5px '+col+')"></div>'
      +'<div style="position:absolute;left:0;top:0.5px;width:8px;height:8px;background:'+col+';clip-path:polygon(0 0,100% 50%,0 100%);opacity:.85"></div>'
      +'</div>';
    flyer(arrow,sx,sy,bx,by,deg,dur,'cubic-bezier(.2,.5,.5,1)',function(){
      coreFlash(bx,by,col,44); ring(bx,by,col,54,0,3); if(isCrit)ring(bx,by,'#fff',72,80,2);
      shards(bx,by,col,isCrit?14:10,46,6); popAt();
    });
  }
  // 1 手枪: 单发枪击+弹孔
  function fxPistol(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    muzzle(wb,col,'flash'); muzzleCone(sx,sy,deg,col);
    var dur=Math.max(120,Math.min(210,hyp(bx-sx,by-sy)*0.42));
    var bullet='<div style="width:17px;height:6px;margin:-3px 0 0 -8.5px;background:linear-gradient(90deg,#fff,'+col+');border-radius:3px;box-shadow:0 0 10px '+col+',0 0 4px #fff"></div>';
    flyer(bullet,sx,sy,bx,by,deg,dur,'cubic-bezier(.4,0,.7,1)',function(){
      coreFlash(bx,by,col,40); ring(bx,by,col,48,0,3); bulletHole(bx,by,col);
      shards(bx,by,col,isCrit?13:9,36,5); popAt();
    });
  }
  // 2 机枪: 连发扫射(4-5发·略散布)
  function fxMachineGun(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    var n=isCrit?5:4;
    for(var i=0;i<n;i++){ (function(idx){ setTimeout(function(){
      if(idx===0||idx===n-1) muzzle(wb,col,'flash');
      muzzleCone(sx,sy,deg,col);
      var jx=bx+(Math.random()-0.5)*28, jy=by+(Math.random()-0.5)*28;
      var d2=Math.atan2(jy-sy,jx-sx)*180/Math.PI;
      var dur=Math.max(100,Math.min(175,hyp(jx-sx,jy-sy)*0.4));
      var bullet='<div style="width:15px;height:5px;margin:-2.5px 0 0 -7.5px;background:linear-gradient(90deg,#fff,'+col+');border-radius:3px;box-shadow:0 0 8px '+col+'"></div>';
      flyer(bullet,sx,sy,jx,jy,d2,dur,'cubic-bezier(.4,0,.7,1)',function(){
        coreFlash(jx,jy,col,28); bulletHole(jx,jy,col); shards(jx,jy,col,5,24,4);
        if(idx===n-1){ ring(bx,by,col,54,0,3); popAt(); }
      });
    }, idx*72); })(i); }
  }
  // 3 狙击: 精准光束爆头+十字准星
  function fxSniper(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    muzzle(wb,col,'big');
    beam(sx,sy,bx,by,col,4,260,function(){
      coreFlash(bx,by,'#fff',58); coreFlash(bx,by,col,72);
      ring(bx,by,'#fff',60,0,4); ring(bx,by,col,88,80,3);
      crosshair(bx,by,col); shards(bx,by,col,isCrit?18:14,58,8); popAt();
    });
  }
  // 4 加特林: 密集弹幕+弹孔(7-9发)
  function fxGatling(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    var n=isCrit?9:7;
    for(var i=0;i<n;i++){ (function(idx){ setTimeout(function(){
      muzzleCone(sx,sy,deg,col);
      var jx=bx+(Math.random()-0.5)*42, jy=by+(Math.random()-0.5)*42;
      var d2=Math.atan2(jy-sy,jx-sx)*180/Math.PI;
      var dur=Math.max(90,Math.min(160,hyp(jx-sx,jy-sy)*0.38));
      var bullet='<div style="width:13px;height:5px;margin:-2.5px 0 0 -6.5px;background:linear-gradient(90deg,#fff,'+col+');border-radius:3px;box-shadow:0 0 7px '+col+'"></div>';
      flyer(bullet,sx,sy,jx,jy,d2,dur,'cubic-bezier(.4,0,.7,1)',function(){
        coreFlash(jx,jy,col,24); bulletHole(jx,jy,col); shards(jx,jy,col,4,20,3);
        if(idx===n-1){ ring(bx,by,col,62,0,3); popAt(); }
      });
    }, idx*44); })(i); }
  }
  // 5 加农炮: 炮弹+大爆炸
  function fxCannon(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    muzzle(wb,col,'recoil');
    var dur=Math.max(240,Math.min(360,hyp(bx-sx,by-sy)*0.7));
    cannonTrail(sx,sy,bx,by,col,dur);
    var shell='<div style="width:25px;height:19px;margin:-9.5px 0 0 -12.5px;background:radial-gradient(circle at 40% 38%,#fff,'+col+' 48%,#7f1d1d 85%);border-radius:50%;box-shadow:0 0 16px '+col+',0 0 6px #fff"></div>';
    flyer(shell,sx,sy,bx,by,deg,dur,'cubic-bezier(.3,.1,.6,1)',function(){
      fireball(bx,by,col); coreFlash(bx,by,'#fff',62);
      ring(bx,by,col,74,0,4); ring(bx,by,col,102,90,3); ring(bx,by,'#fff',132,180,2);
      shards(bx,by,col,isCrit?22:18,72,9); popAt();
    });
  }
  // 6 光子炮: 粗激光束+能量散射爆发
  function fxPhoton(sx,sy,bx,by,deg,col,isCrit,wb,popAt){
    muzzle(wb,col,'charge');
    beam(sx,sy,bx,by,col,11,340,function(){
      coreFlash(bx,by,'#fff',68); coreFlash(bx,by,col,92);
      ring(bx,by,col,82,0,4); ring(bx,by,'#fff',112,90,3); ring(bx,by,col,142,180,2);
      rays(bx,by,col); shards(bx,by,col,isCrit?22:18,74,9); fireball(bx,by,col); popAt();
    });
  }

  var FX=[fxBow,fxPistol,fxMachineGun,fxSniper,fxGatling,fxCannon,fxPhoton];

  window.HansenWeaponFx = function(weaponLvl, bossEl, dmg, isCrit){
    try{
      if(!bossEl) return;
      try{bossEl=(bossEl.querySelector&&bossEl.querySelector('svg,img'))||bossEl;}catch(e){} /* 🔴v859 量视觉盒: 外层div是230布局盒·svg才是真可见体(v857恒定盒) */
      var lvl=Math.max(0,Math.min(6,weaponLvl|0));
      var col=WCOLOR[lvl];
      var br=bossEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.42;
      var wb=document.getElementById('heroWeaponBox');
      var sx,sy;
      if(wb && wb.getBoundingClientRect().width>0){
        var wr=wb.getBoundingClientRect();
        sx=wr.left+wr.width*0.5; sy=wr.top+wr.height*0.5;
      } else { sx=bx; sy=by+220; wb=null; }
      var deg=Math.atan2(by-sy,bx-sx)*180/Math.PI;
      var popAt=function(){ popDamage(bx, by-br.height*0.30, dmg, isCrit, col); };
      (FX[lvl]||fxBow)(sx,sy,bx,by,deg,col,isCrit,wb,popAt);
    }catch(e){}
  };
})();
