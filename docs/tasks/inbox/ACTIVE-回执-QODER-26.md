# ACTIVE-回执 · QODER-26（SKU/SPU 维度与路径参数 MO-22/23）

> 对应派单：**QODER-26**（卡：`docs/tasks/inbox/QODER-26-sku-dimension.md`）｜执行协议：`D:\Users\ZXQL\wt-agents\_qoder23-26-exec-protocol-20261021.md`
> 工作树：`D:\Users\ZXQL\wt-agents\QODER-26`｜分支：`fix/qoder-26-sku-dimension`｜基线：`bc1087ee`
> 完整十项回传：`docs/tasks/cards/R101-QODER-26-回传.md`｜证据树：`docs/evidence/qoder-26/README.md`
> **执行方自评，不含验收方判词**；本回执由收尾子代理落盘（实现与前绝大部分取证由前代理完成，前代理 150 轮中断）。

```
【汇报 QODER-26】QODER-26 SKU/SPU 维度与路径参数：商品行身份已收口为 SKU 行主键、详情走 spuId、
改价经 skuIdOfProduct 守卫且 batchTrace 死包装已删除并与 batches.ts 去重；四门 raw 读数 GATES_EXIT=0、
三构建 DONE、三组反测（四子轮）全部红过且 cp 复原后绿；H5 双 SKU 运行态实开未取得 ⇒ 判据 §三.3/§三.4
自评「未验」，backend diff 0 字节，工作树除本笔文档外 clean。
汇报对象：凌舟（总负责人）
汇报人：Qoder（移动端）｜2026-10-21
```

## 一、交付物（逐条，含文件路径 + 提交哈希）

实现全部在**同一笔** `3228ffc543f841c6f768a4e10d19a41dfae89f90`（父 `bc1087ee`，`fix(mobile): QODER-26 商品域 SKU/SPU 维度分离与路径参数收口`，8 文件 `+758/−73`）。

| # | 任务书 §二 交付物 | 落点（文件:行，HEAD `3228ffc5`） | 提交 |
| --- | --- | --- | --- |
| 1 | `ProductInfo` 拆 `id`/`spuId`/`skuId`，映射不再用 SPU 顶替 | `app-mobile/src/api/modules/products.ts:270`（接口）、`:277/:279/:281`（三字段）、`:335 mapProductRecords`、`:339`、**`:353 id: skuId`**；缺主键行跳过 `:342-347`、重复 `skuId` 只保首行 `:348-351` | `3228ffc5` |
| 2 | 列表 `:key`、加购去重、待选数量、销售明细 `productId` 用 SKU `id` | `products.vue:83 :key="item.id"`；`price-review.vue:27 :key="item.id"`；`create-sale.vue:1808/1818/1819`（**删掉 `p.name === name` 名称兜底**） | `3228ffc5` |
| 3 | 点卡 / 扫码进详情仍用 `spuId` | `products.vue:84 → :277 goDetail(spuId)`（`:278-282` 缺 SPU 主键兜底）、`:329`；`home.vue:480-484`；api 层 `products.ts:110-113 / :480-482 / :120-122 / :189-191` 全过 `assertSpuId` | `3228ffc5` |
| 4 | 改价必须拿真实 `skuId` + 守卫防维度混用 | 守卫三件套 `products.ts:48 toNumericId`、`:58 assertSkuId`、`:71 assertSpuId`、**`:87 skuIdOfProduct`**（校验 `id===skuId`，不同值即抛＝拒发改价）；`:142-144 updateSkuPrice`；调用点 `batch-price.vue:360`（导入）、`:844-845`；读数出口 `:34 skuGuardLog` + 既有 `batch-price.vue:853 console.error`（**no-console 基线不动**） | `3228ffc5` |
| 5 | `batchTrace` 处置（删死包装 / 与既有封装去重） | 基线 `bc1087ee:app-mobile/src/api/modules/products.ts:355-357` 已整段删除（HEAD src 内 `batchTrace` 命中 0）；唯一在册封装 `app-mobile/src/api/modules/batches.ts:108 trace(id: number)`，由静态门 `E7 spec.ts:455` 钉住 | `3228ffc5` |
| 6 | 映射单测（同 SPU 双 SKU ⇒ 两个不同 `id`） | `app-mobile/tests/product-sku-dimension.spec.ts`（512 行 / **55 用例**；`A spec.ts:212`、`B :263`、`C :307`、`D :345`、`E :426`）；`app-mobile/scripts/gates-baseline.json` 仅 `tests` 段 `11/186 → 12/241` + note 末尾追加 QODER-26 段 | `3228ffc5` |
| 7 | 三组反测 | `docs/evidence/qoder-26/anti/at-inject.cjs`（唯一注入器，入库可复跑）+ 四轮日志（AT1 / AT2 / AT2b / AT3） | `3228ffc5`（注入器与日志随本笔文档提交纳入） |
| — | 文档交付件（收尾代理） | `docs/tasks/cards/R101-QODER-26-回传.md`、`docs/evidence/qoder-26/README.md`、本回执 | **本笔** `docs: QODER-26 回传卡 + 回执 + 证据树`（哈希请用 `git rev-parse HEAD` 现场实测；数值见收尾正文。协议 §四.4 不许给还不存在的东西预先写哈希） |

