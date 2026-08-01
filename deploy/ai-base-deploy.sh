#!/usr/bin/env bash
# ============================================================================
# 智享AI底座部署脚本（backend/ai-base，NestJS，端口 3016）
#
# 流程：git pull → pnpm install → nest build → pm2 restart
#
# 前置条件：
#   1. 服务器已安装 Node.js（建议 ≥ 20，项目用 Node 22）/ pnpm（或 corepack 启用）
#   2. backend/ai-base/.env 已从 .env.example 复制并填写（DB/Redis/DeepSeek/ENCRYPTION_KEY）
#   3. MySQL 已执行 docs/migrations/121_ai_base_tables.sql 与 122_ai_rag.sql（或由迁移兜底建表）
#
# 用法：
#   bash deploy/ai-base-deploy.sh            # 正常部署（先 git pull）
#   SKIP_GIT_PULL=true bash deploy/ai-base-deploy.sh   # 跳过拉取代码
#
# 对应文档：
# - docs/部署文档.md  /  docs/DEPLOY.md
#
# 负责人: 阿坚 | 创建日期: 2026-08-02
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
AI_BASE_DIR="${PROJECT_DIR}/backend/ai-base"
LOG_DIR="${PROJECT_DIR}/logs"
PM2_NAME="ai-base"
PORT="${AI_BASE_PORT:-3016}"

echo "=== 智享AI底座部署开始 $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "项目目录：${PROJECT_DIR}"

# ── 1. 拉取最新代码 ───────────────────────────────────────────────
if [[ "${SKIP_GIT_PULL:-false}" == "true" ]]; then
  echo "跳过拉取代码：SKIP_GIT_PULL=true"
else
  echo "拉取最新代码"
  git -C "${PROJECT_DIR}" -c http.version=HTTP/1.1 pull origin main
fi

# ── 2. 安装依赖（pnpm） ───────────────────────────────────────────
cd "${AI_BASE_DIR}"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "未找到 pnpm，尝试启用 corepack"
  corepack enable
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo "仍无 pnpm，请先安装：npm install -g pnpm"
  exit 1
fi
echo "安装依赖（--frozen-lockfile 锁定版本）"
pnpm install --frozen-lockfile

# ── 3. 构建（nest build → dist/） ─────────────────────────────────
echo "构建 AI 底座"
pnpm run build

# ── 4. 检查 .env 配置 ─────────────────────────────────────────────
if [[ ! -f "${AI_BASE_DIR}/.env" ]]; then
  echo "警告：${AI_BASE_DIR}/.env 不存在！"
  echo "请先执行：cp backend/ai-base/.env.example backend/ai-base/.env 并填写 DB_PASSWORD / ENCRYPTION_KEY / JWT_SECRET / DEEPSEEK_API_KEY"
  exit 1
fi

# ── 5. pm2 启动 / 重启 ────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "安装 PM2"
  npm install -g pm2
fi

if pm2 describe "${PM2_NAME}" >/dev/null 2>&1; then
  echo "重启进程 ${PM2_NAME}（pm2 restart）"
  pm2 restart "${PM2_NAME}"
else
  echo "首次启动进程 ${PM2_NAME}（pm2 start）"
  pm2 start "${AI_BASE_DIR}/dist/main.js" \
    --name "${PM2_NAME}" \
    --time \
    --log "${LOG_DIR}/ai-base.log"
fi
pm2 save

# ── 6. 健康检查（/api/admin/health 需返回 HTTP 200） ─────────────
echo "等待健康检查（端口 ${PORT}）"
for i in {1..30}; do
  if curl -fsS "http://127.0.0.1:${PORT}/api/admin/health" >/dev/null; then
    echo "AI 底座已就绪"
    break
  fi
  if [[ "$i" == "30" ]]; then
    echo "AI 底座启动超时，请查看日志：logs/ai-base.log"
    pm2 logs "${PM2_NAME}" --lines 80 || tail -n 80 "${LOG_DIR}/ai-base.log" || true
    exit 1
  fi
  sleep 2
done

echo "=== 智享AI底座部署完成 $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "日志：${LOG_DIR}/ai-base.log"
echo "健康检查：curl http://127.0.0.1:${PORT}/api/admin/health"
