# 任务卡：ajian_r80_03（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R80-03

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R80-03 — 售后统计路由被 :id 遮蔽（Express 路由顺序）**（阶段 1-2 订单版块，P1）。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R80 轮次）、`docs/memories/阿坚-记忆.md`。
2. **问题（凌舟已核实）**：`backend/src/routes/aftersale.routes.ts` 中 `adminAftersaleRouter.get("/aftersales/statistics")`（58 行）注册在 `get("/aftersales/:id")`（38 行）**之后**，Express 按注册顺序匹配，`GET /api/admin/aftersales/statistics` 会命中 `:id` 路由导致 404。前端已做防御（统计失败置空态/零值），但统计接口实际不可用。
3. **修复方向（最小改动铁律）**：
   - 将 `/aftersales/statistics` 静态路由移到 `:id` 路由之前（Express 静态路由优先惯例）
   - **仅调整路由顺序，不碰 controller/其他逻辑**
4. **验收标准**：
   - `GET /api/admin/aftersales/statistics` 不再被 :id 拦截（mock/路由测试可验证）
   - `npm run typecheck` 0 errors；相关路由测试通过
5. **完成后**：更新 current-tasks.md R80-03 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
