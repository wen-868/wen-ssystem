# R101-QODER-26 回传卡 · SKU/SPU 维度与路径参数（MO-22/23）

汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-21

> 任务书：`docs/tasks/inbox/QODER-26-sku-dimension.md`
> 执行协议：`D:\Users\ZXQL\wt-agents\_qoder23-26-exec-protocol-20261021.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-26`｜分支：`fix/qoder-26-sku-dimension`｜基线：`bc1087ee`
> **本卡是执行方自评 + 待裁项清单，不含任何验收方判词**（不写「裁定／验收通过／准予合并」）。
> 本笔文档提交由**收尾子代理**落盘（实现与绝大部分取证由前一个子代理完成，前代理在 150 轮上限处中断，详见 §九）。

---

## 一、基线与提交（全部 `git rev-parse` 实测，非臆写）

| 项 | 值 | 实测命令 / 出处 |
| --- | --- | --- |
| 共同基线 | `bc1087eec4b880827518444be36f5874e330e1d3` | `git rev-parse bc1087ee`（收尾代理现场执行） |
| 分支 | `fix/qoder-26-sku-dimension` | `git rev-parse --abbrev-ref HEAD` |
| 实现笔（唯一代码笔） | `3228ffc543f841c6f768a4e10d19a41dfae89f90`<br>`fix(mobile): QODER-26 商品域 SKU/SPU 维度分离与路径参数收口`<br>父提交 = `bc1087ee`（`git log --oneline -2` 可核） | `git rev-parse HEAD`（本卡撰写时 HEAD 即此笔）；`git show --stat 3228ffc5` |
| 实现笔规模 | 8 文件 `+758 / −73`（`git diff --numstat bc1087ee..HEAD` 逐文件求和 = `+758 -73`） | 见 §二 文件清单 |
| 本卡文档笔 | **不落死值**：本卡 + 回执 + 证据树为同一笔 `docs: QODER-26 回传卡 + 回执 + 证据树`，哈希请用 `git rev-parse HEAD`（提交后）现场实测；数值已在收尾回传正文给出 | 协议 §四.4「不许给还不存在的东西预先写哈希」 |
| `git diff bc1087ee..HEAD -- backend/` | **0 字节**（收尾代理现场重测：`git diff bc1087ee..HEAD -- backend/ \| wc -c` ⇒ `0`） | 任务书 §三.5、协议 §二.2 |
| 工作树（文档笔之前） | `git status --porcelain` ⇒ 仅 `?? docs/evidence/qoder-26/`（前代理证据目录未跟踪，随本笔一并纳入），无 `M` 无残留 | 收尾代理现场执行 |
| `node_modules` | 复用树内既有真实目录，**未执行 `npm install`**，未建 junction | 协议 §三 |

改动文件全集（`git show --stat 3228ffc5`）：

```
app-mobile/scripts/gates-baseline.json                        |   6 +-
app-mobile/src/api/modules/products.ts                        | 261 ++++++++---
app-mobile/src/pages-sub/product/batch-price/batch-price.vue  |  10 +-
app-mobile/src/pages-sub/product/price-review/price-review.vue|   2 +-
app-mobile/src/pages/home/home.vue                            |   7 +-
app-mobile/src/pages/products/products.vue                    |  20 +-
app-mobile/src/pages/sales/create-sale.vue                    |  13 +-
app-mobile/tests/product-sku-dimension.spec.ts                | 512 +++++++++++++++++++++
```

---

## 二、逐条实现说明（对应任务书 §二 七条；行号 = HEAD `3228ffc5` 现场核对）

### ① 交付物 1：`ProductInfo` 拆 `id` / `spuId` / `skuId`，列表映射不得再用 SPU 顶替 SKU

- `app-mobile/src/api/modules/products.ts:270` `export interface ProductInfo`；`:277 id: number`（**SKU 行主键**，注释点名根因是原 `id: r.spuId ?? r.id`）、`:279 spuId: number`（SPU 主键，进详情用）、`:281 skuId: number`（SKU 主键，`:skuId/price` 与 `skus/:skuId` 只认它）。三字段各自带 JSDoc 维度说明。
- 映射函数：`:335 mapProductRecords(records)`；`:339 const skuId = toNumericId(r.skuId)`、`:340 const spuId = toNumericId(r.spuId)`、**`:353 id: skuId`**。原缺陷写法 `id: r.spuId ?? r.id` 在本文件**代码行**里已不存在（仅作为**注释里的根因说明**保留，静态负向门在「剥注释后的代码视图」上求值 ⇒ 同类写法注回真代码行照样判红，见 §五 AT1）。
- `:342-347` 缺正整数 `skuId` 的行**跳过并写守卫日志**（日志正文点名「不得用 spuId/skuCode/barcode/name 顶替 SKU 主键」）；`:348-351` 同 `skuId` 重复只保留首行（防 JOIN 放大，**不做跨行合并**）。原基线的「按 spuId 合并 + 跨 SKU 累加库存」逻辑整段废除。

### ② 交付物 2：列表 `:key`、加购去重、待选数量、销售明细 `productId` 全用 SKU `id`

- `app-mobile/src/pages/products/products.vue:83` `:key="item.id"`（SKU 行主键，`:84` 跳转改喂 spuId，见 ③）。
- `app-mobile/src/pages-sub/product/price-review/price-review.vue:27` `:key` 由基线的 `item.skuId` **收口为 `item.id`**（本卡定的身份字段只有一个）。
- `app-mobile/src/pages/sales/create-sale.vue:1808` `const newSkuId = Number(created?.skuId ?? created?.data?.skuId ?? 0)`；`:1818` 待选数量定位改为 `productList.value.find((x) => Number(x.skuId) === newSkuId)`；`:1819` `pendingPicks[target.id] = 1`。
  **同时删掉了基线的名称兜底** `const targetId = newId || (productList.value.find(p => p.name === name)?.id ?? 0)`（拿名称当身份＝本卡红线，禁止）；找不到行时提示改为「商品已创建，请在列表中手动选择该规格」，不再假装选中。依据：`backend/src/services/admin/product.service.ts:513` `return { id: spuId, spuId, skuId: firstSkuId, spuCode }` ⇒ `created.id` 是 SPU、`created.skuId` 才是待选行主键。
- 加购去重/销售明细 `productId` 沿用 `pendingPicks[SKU 行 id]` 路径，未新增身份字段；由静态门 `E12`（`tests/product-sku-dimension.spec.ts:481`）与 `E13`（`:487`「销售页不得再用名称当身份定位新商品」）钉住。

### ③ 交付物 3：点商品卡 / 扫码进详情仍用 `spuId`（对齐 `GET /admin/products/:spuId`）

- `products.vue:84` `@tap="goDetail(item.spuId)"`；`:277 function goDetail(spuId: number)`，`:278-282` 加「缺 SPU 主键」兜底（不猜、不用 SKU 主键兜底）；`:329` 扫码命中后 `goDetail(matched.spuId)`。函数上方注释写明后端注册出处（`admin-product.routes.ts:46`）。
- `home.vue:480-484`：`if (matched.spuId > 0) navigateTo(...id=${matched.spuId})` `else` 补「该商品缺少 SPU 主键，无法打开详情」toast。
- api 层参数名收口：`products.ts:110 getProductDetail(spuId)` 先 `assertSpuId`（`:111`）、`:480 productsApi.detail(spuId)` 先 `assertSpuId`（`:481`）、`:120 updateProduct(spuId)`、`:189 setMarketingTags(spuId)` 同样先过 SPU 守卫。

