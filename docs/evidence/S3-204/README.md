# S3-204 证据包 · 跨线协作：MS 侧数据接口（按维度销售序列 + 价格历史）

> 工作树：`D:\Users\ZXQL\wt-agents\S3-204`｜分支 `feat/s3-204-analysis-data-apis`｜基线 `origin/main` = `30bb8994`
> 本包**未 push / 未开 PR**（红线遵守）；改动已在分支上本地提交，由凌舟复核后决定合并。
> 派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-204-20261015.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-204.md`

## 一、结论（一句话）

需求 1 与需求 2 均已落地并**在真库真 HTTP 上跑通**：新增 `GET /api/admin/reports/sales-series`（四个维度 × 三种粒度 × 租户隔离）；
价格历史**表已存在**（`t_product_price_log`，不新建表），缺口只有两点 —— **读接口缺筛选/归一化字段**、**缺 `source`（区分后台改价 / AI 改价）**，
已分别以「扩展既有端点」+「幂等迁移 200 补一列」补齐；**两条改价路径（后台 / AI）本就共用同一端点**，历史落库天然全覆盖（附两侧调用点证据）。

## 二、现有资产盘点（需求前置：先查现成资产）与缺口判定

| 资产 | 实测结论 | 证据 |
|:--|:--|:--|
| `t_product_price_log`（价格变更历史表） | **已存在**，列 = id/tenant_id/sku_id/operator_id/price_type/old_price/new_price/action_type/change_reason/batch_no/ip/created_at | 本机真库 `information_schema`（见 §四 表 A） |
| 需求字段对照 | `sku_id`✓ `price_type`(=价格等级)✓ `old_price`✓ `new_price`✓ `created_at`(=变更时间)✓ `operator_id`✓ ⇒ **只差 `source`** | 同上 |
| 后台改价写历史 | **已存在**：`product.service.ts updateProductPrice` 事务内逐档位 INSERT 日志 | `backend/src/services/admin/product.service.ts:691,729`（改前 HEAD） |
| AI 改价写历史 | **与后台改价同一端点**：AI 工具 `updateProductPrice` 调 `PUT /api/admin/products/:skuId/price` | `ZXQL-AI/src/bridge/service-client.ts:137`（`PRODUCTS='/api/admin/products'`）+ `src/tools/definitions/update-product-price.tool.ts:226` |
| 批量调价写历史 | 已存在（`action_type='BATCH_UPDATE'`） | `backend/src/services/admin/batch-price.service.ts:351` |
| 价格历史读接口 | **已存在但不满足需求**：`GET /api/admin/products/:skuId/price-history` 无筛选、无归一化字段、LIMIT 固定 50 | `backend/src/routes/admin-product.routes.ts:41` |
| 销售序列 | **不存在**：`sales-trend` 只有大盘趋势；`sales-ranking` 只有聚合排行（无 targetId、无逐期序列） | `backend/src/services/admin/report/sales-report.service.ts:141,227` |

**结论**：不新建任何表（现有表字段除 `source` 外够用）；新建 1 个只读接口（sales-series）、扩展 1 个只读接口（price-history）、补 1 列（source）。

## 三、本单改了什么（10 文件，+628/−16 后再追加测试常量与租户条件）

| 文件 | 改动 | 说明 |
|:--|:--|:--|
| `docs/migrations/200_价格日志来源列.sql` | 新增 | 幂等补 `t_product_price_log.source VARCHAR(16) NOT NULL DEFAULT 'admin'`（零 DML，information_schema 守卫 + PREPARE/EXECUTE） |
| `backend/src/services/admin/report/sales-report.service.ts` | +105 | 新增 `getSalesSeries()`：product/sku/category/customer × day/week/month，**显式租户条件**（见 §六.2） |
| `backend/src/controllers/admin/report/sales-report.controller.ts` | +13 | `getSalesSeries` 控制器（支持 `dateStart/dateEnd` 与 `start/end` 别名） |
| `backend/src/routes/report.routes.ts` | +1 | `GET /api/admin/reports/sales-series` 注册 |
| `backend/src/services/admin/product.service.ts` | +85/−13 | `getProductPriceHistory()` 支持 `priceLevel/dateStart/dateEnd/limit` + 归一化字段（date/priceLevel/price/operatorName/source）；`updateProductPrice()` 支持 `body.source` |
| `backend/src/controllers/admin/product.controller.ts` | +19/−2 | 读接口 query 校验（priceLevel 统一转大写）；写接口 body 增加 `source: 'admin'|'ai'` |
| `docs/API接口文档.md` | +58/−1 | 契约：sales-series 全文 + price-history 全文 + `source` 字段（按「先写契约」要求落文档） |
| 4 个测试文件 | +345/−1 | 单测/控制器测：维度分支、粒度/区间、空数据、非法参数、source 落库、limit 收敛、归一化字段（另更新迁移编号不变量常量 199→200） |

## 四、原始读数（`raw/`）

| 文件 | 关键读数 |
|:--|:--|
| `harness-run.txt` | 装置全过程：**26 项断言 PASS / 0 FAIL，EXIT=0**（含全部需求判据与反例） |
| `01-login.json` | `POST /api/admin/auth/login` → `code=0`，下发 token + csrfToken |
| `02~07`、`18` | sales-series 四维度/两粒度/区间/别名/空数据的**接口原始响应**；`[3h]` 与 `querySaleBills`（`GET /api/admin/sale-bills`）逐期金额+单数一致 |
| `08`、`09` | 空目标 ⇒ `data:[]` 且 `code=0`；非法 dimension ⇒ `code=400` |
| `10~12` | **两条改价路径各一次**：后台改价（不带 source）落 `admin`、AI 形态改价（`X-Tenant-Id` + `x-csrf-token` + `source:"ai"`）落 `ai`；日志原始行见 `12-price-log-rows.json` |
| `13~16` | price-history：归一化 `date/priceLevel/price`、`operatorName`、`source`、筛选、区间空结果、`limit=0 → 400` |
| `19` | SQL 直查（`t_sale_bill_item` 明细口径）与接口逐期完全一致 |
| `20` | 跨租户反例夹具（另一租户同 SKU 999 瓶 / 99999 元）**未**进入本租户序列 |
| `21` | **范围外发现**（只报不改）：`sales-ranking?dimension=product` 该 SKU 行读数 `totalQty=1008`＝仅 A 租户 `9` ＋ B 租户 `999`，跨租户聚合缺陷复现 |
| `22` | 迁移 200 幂等：启动 1 遍 + 手工 2 遍 = 3 遍零报错，`source` 列仍唯一 |
| `server.log` | 真实后端启动日志（迁移逐文件执行、注册路由、种子） |
| `gate-*.txt` | 门禁原始输出（vitest / tsc / 守卫） |

## 五、输入指纹（防「跑错工作树」）

| 文件 | sha256(前 16) |
|:--|:--|
| `backend/src/services/admin/report/sales-report.service.ts` | `7C41E69A26C4B097` |
| `backend/src/services/admin/product.service.ts` | `4E7C6AB9430E0C29` |
| `backend/src/controllers/admin/report/sales-report.controller.ts` | `17AF9536708ED39C` |
| `backend/src/controllers/admin/product.controller.ts` | `1ADA5795498141C0` |
| `backend/src/routes/report.routes.ts` | `62BBC391339A4973` |
| `docs/migrations/200_价格日志来源列.sql` | `34099E126CBD9F1A` |
| `backend/dist/services/admin/report/sales-report.service.js`（装置实际运行产物） | `3A16E4CCC998EFF8` |
| `backend/dist/services/admin/product.service.js` | `3195EA898D8963E6` |
| `backend/dist/controllers/admin/product.controller.js` | `1510378C7E002F3F` |

## 六、复跑命令（照抄可跑；MySQL 8.0.46 在 127.0.0.1:3408）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-204
npm --workspace backend run build          # 1) 产出 dist（装置跑 dist）
node docs/evidence/S3-204/harness.mjs      # 2) 建库 → 起后端 → 夹具 → 真 HTTP → 交叉核对 → 汇总（EXIT=0 即全绿）
cd backend
npx vitest run                             # 3) 全量门禁（0 failed）
npx tsc -p tsconfig.json --noEmit          # 4) 类型门禁
```

