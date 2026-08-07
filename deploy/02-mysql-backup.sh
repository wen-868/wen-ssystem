#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
# 保留最近 N 天备份，更早的自动清理（R95-04：7→14 天，配合每日 3 次备份覆盖事故恢复窗口）
RETENTION_DAYS="${RETENTION_DAYS:-14}"
# 异地备份（可选，默认关闭）：设置 RSYNC_REMOTE 后启用 rsync 推送，如
#   RSYNC_REMOTE="backup@10.0.0.8:/var/backups/mysql"
#   RSYNC_SSH_KEY="/root/.ssh/id_ed25519"   # 指定私钥（可选）
# 留空表示仅本机备份，不执行异地推送。
RSYNC_REMOTE="${RSYNC_REMOTE:-}"
RSYNC_SSH_KEY="${RSYNC_SSH_KEY:-}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "找不到 ${ENV_FILE}，请先 cp deploy/.env.example .env 并填写数据库配置。"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${DB_HOST:?缺少 DB_HOST}"
: "${DB_PORT:?缺少 DB_PORT}"
: "${DB_USER:?缺少 DB_USER}"
: "${DB_PASSWORD:?缺少 DB_PASSWORD}"
: "${DB_NAME:?缺少 DB_NAME}"

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TARGET="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "开始备份 ${DB_NAME} -> ${TARGET}"
MYSQL_PWD="${DB_PASSWORD}" mysqldump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --user="${DB_USER}" \
  --single-transaction \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "${DB_NAME}" | gzip > "${TARGET}"

chmod 600 "${TARGET}"

# 清理超过保留天数的旧备份（文件名含时分，按 mtime 判断，避免同一天覆盖）
find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

# 可选：异地 rsync 推送（默认关闭，需在 .env 或环境变量配置 RSYNC_REMOTE）
if [[ -n "${RSYNC_REMOTE}" ]]; then
  echo "开始异地备份同步 -> ${RSYNC_REMOTE}"
  if [[ -n "${RSYNC_SSH_KEY}" ]]; then
    RSYNC_SSH_ARGS="-e ssh -i ${RSYNC_SSH_KEY}"
  else
    RSYNC_SSH_ARGS="-e ssh"
  fi
  rsync -avz --timeout=60 ${RSYNC_SSH_ARGS} "${TARGET}" "${RSYNC_REMOTE}"
  echo "异地备份完成：${RSYNC_REMOTE}"
else
  echo "未配置 RSYNC_REMOTE，跳过异地备份（仅本机备份）"
fi

echo "备份完成：${TARGET}"
echo "当前备份："
ls -lh "${BACKUP_DIR}"/"${DB_NAME}"_*.sql.gz 2>/dev/null || true
