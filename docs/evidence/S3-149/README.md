# S3-149 证据目录（空库/灾备可用性：init_database.sql 建表被静默丢弃）

> 执行人：阿坚（后端）｜2026-10-02｜工作区 `D:\Users\ZXQL\wt-agents\issue-224`，分支 `agent/issue-224`
> 被测对象：`backend/src/shared/migration.ts` 第 1.5 步修复（+18/-4）
> 被测装置树：`%TEMP%\s3149-scratch` = 本工作区 `backend/src` + **S3-144 补丁（取自未合并分支 `agent/issue-218`）+ 迁移 192** + `docs/{migrations,init_database.sql}`
> 私有 DB：`D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin` 起的 MariaDB 11.4.5，`127.0.0.1:3403`，datadir 在 `%TEMP%`（**未连生产库**）

## 文件清单

| 文件 | 内容 |
|:--|:--|
| `check-tables.mjs` | 空库逐表核对：用**同源** `splitSqlStatements` 解析 `docs/init_database.sql` 的声明表 → 与 `information_schema` 比对；并打印 `t_store`/`t_sys_config` 形状 |
| `run-migrations-only.mjs` | 只跑 `runMigrations()`（不跑 S3-144 装置），用于防退化分支与已有库幂等复跑 |
| `unit-equiv.mjs` | 等价单测：逐字复刻 `backend/src/__tests__/shared/migration-split.test.ts`（S3-51 守门）6 条断言 + 2 条 S3-149 新断言 |
| `s3149-run.ps1` | 跑 S3-144 装置的 runner（`-Mode fresh\|full`、`-DbName <空库>`） |
| `run-fresh-fixed.txt` / `run-full-fixed.txt` | **修复后**：真空白库 fresh / full 全量原始输出 |
| `table-check-fixed.txt` | **修复后**：62 张逐表核对读数 |
| `neg-run-fresh-old.txt` / `neg-run-full-old.txt` | **反测**（第 1.5 步退回旧写法）：fresh / full 原始输出 |
| `neg-table-check-old.txt` | **反测**：61/62，缺 `t_sys_config`；`t_store` 无 `tenant_id`、`status` 为 `tinyint` |
| `guard-zero-statements.txt` | **防退化分支**：文件非空但解析出 0 条 CREATE TABLE ⇒ level 50 报错（无"总0张"假成功） |
| `restore-run-fresh.txt` / `restore-run-full.txt` | **复原后**重跑：两模式全绿 |
| `idempotent-rerun.txt` | 已有库（生产同构）二次复跑迁移日志 |
| `unit-equiv-output.txt` | 等价单测输出（8/8 PASS） |
| `vitest-blocked.txt` | `vitest run` 在沙箱内的失败原文（esbuild `spawn EPERM`） |
| `key-lines.txt` | **关键行汇总**（逐字切片，前缀 = `来源文件:行号`；同名同文重复只留首次出现）——便于快速核对 |

> `run-*.txt` / `neg-*.txt` / `restore-*.txt` / `guard-*.txt` / `idempotent-*.txt` 是**完整 stdout+stderr**（约 145KB/份，绝大部分是逐文件迁移日志）；判据相关行已用 `文件:行` 在回传卡里引用，汇总见 `key-lines.txt`。若要求入库，可只保留本 README + `key-lines.txt` + 3 个 `.mjs` + runner，其余删去。

## 复现步骤（关键）

> **本单跑完时仍保留、可直接复用**：MariaDB 实例 `127.0.0.1:3403`（datadir `%TEMP%\s3149-db-a\data`，`--skip-grant-tables --ssl=OFF`，进程 `mysqld.exe`）与 scratch 树 `%TEMP%\s3149-scratch`。用完请手动结束该 `mysqld.exe`；两个临时目录可直接删。

```powershell
# 0) 起私有 MariaDB（本目录证据用的实例：127.0.0.1:3403）
$mdb = "D:\Users\ZXQL\tools\mariadb\mariadb-11.4.5-winx64\bin"
& "$mdb\mariadb-install-db.exe" --datadir="$env:TEMP\s3149-db-a\data" --port=3403 --password=""
Start-Process -FilePath "$mdb\mysqld.exe" -WindowStyle Hidden -ArgumentList `
  "--datadir=$env:TEMP\s3149-db-a\data","--port=3403","--bind-address=127.0.0.1","--skip-grant-tables","--ssl=OFF","--console"

# 1) 组 scratch 树（backend/src 用本工作区；S3-144 四个 service + 192 + 装置取自 agent/issue-218）
#    —— 见回传卡 §三.1/§三.2 的逐条命令

# 2) 建**空库**后跑装置（fresh / full 各一次，全程无手工补表补列）
& .\s3149-run.ps1 -Mode fresh -DbName s3149_e2e_fresh
& .\s3149-run.ps1 -Mode full  -DbName s3149_e2e_full

# 3) 逐表核对（cwd = scratch 根）
$env:S3149_CHECK_DB="s3149_e2e_fresh"; node .\check-tables.mjs
```

## 关键读数（摘要）

| 项 | 修复后 | 反测（旧写法） |
|:--|:--|:--|
| `init_database.sql` 解析出 CREATE TABLE | **62** | **0** |
| 日志 | `业务表完成（总62张，实际建62，已存在跳过0）` | `业务表完成（总0张，实际建0，已存在跳过0）` |
| 空库表数 / 缺表 | 310 张 / **缺 0** | 309 张 / **缺 `t_sys_config`** |
| `t_store.tenant_id` | `varchar(36) NOT NULL` | 不存在 |
| `t_store.status` | `varchar(20) NOT NULL DEFAULT 'OPEN'` | `tinyint NOT NULL DEFAULT 1` |
| `S3144_MODE=fresh` | **8/8**（EXIT=0） | 8/8（EXIT=0，判据不依赖 `t_sys_config`） |
| `S3144_MODE=full` | **15/15**（EXIT=0） | **红**：`ER_NO_SUCH_TABLE: Table '…t_sys_config' doesn't exist`（EXIT=1） |
