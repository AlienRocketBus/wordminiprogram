// MG-05: probability that w.split('').sort(()=>Math.random()-.5) leaves the word unchanged (V8, same engine family as Chrome/Android WeChat X5? see note)
const words = ['go','he','who','eat','toe','open','hand','apple','orange','bed','mom'];
const N = 200000;
for(const w of words){ let same=0; for(let i=0;i<N;i++){ if(w.split('').sort(()=>Math.random()-.5).join('')===w) same++; } console.log(w.padEnd(8), (same/N*100).toFixed(1)+'% unchanged'); }
