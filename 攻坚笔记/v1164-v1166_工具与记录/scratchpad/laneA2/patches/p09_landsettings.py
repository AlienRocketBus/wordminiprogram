import sys; sys.path.insert(0, '/tmp/claude-0/-home-user/b052e910-3530-51b4-ab26-f93cff834d3d/scratchpad/laneA/tools')
from P import *
import P as _P
t = _P._get(T)
# ① 等级表导出给后台面板（和常规岛一样）
rep(L, "  {lv:30, name:'冒险之王',   emoji:'👑', xp:52200, desc:'冒险之巅, 王者归来'}\n];\n",
       "  {lv:30, name:'冒险之王',   emoji:'👑', xp:52200, desc:'冒险之巅, 王者归来'}\n];\n/* 🔴v1055: 导出给后台面板用（等级调节需要读阈值表）。const 不会自动挂到 window。🔴v1165 单词大陆也要（以前后台说「没有等级表」） */\ntry{ window.ADVENTURE_LEVELS = ADVENTURE_LEVELS; }catch(e){}\n")
# ② 设置页「🔊 发音音量」：从常规岛母版逐字搬过来
a = t.index("function renderSettings(){\n  /*🔴v1032: 发音音量滑杆绑定(渲染后执行)*/")
b = t.index("  const totalWords=allW.length;", a)
bind = t[a+len("function renderSettings(){\n"):b]
c = t.index("  document.getElementById('settingsContent').innerHTML=\n    /*🔴v1032: 发音音量调节——全站统一，滑动即生效并试听*/", a)
d = t.index("    '<div class=\"settings-section\">'+\n      '<h3>📊 当前进度概览</h3>'+", c)
block = t[c+len("  document.getElementById('settingsContent').innerHTML=\n"):d]
rep(L, "function renderSettings(){\n  const totalWords=allW.length;", "function renderSettings(){\n" + bind + "  const totalWords=allW.length;")
rep(L, "  document.getElementById('settingsContent').innerHTML=\n    '<div class=\"settings-section\">'+\n      '<h3>📊 当前进度概览</h3>'+",
       "  document.getElementById('settingsContent').innerHTML=\n" + block + "    '<div class=\"settings-section\">'+\n      '<h3>📊 当前进度概览</h3>'+")
commit()
