# ACTIVE-回执-QODER-15F1

> 汇报对象：凌舟（主代理／派单方）｜汇报人：Qoder（移动端执行方）｜日期：2026-10-21｜对应派单编号：QODER-15F1
> 本回执所有读数均为**执行方自评**，验收结论由凌舟按同一门槛复跑后另行出具。

## 人读摘要

QODER-15 把价格异常页的白屏止住了，但**标红判定仍是裸比较**：`price-anomaly.vue:63`
`​:class="{ 'price-danger': item.retailPrice < item.costPrice }"` 两侧值是 `number | string | null`
（`api/modules/price.ts:150-153`）。JS 对两个字符串按**字典序**比：`'9.00' < '12.00'` 得 **false**（首字符 `'9' > '1'`），
数值上 9 < 12 本应标红 ⇒ 该红的没红；反向 `'1000.00' < '999.00'` 得 **true** ⇒ 1000 元被误标成低于 999 元成本；
`null` 参与则隐式转 0 ⇒ `¥—` 的行凭空标红。本轮在 `src/utils/format.ts` 新增 **`isBelowCost(retail, cost)`**
（两侧先经既有 `toNum` 归一化，任一为 `null/undefined/''/纯空白/NaN/'abc'/±Infinity/boolean/对象/数组` ⇒ 直接 `false`，
全程不依赖 JS 隐式转换；有效值按数值严格小于，相等含 `0`/`-0` 不算低于成本），页面 `:class` 改为调用该函数，
不再直接比较原始 API 值。显示层四处仍是 `¥{{ fmtAmount(item.X) }}`，判定与显示共用同一 `toNum` 口径。

**未 rebase、未切分支**：开工即在 `fix/qoder-15f1-price-compare-restack`（HEAD `241f1f15`，代码基线 `dfeedbc0`）。
四门全程走 main 上已入库的**常驻包装器** `cd app-mobile && npm run <gate>`，本轮**没有借入也没有删除任何 harness**。

用例：`format.spec.ts` +41（字符串字典序 8 / number 语义 8 / 无效值 22 / 反例对照与同口径 3）、
`price-anomaly-static.spec.ts` +17（标红静态门 4 + **把页面 `:class` 表达式从 `.vue` 文本抠出来求值**的行为门 13）。
`gates-baseline.json` **只动 `tests`**（`5/56` → 实测 `7/158`，note 追加留痕），lint/typeCheck/checkContract/contractDrift 四段一字未动。

## 判据自评

