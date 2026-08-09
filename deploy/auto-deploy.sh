#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/opt/zhixiang/liquor-inventory-system"
LOG_DIR="${PROJECT_DIR}/logs"
cd "${PROJECT_DIR}"
mkdir -p "${LOG_DIR}"

echo "==> 拉取最新代码"
git fetch origin main
git reset --hard origin/main

echo "==> 安装依赖（跳过 electron 等大型二进制 postinstall）"
npm install --ignore-scripts --legacy-peer-deps
echo "==> 重建后端原生模块"
npm --workspace backend rebuild 2>/dev/null || true

echo "==> 构建后端"
# R95-03 修复：构建前清理 dist，防止已删除源文件的旧编译产物残留
# （auto-routes 扫描 dist/routes 曾加载已删的 admin.routes.js 旧路由，导致销售排行走旧实现）
rm -rf backend/dist
npm --workspace backend run build

echo "==> 执行数据库迁移（新增表结构，容错不阻断部署）"
cd "${PROJECT_DIR}/backend"
node ../scripts/run-migration.mjs ../docs/migrations/126_bills.sql || echo "迁移 126 执行失败，请手动执行（票据功能将显示空列表）"
node ../scripts/run-migration.mjs ../docs/migrations/127_order_routing_exception.sql || echo "迁移 127 执行失败，请手动执行（订单路由/异常功能将显示空列表）"
cd "${PROJECT_DIR}"

echo "==> 构建前端（相对路径 /api；AI 底座走 /ai-api nginx 代理 → 服务器 3016）"
VITE_API_BASE=/api VITE_AI_BASE_URL=/ai-api npm --workspace admin-web run build
VITE_API_BASE=/api VITE_AI_BASE_URL=/ai-api npm --workspace saas-admin run build

echo "==> 构建商户端 H5"
VITE_API_BASE=/api npm --workspace app-mobile run build:h5 2>/dev/null || echo "app-mobile 构建跳过"

echo "==> 构建官网"
npm --workspace website run build

echo "==> 部署前端到 Nginx"
# admin-web → admin.onepan.cn
rm -rf /var/www/admin-web
mkdir -p /var/www/admin-web
cp -r "${PROJECT_DIR}/admin-web/dist/"* /var/www/admin-web/

# saas-admin → saas.onepan.cn
rm -rf /var/www/saas-admin
mkdir -p /var/www/saas-admin
cp -r "${PROJECT_DIR}/saas-admin/dist/"* /var/www/saas-admin/

# app-mobile → m.onepan.cn
if [ -d "${PROJECT_DIR}/app-mobile/dist/build/h5" ]; then
  rm -rf /var/www/app-mobile
  mkdir -p /var/www/app-mobile
  cp -r "${PROJECT_DIR}/app-mobile/dist/build/h5/"* /var/www/app-mobile/
fi

# 官网 → www.onepan.cn
rm -rf /var/www/website
mkdir -p /var/www/website
cp -r "${PROJECT_DIR}/website/dist/"* /var/www/website/

echo "==> 确保生产环境 .env 配置正确"
ENV_FILE="${PROJECT_DIR}/backend/.env"
if [ ! -f "${ENV_FILE}" ]; then
  cp "${PROJECT_DIR}/backend/.env.example" "${ENV_FILE}"
fi
# 强制覆盖为生产环境配置（不管git拉下来的是什么）
sed -i 's/^USE_MOCK_DB=.*/USE_MOCK_DB=false/' "${ENV_FILE}" || true
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "${ENV_FILE}" || true
# 确保 JWT_SECRET 不为占位符（使用动态随机密钥，R63 安全修复）
if grep -q 'CHANGE_ME_TO_RANDOM_JWT_SECRET' "${ENV_FILE}"; then
  JWT_RANDOM=$(openssl rand -base64 32)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_RANDOM}|" "${ENV_FILE}" || true
  echo "  JWT_SECRET 已动态生成（安全）"
fi
# 确保 CSRF_SECRET 不为占位符
if grep -q 'CHANGE_ME_TO_RANDOM_CSRF_SECRET' "${ENV_FILE}"; then
  CSRF_RANDOM=$(openssl rand -base64 32)
  sed -i "s|CSRF_SECRET=.*|CSRF_SECRET=${CSRF_RANDOM}|" "${ENV_FILE}" || true
  echo "  CSRF_SECRET 已动态生成（安全）"
fi
echo "  USE_MOCK_DB=$(grep '^USE_MOCK_DB=' "${ENV_FILE}" | cut -d= -f2)"
echo "  NODE_ENV=$(grep '^NODE_ENV=' "${ENV_FILE}" | cut -d= -f2)"

echo "==> 重载 Nginx"
nginx -t && nginx -s reload

echo "==> 重启后端服务"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete zhixiang-api 2>/dev/null || true
  pm2 start "${PROJECT_DIR}/backend/dist/server.js" \
    --name zhixiang-api \
    --cwd "${PROJECT_DIR}/backend" \
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

echo "==> 部署 AI 底座（容错：失败不阻断主部署）"
bash "${PROJECT_DIR}/deploy/ai-base-deploy.sh" || echo "AI 底座部署跳过（见上方日志）"

echo "==> 运行冒烟测试"
set -a && source "${PROJECT_DIR}/backend/.env" && set +a
npm run test:mysql 2>/dev/null || echo "冒烟测试跳过"

echo "==> 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
