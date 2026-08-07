# R95-04 任务卡 — 生产加固三件套（阿坚）

> 派单：凌舟 2026-08-07　优先级：P1（迁移修正）/ P2（备份、体检）　预计：1.5 天

## 必读文件

1. `docs/tasks/current-tasks.md` —— R95-04 修复安排表 + R95-03 事故记录（背景必读）
2. `docs/项目规则.md` / `docs/项目统一标准.md` / `docs/踩坑日志.md` / `docs/memories/阿坚-记忆.md`

## 任务一：迁移文件 MySQL 兼容语法修正（P1）

**问题**：以下迁移文件使用 MySQL 不支持的 `ADD COLUMN IF NOT EXISTS` / `ADD INDEX IF NOT EXISTS`（仅 MariaDB 支持），生产执行报 1064 跳过，字段/索引未添加：

| 文件 | 位置 |
|------|------|
| `003_phase2_schema.sql` | L300-302（t_sale_bill 的 sale_type/due_date/statement_id） |
| `007_phase5_schema.sql` | L115（t_store.status） |
| `013_phase7_sale_bill_credit.sql` | L7-12（t_sale_bill sale_type/due_date + 索引） |
| `103_member_register.sql` | L2-3（t_member password_hash/register_source） |
| `108_miniapp_member_wholesale.sql` | L146（t_member growth_value） |

**修复**：统一改为标准语法（去掉 `IF NOT EXISTS`，由迁移引擎 safeExec 容错——列已存在时报错跳过、不存在则添加）。注意保持中文注释说明。修正后本地跑一遍 `runMigrations` 逻辑验证（可用 USE_MOCK_DB 或直接检查 SQL 语法）。

**验收**：5 个文件无 `IF NOT EXISTS` 残留（CREATE TABLE 场景除外）；`npm run build` exit 0；给凌舟输出修正后文件清单。

## 任务二：备份脚本增强（P2）

**问题**：`deploy/02-mysql-backup.sh` 每日 02:00 单次备份（crontab `0 2 * * *`），R95-03 事故暴露恢复窗口 11 小时。

**修复**：增强 `deploy/02-mysql-backup.sh`：
1. 每日 3 次备份（02:00 / 10:00 / 18:00，crontab 3 行）
2. 保留策略：保留最近 14 天备份，自动清理更早的
3. 可选：增加异地 rsync 支持（配置变量，默认关闭，注释说明）
4. 备份文件名含时分（如 `liquor_inventory_YYYYMMDD_HHMMSS.sql.gz`），避免同一天覆盖

**验收**：脚本语法检查（`bash -n`）；crontab 示例更新到文档；输出修改后脚本与 crontab 配置。

## 任务三：生产 schema 体检脚本（P2）

**问题**：mock 库掩盖结构漂移（如 t_member.contact 仅 mock 有、生产缺，R95-03 暴露）。

**修复**：新建 `scripts/schema-audit.mjs`：
1. 扫描 `backend/src` 代码中所有 `FROM/JOIN/INTO/UPDATE ... t_xxx` 引用的表与列（正则提取）
2. 连接生产 MySQL（读 .env 凭据），用 information_schema 对比：缺表、缺列、列类型不匹配
3. 输出 Markdown 差异报告到 `docs/reports/schema-audit-<日期>.md`
4. 只读，不修改数据库

**验收**：本地运行（mock 环境跳过连接或允许传入连接串）；在服务器可运行；输出差异报告样例。

## 通用要求

- 只改任务范围内的文件，不碰无关代码
- 完成后更新 current-tasks.md R95-04 对应项状态，任务卡移至 `docs/tasks/inbox/archive/`，向凌舟回报（任务标识 + 复述 + 验证证据）
