#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# 生产一键回滚脚本（验收项：部署回滚 < 10 分钟）
# 用法：
#   bash deploy/rollback.sh                 # 回滚到上一个已部署提交
#   bash deploy/rollback.sh <commit|tag>    # 回滚到指定提交/标签
# 说明：
#   - 回滚对象为远端 main 历史（git fetch 后 checkout），不依赖本地残留
#   - 构建产物直接覆盖 /var/www/* 各站点目录，pm2 重启后端
#   - 数据库迁移不回退（数据安全优先），如需回退请按 docs/数据库变更清单.md 手工执行反向 SQL
# ============================================================

PROJECT_DIR="/opt/zhixiang/liquor-inventory-system"
LOG_DIR="${PROJECT_DIR}/logs"
cd "${PROJECT_DIR}"
mkdir -p "${LOG_DIR}"

TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
  # 默认回滚到当前部署点（origin/main 上一个提交）
  git fetch origin main
  TARGET="$(git rev-parse origin/main~1 2>/dev/null || echo "")"
  if [[ -z "${TARGET}" ]]; then
    echo "错误：无法确定上一个版本，请显式指定提交（bash deploy/rollback.sh <commit>）" >&2
    exit 1
  fi
fi

echo "==> 回滚目标: ${TARGET}"
git fetch origin main
git checkout --force "${TARGET}" -- .

echo "==> 安装依赖（跳过大型二进制 postinstall）"
npm install --ignore-scripts --legacy-peer-deps
npm --workspace backend rebuild 2>/dev/null || true

echo "==> 构建后端"
rm -rf backend/dist
npm --workspace backend run build

echo "==> 构建前端（相对路径 /api）"
VITE_API_BASE=/api VITE_AI_BASE_URL=/ai-api npm --workspace admin-web run build
VITE_API_BASE=/api VITE_AI_BASE_URL=/ai-api npm --workspace saas-admin run build
VITE_API_BASE=/api VITE_AI_BASE_URL=/ai-api npm --workspace app-mobile run build:h5 || echo "==> [回滚] app-mobile 构建失败（继续）"

echo "==> 部署前端到 Nginx"
rm -rf /var/www/admin-web && mkdir -p /var/www/admin-web
cp -r "${PROJECT_DIR}/admin-web/dist/"* /var/www/admin-web/
rm -rf /var/www/saas-admin && mkdir -p /var/www/saas-admin
cp -r "${PROJECT_DIR}/saas-admin/dist/"* /var/www/saas-admin/
if [ -d "${PROJECT_DIR}/app-mobile/dist/build/h5" ]; then
  rm -rf /var/www/app-mobile && mkdir -p /var/www/app-mobile
  cp -r "${PROJECT_DIR}/app-mobile/dist/build/h5/"* /var/www/app-mobile/
fi

echo "==> 重启后端服务"
pm2 restart zhixiang-api || pm2 start backend/dist/server.js --name zhixiang-api --cwd "${PROJECT_DIR}/backend" --env production --time
pm2 restart zhixiang-ai-base 2>/dev/null || true

echo "==> 健康检查"
sleep 3
curl -s http://127.0.0.1:8080/health || { echo "健康检查失败，请查看 pm2 logs zhixiang-api" >&2; exit 1; }

echo "==> 回滚完成（目标 ${TARGET}）。当前 HEAD=$(git rev-parse --short HEAD)"
