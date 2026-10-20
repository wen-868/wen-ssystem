# R101-QODER-15F1-回传 · 低价比较归一化 + 常驻门禁重栈

> 汇报对象：凌舟（主代理／派单方）
> 汇报人：Qoder（移动端执行方）
> 日期：2026-10-21
> 对应派单编号：QODER-15F1（任务书 `docs/tasks/inbox/QODER-15F1-price-compare-restack.md`，原件未改动）
>
> 本卡所有读数均为**执行方自评**，不是验收结论；「目标读数」列一律照抄卡内原文。

---

## ① 基线与提交

| 项 | 值 |
| --- | --- |
| 工作树 | `D:\Users\ZXQL\wt-agents\QODER-15`（只动这一棵） |
| 分支 | `fix/qoder-15f1-price-compare-restack` |
| 代码基线 | `dfeedbc0`（#368 合并后的 main）；`origin/main` = `21b465e5` |
| 开工 HEAD（旧 3 笔 rebase 后） | `241f1f15` |
| 本轮实现笔 | `477acdca` — `fix: 价格异常页低价标红判定经 toNum 归一化杜绝字符串字典序误判`（5 文件：`src/utils/format.ts`、`src/pages-sub/product/price-anomaly/price-anomaly.vue`、`tests/format.spec.ts`、`tests/price-anomaly-static.spec.ts`、`scripts/gates-baseline.json`） |
| 本轮 docs 笔 | 回传卡 + 回执 + `docs/evidence/qoder-15f1/**`（写卡时不可知自身哈希，为 `git log` 最新一笔） |
| rebase / 分支操作 | **无**。开工即在指定工作树与分支上，未 rebase、未切分支、未碰 git 历史 |

## ② 修法 × 读数总表

| # | 卡内动作 | 落点 | 修法 | 自评读数（目标读数照抄卡） |
| --- | --- | --- | --- | --- |
| 1 | §二.2 新增比较函数 | `app-mobile/src/utils/format.ts`（`fmtAmount` 之后） | `isBelowCost(retail, cost): boolean`：两侧先 `toNum` 归一化，任一为 null ⇒ false；否则数值严格小于 | 导出 `isBelowCost`；type-check 0=0、lint 该文件 0 新增问题 |
| 2 | §二.3 页面接入 | `price-anomaly.vue:63` | `:class="{ 'price-danger': isBelowCost(item.retailPrice, item.costPrice) }"`；新增 `import { isBelowCost } from '@/utils/format'` | 全 src 已无 `item.retailPrice < item.costPrice` 现场（`rg` 0 命中，见 `raw/12-rg-proof.txt`） |
| 3 | §二.4 用例 | `tests/format.spec.ts` +41、`tests/price-anomaly-static.spec.ts` +17 | 字符串字典序复现、number 语义、无效值任一侧 false、千分位/空白有效；并加「页面 `:class` 表达式抠出来求值」的行为门 | `isBelowCost('9.00','12.00') === true` 绿；反测时该条红并点名 |
| 4 | §二.5 gates baseline | `scripts/gates-baseline.json` | **只动 `tests`**：`5/56` → 实测 `7/158`，note 追加 QODER-15F1 留痕 | lint / typeCheck / checkContract / contractDrift 四段**逐字未动**（diff 仅 tests 段） |
| 5 | §三 浏览器证据 | `docs/evidence/qoder-15f1/browser/` | 新目录补「标红判定修复前后对比」真实 DOM 回读（类名 + computed color） | 行1 字符串低价：修复前不标红 → 修复后 `rgb(196,80,80)`；行2/3/4 修复前误标红 → 修复后 `rgb(64,64,64)` |

**四门 + 构建总读数（自评）**

