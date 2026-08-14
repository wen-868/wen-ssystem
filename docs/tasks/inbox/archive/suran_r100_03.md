# R100-03 苏然：消息详情/删除/批量删除 + 操作日志详情/类型 + 报表权限批量/审计详情

> 派单人：凌舟 | 日期：2026-08-14 | 优先级：P1

## 背景

移动端消息、操作日志、报表权限三块存在「开发中」占位，需后端补接口 + 前端真实对接。

## 必读

同 R100-01（读 `docs/memories/苏然-记忆.md`）。

## 任务内容

### 1. 消息中心
- 后端：`notification` 相关补
  - GET /api/admin/notifications/:id（单条详情）
  - DELETE /api/admin/notifications/:id（单条删除）
  - POST /api/admin/notifications/batch-delete（批量删除，body: { ids: number[] }）
- 前端：`api/modules/notifications.ts` + `pages/notifications/notifications.vue`、`notification-detail.vue` 对接

### 2. 操作日志
- 后端：补
  - GET /api/admin/operation-logs/:id（详情）
  - GET /api/admin/operation-logs/types（操作类型枚举）
- 前端：`api/modules/operation-logs.ts` + `pages-sub/admin/system/operation-logs.vue` 对接

### 3. 报表权限
- 后端：补
  - POST /api/admin/report-permissions/batch（批量设置权限）
  - GET /api/admin/report-permissions/audit-logs/:id（审计日志详情）
- 前端：`api/modules/report-permission.ts` + `pages-sub/admin/report-permission/audit-detail.vue` 对接

## 验收

同 R100-01 验收标准。
