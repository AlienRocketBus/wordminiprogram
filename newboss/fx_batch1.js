/* ═══ 批1: 埃及/神话组 6 boss ═══ */

/* ①万典之灵·未被写下的故事 —— 巨型蘸水笔+稿纸风暴+删除线终结 */
function fxWandian(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var papers=[], runes=[], penPath=[], delT=-1;
  var GLYPHS='未完的诗被删的章节遗忘的结局草稿箱里';
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3700,
  busy:function(st){ return papers.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 翻开登记簿: 稿纸从boss周围升起 */
    if(t<1650&&Math.random()<0.25){ papers.push({x:st.bx+rnd(-90,90)*sz,y:st.by+rnd(-40,60)*sz,vx:rnd(-0.6,0.6),vy:rnd(-1.4,-0.5),rot:rnd(-0.6,0.6),vrot:rnd(-0.05,0.05),w:rnd(16,30)*sz,life:0,max:rnd(900,1500),mode:'rise'}); }
    /* ②820起 稿纸风暴扑向勇者 */
    if(!st.fired.storm&&t>=820){ st.fired.storm=1;
      for(var i=0;i<14;i++){ papers.push({x:st.bx+rnd(-100,100)*sz,y:st.by+rnd(-70,70)*sz,tx:st.hx+rnd(-70,70)*sz,ty:st.hy+rnd(-30,30)*sz,rot:rnd(0,6.28),vrot:rnd(-0.25,0.25),w:rnd(14,26)*sz,life:0,max:rnd(700,1100),mode:'dive',delay:i*55}); }
      st.fire();
    }
    /* ③1500 墨字符文浮现环绕勇者 */
    if(!st.fired.rune&&t>=1500){ st.fired.rune=1;
      for(var k=0;k<10;k++){ runes.push({ch:GLYPHS[k%GLYPHS.length],ang:k/10*6.283,r:(66+rnd(-8,8))*sz,life:0,max:1400,spin:rnd(0.0006,0.0014)}); }
      F.ring(st.P,st.hx,st.hy,'120,140,255',1.0,3*sz);
    }
    /* ④2500 删除线终结: 巨笔从左到右划穿勇者 */
    if(!st.fired.del&&t>=2500){ st.fired.del=1; delT=t; }
    if(delT>0&&t-delT<420){ var pr=(t-delT)/420; var x0=st.hx-160*sz, x1=st.hx+160*sz;
      penPath.push({x:x0+(x1-x0)*pr, y:st.hy+Math.sin(pr*3.14)*4*sz});
      if(penPath.length>50)penPath.shift();
      if(Math.random()<0.6)F.jet(st.P,x0+(x1-x0)*pr,st.hy,3.14/2,0.7,'60,70,110',2,2.5,sz);
    }
    if(!st.fired.delboom&&delT>0&&t-delT>=420){ st.fired.delboom=1;
      F.flash(st.P,st.hx,st.hy,'150,170,255',56*sz,240);
      F.burst(st.P,st.hx,st.hy,'90,110,200',22,7,sz); F.shards(st.P,st.hx,st.hy,'220,225,240',16,sz);
      F.ring(st.P,st.hx,st.hy,'150,170,255',1.5,5*sz);
    }
    /* 稿纸物理 */
    for(var pi=papers.length-1;pi>=0;pi--){ var p=papers[pi]; 
      if(p.delay>0){p.delay-=st.dt;continue;}
      p.life+=st.dt;
      if(p.mode==='rise'){ p.x+=p.vx*st.dt*0.06; p.y+=p.vy*st.dt*0.06; p.rot+=p.vrot; }
      else { var dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy); if(d<14){ F.burst(st.P,p.x,p.y,'120,140,255',4,4,st.sz); papers.splice(pi,1); continue;} p.x+=dx*0.045*st.dt*0.06*6; p.y+=dy*0.045*st.dt*0.06*6; p.rot+=p.vrot; }
      if(p.life>p.max){papers.splice(pi,1);}
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 稿纸实体(米白纸片+划痕字迹) */
    for(var i=0;i<papers.length;i++){ var p=papers[i]; if(p.delay>0)continue;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      var a=Math.min(1,(p.life/160))*(1-Math.max(0,(p.life/p.max-0.75))*4);
      ctx.globalAlpha=Math.max(0,Math.min(1,a));
      ctx.fillStyle='#efe9d8'; ctx.fillRect(-p.w/2,-p.w*0.65,p.w,p.w*1.3);
      ctx.strokeStyle='#b9b2a0'; ctx.lineWidth=0.8; ctx.strokeRect(-p.w/2,-p.w*0.65,p.w,p.w*1.3);
      ctx.strokeStyle='rgba(70,80,120,.75)'; ctx.lineWidth=0.9;
      for(var L=0;L<4;L++){ ctx.beginPath(); ctx.moveTo(-p.w*0.34,-p.w*0.4+L*p.w*0.26); ctx.lineTo(p.w*0.34,-p.w*0.4+L*p.w*0.26); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha=1;
    /* 巨型蘸水笔(第④幕划删除线时出现) */
    if(delT>0&&t-delT<520&&penPath.length){ var tip=penPath[penPath.length-1];
      ctx.save(); ctx.translate(tip.x,tip.y); ctx.rotate(-0.85);
      var bg=ctx.createLinearGradient(0,0,0,-64*sz); bg.addColorStop(0,'#1a1f30'); bg.addColorStop(.5,'#3a4260'); bg.addColorStop(1,'#6a739a');
      ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-4.5*sz,-16*sz); ctx.lineTo(-3*sz,-62*sz); ctx.lineTo(3*sz,-62*sz); ctx.lineTo(4.5*sz,-16*sz); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#c9d2ee'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-4.5*sz,-16*sz); ctx.lineTo(4.5*sz,-16*sz); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='#0e1220'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-14*sz); ctx.stroke();
      ctx.restore();
    }
    /* 删除线(实体墨线) */
    if(penPath.length>1){ ctx.strokeStyle='rgba(30,38,70,.92)'; ctx.lineWidth=5*sz; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(penPath[0].x,penPath[0].y);
      for(var q=1;q<penPath.length;q++)ctx.lineTo(penPath[q].x,penPath[q].y); ctx.stroke(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz;
    for(var i=runes.length-1;i>=0;i--){ var r=runes[i]; r.life+=st.dt; if(r.life>r.max){runes.splice(i,1);continue;}
      r.ang+=r.spin*st.dt; var pr=r.life/r.max, a=Math.sin(Math.min(1,pr*1.2)*3.14);
      var x=st.hx+Math.cos(r.ang)*r.r, y=st.hy+Math.sin(r.ang)*r.r*0.5;
      ctx.save(); ctx.globalAlpha=Math.max(0,a*0.9); ctx.fillStyle='#aebcff'; ctx.shadowBlur=10; ctx.shadowColor='#aebcff';
      ctx.font=(13*sz)+'px serif'; ctx.textAlign='center'; ctx.fillText(r.ch,x,y); ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ②不动明王·焚天镇狱尊 —— 烈阳法轮+六臂金焰杵剑+梵焰镇狱 */
function fxMingwang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,190,60', C_F='255,120,30';
  var wheel={r:0,rot:0}, strikes=[], pillarT=-1;
  function drawVajra(ctx,x,y,s,rot,a){ /* 金刚杵 */
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
  function drawSwordF(ctx,x,y,s,rot,a){ /* 金焰智慧剑 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#3a2f18'; ctx.fillRect(-2.5,18,5,14);
    ctx.fillStyle='#caa64a'; ctx.fillRect(-8,14,16,4);
    var bg=ctx.createLinearGradient(-4,0,4,0); bg.addColorStop(0,'#9a7830'); bg.addColorStop(.5,'#ffe9b0'); bg.addColorStop(1,'#9a7830');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-4,14); ctx.lineTo(-3,-38); ctx.lineTo(0,-46); ctx.lineTo(3,-38); ctx.lineTo(4,14); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowBlur=12; ctx.shadowColor='#ffb040'; ctx.strokeStyle='#ffd070'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(0,12); ctx.lineTo(0,-44); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3800,
  busy:function(st){ return pillarT>0&&st.t-pillarT<700; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-800 法轮升起 */
    wheel.r=Math.min(1,t/700); wheel.rot+=st.dt*0.0016;
    if(t<800&&Math.random()<0.5)F.suck(st.P,st.bx+rnd(-120,120)*sz,st.by+rnd(-100,100)*sz,st.bx,st.by-30*sz,C_G,sz);
    /* ②900起 六臂连击: 杵/剑交替6连 */
    if(!st.fired.s6&&t>=900){ st.fired.s6=1;
      for(var i=0;i<6;i++){ strikes.push({kind:i%2?'sword':'vajra',ts:900+i*230,ang:rnd(-0.5,0.5)+(i%2?0.7:-0.7),done:false}); }
      st.fire();
    }
    for(var si=0;si<strikes.length;si++){ var sk=strikes[si];
      if(!sk.done&&t>=sk.ts+150){ sk.done=true;
        F.beam(st.P,st.hx,st.hy,sk.ang,C_G,1.2,false);
        F.burst(st.P,st.hx,st.hy,C_F,8,6,sz); F.ring(st.P,st.hx,st.hy,C_G,0.9,3*sz);
      } }
    /* ③2350 念珠108弹幕(简化为24) */
    if(!st.fired.beads&&t>=2350){ st.fired.beads=1;
      for(var k=0;k<24;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var a=kk/24*6.283; F.suck(st.P,st.hx+Math.cos(a)*130*sz,st.hy+Math.sin(a)*70*sz,st.hx,st.hy,'40,30,20',sz);
      },kk*22/st.sp); })(k); }
      F.ring(st.P,st.hx,st.hy,C_F,1.2,4*sz);
    }
    /* ④2900 焚天镇狱: 法轮金焰柱压下 */
    if(!st.fired.pillar&&t>=2900){ st.fired.pillar=1; pillarT=t;
      F.flash(st.P,st.hx,st.hy,C_G,70*sz,300);
      F.burst(st.P,st.hx,st.hy,C_F,26,8,sz); F.ring(st.P,st.hx,st.hy,C_G,1.6,6*sz); F.ring(st.P,st.hx,st.hy,C_F,1.0,4*sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 当前挥击的实体杵/剑 */
    for(var si=0;si<strikes.length;si++){ var sk=strikes[si];
      if(t>=sk.ts&&t<sk.ts+220){ var pr=(t-sk.ts)/220;
        var L=150*sz, sx=st.hx-Math.cos(sk.ang)*L*(1-pr*2), sy=st.hy-Math.sin(sk.ang)*L*(1-pr*2);
        var a=pr<0.12?pr/0.12:(pr>0.85?(1-pr)/0.15:1);
        if(sk.kind==='vajra')drawVajra(ctx,sx,sy,1.5*sz,sk.ang+1.57,a);
        else drawSwordF(ctx,sx,sy,1.3*sz,sk.ang+1.57,a);
      } }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 烈阳法轮(boss身后) */
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
    /* 焚天金焰柱 */
    if(pillarT>0&&t-pillarT<700){ var pr=(t-pillarT)/700, env=Math.sin(pr*3.14);
      var w=54*sz*env;
      var pg=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      pg.addColorStop(0,g(C_F+',0')); pg.addColorStop(.5,g(C_G+','+(0.8*env))); pg.addColorStop(1,g(C_F+',0'));
      ctx.fillStyle=pg; ctx.fillRect(st.hx-w,0,w*2,st.barBot+18);
      if(Math.random()<0.8)F.jet(st.P,st.hx+rnd(-w*0.6,w*0.6),st.hy+rnd(-20,40)*sz,-1.57,0.4,C_F,2,5,sz);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ③亡灵咒术师·阿努比斯之影 —— 黑曜石短剑+金字塔结晶+银蓝冷焰引魂丝 */
function fxAnubis(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='150,200,255', C_W='230,245,255';
  var wisps=[], pyrT=-1, soulT=-1;
  function drawDagger(ctx,x,y,s,rot,a){ /* 黑曜石祭司短剑 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#171a22'; ctx.fillRect(-2,12,4,12);
    ctx.fillStyle='#3a4258'; ctx.fillRect(-7,10,14,3.5);
    var bg=ctx.createLinearGradient(-3.5,0,3.5,0); bg.addColorStop(0,'#0c0f16'); bg.addColorStop(.5,'#2e3648'); bg.addColorStop(1,'#0c0f16');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.moveTo(-3.5,10); ctx.lineTo(-2.2,-26); ctx.lineTo(0,-33); ctx.lineTo(2.2,-26); ctx.lineTo(3.5,10); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowBlur=10; ctx.shadowColor='#96c8ff'; ctx.strokeStyle='#bfe0ff'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(0,8); ctx.lineTo(0,-31); ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  function drawPyramid(ctx,x,y,s,a,lit){ /* 金字塔冥界结晶 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    var pg=ctx.createLinearGradient(-16,10,16,10); pg.addColorStop(0,'#20283a'); pg.addColorStop(.5,'#46557a'); pg.addColorStop(1,'#141a28');
    ctx.fillStyle=pg; ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(17,12); ctx.lineTo(-17,12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=lit?'#bfe0ff':'#5a6a90'; ctx.lineWidth=1.4; if(lit){ctx.shadowBlur=12;ctx.shadowColor='#96c8ff';} ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-20); ctx.lineTo(0,12); ctx.stroke(); ctx.shadowBlur=0;
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return soulT>0&&st.t-soulT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 冷焰点燃 */
    if(t<700&&Math.random()<0.55)F.jet(st.P,st.bx+rnd(-40,40)*sz,st.by-rnd(20,60)*sz,-1.57,0.5,C_B,1,2.2,sz);
    /* ②720起 银色引魂丝缠绕 */
    if(!st.fired.wisp&&t>=720){ st.fired.wisp=1;
      for(var i=0;i<9;i++){ wisps.push({ang:rnd(0,6.283),r:150*sz,tr:(26+i*4)*sz,spd:rnd(0.002,0.0035),ph:rnd(0,6.28),life:0,max:2300,trail:[]}); }
      st.fire();
    }
    /* ③1900 短剑刻咒+金字塔亮起 */
    if(!st.fired.pyr&&t>=1900){ st.fired.pyr=1; pyrT=t;
      F.ring(st.P,st.hx,st.hy,C_B,1.0,3*sz);
    }
    /* ④2750 灵魂剥离: 纯白冷焰爆 + 魂丝抽向boss */
    if(!st.fired.soul&&t>=2750){ st.fired.soul=1; soulT=t;
      F.flash(st.P,st.hx,st.hy,C_W,60*sz,280);
      F.ring(st.P,st.hx,st.hy,C_W,1.5,5*sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3.5*sz);
      for(var k=0;k<16;k++)F.suck(st.P,st.hx+rnd(-50,50)*sz,st.hy+rnd(-40,40)*sz,st.bx,st.by,C_W,sz);
      F.burst(st.P,st.hx,st.hy,C_B,18,7,sz);
    }
    /* 引魂丝运动 */
    for(var wi=wisps.length-1;wi>=0;wi--){ var w=wisps[wi]; w.life+=st.dt;
      if(w.life>w.max){wisps.splice(wi,1);continue;}
      var k=Math.min(1,w.life/900);
      w.r=150*sz*(1-k)+w.tr*k; w.ang+=w.spd*st.dt;
      var x=st.hx+Math.cos(w.ang)*w.r, y=st.hy+Math.sin(w.ang)*w.r*0.55+Math.sin(w.ph+w.life*0.004)*6*sz;
      w.trail.push({x:x,y:y}); if(w.trail.length>10)w.trail.shift();
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 短剑刻咒(③幕: 短剑在金字塔表面划) */
    if(pyrT>0&&t-pyrT<800){ var pr=(t-pyrT)/800;
      var px=st.bx-60*sz, py=st.by+10*sz;
      drawPyramid(ctx,px,py,1.4*sz,1,pr>0.5);
      var da=Math.sin(pr*9)*0.7;
      drawDagger(ctx,px+Math.cos(da)*24*sz,py-26*sz+Math.sin(pr*12)*5*sz,1.1*sz,0.5+da*0.4,1);
      if(Math.random()<0.5)F.burst(st.P,px+rnd(-12,12)*sz,py+rnd(-14,4)*sz,C_B,1,3,sz);
    } else if(t>=2750&&t<3400){ drawPyramid(ctx,st.bx-60*sz,st.by+10*sz,1.4*sz,1-(t-2750)/650,true); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz;
    /* 引魂丝(半透明银雾拖尾) */
    for(var wi=0;wi<wisps.length;wi++){ var w=wisps[wi]; if(w.trail.length<2)continue;
      var a=Math.sin(Math.min(1,w.life/w.max)*3.14)*0.8;
      ctx.strokeStyle=g(C_B+','+a); ctx.lineWidth=2*sz; ctx.lineCap='round'; ctx.shadowBlur=8; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.moveTo(w.trail[0].x,w.trail[0].y);
      for(var q=1;q<w.trail.length;q++)ctx.lineTo(w.trail[q].x,w.trail[q].y);
      ctx.stroke(); ctx.shadowBlur=0;
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ④古埃及大祭司·真理之口的裁决者 —— 黄金天平称心+碧绿冥火+裁决金锤 */
function fxDajisi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,210,90', C_E='90,255,170';
  var scaleA={y:0,tilt:0}, scanT=-1, verdictT=-1;
  function drawScale(ctx,x,y,s,tilt,a){ /* 黄金天平 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    ctx.strokeStyle='#caa64a'; ctx.fillStyle='#caa64a'; ctx.lineWidth=2.2;
    ctx.beginPath(); ctx.moveTo(0,26); ctx.lineTo(0,-18); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0,28,14,3.5,0,0,6.283); ctx.fill();
    ctx.save(); ctx.translate(0,-18); ctx.rotate(tilt);
    ctx.beginPath(); ctx.moveTo(-30,0); ctx.lineTo(30,0); ctx.stroke();
    for(var e=-1;e<=1;e+=2){ var px=30*e;
      ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px-6,12); ctx.moveTo(px,0); ctx.lineTo(px+6,12); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px,14,10,3.2,0,0,3.4); ctx.stroke();
    }
    /* 左盘羽毛 */
    ctx.save(); ctx.translate(-30,10); ctx.rotate(-0.3);
    ctx.strokeStyle='#eef4ff'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.moveTo(0,4); ctx.quadraticCurveTo(2,-4,0,-9); ctx.stroke();
    for(var f=0;f<5;f++){ ctx.beginPath(); ctx.moveTo(0,2-f*2.2); ctx.lineTo(-3.4,0.5-f*2.2); ctx.moveTo(0,2-f*2.2); ctx.lineTo(3.4,0.5-f*2.2); ctx.stroke(); }
    ctx.restore();
    ctx.restore();
    ctx.beginPath(); ctx.arc(0,-20,3,0,6.283); ctx.fill();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return verdictT>0&&st.t-verdictT<700; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    scaleA.y=Math.min(1,t/600);
    /* ②900 称量扫描 */
    if(!st.fired.scan&&t>=900){ st.fired.scan=1; scanT=t; st.fire(); }
    /* ③1900 碧绿冥火两柱 */
    if(!st.fired.fire&&t>=1900){ st.fired.fire=1;
      for(var e=-1;e<=1;e+=2){ (function(ee){ for(var k=0;k<12;k++){ setTimeout(function(){ if(st.dead)return;
        F.jet(st.P,st.hx+ee*54*st.sz,st.hy+30*st.sz,-1.57,0.32,C_E,3,6.5,st.sz);
      },k*46/st.sp); } })(e); }
      F.ring(st.P,st.hx,st.hy,C_E,1.1,3.5*sz);
    }
    /* ④2650 天平倾斜·有罪判决→金光巨压 */
    if(!st.fired.verdict&&t>=2650){ st.fired.verdict=1; verdictT=t;
      F.flash(st.P,st.hx,st.hy,C_G,64*sz,300);
      F.ring(st.P,st.hx,st.hy,C_G,1.6,5.5*sz); F.ring(st.P,st.hx,st.hy,C_E,1.0,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_G,24,8,sz); F.shards(st.P,st.hx,st.hy,C_G,14,sz);
    }
    if(verdictT>0)scaleA.tilt=Math.min(0.5,(t-verdictT)/500*0.5); else scaleA.tilt=Math.sin(t*0.003)*0.06;
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz;
    if(scaleA.y>0)drawScale(ctx,st.bx+70*sz,st.by-30*sz+(1-scaleA.y)*-40*sz,1.5*sz,scaleA.tilt,scaleA.y);
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 称量扫描线(金色横带下扫) */
    if(scanT>0&&t-scanT<900){ var pr=(t-scanT)/900;
      var y=st.hy-70*sz+pr*140*sz;
      var sg=ctx.createLinearGradient(0,y-14*sz,0,y+14*sz);
      sg.addColorStop(0,g(C_G+',0')); sg.addColorStop(.5,g(C_G+',0.55')); sg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=sg; ctx.fillRect(st.hx-90*sz,y-14*sz,180*sz,28*sz);
      ctx.strokeStyle=g(C_G+',0.9'); ctx.lineWidth=1.4*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(st.hx-90*sz,y); ctx.lineTo(st.hx+90*sz,y); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 判决金光柱 */
    if(verdictT>0&&t-verdictT<700){ var pr2=(t-verdictT)/700, env=Math.sin(pr2*3.14);
      var w=46*sz*env;
      var vg=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      vg.addColorStop(0,g(C_G+',0')); vg.addColorStop(.5,g(C_G+','+(0.75*env))); vg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=vg; ctx.fillRect(st.hx-w,0,w*2,st.barBot+18);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑤夜罗刹·红莲战鬼 —— 血月+业火爪连斩+红莲爆 */
function fxYecha(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,70,40', C_O='255,150,50', C_M='200,40,50';
  var moonA=0, claws=[], lotusT=-1;
  function drawClaw(ctx,x,y,s,rot,a){ /* 三道业火爪痕(实体黑爪+火缘) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    for(var k=-1;k<=1;k++){ ctx.save(); ctx.translate(0,k*12);
      var cg=ctx.createLinearGradient(-46,0,46,0); cg.addColorStop(0,'rgba(20,8,6,0)'); cg.addColorStop(.5,'#1c0e0a'); cg.addColorStop(1,'rgba(20,8,6,0)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.moveTo(-46,0); ctx.quadraticCurveTo(0,-7,46,0); ctx.quadraticCurveTo(0,7,-46,0); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.shadowBlur=10; ctx.shadowColor='#ff5030'; ctx.strokeStyle='#ff7040'; ctx.lineWidth=1.6;
      ctx.beginPath(); ctx.moveTo(-42,0); ctx.quadraticCurveTo(0,-5,42,0); ctx.stroke(); ctx.restore();
      ctx.restore(); }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3700,
  busy:function(st){ return lotusT>0&&st.t-lotusT<760; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    moonA=Math.min(1,t/650);
    if(t<800&&Math.random()<0.4)F.jet(st.P,st.bx+rnd(-70,70)*sz,st.by+rnd(-60,50)*sz,-1.57,0.5,C_R,1,2,sz);
    /* ②850起 业火爪四连斩 */
    if(!st.fired.claw&&t>=850){ st.fired.claw=1;
      var angs=[-0.5,0.6,-1.1,0.2];
      for(var i=0;i<4;i++)claws.push({ts:850+i*240,ang:angs[i],done:false});
      st.fire();
    }
    for(var ci=0;ci<claws.length;ci++){ var c=claws[ci];
      if(!c.done&&t>=c.ts+120){ c.done=true;
        F.burst(st.P,st.hx,st.hy,C_O,9,6.5,sz); F.ring(st.P,st.hx,st.hy,C_R,0.9,3*sz);
      } }
    /* ③2100 业火俯冲(火流从boss冲向勇者) */
    if(!st.fired.dash&&t>=2100){ st.fired.dash=1;
      for(var k=0;k<14;k++){ (function(kk){ setTimeout(function(){ if(st.dead)return;
        var p=kk/14; var x=st.bx+(st.hx-st.bx)*p, y=st.by+(st.hy-st.by)*p;
        F.burst(st.P,x,y,kk%2?C_R:C_O,4,4,st.sz);
      },kk*30/st.sp); })(k); }
    }
    /* ④2700 红莲爆 */
    if(!st.fired.lotus&&t>=2700){ st.fired.lotus=1; lotusT=t;
      F.flash(st.P,st.hx,st.hy,C_O,68*sz,300);
      F.burst(st.P,st.hx,st.hy,C_R,30,9,sz); F.ring(st.P,st.hx,st.hy,C_R,1.7,6*sz); F.ring(st.P,st.hx,st.hy,C_O,1.1,4*sz);
      F.shards(st.P,st.hx,st.hy,C_O,12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    for(var ci=0;ci<claws.length;ci++){ var c=claws[ci];
      if(t>=c.ts&&t<c.ts+200){ var pr=(t-c.ts)/200; var a=pr<0.15?pr/0.15:(pr>0.8?(1-pr)/0.2:1);
        drawClaw(ctx,st.hx,st.hy,(1.1+pr*0.5)*sz,c.ang,a); } }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 血月(boss上方) */
    if(moonA>0){ var mx=st.bx+80*sz, my=st.by-95*sz, R=30*sz;
      ctx.save(); ctx.globalAlpha=moonA*0.95;
      var mg=ctx.createRadialGradient(mx,my,0,mx,my,R*1.7); mg.addColorStop(0,g(C_M+',0.85')); mg.addColorStop(.55,g(C_M+',0.4')); mg.addColorStop(1,g(C_M+',0'));
      ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(mx,my,R*1.7,0,6.283); ctx.fill();
      ctx.fillStyle=g('255,110,90,0.9'); ctx.shadowBlur=18; ctx.shadowColor=g(C_M+',1');
      ctx.beginPath(); ctx.arc(mx,my,R,0,6.283); ctx.fill(); ctx.shadowBlur=0; ctx.restore();
    }
    /* 红莲绽放(④幕: 六瓣火莲) */
    if(lotusT>0&&t-lotusT<760){ var pr=(t-lotusT)/760, env=Math.sin(Math.min(1,pr*1.15)*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy);
      for(var k=0;k<6;k++){ var a=k/6*6.283+pr*0.8;
        ctx.save(); ctx.rotate(a);
        var pl=58*sz*env;
        var lg=ctx.createLinearGradient(0,0,0,-pl); lg.addColorStop(0,g(C_R+','+(0.75*env))); lg.addColorStop(1,g(C_O+',0'));
        ctx.fillStyle=lg;
        ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(-14*sz*env,-pl*0.55,0,-pl); ctx.quadraticCurveTo(14*sz*env,-pl*0.55,0,0); ctx.closePath(); ctx.fill();
        ctx.restore(); }
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑥天界守护者·黄金斯芬克斯 —— 太阳金翼+符文环+日轮审判 */
function fxSphinx(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,215,110', C_W='255,245,210';
  var wingA=0, runes=[], sunT=-1, beamT=-1;
  var SY=['☥','𓂀','◬','☉','𓋹','▽'];
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3700,
  busy:function(st){ return sunT>0&&st.t-sunT<760; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    wingA=Math.min(1,t/700);
    if(t<900&&Math.random()<0.6)F.jet(st.P,st.bx+rnd(-110,110)*sz,st.by-rnd(10,80)*sz,1.57,0.3,C_G,1,1.6,sz);
    /* ②900 符文环 */
    if(!st.fired.rune&&t>=900){ st.fired.rune=1;
      for(var k=0;k<6;k++)runes.push({ch:SY[k],ang:k/6*6.283,r:70*sz,life:0,max:1900,spin:0.001});
      F.ring(st.P,st.hx,st.hy,C_G,0.9,3*sz); st.fire();
    }
    /* ③1750 太阳十字光束三连扫 */
    if(!st.fired.beam&&t>=1750){ st.fired.beam=1; beamT=t; }
    if(beamT>0&&t-beamT<720&&Math.random()<0.7){ F.burst(st.P,st.hx+rnd(-60,60)*sz,st.hy+rnd(-30,30)*sz,C_G,2,4,sz); }
    /* ④2650 日轮审判 */
    if(!st.fired.sun&&t>=2650){ st.fired.sun=1; sunT=t;
      F.flash(st.P,st.hx,st.hy,C_W,66*sz,300);
      F.ring(st.P,st.hx,st.hy,C_G,1.6,6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.0,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_G,26,8,sz);
    }
    for(var ri=runes.length-1;ri>=0;ri--){ var r=runes[ri]; r.life+=st.dt; r.ang+=r.spin*st.dt; if(r.life>r.max)runes.splice(ri,1); }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 太阳金翼(boss两侧展开·金线羽) */
    if(wingA>0){ ctx.save(); ctx.globalAlpha=wingA;
      for(var e=-1;e<=1;e+=2){ ctx.save(); ctx.translate(st.bx+e*40*sz,st.by-10*sz); ctx.scale(e,1);
        for(var f=0;f<6;f++){ var fa=-0.9+f*0.26, L=(70+f*9)*sz*wingA;
          ctx.strokeStyle=g(C_G+','+(0.75-f*0.08)); ctx.lineWidth=(3.4-f*0.4)*sz; ctx.lineCap='round';
          ctx.shadowBlur=10; ctx.shadowColor=g(C_G+',1');
          ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(L*0.5,Math.sin(fa)*L*0.5-14*sz,L*Math.cos(fa*0.5),Math.sin(fa)*L);
          ctx.stroke();
          if(Math.random()<0.12)F.burst(st.P,st.bx+e*(40+L*0.8)*sz/sz*sz,st.by-10*sz+Math.sin(fa)*L,C_G,1,1.5,st.sz);
        }
        ctx.shadowBlur=0; ctx.restore(); }
      ctx.restore();
    }
    /* 符文环 */
    for(var ri=0;ri<runes.length;ri++){ var r=runes[ri]; var a=Math.sin(Math.min(1,r.life/r.max)*3.14);
      var x=st.hx+Math.cos(r.ang)*r.r, y=st.hy+Math.sin(r.ang)*r.r*0.5;
      ctx.save(); ctx.globalAlpha=a*0.95; ctx.fillStyle='#ffe9b0'; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
      ctx.font=(15*sz)+'px serif'; ctx.textAlign='center'; ctx.fillText(r.ch,x,y+5*sz); ctx.restore();
    }
    /* 太阳十字光束(③幕: 从boss额头射向勇者的十字光) */
    if(beamT>0&&t-beamT<720){ var pr=(t-beamT)/720, env=Math.sin(pr*3.14);
      var x0=st.bx,y0=st.by-40*sz;
      ctx.save(); ctx.strokeStyle=g(C_W+','+(0.85*env)); ctx.lineWidth=5*sz*env; ctx.lineCap='round';
      ctx.shadowBlur=16; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(st.hx,st.hy); ctx.stroke();
      /* 命中点十字 */
      ctx.lineWidth=3*sz*env;
      ctx.beginPath(); ctx.moveTo(st.hx-20*sz,st.hy); ctx.lineTo(st.hx+20*sz,st.hy);
      ctx.moveTo(st.hx,st.hy-20*sz); ctx.lineTo(st.hx,st.hy+20*sz); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 日轮审判(④幕: 头顶大日轮压下) */
    if(sunT>0&&t-sunT<760){ var pr2=(t-sunT)/760, env2=Math.sin(Math.min(1,pr2*1.1)*3.14);
      var sy=st.hy-140*sz+pr2*110*sz, R=52*sz*env2;
      var sg=ctx.createRadialGradient(st.hx,sy,0,st.hx,sy,R*1.6);
      sg.addColorStop(0,g(C_W+','+(0.9*env2))); sg.addColorStop(.55,g(C_G+','+(0.55*env2))); sg.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(st.hx,sy,R*1.6,0,6.283); ctx.fill();
      ctx.strokeStyle=g(C_W+','+env2); ctx.lineWidth=2.4*sz; ctx.shadowBlur=18; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.arc(st.hx,sy,R,0,6.283); ctx.stroke();
      for(var k=0;k<12;k++){ var a2=k/12*6.283+pr2*1.5;
        ctx.beginPath(); ctx.moveTo(st.hx+Math.cos(a2)*R,sy+Math.sin(a2)*R); ctx.lineTo(st.hx+Math.cos(a2)*(R+10*sz),sy+Math.sin(a2)*(R+10*sz)); ctx.stroke(); }
      ctx.shadowBlur=0;
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
