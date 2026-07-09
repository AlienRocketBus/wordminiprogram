import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak3.js')

START='  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u6697\u5f71\u5148\u950b\u00b7\u7834\u9635\u8005 \u2192 \u730e\u624b\u5904\u51b3(\u661f\u6d77\u7b2c\u4e00\u661f\u57df\u00b7\u786c\u6838\u673a\u7532) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */'
END='  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u6b66\u5668\u5927\u5e08\u00b7\u6218\u4e89\u94c1\u7827 \u2192 \u5168\u6b66\u5e93\u538b\u5236(\u661f\u6d77\u7b2c\u4e00\u661f\u57df\u00b7\u79fb\u52a8\u519b\u706b\u5e93) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */'
i=s.find(START); j=s.find(END)
assert i>=0 and j>i, ('anchor fail', i, j)

NEW=r'''  /* ─────────── 暗影先锋·破阵者 → 猎手处决(星海第一星域·实体机甲) ─────────── */
  /* 🔴 v869 重做(Hansen 定稿·实体武器): 全程 canvas 画出的【实体爆能卡宾枪 + 等离子匕首】当主角, 不再是光点光条弹幕。
     四幕: ①举枪锁定(枪从下垂升起入镜·瞄准镜扫描射线锁定勇者) ②爆能扫射(真实枪口喷火连射·弹壳从抛壳口飞出·枪身后坐回弹) ③匕首突袭(抽实体等离子匕首交叉斩两刀) ④处决贯穿炮(枪口聚能成球→贯穿炮轰勇者)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标(不手动×DPR·修正旧隐患)·答题区 clip 到 barBot+18·零震屏。武器 source-over 画在特效之下当实体底, 能量/火花 lighter 叠其上。 */
  function hbaVanguard(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_GOLD='255,194,58', C_ORANGE='255,120,42', C_PLASMA='90,216,255', C_RED='255,60,70';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      /* ===== 实体爆能卡宾枪(枪管朝 +x·握把在原点) ===== */
      function drawCarbine(cx,cy,s,rot,a){
        ctx.save(); ctx.globalAlpha=a; ctx.translate(cx,cy); ctx.rotate(rot); ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";
        ctx.beginPath();ctx.moveTo(-40,-9);ctx.lineTo(-60,-13);ctx.lineTo(-86,-3);ctx.lineTo(-86,9);ctx.lineTo(-60,11);ctx.lineTo(-40,7);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#4a505c";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#171a20";ctx.beginPath();ctx.moveTo(-56,-6);ctx.lineTo(-76,0);ctx.lineTo(-56,6);ctx.closePath();ctx.fill();
        ctx.fillStyle="#3a3f4a";rr(-74,-13,32,4,2);ctx.fill();
        var bgd=ctx.createLinearGradient(0,-6,0,3);bgd.addColorStop(0,"#2e323a");bgd.addColorStop(.35,"#6b7380");bgd.addColorStop(.6,"#494f5a");bgd.addColorStop(1,"#22252b");
        ctx.fillStyle=bgd;rr(30,-6,58,9,3);ctx.fill();
        ctx.fillStyle="#34383f";rr(80,-8,17,13,3);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#14161b";ctx.fillRect(84,-6,2.4,9);ctx.fillRect(88.5,-6,2.4,9);ctx.fillRect(93,-6,2.4,9);
        ctx.fillStyle="#33373f";rr(16,-10,42,11,3);ctx.fill();
        ctx.fillStyle="#20232a";for(var r=0;r<6;r++){ctx.fillRect(20+r*6.5,-10,3,3);}
        var rgd=ctx.createLinearGradient(0,-12,0,7);rgd.addColorStop(0,"#2c303a");rgd.addColorStop(.28,"#565d6b");rgd.addColorStop(.5,"#41464f");rgd.addColorStop(1,"#24272e");
        ctx.fillStyle=rgd;rr(-44,-12,64,19,4);ctx.fill();ctx.strokeStyle="#5c6472";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="#15171c";rr(-6,-6,14,5,1.5);ctx.fill();
        ctx.save();ctx.shadowBlur=11;ctx.shadowColor="#ff9a4a";
        ctx.fillStyle="#ff7a2a";rr(-34,-2,26,4.5,2);ctx.fill();
        ctx.fillStyle="#ffd7a0";rr(-34,-2,26,1.6,1);ctx.fill();ctx.restore();
        ctx.fillStyle="#2b2f38";ctx.fillRect(-14,-15,4,4);ctx.fillRect(9,-15,4,4);
        var sgd=ctx.createLinearGradient(0,-28,0,-15);sgd.addColorStop(0,"#2a2e36");sgd.addColorStop(.4,"#525967");sgd.addColorStop(1,"#282b32");
        ctx.fillStyle=sgd;rr(-18,-28,33,13,6);ctx.fill();ctx.strokeStyle="#4a505c";ctx.lineWidth=1.2;ctx.stroke();
        ctx.fillStyle="#20232a";rr(-18,-27,4,11,2);ctx.fill();
        ctx.save();ctx.shadowBlur=9;ctx.shadowColor="#5ad8ff";
        var lg=ctx.createRadialGradient(12,-21.5,0,12,-21.5,6);lg.addColorStop(0,"#d6f6ff");lg.addColorStop(.5,"#5ad8ff");lg.addColorStop(1,"#155a78");
        ctx.fillStyle=lg;ctx.beginPath();ctx.arc(12,-21.5,5,0,6.28);ctx.fill();ctx.restore();
        ctx.fillStyle="#2f333c";ctx.beginPath();ctx.moveTo(-28,6);ctx.lineTo(-18,6);ctx.lineTo(-13,31);ctx.lineTo(-25,33);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#454b57";ctx.lineWidth=1.3;ctx.stroke();
        ctx.strokeStyle="#20232a";ctx.lineWidth=1;
        for(var gk=0;gk<3;gk++){ctx.beginPath();ctx.moveTo(-26+gk*0.5,12+gk*6);ctx.lineTo(-16+gk*0.5,12+gk*6);ctx.stroke();}
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2.6;ctx.beginPath();ctx.moveTo(-13,7);ctx.arc(-8,13,6,-0.35,3.4);ctx.stroke();
        ctx.strokeStyle="#565d6b";ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-9,8);ctx.lineTo(-9,13);ctx.stroke();
        ctx.fillStyle="#34383f";ctx.beginPath();ctx.moveTo(-4,6);ctx.lineTo(9,6);ctx.quadraticCurveTo(15,25,10,43);ctx.lineTo(-2,45);ctx.quadraticCurveTo(-3,25,-4,6);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#4a505c";ctx.lineWidth=1.3;ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor="#ff9a4a";
        ctx.fillStyle="#ff7a2a";ctx.beginPath();ctx.moveTo(0,13);ctx.lineTo(6,13);ctx.quadraticCurveTo(10,27,7,39);ctx.lineTo(1,40);ctx.quadraticCurveTo(0,27,0,13);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;ctx.fillStyle="#ffe0b0";ctx.fillRect(1,17,5,1.4);ctx.fillRect(1.5,23,4.5,1.4);ctx.fillRect(2,30,4,1.4);ctx.restore();
        ctx.restore();
      }
      /* ===== 实体等离子匕首(刀刃朝 +x·握把在原点) ===== */
      function drawDagger(cx,cy,s,rot,a){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        ctx.fillStyle="#2b2f38";rr(-20,-3.5,17,7,2.5);ctx.fill();ctx.strokeStyle="#454b57";ctx.lineWidth=1;ctx.stroke();
        ctx.strokeStyle="#1a1d22";ctx.lineWidth=1;
        for(var w=0;w<3;w++){ctx.beginPath();ctx.moveTo(-17+w*4,-3.5);ctx.lineTo(-15+w*4,3.5);ctx.stroke();}
        ctx.fillStyle="#3a3f4a";ctx.beginPath();ctx.arc(-21,0,3,0,6.28);ctx.fill();
        ctx.fillStyle="#4a505c";rr(-4,-7,5,14,1.5);ctx.fill();
        var dbg=ctx.createLinearGradient(0,-6,0,6);dbg.addColorStop(0,"#8a93a3");dbg.addColorStop(.5,"#cfd6e0");dbg.addColorStop(1,"#6a7280");
        ctx.fillStyle=dbg;ctx.beginPath();ctx.moveTo(1,-5);ctx.lineTo(30,-3);ctx.lineTo(43,0);ctx.lineTo(30,3);ctx.lineTo(1,5);ctx.closePath();ctx.fill();
        ctx.save();ctx.shadowBlur=10;ctx.shadowColor="#5ad8ff";ctx.strokeStyle="#a8ecff";ctx.lineWidth=1.6;
        ctx.beginPath();ctx.moveTo(1,-5);ctx.lineTo(30,-3);ctx.lineTo(43,0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(1,5);ctx.lineTo(30,3);ctx.lineTo(43,0);ctx.stroke();ctx.restore();
        ctx.strokeStyle="rgba(90,216,255,.5)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(2,0);ctx.lineTo(39,0);ctx.stroke();
        ctx.restore();
      }

      /* 枪姿态: 握把支点在 boss 左上·枪管指向勇者血条 */
      var GS=1.05*sz;
      var gpivX=bx-br.width*0.20, gpivY=by-br.height*0.04;
      var aimAng=Math.atan2(tgtY-gpivY, tgtX-gpivX);
      /* 本地点(lx,ly)经 旋转ang+缩放s 映射到世界坐标 */
      function ptAt(px,py,ang,s,lx,ly){ return {x:px+s*(lx*Math.cos(ang)-ly*Math.sin(ang)), y:py+s*(lx*Math.sin(ang)+ly*Math.cos(ang))}; }

      var bolts=[], sparks=[], rings=[], shards=[], beams=[], shells=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var T_RAISE_DUR=440, T_LOCK_DONE=680, T_BARRAGE=760, T_BARRAGE_END=1680, T_DASH=1740, T_SLASH=1900, T_SLASH2=2030, T_EXEC_CHARGE=2320, T_EXEC_FIRE=2880, T_END=3540;
      var nextBolt=0, execCharge=0, didExecFire=false, gunRecoil=0, _raiseP=0;
      var dashDone=false, slashDone=false, slash2Done=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}

      /* 枪当前瞄准角(举枪→瞄准→匕首幕下摆→处决幕回位) */
      function curAng(){
        var base=aimAng;
        if(t<T_LOCK_DONE){ base=aimAng+0.5*(1-_raiseP); }
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ var dp=Math.min(1,(t-T_DASH)/240); base=aimAng+0.72*dp; }
        else if(t>=T_EXEC_CHARGE){ var ep=Math.min(1,(t-T_EXEC_CHARGE)/300); base=aimAng+0.72*(1-ep); }
        return base;
      }
      function gunX(){ var k=gunRecoil*8*sz; return gpivX - Math.cos(curAng())*k; }
      function gunY(){ var k=gunRecoil*8*sz; return gpivY - Math.sin(curAng())*k; }
      function gunAlpha(){
        if(t<60) return Math.min(1,t/60*_raiseP*1.4);
        if(t<T_LOCK_DONE) return Math.min(1,_raiseP*1.5);
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ return Math.max(0.18,1-(t-T_DASH)/240*0.82); }
        return 1;
      }
      /* 从真实枪口发射爆能弹 + 枪口闪 + 抛壳 + 后坐 */
      function fireBolt(){
        var ang=curAng(), mz=ptAt(gunX(),gunY(),ang,GS,97,-1);
        var spd=RND(15,19)*sp;
        bolts.push({x:mz.x,y:mz.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,col:C_ORANGE,w:3*sz,life:0,trail:[],hit:false});
        rings.push({x:mz.x,y:mz.y,r:2,vr:1.3,w:2*sz,col:C_ORANGE,life:0,max:110,muzzle:true});
        var ej=ptAt(gunX(),gunY(),ang,GS,2,-7);
        shells.push({x:ej.x,y:ej.y,vx:Math.cos(ang-1.7)*RND(1.5,3),vy:Math.sin(ang-1.7)*RND(1.5,3)-RND(1,2),rot:Math.random()*6.28,vrot:RND(-0.4,0.4),life:0,max:600});
        gunRecoil=1;
      }
      /* 幕①锁定 HUD(扫描线从枪口·锁定框+旋转刻度环+LOCKED) */
      function drawLockHUD(pr){
        var mz=ptAt(gunX(),gunY(),curAng(),GS,97,-1);
        if(pr<0.6){
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha=(0.6-pr)*1.3;
          ctx.strokeStyle=g(C_GOLD+',1');ctx.lineWidth=1.4;ctx.setLineDash([9,7]);ctx.lineDashOffset=-t*0.05;
          ctx.beginPath();ctx.moveTo(mz.x,mz.y);ctx.lineTo(tgtX,tgtY);ctx.stroke();ctx.setLineDash([]);ctx.restore();
        }
        var box=(1-Math.min(1,pr*1.35))*54+46, cn=17*sz;
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.strokeStyle=g(C_GOLD+','+Math.min(1,pr*2));ctx.lineWidth=2.6*sz;ctx.lineCap='square';ctx.shadowBlur=10;ctx.shadowColor=g(C_GOLD+',1');
        var corners=[[-1,-1],[1,-1],[-1,1],[1,1]];
        for(var ci=0;ci<4;ci++){var cc=corners[ci];var cx2=tgtX+cc[0]*box,cy2=tgtY+cc[1]*box*0.6;
          ctx.beginPath();ctx.moveTo(cx2,cy2+cc[1]*cn);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2-cc[0]*cn,cy2);ctx.stroke();}
        ctx.translate(tgtX,tgtY);ctx.rotate(t*0.002);
        var R=box*0.92;
        ctx.strokeStyle=g(C_GOLD+',0.6');ctx.lineWidth=1.6*sz;
        for(var k=0;k<3;k++){ctx.beginPath();var a0=k*2.09+0.3;ctx.arc(0,0,R,a0,a0+1.15);ctx.stroke();}
        ctx.strokeStyle=g(C_GOLD+',0.4');ctx.lineWidth=1;
        for(var m=0;m<24;m++){var a=m/24*6.28,r1=R+3*sz,r2=R+(m%6===0?10:5)*sz;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);ctx.stroke();}
        ctx.restore();
        if(pr>0.72){
          var fa=(pr-0.72)*3.5;
          ctx.save();ctx.globalCompositeOperation='lighter';ctx.translate(tgtX,tgtY);
          ctx.strokeStyle=g(C_GOLD+','+fa);ctx.lineWidth=1.6*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_GOLD+',1');
          ctx.beginPath();ctx.moveTo(-11*sz,0);ctx.lineTo(11*sz,0);ctx.moveTo(0,-9*sz);ctx.lineTo(0,9*sz);ctx.stroke();
          ctx.fillStyle=g(C_GOLD+','+fa);ctx.font='bold '+(9*sz)+'px monospace';ctx.textAlign='center';
          ctx.fillText('\u25c6 TARGET LOCKED \u25c6',0,-box*0.6-11*sz);ctx.restore();
        }
      }
      /* 幕③匕首交叉斩: 生成等离子斩光 */
      function doSlash(rotAng){ beams.push({slash:true,x:tgtX,y:tgtY,rot:rotAng,life:0,max:210,col:C_PLASMA}); spawnSpark(tgtX,tgtY,'255,255,255',8,6); }
      /* 幕③实体匕首两次穿越勇者(冷兵器斩) */
      function drawDaggerDash(){
        var w1s=T_SLASH-120,w1d=280,w2s=T_SLASH2-120,w2d=280;
        function streak(tt,A){ var L=125*sz,dx=Math.cos(A)*L,dy=Math.sin(A)*L;
          var x=tgtX-dx+2*dx*tt,y=tgtY-dy+2*dy*tt;
          var a=1;if(tt<0.14)a=tt/0.14;else if(tt>0.82)a=(1-tt)/0.18;
          drawDagger(x,y,1.55*sz,A,a); }
        if(t>=w1s&&t<w1s+w1d){streak((t-w1s)/w1d,-0.6);}
        else if(t>=w2s&&t<w2s+w2d){streak((t-w2s)/w2d,0.5);}
      }
      /* 幕④处决贯穿炮: 从真实枪口轰出 */
      function launchExecBeam(){
        didExecFire=true;
        var ang=curAng(), mz=ptAt(gunX(),gunY(),ang,GS,97,-1);
        var len=Math.hypot(tgtX-mz.x,tgtY-mz.y)+40;
        beams.push({sx:mz.x,sy:mz.y,ang:ang,len:len,life:0,max:420});
        setTimeout(function(){
          if(dead)return; fireDeal();
          spawnRing(tgtX,tgtY,C_GOLD,0.9,5*sz); spawnRing(tgtX,tgtY,C_ORANGE,0.6,3*sz);
          spawnShards(tgtX,tgtY,C_ORANGE,16); spawnSpark(tgtX,tgtY,'255,255,255',20,9);
          sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:180,sz:40*sz,flash:true});
        },140/sp);
      }
      /* 幕④枪口聚能球(吸入粒子) */
      function drawExecCharge(pr){
        var mz=ptAt(gunX(),gunY(),curAng(),GS,97,-1);
        var R=pr*20*sz;
        var gr=ctx.createRadialGradient(mz.x,mz.y,0,mz.x,mz.y,R);
        gr.addColorStop(0,g('255,255,255,'+pr));gr.addColorStop(.4,g(C_ORANGE+','+pr));gr.addColorStop(1,g(C_ORANGE+',0'));
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(mz.x,mz.y,R,0,6.28);ctx.fill();
        if(Math.random()>0.35){var a=Math.random()*6.28,d=48*sz;sparks.push({x:mz.x+Math.cos(a)*d,y:mz.y+Math.sin(a)*d,vx:0,vy:0,col:C_ORANGE,life:0,max:200,sz:2*sz,suck:{x:mz.x,y:mz.y}});}
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5600);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          _raiseP=Math.min(1,t/T_RAISE_DUR);
          if(t>=T_BARRAGE&&t<T_BARRAGE_END&&t>=nextBolt){ fireBolt(); nextBolt=t+RND(60,86)/sp; }
          if(!dashDone&&t>=T_DASH){dashDone=true;
            if(bsEl){try{bsEl.animate([{transform:'translateX(0) scale(1)'},{transform:'translateX(14px) scale(1.05)',offset:.4},{transform:'translateX(0) scale(1)'}],{duration:420/sp});}catch(e){}}
          }
          if(!slashDone&&t>=T_SLASH){slashDone=true; doSlash(-0.6); fireDeal();}
          if(!slash2Done&&t>=T_SLASH2){slash2Done=true; doSlash(0.5);}
          if(t>=T_EXEC_CHARGE&&t<T_EXEC_FIRE){execCharge=Math.min(1,(t-T_EXEC_CHARGE)/(T_EXEC_FIRE-T_EXEC_CHARGE));}
          if(!didExecFire&&t>=T_EXEC_FIRE){launchExecBeam();}
          if(t>T_END&&bolts.length===0&&beams.length===0&&sparks.length<3){running=false;}
        }
        gunRecoil=Math.max(0,gunRecoil-dt/90);
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体武器(source-over 底) ===== */
        ctx.globalCompositeOperation='source-over';
        if(gunAlpha()>0.01){ drawCarbine(gunX(),gunY(),GS,curAng(),gunAlpha()); }
        if(t>=T_DASH&&t<T_EXEC_CHARGE){ drawDaggerDash(); }
        for(var shi=shells.length-1;shi>=0;shi--){var sh=shells[shi];sh.life+=dt;sh.vy+=0.4;sh.x+=sh.vx;sh.y+=sh.vy;sh.rot+=sh.vrot;var shpr=sh.life/sh.max;if(shpr>=1||sh.y>clipBottom){shells.splice(shi,1);continue;}
          ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.rot);ctx.fillStyle=g('224,176,80,'+(1-shpr));ctx.fillRect(-1.5*sz,-3*sz,3*sz,6*sz);ctx.restore();}

        /* ===== 幕①锁定 HUD ===== */
        if(t<T_LOCK_DONE+200){ drawLockHUD(Math.min(1,t/T_LOCK_DONE)); }

        /* ===== 能量/火花层(lighter 叠加) ===== */
        ctx.globalCompositeOperation='lighter';
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          if(bm.slash){
            var env=Math.sin(bpr*Math.PI);
            ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(bm.rot);
            var slen=115*sz*env;
            var gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.5,g(bm.col+',0.5'));gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=20*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
            gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.45,'rgba(255,255,255,1)');gg.addColorStop(.55,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
            ctx.strokeStyle=gg;ctx.lineWidth=(6-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
            ctx.restore();
          } else {
            var env2=bpr<0.25?bpr/0.25:(1-(bpr-0.25)/0.75);
            ctx.save();ctx.translate(bm.sx,bm.sy);ctx.rotate(bm.ang);ctx.shadowBlur=20;ctx.shadowColor=g(C_ORANGE+',1');
            var gg2=ctx.createLinearGradient(0,-30*sz,0,30*sz);gg2.addColorStop(0,g(C_ORANGE+',0'));gg2.addColorStop(.5,g(C_ORANGE+','+(0.5*env2)));gg2.addColorStop(1,g(C_ORANGE+',0'));
            ctx.fillStyle=gg2;ctx.fillRect(0,-30*sz*env2,bm.len,60*sz*env2);
            gg2=ctx.createLinearGradient(0,-11*sz,0,11*sz);gg2.addColorStop(0,g(C_ORANGE+',0'));gg2.addColorStop(.5,g('255,220,150,'+env2));gg2.addColorStop(1,g(C_ORANGE+',0'));
            ctx.fillStyle=gg2;ctx.fillRect(0,-11*sz*env2,bm.len,22*sz*env2);
            ctx.shadowBlur=0;ctx.fillStyle=g('255,255,255,'+env2);ctx.fillRect(0,-4*sz*env2,bm.len,8*sz*env2);
            ctx.restore();
          }
        }
        for(var i=bolts.length-1;i>=0;i--){var b=bolts[i];b.life+=dt;b.x+=b.vx*dt*0.06;b.y+=b.vy*dt*0.06;
          b.trail.push({x:b.x,y:b.y});if(b.trail.length>8)b.trail.shift();
          if(!b.hit&&Math.hypot(b.x-tgtX,b.y-tgtY)<24*sz){b.hit=true;
            spawnSpark(b.x,b.y,C_ORANGE,6,7);spawnRing(tgtX,tgtY,C_ORANGE,0.8,2*sz);
            if(t>T_BARRAGE+200)fireDeal(); bolts.splice(i,1);continue;}
          if(b.x<-40||b.x>vw+40||b.y>clipBottom+40){bolts.splice(i,1);continue;}
          for(var ti=0;ti<b.trail.length;ti++){var kk=ti/b.trail.length;ctx.fillStyle=g(b.col+','+(kk*0.5));ctx.beginPath();ctx.arc(b.trail[ti].x,b.trail[ti].y,b.w*kk,0,6.28);ctx.fill();}
          ctx.shadowBlur=10;ctx.shadowColor=g(b.col+',1');
          var bg=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.w*1.6);bg.addColorStop(0,'rgba(255,255,255,1)');bg.addColorStop(.5,g(b.col+',1'));bg.addColorStop(1,g(b.col+',0'));
          ctx.fillStyle=bg;ctx.beginPath();ctx.arc(b.x,b.y,b.w*1.6,0,6.28);ctx.fill();ctx.shadowBlur=0;
        }
        if(t>=T_EXEC_CHARGE&&t<T_EXEC_FIRE){ drawExecCharge(execCharge); }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');
          ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var si=sparks.length-1;si>=0;si--){var s=sparks[si];s.life+=dt;
          if(s.suck){var dx=s.suck.x-s.x,dy=s.suck.y-s.y;s.x+=dx*0.14;s.y+=dy*0.14;if(Math.hypot(dx,dy)<6){sparks.splice(si,1);continue;}}
          else if(s.flash){}
          else{s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(si,1);continue;}
          if(s.flash){var fg=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg.addColorStop(0,g('255,255,255,'+(1-spr)));fg.addColorStop(.5,g(C_ORANGE+','+((1-spr)*0.7)));fg.addColorStop(1,g(C_ORANGE+',0'));ctx.fillStyle=fg;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2900)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }


'''

s2=s[:i]+NEW+s[j:]
open(P,'w',encoding='utf-8').write(s2)
print('done  old_len=%d  new_len=%d  removed=%d  added=%d'%(len(s), len(s2), j-i, len(NEW)))
