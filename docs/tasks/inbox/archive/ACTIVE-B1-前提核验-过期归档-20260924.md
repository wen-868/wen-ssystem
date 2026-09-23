# 【派单 B-1-前提核验】S3-80 离线同步后端：既有实现 vs 前端契约 的只读独立核验

> 开工第一步：本卡即你的任务（AGENTS.md「唯一卡即你的卡」）。**只读核验**，不要写业务代码。

派单人：凌舟（总负责人）｜2026-09-22
执行方：本地子代理（只读核验）｜通道：docs/tasks/inbox/ACTIVE.md
优先级 / 时间盒：P0 · 半天（只读，不得改任何源码）

## 一、背景（凌舟已取证事实）

1. 派单 B-1 原文（`docs/tasks/cards/R101-派单-20260922-B.md`）断言"后端**完全没有** `/api/sync/*`，全仓 grep 0 条"，要求**新建** `backend/src/routes/sync.routes.ts` 与 `backend/src/services/.../sync.service.ts`。
2. 凌舟复核发现该断言**不成立**：以下文件已在 main 存在 ——
   - `backend/src/routes/sync.routes.ts`（`export const routeConfig: RouteConfig = { prefix: "/api/sync", ... }`，含 `GET /products/delta`、`GET /inventory/delta`、`GET /members/delta`、`POST /offline-orders`）
   - `backend/src/controllers/admin/sync.controller.ts`
   - `backend/src/services/sync/delta-sync.service.ts`（625 行）
   - `backend/src/__tests__/routes/sync.test.ts`、`backend/src/__tests__/services/sync/delta-sync.service.test.ts`
   - 引入提交：`e07796c4a feat: R51-04 后端增量同步端点（products/inventory/members delta + offline-orders批量提交）`
3. 凌舟怀疑派单的 grep 取样错了：卡里写的是「`/api/sync/*` 零命中」，而路由声明是 `prefix: "/api/sync"`（**无尾斜杠**），按带尾斜杠的串检索必然 0 命中。

## 二、你的任务（逐条给结论 + 复跑证据，不得只写"是/否"）

**核验项 1 · 前提**：上述 5 个文件是否存在？三端点是否真实挂在 `/api/sync` 前缀下（给出 `shared/auto-routes.ts` 的挂载机制证据 + `routeConfig` 行号）？该功能是否真的"从 R51-04 起就在 main"（`git log --oneline -1 -- <文件>`）？

**核验项 2 · 契约逐字段对齐**：以 `app-mobile/src/api/sync.ts:37-64` 与 `app-mobile/src/api/local-db.ts:25-96` 为口径源（**这是唯一口径源**），对照后端 `SyncDeltaResponse` 导出类型 + controller 实际返回结构 + service 组装逻辑，给出「字段 → 前端类型 → 后端实现位置（文件:行号）」对照表。**必须回答**：前端是 `spuId: number`（必填），派单卡里写的是 `spuId?:`（可选）——以哪个为准？卡是否与契约不一致？

**核验项 3 · 分页语义（本单最关键，必须给可复跑证据）**：
- 客户端 `app-mobile/src/utils/sync-manager.ts:280-300`（及 319、352 三处同构循环）的做法是：**同一循环里既把 `page` 自增、又把 `since` 推进为上一页 `until`**。
- 后端 `delta-sync.service.ts` 三个函数实现为 `WHERE updated_at > ? ... LIMIT ? OFFSET ?`，且 `hasMore = rows.length === pageSize`。
- 请证明或证伪：**这两者叠加是否会导致漏页（数据丢失）**。例：100 条/页，第 1 页取 1..100，`since` 推进到第 100 条时间，第 2 页 `OFFSET 100` 会取到第 201..300 条 ⇒ 101..200 丢失。
- 证据要求：允许你在**临时目录**（仅允许 `tmp-b1-verify/`，用完请删除）下写临时脚本，用与后端 SQL **同语义**的模型复现该序列（说明：本机无 MySQL，属语义级复现，必须**显式标注证据边界**）。同时把"要真库才能定的部分"单列成待办。
- 另核验：`ORDER BY updatedAt ASC` **是否带 `id` 次级排序键**？同秒/同批更新时间在翻页时是否可能重复或丢失？（派单卡口径要求 `updated_at ASC, id ASC`）

