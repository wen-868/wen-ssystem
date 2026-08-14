#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# 服务器健康巡检 + 告警脚本（验收项：监控告警 / 可用性）
# 用法：
#   bash deploy/health-monitor.sh            # 单次巡检（配合 cron 每 5 分钟）
#   bash deploy/health-monitor.sh --once     # 同单次巡检
# 配置（backend/.env）：
#   FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
# 建议 cron：*/5 * * * * root bash /opt/zhixiang/liquor-inventory-system/deploy/health-monitor.sh >> /var/log/health-monitor.log 2>&1
# ============================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/backend/.env"
STATE_FILE="/tmp/zhixiang-health-down"

if [[ -f "${ENV_FILE}" ]]; then
  set -a; source "${ENV_FILE}"; set +a
fi

API_BASE="${HEALTH_API_BASE:-http://127.0.0.1:8080}"
FEISHU_WEBHOOK="${FEISHU_WEBHOOK_URL:-}"

check() {
  local name="$1" url="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "${url}" 2>/dev/null || echo "000")
  if [[ "${code}" == "200" ]]; then
    echo "[$(date '+%F %T')] OK ${name} (${code})"
    return 0
  fi
  echo "[$(date '+%F %T')] FAIL ${name} (${code})"
  return 1
}

alert() {
  local msg="$1"
  echo "[$(date '+%F %T')] ALERT ${msg}"
  if [[ -n "${FEISHU_WEBHOOK}" ]]; then
    curl -s -X POST "${FEISHU_WEBHOOK}" \
      -H 'Content-Type: application/json' \
      -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"[智享全链告警] ${msg}\"}}" \
      --max-time 8 >/dev/null 2>&1 || echo "[$(date '+%F %T')] 飞书告警发送失败"
  fi
}

FAILED=0
check "后端健康" "${API_BASE}/health" || FAILED=1
check "API健康" "${API_BASE}/api/health" || FAILED=$((FAILED + 1))

if [[ "${FAILED}" -gt 0 ]]; then
  # 连续失败才告警（避免单次抖动误报）：首次失败写入状态文件，累计 2 次以上再发
  COUNT=0
  [[ -f "${STATE_FILE}" ]] && COUNT=$(cat "${STATE_FILE}" 2>/dev/null || echo 0)
  COUNT=$((COUNT + 1))
  echo "${COUNT}" > "${STATE_FILE}"
  if [[ "${COUNT}" -ge 2 ]]; then
    alert "后端服务异常：${FAILED} 项检查失败（连续 ${COUNT} 次），请查看 pm2 logs zhixiang-api"
  fi
  exit 1
else
  rm -f "${STATE_FILE}"
  exit 0
fi
