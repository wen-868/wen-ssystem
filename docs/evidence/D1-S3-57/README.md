# D1-S3-57 证据包：迁移 runner 感知 `DELIMITER` / `BEGIN…END`（过程体不再被 `;` 拆散）

> 对应派单：`docs/tasks/cards/R101-派单-20260925-D1-S3-57.md`（权威卡 = `docs/tasks/inbox/ACTIVE.md`）
> 派单人：凌舟（总负责人）｜2026-09-25　执行方：阿坚（后端 · 本地通道）
> 汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端）｜2026-09-25
> 工作区：`D:\Users\ZXQL\wt-agents\issue-96`（分支 `agent/issue-96` @ HEAD `38b2ad9b2`，改动**未提交**，提交/推送/PR 由凌舟执行）
> 本包只读复跑，不改任何被测文件；真库验收脚本（3b）本沙箱**未执行**。

---

## 一、结论（先给结果）

| # | 结论 | 证据 |
|---|---|---|
| 1 | **先红**：修复前实现 + 本轮新增测试文件 ⇒ 12 条用例 **9 条红**（含两条 092 真文件用例：`CREATE PROCEDURE` 下发 0 条、`DROP PROCEDURE` 下发 0 条） | `outputs/01-verify-run.txt` §[A] |
| 2 | **后绿**：修复后实现 + 同一测试文件 ⇒ **0 红**（12/12 通过） | 同上 §[B] |
| 3 | **反测 1 会红**：把 `splitSqlStatements` 退回旧 `;` 切分（调用点仍保留 DELIMITER 行）⇒ **8 条红** | 同上 §[E] |
| 4 | **反测 2 会红**：保留新切分、只把"跳过存储过程语句"的 `continue` 加回去 ⇒ **2 条红**（正是 092 的两条用例） | 同上 §[F] |
| 5 | **3a（092 真内容 + 假连接）**：`CREATE PROCEDURE` **2 条**（各 554 字符 / 19 行、末行 `END`、整块含 `DECLARE`/`IF`/`DEALLOCATE PREPARE`）、`DROP PROCEDURE` **4 条**（含文件末尾 282-283 两条）、`CALL` 下发 **0 条**（138 条全被写闸门挡下）、过程体残片 **0 条** | 同上 §[G] |
| 6 | **不回归**：MIG-5/MIG-5b 守门文件 `migration-split.test.ts` 9/9 绿；既有 `migration.test.ts` 修复前/后失败集合**完全一致**（43/43，同因 `vi.clearAllMocks` 最小运行时缺失），**新增失败 0 条** | 同上 §[D]、§[C0/C] |
| 7 | 静态检查：`npx tsc --noEmit` **EXIT=0**；`npx eslint`（3 个文件）**0 error**（仅保留既有 `runMigrations` complexity 告警，44 → **42**） | `outputs/02-tsc-project.txt`、`03-eslint.txt` |
| 8 | 本沙箱**仍跑不了 vitest**（esbuild `spawn EPERM`，与 MIG-5b 同因）⇒ 全量门禁由凌舟本机执行 | `outputs/04-vitest-blocked.txt`、`04b-vitest-single-blocked.txt` |

---

## 二、改了什么（3 个文件，全部在派单卡文件域内）

| 文件 | 变更 | 说明 |
|---|---|---|
| `backend/src/shared/migration.ts` | +174 / -21 | ① 重写 `splitSqlStatements`：`DELIMITER <符号>` 状态机 + `BEGIN…END` 块边界 + 字符串/注释内不切分；② 两个调用点**不再删除 DELIMITER 行**（只删 USE 行）；③ 删除两处 `stmt.includes("CREATE PROCEDURE"｜"DROP PROCEDURE") ⇒ continue` 的跳过逻辑（`5.5.8` 与第 8 步） |
| `backend/src/__tests__/shared/migration-delimiter.test.ts` | 新增 | **12 条用例**：DELIMITER 语义 3 条 + BEGIN…END 2 条 + 既有口径不回归 3 条 + 真实 092 全链路 4 条（含"红线未放宽：CALL 一条都不下发"） |
| `backend/src/__tests__/shared/migration.test.ts` | +8 / -3 | **只改 1 条用例**：原「应跳过存储过程语句」断言的正是被修复的缺陷行为，按新口径改写为「存储过程语句应作为完整语句下发（S3-57 前为被跳过）」，断言未放宽（改后要求完整过程体 `BEGIN SELECT 1; END` 出现） |

**实现要点（S3-57 两条边界规则）**