| 门 | 改前 | 改后 | 卡内目标 | 判定 |
| --- | --- | --- | --- | --- |
| `npm run type-check` | EXIT=0，0 错/基线 0 | EXIT=0，0 错/基线 0 | 0=0 | 达成 |
| `npm run lint` | EXIT=0，error 20 / warning 12872 | EXIT=0，error 20 / warning 12872；逐规则劣化 0、新增 error 对 0；覆盖文件 **188** | 逐规则不劣化 | 达成（文件数未 190→191：本轮未新增 src 文件，见 ⑤.3） |
| `npm run test` | EXIT=0，7 文件 / 100 用例 | EXIT=0，**7 文件 / 158 用例** | 7 文件 / 100 用例 | 文件数 7=目标；用例数 158 **高于**目标 100，按实测登记（见 ⑤.1） |
| `npm run check:contract` | EXIT=0，292/283/204、注册 1498、差集 1 全豁免 | 同上，EXIT=0 | EXIT=0 | 达成 |
| `build:h5`（仓库根） | — | EXIT=0，`DONE Build complete` | EXIT=0 | 达成 |

## ③ 逐条实现说明

**1. `isBelowCost` 为什么这样写（`app-mobile/src/utils/format.ts:54-79`）**

- 缺陷本体：两侧值是 QODER-15 已声明的 `number | string | null`（`src/api/modules/price.ts:150-153`）。JS 对两个字符串做 `<` 走**字典序**：`'9.00' < '12.00'` 逐字符比首字 `'9' > '1'` ⇒ **false**，而数值 9 < 12 应为 true ⇒ 该标红的不标红；反向 `'1000.00' < '999.00'` ⇒ **true**（`'1' < '9'`）⇒ 1000 元被误标成低于 999 元成本。null 参与则走隐式转换（`null < 12.34` 为 true，凭把 `¥—` 标成红）。
- 实现：**两步都不做隐式转换** —— `toNum(retail)` / `toNum(cost)`，任一 `=== null` 直接 `return false`；否则 `r < c`。无效值集合与 `toNum` 完全同口径：`null`/`undefined`/`''`/纯空白/`'abc'`/`NaN`/`±Infinity`/boolean/对象/数组。
- 宁漏不错标：任一侧无效 ⇒ false（不标红），因为无效值不构成可判定的价格关系；显示层此时出 `¥—`，两侧口径同源不会出现"显示 9.00/12.00 却不标红"的打架。
- 相等不算低于成本（含 `0` 与 `-0`，`toNum` 已把 `-0` 归一为 `0`）。千分位 `'1,234.56'`、前后空白 `' 12.34 '` 为有效输入（`toNum` 已 trim + 剥逗）。
- 未新增文件、未新增依赖、未改函数签名以外的任何东西；`toNum`/`fmtAmount` 本体一字未动（只补了文件头与函数上的口径注释）。

**2. 页面接线（`price-anomaly.vue`）**

- 只改 `:63` 一行表达式 + 加一行 import；四处显示仍是 `¥{{ fmtAmount(item.X) }}`（`:59/:64/:69/:73` 未动），布局/样式/脚本逻辑/`:class` 之外的绑定未动。
- **import 形态说明（刻意为之）**：新增的是独立一行 `import { isBelowCost } from '@/utils/format'`，没有合并成 `import { fmtAmount, isBelowCost } from ...`。原因：既有静态门 `tests/price-anomaly-static.spec.ts:37` 逐字断言 `import { fmtAmount } from '@/utils/format'` 这一行存在，合并写法会让上一轮的反测门假红；本卡不改他人已验收的断言。ESLint 未启用 `no-duplicate-imports`/`import/no-duplicates`（`.eslintrc.cjs` 全量规则已核），lint 门读数证明无新增告警（②表）。
- 页面对 `listAnomalies` 出参的类型是 `ref<any[]>`（`price-anomaly.vue:111`，上一轮既有状态），所以模板表达式在 vue-tsc 下不做字段类型收窄 —— 判定安全性由函数本身保证，不依赖模板类型。

**3. 测试设计**

