#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-onepan.cn}"
ADMIN_EMAIL="${ADMIN_EMAIL:-xbe868@126.com}"
APP_ROOT="${APP_ROOT:-/opt/zhixiang}"
PROJECT_DIR="${PROJECT_DIR:-${APP_ROOT}/liquor-inventory-system}"

echo "==> 智享系统本地压缩包部署"
echo "域名：${DOMAIN}"
echo "邮箱：${ADMIN_EMAIL}"
echo "目录：${PROJECT_DIR}"

echo "==> 安装系统依赖"
sudo apt-get update
sudo apt-get install -y ca-certificates curl git unzip zip mysql-server nginx certbot python3-certbot-nginx

cd "${PROJECT_DIR}"

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | sed 's/^v//' | cut -d. -f1)" -lt 20 ]]; then
  echo "==> 安装 Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> 安装 npm 依赖"
npm install

DB_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"
JWT_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
MYSQL_ROOT_PASSWORD="$(openssl rand -base64 24 | tr -d '\n')"

echo "==> 初始化并同步 MySQL 应用账号"
TMP_SQL="$(mktemp)"
sed "s/CHANGE_ME_TO_STRONG_PASSWORD/${DB_PASSWORD//\//\\/}/g" deploy/01-create-app-user.sql > "${TMP_SQL}"
sudo mysql < "${TMP_SQL}"
rm -f "${TMP_SQL}"

sudo mysql <<SQL
ALTER USER 'zhixiang_app'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'zhixiang_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
ALTER USER 'zhixiang_app'@'%' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES
  ON liquor_inventory.* TO 'zhixiang_app'@'127.0.0.1';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES
  ON liquor_inventory.* TO 'zhixiang_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES
  ON liquor_inventory.* TO 'zhixiang_app'@'%';
FLUSH PRIVILEGES;
SQL

echo "==> 写入生产 .env"
cat > .env <<ENV
USE_MOCK_DB=false
PORT=8080
JWT_SECRET=${JWT_SECRET}
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=zhixiang_app
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=liquor_inventory
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
DOMAIN=${DOMAIN}
ADMIN_EMAIL=${ADMIN_EMAIL}
VITE_API_BASE=https://api.${DOMAIN}/api
WECHAT_APP_ID=
WECHAT_MCH_ID=
WECHAT_PAY_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_API_V3_KEY=
ENV
chmod 600 .env

echo "==> 部署应用"
SKIP_GIT_PULL=true bash deploy/03-deploy.sh

echo "==> 配置 HTTPS"
bash deploy/05-setup-https.sh

echo "==> 测试数据库备份"
sudo bash deploy/02-mysql-backup.sh

echo "==> 写入每日备份任务"
CRON_LINE="0 2 * * * ${PROJECT_DIR}/deploy/02-mysql-backup.sh >> /var/log/zhixiang-mysql-backup.log 2>&1"
(sudo crontab -l 2>/dev/null | grep -v "zhixiang-mysql-backup"; echo "${CRON_LINE}") | sudo crontab -

echo "==> 最终健康检查"
curl -fsS "http://127.0.0.1:8080/health"
curl -fsSI "https://api.${DOMAIN}/health" | head -n 1
curl -fsSI "https://admin.${DOMAIN}" | head -n 1
curl -fsSI "https://store.${DOMAIN}" | head -n 1

echo
echo "部署完成"
echo "API:   https://api.${DOMAIN}"
echo "后台:  https://admin.${DOMAIN}"
echo "门店:  https://store.${DOMAIN}"
echo "日志:  ${PROJECT_DIR}/logs/backend.log"
