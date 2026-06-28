-- ============================================================
-- 性能优化：数据库索引
-- 针对 products、sale_bills、customer_credit、member 等高频查询表
-- 添加复合索引以消除慢查询
-- ============================================================

-- ========================================================================
-- products 表索引
-- 高频查询：按 name 模糊搜索、按 status 过滤、按 category_id 分组
-- ========================================================================
ALTER TABLE products ADD INDEX idx_products_status (status) IF NOT EXISTS;
ALTER TABLE products ADD INDEX idx_products_category (category_id) IF NOT EXISTS;
ALTER TABLE products ADD INDEX idx_products_tenant_status (tenant_id, status) IF NOT EXISTS;
ALTER TABLE products ADD FULLTEXT INDEX ft_products_name (name) IF NOT EXISTS;

-- ========================================================================
-- sale_bills 表索引
-- 高频查询：按 customer_id + created_at 查询、按 status + created_at 查询
-- 按 store_id + created_at 查询、按 tenant_id + 日期范围查询
-- ========================================================================
ALTER TABLE sale_bills ADD INDEX idx_sale_bills_customer_created (customer_id, created_at DESC) IF NOT EXISTS;
ALTER TABLE sale_bills ADD INDEX idx_sale_bills_status_created (status, created_at DESC) IF NOT EXISTS;
ALTER TABLE sale_bills ADD INDEX idx_sale_bills_store_created (store_id, created_at DESC) IF NOT EXISTS;
ALTER TABLE sale_bills ADD INDEX idx_sale_bills_tenant_date (tenant_id, created_at DESC) IF NOT EXISTS;
ALTER TABLE sale_bills ADD INDEX idx_sale_bills_payment (payment_status) IF NOT EXISTS;

-- ========================================================================
-- sale_bill_items 表索引
-- 高频查询：按 bill_id 关联、按 product_id 统计
-- ========================================================================
ALTER TABLE sale_bill_items ADD INDEX idx_sale_bill_items_bill (bill_id) IF NOT EXISTS;
ALTER TABLE sale_bill_items ADD INDEX idx_sale_bill_items_product (product_id) IF NOT EXISTS;

-- ========================================================================
-- customer_credit 表索引
-- 高频查询：按 status 过滤、按 customer_id 关联
-- ========================================================================
ALTER TABLE customer_credit ADD INDEX idx_customer_credit_status (status) IF NOT EXISTS;
ALTER TABLE customer_credit ADD INDEX idx_customer_credit_tenant_status (tenant_id, status) IF NOT EXISTS;

-- ========================================================================
-- member 表索引
-- 高频查询：按 name 搜索、按 mobile 搜索
-- ========================================================================
ALTER TABLE member ADD INDEX idx_member_mobile (mobile) IF NOT EXISTS;
ALTER TABLE member ADD FULLTEXT INDEX ft_member_name (name) IF NOT EXISTS;

-- ========================================================================
-- collection_record 表索引
-- 高频查询：按 customer_id、collection_level、created_at
-- ========================================================================
ALTER TABLE collection_record ADD INDEX idx_collection_customer (customer_id) IF NOT EXISTS;
ALTER TABLE collection_record ADD INDEX idx_collection_level (collection_level) IF NOT EXISTS;
ALTER TABLE collection_record ADD INDEX idx_collection_tenant_date (tenant_id, created_at DESC) IF NOT EXISTS;

-- ========================================================================
-- platform_admin 表索引
-- 高频查询：按 username 登录
-- ========================================================================
ALTER TABLE platform_admin ADD INDEX idx_platform_admin_username (username) IF NOT EXISTS;

SELECT '性能优化索引创建完成' AS result;