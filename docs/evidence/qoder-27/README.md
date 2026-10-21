# QODER-27 证据树 · 四树 tests 基线收敛与联合集成

> 执行方：Qoder（移动端）｜日期：2026-10-22｜派单卡：`docs/tasks/inbox/QODER-27-f1-baseline-convergence.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-27`｜分支：`chore/qoder-27-f1-baseline-convergence`
> 回传卡：`docs/tasks/cards/R101-QODER-27-回传.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-QODER-27.md`
> **本树全部为执行方自证读数，不含验收方判词。**每条都标了「实测／转录」归属，转录的一律写明来源。

## 1 结果一览（终态，全部为 `167979aa` 上的实测）

| 判据（卡 §三） | 读数 | 出处 |
|---|---|---|
| `check:gates` EXIT | **0** | `raw/21-gates-full.log:21`（摘要末行 `GATES_EXIT=0`）／`raw/70-final-gates-recheck.raw.log:78`（收尾复跑 `FINAL_GATES_EXIT=0`）；原文各读数见下四行 |
| tests | **15 文件 / 303 用例**（基线同值） | `raw/21-…raw.log:53-54`、`:58` |
| type | **0**（基线 0） | `raw/21-…raw.log:10` |
| lint | **error 0（基线 0）／warning 12872（基线 12872）** | `raw/21-…raw.log:17` |
| contract | **差集 1 条，具名豁免 1 条** | `raw/21-…raw.log:69` |
| h5 / mp-weixin / app 构建 | **三次 EXIT=0**，`DONE Build complete.` | `raw/22-build-*.raw.log`、`raw/22-builds-and-mp-warning.log` |
| MP 保留名警告 | **0**（且有正对照可证伪） | `raw/22-builds-and-mp-warning.log:38-45` ＋ 正对照 `raw/anti/R-TAB-B.log` |
| `git diff main..HEAD -- backend/` | **本卡 authored 0**；字面 `+21` 行全为继承（见 §5） | `raw/30`、`raw/71` §3 |
| 工作树 clean | 文档笔之后 **0 行**（含未跟踪） | `raw/50` §7、§8（merge 时点）＋ `raw/73:6`（收尾） |
| 未 push / 未开 PR / 逐文件 add | 三面均成立（在线 `ls-remote` 因网络未成，已登记） | `raw/50` §1~§3 ＋ `raw/73:26-40` |

四笔真 merge（不 rebase、不 squash，固定序）：

| 步 | merge 提交 | 并入 | `MERGE_EXIT` | 冲突面 | tests（blob 值 → 收敛后） |
|---|---|---|---|---|---|
| M1 | `18cb89b0` | QODER-23F1 `71b248c8` | 0（无冲突） | 无 | → 11/191（note 5395） |
| M2 | `57ccbfe9` | QODER-24 `dd44e321` | 1（预期） | 仅 `gates-baseline.json` | 11/191 → **12/232**（note 6095） |
| M3 | `8835d11c` | QODER-25F1 `317e421d` | 1（预期） | 仅 `gates-baseline.json` | 12/232 → **14/248**（note 7899） |
| M4 | `167979aa` | QODER-26 `1b6da083` | 1（预期） | 仅 `gates-baseline.json` | 14/248 → **15/303**（note 9460） |

⚠ **读数归属**：M2/M3/M4 三步的数值是**当场跑 `npm run test`（vitest）实测**（`raw/11a`、`raw/13a`、`raw/14a`，汇总行分别在 `:30-36`、`:33-39`、`:34-40`）；
**M1 是无冲突自动合并，当时只读了合并后的 blob 值（11/191），没当场跑 vitest** ⇒ 已在 `raw/72` 用 detached checkout 到 `18cb89b0` 补测（见 §6 时序说明）。

## 2 `raw/` 索引（按取证顺序）

