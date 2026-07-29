# 数据库变更清单

> **维护人**：凌舟
> **创建日期**：2026-07-29
> **用途**：跟踪所有数据库迁移脚本的执行状态，确保数据库变更可控、可追溯
> **规则**：五道防线之防线3——所有数据库变更必须统一管理、统一执行、统一验证

---

## 一、迁移脚本规范

1. 文件名格式：`NNN_简短描述.sql`（NNN 为三位数字序号）
2. 每个脚本必须包含 `IF NOT EXISTS` / `IF EXISTS` 保护，确保可重复执行
3. 脚本末尾必须包含验证 SQL（如 `SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 't_xxx'`）
4. 表名必须带 `t_` 前缀
5. 字段必须有中文 COMMENT

---

## 二、已知问题

### 序号重复问题（需修正）

以下序号存在重复，后续需合并或重新编号：

| 序号 | 文件1 | 文件2 | 处理方式 |
|:----:|-------|-------|----------|
| 075 | `075_reset_admin_password_bcrypt.sql` | `075_合规凭证字段.sql` | 保留两个，后续重命名其中一个 |
| 081 | `081_platform_admin_seed_and_fix.sql` | `081_商品SPU扩展字段.sql` | 保留两个，后续重命名其中一个 |
| 115 | `115_missing_tables.sql` | `115_performance_indexes.sql` | 保留两个，后续重命名其中一个 |
| 116 | `116_fix_server_3bugs.sql` | `116_transfer_stock_log.sql` | 保留两个，后续重命名其中一个 |

### 缺失表问题（R66-02 根因）

以下表在后端代码中被引用，但 init_database.sql 和迁移脚本中可能缺失建表语句：

| 表名 | 引用位置 | 状态 |
|------|----------|:----:|
| `t_stock_warning` | 库存预警相关 service | ❌ 全项目无建表语句 |
| `t_alert_record` | 092 迁移脚本用了错误表名（无 t_ 前缀） | ⚠️ ALTER TABLE 静默失败 |

---

## 三、迁移脚本执行记录

### 已确认执行的脚本

| 序号 | 文件名 | 说明 | 执行日期 | 验证结果 | 执行人 |
|:----:|-------|------|----------|:--------:|:------:|
| — | `init_database.sql` | 数据库初始化脚本 | 2026-07-20（部署时） | ✅ 基础表已创建 | 用户 |
| 075 | `075_reset_admin_password_bcrypt.sql` | 重置 admin 密码为 bcrypt 格式 | 2026-07-29 | ✅ admin 可登录 | 用户 |
| 081 | `081_platform_admin_seed_and_fix.sql` | 平台管理员建表+种子数据 | 2026-07-29 | ✅ `t_platform_admin` 表存在 | 用户 |
| 115 | `115_missing_tables.sql` | 补建3张缺失表 | 2026-07-29 | ✅ 3张表已创建 | 用户 |

### 待确认执行状态的脚本

> 以下脚本在 `docs/migrations/` 目录中存在，但执行状态未确认。
> 需要阿坚在服务器执行 `SHOW TABLES` 全量输出后逐一核对。

