# R101-MIG-5b 回传卡：只修 MIG-5 新增测试的 2 条红（采集口径 + 夹具自证）

> 派单卡：`docs/tasks/cards/R101-MIG-5b-派单.md`（= `docs/tasks/inbox/ACTIVE.md`，派单人：凌舟（总负责人）｜2026-09-24）
> 上游卡：`docs/tasks/cards/R101-MIG-5-阿坚回传.md`、`docs/tasks/cards/R101-派单-20260923-MIG.md`
> 证据包：`docs/evidence/MIG-5b/`（README + tools/ + outputs/）
> 工作区：分支 `agent/issue-88`，HEAD `2321a7721205b34fde02d501a8adc143fb66f166`（MIG-5 的 `migration.ts` 改动在工作区、未提交）

---

## 回传（派单规范 §三 十项）

```
【汇报 MIG-5b】2 条红是"夹具没读到真文件"（vitest 4 把 vi.mock("fs") 也套到 import "node:fs" 上），已把夹具读取改为原生 createRequire + 补夹具自证断言，实现一行未改；沙箱内原样复跑：旧口径复现 2 条红（文案逐字一致）、修复后 9/9 绿、两类反测均按预期变红。
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端 · 本地子代理代执行）｜2026-09-24
交付物：
  1. backend/src/__tests__/shared/migration-split.test.ts（唯一改动的源码文件；采集口径 + 夹具自证；SHA256 由 ba45c1d1… → 0fa376ae…）
  2. docs/evidence/MIG-5b/README.md（证据包说明：结论 / 改了什么 / 工具与产出 / 读数 / 证据边界 / 未做）
  3. docs/evidence/MIG-5b/tools/mig5b-harness.mjs（沙箱内最小 vitest 运行时：mock 注册表用 vitest 真实 normalizeModuleId；提升用 vitest 真实 hoistMocks；expect 用 @vitest/expect）
  4. docs/evidence/MIG-5b/tools/mig5b-verify.mjs（4 场景：A 旧口径复现 / B 修复后 / C 反测 1 / D 反测 2；EXIT=0）
  5. docs/evidence/MIG-5b/tools/mig5b-checks.ps1（tsc×2 / eslint / vitest 受阻 的原始输出取证）
  6. docs/evidence/MIG-5b/outputs/00a-pre-fix-migration-split.test.ts.txt（修复前测试文件逐字副本，ba45c1d1…）
  7. docs/evidence/MIG-5b/outputs/01-harness-rerun.txt（4 场景 + 读数完整原始输出）
  8. docs/evidence/MIG-5b/outputs/02-tsc-testfile.txt / 02b-tsc-project.txt / 03-eslint.txt / 04-vitest-blocked.txt / 05-worktree-status.txt / 06-test-file-diff.txt（59 增 4 删，无断言删除）
  9. docs/tasks/inbox/ACTIVE-回执.md（本回传的回执）+ 活动卡归档 docs/tasks/inbox/archive/ACTIVE-MIG-5b-20260924.md
证据（可复跑）：
  * `node docs/evidence/MIG-5b/tools/mig5b-verify.mjs` → EXIT=0；原始输出 outputs/01-harness-rerun.txt
      §[0] normalizeModuleId("node:fs") = "fs" = normalizeModuleId("fs")（取 vitest 真实导出，non-replica）
      §[A] 旧口径 9 条用例 → 红 2：`AssertionError: expected false to be true // Object.is equality`、
           `AssertionError: expected [] to have a length of 1 but got +0`（与凌舟本机全量报的 2 条红逐字一致）
      §[B] 修复后 9 条用例 → 红 0（6 条 splitSqlStatements 守门 + 3 条 MIG-5 真文件反测）
      §[B’] 读数：下发语句 232 条；006 相关 38 条；SET FOREIGN_KEY_CHECKS = 0/1 各命中；5 张追溯表 CREATE 全命中；
           INSERT 下发 0 条；DROP TABLE 下发 0 条；写闸门跳过日志**恰好 1 条**（`[migration] 006_phase4_schema.sql: 写闸门 block 跳过 INSERT 语句（目标 price_level）；…`）；DROP 生产保护日志 7 条
      §[C] 反测 1（splitSqlStatements 回退成 `filter(s => !s.startsWith("--"))`）→ 4 条红，含
           `MIG-5 … > 修复后：注释块首之后的真实语句被挑出执行…` → `expected false to be true`
      §[D] 反测 2（resolveWriteGate 恒 allow）→ 1 条红：`MIG-5 … > 闸门仍生效…` → `expected [ Array(1) ] to deeply equal []`（INSERT 被放行下发）
  * `powershell -NoProfile -File docs/evidence/MIG-5b/tools/mig5b-checks.ps1`
      → 02-tsc-testfile.txt EXIT=0；02b-tsc-project.txt EXIT=0；03-eslint.txt EXIT=0（0 problem）；
        04-vitest-blocked.txt EXIT=1（esbuild spawn EPERM，errno -4048，本沙箱既有限制）
  * `git status --porcelain` / `git rev-parse HEAD` → outputs/05-worktree-status.txt（分支 agent/issue-88 @ 2321a7721；
      migration.ts SHA256 0e93fcac…（与前一轮一致，本单未动）；测试文件 0fa376ae…；修复前副本 ba45c1d1…）
  * 交叉印证（**非本单生成**，随包存在的凌舟本机真实 vitest 输出）outputs/00-real-vitest-run-mig5-20260924.log：
      `Test Files 1 failed | 575 passed (576)`、`Tests 2 failed | 6363 passed (6365)`；两条红用例名与失败位置
      `migration-split.test.ts:219`（`expect(...).toBe(true)` 处）、`:238`（`toHaveLength(1)` 处）均为**修复前行号** ⇒ 与 §[A] 复现结果逐条一致。
      （注意：该行号在修复后文件里已下移，属"只改采集口径"带来的行号变化，非断言变更。）
