(function(){'use strict';
if(location.protocol!=='file:')return;/* 🔴v1152：**只在真的像"用户下载了文件"时才救。**
   实测踩到：file:// 不只出现在"下载后双击打开"这一种情况 ——
   本地开发、自动化测试也是直接用 file:// 打开页面的。
   自救层盖满全屏，把主题动效元素全遮住了，
   test_theme_motion_v943 因此长期红着（而它被超时跳过，没人知道）。
   判据收紧：只有页面挂在下载目录里才算。
   拿不准时**不弹** —— 误弹会挡住正常使用，比漏弹更糟。 */
var p=(location.pathname||'').toLowerCase();
if(!/\/(?:downloads?|\u4e0b\u8f7d|tencent\/micromsg|weixin)\//.test(p)) return;

var SITE='https://superwords-ambitious-d0g1d26xm740dc3d6.webapps.tcloudbase.com/index.html';
var shown=false;
function show(){
  if(shown)return; shown=true;
  try{
    var d=document.createElement('div');
    d.id='hsnSelfRescue';
    d.setAttribute('style','position:fixed;inset:0;z-index:2147483647;background:#0b1020;color:#e8eefc;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,-apple-system,"PingFang SC",sans-serif');
    d.innerHTML='<div style="font-size:46px">\ud83d\udcc4</div>'
      +'<div style="font-size:19px;font-weight:800;margin-top:12px">\u8fd9\u662f\u4e0b\u8f7d\u4e0b\u6765\u7684\u6587\u4ef6</div>'
      +'<div style="font-size:14px;color:#a9b4c7;margin-top:10px;line-height:1.8;max-width:340px">\u4f60\u73b0\u5728\u6253\u5f00\u7684\u662f\u4e00\u4e2a\u5b58\u5728\u624b\u673a\u91cc\u7684\u6587\u4ef6\uff0c<br>\u4e0d\u662f\u7f51\u7ad9\u672c\u8eab \u2014\u2014 \u6240\u4ee5\u8fdb\u5ea6\u3001\u767b\u5f55\u90fd\u7528\u4e0d\u4e86\u3002<br>\u70b9\u4e0b\u9762\u7684\u6309\u94ae\u56de\u5230\u771f\u6b63\u7684\u7f51\u7ad9\u3002</div>'
      +'<a href="'+SITE+'" style="margin-top:20px;display:inline-block;background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;text-decoration:none;padding:14px 26px;border-radius:14px;font-size:16px;font-weight:800">\ud83c\udf10 \u6253\u5f00\u771f\u6b63\u7684\u7f51\u7ad9</a>'
      +'<div style="font-size:11.5px;color:#7c879b;margin-top:16px;word-break:break-all;max-width:340px">'+SITE+'</div>'
      +'<div style="font-size:11.5px;color:#7c879b;margin-top:14px;line-height:1.7;max-width:340px">\uff08\u8fdb\u53bb\u4e4b\u540e\u53ef\u4ee5\u628a\u8fd9\u4e2a\u4e0b\u8f7d\u7684\u6587\u4ef6\u5220\u6389\uff09</div>';
    (document.body||document.documentElement).appendChild(d);
  }catch(e){}
}
/* 不依赖任何一个时机 —— 三条路都试，谁先到算谁的 */
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',show);}
else{show();}
window.addEventListener('load',show);
/* 主逻辑可能在就绪后重绘整个 body，所以再补一次 */
setTimeout(function(){shown=false;show();},1200);
})();