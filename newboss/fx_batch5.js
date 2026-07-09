/* ═══ 批5: 审判/英雄/枪手/魔皇组 5 boss ═══ */

/* ㉕破晓仲裁者·索拉里斯 —— 审判之环+法典残页三判定+权杖金链+审判宝珠收押 */
function fxZhongcai(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,210,100', C_W='255,248,230';
  var circT=-1, pages=[], chainT=-1, orbT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return orbT>0&&st.t-orbT<820; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    if(!st.fired.c&&t>=100){ st.fired.c=1; circT=t; }
    /* ②800 法典残页12片环转·三标准判定(三次扫描闪) */
    if(!st.fired.pg&&t>=800){ st.fired.pg=1;
      for(var k=0;k<12;k++)pages.push({ang:k/12*6.283,r:88*sz,spin:0.0012,life:0,max:2600});
      st.fire();
    }
    if(!st.fired.j1&&t>=1150){ st.fired.j1=1; F.ring(st.P,st.hx,st.hy,C_G,0.9,2.6*sz); F.burst(st.P,st.hx,st.hy-30*sz,C_G,6,4,sz); }
    if(!st.fired.j2&&t>=1500){ st.fired.j2=1; F.ring(st.P,st.hx,st.hy,C_G,1.0,2.8*sz); F.burst(st.P,st.hx,st.hy,C_G,6,4,sz); }
    if(!st.fired.j3&&t>=1850){ st.fired.j3=1; F.ring(st.P,st.hx,st.hy,'255,90,70',1.1,3.2*sz); F.burst(st.P,st.hx,st.hy+20*sz,'255,90,70',8,5,sz); }
    /* ③2200 权杖金锁链缠绕 */
    if(!st.fired.ch&&t>=2200){ st.fired.ch=1; chainT=t; }
    /* ④2900 审判宝珠收押: 吸入光束+金爆 */
    if(!st.fired.orb&&t>=2900){ st.fired.orb=1; orbT=t;
      for(var q=0;q<14;q++)F.suck(st.P,st.hx+rnd(-80,80)*sz,st.hy+rnd(-60,60)*sz,st.bx+60*sz,st.by-40*sz,C_G,sz);
      F.flash(st.P,st.hx,st.hy,C_W,60*sz,300);
      F.ring(st.P,st.hx,st.hy,C_G,1.7,5.5*sz); F.burst(st.P,st.hx,st.hy,C_G,24,8,sz);
    }
    for(var pi=pages.length-1;pi>=0;pi--){ var p=pages[pi]; p.life+=st.dt; p.ang+=p.spin*st.dt; if(p.life>p.max)pages.splice(pi,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 法典残页(实体金页) */
    for(var pi=0;pi<pages.length;pi++){ var p=pages[pi];
      var a=Math.sin(Math.min(1,p.life/p.max)*3.14);
      var x=st.hx+Math.cos(p.ang)*p.r, y=st.hy+Math.sin(p.ang)*p.r*0.55;
      ctx.save(); ctx.globalAlpha=a*0.95; ctx.translate(x,y); ctx.rotate(p.ang+1.57);
      ctx.fillStyle='#f0e2b8'; ctx.fillRect(-6*sz,-9*sz,12*sz,18*sz);
      ctx.strokeStyle='#b89440'; ctx.lineWidth=0.9*sz; ctx.strokeRect(-6*sz,-9*sz,12*sz,18*sz);
      ctx.strokeStyle='rgba(150,110,40,.85)'; ctx.lineWidth=0.7*sz;
      for(var L=0;L<3;L++){ ctx.beginPath(); ctx.moveTo(-4*sz,-5*sz+L*4.5*sz); ctx.lineTo(4*sz,-5*sz+L*4.5*sz); ctx.stroke(); }
      ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 审判之环(地面金环铭文) */
    if(circT>0){ var a=Math.min(1,(t-circT)/450)*(orbT>0?Math.max(0,1-(t-orbT)/500):1);
      var cy=st.hy+50*sz;
      ctx.save(); ctx.globalAlpha=a*0.9;
      ctx.strokeStyle=g(C_G+',0.9'); ctx.lineWidth=2.6*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.ellipse(st.hx,cy,100*sz,25*sz,0,0,6.283); ctx.stroke();
      ctx.lineWidth=1.2*sz; ctx.setLineDash([4*sz,6*sz]);
      ctx.beginPath(); ctx.ellipse(st.hx,cy,84*sz,19*sz,0,0,6.283); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
    }
    /* 金锁链(③幕: 三条从boss权杖射出缠住勇者) */
    if(chainT>0&&t-chainT<900){ var pr=(t-chainT)/900, env=Math.sin(Math.min(1,pr*1.2)*3.14);
      for(var c2=0;c2<3;c2++){ var oy=(c2-1)*16*sz;
        ctx.save(); ctx.globalAlpha=env;
        ctx.strokeStyle=g(C_G+',0.9'); ctx.lineWidth=2*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_G+',1');
        var reach=Math.min(1,pr/0.5);
        var x0=st.bx+50*sz, y0=st.by-20*sz;
        var ex=x0+(st.hx-x0)*reach, ey=y0+(st.hy+oy-y0)*reach;
        var links=8;
        for(var k2=0;k2<links*reach;k2++){ var p2=k2/links;
          var lx=x0+(ex-x0)*p2, ly=y0+(ey-y0)*p2+Math.sin(p2*8+c2)*5*sz;
          ctx.beginPath(); ctx.ellipse(lx,ly,4*sz,2.6*sz,Math.atan2(ey-y0,ex-x0),0,6.283); ctx.stroke(); }
        ctx.shadowBlur=0; ctx.restore(); }
    }
    /* 审判宝珠(④幕: boss侧宝珠吸入光) */
    if(orbT>0&&t-orbT<820){ var pr3=(t-orbT)/820, env2=Math.sin(pr3*3.14);
      var ox=st.bx+60*sz, oy2=st.by-40*sz;
      var og=ctx.createRadialGradient(ox,oy2,0,ox,oy2,26*sz);
      og.addColorStop(0,g(C_W+','+(0.95*env2))); og.addColorStop(.5,g(C_G+','+(0.6*env2))); og.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(ox,oy2,26*sz,0,6.283); ctx.fill();
      ctx.strokeStyle=g(C_G+','+env2); ctx.lineWidth=2*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.arc(ox,oy2,13*sz,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
      /* 吸入光束 */
      ctx.strokeStyle=g(C_W+','+(0.5*env2)); ctx.lineWidth=6*sz*env2;
      ctx.beginPath(); ctx.moveTo(st.hx,st.hy); ctx.lineTo(ox,oy2); ctx.stroke();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉖苍穹守卫·阿尔基昂 —— 天空裂缝降临+音爆冲刺+星芒热视线+脉冲星爆发 */
function fxCangqiong(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='90,140,255', C_R='255,80,70', C_W='240,246,255';
  var rift={h:0}, dashT=-1, eyeT=-1, pulseT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return pulseT>0&&st.t-pulseT<780; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-650 天空裂缝: 靛蓝光柱降下 */
    rift.h=Math.min(1,t/560);
    if(t<650&&Math.random()<0.5)F.jet(st.P,st.bx+rnd(-14,14)*sz,rnd(0,st.by-40*sz),1.57,0.25,C_B,1,2.5,sz);
    /* ②800 音爆冲刺拳(boss→勇者一条冲击轨迹+爆) */
    if(!st.fired.dash&&t>=800){ st.fired.dash=1; dashT=t; }
    if(!st.fired.dashhit&&dashT>0&&t-dashT>=260){ st.fired.dashhit=1;
      F.flash(st.P,st.hx,st.hy,C_B,48*sz,240);
      F.burst(st.P,st.hx,st.hy,C_B,14,7.5,sz); F.ring(st.P,st.hx,st.hy,C_W,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_B,0.9,2.8*sz);
      st.fire();
    }
    /* ③1800 星芒热视线(双眼红线扫过) */
    if(!st.fired.eye&&t>=1800){ st.fired.eye=1; eyeT=t; }
    if(eyeT>0&&t-eyeT<620&&Math.random()<0.6)F.burst(st.P,st.hx+rnd(-46,46)*sz*((t-eyeT)/620*2-1),st.hy+rnd(-10,10)*sz,C_R,2,3.5,sz);
    /* ④2750 脉冲星爆发: 星芒徽记全开+冲击环 */
    if(!st.fired.pulse&&t>=2750){ st.fired.pulse=1; pulseT=t;
      F.flash(st.P,st.hx,st.hy,C_W,66*sz,320);
      F.ring(st.P,st.hx,st.hy,C_B,1.9,6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_B,0.8,2.6*sz);
      F.burst(st.P,st.hx,st.hy,C_B,28,9,sz);
    }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 天空裂缝光柱 */
    if(rift.h>0&&t<1400){ var a=t>1000?(1400-t)/400:1;
      var H=(st.by-30*sz)*rift.h;
      var rg=ctx.createLinearGradient(st.bx-16*sz,0,st.bx+16*sz,0);
      rg.addColorStop(0,g(C_B+',0')); rg.addColorStop(.5,g(C_B+','+(0.65*a))); rg.addColorStop(1,g(C_B+',0'));
      ctx.fillStyle=rg; ctx.fillRect(st.bx-16*sz,0,32*sz,H);
      ctx.strokeStyle=g(C_W+','+(0.9*a)); ctx.lineWidth=1.6*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.moveTo(st.bx,0); ctx.lineTo(st.bx,H); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 音爆冲刺(②幕: 白色冲击锥+音爆环) */
    if(dashT>0&&t-dashT<340){ var pr=(t-dashT)/340;
      var p=Math.min(1,pr/0.7);
      var x=st.bx+(st.hx-st.bx)*p, y=st.by+(st.hy-st.by)*p;
      var a2=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.save(); ctx.translate(x,y); ctx.rotate(a2);
      var cg=ctx.createLinearGradient(-70*sz,0,10*sz,0);
      cg.addColorStop(0,g(C_B+',0')); cg.addColorStop(1,g(C_W+',0.85'));
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.moveTo(10*sz,0); ctx.lineTo(-64*sz,-16*sz); ctx.lineTo(-40*sz,0); ctx.lineTo(-64*sz,16*sz); ctx.closePath(); ctx.fill();
      /* 音爆环(垂直椭圆) */
      ctx.strokeStyle=g(C_W+','+(0.8*(1-pr))); ctx.lineWidth=2.4*sz;
      ctx.beginPath(); ctx.ellipse(-20*sz,0,8*sz,(16+pr*22)*sz,0,0,6.283); ctx.stroke();
      ctx.restore();
    }
    /* 星芒热视线(③幕: 双红线横扫) */
    if(eyeT>0&&t-eyeT<620){ var pr2=(t-eyeT)/620, env=Math.sin(pr2*3.14);
      var tx=st.hx-56*sz+pr2*112*sz;
      for(var e2=-1;e2<=1;e2+=2){ var x0=st.bx+e2*9*sz, y0=st.by-46*sz;
        ctx.strokeStyle=g(C_R+','+(0.85*env)); ctx.lineWidth=2.4*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_R+',1');
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(tx+e2*4*sz,st.hy); ctx.stroke(); ctx.shadowBlur=0; }
      var hg=ctx.createRadialGradient(tx,st.hy,0,tx,st.hy,16*sz);
      hg.addColorStop(0,g(C_W+','+env)); hg.addColorStop(.5,g(C_R+','+(0.7*env))); hg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(tx,st.hy,16*sz,0,6.283); ctx.fill();
    }
    /* 脉冲星爆发(④幕: 八芒星光) */
    if(pulseT>0&&t-pulseT<780){ var pr3=(t-pulseT)/780, env2=Math.sin(Math.min(1,pr3*1.1)*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(pr3*0.8);
      for(var k=0;k<8;k++){ ctx.rotate(0.7854);
        var L=(30+pr3*90)*sz;
        var sg=ctx.createLinearGradient(0,0,0,-L);
        sg.addColorStop(0,g(C_W+','+(0.9*env2))); sg.addColorStop(1,g(C_B+',0'));
        ctx.strokeStyle=sg; ctx.lineWidth=(k%2?2:4)*sz*env2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-L*(k%2?0.62:1)); ctx.stroke(); }
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉗量子观测者·阿尔戈 —— 波函数闪烁+概率分身+观测坍缩+概率抹除 */
function fxLiangzi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='120,180,255', C_C='140,255,230', C_W='235,248,255';
  var ghosts=[], collapseT=-1, eraseT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return eraseT>0&&st.t-eraseT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 波函数波动(围勇者细波纹) */
    if(t<800&&Math.random()<0.25)F.ring(st.P,st.hx+rnd(-30,30)*sz,st.hy+rnd(-20,20)*sz,C_B,0.45,1.2*sz);
    /* ②800 概率分身: 5个虚影同时出现在勇者周围 */
    if(!st.fired.gh&&t>=800){ st.fired.gh=1;
      for(var k=0;k<5;k++){ var a=k/5*6.283+0.6;
        ghosts.push({x:st.hx+Math.cos(a)*62*sz,y:st.hy+Math.sin(a)*40*sz,ph:rnd(0,6.28),alive:true}); }
      F.burst(st.P,st.hx,st.hy,C_B,8,5,sz);
      st.fire();
    }
    /* ③1900 观测坍缩: 逐个锁定→消失,只留一个→打击 */
    if(!st.fired.col&&t>=1900){ st.fired.col=1; collapseT=t;
      for(var q=0;q<4;q++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        var alive=ghosts.filter(function(g2){return g2.alive;});
        if(alive.length>1){ var vic=alive[Math.floor(rnd(0,alive.length))]; vic.alive=false;
          F.shards(st.P,vic.x,vic.y,C_B,6,st.sz); }
      },qq*180/st.sp); })(q); }
    }
    if(!st.fired.colhit&&collapseT>0&&t-collapseT>=850){ st.fired.colhit=1;
      F.burst(st.P,st.hx,st.hy,C_C,12,6.5,sz); F.ring(st.P,st.hx,st.hy,C_C,1.0,3*sz);
      ghosts=[];
    }
    /* ④2900 概率抹除: 指尖轻点→现实改写波纹 */
    if(!st.fired.er&&t>=2900){ st.fired.er=1; eraseT=t;
      F.flash(st.P,st.hx,st.hy,C_W,56*sz,300);
      F.ring(st.P,st.hx,st.hy,C_B,1.5,4.5*sz); F.ring(st.P,st.hx,st.hy,C_C,1.0,3*sz);
      F.burst(st.P,st.hx,st.hy,C_B,20,7.5,sz);
    }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 概率分身(勇者形虚影: 简化人形轮廓·明暗闪烁) */
    for(var gi=0;gi<ghosts.length;gi++){ var g2=ghosts[gi]; if(!g2.alive)continue;
      var flick=0.35+Math.abs(Math.sin(t*0.012+g2.ph))*0.55;
      ctx.save(); ctx.globalAlpha=flick; ctx.translate(g2.x,g2.y);
      ctx.strokeStyle=g(C_B+',0.95'); ctx.lineWidth=1.8*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.arc(0,-16*sz,7*sz,0,6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-9*sz); ctx.lineTo(0,10*sz);
      ctx.moveTo(-10*sz,-1*sz); ctx.lineTo(10*sz,-1*sz);
      ctx.moveTo(0,10*sz); ctx.lineTo(-7*sz,24*sz);
      ctx.moveTo(0,10*sz); ctx.lineTo(7*sz,24*sz); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 观测坍缩锁定框(③幕) */
    if(collapseT>0&&t-collapseT<850){ var env=Math.sin((t-collapseT)/850*3.14);
      ctx.strokeStyle=g(C_C+','+(0.8*env)); ctx.lineWidth=1.4*sz; ctx.setLineDash([4*sz,4*sz]);
      ctx.strokeRect(st.hx-40*sz,st.hy-34*sz,80*sz,68*sz);
      ctx.setLineDash([]);
      ctx.font=(9*sz)+'px monospace'; ctx.fillStyle=g(C_C+','+env);
      ctx.fillText('P=1.00',st.hx+44*sz,st.hy-26*sz);
    }
    /* 概率抹除波纹(④幕: 同心方波扩散+像素化碎屑) */
    if(eraseT>0&&t-eraseT<800){ var pr=(t-eraseT)/800;
      for(var w2=0;w2<3;w2++){ var rp=pr-w2*0.14; if(rp<0||rp>1)continue;
        var R=rp*110*sz;
        ctx.strokeStyle=g(C_W+','+(0.7*(1-rp))); ctx.lineWidth=(2.6-w2*0.6)*sz;
        ctx.strokeRect(st.hx-R,st.hy-R*0.72,R*2,R*1.44); }
      if(Math.random()<0.7){ var qx=st.hx+rnd(-60,60)*sz, qy=st.hy+rnd(-42,42)*sz;
        ctx.fillStyle=g(C_B+',0.75'); ctx.fillRect(qx,qy,4*sz,4*sz); }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉘银翼·麻烦终结者 —— 擦枪上膛+点射三连+模式切换+银色风暴 */
function fxYinyi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var MODES=[{c:'120,180,255',n:'震荡'},{c:'255,150,60',n:'穿甲'},{c:'120,255,140',n:'追踪'}];
  var gunT=-1, shots=[], stormT=-1, modeIdx=-1;
  function drawGun(ctx,x,y,s,rot,a,recoil){ /* 银白手枪 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.translate(-recoil*8,0); ctx.scale(s,s);
    var gg=ctx.createLinearGradient(0,-6,0,6); gg.addColorStop(0,'#e8ecf4'); gg.addColorStop(.5,'#b8c2d2'); gg.addColorStop(1,'#7a8698');
    ctx.fillStyle=gg; ctx.fillRect(-14,-6,40,9);
    ctx.fillStyle='#98a4b6'; ctx.fillRect(20,-4,10,5);
    ctx.fillStyle='#5a6478'; ctx.beginPath(); ctx.moveTo(-14,2); ctx.lineTo(-6,2); ctx.lineTo(-9,18); ctx.lineTo(-17,16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#3e4658'; ctx.lineWidth=1.1;
    ctx.strokeRect(-14,-6,40,9);
    ctx.beginPath(); ctx.arc(-2,5,3.4,0.6,2.6); ctx.stroke();
    ctx.fillStyle='#2e3444'; ctx.fillRect(6,-6,3,9);
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return stormT>0&&st.t-stormT<820; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    if(!st.fired.g&&t>=100){ st.fired.g=1; gunT=t; }
    /* ①0-750 擦枪上膛(枪出现+滑套声粒子) */
    if(!st.fired.rack&&t>=560){ st.fired.rack=1; F.burst(st.P,st.bx+56*sz,st.by-6*sz,'210,220,235',5,3,sz); }
    /* ②850起 点射三连 */
    if(!st.fired.tri&&t>=850){ st.fired.tri=1;
      for(var i=0;i<3;i++)shots.push({ts:850+i*180,col:'230,238,250',done:false});
      st.fire();
    }
    /* ③1750 模式切换三连(蓝震荡/橙穿甲/绿追踪 各一发) */
    if(!st.fired.modes&&t>=1750){ st.fired.modes=1;
      for(var k=0;k<3;k++)shots.push({ts:1750+k*330,col:MODES[k].c,mode:k,done:false});
    }
    for(var si=0;si<shots.length;si++){ var s2=shots[si];
      if(!s2.done&&t>=s2.ts){ s2.done=true;
        if(s2.mode!==undefined)modeIdx=s2.mode;
        var x0=st.bx+62*sz, y0=st.by-8*sz;
        F.flash(st.P,x0,y0,s2.col,14*sz,120);
        if(s2.mode===2){ /* 追踪弹: 弧线 */
          for(var q2=0;q2<8;q2++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
            var p=qq/8; var x=x0+(st.hx-x0)*p, y=y0+(st.hy-y0)*p-Math.sin(p*3.14)*44*st.sz;
            F.burst(st.P,x,y,s2.col,2,2.5,st.sz);
          },qq*32/st.sp); })(q2); }
          setTimeout(function(){ if(!st.dead){F.burst(st.P,st.hx,st.hy,s2.col,8,6,st.sz);F.ring(st.P,st.hx,st.hy,s2.col,0.9,2.8*st.sz);} },270/st.sp);
        } else {
          F.trail(st.P,x0,y0,st.hx+rnd(-14,14)*sz,st.hy+rnd(-10,10)*sz,s2.col,3*sz,170);
          F.burst(st.P,st.hx,st.hy,s2.col,s2.mode===1?10:6,s2.mode===1?7:5,sz);
          if(s2.mode===0)F.ring(st.P,st.hx,st.hy,s2.col,1.2,3.4*sz);
          if(s2.mode===1)F.shards(st.P,st.hx,st.hy,s2.col,7,sz);
        }
      } }
    /* ④2950 银色风暴: 全模式弹幕扇射 */
    if(!st.fired.storm&&t>=2950){ st.fired.storm=1; stormT=t;
      for(var w2=0;w2<12;w2++){ (function(ww){ setTimeout(function(){ if(st.dead)return;
        var col=MODES[ww%3].c;
        var x0=st.bx+62*st.sz, y0=st.by-8*st.sz;
        F.trail(st.P,x0,y0,st.hx+rnd(-46,46)*st.sz,st.hy+rnd(-26,26)*st.sz,col,2.6*st.sz,150);
        F.burst(st.P,st.hx+rnd(-30,30)*st.sz,st.hy+rnd(-18,18)*st.sz,col,3,5,st.sz);
        F.flash(st.P,x0,y0,'230,238,250',10*st.sz,90);
      },ww*55/st.sp); })(w2); }
      setTimeout(function(){ if(!st.dead){
        F.flash(st.P,st.hx,st.hy,'230,238,250',56*st.sz,280);
        F.ring(st.P,st.hx,st.hy,'200,215,235',1.6,5*st.sz);
        F.burst(st.P,st.hx,st.hy,'220,230,245',20,8,st.sz);
      } },700/st.sp);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(gunT>0){ var a=Math.min(1,(t-gunT)/250);
      var rec=0;
      for(var si=0;si<shots.length;si++){ var s2=shots[si];
        if(s2.done&&t-s2.ts<110)rec=Math.max(rec,1-(t-s2.ts)/110); }
      if(stormT>0&&t-stormT<700)rec=Math.abs(Math.sin(t*0.05));
      var ang=Math.atan2(st.hy-(st.by-8*sz),st.hx-(st.bx+30*sz));
      drawGun(ctx,st.bx+34*sz,st.by-8*sz,1.35*sz,ang,a,rec);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 模式指示灯(枪上方小字) */
    if(modeIdx>=0&&t<2950){ var m=MODES[modeIdx];
      ctx.save(); ctx.globalAlpha=0.9; ctx.fillStyle=g(m.c+',1'); ctx.shadowBlur=8; ctx.shadowColor=g(m.c+',1');
      ctx.font='bold '+(10*sz)+'px sans-serif'; ctx.textAlign='center';
      ctx.fillText('['+m.n+']',st.bx+34*sz,st.by-30*sz); ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉙魔皇·小丑至尊 —— 四魔剑扇展+细剑光弧+四剑齐射+死亡之网 */
function fxMohuang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var GEMS=['255,80,120','120,160,255','150,255,140','255,200,80'];
  var C_P='170,120,255', C_S='210,200,235';
  var blades=[], slashT=-1, netT=-1;
  function drawMagicSword(ctx,x,y,s,rot,a,gem){ /* 悬浮魔剑(暗银+宝石) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#241c38'; ctx.fillRect(-1.8,14,3.6,10);
    ctx.fillStyle='#4a3e6a'; ctx.fillRect(-7,12,14,3);
    var bg=ctx.createLinearGradient(-3,0,3,0); bg.addColorStop(0,'#3a3050'); bg.addColorStop(.5,'#b8aed6'); bg.addColorStop(1,'#2e2545');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-3,12); ctx.lineTo(-2,-28); ctx.lineTo(0,-35); ctx.lineTo(2,-28); ctx.lineTo(3,12); ctx.closePath(); ctx.fill();
    ctx.fillStyle=g(gem+',1'); ctx.shadowBlur=9; ctx.shadowColor=g(gem+',1');
    ctx.beginPath(); ctx.arc(0,17,2.6,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.save(); ctx.shadowBlur=7; ctx.shadowColor=g(C_P+',1'); ctx.strokeStyle=g(C_P+',0.8'); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,10); ctx.lineTo(0,-33); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5900,endMs:4000,
  busy:function(st){ return netT>0&&st.t-netT<840; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 四魔剑扇形展开 */
    if(!st.fired.bl&&t>=80){ st.fired.bl=1;
      for(var k=0;k<4;k++)blades.push({idx:k,mode:'fan',p:0,ang:(k/3-0.5)*1.5-1.57,gem:GEMS[k]});
    }
    for(var bi=0;bi<blades.length;bi++){ var b=blades[bi];
      if(b.mode==='fan'){ b.p=Math.min(1,b.p+st.dt*0.0016);
        b.x=st.bx+Math.sin(b.ang+1.57)*(72*sz)*b.p;
        b.y=st.by-20*sz-Math.cos(b.ang+1.57)*(52*sz)*b.p+Math.sin(t*0.004+b.idx)*3*sz;
        b.rot=b.ang+1.57; }
    }
    /* ②850 暗银细剑光弧三斩(空间裂隙) */
    if(!st.fired.slash&&t>=850){ st.fired.slash=1; slashT=t;
      for(var q=0;q<3;q++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        F.beam(st.P,st.hx,st.hy,[-0.6,0.5,-0.05][qq],C_S,1.15,qq===2);
        F.burst(st.P,st.hx,st.hy,C_P,7,5.5,st.sz);
      },qq*220/st.sp); })(q); }
      st.fire();
    }
    /* ③1900 四魔剑齐射轮转(逐把射向勇者再归位) */
    if(!st.fired.vol&&t>=1900){ st.fired.vol=1;
      for(var v=0;v<4;v++){ (function(vv){ setTimeout(function(){ if(st.dead)return;
        var b2=blades[vv]; if(!b2)return;
        b2.mode='shoot'; b2.sx=b2.x; b2.sy=b2.y; b2.p=0;
      },vv*200/st.sp); })(v); }
    }
    for(var bi2=0;bi2<blades.length;bi2++){ var b3=blades[bi2];
      if(b3.mode==='shoot'){ b3.p+=st.dt*0.004;
        if(b3.p>=1){ F.burst(st.P,st.hx,st.hy,b3.gem,7,6,st.sz); F.trail(st.P,b3.sx,b3.sy,st.hx,st.hy,b3.gem,2.4*st.sz,180);
          b3.mode='fan'; b3.p=1; }
        else { b3.x=b3.sx+(st.hx-b3.sx)*b3.p; b3.y=b3.sy+(st.hy-b3.sy)*b3.p; b3.rot=Math.atan2(st.hy-b3.sy,st.hx-b3.sx)+1.57; }
      } }
    /* ④2950 死亡之网: 四剑定位四角→四色光弧交织收拢+核心爆 */
    if(!st.fired.net&&t>=2950){ st.fired.net=1; netT=t;
      for(var n2=0;n2<4;n2++){ var b4=blades[n2]; if(!b4)continue;
        b4.mode='corner'; var ca=n2/4*6.283+0.785;
        b4.cx=st.hx+Math.cos(ca)*86*sz; b4.cy=st.hy+Math.sin(ca)*60*sz;
        b4.sx=b4.x; b4.sy=b4.y; b4.p=0; }
    }
    for(var bi3=0;bi3<blades.length;bi3++){ var b5=blades[bi3];
      if(b5.mode==='corner'){ b5.p=Math.min(1,b5.p+st.dt*0.003);
        b5.x=b5.sx+(b5.cx-b5.sx)*b5.p; b5.y=b5.sy+(b5.cy-b5.sy)*b5.p;
        b5.rot=Math.atan2(st.hy-b5.y,st.hx-b5.x)+1.57; } }
    if(!st.fired.netboom&&netT>0&&t-netT>=520){ st.fired.netboom=1;
      F.flash(st.P,st.hx,st.hy,'235,225,255',64*sz,320);
      F.ring(st.P,st.hx,st.hy,C_P,1.8,6*sz); F.ring(st.P,st.hx,st.hy,'235,225,255',1.2,4*sz);
      F.burst(st.P,st.hx,st.hy,C_P,26,8.5,sz); F.shards(st.P,st.hx,st.hy,C_S,14,sz);
      for(var g3=0;g3<4;g3++)F.burst(st.P,st.hx,st.hy,GEMS[g3],6,7,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var fade=netT>0?Math.max(0,1-(t-netT-500)/300):1;
    for(var bi=0;bi<blades.length;bi++){ var b=blades[bi];
      drawMagicSword(ctx,b.x,b.y,1.15*sz,b.rot,Math.min(1,b.p*3)*Math.min(1,fade),b.gem);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 死亡之网(四角剑之间四色光弧交织·收拢) */
    if(netT>0&&t-netT<560){ var pr=(t-netT)/560, env=Math.sin(Math.min(1,pr*1.3)*3.14);
      var shrink=1-pr*0.55;
      for(var i=0;i<4;i++){ var b1=blades[i], b2=blades[(i+1)%4]; if(!b1||!b2)continue;
        var x1=st.hx+(b1.x-st.hx)*shrink, y1=st.hy+(b1.y-st.hy)*shrink;
        var x2=st.hx+(b2.x-st.hx)*shrink, y2=st.hy+(b2.y-st.hy)*shrink;
        ctx.strokeStyle=g(GEMS[i]+','+(0.85*env)); ctx.lineWidth=2.4*sz; ctx.shadowBlur=12; ctx.shadowColor=g(GEMS[i]+',1');
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(st.hx,st.hy,x2,y2); ctx.stroke();
        /* 对角线 */
        var b3=blades[(i+2)%4]; if(b3){ var x3=st.hx+(b3.x-st.hx)*shrink, y3=st.hy+(b3.y-st.hy)*shrink;
          ctx.globalAlpha=0.5; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x3,y3); ctx.stroke(); ctx.globalAlpha=1; }
        ctx.shadowBlur=0; }
      /* 中心暗紫核心 */
      var cg=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,22*sz);
      cg.addColorStop(0,g('235,225,255,'+(0.9*env))); cg.addColorStop(.5,g(C_P+','+(0.6*env))); cg.addColorStop(1,g(C_P+',0'));
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(st.hx,st.hy,22*sz,0,6.283); ctx.fill();
      /* 菱形核心 */
      ctx.strokeStyle=g(C_P+','+env); ctx.lineWidth=1.8*sz;
      ctx.beginPath(); ctx.moveTo(st.hx,st.hy-10*sz); ctx.lineTo(st.hx+7*sz,st.hy); ctx.lineTo(st.hx,st.hy+10*sz); ctx.lineTo(st.hx-7*sz,st.hy); ctx.closePath(); ctx.stroke();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
