
// v142k: 字母拼拼乐键盘支持
(function(){
  document.addEventListener('keydown',function(e){
    var sc=document.getElementById('scrambleScreen');
    if(!sc||!sc.classList.contains('active'))return;
    var k=e.key.toLowerCase();
    if(/^[a-z]$/.test(k)){
      var btns=document.querySelectorAll('.scramble-letter');
      for(var i=0;i<btns.length;i++){
        if(!btns[i].classList.contains('used')&&btns[i].textContent.toLowerCase()===k){
          btns[i].click();
          break;
        }
      }
    } else if(k==='backspace'){
      e.preventDefault();
      var delBtn=document.querySelector('[onclick="delLastScramble()"]');
      if(delBtn) delBtn.click();
    }
  });
})();
