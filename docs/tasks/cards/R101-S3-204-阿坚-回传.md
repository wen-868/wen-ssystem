# ACTIVE-回执 · S3-204（跨线：MS 侧数据接口 —— 销售序列 + 价格历史）

【汇报 S3-204】S3-204 一句话结论：**需求 1、需求 2 全部落地并在真库真 HTTP 上跑通（装置 26 项断言 0 失败）；价格历史表已存在不新建，只补「读接口筛选/归一化 + source 列」两处缺口；两条改价路径共用同一端点，历史天然全覆盖。**

汇报对象：**凌舟（总负责人）**
汇报人：**阿坚（后端架构 / API / DDL / 迁移）**｜**2026-10-15**｜执行方会话：`/root/s3207_ajian`

---

## 一、交付物（逐条，含路径 + 提交哈希）

工作树 `D:\Users\ZXQL\wt-agents\S3-204`｜分支 `feat/s3-204-analysis-data-apis`｜基线 `origin/main = 30bb8994`（**未 push、未开 PR**）

| 提交 | 内容 |
|:--|:--|
| `bf11e618` | `docs: S3-204 跨线接口契约（销售维度序列 sales-series + 价格历史读接口与来源标记）` |
| `d2758861` | `feat: S3-204 按维度销售序列接口 + 价格历史读接口（筛选/来源/source 列）` |
| **分支 HEAD**（本回执所在提交，取 `git log -1` 即为准） | `fix: 销售序列补显式租户条件 + 迁移编号不变量同步`；`docs: 证据包 docs/evidence/S3-204/ + 回执/回传卡入账` |

分支相对基线 `30bb8994`：**46 文件，+3646 / −18**（含证据包 26 份原始读数文件），工作区干净。

| # | 交付物 | 路径 |
|:--:|:--|:--|
| 1 | 销售维度序列接口 | `backend/src/services/admin/report/sales-report.service.ts`（`getSalesSeries`）、`controllers/admin/report/sales-report.controller.ts`、`routes/report.routes.ts:18` |
| 2 | 价格历史读接口（扩展既有端点，未另起重复接口） | `backend/src/services/admin/product.service.ts`（`getProductPriceHistory`）、`controllers/admin/product.controller.ts` |
| 3 | 改价来源落库（`source`） | 同上 `updateProductPrice` + `docs/migrations/200_价格日志来源列.sql` |
| 4 | 接口契约（AI 侧照此开发） | `docs/API接口文档.md`（`GET /api/admin/reports/sales-series` 全文、`GET /api/admin/products/:skuId/price-history` 全文、`PUT /api/admin/products/:skuId/price` 的 `source` 字段） |
| 5 | 单测/控制器测 | `backend/src/__tests__/services/admin/report/sales-report.test.ts`、`services/admin/product.service.test.ts`、`controllers/admin/report/sales-report.controller.test.ts`、`controllers/admin/product.controller.test.ts`、`shared/migration-c6-4-1.test.ts` |
| 6 | 证据包 | `docs/evidence/S3-204/`（README + `harness.mjs` + `db-query.mjs` + `raw/` 22 份原始读数） |

## 二、证据（可复跑）

**装置**：`node docs/evidence/S3-204/harness.mjs`（先 `npm --workspace backend run build`）——自建专用库 `s3204_main` → 起真实后端（`dist/server.js`，启动期跑迁移+种子）→ 夹具 → 真 HTTP → 交叉核对。

| 判据 | 命令 / 读数 | 结果 |
|:--|:--|:--|
| 装置整体 | `node docs/evidence/S3-204/harness.mjs` → `raw/harness-run.txt` 末行 | **PASS 26 / FAIL 0，EXIT=0** |
| 需求 1：按维度序列 | `raw/02~07`：sku 序列 `[{2026-08,5,645,2},{2026-09,5,645,1},{2026-10,4,516,1}]`；product(SPU)=`7,845,2`（同 SPU 第二 SKU 计入）；category/customer=`8,935,3`；day 粒度 4 期；`start/end` 别名可用 | 逐项 PASS |
| 需求 1：与销售明细交叉核对 | `raw/18`（`GET /api/admin/sale-bills`=AI 工具 `api_query_sale_bills` 的后端）：逐期金额/单数 `645·2 / 935·3 / 516·1` **与接口一致**；`raw/19` SQL 直查明细口径**与接口完全一致** | PASS |
| 需求 1：空数据 | `raw/08`：`{"code":"0","data":[]}` | PASS |
| 需求 1：参数非法 | `raw/09`：`dimension=nope` → `code:"400"` | PASS |
| 需求 2.1：两条路径各一次改价⇒有历史 | `raw/10`（后台改价，不带 source）、`raw/11`（AI 形态改价，带 `source:"ai"`）、`raw/12` 原始日志行：`RETAIL 2999→3010 source=admin`、`WHOLESALE 2699→2706 source=ai` | PASS |
| 需求 2.2：查询接口 | `raw/13`：`[{date:"2026-10-15 10:49:12", priceLevel:"WHOLESALE", price:2706, operatorName:"系统管理员", source:"ai"}, …]`；`raw/14` `priceLevel=retail` 只回 RETAIL；`raw/15` 区间空 ⇒ `records:[]`；`raw/16` `limit=0` → `code:"400"` | PASS |
| 需求 2：租户隔离反例 | `raw/20`：另一租户同 SKU 999 瓶/99999 元 `raw/02` 中**未出现** | PASS |
| 迁移 200 | `raw/server.log`：`[migration] 执行外部迁移: 200_价格日志来源列.sql`；`raw/22`：连跑 3 遍零报错、`source` 列唯一、列定义 `varchar(16) NOT NULL DEFAULT 'admin'` | PASS |
| 门禁 vitest（全量） | `cd backend && npx vitest run` → `raw/gate-vitest.txt` | **660 文件 / 7980 用例 / 0 failed，EXIT=0** |
| 门禁 tsc | `npx tsc -p tsconfig.json --noEmit` | **EXIT=0（0 字节输出）** |
| 门禁 build | `npm --workspace backend run build` | **EXIT=0** |
| 门禁 guard ×5 | `guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` / `guard-utf8-encoding` / `guard-rbac-wiring --strict` | **全部 EXIT=0** |

