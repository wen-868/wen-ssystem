# 智享全链管理系统 v7.0 任务规划与分派

> 版本：v7.0  
> 日期：2026-07-02  
> 状态：✅ **全部完成，三人分支均已合并到main**  
> 基于：产品规划文档 v6.2 + 代码审计报告

---

## 执行状态总览

| 成员 | 分支 | 完成 | 状态 |
|------|------|:---:|:---:|
| **阿坚** | V9uC3J | 6/6 | ✅ 已合并 |
| **阿澈** | tkoXzL | 9/9 | ✅ 已合并 |
| **墨** | 4njSbh | 6/6 | ✅ 已合并 |

---

## 一、项目现状总览

| 维度 | 已完成 | 缺口 | 完成率 |
|------|:---:|:---:|:---:|
| 产品规划DDL表 | 139 | 0 | **100%** |
| 数据库DDL (init_database.sql) | 62 | 0 | **100%** |
| 迁移文件 | 66 | 0 | **100%** |
| 后端路由 | 82 | 0 | **100%** |
| 后端服务 | 30 | 0 | **100%** |
| 管理后台视图 | 106 | 0 | **100%** |
| 商户移动端 | 29 | 0 | **100%** |
| 平台总后台 (saas-admin) | 已完成 | 0 | **100%** |

---

## 二、阶段规划总览

```
Phase 17: 基础设施补齐        (DDL + 迁移 + 服务层重构)    [P0]  3天
Phase 18: 平台总后台 saas-admin (全新项目启动)              [P0]  5天
Phase 19: P1功能开发 - 后端    (API + Service + DDL)        [P1]  4天
Phase 20: P1功能开发 - 前端    (管理后台视图)               [P1]  3天
Phase 21: P2功能开发            (报表 + 系统设置 + 营销)      [P2]  4天
Phase 22: 集成测试 + 文档同步   (全链路验证 + 规格更新)      [P0]  2天
```

---

## 三、Phase 17: 基础设施补齐 [P0]

**目标**：补齐所有缺失的DDL表，整合散落的迁移文件，重构内联SQL路由。

### Task 17-A: 14张缺失表DDL创建

**负责人**：阿澈  
**工作量**：1天  
**产出**：14个迁移SQL文件

| # | 表名 | 所属模块 | 优先级 |
|---|------|---------|:---:|
| 1 | `miniapp_order_sync_log` | 订单管理 | P1 |
| 2 | `platform_reconciliation` | 订单管理 | P1 |
| 3 | `platform_review` | 订单管理 | P1 |
| 4 | `retail_announcement` | 即时零售 | P1 |
| 5 | `retail_cart` | 即时零售 | P1 |
| 6 | `retail_consumer_address` | 即时零售 | P1 |
| 7 | `points_mall_item` | 营销中心 | P1 |
| 8 | `points_mall_order` | 营销中心 | P1 |
| 9 | `marketing_asset` | 营销中心 | P1 |
| 10 | `sys_department` | 系统设置 | P1 |
| 11 | `user_session` | 系统设置 | P1 |
| 12 | `custom_report_template` | 数据报表 | P2 |
| 13 | `custom_report_schedule` | 数据报表 | P2 |
| 14 | `report_permission_matrix` | 系统设置 | P2 |

**依据**：`product-spec-v6-adapted.md` 各Section中的字段定义

### Task 17-B: 19张Phase文件表迁移整合

**负责人**：阿澈  
**工作量**：0.5天  
**产出**：19个迁移SQL文件（从phase文件提取）

| 来源 | 表名 | 数量 |
|------|------|:---:|
| `phase10_marketing.sql` | coupon_template, user_coupon, promotion_activity, full_reduction_rule, seckill_product, group_buy_activity, group_buy_record, group_buy_participant, promotion_stack_rule, marketing_operation_log | 10 |
| `phase10_instant_retail.sql` | delivery_config, delivery_record, retail_operation_log | 3 |
| `phase9_tenant_subscription.sql` | subscription_plan, subscription, tenant_module_access, subscription_operation_log, tenant_admin | 5 |
| `phase8_customer_visit.sql` | customer_visit | 1 |

### Task 17-C: 8个路由服务层重构

**负责人**：阿坚  
**工作量**：1.5天  
**产出**：重构后的路由 + 新建/接入service

**新建Service（3个）**：

| 文件 | 对应路由 | 说明 |
|------|---------|------|
| `services/admin/sys-user.service.ts` | `sys-user.routes.ts` | 完整CRUD + 事务 + 角色管理 |
| `services/admin/operation-log.service.ts` | `operation-log.routes.ts` | 分页查询 + 统计 |
| `services/admin/system.service.ts` | `system.routes.ts` | 3个COUNT查询 |

**接入已有Service（5个）**：

