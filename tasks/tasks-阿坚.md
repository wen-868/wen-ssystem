# 阿坚 · 系统设置模块 · 后端核心

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 门店管理 API - 统一路由 + 完整CRUD | P0 | :x: |
| 2 | 员工管理 API - 统一路由 + 完整CRUD | P0 | :x: |
| 3 | 角色权限 API - 完善RBAC + 数据权限 | P0 | :x: |
| 4 | 操作日志 API - 增强审计 + 导出 | P0 | :x: |
| 5 | 参数配置 API - 完善配置 + 分组 | P0 | :x: |
| 6 | 审批流程 API - 完善流程 + 通知 | P1 | :x: |

---

## 详细说明

### 1. 门店管理 API - 统一路由 + 完整CRUD
- **文件**：`backend/src/routes/system-settings.routes.ts`（新建，统一路由入口）、`backend/src/controllers/admin/store-management.controller.ts`（新建）、`backend/src/services/admin/store-management.service.ts`（新建）
- **现有代码**：门店CRUD散落在 `employee.controller.ts`（listStores/createStore/getStore/updateStore/getStoreWechatInfo）和 `store-control` 中，需整合到统一路由
- **关键字段**：
  - `stores` 表：id、store_code、name、address、contact、phone、delivery_radius、business_status（OPEN/CLOSED/SUSPENDED）、miniapp_appid、wx_merchant_name、wx_service_phone、wx_head_img、lng、lat、open_time、close_time、tenant_id、status（ACTIVE/INACTIVE）、created_at、updated_at
  - 门店API：GET /admin/system/stores（分页+搜索）、POST /admin/system/stores（创建）、GET /admin/system/stores/:id（详情）、PUT /admin/system/stores/:id（更新）、DELETE /admin/system/stores/:id（软删除）、POST /admin/system/stores/:id/toggle（启用/停用）、GET /admin/system/stores/:id/wechat（微信信息拉取）
- **说明**：将现有分散的门店管理代码整合到统一路由 `/api/admin/system/stores`。新增门店编码自动生成、门店营业状态管理（OPEN/CLOSED/SUSPENDED）、地理坐标字段（lng/lat）、营业时间字段。整合 `store-control` 的开店/关店/暂停/恢复逻辑到门店状态管理。保留微信小程序信息拉取功能。路由注册到 `server.ts`：`app.use("/api/admin/system", requireAuthWithTenant, systemSettingsRouter)`。

### 2. 员工管理 API - 统一路由 + 完整CRUD
- **文件**：`backend/src/controllers/admin/employee-management.controller.ts`（新建）、`backend/src/services/admin/employee-management.service.ts`（新建）
- **现有代码**：`employee.controller.ts`（listStaff/createStaff/updateStaff/disableStaff）、`employee.service.ts`，需迁移到统一路由
- **关键字段**：
  - `employees` 表：id、staff_no、username、real_name、mobile、password_hash、role_id、store_id、department_id、position、status（ACTIVE/INACTIVE）、last_login_at、tenant_id、created_at、updated_at
  - 员工API：GET /admin/system/employees（分页+搜索+门店筛选+角色筛选）、POST /admin/system/employees（创建，含初始密码）、GET /admin/system/employees/:id（详情）、PUT /admin/system/employees/:id（更新）、DELETE /admin/system/employees/:id（软删除/离职）、POST /admin/system/employees/:id/reset-password（重置密码）、POST /admin/system/employees/:id/toggle（启用/禁用）
- **说明**：将现有员工管理代码迁移到统一路由 `/api/admin/system/employees`。新增工号自动生成、角色关联（使用RBAC角色表）、部门归属字段。员工状态管理：在职(ACTIVE)/离职(INACTIVE)。与RBAC角色系统集成，分配角色时自动关联角色权限。新增密码重置功能，离职员工自动禁用账号。路由注册到统一 `systemSettingsRouter`。

### 3. 角色权限 API - 完善RBAC + 数据权限
- **文件**：`backend/src/controllers/admin/role-permission.controller.ts`（新建）、`backend/src/services/admin/role-permission.service.ts`（新建）
- **现有代码**：`rbac.routes.ts`（listRoles/createRole/getRoleDetail/updateRole/deleteRole/getUserRoles/setUserRoles）、`rbac.controller.ts`、`rbac.service.ts`，需迁移到统一路由
- **关键字段**：
  - `sys_role` 表：id、role_name、role_code、description、permissions（JSON数组）、data_scope（ALL/DEPARTMENT/STORE/SELF）、status（ACTIVE/DISABLED）、tenant_id、created_at、updated_at
  - `sys_role_menu` 表：id、role_id、menu_id、permission_type（READ/WRITE/DELETE/EXPORT）
  - `sys_user_role` 表：id、user_id、role_id、tenant_id、created_at
  - 角色API：GET /admin/system/roles（列表）、POST /admin/system/roles（创建）、GET /admin/system/roles/:id（详情含权限树）、PUT /admin/system/roles/:id（更新）、DELETE /admin/system/roles/:id（删除，校验无用户引用）、GET /admin/system/roles/:id/users（已分配用户）、POST /admin/system/roles/:id/assign-users（分配用户）、GET /admin/system/roles/permissions-tree（菜单权限树）
- **说明**：将现有RBAC代码迁移到统一路由 `/api/admin/system/roles`。增强菜单权限树：支持三级菜单结构（一级模块/二级页面/三级按钮），每项权限支持READ/WRITE/DELETE/EXPORT四种操作类型。新增数据权限范围：ALL（全部数据）/DEPARTMENT（本部门）/STORE（本门店）/SELF（仅本人）。删除角色时校验是否有用户关联。权限树结构参考 `SystemRoles.vue` 中现有 `menuModules` 配置。路由注册到统一 `systemSettingsRouter`。

