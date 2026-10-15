# ACTIVE-回执 · S3-209（销售单取消端点 —— AI 底座 `cancelSalesOrder` 唯一阻塞项）

【汇报 S3-209】**端点已按契约交付并**真库真 HTTP **验收**：`POST /api/admin/sale-bills/:billNo/cancel` 可用（作废 + 库存回滚 + 幂等 + 租户隔离 + source 落库），新立权限码 `sale:cancel` 已登记；25 项真库判据全绿、全量单测 8023 例 0 failed、五道既有门禁 EXIT=0。

- 汇报对象：**凌舟（总负责人）**
- 汇报人：**阿坚（后端，执行方）**｜**2026-10-15**
- 对应派单编号：**S3-209**｜派单卡：`docs/tasks/inbox/ACTIVE-S3-209.md`（已归档为 `archive/ACTIVE-S3-209-20261015.md`）
- 会话/身份：`/root/s3213_ajian`（环境未注入 task_name，按 `ACTIVE.md` 路由表 + `state_5.sqlite` 的 `agent_path` 自证）
- 工作树：`D:\Users\ZXQL\wt-agents\S3-209`｜分支 `feat/s3-209-sale-bill-cancel`｜基线 `origin/main = 2fe8f109`｜HEAD `cdf60eb4`｜工作区干净
- **未 push、未开 PR**（红线遵守）｜关键指纹（sha256 前 16）：`sale-bill.service.ts = eaea6a5d955d27b6`｜`admin-order.routes.ts = 78fca16cf15aae44`｜`order.controller.ts = 32d876a9ef80b205`｜`sale-permission-codes.ts = 2e96f49791dd426b`｜`202 迁移 = c4c9d3807ea68b0a`｜`203 迁移 = 77c24f6b0e6cf2d4`

---

## 一、交付物（逐条，含产出文件路径 + 提交哈希）

| # | 文件 | 改动 | 说明（哪里有问题 / 改了什么 / 为什么） |
|:--:|:--|:--|:--|
| 1 | `backend/src/routes/admin-order.routes.ts` | 新增 1 行注册 | `POST /sale-bills/:billNo/cancel` + `requirePermission(PERM_SALE_CANCEL)`。放在该文件既有的「销售单管理」段（`/sale-bills`、`/sale-bills/export-csv` 之后，同前缀 `/api/admin`）⇒ 不新建路由文件、不动挂载与前缀治理 |
| 2 | `backend/src/controllers/admin/order.controller.ts` | 新增 1 个 handler + 1 个 zod schema | `cancelSaleBill`：`reason?`（≤255）、`source`（`z.enum(["admin","ai"])` 缺省 `admin`）。校验失败走既有 ZodError ⇒ 400 + **字段级 `errors:[{field,message,code}]`**（= R101-AI-27 的透传口径，无需另造格式） |
| 3 | `backend/src/services/store/sale-bill.service.ts` | 新增 `cancelSaleBill()`（+4 个事务行类型） | 同一事务内：取单 `FOR UPDATE` → 幂等短路 → 状态判据 → **库存回滚**（按 `SALE_OUT` 负流水反向，写 `SALE_CANCEL` 正流水，幂等键 `SALE_CANCEL:<billNo>:<skuId>`）→ 作废 `VOIDED` + 收款状态 `CLOSED` → 操作日志（含 `source`）。**逐句显式 `tenant_id = ?`**（事务路径不经租户注入器，S3-207 §七.4 已报备） |
| 4 | `backend/src/shared/sale-permission-codes.ts` | **新增** | 常量 `PERM_SALE_CANCEL = "sale:cancel"` + 立码依据/持有者/授权方式注释（对齐 `goods-permission-codes.ts` / `library-permission-codes.ts` 既有约定） |
| 5 | `docs/migrations/202_销售单取消来源列.sql` | **新增**（DDL） | `t_sale_bill.void_source VARCHAR(16) NOT NULL DEFAULT 'admin'`（`AFTER void_reason`，中文 COMMENT）。纯 DDL 零 DML ⇒ 启动期即生效；幂等（`information_schema` 判存在）；回滚一句 |
| 6 | `docs/migrations/203_销售单取消权限点.sql` | **新增**（立码 / 数据写） | 向 `t_sys_menu` 登记 `sale:cancel`（BUTTON，父行按 `menu_code='sale:record'` 逐租户定位，`sort_no=3`）；幂等判据 `(menu_code,tenant_id)`；父行缺失整条跳过（不插孤儿行）。⚠️ 必须 `node scripts/run-migration.mjs` 执行（默认写闸门 `block` 会跳过） |
| 7 | `backend/src/__tests__/services/store/sale-bill-cancel.test.ts` | **新增** 12 例 | 正常/PARTIAL/未出库/幂等（锁死"重复取消只回滚一次"）/PAID·RETURNED·域外状态拒绝/租户隔离 404/原子性/`FOR UPDATE`/source 两态落库 |
| 8 | `backend/src/__tests__/routes/s3-209-sale-cancel-wiring.test.ts` | **新增** 12 例 | 401 / 无码 403（READONLY、SALES_STAFF、STORE_OPERATOR、持 `sale:void` 对照组）/ 有码 200（精确码、`sale:*`、SUPER_ADMIN）/ CSRF 缺失 403 / **注册行形状断言** / `routeConfig.auth` 声明 |
| 9 | `docs/evidence/S3-209/harness.mjs` + `README.md` + `raw/**` | **新增** 证据包 | 真库真 HTTP 装置（重建 `s3209_main` → 起真实后端 → 夹具 → 真跑 203 两遍 → 7 组验收 → SQL 真值 → 汇总）＋ 逐项原始输出 |
| 10 | `docs/API接口文档.md` | 新增契约块 | `/api/admin/sale-bills/:billNo/cancel` 的路径/入参/可取消条件/幂等/出参/错误/副作用（含 `status=CANCELLED` 与 `businessStatus=VOIDED` 的双字段口径说明） |
| 11 | `docs/数据库变更清单.md` | 新增「2026-10-15 补登」段 | 登记 202（DDL，启动期生效）与 203（立码，需 run-migration + 幂等实测）|
| 12 | `backend/src/__tests__/routes/rbac-g0-wiring.test.ts` | **快照同步**（+S3_209_WIRED_FILES，总数 81 → 82） | 该文件是「全量 `requirePermission(` 计数」快照，新增 1 处接线必须同步；**G0 名单行与其逐行 403/200 断言一字未动** |
| 13 | `backend/src/__tests__/shared/migration-c6-4-1.test.ts` | **快照同步**（`EXPECTED_MAX_MIGRATION` 201 → 203） | 迁移编号不变量：本单新增 202/203 ⇒ 最高编号变化；190/191 的"各一号 + 最高唯一"判据本身未改 |

