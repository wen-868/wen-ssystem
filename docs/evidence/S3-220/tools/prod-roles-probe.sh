#!/bin/bash
# S3-220 · 生产只读通道探测（不连通即如实回报，不用仓库种子冒充生产真值）
# 只做三件事：定位生产 checkout、确认 mysql 客户端、打印库名/表的存在性（不查任何业务数据）
set -u

echo "=== host ==="
hostname
echo "=== candidate checkouts ==="
for d in /opt/zhixiang/liquor-inventory-system /opt/zhixiang/* ; do
  if [ -f "$d/.env" ]; then echo "HAS_ENV  $d"; fi
done
echo "=== mysql client ==="
command -v mysql || echo "NO_MYSQL_CLIENT"
echo "=== probe: connect + db name + role table presence (read-only) ==="
cd /opt/zhixiang/liquor-inventory-system || exit 3
san=$(mktemp)
tr -d '\r' < .env > "$san"
set -a
. "$san"
set +a
rm -f "$san"
echo "DB_HOST_SET=$([ -n "${DB_HOST:-}" ] && echo yes || echo no)  DB_NAME=${DB_NAME:-<unset>}  DB_PORT=${DB_PORT:-<unset>}  DB_USER=${DB_USER:-<unset>}"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B \
  -e "SELECT 'roles_total', COUNT(*) FROM t_sys_role UNION ALL SELECT 'roles_default_tenant', COUNT(*) FROM t_sys_role WHERE tenant_id='default';" \
  2>&1 | grep -v "Using a password"
