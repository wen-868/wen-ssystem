/**
 * S3-80 B-2 核验探针 —— SQLite 侧的建表 DDL（**真实 MySQL DDL 的等价转写**）
 *
 * 依据（逐条对照仓库真实结构，可复跑核对）：
 *  - t_sale_bill      ：docs/migrations/001_phase1_schema.sql:338-369 + backend/src/shared/migration.ts:573-606（含 tenant_id / sale_type / 各金额列）
 *  - t_sale_bill_item ：docs/migrations/001_phase1_schema.sql:371-387 + docs/migrations/092_租户ID.sql:141（tenant_id NOT NULL DEFAULT 'default'）
 *                       + docs/migrations/129_sale_bill_item_compliance.sql:3-8（sku_spec/unit/barcode/item_remark/item_discount/trace_codes）
 *  - t_member         ：docs/migrations/001_phase1_schema.sql:130（本探针只用到 id/name/mobile/customer_type，其余列省略并已在 README 声明）
 *
 * 关键约束与默认值必须与 MySQL 一致，否则核验结论无效：
 *  - `UNIQUE (bill_no)`            ← uk_sale_bill_no（**注意：不含 tenant_id**）
 *  - `tenant_id ... DEFAULT 'default'` ← 092 号迁移加列时的默认值
 *  - 销售单明细插入语句**不含 tenant_id 列** ⇒ 落库取默认值（本探针要核验的关键点之一）
 */

export const DDL = `
CREATE TABLE t_sale_bill (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  bill_no TEXT NOT NULL,
  store_id INTEGER NOT NULL DEFAULT 0,
  customer_id INTEGER DEFAULT NULL,
  customer_name TEXT DEFAULT NULL,
  customer_mobile TEXT DEFAULT NULL,
  customer_type TEXT NOT NULL DEFAULT 'RETAIL',
  sale_type TEXT NOT NULL DEFAULT 'CASH',
  business_status TEXT NOT NULL DEFAULT 'CREATED',
  collection_status TEXT NOT NULL DEFAULT 'UNPAID',
  due_date TEXT DEFAULT NULL,
  statement_id INTEGER DEFAULT NULL,
  goods_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  rounding_amount NUMERIC NOT NULL DEFAULT 0,
  receivable_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  unreceived_amount NUMERIC NOT NULL DEFAULT 0,
  share_collection_count INTEGER NOT NULL DEFAULT 0,
  operator_id INTEGER NOT NULL,
  remark TEXT DEFAULT NULL,
  internal_remark TEXT DEFAULT NULL,
  void_reason TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_sale_bill_no UNIQUE (bill_no)
);
CREATE INDEX idx_sale_bill_tenant ON t_sale_bill (tenant_id);
CREATE INDEX idx_sale_bill_store_status ON t_sale_bill (store_id, business_status, collection_status);

CREATE TABLE t_sale_bill_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  bill_no TEXT NOT NULL,
  sku_id INTEGER NOT NULL,
  sku_name TEXT NOT NULL,
  sku_spec TEXT DEFAULT NULL,
  unit TEXT NOT NULL DEFAULT '瓶',
  barcode TEXT DEFAULT NULL,
  box_qty INTEGER NOT NULL DEFAULT 0,
  bottle_qty INTEGER NOT NULL DEFAULT 0,
  total_bottle_qty INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  price_type TEXT NOT NULL,
  subtotal_amount NUMERIC NOT NULL,
  item_remark TEXT DEFAULT NULL,
  item_discount NUMERIC NOT NULL DEFAULT 0,
  trace_codes TEXT DEFAULT NULL,
  trace_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sale_bill_item_bill_no ON t_sale_bill_item (bill_no);
CREATE INDEX idx_sale_bill_item_tenant ON t_sale_bill_item (tenant_id);

CREATE TABLE t_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT DEFAULT NULL,
  mobile TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'RETAIL',
  status INTEGER NOT NULL DEFAULT 1
);
`;
