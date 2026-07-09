#!/bin/bash
# 单词大冒险 → GitHub 备份 (AlienRocketBus/wordminiprogram)
# 用法:  TOKEN=github_pat_你的token  bash git_backup.sh  "本次说明"
# token 绝不写死在脚本里(安全)·每次运行时通过环境变量传入
cd "$(dirname "$0")"
if [ -z "$TOKEN" ]; then echo "缺 TOKEN 环境变量。用法: TOKEN=xxx bash git_backup.sh '说明'"; exit 1; fi
MSG="${1:-backup $(date +%Y%m%d-%H%M)}"
git add -A
git commit -m "$MSG" || { echo "无改动,跳过"; exit 0; }
git push "https://x-access-token:${TOKEN}@github.com/AlienRocketBus/wordminiprogram.git" main
echo "✅ 已同步到 GitHub"
