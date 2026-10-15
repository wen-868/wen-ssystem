# 【派单 S3-201】修 S3-198 批1 的 **5 条 CI 失败**（标准不降：不许改断言掩盖）

- 派单人：**凌舟｜2026-10-15**｜执行方：**阿坚（后端/测试）**
- 工作区：**沿用** `D:\Users\ZXQL\wt-agents\S3-198`（分支 `feat/s3-198-rbac-batch1`，当前 HEAD `35595341`）
- 依据：PR #316 的 `build-and-test` 失败（CI 权威）

> ⚠️ 你不是凌舟；不得写裁定/验收；不得 push、不得开 PR。完成后更新 `docs/tasks/inbox/ACTIVE-回执-S3-201.md`。

## 一、CI 权威失败清单（PR #316 / job `115948934478`）

```
Tests  5 failed | 7952 passed (7957)
AssertionError: expected [] to have a length of 1 but got +0     （×3）
store-inventory.routes.ts PUT /inventory/alerts/:skuId/threshold（app-mobile 门店库存预警 api/modules/store.ts:485）: expected 404 to be 200
…verify（收银台 CashierView.vue:1273，router/index.ts:259 角色含 STORE_MANAGER/STORE_OPERATOR 不持 trace:code）: expected 404 to be 200
```

⚠️ 你（或前任）自述的"全量 vitest 0 failed（7920 例）"**与 CI 不符**（CI 跑 7957 例、5 失败）⇒ **以 CI 为准**，本地那次读数不作数（大概率是 run 在测试文件写全之前）。

## 二、凌舟已替你排除的方向（别重复查）

**不是路径写错**：
- `backend/src/routes/store-trace.routes.ts:8` = `storeTraceRouter.post("/trace/verify", …)` 与用例 `routePath` **逐字一致**
- `backend/src/routes/store-inventory.routes.ts:13` = `storeInventoryRouter.put("/inventory/alerts/:skuId/threshold", …)` **逐字一致**

⇒ 两条 `404` 是**测试装置没把请求匹配到路由**（不是端点不存在）。查 `backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts` 的 `buildApp()`（约 L301）与 `APPS` 缓存（约 L347）：这两条用到的 `prefix` / `rawMount` / 挂载顺序是否与其余 23 条不同？是否存在"同一 prefix 下多 router 只挂上第一个"的夹具天花板？

**最小复现要求**：只挂 `storeTraceRouter` 到 `/api/store` 打 `POST /trace/verify` —— 若 404 ⇒ 夹具问题（按 `prefix+router` 分别建 app，勿共用）；若 200 ⇒ 说明是共享 app 的挂载冲突，同样修夹具。

## 三、三条 `length 1 → +0` 的处置

trace 域接线已按裁定**退回**（该文件 `requirePermission` 命中 = 0）⇒ 这些断言要改成"**退回后的实际形态（0 接线）**"，**不是**把 trace 接线加回来。

## 四、硬要求（一条都不许省）

1. **本机 `cd backend && npx vitest run` 全量**，贴**尾部原始输出**（必须看到 `Tests … 0 failed`），且**文件数与用例数要 ≥ CI 的 651/7957**（否则说明你跑的不是全量）；
2. `node backend/scripts/guard-rbac-wiring.mjs --strict` **EXIT=0**；
3. 三条 guard（route-auth / tenant-status / route-prefix）**EXIT=0**；
4. `npx tsc --noEmit` **0**；`npm --workspace backend run build` **EXIT=0**；
5. **不许**把断言改成期望 404、不许跳过/删除失败用例、不许缩小测试范围；
6. 回报新 HEAD 哈希 + 上述原始输出。
