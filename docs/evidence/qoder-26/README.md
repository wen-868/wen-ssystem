# QODER-26 证据树 · SKU/SPU 维度与路径参数（MO-22/23）

> 任务书：`docs/tasks/inbox/QODER-26-sku-dimension.md`｜回传卡：`docs/tasks/cards/R101-QODER-26-回传.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-26`｜分支：`fix/qoder-26-sku-dimension`｜基线：`bc1087ee`｜实现笔：`3228ffc5`
> 维护方：Qoder（移动端）。**本树只登记执行方自己的读数，不含验收方判词。**
> 原始日志由前一个执行子代理落盘；本 README 与两份文档由**收尾子代理**新增，**未改写任何原始日志字节**。

## 0. 清单

**共 28 份**：`raw/` 4 + `anti/` 23（含 `at-inject.cjs` 1、`00-pristine-sha.txt` 1、`pristine/` 备份 2、四轮日志 19）+ `h5/` 1。
目录树速览：

```
docs/evidence/qoder-26/
├── README.md                       ← 本文件（收尾代理新增，未计入 28 份原始件）
├── raw/  (4)                       四门串跑 + 三构建
├── anti/ (23)                      反测注入器 + 四轮 inject/red/green/round + 原始 SHA + pristine 备份
└── h5/   (1)                       mock 后端装置（未跑 ⇒ 运行态判据未验）
```

---

## 1. `raw/` —— 任务书 §三 硬验收（门与构建）

| 文件 | 对应任务书条目 | 关键读数（原文转录） | 状态 |
| --- | --- | --- | --- |
| `raw/00-check-gates.log` | **§三.1** `check:gates EXIT=0`；同时佐证 **§二.6**（tests 12/241）与 **§二.4**（contract 差集不升） | type-check `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`（`:10`）／lint `error 0（基线 0）、warning 12872（基线 12872）`（`:17`）／test `12 passed (12)`、`241 passed (241)`、`tests/product-sku-dimension.spec.ts (55 tests)`（`:28,52-53`）、`当前 12 文件 / 241 用例，基线 12 / 241`（`:57`）／contract 口径①`291`②`282`③`204`、后端注册 `1498`、`差集 1 条 其中具名豁免 1 条`（`:64-68`）／**`GATES_EXIT=0`（`:71`）** | 读数齐；⚠ 两处缺陷：① 无 `# 命令 + 时间戳` / `$ 命令` 头（协议 §六.4）；② vitest `Start at 22:37:27` **早于**实现笔提交 `22:38:39` ⇒ 读数采于「已定稿未提交」的工作树，**须负责人在尖端复跑回填** |
| `raw/70-build-h5.log` | **§三.2** `build:h5` | `> uni build -p h5`、`Compiler version: 5.23（vue3）`、`DONE Build complete.`、`BUILD_=0`（`:15`） | 读数可用；⚠ 退出标记丢了平台名（应为 `BUILD_H5_EXIT=0`）；⚠ 无 `#`/`$` 头；构建告警 `static/icons/hd-scan.svg … didn't resolve` 属基线在册形态 |
| `raw/70-build-mp-weixin.log` | **§三.2** `build:mp-weixin` | `> uni build -p mp-weixin`、`DONE Build complete.`、`import dist\build\mp-weixin run.`、`BUILD_=0`（`:15`） | 同上缺陷；告警 `custom-tab-bar 是 H5 专用组件` 属基线在册 |
| `raw/70-build-app.log` | **§三.2** `build:app` | `> uni build -p app`、`DONE Build complete.`、`import dist\build\app run.`、`BUILD_=0`（`:17`） | 同上缺陷；告警 `scan.ts is dynamically imported … but also statically imported by product-edit.vue` 属基线在册（本卡未动 `scan.ts`） |

产物路径按协议 §四.12 为 `app-mobile/dist/build/<h5|mp-weixin|app>`（gitignore，不入库）。

---

## 2. `anti/` —— 任务书 §二.7 反测 + §二.5 死包装去重

### 2.1 装置与前置件

