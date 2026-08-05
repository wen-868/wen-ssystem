# 任务卡：ajian_r78_01（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R78-01

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R78-01 — 支付幂等与敏感信息脱敏**，归属后端职责（AUDIT-REPORT P0）。

1. **必读文件（开工前必须逐一阅读）**：
   - `docs/项目规则.md`（2.1/2.2 纪律、五道防线）
   - `docs/tasks/current-tasks.md`（R78 轮次 + 必读清单）
   - `docs/memories/阿坚-记忆.md`
   - `docs/reports/审计报告核对结论-2026-08-06.md`（R6/R20/R22/R58 核实）
2. **问题（已核实）**：
   - R6：`share.service.ts:202-205` 微信回调 `paid_amount = paid_amount + amount`，无幂等锁，并发回调可重复入账
   - R22/R58：`share.service.ts:230-232` 支付单 `pay_no = makeBizNo("ZF")` 无 source_no+channel 幂等键，重复点击建多张单
   - R20：`share.service.ts:143,169` 分享页明文返回 customerMobile
3. **修复方向（最小改动铁律）**：
   - wxNotifyCollection：事务 + `SELECT ... FOR UPDATE` 或唯一约束，防并发重复入账
   - 支付创建：先查 source_no+channel 已存在则复用/拒绝，或加唯一索引
   - customerMobile 返回脱敏（138****1234）；**不改变量名/不重构其他逻辑**
4. **验收标准**：
   - `npm run typecheck` 0 errors；`npx vitest run` 全通过
   - 新增幂等/脱敏相关用例（可防回归）
   - `rg "customerMobile" backend/src/services/share.service.ts` 仅脱敏后返回（含 SQL 原字段读取可保留）
5. **完成后**：更新 current-tasks.md R78-01 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
