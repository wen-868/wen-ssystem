#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

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

find "${BACKUP_DIR}" -type f -name "${DB_NAME}_*.sql.gz" -mtime +"${RETENTION_DAYS}" -delete

echo "备份完成：${TARGET}"
echo "当前备份："
ls -lh "${BACKUP_DIR}"/"${DB_NAME}"_*.sql.gz 2>/dev/null || true