| 路由 | 已有Service | 说明 |
|------|-----------|------|
| `share.routes.ts` | `services/share.service.ts` | 将内联SQL迁移到service |
| `platform.routes.ts` | `services/platform/platform-overview.service.ts` | 改用已有service |
| `order-timeout.routes.ts` | `services/admin/order-timeout.service.ts` | 扫描器函数迁移 |
| `store-control.routes.ts` | `services/admin/store-control.service.ts` | 调度器函数迁移 |
| `notification.routes.ts` | `services/admin/notification.service.ts` | sendNotification迁移 |

**清理**：`store.routes.ts` 删除未使用的 `query, queryOne` 导入

### Task 17-D: 产品规格文档同步

**负责人**：墨  
**工作量**：0.5天  
**产出**：更新后的 `product-spec-v6-adapted.md`

- 更新第十八部分 admin-web 完成度：55% → **100%**
- 删除已过时的占位视图清单
- 更新 `init_database.sql` 表计数：62 → 包含迁移后的完整数量
- 同步 Phase 17 新增的14张表到对应Section

---

## 四、Phase 18: 平台总后台 saas-admin [P0]

**目标**：从零搭建平台总后台，支持多租户SaaS管理。

**技术栈**：Vue 3 + TypeScript + Vite + Element Plus（与 admin-web 一致）

### Task 18-A: 项目初始化 + 租户管理

**负责人**：阿坚  
**工作量**：2天  

**产出**：
- `saas-admin/` 项目脚手架（Vite + Vue3 + TS + Element Plus）
- 路由框架 + 布局（侧边栏 + 顶栏）
- 登录/退出（平台管理员账号体系）
- 租户列表 + 创建 + 启用/停用 + 详情
- 租户模块权限配置（`tenant_module_access` 表）
- 租户管理员账号管理（`tenant_admin` 表）

### Task 18-B: 订阅管理 + 平台数据面板

**负责人**：墨  
**工作量**：1.5天  

**产出**：
- 订阅套餐管理（`subscription_plan` 表 CRUD）
- 租户订阅记录（`subscription` 表）
- 订阅操作日志（`subscription_operation_log`）
- 平台数据面板：总租户数、活跃租户、月度收入、模块使用率
- 平台操作日志（`operation_log`）查看

### Task 18-C: 权限矩阵 + 监控告警

**负责人**：阿澈  
**工作量**：1.5天  

**产出**：
- 报表权限矩阵（`report_permission_matrix`）CRUD
- 系统级配置管理（`sys_config` 全局参数）
- 数据库健康检查 + 慢查询监控
- API调用统计面板
- 租户到期提醒 + 自动处理

---

## 五、Phase 19: P1功能开发 - 后端 [P1]

**目标**：为14张P1表创建完整的后端API（路由 + 服务 + 控制器）。

### Task 19-A: 订单管理P1后端

**负责人**：阿坚  
**工作量**：1天  
**涉及表**：`miniapp_order_sync_log`, `platform_reconciliation`, `platform_review`

**产出**：
- `miniapp-order-sync.routes.ts` + `miniapp-order-sync.service.ts`（同步日志查询/重试）
- `platform-reconciliation.routes.ts` + `platform-reconciliation.service.ts`（对账管理）
- `platform-review.routes.ts` + `platform-review.service.ts`（平台审核）

### Task 19-B: 即时零售P1后端

**负责人**：墨  
**工作量**：1天  
**涉及表**：`retail_announcement`, `retail_cart`, `retail_consumer_address`

**产出**：
- `retail-announcement.routes.ts` + `retail-announcement.service.ts`（公告管理）
- `retail-cart.routes.ts` + `cart.service.ts` 扩展（购物车CRUD）
- `retail-consumer-address.routes.ts` + `retail-consumer-address.service.ts`（地址管理）

### Task 19-C: 营销中心P1后端

**负责人**：阿澈  
**工作量**：1天  
**涉及表**：`points_mall_item`, `points_mall_order`, `marketing_asset`

**产出**：
- `points-mall.routes.ts` + `points-mall.service.ts`（积分商城CRUD）
- `marketing-asset.routes.ts` + `marketing-asset.service.ts`（营销素材管理）

### Task 19-D: 系统设置P1后端

**负责人**：阿澈  
**工作量**：0.5天  
**涉及表**：`sys_department`, `user_session`

**产出**：
- `department.routes.ts` + `department.service.ts`（部门管理CRUD）
- `user-session.routes.ts` + `user-session.service.ts`（会话管理）

---

## 六、Phase 20: P1功能开发 - 前端 [P1]

**目标**：为P1后端API创建对应的管理后台视图。

### Task 20-A: 订单管理P1前端

**负责人**：阿坚  
**工作量**：1天  

**产出**：
- `OrderSyncLog.vue` — 小程序订单同步日志
- `PlatformReconciliation.vue` — 平台对账管理
- `PlatformReview.vue` — 平台审核管理

