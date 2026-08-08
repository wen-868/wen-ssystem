# 任务卡：ache_r99_05 — R99-05 [P0] 页面 mock 数据接真实接口

- **派发**：2026-08-08 凌舟（总负责人）
- **负责人**：阿澈（全栈：后端接口核查/补齐 + 前端接入）
- **优先级**：P0
- **项目根（新路径）**：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`

## 一、背景

工作台设计收口中核查发现多个页面展示 **mock/随机/硬编码数据**，用户感知为"数据是假的"，功能正确性优先处理。本任务把以下页面改接真实接口。

## 二、范围（逐页核查确认的 mock 点）

1. **OrderCenterView**（order/OrderCenterView.vue）：今日订单/金额/待处理/异常 = `mockStats`；渠道占比/订单趋势为 mock 数组
2. **SalesAnalysis**（report/SalesAnalysis.vue）：各排行 `Math.random()` 随机
3. **CollectionAnalysis**（report/CollectionAnalysis.vue）：`pendingAmount: 128000` 硬编码 + 趋势随机
4. **Reports**（report/Reports.vue）：totalCustomers/newCustomers/各 growth 百分比硬编码
5. **ProductCombo**（product/ProductCombo.vue）：组合列表/统计卡/图表 mock；保存与上下架为本地模拟（如后端有 combo 接口则接入）
6. **MarketingMaterial**（marketing/MarketingMaterial.vue）：`getMaterialThumbnail` 用 btoa SVG 占位 → 接真实素材图 URL（若素材上传/存储已存在则接入；不存在则保留占位并在代码注释标注）

## 三、任务

1. **核查后端**：对每页所需数据找现有接口/表（订单统计、销售分析、收款/对账统计、报表汇总、组合商品、营销素材）。有接口 → 直接用；无接口 → 按现有 service/表结构补最小接口（后端 routes/controller/service，跟随项目分层惯例）
2. **前端接入**：替换 mock 为真实接口调用，保留加载/空态；**不改变页面结构与样式**
3. **素材缩略图**：优先接真实 image URL；无素材能力则保留占位并注释说明
4. **验证**：后端 `npm run typecheck` + `npm run build`；admin-web `npm run build:check`；本地走查受影响页面确认展示真实数据（无接口数据时显示空态而非随机数）
5. **提交**：中文提交信息，推送 origin/main

## 四、验收

- 6 处 mock 全部接真实接口（或无法接的如实说明并留 TODO 注释）
- build 全过、无回归；页面不再显示随机/硬编码数字
- current-tasks.md 更新 R99-05 完成记录；任务卡归档

## 五、注意事项

- 全程简体中文；最小改动；**禁止改动 miniapp/app-mobile/saas-admin**（admin-web 与 backend 在本任务范围）
- 回复验收要求（按全局 AGENTS.md）：引用本任务标识 R99-05、复述关键内容、给完成结果与验证证据
