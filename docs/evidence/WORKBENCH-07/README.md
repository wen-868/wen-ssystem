# WORKBENCH-07 · 仪表盘真实数据与导航语义收口（证据包）

> 负责人：墨（工作台前端 owner）｜2026-10-28
> 基线：`eef1386ee9a3bb7d676bae3243b7d43d04d86c11`
> 分支：`workbench/WORKBENCH-07-dashboard-contract`
> 工作树：`D:\Users\ZXQL\ZXQL-WORK\worktrees\ms\WORKBENCH-07`
> 依据：`projects/ms/reports/R101-工作台审查清单-20261022.md`

## 一、四个审计项的处置

| 审计项 | 根因（已核实） | 修复 |
|:--|:--|:--|
**WB-AUDIT-01** 今日指标恒 0 | `Dashboard.vue:249-251` 读扁平 `d.todaySalesAmount/todayOrderCount/todayGrossProfit`；后端 `dashboard.service.ts:360-406` 返回**嵌套** `today.salesAmount/orderCount`，且 **overview 根本没有毛利字段** | 走共享适配器读 `today.*`；毛利改取 `GET /api/admin/reports/profit`（`finance-report.service.ts:307-321` 的 `grossProfit`） |
**WB-AUDIT-02** 待办恒空 | 前端读四个**不存在**的分组字段（`inventoryAlerts/expiryAlerts/overdueReceivables/pendingOrders`）；真实端点 `/dashboard/todos` 返回 **`{ total, items[] }`**（`dashboard.service.ts:649`） | 改接 `/dashboard/todos`；四态 `loading/empty/ready/error` + 失败重试；**失败绝不伪装成"今日无待办"** |
**WB-AUDIT-04** 客户会员死链 | 两处指向不存在的 `/customer/members` | 统一走共享常量 `CUSTOMER_MEMBERS_ROUTE = "/customers"`（路由表 `router/index.ts:160` 实存 `customers` → `CustomersView.vue`） |
**WB-AUDIT-08** 门店本月恒 0 | `StoreDashboardView.vue:129-130` 读扁平 `monthSalesAmount/monthOrderCount`；同一 `/admin/dashboard/overview` 实返嵌套 `month.*`；且 `catch { }` **静默失败** | 走**同一适配器**；失败置 error 态、卡片显示"—"并提供重试 |

## 二、真实响应证据（硬验收 §1 / §8）

抓包命令与原始样本见 `raw/`（mock DB 模式后端，**仅用于证明响应形状，不作为生产读数**）：

```powershell
# 后端（mock DB）：USE_MOCK_DB=true NODE_ENV=development PORT=8080 node node_modules/tsx/dist/cli.mjs src/server.ts
POST /api/admin/auth/login  {"username":"admin","password":"admin@2026"}  → 200（JWT 345 字符）
GET  /api/admin/dashboard/overview       → 200
GET  /api/admin/dashboard/todos          → 200
GET  /api/admin/dashboard/recent-alerts  → 200
GET  /api/admin/reports/profit?dateStart=2026-10-28&dateEnd=2026-10-28 → 200
```

| 端点 | 真实 `data` 形状（摘自 `raw/`） |
|:--|:--|
`/dashboard/overview` | `{ today:{salesAmount,orderCount,receivedAmount,purchaseAmount,purchaseOrderCount,compareYesterday{...}}, month:{...}, year:{...}, pending, stockAlerts, inventory, finance }` —— **无 grossProfit** |
`/dashboard/todos` | `{ total: 0, items: [] }` —— **嵌套 `{total, items}`，不是平铺数组** |
`/dashboard/recent-alerts` | `[]` —— 平铺数组 |
`/reports/profit` | `{ dateStart, dateEnd, income, cost, returns, grossProfit, grossProfitRate, ... }` |

> **抓包纠正了一次源码误读（重要，留痕防复发）**：我最初只读 `getTodos` 里连续 `items.push({...})` 的写法，
> 就推断它返回"平铺数组"并据此写了适配器与测试夹具。运行态抓包显示实际是 `{total, items}`；
> 回查源码 `dashboard.service.ts:649` 确为 `return { total: items.length, items };`。
> 已按真实形状修正适配器（同时保留平铺兼容），并把该错误写进契约文件注释。

## 三、适配器前后字段对照（唯一真相源）

新增 `admin-web/src/utils/dashboard-contract.ts`，两页共用（`parseDashboardOverview / parseDashboardTodos / parseDashboardAlerts / parseProfitGross / groupTodos / resolveDataState / todayRange / monthRange`）。

