/* FXCore —— 新Boss特效工坊共享框架 v1
   与游戏 hansen_boss_attack.js 同规范: 全屏canvas·CSS像素坐标·lighter发光叠加·答题区clip·零震屏。
   每个特效函数签名与游戏一致: fx(bsEl,hx,barL,barW,midY,barBot,fx,deal) —— 满意后可原样移植。 */
window.FXCore=(function(){
  function mkCanvas(){
    var cv=document.createElement('canvas');
    var W=window.innerWidth, H=window.innerHeight;
    var dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=W*dpr; cv.height=H*dpr;
    cv.style.cssText='position:fixed;left:0;top:0;width:'+W+'px;height:'+H+'px;pointer-events:none;z-index:9990';
    var layer=window.__hansenFxLayer||document.body;
    layer.appendChild(cv);
    var ctx=cv.getContext('2d');
    ctx.scale(dpr,dpr);
    return {cv:cv,ctx:ctx,W:W,H:H,kill:function(){ if(cv&&cv.parentNode)cv.parentNode.removeChild(cv); }};
  }
  function g(a){return 'rgba('+a+')';}
  function rnd(a,b){return a+Math.random()*(b-a);}
  function pool(){ return {sparks:[],rings:[],shards:[],beams:[],flashes:[],trails:[]}; }
  function empty(P){ return P.sparks.length===0&&P.rings.length===0&&P.shards.length===0&&P.beams.length===0&&P.flashes.length===0&&P.trails.length===0; }
  /* 生成器 */
  function burst(P,x,y,col,n,spd,s){ for(var i=0;i<n;i++){var a=Math.random()*6.283,v=rnd(spd*0.4,spd);P.sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:rnd(220,460),sz:rnd(1.2,2.8)*s,grav:0.012});} }
  function jet(P,x,y,ang,spread,col,n,spd,s){ for(var i=0;i<n;i++){var a=ang+rnd(-spread,spread),v=rnd(spd*0.5,spd);P.sparks.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,col:col,life:0,max:rnd(180,380),sz:rnd(1.2,2.6)*s,grav:0.01});} }
  function suck(P,x,y,tx,ty,col,s){ P.sparks.push({x:x,y:y,vx:0,vy:0,col:col,life:0,max:400,sz:rnd(1.4,2.8)*s,suck:{x:tx,y:ty}}); }
  function ring(P,x,y,col,vr,w){ P.rings.push({x:x,y:y,r:2,vr:vr,w:w,col:col,life:0,max:rnd(320,500)}); }
  function shards(P,x,y,col,n,s){ for(var i=0;i<n;i++){var a=Math.random()*6.283,v=rnd(2,8)*s;P.shards.push({x:x,y:y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:Math.random()*6.283,vrot:rnd(-0.3,0.3),col:col,life:0,max:rnd(300,560),sz:rnd(2,5)*s});} }
  function beam(P,x,y,rot,col,scl,big){ P.beams.push({x:x,y:y,rot:rot,col:col,scl:scl||1,big:!!big,life:0,max:big?360:240}); }
  function flash(P,x,y,col,r,life){ P.flashes.push({x:x,y:y,col:col,r:r,life:0,max:life||230}); }
  /* 更新+绘制(lighter 阶段调用) */
  function stepDraw(ctx,P,dt,sz){
    var i,p,pr;
    for(i=P.sparks.length-1;i>=0;i--){ p=P.sparks[i]; p.life+=dt;
      if(p.suck){ var dx=p.suck.x-p.x,dy=p.suck.y-p.y; p.x+=dx*0.13; p.y+=dy*0.13; if(Math.hypot(dx,dy)<7){P.sparks.splice(i,1);continue;} }
      else { p.vy+=(p.grav||0)*dt*sz; p.x+=p.vx*dt*0.06; p.y+=p.vy*dt*0.06; p.vx*=0.995; }
      pr=p.life/p.max; if(pr>=1){P.sparks.splice(i,1);continue;}
      ctx.fillStyle=g(p.col+','+(1-pr)); ctx.shadowBlur=6; ctx.shadowColor=g(p.col+',1');
      ctx.beginPath(); ctx.arc(p.x,p.y,Math.max(0.1,p.sz*(1-pr*0.5)),0,6.283); ctx.fill(); ctx.shadowBlur=0;
    }
    for(i=P.rings.length-1;i>=0;i--){ p=P.rings[i]; p.life+=dt; p.r+=p.vr*dt*0.06; pr=p.life/p.max; if(pr>=1){P.rings.splice(i,1);continue;}
      ctx.strokeStyle=g(p.col+','+((1-pr)*0.85)); ctx.lineWidth=Math.max(0.4,p.w*(1-pr)); ctx.shadowBlur=12; ctx.shadowColor=g(p.col+',1');
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,6.283); ctx.stroke(); ctx.shadowBlur=0;
    }
    for(i=P.shards.length-1;i>=0;i--){ p=P.shards[i]; p.life+=dt; p.vy+=0.02*dt*sz; p.x+=p.vx*dt*0.06; p.y+=p.vy*dt*0.06; p.rot+=p.vrot;
      pr=p.life/p.max; if(pr>=1){P.shards.splice(i,1);continue;}
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.fillStyle=g(p.col+','+(1-pr)); ctx.shadowBlur=5; ctx.shadowColor=g(p.col+',1');
      ctx.fillRect(-p.sz/2,-p.sz/2,p.sz,p.sz*1.6); ctx.restore(); ctx.shadowBlur=0;
    }
    for(i=P.beams.length-1;i>=0;i--){ p=P.beams[i]; p.life+=dt; pr=p.life/p.max; if(pr>=1){P.beams.splice(i,1);continue;}
      var env=Math.sin(pr*Math.PI), L=(p.big?185:126)*sz*p.scl*env;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      var gg=ctx.createLinearGradient(-L/2,0,L/2,0); gg.addColorStop(0,g(p.col+',0')); gg.addColorStop(.5,g(p.col+',0.55')); gg.addColorStop(1,g(p.col+',0'));
      ctx.strokeStyle=gg; ctx.lineWidth=(p.big?26:18)*sz*env; ctx.lineCap='round'; ctx.shadowBlur=16; ctx.shadowColor=g(p.col+',1');
      ctx.beginPath(); ctx.moveTo(-L/2,0); ctx.lineTo(L/2,0); ctx.stroke();
      gg=ctx.createLinearGradient(-L/2,0,L/2,0); gg.addColorStop(0,g(p.col+',0')); gg.addColorStop(.45,'rgba(255,255,255,1)'); gg.addColorStop(.55,'rgba(255,255,255,1)'); gg.addColorStop(1,g(p.col+',0'));
      ctx.strokeStyle=gg; ctx.lineWidth=Math.max(0.5,(6-pr*3)*sz); ctx.shadowBlur=0;
      ctx.beginPath(); ctx.moveTo(-L/2,0); ctx.lineTo(L/2,0); ctx.stroke();
      ctx.restore();
    }
    for(i=P.flashes.length-1;i>=0;i--){ p=P.flashes[i]; p.life+=dt; pr=p.life/p.max; if(pr>=1){P.flashes.splice(i,1);continue;}
      var R=p.r*(1-pr*0.3);
      var fg=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
      fg.addColorStop(0,g('255,255,255,'+(1-pr))); fg.addColorStop(.4,g(p.col+','+((1-pr)*0.85))); fg.addColorStop(1,g(p.col+',0'));
      ctx.fillStyle=fg; ctx.beginPath(); ctx.arc(p.x,p.y,R,0,6.283); ctx.fill();
    }
    for(i=P.trails.length-1;i>=0;i--){ p=P.trails[i]; p.life+=dt; pr=p.life/p.max; if(pr>=1){P.trails.splice(i,1);continue;}
      ctx.strokeStyle=g(p.col+','+((1-pr)*0.7)); ctx.lineWidth=Math.max(0.4,p.w*(1-pr)); ctx.shadowBlur=8; ctx.shadowColor=g(p.col+',1');
      ctx.beginPath(); ctx.moveTo(p.x1,p.y1); ctx.lineTo(p.x2,p.y2); ctx.stroke(); ctx.shadowBlur=0;
    }
  }
  function trail(P,x1,y1,x2,y2,col,w,life){ P.trails.push({x1:x1,y1:y1,x2:x2,y2:y2,col:col,w:w,life:0,max:life||260}); }
  /* 特效壳: 统一帧循环/裁剪/收尾 */
  function shell(bsEl,hx,barL,barW,midY,barBot,fx,deal,opt){
    var sz=fx.sz||1, sp=fx.sp||1, fxi=fx.fxi||1;
    var br=bsEl.getBoundingClientRect();
    var bx=br.left+br.width/2, by=br.top+br.height/2;
    var pk=mkCanvas(), ctx=pk.ctx;
    var clip=barBot+18+((opt&&opt.clipExtra)||0);
    var P=pool();
    var st={t:0,last:0,dead:false,dealt:false,running:true,sz:sz,sp:sp,fxi:fxi,bx:bx,by:by,br:br,hx:hx,hy:midY,barL:barL,barW:barW,barBot:barBot,ctx:ctx,vw:pk.W,vh:pk.H,P:P,fired:{}};
    st.fire=function(){ if(!st.dealt){st.dealt=true; try{deal();}catch(e){}} };
    st.done=function(){ if(st.dead)return; st.dead=true; pk.kill(); };
    var hardKill=setTimeout(function(){ st.fire(); st.done(); }, opt.hardMs||5600);
    function frame(ts){
      if(st.dead)return;
      if(!st.last)st.last=ts; var dt=(ts-st.last)*sp; st.last=ts; if(dt>55)dt=55;
      st.t+=dt; st.dt=dt;
      try{ opt.tick(st); }catch(e){}
      ctx.clearRect(0,0,pk.W,pk.H);
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,pk.W,clip); ctx.clip();
      ctx.globalCompositeOperation='source-over';
      try{ opt.solid(st); }catch(e){}
      ctx.globalCompositeOperation='lighter';
      stepDraw(ctx,P,dt,sz);
      try{ if(opt.glow)opt.glow(st); }catch(e){}
      ctx.globalCompositeOperation='source-over';
      ctx.restore();
      if(st.t>(opt.endMs||3600) && empty(P) && (!opt.busy||!opt.busy(st))){ clearTimeout(hardKill); st.fire(); st.done(); return; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(st.fire,(fx.dealDelay||2800)/sp);
    return st;
  }
  return {mkCanvas:mkCanvas,g:g,rnd:rnd,pool:pool,empty:empty,burst:burst,jet:jet,suck:suck,ring:ring,shards:shards,beam:beam,flash:flash,trail:trail,stepDraw:stepDraw,shell:shell};
})();
