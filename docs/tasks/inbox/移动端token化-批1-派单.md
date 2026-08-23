# 移动端 Token 化 —— 批1 派单

> 派单人：凌舟 ｜ 日期：2026-08-24 ｜ 执行方：workBuddy ｜ 验收：凌舟（全量重截图逐张把关）
> 必读：`docs/tasks/移动端token化-专项计划.md`（含映射表/红线/验收，本卡是其批1执行）
> 前置：`$uni-spacing-md: 20rpx` 已补入 `app-mobile/src/uni.scss`（Phase 0 完成）

## 一、本批范围（9 页，先列表/卡片/报表重点）
1. `pages-sub/marketing/member/member-list.vue`
2. `pages/orders/orders.vue`
3. `pages-sub/finance/reports/reports.vue`
4. `pages-sub/finance/reports/sales-reports.vue`
5. `pages-sub/product/inventory/inventory.vue`
6. `pages-sub/finance/reconciliation/reconciliation.vue`
7. `pages-sub/finance/loss-gain/loss-list.vue` 与 `gain-list.vue`（及 `loss-gain-report.vue`）
8. `pages-sub/finance/reports/customer-reports.vue`、`finance-reports.vue`

## 二、做法（严格按映射表，逐条可回溯）
把上述页的**写死 间距/圆角/阴影/颜色**替换为 `$uni-*` token（映射见计划文档第四节）。**禁止全局正则**，只对写死值逐条替换。

## 三、强制验收（每页）
1. `SHOT_VIEWPORT=319x645 LOGIN_USERNAME=store_manager LOGIN_PASSWORD=admin123 SHOT_ONLY=<页> node ui-shot.mjs` 截**改前**图。
2. 逐条替换 → `npm run build:h5` 通过。
3. 同命令截**改后**图。
4. 改前/改后比对：**无回归**（不拍平按钮/页签/徽章/输入框/AI/悬浮/tab/标题栏）；具体卡片/列表间距、圆角达到全局 token 观感。
5. 达标 → 记录「页面+替换类型+前后截图」；9 页完成后**一次性报进度**（改动文件 + 前/后对照截图抽样）。

## 四、红线（硬性禁止）
- ❌ 不碰按钮/标签/徽章/状态标/输入框/AI 大圆角/悬浮胶囊/tab 导航/`page-header` 标题栏。
- ❌ 不改后端/接口/逻辑；**禁止假数据**；SVG 用 `/static/icons/**`。
- ❌ 禁止无脑正则全局替换；拿不准的 token 就近取，宁保守。
- 业务数据默认色值（表单默认/文案色）不 token 化。

## 五、验收（凌舟）
1. 凌舟 `npm run build:h5` + `node ui-shot.mjs`（`SHOT_VIEWPORT=319x645`）全量重截图。
2. 逐张核对：间距/圆角/颜色是否符合全局 token 观感、无回归、无拍平。
3. 达标→收口；不达标→按页列出差距打回。

> 完成记录填本卡下方；批2（权限/配置/营销）/批3（顶层页）待批1验收通过后再派。
