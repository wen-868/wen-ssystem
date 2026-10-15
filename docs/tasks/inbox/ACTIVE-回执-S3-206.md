# ACTIVE-回执 · S3-206（P0：`sales-ranking` 跨租户聚合越界 ＋ 同根因全仓扫描）

- 汇报对象：**凌舟**｜汇报人：**阿坚（后端，执行方）**｜日期：**2026-10-15**｜对应派单编号：**S3-206**
- 会话：`/root/s3209_ajian`｜工作树 `D:\Users\ZXQL\wt-agents\S3-206`｜分支 `fix/s3-206-cross-tenant-ranking`
- 基线 `origin/main = 36a7a02f`｜HEAD `f3459c28`（本地 4 笔提交：`58bc2a1e` 修复＋单测、`7e043733` 证据包、`93760cc3`/`f3459c28` 两笔哈希订正；**未 push、未开 PR**）｜工作区干净
- ⚠️ 交付期间 `origin/main` 已前进到 `db9adf82`（均为文档提交，与本单无交集）；本单改动相对基线**只涉及 24 个文件：3 个后端代码/单测 + 21 个新增证据文件**（`git diff --stat 36a7a02f..HEAD`）。

## 一、交付物

| # | 文件 | 改动 | 说明 |
|:--:|:--|:--|:--|
| 1 | `backend/src/services/admin/report/sales-report.service.ts` | `getSalesRanking` 四维度统一**显式**租户谓词 `WHERE sb.tenant_id = ?`，占位符顺序 `[tenantId, start, end, lim]` | 修 `product` 维度跨租户聚合 + `store` 维度 500；`customer` 维度由"依赖自动注入"改为显式（行为等价，见 §六 自我报备） |
| 2 | `backend/src/__tests__/services/admin/report/sales-report.test.ts` | +4 条参数化用例 | 锁住"每个维度 SQL 含 `sb.tenant_id = ?` 且首参 = tenantId"；摘掉条件即变红 |
| 3 | `docs/evidence/S3-206/**` | 新增证据包 | 装置 `harness.mjs`、扫描器 `scan-tenant-shortcircuit.mjs`、`README.md`、`raw/*`、`WORKLOG.md` |

**零 DDL、零迁移、零前端改动**（`docs/数据库变更清单.md` 无需登记）。未改 `.github/**`、`deploy/**`、`R101-收口总清单.md`，未连生产库。

## 二、证据（可复跑，命令 + 原始输出）

| 判据 | 命令 | 读数（原始文件） |
|:--|:--|:--|
| 独立确认缺陷（**先确认再动手**） | `node docs/evidence/S3-206/harness.mjs`（改前 dist） | `raw/harness-run-prefix.txt`：`product` 维度 `totalQty=1013 / totalAmount=101805` = **A 14/1806 ＋ B 999/99999**；`store` 维度 **500**（`raw/server.log`：`ER_NON_UNIQ_ERROR 1052 Column 'tenant_id' in where clause is ambiguous`）；`FAIL 5 / EXIT=1` |
| 修复后 | 同上（改后 dist） | `raw/harness-run-fixed.txt`：`PASS 10 / FAIL 0 / EXIT=0`；`product` = `14 瓶/1806 元`（= A 单独）、四维度合计均 = A 单独真值 `60260`；`store` 维度 **200** |
| **两侧反测** | 在修复后代码上**摘掉** product 维度显式租户条件 → 重跑 | `raw/harness-run-countertest-product.txt`：`5b/5c` 回到 `1013/101805`（红）、其余维度仍绿、`FAIL 2 / EXIT=1`；复原后即 §"修复后"绿 |
| 同根因全仓扫描 | `node docs/evidence/S3-206/scan-tenant-shortcircuit.mjs` | `raw/scan-tenant-shortcircuit.json`（789 文件 / 1747 调用点；LEAK 候选 7、可疑 14、AUTO-INJECT+JOIN 6、非字面量 12） |
| 范围外量化 | 同上装置软探针 | `raw/20-profit.json`：`/reports/profit.cost = 120886 = A 20986 + B 99900`；`raw/23-business-overview.json`：`inventoryValue = 182096 = A 172096 + B 10000` |
| 全量单测 | `cd backend && npx vitest run` | `raw/gate-vitest.txt`：**663 文件 / 7999 用例 0 failed，EXIT=0** |
| 类型门禁 | `cd backend && npx tsc -p tsconfig.json --noEmit` | `EXIT=0`（注：**仓库根目录没有 `tsconfig.json`**，在根目录跑 `npx tsc --noEmit` 只打印帮助文本、不是通过证据——见 §六） |
| 门禁脚本 | `guard-route-auth` / `guard-tenant-status` / `guard-route-prefix` / `guard-utf8-encoding` / `guard-rbac-wiring --strict` | 逐条 `EXIT=0`（`--strict`：已登记缺口 680 条、未登记缺口 0） |
| 构建 | `npm --workspace backend run build` | `raw/gate-build.txt`：`EXIT=0`（801 文件、修复 1893 处导入路径） |