| 指标 | 修复前（读法） | 修复后（读法） |
|:--|:--|:--|
今日销售额 | `d.todaySalesAmount`（扁平，恒 0） | `parseDashboardOverview(raw).today.salesAmount` ← `today.salesAmount` |
今日订单 | `d.todayOrderCount`（扁平，恒 0） | `.today.orderCount` |
今日毛利 | `d.todayGrossProfit`（**后端无此字段**） | `.today.grossProfit` ← `reports/profit.grossProfit`（取不到为 `null`，UI 显示"—"） |
本月销售 | `data.monthSalesAmount`（门店，恒 0） | `.month.salesAmount` |
本月订单 | `data.monthOrderCount`（门店，恒 0） | `.month.orderCount` |
待办 | `alertData.inventoryAlerts.length` 等四个**不存在**字段 | `parseDashboardTodos(raw).data` ← `{total, items}` |
客户会员 | `navTo('/customer/members')` ×2 | `navTo(CUSTOMER_MEMBERS_ROUTE)` = `/customers` |

## 四、复跑命令

```powershell
# ① 契约测试（23 例）
node admin-web/tests/dashboard-contract.spec.mjs

# ② 四类 mutation（注入 → 点名红 → SHA256 恒等复原 → 回绿）
node admin-web/tests/dashboard-countertest.mjs

# ③ 全量测试（既有 155 条不得减少）
npm test --prefix admin-web

# ④ 门禁（node_modules 在工作树根）
node node_modules/vue-tsc/bin/vue-tsc.js -b admin-web/tsconfig.json --force
node node_modules/eslint/bin/eslint.js admin-web/src/
node node_modules/vite/bin/vite.js build --config admin-web/vite.config.ts admin-web
```

## 五、结果摘要

| 项 | 读数 |
|:--|:--|
契约测试 | **23 passed / 0 failed** |
全量测试 | **178 passed / 0 failed**（既有 **155 条一条未减** + 新增 23） |
mutation | **4/4 点名变红** + **4/4 SHA256 恒等复原** + 复原后 23/23 回绿 |
`vue-tsc -b --force` | EXIT=0 |
`eslint src/` | EXIT=0 |
`vite build` | EXIT=0（✓ built in 57s） |

## 六、mutation 反测明细（派单卡 §六 四类）

| 反测 | 注入 | 结果 |
|:--|:--|:--|
**M1** | 适配器去掉嵌套优先、退回只读扁平 | EXIT=1，**3 条**点名红（今日销售额/嵌套优先/边界），"今日销售额应读 today.salesAmount" |
**M2** | 把 alerts 失败映射成 `{ok:true,data:[],state:'empty'}` | EXIT=1，**1 条**点名红（alerts 失败与空可区分） |
**M3** | 门店页绕开适配器、自建 `{ok:true,data:{month:{...}}}` | EXIT=1，**1 条**点名红（共用强断言） |
**M4** | 入口改回 `/customer/members` | EXIT=1，**1 条**点名红（入口） |

> **M3 抓出一个门禁缺口并已补强**：初版"共用适配器"断言只检查"是否 import 并调用 parseDashboardOverview"，
> 注入"调用后另写 mapping"仍能通过（EXIT=0，分辨力不足）。已新增**强断言**
> 「两页不得自建指标对象、不得伪装适配器结果」，M3 随即点名红。这是反测应有的作用，不是为过绿改判据。

## 七、未验边界（如实登记，未宣称真实页面已通过）

1. **运行态业务读数为 0**：本机无 MySQL（3306 DOWN），后端以 `USE_MOCK_DB=true` 启动，而 mock-db **不覆盖** dashboard 相关表
   ⇒ 抓到的 `today/month` 全为 0、`todos.items` 为空。**这证明的是响应形状，不是生产读数。**
2. **真实页面渲染未验**：未在浏览器中验证"非空数据 → 指标非 0 / 待办列表渲染"。需要的运行态证据在本环境不可得。
3. **毛利归属口径**：overview 无毛利字段，本单按 `reports/profit` 当日区间取；若产品口径要求"今日毛利"含退货冲减等差异，
   需与产品确认（当前实现直接用后端 `grossProfit` 定义）。
4. **WB-AUDIT-03/05/06/07/09/10** 未触碰（派单卡 §七 明确不扩展）。
5. **既有守卫口径变更**：`ai-primary / parity-coverage / menu-ai-bridge` 三个 spec 的"views/backend 绝对零改动"断言
   改为**授权白名单**（本单卡 §三 授权改两个看板页）。已保留分辨力：卡外任何 views/backend 改动仍判红。

## 八、目录

```text
docs/evidence/WORKBENCH-07/
├── README.md                       # 本文件
└── raw/
    ├── resp-overview.json          # /dashboard/overview 真实响应
    ├── resp-todos.json             # /dashboard/todos 真实响应（{total,items}）
    ├── resp-recent-alerts.json     # /dashboard/recent-alerts 真实响应
    └── resp-profit.json            # /reports/profit 真实响应（含 grossProfit）
└── redtest/
    └── dashboard-countertest.md    # 四类 mutation 原始记录
```
