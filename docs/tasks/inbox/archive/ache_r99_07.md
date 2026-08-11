# 任务卡：ache_r99_07 — R99-07 [P1] 审批规则页契约对齐 + 后端错误处理专项

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（全栈）
- **优先级**：P1（审批规则创建/编辑当前不可用）
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、背景

R99-06（审批详情契约修复）收口时核实到审批模块其余契约缺口：
1. 前端 `ApprovalRules.vue` 规则表单 payload（approvalChain `{role,order}`、status `ACTIVE/INACTIVE`、旧 businessType 枚举）与后端 zod（`{level, approverType(ROLE/USER/DEPARTMENT), approverValue}`、status 数字、`PURCHASE_ORDER` 等枚举）不匹配 → 创建/编辑规则被 zod 拒绝
2. 前端 `deleteApprovalRule` 调 `DELETE /admin/approval/rules/:id`，后端**无此接口**
3. 后端提交/审批业务失败抛 Error 返回 500（如无规则时 submit 报「服务器内部错误」），应为 4xx

## 二、必读文件

- `admin-web/src/views/system/ApprovalRules.vue`（前端表单）
- `admin-web/src/api/system.ts`（approval 相关 API 封装）
- `backend/src/controllers/admin/approval-flow.controller.ts`（zod 契约）
- `backend/src/services/admin/approval-flow.service.ts`（规则 CRUD）
- `backend/src/routes/approval.routes.ts`（路由注册）
- `backend/src/controllers/admin/approval-records.controller.ts` + service（submit 业务失败场景）

## 三、任务

### 1. 前端 ApprovalRules.vue 表单对齐后端 zod
- approvalChain：`{ role: string, order: number }` → `{ level: number, approverType: 'ROLE'|'USER'|'DEPARTMENT', approverValue: string }`；表单增加审批人类型选择（角色/用户/部门）
- status：字符串 ACTIVE/INACTIVE → 数字（1 启用 / 0 禁用），el-switch active-value/inactive-value 改数字
- businessType：用后端枚举（PURCHASE_ORDER 等，查后端枚举清单）
- escalationLevel：对齐 1-3
- 提交 payload 与后端 zod 完全一致

### 2. 后端补 DELETE /api/admin/approval/rules/:id
- approval-flow controller/service 增加 deleteRule（软删或硬删按现有规则表字段，存在 deleted/status 则置位）
- approval.routes.ts 注册 `approvalRouter.delete("/rules/:id", ...)`

### 3. 后端业务失败改 4xx
- approval-records submit/审批：无匹配规则等业务错误抛 `AppError("未配置审批规则", 400)`（查项目 AppError 用法），不再裸抛 Error 500
- 排查同文件其他业务失败点一并处理（至少 submit）

## 四、验证

- 后端 `npm run typecheck` + `npm run build` exit 0
- admin-web `npm run build:check` exit 0
- 本地实测：创建规则（payload 通过 zod 校验）→ 编辑 → 删除（DELETE 200）；submit 无规则场景返回 400 + 明确提示（非 500）
- 提交推送 origin/main（中文提交信息）

## 五、验收

- 规则页创建/编辑/删除全链路可用；submit 业务失败为 4xx
- build 全过；current-tasks.md 更新 R99-07 完成记录；任务卡归档

## 六、注意事项

- 全程简体中文；最小改动：只改审批模块前后端
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-07、复述关键内容、给完成结果与验证证据