### 4. 操作日志 API - 增强审计 + 导出
- **文件**：`backend/src/controllers/admin/audit-log.controller.ts`（新建）、`backend/src/services/admin/audit-log.service.ts`（新建）
- **现有代码**：`audit.routes.ts`（listAuditLogs/getAuditStatistics）、`audit.controller.ts`、`audit.service.ts`，需迁移到统一路由
- **关键字段**：
  - `audit_log` 表（已有）：id、user_id、user_name、role、action（CREATE/UPDATE/DELETE/QUERY/LOGIN/EXPORT/IMPORT/APPROVE）、resource_type、resource_id、description、request_data（JSON）、change_data（JSON）、ip、user_agent、tenant_id、created_at
  - 审计API：GET /admin/system/audit-logs（分页+多条件筛选）、GET /admin/system/audit-logs/statistics（统计：今日/新增/修改/删除/查询/用户数）、GET /admin/system/audit-logs/:id（详情含请求参数和变更数据）、GET /admin/system/audit-logs/export（导出CSV）、POST /admin/system/audit-logs/clean（清理N天前日志）
- **说明**：将现有审计日志代码迁移到统一路由 `/api/admin/system/audit-logs`。增强筛选条件：支持按操作人、操作类型、资源类型、日期范围、IP地址组合筛选。新增日志详情接口（含请求参数和变更数据JSON）。新增CSV导出功能（复用现有 `exportAuditLogsCsv`）。新增日志清理功能（定时清理90天前的日志）。路由注册到统一 `systemSettingsRouter`。

### 5. 参数配置 API - 完善配置 + 分组
- **文件**：`backend/src/controllers/admin/system-config.controller.ts`（新建）、`backend/src/services/admin/system-config.service.ts`（新建）
- **现有代码**：`sys-config.routes.ts`（getAllConfigs/getConfigByGroup/batchUpdateConfigs/createConfig）、`sys-config.controller.ts`、`sys-config.service.ts`，需迁移到统一路由
- **关键字段**：
  - `sys_config` 表（已有）：id、config_key、config_value、config_group（GENERAL/ORDER/PAYMENT/INVENTORY/NOTIFICATION）、description、tenant_id、created_at、updated_at
  - 配置组预设：GENERAL（通用：公司名称/Logo/联系电话）、ORDER（订单：自动接单/超时时间/取消时间）、PAYMENT（支付：微信支付/支付宝/线下支付开关）、INVENTORY（库存：低库存预警阈值/保质期预警天数）、NOTIFICATION（通知：短信/微信/站内信开关）
  - 配置API：GET /admin/system/configs（全部配置）、GET /admin/system/configs/:group（按分组获取）、PUT /admin/system/configs/batch（批量更新）、POST /admin/system/configs（创建新配置）、DELETE /admin/system/configs/:id（删除配置）、GET /admin/system/configs/groups（获取分组列表）
- **说明**：将现有系统配置代码迁移到统一路由 `/api/admin/system/configs`。新增配置分组预设（GENERAL/ORDER/PAYMENT/INVENTORY/NOTIFICATION），每个分组包含预设配置项。新增配置分组列表接口，前端可按分组展示。批量更新支持事务（全部成功或全部回滚）。新增配置缓存机制（Redis缓存5分钟），配置更新后自动刷新缓存。路由注册到统一 `systemSettingsRouter`。

### 6. 审批流程 API - 完善流程 + 通知
- **文件**：`backend/src/controllers/admin/approval-system.controller.ts`（新建）、`backend/src/services/admin/approval-system.service.ts`（新建）
- **现有代码**：`approval.routes.ts`（rules/instances/tasks/notifications）、`approval-flow.controller.ts`、`approval-records.controller.ts`、`approval-flow.service.ts`、`approval-records.service.ts`，需迁移到统一路由
- **关键字段**：
  - `approval_rule` 表（已有）：id、rule_name、business_type（PURCHASE_ORDER/SALE_RETURN/PRICE_CHANGE/CREDIT_LIMIT）、trigger_condition（JSON）、approval_chain（JSON：多级审批链）、sla_hours、escalation_level、status、tenant_id、created_at、updated_at
  - `approval_instance` 表：id、instance_no、rule_id、rule_name、title、content、applicant_id、applicant_name、business_type、status（PENDING/APPROVED/REJECTED/CANCELLED）、current_step、tenant_id、created_at、updated_at
  - `approval_task` 表：id、instance_id、step_level、approver_id、approver_name、status（PENDING/APPROVED/REJECTED）、comment、created_at、handled_at
  - 审批API：GET /admin/system/approval/rules（规则列表）、POST /admin/system/approval/rules（创建规则）、PUT /admin/system/approval/rules/:id（更新规则）、GET /admin/system/approval/instances（审批实例列表）、POST /admin/system/approval/instances/submit（提交审批）、GET /admin/system/approval/instances/:instanceNo（审批详情）、GET /admin/system/approval/tasks（我的待办）、POST /admin/system/approval/tasks/:id/approve（通过）、POST /admin/system/approval/tasks/:id/reject（拒绝）
- **说明**：将现有审批流程代码迁移到统一路由 `/api/admin/system/approval`。新增业务类型扩展：支持 PRICE_CHANGE（价格变更审批）、CREDIT_LIMIT（信用额度审批）。新增审批SLA超时自动提醒（定时任务检查超时任务，发送通知）。新增审批撤销功能（申请人可撤销PENDING状态的审批）。审批通过/拒绝后自动发送系统通知。路由注册到统一 `systemSettingsRouter`。