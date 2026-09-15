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

# S3-39：改用 npm ci —— 严格按 package-lock.json 安装，不重写 lockfile。
# 原 npm install 会按当前 registry（服务器为镜像源）重写 lock 的 resolved 字段，
# 导致「每次部署都把生产检出改脏」，与下次 git pull 冲突（非人为）。
echo "安装依赖（npm ci，不重写 lockfile）"
npm ci

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

# ---- 工作区自检（S3-39）：部署不应产生脏改动 ----
echo "==> 工作区自检（部署不应产生脏改动）"
if [[ ! -d .git ]]; then
  echo "跳过：当前目录不是 git 检出（$(pwd)）"
elif [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  警告：部署后工作区非空，被改动的文件：" >&2
  git status --porcelain >&2
  echo "⚠️  大范围 lock 的 resolved 差异 → 说明仍有脚本在用 npm install，应改 npm ci（S3-39）。" >&2
  echo "⚠️  不要提交这类改动，也不要只 revert 了事——改部署脚本才是根治。" >&2
else
  echo "工作区干净 ✅"
fi