验收自评：
  1. 9 条用例全绿 + 无零命中空转 ⇒ 通过。依据 §[B]（红 0）与新增自证断言（REAL_SQL 长度>2000 / 含 USE liquor_inventory / 含 INSERT IGNORE INTO price_level / 含 t_trace_config 建表；mockReadFileSync 被以 006 路径调用过）。
  2. 反测 1（丢块修复回退 ⇒ "被挑出"必须变红）⇒ 通过。依据 §[C] 4 条红（真文件用例 + #13 守门用例）。
  3. 反测 2（选做：闸门恒 allow ⇒ "恰好 1 条闸门日志"必须变红）⇒ 通过。依据 §[D]：INSERT 被放行下发，闸门日志 0 条，用例变红。
  4. 沙箱 vitest 起不来的边界已标注 ⇒ 通过。依据 README §五 + outputs/04-vitest-blocked.txt；最终绿红请凌舟本机全量复跑判定。
未完成与阻塞：
  1. 本沙箱无法跑 `npm --workspace backend test`（esbuild spawn EPERM）⇒ **全量门禁（576 文件 / 6365 用例）未由我复跑**，请凌舟本机执行；这是证据边界，不是遗漏。
  2. 沙箱禁止 spawn 子进程 ⇒ `git` 只能走 shell 只读命令（已在 05-worktree-status.txt 留档），未做任何 commit/push/分支操作（派单红线 6）。
  3. 无其它未完成项。
