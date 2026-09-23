# MIG-5 证据包：迁移"丢块"根治抽取 + addTablePrefix 同族（REFERENCES / INTO）收口

> 对应派单：`docs/tasks/cards/R101-派单-20260923-MIG.md`（【派单 MIG-5·P0】，执行方：阿坚（后端 · 本地通道））
> 汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端 · 本地子代理代执行）｜2026-09-24
> 回传卡：`docs/tasks/cards/R101-MIG-5-阿坚回传.md`｜关联卡：`docs/tasks/cards/R101-MIG-3-阿坚回传.md`、`docs/tasks/cards/R101-MIG-4-阿坚回传.md`
> 本单**只改** `backend/src/shared/migration.ts` 与其测试（新增本目录）；未改任何 `docs/migrations/*.sql`、未合并/推送任何 PR、未连真库、未执行任何写操作。

---

## 一、交付物落点

| # | 文件 | 说明 |
|---|---|---|
| 1 | `backend/src/shared/migration.ts` | ① 抽出并导出 `splitSqlStatements`（丢块根治），两个调用点（5.5.8 AI 底座兜底建表 / 第 8 步外部迁移）统一改用它；② `addTablePrefix` 同族收口：`INSERT_INTO` 补 `IGNORE`、通用 `INTO` 收窄为 `REPLACE_INTO`、新增 `REFERENCES` |
| 2 | `backend/src/__tests__/shared/migration-split.test.ts`（新增） | #13 原意断言（6 条）+ MIG-5 反测：真实文件 006 的"块被挑出执行"+ 同批写闸门仍生效 + DROP 保护未回归 |
| 3 | `backend/src/__tests__/shared/migration-prefix-family.test.ts`（新增） | REFERENCES（裸名/反引号/已带 t_/含外键的建表）+ INTO 收窄（092 变量赋值不被改、INSERT INTO/INSERT IGNORE INTO/REPLACE INTO 仍覆盖）+ ON UPDATE / ON DUPLICATE KEY UPDATE 不误伤 |
| 4 | 本目录 | 断言复跑 + 反测工具与原始输出 |

**未改动**（覆盖不得减少）：`backend/src/__tests__/shared/migration.test.ts`（MIG-2 反引号断言）、`migration-write-gate.test.ts`（MIG-4 闸门用例）逐字节未变。

---

## 二、工具与产出（全部可复跑）

| 文件 | 用途 | 复跑命令 |
|---|---|---|
| `tools/mig5-lib.mjs` | 把真实源码转成可进程内加载的模块（复用 `docs/evidence/MIG-4/tools/mig4-lib.mjs` 的加载器）+ 两段反退回退变换 | 被下面两个脚本 import |
| `tools/mig5-verify.mjs` | 断言复跑 + 反测（A 丢块根治 / B 写闸门 / C addTablePrefix 同族） | `node docs/evidence/MIG-5/tools/mig5-verify.mjs` → **EXIT=0** |
| `tools/mig5-impact.mjs` | 影响面：对全部 `docs/migrations/*.sql` 逐语句比较"回退版 vs 工作区"的改写差异 | `node docs/evidence/MIG-5/tools/mig5-impact.mjs` → **EXIT=0** |
| `outputs/01-tsc.txt` | `tsc -p backend/tsconfig.json --noEmit` | EXIT=0（空输出） |
| `outputs/02-tsc-testfile.txt` | 两个新增测试文件单独类型检查（tsconfig 排除了 `src/__tests__/**`） | EXIT=0（空输出） |
| `outputs/03-eslint.txt` | `eslint` 三个改动/新增文件 | **0 error / 1 warning**（warning 为 HEAD 既有：`runMigrations` complexity 46） |
| `outputs/03b-eslint-head-baseline.txt` | 同口径对 `HEAD:backend/src/shared/migration.ts` 跑 lint（基线） | 0 error / 1 warning（complexity 46）⇒ **本单未引入新的 lint 问题** |
| `outputs/04-vitest-blocked.txt` | vitest 在本沙箱不可运行的原始输出（环境限制） | esbuild `spawn EPERM`（errno -4048） |
| `outputs/05-verify.txt` | 断言复跑 + 反测全量原始输出 | EXIT=0 |
| `outputs/05-impact.txt` | 影响面全量原始输出 | EXIT=0 |
| `outputs/00b|00c|00d-…-migration.ts.txt` | 三个"回退版源码"落盘（供人工核对回退是否忠实） | 由 `mig5-verify.mjs` 生成 |
| `outputs/06-git-status.txt` | `git status --porcelain`（改动落工作区，未 commit/push） | 4 项，全部属本单范围 |

---

## 三、关键数字（原始输出见 `outputs/05-verify.txt`、`outputs/05-impact.txt`）

### 3.1 丢块根治（真实文件 `docs/migrations/006_phase4_schema.sql`，默认写闸门 block）

| 指标 | 数值 |
|---|---|
| 修复后被挑出、修复前被整块丢弃的语句 | **6 条**：`SET FOREIGN_KEY_CHECKS = 0` + 5 张追溯表 `CREATE TABLE IF NOT EXISTS t_trace_config / t_trace_code / t_trace_event_log / t_trace_scan_log / t_recall_record` |
| 修复前执行、修复后不再执行的语句 | **0 条**（无反向丢失） |
| 下发语句总数 | 正常版 208 vs 回退版 202（差值 6，与上表一一对应） |
| 被丢弃块内的 `DROP TABLE` | 正常版 **7 条**走 DROP 生产保护分支（有日志、不执行）；回退版 0 条（被 split 过滤器静默丢弃，保护分支根本看不到） |
| 同批 `INSERT IGNORE INTO price_level`（006 第 82 行） | 修复后进入执行路径，但默认 block **跳过**，并留 1 行日志：`[migration] 006_phase4_schema.sql: 写闸门 block 跳过 INSERT 语句（目标 price_level）；…` |

