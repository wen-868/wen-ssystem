-- 智享营销系统 第 1 阶段开发种子数据
-- 默认账号：admin
-- 默认密码：admin123

USE liquor_inventory;

INSERT INTO sys_user (id, username, password_hash, real_name, mobile, store_id, status)
VALUES
  (1, 'admin', '$2b$10$BxsXQunnhzFxD4ixTsIMr.K8wkE7yk1601Cq66SxqvMlx5tuo60/2', '系统管理员', '13800000000', NULL, 1),
  (2, 'store_manager', '$2b$10$BxsXQunnhzFxD4ixTsIMr.K8wkE7yk1601Cq66SxqvMlx5tuo60/2', '默认店长', '13800000001', 1, 1),
  (3, 'store_operator', '$2b$10$BxsXQunnhzFxD4ixTsIMr.K8wkE7yk1601Cq66SxqvMlx5tuo60/2', '默认店员', '13800000002', 1, 1)
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  real_name = VALUES(real_name),
  mobile = VALUES(mobile),
  store_id = VALUES(store_id),
  status = VALUES(status);

INSERT INTO sys_user_role (user_id, role_id)
SELECT 1, id FROM sys_role WHERE role_code = 'SUPER_ADMIN'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO sys_user_role (user_id, role_id)
SELECT 2, id FROM sys_role WHERE role_code = 'STORE_MANAGER'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO sys_user_role (user_id, role_id)
SELECT 3, id FROM sys_role WHERE role_code = 'STORE_OPERATOR'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

INSERT INTO member (id, name, mobile, customer_type, staff_id, status)
VALUES
  (1, '零售客户', '13900000001', 'RETAIL', 1, 1),
  (2, '批发客户', '13900000002', 'WHOLESALE', 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  mobile = VALUES(mobile),
  customer_type = VALUES(customer_type),
  staff_id = VALUES(staff_id),
  status = VALUES(status);

INSERT INTO product_category (id, parent_id, name, sort_no, status)
VALUES
  (1, NULL, '白酒', 1, 1),
  (2, NULL, '啤酒', 2, 1),
  (3, NULL, '红酒', 3, 1)
ON DUPLICATE KEY UPDATE name = VALUES(name), sort_no = VALUES(sort_no), status = VALUES(status);

INSERT INTO product_spu (id, spu_code, name, category_id, main_image, sale_channels, status)
VALUES
  (1, 'SPU-DEMO-001', '示例白酒 53度 500ml', 1, NULL, JSON_ARRAY('MINIAPP', 'STORE'), 'ON_SALE')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status);

INSERT INTO product_sku (id, spu_id, sku_code, barcode, sku_name, box_ratio, temperature, trace_enabled, warning_threshold, status)
VALUES
  (1, 1, 'SKU-DEMO-001', '690000000001', '示例白酒 53度 500ml 常温', 6, 'NORMAL', 0, 10, 1)
ON DUPLICATE KEY UPDATE sku_name = VALUES(sku_name), warning_threshold = VALUES(warning_threshold), status = VALUES(status);

INSERT INTO product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price)
VALUES
  (1, 80.00, 129.00, 99.00, 119.00, 129.00)
ON DUPLICATE KEY UPDATE
  cost_price = VALUES(cost_price),
  retail_price = VALUES(retail_price),
  wholesale_price = VALUES(wholesale_price),
  miniapp_price = VALUES(miniapp_price),
  store_price = VALUES(store_price);

INSERT INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty)
VALUES
  (1, 1, 'ONLINE', 120, 0, 120),
  (1, 1, 'OFFLINE', 240, 0, 240)
ON DUPLICATE KEY UPDATE
  physical_qty = VALUES(physical_qty),
  locked_qty = VALUES(locked_qty),
  available_qty = VALUES(available_qty);