**零前端改动、零 `.github/**`、零 `deploy/**`、未改 `R101-收口总清单.md`、未改 `docs/tasks/current-tasks.md`（并发在途，见 §七.8）。** 生产库**零写操作**（只读未连；装置仅建/写 `s3209_main` 夹具库）。

---

## 二、证据（可复跑：命令 + 原始输出 + 行号 / 文件路径）

复跑清单见 `docs/evidence/S3-209/README.md`。MySQL 8 在 `127.0.0.1:3408`。

| 判据 | 命令 | 读数（原始文件） |
|:--|:--|:--|
| **真库真 HTTP 25 项** | `node docs/evidence/S3-209/harness.mjs` | `raw/99-summary.json`：**25 PASS / 0 FAIL，EXIT=0** |
| §三.1 正常取消 + 库存回滚 | 同上 §[3①] | `raw/40-cancel-normal.json`：200 → `status=CANCELLED` / `businessStatus=VOIDED` / `reversedItems=[{skuId:11,quantity:10}]`；**库存 90 → 100**；`collection_status=CLOSED`、`void_reason='客户不要了'`；`SALE_CANCEL` +10 一条、`SALE_OUT` 仍 -10 |
| §三.2 幂等（只回滚一次） | 同上 §[3②] | `raw/41-cancel-idempotent.json`：第二次 **200 + `idempotent:true` + `reversedItems:[]`**；**库存 20 → 24 → 24**；`SALE_CANCEL` 流水仍 **1** 条 |
| §三.3 PAID ⇒ 400 | 同上 §[3③] | `raw/42-cancel-paid-reject.json`：**400** `"该销售单已结清，不能直接取消，需走冲销流程"`；状态仍 `CREATED/PAID`、**库存 50 → 50** |
| §三.4 原子性 | 同上 §[3④] | `raw/43-cancel-atomicity.json`：预置同幂等键 ⇒ **409**；单**未作废**、**库存 60 → 60**、无新增流水（同事务内的库存 UPDATE 已回滚） |
| §三.5 权限 403 / 200 | 同上 §[3⑤] + `npx vitest run src/__tests__/routes/s3-209-sale-cancel-wiring.test.ts` | `raw/44-cancel-permission.json`：无码 ⇒ **403**（`无权限执行此操作，需要权限: sale:cancel`，单未动）；`sale:*` ⇒ **200** 且单确实 `VOIDED`；PARTIAL ⇒ 200；未登录 ⇒ **401**。单测 12/12 过（含 `sale:void` 持有人对照组 ⇒ 403） |
| §三.6 租户隔离 | 同上 §[3⑥] | `raw/45-cancel-tenant-isolation.json`：A 令牌取消 B 租户单 ⇒ **404**「销售单不存在」；B 的单仍 `CREATED`、**B 库存 70 → 70** |
| §三.7 source 落库 | 同上 §[3⑦] | `raw/46-cancel-source.json`：`source:'ai'` ⇒ `void_source='ai'` + 操作日志 `after_data.source='ai'`；缺省 ⇒ `void_source='admin'`（各一次） |
| **立码 203 真跑 + 幂等** | 装置 §[2b]（内部调 `node scripts/run-migration.mjs docs/migrations/203_销售单取消权限点.sql` 两遍） | `raw/20-migration-203.txt`：两遍均 exit 0；`sale:cancel` 菜单行 **1 → 1**（第二遍零变更） |
| 迁移 202 生效 + 203 被写闸门跳过 | 装置启动期 | `raw/server.log`：启动迁移全程无 `失败` 字样（形状与 CI `migration-check` 的 `grep -q "失败"` 同口径） |
| **反测 A（幂等判据会红）** | 把 `if (bill.business_status === "VOIDED")` 改成 `if (false && …)` ⇒ 跑单测 | **1 failed / 11 passed**，命中的正是「已 VOIDED ⇒ 不再写库存/不写流水/不改单」。复原 ⇒ 12/12 过 |
| **反测 B（权限接线会红）** | 摘掉注册行的 `requirePermission(PERM_SALE_CANCEL)` ⇒ 跑接线单测 + `guard-rbac-wiring --strict` | 单测 **5 failed / 7 passed**（4 条 403 + 形状断言）；`--strict` **EXIT=1** 且点名 `admin-order.routes.ts:31 POST /api/admin/sale-bills/:billNo/cancel ⇒ 无权限检查`、「未登记缺口 1 条」。复原 ⇒ 单测 12/12、`--strict` **EXIT=0**（已登记欠账 680 条不变）｜原始输出 `raw/93-guards.txt` 尾段 |
| **全量单测** | `cd backend && npx vitest run` | `raw/90-vitest-full.txt`：**665 文件 / 8023 用例 / 0 failed，EXIT=0** |
| 类型 / 静态 / 构建 | `npx tsc -p tsconfig.json --noEmit`；`npm run lint`；`npm --workspace backend run build` | `raw/91-tsc.txt` **0 错**；`raw/92-lint.txt` **0 error**（166 条存量 warning）；`raw/94-build.txt` **EXIT=0** |
| 五道既有门禁 | `node scripts/guard-route-auth.mjs` / `guard-tenant-status.mjs` / `guard-route-prefix.mjs` / `guard-utf8-encoding.mjs` / `guard-rbac-wiring.mjs --strict` | `raw/93-guards.txt`：**五条全 EXIT=0**（路由前缀门禁：重复前缀 12 个均已登记、未登记 0、真重复端点 0；编码门禁：2141 文件 0 非法字节）|
| 第五道（租户注入，跨工作树） | `cd D:\Users\ZXQL\wt-agents\S3-207; node backend/scripts/guard-tenant-injection.mjs D:/Users/ZXQL/wt-agents/S3-209` | `raw/80-tenant-injection-guard.txt`：**RED 23 项全部是 main 存量项**（17 BLOCK + 6 未登记，全是 S3-207 自己分支修掉的那批），**本单新增/改动文件 0 命中**（见 §三.4）|

