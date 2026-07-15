-- 编号: 115, 描述: 性能优化索引, 创建人: 阿坚, 日期: 2026-07-15
-- 说明：为高频查询表添加优化索引，提升商品列表、订单列表、报表查询等热点接口性能

-- ==================== 商品表索引 ====================
-- 商品列表查询：按状态、分类、品牌、关键词过滤
ALTER TABLE product_spu ADD INDEX idx_product_spu_status_category (status, category_id);
ALTER TABLE product_spu ADD INDEX idx_product_spu_status_brand (status, brand);
ALTER TABLE product_spu ADD INDEX idx_product_spu_category_status (category_id, status);

-- 商品搜索：按名称模糊查询
ALTER TABLE product_spu ADD FULLTEXT INDEX ft_product_spu_name (name);

-- SKU 价格查询：按 SKU ID 和价格等级
ALTER TABLE product_price ADD INDEX idx_product_price_sku_level (sku_id, price_level_id);
ALTER TABLE product_price ADD INDEX idx_product_price_sku_id (sku_id);

-- SKU 库存查询
ALTER TABLE product_sku ADD INDEX idx_product_sku_spu_id (spu_id);
ALTER TABLE product_sku ADD INDEX idx_product_sku_barcode (barcode);

-- ==================== 订单表索引 ====================
-- 订单列表查询：按状态、时间、门店、客户
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_status (status);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_store_status (store_id, status);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_customer_status (customer_id, status);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_created_at (created_at);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_status_created (status, created_at);

-- 订单明细表查询
ALTER TABLE sale_bill_item ADD INDEX idx_sale_bill_item_bill_no (bill_no);
ALTER TABLE sale_bill_item ADD INDEX idx_sale_bill_item_sku_id (sku_id);

-- 小程序订单索引
ALTER TABLE miniapp_order ADD INDEX idx_miniapp_order_status (status);
ALTER TABLE miniapp_order ADD INDEX idx_miniapp_order_customer (customer_id);
ALTER TABLE miniapp_order ADD INDEX idx_miniapp_order_created_at (created_at);
ALTER TABLE miniapp_order ADD INDEX idx_miniapp_order_status_created (status, created_at);

-- 订单明细表索引
ALTER TABLE miniapp_order_item ADD INDEX idx_miniapp_order_item_order_no (order_no);
ALTER TABLE miniapp_order_item ADD INDEX idx_miniapp_order_item_sku_id (sku_id);

-- ==================== 客户表索引 ====================
-- 客户列表查询：按类型、状态、所属员工
ALTER TABLE member ADD INDEX idx_member_customer_type (customer_type);
ALTER TABLE member ADD INDEX idx_member_status (status);
ALTER TABLE member ADD INDEX idx_member_staff_id (staff_id);
ALTER TABLE member ADD INDEX idx_member_type_status (customer_type, status);

-- 客户搜索：按手机号查询
ALTER TABLE member ADD INDEX idx_member_mobile (mobile);

-- 客户收款查询
ALTER TABLE customer_payment ADD INDEX idx_customer_payment_customer (customer_id);
ALTER TABLE customer_payment ADD INDEX idx_customer_payment_status (status);
ALTER TABLE customer_payment ADD INDEX idx_customer_payment_payment_date (payment_date);

-- ==================== 库存表索引 ====================
-- 库存查询：按商品、仓库、门店
ALTER TABLE inventory ADD INDEX idx_inventory_sku_id (sku_id);
ALTER TABLE inventory ADD INDEX idx_inventory_store_id (store_id);
ALTER TABLE inventory ADD INDEX idx_inventory_warehouse_id (warehouse_id);
ALTER TABLE inventory ADD INDEX idx_inventory_sku_store (sku_id, store_id);

-- 库存批次查询
ALTER TABLE inventory_batch ADD INDEX idx_inventory_batch_sku_id (sku_id);
ALTER TABLE inventory_batch ADD INDEX idx_inventory_batch_batch_no (batch_no);
ALTER TABLE inventory_batch ADD INDEX idx_inventory_batch_expiry_date (expiry_date);

-- ==================== 采购表索引 ====================
-- 采购订单查询
ALTER TABLE purchase_order ADD INDEX idx_purchase_order_status (status);
ALTER TABLE purchase_order ADD INDEX idx_purchase_order_supplier (supplier_id);
ALTER TABLE purchase_order ADD INDEX idx_purchase_order_created_at (created_at);

-- 采购入库查询
ALTER TABLE purchase_in_stock ADD INDEX idx_purchase_in_stock_order_no (order_no);
ALTER TABLE purchase_in_stock ADD INDEX idx_purchase_in_stock_status (status);

-- ==================== 报表相关索引 ====================
-- 销售统计：按日期范围查询
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_date_range (created_at, tenant_id);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_receivable_status (collection_status);

-- 应收款查询
ALTER TABLE receivable ADD INDEX idx_receivable_customer_id (customer_id);
ALTER TABLE receivable ADD INDEX idx_receivable_status (status);
ALTER TABLE receivable ADD INDEX idx_receivable_due_date (due_date);

-- ==================== 营销相关索引 ====================
-- 优惠券查询
ALTER TABLE coupon_template ADD INDEX idx_coupon_template_status (status);
ALTER TABLE coupon_template ADD INDEX idx_coupon_template_type (type);
ALTER TABLE coupon_template ADD INDEX idx_coupon_template_created_at (created_at);

-- 用户优惠券查询
ALTER TABLE user_coupon ADD INDEX idx_user_coupon_customer (customer_id);
ALTER TABLE user_coupon ADD INDEX idx_user_coupon_status (status);
ALTER TABLE user_coupon ADD INDEX idx_user_coupon_template_id (template_id);

-- ==================== 租户隔离索引 ====================
-- 多租户查询优化：为主要业务表添加 tenant_id + 常用字段组合索引
ALTER TABLE product_spu ADD INDEX idx_product_spu_tenant_status (tenant_id, status);
ALTER TABLE sale_bill ADD INDEX idx_sale_bill_tenant_status (tenant_id, status);
ALTER TABLE member ADD INDEX idx_member_tenant_status (tenant_id, status);
ALTER TABLE inventory ADD INDEX idx_inventory_tenant_store (tenant_id, store_id);
ALTER TABLE miniapp_order ADD INDEX idx_miniapp_order_tenant_status (tenant_id, status);