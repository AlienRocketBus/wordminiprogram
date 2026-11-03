import fs from 'node:fs'; import vm from 'node:vm';
const W=process.argv[2]||'/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const isl=JSON.parse(fs.readFileSync(W+'island_data.json','utf8'));
const all={}; for(const k of Object.keys(isl)){ const c={};vm.createContext(c);vm.runInContext(isl[k].DATA.replace('const DATA=','DATA='),c); c.DATA.forEach(g=>g.words.forEach(w=>{all[k+':'+w.en]=w;})); }
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(W+'highlight_helper.js','utf8'),c);
const rows=['food:cabbage','animal:sheep','clothes:skirt','home:table','season:meanwhile','adjective:old','time:March',...'available develop destroy struggle maximum minimum instead consequently generally fortunately public chemical business employee'.split(' ').map(w=>'season:'+w)];
for(const r of rows){ const w=all[r]; const h=c.window.smartHighlight(w.cn,w.exCn,w.en); const m=/<span[^>]*>(.*?)<\/span>/.exec(h); console.log(r,'|',w.cn,'|',w.exCn,'| hl=',m?m[1]:'(none)'); }
