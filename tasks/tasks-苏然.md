# 苏然 · 系统设置模块 · DAO层 + 测试

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 门店管理 DAO + 测试 | P0 | :x: |
| 2 | 员工管理 DAO + 测试 | P0 | :x: |
| 3 | 角色权限 DAO + 测试 | P0 | :x: |
| 4 | 操作日志 DAO + 测试 | P0 | :x: |
| 5 | 参数配置 DAO + 测试 | P0 | :x: |
| 6 | 审批流程 DAO + 测试 | P1 | :x: |

---

## 详细说明

### 1. 门店管理 DAO + 测试
- **文件**：`backend/src/dao/system/store.dao.ts`（新建）、`backend/src/__tests__/system/store.test.ts`（新建）
- **DDL 文件**：`docs/migrations/add_system_settings.sql`（新建，统一DDL文件）
- **现有代码**：门店CRUD逻辑在 `employee.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - `listStores(page, pageSize, keyword, tenantId)` - 分页查询门店列表，支持关键词搜索
  - `getStoreById(id, tenantId)` - 根据ID查询门店详情
  - `getStoreByCode(code, tenantId)` - 根据编码查询门店
  - `createStore(data, tenantId)` - 创建门店
  - `updateStore(id, data, tenantId)` - 更新门店
  - `deleteStore(id, tenantId)` - 软删除门店
  - `toggleStoreStatus(id, status, tenantId)` - 切换门店状态
  - `getStoreCount(tenantId)` - 统计门店数量
- **DDL 字段**：id、store_code、name、address、contact、phone、delivery_radius、business_status、miniapp_appid、wx_merchant_name、wx_service_phone、wx_head_img、lng、lat、open_time、close_time、tenant_id、status、created_at、updated_at（约20字段）
- **测试用例**（至少8个）：
  - 创建门店 - 正常流程
  - 创建门店 - 编码重复校验
  - 查询门店列表 - 分页+搜索
  - 查询门店详情 - 正常流程
  - 更新门店 - 正常流程
  - 切换门店状态 - 启用/停用/暂停
  - 软删除门店 - 正常流程
  - 租户隔离 - 验证数据隔离

### 2. 员工管理 DAO + 测试
- **文件**：`backend/src/dao/system/employee.dao.ts`（新建）、`backend/src/__tests__/system/employee.test.ts`（新建）
- **现有代码**：员工CRUD逻辑在 `employee.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - `listEmployees(page, pageSize, keyword, storeId, roleId, tenantId)` - 分页查询员工列表，支持多条件筛选
  - `getEmployeeById(id, tenantId)` - 根据ID查询员工详情
  - `getEmployeeByStaffNo(staffNo, tenantId)` - 根据工号查询员工
  - `getEmployeeByUsername(username, tenantId)` - 根据用户名查询员工
  - `createEmployee(data, tenantId)` - 创建员工
  - `updateEmployee(id, data, tenantId)` - 更新员工
  - `deleteEmployee(id, tenantId)` - 软删除员工（离职）
  - `toggleEmployeeStatus(id, status, tenantId)` - 切换员工状态
  - `resetPassword(id, newPasswordHash, tenantId)` - 重置密码
  - `updateLastLogin(id, tenantId)` - 更新最后登录时间
- **DDL 字段**：id、staff_no、username、real_name、mobile、password_hash、role_id、store_id、department_id、position、status、last_login_at、tenant_id、created_at、updated_at（约15字段）
- **测试用例**（至少8个）：
  - 创建员工 - 正常流程
  - 创建员工 - 用户名重复校验
  - 创建员工 - 工号重复校验
  - 查询员工列表 - 分页+多条件筛选
  - 查询员工详情 - 正常流程
  - 更新员工 - 正常流程
  - 重置密码 - 正常流程
  - 切换员工状态 - 启用/禁用

### 3. 角色权限 DAO + 测试
- **文件**：`backend/src/dao/system/role.dao.ts`（新建）、`backend/src/dao/system/menu.dao.ts`（新建）、`backend/src/__tests__/system/role.test.ts`（新建）
- **现有代码**：RBAC逻辑在 `rbac.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - `listRoles(tenantId)` - 查询角色列表（含用户数统计）
  - `getRoleById(id, tenantId)` - 查询角色详情（含权限列表）
  - `getRoleByCode(code, tenantId)` - 根据编码查询角色
  - `createRole(data, tenantId)` - 创建角色
  - `updateRole(id, data, tenantId)` - 更新角色
  - `deleteRole(id, tenantId)` - 删除角色（校验无用户引用）
  - `getRoleUsers(roleId, tenantId)` - 查询角色下的用户列表
  - `assignRoleUsers(roleId, userIds, tenantId)` - 分配用户到角色
  - `removeRoleUser(roleId, userId, tenantId)` - 移除角色用户
  - `getMenuTree(tenantId)` - 获取完整菜单权限树
  - `getRolePermissions(roleId, tenantId)` - 获取角色权限列表
  - `checkUserPermission(userId, tenantId, permCode)` - 检查用户权限
- **DDL 表**：sys_role（约8字段）、sys_role_menu（约5字段）、sys_user_role（约4字段）
- **测试用例**（至少8个）：
  - 创建角色 - 正常流程
  - 创建角色 - 编码重复校验
  - 查询角色列表 - 含用户数统计
  - 查询角色详情 - 含权限列表
  - 更新角色 - 权限变更
  - 分配用户 - 批量分配
  - 删除角色 - 成功（无用户引用）
  - 删除角色 - 失败（有用户引用）

### 4. 操作日志 DAO + 测试
- **文件**：`backend/src/dao/system/audit.dao.ts`（新建）、`backend/src/__tests__/system/audit.test.ts`（新建）
- **现有代码**：审计日志逻辑在 `audit.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - `listAuditLogs(params, tenantId)` - 分页查询日志列表，支持多条件筛选
  - `getAuditLogById(id, tenantId)` - 查询日志详情
  - `writeAuditLog(data, tenantId)` - 写入审计日志
  - `getAuditStatistics(tenantId)` - 获取审计统计（今日/新增/修改/删除/查询/用户数）
  - `cleanAuditLogs(days, tenantId)` - 清理N天前日志
  - `exportAuditLogs(params, tenantId)` - 导出日志CSV
