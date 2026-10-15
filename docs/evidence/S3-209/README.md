# S3-209 证据包 · 销售单取消端点（跨线 P1）

> 单号：S3-209（派单卡：`docs/tasks/inbox/ACTIVE-S3-209.md`，已归档）
> 执行方：阿坚（后端 · 本地子代理通道 `/root/s3213_ajian`）｜2026-10-15
> 工作树：`D:\Users\ZXQL\wt-agents\S3-209`｜分支 `feat/s3-209-sale-bill-cancel`｜基线 `origin/main = 2fe8f109`

本目录是**可复跑证据**，不是结论陈述。所有判据的原始输出都在 `raw/`，逐条对应关系见下表。

---

## 一、复跑前置

    cd D:\Users\ZXQL\wt-agents\S3-209
    npm ci --legacy-peer-deps            # 工作树无 node_modules 时
    npm --workspace backend run build    # 产出 backend/dist（装置跑 dist，不是 src）

环境：本机 MySQL 8 监听 `127.0.0.1:3408`（`root` / 空口令）。装置**只允许** `s3209_` 前缀库。

---

## 二、真库真 HTTP 装置（`harness.mjs`，25 项判据）

    node docs/evidence/S3-209/harness.mjs
    # 期望：逐项 PASS，末行「汇总：25 PASS / 0 FAIL」，EXIT=0

装置做了什么（顺序即执行顺序）：

1. `[0]` 重建夹具库 `s3209_main`（DROP + CREATE）；
2. `[1]` 起**真实后端** `backend/dist/server.js`（启动期跑全部 `docs/migrations/*.sql` + 种子）并等 `/health` 200；
3. `[2]` 夹具：A 租户（`default`）7 张销售单（含 PAID / 未出库 / 预置冲突幂等键各 1）+ B 租户（`s3209t2`）1 张；
   每个权限形态一个账号（无码 / 精确持 `sale:cancel` / `sale:*` 通配）；
4. `[2b]` **立码**：用 `scripts/run-migration.mjs` 真跑 `docs/migrations/203_销售单取消权限点.sql`（连跑两遍证幂等），
   临时 `.env` 落在 `%TEMP%` 目录、装置结束即删（不进仓库）；
5. `[3]` 真 HTTP：登录 → 逐条验收（见下表）；
6. `[4]` SQL 直查真值（库存改前/改后、流水计数、单状态、`void_source`、操作日志）；
7. `[5]` 汇总 `raw/99-summary.json`，有 FAIL 则 EXIT=1。

### 判据 ↔ 派单卡 §三 对照

| 卡面判据 | 装置判据 | 原始读数文件 |
|:--|:--|:--|
| §三.1 正常取消 + 库存回滚（改前/改后真值） | `[3①]`（3 项：接口 / 库存 90→100 / 落库与流水） | `raw/40-cancel-normal.json` |
| §三.2 幂等（重复取消只回滚一次 + 用例） | `[3②]`（3 项：接口 / 库存 20→24→24 / 流水仍 1 条）＋ 单测 `sale-bill-cancel.test.ts` | `raw/41-cancel-idempotent.json` |
| §三.3 PAID ⇒ 400 且零改动 | `[3③]`（2 项） | `raw/42-cancel-paid-reject.json` |
| §三.4 原子性（中途失败整体回滚） | `[3④]`（3 项：报错 / 单未作废且库存 60→60 / 无新增流水） | `raw/43-cancel-atomicity.json` |
| §三.5 权限（无码 403 / 有码 200） | `[3⑤]`（4 项）＋ 单测 `s3-209-sale-cancel-wiring.test.ts` | `raw/44-cancel-permission.json` |
| §三.6 租户隔离（A 令牌取消 B 的单 ⇒ 404） | `[3⑥]`（2 项） | `raw/45-cancel-tenant-isolation.json` |
| §三.7 `source` 落库（ai / admin 各一次） | `[3⑦]`（2 项） | `raw/46-cancel-source.json` |
| 附加：未出库单 ⇒ 不凭空回滚 | `[3附]` | `raw/47-cancel-no-stock-out.json` |
| 立码（203 真跑 + 幂等） | `[2b]`（2 项） | `raw/20-migration-203.txt` |
| 登录 / CSRF 前提 | `[3a]` | `raw/30-login.json` |
| 后端启动期日志（202 生效 / 203 写闸门跳过 / 种子） | —— | `raw/server.log` |

