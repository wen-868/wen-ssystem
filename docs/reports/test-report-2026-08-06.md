# R76-05 全量回归 + 端到端验收报告

> 检测时间：2026-08-06 01:40 - 02:05
> 检测人：苏然（QA）
> 任务来源：R76-05（任务卡 `docs/tasks/inbox/suran_r76_05.md`）
> 回归范围：R74-R76 全部改动（PC 端 UIUX 打磨、列表页统一、后端测试覆盖、vue-tsc 清理、移动端子功能补齐）

---

## 一、回归结论

| 项 | 结果 |
|---|------|
| 后端 typecheck | ✅ 0 errors（exit 0） |
| 后端全量测试 | ✅ 435 文件 / 5056 用例全部通过（0 失败 0 跳过） |
| admin-web vue-tsc | ✅ 0 errors（exit 0） |
| admin-web build | ✅ exit 0（39.26s） |
| app-mobile build:h5 | ✅ exit 0（仅 Sass @import 弃用警告） |
| app-mobile build:app | ✅ exit 0（仅 Sass 弃用警告） |
| 浏览器端到端走查 | ✅ 核心流程通过，无本轮引入的控制台错误 |
| 「敬请期待」清零复验 | ✅ 0 命中 |
| **综合结论** | **通过，无功能回归** |

---

## 二、命令级验证证据

### 2.1 后端

```text
> npm run typecheck（backend）
> tsc -p tsconfig.json --noEmit
typecheck exit=0

> npx vitest run（backend）
Test Files  435 passed (435)
      Tests  5056 passed (5056)
vitest exit=0
```

- 与 R76 派单基线完全一致：435 文件 / 5056 用例，0 失败、0 跳过
- 说明：测试日志中出现的 `[Redis] Connection error: connect ECONNREFUSED 127.0.0.1:6379` 为本地无 Redis 服务的环境噪音，不影响用例结果（exit 0）

### 2.2 admin-web

```text
> npx vue-tsc -b
vue-tsc exit=0

> npm run build
✓ built in 39.26s
build exit=0
```

### 2.3 app-mobile

```text
> npm run build:h5
DONE  Build complete.
build:h5 exit=0

> npm run build:app
DONE  Build complete.
build:app exit=0

> rg "敬请期待|功能开发中" app-mobile/src
「敬请期待」0 命中；「功能开发中」为项目标准允许的占位提示（非本轮回归缺陷）
```

- 两个构建均有 Sass `@import` 弃用警告（与 R76-04 记录一致，非本轮引入）

### 2.4 浏览器端到端走查（playwright + Edge）

走查路径：登录 → 工作台 → 收银台（加购/结算弹窗）→ 列表页抽查（订单/商品/库存/客户/财务）

| 页面 | URL | 渲染结果 |
------|-----|---------|
| 登录页 | `/login` | ✅ 左品牌区（批零一体/即时零售/AI 助手/多门店）+ 右登录表单，对标 R74-06 设计稿 p02 |
| 工作台 | `/dashboard` | ✅ 欢迎语+日期+门店状态、今日指标卡、侧边栏分组（工作台/业务/系统） |
| 收银台 | `/pos/cashier` | ✅ 功能导航栏（快速收银/销售单据/挂单管理/交接班等 8 项）、左侧分类+商品网格（库存/价格）、右侧购物车（会员识别/件数/应收/支付四宫格/快捷键 F2·F4·F9/结算按钮） |
| 加购 | — | ✅ 点击商品加入购物车，件数 0→1、应收 ¥0→¥129.00、结算按钮激活 |
| 结算弹窗 | — | ✅ 弹窗含应收金额 ¥129.00、1 件商品·散客、支付方式（现金/微信/支付宝/余额）、确认收款按钮，对标 p12 |
| 订单列表 | `/orders` | ✅ 统计条（全部/待付款/待发货…）+ 筛选栏（搜索/订单状态/支付状态）+ 紧凑表格 |
| 商品列表 | `/products` | ✅ 统计条（全部/在售/草稿）+ 搜索栏 + 紧凑表格 |
| 库存列表 | `/inventory` | ✅ 统计条（库存条目/低库存/缺货）+ 筛选栏（搜索/门店）+ Tab（库存总览/库存流水） |
| 客户列表 | `/customers` | ✅ 统计条（全部客户…）+ 搜索栏 + 表格 |
| 财务列表 | `/payments` | ✅ 统计条（收款关联/付款单/退款单）+ 筛选栏（搜索/状态）+ 表格 |

控制台检查：走查全程唯一控制台错误为

```text
404 (Not Found) @ http://localhost:8080/api/admin/inventory/balances
```

该请求来自 Inventory 页调用的 `fetchInventoryBalances()`（`admin-web/src/api/customer.ts:47`），后端从未注册 `/api/admin/inventory/balances` 路由，为历史遗留前后端不匹配（见下文问题清单），非本轮 R74-R76 引入，页面已优雅降级为空态，无功能阻断。

---

## 三、发现问题清单

| 编号 | 优先级 | 问题 | 文件 | 归属 | 说明 |
------|:----:|------|------|------|------|
| BUG-R76-05-01 | P2 | 前端 `fetchInventoryBalances()` 请求 `/api/admin/inventory/balances`，后端无该路由（404）；自 R50-12/R54 起存在，非 R76 引入，页面空态降级不阻断 | `admin-web/src/api/customer.ts:47`、`admin-web/src/views/inventory/Inventory.vue` | 墨（前端）/ 阿坚（后端确认） | 建议下一轮确认该接口是否废弃（前端是否仍需要库存总览数据）或由后端补齐路由 |

> 注：登录页首次以 `admin/Admin@2026` 登录返回 400（mock 库凭据为 `admin/admin123`），属本地 mock 后端环境限制，非代码缺陷；正式环境以实际部署凭据为准。

---

## 四、环境说明

- 本地后端以 `USE_MOCK_DB=true` 测试环境运行（`backend/.env`），mock 数据有限，列表数据量展示以 mock 返回为准
- `app-mobile/src/manifest.json` 存在未提交改动（模块配置：移除 Payment、新增 SecureNetwork 等），为既有工作区改动，本次回归保留未动
- 仓库 HEAD：`4e8b0e8d`；本地分支：main

---

## 五、验收结论

✅ **R76-05 验收通过**：后端 435 文件/5056 用例 0 失败 0 跳过，三端构建与类型检查全部 exit 0，浏览器端到端走查核心流程（登录→工作台→收银台加购/结算→5 个列表页）无功能回归、无本轮引入的控制台错误。发现的 1 个 P2 历史遗留问题（库存余额接口 404）写入 current-tasks.md 下一轮跟进。