### ④ 交付物 4：`updateSkuPrice` 必须拿真实 `skuId`，加守卫防 `id/spuId/skuId` 混用

- 守卫三件套：`products.ts:48 toNumericId`（只有正整数算有效身份；`NaN`/`0`/负数/编码串一律归 0＝无效）、`:58 assertSkuId`、`:71 assertSpuId`、`:87 skuIdOfProduct(p, ctx)`——**先 `assertSkuId(p.skuId)`，再校验 `p.id === skuId`，不同值即抛错**（＝拒发改价，请求根本不发出去，不会写错对象）。
- `:142-144 updateSkuPrice(skuId, data)` 入参先 `assertSkuId` 再拼路径；`:158-160 updateSku`、`:190-191 setMarketingTags` 同形态。
- 守卫读数不用 `console`：`:34 export const skuGuardLog: string[]`（`:36-40` 200 条环形缓冲）+ 抛错。原因：`gates-baseline.json` 的 `lint.warningsByRule.no-console` 冻结 225 条，新增任一 `console.*` 会让 lint 门红，而红线禁止动 `lint.*`。页面侧打印复用**既有** catch 分支——`batch-price.vue:853` 把原 `console.error('更新商品 … 价格失败')` 改写为**同一条** console 语句里带 `id=/skuId=/spuId=/name=` 四个读数（该文件 console 条数不变）。
- 调用点：`batch-price.vue:360` 导入 `skuIdOfProduct`；`:844 const skuId = skuIdOfProduct(p, \`batch-price 第${i+1}笔\`)`；`:845 await updateSkuPrice(skuId, payload)`。基线的 `updateSkuPrice(Number(p.id), payload)` 裸传已消除。
- 后端出处逐条注释在 `products.ts:15-32` 区块头（每条都注了 routes + controller 行号），收尾代理已逐行回查后端原文，**六条全部准确**：

| 注释引用 | routes 实测 | controller 实测 | 维度 |
| --- | --- | --- | --- |
| `admin-product.routes.ts:35` GET `/products` | `:35 listProducts` ✓ | `product.service.ts:259-273` `SELECT p.id AS spuId … s.id AS skuId … FROM t_product_sku s` ✓ | SKU 粒度 |
| `:46` GET `/products/:spuId(\d+)` | `:46` ✓ | controller `:36` `Number(req.params.spuId)` ✓ | SPU |
| `:60` PUT `/products/:id` | `:60` ✓ | controller `:118` `const spuId = Number(req.params.spuId)` ✓ | SPU |
| `:63` PUT `/products/:skuId/price` | `:63` ✓ | controller `:256` `const skuId = Number(req.params.skuId)` ✓ | SKU |
| `:69` PUT `/products/skus/:skuId` | `:69` ✓ | controller `:152` `const skuId = Number(req.params.skuId)` ✓ | SKU |
| `:74` PUT `/products/:spuId/marketing-tags` | `:74` ✓ | controller `:296` `Number(req.params.spuId)` ✓ | SPU |

### ⑤ 交付物 5：`batchTrace` 死包装处置 = 删除 + 与既有正确封装去重

- 基线态：`bc1087ee:app-mobile/src/api/modules/products.ts:355-357` `async batchTrace(batchNo: string)` 把**批次号字符串**塞进要求数字批次 id 的路径段 `/admin/inventory-batch/batches/${batchNo}/trace`；`git grep -n batchTrace bc1087ee -- app-mobile admin-web saas-admin` ⇒ **src 内 0 个调用点**（唯一命中是 `app-mobile/docs/…审查清单-2026-10-18.md:76` 的 MO-23 条目文本）。
- 本卡处置：**整段删除**该包装（任务书 §二.5 的第一条路线）。HEAD 全仓 `batchTrace` 只剩 `tests/product-sku-dimension.spec.ts:161`（静态负向门的计数对象）与 `:450`（断言为 0），src 内 0 处。
- 唯一在册封装保留在 `app-mobile/src/api/modules/batches.ts:108 async trace(id: number)`（`:110` 路径 `/admin/inventory-batch/batches/${id}/trace`），由 `E7`（`spec.ts:455`）钉住「未长成第二份封装」⇒ 满足「若保留必须与既有正确封装去重」。

### ⑥ 交付物 6：映射单测（同 SPU 两 SKU ⇒ 两个不同 `id`、`spuId` 相同、`skuId` 各自正确）

- 新增 `app-mobile/tests/product-sku-dimension.spec.ts`（512 行，**55 用例**，vitest 实测读数见 `raw/00-check-gates.log` 第 28 行与 `anti/22-at1-green.log`）。分组：
  - `A · 列表映射是 SKU 粒度`（`:212`）8 用例 ⇒ 含判据点名的三条：`返回 2 行（不得再按 spuId 合并成 1 行）`（`:215`）、`两行 id 互不相同，且等于各自的 SKU 行主键`（`:219`）、`两行 spuId 相同（详情维度仍是同一个 SPU）`（`:224`）、`两行 skuId 各自正确（与 id 同值，不再是 skuCode）`（`:228`）。
  - `B · 无效 SKU 主键的行被跳过并留守卫日志`（`:263`）6 用例；`C · 维度守卫行为`（`:307`）13 用例（含 2 个 `it.each` 展开 6+3）；`D · 路径参数实证`（`:345`）11 用例（`updateSkuPrice(41)` ⇒ PUT `/admin/products/41/price`、同 SPU 双 SKU 打两条不同路径、无效主键 ⇒ 0 次 PUT 等）；`E · 静态源门`（`:426`）17 用例（E1/E6/E8 即三组反测靶）。
  - 静态扫描按协议 §四.7 在 **import 阶段**求值（`STATIC` 常量在 `:150-170` 一带定义），`it` 体内只做常数比较 ⇒ 无 5000ms 随机假红。
- `gates-baseline.json`：仅 `tests` 段变动 `testFiles 11→12`、`testCount 186→241`，`note` 末尾追加 QODER-26 一段（署名 + 55 用例来源拆解 + 注释口径说明）；`_comment / typeCheck / lint / checkContract / contractDrift` 四段与基线**逐字相同**（`git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json` ⇒ 只有 `tests` 三个字段 + note）。
  机检「旧 note 是新 note 的前缀」（`new.startsWith(old)`）由**负责人独立复核**完成 ⇒ 本代理未重跑该脚本（协议 §约束：本代理禁跑 node），引用为「负责人复验」。

### ⑦ 交付物 7：三组反测（每轮复原后绿）

见 §五 台账。要点：AT1＝把列表映射的 `skuId` 来源改回 `r.spuId ?? r.id` ⇒ 17 用例红；AT2＝批量改价实参改回 `Number(p.spuId)` ⇒ 静态源门 E8 红；AT2b＝`skuIdOfProduct` 本体改读 `spuId` ⇒ 运行期路径断言（D 组）3 用例红；AT3＝把 `batchNo` 字符串包装注回数字 `:id` 路径 ⇒ E6 红 **且** `check:contract` 红（双读）。四轮全部 `cp` 复原、SHA 对相等、复跑 EXIT=0。

---

## 三、门 · 构建 · 守卫读数（引用证据文件名）

> **门读数占位声明**：（负责人复验值待回填：见 §三 备注）。本代理**未运行任何门/构建/测试命令**（负责人正在同一棵树内亲跑 `check:gates` 与三构建，并发 CPU 负载会造成 5000ms 假红、污染双方读数）。下列数字**全部转录自前代理已落盘的原始日志**，文件名与行号逐条标注；「负责人复验」栏由负责人回填后本卡才算终态。

