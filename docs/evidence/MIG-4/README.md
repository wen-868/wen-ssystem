# MIG-4 证据包（外部迁移写闸门：默认"挡"）

> 执行人：阿坚（后端 · 本地子代理代执行）｜2026-09-24
> 回传卡：`docs/tasks/cards/R101-MIG-4-阿坚回传.md`　|　关联卡：`docs/tasks/cards/R101-派单-20260923-MIG.md`（MIG-4 段）
> 一句话结论：写闸门已落地且**默认挡**（未设置 `MIGRATION_WRITE_GATE` 时判 block），
> 断言 16/16 全绿，反测 7/7 命中"改回不挡即变红"；闸门覆盖面 298 条被挡（含 MIG-3 演练判定 ok 的 66 条写语句 100% 命中）。

## 一、需求与实现（改动仅 2 个文件，均在派工卡允许范围内）

| 文件 | 改动 |
| --- | --- |
| `backend/src/shared/migration.ts` | 新增写闸门判定函数（`:139-238`）+ 外部迁移段应用闸门（`:1006-1049`） |
| `backend/src/__tests__/shared/migration-write-gate.test.ts` | 新增 11 条用例（进程内 harness，假迁移文件驱动真实 `runMigrations`） |

实现要点（行号见上表）：

1. `MIGRATION_WRITE_GATE` 取值 `block`（默认）/ `allow`；解析函数 `resolveWriteGate`（`:159-162`）**只有显式 `allow` 才放行**，
   未设置 / 空串 / 其它取值（含 `yes`、`1`、拼写错误）一律回落 `block`（fail-safe）。
2. `block` 时跳过**数据写语句**（`INSERT` / `UPDATE` / `DELETE` / `REPLACE`）与 **`CALL`**；`CREATE TABLE` / `ALTER TABLE` /
   `CREATE INDEX` / `SELECT` 等结构与非写语句**不受影响**（`:1049` 的 `blockedByWriteGate` 只对上述 5 个首关键字命中）。
3. 判定可靠：`stripLeadingComments`（`:167`）先剥离前导空白与注释（`--` / `#` / `/* */`），`firstKeyword`（`:190`）取
   **首个关键字** ⇒ `INSERT ... SELECT` 判 `INSERT`（不会被误判成 `SELECT`）；`isDataWriteStatement`（`:199`）基于首关键字，
   不做 `startsWith` 粗匹配。
4. 每条被跳过的语句打一行日志（`:226-236`）：`[migration] <文件>: 写闸门 block 跳过 <类型> 语句（目标 <表名/过程名>）；如确需放行请显式设置 MIGRATION_WRITE_GATE=allow`；
   每次运行另打一行闸门取值声明（`:1007-1012`）。

## 二、产出清单

| 文件 | 内容 |
| --- | --- |
| `tools/mig4-lib.mjs` | 公共库：把**真实源码**转译后用桩依赖（fs / mysql2 / logger / env / seed-data）在进程内加载；**不复刻被测函数**；另含"反测版源码"生成器（把 `resolveWriteGate` 改回恒 `allow`） |
| `tools/mig4-gate-verify.mjs` | 16 条断言（含 7 条反测位）在真实源码上复跑 + 反测（正常版 vs 闸门不挡版） |
| `tools/mig4-coverage.mjs` | 用真实判定函数扫 `docs/migrations/*.sql`：哪些语句被挡 / 放行 + 与 MIG-3 演练结果交叉核对 |
| `outputs/01-tsc.txt` | `tsc -p backend/tsconfig.json --noEmit`（空输出 = 0 错误） |
| `outputs/02-eslint.txt` | `eslint src/shared/migration.ts src/__tests__/shared/migration-write-gate.test.ts`（0 error / 1 既有 warning） |
| `outputs/02b-tsc-testfile.txt` | 测试文件单独类型检查（`tsconfig.json` 排除了 `src/__tests__/**`，故补跑） |
| `outputs/02c-eslint-head-baseline.txt` | **HEAD 版** `migration.ts` 的 eslint 基线（证明"1 条 complexity warning"是存量，不是本单新增规则违规） |
| `outputs/03-vitest-blocked.txt` | `npm --workspace backend test` 的原始 EPERM 输出（本环境 vitest 起不来） |
| `outputs/04-gate-verify.txt` / `.json` | 16 条断言逐条结果（正常版 / 反测版两列）+ 汇总 |
| `outputs/04-reverted-gate.txt` | 反测用的函数块替换内容（原文 → 改成恒 `allow`） |
| `outputs/05-gate-coverage.txt` / `.json` | 闸门覆盖面：298 条被挡逐条清单（含口令专项、CALL 专项）+ 与演练交叉核对 + 自检 |

