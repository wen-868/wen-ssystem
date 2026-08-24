# 移动端 Token 化 —— 批3 派单

> 派单人：凌舟 ｜ 日期：2026-08-24 ｜ 执行方：workBuddy ｜ 验收：凌舟（**批2+批3 统一验证**，部署后在线全量重截图逐张把关）
> 必读：`docs/tasks/移动端token化-专项计划.md`（映射表/红线/验收）+ 批1完成记录的坑（阴影 `$uni-shadow-card` 实际非等值，需核对真实值）
> 前置：`$uni-spacing-md: 20rpx`、`$uni-shadow-card-sm` 已在 `app-mobile/src/uni.scss`

## 一、本批范围（83 页 = 剩余全部，顶层 + 其余子页；批1/批2 已做的不重复）

### 顶层（15）
`pages/login/login`、`pages/register/register`、`pages/home/home`、`pages/orders/order-detail`、`pages/sales/create-sale`、`pages/products/products`、`pages/products/product-detail`、`pages/functions/functions`、`pages/profile/profile`、`pages/ai-chat/ai-chat`、`pages/profile/edit`、`pages/profile/change-password`、`pages/notifications/notifications`、`pages/notifications/notification-detail`、`pages/todos/todos`

### order 子包（4）
`pages-sub/order/order-center/order-center`、`pages-sub/order/order-exception/exception`、`pages-sub/order/order-aftersale/aftersale`、`pages-sub/order/sales/sale-bills`

### product 子包（21）
`pages-sub/product/product/product-edit`、`pages-sub/product/customers/customers`、`pages-sub/product/customers/customer-detail`、`pages-sub/product/batches/batch-list`、`pages-sub/product/batches/batch-detail`、`pages-sub/product/categories/categories`、`pages-sub/product/categories/category-edit`、`pages-sub/product/suppliers/suppliers`、`pages-sub/product/batch-price/batch-price`、`pages-sub/product/price-review/price-review`、`pages-sub/product/price-anomaly/price-anomaly`、`pages-sub/product/price/price-manage`、`pages-sub/product/price/batch-adjust`、`pages-sub/product/price/batch-logs`、`pages-sub/product/price-push/price-push`、`pages-sub/product/stock-check/stock-checks`、`pages-sub/product/stock-check/create-check`、`pages-sub/product/stock-check/check-detail`、`pages-sub/product/stock-warning/stock-warning`、`pages-sub/product/collection-link/collection-link`、`pages-sub/product/trace/trace-query`

### marketing 子包（18）
`pages-sub/marketing/marketing/marketing`、`pages-sub/marketing/marketing/activities`、`pages-sub/marketing/marketing/participation-records`、`pages-sub/marketing/marketing/community-activities`、`pages-sub/marketing/marketing/group-buy-list`、`pages-sub/marketing/marketing/group-buy-detail`、`pages-sub/marketing/marketing/bargain-list`、`pages-sub/marketing/marketing/seckill-list`、`pages-sub/marketing/member/member`、`pages-sub/marketing/member/member-detail`、`pages-sub/marketing/member/address`、`pages-sub/marketing/member-levels/member-levels`、`pages-sub/marketing/member-levels/level-config`、`pages-sub/marketing/points/points-detail`、`pages-sub/marketing/points/points-exchange`、`pages-sub/marketing/stored-cards/stored-cards`、`pages-sub/marketing/stored-cards/recharge-records`、`pages-sub/marketing/stored-cards/consume-records`

### finance 子包（14）
`pages-sub/finance/finance/finance-dashboard`、`pages-sub/finance/finance/expenses`、`pages-sub/finance/finance/expense-create`、`pages-sub/finance/reports/inventory-reports`、`pages-sub/finance/reports/purchase-reports`、`pages-sub/finance/receipts/receipts`、`pages-sub/finance/receivable/receivable`、`pages-sub/finance/statements/statements`、`pages-sub/finance/loss-gain/create-loss`、`pages-sub/finance/loss-gain/create-gain`、`pages-sub/finance/loss-gain/loss-gain-detail`、`pages-sub/finance/transfer/transfer`、`pages-sub/finance/purchase/orders`、`pages-sub/finance/purchase/in-stock`

### admin 子包（11）
`pages-sub/admin/admin/admin`、`pages-sub/admin/admin/employees`、`pages-sub/admin/roles/roles`、`pages-sub/admin/roles/role-edit`、`pages-sub/admin/stores/stores`、`pages-sub/admin/stores/store-edit`、`pages-sub/admin/system/operation-logs`、`pages-sub/admin/system/operation-log-detail`、`pages-sub/admin/report-permission/index`、`pages-sub/admin/report-permission/store-data-permission`、`pages-sub/admin/print/print-records`

> 合计：15+4+21+18+14+11 = 83 页。

## 二、做法（严格按映射表，逐条可回溯）
同批2：把**写死 间距/圆角/阴影/颜色**替换为 `$uni-*` token；禁止全局正则；**阴影先核对真实值**；拿不准就近取、宁保守。`ai-chat`、`create-sale`、`home` 等重灾页按映射表逐条替换，但**遵守红线**（AI 大圆角/悬浮/标题栏/tab 不动）。

## 三、强制验收（本批内）
1. **改前截图（必须，先截再改）**：`SHOT_VIEWPORT=319x645 LOGIN_USERNAME=store_manager LOGIN_PASSWORD=admin123 SHOT_ONLY=<本批页面逗号分隔> SHOT_OUT=shots/before-batch3 node ui-shot.mjs`（线上真值）。
2. 逐条替换 → `npm run build:h5` 通过。
3. 记录「页面 + 替换类型 + near 项（±≤4rpx）清单」，逐页可溯。
4. **本批不做改后截图**——批2+批3 全完成后由凌舟部署后在线统一验证。

> **质量门禁（硬性）**：本批 83 页体量大，内部必须按「顶层 → order/product → marketing → finance/admin」分 4 个小组推进，**每组完成时**先 `npm run build:h5` 通过 + 自查（该组改前/对照截图**无回归、无拍平**）才进入下一组；**每 20 页报一次进度**；全部完成才整批提交。
>
> **严禁为赶进度跳步/整批一把梭**——任何一组 build 不过或有回归，立即修正后再推进，不得带病往下做。

## 四、红线（硬性禁止）
- ❌ 不碰按钮/标签/徽章/状态标/输入框/AI 页大圆角/悬浮胶囊/tab 导航/`page-header` 标题栏。
- ❌ 不改后端/接口/逻辑；**禁止假数据**；SVG 用 `/static/icons/**`。
- ❌ 禁止无脑正则全局替换；拿不准的 token 就近取，宁保守。
- 业务数据默认色值（表单默认/文案色）不 token 化，保留原样。

## 五、验收（凌舟）
- 批2+批3 全完成后，凌舟 `npm run build:h5`（整体）+ `ui-shot.mjs` 全量重截图，逐张核对距/圆角/颜色是否符合全局 token 观感、无回归、无拍平。
- 达标收口；不达标按页列差距打回。

> 完成记录填本卡下方。
