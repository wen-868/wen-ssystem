# S3-152 审计：S3-149 上线后"启动触达表"的来源与形状（凌舟自查，只读）

> 审计人：凌舟（总负责人）｜2026-10-02
> 背景：S3-149（`init_database.sql` 建表不再被丢弃）上线后，生产本次启动有 **12 张表**的 `CREATE_TIME` 落在 `03:02:59–03:03:03`。
> 本目录＝**审计工具 + 原始读数 + 结论**（工具与读数均为只读，未对生产做任何写操作）。

| 文件 | 内容 |
|---|---|
| `prod-cols.tsv` | 生产只读导出：12 张表的 `TABLE_NAME / COLUMN_NAME`（189 行） |
| `audit-columns.mjs` | 审计脚本（凌舟自用）：比对"生产列集"与"迁移声明列集（CREATE 块 + ALTER ADD COLUMN）" |
| `audit-run.txt` | 脚本原始输出 |

## 一、已取证（结论）

1. **12 张表全部含 `id` 与 `tenant_id`**（本仓租户隔离不变量成立）：`t_delivery_record / t_payment_config / t_platform_order / t_points_record / t_retail_category / t_retail_order / t_retail_product / t_retail_review / t_retail_shop_config / t_sys_role / t_tenant_admin / t_transfer_order_item`。
2. **`t_tenant_admin` 生产列与迁移 192 的定义逐列一致**（`id / tenant_id / user_id / role / is_primary / granted_at / created_at`，7 列）。
3. **4 张表本就有存量数据**：`t_sys_role`=12 行、`t_transfer_order_item`=4、`t_tenant_admin`=1、`t_points_record`=1 ⇒ **`CREATE_TIME` 落在本次启动 ≠ 一定是"新建"**（被 ALTER/迁移段触及同样会改写该字段）。
4. **应用侧无异常信号**：该次 Auto Deploy 的只读冒烟通过、pm2 online、后续只读核对（`/api/platform/tenants` 200）正常。

## 二、脚本的两处"缺列"告警 = **假阳性（已逐条证伪）**

| 告警 | 证伪依据 | 判定 |
|---|---|---|
| `t_points_record.earn_ratio` | `earn_ratio` 仅声明于 `docs/migrations/151_points_columns_fill.sql:11`，且那条 ALTER 的目标表是 **`t_points_rule`**（非 `t_points_record`） | **脚本正则允许跨语句匹配导致的假阳性** |
| `t_sys_role.settlement_type` | `settlement_type` 的声明处分别属于 **`t_member`（001:137）/ `t_miniapp_order`（001:297）/ `t_supplier`（003:28）** 等表，**没有一处属于 `t_sys_role`** | 同上 |

⇒ **无"旧定义抢先导致缺列"的证据**；形状判为**合规**。

## 三、未能彻底消歧的部分（如实登记，不粉饰）

- **0 行表**（如 `t_retail_*`、`t_payment_config`、`t_platform_order`）的"**新建** vs **被 ALTER 重建**"**无法仅凭 `information_schema` 判定**（两种情形都表现为 `CREATE_TIME` 更新）。
- 因此本审计的结论强度＝"**形状合规、无功能风险**"，**不等于**"已证明它们不是本次新建"。
- **可选加固（登记，不阻塞）**：① 下次部署前先落一份"表→列"快照（本目录 `audit-columns.mjs` 可直接复用，只需把 `prod-cols.tsv` 换成两次快照对比）；② 需要 100% 归因时用 MySQL binlog / 审计日志回溯 03:02–03:03 窗口。

## 四、处置

**S3-152 结案**：形状/Owner 取证达标（§一）+ 假阳性已排除（§二）+ 不确定性已显式登记（§三）⇒ **无功能风险，不再单独立项**；§三的两项加固作为**可选**留给后续（若你需要 100% 归因，我按 ① 落快照再对比一次即可）。
