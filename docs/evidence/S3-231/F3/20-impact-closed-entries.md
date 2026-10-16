# S3-231 F3 · 因缺码被关闭的入口（注册表口径：37 个入口）

> 生成：`node docs/evidence/S3-231/F3/tools/f3-impact.mjs`（可复跑）
> 触发条件：**入口门取不到权限码**（`permissions` 为 `null`/`undefined`）⇒ 失败关闭（S3-231 F3）；
> 门数：`status='gated'` **26** 个（全部会被关闭）｜`status='registered'` **11** 个（码数组为空 ⇒ 不设门 ⇒ **不受影响**）。

## 一、被关闭的入口（26 个，逐条）

| # | 入口 id | 域 | 入口（页面位置） | 页面 | 缺哪个码 | 归属单（basis） |
|--:|:--|:--|:--|:--|:--|:--|
| 1 | `sale-order-detail-deliver` | 销售域 | 订单详情页「确认订单 / 开始配送 / 完成配送」三个状态流转按钮 | `pages/orders/order-detail.vue` | `sale:create` | S3-230（本注册表所在单） |
| 2 | `sale-order-detail-cancel` | 销售域 | 订单详情页「取消订单」按钮 | `pages/orders/order-detail.vue` | `sale:void` | S3-209 |
| 3 | `sale-create-hold` | 销售域 | 开单页「挂单」按钮 | `pages/sales/create-sale.vue` | `sale:create` | S3-230（本注册表所在单） |
| 4 | `sale-bill-offline-pay` | 销售域 | 销售单详情页「线下收款」按钮 | `pages-sub/order/sales/sale-detail.vue` | `sale:create` | S3-230（本注册表所在单） |
| 5 | `sale-receipt-sub` | 销售域 | 开单页「收款单」子段 | `pages/sales/create-sale.vue` | `sale:create` | S3-230（本注册表所在单） |
| 6 | `purchase-sub-order` | 采购域 | 开单页「采购 → 采购订单」子段 | `pages/sales/create-sale.vue` | `purchase:create` | S3-230（本注册表所在单） |
| 7 | `purchase-sub-inbound` | 采购域 | 开单页「采购 → 采购入库」子段 | `pages/sales/create-sale.vue` | `inventory:inbound` | S3-230（本注册表所在单） |
| 8 | `purchase-sub-return` | 采购域 | 开单页「采购 → 采购退货」子段 | `pages/sales/create-sale.vue` | `sale:return` | S3-230（本注册表所在单） |
| 9 | `purchase-sub-payment` | 采购域 | 开单页「采购 → 付款单」子段 | `pages/sales/create-sale.vue` | `finance:payment` | S3-230（本注册表所在单） |
| 10 | `home-in-stock` | 采购域 | 首页快捷入口「扫码入库」 | `pages/home/home.vue` | `inventory:inbound` | S3-230（本注册表所在单） |
| 11 | `fx-stock-check` | 库存/追溯域 | 功能中心「盘点调拨」入口（`goods:stock-check`） | `pages-sub/product/stock-check/stock-checks.vue` | `inventory:create + inventory:adjust` | S3-230（本注册表所在单） |
| 12 | `fx-stock-warning` | 库存/追溯域 | 功能中心「库存预警」入口（`goods:stock-warning`）+「我的」页「库存预警」快捷入口 | `pages-sub/product/stock-warning/stock-warning.vue` | `inventory:adjust` | S3-230（本注册表所在单） |
| 13 | `fx-loss-gain` | 库存/追溯域 | 功能中心「报损报益」入口（`goods:loss-gain`） | `pages-sub/finance/loss-gain/loss-gain-report.vue` | `inventory:adjust` | S3-230（本注册表所在单） |
| 14 | `fx-transfer` | 库存/追溯域 | 功能中心「门店调拨」入口（`finance:transfer`） | `pages-sub/finance/transfer/transfer.vue` | `store:transfer` | S3-230（本注册表所在单） |
| 15 | `fx-transfer-receive` | 库存/追溯域 | 调拨单「门店收货」按钮 | `pages-sub/finance/transfer/transfer.vue` | `store:transfer` | S3-230（本注册表所在单） |
| 16 | `goods-detail-edit` | 商品域 | 商品详情页底栏「修改 / 保存」按钮（一次保存会打商品主数据、SKU、单位、营销标签四族端点） | `pages/products/product-detail.vue` | `goods:edit + goods:price + goods:create + goods:delete` | S3-230（本注册表所在单） |
| 17 | `goods-batch-price-submit` | 商品域 | 批量改价页「提交」按钮 | `pages-sub/product/batch-price/batch-price.vue` | `goods:price` | S3-230（本注册表所在单） |
| 18 | `goods-category-create` | 商品域 | 商品分类页「新增分类」按钮 | `pages-sub/product/categories/categories.vue` | `goods:create` | S3-230（本注册表所在单） |
| 19 | `goods-category-edit` | 商品域 | 商品分类编辑页「保存」按钮 + 分类页「编辑/排序」动作 | `pages-sub/product/categories/category-edit.vue` | `goods:edit` | S3-230（本注册表所在单） |
| 20 | `goods-category-delete` | 商品域 | 商品分类页「删除」按钮 | `pages-sub/product/categories/categories.vue` | `goods:delete` | S3-230（本注册表所在单） |
| 21 | `staff-entry` | 员工/账号域 | 「我的」页「员工管理」入口 | `pages/profile/profile.vue` | `system:user:create + system:user:edit` | S3-225 |
| 22 | `role-entry` | 员工/账号域 | 「我的」页「角色管理」入口 | `pages/profile/profile.vue` | `system:role:create + system:role:edit` | S3-225 |
| 23 | `mkt-coupons` | 营销域 | 功能中心「优惠券」入口 + 推送深链（`marketing` → 优惠券页） | `pages-sub/marketing/marketing/coupons.vue` | `marketing:create` | S3-226 |
| 24 | `mkt-activities` | 营销域 | 功能中心「营销活动」入口 | `pages-sub/marketing/marketing/activities.vue` | `marketing:create` | S3-226 |
| 25 | `fin-bank-accounts` | 财务域 | 门店管理页「银行账户」新增 / 关闭按钮 | `pages-sub/admin/stores/stores.vue` | `finance:create` | S3-223 |
| 26 | `fin-recon-confirm` | 财务域 | 对账页「确认对账」按钮（客户 / 供应商） | `pages-sub/finance/reconciliation/reconciliation.vue` | `report:finance` | S3-214-B2 |