---

## 三、单元 / 接线用例（常驻，不是一次性探针）

    cd backend
    npx vitest run src/__tests__/services/store/sale-bill-cancel.test.ts src/__tests__/routes/s3-209-sale-cancel-wiring.test.ts
    # 期望：2 文件 / 24 用例全过

- `services/store/sale-bill-cancel.test.ts`（12 例）：正常取消 / PARTIAL / 未出库 / 幂等（锁死「重复取消只回滚一次」）/
  PAID·RETURNED·域外状态拒绝 / 租户隔离 404 / 原子性（中途抛错 ⇒ 后续语句不执行）/ `FOR UPDATE` 与同连接 /
  `source` 两态落库。
- `routes/s3-209-sale-cancel-wiring.test.ts`（12 例）：401 / 无码 403（READONLY、SALES_STAFF、STORE_OPERATOR、
  持 `sale:void` 对照组）/ 有码 200（精确码、`sale:*`、SUPER_ADMIN）/ CSRF 缺失 403 /
  注册行形状断言（含 `requirePermission(PERM_SALE_CANCEL)`）/ `routeConfig.auth` 声明。

### 反测（门禁铁律：证明判据会红）

| 反测 | 做法 | 期望 | 实测 |
|:--|:--|:--|:--|
| A 幂等判据 | 把 `cancelSaleBill` 的 `if (bill.business_status === "VOIDED")` 改成 `if (false && …)` | 「重复取消只回滚一次」用例红 | ✅ 1 failed / 11 passed |
| B 权限接线 | 摘掉注册行的 `requirePermission(PERM_SALE_CANCEL)` | 4 条 403 用例 + 形状断言红 | ✅ 5 failed / 7 passed |

两次反测均已复原并复跑回绿（见回执 §二）。

---

## 四、全量门禁

    cd backend
    npx vitest run                                # raw/90-vitest-full.txt
    npx tsc -p tsconfig.json --noEmit             # raw/91-tsc.txt
    npm run lint                                  # raw/92-lint.txt
    node scripts/guard-route-auth.mjs             # raw/93-guards.txt
    node scripts/guard-tenant-status.mjs
    node scripts/guard-route-prefix.mjs
    node scripts/guard-utf8-encoding.mjs
    node scripts/guard-rbac-wiring.mjs --strict
    cd .. ; npm --workspace backend run build      # raw/94-build.txt

    # 第五道：租户注入静态门禁（⚠️ 该脚本**不在本单基线**上，属 S3-207 未合并分支的产物 ⇒ 跨工作树只读调用）
    cd D:\Users\ZXQL\wt-agents\S3-207
    node backend/scripts/guard-tenant-injection.mjs D:/Users/ZXQL/wt-agents/S3-209   # raw/80-tenant-injection-guard.txt

> 说明：`guard-tenant-injection.mjs` 在 `origin/main`（2fe8f109）上**不存在**（它是 S3-207 分支的交付物，
> 尚未合并）⇒ 本单只能跨工作树只读调用它来扫本工作树源码。扫描结果 **RED 23 项全部是 main 上的存量项**
> （即 S3-207 在自己分支里修掉的那批），**本单新增/改动的文件 0 命中**（回执 §三.4 逐条说明）。

---

## 五、原始文件索引

| 文件 | 内容 |
|:--|:--|
| `harness.mjs` | 真库真 HTTP 装置（唯一入口） |
| `raw/server.log` | 装置后端启动期日志（迁移 202 生效 / 203 写闸门跳过 / 种子） |
| `raw/20-migration-203.txt` | `run-migration.mjs` 连跑 203 两遍的输出 |
| `raw/30-login.json` | 四个账号的登录结果（token / csrfToken） |
| `raw/40`~`47-*.json` | 逐条验收判据的请求 / 响应 / 真值读数 |
| `raw/80-tenant-injection-guard.txt` | 租户注入门禁对本工作树的扫描（跨工作树只读） |
| `raw/90-vitest-full.txt` | 全量单测尾部输出 |
| `raw/91-tsc.txt` / `raw/92-lint.txt` / `raw/93-guards.txt` / `raw/94-build.txt` | 其余门禁原始输出 |
| `raw/99-summary.json` | 装置逐项 PASS/FAIL 汇总 |
