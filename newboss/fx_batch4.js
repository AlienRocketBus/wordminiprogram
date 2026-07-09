/* ═══ 批4: 阴影/月/混沌/手绘/水墨组 6 boss ═══ */

/* ⑲影守·永夜之壁 —— 火光熄灭+阴影之手+永夜千手 */
function fxYingshou(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_P='150,120,255', C_D='60,50,110';
  var darkA=0, hands=[], nightT=-1;
  function drawHand(ctx,x,y,s,rot,a){ /* 阴影之手(五指从地面伸出) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='rgba(18,14,40,0.95)';
    ctx.beginPath(); ctx.moveTo(-9,18); ctx.quadraticCurveTo(-11,2,-8,-4);
    for(var f=0;f<5;f++){ var fx2=-8+f*4, fl=[-14,-20,-23,-19,-12][f];
      ctx.lineTo(fx2-1,fl*0.4); ctx.quadraticCurveTo(fx2,fl,fx2+1.4,fl*0.4); }
    ctx.quadraticCurveTo(11,2,9,18); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowBlur=8; ctx.shadowColor='rgba(150,120,255,1)';
    ctx.strokeStyle='rgba(150,120,255,0.55)'; ctx.lineWidth=1;
    ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return nightT>0&&st.t-nightT<820; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 火光熄灭: 画面变暗 */
    darkA=Math.min(0.5,t/700*0.5);
    /* ②750起 阴影之手三波从地面伸出抓向勇者 */
    if(!st.fired.h1&&t>=750){ st.fired.h1=1;
      for(var i=0;i<4;i++)hands.push({ts:750+i*230,x:st.hx+rnd(-80,80)*sz,rise:0,done:false});
      st.fire();
    }
    for(var hi=0;hi<hands.length;hi++){ var h=hands[hi];
      if(!h.done&&t>=h.ts+260){ h.done=true;
        F.burst(st.P,h.x,st.hy+20*sz,C_P,7,5,sz); F.ring(st.P,h.x,st.hy+20*sz,C_P,0.7,2.2*sz);
      } }
    /* ③2000 影翼百手齐指(左右两排手指向勇者) */
    if(!st.fired.point&&t>=2000){ st.fired.point=1;
      for(var k=0;k<8;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var side=kk%2?1:-1;
        F.trail(st.P,st.bx+side*rnd(60,130)*st.sz,st.by+rnd(-70,30)*st.sz,st.hx+rnd(-20,20)*st.sz,st.hy+rnd(-14,14)*st.sz,C_P,2.4*st.sz,240);
      },kk*60/st.sp); })(k); }
      F.burst(st.P,st.hx,st.hy,C_P,10,6,sz);
    }
    /* ④2750 永夜降临: 黑暗吞没+千手压来 */
    if(!st.fired.night&&t>=2750){ st.fired.night=1; nightT=t;
      F.flash(st.P,st.hx,st.hy,C_P,58*sz,300);
      F.ring(st.P,st.hx,st.hy,C_P,1.6,5.5*sz); F.ring(st.P,st.hx,st.hy,C_D,1.0,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_P,24,8,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 全屏变暗 */
    var d=darkA+(nightT>0?Math.sin(Math.min(1,(t-nightT)/500)*3.14)*0.3:0);
    if(d>0){ ctx.fillStyle='rgba(6,4,18,'+d+')'; ctx.fillRect(0,0,st.vw,st.barBot+18); }
    /* 阴影之手(②幕从地面升起) */
    for(var hi=0;hi<hands.length;hi++){ var h=hands[hi];
      if(t>=h.ts&&t<h.ts+330){ var pr=(t-h.ts)/330;
        var rise=pr<0.55?pr/0.55:1;
        var a=pr>0.82?(1-pr)/0.18:1;
        drawHand(ctx,h.x,st.hy+48*sz-rise*36*sz,1.6*sz*rise,rnd(-0.03,0.03),a);
      } }
    /* 永夜千手(④幕: 上方一排手压下) */
    if(nightT>0&&t-nightT<820){ var pr2=(t-nightT)/820;
      var drop=Math.min(1,pr2/0.6);
      for(var k=0;k<6;k++){ var hx2=st.hx+(k-2.5)*34*sz;
        drawHand(ctx,hx2,st.hy-120*sz+drop*105*sz,1.4*sz,3.14+rnd(-0.05,0.05),pr2>0.85?(1-pr2)/0.15:0.95);
      }
    }
  },
  glow:function(st){}});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑳星核泰坦·虚空造物主 —— 回收吸入+矿石巨锤+废料风暴+光核过载 */
