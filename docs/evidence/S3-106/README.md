# S3-106 证据包：迁移 runner 的 `DROP TABLE` 文本保护收窄为首关键字判定

> 对应派单：`docs/tasks/cards/R101-派单-20260925-S3-106.md`
> 派单人：凌舟（总负责人）｜2026-09-25　执行方：阿坚（后端 · 本地通道）
> 汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端）｜2026-09-25
> 回传卡：`docs/tasks/cards/R101-S3-106-阿坚回传.md`
> 本单**只改** `backend/src/shared/migration.ts`（第 8 步保护 + 新增判定函数）、新增
> `backend/src/__tests__/shared/migration-drop-guard.test.ts` 与本证据目录；
> **未改** `docs/migrations/**`、`docs/API接口文档.md`、`docs/数据库变更清单.md`、
> `backend/src/config/database.ts`（S3-105），未 commit / push / PR，未做任何 gh 写操作，未连真库。

---

## 一、结论（先给结果）

| # | 结论 | 证据 |
|---|---|---|
| 1 | 第 8 步的 `DROP TABLE` 保护已由**文本包含**（`/DROP\s+TABLE/i.test(stmt)`）收窄为**首关键字判定**（`isDropTableStatement`：剥离前导空白/注释后以 `DROP TABLE` 开头） | `backend/src/shared/migration.ts:413-429`（函数）+ `:1244-1256`（调用点） |
| 2 | 新增守门用例 5 条：真 DROP 语句仍被拦（含"注释 + DROP TABLE"写法）、过程体内含 `DROP TABLE` 字样不再被跳过、纯函数边界 | `outputs/01-s3-106-verify.txt` §[A]：**5 条 / 红 0** |
| 3 | **反测（该红就红）**：把保护改回文本包含式（原实现逐字写法）⇒ §(b) 用例**确实变红**；再恢复 ⇒ 转绿 | §[B]：**红 1**（失败文案 `过程定义必须整条下发…… expected undefined to be defined`）；§[B2]：红 3 |
| 4 | 既有守门文件回归：`migration-split` 9/9 绿、`migration-delimiter` 12/12 绿；`migration-write-gate` 9/11（2 条为 harness 缺 spy 匹配器，非回归，见 §[C2] 补证） | `outputs/01-s3-106-verify.txt` §[C] / §[C2] |
| 5 | 真实文件读数：006（DROP TABLE 组）**DROP TABLE 下发 0 条 / 保护日志 7 条**；092（过程体组）**过程定义 2 条下发 / 保护日志 0 条** | 同上 §[E] |
| 6 | 影响面：`docs/migrations` 命中 `DROP TABLE` 共 **61 行**（57 条语句 + 4 行整行注释）；逐条判定后**真 DROP 语句仍被拦 57 条，因"文本包含"被误伤的语句 0 条** | 同上 §[D]（61 行逐条列出） |
| 7 | 静态检查：`npx tsc -p tsconfig.json --noEmit` EXIT=0；新增测试文件单跑 tsc EXIT=0；`npx eslint <2 个改动文件>` **0 error**（1 条 `runMigrations` complexity 既有 warning） | `outputs/02-tsc-project.txt`、`03-tsc-testfile.txt`、`04-eslint.txt` |
| 8 | 本沙箱仍跑不了 vitest（esbuild `spawn EPERM`，踩坑[118]）⇒ 真实 vitest 的 `Test Files / Tests` 汇总行与全量 0 failed 由凌舟本机判定 | `outputs/05-vitest-blocked.txt`（`errno: -4048`） |

---

## 二、改了什么（实现）

`backend/src/shared/migration.ts`（**25 增 1 删**，SHA256 `19b9e73c…`）

1. **新增判定函数**（`:413-429`）：
   ```ts
   export function isDropTableStatement(statement: string): boolean {
     return /^DROP\s+TABLE\b/i.test(stripLeadingComments(statement));
   }
   ```
   注释里写明**为什么不能用文本包含**：过程定义（`CREATE PROCEDURE … BEGIN … END`）经
   `splitSqlStatements` 后作为**一条完整语句**下发，体内只要出现 `DROP TABLE` 字样
   （如拼动态 SQL 的字符串），包含判定会把**整条过程定义静默跳过**（无日志、无报错，过程永远建不成）；
   首关键字判定天然把"过程体内部的 DROP TABLE"排除在外（该条语句首关键字是 `CREATE`）。
2. **第 8 步调用点**（`:1244-1256`）：`if (/DROP\s+TABLE/i.test(stmt))` → `if (isDropTableStatement(stmt))`，
   跳过日志**文案与位置不变**（`跳过 DROP TABLE 语句（保护生产数据）`），既有观测口径不漂移。

