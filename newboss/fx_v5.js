/* ═══ v5: 铸星者系列 · 第一星域五守卫 ═══ */

/* ㉚暗影先锋·破阵者 —— 目镜锁定→卡宾枪点射→动力肩撞→双等离子匕首收割 */
function fxPozhen(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,70,50', C_G2='255,200,90', C_B='150,220,255', C_T='255,220,150';
  var scanT=-1, shots=[], dashT=-1, kniT=-1, shells=[];
  function drawCarbine(ctx,x,y,s,rot,a,rec){ /* 爆能卡宾枪(短枪身+制退器+刻痕) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.translate(-rec*7,0); ctx.scale(s,s);
    ctx.fillStyle='#20262e'; ctx.fillRect(-24,-4,20,8);
    ctx.fillStyle='#2c3440'; ctx.beginPath(); ctx.moveTo(-24,4); ctx.lineTo(-18,4); ctx.lineTo(-21,15); ctx.lineTo(-27,13); ctx.closePath(); ctx.fill();
    var bg=ctx.createLinearGradient(0,-3,0,3); bg.addColorStop(0,'#3c4654'); bg.addColorStop(1,'#1c222c');
    ctx.fillStyle=bg; ctx.fillRect(-6,-3.4,36,6.8);
    ctx.fillStyle='#141a22'; ctx.fillRect(30,-2.6,8,5.2);
    for(var v=0;v<3;v++){ ctx.fillRect(38,-2+v*1.7,3,0.8); }
    ctx.fillStyle='#181e26'; ctx.fillRect(0,-8,12,4.5);
    ctx.strokeStyle='#e8b06a'; ctx.lineWidth=0.7;
    for(var k=0;k<5;k++){ ctx.beginPath(); ctx.moveTo(4+k*3.4,4.4); ctx.lineTo(4+k*3.4,7); ctx.stroke(); }
    ctx.fillStyle='#2c3440'; ctx.fillRect(-8,2,5,7);
    ctx.restore();
  }
  function drawPKnife(ctx,x,y,s,rot,a){ /* 等离子匕首(蓝白刃) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#1c222c'; ctx.fillRect(-2.2,8,4.4,11);
    ctx.fillStyle='#3c4654'; ctx.fillRect(-5,6,10,2.4);
    ctx.save(); ctx.shadowBlur=12; ctx.shadowColor='#9adcff';
    var kg=ctx.createLinearGradient(-2,0,2,0); kg.addColorStop(0,'rgba(140,210,255,0.5)'); kg.addColorStop(.5,'#eafaff'); kg.addColorStop(1,'rgba(140,210,255,0.5)');
    ctx.fillStyle=kg; ctx.beginPath(); ctx.moveTo(-2.4,6); ctx.lineTo(-1.4,-20); ctx.lineTo(0.6,-25); ctx.lineTo(2.4,6); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6200,endMs:4300,
  busy:function(st){ return kniT>0&&st.t-kniT<900; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-950 目镜扫描锁定(暗红扫描波+锁定框+金色闭环) */
    if(!st.fired.scan&&t>=100){ st.fired.scan=1; scanT=t; }
    /* ②1050 卡宾枪战术点射三连 */
    if(!st.fired.tri&&t>=1050){ st.fired.tri=1;
      for(var i=0;i<3;i++)shots.push({ts:1050+i*210,done:false});
      st.fire();
    }
    for(var si=0;si<shots.length;si++){ var s2=shots[si];
      if(!s2.done&&t>=s2.ts){ s2.done=true;
        var x0=st.bx+58*sz, y0=st.by-4*sz;
        F.flash(st.P,x0,y0,C_T,15*sz,110);
        F.trail(st.P,x0,y0,st.hx+rnd(-16,16)*sz,st.hy+rnd(-12,12)*sz,C_T,3.4*sz,160);
        F.burst(st.P,st.hx,st.hy,C_G2,8,6,sz); F.ring(st.P,st.hx,st.hy,C_R,0.7,2.3*sz);
        shells.push({x:st.bx+30*sz,y:st.by-10*sz,vx:rnd(1.2,1.9),vy:rnd(-2.8,-2.1),rot:0,life:0});
      } }
    for(var hi=shells.length-1;hi>=0;hi--){ var sh=shells[hi];
      sh.life+=st.dt; sh.vy+=0.011*st.dt; sh.x+=sh.vx*st.dt*0.06; sh.y+=sh.vy*st.dt*0.06; sh.rot+=0.022*st.dt;
      if(sh.life>850)shells.splice(hi,1); }
    /* ③2050 动力肩撞冲刺 */
    if(!st.fired.dash&&t>=2050){ st.fired.dash=1; dashT=t; }
    if(!st.fired.dashhit&&dashT>0&&t-dashT>=280){ st.fired.dashhit=1;
      F.flash(st.P,st.hx,st.hy,C_R,42*sz,220);
      F.burst(st.P,st.hx,st.hy,C_G2,14,7.5,sz); F.ring(st.P,st.hx,st.hy,C_R,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_T,0.8,2.6*sz);
    }
    /* ④2900 双等离子匕首交叉收割 */
    if(!st.fired.kn&&t>=2900){ st.fired.kn=1; kniT=t; }
    if(!st.fired.kx1&&kniT>0&&t-kniT>=180){ st.fired.kx1=1;
      F.beam(st.P,st.hx,st.hy,-0.72,C_B,1.15,false); F.burst(st.P,st.hx,st.hy,C_B,8,5.5,sz); }
    if(!st.fired.kx2&&kniT>0&&t-kniT>=380){ st.fired.kx2=1;
      F.beam(st.P,st.hx,st.hy,0.72,C_B,1.15,false); F.burst(st.P,st.hx,st.hy,C_B,8,5.5,sz); }
    if(!st.fired.kfin&&kniT>0&&t-kniT>=620){ st.fired.kfin=1;
      F.flash(st.P,st.hx,st.hy,C_B,48*sz,260);
      F.ring(st.P,st.hx,st.hy,C_B,1.5,4.6*sz); F.burst(st.P,st.hx,st.hy,C_B,18,7.5,sz);
      F.shards(st.P,st.hx,st.hy,'190,235,255',10,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 卡宾枪(常驻·点射带后坐) */
    if(t>500&&t<2500){ var rec=0;
      for(var si=0;si<shots.length;si++){ var s2=shots[si]; if(s2.done&&t-s2.ts<110)rec=Math.max(rec,1-(t-s2.ts)/110); }
      var ang=Math.atan2(st.hy-(st.by-4*sz),st.hx-(st.bx+20*sz));
      drawCarbine(ctx,st.bx+26*sz,st.by-4*sz,1.15*sz,ang,Math.min(1,(t-500)/220)*(t>2250?Math.max(0,(2500-t)/250):1),rec);
    }
    /* 弹壳 */
    for(var hi=0;hi<shells.length;hi++){ var sh=shells[hi];
      ctx.save(); ctx.translate(sh.x,sh.y); ctx.rotate(sh.rot);
      ctx.fillStyle='#d8b060'; ctx.fillRect(-2.6*sz,-1*sz,5.2*sz,2*sz); ctx.restore(); }
    /* 肩撞冲刺(装甲肩块+冲刺锥) */
    if(dashT>0&&t-dashT<360){ var pr=(t-dashT)/360;
      var p=Math.min(1,pr/0.72);
      var x=st.bx+(st.hx-st.bx)*p, y=st.by+(st.hy-st.by)*p;
      var a2=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.save(); ctx.translate(x,y); ctx.rotate(a2);
      ctx.globalAlpha=pr>0.8?(1-pr)/0.2:1;
      var sg=ctx.createLinearGradient(-16*sz,0,10*sz,0); sg.addColorStop(0,'#2c3440'); sg.addColorStop(1,'#5a6a80');
      ctx.fillStyle=sg; ctx.strokeStyle='#8a1420'; ctx.lineWidth=1.6*sz;
      ctx.beginPath(); ctx.moveTo(10*sz,0); ctx.lineTo(-4*sz,-13*sz); ctx.lineTo(-16*sz,-9*sz); ctx.lineTo(-16*sz,9*sz); ctx.lineTo(-4*sz,13*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 冲刺尾锥 */
      var cg=ctx.createLinearGradient(-60*sz,0,-14*sz,0); cg.addColorStop(0,'rgba(255,200,90,0)'); cg.addColorStop(1,'rgba(255,200,90,0.6)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(-14*sz,-9*sz); ctx.lineTo(-58*sz,0); ctx.lineTo(-14*sz,9*sz); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    /* 双匕首交叉(④幕实体) */
    if(kniT>0&&t-kniT<560){ var pr2=(t-kniT)/560;
      var a3=pr2>0.85?(1-pr2)/0.15:1;
      var sw=Math.min(1,pr2*2.4);
      drawPKnife(ctx,st.hx-24*sz+sw*22*sz,st.hy-16*sz+sw*14*sz,1.15*sz,-0.72+sw*0.5,a3);
      drawPKnife(ctx,st.hx+24*sz-sw*22*sz,st.hy-16*sz+sw*14*sz,1.15*sz,0.72-sw*0.5,a3);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 目镜扫描: 暗红横带下扫+四目标标记+金色闭环 */
    if(scanT>0&&t-scanT<1000){ var pr=(t-scanT)/1000;
      if(pr<0.55){ var sp2=pr/0.55; var y=st.hy-64*sz+sp2*128*sz;
        var sg=ctx.createLinearGradient(0,y-10*sz,0,y+10*sz);
        sg.addColorStop(0,g(C_R+',0')); sg.addColorStop(.5,g(C_R+',0.5')); sg.addColorStop(1,g(C_R+',0'));
        ctx.fillStyle=sg; ctx.fillRect(st.hx-84*sz,y-10*sz,168*sz,20*sz);
      }
      if(pr>0.4){ var la=Math.min(1,(pr-0.4)/0.3);
        ctx.strokeStyle=g(C_R+','+(0.85*la)); ctx.lineWidth=1.4*sz;
        var R=32*sz;
        for(var c2=0;c2<4;c2++){ var ca=c2*1.5708+0.785;
          var cx=st.hx+Math.cos(ca)*R, cy=st.hy+Math.sin(ca)*R*0.8;
          ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-Math.cos(ca)*9*sz,cy); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-Math.sin(ca)*9*sz); ctx.stroke(); }
      }
      if(pr>0.78){ var ga=Math.sin((pr-0.78)/0.22*3.14);
        ctx.strokeStyle=g(C_G2+','+ga); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G2+',1');
        ctx.beginPath(); ctx.arc(st.hx,st.hy,26*sz,-0.5,4.2); ctx.stroke(); ctx.shadowBlur=0;
      }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉛武器大师·战争铁砧 —— 架盾机枪压制→六联导弹→等离子军刀→全武库过载殉爆 */
function fxTiezhan(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_O='255,160,60', C_R='255,70,50', C_B='140,215,255', C_T='255,220,150';
  var mgT=-1, missiles=[], sabT=-1, overT=-1, plates=[], blinkT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6600,endMs:4700,
  busy:function(st){ return missiles.length>0||plates.length>0||(overT>0&&st.t-overT<1100); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①150-1150 架盾机枪持续压制(密集曳光) */
    if(!st.fired.mg&&t>=150){ st.fired.mg=1; mgT=t; }
    if(mgT>0&&t-mgT<1000){
      if(Math.random()<0.42){ var x0=st.bx+64*sz, y0=st.by+2*sz;
        F.trail(st.P,x0,y0,st.hx+rnd(-34,34)*sz,st.hy+rnd(-20,20)*sz,C_T,2.6*sz,130);
        F.burst(st.P,st.hx+rnd(-26,26)*sz,st.hy+rnd(-14,14)*sz,C_O,2,4,sz);
        if(Math.random()<0.5)F.flash(st.P,x0,y0,C_T,10*sz,80);
      }
      if(!st.fired.dealt&&t-mgT>420){ st.fired.dealt=1; st.fire(); }
    }
    /* ②1350 六联微型导弹蜂巢齐射(弧线+近炸破片) */
    if(!st.fired.msl&&t>=1350){ st.fired.msl=1;
      for(var i=0;i<6;i++)missiles.push({p:0,spd:rnd(0.0016,0.0021),arc:36+i*13,off:(i-2.5)*15,delay:i*95,trail:[]});
    }
    for(var mi=missiles.length-1;mi>=0;mi--){ var M=missiles[mi];
      if(M.delay>0){M.delay-=st.dt;continue;}
      M.p+=M.spd*st.dt;
      var x=st.bx+ (st.hx+M.off*sz-st.bx)*M.p, y=st.by-20*sz+(st.hy-(st.by-20*sz))*M.p-Math.sin(M.p*3.14)*M.arc*sz;
      M.x=x; M.y=y; M.trail.push({x:x,y:y}); if(M.trail.length>7)M.trail.shift();
      if(M.p>=0.93){ /* 近炸 */
        F.flash(st.P,x,y,C_O,26*sz,180);
        F.burst(st.P,x,y,C_O,10,6.5,sz); F.ring(st.P,x,y,C_R,0.85,2.8*sz);
        F.shards(st.P,x,y,'150,140,120',6,sz);
        missiles.splice(mi,1); }
    }
    /* ③2450 等离子军刀突进撩斩 */
    if(!st.fired.sab&&t>=2450){ st.fired.sab=1; sabT=t; }
    if(!st.fired.sabhit&&sabT>0&&t-sabT>=240){ st.fired.sabhit=1;
      F.beam(st.P,st.hx,st.hy,-0.9,C_B,1.3,true);
      F.burst(st.P,st.hx,st.hy,C_B,12,7,sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3.2*sz);
    }
    /* ④3100 全武库过载: 胸甲弹落→红光预爆闪烁→3750 全弹药殉爆 */
    if(!st.fired.over&&t>=3100){ st.fired.over=1; blinkT=t;
      for(var p2=0;p2<2;p2++)plates.push({x:st.bx+(p2?26:-22)*sz,y:st.by+6*sz,vx:p2?2.2:-2.4,vy:-2.6,rot:0,vrot:p2?0.09:-0.11,life:0});
      F.burst(st.P,st.bx,st.by,C_T,10,5,sz);
    }
    for(var pi=plates.length-1;pi>=0;pi--){ var P2=plates[pi];
      P2.life+=st.dt; P2.vy+=0.012*st.dt; P2.x+=P2.vx*st.dt*0.06; P2.y+=P2.vy*st.dt*0.06; P2.rot+=P2.vrot*st.dt*0.06;
      if(P2.life>1100)plates.splice(pi,1); }
    if(!st.fired.boom&&t>=3750){ st.fired.boom=1; overT=t;
      for(var q=0;q<5;q++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        var bx2=st.hx+rnd(-42,42)*st.sz, by2=st.hy+rnd(-26,26)*st.sz;
        F.flash(st.P,bx2,by2,C_O,34*st.sz,200);
        F.burst(st.P,bx2,by2,qq%2?C_O:C_R,12,7.5,st.sz); F.ring(st.P,bx2,by2,C_R,1.0,3.2*st.sz);
        F.shards(st.P,bx2,by2,'140,130,110',7,st.sz);
      },qq*120/st.sp); })(q); }
      setTimeout(function(){ if(st.dead)return;
        F.flash(st.P,st.hx,st.hy,'255,240,210',72*st.sz,340);
        F.ring(st.P,st.hx,st.hy,C_O,2.0,6.5*st.sz); F.ring(st.P,st.hx,st.hy,C_R,1.3,4.4*st.sz); F.ring(st.P,st.hx,st.hy,C_T,0.9,3*st.sz);
        F.burst(st.P,st.hx,st.hy,C_O,30,9.5,st.sz);
      },620/st.sp);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 架盾+机枪(①幕实体: 左盾+粗枪管) */
    if(mgT>0&&t-mgT<1150){ var a=Math.min(1,(t-mgT)/200)*(t-mgT>950?Math.max(0,(1150-(t-mgT))/200):1);
      ctx.save(); ctx.globalAlpha=a;
      var ang=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.translate(st.bx+30*sz,st.by+2*sz); ctx.rotate(ang);
      /* 臂盾 */
      var shg=ctx.createLinearGradient(0,-22*sz,0,22*sz); shg.addColorStop(0,'#4a5464'); shg.addColorStop(1,'#242c38');
      ctx.fillStyle=shg; ctx.strokeStyle='#7a8698'; ctx.lineWidth=1.6*sz;
      ctx.beginPath(); ctx.moveTo(-4*sz,-22*sz); ctx.lineTo(6*sz,-18*sz); ctx.lineTo(6*sz,18*sz); ctx.lineTo(-4*sz,22*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 机枪身+散热片(烧红) */
      var mg2=ctx.createLinearGradient(0,-4*sz,0,4*sz); mg2.addColorStop(0,'#3c4654'); mg2.addColorStop(1,'#1c222c');
      ctx.fillStyle=mg2; ctx.fillRect(4*sz,-4.4*sz,32*sz,8.8*sz);
      var heat=Math.min(1,(t-mgT)/700);
      for(var v=0;v<4;v++){ ctx.fillStyle='rgba('+(90+heat*165)+','+(50+heat*40)+',40,1)';
        ctx.fillRect((10+v*6)*sz,-6*sz,3*sz,12*sz); }
      ctx.fillStyle='#141a22'; ctx.fillRect(36*sz,-3*sz,8*sz,6*sz);
      /* 弹链 */
      ctx.strokeStyle='#d8b060'; ctx.lineWidth=1.4*sz;
      ctx.beginPath(); ctx.moveTo(8*sz,5*sz); ctx.quadraticCurveTo(2*sz,14*sz,-6*sz,12*sz); ctx.stroke();
      ctx.restore();
    }
    /* 微型导弹(实体小弹体+白烟尾) */
    for(var mi=0;mi<missiles.length;mi++){ var M=missiles[mi]; if(M.delay>0||M.x===undefined)continue;
      for(var q=1;q<M.trail.length;q++){ ctx.strokeStyle='rgba(220,220,215,'+(q/M.trail.length*0.5)+')';
        ctx.lineWidth=(q/M.trail.length*4)*sz; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(M.trail[q-1].x,M.trail[q-1].y); ctx.lineTo(M.trail[q].x,M.trail[q].y); ctx.stroke(); }
      var na=Math.atan2((M.trail.length>1?M.y-M.trail[M.trail.length-2].y:1),(M.trail.length>1?M.x-M.trail[M.trail.length-2].x:1));
      ctx.save(); ctx.translate(M.x,M.y); ctx.rotate(na);
      ctx.fillStyle='#5a6474'; ctx.fillRect(-5*sz,-1.7*sz,9*sz,3.4*sz);
      ctx.fillStyle='#c8341e'; ctx.beginPath(); ctx.moveTo(4*sz,-1.7*sz); ctx.lineTo(7.5*sz,0); ctx.lineTo(4*sz,1.7*sz); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ffb060'; ctx.beginPath(); ctx.arc(-5.5*sz,0,1.6*sz,0,6.283); ctx.fill();
      ctx.restore(); }
    /* 等离子军刀(③幕撩斩) */
    if(sabT>0&&t-sabT<380){ var pr=(t-sabT)/380; var sw=-1.6+Math.min(1,pr/0.6)*2.5;
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(sw);
      ctx.globalAlpha=pr>0.82?(1-pr)/0.18:1;
      ctx.fillStyle='#242c38'; ctx.fillRect(-3*sz,12*sz,6*sz,16*sz);
      ctx.save(); ctx.shadowBlur=14; ctx.shadowColor='#9adcff';
      var kg=ctx.createLinearGradient(-2.6*sz,0,2.6*sz,0); kg.addColorStop(0,'rgba(140,215,255,0.5)'); kg.addColorStop(.5,'#eafaff'); kg.addColorStop(1,'rgba(140,215,255,0.5)');
      ctx.fillStyle=kg; ctx.beginPath(); ctx.moveTo(-3*sz,12*sz); ctx.lineTo(-2*sz,-34*sz); ctx.lineTo(1.4*sz,-40*sz); ctx.lineTo(3*sz,12*sz); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.restore();
    }
    /* 胸甲弹落板 */
    for(var pi=0;pi<plates.length;pi++){ var P2=plates[pi];
      var aa=P2.life>800?Math.max(0,(1100-P2.life)/300):1;
      ctx.save(); ctx.globalAlpha=aa; ctx.translate(P2.x,P2.y); ctx.rotate(P2.rot);
      var pg=ctx.createLinearGradient(-10*sz,0,10*sz,0); pg.addColorStop(0,'#3c4654'); pg.addColorStop(1,'#242c38');
      ctx.fillStyle=pg; ctx.strokeStyle='#6a7688'; ctx.lineWidth=1*sz;
      ctx.beginPath(); ctx.moveTo(-10*sz,-8*sz); ctx.lineTo(9*sz,-10*sz); ctx.lineTo(11*sz,7*sz); ctx.lineTo(-8*sz,9*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 全武库预爆红光闪烁(④幕: boss身上多点红灯快闪) */
    if(blinkT>0&&t<3750){ var on=Math.floor((t-blinkT)/110)%2===0;
      if(on){ for(var k=0;k<6;k++){ var kx=st.bx+Math.cos(k*1.15)*36*sz, ky=st.by+Math.sin(k*1.9)*44*sz;
        var rg=ctx.createRadialGradient(kx,ky,0,kx,ky,6*sz);
        rg.addColorStop(0,g(C_R+',0.95')); rg.addColorStop(1,g(C_R+',0'));
        ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(kx,ky,6*sz,0,6.283); ctx.fill(); } }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉜星陨武士·流亡之刃 —— 光刃激活→斗篷残影错位三闪→剑之对话→终结居合一闪 */
function fxLiuwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_S='170,215,255', C_W='235,248,255', C_P='190,140,255';
  var bladeA=0, cloaks=[], slashes=[], iaiT=-1, iaiCutT=-1;
  function drawLightBlade(ctx,x,y,s,rot,a,purple){ /* 银蓝光刃(锯齿波动) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#2a3242'; ctx.fillRect(-2,10,4,13);
    ctx.fillStyle='#4a5568'; ctx.beginPath(); ctx.arc(0,10,3,0,6.283); ctx.fill();
    var col=purple?'#c890ff':'#bfe0ff';
    ctx.save(); ctx.shadowBlur=14; ctx.shadowColor=col;
    var bg=ctx.createLinearGradient(-2.4,0,2.4,0);
    bg.addColorStop(0,'rgba(150,200,255,0.35)'); bg.addColorStop(.5,'#f0faff'); bg.addColorStop(1,'rgba(150,200,255,0.35)');
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(-2.4,9);
    for(var v=0;v<=8;v++){ var yy=9-v/8*46;
      ctx.lineTo(-2+Math.sin(v*2.4)*0.9,yy); }
    ctx.lineTo(0,-40);
    for(var v2=8;v2>=0;v2--){ var yy2=9-v2/8*46;
      ctx.lineTo(2-Math.sin(v2*2.4)*0.9,yy2); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle=col; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-38); ctx.stroke();
    ctx.restore(); ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6300,endMs:4400,
  busy:function(st){ return iaiCutT>0&&st.t-iaiCutT<900; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-750 光刃激活(嗡鸣波纹) */
    bladeA=Math.min(1,Math.max(0,(t-150)/420));
    if(t>250&&t<850&&Math.random()<0.3)F.ring(st.P,st.bx+34*sz,st.by+4*sz,C_S,0.4,1*sz);
    /* ②900起 残影错位三闪: 灰影滞留+本体瞬现斩 */
    if(!st.fired.c3&&t>=900){ st.fired.c3=1;
      var spots=[[-52,-14],[46,8],[-8,-30]];
      for(var i=0;i<3;i++){ cloaks.push({ts:900+i*380,gx:st.hx+spots[i][0]*0.6*sz,gy:st.hy+spots[i][1]*0.6*sz,sx:st.hx+spots[(i+1)%3][0]*sz,sy:st.hy+spots[(i+1)%3][1]*sz,done:false,purple:i===1}); }
      st.fire();
    }
    for(var ci=0;ci<cloaks.length;ci++){ var c=cloaks[ci];
      if(!c.done&&t>=c.ts+150){ c.done=true;
        F.beam(st.P,st.hx,st.hy,rnd(-1.1,1.1),c.purple?C_P:C_S,1.1,false);
        F.burst(st.P,st.hx,st.hy,c.purple?C_P:C_S,7,5.5,sz);
      } }
    /* ③2200 剑之对话: 三连精准斩(不同角度) */
    if(!st.fired.dia&&t>=2200){ st.fired.dia=1;
      for(var k=0;k<3;k++)slashes.push({ts:2200+k*230,ang:[-0.35,0.9,-1.25][k],done:false});
    }
    for(var si=0;si<slashes.length;si++){ var s2=slashes[si];
      if(!s2.done&&t>=s2.ts+110){ s2.done=true;
        F.beam(st.P,st.hx,st.hy,s2.ang,C_S,1.05,false);
        F.burst(st.P,st.hx,st.hy,C_W,6,5,sz);
      } }
    /* ④3150 终结居合: 收剑静止→3600一闪 */
    if(!st.fired.iai&&t>=3150){ st.fired.iai=1; iaiT=t; }
    if(!st.fired.cut&&t>=3620){ st.fired.cut=1; iaiCutT=t;
      F.flash(st.P,st.hx,st.hy,C_W,58*sz,300);
    }
    if(!st.fired.star&&iaiCutT>0&&t-iaiCutT>=240){ st.fired.star=1;
      F.ring(st.P,st.hx,st.hy,C_S,1.7,5.5*sz); F.ring(st.P,st.hx,st.hy,C_W,1.1,3.6*sz);
      F.burst(st.P,st.hx,st.hy,C_S,24,8.5,sz); F.shards(st.P,st.hx,st.hy,C_W,12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(bladeA>0&&t<3100)drawLightBlade(ctx,st.bx+34*sz,st.by+4*sz,1.2*sz,0.45,bladeA*(t>2900?Math.max(0,(3100-t)/200):1),false);
    /* 残影错位: 灰斗篷影(消散)+本体瞬斩光刃 */
    for(var ci=0;ci<cloaks.length;ci++){ var c=cloaks[ci];
      if(t>=c.ts&&t<c.ts+340){ var pr=(t-c.ts)/340;
        /* 灰影(留在原地渐散) */
        ctx.save(); ctx.globalAlpha=Math.max(0,0.55*(1-pr*1.4)); ctx.translate(c.gx,c.gy);
        ctx.fillStyle='#565c68';
        ctx.beginPath(); ctx.moveTo(0,-26*sz); ctx.quadraticCurveTo(14*sz,-8*sz,10*sz,22*sz);
        ctx.lineTo(-10*sz,22*sz); ctx.quadraticCurveTo(-14*sz,-8*sz,0,-26*sz); ctx.fill();
        ctx.restore();
        /* 本体瞬现处光刃斩 */
        if(pr>0.3&&pr<0.8){ var sa=(pr-0.3)/0.5;
          drawLightBlade(ctx,c.sx,c.sy,1.15*sz,-1.4+sa*2.6,Math.sin(sa*3.14),c.purple); }
      } }
    /* 居合: 收剑姿(剑柄在腰·刃隐)→一闪横线 */
    if(iaiT>0&&t-iaiT<470){ /* 收剑静止(剑柄微光) */
      var pa=Math.sin(Math.min(1,(t-iaiT)/470)*3.14)*0.8;
      ctx.save(); ctx.globalAlpha=pa;
      var gx2=st.bx+22*sz, gy2=st.by+18*sz;
      ctx.fillStyle='#2a3242'; ctx.save(); ctx.translate(gx2,gy2); ctx.rotate(1.1); ctx.fillRect(-2*sz,0,4*sz,13*sz); ctx.restore();
      var glg=ctx.createRadialGradient(gx2,gy2,0,gx2,gy2,9*sz);
      glg.addColorStop(0,'rgba(190,225,255,'+(0.7*pa)+')'); glg.addColorStop(1,'rgba(170,215,255,0)');
      ctx.fillStyle=glg; ctx.beginPath(); ctx.arc(gx2,gy2,9*sz,0,6.283); ctx.fill();
      ctx.restore();
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 居合一闪: 全屏横贯银蓝极线→延迟星形裂纹 */
    if(iaiCutT>0&&t-iaiCutT<620){ var pr=(t-iaiCutT)/620;
      if(pr<0.4){ var la=Math.sin(pr/0.4*3.14);
        ctx.strokeStyle=g(C_W+','+la); ctx.lineWidth=(3.4-pr*4)*sz; ctx.lineCap='round';
        ctx.shadowBlur=18; ctx.shadowColor=g(C_S+',1');
        ctx.beginPath(); ctx.moveTo(0,st.hy-4*sz); ctx.lineTo(st.vw,st.hy+6*sz); ctx.stroke(); ctx.shadowBlur=0;
      }
      if(pr>0.25){ var sa=Math.min(1,(pr-0.25)/0.4), env=1-Math.max(0,(pr-0.7))/0.3;
        ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(0.2);
        ctx.strokeStyle=g(C_S+','+(0.9*env)); ctx.lineWidth=2.2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_S+',1');
        for(var k=0;k<6;k++){ ctx.rotate(1.047);
          var L=(14+sa*42)*sz*(k%2?0.6:1);
          ctx.beginPath(); ctx.moveTo(0,4*sz); ctx.lineTo(0,L); ctx.stroke(); }
        ctx.shadowBlur=0; ctx.restore();
      }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉝机械主教·组装者 —— 红独眼扫描→机械臂切割+冲压→流水线出兵→清理协议激光矩阵 */
function fxZuzhuang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,60,45', C_O='255,150,60', C_M='170,182,200', C_T='255,220,150';
  var eyeT=-1, armT=-1, hammerT=-1, bots=[], gridT=-1;
  function drawBot(ctx,x,y,s,a,walk){ /* 小机械兵: 方头独眼+双腿 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    var bg=ctx.createLinearGradient(0,-14,0,8); bg.addColorStop(0,'#5a6474'); bg.addColorStop(1,'#333b48');
    ctx.fillStyle=bg; ctx.strokeStyle='#1c222c'; ctx.lineWidth=1;
    ctx.fillRect(-6,-6,12,12); ctx.strokeRect(-6,-6,12,12);
    ctx.fillRect(-4.6,-14,9.2,7); ctx.strokeRect(-4.6,-14,9.2,7);
    ctx.fillStyle='#ff4838'; ctx.shadowBlur=6; ctx.shadowColor='#ff4838';
    ctx.beginPath(); ctx.arc(0,-10.5,1.8,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#333b48'; ctx.lineWidth=2.4; ctx.lineCap='round';
    var lw=Math.sin(walk)*3;
    ctx.beginPath(); ctx.moveTo(-3,6); ctx.lineTo(-3+lw,13); ctx.moveTo(3,6); ctx.lineTo(3-lw,13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6,-2); ctx.lineTo(-10,2); ctx.moveTo(6,-2); ctx.lineTo(10,2); ctx.stroke();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6400,endMs:4500,
  busy:function(st){ return bots.length>0||(gridT>0&&st.t-gridT<900); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①120 红独眼聚焦扫描 + 工厂苏醒: 焊接火花四周亮起 */
    if(!st.fired.eye&&t>=120){ st.fired.eye=1; eyeT=t; }
    if(t<1000&&Math.random()<0.55){ var wx=st.hx+rnd(-120,120)*sz, wy=st.hy+rnd(-70,55)*sz;
      F.jet(st.P,wx,wy,-1.57+rnd(-0.6,0.6),0.5,C_T,3,4.5,sz);
      F.flash(st.P,wx,wy,C_O,7*sz,90); }
    /* ②1050 激光切割横扫 + 1550 液压锤砸落 */
    if(!st.fired.arm&&t>=1050){ st.fired.arm=1; armT=t; st.fire(); }
    if(armT>0&&t-armT<620&&Math.random()<0.65){ var sp2=(t-armT)/620;
      F.burst(st.P,st.hx-56*sz+sp2*112*sz,st.hy+rnd(-6,6)*sz,C_O,2,4,sz); }
    if(!st.fired.ham&&t>=1720){ st.fired.ham=1; hammerT=t; }
    if(!st.fired.hamhit&&hammerT>0&&t-hammerT>=300){ st.fired.hamhit=1;
      F.flash(st.P,st.hx,st.hy,C_O,44*sz,220);
      F.burst(st.P,st.hx,st.hy,C_O,14,7.5,sz); F.ring(st.P,st.hx,st.hy,C_R,1.2,3.8*sz);
      F.shards(st.P,st.hx,st.hy,C_M,10,sz);
    }
    /* ③2500 流水线出兵: 3个小机械兵列队冲锋 */
    if(!st.fired.bots&&t>=2500){ st.fired.bots=1;
      for(var i=0;i<3;i++)bots.push({p:0,spd:rnd(0.00095,0.0012),off:(i-1)*26,delay:i*190,walk:rnd(0,6)});
      F.burst(st.P,st.bx+40*sz,st.by+50*sz,C_T,8,4,sz);
    }
    for(var bi=bots.length-1;bi>=0;bi--){ var B=bots[bi];
      if(B.delay>0){B.delay-=st.dt;continue;}
      B.p+=B.spd*st.dt; B.walk+=st.dt*0.03;
      if(B.p>=1){ F.flash(st.P,st.hx+B.off*sz*0.4,st.hy,C_O,22*sz,170);
        F.burst(st.P,st.hx+B.off*sz*0.4,st.hy,C_O,9,6,sz); F.ring(st.P,st.hx+B.off*sz*0.4,st.hy,C_R,0.8,2.6*sz);
        bots.splice(bi,1); }
    }
    /* ④3450 清理协议: 激光矩阵网格封锁+爆 */
    if(!st.fired.grid&&t>=3450){ st.fired.grid=1; gridT=t; }
    if(!st.fired.gboom&&gridT>0&&t-gridT>=460){ st.fired.gboom=1;
      F.flash(st.P,st.hx,st.hy,C_R,60*sz,300);
      F.ring(st.P,st.hx,st.hy,C_R,1.7,5.5*sz); F.ring(st.P,st.hx,st.hy,C_O,1.1,3.6*sz);
      F.burst(st.P,st.hx,st.hy,C_R,24,8.5,sz); F.burst(st.P,st.hx,st.hy,C_O,12,6.5,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 机械臂(②幕: 切割臂横移 / 冲压锤砸) */
    function drawArm(x0,y0,ex,ey,headKind,a){
      ctx.save(); ctx.globalAlpha=a;
      var mx=(x0+ex)/2+18*sz, my2=(y0+ey)/2-24*sz;
      ctx.strokeStyle='#4a5464'; ctx.lineWidth=7*sz; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(mx,my2); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.strokeStyle='#8a94a4'; ctx.lineWidth=2*sz;
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(mx,my2); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.fillStyle='#2a323e'; ctx.beginPath(); ctx.arc(mx,my2,4.4*sz,0,6.283); ctx.fill();
      if(headKind==='laser'){ ctx.fillStyle='#333b48'; ctx.fillRect(ex-5*sz,ey-4*sz,10*sz,8*sz);
        ctx.fillStyle='#ff4838'; ctx.beginPath(); ctx.arc(ex,ey+4*sz,2*sz,0,6.283); ctx.fill(); }
      else { var hg=ctx.createLinearGradient(ex-9*sz,0,ex+9*sz,0); hg.addColorStop(0,'#5a6474'); hg.addColorStop(1,'#333b48');
        ctx.fillStyle=hg; ctx.fillRect(ex-9*sz,ey-2*sz,18*sz,12*sz);
        ctx.strokeStyle='#1c222c'; ctx.lineWidth=1*sz; ctx.strokeRect(ex-9*sz,ey-2*sz,18*sz,12*sz); }
      ctx.restore();
    }
    if(armT>0&&t-armT<680){ var sp2=Math.min(1,(t-armT)/620);
      var ex=st.hx-56*sz+sp2*112*sz;
      drawArm(st.bx+50*sz,st.by-70*sz,ex,st.hy-26*sz,'laser',(t-armT)>560?(680-(t-armT))/120:1);
      /* 切割激光 */
      ctx.strokeStyle=g(C_R+',0.95'); ctx.lineWidth=2.4*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(ex,st.hy-20*sz); ctx.lineTo(ex,st.hy+8*sz); ctx.stroke(); ctx.shadowBlur=0;
    }
    if(hammerT>0&&t-hammerT<520){ var hp2=(t-hammerT);
      var hy2=hp2<300?st.hy-96*sz+Math.pow(hp2/300,2)*84*sz:st.hy-12*sz;
      drawArm(st.bx+58*sz,st.by-80*sz,st.hx,hy2,'hammer',hp2>400?(520-hp2)/120:1);
    }
    /* 传送带+小兵(③幕) */
    if(t>=2450&&t<3900){ var ba=Math.min(1,(t-2450)/200)*(t>3650?Math.max(0,(3900-t)/250):1);
      ctx.save(); ctx.globalAlpha=ba*0.9;
      var beltY=st.hy+34*sz;
      ctx.fillStyle='#2a323e'; ctx.fillRect(st.bx-10*sz,beltY,st.hx-st.bx+30*sz,6*sz);
      ctx.strokeStyle='#4a5464'; ctx.lineWidth=1*sz;
      var scroll=(t*0.05)%12;
      for(var v=0;v<14;v++){ var vx=st.bx-10*sz+v*12*sz-scroll*sz;
        if(vx>st.bx-10*sz&&vx<st.hx+20*sz){ ctx.beginPath(); ctx.moveTo(vx,beltY); ctx.lineTo(vx,beltY+6*sz); ctx.stroke(); } }
      ctx.restore();
    }
    for(var bi=0;bi<bots.length;bi++){ var B=bots[bi]; if(B.delay>0)continue;
      var x=st.bx+30*sz+(st.hx+B.off*sz*0.4-(st.bx+30*sz))*B.p;
      var y=st.hy+28*sz-Math.abs(Math.sin(B.walk))*2*sz;
      drawBot(ctx,x,y,1.15*sz,Math.min(1,B.p*5),B.walk);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 红独眼扫描(①幕: boss上方红独眼+锥形扫描光) */
    if(eyeT>0&&t-eyeT<1000){ var pr=(t-eyeT)/1000, env=Math.sin(Math.min(1,pr*1.3)*3.14);
      var ox=st.bx, oy=st.by-84*sz;
      var eg=ctx.createRadialGradient(ox,oy,0,ox,oy,10*sz);
      eg.addColorStop(0,'rgba(255,120,100,'+env+')'); eg.addColorStop(.4,g(C_R+','+(0.85*env))); eg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(ox,oy,10*sz,0,6.283); ctx.fill();
      /* 扫描锥 */
      var sway=Math.sin(t*0.006)*30*sz;
      var cg=ctx.createLinearGradient(ox,oy,st.hx+sway,st.hy);
      cg.addColorStop(0,g(C_R+','+(0.4*env))); cg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(st.hx+sway-30*sz,st.hy+10*sz); ctx.lineTo(st.hx+sway+30*sz,st.hy+10*sz); ctx.closePath(); ctx.fill();
      /* 数据流小字 */
      if(pr>0.35){ ctx.fillStyle=g(C_R+','+(0.85*env)); ctx.font=(8*sz)+'px monospace';
        ctx.fillText('SCAN 98%',st.hx+36*sz,st.hy-30*sz); ctx.fillText('杂质:1',st.hx+36*sz,st.hy-20*sz); }
    }
    /* 清理协议激光矩阵(④幕: 红色网格罩住勇者区) */
    if(gridT>0&&t-gridT<800){ var pr2=(t-gridT)/800, env2=Math.sin(Math.min(1,pr2*1.2)*3.14);
      ctx.save(); ctx.globalAlpha=env2;
      ctx.strokeStyle=g(C_R+',0.8'); ctx.lineWidth=1.4*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_R+',1');
      var x0=st.hx-64*sz, y0=st.hy-44*sz, w=128*sz, h=88*sz;
      var n=Math.floor(5*Math.min(1,pr2*2.2));
      for(var k=0;k<=n;k++){ ctx.beginPath(); ctx.moveTo(x0+k/5*w,y0); ctx.lineTo(x0+k/5*w,y0+h); ctx.stroke(); }
      for(var k2=0;k2<=Math.floor(4*Math.min(1,pr2*2.2));k2++){ ctx.beginPath(); ctx.moveTo(x0,y0+k2/4*h); ctx.lineTo(x0+w,y0+k2/4*h); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉞活体行星·古老意志 —— 行星苏醒→引力波低语→记忆环光丝→核心共鸣引力坍缩·超新星 */
function fxGuyi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='90,150,255', C_G='255,210,110', C_W='255,246,220', C_A='240,200,130';
  var planet={a:0,glow:0}, waves=[], whips=[], collapseT=-1, novaT=-1;
  function drawPlanet(ctx,x,y,s,a,t,glow){ /* 深蓝光膜行星+金色思维纹路+记忆环 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y);
    var R=30*s;
    /* 记忆环(倾斜金环·光丝) */
    ctx.save(); ctx.rotate(-0.35);
    ctx.strokeStyle='rgba(255,210,110,'+(0.55+glow*0.35)+')'; ctx.lineWidth=1.6*s; ctx.shadowBlur=8; ctx.shadowColor='rgba(255,210,110,1)';
    ctx.beginPath(); ctx.ellipse(0,0,R*1.75,R*0.5,0,0,6.283); ctx.stroke();
    ctx.setLineDash([2*s,5*s]); ctx.lineWidth=1*s;
    ctx.beginPath(); ctx.ellipse(0,0,R*1.52,R*0.42,0,0,6.283); ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
    /* 行星体 */
    var pg=ctx.createRadialGradient(-R*0.35,-R*0.35,R*0.15,0,0,R);
    pg.addColorStop(0,'#3a6ab8'); pg.addColorStop(.6,'#1c3a78'); pg.addColorStop(1,'#0c1a44');
    ctx.fillStyle=pg; ctx.shadowBlur=18*(0.6+glow); ctx.shadowColor='rgba(110,170,255,0.9)';
    ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    /* 金色思维纹路(缓慢流动折线) */
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.clip();
    ctx.strokeStyle='rgba(255,210,110,'+(0.55+glow*0.4)+')'; ctx.lineWidth=1.1*s; ctx.shadowBlur=6; ctx.shadowColor='rgba(255,210,110,1)';
    for(var L2=0;L2<3;L2++){ ctx.beginPath();
      for(var v=0;v<=10;v++){ var vx=-R+v/10*R*2;
        var vy=Math.sin(v*1.3+t*0.0012+L2*2.1)*R*0.3+(L2-1)*R*0.42;
        if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
      ctx.stroke(); }
    ctx.shadowBlur=0; ctx.restore();
    /* 大气金晕 */
    ctx.strokeStyle='rgba(255,215,130,'+(0.35+glow*0.45)+')'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.arc(0,0,R*1.08,0,6.283); ctx.stroke();
    /* 地核光点(glow时透出) */
    if(glow>0.1){ var cg=ctx.createRadialGradient(0,0,0,0,0,R*0.4);
      cg.addColorStop(0,'rgba(255,240,190,'+(glow*0.9)+')'); cg.addColorStop(1,'rgba(255,210,110,0)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,R*0.4,0,6.283); ctx.fill(); }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6500,endMs:4600,
  busy:function(st){ return novaT>0&&st.t-novaT<950; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    var px=st.bx+82*sz, py=st.by-72*sz;
    /* ①0-900 行星苏醒 */
    planet.a=Math.min(1,t/500);
    planet.glow=Math.min(0.35,t/2400);
    if(t<900&&Math.random()<0.4)F.suck(st.P,px+rnd(-80,80)*sz,py+rnd(-60,60)*sz,px,py,C_G,sz*0.8);
    /* ②950起 引力波低语: 三道同心波推向勇者 */
    if(!st.fired.w1&&t>=950){ st.fired.w1=1; waves.push({ts:t}); st.fire(); }
    if(!st.fired.w2&&t>=1300){ st.fired.w2=1; waves.push({ts:t}); }
    if(!st.fired.w3&&t>=1650){ st.fired.w3=1; waves.push({ts:t});
      F.burst(st.P,st.hx,st.hy,C_B,10,6,sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3*sz); }
    /* ③2150 记忆环光丝: 三条金丝如鞭挥扫 */
    if(!st.fired.whip&&t>=2150){ st.fired.whip=1;
      for(var i=0;i<3;i++)whips.push({ts:2150+i*300,ph:rnd(0,6.28),done:false});
    }
    for(var wi=0;wi<whips.length;wi++){ var W2=whips[wi];
      if(!W2.done&&t>=W2.ts+240){ W2.done=true;
        F.burst(st.P,st.hx,st.hy,C_G,9,6,sz); F.ring(st.P,st.hx,st.hy,C_G,0.8,2.6*sz);
      } }
    /* ④3200 核心共鸣→引力坍缩(吸入)→3750 超新星释放 */
    if(!st.fired.col&&t>=3200){ st.fired.col=1; collapseT=t; planet.glow=1; }
    if(collapseT>0&&t-collapseT<520&&Math.random()<0.9){
      F.suck(st.P,st.hx+rnd(-90,90)*sz,st.hy+rnd(-60,60)*sz,st.hx,st.hy,Math.random()<0.5?C_G:C_B,sz); }
    if(!st.fired.nova&&t>=3760){ st.fired.nova=1; novaT=t;
      F.flash(st.P,st.hx,st.hy,C_W,74*sz,340);
      F.ring(st.P,st.hx,st.hy,C_G,2.0,6.5*sz); F.ring(st.P,st.hx,st.hy,C_B,1.4,4.6*sz); F.ring(st.P,st.hx,st.hy,C_W,0.9,3*sz);
      F.burst(st.P,st.hx,st.hy,C_G,28,9,sz); F.burst(st.P,st.hx,st.hy,C_B,16,7,sz);
      F.shards(st.P,st.hx,st.hy,C_A,12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(planet.a>0)drawPlanet(ctx,st.bx+82*sz,st.by-72*sz,1.15*sz,planet.a*(t>4200?Math.max(0,1-(t-4200)/350):1),t,planet.glow);
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var px=st.bx+82*sz, py=st.by-72*sz;
    /* 引力波(从行星推向勇者的扩张弧) */
    for(var wi=0;wi<waves.length;wi++){ var W3=waves[wi];
      var age=t-W3.ts; if(age>820)continue;
      var pr=age/820;
      var cx=px+(st.hx-px)*pr, cy=py+(st.hy-py)*pr;
      var R2=(14+pr*30)*sz;
      ctx.strokeStyle=g(C_B+','+(0.75*(1-pr))); ctx.lineWidth=(3.4-pr*2)*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_B+',1');
      var a2=Math.atan2(st.hy-py,st.hx-px);
      ctx.beginPath(); ctx.arc(cx,cy,R2,a2-1.15,a2+1.15); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 记忆环金丝鞭(贝塞尔挥扫) */
    for(var wi2=0;wi2<whips.length;wi2++){ var W2=whips[wi2];
      var age2=t-W2.ts; if(age2<0||age2>360)continue;
      var pr2=age2/360, env=Math.sin(pr2*3.14);
      var reach=Math.min(1,pr2*1.6);
      var ex=px+(st.hx-px)*reach, ey=py+(st.hy-py)*reach;
      ctx.strokeStyle=g(C_G+','+(0.9*env)); ctx.lineWidth=2.6*sz; ctx.lineCap='round';
      ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(px,py);
      ctx.quadraticCurveTo((px+ex)/2+Math.sin(W2.ph+t*0.01)*46*sz,(py+ey)/2-30*sz, ex,ey);
      ctx.stroke(); ctx.shadowBlur=0;
      var tg=ctx.createRadialGradient(ex,ey,0,ex,ey,7*sz);
      tg.addColorStop(0,g(C_W+','+env)); tg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(ex,ey,7*sz,0,6.283); ctx.fill();
    }
    /* 引力坍缩(勇者区空间向内收缩线) */
    if(collapseT>0&&t-collapseT<540){ var pr3=(t-collapseT)/540;
      for(var k=0;k<8;k++){ var a3=k/8*6.283+pr3*1.2;
        var r0=(90-pr3*66)*sz;
        ctx.strokeStyle=g(C_B+','+(0.65*(1-pr3*0.4))); ctx.lineWidth=1.6*sz;
        ctx.beginPath(); ctx.moveTo(st.hx+Math.cos(a3)*r0,st.hy+Math.sin(a3)*r0*0.7);
        ctx.lineTo(st.hx+Math.cos(a3)*(r0-18*sz),st.hy+Math.sin(a3)*(r0-18*sz)*0.7); ctx.stroke(); }
      /* 中心凝聚核 */
      var cr=(3+pr3*9)*sz;
      var ng=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,cr*2.4);
      ng.addColorStop(0,g(C_W+',0.95')); ng.addColorStop(.5,g(C_G+',0.7')); ng.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=ng; ctx.beginPath(); ctx.arc(st.hx,st.hy,cr*2.4,0,6.283); ctx.fill();
    }
    /* 超新星光膜涟漪(全屏三重金弧) */
    if(novaT>0&&t-novaT<900){ var pr4=(t-novaT)/900;
      for(var w4=0;w4<3;w4++){ var rp=pr4-w4*0.13; if(rp<0||rp>1)continue;
        var R4=rp*150*sz;
        ctx.strokeStyle=g((w4===1?C_B:C_G)+','+(0.7*(1-rp))); ctx.lineWidth=(4-w4)*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
        ctx.beginPath(); ctx.arc(st.hx,st.hy,R4,0,6.283); ctx.stroke(); ctx.shadowBlur=0; }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
