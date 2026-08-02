#!/usr/bin/env bash
# ============================================================================
# AI 底座(NestJS backend/ai-base)服务器部署脚本
# 由 auto-deploy.sh 在 git pull 后调用；容错设计：失败仅跳过 AI 底座，
# 不阻断主后端/前端部署。
# 作者：凌舟 | 日期：2026-08-03 | 用途：R73-02 AI 底座部署阻塞项
# ============================================================================
set -uo pipefail

PROJECT_DIR="/opt/zhixiang/liquor-inventory-system"
AI_DIR="${PROJECT_DIR}/backend/ai-base"
BACKEND_ENV="${PROJECT_DIR}/backend/.env"
LOG_DIR="${PROJECT_DIR}/logs"

echo "==> [AI底座] 开始部署 $(date '+%Y-%m-%d %H:%M:%S')"

if [ ! -d "${AI_DIR}" ]; then
  echo "==> [AI底座] 目录不存在(${AI_DIR})，跳过"
  exit 0
fi

# ---- 1. pnpm 检查（AI 底座为 pnpm 工程） ----
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    echo "==> [AI底座] 启用 corepack pnpm"
    corepack enable
  else
    echo "==> [AI底座] 全局安装 pnpm"
    npm install -g pnpm@9 >/dev/null 2>&1 || { echo "==> [AI底座] pnpm 安装失败，跳过"; exit 0; }
  fi
fi

cd "${AI_DIR}"

# ---- 2. 生成 .env（仅当不存在时；共享 backend/.env 的 DB/Redis/JWT 配置） ----
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp ".env.example" ".env"
    echo "==> [AI底座] 从 .env.example 生成 .env"
  fi
  if [ -f "${BACKEND_ENV}" ]; then
    for KEY in DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE REDIS_HOST REDIS_PORT REDIS_PASSWORD JWT_SECRET; do
      VAL=$(grep "^${KEY}=" "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)
      if [ -n "${VAL}" ] && [ -f ".env" ]; then
        if grep -q "^${KEY}=" ".env"; then
          sed -i "s|^${KEY}=.*|${KEY}=${VAL}|" ".env"
        else
          echo "${KEY}=${VAL}" >> ".env"
        fi
      fi
    done
    echo "==> [AI底座] 已同步 backend/.env 的 DB/Redis/JWT 配置"
  fi
else
  echo "==> [AI底座] .env 已存在，保留现有配置"
fi

# ---- 3. 安装依赖（需执行原生脚本以编译 @napi-rs/canvas） ----
echo "==> [AI底座] pnpm install"
pnpm install --no-frozen-lockfile 2>&1 | tail -8 || { echo "==> [AI底座] pnpm install 失败，跳过 AI 底座部署"; exit 0; }

# ---- 4. 构建 ----
echo "==> [AI底座] pnpm build"
pnpm build 2>&1 | tail -8 || { echo "==> [AI底座] 构建失败，跳过 AI 底座部署"; exit 0; }

# ---- 5. 启动 PM2 ----
echo "==> [AI底座] pm2 启动 zhixiang-ai-base"
pm2 delete zhixiang-ai-base 2>/dev/null || true
pm2 start dist/main.js \
  --name zhixiang-ai-base \
  --cwd "${AI_DIR}" \
  --env production \
  --log "${LOG_DIR}/ai-base.log" \
  --time || { echo "==> [AI底座] pm2 启动失败"; exit 0; }
pm2 save

# ---- 6. 健康检查 ----
echo "==> [AI底座] 健康检查 http://127.0.0.1:3016/api/health"
sleep 5
READY=0
for i in {1..15}; do
  if curl -fsS "http://127.0.0.1:3016/api/health" >/dev/null 2>&1; then
    echo "==> [AI底座] 健康检查通过（第 ${i} 次）"
    READY=1
    break
  fi
  sleep 2
done
if [ "${READY}" != "1" ]; then
  echo "==> [AI底座] 健康检查未通过，查看日志：tail -50 ${LOG_DIR}/ai-base.log"
fi

echo "==> [AI底座] 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
