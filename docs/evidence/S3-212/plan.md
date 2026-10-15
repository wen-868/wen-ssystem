# S3-212 收敛计划（组数 92）

| # | 表.列 | 运行期真值 | 变体 | 目标 | 依据 | 需改处数 | 目标=有效定义 |
|---:|---|---|---|---|---|---:|:--:|
| 1 | t_sys_user.id | int unsigned | `INT`×2 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 2 | 是 |
| 2 | t_sys_user.username | varchar(50) | `VARCHAR(64)`×2 / `VARCHAR(50)`×1(有效) | `VARCHAR(50)` | 运行期真值 = 变体「VARCHAR(50)」 | 2 | 是 |
| 3 | t_sys_user.real_name | varchar(50) | `VARCHAR(64)`×2 / `VARCHAR(50)`×1(有效) | `VARCHAR(50)` | 运行期真值 = 变体「VARCHAR(50)」 | 2 | 是 |
| 4 | t_sys_user.store_id | int unsigned | `BIGINT UNSIGNED`×1 / `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 2 | 是 |
| 5 | t_sys_role.id | int unsigned | `INT`×3 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 3 | 是 |
| 6 | t_sys_role.role_code | varchar(50) | `VARCHAR(64)`×2 / `VARCHAR(50)`×2(有效) | `VARCHAR(50)` | 运行期真值 = 变体「VARCHAR(50)」 | 2 | 是 |
| 7 | t_sys_role.role_name | varchar(50) | `VARCHAR(64)`×2 / `VARCHAR(50)`×2(有效) | `VARCHAR(50)` | 运行期真值 = 变体「VARCHAR(50)」 | 2 | 是 |
| 8 | t_sys_role.data_scope | varchar(32) | `VARCHAR(32)`×2 / `ENUM('ALL','DEPARTMENT','STORE','SELF')`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 否 |
| 9 | t_sys_role.status | varchar(20) | `VARCHAR(16)`×3 / `VARCHAR(20)`×1(有效) | `VARCHAR(20)` | 运行期真值 = 变体「VARCHAR(20)」 | 3 | 是 |
| 10 | t_sys_role.description | varchar(255) | `VARCHAR(200)`×2 / `VARCHAR(255)`×1(有效) | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 2 | 是 |
| 11 | t_sys_user_role.id | int unsigned | `BIGINT UNSIGNED`×2 / `BIGINT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 3 | 是 |
| 12 | t_sys_user_role.user_id | int unsigned | `BIGINT UNSIGNED`×2 / `BIGINT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 3 | 是 |
| 13 | t_sys_user_role.role_id | int unsigned | `BIGINT UNSIGNED`×2 / `BIGINT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 3 | 是 |
| 14 | t_store.status | varchar(20) | `TINYINT`×1 / `VARCHAR(20)`×1(有效) | `VARCHAR(20)` | 运行期真值 = 变体「VARCHAR(20)」 | 1 | 是 |
| 15 | t_purchase_payment.id | bigint unsigned | `BIGINT UNSIGNED`×2(有效) / `BIGINT`×1 | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 16 | t_purchase_payment.payment_no | varchar(64) | `VARCHAR(64)`×2(有效) / `VARCHAR(30)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 17 | t_purchase_payment.supplier_id | bigint unsigned | `BIGINT UNSIGNED`×2(有效) / `BIGINT`×1 | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 18 | t_purchase_payment.bank_account | varchar(64) | `VARCHAR(64)`×2(有效) / `VARCHAR(100)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 19 | t_purchase_payment.status | varchar(32) | `VARCHAR(32)`×2(有效) / `ENUM('PENDING','APPROVED','PAID','CANCELLED')`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 是 |
| 20 | t_purchase_payment.remark | varchar(255) | `VARCHAR(255)`×2(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 21 | t_price_level.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 22 | t_sku_price.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 23 | t_customer_price_binding.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 24 | t_price_change_log.id | int unsigned | `INT`×1 / `BIGINT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 2 | 是 |
| 25 | t_price_change_log.old_price | decimal(12,2) | `DECIMAL(12,2)`×2(有效) / `DECIMAL(10,2)`×1 | `DECIMAL(12,2)` | 运行期真值 = 变体「DECIMAL(12,2)」 | 1 | 是 |
| 26 | t_price_change_log.new_price | decimal(12,2) | `DECIMAL(12,2)`×2(有效) / `DECIMAL(10,2)`×1 | `DECIMAL(12,2)` | 运行期真值 = 变体「DECIMAL(12,2)」 | 1 | 是 |
| 27 | t_price_change_log.tenant_id | varchar(36) | `VARCHAR(64)`×1 / `VARCHAR(36)`×1(有效) | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |
| 28 | t_customer_credit.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 29 | t_credit_operation_log.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 30 | t_collection_record.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 31 | t_trace_config.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 32 | t_trace_code.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 33 | t_trace_event_log.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 34 | t_trace_scan_log.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 35 | t_recall_record.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 36 | t_inventory_batch.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 37 | t_expiry_alert_config.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 38 | t_expiry_alert_record.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 39 | t_store_control_config.id | int unsigned | `INT`×2 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 2 | 是 |
| 40 | t_store_control_config.max_order_amount | decimal(10,2) | `DECIMAL(10,2)`×2(有效) / `DECIMAL(12,2)`×1 | `DECIMAL(10,2)` | 运行期真值 = 变体「DECIMAL(10,2)」 | 1 | 是 |
| 41 | t_store_control_config.suspended_reason | varchar(500) | `VARCHAR(500)`×2(有效) / `VARCHAR(255)`×1 | `VARCHAR(500)` | 运行期真值 = 变体「VARCHAR(500)」 | 1 | 是 |
| 42 | t_store_status_log.id | int unsigned | `INT`×1 / `INT UNSIGNED`×1(有效) | `INT UNSIGNED` | 运行期真值 = 变体「INT UNSIGNED」 | 1 | 是 |
| 43 | t_supplier_statement.id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 44 | t_supplier_statement.supplier_id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 45 | t_supplier_statement_item.id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 46 | t_supplier_statement_item.statement_id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 47 | t_supplier_statement_item.purchase_order_id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 48 | t_notification.id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 49 | t_notification.recipient_id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 50 | t_tenant.status | tinyint | `TINYINT`×3(有效) / `VARCHAR(16)`×1 | `TINYINT` | 运行期真值 = 变体「TINYINT」 | 1 | 是 |
| 51 | t_subscription.tenant_id | varchar(36) | `VARCHAR(36)`×2(有效) / `VARCHAR(64)`×1 | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |
| 52 | t_tenant_admin.user_id | bigint unsigned | `INT`×2(有效) / `BIGINT UNSIGNED`×1 | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 2 | 否 |
| 53 | t_retail_shop_config.shop_name | varchar(128) | `VARCHAR(128)`×1(有效) / `VARCHAR(100)`×1 | `VARCHAR(128)` | 运行期真值 = 变体「VARCHAR(128)」 | 1 | 是 |
| 54 | t_retail_shop_config.shop_logo | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 55 | t_retail_shop_config.status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 56 | t_retail_shop_config.tenant_id | varchar(32) | `VARCHAR(36)`×1(有效) / `VARCHAR(32)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 否 |
| 57 | t_retail_category.category_name | varchar(64) | `VARCHAR(64)`×1(有效) / `VARCHAR(100)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 58 | t_retail_category.category_icon | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 59 | t_retail_category.status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 60 | t_retail_category.tenant_id | varchar(32) | `VARCHAR(36)`×1(有效) / `VARCHAR(32)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 否 |
| 61 | t_retail_banner.id | int | `INT`×1(有效) / `BIGINT`×1 | `INT` | 运行期真值 = 变体「INT」 | 1 | 是 |
| 62 | t_retail_banner.banner_title | varchar(128) | `VARCHAR(128)`×1(有效) / `VARCHAR(100)`×1 | `VARCHAR(128)` | 运行期真值 = 变体「VARCHAR(128)」 | 1 | 是 |
| 63 | t_retail_banner.banner_image | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 64 | t_retail_banner.link_type | varchar(32) | `VARCHAR(32)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 是 |
| 65 | t_retail_banner.link_value | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 66 | t_retail_banner.status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 67 | t_retail_banner.tenant_id | varchar(36) | `VARCHAR(36)`×1(有效) / `VARCHAR(32)`×1 | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |
| 68 | t_retail_product.status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 69 | t_retail_product.tenant_id | varchar(32) | `VARCHAR(36)`×1(有效) / `VARCHAR(32)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 否 |
| 70 | t_retail_order.delivery_type | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 71 | t_retail_order.delivery_address | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 72 | t_retail_order.receiver_name | varchar(64) | `VARCHAR(64)`×1(有效) / `VARCHAR(50)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 73 | t_retail_order.receiver_latitude | decimal(10,6) | `DECIMAL(10,6)`×1(有效) / `DECIMAL(10,7)`×1 | `DECIMAL(10,6)` | 运行期真值 = 变体「DECIMAL(10,6)」 | 1 | 是 |
| 74 | t_retail_order.receiver_longitude | decimal(10,6) | `DECIMAL(10,6)`×1(有效) / `DECIMAL(10,7)`×1 | `DECIMAL(10,6)` | 运行期真值 = 变体「DECIMAL(10,6)」 | 1 | 是 |
| 75 | t_retail_order.payment_status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(20)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 76 | t_retail_order.payment_method | varchar(32) | `VARCHAR(32)`×1(有效) / `VARCHAR(30)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 1 | 是 |
| 77 | t_retail_order.transaction_no | varchar(128) | `VARCHAR(128)`×1(有效) / `VARCHAR(64)`×1 | `VARCHAR(128)` | 运行期真值 = 变体「VARCHAR(128)」 | 1 | 是 |
| 78 | t_retail_order.order_status | varchar(16) | `VARCHAR(16)`×1(有效) / `VARCHAR(30)`×1 | `VARCHAR(16)` | 运行期真值 = 变体「VARCHAR(16)」 | 1 | 是 |
| 79 | t_retail_order.cancel_reason | varchar(255) | `VARCHAR(255)`×1(有效) / `VARCHAR(500)`×1 | `VARCHAR(255)` | 运行期真值 = 变体「VARCHAR(255)」 | 1 | 是 |
| 80 | t_retail_order.tenant_id | varchar(36) | `VARCHAR(36)`×1(有效) / `VARCHAR(32)`×1 | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |
| 81 | t_bank_account.bank_name | varchar(64) | `VARCHAR(64)`×1(有效) / `VARCHAR(100)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 82 | t_bank_account.account_name | varchar(64) | `VARCHAR(64)`×1(有效) / `VARCHAR(100)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 83 | t_bank_account.account_no | varchar(64) | `VARCHAR(64)`×1(有效) / `VARCHAR(50)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 84 | t_brand.tenant_id | varchar(36) | `VARCHAR(64)`×1 / `VARCHAR(36)`×1(有效) | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |
| 85 | t_points_record.id | bigint | `BIGINT`×2(有效) / `BIGINT UNSIGNED`×1 | `BIGINT` | 运行期真值 = 变体「BIGINT」 | 1 | 是 |
| 86 | t_points_record.type | varchar(20) | `VARCHAR(20)`×2(有效) / `VARCHAR(16)`×1 | `VARCHAR(20)` | 运行期真值 = 变体「VARCHAR(20)」 | 1 | 是 |
| 87 | t_points_record.source_type | varchar(32) | `VARCHAR(20)`×2(有效) / `VARCHAR(32)`×1 | `VARCHAR(32)` | 运行期真值 = 变体「VARCHAR(32)」 | 2 | 否 |
| 88 | t_points_record.remark | varchar(200) | `VARCHAR(200)`×2(有效) / `VARCHAR(256)`×1 | `VARCHAR(200)` | 运行期真值 = 变体「VARCHAR(200)」 | 1 | 是 |
| 89 | t_points_record.tenant_id | varchar(64) | `VARCHAR(64)`×2(有效) / `VARCHAR(36)`×1 | `VARCHAR(64)` | 运行期真值 = 变体「VARCHAR(64)」 | 1 | 是 |
| 90 | t_error_logs.id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 91 | t_error_logs.user_id | bigint unsigned | `BIGINT`×1 / `BIGINT UNSIGNED`×1(有效) | `BIGINT UNSIGNED` | 运行期真值 = 变体「BIGINT UNSIGNED」 | 1 | 是 |
| 92 | t_error_logs.tenant_id | varchar(36) | `VARCHAR(64)`×1 / `VARCHAR(36)`×1(有效) | `VARCHAR(36)` | 运行期真值 = 变体「VARCHAR(36)」 | 1 | 是 |

## 逐组明细（需改处）

1. **t_sys_user.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/001_phase1_schema.sql:45 ; docs/init_database.sql:52
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:487(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:45 ; docs/init_database.sql:52
2. **t_sys_user.username** → `VARCHAR(50)`（运行期真值 = 变体「VARCHAR(50)」）
   - 变体 `VARCHAR(64)`：docs/migrations/001_phase1_schema.sql:46 ; docs/init_database.sql:54
   - 变体 `VARCHAR(50)`：backend/src/shared/migration.ts:488(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:46 ; docs/init_database.sql:54
3. **t_sys_user.real_name** → `VARCHAR(50)`（运行期真值 = 变体「VARCHAR(50)」）
   - 变体 `VARCHAR(64)`：docs/migrations/001_phase1_schema.sql:48 ; docs/init_database.sql:56
   - 变体 `VARCHAR(50)`：backend/src/shared/migration.ts:490(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:48 ; docs/init_database.sql:56
4. **t_sys_user.store_id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/001_phase1_schema.sql:50
   - 变体 `INT`：docs/init_database.sql:58
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:493(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:50 ; docs/init_database.sql:58
5. **t_sys_role.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/001_phase1_schema.sql:62 ; docs/migrations/008_phase6_schema.sql:67 ; docs/init_database.sql:75
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:510(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:62 ; docs/migrations/008_phase6_schema.sql:67 ; docs/init_database.sql:75
6. **t_sys_role.role_code** → `VARCHAR(50)`（运行期真值 = 变体「VARCHAR(50)」）
   - 变体 `VARCHAR(64)`：docs/migrations/001_phase1_schema.sql:63 ; docs/init_database.sql:77
   - 变体 `VARCHAR(50)`：docs/migrations/008_phase6_schema.sql:69 ; backend/src/shared/migration.ts:511(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:63 ; docs/init_database.sql:77
7. **t_sys_role.role_name** → `VARCHAR(50)`（运行期真值 = 变体「VARCHAR(50)」）
   - 变体 `VARCHAR(64)`：docs/migrations/001_phase1_schema.sql:64 ; docs/init_database.sql:78
   - 变体 `VARCHAR(50)`：docs/migrations/008_phase6_schema.sql:68 ; backend/src/shared/migration.ts:512(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:64 ; docs/init_database.sql:78
8. **t_sys_role.data_scope** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(32)`：docs/migrations/001_phase1_schema.sql:65 ; docs/init_database.sql:80
   - 变体 `ENUM('ALL','DEPARTMENT','STORE','SELF')`：docs/migrations/008_phase6_schema.sql:73
   - 需改：docs/migrations/008_phase6_schema.sql:73
9. **t_sys_role.status** → `VARCHAR(20)`（运行期真值 = 变体「VARCHAR(20)」）
   - 变体 `VARCHAR(16)`：docs/migrations/001_phase1_schema.sql:66 ; docs/migrations/008_phase6_schema.sql:71 ; docs/init_database.sql:82
   - 变体 `VARCHAR(20)`：backend/src/shared/migration.ts:514(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:66 ; docs/migrations/008_phase6_schema.sql:71 ; docs/init_database.sql:82
10. **t_sys_role.description** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(200)`：docs/migrations/008_phase6_schema.sql:70 ; docs/init_database.sql:79
   - 变体 `VARCHAR(255)`：backend/src/shared/migration.ts:513(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:70 ; docs/init_database.sql:79
11. **t_sys_user_role.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/001_phase1_schema.sql:90 ; docs/init_database.sql:312
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:82
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:526(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:90 ; docs/init_database.sql:312 ; docs/migrations/008_phase6_schema.sql:82
12. **t_sys_user_role.user_id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/001_phase1_schema.sql:91 ; docs/init_database.sql:314
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:83
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:527(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:91 ; docs/init_database.sql:314 ; docs/migrations/008_phase6_schema.sql:83
13. **t_sys_user_role.role_id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/001_phase1_schema.sql:92 ; docs/init_database.sql:315
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:84
   - 变体 `INT UNSIGNED`：backend/src/shared/migration.ts:528(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:92 ; docs/init_database.sql:315 ; docs/migrations/008_phase6_schema.sql:84
14. **t_store.status** → `VARCHAR(20)`（运行期真值 = 变体「VARCHAR(20)」）
   - 变体 `TINYINT`：docs/migrations/001_phase1_schema.sql:122
   - 变体 `VARCHAR(20)`：docs/init_database.sql:129(有效)
   - 需改：docs/migrations/001_phase1_schema.sql:122
15. **t_purchase_payment.id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/003_phase2_schema.sql:216 ; docs/init_database.sql:1009(有效)
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:9
   - 需改：docs/migrations/008_phase6_schema.sql:9
16. **t_purchase_payment.payment_no** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/003_phase2_schema.sql:217 ; docs/init_database.sql:1011(有效)
   - 变体 `VARCHAR(30)`：docs/migrations/008_phase6_schema.sql:10
   - 需改：docs/migrations/008_phase6_schema.sql:10
17. **t_purchase_payment.supplier_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT UNSIGNED`：docs/migrations/003_phase2_schema.sql:218 ; docs/init_database.sql:1012(有效)
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:12
   - 需改：docs/migrations/008_phase6_schema.sql:12
18. **t_purchase_payment.bank_account** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/003_phase2_schema.sql:225 ; docs/init_database.sql:1019(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/008_phase6_schema.sql:15
   - 需改：docs/migrations/008_phase6_schema.sql:15
19. **t_purchase_payment.status** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(32)`：docs/migrations/003_phase2_schema.sql:231 ; docs/init_database.sql:1025(有效)
   - 变体 `ENUM('PENDING','APPROVED','PAID','CANCELLED')`：docs/migrations/008_phase6_schema.sql:17
   - 需改：docs/migrations/008_phase6_schema.sql:17
20. **t_purchase_payment.remark** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/003_phase2_schema.sql:232 ; docs/init_database.sql:1026(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/008_phase6_schema.sql:16
   - 需改：docs/migrations/008_phase6_schema.sql:16
21. **t_price_level.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:18
   - 变体 `INT UNSIGNED`：docs/init_database.sql:201(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:18
22. **t_sku_price.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:33
   - 变体 `INT UNSIGNED`：docs/init_database.sql:479(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:33
23. **t_customer_price_binding.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:53
   - 变体 `INT UNSIGNED`：docs/init_database.sql:504(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:53
24. **t_price_change_log.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:70
   - 变体 `BIGINT`：docs/migrations/020_migrate_v3_payment_miniapp.sql:181
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1441(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:70 ; docs/migrations/020_migrate_v3_payment_miniapp.sql:181
25. **t_price_change_log.old_price** → `DECIMAL(12,2)`（运行期真值 = 变体「DECIMAL(12,2)」）
   - 变体 `DECIMAL(12,2)`：docs/migrations/006_phase4_schema.sql:73 ; docs/init_database.sql:1445(有效)
   - 变体 `DECIMAL(10,2)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:184
   - 需改：docs/migrations/020_migrate_v3_payment_miniapp.sql:184
26. **t_price_change_log.new_price** → `DECIMAL(12,2)`（运行期真值 = 变体「DECIMAL(12,2)」）
   - 变体 `DECIMAL(12,2)`：docs/migrations/006_phase4_schema.sql:74 ; docs/init_database.sql:1446(有效)
   - 变体 `DECIMAL(10,2)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:185
   - 需改：docs/migrations/020_migrate_v3_payment_miniapp.sql:185
27. **t_price_change_log.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(64)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:182
   - 变体 `VARCHAR(36)`：docs/init_database.sql:1442(有效)
   - 需改：docs/migrations/020_migrate_v3_payment_miniapp.sql:182
28. **t_customer_credit.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:97
   - 变体 `INT UNSIGNED`：docs/init_database.sql:526(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:97
29. **t_credit_operation_log.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:120
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1459(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:120
30. **t_collection_record.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:137
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1480(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:137
31. **t_trace_config.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:162
   - 变体 `INT UNSIGNED`：docs/init_database.sql:263(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:162
32. **t_trace_code.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:182
   - 变体 `INT UNSIGNED`：docs/init_database.sql:603(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:182
33. **t_trace_event_log.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:215
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1568(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:215
34. **t_trace_scan_log.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:236
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1594(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:236
35. **t_recall_record.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/006_phase4_schema.sql:248
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1611(有效)
   - 需改：docs/migrations/006_phase4_schema.sql:248
36. **t_inventory_batch.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/007_phase5_schema.sql:18
   - 变体 `INT UNSIGNED`：docs/init_database.sql:577(有效)
   - 需改：docs/migrations/007_phase5_schema.sql:18
37. **t_expiry_alert_config.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/007_phase5_schema.sql:40
   - 变体 `INT UNSIGNED`：docs/init_database.sql:244(有效)
   - 需改：docs/migrations/007_phase5_schema.sql:40
38. **t_expiry_alert_record.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/007_phase5_schema.sql:61
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1539(有效)
   - 需改：docs/migrations/007_phase5_schema.sql:61
39. **t_store_control_config.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/007_phase5_schema.sql:87 ; backend/src/shared/migration.ts:792
   - 变体 `INT UNSIGNED`：docs/init_database.sql:289(有效)
   - 需改：docs/migrations/007_phase5_schema.sql:87 ; backend/src/shared/migration.ts:792
40. **t_store_control_config.max_order_amount** → `DECIMAL(10,2)`（运行期真值 = 变体「DECIMAL(10,2)」）
   - 变体 `DECIMAL(10,2)`：docs/migrations/007_phase5_schema.sql:92 ; docs/init_database.sql:295(有效)
   - 变体 `DECIMAL(12,2)`：backend/src/shared/migration.ts:797
   - 需改：backend/src/shared/migration.ts:797
41. **t_store_control_config.suspended_reason** → `VARCHAR(500)`（运行期真值 = 变体「VARCHAR(500)」）
   - 变体 `VARCHAR(500)`：docs/migrations/007_phase5_schema.sql:93 ; docs/init_database.sql:296(有效)
   - 变体 `VARCHAR(255)`：backend/src/shared/migration.ts:798
   - 需改：backend/src/shared/migration.ts:798
42. **t_store_status_log.id** → `INT UNSIGNED`（运行期真值 = 变体「INT UNSIGNED」）
   - 变体 `INT`：docs/migrations/007_phase5_schema.sql:102
   - 变体 `INT UNSIGNED`：docs/init_database.sql:1637(有效)
   - 需改：docs/migrations/007_phase5_schema.sql:102
43. **t_supplier_statement.id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:31
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1042(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:31
44. **t_supplier_statement.supplier_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:33
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1045(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:33
45. **t_supplier_statement_item.id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:53
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1070(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:53
46. **t_supplier_statement_item.statement_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:54
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1072(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:54
47. **t_supplier_statement_item.purchase_order_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:55
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1073(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:55
48. **t_notification.id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:95
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1321(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:95
49. **t_notification.recipient_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/008_phase6_schema.sql:96
   - 变体 `BIGINT UNSIGNED`：docs/init_database.sql:1323(有效)
   - 需改：docs/migrations/008_phase6_schema.sql:96
50. **t_tenant.status** → `TINYINT`（运行期真值 = 变体「TINYINT」）
   - 变体 `TINYINT`：docs/migrations/016_phase9_tenant_subscription.sql:27 ; docs/migrations/092_租户ID.sql:84 ; backend/src/shared/migration.ts:550(有效)
   - 变体 `VARCHAR(16)`：docs/migrations/029_add_tenant.sql:19
   - 需改：docs/migrations/029_add_tenant.sql:19
51. **t_subscription.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(36)`：docs/migrations/016_phase9_tenant_subscription.sql:72(有效) ; docs/migrations/031_add_subscription.sql:5
   - 变体 `VARCHAR(64)`：docs/migrations/120d_fix_server_3bugs.sql:91
   - 需改：docs/migrations/120d_fix_server_3bugs.sql:91
52. **t_tenant_admin.user_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `INT`：docs/migrations/016_phase9_tenant_subscription.sql:153(有效) ; docs/migrations/034_add_tenant_admin.sql:5
   - 变体 `BIGINT UNSIGNED`：docs/migrations/192_租户建租户与归因落点补列.sql:27
   - 需改：docs/migrations/016_phase9_tenant_subscription.sql:153(有效) ; docs/migrations/034_add_tenant_admin.sql:5
53. **t_retail_shop_config.shop_name** → `VARCHAR(128)`（运行期真值 = 变体「VARCHAR(128)」）
   - 变体 `VARCHAR(128)`：docs/migrations/017_phase10_instant_retail.sql:12(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/074_即时零售表.sql:68
   - 需改：docs/migrations/074_即时零售表.sql:68
54. **t_retail_shop_config.shop_logo** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:13(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:69
   - 需改：docs/migrations/074_即时零售表.sql:69
55. **t_retail_shop_config.status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:25(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:80
   - 需改：docs/migrations/074_即时零售表.sql:80
56. **t_retail_shop_config.tenant_id** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(36)`：docs/migrations/017_phase10_instant_retail.sql:26(有效)
   - 变体 `VARCHAR(32)`：docs/migrations/074_即时零售表.sql:81
   - 需改：docs/migrations/017_phase10_instant_retail.sql:26(有效)
57. **t_retail_category.category_name** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/017_phase10_instant_retail.sql:37(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/074_即时零售表.sql:91
   - 需改：docs/migrations/074_即时零售表.sql:91
58. **t_retail_category.category_icon** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:38(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:92
   - 需改：docs/migrations/074_即时零售表.sql:92
59. **t_retail_category.status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:41(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:95
   - 需改：docs/migrations/074_即时零售表.sql:95
60. **t_retail_category.tenant_id** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(36)`：docs/migrations/017_phase10_instant_retail.sql:42(有效)
   - 变体 `VARCHAR(32)`：docs/migrations/074_即时零售表.sql:96
   - 需改：docs/migrations/017_phase10_instant_retail.sql:42(有效)
61. **t_retail_banner.id** → `INT`（运行期真值 = 变体「INT」）
   - 变体 `INT`：docs/migrations/017_phase10_instant_retail.sql:54(有效)
   - 变体 `BIGINT`：docs/migrations/074_即时零售表.sql:187
   - 需改：docs/migrations/074_即时零售表.sql:187
62. **t_retail_banner.banner_title** → `VARCHAR(128)`（运行期真值 = 变体「VARCHAR(128)」）
   - 变体 `VARCHAR(128)`：docs/migrations/017_phase10_instant_retail.sql:55(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/074_即时零售表.sql:188
   - 需改：docs/migrations/074_即时零售表.sql:188
63. **t_retail_banner.banner_image** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:56(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:189
   - 需改：docs/migrations/074_即时零售表.sql:189
64. **t_retail_banner.link_type** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(32)`：docs/migrations/017_phase10_instant_retail.sql:57(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:190
   - 需改：docs/migrations/074_即时零售表.sql:190
65. **t_retail_banner.link_value** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:58(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:191
   - 需改：docs/migrations/074_即时零售表.sql:191
66. **t_retail_banner.status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:60(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:193
   - 需改：docs/migrations/074_即时零售表.sql:193
67. **t_retail_banner.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(36)`：docs/migrations/017_phase10_instant_retail.sql:63(有效)
   - 变体 `VARCHAR(32)`：docs/migrations/074_即时零售表.sql:197
   - 需改：docs/migrations/074_即时零售表.sql:197
68. **t_retail_product.status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:85(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:119
   - 需改：docs/migrations/074_即时零售表.sql:119
69. **t_retail_product.tenant_id** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(36)`：docs/migrations/017_phase10_instant_retail.sql:86(有效)
   - 变体 `VARCHAR(32)`：docs/migrations/074_即时零售表.sql:120
   - 需改：docs/migrations/017_phase10_instant_retail.sql:86(有效)
70. **t_retail_order.delivery_type** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:110(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:140
   - 需改：docs/migrations/074_即时零售表.sql:140
71. **t_retail_order.delivery_address** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:111(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:141
   - 需改：docs/migrations/074_即时零售表.sql:141
72. **t_retail_order.receiver_name** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/017_phase10_instant_retail.sql:113(有效)
   - 变体 `VARCHAR(50)`：docs/migrations/074_即时零售表.sql:142
   - 需改：docs/migrations/074_即时零售表.sql:142
73. **t_retail_order.receiver_latitude** → `DECIMAL(10,6)`（运行期真值 = 变体「DECIMAL(10,6)」）
   - 变体 `DECIMAL(10,6)`：docs/migrations/017_phase10_instant_retail.sql:115(有效)
   - 变体 `DECIMAL(10,7)`：docs/migrations/074_即时零售表.sql:144
   - 需改：docs/migrations/074_即时零售表.sql:144
74. **t_retail_order.receiver_longitude** → `DECIMAL(10,6)`（运行期真值 = 变体「DECIMAL(10,6)」）
   - 变体 `DECIMAL(10,6)`：docs/migrations/017_phase10_instant_retail.sql:116(有效)
   - 变体 `DECIMAL(10,7)`：docs/migrations/074_即时零售表.sql:145
   - 需改：docs/migrations/074_即时零售表.sql:145
75. **t_retail_order.payment_status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:118(有效)
   - 变体 `VARCHAR(20)`：docs/migrations/074_即时零售表.sql:147
   - 需改：docs/migrations/074_即时零售表.sql:147
76. **t_retail_order.payment_method** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(32)`：docs/migrations/017_phase10_instant_retail.sql:119(有效)
   - 变体 `VARCHAR(30)`：docs/migrations/074_即时零售表.sql:148
   - 需改：docs/migrations/074_即时零售表.sql:148
77. **t_retail_order.transaction_no** → `VARCHAR(128)`（运行期真值 = 变体「VARCHAR(128)」）
   - 变体 `VARCHAR(128)`：docs/migrations/017_phase10_instant_retail.sql:121(有效)
   - 变体 `VARCHAR(64)`：docs/migrations/074_即时零售表.sql:150
   - 需改：docs/migrations/074_即时零售表.sql:150
78. **t_retail_order.order_status** → `VARCHAR(16)`（运行期真值 = 变体「VARCHAR(16)」）
   - 变体 `VARCHAR(16)`：docs/migrations/017_phase10_instant_retail.sql:122(有效)
   - 变体 `VARCHAR(30)`：docs/migrations/074_即时零售表.sql:151
   - 需改：docs/migrations/074_即时零售表.sql:151
79. **t_retail_order.cancel_reason** → `VARCHAR(255)`（运行期真值 = 变体「VARCHAR(255)」）
   - 变体 `VARCHAR(255)`：docs/migrations/017_phase10_instant_retail.sql:123(有效)
   - 变体 `VARCHAR(500)`：docs/migrations/074_即时零售表.sql:152
   - 需改：docs/migrations/074_即时零售表.sql:152
80. **t_retail_order.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(36)`：docs/migrations/017_phase10_instant_retail.sql:126(有效)
   - 变体 `VARCHAR(32)`：docs/migrations/074_即时零售表.sql:155
   - 需改：docs/migrations/074_即时零售表.sql:155
81. **t_bank_account.bank_name** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:52(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/068_银行费用发票.sql:5
   - 需改：docs/migrations/068_银行费用发票.sql:5
82. **t_bank_account.account_name** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:54(有效)
   - 变体 `VARCHAR(100)`：docs/migrations/068_银行费用发票.sql:4
   - 需改：docs/migrations/068_银行费用发票.sql:4
83. **t_bank_account.account_no** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/020_migrate_v3_payment_miniapp.sql:55(有效)
   - 变体 `VARCHAR(50)`：docs/migrations/068_银行费用发票.sql:6
   - 需改：docs/migrations/068_银行费用发票.sql:6
84. **t_brand.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(64)`：docs/migrations/070_品牌表.sql:11
   - 变体 `VARCHAR(36)`：backend/src/shared/migration.ts:838(有效)
   - 需改：docs/migrations/070_品牌表.sql:11
85. **t_points_record.id** → `BIGINT`（运行期真值 = 变体「BIGINT」）
   - 变体 `BIGINT`：docs/migrations/071_客户积分.sql:17(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:14
   - 变体 `BIGINT UNSIGNED`：docs/migrations/108_miniapp_member_wholesale.sql:28
   - 需改：docs/migrations/108_miniapp_member_wholesale.sql:28
86. **t_points_record.type** → `VARCHAR(20)`（运行期真值 = 变体「VARCHAR(20)」）
   - 变体 `VARCHAR(20)`：docs/migrations/071_客户积分.sql:20(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:17
   - 变体 `VARCHAR(16)`：docs/migrations/108_miniapp_member_wholesale.sql:30
   - 需改：docs/migrations/108_miniapp_member_wholesale.sql:30
87. **t_points_record.source_type** → `VARCHAR(32)`（运行期真值 = 变体「VARCHAR(32)」）
   - 变体 `VARCHAR(20)`：docs/migrations/071_客户积分.sql:23(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:20
   - 变体 `VARCHAR(32)`：docs/migrations/108_miniapp_member_wholesale.sql:33
   - 需改：docs/migrations/071_客户积分.sql:23(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:20
88. **t_points_record.remark** → `VARCHAR(200)`（运行期真值 = 变体「VARCHAR(200)」）
   - 变体 `VARCHAR(200)`：docs/migrations/071_客户积分.sql:25(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:22
   - 变体 `VARCHAR(256)`：docs/migrations/108_miniapp_member_wholesale.sql:35
   - 需改：docs/migrations/108_miniapp_member_wholesale.sql:35
89. **t_points_record.tenant_id** → `VARCHAR(64)`（运行期真值 = 变体「VARCHAR(64)」）
   - 变体 `VARCHAR(64)`：docs/migrations/071_客户积分.sql:26(有效) ; docs/migrations/163_transfer_order_columns_fill.sql:23
   - 变体 `VARCHAR(36)`：docs/migrations/108_miniapp_member_wholesale.sql:36
   - 需改：docs/migrations/108_miniapp_member_wholesale.sql:36
90. **t_error_logs.id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/120d_fix_server_3bugs.sql:146
   - 变体 `BIGINT UNSIGNED`：backend/src/shared/migration.ts:1075(有效)
   - 需改：docs/migrations/120d_fix_server_3bugs.sql:146
91. **t_error_logs.user_id** → `BIGINT UNSIGNED`（运行期真值 = 变体「BIGINT UNSIGNED」）
   - 变体 `BIGINT`：docs/migrations/120d_fix_server_3bugs.sql:154
   - 变体 `BIGINT UNSIGNED`：backend/src/shared/migration.ts:1083(有效)
   - 需改：docs/migrations/120d_fix_server_3bugs.sql:154
92. **t_error_logs.tenant_id** → `VARCHAR(36)`（运行期真值 = 变体「VARCHAR(36)」）
   - 变体 `VARCHAR(64)`：docs/migrations/120d_fix_server_3bugs.sql:155
   - 变体 `VARCHAR(36)`：backend/src/shared/migration.ts:1084(有效)
   - 需改：docs/migrations/120d_fix_server_3bugs.sql:155