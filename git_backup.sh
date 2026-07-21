#!/bin/bash
# 单词大冒险 → GitHub 备份 (AlienRocketBus/wordminiprogram)
# 用法: bash git_backup.sh "本次说明"
# 认证由 GitHub CLI / GitHub App / 系统凭据管理器负责；脚本不接收也不拼接明文 Token。
cd "$(dirname "$0")"
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI 尚未安全登录。请先使用 gh auth login 或已连接的 GitHub App。"
  exit 1
fi
MSG="${1:-backup $(date +%Y%m%d-%H%M)}"
git add -A
git commit -m "$MSG" || { echo "无改动,跳过"; exit 0; }
git push origin main
echo "✅ 已同步到 GitHub"