---

## 三、验收自评（逐条对照派单卡 §三）

1. **§三.1 正常取消**：✅ 通过 —— 200 + `status=CANCELLED` + 库存回滚（**90 → 100**，与出库量一致），改前/改后真值均在 `raw/40`。
2. **§三.2 幂等**：✅ 通过 —— 重复取消返回既有结果、**库存不再变化（20 → 24 → 24）**、流水仍 1 条；单测用例锁死该行为（反测 A 证明它会红）。
3. **§三.3 状态拒绝**：✅ 通过 —— PAID ⇒ **400** + 可读文案（含"冲销流程"），单与库存零改动。
4. **§三.4 原子性**：✅ 通过 —— 构造中途失败（幂等键冲突）⇒ 报错、**单未作废、库存未动**（同事务内先做的库存 UPDATE 一并回滚）。
5. **§三.5 权限**：✅ 通过 —— 无 `sale:cancel` ⇒ **403**；有码（精确码 / `sale:*`）⇒ **200**；未登录 ⇒ 401；CSRF 缺失 ⇒ 403。
6. **§三.6 租户隔离**：✅ 通过 —— A 令牌取消 B 的单 ⇒ **404**（文案不泄露存在性），B 侧零改动。
7. **§三.7 `source` 落库**：✅ 通过 —— `ai` 与缺省 `admin` 各一次，`void_source` + 操作日志 `after_data.source` 双处可见。
8. **§三.8 门禁**：⚠️ **部分通过（有一处卡面前提不成立，见 §七.5）** —— 全量 `npx vitest run` **0 failed**、`npx tsc --noEmit` **0 错**、"三条 guard"（route-auth / tenant-status / route-prefix，另加 utf8-encoding）**EXIT=0**、`guard-rbac-wiring --strict` **EXIT=0**、`npm --workspace backend run build` **EXIT=0**；**`guard-tenant-injection` 在 `origin/main` 上不存在**（S3-207 分支交付物，尚未合并）⇒ 只能跨工作树只读调用，结果 RED 23 项全为 main 存量、本单 0 命中。