| 判据 | 卡内目标 | 实测（自评） | 达成 | 证据 |
| --- | --- | --- | --- | --- |
| type-check | 0=0 | 改前/改后均 EXIT=0，当前 0 错 / 基线 0 错 | 达成 | `raw/01`、`raw/05` |
| lint | 逐规则不劣化 | 改前/改后 EXIT=0，error 20 / warning 12872；逐规则劣化 0 条、新增 error 对 0；覆盖文件 188（改前后同） | 达成 | `raw/02`、`raw/06`、`raw/09-lint-per-rule-diff.txt` |
| test | 7 文件 / 100 用例 | 改前 7/100 → 改后 **7 文件 / 158 用例** 全过 EXIT=0 | 达成（用例数**高于**卡内目标，见下"偏差"） | `raw/03`、`raw/07`、`anti/06c-test-green-final.txt` |
| check:contract | EXIT=0 | 改前/改后 EXIT=0，口径 292/283/204、注册 1498、差集 1 条全豁免 | 达成 | `raw/04`、`raw/08` |
| build:h5 | EXIT=0 | 仓库根 `npm --workspace app-mobile run build:h5` EXIT=0（DONE Build complete） | 达成 | `raw/10-build-h5.txt` |
| 反测 | 改回裸 `<` ⇒ 字符串低价用例红并点名；复原 SHA256 一致；复跑绿 | 注入 `isBelowCost(…)`→`item.retailPrice < item.costPrice`（命中恰 1）⇒ `TEST_RED_EXIT=1`，**8 条红**，含 `字符串低价 retail "9.00" / cost "12.00" ⇒ 必须标红（卡点名复现）AssertionError: expected false to be true`；`cp` 复原后 SHA256 `a615a954a9170a6d7cc7bf0872a0d3c5cc6ce3086cfa720fdfd8b47833f5cf7c` **与注入前逐字节一致**（`cmp -s` 亦一致）⇒ 复跑 `TEST_GREEN_EXIT=0`、`LINT_GREEN_EXIT=0` | 达成（禁用 `sed -i`；未用 Edit 删功能行，注入走工作树外 scratch `.mjs`） | `anti/00…07` |
| 静态门同红 | （附加留证） | 注入态下 3 条页面文本断言也红（`isBelowCost(` 计数≠1、页面重新出现 `item.retailPrice < item.costPrice`、出现裸价格比较） | 已留证 | `anti/02-test-red.txt` |
| 浏览器渲染证据 | 新目录补标红修复前后对比 | browser-use `evaluate_script` 真实 DOM：行1 字符串低价 修复前 `class="price-value"`/`rgb(64,64,64)` → 修复后 `class="price-danger price-value"`/`rgb(196,80,80)`；行2/3/4 修复前误标红 → 修复后不标红；行5/6 两向一致。颜色与 `src/uni.scss:19/:61` token 逐字对应 | 达成 | `browser/render-dom-readback-before-after.txt`、`render-ssr-readback.txt`、`price-danger-before-after.html`、`render-a11y-snapshot.txt`、`browser-session-note.txt` |

## 未验清单（禁止用"应无影响"代替）

1. **PNG 目视**：`take_screenshot` 本轮返回成功但只回图像文本描述，PNG 二进制未落盘 ⇒ 目视未验。复现：起 5183 静态服务后对 `price-danger-before-after.html` 重试。
2. **登录态整页 E2E**：无 `:8080` 后端在线、无登录态 token；本轮是"真实模板片段 + 真实工具函数 + SSR + 真实浏览器 DOM"，非整页运行态。复现：起后端造 `retail_price='9.00' / cost_price='12.00'` 的 SKU → `npm run dev:h5` → 登录进「商品 → 价格异常」看标红。
3. **真机**（iOS / Android / 微信开发者工具 / 小程序后台）：未验，本环境无设备与工具。
4. **后端是否确实以字符串下发 DECIMAL**：未联调实测（修复本身不依赖该形态，字符串/数字/null 三种同口径）。
5. **范围外（只报数不扩面）**：其它页面裸 `.toFixed(` 仍 **38 文件 / 106 处**（最集中 `product-detail.vue` 18 处）；`@/utils/format` 接入面仍 **1 页**；可空/字符串金额字段另有 **9 处**（`products.ts` 7 + `customers.ts` 1 + `transfer.ts` 1）。同类"两个价格裸比较"缺陷全 src 扫描 = **1 处已修 / 0 处仍受影响**。证据 `raw/12-rg-proof.txt`。

## 偏差报备（与卡内目标不一致处，一律如实）

