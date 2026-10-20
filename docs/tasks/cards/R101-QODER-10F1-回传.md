# R101-QODER-10F1-回传 · 横幅 × 的 lint 基线返工

> 派单人：凌舟｜执行：**Qoder（移动端）**｜回传日期：2026-10-20
> 任务书：`docs/tasks/inbox/QODER-10F1-lint-closeout.md`
> 分支 `fix/qoder-10f1-lint-closeout`｜基线：**`9fd90257`**（任务书指定，= QODER-10 链尖端合并态）
> ⚠️ 未 push、未开 PR、未 `git add -A`（逐文件 add）；本卡不含任何「凌舟裁定/验收结论」，所有判据读数均为**自评**。

## 〇、基线与提交

- 工作树 `D:\Users\ZXQL\wt-agents\QODER-10F1`（`git worktree add -b fix/qoder-10f1-lint-closeout … 9fd90257`），node_modules junction ×3（root / app-mobile / backend）指向主仓，主仓工作树未被写入。
- 实现提交 **`ef5c705d`**（2 文件、2 insertions / 2 deletions，纯空白改动）；本卡 + 回执 + `docs/evidence/qoder-10f1/**` 为第二笔提交。
- 基线态核对：`9fd90257` 的两页 × 行确实各带 1 条 `vue/html-indent` 告警（`raw/00`：× 行报「Expected 12 / found 6」），与 PR #368 的 12299→12301 现象同源。

## 一、修法 × 读数总表

| 项 | 动作 | 位置 | 读数 |
|---|---|---|---|
| 缩进对齐 | × 行前导空白由 **6 空格 → 12 空格**（eslint `vue/html-indent` 在该层级的期望值），其余字符逐字节不变 | `functions.vue:21`、`more-functions.vue:14` | 两页 html-indent **72→71 / 62→61**（合计 134→132，`raw/00` vs `raw/06`）；全仓 **warning 12872=12872、vue/html-indent 12299=12299**（`raw/01`、`raw/02`） |
| × 功能保留 | 模板串、`class`、`@tap` 全部原样，未撤销 QODER-10 的 ① 件 | 同上两行 + 两页 `.*-banner-close` SCSS（`:258` / `:226`） | test 门 56 用例含「两页挂载点静态断言」与「× 关闭仅本次会话」四步装置，全过（`raw/03`） |
| 基线冻结 | **未动 `app-mobile/scripts/gates-baseline.json` 一字节** | — | `git diff --name-only 9fd90257..HEAD -- app-mobile/scripts/gates-baseline.json` = **0 行**（`raw/05`） |

## 二、判据自评（任务书 §三逐条，原始输出落盘）

1. `npm --workspace app-mobile run lint` ⇒ **EXIT=0**；`当前 error 20（基线 20）、warning 12872（基线 12872）`；全仓逐规则复核 **vue/html-indent = 12299 ≤ 12299**，且「所有规则 warning ≤ 基线」⇒ `raw/01`、`raw/02`。
2. `npm --workspace app-mobile run test` ⇒ **EXIT=0**，**Test Files 5 passed (5) / Tests 56 passed (56)**，与基线 5/56 齐平不劣化 ⇒ `raw/03`。
3. `npm --workspace app-mobile run type-check` ⇒ **EXIT=0**，`vue-tsc EXIT=0，当前错误 0 条，基线 0 条`（0=0）⇒ `raw/04`。
4. 两页 `.*-banner-close` 仍在（`functions.vue:21` / `more-functions.vue:14`），单击仍只调 `menuStore.dismissBanner()`；store 侧 `stores/menu.ts:160-162` 只置内存 ref `noticeDismissed`，**无任何 `setStorageSync` 写入** ⇒ 判据 4 三条全中。
5. 反测见 §四，门必须能红已验实。
6. `git diff 9fd90257..HEAD -- backend/` = **0 行**；`git diff --ignore-all-space 9fd90257 ef5c705d -- app-mobile/src` = **0 行**（⇒ 本单改动纯属空白，不可能引入行为差异）⇒ `raw/05`。

## 三、逐行改动明细（全量，共 2 行）

```diff
-      <text class="func-banner-close" @tap="menuStore.dismissBanner()">×</text>
+            <text class="func-banner-close" @tap="menuStore.dismissBanner()">×</text>
-      <text class="mf-banner-close" @tap="menuStore.dismissBanner()">×</text>
+            <text class="mf-banner-close" @tap="menuStore.dismissBanner()">×</text>
```

为什么是 12 空格：两页横幅容器都写成多属性换行的 `<view … >` 开标签，eslint 对该容器子节点的期望缩进即 **12**；兄弟行 `*-banner-text` / `*-banner-retry` 停在 6 空格，属存量基线告警（各自已计入 12299），本单不动它们（任务书「只修 × 引发的两条」）。

## 四、反测（门必须能红）——`anti/` 七件套

注入：`functions.vue:21` 前导 12 → **14 空格**（单条 bash 原子命令完成「注入 ⇒ 跑红 ⇒ `cp` 复原 ⇒ SHA256 比对 ⇒ 复跑绿」，不留脏态）。