## 二、证据（可复跑）——命令 + 原始输出摘要 + 行号

> 本收尾代理受本轮禁跑约束（负责人正在同一棵树亲跑门与三构建），下列数字**转录自前代理落盘日志**；门读数的负责人复验值待回填。

1. `npm --workspace app-mobile run check:gates` → `docs/evidence/qoder-26/raw/00-check-gates.log`
   `:10` `vue-tsc EXIT=0，当前错误 0 条，基线 0 条`｜`:17` `当前 error 0（基线 0）、warning 12872（基线 12872）`｜`:28` `tests/product-sku-dimension.spec.ts (55 tests)`｜`:52-53` `12 passed (12)` / `241 passed (241)`｜`:57` `当前 12 文件 / 241 用例，基线 12 / 241`｜`:64-68` 口径①`291`②`282`③`204`、后端 `1498`、`差集 1 条 具名豁免 1 条`｜**:71 `GATES_EXIT=0`**
2. 三构建 → `raw/70-build-h5.log:14-15`、`raw/70-build-mp-weixin.log:13-15`、`raw/70-build-app.log:15-17`：均 `DONE Build complete.` + `BUILD_=0`（⚠ 标记丢了平台名，登记缺陷）
3. 反测四子轮（每轮：注入 ⇒ 红 ⇒ `cp` 复原 ⇒ 绿 ⇒ SHA 对）
   - AT1：`anti/20-at1-inject.log`（`NEEDLE_HITS=1`、bytes `24634→24642`）⇒ `anti/21-at1-red.log:398-399`（**17 failed / 38 passed (55)**，靶 `E1 spec.ts:428:36`）⇒ `anti/22-at1-green.log`（55 passed）⇒ 台账 `anti/23-at1-round.log`：`INJECT_EXIT=0`、`VITEST_EXIT=1`、`SHA_BEFORE==SHA_AFTER=3b0185ad…20cd`（`worktree-crlf`）、`BYTE_IDENTICAL=true`、`GIT_DIFF_BYTES=0`、`RESTORED_VITEST_EXIT=0`
   - AT1 首次尝试**作废**：`anti/10-at1-inject.log`（`NEEDLE_HITS=2` ⇒ `INJECT_EXIT=9`、不写一字节）+ `anti/12-at1-round.log:4` 原文 `VOID: injection failed` ⇒ 不计入交付
   - AT2：`anti/30-at2-inject.log`（bytes `51377→51318`）⇒ `anti/30-at2-red.log`（**1 failed**，靶 `E8 spec.ts:462:38`）⇒ `anti/30-at2-green.log` ⇒ 台账 `anti/50-at2-at2b-rounds.log:1-16`（`SHA==ff2e2272…4f7f`）
   - AT2b：`anti/40-at2b-inject.log`（bytes `24634→24618`）⇒ `anti/40-at2b-red.log`（**3 failed**：`spec.ts:323:12`、`spec.ts:329:52`、`spec.ts:358:28`，抛出点 `products.ts:90:11`，原文 `[SKU维度守卫] case: ProductInfo.id=41 与 skuId=7 不同值（疑似 spuId 顶替 SKU 主键）⇒ 拒发改价`）⇒ `anti/40-at2b-green.log` ⇒ 台账 `anti/50:17-34`
   - AT3：`anti/60-at3-inject.log`（bytes `24634→24843`，`needle_gone=false` 属追加型注入）⇒ **双读**：`anti/61-at3-red.log`（1 failed，靶 `E6 spec.ts:450:31`）+ `anti/62-at3-contract-red.log`（`CONTRACT_EXIT=1`、`✗ /admin/products/batch/* ← products.ts:632`〔注入态行号〕）⇒ 复原绿 `anti/63`（55 passed）+ `anti/64`（`差集 1 / 豁免 1 / EXIT=0`）⇒ 台账 `anti/65-at3-round.log`
   - 原始态 SHA 双形态：`anti/00-pristine-sha.txt`；还原件：`anti/pristine/products.ts`、`anti/pristine/batch-price.vue`
