import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak8b.js')
START='  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u661f\u9668\u6b66\u58eb\u00b7\u6d41\u4ea1\u4e4b\u5203 \u2192 \u661f\u9668\u8fde\u65a9(\u661f\u6d77\u7b2c\u4e00\u661f\u57df\u00b7\u5b9e\u4f53\u5251\u5ba2) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */'
END='  /* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 \u673a\u68b0\u4e3b\u6559\u00b7\u7ec4\u88c5\u8005 \u2192 \u5168\u529f\u7387\u590d\u4ea7(\u661f\u6d77\u7b2c\u4e00\u661f\u57df\u00b7\u5b9e\u4f53\u673a\u68b0) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */'
i=s.find(START); j=s.find(END)
assert i>=0 and j>i, ('anchor fail',i,j)

NEW=r'''  /* ─────────── 星陨武士·流亡之刃 → 星陨连斩(星海第一星域·实体剑客) ─────────── */
  /* 🔴 v869 升级(Hansen 定稿·更强): 实体银蓝光刃剑当主角·星陨武士气质。
     四幕: ①拔剑凝气(剑点燃·星屑环绕聚气·锁定) ②八方闪现突袭(剑瞬移到勇者四面八方·刀光从八方汇聚劈斩·带残影+刀光弧) ③残影乱舞(高频乱斩·光刃银蓝↔暗紫剧烈闪烁·星陨坠落) ④居合·星陨一闪(收剑蓄势凝止→一记居合爆出星形裂斩·星屑碎裂+白光)。
     全屏 canvas·发光 lighter·帧循环·CSS 像素坐标·答题区 clip 到 barBot+18·零震屏。剑/残影 source-over, 刀光/星屑 lighter 叠其上。 */
  function hbaExileBlade(bsEl,hx,barL,barW,midY,barBot,fx,deal){
    try{
      var sz=fx.sz||1, fxi=fx.fxi||1, sp=fx.sp||1;
      var br=bsEl.getBoundingClientRect();
      var bx=br.left+br.width*0.5, by=br.top+br.height*0.5;
      var tgtX=hx, tgtY=midY;
      var clipBottom=barBot+18;
      var pk=__hbaFxCanvasNew(); var ctx=pk.ctx, cv=pk.cv, vw=pk.W, vh=pk.H;
      var C_BLUE='138,180,255', C_PURPLE='168,128,255', C_EDGE='207,228,255', C_STAR='200,232,255';
      function g(a){return 'rgba('+a+')';}
      function RND(a,b){return a+Math.random()*(b-a);}

      function drawSword(cx,cy,s,rot,a,flick){
        ctx.save();ctx.globalAlpha=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(s,s);
        var GLOW=flick>0.5?"#b088ff":"#8ab4ff", EDGE=flick>0.5?"#e0ccff":"#cfe4ff";
        ctx.fillStyle="#3a4048";ctx.beginPath();ctx.arc(-30,0,4,0,6.28);ctx.fill();ctx.strokeStyle="#5a6270";ctx.lineWidth=1;ctx.stroke();
        ctx.fillStyle="#2a2e36";ctx.beginPath();ctx.moveTo(-27,-3.5);ctx.arcTo(-7,-3.5,-7,3.5,2.5);ctx.arcTo(-7,3.5,-27,3.5,2.5);ctx.lineTo(-27,3.5);ctx.closePath();ctx.fill();
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
      var sparks=[], rings=[], shards=[], beams=[], stars=[];
      var t=0,last=0,running=true,dead=false,dealt=false;
      /* ② 八方闪现斩 + ③ 乱舞斩(角度进入函数时随机, 每次施放不同) */
      var slashes=[]; var a8=[-0.5,0.6,-1.15,1.2,-1.95,2.05,-0.15,2.95], qk;
      for(qk=0;qk<8;qk++){ slashes.push({ts:820+qk*84,ang:a8[qk],w:200,fast:false}); }
      for(qk=0;qk<8;qk++){ slashes.push({ts:1640+qk*98,ang:RND(-2.1,2.1),w:172,fast:true}); }
      var T_LOCK=760, T_IAI_CHARGE=2540, T_IAI_STRIKE=2980, IAI_W=420, T_END=3760;
      var fired={}, iaiStruck=false;

      function fireDeal(){ if(dealt)return; dealt=true; deal(); }
      function spawnSpark(x,y,col,n,spd){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(spd*0.4,spd);sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:RND(220,420),sz:RND(1.2,2.8)*sz});}}
      function spawnRing(x,y,col,vr,w){rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:RND(320,480)});}
      function spawnShards(x,y,col,n){for(var i=0;i<n;i++){var a=Math.random()*6.28,v=RND(2,8)*sz;shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.28,vrot:RND(-0.35,0.35),col:col,life:0,max:RND(300,560),sz:RND(2,5)*sz});}}
      function spawnStar(){ stars.push({x:RND(tgtX-190*sz,tgtX+190*sz),y:tgtY-RND(170,340)*sz,vx:RND(-2,2)*sz,vy:RND(7,11)*sz,trail:[],life:0,max:700}); }
      function flickProb(){ return (t>=1600&&t<2540)?0.42:0.18; }

      function slashPass(cx,cy,A,tt,scl){
        var L=142*sz, dx=Math.cos(A)*L, dy=Math.sin(A)*L;
        var echoes=[[0.18,0.16],[0.12,0.26],[0.06,0.42]],e;
        for(e=0;e<echoes.length;e++){ var pe=tt-echoes[e][0]; if(pe<0)continue; var ex=cx-dx+2*dx*pe, ey=cy-dy+2*dy*pe; drawSword(ex,ey,scl,A,echoes[e][1],0); }
        var px=cx-dx+2*dx*tt, py=cy-dy+2*dy*tt;
        var a=1; if(tt<0.12)a=tt/0.12; else if(tt>0.82)a=(1-tt)/0.18;
        drawSword(px,py,scl,A,a,(Math.random()<flickProb())?1:0);
      }
      function drawStance(){
        var ig=t<300?t/300:1;
        drawSword(stX,stY,1.6*sz,stAng,ig,(Math.random()<0.14)?1:0);
        if(t<T_LOCK&&Math.random()<0.6){ var an=Math.random()*6.28, rd=RND(30,80)*sz; sparks.push({x:tgtX+Math.cos(an)*rd,y:tgtY+Math.sin(an)*rd,vx:0,vy:0,col:C_STAR,life:0,max:300,sz:RND(1.4,2.6)*sz,suck:{x:tgtX,y:tgtY}}); }
      }
      /* 居合蓄势: 剑横持勇者侧·凝止蓄光 */
      function drawIaiCharge(pr){
        var cx=tgtX-96*sz, cy=tgtY, R=pr*46*sz;
        ctx.save();ctx.globalCompositeOperation='lighter';
        var gr=ctx.createRadialGradient(cx,cy,0,cx,cy,R);gr.addColorStop(0,g('255,255,255,'+(pr*0.5)));gr.addColorStop(.4,g(C_BLUE+','+(pr*0.5)));gr.addColorStop(1,g(C_BLUE+',0'));
        ctx.fillStyle=gr;ctx.beginPath();ctx.arc(cx,cy,R,0,6.28);ctx.fill();ctx.restore();
        drawSword(cx,cy,1.9*sz,0,1,(Math.random()<0.3)?1:0);
        if(Math.random()<0.7){var an=Math.random()*6.28,d=52*sz;sparks.push({x:cx+Math.cos(an)*d,y:cy+Math.sin(an)*d,vx:0,vy:0,col:C_STAR,life:0,max:200,sz:2*sz,suck:{x:cx,y:cy}});}
      }
      function pushSlashArc(A,col,scl,big){
        beams.push({slash:true,x:tgtX,y:tgtY,rot:A,life:0,max:big?360:240,col:col,scl:scl||1,big:big});
        spawnSpark(tgtX,tgtY,'255,255,255',big?12:6,big?8:6);
      }
      /* 居合·星形裂斩: 多道刀光放射 + 星屑碎裂 + 白光 */
      function iaiStrike(){
        iaiStruck=true; fireDeal();
        var k; for(k=0;k<7;k++){ pushSlashArc(k/7*Math.PI+RND(-0.12,0.12), (k%2?C_PURPLE:C_BLUE), 2.1, true); }
        sparks.push({x:tgtX,y:tgtY,vx:0,vy:0,col:'255,255,255',life:0,max:230,sz:60*sz,flash:true,fcol:C_STAR});
        spawnShards(tgtX,tgtY,C_STAR,28); spawnRing(tgtX,tgtY,C_EDGE,1.4,5*sz); spawnRing(tgtX,tgtY,C_BLUE,0.9,3*sz);
        for(k=0;k<10;k++)spawnStar();
      }
      function done(){ if(dead)return; dead=true; if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }
      var hardKill=setTimeout(function(){ fireDeal(); done(); },5600);

      function frame(ts){
        if(dead)return;
        if(!last){last=ts;} var dt=(ts-last)*sp; last=ts; if(dt>55){dt=55;}
        if(running){
          t+=dt;
          var si; for(si=0;si<slashes.length;si++){ var sl=slashes[si]; if(!fired[si]&&t>=sl.ts+sl.w*0.4){fired[si]=true; pushSlashArc(sl.ang,(Math.random()<0.5?C_BLUE:C_PURPLE),sl.fast?1.05:1.25,false); if(si===0)fireDeal();} }
          if((t>=820&&t<2540)&&Math.random()<0.16){ spawnStar(); }
          if(!iaiStruck&&t>=T_IAI_STRIKE){ iaiStrike(); }
          if(t>T_END&&beams.length===0&&stars.length===0&&sparks.length<3){running=false;}
        }
        if(!running&&sparks.length===0&&rings.length===0&&shards.length===0&&beams.length===0&&stars.length===0){ clearTimeout(hardKill); fireDeal(); done(); return; }

        ctx.clearRect(0,0,vw,vh);
        ctx.save();ctx.beginPath();ctx.rect(0,0,vw,clipBottom);ctx.clip();

        /* ===== 实体剑(source-over) ===== */
        ctx.globalCompositeOperation='source-over';
        var active=-1,ai;
        for(ai=0;ai<slashes.length;ai++){ if(t>=slashes[ai].ts&&t<slashes[ai].ts+slashes[ai].w){active=ai;break;} }
        if(active>=0){ var sa=slashes[active]; slashPass(tgtX,tgtY,sa.ang,(t-sa.ts)/sa.w, sa.fast?1.6*sz:1.7*sz); }
        else if(t>=T_IAI_CHARGE&&t<T_IAI_STRIKE){ drawIaiCharge((t-T_IAI_CHARGE)/(T_IAI_STRIKE-T_IAI_CHARGE)); }
        else if(t>=T_IAI_STRIKE&&t<T_IAI_STRIKE+220){ slashPass(tgtX,tgtY,0.2,(t-T_IAI_STRIKE)/220,2.3*sz); }
        else if(t<T_IAI_STRIKE){ drawStance(); }

        /* ===== 星屑坠落(source-over 拖尾) ===== */
        for(var ri2=stars.length-1;ri2>=0;ri2--){var st=stars[ri2];st.life+=dt;st.x+=st.vx*dt*0.06;st.y+=st.vy*dt*0.06;st.trail.push({x:st.x,y:st.y});if(st.trail.length>7)st.trail.shift();
          if(st.y>clipBottom+20||st.life>st.max){stars.splice(ri2,1);continue;}
          for(var tj=0;tj<st.trail.length;tj++){var kk=tj/st.trail.length;ctx.fillStyle=g(C_STAR+','+(kk*0.45));ctx.beginPath();ctx.arc(st.trail[tj].x,st.trail[tj].y,1.6*sz*kk,0,6.28);ctx.fill();}
          ctx.fillStyle=g('255,255,255,.9');ctx.beginPath();ctx.arc(st.x,st.y,1.8*sz,0,6.28);ctx.fill();
        }

        /* ===== 刀光/星屑碎裂(lighter) ===== */
        ctx.globalCompositeOperation='lighter';
        for(var bi=beams.length-1;bi>=0;bi--){var bm=beams[bi];bm.life+=dt;var bpr=bm.life/bm.max;if(bpr>=1){beams.splice(bi,1);continue;}
          var env=Math.sin(bpr*Math.PI), scl=bm.scl||1;
          ctx.save();ctx.translate(bm.x,bm.y);ctx.rotate(bm.rot);
          var slen=(bm.big?185:126)*sz*scl*env;
          var gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.5,g(bm.col+',0.55'));gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(bm.big?26:18)*sz*env;ctx.lineCap='round';ctx.shadowBlur=16;ctx.shadowColor=g(bm.col+',1');ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          gg=ctx.createLinearGradient(-slen/2,0,slen/2,0);gg.addColorStop(0,g(bm.col+',0'));gg.addColorStop(.45,'rgba(255,255,255,1)');gg.addColorStop(.55,'rgba(255,255,255,1)');gg.addColorStop(1,g(bm.col+',0'));
          ctx.strokeStyle=gg;ctx.lineWidth=(6-bpr*3)*sz;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(-slen/2,0);ctx.lineTo(slen/2,0);ctx.stroke();
          ctx.restore();
        }
        if(t<T_LOCK){ var lp=t/T_LOCK, R=(72-lp*40)*sz;
          ctx.strokeStyle=g(C_BLUE+','+(0.32+lp*0.4));ctx.lineWidth=1.6*sz;ctx.shadowBlur=8;ctx.shadowColor=g(C_BLUE+',1');
          ctx.beginPath();ctx.arc(tgtX,tgtY,R,0,6.28);ctx.stroke();
          for(var m=0;m<8;m++){var a=m/8*6.28+lp*1.2;ctx.beginPath();ctx.moveTo(tgtX+Math.cos(a)*(R+3*sz),tgtY+Math.sin(a)*(R+3*sz));ctx.lineTo(tgtX+Math.cos(a)*(R+9*sz),tgtY+Math.sin(a)*(R+9*sz));ctx.stroke();}
          ctx.shadowBlur=0;
        }
        for(var rri=rings.length-1;rri>=0;rri--){var r=rings[rri];r.life+=dt;r.r+=r.vr*dt*0.06;var rpr=r.life/r.max;if(rpr>=1){rings.splice(rri,1);continue;}
          ctx.strokeStyle=g(r.col+','+((1-rpr)*0.85));ctx.lineWidth=r.w*(1-rpr);ctx.shadowBlur=12;ctx.shadowColor=g(r.col+',1');ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,6.28);ctx.stroke();ctx.shadowBlur=0;}
        for(var pi=sparks.length-1;pi>=0;pi--){var sp2=sparks[pi];sp2.life+=dt;
          if(sp2.suck){var dx=sp2.suck.x-sp2.x,dy=sp2.suck.y-sp2.y;sp2.x+=dx*0.14;sp2.y+=dy*0.14;if(Math.hypot(dx,dy)<6){sparks.splice(pi,1);continue;}}
          else if(sp2.flash){}
          else{sp2.vy+=0.012*dt*sz;sp2.x+=sp2.vx*dt*0.06;sp2.y+=sp2.vy*dt*0.06;sp2.vx*=0.99;}
          var spr=sp2.life/sp2.max;if(spr>=1){sparks.splice(pi,1);continue;}
          if(sp2.flash){var fcol=sp2.fcol||C_BLUE;var fg2=ctx.createRadialGradient(sp2.x,sp2.y,0,sp2.x,sp2.y,sp2.sz*(1-spr*0.3));fg2.addColorStop(0,g('255,255,255,'+(1-spr)));fg2.addColorStop(.4,g(fcol+','+((1-spr)*0.85)));fg2.addColorStop(1,g(fcol+',0'));ctx.fillStyle=fg2;ctx.beginPath();ctx.arc(sp2.x,sp2.y,sp2.sz*(1-spr*0.3),0,6.28);ctx.fill();}
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
s2=s[:i]+NEW+s[j:]
open(P,'w',encoding='utf-8').write(s2)
print('done  removed=%d added=%d'%(j-i,len(NEW)))
