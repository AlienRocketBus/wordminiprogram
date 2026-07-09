/* ═══ 批3: 科幻/武者/自然组 6 boss ═══ */

/* ⑬万械之神·奥米伽 —— 六眼锁定+机械触手海+核心巨激光 */
function fxOmega(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,60,50', C_O='255,150,60', C_M='180,195,215';
  var tents=[], laserT=-1, lockT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return laserT>0&&st.t-laserT<760; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 六眼锁定扫描 */
    if(!st.fired.lock&&t>=120){ st.fired.lock=1; lockT=t; }
    /* ②800起 机械触手海(从画面下方两侧伸出抽向勇者) */
    if(!st.fired.tent&&t>=800){ st.fired.tent=1;
      for(var i=0;i<5;i++){ tents.push({ts:800+i*220,side:i%2?1:-1,ox:rnd(0.2,0.9),done:false,segN:5}); }
      st.fire();
    }
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(!tn.done&&t>=tn.ts+240){ tn.done=true;
        F.burst(st.P,st.hx,st.hy,C_O,8,6,sz); F.ring(st.P,st.hx,st.hy,C_R,0.8,2.6*sz);
      } }
    /* ③2100 工厂矩阵齐射(小炮口从boss周围齐射) */
    if(!st.fired.mat&&t>=2100){ st.fired.mat=1;
      for(var k=0;k<8;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var a=(kk/8-0.5)*1.2; var x0=st.bx+Math.cos(a+1.57)*90*st.sz, y0=st.by+Math.sin(a+1.57)*50*st.sz-40*st.sz;
        F.trail(st.P,x0,y0,st.hx+rnd(-30,30)*st.sz,st.hy+rnd(-18,18)*st.sz,C_O,3*st.sz,220);
        F.burst(st.P,st.hx,st.hy,C_O,3,4.5,st.sz);
      },kk*70/st.sp); })(k); }
    }
    /* ④2850 核心巨激光 */
    if(!st.fired.laser&&t>=2850){ st.fired.laser=1; laserT=t;
      F.flash(st.P,st.hx,st.hy,C_R,66*sz,300);
      F.ring(st.P,st.hx,st.hy,C_R,1.6,5.5*sz); F.burst(st.P,st.hx,st.hy,C_R,26,8,sz);
      F.shards(st.P,st.hx,st.hy,C_M,14,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 机械触手(节段金属管+末端钳) */
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(t>=tn.ts&&t<tn.ts+320){ var pr=(t-tn.ts)/320;
        var reach=pr<0.6?pr/0.6:1-(pr-0.6)/0.4*0.2;
        var x0=st.hx+tn.side*(150+tn.ox*80)*sz, y0=st.barBot+10;
        var ex=st.hx+tn.side*18*sz*(1-reach), ey=st.hy+10*sz*(1-reach);
        var a=pr>0.85?(1-pr)/0.15:1;
        ctx.save(); ctx.globalAlpha=a;
        var px=x0,py=y0;
        for(var s2=1;s2<=tn.segN;s2++){ var p2=s2/tn.segN;
          var nx=x0+(ex-x0)*p2+tn.side*Math.sin(p2*3.14)*36*sz*(1-reach*0.5);
          var ny=y0+(ey-y0)*p2;
          var w=(9-s2*1.2)*sz;
          var mg=ctx.createLinearGradient(px,py,nx,ny); mg.addColorStop(0,'#4a5568'); mg.addColorStop(.5,'#8a98ac'); mg.addColorStop(1,'#3a4354');
          ctx.strokeStyle=mg; ctx.lineWidth=w; ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(nx,ny); ctx.stroke();
          ctx.fillStyle='#2a3140'; ctx.beginPath(); ctx.arc(nx,ny,w*0.6,0,6.283); ctx.fill();
          px=nx;py=ny; }
        /* 末端钳爪 */
        ctx.strokeStyle='#c8d4e2'; ctx.lineWidth=2.4*sz;
        for(var e2=-1;e2<=1;e2+=2){ ctx.beginPath(); ctx.moveTo(px,py); ctx.quadraticCurveTo(px+e2*8*sz,py-8*sz,px+e2*4*sz,py-14*sz); ctx.stroke(); }
        ctx.fillStyle='#ff4838'; ctx.beginPath(); ctx.arc(px,py,2.4*sz,0,6.283); ctx.fill();
        ctx.restore();
      } }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 六眼锁定线(六道红线交汇勇者) */
    if(lockT>0&&t-lockT<900){ var pr=(t-lockT)/900, env=Math.sin(pr*3.14);
      for(var k=0;k<6;k++){ var a=k/6*6.283+0.5;
        var x0=st.bx+Math.cos(a)*46*sz, y0=st.by-30*sz+Math.sin(a)*30*sz;
        ctx.strokeStyle=g(C_R+','+(0.55*env)); ctx.lineWidth=1.2*sz; ctx.setLineDash([5*sz,4*sz]);
        ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(st.hx,st.hy); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle=g(C_R+','+env); ctx.shadowBlur=8; ctx.shadowColor=g(C_R+',1');
        ctx.beginPath(); ctx.arc(x0,y0,2.6*sz,0,6.283); ctx.fill(); ctx.shadowBlur=0; }
      /* 锁定框 */
      ctx.strokeStyle=g(C_R+','+(0.85*env)); ctx.lineWidth=1.6*sz;
      var R=34*sz; 
      for(var c2=0;c2<4;c2++){ var ca=c2*1.5708+0.785;
        var cx=st.hx+Math.cos(ca)*R, cy=st.hy+Math.sin(ca)*R;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-Math.cos(ca)*10*sz,cy); ctx.moveTo(cx,cy); ctx.lineTo(cx,cy-Math.sin(ca)*10*sz); ctx.stroke(); }
    }
    /* 核心巨激光(粗红柱从boss射向勇者) */
    if(laserT>0&&t-laserT<760){ var pr2=(t-laserT)/760, env2=Math.sin(pr2*3.14);
      var w=20*sz*env2;
      ctx.save();
      var a3=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.translate(st.bx,st.by); ctx.rotate(a3);
      var L=Math.hypot(st.hx-st.bx,st.hy-st.by);
      var lg=ctx.createLinearGradient(0,-w,0,w); lg.addColorStop(0,g(C_R+',0')); lg.addColorStop(.5,g(C_R+','+(0.8*env2))); lg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=lg; ctx.fillRect(0,-w,L,w*2);
      ctx.fillStyle=g('255,255,255,'+(0.85*env2)); ctx.fillRect(0,-w*0.22,L,w*0.44);
      ctx.restore();
      if(Math.random()<0.8)F.jet(st.P,st.hx,st.hy,a3+3.14+rnd(-0.9,0.9),0.5,C_O,2,5,sz);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑭丛林幽灵·兵王 —— 烟雾弹→狙击红线→闪光+军刀→地雷手雷齐爆 */
function fxBingwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,60,50', C_O='255,170,70', C_G2='150,255,120', C_K='200,210,190';
  var smokes=[], snipeT=-1, flashT=-1, knives=[], boomT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return boomT>0&&st.t-boomT<700; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①100 烟雾弹落点冒烟 */
    if(!st.fired.smk&&t>=100){ st.fired.smk=1;
      for(var i=0;i<3;i++)smokes.push({x:st.hx+rnd(-70,70)*sz,y:st.hy+rnd(10,40)*sz,r:0,life:0,max:1900,delay:i*130});
    }
    for(var si2=smokes.length-1;si2>=0;si2--){ var sm=smokes[si2];
      if(sm.delay>0){sm.delay-=st.dt;continue;}
      sm.life+=st.dt; sm.r=Math.min(46*sz,sm.r+st.dt*0.05);
      if(sm.life>sm.max)smokes.splice(si2,1); }
    /* ②900 狙击: 红色瞄准线扫→定格→狙杀 */
    if(!st.fired.snipe&&t>=900){ st.fired.snipe=1; snipeT=t; }
    if(!st.fired.shot&&snipeT>0&&t-snipeT>=620){ st.fired.shot=1;
      F.trail(st.P,st.bx+60*sz,st.by-20*sz,st.hx,st.hy,C_O,4*sz,180);
      F.burst(st.P,st.hx,st.hy,C_O,12,7,sz); F.ring(st.P,st.hx,st.hy,C_R,1.0,3*sz);
      F.flash(st.P,st.bx+60*sz,st.by-20*sz,C_O,20*sz,140);
      st.fire();
    }
    /* ③1900 闪光弹+军刀三连 */
    if(!st.fired.fb&&t>=1900){ st.fired.fb=1; flashT=t;
      F.flash(st.P,st.hx,st.hy-30*sz,'255,255,255',80*sz,340);
    }
    if(!st.fired.kn&&t>=2150){ st.fired.kn=1;
      for(var k=0;k<3;k++)knives.push({ts:2150+k*220,ang:[-0.6,0.5,-0.1][k],done:false});
    }
    for(var ki=0;ki<knives.length;ki++){ var kn=knives[ki];
      if(!kn.done&&t>=kn.ts+130){ kn.done=true;
        F.beam(st.P,st.hx,st.hy,kn.ang,C_K,1.05,false);
        F.burst(st.P,st.hx,st.hy,C_K,6,5,sz);
      } }
    /* ④2900 定向地雷+手雷齐爆 */
    if(!st.fired.boom&&t>=2900){ st.fired.boom=1; boomT=t;
      for(var q=0;q<3;q++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        var bx2=st.hx+(qq-1)*46*st.sz, by2=st.hy+(qq%2?14:-8)*st.sz;
        F.flash(st.P,bx2,by2,C_O,44*st.sz,240);
        F.burst(st.P,bx2,by2,C_O,14,7.5,st.sz); F.ring(st.P,bx2,by2,C_R,1.1,3.5*st.sz);
        F.shards(st.P,bx2,by2,'120,110,90',8,st.sz);
      },qq*130/st.sp); })(q); }
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 烟雾(实体灰团) */
    for(var si2=0;si2<smokes.length;si2++){ var sm=smokes[si2]; if(sm.delay>0)continue;
      var pr=sm.life/sm.max, a=pr<0.15?pr/0.15:(1-pr)*0.8;
      var sg=ctx.createRadialGradient(sm.x,sm.y,0,sm.x,sm.y,sm.r);
      sg.addColorStop(0,'rgba(150,160,150,'+(a*0.55)+')'); sg.addColorStop(1,'rgba(120,130,120,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sm.x,sm.y,sm.r,0,6.283); ctx.fill(); }
    /* 军刀实体(挥砍瞬间) */
    for(var ki=0;ki<knives.length;ki++){ var kn=knives[ki];
      if(t>=kn.ts&&t<kn.ts+170){ var pr2=(t-kn.ts)/170;
        var sw=(pr2-0.5)*2.2;
        ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(kn.ang+sw);
        ctx.globalAlpha=pr2>0.8?(1-pr2)/0.2:1;
        ctx.fillStyle='#1e2418'; ctx.fillRect(-3*sz,10*sz,6*sz,16*sz);
        var kg=ctx.createLinearGradient(-3*sz,0,3*sz,0); kg.addColorStop(0,'#5a6a58'); kg.addColorStop(.5,'#d8e2d0'); kg.addColorStop(1,'#3a4638');
        ctx.fillStyle=kg; ctx.beginPath(); ctx.moveTo(-3*sz,10*sz); ctx.lineTo(-2*sz,-34*sz); ctx.lineTo(2*sz,-42*sz); ctx.lineTo(3*sz,10*sz); ctx.closePath(); ctx.fill();
        ctx.restore();
      } }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 狙击红线(缓慢锁定·带呼吸) */
    if(snipeT>0&&t-snipeT<620){ var pr=(t-snipeT)/620;
      var wob=(1-pr)*20*sz;
      var tx=st.hx+Math.sin(t*0.01)*wob, ty=st.hy+Math.cos(t*0.013)*wob;
      ctx.strokeStyle=g(C_R+','+(0.5+pr*0.4)); ctx.lineWidth=1.2*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(st.bx+60*sz,st.by-20*sz); ctx.lineTo(tx,ty); ctx.stroke(); ctx.shadowBlur=0;
      ctx.strokeStyle=g(C_R+',0.9'); ctx.lineWidth=1*sz;
      ctx.beginPath(); ctx.arc(tx,ty,8*sz,0,6.283); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(tx-13*sz,ty); ctx.lineTo(tx+13*sz,ty); ctx.moveTo(tx,ty-13*sz); ctx.lineTo(tx,ty+13*sz); ctx.stroke();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑮决斗大师·千招之约 —— 金色决斗圈+拳肘连段残影+蓄力正拳冲击波 */
function fxJuedou(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,205,110', C_W='255,250,235', C_B3='140,200,255';
  var circleA=0, punches=[], finT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3700,
  busy:function(st){ return finT>0&&st.t-finT<680; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    circleA=Math.min(1,t/550);
    /* ②650起 拳肘连段5击 */
    if(!st.fired.pn&&t>=650){ st.fired.pn=1;
      var offs=[[-30,-14],[26,-8],[-18,12],[30,10],[0,-4]];
      for(var i=0;i<5;i++)punches.push({ts:650+i*190,dx:offs[i][0],dy:offs[i][1],done:false});
      st.fire();
    }
    for(var pi=0;pi<punches.length;pi++){ var p=punches[pi];
      if(!p.done&&t>=p.ts+95){ p.done=true;
        F.burst(st.P,st.hx+p.dx*sz,st.hy+p.dy*sz,C_G,7,5.5,sz);
        F.ring(st.P,st.hx+p.dx*sz,st.hy+p.dy*sz,C_W,0.7,2.2*sz);
      } }
    /* ③1900 千招乱舞(密集小冲击) */
    if(!st.fired.rush&&t>=1900){ st.fired.rush=1;
      for(var k=0;k<9;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var x=st.hx+rnd(-42,42)*st.sz, y=st.hy+rnd(-26,26)*st.sz;
        F.burst(st.P,x,y,kk%2?C_G:C_B3,4,5,st.sz);
        F.beam(st.P,x,y,rnd(-1.4,1.4),C_W,0.65,false);
      },kk*80/st.sp); })(k); }
    }
    /* ④2800 蓄力正拳: 大冲击波 */
    if(!st.fired.fin&&t>=2800){ st.fired.fin=1; finT=t;
      F.flash(st.P,st.hx,st.hy,C_G,60*sz,280);
      F.ring(st.P,st.hx,st.hy,C_G,1.9,6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_B3,0.8,2.6*sz);
      F.burst(st.P,st.hx,st.hy,C_G,24,8.5,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 拳头残影(实体拳: 肤色拳+手套) */
    for(var pi=0;pi<punches.length;pi++){ var p=punches[pi];
      if(t>=p.ts&&t<p.ts+150){ var pr=(t-p.ts)/150;
        var reach=pr<0.55?pr/0.55:1;
        var x0=st.bx, y0=st.by+10*sz;
        var x=x0+(st.hx+p.dx*sz-x0)*(0.35+reach*0.65), y=y0+(st.hy+p.dy*sz-y0)*(0.35+reach*0.65);
        var a=pr>0.7?(1-pr)/0.3:1;
        ctx.save(); ctx.globalAlpha=a*0.95; ctx.translate(x,y);
        ctx.rotate(Math.atan2(st.hy+p.dy*sz-y0,st.hx+p.dx*sz-x0));
        ctx.fillStyle='#20283c'; ctx.fillRect(-16*sz,-5*sz,12*sz,10*sz);
        ctx.fillStyle='#e8b890';
        ctx.beginPath(); ctx.arc(0,0,7.5*sz,0,6.283); ctx.fill();
        ctx.strokeStyle='#c08858'; ctx.lineWidth=1*sz;
        for(var f2=0;f2<3;f2++){ ctx.beginPath(); ctx.moveTo(2*sz,(f2-1)*4*sz); ctx.lineTo(7*sz,(f2-1)*4*sz); ctx.stroke(); }
        ctx.restore();
        /* 拳风拖尾 */
        if(Math.random()<0.6)F.trail(st.P,x0+(x-x0)*0.5,y0+(y-y0)*0.5,x,y,C_W,3*sz,150);
      } }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 金色决斗圈(地面椭圆) */
    if(circleA>0){ var cy=st.hy+52*sz;
      ctx.save(); ctx.globalAlpha=circleA*0.9;
      ctx.strokeStyle=g(C_G+',0.85'); ctx.lineWidth=2.6*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.ellipse(st.hx,cy,105*sz,26*sz,0,0,6.283); ctx.stroke();
      ctx.setLineDash([2*sz,7*sz]); ctx.lineWidth=1.4*sz;
      ctx.beginPath(); ctx.ellipse(st.hx,cy,90*sz,20*sz,0,0,6.283); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
    }
    /* 蓄力正拳冲击波扇面 */
    if(finT>0&&t-finT<680){ var pr=(t-finT)/680, env=Math.sin(Math.min(1,pr*1.1)*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy);
      var R=100*sz*pr;
      var cg=ctx.createRadialGradient(0,0,R*0.3,0,0,R);
      cg.addColorStop(0,g(C_W+',0')); cg.addColorStop(.75,g(C_G+','+(0.5*env))); cg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill();
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑯凋零与新生之龙·四季轮转 —— 春樱→夏炎→秋叶→冬雪 四幕轮转 */
function fxSijilong(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var petals=[], leaves=[], flakes=[], seasonT={spring:-1,summer:-1,autumn:-1,winter:-1};
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6000,endMs:4100,
  busy:function(st){ return petals.length>0||leaves.length>0||flakes.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①春 0-1000: 樱瓣龙息 */
    if(!st.fired.sp2&&t>=120){ st.fired.sp2=1; seasonT.spring=t; }
    if(t<1000&&Math.random()<0.5){ petals.push({x:st.bx+rnd(-40,40)*sz,y:st.by+rnd(-30,30)*sz,tx:st.hx+rnd(-60,60)*sz,ty:st.hy+rnd(-30,40)*sz,p:0,spd:rnd(0.0009,0.0015),rot:rnd(0,6.28),vrot:rnd(-0.1,0.1),ph:rnd(0,6.28)}); }
    /* ②夏 1050: 烈日炎息 */
    if(!st.fired.su&&t>=1050){ st.fired.su=1; seasonT.summer=t;
      for(var k=0;k<12;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var p=kk/12; F.burst(st.P,st.bx+(st.hx-st.bx)*p,st.by+(st.hy-st.by)*p,'255,150,50',4,4.5,st.sz);
      },kk*40/st.sp); })(k); }
      F.flash(st.P,st.hx,st.hy,'255,180,80',40*sz,240); F.ring(st.P,st.hx,st.hy,'255,150,50',1.0,3*sz);
      st.fire();
    }
    /* ③1950: 秋·金叶风暴 */
    if(!st.fired.au&&t>=1950){ st.fired.au=1; seasonT.autumn=t;
      for(var i=0;i<14;i++)leaves.push({x:st.bx+rnd(-90,90)*sz,y:st.by+rnd(-70,50)*sz,tx:st.hx+rnd(-70,70)*sz,ty:st.hy+rnd(-30,30)*sz,p:0,spd:rnd(0.001,0.0017),rot:rnd(0,6.28),vrot:rnd(-0.2,0.2),delay:i*46});
    }
    /* ④2850: 冬·永冬吐息+冰晶爆 */
    if(!st.fired.wi&&t>=2850){ st.fired.wi=1; seasonT.winter=t;
      for(var q=0;q<16;q++)flakes.push({x:st.hx+rnd(-100,100)*sz,y:st.hy-rnd(60,140)*sz,vy:rnd(1.4,2.6),ph:rnd(0,6.28),r:rnd(2,4)*sz,life:0,max:rnd(700,1100)});
      F.flash(st.P,st.hx,st.hy,'190,230,255',56*sz,280);
      F.ring(st.P,st.hx,st.hy,'170,220,255',1.5,5*sz); F.burst(st.P,st.hx,st.hy,'190,235,255',22,7,sz);
      F.shards(st.P,st.hx,st.hy,'220,245,255',14,sz);
    }
    /* 花瓣运动 */
    for(var pi=petals.length-1;pi>=0;pi--){ var p2=petals[pi]; p2.p+=p2.spd*st.dt;
      if(p2.p>=1){ F.burst(st.P,p2.tx,p2.ty,'255,170,200',2,2.5,st.sz); petals.splice(pi,1); continue; }
      p2.rot+=p2.vrot; }
    for(var li=leaves.length-1;li>=0;li--){ var lf=leaves[li];
      if(lf.delay>0){lf.delay-=st.dt;continue;}
      lf.p+=lf.spd*st.dt;
      if(lf.p>=1){ F.burst(st.P,lf.tx,lf.ty,'255,180,70',3,3.5,st.sz); leaves.splice(li,1); continue; }
      lf.rot+=lf.vrot; }
    for(var fi=flakes.length-1;fi>=0;fi--){ var fk=flakes[fi]; fk.life+=st.dt; fk.y+=fk.vy*st.dt*0.06;
      if(fk.life>fk.max||fk.y>st.barBot)flakes.splice(fi,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 樱瓣(粉色小瓣) */
    for(var pi=0;pi<petals.length;pi++){ var p2=petals[pi];
      var x=p2.x+(p2.tx-p2.x)*p2.p, y=p2.y+(p2.ty-p2.y)*p2.p+Math.sin(p2.ph+p2.p*8)*10*sz;
      ctx.save(); ctx.translate(x,y); ctx.rotate(p2.rot);
      ctx.fillStyle='rgba(255,175,200,.92)';
      ctx.beginPath(); ctx.moveTo(0,-4*sz); ctx.quadraticCurveTo(4*sz,-1*sz,0,4*sz); ctx.quadraticCurveTo(-4*sz,-1*sz,0,-4*sz); ctx.fill();
      ctx.restore(); }
    /* 金叶 */
    for(var li=0;li<leaves.length;li++){ var lf=leaves[li]; if(lf.delay>0)continue;
      var x2=lf.x+(lf.tx-lf.x)*lf.p, y2=lf.y+(lf.ty-lf.y)*lf.p+Math.sin(lf.p*6)*8*sz;
      ctx.save(); ctx.translate(x2,y2); ctx.rotate(lf.rot);
      ctx.fillStyle='rgba(235,160,60,.95)';
      ctx.beginPath(); ctx.moveTo(0,-5*sz); ctx.quadraticCurveTo(4.5*sz,0,0,6*sz); ctx.quadraticCurveTo(-4.5*sz,0,0,-5*sz); ctx.fill();
      ctx.strokeStyle='rgba(160,90,30,.8)'; ctx.lineWidth=0.8*sz;
      ctx.beginPath(); ctx.moveTo(0,-4*sz); ctx.lineTo(0,5*sz); ctx.stroke();
      ctx.restore(); }
    /* 雪花(实体六角) */
    for(var fi=0;fi<flakes.length;fi++){ var fk=flakes[fi];
      var xx=fk.x+Math.sin(fk.ph+fk.life*0.003)*12*sz;
      ctx.save(); ctx.translate(xx,fk.y); ctx.strokeStyle='rgba(230,245,255,.95)'; ctx.lineWidth=1*sz;
      for(var a2=0;a2<6;a2++){ ctx.rotate(1.047);
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-fk.r); ctx.moveTo(0,-fk.r*0.55); ctx.lineTo(fk.r*0.3,-fk.r*0.75); ctx.moveTo(0,-fk.r*0.55); ctx.lineTo(-fk.r*0.3,-fk.r*0.75); ctx.stroke(); }
      ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 夏炎光柱 */
    if(seasonT.summer>0&&t-seasonT.summer<600){ var pr=(t-seasonT.summer)/600, env=Math.sin(pr*3.14);
      var a3=Math.atan2(st.hy-st.by,st.hx-st.bx);
      ctx.save(); ctx.translate(st.bx,st.by); ctx.rotate(a3);
      var L=Math.hypot(st.hx-st.bx,st.hy-st.by), w=16*sz*env;
      var lg=ctx.createLinearGradient(0,-w,0,w); lg.addColorStop(0,'rgba(255,150,50,0)'); lg.addColorStop(.5,g('255,170,60,'+(0.7*env))); lg.addColorStop(1,'rgba(255,150,50,0)');
      ctx.fillStyle=lg; ctx.fillRect(0,-w,L,w*2); ctx.restore();
    }
    /* 冬雪寒雾 */
    if(seasonT.winter>0&&t-seasonT.winter<900){ var pr2=(t-seasonT.winter)/900, env2=Math.sin(pr2*3.14);
      var wg=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,90*sz);
      wg.addColorStop(0,g('190,230,255,'+(0.3*env2))); wg.addColorStop(1,'rgba(190,230,255,0)');
      ctx.fillStyle=wg; ctx.beginPath(); ctx.arc(st.hx,st.hy,90*sz,0,6.283); ctx.fill();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑰剑神·万剑归宗 —— 剑冢万剑升空+飞剑连射+万剑归宗巨剑 */
function fxJianshen(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore, g=F.g, rnd=F.rnd;
  // 冷银蓝剑光配色(呼应剑神立绘的银白+冷蓝)
  var BL='150,195,245', WT='240,248,255', PU='150,120,250', CY='170,225,255';
  var N = Math.round(52 * (fx.fxi||1));           // 剑的数量(多!)
  var swords = [];                                 // 每把剑
  var big = null;                                  // 归一后的巨剑
  var FORMY = null;                                // 归一剑成型点(小剑汇聚到这·剑在这成型·然后向下刺·全程无向后)
  var phase = 0;                                   // 0凝剑 1齐射 2归一 3斩

  // 画一把【武侠古剑】(做旧青铜/铁·灰褐质感·不发光·古朴)——照搬当前特效的残剑风格
  // 周围古剑: 做旧青铜铁·灰褐哑光·古朴
  function drawSword(ctx, x, y, len, rot, a, epic, wide){
    if(epic){ drawEpicSword(ctx,x,y,len,rot,a,wide); return; }
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot);
    var bw=(wide||1), sc=len/34; ctx.scale(sc, sc);
    ctx.fillStyle='#4a4038'; ctx.fillRect(-1.9*bw, 12, 3.8*bw, 11);         // 柄
    ctx.fillStyle='#5a4e40'; ctx.beginPath(); ctx.arc(0, 23, 2.4*bw, 0, 6.283); ctx.fill(); // 剑首
    ctx.fillStyle='#8a7550'; ctx.fillRect(-6.5*bw, 9.5, 13*bw, 3.2);        // 护手
    ctx.fillStyle='#6a5838'; ctx.fillRect(-6.5*bw, 11.5, 13*bw, 1.2);
    var bg=ctx.createLinearGradient(-3*bw,0,3*bw,0);
    bg.addColorStop(0,'#5e5850'); bg.addColorStop(.5,'#a8a294'); bg.addColorStop(1,'#4e4840');
    ctx.fillStyle=bg;
    ctx.beginPath(); ctx.moveTo(-3*bw,10); ctx.lineTo(-2*bw,-len*0.72/sc); ctx.lineTo(0,-len*0.80/sc); ctx.lineTo(2*bw,-len*0.72/sc); ctx.lineTo(3*bw,10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(60,56,48,.6)'; ctx.lineWidth=0.8*bw;
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-len*0.74/sc); ctx.stroke();
    ctx.strokeStyle='rgba(70,64,54,.4)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(-1.2*bw,-8); ctx.lineTo(-1*bw,-len*0.5/sc); ctx.stroke();
    ctx.restore();
  }

  // 归一之剑【精致华丽版】: 修长剑身+血槽+雕花护手+缠柄+宝石剑首·冷银泛青·华贵不俗
  function drawEpicSword(ctx, x, y, len, rot, a, wide){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot);
    var bw=(wide||2.0), sc=len/100; ctx.scale(sc, sc);   // 以100为基准
    var TIP=-len*0.60/sc, SH=len*0.30/sc;                // 剑尖y / 剑身根y(护手处)
    // ── 剑柄(深黑缠绳·金线) ──
    ctx.fillStyle='#2b2620'; ctx.fillRect(-2.4*bw, SH+2, 4.8*bw, 20);
    ctx.strokeStyle='#c9a24a'; ctx.lineWidth=0.9;         // 金缠线
    for(var w=0;w<5;w++){ var yy=SH+5+w*3.6; ctx.beginPath(); ctx.moveTo(-2.4*bw,yy); ctx.lineTo(2.4*bw,yy+2); ctx.stroke(); }
    // ── 剑首(金座+青蓝宝石) ──
    ctx.fillStyle='#b8942e'; ctx.beginPath(); ctx.arc(0, SH+24, 4.2*bw, 0, 6.283); ctx.fill();
    var gem=ctx.createRadialGradient(0,SH+23,0,0,SH+24,3.4*bw);
    gem.addColorStop(0,'#dff2ff'); gem.addColorStop(.5,'#5bc8e8'); gem.addColorStop(1,'#1f6f9a');
    ctx.fillStyle=gem; ctx.beginPath(); ctx.arc(0, SH+24, 3*bw, 0, 6.283); ctx.fill();
    // 剑穗(垂下的流苏)
    ctx.strokeStyle='#c9a24a'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(0,SH+28); ctx.quadraticCurveTo(5*bw,SH+40,3*bw,SH+52); ctx.stroke();
    ctx.fillStyle='#d94f6a'; ctx.beginPath(); ctx.ellipse(3*bw,SH+54,2.2,4.5,0,0,6.283); ctx.fill();
    // ── 护手(雕花如意云头·金) ──
    var gg=ctx.createLinearGradient(0,SH-1,0,SH+4);
    gg.addColorStop(0,'#f0d488'); gg.addColorStop(.5,'#c9a24a'); gg.addColorStop(1,'#8a6a2a');
    ctx.fillStyle=gg;
    ctx.beginPath();
    ctx.moveTo(-11*bw, SH+1);
    ctx.quadraticCurveTo(-13*bw, SH-3, -8*bw, SH-3.5);
    ctx.quadraticCurveTo(0, SH-5, 8*bw, SH-3.5);
    ctx.quadraticCurveTo(13*bw, SH-3, 11*bw, SH+1);
    ctx.quadraticCurveTo(0, SH+4, -11*bw, SH+1);
    ctx.closePath(); ctx.fill();
    // ── 剑身(修长·冷银泛青·镜面渐变) ──
    var bg=ctx.createLinearGradient(-4*bw,0,4*bw,0);
    bg.addColorStop(0,'#4a5566'); bg.addColorStop(.22,'#8fa0b4'); bg.addColorStop(.45,'#e8f2fb');
    bg.addColorStop(.5,'#ffffff'); bg.addColorStop(.55,'#e8f2fb'); bg.addColorStop(.78,'#8fa0b4'); bg.addColorStop(1,'#3e4856');
    ctx.fillStyle=bg;
    ctx.beginPath();
    ctx.moveTo(-3.6*bw, SH);
    ctx.lineTo(-2.6*bw, TIP+len*0.16/sc);
    ctx.lineTo(0, TIP);                                    // 剑尖
    ctx.lineTo(2.6*bw, TIP+len*0.16/sc);
    ctx.lineTo(3.6*bw, SH);
    ctx.closePath(); ctx.fill();
    // 血槽(双线内凹)
    ctx.strokeStyle='rgba(70,90,120,.5)'; ctx.lineWidth=1.1*bw;
    ctx.beginPath(); ctx.moveTo(0,SH-2); ctx.lineTo(0,TIP+len*0.14/sc); ctx.stroke();
    // 刃口冷光高光(克制·非全身发光)
    ctx.strokeStyle='rgba(220,240,255,.85)'; ctx.lineWidth=0.8*bw;
    ctx.beginPath(); ctx.moveTo(-3*bw,SH-4); ctx.lineTo(-2.2*bw,TIP+len*0.18/sc); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3*bw,SH-4); ctx.lineTo(2.2*bw,TIP+len*0.18/sc); ctx.stroke();
    ctx.restore();
  }

  // 刺穿血条特效 + 敌方掉血 + 【特别炫酷的散光】
  var pierceFX = { rays:[], t0:-1 };
  var pierceHole = { on:false, x:0, y:0, t:0 };     // 血条穿透破口
  function pierceBar(st, barY){
    var TX=st.hx, sz=st.sz, P=st.P;
    var bl=st.barL||(TX-130), bw=st.barW||260;
    // ⓪ 激活血条穿透破口(剑贯穿处的发光撕裂洞)
    pierceHole.on=true; pierceHole.x=TX; pierceHole.y=barY; pierceHole.t=0;
    // ① 掉血(触发deal)
    st.fire();
    // ② 刺穿点适度闪(不太亮·冷银)
    F.flash(P, TX, barY, WT, 54*sz, 220);
    F.flash(P, TX, barY, CY, 34*sz, 260);
    // ③ 【炫酷散光】十二道光芒四射(放射光束)
    pierceFX.t0 = 0; pierceFX.x=TX; pierceFX.y=barY; pierceFX.rays=[];
    for(var r=0;r<14;r++){ var ang=(r/14)*6.283+Math.random()*0.1;
      pierceFX.rays.push({ang:ang, len:rnd(50,120)*sz, w:rnd(2,5)*sz, life:rnd(320,520), age:0, spd:rnd(0.4,0.9)}); }
    // ④ 冲击波多环
    F.ring(P, TX, barY, WT, 2.4, 6*sz);
    F.ring(P, TX, barY, CY, 1.7, 4.5*sz);
    F.ring(P, TX, barY, BL, 1.1, 3.5*sz);
    // ⑤ 沿血条水平炸开的剑气(左右)
    F.beam(P, TX, barY, 1.5708, WT, sz*1.3, 1.5);   // 水平光束(血条被劈穿)
    // ⑥ 大量星火/碎光四散
    F.burst(P, TX, barY, CY, 40, 12, sz);
    F.burst(P, TX, barY, WT, 22, 8, sz);
    F.shards(P, TX, barY, BL, 20, sz);
    // ⑦ 溅射的高光点(向上下飞散·像血条爆裂的碎片)
    for(var k=0;k<16;k++){ F.trail(P, TX+rnd(-bw*0.3,bw*0.3), barY+rnd(-6,6), WT, sz); }
  }
  // 散光帧更新(在glow层画放射光束)
  function drawPierceRays(ctx, st){
    if(pierceFX.t0<0) return;
    pierceFX.t0 += st.dt;
    var alive=false;
    for(var i=0;i<pierceFX.rays.length;i++){ var ry=pierceFX.rays[i]; ry.age+=st.dt;
      if(ry.age>=ry.life) continue; alive=true;
      var lr=1-ry.age/ry.life, ext=Math.min(1,ry.age*ry.spd*0.008);
      var L=ry.len*ext, x2=pierceFX.x+Math.cos(ry.ang)*L, y2=pierceFX.y+Math.sin(ry.ang)*L;
      var lg=ctx.createLinearGradient(pierceFX.x,pierceFX.y,x2,y2);
      lg.addColorStop(0,'rgba('+WT+','+(lr*0.9)+')'); lg.addColorStop(1,'rgba('+CY+',0)');
      ctx.strokeStyle=lg; ctx.lineWidth=ry.w*lr; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(pierceFX.x,pierceFX.y); ctx.lineTo(x2,y2); ctx.stroke();
    }
    // 中心持续辉光
    if(pierceFX.t0<600){ var cl=1-pierceFX.t0/600; ctx.globalAlpha=cl*0.8;
      ctx.fillStyle=g(ctx,pierceFX.x,pierceFX.y,40*st.sz,[[0,'rgba('+WT+',1)'],[.4,'rgba('+CY+',.6)'],[1,'rgba('+CY+',0)']]);
      ctx.beginPath(); ctx.arc(pierceFX.x,pierceFX.y,40*st.sz,0,6.283); ctx.fill(); ctx.globalAlpha=1; }
    if(!alive && pierceFX.t0>600) pierceFX.t0=-1;
  }
  // 血条穿透破口(source-over层画·撕裂洞+发光边+涌光·让剑真的"穿透"血条)
  // 血条【发光能量撕裂口】(全发光·无黑洞)——横向裂光+竖向剑光通道+柔光渗出·漂亮利落
  function drawPierceHole(ctx, st){
    if(!pierceHole.on) return;
    pierceHole.t += st.dt; var sz=st.sz;
    var x=pierceHole.x, y=pierceHole.y, age=pierceHole.t;
    var grow=Math.min(1, age/160);
    var fade= age<420 ? 1 : Math.max(0, 1-(age-420)/340);   // 420ms后柔和淡出
    if(fade<=0){ pierceHole.on=false; return; }
    ctx.save();
    ctx.globalCompositeOperation='lighter';           // 全叠加发光·绝无暗色
    // ① 横向裂光(血条被撕开的一道亮口·中间粗两端尖·像光的伤口)
    var tw=(26+52*grow)*sz;                            // 裂口宽度(沿血条张开)
    var th=13*sz;                                      // 裂口最大高度(略高于血条)
    var hg=ctx.createLinearGradient(x-tw,y,x+tw,y);
    hg.addColorStop(0,'rgba('+CY+',0)');
    hg.addColorStop(.5,'rgba(255,255,255,'+(0.95*fade)+')');
    hg.addColorStop(1,'rgba('+CY+',0)');
    ctx.fillStyle=hg;
    ctx.beginPath();
    ctx.moveTo(x-tw, y);
    ctx.quadraticCurveTo(x-tw*0.3, y-th, x, y-th*0.55);
    ctx.quadraticCurveTo(x+tw*0.3, y-th, x+tw, y);
    ctx.quadraticCurveTo(x+tw*0.3, y+th, x, y+th*0.55);
    ctx.quadraticCurveTo(x-tw*0.3, y+th, x-tw, y);
    ctx.closePath(); ctx.fill();
    // ② 竖向剑光通道(剑穿过留下的光道·细长)
    var vh=(24+16*grow)*sz;
    var vg=ctx.createLinearGradient(x,y-vh,x,y+vh);
    vg.addColorStop(0,'rgba('+CY+',0)');
    vg.addColorStop(.5,'rgba(230,245,255,'+(0.85*fade)+')');
    vg.addColorStop(1,'rgba('+CY+',0)');
    ctx.fillStyle=vg;
    ctx.beginPath(); ctx.ellipse(x, y, 3.5*sz*fade, vh, 0, 0, 6.283); ctx.fill();
    // ③ 中心核心光斑(最亮·柔和)
    var cg=ctx.createRadialGradient(x,y,0,x,y,16*sz);
    cg.addColorStop(0,'rgba(255,255,255,'+(0.95*fade)+')');
    cg.addColorStop(.4,'rgba('+CY+','+(0.55*fade)+')');
    cg.addColorStop(1,'rgba('+CY+',0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(x,y,16*sz,0,6.283); ctx.fill();
    // ④ 撕裂边的两道细亮弧(上下·勾勒"被撕开"的口子·发光非黑)
    ctx.strokeStyle='rgba(215,240,255,'+(0.8*fade*(1-grow*0.3))+')'; ctx.lineWidth=1.6*sz; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(x-tw*0.85,y-1.5*sz); ctx.quadraticCurveTo(x,y-th*0.7, x+tw*0.85,y-1.5*sz); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-tw*0.85,y+1.5*sz); ctx.quadraticCurveTo(x,y+th*0.7, x+tw*0.85,y+1.5*sz); ctx.stroke();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{ hardMs:5200, endMs:3800, clipExtra:66,
    busy:function(st){ return swords.length>0 || (big) || (pierceFX.t0>=0); },
    tick:function(st){
      var t=st.t, sz=st.sz, TX=st.hx, TY=st.hy;   // 目标(勇者)
      var BX=st.bx, BY=st.by;                       // 剑神

      // ── ① 凝剑 90-820ms: 四面八方浮现众剑·剑尖朝向目标·震颤蓄势 ──
      if(!st.fired.summon && t>=90){ st.fired.summon=1;
        for(var i=0;i<N;i++){
          var ang=Math.random()*6.283;
          var dist=rnd(120,340)*sz;               // 环绕在剑神/屏幕四周
          var ox=BX+Math.cos(ang)*dist, oy=BY+Math.sin(ang)*dist*0.7 - 20*sz;
          swords.push({
            x:ox, y:oy, homeX:ox, homeY:oy,
            len:rnd(26,40)*sz, a:0,
            rot:Math.atan2(TY-oy,TX-ox)+1.5708,   // 剑尖指向目标
            delay:i*9, mode:'summon', p:0,
            glow:1, seed:Math.random()*6.283
          });
        }
        F.ring(st.P, BX, BY, BL, 1.4, 4*sz);       // 剑神脚下共鸣环
      }
      // 凝剑期微微震颤 + 淡入
      if(t<980){ for(var s0=0;s0<swords.length;s0++){ var sw0=swords[s0];
        if(sw0.delay>0){ sw0.delay-=st.dt; continue; }
        sw0.a=Math.min(1, sw0.a + st.dt*0.006);
        sw0.x = sw0.homeX + Math.sin(t*0.02+sw0.seed)*1.5*sz;
        sw0.y = sw0.homeY + Math.cos(t*0.017+sw0.seed)*1.5*sz;
        sw0.rot = Math.atan2(TY-sw0.y, TX-sw0.x)+1.5708;
      } }

      // ── ② 万剑齐射 980ms: 全部剑【同时】朝目标飞去 ──
      if(!st.fired.fire && t>=980){ st.fired.fire=1; phase=1;
        FORMY = TY-92*sz;                          // 🔴统一成型点(小剑汇聚到这·剑在这成型·再向下刺)
        for(var f=0;f<swords.length;f++){ var sf=swords[f];
          sf.mode='fly'; sf.sx=sf.x; sf.sy=sf.y; sf.p=0;
          sf.spd=rnd(0.0020,0.0032);              // 快速汇聚
          // 🔴汇聚到【成型点FORMY】(不是目标TY)·彻底消除"汇聚点跳动=向后抽"
          sf.tx=TX+rnd(-12,12)*sz; sf.ty=FORMY+rnd(-12,12)*sz;
        }
        // 剑神挥手光束
        F.beam(st.P, BX, BY, Math.atan2(TY-BY,TX-BX)+1.5708, CY, sz, 1);
      }
      // 飞行 + 拖光轨
      if(phase>=1){ for(var wf=swords.length-1;wf>=0;wf--){ var s2=swords[wf];
        if(s2.mode!=='fly') continue;
        s2.p += s2.spd*st.dt;
        var e=s2.p<1 ? (s2.p*s2.p*(3-2*s2.p)) : 1; // smoothstep
        s2.x = s2.sx+(s2.tx-s2.sx)*e;
        s2.y = s2.sy+(s2.ty-s2.sy)*e;
        s2.rot = Math.atan2(s2.ty-s2.sy, s2.tx-s2.sx)+1.5708;
        if(Math.random()<0.5) F.trail(st.P, s2.x, s2.y, BL, sz*0.8); // 光轨
        if(s2.p>=1){ swords.splice(wf,1);           // 到达→并入归一
          F.trail(st.P, TX, TY, CY, sz);
        }
      } }

      // ── ③ 归一: 众剑已汇聚到【成型点FORMY】·剑在此成型 → 静止 → 啪!直刺 ──
      if(!st.fired.merge && phase>=1 && swords.length===0 && t>1100){ st.fired.merge=1; phase=2;
        var FY = (FORMY!=null)?FORMY:(TY-92*sz);
        var BARY = (st.barBot||TY+40)-8;            // 血条刺穿点
        big={ t:0, x:TX, cy:FY, formY:FY, barY:BARY, len:16*sz, a:0, rot:Math.PI, struck:false, ph:'form', thrust:0, hold:0 };
        F.flash(st.P, TX, FY, WT, 24*sz, 180);      // 凝聚微光(小)
        F.ring(st.P, TX, FY, CY, 1.3, 4*sz);
        // 吸附残光从四周收拢到成型点(和小剑同向·不跳动)
        for(var b=0;b<20;b++){ F.suck(st.P, TX+rnd(-80,80)*sz, FY+rnd(-50,50)*sz, TX, FY, BL, sz); }
      }
      if(big){ big.t+=st.dt; var LEN=100*sz;
        // A. 成型(0-300ms): 原地长大+淡入·中心恒定=formY·剑尖朝下(绝无位移)
        if(big.ph==='form'){ var gp=Math.min(1,big.t/300);
          big.len=(16+(LEN/sz-16)*gp)*sz; big.a=Math.min(1,gp*1.8); big.cy=big.formY; big.rot=Math.PI;
          if(gp>=1){ big.ph='still'; big.stillT=0; big.len=LEN; big.a=1; }
        }
        // B. 静止(160ms): 剑成型后【完全静止】蓄势(Hansen: 先静止)
        else if(big.ph==='still'){ big.stillT+=st.dt; big.cy=big.formY; big.rot=Math.PI;
          if(big.stillT>=160){ big.ph='thrust'; big.thrust=0; }
        }
        // C. 突刺(啪!): 【最快速度直刺】·ease-out快启动·剑尖碰血条上沿即触发穿透
        else if(big.ph==='thrust' && !big.struck){
          big.thrust += st.dt*0.020;                 // 🔴很快
          var tp=big.thrust<1?big.thrust:1;
          var te=1-(1-tp)*(1-tp);                    // ease-out: 起步就是最快·瞬间冲出
          var tipStart=big.formY+0.80*LEN, tipEnd=big.barY+10*sz;
          var tipNow=tipStart+(tipEnd-tipStart)*te;
          big.cy=tipNow-0.80*LEN; big.rot=Math.PI; big.tipY=tipNow;
          if(tipNow>=big.barY-9){ big.struck=true; big.ph='through'; phase=3;
            pierceBar(st, big.barY);
          }
        }
        // D. 【穿过并消失】: 剑一路向下穿过血条·边穿边淡出·穿完即消失(绝不回抽!)
        else if(big.ph==='through'){
          big.cy += st.dt*0.34*sz;                   // 🔴持续向下·穿过血条(不停·不回抽)
          big.rot=Math.PI; big.tipY=big.cy+0.80*LEN;
          // 剑柄(剑最上端≈cy-0.30*LEN)一旦也穿过血条上沿→整把剑已穿过→淡出消失
          var handleTop=big.cy-0.32*LEN;
          if(handleTop > big.barY-8*sz){ big.a=Math.max(0, big.a - st.dt*0.010); } // 穿过后快速淡出
          if(big.a<=0){ big=null; pierceHole.on=false; }
        }
      }
    },
    // 不透明层: 画剑(实体) + 血条穿透破口
    solid:function(st){ var ctx=st.ctx, sz=st.sz;
      drawPierceHole(ctx, st);   // 先画破口(剑随后压在其上=贯穿血条视觉)
      for(var i=0;i<swords.length;i++){ var s=swords[i]; if(s.delay>0)continue;
        drawSword(ctx, s.x, s.y, s.len, s.rot, s.a, false, 1);  // 周围剑=古剑(epic=false)
      }
      if(big && big.a>0){
        // 归一之剑(古剑质感·epic·中等大小·剑尖朝敌方)
        ctx.save(); ctx.globalAlpha=big.a;
        ctx.shadowBlur=11*sz; ctx.shadowColor='rgba('+BL+',.7)';
        drawSword(ctx, big.x, big.cy, big.len, big.rot, big.a, true, 1.9);
        ctx.restore();
      }
    },
    // 发光层: 【周围古剑不发光】(古朴质感)·只在飞行时给一点点极淡的动势微光(几乎不可见·仅增速度感)·巨剑归一才有光芒(剑气汇聚)
    glow:function(st){ var ctx=st.ctx, sz=st.sz;
      // 周围古剑: 不加辉光(保持古朴哑光)。仅飞行(fly)时尾部一丝淡光表现破空(极克制)
      for(var i=0;i<swords.length;i++){ var s=swords[i]; if(s.delay>0)continue;
        if(s.mode==='fly'){ ctx.globalAlpha=s.a*0.14;
          ctx.fillStyle=g(ctx, s.x, s.y+s.len*0.3, s.len*0.35, [[0,'rgba(180,175,160,.5)'],[1,'rgba(180,175,160,0)']]);
          ctx.beginPath(); ctx.arc(s.x, s.y+s.len*0.3, s.len*0.35, 0, 6.283); ctx.fill();
        }
      }
      // 归一巨剑: 剑气光芒(这是万剑之力汇聚·合理发光·冷银不刺眼)
      if(big && big.a>0){ ctx.globalAlpha=big.a*0.5;
        ctx.fillStyle=g(ctx, big.x, big.cy, big.len*0.4, [[0,'rgba('+CY+',.8)'],[.5,'rgba('+BL+',.35)'],[1,'rgba('+BL+',0)']]);
        ctx.beginPath(); ctx.arc(big.x, big.cy, big.len*0.4, 0, 6.283); ctx.fill();
      }
// 刺穿散光
      try{ drawPierceRays(ctx, st); }catch(e){}
      ctx.globalAlpha=1;
    }
  });
}catch(e){ console.error('fxJianshen error',e); try{deal();}catch(_){} } }

