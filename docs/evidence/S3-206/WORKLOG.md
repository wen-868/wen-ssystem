# S3-206 工作日志（执行方：阿坚｜会话 `/root/s3209_ajian`）

> 卡：`docs/tasks/inbox/ACTIVE-S3-206.md`（P0：`sales-ranking` 跨租户聚合越界）
> 工作树：`D:\Users\ZXQL\wt-agents\S3-206`｜分支 `fix/s3-206-cross-tenant-ranking`｜基线 `origin/main = 36a7a02f`

## 时间线（每 10 分钟写盘）

- `[T0]` 读 AGENTS.md / ACTIVE.md → 认领 **S3-206**；建工作树；`npm ci` 起。
- `[T0+20m]` 定位根因（静态）：`backend/src/config/database.ts` 的 `injectSelectTenant` 首行
  `if (sql.toLowerCase().includes('tenant_id')) return sql;` —— **只要 SQL 文本任何位置出现 tenant_id 就跳过注入**。
  `sales-ranking` product 维度 SQL 的 JOIN 写了 `sb.tenant_id = sbi.tenant_id` ⇒ 短路 ⇒ 无租户过滤。
- `[T0+25m]` 写好同根因扫描器 `scan-tenant-shortcircuit.mjs`（静态扫 789 文件 / 1747 调用点）→
  LEAK 候选 7、可疑 14、AUTO-INJECT+JOIN 6、非字面量 12；开始逐条人工判定。

## 时间线（续）

- `[T0+55m]` 真库装置 `harness.mjs` 跑通：**修复前** `product` 维度读数 `1013 瓶/101805 元` = A(14/1806) + B(999/99999)；
  `store` 维度 **500**（`ER_NON_UNIQ_ERROR 1052`，server.log 有原始行）。→ `raw/harness-run-prefix.txt`
- `[T0+70m]` 修复 `getSalesRanking` 四维度（显式 `sb.tenant_id = ?` + 单测 4 条）→ 提交 `58bc2a1e`；
  **反测**：摘掉 product 维度条件 → `5b/5c` 变红（`FAIL 2`），复原 → 全绿。→ `raw/harness-run-countertest-product.txt`
- `[T0+95m]` 门禁全绿：vitest **663 文件/7999 用例 0 failed**、`tsc -p tsconfig.json --noEmit` 0、
  guard-route-auth / guard-tenant-status / guard-route-prefix / guard-utf8-encoding / guard-rbac-wiring --strict 均 EXIT=0、build EXIT=0。
- `[T0+105m]` 范围外量化：`/reports/profit.cost = 120886`（A 20986 + B 99900）、
  `/reports/business-overview.inventoryValue = 182096`（A 172096 + B 10000）→ **同根因另两处真泄露，按卡面 §二.3 停下报备，未修**。

## 收口状态

- [x] 真库复现（A 租户令牌看到 B 租户数据）
- [x] 同根因清单逐条判定收口（7 候选 + 6 观察项 + 12 未判定，见 README §五）
- [x] 修 `sales-ranking`（显式 `sb.tenant_id = ?`）+ 两侧反测
- [x] 门禁：vitest / tsc / guard / build
- [x] 回执 + 卡归档 + 证据包提交
