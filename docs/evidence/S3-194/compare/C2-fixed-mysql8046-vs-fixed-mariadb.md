# 结构快照对比：C2 修复后 MySQL 8.0.46 vs 修复后 MariaDB 11.4.5（隔离"引擎"效应）

- 左（A）：D:\Users\ZXQL\wt-agents\_s3194-evidence\07-fixed-final-mysql8046\structure
- 右（B）：D:\Users\ZXQL\wt-agents\_s3194-evidence\08-fixed-final-mariadb\structure

| 类别 | 条数 | 含义 |
|---|---|---|
| C | **0** | 表/列/索引/外键**存在性**差异 → 真实结构差异 |
| D | **0** | 其余字段差异 → 需人工核对 |
| A | 1206 | 仅整数显示宽度不同（MySQL 8.0.19+ 移除 int(11)/bigint(20) 显示宽度，MariaDB 保留）→ 引擎天然差异 |
| B | 1613 | 排序规则 utf8mb4_0900_ai_ci ↔ utf8mb4_general_ci → 引擎天然差异 |
| N3 | 1156 | 默认值 NULL 显示形式（`<NULL>`(本装置占位) ↔ `NULL`）→ 引擎/客户端天然差异 |
| N4 | 1048 | CURRENT_TIMESTAMP 大小写·括号形式与 EXTRA 的 DEFAULT_GENERATED 标志 → 引擎天然差异 |
| N5 | 391 | 默认值引号（X ↔ 'X'、空串 ↔ ''）→ 引擎天然差异 |
| N6 | 128 | JSON ↔ LONGTEXT（MariaDB 把 JSON 实现为 LONGTEXT 别名，连带字符集字段）→ 引擎天然差异 |
| N7 | 15 | 外键更新规则 NO ACTION ↔ RESTRICT 显示差异 → 引擎天然差异 |

## C 类（真实差异，全量）

（无）

## D 类（需人工核对，全量）

（无）

## 引擎天然差异（A/B/N3~N7）样例，每类前 8 条

### A_intWidth（1206 条）

- 列 t_aftersale.id 仅整数显示宽度不同：bigint unsigned vs bigint(20) unsigned
- 列 t_aftersale.order_id 仅整数显示宽度不同：bigint vs bigint(20)
- 列 t_aftersale.customer_id 仅整数显示宽度不同：bigint vs bigint(20)
- 列 t_aftersale.store_id 仅整数显示宽度不同：bigint vs bigint(20)
- 列 t_aftersale.exchange_qty 仅整数显示宽度不同：int vs int(11)
- 列 t_aftersale.exchange_sku_id 仅整数显示宽度不同：bigint vs bigint(20)
- 列 t_aftersale.processed_by 仅整数显示宽度不同：bigint vs bigint(20)
- 列 t_aftersale.inspected_by 仅整数显示宽度不同：bigint vs bigint(20)

### B_collation（1613 条）

- 表 t_aftersale 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_alert_record 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_alert_rule 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_app_version 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_approval_approver 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_approval_instance 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_approval_log 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci
- 表 t_approval_notification 排序规则：utf8mb4_0900_ai_ci vs utf8mb4_general_ci

### N3_nullRepr（1156 条）

- 列 t_aftersale.order_id NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.order_no NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.customer_id NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.store_id NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.reason NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.reason_detail NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.exchange_sku_id NULL 显示差异：<NULL> vs NULL
- 列 t_aftersale.process_remark NULL 显示差异：<NULL> vs NULL

### N4_tsRepr（1048 条）

- 列 t_aftersale.created_at 时间戳默认值显示差异：CURRENT_TIMESTAMP vs current_timestamp()
- 列 t_aftersale.created_at EXTRA 显示差异：DEFAULT_GENERATED vs 
- 列 t_aftersale.updated_at 时间戳默认值显示差异：CURRENT_TIMESTAMP vs current_timestamp()
- 列 t_aftersale.updated_at EXTRA 显示差异：DEFAULT_GENERATED on update CURRENT_TIMESTAMP vs on update current_timestamp()
- 列 t_agent.created_at 时间戳默认值显示差异：CURRENT_TIMESTAMP vs current_timestamp()
- 列 t_agent.created_at EXTRA 显示差异：DEFAULT_GENERATED vs 
- 列 t_agent.updated_at 时间戳默认值显示差异：CURRENT_TIMESTAMP vs current_timestamp()
- 列 t_agent.updated_at EXTRA 显示差异：DEFAULT_GENERATED on update CURRENT_TIMESTAMP vs on update current_timestamp()

### N5_quoteDefault（391 条）

- 列 t_aftersale.aftersale_type 默认值引号差异：REFUND vs 'REFUND'
- 列 t_aftersale.status 默认值引号差异：PENDING vs 'PENDING'
- 列 t_agent.status 默认值引号差异：PENDING vs 'PENDING'
- 列 t_agent_level.status 默认值引号差异：ACTIVE vs 'ACTIVE'
- 列 t_ai_evolution.status 默认值引号差异：proposed vs 'proposed'
- 列 t_ai_ltm_profile.entity_type 默认值引号差异：tenant vs 'tenant'
- 列 t_ai_review_task.status 默认值引号差异：pending vs 'pending'
- 列 t_alert_record.alert_level 默认值引号差异：WARNING vs 'WARNING'

### N6_jsonAlias（128 条）

- 列 t_aftersale.items JSON ↔ LONGTEXT：json vs longtext
- 列 t_aftersale.items 字符集差异（JSON↔LONGTEXT 连带）： vs utf8mb4
- 列 t_agent_level.plan_scope JSON ↔ LONGTEXT：json vs longtext
- 列 t_agent_level.plan_scope 字符集差异（JSON↔LONGTEXT 连带）： vs utf8mb4
- 列 t_ai_audit_log.tool_calls JSON ↔ LONGTEXT：json vs longtext
- 列 t_ai_audit_log.tool_calls 字符集差异（JSON↔LONGTEXT 连带）： vs utf8mb4
- 列 t_ai_knowledge_chunks.embedding JSON ↔ LONGTEXT：json vs longtext
- 列 t_ai_knowledge_chunks.embedding 字符集差异（JSON↔LONGTEXT 连带）： vs utf8mb4

### N7_fkRule（15 条）

- 外键 t_delivery_record.t_delivery_record_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=NO ACTION vs del=CASCADE/upd=RESTRICT
- 外键 t_full_reduction_rule.t_full_reduction_rule_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=NO ACTION vs del=CASCADE/upd=RESTRICT
- 外键 t_group_buy_activity.t_group_buy_activity_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=NO ACTION vs del=CASCADE/upd=RESTRICT
- 外键 t_group_buy_participant.t_group_buy_participant_ibfk_1 更新/删除规则显示差异：del=CASCADE/upd=NO ACTION vs del=CASCADE/upd=RESTRICT
- 外键 t_product_spu.fk_product_spu_brand 更新/删除规则显示差异：del=SET NULL/upd=NO ACTION vs del=SET NULL/upd=RESTRICT
- 外键 t_product_tag.t_product_tag_ibfk_1 更新/删除规则显示差异：del=NO ACTION/upd=NO ACTION vs del=RESTRICT/upd=RESTRICT
- 外键 t_product_tag_relation.t_product_tag_relation_ibfk_1 更新/删除规则显示差异：del=NO ACTION/upd=NO ACTION vs del=RESTRICT/upd=RESTRICT
- 外键 t_product_tag_relation.t_product_tag_relation_ibfk_2 更新/删除规则显示差异：del=NO ACTION/upd=NO ACTION vs del=RESTRICT/upd=RESTRICT
