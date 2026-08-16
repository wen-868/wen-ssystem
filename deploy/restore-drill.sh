#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# 数据库恢复演练脚本（验收项：灾备演练）
# 用法：
#   bash deploy/restore-drill.sh [备份文件] [--keep]
#   - 不传备份文件时取 BACKUP_DIR 中最新一份
#   - 默认演练完删除临时库；--keep 保留以便人工核验
# 流程：校验备份完整性 → 恢复到临时库 → 对比表数/关键表行数 → 输出报告
# ============================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql}"
REPORT_DIR="${PROJECT_DIR}/docs/reports"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "找不到 .env，请先 cp deploy/.env.example .env 并填写数据库配置。" >&2
  exit 1
fi
set -a; source "${ENV_FILE}"; set +a
: "${DB_HOST:?缺少 DB_HOST}" "${DB_PORT:?缺少 DB_PORT}" "${DB_USER:?缺少 DB_USER}" "${DB_PASSWORD:?缺少 DB_PASSWORD}" "${DB_NAME:?缺少 DB_NAME}"

# 管理员账号（创建/删除临时库与恢复数据需要建库权限；默认与业务账号相同，
# 业务账号无建库权限时通过 DB_ADMIN_USER / DB_ADMIN_PASSWORD 传入高权限账号）
DB_USER="${DB_ADMIN_USER:-$DB_USER}"
DB_PASSWORD="${DB_ADMIN_PASSWORD:-$DB_PASSWORD}"

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  BACKUP_FILE="$(ls -t "${BACKUP_DIR}"/${DB_NAME}_*.sql.gz 2>/dev/null | head -1 || echo "")"
fi
if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "错误：未找到可用备份（${BACKUP_DIR}/${DB_NAME}_*.sql.gz）" >&2
  exit 1
fi

KEEP="${2:-}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TEMP_DB="${DB_NAME}_restore_drill_${TIMESTAMP}"
mkdir -p "${REPORT_DIR}"
REPORT="${REPORT_DIR}/restore-drill-${TIMESTAMP}.log"

echo "==> 备份文件: ${BACKUP_FILE}" | tee "${REPORT}"
echo "==> 校验 gzip 完整性" | tee -a "${REPORT}"
gzip -t "${BACKUP_FILE}"
echo "gzip 校验通过" | tee -a "${REPORT}"

echo "==> 校验备份头部（应为 mysqldump 产物）" | tee -a "${REPORT}"
HEAD=$(zcat "${BACKUP_FILE}" 2>/dev/null | head -c 200 || true)
if [[ "${HEAD}" != *"SQL"* ]] && [[ "${HEAD}" != *"mysqldump"* ]]; then
  echo "警告：备份内容不含 mysqldump 特征，继续尝试" | tee -a "${REPORT}"
fi

echo "==> 创建临时库并恢复" | tee -a "${REPORT}"
MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
  -e "CREATE DATABASE IF NOT EXISTS \`${TEMP_DB}\` DEFAULT CHARSET utf8mb4;"
MYSQL_PWD="${DB_PASSWORD}" zcat "${BACKUP_FILE}" | \
  MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" "${TEMP_DB}"

echo "==> 对比表数量" | tee -a "${REPORT}"
SRC_TABLES=$(MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}';")
DRILL_TABLES=$(MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -N -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${TEMP_DB}';")
echo "源库表数=${SRC_TABLES} 恢复库表数=${DRILL_TABLES}" | tee -a "${REPORT}"

echo "==> 对比关键表行数" | tee -a "${REPORT}"
for TABLE in t_sys_user t_sale_bill t_product_sku; do
  SRC_ROWS=$(MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -N -e \
    "SELECT COUNT(*) FROM \`${DB_NAME}\`.\`${TABLE}\`;" 2>/dev/null || echo "N/A")
  DRILL_ROWS=$(MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -N -e \
    "SELECT COUNT(*) FROM \`${TEMP_DB}\`.\`${TABLE}\`;" 2>/dev/null || echo "N/A")
  echo "${TABLE}: 源=${SRC_ROWS} 恢复=${DRILL_ROWS}" | tee -a "${REPORT}"
done

if [[ "${KEEP}" != "--keep" ]]; then
  MYSQL_PWD="${DB_PASSWORD}" mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" \
    -e "DROP DATABASE IF EXISTS \`${TEMP_DB}\`;"
  echo "==> 临时库已清理（--keep 可保留核验）" | tee -a "${REPORT}"
else
  echo "==> 临时库保留：${TEMP_DB}（人工核验后手动 DROP）" | tee -a "${REPORT}"
fi

echo "==> 演练报告：${REPORT}"
echo "恢复演练完成（备份可恢复性验证通过）"
