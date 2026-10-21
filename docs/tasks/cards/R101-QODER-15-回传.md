# R101-QODER-15-回传 · 价格异常页数值入口止血

> 执行方：Qoder（移动端）子代理。所有判据读数均为**自评**，非验收结论。
> 汇报对象：凌舟｜汇报人：Qoder（移动端）｜日期：2026-10-21｜对应派单编号：QODER-15

## 〇 基线与提交

- 基线：`321b4f6b`（= 本地 `origin/main`）。
- 分支：`fix/qoder-15-price-anomaly-numeric`。
- 实现笔：`233cd2fc`（`fix: 价格异常页金额显示接入 fmtAmount 数值归一化工具止血白屏`，5 文件：`utils/format.ts`、`api/modules/price.ts`、`price-anomaly.vue`、`tests/format.spec.ts`、`tests/price-anomaly-static.spec.ts`）。
- docs 笔 = 本卡 + 回执 + `docs/evidence/qoder-15/**`（写卡时不可知，为 `git log` 最新一笔）。

## 一 修法 × 读数总表

| # | 改动 | 文件 | 效果 | 关键自评读数 |
| --- | --- | --- | --- | --- |
| 1 | 新增公共数值格式化工具 | `app-mobile/src/utils/format.ts` | 导出 `toNum`/`fmtAmount`，无效值 `—`、有效 0 `0.00`，兼容字符串/null/undefined/空白/千分位/-0/NaN/Infinity | 新文件自身 eslint 0 问题；见 §三.1 |
| 2 | 价格异常出参四字段改联合类型 | `app-mobile/src/api/modules/price.ts` | `costPrice/retailPrice/storePrice/miniappPrice` → `number \| string \| null` | type-check 0=0 |
| 3 | 页面四处金额显示接入 fmtAmount | `price-anomaly.vue` | 四处裸 `.toFixed(2)` 改 `¥{{ fmtAmount(item.x) }}`；新增 `@/utils/format` 导入 | 静态门 4 处 `fmtAmount(`、0 处 `item.*Price.toFixed` |
| 4 | 单元测试 | `app-mobile/tests/format.spec.ts` | 表驱动 37 用例（7 类点名输入 + 边界） | 全过 |
| 5 | 静态反测门 | `app-mobile/tests/price-anomaly-static.spec.ts` | 读 `.vue` 文本断言 fmtAmount×4、无裸 toFixed，7 用例 | 全过；反测能红见 §四 |

判据总读数（改前→改后，均自评）：type-check **0→0**、lint error **20→20** / warning **12880→12880**（逐规则劣化 **0**）、test 基线 **0 用例**→本单 **2 文件/44 用例全过 EXIT=0**、`build:h5` **EXIT=0**。

## 二 判据自评（任务书逐条 + 原始输出文件号）

任务书 §三验收逐条：

1. 单测覆盖 `12.34 / '12.34' / 0 / null / undefined / '' / NaN` —— **达成（自评）**，`tests/format.spec.ts` 表驱动；证据 `docs/evidence/qoder-15/raw/07-test-post.txt`（44 用例全过）、`raw/10-test-final-green.txt`。
2. 静态反测：重插裸 `.toFixed()` ⇒ 断言红、复原 SHA256 一致 —— **达成（自评）**；证据 `docs/evidence/qoder-15/anti/00..03`（RED_EXIT=1 点名 costPrice → 复原 `7b3d87e7…eba6` 逐字节一致 → GREEN_EXIT=0）。
3. test 不劣化 —— **达成（自评）**：基线无既有用例，本单新增 2 文件/44 用例全过；证据 `raw/06-test-baseline.txt`（No test files found EXIT=0）+ `raw/07-test-post.txt`。
4. type-check 0=0 —— **达成（自评）**：基线 EXIT=0/0 错、修后 EXIT=0/0 错；证据 `raw/01-typecheck-pre.txt`、`raw/02-typecheck-post.txt`。
5. build:h5 EXIT=0 —— **达成（自评）**；证据 `raw/08-build-h5.txt`（DONE Build complete / EXIT=0）。
6. lint 不劣化 —— **达成（自评）**：同 harness 改前/改后全仓逐规则计数，error/warning 逐规则 ≤ 改前；证据 `raw/03-eslint-pre.txt`、`raw/04-eslint-post.txt`、`raw/05-eslint-compare.txt`。
7. 截图或浏览器实开证明不再白屏、null→`—`、0→`0.00` —— **部分达成（自评），见 §七**：真实 Vue SSR 管线 + browser-use 实开 DOM 回读证明 null/undefined→`¥—`、0→`¥0.00`、字符串→`¥12.34`；证据 `browser/render-demo-dom-readback.txt`、`browser/render-demo-a11y-snapshot.txt`、`browser/render-demo-fixed.html`、`raw/render-evidence-stdout.txt`。**未取 PNG、未跑登录态整页 E2E**。

