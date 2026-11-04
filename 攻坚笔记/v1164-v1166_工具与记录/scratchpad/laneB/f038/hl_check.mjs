import fs from 'node:fs'; import vm from 'node:vm';
const W='/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/wt-opt/';
const isl=JSON.parse(fs.readFileSync(W+'island_data.json','utf8'));
const all={}; for(const k of Object.keys(isl)){ const c={};vm.createContext(c);vm.runInContext(isl[k].DATA.replace('const DATA=','DATA='),c); c.DATA.forEach(g=>g.words.forEach(w=>{(all[w.en]=all[w.en]||[]).push({isl:k,cn:w.cn,exCn:w.exCn});})); }
const want=[['frightened','小男孩被巨大的雷声吓到了。','吓到'],['confused','这些复杂的说明让我完全搞糊涂了。','搞糊涂'],['cautious','过这条繁忙的马路时要小心。','小心'],['ordinary','那只是平常的一天,没发生什么特别的事。','平常'],['available','今晚演出的票还有。','还有'],['valuable','时间是我们拥有的最宝贵的东西。','宝贵'],['galaxy','我们的太阳系是银河系的一部分。','银河系'],['constantly','她不停地看手机有没有消息。','不停地'],['previously','在成为作家之前,他曾当过老师。','曾'],['fly','你坐过飞机吗?','坐过'],['determined','他下定决心无论如何都要跑完比赛。','下定决心'],['natural','蜂蜜是一种天然的甜味剂。','天然的']];
const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(W+'highlight_helper.js','utf8'),c);
for(const [en,ex,hl] of want){ const e=(all[en]||[]); const hit=e.find(x=>x.exCn===ex); const cur=hit?c.window.smartHighlight(hit.cn,ex,en):'(no match)'; console.log(en, hit?'MATCH '+hit.isl:'NO-MATCH '+JSON.stringify(e), '| now:', String(cur).replace(/<span[^>]*>/,'[').replace('</span>',']'), '| want:', hl, '| already:', !!c.window.HIGHLIGHT_MANUAL[en+'|'+ex]); }
