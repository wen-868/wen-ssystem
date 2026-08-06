# 任务卡：ajian_r83_01（阿坚）

> 派单人：凌舟（项目总负责人）
> 派单时间：2026-08-06
> 任务标识：R83-01

## 任务正文（必须完整阅读并复述关键内容）

你负责 **R83-01 — 后端 + 数据库补客户「联系人」字段**（客户版块四要素，P0）。

1. **必读文件**：`docs/项目规则.md`、`docs/tasks/current-tasks.md`（R83 轮次）、`docs/memories/阿坚-记忆.md`。
2. **问题（凌舟已核实）**：客户信息四要素中「联系人」全链路缺失——`t_member` 无 `contact` 列（全库 contact 仅供应商表）；`customer.service.ts` 的列表 SELECT、createCustomer、updateCustomer 均无 contact 字段。客户名称/电话/地址已齐备（address 由迁移 011 已补）。
3. **修复方向（最小改动铁律）**：
   - 新建迁移 `docs/migrations/122_member_contact.sql`：`ALTER TABLE t_member ADD COLUMN contact VARCHAR(64) DEFAULT NULL COMMENT '联系人' AFTER name`，带 IF NOT EXISTS 保护（参考 011 写法）
   - `customer.service.ts`：列表 SQL 加 `m.contact`；createCustomer/updateCustomer 请求体与 SET 支持 contact
   - **不碰无关代码**
4. **验收标准**：
   - 迁移脚本含 IF NOT EXISTS 保护与验证语句
   - `npm run typecheck` 0 errors
   - `rg "contact" backend/src/services/admin/customer.service.ts` 存在（列表/创建/更新三处）
   - `npx vitest run src/__tests__/services/admin/customer.service.test.ts`（如有）通过
5. **完成后**：更新 current-tasks.md R83-01 状态附证据、更新记忆文件、归档任务卡、git commit 后由凌舟统一收口推送。
