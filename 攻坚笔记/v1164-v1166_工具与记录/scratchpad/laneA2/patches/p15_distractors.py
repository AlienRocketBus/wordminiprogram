import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
anchor = "/* 🔴v1165 难度卡上的例词：本档真实的前 3 个词 */"
rep(BOTH, anchor, """/* 🔴v1165 选项里不能同时出现「意思一样」的两个词：两个都对，孩子选对也可能被判错。
   ① 中文有一个义项相同（因此 / 因此/结果）就算撞车；② 星海里几组近义词中文写法不同，也算撞车。 */
var __HSN_SYN={however:1,nevertheless:1,therefore:2,consequently:2,besides:3,moreover:3,furthermore:3,rarely:4,seldom:4,immediately:5,instantly:5,finally:6,eventually:6,huge:7,enormous:7};
function __hsnSenses(w){return String((w&&w.cn)||'').split(/[\\/;；]/).map(function(s){return s.trim();}).filter(Boolean);}
function __hsnClash(a,b){
  if(!a||!b)return false;if(a.en===b.en||a.cn===b.cn)return true;
  var g=__HSN_SYN[String(a.en||'').toLowerCase()];if(g&&g===__HSN_SYN[String(b.en||'').toLowerCase()])return true;
  var sa=__hsnSenses(a),sb=__hsnSenses(b);for(var i=0;i<sa.length;i++)if(sb.indexOf(sa[i])>=0)return true;
  return false;
}
""" + anchor)
# 同档抽干扰项：听音辨义 / 完形填空 / 泡泡
rep(BOTH, "for(const di of shuffledLvl){if(opts.length>=4)break;const cand=allW[di];if(!opts.find(o=>o.en===cand.en))opts.push(cand)}",
          "for(const di of shuffledLvl){if(opts.length>=4)break;const cand=allW[di];if(!opts.find(o=>__hsnClash(o,cand)))opts.push(cand)}")
rep(BOTH, "for(const di of sameLvl){if(opts.length>=4)break;const c=allW[di];if(!opts.find(o=>o.en===c.en))opts.push(c)}",
          "for(const di of sameLvl){if(opts.length>=4)break;const c=allW[di];if(!opts.find(o=>__hsnClash(o,c)))opts.push(c)}")
rep(BOTH, "for(const i of shuffledSame){if(opts.length>=5)break;const c=allW[i];if(!opts.find(o=>o.en===c.en))opts.push(c)}",
          "for(const i of shuffledSame){if(opts.length>=5)break;const c=allW[i];if(!opts.find(o=>__hsnClash(o,c)))opts.push(c)}")
# 全集补齐（5 处：Boss / 泡泡 / 极速 / 听音 / 完形）：同义词也跳过（原来的中文去重那一句保留不动）
rep(BOTH, "const r=allW[Math.floor(Math.random()*allW.length)];if(!opts.find(o=>o.en===r.en||o.cn===r.cn))opts.push(r)",
          "const r=allW[Math.floor(Math.random()*allW.length)];if(opts.some(o=>__hsnClash(o,r)))continue;if(!opts.find(o=>o.en===r.en||o.cn===r.cn))opts.push(r)", count=5)
commit()
