/* ═══ v2 重做(覆盖同名旧版): 决斗大师 / 苍穹守卫 ═══ */

/* ⑮v2 决斗大师·千招之约 —— 武者残影瞬步近身: 六连拳肘膝腿→日字冲拳十连→崩拳终结 */
function fxJuedou(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_G='255,205,110', C_W='255,250,235', C_A='255,175,80';
  /* 姿势表: 相对髋坐标(面朝+x=勇者方向) */
  var P_GUARD={hd:[0,-34],lE:[-5,-15],lF:[7,-21],rE:[9,-14],rF:[15,-19],lK:[-4,15],lFt:[-6,31],rK:[6,15],rFt:[8,31],ln:0};
  var POSES={
    jabL:{hd:[2,-33],lE:[14,-21],lF:[31,-22],rE:[7,-13],rF:[11,-19],lK:[-2,15],lFt:[-5,31],rK:[8,15],rFt:[10,31],ln:0.08,hit:[34,-21]},
    jabR:{hd:[2,-33],lE:[-4,-15],lF:[8,-21],rE:[15,-20],rF:[32,-21],lK:[-2,15],lFt:[-5,31],rK:[8,15],rFt:[10,31],ln:0.08,hit:[35,-20]},
    hook:{hd:[3,-32],lE:[-5,-14],lF:[6,-20],rE:[17,-26],rF:[29,-13],lK:[-2,15],lFt:[-5,31],rK:[9,14],rFt:[12,30],ln:0.12,hit:[32,-13]},
    elbow:{hd:[4,-31],lE:[-4,-13],lF:[7,-19],rE:[26,-20],rF:[13,-24],lK:[0,14],lFt:[-3,30],rK:[10,13],rFt:[14,29],ln:0.16,hit:[29,-20]},
    knee:{hd:[2,-33],lE:[-5,-16],lF:[6,-22],rE:[9,-15],rF:[14,-20],lK:[-4,15],lFt:[-7,31],rK:[19,-3],rFt:[13,10],ln:0.1,hit:[22,-3]},
    kick:{hd:[-2,-32],lE:[-8,-15],lF:[2,-21],rE:[7,-14],rF:[12,-19],lK:[-5,14],lFt:[-8,30],rK:[17,-11],rFt:[36,-17],ln:-0.06,hit:[39,-17]},
    rushL:{hd:[1,-33],lE:[13,-20],lF:[29,-20],rE:[3,-12],rF:[-4,-9],lK:[-2,15],lFt:[-4,31],rK:[7,15],rFt:[9,31],ln:0.1,hit:[32,-20]},
    rushR:{hd:[1,-33],lE:[3,-12],lF:[-4,-9],rE:[13,-19],rF:[29,-19],lK:[-2,15],lFt:[-4,31],rK:[7,15],rFt:[9,31],ln:0.1,hit:[32,-19]},
    charge:{hd:[-2,-31],lE:[-9,-9],lF:[-4,-6],rE:[-10,-8],rF:[-5,-5],lK:[-5,13],lFt:[-8,29],rK:[7,13],rFt:[9,29],ln:-0.1},
    beng:{hd:[5,-31],lE:[-6,-10],lF:[1,-7],rE:[19,-19],rF:[38,-18],lK:[0,14],lFt:[-4,30],rK:[12,12],rFt:[17,28],ln:0.22,hit:[41,-18]}
  };
  var fighter={x:0,y:0,a:0,pose:P_GUARD,dash:[]};
  var combo=[], hits=[], burstT=-1, vanishT=-1;
  function lerpPose(A,B,p){ var o={};
    ['hd','lE','lF','rE','rF','lK','lFt','rK','rFt'].forEach(function(k){ o[k]=[A[k][0]+(B[k][0]-A[k][0])*p, A[k][1]+(B[k][1]-A[k][1])*p]; });
    o.ln=(A.ln||0)+((B.ln||0)-(A.ln||0))*p; return o; }
  function drawFighter(ctx,fx0,fy,s,pose,a,glow){
    ctx.save(); ctx.globalAlpha=a; ctx.translate(fx0,fy); ctx.rotate(pose.ln||0); ctx.scale(s,s);
    function L(x1,y1,x2,y2,w){ ctx.lineWidth=w; ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
    function limb(sx,sy,m,e,w){ L(sx,sy,m[0],m[1],w); L(m[0],m[1],e[0],e[1],w*0.9); }
    for(var pass=0;pass<2;pass++){
      if(pass===0){ ctx.strokeStyle='rgba(255,205,110,'+(glow?0.85:0.55)+')'; ctx.shadowBlur=12; ctx.shadowColor='rgba(255,190,90,1)'; var W2=6.4; }
      else { ctx.strokeStyle='#3a2c14'; ctx.shadowBlur=0; W2=2.8; }
      ctx.lineCap='round';
      L(pose.hd[0],pose.hd[1]+7, (pose.hd[0])*0.2,0, W2); /* 躯干 */
      limb(-4,-22,pose.lE,pose.lF,W2); limb(6,-22,pose.rE,pose.rF,W2);
      limb(-3,1,pose.lK,pose.lFt,W2); limb(4,1,pose.rK,pose.rFt,W2);
      ctx.lineWidth=W2; ctx.beginPath(); ctx.arc(pose.hd[0],pose.hd[1],7,0,6.283); ctx.stroke();
      if(pass===1){ ctx.fillStyle='#3a2c14';
        ctx.beginPath(); ctx.arc(pose.lF[0],pose.lF[1],3.4,0,6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(pose.rF[0],pose.rF[1],3.4,0,6.283); ctx.fill();
        /* 头带飘带 */
        ctx.strokeStyle='#c8442e'; ctx.lineWidth=1.8;
        L(pose.hd[0]-6,pose.hd[1]-1,pose.hd[0]-14,pose.hd[1]-4,1.8);
        L(pose.hd[0]-6,pose.hd[1]+1,pose.hd[0]-15,pose.hd[1]+2,1.8); }
    }
    ctx.shadowBlur=0; ctx.restore();
  }
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6100,endMs:4200,
  busy:function(st){ return vanishT>0&&st.t-vanishT<520; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    var standX=st.hx-62*sz, standY=st.hy+6*sz;
    /* ①0-460 瞬步冲刺 */
    if(t<460){ var dp=Math.min(1,t/380);
      var ease=1-Math.pow(1-dp,3);
      fighter.x=st.bx+(standX-st.bx)*ease; fighter.y=st.by+20*sz+(standY-(st.by+20*sz))*ease;
      fighter.a=Math.min(1,t/140); fighter.pose=P_GUARD;
      if(t>60&&Math.random()<0.5)fighter.dash.push({x:fighter.x,y:fighter.y,life:0});
      if(!st.fired.circle&&t>=60){ st.fired.circle=1; }
    } else { fighter.x=standX; fighter.y=standY; fighter.a=1; }
    for(var di=fighter.dash.length-1;di>=0;di--){ fighter.dash[di].life+=st.dt; if(fighter.dash[di].life>260)fighter.dash.splice(di,1); }
    /* ②700-1900 六连 */
    if(!st.fired.c6&&t>=700){ st.fired.c6=1;
      var seq=['jabL','jabR','hook','elbow','knee','kick'];
      for(var i=0;i<6;i++)combo.push({pose:seq[i],ts:700+i*200,dur:190,hitDone:false});
    }
    /* ③1980-2780 日字冲拳十连 */
    if(!st.fired.rush&&t>=1980){ st.fired.rush=1;
      for(var k=0;k<10;k++)combo.push({pose:k%2?'rushR':'rushL',ts:1980+k*80,dur:78,hitDone:false,small:true});
    }
    /* ④2830 蓄力→3060 崩拳 */
    if(!st.fired.chg&&t>=2830){ st.fired.chg=1;
      combo.push({pose:'charge',ts:2830,dur:230,noHit:true});
      combo.push({pose:'beng',ts:3060,dur:260,hitDone:false,big:true});
    }
    if(!st.fired.stomp&&t>=2900){ st.fired.stomp=1;
      /* 震脚: 地面金裂纹放射 */
      for(var s2=0;s2<6;s2++){ var sa=-0.5+s2/5*1.0+3.14/2*0+(s2%2?0.15:-0.15);
        var gx=fighter.x, gy=st.hy+44*sz;
        F.trail(st.P,gx,gy,gx+Math.cos(sa+1.05)*40*sz*(s2%2?1:-1)*0+((s2<3?-1:1)*(20+s2*11)*sz),gy+rnd(2,9)*sz,C_G,3*sz,420); }
      F.ring(st.P,fighter.x,st.hy+42*sz,C_G,1.0,3*sz);
      F.burst(st.P,fighter.x,st.hy+42*sz,C_A,10,4.5,sz);
    }
    /* 连段姿势插值+命中 */
    var cur=null;
    for(var ci=0;ci<combo.length;ci++){ var c=combo[ci];
      if(t>=c.ts&&t<c.ts+c.dur+90){ cur=c;
        var pp=(t-c.ts)/c.dur;
        var target=POSES[c.pose];
        if(pp<0.5)fighter.pose=lerpPose(P_GUARD,target,pp/0.5);
        else fighter.pose=lerpPose(target,P_GUARD,Math.min(1,(pp-0.5)/0.6));
        if(!c.hitDone&&!c.noHit&&pp>=0.42){ c.hitDone=true;
          var hp2=target.hit;
          var hxx=fighter.x+hp2[0]*1.55*sz, hyy=fighter.y+hp2[1]*1.55*sz;
          if(c.big){
            burstT=t;
            F.flash(st.P,hxx,hyy,C_G,58*sz,300);
            F.ring(st.P,st.hx,st.hy,C_G,1.9,6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_A,0.8,2.6*sz);
            F.burst(st.P,hxx,hyy,C_G,24,8.5,sz);
            hits.push({x:hxx,y:hyy,life:0,big:true});
            vanishT=t+380;
          } else {
            F.burst(st.P,hxx,hyy,c.small?C_A:C_G,c.small?4:8,c.small?4.5:6,sz);
            hits.push({x:hxx,y:hyy,life:0});
            if(!c.small)F.ring(st.P,hxx,hyy,C_W,0.65,2*sz);
            F.trail(st.P,fighter.x+6*sz,fighter.y-28*sz,hxx,hyy,C_W,2.4*sz,130);
          }
          if(!st.fired.dealt&&t>=1450){ st.fired.dealt=1; st.fire(); }
        }
      } }
    if(!cur&&t>=460)fighter.pose=P_GUARD;
    for(var hi=hits.length-1;hi>=0;hi--){ hits[hi].life+=st.dt; if(hits[hi].life>220)hits.splice(hi,1); }
    /* 残影散场 */
    if(vanishT>0&&t>=vanishT){ if(Math.random()<0.8)F.burst(st.P,fighter.x+rnd(-14,14)*sz,fighter.y+rnd(-34,30)*sz,C_G,2,3,sz); }
  },
  solid:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 冲刺拖影 */
    for(var di=0;di<fighter.dash.length;di++){ var d=fighter.dash[di];
      drawFighter(ctx,d.x,d.y,1.55*sz,P_GUARD,(1-d.life/260)*0.3,false); }
    /* 本体 */
    var va=vanishT>0&&t>=vanishT?Math.max(0,1-(t-vanishT)/420):fighter.a;
    if(va>0)drawFighter(ctx,fighter.x,fighter.y,1.55*sz,fighter.pose,va,true);
  },
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 决斗圈 */
    if(t>=60){ var ca=Math.min(1,(t-60)/420)*(vanishT>0&&t>vanishT?Math.max(0,1-(t-vanishT)/420):1);
      var cy=st.hy+52*sz;
      ctx.save(); ctx.globalAlpha=ca*0.9;
      ctx.strokeStyle=g(C_G+',0.85'); ctx.lineWidth=2.6*sz; ctx.shadowBlur=14; ctx.shadowColor=g(C_G+',1');
      ctx.beginPath(); ctx.ellipse(st.hx-20*sz,cy,118*sz,27*sz,0,0,6.283); ctx.stroke();
      ctx.setLineDash([2*sz,7*sz]); ctx.lineWidth=1.3*sz;
      ctx.beginPath(); ctx.ellipse(st.hx-20*sz,cy,102*sz,21*sz,0,0,6.283); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0; ctx.restore();
    }
    /* 命中冲击星 */
    for(var hi=0;hi<hits.length;hi++){ var h=hits[hi];
      var pr=h.life/220, env=Math.sin(pr*3.14), R=(h.big?26:13)*sz*(0.5+pr*0.9);
      ctx.save(); ctx.translate(h.x,h.y); ctx.rotate(pr*1.2);
      ctx.strokeStyle=g(C_W+','+(0.95*env)); ctx.lineWidth=(h.big?3:2)*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_G+',1');
      for(var k=0;k<4;k++){ ctx.rotate(1.5708);
        ctx.beginPath(); ctx.moveTo(0,-R*0.35); ctx.lineTo(0,-R); ctx.stroke(); }
      ctx.rotate(0.785);
      for(var k2=0;k2<4;k2++){ ctx.rotate(1.5708);
        ctx.beginPath(); ctx.moveTo(0,-R*0.25); ctx.lineTo(0,-R*0.6); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 崩拳冲击波扇面 */
    if(burstT>0&&t-burstT<640){ var pr2=(t-burstT)/640, env2=Math.sin(Math.min(1,pr2*1.1)*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy);
      var R2=110*sz*pr2;
      var cg2=ctx.createRadialGradient(0,0,R2*0.3,0,0,R2);
      cg2.addColorStop(0,g(C_W+',0')); cg2.addColorStop(.75,g(C_G+','+(0.5*env2))); cg2.addColorStop(1,g(C_G+',0'));
      ctx.fillStyle=cg2; ctx.beginPath(); ctx.arc(0,0,R2,0,6.283); ctx.fill();
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }

/* ㉖v2 苍穹守卫·阿尔基昂 —— 充能光束精确钻入胸前能量点→充满→热视线从双眼射出 */
function fxCangqiong(bsEl,hx,barL,barW,midY,barBot,fx,deal){ try{
  var F=FXCore,g=F.g,rnd=F.rnd;
  var C_B='90,140,255', C_C='150,200,255', C_R='255,70,55', C_W='245,250,255';
  var br0=bsEl.getBoundingClientRect();
  /* 立绘像素分析坐标: 胸口能量点(50%,36.5%) 双眼(44.3%/53.1%,15.4% 瞳孔精确定位) */
  var chest={x:br0.left+br0.width*0.500, y:br0.top+br0.height*0.365};
  var eyeL={x:br0.left+br0.width*0.443, y:br0.top+br0.height*0.154};
  var eyeR={x:br0.left+br0.width*0.531, y:br0.top+br0.height*0.154};
  var charge=0, starN=0, doneT=-1, eyeChg=0, scanT=-1, burnPath=[], pulseT=-1;
  F.shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,{hardMs:6100,endMs:4200,
  busy:function(st){ return pulseT>0&&st.t-pulseT<780; },
  tick:function(st){
    var t=st.t,sz=st.sz;
    /* ①0-1450 充能: 光束钻入胸前能量点 */
    if(t<1450){ charge=Math.min(1,t/1350);
      starN=Math.min(8,Math.floor(t/165));
      if(Math.random()<0.85)F.suck(st.P,chest.x+rnd(-10,10)*sz,rnd(0,chest.y*0.7),chest.x,chest.y,C_C,sz*0.9);
      if(Math.random()<0.3)F.suck(st.P,chest.x+rnd(-60,60)*sz,chest.y+rnd(-50,-10)*sz,chest.x,chest.y,C_B,sz*0.8);
    }
    /* ②1450 充能完成: 八芒爆闪+光束收束 */
    if(!st.fired.full&&t>=1450){ st.fired.full=1; doneT=t;
      F.flash(st.P,chest.x,chest.y,C_W,34*sz,260);
      F.ring(st.P,chest.x,chest.y,C_C,1.1,3.4*sz); F.ring(st.P,chest.x,chest.y,C_B,0.7,2.2*sz);
      F.burst(st.P,chest.x,chest.y,C_C,14,5.5,sz);
    }
    /* ③1980 双眼蓄能→2400 热视线扫射 */
    if(t>=1980&&t<2400)eyeChg=Math.min(1,(t-1980)/380);
    if(!st.fired.scan&&t>=2400){ st.fired.scan=1; scanT=t; }
    if(scanT>0&&t-scanT<980){ var sp2=(t-scanT)/980;
      var tx=st.hx-54*sz+sp2*108*sz;
      burnPath.push({x:tx,y:st.hy+Math.sin(sp2*6)*3*sz,life:0});
      if(burnPath.length>60)burnPath.shift();
      if(Math.random()<0.8){ F.jet(st.P,tx,st.hy,-1.57+rnd(-0.7,0.7),0.5,C_R,2,4.5,sz);
        F.burst(st.P,tx,st.hy,'255,150,80',1,3,sz); }
      if(!st.fired.dealt&&sp2>0.35){ st.fired.dealt=1; st.fire(); }
    }
    for(var bi=burnPath.length-1;bi>=0;bi--){ burnPath[bi].life+=st.dt; if(burnPath[bi].life>1400)burnPath.splice(bi,1); }
    /* 3380-3560 中心加压 */
    if(!st.fired.press&&t>=3400){ st.fired.press=1;
      F.flash(st.P,st.hx,st.hy,C_R,40*sz,220); F.ring(st.P,st.hx,st.hy,C_R,1.0,3*sz);
    }
    /* ④3560 脉冲星爆 */
    if(!st.fired.pulse&&t>=3560){ st.fired.pulse=1; pulseT=t;
      F.flash(st.P,st.hx,st.hy,C_W,66*sz,320);
      F.ring(st.P,st.hx,st.hy,C_B,1.9,6*sz); F.ring(st.P,st.hx,st.hy,C_W,1.3,4*sz); F.ring(st.P,st.hx,st.hy,C_R,0.8,2.6*sz);
      F.burst(st.P,st.hx,st.hy,C_B,28,9,sz);
    }
  },
  solid:function(st){},
  glow:function(st){
    var ctx=st.ctx,sz=st.sz,t=st.t;
    /* 天穹裂纹(顶部靛蓝细裂缝) */
    if(t<1700){ var ra=Math.min(1,t/300)*(t>1400?Math.max(0,(1700-t)/300):1);
      ctx.save(); ctx.globalAlpha=ra;
      ctx.strokeStyle=g(C_C+',0.9'); ctx.lineWidth=2*sz; ctx.shadowBlur=12; ctx.shadowColor=g(C_B+',1');
      ctx.beginPath(); ctx.moveTo(chest.x-46*sz,4); ctx.lineTo(chest.x-14*sz,10); ctx.lineTo(chest.x,16); ctx.lineTo(chest.x+18*sz,9); ctx.lineTo(chest.x+50*sz,3); ctx.stroke();
      ctx.shadowBlur=0; ctx.restore();
    }
    /* 充能光束: 顶端→精确终止于chest点 */
    if(t<1700){ var ba=charge>0?Math.min(1,t/220)*(t>1450?Math.max(0,(1660-t)/210):1):0;
      if(ba>0){ var w=(7-charge*2.5)*sz;
        var bg2=ctx.createLinearGradient(chest.x-w,0,chest.x+w,0);
        bg2.addColorStop(0,g(C_B+',0')); bg2.addColorStop(.5,g(C_C+','+(0.75*ba))); bg2.addColorStop(1,g(C_B+',0'));
        ctx.fillStyle=bg2; ctx.fillRect(chest.x-w,0,w*2,chest.y);
        ctx.strokeStyle=g(C_W+','+(0.95*ba)); ctx.lineWidth=1.6*sz; ctx.shadowBlur=10; ctx.shadowColor=g(C_C+',1');
        ctx.beginPath(); ctx.moveTo(chest.x,0); ctx.lineTo(chest.x,chest.y-3*sz); ctx.stroke(); ctx.shadowBlur=0;
        /* 钻入点亮斑 */
        var dg=ctx.createRadialGradient(chest.x,chest.y,0,chest.x,chest.y,9*sz);
        dg.addColorStop(0,g(C_W+','+ba)); dg.addColorStop(1,g(C_C+',0'));
        ctx.fillStyle=dg; ctx.beginPath(); ctx.arc(chest.x,chest.y,9*sz,0,6.283); ctx.fill();
      } }
    /* 胸口能量点(充能核: 随charge变大变亮·脉动) */
    if(t>60){ var coreR=(2.6+charge*5.2)*sz*(1+Math.sin(t*0.012)*0.12);
      var glowA=0.5+charge*0.5;
      if(doneT>0&&t-doneT<400)glowA=1;
      var cg3=ctx.createRadialGradient(chest.x,chest.y,0,chest.x,chest.y,coreR*2.6);
      cg3.addColorStop(0,g(C_W+','+glowA)); cg3.addColorStop(.4,g(C_C+','+(0.7*glowA))); cg3.addColorStop(1,g(C_B+',0'));
      ctx.fillStyle=cg3; ctx.beginPath(); ctx.arc(chest.x,chest.y,coreR*2.6,0,6.283); ctx.fill();
      /* 星芒8条逐亮 */
      for(var k=0;k<starN;k++){ var a2=k/8*6.283-1.57;
        var L2=(9+charge*7)*sz;
        ctx.strokeStyle=g(C_C+','+(0.9*glowA)); ctx.lineWidth=1.6*sz; ctx.lineCap='round';
        ctx.shadowBlur=8; ctx.shadowColor=g(C_C+',1');
        ctx.beginPath(); ctx.moveTo(chest.x+Math.cos(a2)*coreR,chest.y+Math.sin(a2)*coreR);
        ctx.lineTo(chest.x+Math.cos(a2)*(coreR+L2),chest.y+Math.sin(a2)*(coreR+L2)); ctx.stroke(); ctx.shadowBlur=0; }
    }
    /* 双眼蓄能红点 */
    if(eyeChg>0&&scanT<0){ [eyeL,eyeR].forEach(function(E){
      var er=(1.2+eyeChg*2.2)*sz;
      var eg=ctx.createRadialGradient(E.x,E.y,0,E.x,E.y,er*2.4);
      eg.addColorStop(0,g('255,190,170,'+eyeChg)); eg.addColorStop(.4,g(C_R+','+(0.8*eyeChg))); eg.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=eg; ctx.beginPath(); ctx.arc(E.x,E.y,er*2.4,0,6.283); ctx.fill(); }); }
    /* 热视线: 从双眼射向扫射落点 */
    if(scanT>0&&t-scanT<980){ var sp2=(t-scanT)/980;
      var tx=st.hx-54*sz+sp2*108*sz, ty=st.hy;
      [[eyeL,-3.4],[eyeR,3.4]].forEach(function(pair){ var E=pair[0], off=pair[1];
        ctx.strokeStyle=g(C_R+',0.9'); ctx.lineWidth=3.2*sz; ctx.lineCap='round';
        ctx.shadowBlur=10; ctx.shadowColor=g(C_R+',1');
        ctx.beginPath(); ctx.moveTo(E.x,E.y+2*sz); ctx.lineTo(tx+off*sz,ty); ctx.stroke();
        ctx.strokeStyle=g('255,230,200,0.95'); ctx.lineWidth=1.1*sz; ctx.shadowBlur=0;
        ctx.beginPath(); ctx.moveTo(E.x,E.y+2*sz); ctx.lineTo(tx+off*sz,ty); ctx.stroke();
        /* 眼部光斑 */
        var eg2=ctx.createRadialGradient(E.x,E.y+1.5*sz,0,E.x,E.y+1.5*sz,3.2*sz);
        eg2.addColorStop(0,g('255,220,200,1')); eg2.addColorStop(1,g(C_R+',0'));
        ctx.fillStyle=eg2; ctx.beginPath(); ctx.arc(E.x,E.y+1.5*sz,3.2*sz,0,6.283); ctx.fill(); });
      /* 接触点白热熔融 */
      var hg2=ctx.createRadialGradient(tx,ty,0,tx,ty,15*sz);
      hg2.addColorStop(0,g(C_W+',1')); hg2.addColorStop(.4,g('255,170,90,0.85')); hg2.addColorStop(1,g(C_R+',0'));
      ctx.fillStyle=hg2; ctx.beginPath(); ctx.arc(tx,ty,15*sz,0,6.283); ctx.fill();
    }
    /* 灼烧痕迹(扫过留下的暗红余温线) */
    if(burnPath.length>1){ ctx.save();
      for(var q=1;q<burnPath.length;q++){ var b0=burnPath[q-1], b1=burnPath[q];
        var ba2=Math.max(0,1-b1.life/1400)*0.65;
        ctx.strokeStyle=g('255,90,50,'+ba2); ctx.lineWidth=3*sz; ctx.lineCap='round';
        ctx.shadowBlur=6; ctx.shadowColor=g(C_R+',1');
        ctx.beginPath(); ctx.moveTo(b0.x,b0.y); ctx.lineTo(b1.x,b1.y); ctx.stroke(); }
      ctx.shadowBlur=0; ctx.restore(); }
    /* 脉冲星爆(八芒) */
    if(pulseT>0&&t-pulseT<780){ var pr3=(t-pulseT)/780, env2=Math.sin(Math.min(1,pr3*1.1)*3.14);
      ctx.save(); ctx.translate(st.hx,st.hy); ctx.rotate(pr3*0.8);
      for(var k3=0;k3<8;k3++){ ctx.rotate(0.7854);
        var L3=(30+pr3*92)*sz;
        var sg2=ctx.createLinearGradient(0,0,0,-L3);
        sg2.addColorStop(0,g(C_W+','+(0.9*env2))); sg2.addColorStop(1,g(C_B+',0'));
        ctx.strokeStyle=sg2; ctx.lineWidth=(k3%2?2:4)*sz*env2; ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-L3*(k3%2?0.62:1)); ctx.stroke(); }
      ctx.restore();
    }
  }});
}catch(e){ try{deal();}catch(e2){} } }
