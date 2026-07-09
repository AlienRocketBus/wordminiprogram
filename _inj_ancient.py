import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak7.js')

FN_ANCHOR='  function hbaSoulAbyss(bsEl,hx,barL,barW,midY,barBot,fx,deal){'
FN=r'''  /* ─────────── 活体行星·古老意志 → 引力坍缩(星海第一星域·守望之星) ─────────── */
  /* 🔴 v869 新建(Hansen 定稿·守望不战斗的活体行星): 全程 canvas 画出的【自转行星本体(金色脉络)+ 记忆环 + 引力场 + 引力奇点】当主角。不挥武器, 以引力意志碾压。
     四幕: ①苏醒凝视(行星脉络点亮·记忆环旋转·极光·大气辉光) ②引力低语(引力波从行星层层扩散washes勇者·近旁尘埃被牵引) ③星尘牵引(勇者处生成引力奇点·星尘螺旋吸入·行星金色引力束) ④引力坍缩(奇点坍缩内爆→炽金核→冲击波外爆·记忆环炸亮·行星脉络血脉贲张→判定, 之后归于守望)。
     刻意避开女帝专属的星系/繁星观感——这是一颗有环的行星, 不是星海。全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。 */
  function hbaAncientWill(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_GOLD='255,200,110', C_GOLDBR='255,226,150', C_CYAN='130,220,235';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}

      var plR=Math.max(38,br.width*0.40)*sz, plX=bx, plY=by;
      var sgX=tgtX, sgY=tgtY;

      function drawPlanet(cx,cy,r,rot,glow){
        ctx.save();ctx.globalCompositeOperation='lighter';
        var ag=ctx.createRadialGradient(cx,cy,r*0.85,cx,cy,r*1.42);ag.addColorStop(0,g('255,200,110,'+(0.22*glow)));ag.addColorStop(.6,g('130,220,235,'+(0.09*glow)));ag.addColorStop(1,g('255,180,90,0)');
        ctx.fillStyle=ag;ctx.beginPath();ctx.arc(cx,cy,r*1.42,0,6.28);ctx.fill();ctx.restore();
        ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,6.28);ctx.clip();
        var bg=ctx.createRadialGradient(cx-r*0.35,cy-r*0.35,r*0.15,cx,cy,r*1.15);bg.addColorStop(0,"#31555e");bg.addColorStop(.55,"#183038");bg.addColorStop(1,"#08151b");
        ctx.fillStyle=bg;ctx.fillRect(cx-r,cy-r,r*2,r*2);
        ctx.fillStyle="rgba(6,16,22,.5)";
        ctx.beginPath();ctx.ellipse(cx-r*0.3,cy-r*0.28,r*0.32,r*0.2,0.5,0,6.28);ctx.fill();
        ctx.beginPath();ctx.ellipse(cx+r*0.34,cy+r*0.3,r*0.28,r*0.16,-0.3,0,6.28);ctx.fill();
        ctx.globalCompositeOperation='lighter';ctx.shadowBlur=8;ctx.shadowColor="#ffcf7a";
        var vn=6,i;
        for(i=0;i<vn;i++){ var ph=rot+i*(6.28/vn); var cp=Math.cos(ph); if(cp<=0.06)continue;
          ctx.strokeStyle=g('255,200,110,'+(glow*(0.3+0.55*cp)));ctx.lineWidth=1.8*sz;
          ctx.beginPath();ctx.moveTo(cx,cy-r*0.99);ctx.quadraticCurveTo(cx+Math.sin(ph)*r*1.32,cy,cx,cy+r*0.99);ctx.stroke(); }
        var la;
        for(la=-1;la<=1;la++){ if(la===0)continue; var ly=cy+la*r*0.42, lw=r*Math.sqrt(Math.max(0,1-0.42*0.42));
          ctx.strokeStyle=g('255,200,110,'+(glow*0.28));ctx.lineWidth=1.4*sz;ctx.beginPath();ctx.ellipse(cx,ly,lw*0.98,r*0.12,0,0,6.28);ctx.stroke(); }
        ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
        var tg=ctx.createLinearGradient(cx-r,cy,cx+r,cy);tg.addColorStop(0,'rgba(0,0,0,0)');tg.addColorStop(.55,'rgba(0,0,0,0)');tg.addColorStop(1,'rgba(0,0,0,.55)');
        ctx.fillStyle=tg;ctx.fillRect(cx-r,cy-r,r*2,r*2);
        ctx.globalCompositeOperation='lighter';
        var hg=ctx.createRadialGradient(cx-r*0.4,cy-r*0.4,0,cx-r*0.4,cy-r*0.4,r*0.7);hg.addColorStop(0,'rgba(180,230,240,.22)');hg.addColorStop(1,'rgba(180,230,240,0)');
        ctx.fillStyle=hg;ctx.fillRect(cx-r,cy-r,r*2,r*2);
        ctx.restore();
      }
      function drawRing(cx,cy,rx,ry,tickRot,glow,col){
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=g(col+','+(0.45*glow));ctx.lineWidth=2*sz;ctx.shadowBlur=8;ctx.shadowColor=g(col+',1');
        ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0,6.28);ctx.stroke();
        ctx.strokeStyle=g(col+','+(0.7*glow));ctx.lineWidth=1.3*sz;
        var nt=30,k;
        for(k=0;k<nt;k++){ var a=k/nt*6.28+tickRot; var ex=cx+Math.cos(a)*rx, ey=cy+Math.sin(a)*ry, nx=cx+Math.cos(a)*(rx+4*sz), ny=cy+Math.sin(a)*(ry+4*sz);
          ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(nx,ny);ctx.stroke(); }
        // 前缘亮弧(下半·制造环绕行星的纵深)
        ctx.strokeStyle=g(col+','+(0.85*glow));ctx.lineWidth=2.4*sz;
        ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,0.15,3.0);ctx.stroke();
        ctx.shadowBlur=0;ctx.restore();
      }
      function drawAurora(a){
        ctx.save();ctx.globalCompositeOperation='lighter';
        var cols=['120,230,170','150,200,245','185,150,240'],b2;
        for(b2=0;b2<3;b2++){ ctx.strokeStyle=g(cols[b2]+','+(0.09*a)); ctx.lineWidth=(14-b2*3)*sz; ctx.lineCap='round';
          ctx.beginPath(); var xx;
          for(xx=plX-plR*1.3;xx<=plX+plR*1.3;xx+=8){ var yy=plY-plR*0.55-b2*13*sz+Math.sin(xx*0.02+t*0.002+b2)*10*sz; if(xx<plX-plR*1.3+1)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy); }
          ctx.stroke(); }
        ctx.lineCap='butt';ctx.restore();
      }

      var waves=[], dust=[], motes=[], rings=[], shards=[], sparks=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var rot=0, ringRot=0, glow=0;
      var T_AWAKE=900, T_WHISPER_END=1900, T_PULL_END=2760, T_COLLAPSE=2760, T_END=3820;
      var nextWave=0, collapsed=false, imploded=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(240,460),sz:RND(1.4,3)*sz});}}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,8)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(300,560),sz:RND(2,5)*sz});}}
      function spawnDust(){ var a=Math.random()*6.28, rad=RND(60,95)*sz; dust.push({ang:a,rad:rad,vang:RND(0.004,0.008)*(Math.random()<0.5?1:-1),vrad:-RND(0.012,0.024),sz:RND(1.2,2.6)*sz,col:(Math.random()<0.5?C_GOLD:C_GOLDBR)}); }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt; rot+=dt*0.0006; ringRot+=dt*0.0008;
          glow=Math.min(1,t/T_AWAKE);
          // ② 引力波
          if(t>=T_AWAKE&&t<T_PULL_END&&t>=nextWave){ waves.push({r:plR*0.9,life:0,max:1500,vr:RND(0.10,0.14)}); nextWave=t+280/sp; }
          // ③ 星尘牵引
          if(t>=T_WHISPER_END&&t<T_COLLAPSE){ if(Math.random()<0.6)spawnDust(); }
          // ④ 坍缩
          if(!collapsed&&t>=T_COLLAPSE){ collapsed=true;
            for(var d0=0;d0<dust.length;d0++){ dust[d0].vrad=-RND(0.08,0.14); } // 全部急速吸入
          }
          if(collapsed&&!imploded&&t>=T_COLLAPSE+180){ imploded=true; fireDeal();
            rings.push({x:sgX,y:sgY,r:2,vr:1.5,w:6*sz,col:C_GOLDBR,life:0,max:420});
            rings.push({x:sgX,y:sgY,r:2,vr:1.0,w:4*sz,col:C_GOLD,life:0,max:380});
            rings.push({x:sgX,y:sgY,r:2,vr:0.7,w:3*sz,col:C_CYAN,life:0,max:340});
            spawnShards(sgX,sgY,C_GOLD,18); spawnSpark(sgX,sgY,'255,255,255',22,10);
            sparks.push({x:sgX,y:sgY,vx:0,vy:0,col:'255,255,255',life:0,max:220,sz:52*sz,flash:true,fcol:C_GOLDBR});
          }
          if(t>T_END&&waves.length===0&&dust.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&waves.length===0&&dust.length===0&&sparks.length===0&&rings.length===0&&shards.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* 极光(行星之后·先画) */
        if(glow>0.01) drawAurora(glow);
        /* 行星本体 */
        if(glow>0.01){ ctx.save();ctx.globalAlpha=Math.min(1,glow*1.2);drawPlanet(plX,plY,plR,rot,glow);ctx.restore(); }
        /* 记忆环(行星之前的后半在内部已含前缘弧) */
        if(glow>0.02){ drawRing(plX,plY,plR*1.5,plR*0.42,ringRot,glow,C_GOLD); drawRing(plX,plY,plR*1.86,plR*0.56,-ringRot*0.7,glow*0.8,C_CYAN); }

        ctx.globalCompositeOperation='lighter';
        /* 引力波(层层扩散·washes勇者) */
        for(var wi=waves.length-1;wi>=0;wi--){var w=waves[wi];w.life+=dt;w.r+=w.vr*dt;var wpr=w.life/w.max;if(wpr>=1||w.r>vh*1.1){waves.splice(wi,1);continue;}
          var wa=(1-wpr)*0.5;
          ctx.strokeStyle=g(C_GOLD+','+wa);ctx.lineWidth=2.4*sz*(1-wpr*0.5);ctx.shadowBlur=8;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.ellipse(plX,plY,w.r,w.r*0.82,0,0,6.28);ctx.stroke();ctx.shadowBlur=0;
          // 波峰经过勇者时牵引近旁尘埃
          if(Math.abs(w.r-Math.hypot(sgX-plX,sgY-plY))<12*sz && Math.random()<0.5){ motes.push({x:sgX+RND(-50,50)*sz,y:sgY+RND(-30,30)*sz,life:0,max:500}); }
        }
        /* ③④ 引力奇点 + 金色引力束 */
        if(t>=T_WHISPER_END){
          var grow=Math.min(1,(t-T_WHISPER_END)/(T_COLLAPSE-T_WHISPER_END));
          var coreR=grow*20*sz*(collapsed?Math.max(0,1-(t-T_COLLAPSE)/220):1);
          // 金色引力束: 行星→奇点
          ctx.strokeStyle=g(C_GOLD+','+(0.3+0.2*Math.sin(t*0.02))*grow);ctx.lineWidth=(3+grow*3)*sz;ctx.shadowBlur=12;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.moveTo(plX,plY+plR*0.6);ctx.lineTo(sgX,sgY-coreR);ctx.stroke();ctx.shadowBlur=0;
          if(coreR>0.5){
            // 吸积亮环
            ctx.strokeStyle=g(C_GOLDBR+','+(0.8*grow));ctx.lineWidth=2.4*sz;ctx.shadowBlur=14;ctx.shadowColor=g(C_GOLD+',1');
            ctx.beginPath();ctx.ellipse(sgX,sgY,coreR*1.5,coreR*1.05,0,0,6.28);ctx.stroke();ctx.shadowBlur=0;
            // 透镜暗核(source-over压暗中心)
            ctx.globalCompositeOperation='source-over';
            var cg=ctx.createRadialGradient(sgX,sgY,0,sgX,sgY,coreR);cg.addColorStop(0,'rgba(4,8,14,0.95)');cg.addColorStop(.7,'rgba(8,16,24,0.6)');cg.addColorStop(1,'rgba(8,16,24,0)');
            ctx.fillStyle=cg;ctx.beginPath();ctx.arc(sgX,sgY,coreR,0,6.28);ctx.fill();
            ctx.globalCompositeOperation='lighter';
          }
        }
        /* 星尘螺旋吸入 */
        for(var pi=dust.length-1;pi>=0;pi--){var p=dust[pi];p.ang+=p.vang*dt;p.rad+=p.vrad*dt;if(p.rad<4){dust.splice(pi,1);continue;}
          var px=sgX+Math.cos(p.ang)*p.rad, py=sgY+Math.sin(p.ang)*p.rad*0.72;
          ctx.fillStyle=g(p.col+','+Math.min(1,p.rad/50));ctx.shadowBlur=6;ctx.shadowColor=g(C_GOLD+',1');ctx.beginPath();ctx.arc(px,py,p.sz,0,6.28);ctx.fill();ctx.shadowBlur=0;}
        /* 被牵引的近旁尘埃(②) */
        for(var mi=motes.length-1;mi>=0;mi--){var m=motes[mi];m.life+=dt;var mpr=m.life/m.max;if(mpr>=1){motes.splice(mi,1);continue;}
          m.x+=(sgX-m.x)*0.02;m.y+=(sgY-m.y)*0.02;
          ctx.fillStyle=g(C_GOLD+','+((1-mpr)*0.7));ctx.beginPath();ctx.arc(m.x,m.y,1.6*sz,0,6.28);ctx.fill();}
        /* 坍缩冲击环 */
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=14;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        /* 火花/星屑 */
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(!s.flash){s.vy+=0.01*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fcol=s.fcol||C_GOLD;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.85)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=7;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=6;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.5);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||3300)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

'''
i=s.find(FN_ANCHOR); assert i>=0,'FN anchor fail'
s=s[:i]+FN+s[i:]

