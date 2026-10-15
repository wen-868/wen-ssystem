# S3-212 同表多定义 ⇒ 同列异型 分歧清单（组数 = 92）

| # | 表 | 列 | 变体（类型 ⇒ 出现处） |
|---:|---|---|---|
| 1 | t_sys_user | id | `INT` ⇒ M/001_phase1_schema.sql:44 , init_database.sql:51  ｜ `INT UNSIGNED` ⇒ S/migration.ts:486(有效) |
| 2 | t_sys_user | username | `VARCHAR(64)` ⇒ M/001_phase1_schema.sql:44 , init_database.sql:51  ｜ `VARCHAR(50)` ⇒ S/migration.ts:486(有效) |
| 3 | t_sys_user | real_name | `VARCHAR(64)` ⇒ M/001_phase1_schema.sql:44 , init_database.sql:51  ｜ `VARCHAR(50)` ⇒ S/migration.ts:486(有效) |
| 4 | t_sys_user | store_id | `BIGINT UNSIGNED` ⇒ M/001_phase1_schema.sql:44  ｜ `INT` ⇒ init_database.sql:51  ｜ `INT UNSIGNED` ⇒ S/migration.ts:486(有效) |
| 5 | t_sys_role | id | `INT` ⇒ M/001_phase1_schema.sql:61 , M/008_phase6_schema.sql:66 , init_database.sql:74  ｜ `INT UNSIGNED` ⇒ S/migration.ts:509(有效) |
| 6 | t_sys_role | role_code | `VARCHAR(64)` ⇒ M/001_phase1_schema.sql:61 , init_database.sql:74  ｜ `VARCHAR(50)` ⇒ M/008_phase6_schema.sql:66 , S/migration.ts:509(有效) |
| 7 | t_sys_role | role_name | `VARCHAR(64)` ⇒ M/001_phase1_schema.sql:61 , init_database.sql:74  ｜ `VARCHAR(50)` ⇒ M/008_phase6_schema.sql:66 , S/migration.ts:509(有效) |
| 8 | t_sys_role | data_scope | `VARCHAR(32)` ⇒ M/001_phase1_schema.sql:61 , init_database.sql:74  ｜ `ENUM('ALL','DEPARTMENT','STORE','SELF')` ⇒ M/008_phase6_schema.sql:66 |
| 9 | t_sys_role | status | `VARCHAR(16)` ⇒ M/001_phase1_schema.sql:61 , M/008_phase6_schema.sql:66 , init_database.sql:74  ｜ `VARCHAR(20)` ⇒ S/migration.ts:509(有效) |
| 10 | t_sys_role | description | `VARCHAR(200)` ⇒ M/008_phase6_schema.sql:66 , init_database.sql:74  ｜ `VARCHAR(255)` ⇒ S/migration.ts:509(有效) |
| 11 | t_sys_user_role | id | `BIGINT UNSIGNED` ⇒ M/001_phase1_schema.sql:89 , init_database.sql:311  ｜ `BIGINT` ⇒ M/008_phase6_schema.sql:81  ｜ `INT UNSIGNED` ⇒ S/migration.ts:525(有效) |
| 12 | t_sys_user_role | user_id | `BIGINT UNSIGNED` ⇒ M/001_phase1_schema.sql:89 , init_database.sql:311  ｜ `BIGINT` ⇒ M/008_phase6_schema.sql:81  ｜ `INT UNSIGNED` ⇒ S/migration.ts:525(有效) |
| 13 | t_sys_user_role | role_id | `BIGINT UNSIGNED` ⇒ M/001_phase1_schema.sql:89 , init_database.sql:311  ｜ `BIGINT` ⇒ M/008_phase6_schema.sql:81  ｜ `INT UNSIGNED` ⇒ S/migration.ts:525(有效) |
| 14 | t_store | status | `TINYINT` ⇒ M/001_phase1_schema.sql:109  ｜ `VARCHAR(20)` ⇒ init_database.sql:117(有效) |
| 15 | t_purchase_payment | id | `BIGINT UNSIGNED` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `BIGINT` ⇒ M/008_phase6_schema.sql:8 |
| 16 | t_purchase_payment | payment_no | `VARCHAR(64)` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `VARCHAR(30)` ⇒ M/008_phase6_schema.sql:8 |
| 17 | t_purchase_payment | supplier_id | `BIGINT UNSIGNED` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `BIGINT` ⇒ M/008_phase6_schema.sql:8 |
| 18 | t_purchase_payment | bank_account | `VARCHAR(64)` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `VARCHAR(100)` ⇒ M/008_phase6_schema.sql:8 |
| 19 | t_purchase_payment | status | `VARCHAR(32)` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `ENUM('PENDING','APPROVED','PAID','CANCELLED')` ⇒ M/008_phase6_schema.sql:8 |
| 20 | t_purchase_payment | remark | `VARCHAR(255)` ⇒ M/003_phase2_schema.sql:215 , init_database.sql:1008(有效)  ｜ `VARCHAR(500)` ⇒ M/008_phase6_schema.sql:8 |
| 21 | t_price_level | id | `INT` ⇒ M/006_phase4_schema.sql:17  ｜ `INT UNSIGNED` ⇒ init_database.sql:200(有效) |
| 22 | t_sku_price | id | `INT` ⇒ M/006_phase4_schema.sql:32  ｜ `INT UNSIGNED` ⇒ init_database.sql:478(有效) |
| 23 | t_customer_price_binding | id | `INT` ⇒ M/006_phase4_schema.sql:52  ｜ `INT UNSIGNED` ⇒ init_database.sql:503(有效) |
| 24 | t_price_change_log | id | `INT` ⇒ M/006_phase4_schema.sql:69  ｜ `BIGINT` ⇒ M/020_migrate_v3_payment_miniapp.sql:180  ｜ `INT UNSIGNED` ⇒ init_database.sql:1440(有效) |
| 25 | t_price_change_log | old_price | `DECIMAL(12,2)` ⇒ M/006_phase4_schema.sql:69 , init_database.sql:1440(有效)  ｜ `DECIMAL(10,2)` ⇒ M/020_migrate_v3_payment_miniapp.sql:180 |
| 26 | t_price_change_log | new_price | `DECIMAL(12,2)` ⇒ M/006_phase4_schema.sql:69 , init_database.sql:1440(有效)  ｜ `DECIMAL(10,2)` ⇒ M/020_migrate_v3_payment_miniapp.sql:180 |
| 27 | t_price_change_log | tenant_id | `VARCHAR(64)` ⇒ M/020_migrate_v3_payment_miniapp.sql:180  ｜ `VARCHAR(36)` ⇒ init_database.sql:1440(有效) |
| 28 | t_customer_credit | id | `INT` ⇒ M/006_phase4_schema.sql:96  ｜ `INT UNSIGNED` ⇒ init_database.sql:525(有效) |
| 29 | t_credit_operation_log | id | `INT` ⇒ M/006_phase4_schema.sql:119  ｜ `INT UNSIGNED` ⇒ init_database.sql:1458(有效) |
| 30 | t_collection_record | id | `INT` ⇒ M/006_phase4_schema.sql:136  ｜ `INT UNSIGNED` ⇒ init_database.sql:1479(有效) |
| 31 | t_trace_config | id | `INT` ⇒ M/006_phase4_schema.sql:161  ｜ `INT UNSIGNED` ⇒ init_database.sql:262(有效) |
| 32 | t_trace_code | id | `INT` ⇒ M/006_phase4_schema.sql:181  ｜ `INT UNSIGNED` ⇒ init_database.sql:602(有效) |
| 33 | t_trace_event_log | id | `INT` ⇒ M/006_phase4_schema.sql:214  ｜ `INT UNSIGNED` ⇒ init_database.sql:1567(有效) |
| 34 | t_trace_scan_log | id | `INT` ⇒ M/006_phase4_schema.sql:235  ｜ `INT UNSIGNED` ⇒ init_database.sql:1593(有效) |
| 35 | t_recall_record | id | `INT` ⇒ M/006_phase4_schema.sql:247  ｜ `INT UNSIGNED` ⇒ init_database.sql:1610(有效) |
| 36 | t_inventory_batch | id | `INT` ⇒ M/007_phase5_schema.sql:17  ｜ `INT UNSIGNED` ⇒ init_database.sql:576(有效) |
| 37 | t_expiry_alert_config | id | `INT` ⇒ M/007_phase5_schema.sql:39  ｜ `INT UNSIGNED` ⇒ init_database.sql:243(有效) |
| 38 | t_expiry_alert_record | id | `INT` ⇒ M/007_phase5_schema.sql:60  ｜ `INT UNSIGNED` ⇒ init_database.sql:1538(有效) |
| 39 | t_store_control_config | id | `INT` ⇒ M/007_phase5_schema.sql:86 , S/migration.ts:791(有效)  ｜ `INT UNSIGNED` ⇒ init_database.sql:288 |
| 40 | t_store_control_config | max_order_amount | `DECIMAL(10,2)` ⇒ M/007_phase5_schema.sql:86 , init_database.sql:288  ｜ `DECIMAL(12,2)` ⇒ S/migration.ts:791(有效) |
| 41 | t_store_control_config | suspended_reason | `VARCHAR(500)` ⇒ M/007_phase5_schema.sql:86 , init_database.sql:288  ｜ `VARCHAR(255)` ⇒ S/migration.ts:791(有效) |
| 42 | t_store_status_log | id | `INT` ⇒ M/007_phase5_schema.sql:101  ｜ `INT UNSIGNED` ⇒ init_database.sql:1636(有效) |
| 43 | t_supplier_statement | id | `BIGINT` ⇒ M/008_phase6_schema.sql:30  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1041(有效) |
| 44 | t_supplier_statement | supplier_id | `BIGINT` ⇒ M/008_phase6_schema.sql:30  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1041(有效) |
| 45 | t_supplier_statement_item | id | `BIGINT` ⇒ M/008_phase6_schema.sql:52  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1069(有效) |
| 46 | t_supplier_statement_item | statement_id | `BIGINT` ⇒ M/008_phase6_schema.sql:52  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1069(有效) |
| 47 | t_supplier_statement_item | purchase_order_id | `BIGINT` ⇒ M/008_phase6_schema.sql:52  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1069(有效) |
| 48 | t_notification | id | `BIGINT` ⇒ M/008_phase6_schema.sql:94  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1320(有效) |
| 49 | t_notification | recipient_id | `BIGINT` ⇒ M/008_phase6_schema.sql:94  ｜ `BIGINT UNSIGNED` ⇒ init_database.sql:1320(有效) |
| 50 | t_tenant | status | `TINYINT` ⇒ M/016_phase9_tenant_subscription.sql:10 , M/092_租户ID.sql:78 , S/migration.ts:544(有效)  ｜ `VARCHAR(16)` ⇒ M/029_add_tenant.sql:2 |
| 51 | t_subscription | tenant_id | `VARCHAR(36)` ⇒ M/016_phase9_tenant_subscription.sql:69(有效) , M/031_add_subscription.sql:2  ｜ `VARCHAR(64)` ⇒ M/120d_fix_server_3bugs.sql:88 |
| 52 | t_tenant_admin | user_id | `INT` ⇒ M/016_phase9_tenant_subscription.sql:150(有效) , M/034_add_tenant_admin.sql:2  ｜ `BIGINT UNSIGNED` ⇒ M/192_租户建租户与归因落点补列.sql:24 |
| 53 | t_retail_shop_config | shop_name | `VARCHAR(128)` ⇒ M/017_phase10_instant_retail.sql:10(有效)  ｜ `VARCHAR(100)` ⇒ M/074_即时零售表.sql:65 |
| 54 | t_retail_shop_config | shop_logo | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:10(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:65 |
| 55 | t_retail_shop_config | status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:10(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:65 |
| 56 | t_retail_shop_config | tenant_id | `VARCHAR(36)` ⇒ M/017_phase10_instant_retail.sql:10(有效)  ｜ `VARCHAR(32)` ⇒ M/074_即时零售表.sql:65 |
| 57 | t_retail_category | category_name | `VARCHAR(64)` ⇒ M/017_phase10_instant_retail.sql:35(有效)  ｜ `VARCHAR(100)` ⇒ M/074_即时零售表.sql:89 |
| 58 | t_retail_category | category_icon | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:35(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:89 |
| 59 | t_retail_category | status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:35(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:89 |
| 60 | t_retail_category | tenant_id | `VARCHAR(36)` ⇒ M/017_phase10_instant_retail.sql:35(有效)  ｜ `VARCHAR(32)` ⇒ M/074_即时零售表.sql:89 |
| 61 | t_retail_banner | id | `INT` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `BIGINT` ⇒ M/074_即时零售表.sql:186 |
| 62 | t_retail_banner | banner_title | `VARCHAR(128)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(100)` ⇒ M/074_即时零售表.sql:186 |
| 63 | t_retail_banner | banner_image | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:186 |
| 64 | t_retail_banner | link_type | `VARCHAR(32)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:186 |
| 65 | t_retail_banner | link_value | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:186 |
| 66 | t_retail_banner | status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:186 |
| 67 | t_retail_banner | tenant_id | `VARCHAR(36)` ⇒ M/017_phase10_instant_retail.sql:53(有效)  ｜ `VARCHAR(32)` ⇒ M/074_即时零售表.sql:186 |
| 68 | t_retail_product | status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:73(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:106 |
| 69 | t_retail_product | tenant_id | `VARCHAR(36)` ⇒ M/017_phase10_instant_retail.sql:73(有效)  ｜ `VARCHAR(32)` ⇒ M/074_即时零售表.sql:106 |
| 70 | t_retail_order | delivery_type | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:131 |
| 71 | t_retail_order | delivery_address | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:131 |
| 72 | t_retail_order | receiver_name | `VARCHAR(64)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(50)` ⇒ M/074_即时零售表.sql:131 |
| 73 | t_retail_order | receiver_latitude | `DECIMAL(10,6)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `DECIMAL(10,7)` ⇒ M/074_即时零售表.sql:131 |
| 74 | t_retail_order | receiver_longitude | `DECIMAL(10,6)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `DECIMAL(10,7)` ⇒ M/074_即时零售表.sql:131 |
| 75 | t_retail_order | payment_status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(20)` ⇒ M/074_即时零售表.sql:131 |
| 76 | t_retail_order | payment_method | `VARCHAR(32)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(30)` ⇒ M/074_即时零售表.sql:131 |
| 77 | t_retail_order | transaction_no | `VARCHAR(128)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(64)` ⇒ M/074_即时零售表.sql:131 |
| 78 | t_retail_order | order_status | `VARCHAR(16)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(30)` ⇒ M/074_即时零售表.sql:131 |
| 79 | t_retail_order | cancel_reason | `VARCHAR(255)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(500)` ⇒ M/074_即时零售表.sql:131 |
| 80 | t_retail_order | tenant_id | `VARCHAR(36)` ⇒ M/017_phase10_instant_retail.sql:100(有效)  ｜ `VARCHAR(32)` ⇒ M/074_即时零售表.sql:131 |
| 81 | t_bank_account | bank_name | `VARCHAR(64)` ⇒ M/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜ `VARCHAR(100)` ⇒ M/068_银行费用发票.sql:2 |
| 82 | t_bank_account | account_name | `VARCHAR(64)` ⇒ M/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜ `VARCHAR(100)` ⇒ M/068_银行费用发票.sql:2 |
| 83 | t_bank_account | account_no | `VARCHAR(64)` ⇒ M/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜ `VARCHAR(50)` ⇒ M/068_银行费用发票.sql:2 |
| 84 | t_brand | tenant_id | `VARCHAR(64)` ⇒ M/070_品牌表.sql:4  ｜ `VARCHAR(36)` ⇒ S/migration.ts:831(有效) |
| 85 | t_points_record | id | `BIGINT` ⇒ M/071_客户积分.sql:16(有效) , M/163_transfer_order_columns_fill.sql:13  ｜ `BIGINT UNSIGNED` ⇒ M/108_miniapp_member_wholesale.sql:27 |
| 86 | t_points_record | type | `VARCHAR(20)` ⇒ M/071_客户积分.sql:16(有效) , M/163_transfer_order_columns_fill.sql:13  ｜ `VARCHAR(16)` ⇒ M/108_miniapp_member_wholesale.sql:27 |
| 87 | t_points_record | source_type | `VARCHAR(20)` ⇒ M/071_客户积分.sql:16(有效) , M/163_transfer_order_columns_fill.sql:13  ｜ `VARCHAR(32)` ⇒ M/108_miniapp_member_wholesale.sql:27 |
| 88 | t_points_record | remark | `VARCHAR(200)` ⇒ M/071_客户积分.sql:16(有效) , M/163_transfer_order_columns_fill.sql:13  ｜ `VARCHAR(256)` ⇒ M/108_miniapp_member_wholesale.sql:27 |
| 89 | t_points_record | tenant_id | `VARCHAR(64)` ⇒ M/071_客户积分.sql:16(有效) , M/163_transfer_order_columns_fill.sql:13  ｜ `VARCHAR(36)` ⇒ M/108_miniapp_member_wholesale.sql:27 |
| 90 | t_error_logs | id | `BIGINT` ⇒ M/120d_fix_server_3bugs.sql:145  ｜ `BIGINT UNSIGNED` ⇒ S/migration.ts:1074(有效) |
| 91 | t_error_logs | user_id | `BIGINT` ⇒ M/120d_fix_server_3bugs.sql:145  ｜ `BIGINT UNSIGNED` ⇒ S/migration.ts:1074(有效) |
| 92 | t_error_logs | tenant_id | `VARCHAR(64)` ⇒ M/120d_fix_server_3bugs.sql:145  ｜ `VARCHAR(36)` ⇒ S/migration.ts:1074(有效) |

## 涉及分歧的表：有效定义块（按 runner 顺序最靠前的那一块）

- t_sys_user ← S/migration.ts:486（order=0）
- t_sys_role ← S/migration.ts:509（order=0）
- t_sys_user_role ← S/migration.ts:525（order=0）
- t_store ← init_database.sql:117（order=1）
- t_purchase_payment ← init_database.sql:1008（order=1）
- t_price_level ← init_database.sql:200（order=1）
- t_sku_price ← init_database.sql:478（order=1）
- t_customer_price_binding ← init_database.sql:503（order=1）
- t_price_change_log ← init_database.sql:1440（order=1）
- t_customer_credit ← init_database.sql:525（order=1）
- t_credit_operation_log ← init_database.sql:1458（order=1）
- t_collection_record ← init_database.sql:1479（order=1）
- t_trace_config ← init_database.sql:262（order=1）
- t_trace_code ← init_database.sql:602（order=1）
- t_trace_event_log ← init_database.sql:1567（order=1）
- t_trace_scan_log ← init_database.sql:1593（order=1）
- t_recall_record ← init_database.sql:1610（order=1）
- t_inventory_batch ← init_database.sql:576（order=1）
- t_expiry_alert_config ← init_database.sql:243（order=1）
- t_expiry_alert_record ← init_database.sql:1538（order=1）
- t_store_control_config ← S/migration.ts:791（order=0）
- t_store_status_log ← init_database.sql:1636（order=1）
- t_supplier_statement ← init_database.sql:1041（order=1）
- t_supplier_statement_item ← init_database.sql:1069（order=1）
- t_notification ← init_database.sql:1320（order=1）
- t_tenant ← S/migration.ts:544（order=0）
- t_subscription ← M/016_phase9_tenant_subscription.sql:69（order=115）
- t_tenant_admin ← M/016_phase9_tenant_subscription.sql:150（order=115）
- t_retail_shop_config ← M/017_phase10_instant_retail.sql:10（order=116）
- t_retail_category ← M/017_phase10_instant_retail.sql:35（order=116）
- t_retail_banner ← M/017_phase10_instant_retail.sql:53（order=116）
- t_retail_product ← M/017_phase10_instant_retail.sql:73（order=116）
- t_retail_order ← M/017_phase10_instant_retail.sql:100（order=116）
- t_bank_account ← M/020_migrate_v3_payment_miniapp.sql:49（order=119）
- t_brand ← S/migration.ts:831（order=0）
- t_points_record ← M/071_客户积分.sql:16（order=162）
- t_error_logs ← S/migration.ts:1074（order=0）