## 三、复跑命令（PowerShell，仓库根）

```powershell
cd backend
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit                                   # 期望：空输出 / EXIT=0
node ../node_modules/eslint/bin/eslint.js src/shared/migration.ts src/__tests__/shared/migration-write-gate.test.ts  # 期望：0 error / 1 存量 warning / EXIT=0
node node_modules/typescript/bin/tsc --noEmit --target ES2020 --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types vitest/globals,node src/__tests__/shared/migration-write-gate.test.ts  # 期望 EXIT=0
cd ..
node docs/evidence/MIG-4/tools/mig4-gate-verify.mjs    # 期望 RESULT: ALL PASS / EXIT=0
node docs/evidence/MIG-4/tools/mig4-coverage.mjs       # 期望 RESULT: ALL PASS / EXIT=0
```

## 四、验收对照

| 派工卡验收标准 | 结果 | 依据 |
| --- | --- | --- |
| 1. `tsc --noEmit` EXIT=0 | 通过 | `outputs/01-tsc.txt`（空输出）、`outputs/02b-tsc-testfile.txt` |
| 1. `eslint <改动文件>` 0 problem | **部分**：0 error / 1 条**存量** `complexity` warning | `outputs/02-eslint.txt`（46）与 `outputs/02c-eslint-head-baseline.txt`（HEAD 44）——该文件在 HEAD 上已是"1 problem"，本单没能清零；`complexity` 在 `.eslintrc.cjs` 为 `warn`，EXIT=0 |
| 1. `npm --workspace backend test` 全绿（基线 573 / 6336） | **未能在本沙箱执行**（EPERM） | `outputs/03-vitest-blocked.txt`；已由同源断言 harness 覆盖（`outputs/04-gate-verify.txt`），并在 `outputs/04-gate-verify.txt` 的 X1 断言里核对"harness 与 vitest 用例表逐条一致"。预期：**574 文件 / 6347 例**（本单新增 1 文件 11 例） |
| 2. 默认值必须是"挡"（代码行 + 断言） | 通过 | 代码：`migration.ts:159-162`（`resolveWriteGate` 缺省参数读 `process.env.MIGRATION_WRITE_GATE`，非 `allow` 即 `block`）；断言：`P6`（含"未设置 env ⇒ block"）+ `B1/B2/B3`（默认挡下只执行结构语句、7 条写语句/CALL 全被跳过且有日志） |
| 3. 反测（原始输出） | 通过 | `outputs/04-gate-verify.txt` §"反测"：把 `resolveWriteGate` 改回恒 `allow` 后，`P6 / B1 / B2 / B3 / B4 / B5 / B6` 共 7 条反测位**全部变红**，非反测位 9 条保持绿；反测素材见 `outputs/04-reverted-gate.txt` |
| 4. 不得改 `docs/migrations/*.sql` | 符合 | `git status --porcelain` 未出现 `docs/migrations/**`（见回传卡"证据"栏） |
| 5. 不得合并/推送 PR、不得在真库执行写操作 | 符合 | 本单未执行任何 git 写操作、未连任何数据库（`tools/mig4-coverage.mjs` 只读文件系统） |

## 五、vitest 用例 ↔ harness 断言映射（同源核对由 `X1` 保证）

| vitest 用例（`migration-write-gate.test.ts`） | harness 断言 |
| --- | --- |
| `DATA_WRITE_KEYWORDS 覆盖 INSERT / UPDATE / DELETE / REPLACE / CALL` | `P1` |
| `firstKeyword 能剥离前导空白与注释后取首关键字` | `P2` |
| `isDataWriteStatement：写语句与 CALL 判真，结构/非写语句判假` | `P3` + `P4` |
| `` `INSERT ... SELECT` 不得被误判成 SELECT（首关键字口径）`` | `P3` 第 3 行 |
| `statementTarget 取表名 / 过程名（供日志核对）` | `P5` |
| `resolveWriteGate：默认（未设置）必须是 block，只有显式 allow 才放行` | `P6` |
| `默认挡：只有结构语句被执行，写语句与 CALL 一条都不执行` | `B1` + `B2` |
| `默认挡：每条被跳过的语句都有一条含 文件 + 语句类型 + 目标表 的日志` | `B3` + `B4` |
| `默认挡：info 日志声明本次运行生效的闸门取值` | `B5` |
| `默认挡：非法取值（=yes）按 fail-safe 处理为 block` | `B6` |
| `显式放行（=allow）：同一组语句全部执行，且不再有跳过日志` | `A1` + `A2` + `A3` |