- `tests/format.spec.ts`（+41 用例，3 个 describe）：字符串必须按数值比 8 条（含卡点名的 `'9.00' vs '12.00'`、字典序反向 `'1000.00' vs '999.00'`、千分位、混合 number/string）；number 语义与边界 8 条（`9<12` true、`12<9` false、相等 false、`0<1` true、`-0` 与 `0` 相等、负价、极小差值）；无效值 26 条（11 种无效形态 × 分别放 retail / cost 两侧 = 22，两侧都无效 1、裸 `<` 反例对照 1、显示与判定同口径 1，另含 boolean/对象/数组）。
- `tests/price-anomaly-static.spec.ts`（+17 用例）：标红静态门 4 条（`isBelowCost(` 恰 1 次、不再出现 `item.retailPrice < item.costPrice`、无 `item.*Price < item.*Price` 形态、import 存在）+ **表达式行为门 13 条**：把页面 `:class` 的真实表达式用正则从 `.vue` 文本里抠出来，`new Function('item','isBelowCost', ...)` 求值 12 种数据形态 + 1 条"表达式本体仍是函数调用"。这一层让"改回裸 `<`"不仅文本红，**行为也红且直接指向字符串低价那条**。
- 未新增 spec 文件（仍 7 文件），未删/未弱化任何既有用例；仅把两个 spec 文件头注释里"harness 借入自 9fd90257"的**过时运行方式**改为 `cd app-mobile && npm run test`（本轮常驻门禁，旧写法会诱导下一位再犯"借入后删除"，见 ⑧.2）。

**4. gates-baseline.json**

- diff 只有 `tests` 段：`testFiles 5→7`、`testCount 56→158`，`note` 末尾追加 QODER-15 与 QODER-15F1 两段留痕（谁、为什么、从几到几），原文一字未删。
- `lint` / `typeCheck` / `checkContract` / `contractDrift` 四段**未动一个字符**（`git diff HEAD~1 -- app-mobile/scripts/gates-baseline.json` 可核）。

## ④ 测试 / 门读数（原始输出文件号）

| 判据 | 改前 | 改后 | 证据 |
| --- | --- | --- | --- |
| type-check | EXIT=0 / 0 错 | EXIT=0 / 0 错 | `raw/01-typecheck-pre.txt`、`raw/05-typecheck-post.txt` |
| lint（门包装器） | EXIT=0 / error 20 / warning 12872 | EXIT=0 / error 20 / warning 12872 | `raw/02-lint-pre.txt`、`raw/06-lint-post.txt` |
| lint 逐规则 | — | warning 劣化规则 0、error 新增对 0、覆盖文件 188 | `raw/09-lint-per-rule-diff.txt` |
| test | EXIT=0 / 7 文件 / 100 用例 | EXIT=0 / 7 文件 / **158** 用例 | `raw/03-test-pre.txt`、`raw/07-test-post.txt`、`anti/06c-test-green-final.txt` |
| check:contract | EXIT=0 / 292·283·204 / 1498 / 豁免 1 | 同读数 EXIT=0 | `raw/04-check-contract-pre.txt`、`raw/08-check-contract-post.txt` |
| build:h5 | — | EXIT=0 | `raw/10-build-h5.txt` |
| 反测 | 注入 `item.retailPrice < item.costPrice` ⇒ `TEST_RED_EXIT=1`，8 条红（卡点名那条 `expected false to be true`）；`cp` 复原 SHA256 `a615a954…cf7c` 与注入前**逐字节一致**；复跑 `TEST_GREEN_EXIT=0` / `LINT_GREEN_EXIT=0` | | `anti/00…07`（含 `05b-restore-proof.txt` 的 `cmp -s` 一致） |
| 浏览器 | 修复前标红 5/6 行 → 修复后 3/6 行；差异行 4 条，computed 色 `rgb(196,80,80)`↔`rgb(64,64,64)` 与 `src/uni.scss:19/:61` token 对应 | | `browser/render-dom-readback-before-after.txt`、`render-ssr-readback.txt`、`price-danger-before-after.html`、`render-a11y-snapshot.txt`、`browser-session-note.txt` |

