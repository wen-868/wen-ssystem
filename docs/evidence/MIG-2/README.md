# MIG-2 证据包（`addTablePrefix` 反引号表名修复）

> 执行人：阿坚（后端 · 本地子代理代执行）｜2026-09-24
> 结论见 `影响面.md`；本文件只讲"有哪些产出、怎么复跑"。

## 一、缺陷与修复

- 病灶：`backend/src/shared/migration.ts` 的 `addTablePrefix` 只认裸表名，遇到 `` CREATE TABLE IF NOT EXISTS `x` `` 时可选组 `IF NOT EXISTS` 回溯为空、名字组抓到关键字 `IF` ⇒ 改写成 `CREATE TABLE t_IF NOT EXISTS `x`` ⇒ ER_PARSE_ERROR ⇒ 被 `safeExec` 跳过（174/175 的三张新表因此从未建成）。
- 修复：10 个既有模式的名字组统一改为 `(`[a-z_][a-z0-9_]*`|[a-z_][a-z0-9_]*)`，命中后按引号形态重建（`` `x` `` → `` `t_x` ``）；不带反引号的输入输出逐字节不变。

## 二、产出清单

| 文件 | 内容 |
| --- | --- |
| `影响面.md` | 行为变更影响面（结论、数字自证、逐条差异、数据/结构分节、与 174/175 对账） |
| `impacts.json` | 机读影响面（含 5 条差异明细、分桶、扫描范围） |
| `tools/mig2-lib.mjs` | 公共库：从真实源码抽取 `addTablePrefix` 并 `typescript.transpileModule` 转译（禁止手写复刻）；表名抽取 |
| `tools/mig2-impact.mjs` | 影响面扫描（口径复用 MIG-1 `simulateRunner` / `stmtType` / `riskOf`） |
| `tools/mig2-verify.mjs` | 函数级行为验证 + 反测（新/旧/回退版三列对比） |
| `outputs/00-old-migration.ts.txt` | 修复前源码（`git show HEAD:backend/src/shared/migration.ts`） |
| `outputs/00b-reverted-migration.ts.txt` | 回退版源码（工作区文本 + 旧函数块），仅供人工核对"回退即该版本" |
| `outputs/01-tsc.txt` / `outputs/01-eslint.txt` | 类型检查 / lint 原始输出 |
| `outputs/01b-tsc-testfile.txt` | 测试文件单独类型检查（`tsconfig.json` 排除了 `src/__tests__/**`，故单独补跑） |
| `outputs/01-fix.patch` | `git diff -- backend/src/shared/migration.ts backend/src/__tests__/shared/migration.test.ts` |
| `outputs/02-verify.txt` / `.json` | 20 条用例逐条结果（含 12 条反测位、8 条零差异冻结位） |
| `outputs/04-impact.txt` | 影响面扫描原始输出 |
| `outputs/05-git-status.txt` | `git status --porcelain` 原始输出 |
| `outputs/06-vitest-blocked.txt` | `npm --workspace backend test` 的原始 EPERM 输出（本环境无法运行 vitest） |
| `outputs/07-run-all.txt` | 一键复跑汇总（tsc / eslint / verify / impact 四步的命令、关键输出、EXIT） |

## 三、复跑

```powershell
cd D:\Users\ZXQL\wt-agents\issue-74
git show HEAD:backend/src/shared/migration.ts > docs/evidence/MIG-2/outputs/00-old-migration.ts.txt
node docs/evidence/MIG-2/tools/mig2-verify.mjs     # 期望 RESULT: ALL PASS / EXIT=0
node docs/evidence/MIG-2/tools/mig2-impact.mjs     # 期望 RESULT: ALL PASS / EXIT=0
cd backend
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit      # 期望 EXIT=0
node ../node_modules/eslint/bin/eslint.js src/shared/migration.ts src/__tests__/shared/migration.test.ts  # 期望 0 error（1 条既有 warning）
```

## 四、本环境限制（与派工卡 §六 一致）

- `vitest` 不可运行（`spawn EPERM`，esbuild 起不来）⇒ 后端用例由 `tools/mig2-verify.mjs` 以**同一组断言**在转译后的真实函数上复跑，**未跑全量 569 文件 / 6192 用例**；
- 无 MySQL / docker（连不了库、执行不了 SQL）⇒ 影响面为静态结论，"表是否真的建成"需部署后在服务器侧核对；
- `git` 写被拒（不能建分支/提交/推送）⇒ 本单只产出 `01-fix.patch` 与两个改动文件的 SHA256。