## 六、闸门覆盖面（扫 `docs/migrations/*.sql`，176 个文件）

口径 = "丢块缺陷修复后 runner 会尝试执行的语句集合"（当前已执行的块 ∪ 修复后才首次执行的丢块，剔除 runner 显式跳过的
存储过程 / `DROP TABLE`）。判定全部调用**真实源码函数**。

| 项 | 数字 |
| --- | --- |
| 候选语句 | 1074 条 |
| 默认挡**跳过** | **298 条**（`INSERT` 117 / `UPDATE` 8 / `CALL` 173），涉及 43 个文件 |
| 默认挡**放行** | 776 条（`CREATE` 332 / `ALTER` 323 / `SET` 35 / `SELECT` 35 / `PREPARE·EXECUTE·DEALLOCATE` 36 / `END`·`IF`·表名片段等既有切分残留 15） |
| 口令相关写语句（专项核对） | **5 条全部被挡**：`002_phase1_seed.sql:8`、`075_reset_admin_password_bcrypt.sql:8`、`081_platform_admin_seed_and_fix.sql:45`、`099_seed_data.sql:23`、`127_fix_demo_accounts.sql:7` |
| 与 MIG-3 演练交叉核对 | 演练 457 条里写语句/CALL **83 条 100% 落在被挡集合**；其中 `outcome=ok`（放量后**真的会改数据**）的 **66 条 0 条漏挡** |

**口径差异（不硬凑数字）**：MIG-3 的 66 条 = "在副本上真正执行成功"的写语句；本扫描的 125 条写语句 = "修复后 runner 会尝试执行"
的集合（超集），多出的部分是演练中报错（`ER_DUP_FIELDNAME` 等）或被 runner 跳过的语句。两者不冲突，`66 ⊂ 125` 已用
`file:line` 逐条比对确认（交叉核对见 `outputs/05-gate-coverage.txt` §五）。

## 七、本环境限制与证据边界

1. **vitest 跑不了**：沙箱禁止 node 创建子进程（`spawn EPERM`），vite/esbuild 无法加载配置 ⇒ 全量用例由凌舟本机复跑；
   本单以"真实源码 + 桩依赖 + 同源断言"的 harness 复跑（断言与用例表由 `X1` 逐条核对）。
2. **无真库**：本单闸门判定是纯文本判定，不需要数据库；覆盖面扫描只读 `docs/migrations/*.sql`，未连库、未执行任何 SQL。
3. **反测对象**："把闸门改回不挡"在 harness 中实现为"把 `resolveWriteGate` 改成恒 `allow`"（等价于闸门不生效），
   替换用真实源码文本定位，定位失败即抛错（防止反测悄悄失效）——替换前后 SHA256 记录在 `outputs/04-gate-verify.txt` 头部。

## 八、残余风险（提交凌舟裁定，本单未擅自扩大范围）

1. **闸门只覆盖派工卡指定的 5 个首关键字**（`INSERT`/`UPDATE`/`DELETE`/`REPLACE`/`CALL`）。同属"会改数据"的其它形状**未被拦**：
   `TRUNCATE`、`LOAD DATA`、`SET GLOBAL`、以及"藏在动态 SQL 里"的写（如 `PREPARE ... INSERT ...; EXECUTE ...`）。
   - 实测：`TRUNCATE` / `LOAD DATA` 在 `docs/migrations/` 中 **0 命中**（`rg -c "TRUNCATE|LOAD\s+DATA" docs/migrations` 无输出）；
     但 `SET/PREPARE/EXECUTE/DEALLOCATE` 共 71 条会被放行（见覆盖面表），其中是否含动态 DDL/DML 需凌舟按批判定。
   - **未擅自加入**：派工卡明确限定 5 个关键字，扩大拦截面属于范围变更，留待凌舟裁定（反测也需同步补）。
2. **DDL 中的数据副作用不受闸门管**：`CREATE TABLE ... AS SELECT`、`ALTER TABLE ... MODIFY`（数据重写）仍会执行 —— 派工卡把
   `ALTER TABLE` 归入"放行"，本单照此实现。
3. **闸门只管外部迁移段**：`migration.ts` 第 0–7 步（内置迁移）里的 `INSERT`/`UPDATE`（如默认租户、默认管理员密码）**不受闸门约束**，
   与派工卡"外部迁移段"范围一致；放量前是否需要一并处理，请凌舟裁定。
4. **eslint "0 problem" 不可达**：`runMigrations` 在 HEAD 上即 1 条 `complexity` warning（44）；本单已把闸门分支抽成
   `blockedByWriteGate`，仍为 1 条（46）。要清零需重构 `runMigrations`（超出本单范围，未做）。
