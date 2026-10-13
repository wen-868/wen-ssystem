# 结构快照对比：C3 基线(origin/main) vs 修复后 —— 同为 MariaDB 11.4.5

- 左（A）：D:\Users\ZXQL\wt-agents\_s3194-evidence\05-base-mariadb\structure
- 右（B）：D:\Users\ZXQL\wt-agents\_s3194-evidence\08-fixed-final-mariadb\structure

| 类别 | 条数 | 含义 |
|---|---|---|
| C | **19** | 表/列/索引/外键**存在性**差异 → 真实结构差异 |
| D | **1** | 其余字段差异 → 需人工核对 |
| A | 0 | 仅整数显示宽度不同（MySQL 8.0.19+ 移除 int(11)/bigint(20) 显示宽度，MariaDB 保留）→ 引擎天然差异 |
| B | 0 | 排序规则 utf8mb4_0900_ai_ci ↔ utf8mb4_general_ci → 引擎天然差异 |
| N3 | 0 | 默认值 NULL 显示形式（`<NULL>`(本装置占位) ↔ `NULL`）→ 引擎/客户端天然差异 |
| N4 | 0 | CURRENT_TIMESTAMP 大小写·括号形式与 EXTRA 的 DEFAULT_GENERATED 标志 → 引擎天然差异 |
| N5 | 0 | 默认值引号（X ↔ 'X'、空串 ↔ ''）→ 引擎天然差异 |
| N6 | 0 | JSON ↔ LONGTEXT（MariaDB 把 JSON 实现为 LONGTEXT 别名，连带字符集字段）→ 引擎天然差异 |
| N7 | 0 | 外键更新规则 NO ACTION ↔ RESTRICT 显示差异 → 引擎天然差异 |

## C 类（真实差异，全量）

- 表仅存在于右：t_tenant_module_access
- 列仅存在于右：t_tenant_module_access.id（int(11)）
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

### A_intWidth（0 条）

（无）

### B_collation（0 条）

（无）

### N3_nullRepr（0 条）

（无）

### N4_tsRepr（0 条）

（无）

### N5_quoteDefault（0 条）

（无）

### N6_jsonAlias（0 条）

（无）

### N7_fkRule（0 条）

（无）
