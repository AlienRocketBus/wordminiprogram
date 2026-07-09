/* ═══ v4b 重做(覆盖旧版): 索拉里斯(六色螺旋·原创) / 黄金斯芬克斯(翼日巨轮) ═══ */

/* ⑱v4 天启征服者·索拉里斯 —— 胸前六宝石全亮→六芒法阵→六色螺旋光束→流星环→六色天启爆 */
function fxSuolaris(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var COLS=['150,60,255','60,120,255','255,60,80','255,150,50','60,200,120','240,245,255'];
  var gemN=0, arrayA=0, beamT=-1, meteorT=-1, meteors=[], finT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6400,endMs:4500,
  busy:function(st){ return meteors.length>0||(finT>0&&st.t-finT<900); },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①六宝石依次亮(每160ms) */
    var newN=Math.min(6,Math.floor(t/160));
    if(newN>gemN){ gemN=newN; var gi=gemN-1, a=gi/6*6.283-1.57;
      F.burst(st.P,st.bx+Math.cos(a)*52*sz,st.by+Math.sin(a)*52*sz,COLS[gi],7,4.5,sz);
    }
    /* 全亮→1100 汇聚成六芒法阵 */
    if(t>=1050)arrayA=Math.min(1,(t-1050)/380);
    if(!st.fired.arr&&t>=1050){ st.fired.arr=1;
      for(var q=0;q<6;q++)F.suck(st.P,st.bx+Math.cos(q/6*6.283-1.57)*52*sz,st.by+Math.sin(q/6*6.283-1.57)*52*sz,st.bx,st.by,COLS[q],sz);
      F.flash(st.P,st.bx,st.by,'240,245,255',26*sz,220);
    }
    /* ②1550 六色螺旋光束轰击(850ms) */
    if(!st.fired.beam&&t>=1550){ st.fired.beam=1; beamT=t; }
    if(beamT>0&&t-beamT<850){
      if(Math.random()<0.8){ var ci=Math.floor(rnd(0,6));
        F.jet(st.P,st.hx+rnd(-14,14)*sz,st.hy+rnd(-10,10)*sz,rnd(0,6.28),3.14,COLS[ci],2,5,sz); }
      if(!st.fired.dealt&&t-beamT>260){ st.fired.dealt=1; st.fire();
        F.ring(st.P,st.hx,st.hy,'240,245,255',1.2,3.6*sz); F.burst(st.P,st.hx,st.hy,COLS[0],12,7,sz); }
    }
    /* ③2550 光束打散为六颗流星环绕收缩 */
    if(!st.fired.met&&t>=2550){ st.fired.met=1; meteorT=t;
      for(var m=0;m<6;m++)meteors.push({idx:m,ang:m/6*6.283,r:104*sz,spin:0.0052,trail:[]});
    }
    for(var mi=0;mi<meteors.length;mi++){ var M=meteors[mi];
      M.ang+=M.spin*st.dt; M.r=Math.max(6*sz,M.r-st.dt*0.075*sz*(104/104));
      M.x=st.hx+Math.cos(M.ang)*M.r; M.y=st.hy+Math.sin(M.ang)*M.r*0.66;
      M.trail.push({x:M.x,y:M.y}); if(M.trail.length>9)M.trail.shift();
    }
    /* 收缩到位→④3480 六色天启爆(六色爆环依次+白柱) */
    if(!st.fired.fin&&meteors.length&&meteors[0].r<=7*sz){ st.fired.fin=1; finT=st.t;
      meteors=[];
      F.flash(st.P,st.hx,st.hy,'255,255,255',72*sz,340);
      for(var q2=0;q2<6;q2++){ (function(qq){ setTimeout(function(){ if(st.dead)return;
        F.ring(st.P,st.hx,st.hy,COLS[qq],1.05+qq*0.17,(4.6-qq*0.4)*st.sz);
      },qq*80/st.sp); })(q2); }
      F.burst(st.P,st.hx,st.hy,'240,245,255',26,9,sz);
      for(var q3=0;q3<6;q3++)F.burst(st.P,st.hx,st.hy,COLS[q3],7,7.5,sz);
    }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 胸前六宝石(常亮·全亮后向中心汇聚成法阵) */
    var pull=arrayA;
    for(var k=0;k<gemN;k++){ var a=k/6*6.283-1.57;
      var r=52*sz*(1-pull*0.55);
      var x=st.bx+Math.cos(a+pull*0.9)*r, y=st.by+Math.sin(a+pull*0.9)*r;
      var pl=0.7+Math.sin(t*0.007+k)*0.3;
      var gg2=ctx.createRadialGradient(x,y,0,x,y,9*sz);
      gg2.addColorStop(0,'rgba(255,255,255,'+pl+')'); gg2.addColorStop(.4,g(COLS[k]+','+(0.9*pl))); gg2.addColorStop(1,g(COLS[k]+',0'));
      ctx.fillStyle=gg2; ctx.beginPath(); ctx.arc(x,y,9*sz,0,6.283); ctx.fill();
    }
    /* 六芒法阵(全亮后浮现在boss胸前) */
    if(arrayA>0){ var fade=beamT>0&&t-beamT>850?Math.max(0,1-(t-beamT-850)/500):1;
      var aa=arrayA*fade;
      if(aa>0){ ctx.save(); ctx.globalAlpha=aa; ctx.translate(st.bx,st.by); ctx.rotate(t*0.0016);
        var R=34*sz;
        ctx.strokeStyle='rgba(240,245,255,0.9)'; ctx.lineWidth=1.7*sz; ctx.shadowBlur=12; ctx.shadowColor='rgba(200,210,255,1)';
        ctx.beginPath(); ctx.arc(0,0,R,0,6.283); ctx.stroke();
        /* 双三角六芒星: 每边用相邻宝石色 */
        for(var tr2=0;tr2<2;tr2++){ ctx.beginPath();
          for(var v=0;v<=3;v++){ var va=(v/3*6.283)+(tr2?0.5236:0)+(tr2?3.14:0)-1.57;
            var vx=Math.cos(va)*R*0.82, vy=Math.sin(va)*R*0.82;
            if(v===0)ctx.moveTo(vx,vy); else ctx.lineTo(vx,vy); }
          ctx.strokeStyle=g(COLS[tr2?1:0]+',0.85'); ctx.stroke(); }
        ctx.shadowBlur=0; ctx.restore();
      } }
    /* 六色螺旋光束 */
    if(beamT>0&&t-beamT<850){ var pr=(t-beamT)/850, env=Math.sin(Math.min(1,pr*1.15)*3.14);
      var x0=st.bx, y0=st.by;
      var ang=Math.atan2(st.hy-y0,st.hx-x0), L=Math.hypot(st.hx-x0,st.hy-y0);
      ctx.save(); ctx.translate(x0,y0); ctx.rotate(ang);
      /* 白色主芯 */
      ctx.strokeStyle='rgba(255,255,255,'+(0.85*env)+')'; ctx.lineWidth=4.5*sz*env; ctx.lineCap='round';
      ctx.shadowBlur=14; ctx.shadowColor='rgba(230,235,255,1)';
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(L,0); ctx.stroke(); ctx.shadowBlur=0;
      /* 六条色带螺旋缠绕 */
      var phase=t*0.02;
      for(var c2=0;c2<6;c2++){ ctx.strokeStyle=g(COLS[c2]+','+(0.8*env)); ctx.lineWidth=2.6*sz*env;
        ctx.shadowBlur=8; ctx.shadowColor=g(COLS[c2]+',1');
        ctx.beginPath();
        for(var v2=0;v2<=30;v2++){ var p2=v2/30;
          var amp=(9+3*Math.sin(p2*4))*sz;
          var yy=Math.sin(p2*12.5+phase+c2/6*6.283)*amp;
          if(v2===0)ctx.moveTo(0,yy); else ctx.lineTo(p2*L,yy); }
        ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
      /* 命中熔核(六色轮转) */
      var hc=COLS[Math.floor(t/90)%6];
      var hg2=ctx.createRadialGradient(st.hx,st.hy,0,st.hx,st.hy,20*sz*env);
      hg2.addColorStop(0,'rgba(255,255,255,1)'); hg2.addColorStop(.5,g(hc+',0.85')); hg2.addColorStop(1,g(hc+',0'));
      ctx.fillStyle=hg2; ctx.beginPath(); ctx.arc(st.hx,st.hy,20*sz*env,0,6.283); ctx.fill();
    }
    /* 六流星环绕(拖彩尾) */
    for(var mi=0;mi<meteors.length;mi++){ var M=meteors[mi];
      if(M.trail.length>1){ for(var q=1;q<M.trail.length;q++){
        ctx.strokeStyle=g(COLS[M.idx]+','+(q/M.trail.length*0.75)); ctx.lineWidth=(q/M.trail.length*3.4)*sz; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(M.trail[q-1].x,M.trail[q-1].y); ctx.lineTo(M.trail[q].x,M.trail[q].y); ctx.stroke(); } }
      var mg2=ctx.createRadialGradient(M.x,M.y,0,M.x,M.y,7*sz);
      mg2.addColorStop(0,'rgba(255,255,255,0.95)'); mg2.addColorStop(.5,g(COLS[M.idx]+',0.9')); mg2.addColorStop(1,g(COLS[M.idx]+',0'));
      ctx.fillStyle=mg2; ctx.shadowBlur=10; ctx.shadowColor=g(COLS[M.idx]+',1');
      ctx.beginPath(); ctx.arc(M.x,M.y,4.6*sz,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    }
    /* 天启白柱(终爆) */
    if(finT>0&&t-finT<700){ var pr3=(t-finT)/700, env2=Math.sin(pr3*3.14);
      var w=52*sz*env2;
      var wg=ctx.createLinearGradient(st.hx-w,0,st.hx+w,0);
      wg.addColorStop(0,'rgba(255,255,255,0)'); wg.addColorStop(.5,'rgba(255,255,255,'+(0.6*env2)+')'); wg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=wg; ctx.fillRect(st.hx-w,0,w*2,st.barBot+18);
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ⑥v4 天界守护者·黄金斯芬克斯 —— 四翼金羽逐根点亮→三重谜题环锁定→十字瞳光→翼日巨轮压顶 */
function fxSphinx(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,215,110', C_W='255,246,215', C_O2='255,170,70';
  var wingA=0, riddles=[], eyeT=-1, diskT=-1, diskHitT=-1, feathersFall=[];
  var SY=['𓂀','☥','𓋹','𓆣','▽','𓁹','◬','☉'];
  function drawWingedSun(ctx,x,y,s,a,rot){ /* 埃及翼日: 中央日盘+两侧羽翼+双圣蛇垂线 */
    ctx.save(); ctx.globalAlpha=a; ctx.translate(x,y); ctx.rotate(rot); ctx.scale(s,s);
    /* 两侧羽翼(三层羽) */
    for(var e=-1;e<=1;e+=2){ ctx.save(); ctx.scale(e,1);
      for(var lay=0;lay<3;lay++){ var ly=lay*4-3, ll=52-lay*9;
        var wg=ctx.createLinearGradient(14,ly,14+ll,ly);
        wg.addColorStop(0,'#f0cc70'); wg.addColorStop(1,'#b8863a');
        ctx.fillStyle=wg; ctx.strokeStyle='#6a4f18'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(13,ly-2);
        ctx.quadraticCurveTo(14+ll*0.6,ly-7-lay*1.5,14+ll,ly-1+lay*2);
        ctx.quadraticCurveTo(14+ll*0.55,ly+3,13,ly+3); ctx.closePath(); ctx.fill(); ctx.stroke();
        /* 羽枝线 */
        ctx.strokeStyle='rgba(106,79,24,0.6)'; ctx.lineWidth=0.7;
        for(var f2=1;f2<5;f2++){ var fx3=13+ll*f2/5;
          ctx.beginPath(); ctx.moveTo(fx3,ly-3-lay); ctx.lineTo(fx3+3,ly+2); ctx.stroke(); }
      }
      ctx.restore(); }
    /* 双圣蛇(日盘两侧垂S线) */
    ctx.strokeStyle='#caa64a'; ctx.lineWidth=2.2; ctx.lineCap='round';
    for(var e2=-1;e2<=1;e2+=2){ ctx.beginPath();
      ctx.moveTo(e2*9,4); ctx.quadraticCurveTo(e2*14,10,e2*10,16); ctx.quadraticCurveTo(e2*6,21,e2*10,26); ctx.stroke();
      ctx.fillStyle='#caa64a'; ctx.beginPath(); ctx.arc(e2*10,27,2,0,6.283); ctx.fill(); }
    /* 中央日盘 */
    var sg=ctx.createRadialGradient(-3,-3,1,0,0,15);
    sg.addColorStop(0,'#fff2ce'); sg.addColorStop(.55,'#f6c455'); sg.addColorStop(1,'#c88a2c');
    ctx.fillStyle=sg; ctx.shadowBlur=16; ctx.shadowColor='rgba(255,205,90,1)';
    ctx.beginPath(); ctx.arc(0,0,14,0,6.283); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='#7a5416'; ctx.lineWidth=1.4; ctx.stroke();
    /* 日盘12刻纹 */
    ctx.strokeStyle='rgba(122,84,22,0.75)'; ctx.lineWidth=1;
    for(var k=0;k<12;k++){ var a2=k/12*6.283;
      ctx.beginPath(); ctx.moveTo(Math.cos(a2)*10,Math.sin(a2)*10); ctx.lineTo(Math.cos(a2)*13.4,Math.sin(a2)*13.4); ctx.stroke(); }
    ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6400,endMs:4500,
  busy:function(st){ return (diskT>0&&st.t-diskT<1500)||feathersFall.length>0; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    wingA=Math.min(1,t/750);
    if(t<900&&Math.random()<0.7)F.jet(st.P,st.bx+rnd(-120,120)*sz,st.by-rnd(0,80)*sz,1.57,0.3,C_G,1,1.6,sz);
    /* ②900 三重谜题环 + 三声锁定 */
    if(!st.fired.rid&&t>=900){ st.fired.rid=1;
      for(var k=0;k<3;k++)riddles.push({idx:k,r:(78-k*20)*sz,spin:(k%2?-1:1)*(0.0018+k*0.0007),ang:rnd(0,6.28),locked:false,lockT:1350+k*330});
    }
    for(var ri=0;ri<riddles.length;ri++){ var R2=riddles[ri];
      if(!R2.locked){ R2.ang+=R2.spin*st.dt;
        if(t>=R2.lockT){ R2.locked=true;
          F.ring(st.P,st.hx,st.hy,C_G,0.7+ri*0.12,2.2*sz);
          F.burst(st.P,st.hx+Math.cos(R2.ang)*R2.r,st.hy+Math.sin(R2.ang)*R2.r*0.5,C_W,6,4,sz);
        } }
    }
    /* ③2450 十字瞳光射线 */
    if(!st.fired.eye&&t>=2450){ st.fired.eye=1; eyeT=t; st.fire(); }
    if(eyeT>0&&t-eyeT<560&&Math.random()<0.6)F.burst(st.P,st.hx+rnd(-24,24)*sz,st.hy+rnd(-16,16)*sz,C_G,2,3.5,sz);
    /* ④3100 翼日巨轮降临压顶→3800拍落 */
    if(!st.fired.disk&&t>=3100){ st.fired.disk=1; diskT=t; }
    if(!st.fired.dhit&&diskT>0&&t-diskT>=680){ st.fired.dhit=1; diskHitT=t;
      F.flash(st.P,st.hx,st.hy,C_W,72*sz,330);
      F.ring(st.P,st.hx,st.hy,C_G,2.0,6.5*sz); F.ring(st.P,st.hx,st.hy,C_O2,1.3,4.4*sz); F.ring(st.P,st.hx,st.hy,C_W,0.9,3*sz);
      F.burst(st.P,st.hx,st.hy,C_G,30,9,sz); F.burst(st.P,st.hx,st.hy,C_O2,16,7,sz);
      F.shards(st.P,st.hx,st.hy,C_G,14,sz);
      /* 漫天金羽飘落 */
      for(var fq=0;fq<12;fq++)feathersFall.push({x:st.hx+rnd(-110,110)*sz,y:st.hy-rnd(60,150)*sz,vy:rnd(0.6,1.2),ph:rnd(0,6.28),rot:rnd(0,6.28),vrot:rnd(-0.06,0.06),life:0,max:rnd(1100,1700)});
    }
    for(var fi=feathersFall.length-1;fi>=0;fi--){ var F2=feathersFall[fi];
      F2.life+=st.dt; F2.y+=F2.vy*st.dt*0.06; F2.rot+=F2.vrot;
      if(F2.life>F2.max||F2.y>st.hy+40*sz)feathersFall.splice(fi,1); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 翼日巨轮(降临→拍落) */
    if(diskT>0&&t-diskT<1450){ var age=t-diskT;
      var y;
      if(age<680){ var dp=age/680; var ease=dp<0.5?dp/0.5*0.42:0.42+Math.pow((dp-0.5)/0.5,2)*0.58;
        y=-70*sz+ease*(st.hy-8*sz+70*sz); }
      else y=st.hy-8*sz;
      var a=age>1150?Math.max(0,1-(age-1150)/300):1;
      var yy=age>1150?y-(age-1150)*0.06*sz:y;
      drawWingedSun(ctx,st.hx,yy,1.5*sz,a,Math.sin(t*0.002)*0.03);
      if(age<680&&Math.random()<0.6)F.jet(st.P,st.hx+rnd(-60,60)*sz,y+18*sz,1.57,0.4,C_G,1,2.2,sz);
    }
    /* 飘落金羽 */
    for(var fi=0;fi<feathersFall.length;fi++){ var F2=feathersFall[fi];
      var pr=F2.life/F2.max, a2=pr<0.12?pr/0.12:1-Math.max(0,pr-0.6)/0.4;
      var x=F2.x+Math.sin(F2.ph+F2.life*0.003)*16*sz;
      ctx.save(); ctx.globalAlpha=Math.max(0,a2*0.95); ctx.translate(x,F2.y); ctx.rotate(F2.rot+Math.sin(F2.life*0.004)*0.3);
      ctx.fillStyle='#f2ce7a'; ctx.strokeStyle='#a87a2c'; ctx.lineWidth=0.8*sz;
      ctx.beginPath(); ctx.moveTo(0,-6*sz); ctx.quadraticCurveTo(4*sz,-1*sz,0,7*sz); ctx.quadraticCurveTo(-4*sz,-1*sz,0,-6*sz); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,-4.6*sz); ctx.lineTo(0,5.6*sz); ctx.stroke();
      ctx.restore(); }
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 四翼金羽(上下两对·逐根点亮·羽尖太阳石) */
    if(wingA>0){ ctx.save();
      for(var e=-1;e<=1;e+=2){ for(var pair=0;pair<2;pair++){
        var oy=pair?24*sz:-6*sz, base=pair?0.35:-0.75;
        ctx.save(); ctx.translate(st.bx+e*38*sz,st.by-8*sz+oy); ctx.scale(e,1);
        var nF=7;
        for(var f2=0;f2<nF;f2++){ var lit=Math.min(1,Math.max(0,(t-(f2+pair*nF)*52)/220));
          if(lit<=0)continue;
          var fa=base+f2*0.2, L=(58+f2*8)*sz*wingA;
          ctx.strokeStyle=g(C_G+','+((0.8-f2*0.06)*lit)); ctx.lineWidth=(3.2-f2*0.3)*sz; ctx.lineCap='round';
          ctx.shadowBlur=9; ctx.shadowColor=g(C_G+',1');
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.quadraticCurveTo(L*0.5,Math.sin(fa)*L*0.5-10*sz,L*Math.cos(fa*0.45),Math.sin(fa)*L);
          ctx.stroke();
          /* 羽尖太阳石 */
          var tx2=L*Math.cos(fa*0.45), ty2=Math.sin(fa)*L;
          var tw=0.6+Math.sin(t*0.008+f2)*0.4;
          ctx.fillStyle=g(C_W+','+(lit*tw)); ctx.shadowBlur=8;
          ctx.beginPath(); ctx.arc(tx2,ty2,2.2*sz,0,6.283); ctx.fill();
        }
        ctx.shadowBlur=0; ctx.restore();
      } }
      ctx.restore();
    }
    /* 三重谜题环 */
    for(var ri=0;ri<riddles.length;ri++){ var R2=riddles[ri];
      var fade=diskHitT>0?Math.max(0,1-(t-diskHitT)/450):1;
      if(fade<=0)continue;
      var pulse=R2.locked?0.95:0.6+Math.sin(t*0.01)*0.2;
      ctx.save(); ctx.globalAlpha=fade;
      ctx.strokeStyle=g((R2.locked?C_W:C_G)+','+(0.8*pulse)); ctx.lineWidth=(R2.locked?2:1.4)*sz;
      ctx.shadowBlur=R2.locked?12:6; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.ellipse(st.hx,st.hy,R2.r,R2.r*0.5,0,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
      ctx.fillStyle=g(C_W+','+pulse); ctx.font=(11*sz)+'px serif'; ctx.textAlign='center';
      for(var k=0;k<4;k++){ var a3=R2.ang+k/4*6.283;
        ctx.fillText(SY[(ri*3+k)%8],st.hx+Math.cos(a3)*R2.r,st.hy+Math.sin(a3)*R2.r*0.5+4*sz); }
      ctx.restore();
    }
    /* 十字瞳光(眼部十字闪+十字光刃射向勇者) */
    if(eyeT>0&&t-eyeT<560){ var pr=(t-eyeT)/560, env=Math.sin(pr*3.14);
      var x0=st.bx,y0=st.by-42*sz;
      /* 眼部旋转太阳十字 */
      ctx.save(); ctx.translate(x0,y0); ctx.rotate(t*0.004);
      ctx.strokeStyle=g(C_W+','+env); ctx.lineWidth=2.2*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      for(var k2=0;k2<4;k2++){ ctx.rotate(1.5708);
        ctx.beginPath(); ctx.moveTo(0,-3*sz); ctx.lineTo(0,-12*sz); ctx.stroke(); }
      ctx.restore();
      /* 主射线 */
      ctx.strokeStyle=g(C_W+','+(0.9*env)); ctx.lineWidth=4.6*sz*env; ctx.lineCap='round';
      ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(st.hx,st.hy); ctx.stroke();
      /* 命中十字光刃(横竖展开) */
      var cl=Math.min(1,pr*1.8)*30*sz;
      ctx.lineWidth=3*sz*env;
      ctx.beginPath(); ctx.moveTo(st.hx-cl,st.hy); ctx.lineTo(st.hx+cl,st.hy);
      ctx.moveTo(st.hx,st.hy-cl); ctx.lineTo(st.hx,st.hy+cl); ctx.stroke();
      ctx.shadowBlur=0;
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
