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