## 三 逐条明细

### 1. `utils/format.ts` 取舍与理由

- `toNum(value): number | null`：`null/undefined`→null；`number` 中 `NaN/±Infinity`→null；`-0`（及 `'-0'`）归一为 `0`（否则 `(-0).toFixed(2)` 显示 `-0.00`）；`string` 先 `trim`（容忍 `' 12.34 '`）再剥千分位逗号（容忍 `'1,234.56'`），空串/纯空白显式返回 null（**关键**：`Number('')===0` 若不拦截会把空值显示成 `0.00`），其余交 `Number()`（覆盖 `'12.34'`、科学计数），结果非有限→null（如 `'abc'`）；boolean/对象/数组一律 null（不做 `Number(true)===1` 隐式假价格）。
- `fmtAmount(value): string`：`toNum` 为 null→`'—'`，否则 `n.toFixed(2)`；有效 0→`'0.00'`。不带货币符号，`¥` 前缀留在模板展示层（`¥{{ fmtAmount(x) }}`）。
- **与既有 `utils/price.ts` 的分工**：`price.ts` 只做**价格可见性/权限判断**（客户类型 → 可见字段），本文件只做**原始数值归一化与显示格式化**，二者互不依赖；本单未改 `price.ts`（超出范围），仅在 `format.ts` 头注释登记此分工。

### 2. `price.ts` 出参

只改 `listAnomalies`（`GET /admin/prices/anomalies`）items 的四字段为 `number | string | null`，未批量改其它接口/字段；`wholesalePrice` 等页面未显示的字段本单未动。全仓仅 `price-anomaly.vue:137` 一处消费 `listAnomalies`（已 grep 确认），改类型无其它调用点破坏。

### 3. `price-anomaly.vue`

- `:59/:64/:69/:73` 四处：`¥{{ item.X.toFixed(2) }}` → `¥{{ fmtAmount(item.X) }}`。
- 新增 `import { fmtAmount } from '@/utils/format'`（置于既有 `import { priceApi }` 之后）。
- 未改页面布局数值、结构、导航、`:class` 绑定、样式块。

## 四 反测（门必须能红）

单条原子命令完成「注入前 SHA256 → 逐字节注入 → 跑静态门取红 → cp 复原 → 复原 SHA256 → 复跑绿」：

- 注入前 `00-pre-sha256.txt`：vue 文件 SHA256 `7b3d87e7875bd9015aa59571ecdad7814c790e6c78df1c2be45655e34ae4eba6`。
- 注入：`inject.mjs`（scratch）用 latin1 逐字节读，替换唯一 ASCII 子串 `fmtAmount(item.costPrice)`→`item.costPrice.toFixed(2)`（命中数≠1 直接 `exit 9`）；`INJECT_DONE hits=1`。
- 红 `01-static-red.txt`：`RED_EXIT=1`，`tests/price-anomaly-static.spec.ts (7 tests | 3 failed)`，点名 **costPrice**：① `fmtAmount( 出现且仅 4 次`（变 3）红；② `页面不再对原始 API 值 costPrice 直接调用 .toFixed()` 红（`price-anomaly-static.spec.ts:32`）；③ `全页不存在任何对 item.*Price 的裸 .toFixed()` 红。其余 4 字段（retail/store/miniapp）仍绿，证明断言按字段精确点名。
- 复原 `02-restore-sha256.txt`：`cp` 回写后 SHA256 `7b3d87e7…eba6`，与注入前**逐字节一致**（未用 `sed -i`，避免 CRLF 归一致使假阴）。
- 复跑绿 `03-static-green.txt`：`GREEN_EXIT=0`，7 用例全过。完整套件复原后复跑 `raw/10-test-final-green.txt`：44 用例全过。