**结论先行**：本单满足卡面全部可执行判据；唯一偏差是 §三.8 里引用的一个门禁脚本不在本单基线上（不是本单未做）。

---

## 四、契约实现对照（卡面 §二 逐条）

| 卡面要求 | 实现 | 备注 |
|:--|:--|:--|
| 路径 `POST /api/admin/sale-bills/:billNo/cancel`，与 `batch-collection-link` 同前缀 | ✅ 逐字实现（注册在 `admin-order.routes.ts` 的销售单管理段，前缀 `/api/admin`） | 未另起路径 |
| 入参 `reason?` + `source: 'admin' \| 'ai'`（缺省 admin） | ✅ zod：`reason` ≤255 可选、`source` 枚举缺省 `admin` | 与 S3-204 价格历史同口径 |
| 仅 `UNPAID` / `PARTIAL_PAID` 可取消；`PAID` ⇒ 400 + 可读文案 | ✅ 生效于 `collection_status ∈ {UNPAID, PARTIAL}`；`PAID` ⇒ 400「需走冲销流程」 | 卡面 `PARTIAL_PAID` = 本库既有取值 **`PARTIAL`**（见 §七.2） |
| 幂等：已取消 ⇒ 返回既有结果，绝不二次回滚 | ✅ 状态判据 + 流水幂等键唯一索引双保险，用例锁死 | 反测 A |
| 原子性：作废 + 库存回滚 + 应收/提成调整同事务 | ✅ 同事务；应收与提成**均为按 `business_status` 过滤的派生统计** ⇒ 置 `VOIDED` 即自动出表（无独立应收/提成表行可调，见 §七.3） | —— |
| 权限：先立 `sale:cancel` 码，再挂 `requirePermission` | ✅ 立码（203 迁移 + 常量文件）+ 挂码（路由注册行） | 生产 `STORE_MANAGER` 含 `sale:*` ⇒ 店长可取消 |
| 出参 `{ billNo, status:'CANCELLED', reversedStock, ... }` | ✅ `{ billNo, status:"CANCELLED", businessStatus:"VOIDED", collectionStatus:"CLOSED", reversedStock, reversedItems, source, reason, idempotent }` | 双字段见 §七.1 |
| 错误：字段级 `errors[]` | ✅ 入参校验失败 ⇒ 400 + `errors:[{field,message,code}]`（既有 ZodError 通道，R101-AI-27 口径） | 业务状态拒绝为 `fail(msg,"400")` 形态（与既有端点一致） |
| 租户隔离：`requireAuthWithTenant` + **显式** `tenant_id` 谓词 | ✅ routeConfig 沿用 `requireAuthWithTenant`；事务内每句 SQL 均显式 `tenant_id = ?` | 反例：A 令牌取消 B 单 ⇒ 404 |

---

## 五、未完成与阻塞