1. **`DELIMITER <符号>`（行首指令）**：切换当前分隔符（`$$`、`//` 等均可）；指令行本身不进语句流。只在"语句边界"（缓冲区里除空白/注释外没有未收尾代码）上生效。⇒ 调用点必须**保留** DELIMITER 行，这正是缺陷①的根治点。
2. **默认分隔符下的 `BEGIN…END` 块边界**：`CREATE PROCEDURE/FUNCTION/TRIGGER/EVENT` 定义体内（未读到块尾 `END`）的 `;` 不作为语句边界；块尾判据排除 `END IF / END WHILE / END CASE / END LOOP / END REPEAT`（这些是体内块的收尾）。⇒ 即使迁移文件忘了写 `DELIMITER`，过程体仍作为**一条**语句下发。

**顺带修正（同源，属同一处缺陷）**：字符串/标识符字面量、注释（`--`、`#`、块注释）内的 `;` 不再被当边界 —— 修复前这些 `;` 会把注释或字符串切成垃圾语句下发（被 MySQL 判语法错误后静默跳过）。影响面见 §四。

---

## 三、交付物与复跑命令

| 交付物 | 文件 | 复跑命令 |
|---|---|---|
| 3a 反测（真内容 + 假连接） | `tools/d1-verify.mjs` + `outputs/01-verify-run.txt` | `node docs/evidence/D1-S3-57/tools/d1-verify.mjs`（EXIT=0 = 全部场景符合预期） |
| 3a 读数（092 下发序列） | `tools/d1-readings.test.ts.txt`（由上面脚本以虚拟测试路径执行） | 见上（§[G] 段） |
| 影响面扫描（可复跑数字） | `tools/d1-impact.mjs` + `outputs/00-impact-scan.txt` | `node docs/evidence/D1-S3-57/tools/d1-impact.mjs` |
| 静态检查 / 门禁受阻取证 | `tools/d1-checks.ps1` | `pwsh -NoProfile -File docs/evidence/D1-S3-57/tools/d1-checks.ps1` |
| **3b 真库空库验收脚本（待凌舟执行）** | `tools/d1b-empty-db-092-verify.mjs` | 见 §五（本沙箱未执行） |
| 修复前实现逐字副本（反测输入） | `outputs/00a-prefix-migration.ts.txt` | `git show HEAD:backend/src/shared/migration.ts` |

---

## 四、影响面数字（执行方独立复跑，非照抄派单卡）

命令：`node docs/evidence/D1-S3-57/tools/d1-impact.mjs`（扫描 `docs/migrations/*.sql` 全部 **176** 个文件）

| 指标 | 数字 |
|---|---|
| 迁移文件总数 | 176 |
| 含 `DELIMITER` 指令行的文件数 / 指令行总数 | **1** / **4**（仅 `092_租户ID.sql`） |
| 含 `CREATE PROCEDURE` 的文件数 / 条数 | **1** / **2** |
| `DROP PROCEDURE` 条数 | **4**（`092:12`、`:38`、`:282`、`:283`） |
| `CALL` 条数（全仓 / 其中 092） | **173** / **138** |
| `CREATE FUNCTION` / `TRIGGER` / `EVENT` | **0** / **0** / **0** |
| **切分口径变更后"下发语句数组发生变化"的迁移文件数** | **4**（092、151、152、164） |

**这 4 个文件的变化方向（关键：无真实语句丢失）**：按"修复前流水线（去 USE+DELIMITER → 旧 `;` 切分）"与"修复后流水线（只去 USE → 新切分）"逐条对比，**消失语句 26 条全部归因**：

| 消失语句归类 | 条数 | 说明 |
|---|---|---|
| 纯注释/空白残块 | 0 | — |
| 注释正文被 `;` 切出的垃圾片段 | 10 | 修复前当独立语句下发 → MySQL 判语法错误 → `safeExec` 静默跳过（151/152/164 的中文注释里含 `;`） |
| 旧 DELIMITER 残片（含 `$$`） | 2 | 修复前 DELIMITER 行被整行删掉后 `$$` 粘在语句尾部（092） |
| 是修复后某条完整语句的子串（过程体残片/多语句粘连被还原） | 14 | 092 的 2 个过程体被 `;` 拆成 14 片 ⇒ 现在合成 2 条完整语句 |
| **待人工复核** | **0** | — |

092 前后取数：修复前 161 条 → 修复后 **149** 条（少掉的是垃圾片段与残片，多出的是 2 条完整过程定义 + 被还原的建表语句）。

---

## 五、3b 真库空库验收（**待凌舟在本机/服务器执行；本沙箱未执行**）

