# ACTIVE 回执 · QODER-21 —— app-mobile lint error 20→0

> 汇报对象：凌舟｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-21
> 完整十项回传：`docs/tasks/cards/R101-QODER-21-回传.md`｜证据树：`docs/evidence/qoder-21/**`
> 本回执只写执行方自评与卡片目标读数对照，不含凌舟裁定/验收结论类判词。

## 人读摘要

`gates-baseline.json` 的 `lint.errorsByFileRule` 所列 **13 个 文件::规则 对 / 20 条 error 已全部清零**，没有升基线、没有关规则、没有整文件 disable、没有删测试，也没有吞异常或删业务分支。

- **9 条 `no-extra-semi`**：删语句起始处的空语句分号。先用探针脚本确认本仓 `no-extra-semi` 具备 ASI 感知（同文件里 792/909 两处**载荷型**行首分号未被报、保持原样），被报的 9 条逐条给出前一句收尾形态（函数声明块／`if` 块／`try {`／函数体首条）。
- **6 条 `no-unreachable`**：逐条读上下文后判定**全部**是 uni-app `#ifdef` 并列分支被上一段无条件 `return` 遮蔽的真实逻辑（`product-detail.vue` 改前注释本身就写着这些 return 是为躲 rollup 告警）。**0 条删除业务分支**：`settings.vue` 的 `apiBase` 与 `ai-chat.vue` 的 `started` 由「IIFE 双 return」改为「默认值＋按端覆盖」；`product-detail.vue` 的 `openScanner` 与 `create-sale.vue` 的 `handleShare` 引入三端互斥标志（`scanned`／`handled`）跳过后续分支。逐端编译产物与改前等价。
- **3 条 `no-empty`**（`ai-chat.vue` ×2、`create-sale.vue` ×1）：不再静默吞异常，改为 `uni.showToast` 把后果显式告诉用户（保存失败／读取失败回落新会话／`?doc=` 解析失败回落默认单据），`ai-chat` 持久化路径另加 `persistWarned` 去重防刷屏。刻意**不用** `console.*`（`no-console` 基线 225 只准降不准升），也刻意**不新增**只写不读的状态位（`@typescript-eslint/no-unused-vars` 基线 104 同理）。
- **1 条 `no-irregular-whitespace`**：分享文案模板里数量与金额之间的 U+3000 字面量改为等价 unicode 转义写法，**运行期字符串逐字节不变**（没有把全角空格降级成普通空格，避免改动用户可见排版）。
- **1 条 `vue/no-unused-vars`**：底部按钮组 `v-for="(act, i) in visibleActions"` 收回 `v-for="act in visibleActions"`，`:key`／`:class`／`@tap`／子节点一字未动。
- 基线：仅动 `lint` 段的 `errorBaseline 20→0`、`errorsByFileRule` 清空（13 对→0）、`mustReachZero` 保持 `true`、`note` 记录 20→0 与逐条处置；`tests`/`typeCheck`/`checkContract`/`contractDrift` 四段未动，`lint.dueBatch` 作为历史留痕未改。

## 判据自评

| 判据（卡 §三） | 目标 | 实测 | 自评 |
| --- | --- | --- | --- |
| `npm run lint` | EXIT=0 且 error=0 | **EXIT=0**，`当前 error 0（基线 0）、warning 12872（基线 12872）` | 达标 |
| warning | ≤12872 | **12872**，六规则逐项等于基线（12299／225／196／104／47／1） | 达标（未升也未降，见回传卡 §⑤.4） |
| `npm run test` | 5 文件 / 56 用例不回归 | **EXIT=0**，5 passed / 56 passed | 达标 |
| `npm run type-check` | 0 = 0 | **EXIT=0**，vue-tsc 当前 0 条／基线 0 条 | 达标 |
| `npm run check:contract` | EXIT=0 | **EXIT=0**，差集 1 条／具名豁免 1 条 | 达标 |
| `npm run build:h5` | EXIT=0 | **EXIT=0**，`DONE Build complete.` | 达标 |
| 反测 | 回填 error ⇒ 红并点名 ⇒ 复原 SHA 同形态一致 ⇒ 绿 | 两组均：`LINT_EXIT=1` 且点名 `src/api/storage.ts:208:1 no-extra-semi`／`src/pages-sub/settings/settings.vue:186:3 no-unreachable`；`SHA_IDENTICAL=YES`；复跑 `LINT_EXIT=0` | 达标 |
| 提交后 `git status` | clean | `git status --porcelain` 空输出 | 达标 |

