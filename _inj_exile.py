import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak5.js')

# ── 1) 新函数(插在 hbaSoulAbyss 之前) ──
FN_ANCHOR='  function hbaSoulAbyss(bsEl,hx,barL,barW,midY,barBot,fx,deal){'
FN=r'''  /* ─────────── 星陨武士·流亡之刃 → 星陨连斩(星海第一星域·实体剑客) ─────────── */
  /* 🔴 v869 新建(Hansen 定稿·实体武器): 全程 canvas 画出的【实体银蓝光刃剑】当主角·冷兵器剑客。
     四幕: ①拔剑凝气(剑点燃·银蓝光刃聚气·锁定) ②残影突袭(闪现连斩·剑体带斗篷残影错位·多角度斩) ③星陨连斩(高频连斩·光刃不稳定银蓝↔暗紫闪烁) ④决胜一闪(举剑蓄满·一记巨斩贯裂·星屑迸溅)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。剑与残影 source-over 画实体, 斩光/星屑 lighter 叠其上。 */
  function hbaExileBlade(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_BLUE='138,180,255', C_PURPLE='168,128,255', C_EDGE='207,228,255';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}
      function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}

      /* ===== 银蓝光刃剑(刀刃朝 +x·flick=不稳定0银蓝/1暗紫) ===== */
      function drawSword(cx,cy,s,rot,a,flick){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        var GLOW=flick>0.5?"#b088ff":"#8ab4ff", EDGE=flick>0.5?"#e0ccff":"#cfe4ff";
        ctx.fillStyle="#3a4048";ctx.beginPath();ctx.arc(-30,0,4,0,6.28);ctx.fill();ctx.strokeStyle="#5a6270";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#2a2e36";rr(-27,-3.5,20,7,2.5);ctx.fill();
        ctx.strokeStyle="#161a20";ctx.lineWidth=1;for(var w=0;w<4;w++){ctx.beginPath();ctx.moveTo(-24+w*4.5,-3.5);ctx.lineTo(-22+w*4.5,3.5);ctx.stroke();}
        ctx.fillStyle="#5a6472";ctx.beginPath();ctx.moveTo(-9,-13);ctx.quadraticCurveTo(-3,-14,-2,-11);ctx.lineTo(-2,11);ctx.quadraticCurveTo(-3,14,-9,13);ctx.closePath();ctx.fill();
        ctx.strokeStyle="#7a8598";ctx.lineWidth=1;ctx.stroke();
        ctx.save();ctx.shadowBlur=8;ctx.shadowColor=GLOW;ctx.fillStyle=EDGE;ctx.beginPath();ctx.arc(-6,0,2.6,0,6.28);ctx.fill();ctx.restore();
        var bgd=ctx.createLinearGradient(0,-7,0,7);bgd.addColorStop(0,"#b0bacc");bgd.addColorStop(.5,"#eef4fc");bgd.addColorStop(1,"#8a94a4");
        ctx.fillStyle=bgd;ctx.beginPath();ctx.moveTo(-2,-6);ctx.lineTo(80,-4.2);ctx.lineTo(100,0);ctx.lineTo(80,4.2);ctx.lineTo(-2,6);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(150,165,195,.5)";ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(90,0);ctx.stroke();
        ctx.save();ctx.shadowBlur=13;ctx.shadowColor=GLOW;ctx.strokeStyle=EDGE;ctx.lineWidth=1.9;
        ctx.beginPath();ctx.moveTo(-2,-6);ctx.lineTo(80,-4.2);ctx.lineTo(100,0);ctx.stroke();
        ctx.beginPath();ctx.moveTo(-2,6);ctx.lineTo(80,4.2);ctx.lineTo(100,0);ctx.stroke();ctx.restore();
        ctx.restore();
      }

      var stAng=-0.82, stX=bx-br.width*0.06, stY=by+br.height*0.05;
      var sparks=[], rings=[], shards=[], beams=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      var slashes=[
        {ts:820,A:-0.6,w:250},{ts:1080,A:0.5,w:250},{ts:1360,A:-0.2,w:250},
        {ts:1760,A:0.7,w:210},{ts:1950,A:-0.85,w:210},{ts:2130,A:0.35,w:210},{ts:2320,A:-0.45,w:210}
      ];
      var T_LOCK_DONE=680, T_BIGCHARGE=2600, T_BIGSTRIKE=2980, BIG_W=440, T_END=3720;
      var fired={}, bigStruck=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,7)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.3,0.3),col:col,life:0,max:RND(280,520),sz:RND(2,5)*sz});}}
      function flickProb(){ return (t>=1740&&t<2500)?0.3:0.16; }

      /* 一次斩击穿越: 剑体 + 3 层斗篷残影错位 */
      function slashPass(cx,cy,A,tt,scl){
        var L=132*sz, dx=Math.cos(A)*L, dy=Math.sin(A)*L;
        var echoes=[[0.16,0.12],[0.11,0.22],[0.06,0.36]];
        for(var e=0;e<echoes.length;e++){ var pe=tt-echoes[e][0]; if(pe<0)continue; var ex=cx-dx+2*dx*pe, ey=cy-dy+2*dy*pe; drawSword(ex,ey,scl,A,echoes[e][1],0); }
        var px=cx-dx+2*dx*tt, py=cy-dy+2*dy*tt;
        var a=1; if(tt<0.12)a=tt/0.12; else if(tt>0.82)a=(1-tt)/0.18;
        drawSword(px,py,scl,A,a,(Math.random()<flickProb())?1:0);
      }
      function drawStance(){
        var ig=t<300?t/300:1;
        drawSword(stX,stY,1.6*sz,stAng,ig,(Math.random()<0.14)?1:0);
        if(t<T_LOCK_DONE&&Math.random()<0.5){ var bl=RND(10,96)*sz; var bpx=stX+Math.cos(stAng)*bl, bpy=stY+Math.sin(stAng)*bl;
          sparks.push({x:bpx+RND(-26,26),y:bpy+RND(-26,26),vx:0,vy:0,col:C_BLUE,life:0,max:260,sz:2*sz,suck:{x:bpx,y:bpy}}); }
      }
      function drawBigCharge(pr){
        var cx=tgtX, cy=tgtY-100*sz-pr*16*sz, R=pr*40*sz;
        ctx.save();ctx.globalCompositeOperation='lighter';
        var gr=ctx.createRadialGradient(cx,cy,0,cx,cy,R);gr.addColorStop(0,g('255,255,255,'+(pr*0.5)));gr.addColorStop(.4,g(C_BLUE+','+(pr*0.5)));gr.addColorStop(1,g(C_BLUE+',0'));
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,R,0,6.28);ctx.fill();ctx.restore();
        drawSword(cx,cy,2.0*sz,-1.5,1,(Math.random()<0.25)?1:0);
        if(Math.random()<0.6){var a=Math.random()*6.28,d=50*sz;sparks.push({x:cx+Math.cos(a)*d,y:cy+Math.sin(a)*d,vx:0,vy:0,col:C_BLUE,life:0,max:200,sz:2*sz,suck:{x:cx,y:cy}});}
      }
      function pushSlashArc(A,col,scl,big){
        beams.push({slash:true,x:tgtX,y:tgtY,rot:A,life:0,max:big?340:230,col:col,scl:scl||1,big:big});
        spawnSpark(tgtX,tgtY,'255,255,255',big?14:7,big?8:6);
        if(big){ spawnShards(tgtX,tgtY,C_BLUE,16); spawnRing(tgtX,tgtY,C_BLUE,0.9,4*sz); sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:200,sz:42*sz,flash:true,fcol:C_BLUE}); }
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5600);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          for(var si=0;si<slashes.length;si++){ var s=slashes[si]; if(!fired[si]&&t>=s.ts+s.w*0.4){fired[si]=true; pushSlashArc(s.A,(Math.random()<0.5?C_BLUE:C_PURPLE),1.2,false); if(si===0)fireDeal();} }
          if(!bigStruck&&t>=T_BIGSTRIKE){bigStruck=true; pushSlashArc(-0.5,C_BLUE,2.0,true); fireDeal();}
          if(t>T_END&&beams.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体剑(source-over) ===== */
        ctx.globalCompositeOperation='source-over';
        var active=-1;
        for(var ai=0;ai<slashes.length;ai++){ if(t>=slashes[ai].ts&&t<slashes[ai].ts+slashes[ai].w){active=ai;break;} }
        if(active>=0){ var sa=slashes[active]; slashPass(tgtX,tgtY,sa.A,(t-sa.ts)/sa.w,1.7*sz); }
        else if(t>=T_BIGCHARGE&&t<T_BIGSTRIKE){ drawBigCharge((t-T_BIGCHARGE)/(T_BIGSTRIKE-T_BIGCHARGE)); }
        else if(t>=T_BIGSTRIKE&&t<T_BIGSTRIKE+BIG_W){ slashPass(tgtX,tgtY,-0.5,(t-T_BIGSTRIKE)/BIG_W,2.4*sz); }
        else if(t<T_BIGSTRIKE){ drawStance(); }

        /* ===== 斩光/星屑(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          var env=Math.sin(bpr*Math.PI), scl=bm.scl||1;
          ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(bm.rot);
          var slen=(bm.big?175:122)*sz*scl*env;
          var gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.5,g(bm.col+',0.55'));gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(bm.big?26:18)*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.45,'rgba(255,255,255,1)');gg.addColorStop(.55,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(6-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          ctx.restore();
        }
        if(t<T_LOCK_DONE){ var lp=t/T_LOCK_DONE, R=(70-lp*40)*sz;
          ctx.strokeStyle=g(C_BLUE+','+(0.35+lp*0.4));ctx.lineWidth=1.6*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_BLUE+',1');
          ctx.beginPath();ctx.arc(tgtX,tgtY,R,0,6.28);ctx.stroke();
          for(var m=0;m<8;m++){var a=m/8*6.28+lp*1.2;ctx.beginPath();ctx.moveTo(tgtX+Math.cos(a)*(R+3*sz),tgtY+Math.sin(a)*(R+3*sz));ctx.lineTo(tgtX+Math.cos(a)*(R+9*sz),tgtY+Math.sin(a)*(R+9*sz));ctx.stroke();}
          ctx.shadowBlur=0;
        }
        for(var ri=rings.length-1;ri>=0;ri--){var r=rings[ri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(ri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var pi=sparks.length-1;pi>=0;pi--){var sp2=sparks[pi];sp2.life+=dt;
          if(sp2.suck){var dx=sp2.suck.x-sp2.x,dy=sp2.suck.y-sp2.y;sp2.x+=dx*0.14;sp2.y+=dy*0.14;if(Math.hypot(dx,dy)<6){sparks.splice(pi,1);continue;}}
          else if(sp2.flash){}
          else{sp2.vy+=0.012*dt*sz;sp2.x+=sp2.vx*dt*0.06;sp2.y+=sp2.vy*dt*0.06;sp2.vx*=0.99;}
          var spr=sp2.life/sp2.max;if(spr>=1){sparks.splice(pi,1);continue;}
          if(sp2.flash){var fcol=sp2.fcol||C_BLUE;var fg2=ctx.createRadialGradient(sp2.x,sp2.y,0,sp2.x,sp2.y,sp2.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.8)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(sp2.x,sp2.y,sp2.sz*(1-spr*0.3),0,6.28);ctx.fill();}
          else{ctx.fillStyle=g(sp2.col+','+(1-spr));ctx.shadowBlur=6;ctx.shadowColor=g(sp2.col+',1');ctx.beginPath();ctx.arc(sp2.x,sp2.y,sp2.sz*(1-spr*0.5),0,6.28);ctx.fill();ctx.shadowBlur=0;}
        }
        for(var di=shards.length-1;di>=0;di--){var d=shards[di];d.life+=dt;d.vy+=0.02*dt*sz;d.x+=d.vx*dt*0.06;d.y+=d.vy*dt*0.06;d.rot+=d.vrot;var dpr=d.life/d.max;if(dpr>=1){shards.splice(di,1);continue;}
          ctx.save();ctx.translate(d.x,d.y);ctx.rotate(d.rot);ctx.fillStyle=g(d.col+','+(1-dpr));ctx.shadowBlur=5;ctx.shadowColor=g(d.col+',1');ctx.fillRect(-d.sz/2,-d.sz/2,d.sz,d.sz*1.6);ctx.restore();ctx.shadowBlur=0;}

        ctx.globalCompositeOperation='source-over';
        ctx.restore();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      setTimeout(function(){fireDeal();},(fx.dealDelay||2800)/sp);
    }catch(e){ try{deal();}catch(e2){} }
  }

'''
i=s.find(FN_ANCHOR); assert i>=0,'FN anchor fail'
s=s[:i]+FN+s[i:]

