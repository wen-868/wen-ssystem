# S3-206 证据包 · P0：`sales-ranking` 跨租户聚合越界（＋同根因全仓扫描）

> 工作树 `D:\Users\ZXQL\wt-agents\S3-206`｜分支 `fix/s3-206-cross-tenant-ranking`｜基线 `origin/main = 36a7a02f`
> 本包**未 push / 未开 PR**（红线遵守）；改动已在分支上本地提交，由凌舟复核后决定合并。
> 派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-206-20261015.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-206.md`

## 一、结论（一句话）

缺陷**确认成立**且不止一处：`queryWithTenant` 的自动注入是**子串判断**——SQL 文本里任何位置出现 `tenant_id`
（例如 JOIN 的 `ON ... AND sb.tenant_id = sbi.tenant_id`）就**整体跳过注入**；`sales-ranking` 的 `product` 维度正是这种写法，
于是**完全没有租户过滤**，A 租户令牌读到 A+B 的合并聚合（实测 `1013 瓶 / 101805 元` = A `14/1806` + B `999/99999`）；
同端点的 `store` 维度则被"注入无限定列名 `tenant_id = ?`"打成 **500**（`ER_NON_UNIQ_ERROR 1052`）。两处均已修。
同根因**全仓扫描**另发现 4 类真实越界（成本、库存金额、批量调价预览，已量化），**按卡面 §二.3 停下报备，未改**。

## 二、根因（静态证据）

| 位置 | 代码 | 说明 |
|:--|:--|:--|
| `backend/src/config/database.ts:214-246` | `injectSelectTenant()` 首行 `if (sql.toLowerCase().includes('tenant_id')) return sql;` | **子串判断 ⇒ 短路**：只要 SQL 里出现 `tenant_id` 字样就不注入 |
| `backend/src/config/database.ts:226-245` | 无 WHERE 时注入**无限定列名** `WHERE tenant_id = ?` | 多表 JOIN 且两表都有该列 ⇒ 列名歧义 500 |
| `backend/src/services/admin/report/sales-report.service.ts:350-363`（改前） | `JOIN t_sale_bill sb ON sb.bill_no = sbi.bill_no AND sb.tenant_id = sbi.tenant_id`，WHERE 里**无**租户谓词 | 短路 + 无显式过滤 = **跨租户聚合** |

## 三、修复（本卡范围：`getSalesRanking` 四个维度）

`backend/src/services/admin/report/sales-report.service.ts`：四个维度**统一显式**租户谓词 `WHERE sb.tenant_id = ?`（`staff` 维度原本就有），
占位符顺序 = `[tenantId, start, end, lim]`；不再依赖"SQL 里恰好有/没有 tenant_id 字样"这一隐式行为。
配套单测 `backend/src/__tests__/services/admin/report/sales-report.test.ts`：新增 4 条参数化用例，
锁住"每个维度的 SQL 含 `sb.tenant_id = ?` 且首参为 tenantId"（摘掉即变红）。

## 四、原始读数（`raw/`）

| 文件 | 关键读数 |
|:--|:--|
| `harness-run-prefix.txt` | **修复前**基线：`product` 维度读数 `1013 瓶/101805 元`（= A+B）、`store` 维度 **500**；`FAIL 5 / EXIT=1` |
| `harness-run-fixed.txt` | **修复后**：`PASS 10 / FAIL 0 / EXIT=0`；product `14 瓶/1806 元`（= A 单独）、四维度合计 `60260`（= A 单独）；范围外 2 项仍红（见下） |
| `harness-run-countertest-product.txt` | **反测**：在修复后代码上"摘掉 product 维度显式租户条件" ⇒ `5b/5c` 变红（`1013/101805`）、其余维度仍绿、`FAIL 2 / EXIT=1` |
| `10-sales-ranking-*.json` | 四个维度的接口原始响应（修复后） |
| `20-profit.json` | `/reports/profit` ⇒ `cost = 120886` = A `20986` + B `99900`（**跨租户成本**，同根因，本卡未修） |
| `23-business-overview.json` | `/reports/business-overview` ⇒ `inventoryValue = 182096` = A `172096` + B `10000`（**跨租户库存金额**，同根因，本卡未修） |
| `30-sql-truth.json` | SQL 直查真值（A 单独 / B 单独 / A+B 合并，含库存与成本口径） |
| `scan-tenant-shortcircuit.json` | 同根因全仓扫描全量机读结果（789 文件 / 1747 调用点） |
| `server.log` | 真实后端启动 + 报错日志；`store` 维度 500 的原始行在内（`ER_NON_UNIQ_ERROR` / `sqlMessage: Column 'tenant_id' in where clause is ambiguous`） |
| `gate-build.txt` / `gate-vitest.txt` | 门禁原始输出（build / vitest 全量） |

## 五、同根因扫描（本卡最重要的产出）

扫描器：`docs/evidence/S3-206/scan-tenant-shortcircuit.mjs`（静态解析 `queryWithTenant` / `queryOneWithTenant` / `executeWithTenant`
的首参 SQL，判定：① 是否出现 `tenant_id` 字样（会不会短路）；② 是否有**真正的租户过滤谓词**；③ 实参是否真带租户值）。
结果：**1747 个调用点**中，`LEAK 候选 7`、`可疑 14`（均为 INSERT 显式写列，正常）、`AUTO-INJECT+JOIN 6`、`非字面量 12`。

| # | 位置 | 判定 | 结论 |
|:--:|:--|:--|:--|
| 1 | `report/sales-report.service.ts:334`（`getSalesRanking` product） | **真泄露** | **本卡已修**（读数见上） |
| 2 | `report/sales-report.service.ts:381`（`getSalesRanking` store） | **真 500** | **本卡已修**（原 500 → 200） |
| 3 | `services/admin/report/finance-report.service.ts:210`、`:264` | **真泄露** | 未修；量化为 `/reports/profit.cost = A+B`（120886 vs A 20986） |
| 4 | `report/sales-report.service.ts:497`（`getBusinessOverview` 库存金额） | **真泄露** | 未修；量化为 `inventoryValue = A+B`（182096 vs A 172096） |
| 5 | `services/admin/batch-price.service.ts:189`、`:206` | **真泄露** | 未修；`JOIN ... AND sku.tenant_id = pp.tenant_id`、WHERE 只拼业务条件、实参无 tenantId ⇒ 批量调价**预览跨租户** |
| 6 | `jobs/report-aggregation.job.ts:7` | 有意为之 | 平台级作业枚举全部租户（`SELECT DISTINCT tenant_id`），**不需修** |
| 7 | `services/admin/marketing-coupon.service.ts:361/371` | 误报 | 租户过滤在 `JOIN ... AND ct.tenant_id = ?` 且 `${where}` 里也有 `ct.tenant_id = ?`；实测端点 `code=0`（扫描器看不到插值内容 ⇒ 误报） |
| 8 | `services/sale-return.service.ts:176` | 误报 | `where` 恒以 `WHERE sr.tenant_id = ?` 开头（插值，扫描器不可见）；JOIN 里的 `s.tenant_id = ?` 冗余但无害 |
| 9 | `AUTO-INJECT+JOIN` 6 处（credit-collection:184 / inventory-share:210 / price-review:84 / report-collection:78 / report.service:330 / supplier:684） | **观察项** | 依赖注入且是 JOIN：若同 JOIN 的第二张表也有 `tenant_id`，会重演 `store` 维度的 1052 歧义 500；本次未逐条验证（未造夹具） |
| 10 | `非字面量 12 处`（SQL 由变量/工厂产出，如 `report-export.service.ts:186` 的 `reportQueries[...]`） | **未判定** | 扫描器无法静态展开；`report-export` 的报表 SQL 工厂值得单独复核 |

## 六、复跑命令（照抄可跑；MySQL 8 在 127.0.0.1:3408）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-206
npm ci                                     # 一次性（工作树新建后）
npm --workspace backend run build          # 1) 产出 dist（装置跑 dist）
node docs/evidence/S3-206/harness.mjs      # 2) 建库 → 起后端 → 夹具 → 真 HTTP → 交叉核对（EXIT=0 即全绿）
node docs/evidence/S3-206/scan-tenant-shortcircuit.mjs   # 3) 同根因全仓扫描
cd backend
npx vitest run                             # 4) 全量单测（663 文件 / 7999 用例）
npx tsc -p tsconfig.json --noEmit          # 5) 类型门禁
node scripts/guard-route-auth.mjs          # 6) G3
node scripts/guard-tenant-status.mjs       # 7) G2
node scripts/guard-route-prefix.mjs        # 8) G36
node scripts/guard-utf8-encoding.mjs       # 9) 编码
node scripts/guard-rbac-wiring.mjs --strict # 10) RBAC 接线
```