## 三、最终契约（交给 AI 底座线照此开发）

1. **`GET /api/admin/reports/sales-series`**（新增，只读）
   - 入参：`dimension`=`product|sku|category|customer`（必填）、`targetId`（必填；product→`t_product_spu.id`、sku→`t_product_sku.id`、category→`t_product_category.id`、customer→`t_member.id`）、`granularity`=`day|week|month`（缺省 `month`）、`dateStart/dateEnd`（可选，别名 `start/end` 等价；都不传=近 12 期）。
   - 出参：`data = [{ period, qty, amount, orderCount }]`（`qty=SUM(total_bottle_qty)`、`amount=SUM(subtotal_amount)`、`orderCount=COUNT(DISTINCT bill_no)`）；排除 `DRAFT/VOIDED`；无数据=`[]`；参数非法=`code:"400"`。
2. **`GET /api/admin/products/:skuId/price-history`**（扩展既有端点，未新增路径）
   - 入参：`priceLevel`（`COST|RETAIL|WHOLESALE|MINIAPP|STORE`，大小写不敏感）、`dateStart/dateEnd`（别名 `start/end`）、`limit`（缺省 50、上限 500）。
   - 出参：`data.records[]` 每条含 **归一化** `date`(`YYYY-MM-DD HH:mm:ss`) / `priceLevel` / `price`，以及既有 `priceType/oldPrice/newPrice/actionType/operatorId/createdAt` + 新增 `operatorName` / `source`。
3. **`PUT /api/admin/products/:skuId/price`** 新增可选 `source: "admin"|"ai"`（缺省 `admin`）⇒ 落 `t_product_price_log.source`。**AI 侧改造点**：`ZXQL-AI` 的 `update-product-price.tool.ts:222` 请求体加 `source: 'ai'`（一行）。

## 四、验收自评（逐条对照派单卡）

| 派单卡要求 | 自评 | 依据 |
|:--|:--|:--|
| §一.1 先查现成资产 + 判定「是否已满足需求」，已存在则只补缺口、不新建重复表 | 通过 | 回执 §五 资产盘点表；**未新建任何表**，只补 1 列 |
| §一.2 契约按 MS 规范（`/api/admin/...` + 声明式鉴权 + `{code,msg,data}`） | 通过 | 契约见 §三；走 `routeConfigs`（`report.routes.ts` prefix `/api/admin/reports`，`auth: requireAuthWithTenant`）；返回体 `ok()`/`fail()` |
| §二 需求 1：维度/粒度/区间 + 租户隔离 + 与 `querySaleBills` 交叉核对 + 空数组合法 | 通过 | §二 表格 1~4 行 |
| §三 2.1：两条改价路径都落历史（含旧值/新值/时间/来源） | 通过（附一处跨线待办） | `raw/10~12`；AI 侧需补 `source:'ai'`（见 §六） |
| §三 2.2：查询接口（skuId + 可选 priceLevel + start/end）× 租户隔离 | 通过 | `raw/13~16`；SQL 显式 `ppl.tenant_id = ?` |
| §四.1~5 交付物与判据 | 通过 | 见 §一、§二 |
| §四.6 门禁：vitest 0 failed / tsc 0 / 三条 guard + rbac-wiring --strict / backend build | 通过 | §二 表格末四行（5 条 guard 全 0，含卡面点名的 `--strict`） |
| §五 红线：不改销售/价格既有业务语义；不自建重复表；不放宽鉴权；不改 `.github/**`、`deploy/**`、`R101-收口总清单.md`；生产库零写 | 通过 | 改动文件见 §一（无上述路径）；全部读数取自本机 3408 专用库 `s3204_main` |
| 卡面「证据记 src+dist 哈希」 | 通过 | `docs/evidence/S3-204/README.md` §五（6 个 src + 3 个 dist 指纹） |

