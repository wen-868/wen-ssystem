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

# ---- 1. pnpm 检查（AI 底座为 pnpm 工程；服务器 Node 为 v20，必须用 pnpm@9，
#          corepack 默认拉取 pnpm 11 需 Node 22，会报 ERR_UNKNOWN_BUILTIN_MODULE） ----
if ! command -v pnpm >/dev/null 2>&1; then
  echo "==> [AI底座] 全局安装 pnpm@9（兼容 Node 20）"
  npm install -g pnpm@9 >/dev/null 2>&1 || { echo "==> [AI底座] pnpm 安装失败，跳过"; exit 0; }
else
  PNPM_VERSION=$(pnpm --version 2>/dev/null || echo "unknown")
  echo "==> [AI底座] 已有 pnpm ${PNPM_VERSION}"
  if [ "${PNPM_VERSION%%.*}" -ge 10 ] 2>/dev/null; then
    echo "==> [AI底座] pnpm 主版本 ≥10 可能需 Node 22，降级为 pnpm@9"
    npm install -g pnpm@9 >/dev/null 2>&1 || true
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
    # 注意变量名映射：backend 用 DB_USER/DB_NAME，ai-base 用 DB_USERNAME/DB_DATABASE
    declare -A KEY_MAP=(
      [DB_HOST]=DB_HOST
      [DB_PORT]=DB_PORT
      [DB_USER]=DB_USERNAME
      [DB_NAME]=DB_DATABASE
      [DB_PASSWORD]=DB_PASSWORD
      [REDIS_HOST]=REDIS_HOST
      [REDIS_PORT]=REDIS_PORT
      [REDIS_PASSWORD]=REDIS_PASSWORD
      [JWT_SECRET]=JWT_SECRET
      [CSRF_SECRET]=CSRF_SECRET
    )
    for SRC in "${!KEY_MAP[@]}"; do
      DST="${KEY_MAP[$SRC]}"
      VAL=$(grep "^${SRC}=" "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)
      if [ -n "${VAL}" ] && [ -f ".env" ]; then
        if grep -q "^${DST}=" ".env"; then
          sed -i "s|^${DST}=.*|${DST}=${VAL}|" ".env"
        else
          echo "${DST}=${VAL}" >> ".env"
        fi
      fi
    done
    echo "==> [AI底座] 已同步 backend/.env 的 DB/Redis/JWT 配置（含 DB_USER→DB_USERNAME 映射）"
  fi
else
  echo "==> [AI底座] .env 已存在，保留现有配置"
fi

# ---- 2.4 每次部署都同步 CSRF_SECRET（写操作请求后端需要 x-csrf-token，
#          token = HMAC(CSRF_SECRET || JWT_SECRET, userId)，必须与 backend 一致） ----
if [ -f ".env" ] && [ -f "${BACKEND_ENV}" ]; then
  B_CSRF=$(grep '^CSRF_SECRET=' "${BACKEND_ENV}" | head -1 | cut -d= -f2- || true)
  if [ -n "${B_CSRF}" ]; then
    if grep -q '^CSRF_SECRET=' ".env"; then
      sed -i "s|^CSRF_SECRET=.*|CSRF_SECRET=${B_CSRF}|" ".env"
    else
      echo "CSRF_SECRET=${B_CSRF}" >> ".env"
    fi
    echo "==> [AI底座] 已同步 CSRF_SECRET（与 backend/.env 一致）"
  else
    echo "==> [AI底座] backend/.env 无 CSRF_SECRET，AI 底座将回退 JWT_SECRET 计算 CSRF"
  fi
fi

# ---- 2.5 确保 ENCRYPTION_KEY 为真实随机密钥（AUDIT-REPORT R3：禁止占位符/示例密钥启动） ----
if [ -f ".env" ]; then
  CUR_KEY=$(grep '^ENCRYPTION_KEY=' ".env" | head -1 | cut -d= -f2- || true)
  # 历史示例密钥（R70-01 曾提交于 .env.example，属公开值，禁止用于生产，检测到即轮换）
  EXAMPLE_KEY="14804bc70a2fcff7125aca977139aa5a92e3bff867e5aa1c5ebf1c3219db7359"
  if [ -z "${CUR_KEY}" ] || [ "${CUR_KEY}" = "${EXAMPLE_KEY}" ] || \
     echo "${CUR_KEY}" | grep -qiE 'change_me|changeme|your-encryption-key|your_encryption_key|replace_me|placeholder|请替换|xxx'; then
    NEW_KEY=$(openssl rand -hex 32)
    if grep -q '^ENCRYPTION_KEY=' ".env"; then
      sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEW_KEY}|" ".env"
    else
      echo "ENCRYPTION_KEY=${NEW_KEY}" >> ".env"
    fi
    echo "==> [AI底座] ENCRYPTION_KEY 为空/占位符/示例密钥，已用 openssl rand 自动生成并写入 .env（安全）"
  else
    echo "==> [AI底座] ENCRYPTION_KEY 已配置为真实密钥，保留现有值"
  fi
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