1. **test 用例数 158 ≠ 卡内 100**。卡里 `5/56 → 7/100` 把上一轮 QODER-15 的 2 个 spec 文件（44 用例）算进本卡，而上一轮实现笔已落下（本轮改前实测即 7/100，基线未同步）。本轮新增 58 条 ⇒ **按实测 7/158 写基线并报备，未为凑 100 删任何用例**。
2. **本轮未新增 spec 文件**（testFiles 仍 7），卡的"新增 2 个 spec 文件"字面在上一轮已消化；再建 2 个文件会变 9，与判据无关。
3. **lint `files` 未 190→191**：本轮 src 只改 2 个既有文件、tests 不在 eslint 扫描面；本工作树实测覆盖 **188** 文件（与改前一致）。负责人参考日志的 190/191 与本树存在口径差（疑含 `scripts`/`tests` 或另一棵工作树），未据此动基线。
4. **复原后 test 首两次复跑为红**，红点在与本卡无关的 `tests/api-base-env.spec.ts`（`Test timed out in 5000ms`，冷转换负载越阈值）；无负载第三次 `EXIT=0`、该 spec 3 用例 478ms 通过。三段日志全留（`anti/06a`、`06b`、`06c` + `06a-flake-note.txt`），未择绿遮掩。
5. **两个 spec 文件头的"harness 借入自 9fd90257"过时说明已改为 `npm run test`**（注释级，不动任何断言与用例数），避免照抄诱导下一位再犯"借入后删除"。
6. `docs/evidence/qoder-15/**` 旧证据**一字未改**；新旧读数差异点（null 行由误标红变不标红）在新目录 README §0 点名。

