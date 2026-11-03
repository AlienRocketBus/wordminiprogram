import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
old = "  try{ var _smm=(location.pathname||'').match(/island_land([1-8])\\.html/); if(_smm && (window._s1Idx==null || window._s1Idx===(BOSSES.length-1))){ localStorage.setItem('hsn_landmap_cleared_'+_smm[1],'1'); } }catch(e){}\n"
new = """  /* 🔴v1165 「已通关」只在按顺序打赢最后一关时才记（这里先读进度，下面才推进）。72 小时体验期能跳着挑战任何一关，
     跳打赢了最后一关不算通关——以前这样会把岛永久标成「已通关」，进度却还是 0，还能解锁女帝终战。 */
  try{ var _smm=(location.pathname||'').match(/island_land([1-8])\\.html/); if(_smm){ var __clp=parseInt(localStorage.getItem('land'+_smm[1]+'_prog')||'0',10)||0; if(window._s1Idx===__clp && __clp===(BOSSES.length-1)){ localStorage.setItem('hsn_landmap_cleared_'+_smm[1],'1'); } } }catch(e){}
"""
rep(L, old, new)
commit()