### 3.1 四门串跑 `npm --workspace app-mobile run check:gates` → 出处 `docs/evidence/qoder-26/raw/00-check-gates.log`

| 门 | 原始读数（转录） | 日志位置 |
| --- | --- | --- |
| type-check | `vue-tsc EXIT=0，当前错误 0 条，基线 0 条` ⇒ `✓ 无新增类型错误 ⇒ EXIT=0` | `raw/00:10-11` |
| lint | `当前 error 0（基线 0）、warning 12872（基线 12872）` ⇒ `✓ 无新增 error、warning 未劣化 ⇒ EXIT=0` | `raw/00:17-18` |
| test | `12 passed (12)` / `241 passed (241)`，其中 `tests/product-sku-dimension.spec.ts (55 tests)`；`—— test 门（用例数冻结）：当前 12 文件 / 241 用例，基线 12 / 241 ——` ⇒ `EXIT=0` | `raw/00:28,52-53,57-58` |
| check:contract | 口径① `291`、② `282`、③ `204`、后端注册端点 `1498`、`差集（调用有、注册无）: 1 条，其中具名豁免 1 条` ⇒ `✓ EXIT=0` | `raw/00:64-70` |
| 合计 | `GATES_EXIT=0` | `raw/00:71` |
| 时间戳 | vitest `Start at 22:37:27` | `raw/00:54` |

⚠️ **如实报备（时序）**：`raw/00` 的 vitest 起始 `22:37:27` **早于**实现笔 `3228ffc5` 的提交时间 `22:38:39`（`git show -s --format=%ad 3228ffc5`）⇒ 该门读数是在**已定稿但尚未提交**的工作树内容上采得，不是「提交后复跑」。日志本身没有 `# 命令 + 时间戳` 头（见 §七.3），因此「门读数 == 提交态」这件事**无法只从 raw/00 自证**。本代理判定这属**须由负责人复验补齐**的一项，不替它补话。

### 3.2 三构建 → 出处 `docs/evidence/qoder-26/raw/70-build-*.log`

| 构建 | 原始读数（转录） | 日志 |
| --- | --- | --- |
| `build:h5` | `Compiler version: 5.23（vue3）`、`DONE Build complete.`、`BUILD_=0` | `raw/70-build-h5.log:5,14-15` |
| `build:mp-weixin` | `DONE Build complete.`、`Run method: open Weixin Mini Program Devtools, import dist\build\mp-weixin run.`、`BUILD_=0` | `raw/70-build-mp-weixin.log:13-15` |
| `build:app` | `DONE Build complete.`、`Run method: open HBuilderX, import dist\build\app run.`、`BUILD_=0` | `raw/70-build-app.log:15-17` |

⚠️ **如实报备（证据缺陷）**：三份日志的退出标记都写成 **`BUILD_=0`**（驱动脚本里的平台变量名在拼接时丢了 ⇒ 标记本身不含平台名）。命令身份只能靠日志内的 npm banner（`> uni build -p h5` / `-p mp-weixin` / `-p app`）区分。读数 `DONE Build complete.` 与 `=0` 齐备，但**标记命名不合规**，登记为缺件（§七.4），不得当作已规范的出厂证据。
构建期告警（非失败，转录）：h5 侧 `static/icons/hd-scan.svg … didn't resolve at build time`；mp-weixin 侧 `custom-tab-bar 是 H5 平台专用组件` 提示；app 侧 `scan.ts is dynamically imported by … but also statically imported by product-edit.vue`。三笔都是基线在册形态，本卡未触碰相关文件。

### 3.3 守卫读数（`gates-baseline.json` 四段不动）

- `git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json`（收尾代理现场执行）⇒ 变更仅在 `"tests"` 节内：`testFiles 11→12`、`testCount 186→241`、`note` 末尾追加一段；`_comment / typeCheck / lint / checkContract / contractDrift` 四段**零 hunk**。
- `raw/00` 的 lint 行 `warning 12872（基线 12872）` ⇒ no-console 等冻结值未被上调（守卫改走 `skuGuardLog` + 抛错，见 §二.④）。
- `raw/00` 的 contract 行 `差集 1 条 / 具名豁免 1 条` = 基线同值（协议 §三 基线态）⇒ 本卡**未新增**契约缺口；AT3 注入时该门立刻变红（`anti/62-at3-contract-red.log`：差集 2 条、未豁免 1 条 `/admin/products/batch/*` ← `products.ts:632`，该 632 行是**注入态**文件的行号），复原后回到 `差集 1 / 豁免 1 / EXIT=0`（`anti/64-at3-contract-green.log`）。

---

## 四、判据自对账（任务书 §三 硬验收逐条；自评 + 依据，不作裁定）

