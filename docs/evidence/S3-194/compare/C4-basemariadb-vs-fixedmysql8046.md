# 结构快照对比：C4 origin/main 的 MariaDB 基线 vs 修复后 MySQL 8.0.46（跨库对照）

- 左（A）：D:\Users\ZXQL\wt-agents\_s3194-evidence\05-base-mariadb\structure
- 右（B）：D:\Users\ZXQL\wt-agents\_s3194-evidence\07-fixed-final-mysql8046\structure

| 类别 | 条数 | 含义 |
|---|---|---|
| C | **19** | 表/列/索引/外键**存在性**差异 → 真实结构差异 |
| D | **1** | 其余字段差异 → 需人工核对 |
| A | 1205 | 仅整数显示宽度不同（MySQL 8.0.19+ 移除 int(11)/bigint(20) 显示宽度，MariaDB 保留）→ 引擎天然差异 |
| B | 1607 | 排序规则 utf8mb4_0900_ai_ci ↔ utf8mb4_general_ci → 引擎天然差异 |
| N3 | 1154 | 默认值 NULL 显示形式（`<NULL>`(本装置占位) ↔ `NULL`）→ 引擎/客户端天然差异 |
| N4 | 1042 | CURRENT_TIMESTAMP 大小写·括号形式与 EXTRA 的 DEFAULT_GENERATED 标志 → 引擎天然差异 |
| N5 | 390 | 默认值引号（X ↔ 'X'、空串 ↔ ''）→ 引擎天然差异 |
| N6 | 128 | JSON ↔ LONGTEXT（MariaDB 把 JSON 实现为 LONGTEXT 别名，连带字符集字段）→ 引擎天然差异 |
| N7 | 13 | 外键更新规则 NO ACTION ↔ RESTRICT 显示差异 → 引擎天然差异 |

## C 类（真实差异，全量）

- 表仅存在于右：t_tenant_module_access
- 列仅存在于右：t_tenant_module_access.id（int）
- 列仅存在于右：t_tenant_module_access.tenant_id（varchar(36)）
- 列仅存在于右：t_tenant_module_access.module_code（varchar(64)）
- 列仅存在于右：t_tenant_module_access.module_name（varchar(128)）
- 列仅存在于右：t_tenant_module_access.enabled（tinyint(1)）
- 列仅存在于右：t_tenant_module_access.granted_by（varchar(32)）
- 列仅存在于右：t_tenant_module_access.granted_at（datetime）
- 列仅存在于右：t_tenant_module_access.expire_at（datetime）
- 列仅存在于右：t_tenant_module_access.remark（varchar(255)）
- 列仅存在于右：t_tenant_module_access.created_at（datetime）
- 列仅存在于右：t_tenant_module_access.updated_at（datetime）
- 索引仅存在于左：t_delivery_record.idx_delivery_record_order_id
- 索引仅存在于右：t_tenant_module_access.idx_tenant_module_enabled
- 索引仅存在于右：t_tenant_module_access.idx_tenant_module_tenant
- 索引仅存在于右：t_tenant_module_access.PRIMARY
- 索引仅存在于右：t_tenant_module_access.uk_tenant_module
- 外键仅存在于右：t_delivery_record.t_delivery_record_ibfk_1 → t_retail_order.id
- 外键仅存在于右：t_tenant_module_access.t_tenant_module_access_ibfk_1 → t_tenant.id

## D 类（需人工核对，全量）

- 表 t_tenant_admin 注释：租户管理员表（S3-144：对齐 t_tenant.id UUID，不建物理外键） vs 租户管理员表

## 引擎天然差异（A/B/N3~N7）样例，每类前 8 条

### A_intWidth（1205 条）

- 列 t_aftersale.id 仅整数显示宽度不同：bigint(20) unsigned vs bigint unsigned
- 列 t_aftersale.order_id 仅整数显示宽度不同：bigint(20) vs bigint
- 列 t_aftersale.customer_id 仅整数显示宽度不同：bigint(20) vs bigint
- 列 t_aftersale.store_id 仅整数显示宽度不同：bigint(20) vs bigint
- 列 t_aftersale.exchange_qty 仅整数显示宽度不同：int(11) vs int
- 列 t_aftersale.exchange_sku_id 仅整数显示宽度不同：bigint(20) vs bigint
- 列 t_aftersale.processed_by 仅整数显示宽度不同：bigint(20) vs bigint
- 列 t_aftersale.inspected_by 仅整数显示宽度不同：bigint(20) vs bigint

### B_collation（1607 条）

- 表 t_aftersale 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_alert_record 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_alert_rule 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_approval_approver 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_approval_instance 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_approval_log 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_approval_notification 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci
- 表 t_approval_rule 排序规则：utf8mb4_general_ci vs utf8mb4_0900_ai_ci