function fxTaitan(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,80,60', C_O='255,150,60', C_M='170,180,200';
  var hammerT=-1, debris=[], coreT=-1;
  function drawHammer(ctx,x,y,s,rot,a){ /* 矿石巨锤(废料拼接) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    var hg=ctx.createLinearGradient(0,-8,0,60); hg.addColorStop(0,'#5a6070'); hg.addColorStop(1,'#33383f');
    ctx.fillStyle=hg; ctx.fillRect(-4,-6,8,66);
    ctx.fillStyle='#2a2e36';
    ctx.beginPath(); ctx.moveTo(-26,-34); ctx.lineTo(24,-38); ctx.lineTo(30,-10); ctx.lineTo(20,-2); ctx.lineTo(-22,-6); ctx.lineTo(-30,-20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#6a7280'; ctx.lineWidth=1.6; ctx.stroke();
    ctx.strokeStyle='#8a94a4'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-16,-30); ctx.lineTo(-8,-8); ctx.moveTo(6,-36); ctx.lineTo(10,-4); ctx.stroke();
    ctx.fillStyle='#ff5040'; ctx.shadowBlur=8; ctx.shadowColor='#ff5040';
    ctx.beginPath(); ctx.arc(0,-20,4,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return debris.length>0||(coreT>0&&st.t-coreT<760); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-800 回收协议: 吸入粒子流 */
    if(t<800&&Math.random()<0.75)F.suck(st.P,st.bx+rnd(-150,150)*sz,st.by+rnd(-120,120)*sz,st.bx,st.by,Math.random()<0.5?C_M:C_O,sz);
    /* ②900 巨锤砸击 */
    if(!st.fired.ham&&t>=900){ st.fired.ham=1; hammerT=t; }
    if(!st.fired.hamhit&&hammerT>0&&t-hammerT>=330){ st.fired.hamhit=1;
      F.flash(st.P,st.hx,st.hy,C_O,50*sz,240);
      F.burst(st.P,st.hx,st.hy,C_O,16,7.5,sz); F.ring(st.P,st.hx,st.hy,C_R,1.3,4*sz);
      F.shards(st.P,st.hx,st.hy,C_M,12,sz);
      st.fire();
    }
    /* ③1900 废料风暴(碎金属块环射) */
    if(!st.fired.deb&&t>=1900){ st.fired.deb=1;
      for(var i=0;i<12;i++){ debris.push({x:st.bx+rnd(-70,70)*sz,y:st.by+rnd(-60,60)*sz,tx:st.hx+rnd(-64,64)*sz,ty:st.hy+rnd(-30,30)*sz,p:0,spd:rnd(0.0018,0.003),rot:rnd(0,6.28),vrot:rnd(-0.3,0.3),w:rnd(6,12)*sz,delay:i*55}); }
    }
    for(var di=debris.length-1;di>=0;di--){ var d=debris[di];
      if(d.delay>0){d.delay-=st.dt;continue;}
      d.p+=d.spd*st.dt; d.rot+=d.vrot;
      if(d.p>=1){ F.burst(st.P,d.tx,d.ty,C_O,4,4.5,st.sz); debris.splice(di,1); }
    }
    /* ④2750 光核过载: 电磁涟漪+暗红射线 */
    if(!st.fired.core&&t>=2750){ st.fired.core=1; coreT=t;
      F.flash(st.P,st.hx,st.hy,C_R,64*sz,300);
      F.ring(st.P,st.hx,st.hy,C_R,1.7,5.5*sz); F.ring(st.P,st.hx,st.hy,C_O,1.1,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_R,26,8.5,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 巨锤(②幕: 举起→砸下) */
    if(hammerT>0&&t-hammerT<560){ var pr=(t-hammerT)/560;
      var swing=pr<0.6?(-1.6+pr/0.6*2.1):0.5-(pr-0.6)*0.3;
      var a=pr>0.85?(1-pr)/0.15:1;
      drawHammer(ctx,st.hx-10*sz,st.hy-30*sz,1.4*sz,swing,a);
    }
    /* 废料块 */
    for(var di=0;di<debris.length;di++){ var d=debris[di]; if(d.delay>0)continue;
      var x=d.x+(d.tx-d.x)*d.p, y=d.y+(d.ty-d.y)*d.p;
      ctx.save(); ctx.translate(x,y); ctx.rotate(d.rot);
      var dg=ctx.createLinearGradient(-d.w/2,0,d.w/2,0); dg.addColorStop(0,'#3a4048'); dg.addColorStop(.5,'#7a8492'); dg.addColorStop(1,'#2e333a');
      ctx.fillStyle=dg;
      ctx.beginPath(); ctx.moveTo(-d.w/2,-d.w*0.3); ctx.lineTo(d.w*0.35,-d.w*0.5); ctx.lineTo(d.w/2,d.w*0.25); ctx.lineTo(-d.w*0.25,d.w*0.45); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#98a2b0'; ctx.lineWidth=0.9; ctx.stroke();
      ctx.restore();
      if(Math.random()<0.25)F.jet(st.P,x,y,Math.atan2(d.y-d.ty,d.x-d.tx),0.3,C_O,1,2,st.sz);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 光核过载电磁涟漪(六边形环) */
    if(coreT>0&&t-coreT<760){ var pr=(t-coreT)/760;
      for(var w2=0;w2<3;w2++){ var rp=pr-w2*0.14; if(rp<0||rp>1)continue;
        var R=rp*120*sz;
        ctx.strokeStyle=g(C_R+','+(0.75*(1-rp))); ctx.lineWidth=(3.4-w2)*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_R+',1');
        ctx.beginPath();
        for(var v=0;v<=6;v++){ var va=v/6*6.283-1.57;
          var vx=st.hx+Math.cos(va)*R, vy=st.hy+Math.sin(va)*R*0.72;
          if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
        ctx.closePath(); ctx.stroke(); ctx.shadowBlur=0; }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉑月之引航者·寂静潮汐 —— 新月悬起+银潮涌动+月光刃雨+满月引潮 */
function fxYueshen(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_S='200,220,255', C_W='240,248,255';
  var moonP=0, blades=[], tideT=-1, fullT=-1;
  function drawCrescent(ctx,x,y,s,rot,a,phase){ /* 月牙(phase 0新月→1满月) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#e8f0ff'; ctx.shadowBlur=14; ctx.shadowColor='#bcd4ff';
    ctx.beginPath(); ctx.arc(0,0,13,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    if(phase<0.95){ ctx.globalCompositeOperation='destination-out';
      ctx.beginPath(); ctx.arc(9-phase*18,0,12,0,6.283); ctx.fill();
      ctx.globalCompositeOperation='source-over'; }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return blades.length>0||(fullT>0&&st.t-fullT<800); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    moonP=Math.min(1,Math.max(0,(t-2400)/500));
    /* ①0-600 新月悬起+月尘 */
    if(t<700&&Math.random()<0.5)F.suck(st.P,st.bx+rnd(-100,100)*sz,st.by+rnd(-90,60)*sz,st.bx+70*sz,st.by-90*sz,C_S,sz);
    /* ②750 银色潮汐涌动(一道银浪从boss侧扫向勇者) */
    if(!st.fired.tide&&t>=750){ st.fired.tide=1; tideT=t; st.fire(); }
    if(!st.fired.tidehit&&tideT>0&&t-tideT>=420){ st.fired.tidehit=1;
      F.burst(st.P,st.hx,st.hy,C_S,12,6,sz); F.ring(st.P,st.hx,st.hy,C_S,1.0,3*sz);
    }
    /* ③1750 月光新月刃三连射 */
    if(!st.fired.bl&&t>=1750){ st.fired.bl=1;
      for(var i=0;i<3;i++)blades.push({p:0,spd:rnd(0.0028,0.0038),off:(i-1)*24,delay:i*160,rot:0});
    }
    for(var bi=blades.length-1;bi>=0;bi--){ var b=blades[bi];
      if(b.delay>0){b.delay-=st.dt;continue;}
      b.p+=b.spd*st.dt; b.rot+=st.dt*0.012;
      if(b.p>=1){ F.burst(st.P,st.hx,st.hy,C_W,7,5.5,st.sz); F.ring(st.P,st.hx,st.hy,C_S,0.8,2.5*st.sz); blades.splice(bi,1); }
    }
    /* ④2900 满月引潮: 大银潮压来 */
    if(!st.fired.full&&t>=2900){ st.fired.full=1; fullT=t;
      F.flash(st.P,st.hx,st.hy,C_W,60*sz,300);
      F.ring(st.P,st.hx,st.hy,C_S,1.7,5.5*sz); F.ring(st.P,st.hx,st.hy,C_W,1.1,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_S,24,8,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 悬空月(新月→满月) */
    if(t>120)drawCrescent(ctx,st.bx+70*sz,st.by-95*sz,1.7*sz,-0.4,Math.min(1,(t-120)/300),moonP);
    /* 飞行新月刃 */
    for(var bi=0;bi<blades.length;bi++){ var b=blades[bi]; if(b.delay>0)continue;
      var x=st.bx+(st.hx-st.bx)*b.p, y=st.by-60*sz+(st.hy+b.off*sz-(st.by-60*sz))*b.p;
      drawCrescent(ctx,x,y,0.9*sz,b.rot,1,0.15);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 银潮(②幕: 银色波浪带扫过) */
    function wave(x0,amp,alpha,wl){
      ctx.beginPath();
      for(var v=0;v<=36;v++){ var yy=st.hy-60*sz+v/36*120*sz;
        var xx=x0+Math.sin(yy*0.05+t*0.008)*amp;
        if(v===0)ctx.moveTo(xx,yy); else ctx.lineTo(xx,yy); }
      ctx.strokeStyle=g(C_S+','+alpha); ctx.lineWidth=wl; ctx.shadowBlur=12; ctx.shadowColor=g(C_S+',1');
      ctx.stroke(); ctx.shadowBlur=0;
    }
    if(tideT>0&&t-tideT<560){ var pr=(t-tideT)/560;
      var x0=st.bx+(st.hx+40*sz-st.bx)*pr;
      wave(x0,8*sz,0.8*Math.sin(pr*3.14),4*sz); wave(x0-14*sz,6*sz,0.5*Math.sin(pr*3.14),2.5*sz);
      if(Math.random()<0.6)F.burst(st.P,x0,st.hy+rnd(-40,40)*sz,C_S,1,2.5,sz);
    }
    /* 满月大潮(④幕: 三重银浪压来) */
    if(fullT>0&&t-fullT<800){ var pr2=(t-fullT)/800;
      for(var w2=0;w2<3;w2++){ var rp=pr2-w2*0.13; if(rp<0||rp>1)continue;
        var x02=st.hx-140*sz+rp*140*sz;
        wave(x02,10*sz,0.7*(1-rp),(5-w2)*sz); }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉒混沌之种·万象侵蚀者 —— 混沌海翻涌+触须八方+同化侵蚀+万象吞噬 */
function fxHundun(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_P='190,80,255', C_G2='120,255,140', C_D='90,40,140';
  var seaA=0, tents=[], patches=[], vortexT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return vortexT>0&&st.t-vortexT<820; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    seaA=Math.min(1,t/700);
    /* ②800起 触须从八方伸向勇者 */
    if(!st.fired.tent&&t>=800){ st.fired.tent=1;
      for(var i=0;i<6;i++){ var a=i/6*6.283+0.3;
        tents.push({ts:800+i*160,ang:a,done:false,wig:rnd(0.5,1.2)}); }
      st.fire();
    }
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(!tn.done&&t>=tn.ts+300){ tn.done=true;
        F.burst(st.P,st.hx,st.hy,C_P,6,5,sz);
      } }
    /* ③2100 同化侵蚀: 扭曲色块贴上勇者区 */
    if(!st.fired.pat&&t>=2100){ st.fired.pat=1;
      for(var k=0;k<7;k++)patches.push({x:st.hx+rnd(-46,46)*sz,y:st.hy+rnd(-30,30)*sz,r:rnd(7,15)*sz,life:0,max:rnd(800,1200),col:k%2?C_P:C_G2,ph:rnd(0,6.28)});
      F.ring(st.P,st.hx,st.hy,C_G2,0.9,3*sz);
    }
    /* ④2850 万象吞噬: 漩涡吸入+爆 */
    if(!st.fired.vor&&t>=2850){ st.fired.vor=1; vortexT=t;
      for(var q=0;q<14;q++)F.suck(st.P,st.hx+rnd(-100,100)*sz,st.hy+rnd(-70,70)*sz,st.hx,st.hy,q%2?C_P:C_G2,sz);
      F.flash(st.P,st.hx,st.hy,C_P,62*sz,300);
      F.ring(st.P,st.hx,st.hy,C_P,1.7,5.5*sz); F.burst(st.P,st.hx,st.hy,C_G2,22,8,sz);
    }
    for(var pi=patches.length-1;pi>=0;pi--){ patches[pi].life+=st.dt; if(patches[pi].life>patches[pi].max)patches.splice(pi,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 混沌之海(底部翻涌暗紫波) */
    if(seaA>0){ var y0=st.barBot-6;
      ctx.save(); ctx.globalAlpha=seaA*0.85;
      var sg=ctx.createLinearGradient(0,y0-36*sz,0,y0+18);
      sg.addColorStop(0,'rgba(90,40,140,0)'); sg.addColorStop(1,'rgba(50,18,90,0.85)');
      ctx.fillStyle=sg;
      ctx.beginPath(); ctx.moveTo(0,y0+18);
      for(var v=0;v<=30;v++){ var xx=v/30*st.vw;
        ctx.lineTo(xx,y0-14*sz+Math.sin(xx*0.03+t*0.004)*9*sz+Math.sin(xx*0.011-t*0.002)*5*sz); }
      ctx.lineTo(st.vw,y0+18); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    /* 触须(蜿蜒实体·暗紫粗线) */
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(t>=tn.ts&&t<tn.ts+380){ var pr=(t-tn.ts)/380;
        var reach=pr<0.6?pr/0.6:1-(pr-0.6)/0.4*0.15;
        var a=pr>0.85?(1-pr)/0.15:0.95;
        var x0=st.hx+Math.cos(tn.ang)*170*sz, y0b=st.hy+Math.sin(tn.ang)*110*sz;
        ctx.save(); ctx.globalAlpha=a;
        ctx.strokeStyle='#3a1a66'; ctx.lineWidth=8*sz; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(x0,y0b);
        var segs=6;
        for(var s2=1;s2<=segs;s2++){ var p2=s2/segs*reach;
          var xx2=x0+(st.hx-x0)*p2+Math.sin(p2*8+t*0.01)*16*sz*tn.wig*(1-p2);
          var yy2=y0b+(st.hy-y0b)*p2+Math.cos(p2*7+t*0.012)*12*sz*tn.wig*(1-p2);
          ctx.lineTo(xx2,yy2); }
        ctx.stroke();
        ctx.strokeStyle='rgba(190,80,255,0.75)'; ctx.lineWidth=2.4*sz; ctx.shadowBlur=8; ctx.shadowColor='rgba(190,80,255,1)';
        ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
      } }
    /* 同化色块(扭曲斑) */
    for(var pi=0;pi<patches.length;pi++){ var p3=patches[pi];
      var pr3=p3.life/p3.max, a3=Math.sin(pr3*3.14)*0.75;
      ctx.save(); ctx.globalAlpha=a3; ctx.fillStyle=g(p3.col+',0.8');
      ctx.beginPath();
      for(var v2=0;v2<=10;v2++){ var va=v2/10*6.283;
        var rr=p3.r*(1+Math.sin(va*3+p3.ph+t*0.01)*0.35);
        var vx=p3.x+Math.cos(va)*rr, vy=p3.y+Math.sin(va)*rr;
        if(v2===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
      ctx.closePath(); ctx.fill(); ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 吞噬漩涡(④幕: 旋转螺线) */
    if(vortexT>0&&t-vortexT<820){ var pr=(t-vortexT)/820, env=Math.sin(pr*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(t*0.006);
      for(var arm=0;arm<3;arm++){ ctx.save(); ctx.rotate(arm/3*6.283);
        ctx.strokeStyle=g(C_P+','+(0.7*env)); ctx.lineWidth=3*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_P+',1');
        ctx.beginPath();
        for(var v=0;v<=20;v++){ var va=v/20*4.2, rr=v/20*70*sz*(1-pr*0.4);
          var vx=Math.cos(va)*rr, vy=Math.sin(va)*rr*0.72;
          if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
        ctx.stroke(); ctx.restore(); }
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉓火柴人·原初线条 —— 手绘线条: 画剑成真+涂鸦风暴+橡皮擦除重绘 */
function fxHuochairen(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var strokes=[], drawT=-1, swordT=-1, eraseT=-1;
  function jit(v,sz){ return v+rnd(-1.4,1.4)*sz; } /* 手绘抖动 */
  function sketchLine(ctx,x1,y1,x2,y2,w,a,sz){ /* 手绘质感线(微抖·分段) */
    ctx.save(); ctx.globalAlpha=a; ctx.strokeStyle='#14161c'; ctx.lineWidth=w; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(jit(x1,sz),jit(y1,sz));
    var n=4;
    for(var k=1;k<=n;k++){ var p=k/n;
      ctx.lineTo(jit(x1+(x2-x1)*p,sz),jit(y1+(y2-y1)*p,sz)); }
    ctx.stroke(); ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return eraseT>0&&st.t-eraseT<900; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-800 一笔一画画出攻击预告(勇者周围画圈) */
    if(!st.fired.d1&&t>=100){ st.fired.d1=1; drawT=t; }
    /* ②900 画出巨剑→实体化挥砍 */
    if(!st.fired.sw&&t>=900){ st.fired.sw=1; swordT=t; }
    if(!st.fired.swhit&&swordT>0&&t-swordT>=620){ st.fired.swhit=1;
      F.beam(st.P,st.hx,st.hy,-0.5,'40,45,60',1.4,true);
      F.burst(st.P,st.hx,st.hy,'80,90,120',14,7,sz); F.ring(st.P,st.hx,st.hy,'60,70,100',1.1,3.5*sz);
      st.fire();
    }
    /* ③2000 涂鸦风暴(乱线飞向勇者) */
    if(!st.fired.scr&&t>=2000){ st.fired.scr=1;
      for(var i=0;i<9;i++){ strokes.push({x:st.bx+rnd(-60,60)*sz,y:st.by+rnd(-50,50)*sz,tx:st.hx+rnd(-50,50)*sz,ty:st.hy+rnd(-28,28)*sz,p:0,spd:rnd(0.0022,0.0034),seed:rnd(0,100),delay:i*70}); }
    }
    for(var si=strokes.length-1;si>=0;si--){ var s2=strokes[si];
      if(s2.delay>0){s2.delay-=st.dt;continue;}
      s2.p+=s2.spd*st.dt;
      if(s2.p>=1){ F.burst(st.P,s2.tx,s2.ty,'70,80,110',4,4.5,st.sz); strokes.splice(si,1); }
    }
    /* ④2800 橡皮擦除: 白色擦除带横扫勇者+重绘冲击 */
    if(!st.fired.er&&t>=2800){ st.fired.er=1; eraseT=t; }
    if(!st.fired.erboom&&eraseT>0&&t-eraseT>=520){ st.fired.erboom=1;
      F.flash(st.P,st.hx,st.hy,'220,225,240',58*sz,280);
      F.ring(st.P,st.hx,st.hy,'150,160,190',1.5,5*sz);
      F.burst(st.P,st.hx,st.hy,'110,120,150',20,7.5,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* ①画圈预告(围勇者手绘椭圆·逐段) */
    if(drawT>0&&t-drawT<2600){ var pr=Math.min(1,(t-drawT)/650);
      ctx.save(); ctx.strokeStyle='#14161c'; ctx.lineWidth=2.2*sz; ctx.lineCap='round';
      ctx.globalAlpha=t-drawT>2200?(2600-(t-drawT))/400:0.9;
      ctx.beginPath();
      var n=Math.floor(30*pr);
      for(var v=0;v<=n;v++){ var va=v/30*6.283-1.57;
        var vx=jit(st.hx+Math.cos(va)*58*sz,sz), vy=jit(st.hy+Math.sin(va)*36*sz,sz);
        if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
      ctx.stroke(); ctx.restore();
    }
    /* ②画剑(先勾线稿→挥下) */
    if(swordT>0&&t-swordT<720){ var pr2=(t-swordT)/720;
      var bx2=st.hx+50*sz, by2=st.hy-80*sz;
      ctx.save();
      if(pr2<0.55){ var dp=pr2/0.55; /* 线稿逐笔 */
        var steps=[[0,30,0,-30],[0,-30,-6,-40],[0,-30,6,-40],[-10,22,10,22],[0,30,0,44]];
        var done=Math.ceil(steps.length*dp);
        ctx.translate(bx2,by2);
        for(var k2=0;k2<done;k2++){ var s3=steps[k2];
          sketchLine(ctx,s3[0]*sz,s3[1]*sz,s3[2]*sz,s3[3]*sz,3*sz,1,sz); }
      } else { /* 实体化挥砍 */
        var swp=(pr2-0.55)/0.45;
        ctx.translate(st.hx,st.hy); ctx.rotate(-1.5+swp*2.4);
        ctx.globalAlpha=swp>0.85?(1-swp)/0.15:1;
        sketchLine(ctx,0,30*sz,0,-42*sz,4*sz,1,sz);
        sketchLine(ctx,0,-30*sz,-6*sz,-42*sz,3*sz,1,sz);
        sketchLine(ctx,0,-30*sz,6*sz,-42*sz,3*sz,1,sz);
        sketchLine(ctx,-10*sz,22*sz,10*sz,22*sz,3.4*sz,1,sz);
      }
      ctx.restore();
    }
    /* ③涂鸦乱线(飞行的团状scribble) */
    for(var si=0;si<strokes.length;si++){ var s2=strokes[si]; if(s2.delay>0)continue;
      var x=s2.x+(s2.tx-s2.x)*s2.p, y=s2.y+(s2.ty-s2.y)*s2.p;
      ctx.save(); ctx.translate(x,y); ctx.strokeStyle='#14161c'; ctx.lineWidth=1.8*sz; ctx.globalAlpha=0.92;
      ctx.beginPath();
      for(var v2=0;v2<=8;v2++){ var va2=(v2+s2.seed)*2.4;
        var vx2=Math.cos(va2)*(4+v2*1.1)*sz, vy2=Math.sin(va2)*(4+v2*0.9)*sz;
        if(v2===0)ctx.moveTo(vx2,vy2); else ctx.lineTo(vx2,vy2); }
      ctx.stroke(); ctx.restore(); }
    /* ④橡皮擦除带(白色矩形横扫+皮屑) */
    if(eraseT>0&&t-eraseT<640){ var pr4=(t-eraseT)/640;
      var ex=st.hx-120*sz+pr4*240*sz;
      ctx.save(); ctx.globalAlpha=0.9;
      ctx.fillStyle='#f2f0ea'; ctx.strokeStyle='#c8c2b4'; ctx.lineWidth=1.4*sz;
      ctx.translate(ex,st.hy); ctx.rotate(-0.2);
      ctx.fillRect(-16*sz,-24*sz,32*sz,48*sz); ctx.strokeRect(-16*sz,-24*sz,32*sz,48*sz);
      ctx.fillStyle='#3a6ea8'; ctx.fillRect(-16*sz,-24*sz,32*sz,10*sz);
      ctx.restore();
      if(Math.random()<0.7){ F.jet(st.P,ex,st.hy+rnd(-20,20)*sz,1.57,0.9,'160,155,140',2,2,sz); }
      /* 擦白痕迹 */
      ctx.save(); ctx.globalAlpha=0.35*Math.sin(pr4*3.14);
      ctx.fillStyle='#fff';
      ctx.fillRect(st.hx-120*sz,st.hy-26*sz,(ex-(st.hx-120*sz)),52*sz);
      ctx.restore();
    }
  },
  glow:function(st){}});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉔画壁判官·墨渊 —— 墨线战术网格+锁定标记+纹身墨蛇+判决落笔墨爆 */
function fxMoyuan(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_I='40,44,60', C_R='255,80,60';
  var gridT=-1, lockT=-1, snakes=[], verdictT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return verdictT>0&&st.t-verdictT<780; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    if(!st.fired.grid&&t>=100){ st.fired.grid=1; gridT=t; }
    /* ②900 锁定框+弹道预测线 */
    if(!st.fired.lock&&t>=900){ st.fired.lock=1; lockT=t; st.fire(); }
    if(!st.fired.lockhit&&lockT>0&&t-lockT>=520){ st.fired.lockhit=1;
      F.burst(st.P,st.hx,st.hy,'120,130,170',10,6,sz); F.ring(st.P,st.hx,st.hy,'120,130,170',0.9,3*sz);
    }
    /* ③1850 纹身墨蛇两条缠向勇者 */
    if(!st.fired.snk&&t>=1850){ st.fired.snk=1;
      for(var i=0;i<2;i++)snakes.push({p:0,spd:rnd(0.0011,0.0015),side:i?1:-1,trail:[],delay:i*180});
    }
    for(var si=snakes.length-1;si>=0;si--){ var sn=snakes[si];
      if(sn.delay>0){sn.delay-=st.dt;continue;}
      sn.p+=sn.spd*st.dt;
      var x=st.bx+(st.hx-st.bx)*sn.p, y=st.by+(st.hy-st.by)*sn.p+Math.sin(sn.p*10)*24*sz*sn.side*(1-sn.p*0.5);
      sn.trail.push({x:x,y:y}); if(sn.trail.length>16)sn.trail.shift();
      if(sn.p>=1){ F.burst(st.P,st.hx,st.hy,'60,66,90',7,5,st.sz); snakes.splice(si,1); }
    }
    /* ④2750 判决落笔: 巨笔从上落下+墨爆 */
    if(!st.fired.ver&&t>=2750){ st.fired.ver=1; verdictT=t; }
    if(!st.fired.vboom&&verdictT>0&&t-verdictT>=380){ st.fired.vboom=1;
      F.flash(st.P,st.hx,st.hy,'110,120,160',54*sz,280);
      F.burst(st.P,st.hx,st.hy,'50,56,80',24,8,sz); F.ring(st.P,st.hx,st.hy,'90,98,130',1.4,4.5*sz);
      F.shards(st.P,st.hx,st.hy,'70,76,104',12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 战术网格(墨线逐格画出) */
    if(gridT>0&&t-gridT<2500){ var pr=Math.min(1,(t-gridT)/700);
      var a=t-gridT>2100?(2500-(t-gridT))/400:0.7;
      ctx.save(); ctx.globalAlpha=Math.max(0,a);
      ctx.strokeStyle='rgba(40,44,60,0.85)'; ctx.lineWidth=1*sz;
      var x0=st.hx-80*sz, y0=st.hy-52*sz, w=160*sz, h=104*sz;
      var nn=Math.floor(4*pr)+1;
      for(var k=0;k<=nn;k++){ ctx.beginPath(); ctx.moveTo(x0+k/4*w,y0); ctx.lineTo(x0+k/4*w,y0+h); ctx.stroke(); }
      for(var k2=0;k2<=Math.floor(3*pr);k2++){ ctx.beginPath(); ctx.moveTo(x0,y0+k2/3*h); ctx.lineTo(x0+w,y0+k2/3*h); ctx.stroke(); }
      /* 坐标标注 */
      ctx.fillStyle='rgba(40,44,60,0.9)'; ctx.font=(8*sz)+'px monospace';
      if(pr>0.5){ ctx.fillText('A3',x0+3*sz,y0+11*sz); ctx.fillText('D2',x0+w-16*sz,y0+h-5*sz); }
      ctx.restore();
    }
    /* 墨蛇 */
    for(var si=0;si<snakes.length;si++){ var sn=snakes[si]; if(sn.trail.length<2)continue;
      ctx.save();
      for(var q=1;q<sn.trail.length;q++){ var w2=(q/sn.trail.length)*7*sz;
        ctx.strokeStyle='rgba(28,32,48,'+(0.5+q/sn.trail.length*0.45)+')'; ctx.lineWidth=w2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(sn.trail[q-1].x,sn.trail[q-1].y); ctx.lineTo(sn.trail[q].x,sn.trail[q].y); ctx.stroke(); }
      var hd=sn.trail[sn.trail.length-1];
      ctx.fillStyle='#1c2030'; ctx.beginPath(); ctx.arc(hd.x,hd.y,4.5*sz,0,6.283); ctx.fill();
      ctx.fillStyle='#ff5040'; ctx.beginPath(); ctx.arc(hd.x+2*sz,hd.y-1*sz,1.2*sz,0,6.283); ctx.fill();
      ctx.restore(); }
    /* 判决巨笔落下 */
    if(verdictT>0&&t-verdictT<600){ var pr3=(t-verdictT)/600;
      var drop=Math.min(1,pr3/0.55);
      var y=st.hy-150*sz+drop*140*sz;
      var a2=pr3>0.85?(1-pr3)/0.15:1;
      ctx.save(); ctx.globalAlpha=a2; ctx.translate(st.hx,y); ctx.rotate(0.35);
      var bg=ctx.createLinearGradient(0,-64*sz,0,0); bg.addColorStop(0,'#2a3040'); bg.addColorStop(1,'#4a5268');
      ctx.fillStyle=bg; ctx.fillRect(-4*sz,-70*sz,8*sz,54*sz);
      ctx.fillStyle='#14161f';
      ctx.beginPath(); ctx.moveTo(-4*sz,-16*sz); ctx.lineTo(0,4*sz); ctx.lineTo(4*sz,-16*sz); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    /* 墨爆溅点(实体墨渍) */
    if(verdictT>0&&t-verdictT>=380&&t-verdictT<900){ var pr4=(t-verdictT-380)/520;
      ctx.save(); ctx.globalAlpha=1-pr4;
      ctx.fillStyle='#1c2030';
      for(var b2=0;b2<7;b2++){ var ba=b2/7*6.283+0.4, br2=(14+b2*7)*sz*Math.min(1,pr4*2.5);
        ctx.beginPath(); ctx.ellipse(st.hx+Math.cos(ba)*br2,st.hy+Math.sin(ba)*br2*0.6,(5-b2*0.5)*sz,(3.4-b2*0.3)*sz,ba,0,6.283); ctx.fill(); }
      ctx.restore();
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 锁定框+弹道线(红) */
    if(lockT>0&&t-lockT<700){ var pr=(t-lockT)/700, env=Math.sin(pr*3.14);
      ctx.save(); ctx.strokeStyle=g(C_R+','+(0.8*env)); ctx.lineWidth=1.4*sz;
      var R=30*sz;
      ctx.strokeRect(st.hx-R,st.hy-R*0.72,R*2,R*1.44);
      ctx.setLineDash([6*sz,5*sz]);
      ctx.beginPath(); ctx.moveTo(st.bx,st.by); ctx.lineTo(st.hx,st.hy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font=(9*sz)+'px monospace'; ctx.fillStyle=g(C_R+','+env);
      ctx.fillText('LOCKED',st.hx+R+4*sz,st.hy-R*0.72+8*sz);
      ctx.restore();
    }
    /* 军牌闪光(④幕后: 七枚小牌短暂浮现) */
    if(verdictT>0&&t-verdictT>=380&&t-verdictT<820){ var pr2=(t-verdictT-380)/440, a3=Math.sin(pr2*3.14);
      ctx.save(); ctx.globalAlpha=a3*0.85;
      for(var k3=0;k3<7;k3++){ var kx=st.hx+(k3-3)*17*sz, ky=st.hy-58*sz+Math.sin(k3*1.4)*5*sz;
        ctx.fillStyle='rgba(200,208,225,0.9)'; ctx.fillRect(kx-5*sz,ky-3*sz,10*sz,6*sz);
        ctx.strokeStyle='rgba(120,130,160,1)'; ctx.lineWidth=0.7*sz; ctx.strokeRect(kx-5*sz,ky-3*sz,10*sz,6*sz); }
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
