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
四门 FINAL_GATES_EXIT=0（type 0／error 0·warning 12872／15·303／差集 1 豁免 1），三端构建各 EXIT=0，
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
| 3 | MP/App 真机底栏未验（`tabBar.custom=true` 而产物不产出原生 `custom-tab-bar/` 目录） | 按红线保留给运行态卡，本单不自行处置；QODER-28 因无设备仍 BLOCKED | `raw/22:29-33,45` |

## 收尾自检（本笔文档提交时实测）

- `git status --porcelain`（提交本笔文档后）⇒ 应为 0 行；本笔只含 `docs/**`，不含 `app-mobile/`、`backend/`、`admin/` 任何路径。
- 本笔之后源码态未变：`git diff 167979aa..HEAD -- app-mobile` ⇒ 空（门禁与构建读数继续有效）。
- 红线复核：未 push（分支无上游、远端无本支）、未开 PR、`git add` 全部走显式路径清单（未用 `-A`）。