| 文件 | 对应条目 | 作用 / 关键读数 | 状态 |
| --- | --- | --- | --- |
| `anti/at-inject.cjs` | **§二.7**（三组反测的注入装置，四轮共用） | 唯一注入器；硬闸三条：needle 命中数 `!==1 ⇒ exit(9)` 且不写一字节；注入后回读 `replace_hits===1` 校 `needle_gone`（AT3 例外，`:93`）失败 `exit(8)`；utf8 读写 + 按现场探测 CRLF 拼 needle。复原由驱动脚本 `cp` 完成（无 `sed -i`、无编辑器写回） | 入库可复跑 |
| `anti/00-pristine-sha.txt` | 协议 §四.3（SHA 必须标形态） | 原始态双形态：`products.ts worktree-crlf=3b0185ad…20cd` / `git-blob-lf=bec7f60b…7122`；`batch-price.vue worktree-crlf=git-blob-lf=ff2e2272…4f7f` | 完整；⚠ 仅原始态记双形态，**每轮未重复记 `git-blob-lf`**（弱件，见卡 §七.5） |
| `anti/pristine/products.ts` | 复原源 | AT1 / AT2b / AT3 三轮的 `cp` 还原件 | 完整 |
| `anti/pristine/batch-price.vue` | 复原源 | AT2 轮的 `cp` 还原件 | 完整 |

### 2.2 四轮日志（逐轮：注入确认 ⇒ 红 ⇒ 复原绿 ⇒ 台账）

| 轮 | 注入件 | 红件 | 绿件（复原后独立跑） | 台账件 | 对应任务书条目 | 关键读数 |
| --- | --- | --- | --- | --- | --- | --- |
| **R0 · AT1 作废（VOID）** | `anti/10-at1-inject.log` | —（未跑测试） | — | `anti/12-at1-round.log` | **§二.7** 第一轮次的首次尝试 | `NEEDLE_HITS=2` ⇒ `INJECT_ABORT … 不写一字节` ⇒ **`INJECT_EXIT=9`**；`anti/12:4` 原文 `VOID: injection failed`。SHA 前后同为 `3b0185ad…` 但**不构成复原证明**（根本没写入） |
| **R1 · AT1**（列表映射 `skuId` 来源改回 `r.spuId ?? r.id`） | `anti/20-at1-inject.log` | `anti/21-at1-red.log` | `anti/22-at1-green.log`（`Start at 22:44:24`，55 passed） | `anti/23-at1-round.log` | **§二.1/§二.6/§二.7**「把 `id` 改回 `spuId` ⇒ 多 SKU 用例红」 | `INJECT_EXIT=0`、`NEEDLE_HITS=1`、`replace_hits=1 needle_gone=true`、bytes `24634→24642`；`VITEST_EXIT=1`、**17 failed / 38 passed (55)**，反测靶 `E1 …（反测 AT1 靶）` 红于 `spec.ts:428:36`（`expect(STATIC.skuIdSourceLine).toBe(1)` ⇒ 0）；`SHA_BEFORE==SHA_AFTER=3b0185ad…`、`GIT_DIFF_BYTES=0`、`RESTORED_VITEST_EXIT=0`（55） |
| **R2 · AT2**（改价实参改回 `Number(p.spuId)`，去掉取号） | `anti/30-at2-inject.log` | `anti/30-at2-red.log` | `anti/30-at2-green.log`（`Start at 22:45:05`） | `anti/50-at2-at2b-rounds.log`（AT2 段） | **§二.4/§二.7**「把改价参数改回 SPU ⇒ 路径断言红」 | `INJECT_EXIT=0`、`NEEDLE_HITS=1`、bytes `51377→51318`；`VITEST_EXIT=1`、**1 failed / 54 passed**，红点 `E8 批量改价调用点恰好 1 处且必经 skuIdOfProduct 取号（反测 AT2 靶）` ⇒ `spec.ts:462:38`（`expect(STATIC.priceCallViaGuard).toBe(1)` ⇒ 0）；`SHA==ff2e2272…`、`GIT_DIFF_BYTES=0`、`RESTORED_VITEST_EXIT=0` |
| **R3 · AT2b**（`skuIdOfProduct` 本体改读 `spuId`） | `anti/40-at2b-inject.log` | `anti/40-at2b-red.log` | `anti/40-at2b-green.log` | `anti/50-at2-at2b-rounds.log`（AT2b 段） | **§二.4/§二.7** 运行期路径断言层（补 AT2 的静态层） | `INJECT_EXIT=0`、`NEEDLE_HITS=1`、bytes `24634→24618`；`VITEST_EXIT=1`、**3 failed / 52 passed**：`skuIdOfProduct：id 与 skuId 同值时返回真实 skuId`（`spec.ts:323:12`）、`skuIdOfProduct：id 被换成 spuId（维度混用）⇒ 抛错点名"不同值"`（`spec.ts:329:52`）、`updateSkuPrice 对同 SPU 的两个 SKU 打两条不同路径（不会写同一行）`（`spec.ts:358:28`，抛出点 `src/api/modules/products.ts:90:11`，报错原文 `Error: [SKU维度守卫] case: ProductInfo.id=41 与 skuId=7 不同值（疑似 spuId 顶替 SKU 主键）⇒ 拒发改价`）；`SHA==3b0185ad…`、`GIT_DIFF_BYTES=0`、`RESTORED_VITEST_EXIT=0` |
| **R4 · AT3**（把 `batchTrace(batchNo)` 注回数字 `:id` 路径） | `anti/60-at3-inject.log` | vitest：`anti/61-at3-red.log`；契约门：`anti/62-at3-contract-red.log` | vitest：`anti/63-at3-green.log`；契约门：`anti/64-at3-contract-green.log` | `anti/65-at3-round.log` | **§二.5/§二.7**「把 batchNo 注回数字 id 路径 ⇒ 红」＋ 死包装与 `batches.ts` 去重 | `INJECT_EXIT=0`、`NEEDLE_HITS=1`、`replace_hits=1 needle_gone=false`（**追加型注入，needle 原位保留**，见卡 §五 末说明）、bytes `24634→24843`；`VITEST_EXIT=1`、**1 failed / 54 passed**，红点 `E6 批次追踪死包装已从 products 模块消失（反测 AT3 靶）` ⇒ `spec.ts:450:31`（`expect(STATIC.batchTrace).toBe(0)` ⇒ 1）；**双读**：`CONTRACT_EXIT=1`、`差集 2 条 具名豁免 1 条`、`✗ 未豁免的契约缺口 1 条：/admin/products/batch/* ← app-mobile/src/api/modules/products.ts:632`（**注入态**行号）；`SHA==3b0185ad…`、`GIT_DIFF_BYTES=0`、`RESTORED_VITEST_EXIT=0` **且** `RESTORED_CONTRACT_EXIT=0`（`差集 1 / 豁免 1`，回到基线态） |

