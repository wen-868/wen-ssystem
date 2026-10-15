# S3-207 证据包 · 跨租户短路**根治** ＋ 两组真泄露 ＋ 静态门禁 ＋ 12 处非字面量复核

> 工作树 `D:\Users\ZXQL\wt-agents\S3-207`｜分支 `fix/s3-207-tenant-shortcircuit-rootfix`｜基线 `origin/main = 2fe8f109`（含 S3-206 的 `sales-ranking` 修复）
> 本包**未 push / 未开 PR**（红线遵守）；改动已在分支上本地提交，由凌舟复核后决定合并。
> 派单卡：`docs/tasks/inbox/archive/ACTIVE-S3-207-20261015.md`｜回执：`docs/tasks/inbox/ACTIVE-回执-S3-207.md`

## 一、结论（一句话）

S3-206 只把 `sales-ranking` 在调用点显式化，**根因未治**：`config/database.ts` 用子串判断（SQL 里出现 `tenant_id` 字样即跳过注入），
JOIN 的列对列等值 `a.tenant_id = b.tenant_id` 因此被误判成"已有租户条件" ⇒ **整句没有租户过滤**。
本单把判据换成**语句感知的"值谓词"判据**（`backend/src/shared/tenant-scope.ts`）＋两个可登记的显式标记，
**严格收紧**（新跳过集合 ⊂ 旧集合）；同步修掉扫描出的两组真泄露（finance 成本 / business-overview 库存金额），
复核 12 处非字面量（**无新增泄露**，其中 S3-206 标为"值得单独复核"的 `report-export` 报表 SQL 工厂 10 种报表全部自带显式租户谓词），
并新增静态门禁 `guard-tenant-injection.mjs`（阻断步骤、含语料自检与双侧反测）。

**卡面前提更正（已报备）**：卡面 ② 列的"3 组真泄露"里，**第 3 组 `batch-price` 预览不是泄露**——该函数 `conditions` 首项本来就是
`pp.tenant_id = ?`（`backend/src/services/admin/batch-price.service.ts:150-151`），插值后 SQL 含值谓词；
真库实测 A 令牌查 B 的 SKU 命中 **0 条**。真泄露是 **2 组**（finance、business-overview）。

## 二、判据（改后）与边界

| 语句 | 判据（在**完整运行时 SQL** 上判定，含子查询/插值内容） |
|:--|:--|
| SELECT | 值谓词 `tenant_id = ? / = '字面量' / = 数字 / IN (值)`；**列对列等值不算** |
| UPDATE / DELETE | 同上，且必须在**顶层 WHERE 之后**（`SET tenant_id = ?` 是写租户列，不算过滤） |
| INSERT | 列清单显式写 `tenant_id`（含 `INSERT IGNORE`）/ `SET tenant_id = 值` / INSERT…SELECT 的 SELECT 段有谓词 |
| 任意 | 显式标记 `tenant-scope:self`（我已自己写租户条件）/ `tenant-scope:platform`（平台级，故意不带租户过滤）——**必须登记** |

边界（详见 `backend/src/shared/tenant-scope.ts` 顶部 ①~④）：
1. 证明的是**形状**不是**取值**（无法从文本证明 `?` 绑的就是调用者租户）；但**严格收紧**，不劣于旧判据。
2. 收紧后"多表 JOIN + 无值谓词"会从**静默泄露**变成 `ER_NON_UNIQ_ERROR 1052`（**响亮失败**）——这是有意的 fail-loud，已由真库探针 P2 证实。
3. 值谓词出现在**子查询**里也算"已绑定"（覆盖强度弱于外层显式限定）⇒ 门禁把它单列 `WARN-TOKEN-ONLY-IN-SUBQUERY` 供人工复核（当前 0 条）。
4. `tenant_id = (SELECT …)` 这类"右侧是子查询"**不**算（保守从严）。

## 三、改了什么（代码面）

