# .devtools — 开发验证工具(点开头·build.py 打包剪枝·不进部署包·仅供开发)

- **audit6_contrast_auditor.mjs** — 亮色配色对比度审计器(hex 渐变感知)。设 localStorage.hansen_palette_global='cloud' 后逐元素扫对比度<3。**局限：测不出 text-shadow/描边**(见交接文档 §10)。
- **boss_fx_verify_template.mjs** — boss 攻击特效渲染+分相位截图模板(见交接文档 §9)。改 BOSS/PHASES 复用。
- 视觉验证靠 PIL 像素分析(view 工具常挂)：pip install Pillow --break-system-packages -q。
- 完整操作总纲见仓库根 `对话交接_CLAUDE_HANDOFF.md`。
