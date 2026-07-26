// hansen_cinema_themes.js v3 (v543) — 🎬 IMAX 史诗主题引擎(亮色嘉年华重制版)
// ============================================================================
// v3 重做(Hansen 审美定调): v2 走暗黑电影风, 与游戏通体明亮的糖果系画风(金色按钮/可爱宠物/emoji)
//     完全相悖——再精致也是"压抑的烂"。v3 全部推倒: 【明亮 · 高饱和 · 满屏可爱活物 · 节日感】,
//     对齐 Hansen 原版六主题(彩虹乐园/桃子糖果)的快乐基因, 再叠 canvas 招牌大场面。
// 六款: theme_fireworks 焰火盛典 / theme_candyland 糖果乐园 / theme_balloon 云端气球 /
//       theme_lagoon 七彩珊瑚湾 / theme_spacepark 星际乐园
// 铁律: ① 绝无旋转动画(防晕) — 平移/透明度/缩放(硬币翻转用 scaleX, 朝向 spawn 手算矩阵);
//       ② 手机性能: DPR≤2, 渐变 rebuild 缓存, document.hidden 暂停, resize 防抖, 粒子总量受控;
//       ③ pointer-events:none + z-index:-1, 永不挡交互。
// ============================================================================
(function(){
  'use strict';
  if(window.__hansenCinemaLoaded) return; window.__hansenCinemaLoaded = true;

  var CANVAS_ID='hsnCinemaCanvas';
  var canvas=null, ctx=null, W=0, H=0, DPR=1;
  var raf=0, running=false, curTheme=null, scene=null, lastT=0, resizeTimer=null;
  var motionQuery=null;
  try{ motionQuery=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)'); }catch(e){}

  function reduceMotion(){ return !!(motionQuery&&motionQuery.matches); }

  function rnd(a,b){ return a+Math.random()*(b-a); }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function lg(x0,y0,x1,y1,stops){ var g=ctx.createLinearGradient(x0,y0,x1,y1); for(var i=0;i<stops.length;i++)g.addColorStop(stops[i][0],stops[i][1]); return g; }
  function rg(x,y,r0,r1,stops){ var g=ctx.createRadialGradient(x,y,r0,x,y,r1); for(var i=0;i<stops.length;i++)g.addColorStop(stops[i][0],stops[i][1]); return g; }
  function orient(a){ return {c:Math.cos(a),s:Math.sin(a)}; }
  function turnPt(o,x,y){ return [x*o.c-y*o.s, x*o.s+y*o.c]; }
  // 可爱脸: 两个点眼 + 微笑弧
  function face(x,y,s,ink){
    ctx.fillStyle=ink||'rgba(60,40,30,.85)';
    ctx.beginPath();ctx.arc(x-s*.32,y-s*.1,s*.09,0,6.2832);ctx.fill();
    ctx.beginPath();ctx.arc(x+s*.32,y-s*.1,s*.09,0,6.2832);ctx.fill();
    ctx.strokeStyle=ink||'rgba(60,40,30,.85)';ctx.lineWidth=Math.max(1,s*.07);
    ctx.beginPath();ctx.arc(x,y+s*.12,s*.26,.35,2.79);ctx.stroke();
  }

  function ensureCanvas(){
    if(canvas && canvas.parentNode) return;
    canvas=document.createElement('canvas');
    canvas.id=CANVAS_ID;
    canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;display:block';
    document.body.appendChild(canvas);
    ctx=canvas.getContext('2d',{alpha:false});
    sizeCanvas();
  }
  function sizeCanvas(){
    if(!canvas) return;
    DPR=Math.min(window.devicePixelRatio||1,2);
    W=canvas.width=Math.max(1,Math.floor(window.innerWidth*DPR));
    H=canvas.height=Math.max(1,Math.floor(window.innerHeight*DPR));
  }
  function destroyCanvas(){ if(canvas&&canvas.parentNode)canvas.parentNode.removeChild(canvas); canvas=null;ctx=null; }
  function drawStatic(){
    if(!running||!ctx||!scene) return;
    try{ scene.draw(0,performance.now()); }catch(e){}
  }
  function loop(t){
    if(!running||!ctx||!scene){ raf=0; return; }
    if(reduceMotion()){ raf=0; drawStatic(); return; }
    raf=requestAnimationFrame(loop);
    if(document.hidden) return;
    var dt=Math.min(50,(t-lastT)||16.7); lastT=t;
    try{ scene.draw(dt,t); }catch(e){}
  }
  function start(themeId){
    stop();
    var maker=SCENES[themeId]; if(!maker) return false;
    ensureCanvas();
    scene=maker(); if(scene.rebuild)scene.rebuild();
    curTheme=themeId; running=true; lastT=performance.now();
    if(reduceMotion()) drawStatic();
    else if(!raf) raf=requestAnimationFrame(loop);
    return true;
  }
  function stop(){
    running=false; scene=null; curTheme=null;
    if(raf){ cancelAnimationFrame(raf); raf=0; }
    destroyCanvas();
  }
  window.addEventListener('resize',function(){
    if(!running) return;
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(function(){
      if(!running)return;
      sizeCanvas();
      if(scene&&scene.rebuild)scene.rebuild();
      if(reduceMotion())drawStatic();
    },200);
  });
  function motionChanged(){
    if(!running) return;
    if(reduceMotion()){
      if(raf){ cancelAnimationFrame(raf); raf=0; }
      drawStatic();
    }else if(!raf){
      lastT=performance.now();
      raf=requestAnimationFrame(loop);
    }
  }
  try{
    if(motionQuery&&motionQuery.addEventListener) motionQuery.addEventListener('change',motionChanged);
    else if(motionQuery&&motionQuery.addListener) motionQuery.addListener(motionChanged);
  }catch(e){}

  // ============================================================
  // 🎆 theme_fireworks — 焰火盛典: 节日夜空 + 烟花连放 + 孔明灯 + 屋顶灯串
  // ============================================================
  function sceneFireworks(){
    var sky=null, shells=[], sparks=[], lans=[], roofs=null, lights=[];
    var nextShell=performance.now()+700;
    var COLS=[['255,99,132','255,205,86'],['77,208,225','129,212,250'],['255,138,216','244,143,255'],['255,213,79','255,167,38'],['174,234,86','105,240,174']];
    function rebuild(){
      sky=lg(0,0,0,H,[[0,'#1a1f5e'],[.45,'#3d2a8f'],[.78,'#7b3fa0'],[1,'#b14a86']]);
      shells=[];sparks=[];lans=[];lights=[];
      roofs=[];var x=0;
      while(x<1.04){ var w2=rnd(.07,.16),h2=rnd(.035,.09); roofs.push({x:x,w:w2,h:h2}); x+=w2; }
      for(var i=0;i<5;i++)lans.push({x:rnd(.06,.94),y:rnd(.35,1.1),v:rnd(.00005,.00009),sw:rnd(.5,1.1),ph:rnd(0,6.28),s:rnd(.018,.028)});
      for(var L=0;L<14;L++)lights.push({x:L/13,ph:rnd(0,6.28),col:pick(['255,99,132','255,213,79','77,208,225','244,143,255'])});
    }
    var flashes=[];
    function burst(x,y,colPair,big){
      var n=big?46:34, base=big?rnd(.0006,.00078):rnd(.00045,.0006);
      for(var i=0;i<n;i++){
        var a=i/n*6.2832+rnd(-.06,.06), sp=base*rnd(.55,1);
        sparks.push({x:x,y:y,px:x,py:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,decay:rnd(.0007,.001),
          col:Math.random()<.5?colPair[0]:colPair[1],tw:Math.random()<.3,r:(big?2.8:2.2)*DPR});
      }
      flashes.push({x:x,y:y,born:performance.now(),life:300,col:colPair[0]});
      if(sparks.length>200)sparks.splice(0,sparks.length-200);
    }
    function draw(dt,t){
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      var now=performance.now();
      // 发射弹
      if(now>=nextShell && sparks.length<150){
        shells.push({x:rnd(.15,.85),y:1.02,ty:rnd(.16,.42),v:rnd(.00075,.001),col:pick(COLS),big:Math.random()<.3});
        nextShell=now+rnd(700,1600);
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(var s2=shells.length-1;s2>=0;s2--){
        var sh=shells[s2]; sh.y-=sh.v*dt;
        ctx.fillStyle='rgba(255,236,170,.95)';
        ctx.beginPath();ctx.arc(sh.x*W,sh.y*H,1.6*DPR,0,6.2832);ctx.fill();
        ctx.strokeStyle='rgba(255,236,170,.4)';ctx.lineWidth=1*DPR;
        ctx.beginPath();ctx.moveTo(sh.x*W,sh.y*H);ctx.lineTo(sh.x*W,sh.y*H+14*DPR);ctx.stroke();
        if(sh.y<=sh.ty){ burst(sh.x,sh.y,sh.col,sh.big); shells.splice(s2,1); }
      }
      // 爆裂中心闪光(短促亮团)
      for(var fz=flashes.length-1;fz>=0;fz--){
        var FL=flashes[fz], fk=1-(now-FL.born)/FL.life;
        if(fk<=0){flashes.splice(fz,1);continue;}
        ctx.fillStyle=rg(FL.x*W,FL.y*H,0,Math.min(W,H)*.12*(1-fk*.4),[[0,'rgba(255,255,240,'+(fk*.8).toFixed(3)+')'],[.4,'rgba('+FL.col+','+(fk*.5).toFixed(3)+')'],[1,'rgba('+FL.col+',0)']]);
        ctx.beginPath();ctx.arc(FL.x*W,FL.y*H,Math.min(W,H)*.12,0,6.2832);ctx.fill();
      }
      // 爆裂火花(重力+渐隐+拖尾, 三成带闪烁)
      ctx.lineCap='round';
      for(var k=sparks.length-1;k>=0;k--){
        var sp=sparks[k];
        sp.px=sp.x; sp.py=sp.y;
        sp.vy+=.0000011*dt; sp.x+=sp.vx*dt; sp.y+=sp.vy*dt; sp.life-=sp.decay*dt;
        if(sp.life<=0||sp.y>1.15){sparks.splice(k,1);continue;}
        var a2=sp.life*(sp.tw?(.45+.55*Math.abs(Math.sin(t*.02+k))):1);
        ctx.strokeStyle='rgba('+sp.col+','+(a2*.85).toFixed(3)+')';
        ctx.lineWidth=sp.r*(0.5+sp.life*.5);
        ctx.beginPath();ctx.moveTo(sp.px*W-(sp.x-sp.px)*W*2.4,sp.py*H-(sp.y-sp.py)*H*2.4);ctx.lineTo(sp.x*W,sp.y*H);ctx.stroke();
        ctx.fillStyle='rgba('+sp.col+','+a2.toFixed(3)+')';
        ctx.beginPath();ctx.arc(sp.x*W,sp.y*H,sp.r*(0.55+sp.life*.55),0,6.2832);ctx.fill();
      }
      ctx.restore();
      // 孔明灯
      for(var L2=0;L2<lans.length;L2++){
        var ln=lans[L2]; ln.y-=ln.v*dt;
        if(ln.y<-.1){ln.y=1.12;ln.x=rnd(.06,.94);}
        var lx=(ln.x+Math.sin(t*.0005*ln.sw+ln.ph)*.012)*W, ly=ln.y*H, ls=ln.s*Math.min(W,H);
        var fl=.8+.2*Math.sin(t*.006+ln.ph*3);
        ctx.fillStyle=rg(lx,ly,0,ls*2.2,[[0,'rgba(255,190,110,'+(0.28*fl).toFixed(3)+')'],[1,'rgba(255,190,110,0)']]);
        ctx.beginPath();ctx.arc(lx,ly,ls*2.2,0,6.2832);ctx.fill();
        ctx.fillStyle=lg(lx,ly-ls*.8,lx,ly+ls*.8,[[0,'#ffd180'],[.6,'#ff9e45'],[1,'#e8702a']]);
        ctx.beginPath();
        ctx.moveTo(lx-ls*.5,ly-ls*.3);ctx.quadraticCurveTo(lx,ly-ls*.95,lx+ls*.5,ly-ls*.3);
        ctx.lineTo(lx+ls*.36,ly+ls*.6);ctx.lineTo(lx-ls*.36,ly+ls*.6);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,244,200,'+(0.85*fl).toFixed(3)+')';
        ctx.beginPath();ctx.ellipse(lx,ly+ls*.05,ls*.22,ls*.34,0,0,6.2832);ctx.fill();
      }
      // 屋顶剪影 + 彩灯串
      ctx.fillStyle='#241048';
      ctx.beginPath();ctx.moveTo(-4,H+4);ctx.lineTo(-4,H*.93);
      for(var r3=0;r3<roofs.length;r3++){var rf=roofs[r3];
        ctx.lineTo(rf.x*W,H*(0.985-rf.h));ctx.lineTo((rf.x+rf.w*.5)*W,H*(0.985-rf.h-0.018));ctx.lineTo((rf.x+rf.w)*W,H*(0.985-rf.h));}
      ctx.lineTo(W+4,H*.96);ctx.lineTo(W+4,H+4);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.18)';ctx.lineWidth=1*DPR;
      ctx.beginPath();ctx.moveTo(0,H*.905);ctx.quadraticCurveTo(W*.5,H*.94,W,H*.905);ctx.stroke();
      for(var b3=0;b3<lights.length;b3++){
        var lt=lights[b3], lx2=lt.x*W, ly2=H*(.905+.03*Math.sin(3.1416*lt.x))+1;
        var on=.45+.55*Math.abs(Math.sin(t*.0018+lt.ph));
        ctx.fillStyle='rgba('+lt.col+','+on.toFixed(3)+')';
        ctx.shadowColor='rgba('+lt.col+',.9)';ctx.shadowBlur=6*DPR;
        ctx.beginPath();ctx.arc(lx2,ly2+5*DPR,2.4*DPR,0,6.2832);ctx.fill();
      }
      ctx.shadowBlur=0;
    }
    return {draw:draw,rebuild:rebuild};
  }

  // ============================================================
  // 🍭 theme_candyland — 糖果乐园: 马卡龙天空 + 大彩虹 + 棉花糖云 + 糖果雨(带笑脸) + 糖果山丘
  // ============================================================
  function sceneCandy(){
    var sky=null, clouds=[], candies=[], hills=null, shineT=0;
    var RB=['255,99,132','255,159,64','255,205,86','75,222,129','77,208,225','99,132,255','186,104,200'];
    function mkCandy(){
      var kind=pick(['wrap','lolli','donut','wrap']);
      return {kind:kind,x:Math.random()*1.1-.05,y:rnd(-1.1,-.05),vy:rnd(.00009,.00016),
        o:orient(rnd(-0.7,0.7)),sw:rnd(.6,1.3),ph:rnd(0,6.28),s:rnd(11,18)*DPR,
        c1:pick(['#ff8aa8','#ffb74d','#4dd0e1','#ba68c8','#81c784','#f06292']),
        c2:pick(['#fff3b0','#ffe0ec','#e1f5fe','#f3e5f5']),faced:Math.random()<.4};
    }
    function rebuild(){
      sky=lg(0,0,0,H,[[0,'#7ec8ff'],[.42,'#aee3ff'],[.7,'#ffd6ec'],[1,'#fff3c4']]);
      clouds=[];candies=[];
      for(var c=0;c<5;c++){
        var puffs=[],n=4+(Math.random()*3|0);
        for(var p2=0;p2<n;p2++)puffs.push({dx:rnd(-.09,.09),dy:rnd(-.02,.025),r:rnd(.035,.07)});
        clouds.push({x:rnd(0,1),y:rnd(.06,.4),v:rnd(.000012,.000028),puffs:puffs,pinky:Math.random()<.5});
      }
      for(var i=0;i<22;i++)candies.push(mkCandy());
      hills=[{x:.18,r:.34,c:'#ffb3d1'},{x:.55,r:.42,c:'#b7e3a8'},{x:.88,r:.3,c:'#ffe08a'}];
    }
    function drawWrap(cd,x,y){
      var s=cd.s,o=cd.o;
      function P(px,py){var q=turnPt(o,px,py);return [x+q[0],y+q[1]];}
      var b=ctx;
      b.fillStyle=cd.c1;
      var e0=P(0,0);
      b.beginPath();b.ellipse(e0[0],e0[1],s*.62,s*.46,Math.atan2(o.s,o.c),0,6.2832);b.fill();
      b.fillStyle=cd.c2;
      var tipL=P(-s*.95,0),aL=P(-s*.6,-s*.34),bL=P(-s*.6,s*.34);
      b.beginPath();b.moveTo(tipL[0],tipL[1]);b.lineTo(aL[0],aL[1]);b.lineTo(bL[0],bL[1]);b.closePath();b.fill();
      var tipR=P(s*.95,0),aR=P(s*.6,-s*.34),bR=P(s*.6,s*.34);
      b.beginPath();b.moveTo(tipR[0],tipR[1]);b.lineTo(aR[0],aR[1]);b.lineTo(bR[0],bR[1]);b.closePath();b.fill();
      b.fillStyle='rgba(255,255,255,.45)';
      var hl=P(-s*.15,-s*.18);
      b.beginPath();b.ellipse(hl[0],hl[1],s*.2,s*.1,Math.atan2(o.s,o.c),0,6.2832);b.fill();
      if(cd.faced)face(x,y,s*.7);
    }
    function drawLolli(cd,x,y){
      var s=cd.s;
      ctx.strokeStyle='#fff';ctx.lineWidth=s*.16;
      ctx.beginPath();ctx.moveTo(x,y+s*.1);ctx.lineTo(x,y+s*1.5);ctx.stroke();
      ctx.fillStyle=cd.c1;
      ctx.beginPath();ctx.arc(x,y,s*.62,0,6.2832);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=s*.13;
      ctx.beginPath();ctx.arc(x,y,s*.42,0.4,3.1);ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,s*.2,3.5,6.0);ctx.stroke();
      if(cd.faced)face(x,y,s*.62);
    }
    function drawDonut(cd,x,y){
      var s=cd.s;
      ctx.fillStyle='#d7a06b';
      ctx.beginPath();ctx.arc(x,y,s*.6,0,6.2832);ctx.fill();
      ctx.fillStyle=cd.c1;
      ctx.beginPath();ctx.arc(x,y-s*.05,s*.55,0,6.2832);ctx.fill();
      ctx.fillStyle='#fff3c4';
      ctx.beginPath();ctx.arc(x,y,s*.22,0,6.2832);ctx.fill();
      for(var sp2=0;sp2<6;sp2++){
        ctx.fillStyle='rgba('+pick(RB)+',.95)';
        var a=sp2*1.05+cd.ph;
        ctx.beginPath();ctx.arc(x+Math.cos(a)*s*.38,y-s*.05+Math.sin(a)*s*.3,s*.05,0,6.2832);ctx.fill();
      }
    }
    function draw(dt,t){
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      // 大彩虹(七色同心弧, 微闪)
      shineT=t*.0004;
      var cxr=W*.5, cyr=H*.92, R0=Math.min(W,H)*.95;
      ctx.save();ctx.lineCap='round';
      for(var b2=0;b2<7;b2++){
        ctx.strokeStyle='rgba('+RB[b2]+','+(0.5+0.12*Math.sin(shineT+b2*.7)).toFixed(3)+')';
        ctx.lineWidth=Math.min(W,H)*.022;
        ctx.beginPath();ctx.arc(cxr,cyr,R0-b2*Math.min(W,H)*.024,3.34,6.08);ctx.stroke();
      }
      ctx.restore();
      // 棉花糖云
      for(var c2=0;c2<clouds.length;c2++){
        var cl=clouds[c2]; cl.x+=cl.v*dt; if(cl.x>1.25)cl.x=-.25;
        for(var p3=0;p3<cl.puffs.length;p3++){
          var pf=cl.puffs[p3],cx2=(cl.x+pf.dx)*W,cy2=(cl.y+pf.dy)*H,cr=pf.r*H;
          ctx.fillStyle=rg(cx2,cy2-cr*.3,cr*.1,cr,[[0,'#ffffff'],[1,cl.pinky?'rgba(255,196,228,.85)':'rgba(214,240,255,.85)']]);
          ctx.beginPath();ctx.arc(cx2,cy2,cr,0,6.2832);ctx.fill();
        }
      }
      // 糖果山丘 + 糖果雨
      for(var h2=0;h2<hills.length;h2++){
        var hl2=hills[h2];
        ctx.fillStyle=hl2.c;
        ctx.beginPath();ctx.arc(hl2.x*W,H*1.08,hl2.r*Math.min(W,H),0,6.2832);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.4)';
        ctx.beginPath();ctx.arc(hl2.x*W-hl2.r*Math.min(W,H)*.3,H*1.02-hl2.r*Math.min(W,H)*.5,hl2.r*Math.min(W,H)*.16,0,6.2832);ctx.fill();
      }
      for(var i=0;i<candies.length;i++){
        var cd=candies[i];
        cd.y+=cd.vy*dt; cd.x+=Math.sin(t*.001*cd.sw+cd.ph)*.0005;
        if(cd.y>1.12){ candies[i]=mkCandy(); candies[i].y=-.08; continue; }
        var x2=cd.x*W,y2=cd.y*H;
        if(cd.kind==='wrap')drawWrap(cd,x2,y2);
        else if(cd.kind==='lolli')drawLolli(cd,x2,y2);
        else drawDonut(cd,x2,y2);
      }
    }
    return {draw:draw,rebuild:rebuild};
  }

  // ============================================================
  // 🎈 theme_balloon — 云端气球: 晴空 + 太阳光芒 + 双层云 + 彩色热气球 + 小鸟 + 字母横幅飞机
  // ============================================================
  function sceneBalloon(){
    var sky=null, cloudsF=[], cloudsB=[], balloons=[], birds=[], plane=null, rays=[];
    var nextPlane=performance.now()+2500, nextBirds=performance.now()+1800;
    var BCOLS=[['#ff6b6b','#ffd93d'],['#4dd0e1','#fff'],['#ba68c8','#ffd1ec'],['#81c784','#fff59d'],['#ff9e45','#ffe0b2']];
    function mkCloud(layer){
      var puffs=[],n=4+(Math.random()*3|0);
      for(var p2=0;p2<n;p2++)puffs.push({dx:rnd(-.08,.08),dy:rnd(-.018,.02),r:rnd(.03,.06)*(layer?1:.6)});
      return {x:rnd(-.2,1.2),y:layer?rnd(.12,.55):rnd(.06,.4),v:(layer?rnd(.00002,.000035):rnd(.00001,.000018)),puffs:puffs,layer:layer};
    }
    function rebuild(){
      sky=lg(0,0,0,H,[[0,'#41b8f5'],[.55,'#8fd6ff'],[1,'#dff4ff']]);
      cloudsF=[];cloudsB=[];balloons=[];birds=[];rays=[];
      for(var c=0;c<4;c++)cloudsF.push(mkCloud(1));
      for(var c2=0;c2<4;c2++)cloudsB.push(mkCloud(0));
      for(var b=0;b<4;b++){
        balloons.push({x:rnd(.1,.9),y:rnd(.15,.85),vy:rnd(-.00002,.00002),sw:rnd(.4,1),ph:rnd(0,6.28),
          s:rnd(.05,.075),col:BCOLS[b%BCOLS.length]});
      }
      for(var r2=0;r2<8;r2++){var a=r2*(6.2832/8)+.39;rays.push({c:Math.cos(a),s:Math.sin(a),ph:rnd(0,6.28)});}
    }
    function drawBalloon(B,t){
      var bx=(B.x+Math.sin(t*.0004*B.sw+B.ph)*.015)*W, by=B.y*H, s=B.s*Math.min(W,H);
      B.y+=B.vy*16; if(B.y<.1||B.y>.88)B.vy*=-1;
      // 球体(竖条纹: 主体+两条侧带)
      ctx.fillStyle=B.col[0];
      ctx.beginPath();ctx.ellipse(bx,by,s,s*1.18,0,0,6.2832);ctx.fill();
      ctx.fillStyle=B.col[1];
      ctx.beginPath();ctx.ellipse(bx,by,s*.45,s*1.18,0,0,6.2832);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.35)';
      ctx.beginPath();ctx.ellipse(bx-s*.4,by-s*.45,s*.2,s*.4,0,0,6.2832);ctx.fill();
      // 绳+篮
      ctx.strokeStyle='rgba(120,80,40,.8)';ctx.lineWidth=1.2*DPR;
      ctx.beginPath();ctx.moveTo(bx-s*.5,by+s*.95);ctx.lineTo(bx-s*.26,by+s*1.55);
      ctx.moveTo(bx+s*.5,by+s*.95);ctx.lineTo(bx+s*.26,by+s*1.55);ctx.stroke();
      ctx.fillStyle='#a9742f';
      ctx.fillRect(bx-s*.3,by+s*1.5,s*.6,s*.42);
      ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1*DPR;
      ctx.strokeRect(bx-s*.3,by+s*1.5,s*.6,s*.42);
    }
    function drawCloudSet(arr,dt,alpha){
      for(var c=0;c<arr.length;c++){
        var cl=arr[c]; cl.x+=cl.v*dt; if(cl.x>1.25)cl.x=-.25;
        for(var p3=0;p3<cl.puffs.length;p3++){
          var pf=cl.puffs[p3],cx2=(cl.x+pf.dx)*W,cy2=(cl.y+pf.dy)*H,cr=pf.r*H;
          ctx.fillStyle='rgba(255,255,255,'+alpha+')';
          ctx.beginPath();ctx.arc(cx2,cy2,cr,0,6.2832);ctx.fill();
        }
      }
    }
    function draw(dt,t){
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      // 太阳 + 呼吸光芒
      var sx=W*.84,sy=H*.1,sr=Math.min(W,H)*.07;
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(var r3=0;r3<rays.length;r3++){
        var ray=rays[r3],a2=.12+.1*Math.sin(t*.0008+ray.ph);
        ctx.strokeStyle='rgba(255,236,150,'+a2.toFixed(3)+')';ctx.lineWidth=3*DPR;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(sx+ray.c*sr*1.3,sy+ray.s*sr*1.3);ctx.lineTo(sx+ray.c*sr*2.1,sy+ray.s*sr*2.1);ctx.stroke();
      }
      ctx.restore();
      ctx.fillStyle=rg(sx,sy,0,sr*2.6,[[0,'rgba(255,240,170,.55)'],[1,'rgba(255,240,170,0)']]);
      ctx.beginPath();ctx.arc(sx,sy,sr*2.6,0,6.2832);ctx.fill();
      ctx.fillStyle=rg(sx-sr*.3,sy-sr*.3,0,sr,[[0,'#fffcf0'],[.8,'#ffe680'],[1,'#ffce54']]);
      ctx.beginPath();ctx.arc(sx,sy,sr,0,6.2832);ctx.fill();
      drawCloudSet(cloudsB,dt,'.55');
      // 字母横幅小飞机(招牌·点题: 背单词)
      var now=performance.now();
      if(!plane&&now>=nextPlane){
        var dirP=Math.random()<.5?1:-1;
        plane={p:dirP>0?-.3:1.3,dir:dirP,y:rnd(.12,.3),v:rnd(.00016,.0002),txt:pick(['A B C','WORD','GO!'])};
      }
      if(plane){
        plane.p+=plane.dir*plane.v*dt;
        if((plane.dir>0&&plane.p>1.45)||(plane.dir<0&&plane.p<-.45)){plane=null;nextPlane=now+rnd(9000,15000);}
        else{
          var pxp=plane.p*W,pyp=(plane.y+Math.sin(plane.p*9)*.008)*H,d=plane.dir,ps=Math.min(W,H)*.035;
          ctx.fillStyle='#ef5350';
          ctx.beginPath();ctx.ellipse(pxp,pyp,ps*1.1,ps*.42,0,0,6.2832);ctx.fill();
          ctx.fillStyle='#fff';
          ctx.beginPath();ctx.ellipse(pxp-d*ps*.1,pyp-ps*.28,ps*.5,ps*.26,0,0,6.2832);ctx.fill();
          ctx.fillStyle='#ef5350';
          ctx.beginPath();ctx.moveTo(pxp-d*ps*.9,pyp);ctx.lineTo(pxp-d*ps*1.5,pyp-ps*.7);ctx.lineTo(pxp-d*ps*1.3,pyp);ctx.closePath();ctx.fill();
          ctx.fillStyle='rgba(60,60,80,.85)';
          ctx.beginPath();ctx.arc(pxp+d*ps*.45,pyp-ps*.12,ps*.13,0,6.2832);ctx.fill();
          // 横幅
          var bx2=pxp-d*ps*1.7, bw3=ps*3.2, bh3=ps*1.05, bx0=d>0?bx2-bw3:bx2;
          ctx.strokeStyle='rgba(120,90,50,.8)';ctx.lineWidth=1*DPR;
          ctx.beginPath();ctx.moveTo(pxp-d*ps*1.1,pyp);ctx.lineTo(d>0?bx0+bw3:bx0,pyp);ctx.stroke();
          ctx.fillStyle='rgba(255,255,255,.95)';
          ctx.fillRect(bx0,pyp-bh3/2,bw3,bh3);
          ctx.strokeStyle='#ffb300';ctx.lineWidth=1.4*DPR;ctx.strokeRect(bx0,pyp-bh3/2,bw3,bh3);
          ctx.fillStyle='#5b3a1e';ctx.font='800 '+(bh3*.55)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillText(plane.txt,bx0+bw3/2,pyp+ps*.04);
        }
      }
      // 热气球
      for(var b4=0;b4<balloons.length;b4++)drawBalloon(balloons[b4],t);
      // 小鸟群(双弧扇翅)
      if(now>=nextBirds){
        var dirB=Math.random()<.5?1:-1, by0=rnd(.18,.5), n2=3+(Math.random()*3|0);
        for(var nb=0;nb<n2;nb++)birds.push({p:(dirB>0?-.1:1.1)-dirB*nb*.04,dir:dirB,y:by0+rnd(-.03,.03),v:rnd(.00022,.0003),ph:rnd(0,6.28)});
        nextBirds=now+rnd(7000,12000);
      }
      ctx.strokeStyle='rgba(70,90,120,.85)';ctx.lineWidth=1.6*DPR;ctx.lineCap='round';
      for(var bi=birds.length-1;bi>=0;bi--){
        var bd=birds[bi];bd.p+=bd.dir*bd.v*dt;
        if((bd.dir>0&&bd.p>1.2)||(bd.dir<0&&bd.p<-.2)){birds.splice(bi,1);continue;}
        var bxb=bd.p*W,byb=bd.y*H,fl2=Math.sin(t*.012+bd.ph),wsp=7*DPR;
        ctx.beginPath();
        ctx.moveTo(bxb-wsp,byb-fl2*4*DPR);ctx.quadraticCurveTo(bxb-wsp*.4,byb-2*DPR-fl2*5*DPR,bxb,byb);
        ctx.quadraticCurveTo(bxb+wsp*.4,byb-2*DPR-fl2*5*DPR,bxb+wsp,byb-fl2*4*DPR);
        ctx.stroke();
      }
      drawCloudSet(cloudsF,dt,'.92');
    }
    return {draw:draw,rebuild:rebuild};
  }

  // ============================================================
  // 🐠 theme_lagoon — 七彩珊瑚湾: 阳光浅海 + 光柱 + 彩色鱼群 + 微笑鲸鱼 + 珊瑚海草 + 宝箱闪光
  // ============================================================
  function sceneLagoon(){
    var sky=null, fishes=[], bubbles=[], weeds=[], corals=null, whale=null, chestT=0;
    var nextWhale=performance.now()+2000;
    var FCOL=[['#ff8a3d','#ffd180'],['#ffd54f','#fff9c4'],['#f06292','#ffc1e3'],['#9575cd','#d1c4e9'],['#4dd0e1','#b2ebf2']];
    function rebuild(){
      sky=lg(0,0,0,H,[[0,'#5fdde5'],[.4,'#27b6dd'],[.75,'#0e84c8'],[1,'#0a5ea0']]);
      fishes=[];bubbles=[];weeds=[];
      for(var g2=0;g2<3;g2++){
        var col=FCOL[g2%FCOL.length], y0=rnd(.2,.65), dir=Math.random()<.5?1:-1, n=4+(Math.random()*3|0);
        for(var i=0;i<n;i++)fishes.push({p:Math.random(),dir:dir,y0:y0+rnd(-.04,.04),v:rnd(.00008,.00013),ph:rnd(0,6.28),s:rnd(.016,.026),c1:col[0],c2:col[1],amp:rnd(.015,.03),fr:rnd(4,7)});
      }
      for(var b=0;b<18;b++)bubbles.push({x:Math.random(),y:Math.random(),r:rnd(1.2,3),v:rnd(.00007,.00015),ph:rnd(0,6.28)});
      for(var w2=0;w2<6;w2++)weeds.push({x:rnd(.03,.97),h:rnd(.1,.2),ph:rnd(0,6.28),sw:rnd(.6,1.2),col:pick(['#2e9e63','#3bb273','#57c785'])});
      corals=[{x:.12,c:'#ff7eb0'},{x:.3,c:'#ff9e45'},{x:.72,c:'#ba68c8'},{x:.9,c:'#ff7eb0'}];
    }
    function drawFish(f,t){
      f.p+=f.dir*f.v*16;
      if(f.dir>0&&f.p>1.15)f.p=-.15; if(f.dir<0&&f.p<-.15)f.p=1.15;
      var fx=f.p*W, fy=(f.y0+Math.sin(f.p*f.fr+f.ph)*f.amp)*H, s=f.s*Math.min(W,H), d=f.dir;
      var tk=Math.sin(t*.012+f.ph)*.3;
      ctx.fillStyle=f.c1;
      ctx.beginPath();ctx.ellipse(fx,fy,s,s*.6,0,0,6.2832);ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx-d*s*.9,fy);
      ctx.lineTo(fx-d*s*(1.5+tk*.3),fy-s*.45);
      ctx.lineTo(fx-d*s*(1.5-tk*.3),fy+s*.45);
      ctx.closePath();ctx.fill();
      ctx.fillStyle=f.c2;
      ctx.beginPath();ctx.ellipse(fx-d*s*.1,fy+s*.1,s*.5,s*.3,0,0,6.2832);ctx.fill();
      ctx.fillStyle='#243042';
      ctx.beginPath();ctx.arc(fx+d*s*.55,fy-s*.12,Math.max(1.2,s*.1),0,6.2832);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.85)';
      ctx.beginPath();ctx.arc(fx+d*s*.58,fy-s*.15,Math.max(.6,s*.04),0,6.2832);ctx.fill();
    }
    function drawWhale2(t){
      var w2=whale, s=w2.s, d=w2.dir;
      var cx=w2.p*W, cy=(w2.y0+Math.sin(t*.0004+w2.ph)*.02)*H;
      var tail=Math.sin(t*.004+w2.ph)*s*.22;
      ctx.fillStyle='#56b7e8';
      ctx.beginPath();
      ctx.moveTo(cx+d*s,cy);
      ctx.quadraticCurveTo(cx+d*s*.5,cy-s*.62,cx-d*s*.3,cy-s*.5);
      ctx.quadraticCurveTo(cx-d*s*.95,cy-s*.28,cx-d*s,cy+tail*.4);
      ctx.quadraticCurveTo(cx-d*s*.7,cy+s*.4,cx,cy+s*.46);
      ctx.quadraticCurveTo(cx+d*s*.7,cy+s*.42,cx+d*s,cy);
      ctx.closePath();ctx.fill();
      ctx.beginPath();
      var tx=cx-d*s, ty=cy+tail;
      ctx.moveTo(tx,ty);
      ctx.quadraticCurveTo(tx-d*s*.3,ty-s*.42+tail*.5,tx-d*s*.5,ty-s*.3+tail);
      ctx.quadraticCurveTo(tx-d*s*.22,ty+tail*.3,tx-d*s*.5,ty+s*.3+tail);
      ctx.quadraticCurveTo(tx-d*s*.3,ty+s*.42+tail*.5,tx,ty);
      ctx.closePath();ctx.fillStyle='#56b7e8';ctx.fill();
      ctx.fillStyle='#cfeefc';
      ctx.beginPath();ctx.ellipse(cx+d*s*.1,cy+s*.28,s*.78,s*.22,0,0,6.2832);ctx.fill();
      ctx.fillStyle='#243042';
      ctx.beginPath();ctx.arc(cx+d*s*.62,cy-s*.1,Math.max(1.6,s*.05),0,6.2832);ctx.fill();
      ctx.strokeStyle='#243042';ctx.lineWidth=Math.max(1.2,s*.035);
      ctx.beginPath();ctx.arc(cx+d*s*.55,cy+s*.06,s*.13,d>0?.3:2.4,d>0?1.2:3.0);ctx.stroke();
      w2.spout-=16;
      if(w2.spout<=0){ w2.spout=rnd(2400,4200);
        for(var q=0;q<4;q++)bubbles.push({x:(cx+d*s*.5)/W,y:(cy-s*.55)/H,r:rnd(1.6,3.2),v:rnd(.00012,.0002),ph:rnd(0,6.28)});
        if(bubbles.length>34)bubbles.splice(0,bubbles.length-34);
      }
    }
    function draw(dt,t){
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      // 顶部阳光光柱
      ctx.save();ctx.globalCompositeOperation='screen';
      for(var r2=0;r2<3;r2++){
        var bx=W*(.18+r2*.32)+Math.sin(t*.00015+r2*2)*W*.04;
        var a2=.14+.07*Math.sin(t*.0004+r2*1.6);
        ctx.fillStyle=lg(0,0,0,H*.8,[[0,'rgba(255,255,230,'+(a2*1.6).toFixed(3)+')'],[1,'rgba(255,255,230,0)']]);
        ctx.beginPath();
        ctx.moveTo(bx-W*.045,0);ctx.lineTo(bx+W*.045,0);
        ctx.lineTo(bx+W*.18+W*.04,H*.8);ctx.lineTo(bx-W*.18+W*.04,H*.8);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
      // 鲸鱼
      var now=performance.now();
      if(!whale&&now>=nextWhale){
        var dirW=Math.random()<.5?1:-1;
        whale={dir:dirW,p:dirW>0?-.4:1.4,y0:rnd(.28,.45),v:rnd(.00007,.0001),ph:rnd(0,6.28),s:Math.min(W,H)*rnd(.16,.2),spout:1500};
      }
      if(whale){
        whale.p+=whale.dir*whale.v*dt;
        if((whale.dir>0&&whale.p>1.45)||(whale.dir<0&&whale.p<-.45)){whale=null;nextWhale=now+rnd(10000,16000);}
        else drawWhale2(t);
      }
      // 鱼群
      for(var f2=0;f2<fishes.length;f2++)drawFish(fishes[f2],t);
      // 气泡
      for(var b2=0;b2<bubbles.length;b2++){
        var bb=bubbles[b2];bb.y-=bb.v*dt;var wob=Math.sin(t*.0012+bb.ph)*.004;
        if(bb.y<-.03){bb.y=1.05;bb.x=Math.random();}
        ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1*DPR;
        ctx.beginPath();ctx.arc((bb.x+wob)*W,bb.y*H,bb.r*DPR,0,6.2832);ctx.stroke();
      }
      // 海床: 沙 + 珊瑚 + 海草 + 海星 + 宝箱
      ctx.fillStyle='#e8cf8e';
      ctx.beginPath();ctx.moveTo(-4,H+4);ctx.lineTo(-4,H*.93);
      ctx.quadraticCurveTo(W*.5,H*.885,W+4,H*.93);ctx.lineTo(W+4,H+4);ctx.closePath();ctx.fill();
      for(var w3=0;w3<weeds.length;w3++){
        var wd=weeds[w3], wx=wd.x*W, wy=H*.93, sway=Math.sin(t*.0012*wd.sw+wd.ph)*W*.012;
        ctx.strokeStyle=wd.col;ctx.lineWidth=3.4*DPR;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(wx,wy);
        ctx.quadraticCurveTo(wx+sway,wy-wd.h*H*.55,wx+sway*1.8,wy-wd.h*H);
        ctx.stroke();
      }
      for(var c3=0;c3<corals.length;c3++){
        var co=corals[c3],cx3=co.x*W,cy3=H*.94,cs=Math.min(W,H)*.035;
        ctx.strokeStyle=co.c;ctx.lineWidth=4*DPR;ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx3,cy3);ctx.lineTo(cx3,cy3-cs*1.3);
        ctx.moveTo(cx3,cy3-cs*.6);ctx.lineTo(cx3-cs*.7,cy3-cs*1.5);
        ctx.moveTo(cx3,cy3-cs*.7);ctx.lineTo(cx3+cs*.7,cy3-cs*1.4);
        ctx.stroke();
      }
      // 海星
      ctx.fillStyle='#ff9e45';
      var stx=W*.46,sty=H*.965,ss=Math.min(W,H)*.016;
      for(var p5=0;p5<5;p5++){var a5=p5*1.2566-1.5708;
        ctx.beginPath();ctx.ellipse(stx+Math.cos(a5)*ss*.6,sty+Math.sin(a5)*ss*.6,ss*.42,ss*.2,a5,0,6.2832);ctx.fill();}
      ctx.beginPath();ctx.arc(stx,sty,ss*.4,0,6.2832);ctx.fill();
      // 宝箱 + 周期闪光
      chestT+=dt;
      var hx=W*.66,hy=H*.945,hs=Math.min(W,H)*.03;
      ctx.fillStyle='#8d5a24';ctx.fillRect(hx-hs,hy-hs*.5,hs*2,hs);
      ctx.fillStyle='#a9742f';
      ctx.beginPath();ctx.moveTo(hx-hs,hy-hs*.5);ctx.quadraticCurveTo(hx,hy-hs*1.25,hx+hs,hy-hs*.5);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffd54f';ctx.fillRect(hx-hs*.14,hy-hs*.55,hs*.28,hs*.5);
      var glint=Math.max(0,Math.sin(chestT*.0016));
      if(glint>.7){
        ctx.save();ctx.globalCompositeOperation='lighter';
        ctx.fillStyle='rgba(255,236,150,'+((glint-.7)*2.6).toFixed(3)+')';
        var gs=hs*(0.7+glint*.5);
        ctx.beginPath();
        ctx.moveTo(hx,hy-hs*1.1-gs);ctx.lineTo(hx+gs*.22,hy-hs*1.1);ctx.lineTo(hx,hy-hs*1.1+gs);ctx.lineTo(hx-gs*.22,hy-hs*1.1);
        ctx.closePath();ctx.fill();ctx.restore();
      }
    }
    return {draw:draw,rebuild:rebuild};
  }

  // 🗑️ v744(Hansen): 一款 IMAX 主题的影院场景(及其内部专属绘制函数)已整体删除·主题彻底移除·痕迹清净。全局 orient/turnPt 为其他场景共用故保留。

  // ============================================================
  // 🚀 theme_spacepark — 星际乐园: 亮紫蓝星空 + 卡通星球(笑脸) + 火箭穿梭 + UFO + 四角星闪
  // ============================================================
  function sceneSpace(){
    var sky=null, stars4=[], rocket=null, ufo=null, planets=null, shoot=[];
    var nextRocket=performance.now()+1600, nextShoot=performance.now()+2000;
    function rebuild(){
      sky=lg(0,0,0,H,[[0,'#311b92'],[.5,'#1f4dbf'],[1,'#1565c0']]);
      stars4=[];shoot=[];
      for(var i=0;i<26;i++)stars4.push({x:Math.random(),y:Math.random(),s:rnd(3,7)*DPR,ph:rnd(0,6.28),tw:rnd(.0012,.0028),col:pick(['255,235,140','180,225,255','255,190,225','200,255,210'])});
      planets=[
        {x:.8,y:.16,r:.085,c1:'#ff9e45',c2:'#ffd180',ring:true,face:true},
        {x:.16,y:.32,r:.05,c1:'#f06292',c2:'#ffc1e3',ring:false,face:true},
        {x:.3,y:.1,r:.034,c1:'#4dd0e1',c2:'#b2ebf2',ring:false,face:false}
      ];
      ufo={x:.5,y:.55,tx:.5,ty:.55,vx:0,vy:0,retgt:0,ph:rnd(0,6.28)};
    }
    function drawPlanet(P,t){
      var px=P.x*W,py=(P.y+Math.sin(t*.0003+P.x*9)*.008)*H,r=P.r*Math.min(W,H);
      if(P.ring){
        ctx.strokeStyle='rgba(255,224,150,.85)';ctx.lineWidth=r*.18;
        ctx.beginPath();ctx.ellipse(px,py,r*1.7,r*.5,0,3.4,6.0);ctx.stroke();
      }
      ctx.fillStyle=rg(px-r*.3,py-r*.3,0,r,[[0,P.c2],[1,P.c1]]);
      ctx.beginPath();ctx.arc(px,py,r,0,6.2832);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.25)';
      ctx.beginPath();ctx.ellipse(px-r*.32,py-r*.34,r*.26,r*.14,0,0,6.2832);ctx.fill();
      if(P.ring){
        ctx.strokeStyle='rgba(255,236,170,.95)';ctx.lineWidth=r*.18;
        ctx.beginPath();ctx.ellipse(px,py,r*1.7,r*.5,0,0.25,2.9);ctx.stroke();
      }
      if(P.face)face(px,py+r*.12,r*.8,'rgba(70,40,20,.75)');
    }
    function draw(dt,t){
      ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
      // 四角星(闪烁缩放)
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(var i=0;i<stars4.length;i++){
        var st=stars4[i], k=.45+.55*Math.abs(Math.sin(t*st.tw+st.ph)), s=st.s*k;
        var x=st.x*W,y=st.y*H;
        ctx.fillStyle='rgba('+st.col+','+(0.5+0.5*k).toFixed(3)+')';
        ctx.beginPath();
        ctx.moveTo(x,y-s);ctx.quadraticCurveTo(x+s*.18,y-s*.18,x+s,y);
        ctx.quadraticCurveTo(x+s*.18,y+s*.18,x,y+s);
        ctx.quadraticCurveTo(x-s*.18,y+s*.18,x-s,y);
        ctx.quadraticCurveTo(x-s*.18,y-s*.18,x,y-s);
        ctx.closePath();ctx.fill();
      }
      // 彩色流星
      var now=performance.now();
      if(now>=nextShoot){
        shoot.push({x:rnd(.2,1.05),y:rnd(0,.3),vx:-rnd(.0008,.0012),vy:rnd(.0005,.0008),life:1,col:pick(['255,205,86','255,138,216','129,212,250'])});
        nextShoot=now+rnd(2400,5000);
      }
      for(var s3=shoot.length-1;s3>=0;s3--){
        var sh=shoot[s3];sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.life-=.0008*dt;
        if(sh.life<=0){shoot.splice(s3,1);continue;}
        var hx=sh.x*W,hy=sh.y*H;
        var gl=lg(hx,hy,hx+W*.12,hy-H*.07,[[0,'rgba('+sh.col+','+sh.life.toFixed(3)+')'],[1,'rgba('+sh.col+',0)']]);
        ctx.strokeStyle=gl;ctx.lineWidth=2*DPR;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx+W*.12,hy-H*.07);ctx.stroke();
      }
      ctx.restore();
      // 卡通星球
      for(var p2=0;p2<planets.length;p2++)drawPlanet(planets[p2],t);
      // 火箭(招牌·正弦穿梭+火焰+点点星尾)
      if(!rocket&&now>=nextRocket){
        var dirR=Math.random()<.5?1:-1;
        rocket={p:dirR>0?-.25:1.25,dir:dirR,y0:rnd(.3,.62),v:rnd(.00018,.00024),ph:rnd(0,6.28)};
      }
      if(rocket){
        rocket.p+=rocket.dir*rocket.v*dt;
        if((rocket.dir>0&&rocket.p>1.35)||(rocket.dir<0&&rocket.p<-.35)){rocket=null;nextRocket=now+rnd(7000,12000);}
        else{
          var d=rocket.dir, rxp=rocket.p*W, ryp=(rocket.y0+Math.sin(rocket.p*7+rocket.ph)*.03)*H, rs=Math.min(W,H)*.04;
          // 星尾
          ctx.save();ctx.globalCompositeOperation='lighter';
          for(var tr=1;tr<=5;tr++){
            ctx.fillStyle='rgba(255,224,130,'+(0.5-tr*.08).toFixed(3)+')';
            ctx.beginPath();ctx.arc(rxp-d*rs*(1.4+tr*.8),ryp+Math.sin((rocket.p-tr*.02)*7+rocket.ph)*0,2.2*DPR,0,6.2832);ctx.fill();
          }
          // 火焰
          var fl3=.7+.3*Math.abs(Math.sin(t*.02));
          ctx.fillStyle='rgba(255,170,60,'+fl3.toFixed(2)+')';
          ctx.beginPath();
          ctx.moveTo(rxp-d*rs*.95,ryp-rs*.22);
          ctx.quadraticCurveTo(rxp-d*rs*(1.9*fl3+.6),ryp,rxp-d*rs*.95,ryp+rs*.22);
          ctx.closePath();ctx.fill();
          ctx.fillStyle='rgba(255,236,150,'+fl3.toFixed(2)+')';
          ctx.beginPath();
          ctx.moveTo(rxp-d*rs*.9,ryp-rs*.12);
          ctx.quadraticCurveTo(rxp-d*rs*(1.3*fl3+.5),ryp,rxp-d*rs*.9,ryp+rs*.12);
          ctx.closePath();ctx.fill();
          ctx.restore();
          // 机身
          ctx.fillStyle='#f5f7fb';
          ctx.beginPath();
          ctx.moveTo(rxp+d*rs*1.3,ryp);
          ctx.quadraticCurveTo(rxp+d*rs*.4,ryp-rs*.5,rxp-d*rs*.8,ryp-rs*.38);
          ctx.lineTo(rxp-d*rs*.8,ryp+rs*.38);
          ctx.quadraticCurveTo(rxp+d*rs*.4,ryp+rs*.5,rxp+d*rs*1.3,ryp);
          ctx.closePath();ctx.fill();
          // 头锥+尾翼
          ctx.fillStyle='#ef5350';
          ctx.beginPath();ctx.moveTo(rxp+d*rs*1.3,ryp);ctx.lineTo(rxp+d*rs*.75,ryp-rs*.42);ctx.lineTo(rxp+d*rs*.75,ryp+rs*.42);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(rxp-d*rs*.5,ryp-rs*.34);ctx.lineTo(rxp-d*rs*1.15,ryp-rs*.78);ctx.lineTo(rxp-d*rs*.8,ryp-rs*.3);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(rxp-d*rs*.5,ryp+rs*.34);ctx.lineTo(rxp-d*rs*1.15,ryp+rs*.78);ctx.lineTo(rxp-d*rs*.8,ryp+rs*.3);ctx.closePath();ctx.fill();
          // 舷窗
          ctx.fillStyle='#4dd0e1';
          ctx.beginPath();ctx.arc(rxp+d*rs*.25,ryp,rs*.2,0,6.2832);ctx.fill();
          ctx.strokeStyle='#e0e3ea';ctx.lineWidth=1.6*DPR;
          ctx.beginPath();ctx.arc(rxp+d*rs*.25,ryp,rs*.2,0,6.2832);ctx.stroke();
        }
      }
      // UFO(角色·缓慢游走+灯珠轮闪+悬浮光束)
      var U=ufo;
      U.retgt-=dt;
      if(U.retgt<=0){U.tx=rnd(.12,.88);U.ty=rnd(.4,.78);U.retgt=rnd(3200,6400);}
      U.vx+=(U.tx-U.x)*.0000016*dt; U.vy+=(U.ty-U.y)*.0000016*dt;
      U.vx*=.985;U.vy*=.985;
      U.x+=U.vx*dt;U.y+=U.vy*dt;
      var ux=U.x*W, uy=(U.y+Math.sin(t*.0012+U.ph)*.008)*H, us=Math.min(W,H)*.035;
      ctx.fillStyle=rg(ux,uy+us*1.6,0,us*2.4,[[0,'rgba(130,255,200,.22)'],[1,'rgba(130,255,200,0)']]);
      ctx.beginPath();ctx.moveTo(ux-us*.5,uy+us*.2);ctx.lineTo(ux+us*.5,uy+us*.2);ctx.lineTo(ux+us*1.2,uy+us*2.6);ctx.lineTo(ux-us*1.2,uy+us*2.6);ctx.closePath();ctx.fill();
      ctx.fillStyle='#9fd8ff';
      ctx.beginPath();ctx.arc(ux,uy-us*.25,us*.55,3.1416,6.2832);ctx.fill();
      ctx.fillStyle='#cfd5e3';
      ctx.beginPath();ctx.ellipse(ux,uy,us*1.25,us*.42,0,0,6.2832);ctx.fill();
      ctx.fillStyle='#8a93a8';
      ctx.beginPath();ctx.ellipse(ux,uy+us*.14,us*1.25,us*.3,0,0,6.2832);ctx.fill();
      for(var u2=0;u2<5;u2++){
        var ua=-2.6+u2*1.3, lxp=ux+Math.cos(ua)*us*1.0, lyp=uy+us*.08+Math.sin(ua)*us*.22;
        var lit=((t*.004+u2)|0)%5===0;
        ctx.fillStyle=lit?'#fff176':'rgba(255,241,118,.35)';
        ctx.beginPath();ctx.arc(lxp,lyp,us*.1,0,6.2832);ctx.fill();
      }
    }
    return {draw:draw,rebuild:rebuild};
  }

  // ============================================================
  // 🔴 v557: Hansen 亲制典藏双主题(Hansen 提供 899×1748 全图手绘背景, themes/ 目录)。
  //   架构: 真图背景 cover 绘制 + canvas 粒子特效层叠加; 图未加载完用同色系渐变兜底(秒开不白屏)。
  //   铁律不破: ①绝无旋转动画(星星=alpha/scale 脉冲, 糖果摆动=正弦平移+scaleX 宽度伸缩) ②粒子总量受控(<90) ③z-index:-1 永不挡交互。
  //   ☁️ theme_clouddream 云朵梦境工厂: 梦泡泡彩虹边上飘 + 四角星 twinkle + 小羊 Zzz 升起 + 金尘 + 招牌【梦境流星雨】(12-16s 一波 4 颗柔光长尾流星)。
  //   🍦 theme_rainbowsweet 彩虹甜心岛: 糖果/心形糖飘落 + 果冻气泡上浮 + 十字闪光 + 招牌【火山糖果喷发】(11-15s 火山口彩虹光晕脉冲 + 26 颗彩虹糖抛物喷射)。
  // ============================================================
  function makeBgImage(src, fallbackStops){
    var img=new Image(), ready=false, fb=null;
    img.onload=function(){ ready=true; };
    img.onerror=function(){ ready=false; };
    img.src=src;
    return {
      rebuild:function(){ fb=lg(0,0,0,H,fallbackStops); },
      draw:function(){
        if(ready && img.naturalWidth>0){
          var iw=img.naturalWidth, ih=img.naturalHeight;
          var sc=Math.max(W/iw,H/ih), dw=iw*sc, dh=ih*sc;
          ctx.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);
        } else { ctx.fillStyle=fb||'#777'; ctx.fillRect(0,0,W,H); }
      }
    };
  }
  // ☁️ 云朵梦境工厂
  function sceneCloudDream(){
    var bg=makeBgImage('themes/cloud_dream.jpg?v=1020',[[0,'#8a87d8'],[.4,'#b9a7e8'],[.75,'#f3c8e0'],[1,'#ffe2c9']]);
    var bubbles=[], stars=[], dust=[], zzz=[], meteors=[];
    var nextZ=performance.now()+2200, nextShow=performance.now()+5000;
    var EDGE=['255,170,210','170,210,255','255,220,150','205,170,255'];
    function rebuild(){
      bg.rebuild();
      bubbles=[];stars=[];dust=[];zzz=[];meteors=[];
      for(var i=0;i<9;i++)bubbles.push({x:rnd(.05,.95),y:rnd(0,1.25),r:rnd(.014,.038),v:rnd(.00004,.00009),sw:rnd(.4,1),ph:rnd(0,6.28),col:pick(EDGE)});
      for(var s2=0;s2<12;s2++)stars.push({x:rnd(.04,.96),y:rnd(.03,.6),s:rnd(.006,.013),ph:rnd(0,6.28),v2:rnd(.0012,.0024)});
      for(var d2=0;d2<16;d2++)dust.push({x:rnd(0,1),y:rnd(0,1.2),v:rnd(.00003,.00006),r:rnd(.8,1.8),ph:rnd(0,6.28)});
    }
    function drawStar(px,py,s,a){ // 四角星: 两个细菱形, 只透明度/大小脉冲, 无旋转
      ctx.fillStyle='rgba(255,250,210,'+a+')';
      ctx.beginPath();ctx.moveTo(px,py-s);ctx.quadraticCurveTo(px+s*.18,py-s*.18,px+s,py);ctx.quadraticCurveTo(px+s*.18,py+s*.18,px,py+s);ctx.quadraticCurveTo(px-s*.18,py+s*.18,px-s,py);ctx.quadraticCurveTo(px-s*.18,py-s*.18,px,py-s);ctx.fill();
    }
    function draw(dt,t){
      bg.draw();
      var now=performance.now();
      // 金尘
      for(var d=0;d<dust.length;d++){ var u=dust[d];
        u.y-=u.v*dt; if(u.y<-.02){u.y=1.05;u.x=rnd(0,1);}
        var ua=.32+.28*Math.sin(t*.002+u.ph);
        ctx.fillStyle='rgba(255,230,160,'+ua+')';
        ctx.beginPath();ctx.arc(u.x*W+Math.sin(t*.0008+u.ph)*8*DPR,u.y*H,u.r*DPR,0,6.2832);ctx.fill();
      }
      // 梦泡泡(白膜+彩虹描边+高光弧)
      for(var b=0;b<bubbles.length;b++){ var p=bubbles[b];
        p.y-=p.v*dt; if(p.y<-.08){p.y=1.12;p.x=rnd(.05,.95);}
        var bx=p.x*W+Math.sin(t*.0006+p.ph)*p.sw*16*DPR, by=p.y*H, br=p.r*W;
        ctx.fillStyle='rgba(255,255,255,.10)';
        ctx.beginPath();ctx.arc(bx,by,br,0,6.2832);ctx.fill();
        ctx.strokeStyle='rgba('+p.col+',.55)';ctx.lineWidth=1.4*DPR;
        ctx.beginPath();ctx.arc(bx,by,br,0,6.2832);ctx.stroke();
        ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=Math.max(1.2,br*.1);
        ctx.beginPath();ctx.arc(bx-br*.32,by-br*.32,br*.42,3.5,4.6);ctx.stroke();
      }
      // 四角星 twinkle
      for(var s3=0;s3<stars.length;s3++){ var st=stars[s3];
        var tw=.5+.5*Math.sin(t*st.v2+st.ph);
        drawStar(st.x*W,st.y*H,st.s*W*(0.72+tw*.38),.25+tw*.6);
      }
      // 小羊 Zzz(屏幕中下随机点升起 3 连 Z)
      if(now>=nextZ){ nextZ=now+rnd(2600,4200);
        var zx=rnd(.18,.7), zy=rnd(.55,.78);
        for(var k=0;k<3;k++)zzz.push({x:zx+k*.045,y:zy-k*.02,born:now+k*260,life:2300,s:(.027+k*.012)});
      }
      ctx.textAlign='center';ctx.textBaseline='middle';
      for(var z=zzz.length-1;z>=0;z--){ var Z=zzz[z];
        var age=now-Z.born; if(age<0)continue;
        if(age>Z.life){zzz.splice(z,1);continue;}
        var pr=age/Z.life, za=pr<.15?pr/.15:(1-pr)/.85;
        ctx.font='700 '+(Z.s*W)+'px Comic Sans MS, sans-serif';
        ctx.fillStyle='rgba(255,255,255,'+(za*.92)+')';
        ctx.strokeStyle='rgba(150,130,220,'+(za*.6)+')';ctx.lineWidth=2.5*DPR;
        var zpx=(Z.x+pr*.05)*W, zpy=(Z.y-pr*.12)*H;
        ctx.strokeText('Z',zpx,zpy); ctx.fillText('Z',zpx,zpy);
      }
      // 招牌: 梦境流星雨(右上→左下平移, 柔光长尾)
      if(now>=nextShow){ nextShow=now+rnd(12000,16000);
        for(var m=0;m<5;m++)meteors.push({x:rnd(.55,1.25),y:rnd(-.06,.22),vx:-rnd(.00028,.00038),vy:rnd(.00019,.00027),born:now+m*300,life:2100,col:pick(['255,214,255','190,224,255','255,238,190','255,255,255'])});
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(var m2=meteors.length-1;m2>=0;m2--){ var M=meteors[m2];
        var ag=now-M.born; if(ag<0)continue;
        if(ag>M.life){meteors.splice(m2,1);continue;}
        var mx=(M.x+M.vx*ag)*W, my=(M.y+M.vy*ag)*H;
        var ma=ag/M.life<.12?ag/M.life/.12:(1-ag/M.life)/.88;
        var tl=.15*W;
        var g=ctx.createLinearGradient(mx,my,mx-M.vx/Math.abs(M.vx)*-tl,my-tl*(M.vy/-M.vx));
        g=ctx.createLinearGradient(mx,my,mx+tl,my-tl*(M.vy/-M.vx));
        g.addColorStop(0,'rgba('+M.col+','+(ma*.85)+')');g.addColorStop(1,'rgba('+M.col+',0)');
        ctx.strokeStyle=g;ctx.lineWidth=5*DPR;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(mx+tl,my-tl*(M.vy/-M.vx));ctx.stroke();
        var hg=rg(mx,my,0,15*DPR,[[0,'rgba(255,255,255,'+(ma)+')'],[.35,'rgba('+M.col+','+(ma*.6)+')'],[1,'rgba('+M.col+',0)']]);
        ctx.fillStyle=hg;ctx.beginPath();ctx.arc(mx,my,15*DPR,0,6.2832);ctx.fill();
        ctx.fillStyle='rgba(255,255,255,'+ma+')';
        ctx.beginPath();ctx.arc(mx,my,4*DPR,0,6.2832);ctx.fill();
      }
      ctx.restore();
    }
    return {draw:draw,rebuild:rebuild};
  }
  // 🍦 彩虹甜心岛
  function sceneRainbowSweet(){
    var bg=makeBgImage('themes/rainbow_sweet.jpg?v=1020',[[0,'#63c4f5'],[.42,'#a4ddf7'],[.7,'#ffd9ec'],[1,'#ffe9b8']]);
    var candies=[], jellies=[], sparks=[], erupt=[];
    var nextShow=performance.now()+4500, glowT=-1;
    var CCOL=[['255,99,132','255,205,210'],['255,183,77','255,236,179'],['129,199,132','220,245,222'],['100,181,246','205,232,255'],['186,104,200','235,210,245'],['255,138,216','255,222,240']];
    function rebuild(){
      bg.rebuild();
      candies=[];jellies=[];sparks=[];erupt=[];
      for(var i=0;i<11;i++)candies.push({x:rnd(.03,.97),y:rnd(-.2,1),v:rnd(.00006,.00011),sw:rnd(.5,1.2),ph:rnd(0,6.28),r:rnd(.009,.016),col:pick(CCOL),heart:Math.random()<.4});
      for(var j=0;j<7;j++)jellies.push({x:rnd(.06,.94),y:rnd(.2,1.3),r:rnd(.012,.026),v:rnd(.00005,.00009),ph:rnd(0,6.28),col:pick(CCOL)});
      for(var s2=0;s2<12;s2++)sparks.push({x:rnd(.03,.97),y:rnd(.03,.85),s:rnd(.005,.01),ph:rnd(0,6.28),v2:rnd(.0015,.003)});
    }
    function drawHeart(px,py,s,fill,squish){ // 心形糖: scaleX 宽度伸缩模拟摆动(无旋转)
      ctx.fillStyle=fill;
      ctx.beginPath();
      var w2=s*squish;
      ctx.moveTo(px,py+s*.85);
      ctx.bezierCurveTo(px-w2*1.15,py+s*.1,px-w2*.85,py-s*.75,px,py-s*.18);
      ctx.bezierCurveTo(px+w2*.85,py-s*.75,px+w2*1.15,py+s*.1,px,py+s*.85);
      ctx.fill();
    }
    function draw(dt,t){
      bg.draw();
      var now=performance.now();
      // 糖果飘落
      for(var c=0;c<candies.length;c++){ var p=candies[c];
        p.y+=p.v*dt; if(p.y>1.08){p.y=-.08;p.x=rnd(.03,.97);}
        var cx=p.x*W+Math.sin(t*.0007+p.ph)*p.sw*14*DPR, cy=p.y*H, cr=p.r*W;
        var sq=.78+.22*Math.sin(t*.0011+p.ph);
        if(p.heart){
          ctx.lineWidth=2.2*DPR;ctx.strokeStyle='rgba(255,255,255,.95)';
          drawHeart(cx,cy,cr*1.2,'rgba('+p.col[0]+',.95)',sq); ctx.stroke();
          ctx.fillStyle='rgba(255,255,255,.8)';
          ctx.beginPath();ctx.arc(cx-cr*.34*sq,cy-cr*.3,cr*.2,0,6.2832);ctx.fill();
        } else {
          ctx.beginPath();ctx.ellipse(cx,cy,cr*sq,cr,0,0,6.2832);
          ctx.fillStyle='rgba('+p.col[0]+',.95)';ctx.fill();
          ctx.lineWidth=2.2*DPR;ctx.strokeStyle='rgba(255,255,255,.95)';ctx.stroke();
          ctx.fillStyle='rgba('+p.col[1]+',.95)';
          ctx.beginPath();ctx.ellipse(cx,cy,cr*.5*sq,cr*.5,0,0,6.2832);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,.8)';
          ctx.beginPath();ctx.arc(cx-cr*.32*sq,cy-cr*.32,cr*.16,0,6.2832);ctx.fill();
        }
      }
      // 果冻气泡上浮
      for(var j2=0;j2<jellies.length;j2++){ var q=jellies[j2];
        q.y-=q.v*dt; if(q.y<-.06){q.y=1.1;q.x=rnd(.06,.94);}
        var jx=q.x*W+Math.sin(t*.0005+q.ph)*12*DPR, jy=q.y*H, jr=q.r*W;
        ctx.fillStyle='rgba('+q.col[0]+',.18)';
        ctx.beginPath();ctx.arc(jx,jy,jr,0,6.2832);ctx.fill();
        ctx.strokeStyle='rgba('+q.col[0]+',.5)';ctx.lineWidth=1.3*DPR;
        ctx.beginPath();ctx.arc(jx,jy,jr,0,6.2832);ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,.85)';
        ctx.beginPath();ctx.arc(jx-jr*.34,jy-jr*.34,jr*.16,0,6.2832);ctx.fill();
      }
      // 十字闪光
      for(var s3=0;s3<sparks.length;s3++){ var sp=sparks[s3];
        var tw=.5+.5*Math.sin(t*sp.v2+sp.ph);
        var sx=sp.x*W, sy=sp.y*H, ss=sp.s*W*(0.6+tw*.5);
        ctx.strokeStyle='rgba(255,255,255,'+(.2+tw*.65)+')';ctx.lineWidth=1.6*DPR;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(sx-ss,sy);ctx.lineTo(sx+ss,sy);ctx.moveTo(sx,sy-ss);ctx.lineTo(sx,sy+ss);ctx.stroke();
      }
      // 招牌: 火山糖果喷发(火山口 ≈ 屏幕(0.5,0.30))
      if(now>=nextShow){ nextShow=now+rnd(11000,15000); glowT=now;
        for(var e=0;e<34;e++){
          erupt.push({x:.5,y:.17,vx:rnd(-.00015,.00015),vy:-rnd(.00024,.00036),born:now,life:rnd(2200,3000),col:pick(CCOL),r:rnd(.009,.018)});
        }
      }
      if(glowT>0){ var ga=(now-glowT)/900;
        if(ga<1){ var gr=(0.08+ga*.2)*W;
          var gg=rg(.5*W,.17*H,gr*.2,gr,[[0,'rgba(255,255,255,'+(.6*(1-ga))+')'],[.5,'rgba(255,170,220,'+(.4*(1-ga))+')'],[1,'rgba(255,220,120,0)']]);
          ctx.fillStyle=gg;ctx.beginPath();ctx.arc(.5*W,.17*H,gr,0,6.2832);ctx.fill();
        } else glowT=-1;
      }
      ctx.save();ctx.globalCompositeOperation='lighter';
      for(var e2=erupt.length-1;e2>=0;e2--){ var E=erupt[e2];
        var ag2=now-E.born;
        if(ag2>E.life){erupt.splice(e2,1);continue;}
        var ex=(E.x+E.vx*ag2)*W, ey=(E.y+E.vy*ag2+.00000016*ag2*ag2)*H;  // 重力(峰顶≈屏3%, 洒落到屏中)
        if(ey>H*1.05){erupt.splice(e2,1);continue;}
        var ea=ag2/E.life<.1?ag2/E.life/.1:(1-ag2/E.life)/.9;
        var er=E.r*W;
        // 彩色短尾(运动方向反向)
        var tvx=E.vx, tvy=E.vy+2*.00000016*ag2, tn=Math.sqrt(tvx*tvx+tvy*tvy)||1;
        var tlen=er*3.2;
        ctx.strokeStyle='rgba('+E.col[1]+','+(ea*.6)+')';ctx.lineWidth=er*1.1;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-tvx/tn*tlen,ey-tvy/tn*tlen);ctx.stroke();
        ctx.beginPath();ctx.arc(ex,ey,er,0,6.2832);
        ctx.fillStyle='rgba('+E.col[0]+','+(ea*.97)+')';ctx.fill();
        ctx.lineWidth=2*DPR;ctx.strokeStyle='rgba(255,255,255,'+(ea*.95)+')';ctx.stroke();
        ctx.fillStyle='rgba(255,255,255,'+(ea*.85)+')';
        ctx.beginPath();ctx.arc(ex-er*.3,ey-er*.3,er*.22,0,6.2832);ctx.fill();
      }
      ctx.restore();
    }
    return {draw:draw,rebuild:rebuild};
  }

  // 🖼️ v736(Hansen): 典藏画廊【主题专属特效】套件 — 每个主题配跟它内容相关的特效(蜂蜜坊飞蜂滴蜜/童话镇花瓣萤火/热气球港湾升彩球/汽车工坊齿轮火花/晚安旋律音符Zzz/魔法学校符文星火…)。一套可复用矢量元素绘制器 + sceneThemed 工厂(每主题组合2-4种相关元素)。铁律: 绝无旋转(只平移/缩放scaleX翻面/透明度), DPR<=2, document.hidden 暂停, 粒子受控。
  function _kStar(x,y,s,a,col){ ctx.fillStyle='rgba('+(col||'255,250,225')+','+a+')'; ctx.beginPath();ctx.moveTo(x,y-s);ctx.quadraticCurveTo(x+s*.2,y-s*.2,x+s,y);ctx.quadraticCurveTo(x+s*.2,y+s*.2,x,y+s);ctx.quadraticCurveTo(x-s*.2,y+s*.2,x-s,y);ctx.quadraticCurveTo(x-s*.2,y-s*.2,x,y-s);ctx.fill(); }
  function _kGlow(x,y,r,col,a){ var g=ctx.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,'rgba('+(col||'255,235,170')+','+a+')');g.addColorStop(1,'rgba('+(col||'255,235,170')+',0)'); ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,6.2832);ctx.fill(); }
  function _kCloud(x,y,s,a){ ctx.fillStyle='rgba(255,255,255,'+a+')'; var o=[[0,0,1],[-.7,.12,.72],[.72,.14,.74],[-.36,-.16,.62],[.4,-.14,.64]]; for(var i=0;i<o.length;i++){ctx.beginPath();ctx.arc(x+o[i][0]*s,y+o[i][1]*s,o[i][2]*s*.62,0,6.2832);ctx.fill();} }
  function _kHeart(x,y,s,a,col){ var c=col||'255,150,180'; var g=ctx.createRadialGradient(x-s*.3,y-s*.45,s*.04,x,y,s*1.2); g.addColorStop(0,'rgba(255,236,243,'+a+')');g.addColorStop(.45,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g; ctx.beginPath();ctx.moveTo(x,y+s*.35);ctx.bezierCurveTo(x-s*1.05,y-s*.4,x-s*.5,y-s,x,y-s*.32);ctx.bezierCurveTo(x+s*.5,y-s,x+s*1.05,y-s*.4,x,y+s*.35);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.6)+')';ctx.beginPath();ctx.ellipse(x-s*.32,y-s*.3,s*.2,s*.12,-0.6,0,6.2832);ctx.fill(); }
  function _kBubble(x,y,r,a,col){ ctx.fillStyle='rgba(255,255,255,'+(a*.45)+')'; ctx.beginPath();ctx.arc(x,y,r,0,6.2832);ctx.fill(); ctx.strokeStyle='rgba('+(col||'255,255,255')+','+a+')';ctx.lineWidth=1.3*DPR;ctx.beginPath();ctx.arc(x,y,r,0,6.2832);ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,'+(a*.9)+')';ctx.lineWidth=Math.max(1.1,r*.13);ctx.beginPath();ctx.arc(x-r*.32,y-r*.32,r*.4,3.5,4.6);ctx.stroke(); }
  function _kPetal(x,y,s,a,col,flip){ ctx.save();ctx.translate(x,y);ctx.scale(flip||1,1);ctx.fillStyle='rgba('+(col||'255,190,210')+','+a+')';ctx.beginPath();ctx.moveTo(0,-s);ctx.bezierCurveTo(s*.72,-s*.5,s*.5,s*.62,0,s);ctx.bezierCurveTo(-s*.5,s*.62,-s*.72,-s*.5,0,-s);ctx.fill();ctx.restore(); }
  function _kSteam(x,y,s,a){ _kGlow(x,y,s,'255,255,255',a*.55); }
  function _kNote(x,y,s,a,col){ ctx.fillStyle='rgba('+(col||'255,255,255')+','+a+')'; ctx.beginPath();ctx.ellipse(x,y,s*.52,s*.38,-.4,0,6.2832);ctx.fill(); ctx.fillRect(x+s*.38,y-s*1.55,s*.16,s*1.55); ctx.beginPath();ctx.moveTo(x+s*.54,y-s*1.55);ctx.quadraticCurveTo(x+s*1.15,y-s*1.32,x+s*.92,y-s*.8);ctx.quadraticCurveTo(x+s,y-s*1.12,x+s*.54,y-s*1.12);ctx.fill(); }
  function _kZ(x,y,s,a,col){ ctx.strokeStyle='rgba('+(col||'210,220,255')+','+a+')';ctx.lineWidth=Math.max(1.4,s*.2);ctx.lineCap='round';ctx.lineJoin='round'; ctx.beginPath();ctx.moveTo(x-s*.5,y-s*.6);ctx.lineTo(x+s*.5,y-s*.6);ctx.lineTo(x-s*.5,y+s*.6);ctx.lineTo(x+s*.5,y+s*.6);ctx.stroke(); }
  function _kHoney(x,y,s,a){ var g=ctx.createRadialGradient(x-s*.2,y-s*.3,s*.04,x,y,s*1.1); g.addColorStop(0,'rgba(255,246,205,'+a+')');g.addColorStop(.5,'rgba(255,200,70,'+a+')');g.addColorStop(1,'rgba(238,168,38,'+a+')'); ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,y-s);ctx.bezierCurveTo(x+s*.72,y-s*.1,x+s*.6,y+s,x,y+s);ctx.bezierCurveTo(x-s*.6,y+s,x-s*.72,y-s*.1,x,y-s);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.75)+')';ctx.beginPath();ctx.arc(x-s*.2,y,s*.15,0,6.2832);ctx.fill(); }
  function _kBee(x,y,s,a,flip){ ctx.save();ctx.translate(x,y);ctx.scale(flip||1,1); ctx.fillStyle='rgba(255,255,255,'+(a*.8)+')';ctx.beginPath();ctx.ellipse(s*.15,-s*.55,s*.5,s*.3,0,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(255,205,60,'+a+')';ctx.beginPath();ctx.ellipse(0,0,s,s*.66,0,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(60,48,30,'+a+')'; ctx.fillRect(-s*.3,-s*.62,s*.18,s*1.24); ctx.fillRect(s*.12,-s*.5,s*.16,s*1); ctx.restore(); }
  function _kBalloon(x,y,s,a,col){ var c=col||'255,140,140'; var bg=ctx.createLinearGradient(x-s,y-s,x+s,y+s*1.3); bg.addColorStop(0,'rgba(255,255,255,'+(a*.92)+')');bg.addColorStop(.35,'rgba('+c+','+a+')');bg.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=bg;ctx.beginPath();ctx.arc(x,y,s,Math.PI,0,false);ctx.bezierCurveTo(x+s,y+s*.55,x+s*.4,y+s*1.15,x,y+s*1.3);ctx.bezierCurveTo(x-s*.4,y+s*1.15,x-s,y+s*.55,x-s,y);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.45)+')';ctx.beginPath();ctx.ellipse(x-s*.42,y-s*.05,s*.15,s*.48,-0.2,0,6.2832);ctx.fill(); ctx.strokeStyle='rgba(150,110,70,'+a+')';ctx.lineWidth=1*DPR;ctx.beginPath();ctx.moveTo(x-s*.25,y+s*1.25);ctx.lineTo(x-s*.14,y+s*1.62);ctx.moveTo(x+s*.25,y+s*1.25);ctx.lineTo(x+s*.14,y+s*1.62);ctx.stroke(); ctx.fillStyle='rgba(160,115,75,'+a+')';ctx.fillRect(x-s*.2,y+s*1.58,s*.4,s*.28); }
  function _kCandy(x,y,s,a,col){ var c=col||'255,150,190'; var g=ctx.createRadialGradient(x-s*.22,y-s*.22,s*.04,x,y,s*.62); g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(.42,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g; ctx.beginPath();ctx.arc(x,y,s*.58,0,6.2832);ctx.fill(); ctx.fillStyle='rgba('+c+','+a+')'; ctx.beginPath();ctx.moveTo(x-s*.5,y);ctx.lineTo(x-s,y-s*.42);ctx.lineTo(x-s,y+s*.42);ctx.closePath();ctx.fill(); ctx.beginPath();ctx.moveTo(x+s*.5,y);ctx.lineTo(x+s,y-s*.42);ctx.lineTo(x+s,y+s*.42);ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.85)+')';ctx.beginPath();ctx.arc(x-s*.2,y-s*.2,s*.13,0,6.2832);ctx.fill(); }
  function _kBerry(x,y,s,a,col){ var c=col||'220,60,90'; var g=ctx.createRadialGradient(x-s*.32,y-s*.32,s*.04,x,y,s); g.addColorStop(0,'rgba(255,205,218,'+a+')');g.addColorStop(.5,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,s,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.85)+')';ctx.beginPath();ctx.arc(x-s*.33,y-s*.33,s*.17,0,6.2832);ctx.fill(); ctx.strokeStyle='rgba(120,180,90,'+a+')';ctx.lineWidth=1.6*DPR;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.1,y-s*1.7);ctx.stroke(); }
  function _kRune(x,y,s,a,col){ ctx.strokeStyle='rgba('+(col||'195,180,255')+','+a+')';ctx.lineWidth=Math.max(1.2,s*.15);ctx.lineCap='round';ctx.lineJoin='round'; ctx.beginPath();ctx.arc(x,y,s,0,6.2832);ctx.stroke(); ctx.beginPath();ctx.moveTo(x,y-s*.62);ctx.lineTo(x+s*.54,y+s*.42);ctx.lineTo(x-s*.54,y+s*.42);ctx.closePath();ctx.stroke(); ctx.fillStyle='rgba('+(col||'195,180,255')+','+a+')';ctx.beginPath();ctx.arc(x,y,s*.16,0,6.2832);ctx.fill(); }
  function _kSpark(x,y,s,a,col){ var c=col||'255,240,180'; ctx.strokeStyle='rgba('+c+','+a+')';ctx.lineWidth=Math.max(1,s*.16);ctx.lineCap='round'; ctx.beginPath();ctx.moveTo(x-s,y);ctx.lineTo(x+s,y);ctx.moveTo(x,y-s);ctx.lineTo(x,y+s);ctx.stroke(); ctx.lineWidth=Math.max(.8,s*.1);ctx.beginPath();ctx.moveTo(x-s*.5,y-s*.5);ctx.lineTo(x+s*.5,y+s*.5);ctx.moveTo(x-s*.5,y+s*.5);ctx.lineTo(x+s*.5,y-s*.5);ctx.stroke(); }
  function _kGear(x,y,s,a,col){ ctx.fillStyle='rgba('+(col||'175,180,195')+','+a+')'; var T=8; ctx.beginPath(); for(var i=0;i<T*2;i++){var ang=i/(T*2)*6.2832;var rr=(i%2?s:s*.76);ctx.lineTo(x+Math.cos(ang)*rr,y+Math.sin(ang)*rr);} ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(50,52,62,'+a+')';ctx.beginPath();ctx.arc(x,y,s*.34,0,6.2832);ctx.fill(); }
  function _kYarn(x,y,s,a,col){ ctx.fillStyle='rgba('+(col||'255,170,150')+','+a+')';ctx.beginPath();ctx.arc(x,y,s,0,6.2832);ctx.fill(); ctx.strokeStyle='rgba(255,255,255,'+(a*.4)+')';ctx.lineWidth=1.1*DPR; for(var i=-2;i<=2;i++){ctx.beginPath();ctx.arc(x,y,s*.96,i*.55,i*.55+2.3);ctx.stroke();} }
  function _kShard(x,y,s,a,col){ ctx.fillStyle='rgba('+(col||'185,205,255')+','+a+')';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.5,y);ctx.lineTo(x,y+s);ctx.lineTo(x-s*.5,y);ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.5)+')';ctx.beginPath();ctx.moveTo(x,y-s);ctx.lineTo(x+s*.5,y);ctx.lineTo(x,y);ctx.closePath();ctx.fill(); }
  function _kSeed(x,y,s,a,col){ _kGlow(x,y,s*2.4,col||'185,255,170',a*.5); ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.beginPath();ctx.arc(x,y,s*.5,0,6.2832);ctx.fill(); }
  function _kFirefly(x,y,s,a){ _kGlow(x,y,s*3.2,'205,255,150',a*.6); ctx.fillStyle='rgba(232,255,185,'+a+')';ctx.beginPath();ctx.arc(x,y,s*.6,0,6.2832);ctx.fill(); }
  function _kPage(x,y,s,a){ ctx.fillStyle='rgba(255,250,236,'+a+')';ctx.fillRect(x-s*.7,y-s,s*1.4,s*2); ctx.strokeStyle='rgba(165,150,130,'+(a*.6)+')';ctx.lineWidth=1*DPR; for(var i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x-s*.48,y+i*s*.32);ctx.lineTo(x+s*.48,y+i*s*.32);ctx.stroke();} }

  function _kWisp(x,y,s,a,col){ var c=col||'185,210,255'; var g=ctx.createRadialGradient(x,y,s*.1,x,y,s); g.addColorStop(0,'rgba('+c+','+a+')');g.addColorStop(.55,'rgba('+c+','+(a*.5)+')');g.addColorStop(1,'rgba('+c+',0)'); ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,s,0,6.2832);ctx.fill(); ctx.fillStyle='rgba('+c+','+(a*.9)+')';ctx.beginPath();ctx.arc(x-s*.42,y-s*.52,s*.2,0,6.2832);ctx.arc(x+s*.42,y-s*.52,s*.2,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+a+')';ctx.beginPath();ctx.arc(x-s*.26,y-s*.04,s*.11,0,6.2832);ctx.arc(x+s*.26,y-s*.04,s*.11,0,6.2832);ctx.fill(); }
  // 🍰 v741(Hansen): 星露点心坊【点心烟花】专属点心绘制器 — 小蛋糕/棒棒糖/马卡龙/甜甜圈(配已有 _kCandy 糖果)。绝无旋转, 渐变+高光果冻质感。
  function _kCake(x,y,s,a,col){ var c=col||'255,150,190'; ctx.fillStyle='rgba(228,172,118,'+a+')'; ctx.beginPath();ctx.moveTo(x-s*.58,y+s*.08);ctx.lineTo(x+s*.58,y+s*.08);ctx.lineTo(x+s*.44,y+s*.82);ctx.lineTo(x-s*.44,y+s*.82);ctx.closePath();ctx.fill(); ctx.strokeStyle='rgba(196,144,96,'+(a*.7)+')';ctx.lineWidth=Math.max(.7,s*.06); for(var i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(x+i*s*.2,y+s*.1);ctx.lineTo(x+i*s*.16,y+s*.8);ctx.stroke();} var g=ctx.createRadialGradient(x-s*.2,y-s*.34,s*.05,x,y-s*.1,s*.82); g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(.5,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g; ctx.beginPath();ctx.moveTo(x-s*.6,y+s*.1);ctx.bezierCurveTo(x-s*.7,y-s*.5,x-s*.18,y-s*.72,x,y-s*.72);ctx.bezierCurveTo(x+s*.18,y-s*.72,x+s*.7,y-s*.5,x+s*.6,y+s*.1);ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.7)+')';ctx.beginPath();ctx.ellipse(x-s*.22,y-s*.3,s*.15,s*.09,-0.5,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(232,66,86,'+a+')';ctx.beginPath();ctx.arc(x,y-s*.74,s*.15,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.75)+')';ctx.beginPath();ctx.arc(x-s*.05,y-s*.79,s*.05,0,6.2832);ctx.fill(); }
  function _kLolli(x,y,s,a,col){ var c=col||'255,120,170'; ctx.strokeStyle='rgba(255,255,255,'+(a*.95)+')';ctx.lineWidth=Math.max(1.4,s*.15);ctx.lineCap='round'; ctx.beginPath();ctx.moveTo(x,y+s*.05);ctx.lineTo(x,y+s*1.0);ctx.stroke(); var cy=y-s*.38; var g=ctx.createRadialGradient(x-s*.22,cy-s*.18,s*.04,x,cy,s*.62); g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(.5,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,cy,s*.58,0,6.2832);ctx.fill(); ctx.strokeStyle='rgba(255,255,255,'+(a*.8)+')';ctx.lineWidth=Math.max(1,s*.11);ctx.lineCap='round';ctx.beginPath(); for(var k=0;k<=26;k++){var th=k/26*6.2832*1.5;var rr=s*.48*(k/26);var sx=x+Math.cos(th)*rr,sy=cy+Math.sin(th)*rr;if(k===0)ctx.moveTo(sx,sy);else ctx.lineTo(sx,sy);} ctx.stroke(); ctx.fillStyle='rgba(255,255,255,'+(a*.75)+')';ctx.beginPath();ctx.arc(x-s*.2,cy-s*.2,s*.1,0,6.2832);ctx.fill(); }
  function _kMacaron(x,y,s,a,col){ var c=col||'255,170,200'; function sh(cy){ var g=ctx.createRadialGradient(x-s*.2,cy-s*.12,s*.04,x,cy,s*.66); g.addColorStop(0,'rgba(255,255,255,'+a+')');g.addColorStop(.55,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(x,cy,s*.6,s*.36,0,0,6.2832);ctx.fill(); } sh(y-s*.2); sh(y+s*.2); ctx.fillStyle='rgba(255,240,200,'+a+')';ctx.beginPath();ctx.ellipse(x,y,s*.5,s*.16,0,0,6.2832);ctx.fill(); ctx.fillStyle='rgba(255,255,255,'+(a*.6)+')';ctx.beginPath();ctx.ellipse(x-s*.2,y-s*.34,s*.14,s*.07,-0.4,0,6.2832);ctx.fill(); }
  function _kDonut(x,y,s,a,col){ var c=col||'255,150,180'; ctx.strokeStyle='rgba(226,182,132,'+a+')';ctx.lineWidth=s*.4;ctx.lineCap='round'; ctx.beginPath();ctx.arc(x,y,s*.5,0,6.2832);ctx.stroke(); var g=ctx.createLinearGradient(x,y-s*.7,x,y+s*.1); g.addColorStop(0,'rgba(255,255,255,'+(a*.9)+')');g.addColorStop(.5,'rgba('+c+','+a+')');g.addColorStop(1,'rgba('+c+','+a+')'); ctx.strokeStyle=g;ctx.lineWidth=s*.38;ctx.lineCap='round';ctx.beginPath();ctx.arc(x,y,s*.5,Math.PI*0.92,Math.PI*2.28,false);ctx.stroke(); var sp=[[-.28,-.46],[.06,-.6],[.38,-.42],[-.46,-.16],[.46,-.06],[.0,-.34]]; var sc=['255,255,255','120,200,255','255,228,120','150,235,160','255,140,190']; ctx.lineWidth=Math.max(1,s*.09);ctx.lineCap='round'; for(var i=0;i<sp.length;i++){ctx.strokeStyle='rgba('+sc[i%sc.length]+','+a+')';ctx.beginPath();ctx.moveTo(x+sp[i][0]*s,y+sp[i][1]*s);ctx.lineTo(x+sp[i][0]*s+s*.13,y+sp[i][1]*s-s*.06);ctx.stroke();} }
  function sceneThemed(src, fbStops, layers, event){
    var bg=makeBgImage(src, fbStops);
    var L=[], fx=[], flash=null;
    var nextEv=performance.now()+(event?rnd(1800,3200):1e15);
    function mk(c){ var ps=[],n=c.n||8; for(var i=0;i<n;i++){ ps.push({ x:rnd(0,1), y:rnd(-.12,1.18), s:rnd(c.s[0],c.s[1]), v:c.v?rnd(c.v[0],c.v[1]):rnd(.00003,.00007), ph:rnd(0,6.2832), sw:rnd(.4,1.2), flip:Math.random()<.5?1:-1, a:c.a?rnd(c.a[0],c.a[1]):rnd(.45,.8), col:(c.col&&c.col.push)?pick(c.col):c.col }); } return ps; }
    function rebuild(){ bg.rebuild(); L=[]; for(var i=0;i<layers.length;i++){ L.push({c:layers[i],ps:mk(layers[i])}); } fx=[]; flash=null; nextEv=performance.now()+(event?rnd(1800,3200):1e15); }
    function drawOne(kind,x,y,s,a,col,flip){ var _ad=(kind==='star'||kind==='spark'||kind==='firefly'||kind==='glow'||kind==='bokeh'); if(_ad){ctx.save();ctx.globalCompositeOperation='lighter';} switch(kind){
      case 'cloud':_kCloud(x,y,s,a*.85);break; case 'heart':_kHeart(x,y,s,a,col);break; case 'star':_kStar(x,y,s,a,col);break;
      case 'bubble':_kBubble(x,y,s,a,col);break; case 'petal':_kPetal(x,y,s,a,col,flip);break; case 'steam':_kSteam(x,y,s,a);break;
      case 'note':_kNote(x,y,s,a,col);break; case 'zzz':_kZ(x,y,s,a,col);break; case 'honey':_kHoney(x,y,s,a);break;
      case 'bee':_kBee(x,y,s,a,flip);break; case 'balloon':_kBalloon(x,y,s,a,col);break; case 'candy':_kCandy(x,y,s,a,col);break;
      case 'berry':_kBerry(x,y,s,a,col);break; case 'rune':_kRune(x,y,s,a,col);break; case 'spark':_kSpark(x,y,s,a,col);break;
      case 'gear':_kGear(x,y,s,a,col);break; case 'yarn':_kYarn(x,y,s,a,col);break; case 'shard':_kShard(x,y,s,a,col);break;
      case 'seed':_kSeed(x,y,s,a,col);break; case 'firefly':_kFirefly(x,y,s,a);break; case 'page':_kPage(x,y,s,a);break;
      case 'cake':_kCake(x,y,s,a,col);break; case 'lolli':_kLolli(x,y,s,a,col);break; case 'macaron':_kMacaron(x,y,s,a,col);break; case 'donut':_kDonut(x,y,s,a,col);break;
      case 'bokeh':_kGlow(x,y,s*1.6,col,a);break; case 'glow':_kGlow(x,y,s*2.6,col,a*.55);break; } if(_ad)ctx.restore(); }
    function spawnEvent(now){
      var ev=event, o=ev.origin||[.5,.4], ox=o[0], oy=o[1], n=ev.n||20, el=ev.el, els=ev.els, cols=ev.cols, col=ev.col||'255,240,200', A=ev.arche, i, a, sp;
      if(ev.flash) flash={x:ox,y:oy,col:ev.flash,born:now,life:1000,max:(ev.flashR||.22)};
      if(A==='erupt'){ for(i=0;i<n;i++){ a=(-1.5708)+rnd(-.55,.55); sp=rnd(.00026,.00046); fx.push({k:'phys',el:el,x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:.00000024,s:rnd(.013,.026),col:cols?pick(cols):col,born:now,life:rnd(2200,3200),tail:1}); } }
      else if(A==='burst'){ for(i=0;i<n;i++){ a=rnd(0,6.2832); sp=rnd(.00019,.0004); fx.push({k:'sweet',el:(els&&els.length?pick(els):el),x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:.00000019,s:rnd(.064,.096),col:cols?pick(cols):col,born:now,life:rnd(2400,3200)}); } }   /* 🍰v742 点心烟花: 360°向四周爆射【大而清晰的实心点心】(蛋糕/棒棒糖/马卡龙/甜甜圈/糖果)·重力抛物·k:sweet 实心不透明·无拖尾无发光晕 */
      else if(A==='pour'){ for(i=0;i<n;i++){ fx.push({k:'phys',el:el,x:ox+rnd(-.012,.012),y:oy,vx:rnd(-.00004,.00012),vy:rnd(.00006,.00016),g:.00000026,s:rnd(.011,.02),col:cols?pick(cols):col,born:now+i*70,life:rnd(2400,3200),tail:0}); } }
      else if(A==='converge'){ for(i=0;i<n;i++){ a=rnd(0,6.2832); var rad=rnd(.42,.62); fx.push({k:'conv',el:el,x:ox+Math.cos(a)*rad,y:oy+Math.sin(a)*rad*1.5,tx:ox,ty:oy,spd:rnd(.0007,.0012),s:rnd(.01,.02),col:cols?pick(cols):col,born:now+i*45,life:5000}); } }
      else if(A==='launch'){ for(i=0;i<(ev.n||2);i++){ fx.push({k:'launch',el:el,x:ox+rnd(-.04,.04),y:oy,vy:rnd(.00026,.0004),drift:rnd(-.00004,.00004),s:rnd(.032,.052),col:cols?pick(cols):col,born:now+i*550,life:rnd(3200,4400)}); } }
      else if(A==='bloom'){ for(i=0;i<n;i++){ a=rnd(0,6.2832); sp=rnd(.00006,.0002); fx.push({k:'phys',el:el,x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.00006,g:.00000007,s:rnd(.014,.026),col:cols?pick(cols):col,born:now,life:rnd(2600,3600),tail:0}); } }
      else if(A==='flare'){ for(i=0;i<2;i++) fx.push({k:'ring2',x:ox,y:oy,col:col,max:rnd(.26,.4),born:now+i*320,life:1300}); for(i=0;i<(n||14);i++){ a=rnd(0,6.2832); sp=rnd(.0003,.0007); fx.push({k:'phys',el:'spark',x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,g:0,s:rnd(.008,.016),col:col,born:now,life:rnd(700,1100),tail:0}); } }
      else if(A==='flutter'){ for(i=0;i<n;i++){ a=(-1.5708)+rnd(-1,1); sp=rnd(.00012,.0003); fx.push({k:'flut',el:el,x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,s:rnd(.02,.034),col:cols?pick(cols):col,born:now,life:rnd(2800,3800),ph:rnd(0,6.2832)}); } }
      else if(A==='meteor'){ for(i=0;i<n;i++) fx.push({k:'meteor',x:rnd(.05,.8),y:rnd(-.05,.2),ang:rnd(.5,.85),len:rnd(.18,.3),col:cols?pick(cols):col,born:now+i*200,life:1050}); }
      else if(A==='summon'){ for(i=0;i<2;i++) fx.push({k:'ring2',x:ox,y:oy,col:col,max:rnd(.2,.32),born:now+i*300,life:1200}); for(i=0;i<(ev.n||5);i++){ a=rnd(0,6.2832); sp=rnd(.00005,.00014); fx.push({k:'wisp',x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-.00004,s:rnd(.022,.04),col:cols?pick(cols):col,born:now+i*150,life:rnd(2800,3800),ph:rnd(0,6.2832)}); } }
      else if(A==='warp'){ for(i=0;i<n;i++){ var wd=Math.random()<.5?1:-1; fx.push({k:'warp',x:(wd>0?-.12:1.12),y:rnd(.05,.95),vx:wd*rnd(.0012,.0024),len:rnd(.1,.2),col:cols?pick(cols):col,born:now+i*50,life:1500}); } }
      else if(A==='rays'){ fx.push({k:'rays',x:ox,y:oy,col:col,born:now,life:2400}); for(i=0;i<(ev.n||10);i++){ fx.push({k:'phys',el:el,x:rnd(.1,.9),y:rnd(-.05,.2),vx:rnd(-.00005,.00005),vy:rnd(.00006,.00012),g:.00000004,s:rnd(.016,.028),col:cols?pick(cols):col,born:now+i*120,life:rnd(2800,3600),tail:0}); } }
      else if(A==='stream'){ for(i=0;i<n;i++){ fx.push({k:'phys',el:el,x:ox+rnd(-.03,.03),y:oy,vx:0,vy:-rnd(.0002,.00034),g:0,s:rnd(.016,.028),col:cols?pick(cols):col,born:now+i*150,life:rnd(2800,3800),tail:0,sway:rnd(.6,1.3),ph:rnd(0,6.2832)}); } }
      else if(A==='spiral'){ /* 🕺v770 音符螺旋(太空步/旋转的形状): 沿阿基米德螺旋按序生成音符·几乎静止只极缓上浮淡出·形成清晰螺旋"旋转形状"·铁律绝无旋转动画(纯布点·元素不转·不闪不震) */ var turns=ev.turns||2.3, maxR=ev.maxR||.34, asp=W/H, a0=rnd(0,6.2832); for(i=0;i<n;i++){ var fr=i/((n-1)||1); var ang=a0+fr*6.2832*turns; var rad=maxR*Math.pow(fr,.82); fx.push({k:'phys',el:el||'note',x:ox+Math.cos(ang)*rad,y:oy+Math.sin(ang)*rad*asp,vx:Math.cos(ang)*.000016,vy:Math.sin(ang)*.000016*asp-.00004,g:0,s:rnd(.02,.032),col:cols?pick(cols):col,born:now+i*46,life:rnd(1700,2400),tail:0,sway:rnd(.25,.6),ph:rnd(0,6.2832)}); } }
    }
    function drawFlash(now){ if(!flash)return; var ag=(now-flash.born)/flash.life; if(ag>=1){flash=null;return;} var r=(flash.max*(.3+ag*.7))*W; ctx.save();ctx.globalCompositeOperation='lighter'; var g=rg(flash.x*W,flash.y*H,r*.15,r,[[0,'rgba(255,255,255,'+(.7*(1-ag))+')'],[.5,'rgba('+flash.col+','+(.5*(1-ag))+')'],[1,'rgba('+flash.col+',0)']]); ctx.fillStyle=g;ctx.beginPath();ctx.arc(flash.x*W,flash.y*H,r,0,6.2832);ctx.fill(); ctx.restore(); }
    function drawFx(dt,t,now){
      for(var i=fx.length-1;i>=0;i--){ var f=fx[i], age=now-f.born; if(age<0) continue; if(age>f.life){fx.splice(i,1);continue;}
        var pr=age/f.life, aa=(pr<.12?pr/.12:(pr>.82?(1-pr)/.18:1));
        if(f.k==='phys'){ f.vy+=(f.g||0)*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; if(f.y>1.14||f.y<-.16){fx.splice(i,1);continue;} var px=(f.x+(f.sway?Math.sin(t*.0011+f.ph)*.025*f.sway:0))*W,py=f.y*H,s=f.s*W;
          if(f.tail){ var tn=Math.sqrt(f.vx*f.vx+f.vy*f.vy)||1; ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba('+f.col+','+(aa*.5)+')';ctx.lineWidth=s*.9;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-f.vx/tn*s*3.2,py-f.vy/tn*s*3.2);ctx.stroke();ctx.restore(); }
          ctx.save();ctx.globalCompositeOperation='lighter';_kGlow(px,py,s*1.5,f.col,aa*.35);ctx.restore();
          drawOne(f.el,px,py,s,aa,f.col,(Math.sin(t*.004+f.x*30)>0?1:-1)); }
        else if(f.k==='sweet'){ f.vy+=(f.g||0)*dt; f.x+=f.vx*dt; f.y+=f.vy*dt; if(f.y>1.2||f.y<-.2){fx.splice(i,1);continue;} var px=f.x*W,py=f.y*H,s=f.s*W; var sa=(pr>.78?(1-pr)/.22:1); ctx.save();ctx.fillStyle='rgba(34,20,40,'+(sa*.34)+')';ctx.beginPath();ctx.ellipse(px,py+s*.66,s*.6,s*.22,0,0,6.2832);ctx.fill();ctx.restore(); drawOne(f.el,px,py,s,sa,f.col,1); }   /* 🍰v742 实心点心: 不透明实心绘制(无globalCompositeOperation lighter·无拖尾·无发光晕)·仅柔和深色投影分离繁复背景·末22%才淡出 */
        else if(f.k==='conv'){ var dx=f.tx-f.x, dy=f.ty-f.y, d=Math.sqrt(dx*dx+dy*dy)||1; if(d<.02){ flash={x:f.tx,y:f.ty,col:f.col,born:now,life:450,max:.09}; fx.splice(i,1); continue; } f.x+=dx/d*f.spd*dt; f.y+=dy/d*f.spd*dt; var px=f.x*W,py=f.y*H,s=f.s*W; ctx.save();ctx.globalCompositeOperation='lighter';_kGlow(px,py,s*1.6,f.col,.4);ctx.restore(); drawOne(f.el,px,py,s,Math.min(1,aa+.3),f.col,1); }
        else if(f.k==='launch'){ f.y-=f.vy*dt; f.x+=f.drift*dt; if(f.y<-.16){fx.splice(i,1);continue;} var px=f.x*W,py=f.y*H,s=f.s*W*(1-pr*.25); ctx.save();ctx.globalCompositeOperation='lighter';_kGlow(px,py,s*1.3,f.col||'255,235,180',aa*.4);ctx.restore(); drawOne(f.el,px,py,s,aa,f.col,1); }
        else if(f.k==='flut'){ f.x+=f.vx*dt; f.y+=f.vy*dt; f.vy+=.00000004*dt; var px=f.x*W,py=f.y*H,s=f.s*W; drawOne(f.el,px,py,s,aa,f.col,(Math.sin(t*.003+f.ph)>0?1:-1)); }
        else if(f.k==='ring2'){ var r=pr*f.max*W; ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle='rgba('+f.col+','+(aa*.85)+')';ctx.lineWidth=4*DPR;ctx.beginPath();ctx.arc(f.x*W,f.y*H,r,0,6.2832);ctx.stroke();ctx.strokeStyle='rgba('+f.col+','+(aa*.4)+')';ctx.lineWidth=2*DPR;ctx.beginPath();ctx.arc(f.x*W,f.y*H,r*.76,0,6.2832);ctx.stroke();_kGlow(f.x*W,f.y*H,r*.6,f.col,aa*.28);ctx.restore(); }
        else if(f.k==='meteor'){ var hx=(f.x+Math.cos(f.ang)*pr*.55)*W, hy=(f.y+Math.sin(f.ang)*pr*.55)*H, tx=hx-Math.cos(f.ang)*f.len*W, ty=hy-Math.sin(f.ang)*f.len*H; ctx.save();ctx.globalCompositeOperation='lighter'; var g=ctx.createLinearGradient(hx,hy,tx,ty); g.addColorStop(0,'rgba('+f.col+','+(aa*.95)+')'); g.addColorStop(1,'rgba('+f.col+',0)'); ctx.strokeStyle=g;ctx.lineWidth=5*DPR;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(tx,ty);ctx.stroke(); ctx.strokeStyle='rgba(255,255,255,'+(aa*.9)+')';ctx.lineWidth=1.8*DPR;ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx-Math.cos(f.ang)*f.len*W*.5,hy-Math.sin(f.ang)*f.len*H*.5);ctx.stroke(); _kGlow(hx,hy,17*DPR,f.col,aa*.6); ctx.fillStyle='rgba(255,255,255,'+aa+')';ctx.beginPath();ctx.arc(hx,hy,2.6*DPR,0,6.2832);ctx.fill(); ctx.restore(); }
        else if(f.k==='wisp'){ f.x+=f.vx*dt; f.y+=f.vy*dt; var wx=(f.x+Math.sin(t*.001+f.ph)*.02)*W, wy=f.y*H, ws=f.s*W; ctx.save();ctx.globalCompositeOperation='lighter';_kWisp(wx,wy,ws,aa*.95,f.col);ctx.restore(); }
        else if(f.k==='warp'){ f.x+=f.vx*dt; if(f.x<-.18||f.x>1.18){fx.splice(i,1);continue;} var wx=f.x*W, wy=f.y*H, tx=wx-(f.vx>0?1:-1)*f.len*W; ctx.save();ctx.globalCompositeOperation='lighter'; var wg2=ctx.createLinearGradient(wx,wy,tx,wy); wg2.addColorStop(0,'rgba('+f.col+','+(aa*.5)+')');wg2.addColorStop(1,'rgba('+f.col+',0)'); ctx.strokeStyle=wg2;ctx.lineWidth=7*DPR;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(tx,wy);ctx.stroke(); var wg=ctx.createLinearGradient(wx,wy,tx,wy); wg.addColorStop(0,'rgba(255,255,255,'+(aa*.95)+')');wg.addColorStop(.4,'rgba('+f.col+','+(aa*.85)+')');wg.addColorStop(1,'rgba('+f.col+',0)'); ctx.strokeStyle=wg;ctx.lineWidth=3.4*DPR;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(wx,wy);ctx.lineTo(tx,wy);ctx.stroke(); _kGlow(wx,wy,9*DPR,f.col,aa*.6); ctx.fillStyle='rgba(255,255,255,'+aa+')';ctx.beginPath();ctx.arc(wx,wy,2.8*DPR,0,6.2832);ctx.fill(); ctx.restore(); }
        else if(f.k==='rays'){ var ny=7; ctx.save();ctx.globalCompositeOperation='lighter'; for(var ri=0;ri<ny;ri++){ var rang=(Math.PI*0.2)+(ri/(ny-1))*(Math.PI*0.6); var pls=aa*(.1+.09*Math.sin(t*.002+ri*1.3)); var rl=.72*H, ex=f.x*W+Math.cos(rang)*rl, ey=f.y*H+Math.sin(rang)*rl; var rgg=ctx.createLinearGradient(f.x*W,f.y*H,ex,ey); rgg.addColorStop(0,'rgba('+f.col+','+pls+')');rgg.addColorStop(1,'rgba('+f.col+',0)'); ctx.strokeStyle=rgg;ctx.lineWidth=11*DPR;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(f.x*W,f.y*H);ctx.lineTo(ex,ey);ctx.stroke(); } _kGlow(f.x*W,f.y*H,42*DPR,f.col,aa*.3); ctx.restore(); }
      }
    }
    function draw(dt,t){
      bg.draw(); var now=performance.now();
      for(var li=0;li<L.length;li++){ var c=L[li].c, ps=L[li].ps, m=c.motion||'rise';
        for(var i=0;i<ps.length;i++){ var p=ps[i], px,py,pa=p.a, fl=p.flip;
          if(m==='rise'){ p.y-=p.v*dt; if(p.y<-.14){p.y=1.16;p.x=rnd(0,1);} px=p.x*W+Math.sin(t*.0006+p.ph)*p.sw*16*DPR; py=p.y*H; }
          else if(m==='wander'){ px=(p.x+Math.sin(t*.00042+p.ph)*.06)*W; py=(p.y+Math.cos(t*.00051+p.ph*1.3)*.05)*H; pa=p.a*(.4+.6*Math.abs(Math.sin(t*.0014+p.ph))); fl=Math.sin(t*.0006+p.ph)>0?1:-1; }
          else if(m==='drift'){ px=(p.x+Math.sin(t*.0003+p.ph)*.05)*W; py=(p.y+Math.cos(t*.00035+p.ph)*.04)*H; pa=p.a*(.55+.45*Math.sin(t*.0009+p.ph)); }
          else { px=p.x*W; py=p.y*H; pa=p.a*(.22+.78*(.5+.5*Math.sin(t*.0018+p.ph))); }
          drawOne(c.kind, px, py, p.s*W, pa, p.col, fl);
        }
      }
      if(event){ if(now>=nextEv){ nextEv=now+rnd(event.every[0],event.every[1]); spawnEvent(now); } drawFlash(now); drawFx(dt,t,now); }
    }
    return {rebuild:rebuild, draw:draw};
  }

  var SCENES={
    theme_photo_cloudhug:function(){return sceneThemed('themes/photo_cloudhug.jpg?v=1020',[[0,'#131321'],[1,'#664D56']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,210,235',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,240,255',a:[.4,.75]}],{arche:'bloom',origin:[.42,.4],el:'heart',cols:['255,175,205','255,200,225','255,150,190'],n:16,flash:'255,190,215',every:[6000,9000]});},
    theme_photo_horsespa:function(){return sceneThemed('themes/photo_horsespa.jpg?v=1020',[[0,'#222F41'],[1,'#161315']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'200,235,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,235,200',a:[.4,.75]}],{arche:'erupt',origin:[.6,.8],el:'bubble',col:'205,235,255',n:22,flash:'210,235,255',every:[5500,8500]});},
    theme_photo_beastworld:function(){return sceneThemed('themes/photo_beastworld.jpg?v=1020',[[0,'#1F2442'],[1,'#141D2E']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'160,185,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'210,225,255',a:[.4,.75]},{kind:'rune',n:4,motion:'wander',s:[.016,.028],col:'195,180,255',a:[.35,.6]}],{arche:'summon',origin:[.5,.46],cols:['185,215,255','205,185,255','175,235,255'],n:5,flash:'185,210,255',every:[6500,9500]});},
    theme_photo_balloonbay:function(){return sceneThemed('themes/photo_balloonbay.jpg?v=1020',[[0,'#596089'],[1,'#B99394']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,225,180',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,255,230',a:[.4,.75]}],{arche:'launch',origin:[.48,.56],el:'balloon',cols:['255,140,140','255,200,120','140,200,255','200,150,255','150,220,160'],n:3,flash:'255,225,180',every:[6500,9500]});},
    theme_photo_starcollect:function(){return sceneThemed('themes/photo_starcollect.jpg?v=1020',[[0,'#262235'],[1,'#513736']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'220,225,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,250,220',a:[.4,.75]}],{arche:'converge',origin:[.4,.42],el:'star',col:'255,248,210',n:18,flash:'255,250,215',every:[6000,9000]});},
    theme_photo_flyingisle:function(){return sceneThemed('themes/photo_flyingisle.jpg?v=1020',[[0,'#121C3D'],[1,'#644E6B']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'200,220,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'210,225,255',a:[.4,.75]}],{arche:'warp',cols:['210,230,255','255,245,210','200,255,235'],n:16,every:[4500,7000]});},
    theme_photo_storybook:function(){return sceneThemed('themes/photo_storybook.jpg?v=1020',[[0,'#434960'],[1,'#2D263A']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,235,200',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,245,210',a:[.4,.75]},{kind:'firefly',n:7,motion:'wander',s:[.004,.008],a:[.5,.9]}],{arche:'flutter',origin:[.45,.62],el:'page',col:'255,248,225',n:9,flash:'255,245,215',every:[6500,9500]});},
    theme_photo_stardustfarm:function(){return sceneThemed('themes/photo_stardustfarm.jpg?v=1020',[[0,'#9C6F3F'],[1,'#644B47']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,225,150',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,240,200',a:[.4,.75]}],{arche:'erupt',origin:[.5,.32],el:'seed',col:'200,255,180',n:22,flash:'205,255,185',every:[5500,8500]});},
    theme_photo_memoryrepair:function(){return sceneThemed('themes/photo_memoryrepair.jpg?v=1020',[[0,'#080B18'],[1,'#2E2014']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'175,160,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'210,200,255',a:[.4,.75]}],{arche:'converge',origin:[.5,.42],el:'shard',col:'195,205,255',n:14,flash:'205,205,255',every:[6500,9500]});},
    theme_photo_jamhouse:function(){return sceneThemed('themes/photo_jamhouse.jpg?v=1020',[[0,'#9E8E8A'],[1,'#846351']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,200,180',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,225,180',a:[.4,.75]}],{arche:'erupt',origin:[.5,.44],el:'berry',cols:['220,60,90','180,40,120','230,90,60'],n:18,flash:'255,180,120',every:[6000,9000]});},
    theme_photo_dessertshop:function(){return sceneThemed('themes/photo_dessertshop.jpg?v=1020',[[0,'#292645'],[1,'#5B4E43']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,205,210',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,230,200',a:[.4,.75]}],{arche:'burst',origin:[.5,.45],els:['cake','lolli','macaron','donut','candy'],cols:['255,120,170','255,90,140','255,180,90','255,225,110','120,210,160','120,190,255','190,140,250','235,130,90'],n:13,flash:'255,210,150',flashR:.2,every:[4500,7500]});},
    theme_photo_fairytown:function(){return sceneThemed('themes/photo_fairytown.jpg?v=1020',[[0,'#060C22'],[1,'#674140']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,210,230',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,245,210',a:[.4,.75]},{kind:'firefly',n:7,motion:'wander',s:[.004,.008],a:[.5,.9]}],{arche:'bloom',origin:[.42,.27],el:'petal',cols:['255,190,210','255,210,170','230,190,255'],n:20,flash:'255,210,230',every:[5500,8500]});},
    theme_photo_goodnight:function(){return sceneThemed('themes/photo_goodnight.jpg?v=1020',[[0,'#0E0E29'],[1,'#2A2742']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'200,210,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'220,225,255',a:[.4,.75]},{kind:'zzz',n:3,motion:'rise',s:[.024,.038],v:[.00003,.00005],col:'205,215,255',a:[.4,.7]}],{arche:'stream',origin:[.45,.58],el:'note',col:'212,222,255',n:11,flash:'210,220,255',every:[6000,9000]});},
    theme_photo_dreamcleanse:function(){return sceneThemed('themes/photo_dreamcleanse.jpg?v=1020',[[0,'#373E4B'],[1,'#62585A']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'190,235,245',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'210,245,255',a:[.4,.75]}],{arche:'flare',origin:[.42,.66],col:'190,240,250',n:14,flash:'200,242,250',every:[5500,8500]});},
    theme_photo_carworkshop:function(){return sceneThemed('themes/photo_carworkshop.jpg?v=1020',[[0,'#403A4A'],[1,'#82685F']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,210,150',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,225,170',a:[.4,.75]},{kind:'gear',n:4,motion:'wander',s:[.018,.03],col:'172,178,192',a:[.3,.55]}],{arche:'erupt',origin:[.5,.3],el:'spark',col:'255,210,130',n:26,flash:'255,210,130',every:[5000,8000]});},
    theme_photo_honeyshop:function(){return sceneThemed('themes/photo_honeyshop.jpg?v=1020',[[0,'#764114'],[1,'#6B451F']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,215,130',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,225,140',a:[.4,.75]},{kind:'bee',n:4,motion:'wander',s:[.012,.02],a:[.55,.85]}],{arche:'pour',origin:[.8,.5],el:'honey',col:'255,200,70',n:22,flash:'255,215,130',every:[5500,8500]});},
    theme_photo_sunweave:function(){return sceneThemed('themes/photo_sunweave.jpg?v=1020',[[0,'#807682'],[1,'#5B4F4D']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'255,225,160',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'255,235,190',a:[.4,.75]}],{arche:'rays',origin:[.5,.13],el:'yarn',cols:['255,180,140','255,205,120','255,160,180'],n:10,flash:'255,225,150',every:[6000,9000]});},
    theme_photo_magicschool:function(){return sceneThemed('themes/photo_magicschool.jpg?v=1020',[[0,'#05102B'],[1,'#20223A']],[{kind:'bokeh',n:5,motion:'drift',s:[.04,.08],col:'200,190,255',a:[.12,.26]},{kind:'star',n:9,motion:'twinkle',s:[.005,.011],col:'210,210,255',a:[.4,.75]},{kind:'rune',n:4,motion:'wander',s:[.016,.028],col:'195,180,255',a:[.35,.6]}],{arche:'flare',origin:[.45,.1],col:'205,195,255',n:16,flash:'210,200,255',every:[5500,8500]});},
    theme_clouddream:sceneCloudDream,
    theme_rainbowsweet:sceneRainbowSweet,
    theme_zombiedance:function(){return sceneThemed('themes/zombie_dance.jpg?v=1020',[[0,'#0a0a24'],[.5,'#181043'],[1,'#0a2026']],[{kind:'bokeh',n:5,motion:'drift',s:[.05,.09],col:'150,255,190',a:[.1,.24]},{kind:'star',n:10,motion:'twinkle',s:[.005,.011],col:'200,230,255',a:[.4,.75]},{kind:'firefly',n:6,motion:'wander',s:[.004,.008],a:[.5,.9]},{kind:'note',n:4,motion:'rise',s:[.016,.024],col:'255,240,170',v:[.00002,.00004],a:[.3,.55]}],{arche:'spiral',origin:[.5,.44],el:'note',cols:['255,235,140','170,255,200','200,170,255','255,170,210','120,235,255'],n:20,flash:'190,255,220',flashR:.26,every:[4800,7600],turns:2.3,maxR:.34});},
    theme_fireworks:sceneFireworks,
    theme_candyland:sceneCandy,
    theme_balloon:sceneBalloon,
    theme_lagoon:sceneLagoon,
    theme_spacepark:sceneSpace
  };

  window.HansenCinema={
    owns:function(id){ return !!SCENES[id]; },
    apply:function(id){ if(!SCENES[id]){ stop(); return false; } return start(id); },
    stop:stop
  };

  function lateBoot(){
    try{
      var ds=window.HansenDiamondShop; if(!ds||!ds.getEquipped)return;
      var eq=ds.getEquipped();
      /* 必须走公开入口：Boss 主题会包装 HansenCinema.apply 来阻止深空/晨曦战斗中
         被延迟启动的电影画布闪现。直接调用私有 start 会绕过该守卫。 */
      if(eq&&SCENES[eq]&&!document.getElementById(CANVAS_ID)){ window.HansenCinema.apply(eq); }
    }catch(e){}
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ setTimeout(lateBoot,80); }); }
  else{ setTimeout(lateBoot,80); }
})();