守卫（在仓库根跑，与 CI 同命令）：`node backend/scripts/guard-route-auth.mjs`、`node backend/scripts/guard-tenant-status.mjs`、
`node backend/scripts/guard-route-prefix.mjs`、`node backend/scripts/guard-utf8-encoding.mjs`、`node backend/scripts/guard-rbac-wiring.mjs --strict`。

## 七、局限与自我报备

1. **「AI 改价」是形态复现、不是真 AI 服务直连**：装置按 AI 桥接的请求形态（`X-Tenant-Id` + `x-csrf-token` + `Authorization`，见 `ZXQL-AI/src/bridge/service-client.ts:439-466`）打同一端点并带 `source:"ai"`；
   AI 服务本身未接本机实例。**旁证**：AI 侧工具调用点（`update-product-price.tool.ts:226`）指向同一端点 ⇒ 历史落库天然覆盖两条路径。
2. **`source` 需要 AI 侧配合**：AI 工具当前只发价格字段，不带 `source` ⇒ 未改造前 AI 改价仍按默认 `admin` 记录（契约已写明「AI 侧传 `source:"ai"`」，属跨线待办，见回执 §未完成）。
3. **存量行不回填**：迁移 200 只加列，历史行按 DEFAULT 读作 `admin`（不猜测来源、不改历史）。
4. **`product`/`category` 维度依赖 SKU 档案存活**：明细只存 `sku_id`，两维度经 `t_product_sku → t_product_spu` 反查，SKU 被物理删除的历史明细不计入（`sku`/`customer` 维度不受影响）——已在契约中写明。
5. **未连生产**：全部读数取自本机 3408 实例的专用库 `s3204_main`（生产零写操作）；生产由凌舟经部署执行迁移 200。
6. **`docs/数据库变更清单.md` 未由本单改动**：按防线 3（该文件由凌舟维护），迁移 200 待凌舟登记。
