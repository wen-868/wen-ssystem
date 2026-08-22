-- =====================================================================
-- 002_missing_business_tables.sql
-- 补齐 runMigrations() 中缺失建表语句的业务表（仅查 cwd/docs/migrations
-- 导致 086 之后建表 SQL 在生产未执行，见 migration.ts:866 注释）。
--
-- ⚠️ 本文件由前端改造协同梳理产出，需由后端/运维在本地库手动执行：
--    mysql -u<user> -p<pass> <db> < migrations/002_missing_business_tables.sql
-- 或把下列 CREATE TABLE 并入 backend/src/shared/migration.ts 的 runMigrations()
-- 主体（与现有 19 条 CREATE TABLE IF NOT EXISTS 同风格），随服务启动自动建表。
--
-- 字段严格对齐：
--   - t_receipt / t_receipt_writeoff  ← receipt.service.ts
--   - t_purchase_in_stock / t_purchase_in_stock_item ← purchase-in-stock.service.ts
--   - t_purchase_return / t_purchase_return_item ← 退货（B 阶段）前置
--   - t_sale_return / t_sale_return_item   ← 退货（B 阶段）前置
-- tenant_id 约定见 migration.ts:162 VARCHAR(36) NOT NULL DEFAULT 'default'
-- =====================================================================

-- ---------- 收款单 ----------
CREATE TABLE IF NOT EXISTS t_receipt (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_no      VARCHAR(64)  NOT NULL,
  customer_id     BIGINT       NOT NULL DEFAULT 0,
  customer_name   VARCHAR(128) NULL,
  receipt_type    VARCHAR(32)  NOT NULL DEFAULT 'SALE',
  amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(32)  NULL,
  bank_account_id BIGINT       NULL,
  received_date   DATE         NULL,
  status          VARCHAR(32)  NOT NULL DEFAULT 'CONFIRMED',
  remark          VARCHAR(512) NULL,
  operator_id     BIGINT       NOT NULL DEFAULT 0,
  tenant_id       VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_receipt_no_tenant (receipt_no, tenant_id),
  KEY idx_customer_tenant (customer_id, tenant_id),
  KEY idx_tenant_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款单';

CREATE TABLE IF NOT EXISTS t_receipt_writeoff (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  receipt_id       BIGINT       NOT NULL,
  receivable_id    BIGINT       NOT NULL,
  source_no        VARCHAR(64)  NULL,
  writeoff_amount  DECIMAL(18,2) NOT NULL DEFAULT 0,
  tenant_id        VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_receipt_tenant (receipt_id, tenant_id),
  KEY idx_receivable_tenant (receivable_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收款核销明细';

-- ---------- 采购入库单 ----------
CREATE TABLE IF NOT EXISTS t_purchase_in_stock (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  stock_no      VARCHAR(64)  NOT NULL,
  order_no      VARCHAR(64)  NULL,
  supplier_id   BIGINT       NOT NULL DEFAULT 0,
  supplier_name VARCHAR(128) NULL,
  store_id      BIGINT       NOT NULL DEFAULT 0,
  stock_status  VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
  goods_amount  DECIMAL(18,2) NOT NULL DEFAULT 0,
  tax_amount    DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_amount  DECIMAL(18,2) NOT NULL DEFAULT 0,
  operator_id   BIGINT       NOT NULL DEFAULT 0,
  auditor_id    BIGINT       NULL,
  audited_at    DATETIME     NULL,
  remark        VARCHAR(512) NULL,
  tenant_id     VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_no_tenant (stock_no, tenant_id),
  KEY idx_supplier_tenant (supplier_id, tenant_id),
  KEY idx_store_tenant (store_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单';

CREATE TABLE IF NOT EXISTS t_purchase_in_stock_item (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  stock_no       VARCHAR(64)  NOT NULL,
  sku_id         BIGINT       NOT NULL,
  sku_name       VARCHAR(128) NOT NULL,
  box_qty        INT          NOT NULL DEFAULT 0,
  bottle_qty     INT          NOT NULL DEFAULT 0,
  total_bottle_qty INT        NOT NULL DEFAULT 0,
  unit_price     DECIMAL(18,2) NOT NULL DEFAULT 0,
  tax_rate       DECIMAL(10,4) NOT NULL DEFAULT 0,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  tax_amount     DECIMAL(18,2) NOT NULL DEFAULT 0,
  total_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
  batch_no       VARCHAR(64)  NULL,
  production_date DATE         NULL,
  expiry_date    DATE         NULL,
  remark         VARCHAR(512) NULL,
  tenant_id      VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stock_no (stock_no),
  KEY idx_sku_tenant (sku_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购入库单明细';

-- ---------- 退货（B 阶段前置，提前建表避免二次打回） ----------
CREATE TABLE IF NOT EXISTS t_purchase_return (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_no      VARCHAR(64)  NOT NULL,
  source_bill_no VARCHAR(64)  NULL COMMENT '关联采购单/入库单号',
  supplier_id    BIGINT       NOT NULL DEFAULT 0,
  supplier_name  VARCHAR(128) NULL,
  store_id       BIGINT       NOT NULL DEFAULT 0,
  return_status  VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
  total_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
  operator_id    BIGINT       NOT NULL DEFAULT 0,
  remark         VARCHAR(512) NULL,
  tenant_id      VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_return_no_tenant (return_no, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单';

CREATE TABLE IF NOT EXISTS t_purchase_return_item (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_no      VARCHAR(64)  NOT NULL,
  sku_id         BIGINT       NOT NULL,
  sku_name       VARCHAR(128) NOT NULL,
  return_qty     INT          NOT NULL DEFAULT 0,
  unit_price     DECIMAL(18,2) NOT NULL DEFAULT 0,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  reason         VARCHAR(512) NULL,
  tenant_id      VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_return_no (return_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购退货单明细';

CREATE TABLE IF NOT EXISTS t_sale_return (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_no      VARCHAR(64)  NOT NULL,
  source_bill_no VARCHAR(64)  NULL COMMENT '关联销售单号',
  customer_id    BIGINT       NOT NULL DEFAULT 0,
  customer_name  VARCHAR(128) NULL,
  store_id       BIGINT       NOT NULL DEFAULT 0,
  return_status  VARCHAR(32)  NOT NULL DEFAULT 'PENDING',
  total_amount   DECIMAL(18,2) NOT NULL DEFAULT 0,
  operator_id    BIGINT       NOT NULL DEFAULT 0,
  remark         VARCHAR(512) NULL,
  tenant_id      VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_return_no_tenant (return_no, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单';

CREATE TABLE IF NOT EXISTS t_sale_return_item (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  return_no      VARCHAR(64)  NOT NULL,
  sku_id         BIGINT       NOT NULL,
  sku_name       VARCHAR(128) NOT NULL,
  return_qty     INT          NOT NULL DEFAULT 0,
  unit_price     DECIMAL(18,2) NOT NULL DEFAULT 0,
  subtotal_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
  reason         VARCHAR(512) NULL,
  tenant_id      VARCHAR(36)  NOT NULL DEFAULT 'default',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_return_no (return_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='销售退货单明细';
