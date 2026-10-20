# ACTIVE-回执-QODER-10F1 · 横幅 × 的 lint 基线返工

> 执行人：**Qoder（移动端）**｜回执日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-10F1-lint-closeout.md`｜回传卡：`docs/tasks/cards/R101-QODER-10F1-回传.md`（十项齐）
> 分支 `fix/qoder-10f1-lint-closeout`｜基线：**`9fd90257`**（任务书指定）
> ⚠️ 未 push、未开 PR、未 `git add -A`；只动了本工作树与本分支。

## 状态：**已交付 · 判据自评全过 · 等凌舟验收/合并**

## 干了什么

QODER-10 的 ① 件在 `functions.vue:21` / `more-functions.vue:14` 各加一行 ×，两行的前导缩进（6 空格）不合 eslint `vue/html-indent` 期望（该层级 12 空格），新增 2 条告警 ⇒ PR #368 `build-and-test` 红（12299→12301）。本单**只改这 2 行的前导空白**，× 功能、模板串、class、`@tap` 一字未动，`gates-baseline.json` 一字节未改。

## 判据自评

- **lint**：EXIT=0；error 20（基线 20）不升、warning 12872（基线 12872）不超、全仓逐规则复核 **vue/html-indent = 12299 = 基线**（`raw/01`、`raw/02`）。
- **test**：EXIT=0，5 文件 / 56 用例全过（含 × 挂载点断言与「仅本次会话」四步装置）（`raw/03`）。
- **type-check**：EXIT=0，vue-tsc 当前 0 条 / 基线 0 条（`raw/04`）。
- **功能保留**：两页 `.*-banner-close` 仍在、单击仍只调 `menuStore.dismissBanner()`，`stores/menu.ts:160-162` 仅置内存 ref，无持久存储写（判据 4）。
- **反测闭环**：`:21` 注 14 空格 ⇒ 门红 `RED_EXIT=1` 点名「vue/html-indent: 当前 12300 条 > 基线 12299 条」+ eslint 位置点名「21:1 Expected 12 / found 14」⇒ `cp` 复原 SHA256 `ea8a45c8…` 与注入前逐字节一致（两轮各验）⇒ 复跑 `GREEN_EXIT=0`（`anti/00~05`）。
- **面**：`git diff 9fd90257..HEAD -- backend/` = 0；`--ignore-all-space` 对 `app-mobile/src` = 0（纯空白改动）；`gates-baseline.json` 改动文件数 = 0（`raw/05`）。

## 须凌舟知悉（卡 §五）

1. 修前全仓 12301 系**反推**（本地只测两页 delta −1×2 与修后全仓 12299）；如需在 `9fd90257` 直测全仓，请回派一次性读数单。
2. 另一条修法「把 × 并入重试行」被弃（会让两元素挤一行）；本单代价是 × 行比兄弟行多 6 空格、视觉不齐。两页整体缩进治理须先重登记基线，属**另单**，本单红线禁止。
3. lint 门对 warning 只做规则级计数比较，行/文件级点名由 eslint 原始输出补证。

## 自我报备

本单成因是我 QODER-10 交付漏跑 `lint`（任务书 §三未点名，但门既然存在就应跑齐）。已把「app-mobile 出厂必跑 `check:gates` 四道门」记入长期口径。

```
===DSH-RECEIPT-BEGIN===
id: QODER-10F1
status: DONE
summary: × 关闭按钮两行的前导缩进对齐 eslint vue/html-indent 期望值（6→12 空格），warning 基线由 12301 回落 12299、总数 12872 不超冻结值，lint/test/type-check 三门 EXIT=0（error 20 不升、5 文件 56 用例、类型 0=0），× 功能与 dismissBanner 接线零撤销，gates-baseline.json 与 backend 零改动；反测「注入 14 空格⇒门红点名 12300>12299 且 eslint 点名 21:1⇒cp 复原 SHA256 ea8a45c8 逐字节一致⇒复跑绿」闭环。
worktree: D:\Users\ZXQL\wt-agents\QODER-10F1
branch: fix/qoder-10f1-lint-closeout
commits: ef5c705d(impl, 2 文件 2+/2-)；docs 笔=本卡+回执+证据（git log 9fd90257..HEAD 第 2 笔，写卡时自身哈希不可知）
evidence: docs/evidence/qoder-10f1/README.md,docs/evidence/qoder-10f1/raw/00-two-files-before.json,docs/evidence/qoder-10f1/raw/01-lint-after-fix.txt,docs/evidence/qoder-10f1/raw/02-rule-count-after-fix.txt,docs/evidence/qoder-10f1/raw/03-test-gate.txt,docs/evidence/qoder-10f1/raw/04-type-check.txt,docs/evidence/qoder-10f1/raw/05-scope-and-diff.txt,docs/evidence/qoder-10f1/raw/06-two-files-after-fix.json,docs/evidence/qoder-10f1/anti/00-pre-sha256.txt,docs/evidence/qoder-10f1/anti/01-inject-red.txt,docs/evidence/qoder-10f1/anti/02-restore-sha256.txt,docs/evidence/qoder-10f1/anti/03-restore-green.txt,docs/evidence/qoder-10f1/anti/04-inject-position-eslint.txt,docs/evidence/qoder-10f1/anti/05-restore-sha256-again.txt,docs/evidence/qoder-10f1/anti/functions.vue.orig
return_card: docs/tasks/cards/R101-QODER-10F1-回传.md
gates: npm --workspace app-mobile run lint=>EXIT=0(error 20=20, warning 12872=12872, vue/html-indent 12299=12299); npm --workspace app-mobile run test=>EXIT=0(5 files/56 tests passed); npm --workspace app-mobile run type-check=>EXIT=0(0=0); 反测注入=>EXIT=1 点名 vue/html-indent 12300>12299; cp 复原 SHA256 一致=>EXIT=0; git diff 9fd90257..HEAD -- backend/=>0 行; git diff --ignore-all-space 9fd90257 ef5c705d -- app-mobile/src=>0 行
redlines: 遵守（未 push / 未开 PR / 未 git add -A，逐文件 add；只动 functions.vue、more-functions.vue 与本单证据卡片；未上调 gates-baseline lint warning 基线；未撤销 × 功能；未触碰 backend/ 与其它工作树）
===DSH-RECEIPT-END===
```
