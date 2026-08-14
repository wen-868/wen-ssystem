# R100-03b 苏然：消息详情/删除/批量删除 + 操作日志详情/类型 + 报表权限批量/审计详情

> 派单人：凌舟 | 日期：2026-08-14 | 优先级：P1 | 说明：原 suran_r100_03 因 API 余额不足中断，本任务卡重派，内容不变

## 背景

移动端消息、操作日志、报表权限三块存在「开发中」占位，需后端补接口 + 前端真实对接。

## 必读

`docs/项目统一标准.md`、`docs/项目规则.md`、`docs/tasks/current-tasks.md`、`docs/踩坑日志.md`、`docs/API接口文档.md`、`docs/memories/苏然-记忆.md`。参考 `app-mobile/src/api/modules/` 现有模块风格与 `backend/src/routes|controllers|services` 现有分层。

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

1. 后端类型检查通过，新增接口 curl 冒烟 200；2. 前端构建通过（`npm run build:h5`）；3. 移动端对应页面无“开发中”占位、无假数据；4. 更新 `docs/API接口文档.md` 与 `docs/数据库变更清单.md`。

## 提交

不要自行提交推送！完成代码后把改动留在工作区，最终回复中列明改动文件清单与验证证据，由凌舟统一收口提交。完成后把任务卡移入 `docs/tasks/inbox/archive/` 并在 `current-tasks.md` 更新状态。
