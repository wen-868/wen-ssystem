# 任务卡：ajian_r76_02（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R76-02

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R76-02 — 后端 services 层测试覆盖补齐**，归属后端职责。

1. **必读文件（开工前必须逐一阅读）**：
   - `docs/项目规则.md`（重点：2.1 任务分配与责任到人、2.2 工作纪律、五道防线）
   - `docs/tasks/current-tasks.md`（R76 轮次 + 顶部必读清单）
   - `docs/memories/阿坚-记忆.md`（恢复上下文）
   - `docs/项目统一标准.md`（覆盖率 100% 标准）
2. **问题**：services 层 179 个文件为最大技术债；`backend/vitest.config.ts` 阈值仅 90%（违反 100% 标准）。
3. **修复方向**：优先补齐核心业务 service 测试（采购/销售/库存/客户/财务/营销）；测试真实有效，禁止 it.skip/describe.skip；**最小改动，不碰无关业务代码**。
4. **验收标准**：
   - `npm run typecheck` 0 errors
   - `npx vitest run` 全通过（0 skip、0 fail）
   - 核心 services 覆盖率提升有真实报告（coverage 输出）
5. **完成后**：
   - 在 `docs/tasks/current-tasks.md` R76-02 状态标记完成并附证据
   - 更新 `docs/memories/阿坚-记忆.md`
   - 将本任务卡移动到 `docs/tasks/inbox/archive/`
   - git commit（信息用中文，格式 `type: 中文描述`）后由凌舟统一收口推送