| # | 文件 | 改动 |
|:--:|:--|:--|
| 1 | `backend/src/shared/tenant-scope.ts` | **新增**：判据本体（`shouldSkipTenantInjection` / `hasCallerTenantCondition` / 标记 / 诊断） |
| 2 | `backend/src/config/database.ts` | 三个注入函数的短路判据由 `sql.includes('tenant_id')` 换成 `shouldSkipTenantInjection(sql)` |
| 3 | `backend/src/services/admin/report/finance-report.service.ts` | 两处 JOIN 口径补 `WHERE sb.tenant_id = ?`（占位符顺序 `[tenantId, start, end]`） |
| 4 | `backend/src/services/admin/report/sales-report.service.ts` | `getBusinessOverview` 库存金额补 `WHERE ib.tenant_id = ?` |
| 5 | `backend/src/jobs/report-aggregation.job.ts` | 平台级枚举租户的查询加 `/* tenant-scope:platform */` 显式标记（否则收紧后会被注入 `tenant_id = ''`） |
| 6 | `backend/scripts/guard-tenant-injection.mjs` | **新增**静态门禁（语料自检 + 标记/非字面量登记表 + 漏登检测 + WARN 观察项） |
| 7 | `backend/scripts/fixtures/tenant-scope-corpus.json` | **新增**判据语料（25 例），运行时判据与静态门禁**共读** |
| 8 | `backend/src/__tests__/shared/tenant-scope.test.ts` | **新增**常驻用例（36 例）：核心反例 + 语句边界 + 语料一致性 |
| 9 | `.github/workflows/ci.yml` | 新增阻断步骤 `Tenant injection guard (G37, blocking)`（不新增 job、不改 job 名，避免分支保护 required checks 漂移） |
| 10 | **第二家族**（13 处，见 §五.5）：`admin/cart.service.ts:239/276/377/388`、`miniapp/cart.service.ts:33/70`、`admin/report/product-report.service.ts:122/173/236`、`admin/approval-records.service.ts:372`、`store/member.service.ts:23`、`transfer-execution.service.ts:299/314` | 同根因家族：JOIN 里只有**列对列** `tenant_id` 等值、WHERE 无值谓词 ⇒ 旧判据短路（无租户过滤）；补显式限定谓词（不补则在收紧后注入 ⇒ 多表 1052 会 500） |
| 11 | **平台显式标记**（8 处，见 §五.5）：`admin/subscription.service.ts`（listSubscriptions / getSubscription / changePlan / cancelSubscription / paySubscription）、`admin/subscription-renewal.service.ts`（renewSubscription / listExpiring / listExpired） | 平台侧订阅台账与续费（`/api/platform/subscriptions-management`，`auth=requirePlatformAuth`）⇒ 跨租户是功能本身，加 `/* tenant-scope:platform */` |
| 12 | `backend/scripts/fixtures/tenant-injection-exemptions.json` | **新增**登记表（数据与规则分离）：markers / indirect / singleTable 三张表，逐条写理由 |
| 13 | `docs/evidence/S3-207/tools/*.mjs` | **新增**复核工具：登记表生成器（含失效清理）、BLOCK 分类器（真库 schema 判 1052 风险）、插值逐条核对器、门禁反测脚本 |

## 三点五、门禁自己的一个缺陷（本轮修掉，必须记）