# ── 2) 分发(插在 waranvil 分发之后) ──
DISP_ANCHOR='      hbaWarAnvil(bs, waHX, waL, waW, waMY, waBB, fx, deal);\n      return;\n    }\n'
DISP=r'''    if(t==='exileblade'){
      var ebbar=document.querySelector('.hero-hp-bar'), ebL,ebW,ebMY,ebHX,ebBB;
      if(ebbar){ var ebr=ebbar.getBoundingClientRect(); ebL=bc.x-ebr.width/2;ebW=ebr.width;ebMY=ebr.top+ebr.height*0.5;ebHX=bc.x;ebBB=ebr.bottom; }
      else { ebL=hc.x-60;ebW=120;ebMY=hc.y;ebHX=hc.x;ebBB=hc.y+6; }
      hbaExileBlade(bs, ebHX, ebL, ebW, ebMY, ebBB, fx, deal);
      return;
    }
'''
k=s.find(DISP_ANCHOR); assert k>=0,'DISP anchor fail'
k2=k+len(DISP_ANCHOR)
s=s[:k2]+DISP+s[k2:]

# ── 3) FX 表条目(插在 waranvil 条目之后) ──
FX_ANCHOR="'\u6b66\u5668\u5927\u5e08\u00b7\u6218\u4e89\u94c1\u7827':{t:'waranvil',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2600},"
FXE="\n'\u661f\u9668\u6b66\u58eb\u00b7\u6d41\u4ea1\u4e4b\u5203':{t:'exileblade',sz:1.0,sp:1.0,fxi:1.0,dealDelay:2800}, // \U0001f534 \u661f\u6d77\u7b2c\u4e00\u661f\u57df\u7b2c3\u5173 \u661f\u9668\u8fde\u65a9: \u5b9e\u4f53\u94f6\u84dd\u5149\u5203\u5251\u00b7\u62d4\u5251\u51dd\u6c14\u2192\u6b8b\u5f71\u7a81\u88ad\u2192\u9ad8\u9891\u8fde\u65a9(\u94f6\u84dd\u2194\u6697\u7d2b\u95ea)\u2192\u51b3\u80dc\u4e00\u95ea\u5de8\u65a9"
m=s.find(FX_ANCHOR); assert m>=0,'FX anchor fail'
m2=m+len(FX_ANCHOR)
s=s[:m2]+FXE+s[m2:]

open(P,'w',encoding='utf-8').write(s)
print('done len=%d'%len(s))