**终态复跑**：在已提交态（docs 笔 `bd59a405`）上把常驻四门再跑一遍，全 `EXIT=0`（type-check 0=0、lint error 20/warning 12872、test 7 文件/158 用例、contract 差集全豁免），逐条 git 读数（改动面、`backend/` 0、分支与提交链）见 `raw/13-terminal-verify.txt`；收尾笔提交后 `git status --porcelain` 为空。

**反测红点名（`anti/02-test-red.txt` 摘录）**

```
FAIL tests/price-anomaly-static.spec.ts > …低价标红静态门 > :class 标红判定调用 isBelowCost，且全页恰好出现 1 次
FAIL tests/price-anomaly-static.spec.ts > …低价标红静态门 > 页面不再直接比较原始 API 值 item.retailPrice < item.costPrice
FAIL tests/price-anomaly-static.spec.ts > …低价标红静态门 > 全页不存在任何 item.*Price < item.*Price 形态的裸价格比较
FAIL tests/price-anomaly-static.spec.ts > …:class 表达式行为门 > 绑定表达式确实走归一化工具（而非裸 `<`）
FAIL tests/price-anomaly-static.spec.ts > …:class 表达式行为门 > 字符串低价 retail "9.00" / cost "12.00" ⇒ 必须标红（卡点名复现）
     AssertionError: expected false to be true      ← '9.00' < '12.00' 字典序，正是卡里点名的误判
FAIL …行为门 > 字符串高价 retail "12.00" / cost "9.00" ⇒ 不标红
FAIL …行为门 > 字典序反向 retail "1000.00" / cost "999.00" ⇒ 不得误标红
FAIL …行为门 > retail null / cost "12.00" ⇒ 无效值不标红
Tests  8 failed | 150 passed (158)  ⇒ TEST_RED_EXIT=1
```

静态门（页面文本断言类）**同时红**，一并留证（上面前 4 条即静态/结构断言）。附带读数：注入态 `npm run lint` 也红（`@typescript-eslint/no-unused-vars` 104→105，因注入没删 import），登记于 `anti/03-lint-red-incidental.txt`，非本卡反测目标。

## ⑤ 口径偏差报备

1. **test 用例数 158 ≠ 卡内目标 100（高于目标 58 条）**。卡的 `5/56 → 7/100` 是把「QODER-15 新增 2 个 spec 文件」记在本卡名下（`format.spec` 37 + `price-anomaly-static` 7 = 44，56 + 44 = 100），而上一轮实现笔已把两文件落下（改前实测即 7/100），基线却未同步。本轮新增 58 条判定/行为用例 ⇒ 实测 **7/158**。按协议 §2「实测即基线、不得为凑目标砍用例」，基线写 **7/158** 并在此报备。**未删任何用例**。
2. **文件数口径**：卡说"新增 2 个 spec 文件"，本轮**没有新增 spec 文件**（在既有 2 个文件里加用例），故 testFiles 仍 7；若按卡字面再建 2 个文件会变 9，与常驻基线口径无关，判为不需要。
3. **lint `files` 计数未 190→191**：预警的是"若新增 src 文件"的情形。本轮 src 只改 2 个既有文件、测试不在 eslint 扫描面（`eslint src --ext .ts,.vue`），覆盖文件数实测 **188**（`raw/09-lint-per-rule-diff.txt`），与改前一致；负责人给的 190/191 与本工作树 `src` 实测 188 存在口径差（可能含 `scripts`/`tests` 或另一棵工作树），不影响"逐规则不劣化"判据，如实登记不擅改基线。
4. **`docs/evidence/qoder-15/**` 旧证据未改写**（红线要求），新读数全部落在 `docs/evidence/qoder-15f1/`；与旧读数不一致处已在 `docs/evidence/qoder-15f1/README.md` §0 点名（旧 `dangerCount=2` 含 null 行凭空标红，本轮同形态不再标红）。
5. **反测复原后 test 门首两次复跑为红**，红点在与本卡无关的 `tests/api-base-env.spec.ts`（`Test timed out in 5000ms`，`vi.resetModules()` + 动态 import 的冷转换在反测连跑负载下越阈值）；无并发负载的第三次 `TEST_GREEN_EXIT=0`，该 spec 3 用例 478ms 通过。三段日志与判读全部留在 `anti/06a/06b/06c + 06a-flake-note.txt`，未择绿遮掩。