```
===DSH-RECEIPT-BEGIN===
id: QODER-15F1
status: DONE
summary: 价格异常页低价标红判定归一化收口——src/utils/format.ts 新增 isBelowCost(retail,cost)，两侧先经既有 toNum 归一化（null/undefined/空串/纯空白/NaN/'abc'/±Infinity/boolean/对象/数组任一无效值直接 false，全程不依赖 JS 隐式转换），有效值按数值严格小于且相等（含 0/-0）不算低于成本；price-anomaly.vue:63 :class 由 item.retailPrice < item.costPrice 改调该函数，不再直接比较原始 API 值。修掉字符串字典序误判（'9.00'<'12.00' 得 false ⇒ 漏标红；'1000.00'<'999.00' 得 true ⇒ 误标红）与 null 隐式转 0 的凭空标红。新增 58 用例（format.spec +41、price-anomaly-static +17，含把页面 :class 表达式从 .vue 文本抠出求值的行为门），gates-baseline.json 只动 tests 段 5/56→实测 7/158 并 note 留痕，lint/typeCheck/checkContract/contractDrift 四段一字未动。四门 + build:h5 全绿，反测能红且复原逐字节一致。PNG 目视与登录态整页 E2E、真机、后端字符串下发均未验（已给复现命令）。
worktree: D:\Users\ZXQL\wt-agents\QODER-15
branch: fix/qoder-15f1-price-compare-restack
commits: 477acdca(impl: src/utils/format.ts + price-anomaly.vue + tests×2 + gates-baseline.json)；docs 笔=回传卡+本回执+docs/evidence/qoder-15f1/**（写时不可知自身哈希，取 git log 最新一笔）；起点 HEAD 241f1f15，代码基线 dfeedbc0，未 rebase/未切分支
gates: type-check=>改前0/改后0(EXIT0,0=0) | lint=>EXIT0,error20->20/warning12872->12872,逐规则劣化0,新增error对0,覆盖文件188(改前后同,未190->191) | test=>改前7文件100用例/改后7文件158用例全过(EXIT0,基线同步5/56->7/158,高于卡内目标100已报备未砍用例) | check:contract=>EXIT0,292/283/204,注册1498,差集1全豁免 | build:h5=>EXIT0(仓库根 npm --workspace app-mobile run build:h5) | 反测=>注入item.retailPrice<item.costPrice(命中恰1) TEST_RED_EXIT=1 8条红点名[字符串低价9.00vs12.00 expected false to be true]+静态门3条同红; cp复原 SHA256 a615a954a9170a6d7cc7bf0872a0d3c5cc6ce3086cfa720fdfd8b47833f5cf7c 与注入前逐字节一致(cmp -s 亦一致) 禁用sed-i; 复跑 TEST_GREEN_EXIT=0 且 LINT_GREEN_EXIT=0(前两次被无关 api-base-env 5000ms 冷转换超时打断,第三次干净全绿,三段日志全留) | 浏览器=>browser-use evaluate_script 真实DOM回读 行1修复前class=price-value/rgb(64,64,64)->修复后class=price-danger price-value/rgb(196,80,80),行2/3/4由误标红转不标红,行5/6两向一致; 颜色对应 src/uni.scss:19 $uni-color-error #C45050 与 :61 $uni-gray-700 #404040 | 未验=>PNG目视(截图只回文本描述,PNG未落盘)/登录态整页E2E(无:8080后端与token)/真机(无设备)/后端字符串下发(未联调)
redlines: 遵守（未 push / 未开 PR / 未 git add -A，两笔均逐文件 add；未 rebase、未切分支、未碰 git 历史；只动 D:\Users\ZXQL\wt-agents\QODER-15，注入器与渲染脚本放工作树外 _scratch\qoder-15f1\ 未入库；任务书原件与 docs/tasks/inbox/ACTIVE.md 未改未删；未 npm install、未改 package.json 依赖与 lockfile；未借入也未删除任何 harness，四门全走常驻包装器；lint/typeCheck/checkContract/contractDrift 四段基线未放宽；文档全部署名"执行方自评"，未写任何「凌舟裁定/验收结论」；其它页面裸 .toFixed（38 文件/106 处）与 price.ts 外 9 处可空金额字段登记为范围外未扩面；未做项一律写"未验"）
evidence: docs/evidence/qoder-15f1/README.md,docs/evidence/qoder-15f1/raw/01-typecheck-pre.txt,docs/evidence/qoder-15f1/raw/02-lint-pre.txt,docs/evidence/qoder-15f1/raw/03-test-pre.txt,docs/evidence/qoder-15f1/raw/04-check-contract-pre.txt,docs/evidence/qoder-15f1/raw/05-typecheck-post.txt,docs/evidence/qoder-15f1/raw/06-lint-post.txt,docs/evidence/qoder-15f1/raw/07-test-post.txt,docs/evidence/qoder-15f1/raw/08-check-contract-post.txt,docs/evidence/qoder-15f1/raw/09-lint-per-rule-diff.txt,docs/evidence/qoder-15f1/raw/10-build-h5.txt,docs/evidence/qoder-15f1/raw/11-final-selfcheck.txt,docs/evidence/qoder-15f1/raw/12-rg-proof.txt,raw/13-terminal-verify.txt,docs/evidence/qoder-15f1/anti/00-pre-sha256.txt,docs/evidence/qoder-15f1/anti/01-inject-note.txt,docs/evidence/qoder-15f1/anti/01b-injected-line-readback.txt,docs/evidence/qoder-15f1/anti/02-test-red.txt,docs/evidence/qoder-15f1/anti/03-lint-red-incidental.txt,docs/evidence/qoder-15f1/anti/04-restore-sha256.txt,docs/evidence/qoder-15f1/anti/05-sha-compare.txt,docs/evidence/qoder-15f1/anti/05b-restore-proof.txt,docs/evidence/qoder-15f1/anti/06a-flake-note.txt,docs/evidence/qoder-15f1/anti/06a-test-green-attempt1-unrelated-flake.txt,docs/evidence/qoder-15f1/anti/06b-test-green-attempt2-unrelated-flake.txt,docs/evidence/qoder-15f1/anti/06c-test-green-final.txt,docs/evidence/qoder-15f1/anti/07-lint-green.txt,docs/evidence/qoder-15f1/browser/price-danger-before-after.html,docs/evidence/qoder-15f1/browser/render-ssr-readback.txt,docs/evidence/qoder-15f1/browser/render-dom-readback-before-after.txt,docs/evidence/qoder-15f1/browser/render-a11y-snapshot.txt,docs/evidence/qoder-15f1/browser/browser-session-note.txt
return_card: docs/tasks/cards/R101-QODER-15F1-回传.md
===DSH-RECEIPT-END===
```
