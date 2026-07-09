/* ═══ v3 重做(覆盖旧版): 天启征服者·索拉里斯 —— 灭霸式演出 ═══
   巨型创世手套浮现→六符文宝石依次点亮→紫色能量巨光柱→现实扭曲→响指SNAP→灰飞烟灭 */
function fxSuolaris(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var COLS=['150,60,255','60,120,255','255,60,80','255,150,50','60,200,120','240,245,255'];
  var C_P='165,80,255', C_W='250,246,255', C_R='255,70,80';
  var glove={a:0,x:0,y:0,mode:'fist',mix:0}, gemN=0, beamT=-1, warpT=-1, snapT=-1, dissolve=-1, ashes=[], flashA=0;
  function drawGauntlet(ctx,x,y,s,a,mode,mix,snapPr,t){
    /* 巨型创世手套(侧视朝右·金+暗铜·六符文宝石) mode fist/snap, mix=两姿势过渡 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    var mg=ctx.createLinearGradient(0,-30,0,30);
    mg.addColorStop(0,'#e2b45a'); mg.addColorStop(.5,'#a87830'); mg.addColorStop(1,'#6a4a1c');
    /* 腕甲 */
    ctx.fillStyle=mg; ctx.strokeStyle='#3e2c10'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(-42,-15); ctx.lineTo(-18,-19); ctx.lineTo(-18,19); ctx.lineTo(-42,15); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-34,-16); ctx.lineTo(-34,16); ctx.moveTo(-26,-17.5); ctx.lineTo(-26,17.5); ctx.stroke();
    /* 拳背主块 */
    ctx.fillStyle=mg;
    ctx.beginPath(); ctx.moveTo(-18,-19); ctx.quadraticCurveTo(8,-24,16,-16); ctx.lineTo(16,16); ctx.quadraticCurveTo(8,24,-18,19); ctx.closePath(); ctx.fill(); ctx.stroke();
    var fi=1-mix; /* fist权重 */
    /* 四指节(fist: 收拢横排) */
    ctx.save(); ctx.globalAlpha=a*Math.max(0.25,fi);
    for(var f2=0;f2<4;f2++){ var fy=-13.5+f2*9;
      ctx.fillStyle=mg;
      ctx.beginPath(); ctx.moveTo(14,fy-3.6); ctx.lineTo(30,fy-3.2); ctx.quadraticCurveTo(34,fy,30,fy+3.2); ctx.lineTo(14,fy+3.6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23,fy-3.4); ctx.lineTo(23,fy+3.4); ctx.stroke();
    }
    ctx.restore();
    /* snap形态: 中指伸出与拇指相触 */
    if(mix>0.02){ ctx.save(); ctx.globalAlpha=a*mix;
      var snapPt={x:34,y:-14};
      var mDrop=snapPr>0?snapPr*16:0; /* 响指后中指弹下 */
      ctx.strokeStyle='#3e2c10'; ctx.fillStyle=mg; ctx.lineWidth=1.6;
      /* 中指(两段到snapPt) */
      ctx.lineWidth=7; ctx.lineCap='round'; ctx.strokeStyle='#b8863a';
      ctx.beginPath(); ctx.moveTo(14,-6); ctx.quadraticCurveTo(26,-12,snapPt.x,snapPt.y+mDrop); ctx.stroke();
      ctx.lineWidth=1.4; ctx.strokeStyle='#3e2c10';
      ctx.beginPath(); ctx.moveTo(14,-6); ctx.quadraticCurveTo(26,-12,snapPt.x,snapPt.y+mDrop); ctx.stroke();
      /* 其余三指收拢 */
      for(var f3=0;f3<3;f3++){ var fy3=2+f3*7;
        ctx.fillStyle=mg; ctx.lineWidth=1.3;
        ctx.beginPath(); ctx.moveTo(14,fy3-2.8); ctx.lineTo(26,fy3-2.4); ctx.quadraticCurveTo(29,fy3,26,fy3+2.4); ctx.lineTo(14,fy3+2.8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      /* 拇指(压向snapPt, 响指后弹开) */
      var tLift=snapPr>0?snapPr*10:0;
      ctx.lineWidth=8; ctx.strokeStyle='#c89344'; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(0,-19); ctx.quadraticCurveTo(18,-26,snapPt.x-2,snapPt.y-2-tLift); ctx.stroke();
      ctx.lineWidth=1.4; ctx.strokeStyle='#3e2c10';
      ctx.beginPath(); ctx.moveTo(0,-19); ctx.quadraticCurveTo(18,-26,snapPt.x-2,snapPt.y-2-tLift); ctx.stroke();
      ctx.restore();
    } else {
      /* fist拇指(横压在指节上) */
      ctx.lineWidth=8; ctx.strokeStyle='#c89344'; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-2,-19); ctx.quadraticCurveTo(14,-22,24,-16); ctx.stroke();
      ctx.lineWidth=1.4; ctx.strokeStyle='#3e2c10';
      ctx.beginPath(); ctx.moveTo(-2,-19); ctx.quadraticCurveTo(14,-22,24,-16); ctx.stroke();
    }
    /* 六符文宝石: 手背中央大 + 指节4 + 拇指1 */
    var gems=[[ -2,0,5.2],[19,-13.5,2.8],[19,-4.5,2.8],[19,4.5,2.8],[19,13.5,2.8],[8,-21,3.0]];
    for(var g2=0;g2<6;g2++){ var G=gems[g2];
      var lit=g2<gemN;
      if(lit){ ctx.shadowBlur=10; ctx.shadowColor=g(COLS[g2]+',1'); }
      var gg2=ctx.createRadialGradient(G[0],G[1],0,G[0],G[1],G[2]);
      gg2.addColorStop(0,lit?'#ffffff':'#location'.length?'#3a3040':'#3a3040');
      gg2.addColorStop(0.35,lit?g(COLS[g2]+',1'):'#4a4054');
      gg2.addColorStop(1,lit?g(COLS[g2]+',0.75'):'#2a2434');
      ctx.fillStyle=gg2; ctx.beginPath(); ctx.arc(G[0],G[1],G[2],0,6.283); ctx.fill();
      ctx.shadowBlur=0; ctx.strokeStyle='#f0d896'; ctx.lineWidth=0.9;
      ctx.beginPath(); ctx.arc(G[0],G[1],G[2],0,6.283); ctx.stroke();
      /* 呼吸辉光 */
      if(lit){ var pl=0.5+Math.sin(t*0.008+g2)*0.3;
        var hg=ctx.createRadialGradient(G[0],G[1],0,G[0],G[1],G[2]*2.6);
        hg.addColorStop(0,g(COLS[g2]+','+(0.45*pl))); hg.addColorStop(1,g(COLS[g2]+',0'));
        ctx.fillStyle=hg; ctx.beginPath(); ctx.arc(G[0],G[1],G[2]*2.6,0,6.283); ctx.fill(); }
    }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6500,endMs:4600,
  busy:function(st){ return ashes.length>0||(snapT>0&&st.t-snapT<1000); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    glove.x=st.bx+66*sz; glove.y=st.by+6*sz;
    glove.a=Math.min(1,t/380);
    /* ①六宝石依次点亮 */
    var newN=Math.min(6,Math.floor(Math.max(0,t-260)/175));
    if(newN>gemN){ gemN=newN;
      var gi=gemN-1;
      F.burst(st.P,glove.x+(gi===0?-3:24)*sz,glove.y,COLS[gi],7,4.5,sz);
      F.ring(st.P,glove.x,glove.y,COLS[gi],0.75,2.2*sz);
    }
    /* ②1350 握拳→紫色能量巨光柱 */
    if(!st.fired.beam&&t>=1350){ st.fired.beam=1; beamT=t;
      F.flash(st.P,glove.x,glove.y,C_P,26*sz,200);
    }
    if(beamT>0&&t-beamT<760){
      if(Math.random()<0.85){ F.jet(st.P,st.hx+rnd(-16,16)*sz,st.hy+rnd(-10,10)*sz,rnd(0,6.28),3.14,C_P,2,5.5,sz); }
      if(!st.fired.dealt&&t-beamT>250){ st.fired.dealt=1; st.fire();
        F.ring(st.P,st.hx,st.hy,C_P,1.2,3.6*sz); F.burst(st.P,st.hx,st.hy,C_P,14,7,sz); }
    }
    /* ③2320 现实扭曲(红符文) */
    if(!st.fired.warp&&t>=2320){ st.fired.warp=1; warpT=t;
      F.burst(st.P,glove.x+19*sz,glove.y-4.5*sz,C_R,8,4.5,sz);
      F.ring(st.P,st.hx,st.hy,C_R,1.0,3*sz);
    }
    /* ④2950 换响指姿势 → 3300 SNAP */
    if(t>=2950)glove.mix=Math.min(1,(t-2950)/280);
    if(!st.fired.snap&&t>=3300){ st.fired.snap=1; snapT=t; dissolve=t;
      flashA=1;
      var sx=glove.x+34*1.55*sz, sy=glove.y-14*1.55*sz;
      F.flash(st.P,sx,sy,C_W,34*sz,220);
      F.burst(st.P,sx,sy,C_W,14,6,sz);
      F.ring(st.P,sx,sy,'255,255,255',1.3,3.4*sz);
      for(var q=0;q<6;q++)F.ring(st.P,st.hx,st.hy,COLS[q],0.7+q*0.16,2*sz);
    }
    if(flashA>0)flashA=Math.max(0,flashA-st.dt*0.005);
    /* 灰飞烟灭: 溶解线从底往上扫, 沿线生成灰烬 */
    if(dissolve>0&&t-dissolve<720){
      var dp=(t-dissolve)/720;
      var dy=st.hy+46*sz-dp*112*sz;
      for(var a2=0;a2<3;a2++){ if(Math.random()<0.85){
        ashes.push({x:st.hx+rnd(-52,52)*sz,y:dy+rnd(-4,4)*sz,vx:rnd(-0.5,0.7),vy:rnd(-1.6,-0.7),rot:rnd(0,6.28),vrot:rnd(-0.15,0.15),w:rnd(3,7)*sz,life:0,max:rnd(950,1550),tone:rnd(0,1)}); } }
      if(Math.random()<0.5)F.burst(st.P,st.hx+rnd(-50,50)*sz,dy,'255,150,80',1,2,sz);
    }
    for(var ai=ashes.length-1;ai>=0;ai--){ var A=ashes[ai];
      A.life+=st.dt; A.x+=A.vx*st.dt*0.06+Math.sin(A.life*0.004)*0.3; A.y+=A.vy*st.dt*0.06; A.rot+=A.vrot*st.dt*0.06;
      if(A.life>A.max||A.y<0)ashes.splice(ai,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var snapPr=snapT>0?Math.min(1,(t-snapT)/160):0;
    if(glove.a>0){ var push=beamT>0&&t-beamT<760?Math.sin(Math.min(1,(t-beamT)/160)*1.57)*10*sz:0;
      drawGauntlet(ctx,glove.x+push,glove.y,1.55*sz,glove.a*(snapT>0?Math.max(0.25,1-(t-snapT)/1400):1),glove.mode,glove.mix,snapPr,t); }
    /* 灰烬片(实体棕灰四边形) */
    for(var ai=0;ai<ashes.length;ai++){ var A=ashes[ai];
      var pr=A.life/A.max, aa=pr<0.1?pr/0.1:1-Math.max(0,(pr-0.55))/0.45;
      ctx.save(); ctx.globalAlpha=Math.max(0,aa*0.95); ctx.translate(A.x,A.y); ctx.rotate(A.rot);
      var tone=Math.floor(120+A.tone*50);
      ctx.fillStyle='rgb('+tone+','+(tone-10)+','+(tone-18)+')';
      ctx.beginPath(); ctx.moveTo(-A.w/2,-A.w*0.3); ctx.lineTo(A.w*0.4,-A.w*0.45); ctx.lineTo(A.w/2,A.w*0.3); ctx.lineTo(-A.w*0.3,A.w*0.42); ctx.closePath(); ctx.fill();
      ctx.restore(); }
    /* SNAP白闪 */
    if(flashA>0){ ctx.fillStyle='rgba(255,255,255,'+(flashA*0.75)+')'; ctx.fillRect(0,0,st.vw,st.barBot+18); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 紫色能量巨光柱 */
    if(beamT>0&&t-beamT<760){ var pr=(t-beamT)/760, env=Math.sin(Math.min(1,pr*1.15)*3.14);
      var x0=glove.x+8*sz, y0=glove.y;
      var ang=Math.atan2(st.hy-y0,st.hx-x0), L=Math.hypot(st.hx-x0,st.hy-y0);
      ctx.save(); ctx.translate(x0,y0); ctx.rotate(ang);
      var wob=Math.sin(t*0.03)*2*sz;
      var w=(17+wob)*sz*env;
      var lg=ctx.createLinearGradient(0,-w,0,w);
      lg.addColorStop(0,g(C_P+',0')); lg.addColorStop(.5,g(C_P+','+(0.85*env))); lg.addColorStop(1,g(C_P+',0'));
      ctx.fillStyle=lg; ctx.fillRect(0,-w,L,w*2);
      ctx.fillStyle=g('255,255,255,'+(0.9*env)); ctx.fillRect(0,-w*0.24,L,w*0.48);
      /* 边缘电弧抖 */
      ctx.strokeStyle=g(C_P+','+(0.7*env)); ctx.lineWidth=1.4*sz;
      ctx.beginPath();
      for(var v=0;v<=16;v++){ var vx2=v/16*L, vy2=-w-Math.abs(Math.sin(v*1.7+t*0.02))*4*sz;
        if(v===0)ctx.moveTo(vx2,vy2); else ctx.lineTo(vx2,vy2); }
      ctx.stroke();
      ctx.restore();
      /* 命中熔核 */
      var hg2=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,22*sz*env);
      hg2.addColorStop(0,g(C_W+',1')); hg2.addColorStop(.5,g(C_P+',0.8')); hg2.addColorStop(1,g(C_P+',0'));
      ctx.fillStyle=hg2; ctx.beginPath(); ctx.arc(st.hx,st.hy,22*sz*env,0,6.283); ctx.fill();
    }
    /* 现实扭曲波纹(畸变环+红斑) */
    if(warpT>0&&t-warpT<720){ var pr2=(t-warpT)/720;
      for(var w2=0;w2<3;w2++){ var rp=pr2-w2*0.15; if(rp<0||rp>1)continue;
        var R=rp*118*sz;
        ctx.strokeStyle=g(C_R+','+(0.7*(1-rp))); ctx.lineWidth=(3-w2*0.7)*sz;
        ctx.beginPath();
        for(var v3=0;v3<=44;v3++){ var va=v3/44*6.283;
          var wob2=Math.sin(va*7+t*0.014)*6*sz*(1-rp);
          var vx3=st.hx+Math.cos(va)*(R+wob2), vy3=st.hy+Math.sin(va)*(R+wob2)*0.68;
          if(v3===0)ctx.moveTo(vx3,vy3); else ctx.lineTo(vx3,vy3); }
        ctx.closePath(); ctx.stroke(); }
      if(Math.random()<0.4){ var bx2=st.hx+rnd(-46,46)*sz, by2=st.hy+rnd(-28,28)*sz;
        ctx.fillStyle=g(C_R+',0.4'); ctx.beginPath(); ctx.arc(bx2,by2,rnd(4,9)*sz,0,6.283); ctx.fill(); }
    }
    /* 溶解边缘光(灰化线) */
    if(dissolve>0&&t-dissolve<720){ var dp2=(t-dissolve)/720;
      var dy2=st.hy+46*sz-dp2*112*sz;
      var eg=ctx.createLinearGradient(0,dy2-8*sz,0,dy2+8*sz);
      eg.addColorStop(0,'rgba(255,150,80,0)'); eg.addColorStop(.5,g('255,170,90,0.75')); eg.addColorStop(1,'rgba(255,150,80,0)');
      ctx.fillStyle=eg; ctx.fillRect(st.hx-56*sz,dy2-8*sz,112*sz,16*sz);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