## ⑥ 红线对照（逐条自查）

| 红线 | 自查 |
| --- | --- |
| 不得 push | 未执行任何 `git push`；分支只在本地 |
| 不得开 PR | 未建 PR、未用 `gh pr create` |
| 不得 `git add -A` / 逐文件 add | 两笔提交均逐文件 `git add <路径>`，未用 `-A`/`.` |
| 不是凌舟，文档不得写「凌舟裁定/验收结论」 | 本卡与回执、证据 README 全部署"执行方自评"，判据列只照抄卡内目标读数；未写任何归属凌舟的裁定/验收结论（`gates-baseline.json` 里既有的历史 note 原文保留、未新增此类表述） |
| 只动 `QODER-15` 工作树 | 业务改动与文档全部落在 `D:\Users\ZXQL\wt-agents\QODER-15`；注入器/渲染脚本/日志放 `D:\Users\ZXQL\wt-agents\_scratch\qoder-15f1\`（工作树外，不入 git）；主仓 `D:\Users\ZXQL\ZXQL-MS` 只读（只读了任务书原件） |
| 不改任务书原件、不动 `docs/tasks/inbox/ACTIVE.md` | 任务书 `QODER-15F1-price-compare-restack.md` 未打开写模式、`git status` 无该路径；`ACTIVE.md` 未碰 |
| 不 npm install、不改 package.json 依赖 / lockfile | 未执行任何 install；`git diff` 面内无 `package.json`、无 `package-lock.json` |
| 严禁"借入 harness 后删除" | 四门全程走 `npm run <gate>`（常驻包装器）；本轮未借入、未删除任何 harness 文件 |
| 其它页面裸 `.toFixed` 与 `price.ts` 其它可空金额字段属范围外 | 未动一行业务面外代码，只在 ⑦ 登记数字（38 文件 / 106 处；可空金额字段另 9 处） |
| 没做的写「未验」 | 见 ⑦ 与 `browser/` 三段说明 |
| 不 rebase、不切分支、不碰 git 历史 | 全程在既有分支上提交 2 笔，无 rebase/checkout/reset/amend |
| 提交消息 `type: 中文描述`，终态 `git status` 空 | 实现笔 `fix: …`、docs 笔 `docs: …`；收尾自检见 `raw/11-final-selfcheck.txt` |

## ⑦ 未完成与阻塞

**阻塞：无。** 卡内五项动作全部落地。

**未验（如实登记，不用"应无影响"代替）**

| 未验项 | 原因 | 复现命令 |
| --- | --- | --- |
| PNG 目视截图 | 本轮 `take_screenshot` 动作返回成功，但回传形态为图像文本描述，**PNG 二进制未落盘**，不做目视结论 | 见 `browser/browser-session-note.txt` 第 3 步，用 browser-use 对 `http://127.0.0.1:5183/price-danger-before-after.html` 重试 |
| 登录态整页 E2E（真实 `price-anomaly` 页跑通列表 → 标红） | 无 `:8080` 后端在线、无登录态 token；本轮证据是"真实模板片段 + 真实工具函数经 SSR + 真实浏览器 DOM 回读"，非整页运行态 | 后端起 `localhost:8080` + 造 `retail_price='9.00' / cost_price='12.00'` 的 SKU → `cd app-mobile && npm run dev:h5` → 登录后进「商品 → 价格异常」看零售价是否标红 |
| 真机（iOS / Android / 微信开发者工具 / 小程序后台） | 本环境无设备与开发者工具；且改动仅在 H5 可跑的模板表达式层，判定读数由 DOM 级回读支撑，真机形态**未验** | `npm run dev:app` / `build:mp-weixin` 后在微信开发者工具打开同一页 |
| 后端契约侧（`/admin/prices/anomalies` 是否真的以字符串下发 DECIMAL） | 未联调；本轮修复不依赖后端形态（字符串/数字/null 三种都走同一 `toNum` 口径），但"后端确实下发字符串"这一事实**未在本环境实测** | 起后端后 `curl` 该端点看 `retailPrice` 的 JSON 类型 |

