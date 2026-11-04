import crypto from 'node:crypto';
const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function keyFromUid(uid){let h1=0x811c9dc5,h2=0x01000193,s='HSNACCT:'+uid;for(let i=0;i<s.length;i++){h1=((h1^s.charCodeAt(i))>>>0)*16777619>>>0;h2=((h2+s.charCodeAt(i)*(i+7))>>>0)*2654435761>>>0;}let o='';for(let j=0;j<16;j++){h1=(h1*1664525+1013904223)>>>0;h2=(h2^(h1>>>13))>>>0;o+=ALPHABET.charAt(((h1^h2)>>>0)%ALPHABET.length);}return o;}
const d=(k)=>crypto.createHash('sha256').update('hansen-doc-v1:'+k).digest('hex');
const N=500000;const t0=Date.now();let acc=0;
for(let i=0;i<N;i++){const h=d(keyFromUid('p:1380000'+String(i%10000).padStart(4,'0')));acc+=h.charCodeAt(0);}
const dt=(Date.now()-t0)/1000,rate=Math.round(N/dt);
console.log('single-thread node rate =',rate,'candidates/s over',N,'in',dt.toFixed(2),'s');
console.log('full ~1.8e9 China-mobile space: single-thread',(1.8e9/rate/3600).toFixed(1),'h; trivially parallel/GPU => minutes');
console.log('(acc',acc%7,')');