### N3_nullRepr（1154 条）

- 列 t_aftersale.order_id NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.order_no NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.customer_id NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.store_id NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.reason NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.reason_detail NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.exchange_sku_id NULL 显示差异：NULL vs <NULL>
- 列 t_aftersale.process_remark NULL 显示差异：NULL vs <NULL>

### N4_tsRepr（1042 条）

- 列 t_aftersale.created_at 时间戳默认值显示差异：current_timestamp() vs CURRENT_TIMESTAMP
- 列 t_aftersale.created_at EXTRA 显示差异： vs DEFAULT_GENERATED
- 列 t_aftersale.updated_at 时间戳默认值显示差异：current_timestamp() vs CURRENT_TIMESTAMP
- 列 t_aftersale.updated_at EXTRA 显示差异：on update current_timestamp() vs DEFAULT_GENERATED on update CURRENT_TIMESTAMP
- 列 t_agent.created_at 时间戳默认值显示差异：current_timestamp() vs CURRENT_TIMESTAMP
- 列 t_agent.created_at EXTRA 显示差异： vs DEFAULT_GENERATED
- 列 t_agent.updated_at 时间戳默认值显示差异：current_timestamp() vs CURRENT_TIMESTAMP
- 列 t_agent.updated_at EXTRA 显示差异：on update current_timestamp() vs DEFAULT_GENERATED on update CURRENT_TIMESTAMP

### N5_quoteDefault（390 条）

- 列 t_aftersale.aftersale_type 默认值引号差异：'REFUND' vs REFUND
- 列 t_aftersale.status 默认值引号差异：'PENDING' vs PENDING
- 列 t_agent.status 默认值引号差异：'PENDING' vs PENDING
- 列 t_agent_level.status 默认值引号差异：'ACTIVE' vs ACTIVE
- 列 t_ai_evolution.status 默认值引号差异：'proposed' vs proposed
- 列 t_ai_ltm_profile.entity_type 默认值引号差异：'tenant' vs tenant
- 列 t_ai_review_task.status 默认值引号差异：'pending' vs pending
- 列 t_alert_record.alert_level 默认值引号差异：'WARNING' vs WARNING

### N6_jsonAlias（128 条）

- 列 t_aftersale.items JSON ↔ LONGTEXT：longtext vs json
- 列 t_aftersale.items 字符集差异（JSON↔LONGTEXT 连带）：utf8mb4 vs 
- 列 t_agent_level.plan_scope JSON ↔ LONGTEXT：longtext vs json
- 列 t_agent_level.plan_scope 字符集差异（JSON↔LONGTEXT 连带）：utf8mb4 vs 
- 列 t_ai_audit_log.tool_calls JSON ↔ LONGTEXT：longtext vs json
- 列 t_ai_audit_log.tool_calls 字符集差异（JSON↔LONGTEXT 连带）：utf8mb4 vs 
- 列 t_ai_knowledge_chunks.embedding JSON ↔ LONGTEXT：longtext vs json
- 列 t_ai_knowledge_chunks.embedding 字符集差异（JSON↔LONGTEXT 连带）：utf8mb4 vs 

### N7_fkRule（13 条）

- 外键 t_full_reduction_rule.t_full_reduction_rule_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=RESTRICT vs del=CASCADE/upd=NO ACTION
- 外键 t_group_buy_activity.t_group_buy_activity_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=RESTRICT vs del=CASCADE/upd=NO ACTION
- 外键 t_group_buy_participant.t_group_buy_participant_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=RESTRICT vs del=CASCADE/upd=NO ACTION
- 外键 t_product_spu.fk_product_spu_brand 更新/删除规则显示差异：del=SET NULL/upd=RESTRICT vs del=SET NULL/upd=NO ACTION
- 外键 t_product_tag.t_product_tag_ibfk_1 更新/删除规则显示差异：del=RESTRICT/upd=RESTRICT vs del=NO ACTION/upd=NO ACTION
- 外键 t_product_tag_relation.t_product_tag_relation_ibfk_1 更新/删除规则显示差异：del=RESTRICT/upd=RESTRICT vs del=NO ACTION/upd=NO ACTION
- 外键 t_product_tag_relation.t_product_tag_relation_ibfk_2 更新/删除规则显示差异：del=RESTRICT/upd=RESTRICT vs del=NO ACTION/upd=NO ACTION
- 外键 t_retail_order_item.fk_retail_order_item_order 更新/删除规则显示差异：del=CASCADE/upd=RESTRICT vs del=CASCADE/upd=NO ACTION