DISP_ANCHOR='      hbaAssembler(bs, asHX, asL, asW, asMY, asBB, fx, deal);\n      return;\n    }\n'
DISP=r'''    if(t==='ancientwill'){
      var awbar=document.querySelector('.hero-hp-bar'), awL,awW,awMY,awHX,awBB;
      if(awbar){ var awr=awbar.getBoundingClientRect(); awL=bc.x-awr.width/2;awW=awr.width;awMY=awr.top+awr.height*0.5;awHX=bc.x;awBB=awr.bottom; }
      else { awL=hc.x-60;awW=120;awMY=hc.y;awHX=hc.x;awBB=hc.y+6; }
      hbaAncientWill(bs, awHX, awL, awW, awMY, awBB, fx, deal);
      return;
    }
'''
k=s.find(DISP_ANCHOR); assert k>=0,'DISP anchor fail'
k2=k+len(DISP_ANCHOR); s=s[:k2]+DISP+s[k2:]

FX_ANCHOR="'\u673a\u68b0\u4e3b\u6559\u00b7\u7ec4\u88c5\u8005':{t:'assembler',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3000},"
FXE="\n'\u6d3b\u4f53\u884c\u661f\u00b7\u53e4\u8001\u610f\u5fd7':{t:'ancientwill',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3300}, // \U0001f534 \u661f\u6d77\u7b2c\u4e00\u661f\u57df\u7b2c5\u5173 \u5f15\u529b\u5766\u584c: \u884c\u661f\u82cf\u9192\u51dd\u89c6\u2192\u5f15\u529b\u4f4e\u8bed\u5c42\u5c42\u6269\u6563\u2192\u661f\u5c18\u7275\u5f15\u5165\u5f15\u529b\u5947\u70b9\u2192\u5f15\u529b\u5766\u584c\u5185\u7206\u5916\u7206(\u5b88\u671b\u4e0d\u6218\u6597\u7684\u884c\u661f\u610f\u5fd7)"
m=s.find(FX_ANCHOR); assert m>=0,'FX anchor fail'
m2=m+len(FX_ANCHOR); s=s[:m2]+FXE+s[m2:]

open(P,'w',encoding='utf-8').write(s)
print('done len=%d'%len(s))