## 七、输入指纹（防"跑错工作树 / 并行会话改了同一棵树"）

| 文件 | sha256(前 16) |
|:--|:--|
| `backend/src/services/admin/report/sales-report.service.ts` | `7BD70862B765D739` |
| `backend/dist/services/admin/report/sales-report.service.js`（装置实际运行产物） | `AC63F78340FE5A1F` |
| `backend/src/config/database.ts`（只读参考，未改动） | `6FF19BE2760EF1D8` |
| HEAD | `58bc2a1e`（fix 提交） |

## 八、未覆盖范围（明确登记，等凌舟定范围/单号）

1. 上表 #3/#4/#5 三组**真泄露未修**（成本、库存金额、批量调价预览）——按卡面 §二.3「同病点多于 1 处先停下报备」执行。
2. 根因**未根治**：`injectSelectTenant` 的子串判断仍在（本次按卡面口径在调用点显式化，未动 `database.ts`）。
   影响面：任何**新写**的 JOIN 只要带 `tenant_id` 就重新踩坑；建议另立门禁条目（静态扫描"短路且无显式谓词"）。
3. `t_product_price` 唯一键 `uk_product_price_sku_id (sku_id)` 是**全局**唯一 ⇒ 多租户同 SKU 无法各自定价（本次夹具实测 `ER_DUP_ENTRY 1062`），
   与租户数据模型口径冲突，未改（范围外发现）。