本树件数：随第一笔文档提交（`ef9fcd50`）为 **63 件**＝本 README ＋ `raw/` 32 ＋ `raw/anti/` 15 ＋ `tools/` 15（`git ls-files --others` 与 `find -type f` 双向对过，非估算）；
第二笔文档提交（`3924cd04`，收入 `raw/73` 收尾态实测）后为 **64 件**；第三笔文档提交（收入交付 HEAD 上的四门复跑 `raw/74` ×2）后为 **66 件**＝本 README ＋ `raw/` 35 ＋ `raw/anti/` 15 ＋ `tools/` 15。

| 文件 | 内容 | 关键行 |
|---|---|---|
| `00-pre-state.log` | 开工前提核验：分支、基座＝main `7dda80b8`、四 tip 在册、`main` 自 merge-base `21b465e5` 起 `app-mobile` 改动 0 字节 | `:20` `MAIN_APPMOBILE_DIFF_BYTES=0` |
| `01-baseline-gates-main.log` | **main 上的门基线读数**（对照面）：error 20（基线 20）、tests 5/56 | `:19`、`:43-44`、`:62` `GATES_EXIT_BASELINE=0` |
| `10-m1-merge-23f1.log` | M1 全过程：预测 → `git merge --no-ff` → `MERGE_EXIT=0` → 合并文件清单 → 无残留 | `:4`、`:7`、`:1116` |
| `11-m2-merge-24.log` | M2：`MERGE_EXIT=1` → 冲突面枚举 → `--ours` 取值 → 解算器（只动 `tests`）→ 回读 | `:4`、`:51`、`:71-78` |
| `11a-m2-test-measure.raw.log` | M2 收敛后 vitest 实测原文 | `:30-31` `12 passed (12)`／`232 passed (232)` |
| `12-m3-merge-25f1.log` | M3 同形态（含 `custom-tab-bar` 以 R083 重命名落地的说明） | `:20`、`:45`、`:67-74` |
| `12-m3-merge-25f1.raw.log`／`13a-m3-test-measure.raw.log` | M3 merge 原文／M3 vitest 实测 | `13a:33-34` `14`／`248` |
| `14-m4-merge-26.log` | M4 同形态 ＋ **note 四段逐段验真**（`verify-note-segments.cjs`） | `:22`、`:62-69`、`:80-83` |
| `14-m4-merge-26.raw.log`／`14a-m4-test-measure.raw.log` | M4 merge 原文／M4 vitest 实测 | `14a:34-35` `15`／`303` |
| `20-static-check.log` | 卡 §二.3 四项静态检查 19 条断言 | `:27` `STATIC_CHECK=PASS failures=0` |
| `21-gates-full.log`／`21-gates-full.raw.log` | 全量四门（摘要／原文） | `raw:10,17,53-54,58,69,71` |
| `22-build-{h5,mp-weixin,app}.raw.log`、`22-build-mp-weixin.log` | 三端构建原文与去色摘要 | 各文件末行 `BUILD_EXIT_*=0` |
| `22-builds-and-mp-warning.log` | 三构建汇总＋**MP 撞名警告 0**＋`dist` 面枚举＋两段更正 | `:38-45`（读数）、`:49-55`（正对照更正）、`:56-62`（截断事故与恢复回证） |
| `23-rebuild-mp-weixin.raw.log` | 收尾时重跑清洁态 mp 构建（为 §6 的 `dist` 复现铺底） | `BUILD_EXIT_mp-weixin=0`、`DONE Build complete.` |
| `30-backend-and-scope-diff.log` | backend 零改动归因 ＋ `main..HEAD` 改动面按目录统计 | `:6-22`、`:50` |
| `40-anti-test-ledger.log` | 反测五轮台账（四路必做＋一路加测正对照） | 表格 `:9-14`、归因唯一性 `:30-36`、出厂态复核 `:38-45` |
| `50-redline-selfcheck.log` | 红线八节自检 ＋ 两轮自我更正 | `:3/:11/:16`（push/PR/add）、`:117`（用例）、`:124`（非 tests 段）、`:134`（证据目录）、`:140`（clean）、`:146/:176`（更正） |
| `51-merged-file-audit.log`／`51-audit-out.txt` | 三个双边自动合并文件相对两父的行级保全核对 | `MERGED_FILE_AUDIT=PASS` |
| `52-authored-files.txt`／`52-authored-files.stderr.txt` | `main..HEAD` 全量文件清单（727 条＝42 代码 ＋ 685 文档）与首轮坏量具stderr | 全文 |
| `70-final-gates-recheck.log`／`.raw.log` | **收尾复跑全量四门**（在提交文档后/最终树） | `FINAL_GATES_EXIT=` |
| `71-main-lag-and-nontests-attribution.log` | 非 `tests` 段逐版本哈希表 ＋ main 落后度 ＋ backend `+21` 的钉死归因 | `:12-24`（哈希表）、`:30-55`（逐字段）、`:56-69`（backend）、`:70-86`（main 落后度） |
| `72-m1-measure-backfill.log` | M1 那一步的 vitest 补测（detached checkout `18cb89b0`） | 汇总行 ＋ 回枝后 `HEAD` 复核 |
| `73-close-state.log` | 文档笔之后的收尾态（clean／源码 0 动／红线复核／交付清单总数／自指口径） | `:6` `PORCELAIN_LINES=0`、`:19` `app-mobile 改动文件数=0`、`:30` 无上游、`:44-52` 清单、`:53` `CLOSE_STATE_FINAL=clean`、`:55-61` 自指口径 |
| `74-final-gates-at-delivered-head.raw.log` | **交付 HEAD `3924cd04` 上第三次亲跑四门**（跑前 HEAD／分支已记入 `:2`） | `:14` type 0、`:21` error 0／warning 12872、`:56-57` 15／303、`:61` 基线同值、`:72` 差集 1 豁免 1、`:75` `DELIVERED_HEAD_GATES_EXIT=0` |
| `74-final-gates-at-delivered-head.log` | 上文的摘要＋代码面恒等证明（`167979aa..HEAD` 非 docs 0 文件）＋三端构建未重跑的理由与 C-引号计数坑 | §1 读数表、§2 恒等证明、§3 构建口径 |

