# MIG-5b 证据包：只修 MIG-5 新增测试的 2 条红（不改实现）

> 对应派单：`docs/tasks/cards/R101-MIG-5b-派单.md`（权威卡 = `docs/tasks/inbox/ACTIVE.md`）
> 派单人：凌舟（总负责人）｜2026-09-24　执行方：阿坚（后端 · 本地子代理代执行）
> 汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端）｜2026-09-24
> 回传卡：`docs/tasks/cards/R101-MIG-5b-阿坚回传.md`｜关联卡：`docs/tasks/cards/R101-MIG-5-阿坚回传.md`
> 本单**只改** `backend/src/__tests__/shared/migration-split.test.ts`（采集口径 + 夹具自证）与本证据目录；
> **未改** `backend/src/shared/migration.ts`（实现，SHA256 与前一轮一致）、未改其它测试、未改 `docs/migrations/*.sql`、未 commit/push、未连真库。

---

## 一、结论（先给结果）

| # | 结论 | 证据 |
|---|---|---|
| 1 | 2 条红的根因是**夹具没读到真文件**（不是实现）：vitest 4 的 mock 注册表按 `normalizeModuleId` 归一化 id，该函数**剥掉 `node:` 前缀** ⇒ `vi.mock("fs")` 覆盖 `import ... from "node:fs"`，顶层读到的是桩 `"SELECT 1;"` | `outputs/01-harness-rerun.txt` §[0]（取的是 vitest 真实导出的 `normalizeModuleId`：`n("node:fs") === n("fs") === "fs"`） |
| 2 | 旧口径可复现凌舟报的**同 2 条红、文案逐字一致** | 同上 §[A]：`expected false to be true // Object.is equality`、`expected [] to have a length of 1 but got +0`；另与随包存在的**凌舟本机真实 vitest 原始日志**逐条对应（`outputs/00-real-vitest-run-mig5-20260924.log`，失败位置 `migration-split.test.ts:219` / `:238` = 修复前行号） |
| 3 | 修复后目标文件 **9/9 全绿**（6 条 `splitSqlStatements` 守门 + 3 条 MIG-5 真文件反测） | 同上 §[B] |
| 4 | 反测 1（丢块修复回退成 `filter(s => !s.startsWith("--"))`）⇒ 真文件"被挑出"用例**变红** | 同上 §[C]：4 条红（2 条真文件用例 + 2 条 #13 守门用例） |
| 5 | 反测 2（写闸门恒 `allow`）⇒ "闸门仍生效"用例**变红**（INSERT 被放行下发 ⇒ 日志 0 条） | 同上 §[D]：1 条红，失败文案 `expected [ Array(1) ] to deeply equal []` |
| 6 | 静态检查：测试文件 `tsc` / 工程 `tsc` / `eslint` 全 0 错 | `outputs/02-tsc-testfile.txt`、`02b-tsc-project.txt`、`03-eslint.txt`（均 `EXIT=0`） |
| 7 | 本沙箱仍跑不了 vitest（esbuild `spawn EPERM`） | `outputs/04-vitest-blocked.txt`（`EXIT=1`，`errno: -4048`） |

---

## 二、改了什么（一个文件）

`backend/src/__tests__/shared/migration-split.test.ts`（修复前副本：`outputs/00a-pre-fix-migration-split.test.ts.txt`，SHA256 `ba45c1d1…`；修复后 SHA256 `0fa376ae…`）

1. **夹具读取口径**：删掉 `import { existsSync as realExistsSync, readFileSync as realReadFileSync } from "node:fs"`（会被 `vi.mock("fs")` 命中），改为
   `createRequire(resolve(process.cwd(), "__vitest-real-fs__.js"))("node:fs")` —— 走 Node 原生 require，绕开 vitest module runner 与 mock 注册表。
   `resolveRealMigrationPath()` / `REAL_SQL` 全部改用这个真实 fs。
2. **夹具自证（新增，防"零命中空转通过"，踩坑[103]）**：
   * `assertRealFixture()`：`REAL_SQL` 长度 > 2000、含 `USE liquor_inventory` / `INSERT IGNORE INTO price_level` / `CREATE TABLE IF NOT EXISTS t_trace_config`；
   * `assertFixtureWasConsumed()`：`mockReadFileSync` 必须被以 006 路径调用过（证明 runner 真读了 006）。
   两者在 3 条 MIG-5 用例里逐个调用。
3. **断言本身一条未删、未放宽**：`toHaveLength(1)` / `toBe(true)` / `toEqual([])` 原样保留；第一条的用户口径仍是"006 实际产物"（`SET FOREIGN_KEY_CHECKS = 0`/`= 1` 各一条 + 5 张追溯表 `CREATE TABLE IF NOT EXISTS …`）。

---

## 三、工具与产出（全部可复跑）

