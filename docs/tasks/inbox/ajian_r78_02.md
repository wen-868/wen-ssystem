# 任务卡：ajian_r78_02（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R78-02（后端部分）

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R78-02 后端部分 — ENCRYPTION_KEY 强校验（AUDIT-REPORT R3）**。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R78 轮次）、`docs/memories/阿坚-记忆.md`、`docs/reports/审计报告核对结论-2026-08-06.md`。
2. **问题（已核实）**：`docker-compose.yml:108` 的 `ENCRYPTION_KEY: ${ENCRYPTION_KEY:-}` 留空时降级为 `""`，导致 AI 底座密钥明文落库风险（AUDIT R3）。
3. **修复方向（最小改动铁律）**：
   - ai-base 启动时强校验 ENCRYPTION_KEY：为空或占位符（如 `CHANGE_ME`/`your-encryption-key`）则拒绝启动并给出明确报错
   - `deploy/auto-deploy.sh` / `deploy/ai-base-deploy.sh` 检测到占位时用 `openssl rand` 自动生成并写入 .env
   - 同步检查 backend 的 CSRF_SECRET 等密钥是否同类校验
   - **不碰无关代码**
4. **验收标准**：
   - 无 ENCRYPTION_KEY 时 ai-base 启动失败且报错明确；配置后正常启动
   - `npm run typecheck` 0 errors；相关单测通过
   - 部署脚本含自动生成逻辑
5. **完成后**：更新 current-tasks.md、记忆文件、归档任务卡、git commit 后由凌舟统一收口。
