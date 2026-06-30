# 墨 · 系统设置模块 · 管理后台前端

**日期**：2026-06-30
**状态**：待开始

---

## 任务概览

| # | 任务 | 优先级 | 状态 |
|---|------|--------|:---:|
| 1 | 门店管理页面 - 完善列表+表单+详情 | P0 | :x: |
| 2 | 员工管理页面 - 完善列表+表单+密码重置 | P0 | :x: |
| 3 | 角色权限页面 - 完善权限树+用户分配 | P0 | :x: |
| 4 | 操作日志页面 - 完善筛选+详情+导出 | P0 | :x: |
| 5 | 参数配置页面 - 新建分组Tabs配置页 | P0 | :x: |
| 6 | 审批流程页面 - 完善规则+审批+待办 | P1 | :x: |

---

## 详细说明

### 1. 门店管理页面 - 完善列表+表单+详情
- **文件**：`admin-web/src/views/StoresView.vue`（改造）、`admin-web/src/views/SystemSettings.vue`（新建，统一入口页）
- **现有代码**：`StoresView.vue`（门店列表+新增+编辑弹窗+微信信息拉取）、`System.vue`（门店Tab+员工Tab）
- **改造内容**：
  - 创建统一入口页 `SystemSettingsView.vue`，作为系统设置模块的导航容器
  - 改造 `StoresView.vue`：接入 `/api/admin/system/stores` 新API
  - 新增字段：营业时间（openTime/closeTime）、地理坐标（lng/lat）、门店头像（wxHeadImg预览）
  - 新增功能：门店状态切换（营业中/已关闭/暂停中，三态切换）、门店详情抽屉（展示完整信息含地图定位）
  - 状态标签优化：营业中(绿色)/已关闭(灰色)/暂停中(橙色)
  - 表单校验：门店名称必填、电话格式校验、配送半径范围1-100
  - 微信信息拉取：保留现有功能，输入AppID后拉取商户名称、客服电话、头像
- **路由**：`/system/stores`（在 `router/index.ts` 中注册）

### 2. 员工管理页面 - 完善列表+表单+密码重置
- **文件**：`admin-web/src/views/EmployeesView.vue`（改造）
- **现有代码**：`EmployeesView.vue`（员工列表+搜索+新增编辑弹窗+启用/禁用）
- **改造内容**：
  - 接入 `/api/admin/system/employees` 新API
  - 新增字段：工号（staffNo，自动生成+手动修改）、部门（department）、最后登录时间
  - 新增功能：密码重置按钮（表格操作列，二次确认弹窗）、角色下拉（从RBAC角色表获取）
  - 新增筛选：门店筛选（下拉选择）、角色筛选（下拉选择）
  - 门店下拉选项：从 `/api/admin/system/stores` 获取
  - 角色下拉选项：从 `/api/admin/system/roles` 获取
  - 角色标签：管理员(红色danger)/店长(橙色warning)/员工(蓝色primary)
  - 状态标签：在职(绿色success)/离职(灰色info)
  - 表单校验：用户名必填、姓名必填、手机号格式校验、角色必选
- **路由**：`/system/employees`（在 `router/index.ts` 中注册）

### 3. 角色权限页面 - 完善权限树+用户分配
- **文件**：`admin-web/src/views/SystemRoles.vue`（改造）
- **现有代码**：`SystemRoles.vue`（角色列表+权限树+创建编辑弹窗+分配用户弹窗）
- **改造内容**：
  - 接入 `/api/admin/system/roles` 新API
  - 新增字段：数据权限范围（dataScope：全部/部门/门店/仅本人，下拉选择）
  - 权限树增强：三级结构（模块→页面→按钮），每个节点支持 READ/WRITE/DELETE/EXPORT 四种操作类型
  - 权限树数据结构更新：覆盖所有12个一级模块（新增订单管理/即时零售/系统设置等模块的权限节点）
  - 新增 "系统设置" 权限模块：system:stores(门店管理)/system:employees(员工管理)/system:roles(角色权限)/system:audit(操作日志)/system:config(系统配置)/system:approval(审批流程)
  - 分配用户弹窗：显示已分配用户列表，支持多选添加/移除
  - 删除角色时校验：弹窗提示"该角色下已有N个用户，确认删除？"
  - 角色编码自动生成：基于角色名称拼音首字母大写
