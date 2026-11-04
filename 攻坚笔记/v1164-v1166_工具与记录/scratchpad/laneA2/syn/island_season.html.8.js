
/* ⭐ v929 (Hansen: "进岛很卡·图片加载不出来") 装饰字体延后加载
   CartoonBlack(子集化后仍有 244KB, 二进制·gzip 压不动)【只用在按钮和标题上】, 却在首屏就抢带宽,
   把首屏图标挤到后面 → 用户看到卡片但图标是空的。
   它本来就是 font-display:swap(先用系统字体显示, 字体到了再换), 所以把 @font-face 的下载
   推迟到【首屏画完之后】→ 关键路径直接少 244KB, 视觉零影响。 */
window.__hsnLateFont=function(){
  if(window.__hsnLateFontDone) return; window.__hsnLateFontDone=1;
  var st=document.createElement('style');
  st.textContent="@font-face{   font-family: 'CartoonBlack';   src: url('cartoon_font.woff2') format('woff2');   font-weight: 900;   font-style: normal;   font-display: swap; }";
  document.head.appendChild(st);
};
if(document.readyState==='complete') setTimeout(window.__hsnLateFont,120);
else window.addEventListener('load', function(){ setTimeout(window.__hsnLateFont,120); });
