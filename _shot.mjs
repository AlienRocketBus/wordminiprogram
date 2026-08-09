import { chromium } from './playwright_loader.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/home/claude/work/repo';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 if(p==='/VERSION'){r.writeHead(200,{'content-type':'text/plain'});r.end('1156');return;}
 fs.readFile(path.join(ROOT,p),(e,d)=>{if(e){r.writeHead(404);r.end();return;}
   r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'});r.end(d);});});
await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
await ctx.addInitScript(()=>{try{
  localStorage.setItem('hansen_auth_v1004',JSON.stringify({uid:'ME',method:'phone',signedAt:Date.now()}));
}catch(e){}});
const pg=await ctx.newPage();
await pg.goto(`http://127.0.0.1:${port}/spelling_pk.html`,{waitUntil:'domcontentloaded'});
await pg.waitForTimeout(4600);
/* 造一些战绩，让天梯页有内容 */
await pg.evaluate(async()=>{
  const R=window.HansenPkRecord; R._reset&&R._reset();
  const G=(res,c)=>({mode:'A',result:res,oppName:'小明',myScore:300,oppScore:120,
    words:5,correct:c,totalMs:7000,firstWins:4,fastestMs:820});
  [G('win',5),G('win',4),G('lose',3),G('win',5),G('draw',4),G('win',5)].forEach(g=>R.record(g));
  window.HansenLadderBoard.fetchTop=async()=>({ok:true,myRank:3,list:[
    {rank:1,uid:'A',name:'小红',cid:7,rating:1420,games:30},
    {rank:2,uid:'B',name:'阿强',cid:12,rating:1310,games:22},
    {rank:3,uid:'ME',name:'我',cid:2,rating:1105,games:6},
    {rank:4,uid:'C',name:'小刚',cid:9,rating:1010,games:8}]});
  window.HansenPkRoom._setMeForTest({id:'ME',name:'我'});
  window.HansenPkRoom._setTransportForTest({read:async()=>null,claim:async()=>({updated:1}),
    patch:async()=>({updated:1}),add:async()=>({id:'R'}),list:async()=>[],remove:async()=>true,listOpen:async()=>[]});
  window.HansenLadderUI.open();
});
await pg.waitForTimeout(1800);
await pg.screenshot({path:'/tmp/ladder.png',fullPage:true});
console.log('天梯页已截图');
await b.close(); srv.close();
