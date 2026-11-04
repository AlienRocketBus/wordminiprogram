import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
import P as _P
# ① 通用：难度卡上的「例词」从本档真实的词里取前 3 个（以前写死 man · cat · cow，很多岛根本没有这几个词）
anchor = "function __hsnLockedLevelCard(L){"
rep(BOTH, anchor, "/* 🔴v1165 难度卡上的例词：本档真实的前 3 个词 */\nfunction __hsnLevelExample(filter){var out=[];for(var i=0;i<allW.length&&out.length<3;i++){try{if(filter(i))out.push(allW[i].en);}catch(e){}}return out.join(' · ');}\n" + anchor)
# ② 各个难度菜单：0 个词的那一档画成灰色 🔒、不能点（以前只有火眼金睛这样做，其它的看着能玩、点了只弹提示）
for fn in ['Moles', 'Fish', 'Bubble', 'Scramble']:
    old = "    const L=%s_LEVELS[k];\n    const cnt=[...Array(allW.length).keys()].filter(L.filter).length;\n    cards+='<div onclick=\"start%sLevel(" % (fn.upper(), fn)
    new = "    const L=%s_LEVELS[k];\n    const cnt=[...Array(allW.length).keys()].filter(L.filter).length;\n    if(!cnt){cards+=__hsnLockedLevelCard(L);continue;}\n    cards+='<div onclick=\"start%sLevel(" % (fn.upper(), fn)
    rep(BOTH, old, new)
rep(BOTH, "    const L=CLOZE_LEVELS[k];const cnt=CLOZE_LEVEL_IDX[k].length;\n    cards+='<div onclick=\"startClozeLevel(",
          "    const L=CLOZE_LEVELS[k];const cnt=CLOZE_LEVEL_IDX[k].length;\n    if(!cnt){cards+=__hsnLockedLevelCard(L);continue;}\n    cards+='<div onclick=\"startClozeLevel(")
rep(BOTH, "for(const k of [1,2,3]){\n  const L=TYPING_LEVELS[k];\n  cards+='<div onclick=\"startTyping('+k+')\"",
          "for(const k of [1,2,3]){\n  const L=TYPING_LEVELS[k];\n  if(!counts[k]){cards+=__hsnLockedLevelCard(L);continue;}\n  cards+='<div onclick=\"startTyping('+k+')\"")
t = _P._get(T)
i = t.index("    if(cnt===0){cards+='<div style=\"background:linear-gradient(135deg,'+L.c1+','+L.c2+');border-radius:18px;padding:16px;margin-bottom:12px;opacity:.42;")
j = t.index("continue;}", i) + len("continue;}")
rep(BOTH, t[i:j], "    if(cnt===0){cards+=__hsnLockedLevelCard(L);continue;}")
# ③ 字母拼拼乐：例词从本档取；泡泡：不再写死「每档大约 20 词左右」
rep(BOTH, "        '<div style=\"font-size:13px;font-weight:600;opacity:.85;margin-bottom:6px;font-style:italic\">'+L.example+'</div>'+",
          "        '<div style=\"font-size:13px;font-weight:600;opacity:.85;margin-bottom:6px;font-style:italic\">'+__hsnLevelExample(L.filter)+'</div>'+")
for ex in ["man · cat · cow", "tiger · friend · old", "children · gentleman"]:
    rep(BOTH, ",example:'%s'," % ex, ",")
