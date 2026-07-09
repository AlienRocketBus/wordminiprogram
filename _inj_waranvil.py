import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak4.js')

START='  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u6b66\u5668\u5927\u5e08\u00b7\u6218\u4e89\u94c1\u7827 \u2192 \u5168\u6b66\u5e93\u538b\u5236(\u661f\u6d77\u7b2c\u4e00\u661f\u57df\u00b7\u79fb\u52a8\u519b\u706b\u5e93) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */'
END='  function hbaSoulAbyss(bsEl,hx,barL,barW,midY,barBot,fx,deal){'
i=s.find(START); j=s.find(END)
assert i>=0 and j>i, ('anchor fail', i, j)

NEW=r'''  /* ─────────── 武器大师·战争铁砧 → 全武库压制(星海第一星域·实体军火库) ─────────── */
  /* 🔴 v869 重做(Hansen 定稿·实体武器): 全程 canvas 画出的【实体重机枪(粗管+弹链弹箱+散热护罩+炽热枪管) + 实体军刀 + 实体导弹】当主角。
     四幕: ①重机枪弹幕(真实枪口高频喷火·曳光弹雨·弹壳飞溅·枪管过热渐红) ②导弹环射汇聚(散开→盘旋→汇聚俯冲→连环爆·Hansen 招牌) ③军刀重斩(实体军刀大幅横扫+火焰扇形残影) ④全武库过载(机枪连发+导弹倾泻+胸甲过载红光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标(不手动×DPR)·答题区 clip 到 barBot+18·零震屏。武器/导弹 source-over 画实体, 火焰/曳光/爆炸 lighter 叠其上。 */
  function hbaWarAnvil(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_FIRE='255,122,26', C_ORANGE='255,150,40', C_PLASMA='90,216,255', C_RED='255,60,50', C_SMOKE='200,208,216';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      /* ===== 实体重机枪(枪管朝 +x·握把在原点·heat=过热0..1) ===== */
      function drawHMG(cx,cy,s,rot,a,heat){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        var abg=ctx.createLinearGradient(0,8,0,40);abg.addColorStop(0,"#454e34");abg.addColorStop(1,"#2c331f");
        ctx.fillStyle=abg;rr(-52,8,32,32,3);ctx.fill();ctx.strokeStyle="#5f6a45";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#5f6a45";rr(-49,11,26,4,1);ctx.fill();
        for(var bi=0;bi<6;bi++){var bxp=-46+bi*7.2,byp=9-bi*1.6;ctx.save();ctx.translate(bxp,byp);ctx.rotate(-0.42);
          ctx.fillStyle="#b8912f";rr(-2.3,-5,4.6,10,1.4);ctx.fill();ctx.fillStyle="#e6c065";rr(-2.3,-5,4.6,3,1.4);ctx.fill();
          ctx.fillStyle="#8a6a20";ctx.fillRect(-2.3,3,4.6,1.5);ctx.restore();}
        var rgd=ctx.createLinearGradient(0,-17,0,11);rgd.addColorStop(0,"#2c303a");rgd.addColorStop(.3,"#565d6b");rgd.addColorStop(.55,"#3e444e");rgd.addColorStop(1,"#22252b");
        ctx.fillStyle=rgd;rr(-42,-17,64,29,5);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1.8;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=4.5;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-22,-17);ctx.lineTo(-14,-28);ctx.lineTo(2,-28);ctx.lineTo(10,-17);ctx.stroke();ctx.lineCap="butt";
        ctx.fillStyle="#191c22";for(var v=0;v<4;v++){rr(-34+v*7.5,-11,4,11,1);ctx.fill();}
        var sgd=ctx.createLinearGradient(0,-10,0,9);sgd.addColorStop(0,"#33373f");sgd.addColorStop(.4,"#4a505c");sgd.addColorStop(1,"#26292f");
        ctx.fillStyle=sgd;rr(24,-10,46,20,4);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#141619";for(var h=0;h<5;h++){ctx.beginPath();ctx.arc(32+h*8.5,-3.5,2.7,0,6.28);ctx.fill();ctx.beginPath();ctx.arc(32+h*8.5,4,2.7,0,6.28);ctx.fill();}
        var ht=heat||0;
        ctx.save();ctx.shadowBlur=10+ht*10;ctx.shadowColor="#ff7a1a";
        ctx.fillStyle="#5a2a18";rr(70,-5.5,20,11,2);ctx.fill();
        ctx.fillStyle=g((255)+','+Math.round(122-ht*40)+','+Math.round(26+ht*10)+',1');rr(70,-2.5,17,5,2);ctx.fill();
        ctx.fillStyle="#ffd08a";rr(70,-1.5,10,2,1);ctx.fill();ctx.restore();
        ctx.fillStyle="#2a2d33";rr(87,-7,9,14,2);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=0.8;ctx.stroke();
        ctx.fillStyle="#2f333c";ctx.beginPath();ctx.moveTo(-16,12);ctx.lineTo(-6,12);ctx.lineTo(-2,35);ctx.lineTo(-14,37);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#454b57";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-1,13);ctx.arc(4,19,6,-0.4,3.4);ctx.stroke();
        ctx.fillStyle="#2b2f38";rr(-44,-9,9,15,3);ctx.fill();
        ctx.restore();
      }
      /* ===== 实体军刀(重刃·刀刃朝 +x·火焰等离子刃) ===== */
      function drawSaber(cx,cy,s,rot,a){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";rr(-26,-4,20,8,2.5);ctx.fill();ctx.strokeStyle="#454b57";ctx.lineWidth=1;ctx.stroke();
        ctx.strokeStyle="#1a1d22";ctx.lineWidth=1;for(var w=0;w<4;w++){ctx.beginPath();ctx.moveTo(-23+w*4.5,-4);ctx.lineTo(-21+w*4.5,4);ctx.stroke();}
        ctx.fillStyle="#3a3f4a";ctx.beginPath();ctx.arc(-27,0,3.4,0,6.28);ctx.fill();
        ctx.fillStyle="#4a505c";rr(-7,-9,6,18,2);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1;ctx.stroke();
        var bg2=ctx.createLinearGradient(0,-9,0,7);bg2.addColorStop(0,"#9aa3b3");bg2.addColorStop(.5,"#dfe6f0");bg2.addColorStop(1,"#727a88");
        ctx.fillStyle=bg2;
        ctx.beginPath();ctx.moveTo(-1,-8);ctx.lineTo(46,-6);ctx.quadraticCurveTo(60,-2,64,2);ctx.quadraticCurveTo(52,7,30,8);ctx.lineTo(-1,7);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(120,130,150,.6)";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(2,-1);ctx.lineTo(50,-0.5);ctx.stroke();
        ctx.save();ctx.shadowBlur=11;ctx.shadowColor="#ff7a1a";ctx.strokeStyle="#ffb060";ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(-1,-8);ctx.lineTo(46,-6);ctx.quadraticCurveTo(60,-2,64,2);ctx.stroke();
        ctx.strokeStyle="#ff8a2a";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(30,8);ctx.lineTo(-1,7);ctx.stroke();ctx.restore();
        ctx.restore();
      }

      /* 枪姿态: 握把支点在 boss 左·枪管指向勇者 */
      var GS=1.1*sz;
      var gpivX=bx-br.width*0.20, gpivY=by-br.height*0.02;
      var aimAng=Math.atan2(tgtY-gpivY, tgtX-gpivX);
      function ptAt(px,py,ang,s,lx,ly){ return {x:px+s*(lx*Math.cos(ang)-ly*Math.sin(ang)), y:py+s*(lx*Math.sin(ang)+ly*Math.cos(ang))}; }

      var bolts=[], sparks=[], rings=[], shards=[], missiles=[], beams=[], shells=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var T_GUN=0, T_GUN_END=1080, T_MISSILE=1150, T_SLASH=2120, T_SLASH_HIT=2320, T_OVERLOAD=2620, T_END=4200;
      var nextBolt=0, missileFired=false, didSaber=false, saberHit=false, overloadFired=false, gunRecoil=0, heat=0;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}
      function explode(x,y,col,rad,shardN){
        rings.push({x:x,y:y,r:2,vr:1.0,w:4*sz,col:col,life:0,max:340});
        sparks.push({x:x,y:y,vx:0,vy:0,col:'255,255,255',life:0,max:180,sz:rad*sz,flash:true,fcol:col});
        spawnShards(x,y,col,shardN||8); spawnSpark(x,y,'255,255,255',6,8);
      }
      function curAng(){
        var base=aimAng;
        if(t<T_SLASH){ if(t<300){ base=aimAng+0.4*(1-t/300); } }
        else if(t<T_OVERLOAD){ var dp=Math.min(1,(t-T_SLASH)/220); base=aimAng+0.7*dp; }
        else { var ep=Math.min(1,(t-T_OVERLOAD)/260); base=aimAng+0.7*(1-ep); }
        return base;
      }
      function gunX(){ var k=gunRecoil*7*sz; return gpivX - Math.cos(curAng())*k; }
      function gunY(){ var k=gunRecoil*7*sz; return gpivY - Math.sin(curAng())*k; }
      function gunAlpha(){
        if(t<40) return t/40;
        if(t>=T_SLASH&&t<T_OVERLOAD){ return Math.max(0.16,1-(t-T_SLASH)/220*0.84); }
        return 1;
      }
      /* 重机枪曳光弹(从真实枪口·大枪口火舌+弹壳+后坐+过热累积) */
      function fireBolt(){
        var ang=curAng()+RND(-0.05,0.05), mz=ptAt(gunX(),gunY(),curAng(),GS,95,0);
        var spd=RND(16,20)*sp;
        bolts.push({x:mz.x,y:mz.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,w:2.6*sz,life:0,trail:[],hit:false});
        rings.push({x:mz.x,y:mz.y,r:2,vr:1.6,w:2.4*sz,col:C_FIRE,life:0,max:110,muzzle:true});
        var ej=ptAt(gunX(),gunY(),curAng(),GS,16,-9);
        shells.push({x:ej.x,y:ej.y,vx:Math.cos(curAng()-1.6)*RND(1.5,3),vy:Math.sin(curAng()-1.6)*RND(1.5,3)-RND(1,2),rot:Math.random()*6.28,vrot:RND(-0.5,0.5),life:0,max:600});
        gunRecoil=1; heat=Math.min(1,heat+0.10);
      }
      /* 导弹三阶段: 散开→盘旋→汇聚俯冲(Hansen 招牌·CSS 像素坐标) */
      function launchMissile(k,N,fromOverload){
        var spreadAng=(k/N)*6.28+RND(-0.3,0.3);
        var orbitR=RND(64,96)*sz;
        missiles.push({ x:bx, y:by-6, orbitR:orbitR, orbitAngle:spreadAng, phase:0, pt:0, ang:spreadAng, trail:[], hit:false,
          T_SPREAD:Math.round(20/sp), T_ORBIT:fromOverload?4:Math.round(14/sp) });
      }
      /* 军刀实体大横扫(经勇者·配火焰扇形残影) */
      function drawSaberSweep(){
        var ws=T_SLASH, wd=400; if(t<ws||t>=ws+wd)return;
        var pr=(t-ws)/wd, sweep=-0.95+pr*1.75;
        var a=1; if(pr<0.12)a=pr/0.12; else if(pr>0.84)a=(1-pr)/0.16;
        var pivX=tgtX-46*sz, pivY=tgtY-76*sz;
        drawSaber(pivX,pivY,1.75*sz,sweep,a);
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          if(t>=T_GUN&&t<T_GUN_END&&t>=nextBolt){ fireBolt(); nextBolt=t+RND(50,70)/sp; }
          if(!missileFired&&t>=T_MISSILE){ missileFired=true;
            explode(bx,by-6,C_FIRE,26,0);
            for(var mk=0;mk<8;mk++){(function(mk){setTimeout(function(){if(!dead)launchMissile(mk,8,false);},mk*45/sp);})(mk);}
          }
          if(!didSaber&&t>=T_SLASH){didSaber=true;
            if(bsEl){try{bsEl.animate([{transform:'translateX(0) scale(1)'},{transform:'translateX(16px) scale(1.05)',offset:.4},{transform:'translateX(0) scale(1)'}],{duration:440/sp});}catch(e){}}
          }
          if(!saberHit&&t>=T_SLASH_HIT){saberHit=true; fireDeal();
            beams.push({slash:true,x:tgtX,y:tgtY,rot:-0.3,life:0,max:260,col:C_FIRE,sweep:true});
            spawnSpark(tgtX,tgtY,'255,255,255',10,7);
          }
          if(!overloadFired&&t>=T_OVERLOAD){overloadFired=true;
            explode(bx,by,C_RED,52,0);
            if(bsEl){try{bsEl.animate([{filter:'brightness(1)'},{filter:'drop-shadow(0 0 26px rgba('+C_RED+',1)) brightness(1.3)',offset:.3},{filter:'brightness(1)'}],{duration:900/sp});}catch(e){}}
            var on=0; var ofire=function(){if(dead||on++>=18)return; fireBolt(); setTimeout(ofire,40/sp);}; setTimeout(ofire,300/sp);
            for(var ok=0;ok<5;ok++){(function(ok){setTimeout(function(){if(!dead)launchMissile(ok,5,true);},400+ok*70/sp);})(ok);}
          }
          if(t>T_END&&bolts.length===0&&missiles.length===0&&beams.length===0&&sparks.length<3){running=false;}
        }
        gunRecoil=Math.max(0,gunRecoil-dt/80);
        heat=Math.max(0,heat-dt/1400);
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0&&missiles.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体武器 + 导弹 + 弹壳(source-over 底) ===== */
        ctx.globalCompositeOperation='source-over';
        if(gunAlpha()>0.01){ drawHMG(gunX(),gunY(),GS,curAng(),gunAlpha(),heat); }
        drawSaberSweep();
        for(var mi=missiles.length-1;mi>=0;mi--){var m=missiles[mi];m.pt++;
          if(m.phase===0){var ox=bx+Math.cos(m.orbitAngle)*m.orbitR,oy=by+Math.sin(m.orbitAngle)*m.orbitR-20;var dx=ox-m.x,dy=oy-m.y,d=Math.hypot(dx,dy);m.x+=dx*0.14*sp;m.y+=dy*0.14*sp;m.ang=Math.atan2(dy,dx);if(d<14||m.pt>m.T_SPREAD){m.phase=1;m.pt=0;m.orbitAngle=Math.atan2(m.y-by,m.x-bx);}}
          else if(m.phase===1){m.orbitAngle+=0.14*sp;var rr2=m.orbitR*0.92;var nx=bx+Math.cos(m.orbitAngle)*rr2,ny=by+Math.sin(m.orbitAngle)*rr2-20;m.ang=Math.atan2(ny-m.y,nx-m.x);m.x=nx;m.y=ny;if(m.pt>m.T_ORBIT){m.phase=2;m.pt=0;}}
          else{var dx2=tgtX-m.x,dy2=tgtY-m.y,d2=Math.hypot(dx2,dy2),spd2=13*sz*sp;m.x+=dx2/d2*spd2;m.y+=dy2/d2*spd2;m.ang=Math.atan2(dy2,dx2);if(d2<16&&!m.hit){m.hit=true;fireDeal();explode(tgtX+RND(-6,6),tgtY+RND(-6,6),C_FIRE,30,9);missiles.splice(mi,1);continue;}}
          m.trail.push({x:m.x,y:m.y});if(m.trail.length>12)m.trail.shift();
          for(var ti=0;ti<m.trail.length;ti++){var kk=ti/m.trail.length;ctx.fillStyle=g(C_SMOKE+','+(kk*0.28));ctx.beginPath();ctx.arc(m.trail[ti].x,m.trail[ti].y,(2.5+kk*2.5)*sz,0,6.28);ctx.fill();}
          ctx.save();ctx.translate(m.x,m.y);ctx.rotate(m.ang);
          ctx.fillStyle="#c9ced6";rr(-9*sz,-3*sz,16*sz,6*sz,2*sz);ctx.fill();
          ctx.fillStyle=g(C_RED+',1');ctx.beginPath();ctx.moveTo(7*sz,0);ctx.lineTo(-1*sz,-3*sz);ctx.lineTo(-1*sz,3*sz);ctx.closePath();ctx.fill();
          ctx.fillStyle="#8a9098";ctx.beginPath();ctx.moveTo(-9*sz,-3*sz);ctx.lineTo(-13*sz,-6*sz);ctx.lineTo(-9*sz,-1*sz);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(-9*sz,3*sz);ctx.lineTo(-13*sz,6*sz);ctx.lineTo(-9*sz,1*sz);ctx.closePath();ctx.fill();
          ctx.save();ctx.globalCompositeOperation='lighter';var fl=ctx.createLinearGradient(-9*sz,0,-22*sz,0);fl.addColorStop(0,g(C_FIRE+',0.9'));fl.addColorStop(1,g(C_FIRE+',0'));
          ctx.fillStyle=fl;ctx.beginPath();ctx.moveTo(-9*sz,-2.5*sz);ctx.lineTo(-20*sz*(0.7+Math.random()*0.3),0);ctx.lineTo(-9*sz,2.5*sz);ctx.closePath();ctx.fill();ctx.restore();
          ctx.restore();
        }
        for(var shi=shells.length-1;shi>=0;shi--){var sh=shells[shi];sh.life+=dt;sh.vy+=0.4;sh.x+=sh.vx;sh.y+=sh.vy;sh.rot+=sh.vrot;var shpr=sh.life/sh.max;if(shpr>=1||sh.y>clipBottom){shells.splice(shi,1);continue;}
          ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.rot);ctx.fillStyle=g('224,176,80,'+(1-shpr));ctx.fillRect(-1.6*sz,-3.2*sz,3.2*sz,6.4*sz);ctx.restore();}

        /* ===== 火焰/曳光/爆炸层(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        if((t>=T_GUN&&t<T_GUN_END)||(overloadFired&&t<T_OVERLOAD+900)){
          var mz2=ptAt(gunX(),gunY(),curAng(),GS,95,0), flick=0.5+Math.random()*0.5;
          ctx.save();ctx.translate(mz2.x,mz2.y);ctx.rotate(curAng());
          var fg=ctx.createLinearGradient(0,0,46*sz,0);fg.addColorStop(0,g('255,255,255,'+flick));fg.addColorStop(.4,g(C_FIRE+','+flick));fg.addColorStop(1,g(C_FIRE+',0'));
          ctx.fillStyle=fg;ctx.beginPath();ctx.moveTo(0,-10*sz*flick);ctx.lineTo(48*sz*flick,0);ctx.lineTo(0,10*sz*flick);ctx.closePath();ctx.fill();ctx.restore();
        }
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          if(bm.slash){
            var env=Math.sin(bpr*Math.PI), sweepAng=bm.sweep?(-0.7+bpr*1.6):bm.rot;
            ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(sweepAng);var slen=130*sz;
            ctx.fillStyle=g(bm.col+','+(0.15*env));ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,slen,-0.5,0.1);ctx.closePath();ctx.fill();
            var gg=ctx.createLinearGradient(0,0,slen,0);gg.addColorStop(0,g(bm.col+',0.5'));gg.addColorStop(.7,g(bm.col+',0.3'));gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=22*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(15*sz,0);ctx.lineTo(slen,0);ctx.stroke();
            gg=ctx.createLinearGradient(0,0,slen,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.6,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=(8-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(15*sz,0);ctx.lineTo(slen,0);ctx.stroke();ctx.restore();
          }
        }
        for(var i=bolts.length-1;i>=0;i--){var b=bolts[i];b.life+=dt;b.x+=b.vx*dt*0.06;b.y+=b.vy*dt*0.06;b.trail.push({x:b.x,y:b.y});if(b.trail.length>7)b.trail.shift();
          if(!b.hit&&Math.hypot(b.x-tgtX,b.y-tgtY)<22*sz){b.hit=true;spawnSpark(b.x,b.y,C_FIRE,4,6);spawnRing(tgtX,tgtY,C_FIRE,0.8,2*sz);if(t>T_GUN+150)fireDeal();bolts.splice(i,1);continue;}
          if(b.x<-40||b.x>vw+40||b.y>clipBottom+40){bolts.splice(i,1);continue;}
          for(var ti2=0;ti2<b.trail.length;ti2++){var k2=ti2/b.trail.length;ctx.strokeStyle=g(C_FIRE+','+(k2*0.5));ctx.lineWidth=2.5*sz*k2;if(ti2>0){ctx.beginPath();ctx.moveTo(b.trail[ti2-1].x,b.trail[ti2-1].y);ctx.lineTo(b.trail[ti2].x,b.trail[ti2].y);ctx.stroke();}}
          ctx.shadowBlur=8;ctx.shadowColor=g(C_FIRE+',1');ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x,b.y,2.5*sz,0,6.28);ctx.fill();ctx.shadowBlur=0;
        }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(!s.flash){s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fcol=s.fcol||C_FIRE;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.8)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2600)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

'''

s2=s[:i]+NEW+s[j:]
open(P,'w',encoding='utf-8').write(s2)
print('done  removed=%d  added=%d  new_len=%d'%(j-i, len(NEW), len(s2)))
