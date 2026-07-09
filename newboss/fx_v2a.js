/* ═══ v2 重做(覆盖同名旧版): 法老王 / 兵王 ═══ */

/* ⑧v2 法老王·不朽金身 —— 葬衣金箔环绕→权杖顿地铭文墙→权杖指向金箔齐射→金字塔封印诅咒 */
function fxFalao(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,205,90', C_E='80,255,150', C_W='255,240,200';
  var foils=[], scarabs=[], glyphs=[], staff={a:0,rot:0,lift:0}, pyrT=-1, boomT=-1;
  var SY=['𓂀','☥','𓋹','𓆣','▽','𓁹'];
  /* 金箔环: 20片, 状态 orbit(环绕boss) / aim(转向) / fire(射向勇者) */
  for(var i=0;i<20;i++){ foils.push({st:'orbit',ang:i/20*6.283,r:0,tr:82+rnd(-8,8),spin:0.0016,w:rnd(8,13),rot:rnd(0,6.28),vrot:rnd(-0.12,0.12),wave:i}); }
  function drawStaff(ctx,x,y,s,rot,a,glow){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    var bg=ctx.createLinearGradient(-3,0,3,0); bg.addColorStop(0,'#8a6a20'); bg.addColorStop(.5,'#f0cc70'); bg.addColorStop(1,'#8a6a20');
    ctx.fillStyle=bg; ctx.fillRect(-3,-60,6,120);
    for(var k=0;k<4;k++){ ctx.fillStyle='#6a4f18'; ctx.fillRect(-3,-48+k*28,6,2.4); }
    ctx.fillStyle='#caa64a';
    ctx.beginPath(); ctx.moveTo(0,-60); ctx.lineTo(-12,-72); ctx.lineTo(-4,-79); ctx.lineTo(0,-72); ctx.lineTo(4,-79); ctx.lineTo(12,-72); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#6a4f18'; ctx.lineWidth=1; ctx.stroke();
    if(glow){ ctx.shadowBlur=18; ctx.shadowColor='#66ff9a'; }
    var eg=ctx.createRadialGradient(0,-88,0,0,-88,9);
    eg.addColorStop(0,'#d8ffe8'); eg.addColorStop(.5,glow?'#66ff9a':'#2e8a52'); eg.addColorStop(1,'#1a5c36');
    ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(0,-88,8.6,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#f0d080'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.arc(0,-88,8.6,0,6.283); ctx.stroke();
    ctx.restore();
  }
  function drawScarab(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.shadowBlur=10; ctx.shadowColor='#4dff96';
    ctx.fillStyle='#137a48'; ctx.strokeStyle='#ffe9a0'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(0,2,6.5,8.5,0,0,6.283); ctx.fill(); ctx.shadowBlur=0; ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-8,4,0,6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(0,10); ctx.moveTo(-6,2); ctx.lineTo(6,2); ctx.stroke();
    for(var k=-1;k<=1;k+=2){ ctx.beginPath(); ctx.moveTo(k*5,-3); ctx.lineTo(k*11,-8); ctx.moveTo(k*6,3); ctx.lineTo(k*12,3); ctx.moveTo(k*5,7); ctx.lineTo(k*10,12); ctx.stroke(); }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6100,endMs:4200,
  busy:function(st){ return foils.some(function(f){return f.st==='fire';})||scarabs.length>0||(boomT>0&&st.t-boomT<760); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-800 葬衣剥离: 金箔从boss身上飞出加入环 + 圣甲虫护符亮 */
    if(t<800&&Math.random()<0.6)F.suck(st.P,st.bx+rnd(-56,56)*sz,st.by+rnd(-80,70)*sz,st.bx+Math.cos(rnd(0,6.28))*82*sz,st.by,C_G,sz);
    staff.a=Math.min(1,Math.max(0,(t-500)/400));
    /* ②1150 权杖顿地: 冲击+铭文墙逐个点亮 */
    if(!st.fired.stomp&&t>=1150){ st.fired.stomp=1;
      F.ring(st.P,st.bx-72*sz,st.by+82*sz,C_G,1.5,4.5*sz); F.ring(st.P,st.bx-72*sz,st.by+82*sz,C_W,0.9,3*sz);
      F.burst(st.P,st.bx-72*sz,st.by+82*sz,C_G,14,6,sz);
      for(var side=-1;side<=1;side+=2){ for(var col=0;col<2;col++){ for(var row=0;row<5;row++){
        glyphs.push({x:st.bx+side*(120+col*30)*sz,y:st.by-70*sz+row*30*sz,ch:SY[(row+col)%6],ts:1150+(row+col*5)*80+(side>0?40:0),life:0}); } } }
    }
    /* ③1750 权杖前指→金箔停转→三波齐射 */
    if(!st.fired.aim&&t>=1750){ st.fired.aim=1;
      for(var fi=0;fi<foils.length;fi++)foils[fi].st='aim';
    }
    if(!st.fired.fire1&&t>=1950){ st.fired.fire1=1;
      for(var a2=0;a2<20;a2++){ if(a2%3===0){ var f2=foils[a2]; f2.st='fire'; f2.fx=f2.x; f2.fy=f2.y; f2.tx=st.hx+rnd(-46,46)*sz; f2.ty=st.hy+rnd(-26,26)*sz; f2.p=0; f2.spd=rnd(0.0032,0.0044); } }
      st.fire();
    }
    if(!st.fired.fire2&&t>=2150){ st.fired.fire2=1;
      for(var a3=0;a3<20;a3++){ if(a3%3===1){ var f3=foils[a3]; f3.st='fire'; f3.fx=f3.x; f3.fy=f3.y; f3.tx=st.hx+rnd(-46,46)*sz; f3.ty=st.hy+rnd(-26,26)*sz; f3.p=0; f3.spd=rnd(0.0032,0.0044); } } }
    if(!st.fired.fire3&&t>=2350){ st.fired.fire3=1;
      for(var a4=0;a4<20;a4++){ if(a4%3===2){ var f4=foils[a4]; f4.st='fire'; f4.fx=f4.x; f4.fy=f4.y; f4.tx=st.hx+rnd(-46,46)*sz; f4.ty=st.hy+rnd(-26,26)*sz; f4.p=0; f4.spd=rnd(0.0032,0.0044); } } }
    if(!st.fired.scb&&t>=2050){ st.fired.scb=1;
      for(var k2=0;k2<3;k2++)scarabs.push({p:0,arc:(k2-1)*0.7,spd:rnd(0.001,0.0014),delay:k2*150});
    }
    /* ④2650 权杖高举→金字塔封印升起→2950 大爆 */
    if(!st.fired.pyr&&t>=2650){ st.fired.pyr=1; pyrT=t;
      F.flash(st.P,st.bx-72*sz,st.by-70*sz,C_E,26*sz,220);
    }
    if(!st.fired.boom&&t>=2980){ st.fired.boom=1; boomT=t;
      F.flash(st.P,st.hx,st.hy,C_E,68*sz,320);
      F.ring(st.P,st.hx,st.hy,C_E,1.8,6*sz); F.ring(st.P,st.hx,st.hy,C_G,1.2,4*sz); F.ring(st.P,st.hx,st.hy,C_W,0.8,2.6*sz);
      F.burst(st.P,st.hx,st.hy,C_E,28,8.5,sz); F.burst(st.P,st.hx,st.hy,C_G,16,6.5,sz);
      F.shards(st.P,st.hx,st.hy,C_G,18,sz);
      for(var q2=0;q2<10;q2++)F.jet(st.P,st.hx+rnd(-30,30)*sz,st.hy+30*sz,-1.57,0.4,C_E,2,6,sz);
    }
    /* 金箔运动 */
    for(var mi=0;mi<foils.length;mi++){ var f=foils[mi];
      if(f.st==='orbit'){ f.r=Math.min(f.tr,f.r+st.dt*0.14); f.ang+=f.spin*st.dt; f.rot+=f.vrot*0.06*st.dt;
        f.x=st.bx+Math.cos(f.ang)*f.r*sz; f.y=st.by+Math.sin(f.ang)*f.r*0.62*sz; }
      else if(f.st==='aim'){ f.rot+= (Math.atan2(st.hy-f.y,st.hx-f.x)-f.rot)*0.14; f.ang+=f.spin*0.25*st.dt;
        f.x=st.bx+Math.cos(f.ang)*f.tr*sz; f.y=st.by+Math.sin(f.ang)*f.tr*0.62*sz; }
      else if(f.st==='fire'){ f.p+=f.spd*st.dt;
        if(f.p>=1){ F.burst(st.P,f.tx,f.ty,C_G,5,5,sz); F.ring(st.P,f.tx,f.ty,C_G,0.55,1.8*sz); f.st='done'; continue; }
        f.x=f.fx+(f.tx-f.fx)*f.p; f.y=f.fy+(f.ty-f.fy)*f.p;
        f.rot=Math.atan2(f.ty-f.fy,f.tx-f.fx);
        if(Math.random()<0.35)F.jet(st.P,f.x,f.y,f.rot+3.14,0.25,C_G,1,2,sz); }
    }
    for(var si=scarabs.length-1;si>=0;si--){ var sb=scarabs[si];
      if(sb.delay>0){sb.delay-=st.dt;continue;}
      sb.p+=sb.spd*st.dt;
      if(sb.p>=1){ F.burst(st.P,st.hx,st.hy,C_E,9,6,sz); F.ring(st.P,st.hx,st.hy,C_E,0.85,2.8*sz); scarabs.splice(si,1); }
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 金箔(实体金片·刻痕) */
    for(var mi=0;mi<foils.length;mi++){ var f=foils[mi];
      if(f.st==='done'||f.r<4)continue;
      ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.rot);
      var w=f.w*sz;
      var fg=ctx.createLinearGradient(-w/2,0,w/2,0); fg.addColorStop(0,'#9a7830'); fg.addColorStop(.5,'#ffe9a0'); fg.addColorStop(1,'#8a6a24');
      ctx.fillStyle=fg; ctx.fillRect(-w/2,-w*0.66,w,w*1.32);
      ctx.strokeStyle='#6a4f18'; ctx.lineWidth=0.9; ctx.strokeRect(-w/2,-w*0.66,w,w*1.32);
      ctx.strokeStyle='rgba(106,79,24,.7)'; ctx.lineWidth=0.7;
      ctx.beginPath(); ctx.moveTo(-w*0.3,-w*0.36); ctx.lineTo(w*0.3,-w*0.36); ctx.moveTo(-w*0.3,0); ctx.lineTo(w*0.3,0); ctx.moveTo(-w*0.3,w*0.36); ctx.lineTo(w*0.3,w*0.36); ctx.stroke();
      ctx.restore();
    }
    /* 权杖: ②举起→顿地→③前指→④高举 */
    if(staff.a>0){ var px=st.bx-72*sz, py=st.by+18*sz, rot=0, lift=(1-staff.a)*30*sz;
      if(t>=1000&&t<1150){ py+=Math.sin((t-1000)/150*3.14)* -10*sz; }
      if(t>=1750&&t<2650){ rot=Math.min(1,(t-1750)/220)*(Math.atan2(st.hy-py,st.hx-px)+1.57); }
      else if(t>=2650){ rot=Math.max(0,(1-(t-2650)/200))*(Math.atan2(st.hy-py,st.hx-px)+1.57); py-=Math.min(1,(t-2650)/250)*16*sz; }
      drawStaff(ctx,px,py-lift,1.25*sz,rot,staff.a,t>=2500);
    }
    /* 圣甲虫 */
    for(var si=0;si<scarabs.length;si++){ var sb=scarabs[si]; if(sb.delay>0)continue;
      var x=st.bx+(st.hx-st.bx)*sb.p, y=st.by+(st.hy-st.by)*sb.p+Math.sin(sb.p*3.14)*-58*sz*sb.arc;
      drawScarab(ctx,x,y,1.3*sz,Math.atan2(st.hy-y,st.hx-x)+1.57,1);
      if(Math.random()<0.5)F.burst(st.P,x,y,C_E,1,2,sz);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 圣甲虫护符(boss胸口绿点·①幕起常亮微脉) */
    if(t>150){ var pl=0.55+Math.sin(t*0.008)*0.3;
      ctx.save(); ctx.globalAlpha=pl;
      var ag=ctx.createRadialGradient(st.bx,st.by-6*sz,0,st.bx,st.by-6*sz,10*sz);
      ag.addColorStop(0,'rgba(180,255,210,0.95)'); ag.addColorStop(.5,g(C_E+',0.6')); ag.addColorStop(1,g(C_E+',0'));
      ctx.fillStyle=ag; ctx.beginPath(); ctx.arc(st.bx,st.by-6*sz,10*sz,0,6.283); ctx.fill(); ctx.restore();
    }
    /* 铭文墙 */
    for(var gi=0;gi<glyphs.length;gi++){ var gl=glyphs[gi];
      if(t<gl.ts)continue; gl.life=t-gl.ts;
      var a=Math.min(1,gl.life/160)*(gl.life>1400?Math.max(0,(1900-gl.life)/500):1);
      if(a<=0)continue;
      ctx.save(); ctx.globalAlpha=a*0.85; ctx.fillStyle='#ffe9a0'; ctx.shadowBlur=10; ctx.shadowColor=g(C_G+',1');
      ctx.font=(15*sz)+'px serif'; ctx.textAlign='center'; ctx.fillText(gl.ch,gl.x,gl.y); ctx.restore();
    }
    /* 金字塔封印(线框四棱锥从勇者脚下升起+冥火柱) */
    if(pyrT>0&&t-pyrT<1200){ var pr=(t-pyrT)/1200;
      var grow=Math.min(1,pr/0.5), env=pr<0.85?1:(1-pr)/0.15;
      var S=86*sz*grow, ap={x:st.hx,y:st.hy-S*1.05}, bl={x:st.hx-S,y:st.hy+38*sz}, brr={x:st.hx+S,y:st.hy+38*sz}, bk={x:st.hx,y:st.hy+22*sz};
      ctx.save(); ctx.globalAlpha=env;
      ctx.strokeStyle=g(C_E+',0.9'); ctx.lineWidth=2.6*sz; ctx.shadowBlur=16; ctx.shadowColor=g(C_E+',1');
      ctx.beginPath(); ctx.moveTo(bl.x,bl.y); ctx.lineTo(ap.x,ap.y); ctx.lineTo(brr.x,brr.y); ctx.moveTo(bk.x,bk.y); ctx.lineTo(ap.x,ap.y);
      ctx.moveTo(bl.x,bl.y); ctx.lineTo(bk.x,bk.y); ctx.lineTo(brr.x,brr.y); ctx.lineTo(bl.x,bl.y); ctx.stroke();
      /* 内部冥火柱 */
      var w=26*sz*grow;
      var pg2=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      pg2.addColorStop(0,g(C_E+',0')); pg2.addColorStop(.5,g(C_E+','+(0.45*env))); pg2.addColorStop(1,g(C_E+',0'));
      ctx.fillStyle=pg2; ctx.fillRect(st.hx-w,ap.y,w*2,st.hy+30*sz-ap.y);
      /* 顶点聚能 */
      var tg=ctx.createRadialGradient(ap.x,ap.y,0,ap.x,ap.y,12*sz);
      tg.addColorStop(0,'rgba(220,255,235,'+env+')'); tg.addColorStop(1,g(C_E+',0'));
      ctx.fillStyle=tg; ctx.beginPath(); ctx.arc(ap.x,ap.y,12*sz,0,6.283); ctx.fill();
      ctx.shadowBlur=0; ctx.restore();
      if(Math.random()<0.6)F.jet(st.P,st.hx+rnd(-w*0.7,w*0.7),st.hy+26*sz,-1.57,0.3,C_E,1,4.5,sz);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑭v2 丛林幽灵·兵王 —— 实体烟雾罐抛掷→实体狙击枪+激光爬行锁定→闪光+军刀→克莱莫扇形齐爆 */
function fxBingwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,60,50', C_O='255,170,70', C_T='255,220,150', C_K='210,220,205';
  var cans=[], smokes=[], rifle={a:0,fireT:-1}, laser={p:0,path:[],lock:0}, shell=null;
  var flashCan=null, flashT=-1, knives=[], clay={a:0,blink:-1,boomT:-1}, nades=[];
  /* 激光游走路径(预生成: 在勇者身上随机爬行→收敛中心) */
  (function(){ var px2=0,py2=0;
    for(var k=0;k<=22;k++){ var conv=Math.min(1,k/16);
      px2=px2*0.5+rnd(-46,46)*(1-conv); py2=py2*0.5+rnd(-30,30)*(1-conv);
      laser.path.push({x:px2*(1-conv),y:py2*(1-conv)}); } })();
  function drawCan(ctx,x,y,s,rot,a,col){ /* 烟雾/闪光罐 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    var cg=ctx.createLinearGradient(-5,0,5,0); cg.addColorStop(0,'#3a4238'); cg.addColorStop(.5,col); cg.addColorStop(1,'#2e352c');
    ctx.fillStyle=cg; ctx.fillRect(-5,-9,10,18);
    ctx.fillStyle='#5a6455'; ctx.fillRect(-5,-11,10,3);
    ctx.strokeStyle='#8a94a0'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.arc(0,-13,3,0,6.283); ctx.stroke();
    ctx.strokeStyle='#1e241c'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-5,-2); ctx.lineTo(5,-2); ctx.moveTo(-5,4); ctx.lineTo(5,4); ctx.stroke();
    ctx.restore();
  }
  function drawRifle(ctx,x,y,s,rot,a,rec){ /* 精准射手步枪(枪身+瞄准镜+两脚架) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.translate(-rec*9,0); ctx.scale(s,s);
    ctx.fillStyle='#2e3428'; ctx.fillRect(-30,-4,26,8);
    ctx.fillStyle='#3c4434'; ctx.beginPath(); ctx.moveTo(-30,4); ctx.lineTo(-24,4); ctx.lineTo(-27,16); ctx.lineTo(-34,14); ctx.closePath(); ctx.fill();
    var bg=ctx.createLinearGradient(0,-3,0,3); bg.addColorStop(0,'#4a5442'); bg.addColorStop(1,'#262c20');
    ctx.fillStyle=bg; ctx.fillRect(-6,-3,52,6);
    ctx.fillStyle='#1c221a'; ctx.fillRect(46,-2,12,4);
    ctx.fillStyle='#20261c'; ctx.fillRect(2,-9,16,5);
    ctx.strokeStyle='#6a7460'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,-6.5,3,0,6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(18,-6.5,2.4,0,6.283); ctx.stroke();
    ctx.strokeStyle='#333a2c'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(28,3); ctx.lineTo(22,16); ctx.moveTo(28,3); ctx.lineTo(34,16); ctx.stroke();
    ctx.fillStyle='#3c4434'; ctx.fillRect(-10,2,6,7);
    ctx.restore();
  }
  function drawKnife(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#1e2418'; ctx.fillRect(-2.6,10,5.2,14);
    ctx.fillStyle='#4a5442'; ctx.fillRect(-6,8,12,2.6);
    var kg=ctx.createLinearGradient(-3,0,3,0); kg.addColorStop(0,'#5a6a58'); kg.addColorStop(.5,'#dce6d4'); kg.addColorStop(1,'#3a4638');
    ctx.fillStyle=kg; ctx.beginPath(); ctx.moveTo(-3,8); ctx.lineTo(-2.2,-30); ctx.lineTo(2,-38); ctx.lineTo(3,8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#eef4e8'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(-0.5,6); ctx.lineTo(-0.5,-32); ctx.stroke();
    ctx.restore();
  }
  function drawClaymore(ctx,x,y,s,a,lampOn){ /* 克莱莫定向雷 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    ctx.strokeStyle='#3a4238'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(-8,6); ctx.lineTo(-11,18); ctx.moveTo(8,6); ctx.lineTo(11,18); ctx.stroke();
    var cg=ctx.createLinearGradient(0,-8,0,8); cg.addColorStop(0,'#4a5444'); cg.addColorStop(1,'#2a3026');
    ctx.fillStyle=cg;
    ctx.beginPath(); ctx.moveTo(-16,-7); ctx.quadraticCurveTo(0,-12,16,-7); ctx.lineTo(15,7); ctx.quadraticCurveTo(0,11,-15,7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#5c6656'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#e8ecd8'; ctx.font='4.5px monospace'; ctx.textAlign='center';
    ctx.fillText('FRONT',0,-1); ctx.fillText('ENEMY',0,4.6);
    if(lampOn){ ctx.fillStyle='#ff4838'; ctx.shadowBlur=8; ctx.shadowColor='#ff4838';
      ctx.beginPath(); ctx.arc(0,-9.5,2,0,6.283); ctx.fill(); ctx.shadowBlur=0; }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6200,endMs:4300,
  busy:function(st){ return (clay.boomT>0&&st.t-clay.boomT<760)||nades.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0 两颗烟雾罐抛物线 */
    if(!st.fired.can&&t>=60){ st.fired.can=1;
      for(var i=0;i<2;i++)cans.push({p:0,spd:0.0016,tx:st.hx+(i?54:-48)*sz,ty:st.hy+34*sz,delay:i*160,arc:70+i*16,rot:0,landed:false});
    }
    for(var ci=0;ci<cans.length;ci++){ var c=cans[ci];
      if(c.delay>0){c.delay-=st.dt;continue;}
      if(c.landed)continue;
      c.p+=c.spd*st.dt; c.rot+=st.dt*0.012;
      if(c.p>=1){ c.landed=true;
        smokes.push({x:c.tx,y:c.ty,r:0,life:0,max:2400,seed:rnd(0,9)});
        F.burst(st.P,c.tx,c.ty,'170,180,168',5,3,sz); }
    }
    for(var si2=smokes.length-1;si2>=0;si2--){ var sm=smokes[si2];
      sm.life+=st.dt; sm.r=Math.min(52*sz,sm.r+st.dt*0.055);
      if(sm.life>sm.max)smokes.splice(si2,1); }
    /* ②900 狙击枪架起 + 激光爬行→稳定→1950击发 */
    rifle.a=Math.min(1,Math.max(0,(t-900)/280));
    if(t>=1000&&t<1900){ laser.p=Math.min(1,(t-1000)/900); laser.lock=Math.max(0,(laser.p-0.72)/0.28); }
    if(!st.fired.shot&&t>=1950){ st.fired.shot=1; rifle.fireT=t;
      F.flash(st.P,st.bx+92*sz,st.by-6*sz,C_T,20*sz,130);
      F.trail(st.P,st.bx+92*sz,st.by-6*sz,st.hx,st.hy,C_T,4.5*sz,170);
      F.burst(st.P,st.hx,st.hy,C_O,14,7.5,sz); F.ring(st.P,st.hx,st.hy,C_R,1.1,3.4*sz); F.ring(st.P,st.hx,st.hy,C_T,0.7,2.2*sz);
      shell={x:st.bx+40*sz,y:st.by-12*sz,vx:1.6,vy:-2.6,rot:0,life:0};
      st.fire();
    }
    if(shell){ shell.life+=st.dt; shell.vy+=0.011*st.dt; shell.x+=shell.vx*st.dt*0.06; shell.y+=shell.vy*st.dt*0.06; shell.rot+=0.02*st.dt;
      if(shell.life>900)shell=null; }
    /* ③2150 闪光弹→2450白闪→2600军刀三连 */
    if(!st.fired.fc&&t>=2150){ st.fired.fc=1; flashCan={p:0,tx:st.hx-10*sz,ty:st.hy-20*sz,rot:0}; }
    if(flashCan&&flashCan.p<1){ flashCan.p+=st.dt*0.0028; flashCan.rot+=st.dt*0.015;
      if(flashCan.p>=1){ flashT=t; F.flash(st.P,flashCan.tx,flashCan.ty,'255,255,255',86*sz,320); } }
    if(!st.fired.kn&&t>=2620){ st.fired.kn=1;
      for(var k=0;k<3;k++)knives.push({ts:2620+k*200,ang:[-0.65,0.55,-0.08][k],done:false});
    }
    for(var ki=0;ki<knives.length;ki++){ var kn=knives[ki];
      if(!kn.done&&t>=kn.ts+110){ kn.done=true;
        F.beam(st.P,st.hx,st.hy,kn.ang,C_K,1.1,false);
        F.burst(st.P,st.hx,st.hy,C_K,7,5.5,sz);
      } }
    /* ④3250 克莱莫插地→红灯闪3→3800扇形齐爆 + 两颗手雷补爆 */
    clay.a=Math.min(1,Math.max(0,(t-3250)/200));
    if(!st.fired.blink&&t>=3450){ st.fired.blink=1; clay.blink=t; }
    if(!st.fired.cboom&&t>=3860){ st.fired.cboom=1; clay.boomT=t;
      F.flash(st.P,st.hx-30*sz,st.hy+26*sz,C_O,40*sz,220);
      for(var d2=0;d2<12;d2++){ var da=-0.55+d2/11*1.1;
        F.jet(st.P,st.hx-30*sz,st.hy+22*sz,da-1.57+1.57,0.06,d2%2?C_O:C_T,2,8.5,sz);
        F.trail(st.P,st.hx-30*sz,st.hy+22*sz,st.hx-30*sz+Math.cos(da-1.57+1.57)*70*sz,st.hy+22*sz+Math.sin(da-1.57+1.57)*70*sz*0.4-30*sz,C_O,2*sz,180); }
      F.ring(st.P,st.hx,st.hy,C_O,1.4,4.5*sz); F.burst(st.P,st.hx,st.hy,C_O,18,7.5,sz);
      F.shards(st.P,st.hx-30*sz,st.hy+20*sz,'120,110,90',10,sz);
      nades.push({p:0,spd:0.0022,tx:st.hx+40*sz,ty:st.hy+8*sz,arc:56,rot:0,delay:0});
      nades.push({p:0,spd:0.0022,tx:st.hx-6*sz,ty:st.hy-14*sz,arc:70,rot:0,delay:170});
    }
    for(var ni=nades.length-1;ni>=0;ni--){ var nd=nades[ni];
      if(nd.delay>0){nd.delay-=st.dt;continue;}
      nd.p+=nd.spd*st.dt; nd.rot+=st.dt*0.014;
      if(nd.p>=1){ F.flash(st.P,nd.tx,nd.ty,C_O,32*sz,200); F.burst(st.P,nd.tx,nd.ty,C_O,12,7,sz); F.ring(st.P,nd.tx,nd.ty,C_R,0.95,3*sz); nades.splice(ni,1); }
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 烟雾罐飞行 */
    for(var ci=0;ci<cans.length;ci++){ var c=cans[ci];
      if(c.delay>0||c.landed)continue;
      var x=st.bx+(c.tx-st.bx)*c.p, y=st.by+(c.ty-st.by)*c.p-Math.sin(c.p*3.14)*c.arc*sz;
      drawCan(ctx,x,y,1.1*sz,c.rot,1,'#4a5a48');
    }
    /* 浓烟(多层翻滚) */
    for(var si2=0;si2<smokes.length;si2++){ var sm=smokes[si2];
      var pr=sm.life/sm.max, a=pr<0.12?pr/0.12:(1-pr)*0.85;
      for(var l2=0;l2<4;l2++){ var la=sm.seed+l2*2.1+t*0.0012*(l2%2?1:-1);
        var lx=sm.x+Math.cos(la)*sm.r*0.34, ly=sm.y+Math.sin(la)*sm.r*0.22-l2*sm.r*0.16;
        var lr=sm.r*(0.55-l2*0.08);
        var sg=ctx.createRadialGradient(lx,ly,0,lx,ly,lr);
        sg.addColorStop(0,'rgba(158,168,155,'+(a*0.5)+')'); sg.addColorStop(1,'rgba(130,140,128,0)');
        ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(lx,ly,lr,0,6.283); ctx.fill(); }
    }
    /* 狙击枪 */
    if(rifle.a>0){ var rec=rifle.fireT>0&&t-rifle.fireT<130?1-(t-rifle.fireT)/130:0;
      var ang=Math.atan2(st.hy-(st.by-6*sz),st.hx-(st.bx+30*sz));
      drawRifle(ctx,st.bx+34*sz,st.by-6*sz,1.15*sz,ang,rifle.a,rec);
    }
    /* 弹壳 */
    if(shell){ ctx.save(); ctx.translate(shell.x,shell.y); ctx.rotate(shell.rot);
      ctx.fillStyle='#caa64a'; ctx.fillRect(-3*st.sz,-1.2*st.sz,6*st.sz,2.4*st.sz);
      ctx.restore(); }
    /* 闪光弹飞行 */
    if(flashCan&&flashCan.p<1){ var fx2=st.bx+(flashCan.tx-st.bx)*flashCan.p, fy=st.by+(flashCan.ty-st.by)*flashCan.p-Math.sin(flashCan.p*3.14)*64*sz;
      drawCan(ctx,fx2,fy,0.95*sz,flashCan.rot,1,'#5a5a68'); }
    /* 白闪残留(全屏白幕快闪) */
    if(flashT>0&&t-flashT<260){ var wa=1-(t-flashT)/260;
      ctx.fillStyle='rgba(255,255,255,'+(wa*0.68)+')'; ctx.fillRect(0,0,st.vw,st.barBot+18); }
    /* 军刀 */
    for(var ki=0;ki<knives.length;ki++){ var kn=knives[ki];
      if(t>=kn.ts&&t<kn.ts+160){ var pr2=(t-kn.ts)/160; var sw=(pr2-0.5)*2.3;
        ctx.save(); ctx.translate(st.hx,st.hy);
        drawKnife(ctx,0,0,1.1*sz,kn.ang+sw,pr2>0.8?(1-pr2)/0.2:1);
        ctx.restore(); } }
    /* 克莱莫 */
    if(clay.a>0&&!(clay.boomT>0&&t-clay.boomT>140)){
      var lampOn=clay.blink>0&&(Math.floor((t-clay.blink)/140)%2===0);
      drawClaymore(ctx,st.hx-30*sz,st.hy+26*sz,1.3*sz,clay.a,lampOn);
    }
    /* 手雷 */
    for(var ni=0;ni<nades.length;ni++){ var nd=nades[ni]; if(nd.delay>0)continue;
      var nx=st.bx+(nd.tx-st.bx)*nd.p, ny=st.by+(nd.ty-st.by)*nd.p-Math.sin(nd.p*3.14)*nd.arc*sz;
      ctx.save(); ctx.translate(nx,ny); ctx.rotate(nd.rot);
      ctx.fillStyle='#3a4a38'; ctx.beginPath(); ctx.ellipse(0,0,5*sz,6.5*sz,0,0,6.283); ctx.fill();
      ctx.strokeStyle='#5c6c58'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.moveTo(-5*sz,0); ctx.lineTo(5*sz,0); ctx.moveTo(0,-6*sz); ctx.lineTo(0,6*sz); ctx.stroke();
      ctx.fillStyle='#8a94a0'; ctx.fillRect(-2*sz,-9.5*sz,4*sz,3.4*sz);
      ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 激光爬行锁定 */
    if(t>=1000&&t<1950){ var p=laser.p*(laser.path.length-1);
      var i0=Math.floor(p), fr=p-i0;
      var p0=laser.path[Math.min(i0,laser.path.length-1)], p1=laser.path[Math.min(i0+1,laser.path.length-1)];
      var lx=st.hx+(p0.x+(p1.x-p0.x)*fr)*sz, ly=st.hy+(p0.y+(p1.y-p0.y)*fr)*sz;
      var muzX=st.bx+92*sz, muzY=st.by-6*sz;
      ctx.strokeStyle=g('255,50,45,'+(0.4+laser.lock*0.5)); ctx.lineWidth=1.1*sz; ctx.shadowBlur=6; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(muzX,muzY); ctx.lineTo(lx,ly); ctx.stroke(); ctx.shadowBlur=0;
      var dR=(5.5-laser.lock*2.6)*sz;
      ctx.fillStyle=g('255,50,45,0.95'); ctx.shadowBlur=10; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.arc(lx,ly,2.2*sz,0,6.283); ctx.fill(); ctx.shadowBlur=0;
      ctx.strokeStyle=g('255,50,45,'+(0.5+laser.lock*0.45)); ctx.lineWidth=1*sz;
      ctx.beginPath(); ctx.arc(lx,ly,dR,0,6.283); ctx.stroke();
      if(laser.lock>0.9){ ctx.beginPath(); ctx.moveTo(lx-dR-4*sz,ly); ctx.lineTo(lx-dR,ly); ctx.moveTo(lx+dR,ly); ctx.lineTo(lx+dR+4*sz,ly);
        ctx.moveTo(lx,ly-dR-4*sz); ctx.lineTo(lx,ly-dR); ctx.moveTo(lx,ly+dR); ctx.lineTo(lx,ly+dR+4*sz); ctx.stroke(); }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