1. **无技术阻塞**：交付物 1–13 全部完成；七组验收判据 + 立码 + 全量门禁 + 双侧反测全绿。
2. **未 push / 未开 PR**（红线）：故本轮没有 CI run 链接；门禁反测为**源码侧红/绿各一次**（`raw/93-guards.txt` 尾段、单测反测 A/B）。若你要 CI 侧反测（分支 + PR 造错 ⇒ 断言目标步骤 failure），请按你的口径发起，我配合。
3. **203 迁移未在生产执行**（本单只产出）：需你在生产跑 `node scripts/run-migration.mjs docs/migrations/203_销售单取消权限点.sql`（默认写闸门会静默跳过该 INSERT）⇒ 执行后 `SELECT COUNT(*) FROM t_sys_menu WHERE tenant_id='default' AND menu_code='sale:cancel'` 应为 1。
4. **`docs/tasks/current-tasks.md` 未改**：该文件当前是"已修改未提交"状态（含别的会话在途内容），且其中没有 S3-2xx 条目 ⇒ 避免并发覆盖，交你统一记账（同 S3-207 的处置）。
5. **未做（卡外）**：冲销流程（卡面明示不在本单）、AI 侧 `cancelSalesOrder` 工具落点（属 AI 仓库）、前端取消按钮（本单只做后端端点）。

---

## 六、验收判据逐条命令（便于你复核）

```powershell
cd D:\Users\ZXQL\wt-agents\S3-209
git log --oneline -1                       # cdf60eb4
npm ci --legacy-peer-deps                  # 若工作树缺 node_modules
npm --workspace backend run build          # 装置跑 dist
node docs/evidence/S3-209/harness.mjs      # 25 PASS / 0 FAIL，EXIT=0
cd backend
npx vitest run                             # 665 文件 / 8023 用例 / 0 failed
npx tsc -p tsconfig.json --noEmit          # 0 错
npm run lint                               # 0 error
node scripts/guard-route-auth.mjs ; node scripts/guard-tenant-status.mjs ; node scripts/guard-route-prefix.mjs ; node scripts/guard-utf8-encoding.mjs ; node scripts/guard-rbac-wiring.mjs --strict
```

---

## 七、风险与自我报备

1. **口径冲突①：卡面 `status:'CANCELLED'` vs 本库 `business_status='VOIDED'`（我做了双字段，需你确认）**
   证据：`t_sale_bill.business_status` 的既有值域是 `DRAFT/CREATED/COMPLETED/VOIDED/RETURNED`（`init_database.sql:717`、`migration.ts:960`），
   **没有** `CANCELLED`；且全仓 6 处统计口径（`receivable.service.ts:130/137`、`shift.service.ts`、`store-control-scheduler.ts`、
   `member.service.ts`、`commission.service.ts:194`、`platform.service.ts:19`）一律以 `business_status NOT IN ('DRAFT','VOIDED')` 过滤。
   若按卡面字面把落库值写成 `CANCELLED`，已取消的单会**继续计入应收/提成/销售排行**（数据污染）。
   我的处置：落库 `VOIDED`（复用既有 `void_reason` 列写 `reason`），出参**同时**给 `status:"CANCELLED"`（接口语义层，卡面契约值）
   与 `businessStatus:"VOIDED"`（落库真值），并在 `docs/API接口文档.md` 写明口径。**若你要求只留一个字段，请指示取哪个，我改。**
2. **口径冲突②：卡面 `PARTIAL_PAID` vs 本库 `PARTIAL`**。`collection_status` 的实际取值是 `UNPAID/PENDING/SHARED/PARTIAL/PAID/OVERDUE/CLOSED`
   （`init_database.sql:718`；代码 7 处写 `PARTIAL`，全仓 **0 处** 写 `PARTIAL_PAID`）⇒ 我把判据实现为 `UNPAID | PARTIAL`，等价于卡面意图。
3. **我额外收口了 `collection_status`（卡面未要求，但漏了会出真 bug）**：取消时一并置 `CLOSED`。
   依据：`checkOverdueBills`（`sale-bill.service.ts:526`）的判据是 `collection_status IN ('UNPAID','PARTIAL')` 且**不带** `business_status` 过滤
   ⇒ 只置 `VOIDED` 的话，已作废的单会被逾期扫描翻成 `OVERDUE`（`overdue-scanner.service.ts:34` 同形）。`CLOSED` 属该列既有值域。
   同时我额外拒绝 `business_status='RETURNED'` 的单（400）：退货入库已把库存加回过一次，再取消就是二次回滚。**两条都是我加的规则，若你不要请指示回退。**
