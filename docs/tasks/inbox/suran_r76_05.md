# 任务卡：suran_r76_05（苏然）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R76-05

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R76-05 — 全量回归 + 端到端验收报告**，归属 QA 职责。

1. **必读文件（开工前必须逐一阅读）**：
   - `docs/项目规则.md`（重点：2.1 任务分配与责任到人、2.2 工作纪律、五道防线）
   - `docs/tasks/current-tasks.md`（R76 轮次 + 顶部必读清单）
   - `docs/memories/苏然-记忆.md`（恢复上下文）
   - `docs/踩坑日志.md`（避免重复踩坑）
2. **背景**：R76-01/02/03/04 已完成并通过凌舟复核（墨列表页统一、阿坚测试覆盖、墨 vue-tsc、阿澈敬请期待）。本轮对 R74-R76 全部改动做全量回归，确认无功能回归。
3. **回归范围**：
   - 后端：`npm run typecheck` + `npx vitest run`（预期 435 文件/5056 用例全过）
   - admin-web：`npx vue-tsc -b` 0 errors + `npm run build` exit 0
   - app-mobile：`npm run build:h5` + `npm run build:app` exit 0
   - 浏览器走查：登录 → 工作台 → 收银台（加购/结算）→ 列表页抽查，控制台 0 error
4. **验收标准**：报告 `docs/reports/test-report-2026-08-06.md` 含真实命令输出；0 skip、0 fail；发现的问题写入任务文件下一轮。
5. **完成后**：更新 current-tasks.md R76-05 状态、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