## 五 口径偏差报备（任务书文字 vs 仓库事实）

1. **基线无门禁设施**：`321b4f6b` 的 app-mobile 无 `tests/`、无 `vitest.config.ts`、无 `.eslintrc.cjs`、`package.json` 无 test/lint/type-check 脚本。按协议 §2 从 `9fd90257` 借入 harness 测量，**测毕已删除、未提交、未 `git add`**：
   ```
   git show 9fd90257:app-mobile/vitest.config.ts > app-mobile/vitest.config.ts
   git show 9fd90257:app-mobile/.eslintrc.cjs   > app-mobile/.eslintrc.cjs
   mkdir -p app-mobile/tests
   ```
   各判据实测命令（均在 `<工作树>/app-mobile`，junction 真实入口）：type-check `node ../node_modules/vue-tsc/bin/vue-tsc.js --noEmit`；lint `node ../node_modules/eslint/bin/eslint.js src --ext .ts,.vue [-f json -o <scratch>/x.json]`；test `node ../node_modules/vitest/vitest.mjs run`；build（工作树根）`npm --workspace app-mobile run build:h5`。
2. **type-check「0=0」**：报真实读数——基线 0 错、修后 0 错（非门禁脚本，因基线无 `type-check` 脚本）。
3. **lint「不劣化」**：无 `gates-baseline.json` 冻结件，改用同 harness 改前/改后**全仓逐规则计数对比**（error 20→20、warning 12880→12880、files 190→191 因新增 `format.ts` 自身 0 问题）。`no-console` 为 warn：本单生产代码（`format.ts`/页面改动）未引入任何 `console.*`，故计数不升。
4. **test「不劣化」**：基线既有用例 **0**；报「本单新增 2 文件/44 用例全过」，**不声称对齐链上 56 用例**。
5. **行号漂移**：任务书/派单点名 `.toFixed(2)` 在 `:59/:64/:69/:73`——本工作树复核一致；`price.ts` `listAnomalies` 在 `:135-163`（派单 `:135-161` 附近），四字段在 `:149-152`，一致。
6. **既有 `utils/price.ts`**：派单提示先查看——确认其为价格权限/可见性工具，与本单格式化职责不同，**未改出本单范围**，仅在 `format.ts` 头注释登记分工。

## 六 红线对照

- 未 push、未开 PR、未 `git add -A`；一律逐文件 `git add`（实现笔 5 文件、docs 笔卡片/回执/证据）。
- 只动分配工作树 `QODER-15` 与分支 `fix/qoder-15-price-anomaly-numeric`；主仓与其它 `wt-agents/*` 只读；未动 `wen-ssystem/docs/tasks/inbox/*` 任务书原件。
- 未 `npm install/uninstall`、未改任何 `package.json` 依赖、未动 appid/支付/推送/插件配置、未动后端。
- 借入 harness（`vitest.config.ts`/`.eslintrc.cjs`）测毕删除、未提交；`dist/` 与 scratch 不入库。
- 提交 ≤3 笔（实现 1 笔 + docs 1 笔）；格式 `type: 中文描述`。
- 未批量改其它页面/其它接口；同类问题仅登记 §七。

## 七 未完成与阻塞

