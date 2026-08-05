# 任务卡：ajian_r77_02（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R77-02

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R77-02 — 依赖漏洞审计 + API 契约补录**，归属后端职责。

1. **必读文件（开工前必须逐一阅读）**：
   - `docs/项目规则.md`（重点：2.1/2.2 纪律、五道防线）
   - `docs/tasks/current-tasks.md`（R77 轮次 + 必读清单）
   - `docs/memories/阿坚-记忆.md`
   - `docs/reports/审计报告-10大维度-2026-08-06.md`（维度 1/10 的发现）
2. **问题**：
   - 未执行 `npm audit`，依赖漏洞状态未知
   - `POST /api/admin/reports/export` 已在后端实现但未录入 `docs/API接口文档.md`（阿澈 R76-04 提请）
3. **修复方向（最小改动铁律）**：
   - 对 backend（含 ai-base）执行 `npm audit`，记录漏洞清单；**只修复真实高危漏洞**，修复后重跑 audit 与全量测试
   - 补录 `POST /api/admin/reports/export` 契约到 API 文档（按契约格式：请求体/响应/后端文件/前端文件）
   - 核对其余「已实现未收录」接口（如存在），一并补录；**不修改无关代码**
4. **验收标准**：
   - `npm audit` 报告已产出，高危漏洞已修复或已记录豁免理由
   - `docs/API接口文档.md` 含 reports/export 契约
   - `npm run typecheck` 0 errors；`npx vitest run` 全通过（无回归）
5. **完成后**：更新 current-tasks.md R77-02 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
