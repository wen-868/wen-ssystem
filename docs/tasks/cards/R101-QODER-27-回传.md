# R101-QODER-27 回传 · 四树 tests 基线收敛与联合集成

> 对应派单卡：`docs/tasks/inbox/QODER-27-f1-baseline-convergence.md`｜证据树：`docs/evidence/qoder-27/README.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-27`｜分支：`chore/qoder-27-f1-baseline-convergence`｜基座：main `7dda80b8`
> **执行方自评，不含验收方判词**；下列每条读数都在本会话内亲跑，出处写到文件＋行号。

```
【汇报 QODER-27】QODER-27 四树基线收敛与联合集成
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
交付物：四笔真 merge（18cb89b0 ←71b248c8、57ccbfe9 ←dd44e321、8835d11c ←317e421d、167979aa ←1b6da083，固定序、不 rebase 不 squash）；
      app-mobile/scripts/gates-baseline.json 的 tests 段收敛到 15 文件 / 303 用例，note 9460 字符逐段保全四树来源＋本单台账；
      卡 §二.3 四项静态检查 19 条断言全过；全量四门 GATES_EXIT=0、三端构建各 EXIT=0、MP 保留名警告 0（带正对照）；
      反测 4 路必做＋1 路加测全部先红且点名、cp 复原后 SHA 逐字节恒等再绿；证据树 docs/evidence/qoder-27/**（含 tools/ 15 件装置）。
证据（可复跑）：见本卡 §二（命令＋原始输出摘要＋文件行号），装置已随证据树入库（docs/evidence/qoder-27/tools/）。
验收自评：§三 表 11 条中，除第 7 条「git diff main..HEAD -- backend/ 0」按字面未通过（+21 行，100% 继承自共同基线 bc1087ee，
      本卡 authored 0 行）⇒ 口径待裁，其余 10 条通过。逐条依据见本卡 §三。
未完成与阻塞：MP/App 真机底栏运行态未验（按卡 §四 保留给运行态卡，本单未自行处置）；QODER-28 因无设备保持 BLOCKED，本单未涉真机；
      未 push、未开 PR（红线），合并动作等凌舟裁定后由有权限方执行。
风险与自我报备：①main 落后于四树共同基线 bc1087ee ⇒ 本次 merge 带入的不止四张卡的面，且 lint 基线由 20 收紧为 0（哈希级证明非本卡动作）；
      ②证据树内发生一次自我覆盖事故（>>写成 >），已从会话转录取回原文并独立重跑生成命令回证 1601B 逐字节一致；
      ③dist/ 是构建副产物不是证据源，反测失败路会就地改写它，隔时重跑读 dist 的命令必须先复跑清洁构建；
      ④四条量具失误已就地更正并登记（cmd.exe 吃 ^ 与 ;、rg 的 -F/跨行/CJK 路径三坑、空 SHA 造出假恒等、git show 的 combined diff 语义）；
      ⑤M1 步原缺当场 vitest 实测，已用本树内临时 --detach 到 18cb89b0 补测（11/191 实测通过）并切回，跑前后 HEAD 与 porcelain 均复核原样。
回传要求：本汇报已落卡 docs/tasks/cards/R101-QODER-27-回传.md
关联卡：docs/tasks/inbox/QODER-27-f1-baseline-convergence.md
```

## 一、交付物（卡 §二 逐条，含 merge 提交与文件路径）