**为什么未执行**：本工作区无 MySQL、无 Docker、无外网，`127.0.0.1:3306` **连接被拒**（`ECONNREFUSED`，见 `outputs/06-3b-script-connection-probe.txt`：脚本已实跑到"建库前连不上即退出"，EXIT=2）。

**命令（凌舟本机/服务器）**：

```powershell
cd D:\Users\ZXQL\wt-agents\issue-96
$env:D1B_DB_HOST="127.0.0.1"; $env:D1B_DB_PORT="3306"; $env:D1B_DB_USER="root"; $env:D1B_DB_PASSWORD="<口令>"
node docs/evidence/D1-S3-57/tools/d1b-empty-db-092-verify.mjs            # 模式 A：空库跑完整 runMigrations()
node docs/evidence/D1-S3-57/tools/d1b-empty-db-092-verify.mjs --mode=092 # 模式 B：空库只跑 092
```

**三段（脚本内实际执行）**：① `DROP DATABASE IF EXISTS d1_s3_57_verify; CREATE DATABASE d1_s3_57_verify …`（**只对这个专属库**）② 跑 runner（模式 A 全量 176 文件含 092；模式 B 用导出实现 `splitSqlStatements` + `safeExec` 逐条下发 092）③ `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA='d1_s3_57_verify'` + `COUNT(*)`。

**期望输出**：

```
[1] 空库已建：d1_s3_57_verify
[2] 迁移 runner 执行完成（092_租户ID.sql 已跑）
[3] information_schema.ROUTINES 残留 0 行（期望 0 行）
    明细：（无）
PASS：无残留辅助存储过程
```

**判据**：`add_column_if_not_exists` / `add_index_if_not_exists` / `add_col_if_not_exists` 一个都不许残留（修复前 `092:282-283` 两条 `DROP PROCEDURE` 被 `continue` 跳过 ⇒ 本步会看到 2 行残留）。

---

## 六、证据边界（必须连同结论一起看）

1. **本沙箱跑不了 vitest**（`esbuild spawn EPERM`，`outputs/04-vitest-blocked.txt`；同因已由 MIG-5b 记录）。本包用 **MIG-5b 的最小 vitest 运行时**（`docs/evidence/MIG-5b/tools/mig5b-harness.mjs`，未改动、直接复用）**原样执行测试文件原文**：mock 注册表用 vitest 真实 `normalizeModuleId`；`vi.mock`/`vi.hoisted` 用 `@vitest/mocker` 真实 `hoistMocks`；`expect` 用 `@vitest/expect`。**最终绿红由凌舟本机 `cd backend && npx vitest run` 判定。**
2. **未验证项**：测试文件在 Vite/esbuild 转译管道下的行为、并发/超时、覆盖率、路径别名（本单测试文件未用别名）；既有 `migration.test.ts` 中依赖 `vi.clearAllMocks` 的 43 条用例在最小运行时下**无法执行**（修复前/后同因同数，已左右对照，不代表它们在本机 vitest 下失败）。
3. **未连真库**：本包所有"下发语句"读数都来自**假连接**（stub `mysql2`），不执行任何真实 SQL；真库口径见 §五（待执行）。
4. 影响面扫描里"修复前流水线"是**按 HEAD 版实现逐字复刻**的旧 `;` 切分（`tools/d1-impact.mjs` 的 `LEGACY_SPLIT`），非独立第三方实现；"修复后"直接调用工作区真实导出实现。

---

## 七、本单未做（不夹带）

1. 未改 `backend/src/services/**`（C5-1 在飞）、未改 `docs/migrations/**`、未改 `docs/API接口文档.md`、未改 `docs/tasks/当前批次.md`。
2. 未放宽 `safeExec` 错误处理、未用"注释后补分号"式逐文件绕过（092 未动，靠 runner 侧根治）。
3. 未 commit / push / fetch / ls-remote，未做 `gh` 写操作（沙箱无网络）。
4. 未产出任何 `*凌舟裁定*` / `*凌舟验收*` 内容；需裁定事项列在回传卡"未完成与阻塞/需裁定清单"。
5. `backend/src/config/database.ts:28` 另有一份同名 `splitSqlStatements`（配置层、非本单文件域）**未改动**——它同样只按 `;` 切分，是否同源根治需凌舟裁定（见回传卡）。

---

## 八、返工第 1 轮增补（D1-R1，2026-09-25 阿坚）

> 起因：凌舟本机全量 `npx vitest run` 判红 1 条 —— `migration.test.ts:599` 的 `runMigrations > 外部 SQL 文件包含 DROP PROCEDURE 应跳过` 断言的正是本单要废除的旧行为（第 0 轮漏改同族用例）。派单卡见 `../tasks/cards/R101-派单-20260925-D1-S3-57.md` 的【凌舟判红 · 第 1 轮】段。