- **路由**：`/system/roles`（在 `router/index.ts` 中注册）

### 4. 操作日志页面 - 完善筛选+详情+导出
- **文件**：`admin-web/src/views/AuditLogView.vue`（改造）
- **现有代码**：`AuditLogView.vue`（统计卡片+筛选栏+日志列表+详情抽屉+导出）
- **改造内容**：
  - 接入 `/api/admin/system/audit-logs` 新API
  - 新增筛选：IP地址输入框、操作人姓名输入框
  - 新增操作类型：IMPORT(导入)、APPROVE(审批)
  - 新增操作类型标签颜色：IMPORT(紫色)、APPROVE(青色)
  - 详情抽屉增强：JSON格式化显示（请求参数和变更数据使用代码高亮）
  - 导出功能优化：支持导出当前筛选结果（CSV格式），导出时显示进度提示
  - 新增功能：日志清理按钮（管理员可清理90天前日志，二次确认）
  - 统计卡片优化：新增"导出操作"、"登录操作"统计
- **路由**：`/system/audit-log`（在 `router/index.ts` 中注册）

### 5. 参数配置页面 - 新建分组Tabs配置页
- **文件**：`admin-web/src/views/SystemConfigView.vue`（新建）
- **现有代码**：无独立配置页面，`System.vue` 仅含门店和员工Tab
- **新建内容**：
  - 分组Tabs布局：通用配置/订单配置/支付配置/库存配置/通知配置
  - 每个Tab内为表单布局：
    - 通用配置Tab：公司名称(文本输入)、公司Logo(图片上传+预览)、联系电话(文本)、系统主题色(颜色选择器)
    - 订单配置Tab：自动接单(开关)、订单超时时间(数字输入+分钟后缀)、订单自动取消时间(数字输入+分钟后缀)
    - 支付配置Tab：微信支付(开关)、支付宝(开关)、线下支付(开关)
    - 库存配置Tab：低库存预警阈值(数字输入)、保质期预警天数(数字输入)、自动补货(开关)
    - 通知配置Tab：短信通知(开关)、微信通知(开关)、站内信(开关)
  - 底部操作栏：保存按钮（批量保存所有分组配置）、重置按钮（恢复默认值）
  - 接入 `/api/admin/system/configs` API：`GET /:group` 获取分组配置，`PUT /batch` 批量保存
  - 配置保存后显示成功提示
  - 每个配置项右侧显示说明文字（灰色小字）
  - 页面宽度限制（max-width 800px），居中布局
- **路由**：`/system/config`（在 `router/index.ts` 中注册）

### 6. 审批流程页面 - 完善规则+审批+待办
- **文件**：`admin-web/src/views/ApprovalRules.vue`（改造）、`admin-web/src/views/ApprovalDetail.vue`（改造）、`admin-web/src/views/MyApprovals.vue`（改造）
- **现有代码**：`ApprovalRules.vue`（规则列表+Tab切换）、`ApprovalDetail.vue`（审批详情+时间线）、`MyApprovals.vue`（我的申请+提交审批）
- **改造内容**：
  - 接入 `/api/admin/system/approval` 新API
  - 审批规则管理（`ApprovalRules.vue`）：
    - 新增业务类型：价格变更(PRICE_CHANGE)、信用额度(CREDIT_LIMIT)
    - 审批链配置交互优化：动态添加/删除审批级别，每个级别拖拽排序
    - 新增SLA时效设置（小时输入）、升级级别设置
    - 规则表单增加描述字段
  - 审批详情（`ApprovalDetail.vue`）：
    - 时间线颜色优化：通过(绿色)/拒绝(红色)/待审批(橙色)/已撤销(灰色)
    - 新增审批操作按钮：通过/拒绝（仅待审批状态显示）
    - 新增撤销按钮（申请人可撤销PENDING状态的审批）
  - 我的申请（`MyApprovals.vue`）：
    - 新增业务类型筛选
    - 提交审批弹窗：选择审批规则、填写标题和内容
    - 新增审批状态筛选（全部/审批中/已通过/已拒绝）
  - 新增"我的待办"Tab（在审批规则页面）：展示当前用户待审批的任务列表
- **路由**：`/system/approval`（在 `router/index.ts` 中注册）