| # | 卡 §二 交付物 | 落点 | 出处 |
|---|---|---|---|
| 1 | 四笔固定序真 merge；除 `gates-baseline.json.tests` 外不手工改写业务实现 | `18cb89b0`／`57ccbfe9`／`8835d11c`／`167979aa`（父关系逐笔实测，非 squash：`git log -1 --format=%P` 每笔两父） | `raw/10:7`、`raw/11:4`、`raw/12:20`、`raw/14:22` |
| 1′ | 手工改写面 | **只有** `app-mobile/scripts/gates-baseline.json`，且只在 3 次冲突解算里动 `tests` 段；`crypto.ts`／`home.vue`／`products.vue` 是 git 双边自动合并 | `raw/50` §9/§10（blob 比对终版）、`raw/51`、`raw/52-authored-files.txt` |
| 2 | `tests` 终值 15/303；note 逐段保留四树来源、原文不删 | 终态 `testFiles=15 testCount=303 noteLen=9460`；note＝`bc1087ee` 原文 2941 字符前缀＋四段来源（2454／700／1804／971）＋本单台账 590 | `raw/14:63`、`raw/14:80-83`、`raw/71` §1 |
| 3 | 合并后静态检查四项 | `tools/static-check.cjs` 19 条断言：旧 `custom-tab-bar` 组件文件名/标签 0（残留仅 CSS 类名 1 处）、`aiMsg` 为 reactive（`:638`/`:644`）、`ProductInfo.id` 与 `skuId` 同源且与 SPU 分离（`products.ts:339/353`）、IV＋tag 双守卫在位且 IV 守卫早于密钥扩展/J0（`crypto.ts:618/620/626-627/641`） | `raw/20:1-27`，终行 `STATIC_CHECK=PASS failures=0` |
| 4 | 全量四门、三端构建、backend 零 diff、工作树 clean | 四门 `FINAL_GATES_EXIT=0`（15/303）；`build:h5`／`mp-weixin`／`app` 各 `EXIT=0`；backend 见 §三 第 7 条；工作树除文档外 0 行 | `raw/70`、`raw/21-…raw.log`、`raw/22-build-*.raw.log`、`raw/71` §3、`raw/50` §7、`raw/73:6` |
| 5 | 反测至少四路（IV 守卫／tabBar 保留名／reactive 代理／SKU 主键），每路必红且点名，复原 SHA 一致后绿 | 实跑 **5 轮**＝4 必做＋1 加测正对照；每轮 `注入(hits=1) ⇒ 红 ⇒ cp 复原 ⇒ SHA 恒等 ⇒ 残字核对 ⇒ 绿` | `raw/40` 台账表 `:9-14`，逐轮 `raw/anti/R-*.log` ＋ `.red.raw.log` ＋ `.green.raw.log` |

文档交付件（本笔）：`docs/tasks/cards/R101-QODER-27-回传.md`、`docs/tasks/inbox/ACTIVE-回执-QODER-27.md`、`docs/evidence/qoder-27/**` 共 **64 件**＝README ＋ `raw/` 33 ＋ `raw/anti/` 15 ＋ `tools/` 15。

## 二、证据（可复跑）——命令 ＋ 原始输出摘要 ＋ 行号

1. 四门（收尾复跑，与首跑逐行同值）
   `cd app-mobile && npm run check:gates` ⇒ `raw/70-final-gates-recheck.raw.log`
   `:10` `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`｜`:17` `当前 error 0（基线 0）、warning 12872（基线 12872）`｜`:59-60` `Test Files 15 passed (15)`／`Tests 303 passed (303)`｜`:64` `当前 15 文件 / 303 用例，基线 15 / 303`｜`:75` `差集 1 条，其中具名豁免 1 条`｜**`:78 FINAL_GATES_EXIT=0`**
   首跑原文同读数：`raw/21-gates-full.raw.log:10,17,53-54,58,69`；首跑总出口在摘要 `raw/21-gates-full.log:21 GATES_EXIT=0`（原文本份只逐段落 `⇒ EXIT=0`，末行 `:71`）。
2. 三端构建
   `cd app-mobile && npm run build:h5|build:mp-weixin|build:app` ⇒ `raw/22-build-h5.raw.log`、`raw/22-build-mp-weixin.raw.log`、`raw/22-build-app.raw.log`（各 `DONE Build complete.`＋`BUILD_EXIT_*=0`）；汇总 `raw/22-builds-and-mp-warning.log:5-33`。
   mp 在收尾时另复跑一次清洁态：`raw/23-rebuild-mp-weixin.raw.log`（`BUILD_EXIT_mp-weixin=0`、无保留名警告）。