**范围外登记（不扩面，只报数）**

1. 其它页面裸 `.toFixed(`：**38 个文件 / 106 处**仍受影响（`src/utils/format.ts` 自身 3 处为注释与合规实现，不计）。最集中：`pages/products/product-detail.vue` 18 处、`pages/home/home.vue` 8 处、`pages-sub/product/batch-price/batch-price.vue` 6 处、`pages/sales/create-sale.vue` 6 处、`pages/orders/order-detail.vue` 6 处、`pages-sub/finance/reports/reports.vue` 5 处。证据 `raw/12-rg-proof.txt`。
2. 同类"两个价格字段裸比较"缺陷：全 `src` 扫描**只有 1 处**（本页 `:63`，本卡已修）⇒ **仍受影响 0 处**。这条是给验收的边界结论：本卡的判定缺陷不与他页共享同源现场。
3. `@/utils/format` 接入面：**仅 1 个页面**（`price-anomaly.vue`）。其余页面的金额显示/比较仍是各自写法。
4. 可空/字符串金额字段声明：`api/modules/price.ts` 4 处（本卡所在页，显示 + 判定均已归一化）+ `api/modules/products.ts` 7 处 + `api/modules/customers.ts` 1 处 + `api/modules/transfer.ts` 1 处 = 另 **9 处属范围外**。
5. `tests/api-base-env.spec.ts` 对 vitest 默认 `testTimeout` 不设余量，高负载下会**假红**（本轮反测复原阶段实测撞到两次）。属他人门禁，本卡未动，建议单开一卡。

## ⑧ 自我报备与踩坑

1. **import 合并会打断上一轮的反测门**：`tests/price-anomaly-static.spec.ts:37` 逐字断言 `import { fmtAmount } from '@/utils/format'`。若按常规写成合并 import，该断言立刻假红。本卡选"独立第二行 import"保住既有断言原文，并把该取舍写进 ③.2 与代码注释。踩坑点：**页面文本断言型门（静态门）对"改一行既有写法"是脆的**，下一单接同一页前先看该页有没有逐字文本断言。
2. **两个 spec 文件头的 harness 说明是过时事实**（写着"本工作树基线无门禁设施，从 9fd90257 借入"）。本轮常驻门禁已入库，照抄那段就会诱导下一位再犯"借入后删除"。已改为 `npm run test` 一句。该改动是**注释级**，不影响任何断言与用例数，属本卡最小必要修正 —— 若认为应严格零扩散，可整段回退而不影响门。
3. **反测复原后的"绿"差点被假红与假绿两头骗**：连跑负载让无关的 `api-base-env` 超时（假红），若只挑好看的那次登记就成了假证据。处置：三次日志全留（`06a/06b/06c`）并写 `06a-flake-note.txt` 判读。教训同协议 §4.3 —— 注入/复原与 vitest 冷跑必须串行且**不要在负载尾巴上抢跑**。
4. **`git diff --stat` 不能当"复原成功"的判据**：复原后它与 HEAD 仍有差异（那正是本卡的改动），字节级判据只有 `sha256sum` + `cmp`。已在 `anti/05b-restore-proof.txt` 把这个误读风险写死。
5. **MSYS 路径转换坑按协议先设了 `export MSYS2_ARG_CONV_EXCL='*'` 再跑 `rg`**，并在校验时确认 `item.retailPrice < item.costPrice` 这条模式**确实命中到注释行**（说明模式没有被吞成假 0），才敢用"0 命中"下结论。
6. 反测注入只动 `:class` 表达式一处、不删 import，因此注入态 lint 也红（unused-vars 104→105）。这是附带现象，不是反测目标，已单独登记避免被误读成"本卡改动引起 lint 劣化"。

## ⑨ 复现命令

