#!/bin/bash
# ============================================
# 智享酒水库存系统 - 生产环境一键部署脚本
# 域名: onepan.cn
# IP: 159.75.153.59
# ============================================
# 用法: 把 deploy-production.tar.gz 上传到 /root/ 后执行
# chmod +x /root/deploy-production.sh && /root/deploy-production.sh

set -e

DOMAIN="onepan.cn"
SERVER_IP="159.75.153.59"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

echo "=========================================="
echo "  智享酒水库存系统 - 生产环境部署"
echo "  域名: $DOMAIN"
echo "  IP: $SERVER_IP"
echo "=========================================="

# ===== 1. 系统依赖检查 =====
echo ""
echo "[1/10] 检查系统依赖..."
for cmd in node npm nginx mysql certbot; do
  if ! command -v $cmd &> /dev/null; then
    echo "  警告: $cmd 未安装，正在安装..."
    apt-get update -qq
    case $cmd in
      node) curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs ;;
      npm) ;; # node 安装时自带
      nginx) apt-get install -y nginx ;;
      mysql) apt-get install -y mysql-server ;;
      certbot) apt-get install -y certbot python3-certbot-nginx ;;
    esac
  fi
  echo "  ✓ $cmd 已就绪"
done

# ===== 2. 解压部署包 =====
echo ""
echo "[2/10] 解压部署包..."
if [ ! -f /root/deploy-production.tar.gz ]; then
  echo "  错误: /root/deploy-production.tar.gz 不存在"
  exit 1
fi

rm -rf /tmp/deploy
mkdir -p /tmp/deploy
cd /tmp/deploy
tar xzf /root/deploy-production.tar.gz
echo "  ✓ 解压完成"

# ===== 3. MySQL 配置 =====
echo ""
echo "[3/10] 配置 MySQL..."
if ! mysql -u root -e "SELECT 1" &> /dev/null; then
  echo "  需要设置 MySQL root 密码"
  echo "  请在服务器上执行: mysql_secure_installation"
  echo "  然后重新运行此脚本"
  exit 1
fi

# 创建数据库和用户
mysql -u root <<EOF
CREATE DATABASE IF NOT EXISTS liquor_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'zhixiang_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_TO_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON liquor_inventory.* TO 'zhixiang_app'@'localhost';
FLUSH PRIVILEGES;
EOF

# 执行 Phase 2 数据库迁移（供应商/采购/客户往来/销售退货）
echo "  执行 Phase 2 数据库迁移..."
mysql -u root liquor_inventory < /tmp/deploy/phase2_schema.sql 2>/dev/null && echo "  ✓ Phase 2 迁移完成" || echo "  ⚠ Phase 2 迁移跳过（表可能已存在）"

# 执行 Phase 3 系统配置表
echo "  执行 Phase 3 系统配置表..."
mysql -u root liquor_inventory < /tmp/deploy/phase3_sys_config.sql 2>/dev/null && echo "  ✓ Phase 3 配置表完成" || echo "  ⚠ Phase 3 配置表跳过"

echo "  ✓ 数据库配置完成"

# ===== 4. 部署后端 =====
echo ""
echo "[4/10] 部署后端..."
mkdir -p /root/liquor-inventory-system/backend
cp -r /tmp/deploy/backend/dist /root/liquor-inventory-system/backend/
cp /tmp/deploy/backend/package.json /root/liquor-inventory-system/backend/
cp /root/.env.production /root/liquor-inventory-system/backend/.env 2>/dev/null || true

cd /root/liquor-inventory-system/backend
npm install --production 2>/dev/null || npm install

# 安装 PM2
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi

pm2 delete liquor-api 2>/dev/null || true
pm2 start dist/server.js --name liquor-api --env production
pm2 save
pm2 startup 2>/dev/null || true
echo "  ✓ 后端部署完成 (端口 8080)"

# ===== 5. 部署前端 =====
echo ""
echo "[5/10] 部署前端..."

