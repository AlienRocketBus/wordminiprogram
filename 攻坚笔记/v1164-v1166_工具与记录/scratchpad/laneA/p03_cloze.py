import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
helper = r"""const CLOZE_LEVEL_IDX={};
/* 🔴v1165 完形填空找空：例句里常写的是变形（eyes / cooks / tomatoes / strawberries / started / flown…）。
   以前只认原词：这些词永远出不了题，却照样算进总数（身体岛初级全对也只显示 60%）。
   现在先找原词，找不到再找常见变形；返回 {index,text}：句子里那个词本来的写法（大小写不变，答完原样填回）。 */
var __HSN_CLOZE_IRREG={fly:['flew','flown','flies'],draw:['drew','drawn'],get:['got','gotten'],go:['went','gone','goes'],do:['did','done','does'],be:['is','am','are','was','were','been'],have:['has','had'],eat:['ate','eaten'],see:['saw','seen'],run:['ran'],swim:['swam','swum'],sing:['sang','sung'],write:['wrote','written'],ride:['rode','ridden'],drive:['drove','driven'],take:['took','taken'],give:['gave','given'],make:['made'],buy:['bought'],bring:['brought'],think:['thought'],catch:['caught'],teach:['taught'],sleep:['slept'],feel:['felt'],keep:['kept'],find:['found'],tell:['told'],say:['said'],sit:['sat'],stand:['stood'],speak:['spoke','spoken'],break:['broke','broken'],choose:['chose','chosen'],forget:['forgot','forgotten'],begin:['began','begun'],come:['came'],become:['became'],know:['knew','known'],grow:['grew','grown'],throw:['threw','thrown'],wear:['wore','worn'],win:['won'],lose:['lost'],leave:['left'],meet:['met'],child:['children'],man:['men'],woman:['women'],foot:['feet'],tooth:['teeth'],mouse:['mice'],person:['people'],leaf:['leaves'],knife:['knives'],wife:['wives'],life:['lives'],half:['halves'],wolf:['wolves'],shelf:['shelves']};
function __hsnClozeForms(en){
  var w=String(en||''),lw=w.toLowerCase(),out=[w];
  if(!/^[a-z]+$/i.test(w))return out;            /* 词组、带符号的词只认原样 */
  var irr=__HSN_CLOZE_IRREG[lw];if(irr)out=out.concat(irr);
  if(w.length<3)return out;                       /* he / my / it 这种短词不猜变形，免得认错别的词 */
  var last=lw.slice(-1);
  out.push(w+'s',w+'es');
  if(last==='y'&&/[^aeiou]/.test(lw.charAt(lw.length-2)))out.push(w.slice(0,-1)+'ies',w.slice(0,-1)+'ied');
  if(last==='e'){if(lw.slice(-2)!=='ee')out.push(w+'d');out.push(w.slice(0,-1)+'ing');}else{out.push(w+'ed',w+'ing');}
  if(/[^aeiou][aeiou][bdgklmnprt]$/.test(lw))out.push(w+last+'ed',w+last+'ing');   /* stop→stopped / swim→swimming */
  if(last==='f')out.push(w.slice(0,-1)+'ves');
  if(lw.slice(-2)==='fe')out.push(w.slice(0,-2)+'ves');
  return out;
}
function __hsnClozeMatch(w){
  try{
    var ex=String(w&&w.ex||'');if(!ex)return null;
    var forms=__hsnClozeForms(w&&w.en);
    for(var i=0;i<forms.length;i++){
      var f=forms[i];if(!f)continue;
      var m=new RegExp('\\b'+f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').exec(ex);
      if(m)return {index:m.index,text:m[0]};
    }
  }catch(e){}
  return null;
}
window.__hsnClozeMatch=__hsnClozeMatch;
"""
rep(BOTH, "const CLOZE_LEVEL_IDX={};\n", helper)
rep(BOTH, "  CLOZE_LEVEL_IDX[k]=CLOZE_LEVELS[k].words.map(en=>allW.findIndex(w=>w.en===en)).filter(i=>i>=0);\n",
          "  /* 🔴v1165 只收真能出题的词：卡片上的题数、进度和「答对 x / y」都用同一批 */\n  CLOZE_LEVEL_IDX[k]=CLOZE_LEVELS[k].words.map(en=>allW.findIndex(w=>w.en===en)).filter(i=>i>=0&&!!__hsnClozeMatch(allW[i]));\n")
# nextClozeQ：用同一个找空函数；挖掉句子里那个词本来的写法
old_loop = r"""let idx,w;
while(clozePool.length>0){
  const tryIdx=clozePool.pop();
  const tryW=allW[tryIdx];
  if(!tryW.ex){continue}
  const re=new RegExp('\\b'+tryW.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
  if(re.test(tryW.ex)){idx=tryIdx;w=tryW;break}
}
"""
new_loop = r"""let idx,w,cm=null;
while(clozePool.length>0){
  const tryIdx=clozePool.pop();
  const tryW=allW[tryIdx];
  const m=__hsnClozeMatch(tryW);
  if(m){idx=tryIdx;w=tryW;cm=m;break}
}
"""
rep(BOTH, old_loop, new_loop)
old_blank = r"""// 构建挖空句子
const re=new RegExp('\\b'+w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i');
// 检测目标词是否在句首 (需要大写显示)
const matchM=w.ex.match(re);
const isAtStart=matchM&&matchM.index===0;
const blankAttr=isAtStart?' data-cap="1"':'';
const sentence=w.ex.replace(re,'<span class="cloze-blank" id="clozeBlank"'+blankAttr+'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
if(!sentence.includes('clozeBlank')){setTimeout(nextClozeQ,10);return}
"""
new_blank = r"""// 构建挖空句子：挖掉例句里那个词本来的写法（可能是 eyes / cooks 这样的变形）
// 目标词在句首时选项首字母大写显示
const isAtStart=cm.index===0;
const sentence=w.ex.slice(0,cm.index)+'<span class="cloze-blank" id="clozeBlank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>'+w.ex.slice(cm.index+cm.text.length);
"""
rep(BOTH, old_blank, new_blank)
rep(BOTH, "clozeQ={word:w,opts:opts,idx:idx};", "clozeQ={word:w,opts:opts,idx:idx,fill:cm.text};")
# clozeAnswer：填回句子自己的写法（It / Year / cooks 大小写不变）；答错时按选项本身标出正确的那个
rep(BOTH, "if(clozeQ.opts[i].en===clozeQ.word.en){opts[i].classList.add('correct');blank.textContent=(blank.dataset.cap==='1'?(clozeQ.word.en.charAt(0).toUpperCase()+clozeQ.word.en.slice(1)):clozeQ.word.en);blank.classList.add('filled');",
          "if(clozeQ.opts[i].en===clozeQ.word.en){opts[i].classList.add('correct');blank.textContent=clozeQ.fill||clozeQ.word.en;blank.classList.add('filled');")
