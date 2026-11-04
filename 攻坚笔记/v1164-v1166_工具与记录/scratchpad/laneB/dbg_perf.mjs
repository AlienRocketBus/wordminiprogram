import fs from 'node:fs'; import vm from 'node:vm';
const SRC=fs.readFileSync('/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/hansen_canonical_progress.js','utf8');
const KEY='hansen_canonical_progress_v941';
class Storage{constructor(){this.m=new Map();}get length(){return this.m.size;}key(i){return [...this.m.keys()][i]??null;}getItem(k){return this.m.has(String(k))?this.m.get(String(k)):null;}setItem(k,v){this.m.set(String(k),String(v));}removeItem(k){this.m.delete(String(k));}}
function makeCtx(src,storage,clock,saveKey,pathname){const S={learned:[],mc:{},wrongs:{},srs:{},lastSaveTime:clock.now,stats:{}};const FD=function(){return new Date(clock.now)};FD.now=()=>clock.now;const c={console,localStorage:storage,document:{readyState:'complete',addEventListener(){}},location:{pathname},Date:FD,JSON,Math,Number,Object,Array,String,isFinite,setTimeout(){return 1},clearTimeout(){},addEventListener(){},__hsnSaveKey:saveKey,S};c.window=c;c.globalThis=c;vm.createContext(c);vm.runInContext(src,c);return c;}
const clock={now:Date.UTC(2026,10,3,9,0,0)},st=new Storage();
const s0=makeCtx(SRC,st,clock,'wordIslandFood','/island_food.html');const H0=s0.HansenCanonical,big=H0.read();
H0.islands.forEach(d=>{const p=big.islands[d.id];for(let k=0;k<d.words;k++){if(k%20){p.learned.push(k);p.mc[k]=1+(k%4);}if(k%5===0)p.wrongs[k]=2;if(k%3===0)p.srs[k]={box:k%5,due:'2026-11-0'+(1+k%8),last:''};}});
H0.write(big);H0.write(H0.read());
const C=makeCtx(SRC,st,clock,'wordIslandFood','/island_food.html'),H=C.HansenCanonical;H.read();
let last=H._perf().rebuilds;
for(let q=0;q<60;q++){clock.now+=4000;const i=q%56;if(C.S.learned.indexOf(i)<0)C.S.learned.push(i);C.S.mc[i]=(C.S.mc[i]||0)+1;if(q%4===0)C.S.wrongs[i]=1;else delete C.S.wrongs[i];
 const step=(n,f)=>{f();const r=H._perf().rebuilds;if(r!==last){console.log('q',q,'i',i,'op',n,'rebuild',r-last);last=r;}};
 step('absorbAnswer',()=>H.absorbAnswer(i));step('absorbCurrent',()=>H.absorbCurrent());
 if(q%3===0)step('setSrs',()=>H.setCurrentSrs(i,{box:1,due:'2026-11-05',last:'2026-11-03'}));
 step('reads',()=>{H.totalLearned();H.counts();H.sliceSnapshot();});
}
