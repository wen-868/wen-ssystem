# 任务卡：ache_r99_02 — R99-02 [P1] P0 核心页逐页精设计（阶段 2）

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（前端设计/开发）
- **优先级**：P1
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、任务背景

工作台全页面设计（R99）阶段 2：R99-01 已完成设计体系（tokens v4.1 + Element Plus 主题 + 4 种页面骨架规范 + 5 个示范页）。本任务把 **P0 核心页（18 页）逐页精设计**，按骨架规范落地，达到用户参考图（高端 SaaS 卡片精致度）水准。

## 二、必读文件

1. `docs/tasks/current-tasks.md` R99-00（设计语言与精美度要点）+ R99-01（完成记录）+ R99-02（本任务）
2. `docs/design/工作台页面设计规范.md`（**四种骨架规范，本任务核心依据**）
3. `admin-web/src/styles/tokens.css`（v4.1 tokens）+ `admin-web/src/styles.css`（Element Plus 全局主题）
4. R99-01 五个示范页代码（登录/首页看板/收银台/商品列表/销售开单）——**作为设计标杆参照**
5. 参考图：`D:\Huawei Share\Huawei Share\share_86a64ce95dc681ea4c99f0450b8c3878.png`、`share_a7a0e28abc05cff2740fcb0cf325a4d3.png`（需要时用 read-image 技能查看）

## 三、任务清单（18 页）

### 客户模块（3）
- `customer/CustomersView.vue`（列表页骨架：统计条 + 筛选 + 表格卡 + 分页）
- `customer/CustomerDetail.vue`（详情页骨架：页头 + 详情卡 + 关联区块）
- `customer/MemberSystem.vue`（会员体系，指标卡 + 列表/配置）

### 订单模块（3）
- `order/Orders.vue`（列表页骨架）
- `order/OrderCenterView.vue`（订单中心，状态 Tab + 列表）
- `order/OrderBoardView.vue`（订单看板，看板骨架）

### 库存模块（3）
- `inventory/Inventory.vue`（库存总览，看板骨架）
- `inventory/InventoryAlerts.vue`（预警列表，列表骨架 + 状态标签）
- `inventory/InventoryBatch.vue`（批次库存，列表骨架）

### 商品模块（3）
- `product/ProductCategories.vue`（分类管理，列表/树形）
- `product/PricesView.vue`（价格管理，列表骨架）
- `product/ProductCombo.vue`（组合商品，列表骨架）

### 报表模块（3）
- `report/Reports.vue`（销售统计，看板骨架：指标卡 + 图表 + 明细）
- `report/SalesAnalysis.vue`（销售分析，看板骨架）
- `report/CustomerAnalysis.vue`（客户分析，看板骨架）

### POS 模块（3）
- `pos/SaleBillsView.vue`（销售单据，列表骨架）
- `pos/HoldOrderView.vue`（挂单，列表骨架）
- `pos/CollectionView.vue`（收款，看板/列表骨架）

## 四、要求

- 每页按对应骨架落地：页头（标题+操作）、指标卡（如适用，大数字 tabular-nums）、筛选栏、表格/卡片、分页、空态/加载态、状态标签
- 柔和阴影三档（--shadow-card/hover/modal）、圆角 10-12px、留白规范，全部走 tokens
- **只改样式与模板结构，不动业务逻辑、接口、数据流**
- 保持 Element Plus 组件用法，不引入新 UI 库

## 五、验证

- `npm run build:check`（admin-web）exit 0
- 每页本地 H5 走查截图（`docs/reports/R99-02-*`），0 控制台错误
- read-image 抽查 3-5 页与参考图对照（可选，至少自检）
- 提交推送 origin/main（中文提交信息）

## 六、验收标准

- 18 页全部按骨架落地，视觉与 R99-01 示范页一致（无风格断层）
- build:check 通过、截图齐备、无回归
- current-tasks.md 更新 R99-02 完成记录；任务卡归档

## 七、注意事项

- 全程简体中文；最小改动；**禁止改动 backend/miniapp/app-mobile/saas-admin**
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-02、复述关键内容、给出完成结果与验证证据