4. 范围与红线机检（收尾代理现场 `git` 只读实测）：`git rev-parse bc1087ee HEAD` ⇒ `bc1087eec4b8…e1d3` / `3228ffc543f8…f90`；`git diff bc1087ee..HEAD -- backend/ | wc -c` ⇒ **0**；`git diff --numstat bc1087ee..HEAD` 求和 ⇒ `+758 -73`；`git diff bc1087ee..HEAD -- app-mobile/scripts/gates-baseline.json` ⇒ hunk **仅** `tests` 节 3 行（`_comment/typeCheck/lint/checkContract/contractDrift` 零改动）
5. 后端出处回查（只读）：`backend/src/routes/admin-product.routes.ts:35/:46/:60/:63/:69/:74` 与 `product.controller.ts:36/:118/:152/:256/:296`、`product.service.ts:259-273`（`SELECT p.id AS spuId … s.id AS skuId … FROM t_product_sku s`）、`:363-375`、`:513`（`return { id: spuId, spuId, skuId: firstSkuId, spuCode }`）⇒ 与 `products.ts:15-32` 注释逐条对齐，**六条全部准确**

## 三、验收自评（任务书 §三 硬验收逐条；自评 + 依据，非裁定）

| # | 判据 | 自评 | 依据 |
| --- | --- | --- | --- |
| 1 | `check:gates` EXIT=0 | **通过（负责人复验值待回填）** | `raw/00:71 GATES_EXIT=0`；⚠ 时序缺陷：该读数采于提交前 72 秒（卡 §3.1、§七.3） |
| 2 | `build:h5` / `mp-weixin` / `app` 均 EXIT=0 | **通过（标记形态不合规）** | `raw/70-build-*.log` 三份 `DONE Build complete.` + `BUILD_=0` |
| 3 | H5 双 SKU 夹具：列表两行、独立加购、详情同一 SPU | **未验** | 装置在（`h5/mock-backend-qoder26.mjs`），**读数全无**（无 `mock-backend-qoder26.log`、无 dev-h5 日志、无 DOM/console/network 快照）；等价证据只到单测层（`spec.ts:215/219/224/228/414`），按协议 §二.4 不得顶替运行态 |
| 4 | 批量改价请求路径逐条记录为真实 `skuId`（不得只看 UI 提示） | **部分通过 / 运行态未验** | 单测层逐条路径实证 `spec.ts:346/:354/:366` + 静态 `E8` + AT2/AT2b 红；**缺**浏览器里逐条 `PUT …/<n>/price` 的网络实录（`h5/mock-backend-qoder26.mjs` 正是该读数源，未跑） |
| 5 | `git diff bc1087ee..HEAD -- backend/` = 0；工作树 clean | **通过** | 现场实测 0 字节；文档笔之前 `git status --porcelain` 仅 `?? docs/evidence/qoder-26/`（本笔纳入），本笔之后为空 |

任务书 §二 七条：1 通过／2 自评通过（静态 + 单测；运行态随判据 3 未验）／3 通过／4 通过／5 通过（删除 + 与 `batches.ts:108` 去重）／6 通过（55 用例）／7 通过（三组四子轮全红且复原绿；AT1 首轮作废另立）。

## 四、未完成与阻塞

