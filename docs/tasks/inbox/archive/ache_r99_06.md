# 任务卡：ache_r99_06 — 审批详情页接口契约修复（前端 detail/:id vs 后端 instances/:instanceNo）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（全栈）
- **优先级**：P1（功能 bug：审批详情不可用）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、问题（R99-04 收口发现，已核实）

- 前端：`admin-web/src/api/system.ts` `fetchApprovalDetail(id)` → `GET /admin/approval/detail/${id}`；`ApprovalDetail.vue` 第 198 行同路径；列表跳转（ApprovalRules.vue / MyApprovals.vue 第 220 行）`router.push('/approval/detail/${row.id}')` 传 **row.id**
- 后端：`approval.routes.ts` 只提供 `GET /instances/:instanceNo`（controller/service 按 `t_approval_instance.instance_no` 字符串查询）
- 结果：详情页接口 404，`ApprovalDetail.vue` catch 后 `router.back()` 静默跳回，审批详情功能不可用

## 二、任务

1. **确认前端 row.id 语义**：MyApprovals.vue 数据来自 listInstances 还是 listTasks？row.id 是实例 id、任务 id 还是 instanceNo？ApprovalRules.vue 跳详情是否合理（规则页跳实例详情？）
2. **统一契约**（二选一，按确认结果取最小改动）：
   - 后端补 `GET /api/admin/approval/detail/:id`：按实例 id 查询（service 新增按 id 查，复用 getInstanceDetail 的任务/日志组装），返回结构对齐前端 ApprovalDetail.vue 期望（approvalNo/title/applicant/approvalNodes 等）
   - 或前端改调 `/instances/:instanceNo` 并跳转传 instanceNo（若 row 有 instanceNo 且语义更准）
3. **验证**：后端 typecheck + build；admin-web build:check；本地实测审批详情页能打开并展示真实数据（mock 后端有数据则验证，无数据至少不静默跳回、给出合理空态/错误提示）
4. **提交推送** origin/main（中文提交信息）

## 三、验收

- 审批详情页接口可用（200），页面正常展示实例详情/节点/日志
- 列表跳详情参数语义正确，不再 404 静默跳回
- build 全过；current-tasks.md 更新完成记录；任务卡归档

## 四、注意事项

- 全程简体中文；最小改动：只改审批相关前后端，不碰其他模块
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-06、复述关键内容、给完成结果与验证证据
