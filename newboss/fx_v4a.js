/* ═══ v4a 重做(覆盖旧版): 不动明王(如来神掌) / 阿努比斯(冥界之门) / 大祭司(心脏称量) ═══ */

/* ②v4 不动明王·焚天镇狱尊 —— 前三幕保留 + 终结: 如来神掌从天拍下 */
function fxMingwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,190,60', C_F='255,120,30', C_W2='255,240,200';
  var wheel={r:0,rot:0}, strikes=[], palmT=-1, palmHitT=-1, skyT=-1;
  function drawVajra(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#caa64a';
    ctx.beginPath(); ctx.arc(0,0,4.5,0,6.283); ctx.fill();
    for(var e=-1;e<=1;e+=2){ ctx.save(); ctx.scale(1,e);
      ctx.beginPath(); ctx.moveTo(0,4); ctx.quadraticCurveTo(3,12,0,26); ctx.quadraticCurveTo(-3,12,0,4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-2,6); ctx.quadraticCurveTo(-9,14,-2,24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2,6); ctx.quadraticCurveTo(9,14,2,24); ctx.stroke();
      ctx.restore(); }
    ctx.strokeStyle='#8a6a20'; ctx.lineWidth=1.2; ctx.stroke();
    ctx.restore();
  }
  function drawSwordF(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#3a2f18'; ctx.fillRect(-2.5,18,5,14);
    ctx.fillStyle='#caa64a'; ctx.fillRect(-8,14,16,4);
    var bg=ctx.createLinearGradient(-4,0,4,0); bg.addColorStop(0,'#9a7830'); bg.addColorStop(.5,'#ffe9b0'); bg.addColorStop(1,'#9a7830');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-4,14); ctx.lineTo(-3,-38); ctx.lineTo(0,-46); ctx.lineTo(3,-38); ctx.lineTo(4,14); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowBlur=12; ctx.shadowColor='#ffb040'; ctx.strokeStyle='#ffd070'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(0,12); ctx.lineTo(0,-44); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function drawBuddhaPalm(ctx,x,y,s,a,press){ /* 如来神掌: 正面掌心·五指上展·掌心法轮·佛光背光 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    /* 佛光背光 */
    var hg=ctx.createRadialGradient(0,0,10,0,0,86);
    hg.addColorStop(0,'rgba(255,236,170,0.85)'); hg.addColorStop(.55,'rgba(255,190,70,0.4)'); hg.addColorStop(1,'rgba(255,150,40,0)');
    ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(0,0,86,0,6.283); ctx.fill();
    /* 外圈细佛环 */
    ctx.strokeStyle='rgba(255,220,130,0.75)'; ctx.lineWidth=1.6; ctx.shadowBlur=10; ctx.shadowColor='rgba(255,190,70,1)';
    ctx.beginPath(); ctx.arc(0,0,66,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
    var pg=ctx.createLinearGradient(0,-58,0,42);
    pg.addColorStop(0,'#ffe6a8'); pg.addColorStop(.55,'#f0b654'); pg.addColorStop(1,'#c88a30');
    ctx.fillStyle=pg; ctx.strokeStyle='#7a5416'; ctx.lineWidth=2;
    /* 五指(中指最长) */
    var fingers=[[-27,-16,-31,-44,7],[-14,-22,-16,-56,7.5],[0,-24,0,-62,8],[14,-22,16,-56,7.5],[27,-16,30,-46,7]];
    for(var f2=0;f2<5;f2++){ var Fg=fingers[f2];
      ctx.beginPath();
      ctx.moveTo(Fg[0]-Fg[4]/2,Fg[1]); ctx.lineTo(Fg[2]-Fg[4]/2,Fg[3]+Fg[4]);
      ctx.arc(Fg[2],Fg[3]+Fg[4]*0.4,Fg[4]/1.6,3.14,0);
      ctx.lineTo(Fg[0]+Fg[4]/2,Fg[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      /* 指节纹 */
      ctx.strokeStyle='rgba(122,84,22,0.6)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(Fg[0]-Fg[4]*0.35+(Fg[2]-Fg[0])*0.45,Fg[1]+(Fg[3]-Fg[1])*0.45);
      ctx.lineTo(Fg[0]+Fg[4]*0.35+(Fg[2]-Fg[0])*0.45,Fg[1]+(Fg[3]-Fg[1])*0.45); ctx.stroke();
      ctx.strokeStyle='#7a5416'; ctx.lineWidth=2;
    }
    /* 拇指(右侧斜出) */
    ctx.beginPath(); ctx.moveTo(30,-4); ctx.quadraticCurveTo(48,-14,52,-28);
    ctx.arc(50,-30,4.6,-0.5,2.6);
    ctx.quadraticCurveTo(42,-8,32,6); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* 掌心 */
    ctx.fillStyle=pg;
    ctx.beginPath(); ctx.ellipse(0,4,33,38,0,0,6.283); ctx.fill(); ctx.stroke();
    /* 掌纹三道 */
    ctx.strokeStyle='rgba(122,84,22,0.75)'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(-24,-8); ctx.quadraticCurveTo(0,-2,22,-12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26,2); ctx.quadraticCurveTo(-4,10,20,2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18,26); ctx.quadraticCurveTo(-2,18,10,30); ctx.stroke();
    /* 掌心法轮印记 */
    ctx.save(); ctx.strokeStyle=press?'#fff6dc':'#a86f1e'; ctx.lineWidth=2;
    if(press){ ctx.shadowBlur=14; ctx.shadowColor='rgba(255,220,130,1)'; }
    ctx.beginPath(); ctx.arc(0,6,13,0,6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,6,5,0,6.283); ctx.stroke();
    for(var k=0;k<8;k++){ var a2=k/8*6.283;
      ctx.beginPath(); ctx.moveTo(Math.cos(a2)*5,6+Math.sin(a2)*5); ctx.lineTo(Math.cos(a2)*13,6+Math.sin(a2)*13); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6400,endMs:4500,
  busy:function(st){ return palmT>0&&st.t-palmT<1700; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①法轮升起(保留) */
    wheel.r=Math.min(1,t/700); wheel.rot+=st.dt*0.0016;
    if(t<800&&Math.random()<0.5)F.suck(st.P,st.bx+rnd(-120,120)*sz,st.by+rnd(-100,100)*sz,st.bx,st.by-30*sz,C_G,sz);
    /* ②六臂杵剑连击(保留) */
    if(!st.fired.s6&&t>=900){ st.fired.s6=1;
      for(var i=0;i<6;i++){ strikes.push({kind:i%2?'sword':'vajra',ts:900+i*230,ang:rnd(-0.5,0.5)+(i%2?0.7:-0.7),done:false}); }
      st.fire();
    }
    for(var si=0;si<strikes.length;si++){ var sk=strikes[si];
      if(!sk.done&&t>=sk.ts+150){ sk.done=true;
        F.beam(st.P,st.hx,st.hy,sk.ang,C_G,1.2,false);
        F.burst(st.P,st.hx,st.hy,C_F,8,6,sz); F.ring(st.P,st.hx,st.hy,C_G,0.9,3*sz);
      } }
    /* ③念珠弹幕(保留) */
    if(!st.fired.beads&&t>=2350){ st.fired.beads=1;
      for(var k=0;k<24;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var a=kk/24*6.283; F.suck(st.P,st.hx+Math.cos(a)*130*st.sz,st.hy+Math.sin(a)*70*st.sz,st.hx,st.hy,'40,30,20',st.sz);
      },kk*22/st.sp); })(k); }
      F.ring(st.P,st.hx,st.hy,C_F,1.2,4*sz);
    }
    /* ④如来神掌: 2950天穹金光裂开→3200巨掌降下→3900拍击 */
    if(!st.fired.sky&&t>=2950){ st.fired.sky=1; skyT=t;
      F.flash(st.P,st.hx,20,C_W2,44*sz,300);
      for(var q=0;q<8;q++)F.jet(st.P,st.hx+rnd(-70,70)*sz,rnd(4,20),1.57,0.3,C_G,1,3,sz);
    }
    if(!st.fired.palm&&t>=3200){ st.fired.palm=1; palmT=t; }
    if(!st.fired.phit&&palmT>0&&t-palmT>=700){ st.fired.phit=1; palmHitT=t;
      F.flash(st.P,st.hx,st.hy,C_W2,76*sz,340);
      F.ring(st.P,st.hx,st.hy,C_G,2.0,6.5*sz); F.ring(st.P,st.hx,st.hy,C_F,1.4,4.5*sz); F.ring(st.P,st.hx,st.hy,C_W2,0.9,3*sz);
      F.burst(st.P,st.hx,st.hy,C_G,30,9,sz); F.burst(st.P,st.hx,st.hy,C_F,18,7,sz);
      F.shards(st.P,st.hx,st.hy,C_G,14,sz);
      for(var w2=0;w2<10;w2++)F.jet(st.P,st.hx+rnd(-46,46)*sz,st.hy+20*sz,-1.57+rnd(-0.5,0.5),0.4,C_F,2,6,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    for(var si=0;si<strikes.length;si++){ var sk=strikes[si];
      if(t>=sk.ts&&t<sk.ts+220){ var pr=(t-sk.ts)/220;
        var L=150*sz, sx=st.hx-Math.cos(sk.ang)*L*(1-pr*2), sy=st.hy-Math.sin(sk.ang)*L*(1-pr*2);
        var a=pr<0.12?pr/0.12:(pr>0.85?(1-pr)/0.15:1);
        if(sk.kind==='vajra')drawVajra(ctx,sx,sy,1.5*sz,sk.ang+1.57,a);
        else drawSwordF(ctx,sx,sy,1.3*sz,sk.ang+1.57,a);
      } }
    /* 如来神掌本体 */
    if(palmT>0&&t-palmT<1650){ var pr2=(t-palmT);
      var y;
      if(pr2<700){ var dp=pr2/700; var ease=dp<0.55?dp/0.55*0.4:0.4+Math.pow((dp-0.55)/0.45,2)*0.6; /* 先缓后加速 */
        y=-90*sz+ease*(st.hy-14*sz+90*sz); }
      else { y=st.hy-14*sz+Math.sin(Math.min(1,(pr2-700)/180)*3.14)*4*sz; }
      var a2=pr2>1350?Math.max(0,1-(pr2-1350)/300):1;
      var yy=pr2>1350?y-(pr2-1350)*0.08*sz:y;
      drawBuddhaPalm(ctx,st.hx,yy,1.35*sz,a2,pr2>=700);
      if(pr2<700&&Math.random()<0.7)F.jet(st.P,st.hx+rnd(-56,56)*sz,y+58*sz,1.57,0.4,C_G,1,2.4,sz);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(wheel.r>0){ var R=88*sz*wheel.r, cx=st.bx, cy=st.by-14*sz;
      ctx.save(); ctx.globalAlpha=0.9;
      var wg=ctx.createRadialGradient(cx,cy,R*0.5,cx,cy,R); wg.addColorStop(0,g(C_G+',0')); wg.addColorStop(.8,g(C_G+',0.5')); wg.addColorStop(1,g(C_F+',0'));
      ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.fill();
      ctx.strokeStyle=g(C_G+',0.9'); ctx.lineWidth=2.4*sz; ctx.shadowBlur=16; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.arc(cx,cy,R,0,6.283); ctx.stroke();
      for(var k=0;k<12;k++){ var a=wheel.rot+k/12*6.283;
        ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R*0.55,cy+Math.sin(a)*R*0.55); ctx.lineTo(cx+Math.cos(a)*(R-3),cy+Math.sin(a)*(R-3)); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 天穹金光裂缝(④前奏) */
    if(skyT>0&&t-skyT<900){ var pr=(t-skyT)/900, env=Math.sin(Math.min(1,pr*1.3)*3.14);
      var w=Math.min(1,pr*2.4)*90*sz;
      var cg=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      cg.addColorStop(0,g(C_G+',0')); cg.addColorStop(.5,g(C_W2+','+(0.6*env))); cg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=cg; ctx.fillRect(st.hx-w,0,w*2,26*sz);
      ctx.strokeStyle=g(C_W2+','+(0.9*env)); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(st.hx-w*0.9,14*sz); ctx.lineTo(st.hx-w*0.3,10*sz); ctx.lineTo(st.hx,16*sz); ctx.lineTo(st.hx+w*0.35,9*sz); ctx.lineTo(st.hx+w*0.9,13*sz); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 拍击后梵文金环扩散 */
    if(palmHitT>0&&t-palmHitT<800){ var pr3=(t-palmHitT)/800;
      var R2=pr3*128*sz;
      ctx.save(); ctx.globalAlpha=(1-pr3)*0.95; ctx.fillStyle='#ffe9b0'; ctx.shadowBlur=10; ctx.shadowColor=g(C_G+',1');
      ctx.font=(13*sz)+'px serif'; ctx.textAlign='center';
      var SYL='ᬒᬁᬳᬸᬁᬢᬭᬁ';
      for(var k2=0;k2<8;k2++){ var a3=k2/8*6.283+pr3*0.9;
        ctx.fillText(SYL[k2%SYL.length],st.hx+Math.cos(a3)*R2,st.hy+Math.sin(a3)*R2*0.6); }
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ③v4 亡灵咒术师·阿努比斯之影 —— 冥界之门→巨型胡狼虚影→短剑刻咒阵→灵魂离体被拽入门 */
function fxAnubis(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='150,200,255', C_W='235,248,255', C_D='90,130,200';
  var gate={a:0,x:0,y:0}, jackal={a:0}, circleT=-1, threads=[], soul={a:0,y:0,pull:0}, gulpT=-1;
  function drawGate(ctx,x,y,s,a,open){ /* 冥界之门: 双柱+门楣, 门内黑洞冷雾 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    /* 门内黑 */
    var ig=ctx.createLinearGradient(0,-52,0,26);
    ig.addColorStop(0,'rgba(6,10,26,'+(0.92*open)+')'); ig.addColorStop(1,'rgba(14,22,48,'+(0.75*open)+')');
    ctx.fillStyle=ig; ctx.fillRect(-22,-50,44,74);
    /* 柱 */
    var pg=ctx.createLinearGradient(-4,0,4,0); pg.addColorStop(0,'#1c2840'); pg.addColorStop(.5,'#3e5480'); pg.addColorStop(1,'#16203a');
    ctx.fillStyle=pg; ctx.strokeStyle='#96c8ff'; ctx.lineWidth=1.3;
    for(var e=-1;e<=1;e+=2){ ctx.fillRect(e*26-5,-52,10,78); ctx.strokeRect(e*26-5,-52,10,78);
      /* 柱面刻纹 */
      ctx.save(); ctx.strokeStyle='rgba(150,200,255,0.55)'; ctx.lineWidth=0.8;
      for(var k=0;k<5;k++){ ctx.beginPath(); ctx.moveTo(e*26-3,-42+k*15); ctx.lineTo(e*26+3,-42+k*15); ctx.stroke();
        ctx.beginPath(); ctx.arc(e*26,-36+k*15,1.6,0,6.283); ctx.stroke(); }
      ctx.restore(); }
    /* 门楣 */
    ctx.fillStyle=pg; ctx.fillRect(-34,-60,68,10); ctx.strokeRect(-34,-60,68,10);
    ctx.strokeStyle='rgba(150,200,255,0.75)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,-55,3,0,6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8,-55); ctx.lineTo(-3.6,-55); ctx.moveTo(3.6,-55); ctx.lineTo(8,-55); ctx.stroke();
    ctx.restore();
  }
  function drawJackal(ctx,x,y,s,a,t){ /* 巨型胡狼头虚影(侧脸线勾·冷焰眼) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    ctx.strokeStyle='rgba(150,200,255,0.9)'; ctx.lineWidth=2.2; ctx.lineJoin='round';
    ctx.shadowBlur=12; ctx.shadowColor='rgba(150,200,255,1)';
    ctx.beginPath();
    ctx.moveTo(-38,10);                    /* 颈后 */
    ctx.quadraticCurveTo(-30,-18,-14,-26); /* 后脑 */
    ctx.lineTo(-10,-46); ctx.lineTo(-2,-27);   /* 左耳 */
    ctx.lineTo(4,-48); ctx.lineTo(10,-26);     /* 右耳 */
    ctx.quadraticCurveTo(22,-20,40,-6);    /* 额→吻背 */
    ctx.lineTo(46,-2);                     /* 鼻尖 */
    ctx.quadraticCurveTo(40,4,26,6);       /* 下颚 */
    ctx.quadraticCurveTo(6,10,-6,20);      /* 颌线 */
    ctx.quadraticCurveTo(-22,26,-38,22);
    ctx.stroke();
    ctx.shadowBlur=0;
    /* 冷焰眼 */
    var fl=0.7+Math.sin(t*0.012)*0.3;
    var eg=ctx.createRadialGradient(8,-12,0,8,-12,7);
    eg.addColorStop(0,'rgba(240,250,255,'+fl+')'); eg.addColorStop(.5,'rgba(150,200,255,'+(0.8*fl)+')'); eg.addColorStop(1,'rgba(150,200,255,0)');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(8,-12,7,0,6.283); ctx.fill();
    ctx.restore();
  }
  function drawDagger(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#171a22'; ctx.fillRect(-2,12,4,12);
    ctx.fillStyle='#3a4258'; ctx.fillRect(-7,10,14,3.5);
    var bg=ctx.createLinearGradient(-3.5,0,3.5,0); bg.addColorStop(0,'#0c0f16'); bg.addColorStop(.5,'#2e3648'); bg.addColorStop(1,'#0c0f16');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-3.5,10); ctx.lineTo(-2.2,-26); ctx.lineTo(0,-33); ctx.lineTo(2.2,-26); ctx.lineTo(3.5,10); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowBlur=10; ctx.shadowColor='#96c8ff'; ctx.strokeStyle='#bfe0ff'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-31); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function drawSoul(ctx,x,y,s,a,t){ /* 灵魂虚影: 半透明白蓝人形 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    ctx.strokeStyle='rgba(220,240,255,0.95)'; ctx.lineWidth=2; ctx.lineCap='round';
    ctx.shadowBlur=12; ctx.shadowColor='rgba(180,220,255,1)';
    var sway=Math.sin(t*0.005)*2;
    ctx.beginPath(); ctx.arc(sway*0.4,-19,6.4,0,6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sway*0.3,-12); ctx.quadraticCurveTo(sway,-2,0,8);
    ctx.moveTo(sway*0.3-8,-6); ctx.quadraticCurveTo(sway-10,2,-7,10);
    ctx.moveTo(sway*0.3+8,-6); ctx.quadraticCurveTo(sway+10,2,7,10);
    ctx.stroke();
    /* 下摆化雾 */
    ctx.beginPath(); ctx.moveTo(-6,9); ctx.quadraticCurveTo(sway,17,-2,24);
    ctx.moveTo(6,9); ctx.quadraticCurveTo(sway+2,18,3,25); ctx.stroke();
    ctx.shadowBlur=0;
    var bg2=ctx.createRadialGradient(0,-4,0,0,-4,22);
    bg2.addColorStop(0,'rgba(200,230,255,0.28)'); bg2.addColorStop(1,'rgba(180,220,255,0)');
    ctx.fillStyle=bg2; ctx.beginPath(); ctx.arc(0,-4,22,0,6.283); ctx.fill();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6500,endMs:4600,
  busy:function(st){ return gulpT>0&&st.t-gulpT<900; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    gate.x=st.bx-96*sz; gate.y=st.by+34*sz;
    /* ①0-800 冥界之门升起+冷雾 */
    gate.a=Math.min(1,t/550);
    if(t<2000&&gate.a>0.5&&Math.random()<0.4)F.jet(st.P,gate.x+rnd(-20,20)*sz,gate.y+18*sz,-1.57,0.6,C_D,1,1.6,sz);
    /* ②700-1600 巨型胡狼虚影浮现于boss上方 + 冷焰吐息一道 */
    jackal.a=Math.min(1,Math.max(0,(t-700)/450))*(t>3500?Math.max(0,1-(t-3500)/500):1);
    if(!st.fired.howl&&t>=1250){ st.fired.howl=1;
      for(var k=0;k<10;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var p=kk/10; var x=st.bx+40*st.sz+(st.hx-st.bx-40*st.sz)*p, y=st.by-96*st.sz+(st.hy-st.by+96*st.sz)*p;
        F.burst(st.P,x,y,C_B,3,3.5,st.sz);
      },kk*36/st.sp); })(k); }
      F.ring(st.P,st.hx,st.hy,C_B,0.9,3*sz);
      st.fire();
    }
    /* ③1650 短剑悬空刻咒阵(勇者上方双环符阵) */
    if(!st.fired.circ&&t>=1650){ st.fired.circ=1; circleT=t; }
    /* 咒阵完成→2450 光丝从阵心射下缠绕 */
    if(!st.fired.bind&&t>=2450){ st.fired.bind=1;
      for(var q=0;q<6;q++)threads.push({ang:q/6*6.283,ph:rnd(0,6.28),life:0,max:1500});
      F.ring(st.P,st.hx,st.hy,C_B,1.1,3.4*sz);
    }
    for(var ti=threads.length-1;ti>=0;ti--){ threads[ti].life+=st.dt; if(threads[ti].life>threads[ti].max)threads.splice(ti,1); }
    /* ④2900 灵魂离体→被拽向门→3650 门内吞没闪光 */
    if(t>=2900){ soul.a=Math.min(1,(t-2900)/350);
      if(t<3350)soul.y=Math.min(1,(t-2900)/450);
      else soul.pull=Math.min(1,(t-3350)/320);
    }
    if(!st.fired.gulp&&t>=3680){ st.fired.gulp=1; gulpT=t;
      F.flash(st.P,gate.x,gate.y-14*sz,C_W,44*sz,280);
      F.ring(st.P,gate.x,gate.y-14*sz,C_B,1.3,4*sz);
      F.burst(st.P,gate.x,gate.y-14*sz,C_W,16,6.5,sz);
      F.flash(st.P,st.hx,st.hy,C_B,50*sz,260);
      F.ring(st.P,st.hx,st.hy,C_W,1.5,4.5*sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3.2*sz);
      F.burst(st.P,st.hx,st.hy,C_B,20,7.5,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(gate.a>0)drawGate(ctx,gate.x,gate.y,1.15*sz,gate.a*(t>4300?Math.max(0,1-(t-4300)/300):1),Math.min(1,t/900));
    /* 短剑刻阵(围着咒阵缓慢绕划) */
    if(circleT>0&&t-circleT<1300){ var pr=(t-circleT)/1300;
      var ca=pr*9.4;
      var cx=st.hx+Math.cos(ca)*54*sz, cy=st.hy-92*sz+Math.sin(ca)*26*sz;
      drawDagger(ctx,cx,cy,1.05*sz,ca+1.57,pr>0.88?(1-pr)/0.12:1);
      if(Math.random()<0.5)F.burst(st.P,cx,cy,C_B,1,2,sz);
    }
    /* 灵魂虚影 */
    if(soul.a>0&&gulpT<0){ var sx2=st.hx+(gate.x-st.hx)*soul.pull;
      var sy2=st.hy-soul.y*40*sz+(gate.y-14*sz-(st.hy-40*sz))*soul.pull;
      drawSoul(ctx,sx2,sy2,1.35*sz*(1-soul.pull*0.35),soul.a*(1-soul.pull*0.25),t);
      if(soul.pull>0&&Math.random()<0.6)F.suck(st.P,sx2+rnd(-14,14)*sz,sy2+rnd(-20,20)*sz,gate.x,gate.y-14*sz,C_B,sz);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(jackal.a>0)drawJackal(ctx,st.bx+34*sz,st.by-98*sz,1.25*sz,jackal.a,t);
    /* 空中咒阵(双环反向转+符文) */
    if(circleT>0){ var age=t-circleT;
      var build=Math.min(1,age/1200), fade=t>3900?Math.max(0,1-(t-3900)/450):1;
      if(fade>0){ var cx=st.hx, cy=st.hy-92*sz;
        ctx.save(); ctx.globalAlpha=fade;
        ctx.strokeStyle=g(C_B+',0.9'); ctx.lineWidth=1.8*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_B+',1');
        ctx.beginPath(); ctx.ellipse(cx,cy,54*sz,26*sz,0,0,6.283*build); ctx.stroke();
        if(build>0.5){ ctx.beginPath(); ctx.ellipse(cx,cy,40*sz,19*sz,0,0,6.283*Math.min(1,(build-0.5)*2)); ctx.stroke(); }
        ctx.shadowBlur=0;
        if(build>=1){ var SY2='𓂀☥𓋹𓁹𓆣▽';
          ctx.fillStyle='#cfe6ff'; ctx.font=(11*sz)+'px serif'; ctx.textAlign='center';
          for(var k=0;k<6;k++){ var a2=k/6*6.283+t*0.0009;
            ctx.fillText(SY2[k],cx+Math.cos(a2)*47*sz,cy+Math.sin(a2)*22*sz+4*sz); }
          for(var k2=0;k2<6;k2++){ var a3=-k2/6*6.283-t*0.0012;
            ctx.fillText(SY2[5-k2],cx+Math.cos(a3)*33*sz,cy+Math.sin(a3)*15*sz+3*sz); } }
        ctx.restore();
      } }
    /* 束缚光丝(阵心垂下缠绕勇者) */
    for(var ti=0;ti<threads.length;ti++){ var th=threads[ti];
      var pr2=th.life/th.max, env=Math.sin(Math.min(1,pr2*1.25)*3.14);
      var cx2=st.hx, cy2=st.hy-92*sz;
      ctx.strokeStyle=g(C_B+','+(0.8*env)); ctx.lineWidth=1.7*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.moveTo(cx2+Math.cos(th.ang)*30*sz,cy2+Math.sin(th.ang)*14*sz);
      var reach=Math.min(1,pr2*2.2);
      var ex=st.hx+Math.cos(th.ang+t*0.002)*26*sz*reach, ey=st.hy+Math.sin(th.ang+t*0.002)*16*sz*reach;
      ctx.quadraticCurveTo(cx2+Math.cos(th.ang)*46*sz,(cy2+ey)/2+Math.sin(th.ph+t*0.004)*10*sz, ex,cy2+(ey-cy2)*reach+(1-reach)*10*sz);
      ctx.stroke(); ctx.shadowBlur=0;
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ④v4 古埃及大祭司·真理之口的裁决者 —— 巨型天平降临→心脏离体上盘→摇摆称量→骤沉判罪→冥火审判 */
function fxDajisi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,210,90', C_E='90,255,170', C_W='255,246,220', C_R2='255,90,90';
  var scaleS={a:0,y:0,tilt:0,sway:0}, feather={a:0,drop:0}, heart={a:0,p:0,beat:0}, judgeT=-1, fireT=-1;
  function drawScaleBig(ctx,x,y,s,tilt,a,t){ /* 巨型黄金天平: 立柱+横梁+链吊双盘 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    var gg2=ctx.createLinearGradient(-2,-40,2,40); gg2.addColorStop(0,'#f0d080'); gg2.addColorStop(.5,'#caa64a'); gg2.addColorStop(1,'#8a6a24');
    ctx.strokeStyle='#6a4f18'; ctx.lineWidth=1.4;
    /* 底座+立柱 */
    ctx.fillStyle=gg2; ctx.beginPath(); ctx.ellipse(0,46,20,5,0,0,6.283); ctx.fill(); ctx.stroke();
    ctx.fillRect(-3,-34,6,80); ctx.strokeRect(-3,-34,6,80);
    /* 柱顶太阳饰 */
    ctx.beginPath(); ctx.arc(0,-40,6,0,6.283); ctx.fill(); ctx.stroke();
    for(var k=0;k<8;k++){ var a2=k/8*6.283;
      ctx.beginPath(); ctx.moveTo(Math.cos(a2)*7,-40+Math.sin(a2)*7); ctx.lineTo(Math.cos(a2)*10,-40+Math.sin(a2)*10); ctx.stroke(); }
    /* 横梁(随tilt旋转) */
    ctx.save(); ctx.translate(0,-32); ctx.rotate(tilt);
    ctx.fillStyle=gg2; ctx.fillRect(-46,-2.6,92,5.2); ctx.strokeRect(-46,-2.6,92,5.2);
    ctx.beginPath(); ctx.arc(-46,0,3,0,6.283); ctx.fill(); ctx.beginPath(); ctx.arc(46,0,3,0,6.283); ctx.fill();
    /* 双盘链 */
    for(var e=-1;e<=1;e+=2){ var px=46*e;
      ctx.strokeStyle='#b8934a'; ctx.lineWidth=1.1;
      for(var c2=-1;c2<=1;c2+=2){ ctx.beginPath(); ctx.moveTo(px+c2*2,2); ctx.lineTo(px+c2*9,20); ctx.stroke(); }
      ctx.strokeStyle='#6a4f18'; ctx.lineWidth=1.4;
      ctx.fillStyle=gg2;
      ctx.beginPath(); ctx.ellipse(px,22,13,4,0,0,3.4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px,21,13,3.4,0,3.2,6.2); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
  function drawFeather(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.strokeStyle='#f4f8ff'; ctx.lineWidth=1.3; ctx.shadowBlur=8; ctx.shadowColor='rgba(240,248,255,1)';
    ctx.beginPath(); ctx.moveTo(0,9); ctx.quadraticCurveTo(2.4,-2,0,-11); ctx.stroke();
    for(var f2=0;f2<6;f2++){ var fy=6-f2*2.9;
      ctx.beginPath(); ctx.moveTo(0,fy); ctx.quadraticCurveTo(-3,fy-1.4,-4.6,fy-2.6);
      ctx.moveTo(0,fy); ctx.quadraticCurveTo(3,fy-1.4,4.6,fy-2.6); ctx.stroke(); }
    ctx.shadowBlur=0; ctx.restore();
  }
  function drawHeart(ctx,x,y,s,a,beat){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s*(1+beat*0.14),s*(1+beat*0.14));
    var hg=ctx.createRadialGradient(-2,-3,1,0,0,12);
    hg.addColorStop(0,'#ff9a94'); hg.addColorStop(.5,'#e83848'); hg.addColorStop(1,'#8a1424');
    ctx.fillStyle=hg; ctx.shadowBlur=14; ctx.shadowColor='rgba(255,90,90,0.95)';
    ctx.beginPath();
    ctx.moveTo(0,10);
    ctx.bezierCurveTo(-11,1,-11,-8,-5,-8);
    ctx.bezierCurveTo(-2,-8,0,-5,0,-3.4);
    ctx.bezierCurveTo(0,-5,2,-8,5,-8);
    ctx.bezierCurveTo(11,-8,11,1,0,10);
    ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(120,16,32,0.8)'; ctx.lineWidth=1; ctx.stroke();
    ctx.strokeStyle='rgba(255,200,200,0.7)'; ctx.lineWidth=0.9;
    ctx.beginPath(); ctx.moveTo(-4,-4); ctx.quadraticCurveTo(-1,0,1,4); ctx.stroke();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6500,endMs:4600,
  busy:function(st){ return fireT>0&&st.t-fireT<900; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    var scX=st.bx+96*sz, scY=st.by-8*sz;
    /* ①0-700 巨型天平自上降临 + 真理羽落入左盘 */
    scaleS.a=Math.min(1,t/420); scaleS.y=1-Math.pow(1-Math.min(1,t/650),3);
    feather.a=Math.min(1,Math.max(0,(t-500)/300));
    feather.drop=Math.min(1,Math.max(0,(t-500)/520));
    if(t<700&&Math.random()<0.4)F.suck(st.P,scX+rnd(-70,70)*sz,scY+rnd(-60,60)*sz,scX,scY-32*sz,C_G,sz);
    /* ②900 勇者心脏离体飘向右盘 */
    if(t>=900){ heart.a=Math.min(1,(t-900)/300);
      heart.p=Math.min(1,Math.max(0,(t-1050)/620));
      heart.beat=Math.abs(Math.sin(t*0.012));
      if(heart.p>0&&heart.p<1&&Math.random()<0.4)F.burst(st.P,st.hx+(scX+46*sz*1.5-st.hx)*heart.p,st.hy-24*sz,C_R2,1,1.6,sz);
    }
    if(!st.fired.land&&heart.p>=1){ st.fired.land=1;
      F.burst(st.P,scX+46*1.5*sz,scY-10*sz,C_R2,7,4,sz);
      F.ring(st.P,scX+46*1.5*sz,scY-10*sz,C_G,0.6,2*sz);
    }
    /* ③1750-2750 摇摆称量三次 */
    if(t>=1750&&t<2750){ scaleS.sway=Math.sin((t-1750)*0.0068)*0.24*(1-(t-1750)/1400);
      scaleS.tilt=scaleS.sway;
      if(!st.fired.tick1&&t>=2050){ st.fired.tick1=1; F.ring(st.P,scX,scY-32*sz,C_G,0.55,1.8*sz); }
      if(!st.fired.tick2&&t>=2400){ st.fired.tick2=1; F.ring(st.P,scX,scY-32*sz,C_G,0.6,2*sz); }
    }
    /* ④2780 骤沉判罪(心脏侧猛沉)→冥火审判 */
    if(!st.fired.judge&&t>=2780){ st.fired.judge=1; judgeT=t;
      F.flash(st.P,scX+40*sz,scY-14*sz,C_R2,26*sz,220);
      F.burst(st.P,scX+40*sz,scY-14*sz,C_R2,10,5,sz);
      st.fire();
    }
    if(judgeT>0)scaleS.tilt=Math.min(0.52,scaleS.tilt+st.dt*0.0032);
    if(!st.fired.fire2&&t>=3160){ st.fired.fire2=1; fireT=t;
      F.flash(st.P,st.hx,st.hy,C_E,66*sz,320);
      F.ring(st.P,st.hx,st.hy,C_E,1.8,6*sz); F.ring(st.P,st.hx,st.hy,C_G,1.2,4*sz); F.ring(st.P,st.hx,st.hy,C_W,0.8,2.6*sz);
      F.burst(st.P,st.hx,st.hy,C_E,26,8.5,sz); F.burst(st.P,st.hx,st.hy,C_G,14,6.5,sz);
      for(var e=-1;e<=1;e+=2){ (function(ee){ for(var k=0;k<12;k++){ setTimeout(function(){ if(st.dead)return;
        F.jet(st.P,st.hx+ee*54*st.sz,st.hy+30*st.sz,-1.57,0.32,C_E,3,6.5,st.sz);
      },k*44/st.sp); } })(e); }
      /* 心脏碎裂红光粒 */
      F.burst(st.P,st.bx+96*sz+46*1.5*sz,st.by-18*sz,C_R2,14,6,sz);
      F.shards(st.P,st.bx+96*sz+46*1.5*sz,st.by-18*sz,C_R2,8,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var scX=st.bx+96*sz, scY=st.by-8*sz+(1-scaleS.y)*-110*sz;
    var fadeAll=t>4200?Math.max(0,1-(t-4200)/400):1;
    if(scaleS.a>0)drawScaleBig(ctx,scX,scY,1.5*sz,scaleS.tilt,scaleS.a*fadeAll,t);
    /* 真理羽(落入左盘: 横梁左端下方) */
    if(feather.a>0){ var lift=Math.cos(scaleS.tilt)*46*1.5*sz, sink=Math.sin(scaleS.tilt)*46*1.5*sz;
      var fx2=scX-lift, fy=scY-32*1.5*sz-sink+22*1.5*sz;
      var dy=(1-feather.drop)*-60*sz;
      drawFeather(ctx,fx2,fy-8*sz+dy,1.5*sz,Math.sin(t*0.004)*0.14,feather.a*fadeAll);
    }
    /* 心脏(离体→飞盘→落盘搏动; 判罪后碎裂消失) */
    if(heart.a>0&&t<3160){ var lift2=Math.cos(scaleS.tilt)*46*1.5*sz, sink2=Math.sin(scaleS.tilt)*46*1.5*sz;
      var tx=scX+lift2, ty=scY-32*1.5*sz+sink2+22*1.5*sz-9*sz;
      var hx2,hy2;
      if(heart.p<1){ hx2=st.hx+(tx-st.hx)*heart.p; hy2=(st.hy-6*sz)+(ty-(st.hy-6*sz))*heart.p-Math.sin(heart.p*3.14)*46*sz; }
      else { hx2=tx; hy2=ty; }
      drawHeart(ctx,hx2,hy2,1.15*sz,heart.a,heart.beat*(heart.p<1?1:0.6));
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 勇者胸口离体光(②幕起点) */
    if(t>=900&&t<1500){ var a=Math.sin(Math.min(1,(t-900)/600)*3.14)*0.7;
      var cg=ctx.createRadialGradient(st.hx,st.hy-6*sz,0,st.hx,st.hy-6*sz,26*sz);
      cg.addColorStop(0,g(C_R2+','+a)); cg.addColorStop(1,g(C_R2+',0'));
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(st.hx,st.hy-6*sz,26*sz,0,6.283); ctx.fill();
    }
    /* 判罪红闪字环(骤沉时) */
    if(judgeT>0&&t-judgeT<600){ var pr=(t-judgeT)/600, env=Math.sin(pr*3.14);
      ctx.save(); ctx.globalAlpha=env*0.9;
      ctx.strokeStyle=g(C_R2+',0.9'); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_R2+',1');
      ctx.beginPath(); ctx.arc(st.bx+96*sz,st.by-40*sz,26*sz+pr*16*sz,0,6.283); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 冥火审判金柱 */
    if(fireT>0&&t-fireT<800){ var pr2=(t-fireT)/800, env2=Math.sin(pr2*3.14);
      var w=46*sz*env2;
      var vg=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      vg.addColorStop(0,g(C_E+',0')); vg.addColorStop(.5,g(C_G+','+(0.6*env2))); vg.addColorStop(1,g(C_E+',0'));
      ctx.fillStyle=vg; ctx.fillRect(st.hx-w,0,w*2,st.barBot+18);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