风险与自我报备：
  1. **证据替代性**：本包用"最小 vitest 运行时"执行测试文件原文（mock 注册表 = vitest 真实 normalizeModuleId、提升 = vitest 真实 hoistMocks、expect = @vitest/expect），但**没有跑 Vite 的 esbuild/SSR 管道本身**；若凌舟本机复跑出现与本包不一致的红，请以本机为准并回派我。
  2. **夹具读取方式的选择**：用了 `createRequire(...)("node:fs")`（同步、绕开 mock 注册表）；派单允许的另一条路 `vi.importActual("node:fs")` 未采用（需 await 顶层、且会再走一次 mocker 解析），已在测试文件注释里写明两者等价、可替换。
  3. **自证断言的边界**：`assertFixtureWasConsumed()` 只能证明"runner 以 006 路径调用了 readFileSync"，不能证明"内容被完整解析"；内容完整性由 `assertRealFixture()` 的 4 条静态断言兜底。
  4. **读数口径**：232 条下发语句来自桩库连接统计（不连真库、无写操作）；与 MIG-5 证据包里的 208 条不同，原因是两套 harness 的桩配置不同（本包按测试文件 beforeEach 同口径：readdir 只返回 006），**不影响断言**。
  5. 未改 `docs/tasks/current-tasks.md`、未改 `docs/踩坑日志.md`（拟入日志条目原文见下节），落盘由凌舟负责。