新增测试：`backend/src/__tests__/shared/migration-drop-guard.test.ts`（242 行，SHA256 `9c3f2ec6…`）：
两份夹具——夹具①（真 DROP 语句组，无过程体）用于 (a)"生产保护未回归"，夹具②（过程体组，无真 DROP）
用于 (b)"过程定义不再被静默跳过"。**刻意拆开**：使 (a) 在"收窄前/后"两种实现下都保持绿，
只有 (b) 承担"该红就红"的辨别力（第一版两者同夹具时，(a) 在反测中会跟着变红，已自查修正）。

---

## 三、工具与产出（全部可复跑）

| 文件 | 用途 | 复跑命令 |
|---|---|---|
| `tools/s3-106-lib.mjs` | 复用 MIG-5b 的最小 vitest 运行时；只新增两段"用真实源码文本定位替换"的反退回退（定位失败即抛错） | 被 `s3-106-verify.mjs` import |
| `tools/s3-106-verify.mjs` | 场景 A/B/B2/C/C2/D/E 原样执行 + 读数 + 影响面统计，先落盘再截尾 | `node docs/evidence/S3-106/tools/s3-106-verify.mjs` → **EXIT=0** |
| `tools/s3-106-checks.ps1` | 静态检查取证（tsc 工程 / tsc 测试文件 / eslint / vitest 受阻 / git 只读） | `powershell -NoProfile -File docs/evidence/S3-106/tools/s3-106-checks.ps1` |
| `outputs/01-s3-106-verify.txt` | 全部场景原始输出（含 §[D] 61 行命中逐条判定） | 见上 |
| `outputs/02-tsc-project.txt` | `cd backend && npx tsc -p tsconfig.json --noEmit` → `EXIT=0` | 见上 |
| `outputs/03-tsc-testfile.txt` | 新增测试文件单跑 tsc（tsconfig 排除 `src/__tests__/**`） → `EXIT=0` | 见上 |
| `outputs/04-eslint.txt` | `npx eslint src/shared/migration.ts src/__tests__/shared/migration-drop-guard.test.ts` → `0 errors, 1 warning`（既有 complexity） | 见上 |
| `outputs/05-vitest-blocked.txt` | `npx vitest run src/__tests__/shared/migration-drop-guard.test.ts` → `EXIT=1`，`spawn EPERM` | 见上 |
| `outputs/06-worktree-status.txt` | 分支 `agent/issue-112` / HEAD `f614b3fd5` / `git status --porcelain` | 见上 |

---

## 四、证据边界（必须连同结论一起看）

1. **本沙箱跑不了 vitest**（`outputs/05-vitest-blocked.txt`：`spawn EPERM`，根因＝沙箱禁止 node 子进程，
   踩坑[118]）。因此本包用"最小 vitest 运行时"**原样执行测试文件原文**（非复刻断言）：
   mock 注册表 key 用 vitest 真实 `normalizeModuleId`、`vi.mock` 提升用 vitest 真实 `hoistMocks`、
   `expect` 用 `@vitest/expect` 的 chai + Jest 匹配器（失败文案与 vitest 一致）。
2. **harness 覆盖缺口（已知且已补证）**：`migration-write-gate.test.ts` 有 2 条用例用
   `toHaveBeenCalledWith(expect.stringContaining(...))`（vitest spy 匹配器），本 harness 未实现，
   必然报 `TypeError: [Function fn] is not a spy or a call to a spy!`。
   这 2 条**不是回归**：其断言语义（写闸门 info 日志声明本次取值）已在 §[C2] 用同一运行时的读数补证
   （`MIGRATION_WRITE_GATE` 未设置 ⇒ `外部迁移写闸门=block（默认）`；`=allow` ⇒ `allow（显式配置）`）。
3. 场景 §[E] / §[D] 的读数来自**桩库连接**（不连真库、不执行任何语句），只统计"哪些语句被下发"。
4. §[D] 的语句级判定用**真实 `splitSqlStatements` + 真实 `isDropTableStatement`** 跑真实迁移文件
   （非静态推理）；但"某条语句在 MySQL 上的实际执行结果"本单未验证（也不需要：收窄只影响"跳过/下发"）。
5. 反测用的"回退版源码"是真实源码文本的逐处替换，定位失败即抛错（`s3-106-lib.mjs` 内的守卫），
   防止反测悄悄失效。

---

## 五、本单未做（不夹带）

1. 未改实现以外的任何业务代码；未动 `docs/tasks/current-tasks.md`（凌舟维护）、`docs/踩坑日志.md`；
   拟入踩坑日志的条目原文写在回传卡"风险与自我报备"里，落盘由凌舟决定。
2. 未做裁定/验收卡（派单规范 §8.8）。
3. 全量门禁（`npx vitest run`、构建、E2E）由凌舟本机执行。
4. **未 commit / 未 add**：本工作区是链接工作区，真实 index 位于沙箱可写根之外，
   `git add` 实测 `Permission denied` ⇒ 改动以未暂存/未跟踪状态留在工作区（见 `outputs/06-worktree-status.txt`）。
