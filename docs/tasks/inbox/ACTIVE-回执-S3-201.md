# ACTIVE 回执 · S3-201 —— 修 S3-198 批1 的 5 条 CI 红

- 派单卡：`docs/tasks/inbox/ACTIVE-S3-201.md`（派单人：**凌舟（总负责人）｜2026-10-15**）
- 执行方：**阿坚（后端/测试）**｜工作树 `D:\Users\ZXQL\wt-agents\S3-198`｜分支 `feat/s3-198-rbac-batch1`
- 汇报对象：凌舟（总负责人）｜汇报人：阿坚（后端/测试）｜日期：**2026-10-15**
- 结论：**5 条 CI 红全部修掉**。但根因**不是**派单卡 §二/§三 的推测（「夹具没把请求匹配到路由」「trace 域接线退回」），而是——
  **CI 跑的是 PR 合并树，其中 main 的 S3-195 已把 `/api/store` 根前缀收窄**；本分支用例仍按收窄前的拆分写死 ⇒ 合并后 3 条「注册行找不到」+ 2 条 404。

---

## 一、改了什么（1 文件 / +13 −3）

`backend/src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts`

| 位置 | 改前 | 改后 |
|:--|:--|:--|
| `UNWIRED` 的 store-inventory 行 | `prefix:"/api/store"` + `routePath:"/inventory/alerts/:skuId/threshold"` + `path:"/inventory/alerts/1/threshold"` | `prefix:"/api/store/inventory"` + `routePath:"/alerts/:skuId/threshold"` + `path:"/alerts/1/threshold"` |
| `UNWIRED` 的 store-trace 行 | `prefix:"/api/store"` + `routePath:"/trace/verify"` + `path:"/trace/verify"` | `prefix:"/api/store/trace"` + `routePath:"/verify"` + `path:"/verify"` |
| 「整文件子串不足以判定」用例 | `registrationLines("store-inventory.routes.ts","put","/inventory/alerts/:skuId/threshold")` | `…,"/alerts/:skuId/threshold")` |
| 文件头 + 行内注释 | — | 补「S3-201 口径同步」说明（收窄前后对外 URL 等价） |

**断言强度一条未降**：仍是「注册行**恰好 1 条**、且**不含** `requirePermission(`」；仍是「**对外 URL** 上 READONLY ⇒ 200」。
外部 URL 逐字不变：`/api/store/inventory + /alerts/:skuId/threshold` ≡ 原 `/api/store + /inventory/alerts/:skuId/threshold`；
`/api/store/trace + /verify` ≡ 原 `/api/store + /trace/verify`。

## 二、证据（可复跑）

- **交付物**：分支 `feat/s3-198-rbac-batch1` —— 代码修复 `2d121ea8`（其父 `47b9dee7` = `origin/main`(`5d8f46df`) 合入本分支的 merge commit），本回执/回传卡为紧随其后的 `docs:` 提交（= 本文件所在提交，`git log -1 --format=%H` 可核对）；**均本地提交，未 push、未开 PR**
- **CI 权威**：run `38591983350` / job `115948934478`（`build-and-test`，head `35595341`）= `Test Files 1 failed | 659 passed (660)`、`Tests 5 failed | 7952 passed (7957)`
- **合并树判据**（证明 CI ≠ 分支单树）：CI 日志里出现 **660** 个测试文件，分支 HEAD 只有 **655**；差集恰为 main 已合并的 5 个（`store-prefix-narrowing-s3-195`、`consumer-auth-s3-196`、`consumer-auth-marketing-s3-196`、`notification-csrf-s3-196`、`wechat-bind-tenant-s3-196`）
- **复现（反测红）**：`git merge origin/main` 后，`cd backend && npx vitest run src/__tests__/routes/rbac-b2-s3-198-inventory-wiring.test.ts` ⇒ `Tests 5 failed | 197 passed (202)`，失败项与 CI **逐字一致**（行号 408 / 416 / 525）
- **修复后**：同命令 ⇒ `Test Files 1 passed (1)`、`Tests 202 passed (202)`
- **全量**：`npm --workspace backend test` ⇒ `Test Files 660 passed (660)`、`Tests 7957 passed (7957)`（文件数与用例数均 **≥** 派单卡要求的 651/7957）
- **门禁**：`guard-rbac-wiring.mjs --strict` **EXIT=0**（台账 680 条已登记 / 未登记 0）；`guard-route-auth.mjs` **EXIT=0**；`guard-tenant-status.mjs` **EXIT=0**；`guard-route-prefix.mjs` **EXIT=0**
- **静态与构建**：`npm --workspace backend run typecheck`（`tsc --noEmit`）**EXIT=0**（无输出）；`npm --workspace backend run build` **EXIT=0**（`已处理 800 个 JS 文件，修复 1890 处导入路径`）
- **原始输出留档**：`docs/evidence/S3-201/`（README + `outputs/01`~`11`，含 CI 失败摘录、CI 独有文件清单、复现红、修复绿、四条 guard、typecheck、build、全量 660/7957）

## 三、阻塞点与未完成

- 无阻塞。5 条红均已消除，本地合并树全绿。
- **未 push、未开 PR**（派单卡红线）：CI 复跑需要凌舟推送本分支或按 `docs/evidence/S3-201/README.md` §二 在本机复跑。
- **未改 `docs/tasks/current-tasks.md`**（工作区入口指令提到），理由：记账（六步闭环第 ⑥ 步）属凌舟职责，且该文件被 8+ 并行会话共用；请凌舟按需记账。
- **未移动 `docs/tasks/inbox/ACTIVE.md`**（同一理由：它是 11 个并行会话共用的路由表，移动会打断他人）；本单卡片归档见下条报备。

## 四、风险与自我报备（请凌舟重点看两条）

1. **派单卡 §三 的前提被证据推翻**：卡里写「三条 `length 1 → +0` 是 trace 域接线退回所致，断言要改成『0 接线』」。实测：**P 类 9 条（trace 域）在 CI 全部通过**（`✓ 'trace.routes.ts' 'post' '/configs'（未接，原因 'P'）…注册行**不含** requirePermission(`），三条 `length 1 → +0` **全部**来自 S3-195 收窄的这两个 store 文件。若按 §三 把断言放宽成「允许 0 条注册行」，会**削弱**这条门禁（路由消失将不再报红），故我未执行；改为把行的「注册路径 / 挂载前缀」对齐收窄后的真值。**若你仍要「允许 0 条」的口径，请另派单**（那属于降标准，需你显式裁定）。
2. **本地合并了 `origin/main` 到分支**（merge commit `47b9dee7`，未 push）：这是复现/验证 CI 所测那棵树、并把用例数拉到 ≥7957 的**唯一**办法（CI 测的就是 `refs/pull/316/merge`）。若你倾向「分支不合并 main、由你在主干复跑」，可只取 `2d121ea8` 的 diff（1 文件 +13 −3）另作分支。
3. 未触碰任何生产代码/路由文件（本单只动测试夹具与证据包）；未改台账与既有卡；未覆盖任何他人文件。
4. `docs/tasks/inbox/ACTIVE-S3-201.md` 的归档：该卡在**主检出**（`ZXQL-MS\wen-ssystem`）里为未跟踪文件，不是我的工作树文件；我按「只动自己的工作树」原则未移动它，请在路由表收口时归档（或告知我代为执行）。

派单人：凌舟（总负责人）｜2026-10-15　·　执行/回报：阿坚（后端/测试）｜2026-10-15