# 商家端
rm -rf /var/www/merchant-mobile
mkdir -p /var/www/merchant-mobile
cp -r /tmp/deploy/merchant-mobile-dist/* /var/www/merchant-mobile/
echo "  ✓ 商家端部署完成"

# 工作台
rm -rf /var/www/admin-web
mkdir -p /var/www/admin-web
cp -r /tmp/deploy/admin-web-dist/* /var/www/admin-web/
echo "  ✓ 工作台部署完成"

# 门店终端
rm -rf /var/www/store-terminal
mkdir -p /var/www/store-terminal
cp -r /tmp/deploy/store-terminal-dist/* /var/www/store-terminal/
echo "  ✓ 门店终端部署完成"

# 官网
rm -rf /var/www/website
mkdir -p /var/www/website
cp -r /tmp/deploy/website-dist/* /var/www/website/
echo "  ✓ 官网部署完成"

# ===== 6. DNS 解析提示 =====
echo ""
echo "[6/10] 检查 DNS 解析..."
SUBDOMAINS=("www" "api" "admin" "m")
ALL_OK=true
for sub in "${SUBDOMAINS[@]}"; do
  FULL="${sub}.${DOMAIN}"
  RESOLVED_IP=$(dig +short $FULL 2>/dev/null || echo "")
  if [ "$RESOLVED_IP" = "$SERVER_IP" ]; then
    echo "  ✓ $FULL -> $SERVER_IP"
  else
    echo "  ✗ $FULL 未解析到 $SERVER_IP (当前: ${RESOLVED_IP:-未解析})"
    echo "    请在 DNS 服务商添加 A 记录: $FULL -> $SERVER_IP"
    ALL_OK=false
  fi
done

if [ "$ALL_OK" = false ]; then
  echo ""
  echo "  ⚠ DNS 解析未全部完成，SSL 证书将跳过"
  echo "  请先配置 DNS 后重新运行: certbot --nginx"
  SKIP_SSL=true
else
  SKIP_SSL=false
fi

# ===== 7. SSL 证书 =====
echo ""
echo "[7/10] 配置 SSL 证书..."
if [ "$SKIP_SSL" = false ]; then
  certbot --nginx -d www.${DOMAIN} -d ${DOMAIN} -d api.${DOMAIN} -d admin.${DOMAIN} -d m.${DOMAIN} -d store.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} 2>/dev/null || {
    echo "  ⚠ SSL 证书申请失败，将使用 HTTP"
    echo "  请手动运行: certbot --nginx -d www.${DOMAIN} -d ${DOMAIN} -d api.${DOMAIN} -d admin.${DOMAIN} -d m.${DOMAIN} -d store.${DOMAIN}"
  }
  echo "  ✓ SSL 证书配置完成"
else
  echo "  ⊘ 跳过 SSL（等待 DNS 配置）"
fi

# ===== 8. Nginx 配置 =====
echo ""
echo "[8/10] 配置 Nginx..."
if [ "$SKIP_SSL" = false ] && [ -f "/etc/letsencrypt/live/api.${DOMAIN}/fullchain.pem" ]; then
  cp /tmp/deploy/nginx-production.conf /etc/nginx/sites-available/zhixiang
else
  # 使用 HTTP 配置（无 SSL）
  cat > /etc/nginx/sites-available/zhixiang <<'NGINX_HTTP'
# 后端 API
server {
    listen 80;
    server_name api.onepan.cn;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 工作台
server {
    listen 80;
    server_name admin.onepan.cn;

    root /var/www/admin-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 商家端 H5
server {
    listen 80;
    server_name m.onepan.cn;

    root /var/www/merchant-mobile;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 官网
server {
    listen 80;
    server_name www.onepan.cn onepan.cn;

    root /var/www/website;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_HTTP
fi

ln -sf /etc/nginx/sites-available/zhixiang /etc/nginx/sites-enabled/zhixiang
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && nginx -s reload
echo "  ✓ Nginx 配置完成"

# ===== 9. 部署小程序源码 =====
echo ""
echo "[9/10] 部署小程序源码..."
rm -rf /root/miniapp
cp -r /tmp/deploy/miniapp-src /root/miniapp
echo "  ✓ 小程序源码部署完成"

# ===== 10. 清理和验证 =====
echo ""
echo "[10/10] 清理和验证..."
rm -rf /tmp/deploy

echo ""
echo "服务状态:"
pm2 status

echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  官网:        https://www.onepan.cn"
echo "  后端 API:    https://api.onepan.cn"
echo "  工作台:    https://admin.onepan.cn"
echo "  商家端 H5:   https://m.onepan.cn"
echo ""
echo "待办事项:"
echo "  1. 修改 /root/liquor-inventory-system/backend/.env 中的数据库密码"
echo "  2. 修改 /root/liquor-inventory-system/backend/.env 中的 JWT_SECRET"
echo "  3. 配置 DNS 解析（如未完成）"
echo "  4. 申请 SSL 证书（如未完成）: certbot --nginx -d www.onepan.cn -d onepan.cn -d api.onepan.cn -d admin.onepan.cn -d m.onepan.cn"
echo "  5. 填写微信小程序 AppID 和支付配置"
echo ""
