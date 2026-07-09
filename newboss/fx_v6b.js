/* ═══ v6b 重做(覆盖旧版): 组装者(工厂全面升级) / 古老意志(超新星三段式) ═══ */

/* ㉝v6 机械主教·组装者 —— 工厂苏醒(垂臂+焊花)→十字切割+冲压铆钉→舱门出兵→矩阵聚焦+齿轮飞散 */
function fxZuzhuang(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_R='255,60,45', C_O='255,150,60', C_M='170,182,200', C_T='255,220,150';
  var eyeT=-1, cutT=-1, cut2T=-1, cutMark={h:-1,v:-1}, hammerT=-1, hatchT=-1, bots=[], gridT=-1, gears=[], hangArms=[];
  function drawBot(ctx,x,y,s,a,walk){
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
  function drawGear(ctx,x,y,r,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot);
    var gg2=ctx.createRadialGradient(0,0,r*0.2,0,0,r); gg2.addColorStop(0,'#7a8698'); gg2.addColorStop(1,'#3a4250');
    ctx.fillStyle=gg2; ctx.strokeStyle='#1c222c'; ctx.lineWidth=1.2;
    ctx.beginPath();
    for(var k=0;k<8;k++){ var a0=k/8*6.283, a1=a0+0.32, a2=a0+0.46, a3=a0+0.785;
      ctx.arc(0,0,r,a0,a1); ctx.lineTo(Math.cos(a2)*r*1.28,Math.sin(a2)*r*1.28);
      ctx.arc(0,0,r*1.28,a2,a2+0.18); ctx.lineTo(Math.cos(a3)*r,Math.sin(a3)*r); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#1c222c'; ctx.beginPath(); ctx.arc(0,0,r*0.34,0,6.283); ctx.fill();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6700,endMs:4800,
  busy:function(st){ return bots.length>0||gears.length>0||(gridT>0&&st.t-gridT<1050); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①工厂苏醒: 焊花+3条垂臂张合+独眼 */
    if(!st.fired.eye&&t>=120){ st.fired.eye=1; eyeT=t;
      for(var i=0;i<3;i++)hangArms.push({x:st.hx+(i-1)*72*sz+rnd(-10,10)*sz,drop:0,ph:rnd(0,6.28)});
    }
    if(t<1000&&Math.random()<0.55){ var wx=st.hx+rnd(-120,120)*sz, wy=st.hy+rnd(-70,55)*sz;
      F.jet(st.P,wx,wy,-1.57+rnd(-0.6,0.6),0.5,C_T,3,4.5,sz);
      F.flash(st.P,wx,wy,C_O,7*sz,90); }
    for(var hi2=0;hi2<hangArms.length;hi2++){ var H2=hangArms[hi2]; H2.drop=Math.min(1,H2.drop+st.dt*0.0012); }
    /* ②1050 激光十字切割: 横扫→1500竖劈 + 1900液压锤+铆钉 */
    if(!st.fired.cut&&t>=1050){ st.fired.cut=1; cutT=t; st.fire(); }
    if(cutT>0&&t-cutT<440&&Math.random()<0.7){ var sp2=(t-cutT)/440;
      F.burst(st.P,st.hx-56*sz+sp2*112*sz,st.hy+rnd(-5,5)*sz,C_O,2,4,sz); }
    if(!st.fired.mark1&&cutT>0&&t-cutT>=440){ st.fired.mark1=1; cutMark.h=t; }
    if(!st.fired.cut2&&t>=1560){ st.fired.cut2=1; cut2T=t; }
    if(cut2T>0&&t-cut2T<380&&Math.random()<0.7){ var sp3=(t-cut2T)/380;
      F.burst(st.P,st.hx+rnd(-5,5)*sz,st.hy-40*sz+sp3*80*sz,C_O,2,4,sz); }
    if(!st.fired.mark2&&cut2T>0&&t-cut2T>=380){ st.fired.mark2=1; cutMark.v=t; }
    if(!st.fired.ham&&t>=2050){ st.fired.ham=1; hammerT=t; }
    if(!st.fired.hamhit&&hammerT>0&&t-hammerT>=300){ st.fired.hamhit=1;
      F.flash(st.P,st.hx,st.hy,C_O,46*sz,230);
      F.burst(st.P,st.hx,st.hy,C_O,14,7.5,sz); F.ring(st.P,st.hx,st.hy,C_R,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_T,0.8,2.6*sz);
      /* 铆钉飞溅 */
      for(var rv=0;rv<7;rv++){ var ra=rnd(0,6.28);
        F.trail(st.P,st.hx,st.hy,st.hx+Math.cos(ra)*rnd(30,60)*sz,st.hy+Math.sin(ra)*rnd(20,42)*sz,C_T,1.8*sz,200); }
      F.shards(st.P,st.hx,st.hy,C_M,10,sz);
    }
    /* ③2650 出货口舱门开→4个小兵冲锋自爆 */
    if(!st.fired.hatch&&t>=2650){ st.fired.hatch=1; hatchT=t;
      F.burst(st.P,st.bx+42*sz,st.by+52*sz,C_T,8,4,sz);
    }
    if(!st.fired.bots&&t>=2900){ st.fired.bots=1;
      for(var i2=0;i2<4;i2++)bots.push({p:0,spd:rnd(0.001,0.00125),off:(i2-1.5)*22,delay:i2*170,walk:rnd(0,6)});
    }
    for(var bi=bots.length-1;bi>=0;bi--){ var B=bots[bi];
      if(B.delay>0){B.delay-=st.dt;continue;}
      B.p+=B.spd*st.dt; B.walk+=st.dt*0.032;
      if(B.p>=1){ F.flash(st.P,st.hx+B.off*sz*0.4,st.hy,C_O,22*sz,170);
        F.burst(st.P,st.hx+B.off*sz*0.4,st.hy,C_O,9,6,sz); F.ring(st.P,st.hx+B.off*sz*0.4,st.hy,C_R,0.8,2.6*sz);
        bots.splice(bi,1); }
    }
    /* ④3900 清理协议: 矩阵网格→收缩聚焦一点→大爆+齿轮飞散 */
    if(!st.fired.grid&&t>=3900){ st.fired.grid=1; gridT=t; }
    if(!st.fired.gboom&&gridT>0&&t-gridT>=560){ st.fired.gboom=1;
      F.flash(st.P,st.hx,st.hy,C_R,62*sz,300);
      F.ring(st.P,st.hx,st.hy,C_R,1.8,5.6*sz); F.ring(st.P,st.hx,st.hy,C_O,1.2,3.8*sz);
      F.burst(st.P,st.hx,st.hy,C_R,24,8.5,sz); F.burst(st.P,st.hx,st.hy,C_O,12,6.5,sz);
      for(var g2=0;g2<4;g2++){ var ga=rnd(0,6.28);
        gears.push({x:st.hx,y:st.hy,vx:Math.cos(ga)*rnd(2,3.6),vy:Math.sin(ga)*rnd(1.6,3)-2.4,rot:rnd(0,6.28),vrot:rnd(-0.14,0.14),r:rnd(6,11)*sz,life:0,max:rnd(800,1200)}); }
    }
    for(var gi=gears.length-1;gi>=0;gi--){ var G2=gears[gi];
      G2.life+=st.dt; G2.vy+=0.012*st.dt; G2.x+=G2.vx*st.dt*0.06; G2.y+=G2.vy*st.dt*0.06; G2.rot+=G2.vrot*st.dt*0.06;
      if(G2.life>G2.max)gears.splice(gi,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 垂吊机械小臂(①幕: 从顶部垂下·末端钳张合) */
    for(var hi2=0;hi2<hangArms.length;hi2++){ var H2=hangArms[hi2];
      if(H2.drop<=0)continue;
      var fade=t>3700?Math.max(0,1-(t-3700)/400):1;
      var len=H2.drop*(56+hi2*8)*sz;
      ctx.save(); ctx.globalAlpha=fade;
      ctx.strokeStyle='#3a4250'; ctx.lineWidth=4.5*sz; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(H2.x,0); ctx.lineTo(H2.x,len); ctx.stroke();
      ctx.strokeStyle='#6a7688'; ctx.lineWidth=1.4*sz;
      ctx.beginPath(); ctx.moveTo(H2.x,0); ctx.lineTo(H2.x,len); ctx.stroke();
      var open=(Math.sin(t*0.004+H2.ph)+1)/2*0.5+0.2;
      ctx.strokeStyle='#8a94a4'; ctx.lineWidth=2.6*sz;
      for(var e=-1;e<=1;e+=2){ ctx.beginPath(); ctx.moveTo(H2.x,len);
        ctx.quadraticCurveTo(H2.x+e*7*sz*open,len+6*sz,H2.x+e*4.5*sz*open,len+13*sz); ctx.stroke(); }
      ctx.fillStyle='#ff4838'; ctx.beginPath(); ctx.arc(H2.x,len,2*sz,0,6.283); ctx.fill();
      ctx.restore();
    }
    /* 切割十字臂 */
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
    if(cutT>0&&t-cutT<500){ var sp2=Math.min(1,(t-cutT)/440);
      var ex=st.hx-56*sz+sp2*112*sz;
      drawArm(st.bx+50*sz,st.by-70*sz,ex,st.hy-26*sz,'laser',(t-cutT)>420?(500-(t-cutT))/80:1);
      ctx.strokeStyle=g(C_R+',0.95'); ctx.lineWidth=2.4*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(ex,st.hy-20*sz); ctx.lineTo(ex,st.hy+8*sz); ctx.stroke(); ctx.shadowBlur=0;
    }
    if(cut2T>0&&t-cut2T<440){ var sp3=Math.min(1,(t-cut2T)/380);
      var ey2=st.hy-40*sz+sp3*80*sz;
      drawArm(st.bx+58*sz,st.by-78*sz,st.hx+30*sz,ey2,'laser',(t-cut2T)>360?(440-(t-cut2T))/80:1);
      ctx.strokeStyle=g(C_R+',0.95'); ctx.lineWidth=2.4*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(st.hx-14*sz,ey2); ctx.lineTo(st.hx+14*sz,ey2); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 十字切痕(红热渐冷) */
    [['h',st.hx-56*sz,st.hy,st.hx+56*sz,st.hy],['v',st.hx,st.hy-40*sz,st.hx,st.hy+40*sz]].forEach(function(mk){
      var mt=cutMark[mk[0]]; if(mt<0)return;
      var age=t-mt; if(age>1400)return;
      var heat=Math.max(0,1-age/1400);
      ctx.strokeStyle='rgba(255,'+(60+heat*120)+','+(40+heat*40)+','+(0.35+heat*0.6)+')';
      ctx.lineWidth=(1.4+heat*1.4)*sz; ctx.shadowBlur=8*heat; ctx.shadowColor=g(C_R+',1');
      ctx.beginPath(); ctx.moveTo(mk[1],mk[2]); ctx.lineTo(mk[3],mk[4]); ctx.stroke(); ctx.shadowBlur=0;
    });
    /* 液压锤 */
    if(hammerT>0&&t-hammerT<520){ var hp2=(t-hammerT);
      var hy2=hp2<300?st.hy-96*sz+Math.pow(hp2/300,2)*84*sz:st.hy-12*sz;
      drawArm(st.bx+58*sz,st.by-80*sz,st.hx,hy2,'hammer',hp2>400?(520-hp2)/120:1);
    }
    /* 出货口舱门(两扇滑开)+传送带+小兵 */
    if(hatchT>0&&t<4100){ var open=Math.min(1,(t-hatchT)/320);
      var fade2=t>3800?Math.max(0,(4100-t)/300):1;
      var hx0=st.bx+40*sz, hy0=st.by+42*sz;
      ctx.save(); ctx.globalAlpha=fade2;
      ctx.fillStyle='#1c222c'; ctx.fillRect(hx0-20*sz,hy0-14*sz,40*sz,28*sz);
      var dg=ctx.createLinearGradient(0,hy0-14*sz,0,hy0+14*sz); dg.addColorStop(0,'#4a5464'); dg.addColorStop(1,'#2a323e');
      ctx.fillStyle=dg; ctx.strokeStyle='#6a7688'; ctx.lineWidth=1*sz;
      ctx.fillRect(hx0-20*sz-open*18*sz,hy0-14*sz,18*sz,28*sz); ctx.strokeRect(hx0-20*sz-open*18*sz,hy0-14*sz,18*sz,28*sz);
      ctx.fillRect(hx0+2*sz+open*18*sz,hy0-14*sz,18*sz,28*sz); ctx.strokeRect(hx0+2*sz+open*18*sz,hy0-14*sz,18*sz,28*sz);
      /* 门内红光 */
      ctx.fillStyle='rgba(255,70,50,'+(0.4*open)+')'; ctx.fillRect(hx0-18*sz*open,hy0-12*sz,36*sz*open,24*sz);
      /* 传送带 */
      var beltY=st.hy+34*sz;
      ctx.fillStyle='#2a323e'; ctx.fillRect(hx0-6*sz,beltY,st.hx-hx0+30*sz,6*sz);
      ctx.strokeStyle='#4a5464'; ctx.lineWidth=1*sz;
      var scroll=(t*0.05)%12;
      for(var v=0;v<14;v++){ var vx=hx0-6*sz+v*12*sz-scroll*sz;
        if(vx>hx0-6*sz&&vx<st.hx+20*sz){ ctx.beginPath(); ctx.moveTo(vx,beltY); ctx.lineTo(vx,beltY+6*sz); ctx.stroke(); } }
      ctx.restore();
    }
    for(var bi=0;bi<bots.length;bi++){ var B=bots[bi]; if(B.delay>0)continue;
      var x=st.bx+40*sz+(st.hx+B.off*sz*0.4-(st.bx+40*sz))*B.p;
      var y=st.hy+28*sz-Math.abs(Math.sin(B.walk))*2*sz;
      drawBot(ctx,x,y,1.15*sz,Math.min(1,B.p*5),B.walk);
    }
    /* 齿轮碎片 */
    for(var gi=0;gi<gears.length;gi++){ var G2=gears[gi];
      var aa=G2.life>G2.max*0.65?Math.max(0,1-(G2.life-G2.max*0.65)/(G2.max*0.35)):1;
      drawGear(ctx,G2.x,G2.y,G2.r,G2.rot,aa); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 红独眼扫描 */
    if(eyeT>0&&t-eyeT<1000){ var pr=(t-eyeT)/1000, env=Math.sin(Math.min(1,pr*1.3)*3.14);
      var ox=st.bx, oy=st.by-84*sz;
      var eg=ctx.createRadialGradient(ox,oy,0,ox,oy,13*sz);
      eg.addColorStop(0,'rgba(255,130,110,'+env+')'); eg.addColorStop(.4,g(C_R+','+(0.85*env))); eg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(ox,oy,13*sz,0,6.283); ctx.fill();
      var sway=Math.sin(t*0.006)*30*sz;
      var cg=ctx.createLinearGradient(ox,oy,st.hx+sway,st.hy);
      cg.addColorStop(0,g(C_R+','+(0.4*env))); cg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=cg;
      ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(st.hx+sway-30*sz,st.hy+10*sz); ctx.lineTo(st.hx+sway+30*sz,st.hy+10*sz); ctx.closePath(); ctx.fill();
      if(pr>0.35){ ctx.fillStyle=g(C_R+','+(0.85*env)); ctx.font=(8*sz)+'px monospace';
        ctx.fillText('SCAN 98%',st.hx+36*sz,st.hy-30*sz); ctx.fillText('杂质:1',st.hx+36*sz,st.hy-20*sz); }
    }
    /* 清理协议: 矩阵网格→收缩聚焦 */
    if(gridT>0&&t-gridT<900){ var pr2=(t-gridT)/900;
      var shrink=pr2<0.4?1:1-Math.min(1,(pr2-0.4)/0.35)*0.92;
      var env2=pr2>0.8?Math.max(0,(0.9-pr2)/0.1):1;
      ctx.save(); ctx.globalAlpha=Math.max(0,env2);
      ctx.strokeStyle=g(C_R+',0.8'); ctx.lineWidth=1.4*sz; ctx.shadowBlur=8; ctx.shadowColor=g(C_R+',1');
      var w=128*sz*shrink, h=88*sz*shrink;
      var x0=st.hx-w/2, y0=st.hy-h/2;
      var n=Math.floor(5*Math.min(1,pr2*3.4));
      for(var k=0;k<=n;k++){ ctx.beginPath(); ctx.moveTo(x0+k/5*w,y0); ctx.lineTo(x0+k/5*w,y0+h); ctx.stroke(); }
      for(var k2=0;k2<=Math.floor(4*Math.min(1,pr2*3.4));k2++){ ctx.beginPath(); ctx.moveTo(x0,y0+k2/4*h); ctx.lineTo(x0+w,y0+k2/4*h); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉞v6 活体行星·古老意志 —— 两极点亮苏醒→引力波+畸变→记忆星尘洪流→坍缩·白核·超新星·余烬 */
function fxGuyi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='90,150,255', C_G='255,210,110', C_W='255,246,220', C_A='240,200,130';
  var planet={a:0,wake:0,glow:0,pulse:0}, waves=[], streamT=-1, memDots=[], collapseT=-1, core={r:0}, novaT=-1, embers=[];
  function drawPlanet(ctx,x,y,s,a,t,P){ /* 深蓝光膜行星: 两极点亮·思维纹路·记忆环光点流动·极光 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y);
    var R=32*s;
    /* 记忆环(后半) */
    ctx.save(); ctx.rotate(-0.35);
    ctx.strokeStyle='rgba(255,210,110,'+(0.5+P.glow*0.4)+')'; ctx.lineWidth=1.6*s; ctx.shadowBlur=8; ctx.shadowColor='rgba(255,210,110,1)';
    ctx.beginPath(); ctx.ellipse(0,0,R*1.78,R*0.5,0,3.14,6.283); ctx.stroke(); ctx.shadowBlur=0;
    ctx.restore();
    /* 行星体 */
    var pg=ctx.createRadialGradient(-R*0.35,-R*0.35,R*0.15,0,0,R);
    pg.addColorStop(0,'#3a6ab8'); pg.addColorStop(.6,'#1c3a78'); pg.addColorStop(1,'#0c1a44');
    ctx.fillStyle=pg; ctx.shadowBlur=(14+P.glow*16)*(1+P.pulse*0.5); ctx.shadowColor='rgba(110,170,255,0.9)';
    ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.save(); ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.clip();
    /* 两极向赤道点亮(苏醒光带) */
    if(P.wake>0&&P.wake<1.05){ var bw=R*0.22;
      for(var e=-1;e<=1;e+=2){ var by2=-e*R+e*P.wake*R;
        var wg=ctx.createLinearGradient(0,by2-e*bw,0,by2+e*bw);
        wg.addColorStop(0,'rgba(255,215,130,0)'); wg.addColorStop(.5,'rgba(255,225,150,0.6)'); wg.addColorStop(1,'rgba(255,215,130,0)');
        ctx.fillStyle=wg; ctx.fillRect(-R,Math.min(by2-e*bw,by2+e*bw),R*2,bw*2); } }
    /* 思维纹路 */
    var litLine=0.5+P.glow*0.45+P.pulse*0.4;
    ctx.strokeStyle='rgba(255,210,110,'+Math.min(1,litLine)+')'; ctx.lineWidth=1.1*s; ctx.shadowBlur=6; ctx.shadowColor='rgba(255,210,110,1)';
    for(var L2=0;L2<3;L2++){ ctx.beginPath();
      for(var v=0;v<=10;v++){ var vx=-R+v/10*R*2;
        var vy=Math.sin(v*1.3+t*0.0012+L2*2.1)*R*0.3+(L2-1)*R*0.42;
        if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
      ctx.stroke(); }
    ctx.shadowBlur=0; ctx.restore();
    /* 极光边缘 */
    ctx.strokeStyle='rgba(150,255,210,'+(0.25+P.glow*0.3)+')'; ctx.lineWidth=3*s;
    ctx.beginPath(); ctx.arc(0,0,R*1.06,-2.4,-0.7); ctx.stroke();
    ctx.strokeStyle='rgba(255,215,130,'+(0.35+P.glow*0.45+P.pulse*0.3)+')'; ctx.lineWidth=2*s;
    ctx.beginPath(); ctx.arc(0,0,R*1.09,0,6.283); ctx.stroke();
    /* 地核透光 */
    if(P.glow>0.1||P.pulse>0){ var cA=Math.min(1,P.glow*0.9+P.pulse);
      var cg=ctx.createRadialGradient(0,0,0,0,0,R*0.45);
      cg.addColorStop(0,'rgba(255,240,190,'+cA+')'); cg.addColorStop(1,'rgba(255,210,110,0)');
      ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(0,0,R*0.45,0,6.283); ctx.fill(); }
    /* 记忆环(前半+流动光点) */
    ctx.save(); ctx.rotate(-0.35);
    ctx.strokeStyle='rgba(255,210,110,'+(0.6+P.glow*0.4)+')'; ctx.lineWidth=1.8*s; ctx.shadowBlur=10; ctx.shadowColor='rgba(255,210,110,1)';
    ctx.beginPath(); ctx.ellipse(0,0,R*1.78,R*0.5,0,0,3.14); ctx.stroke(); ctx.shadowBlur=0;
    for(var d2=0;d2<4;d2++){ var da=t*0.0011+d2/4*6.283;
      var dx2=Math.cos(da)*R*1.78, dy2=Math.sin(da)*R*0.5;
      var dp=0.55+Math.sin(t*0.008+d2)*0.35;
      ctx.fillStyle='rgba(255,240,190,'+dp+')'; ctx.shadowBlur=8; ctx.shadowColor='rgba(255,220,140,1)';
      ctx.beginPath(); ctx.arc(dx2,dy2,2.4*s,0,6.283); ctx.fill(); ctx.shadowBlur=0; }
    ctx.restore();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:7000,endMs:5100,
  busy:function(st){ return embers.length>0||(novaT>0&&st.t-novaT<1200); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    var px=st.bx+82*sz, py=st.by-72*sz;
    /* ①0-1000 苏醒: 两极点亮扫向赤道 */
    planet.a=Math.min(1,t/450);
    planet.wake=Math.min(1.05,Math.max(0,(t-300)/700));
    planet.glow=Math.min(0.4,t/3000);
    if(t<900&&Math.random()<0.4)F.suck(st.P,px+rnd(-80,80)*sz,py+rnd(-60,60)*sz,px,py,C_G,sz*0.8);
    /* ②1050起 引力波三道+畸变环 */
    if(!st.fired.w1&&t>=1050){ st.fired.w1=1; waves.push({ts:t}); st.fire(); }
    if(!st.fired.w2&&t>=1400){ st.fired.w2=1; waves.push({ts:t}); }
    if(!st.fired.w3&&t>=1750){ st.fired.w3=1; waves.push({ts:t});
      F.burst(st.P,st.hx,st.hy,C_B,10,6,sz); F.ring(st.P,st.hx,st.hy,C_B,1.0,3*sz); }
    /* ③2250 记忆星尘洪流(粒子河720ms) */
    if(!st.fired.stream&&t>=2250){ st.fired.stream=1; streamT=t;
      for(var m=0;m<3;m++)memDots.push({p:0,spd:rnd(0.0011,0.0015),delay:m*200,arc:rnd(0.6,1.1)});
    }
    if(streamT>0&&t-streamT<760){
      for(var q=0;q<3;q++){ if(Math.random()<0.85){ var pp=rnd(0,1);
        var arc0=rnd(0.65,1.05);
        var sx=px+(st.hx-px)*pp, sy2=py+(st.hy-py)*pp-Math.sin(pp*3.14)*54*sz*arc0;
        F.jet(st.P,sx,sy2,Math.atan2(st.hy-py,st.hx-px)+rnd(-0.25,0.25),0.2,C_G,1,3,sz*0.9); } }
    }
    for(var mi=memDots.length-1;mi>=0;mi--){ var M=memDots[mi];
      if(M.delay>0){M.delay-=st.dt;continue;}
      M.p+=M.spd*st.dt;
      if(M.p>=1){ F.burst(st.P,st.hx,st.hy,C_W,8,5.5,sz); F.ring(st.P,st.hx,st.hy,C_G,0.75,2.4*sz); memDots.splice(mi,1); }
    }
    /* ④3150 光核极速脉动→3450 坍缩吸入→3950 超新星→余烬 */
    if(t>=3150&&t<3450)planet.pulse=Math.abs(Math.sin((t-3150)*0.02))*Math.min(1,(t-3150)/150);
    if(!st.fired.col&&t>=3450){ st.fired.col=1; collapseT=t; planet.glow=0.9; planet.pulse=0.7; }
    if(collapseT>0&&t-collapseT<480){
      if(Math.random()<0.95)F.suck(st.P,st.hx+rnd(-100,100)*sz,st.hy+rnd(-68,68)*sz,st.hx,st.hy,Math.random()<0.5?C_G:C_B,sz);
      core.r=Math.min(12*sz,core.r+st.dt*0.024*sz);
    }
    if(!st.fired.nova&&t>=3950){ st.fired.nova=1; novaT=t;
      F.flash(st.P,st.hx,st.hy,C_W,78*sz,360);
      F.ring(st.P,st.hx,st.hy,C_G,2.1,6.6*sz); F.ring(st.P,st.hx,st.hy,C_B,1.5,4.8*sz); F.ring(st.P,st.hx,st.hy,C_W,1.0,3.2*sz);
      F.burst(st.P,st.hx,st.hy,C_G,30,9.5,sz); F.burst(st.P,st.hx,st.hy,C_B,18,7.5,sz);
      F.shards(st.P,st.hx,st.hy,C_A,14,sz);
      for(var e2=0;e2<16;e2++)embers.push({x:st.hx+rnd(-96,96)*sz,y:st.hy-rnd(30,120)*sz,vy:rnd(0.35,0.8),ph:rnd(0,6.28),r:rnd(1.4,3)*sz,life:0,max:rnd(1100,1700)});
    }
    for(var ei=embers.length-1;ei>=0;ei--){ var E=embers[ei];
      E.life+=st.dt; E.y+=E.vy*st.dt*0.06;
      if(E.life>E.max||E.y>st.barBot)embers.splice(ei,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(planet.a>0)drawPlanet(ctx,st.bx+82*sz,st.by-72*sz,1.2*sz,planet.a*(t>4600?Math.max(0,1-(t-4600)/380):1),t,planet);
    /* 记忆光点(大发光粒·实体) */
    var px=st.bx+82*sz, py=st.by-72*sz;
    for(var mi=0;mi<memDots.length;mi++){ var M=memDots[mi]; if(M.delay>0)continue;
      var x=px+(st.hx-px)*M.p, y=py+(st.hy-py)*M.p-Math.sin(M.p*3.14)*54*sz*M.arc;
      var mg2=ctx.createRadialGradient(x,y,0,x,y,7*sz);
      mg2.addColorStop(0,'rgba(255,250,235,1)'); mg2.addColorStop(.4,'rgba(255,225,150,0.9)'); mg2.addColorStop(1,'rgba(255,210,110,0)');
      ctx.fillStyle=mg2; ctx.shadowBlur=12; ctx.shadowColor='rgba(255,220,140,1)';
      ctx.beginPath(); ctx.arc(x,y,4.4*sz,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    }
    /* 余烬(缓缓下落的金屑) */
    for(var ei=0;ei<embers.length;ei++){ var E=embers[ei];
      var pr=E.life/E.max, aa=pr<0.12?pr/0.12:1-Math.max(0,pr-0.55)/0.45;
      var xx=E.x+Math.sin(E.ph+E.life*0.002)*10*sz;
      ctx.save(); ctx.globalAlpha=Math.max(0,aa*0.9);
      ctx.fillStyle='#f2ce7a'; ctx.shadowBlur=5; ctx.shadowColor='rgba(255,215,130,1)';
      ctx.beginPath(); ctx.arc(xx,E.y,E.r,0,6.283); ctx.fill(); ctx.shadowBlur=0; ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var px=st.bx+82*sz, py=st.by-72*sz;
    /* 引力波弧+到达时畸变环 */
    for(var wi=0;wi<waves.length;wi++){ var W3=waves[wi];
      var age=t-W3.ts; if(age>860)continue;
      var pr=age/860;
      var cx=px+(st.hx-px)*pr, cy=py+(st.hy-py)*pr;
      var R2=(14+pr*34)*sz;
      ctx.strokeStyle=g(C_B+','+(0.75*(1-pr))); ctx.lineWidth=(3.4-pr*2)*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_B+',1');
      var a2=Math.atan2(st.hy-py,st.hx-px);
      ctx.beginPath(); ctx.arc(cx,cy,R2,a2-1.15,a2+1.15); ctx.stroke(); ctx.shadowBlur=0;
      if(pr>0.82){ var da=(pr-0.82)/0.18;
        ctx.strokeStyle=g(C_B+','+(0.5*(1-da)));
        ctx.lineWidth=1.4*sz;
        ctx.beginPath();
        for(var v=0;v<=30;v++){ var va=v/30*6.283;
          var wob=Math.sin(va*6+t*0.02)*4*sz*(1-da);
          ctx[(v===0?'moveTo':'lineTo')](st.hx+Math.cos(va)*(40*sz*da+wob),st.hy+Math.sin(va)*(40*sz*da+wob)*0.7); }
        ctx.closePath(); ctx.stroke(); }
    }
    /* 坍缩: 空间收缩线+中心白核 */
    if(collapseT>0&&t-collapseT<520){ var pr3=(t-collapseT)/520;
      for(var k=0;k<8;k++){ var a3=k/8*6.283+pr3*1.3;
        var r0=(94-pr3*70)*sz;
        ctx.strokeStyle=g(C_B+','+(0.65*(1-pr3*0.35))); ctx.lineWidth=1.6*sz;
        ctx.beginPath(); ctx.moveTo(st.hx+Math.cos(a3)*r0,st.hy+Math.sin(a3)*r0*0.7);
        ctx.lineTo(st.hx+Math.cos(a3)*(r0-20*sz),st.hy+Math.sin(a3)*(r0-20*sz)*0.7); ctx.stroke(); }
    }
    if(core.r>0&&novaT<0){ var cg2=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,core.r*2.6);
      cg2.addColorStop(0,'rgba(255,252,242,1)'); cg2.addColorStop(.5,g(C_G+',0.75')); cg2.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=cg2; ctx.beginPath(); ctx.arc(st.hx,st.hy,core.r*2.6,0,6.283); ctx.fill();
    }
    /* 超新星激波球(实心渐变膨胀→透明)+三重涟漪 */
    if(novaT>0&&t-novaT<1000){ var pr4=(t-novaT)/1000;
      if(pr4<0.55){ var bp=pr4/0.55;
        var BR=8*sz+bp*136*sz;
        var bg2=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,BR);
        bg2.addColorStop(0,'rgba(255,252,240,'+(0.85*(1-bp))+')');
        bg2.addColorStop(.6,g(C_G+','+(0.5*(1-bp))));
        bg2.addColorStop(1,g(C_B+',0'));
        ctx.fillStyle=bg2; ctx.beginPath(); ctx.arc(st.hx,st.hy,BR,0,6.283); ctx.fill();
      }
      for(var w4=0;w4<3;w4++){ var rp=pr4-0.18-w4*0.13; if(rp<0||rp>1)continue;
        var R4=rp*156*sz;
        ctx.strokeStyle=g((w4===1?C_B:C_G)+','+(0.7*(1-rp))); ctx.lineWidth=(4-w4)*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
        ctx.beginPath(); ctx.arc(st.hx,st.hy,R4,0,6.283); ctx.stroke(); ctx.shadowBlur=0; }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