1. **H5 双 SKU 运行态实开证据未取得（判据 3、4 因此未验）**——原因：**与 QODER-25 续办代理共用同一浏览器 / 端口资源**（browser-use MCP 单实例、H5 dev 端口与 mock 端口都会撞），本轮改由**负责人串行复验**；前代理据此只落装置未开跑，收尾代理受禁跑约束不能补跑。复验方式与需要的两侧读数清单见 `docs/evidence/qoder-26/README.md` §3.2/§3.3。
2. `gates-baseline.json`「旧 note 是新 note 前缀」机检**无 raw 件**，结论只挂「负责人复验」。
3. `raw/` 4 份 + `anti/` 19 份日志**缺协议 §六.4 要求的 `#`/`$` 头**；收尾代理不得改写前代理原始日志 ⇒ 只登记未补（新增 sidecar 需另单）。
4. 三构建退出标记写成 `BUILD_=0`（无平台名）。
5. 每轮未重复记 `git-blob-lf` 形态 SHA（仅 `anti/00-pristine-sha.txt` 记原始态）。
6. AT1 存在作废轮（`INJECT_EXIT=9`），该轮不交付任何红点。
7. 门读数采于提交前 ⇒ **待负责人在 `3228ffc5` 尖端复跑回填**（卡 §三 已留占位）。
8. 未 push、未开 PR；本回执不申请合并，等裁。

## 五、风险与自我报备

1. **`ProductInfo.id` 语义由 SPU 改 SKU 行主键＝跨页面类型改动**。本卡只动 5 页 + api 层；另有 **4 个消费点未改文件**（`finance/transfer/create.vue:122 skuId: Number(p.skuId ?? p.id)`、`finance/loss-gain/create-loss.vue:208 skuId: product.id`、`create-gain.vue:190 skuId: product.id`、`product-detail.vue:1045/1054 detail.skus[].id`，经 `product.service.ts:363-375` 证实即 `t_product_sku.id`）——api 层收口后它们自动落在正确维度，由 `E16 spec.ts:500`、`E17 spec.ts:506` 钉住。**待裁**：是否要求这些点显式改字段名（可读性），本代理未擅自扩大面。
2. **守卫固有局限（不隐瞒）**：`assertSkuId`/`assertSpuId` 只能判「是不是正整数」，**判不出这个整数属于哪张表**；「把 SKU id 喂进 SPU 详情接口」这类反向混用不会被拦，只有改价方向由 `skuIdOfProduct` 的 `id===skuId` 不变式兜住（`products.ts:87-97`）。强化需类型级维度标签，超本卡面。
3. **深链已核**：`product-detail.vue:1588-1599 onLoad` 在 `loadDetail` 前有 `raw && !(id>0)` 分支（toast「商品 ID 无效」+ 返回）⇒ 新守卫的抛错不会被 `id=undefined/NaN` 触发；残余是「整数但维度错」，属 §2 盲区且运行态未验。
4. **越面发现（未擅自改）**：① 扫码匹配仍是基线原文 `rows.find(p => String(p.skuId)===code || (p.name||'').includes(code)) ?? rows[0]`（`products.vue:326`、`home.vue:477`）——名称包含/兜底取首行是查询启发式（选中后一律以 `spuId`/`skuId` 为身份），是否触红线 §四.3 **请裁**；② `native/scan.ts:634 handleScanResult` / `:814 scanAndHandle` / `:606 findProductByBarcode` 在 src 内 **0 调用点**（基线死导出），该链一旦启用，返回的 `ProductInfo.id` 已是 SKU 主键，任何「拿 id 进详情」的新接线必须改喂 `spuId`。
5. **AT3 注入器对 `needleGone` 按 case 分流**（`at-inject.cjs:93`，AT3 为追加型注入）——是否算放宽回读硬闸**请裁**。
6. **四卡并行 `tests` 基线漂移**：本树抬到 12/241，note 只列本卡 55 用例拆解，合并序与总数由集成单收敛（协议 §三）。
7. **守卫日志无持久化**：`skuGuardLog` 是 200 条进程内环形缓冲，只供单测/取证，不参与业务判定；运维侧仍靠改价失败分支的既有 `console.error`（含 `id/spuId/skuId/name` 四读数）。
8. **收尾代理执行边界**：本轮**未跑任何** `npm`/`node scripts/*`/vitest/构建；只做文件读与 `git` 只读命令；文中每个数字都标注来源（前代理日志文件名 / 负责人复验 / 收尾代理 `git` 实测），门读数保留占位；未改一行代码、未改写任何原始日志。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-QODER-26-回传.md`
关联卡：`docs/tasks/inbox/QODER-26-sku-dimension.md`
