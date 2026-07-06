-- 编号: 099, 描述: 开发环境种子数据, 创建人: 阿坚, 日期: 2026-07-06

-- ============================================================================
-- 智享酒业进销存系统 - 开发环境种子数据脚本
-- 项目名称：智享酒业进销存系统 (Liquor Inventory System)
-- 版本：v2.0.0
-- 创建日期：2026-06-20
-- 说明：开发/测试环境用的初始化数据，包含默认账号、门店、商品、配置等
--       所有 INSERT 均使用 INSERT IGNORE 避免重复插入
-- 适用数据库：MySQL 5.7+ / MySQL 8.x
-- ============================================================================

USE liquor_inventory;

SET NAMES utf8mb4;

-- ============================================================================
-- 1. 系统管理员账号
-- 密码统一使用 bcrypt 哈希（$2a$10$ 开头）
-- 默认密码：123456 -> bcrypt hash
-- ============================================================================

INSERT IGNORE INTO sys_user (id, username, password_hash, real_name, mobile, store_id, status) VALUES
(1, 'admin', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '系统管理员', '13800000000', NULL, 1),
(2, 'store_manager', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '默认店长', '13800000001', 1, 1),
(3, 'operator01', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '门店操作员A', '13800000002', 1, 1),
(4, 'operator02', '$2a$10$N.zmdr9k7uOCQb376NoUnuTJ8iAt6Z5EHsM8lE9lBOsl7iAt6Z5EH', '门店操作员B', '13800000003', 2, 1);

-- ============================================================================
-- 2. RBAC 角色
-- ============================================================================

INSERT IGNORE INTO sys_role (id, role_code, role_name, description, data_scope, permissions, status) VALUES
(1, 'SUPER_ADMIN', '超级管理员', '拥有系统所有权限', 'ALL', '["*"]', 'ACTIVE'),
(2, 'OPERATION_ADMIN', '运营管理员', '运营管理权限，可管理商品、订单、客户、供应商、采购、库存、财务等', 'ALL', '["product:read","product:write","order:read","order:write","customer:read","customer:write","supplier:read","supplier:write","purchase:read","purchase:write","inventory:read","inventory:write","finance:read","finance:write","marketing:read","marketing:write","report:read","system:read"]', 'ACTIVE'),
(3, 'STORE_ADMIN', '门店管理员', '门店管理权限，可查看商品、管理订单和库存', 'STORE', '["product:read","order:read","order:write","inventory:read","inventory:write","customer:read"]', 'ACTIVE'),
(4, 'SALESMAN', '业务员', '销售相关权限，可查看商品、管理订单和客户', 'SELF', '["product:read","order:read","order:write","customer:read","customer:write"]', 'ACTIVE');

-- ============================================================================
-- 3. 用户-角色绑定
-- ============================================================================

INSERT IGNORE INTO sys_user_role (user_id, role_id) VALUES
(1, 1),  -- admin -> 超级管理员
(2, 3),  -- store_manager -> 门店管理员
(3, 4),  -- operator01 -> 业务员
(4, 4);  -- operator02 -> 业务员

-- ============================================================================
-- 4. 默认门店数据（2个门店）
-- ============================================================================

INSERT IGNORE INTO store (id, store_code, name, address, lng, lat, contact, phone, delivery_radius, business_status, status) VALUES
(1, 'STORE0001', '智享酒业旗舰店', '北京市朝阳区建国路88号智享大厦1楼', 116.473669, 39.908678, '张经理', '010-88880001', 5.00, 'OPEN', 'OPEN'),
(2, 'STORE0002', '智享酒业仓储店', '北京市大兴区亦庄经济开发区科创大道66号', 116.506253, 39.782781, '李经理', '010-88880002', 10.00, 'OPEN', 'OPEN');

-- ============================================================================
-- 5. 默认商品分类（白酒/啤酒/葡萄酒/洋酒/其他）
-- ============================================================================

INSERT IGNORE INTO product_category (id, parent_id, name, sort_no, status) VALUES
(1, NULL, '白酒', 1, 1),
(2, NULL, '啤酒', 2, 1),
(3, NULL, '葡萄酒', 3, 1),
(4, NULL, '洋酒', 4, 1),
(5, NULL, '其他', 5, 1);

