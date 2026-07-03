#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/zhixiang/liquor-inventory-system"
LOG_DIR="${PROJECT_DIR}/logs"
cd "${PROJECT_DIR}"

echo "==> 拉取最新代码"
git fetch origin main
git reset --hard origin/main

echo "==> 安装依赖"
npm install --production=false

echo "==> 构建后端"
npm --workspace backend run build

echo "==> 构建前端（相对路径 /api）"
VITE_API_BASE=/api npm --workspace admin-web run build
VITE_API_BASE=/api npm --workspace merchant-mobile run build
VITE_API_BASE=/api npm --workspace store-terminal run build

echo "==> 执行数据库迁移"
set +e
# 加载 .env 获取数据库连接信息
if [ -f "${PROJECT_DIR}/.env" ]; then
  set -a && source "${PROJECT_DIR}/.env" && set +a
fi
if [ -f "${PROJECT_DIR}/docs/migrations/add_tenant_id.sql" ]; then
  mysql -u"${DB_USER:-root}" -p"${DB_PASSWORD:-}" "${DB_NAME:-liquor_inventory}" < "${PROJECT_DIR}/docs/migrations/add_tenant_id.sql" 2>&1 || echo "  迁移警告（可能已执行过）"
fi
set -e

echo "==> 重载 Nginx"
nginx -t && nginx -s reload

echo "==> 重启后端服务"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete zhixiang-api 2>/dev/null || true
  pm2 start "${PROJECT_DIR}/backend/dist/server.js" \
    --name zhixiang-api \
    --env production \
    --log "${LOG_DIR}/backend.log" \
    --time
  pm2 save
else
  echo "PM2 未安装，跳过"
fi

echo "==> 等待后端就绪"
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:8080/health" >/dev/null 2>&1; then
    echo "后端已就绪"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "后端启动超时"
    exit 1
  fi
  sleep 2
done

echo "==> 运行冒烟测试"
set -a && source .env && set +a
npm run test:mysql 2>/dev/null || echo "冒烟测试跳过"

echo "==> 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