| 序号 | 文件名 | 说明 | 状态 |
|:----:|-------|------|:----:|
| 001 | `001_phase1_schema.sql` | Phase1 表结构 | ⬜ 待确认 |
| 002 | `002_phase1_seed.sql` | Phase1 种子数据 | ⬜ 待确认 |
| 003 | `003_phase2_schema.sql` | Phase2 表结构 | ⬜ 待确认 |
| 004 | `004_phase3_schema.sql` | Phase3 表结构 | ⬜ 待确认 |
| 005 | `005_phase3_sys_config.sql` | Phase3 系统配置 | ⬜ 待确认 |
| 006 | `006_phase4_schema.sql` | Phase4 表结构 | ⬜ 待确认 |
| 007 | `007_phase5_schema.sql` | Phase5 表结构 | ⬜ 待确认 |
| 008 | `008_phase6_schema.sql` | Phase6 表结构 | ⬜ 待确认 |
| 009 | `009_phase7_approval_schema.sql` | Phase7 审批表结构 | ⬜ 待确认 |
| 010 | `010_phase7_credit_tenant.sql` | Phase7 授信租户 | ⬜ 待确认 |
| 011 | `011_phase7_member_fields.sql` | Phase7 会员字段 | ⬜ 待确认 |
| 012 | `012_phase7_price_tenant.sql` | Phase7 价格租户 | ⬜ 待确认 |
| 013 | `013_phase7_sale_bill_credit.sql` | Phase7 销售单授信 | ⬜ 待确认 |
| 014 | `014_phase7_sku_fields.sql` | Phase7 SKU 字段 | ⬜ 待确认 |
| 015 | `015_phase8_customer_visit.sql` | Phase8 客户拜访 | ⬜ 待确认 |
| 016 | `016_phase9_tenant_subscription.sql` | Phase9 租户订阅 | ⬜ 待确认 |
| 017 | `017_phase10_instant_retail.sql` | Phase10 即时零售 | ⬜ 待确认 |
| 018 | `018_phase10_marketing.sql` | Phase10 营销 | ⬜ 待确认 |
| 019 | `019_migrate_v2.sql` | V2 迁移 | ⬜ 待确认 |
| 020 | `020_migrate_v3_payment_miniapp.sql` | V3 支付小程序迁移 | ⬜ 待确认 |
| 029 | `029_add_tenant.sql` | 添加租户 | ⬜ 待确认 |
| 030 | `030_add_subscription_plan.sql` | 订阅计划 | ⬜ 待确认 |
| 031 | `031_add_subscription.sql` | 订阅 | ⬜ 待确认 |
| 032 | `032_add_tenant_module_access.sql` | 租户模块访问 | ⬜ 待确认 |
| 033 | `033_add_subscription_operation_log.sql` | 订阅操作日志 | ⬜ 待确认 |
| 034 | `034_add_tenant_admin.sql` | 租户管理员 | ⬜ 待确认 |
| 035 | `035_add_coupon_template.sql` | 优惠券模板 | ⬜ 待确认 |
| 036 | `036_add_user_coupon.sql` | 用户优惠券 | ⬜ 待确认 |
| 037 | `037_add_promotion_activity.sql` | 促销活动 | ⬜ 待确认 |
| 038 | `038_add_full_reduction_rule.sql` | 满减规则 | ⬜ 待确认 |
| 039 | `039_add_seckill_product.sql` | 秒杀商品 | ⬜ 待确认 |
| 040 | `040_add_group_buy_activity.sql` | 拼团活动 | ⬜ 待确认 |
| 041 | `041_add_group_buy_record.sql` | 拼团记录 | ⬜ 待确认 |
| 042 | `042_add_group_buy_participant.sql` | 拼团参与者 | ⬜ 待确认 |
| 043 | `043_add_promotion_stack_rule.sql` | 促销叠加规则 | ⬜ 待确认 |
| 044 | `044_add_marketing_operation_log.sql` | 营销操作日志 | ⬜ 待确认 |
| 045 | `045_add_delivery_config.sql` | 配送配置 | ⬜ 待确认 |
| 046 | `046_add_delivery_record.sql` | 配送记录 | ⬜ 待确认 |
| 047 | `047_add_retail_operation_log.sql` | 零售操作日志 | ⬜ 待确认 |
| 048 | `048_add_customer_visit.sql` | 客户拜访 | ⬜ 待确认 |
| 049 | `049_add_order_sync_log.sql` | 订单同步日志 | ⬜ 待确认 |
| 050 | `050_add_platform_reconciliation.sql` | 平台对账 | ⬜ 待确认 |
| 051 | `051_add_platform_review.sql` | 平台审核 | ⬜ 待确认 |
| 052 | `052_add_retail_announcement.sql` | 零售公告 | ⬜ 待确认 |
| 053 | `053_add_retail_cart.sql` | 零售购物车 | ⬜ 待确认 |
| 054 | `054_add_retail_consumer_address.sql` | 零售消费者地址 | ⬜ 待确认 |
| 055 | `055_add_points_mall_item.sql` | 积分商城商品 | ⬜ 待确认 |
| 056 | `056_add_points_mall_order.sql` | 积分商城订单 | ⬜ 待确认 |
| 057 | `057_add_marketing_asset.sql` | 营销素材 | ⬜ 待确认 |
| 058 | `058_add_sys_department.sql` | 系统部门 | ⬜ 待确认 |
| 059 | `059_add_user_session.sql` | 用户会话 | ⬜ 待确认 |
| 060 | `060_add_custom_report_template.sql` | 自定义报表模板 | ⬜ 待确认 |
| 061 | `061_add_custom_report_schedule.sql` | 自定义报表计划 | ⬜ 待确认 |
| 062 | `062_add_report_permission_matrix.sql` | 报表权限矩阵 | ⬜ 待确认 |
| 063 | `063_add_verification_code.sql` | 验证码 | ⬜ 待确认 |
| 064 | `064_add_push_config.sql` | 推送配置 | ⬜ 待确认 |
| 065 | `065_add_push_template.sql` | 推送模板 | ⬜ 待确认 |
| 066 | `066_add_push_log.sql` | 推送日志 | ⬜ 待确认 |
| 067 | `067_add_unit_group.sql` | 单位组 | ⬜ 待确认 |
| 068 | `068_银行费用发票.sql` | 银行费用发票 | ⬜ 待确认 |
| 069 | `069_商品SPU增加品牌ID.sql` | SPU 增加品牌 ID | ⬜ 待确认 |
| 070 | `070_品牌表.sql` | 品牌表 | ⬜ 待确认 |
| 071 | `071_客户积分.sql` | 客户积分 | ⬜ 待确认 |
| 072 | `072_客户价格.sql` | 客户价格 | ⬜ 待确认 |
| 073 | `073_客户标签画像.sql` | 客户标签画像 | ⬜ 待确认 |
| 074 | `074_即时零售表.sql` | 即时零售表 | ⬜ 待确认 |
| 075a | `075_reset_admin_password_bcrypt.sql` | 重置 admin 密码 | ✅ 已执行 |
| 075b | `075_合规凭证字段.sql` | 合规凭证字段 | ⬜ 待确认 |
| 076 | `076_营销P1.sql` | 营销 P1 | ⬜ 待确认 |
| 077 | `077_营销标签.sql` | 营销标签 | ⬜ 待确认 |
| 078 | `078_性能索引.sql` | 性能索引 | ⬜ 待确认 |
| 079 | `079_权限矩阵.sql` | 权限矩阵 | ⬜ 待确认 |
| 080 | `080_平台管理员.sql` | 平台管理员 | ⬜ 待确认 |
| 081a | `081_platform_admin_seed_and_fix.sql` | 平台管理员建表+种子数据 | ✅ 已执行 |
| 081b | `081_商品SPU扩展字段.sql` | SPU 扩展字段 | ⬜ 待确认 |
| 082 | `082_商品标签.sql` | 商品标签 | ⬜ 待确认 |
| 083 | `083_采购合同.sql` | 采购合同 | ⬜ 待确认 |
| 084 | `084_采购计划.sql` | 采购计划 | ⬜ 待确认 |
| 085 | `085_报价推送.sql` | 报价推送 | ⬜ 待确认 |
| 086 | `086_收款支付.sql` | 收款支付 | ⬜ 待确认 |
| 087 | `087_报表汇总表.sql` | 报表汇总表 | ⬜ 待确认 |
| 088 | `088_销售佣金.sql` | 销售佣金 | ⬜ 待确认 |
| 089 | `089_库存盘点表.sql` | 库存盘点表 | ⬜ 待确认 |
| 090 | `090_库存预警配置.sql` | 库存预警配置 | ⬜ 待确认 |
| 091 | `091_储值卡.sql` | 储值卡 | ⬜ 待确认 |
| 092 | `092_租户ID.sql` | 租户 ID | ⬜ 待确认 |
| 093 | `093_库存增加租户ID.sql` | 库增加租户 ID | ⬜ 待确认 |
| 094 | `094_调拨订单表.sql` | 调拨订单表 | ⬜ 待确认 |
| 095 | `095_单位表.sql` | 单位表 | ⬜ 待确认 |
| 096 | `096_用户设置.sql` | 用户设置 | ⬜ 待确认 |
| 099 | `099_seed_data.sql` | 种子数据 | ⬜ 待确认 |
| 100 | `100_login_failure_lock.sql` | 登录失败锁定 | ⬜ 待确认 |
| 101 | `101_tobacco_category_online_sale.sql` | 烟草品类在线销售 | ⬜ 待确认 |
| 102 | `102_tenant_register.sql` | 租户注册 | ⬜ 待确认 |
| 103 | `103_member_register.sql` | 会员注册 | ⬜ 待确认 |
| 104 | `104_platform_announcement.sql` | 平台公告 | ⬜ 待确认 |
| 105 | `105_product_marketing_tag.sql` | 商品营销标签 | ⬜ 待确认 |
| 106 | `106_data_permission.sql` | 数据权限 | ⬜ 待确认 |
| 107 | `107_sys_position.sql` | 系统岗位 | ⬜ 待确认 |
| 108 | `108_miniapp_member_wholesale.sql` | 小程序会员批发 | ⬜ 待确认 |
| 109 | `109_p2_custom_report.sql` | P2 自定义报表 | ⬜ 待确认 |
| 110 | `110_p2_product_review.sql` | P2 商品评论 | ⬜ 待确认 |
| 111 | `111_p2_bargain.sql` | P2 议价 | ⬜ 待确认 |
| 112 | `112_order_timeout.sql` | 订单超时 | ⬜ 待确认 |
| 113 | `113_p2_bundle_combo_profit_loss.sql` | P2 组合装盈亏 | ⬜ 待确认 |
| 114 | `114_p2_transfer_share_report_permission.sql` | P2 调拨共享报表权限 | ⬜ 待确认 |
| 115a | `115_missing_tables.sql` | 补建3张缺失表 | ✅ 已执行 |
| 115b | `115_performance_indexes.sql` | 性能索引 | ⬜ 待确认 |
| 116a | `116_fix_server_3bugs.sql` | 修复服务器3个Bug | ⬜ 待确认 |
| 116b | `116_transfer_stock_log.sql` | 调拨库存日志 | ⬜ 待确认 |
| 117 | `117_library_spu_sku.sql` | 商品库 SPU/SKU | ⬜ 待确认 |
| 118 | `118_library_brand.sql` | 商品库品牌 | ⬜ 待确认 |
| 119 | `119_library_seed_data.sql` | 商品库种子数据 | ⬜ 待确认 |
| — | `20260720_print_record.sql` | 打印记录 | ⬜ 待确认 |
| — | `20260720_push_token.sql` | 推送 Token | ⬜ 待确认 |

---

## 四、待办事项

1. **阿坚提供 `SHOW TABLES` 全量输出**：用于逐一核对上述脚本是否已执行
2. **补建 `t_stock_warning` 表**：全项目无建表语句，需创建迁移脚本
3. **修正 `t_alert_record` 表的092迁移脚本**：表名缺少 `t_` 前缀导致 ALTER TABLE 静默失败
4. **重命名重复序号的迁移脚本**：075/081/115/116 各有两个同名序号文件
5. **确认 init_database.sql 包含哪些表**：与迁移脚本对照，避免遗漏

---

## 五、变更记录

| 日期 | 变更内容 | 操作人 |
|------|----------|:------:|
| 2026-07-29 | 创建数据库变更清单，初始化全部迁移脚本记录 | 凌舟 |