**核验项 4 · 租户隔离**：三个函数内是否**只用** `queryWithTenant`/`queryOneWithTenant`？是否存在裸 `query` 拼串？逐条给 SQL 中 `tenant_id` 条件的行号。

**核验项 5 · 只读**：三个 delta 函数体内是否存在任何写语句（INSERT/UPDATE/DELETE）？给出 grep 命令与输出。

**核验项 6 · `since` 边界**：`validateSince`（`controllers/admin/sync.controller.ts` 顶部）对「缺失 / 非法 / 未来时间」三种输入的实际行为是什么？是否与派单卡口径一致（缺失→1970 第一页；非法→400 + 明确 message；未来→空 changes + `until = since` 回显）？给可复跑证据（可跑针对性 vitest 或 node 脚本；若只能静态判定，必须写明是静态判定）。

**核验项 7 · 本机验收可执行性（环境事实）**：以下四条是否成立，给出复跑命令与原始输出 ——
- 本机 3306 无 MySQL 监听 / 无 docker / 无 mysql 客户端；
- `backend/.env` 的 `USE_MOCK_DB=true`（mock 模式只支持 SELECT，返回空集，**不能**作为分页/租户隔离的真库证据）；
- GitHub 不可达（`git ls-remote --heads origin` 失败，代理指向 `127.0.0.1:9`；`ssh`/`scp` 为 deny 垫片）；
- 结论：派单卡的验收 ②③④⑤（"真库复跑 + 原始输出"）与红线"开分支 + 开 PR + 远端真值核对"在本机**能否**完成？

## 三、允许的动作 / 禁止项

- **允许**：只读查看任意仓库文件；跑只读命令（`git log`/`git grep`/`rg`/`npx vitest run <指定文件>` 等）；在 `tmp-b1-verify/` 临时目录内写临时脚本（用毕删除）。
- **禁止**：修改任何既有源码/测试/文档（**除下方唯一交付物**）；新建业务代码；`git add/commit/push/checkout/branch/reset`；连数据库；起服务；改 `docs/tasks/current-tasks.md`（记账由凌舟负责）。

## 四、唯一交付物

`docs/tasks/inbox/ACTIVE-回执.md`（覆盖式重写，署名三项齐全），内容必须含：

1. 一句话结论（B-1 前提是否成立；既有实现是否达标；若不达标，**哪几项不达标**）；
2. 核验项 1–7 逐条结论 + 可复跑命令 + 原始输出摘要 + 文件/行号；
3. 「② 分页数据丢失」的复现证据（命令 + 输出）与证据边界声明；
4. 待真库/待网络确认的清单（写清"要什么条件才能定"）；
5. 未完成与阻塞、风险与自我报备（两栏不得省略，无内容写"无"）。

完成后把本卡移入 `docs/tasks/inbox/archive/ACTIVE-B1-前提核验-20260922.md`，并删除 `docs/tasks/inbox/ACTIVE.md`。

## 五、回传格式（照抄，不得自拟）

```
【核验回执 B-1-前提】<一句话结论>
汇报对象：凌舟（总负责人）
汇报人：阿坚（后端，本地子代理代执行）｜<日期>
交付物：
证据（可复跑）：
核验自评（1 前提 2 契约 3 分页 4 租户 5 只读 6 边界 7 可执行性 逐条）：
未完成与阻塞：
风险与自我报备：
回传要求：本回执已落卡 docs/tasks/inbox/ACTIVE-回执.md
关联卡：docs/tasks/cards/R101-派单-20260922-B.md
```

派单人：凌舟（总负责人）｜2026-09-22