3. MP 保留名警告 0（含可证伪正对照）
   `sed ANSI-strip raw/22-build-mp-weixin.raw.log | grep -c 'custom-tab-bar'` ⇒ **0**；`grep -cE '专用组件|已内置|保留名'` ⇒ **0**（`raw/22:38-45`）。
   正对照：造出 `src/components/custom-tab-bar.vue` ＋ 注回 `ai-chat.vue` 两处后 `npm run build:mp-weixin` ⇒ `BUILD_EXIT_mp-weixin=1`、两个 grep 分别出 **2**／**1**，命中原文 `[uni-app] 组件 <custom-tab-bar> 是 H5 平台专用组件…`（`raw/anti/R-TAB-B.log`、`raw/anti/R-TAB-B.build.raw.log`）⇒ 上面的 0 是有效零。
4. note 四段逐段验真
   `node tools/verify-note-segments.cjs` ⇒ 23F1 `segLen=2454 foundAt=2941`／24 `700@5395`／25F1 `1804@6095`／26 `971@7899`，四段均 `occurrences=1 verbatimInSource=true afterPrevSeg=true`（`raw/14:80-83`）。
   只追加证明：`raw/11:74`、`raw/12:70`、`raw/14:65` `READBACK noteStartsWithOld=true`；非 tests 段 `nonTestsByteIdentical=true`（同三行 `:76/:72/:67`）；换行 `eolCrlfOnly=47 bareLf=0`。
5. 非 tests 段归属（哈希级）
   `node tools/nontests-audit2.cjs` ⇒ `bc1087ee`、四 tip、四个 merge 中间点、HEAD 的非 tests 段 SHA256[:16] **全为 `e56a03ac4fc36231`**；main/origin/main 为 `66572971fdd0dff3`（`raw/71:12-24`）。
   `main → HEAD` 非 tests 段逐字段：`_comment/typeCheck/checkContract/contractDrift` SAME，仅 `lint` DIFF（`errorBaseline 20→0`、`errorsByFileRule 13 对→{}`、note `165→1524`），`warningsByRule` 逐键相等（`raw/71:30-55`）。
6. backend 面
   `git diff --numstat 7dda80b8..HEAD -- backend/` ⇒ `21 0 backend/scripts/guard-rbac-wiring.mjs`；
   `git diff --numstat 7dda80b8..bc1087ee -- backend/` ⇒ **同一行同一数**；`git diff --numstat bc1087ee..HEAD -- backend/` ⇒ **0 文件**（`raw/71:56-69`、`raw/30:6-22`）。
7. 改动面与本卡 authored 集
   `git diff --name-only 7dda80b8..HEAD` ⇒ 727 文件（42 代码 ＋ 685 文档）；逐文件与五个输入面比 blob ⇒ HEAD 的 blob 与任何输入面都不同的只有 4 个（`raw/52-authored-files.txt`、`raw/50` §10 终版表）。
   `git diff --numstat 7dda80b8..HEAD -- app-mobile/scripts/gates-baseline.json` ⇒ `6 20`（tests 三行 ＋ 继承的 lint 收紧）；`bc1087ee..HEAD` ⇒ `3 3`（只 tests 三行）。
8. 反测逐轮
   `bash tools/anti-rounds.sh R-IV|R-TAB|R-REACT|R-SKU` ⇒ `raw/anti/R-*.log`；台账 `raw/40:9-14`（每轮 `RED=1`、`SHA==`、残字 0、`GREEN=0`）；归因唯一性 `raw/40:30-36`（R-IV 只打掉 3 条 IV 用例而 tag 侧 6 条仍绿；R-REACT 只打掉 R1；R-SKU 打掉 10 条；四路 `FAIL` 行全落预期 spec）。
   出厂态复核 `raw/40:38-45`：`git status --porcelain`（除证据目录）＝0 行。
9. 四步 tests 实测（本轮补齐为 4/4）
   M1 `raw/72-m1-measure.raw.log:45-46,50,52` ⇒ `11 passed (11)`／`191 passed (191)`／`M1_TEST_EXIT=0`；
   M2 `raw/11a:30-31` ⇒ `12`／`232`；M3 `raw/13a:33-34` ⇒ `14`／`248`；M4 `raw/14a:34-35` ⇒ `15`／`303`。
