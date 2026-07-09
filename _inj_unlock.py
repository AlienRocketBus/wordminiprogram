import shutil
P='hansen_boss_attack.js'
s=open(P,encoding='utf-8').read()
shutil.copy(P,'/tmp/hba_bak10.js')

# ── 1) 全局解锁函数(插在 function openPanel 之前) ──
FN_ANCHOR='function openPanel(userMode){'
GLOBALS=r'''/* 🔴 v870(Hansen): 后台密码解锁全部 Boss 关卡——管理员面板内(已被密码门锁·仅管理员模式显示)提供一键解锁。
   ①解锁全部星海星域(hsn_seasonmap_cleared_1..5=5星域+女帝全可进) ②直达第一星域6关任意一关(设 season1_prog) ③解锁全主岛Boss(角色经验升满→全岛Lv1~20可打)。只影响进度键·不碰特效。 */
window.__hsnUnlockStarSea=function(){
  try{ for(var i=1;i<=5;i++){ localStorage.setItem('hsn_seasonmap_cleared_'+i,'1'); }
    alert('\u2705 \u5df2\u89e3\u9501\uff1a\u661f\u6d77\u5168\u90e8 5 \u661f\u57df + \u5973\u5e1d\u8d5b\u5c14\u96c5\u5168\u90e8\u53ef\u8fdb\u3002\u5237\u65b0\u540e\u751f\u6548\u3002');
    location.reload();
  }catch(e){ try{alert('\u89e3\u9501\u5931\u8d25: '+e.message);}catch(e2){} }
};
window.__hsnJumpS1=function(idx){
  try{ localStorage.setItem('hsn_seasonmap_cleared_1','1'); localStorage.setItem('season1_prog', String(idx));
    location.href='island_season1.html';
  }catch(e){ try{alert(e.message);}catch(e2){} }
};
window.__hsnUnlockMain=function(){
  try{ if(!confirm('\u8fd9\u4f1a\u628a\u89d2\u8272\u7ecf\u9a8c\u8bbe\u4e3a\u6ee1\u7ea7(\u89e3\u9501\u5168\u90e8\u4e3b\u5c9b Lv1~20 Boss)\uff0c\u4f60\u7684\u7b49\u7ea7\u4f1a\u663e\u793a\u4e3a\u6ee1\u7ea7\u3002\u7ee7\u7eed\uff1f')) return;
    localStorage.setItem('hansen_wallet_charxp','99999999');
    alert('\u2705 \u89d2\u8272\u5df2\u5347\u6ee1\u7ea7\uff0c\u5168\u90e8\u4e3b\u5c9b Boss \u89e3\u9501\u3002\u5237\u65b0\u540e\u751f\u6548\u3002');
    location.reload();
  }catch(e){ try{alert(e.message);}catch(e2){} }
};
'''
i=s.find(FN_ANCHOR); assert i>=0,'openPanel not found'
s=s[:i]+GLOBALS+s[i:]

# ── 2) 面板内注入解锁区(在 tip 之后·仅 !CUR_USER 管理员模式) ──
TIP_ANCHOR="\u6539\u52a8\u8fc7\u7684 boss \u4eae\u91d1\u8fb9\u3002</div>';"
SECTION=r'''
   if(!CUR_USER){
     var _s1n=['\u2460\u7834\u9635\u8005','\u2461\u6218\u4e89\u94c1\u7827','\u2462\u6d41\u4ea1\u4e4b\u5203','\u2463\u7ec4\u88c5\u8005','\u2464\u53e4\u8001\u610f\u5fd7','\u2465\u94f8\u661f\u8005'];
     h+='<div class="hbafx-tip" style="border-color:#f0a830;background:rgba(240,168,48,.10)">\ud83d\udd13 <b style="color:#fde68a">\u5f00\u53d1\u8005\u00b7\u89e3\u9501\u5168\u90e8 Boss \u5173\u5361</b></div>';
     h+='<button class="hbafx-btn pri" style="width:100%;margin:4px 0" onclick="window.__hsnUnlockStarSea()">\ud83c\udf0c \u89e3\u9501\u5168\u90e8\u661f\u6d77\u661f\u57df\uff085 \u661f\u57df + \u5973\u5e1d\uff09</button>';
     h+='<div style="font-size:11px;color:#a78bca;margin:6px 0 3px">\ud83c\udfaf \u76f4\u8fbe\u7b2c\u4e00\u661f\u57df\u67d0\u4e00\u5173\uff08\u70b9\u4e86\u8df3\u8fdb\u53bb\u6253\uff09\uff1a</div>';
     h+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px">';
     for(var _k=0;_k<6;_k++){ h+='<button class="hbafx-btn" style="flex:1;min-width:30%;font-size:12px" onclick="window.__hsnJumpS1('+_k+')">'+_s1n[_k]+'</button>'; }
     h+='</div>';
     h+='<button class="hbafx-btn" style="width:100%;margin:2px 0 8px;font-size:12px" onclick="window.__hsnUnlockMain()">\u2b50 \u89e3\u9501\u5168\u90e8\u4e3b\u5c9b Boss\uff08\u89d2\u8272\u5347\u6ee1\u7ea7\u00b7\u4f1a\u6539\u4f60\u7684\u7b49\u7ea7\uff09</button>';
   }'''
k=s.find(TIP_ANCHOR); assert k>=0,'tip anchor not found'
k2=k+len(TIP_ANCHOR)
s=s[:k2]+SECTION+s[k2:]

open(P,'w',encoding='utf-8').write(s)
print('注入完成·文件长度', len(s))
