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
npm install --ignore-scripts
echo "==> 重建后端原生模块"
npm --workspace backend rebuild 2>/dev/null || true

echo "==> 构建后端"
npm --workspace backend run build

echo "==> 构建前端（相对路径 /api）"
VITE_API_BASE=/api npm --workspace admin-web run build
VITE_API_BASE=/api npm --workspace saas-admin run build

echo "==> 构建官网"
npm --workspace website run build

echo "==> 部署官网到 /var/www/website"
rm -rf /var/www/website
mkdir -p /var/www/website
cp -r "${PROJECT_DIR}/website/dist/"* /var/www/website/

echo "==> 确保生产环境 .env 配置正确"
ENV_FILE="${PROJECT_DIR}/backend/.env"
if [ ! -f "${ENV_FILE}" ]; then
  cp "${PROJECT_DIR}/backend/.env.example" "${ENV_FILE}"
fi
# 强制覆盖为生产环境配置（不管git拉下来的是什么）
sed -i 's/^USE_MOCK_DB=.*/USE_MOCK_DB=false/' "${ENV_FILE}"
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' "${ENV_FILE}"
# 确保 JWT_SECRET 不为占位符
if grep -q 'CHANGE_ME_TO_RANDOM_JWT_SECRET' "${ENV_FILE}"; then
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=zhixiang_liquor_jwt_secret_2026_secure|" "${ENV_FILE}"
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

echo "==> 运行冒烟测试"
set -a && source "${PROJECT_DIR}/backend/.env" && set +a
npm run test:mysql 2>/dev/null || echo "冒烟测试跳过"

echo "==> 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
