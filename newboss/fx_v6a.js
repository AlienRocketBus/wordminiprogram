/* ═══ v6a 重做(覆盖旧版): 流亡之刃(绝地武士·原力) / 战争铁砧(导弹马戏) ═══ */

/* ㉜v6 星陨武士·流亡之刃 —— 原力悬石→光剑凌空四连斩(扇形拖尾弧)→原力推→原力握持+终结下劈 */
function fxLiuwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_S='170,215,255', C_W='240,250,255', C_P='190,140,255';
  var rocks=[], swings=[], pushT=-1, holdT=-1, finT=-1;
  function drawSaber(ctx,cx,cy,r0,r1,ang,a,col){ /* 实体光剑: 金属剑柄+光刃(沿半径向外) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(cx,cy); ctx.rotate(ang);
    /* 剑柄(r0内侧) */
    var hg=ctx.createLinearGradient(r0-16,0,r0,0); hg.addColorStop(0,'#3a4254'); hg.addColorStop(.5,'#8a96aa'); hg.addColorStop(1,'#4a5468');
    ctx.fillStyle=hg; ctx.fillRect(r0-17,-2.6,17,5.2);
    ctx.fillStyle='#1c222e'; ctx.fillRect(r0-13,-3.4,2.4,6.8); ctx.fillRect(r0-7,-3.4,2.4,6.8);
    ctx.fillStyle='#c8341e'; ctx.fillRect(r0-16,-1,2.2,2);
    /* 光刃 */
    ctx.save(); ctx.shadowBlur=16; ctx.shadowColor=col;
    ctx.strokeStyle=col; ctx.lineWidth=7; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(r0,0); ctx.lineTo(r1,0); ctx.stroke();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.6; ctx.shadowBlur=8;
    ctx.beginPath(); ctx.moveTo(r0,0); ctx.lineTo(r1,0); ctx.stroke();
    ctx.restore(); ctx.restore();
  }
  function drawSwingArc(ctx,cx,cy,r0,r1,a0,cur,col,alpha){ /* 挥砍扇形拖尾(尾淡头亮) */
    var steps=16, span=cur-a0;
    for(var i=0;i<steps;i++){ var p=i/steps;
      var aa=a0+span*p, ab=a0+span*(p+1/steps)*1.02;
      var al=alpha*Math.pow(p,1.6)*0.75;
      if(al<=0.01)continue;
      ctx.fillStyle='rgba('+col+','+al+')';
      ctx.beginPath();
      ctx.arc(cx,cy,r1,aa,ab); ctx.arc(cx,cy,r0,ab,aa,true);
      ctx.closePath(); ctx.fill();
    }
    /* 外缘亮线 */
    ctx.strokeStyle='rgba(255,255,255,'+(alpha*0.7)+')'; ctx.lineWidth=1.6;
    ctx.shadowBlur=10; ctx.shadowColor='rgba('+col+',1)';
    ctx.beginPath(); ctx.arc(cx,cy,r1-2,a0+span*0.45,cur); ctx.stroke(); ctx.shadowBlur=0;
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6500,endMs:4600,
  busy:function(st){ return finT>0&&st.t-finT<950; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-600 原力悬石: 碎石从勇者区下方缓缓浮起 */
    if(!st.fired.rk&&t>=120){ st.fired.rk=1;
      for(var i=0;i<6;i++)rocks.push({x:st.hx+rnd(-78,78)*sz,y:st.hy+rnd(26,44)*sz,ty:st.hy+rnd(-34,10)*sz,p:0,rot:rnd(0,6.28),vrot:rnd(-0.02,0.02),w:rnd(5,10)*sz,ph:rnd(0,6.28),flung:false,vx:0,vy:0});
    }
    for(var ri=rocks.length-1;ri>=0;ri--){ var R2=rocks[ri];
      if(R2.flung){ R2.vy+=0.014*st.dt; R2.x+=R2.vx*st.dt*0.06; R2.y+=R2.vy*st.dt*0.06; R2.rot+=R2.vrot*4;
        if(R2.y>st.barBot+30||R2.x<-40||R2.x>st.vw+40)rocks.splice(ri,1); }
      else { R2.p=Math.min(1,R2.p+st.dt*0.0009); R2.rot+=R2.vrot*st.dt*0.06; }
    }
    /* ②700起 光剑凌空四连斩 */
    if(!st.fired.sw&&t>=700){ st.fired.sw=1;
      var defs=[[-2.4,0.5,300],[3.6,0.9,280],[1.9,-1.3,300],[-3.2,-0.35,280]];
      for(var k=0;k<4;k++)swings.push({ts:700+k*330,a0:defs[k][0],a1:defs[k][1],dur:defs[k][2],col:k===2?C_P:C_S,done:false});
      st.fire();
    }
    for(var si=0;si<swings.length;si++){ var s2=swings[si];
      if(!s2.done&&t>=s2.ts+s2.dur*0.62){ s2.done=true;
        F.burst(st.P,st.hx+Math.cos((s2.a0+s2.a1)/2)*20*sz,st.hy+Math.sin((s2.a0+s2.a1)/2)*14*sz,s2.col,9,6,sz);
        F.ring(st.P,st.hx,st.hy,s2.col,0.75,2.4*sz);
      } }
    /* ③2250 原力推: 扭曲波环从boss推来 */
    if(!st.fired.push&&t>=2250){ st.fired.push=1; pushT=t; }
    if(!st.fired.pushhit&&pushT>0&&t-pushT>=340){ st.fired.pushhit=1;
      F.flash(st.P,st.hx,st.hy,C_S,46*sz,240);
      F.ring(st.P,st.hx,st.hy,C_S,1.6,4.8*sz); F.ring(st.P,st.hx,st.hy,C_W,1.0,3.2*sz);
      F.burst(st.P,st.hx,st.hy,C_S,16,7.5,sz);
      for(var q2=0;q2<8;q2++)F.jet(st.P,st.hx+rnd(-50,50)*sz,st.hy+30*sz,-1.57+rnd(-0.7,0.7),0.5,'170,165,150',2,5,sz);
      for(var ri2=0;ri2<rocks.length;ri2++){ var R3=rocks[ri2]; R3.flung=true;
        var fa=Math.atan2(R3.y-st.hy,R3.x-st.hx)+rnd(-0.3,0.3);
        R3.vx=Math.cos(fa)*rnd(3,5.5); R3.vy=Math.sin(fa)*rnd(3,5.5)-2; }
    }
    /* ④2950 原力握持(束缚环收缩)→3520 终结下劈 */
    if(!st.fired.hold&&t>=2950){ st.fired.hold=1; holdT=t;
      F.ring(st.P,st.hx,st.hy,C_P,0.9,2.6*sz);
    }
    if(!st.fired.fin&&t>=3520){ st.fired.fin=1; finT=t;
      swings.push({ts:t,a0:-1.57-1.35,a1:-1.57+1.25,dur:300,col:C_W,done:false,big:true});
    }
    if(!st.fired.finboom&&finT>0&&t-finT>=210){ st.fired.finboom=1;
      F.flash(st.P,st.hx,st.hy,C_W,60*sz,300);
      F.ring(st.P,st.hx,st.hy,C_S,1.8,5.6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.2,3.8*sz);
      F.burst(st.P,st.hx,st.hy,C_S,26,9,sz); F.shards(st.P,st.hx,st.hy,C_W,12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 原力悬石(实体碎石·缓浮微旋) */
    for(var ri=0;ri<rocks.length;ri++){ var R2=rocks[ri];
      var y=R2.flung?R2.y:R2.y+(R2.ty-R2.y)*R2.p+Math.sin(R2.ph+t*0.003)*3*sz;
      ctx.save(); ctx.translate(R2.x,y); ctx.rotate(R2.rot);
      var rg=ctx.createLinearGradient(-R2.w/2,0,R2.w/2,0); rg.addColorStop(0,'#5a5850'); rg.addColorStop(.5,'#8a877c'); rg.addColorStop(1,'#48463e');
      ctx.fillStyle=rg; ctx.strokeStyle='#2e2c26'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(-R2.w/2,-R2.w*0.28); ctx.lineTo(R2.w*0.3,-R2.w*0.48); ctx.lineTo(R2.w/2,R2.w*0.2); ctx.lineTo(-R2.w*0.2,R2.w*0.44); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 原力微光 */
      if(!R2.flung){ ctx.strokeStyle='rgba(170,215,255,'+(0.3+Math.sin(t*0.006+R2.ph)*0.2)+')'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(0,0,R2.w*0.85,0,6.283); ctx.stroke(); }
      ctx.restore();
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 光剑挥砍(拖尾弧+实体剑) */
    for(var si=0;si<swings.length;si++){ var s2=swings[si];
      var age=t-s2.ts; if(age<0||age>s2.dur+180)continue;
      var pr=Math.min(1,age/s2.dur);
      var ease=1-Math.pow(1-pr,2.4);
      var cur=s2.a0+(s2.a1-s2.a0)*ease;
      var r0=(s2.big?14:12)*sz, r1=(s2.big?62:50)*sz;
      var fade=age>s2.dur?1-(age-s2.dur)/180:1;
      var colS=s2.col===C_P?'190,140,255':(s2.col===C_W?'240,250,255':'170,215,255');
      drawSwingArc(ctx,st.hx,st.hy,r0,r1,s2.a0,cur,colS,0.85*fade);
      if(age<=s2.dur)drawSaber(ctx,st.hx,st.hy,r0,r1,cur,fade,s2.col===C_P?'#c890ff':(s2.col===C_W?'#f0faff':'#9ecfff'));
    }
    /* 原力推波(扭曲椭圆环从boss推进) */
    if(pushT>0&&t-pushT<420){ var pr2=(t-pushT)/420;
      var px2=st.bx+(st.hx-st.bx)*pr2, py2=st.by+(st.hy-st.by)*pr2;
      for(var w2=0;w2<2;w2++){ var rp=Math.max(0,pr2-w2*0.12);
        ctx.strokeStyle=g(C_S+','+(0.65*(1-pr2)+0.15)); ctx.lineWidth=(3.4-w2)*sz;
        ctx.beginPath();
        for(var v=0;v<=30;v++){ var va=v/30*6.283;
          var wob=Math.sin(va*5+t*0.02)*4*sz;
          var vx=px2+Math.cos(va)*((26+rp*26)*sz+wob), vy=py2+Math.sin(va)*((30+rp*30)*sz+wob)*0.8;
          if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
        ctx.closePath(); ctx.stroke(); }
    }
    /* 原力握持(三圈束缚环收缩+悬停微粒) */
    if(holdT>0&&t-holdT<620){ var pr3=(t-holdT)/620;
      for(var k=0;k<3;k++){ var rp2=Math.max(0,Math.min(1,pr3*1.4-k*0.18));
        if(rp2<=0)continue;
        var R4=(76-rp2*46)*sz;
        ctx.strokeStyle=g(C_P+','+(0.7*rp2)); ctx.lineWidth=1.8*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_P+',1');
        ctx.beginPath(); ctx.ellipse(st.hx,st.hy,R4,R4*0.62,0,0,6.283); ctx.stroke(); ctx.shadowBlur=0; }
      if(Math.random()<0.5){ var ha=rnd(0,6.28);
        ctx.fillStyle=g(C_P+',0.7'); ctx.beginPath();
        ctx.arc(st.hx+Math.cos(ha)*32*sz,st.hy+Math.sin(ha)*22*sz,1.6*sz,0,6.283); ctx.fill(); }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉛v6 武器大师·战争铁砧 —— 机枪压制→导弹马戏(四散→回旋汇聚一点)→军刀→全武库殉爆 */
function fxTiezhan(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_O='255,160,60', C_R='255,70,50', C_B='140,215,255', C_T='255,220,150';
  var mgT=-1, missiles=[], sabT=-1, overT=-1, plates=[], blinkT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6700,endMs:4800,
  busy:function(st){ return missiles.length>0||plates.length>0||(overT>0&&st.t-overT<1100); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①150-1050 架盾机枪压制 */
    if(!st.fired.mg&&t>=150){ st.fired.mg=1; mgT=t; }
    if(mgT>0&&t-mgT<880){
      if(Math.random()<0.42){ var x0=st.bx+64*sz, y0=st.by+2*sz;
        F.trail(st.P,x0,y0,st.hx+rnd(-34,34)*sz,st.hy+rnd(-20,20)*sz,C_T,2.6*sz,130);
        F.burst(st.P,st.hx+rnd(-26,26)*sz,st.hy+rnd(-14,14)*sz,C_O,2,4,sz);
        if(Math.random()<0.5)F.flash(st.P,x0,y0,C_T,10*sz,80);
      }
      if(!st.fired.dealt&&t-mgT>420){ st.fired.dealt=1; st.fire(); }
    }
    /* ②1200 导弹马戏: 10枚从胸前四散→悬转→回旋汇聚勇者一点 */
    if(!st.fired.msl&&t>=1200){ st.fired.msl=1;
      for(var i=0;i<10;i++){ var sa=(i/10)*6.283+rnd(-0.2,0.2);
        missiles.push({phase:0,p:0,sx:st.bx+8*sz,sy:st.by-6*sz,
          dx:st.bx+Math.cos(sa)*rnd(95,150)*sz, dy:st.by-6*sz+Math.sin(sa)*rnd(60,105)*sz,
          spd1:rnd(0.0021,0.0028), spd2:rnd(0.0019,0.0024), delay:i*55,
          cx:0,cy:0,x:0,y:0,trail:[]}); }
    }
    for(var mi=missiles.length-1;mi>=0;mi--){ var M=missiles[mi];
      if(M.delay>0){M.delay-=st.dt;continue;}
      if(M.phase===0){ M.p+=M.spd1*st.dt;
        var e0=1-Math.pow(1-Math.min(1,M.p),2);
        M.x=M.sx+(M.dx-M.sx)*e0; M.y=M.sy+(M.dy-M.sy)*e0;
        if(M.p>=1){ M.phase=1; M.p=0;
          /* 控制点: 外扩弧线转向 */
          var oa=Math.atan2(M.dy-st.by,M.dx-st.bx);
          M.cx=M.dx+Math.cos(oa)*46*sz; M.cy=M.dy+Math.sin(oa)*36*sz; }
      } else { M.p+=M.spd2*st.dt;
        var pp=Math.min(1,M.p), e1=pp*pp*(3-2*pp);
        var ix=(1-e1)*(1-e1)*M.dx+2*(1-e1)*e1*M.cx+e1*e1*st.hx;
        var iy=(1-e1)*(1-e1)*M.dy+2*(1-e1)*e1*M.cy+e1*e1*st.hy;
        M.x=ix; M.y=iy;
        if(pp>=1){ F.flash(st.P,st.hx,st.hy,C_O,24*sz,170);
          F.burst(st.P,st.hx,st.hy,mi%2?C_O:C_R,9,6.5,sz); F.ring(st.P,st.hx,st.hy,C_R,0.75,2.5*sz);
          missiles.splice(mi,1);
          if(missiles.length===0){ /* 全弹命中: 汇聚大爆 */
            F.flash(st.P,st.hx,st.hy,'255,235,200',56*sz,280);
            F.ring(st.P,st.hx,st.hy,C_O,1.7,5.4*sz); F.ring(st.P,st.hx,st.hy,C_T,1.1,3.6*sz);
            F.burst(st.P,st.hx,st.hy,C_O,22,8.5,sz); F.shards(st.P,st.hx,st.hy,'150,140,120',10,sz); }
          continue; }
      }
      M.trail.push({x:M.x,y:M.y}); if(M.trail.length>8)M.trail.shift();
    }
    /* ③2750 等离子军刀突进撩斩 */
    if(!st.fired.sab&&t>=2750){ st.fired.sab=1; sabT=t; }
    if(!st.fired.sabhit&&sabT>0&&t-sabT>=240){ st.fired.sabhit=1;
      F.beam(st.P,st.hx,st.hy,-0.9,C_B,1.3,true);
      F.burst(st.P,st.hx,st.hy,C_B,12,7,sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3.2*sz);
    }
    /* ④3350 全武库过载→3980 殉爆 */
    if(!st.fired.over&&t>=3350){ st.fired.over=1; blinkT=t;
      for(var p2=0;p2<2;p2++)plates.push({x:st.bx+(p2?26:-22)*sz,y:st.by+6*sz,vx:p2?2.2:-2.4,vy:-2.6,rot:0,vrot:p2?0.09:-0.11,life:0});
      F.burst(st.P,st.bx,st.by,C_T,10,5,sz);
    }
    for(var pi=plates.length-1;pi>=0;pi--){ var P2=plates[pi];
      P2.life+=st.dt; P2.vy+=0.012*st.dt; P2.x+=P2.vx*st.dt*0.06; P2.y+=P2.vy*st.dt*0.06; P2.rot+=P2.vrot*st.dt*0.06;
      if(P2.life>1100)plates.splice(pi,1); }
    if(!st.fired.boom&&t>=3980){ st.fired.boom=1; overT=t;
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
    /* 架盾+机枪 */
    if(mgT>0&&t-mgT<1050){ var a=Math.min(1,(t-mgT)/200)*(t-mgT>850?Math.max(0,(1050-(t-mgT))/200):1);
      ctx.save(); ctx.globalAlpha=a;
      var ang=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.translate(st.bx+30*sz,st.by+2*sz); ctx.rotate(ang);
      var shg=ctx.createLinearGradient(0,-22*sz,0,22*sz); shg.addColorStop(0,'#4a5464'); shg.addColorStop(1,'#242c38');
      ctx.fillStyle=shg; ctx.strokeStyle='#7a8698'; ctx.lineWidth=1.6*sz;
      ctx.beginPath(); ctx.moveTo(-4*sz,-22*sz); ctx.lineTo(6*sz,-18*sz); ctx.lineTo(6*sz,18*sz); ctx.lineTo(-4*sz,22*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      var mg2=ctx.createLinearGradient(0,-4*sz,0,4*sz); mg2.addColorStop(0,'#3c4654'); mg2.addColorStop(1,'#1c222c');
      ctx.fillStyle=mg2; ctx.fillRect(4*sz,-4.4*sz,32*sz,8.8*sz);
      var heat=Math.min(1,(t-mgT)/700);
      for(var v=0;v<4;v++){ ctx.fillStyle='rgba('+(90+heat*165)+','+(50+heat*40)+',40,1)';
        ctx.fillRect((10+v*6)*sz,-6*sz,3*sz,12*sz); }
      ctx.fillStyle='#141a22'; ctx.fillRect(36*sz,-3*sz,8*sz,6*sz);
      ctx.strokeStyle='#d8b060'; ctx.lineWidth=1.4*sz;
      ctx.beginPath(); ctx.moveTo(8*sz,5*sz); ctx.quadraticCurveTo(2*sz,14*sz,-6*sz,12*sz); ctx.stroke();
      ctx.restore();
    }
    /* 导弹(实体弹体+白烟尾) */
    for(var mi=0;mi<missiles.length;mi++){ var M=missiles[mi]; if(M.delay>0||!M.trail.length)continue;
      for(var q=1;q<M.trail.length;q++){ ctx.strokeStyle='rgba(220,220,215,'+(q/M.trail.length*0.55)+')';
        ctx.lineWidth=(q/M.trail.length*6.5)*sz; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(M.trail[q-1].x,M.trail[q-1].y); ctx.lineTo(M.trail[q].x,M.trail[q].y); ctx.stroke(); }
      var na=M.trail.length>1?Math.atan2(M.y-M.trail[M.trail.length-2].y,M.x-M.trail[M.trail.length-2].x):0;
      ctx.save(); ctx.translate(M.x,M.y); ctx.rotate(na);
      /* 弹体(放大版·金属渐变) */
      var mbg=ctx.createLinearGradient(0,-3.2*sz,0,3.2*sz); mbg.addColorStop(0,'#7a8698'); mbg.addColorStop(.5,'#5a6474'); mbg.addColorStop(1,'#3a4250');
      ctx.fillStyle=mbg; ctx.strokeStyle='#1c222c'; ctx.lineWidth=0.9*sz;
      ctx.beginPath(); ctx.moveTo(-9*sz,-3.2*sz); ctx.lineTo(7*sz,-3.2*sz); ctx.lineTo(7*sz,3.2*sz); ctx.lineTo(-9*sz,3.2*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 红弹头 */
      ctx.fillStyle='#c8341e'; ctx.beginPath(); ctx.moveTo(7*sz,-3.2*sz); ctx.lineTo(13.5*sz,0); ctx.lineTo(7*sz,3.2*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 双尾翼 */
      ctx.fillStyle='#4a5464';
      ctx.beginPath(); ctx.moveTo(-8.6*sz,-3.2*sz); ctx.lineTo(-13*sz,-6.6*sz); ctx.lineTo(-6*sz,-3.2*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8.6*sz,3.2*sz); ctx.lineTo(-13*sz,6.6*sz); ctx.lineTo(-6*sz,3.2*sz); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 中环带 */
      ctx.strokeStyle='#8a94a4'; ctx.lineWidth=1*sz;
      ctx.beginPath(); ctx.moveTo(-1*sz,-3.2*sz); ctx.lineTo(-1*sz,3.2*sz); ctx.stroke();
      /* 尾焰 */
      var mfl=ctx.createRadialGradient(-10.5*sz,0,0,-10.5*sz,0,4.6*sz);
      mfl.addColorStop(0,'#fff0c0'); mfl.addColorStop(.5,'#ffb060'); mfl.addColorStop(1,'rgba(255,150,60,0)');
      ctx.fillStyle=mfl; ctx.beginPath(); ctx.arc(-10.5*sz,0,4.6*sz,0,6.283); ctx.fill();
      ctx.restore(); }
    /* 军刀 */
    if(sabT>0&&t-sabT<380){ var pr=(t-sabT)/380; var sw=-1.6+Math.min(1,pr/0.6)*2.5;
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(sw);
      ctx.globalAlpha=pr>0.82?(1-pr)/0.18:1;
      ctx.fillStyle='#242c38'; ctx.fillRect(-3*sz,12*sz,6*sz,16*sz);
      ctx.save(); ctx.shadowBlur=14; ctx.shadowColor='#9adcff';
      var kg=ctx.createLinearGradient(-2.6*sz,0,2.6*sz,0); kg.addColorStop(0,'rgba(140,215,255,0.5)'); kg.addColorStop(.5,'#eafaff'); kg.addColorStop(1,'rgba(140,215,255,0.5)');
      ctx.fillStyle=kg; ctx.beginPath(); ctx.moveTo(-3*sz,12*sz); ctx.lineTo(-2*sz,-34*sz); ctx.lineTo(1.4*sz,-40*sz); ctx.lineTo(3*sz,12*sz); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.restore();
    }
    /* 胸甲弹落 */
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
    if(blinkT>0&&t<3980){ var on=Math.floor((t-blinkT)/110)%2===0;
      if(on){ for(var k=0;k<6;k++){ var kx=st.bx+Math.cos(k*1.15)*36*sz, ky=st.by+Math.sin(k*1.9)*44*sz;
        var rg=ctx.createRadialGradient(kx,ky,0,kx,ky,6*sz);
        rg.addColorStop(0,g(C_R+',0.95')); rg.addColorStop(1,g(C_R+',0'));
        ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(kx,ky,6*sz,0,6.283); ctx.fill(); } }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