## 二、不受影响的入口（11 个，码数组为空）

| # | 入口 id | 域 | 为什么不门 |
|--:|:--|:--|:--|
| 1 | `fx-trace-verify` | 库存/追溯域 | `trace:*` 在生产**无任何在用持有者**（`docs/evidence/_shared/prod-roles-20261016.txt`），挂码即把溯源查询打成 403； |
| 2 | `goods-scan-lookup` | 商品域 | 该 POST 语义为**查询**（不改数据），按 S3-227 C 类口径应登记进门禁 `READ_ONLY_POSTS` ⇒ 等门禁批/裁定，本单不门（挂 `goods:*` 会 |
| 3 | `mkt-coupon-verify` | 营销域 | 核销是**门店收银动作**（今天由店长/店员执行），而营销域既有写码 `marketing:create` 的在用持有者只有超管/运营 ⇒ 按"宁可登记跳过"处理：先去营销域收编单 |
| 4 | `mkt-points-adjust` | 营销域 | 三个候选互相冲突（`marketing:points`（超管/运营）／`customer:*`（店长）／`marketing:create`），取决于"谁该调积分"⇒ 待裁定，本单 |
| 5 | `mkt-points-exchange` | 营销域 | 全仓无导航入口 ⇒ 按卡面口径**不为其造入口**，只登记（将来补回入口时按 `marketing:points` 显隐） |
| 6 | `cust-statement-confirm` | 客户域 | S3-222 §12.3 W 类：页面可见角色（生产菜单 `finance:statement`）含 `READONLY`/`STORE_ADMIN`，与任何客户域写码都不重叠；" |
| 7 | `island-quote-push` | 销售域 | 不造入口；将来补回入口时按销售域口径显隐（管理面 `sale:create|edit|void`） |
| 8 | `island-aftersale` | 销售域 | 不造入口；售后族已落地码为 `sale:return`（同域 confirm-receipt） |
| 9 | `island-order-exception` | 销售域 | 不造入口；订单状态族口径 `sale:edit`（管理面） |
| 10 | `island-collection-link` | 销售域 | 不造入口；门店端收款族口径 `sale:create` |
| 11 | `island-instant-retail-admin` | 销售域 | 27 条（12 运营 + 15 平台）；不造入口。⚠️ 平台配置 15 条另有"路由前缀待核"问题（台账 §14.5 已登记） |

## 三、影响面（哪些角色失去哪些入口）

**关键口径**：`null/undefined` 不是某个角色，而是「**取不到权限码**」这一**临时态**（`/admin/auth/me` 未回 / 老版本本地缓存缺字段）。
因此影响面**不是角色相关**的，而是：**该态持续期间，无论什么角色都看不到上述 26 个入口**；
一旦 `permissions` 以**数组**形态到达（含空数组），判定立刻回到「按码显隐」（在用角色矩阵见 `s3230-gate-check.mjs` C 节）。

| 角色 | 该态下的可见入口 | 恢复后可见性 | 说明 |
|:--|:--|:--|:--|
| 全部角色（含 SUPER_ADMIN / STORE_MANAGER 等在用写角色） | 仅 11 个 `registered` 入口 | 按 `codes` 判定的正常集合 | 临时态期间保守隐藏，**不产生 403 点击**（这正是失败关闭的目的） |

## 四、反测（证明"该情况必须出现在清单里、不得静默"）

- 反测 1：把某 `gated` 入口的码改成**不存在的码** ⇒ 该入口对非通配在用角色**不可见**（`s3230-gate-check.mjs` D1 节）；
- 反测 2：把 `permissions` 置为 `null` ⇒ `hasPermissionCodes(null, 非空码)` **必须为 false**（`s3230-gate-check.mjs` E 节，S3-231 F3 改判后的断言）；
- 反测 3：把 `permissions` 置为 `[]` ⇒ 同样 false（原本即如此，回归保护）。