# ---- 7. nginx /ai-api/ 反代自动配置（SSE 流式对话 + WebSocket 实时推送） ----
# 幂等：已存在 /ai-api/ 则跳过；修改前备份；nginx -t 校验失败自动回滚，绝不破坏现有配置
echo "==> [AI底座] 检查 nginx /ai-api/ 反代配置"
NGINX_SITE=""
for f in /etc/nginx/sites-available/*; do
  if [ -f "${f}" ] && grep -q "server_name.*admin.onepan.cn" "${f}" 2>/dev/null; then
    NGINX_SITE="${f}"
    break
  fi
done

if [ -z "${NGINX_SITE}" ]; then
  echo "==> [AI底座] 未找到 admin.onepan.cn 的 nginx 配置文件（跳过；请手动配置 /ai-api/ 反代，模板见 deploy/nginx-production.conf）"
elif grep -q "location /ai-api/" "${NGINX_SITE}"; then
  HAS_HTTP11=$(grep -c "proxy_http_version 1.1" "${NGINX_SITE}")
  HAS_UPGRADE=$(grep -c "proxy_set_header Upgrade" "${NGINX_SITE}")
  HAS_CONN=$(grep -c 'proxy_set_header Connection "upgrade"' "${NGINX_SITE}")
  if [ "${HAS_HTTP11}" -gt 0 ] && [ "${HAS_UPGRADE}" -gt 0 ] && [ "${HAS_CONN}" -gt 0 ]; then
    echo "==> [AI底座] /ai-api/ 反代已完整（proxy_http_version 1.1 + Upgrade + Connection），跳过"
  else
    cp "${NGINX_SITE}" "${NGINX_SITE}.bak-ai-api"
    awk '
      /location \/ai-api\/ \{/ { in_ai=1 }
      in_ai && /^\s*\}/ {
        # 块结束前检查三项是否齐全，缺失则补齐（幂等）
        if (!seen_http11) print "        proxy_http_version 1.1;"
        if (!seen_upgrade) print "        proxy_set_header Upgrade $http_upgrade;"
        if (!seen_conn) print "        proxy_set_header Connection \"upgrade\";"
        in_ai=0
      }
      in_ai && /proxy_http_version 1.1/ { seen_http11=1 }
      in_ai && /proxy_set_header Upgrade/ { seen_upgrade=1 }
      in_ai && /proxy_set_header Connection/ { seen_conn=1 }
      { print }
    ' "${NGINX_SITE}" > "${NGINX_SITE}.ai-api.tmp"
    if nginx -t >/dev/null 2>&1; then
      mv "${NGINX_SITE}.ai-api.tmp" "${NGINX_SITE}"
      systemctl reload nginx >/dev/null 2>&1 || nginx -s reload >/dev/null 2>&1 || true
      echo "==> [AI底座] /ai-api/ 反代已补齐 WebSocket 三要素（proxy_http_version 1.1/Upgrade/Connection）并通过 nginx -t，已 reload（备份：${NGINX_SITE}.bak-ai-api）"
    else
      rm -f "${NGINX_SITE}.ai-api.tmp"
      echo "==> [AI底座] nginx -t 校验失败，已保留原配置（请手动检查 ${NGINX_SITE}）"
    fi
  fi
else
  cp "${NGINX_SITE}" "${NGINX_SITE}.bak-ai-api"
  awk '
    /location \/api\/ \{/ { in_api=1 }
    in_api && /^    \}$/ {
      print
      print "    # AI 底座（SSE 流式对话 + WebSocket 实时推送）：/ai-api/* → 服务器 3016（保留 /api 前缀）"
      print "    location /ai-api/ {"
      print "        proxy_pass http://127.0.0.1:3016/;"
      print "        proxy_http_version 1.1;"
      print "        proxy_set_header Host $host;"
      print "        proxy_set_header X-Real-IP $remote_addr;"
      print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
      print "        proxy_set_header X-Forwarded-Proto $scheme;"
      print "        proxy_set_header Upgrade $http_upgrade;"
      print "        proxy_set_header Connection \"upgrade\";"
      print "        proxy_buffering off;"
      print "        proxy_cache off;"
      print "        proxy_read_timeout 300s;"
      print "        proxy_send_timeout 300s;"
      print "    }"
      in_api=0
      next
    }
    { print }
  ' "${NGINX_SITE}" > "${NGINX_SITE}.ai-api.tmp"

  if nginx -t >/dev/null 2>&1; then
    mv "${NGINX_SITE}.ai-api.tmp" "${NGINX_SITE}"
    systemctl reload nginx >/dev/null 2>&1 || nginx -s reload >/dev/null 2>&1 || true
    echo "==> [AI底座] /ai-api/ 反代已写入并通过 nginx -t，已 reload（备份：${NGINX_SITE}.bak-ai-api）"
  else
    rm -f "${NGINX_SITE}.ai-api.tmp"
    echo "==> [AI底座] nginx -t 校验失败，已保留原配置（请手动检查 ${NGINX_SITE}）"
  fi
fi

# ---- 8. 配置项提示（RAG 预置知识 / LLM 端到端验收前置） ----
if [ -z "$(grep '^EMBEDDING_MODEL=' .env 2>/dev/null | cut -d= -f2-)" ]; then
  echo "==> [AI底座] 提示：EMBEDDING_MODEL 未配置，RAG 预置知识库不会加载（配置如 nomic-embed-text 后重启生效）"
fi
if [ -z "$(grep '^DEEPSEEK_API_KEY=' .env 2>/dev/null | cut -d= -f2-)" ]; then
  echo "==> [AI底座] 提示：DEEPSEEK_API_KEY 未配置，端到端验收 LLM 项需配置后执行 node scripts/ai-base-e2e.mjs"
fi

echo "==> [AI底座] 部署完成 $(date '+%Y-%m-%d %H:%M:%S')"