`raw/anti/` —— 五轮反测每轮三份：`R-*.log`（轮次台账）、`R-*.red.raw.log`（注入态原文失败输出）、`R-*.green.raw.log`（复原后绿）。
`R-TAB-B.*` 是「MP 警告 0」的正对照（无 red/green 对，因为是构建路）。

## 3 `tools/` 索引（取证装置，入库为求「可复跑」）

| 装置 | 用途 | 跑法 |
|---|---|---|
| `resolve-tests.cjs` | 冲突解算器：只重写 `tests` 段，note 按「来源 note − 共同基线 note」逐段追加；回读六项校验 | `node resolve-tests.cjs --files N --count M --segs <rev>[,<rev>] [--extra-file <txt>]` |
| `extra-27-ledger.txt` | QODER-27 自己的收敛台账段（590 字符，走 `--extra-file` 注入） | 同上 |
| `verify-note-segments.cjs` | 证四段来源逐字在册：`foundAt` 递增、`occurrences=1`、`verbatimInSource=true` | `node verify-note-segments.cjs` |
| `static-check.cjs` | 卡 §二.3 四项静态检查（19 条断言，含"旧缺陷形态归零"） | `node static-check.cjs` |
| `inject.cjs` | latin1 逐字节注入器：`hits !== 1 ⇒ exit(2)` 且不写盘；`sha` 模式出目标文件哈希 | `node inject.cjs inject\|verify\|sha --file <abs>` |
| `anti-rounds.sh` | 四路反测驱动（注入 ⇒ 红 ⇒ `cp` 复原 ⇒ 绿 ⇒ SHA 恒等 ⇒ 残字） | `bash anti-rounds.sh <R-IV\|R-TAB\|R-REACT\|R-SKU>` |
| `anti-tab-mp-control.sh` | 加测路 R-TAB-B：造出保留名再跑 mp 构建，证「0 警告」可证伪 | `bash anti-tab-mp-control.sh` |
| `merge-file-audit.cjs` | 双边自动合并文件对两个父的行级保全核对 | `node merge-file-audit.cjs` |
| `authored-files.cjs` | `main..HEAD` 逐文件与五个输入面比 blob ⇒ 定出"本卡真正 authored"集 | `node authored-files.cjs` |
| `nontests-audit.cjs` | **失败首版**（把数千字符 note 打进 stdout ⇒ 输出被截断），保留以登记量具失误 | — |
| `nontests-audit2.cjs` | 非 `tests` 段逐版本哈希表 ＋ 逐字段 DIFF | `node nontests-audit2.cjs` |
| `main-lag-audit.cjs` | 祖先关系、main 落后度、backend 继承面 | `node main-lag-audit.cjs` |
| `check-notes.cjs` | 早期四 tip note 前缀／长度普查（确认「共同基线 2941 字符前缀」这一前提成立） | `node check-notes.cjs` |
| `probe-needles.cjs` | 反测前对注入 needle 的命中数预检（`hits` 不为 1 的靶先剔除，避免打偏） | `node probe-needles.cjs` |
| `make-junctions.ps1` | 工作树 `node_modules`／`app-mobile/node_modules` 以 junction 指向 `QODER-23` 树（开工前置，`raw/00` 的门禁可跑条件） | `powershell -File make-junctions.ps1` |

