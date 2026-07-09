import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak6.js')

FN_ANCHOR='  function hbaSoulAbyss(bsEl,hx,barL,barW,midY,barBot,fx,deal){'
FN=r'''  /* ─────────── 机械主教·组装者 → 全功率复产(星海第一星域·实体机械) ─────────── */
  /* 🔴 v869 新建(Hansen 定稿·实体机械造物): 全程 canvas 画出的【红独眼 + 多段机械臂(液压冲压头) + 流水线组装小兵】当主角, 不是光点。
     四幕: ①独眼激活扫描锁定(红扫描线+锁定框) ②流水线组装(传送带+机械臂组装小兵→launch 扑向勇者) ③机械臂液压冲压(巨臂砸落冲击)+独眼激光切割(红激光横扫) ④全功率复产(小兵成群涌出+连续冲压+独眼过载红光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。机械实体 source-over, 激光/火花/冲击 lighter 叠其上。 */
  function hbaAssembler(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_RED='255,58,42', C_REDDK='224,42,26', C_AMBER='255,176,32', C_LASER='255,48,32';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      function drawEye(cx,cy,r){
        ctx.save();ctx.translate(cx,cy);
        var hg=ctx.createRadialGradient(-r*0.3,-r*0.3,r*0.5,0,0,r*1.15);hg.addColorStop(0,"#565d6b");hg.addColorStop(1,"#22252b");
        ctx.fillStyle=hg;ctx.beginPath();ctx.arc(0,0,r*1.15,0,6.28);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle="#161a20";for(var i=0;i<8;i++){var a=i/8*6.28;ctx.beginPath();ctx.arc(Math.cos(a)*r*1.0,Math.sin(a)*r*1.0,r*0.09,0,6.28);ctx.fill();}
        var ig=ctx.createRadialGradient(0,0,0,0,0,r);ig.addColorStop(0,"#ff6a5a");ig.addColorStop(.5,"#e02a1a");ig.addColorStop(1,"#5a1008");
        ctx.save();ctx.shadowBlur=16;ctx.shadowColor="#ff3a2a";ctx.fillStyle=ig;ctx.beginPath();ctx.arc(0,0,r*0.82,0,6.28);ctx.fill();ctx.restore();
        ctx.strokeStyle="rgba(120,20,10,.6)";ctx.lineWidth=1;for(var j=0;j<16;j++){var a2=j/16*6.28;ctx.beginPath();ctx.moveTo(Math.cos(a2)*r*0.3,Math.sin(a2)*r*0.3);ctx.lineTo(Math.cos(a2)*r*0.78,Math.sin(a2)*r*0.78);ctx.stroke();}
        ctx.fillStyle="#0a0505";ctx.beginPath();ctx.arc(0,0,r*0.3,0,6.28);ctx.fill();
        ctx.save();ctx.shadowBlur=12;ctx.shadowColor="#ff5a4a";ctx.fillStyle="#ffece0";ctx.beginPath();ctx.arc(0,0,r*0.12,0,6.28);ctx.fill();ctx.restore();
        ctx.fillStyle="rgba(255,255,255,.5)";ctx.beginPath();ctx.arc(-r*0.28,-r*0.28,r*0.1,0,6.28);ctx.fill();
        ctx.restore();
      }
      function drawSeg(x1,y1,x2,y2,wd){
        var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),ang=Math.atan2(dy,dx);
        ctx.save();ctx.translate(x1,y1);ctx.rotate(ang);
        var gd=ctx.createLinearGradient(0,-wd/2,0,wd/2);gd.addColorStop(0,"#2c303a");gd.addColorStop(.35,"#5a6270");gd.addColorStop(.6,"#3e444e");gd.addColorStop(1,"#22252b");
        ctx.fillStyle=gd;rr(0,-wd/2,L,wd,wd*0.35);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="rgba(150,160,175,.35)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L*0.2,-wd*0.18);ctx.lineTo(L*0.8,-wd*0.18);ctx.stroke();
        ctx.restore();
      }
      function joint(x,y,r){
        ctx.save();ctx.translate(x,y);var gd=ctx.createRadialGradient(-r*0.3,-r*0.3,0,0,0,r);gd.addColorStop(0,"#6a7280");gd.addColorStop(1,"#2a2e36");
        ctx.fillStyle=gd;ctx.beginPath();ctx.arc(0,0,r,0,6.28);ctx.fill();ctx.strokeStyle="#565d6b";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#161a20";ctx.beginPath();ctx.arc(0,0,r*0.4,0,6.28);ctx.fill();ctx.restore();
      }
      function drawPress(hx2,hy2,ang,s){
        ctx.save();ctx.translate(hx2,hy2);ctx.rotate(ang);
        ctx.fillStyle="#3e444e";rr(-6*s,-5*s,14*s,10*s,2);ctx.fill();
        var gd=ctx.createLinearGradient(0,-15*s,0,15*s);gd.addColorStop(0,"#565d6b");gd.addColorStop(.5,"#3a3f4a");gd.addColorStop(1,"#24272e");
        ctx.fillStyle=gd;rr(6*s,-15*s,20*s,30*s,3);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#ffb020";for(var i=0;i<3;i++){ctx.save();ctx.translate(11*s+i*5.5*s,0);ctx.rotate(0.5);ctx.fillRect(-1.6*s,-14*s,3.2*s,28*s);ctx.restore();}
        ctx.restore();
      }
      function drawArm(sx,sy,hx2,hy2,s){
        var dx=hx2-sx,dy=hy2-sy,len=Math.hypot(dx,dy)||1,px=-dy/len,py=dx/len;
        var mx=(sx+hx2)/2,my=(sy+hy2)/2,ex=mx+px*24*s,ey=my+py*24*s;
        drawSeg(sx,sy,ex,ey,13*s); drawSeg(ex,ey,hx2,hy2,9.5*s);
        joint(sx,sy,11*s); joint(ex,ey,8*s);
        drawPress(hx2,hy2,Math.atan2(hy2-ey,hx2-ex),s);
      }
      function drawBot(cx,cy,s,ang){
        ctx.save();ctx.translate(cx,cy);ctx.rotate(ang||0);ctx.scale(s,s);
        ctx.fillStyle="#2a2e36";ctx.fillRect(-14,-4,5,8);
        var gd=ctx.createLinearGradient(0,-10,0,10);gd.addColorStop(0,"#565d6b");gd.addColorStop(.5,"#3a3f4a");gd.addColorStop(1,"#24272e");
        ctx.fillStyle=gd;rr(-10,-9,22,18,4);ctx.fill();ctx.strokeStyle="#161a20";ctx.lineWidth=1.2;ctx.stroke();
        ctx.strokeStyle="#3a3f4a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-4,9);ctx.lineTo(-6,14);ctx.moveTo(4,9);ctx.lineTo(6,14);ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor="#ff3a2a";var eg=ctx.createRadialGradient(6,0,0,6,0,5);eg.addColorStop(0,"#ffd0c0");eg.addColorStop(.4,"#ff3a2a");eg.addColorStop(1,"#7a1008");ctx.fillStyle=eg;ctx.beginPath();ctx.arc(6,0,4,0,6.28);ctx.fill();ctx.restore();
        ctx.strokeStyle="#565d6b";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-8,-9);ctx.lineTo(-11,-15);ctx.stroke();ctx.fillStyle="#ff3a2a";ctx.beginPath();ctx.arc(-11,-15,1.5,0,6.28);ctx.fill();
        ctx.restore();
      }
      function drawConveyor(a){
        var cy=convY, x1=bx-br.width*0.46, x2=bx+br.width*0.46, w=x2-x1;
        ctx.save();ctx.globalAlpha=a;
        ctx.fillStyle="#1e222a";rr(x1,cy-7*sz,w,14*sz,3);ctx.fill();ctx.strokeStyle="#3a3f4a";ctx.lineWidth=1.4;ctx.stroke();
        ctx.fillStyle="#2e343e";var off=(t*0.05*sz)%(14*sz);
        for(var tx=x1+off;tx<x2;tx+=14*sz){ ctx.fillRect(tx,cy-6*sz,6*sz,12*sz); }
        ctx.restore();
      }

      var eyeR=Math.max(24,Math.min(44,br.width*0.15))*sz, eyeX=bx, eyeY=by-br.height*0.10;
      var shoulderX=bx+br.width*0.16, shoulderY=by-br.height*0.26, convY=by+br.height*0.34;
      var minions=[], sparks=[], rings=[], shards=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var eyeA=0;
      var T_SCAN_END=820, T_PRESS=2000, T_LASER=2360, T_LASER_END=2620, T_OVERLOAD=2680, T_END=4200;
      var slams=[2000,2760,2960,3160,3360], slamFired={};
      var spawnPlan=[[920,360],[1240,360],[1560,360],[2760,240],[2920,240],[3080,240],[3240,240],[3400,240],[3560,240]], spawned={};

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}
      function spawnMinion(spotX,launchDelay){ minions.push({x:spotX,y:convY,phase:0,born:t,launchAt:t+launchDelay,vx:0,vy:0,rot:0,hit:false}); }
      function pressImpact(){
        fireDeal();
        rings.push({x:tgtX,y:tgtY,r:2,vr:1.4,w:5*sz,col:C_AMBER,life:0,max:360});
        rings.push({x:tgtX,y:tgtY,r:2,vr:0.9,w:3*sz,col:C_RED,life:0,max:320});
        spawnShards(tgtX,tgtY,C_AMBER,14); spawnSpark(tgtX,tgtY,'255,255,255',14,9);
        sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:190,sz:38*sz,flash:true,fcol:C_AMBER});
      }
      function lerp(a,b,e){return {x:a.x+(b.x-a.x)*e, y:a.y+(b.y-a.y)*e};}
      function armHand(){
        var raised={x:shoulderX-6*sz, y:shoulderY+72*sz}, heroP={x:tgtX, y:tgtY-12*sz};
        for(var i=0;i<slams.length;i++){ var st=slams[i]; if(t>=st&&t<st+300){ var p=(t-st)/300;
          if(p<0.4){ var e=p/0.4; e=e*e; return lerp(raised,heroP,e); } else { var e2=(p-0.4)/0.6; return lerp(heroP,raised,e2); } } }
        if(t>=880&&t<1900){ return {x:bx+Math.sin(t*0.006)*br.width*0.26, y:convY-36*sz+Math.sin(t*0.02)*6*sz}; }
        if(t>=T_OVERLOAD&&t<T_END){ return {x:bx+Math.sin(t*0.01)*br.width*0.2, y:convY-42*sz}; }
        return raised;
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },6000);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          eyeA=Math.min(1,t/220);
          for(var pi=0;pi<spawnPlan.length;pi++){ if(!spawned[pi]&&t>=spawnPlan[pi][0]){spawned[pi]=true; var spotX=bx+RND(-0.34,0.34)*br.width; spawnMinion(spotX,spawnPlan[pi][1]);} }
          for(var i=0;i<slams.length;i++){ if(!slamFired[i]&&t>=slams[i]+120){slamFired[i]=true; pressImpact();} }
          if(t>=T_LASER&&t<T_LASER_END&&!dealt&&t>T_LASER+80){ /* 激光也可判定 */ }
          if(t>T_END&&minions.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&minions.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体机械(source-over) ===== */
        ctx.globalCompositeOperation='source-over';
        if((t>=760&&t<1900)||(t>=T_OVERLOAD&&t<T_END)){ drawConveyor(0.9); }
        // 机械臂(扫描幕后出现)
        if(t>=T_SCAN_END-120){ var hnd=armHand(); drawArm(shoulderX,shoulderY,hnd.x,hnd.y,sz); }
        // 红独眼
        if(eyeA>0.01){ ctx.save();ctx.globalAlpha=eyeA;drawEye(eyeX,eyeY,eyeR);ctx.restore(); }
        // 小兵(组装/飞行)
        for(var mi=minions.length-1;mi>=0;mi--){var m=minions[mi];
          if(m.phase===0){ var ap=(t-m.born)/(m.launchAt-m.born); if(ap>1)ap=1;
            if(t>=m.launchAt){ m.phase=1; var a=Math.atan2(tgtY-m.y,tgtX-m.x); var s2=RND(6,9)*sz; m.vx=Math.cos(a)*s2; m.vy=Math.sin(a)*s2; m.rot=a; }
            var parts=[[-18,-14],[16,-16],[-16,14],[18,12]];
            for(var q=0;q<4;q++){ var pe=Math.min(1,ap*1.3); var qx=m.x+parts[q][0]*(1-pe), qy=m.y+parts[q][1]*(1-pe);
              ctx.fillStyle=g('96,106,122,'+(0.55+0.4*pe));ctx.save();ctx.translate(qx,qy);ctx.rotate((1-pe)*3);rr(-3*sz,-2*sz,6*sz,4*sz,1);ctx.fill();ctx.restore(); }
            if(ap>0.5){ ctx.save();ctx.globalAlpha=(ap-0.5)/0.5;drawBot(m.x,m.y,1.4*sz,0);ctx.restore(); }
            if(Math.random()<0.4){ sparks.push({x:m.x+RND(-14,14),y:m.y+RND(-12,12),vx:0,vy:0,col:C_AMBER,life:0,max:200,sz:2*sz}); }
          } else {
            m.x+=m.vx*dt*0.075; m.y+=m.vy*dt*0.075; m.rot=Math.atan2(m.vy,m.vx);
            if(!m.hit&&Math.hypot(m.x-tgtX,m.y-tgtY)<20*sz){ m.hit=true; fireDeal(); rings.push({x:tgtX,y:tgtY,r:2,vr:0.9,w:3*sz,col:C_RED,life:0,max:280}); spawnSpark(m.x,m.y,C_AMBER,6,7); spawnShards(m.x,m.y,'150,160,175',5); minions.splice(mi,1); continue; }
            if(m.x<-40||m.x>vw+40||m.y>clipBottom+40){ minions.splice(mi,1); continue; }
            drawBot(m.x,m.y,1.4*sz,m.rot);
          }
        }

        /* ===== 激光/扫描/火花/冲击(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        // 扫描锁定(act1)
        if(t<T_SCAN_END){ var scp=t/T_SCAN_END;
          var swX=barL+barW*((Math.sin(t*0.014)+1)/2), swY=tgtY;
          ctx.save();ctx.globalAlpha=0.5+0.3*Math.sin(t*0.03);ctx.strokeStyle=g(C_RED+',1');ctx.lineWidth=1.4*sz;ctx.setLineDash([8,6]);ctx.lineDashOffset=-t*0.05;
          ctx.beginPath();ctx.moveTo(eyeX,eyeY+eyeR);ctx.lineTo(swX,swY);ctx.stroke();ctx.setLineDash([]);ctx.restore();
          if(scp>0.4){ var fa=(scp-0.4)*1.6, box=(1-Math.min(1,(scp-0.4)*1.8))*40+40, cn=15*sz;
            ctx.strokeStyle=g(C_RED+','+Math.min(1,fa));ctx.lineWidth=2.4*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_RED+',1');
            var cs=[[-1,-1],[1,-1],[-1,1],[1,1]];
            for(var ci=0;ci<4;ci++){var cc=cs[ci];var cx2=tgtX+cc[0]*box,cy2=tgtY+cc[1]*box*0.6;ctx.beginPath();ctx.moveTo(cx2,cy2+cc[1]*cn);ctx.lineTo(cx2,cy2);ctx.lineTo(cx2-cc[0]*cn,cy2);ctx.stroke();}
            ctx.shadowBlur=0;
          }
        }
        // 独眼激光切割(act3)
        if(t>=T_LASER&&t<T_LASER_END){ var lp=(t-T_LASER)/(T_LASER_END-T_LASER);
          var endX=barL+barW*lp, endY=tgtY, ex0=eyeX, ey0=eyeY+eyeR*0.4;
          ctx.save();ctx.shadowBlur=14;ctx.shadowColor=g(C_LASER+',1');
          var lg=ctx.createLinearGradient(ex0,ey0,endX,endY);lg.addColorStop(0,g(C_LASER+',0.5'));lg.addColorStop(1,g(C_LASER+',0.9'));
          ctx.strokeStyle=lg;ctx.lineWidth=5*sz;ctx.beginPath();ctx.moveTo(ex0,ey0);ctx.lineTo(endX,endY);ctx.stroke();
          ctx.strokeStyle=g('255,220,210,0.95');ctx.lineWidth=1.8*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(ex0,ey0);ctx.lineTo(endX,endY);ctx.stroke();
          ctx.restore();
          if(Math.random()<0.7){ spawnSpark(endX,endY,C_LASER,3,6); }
          if(!dealt&&lp>0.2)fireDeal();
        }
        // 独眼过载红光(act4)
        if(t>=T_OVERLOAD&&t<T_END){ var pv=0.3+0.2*Math.sin(t*0.02);
          var og=ctx.createRadialGradient(eyeX,eyeY,0,eyeX,eyeY,eyeR*2.4);og.addColorStop(0,g(C_RED+','+pv));og.addColorStop(1,g(C_RED+',0'));
          ctx.fillStyle=og;ctx.beginPath();ctx.arc(eyeX,eyeY,eyeR*2.4,0,6.28);ctx.fill();
        }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var pi2=sparks.length-1;pi2>=0;pi2--){var s=sparks[pi2];s.life+=dt;
          if(!s.flash){s.vy+=0.012*dt*sz;s.x+=s.vx*dt*0.06;s.y+=s.vy*dt*0.06;s.vx*=0.99;}
          var spr=s.life/s.max;if(spr>=1){sparks.splice(pi2,1);continue;}
          if(s.flash){var fcol=s.fcol||C_AMBER;var fg2=ctx.createRadialGradient(s.x,s.y,0,s.x,s.y,s.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.8)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(s.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(s.col+',1');ctx.beginPath();ctx.arc(s.x,s.y,s.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||3000)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

'''
i=s.find(FN_ANCHOR); assert i>=0,'FN anchor fail'
s=s[:i]+FN+s[i:]

