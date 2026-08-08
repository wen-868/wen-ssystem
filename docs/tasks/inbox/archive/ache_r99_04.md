# 任务卡：ache_r99_04 — R99-04 [P1] 全局走查收口（P2 system 抽查 + 页头文案 + 一致性）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（前端设计/开发）
- **优先级**：P1（与 R99-05 并行）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、背景

工作台设计（R99）收口：P0 23 页精设计 + P1 107 页批量套模板已完成。本任务做全局收口：P2 system 模块抽查、页头通用文案微调、152 页一致性走查。

## 二、范围

### 1. P2 system 模块抽查（18 页）
- `admin-web/src/views/system/`：System.vue/SystemConfigView/SystemRoles/MonitorView/ErrorLogView/AuditLogView/FeedbackView/PaymentConfigView/MinipappConfigView（含 R96-02 一键发布）/DepartmentManage/PositionManage/EmployeesView/StoresView/ApprovalRules/ApprovalDetail/MyApprovals/ReportPermission/ConsumerAddress
- 抽查全局主题/tokens 生效情况：表格/卡片/按钮/弹窗视觉是否统一；异常页修复

### 2. 页头副标题微调（8 页）
- 「数据查询与维护」→ 按页面语义替换（CustomerVisits 客户回访 / CreditView 客户赊销 / MemberView 会员管理 / DailySettleView 日结对账 / SaleReturnView 销售退货 / StoreControlView 门店管控 / OrderFulfillView 订单履约 / ShiftView 交班管理）

### 3. 152 页一致性走查
- 走查全部页面截图（可复用 R99-01/02/03 截图 + 补充 system/根目录），重点核对：页头层级、指标卡、筛选栏、表格卡、分页、状态标签、空态、留白一致性
- 修复发现的明显视觉问题（布局错乱/挤压/遮挡/风格断层）

## 三、验证

- admin-web `npm run build:check` exit 0
- 走查截图归档 docs/reports/R99-04-*；无回归
- 提交推送 origin/main（中文提交信息）

## 四、验收

- system 18 页视觉正常统一；8 页页头文案语义化；152 页整体无风格断层
- build 通过、截图齐备
- current-tasks.md 更新 R99-04 完成记录（R99 系列收口）；任务卡归档

## 五、注意事项

- 全程简体中文；最小改动：只改 admin-web 样式/文案；**禁止改动 backend/miniapp/app-mobile/saas-admin**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-04、复述关键内容、给完成结果与验证证据
