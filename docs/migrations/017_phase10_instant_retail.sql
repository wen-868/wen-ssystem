-- 编号: 017, 描述: 即时零售相关表, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================
-- 第四阶段：即时零售模块 - 数据库表设计
-- 任务ID: P3-07
-- 创建时间: 2026-06-23
-- ============================================================

-- 1. 即时零售店铺配置表（retail_shop_config）
CREATE TABLE IF NOT EXISTS t_retail_shop_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  shop_name VARCHAR(128) NOT NULL COMMENT '店铺名称',
  shop_logo VARCHAR(255) COMMENT '店铺Logo',
  shop_description VARCHAR(500) COMMENT '店铺描述',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  business_hours VARCHAR(100) COMMENT '营业时间（如：09:00-22:00）',
  delivery_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用配送',
  pickup_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用自提',
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '最低起送金额',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '配送费',
  free_delivery_amount DECIMAL(10,2) COMMENT '免配送费金额',
  delivery_radius DECIMAL(10,2) COMMENT '配送半径（公里）',
  estimated_delivery_time VARCHAR(50) COMMENT '预计配送时间（如：30-45分钟）',
  announcement VARCHAR(500) COMMENT '店铺公告',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  tenant_id VARCHAR(32) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售店铺配置表';

-- 2. 即时零售分类表（retail_category）
CREATE TABLE IF NOT EXISTS t_retail_category (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  category_name VARCHAR(64) NOT NULL COMMENT '分类名称',
  category_icon VARCHAR(255) COMMENT '分类图标',
  parent_id BIGINT DEFAULT 0 COMMENT '父分类ID（0为一级分类）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  tenant_id VARCHAR(32) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_parent (parent_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售分类表';

-- 3. 即时零售轮播图表（retail_banner）
CREATE TABLE IF NOT EXISTS t_retail_banner (
  id INT AUTO_INCREMENT PRIMARY KEY,
  banner_title VARCHAR(128) NOT NULL COMMENT '轮播图标题',
  banner_image VARCHAR(255) NOT NULL COMMENT '轮播图URL',
  link_type VARCHAR(32) COMMENT '链接类型（PRODUCT/CATEGORY/URL）',
  link_value VARCHAR(255) COMMENT '链接值（商品ID/分类ID/URL）',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售轮播图表';

-- 4. 即时零售商品表（retail_product）
CREATE TABLE IF NOT EXISTS t_retail_product (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL COMMENT '关联商品ID（product_sku表）',
  category_id BIGINT COMMENT '分类ID',
  retail_price DECIMAL(10,2) NOT NULL COMMENT '零售价',
  original_price DECIMAL(10,2) COMMENT '原价',
  stock INT NOT NULL DEFAULT 0 COMMENT '库存',
  sales_count INT NOT NULL DEFAULT 0 COMMENT '销量',
  is_recommended TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否推荐',
  is_hot TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否热销',
  is_new TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否新品',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE/SOLD_OUT）',
  tenant_id VARCHAR(32) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_product_tenant (product_id, tenant_id),
  INDEX idx_category (category_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_recommended (is_recommended),
  INDEX idx_hot (is_hot),
  INDEX idx_new (is_new)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售商品表';

-- 5. 即时零售订单表（retail_order）
CREATE TABLE IF NOT EXISTS t_retail_order (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单编号',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  user_name VARCHAR(64) COMMENT '用户姓名',
  user_phone VARCHAR(20) COMMENT '用户电话',
  total_amount DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '优惠金额',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '配送费',
  pay_amount DECIMAL(10,2) NOT NULL COMMENT '实付金额',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送方式（DELIVERY/PICKUP）',
  delivery_address VARCHAR(255) COMMENT '配送地址',
  delivery_time DATETIME COMMENT '配送时间',
  receiver_name VARCHAR(64) COMMENT '收货人姓名',
  receiver_phone VARCHAR(20) COMMENT '收货人电话',
  receiver_latitude DECIMAL(10,6) COMMENT '收货人纬度',
  receiver_longitude DECIMAL(10,6) COMMENT '收货人经度',
  remark VARCHAR(500) COMMENT '订单备注',
  payment_status VARCHAR(16) NOT NULL DEFAULT 'UNPAID' COMMENT '支付状态（UNPAID/PAID/REFUNDED）',
  payment_method VARCHAR(32) COMMENT '支付方式（WECHAT/ALIPAY）',
  payment_time DATETIME COMMENT '支付时间',
  transaction_no VARCHAR(128) COMMENT '交易流水号',
  order_status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态（PENDING/CONFIRMED/PREPARING/DELIVERING/COMPLETED/CANCELLED）',
  cancel_reason VARCHAR(255) COMMENT '取消原因',
  cancelled_at DATETIME COMMENT '取消时间',
  completed_at DATETIME COMMENT '完成时间',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_order_no (order_no),
  INDEX idx_user (user_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_payment_status (payment_status),
  INDEX idx_order_status (order_status),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售订单表';

-- 6. 即时零售订单商品表（retail_order_item）
CREATE TABLE IF NOT EXISTS t_retail_order_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL COMMENT '订单ID',
  product_id BIGINT NOT NULL COMMENT '商品ID',
  sku_id BIGINT DEFAULT NULL COMMENT 'SKU ID',
  product_name VARCHAR(200) NOT NULL COMMENT '商品名称',
  product_image VARCHAR(500) COMMENT '商品图片',
  price DECIMAL(10,2) NOT NULL COMMENT '单价',
  quantity INT NOT NULL DEFAULT 1 COMMENT '数量',
  subtotal DECIMAL(10,2) NOT NULL COMMENT '小计',
  tenant_id VARCHAR(32) NOT NULL COMMENT '租户ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_order_id (order_id),
  INDEX idx_product_id (product_id),
  INDEX idx_tenant_id (tenant_id),
  CONSTRAINT fk_retail_order_item_order FOREIGN KEY (order_id) REFERENCES retail_order(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='零售订单明细表';

-- 审计留痕（S3-199 · 收口总清单第 66 项）：本表 order_id → t_retail_order.id 的外键带 ON DELETE CASCADE。
--   当前零售订单**无物理删除路径**（全仓检索 DELETE FROM t_retail_order 命中 0 处；订单作废走软删：
--   t_retail_order.order_status = 'CANCELLED' 配 cancel_reason / cancelled_at），故该级联今日不会触发。
--   若将来引入零售订单物理删除：**必须先把本外键改为 ON DELETE RESTRICT（或整体改软删）**，
--   否则删订单会静默删除订单明细，审计链断裂。

-- 7. 配送配置表（delivery_config）
CREATE TABLE IF NOT EXISTS t_delivery_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_name VARCHAR(64) NOT NULL COMMENT '配置名称',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送类型（SELF/PLATFORM/THIRD_PARTY）',
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '配送费',
  free_delivery_amount DECIMAL(10,2) COMMENT '免配送费金额',
  delivery_radius INT COMMENT '配送半径（公里）',
  estimated_time VARCHAR(50) COMMENT '预计配送时间',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '状态（ACTIVE/INACTIVE）',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送配置表';

-- 8. 配送记录表（delivery_record）
CREATE TABLE IF NOT EXISTS t_delivery_record (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL COMMENT '订单ID',
  delivery_no VARCHAR(32) COMMENT '配送单号',
  delivery_type VARCHAR(16) NOT NULL COMMENT '配送类型',
  rider_name VARCHAR(64) COMMENT '骑手姓名',
  rider_phone VARCHAR(20) COMMENT '骑手电话',
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '状态（PENDING/ASSIGNED/PICKED_UP/DELIVERING/COMPLETED）',
  picked_up_at DATETIME COMMENT '取货时间',
  delivered_at DATETIME COMMENT '送达时间',
  delivery_latitude DECIMAL(10,6) COMMENT '骑手纬度',
  delivery_longitude DECIMAL(10,6) COMMENT '骑手经度',
  remark VARCHAR(500) COMMENT '备注',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_order (order_id),
  INDEX idx_delivery_no (delivery_no),
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES retail_order(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='配送记录表';

-- 审计留痕（S3-199 · 收口总清单第 66 项）：本表是**配送审计记录**，其 order_id → t_retail_order.id
--   的外键带 ON DELETE CASCADE，风险同上表：当前无物理删除路径故不触发。
--   若将来引入零售订单物理删除：**必须先把本外键改为 ON DELETE RESTRICT（或整体改软删）**，
--   否则删订单会静默删除配送审计记录（`docs/tasks/cards/R101-S3-194-凌舟裁定与验收.md` §二.④ 已登记该风险）。

-- 9. 即时零售操作日志表（retail_operation_log）
CREATE TABLE IF NOT EXISTS t_retail_operation_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  module VARCHAR(32) NOT NULL COMMENT '模块（shop/category/product/order/delivery）',
  action VARCHAR(32) NOT NULL COMMENT '操作类型',
  target_id VARCHAR(64) NOT NULL COMMENT '目标ID',
  target_type VARCHAR(32) NOT NULL COMMENT '目标类型',
  user_id INT COMMENT '操作人ID',
  user_name VARCHAR(64) COMMENT '操作人姓名',
  detail VARCHAR(500) COMMENT '操作详情',
  tenant_id VARCHAR(36) NOT NULL COMMENT '租户ID',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_module (module),
  INDEX idx_target (target_id, target_type),
  INDEX idx_tenant (tenant_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='即时零售操作日志表';