## 三、同根因扫描清单（本卡最重要的产出，逐条判定）

**根因**：`backend/src/config/database.ts` 的 `injectSelectTenant/Update/Insert` 用**子串判断**——
`if (sql.toLowerCase().includes('tenant_id')) return sql;`，SQL 文本任何位置出现 `tenant_id`（如 JOIN 的 `ON ... AND a.tenant_id = b.tenant_id`）即整体**跳过注入**；
而"无 tenant_id 字样"时注入的又是**无限定列名** `tenant_id = ?`，多表 JOIN 会歧义。**本次按卡面口径在调用点显式化，未改注入器。**

| # | 位置 | 判定 | 处置 |
|:--:|:--|:--|:--|
| 1 | `report/sales-report.service.ts:350`（`getSalesRanking` **product**） | **真泄露**（短路 + WHERE 无租户谓词） | **本卡已修**（1013/101805 → 14/1806） |
| 2 | `report/sales-report.service.ts:382`（同端点 **store**） | **真 500**（注入无限定列名 → 1052 歧义） | **本卡已修**（500 → 200） |
| 3 | `services/admin/report/finance-report.service.ts:210`、`:264` | **真泄露**（`JOIN ... AND sb.tenant_id = sbi.tenant_id`，WHERE 无租户谓词） | **未修**（卡外）；已量化：`/reports/profit.cost = A+B = 120886`（A 单独 20986） |
| 4 | `report/sales-report.service.ts:497`（`getBusinessOverview` 库存金额） | **真泄露**（`JOIN t_product_price ... AND pp.tenant_id = ib.tenant_id`，无 WHERE） | **未修**（卡外，端点不同）；已量化：`inventoryValue = 182096`（A 单独 172096 ✚ B 10000） |
| 5 | `services/admin/batch-price.service.ts:189`、`:206` | **真泄露**（同款 JOIN；WHERE 只拼业务条件；实参数组不含 tenantId） | **未修**（卡外）——**批量调价预览/列表跨租户**，未造夹具量化 |
| 6 | `jobs/report-aggregation.job.ts:7` | 有意为之（`SELECT DISTINCT tenant_id`，平台级作业枚举租户） | 不需修 |
| 7 | `services/admin/marketing-coupon.service.ts:361/371` | **误报**（过滤在 JOIN 与 `${where}` 里都有 `ct.tenant_id = ?`） | 不修；端点实测 `code=0`（`raw/22-user-coupons.json`） |
| 8 | `services/sale-return.service.ts:176` | **误报**（`where` 恒以 `WHERE sr.tenant_id = ?` 开头，扫描器看不到插值） | 不修 |
| 9 | `AUTO-INJECT+JOIN` 6 处：`credit-collection:184`、`inventory-share:210`、`price-review:84`、`report-collection:78`、`report.service:330`、`supplier:684` | **观察项** | 若 JOIN 另一张表也有 `tenant_id` ⇒ 重演 1052 歧义 500；本次未逐条验证 |
| 10 | 非字面量 12 处（SQL 由变量/工厂产出，如 `report-export.service.ts:186` 的 `reportQueries[...]`） | **未判定** | 扫描器无法静态展开；建议单独复核报表导出 SQL 工厂 |

