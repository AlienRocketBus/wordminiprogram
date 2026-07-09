/* ═══ 批2: 概念/埃及/虫族组 6 boss ═══ */

/* ⑦未成形之神·万形之胚 —— 形态流变模仿+丝线编织+万形归一 */
function fxWanxing(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_A='255,220,170', C_B2='170,210,255', C_G2='170,255,190';
  var morphs=[], threads=[], finalT=-1, morphIdx=0;
  var SHAPES=['blade','claw','fist','spike'];
  function drawShape(ctx,kind,x,y,s,rot,a,col){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2; ctx.shadowBlur=12; ctx.shadowColor=col;
    if(kind==='blade'){ ctx.beginPath(); ctx.moveTo(0,16); ctx.lineTo(-5,4); ctx.lineTo(0,-34); ctx.lineTo(5,4); ctx.closePath(); ctx.stroke(); }
    else if(kind==='claw'){ for(var k=-1;k<=1;k++){ ctx.beginPath(); ctx.moveTo(k*9,14); ctx.quadraticCurveTo(k*13,-6,k*4,-26); ctx.stroke(); } }
    else if(kind==='fist'){ ctx.beginPath(); ctx.arc(0,0,13,0,6.283); ctx.stroke(); ctx.beginPath(); ctx.arc(0,0,6,0,6.283); ctx.stroke(); }
    else { for(var q=0;q<5;q++){ var a2=q/5*6.283; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a2)*22,Math.sin(a2)*22); ctx.stroke(); } }
    ctx.shadowBlur=0; ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return finalT>0&&st.t-finalT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 轮廓波动 */
    if(t<700&&Math.random()<0.6)F.suck(st.P,st.bx+rnd(-130,130)*sz,st.by+rnd(-110,110)*sz,st.bx,st.by,C_A,sz);
    /* ②750起 形态模仿三连(每次不同形态从boss冲向勇者) */
    if(t>=750&&t<2200&&morphs.length<3&&t>=750+morphIdx*480){ 
      var cols=['#ffdcaa','#aad2ff','#aaffbe'];
      morphs.push({kind:SHAPES[morphIdx%4],ts:t,x:st.bx,y:st.by,col:cols[morphIdx%3],rot:rnd(-0.4,0.4),done:false});
      morphIdx++;
      if(morphIdx===1)st.fire();
    }
    for(var mi=0;mi<morphs.length;mi++){ var m=morphs[mi];
      if(!m.done&&t-m.ts>=380){ m.done=true;
        F.burst(st.P,st.hx,st.hy,mi%2?C_B2:C_G2,10,6,sz); F.ring(st.P,st.hx,st.hy,C_A,0.9,3*sz);
      } }
    /* ③2250 丝线编织网 */
    if(!st.fired.net&&t>=2250){ st.fired.net=1;
      for(var k=0;k<8;k++){ var a1=rnd(0,6.28),a2=a1+rnd(2,4);
        threads.push({x1:st.hx+Math.cos(a1)*90*sz,y1:st.hy+Math.sin(a1)*55*sz,x2:st.hx+Math.cos(a2)*90*sz,y2:st.hy+Math.sin(a2)*55*sz,life:0,max:900,col:[C_A,C_B2,C_G2][k%3]}); }
    }
    /* ④2850 万形归一: 所有残影同时聚爆 */
    if(!st.fired.fin&&t>=2850){ st.fired.fin=1; finalT=t;
      F.flash(st.P,st.hx,st.hy,C_A,64*sz,300);
      for(var q=0;q<12;q++)F.suck(st.P,st.hx+rnd(-90,90)*sz,st.hy+rnd(-60,60)*sz,st.hx,st.hy,[C_A,C_B2,C_G2][q%3],sz);
      F.ring(st.P,st.hx,st.hy,C_A,1.5,5*sz); F.burst(st.P,st.hx,st.hy,C_B2,20,7.5,sz);
    }
    for(var ti=threads.length-1;ti>=0;ti--){ var th=threads[ti]; th.life+=st.dt; if(th.life>th.max)threads.splice(ti,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    for(var mi=0;mi<morphs.length;mi++){ var m=morphs[mi];
      if(t-m.ts<380){ var pr=(t-m.ts)/380;
        var x=m.x+(st.hx-m.x)*pr, y=m.y+(st.hy-m.y)*pr;
        var flick=(Math.floor(t/70)%3===mi%3);
        drawShape(ctx,flick?SHAPES[(mi+1)%4]:m.kind,x,y,(1+pr*0.5)*sz,m.rot+pr*2,Math.sin(pr*3.14),m.col);
      } }
    /* ④幕聚合大形态(闪变) */
    if(finalT>0&&t-finalT<500){ var pr2=(t-finalT)/500;
      drawShape(ctx,SHAPES[Math.floor(t/80)%4],st.hx,st.hy,(2-pr2)*sz,t*0.004,1-pr2,'#ffe6c0');
    }
  },
  glow:function(st){
    var ctx=st.ctx;
    for(var ti=0;ti<threads.length;ti++){ var th=threads[ti]; var a=Math.sin(Math.min(1,th.life/th.max)*3.14)*0.7;
      ctx.strokeStyle=g(th.col+','+a); ctx.lineWidth=1.6*st.sz; ctx.shadowBlur=8; ctx.shadowColor=g(th.col+',1');
      ctx.beginPath(); ctx.moveTo(th.x1,th.y1); ctx.lineTo(th.x2,th.y2); ctx.stroke(); ctx.shadowBlur=0; }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑧法老王·不朽金身 —— 权杖诅咒铭文+金箔风暴+圣甲虫+绿宝石诅咒爆 */
function fxFalao(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,205,90', C_E='80,255,150';
  var staffA=0, foils=[], scarabs=[], curseT=-1;
  function drawStaff(ctx,x,y,s,a,lit){ /* 黄金权杖(绿宝石杖顶) */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.scale(s,s);
    var bg=ctx.createLinearGradient(-3,0,3,0); bg.addColorStop(0,'#8a6a20'); bg.addColorStop(.5,'#e8c060'); bg.addColorStop(1,'#8a6a20');
    ctx.fillStyle=bg; ctx.fillRect(-3,-58,6,116);
    ctx.fillStyle='#caa64a';
    ctx.beginPath(); ctx.moveTo(0,-58); ctx.lineTo(-11,-70); ctx.lineTo(-4,-76); ctx.lineTo(0,-70); ctx.lineTo(4,-76); ctx.lineTo(11,-70); ctx.closePath(); ctx.fill();
    ctx.fillStyle=lit?'#66ff9a':'#2e8a52'; if(lit){ctx.shadowBlur=14;ctx.shadowColor='#66ff9a';}
    ctx.beginPath(); ctx.arc(0,-84,8,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#f0d080'; ctx.lineWidth=1.4; ctx.beginPath(); ctx.arc(0,-84,8,0,6.283); ctx.stroke();
    ctx.restore();
  }
  function drawScarab(ctx,x,y,s,rot,a){ /* 圣甲虫 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#1a6a44'; ctx.strokeStyle='#caa64a'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(0,2,6,8,0,0,6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,-8,4,0,6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-4); ctx.lineTo(0,9); ctx.stroke();
    for(var k=-1;k<=1;k+=2){ ctx.beginPath(); ctx.moveTo(k*5,-2); ctx.lineTo(k*10,-7); ctx.moveTo(k*6,3); ctx.lineTo(k*11,3); ctx.moveTo(k*5,7); ctx.lineTo(k*10,11); ctx.stroke(); }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return foils.length>0||scarabs.length>0||(curseT>0&&st.t-curseT<760); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    staffA=Math.min(1,t/500);
    /* ①600 权杖顿地: 铭文金环 */
    if(!st.fired.stomp&&t>=600){ st.fired.stomp=1;
      F.ring(st.P,st.bx-70*sz,st.by+80*sz,C_G,1.4,4*sz); F.burst(st.P,st.bx-70*sz,st.by+80*sz,C_G,10,5,sz);
    }
    /* ②900 金箔风暴(葬衣金箔弹片激射) */
    if(!st.fired.foil&&t>=900){ st.fired.foil=1;
      for(var i=0;i<18;i++){ foils.push({x:st.bx+rnd(-80,80)*sz,y:st.by+rnd(-90,60)*sz,tx:st.hx+rnd(-70,70)*sz,ty:st.hy+rnd(-35,35)*sz,rot:rnd(0,6.28),vrot:rnd(-0.3,0.3),w:rnd(7,13)*sz,life:0,max:rnd(600,1000),delay:i*46}); }
      st.fire();
    }
    for(var fi=foils.length-1;fi>=0;fi--){ var f=foils[fi];
      if(f.delay>0){f.delay-=st.dt;continue;}
      f.life+=st.dt;
      var dx=f.tx-f.x,dy=f.ty-f.y,d=Math.hypot(dx,dy);
      if(d<14||f.life>f.max){ F.burst(st.P,f.x,f.y,C_G,4,4.5,st.sz); foils.splice(fi,1); continue; }
      f.x+=dx*0.05*st.dt*0.06*6; f.y+=dy*0.05*st.dt*0.06*6; f.rot+=f.vrot;
    }
    /* ③2050 圣甲虫群三只弧线冲击 */
    if(!st.fired.scb&&t>=2050){ st.fired.scb=1;
      for(var k=0;k<3;k++)scarabs.push({p:0,arc:(k-1)*0.6,spd:rnd(0.0009,0.0013),delay:k*140});
    }
    for(var si=scarabs.length-1;si>=0;si--){ var sb=scarabs[si];
      if(sb.delay>0){sb.delay-=st.dt;continue;}
      sb.p+=sb.spd*st.dt;
      if(sb.p>=1){ F.burst(st.P,st.hx,st.hy,C_E,8,6,st.sz); F.ring(st.P,st.hx,st.hy,C_E,0.8,2.5*st.sz); scarabs.splice(si,1); }
    }
    /* ④2800 绿宝石诅咒爆发 */
    if(!st.fired.curse&&t>=2800){ st.fired.curse=1; curseT=t;
      F.flash(st.P,st.hx,st.hy,C_E,64*sz,300);
      F.ring(st.P,st.hx,st.hy,C_E,1.6,5.5*sz); F.ring(st.P,st.hx,st.hy,C_G,1.0,3.5*sz);
      F.burst(st.P,st.hx,st.hy,C_E,26,8,sz); F.shards(st.P,st.hx,st.hy,C_G,16,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(staffA>0)drawStaff(ctx,st.bx-70*sz,st.by+20*sz,1.2*sz,staffA,t>=2600);
    for(var fi=0;fi<foils.length;fi++){ var f=foils[fi]; if(f.delay>0)continue;
      ctx.save(); ctx.translate(f.x,f.y); ctx.rotate(f.rot);
      var fg=ctx.createLinearGradient(-f.w/2,0,f.w/2,0); fg.addColorStop(0,'#9a7830'); fg.addColorStop(.5,'#ffe9a0'); fg.addColorStop(1,'#9a7830');
      ctx.fillStyle=fg; ctx.fillRect(-f.w/2,-f.w*0.7,f.w,f.w*1.4);
      ctx.strokeStyle='#6a4f18'; ctx.lineWidth=0.8; ctx.strokeRect(-f.w/2,-f.w*0.7,f.w,f.w*1.4);
      ctx.restore(); }
    for(var si=0;si<scarabs.length;si++){ var sb=scarabs[si]; if(sb.delay>0)continue;
      var p=sb.p, x=st.bx+(st.hx-st.bx)*p, y=st.by+(st.hy-st.by)*p+Math.sin(p*3.14)* -60*sz*sb.arc;
      drawScarab(ctx,x,y,1.3*sz,Math.atan2(st.hy-y,st.hx-x)+1.57,1);
      if(Math.random()<0.4)F.burst(st.P,x,y,C_E,1,2,st.sz);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 诅咒铭文竖排(①幕后墙面浮现) */
    if(t>=600&&t<2400){ var a=Math.min(1,(t-600)/300)*(t>2100?(2400-t)/300:1);
      ctx.save(); ctx.globalAlpha=Math.max(0,a*0.55); ctx.fillStyle='#ffe9a0'; ctx.shadowBlur=8; ctx.shadowColor=g(C_G+',1');
      ctx.font=(11*sz)+'px serif';
      for(var col=0;col<3;col++){ for(var row=0;row<4;row++){ ctx.fillText('𓂀𓋹☥▽'[row], st.bx+(col-1)*44*sz+90*sz, st.by-60*sz+row*20*sz); } }
      ctx.restore();
    }
    /* 诅咒爆发金字塔虚影 */
    if(curseT>0&&t-curseT<760){ var pr=(t-curseT)/760, env=Math.sin(Math.min(1,pr*1.1)*3.14);
      var S=90*sz*env;
      ctx.save(); ctx.strokeStyle=g(C_E+','+(0.85*env)); ctx.lineWidth=2.6*sz; ctx.shadowBlur=16; ctx.shadowColor=g(C_E+',1');
      ctx.beginPath(); ctx.moveTo(st.hx,st.hy-S); ctx.lineTo(st.hx+S*0.85,st.hy+S*0.55); ctx.lineTo(st.hx-S*0.85,st.hy+S*0.55); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(st.hx,st.hy-S); ctx.lineTo(st.hx,st.hy+S*0.55); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑨破坏神·终焉之相 —— 空间震颤+棱线金电+终焉湮灭球 */
function fxPohuai(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_P='190,120,255', C_G='255,215,120', C_W='245,240,255';
  var bolts=[], orb={r:0,charge:0}, annT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5800,endMs:3900,
  busy:function(st){ return annT>0&&st.t-annT<820; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-700 空间震颤涟漪 */
    if(!st.fired.rip1&&t>=150){ st.fired.rip1=1; F.ring(st.P,st.hx,st.hy,C_P,0.7,2*sz); }
    if(!st.fired.rip2&&t>=450){ st.fired.rip2=1; F.ring(st.P,st.hx,st.hy,C_P,0.9,2.5*sz); }
    /* ②800起 棱线金电光(锯齿电弧打向勇者) */
    if(t>=800&&t<2100&&Math.random()<0.16){ 
      var segs=[], x=st.bx, y=st.by, tx=st.hx+rnd(-40,40)*sz, ty=st.hy+rnd(-25,25)*sz;
      for(var k=0;k<=6;k++){ var p=k/6; segs.push({x:x+(tx-x)*p+rnd(-16,16)*sz*(k>0&&k<6?1:0), y:y+(ty-y)*p+rnd(-16,16)*sz*(k>0&&k<6?1:0)}); }
      bolts.push({segs:segs,life:0,max:200});
      F.burst(st.P,tx,ty,C_G,4,5,sz);
      if(!st.fired.dealt){st.fired.dealt=1;st.fire();}
    }
    /* ③2150 光核蓄能 */
    if(t>=2150&&t<2900){ orb.charge=Math.min(1,(t-2150)/700);
      if(Math.random()<0.7)F.suck(st.P,st.hx+rnd(-110,110)*sz,st.hy+rnd(-80,80)*sz,st.hx,st.hy-40*sz,C_P,sz);
    }
    /* ④2900 终焉湮灭 */
    if(!st.fired.ann&&t>=2900){ st.fired.ann=1; annT=t;
      F.flash(st.P,st.hx,st.hy,C_W,72*sz,320);
      F.ring(st.P,st.hx,st.hy,C_P,1.8,6*sz); F.ring(st.P,st.hx,st.hy,C_G,1.2,4*sz);
      F.burst(st.P,st.hx,st.hy,C_P,30,9,sz); F.shards(st.P,st.hx,st.hy,C_W,14,sz);
    }
    for(var bi=bolts.length-1;bi>=0;bi--){ bolts[bi].life+=st.dt; if(bolts[bi].life>bolts[bi].max)bolts.splice(bi,1); }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 电弧 */
    for(var bi=0;bi<bolts.length;bi++){ var b=bolts[bi]; var a=1-b.life/b.max;
      ctx.strokeStyle=g(C_G+','+a); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(b.segs[0].x,b.segs[0].y);
      for(var q=1;q<b.segs.length;q++)ctx.lineTo(b.segs[q].x,b.segs[q].y);
      ctx.stroke();
      ctx.strokeStyle=g('255,255,255,'+a); ctx.lineWidth=0.8*sz; ctx.stroke(); ctx.shadowBlur=0; }
    /* 蓄能湮灭球(③幕悬于勇者上方) */
    if(orb.charge>0&&annT<0){ var R=(8+orb.charge*30)*sz, oy=st.hy-40*sz;
      var og=ctx.createRadialGradient(st.hx,oy,0,st.hx,oy,R*1.8);
      og.addColorStop(0,g(C_W+',0.95')); og.addColorStop(.4,g(C_P+',0.7')); og.addColorStop(1,g(C_P+',0'));
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(st.hx,oy,R*1.8,0,6.283); ctx.fill();
      ctx.strokeStyle=g(C_G+',0.9'); ctx.lineWidth=1.6*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_P+',1');
      ctx.beginPath(); ctx.arc(st.hx,oy,R,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
    }
    /* 湮灭内爆→外爆(负空间圆) */
    if(annT>0&&t-annT<820){ var pr=(t-annT)/820;
      if(pr<0.35){ var R2=40*sz*(1-pr/0.35);
        ctx.save(); ctx.globalCompositeOperation='source-over';
        ctx.fillStyle='rgba(8,4,16,0.85)'; ctx.beginPath(); ctx.arc(st.hx,st.hy-20*sz,R2,0,6.283); ctx.fill();
        ctx.restore();
        ctx.strokeStyle=g(C_P+',0.9'); ctx.lineWidth=2*sz; ctx.beginPath(); ctx.arc(st.hx,st.hy-20*sz,R2+3*sz,0,6.283); ctx.stroke();
      } else { var pr2=(pr-0.35)/0.65, env=Math.sin(pr2*3.14);
        var Rw=110*sz*pr2;
        ctx.strokeStyle=g(C_W+','+(0.9*(1-pr2))); ctx.lineWidth=5*sz*env; ctx.shadowBlur=18; ctx.shadowColor=g(C_P+',1');
        ctx.beginPath(); ctx.arc(st.hx,st.hy-20*sz,Rw,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
      }
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑩虫群先锋·刃翼领主 —— 毒矛三连突刺+翼刃俯冲+虫群 */
function fxRenyi(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_P='190,120,255', C_V='120,255,90', C_S='210,180,255';
  var spears=[], bugs=[], diveT=-1;
  function drawSpear(ctx,x,y,s,rot,a){ /* 双刃毒矛 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    var bg=ctx.createLinearGradient(0,-4,0,4); bg.addColorStop(0,'#3a2a55'); bg.addColorStop(.5,'#6a4f95'); bg.addColorStop(1,'#2a1e40');
    ctx.fillStyle=bg; ctx.fillRect(-44,-2.5,88,5);
    for(var e=-1;e<=1;e+=2){ ctx.save(); ctx.scale(e,1);
      ctx.fillStyle='#241a38'; ctx.beginPath(); ctx.moveTo(44,0); ctx.lineTo(62,-5); ctx.lineTo(70,0); ctx.lineTo(62,5); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.shadowBlur=9; ctx.shadowColor='#78ff5a'; ctx.strokeStyle='#9aff70'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.moveTo(46,0); ctx.lineTo(69,0); ctx.stroke(); ctx.restore();
      ctx.restore(); }
    ctx.fillStyle='#8a68c5'; ctx.beginPath(); ctx.arc(0,0,4,0,6.283); ctx.fill();
    ctx.restore();
  }
  function drawBug(ctx,x,y,s,rot,a){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    ctx.fillStyle='#3a2a55'; ctx.beginPath(); ctx.ellipse(0,0,7,4,0,0,6.283); ctx.fill();
    ctx.strokeStyle='rgba(210,180,255,.7)'; ctx.lineWidth=1;
    for(var e=-1;e<=1;e+=2){ ctx.beginPath(); ctx.ellipse(-1,e*4,6,2.5,e*0.5,0,6.283); ctx.stroke(); }
    ctx.fillStyle='#ffb040'; ctx.beginPath(); ctx.arc(6,0,1.4,0,6.283); ctx.fill();
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return bugs.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-650 骨翼振动(嗡鸣粒子) */
    if(t<650&&Math.random()<0.6)F.jet(st.P,st.bx+rnd(-90,90)*sz,st.by-rnd(20,70)*sz,rnd(0,6.28),3.14,C_S,1,1.4,sz);
    /* ②700起 毒矛三连突刺 */
    if(!st.fired.sp&&t>=700){ st.fired.sp=1;
      for(var i=0;i<3;i++)spears.push({ts:700+i*300,ang:rnd(-0.3,0.3),done:false});
      st.fire();
    }
    for(var si=0;si<spears.length;si++){ var s2=spears[si];
      if(!s2.done&&t>=s2.ts+170){ s2.done=true;
        F.burst(st.P,st.hx,st.hy,C_V,9,6,sz); F.ring(st.P,st.hx,st.hy,C_V,0.8,2.6*sz);
      } }
    /* ③1750 翼刃俯冲(两道弧光) */
    if(!st.fired.dive&&t>=1750){ st.fired.dive=1; diveT=t;
      F.beam(st.P,st.hx,st.hy,-0.5,C_S,1.3,false); 
      setTimeout(function(){ if(!st.dead)F.beam(st.P,st.hx,st.hy,0.55,C_S,1.3,false); },160/st.sp);
    }
    /* ④2450 虫群召唤 */
    if(!st.fired.swarm&&t>=2450){ st.fired.swarm=1;
      for(var k=0;k<10;k++){ var a=rnd(-0.8,0.8);
        bugs.push({x:st.bx+rnd(-60,60)*sz,y:st.by+rnd(-30,50)*sz,tx:st.hx+rnd(-50,50)*sz,ty:st.hy+rnd(-25,25)*sz,ph:rnd(0,6.28),spd:rnd(0.045,0.075),p:0,delay:k*70}); }
      F.ring(st.P,st.bx,st.by,C_P,1.0,3*sz);
    }
    for(var bi=bugs.length-1;bi>=0;bi--){ var b=bugs[bi];
      if(b.delay>0){b.delay-=st.dt;continue;}
      b.p+=b.spd*st.dt*0.06;
      if(b.p>=1){ F.burst(st.P,st.hx,st.hy,C_V,5,5,st.sz); bugs.splice(bi,1); if(bugs.length===0){F.ring(st.P,st.hx,st.hy,C_V,1.2,4*st.sz);F.flash(st.P,st.hx,st.hy,C_V,44*st.sz,240);} }
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    for(var si=0;si<spears.length;si++){ var s2=spears[si];
      if(t>=s2.ts&&t<s2.ts+230){ var pr=(t-s2.ts)/230;
        var thrust=pr<0.6?pr/0.6:1-(pr-0.6)/0.4*0.3;
        var L=190*sz, x=st.bx+(st.hx-st.bx)*(0.3+thrust*0.62), y=st.by+(st.hy-st.by)*(0.3+thrust*0.62);
        var a=pr<0.1?pr/0.1:(pr>0.85?(1-pr)/0.15:1);
        drawSpear(ctx,x,y,1.2*sz,Math.atan2(st.hy-st.by,st.hx-st.bx)+s2.ang*0.3,a);
        if(pr>0.5&&Math.random()<0.5)F.jet(st.P,x,y,Math.atan2(st.hy-st.by,st.hx-st.bx),0.3,C_V,1,2,st.sz);
      } }
    for(var bi=0;bi<bugs.length;bi++){ var b=bugs[bi]; if(b.delay>0)continue;
      var x=b.x+(b.tx-b.x)*b.p, y=b.y+(b.ty-b.y)*b.p+Math.sin(b.ph+b.p*12)*8*sz;
      drawBug(ctx,x,y,1.1*sz,Math.atan2(b.ty-b.y,b.tx-b.x),Math.min(1,b.p*4));
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    if(diveT>0&&t-diveT<500&&Math.random()<0.5)F.burst(st.P,st.hx+rnd(-40,40)*sz,st.hy+rnd(-20,20)*sz,C_S,1,3,sz);
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑪诅咒之躯·绷带亡骸 —— 绷带触手抽打+诅咒护符+绷带巨手擒抱 */
function fxBengdai(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='120,160,255', C_D='200,190,160';
  var tents=[], grabT=-1, amuT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5600,endMs:3700,
  busy:function(st){ return grabT>0&&st.t-grabT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-600 香料粉尘 */
    if(t<600&&Math.random()<0.5)F.jet(st.P,st.bx+rnd(-70,70)*sz,st.by+rnd(0,80)*sz,-1.57,0.8,'190,175,140',1,1.2,sz);
    /* ②650起 绷带触手三连抽打 */
    if(!st.fired.tent&&t>=650){ st.fired.tent=1;
      for(var i=0;i<3;i++)tents.push({ts:650+i*330,side:i%2?1:-1,done:false,curve:rnd(0.6,1.1)});
      st.fire();
    }
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(!tn.done&&t>=tn.ts+200){ tn.done=true;
        F.burst(st.P,st.hx,st.hy,C_D,8,5.5,sz); F.ring(st.P,st.hx,st.hy,C_B,0.7,2.4*sz);
      } }
    /* ③1900 诅咒护符暗蓝印记 */
    if(!st.fired.amu&&t>=1900){ st.fired.amu=1; amuT=t;
      F.ring(st.P,st.hx,st.hy,C_B,1.0,3*sz);
    }
    /* ④2550 绷带巨手擒抱+诅咒爆 */
    if(!st.fired.grab&&t>=2550){ st.fired.grab=1; grabT=t; }
    if(!st.fired.gboom&&grabT>0&&t-grabT>=450){ st.fired.gboom=1;
      F.flash(st.P,st.hx,st.hy,C_B,54*sz,260);
      F.burst(st.P,st.hx,st.hy,C_B,20,7,sz); F.ring(st.P,st.hx,st.hy,C_B,1.4,4.5*sz);
      F.shards(st.P,st.hx,st.hy,C_D,12,sz);
    }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    function band(x1,y1,cx,cy,x2,y2,w,a){ /* 一段绷带(实体布条: 米白+缝线) */
      ctx.save(); ctx.globalAlpha=a;
      ctx.strokeStyle='#d8cfae'; ctx.lineWidth=w; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.quadraticCurveTo(cx,cy,x2,y2); ctx.stroke();
      ctx.strokeStyle='#a89a76'; ctx.lineWidth=Math.max(0.6,w*0.16);
      ctx.beginPath(); ctx.moveTo(x1,y1+w*0.28); ctx.quadraticCurveTo(cx,cy+w*0.28,x2,y2+w*0.28); ctx.stroke();
      ctx.setLineDash([3*sz,4*sz]);
      ctx.beginPath(); ctx.moveTo(x1,y1-w*0.22); ctx.quadraticCurveTo(cx,cy-w*0.22,x2,y2-w*0.22); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    /* 触手抽打 */
    for(var ti=0;ti<tents.length;ti++){ var tn=tents[ti];
      if(t>=tn.ts&&t<tn.ts+280){ var pr=(t-tn.ts)/280;
        var reach=pr<0.55?pr/0.55:1-(pr-0.55)/0.45*0.25;
        var ex=st.bx+(st.hx-st.bx)*reach+tn.side*20*sz*(1-reach);
        var ey=st.by+(st.hy-st.by)*reach;
        var a=pr>0.85?(1-pr)/0.15:1;
        band(st.bx+tn.side*40*sz,st.by+20*sz, (st.bx+ex)/2+tn.side*70*sz*tn.curve,(st.by+ey)/2-40*sz, ex,ey, 8*sz,a);
      } }
    /* 巨手擒抱(五指绷带从下方合拢) */
    if(grabT>0&&t-grabT<800){ var pr2=Math.min(1,(t-grabT)/450);
      for(var f2=0;f2<5;f2++){ var fa=-1.35+f2*0.32+0.35;
        var bxx=st.hx+Math.cos(fa+3.14)*95*sz, byy=st.hy+80*sz;
        var exx=st.hx+Math.cos(fa)*30*sz*(1-pr2*0.7), eyy=st.hy+Math.sin(fa)*26*sz*(1-pr2*0.7)-pr2*8*sz;
        band(bxx,byy,(bxx+exx)/2+Math.cos(fa)*30*sz,(byy+eyy)/2, exx,eyy, 7*sz, t-grabT<650?1:(800-(t-grabT))/150);
      }
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 护符印记(暗蓝圆阵) */
    if(amuT>0&&t-amuT<900){ var pr=(t-amuT)/900, a=Math.sin(pr*3.14);
      ctx.save(); ctx.globalAlpha=a*0.8; ctx.strokeStyle=g(C_B+',0.9'); ctx.lineWidth=1.6*sz;
      ctx.shadowBlur=12; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.arc(st.hx,st.hy,42*sz,0,6.283); ctx.stroke();
      ctx.beginPath(); ctx.arc(st.hx,st.hy,32*sz,0,6.283); ctx.stroke();
      for(var k=0;k<4;k++){ var a2=k/4*6.283+pr*1.2;
        ctx.beginPath(); ctx.arc(st.hx+Math.cos(a2)*37*sz,st.hy+Math.sin(a2)*37*sz,3*sz,0,6.283); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑫逆相之影·镜渊领主 —— 镜片阵列光束+镜面瞬移+万镜归渊 */
function fxJingyuan(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_S='170,210,255', C_W='235,245,255';
  var mirrors=[], lasers=[], teleT=-1, finT=-1;
  function drawMirror(ctx,x,y,s,rot,a,lit){ /* 菱形镜片 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    var mg=ctx.createLinearGradient(-8,-12,8,12);
    mg.addColorStop(0,'#20304a'); mg.addColorStop(.45,'#8fb8e8'); mg.addColorStop(.55,'#e8f4ff'); mg.addColorStop(1,'#2a3c58');
    ctx.fillStyle=mg;
    ctx.beginPath(); ctx.moveTo(0,-13); ctx.lineTo(8,0); ctx.lineTo(0,13); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=lit?'#e8f4ff':'#6a86ac'; ctx.lineWidth=1.1; if(lit){ctx.shadowBlur=10;ctx.shadowColor='#bfe0ff';} ctx.stroke(); ctx.shadowBlur=0;
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:5700,endMs:3800,
  busy:function(st){ return finT>0&&st.t-finT<800; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-600 镜片环绕展开 */
    if(!st.fired.mk&&t>=60){ st.fired.mk=1;
      for(var k=0;k<8;k++)mirrors.push({ang:k/8*6.283,r:0,tr:(95+rnd(-12,12))*sz,spin:rnd(0.0008,0.0015),lit:false,rot:rnd(0,3)});
    }
    for(var mi=0;mi<mirrors.length;mi++){ var m=mirrors[mi];
      m.r+=(m.tr-m.r)*0.06; m.ang+=m.spin*st.dt; m.rot+=0.01;
      m.x=st.bx+Math.cos(m.ang)*m.r; m.y=st.by+Math.sin(m.ang)*m.r*0.6;
    }
    /* ②800起 镜渊光束(镜片轮流射向勇者) */
    if(t>=800&&t<2100&&Math.random()<0.14&&mirrors.length){ 
      var mm=mirrors[Math.floor(rnd(0,mirrors.length))]; mm.lit=true;
      lasers.push({x1:mm.x,y1:mm.y,x2:st.hx+rnd(-30,30)*sz,y2:st.hy+rnd(-18,18)*sz,life:0,max:240});
      F.burst(st.P,st.hx,st.hy,C_S,4,4.5,sz);
      setTimeout(function(){mm.lit=false;},180/st.sp);
      if(!st.fired.dealt){st.fired.dealt=1;st.fire();}
    }
    /* ③2150 镜面瞬移乱舞(碎裂→重凝三次) */
    if(!st.fired.tele&&t>=2150){ st.fired.tele=1; teleT=t;
      for(var q=0;q<3;q++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        F.shards(st.P,st.hx+rnd(-60,60)*st.sz,st.hy+rnd(-35,35)*st.sz,C_S,10,st.sz);
        F.beam(st.P,st.hx,st.hy,rnd(-1.2,1.2),C_S,1.15,false);
      },qq*230/st.sp); })(q); }
    }
    /* ④2900 万镜归渊: 镜片全部聚焦勇者反射爆 */
    if(!st.fired.fin&&t>=2900){ st.fired.fin=1; finT=t;
      for(var w2=0;w2<mirrors.length;w2++){ var m3=mirrors[w2]; m3.lit=true;
        lasers.push({x1:m3.x,y1:m3.y,x2:st.hx,y2:st.hy,life:0,max:420}); }
      F.flash(st.P,st.hx,st.hy,C_W,62*sz,300);
      F.ring(st.P,st.hx,st.hy,C_S,1.6,5*sz); F.burst(st.P,st.hx,st.hy,C_W,24,8,sz);
      F.shards(st.P,st.hx,st.hy,C_S,18,sz);
    }
    for(var li=lasers.length-1;li>=0;li--){ lasers[li].life+=st.dt; if(lasers[li].life>lasers[li].max)lasers.splice(li,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    var fade=finT>0?Math.max(0,1-(t-finT)/700):1;
    for(var mi=0;mi<mirrors.length;mi++){ var m=mirrors[mi];
      drawMirror(ctx,m.x,m.y,1.25*sz,m.rot,fade,m.lit);
    }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz;
    for(var li=0;li<lasers.length;li++){ var L=lasers[li]; var a=Math.sin(Math.min(1,L.life/L.max)*3.14);
      ctx.strokeStyle=g(C_S+','+(0.85*a)); ctx.lineWidth=2.4*sz*a; ctx.shadowBlur=14; ctx.shadowColor=g(C_S+',1');
      ctx.beginPath(); ctx.moveTo(L.x1,L.y1); ctx.lineTo(L.x2,L.y2); ctx.stroke();
      ctx.strokeStyle=g('255,255,255,'+(0.8*a)); ctx.lineWidth=0.9*sz; ctx.stroke(); ctx.shadowBlur=0; }
  }});
}catch(e){ try{deal();}catch(e2){} } }
