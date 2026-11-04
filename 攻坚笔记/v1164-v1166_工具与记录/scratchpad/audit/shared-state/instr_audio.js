(function(){try{
 var path=(location.pathname.split('/').pop()||'')+(location.search.indexOf('warm=1')>=0?'?warm':'');var depth=0;try{var w=window;while(w!==w.parent){depth++;w=w.parent;}}catch(e){}
 var tag=depth+':'+path;var T;try{T=window.top;}catch(e){T=window;}
 function rec(what,x){try{T.__A=T.__A||[];T.__A.push({t:Date.now(),f:tag,what:what,x:String(x||'').slice(0,100)});}catch(e){}}
 if(window.speechSynthesis){var sp=speechSynthesis.speak.bind(speechSynthesis);try{speechSynthesis.speak=function(u){rec('tts',u&&u.text);return sp(u);};}catch(e){}}
 var pl=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){rec('media.play',this.currentSrc||this.src);return pl.apply(this,arguments);};
 var AC=window.AudioContext||window.webkitAudioContext;if(AC){var st=AC.prototype.createBufferSource;AC.prototype.createBufferSource=function(){rec('ac.bufsrc','');return st.apply(this,arguments);};var os=AC.prototype.createOscillator;AC.prototype.createOscillator=function(){rec('ac.osc','');return os.apply(this,arguments);};}
}catch(e){}})();
