/* ═══ v7 重做(覆盖v6): 星陨武士·流亡之刃 —— 复刻光剑点火→绝地四连斩(残影+光弧+火花雨)→原力波前平推→握持+高位终结 ═══ */
function fxLiuwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  /* 刃色: 立绘采样 RGB(217,229,242) 冷银蓝 */
  var BL_GLOW='150,195,240', BL_MID='210,228,246', PU_GLOW='170,120,250', PU_MID='205,165,255';
  var C_S='170,215,255', C_W='245,250,255', C_P='190,140,255';
  var saber={a:0,ignite:0,ax:0,ay:0,ang:-1.3}, rocks=[], swings=[], sparks=[];
  var freezeT=-1, frontT=-1, frontX=-1, holdT=-1, lifts=[], finT=-1;
  function drawReplicaSaber(ctx,x,y,ang,s,a,ignite,purple,t){
    /* 复刻剑: 简洁合金柄(末端银蓝晶体·红激活钮·喇叭发射口)+银蓝光刃(白芯·碎水晶锯齿波动) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(ang); ctx.scale(s,s);
    /* ── 柄(刃根在0,0 柄向-y后延) ── */
    /* 发射器喇叭口 */
    var eg=ctx.createLinearGradient(-3.4,0,3.4,0); eg.addColorStop(0,'#7e8a9a'); eg.addColorStop(.5,'#d4dde8'); eg.addColorStop(1,'#68727f');
    ctx.fillStyle=eg; ctx.strokeStyle='#1a1e26'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-3.4,0); ctx.lineTo(-2.4,3.4); ctx.lineTo(2.4,3.4); ctx.lineTo(3.4,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* 控制段(银)+红激活钮 */
    var cg=ctx.createLinearGradient(-2.8,0,2.8,0); cg.addColorStop(0,'#6e7886'); cg.addColorStop(.5,'#aeb9c6'); cg.addColorStop(1,'#5a6470');
    ctx.fillStyle=cg; ctx.fillRect(-2.8,3.4,5.6,5.2); ctx.strokeRect(-2.8,3.4,5.6,5.2);
    ctx.fillStyle='#e83030'; ctx.beginPath(); ctx.arc(2.1,6,1.05,0,6.283); ctx.fill();
    /* 握把(黑·三道格栅) */
    ctx.fillStyle='#171b22'; ctx.beginPath();
    ctx.moveTo(-2.5,8.6); ctx.lineTo(2.5,8.6); ctx.lineTo(2.2,19.4); ctx.lineTo(-2.2,19.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle='#3c4654'; ctx.lineWidth=0.7;
    for(var k=0;k<3;k++){ ctx.beginPath(); ctx.moveTo(-2.1,11+k*2.7); ctx.lineTo(2.1,11+k*2.7); ctx.stroke(); }
    /* 尾盘+银蓝晶体(人设: 末端嵌指甲大凯伯水晶残片) */
    ctx.strokeStyle='#1a1e26'; ctx.lineWidth=0.8;
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,20.8,2.6,0,6.283); ctx.fill(); ctx.stroke();
    var tw=0.6+Math.sin(t*0.01)*0.4;
    ctx.fillStyle='rgba(190,225,255,'+tw+')'; ctx.shadowBlur=8; ctx.shadowColor='rgba(160,210,255,1)';
    ctx.beginPath(); ctx.arc(0,20.8,1.25,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    /* ── 光刃(向-y延伸 L=54*ignite) ── */
    if(ignite>0.02){ var L=54*ignite;
      var GLOW=purple?PU_GLOW:BL_GLOW, MID=purple?PU_MID:BL_MID;
      ctx.lineCap='round';
      /* 外晕 */
      ctx.strokeStyle='rgba('+GLOW+',0.32)'; ctx.lineWidth=10.5; ctx.shadowBlur=24; ctx.shadowColor='rgb('+GLOW+')';
      ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,-L); ctx.stroke();
      /* 亮层 */
      ctx.strokeStyle='rgba('+MID+',0.88)'; ctx.lineWidth=5.4; ctx.shadowBlur=14;
      ctx.beginPath(); ctx.moveTo(0,-1); ctx.lineTo(0,-L); ctx.stroke();
      ctx.shadowBlur=0;
      /* 白芯(碎水晶锯齿微波动) */
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.3;
      ctx.beginPath(); ctx.moveTo(0,-1);
      var segN=Math.max(2,Math.floor(L/6));
      for(var v=1;v<=segN;v++){ var vy=-v/segN*L;
        var wob=Math.sin(v*2.1+t*0.02)*0.55;
        ctx.lineTo(wob,vy); }
      ctx.stroke();
      /* 刃尖圆头 */
      ctx.fillStyle='#ffffff'; ctx.shadowBlur=10; ctx.shadowColor='rgb('+MID+')';
      ctx.beginPath(); ctx.arc(0,-L,2.5,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    }
    ctx.restore();
  }
  function drawSwingArc(ctx,cx,cy,r0,r1,a0,cur,colS,alpha){
    var steps=16, span=cur-a0;
    for(var i=0;i<steps;i++){ var p=i/steps;
      var aa=a0+span*p, ab=a0+span*(p+1/steps)*1.02;
      var al=alpha*Math.pow(p,1.6)*0.7;
      if(al<=0.01)continue;
      ctx.fillStyle='rgba('+colS+','+al+')';
      ctx.beginPath();
      if(span>=0){ ctx.arc(cx,cy,r1,aa,ab); ctx.arc(cx,cy,r0,ab,aa,true); }
      else { ctx.arc(cx,cy,r1,ab,aa); ctx.arc(cx,cy,r0,aa,ab,true); }
      ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle='rgba(255,255,255,'+(alpha*0.65)+')'; ctx.lineWidth=1.8;
    ctx.shadowBlur=12; ctx.shadowColor='rgba('+colS+',1)';
    ctx.beginPath();
    if(span>=0)ctx.arc(cx,cy,r1-3,a0+span*0.4,cur); else ctx.arc(cx,cy,r1-3,cur,a0+span*0.4);
    ctx.stroke(); ctx.shadowBlur=0;
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:7000,endMs:5000,
  busy:function(st){ return (finT>0&&st.t-finT<1000)||sparks.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    saber.ax=st.hx-68*sz; saber.ay=st.hy-24*sz;
    /* ①拔剑点火 */
    saber.a=Math.min(1,Math.max(0,(t-120)/260));
    if(t>=420)saber.ignite=Math.min(1,(t-420)/130);
    if(!st.fired.ign&&t>=430){ st.fired.ign=1;
      F.flash(st.P,saber.ax,saber.ay-20*sz,C_W,16*sz,140);
      F.ring(st.P,saber.ax,saber.ay-20*sz,C_S,0.5,1.6*sz); F.ring(st.P,saber.ax,saber.ay-20*sz,C_W,0.35,1.1*sz);
    }
    /* 原力浮石 */
    if(!st.fired.rk&&t>=150){ st.fired.rk=1;
      for(var i=0;i<6;i++)rocks.push({x:st.hx+rnd(-80,80)*sz,y:st.hy+rnd(26,44)*sz,ty:st.hy+rnd(-34,10)*sz,p:0,rot:rnd(0,6.28),vrot:rnd(-0.02,0.02),w:rnd(5.5,10)*sz,ph:rnd(0,6.28),flung:false,vx:0,vy:0});
    }
    for(var ri=rocks.length-1;ri>=0;ri--){ var R2=rocks[ri];
      if(R2.flung){ R2.vy+=0.014*st.dt; R2.x+=R2.vx*st.dt*0.06; R2.y+=R2.vy*st.dt*0.06; R2.rot+=R2.vrot*5;
        if(R2.y>st.barBot+30||R2.x<-40||R2.x>st.vw+40)rocks.splice(ri,1); }
      else if(freezeT<0){ R2.p=Math.min(1,R2.p+st.dt*0.0009); R2.rot+=R2.vrot*st.dt*0.06; }
    }
    /* ②950 绝地四连斩(斩4=360°回旋) */
    if(!st.fired.sw&&t>=950){ st.fired.sw=1;
      swings.push({ts:950, ax:st.hx-64*sz,ay:st.hy-26*sz, a0:-2.55,a1:0.55, dur:300});
      swings.push({ts:1330,ax:st.hx-56*sz,ay:st.hy-16*sz, a0:0.85,a1:-2.25, dur:290});
      swings.push({ts:1710,ax:st.hx-60*sz,ay:st.hy-40*sz, a0:-2.7,a1:-0.55, dur:280, purple:true});
      swings.push({ts:2090,ax:st.hx-58*sz,ay:st.hy-22*sz, a0:-2.9,a1:3.38, dur:440, twirl:true});
    }
    for(var si=0;si<swings.length;si++){ var s2=swings[si];
      if(!s2.hit&&t>=s2.ts+s2.dur*0.55){ s2.hit=true;
        var mid=(s2.a0+s2.a1)/2, hxx=s2.ax+Math.cos(mid)*52*sz, hyy=s2.ay+Math.sin(mid)*52*sz*0.8;
        /* 火花雨 */
        for(var q=0;q<(s2.big?12:8);q++){ var sa2=rnd(0,6.28);
          sparks.push({x:hxx,y:hyy,vx:Math.cos(sa2)*rnd(1.5,4),vy:Math.sin(sa2)*rnd(1.5,3.4)-1.4,life:0,max:rnd(260,480),pu:s2.purple}); }
        F.burst(st.P,hxx,hyy,s2.purple?C_P:C_S,s2.big?18:9,s2.big?8:6,sz);
        F.ring(st.P,st.hx,st.hy,s2.purple?C_P:C_S,s2.big?1.6:0.8,(s2.big?5:2.6)*sz);
        if(s2.big){ F.flash(st.P,st.hx,st.hy,C_W,58*sz,300); F.shards(st.P,st.hx,st.hy,C_W,12,sz); }
        if(!st.fired.dealt&&t>=1330){ st.fired.dealt=1; st.fire(); }
      } }
    for(var pi=sparks.length-1;pi>=0;pi--){ var SP=sparks[pi];
      SP.life+=st.dt; SP.vy+=0.009*st.dt; SP.x+=SP.vx*st.dt*0.06; SP.y+=SP.vy*st.dt*0.06;
      if(SP.life>SP.max)sparks.splice(pi,1); }
    /* ③2620 原力推: 蓄(碎石凝滞)→波前平推 */
    if(!st.fired.frz&&t>=2620){ st.fired.frz=1; freezeT=t;
      for(var r3=0;r3<rocks.length;r3++)F.ring(st.P,rocks[r3].x,rocks[r3].flung?rocks[r3].y:rocks[r3].y+(rocks[r3].ty-rocks[r3].y)*rocks[r3].p,C_S,0.4,1.2*sz);
    }
    if(!st.fired.front&&t>=2820){ st.fired.front=1; frontT=t; }
    if(frontT>0&&t-frontT<430){ var fp=(t-frontT)/430;
      frontX=st.bx+30*sz+(st.hx+58*sz-(st.bx+30*sz))*fp;
      if(Math.random()<0.75)F.jet(st.P,frontX+rnd(-8,8)*sz,st.hy+38*sz,-1.57+rnd(-0.5,0.5),0.4,'175,170,155',2,4.5,sz);
      /* 波前扫过逐个击飞碎石 */
      for(var r4=0;r4<rocks.length;r4++){ var RK=rocks[r4];
        if(!RK.flung&&RK.x<=frontX){ RK.flung=true;
          RK.vx=rnd(2.6,4.6); RK.vy=rnd(-3.4,-1.4); RK.y=RK.y+(RK.ty-RK.y)*RK.p; } }
    }
    if(!st.fired.fronthit&&frontT>0&&t-frontT>=430){ st.fired.fronthit=1;
      F.flash(st.P,st.hx,st.hy,C_S,46*sz,240);
      F.ring(st.P,st.hx,st.hy,C_S,1.6,4.8*sz); F.ring(st.P,st.hx,st.hy,C_W,1.0,3.2*sz);
      F.burst(st.P,st.hx,st.hy,C_S,16,7.5,sz);
    }
    /* ④3480 原力握持(+碎屑上提)→4050 高位终结下劈 */
    if(!st.fired.hold&&t>=3480){ st.fired.hold=1; holdT=t;
      for(var l2=0;l2<3;l2++)lifts.push({x:st.hx+rnd(-30,30)*sz,y:st.hy+rnd(14,30)*sz,w:rnd(2.4,4.2)*sz,rot:rnd(0,6.28),ph:rnd(0,6.28)});
      F.ring(st.P,st.hx,st.hy,C_P,0.9,2.6*sz);
    }
    if(!st.fired.fin&&t>=4050){ st.fired.fin=1; finT=t;
      swings.push({ts:t,ax:st.hx,ay:st.hy-64*sz,a0:1.57-1.5,a1:1.57+1.42,dur:330,big:true});
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 原力悬石 */
    for(var ri=0;ri<rocks.length;ri++){ var R2=rocks[ri];
      var y=R2.flung?R2.y:R2.y+(R2.ty-R2.y)*R2.p+(freezeT<0?Math.sin(R2.ph+t*0.003)*3*sz:0);
      ctx.save(); ctx.translate(R2.x,y); ctx.rotate(R2.rot);
      var rg=ctx.createLinearGradient(-R2.w/2,0,R2.w/2,0); rg.addColorStop(0,'#5a5850'); rg.addColorStop(.5,'#8a877c'); rg.addColorStop(1,'#48463e');
      ctx.fillStyle=rg; ctx.strokeStyle='#2e2c26'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(-R2.w/2,-R2.w*0.28); ctx.lineTo(R2.w*0.3,-R2.w*0.48); ctx.lineTo(R2.w/2,R2.w*0.2); ctx.lineTo(-R2.w*0.2,R2.w*0.44); ctx.closePath(); ctx.fill(); ctx.stroke();
      if(!R2.flung){ ctx.strokeStyle='rgba(170,215,255,'+(0.3+Math.sin(t*0.006+R2.ph)*0.2)+')'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,R2.w*0.85,0,6.283); ctx.stroke(); }
      ctx.restore();
    }
    /* 握持上提碎屑 */
    if(holdT>0&&t-holdT<700){ var lp=(t-holdT)/700;
      for(var li=0;li<lifts.length;li++){ var LF=lifts[li];
        var ly=LF.y-lp*22*sz+Math.sin(LF.ph+t*0.005)*2*sz;
        ctx.save(); ctx.globalAlpha=Math.sin(Math.min(1,lp*1.15)*3.14);
        ctx.translate(LF.x,ly); ctx.rotate(LF.rot+t*0.001);
        ctx.fillStyle='#6a675e';
        ctx.fillRect(-LF.w/2,-LF.w*0.35,LF.w,LF.w*0.7);
        ctx.restore(); } }
    /* 火花(实体小亮线) */
    for(var pi=0;pi<sparks.length;pi++){ var SP=sparks[pi];
      var pr=SP.life/SP.max;
      ctx.save(); ctx.globalAlpha=(1-pr)*0.95;
      ctx.strokeStyle=SP.pu?'#d9b8ff':'#eaf5ff'; ctx.lineWidth=1.5*sz; ctx.lineCap='round';
      ctx.shadowBlur=6; ctx.shadowColor=SP.pu?'#c890ff':'#9ecfff';
      ctx.beginPath(); ctx.moveTo(SP.x,SP.y); ctx.lineTo(SP.x-SP.vx*3.4,SP.y-SP.vy*3.4); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 挥砍中的剑: 光弧扇面+残影+剑本体 */
    var swinging=null;
    for(var si=0;si<swings.length;si++){ var s2=swings[si];
      var age=t-s2.ts; if(age<0||age>s2.dur+200)continue;
      var pr=Math.min(1,age/s2.dur);
      var ease=s2.twirl?(1-Math.pow(1-pr,2)):(1-Math.pow(1-pr,2.6));
      var cur=s2.a0+(s2.a1-s2.a0)*ease;
      var fade=age>s2.dur?1-(age-s2.dur)/200:1;
      var colS=s2.purple?PU_GLOW:(s2.big?'240,250,255':BL_GLOW);
      var r1=(s2.big?92:78)*sz;
      drawSwingArc(ctx,s2.ax,s2.ay,18*sz,r1,s2.a0,cur,colS,(s2.big?1:0.85)*fade);
      /* 运动残影(刃) */
      if(age<=s2.dur){ var span=s2.a1-s2.a0;
        for(var k2=1;k2<=3;k2++){ var ga=cur-span*0.075*k2;
          if((span>0&&ga<s2.a0)||(span<0&&ga>s2.a0))continue;
          drawReplicaSaber(ctx,s2.ax,s2.ay,ga+1.5708,1.35*sz,0.34/k2,1,s2.purple,t); }
        drawReplicaSaber(ctx,s2.ax,s2.ay,cur+1.5708,1.35*sz,fade,1,s2.purple,t);
        swinging=s2;
      }
    }
    /* idle剑(点火·呼吸·非挥砍期且未进终结) */
    if(!swinging&&saber.a>0&&t<4050){ var idleFade=t>3900?Math.max(0,(4050-t)/150):1;
      var sway=Math.sin(t*0.0035)*0.09;
      drawReplicaSaber(ctx,saber.ax,saber.ay,saber.ang+sway,1.35*sz,saber.a*idleFade,saber.ignite,false,t);
    }
    /* 原力波前(竖直弧面墙平推) */
    if(frontT>0&&t-frontT<470){ var fp2=Math.min(1,(t-frontT)/430), env=t-frontT>430?1-(t-frontT-430)/40:1;
      var fxp=st.bx+30*sz+(st.hx+58*sz-(st.bx+30*sz))*fp2;
      var Hh=118*sz;
      ctx.save();
      for(var v=0;v<=24;v++){ var vy=st.hy-Hh/2+v/24*Hh;
        var bulge=Math.sin(v/24*3.14)*16*sz;
        var seg=v===0?ctx.moveTo.bind(ctx):ctx.lineTo.bind(ctx);
        if(v===0)ctx.beginPath();
        seg(fxp+bulge,vy); }
      ctx.strokeStyle=g(C_S+','+(0.75*env)); ctx.lineWidth=3.4*sz; ctx.shadowBlur=16; ctx.shadowColor=g(C_S+',1'); ctx.stroke();
      /* 压缩空气带 */
      var ag2=ctx.createLinearGradient(fxp-26*sz,0,fxp+16*sz,0);
      ag2.addColorStop(0,g(C_S+',0')); ag2.addColorStop(.75,g(C_W+','+(0.22*env))); ag2.addColorStop(1,g(C_S+',0'));
      ctx.fillStyle=ag2; ctx.fillRect(fxp-26*sz,st.hy-Hh/2,42*sz,Hh);
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 原力握持(三圈紫环收缩+悬停微粒) */
    if(holdT>0&&t-holdT<640){ var pr3=(t-holdT)/640;
      for(var k=0;k<3;k++){ var rp2=Math.max(0,Math.min(1,pr3*1.4-k*0.18));
        if(rp2<=0)continue;
        var R4=(78-rp2*48)*sz;
        ctx.strokeStyle=g(C_P+','+(0.7*rp2)); ctx.lineWidth=1.8*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_P+',1');
        ctx.beginPath(); ctx.ellipse(st.hx,st.hy,R4,R4*0.62,0,0,6.283); ctx.stroke(); ctx.shadowBlur=0; }
      if(Math.random()<0.5){ var ha=rnd(0,6.28);
        ctx.fillStyle=g(C_P+',0.7'); ctx.beginPath();
        ctx.arc(st.hx+Math.cos(ha)*32*sz,st.hy+Math.sin(ha)*22*sz,1.6*sz,0,6.283); ctx.fill(); }
    }
    /* 终结六芒星裂 */
    if(finT>0&&t-finT>180&&t-finT<760){ var pr4=(t-finT-180)/580, env2=1-Math.max(0,(pr4-0.68))/0.32;
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(0.2);
      ctx.strokeStyle=g(C_S+','+(0.9*Math.max(0,env2))); ctx.lineWidth=2.2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_S+',1');
      for(var k3=0;k3<6;k3++){ ctx.rotate(1.047);
        var L2=(14+Math.min(1,pr4*1.6)*44)*sz*(k3%2?0.6:1);
        ctx.beginPath(); ctx.moveTo(0,4*sz); ctx.lineTo(0,L2); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