4. **卡面 §三.8 引用的 `guard-tenant-injection` 不在本单基线**：该脚本是 S3-207（`e8bc5ed9`，未合并）的交付物，`origin/main` 上不存在。
   我的处置：跨工作树**只读**调用它扫本工作树源码（`node .../guard-tenant-injection.mjs D:/Users/ZXQL/wt-agents/S3-209`），
   读数 RED 23 项（17 BLOCK + 6 未登记）**逐条都是 main 的存量项**（`cart.service.ts:239/276/388`、`finance-report.service.ts:210/264`、
   `sales-report.service.ts:508`、`product-report.service.ts:173`、`subscription*.service.ts`、`member.service.ts:23`、`transfer-execution.service.ts:299/314`、
   `approval-records.service.ts:372`、`miniapp/cart.service.ts:33/70`）—— 即你在 S3-207 里已判定的同家族。**本单新增/改动的 5 个文件 0 命中。**
   这里没有"我改成绿"，也没有把存量红点算作本单问题。
5. **我改了两个既有测试的"快照数字"（不是放水，需你确认口径）**：
   ① `rbac-g0-wiring.test.ts`：新增 `S3_209_WIRED_FILES`，全量 `requirePermission(` 计数 81 → 82（新增 1 处接线必须同步快照；G0 名单行与逐行 403/200 断言一字未动）；
   ② `migration-c6-4-1.test.ts`：`EXPECTED_MAX_MIGRATION` 201 → 203（本单新增 202/203 两条迁移；"190/191 各一号 + 最高编号唯一"判据本身未改）。
   两处都只改期望值、不删断言；若你要换成"由你统一改快照"，我可以回退这两处并只留业务代码。
6. **部分收款（`PARTIAL`）单被取消后，已收款项不做冲销**：卡面明示"冲销流程不在本单"。后果：该单的 `received_amount` 仍在行内，
   但应收/收款类统计按 `business_status` 过滤 ⇒ 已收部分也不再计入统计。**这是有意的边界，登记在此**，待冲销单落地后一并处理。
7. **未给 `t_sale_bill` 加 `voided_by` / `voided_at`**：取消人/取消时间已由 `t_operation_log`（`operator_id`/`operator_name`/`created_at`）承载，
   且 `updated_at` 随写更新 ⇒ 只补 `void_source` 一列即可，避免与操作日志重复记账。若你要单表可查"取消时间/取消人"，我再补两列（小改）。
8. **我未写 `docs/tasks/current-tasks.md`**：理由见 §五.4（并发在途文件，避免覆盖他人改动）。
9. **EOF 换行**：`admin-order.routes.ts` 原文件末尾缺换行（`git diff` 显示 `\ No newline at end of file`），我的编辑顺带补了一个换行符（1 字节的空白改动，无语义影响）。
10. **观察项（卡外，未改）**：`docs/ai-base/智享AI助手-写入操作规范.md` §5.2 的 Step 1 让 AI 先 `GET /api/admin/sale-bills/<单号>` 查状态，
    但本仓 `GET /api/admin/sale-bills/:billNo` **不存在**（`admin-order.routes.ts` 只有列表与 CSV；`sale-return.routes.ts` 的是 `/api/admin/sale-returns/sale-bills/:billNo`）
    ⇒ AI 侧"确认前先读状态"这一步可能仍缺端点。**不在本单范围，请你决定是否另立单。**
11. **夹具发现（范围外，值得登记）**：`t_inventory_balance` 的唯一键是 `(store_id, sku_id, stock_type)`、**不含 `tenant_id`**
    ⇒ 两个租户无法各自持有同一 SKU 的库存行（我的装置为此给每个租户/每张单建独立 SKU 绕开）。属既有多租户缺陷，本单未改，供你排期。

---

## 八、回传要求 / 关联卡

- 回传要求：本汇报已落卡 `docs/tasks/cards/R101-S3-209-阿坚-回传.md`（同内容）；派单卡已归档 `docs/tasks/inbox/archive/ACTIVE-S3-209-20261015.md`。
- 关联卡：`docs/tasks/inbox/archive/ACTIVE-S3-209-20261015.md`｜证据包：`docs/evidence/S3-209/README.md`
- 提交可复跑：`git -C D:\Users\ZXQL\wt-agents\S3-209 log --oneline 2fe8f109..HEAD` ⇒ `cdf60eb4`（**未 push**）