rep(BOTH, "}else{opts[i].classList.add('wrong');opts.forEach(o=>{var displayEn=(blank.dataset.cap==='1'?(clozeQ.word.en.charAt(0).toUpperCase()+clozeQ.word.en.slice(1)):clozeQ.word.en);if(o.textContent===displayEn)o.classList.add('correct')});\nblank.textContent=(blank.dataset.cap==='1'?(clozeQ.word.en.charAt(0).toUpperCase()+clozeQ.word.en.slice(1)):clozeQ.word.en);blank.classList.add('wrong');",
          "}else{opts[i].classList.add('wrong');opts.forEach((o,j)=>{if(clozeQ.opts[j]&&clozeQ.opts[j].en===clozeQ.word.en)o.classList.add('correct')});\nblank.textContent=clozeQ.fill||clozeQ.word.en;blank.classList.add('wrong');")
rep(BOTH, "__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600,{say:clozeQ.word.ex||clozeQ.word.en,ex:clozeQ.word.ex,exCn:clozeQ.word.exCn,waitSpeech:true})",
          "__hmlLesson('cloze',clozeQ.idx,nextClozeQ,1600,{say:clozeQ.word.ex||clozeQ.word.en,ex:clozeQ.word.ex,exCn:clozeQ.word.exCn,waitSpeech:true,hl:clozeQ.fill})")
# Boss 完形：同一个找空函数
old_b1 = r"""      if(tryW.ex && tryW.ex.length > 6){
        // 验证例句确实包含目标词
        var re = new RegExp('\\b' + tryW.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');
        if(re.test(tryW.ex)){
          w = tryW; idx = tryIdx;
          break;
        }
      }
"""
new_b1 = r"""      if(tryW.ex && tryW.ex.length > 6){
        // 验证例句确实包含目标词（原词或变形，🔴v1165 同一个找空函数）
        if(__hsnClozeMatch(tryW)){
          w = tryW; idx = tryIdx;
          break;
        }
      }
"""
rep(BOTH, old_b1, new_b1)
old_b2 = r"""    // 挖空例句中的目标词
    var re = new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');
    var match = w.ex.match(re);
    var isAtStart = match && match.index === 0;
    // 单根横线 (用 nbsp 撑宽度, border-bottom 画线)
    prompt = w.ex.replace(re, '<span style="display:inline-block;min-width:60px;padding:0 8px;border-bottom:3px solid #fbbf24;color:#fbbf24;font-weight:900">&nbsp;&nbsp;&nbsp;&nbsp;</span>');
"""
new_b2 = r"""    // 挖空例句中的目标词（原词或变形）
    var _cm = __hsnClozeMatch(w) || {index:0,text:''};
    var isAtStart = _cm.index === 0;
    // 单根横线 (用 nbsp 撑宽度, border-bottom 画线)
    prompt = w.ex.slice(0,_cm.index) + '<span style="display:inline-block;min-width:60px;padding:0 8px;border-bottom:3px solid #fbbf24;color:#fbbf24;font-weight:900">&nbsp;&nbsp;&nbsp;&nbsp;</span>' + w.ex.slice(_cm.index+_cm.text.length);
"""
rep(BOTH, old_b2, new_b2)
old_b3 = r"""      var w = window._bossWord;
      var re = new RegExp('\\b' + w.en.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b', 'i');
      var match = w.ex.match(re);
      var isAtStart = match && match.index === 0;
      var displayWord = isAtStart ? (w.en.charAt(0).toUpperCase() + w.en.slice(1)) : w.en;
"""
new_b3 = r"""      var w = window._bossWord;
      var _cm2 = __hsnClozeMatch(w) || {index:0,text:''};
      var displayWord = _cm2.text || w.en;   /* 🔴v1165 填回句子自己的写法（大小写、变形都不变） */
"""
rep(BOTH, old_b3, new_b3)
old_b4 = "      bossQEl.innerHTML = w.ex.replace(re, '<span style=\"display:inline-block;padding:0 8px;border-bottom:3px solid ' + wordColor + ';color:' + wordColor + ';background:' + wordBg + ';font-weight:900;border-radius:4px\">' + displayWord + '</span>');"
new_b4 = "      bossQEl.innerHTML = w.ex.slice(0,_cm2.index) + '<span style=\"display:inline-block;padding:0 8px;border-bottom:3px solid ' + wordColor + ';color:' + wordColor + ';background:' + wordBg + ';font-weight:900;border-radius:4px\">' + displayWord + '</span>' + w.ex.slice(_cm2.index+_cm2.text.length);"
rep(BOTH, old_b4, new_b4)
commit()