**注**：`anti/50-at2-at2b-rounds.log` 一份文件承载 R2 + R3 两轮台账（前代理合并落盘）；`§三.1` 的 `check:contract` 绿态另见 `raw/00:64-70`，与 `anti/64` 互相印证（同一口径①②③读数）。

---

## 3. `h5/` —— 任务书 §三.3、§三.4 的运行态装置（**未跑 ⇒ 判据未验**）

| 文件 | 对应条目 | 状态 |
| --- | --- | --- |
| `h5/mock-backend-qoder26.mjs` | **§三.3**（H5 双 SKU 夹具：列表两行、独立加购、详情同一 SPU）、**§三.4**（批量改价请求路径逐条实录真实 `skuId`） | **装置已在、读数全无**：`h5/` 目录内**没有** `mock-backend-qoder26.log`、没有 `price-hits.json`、没有 `dev-h5` 日志、没有任何 DOM/console/network 快照 ⇒ 两条运行态判据在卡 §四 一律记 **未验** |

### 3.1 夹具是什么（读代码可知，非推测）

基座沿用 `docs/evidence/qoder-11r/mock-backend.mjs`（登录 `me` `menus` 三端点 + `/__mock` 控制台），本文件**追加**商品域三条维度端点：

- 确定性夹具：**一个 SPU `id=7`**，**两个 SKU `id=41` / `id=42`**（同 `spuId=7`、不同 `skuCode`/`barcode`/五档价/库存），外加**第三条脏行** `{ skuId: null, skuCode: 'SPU007-BADROW', barcode: '6901000000043' }` ⇒ 用来实证「缺主键的行必须被映射层跳过」而不是拿 `skuCode`/条码凑身份。
- 字段名逐一对齐 `backend/src/services/admin/product.service.ts:258-301` 的 SELECT 别名（`p.id AS spuId`、`s.id AS skuId`、`pp.retail_price AS retailPrice`、`COALESCE(ib.available_qty,0) AS availableQty` 等），返回体是 `{ data: { records, total, page, pageSize } }`（与 `productsApi.list` 的 `raw?.records ?? raw?.list` 口径对得上，见 `src/api/modules/products.ts:465-477`）。
- 三条维度端点：`GET /api/admin/products`（列表，`keyword` 走后端语义）、`GET /api/admin/products/:id`（**只认 `id===7`**；喂 `41/42` 返回 **404** ⇒ 这正是「把 SKU 主键当 spuId」的运行态可见判据）、`PUT /api/admin/products/:skuId/price`（路径段 = 本卡要实证的真实 `skuId`，逐条写日志并覆盖写 `price-hits.json`）。

### 3.2 怎么跑（复验方式；命令由**负责人 / 复验代理**执行，本树未跑）

