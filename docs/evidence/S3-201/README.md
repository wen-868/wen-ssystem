# S3-201 证据包 —— 修 S3-198 批1 的 5 条 CI 红

- 派单卡：`docs/tasks/inbox/ACTIVE-S3-201.md`（派单人：凌舟｜2026-10-15）
- 执行方：阿坚（后端/测试）｜工作树 `D:\Users\ZXQL\wt-agents\S3-198`｜分支 `feat/s3-198-rbac-batch1`
- CI 权威：run `38591983350` / job `115948934478`（`build-and-test`，head `35595341`）

## 一、根因（与派单卡 §二/§三 的前提不同，有证据）

CI 的 `build-and-test` 跑的是 **PR 合并树**（`refs/pull/316/merge` = 本分支 ∪ 当时的 `main`），不是分支单独一棵树。
判据：CI 日志里出现的测试文件是 **660** 个，而分支 HEAD 只有 **655** 个；差集恰是 main 上已合并的 5 个文件
（`outputs/02-ci-only-test-files.txt`）。

其中 main 的 **S3-195（`089b8c3f`，PR #313）已把 `/api/store` 根前缀逐个收窄**：

| 文件 | S3-195 前 | S3-195 后 | 对外 URL |
|:--|:--|:--|:--|
| `store-inventory.routes.ts` | 前缀 `/api/store` + `PUT /inventory/alerts/:skuId/threshold` | 前缀 `/api/store/inventory` + `PUT /alerts/:skuId/threshold` | `PUT /api/store/inventory/alerts/:skuId/threshold`（逐字不变） |
| `store-trace.routes.ts` | 前缀 `/api/store` + `POST /trace/verify` | 前缀 `/api/store/trace` + `POST /verify` | `POST /api/store/trace/verify`（逐字不变） |

S3-198 的用例把「挂载前缀 + 注册路径」写死成收窄前的拆分，合并后即：

- 注册行级形状判据找不到该行 ⇒ 3 条 `expected [] to have a length of 1 but got +0`；
- 用例把路由挂在 `/api/store` 上、再打 `/api/store/inventory/alerts/1/threshold` ⇒ 路由不再匹配 ⇒ 2 条 `404 ≠ 200`。

⇒ 5 条红全部由这一处口径不一致引起，**与「trace 域接线退回」无关**：P 类 9 条在 CI 全部通过
（CI 日志：`✓ 'trace.routes.ts' 'post' '/configs'（未接，原因 'P'）：注册行**不含** requirePermission(`）。

## 二、凌舟可逐条复跑

```powershell
cd D:\Users\ZXQL\wt-agents\S3-198
git fetch origin main
git merge origin/main --no-edit          # 复现 CI 的合并树（本地提交，未 push）
cd backend
npx vitest run src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts   # 修复前：5 failed（outputs/03）
# 应用本单修复后：
npx vitest run src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts   # 202 passed（outputs/04）
cd ..
npm --workspace backend test                        # 660 files / 7957 tests / 0 failed（outputs/11）
node backend/scripts/guard-rbac-wiring.mjs --strict  # EXIT=0（outputs/05）
node backend/scripts/guard-route-auth.mjs            # EXIT=0（outputs/06）
node backend/scripts/guard-tenant-status.mjs         # EXIT=0（outputs/07）
node backend/scripts/guard-route-prefix.mjs          # EXIT=0（outputs/08）
cd backend; npx tsc --noEmit                         # 0 输出（outputs/09）
cd ..; npm --workspace backend run build             # EXIT=0（outputs/10）
```

## 三、改动（1 文件 / +13 −3）

`backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts`：把 `UNWIRED` 里两行的
`prefix` + `routePath` + `path` 按 S3-195 后的真值拆分（另附一处硬编码调用点与口径注释）。
**断言强度一条未降**：仍是「注册行恰好 1 条、且不含 `requirePermission(`」，仍是「对外 URL 上 READONLY ⇒ 200」。

## 四、反测（门禁铁律）

`outputs/03-merged-tree-repro-5-failed.log` 是**未打修复**的同一棵合并树上的原始输出：5 条红、断言与 CI 逐字一致
（证明修复前该命令会红）；`outputs/04` 是同命令在修复后的原始输出（绿）。两侧原始输出都已留档。
