# ACTIVE-S3-237 · 接线批 10（**系统设置/基础域 14 条** + **商品 A 类 15 条**）

> 派单人：**凌舟（总负责人）**｜派发：2026-10-16｜执行方：**阿坚（后端 / 权限）**
> ⚠️ **你不是凌舟；不得写任何「凌舟裁定 / 验收结论」；只动自己的工作树与分支；不得 push、不得开 PR。**
> 工作树：`D:\Users\ZXQL\wt-agents\S3-237`｜分支 `feat/s3-237-system-goods-wiring`｜基线：开工当日 `origin/main`
> 前置：**S3-232 已合（#357）**：14 个系统设置域码已落 `docs/migrations/204_系统设置域权限点立码.sql` + `backend/src/shared/system-permission-codes.ts`；D1 已给 `STORE_MANAGER` 补 `goods:create|edit`

## 一、范围

### 组 1 · 系统设置/基础域 **14 条**（码已就绪，机械接线）

码表与端点逐条清单：`docs/tasks/R101-待立码清单-五域.md` §1.2 **表 A**（14 行，码 14 个，文件行号已给）。
授权面已核（同节）：`system` 一级目录只授予 0 账号角色 + READONLY ⇒ **无 403 回归**，本批**不发任何角色码**。

⚠️ 第 10 行 `POST /api/admin/push/test` 的控制器内已有 `SUPER_ADMIN/OPERATION_ADMIN/BOSS` 角色硬校验 ⇒
接码后必须与该集合**逐条对齐**（别造出"码放行、控制器仍 403"的空转），并在回传卡写明你如何验证这一点。

### 组 2 · 商品 A 类 **15 条**（台账 §12.4，逐条按类处置）

| 子类 | 条数 | 处置 |
|:--|--:|:--|
| `PUT /products/skus/:skuId/barcode`；`POST/PUT` brands；`POST/PUT` product-tags；`POST/PUT` unit-groups | **8** | **本批接**（用 `goods:create` / `goods:edit`，与 204 已授码一致；逐条给"页面调用点 + 页面 meta.roles"证据） |
| `DELETE` brands / product-tags / unit-groups | **3** | **本批不接**：D1 明确**不含** `goods:delete`（删除属高风险）⇒ 按 **D4 = 前端补门**（按钮按码显隐）处置；本批**只登记**并写清"若前端不补门，店长点删除会 403"⇒ 交凌舟另立前端小单 |
| `POST /product-reviews/:id/{approve,reject}`、`/batch-approve`、`/batch-reject` | **4** | **本批不接**：先查 079/204 是否已有审核类码；**有** ⇒ 接；**无** ⇒ 只登记并入下一批立码（不得自行造码） |
| `POST /products/import` | **1** | **不接**（`12.4-2` 口径）：该页真实打的是 `/admin/data-transfer/import/products`（已由 S3-198 接 `store:transfer`）⇒ 本端点**无真实调用点**，保持登记 |

## 二、判据（逐条给原始输出）

1. 对账表：`本批接线 N 条 = 组 1 已接 K1 + 组 2 已接 K2`，其余逐条给"不接理由"（口径见 §一）；
2. 两侧反测（顺序照 `docs/tasks/派单规范.md` §九.1：**先更新基线再注入**）：
   - 缺码 ⇒ 403；持码 ⇒ 到达业务层；
   - **摘中间件** ⇒ `guard-rbac-wiring --strict` **EXIT=1 且点名**（逐条给，组 1/组 2 各至少 1 条）；
3. `guard-rbac-wiring --strict` **EXIT=0**（缺口按 `新值 = 371 − 本批接线数` 记账，**只允许和式 + 台账一致性**，规范 §9.2）；
4. 零回归论证：每个码的"生产在用持有者"取自 `docs/evidence/_shared/prod-roles-20261016.txt`（**不得各自跑生产**）；若某码**无任何在用角色持有** ⇒ 该条**跳过并登记**；
5. 回归：全量 `npx vitest run` 0 failed、`npx tsc -p tsconfig.json --noEmit` 0、`npm run build` 0。

## 三、红线
1. 不得新增权限码、不得改角色种子/迁移、不得改 079、不得改前端（组 2 的 DELETE 只登记，前端单另派）；
2. 不得改 `.github/**`、`deploy/**`、收口总清单、`current-tasks.md`、其它单工作树；
3. **不得 push / 开 PR / `git add -A`**；证据不得含口令明文；回传卡不得出现「凌舟裁定 / 凌舟验收」字样。

## 四、交付与回传
路由声明式接线（组 1/组 2 分组提交）+ 两组用例 + 台账同步（`rbac-wiring-baseline.json` 只移除本单条目；
`docs/tasks/R101-RBAC接线缺口清单.md` 顺延新章节，先核对当前最大章节号）+ `docs/evidence/S3-237/**` +
`docs/tasks/cards/R101-S3-237-阿坚-回传.md`（十项）+ `docs/tasks/inbox/ACTIVE-回执-S3-237.md`。

**十项**：交付物 ｜ 改动面 ｜ 证据 ｜ 验收自评 ｜ 未完成与阻塞 ｜ 风险与自我报备 ｜ 环境复原 ｜ **一行摘要** ｜ 待凌舟裁定项 ｜ 依据卡
