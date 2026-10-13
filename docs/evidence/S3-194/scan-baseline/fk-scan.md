# S3-194 全语料外键一致性扫描（装置 fk-scan.mjs v2，只读）

- repo: D:\Users\ZXQL\wt-agents\S3-194
- 扫描源: 200 个（docs/migrations/*.sql 198 个 + docs/init_database.sql + backend/src/shared/migration.ts）
- CREATE TABLE 块: 429 处；归一后表: 313 张
- FOREIGN KEY 声明: 28 条；判定分布: {"incompatible":9,"compatible":19}
- 红候选（有效定义，运行时必报 errno 3780）: **4 条**
- 红候选（非有效块，前序建表失败后才执行）: 5 条

## 一、红候选 · 有效定义（4 条）

| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |
|---|---|---|---|---|---|---|
| docs/migrations/016_phase9_tenant_subscription.sql:107 | t_tenant_module_access.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | INT | VARCHAR(36) | incompatible | 类型不一致 INT vs VARCHAR(36) |
| docs/migrations/016_phase9_tenant_subscription.sql:150 | t_tenant_admin.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | INT | VARCHAR(36) | incompatible | 类型不一致 INT vs VARCHAR(36) |
| docs/migrations/017_phase10_instant_retail.sql:139 | t_retail_order_item.order_id | t_retail_order.id (父定义 docs/migrations/017_phase10_instant_retail.sql:100) | INT | BIGINT | incompatible | 类型不一致 INT vs BIGINT |
| docs/migrations/017_phase10_instant_retail.sql:174 | t_delivery_record.order_id | t_retail_order.id (父定义 docs/migrations/017_phase10_instant_retail.sql:100) | INT | BIGINT | incompatible | 类型不一致 INT vs BIGINT |

## 二、红候选 · 非有效块（前序建表失败后本块会执行 ⇒ 运行时同样报红）（5 条）

| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |
|---|---|---|---|---|---|---|
| docs/migrations/008_phase6_schema.sql:52 | t_supplier_statement_item.statement_id | t_supplier_statement.id (父定义 docs/init_database.sql:1041) | BIGINT | BIGINT | incompatible | 有符号性不一致 UNSIGNED=false vs true |
| docs/migrations/008_phase6_schema.sql:81 | t_sys_user_role.user_id | t_sys_user.id (父定义 backend/src/shared/migration.ts:475) | BIGINT | INT | incompatible | 类型不一致 BIGINT vs INT |
| docs/migrations/008_phase6_schema.sql:81 | t_sys_user_role.role_id | t_sys_role.id (父定义 backend/src/shared/migration.ts:498) | BIGINT | INT | incompatible | 类型不一致 BIGINT vs INT |
| docs/migrations/032_add_tenant_module_access.sql:2 | t_tenant_module_access.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | INT | VARCHAR(36) | incompatible | 类型不一致 INT vs VARCHAR(36) |
| docs/migrations/034_add_tenant_admin.sql:2 | t_tenant_admin.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | INT | VARCHAR(36) | incompatible | 类型不一致 INT vs VARCHAR(36) |

## 三、判定 compatible 的外键（19 条）

| 文件:行 | 引用列 | 被引用列 | 引用列类型 | 被引用列类型 | 判定 | 说明 |
|---|---|---|---|---|---|---|
| docs/migrations/016_phase9_tenant_subscription.sql:69 | t_subscription.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | VARCHAR(36) | VARCHAR(36) | compatible | 字符串列同型同序 VARCHAR(36) / utf8mb4_0900_ai_ci |
| docs/migrations/016_phase9_tenant_subscription.sql:69 | t_subscription.plan_id | t_subscription_plan.id (父定义 docs/migrations/016_phase9_tenant_subscription.sql:42) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/016_phase9_tenant_subscription.sql:128 | t_subscription_operation_log.subscription_id | t_subscription.id (父定义 docs/migrations/016_phase9_tenant_subscription.sql:69) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/018_phase10_marketing.sql:104 | t_full_reduction_rule.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/018_phase10_marketing.sql:118 | t_seckill_product.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/018_phase10_marketing.sql:136 | t_group_buy_activity.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/018_phase10_marketing.sql:175 | t_group_buy_participant.group_id | t_group_buy_record.id (父定义 docs/migrations/018_phase10_marketing.sql:151) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/031_add_subscription.sql:2 | t_subscription.tenant_id | t_tenant.id (父定义 backend/src/shared/migration.ts:533) | VARCHAR(36) | VARCHAR(36) | compatible | 字符串列同型同序 VARCHAR(36) / utf8mb4_0900_ai_ci |
| docs/migrations/031_add_subscription.sql:2 | t_subscription.plan_id | t_subscription_plan.id (父定义 docs/migrations/016_phase9_tenant_subscription.sql:42) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/033_add_subscription_operation_log.sql:2 | t_subscription_operation_log.subscription_id | t_subscription.id (父定义 docs/migrations/016_phase9_tenant_subscription.sql:69) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/038_add_full_reduction_rule.sql:2 | t_full_reduction_rule.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/039_add_seckill_product.sql:2 | t_seckill_product.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/040_add_group_buy_activity.sql:2 | t_group_buy_activity.activity_id | t_promotion_activity.id (父定义 docs/migrations/018_phase10_marketing.sql:75) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/042_add_group_buy_participant.sql:2 | t_group_buy_participant.group_id | t_group_buy_record.id (父定义 docs/migrations/018_phase10_marketing.sql:151) | INT | INT | compatible | 数值列同型 INT |
| docs/migrations/067_add_unit_group.sql:14 | t_unit_group_item.group_id | t_unit_group.id (父定义 docs/migrations/067_add_unit_group.sql:4) | BIGINT | BIGINT | compatible | 数值列同型 BIGINT |
| docs/migrations/074_即时零售表.sql:167 | t_retail_order_item.order_id | t_retail_order.id (父定义 docs/migrations/017_phase10_instant_retail.sql:100) | BIGINT | BIGINT | compatible | 数值列同型 BIGINT |
| docs/migrations/082_商品标签.sql:17 | t_product_tag.group_id | t_product_tag_group.id (父定义 docs/migrations/082_商品标签.sql:5) | BIGINT | BIGINT | compatible | 数值列同型 BIGINT |
| docs/migrations/082_商品标签.sql:28 | t_product_tag_relation.spu_id | t_product_spu.id (父定义 backend/src/shared/migration.ts:862) | BIGINT | BIGINT | compatible | 数值列同型 BIGINT |
| docs/migrations/082_商品标签.sql:28 | t_product_tag_relation.tag_id | t_product_tag.id (父定义 docs/migrations/082_商品标签.sql:17) | BIGINT | BIGINT | compatible | 数值列同型 BIGINT |

## 四、同表多定义 ⇒ 同列异型（跨文件一致性分歧，99 组）

| 表 | 列 | 变体 |
|---|---|---|
| t_sys_user | id | `INT` ← docs/migrations/001_phase1_schema.sql:44 / docs/init_database.sql:51  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:475(有效) |
| t_sys_user | username | `VARCHAR(64)` ← docs/migrations/001_phase1_schema.sql:44 / docs/init_database.sql:51  ｜  `VARCHAR(50)` ← backend/src/shared/migration.ts:475(有效) |
| t_sys_user | real_name | `VARCHAR(64)` ← docs/migrations/001_phase1_schema.sql:44 / docs/init_database.sql:51  ｜  `VARCHAR(50)` ← backend/src/shared/migration.ts:475(有效) |
| t_sys_user | store_id | `BIGINT UNSIGNED` ← docs/migrations/001_phase1_schema.sql:44  ｜  `INT` ← docs/init_database.sql:51  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:475(有效) |
| t_sys_role | id | `INT` ← docs/migrations/001_phase1_schema.sql:61 / docs/migrations/008_phase6_schema.sql:66 / docs/init_database.sql:74  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:498(有效) |
| t_sys_role | role_code | `VARCHAR(64)` ← docs/migrations/001_phase1_schema.sql:61 / docs/init_database.sql:74  ｜  `VARCHAR(50)` ← docs/migrations/008_phase6_schema.sql:66 / backend/src/shared/migration.ts:498(有效) |
| t_sys_role | role_name | `VARCHAR(64)` ← docs/migrations/001_phase1_schema.sql:61 / docs/init_database.sql:74  ｜  `VARCHAR(50)` ← docs/migrations/008_phase6_schema.sql:66 / backend/src/shared/migration.ts:498(有效) |
| t_sys_role | data_scope | `VARCHAR(32)` ← docs/migrations/001_phase1_schema.sql:61 / docs/init_database.sql:74  ｜  `ENUM('ALL','DEPARTMENT','STORE','SELF')` ← docs/migrations/008_phase6_schema.sql:66 |
| t_sys_role | status | `VARCHAR(16)` ← docs/migrations/001_phase1_schema.sql:61 / docs/migrations/008_phase6_schema.sql:66 / docs/init_database.sql:74  ｜  `VARCHAR(20)` ← backend/src/shared/migration.ts:498(有效) |
| t_sys_role | description | `VARCHAR(200)` ← docs/migrations/008_phase6_schema.sql:66 / docs/init_database.sql:74  ｜  `VARCHAR(255)` ← backend/src/shared/migration.ts:498(有效) |
| t_sys_user_role | id | `BIGINT UNSIGNED` ← docs/migrations/001_phase1_schema.sql:89 / docs/init_database.sql:311  ｜  `BIGINT` ← docs/migrations/008_phase6_schema.sql:81  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:514(有效) |
| t_sys_user_role | user_id | `BIGINT UNSIGNED` ← docs/migrations/001_phase1_schema.sql:89 / docs/init_database.sql:311  ｜  `BIGINT` ← docs/migrations/008_phase6_schema.sql:81  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:514(有效) |
| t_sys_user_role | role_id | `BIGINT UNSIGNED` ← docs/migrations/001_phase1_schema.sql:89 / docs/init_database.sql:311  ｜  `BIGINT` ← docs/migrations/008_phase6_schema.sql:81  ｜  `INT UNSIGNED` ← backend/src/shared/migration.ts:514(有效) |
| t_store | status | `TINYINT` ← docs/migrations/001_phase1_schema.sql:109  ｜  `VARCHAR(20)` ← docs/init_database.sql:117(有效) |
| t_purchase_payment | id | `BIGINT UNSIGNED` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `BIGINT` ← docs/migrations/008_phase6_schema.sql:8 |
| t_purchase_payment | payment_no | `VARCHAR(64)` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `VARCHAR(30)` ← docs/migrations/008_phase6_schema.sql:8 |
| t_purchase_payment | supplier_id | `BIGINT UNSIGNED` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `BIGINT` ← docs/migrations/008_phase6_schema.sql:8 |
| t_purchase_payment | bank_account | `VARCHAR(64)` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `VARCHAR(100)` ← docs/migrations/008_phase6_schema.sql:8 |
| t_purchase_payment | status | `VARCHAR(32)` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `ENUM('PENDING','APPROVED','PAID','CANCELLED')` ← docs/migrations/008_phase6_schema.sql:8 |
| t_purchase_payment | remark | `VARCHAR(255)` ← docs/migrations/003_phase2_schema.sql:215 / docs/init_database.sql:1008(有效)  ｜  `VARCHAR(500)` ← docs/migrations/008_phase6_schema.sql:8 |
| t_price_level | id | `INT` ← docs/migrations/006_phase4_schema.sql:17  ｜  `INT UNSIGNED` ← docs/init_database.sql:200(有效) |
| t_sku_price | id | `INT` ← docs/migrations/006_phase4_schema.sql:32  ｜  `INT UNSIGNED` ← docs/init_database.sql:478(有效) |
| t_customer_price_binding | id | `INT` ← docs/migrations/006_phase4_schema.sql:52  ｜  `INT UNSIGNED` ← docs/init_database.sql:503(有效) |
| t_price_change_log | id | `INT` ← docs/migrations/006_phase4_schema.sql:69  ｜  `BIGINT` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:180  ｜  `INT UNSIGNED` ← docs/init_database.sql:1440(有效) |
| t_price_change_log | old_price | `DECIMAL(12,2)` ← docs/migrations/006_phase4_schema.sql:69 / docs/init_database.sql:1440(有效)  ｜  `DECIMAL(10,2)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:180 |
| t_price_change_log | new_price | `DECIMAL(12,2)` ← docs/migrations/006_phase4_schema.sql:69 / docs/init_database.sql:1440(有效)  ｜  `DECIMAL(10,2)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:180 |
| t_price_change_log | tenant_id | `VARCHAR(64)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:180  ｜  `VARCHAR(36)` ← docs/init_database.sql:1440(有效) |
| t_customer_credit | id | `INT` ← docs/migrations/006_phase4_schema.sql:96  ｜  `INT UNSIGNED` ← docs/init_database.sql:525(有效) |
| t_credit_operation_log | id | `INT` ← docs/migrations/006_phase4_schema.sql:119  ｜  `INT UNSIGNED` ← docs/init_database.sql:1458(有效) |
| t_collection_record | id | `INT` ← docs/migrations/006_phase4_schema.sql:136  ｜  `INT UNSIGNED` ← docs/init_database.sql:1479(有效) |
| t_trace_config | id | `INT` ← docs/migrations/006_phase4_schema.sql:161  ｜  `INT UNSIGNED` ← docs/init_database.sql:262(有效) |
| t_trace_code | id | `INT` ← docs/migrations/006_phase4_schema.sql:181  ｜  `INT UNSIGNED` ← docs/init_database.sql:602(有效) |
| t_trace_event_log | id | `INT` ← docs/migrations/006_phase4_schema.sql:214  ｜  `INT UNSIGNED` ← docs/init_database.sql:1567(有效) |
| t_trace_scan_log | id | `INT` ← docs/migrations/006_phase4_schema.sql:235  ｜  `INT UNSIGNED` ← docs/init_database.sql:1593(有效) |
| t_recall_record | id | `INT` ← docs/migrations/006_phase4_schema.sql:247  ｜  `INT UNSIGNED` ← docs/init_database.sql:1610(有效) |
| t_inventory_batch | id | `INT` ← docs/migrations/007_phase5_schema.sql:17  ｜  `INT UNSIGNED` ← docs/init_database.sql:576(有效) |
| t_expiry_alert_config | id | `INT` ← docs/migrations/007_phase5_schema.sql:39  ｜  `INT UNSIGNED` ← docs/init_database.sql:243(有效) |
| t_expiry_alert_record | id | `INT` ← docs/migrations/007_phase5_schema.sql:60  ｜  `INT UNSIGNED` ← docs/init_database.sql:1538(有效) |
| t_store_control_config | id | `INT` ← docs/migrations/007_phase5_schema.sql:86 / backend/src/shared/migration.ts:781(有效)  ｜  `INT UNSIGNED` ← docs/init_database.sql:288 |
| t_store_control_config | max_order_amount | `DECIMAL(10,2)` ← docs/migrations/007_phase5_schema.sql:86 / docs/init_database.sql:288  ｜  `DECIMAL(12,2)` ← backend/src/shared/migration.ts:781(有效) |
| t_store_control_config | suspended_reason | `VARCHAR(500)` ← docs/migrations/007_phase5_schema.sql:86 / docs/init_database.sql:288  ｜  `VARCHAR(255)` ← backend/src/shared/migration.ts:781(有效) |
| t_store_status_log | id | `INT` ← docs/migrations/007_phase5_schema.sql:101  ｜  `INT UNSIGNED` ← docs/init_database.sql:1636(有效) |
| t_supplier_statement | id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:30  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1041(有效) |
| t_supplier_statement | supplier_id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:30  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1041(有效) |
| t_supplier_statement_item | id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:52  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1069(有效) |
| t_supplier_statement_item | statement_id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:52  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1069(有效) |
| t_supplier_statement_item | purchase_order_id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:52  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1069(有效) |
| t_notification | id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:94  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1320(有效) |
| t_notification | recipient_id | `BIGINT` ← docs/migrations/008_phase6_schema.sql:94  ｜  `BIGINT UNSIGNED` ← docs/init_database.sql:1320(有效) |
| t_tenant | status | `TINYINT` ← docs/migrations/016_phase9_tenant_subscription.sql:10 / docs/migrations/092_租户ID.sql:70 / backend/src/shared/migration.ts:533(有效)  ｜  `VARCHAR(16)` ← docs/migrations/029_add_tenant.sql:2 |
| t_subscription | tenant_id | `VARCHAR(36)` ← docs/migrations/016_phase9_tenant_subscription.sql:69(有效) / docs/migrations/031_add_subscription.sql:2  ｜  `VARCHAR(64)` ← docs/migrations/120d_fix_server_3bugs.sql:88 |
| t_tenant_admin | tenant_id | `INT` ← docs/migrations/016_phase9_tenant_subscription.sql:150(有效) / docs/migrations/034_add_tenant_admin.sql:2  ｜  `VARCHAR(36)` ← docs/migrations/192_租户建租户与归因落点补列.sql:24 |
| t_tenant_admin | user_id | `INT` ← docs/migrations/016_phase9_tenant_subscription.sql:150(有效) / docs/migrations/034_add_tenant_admin.sql:2  ｜  `BIGINT UNSIGNED` ← docs/migrations/192_租户建租户与归因落点补列.sql:24 |
| t_retail_shop_config | shop_name | `VARCHAR(128)` ← docs/migrations/017_phase10_instant_retail.sql:10(有效)  ｜  `VARCHAR(100)` ← docs/migrations/074_即时零售表.sql:65 |
| t_retail_shop_config | shop_logo | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:10(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:65 |
| t_retail_shop_config | status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:10(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:65 |
| t_retail_shop_config | tenant_id | `VARCHAR(36)` ← docs/migrations/017_phase10_instant_retail.sql:10(有效)  ｜  `VARCHAR(32)` ← docs/migrations/074_即时零售表.sql:65 |
| t_retail_category | category_name | `VARCHAR(64)` ← docs/migrations/017_phase10_instant_retail.sql:35(有效)  ｜  `VARCHAR(100)` ← docs/migrations/074_即时零售表.sql:89 |
| t_retail_category | category_icon | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:35(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:89 |
| t_retail_category | status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:35(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:89 |
| t_retail_category | tenant_id | `VARCHAR(36)` ← docs/migrations/017_phase10_instant_retail.sql:35(有效)  ｜  `VARCHAR(32)` ← docs/migrations/074_即时零售表.sql:89 |
| t_retail_banner | id | `INT` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `BIGINT` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | banner_title | `VARCHAR(128)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(100)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | banner_image | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | link_type | `VARCHAR(32)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | link_value | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_banner | tenant_id | `VARCHAR(36)` ← docs/migrations/017_phase10_instant_retail.sql:53(有效)  ｜  `VARCHAR(32)` ← docs/migrations/074_即时零售表.sql:186 |
| t_retail_product | status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:73(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:106 |
| t_retail_product | tenant_id | `VARCHAR(36)` ← docs/migrations/017_phase10_instant_retail.sql:73(有效)  ｜  `VARCHAR(32)` ← docs/migrations/074_即时零售表.sql:106 |
| t_retail_order | delivery_type | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | delivery_address | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | receiver_name | `VARCHAR(64)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(50)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | receiver_latitude | `DECIMAL(10,6)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `DECIMAL(10,7)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | receiver_longitude | `DECIMAL(10,6)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `DECIMAL(10,7)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | payment_status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(20)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | payment_method | `VARCHAR(32)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(30)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | transaction_no | `VARCHAR(128)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(64)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | order_status | `VARCHAR(16)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(30)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | cancel_reason | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order | tenant_id | `VARCHAR(36)` ← docs/migrations/017_phase10_instant_retail.sql:100(有效)  ｜  `VARCHAR(32)` ← docs/migrations/074_即时零售表.sql:131 |
| t_retail_order_item | id | `INT` ← docs/migrations/017_phase10_instant_retail.sql:139(有效)  ｜  `BIGINT` ← docs/migrations/074_即时零售表.sql:167 |
| t_retail_order_item | order_id | `INT` ← docs/migrations/017_phase10_instant_retail.sql:139(有效)  ｜  `BIGINT` ← docs/migrations/074_即时零售表.sql:167 |
| t_retail_order_item | product_id | `INT` ← docs/migrations/017_phase10_instant_retail.sql:139(有效)  ｜  `BIGINT` ← docs/migrations/074_即时零售表.sql:167 |
| t_retail_order_item | product_name | `VARCHAR(128)` ← docs/migrations/017_phase10_instant_retail.sql:139(有效)  ｜  `VARCHAR(200)` ← docs/migrations/074_即时零售表.sql:167 |
| t_retail_order_item | product_image | `VARCHAR(255)` ← docs/migrations/017_phase10_instant_retail.sql:139(有效)  ｜  `VARCHAR(500)` ← docs/migrations/074_即时零售表.sql:167 |
| t_delivery_record | order_id | `INT` ← docs/migrations/017_phase10_instant_retail.sql:174(有效)  ｜  `BIGINT` ← docs/migrations/046_add_delivery_record.sql:2 |
| t_bank_account | bank_name | `VARCHAR(64)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜  `VARCHAR(100)` ← docs/migrations/068_银行费用发票.sql:2 |
| t_bank_account | account_name | `VARCHAR(64)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜  `VARCHAR(100)` ← docs/migrations/068_银行费用发票.sql:2 |
| t_bank_account | account_no | `VARCHAR(64)` ← docs/migrations/020_migrate_v3_payment_miniapp.sql:49(有效)  ｜  `VARCHAR(50)` ← docs/migrations/068_银行费用发票.sql:2 |
| t_brand | tenant_id | `VARCHAR(64)` ← docs/migrations/070_品牌表.sql:4  ｜  `VARCHAR(36)` ← backend/src/shared/migration.ts:821(有效) |
| t_points_record | id | `BIGINT` ← docs/migrations/071_客户积分.sql:16(有效) / docs/migrations/163_transfer_order_columns_fill.sql:13  ｜  `BIGINT UNSIGNED` ← docs/migrations/108_miniapp_member_wholesale.sql:27 |
| t_points_record | type | `VARCHAR(20)` ← docs/migrations/071_客户积分.sql:16(有效) / docs/migrations/163_transfer_order_columns_fill.sql:13  ｜  `VARCHAR(16)` ← docs/migrations/108_miniapp_member_wholesale.sql:27 |
| t_points_record | source_type | `VARCHAR(20)` ← docs/migrations/071_客户积分.sql:16(有效) / docs/migrations/163_transfer_order_columns_fill.sql:13  ｜  `VARCHAR(32)` ← docs/migrations/108_miniapp_member_wholesale.sql:27 |
| t_points_record | remark | `VARCHAR(200)` ← docs/migrations/071_客户积分.sql:16(有效) / docs/migrations/163_transfer_order_columns_fill.sql:13  ｜  `VARCHAR(256)` ← docs/migrations/108_miniapp_member_wholesale.sql:27 |
| t_points_record | tenant_id | `VARCHAR(64)` ← docs/migrations/071_客户积分.sql:16(有效) / docs/migrations/163_transfer_order_columns_fill.sql:13  ｜  `VARCHAR(36)` ← docs/migrations/108_miniapp_member_wholesale.sql:27 |
| t_error_logs | id | `BIGINT` ← docs/migrations/120d_fix_server_3bugs.sql:145  ｜  `BIGINT UNSIGNED` ← backend/src/shared/migration.ts:1064(有效) |
| t_error_logs | user_id | `BIGINT` ← docs/migrations/120d_fix_server_3bugs.sql:145  ｜  `BIGINT UNSIGNED` ← backend/src/shared/migration.ts:1064(有效) |
| t_error_logs | tenant_id | `VARCHAR(64)` ← docs/migrations/120d_fix_server_3bugs.sql:145  ｜  `VARCHAR(36)` ← backend/src/shared/migration.ts:1064(有效) |

## 五、全语料 tenant_id 列登记（282 处）

```
t_customer_visit.tenant_id = VARCHAR(36)  (docs/migrations/015_phase8_customer_visit.sql:6 有效)
t_subscription.tenant_id = VARCHAR(36)  (docs/migrations/016_phase9_tenant_subscription.sql:69 有效)
t_tenant_module_access.tenant_id = INT  (docs/migrations/016_phase9_tenant_subscription.sql:107 有效)
t_tenant_admin.tenant_id = INT  (docs/migrations/016_phase9_tenant_subscription.sql:150 有效)
t_retail_shop_config.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:10 有效)
t_retail_category.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:35 有效)
t_retail_banner.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:53 有效)
t_retail_product.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:73 有效)
t_retail_order.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:100 有效)
t_delivery_config.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:155 有效)
t_delivery_record.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:174 有效)
t_retail_operation_log.tenant_id = VARCHAR(36)  (docs/migrations/017_phase10_instant_retail.sql:199 有效)
t_coupon_template.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:10 有效)
t_user_coupon.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:42 有效)
t_promotion_activity.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:75 有效)
t_group_buy_record.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:151 有效)
t_promotion_stack_rule.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:188 有效)
t_marketing_operation_log.tenant_id = VARCHAR(36)  (docs/migrations/018_phase10_marketing.sql:204 有效)
t_payment_config.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:13 有效)
t_bank_account.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:49 有效)
t_miniapp_config.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:72 有效)
t_miniapp_template.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:117 有效)
t_miniapp_publish_log.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:161 有效)
t_price_change_log.tenant_id = VARCHAR(64)  (docs/migrations/020_migrate_v3_payment_miniapp.sql:180)
t_subscription.tenant_id = VARCHAR(36)  (docs/migrations/031_add_subscription.sql:2)
t_tenant_module_access.tenant_id = INT  (docs/migrations/032_add_tenant_module_access.sql:2)
t_tenant_admin.tenant_id = INT  (docs/migrations/034_add_tenant_admin.sql:2)
t_coupon_template.tenant_id = VARCHAR(36)  (docs/migrations/035_add_coupon_template.sql:2)
t_user_coupon.tenant_id = VARCHAR(36)  (docs/migrations/036_add_user_coupon.sql:2)
t_promotion_activity.tenant_id = VARCHAR(36)  (docs/migrations/037_add_promotion_activity.sql:2)
t_group_buy_record.tenant_id = VARCHAR(36)  (docs/migrations/041_add_group_buy_record.sql:2)
t_promotion_stack_rule.tenant_id = VARCHAR(36)  (docs/migrations/043_add_promotion_stack_rule.sql:2)
t_marketing_operation_log.tenant_id = VARCHAR(36)  (docs/migrations/044_add_marketing_operation_log.sql:2)
t_delivery_config.tenant_id = VARCHAR(36)  (docs/migrations/045_add_delivery_config.sql:2)
t_delivery_record.tenant_id = VARCHAR(36)  (docs/migrations/046_add_delivery_record.sql:2)
t_retail_operation_log.tenant_id = VARCHAR(36)  (docs/migrations/047_add_retail_operation_log.sql:2)
t_customer_visit.tenant_id = VARCHAR(36)  (docs/migrations/048_add_customer_visit.sql:2)
t_retail_announcement.tenant_id = VARCHAR(36)  (docs/migrations/052_add_retail_announcement.sql:6 有效)
t_unit_group.tenant_id = VARCHAR(64)  (docs/migrations/067_add_unit_group.sql:4 有效)
t_unit_group_item.tenant_id = VARCHAR(64)  (docs/migrations/067_add_unit_group.sql:14 有效)
t_bank_account.tenant_id = VARCHAR(64)  (docs/migrations/068_银行费用发票.sql:2)
t_expense.tenant_id = VARCHAR(64)  (docs/migrations/068_银行费用发票.sql:18 有效)
t_invoice.tenant_id = VARCHAR(64)  (docs/migrations/068_银行费用发票.sql:42 有效)
t_brand.tenant_id = VARCHAR(64)  (docs/migrations/070_品牌表.sql:4)
t_customer_points.tenant_id = VARCHAR(64)  (docs/migrations/071_客户积分.sql:2 有效)
t_points_record.tenant_id = VARCHAR(64)  (docs/migrations/071_客户积分.sql:16 有效)
t_points_rule.tenant_id = VARCHAR(64)  (docs/migrations/071_客户积分.sql:34 有效)
t_customer_level.tenant_id = VARCHAR(64)  (docs/migrations/071_客户积分.sql:49 有效)
t_level_config.tenant_id = VARCHAR(64)  (docs/migrations/071_客户积分.sql:63 有效)
t_customer_price.tenant_id = VARCHAR(64)  (docs/migrations/072_客户价格.sql:2 有效)
t_customer_tag.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:2 有效)
t_customer_tag_relation.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:15 有效)
t_customer_profile.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:28 有效)
t_customer_care_rule.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:49 有效)
t_customer_care_log.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:65 有效)
t_customer_segment.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:82 有效)
t_customer_segment_member.tenant_id = VARCHAR(64)  (docs/migrations/073_客户标签画像.sql:95 有效)
t_platform_config.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:8 有效)
t_platform_order.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:29 有效)
t_platform_product_map.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:46 有效)
t_retail_shop_config.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:65)
t_retail_category.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:89)
t_retail_product.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:106)
t_retail_order.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:131)
t_retail_order_item.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:167)
t_retail_banner.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:186)
t_retail_review.tenant_id = VARCHAR(32)  (docs/migrations/074_即时零售表.sql:206 有效)
t_limited_discount.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:8 有效)
t_limited_discount_product.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:36 有效)
t_gift_rule.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:52 有效)
t_gift_rule_level.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:79 有效)
t_points_product.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:93 有效)
t_points_exchange_record.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:114 有效)
t_marketing_material.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:133 有效)
t_material_category.tenant_id = VARCHAR(32)  (docs/migrations/076_营销P1.sql:163 有效)
t_sys_menu.tenant_id = VARCHAR(36)  (docs/migrations/079_权限矩阵.sql:18 有效)
t_sys_data_permission.tenant_id = VARCHAR(36)  (docs/migrations/079_权限矩阵.sql:42 有效)
t_sys_field_permission.tenant_id = VARCHAR(36)  (docs/migrations/079_权限矩阵.sql:60 有效)
t_purchase_contract.tenant_id = VARCHAR(64)  (docs/migrations/083_采购合同.sql:2 有效)
t_purchase_plan.tenant_id = VARCHAR(64)  (docs/migrations/084_采购计划.sql:2 有效)
t_purchase_plan_item.tenant_id = VARCHAR(64)  (docs/migrations/084_采购计划.sql:19 有效)
t_customer_quote.tenant_id = VARCHAR(36)  (docs/migrations/085_报价推送.sql:12 有效)
t_customer_quote_item.tenant_id = VARCHAR(36)  (docs/migrations/085_报价推送.sql:40 有效)
t_customer_quote_push_log.tenant_id = VARCHAR(36)  (docs/migrations/085_报价推送.sql:57 有效)
t_receipt.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:2 有效)
t_receipt_writeoff.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:25 有效)
t_payment.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:38 有效)
t_payment_writeoff.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:61 有效)
t_receivable.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:74 有效)
t_payable.tenant_id = VARCHAR(64)  (docs/migrations/086_收款支付.sql:95 有效)
t_report_sales_daily.tenant_id = VARCHAR(32)  (docs/migrations/087_报表汇总表.sql:8 有效)
t_report_collection_stats.tenant_id = VARCHAR(32)  (docs/migrations/087_报表汇总表.sql:30 有效)
t_report_product_sales.tenant_id = VARCHAR(32)  (docs/migrations/087_报表汇总表.sql:50 有效)
t_report_customer_stats.tenant_id = VARCHAR(32)  (docs/migrations/087_报表汇总表.sql:70 有效)
t_report_inventory_daily.tenant_id = VARCHAR(32)  (docs/migrations/087_报表汇总表.sql:90 有效)
t_sales_commission_rule.tenant_id = VARCHAR(64)  (docs/migrations/088_销售佣金.sql:2 有效)
t_sales_commission_record.tenant_id = VARCHAR(64)  (docs/migrations/088_销售佣金.sql:19 有效)
t_stock_check.tenant_id = VARCHAR(64)  (docs/migrations/089_库存盘点表.sql:2 有效)
t_stock_check_item.tenant_id = VARCHAR(64)  (docs/migrations/089_库存盘点表.sql:24 有效)
t_stock_warning_config.tenant_id = VARCHAR(64)  (docs/migrations/090_库存预警配置.sql:2 有效)
t_store_value_card.tenant_id = VARCHAR(64)  (docs/migrations/091_储值卡.sql:2 有效)
t_store_value_transaction.tenant_id = VARCHAR(64)  (docs/migrations/091_储值卡.sql:21 有效)
t_inventory_loss_gain.tenant_id = VARCHAR(64)  (docs/migrations/093_库存增加租户ID.sql:13 有效)
t_transfer_order.tenant_id = VARCHAR(64)  (docs/migrations/094_调拨订单表.sql:2 有效)
t_transfer_order_item.tenant_id = VARCHAR(64)  (docs/migrations/094_调拨订单表.sql:21 有效)
t_unit.tenant_id = VARCHAR(64)  (docs/migrations/095_单位表.sql:4 有效)
t_product_marketing_tag.tenant_id = VARCHAR(64)  (docs/migrations/105_product_marketing_tag.sql:5 有效)
t_data_permission.tenant_id = VARCHAR(36)  (docs/migrations/106_data_permission.sql:5 有效)
t_role_data_permission.tenant_id = VARCHAR(36)  (docs/migrations/106_data_permission.sql:21 有效)
t_sys_position.tenant_id = VARCHAR(64)  (docs/migrations/107_sys_position.sql:3 有效)
t_member_level.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:4 有效)
t_points_record.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:27)
t_growth_record.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:46 有效)
t_wholesale_cart.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:69 有效)
t_wholesale_order.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:84 有效)
t_wholesale_order_item.tenant_id = VARCHAR(36)  (docs/migrations/108_miniapp_member_wholesale.sql:125 有效)
t_custom_report.tenant_id = VARCHAR(32)  (docs/migrations/109_p2_custom_report.sql:7 有效)
t_custom_report_log.tenant_id = VARCHAR(32)  (docs/migrations/109_p2_custom_report.sql:26 有效)
t_product_review.tenant_id = VARCHAR(32)  (docs/migrations/110_p2_product_review.sql:7 有效)
t_bargain_activity.tenant_id = VARCHAR(32)  (docs/migrations/111_p2_bargain.sql:7 有效)
t_bargain_record.tenant_id = VARCHAR(32)  (docs/migrations/111_p2_bargain.sql:34 有效)
t_bargain_help.tenant_id = VARCHAR(32)  (docs/migrations/111_p2_bargain.sql:55 有效)
t_order_timeout_config.tenant_id = VARCHAR(64)  (docs/migrations/112_order_timeout.sql:9 有效)
t_order_timeout_log.tenant_id = VARCHAR(64)  (docs/migrations/112_order_timeout.sql:25 有效)
t_product_bundle.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:10 有效)
t_product_bundle_item.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:33 有效)
t_combo_product.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:52 有效)
t_combo_product_option.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:75 有效)
t_inventory_loss_order.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:96 有效)
t_inventory_loss_order_item.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:124 有效)
t_inventory_profit_order.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:147 有效)
t_inventory_profit_order_item.tenant_id = VARCHAR(64)  (docs/migrations/113_p2_bundle_combo_profit_loss.sql:175 有效)
t_inventory_share_setting.tenant_id = VARCHAR(64)  (docs/migrations/114_p2_transfer_share_report_permission.sql:37 有效)
t_inventory_share_product.tenant_id = VARCHAR(64)  (docs/migrations/114_p2_transfer_share_report_permission.sql:52 有效)
t_report_permission_audit_log.tenant_id = VARCHAR(64)  (docs/migrations/114_p2_transfer_share_report_permission.sql:85 有效)
t_quick_entries.tenant_id = VARCHAR(64)  (docs/migrations/115_missing_tables.sql:11 有效)
t_tenant_config.tenant_id = VARCHAR(64)  (docs/migrations/115_missing_tables.sql:30 有效)
t_upload_file.tenant_id = VARCHAR(64)  (docs/migrations/115_missing_tables.sql:48 有效)
t_stock_warning.tenant_id = VARCHAR(36)  (docs/migrations/120_stock_warning.sql:13)
t_subscription.tenant_id = VARCHAR(64)  (docs/migrations/120d_fix_server_3bugs.sql:88)
t_error_logs.tenant_id = VARCHAR(64)  (docs/migrations/120d_fix_server_3bugs.sql:145)
t_transfer_stock_log.tenant_id = VARCHAR(64)  (docs/migrations/120e_transfer_stock_log.sql:2 有效)
t_tenant_ai_config.tenant_id = VARCHAR(36)  (docs/migrations/121_ai_base_tables.sql:34 有效)
t_ai_audit_log.tenant_id = VARCHAR(36)  (docs/migrations/121_ai_base_tables.sql:58 有效)
t_ai_usage_daily.tenant_id = VARCHAR(36)  (docs/migrations/121_ai_base_tables.sql:86 有效)
t_tenant_ai_billing.tenant_id = VARCHAR(36)  (docs/migrations/121_ai_base_tables.sql:115 有效)
t_ai_knowledge_chunks.tenant_id = VARCHAR(36)  (docs/migrations/122_ai_rag.sql:21 有效)
t_aftersale.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:6 有效)
t_audit_log.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:48 有效)
t_cart_item.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:68 有效)
t_cash_flow.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:89 有效)
t_daily_settlement.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:108 有效)
t_order_coupon.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:132 有效)
t_platform_settlement.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:146 有效)
t_full_reduction.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:169 有效)
t_flash_sale.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:190 有效)
t_flash_sale_record.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:215 有效)
t_group_buy.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:236 有效)
t_group_buy_member.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:268 有效)
t_group_buy_team.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:283 有效)
t_promo_stack_rule.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:309 有效)
t_payment_method.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:325 有效)
t_todos.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:339 有效)
t_sync_cache.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:356 有效)
t_user_points.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:371 有效)
t_sys_user_login.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:423 有效)
t_sys_role_menu.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:438 有效)
t_sale_bill_archive.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:450 有效)
t_sale_bill_item_archive.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:487 有效)
t_purchase_order_archive.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:507 有效)
t_purchase_order_item_archive.tenant_id = VARCHAR(36)  (docs/migrations/124_drift_tables_fill.sql:536 有效)
t_bill.tenant_id = VARCHAR(36)  (docs/migrations/126_bills.sql:3 有效)
t_order_routing_rule.tenant_id = VARCHAR(36)  (docs/migrations/127_order_routing_exception.sql:3 有效)
t_order_exception.tenant_id = VARCHAR(36)  (docs/migrations/127_order_routing_exception.sql:20 有效)
t_order_exception_log.tenant_id = VARCHAR(36)  (docs/migrations/127_order_routing_exception.sql:42 有效)
t_platform_subscription_apply.tenant_id = VARCHAR(36)  (docs/migrations/131_platform_subscription_apply.sql:14 有效)
t_product_sku_unit.tenant_id = VARCHAR(36)  (docs/migrations/133_product_sku_unit.sql:3 有效)
t_print_template.tenant_id = VARCHAR(36)  (docs/migrations/135_print_templates.sql:1 有效)
t_sms_template.tenant_id = VARCHAR(36)  (docs/migrations/136_sms_template.sql:2 有效)
t_hardware_config.tenant_id = VARCHAR(64)  (docs/migrations/140_hardware_config.sql:1 有效)
t_price_review.tenant_id = VARCHAR(36)  (docs/migrations/146_price_review.sql:1 有效)
t_shift.tenant_id = VARCHAR(36)  (docs/migrations/148_shift_stock_check.sql:1 有效)
t_shift_stock_check.tenant_id = VARCHAR(36)  (docs/migrations/148_shift_stock_check.sql:20 有效)
t_seckill_order.tenant_id = VARCHAR(36)  (docs/migrations/149_seckill_order.sql:7 有效)
t_hot_search.tenant_id = VARCHAR(36)  (docs/migrations/155_hot_search.sql:1 有效)
t_ai_review_task.tenant_id = varchar(36)  (docs/migrations/157_ai_review_task.sql:1 有效)
t_ai_ltm_profile.tenant_id = varchar(36)  (docs/migrations/158_ai_ltm.sql:1 有效)
t_ai_ltm_episodic.tenant_id = varchar(36)  (docs/migrations/158_ai_ltm.sql:14 有效)
t_ai_ltm_archival.tenant_id = varchar(36)  (docs/migrations/158_ai_ltm.sql:27 有效)
t_ai_learning_log.tenant_id = varchar(36)  (docs/migrations/159_ai_learning.sql:1 有效)
t_ai_evolution.tenant_id = varchar(36)  (docs/migrations/160_ai_evolution.sql:1 有效)
t_customer_points.tenant_id = VARCHAR(64)  (docs/migrations/163_transfer_order_columns_fill.sql:1)
t_points_record.tenant_id = VARCHAR(64)  (docs/migrations/163_transfer_order_columns_fill.sql:13)
t_transfer_stock_log.tenant_id = VARCHAR(64)  (docs/migrations/165_transfer_execution_columns.sql:3)
t_open_webhook.tenant_id = VARCHAR(36)  (docs/migrations/174_open_platform_webhook.sql:1 有效)
t_open_webhook_delivery.tenant_id = VARCHAR(36)  (docs/migrations/174_open_platform_webhook.sql:20 有效)
t_open_api_call_daily.tenant_id = VARCHAR(36)  (docs/migrations/175_open_platform_api_call_daily.sql:1 有效)
t_platform_addon_charge.tenant_id = VARCHAR(36)  (docs/migrations/176_平台增值扣费流水.sql:1 有效)
t_support_ticket.tenant_id = VARCHAR(36)  (docs/migrations/180_平台工单系统.sql:1 有效)
t_tenant_attribution.tenant_id = VARCHAR(36)  (docs/migrations/189_租户归因明细.sql:1 有效)
t_library_call_log.tenant_id = VARCHAR(36)  (docs/migrations/190_商品库调取流水.sql:1 有效)
t_tenant_library_copy.tenant_id = VARCHAR(36)  (docs/migrations/191_租户商品库调取映射.sql:1 有效)
t_tenant_admin.tenant_id = VARCHAR(36)  (docs/migrations/192_租户建租户与归因落点补列.sql:24)
t_print_record.tenant_id = VARCHAR(64)  (docs/migrations/20260720_print_record.sql:5 有效)
t_push_token.tenant_id = VARCHAR(64)  (docs/migrations/20260720_push_token.sql:5 有效)
t_sys_config.tenant_id = VARCHAR(36)  (docs/init_database.sql:31 有效)
t_sys_user.tenant_id = VARCHAR(36)  (docs/init_database.sql:51)
t_sys_role.tenant_id = VARCHAR(36)  (docs/init_database.sql:74)
t_sys_permission.tenant_id = VARCHAR(36)  (docs/init_database.sql:95 有效)
t_store.tenant_id = VARCHAR(36)  (docs/init_database.sql:117 有效)
t_product_category.tenant_id = VARCHAR(36)  (docs/init_database.sql:145)
t_supplier.tenant_id = VARCHAR(36)  (docs/init_database.sql:167 有效)
t_price_level.tenant_id = VARCHAR(36)  (docs/init_database.sql:200 有效)
t_alert_rule.tenant_id = VARCHAR(36)  (docs/init_database.sql:220 有效)
t_expiry_alert_config.tenant_id = VARCHAR(36)  (docs/init_database.sql:243 有效)
t_trace_config.tenant_id = VARCHAR(36)  (docs/init_database.sql:262 有效)
t_store_control_config.tenant_id = VARCHAR(36)  (docs/init_database.sql:288)
t_sys_user_role.tenant_id = VARCHAR(36)  (docs/init_database.sql:311)
t_sys_role_permission.tenant_id = VARCHAR(36)  (docs/init_database.sql:328 有效)
t_supplier_contact.tenant_id = VARCHAR(36)  (docs/init_database.sql:344 有效)
t_member.tenant_id = VARCHAR(36)  (docs/init_database.sql:368 有效)
t_product_spu.tenant_id = VARCHAR(36)  (docs/init_database.sql:396)
t_product_sku.tenant_id = VARCHAR(36)  (docs/init_database.sql:427)
t_product_price.tenant_id = VARCHAR(36)  (docs/init_database.sql:458)
t_sku_price.tenant_id = VARCHAR(36)  (docs/init_database.sql:478 有效)
t_customer_price_binding.tenant_id = VARCHAR(36)  (docs/init_database.sql:503 有效)
t_customer_credit.tenant_id = VARCHAR(36)  (docs/init_database.sql:525 有效)
t_inventory_balance.tenant_id = VARCHAR(36)  (docs/init_database.sql:553 有效)
t_inventory_batch.tenant_id = VARCHAR(36)  (docs/init_database.sql:576 有效)
t_trace_code.tenant_id = VARCHAR(36)  (docs/init_database.sql:602 有效)
t_miniapp_order.tenant_id = VARCHAR(36)  (docs/init_database.sql:645 有效)
t_miniapp_order_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:683 有效)
t_sale_bill.tenant_id = VARCHAR(36)  (docs/init_database.sql:707)
t_sale_bill_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:749 有效)
t_sale_return.tenant_id = VARCHAR(36)  (docs/init_database.sql:773 有效)
t_sale_return_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:806 有效)
t_purchase_order.tenant_id = VARCHAR(36)  (docs/init_database.sql:829)
t_purchase_order_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:863 有效)
t_purchase_in_stock.tenant_id = VARCHAR(36)  (docs/init_database.sql:891 有效)
t_purchase_in_stock_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:921 有效)
t_purchase_return.tenant_id = VARCHAR(36)  (docs/init_database.sql:950 有效)
t_purchase_return_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:982 有效)
t_purchase_payment.tenant_id = VARCHAR(36)  (docs/init_database.sql:1008 有效)
t_supplier_statement.tenant_id = VARCHAR(36)  (docs/init_database.sql:1041 有效)
t_supplier_statement_item.tenant_id = VARCHAR(36)  (docs/init_database.sql:1069 有效)
t_customer_statement.tenant_id = VARCHAR(36)  (docs/init_database.sql:1088 有效)
t_customer_payment.tenant_id = VARCHAR(36)  (docs/init_database.sql:1120 有效)
t_sale_payment.tenant_id = VARCHAR(36)  (docs/init_database.sql:1149 有效)
t_collection_link.tenant_id = VARCHAR(36)  (docs/init_database.sql:1178 有效)
t_receivable_account.tenant_id = VARCHAR(36)  (docs/init_database.sql:1214 有效)
t_payment_order.tenant_id = VARCHAR(36)  (docs/init_database.sql:1243 有效)
t_refund_order.tenant_id = VARCHAR(36)  (docs/init_database.sql:1270 有效)
t_hold_order.tenant_id = VARCHAR(36)  (docs/init_database.sql:1296 有效)
t_notification.tenant_id = VARCHAR(36)  (docs/init_database.sql:1320 有效)
t_operation_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1349 有效)
t_collection_view_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1373 有效)
t_product_price_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1389 有效)
t_inventory_ledger.tenant_id = VARCHAR(36)  (docs/init_database.sql:1410 有效)
t_price_change_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1440 有效)
t_credit_operation_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1458 有效)
t_collection_record.tenant_id = VARCHAR(36)  (docs/init_database.sql:1479 有效)
t_alert_record.tenant_id = VARCHAR(36)  (docs/init_database.sql:1505 有效)
t_expiry_alert_record.tenant_id = VARCHAR(36)  (docs/init_database.sql:1538 有效)
t_trace_event_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1567 有效)
t_trace_scan_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1593 有效)
t_recall_record.tenant_id = VARCHAR(36)  (docs/init_database.sql:1610 有效)
t_store_status_log.tenant_id = VARCHAR(36)  (docs/init_database.sql:1636 有效)
t_sys_user.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:475 有效)
t_sys_role.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:498 有效)
t_sys_user_role.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:514 有效)
t_stock_warning.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:759 有效)
t_store_control_config.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:781 有效)
t_brand.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:821 有效)
t_product_category.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:843 有效)
t_product_spu.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:862 有效)
t_product_sku.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:898 有效)
t_product_price.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:926 有效)
t_sale_bill.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:944 有效)
t_purchase_order.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:980 有效)
t_system_feedback.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:1039 有效)
t_error_logs.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:1064 有效)
t_customer_type.tenant_id = VARCHAR(36)  (backend/src/shared/migration.ts:1088 有效)
```

## 六、全语料 order_id 列登记（14 处）

```
t_trace_code.order_id = INT  (docs/migrations/006_phase4_schema.sql:181)
t_trace_event_log.order_id = INT  (docs/migrations/006_phase4_schema.sql:214)
t_retail_order_item.order_id = INT  (docs/migrations/017_phase10_instant_retail.sql:139 有效)
t_delivery_record.order_id = INT  (docs/migrations/017_phase10_instant_retail.sql:174 有效)
t_delivery_record.order_id = BIGINT  (docs/migrations/046_add_delivery_record.sql:2)
t_retail_order_item.order_id = BIGINT  (docs/migrations/074_即时零售表.sql:167)
t_retail_review.order_id = BIGINT  (docs/migrations/074_即时零售表.sql:206 有效)
t_bargain_record.order_id = BIGINT  (docs/migrations/111_p2_bargain.sql:34 有效)
t_order_timeout_log.order_id = INT  (docs/migrations/112_order_timeout.sql:25 有效)
t_aftersale.order_id = BIGINT  (docs/migrations/124_drift_tables_fill.sql:6 有效)
t_order_coupon.order_id = BIGINT  (docs/migrations/124_drift_tables_fill.sql:132 有效)
t_group_buy_member.order_id = BIGINT  (docs/migrations/124_drift_tables_fill.sql:268 有效)
t_trace_code.order_id = INT  (docs/init_database.sql:602 有效)
t_trace_event_log.order_id = INT  (docs/init_database.sql:1567 有效)
```