| # | 任务书 §三 判据 | 自评 | 依据（文件:行 / 证据） |
| --- | --- | --- | --- |
| 1 | `npm --workspace app-mobile run check:gates` EXIT=0 | **通过（待负责人复验回填）** | `raw/00-check-gates.log:71 GATES_EXIT=0`；四门逐条读数见 §3.1。⚠ 时序缺陷见 §3.1 末（读数采于提交前 72 秒的工作树）；本代理未复跑（禁跑约束） |
| 2 | `build:h5` / `build:mp-weixin` / `build:app` 均 EXIT=0 | **通过（标记形态不合规）** | `raw/70-build-h5.log` / `70-build-mp-weixin.log` / `70-build-app.log`，三份均 `DONE Build complete.` + `BUILD_=0`；退出标记未带平台名 ⇒ 登记 §七.4 |
| 3 | H5 用两个同 SPU 不同 SKU 的确定性夹具完成：列表两行、两行可独立加购、详情仍打开同一 SPU | **未验** | 夹具已落盘 `docs/evidence/qoder-26/h5/mock-backend-qoder26.mjs`（SPU=7、SKU=41/42 + 1 条缺主键脏行），但 **`h5/` 目录内没有 `mock-backend-qoder26.log`、没有 dev:h5 日志、没有 DOM/console/network 读数** ⇒ 运行态三件事没有任何原始读数可引。单元层等价证据（不替代运行态）：`spec.ts:215/219/224/228`（两行两 id 同 SPU）、`spec.ts:414`（点卡 `spuId` 与加购 `id` 是两个不同读数）。原因与复验方式见 §七.1 与 `docs/evidence/qoder-26/README.md` |
| 4 | 批量改价请求路径逐条记录为真实 `skuId`；不得只看 UI 成功提示 | **部分通过 / 运行态未验** | 已做到的层：单测逐条路径实证 `spec.ts:346`（`updateSkuPrice(41)` ⇒ `/admin/products/41/price`）、`spec.ts:354`（同 SPU 两 SKU ⇒ 两条不同路径）、`spec.ts:366`（无效主键 ⇒ 0 次 PUT）；静态源门 `E8 spec.ts:460-463`；反测 AT2/AT2b 红点复现（`anti/30-at2-red.log`、`anti/40-at2b-red.log`）。**未做到的层**：真实浏览器里逐条 PUT 请求路径的网络读数（`mock-backend-qoder26.mjs:8` 把该日志设计成本卡判据 4 的读数源，但脚本从未跑过）。按协议 §二.4「不得把静态类型通过当多规格运行通过」⇒ 只能记 **未验** |
| 5 | `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean | **通过** | 收尾代理现场实测 `= 0` 字节；文档笔之前 `git status --porcelain` 仅 `?? docs/evidence/qoder-26/`（本笔纳入）；文档笔之后 `git status --porcelain` 空（值见 §一 与收尾回传正文） |

任务书 §二 七条交付物自评：1 **通过**／2 **自评通过（静态+单测层；运行态随判据 3 未验）**／3 **通过**／4 **通过**／5 **通过（删除路线 + 与 `batches.ts:108` 去重）**／6 **通过（55 用例）**／7 **通过（三组四子轮全部红且复原绿，AT1 首轮作废另立 §五 R0）**。

---

## 五、反测轮次台账

注入装置（唯一、四轮共用、入库可复跑）：`docs/evidence/qoder-26/anti/at-inject.cjs`（`.cjs` 形态，utf8 读写、needle 命中数 ≠1 ⇒ `process.exit(9)` 且不写一字节、注入后回读校验 ⇒ 协议 §四.1 三件套齐）。复原：驱动脚本用 **`cp`** 从树外备份恢复，未用 `sed -i`、未用编辑器写回。

| 轮 | 注入命中（原始行） | `INJECT_EXIT` | 红点用例名 + `文件:行号` | `SHA_BEFORE` / `SHA_AFTER` | 复原复跑 | 归类 |
| --- | --- | --- | --- | --- | --- | --- |
| **R0 · AT1（作废）** | `INJECT_CASE=AT1 FILE=…/products.ts EOL=CRLF NEEDLE_HITS=2`（`anti/10-at1-inject.log:1`）⇒ 硬闸触发 `INJECT_ABORT needle hits !== 1 ⇒ 不写一字节`（`:2`） | **9**（`anti/10:3`、`anti/12:3`） | 无（未跑 vitest） | `3b0185ad…cd` / `3b0185ad…cd`，`BYTE_IDENTICAL=true`（`anti/12:2,5,6`）——文件未被写入，SHA 相等**不构成复原证明** | 未跑 | **VOID（本轮反测作废）**；`anti/12-at1-round.log:4` 原文 `VOID: injection failed`。根因＝needle `const skuId = toNumericId(r.skuId)` 当时在文件里出现 2 次 ⇒ 命中数不符，注入器按硬闸拒写。**本轮不计入交付物 7**，另立 note 于本行 |
| **R1 · AT1**（列表映射 `skuId` 来源改回 `r.spuId ?? r.id`） | `NEEDLE_HITS=1`、`INJECT_READBACK replace_hits=1 needle_gone=true bytes_before=24634 bytes_after=24642`、`INJECT_OK`（`anti/20-at1-inject.log:1-3`） | **0**（`anti/23:3`） | `VITEST_EXIT=1`（`anti/23:7`），**17 failed / 38 passed (55)**（`anti/21-at1-red.log:398-399`）。红点（名字 + 断言行，全部 `app-mobile/tests/product-sku-dimension.spec.ts`）：`返回 2 行（不得再按 spuId 合并成 1 行）`:216、`两行 id 互不相同，且等于各自的 SKU 行主键`:220、`两行 spuId 相同（详情维度仍是同一个 SPU）`:225、`两行 skuId 各自正确（与 id 同值，不再是 skuCode）`:229、`库存按各自 SKU 行读数，不跨规格累加`:239、`五档价格按各自 SKU 行读数（改价/核价才不会串档）`:246、`其余派生字段逐行独立（预警阈值/规格文案未被合并）`:254、`缺 skuId 的行被丢弃（即便带 skuCode 也不拿来当 id）`:266、`丢弃时写守卫日志，点名不得用 spuId/skuCode/barcode/name 顶替`:271、`后端把 BIGINT 序列化成数字字符串时仍可判定为主键`:293、`skuCode/条码形态字符串一律判为无效主键`:299、`skuIdOfProduct：id 与 skuId 同值时返回真实 skuId`:323、`skuIdOfProduct：id 被换成 spuId（维度混用）⇒ 抛错点名"不同值"`:329、`updateSkuPrice 对同 SPU 的两个 SKU 打两条不同路径（不会写同一行）`:360、`productsApi.list ⇒ GET /admin/products 并返回两行 SKU（id 41/42、spuId 同为 7）`:398、`点卡片用的 spuId 与加购用的 id 是两个不同读数（同 SPU 双 SKU 夹具）`:419、**反测靶 `E1 列表映射的 SKU 主键来源行恰好 1 处（反测 AT1 靶）`:428**（`expect(STATIC.skuIdSourceLine).toBe(1)` ⇒ Received 0） | `3b0185ad71f01bb03d280e0e27933ef3ffead79eeb913ef87080af086eb720cd` == 同值（`anti/23:2,27`，形态标 `worktree-crlf`），`BYTE_IDENTICAL=true`（`:28`），`GIT_DIFF_BYTES=0`（`:29`） | `RESTORED_VITEST_EXIT=0`、`55 passed (55)`（`anti/23:30-32`）；独立绿证 `anti/22-at1-green.log`（`Start at 22:44:24`，55 passed） | **完整、达标** |
| **R2 · AT2**（改价实参改回 `updateSkuPrice(Number(p.spuId), payload)`，去掉 `skuIdOfProduct` 取号） | `INJECT_CASE=AT2 FILE=…/batch-price.vue EOL=CRLF NEEDLE_HITS=1`、`replace_hits=1 needle_gone=true bytes 51377→51318`、`INJECT_OK`（`anti/30-at2-inject.log:1-3`） | **0**（`anti/50:3`） | `VITEST_EXIT=1`（`anti/50:7`），**1 failed / 54 passed (55)**：反测靶 **`E8 批量改价调用点恰好 1 处且必经 skuIdOfProduct 取号（反测 AT2 靶）`** ⇒ 断言 `expect(STATIC.priceCallViaGuard).toBe(1)` 在 `app-mobile/tests/product-sku-dimension.spec.ts:462:38` 红（Received 0；`anti/30-at2-red.log` 尾部） | `ff2e2272540b955c7280308399cdb3b8689774a55ffecbf5c8a160c5fe874f7f` == 同值（`anti/50:2,11`），`BYTE_IDENTICAL=true`（`:12`），`GIT_DIFF_BYTES=0`（`:13`） | `RESTORED_VITEST_EXIT=0`、`55 passed`（`anti/50:14-16`）；独立绿证 `anti/30-at2-green.log`（`Start at 22:45:05`） | **完整、达标** |
| **R3 · AT2b**（`skuIdOfProduct` 本体改读 `p?.spuId` ⇒ 运行期路径断言必红） | `INJECT_CASE=AT2b FILE=…/products.ts NEEDLE_HITS=1`、`replace_hits=1 needle_gone=true bytes 24634→24618`、`INJECT_OK`（`anti/40-at2b-inject.log:1-3`） | **0**（`anti/50:19`） | `VITEST_EXIT=1`（`anti/50:23`），**3 failed / 52 passed (55)**：`skuIdOfProduct：id 与 skuId 同值时返回真实 skuId` ⇒ `spec.ts:323:12`；`skuIdOfProduct：id 被换成 spuId（维度混用）⇒ 抛错点名"不同值"` ⇒ `spec.ts:329:52`；`updateSkuPrice 对同 SPU 的两个 SKU 打两条不同路径（不会写同一行）` ⇒ `spec.ts:358:28`，抛出点 `app-mobile/src/api/modules/products.ts:90:11`（**注入态**行号，报错原文 `Error: [SKU维度守卫] case: ProductInfo.id=41 与 skuId=7 不同值（疑似 spuId 顶替 SKU 主键）⇒ 拒发改价`，见 `anti/40-at2b-red.log`） | `3b0185ad…cd` == 同值（`anti/50:18,29`），`BYTE_IDENTICAL=true`（`:30`），`GIT_DIFF_BYTES=0`（`:31`） | `RESTORED_VITEST_EXIT=0`、`55 passed`（`anti/50:32-34`）；独立绿证 `anti/40-at2b-green.log`（`Start at 22:45:24` 之后的绿态） | **完整、达标** |
| **R4 · AT3**（把 `batchTrace(batchNo)` 字符串包装注回数字 `:id` 路径段） | `INJECT_CASE=AT3 FILE=…/products.ts NEEDLE_HITS=1`、`replace_hits=1 needle_gone=false bytes 24634→24843`、`INJECT_OK`（`anti/60-at3-inject.log:1-3`） | **0**（`anti/65:3`） | 双读：**（a）vitest** `VITEST_EXIT=1`，**1 failed / 54 passed (55)** ⇒ 反测靶 **`E6 批次追踪死包装已从 products 模块消失（反测 AT3 靶）`** 断言 `expect(STATIC.batchTrace).toBe(0)` 在 `spec.ts:450:31` 红（Received 1；`anti/61-at3-red.log`）。**（b）契约门** `CONTRACT_EXIT=1`、`差集 2 条，其中具名豁免 1 条`、`✗ 未豁免的契约缺口 1 条：/admin/products/batch/* ← app-mobile/src/api/modules/products.ts:632`（`anti/62-at3-contract-red.log:10-14`；632 是**注入态**行号） | `3b0185ad…cd` == 同值（`anti/65:2,15`），`BYTE_IDENTICAL=true`（`:16`），`GIT_DIFF_BYTES=0`（`:17`） | `RESTORED_VITEST_EXIT=0`、`55 passed`（`:18-20`）**且** `RESTORED_CONTRACT_EXIT=0`、`差集 1 条 / 具名豁免 1 条`（`:21-23`）；独立绿证 `anti/63-at3-green.log`、`anti/64-at3-contract-green.log` | **完整、达标**（唯一带第二道门读数的轮） |

**AT3 的 `needle_gone=false` 如实说明**：AT3 是**追加型**注入（在 `export { productsApi, uploadImage }` 之前插入包装体），needle 本身必须留在原位，故回读只校 `replace_hits===1`。注入器 `at-inject.cjs:93` 的硬闸对此**显式按 case 分流**（`key !== 'AT3' && !needleGone`）。本代理判定：这不是「回读校验被放宽」，而是注入形态决定；但**属口径偏差，须由负责人裁**（§八.5）。

**SHA 形态口径**：四轮 `SHA_BEFORE/SHA_AFTER` 均标 `worktree-crlf`（`sha256sum` 对树内文件），只在同形态内比较，符合协议 §四.3。`git-blob-lf` 形态只在**原始态**记录一次：`anti/00-pristine-sha.txt`（`products.ts worktree-crlf=3b0185ad… / git-blob-lf=bec7f60b…`；`batch-price.vue worktree-crlf==git-blob-lf=ff2e2272…`）。**每轮没有重复记 `git-blob-lf`** ⇒ 登记 §七.5。备份件（还原对照）：`anti/pristine/products.ts`、`anti/pristine/batch-price.vue`。

---

## 六、红线对照（逐条自查）

| 红线 | 自查 | 依据 |
| --- | --- | --- |
| 未 push、未开 PR、未 `git add -A` / `git add .` | **遵守** | 本代理收尾逐文件 `git add`（3 份新增文档 + `docs/evidence/qoder-26/**` 前代理 28 件）；无任何远端命令；协议 §二.1 |
| 未改后端（`git diff bc1087ee..HEAD -- backend/` = 0） | **遵守** | 收尾代理现场实测 **0 字节**（§一）；后端只做**只读**行号回查（§二.④ 表） |
| 未用**名称**当身份 | **遵守，并主动删掉一处基线违规** | `create-sale.vue` 删除 `productList.value.find(p => p.name === name)?.id` 兜底（§二.②）；静态门 `E13 spec.ts:487`；`toNumericId products.ts:48` 对字符串只认「可转正整数」⇒ 名称/编码串一律归 0（无效身份） |
| 未用**条码 / skuCode** 当身份 | **遵守** | `spec.ts:297`（`skuCode/条码形态字符串一律判为无效主键`）、`spec.ts:264/269/274`（缺 `skuId` 的行丢弃，即便带 `skuCode`／只有条码／名称也丢弃并写守卫日志，日志正文点名 `不得用 spuId/skuCode/barcode/name 顶替`）；映射代码 `products.ts:339-347` |
| 未用**空格 / 空串**当身份 | **遵守** | `products.ts:48-56`：`typeof string && value.trim() !== ''` 才继续，空/全空格 ⇒ 0 ⇒ 守卫抛错或整行跳过 |
| 不得放宽断言 / `it.skip` / 改超时 / 加 `eslint-disable` / 吞异常换绿 | **遵守** | 新增 spec 无 `skip`／无 `only`／无超时改动；`toNumericId` 归 0 后**抛错**而非静默兜底；`skuIdOfProduct` 不同值 ⇒ 抛错（不发请求）。守卫**没有** try/catch 吞异常：`batch-price.vue:845` 的异常由**基线既有** catch 分支计入 `failCnt` |
| 不得重排 `gates-baseline.json` 里别人的记录 | **遵守** | 只动 `tests` 节；旧 note 是新 note 的前缀（负责人机检复验，§二.⑥）；四段 `_comment/typeCheck/lint/checkContract/contractDrift` 零 hunk（`git diff` 实测） |
| 不得把「构建通过」当「运行通过」；没开浏览器 ⇒ 写未验 | **遵守** | 判据 3、4 运行态一律记 **未验**（§四），并在 §七.1 写明原因与复验方式；`take_screenshot` 类读数本卡**一个都没声称拿到** |
| 时间不够先提交实现、再补证据 | **遵守**（前代理） | 实现笔 `3228ffc5` 已于 22:38:39 落盘，前代理中断时工作树仅剩未跟踪证据目录，未留未提交代码 |

---

## 七、未完成与阻塞（如实，不许当通过）

1. **★ H5 双 SKU 运行态实开证据未取得（本卡最大缺口，判据 3、4 因此记未验）**
   - 现状：`docs/evidence/qoder-26/h5/` 目录内**只有** `mock-backend-qoder26.mjs`（夹具脚本本身，SPU=7 / SKU=41,42 + 1 条缺主键脏行）；脚本自述的读数落点 **`h5/mock-backend-qoder26.log` 不存在**；`raw/` 里**没有** `dev-h5.log`；全树**没有**任何 DOM 快照 / console / network 读数文件。⇒ 「列表两行、两行可独立加购、详情仍打开同一 SPU」与「批量改价请求路径逐条实录为真实 skuId」这两条运行态判据**没有任何原始读数**。
   - 原因（如实写明）：**与 QODER-25 续办代理共用同一浏览器 / 端口资源**（browser-use MCP 单实例、H5 dev server 端口与 mock 后端端口都会撞），本轮由**负责人串行复验**，前代理据此只把装置落盘未开跑；收尾代理受本轮**禁跑约束**（负责人正在同一棵树内亲跑 `check:gates` + 三构建，并发负载会污染双方读数），不能补跑。
   - 影响面：不改变代码结论，但判据 3/4 的**证据等级**低于 §三/§四 其它条目；本卡的「通过」不覆盖运行态。
   - 复验方式（两侧读数清单）见 `docs/evidence/qoder-26/README.md` §H5 缺口。
2. **`gates-baseline.json` 前缀机检未落原始日志**：树内没有 `raw/NN-gates-baseline-prefix-check.log`，该结论目前只挂在「负责人复验」口径上（§二.⑥）。建议复验后落一份 raw 件。
3. **`raw/` 与 `anti/` 全部日志缺协议 §六.4 要求的头部两行**（`# <做什么> <时间戳>` + `$ <命令>`）。收尾代理受「不得改写前代理已落盘原始日志」约束，**未补头、未改一字**，只在此登记。命令身份只能从日志内的 npm banner / `INJECT_CASE=` 行反推。
4. **三构建退出标记写成 `BUILD_=0`（无平台名）**（§3.2）。读数本身可用，标记不合规。
5. **每轮未重复记 `git-blob-lf` 形态 SHA**：只有 `anti/00-pristine-sha.txt` 记了原始态两种形态（§五末）。同形态内比较未违反协议，但按「SHA 必须标形态 + 逐轮可核」的严格口径属**弱件**。
6. **AT1 首轮（R0）作废**：`INJECT_EXIT=9`，未跑 vitest ⇒ 不交付任何红点（§五 R0）。交付物 7 的「列表映射改回 SPU」这条反测由 R1 承担。
7. **判据 4 的「逐条记录」只到单测层**：D 组逐条路径断言在册，浏览器/网络层逐条 PUT 路径实录缺失（随 §七.1）。
8. **无 git 远端操作、无 PR、无 push**；本卡不申请合并，等负责人裁。
9. **入库形态提示（影响 SHA 复现）**：本树 `core.autocrlf=true` ⇒ 本笔文档提交时 git 对全部新增文件警告「LF will be replaced by CRLF」，即 **blob 归一 LF、检出为 CRLF**；四轮台账的 `worktree-crlf` SHA 只能在 CRLF 检出下复现。复验方若处 `autocrlf=false` / `input` 环境，请按协议 §四.3 先换到同形态再比，**不得跨形态把「不等」判成复原失败**（详见 `docs/evidence/qoder-26/README.md` §4 第 8 条）。

---

## 八、风险与自我报备（含越面发现）

1. **`ProductInfo.id` 的语义从「SPU 主键」改成「SKU 行主键」＝跨页面类型改动**。本卡动作面只碰 5 个页面 + api 层；另有 **4 个消费点未改文件**（判定：api 层收口后它们**自动变正确**，因为它们的写法就是「把列表行 id 当 `skuId` 提交」）：`pages-sub/finance/transfer/create.vue:191` 取列表、`:122` 提交；`finance/loss-gain/create-loss.vue:159`/`:208`；`finance/loss-gain/create-gain.vue:141`/`:190`；`pages/products/product-detail.vue:1045`/`:1054` 的 `detail.skus[].id`（经 `backend/src/services/admin/product.service.ts:363-375` `SELECT s.id … FROM t_product_sku s` 证实就是 `t_product_sku.id`）。这四处的「不得反向」由静态门 `E16 spec.ts:500`、`E17 spec.ts:506` 钉住。**待裁**：若负责人认为消费点必须显式改字段名（`skuId:` 而非 `id:`）才可读，本卡可按同一注法返工。
2. **连带影响：改价/详情调用点若喂错维度会从「静默写错对象」变成「抛错」**（这是本卡想要的行为），但**抛错即失败**意味着任何仍在传 SPU 当 skuId 的**未在册**调用点会开始报错。全仓 `updateSkuPrice(` 只有 `product-detail.vue:1045`（传 `detail.skus[].id`，SKU 维度正确）与 `batch-price.vue:845`（经 `skuIdOfProduct`）两处 ⇒ 本代理核到 0 个裸传残留。`productsApi.list` 共 15 个调用点（`scan.ts:607`、`home.vue:474`、`products.vue:184/231/256/322`、`product-detail.vue:566`、`create-sale.vue:1669/1875`、`price-review.vue:149`、`batch-price.vue:422`、财务三页 `create.vue:191`/`create-loss.vue:159`/`create-gain.vue:141`），其中消费 `id`/`skuId` 语义的站点即 §八.1 列出的四处 + 本卡已改的五个页面，**未发现有站点把列表行 `id` 当 spuId 去进详情**（`products.vue:84`、`home.vue:481` 已改为 `spuId`）。**深链已核**：`product-detail.vue:1588-1599` 的 `onLoad` 在调用 `loadDetail(id)` 前就有 `raw && !(id > 0)` 分支（toast「商品 ID 无效」+ 返回），所以 `assertSpuId` 的抛错在该页**不会**被 `id=undefined/NaN` 触发；残余风险是「整数但维度错」（把 SKU 行主键当 spuId 传）——守卫检不出（见 §八.3），且该风险**运行态未验**。
3. **守卫的固有局限（不隐瞒）**：`assertSkuId` / `assertSpuId` 只能判「是不是正整数」，**不能判「这个正整数属于 `t_product_sku` 还是 `t_product_spu`」**。因此「把 SKU id 喂进详情（SPU）接口」这类反向混用**不会**被守卫拦下，只有改价方向的混用由 `skuIdOfProduct` 的 `id === skuId` 不变式兜住（`products.ts:87-97`）。若需要更强约束，得引入维度标签（`{kind:'sku'|'spu', value}`）——**超出本卡任务书面，未擅自做**。
4. **越面发现（未擅自改，报备待裁）**：扫码匹配仍写作**基线原文** `rows.find((p) => String(p.skuId) === code || (p.name || '').includes(code)) ?? rows[0]`（`products.vue:326`、`home.vue:477`，本卡未改这两行）。该「名称包含」与「兜底取首行」是**查询启发式**，不是主键替代（选中行之后一律以 `spuId`/`skuId` 为身份），但它确实能让「名称匹配」决定跳进哪个商品。是否属红线 §四.3「不得用名称作为唯一身份」的范围 ⇒ **请负责人裁**；本代理未动，因为改动会扩大本卡动作面且无对应判据。
5. **AT3 注入器的 `needleGone` 分流**（`at-inject.cjs:93`）：属按注入形态设计的口径偏差，见 §五 末段说明，请负责人确认这种「追加型注入」的硬闸写法可接受，否则本卡改成分支型 needle。
6. **四卡并行的 `tests` 基线漂移**：本树 `tests` 抬到 12/241。QODER-23/24/25 各自树上另有自己的 tests 读数，**合并序由集成单收敛**（协议 §三）。本卡 note 只列本卡的 55 用例拆解，未写他卡数字 ⇒ 若集成时 note 顺序要求不同，收敛单负责重排。
7. **`skuGuardLog` 是有上限（200 条）的进程内环形缓冲**，只用于取证/单测读数，不参与业务判定；长跑不落盘 ⇒ 运维侧「守卫到底红过几次」在生产上没有持久读数（消息仍会经既有 `console.error` 出现在改价失败分支）。本代理认为属可接受权衡，登记备查。
8. **越面发现（未擅自改，登记）**：`app-mobile/src/native/scan.ts:634 handleScanResult` / `:814 scanAndHandle` / `:606 findProductByBarcode` 在 src 内**0 调用点**（`grep -rn "handleScanResult\|scanAndHandle" app-mobile/src` 除自身文件外无命中，仅 `product-edit.vue:268` 用 `consumeLibraryFillData` / `scanForNewProduct`）⇒ 基线死导出，本卡按「不扩大改动面」未动。风险预告：该链一旦启用，`{ action: 'product', data: product }`（`scan.ts:662`）返回的就是本卡重定义后的 `ProductInfo`（`id`＝SKU 行主键），任何「拿 `id` 进详情」的新接线必须改喂 `spuId`，否则正中 §八.3 的守卫盲区。
9. **本收尾代理的执行边界（自我报备）**：本轮**未跑任何** `npm` / `node scripts/*` / vitest / 构建命令；除读文件外只做 `git` 只读命令（`rev-parse` / `status --porcelain` / `log` / `show --stat` / `diff --numstat` / `diff -- backend/` / `diff -- gates-baseline.json`）。文中所有数字均注明来源为「前代理已落盘日志文件名」或「负责人复验」或「收尾代理现场 `git` 只读实测」三类，无一项自造读数。§三 的门读数保留占位（负责人复验值待回填）。

---

## 九、踩坑实录

1. **前代理 150 轮中断、本代理仅续文档**：实现（`3228ffc5`）与四组反测日志、三构建日志、门日志、H5 夹具脚本都已由前代理落盘；**未落盘的是三份文档交付件（回传卡 / 证据树 README / 回执）**，以及**H5 运行态实开**（受浏览器/端口资源与 QODER-25 续办代理互斥，改由负责人串行复验）。本收尾代理按协议 §二.5「先提交实现、再补证据与回传卡」的次序补齐文档，未重写任何代码与原始日志。
2. **注入 needle 命中 2 次 ⇒ 整轮作废（本卡最硬的一次）**：AT1 第一版 needle 写成 `const skuId = toNumericId(r.skuId)`，而该串在 `products.ts` 里出现 **2 次**（映射函数 + 另一处同形态）⇒ `NEEDLE_HITS=2`、`INJECT_EXIT=9`、**未写一字节**。处置完全按协议 §四.1：本轮判 **VOID**、日志原样保留（`anti/10` + `anti/12`，`anti/12:4` 明写 `VOID: injection failed`）、另立 note（§五 R0），改注入器（把 needle 加长到唯一上下文）后重跑 ⇒ R1 才是有效轮。**关键教训**：`SHA_BEFORE==SHA_AFTER` 在「根本没注入」的轮次里也成立，**绝不能拿它当「注入有效」的证据**；只能拿 `INJECT_EXIT=0` + `NEEDLE_HITS=1` + `replace_hits=1` 三件套当证据。协议 §四.11 说的「互斥读数一律作废」正是这一条。
3. **AT3 是「双读」轮**：同一注入同时让 vitest（静态源门 E6）和 `check:contract`（未豁免缺口 `/admin/products/batch/*`）变红 ⇒ 复原后要跑**两次**恢复确认（`RESTORED_VITEST_EXIT=0` + `RESTORED_CONTRACT_EXIT=0`）。注：`62-at3-contract-red.log` 里的 `products.ts:632` 是**注入态**行号，别拿它去对 HEAD 文件。
4. **禁 `console` 打守卫日志**：`no-console` 冻结 225 条 ⇒ 守卫改用 `skuGuardLog` + 抛错，页面打印复用**基线既有**的 `console.error`（只换文案、不加条数）。一开始想直接 `console.warn` 的做法会让 lint 门红，属红线，未采纳。
5. **注释里的旧缺陷写法会被静态负向门误计**：`ProductInfo.id` 的注释把根因 `id: r.spuId ?? r.id` 原文留着 ⇒ 静态负向门若在全文求值会 +1 假红。处置：所有静态门在「剥掉注释行/行尾注释后的代码视图」上求值（与 `scripts/check-contract.mjs` 的「注释行不算调用」同口径），并写进 `gates-baseline.json` 的 note；同类写法注入到**真代码行**照样判红（AT1 实测）。
6. **`build` 日志变量名踩空**：驱动脚本里退出标记写成 `BUILD_$P=0`，`$P` 未展开 ⇒ 落盘成 `BUILD_=0`（§3.2）。下次写标记请用**字面量**（`BUILD_H5_EXIT=0`），别拼变量。
7. **raw 日志漏写 `# 命令 + 时间戳` 头**（协议 §六.4）：本卡证据只能靠 npm banner 反推命令。收尾代理受「不得改写前代理原始日志」约束未补，改为在 §七.3 登记。
8. **门读数采于提交前 72 秒**（`raw/00` vitest `22:37:27` vs 实现笔 `22:38:39`）：属「同一内容、未提交态」读数，务必由负责人**在尖端上复跑**再回填（§3.1）。
9. **MSYS 路径 / `npx rg` 老坑本轮规避**：取证只用 Grep 工具与 PATH `grep`/`sed`，未用 `npx rg`；带 `/` 起头的模式一律走 Grep 工具（协议 §四.5/§四.6）。

---

## 十、复现命令 + 建议派单

> ⚠️ 以下命令由**负责人**执行（本收尾代理按禁跑约束未执行）。一律在**工作树根目录**跑；在 `app-mobile/` 内跑 `npm --workspace` 会 `No workspaces found` EXIT=1（作废读数，另立 note）。

```bash
# 0) 谱系 / 范围
cd /d/Users/ZXQL/wt-agents/QODER-26
git rev-parse bc1087ee HEAD
git log --oneline -3
git status --porcelain                       # 期望：空（文档笔之后）
git diff bc1087ee..HEAD -- backend/ | wc -c  # 期望：0
git show --stat 3228ffc5                     # 期望：8 文件 +758/-73
git diff --numstat bc1087ee..HEAD | awk '{a+=$1;d+=$2} END{print "+"a" -"d}'

# 1) 四门（期望 GATES_EXIT=0，tests 12/241）
npm --workspace app-mobile run check:gates
# 单独门：type-check / lint / test / check:contract

# 2) 三构建（期望各 EXIT=0，产物在 app-mobile/dist/build/<h5|mp-weixin|app>）
npm --workspace app-mobile run build:h5
npm --workspace app-mobile run build:mp-weixin
npm --workspace app-mobile run build:app

# 3) 基线段机检（只准 tests 段动；旧 note 必须是新 note 的前缀）
git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json   # 期望：仅 tests 节 3 行 hunk
node -e "const a=require('fs').readFileSync('app-mobile/scripts/gates-baseline.json','utf8')" # 建议用脚本读两态 note 做 startsWith

# 4) 反测（每轮：注入 ⇒ 红 ⇒ cp 复原 ⇒ 绿 ⇒ SHA 对相等）
node docs/evidence/qoder-26/anti/at-inject.cjs --at=AT1   # 期望 INJECT_EXIT=0、NEEDLE_HITS=1
npm --workspace app-mobile run test                       # 期望 E1（AT1）/ E8（AT2）/ D 组（AT2b）/ E6+contract（AT3）红
#   复原：cp anti/pristine/products.ts app-mobile/src/api/modules/products.ts
#   复原：cp anti/pristine/batch-price.vue app-mobile/src/pages-sub/product/batch-price/batch-price.vue
#   校验：sha256sum <文件> 与 anti/00-pristine-sha.txt 的 worktree-crlf 值逐字相等
#         AT2 用 batch-price.vue 备份；AT1/AT2b/AT3 用 products.ts 备份
#   AT3 额外跑：npm --workspace app-mobile run check:contract   # 注入态红（/admin/products/batch/* 未豁免）

# 5) H5 运行态（本卡未验项的补跑件；详见 docs/evidence/qoder-26/README.md）
MOCK_PORT=8461 node docs/evidence/qoder-26/h5/mock-backend-qoder26.mjs      # 后台，读数落 h5/mock-backend-qoder26.log
VITE_PROXY_TARGET=http://localhost:8461 npm --workspace app-mobile run dev:h5
```

### 建议派单（执行方视角，非裁定）

1. **QODER-26-H5（补判据 3/4 运行态，P1，0.5 天）**：用 `h5/mock-backend-qoder26.mjs` + `dev:h5` 实开三件事——列表两行、两行独立加购、详情仍是同一 SPU；并把每条 `PUT /admin/products/<n>/price` 的路径段逐行落到 `h5/mock-backend-qoder26.log`。前置条件：**独占 browser-use MCP 与端口**（不与 QODER-25 续办并行）。回传落 `raw/8x-*` 与 `h5/`。
2. **QODER-26-EVIDENCE-DISCPLINE（补证据形态，P3，0.2 天）**：给 4 份 `raw/` 与 19 份 `anti/*.log` 逐份补 `# 做什么 + 时间戳` / `$ 命令` 两行头——**只能以新增 sidecar（`*.note.md`）形式补，不得改写原始日志字节**；并把三构建的退出标记改成字面量重跑一份 `raw/7x-build-*.log`。
3. **MO-23 后续（扫码「名称包含 / rows[0] 兜底」定性，P2）**：§八.4 的越面发现需要一个明确口径——查询启发式是否算「用名称当身份」。若判违规，另开一单只动 `products.vue:326` / `home.vue:477` 两处匹配式。
4. **维度守卫强化（P3，可选）**：若要把「SKU id 喂进 SPU 接口」也拦住，需要类型级维度标签（`{kind,value}`）或运行期反查；本卡不做（超面）。
5. **集成单收敛**：`tests` 段 11/186 → 12/241 需与 QODER-23/24/25 各自的 tests 读数在收敛单一并（协议 §三）。

---

## 附：证据树入口

- `docs/evidence/qoder-26/README.md`（本卡判据 ↔ 28 份证据逐份对账 + H5 缺口与复验清单）
- `docs/evidence/qoder-26/raw/**`（4 份：四门 1 + 三构建 3）
- `docs/evidence/qoder-26/anti/**`（**23 份** = 注入器 `at-inject.cjs` 1 + 四轮日志 19 + 原始态 SHA 清单 `00-pristine-sha.txt` 1 + `pristine/` 备份 2）
- `docs/evidence/qoder-26/h5/mock-backend-qoder26.mjs`（1 份，运行态装置，未跑）
- 回执：`docs/tasks/inbox/ACTIVE-回执-QODER-26.md`

---

## 十一、负责人复验补笔（2026-10-21T23:24+08:00，追加不改写）

> 追加人：Qoder（移动端负责人）亲跑。本卡 §四 判据 3、4 原记「未验」在落笔当时**是准确的**（装置在、读数全无），本节只登记复验后的新增读数与口径变化，不回改上文任何一行。

**判据 3、4 的运行态读数已补齐**（两侧同取，采集过程逐字见 `docs/evidence/qoder-26/h5/owner-h5-readings.log`）：

| 判据 | 复验读数（前端侧 / mock 侧） | 复验后口径 |
| --- | --- | --- |
| §三.3-① 列表两行 | `colaMentions=2`、`badrowPresent=false`，两行价/库存独立（90/100 与 520/560）／`GET /api/admin/products?page=1&pageSize=20 -> 200 records=3 matched=3 skuIds=[41,42,]` | 运行态**已证**（后端 3 条 ⇒ 前端 2 行，脏行被映射层丢弃） |
| §三.3-② 两行独立加购 | 两行 DOM `data-pid="41"` / `data-pid="42"`；分别点 1 次与 2 次 ⇒ 行内计数 `−1+` 与 `−2+`，汇总「**已选 2 种 · 3 件**」 | 运行态**已证**（若仍按 SPU 合并只会是「1 种」）；加购为本地态，mock 日志无多余请求 |
| §三.3-③ 详情同一 SPU | 两张卡均落 `#/pages/products/product-detail?id=7`／两次 `GET_DETAIL path=/api/admin/products/7 spuId=7 skus=[41,42]`，**全日志零 404**，无 `products/41`、`products/42` 的 GET | 运行态**已证** |
| §三.4 改价路径逐条真实 skuId | `PUT_PRICE path=/api/admin/products/41/price segment=41 body={"wholesalePrice":94.5} total_hits=1` 与 `…42/price segment=42 … total_hits=2`（17ms 间隔，两条独立）；`h5/price-hits.json` 的 `pathSegment` 恰为 `[41,42]`，**未出现 7** | 运行态**已证**（以 mock 侧路径段为准，UI 的「调价完成」只作旁证） |
| §二.4 守卫"抛错 + 0 请求" | 脏行在映射层即被丢弃 ⇒ 批量清单里点不到无效主键行，UI 路径**不可构造** | 仍记**运行态未验（不可构造，非失败）**；依据只在单元层 `spec.ts:358/:366` |

**门与三构建的负责人亲跑值**（原卡转录自前代理日志，现回填同名读数；原始输出 `raw/80-owner-gates-and-builds.log`）：
`GATES_EXIT=0`、`vue-tsc EXIT=0（0 条／基线 0 条）`、`error 0（基线 0）／warning 12872（基线 12872）`、`Test Files 12 passed (12)`／`Tests 241 passed (241)`、`差集 1 条／具名豁免 1 条`；`BUILD_EXIT_h5=0`、`BUILD_EXIT_mp-weixin=0`、`BUILD_EXIT_app=0`（修正了前代理 `BUILD_=0` 的变量踩空，见本卡 §九.6）。
`BACKEND_DIFF_BYTES=0`；三产物目录 `app-mobile/dist/build/{h5,mp-weixin,app}` 齐在。

**附带发现（不属本卡文件面，只登记不动作）**：H5 全站底部常驻「发现新版本 / **新版本 vundefined**」——mock 的 `/api/app/version/app_mobile` 返回空体时页面把缺失 `versionName` 直接拼进文案。该缺陷与 QODER-24 的 `decideUpdateAction`/`promptBlocked` 相邻（不同工作树），建议并单处理。

**取证工具坑（写给下一张需要 H5 读数的卡）**：browser-use 的 `click(uid)` 对 uni-app H5 的 `uni-button`/`uni-view` 抛 `TypeError: this.scrollIntoView is not a function`；`fill` 只写 DOM 值不触发 v-model ⇒ 登录会**静默失败**（`merchant_token` 仍 absent 而无报错）。必须走 `evaluate_script`：原生 value setter + `dispatchEvent(new Event('input'))`，再对目标元素派发 `pointerdown/mousedown/pointerup/mouseup/click` 全序列。

**复验后自评变化**：判据 3 **未通过 → 达标（运行态实测）**；判据 4 **部分通过 → 达标（运行态实测，mock 侧路径段为唯一依据）**。其余条目不变；§七.1 的"H5 缺口"就此关闭，但 §七.2 的深链维度混用风险仍**运行态未验**（守卫检不出"整数但维度错"）。
