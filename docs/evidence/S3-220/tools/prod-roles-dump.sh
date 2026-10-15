#!/bin/bash
# S3-220 · 生产角色权限只读导出（口径同 S3-214-B2 卡 §三：t_sys_role.permissions, tenant_id='default'）
# 只读：仅 SELECT。口令从生产 checkout 的 .env 读出，不回显。
set -u
cd /opt/zhixiang/liquor-inventory-system || exit 3
san=$(mktemp)
tr -d '\r' < .env > "$san"
set -a
. "$san"
set +a
rm -f "$san"

Q() {
  echo "--- $1 ---"
  mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -B -e "$2" 2>&1 | grep -v "Using a password"
}

Q "Q1 t_sys_role 全集（id | tenant | role_code | role_name | status | permissions）" \
  "SELECT id, tenant_id, role_code, role_name, status, permissions FROM t_sys_role ORDER BY tenant_id, id;"

Q "Q2 t_sys_menu 商品/采购相关码（menu_code | menu_name | menu_type）" \
  "SELECT menu_code, menu_name, menu_type FROM t_sys_menu WHERE menu_code LIKE 'goods%' OR menu_code LIKE 'purchase%' OR menu_code LIKE 'supplier%' OR menu_code LIKE 'price%' ORDER BY menu_code;"

Q "Q3 角色-菜单绑定里与 goods/price 相关的行（role_code | menu_code）" \
  "SELECT r.role_code, m.menu_code FROM t_sys_role_menu rm JOIN t_sys_role r ON r.id=rm.role_id JOIN t_sys_menu m ON m.id=rm.menu_id WHERE m.menu_code LIKE 'goods%' OR m.menu_code LIKE 'price%' ORDER BY r.role_code, m.menu_code;"

echo "=== END (read-only) ==="
