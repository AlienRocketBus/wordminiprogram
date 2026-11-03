import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
# ① 打地鼠：中文意思可以换成两行、太长就把字缩小一点（以前一行放不下就被截成「多少（钱/…」，how many / how much 分不清）；emoji 不折行
rep(BOTH, ".mole-emoji{font-size:36px;line-height:1;", ".mole-emoji{font-size:36px;line-height:1;white-space:nowrap;")
rep(BOTH, "background:rgba(0,0,0,.55);padding:2px 6px;border-radius:7px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;letter-spacing:.5px}",
          "background:rgba(0,0,0,.55);padding:2px 6px;border-radius:7px;max-width:100%;overflow:hidden;letter-spacing:.5px;white-space:normal;word-break:break-word;line-height:1.2;text-align:center;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;box-sizing:border-box}/* 🔴v1165 长的中文意思换成两行，不再被截掉 */")
rep(BOTH, "    slot.dataset.en=a.en;\n    slot.classList.remove('locked','locked-correct','locked-wrong');",
          "    /* 🔴v1165 两行还放不下就把字一点点缩小（最小 9px），保证整句看得见 */\n    try{var __cn=slot.querySelector('.mole-cn');if(__cn){var __fs=13;while(__fs>9&&(__cn.scrollHeight>__cn.clientHeight+1||__cn.scrollWidth>__cn.clientWidth+1)){__fs--;__cn.style.fontSize=__fs+'px';}}}catch(e){}\n    slot.dataset.en=a.en;\n    slot.classList.remove('locked','locked-correct','locked-wrong');")
# ② 打字大师：矮屏幕（高度 680 以下）把键盘按键调矮一点，最下面一排不再被切掉
rep(BOTH, ".key.hint{flex:0 0 auto;width:calc(var(--kw) * 1.5 + var(--kg) * 0.5);height:50px;font-size:23px;background:#aeb3bd}",
          ".key.hint{flex:0 0 auto;width:calc(var(--kw) * 1.5 + var(--kg) * 0.5);height:50px;font-size:23px;background:#aeb3bd}\n/* 🔴v1165 矮屏幕（360×640 这类）键盘底排会被切掉 2px：按键调矮、间距收紧，整块键盘留在屏幕里 */\n@media (max-height:680px){.key,.key.space,.key.delete,.key.hint{height:44px}.keyboard{margin-top:8px;padding-top:6px;padding-bottom:8px}.keyboard-row{margin-bottom:4px}}")
# ③ 泡泡：右边不出界（按泡泡自己的大小算右边界，不再一律 80%）；长单词把字缩小，不撑出泡泡
rep(BOTH, "b.style.left=(slot.l+Math.random()*slot.lr)+'%';",
          "b.style.left=Math.min((slot.l+Math.random()*slot.lr),Math.max(0,(area.clientWidth-size-4)/Math.max(1,area.clientWidth)*100))+'%';  /* 🔴v1165 右边按泡泡大小留够，不出界 */")
rep(BOTH, "b.textContent=w.en;b.dataset.en=w.en;", "b.textContent=w.en;b.dataset.en=w.en;b.__hsnFit=1;")
rep(BOTH, "    if(cx>80){cx=80;angle=-angle}",
          "    const _mx=Math.max(0,(areaW-(parseFloat(b.dataset.size)||80)-4)/areaW*100);   /* 🔴v1165 右边界按泡泡自己的大小算（以前一律 80%，窄屏上大泡泡有一半跑出去） */\n    if(cx>_mx){cx=_mx;angle=-angle}")
rep(BOTH, "area.appendChild(b);\nb.dataset.angle=Math.random()*Math.PI*2;",
          "area.appendChild(b);\n/* 🔴v1165 长单词（grandmother）比泡泡还宽：把字一点点缩小（最小 10px） */\ntry{let __fs=14;while(__fs>10&&b.scrollWidth>b.clientWidth+1){__fs--;b.style.fontSize=__fs+'px';}}catch(e){}\nb.dataset.angle=Math.random()*Math.PI*2;")
commit()
