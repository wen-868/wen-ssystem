# R95-02 任务卡 — 功能中心三入口接入真实后端（阿澈）

> 派单：凌舟 2026-08-07　优先级：P1　预计：1 天
> 来源：R95-01 遗留「单据打印/系统设置/溯源查询标开发中」——凌舟核查后端源码，三者后端均已实现，须接入，不得占位。

## 必读文件

1. `docs/tasks/current-tasks.md` —— R95-02 任务卡 + 「凌舟补充决策」表 + 必读文件清单
2. 后端路由证据（先读再写前端）：
   - `backend/src/routes/print.routes.ts`（R51-03：POST/GET `/api/admin/print/records`、`/records/:id`、`/records/:id/reprint`）
   - `backend/src/routes/trace.routes.ts`（`/api/admin/trace/configs`、`/codes/generate`、`/codes`、`/codes/:traceCode`、`/query/:traceCode` 追溯链、`/verify` 防伪、`/recalls`）
   - `backend/src/routes/sys-config.routes.ts`（`/api/admin/sys-config`：GET 全部/分组、PUT `/batch`、POST）
3. `app-mobile/src/api/modules/print.ts`（打印 API 已封装，直接复用）

## 任务要求

### 1. 单据打印
- 新建打印记录页（如 `pages-sub/admin/print/print-records.vue`），复用 `printApi`：记录列表（bill_type/bill_no/status/时间）、状态标签、详情查看、重打（reprint）
- `pages.json` 注册；`functions.vue` 「单据打印」入口 path 指向该页

### 2. 溯源查询
- 新建 `app-mobile/src/api/modules/trace.ts`：封装追溯码查询 `GET /admin/trace/codes/:traceCode`、追溯链 `GET /admin/trace/query/:traceCode`、防伪验证 `POST /admin/trace/verify`（参数结构对照后端 schema/controller）
- 新建溯源查询页（如 `pages-sub/product/trace/trace-query.vue`）：输入追溯码 → 展示商品/批次/追溯链 + 「防伪验证」按钮
- `pages.json` 注册；`functions.vue` 「溯源查询」入口 path 指向该页（不再指向 batch-list）

### 3. 系统设置
- 新建系统设置页（如 `pages-sub/admin/settings/settings.vue`）：接 sys-config API，按分组展示配置（打印/权限/通知等），支持编辑保存（PUT `/batch`）
- `pages.json` 注册；`functions.vue` 「系统设置」入口 path 指向该页

### 4. 「更多」入口
- 不得显示「开发中」：跳转功能中心全量列表（如复用 functions 页锚点或新建更多页）

## 数据铁律

- 全部接真实 API，不写演示数据；后端无数据的场景展示空态；如某个子功能后端确无接口，保留占位并附源码核查证据（禁止仅凭猜测标「开发中」）
- 只改入口/新增页面与对应 API，不碰无关代码与 R95-01 已完成的样式

## 验收标准

- `npm run build:h5` + `build:app` + `npx vue-tsc --noEmit` 全部 exit 0
- 功能中心三入口可跳转到真实页面，页面数据来自后端（或空态），无「功能开发中」占位
- `node .playwright-cli/pw-run/walkthrough2.mjs` 12 核心页走查仍 0 结构崩溃/0 404（预期 403 除外）
- 完成记录写入 current-tasks.md R95-02（每入口：页面、API、验证证据）

完成后：任务卡移至 `docs/tasks/inbox/archive/`，更新 current-tasks.md，向凌舟回报（任务标识 + 复述 + 验证证据）。