门禁第一版用"括号配对"切实参，**没跳过模板字面量里的顶层逗号** ⇒ 多列 SELECT 列表的 SQL 被截断
（实测 `batch-price.service.ts:206` 被截成 `SELECT sku.id AS skuId`，于是被判"没有 tenant_id 字样"而漏过）。
修法：切实参时识别 `'` / `"` / `` ` `` 字面量并整体跳过（`73-blocking-21-full.txt` 就是修复后新暴露的清单）。
**教训**：静态扫描器自身的解析缺陷会制造"假绿"，与 S3-206 的"扫描器看不到 `${}` 插值"是同族问题 —— 结论必须用两侧核对（静态清单 + 真库读数）交叉验证。

## 四、真库对照读数（同一夹具、同一次运行）

夹具与 S3-206 同口径（A = `default`，B = `s3207t2`，A 侧 8 张单含 DRAFT/VOIDED 反例，B 侧 2 张）：

| 端点 / 探针 | 改前（`wt-agents/S3-206` dist = origin/main） | 改后（本单 dist） | 真值口径 |
|:--|:--|:--|:--|
| `/reports/profit` cost | **120886** = A 20986 + B 99900 | **20986** | A 单独 20986 |
| `/reports/business-overview` inventoryValue | **182096** = A 172096 + B 10000 | **172096** | A 单独 172096 |
| `POST /admin/prices/batch/preview`（A 令牌查 B 的 SKU） | 0 条 | 0 条（**非泄露**） | A 侧 1 条 |
| `sales-ranking` 四维度（S3-206 修复回归） | 仅 A（60260） | 仅 A（60260） | A 单独 60260 |
| 探针 P1 `... WHERE sb.tenant_id = sb.tenant_id` | 读到 **A+B = 8** 张单 | 注入生效 ⇒ **A = 6** 张单 | A 6 / A+B 8 |
| 探针 P2 finance 口径 JOIN（两表都有 tenant_id） | 静默 **120886** | **1052 歧义**（响亮失败） | A 20986 |
| 探针 P3 对照 `tenant_id = ?` | 6（不重复注入） | 6（不重复注入） | A 6 |
| 探针 P4 `tenant-scope:platform` 标记 | 2 个租户 | 2 个租户（标记生效） | — |

原始读数：`raw/7D-harness-second-family.txt`（**20/20 PASS**，含第二家族三项）、`raw/30-harness-fixed.txt`（17/17 PASS）、
`raw/40-injector-probe.json`、`raw/41-second-family-probe.json`、`raw/30-sql-truth.json`。

## 五、12 处非字面量复核（逐条结论）

| # | 位置 | 静态形态 | 结论 |
|:--:|:--|:--|:--|
| 1-5 | `config/database.ts`（`queryWithTenant` 定义行 + `queryOneWithTenant`/`executeWithTenant` 透传） | 首参 `sql` | **库内透传**，无独立 SQL；已登记（定义行按"跳过函数定义"规则排除） |
| 6-7 | `services/admin/cart.service.ts:139/186` | 首参 `sql`（`conn ? conn.query : queryWithTenant` 包装器） | **包装器**；被包装 SQL 无 `tenant_id` 字样 ⇒ 依赖注入；已登记。⚠️ `conn` 分支（事务内）不经注入器 ⇒ 见 §七.4 |
| 8 | `services/admin/miniapp-order-sync.service.ts:61` | 首参带**前导注释行** | 静态误报（注释）；SQL 本身是 `UPDATE … WHERE order_no = ? AND tenant_id = ?` ⇒ **有谓词**（门禁已支持剥前导注释） |
| 9 | `services/admin/report-export.service.ts:186` | `reportQueries[report_type]` 工厂 | **10 种报表全部自带显式租户谓词**（L20/L35/L49/L65/L84/L101/L115/L128/L151/L157，带 JOIN 的一律限定别名）⇒ 无泄露 |
| 10 | `services/miniapp/checkout.service.ts:9` | 同 cart 的 `dbQuery` 包装器 | **包装器**；已登记 |
| 11 | `services/store/inventory.service.ts:108` | 首参 `totalSql`（三元两分支） | 两分支都是 `WHERE tenant_id = ?` ⇒ **有谓词** |
| 12 | `shared/field-sync.ts:343` | 首参 `targetSql`（拼装） | `AND t.tenant_id = ?`（L335）⇒ **有谓词** |

外加 1 处（S3-206 判为 LEAK 但静态展不开）：`services/admin/batch-price.service.ts:189` —— `WHERE ${where}` 插值后含 `pp.tenant_id = ?` ⇒ **非泄露**（已登记 + 真库证据）。

### 五点五、根因收紧的**连带面**（机器枚举 21 条 → 13 处修 + 8 处单表登记 + 9 处平台标记）

门禁解析器修好之后（§三点五），BLOCK 从"被漏判的 0 条"变成 **21 条**。用**真库 schema**
（`information_schema` 里带 `tenant_id` 列的表）逐条判"注入会怎样"（工具 `tools/analyze-blocking.mjs`，原始清单 `raw/73-blocking-21-full.txt`）：

| 类别 | 处数 | 处理 | 依据 |
|:--|:--:|:--|:--|
| **≥2 张带 tenant_id 列的表**（注入 `tenant_id = ?` ⇒ `ER_NON_UNIQ_ERROR 1052` ⇒ 500） | **13** | **补显式限定谓词** | 不补的话收紧后这些端点会由"静默无租户过滤"变成"直接 500"；补谓词同时把真泄露修掉 |
| 单表（注入补的正是正确谓词，不歧义） | 4 | 逐条**登记**（`singleTable`），不改代码 | `t_print_record`×2（按主键读）、`t_customer_visit`×2（明细，工作台侧） |
| 平台级（跨租户是功能本身） | 8 | 加 `tenant-scope:platform` 显式标记 | `subscription*` 两个服务（`/api/platform/subscriptions-management`，`auth=requirePlatformAuth`） |

13 处补谓词明细（占位符一律插在**其所在位置**，见各文件行内注释）：
`admin/cart.service.ts:239/276/377/388`、`miniapp/cart.service.ts:33/70`、
`admin/report/product-report.service.ts:122/173/236`、`admin/approval-records.service.ts:372`、
`store/member.service.ts:23`、`transfer-execution.service.ts:299/314`。

真库复核（`harness.mjs` §[7]，`raw/7D-harness-second-family.txt`）：
· [7a] 库存汇总补谓词后 ⇒ **无 1052 且金额 = 172096 = 仅 A 侧真值**（含 B 会是 182096）；
· [7b] 同一句**摘掉**谓词 ⇒ **1052 歧义**（证明这批修复是承重的，不是装饰）；
· [7c] 购物车明细补谓词后 ⇒ **无 1052**。

**26 处**"插值/非字面量"调用点全部登记（`indirect`），其中 **15 条多表插值**逐条打开核对过 where 构造
（`tools/verify-interp.mjs` → `raw/7A-verify-interp.txt`）：14 条 where 构造里确有显式租户谓词（如 `["pp.tenant_id = ?"]`）；
**1 条例外** —— `subscription.service.ts` 的 `listSubscriptions` 租户条件是可选的**查询筛选**（`filters.tenantIdQuery`），
不是调用者租户 ⇒ 已改平台标记（否则平台列表在不带筛选时会 1052）。

## 六、反测（故意造失败）

| 反测 | 动作 | 结果 | 日志 |
|:--|:--|:--|:--|
| 门禁·离线夹具（可复跑） | 夹具1 合规 / 夹具2 违规 / 夹具3 未登记标记 / 夹具4 复原 | 4/4 符合预期 | `raw/71-guard-reverse-test.txt` |
| 门禁·源码侧 | 把 finance 的 `sb.tenant_id = ?` 改成 `WHERE 1 = 1` | **EXIT=1**，点名 `finance-report.service.ts:210/268` | `raw/50-reverse-guard-red.txt` |
| 运行时·源码侧 | 同上 + 重新构建 | `/reports/profit` **500**（1052），harness `PASS 16 / FAIL 1` | `raw/51-reverse-harness-red.txt` |
| 复原 | `git checkout HEAD -- finance-report.service.ts` | 门禁 **EXIT=0**；harness **17/17 PASS** | `raw/52-restore-guard-green.txt`、`raw/53-restore-harness-green.txt` |

## 七、复跑命令（照抄可跑；MySQL 8 在 127.0.0.1:3408）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-207
npm ci                                     # 一次性（工作树新建后）
npm --workspace backend run build          # 1) 产出 dist（装置与探针跑 dist）
node docs/evidence/S3-207/harness.mjs      # 2) 建库 → 起后端 → 夹具 → 真 HTTP → 交叉核对 → 注入器对照探针（EXIT=0 全绿）
node docs/evidence/S3-207/tools/reverse-test-guard.mjs   # 3) 门禁双侧反测（离线夹具，4/4）
node backend/scripts/guard-tenant-injection.mjs --self-test  # 4) 判据语料自检（25 例）
node backend/scripts/guard-tenant-injection.mjs              # 5) 全仓静态扫描（EXIT=0）
cd backend
npx vitest run                             # 6) 全量单测（664 文件 / 8035 用例）
npx tsc -p tsconfig.json --noEmit          # 7) 类型门禁（注意：仓库根没有 tsconfig.json，必须在 backend/ 下跑）
node scripts/guard-route-auth.mjs          # 8) G3
node scripts/guard-tenant-status.mjs       # 9) G2
node scripts/guard-route-prefix.mjs        # 10) 前缀门禁
node scripts/guard-utf8-encoding.mjs       # 11) 编码门禁
node scripts/guard-rbac-wiring.mjs --strict # 12) RBAC 接线
```