### Task 20-B: 即时零售P1前端

**负责人**：墨  
**工作量**：1天  

**产出**：
- `RetailAnnouncement.vue` — 小程序公告管理
- 扩展 `InstantRetailShelf.vue` — 购物车功能入口
- `ConsumerAddress.vue` — 消费者地址管理

### Task 20-C: 营销中心P1前端

**负责人**：阿澈  
**工作量**：0.5天  

**产出**：
- `PointsMall.vue` — 积分商城管理
- `MarketingAsset.vue` — 营销素材库

### Task 20-D: 系统设置P1前端

**负责人**：阿澈  
**工作量**：0.5天  

**产出**：
- `DepartmentManage.vue` — 部门管理
- `SessionManage.vue` — 用户会话管理

---

## 七、Phase 21: P2功能开发 [P2]

**目标**：完成P2优先级的数据报表和系统设置功能。

### Task 21-A: 数据报表P2

**负责人**：阿坚  
**工作量**：1.5天  
**涉及表**：`custom_report_template`, `custom_report_schedule`

**产出**：
- 后端：报表模板CRUD + 定时调度 + 报表生成引擎
- 前端：`CustomReport.vue` — 自定义报表（拖拽式报表设计器）
- 前端：`ReportSchedule.vue` — 报表定时任务

### Task 21-B: 系统设置P2

**负责人**：墨  
**工作量**：1天  
**涉及表**：`report_permission_matrix`

**产出**：
- 后端：`report-permission.routes.ts` + `report-permission.service.ts`
- 前端：`ReportPermission.vue` — 报表权限矩阵（按角色/门店/模块三维配置）

### Task 21-C: 营销中心P2（已有DDL，需后端+前端）

**负责人**：阿澈  
**工作量**：1.5天  
**涉及表**：`seckill_product`, `group_buy_activity`, `group_buy_record`, `group_buy_participant`

**产出**：
- 后端：秒杀管理 + 拼团管理 API
- 前端：`SeckillManage.vue` — 秒杀活动管理
- 前端：`GroupBuyManage.vue` — 拼团活动管理

---

## 八、Phase 22: 集成测试 + 文档同步 [P0]

**目标**：全链路验证，确保所有模块正常工作，同步最终文档。

**负责人**：全员  
**工作量**：2天  

- 全链路端到端测试（开单→分享→支付→库存扣减）
- 各模块独立功能验证
- `product-spec-v6-adapted.md` 最终同步
- `init_database.sql` 最终版本合并
- 发布 v7.0 版本标签

---

## 九、任务分派汇总

| 阶段 | 阿坚 | 墨 | 阿澈 |
|------|------|------|------|
| **Phase 17** | Task C: 路由服务层重构 (1.5天) | Task D: 产品规格同步 (0.5天) | Task A: 14表DDL (1天) + Task B: 19表迁移 (0.5天) |
| **Phase 18** | Task A: 项目初始化+租户 (2天) | Task B: 订阅+面板 (1.5天) | Task C: 权限矩阵+监控 (1.5天) |
| **Phase 19** | Task A: 订单管理P1后端 (1天) | Task B: 即时零售P1后端 (1天) | Task C: 营销P1后端 (1天) + Task D: 系统P1后端 (0.5天) |
| **Phase 20** | Task A: 订单管理P1前端 (1天) | Task B: 即时零售P1前端 (1天) | Task C: 营销P1前端 (0.5天) + Task D: 系统P1前端 (0.5天) |
| **Phase 21** | Task A: 数据报表P2 (1.5天) | Task B: 系统设置P2 (1天) | Task C: 营销中心P2 (1.5天) |
| **Phase 22** | 集成测试 (2天) | 集成测试 + 文档 (2天) | 集成测试 (2天) |

| 成员 | 总工作量 | P0 | P1 | P2 |
|------|:---:|:---:|:---:|:---:|
| **阿坚** | 9天 | 5.5天 | 2天 | 1.5天 |
| **墨** | 8天 | 4天 | 2天 | 1天 |
| **阿澈** | 10天 | 5天 | 3.5天 | 1.5天 |

---

## 十、里程碑

| 里程碑 | 完成标志 | 预计日期 |
|--------|---------|---------|
| M1: 基础设施补齐 | 所有DDL表就绪 + 路由重构完成 | Phase 17 结束 |
| M2: 平台总后台上线 | saas-admin 可登录管理租户 | Phase 18 结束 |
| M3: P1功能完成 | 14张P1表全链路可用 | Phase 20 结束 |
| M4: P2功能完成 | 数据报表 + 系统设置扩展 | Phase 21 结束 |
| M5: v7.0发布 | 全链路测试通过 + 文档同步 | Phase 22 结束 |