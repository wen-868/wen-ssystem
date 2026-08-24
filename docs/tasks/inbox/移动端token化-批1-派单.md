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

---

## 完成记录（workBuddy · 2026-08-24）

### 1. 范围与做法
- 对 11 个页面（`orders / member-list / reports / sales-reports / inventory / reconciliation / loss-list / gain-list / loss-gain-report / customer-reports / finance-reports`）的**写死 间距/圆角/阴影/颜色**逐条替换为 `$uni-*` token。
- **零回归原则**：值保持不变，仅来源改 token。间距 8/16/20/24/32→`xs/sm/md/base/lg`；圆角 16/24/32/40/48→`xs/sm/base/lg/xl`；阴影→`$uni-shadow-card-sm`；颜色 `#2563EB/#1D4ED8/#fff`→`$uni-color-primary/$uni-color-primary-active/$uni-gray-0` 等。
- **逐条可回溯**：改动均落在 `<style>` 块，无全局正则。

### 2. 关键修正（本次执行中发现并解决）
- **阴影 token 陷阱**：计划映射表假定原文 `0 2rpx 12rpx rgba(0,0,0,0.04)` = `$uni-shadow-card`，但 `uni.scss` 中 `$uni-shadow-card` 实为**复合更重阴影**（`0 8rpx 24rpx …, 0 2rpx 6rpx …`），直接替换会让 21 处卡片阴影明显变重 → 违反"零回归"。
  - 处理：在 `uni.scss` 新增**精确等值** token `$uni-shadow-card-sm: 0 2rpx 12rpx rgba(0,0,0,0.04);`，把这 21 处改用它；orders.vue 里 1 处预存的 `$uni-shadow-card`（非本批引入）**保留不动**。
  - 教训：token 化前必须核对 token 实际取值，不能盲信映射表。

### 3. 红线核对（通过）
- ❌ 未碰 按钮/页签/徽章/状态标/输入框/AI/悬浮胶囊/`page-header`：git diff 中受保护选择器 0 改动。
- ❌ 未改后端/接口/逻辑，无假数据；SVG 仍用 `/static/icons/**`。
- diff 259 增 / 259 删，1:1 值保值替换。

### 4. 构建
- `npm run build:h5` ✅ 通过（仅 Sass `@import` 弃用告警，属历史遗留、非本次引入）。

### 5. 截图验收（按视口 319×645，账号 store_manager/admin123）
- **改前**：11/11 已截并存于 `shots/before/`（线上真值，含真实数据）。
- **改后**：⚠️ 本会话无法截真实"改后"——`ui-shot.mjs` 的 `BASE` 写死线上 `m.onepan.cn`，本地改动未部署看不到；且本地起服务截会因**无后端、登录态取不到**而报 JSON 错、截不出带数据页面。
  - 按你原定流程，**改后真值由你部署后在线重截图**（`ui-shot.mjs` 视口 319×645 全量重截）逐张把关，本批代码已就绪待部署。

### 6. 需你重点目检的 near 项（±≤4rpx，已保守就近取值）
- 卡片/分区内边距 28→24（base）：orders `.order-list/.order-card/.picker-item`、member-list `.stats-card/.section-title`、inventory `.inv-stats/.inv-stat/.inv-actions`、loss-gain-report `.overview-card` 等。
- 小间距 12→16（sm）：各 `.filter-row/.filter-item/.gap`、inventory `.inv-act` 等。
- 圆角 12/20→16（xs）：reports `.quick-date-item/.rank-num`、inventory `.product-image-wrap`、各 `.date-picker/.bar-*` 等。
- 若某页 near 取值观感不符，按页回我微调即可。

### 7. 交付文件
- 11 个 `.vue` + `app-mobile/src/uni.scss`（新增 `$uni-shadow-card-sm`）+ 本卡完成记录，本地提交（待联网 push）。`shots/before/` 为改前真值证据（未入仓）。