rep(BOTH, "每档大约 20 词左右, 顺序随机, 完成即结束", "每个词只出一次，顺序随机，答完这一档就结束")
# ④ 单词大陆：打地鼠/钓鱼/泡泡/字母拼拼乐/火眼金睛按本岛自己的词长分三档（以前按 ≤4 / 5–6 / ≥7 字母分，初级只有 0–2 个词）
tier = r"""/* 🔴v1165 单词大陆的 30 个词都偏长（大多 6–12 个字母）。按「≤4 / 5–6 / ≥7 个字母」分档时，初级只有 0–2 个词、高级挤了 20 多个。
   这里按本岛自己的词长挑两个分界，让三档尽量一样多（每档都有好几个词）；打地鼠、钓鱼、泡泡、字母拼拼乐、火眼金睛共用。 */
var __HSN_LAND_TIER=(function(){
  function len(w){return String((w&&w.en)||'').replace(/[^a-z]/gi,'').length;}
  var lens=allW.map(len),ls=lens.slice().sort(function(a,b){return a-b}).filter(function(v,i,a){return i===0||v!==a[i-1];});
  var best=null;
  for(var i=0;i<ls.length;i++)for(var j=i+1;j<ls.length;j++){
    var c1=ls[i],c2=ls[j],a=0,b=0,c=0;
    lens.forEach(function(l){if(l<=c1)a++;else if(l<=c2)b++;else c++;});
    if(!c)continue;var mn=Math.min(a,b,c),mx=Math.max(a,b,c);
    if(!best||mn>best.mn||(mn===best.mn&&mx<best.mx))best={c1:c1,c2:c2,mn:mn,mx:mx};
  }
  if(!best)best={c1:4,c2:6};
  var lo=ls.length?ls[0]:1;
  function rng(a,b){return a>=b?b+' 个字母':a+'–'+b+' 个字母';}
  return {
    easy:function(i){return len(allW[i])<=best.c1;},
    medium:function(i){var l=len(allW[i]);return l>best.c1&&l<=best.c2;},
    hard:function(i){return len(allW[i])>best.c2;},
    desc:{easy:rng(lo,best.c1),medium:rng(best.c1+1,best.c2),hard:(best.c2+1)+' 个字母以上'}
  };
})();
"""
l = _P._get(L)
mi = l.index("const MOLES_LEVELS={")
l = l[:mi] + tier + l[mi:]
def swap_block(src, name, pairs):
    a = src.index('const ' + name + '={'); b = src.index('\n};', a)
    blk = src[a:b]
    for old, new in pairs:
        if blk.count(old) != 1: raise SystemExit('❌ %s: %d × %s' % (name, blk.count(old), old))
        blk = blk.replace(old, new)
    return src[:a] + blk + src[b:]
std = [("filter:i=>allW[i].en.length<=4,", "filter:__HSN_LAND_TIER.easy,"),
       ("filter:i=>allW[i].en.length>=5&&allW[i].en.length<=6,", "filter:__HSN_LAND_TIER.medium,"),
       ("filter:i=>allW[i].en.length>=7,", "filter:__HSN_LAND_TIER.hard,")]
for nm in ['MOLES_LEVELS', 'FISH_LEVELS', 'BUBBLE_LEVELS', 'EAGLE_LEVELS']:
    l = swap_block(l, nm, std)
l = swap_block(l, 'SCRAMBLE_LEVELS', [
    ("desc:'3-4 字母短词',", "desc:__HSN_LAND_TIER.desc.easy,"),
    ("desc:'5-6 字母中等词',", "desc:__HSN_LAND_TIER.desc.medium,"),
    ("desc:'7+ 字母长词',", "desc:__HSN_LAND_TIER.desc.hard,"),
    ("filter:i=>{const en=allW[i].en;return en.length<=4 && !/[.\\-]/.test(en)},", "filter:i=>__HSN_LAND_TIER.easy(i) && !/[.\\-]/.test(allW[i].en),"),
    ("filter:i=>{const en=allW[i].en;return en.length>=5&&en.length<=6 && !/[.\\-]/.test(en)},", "filter:i=>__HSN_LAND_TIER.medium(i) && !/[.\\-]/.test(allW[i].en),"),
    ("filter:i=>{const en=allW[i].en;return en.length>=7 && !/[.\\-]/.test(en)},", "filter:i=>__HSN_LAND_TIER.hard(i) && !/[.\\-]/.test(allW[i].en),"),
])
_P._buf[L] = l
commit()
