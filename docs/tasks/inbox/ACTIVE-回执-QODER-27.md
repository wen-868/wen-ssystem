# ACTIVE-回执 · QODER-27（四树 tests 基线收敛与联合集成）

> 对应派单：**QODER-27**（卡：`docs/tasks/inbox/QODER-27-f1-baseline-convergence.md`）
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-27`｜分支：`chore/qoder-27-f1-baseline-convergence`｜基座：main `7dda80b8`（merge-base `21b465e5`）
> 完整回传：`docs/tasks/cards/R101-QODER-27-回传.md`｜证据树：`docs/evidence/qoder-27/README.md`
> **执行方自评，不含验收方判词。**

```
【汇报 QODER-27】QODER-27 四树基线收敛与联合集成
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-22
一句话：四笔真 merge 按固定序落地（18cb89b0 ←71b248c8、57ccbfe9 ←dd44e321、8835d11c ←317e421d、167979aa ←1b6da083），
冲突面只在 app-mobile/scripts/gates-baseline.json；tests 段收敛到 15 文件 / 303 用例（四步全部当场实测，非预测），
note 9460 字符逐段保全四树来源＋本单台账（机检：foundAt 递增、occurrences=1、只追加）；
四门在代码 tip 与交付 HEAD 上三次亲跑同值、末笔 `DELIVERED_HEAD_GATES_EXIT=0`（type 0／error 0·warning 12872／15·303／差集 1 豁免 1），三端构建各 EXIT=0，
MP 保留名警告 0 且有可证伪正对照；反测 4 必做＋1 加测全红点名、cp 复原 SHA 恒等后绿；
未 push、未开 PR、逐文件 add。
唯一字面未成立判据：git diff main..HEAD -- backend/ = +21 行，100% 继承自四树共同基线 bc1087ee（bc1087ee..HEAD 为 0 文件，
本卡 authored 0 行）⇒ 口径请裁。MP/App 真机底栏运行态仍未验（卡 §四 保留给运行态卡）。
```

## 待裁三件（都在回传卡 §三/§五 有出处）

| # | 事项 | 执行方口径 | 出处 |
|---|---|---|---|
| 1 | `git diff <main>..HEAD -- backend/` 字面不为 0 | 按 authored 判为通过（0 行）、按字面判为未通过；不自行改判据 | `raw/71` §3、`raw/30` |
| 2 | **main 落后于 `bc1087ee`** ⇒ 合并带入 QODER-19~22 线，且 lint 基线 `errorBaseline` 由 20 收紧为 0（非 tests 段哈希四步未变，本卡手工 0 改动） | 若要求"只带四张卡"的收敛，需另开口径 | `raw/71` §1~§2、§4 |
| 3 | MP/App 真机底栏未验（`tabBar.custom=true` 而产物不产出原生 `custom-tab-bar/` 目录） | 按红线保留给运行态卡，本单不自行处置；QODER-28 因无设备仍 BLOCKED | `raw/22:29-30,47` |

## 收尾自检（文档笔之后实测，出处 `raw/73-close-state.log` ＋ `raw/74-final-gates-at-delivered-head.log`）

- 文档共**三笔**提交，全部只落 `docs/`：`ef9fcd50`（回传卡＋回执＋证据树 63 件）→ `3924cd04`（`raw/73` 收尾态＋引用行号校准）→ 第三笔（交付 HEAD 上的门复跑 `raw/74` ×2）。
  每笔都用 NUL 口径复算过非 docs 文件数＝0（`git diff --name-only -z <prev>..HEAD` ⇒ 非 `docs/` 0 个）。
- 门与构建读数覆盖到**交付 HEAD**：第三笔文档提交前在 `3924cd04` 上又亲跑一次 `npm run check:gates` ⇒ `DELIVERED_HEAD_GATES_EXIT=0`，读数与代码 tip 两次同值（`raw/74`）。代码面恒等证明：`git diff --name-only -z 167979aa..HEAD` ⇒ 66 文件、**非 docs 0 个**，`app-mobile/`＋`backend/` 一字未差，基线终值仍 15／303／note 9460。
- `git status --porcelain` ⇒ **0 行**（含未跟踪面，`raw/73:6` 于 `ef9fcd50` 后实测；第二笔提交后再测仍 0，口径见 `raw/73:55-61` 的自指登记）⇒ 卡 §三「工作树 clean」在文档笔之后成立。
- 红线：`@{u}` 报 `no upstream configured`、`refs/remotes` 下无本支、`origin/main` 指针未前进 ⇒ **未 push**；本会话未调用任何 `git push`／`gh pr` ⇒ **未开 PR**；`git add` 全部走显式路径清单（`git ls-files --others -z | xargs -0 -n1 git add --`）⇒ **未用 `-A`**。
  ⚠ 如实登记：想做的在线复核 `git ls-remote` 因网络 `Connection was reset` 未成 ⇒ 远端实况本时点无法在线证伪，待有网时由有权限方复核。
- 证据树件数：`ef9fcd50` 后 63 件 → `3924cd04` 后 64 件 → 第三笔（`raw/74` 原文＋摘要）后 **66 件**＝README ＋ `raw/` 35 ＋ `raw/anti/` 15 ＋ `tools/` 15；`README.md` §2 已同步。
- 未 push 的零值可证伪复核（本笔补测）：`git for-each-ref refs/remotes` ⇒ **143 条在册**（非空 ⇒ 不是假 0），其中含 `qoder-27` 的 ⇒ **0 条**；四个来源 tip 也不在任何 `refs/remotes` ⇒ 本支与四 tip 均为本地态。`main`＝`7dda80b8`、`origin/main`＝`14924d62`（`ahead 6 / behind 0`，本单未动远端）。

## DSH-RECEIPT

> 同 S3-236 那笔的固有约束：**本区块所在的那笔提交无法在自身内容里引用自身 sha**，其 sha 以 `git log --oneline -1` 为准；
> 故 `commits` 末项写作 `DOCS-3(本笔)`，且区块落盘后的 `git status --porcelain = 0 行` 读数由执行方在本会话收尾时亲跑并随消息回传。

```
===DSH-RECEIPT-BEGIN===
id: QODER-27
status: DONE
summary: 四树 tests 基线收敛完成 —— 按固定序落四笔真 merge（不 rebase 不 squash，逐笔两父实测），冲突面只在 app-mobile/scripts/gates-baseline.json；tests 段收敛到 15 文件 / 303 用例且四步全部当场 vitest 实测（11/191→12/232→14/248→15/303），note 9460 字符＝bc1087ee 原文 2941 前缀＋四段来源（2454/700/1804/971）＋本单台账 590，机检逐段 foundAt 递增、occurrences=1、verbatim；交付 HEAD 上亲跑 check:gates EXIT=0（type 0／error 0·warning 12872／15·303／差集 1 具名豁免 1），三端构建各 EXIT=0，MP 保留名警告 0（正对照可出 2/1 并令构建 EXIT=1）；反测 4 必做＋1 加测全部先红且点名、cp 复原后 SHA 逐字节恒等再绿。⚠ 待裁：`git diff main..HEAD -- backend/` 字面 +21 行（100% 继承自 bc1087ee、本卡 authored 0）；main 落后于四树共同基线 ⇒ 合并面不止四张卡；MP/App 真机底栏运行态未验（QODER-28 无设备仍 BLOCKED）。
worktree: D:\Users\ZXQL\wt-agents\QODER-27
branch: chore/qoder-27-f1-baseline-convergence
commits: 18cb89b0,57ccbfe9,8835d11c,167979aa,ef9fcd50,3924cd04,DOCS-3(本笔)
evidence: docs/evidence/qoder-27/README.md,docs/evidence/qoder-27/raw/74-final-gates-at-delivered-head.raw.log,docs/evidence/qoder-27/raw/70-final-gates-recheck.raw.log,docs/evidence/qoder-27/raw/21-gates-full.raw.log,docs/evidence/qoder-27/raw/22-build-mp-weixin.raw.log,docs/evidence/qoder-27/raw/23-rebuild-mp-weixin.raw.log,docs/evidence/qoder-27/raw/14-m4-merge-26.log,docs/evidence/qoder-27/raw/71-main-lag-and-nontests-attribution.log,docs/evidence/qoder-27/raw/72-m1-measure.raw.log,docs/evidence/qoder-27/raw/73-close-state.log,docs/evidence/qoder-27/raw/40-anti-test-ledger.log,docs/evidence/qoder-27/raw/anti/,docs/evidence/qoder-27/tools/
return_card: docs/tasks/cards/R101-QODER-27-回传.md
gates: cd app-mobile && npm run check:gates（交付 HEAD 3924cd04 亲跑）=>DELIVERED_HEAD_GATES_EXIT=0, type 0=0, lint error 0=0 / warning 12872=12872, Test Files 15 passed (15) / Tests 303 passed (303), 差集 1 条·具名豁免 1 条; npm run build:h5|build:mp-weixin|build:app=>各 BUILD_EXIT=0; MP 日志 grep 'custom-tab-bar' 与 '专用组件|已内置|保留名'=>0 与 0（正对照 R-TAB-B 出 2/1 且 BUILD_EXIT_mp-weixin=1）; 反测 R-IV/R-TAB/R-REACT/R-SKU(+R-TAB-B)=>每轮 RED=1 且点名、cp 复原 SHA256 恒等、残字 0、GREEN=0; git diff --numstat 7dda80b8..HEAD -- backend/=>21 0（bc1087ee..HEAD=>0 文件）; git status --porcelain=>0 行
redlines: 遵守（未 push／未开 PR／`git add` 全走显式路径未用 `-A`；只动本卡范围，非 docs 改动 0 文件；四段来源 note 未被覆盖成一段；未删除或跳过任何卡测试；证据目录未与他卡合并；MP/App 真机项未自行处置；未重写历史——四笔 merge 与三笔文档提交均为新增提交）
===DSH-RECEIPT-END===
```
