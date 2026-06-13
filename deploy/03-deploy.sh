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

echo "拉取最新代码"
git pull origin main

echo "安装依赖"
npm install

echo "构建后端和前端"
npm --workspace backend run build
npm --workspace admin-web run build
npm --workspace store-terminal run build

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
nohup env \
  USE_MOCK_DB="${USE_MOCK_DB}" \
  PORT="${PORT}" \
  JWT_SECRET="${JWT_SECRET}" \
  DB_HOST="${DB_HOST}" \
  DB_PORT="${DB_PORT}" \
  DB_USER="${DB_USER}" \
  DB_PASSWORD="${DB_PASSWORD}" \
  DB_NAME="${DB_NAME}" \
  WECHAT_APP_ID="${WECHAT_APP_ID:-}" \
  WECHAT_MCH_ID="${WECHAT_MCH_ID:-}" \
  WECHAT_PAY_SERIAL_NO="${WECHAT_PAY_SERIAL_NO:-}" \
  WECHAT_PAY_PRIVATE_KEY_PATH="${WECHAT_PAY_PRIVATE_KEY_PATH:-}" \
  WECHAT_PAY_API_V3_KEY="${WECHAT_PAY_API_V3_KEY:-}" \
  npm --workspace backend run start > "${LOG_DIR}/backend.log" 2>&1 &

echo $! > "${PID_FILE}"

echo "等待后端健康检查"
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null; then
    echo "后端已就绪"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "后端启动超时，请查看 logs/backend.log"
    tail -n 80 "${LOG_DIR}/backend.log" || true
    exit 1
  fi
  sleep 2
done

echo "运行 MySQL smoke test"
API_BASE="http://127.0.0.1:${PORT}" npm run test:mysql

echo "运行 QA 回归"
API_BASE="http://127.0.0.1:${PORT}/api" npm run test:qa

echo "部署完成"
echo "日志：${LOG_DIR}/backend.log"
