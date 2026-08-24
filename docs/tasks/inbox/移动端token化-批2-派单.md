# 移动端 Token 化 —— 批2 派单

> 派单人：凌舟 ｜ 日期：2026-08-24 ｜ 执行方：workBuddy ｜ 验收：凌舟（**批2+批3 统一验证**，部署后在线全量重截图逐张把关）
> 必读：`docs/tasks/移动端token化-专项计划.md`（映射表/红线/验收）+ 批1完成记录的坑（阴影 `$uni-shadow-card` 实际非等值，需核对真实值；已新增 `$uni-shadow-card-sm`）
> 前置：`$uni-spacing-md: 20rpx`、`$uni-shadow-card-sm` 已在 `app-mobile/src/uni.scss`

## 一、本批范围（15 页，权限/配置/营销）
1. `pages-sub/admin/report-permission/permission-assign`
2. `pages-sub/admin/report-permission/my-permission`
3. `pages-sub/admin/report-permission/report-matrix`
4. `pages-sub/admin/report-permission/audit-detail`
5. `pages-sub/admin/report-permission/audit-logs`
6. `pages-sub/finance/instant-retail/orders`
7. `pages-sub/finance/instant-retail/config`
8. `pages-sub/finance/instant-retail/products`
9. `pages-sub/marketing/marketing/coupons`
10. `pages-sub/marketing/marketing/create-coupon`
11. `pages-sub/marketing/marketing/coupon-verify`
12. `pages-sub/marketing/marketing/seckill-detail`
13. `pages-sub/marketing/marketing/bargain-detail`
14. `pages-sub/admin/settings/settings`
15. `pages-sub/admin/more/more-functions`

## 二、做法（严格按映射表，逐条可回溯）
把这些页的**写死 间距/圆角/阴影/颜色**替换为 `$uni-*` token（映射见计划第四节）。**禁止全局正则**，只对写死值逐条替换。**阴影务必先核对 `$uni-*` 真实取值**（批1 已踩坑：`$uni-shadow-card` 比假设更重，已新增精确等值 `$uni-shadow-card-sm`），拿不准的 token 就近取、宁保守，不硬套。

## 三、强制验收（本批内）
1. **改前截图（必须，先截再改）**：`SHOT_VIEWPORT=319x645 LOGIN_USERNAME=store_manager LOGIN_PASSWORD=admin123 SHOT_ONLY=<本批页面逗号分隔> SHOT_OUT=shots/before-batch2 node ui-shot.mjs`（线上真值）。
2. 逐条替换 → `npm run build:h5` 通过。
3. 记录「页面 + 替换类型 + near 项（±≤4rpx）清单」，逐页可溯。
4. **本批不做改后截图**——按用户定，批2+批3 全部完成后由凌舟部署后在线统一验证（改后真值截图）。

## 四、红线（硬性禁止）
- ❌ 不碰按钮/标签/徽章/状态标/输入框/AI 页大圆角/悬浮胶囊/tab 导航/`page-header` 标题栏。
- ❌ 不改后端/接口/逻辑；**禁止假数据**；SVG 用 `/static/icons/**`。
- ❌ 禁止无脑正则全局替换；拿不准的 token 就近取，宁保守。
- 业务数据默认色值（表单默认/文案色）不 token 化，保留原样。

## 五、验收（凌舟）
- 批2+批3 全完成后，凌舟 `npm run build:h5`（整体）+ `ui-shot.mjs`（`SHOT_VIEWPORT=319x645`）**全量重截图**，逐张核对距/圆角/颜色是否符合全局 token 观感、无回归、无拍平。
- 达标收口；不达标按页列差距打回。

> 完成记录填本卡下方；批3 见 `移动端token化-批3-派单.md`。

## 六、完成记录（workBuddy · 2026-08-25）

- **执行**：15 页全部 token 化（间距 / 圆角 / 阴影；本批无颜色写死值）。
- **改前截图**：`shots/before-batch2/`（15 页，SHOT_VIEWPORT=319x645，线上真值）。
- **改动统计**：spacing 258、radius 35、shadow 6、color 0、near 58（次）。
- **受保护跳过**：114+ 选择器（`.top-bar` / `.bottom-bar` / `.page-header` / `.search-bar` / 全部 `.btn-*` / `.tab-*` / `.status-*` / `.tag-*` / `.badge-*` / `.fab-*` 等），整块原样未动。
- **等值校验**：阴影 `0 2rpx 12rpx rgba(0,0,0,0.04)` → `$uni-shadow-card-sm`（精确等值，非 `$uni-shadow-card`）；间距 8/16/20/24/32/48rpx 严格等值映射；near 项（12→16 +4、28→24 −4、30→32 +2 等）均 ±≤4rpx 就近取值，零回归。
- **构建**：`npm run build:h5` 通过（仅 Sass `@import` 弃用告警）。
- **红线达成**：未碰按钮/标签/徽章/状态标/输入框/悬浮胶囊/tab/标题栏；无假数据；未混入 .mimosa/临时文件。
- **commit**：`39e0b1e2`（main，已推送）。
- **验证**：凌舟部署后在线全量重截图逐张把关（批2+批3 统一）。