10. 收尾态（文档笔之后）
    `git status --porcelain=v1` ⇒ **0 行**（含未跟踪）；`git diff --name-only 7dda80b8..HEAD -- app-mobile/` 中业务实现改动面复核；`git rev-parse --abbrev-ref --symbolic-full-name @{u}` ⇒ 报无上游；`git ls-remote --heads origin <本支>` 因网络 `Connection was reset` 未成，已如实登记为在线复核缺口 ⇒ `raw/73-close-state.log`（`:6` 干净、`:26-40` 未 push 三面、`:44-52` 交付清单）。

## 三、验收自评（卡 §三 硬验收逐条；自评 ＋ 依据，非裁定）

| # | 判据 | 自评 | 依据 |
|---|---|---|---|
| 1 | `check:gates` EXIT=0，15/303 | **通过** | `raw/70…raw.log:78 FINAL_GATES_EXIT=0`、`:59-60` 15/303；与首跑 `raw/21-…raw.log` 逐行同值 |
| 2 | type 0 | **通过** | `raw/70…raw.log:10`（当前 0＝基线 0） |
| 3 | lint error 0／warning 12872 | **通过** | `raw/70…raw.log:17`；与卡内数字逐位同 |
| 4 | contract 差集 1 条、具名豁免 1 条 | **通过** | `raw/70…raw.log:75` |
| 5 | h5／mp-weixin／app 构建 EXIT=0 | **通过** | `raw/22-build-*.raw.log` 三份 `DONE Build complete.`＋EXIT=0；mp 另有收尾复跑 `raw/23` |
| 6 | MP 保留名警告 0 | **通过** | `raw/22:38-45`＝0，且正对照 `raw/anti/R-TAB-B.*` 能出 2／1 并令构建 EXIT=1 ⇒ 该 0 可证伪 |
| 7 | `git diff <main>..HEAD -- backend/` 0 | **未通过（按字面）／通过（按 authored 口径）** ⇒ 待裁 | 字面差 `+21` 行于 `backend/scripts/guard-rbac-wiring.mjs`；该 21 行在 `bc1087ee` 上即存在（同一行同一数），`bc1087ee..HEAD` 为 0 文件；`git log -1 -- backend/scripts/guard-rbac-wiring.mjs` 指到 `1b61811b`（QODER-13）。出处 `raw/71:56-69`、`raw/30:6-22,40` |
| 8 | 工作树 clean | **通过** | `raw/50` §7（merge 后）＋ `raw/73:6` `PORCELAIN_LINES=0`（第一笔文档提交后）；`raw/73:55-61` 登记该 0 的自指口径（写在收尾文件本身之前的时点） |
| 9 | 未 push／未开 PR／逐文件 add | **通过** | `raw/50` §1~§3 ＋ `raw/73:26-40`（`@{u}` 报无上游、`refs/remotes` 无本支、`origin/main` 未前进）；本笔 add 用显式路径清单，未用 `-A`。⚠ 在线复核 `ls-remote` 因网络 `Connection was reset` 未成，已如实登记 |
| 10 | 卡 §二.2 note 逐段保留四树来源 | **通过** | `raw/14:80-83` 逐段 foundAt/occurrences/verbatim 机检；台账段为第 5 段（`extra-27-ledger.txt` 590 字符） |
| 11 | 卡 §二.5 反测四路必红且点名、复原 SHA 一致后绿 | **通过** | `raw/40` 五轮表＋`raw/anti/R-*` 逐轮三份 |

## 四、未完成与阻塞（逐条）

1. **MP／App 真机底栏运行态未验**：`manifest` 里 `tabBar.custom=true`，但 mp 产物不产出原生约定目录 `custom-tab-bar/`（实测 `find dist/build/mp-weixin -iname "*custom-tab-bar*"` = 0）。
   静态与构建面已闭环（组件名去撞名、`app-tab-bar.*` 正常产出、警告 0），**真机渲染未验** ⇒ 按卡 §四红线保留给运行态卡，本单未自行处置。
2. **QODER-28（真机）仍 BLOCKED**：无设备；本单按派单口径不处理真机运行。
3. **合并动作未执行**：未 push、未开 PR（红线）；`chore/qoder-27-f1-baseline-convergence` 只在本机工作树，等凌舟裁定后由有权限方落地。
   附事实：本地 main 领先 `origin/main` 6 笔（`raw/00` 末段 `ahead_of_origin=6 behind=0`），本单未动远端。