## 五、§一 要求的「现有资产盘点」结论（摘要）

| 资产 | 实测 | 判定 |
|:--|:--|:--|
| `t_product_price_log` | 已存在，13 列（含 tenant_id/price_type/old_price/new_price/created_at/operator_id/batch_no/change_reason） | **够用，不新建**；只缺 `source` ⇒ 迁移 200 补列 |
| 后台改价落库 | `product.service.ts:691,729`（事务内逐档位 INSERT） | 已有 |
| AI 改价落库 | 与后台**同一端点**（`ZXQL-AI/src/bridge/service-client.ts:137` + `tools/definitions/update-product-price.tool.ts:226`） | 天然覆盖；`source` 用于区分 |
| 批量调价落库 | `batch-price.service.ts:351`（`BATCH_UPDATE`） | 已有 |
| 销售序列 | `sales-trend`（仅大盘）/`sales-ranking`（仅聚合排行） | **不存在** ⇒ 新建 `sales-series` |

## 六、未完成与阻塞

1. **AI 侧一行改造（跨线，不属本单范围）**：`ZXQL-AI` 的改价工具需在请求体加 `source:"ai"`，否则 AI 改价仍按默认 `admin` 记录。契约已写进 `docs/API接口文档.md`，请凌舟转 AI 底座线。
2. **`docs/数据库变更清单.md` 未登记迁移 200**：按防线 3 该文件由凌舟维护 ⇒ 请凌舟登记（文件：`docs/migrations/200_价格日志来源列.sql`，幂等、零 DML、只加一列）。
3. **`docs/tasks/current-tasks.md` 未由本单改动**：按信箱协议由凌舟记账。
4. **本机无 3306 实例**：真库读数取本机既有 MySQL 8.0.46（127.0.0.1:3408，S3-194 起的共享实例）自建专用库；`node docs/evidence/S3-204/harness.mjs` 可整体复跑。

## 七、风险与自我报备

1. **「AI 改价」证据是形态复现，不是真 AI 服务直连**（已在证据 README §七.1 明写）：我按 AI 桥接的请求形态（`X-Tenant-Id`+`x-csrf-token`+`Authorization`）打同一端点并带 `source:"ai"`；AI 服务未接本机实例，结论靠「调用点代码」旁证。
2. **我第一版漏了显式租户条件，自查后已修**：`queryWithTenant` 只在 SQL 文本**不含** `tenant_id` 时自动注入；我的首版 SQL 因 JOIN 里写了 `s.tenant_id = sbi.tenant_id` 而被短路 ⇒ 会跨租户聚合。已在 WHERE 显式加 `sb.tenant_id = ?` 并补单测断言（`sales-report.test.ts`），真库反例（`raw/20`）验证隔离成立。**教训**：写带 JOIN 的报表 SQL 时，自动注入不生效，租户条件必须自己写。
3. **范围外发现（只报不改，请凌舟定夺）**：
   - ① **既有 `GET /api/admin/reports/sales-ranking?dimension=product` 跨租户聚合**：同一 SQL 缺陷（JOIN 写了 tenant_id ⇒ 自动注入短路、又无显式条件）。复现：`raw/21` —— 该 SKU 行 `totalQty=1008` = 仅 A 租户 `9` + B 租户 `999`（金额 101160 = 1161 + 99999）。修法是 1 行（`WHERE sb.tenant_id = ?` + 传参），但**不在本卡范围**，未擅自改。
   - ② **商品导入覆盖价不落历史**：`services/admin/data-transfer.service.ts:305-320`（`upsertSkuPrice`）改价只 UPDATE `t_product_price`、不写 `t_product_price_log` ⇒ 价格走势序列会出现「未落库的突变」。全量扫描结果：改价写入点共 3 处，**已落库 2 处（单改/批量）、未落库 1 处（导入覆盖）**。建议另立卡。
   - ③ **价格日志按等级可见性**：`price-history` 会返回 `priceLevel=COST` 档位（需求要求含进价），而 `priceResponseFilter` 只按**字段名**过滤、不拦该端点的值 ⇒ 低权限角色也能看到成本价历史。因与需求「含进价等级」冲突，未自行收紧，供凌舟定夺。
4. **`source` 语义边界**：`source` 由调用方自报，租户管理员可伪造（无安全影响，仅溯源标注）；如需强约束需服务端按凭证判定，另议。
5. **未做**：生产实测（生产库零写，迁移由凌舟经部署执行）、前/小程序端展示改造（本次无前端需求）。

回传要求：本汇报已落卡 `docs/tasks/cards/R101-S3-204-阿坚-回传.md`（同内容）｜回执：本文件
关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-204-20261015.md`（原 `docs/tasks/inbox/ACTIVE-S3-204.md`，内容不变已归档）