> 与 `docs/evidence/MIG-1/预期清单.md`（苏然独立口径）对 006 的清单一致：该文件被丢块涉及 `SET FOREIGN_KEY_CHECKS = 0`、若干 `DROP`、`INSERT IGNORE`、5 张 `CREATE TABLE` —— 本单实测的"首次被挑出"正是其中**可执行**的 6 条（DROP 仍被生产保护拦住）。

### 3.2 addTablePrefix 同族收口影响面（全部 176 个迁移文件 / 1137 条语句）

| 类别 | 条数 |
|---|---|
| 新旧改写**逐字节一致** | 1110 |
| **仅新版本加前缀**（首次获得覆盖；全部为 `REFERENCES` 相关，如 `008`/`016`/`017`/`018`/`031`~`042`/`067`/`069`/`074`/`082`） | **25** |
| **仅旧版本加前缀**（收窄 INTO 后的"覆盖减少"） | **2**，逐条点名：`092_租户ID.sql:21 SELECT COUNT(*) INTO col_count …`、`092_租户ID.sql:47 SELECT COUNT(*) INTO idx_count …` ⇒ 旧版会把过程变量误改成 `t_col_count` / `t_idx_count`（MySQL `Undeclared variable`），**这正是要消除的误伤**，非真实表名覆盖减少 |

### 3.3 反测（"证明它会红"）

| 反测 | 回退方式 | 结果 |
|---|---|---|
| 丢块根治 | `splitSqlStatements` 函数体换回修复前实现 | A1/A2/A3/A4/A6 全部变红（`SET FOREIGN_KEY_CHECKS = 0` 与 `t_trace_config` 不再执行、闸门日志为 0） |
| 写闸门 | `resolveWriteGate` 恒 `allow` | A5/A6 变红（同批 `INSERT IGNORE` 被放行执行、无跳过日志） |
| addTablePrefix 同族 | 恢复通用 `INTO`、删除 `REFERENCES`、`INSERT_INTO` 还原 | N01/N02/N06/N07 **4 条变红**；MIG-2 反引号断言 20/20 **保持全绿**（冻结位） |
| 冻结位（不得变红） | 上述三种回退 | 正常版 A1~A7、B1~B3、H01~H20、N01~N08 全绿；B2 合成批次里 `INSERT/INSERT IGNORE/UPDATE/DELETE/REPLACE/CALL` 6 条各留 1 行跳过日志 |

### 3.4 MIG-2 / MIG-4 存留断言

* MIG-2（反引号）：`H01~H20` 在**本单改动后的源码**上 20/20 全绿；`migration.test.ts` 的 `MIG-2:` 段未改动。
* MIG-4（写闸门默认 block）：真实文件 006 同批 `INSERT` 被跳过（A5/A6）；合成批次 6 条写语句/CALL 全跳过（B2/B3）；`migration-write-gate.test.ts` 未改动。

---

## 四、证据边界（必须连同结论一起看）

1. **本沙箱不能跑 vitest**（esbuild `spawn EPERM`，见 `outputs/04-vitest-blocked.txt`），也不能连真库 ⇒ 上述结论来自"真实源码文本转译后进程内加载 + 桩 mysql/fs/logger"的 harness；**后端全量用例（基线 574 文件 / 6347 例）仍需凌舟在本机复跑**。harness 只复刻**用例与场景**，被测函数（`runMigrations` / `splitSqlStatements` / `addTablePrefix` / `resolveWriteGate`）一律取自工作区真实源码，并输出源码 SHA256（见 `outputs/05-verify.txt` 抬头）供核对。
2. **未在真库执行任何写操作**；也未在真库验证 `SET FOREIGN_KEY_CHECKS = 0/1`、5 张追溯表建表在 MySQL 上的实际结果——本单只证明"这些语句会被 runner 挑出并下发"。
3. 影响面分析是**静态改写差异**（新旧 `addTablePrefix` 输出对比），不是 MySQL 语义验证。
4. `outputs/00b~00d` 是"回退版源码"（用真实源码做逐行文本替换得到），用于证明反测确实落到了被测规则上；回退定位失败会直接抛错（`mig5-lib.mjs` 内），防止反测悄悄失效。

---

## 五、本单未做（已单列，不夹带）

1. **`DELIMITER` / `CREATE PROCEDURE` 感知（#18 / S3-57）**：未实现（时间盒内无法稳妥完成），方案见回传卡「未完成与阻塞」。
2. **`CREATE INDEX … ON <tbl>` 模式（#14 的第二个修复点）**：卡内"同族收口"只点名 `REFERENCES` 与 `INTO`，故未纳入；当前 main 亦不覆盖 ⇒ **无回归**，但存量残留：全仓扫描（`rg -o -i 'CREATE\s+(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?INDEX\s+`?[A-Za-z0-9_]+`?\s+ON\s+`?[A-Za-z0-9_]+`?' docs/migrations`）得 5 条，其中表名未带 `t_` 前缀的 3 条：`idx_tenant_ib ON inventory_balance`、`idx_tenant_ibat ON inventory_batch`、`idx_tenant_il ON inventory_ledger`。是否补，请示凌舟。
3. **`REPLACE tbl`（MySQL 允许省略 INTO）**：未覆盖；全仓 `REPLACE INTO` 扫描 0 条、`REPLACE <tbl>` 亦 0 条 ⇒ 无存量影响，仅登记。