-- ============================================================================
-- 6. 示例 SPU 数据（每个分类至少2个，共10个）
-- ============================================================================

INSERT IGNORE INTO product_spu (id, spu_code, name, category_id, main_image, sale_channels, status) VALUES
-- 白酒
(1, 'SPU-BJ-001', '茅台飞天 53度 500ml', 1, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
(2, 'SPU-BJ-002', '五粮液普五 52度 500ml', 1, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
-- 啤酒
(3, 'SPU-PJ-001', '青岛啤酒经典 500ml', 2, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
(4, 'SPU-PJ-002', '百威啤酒 500ml', 2, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
-- 葡萄酒
(5, 'SPU-PT-001', '张裕解百纳干红 750ml', 3, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
(6, 'SPU-PT-002', '长城干红精选 750ml', 3, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
-- 洋酒
(7, 'SPU-YJ-001', '轩尼诗VSOP 700ml', 4, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
(8, 'SPU-YJ-002', '芝华士12年 700ml', 4, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
-- 其他
(9, 'SPU-QT-001', '梅见青梅酒 330ml', 5, NULL, '["MINIAPP","STORE"]', 'ON_SALE'),
(10, 'SPU-QT-002', 'RIO锐澳鸡尾酒 330ml', 5, NULL, '["MINIAPP","STORE"]', 'ON_SALE');

-- ============================================================================
-- 7. 示例 SKU 数据（每个SPU 1个SKU，共10个）
-- ============================================================================

INSERT IGNORE INTO product_sku (id, spu_id, sku_code, barcode, sku_name, base_unit, box_unit, box_ratio, temperature, trace_enabled, warning_threshold, status) VALUES
-- 白酒
(1,  1,  'SKU-BJ-001', '6902952880123', '茅台飞天 53度 500ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 10, 1),
(2,  2,  'SKU-BJ-002', '6902952880246', '五粮液普五 52度 500ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 10, 1),
-- 啤酒
(3,  3,  'SKU-PJ-001', '6901939621066', '青岛啤酒经典 500ml 常温', '瓶', '箱', 12, 'NORMAL', 0, 20, 1),
(4,  4,  'SKU-PJ-002', '6901939621073', '百威啤酒 500ml 常温', '瓶', '箱', 12, 'NORMAL', 0, 20, 1),
-- 葡萄酒
(5,  5,  'SKU-PT-001', '6901234567001', '张裕解百纳干红 750ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 10, 1),
(6,  6,  'SKU-PT-002', '6901234567018', '长城干红精选 750ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 10, 1),
-- 洋酒
(7,  7,  'SKU-YJ-001', '6903214567005', '轩尼诗VSOP 700ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 5, 1),
(8,  8,  'SKU-YJ-002', '6903214567012', '芝华士12年 700ml 常温', '瓶', '箱', 6, 'NORMAL', 0, 5, 1),
-- 其他
(9,  9,  'SKU-QT-001', '6904567890001', '梅见青梅酒 330ml 常温', '瓶', '箱', 12, 'NORMAL', 0, 15, 1),
(10, 10, 'SKU-QT-002', '6904567890018', 'RIO锐澳鸡尾酒 330ml 常温', '瓶', '箱', 12, 'NORMAL', 0, 15, 1);

-- ============================================================================
-- 8. 示例商品价格数据
-- ============================================================================

INSERT IGNORE INTO product_price (sku_id, cost_price, retail_price, wholesale_price, miniapp_price, store_price) VALUES
-- 白酒
(1,  1480.00, 1899.00, 1680.00, 1799.00, 1899.00),  -- 茅台
(2,  680.00,  899.00,  780.00,  859.00,  899.00),   -- 五粮液
-- 啤酒
(3,  2.50,    5.00,    3.50,    4.50,    5.00),      -- 青岛啤酒
(4,  3.00,    6.00,    4.00,    5.50,    6.00),      -- 百威啤酒
-- 葡萄酒
(5,  38.00,   68.00,   52.00,   62.00,   68.00),     -- 张裕
(6,  28.00,   48.00,   38.00,   45.00,   48.00),     -- 长城
-- 洋酒
(7,  180.00,  258.00,  220.00,  238.00,  258.00),    -- 轩尼诗
(8,  120.00,  178.00,  150.00,  168.00,  178.00),    -- 芝华士
-- 其他
(9,  12.00,   28.00,   20.00,   25.00,   28.00),     -- 梅见
(10, 5.00,    12.00,   8.00,    10.00,   12.00);     -- RIO

-- ============================================================================
-- 9. 默认价格等级（8个等级）
-- ============================================================================

INSERT IGNORE INTO price_level (id, level_code, level_name, discount_rate, min_order_amount, description, sort_order, status) VALUES
(1, 'RETAIL',      '零售价',     1.0000, 0,    '面向终端消费者的标准零售价格', 1, 1),
(2, 'WHOLESALE_L1', '批发一级',   0.9200, 0,    '小批量批发，92折', 2, 1),
(3, 'WHOLESALE_L2', '批发二级',   0.8500, 500,  '中批量批发，500元起85折', 3, 1),
(4, 'WHOLESALE_L3', '批发三级',   0.7800, 2000, '大批量批发，2000元起78折', 4, 1),
(5, 'AGREEMENT',    '协议价',     0.8000, 0,    '与客户单独协商的协议价格', 5, 1),
(6, 'VIP',          'VIP会员价',  0.9000, 0,    'VIP会员专属价格', 6, 1),
(7, 'STORE',        '门店价',     0.9500, 0,    '门店自用价格', 7, 1),
(8, 'MINIAPP',      '小程序价',   0.9500, 0,    '小程序渠道专属价', 8, 1);

-- ============================================================================
-- 10. 默认预警配置（低库存/效期预警）
-- ============================================================================

INSERT IGNORE INTO alert_rule (rule_code, rule_name, rule_type, enabled, threshold_value, threshold_unit, extra_config, description) VALUES
('STOCK_LOW',        '安全库存预警',     'STOCK_LOW',       1, 0,   'BOTTLES', '{"use_warning_threshold": true}', '商品可用库存低于安全库存值时触发预警'),
('EXPIRY_90',        '保质期预警-90天',  'EXPIRY',          1, 90,  'DAYS',    NULL, '商品有效期在90天内到期时触发预警'),
('EXPIRY_30',        '保质期预警-30天',  'EXPIRY',          1, 30,  'DAYS',    NULL, '商品有效期在30天内到期时触发预警'),
('EXPIRY_7',         '保质期预警-7天',   'EXPIRY',          1, 7,   'DAYS',    NULL, '商品有效期在7天内到期时触发预警'),
('CREDIT_LIMIT',     '信用额度预警',     'CREDIT',          1, 90,  'PERCENT', NULL, '客户欠款达到信用额度的90%时触发预警'),
('PAYMENT_OVERDUE',  '回款逾期预警',     'OVERDUE',         1, 0,   'DAYS',    NULL, '超过账期未回款时触发预警'),
('STOCK_OVERSTOCK',  '库存积压预警',     'STOCK_OVERSTOCK', 1, 180, 'DAYS',    NULL, '库龄超过180天的库存触发预警');

-- ============================================================================
-- 11. 默认效期预警配置（3个级别）
-- ============================================================================

INSERT IGNORE INTO expiry_alert_config (alert_level, level_name, days_before_expiry, action, color, enabled, description) VALUES
(1, '一级预警', 30, 'REMIND',   '#10B981', 1, '距过期30天，提醒关注'),
(2, '二级预警', 15, 'RESTRICT', '#F59E0B', 1, '距过期15天，限制出库'),
(3, '三级预警', 7,  'BLOCK',    '#EF4444', 1, '距过期7天，禁止出库并锁定库存');

-- ============================================================================
-- 12. 默认系统配置（公司信息/税率/单据前缀等）
-- ============================================================================

INSERT IGNORE INTO sys_config (config_key, config_value, config_group, is_encrypted, description) VALUES
-- 企业信息
('enterprise_name',    '智享酒业有限公司', 'enterprise', 0, '企业名称'),
('enterprise_logo',    '',                 'enterprise', 0, '企业Logo URL'),
('enterprise_phone',    '010-88880000',     'enterprise', 0, '联系电话'),
('enterprise_address', '北京市朝阳区建国路88号', 'enterprise', 0, '企业地址'),
-- 微信配置
('wechat_app_id',       '',                 'wechat',     0, '微信小程序 AppID'),
('wechat_app_secret',   '',                 'wechat',     1, '微信小程序 AppSecret'),
-- 支付配置
('pay_mch_id',          '',                 'payment',    0, '微信支付商户号'),
('pay_api_key',         '',                 'payment',    1, '微信支付 API v3 密钥'),
('pay_serial_no',       '',                 'payment',    0, '微信支付证书序列号'),
('pay_notify_url',      'https://api.onepan.cn/api/miniapp/pay/notify', 'payment', 0, '支付回调通知地址'),
-- 系统配置
('default_store_id',    '1',                'system',     0, '默认门店ID'),
('tax_rate',            '0.13',             'system',     0, '默认税率（13%）'),
('sale_bill_prefix',    'XS',               'system',     0, '销售单单号前缀'),
('purchase_order_prefix','CG',               'system',     0, '采购订单单号前缀'),
('purchase_stock_prefix','RK',               'system',     0, '采购入库单单号前缀'),
('sale_return_prefix',  'XT',                'system',     0, '销售退货单单号前缀'),
('purchase_return_prefix','CT',              'system',     0, '采购退货单单号前缀'),
('collection_prefix',   'SK',               'system',     0, '分享收款单号前缀'),
('low_stock_threshold', '10',               'system',     0, '低库存预警阈值'),
('low_stock_critical',  '3',                 'system',     0, '低库存紧急阈值'),
('expiry_warning_days', '30',               'system',     0, '过期预警天数'),
('expiry_critical_days','7',                'system',     0, '过期紧急天数');

-- ============================================================================
-- 13. 示例客户数据（3个）
-- ============================================================================

INSERT IGNORE INTO member (id, mobile, name, customer_type, settlement_type, staff_id, points, level_code, status) VALUES
(1, '13900000001', '王先生（散客）',   'RETAIL',    'CASH',    NULL, 0,    NULL, 1),
(2, '13900000002', '鑫达商贸有限公司', 'WHOLESALE', 'ACCOUNT', 3,   1200, 'WHOLESALE_L2', 1),
(3, '13900000003', '鸿运餐饮集团',     'WHOLESALE', 'ACCOUNT', 4,   800,  'WHOLESALE_L1', 1);

-- ============================================================================
-- 14. 示例供应商数据（2个）
-- ============================================================================

INSERT IGNORE INTO supplier (id, supplier_code, name, short_name, category, province, city, district, address, credit_level, settlement_type, tax_rate, bank_name, bank_account, bank_account_name, status) VALUES
(1, 'SUP-001', '贵州茅台酒股份有限公司', '茅台', '酒厂', '贵州省', '遵义市', '仁怀市', '贵州省仁怀市茅台镇', 'A', 'MONTHLY', 0.1300, '中国工商银行仁怀支行', '1234567890123456789', '贵州茅台酒股份有限公司', 1),
(2, 'SUP-002', '百威亚太投资有限公司', '百威', '经销商', '上海市', '上海市', '黄浦区', '上海市黄浦区淮海中路300号', 'A', 'MONTHLY', 0.1300, '中国银行上海分行', '9876543210987654321', '百威亚太投资有限公司', 1);

-- ============================================================================
-- 15. 供应商联系人
-- ============================================================================

INSERT IGNORE INTO supplier_contact (supplier_id, name, mobile, phone, email, wechat, is_primary, position) VALUES
(1, '赵经理', '13800001001', '0851-22330001', 'zhao@moutai.com', 'zhao_moutai', 1, '大区经理'),
(1, '钱主管', '13800001002', '0851-22330002', 'qian@moutai.com', 'qian_moutai', 0, '销售主管'),
(2, '孙经理', '13800002001', '021-63220001', 'sun@budweiser.com', 'sun_budweiser', 1, '区域经理'),
(2, '周专员', '13800002002', '021-63220002', 'zhou@budweiser.com', 'zhou_budweiser', 0, '业务专员');

-- ============================================================================
-- 16. 示例库存余额数据（门店1 + 门店2）
-- ============================================================================

INSERT IGNORE INTO inventory_balance (store_id, sku_id, stock_type, physical_qty, locked_qty, available_qty) VALUES
-- 门店1 线上库存
(1, 1,  'ONLINE',  20, 0, 20),
(1, 2,  'ONLINE',  30, 0, 30),
(1, 3,  'ONLINE',  100, 0, 100),
(1, 4,  'ONLINE',  80, 0, 80),
(1, 5,  'ONLINE',  40, 0, 40),
(1, 6,  'ONLINE',  50, 0, 50),
(1, 7,  'ONLINE',  15, 0, 15),
(1, 8,  'ONLINE',  20, 0, 20),
(1, 9,  'ONLINE',  60, 0, 60),
(1, 10, 'ONLINE',  80, 0, 80),
-- 门店1 线下库存
(1, 1,  'OFFLINE', 50, 0, 50),
(1, 2,  'OFFLINE', 60, 0, 60),
(1, 3,  'OFFLINE', 200, 0, 200),
(1, 4,  'OFFLINE', 150, 0, 150),
(1, 5,  'OFFLINE', 80, 0, 80),
(1, 6,  'OFFLINE', 100, 0, 100),
(1, 7,  'OFFLINE', 30, 0, 30),
(1, 8,  'OFFLINE', 40, 0, 40),
(1, 9,  'OFFLINE', 120, 0, 120),
(1, 10, 'OFFLINE', 150, 0, 150),
-- 门店2 线上库存
(2, 1,  'ONLINE',  10, 0, 10),
(2, 2,  'ONLINE',  15, 0, 15),
(2, 3,  'ONLINE',  60, 0, 60),
(2, 4,  'ONLINE',  50, 0, 50),
(2, 5,  'ONLINE',  25, 0, 25),
(2, 6,  'ONLINE',  30, 0, 30),
(2, 7,  'ONLINE', 10, 0, 10),
(2, 8,  'ONLINE', 12, 0, 12),
(2, 9,  'ONLINE', 40, 0, 40),
(2, 10, 'ONLINE', 50, 0, 50),
-- 门店2 线下库存
(2, 1,  'OFFLINE', 30, 0, 30),
(2, 2,  'OFFLINE', 40, 0, 40),
(2, 3,  'OFFLINE', 120, 0, 120),
(2, 4,  'OFFLINE', 100, 0, 100),
(2, 5,  'OFFLINE', 50, 0, 50),
(2, 6,  'OFFLINE', 60, 0, 60),
(2, 7,  'OFFLINE', 20, 0, 20),
(2, 8,  'OFFLINE', 25, 0, 25),
(2, 9,  'OFFLINE', 80, 0, 80),
(2, 10, 'OFFLINE', 100, 0, 100);

-- ============================================================================
-- 17. 示例阶梯价格数据（部分SKU的批发价）
-- ============================================================================

INSERT IGNORE INTO sku_price (sku_id, price_level_id, min_qty, price, cost_price, suggested_retail_price, status) VALUES
-- 茅台
(1, 2, 1,  1680.00, 1480.00, 1899.00, 1),
(1, 3, 6,  1650.00, 1480.00, 1899.00, 1),
-- 五粮液
(2, 2, 1,  780.00,  680.00,  899.00,  1),
(2, 3, 6,  760.00,  680.00,  899.00,  1),
-- 青岛啤酒
(3, 2, 1,  3.50,    2.50,    5.00,  1),
(3, 3, 24, 3.20,    2.50,    5.00,  1),
-- 百威啤酒
(4, 2, 1,  4.00,    3.00,    6.00,  1),
(4, 3, 24, 3.60,    3.00,    6.00,  1),
-- 张裕
(5, 2, 1,  52.00,   38.00,   68.00,  1),
(5, 3, 6,  48.00,   38.00,   68.00,  1),
-- 长城
(6, 2, 1,  38.00,   28.00,   48.00,  1),
(6, 3, 6,  35.00,   28.00,   48.00,  1);

-- ============================================================================
-- 种子数据插入完成
-- 统计：
--   - 管理员账号：4 条
--   - RBAC 角色：4 条
--   - 用户角色绑定：4 条
--   - 门店数据：2 条
--   - 商品分类：5 条
--   - 商品SPU：10 条
--   - 商品SKU：10 条
--   - 商品价格：10 条
--   - 价格等级：8 条
--   - 预警规则：7 条
--   - 效期预警配置：3 条
--   - 系统配置：22 条
--   - 客户数据：3 条
--   - 供应商数据：2 条
--   - 供应商联系人：4 条
--   - 库存余额：40 条
--   - 阶梯价格：12 条
--   合计：150 条种子数据
-- ============================================================================
