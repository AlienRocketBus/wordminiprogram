/**
 * hansen_early.js - 必须在 <head> 早期加载
 * 检测自动打开复习中心 flag, 立即盖深色遮罩
 * 避免用户看到岛主界面闪烁
 */
(function(){
  try {
    if(localStorage.getItem('hansen_autoOpenReviewCenter') !== '1' &&
       localStorage.getItem('hansen_autoOpenRain') !== '1') return;
    
    // v142u: 立即清除 flag, 防止下次刷新还触发
    localStorage.removeItem('hansen_autoOpenReviewCenter');
    localStorage.removeItem('hansen_autoOpenRain');
    
    // 立即注入 style + 遮罩
    const style = document.createElement('style');
    style.textContent = `
      #hwo_transition_mask{
        position:fixed;inset:0;z-index:99999;
        background:linear-gradient(180deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%);
        display:flex;align-items:center;justify-content:center;
        color:#fbbf24;font-size:14px;font-weight:600;letter-spacing:1px;
      }
      /* 隐藏 body 内所有内容直到遮罩消失 */
      body.hansen-transitioning > *:not(#hwo_transition_mask):not(script):not(style){
        visibility:hidden !important;
      }
    `;
    
    function insertMask(){
      // body 可能还没存在, 用 documentElement
      const mask = document.createElement('div');
      mask.id = 'hwo_transition_mask';
      mask.innerHTML = '<div style="text-align:center"><div style="font-size:36px;margin-bottom:10px">🎯</div><div>正在打开复习中心...</div></div>';
      
      if(document.head){
        document.head.appendChild(style);
      } else {
        document.documentElement.insertBefore(style, document.documentElement.firstChild);
      }
      
      if(document.body){
        document.body.classList.add('hansen-transitioning');
        document.body.appendChild(mask);
      } else {
        // body 还没创建, 等 DOMContentLoaded
        document.documentElement.appendChild(mask);
        document.addEventListener('DOMContentLoaded', () => {
          document.body.classList.add('hansen-transitioning');
          if(mask.parentNode !== document.body){
            document.body.appendChild(mask);
          }
        });
      }
    }
    insertMask();
    
    // 标记给后面的 hansen_wrong_overview.js
    window._hansenAutoOpening = true;
  } catch(e){}
})();