- 红：`LINT_EXIT=1`，门点名 `✗ warning 劣化（规则计数超冻结基线）：vue/html-indent: 当前 12300 条 > 基线 12299 条`（`anti/01`）。
- 位置级点名（门只按规则计数，故补 eslint 原始输出）：`21:1 warning Expected indentation of 12 spaces but found 14 spaces vue/html-indent`（`anti/04`）。
- 复原：`cp anti/functions.vue.orig` ⇒ SHA256 `ea8a45c855ab966576ba3c9c3af56509f5e892841c8b0070b5d5904ef2959861` 与注入前**逐字节一致**，两轮循环各复验一次（`anti/00` vs `anti/02`、`anti/05`）。
- 绿：复跑 lint 门 `GREEN_EXIT=0`（`anti/03`）。

复原一律用 `cp`，不用 `sed -i`（QODER-9 曾因此把 CRLF 归一成 LF，SHA256 假阴）。

## 五、口径偏差报备（任务书文字 vs 仓库事实，均按事实执行）

1. **「12299 → 12301」的基线态读数非本地直测**：本地只测了两页（修前 134 / 修后 132，逐文件 delta = −1 ×2）与修后全仓（12299）。由「本单只改这 2 行、每行恰好消 1 条告警」反推基线全仓 = 12301，与 PR #368 报数一致；未另开一个 `9fd90257` 工作树跑全量 lint 复核（可复现命令：`git worktree add --detach … 9fd90257` + `node node_modules/eslint/bin/eslint.js src --ext .ts,.vue -f json`），如需该读数请回派。
2. **修法与「调整缩进」的字面最小歧义**：另一条路是把 × 并入 `*-banner-retry` 行（不新增行 ⇒ 也不新增告警），但会让两个元素挤在一行、且 test 门断言的挂载点串分列在两行更清晰；本单选「对齐 eslint 期望值」，代价是 × 行比兄弟行多 6 空格、视觉上不齐。若凌舟更在意观感，可另派「两页模板整体缩进整饰」单（那会一次性重排 133 行存量告警，须先重登记基线，不能与本单混做）。
3. **门「点名」粒度**：`lint-gate.mjs` 对 warning 只做**规则级计数**比较（设计文档明示「同文件同规则行号漂移不算劣化」），所以红讯只点名规则与条数；文件/行级点名由 eslint 原始输出补证（`anti/04`），非门的原生能力。
4. `error 20` 仍为存量冻结值，本单未触碰任何 error；清零仍待凌舟下一批卡。

## 六、红线对照

- 未 push、未开 PR、未 `git add -A`（逐文件 add：先 2 个 `.vue`，再证据/卡片）。
- 只动本工作树 `QODER-10F1` 与本分支；主仓工作树与其它工作树未受扰（node_modules 走 junction，未安装/未改依赖）。
- 改动面 = 任务书白名单：`functions.vue`、`more-functions.vue` + 本单证据与回传卡；`gates-baseline.json` **0 改动**（未上调 lint warning 基线）；`backend/` **0 改动**。
- QODER-10 的 × 功能未撤销，行为零改动。

## 七、未完成与阻塞

- H5 浏览器 / 真机 UI 复验**未做**：本单为纯空白改动（`--ignore-all-space` 空 diff 自证），不产生任何渲染或行为差异，× 的可见性与点击语义已由 test 门 56 用例常驻锁定；若验收要求实开截图，请另派（无阻塞）。
- 无待澄清项，无外部依赖。

## 八、风险与自我报备

- **本单的成因是我 QODER-10 的漏项**：交付时只跑了 `test` / `type-check` / backend 守卫，未跑 `lint`，导致 PR #368 `build-and-test` 红。教训已落口径：后续任何 app-mobile 出厂单，四道门（`check:gates` = type-check + lint + test + check:contract）一律跑齐再提交，不因任务书未点名就跳过。
- 残留风险：html-indent 存量 12299 条告警仍在，× 行只是不再新增；两页整体缩进仍未治理，未来任何人在这两块新增行都可能再触发同类劣化（建议后续以「lint error/warning 清零卡」统一处理）。

## 九、交付物与证据清单

- 代码：`app-mobile/src/pages/functions/functions.vue`、`app-mobile/src/pages-sub/admin/more/more-functions.vue`（各 1 行缩进）。
- 卡片：`docs/tasks/cards/R101-QODER-10F1-回传.md`（本文件）、`docs/tasks/inbox/ACTIVE-回执-QODER-10F1.md`（含 DSH-RECEIPT 区块）。
- 证据：`docs/evidence/qoder-10f1/README.md` + `raw/00~06`（7 件）+ `anti/00~05` 与 `anti/functions.vue.orig`（7 件）。

## 十、一行摘要

两行 × 的前导缩进对齐到 eslint 期望的 12 空格，`vue/html-indent` 由 12301 回到基线 12299、warning 总数 12872 不超冻结值，lint/test/type-check 三门 EXIT=0，基线文件与 backend 零改动，反测「注入 ⇒ 红并点名 ⇒ cp 复原 SHA256 逐字节一致 ⇒ 绿」闭环。