| 文件 | 用途 | 复跑命令 |
|---|---|---|
| `tools/mig5b-harness.mjs` | 沙箱内**最小 vitest 运行时**：mock 注册表用 vitest **真实** `normalizeModuleId`；测试文件用 vitest **真实** `hoistMocks` 提升（`vi.mock` 先于 `import`）；`expect` 用 `@vitest/expect` 的 chai + Jest 匹配器 | 被下一个脚本 import |
| `tools/mig5b-verify.mjs` | 4 个场景原样执行测试文件 + 读数 + 预期断言（A 旧口径复现 / B 修复后 / C 反测 1 / D 反测 2） | `node docs/evidence/MIG-5b/tools/mig5b-verify.mjs` → **EXIT=0** |
| `tools/mig5b-checks.ps1` | 静态检查取证（tsc 测试文件 / tsc 工程 / eslint / vitest 受阻原始输出） | `powershell -NoProfile -File docs/evidence/MIG-5b/tools/mig5b-checks.ps1` |
| `outputs/00a-pre-fix-migration-split.test.ts.txt` | **修复前**测试文件逐字副本（反测与"旧口径复现"的输入） | 文件通道读取 |
| `outputs/00-real-vitest-run-mig5-20260924.log` | **非本单生成**（随包存在）：凌舟本机 `npm --workspace backend test`（工作区 `D:/Users/ZXQL/wt-mig5/backend`）原始输出——`Test Files 1 failed \| 575 passed (576)`、`Tests 2 failed \| 6363 passed (6365)`，两条红的用例名与断言/行号与本包 §[A] 完全一致（`:219` `toBe(true)`、`:238` `toHaveLength(1)`，均为**修复前**行号） | 只读引用，未改动 |
| `outputs/01-harness-rerun.txt` | 4 个场景 + 读数的完整原始输出（含用例级 ✓/✗） | 见上 |
| `outputs/02-tsc-testfile.txt` | 测试文件单跑 tsc（tsconfig 排除 `src/__tests__/**`） | `EXIT=0` |
| `outputs/02b-tsc-project.txt` | `tsc -p backend/tsconfig.json --noEmit` | `EXIT=0` |
| `outputs/03-eslint.txt` | `eslint src/__tests__/shared/migration-split.test.ts` | `EXIT=0`（0 problem） |
| `outputs/04-vitest-blocked.txt` | 本沙箱 vitest 受阻原始输出 | `EXIT=1`，`spawn EPERM`（errno -4048） |
| `outputs/05-worktree-status.txt` | 分支 `agent/issue-88` / HEAD `2321a7721` / `git status --porcelain` / 关键文件 SHA256 | `git` 只读命令 |
| `outputs/06-test-file-diff.txt` | 修复前后测试文件逐行差异（`git diff --no-index`，59 增 4 删，全部落在夹具读取与自证处，无断言删除） | `git diff --no-index -- outputs/00a-… backend/src/__tests__/shared/migration-split.test.ts` |

---

## 四、读数（`outputs/01-harness-rerun.txt` §[B’]，默认写闸门 block）

| 指标 | 值 |
|---|---|
| 下发语句总数 | **232** |
| 006 相关（按测试同一 markers 过滤） | 38 |
| `SET FOREIGN_KEY_CHECKS = 0` / `= 1` 已下发 | 是 / 是 |
| 5 张追溯表 `CREATE TABLE IF NOT EXISTS`（t_trace_config / t_trace_code / t_trace_event_log / t_trace_scan_log / t_recall_record）已下发 | 是 ×5 |
| `INSERT` 下发条数 | **0**（被写入闸门挡住） |
| `DROP TABLE` 下发条数 | **0**（走生产保护分支） |
| 写闸门 block 跳过日志 | **恰好 1 条**：`[migration] 006_phase4_schema.sql: 写闸门 block 跳过 INSERT 语句（目标 price_level）；…` |
| DROP 生产保护日志 | 7 条 |

---

## 五、证据边界（必须连同结论一起看）

1. **本沙箱跑不了 vitest**（`04-vitest-blocked.txt`）⇒ 本包用"最小 vitest 运行时"执行**测试文件原文**：
   * 复用的是 vitest 自带件，不是自造的替代语义：① mock 注册表 key = vitest 真实 `normalizeModuleId`（`node_modules/vitest/dist/chunks/startVitestModuleRunner.*.js` 具名导出 `n`）；② `vi.mock`/`vi.hoisted` 提升 = vitest 真实 `hoistMocks`（`@vitest/mocker/dist/chunk-hoistMocks.js`）；③ `expect` = `@vitest/expect` 的 `chai` + Jest 匹配器（失败文案与 vitest 逐字一致，见 §[A]）。
   * 自实现的部分只有"框架骨架"：`describe/it/beforeEach/afterEach` 顺序执行器、`vi.fn()` 的最小 spy、`vi.importActual`。
   * **未覆盖**：Vite 的 esbuild 转译与 SSR 管道本身的差异、并发/超时、覆盖率、路径别名、`vi.spyOn` 等（本单测试文件均未使用）。
2. 因此"§[B] 9/9 全绿"是**沙箱内同源证据**，**最终绿红仍由凌舟本机 `npm --workspace backend test` 判定**（本沙箱全量同样 EPERM）。
3. 读数里的"下发语句总数 232"是**桩库连接**统计（不连真库、不执行任何写操作）；本单未在 MySQL 上验证任何语句的实际执行结果。
4. `outputs/00a-…` 与反测用的"回退版源码"都是**真实文本的逐字/逐处替换**，定位失败即抛错（`mig5-lib.mjs` / `mig4-lib.mjs` 内的守卫），防止反测悄悄失效。

---

## 六、本单未做（不夹带）

1. 未改实现、未改其它测试、未动 `docs/tasks/current-tasks.md` 与 `docs/踩坑日志.md`（拟入日志条目原文写在回执里，落盘由凌舟负责）。
2. 未做裁定/验收卡（派单规范 §8.8）。
3. 全量门禁（`npm --workspace backend test`、E2E、构建）由凌舟本机执行。