1. **PNG 截图未取得**：in-app browser viewport 为 hidden，`take_screenshot` 报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`（可见面板未开）。改以 browser-use `evaluate_script` 回读真实浏览器 DOM + `take_snapshot` a11y 树为浏览器级实证。**复现命令**：起静态服务后 `mcp__browser-use__navigate_page` → `evaluate_script`。缺的条件：一个可见的 in-app browser 面板。
2. **登录态整页 E2E 未验**：`build:h5` 产物页需 `merchant_token` 登录态 + 后端 `:8080` 在线才能拿到真实 DECIMAL 下发数据；当前环境无 :8080、无 token。故「页面不再白屏」以**渲染级证据**证明（真实 SFC 模板片段 + 真实 `format.ts` + 真实 Vue SSR + 真实浏览器 DOM），基线同管线对 `null` 抛 `TypeError: _ctx.item.costPrice.toFixed is not a function`、修后正常渲染。**此项在浏览器整页真数据档标注为「未验」，不写「通过」**。缺的条件：运行中的后端 + 有效登录态。
3. **同类裸 `.toFixed()` 风险（提请后续单，本单未改）**：按「不批量改其它页面」约束，本单只建公共工具 + 修价格异常页。其它页面若存在对后端 DECIMAL/可空字段的裸 `.toFixed()`/算术运算，应另立单统一接入 `fmtAmount`。
4. **本单只覆盖 `listAnomalies` 四字段出参**：`price.ts` 其它接口中可能同样以字符串/null 下发的金额字段未改（超出本卡范围），提请后续按需收敛。

## 八 风险与自我报备

- 静态门以「读 `.vue` 源文本 + 正则」断言，非编译产物级；若将来有人把金额渲染重构进子组件，正则可能漏判——已同时保留 SSR 渲染级证据作二次兜底。
- `-0` 归一为 `0` 是显示层取舍；若下游需要区分负零（本场景不需要），已注释说明。
- `toNum` 对 `'1e3'` 之类科学计数串按合法数字处理（`Number()` 语义），符合「尽量救回合法数字」取向；如需更严可后续加白名单，属产品口径，本单未擅自收紧。
- 未改页面 `:class` 价格比较逻辑（`item.retailPrice < item.costPrice` 仍为原表达式，`<` 对字符串/null 不抛异常、不会白屏，仅可能比较不精确）；本单范围限于「止血白屏 + 四处显示」，比较精度问题未动，登记备查。
- 所有判据为**自评**读数，未做门禁脚本（基线无），验收以凌舟按同法复跑为准。

## 九 交付物与证据清单

代码/测试（实现笔 `233cd2fc`）：
- `app-mobile/src/utils/format.ts`（新增）
- `app-mobile/src/api/modules/price.ts`（改 4 字段类型）
- `app-mobile/src/pages-sub/product/price-anomaly/price-anomaly.vue`（改 4 处 + 导入）
- `app-mobile/tests/format.spec.ts`（新增，37 用例）
- `app-mobile/tests/price-anomaly-static.spec.ts`（新增，7 用例）

docs 笔：
- `docs/tasks/cards/R101-QODER-15-回传.md`（本卡）
- `docs/tasks/inbox/ACTIVE-回执-QODER-15.md`（含 DSH-RECEIPT）
- `docs/evidence/qoder-15/README.md`
- `docs/evidence/qoder-15/raw/01..10`（含 `render-evidence-stdout.txt`）
- `docs/evidence/qoder-15/anti/00..03`
- `docs/evidence/qoder-15/browser/render-demo-fixed.html`、`render-demo-dom-readback.txt`、`render-demo-a11y-snapshot.txt`

工作树外 scratch（未入库，README 已指明路径）：`D:\Users\ZXQL\wt-agents\QODER-15-scratch\`（`eslint-pre.json`/`eslint-post.json`/`render-evidence.cjs`/`inject.mjs`/`price-anomaly.vue.orig`/`price-anomaly.baseline.vue`）。

## 十 一行摘要

价格异常页四处裸 `.toFixed(2)` 改接新增 `utils/format.ts` 的 `fmtAmount`（无效→`—`、0→`0.00`、兼容字符串/null），出参四字段改 `number|string|null`，新增 2 文件 44 用例全绿 + 静态反测能红（注入→红点名 costPrice→复原 SHA256 一致→复跑绿）；自评 type-check 0=0、lint error 20→20/warning 12880→12880 逐规则不劣化、build:h5 EXIT=0，页面不再白屏以真实 SSR + 浏览器 DOM 回读实证（PNG/登录态整页 E2E 未验）。
