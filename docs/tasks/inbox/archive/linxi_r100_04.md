# R100-04 林夕：交接班（创建/详情/统计/盘点）+ 会员详情/积分/明细/订单

> 派单人：凌舟 | 日期：2026-08-14 | 优先级：P1

## 背景

移动端交接班与会员两块功能为「开发中」占位，需后端补接口 + 前端真实对接。

## 必读

同 R100-01（读 `docs/memories/林夕-记忆.md`）。

## 任务内容

### 1. 交接班
- 后端：确认或补（参考 `backend/src/services/store/shift.service.ts` 已有统计能力）
  - POST /api/store/shifts（创建交接班）
  - GET /api/store/shifts/:shiftNo（详情）
  - GET /api/store/shifts/:shiftNo/sales（销售统计）
  - GET /api/store/shifts/:shiftNo/check（盘点）
  - POST /api/store/shifts/:shiftNo/check（盘点提交）
- 前端：`api/modules/store.ts` 交接班 5 处 reject 占位改真实调用，对接对应页面

### 2. 会员详情/积分/明细/订单
- 后端：确认或补
  - GET /api/store/members/:id（详情）
  - GET /api/store/members/:id/points（积分）
  - GET /api/store/members/:id/points/logs（积分明细）
  - GET /api/store/members/:id/orders（会员订单）
- 前端：`api/modules/store.ts` 会员 4 处 reject 占位改真实调用，对接对应页面

## 验收

同 R100-01 验收标准。
