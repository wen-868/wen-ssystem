# ACTIVE-回执-QODER-20 · 移动端最终集成与单基线 11/186

> 汇报对象：凌舟（经用户中转）｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-20
> 十项全文回传：`docs/tasks/cards/R101-QODER-20-回传.md`｜证据：`docs/evidence/qoder-20/**`（README + raw/00、10–14、20–22、30–31、40–45）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-20`｜分支：`chore/qoder-20-mobile-final-integration`｜基座：`cdf16ce4`（QODER-19 尖端，10/184）
> 任务书原件与 `docs/tasks/inbox/ACTIVE.md`：**只读未动**；本回执为新增文件，不改他人行。
> 以下全部是**执行方自评**与卡片目标读数的对照，不含任何归属验收方的判词。

## 人读摘要

三笔合并按卡 §一 顺序落完，最终单一基线 **11 文件 / 186 用例**，与卡 §二 的算式（184 + 1 + 1 + 0）逐项对上：

1. **合并链（真合并、双父、未 rebase、来源支尖端未变）**：`9ff7a47c`（← 13F2 `99371862`）→ `c1e4cd40`（← QODER-18 `bd7e158f`）→ `50b03a51`（← QODER-11R `df583401`）。取证 `raw/41`（谱系 + 每笔实际改写文件）与 `raw/44`（`git rev-list --parents` 双父 + `--first-parent` 链）。
2. **冲突面 = 只有 `gates-baseline.json.tests`**：前两支各一次（10/184 vs 6/57、11/185 vs 6/71），11R 零冲突。其余五段（`_comment/typeCheck/lint/checkContract/contractDrift`）相对基座逐段机检 **UNCHANGED**。
3. **基线是实测出来的，不是手定的**：每笔先按该支应到增量**预测** tests 值，再立刻跑门 3 **实测**——11/185、11/186 两次均 `TEST_GATE_EXIT=0` 且实测==预测才收口该笔；11R 合并后与 ⑦ 补写后各复跑一次，读数始终 11/186。
4. **业务实现未被合并改写（卡 §一.5）**：逐文件 blob 比对 ⇒ 7 个变化文件里只有 `gates-baseline.json` DIFFERS，`env.ts`/`permission-gates.ts`/`pin-ssl.ts`/`pin-ssl-static.spec.ts`/`request.ts`/`request-retry-safety.spec.ts` 全 `SAME_AS_BRANCH`；反向 7 文件（含 `storage-crypto.spec.ts`、guard 脚本）终态与各支尖端逐字节一致。取证 `raw/42`。
5. **四门 + 三构建 + 双守卫全 EXIT=0**（卡 §三 前三条全覆盖）：type 0=0／lint error 20·warning 12872（=基线，未借机调整）／test 11/186／contract 差集 1 条全具名豁免（A.2 292/283/204、后端注册 1498）；`build:h5`、`build:mp-weixin`、`build:app` 三份 `DONE Build complete.`；`guard --strict` 与 `--strict --no-stale` 均 `✅ 无「未登记」项`（189 路由文件 · 763 写端点 · 已接线 423 / 消费者端 45 / 查询型 POST 6 / 无授权形态 289 条已登记）。
6. **合并后自检暴露一处留痕缺项并已补**：note 逐项可核机检打出 `最终集成单⑦:false`——我的解冲突脚本只在「发生冲突」时追加 note，11R 无冲突因此没留痕。补 `602d9d36`（note-only，`diff = 1 增 1 删`，tests 数值一字未动），复跑四门仍 `CHECK_GATES_EXIT=0` / 11/186（`raw/43`）。

## 判据自评（卡 §三 逐条）

| 卡 §三 判据 | 目标读数 | 实测（执行方自评） | 证据 |
|---|---|---|---|
| `check:gates` | EXIT=0，且四门分项读数与卡面一致 | **`CHECK_GATES_EXIT=0`**：type 0=0／lint error 20（基线 20）·warning 12872（基线 12872）／test「当前 11 文件 / 186 用例，基线 11 / 186」／contract 差集 1·具名豁免 1 | `raw/10`（+单跑 `raw/11`–`14`） |
| `build:h5` / `build:mp-weixin` / `build:app` | 三构建均 EXIT=0 | **三份均 `DONE Build complete.` + EXIT=0**；其中告警（`hd-scan.svg`、`custom-tab-bar`、`native/scan.ts` 混导入）在基座 `cdf16ce4` 同样存在，非本卡引入 | `raw/20`/`21`/`22` |
| `guard-rbac-wiring.mjs --strict` 与 `--strict --no-stale` | 均 EXIT=0 | **均 EXIT=0**、`✅ [--strict] 无「未登记」项`；两份日志逐字节相同（差 0 行）因陈旧登记为 0 条 ⇒ 开关被走到但无可抑制项（能红取证在 `docs/evidence/qoder-13/anti/anti-inject-nostale-red.log`，脚本 `:801-810`） | `raw/30`/`31` |
| `git diff 21b465e5..HEAD -- backend/src` = 0；backend 仅允许 guard 脚本 | 0 行 | **`BACKEND_SRC_DIFF_LINES=0`**；`git diff --name-only 21b465e5..HEAD -- backend` 只 `backend/scripts/guard-rbac-wiring.mjs` | `raw/40` |
| `request.ts` 不再导出 upload；`products.ts`/`profile.ts` 封装保留 | 前者 0 命中、后者保留 | **`rg -n upload app-mobile/src/api/request.ts` = 0 命中（RG_EXIT=1）**；封装 5 处命中保留（`profile.ts:33 uploadAvatar`／`:49 uni.uploadFile`／`products.ts:451 uploadImage`／`:460 uni.uploadFile`／`:483 export { productsApi, uploadImage }`，RG_EXIT=0） | `raw/40` |
| 工作树 clean | `git status --porcelain` 空 | 采集时仅 `?? docs/evidence/qoder-20/`（随后已提交）；每笔提交后自跑 `git status --porcelain` 为空 | `raw/40` + 各笔提交 |
| 最终 baseline **必须** 11 文件 / 186 用例，note 逐项列 184+1+1 来源 | 11/186 | **`tests = 11/186`**；note 含 ⑤（13F2 新 spec ⇒ 185）／⑥（18 it⑭ ⇒ 186）／⑦（11R docs-only ⇒ 0 用例）三段来源，基座 QODER-19 的 ①②③④（184 构成）原样保留 | `raw/41`（含补记段）/`raw/43`/`raw/44` |
| 冲突只允许落在 `gates-baseline.json.tests`；业务实现不得改写 | 范围锁死 | 冲突面 = 前两支各一次 baseline.tests（第三支零冲突）；`raw/42` 逐文件 blob `SAME_AS_BRANCH`；`raw/44` 冲突标记 0 残留 | `raw/41`/`42`/`44` |

186 的构成（门 3 原始输出逐文件对账，`raw/13`）：`format 78 + permission-view-state 29 + price-anomaly-static 24 + request-retry-safety 15 + entry-gate-consistency 12 + mobile-permissions 8 + permission-codes 8 + storage-crypto 4 + safe-top-var 4 + api-base-env 3 + pin-ssl-static 1 = 186`，文件 11。

## 过程披露（不掩盖）

- **【事故】latin1 写坏 `gates-baseline.json`**：解冲突脚本初版按 latin1 读写，向含中文的 note 追加 UTF-8 文本 ⇒ 乱码 + 控制字符，`require()` 在 line 59 报 JSON 解析错。损坏产物留在树外 `_scratch/qoder-20/gates-baseline.CORRUPTED-latin1-write.bin` 作取证；用 `git checkout -m -- <path>` 回到**冲突态**（当时尚无有效解决，故不是丢弃成果）后改 utf8 重跑，再复测收口。教训：仓库内含中文的 JSON 一律 utf8；latin1 只用于纯字节注入类反测。
- **【口径】`git checkout -m` 复原出的标记是 `<<<<<<< ours` / `>>>>>>> theirs`**，脚本原样匹配 `<<<<<<< HEAD` ⇒ 匹配串改为无关化 `<<<<<<<`。首次表现为「脚本说没找到冲突块」，容易误判为文件已解决。
- **【假读数】`git merge … | tail` 打印 `MERGE_EXIT=0` 却有 CONFLICT**：管道末位命令改写 `$?`，`UU` 才是真的。此后所有命令一律 `> tmp 2>&1; rc=$?`（本目录全部 `EXIT=` 行均为该形态）。同坑在 13F2 的 `raw/09` 也踩过并已补正。
- **【我的纪律违规 ×2 · 均在落盘前自纠】**：① 写回传卡 §一 时在未提交状态下凭空写了「本笔提交哈希 `a1ad1cbf`」——该对象当时不存在，是我猜的；② 补哈希笔中我又在「全哈希」列打了 `24590d15e0b0c000…000` 占位假哈希。猜哈希等同于造伪证。两处均已用 `git rev-parse` 现场取的哈希替换，纪律收口为「提交前不存在的对象一律不写哈希，只写取哈希的命令」。报备在卡 §九.0。
- **11R 合并零冲突**，与卡 §一.5 预设（冲突只落在 tests）不同：实际只有前两支有冲突。卡未要求制造冲突，如实报备。
- **本卡未做反测**：卡 §三 未对合并卡单列「门必须能红」，本卡不新增判定逻辑；门 3 对两个新增断言面的能红性由来源卡自证（`docs/evidence/qoder-13f2/anti/×4`、`docs/evidence/qoder-18/anti/06-final-anti-atomic-valid.txt`），且 `raw/42` 证明合并态未改动这两个 spec 的字节 ⇒ 红的能力未被合并削弱。

## 未验清单

- **合并态运行时行为未验**：本卡纯合并，未起 dev server、未做 H5 手测。11R 的场景 3 复跑取证在来源支证据（`docs/evidence/qoder-11r/`），合并态未复跑。
- **`--no-stale` 在合并态的能红性未现场重做**（理由见上）。
- **门 3 只验「全过 + 数量不劣化」**，未验断言语义等价性（依据来源卡自证）。
- **三构建产物未做体积/包体对比**，只验 EXIT=0 与告警非新增。
- **lint error 20 未在本卡清零**：属 QODER-21（并行单，其工作树基线为 `21b465e5`，tests 5/56，与本卡基座不同源）。

## 阻塞

无。合并链已停在 `50b03a51` + 两笔 docs/chore，等凌舟验收与 main 合入口径。

**给 main 合并时的冲突预告（机检得出，非推测）**：本分支相对基座只改了 `gates-baseline.json` 的 `tests` 段（`testFiles`/`testCount`/`note` 三行）+ `602d9d36` 的 note 一行；若 QODER-21（`lint` 段：`errorBaseline 20→0`、`errorsByFileRule {}`、`mustReachZero true`）也要进 main，两支会在同一文件的**不同段**冲突 ⇒ 收敛终态应为 `tests = 11/186` 且 `lint.errorBaseline = 0`，其余四段保持基座值。

===DSH-RECEIPT-BEGIN===
id: QODER-20
status: done-self-assessed
summary: 移动端最终集成——自基座 cdf16ce4（QODER-19 尖端 10/184）按卡序三笔真合并（13F2 99371862 → QODER-18 bd7e158f → QODER-11R df583401），冲突面严格只落在 gates-baseline.json 的 tests 段（第三支零冲突），基线以「先预测、后门 3 实测」逐笔收口到最终单一基线 11 文件 / 186 用例（184 + 1 pin-ssl-static.spec 文件与用例 + 1 request-retry-safety it⑭ + 0 docs-only），note 逐项列 ⑤⑥⑦ 来源；逐文件 blob 比对证明被合入支的实现未被合并改写；四门 + 三构建 + 双守卫全 EXIT=0；backend/src diff 0 行、request.ts upload 零命中、products/profile 上传封装保留；合并后自检暴露 ⑦ 留痕缺项已按 note-only 补写并复跑四门
worktree: D:\Users\ZXQL\wt-agents\QODER-20
branch: chore/qoder-20-mobile-final-integration
commits: 基座 cdf16ce4a553bc0dc1659f65957ba3d31efa2d5b（未 rebase·未改历史）→ 合并① 9ff7a47c6582f8c0db325a88f47a3292d4114996（第二父 99371862df326d3de3457a4d621d7494c75c59c4=13F2 尖端）→ 合并② c1e4cd405c62a5a7cf6d8bb391e6ee25092fa269（第二父 bd7e158f348bfc4de56bf1577e1d9b09ff18676b=QODER-18 尖端）→ 合并③ 50b03a51f9d855f08c800c755440c363fcb01c32（第二父 df5834013432ec4484a929c9252adf77ac2b245a=QODER-11R 尖端）→ 602d9d362126a38107a5bbb5422318e6c2fc68f6（chore·gates-baseline tests.note 追加最终集成单⑦ 一行，testFiles/testCount 一字未动，四门复跑仍 11/186）→ c3942309cd9277bde711ec3341f3bdaad4fdd2cb（docs·证据树 17 文件）→ 24590d15e565b05e4675ca46713151705f87bbd7（docs·回传卡 + 本回执）→ 补哈希笔（= 分支尖端；本笔哈希请用 git rev-parse HEAD 现场取，不在文内写死）
gates: check:gates EXIT=0／type-check EXIT=0（vue-tsc 0 条=基线 0 条）／lint EXIT=0（error 20=基线 20·warning 12872=基线 12872·门自带 ⚠「error 级不许长期冻结」原样保留·未借机调基线）／test EXIT=0（Test Files 11 passed (11)·Tests 186 passed (186)·门 3「当前 11 文件 / 186 用例，基线 11 / 186」·逐笔合并实测 11/185→11/186→⑦ 补写后 11/186）／check:contract EXIT=0（差集 1·具名豁免 1·A.2 292/283/204·后端注册 1498）；build:h5 / build:mp-weixin / build:app 均 DONE Build complete. + EXIT=0；guard-rbac-wiring.mjs --strict 与 --strict --no-stale 均 EXIT=0（189 路由文件·763 写端点·已接线 423/消费者端 45/查询型 POST 6/无授权形态 289 条已登记·未登记 0；两份日志逐字节相同因陈旧登记 0 条）；范围机检 BACKEND_SRC_DIFF_LINES=0、backend 允许面只有 guard-rbac-wiring.mjs、rg upload request.ts=0 命中（RG_EXIT=1）、products.ts/profile.ts 上传封装 5 处保留、冲突标记 0 残留、gates-baseline.json require() 可解析且五段相对基座 UNCHANGED
redlines: 未 push／未开 PR／未 git add -A（全程逐文件 add：gates-baseline.json 单文件、证据 README + raw/*.log 逐个、卡与回执各单文件）／未 rebase·未 squash·未改历史·未切他人分支（三笔均 --no-ff 真合并，来源支尖端哈希未变）／未动 backend/src（diff 0 行）／未改写被合入支的业务实现（逐文件 blob SAME_AS_BRANCH）／gates-baseline 只动 tests 段且实测即基线，lint errorBaseline 保持 20 未借机调整·未关规则·未加 eslint-disable／未 npm install·未改 package.json 与 lockfile／未动任务书原件与 docs/tasks/inbox/ACTIVE.md／只动自己的工作树与分支（解冲突脚本与 latin1 损坏产物留在树外 _scratch/qoder-20/）／全文只写执行方自评与卡片目标读数，不写归属验收方的判词（卡 §五 的 ✓ 仅指「与卡 §三 字面判据一致」）
evidence: docs/evidence/qoder-20/**（README 索引 + 186 构成对账 + 命令形态与解冲突方法与四次踩坑记录；raw：00 合并前基座读数、10 串行四门、11-14 四门单跑、20-22 三构建、30-31 双守卫全量原始输出、40 范围与红线（backend/src 0 行·guard 脚本独占允许面·upload 判据·git status）、41 合并谱系与每笔改写文件与基线净 diff 与 note 逐项可核（含 ⑦ 补记段）、42 逐文件 blob 身份正反双验、43 ⑦ 补写后四门复跑、44 冲突标记零残留与双父纯度、45 文内引用哈希逐条验真（10 个 40 位全 REAL + 13 个 8 位里 12 个 REAL，唯一 UNVERIFIED 是 §过程披露里我自报的假哈希样例 a1ad1cbf）；零字节文件：无（find docs/evidence/qoder-20 -type f -size 0 为空））
return_card: docs/tasks/cards/R101-QODER-20-回传.md
===DSH-RECEIPT-END===