function fxSuolaris(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var COLS=['150,60,255','60,120,255','255,60,80','255,150,50','60,200,120','240,245,255'];
  var runeN=0, resetT=-1, punchT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return resetT>0&&st.t-resetT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-1100 六符文依次点亮 */
    runeN=Math.min(6,Math.floor(t/180));
    if(runeN>0&&!st.fired['r'+runeN]){ st.fired['r'+runeN]=1;
      var a=(runeN-1)/6*6.283-1.57;
      F.burst(st.P,st.bx+Math.cos(a)*52*sz,st.by+Math.sin(a)*52*sz,COLS[runeN-1],6,4,sz);
    }
    /* ②1250起 符文光束轮射(六色各一发) */
    if(!st.fired.beams&&t>=1250){ st.fired.beams=1;
      for(var k=0;k<6;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var a2=kk/6*6.283-1.57;
        F.trail(st.P,st.bx+Math.cos(a2)*52*st.sz,st.by+Math.sin(a2)*52*st.sz,st.hx+rnd(-24,24)*st.sz,st.hy+rnd(-14,14)*st.sz,COLS[kk],3.5*st.sz,260);
        F.burst(st.P,st.hx,st.hy,COLS[kk],5,5,st.sz);
      },kk*140/st.sp); })(k); }
      st.fire();
    }
    /* ③2450 双拳对撞: 现实涟漪 */
    if(!st.fired.punch&&t>=2450){ st.fired.punch=1; punchT=t;
      F.ring(st.P,st.bx,st.by,'240,245,255',1.3,4*sz);
      F.ring(st.P,st.hx,st.hy,'200,180,255',1.0,3*sz);
    }
    /* ④2950 天启重置: 六色光网收束→白光重置 */
    if(!st.fired.reset&&t>=2950){ st.fired.reset=1; resetT=t;
      for(var q=0;q<6;q++){ var a3=q/6*6.283;
        F.suck(st.P,st.hx+Math.cos(a3)*110*sz,st.hy+Math.sin(a3)*70*sz,st.hx,st.hy,COLS[q],sz);
        F.suck(st.P,st.hx+Math.cos(a3+0.5)*110*sz,st.hy+Math.sin(a3+0.5)*70*sz,st.hx,st.hy,COLS[q],sz); }
      F.flash(st.P,st.hx,st.hy,'255,255,255',72*sz,340);
      F.ring(st.P,st.hx,st.hy,'240,245,255',1.9,6*sz);
      F.burst(st.P,st.hx,st.hy,'220,225,255',26,8.5,sz);
    }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 胸前六符文环 */
    for(var k=0;k<runeN;k++){ var a=k/6*6.283-1.57;
      var x=st.bx+Math.cos(a)*52*sz, y=st.by+Math.sin(a)*52*sz;
      var pulse=0.7+Math.sin(t*0.006+k)*0.3;
      ctx.save(); ctx.globalAlpha=pulse;
      ctx.strokeStyle=g(COLS[k]+',0.95'); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(COLS[k]+',1');
      ctx.beginPath(); ctx.arc(x,y,8*sz,0,6.283); ctx.stroke();
      ctx.beginPath();
      var sides=k+3;
      for(var v=0;v<=sides;v++){ var va=v/sides*6.283-1.57;
        var vx=x+Math.cos(va)*4.5*sz, vy=y+Math.sin(va)*4.5*sz;
        if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
      ctx.stroke(); ctx.shadowBlur=0; ctx.restore();
    }
    /* 现实涟漪(双拳对撞·空间波纹扭曲环) */
    if(punchT>0&&t-punchT<700){ var pr=(t-punchT)/700;
      for(var w2=0;w2<3;w2++){ var rp=pr-w2*0.16; if(rp<0||rp>1)continue;
        var R=rp*130*sz;
        ctx.strokeStyle=g('220,210,255,'+(0.6*(1-rp))); ctx.lineWidth=(3-w2)*sz;
        ctx.beginPath();
        for(var v2=0;v2<=40;v2++){ var va2=v2/40*6.283;
          var wob=Math.sin(va2*6+t*0.01)*4*sz*(1-rp);
          var vx2=st.hx+Math.cos(va2)*(R+wob), vy2=st.hy+Math.sin(va2)*(R+wob)*0.7;
          if(v2===0)ctx.moveTo(vx2,vy2); else ctx.lineTo(vx2,vy2); }
        ctx.closePath(); ctx.stroke(); }
    }
    /* 重置白光竖幕 */
    if(resetT>0&&t-resetT<800){ var pr2=(t-resetT)/800, env=Math.sin(pr2*3.14);
      var wg=ctx.createLinearGradient(st.hx-70*sz,0,st.hx+70*sz,0);
      wg.addColorStop(0,'rgba(255,255,255,0)'); wg.addColorStop(.5,g('255,255,255,'+(0.55*env))); wg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=wg; ctx.fillRect(st.hx-70*sz,0,140*sz,st.barBot+18);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