> 影响面数字：**真泄露 4 组（本卡修 1 组）／真 500 1 处（本卡已修）／误报 2 处／观察项 6 处／未判定 12 处**。

## 四、验收自评（逐条对照派单卡 §二～§四）

1. `req.tenantId` 独立确认：**已做**（A/B 双租户真数据 + 库内真值对照，原始响应与 SQL 真值双份）。
2. 同根因扫描清单（完整）+ 逐条修法/说明：**已做**（§三 十行，含误报与"有意为之"的判定依据）。
3. 修法口径：**照卡执行**——显式别名限定谓词，不依赖 JOIN 里恰好写了 tenant_id 的隐式行为；两侧反测已给（红/绿原始输出）。
4. §四 四条判据：A 令牌只读到 A 数据（四维度全绿）；扫描清单完整；反测两侧齐；vitest 7999 用例 0 failed、tsc 0、五道 guard EXIT=0、build EXIT=0。
5. 既有单测无"把跨租户聚合当期望值"的情况（该文件对 `queryWithTenant` 全 mock，只断言返回形状）——无需改历史期望值。

## 五、未完成与阻塞

1. **同根因另 3 组真泄露未修**（finance 成本 / business-overview 库存金额 / batch-price 预览）——按卡面 §二.3「同病点多于 1 处先停下报备」执行，**等你定范围与单号**；读数已量化（§二）。
2. **根因未根治**：`injectSelectTenant` 的子串短路仍在（本卡口径是调用点显式化）。任何新写的 JOIN 只要带 `tenant_id` 会重新踩坑；`store` 维度的 1052 就是它的第二种表现。建议立项：① 静态门禁（扫描"短路且无显式租户谓词"）；② 评估把短路判据从"子串包含"改为"是否已有租户**谓词**"。
3. `docs/tasks/current-tasks.md` 记账、卡面归档后的路由表 `ACTIVE.md` 收口：按规则由**你**维护，我未动。
4. 无其它阻塞（无外部依赖、无待澄清项）。

## 六、风险与自我报备

1. **我改了 `customer` 维度**（该维度改前可用）：由"依赖自动注入"改为显式 `sb.tenant_id = ?`，**语义等价**（注入本来就是同一条件的无限定版本），目的是消除"注入是否歧义"这一隐式前提——依据是卡面 §三"显式给每个聚合查询加 `AND <别名>.tenant_id = ?`"。若你要求最小 diff，可单独回退这一处 hunk（不影响 product/store 修复与反测）。
2. **反测方式的局限**：本卡禁 push/开 PR，所以反测是**本地同装置**在"摘掉条件"的构建上跑红（等价于制造失败），**没有 CI run 链接**；若你要 CI 侧门禁式反测，需走"分支 + PR"由你发起。
3. **门禁口径提醒**：仓库**根目录没有 `tsconfig.json`**，在根目录执行 `npx tsc --noEmit` 只会打印编译器帮助（退出码 0），**不能当"类型门禁通过"的证据**；正确口径是 `backend/npx tsc -p tsconfig.json --noEmit`。此坑建议进踩坑日志（我未自行改 `踩坑日志.md`）。
4. **意外发现（未改，仅报备）**：`t_product_price` 的唯一键是 `uk_product_price_sku_id (sku_id)`（**全局**唯一，不含 `tenant_id`），夹具给第二个租户建同 SKU 价格行时实测 `ER_DUP_ENTRY 1062` ⇒ 多租户架构下**同一 SKU 无法按租户各自定价**，与租户数据模型口径冲突。
5. 我的扫描器是**正则 + 括号配对**的静态解析，`${}` 插值内容与"SQL 由变量产出"两类看不清（§三 #7/#8 因此误报、#10 未判定）——**未判定的 12 处在结论里已明确标为未判定**，没有把"没看到"写成"没有"。