回传要求：本汇报已落卡：docs/tasks/cards/R101-MIG-5b-阿坚回传.md
关联卡：docs/tasks/cards/R101-MIG-5-阿坚回传.md
```

---

## 一、根因（与派单"事实 4"的关系）

派单给出的机制候选被**证实**（用 vitest 自己的函数，不是推理）：

* `node_modules/vitest/dist/chunks/startVitestModuleRunner.*.js` 的 `normalizeModuleId(file)` 实现为
  `… .replace(/^node:/, "") …`，即**剥掉 `node:` 前缀**；
* `BareModuleMocker.resolveId` 用 `normalizeModuleId(result.id)` 作 mock 注册表 key，`ensureModule` 也用同一归一化；
* 实测（`outputs/01-harness-rerun.txt` §[0]）：`normalizeModuleId("node:fs") === normalizeModuleId("fs") === "fs"`。

⇒ 测试文件顶层 `import { existsSync, readFileSync } from "node:fs"` 拿到的是本文件 `vi.mock("fs")` 的桩，
`REAL_SQL` 变成 mock 默认值 `"SELECT 1;"`，006 从未进入 runner：
"SET / 5 张追溯表未下发" → 断言假红；"闸门日志恰好 1 条" → 实际 0 条（INSERT 语句根本没进执行路径）。
派单"事实 3"（红点分布指向"内容没进 runner"）与"第二条里 INSERT 未下发断言空转通过"完全吻合。

---

## 二、改了什么（逐条对照派单交付物）

唯一源码改动 = `backend/src/__tests__/shared/migration-split.test.ts`：

| 派单交付物 | 落地 |
|---|---|
| 1.a 真实文件读取绕开 fs mock + 同处自证 | 删 `node:fs` 导入；改用 `createRequire(resolve(process.cwd(), "__vitest-real-fs__.js"))("node:fs")`；新增 `assertRealFixture()`（长度>2000、含 `USE liquor_inventory`、含 `INSERT IGNORE INTO price_level`、含 `CREATE TABLE IF NOT EXISTS t_trace_config`）与 `assertFixtureWasConsumed()`（`mockReadFileSync` 被以 006 路径调用过），在 3 条 MIG-5 用例中调用 |
| 1.b 第一条断言语义对准真实产物 | 断言保持原口径不变（`SET FOREIGN_KEY_CHECKS = 0`、`= 1` 各一条 + 5 张追溯表独立成条），未再叠任何过滤假设；实测这些正是 `splitSqlStatements` 在实际运行中的下发内容（§[B’]） |
| 1.c 闸门日志采集对准 runner 实际那一处 | 确认实现走 `backend/src/shared/logger.ts`（`migration.ts:264` `logger.warn`），本文件 mock 的 `"../../shared/logger"` 与实现 `import logger from "./logger"` 解析到**同一文件**（同名兄弟用例 `migration-write-gate.test.ts` 的"7 条写语句各 1 条日志"在本机全量里是绿的，可交叉印证）；日志文案与"恰好 1 条"的数量口径未变 |
| 2 `docs/evidence/MIG-5b/`（tools + outputs） | 已建：3 个工具 + 10 个产出文件（原始输出先落盘再截尾读回） |
| 3 回传卡 | 本文件 |
| 4 回执 + 归档 | `docs/tasks/inbox/ACTIVE-回执.md`；活动卡归档 `docs/tasks/inbox/archive/ACTIVE-MIG-5b-20260924.md` |

红线遵守情况：

1. **未改** `backend/src/shared/migration.ts`（SHA256 仍为 `0e93fcac…`，见 `outputs/05-worktree-status.txt`）——反测只在内存里用"回退版源码文本"跑，未落盘回退文件到源码目录（回退版文本由 `mig5-lib.mjs`/`mig4-lib.mjs` 在内存中生成，未写入 `backend/**`）。
2. **未删 / 未 skip / 未放宽**任何断言：`toHaveLength(1)`、`toBe(true)`、`toEqual([])` 原样保留；没有 `.catch(() => {})`、没有 `>=0`。
3. 未动其它测试文件、未动 `vitest.config.ts` / `tsconfig` / 构建脚本。
4. `docs/**` 只写了允许的范围：`docs/evidence/MIG-5b/**`、`docs/tasks/inbox/ACTIVE-回执.md`、本回传卡、inbox 归档；未改 `docs/tasks/current-tasks.md` 与 `docs/踩坑日志.md`。
5. 未写裁定/验收卡。
6. 未 `git add -A` / 未 commit / 未 push / 未切分支 / 未改 HEAD。
7. 未连真库、未起服务、未跑写盘业务命令。

---

## 三、拟入 `docs/踩坑日志.md` 的条目原文（由凌舟落盘，本单未改该文件）

```
[105] vitest 里 vi.mock("fs") 会连 import "node:fs" 一起 mock（mock 注册表 key 会剥掉 node: 前缀）
      场景：MIG-5 新增测试 migration-split.test.ts 需要"真文件"内容做夹具，写法是
        vi.mock("fs", () => ({ readFileSync: mockReadFileSync, ... }));
        import { readFileSync as realReadFileSync } from "node:fs";   // 以为能绕开 mock
        const REAL_SQL = realReadFileSync(path);
      现象：本机全量报 2 条红（expected false to be true / expected [] to have a length of 1 but got +0），
            但实现侧用同样的真实文件跑是对的；两条红的方向相反，看不出是夹具问题。
      根因：vitest 4（4.1.10）+ vite 6 的 mock 注册表按 normalizeModuleId 归一化后的 id 索引模块，
            该函数实现里有一句 .replace(/^node:/, "") ⇒ "node:fs" 与 "fs" 归一为同一个 key，
            于是 node:fs 的导入命中 vi.mock("fs") 的桩，夹具变成 mock 默认值（"SELECT 1;"）。
      正确做法（任选其一）：① createRequire(import.meta.url)("node:fs") / createRequire(<绝对路径>)("node:fs")；
            ② await vi.importActual("node:fs")。
      防复发：任何"读真文件当夹具"的用例必须自带**夹具自证断言**（例：expect(SQL).toContain(<真实内容特征>)、
            expect(SQL.length).toBeGreaterThan(2000)），并对"runner 是否真的读了该文件"留一条断言
            （例：mockReadFileSync.mock.calls 里出现该文件路径）——否则夹具失真会表现为"断言空转通过"或"假红"。
      证据：docs/evidence/MIG-5b/（§[0] 用 vitest 真实 normalizeModuleId 实测 n("node:fs") === n("fs")；§[A] 旧口径复现 2 条红；§[B] 修复后 9/9 绿）
```

---

派单人：凌舟（总负责人）｜2026-09-24　（本卡为执行方回传，不回写派单内容）
汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端 · 本地子代理代执行）｜2026-09-24
