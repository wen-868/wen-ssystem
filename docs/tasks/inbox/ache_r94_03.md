# R94-03 任务卡 — 移动端 API 契约对齐（阿澈）

> 派单：凌舟 2026-08-07　优先级：P1　预计：2 天

## 必读文件（动手前必须逐一读完）

1. `docs/reports/R94-03-移动端API契约差距报告.md` —— **核心差距清单与等价接口映射**，本任务的唯一依据
2. `docs/tasks/current-tasks.md` —— R94-03 任务卡 + 必读文件清单
3. `docs/项目规则.md` / `docs/项目统一标准.md` / `docs/踩坑日志.md` / `docs/memories/阿澈-记忆.md`
4. `docs/API接口文档.md` / `docs/数据库变更清单.md`（契约唯一真相源）

## 任务背景

凌舟实测：store_manager 登录后逐条探测 `app-mobile/src/api/modules/` 全部 312 处 API 调用，
发现**路由级 404 共 82 处**（前端调用后端不存在的路径）、**响应结构不匹配 3 处**
（orders/customers/price listLevels：后端返回 `data.records`，前端取 `list` 导致页面崩溃）、
以及 `GET /admin/prices/batch/logs` 403 但价格管理页仍展示「调价记录」入口。

走查已复现报错的页面：订单管理、客户管理、价格管理（结构崩溃）；库存管理、财务看板、数据报表（404 无数据）。

## 修复要求

1. 按差距报告第二部分，逐模块把 404 路径改为后端真实接口并适配返回结构。已确认映射（照做即可）：
   - `/admin/inventory` → `/admin/inventory-balance`；`/admin/inventory/logs` → `/admin/inventory-logs`；`/admin/inventory/alerts` → `/admin/inventory-alerts`；`/admin/inventory/checks(/:id)` → `/admin/stock-checks(/:id)`
   - finance 6 处 → `/admin/finance/dashboard`（聚合）或 `income-expense-stats`/`profit-trend`/`income-by-category`/`expense-by-category`
   - reports 11 处 → `sales-daily`/`sales-trend`/`sales-ranking`/`inventory-summary`/`inventory-turnover`/`inventory-age`/`profit`/`receivable-payable`/`payment-analysis`/`purchase-summary`/`export`
   - `/admin/roles*` → `/admin/system/roles*`；`/admin/member/stored-cards*` → `/admin/store-value-cards*`；`/admin/stores*` → `/admin/system/stores*`；`/admin/purchase-orders/in-stock/:id` → `/admin/purchase-in-stocks` 系列；`/admin/staff/list` → `/admin/staff`；`/admin/inventory/batches*` → `/admin/inventory-batch/batches*`
   - 报告里标「需确认」的（store.ts /store/shifts、/store/members/search、/store/members/info、report-permissions、marketing-activities、order-exceptions、points），先查后端 routes 目录确认真实接口再改；确认无等价接口的按第 3 条降级
2. orders/customers/price listLevels 结构对齐 `records`（参考 admin-web 的 axios 取数写法，与 PC 端统一）
3. 后端确无能力接口（如 operation-logs 详情/types、notifications 单条详情）→ 隐藏入口或保留「开发中」占位，注释标注 R94-03 核实结论，**禁止编造数据**
4. 「调价记录」入口按角色控制：非管理员/店长/财务不显示或点击提示「仅管理员、店长、财务可用」（见 price-guard 中间件）
5. **铁律**：只改 API 模块与受影响页面的取数逻辑/入口控制，不碰布局、样式、无关代码；一处 404 改完标注修复方式（改路径/结构适配/降级）

## 验收标准

- `npm run build:h5` + `npm run build:app` + `npx vue-tsc --noEmit` 全部 exit 0
- 复跑 `.playwright-cli/pw-run/audit-live.mjs`：路由级 404 由 82 降至 0（无法消除的逐条注明原因）
- 走查 12 个核心页面控制台 0 结构崩溃/404 报错（预期 403 除外）
- 本任务卡 + current-tasks.md R94-03 完成记录（含逐处修复方式表）

完成后：将本任务卡移动至 `docs/tasks/inbox/archive/`，在 current-tasks.md 更新 R94-03 状态为 ✅ 并写明验证证据，然后向凌舟回报总结（任务标识 + 关键复述 + 验证证据）。