```bash
# 工作树根目录 D:/Users/ZXQL/wt-agents/QODER-26
# 1) 起 mock 后端（后台跑；读数落 docs/evidence/qoder-26/h5/mock-backend-qoder26.log）
MOCK_PORT=8461 node docs/evidence/qoder-26/h5/mock-backend-qoder26.mjs \
  > docs/evidence/qoder-26/h5/mock-start.log 2>&1 &

# 2) 起 H5 dev，把 /api 代理指向 mock（vite.config.ts:11/16-20 支持 VITE_PROXY_TARGET）
VITE_PROXY_TARGET=http://localhost:8461 npm --workspace app-mobile run dev:h5 \
  > docs/evidence/qoder-26/h5/dev-h5.log 2>&1 &

# 3) 浏览器（browser-use MCP）打开 dev 地址 → 登录（mock 任意口令）→ 走 §3.3 四个场景
```

⚠️ 三条注意（协议 §五、§四.8）：**必须串行**——不得与 QODER-25 的浏览器取证或负责人的门/构建复跑时间重叠（`import` 阶段可 ~200s，重叠会污染红/绿读数）；`take_screenshot` 历史上会超时，取不到就改用 **DOM 快照 + console + network 日志**并如实写明用了哪种；**绝对禁止**编造浏览器读数，拿不到就写「未取到 + 尝试过的命令 + 报错原文」。

### 3.3 需要取的**两侧**读数（缺一不可）

| # | 判据（任务书） | 前端侧读数（浏览器） | mock 侧读数（`h5/mock-backend-qoder26.log` / `price-hits.json`） | 通过形态 |
| --- | --- | --- | --- | --- |
| A | §三.3 列表两行 | DOM 快照：商品列表里「取证可乐」出现**两个卡片**，规格文案分别为 `500ml 瓶装`（零售 100 / 库存 10）与 `500ml*6 整箱`（零售 560 / 库存 8），且两张卡 `:key` 不同（控制台**无** duplicate/unique key 告警）；脏行 `SPU007-BADROW` **不得**出现在列表里 | `GET /api/admin/products?... -> 200 records=3 matched=… skuIds=[41,42,]` 一行（第三条 `skuId=null` 由前端映射层跳过，后端仍返回 3 条） | 前端两行（41/42）、后端三行；库存/价格逐行独立＝`10/100` 与 `8/560` 未合并 |
| B | §三.3 两行可独立加购 | 分别对两张卡加购 → 待选数量两处独立读数（DOM 上两行各自 1 件 / 各自行内数量），互不合并 | 无网络请求（加购为本地态）⇒ 以前端侧 + `network` 里无多余请求为证 | 两次加购落在**两个不同** `pendingPicks` 键（41 与 42），不是同一个 |
| C | §三.3 详情仍打开同一 SPU | 点任一卡 → 详情地址栏/路由 `?id=7`；两卡进入的是**同一**详情 URL | 两次 `GET_DETAIL path=/api/admin/products/7 spuId=7 skus=[41,42]`（**若出现 `products/41` 或 `products/42` ⇒ 该轮即失败**，mock 返回 404 并在 console 里可见） | 两条 `GET_DETAIL … spuId=7`，无 404 |
| D | §三.4 批量改价路径逐条真实 `skuId` | 批量改价页勾选两个规格提交；页面提示应为「成功 N 条」且 `console` 无 `[SKU维度守卫]` 抛错 | `PUT_PRICE path=/api/admin/products/41/price segment=41 body=…` 与 `…42/price segment=42 …` **各一行**（`price-hits.json` 里 `pathSegment` 数组恰为 `[41,42]`，**不得出现 `7`**） | 逐条路径段 = 真实 skuId；出现 `segment=7` ⇒ 写错对象，判红 |
| E（附加） | §二.4 守卫不发请求 | 用 `/__mock` 或直接构造脏行场景，console 出现 `改价未提交 id=… skuId=… spuId=… name=…` | mock 侧**没有**对应 `PUT_PRICE` 行（＝请求真的没发出去） | 抛错 + 0 请求，两者同时成立才算数 |

> 建议命名（复验落盘时）：`h5/80-dev-h5.log`、`h5/81-mock-backend.log`、`h5/82-price-hits.json`、`h5/83-dom-products.txt`、`h5/84-dom-detail.txt`、`h5/85-console.txt`。落盘后同步更新本 README §3 表格与卡 §四 判据 3/4 的自评。

---

## 4. 证据纪律偏差登记（如实，不替它补话）

