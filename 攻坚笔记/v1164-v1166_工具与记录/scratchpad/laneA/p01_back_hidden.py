import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
anchor = """window.addEventListener('unhandledrejection', function(e){
  console.warn('Unhandled promise:', e.reason);
  e.preventDefault();
});
"""
add = anchor + """
/* 🔴v1165 给外壳（index.html）用的两个接口 —— 孩子按手机「返回」、或岛被藏起来时调用。
   ① __hsnIslandBack()：只退一步。先关最上面的浮层（模块登记在 __hsnBackStack 里的关闭函数），
      再关弹窗，再从游戏回到本岛主页；已经在本岛主页就返回 false，让外壳去退出这个岛。
   ② __hsnIslandHidden()：岛被藏起来时，停掉正在进行的游戏和声音（以前藏起来的岛还在读单词、极速60秒还在倒计时）。 */
window.__hsnBackStack=window.__hsnBackStack||[];
/* 模块打开浮层时登记一个关闭函数，返回「撤销登记」的函数；关闭函数没东西可关时请返回 false */
window.__hsnPushBack=function(fn){var st=window.__hsnBackStack;if(typeof fn!=='function')return function(){};st.push(fn);return function(){var i=st.lastIndexOf(fn);if(i>=0)st.splice(i,1);};};
window.__hsnIslandBack=function(){
  var st=window.__hsnBackStack;
  while(st&&st.length){
    var fn=st.pop(),r;
    if(typeof fn!=='function')continue;
    try{r=fn();}catch(e){r=undefined;}
    if(r!==false)return true;
  }
  try{var am=document.getElementById('alertModal');if(am&&am.classList.contains('show')){closeAlert();return true;}}catch(e){}
  try{var wm=document.getElementById('wordModal');if(wm&&wm.classList.contains('show')){closeModal();return true;}}catch(e){}
  try{var a=document.querySelector('.screen.active');if(a&&a.id!=='homeScreen'&&typeof showScreen==='function'){showScreen('home');return true;}}catch(e){}
  return false;
};
window.__hsnIslandHidden=function(){
  try{var a=document.querySelector('.screen.active');if(a&&a.id!=='homeScreen'&&typeof showScreen==='function')showScreen('home');}catch(e){}
  try{if(window._activeAudio&&window._activeAudio.pause)window._activeAudio.pause();}catch(e){}
  try{if(typeof curAudio!=='undefined'&&curAudio&&curAudio.pause)curAudio.pause();}catch(e){}
  try{if(window.speechSynthesis)window.speechSynthesis.cancel();}catch(e){}
};
"""
rep(BOTH, anchor, add)
commit()
