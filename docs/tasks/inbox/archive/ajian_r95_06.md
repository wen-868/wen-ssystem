# R95-06 任务卡 — 结构差异清零专项（阿坚）

> 派单：凌舟 2026-08-07　优先级：P1　预计：1.5 天

## 必读文件

1. `docs/tasks/current-tasks.md` —— R95-06 任务卡 + R95-04-5 收口记录 + 必读文件清单
2. `docs/reports/schema-audit-2026-08-07.md` —— 生产体检报告（差异详情）
3. `scripts/schema-audit.mjs` —— 体检脚本（误报剔除需改进解析规则）
4. `docs/项目规则.md` / `docs/项目统一标准.md` / `docs/踩坑日志.md` / `docs/memories/阿坚-记忆.md`

## 任务一：17 处列类型不匹配 → DDL 期望对齐生产（P1）

**目标**：修正迁移 DDL 类型定义与生产实际一致（不改生产表，零风险），重跑 schema-audit 类型不匹配 17 → 0。

**清单**（来自生产体检报告）：
- int vs bigint：t_bank_account.id、t_error_logs.id、t_retail_category.id、t_retail_order.id、t_retail_order.user_id、t_retail_product.category_id/id/product_id、t_retail_shop_config.id、t_sys_role.id（bigint vs int 反向）、t_sys_user.id（bigint vs int 反向）
- enum vs varchar：t_purchase_payment.payment_method
- time vs varchar：t_store_control_config.auto_close_time、auto_open_time（**先查代码用法**：生产存 "HH:MM" 字符串，若代码按字符串处理则 DDL 改 varchar；若代码期望 Date 需评估后处理并说明）
- int vs varchar：t_subscription.tenant_id、t_tenant.id
- tinyint vs varchar：t_sys_role.status

**要求**：修改 `docs/init_database.sql` + 对应 `docs/migrations/*.sql` 的类型定义（以生产实际 information_schema 为准）；每条改动注明文件与原因；不修改生产数据库。

## 任务二：38 张代码漂移表 → 逐个核实处理（P1）

**目标**：38 张表逐条给出处理结论（误报/改代码/补建表），重跑 schema-audit 漂移表显著减少或清零。

**分类线索**（凌舟初步分析，需你逐条核实代码引用后确认）：
1. **疑似误报**（改进脚本解析剔除）：t_last、t_module_name、t_inventory、t_notifications、t_product、t_sale_bill_items、t_sale_bills、t_sale_order、t_sales_order、t_sku、t_sync_cache、t_todos、t_user_points、t_user_customer、t_user_binding
2. **疑似表名变体**（修正代码 SQL 用真实表名）：t_flash_sale→t_seckill_product、t_flash_sale_record、t_full_reduction→t_full_reduction_rule、t_group_buy→t_group_buy_activity、t_group_buy_member、t_group_buy_team、t_payment_method（可能为列名）、t_promo_stack_rule→t_promotion_stack_rule、t_product_step_price→t_sku_price
3. **真实漂移**（核实用途：补建表或修正代码）：t_aftersale、t_audit_log、t_cart_item、t_cash_flow、t_daily_settlement、t_order_coupon、t_platform_settlement、t_purchase_order_archive、t_purchase_order_item_archive、t_sale_bill_archive、t_sale_bill_item_archive、t_sys_role_menu、t_sys_user_login、t_wx_user

**处理方式**：
- 误报：改进 `scripts/schema-audit.mjs` 的代码解析（如忽略单数/复数变体、LIMIT/占位符误匹配），重跑后不再列出
- 变体：核实 `backend/src` 具体 SQL，改真实表名/列名；若代码引用确实是查询不存在的表，需修正为真实表并验证接口
- 真实漂移：查代码用途——功能需要则**补建表**（DDL 补入 `docs/migrations/` 新文件 + 生产执行建表，参考 `scripts/extract-create-tables.mjs` 无外键风格）；代码误引用则修正；无法确认的逐条写明原因

## 通用要求

- 只改任务范围内文件（迁移 DDL、schema-audit 脚本、相关后端代码），不碰无关代码
- 每处改动标注：表名/列名、处理方式（DDL 对齐/脚本改进/代码修正/补建表）、证据
- 完成后更新 current-tasks.md R95-06 状态，任务卡移至 `docs/tasks/inbox/archive/`，向凌舟回报（任务标识 + 复述 + 逐条处理表 + 重跑报告摘要）