⚠ 装置里的工作树路径写死为 `D:/Users/ZXQL/wt-agents/QODER-27`；换机复跑需就地改常量，或把本目录放回 `_qoder27_setup` 同层。
证据目录只登记装置与读数，**不把装置接进 `check:gates`**（本卡无权改门禁组成）。

## 4 收敛口径（`tests.note` 到底留了什么）

终态 `note` 9460 字符 = 共同基线 `bc1087ee` 的 2941 字符 **原文前缀** ＋ 五段追加：

| 段 | 来源 | 长度 | 在终态 note 中的起点 |
|---|---|---|---|
| ① | QODER-23F1 `71b248c8` | 2454 | 2941 |
| ② | QODER-24 `dd44e321` | 700 | 5395 |
| ③ | QODER-25F1 `317e421d` | 1804 | 6095 |
| ④ | QODER-26 `1b6da083` | 971 | 7899 |
| ⑤ | QODER-27 收敛台账 `extra-27-ledger.txt` | 590 | 8870 |

⇒ 机检口径：每段都是从来源 blob 的 note **减去共同基线前缀**得到的原文切片，逐段 `occurrences=1`、起点严格递增、互不重叠，长度和 ＝ 终态长度；`noteStartsWithOld=true` 保证"只追加、不删改"。原文见 `raw/14-m4-merge-26.log:80-83`。

## 5 两条必须让读者看见的口径事实

1. **`main` 落后于四树共同基线 `bc1087ee`**：`git merge-base --is-ancestor bc1087ee 7dda80b8` ⇒ 否。
   main 的 `gates-baseline.json` 非 `tests` 段哈希是 `66572971fdd0dff3`（lint `errorBaseline` 20、13 对冻结、tests 5/56），
   `bc1087ee` 及四 tip、四个 merge 中间点、HEAD 一律是 `e56a03ac4fc36231`（lint 0、`{}`、tests 11/186→15/303）。
   ⇒ 所以 `main..HEAD` 的门禁口径确实变严了（error 20→0），**这是 M1 单边自动合并带入的既有收紧，不是本卡调整**：本卡四步合并没让这个哈希变过一个字（哈希级证明）。
   ⇒ 同理 `main..HEAD` 的 39 个 app-mobile 代码文件里，也含 QODER-19~22 那条线随 `bc1087ee` 并进 main 线的面；本卡真实 authored 只有 4 个文件（其中 3 个是 git 双边自动合并），手工改写仅 `gates-baseline.json` ×3 次 `tests` 段。`raw/71` §1~§2、§4。