### 8.1 本轮改了什么

| 文件 | 位置 | 变更 |
|---|---|---|
| `backend/src/__tests__/shared/migration.test.ts` | `:591-606` | 该用例改写为新语义：`DROP PROCEDURE IF EXISTS test` **必须作为完整语句下发**（与同族 `:450-462` 同口径）；补 3 行来源注释。本轮 **+16 / -10**（文件对 HEAD 累计 +24 / -13） |

其余文件（`backend/src/shared/migration.ts`、`backend/src/__tests__/shared/migration-delimiter.test.ts`）本轮**零改动**。

### 8.2 本轮新增的输出与装置（均留在仓库，可复跑）

| 文件 | 内容 |
|---|---|
| `outputs/07-static-scan-round1.txt` | 全仓测试文件 `PROCEDURE` 命中（3 文件 / 38 行）+ 迁移三测试文件 `toBeUndefined`/`not.toHaveBeenCalled` 扫描 + 全仓"跳过存储过程"措辞残留 |
| `outputs/08-tsc-round1.txt` | `cd backend && npx tsc --noEmit` → EXIT=0 |
| `outputs/09-vitest-blocked-round1.txt`、`09b-vitest-full-blocked-round1.txt`、`09c-vitest-variant-round1.txt` | 单文件 / 全量 / `--configLoader runner` 三种 vitest 尝试 → 均 EXIT=1、`spawn EPERM`、**跑了 0 个文件** |
| `outputs/10-verify-run-round1.txt` | `tools/d1-verify.mjs` 复跑（A…G + 本轮新增 H1/H2/H3）EXIT=0 |
| `outputs/11-rework-same-source-case.txt` | 由脚本从 `migration.test.ts` **逐字抽取**拼成的临时测试文件（顶部 mock 骨架 `1-71` + `beforeEach` `:383-398` + 两条过程用例 `:450-462`/`:594-606`），sha256 `a126d006211b22f3e30974dbf046dd6cee55e41c9191a3dec44625ec68819404` |
| `outputs/12-impact-scan-round1.txt` | `tools/d1-impact.mjs` 本轮独立复跑（176 文件 / DELIMITER 1 文件 4 行 / CREATE PROCEDURE 2 / DROP PROCEDURE 4 / CALL 173，其中 092 138） |
| `outputs/13-worktree-round1.txt` | `git status --short` + `git diff --numstat/-U3`（改动只落工作区、只在该用例） |
| `outputs/14-eslint-round1.txt` | `cd backend && npx eslint src/__tests__/shared/migration.test.ts` → EXIT=0（额外自查） |
| `tools/d1-verify.mjs`（扩 H 组） | ① 逐字抽取装置（`extractCall` + `extractSameSourceReworkTest`）；② 反测 2 的还原范围修正为**两处调用点**（5.5.8 AI 底座 + 第 8 步外部迁移，即 HEAD 原样） |

### 8.3 本轮反测结论（同源左右对照）

| 场景 | 实现 | 实测 |
|---|---|---|
| H1 | 工作区修复后实现 | 两条用例 **2/2 绿** |
| H2 | `splitSqlStatements` 退回旧 `;` 切分 | `CREATE PROCEDURE` 用例 **红**（`expected 'CREATE PROCEDURE test() BEGIN SELECT 1' to contain 'BEGIN SELECT 1; END'`）；该 DROP 用例仍绿 ⇒ **它不敏感于切分口径**（语句体内无 `;`），靶是 `continue` 跳过 |
| H3 | 两处 `continue` 全量还原（HEAD 缺陷行为） | 两条用例**都红**：`expected 0 to be greater than 0`（本轮改写的 DROP 用例红输出原文） |

**补充实测（如实记录）**：若只还原第 8 步一处 `continue`，该 DROP 用例**仍绿** —— 5.5.8 AI 底座兜底分支也会读同一迁移文件并把该语句下发（`mockQuery` 里仍有 1 条）。

### 8.4 本轮未做

1. 未触碰 `docs/migrations/**`、`docs/API接口文档.md`、`docs/数据库变更清单.md`、`backend/src/services/**`、`backend/src/config/database.ts`（同名 `splitSqlStatements` 由凌舟另立 S3-105）。
2. 未改 `migration-split.test.ts:154` 用例名里过期的"循环内再跳过"措辞（超出派单卡 §五.1 授权，已列入回传"申请处置"）。
3. 未执行 3b 真库验收（无 MySQL/Docker/外网），预期判据与脚本见 §五；**不得据本包认定 3b 通过**。