## 八、输入指纹（防"跑错工作树 / 并行会话改了同一棵树"）

| 文件 | sha256(前 16) |
|:--|:--|
| `backend/src/config/database.ts` | 见 `raw/40-injector-probe.json` → `sha.fixedSrc` |
| `backend/src/shared/tenant-scope.ts` | 同上 |
| `backend/dist/config/database.js`（装置实际运行产物） | 见 `sha.fixedDist` |
| 基线对照 dist（`wt-agents/S3-206/backend/dist/config/database.js`） | 见 `sha.baselineDist` |
| 本单提交 | `05a6368f`（根因＋两组泄露＋门禁＋语料）、`c81e8711`（证据包＋CI 接线）、`3358a9e0`（**由另一会话在本人工作树内提交**，见 §十）、`92879647`（连带面 13 处 + 平台标记 8 处 + 登记表）|

## 十、并发写入事件（必须留痕的异常）

`3358a9e0`（`chore(S3-207): 收尾证据与 CI 接线入账`，提交者显示为 **墨**，2026-10-15 19:46:34）
**不是我提交的**：当时我正在同一工作树里跑装置/单测，该提交把我的在途改动（门禁解析器修复、证据 `raw/*`）
`git add -A` 提交了。影响：内容未丢失、未覆盖（经 `git show --stat` 核对：只含本人的门禁与证据文件，无第三方改动），
但**署名与提交边界被混入**。已按 ACTIVE.md「一个单只允许一个会话写一个工作树」的口径上报凌舟核查是谁在并发写。

## 九、未覆盖 / 范围外（登记，不代做）

1. **6 处 `AUTO-INJECT+JOIN` 观察项**（`credit-collection:184`、`inventory-share:210`、`price-review:84`、`report-collection:78`、`report.service:330`、`supplier:684`）：
   依赖自动注入且是多表 JOIN ⇒ 注入的是**无限定列名** `tenant_id = ?`，第二张表也有该列时 1052。门禁以 `WARN-AUTO-INJECT-JOIN` 打印（不阻断）。
   根治方案建议：注入时按 FROM 首表别名**限定列名**（另立单，本单按"只动判据"的口径未改注入机制）。
2. **事务路径**：`transaction()` 里 `conn.query` 只补 `t_` 前缀、**不经租户注入器**（`cart.service.ts`/`checkout.service.ts` 的 `conn` 分支即此口径）⇒ 事务内 SQL 靠调用方显式谓词。既有架构口径，未改。
3. `t_product_price` 唯一键 `uk_product_price_sku_id (sku_id)` 全局唯一 ⇒ 同 SKU 无法多租户各自定价（S3-206 已登记，本单复现）⇒ 影响夹具构造，未改。
4. 生产库零写操作；本装置只动 `s3207_main`（前缀守卫在装置内强制）。
