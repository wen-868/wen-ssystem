#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"
NGINX_SITE="/etc/nginx/sites-available/zhixiang.conf"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "找不到 .env，请先 cp deploy/.env.example .env 并填写 DOMAIN、ADMIN_EMAIL。"
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${DOMAIN:?缺少 DOMAIN，例如 example.com}"
: "${ADMIN_EMAIL:?缺少 ADMIN_EMAIL}"

API_DOMAIN="api.${DOMAIN}"
ADMIN_DOMAIN="admin.${DOMAIN}"
STORE_DOMAIN="store.${DOMAIN}"

echo "安装 nginx 和 certbot"
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx

echo "创建 ACME 目录"
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot

echo "写入临时 HTTP 配置"
sudo tee "${NGINX_SITE}" >/dev/null <<CONF
server {
  listen 80;
  server_name ${API_DOMAIN} ${ADMIN_DOMAIN} ${STORE_DOMAIN};

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 200 'certbot-ready';
    add_header Content-Type text/plain;
  }
}
CONF

sudo ln -sf "${NGINX_SITE}" /etc/nginx/sites-enabled/zhixiang.conf
sudo nginx -t
sudo systemctl reload nginx

echo "申请 HTTPS 证书"
sudo certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${ADMIN_EMAIL}" \
  -d "${API_DOMAIN}" \
  -d "${ADMIN_DOMAIN}" \
  -d "${STORE_DOMAIN}"

echo "写入正式 Nginx 配置"
TMP_CONF="$(mktemp)"
sed \
  -e "s/YOUR_DOMAIN/${DOMAIN}/g" \
  -e "s#/opt/zhixiang/liquor-inventory-system#${PROJECT_DIR}#g" \
  "${SCRIPT_DIR}/04-nginx.conf" > "${TMP_CONF}"
sudo cp "${TMP_CONF}" "${NGINX_SITE}"
rm -f "${TMP_CONF}"

sudo nginx -t
sudo systemctl reload nginx

echo "测试证书续期"
sudo certbot renew --dry-run

echo "HTTPS 部署完成"
echo "API:   https://${API_DOMAIN}"
echo "后台:  https://${ADMIN_DOMAIN}"
echo "门店:  https://${STORE_DOMAIN}"