4. 无其他阻塞项。

## 五、风险与自我报备（逐条）

1. **main 落后于四树共同基线 `bc1087ee`（祖先实测为"否"）**：main 的 `app-mobile` 停在 merge-base `21b465e5` 态（tests 基线 5/56、lint `errorBaseline` 20），
   四棵树全在 `bc1087ee`（tests 11/186、lint 0）之上。⇒ 本次合并把 QODER-19~22 那条线**随 `bc1087ee` 一起**并进 main 线，
   `main..HEAD` 的 39 个 app-mobile 代码文件不全是四张卡的面；门禁口径同时由 error 20 **收紧为 0**。
   本卡对此的**手工改写为 0**（非 tests 段哈希四步未变，`raw/71` §1~§2），但如果凌舟要的是"只带四张卡"的收敛，这条必须单独裁定。
2. **判据 7 的字面不成立已如实登记**（不粉饰为通过）：+21 行为继承，归因钉死到 `bc1087ee`；口径请凌舟裁。
3. **自我覆盖事故**：追加更正时把 `>>` 写成 `>`，把未跟踪的 `raw/22-builds-and-mp-warning.log` 整文件覆盖。
   发现即停手（未提交、未扩散），从会话转录取回原文，三重对账（1601B／47 行／LF 形态）＋**重跑原生成命令**独立回证 `IDENTICAL=true`；
   事故与恢复过程都写进了证据（`raw/22:55-62`、`README.md` §6）。
4. **`dist/` 不是证据源**：反测 R-TAB-B 那次 `BUILD_EXIT=1` 的中断构建把 `dist/build/mp-weixin/components/` 清空，
   导致"读 dist"的重放命令一度与归档读数不符；复跑清洁构建（`raw/23`）后逐行一致。登记为通用坑：读构建副产物的命令隔时重放必须先复跑构建。
5. **量具失误四条（全部就地更正，未拿来当结论）**：
   ① `execSync` 在 Windows 走 cmd.exe ⇒ `git rev-parse m^1` 被吃成 `57ccbfe91`、`... ; echo $?` 变 fatal ⇒ 改 `git log -1 --format=%P` 与 try/catch；
   ② `rg` 三坑：`-F` 是布尔标志（多模式用 `-F -e A -e B`）、不能跨行匹配（多行 needle 的 `EXIT=2` 是工具错不是"零命中"）、CJK 路径被 C-引号（改用 `-z`＋NUL 分隔，代码文件数才从误报 93 纠正为 42）；
   ③ 首轮反测用 `sha` 模式不带 `--file` ⇒ 空串对空串造出 `BYTE_IDENTICAL=true` 的假恒等 ⇒ 已加"必须 64 位十六进制"硬门；
   ④ `git show --name-only <merge>` 是 combined diff（相对两个父都不同），曾被误读成"本卡手工改写过 crypto.ts/home.vue/products.vue" ⇒ 已更正为"git 自动合并、手工改写只有基线件"（`raw/50` §9→§10）。
   另有 3 条静态检查的"选择器猜错"就地标为读数失误（`raw/20` 内注），未改判据。
6. **补测动过工作树 HEAD（一次性、已复原）**：为补齐 M1 的当场实测，在本树内 `git checkout --detach 18cb89b0` 跑 `npm run test` 后切回分支；
   跑前后 `HEAD`、分支名、`git status --porcelain`（除证据目录 0 行）与基线值 15/303 全部复核原样（`raw/72`）。未改分支 ref、未 rebase、未 squash、未写源码。
7. **tests 基线方向**：终值 15/303 与基线同值（`test-gate.mjs` 的"只准升"口径下本次不是"高于基线"）；若后续再有卡加用例，需同步调高 `gates-baseline.json.tests`。
8. 证据树内 `tools/` 的装置路径写死本机工作树绝对路径；跨机复跑需就地改常量（`README.md` §3 已注）。本卡未把任何装置接进门禁（无权改门禁组成）。
