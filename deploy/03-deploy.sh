#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
LOG_DIR="${PROJECT_DIR}/logs"
PID_FILE="${LOG_DIR}/backend.pid"

cd "${PROJECT_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "找不到 .env，请先执行：cp deploy/.env.example .env，并填写 DB_PASSWORD、JWT_SECRET、DOMAIN。"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${PORT:=8080}"
: "${USE_MOCK_DB:=false}"
if [[ -z "${VITE_API_BASE:-}" ]]; then
  if [[ -n "${DOMAIN:-}" ]]; then
    VITE_API_BASE="https://api.${DOMAIN}/api"
  else
    echo "缺少 VITE_API_BASE 或 DOMAIN，拒绝构建会请求 localhost 的生产前端。"
    exit 1
  fi
fi

if [[ "${SKIP_GIT_PULL:-false}" == "true" ]]; then
  echo "跳过拉取代码：SKIP_GIT_PULL=true"
else
  echo "拉取最新代码"
  git -c http.version=HTTP/1.1 pull origin main
fi

echo "安装依赖"
npm install

echo "构建后端和前端"
npm --workspace backend run build
echo "前端 API 地址：${VITE_API_BASE}"
VITE_API_BASE="${VITE_API_BASE}" npm --workspace admin-web run build
VITE_API_BASE="${VITE_API_BASE}" npm --workspace saas-admin run build
npm --workspace website run build
npm run test:production-deploy

mkdir -p "${LOG_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "停止旧后端进程：${OLD_PID}"
    kill "${OLD_PID}"
    sleep 2
  fi
fi

echo "启动后端，端口 ${PORT}"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "安装 PM2"
  npm install -g pm2
fi

pm2 delete zhixiang-api 2>/dev/null || true
pm2 start "${PROJECT_DIR}/backend/dist/server.js" \
  --name zhixiang-api \
  --env production \
  --log "${LOG_DIR}/backend.log" \
  --time \
  -- \
  --port="${PORT}"

echo "等待后端健康检查"
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    echo "后端已就绪"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "后端启动超时，请查看 logs/backend.log"
    pm2 logs zhixiang-api --lines 80 || tail -n 80 "${LOG_DIR}/backend.log" || true
    exit 1
  fi
  sleep 2
done

pm2 save

echo "运行 MySQL smoke test"
API_BASE="http://127.0.0.1:${PORT}" npm run test:mysql

echo "运行 QA 回归"
API_BASE="http://127.0.0.1:${PORT}/api" npm run test:qa

echo "部署完成"
echo "日志：${LOG_DIR}/backend.log"
