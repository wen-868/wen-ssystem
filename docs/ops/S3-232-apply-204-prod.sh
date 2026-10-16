#!/bin/bash
# 生产执行迁移 204（系统设置域权限点立码 + D1 给 STORE_MANAGER 补 goods:create|edit）
# 背景：`deploy/auto-deploy.sh` 的迁移步骤是**硬编码 3 条**（126/127/196）⇒ 新迁移不会随部署执行
#       （已登记为收口总清单第 74 项）。本脚本走项目官方通道 `scripts/run-migration.mjs`（幂等、可从库内复核）。
# 用法（在服务器上）：bash /tmp/S3-232-apply-204.sh
set -u
PROJ=/opt/zhixiang/liquor-inventory-system
cd "$PROJ/backend" || { echo "找不到 $PROJ/backend"; exit 1; }
echo "==> 目标文件（glob 避免中文名在跨机传输中被转义）："
ls -l ../docs/migrations/204_*.sql || exit 1
for f in ../docs/migrations/204_*.sql; do
  echo "==> run $f"
  node ../scripts/run-migration.mjs "$f"
  code=$?
  echo "exit=$code"
  [ "$code" -eq 0 ] || exit "$code"
done
echo "==> 204 执行完毕（复核见 docs/evidence/_shared/prod-check-204-20261016.sql 的只读查询）"