1. **全部 `raw/`、`anti/` 日志缺 `# <做什么> <时间戳>` 与 `$ <命令>` 头**（协议 §六.4）。收尾代理受「不得改写前代理原始日志」约束未补，只能靠日志内 npm banner / `INJECT_CASE=` 行反推命令。
2. **三构建退出标记写成 `BUILD_=0`**（变量名拼接丢平台 token）⇒ 标记不含平台名，命令身份需靠 banner 行区分。
3. **`raw/00` 门读数采于实现笔提交前约 72 秒**（`22:37:27` vs `22:38:39`）⇒ 属「同一内容、未提交态」读数，**须负责人在 `3228ffc5` 尖端复跑回填**（卡 §三 已留占位）。
4. **每轮未重复记 `git-blob-lf` 形态 SHA**，仅原始态记了一次；四轮的同形态（`worktree-crlf`）SHA 对全部相等，未跨形态比较（符合协议 §四.3 字面，属弱件而非违规）。
5. **AT1 存在一个作废轮（R0，`INJECT_EXIT=9`）**：按协议 §四.1 该轮**不计入反测交付**，另立在 §2.2 首行与卡 §五 R0，原始日志一字未改。
6. **AT3 的 `needle_gone=false`**：追加型注入使 needle 原位保留，注入器 `at-inject.cjs:93` 显式按 case 分流。是否算「回读校验被放宽」**待负责人裁**（卡 §八.5）。
7. **`gates-baseline.json` 的「旧 note 是新 note 的前缀」机检无 raw 件**，结论挂在「负责人复验」口径上（卡 §七.2）。
8. **入库形态提示（影响 SHA 复现）**：本仓 `core.autocrlf=true` ⇒ `git add` 时 git 明确警告这些 LF 文件「will be replaced by CRLF next time Git touches it」，即 **入库 blob 被归一为 LF，检出后工作树为 CRLF**。四轮台账里的 `worktree-crlf` SHA（`3b0185ad…` / `ff2e2272…`）**只能在 CRLF 检出的工作树里复现**；若复验方在 `core.autocrlf=false` / `input` 的环境里比对，请先按协议 §四.3 换算到同形态（`git-blob-lf` 参考值只记在 `anti/00-pristine-sha.txt`），**不得跨形态判「SHA 不等」为复原失败**。另注：`anti/pristine/*` 两份备份件本轮首次入库，其字节内容与前代理 `cp` 还原时所用件一致（还原后 `SHA==` 且 `GIT_DIFF_BYTES=0` 已逐轮实测）。

## 5. 本笔（文档笔）纳入的文件

同一笔提交内容 = 上述 28 份原始件（**首次纳入 git**，此前为未跟踪目录）+ 本 `README.md` + `docs/tasks/cards/R101-QODER-26-回传.md` + `docs/tasks/inbox/ACTIVE-回执-QODER-26.md`。逐文件 `git add`，未用 `git add -A` / `git add .`；`app-mobile/**` 未重复纳入（实现笔已完成）。

## 6. 负责人复验补笔（2026-10-21T23:24+08:00）——本 README §2/§3 的"H5 缺口"已闭合

新增件（本笔纳入，逐文件 `git add`）：

| 文件 | 内容 | 对应判据 |
| --- | --- | --- |
| `raw/80-owner-gates-and-builds.log` | 负责人同树亲跑四门与三构建的原始输出，含带平台名的 **`BUILD_EXIT_h5=0` / `_mp-weixin=0` / `_app=0`**（修正 §1 表中 `BUILD_=0` 的变量踩空）与 `GATES_EXIT=0`（12/241） | §三.1、§三.2 |
| `h5/owner-h5-readings.log` | H5 运行态 A–E 五场景的采集命令 + 前端侧 DOM/console 读数 + mock 侧日志行逐字转录；E 段如实记「UI 不可构造 ⇒ 运行态未验」 | §三.3、§三.4 |
| `h5/mock-backend-qoder26.log` | 夹具侧请求原文：`records=3 matched=3 skuIds=[41,42,]`、两次 `GET_DETAIL … spuId=7`（零 404）、两条 `PUT_PRICE … segment=41/42` | §三.3-①③、§三.4 |
| `h5/price-hits.json` | 判据 4 的机读读数源：`pathSegment` 恰为 `[41,42]`，**无 7** | §三.4 |
| `h5/dev-h5-owner.log`、`h5/mock-start-owner.log` | `dev:h5`（5174，因 5173 被占）与 mock（8461）的启动读数 | 复现链路 |

判据表口径变化（追加说明，不回改 §2/§3 原句——原句在落笔当时准确）：**§三.3 与 §三.4 由「未验」改为「达标（运行态实测，两侧读数齐）」**；§二.4 守卫的"抛错 + 0 请求"仍为**运行态未验（UI 不可构造）**，依据只在单元层 `spec.ts:358/:366`。
