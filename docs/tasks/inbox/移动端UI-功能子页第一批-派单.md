# 移动端 UI 原稿对齐 —— 功能子页第一批 派单

> 派单人：凌舟 ｜ 日期：2026-08-24 ｜ 执行方：workBuddy ｜ 验收：凌舟（逐页截图对比原稿，不通过打回）
> 原稿：`D:\workBuddy\2026-07-03-20-16-43\zxql-ui-preview.html`（唯一真相源）
> 仓库：`D:\Users\ZXQL\ZXQL-MS\wen-ssystem`（app-mobile，唯一分支 main，提交信息用中文）

## 一、本批范围（3 页）
按「Tab 顺序完善子页」推进，本批为先导的 3 个业务核心子页：

1. **订单管理**（`app-mobile/src/pages/orders/orders.vue`，路由 `pages/orders/orders`）
2. **库存管理**（`app-mobile/src/pages-sub/product/inventory/inventory.vue`）
3. **会员管理**（`app-mobile/src/pages-sub/product/customers/customers.vue`）

> 说明：本轮已统一这些页的通栏标题栏（`<page-header title=... @back=goBack />`），**标题栏保持不动**，仅对其余布局/间距/色彩/字体/图标逐项对齐原稿。

## 二、逐页对齐要点（对照原稿）

### 1. 订单管理（pg-orders）
- Tabs：全部 / 待付款 / 待发货 / 已完成 / 退款（激活态指示条、切换不丢筛选）
- 订单卡：单号 + 状态徽章、商品行摘要（名称/数量/金额）、客户·渠道·时间、合计金额、操作按钮（详情/确认收款/配送等，按真实状态显示，接订单 API）
- 空态：无订单时展示空态插画 + 文案，不编造数据

### 2. 库存管理（pg-inventory）
- 顶部统计：总 SKU 数 / 库存价值 / 预警商品（接真实统计/仪表）
- 快捷入口：入库 / 出库 / 盘点 / 库存预警（入口可达真实页面）
- SKU 列表：缩略图/名称/规格、库存、有库存预警红标；保留虚拟滚动/搜索

### 3. 会员管理（pg-members）
- 统计：总会员 / 本月新增 / 活跃率
- 搜索栏（名称/手机号）
- 会员列表：首字头像 / VIP 等级 / 最近消费 / 累计消费；点按进会员详情

## 三、红线（硬性）
- 不改后端、不改接口契约、不改与 UI 无关代码；**只改 UI 结构/间距/色彩/字体/SVG 图标**
- **禁止引入假数据/模拟数据**；数据必须来自真实 API，无数据展示空态
- SVG 图标用 `/static/icons/**` 线框风格（如 `search.svg`/`scan.svg`/`bell.svg` 等），**不得给图标加无意义 `xmlns`**
- 不破坏各页现有交互/真实接口提交逻辑（订单状态流转、库存接口、会员接口）
- 每个改动文件`npm run build:h5` 前后不引入新告警/错误

## 四、交付
直接改仓库 app-mobile 并 `git push`（提交信息中文）；或交付产物到 `D:\workBuddy\2026-07-03-20-16-43\outputs\`（含改后源 + 改动说明 + 构建证据）。

## 五、验收（凌舟执行）
1. workBuddy 提交 → 凌舟 `npm run build:h5` + 手机视口截图对应 3 页
2. 逐页对比原稿：结构/间距/色彩/字体/图标；并核对真实接口无回归
3. 达标→通过；不达标→列出具体差距→打回继续，直至通过

> 完成记录填在本卡下方；下次按「订单→库存→会员→消息→报表→快速开单→打印」顺序继续下一批。

## 六、完成记录（workBuddy 执行）

- 执行日期：2026-08-24 ｜ 提交信息中文 ｜ 仅改 UI 层，未动后端/接口/提交逻辑，无假数据。
- 改动文件（3 个）：
  1. `src/pages-sub/product/inventory/inventory.vue` —— 快捷入口「入/出/盘/警」文字图标改为线框 SVG（`fn-stockin` / `ic/truck` / `fn-check` / `fn-alert`），图标容器统一为蓝柔底（`$uni-color-primary-soft`）+ 蓝色图标，对齐原稿 `.inv-act svg` 蓝色线框风格；删除 `inv-act-ico--blue/orange/green/red` 与 `inv-act-text`。
  2. `src/pages-sub/product/customers/customers.vue` —— 新增「会员列表」分区标题（原稿 `section-title`）；VIP 等级按原稿配色差异化（`vip3` 金 / `vip2` 蓝 / 其余灰），新增 `vipClass()`；「累计消费」金额由红色（误读为欠款）改为正文深色；搜索占位文案改为「搜索会员姓名 / 手机号」。
  3. `docs/tasks/inbox/移动端UI-功能子页第一批-派单.md` —— 本完成记录。
- 未改动：`src/pages/orders/orders.vue`（经比对已与原稿结构/间距/色彩/字体/图标一致，Tabs+订单卡+空态齐全，故未做无谓改动）。
- 红线核对：未改后端/接口契约；未引入假数据（库存价值/本月新增/活跃率无字段处仍显示「—」）；SVG 均取自 `/static/icons/**` 线框；真实接口提交/跳转逻辑未破坏（入库/出库/盘点/预警路由、会员详情/新增、订单状态流转均保留）。
- 构建：`npm run build:h5` ✅ 通过，无新增告警/错误（仅既有 Sass `@import` 弃用提示）；已验证新 SVG 随包发布、编译产物含 `vip3`/`会员列表`、旧文字图标已清除。
- 待验收：凌舟 `build:h5` + 手机视口逐页截图对比原稿（订单/库存/会员）。