2. **`git diff main..HEAD -- backend/` 字面不为 0**：`+21` 行落在 `backend/scripts/guard-rbac-wiring.mjs`，
   而 `git diff --numstat 7dda80b8..bc1087ee -- backend/` 是**同一行同一数**，`bc1087ee..HEAD -- backend/` **0 文件** ⇒ 100% 继承、本卡 authored 0。`raw/71` §3。

## 6 已知失效面与自我更正（不粉饰）

- **`dist/` 不是证据源**：`app-mobile/dist/` 被 gitignore，反测里任何一次失败构建（R-TAB-B 的 `BUILD_EXIT=1`）都会就地改写它。
  收尾时 `dist/build/mp-weixin/components/` 就是空的（上次成功构建被那次中断路覆盖）⇒ 必须先复跑清洁态构建（`raw/23`），
  `find`/`grep -rl` 三段才与归档读数逐行一致。⇒ 教训：隔时重跑"读 dist"的命令，若不先复跑构建，会把上一次构建残留误读成当前树读数。
- **本证据树内有一次自伤**：追加更正时把 `>>` 写成 `>`，`raw/22-builds-and-mp-warning.log` 被整文件覆盖（当时未跟踪 ⇒ git 无副本）。
  已从会话转录取回原文并三重对账（1601B＝1601B、47 行＝47 行、CRLF 0／LF 47 形态一致），
  再**重跑该文件的生成命令**独立回证 ⇒ `IDENTICAL=true`。全过程登记在 `raw/22-builds-and-mp-warning.log:55-62`。
- **M1 步缺当场 vitest 实测**（§1 表下 ⚠）⇒ 已用 detached checkout 到 `18cb89b0` 补测并登记在 `raw/72`；回枝后 `HEAD`/`porcelain` 复核原样。
- 量具失误登记四条（详见 `raw/50` §8/§10、`raw/71` §5、`raw/anti/R-REACT.log` 更正段）：
  ① `execSync` 走 cmd.exe ⇒ `^` 被当转义符（`57ccbfe9^1` → `57ccbfe91`）、`;` 不被识别（`--is-ancestor` fatal）；
  ② `rg` 三坑：`-F` 是布尔标志（多模式要 `-F -e A -e B`）、不能跨行匹配（多行 needle ⇒ `EXIT=2` 是工具错不是读数）、CJK 路径需 `-z`/NUL 分隔否则 C-引号把 42 个代码文件误报成 93；
  ③ 空 SHA 会造出 `BYTE_IDENTICAL=true` 的假恒等 ⇒ 已加"64 位十六进制"硬门；
  ④ `git show --name-only <merge>` 是 combined diff（相对**两个父都不同**），不等于本卡手工改写集 ⇒ 用 blob 比对法（`tools/authored-files.cjs`）出终版。

## 7 复跑指引（最短路径）

```bash
cd /d/Users/ZXQL/wt-agents/QODER-27/app-mobile
npm run check:gates                      # 判据：type 0／error 0·warning 12872／tests 15·303／差集 1 豁免 1
for t in h5 mp-weixin app; do npm run build:$t; done   # 三端各 EXIT=0；MP 日志 grep '专用组件|已内置|保留名' 应为 0
cd ..
git diff --numstat 7dda80b8..HEAD -- backend/          # 字面差＝21 0 backend/scripts/guard-rbac-wiring.mjs（继承面，raw/71 §3）
git diff --numstat bc1087ee..HEAD -- backend/          # 本卡在此面上的改动＝0 文件（authored 0）
git status --porcelain                                 # 应为空
node docs/evidence/qoder-27/tools/verify-note-segments.cjs   # note 四段逐段验真
node docs/evidence/qoder-27/tools/static-check.cjs           # §二.3 四项 19 条断言
```

反测复跑（会就地改写源码，务必按台账逐轮复原）：`bash docs/evidence/qoder-27/tools/anti-rounds.sh R-IV`（余 `R-TAB`／`R-REACT`／`R-SKU`）。