红线对照逐条自查见回传卡 §⑥（未 push、未开 PR、逐文件 add、未改 `.eslintrc.cjs` 与 `scripts/lint-gate.mjs`、未借入/删除 harness、未 `commit --amend`/rebase/reset、未写凌舟判词）。

## 未验清单（如实，不许当通过）

1. **真机全未验**：iOS／Android／微信开发者工具／小程序后台均未跑。6 处 `no-unreachable` 的「逐端产物等价」是**源码控制流推演 + 条件编译剥离规则 + H5 构建通过**，不是各端运行期读数；App 端 `plus.speech`／`plus.share`、小程序端 `uni.scanCode`、H5 端 `BarcodeDetector` 行为均未观测。
2. **H5 浏览器未起**：`build:h5` 只证明可构建；本轮唯一新增的用户可见行为是三条 `uni.showToast`（仅在存储读写异常／`getCurrentPages` 异常路径触发），**未构造异常路径实测弹出效果**。复现需要给 `uni.setStorageSync`／`uni.getStorageSync`／`getCurrentPages` 打桩使其抛错。
3. **App／mp 产物未生成**：只跑了 H5 构建，因此逐端产物级 diff 没有做。
4. **`persistWarned` 去重语义未做多次进出页面观测**（页面实例级 `let`，结论来自作用域推演）。
5. **未跑 `npm run check:gates`**（四门已分别单独跑并留日志，串行包装器未跑）。
6. **warning 存量（12872）一条未清**，不属本卡范围；`vue/html-indent` 12299 仍在基线冻结位。

===DSH-RECEIPT-BEGIN===
id: QODER-21
status: 执行方自评为「卡片判据全部达标，主干闭环完成」；未 push、未开 PR，待凌舟验收
summary: app-mobile lint error 20→0（13 个 文件::规则 对全部清）。9 条 no-extra-semi 删载荷型核验后的行首空语句分号；6 条 no-unreachable 判定为 uni-app 条件编译并列分支被提前 return 遮蔽的真实逻辑，零删除，改走「默认值＋按端覆盖」（settings/ai-chat）与三端互斥标志 scanned/handled（product-detail openScanner、create-sale handleShare）；3 条 no-empty 改为 uni.showToast 显式告知后果（ai-chat 另加 persistWarned 去重）；1 条 no-irregular-whitespace 用 U+3000 等价 unicode 转义保持文案逐字节不变；1 条 vue/no-unused-vars 收回 v-for 未用索引别名。gates-baseline.json 仅动 lint 段：errorBaseline 20→0、errorsByFileRule 清空、mustReachZero 保持 true、note 记录 20→0 与逐条处置。
worktree: D:\Users\ZXQL\wt-agents\QODER-21
branch: chore/qoder-21-lint-errors-zero
commits: 5bbd4324 fix: app-mobile lint error 20 条清零（QODER-21）；第二笔 docs: 为本卡证据树 + R101 回传卡 + 本回执（哈希见 git log --oneline origin/main..HEAD）
gates: lint EXIT=0（error 0 / 基线 0，warning 12872 / 基线 12872，六规则逐项相等）；type-check EXIT=0（0=0）；test EXIT=0（5 文件 / 56 用例）；check:contract EXIT=0（差集 1 条 / 具名豁免 1 条）；build:h5 EXIT=0（DONE Build complete.）；反测 2 组：注入 ⇒ lint EXIT=1 并点名 文件:行:列+规则 ⇒ scratch 备份 cp 复原 ⇒ SHA_IDENTICAL=YES（工作树 CRLF 同形态） ⇒ 复跑 EXIT=0
redlines: 未 push、未开 PR、未 git add -A（逐文件 add）；未升基线（只 20→0）、未关/放宽规则、未改 .eslintrc.cjs 与 scripts/lint-gate.mjs 判据、未加文件级 eslint-disable、未删改测试；未吞异常（3 条 no-empty 均给可观察后果）；未删业务分支（6 条 no-unreachable 全部控制流修正）；未用 sed -i、未 amend、未 rebase/reset；未借入或删除任何 harness；只动 QODER-21 工作树与 _scratch/qoder-21
evidence: docs/evidence/qoder-21/README.md + raw/00…raw/09（改前 20 条清单、四门与 build 原始输出、逐规则 warning、SHA 与 status） + anti/1-anti-storage.ts-no-extra-semi.txt + anti/2-anti-settings.vue-no-unreachable.txt
return_card: docs/tasks/cards/R101-QODER-21-回传.md
===DSH-RECEIPT-END===