```bash
# 全部门禁（必须走常驻包装器，不要手拼 node ../node_modules/…）
cd D:/Users/ZXQL/wt-agents/QODER-15/app-mobile
npm run type-check      # 期望 EXIT=0，0 错 = 基线 0
npm run lint            # 期望 EXIT=0，error 20 / warning 12872
npm run test            # 期望 EXIT=0，7 文件 / 158 用例
npm run check:contract  # 期望 EXIT=0，missingAfterExemptions=0
cd ..
npm --workspace app-mobile run build:h5   # 期望 EXIT=0，DONE Build complete

# 用例点名（不要手拼 vitest 绕过包装器——基线比较才是判据本体）
# 单文件级红/绿点名直接看 npm run test 输出里的 `✓ tests/price-anomaly-static.spec.ts (24 tests)` 行

# 反测（协议 §4 原子序列：改前 SHA → cp 备份 → 注入 → 红 → cp 复原 → SHA 一致 → 绿）
sha256sum src/pages-sub/product/price-anomaly/price-anomaly.vue
cp <vue> D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/price-anomaly.vue.bak
node D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/inject-anti.mjs <vue 绝对路径> <out.txt>   # 命中数≠1 即 exit 9
npm run test          # 期望 TEST_RED_EXIT=1，点名"字符串低价 retail 9.00 / cost 12.00"
cp D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/price-anomaly.vue.bak <vue>   # 禁止 sed -i
sha256sum <vue>       # 期望与改前一致 a615a954…cf7c；cmp -s 亦一致
npm run test && npm run lint   # 期望双绿 EXIT=0

# 浏览器渲染证据（修复前后标红对比）
node D:/Users/ZXQL/wt-agents/_scratch/qoder-15f1/render-compare.cjs
# 再起 5183 静态服务 + browser-use navigate/evaluate_script，命令全文见 browser/browser-session-note.txt

# 收尾自检
git status --porcelain
git log --oneline origin/main..HEAD
git diff --name-only dfeedbc0..HEAD
git diff --stat dfeedbc0..HEAD -- backend/
git diff --name-only dfeedbc0..HEAD -- app-mobile/src
```

## ⑩ 对下一单的建议

1. **同页若再动模板**：先读 `tests/price-anomaly-static.spec.ts` 的逐字断言清单（`¥{{ fmtAmount(item.X) }}`、两条 import 原文、`isBelowCost(` 恰 1 次、`'price-danger'` 绑定表达式原文）。这些断言对"顺手改格式/合并 import"都是脆的。
2. **判定类修复请沿用「表达式行为门」这个形态**（从 `.vue` 文本抠 `:class` 表达式 + `new Function` 求值）：静态文本门只能证明"写法变了"，行为门才能证明"改了会算错"。下一单若处理 `type-below`/`type-zero` 标签或 `anomalyType` 相关判定，可直接照搬该 describe。
3. **范围外清单已有数字，可直接下卡**：38 文件 / 106 处裸 `.toFixed`（`product-detail.vue` 18 处最多）、`@/utils/format` 接入面仅 1 页。按页切卡比按文件切卡更稳。
4. **`api-base-env.spec.ts` 的 5000ms 无余量超时**建议单开一卡（给 `testTimeout` 或先预热 import），否则任何反测连跑都可能踩到假红、并让人怀疑复原是否成功。
5. **常驻门的"用例数只准升"意味着基线必须跟着每笔实测走**：本卡把 5/56 一次拉到 7/158；下一单若再 +N，只改 `tests` 两数并追加 note，别动 lint/typeCheck/contract 三段（本轮按协议 §2 执行，diff 可核）。
6. **证据目录请继续"新读数新目录并存"**：`docs/evidence/qoder-15/` 与 `qoder-15f1/` 的差异点（null 行从误标红到不标红）是同一页两轮修复的自然结果，后一单接手前请按新目录读，不要拿旧目录的 `dangerCount` 当现状。

---

> 汇报对象：凌舟（主代理／派单方）｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-15F1
> 本卡为执行方自评回传，验收结论由凌舟按同一门槛复跑后另行出具。