- **DDL 表**：audit_log（已有，约12字段）
- **测试用例**（至少8个）：
  - 写入审计日志 - 正常流程
  - 查询日志列表 - 分页+多条件筛选
  - 查询日志列表 - 按操作类型筛选
  - 查询日志列表 - 按日期范围筛选
  - 查询日志详情 - 含请求参数和变更数据
  - 获取审计统计 - 验证各项统计数值
  - 清理旧日志 - 验证清理逻辑
  - 导出日志 - 验证CSV格式

### 5. 参数配置 DAO + 测试
- **文件**：`backend/src/dao/system/config.dao.ts`（新建）、`backend/src/__tests__/system/config.test.ts`（新建）
- **现有代码**：配置逻辑在 `sys-config.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - `getAllConfigs(tenantId)` - 获取全部配置
  - `getConfigsByGroup(group, tenantId)` - 按分组获取配置
  - `getConfigByKey(key, tenantId)` - 根据Key获取配置值
  - `batchUpdateConfigs(configs, tenantId)` - 批量更新配置（事务）
  - `createConfig(data, tenantId)` - 创建配置项
  - `deleteConfig(id, tenantId)` - 删除配置项
  - `getConfigGroups(tenantId)` - 获取配置分组列表
  - `initDefaultConfigs(tenantId)` - 初始化默认配置（租户注册时调用）
- **DDL 表**：sys_config（已有，约6字段）
- **预设配置项**（至少20个）：
  - GENERAL: company_name, company_logo, contact_phone, system_theme
  - ORDER: auto_accept_order, order_timeout_minutes, order_cancel_minutes
  - PAYMENT: wechat_pay_enabled, alipay_enabled, offline_pay_enabled
  - INVENTORY: low_stock_threshold, expiry_warning_days, auto_replenish
  - NOTIFICATION: sms_enabled, wechat_notify_enabled, site_msg_enabled
- **测试用例**（至少8个）：
  - 获取全部配置 - 正常流程
  - 按分组获取配置 - 正常流程
  - 批量更新配置 - 正常流程
  - 批量更新配置 - 事务回滚验证
  - 创建配置项 - 正常流程
  - 创建配置项 - Key重复校验
  - 初始化默认配置 - 正常流程
  - 租户隔离 - 验证数据隔离

### 6. 审批流程 DAO + 测试
- **文件**：`backend/src/dao/system/approval-rule.dao.ts`（新建）、`backend/src/dao/system/approval-instance.dao.ts`（新建）、`backend/src/dao/system/approval-task.dao.ts`（新建）、`backend/src/__tests__/system/approval.test.ts`（新建）
- **现有代码**：审批逻辑在 `approval-flow.service.ts` 和 `approval-records.service.ts` 中，需提取到独立DAO层
- **DAO 方法**：
  - 审批规则DAO：
    - `listRules(page, pageSize, businessType, status, tenantId)` - 分页查询规则列表
    - `getRuleById(id, tenantId)` - 查询规则详情
    - `createRule(data, tenantId)` - 创建规则
    - `updateRule(id, data, tenantId)` - 更新规则
    - `deleteRule(id, tenantId)` - 删除规则
  - 审批实例DAO：
    - `listInstances(page, pageSize, applicantId, status, tenantId)` - 分页查询实例列表
    - `getInstanceByNo(instanceNo, tenantId)` - 根据编号查询实例
    - `createInstance(data, tenantId)` - 创建审批实例
    - `updateInstanceStatus(instanceNo, status, currentStep, tenantId)` - 更新实例状态
    - `cancelInstance(instanceNo, tenantId)` - 撤销审批
  - 审批任务DAO：
    - `listTasks(page, pageSize, approverId, status, tenantId)` - 分页查询待办任务
    - `getTaskById(id, tenantId)` - 查询任务详情
    - `createTask(data, tenantId)` - 创建审批任务
    - `approveTask(id, comment, tenantId)` - 通过任务
    - `rejectTask(id, comment, tenantId)` - 拒绝任务
    - `getInstanceTasks(instanceNo, tenantId)` - 查询实例的所有任务
- **DDL 表**：approval_rule（已有）、approval_instance（新建）、approval_task（新建）
- **测试用例**（至少8个）：
  - 创建审批规则 - 正常流程
  - 创建审批规则 - 审批链配置校验
  - 提交审批 - 自动生成审批任务
  - 审批通过 - 流转到下一级
  - 审批拒绝 - 终止审批流程
  - 审批通过 - 最后一级完成
  - 撤销审批 - 申请人撤销
  - 查询待办任务 - 分页+状态筛选