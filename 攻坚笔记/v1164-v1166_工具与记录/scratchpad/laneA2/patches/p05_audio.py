import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ① 手机朗读也跟着全站「发音音量」（以前写死 1.0，音量滑杆对它不起作用）
rep(BOTH, '    u.lang="en-US";u.rate=(r||1)*0.95;u.pitch=1.0;u.volume=1.0;\n',
          '    u.lang="en-US";u.rate=(r||1)*0.95;u.pitch=1.0;u.volume=1.0;\n    try{if(window.HansenTTSVolume&&HansenTTSVolume.apply)HansenTTSVolume.apply(u);}catch(e){}  /* 🔴v1165 跟着全站「发音音量」 */\n')
# ② 本地录音放不出来 → 手机朗读兜底（只兜一次，不联网）
helper = r"""/* 🔴v1165 本地录音（words/ 里的单词和例句 mp3）没加载出来时（断网、文件缺失、网太慢），孩子以前什么都听不到。
   现在：加载出错、播放被拒（「还没点过屏幕」那种除外），或 2.5 秒还没响 → 改用手机自己朗读，只读一次。
   不联网找别的发音；「一键静音」时自动朗读根本走不到这里；孩子已经切走、换成下一个声音，就不补读了。 */
var __hsnTtsNoted=false;
function __hsnPlayLocal(a,text,rate,cb,capMs){
  var done=false,fell=false,started=false,stopped=false,slow=null,scr0=null;
  try{scr0=document.querySelector('.screen.active');}catch(e){}
  function fin(){if(done)return;done=true;if(slow){clearTimeout(slow);slow=null;}if(cb){try{cb()}catch(e){}}}
  function movedOn(){
    if(stopped||_activeAudio!==a)return true;
    try{if(document.querySelector('.screen.active')!==scr0||document.hidden)return true;}catch(e){}
    return false;
  }
  function fallback(){
    if(done||fell||started)return;fell=true;if(slow){clearTimeout(slow);slow=null;}
    try{a.onended=null;a.onerror=null;a.muted=true;a.pause();}catch(e){}
    if(movedOn())return fin();
    if(!__hsnTtsNoted){__hsnTtsNoted=true;try{showToast('🔈 声音没下载下来，先用手机朗读～');}catch(e){}}
    try{_browserTTS(text,rate,fin);}catch(e){fin();}
  }
  try{
    a.addEventListener('playing',function(){started=true;if(slow){clearTimeout(slow);slow=null;}});
    a.addEventListener('pause',function(){if(!started&&!fell)stopped=true;});   /* 被别处停掉（换了下一个声音/岛藏起来）≠ 坏了 */
  }catch(e){}
  a.onended=function(){fin()};
  a.onerror=function(){fallback()};
  slow=setTimeout(function(){slow=null;if(!started&&a.readyState<2)fallback();},2500);
  if(cb)setTimeout(function(){if(!fell)fin();},capMs||5000);
  try{
    var p=a.play();
    if(p&&typeof p.catch==='function')p.catch(function(err){
      var n=err&&err.name;
      if(n==='NotAllowedError'||n==='AbortError'){if(n==='AbortError')stopped=true;fin();return;}
      fallback();
    });
  }catch(e){fallback();}
}
function speak(t,r,cb){"""
rep(BOTH, "function speak(t,r,cb){", helper)
old_ex = """    if(_exMp3){
      var _exA = new Audio(_exMp3 + '?v215');
      _exA.playbackRate = rate;
      _activeAudio = _exA;
      if(cb){
        var _exDone = false;
        _exA.onended = function(){ if(!_exDone){_exDone=true; cb();} };
        _exA.onerror = function(){ if(!_exDone){_exDone=true; cb();} };
        setTimeout(function(){ if(!_exDone){_exDone=true; cb();} }, 9000);
      }
      _exA.play().catch(function(){ if(cb && !cb.__done){ cb.__done=true; cb(); } });
      return;
    }"""
new_ex = """    if(_exMp3){
      var _exA = new Audio(_exMp3 + '?v215');
      _exA.playbackRate = rate;
      _activeAudio = _exA;
      __hsnPlayLocal(_exA, text, rate, cb, 9000);   /* 🔴v1165 放不出来就用手机朗读兜底 */
      return;
    }"""
rep(BOTH, old_ex, new_ex)
old_w = """      if(localMp3){
        const a = new Audio(localMp3 + '?v215');
        a.playbackRate = rate;
        _activeAudio = a;
        if(cb){
          let done=false;
          a.onended = function(){if(!done){done=true;cb()}};
          a.onerror = function(){if(!done){done=true;cb()}};
          setTimeout(function(){if(!done){done=true;cb()}}, 5000);
        }
        a.play().catch(function(){ if(cb && !cb.__done){cb.__done=true; cb()} });
        return;
      }"""
new_w = """      if(localMp3){
        const a = new Audio(localMp3 + '?v215');
        a.playbackRate = rate;
        _activeAudio = a;
        __hsnPlayLocal(a, text, rate, cb, 5000);   /* 🔴v1165 放不出来就用手机朗读兜底 */
        return;
      }"""
rep(BOTH, old_w, new_w)
commit()
