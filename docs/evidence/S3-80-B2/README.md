# S3-80 B-2 核验证据包：`POST /api/sync/offline-orders` 幂等性（含反测）

> 派单：`docs/tasks/cards/R101-派单-20260922-B.md`（§改卡记录里注明 B-2 由"待实现"改为"核验幂等是否成立"）
> 权威口径：GitHub Issue #60 正文（该卡正文无独立 §B-2 章节，见回执 §风险与自我报备）
> 执行：阿坚（后端 · 本地子代理代执行）｜2026-09-23
> 回执：`docs/tasks/cards/R101-B2-阿坚回传.md`

## 一、本包解决什么

证明/证伪"同一幂等键 `draftNo` 提交两次，是否只落一单"，并给出反测（不同幂等键必须落两单）、
写入域清单与租户隔离反测。**本单是核验单，不改任何产品代码**——被测代码零改动。

## 二、文件清单

| 文件 | 作用 |
|---|---|
| `probe/01-idempotency-probe.mts` | **主探针**：S1 同键两次 / S2 不同键 / S3 批内重复 / S4 交错并发 / S5 跨租户同键 / S6 租户隔离 / S8 跨租户读隔离 / S9 写入域清单；输出 PASS/FAIL 与 JSON 证据 |
| `probe/02-mysql-probe.mts` | **真库探针（交凌舟跑）**：不打替身，真 mysql2 + 真库；含 information_schema 读唯一键与列默认值、同套反测、收尾自带清理 |
| `probe/db-adapter.mjs` + `probe/schema-sqlite.mjs` | 01 用的数据访问层替身：SQLite 引擎 + 按仓库真实 DDL 转写（逐条标注依据行号） |
| `probe/hooks.mjs` / `register.mjs` | 01 的 ESM 解析钩子：**只**把 `backend/src/shared/db` 换成替身，其余模块走原解析链 |
| `probe/hooks-real-mysql.mjs` / `register-real-mysql.mjs` / `stub-mock-db.mjs` | 02 的解析钩子：不替换业务模块，只补 `.ts` 扩展名并打桩 `__tests__/mocks/mock-db` |
| `probe/00-smoke.mts` | 通道冒烟：证明"真实服务代码跑在真实 SQL 引擎上"这条通道可用 |
| `probe/run.ps1` | 一键复跑（`-Mysql` 切真库探针） |
| `output-sqlite-probe.txt` / `.json` | 01 的原始输出与结构化证据（**保留，不删**） |

## 三、复跑命令（可复跑证据）

```powershell
# ① 沙箱/本机均可（SQLite 替身 + 真实服务代码；断言 20 条）
pwsh -File docs/evidence/S3-80-B2/probe/run.ps1

# 等价的原生命令
$env:JWT_SECRET='b2-probe-secret'; $env:NODE_ENV='production'; $env:LOG_LEVEL='silent'
node --import ./docs/evidence/S3-80-B2/probe/register.mjs docs/evidence/S3-80-B2/probe/01-idempotency-probe.mts

# ② 真库（需 backend/.env 指向真库；建议在测试库上跑，探针自带清理）
cd backend
node --import ../docs/evidence/S3-80-B2/probe/register-real-mysql.mjs ../docs/evidence/S3-80-B2/probe/02-mysql-probe.mts
# 若本机 Node < 22.18：npx tsx ../docs/evidence/S3-80-B2/probe/02-mysql-probe.mts
```

退出码：`0` = 全部断言通过；`1` = 有断言失败（本次为 S6-2 红点，属**发现的缺陷**，非探针故障）；
`2` = `USE_MOCK_DB=true` 拒绝执行；`3` = 探针中止（如本机无 MySQL）。

## 四、证据边界（必须随结论一起引用）

1. **引擎替换**：01 把 MySQL(InnoDB) 换成 SQLite。SQL 文本、参数、事务结构、UNIQUE 约束、列默认值同构；
   但**锁粒度/隔离级别不同**，故 S4（交错并发）只能证明"仍只落一单"，不能替代真库并发压测。
2. **唯一键冲突文案**：为便于比对，SQLite 报错按 MySQL 口径归一化（`ER_DUP_ENTRY` / `errno 1062`）。
3. **唯一键是独立防线的直接证据**：取自 S5——租户内预检按设计放行（预检带 `tenant_id`，查不到他租户的行），
   仍被 `uk_sale_bill_no` 挡下。真库是否保留该唯一键，由 02 探针 P1 的 `information_schema.STATISTICS` 读数定论。
4. **DDL 转写依据**（逐条可在仓库复跑核对）：
   `001_phase1_schema.sql:338-369`（t_sale_bill，含 `UNIQUE KEY uk_sale_bill_no (bill_no)`）、
   `001_phase1_schema.sql:371-387` + `092_租户ID.sql:141` + `129_sale_bill_item_compliance.sql:3-8`（t_sale_bill_item）、
   `backend/src/shared/migration.ts:573-606`（运行时兜底建表，唯一键同 001）；
   全仓无 `DROP uk_sale_bill_no` 记录（`rg -n "uk_sale_bill_no" docs/migrations backend/src` 仅两处定义）。
5. **t_member 仅建最小列**（`id/tenant_id/name/mobile/customer_type`），只服务于 S8 的跨租户读反测。

## 五、结论摘要（详见回执卡）

- 幂等**成立**：同 `draftNo` 两次 ⇒ 库内主表 1 行、明细 1 行；不同 `draftNo` ⇒ 各 1 行（反测通过）。
- 但"重复提交"的返回是 **`success=false` + `errorMsg`（拒绝式）**，不是"幂等成功"；客户端 `local_sale_draft`
  会把它标成 `SYNC_FAILED` 并（因 `listPending` 含 `SYNC_FAILED`）**无限重试**⇒ 幂等口径需凌舟裁定。
- 红点：**明细行 `t_sale_bill_item.tenant_id` 落成 `'default'`**（主表正确）——跨租户数据归属错误。
- 红点（次）：`uk_sale_bill_no` 全局唯一 ⇒ 跨租户同名 `draftNo` 互相顶掉（B 被拒且报错文案泄漏单号）。
- 写入域：仅 `t_sale_bill`（17 列）+ `t_sale_bill_item`（9 列），无 UPDATE/DELETE、无库存/台账等其它域。

## 六、附录：HTTP 层复核配方（可选，需真令牌）

服务层探针已覆盖端点全部业务分支（路由→控制器→服务）；如需连中间件一起复核：

```bash
TOKEN_A=<租户A令牌>
curl -sS -X POST https://<host>/api/sync/offline-orders \
  -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d '{"orders":[{"draftNo":"B2-CURL-001","items":[{"skuId":1,"skuName":"t","boxQty":1,"bottleQty":6,"totalBottleQty":6,"unitPrice":100,"priceType":"RETAIL","subtotalAmount":600}],"totalAmount":600,"createdAt":"2026-09-23T10:00:00Z"}]}'
# 同一条命令再跑一次：预期第 2 次 results[0].success=false 且 errorMsg 含"已存在"；库内仍 1 行
```