DISP_ANCHOR='      hbaExileBlade(bs, ebHX, ebL, ebW, ebMY, ebBB, fx, deal);\n      return;\n    }\n'
DISP=r'''    if(t==='assembler'){
      var asbar=document.querySelector('.hero-hp-bar'), asL,asW,asMY,asHX,asBB;
      if(asbar){ var asr=asbar.getBoundingClientRect(); asL=bc.x-asr.width/2;asW=asr.width;asMY=asr.top+asr.height*0.5;asHX=bc.x;asBB=asr.bottom; }
      else { asL=hc.x-60;asW=120;asMY=hc.y;asHX=hc.x;asBB=hc.y+6; }
      hbaAssembler(bs, asHX, asL, asW, asMY, asBB, fx, deal);
      return;
    }
'''
k=s.find(DISP_ANCHOR); assert k>=0,'DISP anchor fail'
k2=k+len(DISP_ANCHOR); s=s[:k2]+DISP+s[k2:]

FX_ANCHOR="'\u661f\u9668\u6b66\u58eb\u00b7\u6d41\u4ea1\u4e4b\u5203':{t:'exileblade',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2800},"
FXE="\n'\u673a\u68b0\u4e3b\u6559\u00b7\u7ec4\u88c5\u8005':{t:'assembler',sz:1.0,sp:1.0,fxi:1.0,dealDelay:3000}, // \U0001f534 \u661f\u6d77\u7b2c\u4e00\u661f\u57df\u7b2c4\u5173 \u5168\u529f\u7387\u590d\u4ea7: \u7ea2\u72ec\u773c\u626b\u63cf\u9501\u5b9a\u2192\u6d41\u6c34\u7ebf\u7ec4\u88c5\u5c0f\u5175\u6251\u51fb\u2192\u673a\u68b0\u81c2\u6db2\u538b\u51b2\u538b+\u72ec\u773c\u6fc0\u5149\u5207\u5272\u2192\u5168\u529f\u7387\u590d\u4ea7\u6210\u7fa4"
m=s.find(FX_ANCHOR); assert m>=0,'FX anchor fail'
m2=m+len(FX_ANCHOR); s=s[:m2]+FXE+s[m2:]

open(P,'w',encoding='utf-8').write(s)
print('done len=%d'%len(s))
