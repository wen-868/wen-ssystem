# R95-01 任务卡 — 移动端 UI v1.0 落地（阿澈）

> 派单：凌舟 2026-08-07　优先级：P1　预计：3-5 天（分批）

## 必读文件（动手前必须逐一读完）

1. `docs/design/智享全链-移动端UI-v1.0.html` —— **唯一设计依据**，用浏览器打开逐页对照（11 页）
2. `docs/tasks/current-tasks.md` —— R95-01 任务卡 + 必读文件清单
3. `docs/项目规则.md` / `docs/项目统一标准.md` / `docs/踩坑日志.md` / `docs/memories/阿澈-记忆.md`

## 任务背景

用户对现有移动端 UI 不满意，提供《智享全链-移动端UI-v1.0》设计稿，要求把该 UI 更新进 app-mobile；
用户允许团队设计更美观的方案。凌舟决策：**以设计稿为基线落地（已获用户认可的高质量原型），
实施中做 UI/UX 精细化打磨超越原稿**，不推倒重来。

## 设计稿结构（11 页）

| 设计稿页面 | 对应 app-mobile 页面 | 核心组件 |
|-----------|---------------------|---------|
| pg-home 首页工作台 | pages/home/home | 今日营业额/订单数据卡+环比、本月三卡、订单进度四宫格、最新订单列表、7日趋势图 |
| pg-products 商品 | pages/products/products | 搜索、商品列表（左滑操作保留） |
| pg-ai-assistant AI 助手 | pages/ai-chat/ai-chat | 问候语 + 4 快捷指令（今日经营分析/库存异常诊断/利润优化建议/快速开单） |
| pg-quick-order 快速开单 | pages/sales/create-sale | 客户选择、商品加减、商品数/件数、应收金额、暂存/结算收款 |
| pg-functions 功能中心 | pages/functions/functions | 高频宫格（开单收银/会员管理/进货入库/盘点调拨/收银对账/门店管理/单据打印/更多）+ 数据工具区（经营报表） |
| pg-profile 我的 | pages/profile/profile | 用户卡（姓名/角色/门店/ID/营业中）+ 工作记录/员工管理/对账/单据打印/门店管理 + 门店信息/员工管理/营业时间 |
| pg-orders 订单管理 | pages/orders/orders | 状态 tab（全部/待付款/待发货/已完成/退款）+ 订单卡（单号、商品摘要、客户·渠道·时间、金额、操作按钮） |
| pg-inventory 库存管理 | pages-sub/product/inventory/inventory | 统计（总SKU/库存价值/预警数）+ 快捷（入库/出库/盘点/库存预警）+ SKU 列表 |
| pg-members 会员管理 | pages-sub/product/customers/customers | 统计（总会员/本月新增/活跃率）+ 会员列表（VIP/最近消费/累计消费） |
| pg-messages 消息中心 | pages/notifications/notifications | 分类（全部/订单/库存/系统）+ 消息列表 |
| pg-reports 数据报表 | pages-sub/finance/reports/reports | 周期（今日/本周/本月/本年）+ 指标（营业额/毛利/客单价/复购率）+ 销售趋势 + 销售排行 |

## 设计要点（落地必须体现）

- **Tokens**：主蓝 `#2563eb`（渐变 `#2563eb→#1d4ed8`）、灰阶 `#171717→#f7f7f7`、语义色、圆角 8~24px、阴影 sh1~sh4、毛玻璃（rgba(255,255,255,.92)+backdrop-filter）
- **底部导航**：5 tab + 中间 AI 圆形按钮（52px、蓝色渐变、阴影、按压缩放 .92、active 顶部 2px 指示条、毛玻璃底栏）
- 各页面组件细节见设计稿，逐页对照实现

## 实施顺序（每批完成即构建验证）

1. uni.scss tokens 换新体系（含毛玻璃/阴影/圆角变量），tabBar 重构（AI 中键）
2. 四个 tab 页：home / products / functions / profile
3. ai-chat、quick-order（快速开单/收银）
4. orders / inventory / members / messages / reports
5. 子包页面统一 tokens 换肤（保留布局与功能，不逐一重做）

## 数据铁律

设计稿内数字（¥12,680 等）均为演示数据，**仅作视觉参考，禁止写入代码**；
一律接现有真实 API（R94-03 已对齐的 `app-mobile/src/api/modules`），无数据时展示空态，**不编造**。

## 验收标准

- 11 页结构与设计稿逐页对照一致（布局/组件/配色/动效），视觉精细化超过原稿
- 每批 `npm run build:h5` + `build:app` exit 0；`npx vue-tsc --noEmit` 0 errors
- `node .playwright-cli/pw-run/walkthrough2.mjs` 12 核心页走查 0 结构崩溃/0 404（预期 403 除外）
- 完成记录写入 current-tasks.md R95-01（每批：对照页、改动文件、构建/走查证据）

完成后：将本任务卡移动至 `docs/tasks/inbox/archive/`，在 current-tasks.md 更新 R95-01 状态，向凌舟回报总结（任务标识 + 关键复述 + 每批验证证据）。
